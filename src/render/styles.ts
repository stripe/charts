import {VERSION} from '../meta';
import type {RoleColor, TextToken} from '../tokens';
import {tokens} from '../tokens';
import {legendSparklineRules} from './legendSparklineStyles';
import {motionRules} from './motion/styles';
import {markRules} from './plot/markStyles';

type TokenLeaf = string | number | RoleColor;

export type VarTree<T> = {
  readonly [K in keyof T]: T[K] extends TokenLeaf ? string : VarTree<T[K]>;
};

const PREFIX = '--sc';

function isRoleColor(value: unknown): value is RoleColor {
  return typeof value === 'object' && value !== null && 'role' in value;
}

// Numbers in keys ending like these have no unit (`weight`, `opacity`,
// `barGroupRatio`, `gridlineCount`); every other number is a length in px.
const UNITLESS_KEY = /(weight|opacity|ratio|count)$/i;

function kebab(segment: string): string {
  return segment.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function cssValue(key: string, value: TokenLeaf): string {
  if (isRoleColor(value))
    return `var(${PREFIX}-color-${kebab(value.role)}, ${value.value})`;
  if (typeof value === 'string') return value;
  return UNITLESS_KEY.test(key) ? String(value) : `${value}px`;
}

/** A token's custom property and the default used when it is not set. */
export type TokenProperty = {name: string; fallback: string};

// No custom property is declared: each is read with its default as the
// var() fallback, so a value set on `.sc-root` or any ancestor (`:root`)
// applies, and a component color follows its role unless set itself.
function collect<T extends object>(
  tree: T,
  prefix: string,
  properties: TokenProperty[],
): VarTree<T> {
  // Arrays (the series palette) stay arrays, so `.length` keeps working.
  const result = (Array.isArray(tree) ? [] : {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(tree)) {
    const name = `${prefix}-${kebab(key)}`;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      isRoleColor(value)
    ) {
      const fallback = cssValue(key, value);
      properties.push({name, fallback});
      result[key] = `var(${name}, ${fallback})`;
    } else {
      result[key] = collect(value as object, name, properties);
    }
  }
  return result as VarTree<T>;
}

const properties: TokenProperty[] = [];

export const vars: VarTree<typeof tokens> = collect(tokens, PREFIX, properties);

/** Every token's custom property, in token order. */
export const tokenProperties: readonly TokenProperty[] = properties;

function font(text: VarTree<TextToken>): string {
  return `font-size:${text.size};line-height:${text.lineHeight};font-weight:${text.weight};color:${text.color};`;
}

const v = vars;
const numeric = `font-variant-numeric:${v.font.numeric};`;

// The visually hidden pattern: present for assistive technology, takes no
// space. The 1px size and negative margin are part of the idiom, not design
// values.
const visuallyHidden =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;';

const rules = [
  // Zero specificity, so a page rule such as `.sc-root{font-family:inherit}`
  // can hand the chart the page's font; `--sc-font-family` cannot, since
  // `inherit` there would apply to the custom property itself.
  `:where(.sc-root){font-family:${v.font.family};}`,
  `.sc-root{position:relative;display:flex;flex-direction:column;box-sizing:border-box;height:100%;min-width:0;margin:0;padding:${v.card.padding};background:${v.card.background};border:${v.card.borderWidth} solid ${v.card.borderColor};border-radius:${v.card.radius};color:${v.color.textPrimary};text-align:left;letter-spacing:normal;text-transform:none;}`,
  `.sc-root *,.sc-root *::before,.sc-root *::after{box-sizing:border-box;}`,
  `.sc-root.sc-tile{height:auto;padding:${v.tile.padding};background:${v.tile.background};border:${v.tile.borderWidth} solid ${v.tile.borderColor};border-radius:${v.tile.radius};gap:${v.tile.gap};}`,

  `.sc-header{display:flex;flex-direction:column;gap:${v.header.gap};flex:none;}`,
  `.sc-tile .sc-header{gap:${v.tile.gap};}`,
  `.sc-title-row{display:flex;align-items:center;min-width:0;}`,
  `.sc-title{margin:0;${font(v.header.title)}overflow-wrap:anywhere;}`,
  `.sc-tile .sc-title{${font(v.tile.label)}}`,
  `.sc-description{margin:0;${font(
    v.header.description,
  )}overflow-wrap:anywhere;}`,
  `.sc-kpi{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:${v.kpi.changeGap};margin:0;}`,
  `.sc-kpi-value{${font(v.kpi.value)}${numeric}}`,
  `.sc-kpi-change{${font(v.kpi.change)}${numeric}}`,
  `.sc-tile .sc-kpi{column-gap:${v.tile.changeGap};}`,
  `.sc-tile .sc-kpi-value{${font(v.tile.value)}}`,
  `.sc-tile .sc-kpi-change{${font(v.tile.change)}}`,
  // The change moves under the value only when the two don't share a line:
  // by wrapping, or for every slot when any slot's would wrap (`kpi.ts`).
  `.sc-kpi.sc-kpi-stacked{flex-direction:column;align-items:flex-start;}`,
  `.sc-kpi-probe{position:absolute;visibility:hidden;pointer-events:none;white-space:nowrap;}`,
  // An empty change keeps its line, so a change appearing on hover does not
  // make the row taller.
  `.sc-kpi-change:empty::before{content:"\\200b";}`,
  `.sc-root.sc-compact .sc-kpi-value{${font(v.kpi.compactValue)}}`,
  `.sc-root .sc-change-good{color:${v.color.good};}`,
  `.sc-root .sc-change-bad{color:${v.color.bad};}`,

  // Plot area. The SVG is absolutely positioned so it never sizes its
  // container: the container's size drives the layout, not the reverse.
  // The default height is a flex basis, not a minimum: in an element with
  // its own height the plot area grows or shrinks to fill it.
  `.sc-plot-area{position:relative;flex:1 1 ${v.plot.defaultHeight};min-height:0;margin-top:${v.header.plotGap};outline:none;}`,
  `.sc-plot-area.sc-clickable{cursor:pointer;}`,
  `.sc-plot-area:focus-visible{outline:${v.focusRingWidth} solid ${v.color.focusRing};outline-offset:${v.focusRingWidth};}`,
  `.sc-svg{position:absolute;top:0;left:0;display:block;overflow:visible;}`,
  `.sc-gridline{stroke:${v.grid.color};stroke-opacity:${v.grid.opacity};stroke-width:${v.grid.width};}`,
  `.sc-baseline,.sc-tick{stroke:${v.axis.baselineColor};stroke-width:${v.axis.baselineWidth};}`,
  `.sc-axis-label{fill:${v.axis.label.color};font-family:inherit;font-size:${v.axis.label.size};font-weight:${v.axis.label.weight};${numeric}}`,
  `.sc-line{fill:none;stroke:var(--sc-series-color);stroke-width:${v.series.strokeWidth};stroke-linecap:round;stroke-linejoin:round;}`,
  `.sc-line.sc-comparison{stroke-dasharray:${v.series.comparisonDash};}`,
  `.sc-bar{fill:var(--sc-series-color);}`,
  `.sc-crosshair{stroke:${v.crosshair.color};stroke-width:${v.crosshair.width};stroke-dasharray:${v.crosshair.dash};}`,
  `.sc-marker-ring{fill:${v.marker.ringColor};}`,
  `.sc-marker{fill:var(--sc-series-color);}`,
  `.sc-hover{pointer-events:none;}`,

  `.sc-tooltip{position:absolute;top:0;left:0;z-index:1;min-width:${
    v.tooltip.minWidth
  };padding:${v.tooltip.padding};background:${
    v.tooltip.background
  };border-radius:${v.tooltip.radius};box-shadow:${v.tooltip.shadow};border:${
    v.tooltip.borderWidth
  } solid ${
    v.tooltip.borderColor
  };pointer-events:none;white-space:nowrap;${font(v.tooltip.value)}}`,
  `.sc-tooltip[hidden]{display:none;}`,
  `.sc-tooltip-date{margin:0 0 ${v.tooltip.dateGap};${font(v.tooltip.date)}}`,
  `.sc-tooltip-annotated .sc-tooltip-date{padding-bottom:${v.tooltip.dateGap};border-bottom:${v.tooltip.dividerWidth} solid ${v.tooltip.dividerColor};${font(v.tooltip.annotatedDate)}}`,
  `.sc-tooltip-rows{display:grid;grid-template-columns:auto 1fr auto;align-items:center;column-gap:${v.tooltip.columnGap};row-gap:${v.tooltip.rowGap};margin:0;}`,
  `.sc-swatch{display:block;width:${v.tooltip.swatchWidth};height:${v.tooltip.swatchHeight};overflow:visible;}`,
  `.sc-swatch line{stroke:var(--sc-series-color);stroke-width:${v.tooltip.swatchHeight};}`,
  `.sc-swatch.sc-comparison line{stroke-dasharray:${v.tooltip.swatchDash};}`,
  `.sc-swatch.sc-forecast line{stroke-dasharray:${v.forecast.swatchDash};}`,
  `.sc-tooltip-label{${font(v.tooltip.label)}}`,
  `.sc-tooltip-value{${font(v.tooltip.value)}${numeric}text-align:right;}`,
  `.sc-tooltip-tag{margin-left:${v.tooltip.noteGap};${font(v.tooltip.tag)}}`,
  `.sc-tooltip-range{grid-column:2/-1;text-align:right;${font(
    v.tooltip.range,
  )}${numeric}}`,
  `.sc-tooltip-notes{display:grid;row-gap:${v.tooltip.noteGap};margin-top:${v.tooltip.notesGap};padding-top:${v.tooltip.notesGap};border-top:${v.tooltip.dividerWidth} solid ${v.tooltip.dividerColor};}`,
  `.sc-tooltip-note{max-width:${v.tooltip.noteMaxWidth};margin:0;white-space:normal;}`,
  `.sc-tooltip-note-label{display:block;${font(v.tooltip.noteLabel)}}`,
  `.sc-tooltip-note-description{display:block;${font(
    v.tooltip.noteDescription,
  )}}`,

  `.sc-empty{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${v.empty.gap};text-align:center;}`,
  `.sc-empty-icon{display:flex;align-items:center;justify-content:center;flex:none;width:${v.empty.iconSize};height:${v.empty.iconSize};border-radius:50%;background:${v.empty.iconBackground};color:${v.empty.glyphColor};}`,
  `.sc-empty-icon svg{width:${v.empty.glyphSize};height:${v.empty.glyphSize};fill:currentColor;}`,
  `.sc-empty-message{margin:0;${font(v.empty.message)}}`,
  `.sc-root.sc-error{align-items:center;justify-content:center;gap:${v.error.gap};min-height:${v.plot.defaultHeight};}`,
  `.sc-error-title{margin:0;${font(v.error.title)}}`,
  `.sc-error-issues{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:${
    v.error.gap
  };${font(v.error.issue)}}`,
  `.sc-error-path{font-family:${v.font.mono};color:${v.error.pathColor};}`,

  `.sc-visually-hidden{${visuallyHidden}}`,
  `.sc-measure{position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;white-space:nowrap;font-family:inherit;font-size:${v.axis.label.size};font-weight:${v.axis.label.weight};${numeric}}`,

  ...markRules(vars),
  ...motionRules(vars),

  ...legendSparklineRules(vars),
];

const STYLESHEET: string = rules.join('\n');

const STYLE_ATTRIBUTE = 'data-stripe-charts';

/**
 * True for a shadow root from any window. `instanceof ShadowRoot` fails for
 * one made by another window's DOM (a chart in a same-origin iframe), so
 * the check is structural: a document fragment with a host.
 */
function isShadowRoot(node: Node): node is ShadowRoot {
  return node.nodeType === Node.DOCUMENT_FRAGMENT_NODE && 'host' in node;
}

/**
 * Adds the stylesheet to the document, or to the shadow root `element` is
 * in, unless it is already there. Charts share one sheet, added once per
 * version. Versions are not isolated from each other: two versions on one
 * page each add their sheet, and both sheets match every chart's `sc-*`
 * classes, so the one added later wins where they differ.
 */
export function ensureStylesheet(element: HTMLElement): void {
  const root = element.getRootNode();
  const container: ParentNode = isShadowRoot(root)
    ? root
    : element.ownerDocument.head;
  const selector = `style[${STYLE_ATTRIBUTE}="${VERSION}"]`;
  if (container.querySelector(selector)) return;
  const style = element.ownerDocument.createElement('style');
  style.setAttribute(STYLE_ATTRIBUTE, VERSION);
  style.textContent = STYLESHEET;
  container.appendChild(style);
}
