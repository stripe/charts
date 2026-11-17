// The Chart / Code view: a Storybook global that every story shares, set by
// the toolbar toggle (manager.ts) or the toggle in the story frame.

/** The global's name, e.g. `&globals=view:code` in a story URL. */
export const VIEW_GLOBAL = 'view';

/**
 * `"chart"` shows the story, `"code"` replaces it with its HTML snippet, and
 * `"screenshot"` shows the story without the in-frame toggle, for shots.
 */
export type View = 'chart' | 'code' | 'screenshot';

/** The view when the global is unset. */
export const DEFAULT_VIEW: View = 'chart';

/** Reads the view from Storybook globals, falling back to the default. */
export function viewOf(globals: Record<string, unknown>): View {
  const value = globals[VIEW_GLOBAL];
  return value === 'code' || value === 'screenshot' ? value : DEFAULT_VIEW;
}
