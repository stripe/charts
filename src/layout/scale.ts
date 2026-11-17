// Scales: map data values and slot indices to pixel positions.

/** Maps a value to a pixel position. */
export type LinearScale = (value: number) => number;

/**
 * A linear map from `domain` to `range`. A zero-width domain maps every
 * value to the middle of the range rather than dividing by zero.
 */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  if (span === 0) return () => (r0 + r1) / 2;
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

/**
 * How slots are placed across the plot. Lines use `"point"`: the first and
 * last points sit on the plot edges. Bars use
 * `"band"`: each slot owns an equal share of the width.
 */
export type SlotMode = 'point' | 'band';

/** Positions of the shared x slots. */
export type SlotScale = {
  /** Distance between neighbouring slot centres. */
  step: number;
  /** Centre of slot `index`. */
  center(index: number): number;
  /** The slot nearest to `x`, clamped to the existing slots. */
  indexAt(x: number): number;
};

/** Places `count` slots across `[0, width]`. */
export function slotScale(
  count: number,
  width: number,
  mode: SlotMode,
): SlotScale {
  const last = Math.max(0, count - 1);
  const clampIndex = (index: number): number =>
    Math.min(last, Math.max(0, index));

  if (mode === 'band' || count <= 1) {
    const step = count > 0 ? width / count : width;
    return {
      step,
      center: (index) => (index + 1 / 2) * step,
      indexAt: (x) => clampIndex(Math.floor(x / step)),
    };
  }
  const step = width / last;
  return {
    step,
    center: (index) => index * step,
    indexAt: (x) => clampIndex(Math.round(x / step)),
  };
}

/** One series' bar inside a slot's group. */
export type BarBand = {
  /** Left edge relative to the slot centre. */
  offset: number;
  width: number;
};

/**
 * Splits a slot's bar group between series. The group takes `groupRatio`
 * of the slot, centred, and its series sit side by side with no gap, in
 * series order.
 * When that would make a bar narrower than `minWidth`, the gaps between
 * slots shrink until the bars reach it or touch, like a histogram. When
 * bars get thinner still, the plot overlays them in whole-pixel slot
 * columns instead (see {@link slotPixels}).
 */
export function barBands(
  step: number,
  seriesCount: number,
  groupRatio: number,
  minWidth: number,
): BarBand[] {
  const count = Math.max(1, seriesCount);
  const groupWidth = Math.min(
    step,
    Math.max(step * groupRatio, minWidth * count),
  );
  const width = groupWidth / count;
  return Array.from({length: seriesCount}, (_, i) => ({
    offset: -groupWidth / 2 + i * width,
    width,
  }));
}

/** A horizontal run of whole pixels. */
export type PixelSpan = {x: number; width: number};

/**
 * Slot `index`'s whole-pixel span, for bars too thin to sit side by side:
 * from round(index * step) to round((index + 1) * step). Neighbouring slots
 * share their boundary, so slots tile the plot with no gap or overlap, and
 * each is the floor or ceiling of the step, the rounding error carried
 * from slot to slot as in Bresenham's line algorithm.
 */
export function slotPixels(index: number, step: number): PixelSpan {
  const x = Math.round(index * step);
  return {x, width: Math.round((index + 1) * step) - x};
}

/**
 * Snaps a line position so a stroke of `strokeWidth` covers whole device
 * pixels: odd widths sit on a half pixel, even widths on a whole one.
 * Without this a 1px gridline is smeared over two pixel rows.
 */
export function crisp(position: number, strokeWidth: number): number {
  const offset = strokeWidth % 2 === 1 ? 1 / 2 : 0;
  return Math.round(position - offset) + offset;
}
