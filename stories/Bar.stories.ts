import type {Meta, StoryObj} from '@storybook/html';
import type {Series} from '../src/index';
import {orders, orderSpec} from './support/specs';
import {cleanUpCharts} from './support/mount';
import {chartExamples} from './support/chartExamples';

const meta: Meta = {
  title: 'Charts/Bar',
  parameters: {viewToggle: false, codePanel: false},
  beforeEach: cleanUpCharts,
};
export default meta;

const channels: Series[] = [
  {label: 'Online', data: orders.data.slice(0, 7)},
  {
    label: 'In store',
    data: orders.data
      .slice(0, 7)
      .map(({x, y}) => ({x, y: y === null ? null : Math.round(y * 0.6)})),
  },
];

export const Overview: StoryObj = {
  name: 'Bar',
  render: () =>
    chartExamples([
      {
        title: 'Basic bars',
        spec: {...orderSpec, chart: {type: 'bar'}},
      },
      {
        title: 'Grouped',
        spec: {
          title: 'Orders by channel',
          chart: {type: 'bar', legend: 'show'},
          series: channels,
        },
      },
      {
        title: 'Stacked',
        spec: {
          title: 'Orders by channel',
          chart: {type: 'bar', stacking: 'stacked', legend: 'show'},
          series: channels,
        },
      },
    ]),
};
