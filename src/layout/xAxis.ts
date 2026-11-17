// Chooses and places the x axis's labels: labels sit on calendar boundaries in
// the display zone, never collide, and stay inside the plot.

import {zonedParts} from './calendar';
import type {
  ForcedGranularity,
  TickCandidate,
  TickLabelKind,
  TimeUnit,
  XTick,
} from './timeTicks';
import {
  APPROX_UNIT_MS,
  FORCED_TICK_CANDIDATES,
  MAX_BOUNDARIES,
  MONTHLY_RESOLUTION,
  MS_PER_DAY,
  TICK_CANDIDATES,
  labelKinds,
  medianInterval,
  stepBoundaries,
  unitBoundaries,
} from './timeTicks';

export type {
  ForcedGranularity,
  TickLabelKind,
  TimeUnit,
  XTick,
} from './timeTicks';

/**
 * Which labels the x axis shows: `"auto"` chooses the unit from the data's
 * span, spacing and the plot width; the others force a granularity, still
 * thinned to fit.
 */
export type XLabelGranularity = 'auto' | ForcedGranularity;

/** Keys of {@link XAxisInput.gaps}. */
export type LabelGapKey = TimeUnit | 'monthlyMonth';

/** One placed x label. */
export type XLabel = {
  /** The instant the label marks. */
  time: number;
  text: string;
  /** Where the tick mark goes. */
  tickX: number;
  /** Left edge of the label text, kept inside the plot. */
  left: number;
  width: number;
};

/** Everything {@link layoutXAxis} needs. */
export type XAxisInput = {
  /** Each slot's instant (from the primary series), or null when it has none. */
  times: readonly (number | null)[];
  /** Zone the boundaries are found in: the display zone, or UTC for calendar days. */
  timeZone: string;
  /** Centre of a slot. */
  center: (index: number) => number;
  plotWidth: number;
  /** Rendered width of a label. */
  measure: (text: string) => number;
  /** The label text for a tick. */
  formatTick: (tick: XTick) => string;
  /** Least horizontal space between two labels. */
  minGap: number;
  /**
   * Preferred space between neighbouring labels, by unit; `monthlyMonth` is
   * for month ticks on monthly data, whose short labels ("Jan") can sit
   * closer than month starts on daily data ("Aug 1").
   */
  gaps: Readonly<Record<LabelGapKey, number>>;
  /**
   * Granularity to force; defaults to `"auto"`. Times of day on daily data,
   * or dates on monthly data, cannot be shown and fall back to `"auto"`.
   */
  labels?: XLabelGranularity;
};

// No gap preference may leave fewer than two labels on a wide enough plot,
// so neighbouring labels never need to be more than half the plot apart.
const MAX_SPACING_SHARE = 1 / 2;

type Timed = {x: number; time: number};

/**
 * Where an instant falls on the axis, interpolated between the slots on
 * either side, or null outside the data. This puts "Sep 1" on the 1st of
 * September even when the data is weekly and has no point that day.
 */
function positionOf(time: number, timed: readonly Timed[]): number | null {
  for (let i = 0; i < timed.length; i += 1) {
    const current = timed[i];
    if (time === current.time) return current.x;
    const next = timed[i + 1];
    if (next && time > current.time && time < next.time) {
      const share = (time - current.time) / (next.time - current.time);
      return current.x + share * (next.x - current.x);
    }
  }
  return null;
}

/** Positions and measures labels for ticks inside the data's range. */
function place(
  ticks: readonly XTick[],
  timed: readonly Timed[],
  input: XAxisInput,
): XLabel[] {
  return ticks.flatMap((tick) => {
    const x = positionOf(tick.time, timed);
    if (x === null) return [];
    const text = input.formatTick(tick);
    const width = input.measure(text);
    // Centred on the tick, but shifted inward at the ends so the first and
    // last labels stay inside the plot.
    const left = Math.max(0, Math.min(x - width / 2, input.plotWidth - width));
    return [{time: tick.time, text, tickX: x, left, width}];
  });
}

/**
 * True when every pair of neighbouring labels has at least `gap` between
 * them (capped so two labels half the plot apart always fit) and never less
 * than `minGap`.
 */
function fits(
  labels: readonly XLabel[],
  gap: number,
  input: XAxisInput,
): boolean {
  return labels.every((label, i) => {
    const previous = labels[i - 1];
    if (!previous) return true;
    const halfPlot =
      input.plotWidth * MAX_SPACING_SHARE - (previous.width + label.width) / 2;
    const needed = Math.max(input.minGap, Math.min(gap, halfPlot));
    return label.left - (previous.left + previous.width) >= needed;
  });
}

