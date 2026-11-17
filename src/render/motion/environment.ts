export type MotionEnvironment = {
  now(): number;
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(handle: number): void;
  /** True when the viewer asked for reduced motion. Read when each animation starts. */
  prefersReducedMotion(): boolean;
  animate:
    | ((
        element: Element,
        keyframes: Keyframe[],
        options: KeyframeAnimationOptions,
      ) => Animation)
    | null;
  /**
   * True when `element` is in (or touching) the viewport, so a transition
   * there would be seen. Charts off screen skip their transitions: a page of
   * hundreds of charts would otherwise animate them all at once. Missing:
   * every chart counts as seen.
   */
  inView?: (element: Element) => boolean;
  /**
   * Arranges for the next {@link inView} answer for `element` to be measured
   * ahead of time, while layout is current, so asking forces no layout.
   */
  prepareInView?: (element: Element) => void;
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export const STATIC_ENVIRONMENT: MotionEnvironment = {
  now: () => 0,
  requestFrame: () => 0,
  cancelFrame: () => undefined,
  prefersReducedMotion: () => true,
  animate: null,
};

/**
 * The environment of the window `element` lives in. A page that cannot say
 * whether the viewer wants reduced motion (no `matchMedia`) or cannot
 * schedule frames gets {@link STATIC_ENVIRONMENT}: without the preference,
 * not animating is the safe choice.
 */
export function browserEnvironment(element: Element): MotionEnvironment {
  const view = element.ownerDocument.defaultView;
  if (
    !view ||
    typeof view.matchMedia !== 'function' ||
    typeof view.requestAnimationFrame !== 'function'
  ) {
    return STATIC_ENVIRONMENT;
  }
  const query = view.matchMedia(REDUCED_MOTION_QUERY);
  const canAnimate = typeof element.animate === 'function';
  return {
    now: () => view.performance.now(),
    requestFrame: (callback) => view.requestAnimationFrame(callback),
    cancelFrame: (handle) => view.cancelAnimationFrame(handle),
    prefersReducedMotion: () => query.matches,
    animate: canAnimate
      ? (target, keyframes, options) => target.animate(keyframes, options)
      : null,
    inView: (target) => viewProbe(view).answer(target),
    prepareInView: (target) => viewProbe(view).prepare(target),
  };
}

function measureInView(target: Element, view: Window): boolean {
  // A chart in a hidden subtree has no boxes; it can't be seen either.
  if (target.getClientRects().length === 0) return false;
  const rect = target.getBoundingClientRect();
  return (
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= view.innerHeight &&
    rect.left <= view.innerWidth
  );
}

type ViewProbe = {
  prepare(target: Element): void;
  answer(target: Element): boolean;
};

const probes = new WeakMap<Window, ViewProbe>();

/**
 * Measures charts' positions for {@link MotionEnvironment.inView} in a
 * resize observer shared by every chart in the window. It is created before
 * any plot's observer, and observers are notified in creation order, so it
 * reads positions at the start of a notification round, before any chart
 * has drawn and dirtied layout: hundreds of charts appear with no forced
 * layout between their draws.
 */
function viewProbe(view: Window): ViewProbe {
  const existing = probes.get(view);
  if (existing) return existing;
  const answers = new WeakMap<Element, boolean>();
  const Observer = (view as Window & {ResizeObserver?: typeof ResizeObserver})
    .ResizeObserver;
  const observer = Observer
    ? new Observer((entries) => {
        for (const {target} of entries) {
          answers.set(target, measureInView(target, view));
          observer?.unobserve(target);
        }
      })
    : null;
  const probe: ViewProbe = {
    prepare(target) {
      answers.delete(target);
      observer?.unobserve(target);
      observer?.observe(target);
    },
    answer(target) {
      const known = answers.get(target);
      answers.delete(target);
      return known ?? measureInView(target, view);
    },
  };
  probes.set(view, probe);
  return probe;
}
