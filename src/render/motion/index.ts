// A chart's motion: the entrance when it first renders, tweens and
// cross-fades on `update()`, and the loading and updating states. One per
// chart handle, because an update animates from what the previous render
// left on screen.

import type {PlotLayout} from '../../layout/plot';
import type {ChartSpec} from '../../spec';
import {idPrefix} from '../ids';
import {createAnimator} from './animator';
import {captureMarks, decoratePlot} from './decorate';
import {animateDenseBars, isDense} from './dense';
import type {MotionEnvironment} from './environment';
import {browserEnvironment} from './environment';
import type {Phase} from './fades';
import {createCrossFader, revealHeader, revealSparkline} from './fades';
import type {SkeletonParts} from './lifecycle';
import {
  animateSkeleton,
  fadeOutLayer,
  liftSkeleton,
  showsData,
  showUpdating,
} from './lifecycle';
import type {PlotFrame, PlotState, PlotTransition} from './plotTransition';
import {
  staticTransition,
  startPlotTransition,
  transitionKind,
} from './plotTransition';
import {UPDATING_CLASS} from './selectors';
import {TIMING} from './timing';

export type {MotionEnvironment} from './environment';
export type {PlotFrame, PlotState} from './plotTransition';
export type {SkeletonParts} from './lifecycle';

export type PlotMotion = {
  frame(): PlotFrame;
  decorate(element: SVGSVGElement, layout: PlotLayout): void;
};

export type ChartMotion = {
  /**
   * Runs `remount` (which clears the root and renders `next`) between
   * capturing what is on screen and transitioning from it. When `next` is
   * loading without data and the chart shows data, `remount` is not called:
   * the chart stays and shows that it is updating (see {@link updating}).
   * With `instant`, nothing transitions: the new state is drawn in the same
   * frame (legend presses). The updating sweep and loading shimmer still run.
   */
  update(
    root: HTMLElement,
    next: ChartSpec,
    remount: () => void,
    options?: {instant?: boolean},
  ): void;
  updating(root: HTMLElement): void;
  revealHeader(header: HTMLElement): void;
  plot(state: PlotState, redraw: (plot: PlotMotion) => void): PlotMotion;
  /**
   * Cross-fades between two views of the same place, called right after the
   * switch: `incoming` is shown and `outgoing` already hidden by the
   * caller's styles. `outgoing` is kept visible while it fades out. A fade
   * still running on any of the elements is cancelled first, so fast
   * toggling never stacks fades.
   */
  crossFade(outgoing: readonly Element[], incoming: readonly Element[]): void;
  revealSparkline(sparkline: Element): void;
  skeleton(parts: SkeletonParts): void;
  cancelAll(): void;
};

function hasData(spec: ChartSpec): boolean {
  return (spec.series ?? []).some((series) => series.data.length > 0);
}

