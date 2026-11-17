// Property checks for axis labels over a generated corpus of realistic
// charts. Each check collects every violation across the corpus and fails
// once, listing the case and its labels, so one run shows the whole picture.

import {resolveSpec} from '../defaults';
import {parseIsoDate} from '../isoDate';
import {tokens} from '../tokens';
import {validate} from '../validate';
import type {AxisCase, AxisResult} from './testing/corpus';
import type {XAxisLabels} from '../spec';
import {
  REFERENCE_CASES,
  callbackCases,
  estimateLabelWidth,
  forcedLabelCases,
  layoutCase,
  yOptionCases,
  wallClock,
  xAxisCases,
  yAxisCases,
} from './testing/corpus';

const MIN_Y_TICKS = 3;
const MIN_SHORT_Y_TICKS = 2;
// A ratio shown as a percent moves two decimal places (0.25 is 25%).
const PERCENT_SCALE_DIGITS = 2;
const TWO_TICK_GAPS = 2;
// Bars may pass the outermost tick by up to this share of a step, measured
// on the padded domain, before the next tick is required.
const MAX_BAR_OVERSHOOT = 0.75;
// The domain pads the data by about this share of its span (6% below, 3%
// above), which spreads the ticks.
const DOMAIN_PADDING = 0.09;
const MAX_Y_TICKS = 6;
const NICE_FACTORS = [1, 2, 5];
// 2.5 is allowed only when no 1/2/5 step gives 3 to 6 ticks in the domain.
const FALLBACK_FACTOR = 2.5;
const RELATIVE_TOLERANCE = 1e-9;
// Below this plot width two labels may not fit; above it, one label is too few.
const TWO_LABEL_MIN_WIDTH = 240;
const MAX_REPORTED = 40;
const CENTS_PER_DOLLAR = 100;
const DAY_STEPS = [1, 2, 3, 7, 14];
// A range of about a year (in month starts), and the plot width from which
// it must be labelled at least quarterly.
const YEAR_MONTH_STARTS = {min: 11, max: 13};
const QUARTERS_MIN_PLOT_WIDTH = 500;
const QUARTER_LABELS = 4;

/**
 * Problems this corpus found that are not fixed yet. A problem is excused
 * only if it matches one of these (and, when `cases` is given, comes from a
 * case whose name matches it); anything else fails. Each also shows as a
 * todo, so the open list is visible in every run. Remove an entry when its
 * fix lands.
 */
const KNOWN_OPEN: readonly {name: string; matches: RegExp; cases?: RegExp}[] =
  [];

type Violation = {name: string; problem: string; labels: string[]};

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function report(violations: readonly Violation[], total: number): string {
  const lines = violations
    .slice(0, MAX_REPORTED)
    .map(
      (v) =>
        `${v.name}\n    ${v.problem}\n    labels: ${JSON.stringify(v.labels)}`,
    );
  const more =
    violations.length > MAX_REPORTED
      ? `\n...and ${violations.length - MAX_REPORTED} more`
      : '';
  return `${violations.length} of ${total} cases fail:\n${lines.join(
    '\n',
  )}${more}`;
}

function expectNoViolations(
  violations: readonly Violation[],
  total: number,
): void {
  if (violations.length > 0) throw new Error(report(violations, total));
}

function laidOut(axisCase: AxisCase): AxisResult {
  const result = validate(axisCase.spec);
  if (!result.ok) {
    throw new Error(
      `${axisCase.name}: corpus spec is invalid: ${JSON.stringify(
        result.errors,
      )}`,
    );
  }
  return layoutCase(axisCase);
}

type NumberSymbols = {
  group: string;
  decimal: string;
  suffixes: [string, number][];
};
const symbolCache = new Map<string, NumberSymbols>();

/**
 * The locale's separators and its compact suffixes with their multipliers
 * ("K" 1e3, "Mio." 1e6, "万" 1e4), found by formatting powers of ten.
 */
function numberSymbols(locale: string, currency: string | null): NumberSymbols {
  const key = `${locale}|${currency ?? ''}`;
  const cached = symbolCache.get(key);
  if (cached) return cached;
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const group = parts.find((p) => p.type === 'group')?.value ?? ',';
  const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.';
  const suffixes = new Map<string, number>();
  const compact = new Intl.NumberFormat(locale, {
    notation: 'compact',
    ...(currency ? {style: 'currency', currency} : {}),
  });
  for (let exponent = 0; exponent <= 15; exponent += 1) {
    const formatted = compact.formatToParts(10 ** exponent);
    const suffix = formatted.find((p) => p.type === 'compact')?.value;
    const integer = Number(formatted.find((p) => p.type === 'integer')?.value);
    if (suffix && !suffixes.has(suffix))
      suffixes.set(suffix, 10 ** exponent / integer);
  }
  const symbols = {
    group,
    decimal,
    // Longest first, so "Mrd." is not read as a shorter suffix.
    suffixes: [...suffixes].sort((a, b) => b[0].length - a[0].length),
  };
  symbolCache.set(key, symbols);
  return symbols;
}

