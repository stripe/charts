const {cleanUpCharts} = require('../stories/support/mount');
const {takeRecords} = require('../.storybook/code');
const {guidePage} = require('../stories/support/guidePage');
const {Overview: Units} = require('../stories/Money.stories');
const {Overview: Validation} = require('../stories/Validation.stories');
const {Overview: Charts} = require('../stories/ChartsOverview.stories');

afterEach(() => {
  cleanUpCharts()();
  takeRecords();
  document.body.replaceChildren();
});

test('changing units keeps the rendered chart and copyable code in sync', () => {
  const page = Units.render();
  document.body.appendChild(page);
  const select = page.querySelector('select');
  expect(
    page.querySelector('.sc-guide-demo > .sc-guide-canvas .sc-root'),
  ).not.toBeNull();
  expect(
    page.querySelector('.sc-guide-demo > .sc-example-code [data-sb-code]'),
  ).not.toBeNull();
  expect(
    page.querySelector('[data-sb-code] [role="tabpanel"]').textContent,
  ).toContain('<StripeChart');
  page.querySelector('[data-language="javascript"]').click();
  expect(
    page.querySelector('[data-sb-code] [role="tabpanel"]').textContent,
  ).not.toContain('<html');
  expect(
    page.querySelector('[data-sb-code] [role="tabpanel"]').textContent,
  ).toContain('"unit": "minor"');
  expect(page.querySelector('[id$="-summary"]').textContent).toContain('$0.95');
  select.value = 'USD · major units';
  select.dispatchEvent(new Event('change'));
  expect(
    page.querySelector('[data-sb-code] [role="tabpanel"]').textContent,
  ).toContain('"unit": "major"');
  expect(page.querySelector('[id$="-summary"]').textContent).toContain(
    '$95.00',
  );
  expect(page.querySelectorAll('.sc-root')).toHaveLength(1);
  expect(page.querySelector('[aria-selected="true"]').textContent).toBe(
    'JavaScript',
  );
  page.querySelector('[data-language="react"]').click();
  expect(
    page.querySelector('[data-sb-code] [role="tabpanel"]').textContent,
  ).toContain('"unit": "major"');
});

test('the validation guide can recover from the deliberately invalid example', () => {
  const page = Validation.render();
  document.body.appendChild(page);
  expect(page.textContent).toContain('format.unit');
  const select = page.querySelector('select');
  select.value = 'Corrected spec';
  select.dispatchEvent(new Event('change'));
  expect(page.querySelector('.sc-error')).toBeNull();
  expect(page.querySelector('.sc-plot-area')).not.toBeNull();
  expect(
    page.querySelector('[data-sb-code] [role="tabpanel"]').textContent,
  ).toContain('"unit": "minor"');
});

test('the landing page pairs Line, Bar, and KPI with their own code', () => {
  const story = Charts.render();
  const records = takeRecords();
  expect(records).toHaveLength(3);
  document.body.append(guidePage('Charts', story, null));
  const rows = [...story.querySelectorAll('section[aria-label$="example"]')];
  expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
    'Line example',
    'Bar example',
    'KPI example',
  ]);
  rows.forEach((row, index) => {
    expect(row.querySelectorAll('.sc-root')).toHaveLength(1);
    expect(row.querySelectorAll('[data-sb-code]')).toHaveLength(1);
    const panel = row.querySelector('[role="tabpanel"]');
    expect(panel.textContent).toContain(
      `"type": "${['line', 'bar', 'kpi'][index]}"`,
    );
    expect(
      [...row.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent),
    ).toEqual(['React', 'HTML']);
    row.querySelector('[data-language="javascript"]').click();
    expect(panel.textContent).toContain(
      'http://localhost/dist/stripe-charts.min.js',
    );
    expect(panel.textContent).not.toContain('cdn.jsdelivr.net');
    expect(panel.textContent).toContain(records[index].spec.title);
  });
});

test.each(['Line', 'Bar', 'Kpi'])(
  '%s has one scrollable story with three valid examples',
  (kind) => {
    const stories = require(`../stories/${kind}.stories`);
    expect(Object.keys(stories).filter((key) => key !== 'default')).toEqual([
      'Overview',
    ]);
    const page = stories.Overview.render();
    expect(page.querySelectorAll('.sc-root')).toHaveLength(3);
    expect(page.querySelector('.sc-error')).toBeNull();
    expect(page.querySelectorAll('[data-sb-code]')).toHaveLength(3);
    expect(page.querySelectorAll('h2')).toHaveLength(3);
    expect(page.querySelectorAll('section > p')).toHaveLength(0);
  },
);
