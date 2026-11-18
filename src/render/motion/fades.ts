import {tokens} from '../../tokens';
import type {Animator} from './animator';
import {KPI} from './selectors';
import {TIMING} from './timing';

const {motion} = tokens;

export const FADE: KeyframeAnimationOptions = {
  duration: TIMING.fadeDuration,
  easing: motion.fadeEasing,
  fill: 'backwards',
};

export type Phase = 'first' | 'afterLoading' | 'update';

export function revealHeader(
  animator: Animator,
  header: HTMLElement,
  phase: Phase,
): void {
  if (phase === 'update') return;
  if (phase === 'first') {
    animator.animate({
      element: header,
      keyframes: [
        {opacity: 0, transform: `translateY(${motion.riseDistance}px)`},
        {opacity: 1, transform: 'none'},
      ],
      options: FADE,
    });
    return;
  }
  const kpi = header.querySelector(KPI);
  if (kpi) {
    animator.animate({
      element: kpi,
      keyframes: [{opacity: 0}, {opacity: 1}],
      options: FADE,
    });
  }
}

export function revealSparkline(animator: Animator, sparkline: Element): void {
  animator.animate({
    element: sparkline,
    keyframes: [
      {clipPath: motion.sparklineRevealFrom},
      {clipPath: motion.sparklineRevealTo},
    ],
    options: {
      duration: TIMING.sparklineDuration,
      easing: motion.enterEasing,
      fill: 'backwards',
    },
  });
}
