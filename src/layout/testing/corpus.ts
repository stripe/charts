// A corpus of realistic chart specs for checking axis labels: many time
// spans, value ranges, formats, locales, time zones and sizes. Used by the
// axis property test and the axes gallery story, never by the library.

import {resolveSpec} from '../../defaults';
import {formatTicks} from '../../format';
import {buildModel} from '../../model';
import type {ChartModel} from '../../model';
import type {
  AxesOptions,
  ChartSpec,
  DataPoint,
  Series,
  ValueFormat,
  XAxisLabels,
  YAxisOptions,
} from '../../spec';
import {tokens} from '../../tokens';
import {layoutPlot} from '../plot';
import type {PlotLayout} from '../plot';
import {tickFormatter, tickX, xAxisData} from '../axisData';

/** How far apart a span's points are. */
export type StepUnit = 'minute' | 'hour' | 'day' | 'month';

/** A run of evenly stepped points, described in wall-clock terms. */
export type TimeSpan = {
  name: string;
  /** Wall-clock start in the spec's zone, `"YYYY-MM-DD"` or `"YYYY-MM-DDTHH:MM"`. */
  start: string;
  count: number;
  unit: StepUnit;
  /** Units per step: 15 minutes, 7 days, 3 months... */
  step: number;
  /** Only generate this span in these zones (DST transition days). */
  zones?: readonly string[];
};

/** The value formats the corpus uses, by short name. */
export type FormatName = 'number' | 'usd' | 'jpy' | 'percent';

/** A set of y values, one per slot; null is a gap. */
export type ValueSet = {
  name: string;
  values: readonly (number | null)[];
  /** Formats this kind of value is realistically shown in. */
  formats: readonly FormatName[];
  /** The comparison series as a share of the values; defaults to 0.8. */
  comparisonShare?: number;
};

/** One chart to lay out at one size. */
export type AxisCase = {
  /** Human-readable, unique: names every dimension that produced the case. */
  name: string;
  spec: ChartSpec;
  /** Plot area size (plot plus axes), in CSS pixels. */
  width: number;
  height: number;
  /** Replaces an x label, given the tick's x value and the default label. */
  formatXTick?: (x: string, defaultLabel: string) => string;
  /** Replaces a y label, given the tick value and the default label. */
  formatYTick?: (value: number, defaultLabel: string) => string;
};

/** A laid-out case: what the axes would draw. */
export type AxisResult = {
  model: ChartModel;
  layout: PlotLayout;
  /** The primary series' x for each slot, or null. */
  slotX: (string | null)[];
  /** True when the primary series is calendar dates, not instants. */
  calendarDays: boolean;
};

export const FORMATS: Record<FormatName, ValueFormat> = {
  number: {style: 'number'},
  usd: {style: 'currency', currency: 'usd', unit: 'major'},
  jpy: {style: 'currency', currency: 'jpy', unit: 'major'},
  percent: {style: 'percent', unit: 'ratio'},
};

export const LOCALES: readonly string[] = ['en-US', 'de-DE', 'ja-JP'];
export const ZONES: readonly string[] = [
  'UTC',
  'America/Los_Angeles',
  'Asia/Kolkata',
];
export const WIDTHS: readonly number[] = [280, 360, 540, 800, 1200, 1600];
/** Plot area heights: a dashboard tile, a small grid cell, the default, a tall chart. */
export const HEIGHTS: readonly number[] = [100, 140, 240, 460];

