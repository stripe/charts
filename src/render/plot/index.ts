import type {ResolvedSpec} from '../../defaults';
import {formatTicks} from '../../format';
import {tickFormatter, tickX, xAxisData} from '../../layout/axisData';
import type {PlotLayout} from '../../layout/plot';
import type {XLabel} from '../../layout/xAxis';
import {layoutPlot} from '../../layout/plot';
import type {VerticalRange} from '../../layout/tooltip';
import {tooltipPosition} from '../../layout/tooltip';
import type {ChartModel} from '../../model';
import type {RenderOptions} from '../../options';
import {tokens} from '../../tokens';
import {html, layoutOffsetX, svg, visuallyHidden} from '../dom';
import {callSafely, pointEvent} from '../events';
import {idPrefix} from '../ids';
import {createTextMeasurer} from '../measure';
import {frameScheduler, observeSize} from '../observe';
import {MESSAGES} from '../messages';
import {onOutsidePress} from '../outsidePress';
import type {ChartMotion, PlotMotion} from '../motion';
import {resolveColors, seriesColors} from '../palette';
import type {PlotData} from './draw';
import {drawHover, drawPlot} from './draw';
import {
  fillCustomTooltip,
  fillTooltip,
  tooltipAnnouncement,
  tooltipContent,
} from './tooltip';

/**
 * The slot a navigation key moves to from `active` (none yet: the arrows
 * start from the nearest end), or null for other keys or no slots.
 */
