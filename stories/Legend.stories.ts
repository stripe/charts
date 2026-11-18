import type {Meta, StoryObj} from '@storybook/html';

import {shot} from '../.storybook/shots';
import type {ChartSpec, Series} from '../src/index';
import {curve, dates, points} from './support/data';
import {COLUMN_WIDTH, chart, cleanUpCharts, column} from './support/mount';

const HEIGHT = 400;

type Args = {spec: ChartSpec};

/**
 * The legend shows for 3 or more series (or whenever a forecast needs
 * explaining) and is interactive: a click (or Enter or Space) hides or
 * shows a series at once, and a double-click (or Shift+Enter) shows only
 * that series (again to show all). The last visible series can't be
 * hidden. Hidden series leave the plot, the tooltip and the y axis in the
 * same frame, without animation; the KPI doesn't
 * change.
 */
const meta: Meta<Args> = {
  title: 'Features/Legend',
  beforeEach: cleanUpCharts,
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: HEIGHT})),
};

export default meta;

export const Palette: StoryObj<Args> = {
  args: {
    spec: {
      title: 'Series palette',
      chart: {type: 'bar', legend: 'show'},
      series: Array.from({length: 12}, (_, index) => ({
        label: `Series ${index + 1}`,
        data: [{x: '2026-10-01', y: 100}],
      })),
    },
  },
  render: ({spec}) => chart(spec, {width: '100%', height: 400}),
};

const DAYS = dates('2026-11-01', 30);

function regionSeries(
  label: string,
  from: number,
  to: number,
  seed: number,
): Series {
  return {
    label,
    data: points(DAYS, curve(DAYS.length, from, to, {jitter: 0.25, seed})),
  };
}

const byRegion: ChartSpec = {
  title: 'Gross volume by region',
  description: 'November 2026, daily',
  format: {style: 'currency', currency: 'usd', unit: 'major'},
  timeZone: 'UTC',
  chart: {type: 'line'},
  series: [
    regionSeries('North America', 182_000, 296_000, 51),
    regionSeries('Europe', 96_000, 151_000, 52),
    regionSeries('Asia Pacific', 61_000, 88_000, 53),
    regionSeries('Latin America', 24_000, 39_000, 54),
  ],
};

/** Four series with the legend below the plot. Click an entry to try it. */
export const Interactive: StoryObj<Args> = {
  ...shot('legend-interactive', 800, 500),
  args: {spec: byRegion},
};

/**
 * After clicking "North America": its line is gone and the y axis re-fits
 * to the remaining series at once, so the smaller regions become readable.
 */
export const OneHidden: StoryObj<Args> = {
  ...shot('legend-one-hidden', 800, 500),
  args: {spec: byRegion},
  play: ({canvasElement}) => {
    const entry = [
      ...canvasElement.querySelectorAll('button[aria-pressed]'),
    ].find((button) => button.textContent?.trim() === 'North America');
    (entry as HTMLButtonElement | undefined)?.click();
  },
};

/** `chart.legend: "show"` adds the legend to a two-series chart. */
export const ShownForTwoSeries: StoryObj<Args> = {
  args: {
    spec: {
      ...byRegion,
      title: 'Gross volume, two regions',
      chart: {type: 'line', legend: 'show'},
      series: byRegion.series?.slice(0, 2) ?? [],
    },
  },
};

/** `chart.legend: "hide"` leaves it out; the tooltip still names every series. */
export const Hidden: StoryObj<Args> = {
  args: {spec: {...byRegion, chart: {type: 'line', legend: 'hide'}}},
};
