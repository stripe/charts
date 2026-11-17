// The story frame's code view and its Chart / Code toggle. In code mode the
// snippet replaces the story in the same frame and scrolls inside it.
// Styled as neutral page chrome, not like the chart.

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
 * Copyable code, either inline or filling the frame.
 */
export function codeView(snippet: string, inline = false): HTMLElement {
  const view = document.createElement('section');
  view.dataset.sbCode = '';
  view.setAttribute('aria-label', 'Code for this story');
  Object.assign(view.style, {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: inline
      ? 'clamp(320px, 60vh, 640px)'
      : `calc(100vh - 2 * ${FRAME_INSET})`,
    minWidth: '0',
    boxSizing: 'border-box',
    background: '#f6f8fa',
    border: BORDER,
    borderRadius: '6px',
  });

  const copyButton = controlButton('Copy');
  Object.assign(copyButton.style, {
    position: 'absolute',
    top: '6px',
    right: inline ? '6px' : '120px',
    padding: '2px 6px',
    minHeight: '24px',
    borderRadius: '4px',
    background: '#f6f8fa',
    color: '#57606a',
  });

  const pre = document.createElement('pre');
  Object.assign(pre.style, {
    flex: '1',
    margin: '0',
    padding: '36px 12px 12px',
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

  view.append(copyButton, pre);
  return view;
}
