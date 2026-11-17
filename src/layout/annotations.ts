// Annotation geometry, kept inside the plot so nothing spills over the axes.

import type {LinearScale, SlotScale} from './scale';
import {crisp} from './scale';

/** An annotation resolved to slots (see the model). */
export type SlotAnnotation =
  | {kind: 'marker'; slot: number}
  | {kind: 'point'; slot: number; seriesIndex: number}
  /** Slots inclusive; null runs to that edge of the plot. */
  | {
      kind: 'range';
      from: number | null;
      to: number | null;
      wholeSlots?: boolean;
    };

/** What annotation geometry needs from the plot layout. */
export type AnnotationScales = {
  x: SlotScale;
  y: LinearScale;
  plot: {top: number; bottom: number; width: number};
};

/** A shaded range, in whole pixels. */
export type RangeBox = {index: number; x: number; width: number};
/** A vertical marker line, on a crisp pixel. */
export type MarkerLine = {index: number; x: number};
/** A point marker's centre. */
export type PointMark = {
  index: number;
  seriesIndex: number;
  x: number;
  y: number;
};

/** Placed annotations, each keeping its index in the input list. */
export type AnnotationGeometry = {
  ranges: RangeBox[];
  markers: MarkerLine[];
  points: PointMark[];
};

/**
 * Lays out `annotations`. `valueAt(slot, seriesIndex)` is the value a point
 * marker sits on (a line's value, a bar's top); points without a value, and
 * markers or ranges entirely outside the plot, are left out.
 * `lineWidth` is the marker stroke, for pixel alignment.
 */
export function layoutAnnotations(
  annotations: readonly SlotAnnotation[],
  scales: AnnotationScales,
  valueAt: (slot: number, seriesIndex: number) => number | null,
  lineWidth: number,
): AnnotationGeometry {
  const {x, y, plot} = scales;
  const geometry: AnnotationGeometry = {ranges: [], markers: [], points: []};
  const inside = (position: number): boolean =>
    position >= 0 && position <= plot.width;
  annotations.forEach((annotation, index) => {
    if (annotation.kind === 'range') {
      // Incomplete periods cover whole slots; explicit annotation bounds
      // sit at their dates, like a vertical marker.
      const padding = annotation.wholeSlots ? x.step / 2 : 0;
      const left =
        annotation.from === null ? 0 : x.center(annotation.from) - padding;
      const right =
        annotation.to === null ? plot.width : x.center(annotation.to) + padding;
      const start = Math.round(Math.max(0, left));
      const end = Math.round(Math.min(plot.width, right));
      if (end > start)
        geometry.ranges.push({index, x: start, width: end - start});
      if (!annotation.wholeSlots) {
        const boundaries = new Set([annotation.from, annotation.to]);
        for (const slot of boundaries) {
          if (slot !== null && inside(x.center(slot)))
            geometry.markers.push({index, x: crisp(x.center(slot), lineWidth)});
        }
      }
      return;
    }
    const center = x.center(annotation.slot);
    if (!inside(center)) return;
    if (annotation.kind === 'marker') {
      geometry.markers.push({index, x: crisp(center, lineWidth)});
      return;
    }
    const value = valueAt(annotation.slot, annotation.seriesIndex);
    if (value === null) return;
    const pointY = Math.min(plot.bottom, Math.max(plot.top, y(value)));
    geometry.points.push({
      index,
      seriesIndex: annotation.seriesIndex,
      x: center,
      y: pointY,
    });
  });
  return geometry;
}
