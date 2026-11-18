// The story frame's code view and its Chart / Code toggle. In code mode the
// snippet replaces the story in the same frame and scrolls inside it.
// Styled as neutral page chrome, not like the chart.
import type {CodeExample, CodeExamples} from './code';
import Prism from 'prismjs';
import 'prismjs/components/prism-jsx';

const FONT =
  '12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const UI_FONT = '12px/16px system-ui, sans-serif';
const BORDER = '1px solid #d0d7de';
/** How long the Copy button says "Copied". */
const COPIED_MS = 1500;
/** Storybook's "padded" layout inset on each side of the frame. */
const FRAME_INSET = '1rem';
let nextPanelId = 0;

function controlButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  Object.assign(button.style, {
    font: UI_FONT,
    color: '#24292f',
    background: '#ffffff',
    border: BORDER,
    borderRadius: '6px',
    padding: '4px 10px',
    cursor: 'pointer',
  });
  return button;
}

/** Render tokens as text nodes, without injecting highlighted HTML. */
function highlighted(source: string): HTMLElement {
  const code = document.createElement('code');
  code.className = 'language-jsx';
  code.style.display = 'block';
  code.style.whiteSpace = 'pre';
  const colors: Record<string, string> = {
    keyword: '#cf222e',
    string: '#0a3069',
    number: '#0550ae',
    boolean: '#0550ae',
    function: '#8250df',
    tag: '#116329',
    'attr-name': '#0550ae',
    comment: '#6e7781',
    punctuation: '#57606a',
  };
  function append(parent: HTMLElement, tokens: (string | Prism.Token)[]): void {
    for (const token of tokens) {
      if (typeof token === 'string') {
        parent.append(document.createTextNode(token));
      } else {
        const span = document.createElement('span');
        span.className = `token ${token.type}`;
        if (colors[token.type]) span.style.color = colors[token.type];
        append(
          span,
          Array.isArray(token.content) ? token.content : [token.content],
        );
        parent.append(span);
      }
    }
  }
  append(code, Prism.tokenize(source, Prism.languages.jsx));
  return code;
}

function renderReact(container: HTMLElement, source: string): void {
  let offset = 0;
  // Generated JSON puts each series array on its own indented lines.
  for (const match of source.matchAll(
    /^( *)"series": \[\n[\s\S]*?^\1\](,?)$/gm,
  )) {
    const before = source.slice(offset, match.index).replace(/\n$/, '');
    if (before) container.append(highlighted(before));
    const details = document.createElement('details');
    Object.assign(details.style, {
      margin: '0',
      padding: '0',
      border: '0',
      paddingLeft: `${match[1].length}ch`,
    });
    const summary = document.createElement('summary');
    summary.style.cursor = 'pointer';
    const label = highlighted(`"series": [ … ]${match[2]}`);
    label.style.display = 'inline';
    summary.append(label);
    const expanded = match[0]
      .split('\n')
      .map((line) => line.slice(match[1].length))
      .join('\n');
    details.append(summary, highlighted(expanded));
    container.append(details);
    offset = match.index + match[0].length + 1;
  }
  container.append(highlighted(source.slice(offset)));
}

/** Copies `text`; without clipboard access, selects `code` instead. */
async function copy(text: string, code: HTMLElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const range = document.createRange();
    range.selectNodeContents(code);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return false;
  }
}

/**
 * The toggle at the top right of the frame: "Show code" in chart mode,
 * "Show chart" in code mode.
 */
export function viewToggle(code: boolean, onToggle: () => void): HTMLElement {
  const button = controlButton(code ? 'Show chart' : 'Show code');
  button.dataset.sbViewToggle = '';
  button.setAttribute('aria-pressed', String(code));
  Object.assign(button.style, {
    position: 'fixed',
    top: '8px',
    right: '8px',
    zIndex: '1',
    opacity: code ? '1' : '0.7',
  });
  button.addEventListener('click', onToggle);
  return button;
}