/** Reads a formatted tick label back into a number, or NaN. */
function parseTickLabel(
  label: string,
  locale: string,
  currency: string | null,
): number {
  const {decimal, suffixes} = numberSymbols(locale, currency);
  let text = label;
  let multiplier = 1;
  for (const [suffix, value] of suffixes) {
    if (text.includes(suffix)) {
      multiplier = value;
      text = text.replace(suffix, '');
      break;
    }
  }
  if (text.includes('%')) multiplier /= 100;
  const negative = /[-−]/u.test(text);
  const digits = [...text]
    .filter((c) => /\d/u.test(c) || c === decimal)
    .join('')
    .replace(decimal, '.');
  if (digits === '') return Number.NaN;
  return (negative ? -1 : 1) * Number(digits) * multiplier;
}

function minorDigits(currency: string, locale: string): number {
  return (
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 0
  );
}

/**
 * The fewest y ticks a plot `height` tall must show: a plot shorter than two
 * minimum tick gaps only has room for 2.
 */
function minTickCount(height: number): number {
  return height < tokens.axis.yTickMinSpacing * TWO_TICK_GAPS
    ? MIN_SHORT_Y_TICKS
    : MIN_Y_TICKS;
}

/**
 * Whether some 1/2/5 x 10^n step has `count` multiples inside
 * `[lowest, highest]` while keeping the minimum tick spacing on a plot
 * `height` tall. When none does, reaching `count` ticks needs overshoot.
 */
function fitsInsideData(
  lowest: number,
  highest: number,
  count: number,
  height: number,
): boolean {
  const span = highest - lowest;
  const exponent = Math.floor(Math.log10(span));
  for (let e = exponent - 3; e <= exponent + 1; e += 1) {
    for (const factor of NICE_FACTORS) {
      const step = factor * 10 ** e;
      const inside =
        Math.floor(highest / step + 1e-9) - Math.ceil(lowest / step - 1e-9) + 1;
      const gap = (height * step) / (span * (1 + DOMAIN_PADDING));
      if (inside >= count && gap >= tokens.axis.yTickMinSpacing) {
        return true;
      }
    }
  }
  return false;
}

/**
 * The fewest ticks, at least 2, that hold `[low, high]` on the finest 1/2/5
 * multiple of `capStep` whose ticks are the minimum spacing apart on a plot
 * `height` tall.
 */
function smallestCapTicks(
  low: number,
  high: number,
  capStep: number,
  height: number,
): number[] {
  const multiples = [1, 2, 5]
    .flatMap((f) => [f, f * 10, f * 100])
    .sort((a, b) => a - b);
  let ticks: number[] = [];
  for (const multiple of multiples) {
    const step = capStep * multiple;
    const first = Math.floor(low / step + RELATIVE_TOLERANCE);
    const last = Math.max(
      first + MIN_SHORT_Y_TICKS - 1,
      Math.ceil(high / step - RELATIVE_TOLERANCE),
    );
    ticks = Array.from({length: last - first + 1}, (_, i) =>
      Number(((first + i) * step).toPrecision(12)),
    );
    const gap = height / (ticks.length - 1);
    if (gap >= tokens.axis.yTickMinSpacing) return ticks;
  }
  return ticks;
}

/** The finest y step a decimal cap allows, or null without a cap. */
function cappedStep(spec: ReturnType<typeof resolveSpec>): number | null {
  const cap = spec.axes.y.maximumFractionDigits;
  if (cap === undefined) return null;
  // Percent values are ratios by the time they are drawn, whatever their unit.
  const percent = spec.format.style === 'percent';
  return 10 ** -(cap + (percent ? PERCENT_SCALE_DIGITS : 0));
}

function isNiceStep(step: number, factors: readonly number[]): boolean {
  const magnitude = 10 ** Math.floor(Math.log10(step) + RELATIVE_TOLERANCE);
  return factors.some((f) => Math.abs(step / magnitude - f) < 1e-6);
}

function tickCountWithStep(
  domain: readonly [number, number],
  step: number,
): number {
  return (
    Math.floor(domain[1] / step + 1e-9) - Math.ceil(domain[0] / step - 1e-9) + 1
  );
}

