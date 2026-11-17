import type {Meta, StoryObj} from '@storybook/html';

import type {AxisCase} from '../src/layout/testing/corpus';
import {xAxisCases, yAxisCases} from '../src/layout/testing/corpus';
import {caption, chart, cleanUpCharts} from './support/mount';

// A gallery of axis labels over the generated corpus that the axis property
// test checks: time spans at several widths, value ranges in every format,
// and the time zone and locale cases that are easiest to get wrong. Each
// cell is captioned with its case name so a screenshot can be traced back.

const meta: Meta = {
  title: 'Features/Axes',
  beforeEach: cleanUpCharts,
};

export default meta;

const CELL_GAP = 24;
const HEADER_HEIGHT = 40;
const PLOT_HEIGHT = 200;

function cell(axisCase: AxisCase): HTMLElement {
  const label = axisCase.name.replace(/^[xy] \| /u, '');
  return caption(
    label,
    chart(axisCase.spec, {
      width: axisCase.width,
      height: axisCase.height + HEADER_HEIGHT,
    }),
  );
}

/**
 * Cells at their own widths, wrapping onto new lines so the gallery fits the
 * viewport. Only the 1200 and 1600px cells are wider than a laptop screen.
 */
function gallery(cases: readonly AxisCase[]): HTMLElement {
  const element = document.createElement('div');
  element.style.display = 'flex';
  element.style.flexWrap = 'wrap';
  element.style.gap = `${CELL_GAP}px`;
  element.style.alignItems = 'flex-start';
  element.append(...cases.map(cell));
  return element;
}

/** Cases whose name has every one of `parts` as a ` | `-separated field. */
function pick(cases: readonly AxisCase[], ...parts: string[]): AxisCase[] {
  return cases.filter((c) => {
    const fields = c.name.split(' | ');
    return parts.every((part) => fields.includes(part));
  });
}

const withHeight = (cases: AxisCase[], height: number): AxisCase[] =>
  cases.map((c) => ({...c, height}));

const NARROW_WIDTHS = ['w280', 'w360', 'w540', 'w800'];
const WIDE_WIDTHS = ['w1200', 'w1600'];

/** Every span in UTC as calendar dates (date-times for sub-daily data), 280 to 800px. */
export const TimeSpans: StoryObj = {
  render: () => {
    const all = xAxisCases();
    const cases = pick(all, 'UTC', 'en-US', 'line').filter(
      (c) =>
        NARROW_WIDTHS.some((w) => c.name.endsWith(w)) &&
        (c.name.includes('| date |') ||
          !all.some((o) => o.name === c.name.replace('dateTime', 'date'))),
    );
    return gallery(withHeight(cases, PLOT_HEIGHT));
  },
};

/** Long and short spans on wide plots, where label density matters most. */
export const WideSpans: StoryObj = {
  render: () => {
    const all = xAxisCases();
    const spans = [
      '1 day hourly',
      'BFCM 5 days hourly',
      '2 weeks daily',
      '90 days daily',
      '5 years quarterly',
    ];
    const cases = spans.flatMap((span) =>
      WIDE_WIDTHS.flatMap((width) =>
        pick(all, span, 'UTC', 'en-US', 'line', width).slice(0, 1),
      ),
    );
    return gallery(withHeight(cases, PLOT_HEIGHT));
  },
};

/**
 * Date-times in zones away from UTC, DST transition days, and non-English
 * locales: where labels shift a day or lose a month if a zone is ignored.
 */
export const ZonesAndLocales: StoryObj = {
  render: () => {
    const all = xAxisCases();
    const picks: string[][] = [
      ['12 months monthly', 'dateTime', 'America/Los_Angeles', 'en-US', 'line'],
      ['5 years quarterly', 'dateTime', 'Asia/Kolkata', 'en-US', 'bar'],
      ['30 days daily', 'dateTime', 'America/Los_Angeles', 'de-DE', 'line'],
      ['across new year daily', 'date', 'UTC', 'ja-JP', 'bar'],
      ['24 months monthly', 'date', 'UTC', 'de-DE', 'line'],
      ['BFCM 5 days hourly', 'dateTime', 'Asia/Kolkata', 'ja-JP', 'bar'],
      ['DST start hourly', 'America/New_York', 'en-US', 'line'],
      ['DST end hourly', 'America/New_York', 'en-US', 'line'],
      ['DST start hourly', 'Europe/London', 'de-DE', 'bar'],
      ['DST end hourly', 'Europe/London', 'ja-JP', 'line'],
    ];
    const cases = picks.flatMap((parts) =>
      ['w280', 'w540'].flatMap((width) =>
        pick(all, ...parts, width).slice(0, 1),
      ),
    );
    return gallery(withHeight(cases, PLOT_HEIGHT));
  },
};

/** Every value range in each of its formats, tile to default heights, en-US. */
export const ValueRanges: StoryObj = {
  render: () => {
    const cases = pick(yAxisCases(), 'en-US').filter(
      (c) =>
        c.name.endsWith('h100') ||
        c.name.endsWith('h140') ||
        c.name.endsWith('h240'),
    );
    return gallery(cases.map((c) => ({...c, width: 360})));
  },
};

/** The same value ranges formatted for German and Japanese readers. */
export const ValueLocales: StoryObj = {
  render: () => {
    const all = yAxisCases();
    const sets = [
      'near-flat large',
      'huge',
      'mixed sign',
      'tiny',
      'mixed sign ratio',
    ];
    const cases = sets.flatMap((set) =>
      ['de-DE', 'ja-JP'].flatMap((locale) =>
        pick(all, set, locale, 'h240').filter(
          (c) => !c.name.includes('| number |'),
        ),
      ),
    );
    return gallery(cases.map((c) => ({...c, width: 360})));
  },
};

/** Stacked bars with negative stacks, where the scale must reach below 0. */
export const StackedRanges: StoryObj = {
  render: () => {
    const cases = pick(yAxisCases(), 'stacked', 'en-US').filter(
      (c) => !c.name.includes('| number |'),
    );
    return gallery(cases.map((c) => ({...c, width: 360})));
  },
};
