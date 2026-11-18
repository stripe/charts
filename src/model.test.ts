import {buildModel} from './model';
import type {ChartSpec, ChartType} from './spec';

// A point of an actual (not forecast or incomplete) value.
const actual = (seriesIndex: number, x: string | null, y: number | null) => ({
  seriesIndex,
  x,
  y,
  kind: 'actual',
  color: null,
  low: null,
  high: null,
  projected: null,
});

describe('buildModel', () => {
  it('aligns series by position, not by calendar date', () => {
    const model = buildModel({
      version: 1,
      title: 'Gross volume',
      series: [
        {
          label: '2026',
          data: [
            {x: '2026-11-27', y: 400},
            {x: '2026-11-28', y: -50},
          ],
        },
        {
          label: '2025',
          comparison: true,
          data: [
            {x: '2025-11-28', y: 300},
            {x: '2025-11-29', y: null},
            {x: '2025-11-30', y: 900},
          ],
        },
      ],
    });
    expect(model.slots).toEqual([
      {
        index: 0,
        xLabel: 'Nov 27',
        headerLabel: 'Nov 27',
        points: [actual(0, '2026-11-27', 400), actual(1, '2025-11-28', 300)],
        annotations: [],
        stack: [],
      },
      {
        index: 1,
        xLabel: 'Nov 28',
        headerLabel: 'Nov 28',
        points: [actual(0, '2026-11-28', -50), actual(1, '2025-11-29', null)],
        annotations: [],
        stack: [],
      },
      {
        index: 2,
        xLabel: '',
        headerLabel: '',
        points: [actual(0, null, null), actual(1, '2025-11-30', 900)],
        annotations: [],
        stack: [],
      },
    ]);
    expect(model.empty).toBe(false);
  });

  it('starts bars at zero and zooms lines to the data', () => {
    const spec = (type: ChartType, ys: (number | null)[]): ChartSpec => ({
      version: 1,
      title: 'Gross volume',
      chart: {type},
      series: [
        {label: '2026', data: ys.map((y, i) => ({x: `2026-11-${20 + i}`, y}))},
      ],
    });
    const values = [240000, 262000, 300000];

    const line = buildModel(spec('line', values));
    expect(line.yTicks).toEqual([240000, 260000, 280000, 300000]);
    expect(line.yDomain).toEqual([236400, 301800]);

    // A peak just under a round value still gets it as the top tick.
    const bar = buildModel(spec('bar', [180000, 295000]));
    expect(bar.yTicks).toEqual([0, 100000, 200000, 300000]);
    expect(bar.yDomain).toEqual([0, 303850]);

    expect(buildModel(spec('line', [null])).yDomain).toEqual([0, 1]);
  });

  it('labels date-times within a short span by time of day in the spec zone', () => {
    const model = buildModel({
      version: 1,
      title: 'Gross volume',
      timeZone: 'America/New_York',
      series: [
        {
          label: 'Campaign launch',
          data: [
            {x: '2026-11-27T05:00:00Z', y: 1},
            {x: '2026-11-27T11:30:00Z', y: 2},
          ],
        },
      ],
    });
    // Midnight names the day; other hours read as times.
    expect(model.slots.map((slot) => slot.xLabel)).toEqual([
      'Nov 27',
      '6:30 AM',
    ]);
    expect(model.slots.map((slot) => slot.headerLabel)).toEqual([
      'Nov 27, 12 AM',
      'Nov 27, 6:30 AM',
    ]);
  });

  it('stacks positives up and negatives down, top segment first', () => {
    const series = (label: string, y: number) => ({
      label,
      data: [{x: '2026-11-27', y}],
    });
    const model = buildModel({
      version: 1,
      title: 'Net volume',
      chart: {type: 'bar', stacking: 'stacked'},
      series: [
        series('Cards', 100),
        series('Refunds', -30),
        series('Wallets', 50),
      ],
    });
    expect(model.stacked).toBe(true);
    expect(model.slots[0].stack).toEqual([
      {seriesIndex: 2, y0: 100, y1: 150, actualY1: 150},
      {seriesIndex: 0, y0: 0, y1: 100, actualY1: 100},
      {seriesIndex: 1, y0: 0, y1: -30, actualY1: -30},
    ]);
    // The domain covers both stack totals, and the negative side gets its
    // own tick at the next step below 0.
    expect(model.yDomain).toEqual([-50, 155.4]);
    expect(model.yTicks).toEqual([-50, 0, 50, 100, 150]);
  });

  it('keeps the time in tooltip headers for hourly data over several days', () => {
    const hours = 72;
    const model = buildModel({
      version: 1,
      title: 'Gross volume',
      timeZone: 'UTC',
      series: [
        {
          label: 'Daily',
          data: Array.from({length: hours}, (_, i) => ({
            x: new Date(Date.UTC(2026, 10, 27, i)).toISOString(),
            y: i,
          })),
        },
      ],
    });
    // The axis thins to days over 3 days; each header still names its hour.
    expect(model.slots[6].xLabel).toBe('Nov 27');
    expect(model.slots[6].headerLabel).toBe('Nov 27, 6 AM');
    expect(model.headerStyle).toBe('tooltipHeader');
  });

  it('resolves annotations, the incomplete period and point kinds to slots', () => {
    const months = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'];
    const model = buildModel({
      version: 1,
      title: 'MRR',
      chart: {type: 'line', incomplete: {from: '2026-03-01'}},
      series: [
        {
          label: '2026',
          data: months.map((x, i) =>
            i === 3
              ? {x, y: 14, forecast: true, low: 12, high: 16}
              : {x, y: 10 + i},
          ),
        },
        {label: '2025', comparison: true, data: months.map((x) => ({x, y: 9}))},
      ],
      annotations: [
        {label: 'Launch', at: '2026-02-01'},
        {label: 'Promo', to: '2026-02-01'},
        {label: 'Peak', at: '2026-03-01', series: '2025'},
      ],
    });
    expect(model.incompleteFrom).toBe(2);
    expect(model.slots.map((slot) => slot.points[0].kind)).toEqual([
      'actual',
      'actual',
      'incomplete',
      'forecast',
    ]);
    // A comparison series is final data, never incomplete.
    expect(model.slots[2].points[1].kind).toBe('actual');
    expect(
      model.annotations.map(({label, kind, from, to, seriesIndex}) => [
        label,
        kind,
        from,
        to,
        seriesIndex,
      ]),
    ).toEqual([
      ['Launch', 'marker', 1, 1, null],
      ['Promo', 'range', 0, 1, null],
      ['Peak', 'point', 2, 2, 1],
      // The incomplete period ends where the forecast begins.
      ['Data in this period is still being processed', 'range', 2, 2, null],
    ]);
    expect(model.slots[1].annotations).toEqual([0, 1]);
    expect(model.annotations[1]).toMatchObject({
      openStart: true,
      openEnd: false,
    });
    expect(model.slots[3].points[0]).toMatchObject({low: 12, high: 16});
  });

  it('fits the y domain to visible series, forecast bands included', () => {
    const spec: ChartSpec = {
      version: 1,
      title: 'Volume',
      series: [
        {
          label: 'Cards',
          data: [
            {x: '2026-01-01', y: 100},
            {x: '2026-02-01', y: 120, forecast: true, high: 200},
          ],
        },
        {label: 'Wallets', data: [{x: '2026-01-01', y: 1000}]},
      ],
    };
    expect(buildModel(spec).yDomain[1]).toBeGreaterThan(1000);
    const cardsOnly = buildModel(spec, {hidden: new Set(['Wallets'])});
    expect(cardsOnly.yDomain[1]).toBeGreaterThanOrEqual(200);
    expect(cardsOnly.yDomain[1]).toBeLessThan(1000);
    expect(cardsOnly.series.map((s) => s.hidden)).toEqual([false, true]);
  });

  it('caps percent labels at whole percents, not whole ratios', () => {
    const model = buildModel({
      version: 1,
      title: 'Conversion',
      format: {style: 'percent', unit: 'ratio'},
      chart: {type: 'line', axes: {y: {maximumFractionDigits: 0}}},
      series: [
        {
          label: '2026',
          data: [
            {x: '2026-01-01', y: 0.12},
            {x: '2026-02-01', y: 0.19},
          ],
        },
      ],
    });
    expect(model.yMinStep).toBe(0.01);
    expect(model.yTicks.every((tick) => tick < 1)).toBe(true);
  });

  it('fits and stacks a projected incomplete point to its projection', () => {
    const model = buildModel({
      version: 1,
      title: 'Volume',
      chart: {
        type: 'bar',
        stacking: 'stacked',
        incomplete: {from: '2026-11-01'},
      },
      series: [
        {
          label: 'Cards',
          data: [
            {x: '2026-10-01', y: 40},
            {x: '2026-11-01', y: 30, projected: 60},
          ],
        },
        {
          label: 'Wallets',
          data: [
            {x: '2026-10-01', y: 10},
            {x: '2026-11-01', y: 5},
          ],
        },
      ],
    });
    // Cards so far ends at 30; its extension runs to 60, and Wallets stacks
    // on top of the projection, not inside it.
    expect(model.slots[1].stack).toEqual([
      {seriesIndex: 1, y0: 60, y1: 65, actualY1: 65},
      {seriesIndex: 0, y0: 0, y1: 60, actualY1: 30},
    ]);
    expect(model.slots[1].points[0]).toMatchObject({
      kind: 'incomplete',
      projected: 60,
    });
    expect(model.yDomain[1]).toBeGreaterThanOrEqual(65);
  });
});
