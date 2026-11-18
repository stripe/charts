// "Show code" support: stories record each chart they render, and the
// preview turns the records into rendering JavaScript, or a complete HTML
// page for the overview. Both use the specs actually rendered, so they cannot
// drift from the story.

import {PACKAGE_NAME} from '../src/meta';

/** Use the gallery's own build, including when served locally or under /charts/. */
export const SCRIPT_URL =
  typeof window === 'undefined'
    ? './dist/stripe-charts.min.js'
    : new URL('./dist/stripe-charts.min.js', window.location.href).href;

/** Something that happens to a chart after it first renders. */
export type ChartStep =
  /** `update(spec)` after a delay, for example when data arrives. */
  | {kind: 'update-after'; delayMs: number; spec: unknown; note: string}
  /** A button that calls `update(spec)`. */
  | {kind: 'update-button'; label: string; spec: unknown}
  /** A button that calls `destroy()`. */
  | {kind: 'destroy-button'; label: string};

/** One chart a story rendered, with its container size and later steps. */
export type ChartRecord = {
  spec: unknown;
  /** Pixels, or any CSS width for a fluid container, such as `"100%"`. */
  width: number | string;
  /** Omitted when the chart sizes itself, for example a KPI card. */
  height?: number;
  steps?: ChartStep[];
  /**
   * The JavaScript for `render`'s third argument, as the snippet should show
   * it. Options hold functions, so they can't be printed as JSON.
   */
  optionsSource?: string;
  /** React-specific callbacks, when the DOM and React APIs differ. */
  reactOptionsSource?: string;
};

let pending: ChartRecord[] = [];

/** Records a chart for the current story's code panel. */
export function recordChart(record: ChartRecord): void {
  pending.push(record);
}

/** Returns the charts recorded since the last call, and forgets them. */
export function takeRecords(): ChartRecord[] {
  const taken = pending;
  pending = [];
  return taken;
}

const INDENT = '  ';

/** Longest line, in characters, that a JSON value is kept on. */
const MAX_LINE = 80;

function entriesOf(value: object): [string, unknown][] {
  return Object.entries(value).filter(([, item]) => item !== undefined);
}

