import type {ResolvedSpec} from '../defaults';
import {html} from './dom';

/** Parts of the header that the chart builds separately. */
export type HeaderParts = {
  titleId: string;
  /** The details trigger, placed after the title. */
  trigger: HTMLElement | null;
  /** The KPI row. */
  kpi: HTMLElement | null;
  /** True for the KPI-only tile, where the KPI comes before the description. */
  tile: boolean;
};

/** Builds the header block. */
export function renderHeader(
  doc: Document,
  spec: ResolvedSpec,
  {titleId, trigger, kpi, tile}: HeaderParts,
): HTMLElement {
  const header = html(doc, 'div', 'sc-header');
  const titleRow = html(doc, 'div', 'sc-title-row');
  const title = html(doc, 'span', 'sc-title', spec.title);
  title.id = titleId;
  titleRow.appendChild(title);
  if (trigger) titleRow.appendChild(trigger);
  header.appendChild(titleRow);

  const description =
    spec.description !== undefined
      ? html(doc, 'p', 'sc-description', spec.description)
      : null;
  const order = tile ? [kpi, description] : [description, kpi];
  for (const part of order) if (part) header.appendChild(part);
  return header;
}