const MONTH_UNITS: ReadonlySet<TimeUnit> = new Set(['month', 'year']);
const MONTHLY_SKIPPED_STEP = 2;
// From this many month starts in range, month ticks drop the day ("Jan"
// instead of "Jan 1"). Shorter ranges, like a quarter, keep "Aug 1".
const MONTH_ONLY_FROM_STARTS = 6;
// A set of ticks needs two labels to show a step.
const MIN_LABELS = 2;
// Calendar units vary in length (months 28-31 days, years 365-366), so a
// unit counts as matching the data when within this share of its spacing.
const RESOLUTION_TOLERANCE = 0.9;

// The label kind of a forced axis's single label when no boundary of its
// unit falls in the range (a short range forced to years shows "2026").
const FORCED_LONE_KIND: Record<ForcedGranularity, TickLabelKind> = {
  time: 'time',
  day: 'date',
  month: 'month',
  year: 'year',
};

/**
 * The x labels, in order of preference:
 *
 * 1. the finest unit and step whose labels keep the unit's preferred gap
 *    (measured widths plus `gaps[unit]`);
 * 2. the coarsest that merely does not collide (so a wider plot never
 *    shows fewer labels than a narrower one);
 * 3. the first point and the month starts after it (a short range crossing
 *    a month or year);
 * 4. the year boundary alone, when the range crosses a year;
 * 5. the first point alone, dated with its year if the range crosses one.
 *
 * Units finer than the data's point spacing are skipped (no hour ticks on
 * daily data), and a range covering two or more month starts is labelled by
 * month or year only, so the unit does not change as the chart is resized.
 */
