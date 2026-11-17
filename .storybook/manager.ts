// The toolbar's Chart / Code toggle. Storybook maps `react` in manager files
// to the manager's own copy at runtime. It flips the shared `view` global, so
// the choice applies to every story and persists while you switch stories.

import {createElement} from 'react';
import type {ReactElement} from 'react';
import {ToggleButton} from 'storybook/internal/components';
import {addons, types, useGlobals, useParameter} from 'storybook/manager-api';

import {VIEW_GLOBAL, viewOf} from './view';

const ADDON_ID = 'stripe-charts/view';
const TOOL_ID = `${ADDON_ID}/toggle`;

/** A 14px outline icon: bars for the chart, angle brackets for code. */
function icon(code: boolean): ReactElement {
  const path = code
    ? 'M5 4 1 8l4 4M11 4l4 4-4 4'
    : 'M2 14V9M6 14V5M10 14V7M14 14V2';
  return createElement(
    'svg',
    {
      width: 14,
      height: 14,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.6,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
    },
    createElement('path', {d: path}),
  );
}

function ViewToggle(): ReactElement | null {
  const [globals, updateGlobals] = useGlobals();
  const enabled = useParameter('viewToggle', true);
  if (!enabled) return null;
  const code = viewOf(globals) === 'code';
  return createElement(
    ToggleButton,
    {
      pressed: code,
      ariaLabel: false,
      tooltip: code ? 'Show the chart' : 'Show the code for this chart',
      onClick: () => updateGlobals({[VIEW_GLOBAL]: code ? 'chart' : 'code'}),
    },
    icon(code),
    code ? 'Code' : 'Chart',
  );
}

addons.register(ADDON_ID, () => {
  addons.add(TOOL_ID, {
    type: types.TOOL,
    title: 'Chart / Code',
    match: ({viewMode}: {viewMode?: string}) => viewMode === 'story',
    render: () => createElement(ViewToggle, null),
  });
});
