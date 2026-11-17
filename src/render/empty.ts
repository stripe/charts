import {html} from './dom';
import {BAR_CHART_GLYPH, glyph} from './icons';

/** An empty plot area showing `message` (the spec's `emptyMessage`). */
export function renderEmpty(doc: Document, message: string): HTMLElement {
  const area = html(doc, 'div', 'sc-plot-area');
  const content = html(doc, 'div', 'sc-empty');
  const icon = html(doc, 'span', 'sc-empty-icon');
  icon.appendChild(glyph(doc, BAR_CHART_GLYPH));
  content.append(icon, html(doc, 'p', 'sc-empty-message', message));
  area.appendChild(content);
  return area;
}
