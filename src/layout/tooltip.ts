// Where the hover tooltip goes: fixed height, centred on the hovered slot.

/** A vertical range, in the same coordinates as the tooltip. */
export type VerticalRange = {top: number; bottom: number};

/** Everything {@link tooltipLeft} needs, in the container's coordinates. */
export type TooltipPlacement = {
  /** The crosshair's x. */
  anchor: number;
  /** The tooltip's measured size and its fixed top. */
  width: number;
  height: number;
  top: number;
  /** The container the tooltip must stay inside. */
  containerWidth: number;
  containerHeight: number;
  /** The hovered markers' extent, which the tooltip must not cover; null for none. */
  avoid: VerticalRange | null;
  /** Space between the crosshair and a tooltip placed beside it. */
  sideGap: number;
};

/**
 * The left edge for a box of `boxWidth` centred on `center`, kept inside
 * `[0, containerWidth]`.
 */
export function clampedLeft(
  center: number,
  boxWidth: number,
  containerWidth: number,
): number {
  const left = Math.min(center - boxWidth / 2, containerWidth - boxWidth);
  return Math.max(0, left);
}

/** Where the tooltip's top-left corner goes, in the container's coordinates. */
export type TooltipPosition = {left: number; top: number};

/**
 * The tooltip's position, in order of preference: at its fixed top, centred
 * on the crosshair and kept inside the container; if that would hide the
 * hovered points, beside the crosshair (right, else left); with no room
 * beside it, centred just above the points, or below them if there is no
 * room above; with no room either, back at its fixed top over the points.
 *
 * The tooltip never extends past the container's bottom: overflowing it can
 * add a page scrollbar, which narrows the chart and moves the tooltip again.
 */
export function tooltipPosition(placement: TooltipPlacement): TooltipPosition {
  const {anchor, width, height, containerWidth, containerHeight} = placement;
  const {avoid, sideGap} = placement;
  const top = Math.max(0, Math.min(placement.top, containerHeight - height));
  const left = clampedLeft(anchor, width, containerWidth);
  const covers = (atLeft: number, atTop: number): boolean =>
    avoid !== null &&
    avoid.bottom >= atTop &&
    avoid.top <= atTop + height &&
    atLeft <= anchor &&
    anchor <= atLeft + width;
  if (!covers(left, top)) return {left, top};
  const right = anchor + sideGap;
  if (right + width <= containerWidth) return {left: right, top};
  const beside = anchor - sideGap - width;
  if (beside >= 0) return {left: beside, top};
  // `covers` was true, so `avoid` is set.
  const points = avoid ?? {top, bottom: top};
  const above = points.top - sideGap - height;
  if (above >= 0) return {left, top: above};
  const below = points.bottom + sideGap;
  return {left, top: below + height <= containerHeight ? below : top};
}
