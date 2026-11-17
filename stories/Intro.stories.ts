import type {Meta, StoryObj} from '@storybook/html';

import {PACKAGE_NAME} from '../src/meta';
import {cleanUpCharts} from './support/mount';

const meta: Meta = {
  title: 'Intro',
  beforeEach: cleanUpCharts,
};

export default meta;

export const GettingStarted: StoryObj = {
  render: () => {
    const page = document.createElement('main');
    Object.assign(page.style, {
      maxWidth: '720px',
      margin: '32px auto',
      padding: '0 16px',
      font: '16px/1.6 system-ui, sans-serif',
      color: '#1A2C44',
    });
    const heading = document.createElement('h1');
    heading.textContent = PACKAGE_NAME;
    const introduction = document.createElement('p');
    introduction.textContent =
      'Time-series charts and KPI cards from a declarative JSON spec. Use the standalone browser script, import the JavaScript API, or render the optional React component.';
    const browse = document.createElement('h2');
    browse.textContent = 'Explore the library';
    const sections = document.createElement('ul');
    for (const [label, story, description] of [
      ['Charts', 'charts-line--with-kpi', 'Line, bar, and KPI charts.'],
      [
        'Features',
        'features-annotations--point-annotation',
        'Annotations, axes, legends, forecasts, details, and loading or empty states.',
      ],
      [
        'React',
        'react-stripechart--basic',
        'The StripeChart component, state updates, error handling, events, and custom tooltips.',
      ],
      [
        'Examples',
        'examples-dashboard--overview',
        'Complete dashboards, Black Friday reports, and interactive API examples.',
      ],
    ]) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.textContent = label;
      link.href = `./?path=/story/${story}`;
      link.target = '_top';
      item.append(link, document.createTextNode(` — ${description}`));
      sections.appendChild(item);
    }
    const code = document.createElement('p');
    code.textContent =
      'Use Chart / Code in any chart story to see and copy its example. Hover a chart to inspect values, or focus it and use the arrow keys. Press Escape to dismiss the tooltip.';
    const development = document.createElement('h2');
    development.textContent = 'Run locally';
    const commands = document.createElement('pre');
    commands.textContent = 'npm ci\nnpm run storybook';
    Object.assign(commands.style, {
      padding: '16px',
      background: '#F4F7FA',
      borderRadius: '8px',
      overflowX: 'auto',
    });
    const build = document.createElement('p');
    build.textContent =
      'Use Node.js 22.12 or newer. Run npm run build:all to build the package, or npm run storybook:build to create the static gallery.';
    page.append(
      heading,
      introduction,
      browse,
      sections,
      code,
      development,
      commands,
      build,
    );
    return page;
  },
};