/**
 * Copyable code, either inline or filling the frame.
 */
export function codeView(
  examples: CodeExamples,
  inline = false,
  initialLanguage: CodeExample['language'] = 'react',
): HTMLElement {
  let selected =
    examples.find((example) => example.language === initialLanguage) ??
    examples[0];
  const panelId = `sc-code-${++nextPanelId}`;
  const view = document.createElement('section');
  view.dataset.sbCode = '';
  view.setAttribute('aria-label', 'Code for this story');
  Object.assign(view.style, {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: inline ? '640px' : `calc(100vh - 2 * ${FRAME_INSET})`,
    minWidth: '0',
    boxSizing: 'border-box',
    background: '#f6f8fa',
    border: BORDER,
    borderRadius: '6px',
  });

  const bar = document.createElement('div');
  Object.assign(bar.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: inline ? '4px 8px' : '4px 120px 4px 8px',
    borderBottom: BORDER,
    flexShrink: '0',
  });
  const tabs = document.createElement('div');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Code language');
  tabs.style.display = 'flex';
  tabs.style.gap = '4px';
  const copyButton = controlButton('Copy');
  Object.assign(copyButton.style, {
    marginLeft: 'auto',
    padding: '2px 6px',
    minHeight: '24px',
    borderRadius: '4px',
    background: '#f6f8fa',
    color: '#57606a',
  });

  const pre = document.createElement('div');
  pre.id = panelId;
  pre.setAttribute('role', 'tabpanel');
  pre.tabIndex = 0;
  Object.assign(pre.style, {
    flex: '1',
    margin: '0',
    padding: '12px',
    minHeight: '0',
    overflow: 'auto',
    font: FONT,
    color: '#24292f',
    whiteSpace: 'pre',
  });
  const code = document.createElement('div');
  pre.append(code);

  const buttons = examples.map((example) => {
    const button = controlButton(example.label);
    button.id = `${panelId}-${example.language}`;
    button.dataset.language = example.language;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panelId);
    Object.assign(button.style, {
      padding: '2px 6px',
      minHeight: '24px',
      border: 'none',
      borderRadius: '4px',
    });
    button.addEventListener('click', () => select(example));
    tabs.appendChild(button);
    return button;
  });
  function select(example: CodeExample): void {
    selected = example;
    code.replaceChildren();
    code.style.whiteSpace = selected.language === 'react' ? 'normal' : 'pre';
    if (selected.language === 'react') {
      renderReact(code, selected.source);
    } else {
      const plain = document.createElement('code');
      plain.textContent = selected.source;
      code.append(plain);
    }
    code.className =
      selected.language === 'react'
        ? 'language-jsx'
        : `language-${selected.label === 'HTML' ? 'html' : 'javascript'}`;
    pre.setAttribute('aria-labelledby', `${panelId}-${selected.language}`);
    pre.scrollTop = 0;
    pre.scrollLeft = 0;
    copyButton.textContent = 'Copy';
    for (const button of buttons) {
      const active = button.dataset.language === selected.language;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      button.style.color = active ? '#24292f' : '#57606a';
      button.style.background = active ? '#e8edf2' : 'transparent';
    }
  }
  tabs.addEventListener('keydown', (event) => {
    const index = examples.indexOf(selected);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? examples.length - 1
          : event.key === 'ArrowRight'
            ? (index + 1) % examples.length
            : event.key === 'ArrowLeft'
              ? (index + examples.length - 1) % examples.length
              : null;
    if (next === null) return;
    event.preventDefault();
    select(examples[next]);
    buttons[next].focus();
  });
  select(selected);

  copyButton.addEventListener('click', async () => {
    const source = selected.source;
    const copied = await copy(source, code);
    if (source !== selected.source) return;
    copyButton.textContent = copied ? 'Copied' : 'Select and copy';
    setTimeout(() => {
      copyButton.textContent = 'Copy';
    }, COPIED_MS);
  });

  bar.append(tabs, copyButton);
  view.append(bar, pre);
  return view;
}
