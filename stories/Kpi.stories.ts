import type {Meta, StoryObj} from '@storybook/html';

import {shot} from '../.storybook/shots';
import blackFridayTotal from '../examples/bfcm-kpi.json';
import type {ChartSpec, Provenance, Series} from '../src/index';
import {dates, points, seeded} from './support/data';
import {
  CELL_WIDTH,
  chart,
  cleanUpCharts,
  column,
  grid,
  stack,
} from './support/mount';
import {provenance} from './support/provenance';

const ROW_HEIGHT = 166;

type TilesArgs = {specs: ChartSpec[]};

const meta: Meta<TilesArgs> = {
  title: 'Charts/KPI',
  beforeEach: cleanUpCharts,
  render: ({specs}) =>
    column(
      grid(
        specs.map((spec) => chart(spec, {width: CELL_WIDTH})),
        {rowHeight: ROW_HEIGHT},
      ),
    ),
};

export default meta;

const usd = {style: 'currency', currency: 'usd', unit: 'major'} as const;

const SPARKLINE_DAYS = dates('2026-10-26', 7);
const SPARKLINE_JITTER = 0.3;

/**
 * A one-series sparkline from `from` to `to` over {@link SPARKLINE_DAYS},
 * ending exactly on `to` (the KPI value). Not rounded, so ratios work.
 */
function sparkline(
  label: string,
  from: number,
  to: number,
  seed: number,
): Series[] {
  const random = seeded(seed);
  const last = SPARKLINE_DAYS.length - 1;
  const values = SPARKLINE_DAYS.map((_, i) => {
    const trend = from + ((to - from) * i) / last;
    const noise =
      i === 0 || i === last
        ? 0
        : (random() - 0.5) * SPARKLINE_JITTER * (to - from);
    return trend + noise;
  });
  return [{label, data: points(SPARKLINE_DAYS, values)}];
}

/** Provenance for a KPI card: the value on Nov 1, against Oct 26. */
function asOfNov1(metric: string, timeZone = 'UTC'): Provenance {
  return provenance({
    metric,
    period: 'Nov 1, 2026',
    comparedWith: 'Oct 26, 2026',
    timeZone,
    fetchedAt: '2026-11-02T08:15:00Z',
  });
}

/**
 * KPI cards (`chart.type: "kpi"`) with a sparkline of the last seven days:
 * a rising and a falling value (compact, like "$17K"), a plain count without
 * a comparison, and a full value with a small change. Hovering the sparkline
 * shows that day's value.
 */
export const Tiles: StoryObj<TilesArgs> = {
  ...shot('01-kpi-only', 800, 500),
  args: {
    specs: [
      {
        title: 'Rising',
        timeZone: 'UTC',
        format: usd,
        kpi: {
          basis: 'latest',
          value: 17_040,
          comparisonValue: 13_810,
          notation: 'compact',
        },
        series: sparkline('Net new MRR', 13_810, 17_040, 11),
        chart: {type: 'kpi'},
        provenance: asOfNov1('net_new_mrr'),
      },
      {
        title: 'Falling',
        timeZone: 'UTC',
        format: usd,
        kpi: {
          basis: 'latest',
          value: 3_801_200,
          comparisonValue: 3_963_700,
          notation: 'compact',
        },
        series: sparkline('Gross volume', 3_963_700, 3_801_200, 12),
        chart: {type: 'kpi'},
        provenance: asOfNov1('gross_volume'),
      },
      {
        title: 'No comparison',
        timeZone: 'UTC',
        format: {style: 'number', maximumFractionDigits: 0},
        kpi: {basis: 'latest', value: 1204},
        series: sparkline('Active subscriptions', 1_102, 1_204, 13),
        chart: {type: 'kpi'},
        provenance: asOfNov1('active_subscriptions'),
      },
      {
        title: 'Net volume',
        timeZone: 'UTC',
        format: usd,
        kpi: {basis: 'latest', value: 294_118, comparisonValue: 290_630},
        series: sparkline('Net volume', 290_630, 294_118, 14),
        chart: {type: 'kpi'},
        provenance: asOfNov1('net_volume'),
      },
    ],
  },
};

/**
 * One KPI card per value format, each with a sparkline: currency, number,
 * percent and a zero-decimal currency.
 */
export const Formats: StoryObj<TilesArgs> = {
  args: {
    specs: [
      {
        title: 'MRR',
        timeZone: 'UTC',
        format: usd,
        kpi: {basis: 'latest', value: 294_470.5, comparisonValue: 238_630},
        series: sparkline('MRR', 238_630, 294_470.5, 15),
        chart: {type: 'kpi'},
        provenance: asOfNov1('mrr'),
      },
      {
        title: 'Orders',
        timeZone: 'UTC',
        format: {style: 'number', maximumFractionDigits: 0},
        kpi: {basis: 'latest', value: 48_213, comparisonValue: 47_037},
        series: sparkline('Orders', 47_037, 48_213, 16),
        chart: {type: 'kpi'},
        provenance: asOfNov1('successful_payments_count'),
      },
      {
        title: 'Conversion rate',
        timeZone: 'UTC',
        format: {style: 'percent', unit: 'ratio'},
        kpi: {basis: 'latest', value: 0.0412, comparisonValue: 0.0397},
        series: sparkline('Conversion rate', 0.0397, 0.0412, 17),
        chart: {type: 'kpi'},
        provenance: asOfNov1('checkout_conversion_rate'),
      },
      {
        title: 'Gross volume (JPY)',
        timeZone: 'UTC',
        format: {style: 'currency', currency: 'jpy', unit: 'major'},
        locale: 'ja-JP',
        kpi: {basis: 'latest', value: 18_406_500, comparisonValue: 17_960_000},
        series: sparkline('Gross volume', 17_960_000, 18_406_500, 18),
        chart: {type: 'kpi'},
        provenance: asOfNov1('gross_volume', 'Asia/Tokyo'),
      },
    ],
  },
};

