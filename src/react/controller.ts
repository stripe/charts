import {render, SpecError} from '../index';
import type {ChartHandle, RenderOptions} from '../index';

/** One chart bound to one element. */
export type ChartController = {
  /**
   * Draws `spec` with `options`, or updates the chart an earlier call drew.
   * An invalid spec shows the error card and is passed to the `onError`
   * callback.
   */
  show(spec: unknown, options: RenderOptions): void;
  /**
   * Removes everything the chart added to the element. After this, `show`
   * does nothing.
   */
  destroy(): void;
};

/**
 * Binds a chart to `element`. Errors other than `SpecError` are bugs, not
 * bad input, and are rethrown.
 */
export function createController(
  element: HTMLElement,
  onError: (error: SpecError) => void,
): ChartController {
  let handle: ChartHandle | null = null;
  let destroyed = false;

  return {
    show(spec, options) {
      if (destroyed) return;
      try {
        if (handle) handle.update(spec, options);
        else handle = render(element, spec, options);
      } catch (error) {
        if (!(error instanceof SpecError)) throw error;
        // An invalid first spec still leaves a chart showing the error card;
        // its handle comes with the error.
        handle ??= error.chart ?? null;
        onError(error);
      }
    },
    destroy() {
      destroyed = true;
      handle?.destroy();
      handle = null;
    },
  };
}
