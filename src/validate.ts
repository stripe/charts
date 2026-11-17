// Spec validation. Returns every issue found, each with the field path and a
// message saying what was expected and what was received. The caller is
// often a language model, so messages are written to be acted on directly.
// Keep in sync with `spec.ts` and `schema.json`.

import {Checker, describe, fieldPath, isJsonObject} from './checker';
import type {JsonObject} from './checker';
import {MIN_YEAR, parseIsoDate} from './isoDate';
import {
  checkAnnotations,
  checkIncompleteSlot,
  checkProjected,
  checkTimeLabels,
} from './validateFeatures';
import type {ParsedDate} from './isoDate';
import {minorUnitExponent} from './currency';
import {DEFAULTS} from './defaults';
import {BASIS_DESCRIPTIONS, expectedKpiValue, matchesKpi} from './kpiBasis';
import type {CheckedBasis} from './kpiBasis';
import {
  BAR_STACKINGS,
  CHART_TYPES,
  CURRENCY_UNITS,
  FIELDS,
  FORMAT_STYLES,
  GOOD_DIRECTIONS,
  KPI_BASES,
  KPI_NOTATIONS,
  LEGEND_MODES,
  X_AXIS_LABELS,
  Y_AXIS_NOTATIONS,
  LIMITS,
  PERCENT_UNITS,
} from './spec';
import type {
  ChartSpec,
  CurrencyUnit,
  GoodDirection,
  KpiBasis,
  KpiNotation,
  PercentUnit,
  SpecIssue,
  ValidationResult,
} from './spec';

// Names a caller might plausibly use instead of the real field, per level.
const ALIASES = {
  spec: {
    name: 'title',
    subtitle: 'description',
    type: 'chart.type',
    data: 'series[].data',
    currency: 'format.currency',
    tz: 'timeZone',
    value: 'kpi.value',
    showDetails: 'details',
    detailsButton: 'details',
    info: 'details',
    infoButton: 'details',
    showInfo: 'details',
  },
  kpi: {previous: 'comparisonValue', previousValue: 'comparisonValue'},
  series: {name: 'label', points: 'data', values: 'data'},
  point: {date: 'x', day: 'x', time: 'x', value: 'y'},
  provenance: {fetched: 'fetchedAt', timestamp: 'fetchedAt'},
  detail: {name: 'label', key: 'label'},
};

const CURRENCY_CODE_PATTERN = /^[A-Za-z]{3}$/;
// Hex only: the color reaches a CSS custom property, so nothing else may
// pass (no names, functions or anything that could carry other CSS).
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const HEX_COLOR = 'a hex color like "#635bff" or "#fff"';

// Values a caller might write for an enum, mapped to the one they meant.
const CURRENCY_UNIT_ALIASES: Readonly<Record<string, CurrencyUnit>> = {
  cents: 'minor',
  cent: 'minor',
  smallest: 'minor',
  minor_units: 'minor',
  dollars: 'major',
  units: 'major',
  whole: 'major',
  decimal: 'major',
  major_units: 'major',
};
const PERCENT_UNIT_ALIASES: Readonly<Record<string, PercentUnit>> = {
  fraction: 'ratio',
  decimal: 'ratio',
  proportion: 'ratio',
  percentage: 'percent',
  pct: 'percent',
  '%': 'percent',
  points: 'percent',
};
const BASIS_ALIASES: Readonly<Record<string, KpiBasis>> = {
  sum: 'total',
  last: 'latest',
  current: 'latest',
  end: 'latest',
  mean: 'average',
  avg: 'average',
  other: 'custom',
  manual: 'custom',
};
const NOTATION_ALIASES: Readonly<Record<string, KpiNotation>> = {
  short: 'compact',
  abbreviated: 'compact',
  abbreviate: 'compact',
  abbrev: 'compact',
  full: 'standard',
  long: 'standard',
  normal: 'standard',
};
const DIRECTION_ALIASES: Readonly<Record<string, GoodDirection>> = {
  higher: 'up',
  increase: 'up',
  positive: 'up',
  lower: 'down',
  decrease: 'down',
  negative: 'down',
};

