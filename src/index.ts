// Public entry point. Everything exported here is also on the `StripeCharts`
// global in the browser build.

import {VERSION} from './meta';
import {render as renderChart, renderErrorCard} from './render';
import type {RenderHandle} from './render';
import type {ChartHandle, ChartSpec, SpecIssue} from './spec';
import type {RenderOptions} from './options';
import {formatIssues, validate} from './validate';
import {validateOptions} from './validateOptions';

export {validate};
export {PACKAGE_NAME} from './meta';
export type {
  Annotation,
  AxesOptions,
  BarStacking,
  ChartHandle,
  ChartOptions,
  ChartSpec,
  ChartType,
  CurrencyFormat,
  CurrencyUnit,
  DataPoint,
  GoodDirection,
  IncompletePeriod,
  Kpi,
  KpiBasis,
  KpiNotation,
  LegendMode,
  NumberFormat,
  PercentFormat,
  PercentUnit,
  Provenance,
  ProvenanceDetail,
  Series,
  SpecIssue,
  ValidationResult,
  ValueFormat,
  XAxisLabels,
  XAxisOptions,
  YAxisNotation,
  YAxisOptions,
} from './spec';
export {OPTION_KEYS} from './options';
export type {
  LegendState,
  PointEvent,
  PointEventSeries,
  PointKind,
  RenderOptions,
  TooltipContext,
} from './options';

/** The package version. */
export const version: string = VERSION;

/** Thrown by `render` and `update` when the spec is invalid. */
export class SpecError extends Error {
  /** Every issue found, in spec order. */
  readonly errors: SpecIssue[];

  /**
   * The handle for the chart in the element, which shows the issues in an
   * error card. Call `update()` with a fixed spec to draw the chart, or
   * `destroy()` to remove the card. Set when thrown by `render` or `update`,
   * so a first spec that is invalid still leaves a usable chart; undefined
   * otherwise.
   */
  readonly chart: ChartHandle | undefined;

  constructor(errors: SpecIssue[], chart?: ChartHandle) {
    super(formatIssues(errors));
    this.name = 'SpecError';
    this.errors = errors;
    this.chart = chart;
  }
}

function checkElement(element: unknown): asserts element is HTMLElement {
  if (
    typeof element !== 'object' ||
    element === null ||
    typeof (element as Partial<HTMLElement>).appendChild !== 'function'
  ) {
    throw new TypeError('render: expected a DOM element as the first argument');
  }
}

/**
 * Renders a chart for `spec` into `element`, with optional `options`
 * (callbacks and formatters; see `RenderOptions`). If the spec or options
 * are invalid, draws a card listing every issue inside `element` and throws
 * a `SpecError` whose `chart` is the handle, so the caller can still
 * `update` or `destroy`; the same applies to `update`, which keeps the
 * previous options when given none. After `destroy`, `update` does nothing.
 */
export function render(
  element: HTMLElement,
  spec: unknown,
  options?: RenderOptions,
): ChartHandle {
  checkElement(element);
  let chart: RenderHandle | null = null;
  let errorCard: {destroy(): void} | null = null;
  let destroyed = false;
  let current: RenderOptions = {};

  // The handle exists before the first spec is checked, so a SpecError from
  // the very first render can carry it.
  const handle: ChartHandle = {
    update(next: unknown, nextOptions?: RenderOptions): void {
      if (!destroyed) show(next, nextOptions ?? current);
    },
    destroy(): void {
      destroyed = true;
      chart?.destroy();
      errorCard?.destroy();
      chart = null;
      errorCard = null;
    },
  };

  function show(next: unknown, nextOptions: RenderOptions | undefined): void {
    const result = validate(next);
    const errors = [
      ...(result.ok ? [] : result.errors),
      ...validateOptions(nextOptions),
    ];
    if (!result.ok || errors.length > 0) {
      chart?.destroy();
      chart = null;
      errorCard?.destroy();
      errorCard = renderErrorCard(element, errors);
      throw new SpecError(errors, handle);
    }
    current = nextOptions ?? {};
    errorCard?.destroy();
    errorCard = null;
    const valid: ChartSpec = result.spec;
    if (chart) chart.update(valid, current);
    else chart = renderChart(element, valid, current);
  }

  show(spec, options);
  return handle;
}
