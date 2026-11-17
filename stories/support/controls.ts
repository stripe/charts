import {buildJavaScript, buildSnippet} from '../../.storybook/code';
import {codeView} from '../../.storybook/codeView';
import {chart, track} from './mount';
import type {ChartSpec} from '../../src/index';
import {render, SpecError} from '../../src/index';

/** Named controls choose complete, valid specs; code follows the selected spec. */
export function chooseSpec(
  label: string,
  choices: Readonly<Record<string, unknown>>,
): HTMLElement {
  const entries = Object.entries(choices);
  const first = entries[0];
  if (!first) throw new Error('A spec selector needs at least one option');
  const page = document.createElement('div');
  page.dataset.inlineCode = 'true';
  const controls = document.createElement('div');
  controls.className = 'sc-example-controls';
  const field = document.createElement('label');
  field.appendChild(document.createTextNode(label));
  const select = document.createElement('select');
  for (const [name] of entries) {
    const option = document.createElement('option');
    option.textContent = name;
    option.value = name;
    select.appendChild(option);
  }
  field.appendChild(select);
  controls.appendChild(field);
  const host = document.createElement('div');
  host.style.height = '320px';
  host.style.width = '100%';
  const code = document.createElement('div');
  let current: ReturnType<typeof render> | undefined;
  const show = (): void => {
    current?.destroy();
    const spec = choices[select.value];
    try {
      current = track(render(host, spec));
    } catch (error) {
      // Error examples retain their card and expose the same downloadable spec.
      if (!(error instanceof SpecError)) throw error;
      current = error.chart;
      if (current) track(current);
    }
    const records = [{spec, width: '100%', height: 320}];
    code.replaceChildren(
      codeView(buildJavaScript(records), buildSnippet(records), true),
    );
  };
  select.addEventListener('change', show);
  show();
  page.append(controls, host, code);
  return page;
}

/** A single chart used on a guide page. */
export function guideChart(spec: ChartSpec): HTMLElement {
  // Chart recording keeps the shared guide's JavaScript in sync with the plot.
  return chart(spec, {width: '100%', height: 320});
}
