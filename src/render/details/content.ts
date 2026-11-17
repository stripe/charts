import type {ResolvedSpec} from '../../defaults';
import {formatDateTime} from '../../format';
import type {Provenance} from '../../spec';
import {html, visuallyHidden} from '../dom';
import {MESSAGES} from '../messages';
import type {
  DataTable,
  DetailsNote,
  RowStatus,
  TableCell,
  TableRow,
} from './tableModel';

function entry(doc: Document, label: string, value: string): HTMLElement {
  const group = html(doc, 'div', 'sc-details-entry');
  group.append(html(doc, 'dt', '', label), html(doc, 'dd', '', value));
  return group;
}

function provenanceList(
  doc: Document,
  provenance: Provenance,
  spec: ResolvedSpec,
): HTMLElement {
  const list = html(doc, 'dl', 'sc-details-list');
  list.appendChild(entry(doc, MESSAGES.source, provenance.source));
  if (provenance.fetchedAt !== undefined) {
    list.appendChild(
      entry(
        doc,
        MESSAGES.fetchedAt,
        formatDateTime(provenance.fetchedAt, spec.locale, spec.timeZone),
      ),
    );
  }
  for (const detail of provenance.details ?? []) {
    list.appendChild(entry(doc, detail.label, detail.value));
  }
  return list;
}

/**
 * A missing value: a dash on screen, words for assistive technology, which
 * would otherwise read the dash's name or nothing.
 */
function missing(doc: Document): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  const dash = html(doc, 'span', '', MESSAGES.missingValue);
  dash.setAttribute('aria-hidden', 'true');
  fragment.append(dash, visuallyHidden(doc, MESSAGES.noValue));
  return fragment;
}

function valueCell(doc: Document, cell: TableCell): HTMLTableCellElement {
  const td = html(doc, 'td', 'sc-table-value');
  if (cell.value === null) {
    td.appendChild(missing(doc));
    return td;
  }
  if (cell.projected !== null) {
    // Where an incomplete period is heading, under what it has so far.
    const stack = html(doc, 'span', 'sc-table-stack');
    stack.append(
      html(doc, 'span', '', cell.value),
      html(
        doc,
        'span',
        'sc-table-date',
        `${MESSAGES.soFar} \u00b7 ${MESSAGES.onPaceFor} ${cell.projected}`,
      ),
    );
    td.appendChild(stack);
    return td;
  }
  if (cell.range !== null) {
    const stack = html(doc, 'span', 'sc-table-stack');
    stack.append(
      html(doc, 'span', '', cell.value),
      html(doc, 'span', 'sc-table-date', cell.range),
    );
    td.appendChild(stack);
    return td;
  }
  if (cell.date === null) {
    td.textContent = cell.value;
    return td;
  }
  const pair = html(doc, 'span', 'sc-table-pair');
  pair.append(
    html(doc, 'span', 'sc-table-date', cell.date),
    html(doc, 'span', '', cell.value),
  );
  td.appendChild(pair);
  return td;
}

function headerCell(doc: Document, text: string): HTMLTableCellElement {
  const th = html(doc, 'th', '', text);
  th.scope = 'col';
  return th;
}

const STATUS_TEXT: Record<RowStatus, string> = {
  forecast: MESSAGES.forecast,
  incomplete: MESSAGES.incomplete,
};

function bodyRow(
  doc: Document,
  row: TableRow,
  hasStatus: boolean,
): HTMLTableRowElement {
  const tr = html(doc, 'tr', row.status ? `sc-table-${row.status}` : '');
  const th = html(doc, 'th', '');
  th.scope = 'row';
  if (row.date === null) th.appendChild(missing(doc));
  else th.textContent = row.date;
  tr.appendChild(th);
  for (const cell of row.cells) tr.appendChild(valueCell(doc, cell));
  if (hasStatus) {
    tr.appendChild(
      html(
        doc,
        'td',
        'sc-table-status',
        row.status ? STATUS_TEXT[row.status] : '',
      ),
    );
  }
  return tr;
}

export type TableFill = {
  element: HTMLTableElement;
  done(): boolean;
  fill(count: number): void;
};

function table(doc: Document, data: DataTable): TableFill {
  const element = html(doc, 'table', 'sc-table');
  element.appendChild(
    html(doc, 'caption', 'sc-visually-hidden', MESSAGES.dataTable),
  );
  const head = html(doc, 'thead', '');
  const headRow = html(doc, 'tr', '');
  headRow.appendChild(headerCell(doc, MESSAGES.date));
  for (const column of data.columns) {
    const th = headerCell(doc, column.label);
    th.className = 'sc-table-value';
    headRow.appendChild(th);
  }
  if (data.hasStatus) headRow.appendChild(headerCell(doc, MESSAGES.status));
  head.appendChild(headRow);
  const body = html(doc, 'tbody', '');
  // Takes no height and isn't read out, but sizes the columns for every
  // row from the start, so adding rows never re-measures the table.
  const sizer = html(doc, 'tbody', 'sc-table-sizer');
  sizer.setAttribute('aria-hidden', 'true');
  sizer.appendChild(bodyRow(doc, data.widest, data.hasStatus));
  element.append(head, body, sizer);

  let next = 0;
  return {
    element,
    done: () => next >= data.rows.length,
    fill(count) {
      const end = Math.min(data.rows.length, next + count);
      const rows = doc.createDocumentFragment();
      for (; next < end; next += 1)
        rows.appendChild(bodyRow(doc, data.rows[next], data.hasStatus));
      body.appendChild(rows);
    },
  };
}

export type DetailsContent = {
  spec: ResolvedSpec;
  table: DataTable | null;
  notes: readonly DetailsNote[];
};

function notesList(doc: Document, notes: readonly DetailsNote[]): HTMLElement {
  const section = html(doc, 'div', 'sc-details-notes');
  section.appendChild(html(doc, 'h4', 'sc-details-subheading', MESSAGES.notes));
  const list = html(doc, 'ul', 'sc-details-note-list');
  for (const note of notes) {
    const item = html(doc, 'li', 'sc-details-note');
    const title = html(doc, 'p', 'sc-details-note-title');
    title.append(
      html(doc, 'span', 'sc-details-note-label', note.label),
      html(doc, 'span', 'sc-details-note-when', note.when),
    );
    item.appendChild(title);
    if (note.description !== null) {
      item.appendChild(
        html(doc, 'p', 'sc-details-note-text', note.description),
      );
    }
    list.appendChild(item);
  }
  section.appendChild(list);
  return section;
}

export function detailsContent(
  doc: Document,
  {spec, table: data, notes}: DetailsContent,
): {content: HTMLElement; table: TableFill | null} {
  const content = html(doc, 'div', 'sc-details-content');
  if (spec.provenance) {
    content.appendChild(provenanceList(doc, spec.provenance, spec));
  }
  if (notes.length > 0) content.appendChild(notesList(doc, notes));
  const fill = data ? table(doc, data) : null;
  if (fill) {
    // Its own scroller, so when the view is too short only the rows scroll,
    // under a header that stays in view.
    const scroll = html(doc, 'div', 'sc-table-scroll');
    scroll.appendChild(fill.element);
    content.appendChild(scroll);
  }
  return {content, table: fill};
}
