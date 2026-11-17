import type {Meta, StoryObj} from '@storybook/html';
import {cleanUpCharts} from './support/mount';
import {chooseSpec} from './support/controls';
import {curve, dates, points} from './support/data';
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
      data: points(
        dates('2025-11-02', 30),
        curve(30, 100, 220, {jitter: 0.35, seed: 31}),
      ),
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
