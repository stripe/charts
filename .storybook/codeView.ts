// The story frame's code view and its Chart / Code toggle. In code mode the
// snippet replaces the story in the same frame and scrolls inside it.
// Styled as neutral page chrome, not like the chart.

import {SCRIPT_URL} from './code';

const FONT =
  '12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const UI_FONT = '12px/16px system-ui, sans-serif';
const BORDER = '1px solid #d0d7de';
/** How long the Copy button says "Copied". */
const COPIED_MS = 1500;
/** Storybook's "padded" layout inset on each side of the frame. */
const FRAME_INSET = '1rem';

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
 * The code view: a Copy button, a note about the script URL when the
 * snippet loads the browser build, and the snippet, filling the story frame
 * and scrolling inside it.
 */
export function codeView(snippet: string, loadsScript: boolean): HTMLElement {
  const view = document.createElement('section');
  view.dataset.sbCode = '';
  view.setAttribute('aria-label', 'Code for this story');
  Object.assign(view.style, {
    display: 'flex',
    flexDirection: 'column',
    height: `calc(100vh - 2 * ${FRAME_INSET})`,
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
    // Room on the right for the fixed toggle.
    padding: '8px 120px 8px 12px',
    borderBottom: BORDER,
    font: UI_FONT,
    color: '#57606a',
  });
  const copyButton = controlButton('Copy');
  const note = document.createElement('span');
  note.textContent = `Loads ${
    SCRIPT_URL.split('/npm/')[1] ?? SCRIPT_URL
  } from a CDN; point the script at your own copy of dist/stripe-charts.min.js to run it locally.`;
  bar.append(copyButton);
  // Only a generated HTML page loads the browser build from a CDN.
  if (loadsScript) bar.append(note);

  const pre = document.createElement('pre');
  Object.assign(pre.style, {
    flex: '1',
    margin: '0',
    padding: '12px',
    overflow: 'auto',
    font: FONT,
    color: '#24292f',
  });
  const code = document.createElement('code');
  code.textContent = snippet;
  pre.append(code);

  copyButton.addEventListener('click', async () => {
    const copied = await copy(snippet, code);
    copyButton.textContent = copied ? 'Copied' : 'Select and copy';
    setTimeout(() => {
      copyButton.textContent = 'Copy';
    }, COPIED_MS);
  });

  view.append(bar, pre);
  return view;
}
