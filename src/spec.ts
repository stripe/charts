// Spec v1: the declarative JSON accepted by `render` and `validate`. This is
// the part of the package intended to stay stable if the renderer changes.
// Field docs here are the API reference; keep them in sync with `schema.json`
// and `validate.ts`.

import type {RenderOptions} from './options';

/** Plain numbers, for example counts. */
export type NumberFormat = {
  /** Use `"number"` for plain numbers. */
  style: 'number';
  /** Maximum number of decimals to show, 0 to 20. Defaults to 2. */
  maximumFractionDigits?: number;
};

/**
 * How currency values are given: `"minor"` for the currency's smallest unit
 * as the Stripe API reports amounts (1999 means $19.99, ¥1,999 or, for a
 * three-decimal currency like KWD, 1.999 KWD), or `"major"` for values
 * already in major units (19.99 means $19.99).
 */
export type CurrencyUnit = 'minor' | 'major';

/**
 * How percent values are given: `"ratio"` when 0.025 means 2.5%, or
 * `"percent"` when 2.5 means 2.5%.
 */
export type PercentUnit = 'ratio' | 'percent';

/**
 * Money. The currency decides the decimals shown, so JPY shows none;
 * amounts of 1,000 or more are shown in whole units.
 */
export type CurrencyFormat = {
  /** Use `"currency"` for money. */
  style: 'currency';
  /** Three-letter ISO 4217 currency code, any case, for example `"usd"` or `"JPY"`. */
  currency: string;
  /**
   * Required: whether values are in minor units (Stripe API amounts) or
   * major units. See {@link CurrencyUnit}.
   */
  unit: CurrencyUnit;
};

/**
 * Percentages. A KPI change is always relative: 2.07% against 2.01% shows
 * as +3.0%, not +0.06 points.
 */
export type PercentFormat = {
  /** Use `"percent"` for percentages. */
  style: 'percent';
  /** Required: whether 0.025 or 2.5 means 2.5%. See {@link PercentUnit}. */
  unit: PercentUnit;
  /** Maximum number of decimals in the percentage, 0 to 20. Defaults to 1. */
  maximumFractionDigits?: number;
};

/** How values (KPI, axis ticks, tooltip) are formatted. Chosen by `style`. */
export type ValueFormat = NumberFormat | CurrencyFormat | PercentFormat;

/** One point of a series. */
export type DataPoint = {
  /**
   * The point's date: `"YYYY-MM-DD"` for a calendar day (never shifted by
   * time zone), or an ISO 8601 date-time with `Z` or an offset, for example
   * `"2026-11-27T18:00:00Z"`, shown in {@link ChartSpec.timeZone}. Every x
   * in a chart uses the same form, all dates or all date-times, and years
   * start at 1000. The primary series' dates label the x axis and the
   * tooltip header; a comparison point's own date is read out in the
   * accessible summary.
   */
  x: string;
  /**
   * The value, in the units {@link ChartSpec.format} says (minor or major
   * currency units, ratio or percent), or `null` for a gap. A finite number,
   * not a string. For a forecast point, the expected value.
   */
  y: number | null;
  /**
   * Bar charts only: this bar segment's color, overriding the series color.
   * `#rgb` or `#rrggbb` hex. Prefer the default palette; check contrast if
   * you set one.
   */
  color?: string;
  /**
   * `true` for a forecast rather than an actual value. Forecast points must
   * be one run at the end of the series. Lines draw them dashed from the
   * last actual point; bars as outlined, lightly filled bars. Defaults to
   * `false`.
   */
  forecast?: boolean;
  /**
   * Forecast points only: the lower bound of the forecast range, at most
   * `y`. Lines shade the band between `low` and `high`.
   */
  low?: number;
  /** Forecast points only: the upper bound of the forecast range, at least `y`. */
  high?: number;
  /**
   * Incomplete points only (from `chart.incomplete.from` on, in a
   * non-comparison series): where the period is on pace to end, in the same
   * units as `y` and with the same sign. `y` stays the value so far, which
   * `kpi.basis` uses; the chart draws the projection as an extension.
   */
  projected?: number;
};

