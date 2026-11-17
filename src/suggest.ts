// "Did you mean" suggestions for misspelled field names.

// Names shorter than this get a tighter edit-distance budget, so that short
// names like "x" and "y" are not suggested for unrelated input.
const SHORT_NAME_LENGTH = 4;
const MAX_EDITS_SHORT = 1;
const MAX_EDITS = 2;

/** Levenshtein distance: insertions, deletions and substitutions. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min(previous[j] + 1, current[j - 1] + 1, substitution));
    }
    previous = current;
  }
  return previous[b.length];
}

/** Lowercases and drops separators, so `comparison_value` matches `comparisonValue`. */
function normalize(name: string): string {
  return name.toLowerCase().replace(/[-_\s]/g, '');
}

/**
 * The candidate closest to `input`: an exact match ignoring case and
 * separators, or else the nearest within a small edit distance. Undefined
 * when nothing is close.
 */
export function closestMatch(
  input: string,
  candidates: readonly string[],
): string | undefined {
  const target = normalize(input);
  const exact = candidates.find((candidate) => normalize(candidate) === target);
  if (exact) return exact;

  const budget =
    target.length < SHORT_NAME_LENGTH ? MAX_EDITS_SHORT : MAX_EDITS;
  let best: string | undefined;
  let bestDistance = budget + 1;
  for (const candidate of candidates) {
    const distance = editDistance(target, normalize(candidate));
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
