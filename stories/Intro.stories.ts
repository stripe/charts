import type {Meta, StoryObj} from '@storybook/html';
import {chart, cleanUpCharts} from './support/mount';
import {orderSpec} from './support/specs';
import {storyLinks} from './support/guidePage';

const meta: Meta = {title: 'Intro', beforeEach: cleanUpCharts};
export default meta;

export const GettingStarted: StoryObj = {
  render: () => chart(orderSpec, {width: '100%', height: 320}),
};

export const UsingInYourApp: StoryObj = {
  parameters: {viewToggle: false},
  render: () => {
    const page = document.createElement('div');
    const text = document.createElement('p');
    text.textContent =
      'Build a local package for JavaScript, TypeScript, or React. npm pack produces stripe-charts-0.0.1.tgz; install that file in your application until the package is published.';
    const commands = document.createElement('pre');
    commands.textContent =
      'git clone https://github.com/stripe/charts.git\ncd charts\nnpm ci\nnpm pack\n\n# In your application:\nnpm install /path/to/charts/stripe-charts-0.0.1.tgz';
    commands.style.whiteSpace = 'pre-wrap';
    const links = storyLinks([
      ['JavaScript lifecycle', 'examples-api--update-and-destroy'],
      ['React component', 'react-stripechart--basic'],
      ['Start a report', 'examples-reporting--gross-volume'],
    ]);
    page.append(text, commands, links);
    return page;
  },
};