/** One line or set of bars. */
export type Series = {
  /**
   * Series name shown in the tooltip and the chart's accessible summary, for
   * example `"2026"`. Plain text.
   */
  label: string;
  /**
   * `true` to draw this series in the muted comparison style, for example
   * last year. Defaults to `false`.
   */
  comparison?: boolean;
  /**
   * The series color, `#rgb` or `#rrggbb` hex, used for its marks, legend
   * swatch, tooltip swatch, sparkline and table. Defaults to the palette;
   * prefer it, and check contrast if you set one.
   */
  color?: string;
  /**
   * Up to 1000 points in display order. Index i of this series is drawn in
   * the same x slot as index i of every other series. The x-axis labels and
   * the tooltip header come from the first non-comparison series; tooltip
   * rows show each series' label and value, without dates.
   */
  data: DataPoint[];
};

/**
 * `"line"` for trends, `"bar"` for per-day totals, or `"kpi"` for a headline
 * tile: the KPI value without axes, with a small sparkline of `series` when
 * given.
 */
export type ChartType = 'line' | 'bar' | 'kpi';

/**
 * How bar series share a slot: `"grouped"` draws them side by side;
 * `"stacked"` draws them on top of each other, positive values upward from 0
 * and negative values downward, so the bar shows the total.
 */
export type BarStacking = 'grouped' | 'stacked';

/**
 * When the legend shows: `"auto"` for 3 or more series, or whenever a
 * forecast or projected values need explaining; `"show"` always; `"hide"`
 * never. Legend items toggle their series (click, Enter or Space) and
 * isolate it (double-click or Shift+Enter).
 */
export type LegendMode = 'auto' | 'show' | 'hide';

/**
 * The x-axis label granularity: `"auto"` picks hours, days, weeks, months,
 * quarters or years from the data and width; the others force one, still
 * thinned to fit.
 */
export type XAxisLabels = 'auto' | 'day' | 'month' | 'year' | 'time';

/** How y-axis labels are written: `"compact"` ($300K) or `"standard"` ($300,000). */
export type YAxisNotation = 'compact' | 'standard';

/** X-axis options. */
export type XAxisOptions = {
  /** Label granularity. See {@link XAxisLabels}. Defaults to `"auto"`. */
  labels?: XAxisLabels;
};

/** Y-axis options. */
export type YAxisOptions = {
  /** How labels are written. See {@link YAxisNotation}. Defaults to `"compact"`. */
  notation?: YAxisNotation;
  /** Most decimals in a label, 0 to 20. Defaults to the fewest that keep ticks exact. */
  maximumFractionDigits?: number;
};

/** Axis options. */
export type AxesOptions = {
  x?: XAxisOptions;
  y?: YAxisOptions;
};

/**
 * A trailing period whose data is not final yet, such as today. From `from`
 * to the end, lines are dashed and bars hatched, and the period is marked
 * with `message`.
 */
export type IncompletePeriod = {
  /**
   * The first incomplete slot: an x value of the primary series, exactly as
   * written there. Must come before any forecast points.
   */
  from: string;
  /**
   * Shown for the period. Plain text, up to 200 characters. Defaults to
   * `"Data in this period is still being processed"`.
   */
  message?: string;
};

/** Chart options. */
export type ChartOptions = {
  /** The kind of chart. See {@link ChartType}. */
  type: ChartType;
  /**
   * How bar series share a slot. Only allowed when `type` is `"bar"`.
   * Comparison series cannot be stacked. Defaults to `"grouped"`.
   */
  stacking?: BarStacking;
  /** When the legend shows. See {@link LegendMode}. Defaults to `"auto"`. */
  legend?: LegendMode;
  /** Axis label options. */
  axes?: AxesOptions;
  /** A trailing period whose data is not final yet. */
  incomplete?: IncompletePeriod;
};

/**
 * A note on the chart, shown in the tooltip of the slots it covers, the
 * accessible summary and the details view. Use exactly one of `at` (a
 * marker) or `from`/`to` (a shaded range). x values must be exact x values
 * of the primary series, since series line up by position.
 */
