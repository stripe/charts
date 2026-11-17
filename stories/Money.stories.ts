import type {Meta, StoryObj} from '@storybook/html';
import {cleanUpCharts} from './support/mount';
import {chooseSpec} from './support/controls';
import {orderSpec} from './support/specs';

const meta: Meta = {
  parameters: {viewToggle: false},
  title: 'Features/Money and units',
  beforeEach: cleanUpCharts,
};
export default meta;
export const Overview: StoryObj = {
  name: 'Money and units',
  render: () =>
    chooseSpec('Units', {
      'USD · minor units': {
        ...orderSpec,
        title: 'Gross volume',
        format: {style: 'currency', currency: 'usd', unit: 'minor'},
      },
      'USD · major units': {
        ...orderSpec,
        title: 'Gross volume',
        format: {style: 'currency', currency: 'usd', unit: 'major'},
      },
      'JPY · minor units': {
        ...orderSpec,
        title: 'Gross volume',
        format: {style: 'currency', currency: 'jpy', unit: 'minor'},
      },
      'Percent · ratio': {
        ...orderSpec,
        title: 'Conversion rate',
        format: {style: 'percent', unit: 'ratio'},
        series: [
          {
            label: 'Conversion',
            data: [
              {x: '2026-11-27', y: 0.025},
              {x: '2026-11-28', y: 0.03},
              {x: '2026-11-29', y: 0.028},
            ],
          },
        ],
      },
    }),
};
