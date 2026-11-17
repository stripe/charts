// Geometry of the data marks: line paths and bar rectangles.

import {tokens} from '../tokens';
import type {PlotLayout} from './plot';
import {slotPixels} from './scale';

// Two decimals is finer than any display and keeps path strings short.
const COORDINATE_PRECISION = 100;

function round(value: number): number {
  return Math.round(value * COORDINATE_PRECISION) / COORDINATE_PRECISION;
}

/** A point in plot pixels. */
export type PathPoint = {x: number; y: number};

/**
 * An SVG path through `points` in order. A null point breaks the line, so a
 * gap in the data shows as a gap. A point with gaps on both sides is a
 * zero-length segment, which the round line cap draws as a dot.
 */
export function polylinePath(points: readonly (PathPoint | null)[]): string {
  let path = '';
  let drawing = false;
  points.forEach((point, index) => {
    if (point === null) {
      drawing = false;
      return;
    }
    const at = `${round(point.x)},${round(point.y)}`;
    const next = points[index + 1];
    if (drawing) {
      path += `L${at}`;
    } else {
      path += `M${at}`;
      if (next === null || next === undefined) path += 'h0';
    }
    drawing = true;
  });
  return path;
}

/**
 * Thins a line with more points than pixels without changing what is
 * drawn: within each pixel column it keeps the first, lowest, highest and
 * last point, in order, so the line's extent and its joins to the
 * neighbouring columns are exact. A gap (null) is kept as is. Long paths
 * are slow to paint, and every hover repaints them.
 */
export function decimateLine(
  points: readonly (PathPoint | null)[],
): (PathPoint | null)[] {
  const result: (PathPoint | null)[] = [];
  let column: PathPoint[] = [];
  const flush = (): void => {
    if (column.length === 0) return;
    const first = column[0];
    const last = column[column.length - 1];
    const low = column.reduce((a, b) => (b.y > a.y ? b : a));
    const high = column.reduce((a, b) => (b.y < a.y ? b : a));
    const kept = new Set([first, low, high, last]);
    result.push(...column.filter((point) => kept.has(point)));
    column = [];
  };
  for (const point of points) {
    if (point === null) {
      flush();
      result.push(null);
    } else {
      const previous = column[0];
      if (previous && Math.floor(previous.x) !== Math.floor(point.x)) flush();
      column.push(point);
    }
  }
  flush();
  return result;
}

/**
 * The line through `values`, one per slot, in the plot's coordinates,
 * thinned per pixel column when there are more points than pixels.
 */
export function linePath(
  values: readonly (number | null)[],
  layout: Pick<PlotLayout, 'x' | 'y'>,
): string {
  const points = values.map((value, index) =>
    value === null ? null : {x: layout.x.center(index), y: layout.y(value)},
  );
  const dense = layout.x.step < 1;
  return polylinePath(dense ? decimateLine(points) : points);
}

/**
 * The whole-pixel column a slot falls in when slots are under a pixel
 * wide, kept inside the plot.
 */
function pixelColumn(layout: PlotLayout, slot: number): number {
  const last = Math.max(0, Math.ceil(layout.plot.width) - 1);
  return Math.min(last, Math.max(0, Math.floor(layout.x.center(slot))));
}

/**
 * The slots to draw. Normally every slot with a value. When slots are
 * narrower than a pixel, the slots sharing a pixel column are drawn as one:
 * the one with the largest `magnitude`, so a spike is never dropped by
 * sampling and every column with data shows something.
 */
function visibleSlots(
  count: number,
  layout: PlotLayout,
  magnitude: (slot: number) => number | null,
): number[] {
  const slots = Array.from({length: count}, (_, slot) => slot).filter(
    (slot) => magnitude(slot) !== null,
  );
  if (!layout.overlayBars || layout.x.step >= 1) return slots;
  const best = new Map<number, {slot: number; size: number}>();
  for (const slot of slots) {
    const size = magnitude(slot) ?? 0;
    const column = pixelColumn(layout, slot);
    const current = best.get(column);
    if (!current || size > current.size) best.set(column, {slot, size});
  }
  return [...best.values()].map(({slot}) => slot).sort((a, b) => a - b);
}

