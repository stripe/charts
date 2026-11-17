import {render} from '../index';
import type {ChartSpec} from '../spec';

type ResizeCallback = (
  entries: {contentRect: {width: number; height: number}}[],
) => void;

const observers: {callback: ResizeCallback; disconnect: jest.Mock}[] = [];

// jsdom has no layout and no ResizeObserver: the stub lets a test hand the
// chart a size, the way the browser does after the first layout.
class ResizeObserverStub {
  readonly disconnect = jest.fn();

  readonly observe = jest.fn();

  readonly unobserve = jest.fn();

  constructor(callback: ResizeCallback) {
    observers.push({callback, disconnect: this.disconnect});
  }
}

function resizeAll(width: number, height: number): void {
  for (const {callback} of observers)
    callback([{contentRect: {width, height}}]);
}

const SPEC: ChartSpec = {
  title: 'Gross volume',
  format: {style: 'currency', currency: 'usd', unit: 'major'},
  kpi: {basis: 'custom', value: 1284300.5, comparisonValue: 1012400},
  series: [
    {
      label: '2026',
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
        {x: '2025-11-29', y: 251000},
      ],
    },
  ],
  provenance: {
    source: 'Example API',
    details: [{label: 'Metric', value: 'gross_volume'}],
  },
};

function plotArea(element: HTMLElement): HTMLElement {
  const area = element.querySelector<HTMLElement>('[tabindex="0"]');
  if (!area) throw new Error('no focusable plot area');
  return area;
}

function pressKey(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true}));
}

