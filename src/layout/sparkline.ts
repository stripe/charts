// Geometry of a KPI tile's sparkline. No DOM.

import type {ChartModel} from '../model';
import {tokens} from '../tokens';
import type {PathPoint} from './marks';
import {polylinePath} from './marks';
import {linearScale, slotScale} from './scale';

/** The sparkline's geometry at one size. */
export type SparklineGeometry = {
  /** Per series, its points per slot (null for a gap). */
  points: (PathPoint | null)[][];
  /** The slot nearest to an x position. */
  indexAt(x: number): number;
  /** The bottom of the drawing, where the area ends. */
  bottom: number;
};

/**
 * Lays the series out in `width` by `height`, inset so the stroke and the
 * end dot are not clipped. Slots line up by position, as in the plot. The y
 * range is the data's own: a sparkline shows shape, not magnitude, so it
 * does not start at 0.
 */
export function sparklineGeometry(
  model: ChartModel,
  width: number,
  height: number,
): SparklineGeometry {
  const {inset} = tokens.sparkline;
  const x = slotScale(model.slots.length, width - 2 * inset, 'point');
  const values = model.slots.flatMap((slot) =>
    slot.points.flatMap((point) => (point.y === null ? [] : [point.y])),
  );
  // Series of only gaps have no values and no points, so any finite range
  // will do; Math.min of nothing would be Infinity.
  const low = values.length > 0 ? Math.min(...values) : 0;
  const high = values.length > 0 ? Math.max(...values) : 0;
  const bottom = height - inset;
  const y = linearScale([low, high], [bottom, inset]);
  return {
    points: model.series.map((_, seriesIndex) =>
      model.slots.map((slot) => {
        const value = slot.points[seriesIndex]?.y ?? null;
        return value === null
          ? null
          : {x: inset + x.center(slot.index), y: y(value)};
      }),
    ),
    indexAt: (position) => x.indexAt(position - inset),
    bottom,
  };
}

/** Unbroken runs of points; a gap in the data ends a run. */
function runs(points: readonly (PathPoint | null)[]): PathPoint[][] {
  const result: PathPoint[][] = [[]];
  for (const point of points) {
    if (point) result[result.length - 1].push(point);
    else if (result[result.length - 1].length > 0) result.push([]);
  }
  return result.filter((run) => run.length > 0);
}

/**
 * The area under each run of two or more points, down to `bottom`: the
 * run's line, closed along the bottom edge.
 */
export function sparklineArea(
  points: readonly (PathPoint | null)[],
  bottom: number,
): string {
  return runs(points)
    .filter((run) => run.length > 1)
    .map((run) => {
      const first = run[0];
      const last = run[run.length - 1];
      const outline = [{x: first.x, y: bottom}, ...run, {x: last.x, y: bottom}];
      return `${polylinePath(outline)}Z`;
    })
    .join('');
}

/** The latest point of a series, or null when it has none. */
export function latestPoint(
  points: readonly (PathPoint | null)[],
): PathPoint | null {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (point) return point;
  }
  return null;
}
