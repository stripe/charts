import type {ResolvedSpec} from '../defaults';
import {tokens} from '../tokens';
import {html, svg, visuallyHidden} from './dom';
import type {HiddenSeries} from './legendState';
import type {LegendPresses} from './legendPresses';
import {MESSAGES} from './messages';
import {lineSwatch, withSeriesColor} from './series';
import {vars} from './styles';

/**
 * Whether the chart shows a legend: always or never when `chart.legend`
 * says so; by default (`"auto"`) for as many series as
 * `legend.minSeriesCount`, or whenever there are forecast points, so the
 * dashed style is explained. KPI tiles have none.
 */
export function legendShown(spec: ResolvedSpec): boolean {
  if (spec.chartType === 'kpi' || spec.series.length === 0) return false;
  if (spec.legend !== 'auto') return spec.legend === 'show';
  return (
    spec.series.length >= tokens.legend.minSeriesCount ||
    // Forecast and on-pace marks have their own style; the legend names it.
    spec.series.some((s) =>
      s.data.some(
        (point) => point.forecast === true || point.projected !== undefined,
      ),
    )
  );
}

/** One series as the legend shows it. */
export type LegendSeries = {
  label: string;
  comparison: boolean;
  /** Its color reference, as the marks use it. */
  color: string;
};

/** What {@link mountLegend} needs. */
export type LegendOptions = {
  series: readonly LegendSeries[];
  /** Bars get a square swatch, lines a short line. */
  chartType: 'line' | 'bar';
  hidden: HiddenSeries;
  /** Adds the dashed "Forecast" key. */
  forecast: boolean;
  /** Adds the "On pace" key, for projected values of an incomplete period. */
  projected: boolean;
  /** The series whose button should take focus, after a press re-rendered the chart. */
  focusLabel: string | null;
  /** Where presses go; it outlives this legend (see `legendPresses.ts`). */
  presses: LegendPresses;
  /** Removes listeners when aborted. */
  signal: AbortSignal;
};

/**
 * The line chart's forecast key: the forecast dash over a light band, as a
 * forecast is drawn with its low-high range.
 */
function forecastLineKey(doc: Document, color: string): SVGSVGElement {
  const key = withSeriesColor(
    svg(doc, 'svg', {
      class: 'sc-swatch sc-forecast-key',
      'aria-hidden': 'true',
    }),
    color,
  );
  key.append(
    svg(doc, 'rect', {x: 0, y: 0, width: '100%', height: '100%'}),
    svg(doc, 'line', {x1: 0, x2: '100%', y1: '50%', y2: '50%'}),
  );
  return key;
}

/**
 * The projected-pace key, drawn like its mark: on lines the dotted
 * incomplete tail from a hollow marker on the value so far; on bars the
 * dashed outline of the extension to the projected height.
 */
function projectedKey(
  doc: Document,
  chartType: 'line' | 'bar',
  color: string,
): SVGSVGElement {
  const bar = chartType === 'bar';
  const key = withSeriesColor(
    svg(doc, 'svg', {
      class: bar ? 'sc-projected-key sc-projected-key-bar' : 'sc-projected-key',
      'aria-hidden': 'true',
    }),
    color,
  );
  if (bar) {
    // Sized by the stylesheet, so a theme's swatch size applies here too.
    key.appendChild(
      svg(doc, 'rect', {x: 0, y: 0, width: '100%', height: '100%'}),
    );
  } else {
    key.append(
      svg(doc, 'line', {x1: 0, x2: '100%', y1: '50%', y2: '50%'}),
      // At the start, like the marker on the value so far, with the dots
      // running on to the projection.
      svg(doc, 'circle', {
        cx: tokens.projected.markerRadius,
        cy: '50%',
        r: tokens.projected.markerRadius,
      }),
    );
  }
  return key;
}

function swatch(
  doc: Document,
  series: LegendSeries,
  chartType: 'line' | 'bar',
): Element {
  return chartType === 'bar'
    ? withSeriesColor(html(doc, 'span', 'sc-legend-square'), series.color)
    : lineSwatch(doc, series.color, series.comparison);
}

/**
 * Appends the legend to `parent`; call `restoreFocus` once it is in its
 * final place. Each button's `aria-pressed` is true while its series is
 * shown.
 */
export function mountLegend(
  parent: HTMLElement,
  options: LegendOptions,
): {element: HTMLElement; restoreFocus(): void} {
  const {
    series,
    chartType,
    hidden,
    forecast,
    projected,
    focusLabel,
    presses,
    signal,
  } = options;
  const doc = parent.ownerDocument;
  const legend = html(doc, 'div', 'sc-legend');
  legend.setAttribute('role', 'group');
  legend.setAttribute('aria-label', MESSAGES.legend);
  const list = html(doc, 'ul', 'sc-legend-list');
  const announcer = visuallyHidden(doc);
  announcer.setAttribute('aria-live', 'polite');
  legend.append(list, announcer);

  presses.setAnnouncer((text) => {
    announcer.textContent = text;
  });

  let focusTarget: HTMLButtonElement | null = null;
  for (const each of series) {
    const button = html(doc, 'button', 'sc-legend-button');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(!hidden.has(each.label)));
    button.append(
      swatch(doc, each, chartType),
      html(doc, 'span', 'sc-legend-label', each.label),
    );
    const listen = {signal};
    button.addEventListener(
      'click',
      (event) => presses.press(each.label, event.detail),
      listen,
    );
    button.addEventListener(
      'dblclick',
      () => presses.doubleClick(each.label),
      listen,
    );
    button.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Enter' || !event.shiftKey) return;
        // Not also a click: Enter on a button would otherwise toggle.
        event.preventDefault();
        presses.isolate(each.label);
      },
      listen,
    );
    const item = html(doc, 'li', 'sc-legend-item');
    item.appendChild(button);
    list.appendChild(item);
    if (each.label === focusLabel) focusTarget = button;
  }

  if (forecast) {
    const key = html(doc, 'li', 'sc-legend-item sc-legend-key');
    key.append(
      chartType === 'bar'
        ? withSeriesColor(
            html(doc, 'span', 'sc-legend-square sc-legend-forecast'),
            vars.legend.forecastColor,
          )
        : forecastLineKey(doc, vars.legend.forecastColor),
      html(doc, 'span', 'sc-legend-label', MESSAGES.forecast),
    );
    list.appendChild(key);
  }

  if (projected) {
    const key = html(doc, 'li', 'sc-legend-item sc-legend-key');
    key.append(
      projectedKey(doc, chartType, vars.legend.forecastColor),
      html(doc, 'span', 'sc-legend-label', MESSAGES.onPace),
    );
    list.appendChild(key);
  }

  parent.appendChild(legend);
  return {
    element: legend,
    // Separate, so the chart can place the legend first: moving a focused
    // element drops its focus.
    restoreFocus: () => focusTarget?.focus({preventScroll: true}),
  };
}
