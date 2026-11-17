import type {Meta, StoryObj} from '@storybook/html';

import {shot} from '../.storybook/shots';
import grossVolume from '../examples/daily-gross-volume.json';
import byHour from '../examples/hourly-orders.json';
import summary from '../examples/volume-kpi.json';
import orders from '../examples/daily-orders.json';
import yen from '../examples/jpy-gross-volume.json';
import {COLUMN_WIDTH, chart, cleanUpCharts, column} from './support/mount';
import {hoverShot} from './support/shots';

const HEIGHT = 400;

type Args = {spec: unknown};

/**
 * Daily volume compared with the corresponding period last year. Each spec is a plain JSON file in `examples/`.
 *
 * The 2026 and 2025 series cover different calendar dates (Nov 26, 2026 and Nov 27, 2025) and line up by position, so each slot
 * compares the same weekday. The tooltip is headed by the 2026 date; each
 * 2025 point's own date is in the screen-reader announcement for the slot
 * and in the details table.
 */
const meta: Meta<Args> = {
  title: 'Examples/Reporting',
  beforeEach: cleanUpCharts,
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: HEIGHT})),
};

export default meta;

/** Daily gross volume in USD, 2026 against 2025, with provenance. */
export const GrossVolume: StoryObj<Args> = {
  ...shot('report-gross-volume', 800, 500),
  args: {spec: grossVolume},
};

/**
 * While a day is hovered (or focused with the arrow keys), the KPI shows that
 * day's 2026 value and its change against the same weekday in 2025. It goes
 * back to the total on leave. The pointer is over Campaign launch.
 */
export const KpiFollowsHover: StoryObj<Args> = {
  ...hoverShot('report-kpi-hover', 800, 500, {x: 228, y: 260}),
  args: {spec: grossVolume},
};

/** Daily order counts as bars, 2026 against 2025. */
export const Orders: StoryObj<Args> = {
  ...shot('report-orders', 800, 500),
  args: {spec: orders},
};

/** The the reporting period total (4 days) as a KPI-only card. */
export const Summary: StoryObj<Args> = {
  ...shot('report-kpi', 800, 500),
  args: {spec: summary},
  render: ({spec}) => column(chart(spec, {width: COLUMN_WIDTH / 2})),
};

/**
 * Hourly values as ISO date-times in UTC, shown in the spec's time zone
 * (`America/New_York`), never the viewer's.
 */
export const ByHour: StoryObj<Args> = {
  ...shot('report-hourly', 800, 500),
  args: {spec: byHour},
};

/** Japanese yen, a zero-decimal currency, with the `ja-JP` locale. */
export const Yen: StoryObj<Args> = {
  ...shot('report-jpy', 800, 500),
  args: {spec: yen},
};