export function createChartMotion(
  element: HTMLElement,
  environment: MotionEnvironment = browserEnvironment(element),
): ChartMotion {
  // True while an instant update remounts: every animation started then
  // takes its end state at once, as under reduced motion.
  let instant = false;
  const animator = createAnimator({
    ...environment,
    prefersReducedMotion: () => instant || environment.prefersReducedMotion(),
  });
  // The sweep and shimmer show a state rather than a change, so an instant
  // update keeps them running; reduced motion still stops them.
  const indicators = createAnimator(environment);
  // Before the chart mounts, so its position is read ahead of its first draw.
  environment.prepareInView?.(element);
  const crossFader = createCrossFader(animator);
  const clipId = `${idPrefix()}-reveal`;
  let phase: Phase = 'first';
  let showingSkeleton = false;
  let plotTransition: PlotTransition | null = null;
  let previous: PlotState | null = null;
  let outgoingMarks: SVGGElement | null = null;

  const cancelAll = (): void => {
    animator.cancelAll();
    indicators.cancelAll();
    crossFader.clear();
  };

  // Set across a remount when the chart being replaced was updating.
  let refreshing = false;
  const updating = (root: HTMLElement): void =>
    showUpdating(indicators, root, refreshing);

  // Whether this render's plot transition would be seen: asked once per
  // render at its first draw, when layout is already clean, so asking forces
  // no extra layout. Cleared on update.
  let seen: boolean | null = null;
  // The header reveal waiting for the plot's first draw; see revealHeader.
  let pendingHeader: ((show: boolean) => void) | null = null;
  const inView = (): boolean => {
    seen ??= environment.inView?.(element) ?? true;
    return seen;
  };

  return {
    update(root, next, remount, options = {}) {
      // A refresh of a chart already showing data keeps it on screen, and
      // anything still entering finishes.
      if (
        next.loading === true &&
        !hasData(next) &&
        !showingSkeleton &&
        showsData(root)
      ) {
        updating(root);
        return;
      }
      instant = options.instant === true;
      const animate = animator.enabled();
      const wasLoading = showingSkeleton;
      previous = plotTransition?.current() ?? null;
      outgoingMarks = animate ? captureMarks(root) : null;
      plotTransition = null;
      showingSkeleton = false;
      cancelAll();
      const layer = animate && wasLoading ? liftSkeleton(root) : null;
      phase = wasLoading ? 'afterLoading' : 'update';
      refreshing = root.classList.contains(UPDATING_CLASS);
      seen = null;
      environment.prepareInView?.(element);
      try {
        remount();
      } finally {
        instant = false;
      }
      refreshing = false;
      if (layer) fadeOutLayer(animator, root, layer);
    },
    updating,
    revealHeader(header) {
      // A chart with a plot reveals its header at the plot's first draw,
      // with the plot's in-view answer (a draw driven by the resize observer
      // still comes before the first paint). Without a plot, it reveals now.
      const at = phase;
      const reveal = (show: boolean): void => {
        if (show) revealHeader(animator, header, at);
      };
      pendingHeader = reveal;
      queueMicrotask(() => {
        if (pendingHeader === reveal) {
          pendingHeader = null;
          reveal(true);
        }
      });
    },
    plot(state, redraw) {
      const from = phase === 'update' ? previous : null;
      const outgoing = outgoingMarks;
      previous = null;
      outgoingMarks = null;
      // Decided now: the first draw may come after an instant update ends.
      const animates = animator.enabled();
      const header = pendingHeader;
      pendingHeader = null;
      const firstDraw = (): boolean => {
        const show = animates && inView();
        header?.(show);
        return show;
      };
      if (isDense(state)) {
        // Drawn once at its final state; animated on the compositor.
        const transition = staticTransition(state);
        const kind = transitionKind(from, state);
        let started = false;
        plotTransition = transition;
        return {
          frame: transition.frame,
          decorate: (svgElement, layout) => {
            if (started) return;
            started = true;
            if (!firstDraw()) return;
            animateDenseBars(
              animator,
              svgElement,
              layout,
              kind,
              state,
              outgoing,
            );
          },
        };
      }
      const plotMotion = (transition: PlotTransition): PlotMotion => ({
        frame: transition.frame,
        decorate: (svgElement, layout) =>
          decoratePlot(
            svgElement,
            layout,
            transition.frame(),
            outgoing,
            clipId,
          ),
      });
      // Started at the first draw, not at mount: that is when the plot's
      // size is known and asking whether it is in view costs nothing.
      let started: PlotTransition | null = null;
      const transition: PlotTransition = {
        frame: () => {
          started ??= firstDraw()
            ? startPlotTransition(animator, TIMING, from, state, (current) =>
                redraw(plotMotion(current)),
              )
            : staticTransition(state);
          return started.frame();
        },
        current: () => started?.current() ?? state,
      };
      plotTransition = transition;
      return plotMotion(transition);
    },
    crossFade: (outgoing, incoming) => crossFader.crossFade(outgoing, incoming),
    revealSparkline(sparkline) {
      if (phase !== 'update') revealSparkline(animator, sparkline);
    },
    skeleton(parts) {
      showingSkeleton = true;
      animateSkeleton(indicators, parts);
    },
    cancelAll,
  };
}
