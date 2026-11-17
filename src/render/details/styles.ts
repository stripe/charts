import type {TextToken, Tokens} from '../../tokens';
import type {VarTree} from '../styles';

function font(text: VarTree<TextToken>): string {
  return `font-size:${text.size};line-height:${text.lineHeight};font-weight:${text.weight};color:${text.color};`;
}

export function detailsRules(v: VarTree<Tokens>): string[] {
  const d = v.details;
  const t = v.table;
  const s = v.sparkline;
  const numeric = `font-variant-numeric:${v.font.numeric};`;
  return [
    // `placeLabel`). Not displayed at rest: even transparent, a label past
    // the page's right edge would make the page scroll sideways. The button
    // is named by `aria-label`, so hiding the label hides no name.
    `.sc-info{position:relative;}`,
    `.sc-info[aria-expanded="true"]{background:${v.infoButton.hoverBackground};}`,
    `.sc-info-label{position:absolute;top:50%;left:calc(100% + ${
      d.buttonLabel.offset
    });z-index:3;padding:${d.buttonLabel.paddingY} ${
      d.buttonLabel.paddingX
    };border-radius:${d.buttonLabel.radius};background:${
      d.buttonLabel.background
    };box-shadow:${d.buttonLabel.shadow};${font(
      d.buttonLabel.text,
    )}white-space:nowrap;pointer-events:none;display:none;transform:translateY(-50%);}`,
    `.sc-info-label.sc-info-label-above{top:auto;right:0;bottom:calc(100% + ${d.buttonLabel.offset});left:auto;transform:none;}`,
    `.sc-info:hover .sc-info-label,.sc-info:focus-visible .sc-info-label{display:block;}`,
    `.sc-info[aria-expanded="true"] .sc-info-label{display:none;}`,

    `.sc-details{position:absolute;right:${v.card.padding};bottom:${v.card.padding};left:${v.card.padding};z-index:1;min-height:0;}`,
    `.sc-details[hidden]{display:none;}`,
    `.sc-details-open > .sc-plot-area,.sc-details-open > .sc-tooltip,.sc-details-open > .sc-legend{visibility:hidden;}`,
    `.sc-details-content{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;align-items:stretch;gap:${d.sectionGap};overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;}`,
    // Floating by the info button, sized to its content within the width
    // limits; its height is capped to the viewport (set in script), and
    // then only the table scrolls.
    // Never while hidden: an open panel's own display must not keep a
    // closed one on screen.
    `.sc-details.sc-details-floating:not([hidden]){position:fixed;top:0;right:auto;bottom:auto;left:0;z-index:2;display:block;overflow-y:auto;width:max-content;min-width:${d.panel.minWidth};padding:${d.panel.padding};background:${d.panel.background};border:${d.panel.borderWidth} solid ${d.panel.borderColor};border-radius:${d.panel.radius};box-shadow:${d.panel.shadow};}`,
    // Plain blocks, not flex: the table's scroller gets an explicit max
    // height from script, so adding rows doesn't relay the whole table out.
    // The panel itself scrolls only when even the table's minimum doesn't fit.
    `.sc-details-floating .sc-details-content{position:static;display:block;overflow:visible;}`,
    `.sc-details-floating .sc-details-content > * + *{margin-top:${d.sectionGap};}`,
    `.sc-table-scroll{flex:0 1 auto;min-height:0;overflow-x:auto;overflow-y:auto;overscroll-behavior:contain;}`,

    // Focused from script on open to move the reading position; not a
    // control or a Tab stop, so no ring.
    `.sc-details-content:focus{outline:none;}`,
    `.sc-details-list{display:grid;flex:none;grid-template-columns:repeat(auto-fill,minmax(${d.entryMinWidth},1fr));gap:${d.entryGap};margin:0;}`,
    `.sc-details-list dt{margin:0;${font(d.label)}}`,
    `.sc-details-list dd{margin:0;${font(d.value)}overflow-wrap:anywhere;}`,

    `.sc-details-notes{display:flex;flex:none;flex-direction:column;gap:${d.entryGap};}`,
    `.sc-details-subheading{margin:0;${font(d.heading)}}`,
    `.sc-details-note-list{display:flex;flex-direction:column;gap:${d.entryGap};margin:0;padding:0;list-style:none;}`,
    `.sc-details-note-title,.sc-details-note-text{margin:0;${font(
      d.value,
    )}overflow-wrap:anywhere;}`,
    `.sc-details-note-title{display:flex;flex-wrap:wrap;column-gap:${t.dateGap};}`,
    `.sc-details-note-label{font-weight:${d.label.weight};}`,
    `.sc-details-note-when{color:${t.dateColor};${numeric}}`,

    `.sc-table{flex:none;width:100%;border-collapse:collapse;border-spacing:0;${numeric}}`,
    `.sc-table th,.sc-table td{padding:${t.cellPaddingY} ${
      t.cellPaddingX
    };${font(t.cell)}text-align:left;vertical-align:top;}`,
    // Values and dates stay whole; column headers wrap at their spaces. A
    // table that still doesn't fit scrolls sideways rather than break them.
    `.sc-table td{white-space:nowrap;}`,
    `.sc-table tbody th{white-space:nowrap;}`,
    `.sc-details-narrow .sc-table th,.sc-details-narrow .sc-table td{padding-right:${t.compactCellPaddingX};padding-left:${t.compactCellPaddingX};}`,
    `.sc-table tr > :first-child{padding-left:0;}`,
    `.sc-table tr > :last-child{padding-right:0;}`,
    // A sticky cell loses a collapsed border, so the header's rule is a
    // shadow.
    `.sc-table thead th{position:sticky;top:0;z-index:1;${font(
      t.header,
    )}background:${t.headerBackground};box-shadow:inset 0 calc(-1 * ${
      t.borderWidth
    }) 0 ${t.headerBorderColor};}`,
    `.sc-table tbody th{${font(t.rowHeader)}}`,
    `.sc-table .sc-table-sizer{visibility:collapse;}`,
    `.sc-table tbody tr + tr > *{border-top:${t.borderWidth} solid ${t.rowBorderColor};}`,
    `.sc-table .sc-table-value{text-align:right;}`,
    `.sc-table-pair{display:inline-flex;flex-wrap:wrap;justify-content:flex-end;column-gap:${t.dateGap};}`,
    `.sc-details-narrow .sc-table-pair{flex-direction:column-reverse;align-items:flex-end;}`,
    `.sc-table-date{color:${t.dateColor};}`,
    `.sc-table-stack{display:inline-flex;flex-direction:column;align-items:flex-end;}`,
    `.sc-table .sc-table-status{color:${t.dateColor};}`,

    `.sc-legend{flex:none;margin:${v.legend.marginTop} 0 0;}`,
    `.sc-legend-list{display:flex;flex-wrap:wrap;column-gap:${v.legend.columnGap};row-gap:${v.legend.rowGap};margin:0;padding:0;list-style:none;}`,
    `.sc-legend-item{display:flex;}`,
    `.sc-legend-button,.sc-legend-key{display:inline-flex;align-items:center;gap:${
      v.legend.swatchGap
    };${font(v.legend.label)}}`,
    `.sc-legend-button{margin:0;padding:0;border:0;background:transparent;font-family:inherit;cursor:pointer;}`,
    `.sc-legend-button:hover .sc-legend-label{background:${v.legend.hoverBackground};color:${v.legend.hoverColor};}`,
    `.sc-legend-button:focus-visible{outline:${v.infoButton.focusRingWidth} solid ${v.color.focusRing};outline-offset:${v.infoButton.focusRingWidth};}`,
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
    `.sc-sparkline:focus-visible{outline:${v.infoButton.focusRingWidth} solid ${v.color.focusRing};outline-offset:${v.infoButton.focusRingWidth};}`,
    `.sc-spark-svg{position:absolute;top:0;left:0;display:block;overflow:visible;}`,
    `.sc-spark-line{fill:none;stroke:var(--sc-series-color);stroke-width:${s.strokeWidth};stroke-linecap:round;stroke-linejoin:round;}`,
    `.sc-spark-line.sc-comparison{stroke-dasharray:${s.comparisonDash};}`,
    `.sc-spark-stop{stop-color:var(--sc-series-color);stop-opacity:${s.areaOpacity};}`,
    `.sc-spark-stop-end{stop-opacity:0;}`,
    `.sc-spark-halo{fill:var(--sc-series-color);fill-opacity:${s.haloOpacity};}`,
  ];
}
