// Nice value domains and ticks: pure data, no pixels.

/** A value range and the round tick values inside it. */
export type NiceScale = {
  /** The full range to plot, padded so marks do not touch the plot edges. */
  domain: [number, number];
  /**
   * Round values within the domain, ascending. The domain may extend past
   * the first and last tick.
   */
  ticks: number[];
};

/** A {@link NiceScale} for data, with the step floor its values allow. */
export type NiceDomain = NiceScale & {
  /**
   * The smallest tick step the data allows, or 0 for no minimum. Pass it to
   * {@link niceScale} when choosing ticks for another target count.
   */
  minStep: number;
};

/** Options for {@link niceDomain}. */
export type NiceDomainOptions = {
  /**
   * Pin 0 into the domain as an unpadded baseline. Bars need it, since their
   * length encodes the value; lines read better zoomed to the data.
   */
  includeZero: boolean;
  /**
   * The values' smallest meaningful unit, such as 1 for whole yen or 0.01
   * for cents. When every value is a whole multiple of it, ticks are never
   * finer, so whole-yen data never gets a 0.5 yen tick. Data that is finer
   * than the unit (prices like $0.0025) keeps finer ticks.
   */
  unit?: number | undefined;
  /**
   * A step floor that always applies, such as 1 for labels capped at no
   * decimals, so ticks never need more decimals than are shown.
   */
  minStep?: number | undefined;
};

/** Options for {@link niceTicks} and {@link niceScale}. */
export type NiceTicksOptions = {
  /**
   * About how many ticks to aim for. Defaults to
   * {@link DEFAULT_TARGET_TICK_COUNT}; short plots should ask for fewer.
   */
  targetCount?: number;
  /** The smallest step to use, a power of ten. Defaults to 0, no minimum. */
  minStep?: number;
};

/** Options for {@link niceScale}. */
export type NiceScaleOptions = NiceTicksOptions & {
  /**
   * Fewest ticks to show; the domain is extended to reach it. The caller
   * picks it: a layout may pass 2 on a plot too short for two tick gaps at
   * its label spacing, where 3 ticks would force a step far wider than the
   * data. Defaults to {@link DEFAULT_MIN_TICK_COUNT}.
   */
  minCount?: number;
  /**
   * Smallest gap between ticks as a fraction of the domain, for example the
   * minimum label spacing divided by the plot height. When given,
   * neighbouring steps are compared and the one wasting the least range
   * wins, as long as it keeps this gap. Defaults to none: only the target's
   * step is used.
   */
  minTickGap?: number;
  /**
   * Most ticks a compared step may produce. Defaults to
   * {@link DEFAULT_MAX_TICK_COUNT}.
   */
  maxCount?: number;
};

/** Four labels read well on a typical card-sized plot. */
export const DEFAULT_TARGET_TICK_COUNT = 4;

/**
 * With fewer than three labels a value axis is hard to read off, so this is
 * the default wherever the plot has room for them.
 */
export const DEFAULT_MIN_TICK_COUNT = 3;

/** Beyond six labels a value axis reads as a ruler rather than a scale. */
export const DEFAULT_MAX_TICK_COUNT = 6;

// Neighbouring 1/2/5 steps by leading factor: 200 -> 100 finer, 500 coarser.
const FINER_STEP_FACTOR: Readonly<Record<number, number>> = {
  1: 0.5,
  2: 0.5,
  5: 0.4,
};
const COARSER_STEP_FACTOR: Readonly<Record<number, number>> = {
  1: 2,
  2: 2.5,
  5: 2,
};

// Steps tried around the target's own step when minimising wasted range:
// one coarser and two finer. A two-tick axis needs a step about as tall as
// the data (near-flat bars to $1.1M want a $2M step), so it tries up to
// three coarser ones.
const COARSER_CANDIDATES = 1;
const TWO_TICK_COARSER_CANDIDATES = 3;
const FINER_CANDIDATES = 2;

// With only two ticks there is no tick in between to read a tall bar
// against, so the outermost tick must reach the bars, with a coarser step
// if needed.
const TWO_TICKS = 2;
const TWO_TICK_MAX_HANG = 0;

