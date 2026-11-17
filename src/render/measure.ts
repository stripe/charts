import {tokens} from '../tokens';
import {html} from './dom';

/** Measures text in the axis label style. */
export type TextMeasurer = (text: string) => number;

// Used when the page cannot measure (the element is hidden, or there is no
// layout engine, as in tests): roughly the advance of a digit, in em.
const FALLBACK_CHARACTER_EM = 0.6;

// Widths by font, then by text, shared by every chart in a document. Each
// uncached measurement forces a layout, and charts on one page mostly show
// the same labels ("$0", "Nov 1"), so a page of many charts measures each
// label once instead of once per chart. Keyed by the resolved font, so
// charts themed with a different font or size never share widths.
const widthsByDocument = new WeakMap<
  Document,
  Map<string, Map<string, number>>
>();

function fontKey(style: CSSStyleDeclaration): string {
  return [
    style.fontStyle,
    style.fontWeight,
    style.fontSize,
    style.fontFamily,
    style.fontVariantNumeric,
    style.letterSpacing,
  ].join('|');
}

/**
 * A measurer backed by a hidden element inside `parent`. Widths are cached
 * per document and font, since the same labels are measured on every resize
 * and by every chart on the page.
 */
export function createTextMeasurer(parent: HTMLElement): TextMeasurer {
  const doc = parent.ownerDocument;
  const probe = html(doc, 'span', 'sc-measure');
  probe.setAttribute('aria-hidden', 'true');
  parent.appendChild(probe);
  let byFont = widthsByDocument.get(doc);
  if (!byFont) {
    const created = new Map<string, Map<string, number>>();
    byFont = created;
    widthsByDocument.set(doc, created);
    // A web font that finishes loading changes the widths of text set in
    // it, so everything measured before is forgotten. The maps are emptied
    // rather than replaced, since live measurers hold them.
    doc.fonts?.addEventListener('loadingdone', () => {
      for (const widths of created.values()) widths.clear();
    });
  }
  const fonts = byFont;
  // The font is read once, at the first measurement, when the probe's
  // styles apply; before the stylesheet or a font is known nothing is shared.
  let widths: Map<string, number> | null = null;
  const sharedWidths = (): Map<string, number> | null => {
    if (widths) return widths;
    const style = doc.defaultView?.getComputedStyle(probe);
    if (!style?.fontFamily) return null;
    const key = fontKey(style);
    widths = fonts.get(key) ?? new Map<string, number>();
    fonts.set(key, widths);
    return widths;
  };
  return (text) => {
    const cache = sharedWidths();
    const cached = cache?.get(text);
    if (cached !== undefined) return cached;
    probe.textContent = text;
    const measured = probe.getBoundingClientRect().width;
    // A hidden element measures 0; do not cache that, so the real width is
    // used once the chart is shown.
    if (measured > 0) {
      cache?.set(text, measured);
      return measured;
    }
    return text.length * tokens.axis.label.size * FALLBACK_CHARACTER_EM;
  };
}
