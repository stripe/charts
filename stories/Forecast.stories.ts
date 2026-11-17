import type {Meta, StoryObj} from '@storybook/html';

import {shot} from '../.storybook/shots';
import type {ChartSpec, DataPoint} from '../src/index';
import {addDays, curve, dates, last} from './support/data';
import {COLUMN_WIDTH, chart, cleanUpCharts, column} from './support/mount';
import {provenance} from './support/provenance';

const HEIGHT = 400;
const BAND_PER_MONTH = 0.035;

type Args = {spec: ChartSpec};

/**
 * Points with `forecast: true` (one run at the end of a series) are drawn
 * dashed for lines and outlined for bars, with an optional `low`/`high`
 * band. The legend explains the dashed style, tooltip rows are tagged
 * "Forecast", and KPI bases leave forecast points out.
 */
const meta: Meta<Args> = {
  title: 'Features/Forecast',
  beforeEach: cleanUpCharts,
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: HEIGHT})),
};

export default meta;

/** The first of each month, `count` months from `start` ("YYYY-MM-01"). */
function months(start: string, count: number): string[] {
  const [year, month] = start.split('-').map(Number);
  return Array.from({length: count}, (_, i) => {
    const index = (month ?? 1) - 1 + i;
    const y = (year ?? 2026) + Math.floor(index / 12);
    const m = (index % 12) + 1;
    return `${y}-${String(m).padStart(2, '0')}-01`;
  });
}

const ACTUAL_MONTHS = 12;
const FORECAST_MONTHS = 3;
const MONTHS = months('2025-12-01', ACTUAL_MONTHS + FORECAST_MONTHS);
const values = curve(MONTHS.length, 182_000, 268_000, {
  bend: 1.3,
  jitter: 0.02,
  seed: 71,
});

const mrrData: DataPoint[] = MONTHS.map((x, i) => {
  const y = values[i] ?? 0;
  const ahead = i - ACTUAL_MONTHS + 1;
  if (ahead <= 0) return {x, y};
  const spread = Math.round(y * BAND_PER_MONTH * ahead);
  return {x, y, forecast: true, low: y - spread, high: y + spread};
});
const actual = {label: 'MRR', data: mrrData.filter((point) => !point.forecast)};

const mrr: ChartSpec = {
  title: 'Monthly recurring revenue',
  description: 'Last 12 months, then a 3-month forecast',
  format: {style: 'currency', currency: 'usd', unit: 'major'},
  timeZone: 'UTC',
  kpi: {basis: 'latest', value: last(actual)},
  chart: {type: 'line'},
  series: [{label: 'MRR', data: mrrData}],
  provenance: provenance({
    metric: 'mrr',
    period: 'Dec 2025 to Nov 2026, monthly; forecast to Feb 2027',
    fetchedAt: '2026-11-02T08:15:00Z',
  }),
};

/** A line with a 3-month forecast and its range band. */
export const LineWithBand: StoryObj<Args> = {
  ...shot('forecast-line', 800, 500),
  args: {spec: mrr},
};

/** The same data as bars: forecast bars are outlined and lightly filled. */
export const Bars: StoryObj<Args> = {
  ...shot('forecast-bar', 800, 500),
  args: {spec: {...mrr, chart: {type: 'bar'}}},
};

const WEEK = dates('2026-11-23', 7);
const week = {
  label: 'Orders',
  data: WEEK.map((x, i): DataPoint => {
    const y = [3_812, 3_954, 4_101, 6_420, 9_870, 7_310, 6_950][i] ?? 0;
    return i < 4
      ? {x, y}
      : {
          x,
          y,
          forecast: true,
          low: Math.round(y * 0.85),
          high: Math.round(y * 1.15),
        };
  }),
};

/**
 * An incomplete day followed by forecast days: the incomplete period ends
 * before the forecast starts.
 */
export const IncompleteThenForecast: StoryObj<Args> = {
  args: {
    spec: {
      title: 'Orders',
      description:
        'Thanksgiving week 2026: today still processing, the rest forecast',
      format: {style: 'number', maximumFractionDigits: 0},
      timeZone: 'America/New_York',
      chart: {type: 'line', incomplete: {from: addDays('2026-11-23', 3)}},
      series: [week],
      provenance: provenance({
        metric: 'successful_payments_count',
        period: 'Nov 23 to Nov 29, 2026, daily',
        timeZone: 'America/New_York',
        fetchedAt: '2026-11-26T18:00:00Z',
      }),
    },
  },
};
