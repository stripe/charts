import type {Meta, StoryObj} from '@storybook/html';
import type {ChartSpec} from '../src/index';
import {curve, dates, points} from './support/data';
import {chart, cleanUpCharts} from './support/mount';
import {orderSpec, orderTotal} from './support/specs';

const meta: Meta = {
  parameters: {viewToggle: false, codePanel: false},
  title: 'Charts',
  beforeEach: cleanUpCharts,
};
export default meta;

const days = dates('2026-10-01', 31);
const lineSpec: ChartSpec = {
  title: 'Orders by channel',
  chart: {type: 'line', legend: 'show'},
  series: [
    {
      label: 'Online',
      data: points(days, curve(days.length, 180, 320, {jitter: 0.4, seed: 11})),
    },
    {
      label: 'In store',
      data: points(
        days,
        curve(days.length, 140, 210, {bend: 0.7, jitter: 0.7, seed: 29}),
      ),
    },
    {
      label: 'Marketplace',
      data: points(
        days,
        curve(days.length, 60, 170, {bend: 1.6, jitter: 0.4, seed: 47}),
      ),
    },
  ],
};

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
      ['Line', 'charts-line--overview', lineSpec],
      ['Bar', 'charts-bar--overview', {...orderSpec, chart: {type: 'bar'}}],
      [
        'KPI',
        'charts-kpi--overview',
        {
          ...orderSpec,
          chart: {type: 'kpi'},
          kpi: {value: orderTotal, basis: 'total'},
        },
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
