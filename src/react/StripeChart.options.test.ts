import {act, createContext, createElement, useContext} from 'react';
import type {ReactElement} from 'react';
import {createRoot} from 'react-dom/client';
import type {Root} from 'react-dom/client';

import type {ChartSpec} from '../index';
import {StripeChart} from './index';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT =
  true;

type ResizeCallback = (
  entries: {contentRect: {width: number; height: number}}[],
) => void;

const observers: ResizeCallback[] = [];

// jsdom has no layout and no ResizeObserver: the stub lets a test hand the
// chart a size, the way the browser does after the first layout.
class ResizeObserverStub {
  readonly disconnect = jest.fn();

  readonly observe = jest.fn();

  readonly unobserve = jest.fn();

  constructor(callback: ResizeCallback) {
    observers.push(callback);
  }
}

const SPEC: ChartSpec = {
  title: 'Gross volume',
  series: [
    {
      label: '2026',
      data: [
        {x: '2026-11-27', y: 412000},
        {x: '2026-11-28', y: 298000},
      ],
    },
  ],
};

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  observers.length = 0;
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function showChart(element: ReactElement): HTMLElement {
  act(() => root.render(element));
  act(() => {
    for (const callback of observers) {
      callback([{contentRect: {width: 600, height: 300}}]);
    }
  });
  const area = host.querySelector<HTMLElement>('[tabindex="0"]');
  if (!area) throw new Error('no focusable plot area');
  return area;
}

function pressKey(target: HTMLElement, key: string): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true}));
  });
}

test('renderTooltip content is rendered by React inside the tooltip box', () => {
  const Unit = createContext('none');
  function Row({x}: {x: string}): ReactElement {
    return createElement('b', null, `${x} in ${useContext(Unit)}`);
  }
  const area = showChart(
    createElement(
      Unit.Provider,
      {value: 'USD'},
      createElement(StripeChart, {
        spec: SPEC,
        renderTooltip: (context) => createElement(Row, {x: context.x}),
      }),
    ),
  );
  pressKey(area, 'ArrowRight');

  const tooltip = host.querySelector<HTMLElement>('.sc-tooltip');
  expect(tooltip?.hidden).toBe(false);
  // The portal keeps the app's context, so content can use its providers.
  expect(tooltip?.querySelector('b')?.textContent).toBe('2026-11-27 in USD');
});

test('a new callback identity is used without redrawing the chart', () => {
  const first = jest.fn();
  const area = showChart(
    createElement(StripeChart, {spec: SPEC, onPointHover: first}),
  );
  const content = host.querySelector('.sc-root')?.firstElementChild;

  const second = jest.fn();
  act(() =>
    root.render(createElement(StripeChart, {spec: SPEC, onPointHover: second})),
  );
  expect(host.querySelector('.sc-root')?.firstElementChild).toBe(content);

  pressKey(area, 'ArrowRight');
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledWith(
    expect.objectContaining({index: 0, x: '2026-11-27'}),
  );
});
