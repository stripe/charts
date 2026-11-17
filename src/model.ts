// Turns a validated spec into the data the chart draws. Pure data, no pixels.

import {resolveSpec} from './defaults';
import {niceDomain} from './domain';
import {formatParsedDate, minorUnit} from './format';
import type {DateStyle} from './format';
import {parseIsoDate} from './isoDate';
import type {ParsedDate} from './isoDate';
import type {PointKind} from './options';
import type {Annotation, ChartSpec, DataPoint} from './spec';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Date-times covering less than this are labelled by time of day: a day of
// hourly points labelled "Nov 27" on every tick says nothing.
const TIME_OF_DAY_MAX_SPAN = 2 * MS_PER_DAY;

/** Time-of-day labels for date-times within a short span, dates otherwise. */
function axisDateStyle(dates: readonly (ParsedDate | null)[]): DateStyle {
  const times: number[] = [];
  for (const parsed of dates) {
    if (parsed?.kind !== 'dateTime') return 'axis';
    times.push(parsed.time);
  }
  if (times.length === 0) return 'axis';
  const span = Math.max(...times) - Math.min(...times);
  return span < TIME_OF_DAY_MAX_SPAN ? 'axisTime' : 'axis';
}

// Years are compared as plain digits, whatever the chart's locale.
const YEAR_LOCALE = 'en-US';

/**
 * The style for tooltip headers and table dates. Unlike axis labels, which
 * thin out over long ranges, each header names one point, so it keeps the
 * time for intraday data (three days of hourly points read "Nov 27, 6 AM",
 * not "Nov 27" 24 times) and adds the year when the range crosses years.
 */
function headerDateStyle(
  dates: readonly (ParsedDate | null)[],
  timeZone: string,
): DateStyle {
  const known = dates.filter((date): date is ParsedDate => date !== null);
  if (known.length === 0) return 'axis';
  const times = known.map((date) => date.time).sort((a, b) => a - b);
  const gaps = times.slice(1).map((time, i) => time - times[i]);
  const intraday =
    known.every((date) => date.kind === 'dateTime') &&
    (gaps.length === 0 || Math.min(...gaps) < MS_PER_DAY);
  const year = (date: ParsedDate) =>
    formatParsedDate(date, {style: 'axisYear', locale: YEAR_LOCALE, timeZone});
  const crossesYears = year(known[0]) !== year(known[known.length - 1]);
  if (intraday) return crossesYears ? 'tooltipHeaderYear' : 'tooltipHeader';
  return crossesYears ? 'axisDateYear' : 'axis';
}

/** One series' point at a slot. */
export type SlotPoint = {
  /** Index into {@link ChartModel.series}. */
  seriesIndex: number;
  /** This series' own x at this slot, or null when the series is shorter. */
  x: string | null;
  /** The value, or null for a gap or a missing point. */
  y: number | null;
  /**
   * `"forecast"` for forecast points; `"incomplete"` for points of
   * non-comparison series from {@link ChartModel.incompleteFrom} on (a
   * comparison series, such as last year, is final); else `"actual"`.
   */
  kind: PointKind;
  /** Bar charts: this bar segment's color from the spec, a hex string; else null. */
  color: string | null;
  /** A forecast point's lower bound, or null. */
  low: number | null;
  /** A forecast point's upper bound, or null. */
  high: number | null;
  /** An incomplete point's projected end value, or null. */
  projected: number | null;
};

/** An annotation resolved to slots. */
export type ModelAnnotation = {
  label: string;
  description: string | null;
  /**
   * `"marker"`: a vertical marker at slot `from`; `"point"`: a marker on
   * series `seriesIndex`'s point at slot `from`; `"range"`: slots `from` to
   * `to`, inclusive.
   */
  kind: 'marker' | 'point' | 'range';
  from: number;
  to: number;
  /** For `"point"`, the index into {@link ChartModel.series}; else null. */
  seriesIndex: number | null;
  /** True for the range added for `chart.incomplete`, labelled with its message. */
  incomplete: boolean;
  /** An omitted range endpoint extends to the plot edge without a boundary. */
  openStart: boolean;
  openEnd: boolean;
};

