import type {PathPoint} from '../layout/marks';
import {tokens} from '../tokens';
import {svg} from './dom';
import {withSeriesColor} from './series';

/** A ringed dot on a hovered point. */
export function sparkMarker(
  doc: Document,
  point: PathPoint,
  color: string,
): SVGGElement {
  const {markerRadius, ringWidth} = tokens.sparkline;
  const group = withSeriesColor(
    svg(doc, 'g', {class: 'sc-spark-marker'}),
    color,
  );
  group.append(
    svg(doc, 'circle', {
      class: 'sc-marker-ring',
      cx: point.x,
      cy: point.y,
      r: markerRadius + ringWidth,
    }),
    svg(doc, 'circle', {
      class: 'sc-marker',
      cx: point.x,
      cy: point.y,
      r: markerRadius,
    }),
  );
  return group;
}

/** The latest point's dot with a soft halo, as in the reference tiles. */
export function sparkEndMarker(
  doc: Document,
  point: PathPoint,
  color: string,
): SVGGElement {
  const {endDotRadius, haloRadius} = tokens.sparkline;
  const group = withSeriesColor(svg(doc, 'g', {class: 'sc-spark-end'}), color);
  group.append(
    svg(doc, 'circle', {
      class: 'sc-spark-halo',
      cx: point.x,
      cy: point.y,
      r: haloRadius,
    }),
    svg(doc, 'circle', {
      class: 'sc-marker',
      cx: point.x,
      cy: point.y,
      r: endDotRadius,
    }),
  );
  return group;
}

/** The area's fill: the series color fading to nothing, top to bottom. */
export function sparkAreaGradient(doc: Document, id: string): SVGDefsElement {
  const gradient = svg(doc, 'linearGradient', {
    id,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 1,
  });
  gradient.append(
    svg(doc, 'stop', {class: 'sc-spark-stop', offset: 0}),
    svg(doc, 'stop', {class: 'sc-spark-stop sc-spark-stop-end', offset: 1}),
  );
  const defs = svg(doc, 'defs');
  defs.appendChild(gradient);
  return defs;
}
