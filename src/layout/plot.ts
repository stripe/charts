// Geometry of the plot area. Pure: text widths come from `measure`.

import type {NiceScale} from '../domain';
import {
  DEFAULT_MIN_TICK_COUNT,
  DEFAULT_TARGET_TICK_COUNT,
  niceScale,
} from '../domain';
import {tokens} from '../tokens';
import type {BarBand, LinearScale, SlotScale} from './scale';
import {barBands, crisp, linearScale, slotScale} from './scale';
import type {XLabel, XLabelGranularity, XTick} from './xAxis';
import {layoutXAxis} from './xAxis';

/** A y tick with its formatted label. */
export type YTick = {value: number; label: string};

/** Everything the plot layout depends on. */
export type PlotInput = {
  /** Size of the plot area (plot plus axes), in CSS pixels. */
  width: number;
  height: number;
  chartType: 'line' | 'bar';
  /** Each slot's instant, from the primary series; null when it has none. */
  times: readonly (number | null)[];
  /** Zone for calendar boundaries: the display zone, or UTC for calendar days. */
  timeZone: string;
  seriesCount: number;
  /** Stacked bars share one bar per slot instead of one per series. Defaults to false. */
  stacked?: boolean;
  yDomain: readonly [number, number];
  /**
   * Smallest y step worth showing, such as a currency's minor unit for whole
   * amounts (so whole yen never get half-yen ticks). Defaults to 0, no limit.
   */
  yMinStep?: number;
  /** Labels for a set of y tick values, formatted together so they agree. */
  formatYTicks: (values: readonly number[]) => string[];
  /** The label for an x tick. */
  formatXTick: (tick: XTick) => string;
  /** Rendered width of an axis label. */
  measure: (text: string) => number;
  /**
   * X labels already laid out for this data, by plot width. The x axis
   * depends only on the slots and the plot's width, so an animation that
   * moves only the y scale reuses them instead of re-measuring and
   * re-formatting every frame. The caller clears it when the data or the
   * chart's size changes. Optional; without it labels are laid out each call.
   */
  xLabelCache?: Map<number, XLabel[]>;
  /** X label granularity to force. Defaults to automatic labels. */
  xAxis?: {labels?: XLabelGranularity};
};

/** A placed y label. */
export type YLabel = YTick & {
  /** Vertical centre of the label, on its gridline. */
  y: number;
};

/** The plot's inner rectangle. Its left edge is the area's left edge. */
export type PlotRect = {
  top: number;
  bottom: number;
  width: number;
  height: number;
};

/** Where everything in the plot area goes. */
export type PlotLayout = {
  width: number;
  height: number;
  plot: PlotRect;
  x: SlotScale;
  y: LinearScale;
  /**
   * The value range `y` maps: the input domain, widened to a tick step
   * where needed so there are at least 3 ticks and each side of 0 the data
   * reaches has one.
   */
  yDomain: [number, number];
  /** Left edge of the y labels, right of the plot. */
  yLabelLeft: number;
  yLabels: YLabel[];
  /** Crisp y positions of the horizontal gridlines. */
  gridlines: number[];
  /** Crisp y position of the x baseline. */
  baselineY: number;
  /**
   * Crisp y position of a line at 0 when the domain spans both signs (bars
   * that go negative), or null. It anchors the bars the way the baseline
   * does for positive-only charts.
   */
  zeroY: number | null;
  xLabels: XLabel[];
  /** Top of the x label row. */
  xLabelTop: number;
  /** Bar placement within a slot, one per series (bars only). */
  bars: BarBand[];
  /**
   * True when side-by-side bars would be thinner than
   * `series.overlayBelow` even with the gaps collapsed. Each series then
   * spans the whole slot in whole pixels, overlaid in drawing order
   * (comparison behind, primary in front).
   */
  overlayBars: boolean;
};

const {axis, plot: plotTokens, grid, series} = tokens;

// A usable axis needs two labelled values; asking for fewer than this
// makes the nice step wider than the data.
const MIN_TARGET_TICK_COUNT = 2;

/**
 * The y scale's domain and ticks for a plot `height` tall: about 4
 * ticks on a card-sized plot and one per `axis.yTickSpacing`
 * on a tall one, on 1/2/5 steps. If the step leaves ticks closer than
 * `axis.yTickMinSpacing`, or more than `axis.yMaxTickCount` of them (a nice
 * step can overshoot the target), a coarser step is asked for rather than dropping
 * ticks, which would leave an uneven step (0.1, 0.14, 0.18). The domain may
 * widen to the next step so a short plot still gets enough ticks.
 */
