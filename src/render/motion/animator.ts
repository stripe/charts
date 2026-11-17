import type {Easing} from './easing';
import type {MotionEnvironment} from './environment';

export type TweenOptions = {
  duration: number;
  /** Elapsed ms, not eased: callers that stagger parts ease each part. */
  onFrame: (elapsed: number) => void;
  onEnd?: () => void;
};

export type ElementAnimation = {
  element: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  onEnd?: () => void;
};

export type Animator = {
  enabled(): boolean;
  tween(options: TweenOptions): void;
  /**
   * Runs a Web Animation and returns it. Returns null, without animating,
   * when not {@link enabled} or the page lacks the API; the caller then
   * applies the end state itself.
   */
  animate(animation: ElementAnimation): Animation | null;
  cancelAll(): void;
};

export function createAnimator(environment: MotionEnvironment): Animator {
  const frames = new Set<number>();
  const animations = new Set<Animation>();

  const enabled = (): boolean => !environment.prefersReducedMotion();

  return {
    enabled,
    tween({duration, onFrame, onEnd}) {
      if (!enabled()) return;
      const start = environment.now();
      const step = (): void => {
        const elapsed = Math.max(0, environment.now() - start);
        onFrame(Math.min(elapsed, duration));
        if (elapsed >= duration) {
          onEnd?.();
          return;
        }
        const handle = environment.requestFrame(() => {
          frames.delete(handle);
          step();
        });
        frames.add(handle);
      };
      step();
    },
    animate({element, keyframes, options, onEnd}) {
      const {animate} = environment;
      if (!enabled() || !animate) return null;
      const animation = animate(element, keyframes, options);
      animations.add(animation);
      animation.addEventListener('finish', () => {
        animations.delete(animation);
        onEnd?.();
      });
      // Cancelled by its caller (a cross-fade replaced by a newer one): stop
      // tracking it, without `onEnd`, which is for animations that ran out.
      animation.addEventListener('cancel', () => animations.delete(animation));
      return animation;
    },
    cancelAll() {
      for (const handle of frames) environment.cancelFrame(handle);
      frames.clear();
      // Copied first: cancelling does not fire `finish`, but stay safe if a
      // page polyfill does.
      for (const animation of [...animations]) animation.cancel();
      animations.clear();
    },
  };
}

export function partProgress(
  elapsed: number,
  delay: number,
  duration: number,
  easing: Easing,
): number {
  if (duration <= 0) return 1;
  const linear = Math.min(1, Math.max(0, (elapsed - delay) / duration));
  return easing(linear);
}
