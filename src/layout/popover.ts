// Where a floating panel goes next to the control that opened it: below if
// it fits, else above, else on the side with more room, never past the
// viewport's edges. Pure geometry in viewport pixels.

/** A rectangle in viewport pixels. */
export type Rect = {left: number; top: number; right: number; bottom: number};

/** What {@link placePopover} needs. */
export type PopoverInput = {
  /** The control the panel belongs to. */
  anchor: Rect;
  /** The panel's own size when nothing limits its height. */
  size: {width: number; height: number};
  viewport: {width: number; height: number};
  /** Space between the anchor and the panel. */
  offset: number;
  /** Space kept between the panel and the viewport's edges. */
  margin: number;
};

/** Where the panel goes. */
export type PopoverPlacement = {
  side: 'below' | 'above';
  left: number;
  top: number;
  /** The height the panel may take; smaller than its own when it doesn't fit. */
  maxHeight: number;
};

/**
 * Places a panel of `size` below or above `anchor`, aligned with its left
 * edge and shifted to stay inside the viewport.
 */
export function placePopover({
  anchor,
  size,
  viewport,
  offset,
  margin,
}: PopoverInput): PopoverPlacement {
  const below = viewport.height - margin - (anchor.bottom + offset);
  const above = anchor.top - offset - margin;
  let side: PopoverPlacement['side'];
  if (size.height <= below) side = 'below';
  else if (size.height <= above) side = 'above';
  else side = below >= above ? 'below' : 'above';
  const room = Math.max(0, side === 'below' ? below : above);
  const height = Math.min(size.height, room);
  const top =
    side === 'below' ? anchor.bottom + offset : anchor.top - offset - height;
  const rightmost = viewport.width - margin - size.width;
  const left = Math.max(margin, Math.min(anchor.left, rightmost));
  return {side, left, top, maxHeight: room};
}

/**
 * Converts a viewport position to the `left`/`top` a fixed-position panel
 * needs. Usually the viewport is its containing block and nothing changes,
 * but under a `transform`, `filter`, `contain` or `will-change` ancestor
 * that ancestor is, possibly scaled: `origin` is where the panel lands in
 * the viewport at `left: 0; top: 0`, and `scale` its rendered size over its
 * layout size.
 */
export function toContainingBlock(
  position: {left: number; top: number},
  origin: {left: number; top: number},
  scale: {x: number; y: number},
): {left: number; top: number} {
  return {
    left: (position.left - origin.left) / scale.x,
    top: (position.top - origin.top) / scale.y,
  };
}