export const SPANS: readonly TimeSpan[] = [
  {
    name: '3 hours, 15-minute',
    start: '2026-11-27T09:00',
    count: 13,
    unit: 'minute',
    step: 15,
  },
  {
    name: '1 day hourly',
    start: '2026-11-27T00:00',
    count: 24,
    unit: 'hour',
    step: 1,
  },
  {
    name: 'BFCM 5 days hourly',
    start: '2026-11-26T00:00',
    count: 120,
    unit: 'hour',
    step: 1,
  },
  {
    name: 'BFCM 4 days daily',
    start: '2026-11-27',
    count: 4,
    unit: 'day',
    step: 1,
  },
  {
    name: 'BFCM 5 days daily',
    start: '2026-11-26',
    count: 5,
    unit: 'day',
    step: 1,
  },
  {name: '2 weeks daily', start: '2026-11-16', count: 14, unit: 'day', step: 1},
  {name: '30 days daily', start: '2026-10-15', count: 30, unit: 'day', step: 1},
  {name: '90 days daily', start: '2026-08-01', count: 90, unit: 'day', step: 1},
  {name: '1 year daily', start: '2025-01-01', count: 365, unit: 'day', step: 1},
  {
    name: '13 weeks weekly',
    start: '2026-08-03',
    count: 13,
    unit: 'day',
    step: 7,
  },
  {
    name: '12 months monthly',
    start: '2026-01-01',
    count: 12,
    unit: 'month',
    step: 1,
  },
  {
    name: '24 months monthly',
    start: '2025-01-01',
    count: 24,
    unit: 'month',
    step: 1,
  },
  {
    name: '5 years quarterly',
    start: '2022-01-01',
    count: 20,
    unit: 'month',
    step: 3,
  },
  {
    name: '5 years yearly',
    start: '2022-01-01',
    count: 5,
    unit: 'month',
    step: 12,
  },
  {
    name: 'across new year daily',
    start: '2026-12-15',
    count: 37,
    unit: 'day',
    step: 1,
  },
  {
    name: 'DST start hourly',
    start: '2026-03-08T00:00',
    count: 24,
    unit: 'hour',
    step: 1,
    zones: ['America/New_York'],
  },
  {
    name: 'DST end hourly',
    start: '2026-11-01T00:00',
    count: 24,
    unit: 'hour',
    step: 1,
    zones: ['America/New_York'],
  },
  {
    name: 'DST start hourly',
    start: '2026-03-29T00:00',
    count: 24,
    unit: 'hour',
    step: 1,
    zones: ['Europe/London'],
  },
  {
    name: 'DST end hourly',
    start: '2026-10-25T00:00',
    count: 24,
    unit: 'hour',
    step: 1,
    zones: ['Europe/London'],
  },
];

// A smooth, deterministic wave between `low` and `high`.
function wave(count: number, low: number, high: number): number[] {
  return Array.from({length: count}, (_, i) => {
    const t = (Math.sin(i * 0.7) + Math.sin(i * 0.23 + 1)) / 4 + 0.5;
    return low + (high - low) * t;
  });
}

const POINTS = 30;
// Last year's series, as a share of this year's.
const COMPARISON_SHARE = 0.8;
const MONEY: readonly FormatName[] = ['number', 'usd', 'jpy'];
const ALL: readonly FormatName[] = ['number', 'usd', 'jpy', 'percent'];

export const VALUE_SETS: readonly ValueSet[] = [
  {
    name: 'tiny',
    values: wave(POINTS, 0.0012, 0.0034),
    formats: ['number', 'usd', 'percent'],
  },
  {
    name: 'ratio',
    values: wave(POINTS, 0.12, 0.19),
    formats: ['number', 'percent'],
  },
  // Recurring revenue that barely moves; last year's is about the same.
  {
    name: 'near-flat large',
    values: wave(POINTS, 1_111_350, 1_111_770),
    formats: MONEY,
    comparisonShare: 0.9998,
  },
  {
    name: 'BFCM volume',
    values: wave(POINTS, 240_000, 412_000.25),
    formats: MONEY,
  },
  {
    name: 'small counts',
    values: wave(POINTS, 3, 17).map(Math.round),
    formats: ['number'],
  },
  {
    name: 'all zero',
    values: Array.from({length: POINTS}, () => 0),
    formats: ALL,
  },
  {name: 'negative', values: wave(POINTS, -5200, -800), formats: MONEY},
  {name: 'mixed sign', values: wave(POINTS, -3400, 5600), formats: MONEY},
  {
    name: 'mixed sign ratio',
    values: wave(POINTS, -0.04, 0.09),
    formats: ['percent'],
  },
  {name: 'huge', values: wave(POINTS, 0.8e12, 1.3e12), formats: MONEY},
  {name: 'single point', values: [412_000.25], formats: MONEY},
  // A metric that roughly doubles over the range, as in a details view.
  {
    name: 'rising volume',
    values: Array.from({length: POINTS}, (_, i) => 250_000 + i * 7_100),
    formats: MONEY,
    comparisonShare: 1,
  },
  {
    name: 'gaps',
    values: wave(POINTS, 200, 900).map((v, i) =>
      i === 0 || i % 7 === 3 ? null : v,
    ),
    formats: MONEY,
  },
];

