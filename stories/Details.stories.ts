import type {Meta, StoryObj} from '@storybook/html';

import {shot} from '../.storybook/shots';
import grossVolume from '../examples/bfcm-gross-volume.json';
import type {ChartSpec} from '../src/index';
import {addDays, curve, dates, last, points} from './support/data';
import {
  CELL_WIDTH,
  COLUMN_WIDTH,
  chart,
  cleanUpCharts,
  column,
  grid,
} from './support/mount';
import {provenance} from './support/provenance';

const CELL_HEIGHT = 252;
const FULL_HEIGHT = 400;

type Args = {spec: unknown};

const INFO_BUTTON = 'button.sc-info';

/** Opens the first chart's details view the way a user does: a click. */
function openDetails({canvasElement}: {canvasElement: HTMLElement}): void {
  canvasElement.querySelector<HTMLElement>(INFO_BUTTON)?.click();
}

/**
 * Every chart with data has an info button after its title. Clicking it
 * (or Enter or Space) opens a details view: the source and fetch time when
 * the spec has `provenance`, the caller's details, and the data as a table.
 * It replaces the plot in place when it fits there; in tiles and small
 * charts it opens as a panel by the button, sized to its content and kept
 * in the viewport, with only the table scrolling. Escape or the button
 * closes it and returns focus to the button.
 */
const meta: Meta<Args> = {
  title: 'Features/Details',
  beforeEach: cleanUpCharts,
};

export default meta;

const grossVolumeWithoutProvenance = {...grossVolume, provenance: undefined};

/** The details view open in a grid cell, next to the same chart at rest. */
export const Open: StoryObj<Args> = {
  ...shot('06b-details-after-info-click', 800, 500),
  args: {spec: grossVolume},
  render: ({spec}) =>
    column(
      grid([
        chart(spec, {width: CELL_WIDTH, height: CELL_HEIGHT}),
        chart(spec, {width: CELL_WIDTH, height: CELL_HEIGHT}),
      ]),
    ),
  play: openDetails,
};

/** At rest. The info button is always there, at low emphasis. */
export const Closed: StoryObj<Args> = {
  args: {spec: grossVolume},
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: FULL_HEIGHT})),
};

/**
 * A chart without `provenance` still has the details view: the table is the
 * accessible way to read the values.
 */
export const TableOnly: StoryObj<Args> = {
  args: {spec: grossVolumeWithoutProvenance},
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: FULL_HEIGHT})),
  play: openDetails,
};

/** Only a source: no fetch time and no details, then the table. */
export const SourceOnly: StoryObj<Args> = {
  args: {
    spec: {...grossVolume, provenance: {source: 'Exported from a spreadsheet'}},
  },
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: FULL_HEIGHT})),
  play: openDetails,
};

// Thirteen weeks against the previous thirteen: more rows than fit, so the
const WEEKS = 13;
const WEEK = 7;
const START = '2026-08-09';
const current = {
  label: 'Current period',
  data: points(
    dates(START, WEEKS, WEEK),
    curve(WEEKS, 240_150, 298_640, {bend: 1.6, jitter: 0.02, seed: 4}),
  ),
};
const previous = {
  label: 'Previous period',
  comparison: true,
  data: points(
    dates(addDays(START, -WEEKS * WEEK), WEEKS, WEEK),
    curve(WEEKS, 292_300, 242_010, {bend: 0.8, jitter: 0.02, seed: 7}),
  ),
};

const weeklyMrr: ChartSpec = {
  title: 'MRR',
  timeZone: 'UTC',
  format: {style: 'currency', currency: 'usd', unit: 'major'},
  kpi: {basis: 'latest', value: last(current), comparisonValue: last(previous)},
  chart: {type: 'line'},
  series: [current, previous],
  provenance: provenance({
    metric: 'mrr',
    period: 'Aug 9 to Nov 1, 2026, weekly',
    comparedWith: 'Previous 13 weeks, May 10 to Aug 2, 2026',
    fetchedAt: '2026-11-02T08:15:00Z',
  }),
};

/**
 * Thirteen weekly rows in a grid cell: the view opens as a panel by the
 * button, and only its table scrolls, under a pinned header row. Comparison
 * cells show their own date.
 */
export const LongTable: StoryObj<Args> = {
  ...shot('details-long-table', 800, 500),
  args: {spec: weeklyMrr},
  render: ({spec}) =>
    column(grid([chart(spec, {width: CELL_WIDTH, height: CELL_HEIGHT})])),
  play: openDetails,
};

/**
 * `details: false` leaves out the info button, so the details view can't be
 * opened, for example on dense dashboard tiles. The accessible summary is
 * unchanged.
 */
export const Off: StoryObj<Args> = {
  args: {spec: {...grossVolume, details: false}},
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: FULL_HEIGHT})),
};
