import {ensureStylesheet, tokenProperties, vars} from './styles';

type Values = Readonly<Record<string, string>>;

/** The index of the parenthesis closing the one opened before `start`. */
function closing(text: string, start: number): number {
  let depth = 1;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    if (text[i] === ')') depth -= 1;
    if (depth === 0) return i;
  }
  throw new Error(`unbalanced parentheses in ${text}`);
}

/**
 * What a browser computes for `value` when the page sets the custom
 * properties in `set`: each var() is the property's value, or its fallback.
 */
function resolve(value: string, set: Values = {}): string {
  const start = value.indexOf('var(');
  if (start === -1) return value;
  const end = closing(value, start + 4);
  const inner = value.slice(start + 4, end);
  const comma = inner.indexOf(',');
  const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
  const fallback = comma === -1 ? '' : inner.slice(comma + 1).trim();
  const replacement = set[name] ?? resolve(fallback, set);
  return resolve(
    value.slice(0, start) + replacement + value.slice(end + 1),
    set,
  );
}

describe('token custom properties', () => {
  it('falls back to every default when the page sets none', () => {
    const unresolved = tokenProperties
      .filter(({fallback}) => resolve(fallback).includes('var('))
      .map(({name}) => name);
    expect(unresolved).toEqual([]);
    expect(resolve(vars.tooltip.background)).toBe('#FFFFFF');
    expect(resolve(vars.tooltip.label.color)).toBe('#50617A');
    expect(resolve(vars.tooltip.padding)).toBe('16px');
  });

  it('lets a role set on any ancestor recolor the components following it', () => {
    const dark = {'--sc-color-surface': '#101010'};
    expect(resolve(vars.tooltip.background, dark)).toBe('#101010');
    expect(resolve(vars.tile.background, dark)).toBe('#101010');
  });

  it('lets a component token override its role', () => {
    const set = {
      '--sc-color-surface': '#101010',
      '--sc-tooltip-background': '#202020',
    };
    expect(resolve(vars.tooltip.background, set)).toBe('#202020');
    expect(resolve(vars.tile.background, set)).toBe('#101010');
  });

  it('lets a page rule give the chart its own font', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    ensureStylesheet(element);
    const sheet = document.head.lastElementChild?.textContent ?? '';
    element.remove();
    // `inherit` can't go through --sc-font-family (it would apply to the
    // custom property), so the root's font has zero specificity and every
    // text inside inherits it.
    expect(sheet).toContain(
      `:where(.sc-root){font-family:${vars.font.family};}`,
    );
    // Code samples aside, nothing else sets a font that would ignore it.
    const others = (sheet.match(/font-family:[^;}]*/g) ?? []).filter(
      (declaration) =>
        declaration !== `font-family:${vars.font.family}` &&
        declaration !== `font-family:${vars.font.mono}`,
    );
    expect(new Set(others)).toEqual(new Set(['font-family:inherit']));
  });

  it('puts the stylesheet in a shadow root made by an iframe window', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const frameDocument = frame.contentDocument as Document;
    const shadow = frameDocument
      .createElement('div')
      .attachShadow({mode: 'open'});
    const element = frameDocument.createElement('div');
    shadow.appendChild(element);
    ensureStylesheet(element);
    expect(shadow.querySelector('style[data-stripe-charts]')).not.toBeNull();
    expect(frameDocument.head.querySelector('style')).toBeNull();
    frame.remove();
  });
});