/** Several series drawn as one stacked bar per slot. */
export type StackedSet = {
  name: string;
  series: readonly (readonly number[])[];
  formats: readonly FormatName[];
};

export const STACKED_SETS: readonly StackedSet[] = [
  // Sales stacked over refunds.
  {
    name: 'stacked mixed sign',
    series: [wave(POINTS, 20_000, 90_000), wave(POINTS, -60_000, -10_000)],
    formats: ['number', 'usd', 'jpy'],
  },
  {
    name: 'stacked all negative',
    series: [wave(POINTS, -30_000, -5_000), wave(POINTS, -40_000, -10_000)],
    formats: ['number', 'usd', 'jpy'],
  },
  // A small negative stack under a large positive one.
  {
    name: 'stacked negative under large positive',
    series: [
      wave(POINTS, 800_000, 1_200_000),
      wave(POINTS, 100_000, 300_000),
      wave(POINTS, -60_000, -20_000),
    ],
    formats: ['number', 'usd', 'jpy'],
  },
];

const wallFormatters = new Map<string, Intl.DateTimeFormat>();

/** Wall-clock fields of `time` in `zone`. */
export function wallClock(
  time: number,
  zone: string,
): {year: number; month: number; day: number; hour: number; minute: number} {
  let formatter = wallFormatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
    wallFormatters.set(zone, formatter);
  }
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(time)) {
    parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
  };
}

function offsetMinutes(time: number, zone: string): number {
  const wall = wallClock(time, zone);
  const asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
  );
  return Math.round((asUtc - time) / 60_000);
}

