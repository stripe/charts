// Generate a README illustration from the real SVG renderer and fixed sample
// geometry. jsdom supplies a document; no browser or screenshot is involved.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const esbuild = require('esbuild');
const {JSDOM} = require('jsdom');

const root = path.join(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'stripe-charts-preview-'));
const modulePath = path.join(temp, 'render.cjs');
esbuild.buildSync({
  absWorkingDir: root,
  stdin: {
    contents:
      "export {render} from './src/index'; export {tokens} from './src/tokens';",
    resolveDir: root,
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: modulePath,
});
const {render} = require(modulePath);
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
const doc = dom.window.document;
global.Node = dom.window.Node;
global.AbortController = dom.window.AbortController;
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
const callbacks = [];
global.ResizeObserver = class {
  constructor(callback) {
    callbacks.push(callback);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};
const spec = JSON.parse(
  fs.readFileSync(path.join(root, 'examples/daily-gross-volume.json'), 'utf8'),
);
const host = doc.createElement('div');
doc.body.appendChild(host);
const handle = render(host, spec);
for (const callback of callbacks)
  callback([{contentRect: {width: 736, height: 250}}]);
const plot = host.querySelector('svg.sc-svg');
if (!plot || !plot.querySelector('path.sc-line'))
  throw new Error('Preview chart did not draw');
// Random runtime clip IDs become stable asset IDs.
const ids = new Map(
  [...plot.querySelectorAll('[id]')].map((node, i) => [
    node.id,
    `preview-${i}`,
  ]),
);
for (const node of plot.querySelectorAll('*')) {
  for (const attr of [...node.attributes]) {
    let value = attr.value;
    for (const [from, to] of ids) value = value.replaceAll(from, to);
    node.setAttribute(attr.name, value);
  }
}
plot.setAttribute('x', '32');
plot.setAttribute('y', '148');
plot.removeAttribute('class');
const ns = 'http://www.w3.org/2000/svg';
const outer = doc.createElementNS(ns, 'svg');
outer.setAttribute('viewBox', '0 0 800 452');
outer.setAttribute('width', '800');
outer.setAttribute('height', '452');
outer.setAttribute('role', 'img');
outer.setAttribute('aria-labelledby', 'preview-title');
outer.setAttribute('class', 'sc-root');
function node(tag, attrs, value) {
  const element = doc.createElementNS(ns, tag);
  for (const [name, val] of Object.entries(attrs))
    element.setAttribute(name, val);
  if (value) element.textContent = value;
  outer.appendChild(element);
  return element;
}
node(
  'title',
  {id: 'preview-title'},
  'Gross volume, this year compared with last year. Fictional example data.',
);
const sheet = doc.querySelector('style[data-stripe-charts]')?.textContent;
if (!sheet) throw new Error('Preview stylesheet missing');
node(
  'style',
  {},
  sheet +
    '\n.sc-root{font-family:Arial,sans-serif}.preview-label{fill:#3c4f69}',
);
node('rect', {
  x: '1',
  y: '1',
  width: '798',
  height: '450',
  rx: '12',
  fill: '#fff',
  stroke: '#d4dee9',
});
node(
  'text',
  {
    x: '32',
    y: '40',
    'font-size': '18',
    'font-weight': '600',
    class: 'preview-label',
  },
  spec.title,
);
node(
  'text',
  {x: '32', y: '64', 'font-size': '13', class: 'preview-label'},
  `${spec.description} · fictional data`,
);
node(
  'text',
  {x: '32', y: '110', 'font-size': '32', 'font-weight': '600', fill: '#1a2c44'},
  new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(
    spec.kpi.value / 100,
  ),
);
node(
  'text',
  {x: '32', y: '133', 'font-size': '13', fill: '#217005'},
  `+${((spec.kpi.value / spec.kpi.comparisonValue - 1) * 100).toFixed(1)}% vs. last year`,
);
outer.appendChild(plot);
for (const [i, label, color] of [
  [0, '2026', '#9966FF'],
  [1, '2025', '#95A4BA'],
]) {
  const x = 32 + i * 105;
  node('line', {
    x1: String(x),
    x2: String(x + 16),
    y1: '422',
    y2: '422',
    stroke: color,
    'stroke-width': '2',
    ...(i ? {'stroke-dasharray': '4 4'} : {}),
  });
  node(
    'text',
    {x: String(x + 24), y: '427', 'font-size': '13', class: 'preview-label'},
    label,
  );
}
fs.writeFileSync(
  path.join(root, 'docs/assets/chart-preview.svg'),
  new dom.window.XMLSerializer().serializeToString(outer) + '\n',
);
handle.destroy();
dom.window.close();
console.log('docs/assets/chart-preview.svg generated from the chart renderer');