function yViolations(axisCase: AxisCase, result: AxisResult): string[] {
  const {model, layout} = result;
  const spec = resolveSpec(axisCase.spec);
  const currency =
    spec.format.style === 'currency'
      ? spec.format.currency.toUpperCase()
      : null;
  const labels = layout.yLabels;
  const values = labels.map((l) => l.value);
  const problems: string[] = [];
  // A stack's extent is its segment ends (running totals), not its values.
  const data = model.stacked
    ? model.slots.flatMap((s) => s.stack.flatMap(({y0, y1}) => [y0, y1]))
    : model.slots.flatMap((s) =>
        s.points.flatMap((p) => (p.y === null ? [] : [p.y])),
      );

  if (new Set(labels.map((l) => l.label)).size !== labels.length)
    problems.push('duplicate labels');
  const widest = Math.max(0, ...labels.map((l) => estimateLabelWidth(l.label)));
  if (labels.length > 0 && layout.yLabelLeft + widest > layout.width + 0.5) {
    problems.push(
      `y labels need ${Math.round(widest)}px but ${Math.round(
        layout.width - layout.yLabelLeft,
      )}px are left`,
    );
  }
  // A callback's text is the caller's: only the geometry and ticks are
  // checked for it.
  const callback = axisCase.formatYTick !== undefined;
  labels.forEach(({value, label}) => {
    if (callback) return;
    const parsed = parseTickLabel(label, spec.locale, currency);
    const tolerance = RELATIVE_TOLERANCE * Math.max(1, Math.abs(value));
    if (!(Math.abs(parsed - value) <= tolerance)) {
      problems.push(`label "${label}" reads as ${parsed}, tick is ${value}`);
    }
    if (value === 0 && /[-−]/u.test(label))
      problems.push(`zero shown as "${label}"`);
  });
  const minSpacing = tokens.axis.yTickMinSpacing;
  // A decimal cap sets the finest step (a percent's two scale digits
  // included: 0 decimals is a step of 1%). When that step is wider than the
  // data, the axis is the fewest steps that hold the data, at least 2 ticks,
  // on the finest 1/2/5 multiple of it whose ticks keep the minimum spacing.
  const capStep = cappedStep(spec);
  // Bars keep their 0 baseline, so it counts as data here.
  const reach = spec.chartType === 'bar' ? [...data, 0] : data;
  const reachLow = reach.length > 0 ? Math.min(...reach) : 0;
  const reachHigh = reach.length > 0 ? Math.max(...reach) : 0;
  // Flat data has no extent; its axis is a range invented around it.
  const flat = Math.max(...data) === Math.min(...data);
  const capCoarse = capStep !== null && !flat && reachHigh - reachLow < capStep;
  if (capCoarse) {
    const expected = smallestCapTicks(
      reachLow,
      reachHigh,
      capStep,
      layout.plot.height,
    );
    if (JSON.stringify(values) !== JSON.stringify(expected)) {
      problems.push(
        `capped ticks ${JSON.stringify(
          values,
        )}, want the smallest ${JSON.stringify(expected)}`,
      );
    }
  }
  const minTicks = capCoarse
    ? MIN_SHORT_Y_TICKS
    : minTickCount(layout.plot.height);
  if (labels.length < minTicks || labels.length > MAX_Y_TICKS) {
    problems.push(
      `${labels.length} ticks on a ${layout.plot.height}px plot (want ${minTicks}-${MAX_Y_TICKS})`,
    );
  }
  const spacing =
    labels.length > 1
      ? Math.abs((labels[1]?.y ?? 0) - (labels[0]?.y ?? 0))
      : Infinity;
  if (spacing < minSpacing - 0.5)
    problems.push(
      `ticks ${spacing.toFixed(1)}px apart on a ${layout.plot.height}px plot`,
    );

  // Rounded, so float noise from the subtraction is not read as a bad step.
  const steps = values
    .slice(1)
    .map((v, i) => Number((v - (values[i] ?? 0)).toPrecision(12)));
  const step = steps[0];
  if (step !== undefined) {
    if (
      steps.some(
        (s) => Math.abs(s - step) > RELATIVE_TOLERANCE * Math.abs(step) * 10,
      )
    ) {
      problems.push(`uneven steps ${JSON.stringify(steps)}`);
    } else if (!isNiceStep(step, NICE_FACTORS)) {
      const fallbackJustified =
        isNiceStep(step, [FALLBACK_FACTOR]) &&
        NICE_FACTORS.every((f) => {
          const magnitude = 10 ** Math.floor(Math.log10(step));
          return [magnitude / 10, magnitude, magnitude * 10].every((m) => {
            const count = tickCountWithStep(layout.yDomain, f * m);
            return count < MIN_Y_TICKS || count > MAX_Y_TICKS;
          });
        });
      if (!fallbackJustified) problems.push(`step ${step} is not 1/2/5 x 10^n`);
    }
  }

  if (spec.chartType === 'bar' && !values.includes(0))
    problems.push('bar chart without a 0 tick');
  const [low, high] = layout.yDomain;
  if (
    data.length > 0 &&
    (Math.min(...data) < low || Math.max(...data) > high)
  ) {
    problems.push(
      `domain [${low}, ${high}] misses data [${Math.min(...data)}, ${Math.max(
        ...data,
      )}]`,
    );
  }
  // An axis that crosses zero claims values of the other sign exist. (All
  // zeros may show 0 to 1, the empty axis.)
  if (data.every((v) => v >= 0) && values.some((v) => v < 0)) {
    problems.push('negative ticks for data that is never negative');
  }
  if (
    data.some((v) => v < 0) &&
    data.every((v) => v <= 0) &&
    values.some((v) => v > 0)
  ) {
    problems.push('positive ticks for data that is never positive');
  }
  // Whole-unit amounts get ticks on the currency's smallest unit (no half
  // yen); data that is really sub-unit may have finer ticks.
  if (currency && !callback) {
    const unit = 10 ** -minorDigits(currency, spec.locale);
    const onUnit = (v: number): boolean =>
      Math.abs(v / unit - Math.round(v / unit)) < 1e-6;
    if (data.every(onUnit) && !values.every(onUnit)) {
      problems.push(`ticks finer than the ${currency} minor unit`);
    }
    // Full amounts show the currency's decimals or none: "$0.20", not
    // "$0.2". Compact labels ("$1.2T") round to significant digits instead,
    // and a caller's decimal cap overrides the currency's own.
    const digits = minorDigits(currency, spec.locale);
    const {decimal, suffixes} = numberSymbols(spec.locale, currency);
    const compact = (label: string): boolean =>
      suffixes.some(([suffix]) => label.includes(suffix));
    const capped = spec.axes.y.maximumFractionDigits !== undefined;
    if (values.every(onUnit) && !capped) {
      labels.forEach(({label}) => {
        if (compact(label)) return;
        const fraction = label.split(decimal)[1]?.match(/^\d*/u)?.[0] ?? '';
        if (fraction.length !== 0 && fraction.length !== digits) {
          problems.push(
            `"${label}" shows ${fraction.length} of ${digits} decimals`,
          );
        }
      });
    }
  }
  // Bars may run past the last tick by less than a step (more than 3/4 of
  // one only when the next tick cannot fit).
  // Negative bars of half a step or more need a labelled scale below 0.
  if (spec.chartType === 'bar' && data.length > 0 && step !== undefined) {
    const lowest = Math.min(...data);
    const highest = Math.max(...data);
    const lowTick = Math.min(...values);
    const highTick = Math.max(...values);
    if (-lowest >= step / 2 && lowTick >= 0) {
      problems.push(`no tick below 0 for bars down to ${lowest}`);
    }
    if (lowTick - lowest >= step || highest - highTick >= step) {
      problems.push(
        `bars ${lowest}..${highest} run a step past ticks ${lowTick}..${highTick}`,
      );
    }
    // Past 3/4 of a step (on the padded domain), the next tick belongs on
    // the axis unless adding it would exceed the tick count or squeeze the
    // ticks below the spacing.
    const extraTickBreaksRules = (domainSpan: number): boolean =>
      labels.length + 1 > MAX_Y_TICKS ||
      (layout.plot.height * step) / domainSpan < minSpacing;
    if (
      highest > 0 &&
      high - highTick > step * MAX_BAR_OVERSHOOT &&
      !extraTickBreaksRules(Math.max(high, highTick + step) - low)
    ) {
      problems.push(`bars to ${highest} lack the tick above ${highTick}`);
    }
    if (
      lowest < 0 &&
      lowTick - low > step * MAX_BAR_OVERSHOOT &&
      !extraTickBreaksRules(high - Math.min(low, lowTick - step))
    ) {
      problems.push(`bars to ${lowest} lack the tick below ${lowTick}`);
    }
    // With only 2 ticks, the outermost one must reach the bars, or the
    // scale says nothing about their size. One tick is 0, so bars of both
    // signs can only have their taller side reached; the other hangs below
    // half a step (checked above).
    if (labels.length === MIN_SHORT_Y_TICKS) {
      const upward = highest >= -lowest;
      if (upward && highTick < highest) {
        problems.push(
          `2-tick axis tops out at ${highTick} below bars to ${highest}`,
        );
      }
      if (!upward && lowTick > lowest) {
        problems.push(
          `2-tick axis bottoms out at ${lowTick} above bars to ${lowest}`,
        );
      }
    }
  }
  // No end of the domain may leave half a step or more empty past the data
  // (a loose $200K-$600K axis for $250K-$456K), except where the 3-tick
  // minimum forces one step of overshoot on a short plot. A bar baseline at
  // 0 is not empty space, and flat data has no extent to measure against.
  if (
    data.length > 0 &&
    Math.max(...data) > Math.min(...data) &&
    step !== undefined
  ) {
    const lowest = Math.min(...data);
    const highest = Math.max(...data);
    const baseline = spec.chartType === 'bar';
    const emptyBelow = baseline && lowest >= 0 ? 0 : lowest - low;
    const emptyAbove = baseline && highest <= 0 ? 0 : high - highest;
    const forcedByHeight =
      labels.length === minTicks &&
      !fitsInsideData(lowest, highest, minTicks, layout.plot.height);
    if (
      !forcedByHeight &&
      !capCoarse &&
      (emptyBelow >= step / 2 || emptyAbove >= step / 2)
    ) {
      problems.push(
        `domain [${low}, ${high}] leaves half a step empty past data ${lowest}..${highest} on a ${layout.plot.height}px plot`,
      );
    }
  }
  if (values.some((v) => v < low || v > high))
    problems.push(`tick outside domain [${low}, ${high}]`);
  return problems;
}

