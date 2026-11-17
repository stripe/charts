import type {ChartModel, ModelAnnotation} from '../../model';
import type {PointKind} from '../../options';
import type {SlotAnnotation} from '../../layout/annotations';
import {layoutAnnotations} from '../../layout/annotations';
import type {PlotLayout} from '../../layout/plot';
import type {BarRect} from '../../layout/marks';
import {barRects, linePath, stackedBarRects} from '../../layout/marks';
import {crisp} from '../../layout/scale';
import {
  forecastBand,
  hasTail,
  projectedSlots,
  splitByKind,
} from '../../layout/segments';
import {tokens} from '../../tokens';
import {svg} from '../dom';
import {seriesDrawOrder, withSeriesColor} from '../series';
import {annotationMarkers, annotationRanges} from './annotations';
import {
  barKindClass,
  barKindOverlay,
  hatchPattern,
  kindLineMark,
  projectedExtension,
  projectedMarkers,
} from './kinds';

/** What the drawing needs besides the layout. */
export type PlotData = {
  model: ChartModel;
  chartType: 'line' | 'bar';
  /** One color reference per series. */
  colors: readonly string[];
  /** Id for the marks' clip path, unique on the page. */
  clipId: string;
};

/** Series to draw, in drawing order, without those the legend hides. */
function visibleSeries(model: ChartModel): number[] {
  return seriesDrawOrder(model.series).filter(
    (index) => !model.series[index].hidden,
  );
}

function seriesValues(
  model: ChartModel,
  seriesIndex: number,
): (number | null)[] {
  return model.slots.map((slot) => slot.points[seriesIndex]?.y ?? null);
}

function seriesKinds(model: ChartModel, seriesIndex: number): PointKind[] {
  return model.slots.map((slot) => slot.points[seriesIndex]?.kind ?? 'actual');
}

const hatchId = (data: PlotData): string => `${data.clipId}-hatch`;

function slotAnnotation(annotation: ModelAnnotation): SlotAnnotation {
  const {kind, from, to, seriesIndex} = annotation;
  if (kind === 'range')
    return {
      kind,
      from: annotation.openStart ? null : from,
      to: annotation.openEnd ? null : to,
      wholeSlots: annotation.incomplete,
    };
  if (kind === 'point' && seriesIndex !== null)
    return {kind, slot: from, seriesIndex};
  return {kind: 'marker', slot: from};
}

/**
 * Where an annotation on a series' point sits: the point's value, or for
 * stacked bars the top of its segment. Null for a hidden series or a gap.
 */
function annotatedValue(
  model: ChartModel,
  slot: number,
  seriesIndex: number,
): number | null {
  if (model.series[seriesIndex]?.hidden) return null;
  const at = model.slots[slot];
  if (!at) return null;
  if (model.stacked)
    return at.stack.find((s) => s.seriesIndex === seriesIndex)?.y1 ?? null;
  return at.points[seriesIndex]?.y ?? null;
}

function gridlines(doc: Document, layout: PlotLayout): SVGGElement {
  const group = svg(doc, 'g', {class: 'sc-grid'});
  for (const y of layout.gridlines) {
    group.appendChild(
      svg(doc, 'line', {
        class: 'sc-gridline',
        x1: 0,
        x2: layout.plot.width,
        y1: y,
        y2: y,
      }),
    );
  }
  return group;
}

/**
 * A series' line. Incomplete and forecast points are drawn as dashed tails
 * (with a forecast band) by the kinds module; an all-actual series is one
 * path.
 */
function lineMark(
  doc: Document,
  model: ChartModel,
  seriesIndex: number,
  layout: PlotLayout,
): SVGElement {
  const values = seriesValues(model, seriesIndex);
  const kinds = seriesKinds(model, seriesIndex);
  const {comparison} = model.series[seriesIndex];
  if (hasTail(kinds)) {
    const points = model.slots.map((slot) => slot.points[seriesIndex]);
    const projected = points.map((point) => point?.projected ?? null);
    const band = comparison
      ? null
      : forecastBand(
          values,
          kinds,
          points.map((point) => point?.low ?? null),
          points.map((point) => point?.high ?? null),
          projected,
        );
    const mark = kindLineMark(
      doc,
      splitByKind(values, kinds, projected),
      band,
      comparison,
      layout,
      linePath,
    );
    // The tail ends at the projection, so the value so far gets a marker.
    mark.appendChild(
      projectedMarkers(
        doc,
        projectedSlots(values, kinds, projected),
        values,
        layout,
        projected,
      ),
    );
    return mark;
  }
  const className = comparison ? 'sc-line sc-comparison' : 'sc-line';
  return svg(doc, 'path', {class: className, d: linePath(values, layout)});
}

