import {
  formatChange,
  formatDate,
  formatKpiValue,
  formatTicks,
  formatValue,
  formatValueCompact,
} from './format';
import type {DateStyle} from './format';

describe('formatValue', () => {
  it("formats currencies in major units with the currency's own decimals", () => {
    expect(
      formatValue(12.5, {style: 'currency', currency: 'usd', unit: 'major'}),
    ).toBe('$12.50');
    expect(
      formatValue(1284300.5, {
        style: 'currency',
        currency: 'usd',
        unit: 'major',
      }),
    ).toBe('$1,284,301');
    expect(
      formatValue(1284300.5, {
        style: 'currency',
        currency: 'jpy',
        unit: 'major',
      }),
    ).toBe('¥1,284,301');
    expect(
      formatValueCompact(1284300.5, {
        style: 'currency',
        currency: 'usd',
        unit: 'major',
      }),
    ).toBe('$1.3M');
  });

  it('shows a KPI change with its sign and always one decimal', () => {
    expect(formatChange(0.14)).toBe('+14.0%');
    expect(formatChange(-0.002)).toBe('-0.2%');
  });
});

describe('formatKpiValue', () => {
  it('abbreviates like the locale, but never rounds values under 1,000', () => {
    const usd = {style: 'currency', currency: 'usd', unit: 'major'} as const;
    expect(formatKpiValue(294470, usd, 'en-US', 'compact')).toBe('$294K');
    expect(formatKpiValue(3798040, usd, 'en-US', 'compact')).toBe('$3.8M');
    expect(formatKpiValue(12.5, usd, 'en-US', 'compact')).toBe('$12.50');
    expect(
      formatKpiValue(
        256911000,
        {style: 'currency', currency: 'jpy', unit: 'major'},
        'ja-JP',
        'compact',
      ),
    ).toBe('￥2.6億');
    expect(
      formatKpiValue(
        3798040,
        {style: 'currency', currency: 'eur', unit: 'major'},
        'de-DE',
        'compact',
      ),
    ).toBe('3,8\u00a0Mio.\u00a0€');
  });
});

describe('formatTicks', () => {
  const usd = {style: 'currency', currency: 'usd', unit: 'major'} as const;

  it('follows the y-axis notation and decimal cap', () => {
    expect(
      formatTicks([0, 100000, 200000], usd, 'en-US', {notation: 'standard'}),
    ).toEqual(['$0', '$100,000', '$200,000']);
    expect(
      formatTicks([0, 0.5, 1], {style: 'number'}, 'en-US', {
        maximumFractionDigits: 0,
      }),
    ).toEqual(['0', '1', '1']);
  });

  it('terminates on non-finite ticks instead of looping', () => {
    expect(formatTicks([0, Number.POSITIVE_INFINITY])).toHaveLength(2);
  });

  it('shows ticks finer than 20 decimals in scientific notation', () => {
    expect(formatTicks([0, 5e-121, 1e-120])).toEqual(['0', '5E-121', '1E-120']);
  });

  it('uses compact labels only when they show every tick exactly', () => {
    expect(formatTicks([1e15, 1e15 + 1])).toEqual([
      '1,000,000,000,000,000',
      '1,000,000,000,000,001',
    ]);
    expect(formatTicks([0, 100000, 200000, 300000], usd)).toEqual([
      '$0',
      '$100K',
      '$200K',
      '$300K',
    ]);
    expect(formatTicks([1000000, 1250000, 1500000], usd)).toEqual([
      '$1M',
      '$1.25M',
      '$1.5M',
    ]);
    expect(formatTicks([1111400, 1111500, 1111600, 1111700], usd)).toEqual([
      '$1,111,400',
      '$1,111,500',
      '$1,111,600',
      '$1,111,700',
    ]);
    expect(
      formatTicks([1111400, 1111450], {
        style: 'currency',
        currency: 'jpy',
        unit: 'major',
      }),
    ).toEqual(['¥1,111,400', '¥1,111,450']);
    expect(
      formatTicks([0, 0.025, 0.05], {style: 'percent', unit: 'ratio'}),
    ).toEqual(['0.0%', '2.5%', '5.0%']);
  });
});

describe('formatDate', () => {
  it('never shifts a date-only value, whatever the time zone', () => {
    const options = {timeZone: 'America/Los_Angeles'};
    expect(formatDate('2026-11-27', {...options, style: 'axis'})).toBe(
      'Nov 27',
    );
    expect(formatDate('2026-11-27', {...options, style: 'tooltip'})).toBe(
      'Fri, Nov 27, 2026',
    );
  });

  it('shows a date-time in the spec time zone, not UTC or the local zone', () => {
    // 15:30 UTC is 00:30 the next day in Tokyo.
    const options = {timeZone: 'Asia/Tokyo'};
    expect(
      formatDate('2026-11-27T15:30:00Z', {...options, style: 'axis'}),
    ).toBe('Nov 28');
    expect(
      formatDate('2026-11-27T15:30:00Z', {...options, style: 'tooltip'}),
    ).toBe('Sat, Nov 28, 2026, 12:30 AM');
    // 15:00 UTC on Dec 31 is midnight on New Year's Day in Tokyo.
    const newYear = '2026-12-31T15:00:00Z';
    const label = (style: DateStyle) =>
      formatDate(newYear, {...options, style});
    expect(label('axisYear')).toBe('2027');
    expect(label('axisMonthYear')).toBe('Jan 2027');
    expect(label('axisDateYear')).toBe('Jan 1, 2027');
    // Midnight names the new day rather than reading "12 AM".
    expect(label('axisTime')).toBe('Jan 1');
  });
});