function yScale(
  yDomain: readonly [number, number],
  height: number,
  minStep: number,
): NiceScale {
  let target = Math.max(DEFAULT_TARGET_TICK_COUNT, height / axis.yTickSpacing);
  const options = {
    minStep,
    minTickGap: height > 0 ? axis.yTickMinSpacing / height : 0,
    maxCount: axis.yMaxTickCount,
    // Ticks are always yTickMinSpacing apart, so a plot shorter than two
    // gaps can only hold two of them.
    minCount:
      height < axis.yTickMinSpacing * (DEFAULT_MIN_TICK_COUNT - 1)
        ? MIN_TARGET_TICK_COUNT
        : DEFAULT_MIN_TICK_COUNT,
  };
  let scale = niceScale(yDomain, {...options, targetCount: target});
  while (target > MIN_TARGET_TICK_COUNT && scale.ticks.length >= 2) {
    const [low, high] = scale.domain;
    const step = Math.abs(scale.ticks[1] - scale.ticks[0]);
    const span = Math.abs(high - low);
    const spaced = span === 0 || (step / span) * height >= axis.yTickMinSpacing;
    if (spaced && scale.ticks.length <= axis.yMaxTickCount) break;
    target -= 1;
    scale = niceScale(yDomain, {...options, targetCount: target});
  }
  return scale;
}

/**
 * Lays out the plot for a size. The y labels sit in a column on the right
 * as wide as the widest label; the plot takes the rest, so a long currency
 * label never overlaps the data.
 */
export function layoutPlot(input: PlotInput): PlotLayout {
  const {width, height, chartType, times, seriesCount, yDomain, measure} =
    input;
  const top = plotTokens.insetTop;
  const bottom = Math.max(
    top,
    height - plotTokens.insetBottom - axis.label.lineHeight - axis.labelGap,
  );
  const {domain, ticks: values} = yScale(
    yDomain,
    bottom - top,
    input.yMinStep ?? 0,
  );
  const y = linearScale(domain, [bottom, top]);
  const labels = input.formatYTicks(values);
  const yTicks = values.map((value, i) => ({value, label: labels[i] ?? ''}));
  const yLabels = yTicks.map((tick) => ({
    ...tick,
    y: y(tick.value),
  }));
  const labelColumn =
    Math.max(0, ...yLabels.map((label) => measure(label.label))) +
    axis.labelGap;
  const plotWidth = Math.max(0, width - labelColumn);
  const x = slotScale(
    times.length,
    plotWidth,
    chartType === 'line' ? 'point' : 'band',
  );
  const baselineY = crisp(bottom, axis.baselineWidth);

  const [low, high] = domain;
  const zeroY = low < 0 && high > 0 ? crisp(y(0), axis.baselineWidth) : null;
  // The baseline and zero line already mark their values; a gridline there
  // would double them.
  const gridlines = yLabels
    .map((label) => crisp(label.y, grid.width))
    .filter((gridY) =>
      [baselineY, zeroY].every(
        (line) => line === null || Math.abs(gridY - line) >= grid.width,
      ),
    );

  const bars =
    chartType === 'bar'
      ? barBands(
          x.step,
          input.stacked === true ? 1 : seriesCount,
          series.barGroupRatio,
          series.minBarWidth,
        )
      : [];

  const cached = input.xLabelCache?.get(plotWidth);
  const xLabels =
    cached ??
    layoutXAxis({
      times,
      timeZone: input.timeZone,
      center: x.center,
      plotWidth,
      measure,
      formatTick: input.formatXTick,
      minGap: axis.labelMinGap,
      gaps: axis.tickLabelGap,
      ...(input.xAxis?.labels ? {labels: input.xAxis.labels} : {}),
    });
  if (!cached) input.xLabelCache?.set(plotWidth, xLabels);

  return {
    width,
    height,
    plot: {top, bottom, width: plotWidth, height: bottom - top},
    x,
    y,
    yDomain: [domain[0], domain[1]],
    yLabelLeft: plotWidth + axis.labelGap,
    yLabels,
    gridlines,
    baselineY,
    zeroY,
    xLabels,
    xLabelTop: bottom + axis.labelGap,
    bars,
    overlayBars:
      bars.length > 0 && bars.every((band) => band.width < series.overlayBelow),
  };
}
