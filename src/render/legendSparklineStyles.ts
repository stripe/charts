import type {TextToken, Tokens} from '../tokens';
import type {VarTree} from './styles';

function font(text: VarTree<TextToken>): string {
  return `font-size:${text.size};line-height:${text.lineHeight};font-weight:${text.weight};color:${text.color};`;
}

export function legendSparklineRules(v: VarTree<Tokens>): string[] {
  const s = v.sparkline;
  return [
    `.sc-legend{flex:none;margin:${v.legend.marginTop} 0 0;}`,
    `.sc-legend-list{display:flex;flex-wrap:wrap;column-gap:${v.legend.columnGap};row-gap:${v.legend.rowGap};margin:0;padding:0;list-style:none;}`,
    `.sc-legend-item{display:flex;}`,
    `.sc-legend-button,.sc-legend-key{display:inline-flex;align-items:center;gap:${
      v.legend.swatchGap
    };${font(v.legend.label)}}`,
    `.sc-legend-button{margin:0;padding:0;border:0;background:transparent;font-family:inherit;cursor:pointer;}`,
    `.sc-legend-button:hover .sc-legend-label{background:${v.legend.hoverBackground};color:${v.legend.hoverColor};}`,
    `.sc-legend-button:focus-visible{outline:${v.focusRingWidth} solid ${v.color.focusRing};outline-offset:${v.focusRingWidth};}`,
    `.sc-legend-button[aria-pressed="false"] .sc-legend-label{opacity:${v.legend.hiddenOpacity};}`,
    `.sc-swatch.sc-forecast-key{height:${v.legend.forecastBandHeight};}`,
    `.sc-forecast-key rect{fill:var(--sc-series-color);fill-opacity:${v.forecast.bandOpacity};}`,
    `.sc-forecast-key line{stroke-dasharray:${v.forecast.swatchDash};}`,
    // The projected-pace key, drawn like its mark (see `legend.ts`).
    `.sc-projected-key{display:block;flex:none;width:${v.legend.swatchSize};height:${v.legend.forecastBandHeight};overflow:visible;}`,
    `.sc-projected-key-bar{height:${v.legend.swatchSize};}`,
    `.sc-projected-key line{stroke:var(--sc-series-color);stroke-width:${v.tooltip.swatchHeight};stroke-dasharray:${v.incomplete.lineDash};}`,
    `.sc-projected-key circle{fill:${v.projected.markerFill};stroke:var(--sc-series-color);stroke-width:${v.projected.markerStrokeWidth};}`,
    `.sc-projected-key rect{fill:none;stroke:var(--sc-series-color);stroke-width:${v.projected.extensionStrokeWidth};stroke-dasharray:${v.projected.extensionDash};}`,
    `.sc-legend-square.sc-legend-forecast{border:${v.forecast.barStrokeWidth} solid var(--sc-series-color);background:color-mix(in srgb, var(--sc-series-color) calc(${v.forecast.barFillOpacity} * 100%), transparent);}`,
    `.sc-legend-square{display:block;flex:none;width:${v.legend.swatchSize};height:${v.legend.swatchSize};background:var(--sc-series-color);}`,

    // Beside the value, the value and change stay on one line, as in the
    // reference, and the sparkline gives up width for them, down to its
    // smallest (narrower than that, it goes under; see `watchPlacement`).
    // The text column's minimum is that one-line row; otherwise it takes
    // all the room the sparkline leaves, so the KPI sees its full width.
    `.sc-tile.sc-has-sparkline{display:grid;grid-template-columns:minmax(auto,1fr) minmax(${s.minWidth},${s.width});align-items:center;column-gap:${s.gap};}`,
    `.sc-has-sparkline:not(.sc-spark-below) .sc-kpi{flex-wrap:nowrap;}`,
    `.sc-tile.sc-has-sparkline.sc-spark-below{grid-template-columns:minmax(0,1fr);}`,
    `.sc-sparkline{position:relative;width:100%;height:${s.height};touch-action:pan-y;}`,
    `.sc-spark-below .sc-sparkline{height:${s.compactHeight};}`,
    `.sc-sparkline:focus{outline:none;}`,
    `.sc-sparkline:focus-visible{outline:${v.focusRingWidth} solid ${v.color.focusRing};outline-offset:${v.focusRingWidth};}`,
    `.sc-spark-svg{position:absolute;top:0;left:0;display:block;overflow:visible;}`,
    `.sc-spark-line{fill:none;stroke:var(--sc-series-color);stroke-width:${s.strokeWidth};stroke-linecap:round;stroke-linejoin:round;}`,
    `.sc-spark-line.sc-comparison{stroke-dasharray:${s.comparisonDash};}`,
    `.sc-spark-stop{stop-color:var(--sc-series-color);stop-opacity:${s.areaOpacity};}`,
    `.sc-spark-stop-end{stop-opacity:0;}`,
    `.sc-spark-halo{fill:var(--sc-series-color);fill-opacity:${s.haloOpacity};}`,
  ];
}
