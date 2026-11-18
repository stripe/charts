import type {Meta, StoryObj} from '@storybook/html';
import {chart, cleanUpCharts} from './support/mount';
import {orderSpec} from './support/specs';

const meta: Meta = {title: 'Intro', beforeEach: cleanUpCharts};
export default meta;

export const GettingStarted: StoryObj = {
  name: 'Intro',
  parameters: {viewToggle: false},
  render: () => {
    const page = document.createElement('div');
    page.append(chart(orderSpec, {width: '100%', height: 320}));
    return page;
  },
};
