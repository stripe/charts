import {render} from '../../index';
import type {ChartSpec} from '../../spec';

type ResizeCallback = (
  entries: {contentRect: {width: number; height: number}}[],
) => void;

const observers: ResizeCallback[] = [];
/** What each stub observes, for a test that resizes one element. */
const watched: {target: Element; callback: ResizeCallback}[] = [];

// jsdom has no layout and no ResizeObserver: the stub lets a test hand the
// chart a size, the way the browser does after the first layout.
class ResizeObserverStub {
  readonly disconnect = jest.fn();

  readonly observe: (target: Element) => void;

  readonly unobserve = jest.fn();

  constructor(callback: ResizeCallback) {
    observers.push(callback);
    this.observe = jest.fn((target: Element) => {
      watched.push({target, callback});
    });
  }
}

function resizeAll(width: number, height: number): void {
  for (const callback of observers) callback([{contentRect: {width, height}}]);
}

const SERIES: ChartSpec['series'] = [
  {
    label: '<b>2026</b>',
    data: [
      {x: '2026-11-27', y: 412000.25},
      {x: '2026-11-28', y: 298000},
    ],
  },
  {
    label: '2025',
    comparison: true,
    data: [
      {x: '2025-11-28', y: 350100},
      {x: '2025-11-29', y: null},
    ],
  },
];

const SPEC: ChartSpec = {
  title: 'Gross volume',
  timeZone: 'UTC',
  format: {style: 'currency', currency: 'usd', unit: 'major'},
  kpi: {basis: 'custom', value: 710000, comparisonValue: 601100},
  series: SERIES,
  provenance: {
    source: 'Example API',
    fetchedAt: '2026-11-27T18:00:00Z',
    details: [{label: 'Metric', value: '<script>alert(1)</script>'}],
  },
};

function infoButton(element: HTMLElement): HTMLButtonElement {
  const button = element.querySelector<HTMLButtonElement>(
    'button[aria-controls]',
  );
  if (!button) throw new Error('no details button');
  return button;
}

/** The accessible name of the focused element, when it names itself by reference. */
function focusedName(): string | null {
  const id = document.activeElement?.getAttribute('aria-labelledby');
  return id ? document.getElementById(id)?.textContent ?? null : null;
}

function cellTexts(row: Element): string[] {
  return [...row.children].map((cell) => cell.textContent ?? '');
}

let element: HTMLElement;

beforeEach(() => {
  observers.length = 0;
  watched.length = 0;
  (globalThis as {ResizeObserver?: unknown}).ResizeObserver =
    ResizeObserverStub;
  element = document.createElement('div');
  document.body.appendChild(element);
});

afterEach(() => {
  element.remove();
});

describe('details view', () => {
  it('offers no details when the spec turns them off', () => {
    render(element, {...SPEC, details: false});
    expect(element.querySelector('button[aria-controls]')).toBeNull();
    expect(element.querySelector('section')).toBeNull();
  });

  it('tabulates the data as text, with comparison dates', () => {
    render(element, SPEC);
    infoButton(element).click();

    const table = element.querySelector('table');
    expect(table?.querySelector('caption')?.textContent).toBe('Data');
    const head = [...(table?.querySelectorAll('thead th') ?? [])];
    expect(head.map((th) => th.getAttribute('scope'))).toEqual([
      'col',
      'col',
      'col',
    ]);
    expect(cellTexts(head[0].parentElement as Element)).toEqual([
      'Date',
      '<b>2026</b>',
      '2025',
    ]);
    const rows = [
      ...(table?.querySelectorAll('tbody:not(.sc-table-sizer) tr') ?? []),
    ];
    expect(rows[0].querySelector('th')?.getAttribute('scope')).toBe('row');
    expect(cellTexts(rows[0])).toEqual([
      'Nov 27',
      '$412,000',
      'Nov 28$350,100',
    ]);
    expect(cellTexts(rows[1])).toEqual(['Nov 28', '$298,000', '–No value']);

    const view = element.querySelector('section');
    expect(view?.textContent).toContain('Example API');
    expect(view?.textContent).toContain('Nov 27, 2026, 6:00 PM UTC');
    expect(view?.textContent).toContain('<script>alert(1)</script>');
    expect(element.querySelector('b, script')).toBeNull();
  });

  it('moves focus into the view and back to the button', () => {
    render(element, {...SPEC, provenance: undefined});
    const button = infoButton(element);
    const view = document.getElementById(
      button.getAttribute('aria-controls') ?? '',
    );
    button.focus();
    button.click();

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(view?.hidden).toBe(false);
    // Focus is in the view, a region named by the header's title, which
    // the view itself doesn't repeat.
    expect(view?.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.getAttribute('role')).toBe('region');
    expect(focusedName()).toBe('Gross volume');
    expect(view?.textContent).not.toContain('Gross volume');

    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}),
    );
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(view?.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
  });
});

