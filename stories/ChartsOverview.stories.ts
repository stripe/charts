import type {Meta, StoryObj} from '@storybook/html';
import type {ChartSpec} from '../src/index';
import {chart, cleanUpCharts} from './support/mount';
import {orderSpec} from './support/specs';

const meta: Meta = {
  parameters: {viewToggle: false, codePanel: false},
  title: 'Charts',
  beforeEach: cleanUpCharts,
};
export default meta;

export const Overview: StoryObj = {
  render: () => {
    const gallery = document.createElement('div');
    Object.assign(gallery.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
      gap: '32px',
      alignItems: 'start',
    });
    const examples: [string, string, ChartSpec][] = [
      ['Line', 'charts-line--overview', {...orderSpec, chart: {type: 'line'}}],
      ['Bar', 'charts-bar--overview', {...orderSpec, chart: {type: 'bar'}}],
      [
        'KPI',
        'charts-kpi--overview',
        {...orderSpec, chart: {type: 'kpi'}, kpi: {value: 360, basis: 'total'}},
      ],
    ];
    for (const [label, id, spec] of examples) {
      const section = document.createElement('section');
      section.style.minWidth = '0';
      const heading = document.createElement('h2');
      heading.style.cssText = 'font-size:16px;font-weight:500;margin:0 0 16px';
      const link = document.createElement('a');
      link.textContent = label;
      link.href = `./?path=/story/${id}`;
      link.target = '_top';
      heading.appendChild(link);
      section.append(heading, chart(spec, {width: '100%', height: 320}));
      gallery.appendChild(section);
    }
    return gallery;
  },
};