export type Annotation = {
  /** Short label, for example `"Campaign launch"`. Plain text, up to 80 characters. */
  label: string;
  /** Longer note shown in the tooltip and details. Plain text, up to 200 characters. */
  description?: string;
  /**
   * A single slot: a vertical marker there, or with `series` a marker on
   * that series' point, drawn as a hollow circle in the series color.
   */
  at?: string;
  /** Start of a shaded range, marked with a dashed line; omit to extend to the plot edge. */
  from?: string;
  /** End of a shaded range, inclusive, marked with a dashed line; omit to extend to the plot edge. */
  to?: string;
  /** With `at`: the label of the series whose point is marked. */
  series?: string;
};

/**
 * How {@link Kpi.value} relates to the primary series: `"total"` is the sum
 * of its values, `"latest"` its last value, `"average"` their mean, and
 * `"custom"` anything else (a figure computed elsewhere). Forecast points
 * are not actual values, so the first three leave them out; incomplete
 * points count, since they are real data. For those three, the value is
 * checked against the series, and `comparisonValue` against the first
 * comparison series over the same slots (like periods: for `"latest"`, the
 * comparison's value where the primary's latest actual value is, even if a
 * plan runs on past it), within 0.5% or one display unit, whichever is
 * larger.
 */
export type KpiBasis = 'total' | 'latest' | 'average' | 'custom';

/**
 * Which way a change is good: `"up"` (revenue) colours rises as good,
 * `"down"` (churn, dispute or refund rate) colours falls as good.
 */
export type GoodDirection = 'up' | 'down';

/**
 * How the KPI value is written: `"standard"` in full (`$294,470`), or
 * `"compact"` abbreviated (`$294K`, `$3.8M`) as the locale abbreviates.
 * Values under 1,000 and percentages are always written in full, since
 * abbreviating them would round them (`$12.50` to `$13`).
 */
export type KpiNotation = 'standard' | 'compact';

/** Headline value shown above the chart, with an optional change. */
export type Kpi = {
  /**
   * The headline value, in the same units as the series, as
   * {@link ChartSpec.format} says (minor or major currency units, ratio or
   * percent). A finite number.
   */
  value: number;
  /** Required: how `value` relates to the primary series. See {@link KpiBasis}. */
  basis: KpiBasis;
  /**
   * Value to compare against, for example the same period last year. The
   * change is shown as a signed percentage, relative even for percent
   * values; it is omitted when this is missing or 0.
   */
  comparisonValue?: number;
  /** Which way a change is good. See {@link GoodDirection}. Defaults to `"up"`. */
  goodDirection?: GoodDirection;
  /** How the value is written. See {@link KpiNotation}. Defaults to `"standard"`. */
  notation?: KpiNotation;
};

/** One label/value pair in the details view. */
export type ProvenanceDetail = {
  /** Short label, for example `"Metric"`. Plain text. */
  label: string;
  /** The value as text, for example `"gross_volume"`. Plain text. */
  value: string;
};

/**
 * Where the data came from. The info button next to the title opens a
 * details view with these fields and a table of the chart's values.
 */
export type Provenance = {
  /** Where the data came from, for example `"Stripe Data API"`. Plain text. */
  source: string;
  /**
   * When the data was fetched, as an ISO 8601 date-time with `Z` or an
   * offset, for example `"2026-11-27T18:00:00Z"`. Shown in
   * {@link ChartSpec.timeZone} with the zone name.
   */
  fetchedAt?: string;
  /**
   * Up to 12 short label/value pairs, for example the metric, date range and
   * time zone.
   */
  details?: ProvenanceDetail[];
};

/**
 * A declarative description of one chart card: a title, an optional headline
 * KPI, and a line or bar chart of up to 12 series over time. Unknown fields
 * are rejected.
 *
 * A comparison series (for example last year) lines up with the primary
 * series by position, not by calendar date: the i-th point of every series is
 * drawn in the same x slot, so put the days you want compared at the same
 * index.
 */
