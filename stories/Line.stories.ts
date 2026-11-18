import type {Meta, StoryObj} from '@storybook/html';
import {orders, orderSpec, orderTotal} from './support/specs';
import {cleanUpCharts} from './support/mount';
import {chartExamples} from './support/chartExamples';

const meta: Meta = {
  title: 'Charts/Line',
  parameters: {viewToggle: false, codePanel: false},
  beforeEach: cleanUpCharts,
};
export default meta;

export const Overview: StoryObj = {
  name: 'Line',
  render: () =>
    chartExamples([
      {
        title: 'Basic line',
        spec: orderSpec,
      },
      {
        title: 'With a headline',
        spec: {
          ...orderSpec,
          kpi: {value: orderTotal, basis: 'total'},
        },
      },
      {
        title: 'Comparison',
        spec: {
          ...orderSpec,
          series: [
            orders,
            {
              label: 'Previous period',
              comparison: true,
              data: orders.data.map(({x, y}) => ({
                x,
                y: y === null ? null : Math.round(y * 0.8),
              })),
            },
          ],
        },
      },
    ]),
};
