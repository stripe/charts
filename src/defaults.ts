// Defaults for every optional spec field, and the one place values are
// normalized to major currency units and ratios.

import {minorToMajor} from './currency';
import type {
  BarStacking,
  ChartSpec,
  ChartType,
  Annotation,
  GoodDirection,
  Kpi,
  KpiNotation,
  LegendMode,
  XAxisLabels,
  YAxisNotation,
  Series,
  ValueFormat,
} from './spec';

/** Defaults applied to optional spec fields. Documented on each field in `spec.ts`. */
export const DEFAULTS: {
  readonly format: ValueFormat;
  readonly locale: string;
  /** `timeZone` when omitted. UTC so output never depends on the viewer. */
  readonly timeZone: string;
  readonly chartType: ChartType;
  readonly stacking: BarStacking;
  readonly loading: boolean;
  /** `kpi.goodDirection` when omitted: rises are good. */
  readonly goodDirection: GoodDirection;
  /** `kpi.notation` when omitted: the value in full. */
  readonly kpiNotation: KpiNotation;
  readonly emptyMessage: string;
  readonly legend: LegendMode;
  readonly xLabels: XAxisLabels;
  readonly yNotation: YAxisNotation;
  readonly incompleteMessage: string;
  readonly details: boolean;
  /** `maximumFractionDigits` for the `"number"` style. */
  readonly numberFractionDigits: number;
  /** `maximumFractionDigits` for the `"percent"` style. */
  readonly percentFractionDigits: number;
} = {
  format: {style: 'number'},
  locale: 'en-US',
  timeZone: 'UTC',
  chartType: 'line',
  stacking: 'grouped',
  loading: false,
  goodDirection: 'up',
  kpiNotation: 'standard',
  emptyMessage: 'No data',
  legend: 'auto',
  xLabels: 'auto',
  yNotation: 'compact',
  incompleteMessage: 'Data in this period is still being processed',
  details: true,
  numberFractionDigits: 2,
  percentFractionDigits: 1,
};

// Percent values given as 2.5 for 2.5% are divided by this to make ratios.
const PERCENT_PER_RATIO = 100;

/**
 * A spec with every defaulted field filled in and every value normalized:
 * currency in major units (`format.unit` is `"major"`) and percentages as
 * ratios (`format.unit` is `"ratio"`), in `series` (y, low and high),
 * `kpi.value` and `kpi.comparisonValue`.
 */
export type ResolvedSpec = Omit<
  ChartSpec,
  | 'format'
  | 'locale'
  | 'timeZone'
  | 'chart'
  | 'series'
  | 'loading'
  | 'emptyMessage'
> & {
  format: ValueFormat;
  locale: string;
  timeZone: string;
  chartType: ChartType;
  stacking: BarStacking;
  series: Series[];
  loading: boolean;
  /** `kpi.goodDirection`, or the default when there is no KPI. */
  goodDirection: GoodDirection;
  /** `kpi.notation`, or the default when there is no KPI. */
  kpiNotation: KpiNotation;
  emptyMessage: string;
  /** `chart.legend`. */
  legend: LegendMode;
  /** `chart.axes`, with defaults; `maximumFractionDigits` stays optional. */
  axes: {
    x: {labels: XAxisLabels};
    y: {
      notation: YAxisNotation;
      maximumFractionDigits?: number;
    };
  };
  /** `chart.incomplete` with its default message, or undefined. */
  incomplete: {from: string; message: string} | undefined;
  /** `annotations`, or none. */
  annotations: Annotation[];
  /** Whether the info button and details view are offered. */
  details: boolean;
};

/**
 * The factor that turns `format`'s values into major units or ratios, and
 * the format they are then in.
 */
function normalizer(format: ValueFormat): {
  scale: (value: number) => number;
  format: ValueFormat;
} {
  if (format.style === 'currency' && format.unit === 'minor') {
    return {
      scale: (value) => minorToMajor(value, format.currency),
      format: {...format, unit: 'major'},
    };
  }
  if (format.style === 'percent' && format.unit === 'percent') {
    return {
      scale: (value) => value / PERCENT_PER_RATIO,
      format: {...format, unit: 'ratio'},
    };
  }
  return {scale: (value) => value, format};
}

/** Fills in defaults for a validated spec. Does not modify `spec`. */
export function resolveSpec(spec: ChartSpec): ResolvedSpec {
  const {
    format,
    locale,
    timeZone,
    chart,
    series,
    loading,
    emptyMessage,
    kpi,
    annotations,
    details,
    ...rest
  } = spec;
  const yAxis = chart?.axes?.y;
  const {scale, format: normalized} = normalizer(format ?? DEFAULTS.format);
  const resolvedKpi: Kpi | undefined = kpi && {
    ...kpi,
    value: scale(kpi.value),
    ...(kpi.comparisonValue === undefined
      ? {}
      : {comparisonValue: scale(kpi.comparisonValue)}),
  };
  return {
    ...rest,
    ...(resolvedKpi ? {kpi: resolvedKpi} : {}),
    format: normalized,
    locale: locale ?? DEFAULTS.locale,
    timeZone: timeZone ?? DEFAULTS.timeZone,
    chartType: chart?.type ?? DEFAULTS.chartType,
    stacking: chart?.stacking ?? DEFAULTS.stacking,
    series: (series ?? []).map((s) => ({
      ...s,
      data: s.data.map((point) => ({
        ...point,
        y: point.y === null ? null : scale(point.y),
        ...(point.low === undefined ? {} : {low: scale(point.low)}),
        ...(point.high === undefined ? {} : {high: scale(point.high)}),
        ...(point.projected === undefined
          ? {}
          : {projected: scale(point.projected)}),
      })),
    })),
    loading: loading ?? DEFAULTS.loading,
    goodDirection: kpi?.goodDirection ?? DEFAULTS.goodDirection,
    kpiNotation: kpi?.notation ?? DEFAULTS.kpiNotation,
    emptyMessage: emptyMessage ?? DEFAULTS.emptyMessage,
    legend: chart?.legend ?? DEFAULTS.legend,
    axes: {
      x: {
        labels: chart?.axes?.x?.labels ?? DEFAULTS.xLabels,
      },
      y: {
        notation: yAxis?.notation ?? DEFAULTS.yNotation,
        ...(yAxis?.maximumFractionDigits === undefined
          ? {}
          : {maximumFractionDigits: yAxis.maximumFractionDigits}),
      },
    },
    incomplete: chart?.incomplete && {
      from: chart.incomplete.from,
      message: chart.incomplete.message ?? DEFAULTS.incompleteMessage,
    },
    annotations: annotations ?? [],
    details: details ?? DEFAULTS.details,
  };
}
