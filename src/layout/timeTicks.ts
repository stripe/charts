// Calendar ticks for a time axis: units, steps, boundaries and labels.

import {zonedParts, zonedTime} from './calendar';

/** Calendar units the axis can step by. */
export type TimeUnit = 'hour' | 'day' | 'week' | 'month' | 'year';

/**
 * How a tick is labelled: `"time"` is a time of day (`6 AM`), `"date"` a
 * short date (`Aug 1`), `"dateYear"` a date with its year (`Jan 4, 2027`),
 * `"month"` a month without a day (`Aug`), `"monthYear"` a month with its
 * year (`Feb 2027`), `"year"` the year alone (`2027`).
 */
export type TickLabelKind =
  'time' | 'date' | 'dateYear' | 'month' | 'monthYear' | 'year';

/** A tick before it is labelled. */
export type XTick = {time: number; kind: TickLabelKind};

/** A unit and how many of it lie between ticks. */
export type TickCandidate = {unit: TimeUnit; step: number};

const MS_PER_HOUR = 3_600_000;
/** Milliseconds in a day of elapsed time. */
export const MS_PER_DAY: number = 24 * MS_PER_HOUR;
const DAYS_PER_WEEK = 7;
const MONDAY = 1;

/**
 * Rough unit lengths, only to rule out units finer than the data and to
 * bound the work for a candidate; boundaries themselves are exact.
 */
export const APPROX_UNIT_MS: Record<TimeUnit, number> = {
  hour: MS_PER_HOUR,
  day: MS_PER_DAY,
  week: DAYS_PER_WEEK * MS_PER_DAY,
  month: 30 * MS_PER_DAY,
  year: 365 * MS_PER_DAY,
};

/**
 * Every unit and step an axis may use, finest to coarsest. Hour steps divide
 * a day; day steps stay under a week; month steps of 3 and 6 are calendar
 * quarters and halves.
 */
export const TICK_CANDIDATES: readonly TickCandidate[] = [
  ...[1, 2, 3, 6, 12].map((step) => ({unit: 'hour' as const, step})),
  ...[1, 2, 3].map((step) => ({unit: 'day' as const, step})),
  ...[1, 2].map((step) => ({unit: 'week' as const, step})),
  ...[1, 2, 3, 6].map((step) => ({unit: 'month' as const, step})),
  ...[1, 2, 5, 10, 20, 50, 100].map((step) => ({unit: 'year' as const, step})),
];

/**
 * A label granularity the caller may force instead of the automatic choice:
 * dates (`"day"`), months (`"month"`), years (`"year"`) or times of day
 * (`"time"`).
 */
export type ForcedGranularity = 'day' | 'month' | 'year' | 'time';

/**
 * The units and steps each forced granularity may use, finest to coarsest.
 * They go coarser than the automatic candidates (dates every 4 or 13 weeks,
 * one month a year) because a forced axis cannot switch to a coarser unit to
 * thin its labels.
 */
export const FORCED_TICK_CANDIDATES: Record<
  ForcedGranularity,
  readonly TickCandidate[]
> = {
  time: [1, 2, 3, 6, 12].map((step) => ({unit: 'hour', step})),
  day: [
    ...[1, 2, 3].map((step) => ({unit: 'day' as const, step})),
    ...[1, 2, 4, 13, 26].map((step) => ({unit: 'week' as const, step})),
  ],
  month: [1, 2, 3, 6, 12].map((step) => ({unit: 'month', step})),
  year: [1, 2, 5, 10, 20, 50, 100].map((step) => ({unit: 'year', step})),
};

// Month and year steps from these sizes snap to the calendar (quarters
// start in Jan, Apr, Jul, Oct; decades on years divisible by 10). Smaller
// steps start from the first boundary in the data.
const CALENDAR_ALIGNED_FROM: Partial<Record<TimeUnit, number>> = {
  month: 3,
  year: 1,
};

/**
 * More boundaries than this is never readable; skipping such candidates also
 * bounds the work for long ranges.
 */
export const MAX_BOUNDARIES = 2000;

