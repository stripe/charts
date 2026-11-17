import type {ChartModel, Slot, SlotPoint} from '../../model';
import {stackValues} from '../../model';
import type {Animator} from './animator';
import {partProgress} from './animator';
import type {MotionTiming} from './timing';

export type PlotState = {
  chartType: 'line' | 'bar';
  model: ChartModel;
};

export type PlotFrame = {
  model: ChartModel;
  /**
   * Share of the plot's width shown, from the left, per series index, for
   * the line entrance. 1 when nothing is hidden.
   */
  reveals: readonly number[];
  /**
   * Opacity per series index while the legend hides or shows series; empty
   * when every series is fully shown (or fully hidden and not drawn).
   */
  seriesOpacity: readonly number[];
  annotationOpacity: number;
  axesOpacity: number;
  outgoingOpacity: number;
};

export type TransitionKind = 'enter' | 'tween' | 'replace';

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function sameShape(from: PlotState, to: PlotState): boolean {
  return (
    from.chartType === to.chartType &&
    from.model.stacked === to.model.stacked &&
    from.model.slots.length === to.model.slots.length &&
    from.model.series.length === to.model.series.length
  );
}

export function transitionKind(
  from: PlotState | null,
  to: PlotState,
): TransitionKind {
  if (!from || from.model.empty) return 'enter';
  return sameShape(from, to) ? 'tween' : 'replace';
}

/**
 * `slot` with its points replaced and, for stacked bars, its stack rebuilt
 * from them, so in-between segments stay joined however values change sign.
 */
function withPoints(
  slot: Slot,
  points: SlotPoint[],
  stacked: boolean,
  hidden: (seriesIndex: number) => boolean,
): Slot {
  return {
    ...slot,
    points,
    stack: stacked
      ? stackValues(
          points.map((point) => (hidden(point.seriesIndex) ? null : point.y)),
          points.map((point) => point.projected),
        )
      : slot.stack,
  };
}

/**
 * `to` with every value and the domain `t` of the way from `from`.
 *
 * A value that tweens from an old value stays inside the in-between domain,
 * since both move linearly between ranges that contain them. A gap that
 * fills has nothing to tween from: its point keeps its final position *on
 * screen* (the same share of the domain) while the domain tweens around it,
 * so it never lands outside the plot. For bars (`growFromZero`) a filled
 * gap instead grows from 0, the baseline every bar domain contains, so it
 * cannot start on the wrong side of it or re-stack on the wrong side. A gap
 * that opens, opens at once.
 */
export function interpolateModel(
  from: ChartModel,
  to: ChartModel,
  t: number,
  growFromZero = false,
): ChartModel {
  const yDomain: [number, number] = [
    lerp(from.yDomain[0], to.yDomain[0], t),
    lerp(from.yDomain[1], to.yDomain[1], t),
  ];
  const [toLow, toHigh] = to.yDomain;
  const toSpan = toHigh - toLow;
  const onScreen = (value: number): number =>
    toSpan === 0
      ? value
      : yDomain[0] + ((value - toLow) / toSpan) * (yDomain[1] - yDomain[0]);
  const tween = (old: number | null | undefined, next: number): number => {
    if (old === null || old === undefined) {
      return growFromZero ? lerp(0, next, t) : onScreen(next);
    }
    return lerp(old, next, t);
  };
  // A series the legend hides or shows stays drawn while it fades (see
  // `seriesOpacity`); in a stack it shrinks to, or grows from, nothing, so
  // the segments around it close up instead of jumping.
  const wasHidden = (index: number): boolean =>
    from.series[index]?.hidden ?? false;
  const series = to.series.map((entry, index) => ({
    ...entry,
    hidden: entry.hidden && wasHidden(index),
  }));
  const slots = to.slots.map((slot, index): Slot => {
    const before = from.slots[index];
    const points = slot.points.map((point) => {
      if (point.y === null) return point;
      const old = before?.points[point.seriesIndex];
      const hiding = to.series[point.seriesIndex]?.hidden === true;
      if (to.stacked && hiding !== wasHidden(point.seriesIndex)) {
        const scale = hiding ? 1 - t : t;
        return {
          ...point,
          y: (hiding ? old?.y ?? point.y : point.y) * scale,
          projected: point.projected === null ? null : point.projected * scale,
        };
      }
      return {
        ...point,
        y: tween(old?.y, point.y),
        low: point.low === null ? null : tween(old?.low, point.low),
        high: point.high === null ? null : tween(old?.high, point.high),
        // A projection that appears grows out of the value so far.
        projected:
          point.projected === null
            ? null
            : tween(old?.projected ?? old?.y, point.projected),
      };
    });
    return withPoints(
      slot,
      points,
      to.stacked,
      (seriesIndex) => series[seriesIndex]?.hidden === true,
    );
  });
  return {...to, series, slots, yDomain};
}

export function seriesOpacity(
  from: ChartModel,
  to: ChartModel,
  t: number,
): number[] {
  const changed = to.series.some(
    (entry, index) => entry.hidden !== (from.series[index]?.hidden ?? false),
  );
  if (!changed) return [];
  return to.series.map((entry, index) => {
    const before = from.series[index]?.hidden ?? false;
    if (entry.hidden === before) return 1;
    return entry.hidden ? 1 - t : t;
  });
}