/** `value` as JSON on one line, with a space after each `:` and `,`. */
function inlineJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inlineJson).join(', ')}]`;
  if (typeof value === 'object' && value !== null) {
    const fields = entriesOf(value).map(
      ([key, item]) => `${JSON.stringify(key)}: ${inlineJson(item)}`,
    );
    return `{${fields.join(', ')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * `value` as JSON, keeping any object or array that fits on one line there
 * (like a data point) and breaking the rest one item per line. Lines after
 * the first are indented by `indent`.
 */
function json(value: unknown, indent: string): string {
  const flat = inlineJson(value);
  if (
    typeof value !== 'object' ||
    value === null ||
    indent.length + flat.length <= MAX_LINE
  ) {
    return flat;
  }
  const inner = indent + INDENT;
  const items = Array.isArray(value)
    ? value.map((item) => `${inner}${json(item, inner)}`)
    : entriesOf(value).map(
        ([key, item]) => `${inner}${JSON.stringify(key)}: ${json(item, inner)}`,
      );
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  return `${open}\n${items.join(',\n')}\n${indent}${close}`;
}

function styleFor({width, height}: ChartRecord): string {
  const cssWidth = typeof width === 'number' ? `${width}px` : width;
  return height === undefined
    ? `width: ${cssWidth}`
    : `width: ${cssWidth}; height: ${height}px`;
}

/** Element ids and variable names, numbered only when there are several charts. */
type Ids = {
  element(n: number): string;
  variable(n: number): string;
  button(n: number, step: number): string;
};

function idsFor(count: number): Ids {
  const suffix = (n: number): string => (count === 1 ? '' : `-${n + 1}`);
  return {
    element: (n) => `chart${suffix(n)}`,
    variable: (n) => (count === 1 ? 'chart' : `chart${n + 1}`),
    button: (n, step) => `chart${suffix(n)}-action-${step + 1}`,
  };
}

/** The script lines for one chart: render, then its steps. */
function chartScript(
  record: ChartRecord,
  n: number,
  ids: Ids,
  i = '',
): string[] {
  const name = ids.variable(n);
  const element = `document.getElementById('${ids.element(n)}')`;
  const options =
    record.optionsSource === undefined
      ? ''
      : `, ${record.optionsSource.trim().replace(/\n/g, `\n${i}`)}`;
  const lines = [
    `${i}const ${name} = StripeCharts.render(${element}, ${json(
      record.spec,
      i,
    )}${options});`,
  ];
  (record.steps ?? []).forEach((step, s) => {
    if (step.kind === 'update-after') {
      const update = `${name}.update(${json(step.spec, i)})`;
      lines.push(
        `${i}// ${step.note}`,
        `${i}setTimeout(() => ${update}, ${step.delayMs});`,
      );
      return;
    }
    const call =
      step.kind === 'destroy-button'
        ? `${name}.destroy()`
        : `${name}.update(${json(step.spec, i)})`;
    const button = `document.getElementById('${ids.button(n, s)}')`;
    lines.push(`${i}${button}.addEventListener('click', () => ${call});`);
  });
  return lines;
}

/** Rendering JavaScript for existing chart containers, without page setup. */
export function buildJavaScript(records: readonly ChartRecord[]): string {
  const ids = idsFor(records.length);
  return records
    .map((record, n) => chartScript(record, n, ids).join('\n'))
    .join('\n\n');
}

function titleOf(records: readonly ChartRecord[]): string {
  const spec = records[0]?.spec;
  const title =
    typeof spec === 'object' && spec !== null && 'title' in spec
      ? (spec as {title: unknown}).title
      : undefined;
  return typeof title === 'string' && title !== '' ? title : 'Chart';
}

/** Escapes text for an HTML text or attribute position. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A complete HTML page that renders `records`: one script tag, one sized
 * container per chart, and a `render` call (plus any update or destroy
 * steps) with each spec as JSON. An invalid spec makes `render` throw after
 * drawing its error card, so the page catches and logs the `SpecError`.
 */
export function buildSnippet(records: readonly ChartRecord[]): string {
  const ids = idsFor(records.length);
  const body: string[] = [];
  records.forEach((record, n) => {
    (record.steps ?? []).forEach((step, s) => {
      if (step.kind !== 'update-after') {
        body.push(
          `    <button type="button" id="${ids.button(n, s)}">${escapeHtml(
            step.label,
          )}</button>`,
        );
      }
    });
    body.push(
      `    <div id="${ids.element(n)}" style="${styleFor(record)}"></div>`,
    );
  });
  const script = records.flatMap((record, n) =>
    chartScript(record, n, ids, INDENT.repeat(4)),
  );
  // Embedded in a <script>, so "</" in a string must not end the element.
  const scriptText = script.join('\n').replace(/<\//g, '<\\/');
  return [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="utf-8" />',
    `    <title>${escapeHtml(titleOf(records))}</title>`,
    '  </head>',
    '  <body>',
    ...body,
    `    <script src="${SCRIPT_URL}"></script>`,
    '    <script>',
    '      try {',
    scriptText,
    '      } catch (error) {',
    '        // An invalid spec draws a card listing the issues, then throws.',
    '        console.error(error);',
    '      }',
    '    </script>',
    '  </body>',
    '</html>',
    '',
  ].join('\n');
}

/** React JSX for the same specs, callbacks, and lifecycle as the live story. */
export function buildReact(records: readonly ChartRecord[]): string {
  const hooks = new Set<string>();
  const components = records.map((record, n) => {
    const suffix = records.length === 1 ? '' : String(n + 1);
    const specName = `spec${suffix}`;
    const componentName =
      records.length === 1 ? 'ChartExample' : `Chart${suffix}`;
    const steps = record.steps ?? [];
    const updates = steps.some((step) => step.kind !== 'destroy-button');
    const destroys = steps.some((step) => step.kind === 'destroy-button');
    const declarations = [
      `const ${specName} = ${JSON.stringify(record.spec, null, 2)};`,
    ];
    const body: string[] = [];
    const children: string[] = [];
    if (updates) {
      hooks.add('useState');
      body.push(`  const [currentSpec, setSpec] = useState(${specName});`);
    }
    if (destroys) {
      hooks.add('useState');
      body.push('  const [visible, setVisible] = useState(true);');
    }
    steps.forEach((step, s) => {
      if (step.kind === 'destroy-button') {
        children.push(
          `      <button type="button" onClick={() => setVisible(false)}>{${JSON.stringify(step.label)}}</button>`,
        );
        return;
      }
      const next = `${specName}Update${s + 1}`;
      declarations.push(
        `const ${next} = ${JSON.stringify(step.spec, null, 2)};`,
      );
      if (step.kind === 'update-after') {
        hooks.add('useEffect');
        body.push(
          '  useEffect(() => {',
          `    const timer = setTimeout(() => setSpec(${next}), ${step.delayMs});`,
          '    return () => clearTimeout(timer);',
          '  }, []);',
        );
      } else {
        children.push(
          `      <button type="button" onClick={() => setSpec(${next})}>{${JSON.stringify(step.label)}}</button>`,
        );
      }
    });
    const options = record.reactOptionsSource ?? record.optionsSource;
    if (options)
      declarations.push(`const options${suffix} = ${options.trim()};`);
    const style = json({width: record.width, height: record.height}, '');
    const props = `spec={${updates ? 'currentSpec' : specName}} style={${style}}${options ? ` {...options${suffix}}` : ''}`;
    const chart = `<StripeChart ${props} />`;
    children.push(`      ${destroys ? `{visible && ${chart}}` : chart}`);
    const render =
      children.length === 1 && !destroys
        ? [`  return ${chart};`]
        : ['  return (', '    <>', ...children, '    </>', '  );'];
    return [
      ...declarations,
      '',
      `${records.length === 1 ? 'export ' : ''}function ${componentName}() {`,
      ...body,
      ...render,
      '}',
    ].join('\n');
  });
  const imports = [
    ...(hooks.size ? [`import {${[...hooks].join(', ')}} from 'react';`] : []),
    `import {StripeChart} from '${PACKAGE_NAME}/react';`,
  ];
  if (records.length > 1)
    components.push(
      [
        'export function ChartExample() {',
        '  return (',
        '    <>',
        ...records.map((_, n) => `      <Chart${n + 1} />`),
        '    </>',
        '  );',
        '}',
      ].join('\n'),
    );
  return `${imports.join('\n')}\n\n${components.join('\n\n')}`;
}

export type CodeExample = {
  language: 'react' | 'javascript';
  label: string;
  source: string;
};
export type CodeExamples = readonly [CodeExample, CodeExample];

export function buildCodeExamples(
  records: readonly ChartRecord[],
  setup = false,
): CodeExamples {
  return [
    {language: 'react', label: 'React', source: buildReact(records)},
    {
      language: 'javascript',
      label: setup ? 'HTML' : 'JavaScript',
      source: setup ? buildSnippet(records) : buildJavaScript(records),
    },
  ];
}