type Wall = ReturnType<typeof wallClock>;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Wall-clock fields of a spec x: UTC for calendar dates, the spec zone for instants. */
function wallOf(x: string, zone: string): Wall | null {
  const parsed = parseIsoDate(x);
  if (!parsed) return null;
  return wallClock(parsed.time, parsed.kind === 'date' ? 'UTC' : zone);
}

const wallTime = (w: Wall): number =>
  Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
const monthNumber = (w: Wall): number => w.year * 12 + w.month - 1;

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

/** Every way a label may correctly name its date, in the case's locale and zone. */
function acceptableTexts(x: string, locale: string, zone: string): Set<string> {
  const parsed = parseIsoDate(x);
  if (!parsed) return new Set();
  const timeZone = parsed.kind === 'date' ? 'UTC' : zone;
  const styles: Intl.DateTimeFormatOptions[] = [
    {month: 'short', day: 'numeric'},
    {month: 'short', day: 'numeric', year: 'numeric'},
    {month: 'short'},
    {month: 'short', year: 'numeric'},
    {year: 'numeric'},
    {weekday: 'short'},
    {weekday: 'short', day: 'numeric'},
    {hour: 'numeric'},
    {hour: 'numeric', minute: '2-digit'},
  ];
  return new Set(
    styles.map((style) =>
      dateFormatter(locale, {...style, timeZone}).format(parsed.time),
    ),
  );
}

