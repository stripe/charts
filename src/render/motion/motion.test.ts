import type {ChartSpec} from '../../spec';
import {render} from '..';
import {buildModel} from '../../model';
import type {MotionEnvironment} from '.';
import {growBars, interpolateModel} from './plotTransition';

type ResizeCallback = (
  entries: {contentRect: {width: number; height: number}}[],
) => void;

const observers: ResizeCallback[] = [];

// jsdom has no layout: the stub hands the chart a size, as the browser does
// after the first layout.
class ResizeObserverStub {
  readonly disconnect = jest.fn();

  readonly observe = jest.fn();

  readonly unobserve = jest.fn();

  constructor(callback: ResizeCallback) {
    observers.push(callback);
  }
}

function resizeAll(width: number, height: number): void {
  for (const callback of observers) callback([{contentRect: {width, height}}]);
}

function manualEnvironment({reducedMotion}: {reducedMotion: boolean}): {
  environment: MotionEnvironment;
  advance(ms: number): void;
  pendingFrames(): number;
  animations: {cancel: jest.Mock; element: Element}[];
} {
  let time = 0;
  let nextHandle = 1;
  const frames = new Map<number, (now: number) => void>();
  const animations: {cancel: jest.Mock; element: Element}[] = [];
  const environment: MotionEnvironment = {
    now: () => time,
    requestFrame(callback) {
      const handle = nextHandle;
      nextHandle += 1;
      frames.set(handle, callback);
      return handle;
    },
    cancelFrame: (handle) => frames.delete(handle),
    prefersReducedMotion: () => reducedMotion,
    animate(element) {
      // Like the real API: cancel() fires the `cancel` event.
      const listeners: Record<string, (() => void)[]> = {};
      const animation = {
        element,
        cancel: jest.fn(() => {
          for (const listener of listeners.cancel ?? []) listener();
        }),
        addEventListener: (type: string, listener: () => void) => {
          (listeners[type] ??= []).push(listener);
        },
      };
      animations.push(animation);
      return animation as unknown as Animation;
    },
  };
  return {
    environment,
    advance(ms) {
      time += ms;
      const due = [...frames.values()];
      frames.clear();
      for (const callback of due) callback(time);
    },
    pendingFrames: () => frames.size,
    animations,
  };
}

const BARS: ChartSpec = {
  version: 1,
  title: 'Orders',
  chart: {type: 'bar'},
  series: [
    {
      label: '2026',
      data: [
        {x: '2026-11-26', y: 120},
        {x: '2026-11-27', y: 340},
        {x: '2026-11-28', y: 210},
      ],
    },
  ],
};

const LINES: ChartSpec = {
  version: 1,
  title: 'Orders',
  series: [
    {label: '2026', data: (BARS.series ?? [])[0]?.data ?? []},
    {
      label: '2025',
      comparison: true,
      data: [
        {x: '2025-11-27', y: 100},
        {x: '2025-11-28', y: 280},
        {x: '2025-11-29', y: 190},
      ],
    },
  ],
};

const UPDATED: ChartSpec = {
  ...BARS,
  series: [
    {
      label: '2026',
      data: [
        {x: '2026-11-26', y: 400},
        {x: '2026-11-27', y: 90},
        {x: '2026-11-28', y: 260},
      ],
    },
  ],
};

function geometry(root: HTMLElement): string[] {
  const bars = [...root.querySelectorAll('.sc-bar')].map((bar) =>
    ['x', 'y', 'width', 'height'].map((a) => bar.getAttribute(a)).join(','),
  );
  const lines = [...root.querySelectorAll('.sc-line')].map(
    (line) => line.getAttribute('d') ?? '',
  );
  const clipped = root.querySelector('[clip-path]') ? ['clipped'] : [];
  return [...bars, ...lines, ...clipped];
}

function settledGeometry(spec: ChartSpec, next?: ChartSpec): string[] {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const page = manualEnvironment({reducedMotion: false});
  const chart = render(host, spec, {}, page.environment);
  resizeAll(600, 300);
  page.advance(10_000);
  if (next) {
    chart.update(next);
    resizeAll(600, 300);
    page.advance(10_000);
  }
  const result = geometry(host);
  chart.destroy();
  host.remove();
  return result;
}

