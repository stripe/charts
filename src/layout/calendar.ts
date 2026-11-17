// Calendar arithmetic in a display time zone. Date-only data uses UTC, so a
// calendar day never shifts.

/** Wall-clock fields of an instant in a zone. `month` is 0-based. */
export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 for Sunday to 6 for Saturday. */
  weekday: number;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MS_PER_MINUTE = 60_000;

// One formatter per zone; constructing Intl formatters is slow.
const partFormatters = new Map<string, Intl.DateTimeFormat>();

function partFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partFormatters.get(timeZone);
  if (!formatter) {
    // Numeric parts in a fixed locale and a 24-hour clock, so they can be
    // parsed back regardless of the chart's locale.
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
    });
    partFormatters.set(timeZone, formatter);
  }
  return formatter;
}

// Recently read instants per zone. Axis layout asks for the same tick
// instants many times (every candidate tick spacing, every chart with the
// same span), and formatToParts is the slowest step of laying out an axis.
const MAX_CACHED_PARTS = 4096;
const partsCache = new Map<string, Map<number, Readonly<ZonedParts>>>();

function readParts(time: number, timeZone: string): ZonedParts {
  // Calendar dates are always displayed in UTC, where Date reads the same
  // fields directly.
  if (timeZone === 'UTC') {
    const date = new Date(time);
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth(),
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      weekday: date.getUTCDay(),
    };
  }
  const parts: ZonedParts = {
    year: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    weekday: 0,
  };
  for (const {type, value} of partFormatter(timeZone).formatToParts(time)) {
    if (type === 'year') parts.year = Number(value);
    else if (type === 'month') parts.month = Number(value) - 1;
    else if (type === 'day') parts.day = Number(value);
    else if (type === 'hour') parts.hour = Number(value);
    else if (type === 'minute') parts.minute = Number(value);
    else if (type === 'weekday') parts.weekday = WEEKDAYS.indexOf(value);
  }
  return parts;
}

/** The wall-clock fields of `time` in `timeZone`, shared with other callers. */
export function zonedParts(
  time: number,
  timeZone: string,
): Readonly<ZonedParts> {
  let cache = partsCache.get(timeZone);
  if (!cache) {
    cache = new Map();
    partsCache.set(timeZone, cache);
  }
  const cached = cache.get(time);
  if (cached) return cached;
  if (cache.size >= MAX_CACHED_PARTS) cache.clear();
  const parts = readParts(time, timeZone);
  cache.set(time, parts);
  return parts;
}

function offsetAt(time: number, timeZone: string): number {
  const {year, month, day, hour, minute} = zonedParts(time, timeZone);
  const wall = Date.UTC(year, month, day, hour, minute);
  // Seconds are not part of the wall clock read back; drop them here too.
  return wall - Math.floor(time / MS_PER_MINUTE) * MS_PER_MINUTE;
}

// Offsets are sampled this far either side of a wall time; daylight saving
// changes are months apart, so at most one lies in between.
const OFFSET_SAMPLE_MS = 24 * 60 * MS_PER_MINUTE;

/** True if the wall clock in `timeZone` reads `wall` (a UTC-encoded wall time) at `time`. */
function readsAs(time: number, wall: number, timeZone: string): boolean {
  const parts = zonedParts(time, timeZone);
  const expected = new Date(wall);
  return (
    parts.year === expected.getUTCFullYear() &&
    parts.month === expected.getUTCMonth() &&
    parts.day === expected.getUTCDate() &&
    parts.hour === expected.getUTCHours() &&
    parts.minute === expected.getUTCMinutes()
  );
}

/**
 * The instant the wall clock in `timeZone` reads the given time. Fields
 * overflow like `Date.UTC` (day 32 is the 1st of next month). Around a
 * daylight saving change, a wall time that happens twice resolves to its
 * first occurrence, and one that is skipped resolves to the instant just
 * after the gap.
 */
export function zonedTime(
  timeZone: string,
  year: number,
  month: number,
  day = 1,
  hour = 0,
): number {
  const wall = Date.UTC(year, month, day, hour);
  // The two offsets in effect around the wall time (the same one, except
  // near a change) each give a candidate instant.
  const before = wall - offsetAt(wall - OFFSET_SAMPLE_MS, timeZone);
  const after = wall - offsetAt(wall + OFFSET_SAMPLE_MS, timeZone);
  const valid = [before, after].filter((time) => readsAs(time, wall, timeZone));
  // Both read correctly in a repeated hour: the first occurrence. Neither
  // does in a skipped hour: the later candidate, which lands after the gap.
  return valid.length > 0 ? Math.min(...valid) : Math.max(before, after);
}
