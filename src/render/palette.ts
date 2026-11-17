import type {ChartModel} from '../model';
import {vars} from './styles';

type SeriesColorInput = Pick<ChartModel['series'][number], 'comparison'> & {
  /** The caller's color for the series, already validated as hex. */
  color?: string;
};

/**
 * Picks each series' color from `primaries` and `comparison`, or the
 * series' own color. Primary series take the categorical colors in order;
 * comparison series share the muted comparison color, since they are told
 * apart by their dash and label. A series with its own color still uses up
 * its place in the order, so setting one color repaints no other series.
 */
function assignColors(
  series: readonly SeriesColorInput[],
  primaries: readonly string[],
  comparison: string,
): string[] {
  let primaryIndex = 0;
  return series.map((s) => {
    if (s.comparison) return s.color ?? comparison;
    const color = primaries[primaryIndex % primaries.length];
    primaryIndex += 1;
    return s.color ?? color;
  });
}

/**
 * One color reference per series, in series order, for the stylesheet:
 * a palette custom property, or the series' own hex color.
 */
export function seriesColors(series: readonly SeriesColorInput[]): string[] {
  return assignColors(series, vars.series.primary, vars.series.comparison);
}

const CUSTOM_PROPERTY_REFERENCE = /^var\((--[\w-]+),\s*(.+)\)$/;

/**
 * `colors` from {@link seriesColors} as plain CSS color values, for callers
 * outside the chart (event payloads), where the chart's custom properties
 * don't apply. Each palette property is read from `element`'s computed
 * style, so a themed palette reaches the caller too; a series' own color
 * passes through.
 */
export function resolveColors(
  colors: readonly string[],
  element: Element,
): string[] {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return colors.map((color) => {
    const match = CUSTOM_PROPERTY_REFERENCE.exec(color);
    if (!match) return color;
    const [, name, fallback] = match;
    return style?.getPropertyValue(name).trim() || fallback;
  });
}

/** CSS property the stylesheet reads for a mark's color. */
export const SERIES_COLOR_PROPERTY = '--sc-series-color';