// Domain ends less than this many steps past 0 hang past the last tick
// instead of getting one.
const HALF = 0.5;

// Bars may run up to this many steps past their outermost tick, measured on
// the padded domain (where bars just past half a step land near 0.7).
// Further than that, one more tick at the same step is preferred where it
// fits; where it does not, the bars keep running past.
const MAX_FAR_END_HANG = 0.75;

const WASTE_TOLERANCE = 1e-9;

// Steps are 1, 2 or 5 times a power of ten, the easiest to count in (no
// 2.5: labels like 250K and 750K read worse). The rough step, span divided
// by targetCount, is rounded to the factor it is closest to on a log scale;
// these are the geometric midpoints between neighbouring factors
// (sqrt(1 x 2), sqrt(2 x 5), sqrt(5 x 10)).
const STEP_THRESHOLDS: readonly {
  readonly from: number;
  readonly factor: number;
}[] = [
  {from: Math.sqrt(50), factor: 10},
  {from: Math.sqrt(10), factor: 5},
  {from: Math.sqrt(2), factor: 2},
];

// Padding as a fraction of the data's span. There is more below than above
// so a line's low point stays clear of the x axis.
const PADDING_BELOW = 0.06;
const PADDING_ABOVE = 0.03;

// When every value is equal there is no span to round; plot a range this
// fraction of the value wide on each side of it.
const FLAT_HALF_RANGE = 0.1;

// With no data, or only zeros, show 0 to 1.
const EMPTY_DOMAIN: readonly [number, number] = [0, 1];

// Floating point steps produce values like 0.30000000000000004. Noise is
// removed relative to the quantity that matters (the step for ticks, the
// span for domain ends), keeping this many digits below it, so large values
// such as 1e12 + 0.25 keep their fraction.
const DIGITS_BELOW_SCALE = 10;
// A double round-trips 15 significant decimal digits; beyond that the
// digits are representation error (1e12 + 0.2 would read 1e12 + 0.2001).
const MAX_PRECISION = 15;
// Values that need more digits than that to keep one below the scale (1e15
// + 1 at a scale of 1) keep that digit, up to the 17 that identify any
// double, so distinct ends and ticks never round onto each other.
const MAX_DISTINCT_PRECISION = 17;

// More candidate ticks than this means the step is too small to draw, as
// for a span near the smallest double.
const MAX_CANDIDATE_TICKS = 1000;
// A step narrower than this many float spacings at the domain's magnitude
// lands ticks unevenly or on each other: doubles near 1e15 are 0.125 apart,
// so a 0.2 step gives 0.25, 0.5, 0.625.
const MIN_STEP_SPACINGS = 16;

// Extending a domain to reach the minimum tick count takes a few steps; this
// bounds the loop whatever the input.
const MAX_EXTENSIONS = 64;

/** `value` without float noise finer than `scale` allows. */
function roundNoise(value: number, scale: number): number {
  if (value === 0 || !Number.isFinite(value) || !(scale > 0)) return value;
  const scaleDigits = Math.ceil(Math.log10(Math.abs(value) / scale));
  const digits = scaleDigits + DIGITS_BELOW_SCALE;
  if (digits < 1) return 0;
  const precision = Math.min(
    digits,
    Math.max(MAX_PRECISION, Math.min(scaleDigits + 1, MAX_DISTINCT_PRECISION)),
  );
  return Number(value.toPrecision(precision));
}

/**
 * Whether `step` can produce ticks in `[low, high]`: positive, finite, not
 * vanishing, and wide enough for doubles at that magnitude to space evenly.
 */
function isUsableStep(step: number, low: number, high: number): boolean {
  const magnitude = Math.max(Math.abs(low), Math.abs(high));
  return (
    step > 0 &&
    Number.isFinite(step) &&
    (high - low) / step <= MAX_CANDIDATE_TICKS &&
    step >= magnitude * Number.EPSILON * MIN_STEP_SPACINGS
  );
}

/** Multiples of `step` within `[low, high]`. */
function ticksWithin(low: number, high: number, step: number): number[] {
  if (!isUsableStep(step, low, high)) return [];
  const first = Math.ceil(roundNoise(low / step, 1));
  const last = Math.floor(roundNoise(high / step, 1));
  return Array.from({length: Math.max(0, last - first + 1)}, (_, i) =>
    roundNoise((first + i) * step, step),
  );
}

