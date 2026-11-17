// Number and date formatting with Intl. Dates never use the viewer's local
// time zone: date-only strings are calendar dates, formatted in UTC so they
// cannot shift, and date-times are instants formatted in the spec's zone.

import {minorUnitExponent} from './currency';
import {DEFAULTS} from './defaults';
import {parseIsoDate} from './isoDate';
import type {ParsedDate} from './isoDate';
import {LIMITS} from './spec';
import type {KpiNotation, ValueFormat, YAxisNotation} from './spec';

/**
 * How {@link formatDate} shows a date. Times only apply to date-times;
 * date-only values show just the date part (`Nov 27` for the time styles).
 *
 * - `"axis"`: short date, `Nov 27`.
 * - `"axisDateYear"`: short date with year, `Nov 27, 2026`.
 * - `"axisMonth"`: month, `Nov`.
 * - `"axisMonthYear"`: month with year, `Nov 2026`.
 * - `"axisYear"`: year, `2026`.
 * - `"axisTime"`: time of day, `6 AM` (`6:30 AM` off the hour); midnight
 *   shows the date it starts, `Nov 28`, so a new day is named.
 * - `"tooltipHeader"`: short date with the time of day, `Nov 27, 6 AM`.
 * - `"tooltipHeaderYear"`: the same with the year, `Nov 27, 2026, 6 AM`.
 * - `"tooltip"`: weekday and year, `Fri, Nov 27, 2026`, then the time.
 */
export type DateStyle =
  | 'axis'
  | 'axisDateYear'
  | 'axisMonth'
  | 'axisMonthYear'
  | 'axisYear'
  | 'axisTime'
  | 'tooltipHeader'
  | 'tooltipHeaderYear'
  | 'tooltip';

/** Options for {@link formatDate}. */
export type DateFormatOptions = {
  style: DateStyle;
  /** Defaults to `DEFAULTS.locale`. */
  locale?: string;
  /** Zone for date-times. Defaults to `DEFAULTS.timeZone`. Ignored for date-only values. */
  timeZone?: string;
};

// The KPI change is a headline figure: one decimal is enough to compare,
// and always one, so the width does not jump between +14.3% and +14%.
const CHANGE_FRACTION_DIGITS = 1;

// Compact tick labels stay short ("$1.25M"); ticks that need more digits to
// tell apart are shown in full instead.
const MAX_COMPACT_SIGNIFICANT_DIGITS = 3;

// From this many major units up, minor units are noise in a headline or
// tooltip ($1,111,757 rather than $1,111,757.00).
const WHOLE_UNITS_FROM = 1000;

// Below this, compact notation would only round the value, not shorten it.
const COMPACT_FROM = 1000;

// Percent formatting multiplies by 100, which absorbs two decimal places.
const PERCENT_SCALE_DIGITS = 2;

// Ticks like 0.1 * 3 carry float noise past this many significant digits.
const FLOAT_NOISE_SIGNIFICANT_DIGITS = 15;

// Intl.NumberFormat accepts at most this many significant digits.
const MAX_SIGNIFICANT_DIGITS = 21;

const CALENDAR_DAY_ZONE = 'UTC';

// Reads the wall clock as "HH:MM" in every runtime.
const WALL_CLOCK_LOCALE = 'en-US';

const SHORT_DATE_FIELDS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
};

// The calendar part of each style; time styles add the time for date-times.
const DATE_FIELDS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  axis: SHORT_DATE_FIELDS,
  axisDateYear: {...SHORT_DATE_FIELDS, year: 'numeric'},
  axisMonth: {month: 'short'},
  axisMonthYear: {month: 'short', year: 'numeric'},
  axisYear: {year: 'numeric'},
  axisTime: SHORT_DATE_FIELDS,
  tooltipHeader: SHORT_DATE_FIELDS,
  tooltipHeaderYear: {...SHORT_DATE_FIELDS, year: 'numeric'},
  tooltip: {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'},
};

const TIME_FIELDS: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

const HOUR_FIELDS: Intl.DateTimeFormatOptions = {hour: 'numeric'};

const FULL_DATE_FIELDS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

// Intl formatters are slow to construct and a chart formats thousands of
// values, so each locale and option set is built once.
const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
// The same formatters again, keyed by what the caller asked for rather than
// by serialized options, for the calls made once per point.
const valueFormatters = new Map<string, Intl.NumberFormat>();
const pointDateFormatters = new Map<string, Intl.DateTimeFormat>();

function numberFormatter(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatters.set(key, formatter);
  }
  return formatter;
}

function dateFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

function numberOptions(format: ValueFormat): Intl.NumberFormatOptions {
  switch (format.style) {
    case 'currency':
      // No fraction digits here: Intl uses the currency's own (0 for JPY).
      return {style: 'currency', currency: format.currency.toUpperCase()};
    case 'percent':
      return {
        style: 'percent',
        maximumFractionDigits:
          format.maximumFractionDigits ?? DEFAULTS.percentFractionDigits,
      };
    default:
      return {
        maximumFractionDigits:
          format.maximumFractionDigits ?? DEFAULTS.numberFractionDigits,
      };
  }
}

/**
 * Formats a value in full, e.g. `$12.50`, `$1,284,301` or `¥1,284,301`.
 * Currency amounts of 1,000 or more are shown in whole units.
 */
export function formatValue(
  value: number,
  format: ValueFormat = DEFAULTS.format,
  locale: string = DEFAULTS.locale,
): string {
  const whole =
    format.style === 'currency' && Math.abs(value) >= WHOLE_UNITS_FROM;
  // Keyed by the fields that shape the output, so the hot path (tooltips,
  // tables, summaries) skips building and serializing an options object.
  const key = `${locale}|${format.style}|${
    format.style === 'currency' ? format.currency : ''
  }|${
    format.style === 'currency' ? '' : String(format.maximumFractionDigits)
  }|${whole ? 'whole' : ''}`;
  let formatter = valueFormatters.get(key);
  if (!formatter) {
    formatter = numberFormatter(
      locale,
      whole ? fixedOptions(format, 0) : numberOptions(format),
    );
    valueFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

/** Formats a value for axis ticks, e.g. `$1.3M`. Percentages are not abbreviated. */
export function formatValueCompact(
  value: number,
  format: ValueFormat = DEFAULTS.format,
  locale: string = DEFAULTS.locale,
): string {
  if (format.style === 'percent') return formatValue(value, format, locale);
  // Fraction digits are left to compact notation, which rounds to about two
  // significant digits ("1.3M"), better suited to ticks than full precision.
  const currency: Intl.NumberFormatOptions =
    format.style === 'currency' ? numberOptions(format) : {};
  return numberFormatter(locale, {
    ...currency,
    notation: 'compact',
    compactDisplay: 'short',
  }).format(value);
}

/**
 * The decimal exponent of the least significant nonzero digit across
 * `values`: 4 for 250000 (2.5 x 10^5 ends at 10^4), -2 for 0.25. 0 when every
 * value is 0.
 */
function leastSignificantExponent(values: readonly number[]): number {
  // Only finite values: log10(Infinity) is Infinity, and the loop below
  // would never reach the fraction-digit floor. From a finite exponent it
  // takes at most about 330 steps (1e308 down to 1e-20).
  const exponents = values
    .filter((value) => value !== 0 && Number.isFinite(value))
    .map((value) => {
      let exponent = Math.floor(Math.log10(Math.abs(value)));
      while (
        exponent > -LIMITS.maxFractionDigits &&
        !Number.isInteger(
          Number(
            (value / 10 ** exponent).toPrecision(
              FLOAT_NOISE_SIGNIFICANT_DIGITS,
            ),
          ),
        )
      ) {
        exponent -= 1;
      }
      return exponent;
    });
  return exponents.length > 0 ? Math.min(...exponents) : 0;
}

/** Full-precision options with exactly `digits` decimals on every tick. */
function fixedOptions(
  format: ValueFormat,
  digits: number,
): Intl.NumberFormatOptions {
  return {
    ...numberOptions(format),
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  };
}

/** `chart.axes.y` settings that shape tick labels. */
export type TickFormatOptions = {
  /** `"compact"` ($300K) where exact, or `"standard"` ($300,000). Defaults to compact. */
  notation?: YAxisNotation;
  /** Most decimals, capping the exact count. */
  maximumFractionDigits?: number;
};

/**
 * Formats y-axis ticks as a set. Uses compact labels (`$300K`, `$1M`) when
 * they show every tick exactly; otherwise, as for ticks close together like
 * `$1,111,400` to `$1,111,700`, full values with the fewest decimals that
 * show every tick exactly, the same number on each. Currencies show no
 * decimals, their own number of them (cents), or more for ticks finer than
 * the smallest unit; whole-yen ticks never show decimals.
 */
export function formatTicks(
  values: readonly number[],
  format: ValueFormat = DEFAULTS.format,
  locale: string = DEFAULTS.locale,
  axis: TickFormatOptions = {},
): string[] {
  const {notation = DEFAULTS.yNotation, maximumFractionDigits} = axis;
  // A caller's decimal cap wins over exactness: it asked for fewer decimals.
  const cap = (digits: number) =>
    maximumFractionDigits === undefined
      ? digits
      : Math.min(digits, maximumFractionDigits);
  const exponent = leastSignificantExponent(values);
  const largest = Math.max(0, ...values.map(Math.abs));
  const significantDigits = Math.min(
    MAX_SIGNIFICANT_DIGITS,
    largest === 0 ? 1 : Math.floor(Math.log10(largest)) - exponent + 1,
  );
  // Ticks finer than Intl can show in decimals (1e-120) read in scientific
  // notation with just the digits that tell them apart, rather than all
  // rounding to 0.
  if (-exponent > LIMITS.maxFractionDigits) {
    const formatter = numberFormatter(locale, {
      ...numberOptions(format),
      notation: 'scientific',
      minimumFractionDigits: 0,
      maximumFractionDigits: undefined,
      maximumSignificantDigits: significantDigits,
    });
    // Zero has no exponent to show: "0", not "0E0".
    const zero = numberFormatter(locale, fixedOptions(format, 0)).format(0);
    return values.map((value) =>
      value === 0 ? zero : formatter.format(value),
    );
  }

  if (format.style === 'percent') {
    // A ratio of 0.25 shows as 25%: the percent sign takes two decimals.
    const digits = cap(Math.max(0, -exponent - PERCENT_SCALE_DIGITS));
    const formatter = numberFormatter(locale, fixedOptions(format, digits));
    return values.map((value) => formatter.format(value));
  }

  const currencyDigits =
    format.style === 'currency'
      ? numberFormatter(locale, numberOptions(format)).resolvedOptions()
          .maximumFractionDigits ?? 0
      : undefined;
  // Fractional currency ticks skip compact notation, which would show a
  // lone tenth ($0.2); the full form below shows cents.
  const fractionalCurrency = currencyDigits !== undefined && exponent < 0;
  if (
    notation === 'compact' &&
    !fractionalCurrency &&
    cap(-exponent) === -exponent &&
    significantDigits <= MAX_COMPACT_SIGNIFICANT_DIGITS
  ) {
    const formatter = numberFormatter(locale, {
      ...(format.style === 'currency' ? numberOptions(format) : {}),
      notation: 'compact',
      compactDisplay: 'short',
      maximumSignificantDigits: significantDigits,
    });
    const labels = values.map((value) => formatter.format(value));
    // The exactness check above reads values at 15 significant digits, so
    // ticks that differ past that (1e15 and 1e15 + 1) can share a label.
    if (new Set(labels).size === new Set(values).size) return labels;
  }

  const decimals = Math.max(0, -exponent);
  // Currencies show their own decimals on every tick or on none, never a
  // lone tenth of a dollar; more only when ticks are finer than the smallest
  // unit, as for per-unit prices like $0.0025.
  const digits = cap(
    currencyDigits !== undefined && decimals > 0
      ? Math.max(currencyDigits, decimals)
      : decimals,
  );
  const formatter = numberFormatter(locale, fixedOptions(format, digits));
  return values.map((value) => formatter.format(value));
}

/**
 * The smallest unit of a currency format in major units (0.01 for USD, 1 for
 * JPY), or undefined for other styles.
 */
export function minorUnit(format: ValueFormat): number | undefined {
  if (format.style !== 'currency') return undefined;
  return 10 ** -minorUnitExponent(format.currency);
}

/**
 * Formats a KPI value. `"compact"` abbreviates as the locale does (`$294K`,
 * `$3.8M`, `3,8 Mio. €`, `￥2.6億`) with Intl's own rounding; values under
 * 1,000 and percentages stay in full, because abbreviating would round them
 * (`$12.50` to `$13`, `105.8%` to `106%`).
 */
export function formatKpiValue(
  value: number,
  format: ValueFormat = DEFAULTS.format,
  locale: string = DEFAULTS.locale,
  notation: KpiNotation = DEFAULTS.kpiNotation,
): string {
  if (
    notation === 'standard' ||
    format.style === 'percent' ||
    Math.abs(value) < COMPACT_FROM
  ) {
    return formatValue(value, format, locale);
  }
  return numberFormatter(locale, {
    ...(format.style === 'currency' ? numberOptions(format) : {}),
    notation: 'compact',
  }).format(value);
}

/**
 * Formats a change ratio with its sign and exactly one decimal, e.g.
 * `0.2686` as `+26.9%` and `0.14` as `+14.0%`.
 */
export function formatChange(
  ratio: number,
  locale: string = DEFAULTS.locale,
): string {
  return numberFormatter(locale, {
    style: 'percent',
    minimumFractionDigits: CHANGE_FRACTION_DIGITS,
    maximumFractionDigits: CHANGE_FRACTION_DIGITS,
    signDisplay: 'exceptZero',
  }).format(ratio);
}

/**
 * The hour (0 to 23) and minute of an instant on the wall clock in
 * `timeZone`. Read in the zone because some zones are offset from UTC by 30
 * or 45 minutes.
 */
// The last wall-clock reading: a slot's axis label and tooltip header ask
// for the same instant one after the other.
let lastWallClock: {key: string; hour: number; minute: number} | undefined;

function wallClock(
  time: number,
  timeZone: string,
): {hour: number; minute: number} {
  const key = `${timeZone}|${time}`;
  if (lastWallClock?.key === key) return lastWallClock;
  // "05:30" from a fixed-format formatter is cheaper than formatToParts.
  const text = dateFormatter(WALL_CLOCK_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(time);
  const [hour, minute] = text.split(':').map(Number);
  lastWallClock = {key, hour, minute};
  return lastWallClock;
}

/** The fields for a date-time in `style`, adding the time where it shows. */
function dateTimeFields(
  style: DateStyle,
  time: number,
  timeZone: string,
): Intl.DateTimeFormatOptions {
  if (style === 'tooltip') return {...DATE_FIELDS.tooltip, ...TIME_FIELDS};
  if (
    style !== 'axisTime' &&
    style !== 'tooltipHeader' &&
    style !== 'tooltipHeaderYear'
  ) {
    return DATE_FIELDS[style];
  }
  const {hour, minute} = wallClock(time, timeZone);
  const timeOfDay = minute === 0 ? HOUR_FIELDS : TIME_FIELDS;
  if (style !== 'axisTime') return {...DATE_FIELDS[style], ...timeOfDay};
  return hour === 0 && minute === 0 ? SHORT_DATE_FIELDS : timeOfDay;
}

/**
 * Formats a data point's x value in the given {@link DateStyle}.
 * Unparseable input is returned unchanged.
 */
export function formatDate(x: string, options: DateFormatOptions): string {
  const parsed = parseIsoDate(x);
  return parsed ? formatParsedDate(parsed, options) : x;
}

/**
 * {@link formatDate} for a value already parsed with `parseIsoDate`, so a
 * caller formatting the same points more than once parses them once.
 */
export function formatParsedDate(
  parsed: ParsedDate,
  options: DateFormatOptions,
): string {
  const isDateTime = parsed.kind === 'dateTime';
  const timeZone = isDateTime
    ? options.timeZone ?? DEFAULTS.timeZone
    : CALENDAR_DAY_ZONE;
  const fields = isDateTime
    ? dateTimeFields(options.style, parsed.time, timeZone)
    : DATE_FIELDS[options.style];
  const locale = options.locale ?? DEFAULTS.locale;
  // The fields chosen depend only on the style and, for time styles, on
  // whether the time is on the hour or at midnight; keying by those avoids
  // serializing options for every point.
  const key = `${locale}|${timeZone}|${options.style}|${
    isDateTime ? fieldsVariant(fields) : 'date'
  }`;
  let formatter = pointDateFormatters.get(key);
  if (!formatter) {
    formatter = dateFormatter(locale, {...fields, timeZone});
    pointDateFormatters.set(key, formatter);
  }
  return formatter.format(parsed.time);
}

/** Which of the few field sets a date-time style picked. */
function fieldsVariant(fields: Intl.DateTimeFormatOptions): string {
  if (fields.minute) return 'minute';
  if (fields.hour) return 'hour';
  return 'day';
}

/**
 * Formats an instant with its time zone name, e.g.
 * `Nov 27, 2026, 6:00 PM UTC`. A date-only value is formatted as a date.
 * Unparseable input is returned unchanged.
 */
export function formatDateTime(
  iso: string,
  locale: string = DEFAULTS.locale,
  timeZone: string = DEFAULTS.timeZone,
): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  const options: Intl.DateTimeFormatOptions =
    parsed.kind === 'date'
      ? {...FULL_DATE_FIELDS, timeZone: CALENDAR_DAY_ZONE}
      : {...FULL_DATE_FIELDS, ...TIME_FIELDS, timeZoneName: 'short', timeZone};
  return dateFormatter(locale, options).format(parsed.time);
}
