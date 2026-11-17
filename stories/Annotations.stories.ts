import type {Meta, StoryObj} from '@storybook/html';

import {shot} from '../.storybook/shots';
import type {ChartSpec} from '../src/index';
import {curve, dates, points, total} from './support/data';
import {COLUMN_WIDTH, chart, cleanUpCharts, column} from './support/mount';
import {provenance} from './support/provenance';

const HEIGHT = 400;

type Args = {spec: ChartSpec};

/**
 * `annotations` mark events on the chart: `at` alone draws a dashed marker
 * at a slot, `at` with `series` marks that series' point, and `from`/`to`
 * shade a range. Dates are x values of the primary series. Hovering a slot
 * inside an annotation adds it to the tooltip, and the details view lists
 * every annotation under "Notes".
 */
const meta: Meta<Args> = {
  title: 'Features/Annotations',
  beforeEach: cleanUpCharts,
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: HEIGHT})),
};

export default meta;

const referenceMonths = [
  '2026-01-01',
  '2026-02-01',
  '2026-03-01',
  '2026-04-01',
  '2026-05-01',
];
const referenceSpec: ChartSpec = {
  title: 'Regional volume',
  chart: {type: 'line', legend: 'show', axes: {x: {labels: 'month'}}},
  series: [
    {
      label: 'NA',
      color: '#9966FF',
      data: points(referenceMonths, [12, 18, 24, 20, 22]),
    },
    {
      label: 'EMEA',
      color: '#2255BB',
      data: points(referenceMonths, [9, 12, 11, 15, 14]),
    },
  ],
};

/** Hollow series-colored markers; hover April to see the EMEA note. */
export const PointAnnotation: StoryObj<Args> = {
  args: {
    spec: {
      ...referenceSpec,
      annotations: [
        {label: 'NA peak', at: '2026-03-01', series: 'NA'},
        {label: 'EMEA spike', at: '2026-04-01', series: 'EMEA'},
      ],
    },
  },
};

export const XPositionAnnotation: StoryObj<Args> = {
  args: {
    spec: {
      ...referenceSpec,
      annotations: [{label: 'Launch', at: '2026-02-01'}],
    },
  },
};

export const RangeAnnotation: StoryObj<Args> = {
  args: {
    spec: {
      ...referenceSpec,
      annotations: [
        {label: 'Spring promotion', from: '2026-03-01', to: '2026-05-01'},
      ],
    },
  },
};

export const FromAndUntilAnnotations: StoryObj<Args> = {
  args: {
    spec: {
      ...referenceSpec,
      annotations: [
        {label: 'Before launch', to: '2026-02-01'},
        {label: 'After launch', from: '2026-03-01'},
      ],
    },
  },
};

const DAYS = dates('2026-11-16', 21);
const volume = curve(DAYS.length, 18_500_000, 24_000_000, {
  jitter: 0.6,
  seed: 61,
})
  .map((cents, i) => {
    const day = DAYS[i];
    if (day === '2026-11-27') return cents * 2.1;
    if (day === '2026-11-30') return cents * 2.4;
    if (day === '2026-11-28' || day === '2026-11-29') return cents * 1.5;
    if (day === '2026-12-02') return cents * 0.7;
    return cents;
  })
  .map(Math.round);

const series = {label: '2026', data: points(DAYS, volume)};

const usdCents = {style: 'currency', currency: 'usd', unit: 'minor'} as const;

/** Markers for Black Friday and Cyber Monday, a promo range and an outage. */
export const Events: StoryObj<Args> = {
  ...shot('annotations-events', 800, 500),
  args: {
    spec: {
      title: 'Gross volume',
      description: 'November 16 to December 6, 2026',
      format: usdCents,
      timeZone: 'America/New_York',
      kpi: {basis: 'total', value: total(series)},
      chart: {type: 'line'},
      series: [series],
      annotations: [
        {label: 'Early-access promo', from: '2026-11-20', to: '2026-11-24'},
        {label: 'Black Friday', at: '2026-11-27'},
        {label: 'Cyber Monday', at: '2026-11-30'},
        {
          label: 'Checkout outage',
          description: 'Card payments failed for 40 minutes',
          at: '2026-12-02',
          series: '2026',
        },
      ],
      provenance: provenance({
        metric: 'gross_volume',
        period: 'Nov 16 to Dec 6, 2026, daily',
        timeZone: 'America/New_York',
        fetchedAt: '2026-12-07T14:00:00Z',
      }),
    },
  },
};

const MONTH = dates('2026-12-01', 15);
const daily = {
  label: 'December 2026',
  data: points(
    MONTH,
    curve(MONTH.length, 21_000_000, 23_500_000, {jitter: 0.4, seed: 62}),
  ),
};

/**
 * `chart.incomplete` from the last day: the line turns dashed from the last
 * complete point, the period gets a shaded note, and tooltip rows are tagged
 * "Incomplete". KPI totals still include it, since it is real data.
 */
export const IncompletePeriod: StoryObj<Args> = {
  ...shot('annotations-incomplete', 800, 500),
  args: {
    spec: {
      title: 'Gross volume',
      description: 'December 2026 so far',
      format: usdCents,
      timeZone: 'America/New_York',
      kpi: {basis: 'total', value: total(daily)},
      chart: {type: 'bar', incomplete: {from: '2026-12-15'}},
      series: [daily],
      provenance: provenance({
        metric: 'gross_volume',
        period: 'Dec 1 to Dec 15, 2026, daily',
        timeZone: 'America/New_York',
        fetchedAt: '2026-12-15T17:30:00Z',
      }),
    },
  },
};

// Monthly gross volume for 2026 on December 15: December is still running.
const YEAR_MONTHS = Array.from(
  {length: 12},
  (_, i) => `2026-${String(i + 1).padStart(2, '0')}-01`,
);
const monthly = curve(12, 410_000_000, 610_000_000, {jitter: 0.08, seed: 63});
const SO_FAR = 310_000_000;
const ON_PACE_FOR = 652_000_000;
const monthlyVolume = {
  label: '2026',
  data: YEAR_MONTHS.map((x, i) =>
    i === 11 ? {x, y: SO_FAR, projected: ON_PACE_FOR} : {x, y: monthly[i] ?? 0},
  ),
};

function projectedSpec(type: 'line' | 'bar'): ChartSpec {
  return {
    title: 'Gross volume by month',
    description: '2026, with December on pace',
    format: usdCents,
    timeZone: 'America/New_York',
    kpi: {basis: 'latest', value: SO_FAR},
    chart: {type, incomplete: {from: '2026-12-01'}},
    series: [monthlyVolume],
    provenance: provenance({
      metric: 'gross_volume',
      period: 'Jan to Dec 2026, monthly; December through Dec 15',
      timeZone: 'America/New_York',
      fetchedAt: '2026-12-15T17:30:00Z',
    }),
  };
}

/**
 * `projected` on an incomplete point: December so far is $3.1M and on pace
 * for $6.5M. The line runs on, dotted, to the projected value, with a
 * marker at the value so far; the KPI and its basis use the value so far.
 */
export const ProjectedLine: StoryObj<Args> = {
  ...shot('annotations-projected-line', 800, 500),
  args: {spec: projectedSpec('line')},
};

/** The same as bars: the hatched value so far, outlined up to the pace. */
export const ProjectedBars: StoryObj<Args> = {
  ...shot('annotations-projected-bars', 800, 500),
  args: {spec: projectedSpec('bar')},
};