export function layoutXAxis(input: XAxisInput): XLabel[] {
  const timed = input.times.flatMap((time, index) =>
    time === null ? [] : [{x: input.center(index), time}],
  );
  const first = timed[0];
  const last = timed[timed.length - 1];
  if (!first || !last) return [];
  const ascending = timed.every(
    (point, i) => i === 0 || point.time > timed[i - 1].time,
  );
  const resolution = medianInterval(timed.map((point) => point.time));
  const span = last.time - first.time;
  const intraday = span < MS_PER_DAY && resolution < MS_PER_DAY;
  const crossesYears =
    zonedParts(first.time, input.timeZone).year !==
    zonedParts(last.time, input.timeZone).year;
  const dateKind: TickLabelKind = crossesYears ? 'dateYear' : 'date';
  const loneKind: TickLabelKind = intraday ? 'time' : dateKind;
  const fallback = (): XLabel[] =>
    place([{time: first.time, kind: loneKind}], timed, input);
  if (!ascending || span <= 0) return fallback();

  const cache = new Map<TimeUnit, number[]>();
  const boundariesOf = (unit: TimeUnit): number[] => {
    let all = cache.get(unit);
    if (!all) {
      all = unitBoundaries(unit, first.time, last.time, input.timeZone);
      cache.set(unit, all);
    }
    return all;
  };
  const monthStarts = boundariesOf('month').length;
  const byMonth = monthStarts >= MIN_LABELS;
  const monthlyData = resolution >= MONTHLY_RESOLUTION;
  const coarseEnough = ({unit, step}: TickCandidate): boolean =>
    APPROX_UNIT_MS[unit] * step >= resolution * RESOLUTION_TOLERANCE &&
    span / APPROX_UNIT_MS[unit] <= MAX_BOUNDARIES;
  const forced = forcedGranularity(input.labels, resolution);
  // Month ticks name only the month ("Jan", "1月") on monthly data, and on
  // ranges long enough that every label is a month start anyway; the day
  // adds nothing there and the shorter labels fit in every locale. A forced
  // granularity decides instead: months without the day, days with it.
  const monthOnly =
    forced === null
      ? monthlyData || monthStarts >= MONTH_ONLY_FROM_STARTS
      : forced === 'month';
  const kindOptions = {monthOnly, keepMonths: forced === 'month'};
  const candidates =
    forced === null
      ? TICK_CANDIDATES.filter(
          (candidate) =>
            coarseEnough(candidate) &&
            (!byMonth || MONTH_UNITS.has(candidate.unit)) &&
            // Monthly data steps by month, quarter or half year: two-month
            // labels would mix quarter starts with other months.
            !(
              monthlyData &&
              candidate.unit === 'month' &&
              candidate.step === MONTHLY_SKIPPED_STEP
            ),
        )
      : FORCED_TICK_CANDIDATES[forced].filter(coarseEnough);
  const gapFor = (unit: TimeUnit): number =>
    input.gaps[monthlyData && unit === 'month' ? 'monthlyMonth' : unit];
  const built = new Map<TickCandidate, XLabel[] | null>();
  const labelsFor = (candidate: TickCandidate): XLabel[] | null => {
    if (built.has(candidate)) return built.get(candidate) ?? null;
    const times = stepBoundaries(
      candidate,
      boundariesOf(candidate.unit),
      input.timeZone,
    );
    const labels =
      times.length < MIN_LABELS
        ? null
        : place(
            labelKinds(candidate.unit, times, input.timeZone, kindOptions),
            timed,
            input,
          );
    built.set(candidate, labels);
    return labels;
  };
  const firstFitting = (gapOf: (unit: TimeUnit) => number): XLabel[] | null => {
    for (const candidate of candidates) {
      const labels = labelsFor(candidate);
      if (labels && fits(labels, gapOf(candidate.unit), input)) return labels;
    }
    return null;
  };
  // When no set keeps its preferred gap, the coarsest set that does not
  // collide, not the finest: at a wider width the preferred gap is met by
  // some set at least that coarse, so a wider plot never shows fewer labels.
  const coarsestFitting = (): XLabel[] | null => {
    for (const candidate of [...candidates].reverse()) {
      const labels = labelsFor(candidate);
      if (labels && fits(labels, 0, input)) return labels;
    }
    return null;
  };
  // Last resort before a single label: the first point and the month
  // starts after it, which still mark a month or year change on a range too
  // short for whole-unit steps to fit. A Jan 1 tick names its year ("Dec 15",
  // "2027"); without one, the first label carries the year if it changes.
  const anchored = (): XLabel[] | null => {
    const starts = boundariesOf('month').filter((time) => time > first.time);
    if (starts.length === 0) return null;
    const isNewYear = (time: number): boolean => {
      const {month, day} = zonedParts(time, input.timeZone);
      return month === 0 && day === 1;
    };
    const firstKind: TickLabelKind =
      crossesYears && !starts.some(isNewYear) ? 'dateYear' : 'date';
    const ticks: XTick[] = [
      {time: first.time, kind: firstKind},
      ...starts.map(
        (time): XTick => ({time, kind: isNewYear(time) ? 'year' : 'date'}),
      ),
    ];
    const labels = place(ticks, timed, input);
    return fits(labels, 0, input) ? labels : null;
  };
  // One label: across a year it must still say which year, so the year
  // boundary itself ("2027") is preferred to a dated first point.
  const newYearOnly = (): XLabel[] | null => {
    if (!crossesYears) return null;
    const newYear = boundariesOf('year').find((time) => time > first.time);
    return newYear === undefined
      ? null
      : place([{time: newYear, kind: 'year'}], timed, input);
  };
  if (forced !== null) {
    // A forced axis keeps its granularity even when no set fits: one label,
    // on the first boundary of its finest usable unit in range, or else on
    // the first point.
    const unit = candidates[0]?.unit;
    const boundary = unit === undefined ? undefined : boundariesOf(unit)[0];
    const lone = (): XLabel[] =>
      place(
        unit === undefined || boundary === undefined
          ? [{time: first.time, kind: FORCED_LONE_KIND[forced]}]
          : labelKinds(unit, [boundary], input.timeZone, kindOptions),
        timed,
        input,
      );
    return firstFitting(gapFor) ?? coarsestFitting() ?? lone();
  }
  return (
    firstFitting(gapFor) ??
    coarsestFitting() ??
    anchored() ??
    newYearOnly() ??
    fallback()
  );
}

/**
 * The granularity to force, or null for the automatic choice: `"auto"`,
 * nothing given, or a granularity that cannot label the data: times of day
 * need sub-daily data, and dates need data finer than monthly. Months and
 * years can label any data (one month a year at most).
 */
function forcedGranularity(
  labels: XLabelGranularity | undefined,
  resolution: number,
): ForcedGranularity | null {
  if (labels === undefined || labels === 'auto') return null;
  if (labels === 'time' && resolution >= MS_PER_DAY) return null;
  if (labels === 'day' && resolution >= MONTHLY_RESOLUTION) return null;
  return labels;
}
