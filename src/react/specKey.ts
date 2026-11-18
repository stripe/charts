import type {ChartSpec} from '../index';

/**
 * Encodes values that JSON would otherwise conflate: `NaN` and `Infinity`
 * serialize as `null`, which is a valid `y`, so a change between them would
 * look like no change and skip validation. Strings are tagged too, so the
 * string `"NaN"` stays distinct from the number.
 */
function keyReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'string') return `s:${value}`;
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return `n:${String(value)}`;
  }
  return value;
}

/**
 * A serialized comparison key, preserving object key order and distinguishing
 * nonfinite numbers from null and strings. A spec that cannot be serialized
 * (for example a cyclic object passed with a cast) falls back to comparison
 * by identity.
 */
export function specKey(spec: ChartSpec): unknown {
  try {
    return JSON.stringify(spec, keyReplacer);
  } catch {
    return spec;
  }
}
