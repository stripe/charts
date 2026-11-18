// Splits a series into its solid part and dashed tails (incomplete, forecast).

import type {PointKind} from '../options';

/**
 * One value array per kind, each as long as the series, null outside that
 * kind. A tail also includes the point just before it (the last complete
 * point for the incomplete tail, the last actual or incomplete point for
 * the forecast), so the dashed line starts where the solid one ends.
 */
export type KindSegments = Record<PointKind, (number | null)[]>;

/**
 * The tail's joint: the point before index `index` when it is a different
 * kind that the tail continues from.
 */
function continuesFrom(
  kinds: readonly PointKind[],
  index: number,
  kind: PointKind,
): boolean {
  const before = kinds[index - 1];
  const at = kinds[index];
  if (at !== kind || before === undefined || before === kind) return false;
  // A forecast continues from anything measured; an incomplete tail only
  // from complete data.
  return kind === 'forecast' || before === 'actual';
}

/** Where each point is drawn: an incomplete point at its projection. */
function drawnValues(
  values: readonly (number | null)[],
  kinds: readonly PointKind[],
  projected: readonly (number | null)[],
): (number | null)[] {
  return values.map((value, index) =>
    kinds[index] === 'incomplete' && value !== null
      ? (projected[index] ?? value)
      : value,
  );
}

/**
 * Splits `values` by `kinds` (one per value); see {@link KindSegments}. An
 * incomplete point with a `projected` value is drawn at it: the dotted tail
 * shows where the period is on pace to end, and a forecast after it
 * continues from there.
 */
export function splitByKind(
  values: readonly (number | null)[],
  kinds: readonly PointKind[],
  projected: readonly (number | null)[] = [],
): KindSegments {
  const empty = (): (number | null)[] => values.map(() => null);
  const segments: KindSegments = {
    actual: empty(),
    incomplete: empty(),
    forecast: empty(),
  };
  const drawn = drawnValues(values, kinds, projected);
  drawn.forEach((value, index) => {
    const kind = kinds[index] ?? 'actual';
    segments[kind][index] = value;
    if (kind !== 'actual' && continuesFrom(kinds, index, kind)) {
      segments[kind][index - 1] = drawn[index - 1] ?? null;
    }
  });
  return segments;
}

/**
 * The slots whose actual-so-far value gets a marker: incomplete points
 * drawn at a projected value, so the tail's end isn't read as the value.
 */
export function projectedSlots(
  values: readonly (number | null)[],
  kinds: readonly PointKind[],
  projected: readonly (number | null)[],
): number[] {
  return values.flatMap((value, index) =>
    kinds[index] === 'incomplete' &&
    value !== null &&
    (projected[index] ?? null) !== null
      ? [index]
      : [],
  );
}

/** True when any point is not actual, so the series needs a split. */
export function hasTail(kinds: readonly PointKind[]): boolean {
  return kinds.some((kind) => kind !== 'actual');
}

/** Low and high bounds per slot for the forecast band, null outside it. */
export type Band = {low: (number | null)[]; high: (number | null)[]};

/**
 * The forecast band: each forecast point's low and high bounds, starting at
 * the last measured point (low = high = its value) so the band opens from
 * the line. Points without bounds leave a gap in the band.
 */
export function forecastBand(
  values: readonly (number | null)[],
  kinds: readonly PointKind[],
  lows: readonly (number | null)[],
  highs: readonly (number | null)[],
  projected: readonly (number | null)[] = [],
): Band {
  const drawn = drawnValues(values, kinds, projected);
  const low: (number | null)[] = values.map(() => null);
  const high: (number | null)[] = values.map(() => null);
  kinds.forEach((kind, index) => {
    if (kind !== 'forecast') return;
    low[index] = lows[index] ?? null;
    high[index] = highs[index] ?? null;
    if (continuesFrom(kinds, index, 'forecast') && low[index] !== null) {
      // Joined where the line is: a projected incomplete point's projection.
      const joint = drawn[index - 1] ?? null;
      low[index - 1] = joint;
      high[index - 1] = joint;
    }
  });
  return {low, high};
}