/** The instant a wall-clock time (as UTC fields) happens in `zone`. */
function zonedTime(wallAsUtc: number, zone: string): number {
  const guess = wallAsUtc - offsetMinutes(wallAsUtc, zone) * 60_000;
  return wallAsUtc - offsetMinutes(guess, zone) * 60_000;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** `time` as an ISO date-time with the zone's offset, as a warehouse exports it. */
function isoWithOffset(time: number, zone: string): string {
  const wall = wallClock(time, zone);
  const offset = offsetMinutes(time, zone);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(
    wall.hour,
  )}:${pad(wall.minute)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(
    abs % 60,
  )}`;
}

function wallStart(start: string): number {
  return Date.parse(start.length === 10 ? `${start}T00:00Z` : `${start}Z`);
}

/**
 * The x values of a span. Sub-daily spans are instants stepped in absolute
 * time from the zone's wall-clock start (so a DST day has 23 or 25 wall
 * hours). Longer spans step the calendar, as date-only strings or as
 * date-times at local midnight.
 */
export function spanDates(
  span: TimeSpan,
  zone: string,
  form: 'date' | 'dateTime',
): string[] {
  const start = wallStart(span.start);
  return Array.from({length: span.count}, (_, i) => {
    if (span.unit === 'minute' || span.unit === 'hour') {
      const unitMs = span.unit === 'minute' ? 60_000 : 3_600_000;
      return isoWithOffset(
        zonedTime(start, zone) + i * span.step * unitMs,
        zone,
      );
    }
    const date = new Date(start);
    if (span.unit === 'day') date.setUTCDate(date.getUTCDate() + i * span.step);
    else date.setUTCMonth(date.getUTCMonth() + i * span.step);
    const wall = date.getTime();
    return form === 'date'
      ? new Date(wall).toISOString().slice(0, 10)
      : isoWithOffset(zonedTime(wall, zone), zone);
  });
}

function series(
  xs: readonly string[],
  ys: readonly (number | null)[],
  comparison: boolean,
): Series {
  const data: DataPoint[] = xs.map((x, i) => ({x, y: ys[i] ?? null}));
  return comparison
    ? {label: 'Last year', comparison, data}
    : {label: 'This year', data};
}

/**
 * Cases for the x axis: every span in every zone, date form, locale, chart
 * type and width. Values are an ordinary wave; the y axis has its own cases.
 */
export function xAxisCases(): AxisCase[] {
  const cases: AxisCase[] = [];
  for (const span of SPANS) {
    const subDaily = span.unit === 'minute' || span.unit === 'hour';
    const forms: ('date' | 'dateTime')[] = subDaily
      ? ['dateTime']
      : ['date', 'dateTime'];
    for (const zone of span.zones ?? ZONES) {
      for (const form of forms) {
        const xs = spanDates(span, zone, form);
        const ys = wave(xs.length, 1000, 1800);
        for (const locale of LOCALES) {
          for (const type of ['line', 'bar'] as const) {
            for (const width of WIDTHS) {
              cases.push({
                name: `x | ${span.name} | ${form} | ${zone} | ${locale} | ${type} | w${width}`,
                spec: {
                  title: span.name,
                  locale,
                  timeZone: zone,
                  chart: {type},
                  series: [
                    series(xs, ys, false),
                    series(
                      xs,
                      ys.map((y) => y * COMPARISON_SHARE),
                      true,
                    ),
                  ],
                },
                width,
                height: HEIGHTS[2] ?? 240,
              });
            }
          }
        }
      }
    }
  }
  return cases;
}

/**
 * Cases for the y axis: every value set in each of its formats, every
 * locale, chart type and height, with a comparison series at 80%; and the
 * stacked sets as stacked bars.
 */
export function yAxisCases(): AxisCase[] {
  const cases: AxisCase[] = [];
  for (const set of VALUE_SETS) {
    const xs = spanDates(
      {
        name: set.name,
        start: '2026-11-01',
        count: set.values.length,
        unit: 'day',
        step: 1,
      },
      'UTC',
      'date',
    );
    const share = set.comparisonShare ?? COMPARISON_SHARE;
    const comparison = set.values.map((v) => (v === null ? null : v * share));
    for (const formatName of set.formats) {
      for (const locale of LOCALES) {
        for (const type of ['line', 'bar'] as const) {
          for (const height of HEIGHTS) {
            cases.push({
              name: `y | ${set.name} | ${formatName} | ${locale} | ${type} | h${height}`,
              spec: {
                title: set.name,
                format: FORMATS[formatName],
                locale,
                chart: {type},
                series:
                  set.values.length > 1
                    ? [
                        series(xs, set.values, false),
                        series(xs, comparison, true),
                      ]
                    : [series(xs, set.values, false)],
              },
              width: WIDTHS[2] ?? 540,
              height,
            });
          }
        }
      }
    }
  }
  for (const set of STACKED_SETS) {
    const xs = spanDates(
      {
        name: set.name,
        start: '2026-11-01',
        count: POINTS,
        unit: 'day',
        step: 1,
      },
      'UTC',
      'date',
    );
    for (const formatName of set.formats) {
      for (const locale of LOCALES) {
        for (const height of HEIGHTS) {
          cases.push({
            name: `y | ${set.name} | ${formatName} | ${locale} | stacked | h${height}`,
            spec: {
              title: set.name,
              format: FORMATS[formatName],
              locale,
              chart: {type: 'bar', stacking: 'stacked'},
              series: set.series.map((values, i) => ({
                label: `Series ${i + 1}`,
                data: xs.map((x, j) => ({x, y: values[j] ?? null})),
              })),
            },
            width: WIDTHS[2] ?? 540,
            height,
          });
        }
      }
    }
  }
  return cases;
}

/** `spec` with its chart's axis options set. */
function withAxes(spec: ChartSpec, axes: AxesOptions): ChartSpec {
  return {...spec, chart: {type: 'line', ...spec.chart, axes}};
}

const FORCED_LABELS: readonly Exclude<XAxisLabels, 'auto'>[] = [
  'day',
  'month',
  'year',
  'time',
];
const FORCED_WIDTHS: readonly number[] = [280, 540, 1200];

/**
 * X axes forced to each granularity: every span, in UTC and Asia/Kolkata,
 * every locale, line charts, three widths. The x checks and the cross-width
 * check apply; the automatic choice's own preferences (month starts, the
 * day steps) do not.
 */
export function forcedLabelCases(): AxisCase[] {
  return FORCED_LABELS.flatMap((labels) =>
    xAxisCases()
      .filter(
        (c) =>
          c.name.includes('| line |') &&
          FORCED_WIDTHS.some((w) => c.name.endsWith(`| w${w}`)) &&
          !c.name.includes('America/Los_Angeles') &&
          // Times of day need instants; validation rejects them for dates.
          (labels !== 'time' || c.name.includes('| dateTime |')),
      )
      .map((c) => ({
        ...c,
        name: c.name.replace(/^x [|]/u, `x labels=${labels} |`),
        spec: withAxes(c.spec, {x: {labels}}),
      })),
  );
}

/**
 * Callbacks that make labels much longer than the defaults: the layout must
 * measure what they return, so labels still never collide or leave the
 * plot and the y column fits them.
 */
export function callbackCases(): AxisCase[] {
  const longX = (_: string, label: string): string => `Week of ${label}`;
  const longY = (_: number, label: string): string => `${label} per day (est.)`;
  const pick = (cases: AxisCase[]): AxisCase[] =>
    cases.filter(
      (c) => c.name.includes('| en-US |') || c.name.includes('| ja-JP |'),
    );
  return [
    ...pick(xAxisCases())
      .filter((c) => c.name.includes('| UTC |') && c.name.includes('| line |'))
      .map((c) => ({
        ...c,
        name: `${c.name} | long callback labels`,
        formatXTick: longX,
        formatYTick: longY,
      })),
    ...pick(yAxisCases()).map((c) => ({
      ...c,
      name: `${c.name} | long y callback`,
      formatYTick: longY,
    })),
  ];
}

/**
 * Y labels in standard notation and with a decimal cap: they must stay
 * unique and exact, so the cap may not round two ticks to the same label.
 */
export function yOptionCases(): AxisCase[] {
  const options: [string, YAxisOptions][] = [
    ['standard', {notation: 'standard'}],
    ['0 decimals', {maximumFractionDigits: 0}],
    ['1 decimal', {maximumFractionDigits: 1}],
  ];
  const base = yAxisCases().filter(
    (c) =>
      (c.name.includes('| en-US |') || c.name.includes('| de-DE |')) &&
      !c.name.endsWith('| h460'),
  );
  return options.flatMap(([name, y]) =>
    base.map((c) => ({
      ...c,
      name: `${c.name} | y ${name}`,
      spec: withAxes(c.spec, {y}),
    })),
  );
}

/** A case with the axis labels a chart of this shape is expected to show. */
export type ReferenceCase = AxisCase & {yLabels: string[]; xLabels?: string[]};

// The plot area is the plot plus the x axis below it (insets, label row
// and gap); plot heights are converted with this.
const X_AXIS_HEIGHT = 40;
const USD: ValueFormat = {style: 'currency', currency: 'usd', unit: 'major'};

function referenceSeries(
  start: string,
  stepDays: number,
  values: readonly number[],
): Series {
  const xs = spanDates(
    {name: start, start, count: values.length, unit: 'day', step: stepDays},
    'UTC',
    'date',
  );
  return series(xs, values, false);
}

// Nearly flat recurring revenue with a dip and a step up.
const FLAT_DAILY = Array.from({length: 93}, (_, day) => {
  if (day < 29) return 1_111_525;
  if (day < 44) return 1_111_345;
  return day < 83 ? 1_111_771 : 1_111_757;
});

/**
 * Charts with expected axis labels: a near-flat daily line and weekly bars on a 457px plot,
 * and a weekly line and bars in 304px cells with 129px plots.
 */
export const REFERENCE_CASES: readonly ReferenceCase[] = [
  {
    name: 'reference | near-flat daily line',
    spec: {
      title: 'Recurring revenue',
      format: USD,
      series: [referenceSeries('2026-08-01', 1, FLAT_DAILY)],
    },
    width: 640,
    height: 457 + X_AXIS_HEIGHT,
    yLabels: ['$1,111,400', '$1,111,500', '$1,111,600', '$1,111,700'],
    // Month labels are dense enough that a year of daily data gets quarters.
    xLabels: ['Aug 1', 'Sep 1', 'Oct 1', 'Nov 1'],
  },
  {
    name: 'reference | weekly bars near $1.1M',
    spec: {
      title: 'Recurring revenue',
      format: USD,
      chart: {type: 'bar'},
      series: [
        referenceSeries('2026-08-03', 7, wave(14, 1_110_000, 1_112_000)),
      ],
    },
    width: 640,
    height: 457 + X_AXIS_HEIGHT,
    yLabels: ['$0', '$200K', '$400K', '$600K', '$800K', '$1M'],
  },
  {
    name: 'reference | weekly line in a cell',
    spec: {
      title: 'MRR',
      format: USD,
      series: [
        referenceSeries(
          '2026-08-09',
          7,
          Array.from({length: 13}, (_, i) => 240_000 + i * 5_000),
        ),
        {
          ...referenceSeries(
            '2026-07-09',
            7,
            Array.from({length: 13}, (_, i) => 292_000 - i * 4_300),
          ),
          label: 'Last year',
          comparison: true,
        },
      ],
    },
    width: 304,
    height: 129 + X_AXIS_HEIGHT,
    yLabels: ['$240K', '$260K', '$280K', '$300K'],
    xLabels: ['Sep 1', 'Nov 1'],
  },
  {
    name: 'reference | weekly bars in a cell',
    spec: {
      title: 'New ARR',
      format: USD,
      chart: {type: 'bar'},
      series: [
        referenceSeries('2026-08-09', 7, wave(13, 290_000, 298_000)),
        {
          ...referenceSeries('2026-07-09', 7, wave(13, 265_000, 295_000)),
          label: 'Last year',
          comparison: true,
        },
      ],
    },
    width: 304,
    height: 129 + X_AXIS_HEIGHT,
    yLabels: ['$0', '$100K', '$200K', '$300K'],
  },
];

// Advances of the system sans at the axis label size: CJK and full-width
// characters are a full em; everything else is taken at 0.6em, a little
// wider than real digits, so a pass here has room to spare in a browser.
const WIDE_CHARACTER = /[\u3000-\u9fff\uff00-\uffef]/u;
const NARROW_CHARACTER_EM = 0.6;

/** A deterministic label width estimate in CSS pixels. */
export function estimateLabelWidth(text: string): number {
  const {size} = tokens.axis.label;
  return [...text].reduce(
    (sum, character) =>
      sum +
      (WIDE_CHARACTER.test(character) ? size : size * NARROW_CHARACTER_EM),
    0,
  );
}

/**
 * Lays out a case the way the chart does: model, then the plot layout with
 * the chart's own axis inputs and tick formatters.
 */
export function layoutCase(axisCase: AxisCase): AxisResult {
  const spec = resolveSpec(axisCase.spec);
  const model = buildModel(axisCase.spec);
  const axis = xAxisData(model, spec);
  const primary = Math.max(
    0,
    model.series.findIndex((s) => !s.comparison),
  );
  const slotX = model.slots.map((slot) => slot.points[primary]?.x ?? null);
  const defaultXLabel = tickFormatter(axis, spec);
  const {formatXTick, formatYTick} = axisCase;
  // Callbacks run last, on the default label, as the chart applies them.
  const formatXLabel = formatXTick
    ? (tick: Parameters<typeof defaultXLabel>[0]): string =>
        formatXTick(tickX(axis, tick.time), defaultXLabel(tick))
    : defaultXLabel;
  const formatYLabels = (values: readonly number[]): string[] => {
    const labels = formatTicks(values, spec.format, spec.locale, spec.axes.y);
    return formatYTick
      ? values.map((value, i) => formatYTick(value, labels[i] ?? ''))
      : labels;
  };
  const layout = layoutPlot({
    width: axisCase.width,
    height: axisCase.height,
    chartType: spec.chartType === 'bar' ? 'bar' : 'line',
    times: axis.times,
    timeZone: axis.timeZone,
    seriesCount: model.series.length,
    stacked: model.stacked,
    yDomain: model.yDomain,
    yMinStep: model.yMinStep,
    formatYTicks: formatYLabels,
    formatXTick: formatXLabel,
    measure: estimateLabelWidth,
    xAxis: spec.axes.x,
  });
  return {model, layout, slotX, calendarDays: axis.calendarDays};
}
