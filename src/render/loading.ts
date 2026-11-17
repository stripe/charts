import type {ResolvedSpec} from '../defaults';
import {tokens} from '../tokens';
import {html, svg} from './dom';
import type {ChartMotion} from './motion';

/**
 * The placeholder trend, as heights from the plot's bottom (0) to top (1).
 * Shared by the line and bar placeholders; a gentle rise reads as "a chart
 * is coming" without suggesting real values.
 */
const PLACEHOLDER_SHAPE = [
  0.42, 0.5, 0.46, 0.58, 0.54, 0.66, 0.6, 0.7, 0.64, 0.74, 0.7, 0.78,
];

// Both silhouettes are drawn on a 0-100 scale stretched to the plot: viewBox
// units for the line, percentages of the plot's height for the bars.
const SILHOUETTE_SCALE = 100;

/**
 * A smooth path through the placeholder shape: quadratic curves through
 * the midpoints between points, so it reads as a line chart, not a zigzag.
 */
function placeholderPath(): string {
  const step = SILHOUETTE_SCALE / (PLACEHOLDER_SHAPE.length - 1);
  const points = PLACEHOLDER_SHAPE.map((height, index) => ({
    x: index * step,
    y: SILHOUETTE_SCALE * (1 - height),
  }));
  const [first, ...rest] = points;
  if (!first) return '';
  let path = `M${first.x},${first.y}`;
  rest.forEach((point, index) => {
    const prev = points[index] ?? first;
    const midX = (prev.x + point.x) / 2;
    const midY = (prev.y + point.y) / 2;
    path += `Q${prev.x},${prev.y} ${midX},${midY}`;
  });
  const last = points[points.length - 1] ?? first;
  return `${path}L${last.x},${last.y}`;
}

function lineSilhouette(doc: Document): SVGSVGElement {
  const element = svg(doc, 'svg', {
    class: 'sc-skeleton-line',
    viewBox: `0 0 ${SILHOUETTE_SCALE} ${SILHOUETTE_SCALE}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  element.appendChild(svg(doc, 'path', {d: placeholderPath()}));
  return element;
}

function barSilhouette(doc: Document): HTMLElement {
  const bars = html(doc, 'div', 'sc-skeleton-bars');
  for (const height of PLACEHOLDER_SHAPE) {
    const slot = html(doc, 'span', 'sc-skeleton-slot');
    const bar = html(doc, 'span', 'sc-skeleton-bar');
    bar.style.height = `${height * SILHOUETTE_SCALE}%`;
    slot.appendChild(bar);
    bars.appendChild(slot);
  }
  return bars;
}

/**
 * Faint gridlines with short placeholders for the y labels, ending in the
 * baseline, spread over the plot's height like real ticks.
 */
function gridPlaceholder(doc: Document): HTMLElement {
  const grid = html(doc, 'div', 'sc-skeleton-grid');
  for (let row = 0; row <= tokens.skeleton.gridlineCount; row += 1) {
    const last = row === tokens.skeleton.gridlineCount;
    const line = html(
      doc,
      'div',
      last
        ? 'sc-skeleton-gridline sc-skeleton-baseline'
        : 'sc-skeleton-gridline',
    );
    if (!last)
      line.appendChild(html(doc, 'span', 'sc-skeleton sc-skeleton-tick'));
    grid.appendChild(line);
  }
  return grid;
}

function plotPlaceholder(
  doc: Document,
  chartType: 'line' | 'bar',
): {area: HTMLElement; marks: HTMLElement} {
  // `sc-plot-area` gives it the real plot area's box: same gap above, same
  // flex sizing, so swapping in the chart moves nothing.
  const area = html(doc, 'div', 'sc-plot-area sc-skeleton-plot');
  const marks = html(doc, 'div', 'sc-skeleton-marks');
  marks.append(
    gridPlaceholder(doc),
    chartType === 'bar' ? barSilhouette(doc) : lineSilhouette(doc),
  );
  area.appendChild(marks);
  return {area, marks};
}

/**
 * Fills a loading chart: a KPI placeholder in `header` (unless the spec
 * already gives the KPI) and a plot placeholder, then starts the shimmer.
 * `header` is the rendered header, already in `root`.
 */
export function mountLoading(
  root: HTMLElement,
  header: HTMLElement,
  spec: ResolvedSpec,
  motion: ChartMotion,
): void {
  const doc = root.ownerDocument;
  const tile = spec.chartType === 'kpi';
  const shimmer: HTMLElement[] = [];

  if (!spec.kpi) {
    // A `sc-kpi` row, so it has the KPI's spacing and is the part that
    // cross-fades into the real KPI.
    const row = html(doc, 'p', 'sc-kpi');
    const block = html(doc, 'span', 'sc-skeleton sc-skeleton-kpi');
    row.appendChild(block);
    shimmer.push(block);
    const titleRow = header.firstElementChild;
    if (tile && titleRow) titleRow.after(row);
    else header.appendChild(row);
  }

  const pulse: HTMLElement[] = [];
  if (!tile) {
    const {area, marks} = plotPlaceholder(
      doc,
      spec.chartType === 'bar' ? 'bar' : 'line',
    );
    root.appendChild(area);
    shimmer.push(...area.querySelectorAll<HTMLElement>('.sc-skeleton-tick'));
    pulse.push(marks);
  }
  motion.skeleton({shimmer, pulse});
}