describe('details notes and row status', () => {
  it('lists annotations and the incomplete period, and flags their rows', () => {
    const day = (n: number): string =>
      `2026-11-${String(26 + n).padStart(2, '0')}`;
    render(element, {
      title: 'Orders',
      timeZone: 'UTC',
      format: {style: 'number'},
      chart: {type: 'line', incomplete: {from: day(2)}},
      annotations: [
        {label: 'Black Friday', description: 'Doors open at 6 AM', at: day(1)},
      ],
      series: [
        {
          label: '2026',
          data: [
            {x: day(0), y: 10},
            {x: day(1), y: 20},
            {x: day(2), y: 30, projected: 45},
            {x: day(3), y: 40, forecast: true, low: 35, high: 45},
          ],
        },
      ],
    });
    infoButton(element).click();

    const notes = [...element.querySelectorAll('.sc-details-note')].map(
      (note) => note.textContent,
    );
    expect(notes[0]).toBe('Black FridayNov 27Doors open at 6 AM');
    expect(notes[1]).toContain('Nov 28');
    expect(notes).toHaveLength(2);

    const head = [...element.querySelectorAll('thead th')].map(
      (th) => th.textContent,
    );
    expect(head).toEqual(['Date', '2026', 'Status']);
    const rows = [
      ...element.querySelectorAll('tbody:not(.sc-table-sizer) tr'),
    ].map((row) => [...row.children].map((cell) => cell.textContent));
    expect(rows[1]).toEqual(['Nov 27', '20', '']);
    // An incomplete point's projection reads under what it has so far.
    expect(rows[2]).toEqual([
      'Nov 28',
      '30so far \u00b7 on pace for 45',
      'Incomplete',
    ]);
    expect(rows[3]).toEqual(['Nov 29', '4035\u201345', 'Forecast']);
    const keys = [...element.querySelectorAll('.sc-legend-key')].map(
      (key) => key.textContent,
    );
    expect(keys).toEqual(['Forecast', 'On pace']);
  });
});