function slotForKey(
  key: string,
  active: number | null,
  count: number,
): number | null {
  const last = count - 1;
  if (last < 0) return null;
  switch (key) {
    case 'ArrowRight':
      return active === null ? 0 : Math.min(last, active + 1);
    case 'ArrowLeft':
      return active === null ? last : Math.max(0, active - 1);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}

/**
 * The vertical extent of a slot's line markers, ring included, in the
 * root's coordinates (`offset` is the plot area's top), so the tooltip can
 * keep clear of them; null when the slot has no values.
 */
function markerRange(
  model: ChartModel,
  slot: number,
  layout: PlotLayout,
  offset: number,
): VerticalRange | null {
  const ys = (model.slots[slot]?.points ?? []).flatMap((point) =>
    point.y === null || model.series[point.seriesIndex].hidden
      ? []
      : [layout.y(point.y)],
  );
  if (ys.length === 0) return null;
  const reach = tokens.marker.radius + tokens.marker.ringWidth;
  return {
    top: offset + Math.min(...ys) - reach,
    bottom: offset + Math.max(...ys) + reach,
  };
}

/** What the rest of the chart hears from the plot. */
export type PlotCallbacks = {
  /** The hovered or focused slot changed; null when none is. */
  onSlot(slot: number | null): void;
  /** The plot was drawn at a new size. */
  onResize(): void;
};

/**
 * The series whose bar is under the pointer, from the mark it landed on;
 * null between bars and for lines, whose marks are thin.
 */
function barSeriesAt(event: Event): number | null {
  const {target} = event;
  if (!target || !('closest' in target)) return null;
  const mark = (target as Element).closest('.sc-bars[data-series]');
  return mark ? Number(mark.getAttribute('data-series')) : null;
}

/**
 * Appends the plot area to `root` (the chart root, which the tooltip is
 * positioned against) and draws it at its current size. Every listener and
 * the resize observer are removed when `signal` aborts. `options` supplies
 * the caller's event callbacks, custom tooltip and tick formatters.
 */
export function mountPlot(
  root: HTMLElement,
  spec: ResolvedSpec,
  model: ChartModel,
  signal: AbortSignal,
  motion: ChartMotion,
  callbacks: PlotCallbacks,
  options: RenderOptions,
): void {
  const doc = root.ownerDocument;
  const chartType = spec.chartType === 'bar' ? 'bar' : 'line';
  const data: PlotData = {
    model,
    chartType,
    colors: seriesColors(model.series),
    clipId: `${idPrefix()}-marks`,
  };
  const axisData = xAxisData(model, spec);
  const defaultXTick = tickFormatter(axisData, spec);
  // The caller's formatters get the default label and run last, so layout
  // measures exactly the text that is drawn.
  const formatXTick: typeof defaultXTick = (tick) => {
    const label = defaultXTick(tick);
    return (
      callSafely(
        'formatXTick',
        options.formatXTick,
        tickX(axisData, tick.time),
        label,
      ) ?? label
    );
  };
  const formatYTicks = (values: readonly number[]): string[] => {
    const labels = formatTicks(values, spec.format, spec.locale, spec.axes.y);
    if (!options.formatYTick) return labels;
    return labels.map(
      (label, index) =>
        callSafely('formatYTick', options.formatYTick, values[index], label) ??
        label,
    );
  };
  const eventFor = (
    slot: number,
    seriesIndex: number | null,
    nativeEvent: Event | null,
  ) =>
    pointEvent(
      model,
      spec,
      resolveColors(data.colors, root),
      slot,
      seriesIndex,
      nativeEvent,
    );

  const area = html(doc, 'div', 'sc-plot-area');
  area.tabIndex = 0;
  area.setAttribute('role', 'group');
  area.setAttribute('aria-label', MESSAGES.plotInstructions);
  if (options.onPointClick) area.classList.add('sc-clickable');
  const plot = svg(doc, 'svg', {
    class: 'sc-svg',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  const announcer = visuallyHidden(doc);
  announcer.setAttribute('aria-live', 'polite');
  area.append(plot, announcer);
  const measure = createTextMeasurer(area);

  const tooltip = html(doc, 'div', 'sc-tooltip');
  tooltip.setAttribute('aria-hidden', 'true');
  tooltip.hidden = true;
  root.append(area, tooltip);

  // X labels by plot width, for this mount's data (an update remounts).
  // Cleared on resize, since text measurements may differ at a new size.
  const xLabelCache = new Map<number, XLabel[]>();

  let layout: PlotLayout | null = null;
  let hoverLayer: SVGGElement | null = null;
  let active: number | null = null;
  // The slot whose content the tooltip holds. Content comes from the final
  // values, so a redraw at the same slot only moves the box, and a custom
  // tooltip is rendered once per slot rather than once per frame.
  let filled: number | null = null;
  let size = {width: 0, height: 0};

  const fill = (slot: number, announce: boolean): void => {
    const content = tooltipContent(model, spec, slot);
    const custom = options.renderTooltip
      ? callSafely('renderTooltip', options.renderTooltip, {
          ...eventFor(slot, null, null),
          title: content.date,
          annotations: content.annotations,
        })
      : null;
    if (custom === null || custom === undefined)
      fillTooltip(tooltip, content, data.colors, chartType === 'line');
    else fillCustomTooltip(tooltip, custom);
    filled = slot;
    if (announce) announcer.textContent = tooltipAnnouncement(content);
  };

  const show = (slot: number, announce: boolean): void => {
    if (!layout || !hoverLayer) return;
    active = slot;
    callbacks.onSlot(slot);
    drawHover(hoverLayer, layout, data, slot);
    if (slot !== filled) fill(slot, announce);
    tooltip.hidden = false;
    // Fixed at the plot's top, whatever the pointer's height, unless that
    // would cover the hovered points.
    const top = area.offsetTop + layout.plot.top + tokens.tooltip.plotOffset;
    const position = tooltipPosition({
      anchor: area.offsetLeft + layout.x.center(slot),
      width: tooltip.offsetWidth,
      height: tooltip.offsetHeight,
      top,
      containerWidth: root.clientWidth,
      avoid:
        chartType === 'line'
          ? markerRange(model, slot, layout, area.offsetTop)
          : null,
      sideGap: tokens.tooltip.sideGap,
    });
    tooltip.style.left = `${position.left}px`;
    tooltip.style.top = `${position.top}px`;
  };

  // Set by a touch or pen press: the slot stays selected after the finger
  // lifts, until a press elsewhere, Escape or destroy.
  let pinned = false;

  const hide = (): void => {
    if (active !== null) {
      callbacks.onSlot(null);
      callSafely('onPointHover', options.onPointHover, null);
    }
    active = null;
    filled = null;
    pinned = false;
    hoverLayer?.replaceChildren();
    tooltip.hidden = true;
  };

  const select = (
    slot: number,
    announce: boolean,
    nativeEvent: Event | null,
  ): void => {
    if (slot === active) return;
    show(slot, announce);
    if (active === slot)
      callSafely(
        'onPointHover',
        options.onPointHover,
        eventFor(slot, null, nativeEvent),
      );
  };

  const paint = (plotMotion: PlotMotion): void => {
    const {width, height} = size;
    if (width <= 0 || height <= 0) return;
    const {model: frameModel} = plotMotion.frame();
    layout = layoutPlot({
      width,
      height,
      chartType,
      times: axisData.times,
      timeZone: axisData.timeZone,
      seriesCount: frameModel.series.filter((s) => !s.hidden).length,
      stacked: model.stacked,
      yDomain: frameModel.yDomain,
      yMinStep: model.yMinStep,
      formatYTicks,
      formatXTick,
      measure,
      xLabelCache,
      xAxis: spec.axes.x,
    });
    hoverLayer = drawPlot(plot, layout, {...data, model: frameModel});
    plotMotion.decorate(plot, layout);
  };
  const keepHover = (): void => {
    if (active !== null) show(active, false);
  };
  const transition = motion.plot({chartType, model}, (current) => {
    paint(current);
    keepHover();
  });

  const resized = frameScheduler(area, () => callbacks.onResize(), signal);

  const draw = (width: number, height: number, observed: boolean): void => {
    if (width === size.width && height === size.height) return;
    size = {width, height};
    xLabelCache.clear();
    if (width <= 0 || height <= 0) {
      layout = null;
      hoverLayer = null;
      plot.replaceChildren();
      tooltip.hidden = true;
      return;
    }
    paint(transition);
    // The KPI may restack its row when re-measured, which changes this
    // area's height; doing that inside the resize callback would loop, so
    // from there it waits a frame. The first draw does it at once, so the
    // first paint is already final.
    if (observed) resized();
    else callbacks.onResize();
    keepHover();
  };

  const listenerOptions = {signal};
  const slotAt = (clientX: number): number | null =>
    layout ? layout.x.indexAt(layoutOffsetX(area, clientX)) : null;
  const onPointer = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') pinned = false;
    else if (event.type === 'pointerdown') pinned = true;
    const slot = slotAt(event.clientX);
    if (slot !== null) select(slot, false, event);
  };
  // Browsers fire pointerleave as soon as a finger or pen lifts, even over
  // the plot, so a tap would hide the slot it just chose.
  const onLeave = (): void => {
    if (!pinned) hide();
  };
  area.addEventListener('pointermove', onPointer, listenerOptions);
  area.addEventListener('pointerdown', onPointer, listenerOptions);
  area.addEventListener('pointerleave', onLeave, listenerOptions);
  // A finger that starts on the plot and scrolls the page cancels its
  // pointer; that press chose nothing to keep.
  area.addEventListener('pointercancel', hide, listenerOptions);
  area.addEventListener('blur', hide, listenerOptions);
  area.addEventListener(
    'click',
    (event) => {
      if (!options.onPointClick) return;
      const slot = slotAt(event.clientX);
      if (slot === null) return;
      const seriesIndex = chartType === 'bar' ? barSeriesAt(event) : null;
      callSafely(
        'onPointClick',
        options.onPointClick,
        eventFor(slot, seriesIndex, event),
      );
    },
    listenerOptions,
  );
  onOutsidePress(
    area,
    doc,
    () => {
      if (pinned) hide();
    },
    signal,
  );
  area.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        hide();
        return;
      }
      if (event.key === 'Enter') {
        if (active !== null && options.onPointClick)
          callSafely(
            'onPointClick',
            options.onPointClick,
            eventFor(active, null, null),
          );
        return;
      }
      const next = slotForKey(event.key, active, model.slots.length);
      if (next === null) return;
      event.preventDefault();
      select(next, true, null);
    },
    listenerOptions,
  );

  // The first draw comes with the observer's first notification, which the
  // browser delivers after layout and before the first paint, so mounting
  // forces no layout and the first frame is still complete. Later ones are
  // resizes.
  let first = true;
  const observing = observeSize(
    area,
    ({width, height}) => {
      draw(width, height, !first);
      first = false;
    },
    {immediate: true, signal},
  );
  if (!observing) {
    const rect = area.getBoundingClientRect();
    draw(rect.width, rect.height, false);
  }
}