export function growBars(
  model: ChartModel,
  progress: (slot: number, seriesIndex: number) => number,
): ChartModel {
  return {
    ...model,
    slots: model.slots.map((slot, index): Slot => {
      const points = slot.points.map((point) => {
        if (point.y === null) return point;
        const p = progress(index, model.stacked ? 0 : point.seriesIndex);
        return {
          ...point,
          y: point.y * p,
          projected: point.projected === null ? null : point.projected * p,
        };
      });
      return withPoints(
        slot,
        points,
        model.stacked,
        (seriesIndex) => model.series[seriesIndex]?.hidden === true,
      );
    }),
  };
}

export function seriesDelays(to: PlotState, timing: MotionTiming): number[] {
  const cascade = !(to.chartType === 'bar' && to.model.stacked);
  return to.model.series.map((_, index) =>
    cascade ? index * timing.seriesStagger : 0,
  );
}

/**
 * Delay between neighbouring bars' starts. Long series share a fixed
 * budget, so a chart with 90 bars takes no longer to enter than one with 10.
 */
export function barStagger(slotCount: number, timing: MotionTiming): number {
  if (slotCount < 2) return 0;
  return Math.min(timing.barStagger, timing.barStaggerMax / (slotCount - 1));
}

export function transitionDuration(
  kind: TransitionKind,
  to: PlotState,
  timing: MotionTiming,
): number {
  if (kind === 'tween') return timing.updateDuration;
  const annotations =
    kind === 'enter' && to.model.annotations.length > 0
      ? timing.extensionDelay + timing.fadeDuration
      : 0;
  const lastSeries = Math.max(0, ...seriesDelays(to, timing));
  const marks =
    to.chartType === 'bar'
      ? timing.barDuration +
        barStagger(to.model.slots.length, timing) *
          Math.max(0, to.model.slots.length - 1)
      : timing.enterDuration;
  return Math.max(marks + lastSeries, timing.fadeDuration, annotations);
}

export function frameAt(
  kind: TransitionKind,
  from: PlotState | null,
  to: PlotState,
  elapsed: number,
  timing: MotionTiming,
): PlotFrame {
  const fade = partProgress(elapsed, 0, timing.fadeDuration, timing.fadeEasing);
  if (kind === 'tween' && from) {
    const t = partProgress(
      elapsed,
      0,
      timing.updateDuration,
      timing.updateEasing,
    );
    return {
      model: interpolateModel(from.model, to.model, t, to.chartType === 'bar'),
      reveals: [],
      seriesOpacity: seriesOpacity(from.model, to.model, t),
      annotationOpacity: 1,
      axesOpacity: 1,
      outgoingOpacity: 0,
    };
  }
  const outgoingOpacity = kind === 'replace' ? 1 - fade : 0;
  const annotationOpacity =
    kind === 'enter'
      ? partProgress(
          elapsed,
          timing.extensionDelay,
          timing.fadeDuration,
          timing.fadeEasing,
        )
      : 1;
  const axesOpacity = kind === 'replace' ? 1 : fade;
  const delays = seriesDelays(to, timing);
  if (to.chartType === 'bar') {
    const stagger = barStagger(to.model.slots.length, timing);
    const model = growBars(to.model, (slot, seriesIndex) =>
      partProgress(
        elapsed,
        slot * stagger + (delays[seriesIndex] ?? 0),
        timing.barDuration,
        timing.enterEasing,
      ),
    );
    return {
      model,
      reveals: [],
      seriesOpacity: [],
      annotationOpacity,
      axesOpacity,
      outgoingOpacity,
    };
  }
  return {
    model: to.model,
    reveals: delays.map((delay) =>
      partProgress(elapsed, delay, timing.enterDuration, timing.enterEasing),
    ),
    seriesOpacity: [],
    annotationOpacity,
    axesOpacity,
    outgoingOpacity,
  };
}

export function finalFrame(to: PlotState): PlotFrame {
  return {
    model: to.model,
    reveals: [],
    seriesOpacity: [],
    annotationOpacity: 1,
    axesOpacity: 1,
    outgoingOpacity: 0,
  };
}

export type PlotTransition = {
  frame(): PlotFrame;
  current(): PlotState;
};

/**
 * Starts the transition to `to` and calls `redraw` on every frame. Without
 * motion the first frame is already the final one and `redraw` is never
 * called: the plot's own first draw shows the end state.
 */
export function startPlotTransition(
  animator: Animator,
  timing: MotionTiming,
  from: PlotState | null,
  to: PlotState,
  redraw: (transition: PlotTransition) => void,
): PlotTransition {
  const kind = transitionKind(from, to);
  let frame = finalFrame(to);
  const transition: PlotTransition = {
    frame: () => frame,
    current: () => ({chartType: to.chartType, model: frame.model}),
  };
  if (animator.enabled()) {
    frame = frameAt(kind, from, to, 0, timing);
    let started = false;
    animator.tween({
      duration: transitionDuration(kind, to, timing),
      onFrame: (elapsed) => {
        frame = frameAt(kind, from, to, elapsed, timing);
        // The first frame is the one the plot is about to draw itself.
        if (started) redraw(transition);
        started = true;
      },
      onEnd: () => {
        frame = finalFrame(to);
        redraw(transition);
      },
    });
  }
  return transition;
}

export function staticTransition(to: PlotState): PlotTransition {
  const frame = finalFrame(to);
  return {frame: () => frame, current: () => to};
}
