import type {ChartSpec} from '../../src/index';

export const orderSpec: ChartSpec = {
  title: 'Orders',
  series: [
    {
      label: 'Orders',
      data: [
        {x: '2026-11-27', y: 120},
        {x: '2026-11-28', y: 95},
        {x: '2026-11-29', y: 145},
      ],
    },
  ],
};

export const moneySpec: ChartSpec = {
  ...orderSpec,
  title: 'Gross volume',
  format: {style: 'currency', currency: 'usd', unit: 'minor'},
  series: [
    {
      label: '2026',
      data: [
        {x: '2026-11-27', y: 41200025},
        {x: '2026-11-28', y: 33895080},
        {x: '2026-11-29', y: 30122040},
      ],
    },
  ],
};
