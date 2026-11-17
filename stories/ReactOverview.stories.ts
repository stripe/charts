import type {Meta, StoryObj} from '@storybook/html';
import {storyLinks} from './support/guidePage';

const meta: Meta = {parameters: {viewToggle: false}, title: 'React'};
export default meta;

export const Overview: StoryObj = {
  render: () =>
    storyLinks([
      ['Basic component', 'react-stripechart--basic'],
      ['Live updates', 'react-stripechart--live-update'],
      ['Invalid input', 'react-stripechart--invalid-spec'],
      [
        'Events and custom tooltips',
        'react-stripechart--events-and-custom-tooltip',
      ],
    ]),
};
