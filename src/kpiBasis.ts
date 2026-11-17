// What a KPI's value should be for its basis, and how close counts as a
// match. Used by validation to catch a KPI that does not describe its own
// series (a total labelled as the latest value, or stale numbers).

import type {KpiBasis} from './spec';

/** A basis that can be checked against a series. */
export type CheckedBasis = Exclude<KpiBasis, 'custom'>;

/** How each basis reads, for messages: "the sum of series[0]'s values". */
export const BASIS_DESCRIPTIONS: Readonly<Record<CheckedBasis, string>> = {
  total: 'the sum of',
  latest: 'the last of',
  average: 'the mean of',
};

/**
 * KPIs are often rounded or computed from slightly different rows (a total
 * from the API's own aggregate), so values within this share of the
 * expected one match. It still tells a total from a latest value or an
 * average, which differ by far more on any real series.
 */
export const RELATIVE_TOLERANCE = 0.005;

/** The KPI value `basis` implies for `values`, or undefined with no values. */
export function expectedKpiValue(
  values: readonly number[],
  basis: CheckedBasis,
): number | undefined {
  if (values.length === 0) return undefined;
  const total = values.reduce((sum, value) => sum + value, 0);
  if (basis === 'total') return total;
  if (basis === 'latest') return values[values.length - 1];
  return total / values.length;
}

/**
 * Whether `actual` matches `expected` within {@link RELATIVE_TOLERANCE} or
 * one `displayUnit` (the smallest step the format shows, so a KPI rounded
 * to whole cents or one decimal of a percent still matches), whichever is
 * larger.
 */
export function matchesKpi(
  actual: number,
  expected: number,
  displayUnit: number,
): boolean {
  const tolerance = Math.max(
    Math.abs(expected) * RELATIVE_TOLERANCE,
    displayUnit,
  );
  return Math.abs(actual - expected) <= tolerance;
}