const MISSING = {
  currencyUnit:
    'required for currency; Stripe API amounts are in minor units (1999 = $19.99), so use "minor" for those, or "major" if the values are already converted',
  percentUnit:
    'required for percent; use "ratio" if 0.025 means 2.5%, or "percent" if 2.5 means 2.5%',
  basis:
    'required; expected how kpi.value relates to the primary series: "total" (its sum), "latest" (its last value), "average" (its mean), or "custom" for a figure computed elsewhere',
};
const YEAR_PREFIX_PATTERN = /^(\d{4})-\d{2}-\d{2}/;

const EXPECTED = {
  date: 'an ISO date like "2026-11-27" or a date-time like "2026-11-27T18:00:00Z"',
  dateTime: 'an ISO 8601 date-time like "2026-11-27T18:00:00Z"',
  currency: 'a 3-letter ISO 4217 code like "usd"',
  locale: 'a BCP 47 language tag like "en-US"',
  timeZone: 'an IANA time zone like "America/New_York"',
};

function checkFormat(c: Checker, format: unknown): void {
  const path = 'format';
  // Without a valid style there is no way to tell which other fields belong.
  if (!c.object(path, format)) return;
  if (!c.oneOf(fieldPath(path, 'style'), format.style, FORMAT_STYLES)) return;

  const {style} = format;
  c.unknownFields(path, format, FIELDS.format[style], {
    explain: (key) => {
      if (key === 'currency') {
        return 'only allowed when format.style is "currency"';
      }
      if (key === 'maximumFractionDigits' && style === 'currency') {
        return 'not allowed for currencies; the currency decides the decimals';
      }
      if (key === 'unit') {
        return 'only for currency ("minor" or "major") and percent ("ratio" or "percent") formats';
      }
      return undefined;
    },
  });

  const unitPath = fieldPath(path, 'unit');
  if (style === 'percent') {
    c.choice(unitPath, format.unit, PERCENT_UNITS, {
      missing: MISSING.percentUnit,
      aliases: PERCENT_UNIT_ALIASES,
    });
  }
  if (style === 'currency') {
    c.choice(unitPath, format.unit, CURRENCY_UNITS, {
      missing: MISSING.currencyUnit,
      aliases: CURRENCY_UNIT_ALIASES,
    });
  }

  if (style !== 'currency') {
    if (format.maximumFractionDigits !== undefined) {
      c.integer(
        fieldPath(path, 'maximumFractionDigits'),
        format.maximumFractionDigits,
        {min: 0, max: LIMITS.maxFractionDigits},
      );
    }
    return;
  }

  const currencyPath = fieldPath(path, 'currency');
  const {currency} = format;
  if (currency === undefined) {
    c.report(
      currencyPath,
      `required when format.style is "currency"; expected an ISO 4217 code like "usd"`,
    );
  } else if (
    typeof currency !== 'string' ||
    !CURRENCY_CODE_PATTERN.test(currency)
  ) {
    c.reportExpected(currencyPath, EXPECTED.currency, currency);
  } else {
    c.intlSupports(
      currencyPath,
      currency,
      'a currency code',
      () => new Intl.NumberFormat(undefined, {style: 'currency', currency}),
    );
  }
}

function checkLocale(c: Checker, locale: unknown): void {
  if (typeof locale !== 'string' || locale === '') {
    c.reportExpected('locale', EXPECTED.locale, locale);
    return;
  }
  c.intlSupports('locale', locale, 'a BCP 47 language tag', () =>
    Intl.getCanonicalLocales(locale),
  );
}

function checkTimeZone(c: Checker, timeZone: unknown): void {
  if (typeof timeZone !== 'string' || timeZone === '') {
    c.reportExpected('timeZone', EXPECTED.timeZone, timeZone);
    return;
  }
  c.intlSupports(
    'timeZone',
    timeZone,
    'an IANA time zone',
    () => new Intl.DateTimeFormat(undefined, {timeZone}),
  );
}

