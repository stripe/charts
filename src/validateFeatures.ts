// Checks that tie a field to the data: annotations and the incomplete
// period name x values of the primary series, and forecast points must sit
// at the end. Series line up by position, so an x value only means a slot
// if the primary series has it.

import type {Checker, JsonObject} from './checker';
import {describe, fieldPath, isJsonObject, quoteList} from './checker';
import {parseIsoDate} from './isoDate';
import {FIELDS, LIMITS} from './spec';

// How many valid x values an error suggests.
const NEAREST_SUGGESTIONS = 3;

/** The primary (first non-comparison) series, as received. */
function primarySeries(spec: JsonObject): JsonObject | undefined {
  if (!Array.isArray(spec.series)) return undefined;
  const series = spec.series.filter(isJsonObject);
  return series.find((s) => s.comparison !== true) ?? series[0];
}

/** The primary series' x values, in order; empty if it has none. */
export function primaryXs(spec: JsonObject): string[] {
  const data = primarySeries(spec)?.data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((point: unknown) =>
    isJsonObject(point) && typeof point.x === 'string' ? [point.x] : [],
  );
}

/** The index of the primary series' first forecast point, if any. */
function firstForecast(spec: JsonObject): number {
  const data = primarySeries(spec)?.data;
  if (!Array.isArray(data)) return -1;
  return data.findIndex(
    (point: unknown) => isJsonObject(point) && point.forecast === true,
  );
}

