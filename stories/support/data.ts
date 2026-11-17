import type {DataPoint, Series} from '../../src/index';

const MS_PER_DAY = 86_400_000;

export function addDays(date: string, days: number): string {
  const time = Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY;
  return new Date(time).toISOString().slice(0, 10);
}

export function dates(start: string, count: number, step = 1): string[] {
  return Array.from({length: count}, (_, i) => addDays(start, i * step));
}

const MODULUS = 2_147_483_647;
const MULTIPLIER = 48_271;

/** A seeded pseudo-random generator returning values in (0, 1). */
export function seeded(seed: number): () => number {
  let state = Math.abs(Math.floor(seed)) % MODULUS || 1;
  return () => {
    state = (state * MULTIPLIER) % MODULUS;
    return state / MODULUS;
  };
}

export function points(
  xs: readonly string[],
  ys: readonly number[],
): DataPoint[] {
  return xs.map((x, i) => ({x, y: ys[i] ?? null}));
}

/**
 * A smooth curve of `count` values from `from` to `to`. `bend` above 1
 * accelerates towards the end, below 1 decelerates. `jitter` adds seeded
 * noise as a fraction of the range.
 */
export function curve(
  count: number,
  from: number,
  to: number,
  {
    bend = 1,
    jitter = 0,
    seed = 1,
  }: {bend?: number; jitter?: number; seed?: number} = {},
): number[] {
  const random = seeded(seed);
  const range = to - from;
  return Array.from({length: count}, (_, i) => {
    const t = count === 1 ? 1 : i / (count - 1);
    const noise =
      i === 0 || i === count - 1 ? 0 : (random() - 0.5) * jitter * range;
    return Math.round(from + range * t ** bend + noise);
  });
}

export function total(series: Series): number {
  return series.data.reduce((sum, point) => sum + (point.y ?? 0), 0);
}

export function last(series: Series): number {
  for (let i = series.data.length - 1; i >= 0; i -= 1) {
    const y = series.data[i]?.y;
    if (y !== undefined && y !== null) return y;
  }
  return 0;
}
