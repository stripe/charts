import type {ResolvedSpec} from '../defaults';
import {polylinePath} from '../layout/marks';
import type {SparklineGeometry} from '../layout/sparkline';
import {
  latestPoint,
  sparklineArea,
  sparklineGeometry,
} from '../layout/sparkline';
import type {ChartModel} from '../model';
import {tokens} from '../tokens';
import {html, layoutOffsetX, svg, visuallyHidden} from './dom';
import {onOutsidePress} from './outsidePress';
import {idPrefix} from './ids';
import {MESSAGES} from './messages';
import {observeSize} from './observe';
import {seriesColors} from './palette';
import {tooltipAnnouncement, tooltipContent} from './plot/tooltip';
import {seriesDrawOrder, withSeriesColor} from './series';
import {sparkAreaGradient, sparkEndMarker, sparkMarker} from './sparklineMarks';

const BELOW_CLASS = 'sc-spark-below';

/**
 * The width the KPI's value and change need on one line: the sum of the
 * two, not the row's own width, which is the column it was given.
 */
function kpiRowWidth(tile: HTMLElement): number {
  const row = tile.querySelector<HTMLElement>('.sc-kpi');
  if (!row) return 0;
  const parts = [...row.querySelectorAll<HTMLElement>(':scope > *')].filter(
    (part) => part.textContent !== '',
  );
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  return (
    parts.reduce((sum, part) => sum + part.offsetWidth, 0) +
    gap * Math.max(0, parts.length - 1)
  );
}

/**
 * Moves the sparkline under the value when the tile is too narrow to keep
 * it beside the value and change: below `sparkline.besideFrom`, or when the
 * value and change on one line would leave the sparkline less than its
 * smallest width. Measured rather than tied to the chart's compact class,
 * because a tile's padding and border leave less room than the chart's own
 * width suggests.
 */
function watchPlacement(tile: HTMLElement, signal: AbortSignal): void {
  const {besideFrom, minWidth, gap} = tokens.sparkline;
  const apply = (width: number): void => {
    // Width 0 means the tile is hidden or detached; keep the default.
    const below =
      width > 0 &&
      (width < besideFrom || kpiRowWidth(tile) + gap + minWidth > width);
    tile.classList.toggle(BELOW_CLASS, below);
  };
  const style = getComputedStyle(tile);
  apply(
    tile.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight),
  );
  // Deferred to the next frame: the class changes the tile's height, the
  // size being observed.
  observeSize(tile, ({width}) => apply(width), {signal});
}

/** What the tile hears from the sparkline. */
export type SparklineCallbacks = {
  /** The hovered or focused slot changed; null when none is. */
  onSlot(slot: number | null): void;
  /** The sparkline was drawn at a new size. */
  onResize(): void;
};

/**
 * Appends a KPI tile's sparkline to `parent`, sized by the stylesheet and
 * drawn at its measured size, and returns it. Listeners and the resize
 * observer are removed when `signal` aborts. The picture itself is hidden
 * from assistive technology; the focused sparkline announces each slot.
 */