function checkKpi(c: Checker, kpi: unknown): void {
  if (!c.object('kpi', kpi)) return;
  c.unknownFields('kpi', kpi, FIELDS.kpi, {aliases: ALIASES.kpi});
  c.finiteNumber('kpi.value', kpi.value, true);
  c.choice('kpi.basis', kpi.basis, KPI_BASES, {
    missing: MISSING.basis,
    aliases: BASIS_ALIASES,
  });
  c.finiteNumber('kpi.comparisonValue', kpi.comparisonValue, false);
  if (kpi.goodDirection !== undefined) {
    c.choice('kpi.goodDirection', kpi.goodDirection, GOOD_DIRECTIONS, {
      aliases: DIRECTION_ALIASES,
    });
  }
  if (kpi.notation !== undefined) {
    c.choice('kpi.notation', kpi.notation, KPI_NOTATIONS, {
      aliases: NOTATION_ALIASES,
    });
  }
}

/**
 * The smallest step `format` shows, in the spec's own units: a cent for USD
 * in major units, 1 in minor units, 0.001 for a ratio shown to one decimal.
 */
function displayUnit(format: unknown): number {
  const f = isJsonObject(format) ? format : {};
  const digits = (fallback: number) =>
    typeof f.maximumFractionDigits === 'number'
      ? f.maximumFractionDigits
      : fallback;
  if (f.style === 'currency') {
    if (f.unit === 'minor') return 1;
    const code = typeof f.currency === 'string' ? f.currency : '';
    return 10 ** -minorUnitExponent(code);
  }
  if (f.style === 'percent') {
    const shown = digits(DEFAULTS.percentFractionDigits);
    return f.unit === 'percent' ? 10 ** -shown : 10 ** -(shown + 2);
  }
  return 10 ** -digits(DEFAULTS.numberFractionDigits);
}

// Expected values in messages are rounded to this many significant digits.
const MESSAGE_DIGITS = 10;

/** A series' y at `slot` if it is an actual (not forecast) finite value. */
function actualAt(series: unknown, slot: number): number | undefined {
  const data = isJsonObject(series) ? series.data : undefined;
  const point: unknown = Array.isArray(data) ? data[slot] : undefined;
  return isJsonObject(point) &&
    point.forecast !== true &&
    typeof point.y === 'number' &&
    Number.isFinite(point.y)
    ? point.y
    : undefined;
}

/** The slots where `series` has actual values (forecasts and gaps left out). */
function actualSlots(series: unknown): number[] {
  const data = isJsonObject(series) ? series.data : undefined;
  if (!Array.isArray(data)) return [];
  return data.flatMap((_, slot) =>
    actualAt(series, slot) === undefined ? [] : [slot],
  );
}

/**
 * Checks that the KPI matches its series for basis total, latest or
 * average. `kpi.value` is checked against the primary (first
 * non-comparison) series' actual values; `kpi.comparisonValue` against the
 * first comparison series over the same slots, so like periods are
 * compared: for "latest", its value at the slot of the primary's latest
 * actual value, even when the comparison (a plan) runs on past it.
 */
function checkKpiBasis(c: Checker, spec: JsonObject): void {
  const {kpi, series} = spec;
  if (!isJsonObject(kpi) || !Array.isArray(series)) return;
  const {basis} = kpi;
  if (typeof basis !== 'string' || !(basis in BASIS_DESCRIPTIONS)) return;
  const checked = basis as CheckedBasis;
  const unit = displayUnit(spec.format);
  const isComparison = (s: unknown) => isJsonObject(s) && s.comparison === true;
  const primary = series.findIndex((s) => !isComparison(s));
  const comparison = series.findIndex(isComparison);
  if (primary < 0) return;
  const slots = actualSlots(series[primary]);
  const latest = slots[slots.length - 1];
  const comparedSlots =
    checked === 'latest' && latest !== undefined ? [latest] : slots;
  const describeSlots =
    checked === 'latest'
      ? `series[${comparison}]'s value at slot ${latest}, where series[${primary}]'s latest actual value is`
      : `${BASIS_DESCRIPTIONS[checked]} series[${comparison}]'s values at the slots of series[${primary}]'s actual values`;
  const targets = [
    {
      field: 'value',
      values: slots.flatMap((slot) => actualAt(series[primary], slot) ?? []),
      what: `${BASIS_DESCRIPTIONS[checked]} series[${primary}]'s actual values`,
    },
    {
      field: 'comparisonValue',
      values:
        comparison < 0
          ? []
          : comparedSlots.flatMap(
              (slot) => actualAt(series[comparison], slot) ?? [],
            ),
      what: describeSlots,
    },
  ];
  for (const {field, values, what} of targets) {
    const actual = kpi[field];
    const expected = expectedKpiValue(values, checked);
    if (
      typeof actual === 'number' &&
      expected !== undefined &&
      !matchesKpi(actual, expected, unit)
    ) {
      c.report(
        `kpi.${field}`,
        `expected about ${Number(
          expected.toPrecision(MESSAGE_DIGITS),
        )} for basis "${checked}" (${what}), got ${describe(
          actual,
        )}; fix the value, pick the basis that matches it, or use "custom" for a figure computed differently`,
      );
    }
  }
}

