import type {Meta, StoryObj} from '@storybook/html';
import {cleanUpCharts} from './support/mount';
import {chooseSpec} from './support/controls';
import {orderSpec} from './support/specs';

const meta: Meta = {
  parameters: {viewToggle: false},
  title: 'Features/Comparisons',
  beforeEach: cleanUpCharts,
};
export default meta;
const compared = {
  ...orderSpec,
  series: [
    ...(orderSpec.series ?? []),
    {
      label: 'Last year',
      comparison: true,
      data: [
        {x: '2025-11-28', y: 100},
        {x: '2025-11-29', y: 90},
        {x: '2025-11-30', y: 125},
      ],
    },
  ],
};
export const Overview: StoryObj = {
  name: 'Comparisons',
  render: () =>
    chooseSpec('Comparison', {
      'This year only': orderSpec,
      'Match reporting days': compared,
    }),
};
