// "Show code" support: stories record each chart they render, and the
// preview turns the records into rendering JavaScript and a downloadable
// HTML page. Both use the specs actually rendered, so they cannot drift
// from the story.

import {PACKAGE_NAME} from '../src/meta';

/** Use the gallery's own build, including when served locally or under /charts/. */
export const SCRIPT_URL =
  typeof window === 'undefined'
    ? 'https://stripe.github.io/charts/dist/stripe-charts.min.js'
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

/** What {@link reactCode} needs to print a complete React example. */
export type ReactCodeParts = {
  /**
   * The specs the story renders, by the constant name the component uses,
   * for example `{spec: grossVolume}`. Printed from these very values.
   */
  specs: Record<string, unknown>;
  /** Names to import from `react`, for example `['useState']`. */
  reactImports?: readonly string[];
  /** The component's source, written against the spec constants. */
  component: string;
};

/**
 * A copy-paste TSX example: imports from the package's React entry point,
 * each spec as a typed constant printed from the value the story rendered,
 * then the component. Only the component is a hand-written string.
 */
export function reactCode({
  specs,
  reactImports = [],
  component,
}: ReactCodeParts): {language: 'tsx'; source: string} {
  const imports = [
    ...(reactImports.length > 0
      ? [`import {${reactImports.join(', ')}} from 'react';`]
      : []),
    `import type {ChartSpec} from '${PACKAGE_NAME}';`,
    `import {StripeChart} from '${PACKAGE_NAME}/react';`,
  ];
  const constants = Object.entries(specs).map(
    ([name, value]) => `const ${name}: ChartSpec = ${json(value, '')};`,
  );
  return {
    language: 'tsx',
    source: [
      imports.join('\n'),
      constants.join('\n\n'),
      component.trim(),
      '',
    ].join('\n\n'),
  };
}
