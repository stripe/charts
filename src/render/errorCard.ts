import type {SpecIssue} from '../spec';
import {html} from './dom';
import {WARNING_GLYPH, glyph} from './icons';
import {MESSAGES} from './messages';
import {ensureStylesheet} from './styles';

/**
 * Draws a card listing each issue as `path: message` into `element`.
 * `destroy()` removes it.
 */
export function renderErrorCard(
  element: HTMLElement,
  issues: readonly SpecIssue[],
): {destroy(): void} {
  ensureStylesheet(element);
  const doc = element.ownerDocument;
  const card = html(doc, 'div', 'sc-root sc-error');
  // An alert, so the failure is announced rather than silently replacing
  // the chart.
  card.setAttribute('role', 'alert');
  const icon = html(doc, 'span', 'sc-empty-icon');
  icon.appendChild(glyph(doc, WARNING_GLYPH));
  const list = html(doc, 'ul', 'sc-error-issues');
  for (const issue of issues) {
    const item = html(doc, 'li', '');
    item.append(
      html(doc, 'code', 'sc-error-path', issue.path),
      `: ${issue.message}`,
    );
    list.appendChild(item);
  }
  card.append(
    icon,
    html(doc, 'p', 'sc-error-title', MESSAGES.errorTitle),
    list,
  );
  element.appendChild(card);
  return {destroy: () => card.remove()};
}
