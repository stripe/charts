import {zonedParts, zonedTime} from './calendar';

describe('zonedTime', () => {
  it('resolves daylight saving changes: after a skipped hour, first of a repeated one', () => {
    const newYork = 'America/New_York';
    // An ordinary time: midnight EDT is 04:00 UTC.
    expect(zonedTime(newYork, 2026, 6, 1, 0)).toBe(Date.UTC(2026, 6, 1, 4));
    // 2:00 AM on Mar 8, 2026 does not exist; the instant after the gap is
    // 3:00 AM EDT, 07:00 UTC.
    expect(zonedTime(newYork, 2026, 2, 8, 2)).toBe(Date.UTC(2026, 2, 8, 7));
    // 1:00 AM on Nov 1, 2026 happens twice; the first is EDT, 05:00 UTC.
    expect(zonedTime(newYork, 2026, 10, 1, 1)).toBe(Date.UTC(2026, 10, 1, 5));
  });
});

const referenceFormatters = new Map<string, Intl.DateTimeFormat>();

/** The wall clock read independently of `zonedParts`, with Intl. */
function referenceParts(time: number, timeZone: string) {
  let formatter = referenceFormatters.get(timeZone);
  if (!formatter) {
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
    referenceFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(time);
  const get = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    year: Number(get('year')),
    month: Number(get('month')) - 1,
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
      get('weekday'),
    ),
  };
}

describe('zonedParts', () => {
  it('reads the same wall clock as Intl in UTC and across daylight saving changes, when cached too', () => {
    const zones = [
      'UTC',
      'America/New_York',
      'Europe/London',
      'Asia/Kolkata',
      'Australia/Lord_Howe',
    ];
    // Every 37 minutes through both 2026 changes in New York and London
    // (Mar 8 / Mar 29 and Oct 25 / Nov 1), plus a leap day and a new year.
    const ranges = [
      [Date.UTC(2026, 2, 7), Date.UTC(2026, 2, 30)],
      [Date.UTC(2026, 9, 24), Date.UTC(2026, 10, 2)],
      [Date.UTC(2028, 1, 28), Date.UTC(2028, 2, 2)],
      [Date.UTC(2026, 11, 31, 12), Date.UTC(2027, 0, 1, 12)],
    ];
    for (const timeZone of zones) {
      for (const [start, end] of ranges) {
        for (let time = start; time < end; time += 37 * 60_000) {
          const expected = referenceParts(time, timeZone);
          expect(zonedParts(time, timeZone)).toEqual(expected);
          expect(zonedParts(time, timeZone)).toEqual(expected);
        }
      }
    }
  });
});