/** Options for {@link buildModel}. */
export type BuildModelOptions = {
  /**
   * Labels of series the legend hides. They stay in the model (slots and
   * indexes don't shift) but leave the y domain, ticks and stacks.
   */
  hidden?: ReadonlySet<string>;
};

/**
 * One series' segment of a stacked bar, as values: it spans `y0` to `y1`.
 * Positive values stack upward from 0 and negative values downward, each in
 * series order, so `y1` is above `y0` for positives and below for negatives.
 */
export type StackSegment = {
  /** Index into {@link ChartModel.series}. */
  seriesIndex: number;
  y0: number;
  /** The segment's end, at its projected value when it has one. */
  y1: number;
  /**
   * Where the actual value so far ends: `y1` unless the point is
   * projected, when `actualY1` to `y1` is the projected extension. Series
   * above stack on `y1`, so the extension never overlaps them.
   */
  actualY1: number;
};

/** One x position shared by every series. */
export type Slot = {
  index: number;
  /**
   * Axis label from the first non-comparison series: its date (`Nov 27`),
   * or its time of day (`6 AM`, in the spec's time zone) when that series is
   * date-times spanning under 2 days. `""` when it has no point here.
   */
  xLabel: string;
  /**
   * Tooltip header from the same series: `Nov 27`, or `Nov 27, 6 AM` when
   * the axis shows time of day. `""` when it has no point here.
   */
  headerLabel: string;
  /** One entry per series, in series order. */
  points: SlotPoint[];
  /** Indexes into {@link ChartModel.annotations} of those covering this slot. */
  annotations: number[];
  /**
   * Stacked bar segments in visual order, top segment first, skipping gaps.
   * Empty unless {@link ChartModel.stacked}.
   */
  stack: StackSegment[];
};

/** The data to draw, independent of size. */
export type ChartModel = {
  /** As many slots as the longest series has points. */
  slots: Slot[];
  series: {
    label: string;
    comparison: boolean;
    /** The spec's `color`; absent for the palette. */
    color?: string;
    /** True when {@link BuildModelOptions.hidden} hides it. */
    hidden: boolean;
  }[];
  /** Annotations resolved to slots, the incomplete period's last. */
  annotations: ModelAnnotation[];
  /** The first incomplete slot, or null. */
  incompleteFrom: number | null;
  /** True when any series has forecast points. */
  hasForecast: boolean;
  /** True when any point has a projected value. */
  hasProjected: boolean;
  /** True for bar charts with `chart.stacking: "stacked"`. */
  stacked: boolean;
  /**
   * The {@link DateStyle} of {@link Slot.headerLabel}, for formatting other
   * dates (such as a comparison point's own date) to match it. It shows the
   * time when the primary series is date-times less than a day apart, and
   * the year when its dates cross years, whatever the axis labels show.
   */
  headerStyle: DateStyle;
  /**
   * The value range to plot, padded around the data of visible series,
   * including forecast bands. Bar charts include 0 as the baseline; line
   * charts zoom to the data. For stacked bars it covers the stack totals
   * above and below 0.
   */
  yDomain: [number, number];
  /**
   * About 4 round values within `yDomain`, ascending. The domain may extend
   * past the first and last tick. For another tick count (short plots), use
   * `niceScale(yDomain, {targetCount, minStep: yMinStep})`.
   */
  yTicks: number[];
  /**
   * The smallest y tick step the data allows: the currency's minor unit
   * (1 for JPY) when every value is a whole number of it, else 0.
   */
  yMinStep: number;
  /** True when there are no points at all. */
  empty: boolean;
};

/**
 * Stacks one slot's values, one per series in series order (null for a
 * gap): positives upward from 0 and negatives downward, each in series
 * order. A series with a `projected` value (an incomplete point on pace for
 * more) stacks to that height, its actual value ending at `actualY1`.
 * Returned top segment first, which is also tooltip row order; this is how
 * {@link Slot.stack} is built, exported so animation can re-stack
 * interpolated values each frame.
 */
