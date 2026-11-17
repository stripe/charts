import type {BarRect} from '../../layout/marks';
import type {PlotLayout} from '../../layout/plot';
import type {Band, KindSegments} from '../../layout/segments';
import {crisp} from '../../layout/scale';
import type {PointKind} from '../../options';
import {tokens} from '../../tokens';
import {svg} from '../dom';

// Two decimals is finer than any display and keeps path strings short.
const COORDINATE_PRECISION = 100;
const round = (value: number): number =>
  Math.round(value * COORDINATE_PRECISION) / COORDINATE_PRECISION;

/**
 * The band between low and high bounds: the area through the highs left to
 * right and back through the lows, one closed shape per unbroken run.
 */
export function bandPath(
  band: Band,
  layout: Pick<PlotLayout, 'x' | 'y'>,
): string {
  const runs: {index: number; low: number; high: number}[][] = [[]];
  band.low.forEach((low, index) => {
    const high = band.high[index] ?? null;
    if (low === null || high === null) {
      if ((runs[runs.length - 1]?.length ?? 0) > 0) runs.push([]);
      return;
    }
    runs[runs.length - 1]?.push({index, low, high});
  });
  return runs
    .filter((run) => run.length > 1)
    .map((run) => {
      const at = (index: number, value: number): string =>
        `${round(layout.x.center(index))},${round(layout.y(value))}`;
      const top = run.map(({index, high}) => at(index, high));
      const bottom = [...run].reverse().map(({index, low}) => at(index, low));
      return `M${top.join('L')}L${bottom.join('L')}Z`;
    })
    .join('');
}

/**
 * A line series with tails: the forecast band, then the solid line and the
 * dashed incomplete and forecast tails, each through `linePath` (which thins
 * dense lines). One group, so the series still animates as one.
 */
export function kindLineMark(
  doc: Document,
  segments: KindSegments,
  band: Band | null,
  comparison: boolean,
  layout: PlotLayout,
  linePath: (values: readonly (number | null)[], plot: PlotLayout) => string,
): SVGGElement {
  const group = svg(doc, 'g', {class: 'sc-line-kinds'});
  const base = comparison ? 'sc-line sc-comparison' : 'sc-line';
  if (band) {
    const d = bandPath(band, layout);
    if (d) group.appendChild(svg(doc, 'path', {class: 'sc-forecast-band', d}));
  }
  const parts: [PointKind, string][] = [
    ['actual', base],
    ['incomplete', `${base} sc-incomplete`],
    ['forecast', `${base} sc-forecast`],
  ];
  for (const [kind, className] of parts) {
    const d = linePath(segments[kind], layout);
    if (d) group.appendChild(svg(doc, 'path', {class: className, d}));
  }
  return group;
}

/** The class modifier for a bar of `kind`, or '' for an actual one. */
export function barKindClass(kind: PointKind): string {
  return kind === 'actual' ? '' : ` sc-${kind}`;
}

/**
 * The extra shape drawn over a bar of `kind`: stripes over an incomplete
 * bar, the outline of a forecast bar, inset by half its stroke so a 1px line
 * lands on whole pixels. Null for actual bars and bars too thin to outline.
 */
export function barKindOverlay(
  doc: Document,
  rect: BarRect,
  kind: PointKind,
  hatchId: string,
): SVGRectElement | null {
  if (kind === 'incomplete') {
    return svg(doc, 'rect', {
      class: 'sc-hatch',
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      fill: `url(#${hatchId})`,
    });
  }
  const inset = tokens.forecast.barStrokeWidth / 2;
  if (
    kind !== 'forecast' ||
    rect.width <= 2 * inset ||
    rect.height <= 2 * inset
  ) {
    return null;
  }
  return svg(doc, 'rect', {
    class: 'sc-forecast-outline',
    x: rect.x + inset,
    y: rect.y + inset,
    width: rect.width - 2 * inset,
    height: rect.height - 2 * inset,
  });
}

/**
 * The stripe pattern for incomplete bars: surface-colored diagonal lines
 * over the bar's own (lighter) color, so one pattern serves every series.
 */
export function hatchPattern(doc: Document, id: string): SVGPatternElement {
  const {hatchSpacing, hatchWidth, hatchTransform} = tokens.incomplete;
  const pattern = svg(doc, 'pattern', {
    id,
    patternUnits: 'userSpaceOnUse',
    width: hatchSpacing,
    height: hatchSpacing,
    patternTransform: hatchTransform,
  });
  pattern.appendChild(
    svg(doc, 'rect', {
      class: 'sc-hatch-stripe',
      x: 0,
      y: 0,
      width: hatchWidth,
      height: hatchSpacing,
    }),
  );
  return pattern;
}

/**
 * Hollow markers on the actual-so-far values of points drawn at their
 * projection, at the same x as the tail's end, each joined to that end by a
 * faint dotted line so the two read as one period.
 */
export function projectedMarkers(
  doc: Document,
  slots: readonly number[],
  values: readonly (number | null)[],
  layout: Pick<PlotLayout, 'x' | 'y'>,
  projected: readonly (number | null)[] = [],
): SVGGElement {
  const {markerRadius, markerStrokeWidth, connectorWidth} = tokens.projected;
  const group = svg(doc, 'g', {class: 'sc-projected-markers'});
  for (const slot of slots) {
    const value = values[slot];
    if (value !== null && value !== undefined) {
      const center = layout.x.center(slot);
      const y = layout.y(value);
      const end = projected[slot];
      if (end !== null && end !== undefined) {
        // From the marker's edge, so the dots don't run under it.
        const endY = layout.y(end);
        const edge =
          (markerRadius + markerStrokeWidth / 2) * Math.sign(endY - y);
        const x = crisp(center, connectorWidth);
        group.appendChild(
          svg(doc, 'line', {
            class: 'sc-projected-connector',
            x1: x,
            x2: x,
            y1: round(y + edge),
            y2: round(endY),
          }),
        );
      }
      group.appendChild(
        svg(doc, 'circle', {
          class: 'sc-projected-marker',
          cx: round(center),
          cy: round(y),
          r: markerRadius,
        }),
      );
    }
  }
  return group;
}

/**
 * The outline from a bar's actual end (`fromY`) to its projected end
 * (`toY`): the two sides and the far end, open where it meets the actual
 * bar, inset by half its stroke so a 1px line lands on whole pixels. Null
 * when there is no room to draw it.
 */
export function projectedExtension(
  doc: Document,
  span: {x: number; width: number},
  fromY: number,
  toY: number,
): SVGPathElement | null {
  const inset = tokens.projected.extensionStrokeWidth / 2;
  const direction = Math.sign(toY - fromY);
  if (direction === 0 || span.width <= 2 * inset) return null;
  const left = round(span.x + inset);
  const right = round(span.x + span.width - inset);
  const end = round(toY - direction * inset);
  const start = round(fromY);
  return svg(doc, 'path', {
    class: 'sc-projected-extension',
    d: `M${left},${start}V${end}H${right}V${start}`,
  });
}