/**
 * Where a bar's projected extension runs, as values: from the end of the
 * value so far to the projected end; null for a bar without one.
 */
function projectedRange(
  model: ChartModel,
  slot: number,
  seriesIndex: number,
): [number, number] | null {
  const at = model.slots[slot];
  if (model.stacked) {
    const segment = at?.stack.find((s) => s.seriesIndex === seriesIndex);
    return segment && segment.actualY1 !== segment.y1
      ? [segment.actualY1, segment.y1]
      : null;
  }
  const point = at?.points[seriesIndex];
  return point && point.y !== null && point.projected !== null
    ? [point.y, point.projected]
    : null;
}

/**
 * A series' bars. A point's own color (a bar chart's `data[].color`)
 * overrides the series color on that bar alone. A bar on pace for more
 * gets an outlined extension to its projected end.
 */
function barMarks(
  doc: Document,
  rects: readonly BarRect[],
  model: ChartModel,
  seriesIndex: number,
  data: PlotData,
  layout: PlotLayout,
): SVGGElement {
  const bars = svg(doc, 'g', {class: 'sc-bars'});
  for (const rect of rects) {
    const point = model.slots[rect.slot]?.points[seriesIndex];
    const kind = point?.kind ?? 'actual';
    const bar = svg(doc, 'rect', {
      class: `sc-bar${barKindClass(kind)}`,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
    bars.appendChild(point?.color ? withSeriesColor(bar, point.color) : bar);
    const overlay = barKindOverlay(doc, rect, kind, hatchId(data));
    if (overlay) bars.appendChild(overlay);
    const range = projectedRange(model, rect.slot, seriesIndex);
    const extension =
      range &&
      projectedExtension(doc, rect, layout.y(range[0]), layout.y(range[1]));
    if (extension) bars.appendChild(extension);
  }
  return bars;
}

function marks(doc: Document, layout: PlotLayout, data: PlotData): SVGGElement {
  const group = svg(doc, 'g', {class: 'sc-marks'});
  const {model} = data;
  const stacked = model.stacked
    ? stackedBarRects(
        // The filled bar ends at the value so far; the extension shows the
        // rest of the projection.
        model.slots.map((slot) =>
          slot.stack.map((segment) => ({...segment, y1: segment.actualY1})),
        ),
        layout,
      )
    : null;
  // Hidden series take no band, so the bars left share each group.
  const bands = new Map(
    model.series
      .map((_, index) => index)
      .filter((index) => !model.series[index].hidden)
      .map((index, band) => [index, band]),
  );
  for (const index of visibleSeries(model)) {
    const mark =
      data.chartType === 'line'
        ? lineMark(doc, model, index, layout)
        : barMarks(
            doc,
            // A stacked series with no segment drawn (dense columns keep
            // another slot's stack) draws nothing, not unstacked bars.
            stacked
              ? (stacked.get(index) ?? [])
              : barRects(
                  seriesValues(model, index),
                  bands.get(index) ?? 0,
                  layout,
                ),
            model,
            index,
            data,
            layout,
          );
    // Lets the entrance animate each series on its own, whatever the
    // drawing order.
    mark.setAttribute('data-series', String(index));
    group.appendChild(withSeriesColor(mark, data.colors[index]));
  }
  return group;
}

function axes(doc: Document, layout: PlotLayout): SVGGElement {
  const {axis} = tokens;
  const group = svg(doc, 'g', {class: 'sc-axes'});
  const baseline = layout.baselineY;
  group.appendChild(
    svg(doc, 'line', {
      class: 'sc-baseline',
      x1: 0,
      x2: layout.plot.width,
      y1: baseline,
      y2: baseline,
    }),
  );
  if (layout.zeroY !== null) {
    group.appendChild(
      svg(doc, 'line', {
        class: 'sc-baseline',
        x1: 0,
        x2: layout.plot.width,
        y1: layout.zeroY,
        y2: layout.zeroY,
      }),
    );
  }
  const labelMiddle = layout.xLabelTop + axis.label.lineHeight / 2;
  for (const label of layout.xLabels) {
    const tickX = crisp(label.tickX, axis.baselineWidth);
    group.appendChild(
      svg(doc, 'line', {
        class: 'sc-tick',
        x1: tickX,
        x2: tickX,
        y1: baseline,
        y2: baseline + axis.tickLength,
      }),
    );
    const text = svg(doc, 'text', {
      class: 'sc-axis-label',
      x: label.left,
      y: labelMiddle,
      'dominant-baseline': 'central',
    });
    text.textContent = label.text;
    group.appendChild(text);
  }
  for (const label of layout.yLabels) {
    const text = svg(doc, 'text', {
      class: 'sc-axis-label',
      x: layout.yLabelLeft,
      y: label.y,
      'dominant-baseline': 'central',
    });
    text.textContent = label.label;
    group.appendChild(text);
  }
  return group;
}

/**
 * The clip for the marks: the plot, widened on every side by the larger of
 * a hover marker's and a so-far marker's reach, so they stay whole.
 * Marks can then never draw over the header or the axes, even mid-animation
 * when values tween past the domain.
 */
function marksClip(
  doc: Document,
  layout: PlotLayout,
  id: string,
): SVGDefsElement {
  const reach = Math.max(
    tokens.marker.radius + tokens.marker.ringWidth,
    tokens.projected.markerRadius + tokens.projected.markerStrokeWidth / 2,
  );
  const defs = svg(doc, 'defs');
  const clip = svg(doc, 'clipPath', {id});
  clip.appendChild(
    svg(doc, 'rect', {
      x: -reach,
      y: layout.plot.top - reach,
      width: layout.plot.width + 2 * reach,
      height: layout.plot.height + 2 * reach,
    }),
  );
  defs.append(clip, hatchPattern(doc, `${id}-hatch`));
  return defs;
}

/**
 * `content` inside a group clipped to the plot. The clip sits on a wrapper so
 * the entrance animation can set its own clip on the marks themselves.
 */
function clipped(
  doc: Document,
  content: SVGGElement,
  clipId: string,
): SVGGElement {
  const group = svg(doc, 'g', {
    class: 'sc-marks-clip',
    'clip-path': `url(#${clipId})`,
  });
  group.appendChild(content);
  return group;
}

/**
 * Replaces the SVG's content with the plot for `layout`. The last child is
 * an empty hover layer for {@link drawHover}.
 */
export function drawPlot(
  element: SVGSVGElement,
  layout: PlotLayout,
  data: PlotData,
): SVGGElement {
  const doc = element.ownerDocument;
  element.setAttribute('width', String(layout.width));
  element.setAttribute('height', String(layout.height));
  const hover = svg(doc, 'g', {class: 'sc-hover'});
  const {model} = data;
  const plot = {
    top: layout.plot.top,
    bottom: layout.baselineY,
    width: layout.plot.width,
    height: layout.plot.height,
  };
  const annotations = layoutAnnotations(
    model.annotations.map(slotAnnotation),
    {x: layout.x, y: layout.y, plot},
    (slot, seriesIndex) => annotatedValue(model, slot, seriesIndex),
    tokens.annotation.lineWidth,
  );
  element.replaceChildren(
    marksClip(doc, layout, data.clipId),
    gridlines(doc, layout),
    clipped(
      doc,
      annotationRanges(
        doc,
        annotations,
        plot,
        model.annotations.map((a) =>
          a.incomplete ? 'incomplete' : 'annotation',
        ),
        `${data.clipId}-annotation-range`,
      ),
      data.clipId,
    ),
    clipped(doc, marks(doc, layout, data), data.clipId),
    annotationMarkers(doc, annotations, plot, data.colors),
    axes(doc, layout),
    hover,
  );
  return hover;
}

/**
 * Draws the crosshair at `slot` and, for lines, a ringed marker on each
 * series' value there. Bars get only the crosshair; the bar itself already
 * marks the value.
 */
export function drawHover(
  group: SVGGElement,
  layout: PlotLayout,
  data: PlotData,
  slot: number,
): void {
  const doc = group.ownerDocument;
  const {crosshair, marker} = tokens;
  const x = crisp(layout.x.center(slot), crosshair.width);
  const children: SVGElement[] = [
    svg(doc, 'line', {
      class: 'sc-crosshair',
      x1: x,
      x2: x,
      y1: layout.plot.top,
      y2: layout.baselineY,
    }),
  ];
  if (data.chartType === 'line') {
    const cx = layout.x.center(slot);
    for (const index of visibleSeries(data.model)) {
      const value = data.model.slots[slot]?.points[index]?.y ?? null;
      if (value !== null) {
        const cy = layout.y(value);
        if (
          data.model.annotations.some(
            (a) =>
              a.kind === 'point' && a.from === slot && a.seriesIndex === index,
          )
        ) {
          children.push(
            withSeriesColor(
              svg(doc, 'circle', {
                class: 'sc-annotation-point sc-annotation-point-active',
                cx,
                cy,
                r: tokens.annotation.pointHoverRadius,
              }),
              data.colors[index],
            ),
          );
        }
        children.push(
          svg(doc, 'circle', {
            class: 'sc-marker-ring',
            cx,
            cy,
            r: marker.radius + marker.ringWidth,
          }),
          withSeriesColor(
            svg(doc, 'circle', {class: 'sc-marker', cx, cy, r: marker.radius}),
            data.colors[index],
          ),
        );
      }
    }
  }
  group.replaceChildren(...children);
}