// jsdom has no PointerEvent; a MouseEvent carrying pointerType stands in.
function pointer(target: Element, type: string, pointerType: string): void {
  const event = new MouseEvent(type, {clientX: 100, bubbles: true});
  Object.defineProperty(event, 'pointerType', {value: pointerType});
  target.dispatchEvent(event);
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

describe('render', () => {
  it.each(['line', 'bar'] as const)(
    'renders twelve %s series with the full categorical palette',
    (type) => {
      const colors = [
        '#9966FF',
        '#0055BC',
        '#00A1C2',
        '#ED6804',
        '#B3063D',
        '#1C5A0D',
        '#FA4A67',
        '#922700',
        '#3DA00B',
        '#9966FF',
        '#0055BC',
        '#00A1C2',
      ];
      const onPointHover = jest.fn();
      const handle = render(
        element,
        {
          title: 'Series palette',
          chart: {type},
          series: colors.map((_, index) => ({
            label: `Series ${index + 1}`,
            data: [
              {x: '2026-10-01', y: index + 1},
              {x: '2026-10-02', y: index + 2},
            ],
          })),
        },
        {onPointHover},
      );
      resizeAll(1200, 500);
      pressKey(plotArea(element), 'Home');
      expect(
        onPointHover.mock.calls
          .at(-1)?.[0]
          .series.map((series: {color: string}) => series.color),
      ).toEqual(colors);
      // Repeated colors still have independent theme slots.
      element
        .querySelector<HTMLElement>('.sc-root')
        ?.style.setProperty('--sc-series-primary-11', '#123456');
      pressKey(plotArea(element), 'End');
      expect(
        onPointHover.mock.calls
          .at(-1)?.[0]
          .series.map((series: {color: string}) => series.color),
      ).toEqual([...colors.slice(0, 11), '#123456']);
      handle.destroy();
    },
  );

  it('shows markup in spec strings as literal text', () => {
    const title = '<img src=x onerror="alert(1)">';
    const label = '<b>2026</b>';
    const detail = '<script>alert(2)</script>';
    render(element, {
      ...SPEC,
      title,
      series: (SPEC.series ?? []).map((series, index) =>
        index === 0 ? {...series, label} : series,
      ),
      provenance: {
        source: 'Example API',
        details: [{label: 'Metric', value: detail}],
      },
    });
    resizeAll(600, 300);
    plotArea(element).focus();
    pressKey(plotArea(element), 'ArrowRight');
    // The details view, where the provenance details are shown, is built
    // when it first opens.
    element.querySelector<HTMLButtonElement>('button.sc-info')?.click();

    expect(element.querySelector('img, b, script')).toBeNull();
    const text = element.textContent ?? '';
    expect(text).toContain(title);
    expect(text).toContain(label);
    expect(text).toContain(detail);
  });

  it('shows the slot in the tooltip and KPI, announcing comparison dates', () => {
    render(element, SPEC);
    resizeAll(600, 300);
    const area = plotArea(element);
    const kpi = (): string =>
      element.querySelector('.sc-kpi')?.textContent ?? '';
    const restingKpi = kpi();
    pressKey(area, 'ArrowRight');

    const tooltip = element.querySelector<HTMLElement>('.sc-tooltip');
    expect(tooltip?.hidden).toBe(false);
    expect(tooltip?.textContent).toContain('Nov 27');
    expect(tooltip?.textContent).not.toContain('Nov 28');
    // The comparison point's own date is still read out.
    expect(area.querySelector('[aria-live]')?.textContent).toContain(
      'Fri, Nov 28, 2025',
    );
    expect(kpi()).toBe('$412,000+17.7%');

    pressKey(area, 'Escape');
    expect(tooltip?.hidden).toBe(true);
    expect(kpi()).toBe(restingKpi);
  });

  it('keeps a tapped slot after the finger lifts, until a press elsewhere', () => {
    render(element, SPEC);
    resizeAll(600, 300);
    const area = plotArea(element);
    const tooltip = element.querySelector<HTMLElement>('.sc-tooltip');
    const kpi = (): string =>
      element.querySelector('.sc-kpi')?.textContent ?? '';
    const restingKpi = kpi();

    // Browsers send pointerleave right after a touch lifts.
    for (const type of ['pointerdown', 'pointerup', 'pointerleave'])
      pointer(area, type, 'touch');
    expect(tooltip?.hidden).toBe(false);
    expect(kpi()).toBe('$412,000+17.7%');

    pointer(document.body, 'pointerdown', 'touch');
    expect(tooltip?.hidden).toBe(true);
    expect(kpi()).toBe(restingKpi);

    // A finger that scrolls the page instead cancels, and keeps nothing.
    for (const type of ['pointerdown', 'pointercancel', 'pointerleave'])
      pointer(area, type, 'touch');
    expect(tooltip?.hidden).toBe(true);
    expect(kpi()).toBe(restingKpi);
  });

  it('reports clicks and Enter on a slot as point events', () => {
    const onPointClick = jest.fn();
    render(element, {...SPEC, chart: {type: 'bar'}}, {onPointClick});
    resizeAll(600, 300);
    const area = plotArea(element);
    expect(getComputedStyle(area).cursor).toBe('pointer');

    const bar = area.querySelector('.sc-bars[data-series="0"] rect');
    if (!bar) throw new Error('no bar drawn');
    bar.dispatchEvent(new MouseEvent('click', {clientX: 100, bubbles: true}));
    expect(onPointClick).toHaveBeenLastCalledWith(
      expect.objectContaining({
        index: 0,
        x: '2026-11-27',
        seriesLabel: '2026',
        series: [
          expect.objectContaining({
            label: '2026',
            y: 412000.25,
            formatted: '$412,000',
            kind: 'actual',
          }),
          expect.objectContaining({label: '2025', x: '2025-11-28'}),
        ],
        nativeEvent: expect.any(MouseEvent),
      }),
    );

    pressKey(area, 'End');
    pressKey(area, 'Enter');
    expect(onPointClick).toHaveBeenLastCalledWith(
      expect.objectContaining({index: 1, seriesLabel: null, nativeEvent: null}),
    );
  });

  it('reports the primary series x while the legend hides it', () => {
    const onPointClick = jest.fn();
    render(
      element,
      {...SPEC, chart: {type: 'line', legend: 'show'}},
      {
        onPointClick,
      },
    );
    resizeAll(600, 300);
    const primaryButton = [
      ...element.querySelectorAll<HTMLButtonElement>('.sc-legend-button'),
    ].find((button) => button.textContent?.includes('2026'));
    primaryButton?.dispatchEvent(
      new MouseEvent('click', {bubbles: true, detail: 0}),
    );
    resizeAll(600, 300);
    const area = plotArea(element);
    pressKey(area, 'ArrowRight');
    pressKey(area, 'Enter');

    const event = onPointClick.mock.calls[0][0];
    expect(event.series.map((s: {label: string}) => s.label)).toEqual(['2025']);
    expect(event.x).toBe('2026-11-27');
  });

  it('applies new options while a refresh keeps the previous data', () => {
    const before = jest.fn();
    const after = jest.fn();
    const chart = render(element, SPEC, {onPointClick: before});
    resizeAll(600, 300);
    chart.update({title: 'Gross volume', loading: true}, {onPointClick: after});
    resizeAll(600, 300);
    const area = plotArea(element);
    pressKey(area, 'ArrowRight');
    pressKey(area, 'Enter');

    expect(before).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledWith(
      expect.objectContaining({index: 0, x: '2026-11-27'}),
    );
    expect(element.querySelector('.sc-root')?.getAttribute('aria-busy')).toBe(
      'true',
    );
  });

  it('stays busy through a legend press while a refresh is pending', () => {
    const chart = render(element, {
      ...SPEC,
      chart: {type: 'line', legend: 'show'},
    });
    resizeAll(600, 300);
    chart.update({title: 'Gross volume', loading: true});
    const root = element.querySelector('.sc-root');
    expect(root?.getAttribute('aria-busy')).toBe('true');

    element
      .querySelector('.sc-legend-button')
      ?.dispatchEvent(new MouseEvent('click', {bubbles: true, detail: 0}));
    expect(
      element.querySelector('.sc-legend-button')?.getAttribute('aria-pressed'),
    ).toBe('false');
    expect(root?.getAttribute('aria-busy')).toBe('true');
  });

  it('shows a custom tooltip node or text, and the default for null', () => {
    const custom = document.createElement('strong');
    custom.textContent = 'Custom';
    const results: (Node | string | null)[] = [custom, '<b>text</b>', null];
    const renderTooltip = jest.fn(() => results.shift() ?? null);
    render(element, SPEC, {renderTooltip});
    resizeAll(600, 300);
    const area = plotArea(element);
    const tooltip = element.querySelector<HTMLElement>('.sc-tooltip');

    pressKey(area, 'ArrowRight');
    expect(renderTooltip).toHaveBeenLastCalledWith(
      expect.objectContaining({index: 0, title: 'Nov 27', annotations: []}),
    );
    expect(tooltip?.firstChild).toBe(custom);
    pressKey(area, 'ArrowRight');
    expect(tooltip?.textContent).toBe('<b>text</b>');
    expect(tooltip?.querySelector('b')).toBeNull();
    pressKey(area, 'ArrowLeft');
    expect(tooltip?.textContent).toContain('Nov 27');
    expect(tooltip?.contains(custom)).toBe(false);
  });

  it('keeps hovering when a callback throws, and reports the error', () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const onPointHover = jest.fn(() => {
      throw new Error('broken handler');
    });
    render(element, SPEC, {onPointHover});
    resizeAll(600, 300);
    pressKey(plotArea(element), 'ArrowRight');

    expect(element.querySelector<HTMLElement>('.sc-tooltip')?.hidden).toBe(
      false,
    );
    expect(element.querySelector('.sc-kpi')?.textContent).toBe(
      '$412,000+17.7%',
    );
    expect(error).toHaveBeenCalledWith(
      'onPointHover threw:',
      expect.any(Error),
    );
    error.mockRestore();
  });

  it('draws series and single bars in their own colors', () => {
    const onPointClick = jest.fn();
    render(
      element,
      {
        ...SPEC,
        chart: {type: 'bar'},
        series: (SPEC.series ?? []).map((series, index) =>
          index === 0
            ? {
                ...series,
                color: '#123456',
                data: [{...series.data[0], color: '#abcdef'}, series.data[1]],
              }
            : series,
        ),
      },
      {onPointClick},
    );
    resizeAll(600, 300);
    const bars = element.querySelector<SVGElement>('.sc-bars[data-series="0"]');
    expect(bars?.style.getPropertyValue('--sc-series-color')).toBe('#123456');
    const [first, second] = bars?.querySelectorAll<SVGElement>('.sc-bar') ?? [];
    expect(first.style.getPropertyValue('--sc-series-color')).toBe('#abcdef');
    expect(second.style.getPropertyValue('--sc-series-color')).toBe('');

    // A themed palette color reaches the event, as the marks draw it.
    element
      .querySelector<HTMLElement>('.sc-root')
      ?.style.setProperty('--sc-series-comparison', '#ff0000');
    const area = plotArea(element);
    pressKey(area, 'ArrowRight');
    pressKey(area, 'Enter');
    const [own, themed] = onPointClick.mock.calls[0][0].series;
    expect(own.color).toBe('#123456');
    expect(themed.color).toBe('#ff0000');
  });

  it('tags forecast rows with their range and lists annotations', () => {
    render(element, {
      ...SPEC,
      series: (SPEC.series ?? []).map((series, index) =>
        index === 0
          ? {
              ...series,
              data: [
                series.data[0],
                {
                  x: '2026-11-28',
                  y: 300000,
                  forecast: true,
                  low: 280000,
                  high: 320000,
                },
              ],
            }
          : series,
      ),
      annotations: [
        {label: 'Promo', description: 'Free shipping', at: '2026-11-28'},
      ],
    });
    resizeAll(600, 300);
    const area = plotArea(element);
    pressKey(area, 'End');

    const tooltip = element.querySelector<HTMLElement>('.sc-tooltip');
    expect(tooltip?.textContent).toContain('2026Forecast');
    expect(tooltip?.textContent).toContain('$280,000\u2013$320,000');
    expect(tooltip?.textContent).toContain('PromoFree shipping');
    expect(area.querySelector('[aria-live]')?.textContent).toContain(
      '2026: $300,000 (Forecast, $280,000\u2013$320,000)',
    );
  });

  it('keeps point annotations in series colors and names the series in hover notes', () => {
    render(element, {
      ...SPEC,
      series: (SPEC.series ?? []).map((series, index) => ({
        ...series,
        color: index === 0 ? '#9966FF' : '#2255BB',
      })),
      annotations: [
        {label: 'Peak', at: '2026-11-27', series: '2026'},
        {label: 'Prior peak', at: '2026-11-28', series: '2025'},
        {label: 'Launch', at: '2026-11-27'},
      ],
    });
    resizeAll(600, 300);
    const markers = element.querySelectorAll<SVGElement>(
      '.sc-annotation-point',
    );
    expect(
      Array.from(markers, (mark) =>
        mark.style.getPropertyValue('--sc-series-color'),
      ),
    ).toEqual(['#9966FF', '#2255BB']);
    expect(element.querySelector('.sc-annotation-glyph')).toBeNull();
    expect(element.querySelectorAll('.sc-annotation-line')).toHaveLength(1);
    const area = plotArea(element);
    pressKey(area, 'Home');
    expect(
      element
        .querySelector<SVGElement>('.sc-annotation-point-active')
        ?.style.getPropertyValue('--sc-series-color'),
    ).toBe('#9966FF');
    const note = element.querySelector('.sc-tooltip-note');
    expect(note?.querySelector('.sc-tooltip-note-label')?.textContent).toBe(
      '2026',
    );
    expect(
      note?.querySelector('.sc-tooltip-note-description')?.textContent,
    ).toBe('Peak');
    expect(area.querySelector('[aria-live]')?.textContent).toContain(
      '2026: Peak',
    );
    pressKey(area, 'End');
    expect(
      element
        .querySelector<SVGElement>('.sc-annotation-point-active')
        ?.style.getPropertyValue('--sc-series-color'),
    ).toBe('#2255BB');
    expect(element.querySelector('.sc-tooltip-note')?.textContent).toBe(
      '2025Prior peak',
    );
    pressKey(area, 'Escape');
    expect(element.querySelector('.sc-annotation-point-active')).toBeNull();
  });

  it('gives open ranges only their explicit boundary and chart-local gradients', () => {
    const spec: ChartSpec = {
      ...SPEC,
      annotations: [
        {label: 'Before', to: '2026-11-27'},
        {label: 'After', from: '2026-11-28'},
      ],
    };
    const other = document.createElement('div');
    element.appendChild(other);
    // Band slots leave space between the endpoint date and the plot edge.
    render(element, {...spec, chart: {type: 'bar'}});
    render(other, {...spec, chart: {type: 'bar'}});
    resizeAll(600, 300);
    const roots = [
      element.querySelector(':scope > .sc-root'),
      other.querySelector('.sc-root'),
    ];
    const ids = roots.map((root) => root?.querySelector('linearGradient')?.id);
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
    roots.forEach((root, index) => {
      expect(root?.querySelectorAll('.sc-annotation-line')).toHaveLength(2);
      expect(root?.querySelectorAll('.sc-annotation-range')).toHaveLength(2);
      expect(
        root?.querySelector('.sc-annotation-range')?.getAttribute('fill'),
      ).toBe(`url(#${ids[index]})`);
    });
  });

  it('gives hidden grouped series no band, so the rest fill the group', () => {
    const labels = ['A', 'B', 'C', 'D'];
    render(element, {
      title: 'Orders',
      chart: {type: 'bar', legend: 'show'},
      series: labels.map((label, index) => ({
        label,
        data: [
          {x: '2026-11-27', y: 10 + index},
          {x: '2026-11-28', y: 20 + index},
        ],
      })),
    });
    resizeAll(600, 300);
    const firstGroup = (): {
      count: number;
      left: number;
      right: number;
      filled: number;
    } => {
      const rects = [
        ...element.querySelectorAll<SVGRectElement>('.sc-bars rect.sc-bar'),
      ]
        .map((rect) => ({
          x: Number(rect.getAttribute('x')),
          width: Number(rect.getAttribute('width')),
        }))
        .sort((a, b) => a.x - b.x)
        .slice(0, element.querySelectorAll('.sc-bars').length);
      return {
        count: rects.length,
        left: rects[0].x,
        right: Math.max(...rects.map((r) => r.x + r.width)),
        filled: rects.reduce((sum, r) => sum + r.width, 0),
      };
    };
    const before = firstGroup();

    [...element.querySelectorAll('.sc-legend-button')]
      .find((button) => button.textContent?.includes('C'))
      ?.dispatchEvent(new MouseEvent('click', {bubbles: true, detail: 0}));
    resizeAll(600, 300);
    const after = firstGroup();

    expect(before.count).toBe(4);
    expect(after.count).toBe(3);
    expect(after.left).toBeCloseTo(before.left, 1);
    expect(after.right).toBeCloseTo(before.right, 1);
    // No gap where the hidden series was.
    expect(after.filled).toBeCloseTo(after.right - after.left, 1);
  });

  it('reads an incomplete point as so far and on pace for its projection', () => {
    const onPointHover = jest.fn();
    render(
      element,
      {
        ...SPEC,
        chart: {type: 'line', incomplete: {from: '2026-11-28'}},
        series: (SPEC.series ?? []).map((series, index) =>
          index === 0
            ? {
                ...series,
                data: [
                  series.data[0],
                  {x: '2026-11-28', y: 298000, projected: 420000},
                ],
              }
            : series,
        ),
      },
      {onPointHover},
    );
    resizeAll(600, 300);
    const area = plotArea(element);
    pressKey(area, 'End');

    const tooltip = element.querySelector<HTMLElement>('.sc-tooltip');
    expect(tooltip?.textContent).toContain('2026Incomplete$298,000so far');
    expect(tooltip?.textContent).toContain('on pace for $420,000');
    expect(area.querySelector('[aria-live]')?.textContent).toContain(
      '2026: $298,000 so far, on pace for $420,000 (Incomplete)',
    );
    expect(onPointHover.mock.calls[0][0].series[0]).toMatchObject({
      y: 298000,
      projected: 420000,
      kind: 'incomplete',
    });
  });

  it('compares an incomplete slot by its pace, or not at all', () => {
    const spec = (projected?: number): ChartSpec => ({
      ...SPEC,
      chart: {type: 'line', incomplete: {from: '2026-11-28'}},
      series: (SPEC.series ?? []).map((series, index) =>
        index === 0
          ? {
              ...series,
              data: [
                series.data[0],
                {x: '2026-11-28', y: 100000, ...(projected ? {projected} : {})},
              ],
            }
          : series,
      ),
    });
    const kpiAtEnd = (): string => {
      pressKey(plotArea(element), 'End');
      return element.querySelector('.sc-kpi')?.textContent ?? '';
    };

    // 251,000 last year: 314,000 on pace is +25.1%, not 100,000's -60.2%.
    const chart = render(element, spec(314000));
    resizeAll(600, 300);
    expect(kpiAtEnd()).toBe('$100,000+25.1% on pace');

    chart.update(spec());
    resizeAll(600, 300);
    expect(kpiAtEnd()).toBe('$100,000');
  });

  it('shows the stack total in the hover KPI of a stacked chart', () => {
    render(element, {
      title: 'Net volume',
      kpi: {basis: 'custom', value: 100},
      chart: {type: 'bar', stacking: 'stacked', legend: 'show'},
      series: [
        {label: 'Gains', data: [{x: '2026-11-27', y: 300}]},
        {label: 'Losses', data: [{x: '2026-11-27', y: -200}]},
      ],
    });
    resizeAll(600, 300);
    pressKey(plotArea(element), 'ArrowRight');
    expect(element.querySelector('.sc-kpi')?.textContent).toBe('100');

    [...element.querySelectorAll<HTMLButtonElement>('.sc-legend-button')]
      .find((button) => button.textContent?.includes('Losses'))
      ?.dispatchEvent(new MouseEvent('click', {bubbles: true, detail: 0}));
    resizeAll(600, 300);
    pressKey(plotArea(element), 'ArrowRight');
    expect(element.querySelector('.sc-kpi')?.textContent).toBe('300');
  });

  it('colors the change by goodDirection, at rest and on hover', () => {
    render(element, {
      title: 'Refunds',
      format: {style: 'number'},
      kpi: {
        basis: 'custom',
        value: 80,
        comparisonValue: 100,
        goodDirection: 'down',
      },
      series: [
        {label: '2026', data: [{x: '2026-11-27', y: 120}]},
        {label: '2025', comparison: true, data: [{x: '2025-11-28', y: 100}]},
      ],
    });
    resizeAll(600, 300);
    const change = (): Element | null =>
      element.querySelector('.sc-kpi-change');
    expect(change()?.classList.contains('sc-change-good')).toBe(true);
    pressKey(plotArea(element), 'ArrowRight');
    expect(change()?.classList.contains('sc-change-bad')).toBe(true);
  });

  it('draws no stray unstacked bars when dense columns keep another stack', () => {
    // Two slots narrower than a pixel share one column, which keeps the
    // taller stack (slot 0). Series A has no segment there, so it draws
    // nothing at all, rather than its slot-1 value as a bar from zero.
    render(element, {
      title: 'Dense',
      chart: {type: 'bar', stacking: 'stacked'},
      series: [
        {
          label: 'A',
          data: [
            {x: '2026-11-27', y: null},
            {x: '2026-11-28', y: 10},
          ],
        },
        {
          label: 'B',
          data: [
            {x: '2026-11-27', y: 100},
            {x: '2026-11-28', y: 1},
          ],
        },
      ],
    });
    // Leaves under a pixel for the plot once the y labels take their room.
    resizeAll(30, 300);
    const seriesA = element.querySelector('.sc-marks [data-series="0"]');
    expect(seriesA?.querySelectorAll('rect')).toHaveLength(0);
    const seriesB = element.querySelector('.sc-marks [data-series="1"]');
    expect(seriesB?.querySelectorAll('rect').length).toBeGreaterThan(0);
  });

  it('shows a compact KPI to the eye and the exact value to screen readers', () => {
    render(element, {
      title: 'New ARR',
      format: {style: 'currency', currency: 'usd', unit: 'major'},
      chart: {type: 'kpi'},
      kpi: {basis: 'custom', value: 3798040, notation: 'compact'},
    });
    const value = element.querySelector('.sc-kpi-value');
    const shown = value?.querySelector('[aria-hidden="true"]');
    expect(shown?.textContent).toBe('$3.8M');
    const exact = value?.querySelector('.sc-visually-hidden');
    expect(exact?.textContent).toBe('$3,798,040');
  });

  it('reads no layout while mounting a chart without a KPI', () => {
    const rect = jest.spyOn(Element.prototype, 'getBoundingClientRect');
    const width = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get');
    const {kpi: _, ...noKpi} = SPEC;
    render(element, noKpi);
    expect(rect).not.toHaveBeenCalled();
    expect(width).not.toHaveBeenCalled();

    // The first notification, which comes before the first paint, draws it.
    resizeAll(600, 300);
    expect(element.querySelectorAll('.sc-line')).toHaveLength(2);
    rect.mockRestore();
    width.mockRestore();
  });

  it('checks the KPI fit with one batch of layout reads', () => {
    // A read after a DOM write forces a layout; reads in a row share one.
    const log: string[] = [];
    const observer = new MutationObserver(() => undefined);
    const read = <T>(value: T): T => {
      if (observer.takeRecords().length > 0) log.push('write');
      log.push('read');
      return value;
    };
    const spies = [
      jest
        .spyOn(Element.prototype, 'getBoundingClientRect')
        .mockImplementation(() => read({width: 100, height: 20} as DOMRect)),
      jest
        .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
        .mockImplementation(() => read(300)),
    ];
    observer.observe(element, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    render(element, SPEC);
    observer.disconnect();
    for (const spy of spies) spy.mockRestore();

    const readRuns = log.filter(
      (entry, index) => entry === 'read' && log[index - 1] !== 'read',
    ).length;
    // One for the compact check, one for the KPI fit check.
    expect(readRuns).toBe(2);
  });

  it('checks the KPI fit in layout pixels under a scaled ancestor', () => {
    // Drawn at half size: rects are half the 300px layout width.
    const spies = [
      jest
        .spyOn(Element.prototype, 'getBoundingClientRect')
        .mockImplementation(function rect(this: Element) {
          const probed = this.closest('.sc-kpi-probe') !== null;
          return {width: probed ? 80 : 150, height: 10} as DOMRect;
        }),
      jest
        .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
        .mockReturnValue(300),
      jest
        .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
        .mockReturnValue(300),
    ];
    try {
      render(element, SPEC);
      // Value and change take 160 + 160 layout pixels, more than the row's 300.
      expect(element.querySelector('.sc-kpi-stacked')).not.toBeNull();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });

  it('leaves the element as it found it after destroy', () => {
    const addListener = jest.spyOn(document, 'addEventListener');
    const chart = render(element, SPEC);
    chart.update({...SPEC, chart: {type: 'bar'}});
    // A KPI tile's details panel listens on the document for outside presses.
    chart.update({...SPEC, chart: {type: 'kpi'}});
    chart.destroy();

    expect(element.childNodes).toHaveLength(0);
    expect(element.attributes).toHaveLength(0);
    expect(observers.length).toBeGreaterThanOrEqual(2);
    for (const {disconnect} of observers) expect(disconnect).toHaveBeenCalled();
    expect(addListener).toHaveBeenCalled();
    for (const [, , options] of addListener.mock.calls) {
      expect(
        (options as AddEventListenerOptions | undefined)?.signal?.aborted,
      ).toBe(true);
    }
    addListener.mockRestore();
  });
});