/** The path of the first date-time in the spec, if any. */
function firstDateTime(spec: JsonObject): string | undefined {
  const {series, provenance} = spec;
  if (Array.isArray(series)) {
    for (const [i, s] of series.entries()) {
      const data = isJsonObject(s) && Array.isArray(s.data) ? s.data : [];
      const j = data.findIndex(
        (point: unknown) =>
          isJsonObject(point) &&
          typeof point.x === 'string' &&
          parseIsoDate(point.x)?.kind === 'dateTime',
      );
      if (j >= 0) return `series[${i}].data[${j}].x`;
    }
  }
  if (isJsonObject(provenance) && provenance.fetchedAt !== undefined) {
    return 'provenance.fetchedAt';
  }
  return undefined;
}

/** What later checks need to know about `chart`, when it is valid. */
type ChartFacts = {type: string | undefined; stacked: boolean};

function checkColor(c: Checker, path: string, value: unknown): void {
  if (value === undefined) return;
  if (typeof value === 'string' && HEX_COLOR_PATTERN.test(value)) return;
  c.reportExpected(path, HEX_COLOR, value);
}

function checkBoolean(c: Checker, path: string, value: unknown): void {
  if (value !== undefined && typeof value !== 'boolean') {
    c.reportExpected(path, 'true or false', value);
  }
}

function checkAxes(c: Checker, axes: unknown): void {
  const path = 'chart.axes';
  if (!c.object(path, axes)) return;
  c.unknownFields(path, axes, FIELDS.axes);
  if (axes.x !== undefined && c.object(`${path}.x`, axes.x)) {
    c.unknownFields(`${path}.x`, axes.x, FIELDS.xAxis);
    if (axes.x.labels !== undefined) {
      c.choice(`${path}.x.labels`, axes.x.labels, X_AXIS_LABELS, {
        aliases: {
          days: 'day',
          months: 'month',
          years: 'year',
          hour: 'time',
          hours: 'time',
        },
      });
    }
  }
  if (axes.y !== undefined && c.object(`${path}.y`, axes.y)) {
    c.unknownFields(`${path}.y`, axes.y, FIELDS.yAxis);
    if (axes.y.notation !== undefined) {
      c.choice(`${path}.y.notation`, axes.y.notation, Y_AXIS_NOTATIONS, {
        aliases: NOTATION_ALIASES,
      });
    }
    if (axes.y.maximumFractionDigits !== undefined) {
      c.integer(
        `${path}.y.maximumFractionDigits`,
        axes.y.maximumFractionDigits,
        {min: 0, max: LIMITS.maxFractionDigits},
      );
    }
  }
}

function checkIncomplete(c: Checker, incomplete: unknown): void {
  const path = 'chart.incomplete';
  if (!c.object(path, incomplete)) return;
  c.unknownFields(path, incomplete, FIELDS.incomplete);
  // The slot itself is checked against the series in checkIncompleteSlot.
  c.string(`${path}.message`, incomplete.message, {
    required: false,
    maxLength: LIMITS.maxNoteLength,
  });
}

function checkChart(c: Checker, chart: unknown): ChartFacts {
  if (!c.object('chart', chart)) return {type: undefined, stacked: false};
  c.unknownFields('chart', chart, FIELDS.chart);
  const type = c.oneOf('chart.type', chart.type, CHART_TYPES)
    ? chart.type
    : undefined;
  if (chart.legend !== undefined) {
    c.choice('chart.legend', chart.legend, LEGEND_MODES, {
      aliases: {on: 'show', visible: 'show', off: 'hide', none: 'hide'},
    });
  }
  if (chart.axes !== undefined) checkAxes(c, chart.axes);
  if (chart.incomplete !== undefined) checkIncomplete(c, chart.incomplete);
  if (chart.stacking === undefined) return {type, stacked: false};
  if (!c.oneOf('chart.stacking', chart.stacking, BAR_STACKINGS)) {
    return {type, stacked: false};
  }
  if (type !== undefined && type !== 'bar') {
    c.report(
      'chart.stacking',
      `only allowed when chart.type is "bar"; got chart.type ${JSON.stringify(
        type,
      )}`,
    );
    return {type, stacked: false};
  }
  return {type, stacked: chart.stacking === 'stacked'};
}

