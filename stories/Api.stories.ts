import type {Meta, StoryObj} from '@storybook/html';

import {recordChart} from '../.storybook/code';
import grossVolume from '../examples/bfcm-gross-volume.json';
import {render, SpecError} from '../src/index';
import {
  COLUMN_WIDTH,
  cleanUpCharts,
  column,
  stack,
  track,
} from './support/mount';

const HEIGHT = 400;
const GAP = 16;

const meta: Meta = {
  title: 'Examples/API',
  beforeEach: cleanUpCharts,
};

export default meta;

function button(label: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.style.marginRight = '8px';
  element.addEventListener('click', onClick);
  return element;
}

/** The specs the {@link UpdateAndDestroy} buttons switch between. */
const specs = {
  line: {...grossVolume, chart: {type: 'line'}},
  bar: {...grossVolume, chart: {type: 'bar'}},
  kpi: {...grossVolume, chart: {type: 'kpi'}},
  invalid: {...grossVolume, chart: {type: 'pie'}},
};

/**
 * `render` returns a handle. `update(spec)` redraws in place, an invalid
 * spec shows its issues and throws `SpecError`, and `destroy()` removes
 * everything the chart added.
 */
export const UpdateAndDestroy: StoryObj = {
  render: () => {
    const element = document.createElement('div');
    element.style.width = `${COLUMN_WIDTH}px`;
    element.style.height = `${HEIGHT}px`;
    const status = document.createElement('p');
    let handle = track(render(element, grossVolume));
    recordChart({
      spec: grossVolume,
      width: COLUMN_WIDTH,
      height: HEIGHT,
      steps: [
        {kind: 'update-button', label: 'Line', spec: specs.line},
        {kind: 'update-button', label: 'Bar', spec: specs.bar},
        {kind: 'update-button', label: 'KPI only', spec: specs.kpi},
        {kind: 'update-button', label: 'Invalid spec', spec: specs.invalid},
        {kind: 'destroy-button', label: 'Destroy'},
      ],
    });

    const update = (spec: unknown): void => {
      try {
        handle.update(spec);
        status.textContent = '';
      } catch (error) {
        if (!(error instanceof SpecError)) throw error;
        status.textContent = `SpecError with ${error.errors.length} issue(s)`;
      }
    };

    const controls = document.createElement('div');
    controls.append(
      button('Line', () => update(specs.line)),
      button('Bar', () => update(specs.bar)),
      button('KPI only', () => update(specs.kpi)),
      button('Invalid spec', () =>
        update({...grossVolume, chart: {type: 'pie'}}),
      ),
      button('Destroy', () => {
        handle.destroy();
        status.textContent = `Destroyed; the element has ${element.childNodes.length} child nodes.`;
      }),
      button('Render again', () => {
        handle.destroy();
        handle = track(render(element, grossVolume));
        status.textContent = '';
      }),
    );
    return column(stack(GAP, controls, status, element));
  },
};

/** The gross volume spec with every 2026 value scaled, the same shape. */
function revised(factor: number): unknown {
  const [current, ...rest] = grossVolume.series;
  if (current === undefined) return grossVolume;
  return {
    ...grossVolume,
    description: 'Thanksgiving through Cyber Monday, revised forecast',
    kpi: {
      ...grossVolume.kpi,
      basis: 'custom',
      value: grossVolume.kpi.value * factor,
    },
    series: [
      {
        ...current,
        data: current.data.map((point, i) => ({
          ...point,
          y: Math.round(point.y * (factor + (i % 2 === 0 ? 0.08 : -0.06))),
        })),
      },
      ...rest,
    ],
  };
}

const REVISION_FACTOR = 1.18;

/**
 * An `update` with the same shape (chart type, slots and series) tweens the
 * values and the y axis instead of redrawing. Toggle between the two
 * datasets to see it; with reduced motion the change is immediate.
 */
export const Tween: StoryObj = {
  render: () => {
    const element = document.createElement('div');
    element.style.width = `${COLUMN_WIDTH}px`;
    element.style.height = `${HEIGHT}px`;
    const handle = track(render(element, grossVolume));
    recordChart({
      spec: grossVolume,
      width: COLUMN_WIDTH,
      height: HEIGHT,
      steps: [
        {
          kind: 'update-button',
          label: 'Revised',
          spec: revised(REVISION_FACTOR),
        },
        {kind: 'update-button', label: 'Original', spec: grossVolume},
      ],
    });
    let showingRevision = false;
    const toggle = button('Toggle dataset', () => {
      showingRevision = !showingRevision;
      handle.update(showingRevision ? revised(REVISION_FACTOR) : grossVolume);
    });
    return column(stack(GAP, toggle, element));
  },
};
