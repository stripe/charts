const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Creates an HTML element in `doc` with a class and, optionally, text.
 * `text` is set with `textContent`, so markup in it is shown literally.
 */
export function html<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = doc.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** Creates an SVG element with attributes. Values are set as plain strings. */
export function svg<K extends keyof SVGElementTagNameMap>(
  doc: Document,
  tag: K,
  attributes: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const element = doc.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
}

/**
 * Creates an element that is announced by assistive technology but takes
 * no space on screen.
 */
export function visuallyHidden(doc: Document, text = ''): HTMLDivElement {
  return html(doc, 'div', 'sc-visually-hidden', text);
}

/**
 * How far `clientX` is from the element's left edge, in the element's own
 * layout pixels. Under a scaled ancestor the pointer and the element's rect
 * are in viewport pixels, while layout geometry uses the unscaled width.
 */
export function layoutOffsetX(element: HTMLElement, clientX: number): number {
  const rect = element.getBoundingClientRect();
  const scale = element.offsetWidth > 0 ? rect.width / element.offsetWidth : 1;
  return (clientX - rect.left) / (scale || 1);
}
