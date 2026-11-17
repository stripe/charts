import {svg} from './dom';

/** A glyph: its drawing box and path data (even-odd fill). */
type Glyph = {viewBox: string; path: string};

/** "i" in a rounded square: the trigger for the details view. */
export const INFO_GLYPH: Glyph = {
  viewBox: '0 0 12 12',
  path:
    'M3 0h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3Z' +
    'M3 1.5A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h6A1.5 1.5 0 0 0 10.5 9V3A1.5 1.5 0 0 0 9 1.5Z' +
    'M5.25 5.25h1.5V9h-1.5Z' +
    'M6 2.5a.875.875 0 1 1 0 1.75.875.875 0 0 1 0-1.75Z',
};

/** Bars on axes: the empty state. */
export const BAR_CHART_GLYPH: Glyph = {
  viewBox: '0 0 16 16',
  path:
    'M2 2h1.5v10.5H14V14H2Z' +
    'M5.5 7H7v4H5.5Z' +
    'M8.5 4H10v7H8.5Z' +
    'M11.5 8.5H13V11h-1.5Z',
};

/** Exclamation in a triangle: the error card. */
export const WARNING_GLYPH: Glyph = {
  viewBox: '0 0 16 16',
  path:
    'M8 1l7.5 13.5H.5Z' +
    'M8 4.1L3.05 13h9.9Z' +
    'M7.25 6.5h1.5V10h-1.5Z' +
    'M8 10.75a.875.875 0 1 1 0 1.75.875.875 0 0 1 0-1.75Z',
};

/** Draws a glyph. Decorative: hidden from assistive technology. */
export function glyph(doc: Document, {viewBox, path}: Glyph): SVGSVGElement {
  const element = svg(doc, 'svg', {
    viewBox,
    'aria-hidden': 'true',
    focusable: 'false',
  });
  element.appendChild(svg(doc, 'path', {d: path, 'fill-rule': 'evenodd'}));
  return element;
}