/** The date a label names, as a spec x: a calendar date or a UTC instant. */
function labelDate(index: number, result: AxisResult): string | null {
  const time = result.layout.xLabels[index]?.time;
  if (time === undefined) return null;
  const iso = new Date(time).toISOString();
  return result.calendarDays ? iso.slice(0, iso.indexOf('T')) : iso;
}

function monthOrYearTexts(
  x: string,
  locale: string,
  zone: string,
): Set<string> {
  const parsed = parseIsoDate(x);
  if (!parsed) return new Set();
  const styles: Intl.DateTimeFormatOptions[] = [
    {month: 'short'},
    {month: 'short', year: 'numeric'},
    {year: 'numeric'},
  ];
  const timeZone = parsed.kind === 'date' ? 'UTC' : zone;
  return new Set(
    styles.map((style) =>
      dateFormatter(locale, {...style, timeZone}).format(parsed.time),
    ),
  );
}

const MS_PER_MONTHLY = 28 * MS_PER_DAY;

/**
 * The granularity a case forces, or null when the axis chooses (no forcing,
 * or a granularity the data cannot show: times of day need sub-daily data,
 * dates need data finer than monthly).
 */
function forcedLabels(
  axisCase: AxisCase,
  dataStep: number,
): Exclude<XAxisLabels, 'auto'> | null {
  const labels = axisCase.spec.chart?.axes?.x?.labels;
  if (labels === undefined || labels === 'auto') return null;
  if (labels === 'time' && dataStep >= MS_PER_DAY) return null;
  if (labels === 'day' && dataStep >= MS_PER_MONTHLY) return null;
  return labels;
}

const FORCED_STYLES: Record<
  Exclude<XAxisLabels, 'auto'>,
  Intl.DateTimeFormatOptions[]
> = {
  // A time axis names the date at midnight, so the day stays readable.
  time: [
    {hour: 'numeric'},
    {hour: 'numeric', minute: '2-digit'},
    {month: 'short', day: 'numeric'},
    {month: 'short', day: 'numeric', year: 'numeric'},
  ],
  day: [
    {month: 'short', day: 'numeric'},
    {month: 'short', day: 'numeric', year: 'numeric'},
  ],
  month: [{month: 'short'}, {month: 'short', year: 'numeric'}],
  year: [{year: 'numeric'}],
};

/** The texts a label forced to `granularity` may show for its date. */
function forcedTexts(
  granularity: Exclude<XAxisLabels, 'auto'>,
  x: string,
  locale: string,
  zone: string,
): Set<string> {
  const parsed = parseIsoDate(x);
  if (!parsed) return new Set();
  const timeZone = parsed.kind === 'date' ? 'UTC' : zone;
  return new Set(
    FORCED_STYLES[granularity].map((style) =>
      dateFormatter(locale, {...style, timeZone}).format(parsed.time),
    ),
  );
}

