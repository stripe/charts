import {tokens} from '../../tokens';
import type {Animator} from './animator';
import {FADE} from './fades';
import {
  DIMMED,
  HEADER,
  KPI,
  OUTGOING_CLASS,
  PLOT_AREA,
  SWEEP_CLASS,
  UPDATING_CLASS,
} from './selectors';
import {TIMING} from './timing';

const {motion, skeleton} = tokens;

export type SkeletonParts = {
  shimmer: readonly HTMLElement[];
  pulse: readonly Element[];
};

const FOREVER: KeyframeAnimationOptions = {
  iterations: Infinity,
  easing: 'linear',
};

function shimmer(animator: Animator, element: Element): void {
  animator.animate({
    element,
    keyframes: [
      {
        backgroundPositionX: skeleton.shimmerFrom,
        easing: motion.shimmerEasing,
      },
      {backgroundPositionX: skeleton.shimmerTo},
    ],
    options: {...FOREVER, duration: TIMING.shimmerDuration},
  });
}

export function animateSkeleton(
  animator: Animator,
  {shimmer: blocks, pulse}: SkeletonParts,
): void {
  for (const block of blocks) shimmer(animator, block);
  for (const part of pulse) {
    animator.animate({
      element: part,
      keyframes: [
        {opacity: skeleton.pulseMinOpacity, easing: motion.pulseEasing},
        {opacity: 1, easing: motion.pulseEasing},
        {opacity: skeleton.pulseMinOpacity},
      ],
      options: {...FOREVER, duration: TIMING.pulseDuration},
    });
  }
}

export function liftSkeleton(root: HTMLElement): HTMLElement {
  const layer = root.ownerDocument.createElement('div');
  layer.className = OUTGOING_CLASS;
  layer.setAttribute('aria-hidden', 'true');
  // A layer still fading from an earlier update is dropped, not nested.
  for (const old of root.querySelectorAll(`:scope > .${OUTGOING_CLASS}`)) {
    old.remove();
  }
  layer.append(...root.childNodes);
  for (const header of layer.querySelectorAll<HTMLElement>(HEADER)) {
    header.style.visibility = 'hidden';
    // The KPI placeholder stays visible inside the hidden header.
    for (const kpi of header.querySelectorAll<HTMLElement>(KPI)) {
      kpi.style.visibility = 'visible';
    }
  }
  return layer;
}

export function fadeOutLayer(
  animator: Animator,
  root: HTMLElement,
  layer: HTMLElement,
): void {
  root.appendChild(layer);
  const started = animator.animate({
    element: layer,
    keyframes: [{opacity: 1}, {opacity: 0}],
    options: {...FADE, fill: 'forwards'},
    onEnd: () => layer.remove(),
  });
  if (!started) layer.remove();
}

export function showsData(root: HTMLElement): boolean {
  return root.querySelector(DIMMED) !== null;
}

/**
 * Marks the chart in `root` as updating: its data dims (a style rule this
 * eases into) and a highlight sweeps across the plot, or across a KPI tile.
 * Both end with the next render, which replaces the root's content. When
 * the chart was already updating before that render (`continued`), the dim
 * applies at once, so a re-render mid-refresh doesn't flash it bright.
 */
export function showUpdating(
  animator: Animator,
  root: HTMLElement,
  continued = false,
): void {
  root.setAttribute('aria-busy', 'true');
  if (root.classList.contains(UPDATING_CLASS)) return;
  root.classList.add(UPDATING_CLASS);
  if (!continued) dimIn(animator, root);
  const surface = root.querySelector(PLOT_AREA) ?? root;
  const sweep = root.ownerDocument.createElement('div');
  sweep.className = SWEEP_CLASS;
  sweep.setAttribute('aria-hidden', 'true');
  surface.appendChild(sweep);
  shimmer(animator, sweep);
}

function dimIn(animator: Animator, root: HTMLElement): void {
  for (const dimmed of root.querySelectorAll(DIMMED)) {
    animator.animate({
      element: dimmed,
      keyframes: [{opacity: 1}, {}],
      options: FADE,
    });
  }
}
