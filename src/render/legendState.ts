/** Labels of the hidden series. */
export type HiddenSeries = ReadonlySet<string>;

/** What a legend press asked for, and whether it changed anything. */
export type LegendResult = {
  hidden: HiddenSeries;
  /**
   * True when the press would have hidden the last visible series, which
   * the legend refuses so the chart never goes blank.
   */
  refused: boolean;
};

export const NONE_HIDDEN: HiddenSeries = new Set();

export function sameHidden(a: HiddenSeries, b: HiddenSeries): boolean {
  return a.size === b.size && [...a].every((label) => b.has(label));
}

/**
 * The hidden set for a new spec: labels that still exist stay hidden; the
 * rest are dropped. If that would hide every series, none are hidden.
 */
export function carryHidden(
  hidden: HiddenSeries,
  labels: readonly string[],
): HiddenSeries {
  const kept = new Set(labels.filter((label) => hidden.has(label)));
  return kept.size >= labels.length ? NONE_HIDDEN : kept;
}

/** Shows `label` if hidden, hides it if not, unless it is the last one shown. */
export function toggleSeries(
  hidden: HiddenSeries,
  label: string,
  labels: readonly string[],
): LegendResult {
  const next = new Set(hidden);
  if (next.has(label)) {
    next.delete(label);
    return {hidden: next, refused: false};
  }
  next.add(label);
  if (labels.every((each) => next.has(each))) {
    return {hidden, refused: true};
  }
  return {hidden: next, refused: false};
}

/**
 * Shows only `label`; if it already is the only one shown, shows them all
 * again.
 */
export function isolateSeries(
  hidden: HiddenSeries,
  label: string,
  labels: readonly string[],
): LegendResult {
  const others = labels.filter((each) => each !== label);
  const isolated =
    !hidden.has(label) && others.every((each) => hidden.has(each));
  return {
    hidden: isolated ? NONE_HIDDEN : new Set(others),
    refused: false,
  };
}