function xViolations(axisCase: AxisCase, result: AxisResult): string[] {
  const {layout, slotX} = result;
  const spec = resolveSpec(axisCase.spec);
  const labels = layout.xLabels;
  const problems: string[] = [];
  const present = slotX.flatMap((x) => (x === null ? [] : [x]));
  if (present.length === 0) return problems;
  if (labels.length === 0) return ['no x labels'];
  const dataStep =
    present.length > 1
      ? (parseIsoDate(present[1] ?? '')?.time ?? 0) -
        (parseIsoDate(present[0] ?? '')?.time ?? 0)
      : MS_PER_DAY;
  // A forced granularity replaces the automatic choice's own preferences.
  // A callback's text is the caller's, and its length decides how many
  // labels fit, so only geometry and calendar placement are checked.
  const forced = forcedLabels(axisCase, dataStep);
  const callback = axisCase.formatXTick !== undefined;
  const automatic = forced === null;

  const plotWidth = layout.plot.width;
  if (
    automatic &&
    present.length >= 2 &&
    plotWidth >= TWO_LABEL_MIN_WIDTH &&
    labels.length < 2
  ) {
    problems.push(
      `only ${labels.length} label on a ${Math.round(plotWidth)}px plot`,
    );
  }
  labels.forEach((label, i) => {
    if (label.left < -0.5 || label.left + label.width > plotWidth + 0.5) {
      problems.push(
        `"${label.text}" spans ${label.left.toFixed(0)}-${(
          label.left + label.width
        ).toFixed(0)}, plot is 0-${plotWidth.toFixed(0)}`,
      );
    }
    const previous = labels[i - 1];
    if (
      previous &&
      label.left - (previous.left + previous.width) <
        tokens.axis.labelMinGap - 0.5
    ) {
      problems.push(
        `"${previous.text}" and "${label.text}" are ${(
          label.left -
          previous.left -
          previous.width
        ).toFixed(0)}px apart`,
      );
    }
  });

  const allWalls = present
    .map((x) => wallOf(x, spec.timeZone))
    .filter((w): w is Wall => w !== null);
  const dates = labels.map((_, i) => labelDate(i, result) ?? '');
  const walls = dates.map((x) => wallOf(x, spec.timeZone));
  if (walls.some((w) => w === null))
    return [...problems, 'label on a slot without a date'];
  const known = walls.filter((w): w is Wall => w !== null);

  labels.forEach((label, i) => {
    const x = dates[i] ?? '';
    if (callback) return;
    const texts =
      forced === null
        ? acceptableTexts(x, spec.locale, spec.timeZone)
        : forcedTexts(forced, x, spec.locale, spec.timeZone);
    if (!texts.has(label.text)) {
      problems.push(
        forced === null
          ? `"${label.text}" does not name ${x} in ${spec.timeZone}`
          : `"${label.text}" is not a ${forced} label for ${x}`,
      );
    }
  });

  const gaps = known
    .slice(1)
    .map((w, i) => wallTime(w) - wallTime(known[i] ?? w));
  const monthGaps = known
    .slice(1)
    .map((w, i) => monthNumber(w) - monthNumber(known[i] ?? w));
  // Dates forced every few weeks are not month starts.
  const byMonth =
    forced !== 'day' &&
    gaps.length > 0 &&
    gaps.every((g) => g >= 28 * MS_PER_DAY);
  known.forEach((w, i) => {
    const text = labels[i]?.text ?? '';
    if (byMonth) {
      if (w.day !== 1) problems.push(`"${text}" is not a month start`);
      const months = monthGaps[0] ?? 1;
      if (
        months >= 3 &&
        months % 3 === 0 &&
        (w.month - 1) % Math.min(months, 12) !== 0 &&
        w.day === 1
      ) {
        problems.push(`"${text}" is not a ${months}-month boundary`);
      }
    } else if (dataStep < MS_PER_DAY) {
      if (w.minute % 15 !== 0)
        problems.push(`"${text}" is not on a quarter hour`);
      const hours = median(gaps) / MS_PER_HOUR;
      if (
        hours >= 1 &&
        hours < 24 &&
        (w.hour % hours !== 0 || w.minute !== 0)
      ) {
        problems.push(
          `"${text}" (${w.hour}:${String(w.minute).padStart(
            2,
            '0',
          )}) is not on a ${hours}-hour boundary`,
        );
      }
      if (hours >= 24 && (w.hour !== 0 || w.minute !== 0))
        problems.push(`"${text}" is not at midnight`);
    }
  });
  // A text may repeat only when a coarser label in between tells the two
  // apart: a time of day with the date named in between ("Nov 26, 12 PM,
  // Nov 27, 12 PM"), or a month with the year in between ("2025, Jul, 2026,
  // Jul"). Midnight is never repeated as a time; it shows the date.
  const sameDay = (a: Wall | undefined, b: Wall | undefined): boolean =>
    a?.year === b?.year && a?.month === b?.month && a?.day === b?.day;
  labels.forEach((label, j) => {
    const i = labels.findIndex((other) => other.text === label.text);
    if (i === j) return;
    const between = labels.slice(i + 1, j);
    const told =
      dataStep < MS_PER_DAY
        ? between.some((_, k) => !sameDay(known[i + 1 + k], known[i])) &&
          !(known[j]?.hour === 0 && known[j]?.minute === 0)
        : between.some((other, k) =>
            other.text.includes(String(known[i + 1 + k]?.year)),
          );
    if (sameDay(known[i], known[j]) || !told) {
      problems.push(`"${label.text}" repeated`);
    }
  });
  // Ranges covering two or more month starts are labelled by month at every
  // width, so the unit does not change on resize.
  const firstWall = allWalls[0];
  const lastWall = allWalls[allWalls.length - 1];
  const monthStarts =
    firstWall && lastWall
      ? monthNumber(lastWall) -
        monthNumber(firstWall) +
        (firstWall.day === 1 ? 1 : 0)
      : 0;
  if (
    automatic &&
    !callback &&
    monthStarts >= 2 &&
    !known.every((w) => w.day === 1 && w.hour === 0)
  ) {
    problems.push(
      `${monthStarts} month starts in range but labels are not month starts`,
    );
  }
  // About a year of data on a plot this wide gets at least quarters: with
  // only Jan and Jul a reader cannot place a mid-year value.
  if (
    automatic &&
    !callback &&
    monthStarts >= YEAR_MONTH_STARTS.min &&
    monthStarts <= YEAR_MONTH_STARTS.max &&
    plotWidth >= QUARTERS_MIN_PLOT_WIDTH &&
    labels.length < QUARTER_LABELS
  ) {
    problems.push(
      `${labels.length} labels for a year on a ${Math.round(plotWidth)}px plot`,
    );
  }
  // On a narrow plot the axis may pair the first point with the year
  // boundary ("Dec 15", "2027"): it marks the year change, which matters
  // most at that width, so the uneven pair is allowed.
  const firstPoint = parseIsoDate(present[0] ?? '')?.time;
  const startPair =
    labels.length === 2 &&
    labels[0]?.time === firstPoint &&
    known[1]?.month === 1 &&
    known[1]?.day === 1 &&
    known[1]?.hour === 0;
  if (automatic && !byMonth && !startPair && dataStep >= MS_PER_DAY) {
    const days = [...new Set(gaps.map((g) => Math.round(g / MS_PER_DAY)))];
    if (days.some((d) => !DAY_STEPS.includes(d)))
      problems.push(`labels every ${days.join('/')} days`);
  }
  // Monthly or coarser data has no meaningful day: "Jan" or "2026", not "Jan 1".
  if (automatic && !callback && dataStep >= 28 * MS_PER_DAY) {
    labels.forEach((label, i) => {
      const x = dates[i] ?? '';
      if (!monthOrYearTexts(x, spec.locale, spec.timeZone).has(label.text)) {
        problems.push(`"${label.text}" names a day on monthly data`);
      }
    });
  }
  // Sub-daily labels are spaced in elapsed time; a DST change may move one
  // gap by an hour, since wall-clock boundaries are what labels sit on.
  const elapsed = dates
    .slice(1)
    .map(
      (x, i) =>
        (parseIsoDate(x)?.time ?? 0) -
        (parseIsoDate(dates[i] ?? '')?.time ?? 0),
    );
  const subDaily = !byMonth && dataStep < MS_PER_DAY;
  let steps = gaps;
  if (byMonth) steps = monthGaps;
  else if (subDaily) steps = elapsed;
  const usual = median(steps);
  const allowed = subDaily ? MS_PER_HOUR : 0;
  if (steps.some((s) => Math.abs(s - usual) > allowed)) {
    const shown = byMonth ? steps : steps.map((s) => `${s / MS_PER_HOUR}h`);
    problems.push(`irregular spacing ${JSON.stringify(shown)}`);
  }

  // The year: absent within one year; present at some label when the range
  // crosses years. Forced granularities and callbacks decide their own text.
  if (!automatic || callback) return problems;
  const years = new Set(allWalls.map((w) => w.year));
  const withYear = labels.filter((l, i) =>
    l.text.includes(String(known[i]?.year)),
  );
  if (years.size === 1 && withYear.length > 0)
    problems.push('year shown within a single year');
  if (years.size > 1 && withYear.length === 0)
    problems.push('range crosses years but no label shows a year');
  const labelYears = known.map((w) => w.year);
  const crowdedYear = [...new Set(labelYears)].some(
    (y) => labelYears.filter((v) => v === y).length >= 3,
  );
  if (crowdedYear && withYear.length === labels.length)
    problems.push('year on every label');
  return problems;
}

