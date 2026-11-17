import type {Meta, StoryObj} from '@storybook/html';
import {storyLinks} from './support/guidePage';

const meta: Meta = {parameters: {viewToggle: false}, title: 'Examples'};
export default meta;

export const Overview: StoryObj = {
  render: () =>
    storyLinks([
      ['Gross volume', 'examples-reporting--gross-volume'],
      ['Orders', 'examples-reporting--orders'],
      ['Dashboard', 'examples-dashboard--overview'],
      ['Update and destroy', 'examples-api--update-and-destroy'],
      ['Custom options', 'examples-options--custom-tooltip'],
    ]),
};
