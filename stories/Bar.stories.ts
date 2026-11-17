import type {Meta, StoryObj} from '@storybook/html';
import {orderSpec} from './support/specs';

import {shot} from '../.storybook/shots';
import type {ChartSpec, Provenance, Series} from '../src/index';
import {addDays, curve, dates, points, total} from './support/data';
import {
  CELL_WIDTH,
  COLUMN_WIDTH,
  chart,
  cleanUpCharts,
  column,
  grid,
  stack,
} from './support/mount';
import {provenance} from './support/provenance';
import {hoverShot} from './support/shots';

const FULL_HEIGHT = 600;
const CELL_HEIGHT = 252;
const KPI_GAP = 8;

type SingleArgs = {spec: ChartSpec};
type ComparisonArgs = {spec: ChartSpec; kpis: ChartSpec[]};

const meta: Meta = {
  title: 'Charts/Bar',
  beforeEach: cleanUpCharts,
};

export default meta;

export const Overview: StoryObj = {
  render: () =>
    chart({...orderSpec, chart: {type: 'bar'}}, {width: '100%', height: 320}),
};

const WEEK = 7;

const weeklyRevenue: ChartSpec = {
  title: 'Monthly recurring revenue',
  timeZone: 'UTC',
  description: 'Monthly recurring revenue over time',
  format: {style: 'currency', currency: 'usd', unit: 'major'},
  kpi: {basis: 'latest', value: 1_111_757},
  chart: {type: 'bar'},
  provenance: provenance({
    metric: 'mrr',
    period: 'Jul 27 to Oct 26, 2026, weekly (weeks start Monday)',
    fetchedAt: '2026-11-02T08:15:00Z',
  }),
  series: [
    {
      label: 'Recurring revenue',
      data: points(
        // Weeks start on Monday.
        dates('2026-07-27', 14, WEEK),
        curve(14, 1_111_420, 1_111_757, {jitter: 0.4, seed: 3}),
      ),
    },
  ],
};

/** A single series of weekly bars. Bars always start at zero. */
export const WithKpi: StoryObj<SingleArgs> = {
  ...shot('03-bar', 800, 640),
  args: {spec: weeklyRevenue},
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: FULL_HEIGHT})),
};

// Thirteen weekly totals against the previous thirteen weeks. The bars of
const WEEKS = 13;
const START = '2026-08-09';

const currentArr: Series = {
  label: 'Current period',
  data: points(
    dates(START, WEEKS, WEEK),
    curve(WEEKS, 296_400, 291_800, {jitter: 0.05, seed: 21}),
  ),
};
const previousArr: Series = {
  label: 'Previous period',
  comparison: true,
  data: points(
    dates(addDays(START, -WEEKS * WEEK), WEEKS, WEEK),
    curve(WEEKS, 265_300, 296_100, {jitter: 0.05, seed: 23}),
  ),
};

const newArrProvenance = provenance({
  metric: 'new_arr',
  period: 'Aug 9 to Nov 1, 2026, weekly',
  comparedWith: 'Previous 13 weeks, May 10 to Aug 2, 2026',
  fetchedAt: '2026-11-02T08:15:00Z',
});

const newArr: ChartSpec = {
  title: 'New ARR',
  timeZone: 'UTC',
  format: {style: 'currency', currency: 'usd', unit: 'major'},
  kpi: {
    basis: 'total',
    value: total(currentArr),
    comparisonValue: total(previousArr),
  },
  chart: {type: 'bar'},
  provenance: newArrProvenance,
  series: [currentArr, previousArr],
};

const sideKpis: ChartSpec[] = [
  {
    title: 'MRR',
    timeZone: 'UTC',
    format: {style: 'currency', currency: 'usd', unit: 'major'},
    kpi: {basis: 'latest', value: 294_470, comparisonValue: 238_630},
    chart: {type: 'kpi'},
    series: [
      {
        label: 'MRR',
        data: points(
          dates(START, WEEKS, WEEK),
          curve(WEEKS, 238_630, 294_470, {bend: 1.6, jitter: 0.02, seed: 41}),
        ),
      },
    ],
    provenance: provenance({
      metric: 'mrr',
      period: 'Nov 1, 2026',
      comparedWith: 'Aug 2, 2026',
      fetchedAt: '2026-11-02T08:15:00Z',
    }),
  },
  {
    title: 'New ARR',
    timeZone: 'UTC',
    format: {style: 'currency', currency: 'usd', unit: 'major'},
    kpi: {
      basis: 'total',
      value: newArr.kpi?.value ?? 0,
      comparisonValue: newArr.kpi?.comparisonValue ?? 0,
    },
    chart: {type: 'kpi'},
    series: [currentArr],
    provenance: newArrProvenance,
  },
];

function renderComparison({spec, kpis}: ComparisonArgs): HTMLElement {
  return column(
    grid([
      chart(spec, {width: CELL_WIDTH, height: CELL_HEIGHT}),
      stack(KPI_GAP, ...kpis.map((kpi) => chart(kpi, {width: CELL_WIDTH}))),
    ]),
  );
}

/**
 * Bars for the current and previous period, next to two KPI cards with
 * sparklines of the same weeks.
 */
export const Comparison: StoryObj<ComparisonArgs> = {
  ...shot('04b-comparison-bar', 800, 500),
  args: {spec: newArr, kpis: sideKpis},
  render: renderComparison,
};

