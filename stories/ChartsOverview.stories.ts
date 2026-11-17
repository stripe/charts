import type {Meta, StoryObj} from '@storybook/html';
import {storyLinks} from './support/guidePage';

const meta: Meta = {parameters: {viewToggle: false}, title: 'Charts'};
export default meta;

export const Overview: StoryObj = {
  render: () =>
    storyLinks([
      ['Line', 'charts-line--overview'],
      ['Bar', 'charts-bar--overview'],
      ['KPI', 'charts-kpi--overview'],
    ]),
};
