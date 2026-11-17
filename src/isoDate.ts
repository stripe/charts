// Parsing for the two date forms the spec accepts. Shared by validation and
// formatting so both agree on what a valid date is.

/**
 * A parsed spec date. A `"date"` is a calendar day, stored as UTC midnight
 * and always formatted in UTC so it never shifts. A `"dateTime"` is an
 * instant, formatted in the spec's time zone.
 */
export type ParsedDate = {kind: 'date' | 'dateTime'; time: number};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
// Seconds and up to millisecond precision are optional; the zone is not,
// because a date-time without one would be read in the viewer's zone.
const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))$/;

/**
 * Earliest year accepted. Two-digit-looking years such as "0026" are almost
 * always mistakes, and Date.UTC reads years 0 to 99 as 1900 to 1999.
 */
export const MIN_YEAR = 1000;

const MONTHS_PER_YEAR = 12;
const MAX_HOUR = 23;
const MAX_MINUTE = 59;
const MAX_SECOND = 59;

function isCalendarDate(year: number, month: number, day: number): boolean {
  if (year < MIN_YEAR || month < 1 || month > MONTHS_PER_YEAR || day < 1) {
    return false;
  }
  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function isClockTime(hour: number, minute: number, second: number): boolean {
  return hour <= MAX_HOUR && minute <= MAX_MINUTE && second <= MAX_SECOND;
}

/**
 * Parses `"YYYY-MM-DD"` or an ISO 8601 date-time with `Z` or an offset.
 * Returns null for anything else, including impossible dates like
 * `"2026-02-30"` and years before {@link MIN_YEAR}.
 */
export function parseIsoDate(value: string): ParsedDate | null {
  const date = DATE_PATTERN.exec(value);
  if (date) {
    const [year, month, day] = date.slice(1, 4).map(Number);
    if (!isCalendarDate(year, month, day)) return null;
    return {kind: 'date', time: Date.UTC(year, month - 1, day)};
  }

  const dateTime = DATE_TIME_PATTERN.exec(value);
  if (!dateTime) return null;
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] =
    dateTime.slice(1).map((part) => Number(part ?? 0));
  if (
    !isCalendarDate(year, month, day) ||
    !isClockTime(hour, minute, second) ||
    !isClockTime(offsetHour, offsetMinute, 0)
  ) {
    return null;
  }
  return {kind: 'dateTime', time: Date.parse(value)};
}
