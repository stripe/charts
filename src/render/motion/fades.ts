import {tokens} from '../../tokens';
import type {Animator} from './animator';
import {DETAILS_TRIGGER, KPI} from './selectors';
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
    const trigger = header.querySelector(DETAILS_TRIGGER);
    if (trigger) {
      animator.animate({
        element: trigger,
        keyframes: [{opacity: 0}, {opacity: 1}],
        options: {...FADE, delay: TIMING.extensionDelay},
      });
    }
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

export type CrossFader = {
  crossFade(outgoing: readonly Element[], incoming: readonly Element[]): void;
  clear(): void;
};

export function createCrossFader(animator: Animator): CrossFader {
  const running = new Map<Element, Animation>();
  const fade = (target: Element, keyframes: Keyframe[]): void => {
    running.get(target)?.cancel();
    running.delete(target);
    const animation = animator.animate({
      element: target,
      keyframes,
      options: {...FADE, fill: 'none'},
      onEnd: () => running.delete(target),
    });
    if (animation) running.set(target, animation);
  };
  return {
    crossFade(outgoing, incoming) {
      // The caller has already hidden `outgoing`; it stays visible while it
      // fades.
      for (const view of outgoing) {
        fade(view, [
          {opacity: 1, visibility: 'visible'},
          {opacity: 0, visibility: 'visible'},
        ]);
      }
      for (const view of incoming) fade(view, [{opacity: 0}, {opacity: 1}]);
    },
    clear: () => running.clear(),
  };
}
