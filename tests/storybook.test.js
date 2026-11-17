const {cleanUpCharts} = require('../stories/support/mount');
const {takeRecords, buildCodeExamples} = require('../.storybook/code');
const {guidePage} = require('../stories/support/guidePage');
const {guideFor} = require('../stories/support/guides');
const {Overview: Units} = require('../stories/Money.stories');
const {Overview: Validation} = require('../stories/Validation.stories');
const {GettingStarted} = require('../stories/Intro.stories');

afterEach(() => {
  cleanUpCharts()();
  takeRecords();
  document.body.replaceChildren();
});

test('changing units keeps the rendered chart and copyable code in sync', () => {
  const page = Units.render();
  document.body.appendChild(page);
  const select = page.querySelector('select');
  expect(page.querySelector('[data-sb-code] code').textContent).toContain(
    '<StripeChart',
  );
  page.querySelector('[data-language="javascript"]').click();
  expect(page.querySelector('[data-sb-code] code').textContent).not.toContain(
    '<html',
  );
  expect(page.querySelector('[data-sb-code] code').textContent).toContain(
    '"unit": "minor"',
  );
  expect(page.querySelector('[id$="-summary"]').textContent).toContain('$0.95');
  select.value = 'USD · major units';
  select.dispatchEvent(new Event('change'));
  expect(page.querySelector('[data-sb-code] code').textContent).toContain(
    '"unit": "major"',
  );
  expect(page.querySelector('[id$="-summary"]').textContent).toContain(
    '$95.00',
  );
  expect(page.querySelectorAll('.sc-root')).toHaveLength(1);
  expect(page.querySelector('[aria-selected="true"]').textContent).toBe(
    'JavaScript',
  );
  page.querySelector('[data-language="react"]').click();
  expect(page.querySelector('[data-sb-code] code').textContent).toContain(
    '"unit": "major"',
  );
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
  expect(page.querySelector('[data-sb-code] code').textContent).toContain(
    '"unit": "minor"',
  );
});

test('the first guide shows the live example and copyable code', () => {
  const story = GettingStarted.render();
  const records = takeRecords();
  expect(records).toHaveLength(1);
  const examples = buildCodeExamples(records, true);
  expect(examples[1].source).toContain(
    'http://localhost/dist/stripe-charts.min.js',
  );
  expect(examples[1].source).not.toContain('cdn.jsdelivr.net');
  const page = guidePage('Getting started', guideFor('Intro'), story, examples);
  expect(page.querySelector('.sc-root')).not.toBeNull();
  expect(
    [...page.querySelectorAll('summary')].map((summary) => summary.textContent),
  ).not.toContain('Options');
  expect(
    [...page.querySelectorAll('[data-sb-code] button')].map(
      (b) => b.textContent,
    ),
  ).toEqual(['React', 'HTML', 'Copy']);
  expect(page.querySelector('[data-sb-code] code').textContent).toContain(
    'Orders',
  );
});
