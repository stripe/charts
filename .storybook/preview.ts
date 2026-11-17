import type {Decorator, Preview} from '@storybook/html';
import {UPDATE_GLOBALS} from 'storybook/internal/core-events';
import {addons} from 'storybook/preview-api';

import {cleanUpCharts} from '../stories/support/mount';
import {guideFor} from '../stories/support/guides';
import {guidePage} from '../stories/support/guidePage';
import {buildCodeExamples, takeRecords} from './code';
import {codeView, viewToggle} from './codeView';
import {VIEW_GLOBAL, DEFAULT_VIEW, viewOf} from './view';

/**
 * Chart / Code view for every story. The story always renders, so its charts
 * record their specs; in code mode they are destroyed again and the frame
 * shows the rendering code built from those specs instead. Each render first
 * destroys the previous render's charts, so toggling never leaks. The
 * "screenshot" view shows the story without the toggle.
 */
const withView: Decorator = (storyFn, context) => {
  cleanUpCharts()();
  takeRecords();
  const story = storyFn();
  const records = takeRecords();
  const view = viewOf(context.globals);
  const snippet =
    records.length > 0
      ? buildCodeExamples(records, context.title === 'Intro')
      : null;
  if (view === 'screenshot' || typeof story === 'string') {
    return story;
  }
  const guide = guideFor(context.title);
  const section = context.title.split('/').at(-1) ?? context.title;
  const isOverview = context.name === 'Overview' || context.name === section;
  if (guide && (view !== 'code' || context.parameters.viewToggle === false))
    return guidePage(
      isOverview ? section : `${section} / ${context.name}`,
      guide,
      story,
      context.parameters.codePanel === false ? null : snippet,
      context.title === 'Intro' || isOverview,
    );
  if (snippet === null)
    return guide ? guidePage(context.title, guide, story, null) : story;
  const code = view === 'code';
  const toggle = viewToggle(code, () =>
    addons.getChannel().emit(UPDATE_GLOBALS, {
      globals: {[VIEW_GLOBAL]: code ? 'chart' : 'code'},
    }),
  );
  const frame = document.createElement('div');
  if (code) {
    cleanUpCharts()();
    frame.append(codeView(snippet), toggle);
  } else {
    frame.append(story, toggle);
  }
  return frame;
};

// Viewport names match the sizes shot stories use (see shots.ts).
const preview: Preview = {
  decorators: [withView],
  // Set by the toolbar toggle (manager.ts); no menu of its own.
  initialGlobals: {[VIEW_GLOBAL]: DEFAULT_VIEW},
  parameters: {
    layout: 'fullscreen',
    options: {
      storySort: {
        order: [
          'Intro',
          'Charts',
          ['Overview', 'Line', 'Bar', 'KPI'],
          'Features',
          [
            'Overview',
            'Money and units',
            'Dates and time zones',
            'Comparisons',
            'Provenance',
            'Validation',
            'Axes',
            'Legend',
            'Annotations',
            'Forecast',
            'Details',
            'States',
          ],
          'Examples',
          ['Overview', 'Reporting', 'Dashboard', 'API', 'Options'],
        ],
      },
    },
    viewport: {
      options: {
        '800-500': {
          name: '800 x 500',
          styles: {width: '800px', height: '500px'},
        },
        '800-600': {
          name: '800 x 600',
          styles: {width: '800px', height: '600px'},
        },
        '800-640': {
          name: '800 x 640',
          styles: {width: '800px', height: '640px'},
        },
        '360-500': {
          name: '360 x 500 (narrow)',
          styles: {width: '360px', height: '500px'},
        },
      },
    },
  },
};

export default preview;
