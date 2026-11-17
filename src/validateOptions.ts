// Checks the render options (the JavaScript-only third argument) with the
// same path and message style as the spec, under the path prefix `options.`.

import {Checker, describe} from './checker';
import {OPTION_KEYS} from './options';
import type {SpecIssue} from './spec';

const PATH = 'options';

// Names from other chart libraries, mapped to the option meant.
const ALIASES: Readonly<Record<string, string>> = {
  onClick: 'onPointClick',
  onHover: 'onPointHover',
  tooltip: 'renderTooltip',
  tooltipFormatter: 'renderTooltip',
  yTickFormat: 'formatYTick',
  xTickFormat: 'formatXTick',
};

/** Every issue with `options`; empty when they are valid or undefined. */
export function validateOptions(options: unknown): SpecIssue[] {
  if (options === undefined) return [];
  const c = new Checker();
  if (!c.object(PATH, options)) return c.issues;
  c.unknownFields(PATH, options, OPTION_KEYS, {aliases: ALIASES});
  for (const key of OPTION_KEYS) {
    const value = options[key];
    if (value !== undefined && typeof value !== 'function') {
      c.report(
        `${PATH}.${key}`,
        `expected a function, got ${describe(
          value,
        )}; options hold callbacks, and settings go in the spec`,
      );
    }
  }
  return c.issues;
}