/** A multiple of `step` rounded down (or up) from `value`. */
function floorTo(value: number, step: number): number {
  return roundNoise(Math.floor(roundNoise(value / step, 1)) * step, step);
}

function ceilTo(value: number, step: number): number {
  return roundNoise(Math.ceil(roundNoise(value / step, 1)) * step, step);
}

/** The nice step closest to `span / targetCount`. */
function niceStep(span: number, targetCount: number): number {
  const rough = span / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const ratio = rough / magnitude;
  const factor =
    STEP_THRESHOLDS.find((threshold) => ratio >= threshold.from)?.factor ?? 1;
  return factor * magnitude;
}

function stepFor(
  span: number,
  {targetCount = DEFAULT_TARGET_TICK_COUNT, minStep = 0}: NiceTicksOptions,
): number {
  return Math.max(niceStep(span, Math.max(1, targetCount)), minStep);
}

/**
 * Round tick values within `domain`, about `targetCount` of them, with a step
 * of 1, 2 or 5 times a power of ten. Every tick is inside the domain; the
 * ends need not be ticks. See {@link niceScale} to also guarantee a minimum
 * number of ticks.
 */
export function niceTicks(
  domain: readonly [number, number],
  options: NiceTicksOptions = {},
): number[] {
  const [low, high] = domain;
  const span = high - low;
  if (!(span > 0)) return [low];
  return ticksWithin(low, high, stepFor(span, options));
}

/** A candidate scale with the keys it is ranked by, most important first. */
type Ranked = {
  scale: NiceScale;
  /** Some end leaves half a step or more of empty plot past the input. */
  overshoots: boolean;
  /** Some side of 0 the input reaches has no tick. */
  unlabelled: boolean;
  /** Bars (or a line through 0) run far past their outermost tick. */
  hangsFar: boolean;
  /** Fraction of the axis outside the input domain. */
  waste: number;
  /** Distance from the target's step, in 1/2/5 steps. */
  rank: number;
};

function rankScale(
  scale: NiceScale,
  input: readonly [number, number],
  step: number,
  rank: number,
  hangsFar: boolean,
): Ranked {
  const [low, high] = scale.domain;
  const below = scale.ticks.some((tick) => tick < 0);
  const above = scale.ticks.some((tick) => tick > 0);
  return {
    scale,
    overshoots: input[0] - low >= step * HALF || high - input[1] >= step * HALF,
    unlabelled: (input[0] < 0 && !below) || (input[1] > 0 && !above),
    hangsFar,
    waste: 1 - (input[1] - input[0]) / (high - low),
    rank,
  };
}

/**
 * Whether `a` beats `b`: no half-step overshoot first, then every side of
 * 0 labelled, then bars not hanging far past their last tick, then least
 * wasted range, then the step nearest the target's.
 */
function isBetter(a: Ranked, b: Ranked | undefined): boolean {
  if (!b) return true;
  if (a.overshoots !== b.overshoots) return !a.overshoots;
  if (a.unlabelled !== b.unlabelled) return !a.unlabelled;
  if (a.hangsFar !== b.hangsFar) return !a.hangsFar;
  if (Math.abs(a.waste - b.waste) > WASTE_TOLERANCE) return a.waste < b.waste;
  return a.rank < b.rank;
}

/**
 * Round ticks for `domain`, with the domain extended to the next multiple of
 * the step where needed. An end at 0 stays put, so bars keep their baseline.
 *
 * With `minTickGap`, neighbouring 1/2/5 steps are compared subject to label
 * spacing and `maxCount`. Prefer less empty space, then ticks on each side
 * of 0 the data reaches, then ticks close to the far ends of bars, then
 * less wasted range and a step near the target. These priorities keep the
 * axis readable without making small variations look flat.
 *
 * Two-tick axes favour reaching the taller side of the data, since no
 * intermediate tick helps read the bars. Lines zoomed away from 0 may
 * extend past their outermost ticks.
 *
 * Domains are extended toward `minCount` where the step allows it. Flat,
 * overflowing or numerically unusable ranges have fallback ticks; a step
 * floor at least as wide as the span uses the smallest covering domain.
 * If no candidate meets the spacing limits, the target's step is used.
 */
