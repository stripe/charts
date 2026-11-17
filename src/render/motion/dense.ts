// Bar charts with many bars animate whole series instead of single bars.
// Tweening redraws every bar each frame, too slow for thousands of bars, so the
// plot is drawn once at its final state and Web Animations move each series.

import type {PlotLayout} from '../../layout/plot';
import {tokens} from '../../tokens';
import type {Animator} from './animator';
import {FADE} from './fades';
import type {PlotState, TransitionKind} from './plotTransition';
import {seriesDelays} from './plotTransition';
import {MARKS, SERIES_ATTRIBUTE} from './selectors';
import {TIMING} from './timing';

const {motion} = tokens;

export function isDense(state: PlotState): boolean {
  if (state.chartType !== 'bar') return false;
  let bars = 0;
  for (const slot of state.model.slots) {
    for (const point of slot.points) if (point.y !== null) bars += 1;
  }
  return bars > motion.denseBarCount;
}

export function animateDenseBars(
  animator: Animator,
  element: SVGSVGElement,
  layout: PlotLayout,
  kind: TransitionKind,
  state: PlotState,
  outgoing: SVGGElement | null,
): void {
  const marks = element.querySelector<SVGGElement>(MARKS);
  if (!marks) return;
  if (outgoing && kind !== 'enter') {
    marks.before(outgoing);
    const started = animator.animate({
      element: outgoing,
      keyframes: [{opacity: 1}, {opacity: 0}],
      options: {...FADE, fill: 'forwards'},
      onEnd: () => outgoing.remove(),
    });
    if (!started) outgoing.remove();
  }
  if (kind === 'tween') {
    animator.animate({
      element: marks,
      keyframes: [{opacity: 0}, {opacity: 1}],
      options: FADE,
    });
    return;
  }
  // Each series grows from the bars' baseline, one after another. Scaling
  // the whole group about 0 keeps stacked segments joined.
  const origin = `0 ${layout.y(0)}px`;
  const delays = seriesDelays(state, TIMING);
  for (const group of marks.querySelectorAll(`[${SERIES_ATTRIBUTE}]`)) {
    const index = Number(group.getAttribute(SERIES_ATTRIBUTE));
    animator.animate({
      element: group,
      keyframes: [
        {transform: 'scaleY(0)', transformOrigin: origin},
        {transform: 'scaleY(1)', transformOrigin: origin},
      ],
      options: {
        duration: TIMING.enterDuration,
        easing: motion.enterEasing,
        delay: delays[index] ?? 0,
        fill: 'backwards',
      },
    });
  }
}