/**
 * The comparison bars with the pointer over a slot: a dashed crosshair at
 * the slot centre and a tooltip headed by the current period's date, with
 * both periods' values. The previous period's own date is in the
 * screen-reader announcement for the slot and in the details table.
 */
export const ComparisonHover: StoryObj<ComparisonArgs> = {
  ...hoverShot('05b-hover-comparison-bar', 800, 500, {x: 200, y: 250}),
  args: {spec: newArr, kpis: sideKpis},
  render: renderComparison,
};

const REPORT_DAYS = dates('2026-11-01', 30);
const REPORT_HEIGHT = 400;

function reportValues(lastFive: number[]): number[] {
  const first = lastFive[0] ?? 0;
  return [
    ...curve(25, Math.round(first * 0.65), Math.round(first * 0.95), {
      jitter: 0.45,
      seed: Math.abs(first),
    }),
    ...lastFive,
  ];
}

function reportProvenance(
  metric: string,
  {comparedWith}: {comparedWith?: string} = {},
): Provenance {
  return provenance({
    metric,
    ...(comparedWith === undefined ? {} : {comparedWith}),
    period: 'Nov 1 to Nov 30, 2026, daily',
    timeZone: 'America/New_York',
    fetchedAt: '2026-12-01T14:05:00Z',
  });
}

const byPaymentMethod: ChartSpec = {
  title: 'Gross volume by payment method',
  description: 'November 1–30',
  format: {style: 'currency', currency: 'usd', unit: 'major'},
  timeZone: 'America/New_York',
  chart: {type: 'bar'},
  series: [
    {
      label: 'Cards',
      data: points(
        REPORT_DAYS,
        reportValues([198_400, 286_900, 231_200, 204_800, 318_300]),
      ),
    },
    {
      label: 'Wallets',
      data: points(
        REPORT_DAYS,
        reportValues([52_300, 79_800, 66_100, 59_400, 88_200]),
      ),
    },
    {
      label: 'Bank debits',
      data: points(
        REPORT_DAYS,
        reportValues([21_700, 28_400, 24_900, 22_300, 31_000]),
      ),
    },
    {
      label: 'Buy now, pay later',
      data: points(
        REPORT_DAYS,
        reportValues([14_000, 16_900, 16_750, 14_700, 18_230]),
      ),
    },
  ],
  provenance: reportProvenance('gross_volume, grouped by payment_method_type'),
};

/**
 * Four series in each slot, in series order, colored from the series
 * palette. Grouped is the default `chart.stacking`.
 */
export const Grouped: StoryObj<SingleArgs> = {
  ...shot('bar-grouped-4', 800, 500),
  args: {spec: byPaymentMethod},
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: REPORT_HEIGHT})),
};

/** Three series, with the last year's total as a muted comparison. */
export const GroupedWithComparison: StoryObj<SingleArgs> = {
  ...shot('bar-grouped-3', 800, 500),
  args: {
    spec: {
      title: 'Orders by channel',
      description: 'November 1–30, compared with last year',
      format: {style: 'number', maximumFractionDigits: 0},
      timeZone: 'America/New_York',
      chart: {type: 'bar'},
      series: [
        {
          label: 'Online',
          data: points(
            REPORT_DAYS,
            reportValues([2_612, 4_015, 3_120, 2_841, 4_660]),
          ),
        },
        {
          label: 'In person',
          data: points(
            REPORT_DAYS,
            reportValues([800, 1_193, 990, 853, 1_216]),
          ),
        },
        {
          label: 'All channels, 2025',
          comparison: true,
          data: points(
            dates('2025-11-02', 30),
            reportValues([3_050, 4_710, 3_820, 3_402, 5_301]),
          ),
        },
      ],
      provenance: reportProvenance('successful_payments_count, by channel', {
        comparedWith: 'Nov 2 to Dec 1, 2025 (same weekdays)',
      }),
    },
  },
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: REPORT_HEIGHT})),
};

/**
 * `chart.stacking: "stacked"`: positive values stack up from zero and
 * negative values (refunds, disputes) stack down, so each bar spans the
 * day's gross movement. The y axis covers the stack totals and includes 0.
 */
export const Stacked: StoryObj<SingleArgs> = {
  ...shot('bar-stacked-negative', 800, 500),
  args: {
    spec: {
      title: 'Net volume',
      description: 'Charges, refunds and disputes, November 1–30',
      format: {style: 'currency', currency: 'usd', unit: 'major'},
      timeZone: 'America/New_York',
      chart: {type: 'bar', stacking: 'stacked'},
      series: [
        {
          label: 'Charges',
          data: points(
            REPORT_DAYS,
            reportValues([286_410, 412_000, 338_950, 301_220, 455_730]),
          ),
        },
        {
          label: 'Refunds',
          data: points(
            REPORT_DAYS,
            reportValues([-28_640, -45_320, -30_510, -33_130, -38_740]),
          ),
        },
        {
          label: 'Disputes',
          data: points(
            REPORT_DAYS,
            reportValues([-8_590, -14_420, -7_460, -11_450, -12_300]),
          ),
        },
      ],
      provenance: reportProvenance('net_volume, by balance_transaction_type'),
    },
  },
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: REPORT_HEIGHT})),
};
