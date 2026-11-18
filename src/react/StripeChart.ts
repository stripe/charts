// Written with createElement rather than JSX: the component is one element,
// and plain .ts keeps the package's build, lint and test setup unchanged.

import {createElement, forwardRef, Fragment, useCallback, useRef} from 'react';
import {flushSync} from 'react-dom';
import type {
  CSSProperties,
  ForwardedRef,
  ForwardRefExoticComponent,
  ReactElement,
  RefAttributes,
} from 'react';

import type {ChartSpec, SpecError, TooltipContext} from '../index';
import {useClientLayoutEffect} from './clientLayoutEffect';
import {createController} from './controller';
import type {ChartController} from './controller';
import {forwardingOptions, optionsKey} from './options';
import type {CallbackProps} from './options';
import {specKey} from './specKey';
import {TooltipPortal} from './TooltipPortal';
import type {TooltipOutlet} from './TooltipPortal';

/**
 * Props for {@link StripeChart}. The callbacks (`onPointClick`,
 * `onPointHover`, `onLegendChange`, `renderTooltip`, `formatYTick`,
 * `formatXTick`) can be new functions on every render: the chart always
 * calls the latest one and is not redrawn when only their identity changes.
 * A formatter's output is used the next time the chart lays out (on a
 * resize or a spec change), so make it a pure function of its arguments.
 */
export type StripeChartProps = CallbackProps & {
  /**
   * The chart to draw. Compared by serialized value, including object key
   * order, so an inline object literal with the same serialization on every
   * render does not redraw it. Unserializable specs are compared by identity.
   * The spec is validated at runtime as well: JSON of unknown shape can be
   * passed with a cast (`JSON.parse(text) as ChartSpec`), and an invalid one
   * is reported through {@link StripeChartProps.onError}.
   */
  spec: ChartSpec;
  /** Class name for the container `div`. */
  className?: string;
  /**
   * Inline style for the container `div`. Line and bar charts fill the
   * container's height, so give it one (for example `{height: 320}`); a KPI
   * card sizes itself.
   */
  style?: CSSProperties;
  /** `id` for the container `div`. */
  id?: string;
  /**
   * Called when `spec` is invalid, with every issue found. The chart shows
   * a card listing the issues in its place either way; nothing is thrown.
   * Validation runs on mount and when the serialized spec or set of callback
   * options changes, so an unchanged invalid spec can be reported again.
   */
  onError?: (error: SpecError) => void;
};

/** Points `ref`, whichever kind it is, at `node`. */
function assignRef<T>(ref: ForwardedRef<T>, node: T | null): void {
  if (typeof ref === 'function') ref(node);
  else if (ref) ref.current = node;
}

function StripeChartWithRef(
  {spec, className, style, id, onError, ...callbacks}: StripeChartProps,
  ref: ForwardedRef<HTMLDivElement>,
): ReactElement {
  const container = useRef<HTMLDivElement | null>(null);
  const controller = useRef<ChartController | null>(null);
  const tooltipOutlet = useRef<TooltipOutlet | null>(null);
  const tooltipHost = useRef<HTMLElement | null>(null);
  // The latest props, read by effects and callbacks that should not re-run
  // when only these change.
  const latestSpec = useRef(spec);
  const latestOnError = useRef(onError);
  const latestCallbacks = useRef<CallbackProps>(callbacks);

  const setContainer = useCallback(
    (node: HTMLDivElement | null) => {
      container.current = node;
      assignRef(ref, node);
    },
    [ref],
  );

  // The core's renderTooltip: renders the prop's React content into a node
  // this component owns and hands that node to the tooltip box. flushSync
  // commits the portal before returning, so the box is measured and placed
  // with the final content.
  const renderTooltip = useCallback((context: TooltipContext): Node | null => {
    const content = latestCallbacks.current.renderTooltip?.(context);
    const outlet = tooltipOutlet.current;
    const element = container.current;
    if (
      content === null ||
      content === undefined ||
      typeof content === 'boolean' ||
      !outlet ||
      !element
    ) {
      return null;
    }
    tooltipHost.current ??= element.ownerDocument.createElement('div');
    const host = tooltipHost.current;
    flushSync(() => outlet.show(host, content));
    return host;
  }, []);

  useClientLayoutEffect(() => {
    latestSpec.current = spec;
    latestOnError.current = onError;
    latestCallbacks.current = callbacks;
  });

  // One chart per mounted container. Under StrictMode's double mount the
  // first chart is destroyed before the second is created.
  useClientLayoutEffect(() => {
    const element = container.current;
    if (!element) return undefined;
    const chart = createController(element, (error) =>
      latestOnError.current?.(error),
    );
    controller.current = chart;
    return () => {
      chart.destroy();
      controller.current = null;
    };
  }, []);

  const key = specKey(spec);
  const options = optionsKey(callbacks);
  useClientLayoutEffect(() => {
    if (!latestCallbacks.current.renderTooltip) tooltipOutlet.current?.clear();
    controller.current?.show(
      latestSpec.current,
      forwardingOptions(latestCallbacks, renderTooltip),
    );
  }, [key, options, renderTooltip]);

  return createElement(
    Fragment,
    null,
    createElement('div', {ref: setContainer, id, className, style}),
    createElement(TooltipPortal, {outlet: tooltipOutlet}),
  );
}

/**
 * Draws a chart from a {@link ChartSpec}. Renders one `div` (the forwarded
 * `ref` points at it) and draws the chart into it on the client; on the
 * server only the empty `div` is rendered. The chart updates in place when
 * the spec's value changes and is removed on unmount.
 *
 * @example
 * ```tsx
 * <StripeChart
 *   spec={{
 *     title: 'Gross volume',
 *     format: {style: 'currency', currency: 'usd', unit: 'minor'},
 *     series: [{label: '2026', data: [{x: '2026-11-27', y: 41200025}]}],
 *   }}
 *   style={{height: 320}}
 *   onError={(error) => console.warn(error.errors)}
 * />
 * ```
 */
export const StripeChart: ForwardRefExoticComponent<
  StripeChartProps & RefAttributes<HTMLDivElement>
> = forwardRef(StripeChartWithRef);