/** Reports a date whose only fault is a year before {@link MIN_YEAR}. */
function reportEarlyYear(c: Checker, path: string, value: unknown): boolean {
  const year =
    typeof value === 'string'
      ? YEAR_PREFIX_PATTERN.exec(value)?.[1]
      : undefined;
  if (year === undefined || Number(year) >= MIN_YEAR) return false;
  c.report(
    path,
    `expected a year from ${MIN_YEAR} on, got ${describe(
      value,
    )}; write the full year, like "2026-11-27"`,
  );
  return true;
}

function checkDate(c: Checker, path: string, value: unknown): void {
  if (typeof value === 'string' && parseIsoDate(value)) return;
  if (!reportEarlyYear(c, path, value)) {
    c.reportExpected(path, EXPECTED.date, value);
  }
}

function checkDateTime(c: Checker, path: string, value: unknown): void {
  if (typeof value === 'string' && parseIsoDate(value)?.kind === 'dateTime') {
    return;
  }
  if (!reportEarlyYear(c, path, value)) {
    c.reportExpected(path, EXPECTED.dateTime, value);
  }
}

const DATE_FORMS: Record<ParsedDate['kind'], string> = {
  date: 'a date like "2026-11-27"',
  dateTime: 'a date-time like "2026-11-27T18:00:00Z"',
};

/**
 * Reports x values whose form (date or date-time) differs from the chart's
 * first one, once per series: the axis is either calendar days or instants,
 * and a mix would shift some days by the time zone.
 */
function checkDateForms(c: Checker, seriesList: readonly unknown[]): void {
  let first: {kind: ParsedDate['kind']; path: string} | undefined;
  seriesList.forEach((series, i) => {
    if (typeof series !== 'object' || series === null) return;
    const {data} = series as {data?: unknown};
    if (!Array.isArray(data)) return;
    const mismatch = data.findIndex((point: unknown, j) => {
      const x = (point as {x?: unknown} | null)?.x;
      const kind = typeof x === 'string' ? parseIsoDate(x)?.kind : undefined;
      if (kind === undefined) return false;
      first ??= {kind, path: `series[${i}].data[${j}].x`};
      return kind !== first.kind;
    });
    if (mismatch < 0 || !first) return;
    const path = `series[${i}].data[${mismatch}].x`;
    c.report(
      path,
      `expected ${DATE_FORMS[first.kind]}, as ${
        first.path
      } is; dates and date-times can't be mixed in one chart, got ${describe(
        (data[mismatch] as {x: unknown}).x,
      )}`,
    );
  });
}

function checkPoint(
  c: Checker,
  path: string,
  point: unknown,
  isBar: boolean,
): void {
  if (!c.object(path, point)) return;
  c.unknownFields(path, point, FIELDS.point, {aliases: ALIASES.point});
  checkDate(c, fieldPath(path, 'x'), point.x);
  const yPath = fieldPath(path, 'y');
  if (point.y === undefined) {
    c.report(yPath, 'required; expected a finite number, or null for a gap');
  } else if (point.y !== null) {
    if (typeof point.y !== 'number' || !Number.isFinite(point.y)) {
      c.reportExpected(yPath, 'a finite number or null', point.y);
    } else {
      c.withinMagnitude(yPath, point.y);
    }
  }
  if (point.color !== undefined && !isBar) {
    c.report(
      fieldPath(path, 'color'),
      'only for bar charts, where it colors one bar; set series[].color for a line',
    );
  } else {
    checkColor(c, fieldPath(path, 'color'), point.color);
  }
  checkBoolean(c, fieldPath(path, 'forecast'), point.forecast);
  checkForecastRange(c, path, point);
  c.finiteNumber(fieldPath(path, 'projected'), point.projected, false);
}