export function stackValues(
  values: readonly (number | null)[],
  projected: readonly (number | null)[] = [],
): StackSegment[] {
  const above: StackSegment[] = [];
  const below: StackSegment[] = [];
  let top = 0;
  let bottom = 0;
  values.forEach((y, seriesIndex) => {
    if (y === null) return;
    // Validation keeps a projection on the same side of 0 as its value.
    const height = projected[seriesIndex] ?? y;
    if (height >= 0) {
      above.push({seriesIndex, y0: top, y1: top + height, actualY1: top + y});
      top += height;
    } else {
      below.push({
        seriesIndex,
        y0: bottom,
        y1: bottom + height,
        actualY1: bottom + y,
      });
      bottom += height;
    }
  });
  return [...above.reverse(), ...below];
}

function nullIfMissing(index: number): number | null {
  return index < 0 ? null : index;
}

/** What a point is; see {@link SlotPoint.kind}. */
function pointKind(
  point: DataPoint | undefined,
  canBeIncomplete: boolean,
  index: number,
  incompleteFrom: number | null,
): PointKind {
  if (point?.forecast) return 'forecast';
  if (canBeIncomplete && incompleteFrom !== null && index >= incompleteFrom) {
    return 'incomplete';
  }
  return 'actual';
}

/** The last slot before the forecast, which ends the incomplete period. */
function lastActualSlot(data: readonly DataPoint[]): number {
  const forecast = data.findIndex((point) => point.forecast);
  return (forecast < 0 ? data.length : forecast) - 1;
}

/**
 * Resolves annotations to slot indexes by matching x values against the
 * primary series (validation guarantees they are there; any that are not
 * are dropped), and adds the incomplete period as a range last.
 */
function resolveAnnotations(
  annotations: readonly Annotation[],
  incomplete: {message: string; from: number} | null,
  primaryXs: readonly string[],
  labels: readonly string[],
  lastActual: number,
): ModelAnnotation[] {
  const slot = (x: string | undefined, fallback: number): number =>
    x === undefined ? fallback : primaryXs.indexOf(x);
  const last = primaryXs.length - 1;
  const resolved = annotations.flatMap((a): ModelAnnotation[] => {
    const base = {
      label: a.label,
      description: a.description ?? null,
      incomplete: false,
      openStart: a.from === undefined,
      openEnd: a.to === undefined,
    };
    if (a.at !== undefined) {
      const at = primaryXs.indexOf(a.at);
      if (at < 0) return [];
      const seriesIndex =
        a.series === undefined ? -1 : labels.indexOf(a.series);
      return [
        {
          ...base,
          kind: seriesIndex >= 0 ? 'point' : 'marker',
          from: at,
          to: at,
          seriesIndex: seriesIndex >= 0 ? seriesIndex : null,
        },
      ];
    }
    const from = slot(a.from, 0);
    const to = slot(a.to, last);
    if (from < 0 || to < from) return [];
    return [{...base, kind: 'range', from, to, seriesIndex: null}];
  });
  if (incomplete && lastActual >= incomplete.from) {
    resolved.push({
      label: incomplete.message,
      description: null,
      kind: 'range',
      from: incomplete.from,
      to: lastActual,
      seriesIndex: null,
      incomplete: true,
      openStart: false,
      openEnd: false,
    });
  }
  return resolved;
}

/**
 * Aligns series by position: index i of every series shares slot i, whatever
 * its dates, because a comparison series lines up by position, not by
 * calendar date (the caller decides which days correspond).
 */
