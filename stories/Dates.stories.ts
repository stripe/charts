import type {Meta, StoryObj} from '@storybook/html';
import {cleanUpCharts} from './support/mount';
import {chooseSpec} from './support/controls';

const meta: Meta = {
  parameters: {viewToggle: false},
  title: 'Features/Dates and time zones',
  beforeEach: cleanUpCharts,
};
export default meta;
export const Overview: StoryObj = {
  name: 'Dates and time zones',
  render: () =>
    chooseSpec(
      'Reporting zone',
      Object.fromEntries(
        ['UTC', 'America/New_York', 'Asia/Tokyo'].map((timeZone) => [
          timeZone,
          {
            title: 'Orders around midnight',
            timeZone,
            series: [
              {
                label: 'Orders',
                data: [
                  {x: '2026-11-28T00:00:00Z', y: 120},
                  {x: '2026-11-28T01:00:00Z', y: 95},
                  {x: '2026-11-28T02:00:00Z', y: 145},
                ],
              },
            ],
          },
        ]),
      ),
    ),
};
