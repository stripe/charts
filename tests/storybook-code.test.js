const React = require('react');
const {act} = React;
const {createRoot} = require('react-dom/client');
const {transformSync} = require('@swc/core');
const {buildReact, buildCodeExamples} = require('../.storybook/code');
const {codeView} = require('../.storybook/codeView');

const spec = {
  title: 'Orders',
  series: [{label: 'Orders', data: [{x: '2026-11-01', y: 120}]}],
};
const record = {spec, width: '100%', height: 320};

function compileReact(records, component) {
  const {code} = transformSync(buildReact(records), {
    jsc: {
      parser: {syntax: 'ecmascript', jsx: true},
      transform: {react: {runtime: 'automatic'}},
    },
    module: {type: 'commonjs'},
  });
  const module = {exports: {}};
  new Function('require', 'module', 'exports', code)(
    (name) =>
      name === '@stripe/charts/react'
        ? {StripeChart: component}
        : require(name),
    module,
    module.exports,
  );
  return module.exports.ChartExample;
}

afterEach(() => {
  jest.useRealTimers();
  document.body.replaceChildren();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

test('tabs support keyboard selection and copy only the active language', async () => {
  jest.useFakeTimers();
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: {writeText},
    configurable: true,
  });
  const examples = buildCodeExamples([record]);
  const view = codeView(examples, true);
  document.body.appendChild(view);
  const [react, javascript] = view.querySelectorAll('[role="tab"]');
  const copy = [...view.querySelectorAll('button')].find(
    (button) => button.textContent === 'Copy',
  );
  expect(react.getAttribute('aria-selected')).toBe('true');
  copy.click();
  await Promise.resolve();
  expect(writeText).toHaveBeenLastCalledWith(examples[0].source);
  react.focus();
  react.dispatchEvent(
    new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}),
  );
  expect(document.activeElement).toBe(javascript);
  expect(javascript.getAttribute('aria-selected')).toBe('true');
  expect(view.querySelector('code').textContent).toBe(examples[1].source);
  expect(
    view.querySelector('[role="tabpanel"]').getAttribute('aria-labelledby'),
  ).toBe(javascript.id);
  copy.click();
  await Promise.resolve();
  expect(writeText).toHaveBeenLastCalledWith(examples[1].source);
  javascript.dispatchEvent(
    new KeyboardEvent('keydown', {key: 'Home', bubbles: true}),
  );
  expect(document.activeElement).toBe(react);
  expect(copy.textContent).toBe('Copy');
});

test('generated React updates the spec, forwards callbacks, and unmounts on destroy', () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const received = [];
  const unmounted = jest.fn();
  const Example = compileReact(
    [
      {
        ...record,
        optionsSource: '{formatYTick: (value, label) => label.toUpperCase()}',
        steps: [
          {
            kind: 'update-button',
            label: 'Update',
            spec: {...spec, title: 'Updated'},
          },
          {kind: 'destroy-button', label: 'Destroy'},
        ],
      },
    ],
    (props) => {
      received.push(props);
      React.useEffect(() => unmounted, []);
      return React.createElement('div', null, props.spec.title);
    },
  );
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(React.createElement(Example)));
  expect(received.at(-1).spec).toEqual(spec);
  expect(received.at(-1).style).toEqual({width: '100%', height: 320});
  expect(received.at(-1).formatYTick(1, 'orders')).toBe('ORDERS');
  act(() => host.querySelector('button').click());
  expect(received.at(-1).spec.title).toBe('Updated');
  act(() => host.querySelectorAll('button')[1].click());
  expect(unmounted).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
});

test('generated React cleans up delayed updates on unmount', () => {
  jest.useFakeTimers();
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const received = [];
  const Example = compileReact(
    [
      {
        ...record,
        steps: [
          {
            kind: 'update-after',
            delayMs: 100,
            spec: {...spec, title: 'Loaded'},
            note: 'Data arrives',
          },
        ],
      },
    ],
    (props) => {
      received.push(props);
      return null;
    },
  );
  const host = document.createElement('div');
  const root = createRoot(host);
  act(() => root.render(React.createElement(Example)));
  act(() => jest.advanceTimersByTime(100));
  expect(received.at(-1).spec.title).toBe('Loaded');
  act(() => root.unmount());
  const secondRoot = createRoot(host);
  act(() => secondRoot.render(React.createElement(Example)));
  act(() => secondRoot.unmount());
  const count = received.length;
  act(() => jest.advanceTimersByTime(100));
  expect(received).toHaveLength(count);
});

test('multiple charts preserve their specs and React-specific tooltip content', () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const received = [];
  const Example = compileReact(
    [
      record,
      {
        ...record,
        spec: {...spec, title: 'Volume'},
        optionsSource: '{renderTooltip: () => document.createElement("div")}',
        reactOptionsSource:
          '{renderTooltip: (context) => <strong>{context.title}</strong>}',
      },
    ],
    (props) => {
      received.push(props);
      return null;
    },
  );
  const root = createRoot(document.createElement('div'));
  act(() => root.render(React.createElement(Example)));
  expect(received.map((props) => props.spec.title)).toEqual([
    'Orders',
    'Volume',
  ]);
  const tooltip = received[1].renderTooltip({title: 'November'});
  expect(React.isValidElement(tooltip)).toBe(true);
  expect(tooltip.props.children).toBe('November');
  act(() => root.unmount());
});
