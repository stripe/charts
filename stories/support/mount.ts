import {recordChart} from '../../.storybook/code';
import {render, SpecError} from '../../src/index';
import type {ChartHandle, RenderOptions} from '../../src/index';

export const COLUMN_WIDTH = 640;
export const CELL_WIDTH = 304;
export const GRID_GAP = 32;

/**
 * A chart container size: a width in pixels or any CSS width (`"100%"` for
 * a fluid container), and a height in pixels. Without a height the chart
 * sizes itself.
 */
export type Size = {width: number | string; height?: number};

/**
 * Render options for a story chart, with the JavaScript the code view shows
 * for them. Keep `source` next to `options` and saying the same thing.
 */
export type StoryOptions = {
  options: RenderOptions;
  source: string;
  reactSource?: string;
};

const mounted = new Set<ChartHandle>();

/**
 * Renders `spec` (and optional render options) into a new container of the
 * given size and returns the container. An invalid spec leaves the
 * library's error card in place and the `SpecError` is reported on the
 * container, so stories can show it.
 */
export function chart(
  spec: unknown,
  size: Size,
  storyOptions?: StoryOptions,
): HTMLElement {
  const element = document.createElement('div');
  element.style.width =
    typeof size.width === 'number' ? `${size.width}px` : size.width;
  if (size.height !== undefined) element.style.height = `${size.height}px`;
  recordChart({
    spec,
    ...size,
    ...(storyOptions
      ? {
          optionsSource: storyOptions.source,
          reactOptionsSource: storyOptions.reactSource,
        }
      : {}),
  });
  try {
    mounted.add(render(element, spec, storyOptions?.options));
  } catch (error) {
    if (!(error instanceof SpecError)) throw error;
    // The error card stays in the element; its handle still needs cleaning up.
    if (error.chart) mounted.add(error.chart);
    element.dataset.specError = error.message;
  }
  return element;
}

export function track(handle: ChartHandle): ChartHandle {
  mounted.add(handle);
  return handle;
}

const cleanups = new Set<() => void>();

/**
 * Registers work to undo when the story changes, for example a pending
 * timer that would update a chart after it is gone.
 */
export function onCleanUp(cleanup: () => void): void {
  cleanups.add(cleanup);
}

/**
 * Destroys every chart mounted by the previous story and runs its
 * {@link onCleanUp} callbacks. Use as a meta-level
 * `beforeEach`: Storybook calls the returned function before the next story
 * renders.
 */
export function cleanUpCharts(): () => void {
  return () => {
    for (const cleanup of cleanups) cleanup();
    cleanups.clear();
    for (const handle of mounted) handle.destroy();
    mounted.clear();
  };
}

export function column(...children: HTMLElement[]): HTMLElement {
  const element = document.createElement('div');
  element.style.width = `${COLUMN_WIDTH}px`;
  element.style.margin = '0 auto';
  element.append(...children);
  return element;
}

/**
 * A two-column grid of {@link CELL_WIDTH} cells. With `rowHeight`, every row
 * has that height, so rows line up with a reference layout.
 */
export function grid(
  cells: HTMLElement[],
  {rowHeight}: {rowHeight?: number} = {},
): HTMLElement {
  const element = document.createElement('div');
  element.style.display = 'grid';
  element.style.gridTemplateColumns = `repeat(2, ${CELL_WIDTH}px)`;
  if (rowHeight !== undefined) element.style.gridAutoRows = `${rowHeight}px`;
  element.style.gap = `${GRID_GAP}px`;
  element.style.alignItems = 'start';
  element.append(...cells);
  return element;
}

export function stack(gap: number, ...children: HTMLElement[]): HTMLElement {
  const element = document.createElement('div');
  element.style.display = 'flex';
  element.style.flexDirection = 'column';
  element.style.gap = `${gap}px`;
  element.append(...children);
  return element;
}

export function row(gap: number, ...children: HTMLElement[]): HTMLElement {
  const element = document.createElement('div');
  element.style.display = 'grid';
  element.style.gridTemplateColumns = `repeat(${children.length}, minmax(0, 1fr))`;
  element.style.gap = `${gap}px`;
  element.append(...children);
  return element;
}

/**
 * A small caption above a chart, for stories that label variants. Page
 * framing, not part of the chart.
 */
export function caption(text: string, child: HTMLElement): HTMLElement {
  const label = document.createElement('p');
  label.textContent = text;
  label.style.margin = '0 0 8px';
  label.style.font = '12px/16px system-ui, sans-serif';
  label.style.color = '#3c4f69';
  const element = document.createElement('div');
  element.append(label, child);
  return element;
}