/** The x values nearest to `value` in time, for a "did you mean" list. */
function nearest(value: string, xs: readonly string[]): string[] {
  const target = parseIsoDate(value)?.time;
  if (target === undefined) return xs.slice(0, NEAREST_SUGGESTIONS);
  return xs
    .map((x) => ({
      x,
      distance: Math.abs((parseIsoDate(x)?.time ?? 0) - target),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, NEAREST_SUGGESTIONS)
    .map(({x}) => x);
}

/**
 * Checks that `value` is one of the primary series' x values, and returns
 * its slot index (or -1).
 */
function checkSlot(
  c: Checker,
  path: string,
  value: unknown,
  xs: readonly string[],
): number {
  if (typeof value !== 'string' || value === '') {
    c.reportExpected(path, 'an x value of the primary series', value);
    return -1;
  }
  const index = xs.indexOf(value);
  if (index >= 0 || xs.length === 0) return index;
  c.report(
    path,
    `expected an x value of the primary series, written exactly as there (series line up by position), got ${describe(
      value,
    )}; nearest are ${quoteList(nearest(value, xs))}`,
  );
  return -1;
}

/** Checks one annotation against the primary series and the series labels. */
function checkAnnotation(
  c: Checker,
  path: string,
  annotation: unknown,
  xs: readonly string[],
  labels: readonly string[],
): void {
  if (!c.object(path, annotation)) return;
  c.unknownFields(path, annotation, FIELDS.annotation);
  c.string(fieldPath(path, 'label'), annotation.label, {
    required: true,
    maxLength: LIMITS.maxAnnotationLabelLength,
  });
  c.string(fieldPath(path, 'description'), annotation.description, {
    required: false,
    maxLength: LIMITS.maxNoteLength,
  });
  const {at, from, to, series} = annotation;
  const ranged = from !== undefined || to !== undefined;
  if (at === undefined && !ranged) {
    c.report(
      path,
      'expected "at" for a marker, or "from" and/or "to" for a shaded range',
    );
    return;
  }
  if (at !== undefined && ranged) {
    c.report(
      path,
      'expected either "at" (a marker) or "from"/"to" (a range), not both',
    );
    return;
  }
  if (at !== undefined) {
    checkSlot(c, fieldPath(path, 'at'), at, xs);
  } else {
    const start =
      from === undefined ? 0 : checkSlot(c, fieldPath(path, 'from'), from, xs);
    const end =
      to === undefined
        ? xs.length - 1
        : checkSlot(c, fieldPath(path, 'to'), to, xs);
    if (start >= 0 && end >= 0 && start > end) {
      c.report(
        fieldPath(path, 'to'),
        `expected an x value at or after "from" (${describe(
          from,
        )}), got ${describe(to)}`,
      );
    }
  }
  if (series !== undefined) {
    const seriesPath = fieldPath(path, 'series');
    if (at === undefined) {
      c.report(seriesPath, 'only allowed with "at", to mark one point');
    } else if (typeof series !== 'string' || !labels.includes(series)) {
      c.reportExpected(
        seriesPath,
        `the label of one of the series: ${quoteList(labels)}`,
        series,
      );
    }
  }
}

/** Checks `annotations` against the data. */
export function checkAnnotations(c: Checker, spec: JsonObject): void {
  const {annotations} = spec;
  if (annotations === undefined) return;
  if (
    !c.array('annotations', annotations, {min: 0, max: LIMITS.maxAnnotations})
  ) {
    return;
  }
  const xs = primaryXs(spec);
  const labels = Array.isArray(spec.series)
    ? spec.series.flatMap((s: unknown) =>
        isJsonObject(s) && typeof s.label === 'string' ? [s.label] : [],
      )
    : [];
  annotations.forEach((annotation, i) =>
    checkAnnotation(c, `annotations[${i}]`, annotation, xs, labels),
  );
}

/** Why `point` can't carry `projected`, or undefined if it can. */
function projectedProblem(
  point: JsonObject,
  comparison: boolean,
  slot: number,
  incompleteFrom: number,
  from: unknown,
  bars: boolean,
): string | undefined {
  if (incompleteFrom < 0) {
    return 'only for points inside chart.incomplete; set chart.incomplete.from to the first unfinished x';
  }
  if (slot < incompleteFrom) {
    return `only for points inside chart.incomplete (from ${describe(
      from,
    )}); this point is final, so leave out "projected"`;
  }
  if (comparison) {
    return 'only for the series being measured; a comparison series is final data';
  }
  if (point.forecast === true) {
    return 'not for forecast points; use "low"/"high" for a forecast range';
  }
  if (typeof point.y !== 'number') {
    return 'needs y, the value so far; set y, or leave out "projected"';
  }
  const {y, projected} = point;
  if (
    typeof projected === 'number' &&
    y !== 0 &&
    projected !== 0 &&
    Math.sign(y) !== Math.sign(projected)
  ) {
    return `expected the same sign as y (${y}), since the projection extends the value so far`;
  }
  // A bar's projection is drawn as an outline beyond the value so far.
  if (
    bars &&
    typeof projected === 'number' &&
    Math.abs(projected) < Math.abs(y)
  ) {
    return `expected at least y (${y}) on a bar chart, since the projection extends the bar beyond the value so far; use a line chart for a value on pace to end lower`;
  }
  return undefined;
}

/**
 * Checks `projected` points: they extend incomplete, actual values of a
 * non-comparison series.
 */
export function checkProjected(c: Checker, spec: JsonObject): void {
  if (!Array.isArray(spec.series)) return;
  const {chart} = spec;
  const incomplete =
    isJsonObject(chart) && isJsonObject(chart.incomplete)
      ? chart.incomplete
      : undefined;
  const bars = isJsonObject(chart) && chart.type === 'bar';
  const incompleteFrom =
    typeof incomplete?.from === 'string'
      ? primaryXs(spec).indexOf(incomplete.from)
      : -1;
  spec.series.forEach((series: unknown, i) => {
    if (!isJsonObject(series) || !Array.isArray(series.data)) return;
    series.data.forEach((point: unknown, j) => {
      if (!isJsonObject(point) || typeof point.projected !== 'number') return;
      const problem = projectedProblem(
        point,
        series.comparison === true,
        j,
        incompleteFrom,
        incomplete?.from,
        bars,
      );
      if (problem) c.report(`series[${i}].data[${j}].projected`, problem);
    });
  });
}

/**
 * Checks that `chart.axes.x.labels: "time"` has times to show: date-only x
 * values have no time of day.
 */
export function checkTimeLabels(c: Checker, spec: JsonObject): void {
  const {chart} = spec;
  const axes = isJsonObject(chart) ? chart.axes : undefined;
  const x = isJsonObject(axes) ? axes.x : undefined;
  if (!isJsonObject(x) || x.labels !== 'time') return;
  const first = primaryXs(spec)[0];
  if (first === undefined || parseIsoDate(first)?.kind !== 'date') return;
  c.report(
    'chart.axes.x.labels',
    `"time" needs date-time x values, and the series has dates like ${describe(
      first,
    )}; use "day" or "auto"`,
  );
}

/**
 * Checks that `chart.incomplete.from` is a primary x value before any
 * forecast: the period is real data that is not final yet, and ends where
 * the forecast begins.
 */
export function checkIncompleteSlot(c: Checker, spec: JsonObject): void {
  const {chart} = spec;
  if (!isJsonObject(chart) || !isJsonObject(chart.incomplete)) return;
  const path = 'chart.incomplete.from';
  const index = checkSlot(c, path, chart.incomplete.from, primaryXs(spec));
  const forecast = firstForecast(spec);
  if (index >= 0 && forecast >= 0 && index >= forecast) {
    c.report(
      path,
      `expected an x value before the forecast, which starts at ${describe(
        primaryXs(spec)[forecast],
      )}; the incomplete period is actual data and ends where the forecast begins`,
    );
  }
}