export function niceScale(
  domain: readonly [number, number],
  {
    minCount = DEFAULT_MIN_TICK_COUNT,
    maxCount = DEFAULT_MAX_TICK_COUNT,
    minTickGap,
    ...options
  }: NiceScaleOptions = {},
): NiceScale {
  const span = domain[1] - domain[0];
  // A span that overflows (ends near ±1e308) cannot be drawn; show the
  // empty axis rather than ticks at infinity.
  if (!Number.isFinite(span)) {
    return {domain: [...EMPTY_DOMAIN], ticks: niceTicks(EMPTY_DOMAIN)};
  }
  if (!(span > 0)) return {domain: [domain[0], domain[1]], ticks: [domain[0]]};
  // A step floor at least as wide as the span (labels capped at 0 decimals
  // for data from 0.001 to 0.003) leaves one honest axis: the fewest steps
  // that hold the data, never extra empty ones, even below minCount.
  const floor = options.minStep ?? 0;
  if (floor > 0 && floor >= span) {
    const low = floorTo(domain[0], floor);
    const ceiled = ceilTo(domain[1], floor);
    const high = ceiled > low ? ceiled : roundNoise(low + floor, floor);
    return {domain: [low, high], ticks: ticksWithin(low, high, floor)};
  }
  const step = stepFor(span, options);
  // A span too small for float steps (0 to 5e-324) gets its ends as ticks.
  if (!isUsableStep(step, domain[0], domain[1])) {
    return {domain: [domain[0], domain[1]], ticks: [domain[0], domain[1]]};
  }
  // Without a spacing limit a finer step could crowd the labels.
  const steps =
    minTickGap === undefined
      ? [{candidate: step, rank: 0}]
      : [
          {candidate: step, rank: 0},
          ...neighbourSteps(
            step,
            minCount <= TWO_TICKS
              ? TWO_TICK_COARSER_CANDIDATES
              : COARSER_CANDIDATES,
          ),
        ];
  const twoTicks = minCount <= TWO_TICKS;
  const maxHang = twoTicks ? TWO_TICK_MAX_HANG : MAX_FAR_END_HANG;
  const fits = (candidate: number, {domain: [low, high], ticks}: NiceScale) =>
    minTickGap === undefined ||
    (candidate >= (options.minStep ?? 0) &&
      ticks.length <= maxCount &&
      candidate / (high - low) >= minTickGap);
  const room = (candidate: number, scale: NiceScale) =>
    scale.ticks.length <= maxCount &&
    (minTickGap === undefined ||
      candidate / (scale.domain[1] - scale.domain[0]) >= minTickGap);

  const variants = (candidate: number, rank: number): Ranked[] =>
    [true, false].flatMap((cover) => {
      const covered = coverSides(domain, candidate, cover);
      const base = withMinCount(covered, minCount);
      const extended = withMinCount(
        extendFarEnds(covered, domain, maxHang),
        minCount,
      );
      // Two ticks can only reach one side: the taller one, where the bars
      // that matter most are (a -$60K stack under $1.5M may hang below 0).
      const hangs = (scale: NiceScale) => {
        const [below, above] = endHangs(domain, scale.ticks);
        const tallerHang = -domain[0] > domain[1] ? below : above;
        const far = twoTicks ? tallerHang : Math.max(below, above);
        return far > candidate * maxHang;
      };
      // With 3 or more ticks, running past the last tick only counts when
      // one more tick at this step fits; with 2, a coarser step may fix it.
      const baseHangs = hangs(base) && (twoTicks || room(candidate, extended));
      return [
        rankScale(base, domain, candidate, rank, baseHangs),
        rankScale(extended, domain, candidate, rank, hangs(extended)),
      ];
    });
  const target = variants(step, 0).reduce((a, b) => (isBetter(b, a) ? b : a));

  let best: Ranked | undefined;
  for (const {candidate, rank} of steps) {
    for (const option of variants(candidate, rank)) {
      if (fits(candidate, option.scale) && isBetter(option, best)) {
        best = option;
      }
    }
  }
  return (best ?? target).scale;
}

