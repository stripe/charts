import type {ChartSpec} from '../../src/index';
import {curve, dates, points, total} from './data';

export const reportingDays = dates('2026-11-01', 30);
const orderValues = curve(reportingDays.length, 120, 260, {
  jitter: 0.35,
  seed: 17,
});
orderValues[1] = 95;
export const orders = {
  label: 'Orders',
  data: points(reportingDays, orderValues),
};
export const orderTotal = total(orders);

export const orderSpec: ChartSpec = {
  title: 'Orders',
  series: [orders],
};

export const moneySpec: ChartSpec = {
  title: 'Gross volume',
  format: {style: 'currency', currency: 'usd', unit: 'minor'},
  series: [
    {
      label: '2026',
      data: points(
        reportingDays,
        curve(reportingDays.length, 24_000_025, 41_200_025, {
          jitter: 0.55,
          seed: 23,
        }),
      ),
    },
  ],
};
