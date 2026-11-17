import type {AnnotationGeometry} from '../../layout/annotations';
import {tokens} from '../../tokens';
import {svg} from '../dom';
import {withSeriesColor} from '../series';

/** Where an annotation came from: the spec, or the automatic incomplete range. */
export type AnnotationSource = 'annotation' | 'incomplete';

/** The attribute holding an annotation's index, for hover targets. */
export const ANNOTATION_ATTRIBUTE = 'data-annotation';

/** The shaded ranges, one rect each, spanning the plot's height. */
export function annotationRanges(
  doc: Document,
  geometry: AnnotationGeometry,
  plot: {top: number; height: number},
  sources: readonly AnnotationSource[],
  gradientId: string,
): SVGGElement {
  const group = svg(doc, 'g', {class: 'sc-annotation-ranges'});
  if (geometry.ranges.some(({index}) => sources[index] !== 'incomplete')) {
    const gradient = svg(doc, 'linearGradient', {
      id: gradientId,
      x1: '0%',
      x2: '0%',
      y1: '0%',
      y2: '100%',
    });
    gradient.append(
      svg(doc, 'stop', {offset: '0%', class: 'sc-annotation-range-start'}),
      svg(doc, 'stop', {offset: '100%', class: 'sc-annotation-range-end'}),
    );
    const defs = svg(doc, 'defs');
    defs.appendChild(gradient);
    group.appendChild(defs);
  }
  for (const {index, x, width} of geometry.ranges) {
    const incomplete = sources[index] === 'incomplete';
    group.appendChild(
      svg(doc, 'rect', {
        class: incomplete ? 'sc-incomplete-range' : 'sc-annotation-range',
        x,
        y: plot.top,
        width,
        height: plot.height,
        ...(incomplete ? {} : {fill: `url(#${gradientId})`}),
        [ANNOTATION_ATTRIBUTE]: index,
      }),
    );
  }
  return group;
}

/** Dashed marker lines and hollow markers in their series' colors. */
export function annotationMarkers(
  doc: Document,
  geometry: AnnotationGeometry,
  plot: {top: number; bottom: number},
  colors: readonly string[],
): SVGGElement {
  const {pointRadius} = tokens.annotation;
  const group = svg(doc, 'g', {class: 'sc-annotation-markers'});
  for (const {index, x} of geometry.markers) {
    group.append(
      svg(doc, 'line', {
        class: 'sc-annotation-line',
        x1: x,
        x2: x,
        y1: plot.top,
        y2: plot.bottom,
        [ANNOTATION_ATTRIBUTE]: index,
      }),
    );
  }
  for (const {index, seriesIndex, x, y} of geometry.points) {
    group.appendChild(
      withSeriesColor(
        svg(doc, 'circle', {
          class: 'sc-annotation-point',
          cx: x,
          cy: y,
          r: pointRadius,
          [ANNOTATION_ATTRIBUTE]: index,
        }),
        colors[seriesIndex],
      ),
    );
  }
  return group;
}
