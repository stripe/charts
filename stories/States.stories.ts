import type {Meta, StoryObj} from '@storybook/html';

import {shot} from '../.storybook/shots';
import {recordChart} from '../.storybook/code';
import grossVolume from '../examples/daily-gross-volume.json';
import {render} from '../src/index';
import {
  COLUMN_WIDTH,
  chart,
  cleanUpCharts,
  column,
  onCleanUp,
  stack,
  track,
} from './support/mount';

const FULL_HEIGHT = 600;
const HEIGHT = 400;
const NARROW_WIDTH = 328;

type Args = {spec: unknown};

const meta: Meta<Args> = {
  title: 'Features/States',
  beforeEach: cleanUpCharts,
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: FULL_HEIGHT})),
};

export default meta;

// Fetched before the first day had any activity.
const notYetProvenance = {
  ...grossVolume.provenance,
  fetchedAt: '2026-11-26T04:00:00Z',
};

const emptySeries = [
  {label: '2026', data: []},
  {label: '2025', comparison: true, data: []},
];

/** Every series is empty: the header and KPI stay, the plot says so. */
export const EmptyLine: StoryObj<Args> = {
  ...shot('07-empty-line', 800, 640),
  args: {
    spec: {
      title: 'Gross volume',
      timeZone: 'UTC',
      description: 'November 26–30',
      format: {style: 'currency', currency: 'usd', unit: 'major'},
      chart: {type: 'line'},
      series: emptySeries,
      provenance: notYetProvenance,
    },
  },
};

/** A custom `emptyMessage`, in the caller's words, for an empty plot. */
export const EmptyCustomMessage: StoryObj<Args> = {
  args: {
    spec: {
      title: 'Disputes',
      description: 'Opened this week',
      format: {style: 'number', maximumFractionDigits: 0},
      chart: {type: 'bar'},
      series: [{label: 'Disputes opened', data: []}],
      emptyMessage: 'No disputes this week',
    },
  },
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: HEIGHT})),
};

/** The empty state for a bar chart. */
export const EmptyBar: StoryObj<Args> = {
  ...shot('07b-empty-bar', 800, 640),
  args: {
    spec: {
      title: 'Orders',
      timeZone: 'UTC',
      description: 'November 26–30',
      format: {style: 'number'},
      chart: {type: 'bar'},
      series: emptySeries,
      provenance: {
        ...notYetProvenance,
        details: notYetProvenance.details.map((detail) =>
          detail.label === 'Metric'
            ? {...detail, value: 'successful_payments_count'}
            : detail,
        ),
      },
    },
  },
};

/**
 * An invalid spec: `render` draws a card listing every issue with its field
 * path and throws a `SpecError` with the same text.
 */
export const ValidationError: StoryObj<Args> = {
  ...shot('09-error-line', 800, 640),
  args: {
    spec: {
      title: 'Gross volume',
      subtitle: 'November 26–30',
      format: {style: 'currency'},
      chart: {type: 'area'},
      series: [
        {
          label: '2026',
          data: [
            {x: 'Nov 27', y: 412000.25},
            {x: '2026-11-28', y: '338950.80'},
          ],
        },
      ],
    },
  },
};

/**
 * Every string is rendered as text. Markup in the title, a series label or
 * a provenance value is shown literally and never parsed.
 */
export const MarkupAsText: StoryObj<Args> = {
  args: {
    spec: {
      ...grossVolume,
      title: '<img src=x onerror="alert(1)"> Gross volume',
      description: '<b>Not bold</b> &amp; not an entity',
      series: grossVolume.series.map((series) => ({
        ...series,
        label: `<i>${series.label}</i>`,
      })),
      provenance: {
        ...grossVolume.provenance,
        details: [{label: '<script>', value: '<a href="#">not a link</a>'}],
      },
    },
  },
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: HEIGHT})),
};

/** A narrow container: fewer ticks and labels, nothing overflows. */
export const Narrow: StoryObj<Args> = {
  ...shot('narrow-360', 360, 500),
  args: {spec: grossVolume},
  render: ({spec}) => chart(spec, {width: NARROW_WIDTH, height: HEIGHT}),
};

const FETCH_DELAY_MS = 1500;
const LOADING_GAP = 32;
const LOADING_HEIGHT = 220;

/** What a caller knows before the data arrives: the header and the shape. */
function loadingSpec(type: 'line' | 'bar' | 'kpi'): unknown {
  return {
    title: grossVolume.title,
    description: grossVolume.description,
    format: grossVolume.format,
    chart: {type},
    loading: true,
  };
}

/**
 * `loading: true` while the data is being fetched: the header shows, and a
 * placeholder shaped by `chart.type` stands in for the KPI and plot.
 */
export const Loading: StoryObj = {
  ...shot('loading', 800, 640),
  render: () =>
    column(
      stack(
        LOADING_GAP,
        chart(loadingSpec('line'), {
          width: COLUMN_WIDTH,
          height: LOADING_HEIGHT,
        }),
        chart(loadingSpec('bar'), {
          width: COLUMN_WIDTH,
          height: LOADING_HEIGHT,
        }),
        chart(loadingSpec('kpi'), {width: COLUMN_WIDTH / 2}),
      ),
    ),
};

/**
 * The usual flow: render the placeholder, then call `update` with the data
 * when it arrives. Use "Replay" to watch the transition again.
 */
export const LoadingThenData: StoryObj = {
  render: () => {
    const element = document.createElement('div');
    element.style.width = `${COLUMN_WIDTH}px`;
    element.style.height = `${HEIGHT}px`;
    const handle = track(render(element, loadingSpec('line')));
    recordChart({
      spec: loadingSpec('line'),
      width: COLUMN_WIDTH,
      height: HEIGHT,
      steps: [
        {
          kind: 'update-after',
          delayMs: FETCH_DELAY_MS,
          spec: grossVolume,
          note: 'Later, when the data arrives:',
        },
      ],
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fetchData = (): void => {
      clearTimeout(timer);
      handle.update(loadingSpec('line'));
      timer = setTimeout(() => handle.update(grossVolume), FETCH_DELAY_MS);
    };
    onCleanUp(() => clearTimeout(timer));
    fetchData();

    const replay = document.createElement('button');
    replay.type = 'button';
    replay.textContent = 'Replay';
    replay.addEventListener('click', fetchData);
    return column(stack(LOADING_GAP / 2, replay, element));
  },
};

/**
 * `loading: true` on a spec that has data means it is being refreshed: the
 * chart keeps its data in place with the KPI and plot dimmed and a shimmer
 * sweeping over the plot (no sweep under reduced motion), and is marked
 * `aria-busy`, until the next `update`. The title and description stay at
 * full strength.
 */
export const Updating: StoryObj<Args> = {
  args: {spec: {...grossVolume, loading: true}},
  render: ({spec}) =>
    column(chart(spec, {width: COLUMN_WIDTH, height: HEIGHT})),
};
