// Owned by the chart handle, not one legend: the state before a
// double-click's first click must survive the legend being replaced when
// that click re-renders the chart.

import type {HiddenSeries} from './legendState';
import {isolateSeries, toggleSeries} from './legendState';
import {MESSAGES} from './messages';

/** The chart's current legend state, read when a press is applied. */
export type LegendStateSource = () => {
  hidden: HiddenSeries;
  labels: readonly string[];
};

/** What the legend on screen calls. */
export type LegendPresses = {
  /**
   * A click or Enter/Space on `label`'s button, applied at once. `detail` is
   * the event's press count: 0 from the keyboard, 1 for a click. Later
   * clicks of a run (2, 3...) are left to {@link doubleClick}: the browser
   * may not deliver them once the first click has replaced the button.
   */
  press(label: string, detail: number): void;
  /**
   * A double-click on `label`'s button: isolate it measured from the state
   * before the double-click's first click, so it never ends as a net
   * toggle; if it already was the only one shown, show all.
   */
  doubleClick(label: string): void;
  /** Shift+Enter: isolate `label`, or show all if it is the only one shown. */
  isolate(label: string): void;
  /** Where refusals are announced: the live region of the legend on screen. */
  setAnnouncer(announce: (text: string) => void): void;
};

/**
 * Presses for one chart. `onChange` gets the new hidden set and the label
 * whose button should keep focus.
 */
export function createLegendPresses(
  state: LegendStateSource,
  onChange: (hidden: HiddenSeries, label: string) => void,
): LegendPresses {
  let announce: (text: string) => void = () => undefined;
  // The last single click, and the hidden set before it.
  let lastClick: {label: string; before: HiddenSeries} | null = null;

  const run = (
    label: string,
    act: typeof toggleSeries,
    from?: HiddenSeries,
  ): void => {
    const {hidden, labels} = state();
    if (!labels.includes(label)) return;
    const result = act(from ?? hidden, label, labels);
    if (result.refused) announce(MESSAGES.lastSeriesVisible);
    else onChange(result.hidden, label);
  };

  return {
    press(label, detail) {
      if (detail > 1) return;
      lastClick = detail === 1 ? {label, before: state().hidden} : null;
      run(label, toggleSeries);
    },
    doubleClick(label) {
      const before = lastClick?.label === label ? lastClick.before : undefined;
      lastClick = null;
      run(label, isolateSeries, before);
    },
    isolate(label) {
      lastClick = null;
      run(label, isolateSeries);
    },
    setAnnouncer(next) {
      announce = next;
    },
  };
}
