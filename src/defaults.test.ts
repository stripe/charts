import {resolveSpec} from './defaults';
import type {ChartSpec, ValueFormat} from './spec';

describe('resolveSpec', () => {
  it('normalizes values to major units and ratios once', () => {
    const resolved = (format: ValueFormat, y: number) => {
      const spec: ChartSpec = {
        title: 'Gross volume',
        format,
        kpi: {value: y, basis: 'latest'},
        series: [{label: '2026', data: [{x: '2026-11-27', y}]}],
      };
      const {series, kpi} = resolveSpec(spec);
      return [series[0].data[0].y, kpi?.value];
    };
    const minor = (currency: string): ValueFormat => ({
      style: 'currency',
      currency,
      unit: 'minor',
    });
    expect(resolved(minor('usd'), 1999)).toEqual([19.99, 19.99]);
    expect(resolved(minor('jpy'), 1999)).toEqual([1999, 1999]);
    expect(resolved(minor('kwd'), 1999)).toEqual([1.999, 1.999]);
    // Stripe sends ISK as two-decimal amounts, though ISO 4217 has none.
    expect(resolved(minor('isk'), 500)).toEqual([5, 5]);
    expect(resolved({style: 'percent', unit: 'percent'}, 2.5)).toEqual([
      0.025, 0.025,
    ]);
  });
});
