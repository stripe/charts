// Render options: the JavaScript-only third argument of `render(element,
// spec, options)` and `handle.update(spec, options)`. The spec stays plain
// JSON that an agent can write and serialize; behaviour that needs
// functions lives here. Errors thrown by these callbacks are caught and
// reported with `console.error`, so they never break the chart.

/**
 * What a point is: `"actual"` data, `"incomplete"` data in a period that is
 * not final yet (see `chart.incomplete`), or a `"forecast"`.
 */
export type PointKind = 'actual' | 'incomplete' | 'forecast';

/** One series' point at the slot an event is about. */
export type PointEventSeries = {
  /** The series label. */
  label: string;
  /** This series' own x at the slot, or null when it is shorter. */
  x: string | null;
  /** The value in major units or as a ratio, or null for a gap. */
  y: number | null;
  /** The value as the tooltip shows it, for example `"$412,000"`. */
  formatted: string;
  kind: PointKind;
  /**
   * Where an incomplete point is on pace to end (the spec's `projected`), in
   * the same units as `y`; null otherwise.
   */
  projected: number | null;
  /** The series color as drawn, a CSS color. */
  color: string;
};

/** A slot the pointer or keyboard is on, or was clicked. */
export type PointEvent = {
  /** The slot (position) index. */
  index: number;
  /** Every visible series at the slot, in tooltip order. */
  series: PointEventSeries[];
  /**
   * The series of the bar under the pointer, for a pointer click on a bar
   * chart; null otherwise, including every hover (which follows the slot,
   * not a bar) and keyboard events.
   */
  seriesLabel: string | null;
  /** The primary series' x at the slot. */
  x: string;
  /** The DOM event, or null when the keyboard caused it. */
  nativeEvent: Event | null;
};

/** What a custom tooltip gets: the slot, its default header and its notes. */
export type TooltipContext = Omit<PointEvent, 'nativeEvent'> & {
  /** The default tooltip header, for example `"Nov 27"`. */
  title: string;
  /** The annotations covering the slot. */
  annotations: {label: string; description?: string; series?: string}[];
};

/** The legend's state: the labels of the series it has hidden. */
export type LegendState = {hidden: string[]};

/**
 * Callbacks and formatters for a chart. Passed as the third argument of
 * `render`, or to `update`, where leaving it out keeps the previous options.
 */
export type RenderOptions = {
  /**
   * Called when a slot is clicked, or when Enter is pressed on the focused
   * plot. Setting it shows a pointer cursor over the plot.
   */
  onPointClick?(event: PointEvent): void;
  /** Called as the hovered (or keyboard-focused) slot changes; null on leave. */
  onPointHover?(event: PointEvent | null): void;
  /** Called whenever the legend shows or hides a series. */
  onLegendChange?(state: LegendState): void;
  /**
   * Replaces the tooltip's contents (its box, placement and screen reader
   * announcement stay): a Node is inserted as is, a string is shown as
   * text, never parsed as HTML, and null falls back to the default.
   */
  renderTooltip?(context: TooltipContext): Node | string | null;
  /** Rewrites a y-axis label; gets the value and the default label. */
  formatYTick?(value: number, defaultLabel: string): string;
  /** Rewrites an x-axis label; gets the tick's x and the default label. */
  formatXTick?(x: string, defaultLabel: string): string;
};

/** Every option, in documentation order. */
export const OPTION_KEYS: readonly (keyof RenderOptions)[] = [
  'onPointClick',
  'onPointHover',
  'onLegendChange',
  'renderTooltip',
  'formatYTick',
  'formatXTick',
];
