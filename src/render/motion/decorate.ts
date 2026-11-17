import type {PlotLayout} from '../../layout/plot';
import {tokens} from '../../tokens';
import {svg} from '../dom';
import type {PlotFrame} from './plotTransition';
import {ANNOTATIONS, AXES, MARKS, SERIES_ATTRIBUTE} from './selectors';

/**
 * Clips `target` to `share` of the plot's width, from the left. A clip
 * rather than an animated dash offset, so the comparison line keeps its
 * dash pattern and line joins are drawn exactly as at rest.
 */
function reveal(
  defs: SVGDefsElement,
  target: SVGElement,
  layout: PlotLayout,
  share: number,
  clipId: string,
): void {
  const doc = defs.ownerDocument;
  // Round caps reach half a stroke past the first and last points, and
  // values at the top or bottom of the domain sit on the plot's edges.
  const bleed = tokens.series.strokeWidth;
  const clip = svg(doc, 'clipPath', {id: clipId});
  clip.appendChild(
    svg(doc, 'rect', {
      x: -bleed,
      y: -bleed,
      width: Math.max(0, share * (layout.plot.width + 2 * bleed)),
      height: layout.height + 2 * bleed,
    }),
  );
  defs.appendChild(clip);
  target.setAttribute('clip-path', `url(#${clipId})`);
}

function revealSeries(
  element: SVGSVGElement,
  marks: SVGGElement,
  layout: PlotLayout,
  reveals: readonly number[],
  clipId: string,
): void {
  if (!reveals.some((share) => share < 1)) return;
  const defs = svg(element.ownerDocument, 'defs');
  element.insertBefore(defs, element.firstChild);
  const series = [
    ...marks.querySelectorAll<SVGElement>(`[${SERIES_ATTRIBUTE}]`),
  ];
  if (series.length === 0) {
    reveal(defs, marks, layout, reveals[0] ?? 1, clipId);
    return;
  }
  for (const mark of series) {
    const index = Number(mark.getAttribute(SERIES_ATTRIBUTE));
    const share = reveals[index] ?? 1;
    if (share < 1) reveal(defs, mark, layout, share, `${clipId}-${index}`);
  }
}

export function decoratePlot(
  element: SVGSVGElement,
  layout: PlotLayout,
  frame: PlotFrame,
  outgoing: SVGGElement | null,
  clipId: string,
): void {
  const marks = element.querySelector<SVGGElement>(MARKS);
  if (!marks) return;
  revealSeries(element, marks, layout, frame.reveals, clipId);
  frame.seriesOpacity.forEach((opacity, index) => {
    if (opacity >= 1) return;
    const mark = marks.querySelector<SVGElement>(
      `[${SERIES_ATTRIBUTE}="${index}"]`,
    );
    if (mark) mark.style.opacity = String(opacity);
  });
  if (frame.annotationOpacity < 1) {
    for (const group of element.querySelectorAll<SVGGElement>(ANNOTATIONS)) {
      group.style.opacity = String(frame.annotationOpacity);
    }
  }
  if (frame.axesOpacity < 1) {
    for (const group of element.querySelectorAll<SVGGElement>(AXES)) {
      group.style.opacity = String(frame.axesOpacity);
    }
  }
  if (outgoing && frame.outgoingOpacity > 0) {
    outgoing.style.opacity = String(frame.outgoingOpacity);
    marks.before(outgoing);
  }
}

/**
 * A copy of the marks currently drawn in `root`, to cross-fade from, or
 * null when there are none. Its clip is dropped: the clip path it refers to
 * goes away with the old plot.
 */
export function captureMarks(root: HTMLElement): SVGGElement | null {
  const marks = root.querySelector<SVGGElement>(MARKS);
  if (!marks) return null;
  // `cloneNode` is typed as returning a Node, but a deep copy of an element
  // is an element of the same type.
  const copy = marks.cloneNode(true) as SVGGElement;
  for (const node of [copy, ...copy.querySelectorAll('[clip-path]')]) {
    node.removeAttribute('clip-path');
  }
  copy.removeAttribute('class');
  copy.setAttribute('aria-hidden', 'true');
  return copy;
}
