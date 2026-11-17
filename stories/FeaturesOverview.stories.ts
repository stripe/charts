import type {Meta, StoryObj} from '@storybook/html';
import {storyLinks} from './support/guidePage';

const meta: Meta = {parameters: {viewToggle: false}, title: 'Features'};
export default meta;

export const Overview: StoryObj = {
  render: () =>
    storyLinks([
      ['Money and units', 'features-money-and-units--overview'],
      ['Dates and time zones', 'features-dates-and-time-zones--overview'],
      ['Comparisons', 'features-comparisons--overview'],
      ['Provenance', 'features-provenance--overview'],
      ['Validation', 'features-validation--overview'],
      ['Annotations', 'features-annotations--point-annotation'],
      ['Axes', 'features-axes--overview'],
      ['Legend', 'features-legend--interactive'],
      ['Forecast', 'features-forecast--line-with-band'],
      ['Details', 'features-details--open'],
      ['States', 'features-states--loading'],
    ]),
};