describe('KPI tile panel', () => {
  it('leaves the screen when closed, not just hidden', () => {
    render(element, {...SPEC, chart: {type: 'kpi'}});
    const button = infoButton(element);
    button.click();
    const panel = element.querySelector<HTMLElement>('section');
    if (!panel) throw new Error('no panel');
    expect(getComputedStyle(panel).display).not.toBe('none');

    button.click();
    expect(panel.hidden).toBe(true);
    expect(getComputedStyle(panel).display).toBe('none');
  });

  it('closes on Escape even when focus has fallen back to the page', () => {
    render(element, {...SPEC, chart: {type: 'kpi'}});
    const button = infoButton(element);
    button.click();
    const view = element.querySelector<HTMLElement>('section');
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}),
    );
    expect(view?.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
  });

  it('closes when another chart opens its panel', () => {
    const other = document.createElement('div');
    document.body.appendChild(other);
    render(element, {...SPEC, chart: {type: 'kpi'}});
    render(other, {...SPEC, chart: {type: 'kpi'}});
    infoButton(element).click();
    infoButton(other).click();
    expect(element.querySelector<HTMLElement>('section')?.hidden).toBe(true);
    expect(other.querySelector<HTMLElement>('section')?.hidden).toBe(false);
    other.remove();
  });

  it('stays open for presses inside it when drawn into an iframe', () => {
    // The iframe's document has its own window and its own Node, as in a
    // page that renders into a same-origin frame.
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const frameDocument = frame.contentDocument;
    const frameWindow = frame.contentWindow;
    if (!frameDocument || !frameWindow) throw new Error('no iframe document');
    // The iframe window's own constructor; DOM typings do not list it.
    const FrameMouseEvent = (frameWindow as unknown as typeof globalThis)
      .MouseEvent;
    const host = frameDocument.createElement('div');
    frameDocument.body.appendChild(host);
    render(host, {...SPEC, chart: {type: 'kpi'}});
    infoButton(host).click();
    const panel = host.querySelector<HTMLElement>('section');
    const press = (target: Element): void => {
      target.dispatchEvent(new FrameMouseEvent('pointerdown', {bubbles: true}));
    };

    press(host.querySelector('table') as Element);
    expect(panel?.hidden).toBe(false);
    press(frameDocument.body);
    expect(panel?.hidden).toBe(true);
    frame.remove();
  });

  it('stays open for presses inside it when drawn into a closed shadow root', () => {
    // Seen from the document, a closed root hides both the pressed node and
    // the composed path inside it.
    const outer = document.createElement('div');
    document.body.appendChild(outer);
    const host = document.createElement('div');
    outer.attachShadow({mode: 'closed'}).appendChild(host);
    render(host, {...SPEC, chart: {type: 'kpi'}});
    infoButton(host).click();
    const panel = host.querySelector<HTMLElement>('section');
    const press = (target: Element): void => {
      target.dispatchEvent(
        new MouseEvent('pointerdown', {bubbles: true, composed: true}),
      );
    };

    press(host.querySelector('table') as Element);
    expect(panel?.hidden).toBe(false);
    press(document.body);
    expect(panel?.hidden).toBe(true);
    outer.remove();
  });
});

describe('floating panel placement', () => {
  it('moves the panel at most once a frame while rows fill in, and not once capped', () => {
    const frames = new Map<number, FrameRequestCallback>();
    let next = 1;
    const view = window as unknown as {
      requestAnimationFrame?: typeof window.requestAnimationFrame | undefined;
      cancelAnimationFrame?: typeof window.cancelAnimationFrame | undefined;
    };
    const saved = {...view};
    view.requestAnimationFrame = (callback) => {
      frames.set(next, callback);
      next += 1;
      return next - 1;
    };
    view.cancelAnimationFrame = (handle) => {
      frames.delete(handle);
    };
    const runFrames = (): void => {
      for (const [handle, callback] of [...frames]) {
        frames.delete(handle);
        callback(0);
      }
    };
    try {
      render(element, {...SPEC, chart: {type: 'kpi'}});
      const button = infoButton(element);
      button.click();
      const panel = element.querySelector<HTMLElement>('section');
      if (!panel) throw new Error('no panel');
      // jsdom has no layout, so give the panel the cap a viewport would.
      panel.style.maxHeight = '400px';
      const grew = (height: number): void => {
        for (const {callback} of watched.filter((w) => w.target === panel)) {
          callback([
            {
              contentRect: {width: 280, height},
              borderBoxSize: [{inlineSize: 280, blockSize: height}],
            } as unknown as {contentRect: {width: number; height: number}},
          ]);
        }
      };
      const reads = jest.spyOn(button, 'getBoundingClientRect');

      for (const height of [120, 180, 240, 300]) grew(height);
      expect(reads).not.toHaveBeenCalled();
      runFrames();
      expect(reads).toHaveBeenCalledTimes(1);

      grew(400);
      runFrames();
      expect(reads).toHaveBeenCalledTimes(1);
    } finally {
      view.requestAnimationFrame = saved.requestAnimationFrame;
      view.cancelAnimationFrame = saved.cancelAnimationFrame;
    }
  });

  it('narrows the panel below its minimum width on a narrow phone', () => {
    const width = jest.spyOn(document.documentElement, 'clientWidth', 'get');
    width.mockReturnValue(320);
    try {
      render(element, {...SPEC, chart: {type: 'kpi'}});
      infoButton(element).click();
      const panel = element.querySelector<HTMLElement>('section');
      // 320px less the 8px kept clear on each side.
      expect(panel?.style.minWidth).toBe('304px');
      expect(panel?.style.maxWidth).toBe('304px');
    } finally {
      width.mockRestore();
    }
  });

  it('caps a tall panel at its maximum height even when the viewport has room', () => {
    const root = document.documentElement;
    const viewport = jest.spyOn(root, 'clientHeight', 'get');
    viewport.mockReturnValue(2000);
    const rects = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function rect(this: HTMLElement) {
        const height = this.tagName === 'SECTION' ? 900 : 20;
        return {
          ...{x: 0, y: 0, left: 0, top: 0, right: 320, width: 320},
          height,
          bottom: height,
          toJSON: () => ({}),
        };
      });
    try {
      render(element, {...SPEC, chart: {type: 'kpi'}});
      infoButton(element).click();
      const panel = element.querySelector<HTMLElement>('section');
      expect(panel?.style.maxHeight).toBe('480px');
    } finally {
      viewport.mockRestore();
      rects.mockRestore();
    }
  });
});

