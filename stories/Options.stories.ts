import type {Meta, StoryObj} from '@storybook/html';

import {shot} from '../.storybook/shots';
import grossVolume from '../examples/daily-gross-volume.json';
import type {ChartSpec, PointEvent, TooltipContext} from '../src/index';
import {curve, dates, points} from './support/data';
import {
  COLUMN_WIDTH,
  chart,
  cleanUpCharts,
  column,
  stack,
} from './support/mount';
import {provenance} from './support/provenance';
import {hoverShot} from './support/shots';

const HEIGHT = 400;
const GAP = 16;
const LOG_LIMIT = 12;

type Args = {spec: unknown};

/**
 * Render options are the JavaScript-only third argument of
 * `render(element, spec, options)`: callbacks for clicks, hover and the
 * legend, a custom tooltip, and axis label formatters. The spec stays plain
 * JSON. Errors thrown by a callback are logged, never break the chart.
 */
const meta: Meta<Args> = {
  title: 'Examples/Options',
  beforeEach: cleanUpCharts,
};

export default meta;

function summarize(event: PointEvent | null): string {
  if (event === null) return 'left the plot';
  const values = event.series
    .map((series) => `${series.label} ${series.formatted}`)
    .join(', ');
  return `${event.x}: ${values}`;
}

/**
 * `onPointClick`, `onPointHover` and `onLegendChange`, written to an event
 * log under the chart. Click a day, move the pointer, or use the arrow keys
 * and Enter on the focused plot.
 */
export const Events: StoryObj<Args> = {
  args: {spec: grossVolume},
  render: ({spec}) => {
    const log = document.createElement('ol');
    log.setAttribute('aria-label', 'Event log');
    Object.assign(log.style, {
      margin: '0',
      paddingLeft: '20px',
      font: '12px/18px ui-monospace, Menlo, monospace',
      color: '#3c4f69',
      minHeight: `${LOG_LIMIT * 18}px`,
    });
    const write = (text: string): void => {
      const item = document.createElement('li');
      item.textContent = text;
      log.prepend(item);
      while (log.childElementCount > LOG_LIMIT) log.lastElementChild?.remove();
    };
    const element = chart(
      spec,
      {width: COLUMN_WIDTH, height: HEIGHT},
      {
        options: {
          onPointClick: (event) => write(`click  ${summarize(event)}`),
          onPointHover: (event) => write(`hover  ${summarize(event)}`),
          onLegendChange: (state) =>
            write(`legend hidden: ${state.hidden.join(', ') || 'none'}`),
        },
        source: `{
  onPointClick: (event) => console.log('click', event.x, event.series),
  onPointHover: (event) => console.log('hover', event && event.x),
  onLegendChange: (state) => console.log('hidden series', state.hidden),
}`,
      },
    );
    return column(stack(GAP, element, log));
  },
};

/** Builds the custom tooltip's contents: a heading and one line per series. */
function tooltipContents(context: TooltipContext): Node {
  const box = document.createElement('div');
  const heading = document.createElement('strong');
  heading.textContent = `Reporting period: ${context.title}`;
  box.append(heading);
  for (const series of context.series) {
    const line = document.createElement('div');
    line.textContent = `${series.label}: ${series.formatted} (${
      series.x ?? 'no data'
    })`;
    box.append(line);
  }
  return box;
}

/**
 * `renderTooltip` replaces the tooltip's contents with a node the page
 * builds (or a string, shown as text). The box, its placement and the
 * screen reader announcement stay the library's.
 */
export const CustomTooltip: StoryObj<Args> = {
  ...hoverShot('options-custom-tooltip', 800, 500, {x: 230, y: 260}),
  args: {spec: grossVolume},
  render: ({spec}) =>
    column(
      chart(
        spec,
        {width: COLUMN_WIDTH, height: HEIGHT},
        {
          options: {renderTooltip: tooltipContents},
          reactSource: `{
  renderTooltip: (context) => (
    <div>
      <strong>Reporting period: {context.title}</strong>
      {context.series.map((series) => (
        <div key={series.label}>
          {series.label}: {series.formatted} ({series.x ?? 'no data'})
        </div>
      ))}
    </div>
  ),
}`,
          source: `{
  renderTooltip: (context) => {
    const box = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = 'Reporting period: ' + context.title;
    box.append(heading);
    for (const series of context.series) {
      const line = document.createElement('div');
      line.textContent = series.label + ': ' + series.formatted + ' (' + (series.x ?? 'no data') + ')';
      box.append(line);
    }
    return box;
  },
}`,
        },
      ),
    ),
};

const MONTHS_2026 = Array.from(
  {length: 12},
  (_, i) => `2026-${String(i + 1).padStart(2, '0')}-01`,
);
const signups = {
  label: 'Signups',
  data: points(
    MONTHS_2026,
    curve(12, 1_840, 4_120, {bend: 1.4, jitter: 0.05, seed: 81}),
  ),
};

const signupsSpec: ChartSpec = {
  title: 'New signups',
  description: '2026, monthly',
  format: {style: 'number', maximumFractionDigits: 0},
  timeZone: 'UTC',
  chart: {
    type: 'bar',
    axes: {x: {labels: 'month'}, y: {notation: 'standard'}},
  },
  series: [signups],
  provenance: provenance({
    metric: 'customers_created_count',
    period: 'Jan to Dec 2026, monthly',
    fetchedAt: '2026-12-01T08:00:00Z',
  }),
};

/**
 * Axis settings in the spec (`chart.axes`: month labels on x, standard
 * numbers on y) plus `formatYTick` and `formatXTick` in the options, which
 * get each default label and can rewrite it. Labels are measured after
 * formatting, so they still don't collide.
 */
export const AxisFormatting: StoryObj<Args> = {
  ...shot('options-axis-formatting', 800, 500),
  args: {spec: signupsSpec},
  render: ({spec}) =>
    column(
      chart(
        spec,
        {width: COLUMN_WIDTH, height: HEIGHT},
        {
          options: {
            formatYTick: (_value, label) => `${label} signups`,
            formatXTick: (_x, label) => label.toUpperCase(),
          },
          source: `{
  formatYTick: (value, label) => label + ' signups',
  formatXTick: (x, label) => label.toUpperCase(),
}`,
        },
      ),
    ),
};

const WEEK = dates('2026-11-01', 30);

/**
 * `series[].color` sets a series color and, in bar charts,
 * `data[].color` one bar's. Prefer the default palette, and check the
 * contrast of custom colors against the background.
 */
export const Colors: StoryObj<Args> = {
  ...shot('options-colors', 800, 500),
  args: {
    spec: {
      title: 'Refunds',
      description: 'November 1–30; the record day highlighted',
      format: {style: 'currency', currency: 'usd', unit: 'major'},
      timeZone: 'America/New_York',
      chart: {type: 'bar'},
      series: [
        {
          label: 'Refunds',
          color: '#0E7490',
          data: points(
            WEEK,
            curve(WEEK.length, 28_640, 38_740, {jitter: 0.5, seed: 61}),
          ).map((point) =>
            point.x === '2026-11-27'
              ? {...point, y: 45_320, color: '#C2410C'}
              : point,
          ),
        },
      ],
      provenance: provenance({
        metric: 'refunds_amount',
        period: 'Nov 1 to Nov 30, 2026, daily',
        timeZone: 'America/New_York',
        fetchedAt: '2026-12-01T14:05:00Z',
      }),
    },
  },
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: HEIGHT})),
};