/** Data spaced this far apart or more is monthly (months run 28 to 31 days). */
export const MONTHLY_RESOLUTION: number = 28 * MS_PER_DAY;

/** The typical distance between consecutive instants: the data's resolution. */
export function medianInterval(times: readonly number[]): number {
  const gaps = times
    .slice(1)
    .map((time, i) => time - times[i])
    .sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] ?? 0;
}

/** Every boundary of `unit` from `first` to `last`, in order. */
export function unitBoundaries(
  unit: TimeUnit,
  first: number,
  last: number,
  zone: string,
): number[] {
  const start = zonedParts(first, zone);
  const toMonday = (MONDAY - start.weekday + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const at = (offset: number): number => {
    switch (unit) {
      case 'hour':
        return zonedTime(
          zone,
          start.year,
          start.month,
          start.day,
          start.hour + offset,
        );
      case 'day':
        return zonedTime(zone, start.year, start.month, start.day + offset);
      case 'week':
        return zonedTime(
          zone,
          start.year,
          start.month,
          start.day + toMonday + offset * DAYS_PER_WEEK,
        );
      case 'month':
        return zonedTime(zone, start.year, start.month + offset);
      default:
        return zonedTime(zone, start.year + offset, 0);
    }
  };
  const times: number[] = [];
  for (let offset = 0; times.length <= MAX_BOUNDARIES; offset += 1) {
    const time = at(offset);
    if (time > last) break;
    // A wall time skipped by daylight saving resolves to the next one.
    if (time >= first && time !== times[times.length - 1]) times.push(time);
  }
  return times;
}

/** The value a calendar-aligned step is counted in (month of year, year). */
function calendarIndex(unit: TimeUnit, time: number, zone: string): number {
  const {year, month, hour} = zonedParts(time, zone);
  if (unit === 'month') return month;
  if (unit === 'year') return year;
  return hour;
}

/**
 * The boundaries a candidate keeps: every hour divisible by the step (12 AM,
 * 6 AM...), quarters and halves on the calendar, and other steps counted from
 * the first boundary in the data.
 */
export function stepBoundaries(
  {unit, step}: TickCandidate,
  times: readonly number[],
  zone: string,
): number[] {
  const aligned =
    unit === 'hour' || step >= (CALENDAR_ALIGNED_FROM[unit] ?? Infinity);
  return times.filter((time, i) =>
    aligned ? calendarIndex(unit, time, zone) % step === 0 : i % step === 0,
  );
}

/** How {@link labelKinds} names month ticks. */
export type LabelKindOptions = {
  /**
   * Month ticks name only the month ("Jan") rather than the date ("Aug 1"):
   * for monthly data, or a range long enough that every label is a month
   * start.
   */
  monthOnly: boolean;
  /**
   * Jan 1 stays a month tick with its year ("Jan 2026") instead of becoming
   * the year alone ("2026"): for an axis forced to months.
   */
  keepMonths: boolean;
};

/**
 * Labels each tick. Times of day for hours, except midnight, which shows the
 * date it starts. Month ticks show the date, or the month alone (see
 * {@link LabelKindOptions}). When the range crosses a year, the first tick of
 * each year carries it: the year alone on Jan 1 (unless months are kept),
 * otherwise the date or month with the year.
 */
export function labelKinds(
  unit: TimeUnit,
  times: readonly number[],
  zone: string,
  {monthOnly, keepMonths}: LabelKindOptions,
): XTick[] {
  const years = times.map((time) => zonedParts(time, zone).year);
  const crossesYears = new Set(years).size > 1;
  const byMonth = monthOnly && unit === 'month';
  return times.map((time, i): XTick => {
    if (unit === 'year') return {time, kind: 'year'};
    const {month, day, hour} = zonedParts(time, zone);
    if (unit === 'hour' && hour !== 0) return {time, kind: 'time'};
    const newYear = crossesYears && (i === 0 || years[i] !== years[i - 1]);
    if (!newYear) return {time, kind: byMonth ? 'month' : 'date'};
    if (month === 0 && day === 1 && !keepMonths) return {time, kind: 'year'};
    return {time, kind: byMonth ? 'monthYear' : 'dateYear'};
  });
}
