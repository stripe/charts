import {niceDomain, niceScale, niceTicks} from './domain';

describe('niceTicks', () => {
  it('uses 1, 2 or 5 steps, never 2.5, and follows the target count', () => {
    // 0 to $1.08M: a $250K step would give exactly 5 ticks, but $200K reads
    // better.
    expect(niceTicks([0, 1080000], {targetCount: 5})).toEqual([
      0, 200000, 400000, 600000, 800000, 1000000,
    ]);
    // Short plots ask for fewer ticks.
    expect(niceTicks([0, 1080000], {targetCount: 3})).toEqual([
      0, 500000, 1000000,
    ]);
  });
});

describe('niceScale', () => {
  it('extends the domain to show at least 3 ticks, never finer than the unit', () => {
    // A short bar plot asks for 2 ticks; the top grows to the next step.
    expect(niceScale([0, 0.0035], {targetCount: 2})).toEqual({
      domain: [0, 0.004],
      ticks: [0, 0.002, 0.004],
    });
    // A stack down to -$60K on a 260px plot (32px label spacing). The
    // target picks a $200K step, which would draw the axis to -$200K; the
    // finer $100K step labels the negative side and wastes no range.
    expect(
      niceScale([-100000, 471194], {targetCount: 4, minTickGap: 32 / 260}),
    ).toEqual({
      domain: [-100000, 471194],
      ticks: [-100000, 0, 100000, 200000, 300000, 400000],
    });
    // A line from $252K to $456K on a 100px plot: a $50K step crowds the
    // labels, so $100K extends just the nearer end to fit 3 ticks, instead
    // of rounding both ends out to $200K-$500K (or a $200K step to $600K).
    expect(
      niceScale([239564.194, 461848.003], {
        targetCount: 4,
        minTickGap: 32 / 100,
      }),
    ).toEqual({
      domain: [239564.194, 500000],
      ticks: [300000, 400000, 500000],
    });
    // Sales to $89.6K stacked over refunds to -$60K, on a 200px plot: with
    // ticks up to $50K the tallest bars would rise 79% of a step past the
    // top one, so a $100K tick is added above them.
    expect(
      niceScale([-68695, 94119], {targetCount: 4, minTickGap: 32 / 200}),
    ).toEqual({
      domain: [-68695, 100000],
      ticks: [-50000, 0, 50000, 100000],
    });
    // Bars to 0.0035 on a 60px plot, where only 2 ticks fit: the top tick
    // reaches the bars (0.005) instead of stopping at 0.002 below them.
    expect(
      niceScale([0, 0.003605], {
        targetCount: 4,
        minTickGap: 32 / 60,
        minCount: 2,
      }),
    ).toEqual({domain: [0, 0.005], ticks: [0, 0.005]});
    // Two ticks reach the taller side, and a short end grows toward 0: a
    // stack from -$60K to $1.5M, and a line from -5.2K to -0.8K.
    const twoTicks = {targetCount: 4, minTickGap: 32 / 60, minCount: 2};
    expect(niceScale([-153188.1, 1543598.55], twoTicks).ticks).toEqual([
      0, 2000000,
    ]);
    expect(niceScale([-5464, -668], twoTicks).ticks).toEqual([-5000, 0]);
    // Bars to 17 run half a step past the 15 tick, under the 3/4 limit, so
    // no 20 tick (and its empty band) is added.
    expect(niceDomain([0, 3, 17], {includeZero: true}).ticks).toEqual([
      0, 5, 10, 15,
    ]);
    // Labels capped at 0 decimals for data from 0.001 to 0.003: the
    // smallest whole-step axis, not an extra empty step for a third tick.
    expect(niceScale([0.00106, 0.00346], {targetCount: 4, minStep: 1})).toEqual(
      {
        domain: [0, 1],
        ticks: [0, 1],
      },
    );
    // Flat whole-yen data: no 0.5 yen ticks, and still 3 of them.
    expect(niceDomain([3, 3], {includeZero: false, unit: 1})).toEqual({
      domain: [2, 4],
      ticks: [2, 3, 4],
      minStep: 1,
    });
  });
});

describe('niceDomain at the limits of floating point', () => {
  it('stays finite for a vanishing span and keeps fractions on huge values', () => {
    const tiny = niceDomain([0, 5e-324], {includeZero: true});
    expect(tiny.ticks.every(Number.isFinite)).toBe(true);
    expect(tiny.domain).toEqual([0, 5e-324]);
    // A span that overflows falls back to the empty axis.
    expect(niceDomain([-1e308, 1e308], {includeZero: false}).domain).toEqual([
      0, 1,
    ]);
    const huge = niceDomain([1e12, 1e12 + 1], {includeZero: false});
    expect(huge.domain[0]).toBeLessThan(1e12);
    expect(huge.domain[1]).toBeGreaterThan(1e12 + 1);
    expect(huge.ticks).toEqual([
      1e12,
      1e12 + 0.2,
      1e12 + 0.4,
      1e12 + 0.6,
      1e12 + 0.8,
      1e12 + 1,
    ]);
    // Near the validated limit, values one apart keep distinct ends, and
    // ticks finer than doubles can space evenly give way to the ends.
    for (const values of [
      [1e15, 1e15 + 1],
      [1e14, 1e14 + 0.02],
    ]) {
      const edge = niceDomain(values, {includeZero: false});
      expect(edge.domain[0]).toBeLessThanOrEqual(Math.min(...values));
      expect(edge.domain[1]).toBeGreaterThanOrEqual(Math.max(...values));
      expect(edge.domain[1]).toBeGreaterThan(edge.domain[0]);
      expect(edge.ticks).toEqual(edge.domain);
    }
  });
});
