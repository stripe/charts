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
    const installation = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Use in your app';
    const text = document.createElement('p');
    text.textContent =
      'Until the npm package is published, install a local build for JavaScript, TypeScript, or React.';
    const commands = document.createElement('pre');
    commands.textContent =
      'git clone https://github.com/stripe/charts.git\ncd charts\nnpm ci\nnpm pack\n\n# In your application:\nnpm install /path/to/charts/stripe-charts-0.0.1.tgz';
    commands.style.whiteSpace = 'pre-wrap';
    installation.append(summary, text, commands);
    page.append(chart(orderSpec, {width: '100%', height: 320}), installation);
    return page;
  },
};