/** Steps around `step`, with their distance from it in 1/2/5 steps. */
function neighbourSteps(
  step: number,
  coarserCount: number,
): {candidate: number; rank: number}[] {
  const steps: {candidate: number; rank: number}[] = [];
  let coarser = step;
  for (let rank = 1; rank <= coarserCount; rank += 1) {
    coarser = shiftStep(coarser, COARSER_STEP_FACTOR);
    steps.push({candidate: coarser, rank});
  }
  let finer = step;
  for (let rank = 1; rank <= FINER_CANDIDATES; rank += 1) {
    finer = shiftStep(finer, FINER_STEP_FACTOR);
    steps.push({candidate: finer, rank});
  }
  return steps;
}

/** The neighbouring 1, 2 or 5 step in the direction `factors` gives. */
function shiftStep(
  step: number,
  factors: Readonly<Record<number, number>>,
): number {
  const magnitude = 10 ** Math.floor(Math.log10(step));
  const leading = Math.round(step / magnitude);
  return roundNoise(step * (factors[leading] ?? 1), step);
}

/**
 * Whether the domain reaches far enough past 0 at `end` to need its own
 * tick there. Less than half a step is left to hang past the last tick, as
 * bars may rise above the top one; a small negative stack under large
 * positive ones then does not drag the axis down a whole step.
 */
function reachesPastZero(end: number, step: number): boolean {
  return Math.abs(end) >= step * HALF;
}

/**
 * Ticks at `step`. With `cover`, the domain is rounded out where it reaches
 * a side of 0 that has no tick, so negative (or positive) values get a
 * labelled tick; without it, only sides reaching half a step past 0 are.
 * 0 is then always a tick, since it is a multiple of any step.
 */
function coverSides(
  domain: readonly [number, number],
  step: number,
  cover: boolean,
): NiceScale & {step: number} {
  let [low, high] = domain;
  const inside = ticksWithin(low, high, step);
  const needs = (end: number) => cover || reachesPastZero(end, step);
  if (low < 0 && needs(low) && (inside[0] ?? 0) >= 0) {
    low = floorTo(low, step);
  }
  if (high > 0 && needs(high) && (inside[inside.length - 1] ?? 0) <= 0) {
    high = ceilTo(high, step);
  }
  return {domain: [low, high], ticks: ticksWithin(low, high, step), step};
}

/**
 * Extends `scale` until it has `minCount` ticks, one step multiple at a
 * time, each time at the end that needs the shorter extension, so the axis
 * grows no more than it must ($200K to $462K at a $100K step becomes $200K
 * to $462K, not $200K to $500K). An end at 0, or one hanging just past it,
 * does not move away from 0; an end short of 0 may always grow toward it
 * (a line from -$5.2K to -$0.8K reaches 0).
 */
function withMinCount(
  {domain, ticks, step}: NiceScale & {step: number},
  minCount: number,
): NiceScale {
  if (ticks.length >= minCount) return {domain, ticks};
  // A step too fine to draw never gains ticks; leave it to lose the ranking.
  if (!isUsableStep(step, domain[0], domain[1])) return {domain, ticks};
  let [low, high] = domain;
  // Growing toward 0 never crosses it; growing away from 0 is only for ends
  // that already reach half a step past it.
  const lowMoves = low > 0 || reachesPastZero(low, step);
  const highMoves =
    high < 0 ||
    reachesPastZero(high, step) ||
    // With neither end far from 0, grow the larger side.
    (!lowMoves && high >= -low);
  let extended = ticks;
  for (
    let extensions = 0;
    extended.length < minCount && extensions < MAX_EXTENSIONS;
    extensions += 1
  ) {
    const lower = roundNoise(
      (Math.ceil(roundNoise(low / step, 1)) - 1) * step,
      step,
    );
    const upper = roundNoise(
      (Math.floor(roundNoise(high / step, 1)) + 1) * step,
      step,
    );
    const growLow = lowMoves && (!highMoves || low - lower < upper - high);
    // Stop if the step is too fine to move the end at this magnitude.
    if (growLow ? lower >= low : upper <= high) break;
    if (growLow) low = lower;
    else high = upper;
    extended = ticksWithin(low, high, step);
  }
  return {domain: [low, high], ticks: extended};
}

