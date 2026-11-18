import type {ChartSpec} from '../../src/index';
import {buildCodeExamples} from '../../.storybook/code';
import {codeView} from '../../.storybook/codeView';
import {chart} from './mount';

/** A short, scrollable set of examples with matching code alongside each chart. */
export function chartExamples(
  examples: readonly {title: string; spec: ChartSpec}[],
): HTMLElement {
  const page = document.createElement('div');
  Object.assign(page.style, {display: 'grid', gap: '32px'});
  for (const {title, spec} of examples) {
    const section = document.createElement('section');
    section.setAttribute('aria-label', title);
    const heading = document.createElement('h2');
    heading.textContent = title;
    heading.style.cssText = 'font-size:16px;margin:0 0 8px';
    const row = document.createElement('div');
    row.className = 'sc-guide-demo';
    row.style.marginTop = '0';
    const canvas = document.createElement('div');
    canvas.className = 'sc-guide-canvas';
    const size = {
      width: '100%',
      height: spec.chart?.type === 'kpi' ? 160 : 320,
    };
    canvas.append(chart(spec, size));
    row.append(canvas, codeView(buildCodeExamples([{spec, ...size}]), true));
    section.append(heading, row);
    page.append(section);
  }
  return page;
}