/**
 * Where the bar in band `band` goes in `slot`, horizontally, or null if
 * the slot has no pixels. Bars wide enough sit side by side with fractional
 * geometry. Thinner ones span the whole slot in whole pixels and overlay
 * one another in drawing order: interleaving 1px bars would turn into
 * one-colored halves of the chart under any zoom or scaling. Stacked bars
 * use the whole slot too.
 */
function barSpan(
  layout: PlotLayout,
  slot: number,
  band: number,
  stacked: boolean,
): {x: number; width: number} | null {
  const placement = layout.bars[stacked ? 0 : band];
  if (!placement) return null;
  if (!layout.overlayBars) {
    return {
      x: round(layout.x.center(slot) + placement.offset),
      width: round(placement.width),
    };
  }
  // Under a pixel per slot, the slot drawn for a column fills it.
  if (layout.x.step < 1) return {x: pixelColumn(layout, slot), width: 1};
  const column = slotPixels(slot, layout.x.step);
  return column.width > 0 ? column : null;
}

/** A bar's rectangle in plot coordinates. */
export type BarRect = {
  slot: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Rectangles for one series' bars, in band `band` of each slot's group
 * (its position among the series drawn). Bars grow from 0 (up for positive
 * values, down for negative ones); null values have no bar.
 */
export function barRects(
  values: readonly (number | null)[],
  band: number,
  layout: PlotLayout,
): BarRect[] {
  const zeroY = layout.y(0);
  const slots = visibleSlots(values.length, layout, (slot) => {
    const value = values[slot];
    return value === null || value === undefined ? null : Math.abs(value);
  });
  return slots.flatMap((slot) => {
    const value = values[slot] ?? null;
    const span = value === null ? null : barSpan(layout, slot, band, false);
    if (value === null || !span) return [];
    const valueY = layout.y(value);
    return [
      {
        slot,
        ...span,
        y: round(Math.min(valueY, zeroY)),
        height: round(Math.abs(valueY - zeroY)),
      },
    ];
  });
}

/** One series' segment of a stacked bar, as values from `y0` to `y1`. */
export type Segment = {seriesIndex: number; y0: number; y1: number};

/**
 * Rectangles for stacked bars, one per segment, keyed by series. Every
 * segment of a slot spans the whole bar group. A segment that does not start
 * at 0 is pulled back from its neighbour by `series.stackGap`, a thin
 * surface-colored seam that keeps adjacent segments distinct.
 */
export function stackedBarRects(
  stacks: readonly (readonly Segment[])[],
  layout: PlotLayout,
): Map<number, BarRect[]> {
  const rects = new Map<number, BarRect[]>();
  const gap = tokens.series.stackGap;
  const slots = visibleSlots(stacks.length, layout, (slot) => {
    const segments = stacks[slot] ?? [];
    return segments.length === 0
      ? null
      : segments.reduce((sum, {y0, y1}) => sum + Math.abs(y1 - y0), 0);
  });
  slots.forEach((slot) => {
    const segments = stacks[slot] ?? [];
    const span = barSpan(layout, slot, 0, true);
    if (!span) return;
    for (const {seriesIndex, y0, y1} of segments) {
      const start = layout.y(y0);
      const end = layout.y(y1);
      // Pixel y grows downward: a positive segment's start is below its end.
      const direction = Math.sign(start - end);
      const inset =
        y0 === 0 ? 0 : Math.min(gap, Math.abs(start - end)) * direction;
      const from = start - inset;
      const list = rects.get(seriesIndex) ?? [];
      list.push({
        slot,
        ...span,
        y: round(Math.min(from, end)),
        height: round(Math.abs(end - from)),
      });
      rects.set(seriesIndex, list);
    }
  });
  return rects;
}