let element: HTMLElement;

beforeEach(() => {
  observers.length = 0;
  (globalThis as {ResizeObserver?: unknown}).ResizeObserver =
    ResizeObserverStub;
  element = document.createElement('div');
  document.body.appendChild(element);
});

afterEach(() => {
  element.remove();
});

describe('motion', () => {
  it('applies the final geometry at once under reduced motion', () => {
    for (const spec of [BARS, LINES]) {
      const page = manualEnvironment({reducedMotion: true});
      const chart = render(element, spec, {}, page.environment);
      resizeAll(600, 300);
      expect(geometry(element)).toEqual(settledGeometry(spec));

      chart.update(UPDATED);
      resizeAll(600, 300);
      expect(geometry(element)).toEqual(settledGeometry(spec, UPDATED));

      chart.update({version: 1, title: 'Orders', loading: true});
      expect(element.querySelector('.sc-updating')).not.toBeNull();
      expect(geometry(element)).toEqual(settledGeometry(spec, UPDATED));
      chart.destroy();

      const tile = render(
        element,
        {...BARS, chart: {type: 'kpi'}, kpi: {basis: 'custom', value: 670}},
        {},
        page.environment,
      );
      expect(element.querySelector('.sc-sparkline')).not.toBeNull();
      tile.destroy();

      const loading = render(
        element,
        {version: 1, title: 'Orders', loading: true},
        {},
        page.environment,
      );
      expect(element.querySelector('.sc-skeleton')).not.toBeNull();
      expect(page.animations).toHaveLength(0);
      expect(page.pendingFrames()).toBe(0);
      loading.destroy();
    }
  });

  it('draws dense bar charts once and animates whole series', () => {
    const days = 400;
    const dense: ChartSpec = {
      version: 1,
      title: 'Orders',
      chart: {type: 'bar'},
      series: ['A', 'B', 'C', 'D'].map((label, seriesIndex) => ({
        label,
        data: Array.from({length: days}, (_, day) => ({
          x: new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10),
          y: 100 + seriesIndex * 10 + (day % 7),
        })),
      })),
    };
    const page = manualEnvironment({reducedMotion: false});
    render(element, dense, {}, page.environment);
    resizeAll(600, 300);
    expect(page.pendingFrames()).toBe(0);
    expect(geometry(element)).toEqual(settledGeometry(dense));
    expect(page.animations.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps a filled gap inside the plot while the y scale tweens', () => {
    const line = (values: (number | null)[]): ChartSpec => ({
      version: 1,
      title: 'Orders',
      series: [
        {
          label: '2026',
          data: values.map((y, day) => ({x: `2026-11-2${6 + day}`, y})),
        },
      ],
    });
    const gap = buildModel(line([1, null, 2]));
    const filled = buildModel(line([1, 1000, 2]));
    for (let step = 0; step <= 10; step += 1) {
      const frame = interpolateModel(gap, filled, step / 10);
      const [low, high] = frame.yDomain;
      const y = frame.slots[1]?.points[0]?.y ?? NaN;
      expect(y).toBeGreaterThanOrEqual(low);
      expect(y).toBeLessThanOrEqual(high);
    }
    const opening = interpolateModel(filled, gap, 0.5);
    expect(opening.slots[1]?.points[0]?.y).toBeNull();
  });

  it('grows a filled bar gap from the baseline, never past it', () => {
    const bars = (values: (number | null)[]): ChartSpec => ({
      version: 1,
      title: 'Orders',
      chart: {type: 'bar'},
      series: [
        {
          label: '2026',
          data: values.map((y, day) => ({x: `2026-11-2${6 + day}`, y})),
        },
      ],
    });
    const gap = buildModel(bars([-100, null, 100]));
    const filled = buildModel(bars([-100, 10, 1000]));
    const start = interpolateModel(gap, filled, 0, true);
    expect(start.slots[1]?.points[0]?.y).toBe(0);
    for (let step = 1; step <= 10; step += 1) {
      const frame = interpolateModel(gap, filled, step / 10, true);
      expect(frame.slots[1]?.points[0]?.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('leaves hidden series out of stacks that grow on entrance', () => {
    const stacked: ChartSpec = {
      version: 1,
      title: 'Orders',
      chart: {type: 'bar', stacking: 'stacked'},
      series: [
        {label: 'A', data: [{x: '2026-11-26', y: 100}]},
        {label: 'B', data: [{x: '2026-11-26', y: 10}]},
      ],
    };
    const model = buildModel(stacked, {hidden: new Set(['A'])});
    const grown = growBars(model, () => 0.5);
    // Only B is stacked, from 0, not on top of hidden A.
    expect(grown.slots[0]?.stack).toEqual([
      {seriesIndex: 1, y0: 0, y1: 5, actualY1: 5},
    ]);
  });

  it('keeps a refreshing chart dimmed when it re-renders mid-refresh', () => {
    const page = manualEnvironment({reducedMotion: false});
    const chart = render(element, BARS, {}, page.environment);
    resizeAll(600, 300);
    const dims = (): number =>
      page.animations.filter(({element: target}) =>
        target.matches('.sc-plot-area > svg'),
      ).length;
    chart.update({...BARS, loading: true});
    expect(dims()).toBe(1);
    // Re-rendered while still refreshing (new options, a legend press):
    // dimmed at once, not eased in again from full strength.
    chart.update({...BARS, loading: true});
    expect(element.querySelector('.sc-updating .sc-sweep')).not.toBeNull();
    expect(dims()).toBe(1);
    chart.destroy();
  });

  it('keeps the refresh sweep running across an instant legend redraw', () => {
    const page = manualEnvironment({reducedMotion: false});
    const spec: ChartSpec = {
      ...LINES,
      chart: {type: 'line', legend: 'show'},
      loading: true,
    };
    const chart = render(element, spec, {}, page.environment);
    resizeAll(600, 300);
    const sweeps = (): number =>
      page.animations.filter(
        ({element: target, cancel}) =>
          target.matches('.sc-sweep') &&
          target.isConnected &&
          cancel.mock.calls.length === 0,
      ).length;
    expect(sweeps()).toBe(1);
    const press = element.querySelector<HTMLButtonElement>(
      'button[aria-pressed]',
    );
    expect(press?.getAttribute('aria-pressed')).toBe('true');
    press?.click();
    expect(
      element
        .querySelector('button[aria-pressed]')
        ?.getAttribute('aria-pressed'),
    ).toBe('false');
    // Redrawn at once with the series hidden, and still visibly refreshing.
    expect(element.querySelector('.sc-updating')).not.toBeNull();
    expect(sweeps()).toBe(1);
    chart.destroy();
  });

  it('skips the entrance of a chart that is off screen', () => {
    const page = manualEnvironment({reducedMotion: false});
    render(element, BARS, {}, {...page.environment, inView: () => false});
    resizeAll(600, 300);
    // No frame-by-frame redraws and nothing moving in the plot; only the
    // header's compositor fade is left, which costs next to nothing.
    expect(page.pendingFrames()).toBe(0);
    expect(
      page.animations.filter(({element: target}) =>
        target.closest('.sc-plot-area'),
      ),
    ).toHaveLength(0);
    expect(geometry(element)).toEqual(settledGeometry(BARS));
  });

  it('cancels animations and leaves the element empty on destroy mid-animation', () => {
    const page = manualEnvironment({reducedMotion: false});
    const chart = render(
      element,
      {version: 1, title: 'Orders', loading: true, chart: {type: 'bar'}},
      {},
      page.environment,
    );
    chart.update(BARS);
    resizeAll(600, 300);
    page.advance(100);
    expect(geometry(element)).not.toEqual(settledGeometry(BARS));
    expect(page.pendingFrames()).toBe(1);
    expect(page.animations.length).toBeGreaterThan(0);

    chart.destroy();
    expect(page.pendingFrames()).toBe(0);
    for (const animation of page.animations) {
      expect(animation.cancel).toHaveBeenCalled();
    }
    expect(element.childNodes).toHaveLength(0);

    page.advance(1000);
    expect(element.childNodes).toHaveLength(0);
  });
});
