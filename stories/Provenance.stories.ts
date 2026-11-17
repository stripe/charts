import type {Meta, StoryObj} from '@storybook/html';
import {cleanUpCharts} from './support/mount';
import {guideChart} from './support/controls';
import {moneySpec} from './support/specs';

const meta: Meta = {title: 'Features/Provenance', beforeEach: cleanUpCharts};
export default meta;
export const Overview: StoryObj = {
  render: () =>
    guideChart({
      ...moneySpec,
      timeZone: 'America/New_York',
      provenance: {
        source: 'Example payments report',
        fetchedAt: '2026-11-30T12:00:00Z',
        details: [
          {label: 'Period', value: 'Nov 27–29, 2026'},
          {label: 'Includes', value: 'Successful payments'},
          {label: 'Excludes', value: 'Refunds'},
        ],
      },
    }),
};
