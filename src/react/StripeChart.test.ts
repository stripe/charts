import {act, createElement, StrictMode} from 'react';
import type {ReactElement} from 'react';
import {createRoot} from 'react-dom/client';
import type {Root} from 'react-dom/client';

import type {ChartSpec} from '../index';
import {SpecError} from '../index';
import {StripeChart} from './index';
import type {StripeChartProps} from './index';

// Tells React that updates are wrapped in act(), so it flushes effects
// synchronously and doesn't warn.
(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT =
  true;

function spec(title: string): ChartSpec {
  return {
    version: 1,
    title,
    series: [
      {
        label: '2026',
        data: [
          {x: '2026-11-27', y: 412000.25},
          {x: '2026-11-28', y: 298000},
        ],
      },
    ],
  };
}

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function show(element: ReactElement): void {
  act(() => root.render(element));
}

function showChart(props: StripeChartProps): void {
  show(createElement(StripeChart, {...props, id: 'chart'}));
}

function container(): HTMLElement {
  const element = host.querySelector<HTMLElement>('#chart');
  if (!element) throw new Error('no container');
  return element;
}

function chartRoots(): NodeListOf<HTMLElement> {
  return container().querySelectorAll<HTMLElement>(':scope > .sc-root');
}

test('mounting draws the chart into the container', () => {
  showChart({spec: spec('Gross volume')});
  expect(chartRoots()).toHaveLength(1);
  expect(container().textContent).toContain('Gross volume');
});

test('a new spec updates the chart in place; an equal one changes nothing', () => {
  showChart({spec: spec('Gross volume')});
  const [first] = chartRoots();
  const firstContent = first?.firstElementChild;

  // A new object with the same value, as an inline literal would be.
  showChart({spec: spec('Gross volume')});
  expect(chartRoots()[0]?.firstElementChild).toBe(firstContent);

  showChart({spec: spec('Net volume')});
  expect(chartRoots()).toHaveLength(1);
  expect(chartRoots()[0]).toBe(first);
  expect(container().textContent).toContain('Net volume');
  expect(container().textContent).not.toContain('Gross volume');
});

test('unmounting destroys the chart and empties the container', () => {
  const ref: {current: HTMLDivElement | null} = {current: null};
  act(() => root.render(createElement(StripeChart, {spec: spec('A'), ref})));
  const element = ref.current;
  expect(element?.childElementCount).toBe(1);

  act(() => root.render(createElement('div')));
  expect(ref.current).toBeNull();
  expect(element?.childElementCount).toBe(0);
});

test('an invalid spec shows the error card and calls onError without throwing', () => {
  const onError = jest.fn();
  const invalid = {version: 1, title: ''} as ChartSpec;
  expect(() => showChart({spec: invalid, onError})).not.toThrow();
  expect(onError).toHaveBeenCalledTimes(1);
  const error: unknown = onError.mock.calls[0]?.[0];
  expect(error).toBeInstanceOf(SpecError);
  expect(container().querySelector('[role="alert"]')?.textContent).toContain(
    'title',
  );

  showChart({spec: spec('Gross volume'), onError});
  expect(container().querySelector('[role="alert"]')).toBeNull();
  expect(chartRoots()).toHaveLength(1);
  expect(onError).toHaveBeenCalledTimes(1);
});

test('a value JSON cannot tell from null is still validated', () => {
  const onError = jest.fn();
  const withY = (y: number | null): ChartSpec => ({
    version: 1,
    title: 'Gross volume',
    series: [{label: '2026', data: [{x: '2026-11-27', y}]}],
  });
  showChart({spec: withY(null), onError});
  expect(onError).not.toHaveBeenCalled();

  showChart({spec: withY(NaN), onError});
  expect(onError).toHaveBeenCalledTimes(1);
  expect(container().querySelector('[role="alert"]')).not.toBeNull();
});

test('StrictMode double mount leaves exactly one chart', () => {
  show(
    createElement(
      StrictMode,
      null,
      createElement(StripeChart, {spec: spec('Gross volume'), id: 'chart'}),
    ),
  );
  expect(container().childElementCount).toBe(1);
  expect(chartRoots()).toHaveLength(1);
});