/**
 * How far a domain that reaches 0 (bars, stacks, lines crossing 0) runs
 * past its outermost tick on each side, as [below, above]. Domains away
 * from 0 give [0, 0]: a line zoomed in on its data may sit well past its
 * last tick.
 */
function endHangs(
  domain: readonly [number, number],
  ticks: readonly number[],
): [number, number] {
  const [low, high] = domain;
  if (low > 0 || high < 0) return [0, 0];
  return [
    low < 0 ? Math.min(0, ...ticks) - low : 0,
    high > 0 ? high - Math.max(0, ...ticks) : 0,
  ];
}

/**
 * `scale` with each end that runs more than `maxHang` steps past its
 * outermost tick rounded out to the next step, so the tallest (or deepest)
 * bars get a labelled tick near them.
 */
function extendFarEnds(
  scale: NiceScale & {step: number},
  domain: readonly [number, number],
  maxHang: number,
): NiceScale & {step: number} {
  const {step} = scale;
  const [below, above] = endHangs(domain, scale.ticks);
  let [low, high] = scale.domain;
  if (below > step * maxHang) {
    low = floorTo(low, step);
  }
  if (above > step * maxHang) {
    high = ceilTo(high, step);
  }
  return {domain: [low, high], ticks: ticksWithin(low, high, step), step};
}

/** `unit` when every value is a whole multiple of it, else 0. */
function stepFloor(
  values: readonly number[],
  unit: number | undefined,
): number {
  if (unit === undefined || !(unit > 0)) return 0;
  const whole = values.every((value) =>
    Number.isInteger(roundNoise(value / unit, 1)),
  );
  return whole ? unit : 0;
}

/** The data's extent, widened to include 0 and to a nonzero span. */
function extent(
  values: readonly number[],
  includeZero: boolean,
): [number, number] {
  const anchors = includeZero ? [0] : [];
  const low = Math.min(...values, ...anchors);
  const high = Math.max(...values, ...anchors);
  if (low !== high) return [low, high];
  if (low === 0) return [...EMPTY_DOMAIN];
  if (includeZero) return low < 0 ? [low, 0] : [0, high];
  const halfRange = Math.abs(low) * FLAT_HALF_RANGE;
  return [low - halfRange, high + halfRange];
}

/**
 * The domain and default ticks for `values`: a domain padded around the
 * data, with about {@link DEFAULT_TARGET_TICK_COUNT} round ticks within it
 * (at least {@link DEFAULT_MIN_TICK_COUNT}, extending the domain if needed).
 * Padding never crosses 0. With `includeZero` (bars), 0 is in the domain, so
 * bars start on the baseline. Ticks may fall in the padding, so a peak just
 * under a round value (bars up to $295K) still gets that value ($300K) as
 * its top tick.
 */
export function niceDomain(
  values: readonly number[],
  {includeZero, unit, minStep: floor = 0}: NiceDomainOptions,
): NiceDomain {
  const minStep = Math.max(stepFloor(values, unit), floor);
  if (values.length === 0) {
    return {...niceScale(EMPTY_DOMAIN, {minStep}), minStep};
  }
  const [low, high] = extent(values, includeZero);
  const span = high - low;
  // Padding never crosses 0: data that is all positive (or all negative)
  // gets no axis values of the other sign, and a 0 end stays the baseline.
  const below = low - span * PADDING_BELOW;
  const above = high + span * PADDING_ABOVE;
  const padded: [number, number] = [
    roundNoise(low >= 0 ? Math.max(0, below) : below, span),
    roundNoise(high <= 0 ? Math.min(0, above) : above, span),
  ];
  // Validation keeps values far below this, but a span or padding that
  // overflows must not reach the tick math.
  if (!padded.every(Number.isFinite)) {
    return {...niceScale(EMPTY_DOMAIN, {minStep}), minStep};
  }
  return {...niceScale(padded, {minStep}), minStep};
}
