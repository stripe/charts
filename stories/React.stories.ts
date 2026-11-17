import type {Meta, StoryObj} from '@storybook/html';
import {createElement, StrictMode, useState} from 'react';
import type {ReactElement} from 'react';
import {createRoot} from 'react-dom/client';

import grossVolume from '../examples/bfcm-gross-volume.json';
import orders from '../examples/bfcm-orders.json';
import type {ChartSpec} from '../src/index';
import {StripeChart} from '../src/react/index';
import {reactCode} from '../.storybook/code';
import {COLUMN_WIDTH, cleanUpCharts, onCleanUp} from './support/mount';

const HEIGHT = 400;

/**
 * The `<StripeChart>` component from the `react` entry point. This
 * Storybook renders plain HTML, so each story mounts a React root into its
 * frame (in StrictMode, as most apps do) and unmounts it when the story
 * changes.
 */
const meta: Meta = {
  title: 'React/StripeChart',
  beforeEach: cleanUpCharts,
};

export default meta;

/** Mounts `element` in a new React root, unmounted on the next story. */
function mount(element: ReactElement): HTMLElement {
  const frame = document.createElement('div');
  frame.style.width = `${COLUMN_WIDTH}px`;
  frame.style.margin = '0 auto';
  const root = createRoot(frame);
  root.render(createElement(StrictMode, null, element));
  onCleanUp(() => root.unmount());
  return frame;
}

// JSON files have widened types (`"currency"` is read as `string`). The
const GROSS_VOLUME = grossVolume as ChartSpec;
const ORDERS = orders as ChartSpec;
/** Invalid on purpose: an empty title. */
const INVALID: ChartSpec = {...GROSS_VOLUME, title: ''};

/** A line chart from a spec, with a height on the container. */
export const Basic: StoryObj = {
  parameters: {
    code: reactCode({
      specs: {spec: GROSS_VOLUME},
      component: `export function GrossVolume() {
  return <StripeChart spec={spec} style={{height: 400}} />;
}`,
    }),
  },
  render: () =>
    mount(
      createElement(StripeChart, {spec: GROSS_VOLUME, style: {height: HEIGHT}}),
    ),
};

/** Switches between two metrics with React state. */
function MetricToggle(): ReactElement {
  const [metric, setMetric] = useState<'volume' | 'orders'>('volume');
  const next = metric === 'volume' ? 'orders' : 'volume';
  return createElement(
    'div',
    null,
    createElement(
      'button',
      {type: 'button', onClick: () => setMetric(next)},
      next === 'orders' ? 'Show orders' : 'Show gross volume',
    ),
    createElement(StripeChart, {
      spec: metric === 'volume' ? GROSS_VOLUME : ORDERS,
      style: {height: HEIGHT, marginTop: 12},
    }),
  );
}

/**
 * A new spec from state updates the chart in place, with the update
 * transition, rather than mounting a new one.
 */
export const LiveUpdate: StoryObj = {
  parameters: {
    code: reactCode({
      specs: {grossVolume: GROSS_VOLUME, orders: ORDERS},
      reactImports: ['useState'],
      component: `export function MetricToggle() {
  const [metric, setMetric] = useState<'volume' | 'orders'>('volume');
  const next = metric === 'volume' ? 'orders' : 'volume';
  return (
    <div>
      <button type="button" onClick={() => setMetric(next)}>
        {next === 'orders' ? 'Show orders' : 'Show gross volume'}
      </button>
      {/* A new spec updates the chart in place. */}
      <StripeChart
        spec={metric === 'volume' ? grossVolume : orders}
        style={{height: 400, marginTop: 12}}
      />
    </div>
  );
}`,
    }),
  },
  render: () => mount(createElement(MetricToggle)),
};

/** Reports an invalid spec's issues below the chart, through `onError`. */
function WithErrorReport({spec}: {spec: ChartSpec}): ReactElement {
  const [issues, setIssues] = useState<number | null>(null);
  return createElement(
    'div',
    null,
    createElement(StripeChart, {
      spec,
      style: {height: HEIGHT},
      onError: (error) => setIssues(error.errors.length),
    }),
    createElement(
      'p',
      null,
      issues === null ? 'No issues' : `onError received ${issues} issue(s)`,
    ),
  );
}

/**
 * An invalid spec shows the error card in place of the chart. The component
 * does not throw; it reports the issues through `onError`.
 */
export const InvalidSpec: StoryObj = {
  parameters: {
    code: reactCode({
      specs: {spec: INVALID},
      reactImports: ['useState'],
      component: `export function WithErrorReport() {
  const [issues, setIssues] = useState<number | null>(null);
  return (
    <div>
      {/* An invalid spec shows the error card; nothing is thrown. */}
      <StripeChart
        spec={spec}
        style={{height: 400}}
        onError={(error) => setIssues(error.errors.length)}
      />
      <p>{issues === null ? 'No issues' : \`onError received \${issues} issue(s)\`}</p>
    </div>
  );
}`,
    }),
  },
  render: () => mount(createElement(WithErrorReport, {spec: INVALID})),
};

/** A custom tooltip in React, and the clicked day shown below the chart. */
function Events(): ReactElement {
  const [clicked, setClicked] = useState<string | null>(null);
  return createElement(
    'div',
    null,
    createElement(StripeChart, {
      spec: GROSS_VOLUME,
      style: {height: HEIGHT},
      renderTooltip: (context) =>
        createElement(
          'div',
          null,
          createElement('strong', null, context.title),
          context.series.map((series) =>
            createElement(
              'div',
              {key: series.label},
              `${series.label}: ${series.formatted}`,
            ),
          ),
        ),
      onPointClick: (event) => setClicked(event.x),
    }),
    createElement(
      'p',
      null,
      clicked === null ? 'Click a day' : `Clicked ${clicked}`,
    ),
  );
}

/**
 * `renderTooltip` returns React content, rendered through a portal into the
 * chart's tooltip box, which keeps its placement and announcement.
 * `onPointClick` can be an inline function: a new one on every render does
 * not redraw the chart.
 */
export const EventsAndCustomTooltip: StoryObj = {
  parameters: {
    code: reactCode({
      specs: {spec: GROSS_VOLUME},
      reactImports: ['useState'],
      component: `export function Events() {
  const [clicked, setClicked] = useState<string | null>(null);
  return (
    <div>
      <StripeChart
        spec={spec}
        style={{height: 400}}
        renderTooltip={(context) => (
          <div>
            <strong>{context.title}</strong>
            {context.series.map((series) => (
              <div key={series.label}>
                {series.label}: {series.formatted}
              </div>
            ))}
          </div>
        )}
        onPointClick={(event) => setClicked(event.x)}
      />
      <p>{clicked === null ? 'Click a day' : \`Clicked \${clicked}\`}</p>
    </div>
  );
}`,
    }),
  },
  render: () => mount(createElement(Events)),
};