/** Checks `low`/`high`: forecast points only, and `low` ≤ `y` ≤ `high`. */
function checkForecastRange(c: Checker, path: string, point: JsonObject): void {
  const bounds = (['low', 'high'] as const).filter(
    (key) => point[key] !== undefined,
  );
  for (const key of bounds) {
    const boundPath = fieldPath(path, key);
    if (point.forecast !== true) {
      c.report(
        boundPath,
        `only for forecast points; add "forecast": true or remove "${key}"`,
      );
    } else {
      c.finiteNumber(boundPath, point[key], true);
    }
  }
  const {y, low, high} = point;
  const numbers = [low, y, high].filter((v) => typeof v === 'number');
  if (point.forecast !== true || numbers.length < 2) return;
  if (typeof low === 'number' && typeof y === 'number' && low > y) {
    c.report(
      fieldPath(path, 'low'),
      `expected at most y (${y}), got ${describe(low)}`,
    );
  }
  if (typeof high === 'number' && typeof y === 'number' && high < y) {
    c.report(
      fieldPath(path, 'high'),
      `expected at least y (${y}), got ${describe(high)}`,
    );
  }
  if (typeof low === 'number' && typeof high === 'number' && low > high) {
    c.report(
      fieldPath(path, 'low'),
      `expected at most high (${high}), got ${describe(low)}`,
    );
  }
}

/**
 * Checks that forecast points are one run at the end of the series: after
 * the first forecast, every point is a forecast.
 */
function checkForecastRun(c: Checker, dataPath: string, data: unknown[]): void {
  const first = data.findIndex((p) => isJsonObject(p) && p.forecast === true);
  if (first < 0) return;
  const actual = data.findIndex(
    (p, i) => i > first && !(isJsonObject(p) && p.forecast === true),
  );
  if (actual < 0) return;
  c.report(
    `${dataPath}[${actual}].forecast`,
    `expected true: forecast points must run to the end of the series, and ${dataPath}[${first}] is already a forecast; move actual points before it`,
  );
}

function checkSeries(
  c: Checker,
  path: string,
  series: unknown,
  chart: ChartFacts,
): void {
  const {stacked} = chart;
  if (!c.object(path, series)) return;
  c.unknownFields(path, series, FIELDS.series, {aliases: ALIASES.series});
  c.string(fieldPath(path, 'label'), series.label, {
    required: true,
    maxLength: LIMITS.maxLabelLength,
  });
  if (
    series.comparison !== undefined &&
    typeof series.comparison !== 'boolean'
  ) {
    c.reportExpected(
      fieldPath(path, 'comparison'),
      'true or false',
      series.comparison,
    );
  } else if (stacked && series.comparison === true) {
    c.report(
      fieldPath(path, 'comparison'),
      `comparison series can't be stacked; use chart.stacking "grouped" or remove "comparison"`,
    );
  }
  checkColor(c, fieldPath(path, 'color'), series.color);
  const dataPath = fieldPath(path, 'data');
  if (c.array(dataPath, series.data, {min: 0, max: LIMITS.maxPoints})) {
    series.data.forEach((point, i) =>
      checkPoint(c, `${dataPath}[${i}]`, point, chart.type === 'bar'),
    );
    checkForecastRun(c, dataPath, series.data);
  }
}

/**
 * Reports a series label already used by an earlier series: labels name
 * series in the legend, tooltip and onLegendChange, so two series with one
 * label would hide and show together.
 */
function checkUniqueLabels(c: Checker, seriesList: readonly unknown[]): void {
  const seen = new Map<string, number>();
  seriesList.forEach((series, i) => {
    const label = isJsonObject(series) ? series.label : undefined;
    if (typeof label !== 'string') return;
    const first = seen.get(label);
    if (first === undefined) {
      seen.set(label, i);
      return;
    }
    c.report(
      `series[${i}].label`,
      `${describe(
        label,
      )} is already used by series[${first}]; labels name series in the legend, tooltip and onLegendChange, so each must be unique`,
    );
  });
}

