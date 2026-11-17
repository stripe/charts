import type {ChartModel} from '../model';
import {svg} from './dom';
import {SERIES_COLOR_PROPERTY} from './palette';

/**
 * Series indices in drawing order: comparison series first, so the primary
 * series is drawn on top of them.
 */
export function seriesDrawOrder(series: ChartModel['series']): number[] {
  const indices = series.map((_, index) => index);
  return [
    ...indices.filter((i) => series[i].comparison),
    ...indices.filter((i) => !series[i].comparison),
  ];
}

/**
 * Sets the color a mark's stylesheet rules read (`var(--sc-series-color)`),
 * so the color comes from the palette tokens rather than an inline value.
 */
export function withSeriesColor<T extends HTMLElement | SVGElement>(
  element: T,
  color: string,
): T {
  element.style.setProperty(SERIES_COLOR_PROPERTY, color);
  return element;
}

/**
 * A short line in a series' color, as in the tooltip and legend: dashed
 * for a comparison series on a line chart, like its line. Decorative.
 */
export function lineSwatch(
  doc: Document,
  color: string,
  dashed: boolean,
): SVGSVGElement {
  const swatch = withSeriesColor(
    svg(doc, 'svg', {
      class: dashed ? 'sc-swatch sc-comparison' : 'sc-swatch',
      'aria-hidden': 'true',
    }),
    color,
  );
  swatch.appendChild(
    svg(doc, 'line', {x1: 0, x2: '100%', y1: '50%', y2: '50%'}),
  );
  return swatch;
}
