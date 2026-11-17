import type {ResolvedSpec} from '../defaults';
import {formatValue} from '../format';
import type {ChartModel} from '../model';
import type {PointEvent, PointEventSeries} from '../options';
import {MESSAGES} from './messages';
import {rowOrder} from './plot/tooltip';

/**
 * Calls the caller's `callback`, if set, with `args`. Whatever it throws is
 * reported with `console.error` and treated as no result, so one bad
 * callback can't stop the chart from drawing or responding.
 */
export function callSafely<Args extends unknown[], Result>(
  name: string,
  callback: ((...callbackArgs: Args) => Result) | undefined,
  ...args: Args
): Result | undefined {
  if (!callback) return undefined;
  try {
    return callback(...args);
  } catch (error) {
    // eslint-disable-next-line no-console -- the documented way callback errors are reported
    console.error(`${name} threw:`, error);
    return undefined;
  }
}

/**
 * The event for `slot`: every series present there in tooltip order, the
 * primary series' x, and the series under the pointer (`seriesIndex`, for
 * bars). `colors` are the series colors as CSS colors a caller can use
 * outside the chart.
 */
export function pointEvent(
  model: ChartModel,
  spec: ResolvedSpec,
  colors: readonly string[],
  slot: number,
  seriesIndex: number | null,
  nativeEvent: Event | null,
): PointEvent {
  const points = rowOrder(model, slot);
  const series = points.map((point): PointEventSeries => {
    const {label} = model.series[point.seriesIndex];
    return {
      label,
      x: point.x,
      y: point.y,
      formatted:
        point.y === null
          ? MESSAGES.noValue
          : formatValue(point.y, spec.format, spec.locale),
      kind: point.kind,
      projected: point.projected,
      color: colors[point.seriesIndex],
    };
  });
  // The x the axis and tooltip header show, even while the legend hides
  // that series.
  const slotPoints = model.slots[slot]?.points ?? [];
  const primary =
    slotPoints.find(
      (point) =>
        point.x !== null && !model.series[point.seriesIndex].comparison,
    ) ?? slotPoints.find((point) => point.x !== null);
  return {
    index: slot,
    series,
    seriesLabel:
      seriesIndex === null ? null : model.series[seriesIndex]?.label ?? null,
    x: primary?.x ?? '',
    nativeEvent,
  };
}
