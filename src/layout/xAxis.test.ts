import {slotScale} from './scale';
import type {XTick} from './xAxis';
import {layoutXAxis} from './xAxis';

const MS_PER_DAY = 86_400_000;
const GAPS = {
  hour: 40,
  day: 20,
  week: 56,
  month: 70,
  monthlyMonth: 40,
  year: 70,
};
const MIN_GAP = 16;
// About 6.5px per character, like 12px system sans.
const measure = (text: string): number => text.length * 6.5;

function formatter(timeZone: string): (tick: XTick) => string {
  const options: Record<XTick['kind'], Intl.DateTimeFormatOptions> = {
    time: {hour: 'numeric'},
    date: {month: 'short', day: 'numeric'},
    dateYear: {month: 'short', day: 'numeric', year: 'numeric'},
    month: {month: 'short'},
    monthYear: {month: 'short', year: 'numeric'},
    year: {year: 'numeric'},
  };
  return ({time, kind}) =>
    new Intl.DateTimeFormat('en-US', {...options[kind], timeZone}).format(time);
}

function series(start: string, count: number, stepMs: number): number[] {
  return Array.from({length: count}, (_, i) => Date.parse(start) + i * stepMs);
}

/** Lays out the axis and checks it never clips or collides. */
function labelsAt(
  times: number[],
  width: number,
  timeZone = 'UTC',
  mode: 'point' | 'band' = 'point',
): string[] {
  const scale = slotScale(times.length, width, mode);
  const labels = layoutXAxis({
    times,
    timeZone,
    center: scale.center,
    plotWidth: width,
    measure,
    formatTick: formatter(timeZone),
    minGap: MIN_GAP,
    gaps: GAPS,
  });
  labels.forEach((label, i) => {
    expect(label.left).toBeGreaterThanOrEqual(0);
    expect(label.left + label.width).toBeLessThanOrEqual(width);
    const previous = labels[i - 1];
    if (previous) {
      expect(
        label.left - (previous.left + previous.width),
      ).toBeGreaterThanOrEqual(MIN_GAP);
    }
  });
  return labels.map((label) => label.text);
}

describe('layoutXAxis', () => {
  it('picks a calendar unit and step that fits the span and width', () => {
    // Daily for a quarter, and weekly with no point on the 1st: month starts.
    // Every month at 576px, and a year gets quarters from about 500px.
    expect(labelsAt(series('2026-08-01', 93, MS_PER_DAY), 576)).toEqual([
      'Aug 1',
      'Sep 1',
      'Oct 1',
      'Nov 1',
    ]);
    expect(labelsAt(series('2026-07-27', 14, 7 * MS_PER_DAY), 576)).toEqual([
      'Aug 1',
      'Sep 1',
      'Oct 1',
    ]);

    // A sale weekend: every day when it fits, every other day when narrow.
    const weekend = series('2026-11-27', 5, MS_PER_DAY);
    expect(labelsAt(weekend, 576)).toEqual([
      'Nov 27',
      'Nov 28',
      'Nov 29',
      'Nov 30',
      'Dec 1',
    ]);
    expect(labelsAt(weekend, 160)).toEqual(['Nov 27', 'Nov 29', 'Dec 1']);

    // Hourly in New York: times of day on round hours, midnight as a date.
    const hourly = series('2026-11-27T05:00:00Z', 30, 3_600_000);
    expect(labelsAt(hourly, 576, 'America/New_York')).toEqual([
      'Nov 27',
      '6 AM',
      '12 PM',
      '6 PM',
      'Nov 28',
    ]);
    // Across the spring-forward gap, every hour still fits.
    const springForward = series('2026-03-08T05:00:00Z', 12, 3_600_000);
    expect(labelsAt(springForward, 1000, 'America/New_York')).toEqual([
      'Mar 8',
      '1 AM',
      '3 AM',
      '4 AM',
      '5 AM',
      '6 AM',
      '7 AM',
      '8 AM',
      '9 AM',
      '10 AM',
      '11 AM',
      '12 PM',
    ]);

    // Monthly bars: short month names, quarters on a card, every month wide.
    const monthly = Array.from({length: 12}, (_, i) => Date.UTC(2026, i, 1));
    expect(labelsAt(monthly, 590, 'UTC', 'band')).toEqual([
      'Jan',
      'Apr',
      'Jul',
      'Oct',
    ]);
    expect(labelsAt(monthly, 1150, 'UTC', 'band')).toHaveLength(12);

    // Crossing a year shows it where the year changes, even when only one
    // label fits.
    const newYear = series('2026-12-15', 37, MS_PER_DAY);
    expect(labelsAt(newYear, 120)).toEqual(['2027']);
    // Six months of daily data covers six month starts, so ticks name the
    // month alone, with the year where it changes.
    expect(labelsAt(series('2026-10-01', 182, MS_PER_DAY), 800)).toEqual([
      'Oct 2026',
      'Nov',
      'Dec',
      '2027',
      'Feb',
      'Mar',
    ]);
  });
});