export type ChartSpec = {
  /** Card title shown at the top, for example `"Gross volume"`. Plain text. */
  title: string;
  /**
   * One-line subtitle under the title, for example `"Monthly sales report"`. Plain text.
   */
  description?: string;
  /** How values are formatted. Defaults to `{style: "number"}`. */
  format?: ValueFormat;
  /**
   * BCP 47 language tag used for number and date formatting, for example
   * `"en-US"` or `"ja-JP"`. Defaults to `"en-US"`.
   */
  locale?: string;
  /**
   * IANA time zone, for example `"America/New_York"`, used to display
   * date-time values (x values and `fetchedAt`). Required when any x or
   * `fetchedAt` is a date-time: use the zone the data was reported in, or
   * `"UTC"`. Date-only values like `"2026-11-27"` are never shifted, so it
   * is optional for them. The viewer's own time zone is never used.
   */
  timeZone?: string;
  /** Headline value shown above the chart. */
  kpi?: Kpi;
  /** Chart options. Defaults to `{type: "line"}`. */
  chart?: ChartOptions;
  /**
   * 1 to 12 series to plot. Required unless `chart.type` is `"kpi"` or
   * `loading` is `true`; on a `"kpi"` chart they are optional and drawn as a
   * sparkline beside the value. Put the primary series (for example this
   * year) first and mark others such as last year with `comparison: true`.
   * Series are aligned by position; they may have different lengths. If
   * every series has an empty `data` array, the card shows
   * {@link ChartSpec.emptyMessage}.
   */
  series?: Series[];
  /** Where the data came from. */
  provenance?: Provenance;
  /**
   * `true` while data is being fetched; `series` and `kpi` may then be
   * omitted. Without data, the card shows a placeholder shaped by
   * `chart.type`; with data (given in `series`, or already shown by a
   * previous render), the chart stays in place, dimmed, until you render
   * again without `loading`. Defaults to `false`.
   */
  loading?: boolean;
  /**
   * Message for an empty plot, in your language, for example `"No disputes
   * this week"`. Plain text, up to 200 characters. Defaults to `"No data"`.
   */
  emptyMessage?: string;
  /** Up to 10 notes on the chart. See {@link Annotation}. */
  annotations?: Annotation[];
  /**
   * `false` to leave out the info button, so the details view (provenance,
   * notes and the data table) can't be opened. The accessible summary is
   * unchanged. Defaults to `true`.
   */
  details?: boolean;
};

/** One problem found in a spec. */
export type SpecIssue = {
  /** Path to the offending field, for example `"series[1].data[3].x"`. */
  path: string;
  /** What was expected and what was received. */
  message: string;
};

/** The result of `validate`: the spec, or every issue found. */
export type ValidationResult =
  {ok: true; spec: ChartSpec} | {ok: false; errors: SpecIssue[]};

/** Returned by `render`. */
export type ChartHandle = {
  /**
   * Redraws the chart with a new spec, and new options if given (leaving
   * them out keeps the previous ones). If the spec is invalid, shows the
   * issues in place of the chart and throws a `SpecError`.
   */
  update(spec: unknown, options?: RenderOptions): void;
  /** Removes everything the chart added to its element. */
  destroy(): void;
};

/** Every chart type, in documentation order. */
export const CHART_TYPES: readonly ChartType[] = ['line', 'bar', 'kpi'];

/** Every currency unit, in documentation order. */
export const CURRENCY_UNITS: readonly CurrencyUnit[] = ['minor', 'major'];

/** Every percent unit, in documentation order. */
export const PERCENT_UNITS: readonly PercentUnit[] = ['ratio', 'percent'];

/** Every KPI basis, in documentation order. */
export const KPI_BASES: readonly KpiBasis[] = [
  'total',
  'latest',
  'average',
  'custom',
];

/** Both KPI notations. */
export const KPI_NOTATIONS: readonly KpiNotation[] = ['standard', 'compact'];

/** Both good directions. */
export const GOOD_DIRECTIONS: readonly GoodDirection[] = ['up', 'down'];

/** Every legend mode, in documentation order. */
export const LEGEND_MODES: readonly LegendMode[] = ['auto', 'show', 'hide'];

/** Every x-axis label granularity, in documentation order. */
export const X_AXIS_LABELS: readonly XAxisLabels[] = [
  'auto',
  'day',
  'month',
  'year',
  'time',
];

