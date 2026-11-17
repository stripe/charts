// The x axis's inputs from a chart. Pure, so the chart and axis tests build
// the same inputs.

import type {ResolvedSpec} from '../defaults';
import type {DateStyle} from '../format';
import {formatDate} from '../format';
import {parseIsoDate} from '../isoDate';
import type {ChartModel} from '../model';
import type {TickLabelKind, XTick} from './xAxis';

// Calendar days are formatted and stepped in UTC so they never shift.
const CALENDAR_DAY_ZONE = 'UTC';

/** The date style each kind of tick is formatted in. */
const TICK_STYLES: Record<TickLabelKind, DateStyle> = {
  time: 'axisTime',
  date: 'axis',
  dateYear: 'axisDateYear',
  month: 'axisMonth',
  monthYear: 'axisMonthYear',
  year: 'axisYear',
};

/** The x axis's view of the data: one instant per slot and their zone. */
export type XAxisData = {
  times: (number | null)[];
  timeZone: string;
  calendarDays: boolean;
};

/** One instant per slot from the primary series, and the zone to step them in. */
export function xAxisData(model: ChartModel, spec: ResolvedSpec): XAxisData {
  const primary = model.series.findIndex((s) => !s.comparison);
  const labelSeries = primary === -1 ? 0 : primary;
  const parsed = model.slots.map((slot) => {
    const x = slot.points[labelSeries]?.x ?? null;
    return x === null ? null : parseIsoDate(x);
  });
  const calendarDays = parsed.every(
    (date) => date === null || date.kind === 'date',
  );
  return {
    times: parsed.map((date) => date?.time ?? null),
    timeZone: calendarDays ? CALENDAR_DAY_ZONE : spec.timeZone,
    calendarDays,
  };
}

/**
 * A tick's instant as an x value: a calendar date (`2026-11-27`) for
 * calendar-day data, else an ISO date-time in UTC.
 */
export function tickX(axis: XAxisData, time: number): string {
  const iso = new Date(time).toISOString();
  return axis.calendarDays ? iso.slice(0, iso.indexOf('T')) : iso;
}

/** Formats an x tick from the instant the layout chose. */
export function tickFormatter(
  axis: XAxisData,
  spec: ResolvedSpec,
): (tick: XTick) => string {
  return ({time, kind}) =>
    // A calendar day is passed as a date so it is formatted as-is.
    formatDate(tickX(axis, time), {
      style: TICK_STYLES[kind],
      locale: spec.locale,
      timeZone: spec.timeZone,
    });
}
