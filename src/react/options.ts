// Each option forwards to the latest prop, so a new function identity on
// every render (an inline arrow) never reaches the core; only adding or
// removing a prop does, because the core behaves differently when an option
// is present (a pointer cursor for clicks, the default tooltip without one).

import type {ReactNode} from 'react';

import type {
  LegendState,
  PointEvent,
  RenderOptions,
  TooltipContext,
} from '../index';
import {OPTION_KEYS} from '../options';

/** The props that become render options. */
export type CallbackProps = {
  /**
   * Called when a slot is clicked, or when Enter is pressed on the focused
   * plot. Setting it shows a pointer cursor over the plot.
   */
  onPointClick?: (event: PointEvent) => void;
  /** Called as the hovered (or keyboard-focused) slot changes; null on leave. */
  onPointHover?: (event: PointEvent | null) => void;
  /** Called whenever the legend shows or hides a series. */
  onLegendChange?: (state: LegendState) => void;
  /**
   * Replaces the tooltip's contents with React content, rendered through a
   * portal, so it can use your components and context. The tooltip box, its
   * placement and its screen reader announcement stay the chart's. Return
   * `null` for the default tooltip.
   */
  renderTooltip?: (context: TooltipContext) => ReactNode;
  /** Rewrites a y-axis label; gets the value and the default label. */
  formatYTick?: (value: number, defaultLabel: string) => string;
  /** Rewrites an x-axis label; gets the tick's x and the default label. */
  formatXTick?: (x: string, defaultLabel: string) => string;
};

/** Which callback props are set: options change only when this does. */
export function optionsKey(props: CallbackProps): string {
  return OPTION_KEYS.filter((key) => props[key] !== undefined).join(',');
}

/**
 * Render options for the props set in `latest.current`, each forwarding to
 * the latest prop at call time. `renderTooltip` is the component's own
 * function that renders the prop's result into a portal.
 */
export function forwardingOptions(
  latest: {readonly current: CallbackProps},
  renderTooltip: (context: TooltipContext) => Node | null,
): RenderOptions {
  const props = latest.current;
  const options: RenderOptions = {};
  if (props.onPointClick) {
    options.onPointClick = (event) => latest.current.onPointClick?.(event);
  }
  if (props.onPointHover) {
    options.onPointHover = (event) => latest.current.onPointHover?.(event);
  }
  if (props.onLegendChange) {
    options.onLegendChange = (state) => latest.current.onLegendChange?.(state);
  }
  if (props.renderTooltip) options.renderTooltip = renderTooltip;
  if (props.formatYTick) {
    options.formatYTick = (value, label) =>
      latest.current.formatYTick?.(value, label) ?? label;
  }
  if (props.formatXTick) {
    options.formatXTick = (x, label) =>
      latest.current.formatXTick?.(x, label) ?? label;
  }
  return options;
}