describe('long details table', () => {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  const runFrames = (): void => {
    for (const [handle, callback] of [...frames]) {
      frames.delete(handle);
      callback(0);
    }
  };
  const view = window as unknown as {
    // Optional: jsdom may not have them; restored as found.
    requestAnimationFrame?: typeof window.requestAnimationFrame | undefined;
    cancelAnimationFrame?: typeof window.cancelAnimationFrame | undefined;
  };
  const saved = {...view};

  beforeEach(() => {
    frames.clear();
    view.requestAnimationFrame = (callback) => {
      frames.set(nextFrame, callback);
      nextFrame += 1;
      return nextFrame - 1;
    };
    view.cancelAnimationFrame = (handle) => {
      frames.delete(handle);
    };
  });

  afterEach(() => {
    view.requestAnimationFrame = saved.requestAnimationFrame;
    view.cancelAnimationFrame = saved.cancelAnimationFrame;
  });

  const DAY_MS = 24 * 60 * 60 * 1000;
  const LONG: ChartSpec = {
    title: 'Orders',
    series: [
      {
        label: '2026',
        data: Array.from({length: 600}, (_, index) => ({
          x: new Date(Date.UTC(2025, 0, 1) + index * DAY_MS)
            .toISOString()
            .slice(0, 10),
          y: index,
        })),
      },
    ],
  };
  const rows = (): number =>
    element.querySelectorAll('tbody:not(.sc-table-sizer) tr').length;

  it('fills in steps without moving focus, and stops on destroy', () => {
    const chart = render(element, LONG);
    infoButton(element).click();
    expect(rows()).toBe(100);
    for (let frame = 0; frame < 4; frame += 1) runFrames();
    expect(rows()).toBe(600);
    expect(element.querySelectorAll('table')).toHaveLength(1);
    expect(focusedName()).toBe('Orders');

    chart.update(LONG);
    infoButton(element).click();
    runFrames();
    expect(rows()).toBe(250);
    chart.destroy();
    expect(frames.size).toBe(0);
    runFrames();
    expect(element.childNodes).toHaveLength(0);
  });
});

describe('KPI sparkline', () => {
  it('draws the series and shows the hovered slot in the KPI', () => {
    render(element, {
      ...SPEC,
      chart: {type: 'kpi'},
      kpi: {...SPEC.kpi, value: 710000, goodDirection: 'down'},
    });
    resizeAll(96, 56);
    const lines = element.querySelectorAll('.sc-sparkline path.sc-spark-line');
    expect(lines).toHaveLength(2);
    expect(lines[0].classList.contains('sc-comparison')).toBe(true);
    expect(lines[1].getAttribute('d')).toMatch(/^M[\d.,]+L[\d.,]+$/);

    const kpi = (): string =>
      element.querySelector('.sc-kpi')?.textContent ?? '';
    const resting = kpi();
    const sparkline = element.querySelector('.sc-sparkline') as HTMLElement;
    sparkline.dispatchEvent(new MouseEvent('pointermove', {clientX: 4}));
    expect(kpi()).toBe('$412,000+17.7%');
    expect(
      element
        .querySelector('.sc-kpi-change')
        ?.classList.contains('sc-change-bad'),
    ).toBe(true);
    sparkline.dispatchEvent(new MouseEvent('pointerleave'));
    expect(kpi()).toBe(resting);

    sparkline.dispatchEvent(
      new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}),
    );
    expect(kpi()).toBe('$412,000+17.7%');
  });
});