const stillOpen = new Set<string>();

type LaidOutCase = {axisCase: AxisCase; result: AxisResult};

function check(
  cases: readonly AxisCase[],
  rule: (c: AxisCase, r: AxisResult) => string[],
  labelsOf: (r: AxisResult) => string[],
  acrossCases: (laid: readonly LaidOutCase[]) => Map<string, string[]> = () =>
    new Map(),
): void {
  const laid: LaidOutCase[] = [];
  const crashes = new Map<string, string>();
  for (const axisCase of cases) {
    try {
      laid.push({axisCase, result: laidOut(axisCase)});
    } catch (error) {
      // A crash is a finding too; keep checking the rest of the corpus.
      crashes.set(axisCase.name, `throws ${String(error)}`);
    }
  }
  const across = acrossCases(laid);
  const violations: Violation[] = [];
  const record = (name: string, problems: string[], labels: string[]): void => {
    const open = problems.filter((problem) => {
      const known = KNOWN_OPEN.find(
        (entry) =>
          entry.matches.test(problem) &&
          (entry.cases === undefined || entry.cases.test(name)),
      );
      if (known) stillOpen.add(known.name);
      return !known;
    });
    if (open.length > 0)
      violations.push({name, problem: open.join('; '), labels});
  };
  crashes.forEach((problem, name) => record(name, [problem], []));
  for (const {axisCase, result} of laid) {
    record(
      axisCase.name,
      [...rule(axisCase, result), ...(across.get(axisCase.name) ?? [])],
      labelsOf(result),
    );
  }
  expectNoViolations(violations, cases.length);
}

/**
 * The same chart must not lose x labels as its plot widens: a wider plot
 * fits at least what a narrower one did.
 */
