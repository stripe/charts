// Design tokens in two tiers: `primitives` are raw values, `tokens` give them
// a role. Render and layout code read only `tokens`.

/** Raw values. Not used directly outside this file. */
export const primitives = {
  color: {
    white: '#FFFFFF',
    gray25: '#F4F7FA',
    gray50: '#ECF1F6',
    gray100: '#D4DEE9',
    gray150: '#D5DBE1',
    gray200: '#BAC8DA',
    gray400: '#95A4BA',
    gray450: '#7D8BA4',
    gray500: '#667691',
    gray550: '#545969',
    gray600: '#50617A',
    gray700: '#3C4F69',
    gray750: '#414552',
    gray900: '#1A2C44',
    purple500: '#9966FF',
    chartBlue: '#0055BC',
    chartCyan: '#00A1C2',
    chartOrange: '#ED6804',
    chartMagenta: '#B3063D',
    chartDarkGreen: '#1C5A0D',
    chartPink: '#FA4A67',
    chartBrown: '#922700',
    chartGreen: '#3DA00B',
    green700: '#217005',
    red700: '#C0123C',
    transparent: 'transparent',
  },
  space: {
    none: 0,
    xxsmall: 2,
    xsmall: 4,
    small: 8,
    medium: 12,
    large: 16,
    xlarge: 20,
    xxlarge: 24,
  },
  radius: {none: 0, small: 4, medium: 6, large: 8},
  size: {
    icon: 12,
    glyph: 16,
    iconButton: 20,
    emptyIcon: 40,
    plotHeight: 240,
    tooltipMinWidth: 160,
    tooltipNoteWidth: 240,
  },
  font: {
    system:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
    mono: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
  },
  fontSize: {small: 12, medium: 14, large: 16, larger: 20, xlarge: 24},
  lineHeight: {small: 16, medium: 20, large: 24, larger: 28, xlarge: 32},
  fontWeight: {regular: 400, semibold: 600, bold: 700},
  stroke: {hairline: 1, regular: 2},
  opacity: {gridline: 0.66, subdued: 0.55, faint: 0.4, full: 1},
  shadow: {
    point: 'drop-shadow(0 0 3px rgba(48, 49, 61, 0.2))',
    raised: '0 3px 6px rgba(0, 0, 0, 0.12), 0 7px 14px rgba(48, 49, 61, 0.08)',
  },
  duration: {
    fast: '120ms',
    ui: '200ms',
    update: '400ms',
    bar: '480ms',
    enter: '600ms',
    sparkline: '400ms',
    shimmer: '1400ms',
    pulse: '2400ms',
    stagger: '24ms',
    seriesStagger: '80ms',
    staggerBudget: '240ms',
  },
  easing: {
    easeOut: 'ease-out',
    inOut: 'ease-in-out',
    /** Starts fast and settles: for things arriving on screen. */
    decelerate: 'cubic-bezier(0.2, 0, 0, 1)',
    /** Accelerates and settles: for things moving from one place to another. */
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  /** Placeholder sizes for the loading state. */
  placeholder: {
    tickWidth: 32,
    gridlineCount: 4,
  },
  /** Above this many bars, bars animate per series (see `render/motion/dense.ts`). */
  limit: {denseBars: 1500},
  /** Annotation, incomplete and forecast mark primitives. */
  mark: {
    /** 1px marker lines: short even dashes. */
    dashMarker: '4 4',
    /** 2px round-capped lines: dots, for data still being processed. */
    dashDotted: '0.5 4',
    /**
     * Forecasts: dash-dot, so they stay distinct from the comparison
     * line's even dashes and the incomplete period's dots.
     */
    dashForecast: '8 4 0.5 4',
    /** The same rhythm for a 12px swatch with square ends. */
    dashForecastSwatch: '4 2 1 2',
    /** Projected extensions: short dashes, unlike a forecast's solid outline. */
    dashProjected: '3 2',
    projectedMarkerRadius: 3,
    /** 1px dots joining a so-far marker to its projection. */
    dashConnector: '1 2',
    hatchSpacing: 6,
    hatchWidth: 2,
    tintOpacity: 0.08,
    halfOpacity: 0.5,
    bandOpacity: 0.12,
    lightOpacity: 0.15,
  },
  sparkline: {
    width: 96,
    minWidth: 72,
    height: 56,
    compactHeight: 40,
    // A 304px tile keeps it beside the value; a 280px one, whose text column
    // would be ~150px, puts it under.
    besideFrom: 272,
    areaOpacity: 0.18,
    haloOpacity: 0.2,
    markerRadius: 3,
  },
} as const;

const p = primitives;

/** A semantic color role: a key of {@link Tokens.color}. */
export type ColorRole =
  | 'surface'
  | 'textPrimary'
  | 'textSecondary'
  | 'textMuted'
  | 'textSubtle'
  | 'border'
  | 'divider'
  | 'fillSubtle'
  | 'good'
  | 'bad'
  | 'focusRing';

const semanticColor: Record<ColorRole, string> = {
  surface: p.color.white,
  textPrimary: p.color.gray900,
  textSecondary: p.color.gray700,
  textMuted: p.color.gray600,
  textSubtle: p.color.gray500,
  border: p.color.gray150,
  divider: p.color.gray100,
  fillSubtle: p.color.gray25,
  good: p.color.green700,
  bad: p.color.red700,
  focusRing: p.color.purple500,
};

/**
 * A component color that follows a semantic role. In CSS its default is the
 * role's custom property, so a theme that sets the role recolors every
 * component following it; `value` is the role's default color.
 */
export type RoleColor = {readonly role: ColorRole; readonly value: string};

/** A component color: a fixed value, or one following a role. */
export type Color = string | RoleColor;

/** The component color following `name`. */
export function role(name: ColorRole): RoleColor {
  return {role: name, value: semanticColor[name]};
}

/** Shared text style: size, line height, weight and color. */
export type TextToken = {
  size: number;
  lineHeight: number;
  weight: number;
  color: Color;
};

function text(
  size: number,
  lineHeight: number,
  weight: number,
  color: Color,
): TextToken {
  return {size, lineHeight, weight, color};
}

/** A text style. */
type Text = TextToken;

/**
 * The role-based token tree. Lengths are CSS pixels; `weight`, `opacity`
 * and ratios are unitless; dashes are SVG dash arrays.
 */
export type Tokens = {
  /** Width of keyboard focus outlines. */
  focusRingWidth: number;
  /** Font stacks and numeral style. */
  font: {family: string; mono: string; numeric: string};
  /**
   * The semantic colors. Component colors that follow a role (see
   * {@link role}) default to it in CSS, so a theme can recolor the chart
   * by setting these few and still override any component on its own.
   */
  color: {
    /** Background of the tile and tooltip, and the ring that separates marks. */
    surface: string;
    /** Titles, values and other text read first. */
    textPrimary: string;
    /** Labels and descriptions. */
    textSecondary: string;
    /** Tooltip dates, labels and notes. */
    textMuted: string;
    /** The quietest text: axis labels. */
    textSubtle: string;
    /** Outlines of the tile. */
    border: string;
    /** Gridlines and the thin rules between rows and sections. */
    divider: string;
    /** Quiet fills: the empty-state icon, button hovers and loading placeholders. */
    fillSubtle: string;
    /** A change in the good direction (see `kpi.goodDirection`). */
    good: string;
    /** A change in the bad direction. */
    bad: string;
    /** Keyboard focus outlines. */
    focusRing: string;
  };
  /** The chart's outer frame. */
  card: {
    background: string;
    borderWidth: number;
    borderColor: Color;
    radius: number;
    padding: number;
  };
  /** The KPI-only tile. */
  tile: {
    background: Color;
    borderWidth: number;
    borderColor: Color;
    radius: number;
    padding: number;
    gap: number;
    label: Text;
    value: Text;
    change: Text;
    changeGap: number;
  };
  /** Title, description and the gap below them. */
  header: {gap: number; title: Text; description: Text; plotGap: number};
  /** The headline value in a full chart. */
  kpi: {
    value: Text;
    compactValue: Text;
    change: Text;
    changeGap: number;
    compactBelow: number;
  };
  /** The plot area's insets and default height. */
  plot: {insetTop: number; insetBottom: number; defaultHeight: number};
  /** Axis labels, baseline, ticks and label spacing. */
  axis: {
    label: Text;
    labelGap: number;
    baselineColor: string;
    baselineWidth: number;
    tickLength: number;
    labelMinGap: number;
    tickLabelGap: {
      hour: number;
      day: number;
      week: number;
      month: number;
      monthlyMonth: number;
      year: number;
    };
    yTickSpacing: number;
    yTickMinSpacing: number;
    yMaxTickCount: number;
  };
  /** Horizontal gridlines. */
  grid: {color: Color; opacity: number; width: number};
  /** Lines and bars. */
  series: {
    strokeWidth: number;
    primary: readonly string[];
    comparison: string;
    comparisonDash: string;
    barGroupRatio: number;
    minBarWidth: number;
    overlayBelow: number;
    stackGap: number;
  };
  /** The hover crosshair. */
  crosshair: {color: string; width: number; dash: string};
  /** Point markers on the hovered slot. */
  marker: {radius: number; ringWidth: number; ringColor: Color};
  /** The hover tooltip card. */
  tooltip: {
    background: Color;
    radius: number;
    padding: number;
    shadow: string;
    borderWidth: number;
    borderColor: string;
    minWidth: number;
    plotOffset: number;
    sideGap: number;
    date: Text;
    /** Date heading above the divider when a tooltip contains annotations. */
    annotatedDate: Text;
    label: Text;
    value: Text;
    dateGap: number;
    columnGap: number;
    rowGap: number;
    swatchWidth: number;
    swatchHeight: number;
    swatchDash: string;
    tag: Text;
    range: Text;
    noteLabel: Text;
    noteDescription: Text;
    notesGap: number;
    noteGap: number;
    noteMaxWidth: number;
    dividerColor: Color;
    dividerWidth: number;
  };
  /** The legend row below the plot: a button per series, and a forecast key. */
  legend: {
    minSeriesCount: number;
    marginTop: number;
    columnGap: number;
    rowGap: number;
    swatchGap: number;
    swatchSize: number;
    label: Text;
    /** Background behind a hovered entry's label. */
    hoverBackground: Color;
    /** Text color of a hovered entry's label. */
    hoverColor: Color;
    /** A hidden series' label (its swatch keeps full colour). */
    hiddenOpacity: number;
    /** The "Forecast" key's color. */
    forecastColor: Color;
    /** Height of the band behind the line chart's forecast key. */
    forecastBandHeight: number;
  };
  /** The empty plot. */
  empty: {
    iconSize: number;
    glyphSize: number;
    iconBackground: Color;
    glyphColor: string;
    gap: number;
    message: Text;
  };
  /** The invalid-spec card. */
  error: {gap: number; title: Text; issue: Text; pathColor: Color};
  /**
   * Transitions and animations. Times and easings are CSS strings, so the
   * same value drives CSS, Web Animations and frame-by-frame tweens.
   */
  motion: {
    /** Hover affordances. */
    duration: string;
    easing: string;
    /** UI fades: header on first render, cross-fades. */
    fadeDuration: string;
    fadeEasing: string;
    /** How far the header rises as it fades in. */
    riseDistance: number;
    /** Lines drawing in from the left. */
    enterDuration: string;
    enterEasing: string;
    /** A KPI tile's sparkline drawing in from the left. */
    sparklineDuration: string;
    /** Clip the sparkline's reveal goes from (all hidden) and to (all shown). */
    sparklineRevealFrom: string;
    sparklineRevealTo: string;
    /** One bar growing from the baseline. */
    barDuration: string;
    /** Delay between neighbouring bars' starts... */
    barStagger: string;
    /** ...shrunk so all the delays together stay within this. */
    barStaggerMax: string;
    /** Delay between series entering, one after another. */
    seriesStagger: string;
    /**
     * Above this many bars, a bar chart animates whole series (grow, fade)
     * instead of redrawing every bar each frame, which is too slow there.
     */
    denseBarCount: number;
    /** Wait before extension elements fade in. */
    extensionDelay: string;
    /** Values and y scale tweening on update. */
    updateDuration: string;
    updateEasing: string;
    /** One sweep of the loading highlight across a placeholder. */
    shimmerDuration: string;
    shimmerEasing: string;
    /** One breath of the plot placeholder. */
    pulseDuration: string;
    pulseEasing: string;
  };
  /** The loading placeholders. */
  skeleton: {
    color: Color;
    /** Stroke of the placeholder line. */
    markColor: Color;
    radius: number;
    /** Width of the KPI placeholder, as a share of the chart. */
    kpiWidth: string;
    /** Size of the y label placeholders. */
    tickWidth: number;
    tickHeight: number;
    /** Gridlines above the baseline. */
    gridlineCount: number;
    /** Peak color of the band that slides across a placeholder block. */
    shimmerHighlight: Color;
    /** Where the band starts rising from `color`, across the background. */
    shimmerBandStart: string;
    /** Where the band peaks at its highlight. */
    shimmerBandPeak: string;
    shimmerSize: string;
    /** Background position the highlight sweeps from and to. */
    shimmerFrom: string;
    shimmerTo: string;
    /** Lowest opacity of the plot placeholder's pulse (the highest is 1). */
    pulseMinOpacity: number;
    /** Opacity of the data while a chart that has data is updating. */
    updatingOpacity: number;
    /** Color of the band that sweeps over an updating chart. */
    sweepHighlight: Color;
    /** How strongly that band shows over the chart. */
    sweepHighlightOpacity: number;
  };
  /**
   * Annotations: dashed vertical markers, hollow series-colored point
   * markers on a series, and shaded ranges behind the marks.
   */
  annotation: {
    lineColor: Color;
    lineWidth: number;
    lineDash: string;
    pointRadius: number;
    pointHoverRadius: number;
    /** The hollow marker's interior follows the chart surface. */
    pointColor: Color;
    pointRingWidth: number;
    pointShadow: string;
    rangeColor: Color;
    rangeOpacity: number;
    /** Opacity at the bottom of the shaded range. */
    rangeEndOpacity: number;
  };
  /** The incomplete period: dashed lines, hatched lighter bars, a range. */
  incomplete: {
    lineDash: string;
    barOpacity: number;
    /** Surface-colored stripes laid over incomplete bars. */
    hatchColor: Color;
    hatchWidth: number;
    hatchSpacing: number;
    hatchTransform: string;
    rangeColor: Color;
    rangeOpacity: number;
  };
  /** Forecasts: dashed lines with a low-high band, outlined light bars. */
  forecast: {
    lineDash: string;
    /** The forecast dash for legend and tooltip swatches. */
    swatchDash: string;
    bandOpacity: number;
    barFillOpacity: number;
    barStrokeWidth: number;
  };
  /**
   * Where an incomplete period is on pace to end: lines run their dotted
   * tail to the projected value and mark the actual value so far; bars add
   * a dashed outline from the actual top to the projected height.
   */
  projected: {
    /** The hollow marker on the actual value so far. */
    markerRadius: number;
    markerFill: Color;
    markerStrokeWidth: number;
    /** The faint dotted line from that marker up to the projected value. */
    connectorWidth: number;
    connectorDash: string;
    connectorOpacity: number;
    /** The outlined extension from a bar's actual top to its projection. */
    extensionStrokeWidth: number;
    extensionDash: string;
  };
  /** The sparkline in a KPI tile. */
  sparkline: {
    /** Width beside the value... */
    width: number;
    /** ...given up, down to this, so a long value and change fit on one line. */
    minWidth: number;
    height: number;
    /**
     * Tile content width from which the sparkline sits beside the value;
     * narrower tiles put it under the value, at full width.
     */
    besideFrom: number;
    /** Height when the sparkline is under the value. */
    compactHeight: number;
    /** Space between the tile's text and the sparkline. */
    gap: number;
    /** Keeps the stroke and dots inside the box. */
    inset: number;
    strokeWidth: number;
    comparisonDash: string;
    /** Opacity at the top of the area under the primary line. */
    areaOpacity: number;
    endDotRadius: number;
    haloRadius: number;
    haloOpacity: number;
    markerRadius: number;
    ringWidth: number;
  };
};

/** Role-based tokens. This is what render and layout code read. */
export const tokens: Tokens = {
  focusRingWidth: p.stroke.regular,
  font: {
    family: p.font.system,
    mono: p.font.mono,
    // Values sit in columns (ticks, tooltip, KPI); equal-width digits keep
    // them from jittering as they change.
    numeric: 'tabular-nums',
  },
  color: semanticColor,
  /**
   * The chart's outer frame. Unframed by default; a framed theme changes
   * these four values.
   */
  card: {
    background: p.color.transparent,
    borderWidth: p.space.none,
    borderColor: role('border'),
    radius: p.radius.none,
    padding: p.space.none,
  },
  /** The bordered tile used for `chart.type: "kpi"`. */
  tile: {
    background: role('surface'),
    borderWidth: p.stroke.hairline,
    borderColor: role('border'),
    radius: p.radius.large,
    padding: p.space.medium,
    gap: p.space.xsmall,
    label: text(
      p.fontSize.medium,
      p.lineHeight.medium,
      p.fontWeight.regular,
      role('textSecondary'),
    ),
    value: text(
      p.fontSize.xlarge,
      p.lineHeight.xlarge,
      p.fontWeight.bold,
      role('textPrimary'),
    ),
    change: text(
      p.fontSize.small,
      p.lineHeight.small,
      p.fontWeight.semibold,
      role('textSecondary'),
    ),
    changeGap: p.space.small,
  },
  header: {
    gap: p.space.xsmall,
    title: text(
      p.fontSize.large,
      p.lineHeight.large,
      p.fontWeight.regular,
      role('textPrimary'),
    ),
    description: text(
      p.fontSize.small,
      p.lineHeight.small,
      p.fontWeight.regular,
      role('textSecondary'),
    ),
    /** Space between the header block and the plot area. */
    plotGap: p.space.xxlarge,
  },
  kpi: {
    value: text(
      p.fontSize.xlarge,
      p.lineHeight.xlarge,
      p.fontWeight.bold,
      role('textPrimary'),
    ),
    /** The value one type step down, for narrow charts. */
    compactValue: text(
      p.fontSize.larger,
      p.lineHeight.larger,
      p.fontWeight.bold,
      role('textPrimary'),
    ),
    change: text(
      p.fontSize.medium,
      p.lineHeight.medium,
      p.fontWeight.regular,
      role('textSecondary'),
    ),
    changeGap: p.space.small,
    /**
     * Chart width at or below which the value steps down a type size. The
     * change stays beside it when they fit, and wraps under it when not.
     */
    compactBelow: 300,
  },
  plot: {
    /** Room above the plot so the top y label is not clipped. */
    insetTop: p.space.small,
    insetBottom: p.space.small,
    /**
     * Height of the plot area (plot and x axis) when the element has no
     * height of its own. With a height, the plot area fills what the header
     * leaves.
     */
    defaultHeight: p.size.plotHeight,
  },
  axis: {
    label: text(
      p.fontSize.small,
      p.lineHeight.small,
      p.fontWeight.regular,
      role('textSubtle'),
    ),
    /** Gap between the plot edge and the y labels, and the baseline and x labels. */
    labelGap: p.space.small,
    baselineColor: p.color.gray200,
    baselineWidth: p.stroke.hairline,
    tickLength: p.space.xsmall,
    /** Least space between two x labels. */
    labelMinGap: p.space.large,
    /**
     * Preferred space between neighbouring x labels, after their measured
     * widths, by time unit. Month starts on daily data are fairly sparse (a
     * year gets quarters from about 500px; a quarter gets every month at
     * 576px); a few days around a sale are
     * named one by one when they fit; short month names on monthly data
     * (`monthlyMonth`) give quarters at about 640px and every month at 1200px.
     */
    tickLabelGap: {
      hour: 40,
      day: 20,
      week: 56,
      month: 70,
      monthlyMonth: 40,
      year: 70,
    },
    /** Distance per y tick on a tall plot; short plots keep about 4 ticks. */
    yTickSpacing: 80,
    /**
     * Least vertical distance between y ticks. On a short plot, a coarser
     * nice step is used until ticks are at least this far apart.
     */
    yTickMinSpacing: 32,
    /** Most y ticks on any plot; more reads as a ruler, not a scale. */
    yMaxTickCount: 6,
  },
  grid: {
    color: role('divider'),
    opacity: p.opacity.gridline,
    width: p.stroke.hairline,
  },
  series: {
    strokeWidth: p.stroke.regular,
    /**
     * Categorical colors in assignment order: nine distinct colors, then
     * the first three repeated in slots ten through twelve.
     */
    primary: [
      p.color.purple500,
      p.color.chartBlue,
      p.color.chartCyan,
      p.color.chartOrange,
      p.color.chartMagenta,
      p.color.chartDarkGreen,
      p.color.chartPink,
      p.color.chartBrown,
      p.color.chartGreen,
      p.color.purple500,
      p.color.chartBlue,
      p.color.chartCyan,
    ],
    comparison: p.color.gray400,
    comparisonDash: '6 10',
    /** Bar group width as a share of its slot; the rest is the gap. */
    barGroupRatio: 0.8,
    /**
     * Below this, the gaps between bars shrink so the bars stay readable.
     */
    minBarWidth: p.stroke.regular,
    /**
     * Side-by-side bars thinner than this overlay each other across the
     * slot instead (comparison behind, primary in front), in whole pixels.
     */
    overlayBelow: 3,
    /** Seam between stacked segments, in the surface color (the gap shows it). */
    stackGap: p.stroke.hairline,
  },
  crosshair: {
    color: p.color.gray500,
    width: p.stroke.hairline,
    dash: '2 2',
  },
  marker: {
    radius: 5,
    ringWidth: p.stroke.hairline,
    ringColor: role('surface'),
  },
  tooltip: {
    background: role('surface'),
    radius: p.radius.large,
    padding: p.space.large,
    shadow: p.shadow.raised,
    /** No outline on the light surface; dark themes may want one. */
    borderWidth: p.space.none,
    borderColor: p.color.transparent,
    minWidth: p.size.tooltipMinWidth,
    /**
     * Distance below the plot's top edge. The tooltip stays at this fixed
     * height rather than chasing the pointer vertically,
     * but starts at the plot so the hover-following KPI stays visible.
     */
    plotOffset: p.space.none,
    /**
     * Space between the crosshair and the tooltip when it moves beside the
     * crosshair so as not to cover the hovered points.
     */
    sideGap: p.space.medium,
    date: text(
      p.fontSize.small,
      p.lineHeight.small,
      p.fontWeight.regular,
      role('textMuted'),
    ),
    label: text(
      p.fontSize.small,
      p.lineHeight.small,
      p.fontWeight.regular,
      role('textMuted'),
    ),
    value: text(
      p.fontSize.small,
      p.lineHeight.small,
      p.fontWeight.regular,
      role('textPrimary'),
    ),
    dateGap: p.space.small,
    annotatedDate: text(
      p.fontSize.medium,
      p.lineHeight.medium,
      p.fontWeight.semibold,
      role('textPrimary'),
    ),
    columnGap: p.space.small,
    rowGap: p.space.xsmall,
    swatchWidth: p.space.medium,
    swatchHeight: p.stroke.regular,
    /** Comparison swatch dash: two dashes across the swatch. */
    swatchDash: '4 4',
    /** "Incomplete" or "Forecast" after a row's label. */
    tag: text(
      p.fontSize.small,
      p.lineHeight.small,
      p.fontWeight.regular,
      p.color.gray450,
    ),
    /** A forecast's low to high range, under its value. */
    range: text(
      p.fontSize.small,
      p.lineHeight.small,
      p.fontWeight.regular,
      role('textMuted'),
    ),
    /** Annotations covering the slot, below the rows. */
    noteLabel: text(
      p.fontSize.small,
      p.lineHeight.small,
      p.fontWeight.semibold,
      role('textPrimary'),
    ),
    noteDescription: text(
      p.fontSize.small,
      p.lineHeight.small,
      p.fontWeight.regular,
      role('textMuted'),
    ),
    notesGap: p.space.small,
    noteGap: p.space.xsmall,
    /** Descriptions wrap at this width so a long one can't widen the box. */
    noteMaxWidth: p.size.tooltipNoteWidth,
    dividerColor: role('divider'),
    dividerWidth: p.stroke.hairline,
  },
  legend: {
    /** Fewer series than this are named only in the tooltip */
    minSeriesCount: 3,
    /** With the plot's bottom inset, ~24px under the x labels */
    marginTop: p.space.large,
    columnGap: p.space.small,
    rowGap: p.space.small,
    swatchGap: p.space.small,
    /** Bar swatches are squares this size; line swatches match the tooltip's. */
    swatchSize: p.space.medium,
    label: text(
      p.fontSize.small,
      p.lineHeight.small,
      p.fontWeight.regular,
      role('textSecondary'),
    ),
    hoverBackground: p.color.gray50,
    hoverColor: role('textPrimary'),
    hiddenOpacity: p.opacity.faint,
    forecastColor: role('textSubtle'),
    forecastBandHeight: p.space.small,
  },
  empty: {
    iconSize: p.size.emptyIcon,
    glyphSize: p.size.glyph,
    iconBackground: role('fillSubtle'),
    glyphColor: p.color.gray550,
    gap: p.space.xlarge,
    message: text(
      p.fontSize.small,
      p.lineHeight.small,
      p.fontWeight.regular,
      role('textSecondary'),
    ),
  },
  error: {
    gap: p.space.small,
    title: text(
      p.fontSize.medium,
      p.lineHeight.medium,
      p.fontWeight.semibold,
      role('textPrimary'),
    ),
    issue: text(
      p.fontSize.small,
      p.lineHeight.small,
      p.fontWeight.regular,
      role('textSecondary'),
    ),
    pathColor: role('textPrimary'),
  },
  motion: {
    duration: p.duration.fast,
    easing: p.easing.easeOut,
    fadeDuration: p.duration.ui,
    fadeEasing: p.easing.decelerate,
    riseDistance: p.space.xsmall,
    enterDuration: p.duration.enter,
    enterEasing: p.easing.decelerate,
    sparklineDuration: p.duration.sparkline,
    sparklineRevealFrom: 'inset(0 100% 0 0)',
    sparklineRevealTo: 'inset(0 0 0 0)',
    barDuration: p.duration.bar,
    barStagger: p.duration.stagger,
    barStaggerMax: p.duration.staggerBudget,
    seriesStagger: p.duration.seriesStagger,
    denseBarCount: p.limit.denseBars,
    extensionDelay: p.duration.enter,
    updateDuration: p.duration.update,
    updateEasing: p.easing.standard,
    shimmerDuration: p.duration.shimmer,
    shimmerEasing: p.easing.inOut,
    pulseDuration: p.duration.pulse,
    pulseEasing: p.easing.inOut,
  },
  skeleton: {
    color: role('fillSubtle'),
    markColor: role('divider'),
    radius: p.radius.small,
    kpiWidth: '25%',
    tickWidth: p.placeholder.tickWidth,
    tickHeight: p.space.small,
    gridlineCount: p.placeholder.gridlineCount,
    shimmerHighlight: role('surface'),
    shimmerBandStart: '50%',
    shimmerBandPeak: '80%',
    shimmerSize: '200% 100%',
    shimmerFrom: '200%',
    shimmerTo: '0%',
    pulseMinOpacity: 0.5,
    updatingOpacity: 0.4,
    sweepHighlight: role('surface'),
    sweepHighlightOpacity: 0.7,
  },
  // Forecasts use a dash-dot and incomplete data dots, so neither is mistaken
  // for a comparison series' even dashes.
  annotation: {
    lineColor: role('textMuted'),
    lineWidth: p.stroke.hairline,
    lineDash: p.mark.dashMarker,
    pointRadius: p.space.xsmall,
    pointHoverRadius: 7,
    pointColor: role('surface'),
    pointRingWidth: p.stroke.regular,
    pointShadow: p.shadow.point,
    rangeColor: role('textSecondary'),
    rangeOpacity: p.mark.tintOpacity,
    rangeEndOpacity: 0,
  },
  incomplete: {
    lineDash: p.mark.dashDotted,
    barOpacity: p.mark.halfOpacity,
    hatchColor: role('surface'),
    hatchWidth: p.mark.hatchWidth,
    hatchSpacing: p.mark.hatchSpacing,
    hatchTransform: 'rotate(45)',
    rangeColor: role('textSecondary'),
    rangeOpacity: p.mark.tintOpacity,
  },
  forecast: {
    lineDash: p.mark.dashForecast,
    swatchDash: p.mark.dashForecastSwatch,
    bandOpacity: p.mark.bandOpacity,
    barFillOpacity: p.mark.lightOpacity,
    barStrokeWidth: p.stroke.hairline,
  },
  projected: {
    markerRadius: p.mark.projectedMarkerRadius,
    markerFill: role('surface'),
    markerStrokeWidth: p.stroke.regular,
    connectorWidth: p.stroke.hairline,
    connectorDash: p.mark.dashConnector,
    connectorOpacity: p.mark.halfOpacity,
    extensionStrokeWidth: p.stroke.hairline,
    extensionDash: p.mark.dashProjected,
  },
  /** A 96x56 sparkline beside the value. */
  sparkline: {
    width: p.sparkline.width,
    minWidth: p.sparkline.minWidth,
    height: p.sparkline.height,
    besideFrom: p.sparkline.besideFrom,
    compactHeight: p.sparkline.compactHeight,
    gap: p.space.small,
    inset: p.space.xsmall,
    strokeWidth: p.stroke.regular,
    /** Shorter than the plot's dash, which would read as gaps at this size. */
    comparisonDash: '3 3',
    areaOpacity: p.sparkline.areaOpacity,
    endDotRadius: p.stroke.regular,
    haloRadius: p.space.xsmall,
    haloOpacity: p.sparkline.haloOpacity,
    markerRadius: p.sparkline.markerRadius,
    ringWidth: p.stroke.hairline,
  },
};
