import type {Meta, StoryObj} from '@storybook/html';
import {cleanUpCharts} from './support/mount';
import {curve} from './support/data';
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
            version: 1,
            title: 'Orders around midnight',
            timeZone,
            series: [
              {
                label: 'Orders',
                data: curve(48, 120, 220, {jitter: 0.65, seed: 19}).map(
                  (y, index) => ({
                    x: new Date(
                      Date.parse('2026-11-27T12:00:00Z') +
                        index * 60 * 60 * 1000,
                    ).toISOString(),
                    y,
                  }),
                ),
              },
            ],
          },
        ]),
      ),
    ),
};
