import type {ResolvedSpec} from '../../defaults';
import {formatDate, formatValue} from '../../format';
import type {ChartModel} from '../../model';

export type TableColumn = {
  label: string;
  comparison: boolean;
};

export type TableCell = {
  value: string | null;
  /**
   * The point's own date, for comparison series: it lines up with the row
   * by position, so it can be a different day than the row's.
   */
  date: string | null;
  range: string | null;
  /** An incomplete point's projected end value, when it has one. */
  projected: string | null;
};

export type RowStatus = 'forecast' | 'incomplete';

export type TableRow = {
  date: string | null;
  cells: TableCell[];
  status: RowStatus | null;
};

export type DataTable = {
  columns: TableColumn[];
  rows: TableRow[];
  hasStatus: boolean;
  /**
   * Each column's longest text, as one row: laid out with the first rows,
   * it gives the columns their final widths before the rest are added.
   */
  widest: TableRow;
};

const textLength = (cell: TableCell): number =>
  (cell.value ?? '').length +
  (cell.date ?? '').length +
  (cell.range ?? '').length +
  (cell.projected ?? '').length;

function longest<T>(
  items: readonly T[],
  length: (item: T) => number,
): T | undefined {
  let best: T | undefined;
  for (const item of items)
    if (best === undefined || length(item) > length(best)) best = item;
  return best;
}

/** One row with each column's longest date, cells and status. */
function widestRow(rows: readonly TableRow[], columnCount: number): TableRow {
  const empty: TableCell = {
    value: null,
    date: null,
    range: null,
    projected: null,
  };
  return {
    date:
      longest(
        rows.map((row) => row.date ?? ''),
        (text) => text.length,
      ) ?? null,
    cells: Array.from(
      {length: columnCount},
      (_, column) =>
        longest(
          rows.map((row) => row.cells[column] ?? empty),
          textLength,
        ) ?? empty,
    ),
    status:
      longest(
        rows.flatMap((row) => (row.status ? [row.status] : [])),
        (status) => status.length,
      ) ?? null,
  };
}

export type DetailsNote = {
  label: string;
  when: string;
  description: string | null;
};

export function dataTable(model: ChartModel, spec: ResolvedSpec): DataTable {
  const dateOptions = {
    style: model.headerStyle,
    locale: spec.locale,
    timeZone: spec.timeZone,
  };
  const value = (y: number): string => formatValue(y, spec.format, spec.locale);
  const rows = model.slots.map((slot): TableRow => {
    const kinds = slot.points.map((point) => point.kind);
    let status: RowStatus | null = null;
    if (kinds.includes('forecast')) status = 'forecast';
    else if (kinds.includes('incomplete')) status = 'incomplete';
    return {
      date: slot.headerLabel || null,
      cells: slot.points.map((point) => ({
        value: point.y === null ? null : value(point.y),
        date:
          point.x !== null && model.series[point.seriesIndex].comparison
            ? formatDate(point.x, dateOptions)
            : null,
        range:
          point.low !== null && point.high !== null
            ? `${value(point.low)}\u2013${value(point.high)}`
            : null,
        projected: point.projected === null ? null : value(point.projected),
      })),
      status,
    };
  });
  return {
    columns: model.series.map(({label, comparison}) => ({label, comparison})),
    rows,
    hasStatus: rows.some((row) => row.status !== null),
    widest: widestRow(rows, model.series.length),
  };
}

export function detailsNotes(model: ChartModel): DetailsNote[] {
  const date = (index: number): string => model.slots[index]?.headerLabel ?? '';
  return model.annotations.map((annotation) => {
    const series =
      annotation.seriesIndex === null
        ? null
        : model.series[annotation.seriesIndex]?.label ?? null;
    let when =
      annotation.kind === 'range' && annotation.to !== annotation.from
        ? `${date(annotation.from)} \u2013 ${date(annotation.to)}`
        : date(annotation.from);
    if (series !== null) when = `${series}, ${when}`;
    return {label: annotation.label, when, description: annotation.description};
  });
}
