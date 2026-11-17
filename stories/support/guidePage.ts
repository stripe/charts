import {codeView} from '../../.storybook/codeView';
import type {Guide} from './guides';

function text<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  value: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = value;
  return element;
}

/** A readable guide around the exact story and the code generated from it. */
export function guidePage(
  title: string,
  guide: Guide,
  story: Node,
  snippet: string | null,
  showIntroduction = false,
): HTMLElement {
  const page = document.createElement('article');
  page.className = 'sc-guide';
  const style = document.createElement('style');
  style.textContent = `
    .sc-guide{box-sizing:border-box;width:100%;margin:0;padding:24px;color:#1a2c44;font:14px/1.6 system-ui,sans-serif}
    .sc-guide>h1{font-size:20px;font-weight:600;line-height:1.3;margin:0 0 24px}.sc-guide>h2{font-size:16px;margin:24px 0 12px}
    .sc-guide>p{max-width:720px}.sc-guide a{color:#635bff}
    .sc-guide-demo{display:grid;grid-template-columns:minmax(0,1fr);gap:24px;align-items:start;margin-top:20px}
    @media(min-width:1000px){.sc-guide-demo:has(>[data-sb-code]){grid-template-columns:minmax(560px,1.4fr) minmax(300px,1fr)}}
    .sc-guide-canvas{min-width:0;overflow:auto;padding:4px}.sc-guide-canvas>div{max-width:100%}
    .sc-guide-fields{overflow:auto}.sc-guide-fields table{border-collapse:collapse;width:100%;text-align:left}
    .sc-guide-fields th,.sc-guide-fields td{padding:10px 12px;border-bottom:1px solid #d4dee9;vertical-align:top}
    .sc-guide-fields th{background:#f4f7fa}.sc-guide-fields td:first-child{font-family:ui-monospace,monospace}
    .sc-guide details{margin-top:24px;border-top:1px solid #ecf1f6;padding-top:12px}.sc-guide summary{cursor:pointer;color:#50617a}
    .sc-example-controls{display:flex;gap:16px;flex-wrap:wrap;margin:0 0 16px;font:14px/1.6 system-ui,sans-serif}
    .sc-example-controls label{display:flex;align-items:center;gap:8px}.sc-example-controls select{font:inherit;padding:4px 8px}
  `;
  page.append(style, text('h1', title));
  if (showIntroduction) page.appendChild(text('p', guide.lead));
  const demo = document.createElement('div');
  demo.className = 'sc-guide-demo';
  const canvas = document.createElement('section');
  canvas.className = 'sc-guide-canvas';
  canvas.setAttribute('aria-label', 'Interactive example');
  canvas.appendChild(story);
  demo.appendChild(canvas);
  if (snippet) demo.appendChild(codeView(snippet, true));
  page.appendChild(demo);
  if (guide.fields?.length) {
    const details = document.createElement('details');
    details.appendChild(text('summary', 'Options'));
    const table = document.createElement('table');
    const head = document.createElement('thead');
    const row = document.createElement('tr');
    for (const name of ['Field', 'Default', 'How to use it']) {
      const cell = text('th', name);
      cell.scope = 'col';
      row.appendChild(cell);
    }
    head.appendChild(row);
    const body = document.createElement('tbody');
    for (const fields of guide.fields) {
      const tr = document.createElement('tr');
      for (const field of fields) tr.appendChild(text('td', field));
      body.appendChild(tr);
    }
    table.append(head, body);
    const wrapper = document.createElement('div');
    wrapper.className = 'sc-guide-fields';
    wrapper.appendChild(table);
    details.appendChild(wrapper);
    page.appendChild(details);
  }
  return page;
}

export function storyLinks(
  links: readonly (readonly [label: string, id: string])[],
): HTMLElement {
  const list = document.createElement('ul');
  for (const [label, id] of links) {
    const item = document.createElement('li');
    const link = text('a', label);
    link.href = `./?path=/story/${id}`;
    link.target = '_top';
    item.appendChild(link);
    list.appendChild(item);
  }
  return list;
}