export function mountSparkline(
  parent: HTMLElement,
  spec: ResolvedSpec,
  model: ChartModel,
  signal: AbortSignal,
  callbacks: SparklineCallbacks,
): HTMLElement {
  const doc = parent.ownerDocument;
  watchPlacement(parent, signal);
  const container = html(doc, 'div', 'sc-sparkline');
  container.tabIndex = 0;
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', MESSAGES.plotInstructions);
  const element = svg(doc, 'svg', {
    class: 'sc-spark-svg',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  const announcer = visuallyHidden(doc);
  announcer.setAttribute('aria-live', 'polite');
  container.append(element, announcer);

  const colors = seriesColors(model.series);
  const primary = model.series.findIndex((s) => !s.comparison);
  const gradientId = `${idPrefix()}-spark-area`;
  let geometry: SparklineGeometry | null = null;
  let hoverLayer: SVGGElement | null = null;
  let endDot: SVGGElement | null = null;
  let active: number | null = null;
  let size = {width: 0, height: 0};

  const paint = (current: SparklineGeometry): void => {
    element.setAttribute('width', String(size.width));
    element.setAttribute('height', String(size.height));
    const children: SVGElement[] = [];
    if (primary !== -1) {
      // The gradient reads the color from the SVG, which sets it.
      withSeriesColor(element, colors[primary]);
      children.push(
        sparkAreaGradient(doc, gradientId),
        svg(doc, 'path', {
          class: 'sc-spark-area',
          d: sparklineArea(current.points[primary], current.bottom),
          fill: `url(#${gradientId})`,
        }),
      );
    }
    for (const index of seriesDrawOrder(model.series)) {
      const className = model.series[index].comparison
        ? 'sc-spark-line sc-comparison'
        : 'sc-spark-line';
      children.push(
        withSeriesColor(
          svg(doc, 'path', {
            class: className,
            d: polylinePath(current.points[index]),
          }),
          colors[index],
        ),
      );
    }
    const end = primary === -1 ? null : latestPoint(current.points[primary]);
    endDot = end ? sparkEndMarker(doc, end, colors[primary]) : null;
    if (endDot) children.push(endDot);
    hoverLayer = svg(doc, 'g', {class: 'sc-hover'});
    children.push(hoverLayer);
    element.replaceChildren(...children);
  };

  const show = (slot: number | null, announce = false): void => {
    if (!geometry || !hoverLayer) return;
    active = slot;
    callbacks.onSlot(slot);
    if (endDot) endDot.style.visibility = slot === null ? '' : 'hidden';
    const markers: SVGElement[] = [];
    if (slot !== null) {
      for (const index of seriesDrawOrder(model.series)) {
        const point = geometry.points[index][slot];
        if (point) markers.push(sparkMarker(doc, point, colors[index]));
      }
    }
    hoverLayer.replaceChildren(...markers);
    if (announce && slot !== null) {
      announcer.textContent = tooltipAnnouncement(
        tooltipContent(model, spec, slot),
      );
    }
  };

  const draw = (width: number, height: number): void => {
    if (width === size.width && height === size.height) return;
    size = {width, height};
    if (width <= 0 || height <= 0) {
      geometry = null;
      element.replaceChildren();
      return;
    }
    geometry = sparklineGeometry(model, width, height);
    paint(geometry);
    callbacks.onResize();
    if (active !== null) show(active);
  };

  const options = {signal};
  let pinned = false;
  const onPointer = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') pinned = false;
    else if (event.type === 'pointerdown') pinned = true;
    if (!geometry) return;
    const slot = geometry.indexAt(layoutOffsetX(container, event.clientX));
    if (slot !== active) show(slot);
  };
  const leave = (): void => {
    pinned = false;
    if (active !== null) show(null);
  };
  const onLeave = (): void => {
    if (!pinned) leave();
  };
  container.addEventListener('pointermove', onPointer, options);
  container.addEventListener('pointerdown', onPointer, options);
  container.addEventListener('pointerleave', onLeave, options);
  onOutsidePress(
    container,
    doc,
    () => {
      if (pinned) leave();
    },
    signal,
  );
  container.addEventListener('pointercancel', leave, options);
  container.addEventListener('blur', leave, options);
  container.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        leave();
        return;
      }
      const last = model.slots.length - 1;
      const current = active ?? -1;
      const moves: Record<string, number> = {
        ArrowRight: Math.min(last, current + 1),
        ArrowLeft: current === -1 ? last : Math.max(0, current - 1),
        Home: 0,
        End: last,
      };
      const next = moves[event.key];
      if (next === undefined || last < 0) return;
      event.preventDefault();
      show(next, true);
    },
    options,
  );

  // Immediate: the SVG is absolutely positioned and the box is sized by
  // the stylesheet, so redrawing cannot change the size being observed.
  observeSize(container, ({width, height}) => draw(width, height), {
    immediate: true,
    signal,
  });
  parent.appendChild(container);
  const rect = container.getBoundingClientRect();
  draw(rect.width, rect.height);
  return container;
}
