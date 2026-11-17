import type {RenderOptions} from '../options';
import type {ChartSpec} from '../spec';
import {createRoot, mountChart} from './chart';
import {resolveSpec} from '../defaults';
import {callSafely} from './events';
import {legendShown} from './legend';
import {createLegendPresses} from './legendPresses';
import type {HiddenSeries} from './legendState';
import {NONE_HIDDEN, carryHidden, sameHidden} from './legendState';
import type {MotionEnvironment} from './motion';
import {createChartMotion} from './motion';
import {ensureStylesheet} from './styles';

export {renderErrorCard} from './errorCard';

/** Returned by {@link render}. */
export type RenderHandle = {
  /**
   * Redraws in place with another validated spec, and `options` if given;
   * leaving them out keeps the previous options.
   */
  update(spec: ChartSpec, options?: RenderOptions): void;
  /** Removes every node, listener and observer the chart added. */
  destroy(): void;
};

/**
 * Draws a chart for a validated spec into `element`, calling back through
 * validated `options`. The chart adds one
 * root element and leaves the rest of `element` alone; the shared
 * stylesheet is added to the document (or shadow root) once and kept, since
 * other charts may use it. `environment` replaces the page's frame clock
 * and reduced-motion preference, for tests.
 */
export function render(
  element: HTMLElement,
  spec: ChartSpec,
  options?: RenderOptions,
  environment?: MotionEnvironment,
): RenderHandle {
  ensureStylesheet(element);
  // The root is added before it is filled, so the plot can measure the
  // space it will have.
  const root = createRoot(element);
  const motion = createChartMotion(element, environment);
  let current = options ?? {};
  let shown = spec;
  // Set by a loading-only update while `shown` has data: that data stays on
  // screen, marked as updating, until the next spec with data arrives.
  let refreshing = false;
  const displayed = (): ChartSpec =>
    refreshing ? {...shown, loading: true} : shown;
  let hidden: HiddenSeries = NONE_HIDDEN;
  const setHidden = (next: HiddenSeries): void => {
    if (sameHidden(next, hidden)) return;
    hidden = next;
    callSafely('onLegendChange', current.onLegendChange, {hidden: [...next]});
  };
  const presses = createLegendPresses(
    () => ({hidden, labels: (shown.series ?? []).map((s) => s.label)}),
    (nextHidden, label) => {
      setHidden(nextHidden);
      redraw(displayed(), label, {instant: true});
    },
  );
  const mount = (next: ChartSpec, focusLabel: string | null): (() => void) =>
    mountChart(root, next, motion, current, {hidden, focusLabel, presses});
  let cleanup = mount(spec, null);
  function redraw(
    next: ChartSpec,
    focusLabel: string | null,
    how?: {instant?: boolean},
  ): void {
    motion.update(
      root,
      next,
      () => {
        cleanup();
        root.replaceChildren();
        cleanup = mount(next, focusLabel);
      },
      how,
    );
  }
  return {
    update(next, nextOptions) {
      if (nextOptions) current = nextOptions;
      const resolved = resolveSpec(next);
      // A loading placeholder (no data yet) keeps the previous chart's
      // legend state for the data that follows; without a legend otherwise,
      // nothing could bring a hidden series back.
      const placeholder =
        resolved.loading && resolved.series.every((s) => s.data.length === 0);
      if (placeholder && hasData(shown)) {
        refreshing = true;
        // Motion keeps the chart on screen for a refresh without
        // remounting, so new options need a remount of the data shown.
        redraw(nextOptions ? displayed() : next, null);
        return;
      }
      refreshing = false;
      if (!placeholder) {
        setHidden(
          legendShown(resolved)
            ? carryHidden(
                hidden,
                resolved.series.map((s) => s.label),
              )
            : NONE_HIDDEN,
        );
        shown = next;
      }
      redraw(next, null);
    },
    destroy() {
      motion.cancelAll();
      cleanup();
      root.remove();
    },
  };
}

function hasData(spec: ChartSpec): boolean {
  return (spec.series ?? []).some((series) => series.data.length > 0);
}
