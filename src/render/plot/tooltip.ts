import type {ResolvedSpec} from '../../defaults';
import {formatDate, formatValue} from '../../format';
import type {ChartModel, SlotPoint} from '../../model';
import type {PointKind} from '../../options';
import {html} from '../dom';
import {lineSwatch} from '../series';
import {MESSAGES} from '../messages';

/** One series' entry at a slot. */
export type TooltipRow = {
  seriesIndex: number;
  label: string;
  comparison: boolean;
  /**
   * This series' own date in full, when it differs from the heading's.
   * Announced, not shown.
   */
  ownDate: string | null;
  value: string;
  kind: PointKind;
  /** "Incomplete" or "Forecast" for points that are not final values. */
  tag: string | null;
  /** A forecast point's low to high range, when it has one. */
  range: string | null;
  /** An incomplete point's projected end value, when it has one. */
  projected: string | null;
};

/** An annotation covering the slot, listed below the rows. */
export type TooltipNote = {
  label: string;
  description?: string;
  series?: string;
};

const TAGS = {
  actual: null,
  incomplete: MESSAGES.incomplete,
  forecast: MESSAGES.forecast,
} as const;

export type TooltipContent = {
  date: string;
  rows: TooltipRow[];
  annotations: TooltipNote[];
};

/**
 * Points in the order the tooltip lists them: series order, or for stacked
 * bars the visual order, top segment first, so rows read like the bar.
 * Series the legend hides are left out.
 */
export function rowOrder(model: ChartModel, slotIndex: number): SlotPoint[] {
  const slot = model.slots[slotIndex];
  if (!slot) return [];
  const present = slot.points.filter(
    (point) => point.x !== null && !model.series[point.seriesIndex].hidden,
  );
  if (!model.stacked) return present;
  const stacked = slot.stack.flatMap(
    ({seriesIndex}) => present.find((p) => p.seriesIndex === seriesIndex) ?? [],
  );
  return [...stacked, ...present.filter((point) => !stacked.includes(point))];
}

/**
 * The tooltip text for `slotIndex`. The heading is the primary series' date
 * in the short header style (`Oct 12`, `Oct 12, 6 AM`), the same series the
 * x axis is labelled from. A series with no point at this slot is left out.
 */
export function tooltipContent(
  model: ChartModel,
  spec: ResolvedSpec,
  slotIndex: number,
): TooltipContent {
  const slot = model.slots[slotIndex];
  const points = rowOrder(model, slotIndex);
  const heading =
    slot?.points.find(
      (point) =>
        point.x !== null && !model.series[point.seriesIndex].comparison,
    ) ?? points[0];
  const headingX = heading?.x ?? null;
  const dateOptions = {locale: spec.locale, timeZone: spec.timeZone};
  const format = (value: number): string =>
    formatValue(value, spec.format, spec.locale);
  const fallbackHeader =
    headingX === null
      ? ''
      : formatDate(headingX, {...dateOptions, style: 'tooltipHeader'});
  return {
    date: slot?.headerLabel || fallbackHeader,
    rows: points.map((point) => {
      const series = model.series[point.seriesIndex];
      return {
        seriesIndex: point.seriesIndex,
        label: series.label,
        comparison: series.comparison,
        ownDate:
          point.x !== null && point.x !== headingX
            ? formatDate(point.x, {...dateOptions, style: 'tooltip'})
            : null,
        value: point.y === null ? MESSAGES.noValue : format(point.y),
        kind: point.kind,
        tag: TAGS[point.kind],
        range:
          point.low === null || point.high === null
            ? null
            : `${format(point.low)}\u2013${format(point.high)}`,
        projected: point.projected === null ? null : format(point.projected),
      };
    }),
    annotations: (slot?.annotations ?? []).flatMap((index) => {
      const {label, description, seriesIndex} = model.annotations[index];
      const series =
        seriesIndex === null ? undefined : model.series[seriesIndex];
      if (series?.hidden) return [];
      return [
        {
          label,
          ...(description === null ? {} : {description}),
          ...(series ? {series: series.label} : {}),
        },
      ];
    }),
  };
}