function checkSeriesList(
  c: Checker,
  spec: JsonObject,
  chart: ChartFacts,
): void {
  if (spec.series === undefined) {
    if (chart.type !== 'kpi' && spec.loading !== true) {
      c.report(
        'series',
        `required unless chart.type is "kpi" or loading is true; expected an array of ${LIMITS.minSeries} to ${LIMITS.maxSeries} series`,
      );
    }
    return;
  }
  if (
    c.array('series', spec.series, {
      min: LIMITS.minSeries,
      max: LIMITS.maxSeries,
    })
  ) {
    spec.series.forEach((series, i) =>
      checkSeries(c, `series[${i}]`, series, chart),
    );
    checkUniqueLabels(c, spec.series);
    checkDateForms(c, spec.series);
  }
}

function checkDetail(c: Checker, path: string, detail: unknown): void {
  if (!c.object(path, detail)) return;
  c.unknownFields(path, detail, FIELDS.detail, {aliases: ALIASES.detail});
  for (const key of FIELDS.detail) {
    c.string(fieldPath(path, key), detail[key], {
      required: true,
      maxLength: LIMITS.maxLabelLength,
    });
  }
}

function checkProvenance(c: Checker, provenance: unknown): void {
  const path = 'provenance';
  if (!c.object(path, provenance)) return;
  c.unknownFields(path, provenance, FIELDS.provenance, {
    aliases: ALIASES.provenance,
  });
  c.string(fieldPath(path, 'source'), provenance.source, {
    required: true,
    maxLength: LIMITS.maxLabelLength,
  });
  if (provenance.fetchedAt !== undefined) {
    checkDateTime(c, fieldPath(path, 'fetchedAt'), provenance.fetchedAt);
  }
  const detailsPath = fieldPath(path, 'details');
  if (
    provenance.details !== undefined &&
    c.array(detailsPath, provenance.details, {min: 0, max: LIMITS.maxDetails})
  ) {
    provenance.details.forEach((detail, i) =>
      checkDetail(c, `${detailsPath}[${i}]`, detail),
    );
  }
}

/**
 * Checks that `spec` is a valid chart spec. Returns the spec on success, or
 * every issue found, each with a field path like `"series[1].data[3].x"`.
 * A spec that is not an object at all is reported on the path `"spec"`.
 */
export function validate(spec: unknown): ValidationResult {
  const c = new Checker();
  if (!c.object('spec', spec)) return {ok: false, errors: c.issues};

  c.unknownFields('', spec, FIELDS.spec, {aliases: ALIASES.spec});
  c.string('title', spec.title, {
    required: true,
    maxLength: LIMITS.maxLabelLength,
  });
  c.string('description', spec.description, {
    required: false,
    maxLength: LIMITS.maxDescriptionLength,
  });
  if (spec.format !== undefined) checkFormat(c, spec.format);
  if (spec.locale !== undefined) checkLocale(c, spec.locale);
  if (spec.timeZone !== undefined) checkTimeZone(c, spec.timeZone);
  if (spec.kpi !== undefined) checkKpi(c, spec.kpi);
  const chart: ChartFacts =
    spec.chart === undefined
      ? {type: undefined, stacked: false}
      : checkChart(c, spec.chart);
  checkSeriesList(c, spec, chart);
  if (spec.provenance !== undefined) checkProvenance(c, spec.provenance);
  if (spec.loading !== undefined && typeof spec.loading !== 'boolean') {
    c.reportExpected('loading', 'true or false', spec.loading);
  }
  checkBoolean(c, 'details', spec.details);
  c.string('emptyMessage', spec.emptyMessage, {
    required: false,
    maxLength: LIMITS.maxLabelLength,
  });
  if (spec.timeZone === undefined) {
    const dateTime = firstDateTime(spec);
    if (dateTime) {
      c.report(
        'timeZone',
        `required because ${dateTime} is a date-time; expected the IANA time zone the data was reported in, like "America/New_York", or "UTC" if its times are UTC`,
      );
    }
  }
  checkKpiBasis(c, spec);
  checkIncompleteSlot(c, spec);
  checkProjected(c, spec);
  checkTimeLabels(c, spec);
  checkAnnotations(c, spec);

  if (c.issues.length > 0) return {ok: false, errors: c.issues};
  // Every field was checked above, so the object now matches the type.
  return {ok: true, spec: spec as ChartSpec};
}

/** Formats issues one per line as `path: message`. */
export function formatIssues(issues: readonly SpecIssue[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n');
}
