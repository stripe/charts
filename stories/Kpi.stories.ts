import type {Meta, StoryObj} from '@storybook/html';
import {orderSpec, orderTotal} from './support/specs';
import {cleanUpCharts} from './support/mount';
import {chartExamples} from './support/chartExamples';

const meta: Meta = {
  title: 'Charts/KPI',
  parameters: {viewToggle: false, codePanel: false},
  beforeEach: cleanUpCharts,
};
export default meta;

export const Overview: StoryObj = {
  name: 'KPI',
  render: () =>
    chartExamples([
      {
        title: 'Total',
        spec: {
          title: 'Orders',
          chart: {type: 'kpi'},
          kpi: {value: orderTotal, basis: 'total'},
        },
      },
      {
        title: 'Compact value',
        spec: {
          title: 'Orders',
          chart: {type: 'kpi'},
          kpi: {
            value: orderTotal,
            basis: 'total',
            comparisonValue: Math.round(orderTotal * 0.8),
            notation: 'compact',
          },
        },
      },
      {
        title: 'With a sparkline',
        spec: {
          ...orderSpec,
          chart: {type: 'kpi'},
          kpi: {value: orderTotal, basis: 'total'},
        },
      },
    ]),
};