/** Both y-axis notations. */
export const Y_AXIS_NOTATIONS: readonly YAxisNotation[] = [
  'compact',
  'standard',
];

/** Every bar stacking mode, in documentation order. */
export const BAR_STACKINGS: readonly BarStacking[] = ['grouped', 'stacked'];

/** Every value format style, in documentation order. */
export const FORMAT_STYLES: readonly ValueFormat['style'][] = [
  'number',
  'currency',
  'percent',
];

/** Size limits that keep a spec renderable and readable. */
export const LIMITS: {
  /** Fewest series when `series` is given. */
  readonly minSeries: number;
  /** Most series supported in one card. */
  readonly maxSeries: number;
  /** Most points per series. */
  readonly maxPoints: number;
  /** Most provenance details. */
  readonly maxDetails: number;
  /** Longest title, series label, source, and detail label or value. */
  readonly maxLabelLength: number;
  /** Longest description. */
  readonly maxDescriptionLength: number;
  /** Largest `maximumFractionDigits` that Intl accepts. */
  readonly maxFractionDigits: number;
  /**
   * Largest magnitude of a value or KPI. Below 2^53 (about 9e15) doubles
   * keep whole units exact, and spans and padding stay finite.
   */
  readonly maxAbsValue: number;
  /** Most annotations. */
  readonly maxAnnotations: number;
  /** Longest annotation label; it sits in the tooltip and details view. */
  readonly maxAnnotationLabelLength: number;
  /** Longest annotation description or incomplete-period message. */
  readonly maxNoteLength: number;
} = {
  minSeries: 1,
  maxSeries: 12,
  maxPoints: 1000,
  maxDetails: 12,
  maxLabelLength: 200,
  maxDescriptionLength: 500,
  maxFractionDigits: 20,
  maxAbsValue: 1e15,
  maxAnnotations: 10,
  maxAnnotationLabelLength: 80,
  maxNoteLength: 200,
};

/** The fields accepted at each level of the spec. */
export const FIELDS: {
  readonly spec: readonly (keyof ChartSpec)[];
  readonly format: {
    readonly number: readonly (keyof NumberFormat)[];
    readonly currency: readonly (keyof CurrencyFormat)[];
    readonly percent: readonly (keyof PercentFormat)[];
  };
  readonly kpi: readonly (keyof Kpi)[];
  readonly chart: readonly (keyof ChartOptions)[];
  readonly axes: readonly (keyof AxesOptions)[];
  readonly xAxis: readonly (keyof XAxisOptions)[];
  readonly yAxis: readonly (keyof YAxisOptions)[];
  readonly incomplete: readonly (keyof IncompletePeriod)[];
  readonly annotation: readonly (keyof Annotation)[];
  readonly series: readonly (keyof Series)[];
  readonly point: readonly (keyof DataPoint)[];
  readonly provenance: readonly (keyof Provenance)[];
  readonly detail: readonly (keyof ProvenanceDetail)[];
} = {
  spec: [
    'title',
    'description',
    'format',
    'locale',
    'timeZone',
    'kpi',
    'chart',
    'series',
    'provenance',
    'loading',
    'emptyMessage',
    'annotations',
    'details',
  ],
  format: {
    number: ['style', 'maximumFractionDigits'],
    currency: ['style', 'currency', 'unit'],
    percent: ['style', 'unit', 'maximumFractionDigits'],
  },
  kpi: ['value', 'basis', 'comparisonValue', 'goodDirection', 'notation'],
  chart: ['type', 'stacking', 'legend', 'axes', 'incomplete'],
  axes: ['x', 'y'],
  xAxis: ['labels'],
  yAxis: ['notation', 'maximumFractionDigits'],
  incomplete: ['from', 'message'],
  annotation: ['label', 'description', 'at', 'from', 'to', 'series'],
  series: ['label', 'comparison', 'color', 'data'],
  point: ['x', 'y', 'color', 'forecast', 'low', 'high', 'projected'],
  provenance: ['source', 'fetchedAt', 'details'],
  detail: ['label', 'value'],
};