function labelsNeverThinOnWiderPlots(
  laid: readonly LaidOutCase[],
): Map<string, string[]> {
  const groups = new Map<string, LaidOutCase[]>();
  for (const entry of laid) {
    const chart = entry.axisCase.name.replace(/ [|] w\d+$/u, '');
    groups.set(chart, [...(groups.get(chart) ?? []), entry]);
  }
  const problems = new Map<string, string[]>();
  groups.forEach((entries) => {
    const byWidth = [...entries].sort(
      (a, b) => a.axisCase.width - b.axisCase.width,
    );
    byWidth.forEach((entry, i) => {
      const narrower = byWidth
        .slice(0, i)
        .find(
          (other) =>
            other.result.layout.xLabels.length >
            entry.result.layout.xLabels.length,
        );
      if (narrower) {
        problems.set(entry.axisCase.name, [
          `${entry.result.layout.xLabels.length} labels at w${entry.axisCase.width}, but ${narrower.result.layout.xLabels.length} at w${narrower.axisCase.width}`,
        ]);
      }
    });
  });
  return problems;
}

describe('axis labels across the corpus', () => {
  KNOWN_OPEN.forEach(({name}) => it.todo(`fix: ${name}`));

  it('y ticks are exact, round, evenly spaced, 3 to 6, and cover the data', () => {
    check(yAxisCases(), yViolations, (r) =>
      r.layout.yLabels.map((l) => l.label),
    );
  });

  it('x labels fit, sit on calendar boundaries in the spec zone, and suit the span', () => {
    check(
      xAxisCases(),
      xViolations,
      (r) => r.layout.xLabels.map((l) => l.text),
      labelsNeverThinOnWiderPlots,
    );
  });

  it('labels amounts given in minor units exactly as the same amounts in major units', () => {
    // Stripe API amounts come in the currency's smallest unit: 41200025
    // cents is $412,000.25 and must give the same axis. Both sides use the
    // same whole-cent amounts.
    const inUnit = (c: AxisCase, unit: 'major' | 'minor'): AxisCase => ({
      ...c,
      spec: {
        ...c.spec,
        format: {style: 'currency', currency: 'usd', unit},
        series: (c.spec.series ?? []).map((s) => ({
          ...s,
          data: s.data.map((p) => {
            if (p.y === null) return p;
            const cents = Math.round(p.y * CENTS_PER_DOLLAR);
            return {
              ...p,
              y: unit === 'minor' ? cents : cents / CENTS_PER_DOLLAR,
            };
          }),
        })),
      },
    });
    const labelsOf = (c: AxisCase): string[] =>
      laidOut(c).layout.yLabels.map((l) => l.label);
    const usd = yAxisCases().filter((c) => c.name.includes('| usd |'));
    const differing = usd.flatMap((c) => {
      const major = labelsOf(inUnit(c, 'major'));
      const minor = labelsOf(inUnit(c, 'minor'));
      return JSON.stringify(major) === JSON.stringify(minor)
        ? []
        : [
            `${c.name}: major ${JSON.stringify(major)}, minor ${JSON.stringify(
              minor,
            )}`,
          ];
    });
    expect(usd.length).toBeGreaterThan(0);
    expect(differing).toEqual([]);
  });

  it('forced x labels keep their granularity, fit, and sit on calendar boundaries', () => {
    check(
      forcedLabelCases(),
      xViolations,
      (r) => r.layout.xLabels.map((l) => l.text),
      labelsNeverThinOnWiderPlots,
    );
  });

  it('measures callback labels, so long ones never collide or leave the chart', () => {
    const cases = callbackCases();
    check(
      cases.filter((c) => c.name.startsWith('x ')),
      (c, r) => [...xViolations(c, r), ...yViolations(c, r)],
      (r) => r.layout.xLabels.map((l) => l.text),
    );
    check(
      cases.filter((c) => c.name.startsWith('y ')),
      yViolations,
      (r) => r.layout.yLabels.map((l) => l.label),
    );
  });

  it('keeps y labels unique and exact in standard notation and with a decimal cap', () => {
    check(yOptionCases(), yViolations, (r) =>
      r.layout.yLabels.map((l) => l.label),
    );
  });

  it('reads like the reference charts for the same data', () => {
    const read = REFERENCE_CASES.map((c) => {
      const {layout} = laidOut(c);
      return {
        name: c.name,
        y: layout.yLabels.map((l) => l.label),
        ...(c.xLabels ? {x: layout.xLabels.map((l) => l.text)} : {}),
      };
    });
    const expected = REFERENCE_CASES.map((c) => ({
      name: c.name,
      y: c.yLabels,
      ...(c.xLabels ? {x: c.xLabels} : {}),
    }));
    expect(read).toEqual(expected);
  });

  // Runs after the checks above, so the list can only shrink: an entry that
  // no longer matches anything has been fixed and must be removed.
  it('lists only problems that still occur as known open', () => {
    const fixed = KNOWN_OPEN.map(({name}) => name).filter(
      (name) => !stillOpen.has(name),
    );
    expect(fixed).toEqual([]);
  });
});
