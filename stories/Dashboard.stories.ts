import type {Meta, StoryObj} from '@storybook/html';

import {shot} from '../.storybook/shots';
import type {ChartSpec, Provenance, Series} from '../src/index';
import {addDays, curve, dates, last, points} from './support/data';
import {COLUMN_WIDTH, chart, cleanUpCharts} from './support/mount';
import {provenance} from './support/provenance';

const KPI_GAP = 16;
/** Narrowest KPI tile before the row wraps to fewer columns. */
const MIN_TILE_WIDTH = 140;
const SECTION_GAP = 32;
const CHART_HEIGHT = 340;

type Args = {kpis: ChartSpec[]; spec: ChartSpec};

const meta: Meta<Args> = {
  title: 'Examples/Dashboard',
  beforeEach: cleanUpCharts,
};

export default meta;

const usd = {style: 'currency', currency: 'usd', unit: 'major'} as const;
const WEEKS = 13;
const WEEK = 7;
const START = '2026-08-16';

/** Every card on this page describes the same period. */
function asOfNov8(metric: string): Provenance {
  return provenance({
    metric,
    period: 'Aug 16 to Nov 8, 2026, weekly',
    comparedWith: 'Previous 13 weeks, May 17 to Aug 9, 2026',
    fetchedAt: '2026-11-09T07:45:00Z',
  });
}

const current: Series = {
  label: 'Current period',
  data: points(dates(START, WEEKS, WEEK), [
    ...curve(WEEKS - 1, 241_800, 301_900, {jitter: 0.02, seed: 31}),
    215_340,
  ]),
};
const previous: Series = {
  label: 'Previous period',
  comparison: true,
  data: points(
    dates(addDays(START, -WEEKS * WEEK), WEEKS, WEEK),
    curve(WEEKS, 287_100, 238_420, {bend: 0.7, jitter: 0.02, seed: 37}),
  ),
};

/**
 * A row of KPI cards above a full-width comparison chart, the way a report
 * page might combine them. The last week drops, so the change is negative.
 */
export const Overview: StoryObj<Args> = {
  name: 'Dashboard',
  ...shot('08-showcase', 800, 600),
  args: {
    kpis: [
      {
        title: 'MRR',
        timeZone: 'UTC',
        provenance: asOfNov8('mrr'),
        format: usd,
        kpi: {basis: 'custom', value: 215_340, comparisonValue: 238_420},
        chart: {type: 'kpi'},
      },
      {
        title: 'New ARR',
        timeZone: 'UTC',
        provenance: asOfNov8('new_arr'),
        format: usd,
        kpi: {basis: 'custom', value: 950_300, comparisonValue: 962_800},
        chart: {type: 'kpi'},
      },
      {
        title: 'Customers',
        timeZone: 'UTC',
        provenance: asOfNov8('active_customers'),
        format: {style: 'number'},
        kpi: {basis: 'custom', value: 83_912, comparisonValue: 79_689},
        chart: {type: 'kpi'},
      },
      {
        title: 'Churn rate',
        timeZone: 'UTC',
        provenance: asOfNov8('customer_churn_rate'),
        format: {style: 'percent', unit: 'ratio'},
        kpi: {
          basis: 'custom',
          value: 0.021,
          comparisonValue: 0.024,
          goodDirection: 'down',
        },
        chart: {type: 'kpi'},
      },
    ],
    spec: {
      title: 'Monthly recurring revenue',
      timeZone: 'UTC',
      description: 'Recurring revenue, as of each week.',
      format: usd,
      kpi: {
        basis: 'latest',
        value: last(current),
        comparisonValue: last(previous),
      },
      chart: {type: 'line'},
      provenance: asOfNov8('mrr'),
      series: [current, previous],
    },
  },
  render: ({kpis, spec}) => {
    // Fluid: as wide as the reference column, narrower on small screens,
    // with as many KPI columns as fit (four at 640px, two on a phone).
    const page = document.createElement('div');
    Object.assign(page.style, {
      width: `min(${COLUMN_WIDTH}px, 100%)`,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: `${SECTION_GAP}px`,
    });
    const tiles = document.createElement('div');
    Object.assign(tiles.style, {
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${MIN_TILE_WIDTH}px, 1fr))`,
      gap: `${KPI_GAP}px`,
    });
    tiles.append(...kpis.map((kpi) => chart(kpi, {width: '100%'})));
    page.append(tiles, chart(spec, {width: '100%', height: CHART_HEIGHT}));
    return page;
  },
};