export function buildModel(
  spec: ChartSpec,
  {hidden = new Set()}: BuildModelOptions = {},
): ChartModel {
  const {
    series,
    locale,
    timeZone,
    chartType,
    stacking,
    format,
    incomplete,
    annotations,
    axes,
  } = resolveSpec(spec);
  const stacked = chartType === 'bar' && stacking === 'stacked';
  const primary = series.find((s) => !s.comparison) ?? series[0];
  const primaryXs = (primary?.data ?? []).map((point) => point.x);
  // Hiding every series would leave nothing to fit; the legend prevents it.
  const isHidden = (label: string): boolean =>
    hidden.has(label) && series.some((s) => !hidden.has(s.label));
  const incompleteFrom = incomplete
    ? nullIfMissing(primaryXs.indexOf(incomplete.from))
    : null;
  const slotCount = Math.max(0, ...series.map((s) => s.data.length));
  const primaryDates = (primary?.data ?? []).map((point) =>
    parseIsoDate(point.x),
  );
  const axisStyle = axisDateStyle(primaryDates);
  const headerStyle = headerDateStyle(primaryDates, timeZone);

  const formatPrimaryDate = (
    index: number,
    x: string,
    style: DateStyle,
  ): string => {
    const parsed = primaryDates[index];
    return parsed ? formatParsedDate(parsed, {style, locale, timeZone}) : x;
  };
  const slots = Array.from({length: slotCount}, (_, index): Slot => {
    const labelX = primary?.data[index]?.x;
    const label = (style: DateStyle): string =>
      labelX ? formatPrimaryDate(index, labelX, style) : '';
    const points = series.map((s, seriesIndex): SlotPoint => {
      const point = s.data[index];
      return {
        seriesIndex,
        x: point?.x ?? null,
        y: point?.y ?? null,
        kind: pointKind(point, !s.comparison, index, incompleteFrom),
        color: point?.color ?? null,
        low: point?.low ?? null,
        high: point?.high ?? null,
        projected: point?.projected ?? null,
      };
    });
    return {
      index,
      xLabel: label(axisStyle),
      headerLabel: label(headerStyle),
      points,
      annotations: [],
      stack: stacked
        ? stackValues(
            points.map((point) =>
              isHidden(series[point.seriesIndex].label) ? null : point.y,
            ),
            points.map((point) => point.projected),
          )
        : [],
    };
  });
  const resolved = resolveAnnotations(
    annotations,
    incomplete && incompleteFrom !== null
      ? {message: incomplete.message, from: incompleteFrom}
      : null,
    primaryXs,
    series.map((s) => s.label),
    lastActualSlot(primary?.data ?? []),
  );
  resolved.forEach((annotation, i) => {
    for (let index = annotation.from; index <= annotation.to; index += 1) {
      slots[index]?.annotations.push(i);
    }
  });

  // A stack's extremes are its running totals, so the segment ends cover
  // the domain exactly. Forecast bands are part of what is drawn.
  const values = stacked
    ? slots.flatMap((slot) => slot.stack.map((segment) => segment.y1))
    : series
        .filter((s) => !isHidden(s.label))
        .flatMap((s) =>
          s.data.flatMap((point) =>
            [point.y, point.low, point.high, point.projected].filter(
              (value): value is number => typeof value === 'number',
            ),
          ),
        );
  const cap = axes.y.maximumFractionDigits;
  // Percent values are ratios by now (0.25 shows as 25%), so a label's
  // decimals sit two places further right.
  const capDigits =
    cap === undefined ? undefined : cap + (format.style === 'percent' ? 2 : 0);
  const {domain, ticks, minStep} = niceDomain(values, {
    includeZero: chartType === 'bar',
    unit: minorUnit(format),
    minStep: capDigits === undefined ? 0 : 10 ** -capDigits,
  });
  return {
    slots,
    series: series.map((s) => ({
      label: s.label,
      comparison: s.comparison === true,
      ...(s.color === undefined ? {} : {color: s.color}),
      hidden: isHidden(s.label),
    })),
    annotations: resolved,
    incompleteFrom,
    hasForecast: series.some((s) => s.data.some((point) => point.forecast)),
    hasProjected: series.some((s) =>
      s.data.some((point) => point.projected !== undefined),
    ),
    stacked,
    headerStyle,
    yDomain: domain,
    yTicks: ticks,
    yMinStep: minStep,
    empty: slotCount === 0,
  };
}

/**
 * The KPI change ratio, `(value - comparisonValue) / |comparisonValue|`, or
 * null when there is no comparison value or it is 0.
 */
export function kpiChange(
  value: number,
  comparisonValue?: number,
): number | null {
  if (comparisonValue === undefined || comparisonValue === 0) return null;
  return (value - comparisonValue) / Math.abs(comparisonValue);
}
