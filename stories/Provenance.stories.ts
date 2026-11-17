import type {Meta, StoryObj} from '@storybook/html';
import {cleanUpCharts} from './support/mount';
import {guideChart} from './support/controls';
import {moneySpec} from './support/specs';

const meta: Meta = {title: 'Features/Provenance', beforeEach: cleanUpCharts};
export default meta;
export const Overview: StoryObj = {
  name: 'Provenance',
  render: () =>
    guideChart({
      ...moneySpec,
      timeZone: 'America/New_York',
      provenance: {
        source: 'Example payments report',
        fetchedAt: '2026-12-01T12:00:00Z',
        details: [
          {label: 'Period', value: 'Nov 1–30, 2026'},
          {label: 'Includes', value: 'Successful payments'},
          {label: 'Excludes', value: 'Refunds'},
        ],
      },
    }),
};
