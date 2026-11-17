import type {Meta, StoryObj} from '@storybook/html';
import {cleanUpCharts} from './support/mount';
import {chooseSpec} from './support/controls';
import {orderSpec, reportingDays} from './support/specs';

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
            data: reportingDays.map((x, index) => ({
              x,
              y:
                Math.round(
                  (0.025 + index * 0.0002 + Math.sin(index * 0.9) * 0.003) *
                    10000,
                ) / 10000,
            })),
          },
        ],
      },
    }),
};
