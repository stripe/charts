import type {Tokens} from '../../tokens';
import type {VarTree} from '../styles';

export function motionRules(v: VarTree<Tokens>): string[] {
  const s = v.skeleton;
  const plotBottom = `calc(${v.plot.insetBottom} + ${v.axis.label.lineHeight} + ${v.axis.labelGap})`;
  return [
    // The previous render, fading out over the new one. Laid out like the
    // root (padding and gap inherited) so its parts sit over their
    // replacements.
    `.sc-outgoing{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;padding:inherit;gap:inherit;pointer-events:none;}`,

    // Placeholder blocks. At rest the gradient shows only its base color;
    // the shimmer slides the highlight across.
    `.sc-skeleton{display:block;border-radius:${s.radius};background-color:${s.color};background-image:linear-gradient(to right, ${s.color} ${s.shimmerBandStart}, ${s.shimmerHighlight} ${s.shimmerBandPeak}, ${s.color} 100%);background-size:${s.shimmerSize};background-repeat:no-repeat;}`,
    `.sc-skeleton-kpi{width:${s.kpiWidth};height:${v.kpi.value.lineHeight};}`,
    `.sc-tile .sc-skeleton-kpi{height:${v.tile.value.lineHeight};}`,
    `.sc-skeleton-marks{position:absolute;top:${v.plot.insetTop};right:0;bottom:${plotBottom};left:0;}`,
    `.sc-skeleton-grid{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;justify-content:space-between;}`,
    // Each gridline row: the line, then a y label placeholder centred on it.
    `.sc-skeleton-gridline{position:relative;height:0;margin-right:calc(${s.tickWidth} + ${v.axis.labelGap});border-top:${v.grid.width} solid ${v.grid.color};border-top-color:color-mix(in srgb, ${v.grid.color} calc(${v.grid.opacity} * 100%), transparent);}`,
    `.sc-skeleton-baseline{border-top:${v.axis.baselineWidth} solid ${v.axis.baselineColor};}`,
    `.sc-skeleton-tick{position:absolute;left:calc(100% + ${v.axis.labelGap});top:calc(${s.tickHeight} / -2);width:${s.tickWidth};height:${s.tickHeight};}`,
    `.sc-skeleton-line{position:absolute;top:0;left:0;width:calc(100% - ${s.tickWidth} - ${v.axis.labelGap});height:100%;overflow:visible;}`,
    `.sc-skeleton-line path{fill:none;stroke:${s.markColor};stroke-width:${v.series.strokeWidth};stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;}`,
    // Bars fill the same share of their slot as real bars.
    `.sc-skeleton-bars{position:absolute;top:0;right:calc(${s.tickWidth} + ${v.axis.labelGap});bottom:0;left:0;display:flex;}`,
    `.sc-skeleton-slot{display:flex;flex:1 1 0;align-items:flex-end;justify-content:center;}`,
    `.sc-skeleton-bar{width:calc(${v.series.barGroupRatio} * 100%);background:${s.color};}`,

    // Updating: the chart stays, dimmed, with a highlight sweeping across.
    `.sc-updating .sc-plot-area > svg,.sc-updating .sc-kpi,.sc-updating .sc-sparkline{opacity:${s.updatingOpacity};}`,
    `.sc-sweep{position:absolute;top:0;right:0;bottom:0;left:0;pointer-events:none;border-radius:inherit;background-image:linear-gradient(to right, transparent ${s.shimmerBandStart}, color-mix(in srgb, ${s.sweepHighlight} calc(${s.sweepHighlightOpacity} * 100%), transparent) ${s.shimmerBandPeak}, transparent 100%);background-size:${s.shimmerSize};background-repeat:no-repeat;}`,
  ];
}
