export type Easing = (progress: number) => number;

const KEYWORDS: Record<string, readonly [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

const BEZIER_PATTERN = /^cubic-bezier\(([^)]*)\)$/;
const NEWTON_STEPS = 8;
const BISECTION_STEPS = 24;
const EPSILON = 1e-6;
const MS_PER_SECOND = 1000;

const linear: Easing = (t) => t;

function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const coordinate = (t: number, a: number, b: number): number =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  const slope = (t: number, a: number, b: number): number =>
    3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t ** 2;
  const solve = (x: number): number => {
    let t = x;
    for (let step = 0; step < NEWTON_STEPS; step += 1) {
      const error = coordinate(t, x1, x2) - x;
      if (Math.abs(error) < EPSILON) return t;
      const d = slope(t, x1, x2);
      if (Math.abs(d) < EPSILON) break;
      t -= error / d;
    }
    let low = 0;
    let high = 1;
    t = x;
    for (let step = 0; step < BISECTION_STEPS; step += 1) {
      if (coordinate(t, x1, x2) < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return t;
  };
  return (progress) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    return coordinate(solve(progress), y1, y2);
  };
}

/**
 * The easing function for a CSS easing string: `linear`, a keyword such as
 * `ease-out`, or `cubic-bezier(x1, y1, x2, y2)`. Anything else is linear,
 * which still ends in the right place.
 */
export function parseEasing(value: string): Easing {
  const text = value.trim();
  const keyword = KEYWORDS[text];
  if (keyword) return cubicBezier(...keyword);
  const match = BEZIER_PATTERN.exec(text);
  const points = match?.[1]?.split(',').map(Number) ?? [];
  const [x1, y1, x2, y2] = points;
  if (
    points.length === 4 &&
    x1 !== undefined &&
    y1 !== undefined &&
    x2 !== undefined &&
    y2 !== undefined &&
    points.every(Number.isFinite)
  ) {
    return cubicBezier(x1, y1, x2, y2);
  }
  return linear;
}

export function parseDuration(value: string): number {
  const text = value.trim();
  const amount = parseFloat(text);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return text.endsWith('ms') ? amount : amount * MS_PER_SECOND;
}