const NARROW_WIDTHS = [280, 320, 360];
const NARROW_GAP = 16;

/**
 * KPI cards without a sparkline at 280, 320 and 360px. At narrow widths the value steps down a
 * type size and the change wraps below it instead of overflowing.
 */
export const Narrow: StoryObj<{spec: unknown}> = {
  ...shot('kpi-narrow', 800, 500),
  args: {spec: blackFridayTotal},
  render: ({spec}) =>
    stack(NARROW_GAP, ...NARROW_WIDTHS.map((width) => chart(spec, {width}))),
};

/**
 * A sparkline tile at 280, 320 and 360px. Below about 240px of content the
 * sparkline moves under the value and takes the full width.
 */
export const NarrowSparkline: StoryObj<{spec: unknown}> = {
  ...shot('kpi-narrow-sparkline', 800, 500),
  args: {
    spec: {
      ...blackFridayTotal,
      series: [
        {
          label: 'Gross volume',
          data: points(
            dates('2026-11-27', 4),
            [41_200_025, 33_895_080, 30_122_040, 45_573_010],
          ),
        },
      ],
    },
  },
  render: ({spec}) =>
    stack(NARROW_GAP, ...NARROW_WIDTHS.map((width) => chart(spec, {width}))),
};

/**
 * `kpi.goodDirection: "down"` for metrics where less is better: a falling
 * churn rate shows its change as good (green) and a rising refund rate as
 * bad (red). Next to them, the default "up" for comparison.
 */
export const GoodDirectionDown: StoryObj<TilesArgs> = {
  ...shot('kpi-good-direction-down', 800, 500),
  args: {
    specs: [
      {
        title: 'Churn rate',
        format: {style: 'percent', unit: 'ratio'},
        timeZone: 'UTC',
        kpi: {
          basis: 'latest',
          value: 0.021,
          comparisonValue: 0.024,
          goodDirection: 'down',
        },
        chart: {type: 'kpi'},
        series: sparkline('Churn rate', 0.024, 0.021, 21),
        provenance: asOfNov1('customer_churn_rate'),
      },
      {
        title: 'Refund rate',
        format: {style: 'percent', unit: 'ratio'},
        timeZone: 'UTC',
        kpi: {
          basis: 'latest',
          value: 0.043,
          comparisonValue: 0.038,
          goodDirection: 'down',
        },
        chart: {type: 'kpi'},
        series: sparkline('Refund rate', 0.038, 0.043, 22),
        provenance: asOfNov1('refund_rate'),
      },
      {
        title: 'Conversion rate',
        format: {style: 'percent', unit: 'ratio'},
        timeZone: 'UTC',
        kpi: {basis: 'latest', value: 0.0412, comparisonValue: 0.0397},
        chart: {type: 'kpi'},
        series: sparkline('Conversion rate', 0.0397, 0.0412, 23),
        provenance: asOfNov1('checkout_conversion_rate'),
      },
    ],
  },
};

/**
 * `kpi.notation: "compact"` next to the standard value: "$294K" and "$3.8M"
 * on a tile read at a glance, while the exact figure stays in the accessible
 * name, the tooltip and the details table.
 */
export const Compact: StoryObj<TilesArgs> = {
  ...shot('01b-kpi-charts', 800, 500),
  args: {
    specs: [
      {
        title: 'MRR, compact',
        format: usd,
        timeZone: 'UTC',
        kpi: {
          basis: 'latest',
          value: 294_470,
          comparisonValue: 238_630,
          notation: 'compact',
        },
        chart: {type: 'kpi'},
        series: sparkline('MRR', 238_630, 294_470, 31),
        provenance: asOfNov1('mrr'),
      },
      {
        title: 'MRR',
        format: usd,
        timeZone: 'UTC',
        kpi: {basis: 'latest', value: 294_470, comparisonValue: 238_630},
        chart: {type: 'kpi'},
        series: sparkline('MRR', 238_630, 294_470, 31),
        provenance: asOfNov1('mrr'),
      },
      {
        title: 'New ARR, compact',
        format: usd,
        timeZone: 'UTC',
        kpi: {
          basis: 'latest',
          value: 3_798_040,
          comparisonValue: 3_705_405,
          notation: 'compact',
        },
        chart: {type: 'kpi'},
        series: sparkline('New ARR', 3_705_405, 3_798_040, 32),
        provenance: asOfNov1('new_arr'),
      },
      {
        title: 'New ARR',
        format: usd,
        timeZone: 'UTC',
        kpi: {basis: 'latest', value: 3_798_040, comparisonValue: 3_705_405},
        chart: {type: 'kpi'},
        series: sparkline('New ARR', 3_705_405, 3_798_040, 32),
        provenance: asOfNov1('new_arr'),
      },
    ],
  },
};

/**
 * Compact values in narrow tiles (280, 320 and 360px): "$1.5M +14.4%" stays
 * on one line at every width, where the full value pushes the change below
 * it. The narrowest tile steps the value down a type size.
 */
export const NarrowCompact: StoryObj<{spec: unknown}> = {
  ...shot('kpi-narrow-compact', 800, 500),
  args: {
    spec: {
      ...blackFridayTotal,
      kpi: {...blackFridayTotal.kpi, notation: 'compact'},
    },
  },
  render: ({spec}) =>
    stack(NARROW_GAP, ...NARROW_WIDTHS.map((width) => chart(spec, {width}))),
};