/** The same content as one sentence, for screen reader announcements. */
export function tooltipAnnouncement(content: TooltipContent): string {
  const rows = content.rows.map((row) => {
    const label =
      row.ownDate === null ? row.label : `${row.label} (${row.ownDate})`;
    const value =
      row.projected === null
        ? row.value
        : `${row.value} ${MESSAGES.soFar}, ${MESSAGES.onPaceFor} ${row.projected}`;
    const notes = [row.tag, row.range].filter(Boolean).join(', ');
    return notes === ''
      ? `${label}: ${value}`
      : `${label}: ${value} (${notes})`;
  });
  const annotations = content.annotations.map((note) => {
    const text =
      note.description === undefined
        ? note.label
        : `${note.label}: ${note.description}`;
    return note.series === undefined ? text : `${note.series}: ${text}`;
  });
  return [content.date, ...rows, ...annotations].join('. ');
}

/**
 * Replaces `tooltip`'s children with `content`. In line charts a swatch is
 * dashed like its line: a comparison series' dash, or a forecast point's.
 * Bar charts' swatches are solid, like their bars.
 */
export function fillTooltip(
  tooltip: HTMLElement,
  content: TooltipContent,
  colors: readonly string[],
  dashed: boolean,
): void {
  const doc = tooltip.ownerDocument;
  tooltip.classList.toggle(
    'sc-tooltip-annotated',
    content.annotations.length > 0,
  );
  const rows = html(doc, 'div', 'sc-tooltip-rows');
  for (const row of content.rows) {
    const swatch = lineSwatch(
      doc,
      colors[row.seriesIndex],
      row.comparison && dashed,
    );
    if (dashed && row.kind === 'forecast') swatch.classList.add('sc-forecast');
    const label = html(doc, 'span', 'sc-tooltip-label', row.label);
    if (row.tag !== null)
      label.appendChild(html(doc, 'span', 'sc-tooltip-tag', row.tag));
    const value = html(doc, 'span', 'sc-tooltip-value', row.value);
    if (row.projected !== null)
      value.appendChild(html(doc, 'span', 'sc-tooltip-tag', MESSAGES.soFar));
    rows.append(swatch, label, value);
    if (row.range !== null)
      rows.appendChild(html(doc, 'span', 'sc-tooltip-range', row.range));
    if (row.projected !== null)
      rows.appendChild(
        html(
          doc,
          'span',
          'sc-tooltip-range',
          `${MESSAGES.onPaceFor} ${row.projected}`,
        ),
      );
  }
  const children: HTMLElement[] = [
    html(doc, 'p', 'sc-tooltip-date', content.date),
    rows,
  ];
  if (content.annotations.length > 0) {
    const notes = html(doc, 'div', 'sc-tooltip-notes');
    for (const note of content.annotations) {
      const item = html(doc, 'p', 'sc-tooltip-note');
      if (note.series !== undefined)
        item.appendChild(
          html(doc, 'span', 'sc-tooltip-note-label', note.series),
        );
      item.appendChild(
        html(
          doc,
          'span',
          note.series === undefined
            ? 'sc-tooltip-note-label'
            : 'sc-tooltip-note-description',
          note.label,
        ),
      );
      if (note.description !== undefined)
        item.appendChild(
          html(doc, 'span', 'sc-tooltip-note-description', note.description),
        );
      notes.appendChild(item);
    }
    children.push(notes);
  }
  tooltip.replaceChildren(...children);
}

/**
 * Replaces `tooltip`'s children with the caller's own content: a node as
 * is, a string as text (never parsed as markup).
 */
export function fillCustomTooltip(
  tooltip: HTMLElement,
  content: Node | string,
): void {
  if (typeof content === 'string') tooltip.textContent = content;
  // A caller may hand back the same node each time (a framework renders
  // into it); moving it out and back would be a needless DOM mutation.
  else if (tooltip.childNodes.length !== 1 || tooltip.firstChild !== content)
    tooltip.replaceChildren(content);
}
