import type {Tokens} from '../../tokens';
import type {VarTree} from '../styles';

export function markRules(v: VarTree<Tokens>): string[] {
  const {annotation: a, incomplete: i, forecast: f, projected: pr} = v;
  return [
    `.sc-annotation-range-start{stop-color:${a.rangeColor};stop-opacity:${a.rangeOpacity};}`,
    `.sc-annotation-range-end{stop-color:${a.rangeColor};stop-opacity:${a.rangeEndOpacity};}`,
    `.sc-incomplete-range{fill:${i.rangeColor};fill-opacity:${i.rangeOpacity};}`,
    `.sc-annotation-line{stroke:${a.lineColor};stroke-width:${a.lineWidth};stroke-dasharray:${a.lineDash};}`,
    `.sc-annotation-point{fill:${a.pointColor};stroke:var(--sc-series-color);stroke-width:${a.pointRingWidth};filter:${a.pointShadow};}`,
    `.sc-line.sc-incomplete{stroke-dasharray:${i.lineDash};}`,
    `.sc-line.sc-forecast{stroke-dasharray:${f.lineDash};}`,
    `.sc-forecast-band{fill:var(--sc-series-color);fill-opacity:${f.bandOpacity};stroke:none;}`,
    `.sc-bar.sc-incomplete{fill-opacity:${i.barOpacity};}`,
    `.sc-hatch{pointer-events:none;}`,
    `.sc-hatch-stripe{fill:${i.hatchColor};}`,
    `.sc-bar.sc-forecast{fill-opacity:${f.barFillOpacity};}`,
    `.sc-forecast-outline{fill:none;stroke:var(--sc-series-color);stroke-width:${f.barStrokeWidth};pointer-events:none;}`,
    `.sc-projected-marker{fill:${pr.markerFill};stroke:var(--sc-series-color);stroke-width:${pr.markerStrokeWidth};}`,
    `.sc-projected-connector{stroke:var(--sc-series-color);stroke-width:${pr.connectorWidth};stroke-dasharray:${pr.connectorDash};stroke-opacity:${pr.connectorOpacity};}`,
    `.sc-projected-extension{fill:none;stroke:var(--sc-series-color);stroke-width:${pr.extensionStrokeWidth};stroke-dasharray:${pr.extensionDash};pointer-events:none;}`,
  ];
}
