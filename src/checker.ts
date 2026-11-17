// Generic field checks that collect issues instead of throwing, so a single
// validation pass can report every problem at once.

import {closestMatch} from './suggest';
import {LIMITS} from './spec';
import type {SpecIssue} from './spec';

/** A JSON object as received, before validation. */
export type JsonObject = Record<string, unknown>;

// Long received values are cut so one bad field cannot flood the message.
const MAX_RECEIVED_LENGTH = 40;

/** Describes a received value for an error message, e.g. `the number 5`. */
export function describe(value: unknown): string {
  if (value === undefined) return 'nothing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(
        value.length > MAX_RECEIVED_LENGTH
          ? `${value.slice(0, MAX_RECEIVED_LENGTH)}...`
          : value,
      );
    case 'number':
    case 'boolean':
      return `the ${typeof value} ${String(value)}`;
    case 'object':
      return 'an object';
    default:
      return `a ${typeof value}`;
  }
}

/** Quotes and comma-separates names for a message. */
export function quoteList(values: readonly string[]): string {
  return values.map((value) => JSON.stringify(value)).join(', ');
}

/** Appends a field name to a path; the root path is `""`. */
export function fieldPath(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Options for {@link Checker.unknownFields}. */
export type UnknownFieldOptions = {
  /** Likely wrong names mapped to the field the caller probably meant. */
  aliases?: Readonly<Record<string, string>>;
  /** A specific explanation for a key, overriding the suggestion. */
  explain?: (key: string) => string | undefined;
};

/**
 * Collects {@link SpecIssue}s. Each check reports at most one issue for its
 * field and returns whether the value passed, so callers only descend into
 * values of the right shape.
 */
export class Checker {
  readonly issues: SpecIssue[] = [];

  report(path: string, message: string): void {
    this.issues.push({path, message});
  }

  /** Reports a wrong value, or a missing one when it is undefined. */
  reportExpected(path: string, expected: string, received: unknown): void {
    this.report(
      path,
      received === undefined
        ? `required; expected ${expected}`
        : `expected ${expected}, got ${describe(received)}`,
    );
  }

  object(path: string, value: unknown): value is JsonObject {
    if (isJsonObject(value)) return true;
    this.reportExpected(path, 'an object', value);
    return false;
  }

  /** Reports each key of `object` not in `allowed`, with a hint when possible. */
  unknownFields(
    path: string,
    object: JsonObject,
    allowed: readonly string[],
    {aliases, explain}: UnknownFieldOptions = {},
  ): void {
    for (const key of Object.keys(object).filter((k) => !allowed.includes(k))) {
      const explanation = explain?.(key);
      const suggestion = aliases?.[key] ?? closestMatch(key, allowed);
      let hint = `allowed fields are ${quoteList(allowed)}`;
      if (explanation) hint = explanation;
      else if (suggestion) hint = `did you mean "${suggestion}"?`;
      this.report(
        fieldPath(path, key),
        `unexpected field ${JSON.stringify(key)}; ${hint}`,
      );
    }
  }

  /** A string with at most `maxLength` characters; `required` also rejects blank strings. */
  string(
    path: string,
    value: unknown,
    {required, maxLength}: {required: boolean; maxLength: number},
  ): value is string {
    if (value === undefined && !required) return false;
    if (typeof value !== 'string' || (required && value.trim() === '')) {
      this.reportExpected(
        path,
        required ? 'a non-empty string' : 'a string',
        value,
      );
      return false;
    }
    if (value.length > maxLength) {
      this.report(
        path,
        `expected at most ${maxLength} characters, got ${value.length}`,
      );
      return false;
    }
    return true;
  }

  /** A finite number: NaN, Infinity and numeric strings are rejected. */
  finiteNumber(
    path: string,
    value: unknown,
    required: boolean,
  ): value is number {
    if (value === undefined && !required) return false;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return this.withinMagnitude(path, value);
    }
    this.reportExpected(path, 'a finite number', value);
    return false;
  }

  /** Reports a value too large to chart; see `LIMITS.maxAbsValue`. */
  withinMagnitude(path: string, value: number): boolean {
    if (Math.abs(value) <= LIMITS.maxAbsValue) return true;
    // "1e15" reads better than fifteen zeros.
    const max = LIMITS.maxAbsValue.toExponential().replace('e+', 'e');
    this.report(
      path,
      `expected a number from -${max} to ${max}, got ${describe(
        value,
      )}; larger values lose precision, so give them in a larger unit (thousands or millions) and say so in the title`,
    );
    return false;
  }

  integer(
    path: string,
    value: unknown,
    {min, max}: {min: number; max: number},
  ): value is number {
    if (
      Number.isInteger(value) &&
      Number(value) >= min &&
      Number(value) <= max
    ) {
      return true;
    }
    this.reportExpected(path, `an integer from ${min} to ${max}`, value);
    return false;
  }

  oneOf<T extends string>(
    path: string,
    value: unknown,
    options: readonly T[],
  ): value is T {
    if (options.some((option) => option === value)) return true;
    this.reportExpected(path, `one of ${quoteList(options)}`, value);
    return false;
  }

  /**
   * One of `options`. A missing value reports `missing` when given (a
   * message that explains how to choose), and a wrong one suggests the
   * option it most likely meant, from `aliases` ("cents" for "minor") or
   * spelling.
   */
  choice<T extends string>(
    path: string,
    value: unknown,
    options: readonly T[],
    {
      missing,
      aliases,
    }: {missing?: string; aliases?: Readonly<Record<string, T>>} = {},
  ): value is T {
    if (options.some((option) => option === value)) return true;
    if (value === undefined && missing !== undefined) {
      this.report(path, missing);
      return false;
    }
    const suggestion =
      typeof value === 'string'
        ? aliases?.[value.toLowerCase()] ?? closestMatch(value, options)
        : undefined;
    const expected = `one of ${quoteList(options)}`;
    const base =
      value === undefined
        ? `required; expected ${expected}`
        : `expected ${expected}, got ${describe(value)}`;
    const hint = suggestion ? `; did you mean "${suggestion}"?` : '';
    this.report(path, base + hint);
    return false;
  }

  /** An array with `min` to `max` items. */
  array(
    path: string,
    value: unknown,
    {min, max}: {min: number; max: number},
  ): value is unknown[] {
    if (!Array.isArray(value)) {
      this.reportExpected(path, 'an array', value);
      return false;
    }
    if (value.length < min || value.length > max) {
      const range = min === 0 ? `at most ${max}` : `${min} to ${max}`;
      this.report(path, `expected ${range} items, got ${value.length}`);
      return false;
    }
    return true;
  }

  /**
   * Runs an Intl constructor that throws RangeError for values the runtime
   * does not support, and reports that error on `path`.
   */
  intlSupports(
    path: string,
    value: string,
    kind: string,
    construct: () => unknown,
  ): boolean {
    try {
      construct();
      return true;
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      this.report(
        path,
        `${describe(value)} is not ${kind} this browser supports`,
      );
      return false;
    }
  }
}
