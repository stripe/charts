import type {Meta, StoryObj} from '@storybook/html';
import {cleanUpCharts} from './support/mount';
import {chooseSpec} from './support/controls';
import {moneySpec} from './support/specs';

const meta: Meta = {
  parameters: {viewToggle: false},
  title: 'Features/Validation',
  beforeEach: cleanUpCharts,
};
export default meta;
export const Overview: StoryObj = {
  render: () =>
    chooseSpec('Spec', {
      'Missing currency units': {
        ...moneySpec,
        format: {style: 'currency', currency: 'usd'},
      },
      'Corrected spec': moneySpec,
    }),
};
