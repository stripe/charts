import type {Meta, StoryObj} from '@storybook/html';
import {orderSpec} from './support/specs';

import {shot} from '../.storybook/shots';
import type {ChartSpec} from '../src/index';
import {provenance} from './support/provenance';
import {hoverShot} from './support/shots';
import {addDays, curve, dates, last, points} from './support/data';
import {
  CELL_WIDTH,
  COLUMN_WIDTH,
  caption,
  chart,
  cleanUpCharts,
  column,
  grid,
} from './support/mount';

const FULL_HEIGHT = 600;
const CELL_HEIGHT = 252;
const ROW_HEIGHT = 356;

type SingleArgs = {spec: ChartSpec};
type GridArgs = {cells: {caption: string; spec: ChartSpec}[]};

const meta: Meta = {
  title: 'Charts/Line',
  beforeEach: cleanUpCharts,
};

export default meta;

export const Overview: StoryObj = {
  render: () => chart(orderSpec, {width: '100%', height: 320}),
};

// Daily recurring revenue that is almost flat, with a short dip and a step
const DAILY_START = '2026-08-01';
const DAILY_STEPS: [fromDay: number, value: number][] = [
  [0, 1_111_525],
  [27, 1_111_518],
  [29, 1_111_357],
  [34, 1_111_345],
  [43, 1_111_385],
  [44, 1_111_765],
  [60, 1_111_768],
  [70, 1_111_771],
  [83, 1_111_757],
];
const DAILY_COUNT = 93;

function dailyValue(day: number): number {
  let value = DAILY_STEPS[0]?.[1] ?? 0;
  for (const [fromDay, stepValue] of DAILY_STEPS) {
    if (day >= fromDay) value = stepValue;
  }
  return value;
}

const recurringRevenue: ChartSpec = {
  title: 'Monthly recurring revenue',
  timeZone: 'UTC',
  description: 'Monthly recurring revenue over time',
  format: {style: 'currency', currency: 'usd', unit: 'major'},
  kpi: {basis: 'latest', value: 1_111_757},
  chart: {type: 'line'},
  provenance: provenance({
    metric: 'mrr',
    period: 'Aug 1 to Nov 1, 2026, daily',
    fetchedAt: '2026-11-02T08:15:00Z',
  }),
  series: [
    {
      label: 'Recurring revenue',
      data: points(
        dates(DAILY_START, DAILY_COUNT),
        Array.from({length: DAILY_COUNT}, (_, day) => dailyValue(day)),
      ),
    },
  ],
};

/** A single series with a title, description and headline KPI. */
export const WithKpi: StoryObj<SingleArgs> = {
  ...shot('02-line-header-kpi', 800, 640),
  args: {spec: recurringRevenue},
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: FULL_HEIGHT})),
};

// Thirteen weekly points ending on the same day, compared with four
// different earlier periods. Each comparison series keeps its own dates and
const WEEKS = 13;
const WEEK = 7;
const END = '2026-11-01';
const START = addDays(END, -(WEEKS - 1) * WEEK);
const current = curve(WEEKS, 240_150, 298_640, {
  bend: 1.6,
  jitter: 0.02,
  seed: 4,
});

type Comparison = {caption: string; offsetDays: number; values: number[]};

const comparisons: Comparison[] = [
  {
    caption: 'Previous period',
    offsetDays: -WEEKS * WEEK,
    values: curve(WEEKS, 292_300, 242_010, {bend: 0.8, jitter: 0.02, seed: 7}),
  },
  {
    caption: 'Same dates a month earlier',
    offsetDays: -28,
    values: curve(WEEKS, 243_200, 275_250, {bend: 2, jitter: 0.02, seed: 9}),
  },
  {
    caption: 'A quarter earlier',
    offsetDays: -91,
    values: curve(WEEKS, 231_900, 242_010, {bend: 1.2, jitter: 0.03, seed: 11}),
  },
  {
    caption: 'A year earlier',
    offsetDays: -364,
    values: curve(WEEKS, 205_600, 242_610, {bend: 1.3, jitter: 0.02, seed: 13}),
  },
];

function comparisonSpec({
  caption: name,
  offsetDays,
  values,
}: Comparison): ChartSpec {
  const comparisonSeries = {
    label: 'Previous period',
    comparison: true,
    data: points(dates(addDays(START, offsetDays), WEEKS, WEEK), values),
  };
  const currentSeries = {
    label: 'Current period',
    data: points(dates(START, WEEKS, WEEK), current),
  };
  return {
    title: 'MRR',
    timeZone: 'UTC',
    format: {style: 'currency', currency: 'usd', unit: 'major'},
    kpi: {
      basis: 'latest',
      value: last(currentSeries),
      comparisonValue: last(comparisonSeries),
    },
    provenance: provenance({
      metric: 'mrr',
      period: `${START} to ${END}, weekly`,
      comparedWith: `${name}: ${comparisonSeries.data[0]?.x ?? ''} to ${
        comparisonSeries.data[WEEKS - 1]?.x ?? ''
      }`,
      fetchedAt: '2026-11-02T08:15:00Z',
    }),
    chart: {type: 'line'},
    series: [currentSeries, comparisonSeries],
  };
}

const comparisonCells = comparisons.map((comparison) => ({
  caption: comparison.caption,
  spec: comparisonSpec(comparison),
}));

function renderGrid({cells}: GridArgs): HTMLElement {
  return column(
    grid(
      cells.map((cell) =>
        caption(
          cell.caption,
          chart(cell.spec, {width: CELL_WIDTH, height: CELL_HEIGHT}),
        ),
      ),
      {rowHeight: ROW_HEIGHT},
    ),
  );
}

/**
 * The current period against four earlier periods. The comparison series is
 * dashed and muted; the KPI change compares the last points.
 */
export const Comparison: StoryObj<GridArgs> = {
  ...shot('04-comparison-line', 800, 500),
  args: {cells: comparisonCells},
  render: renderGrid,
};

/**
 * The comparison grid with the pointer over the first chart, showing the
 * crosshair, point markers and tooltip. A screenshot script moves the
 * pointer to `parameters.pointer` (viewport coordinates).
 */
export const ComparisonHover: StoryObj<GridArgs> = {
  ...hoverShot('05-hover-comparison-line', 800, 500, {x: 200, y: 200}),
  args: {cells: comparisonCells},
  render: renderGrid,
};
