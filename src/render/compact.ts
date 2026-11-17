import {tokens} from '../tokens';
import {observeSize} from './observe';

const COMPACT_CLASS = 'sc-compact';

/**
 * Keeps `root`'s compact class in step with its width. A container query
 * would do the same in CSS, but a measured width also works where container
 * queries are unsupported. Watching stops when `signal` aborts.
 */
export function watchCompact(root: HTMLElement, signal: AbortSignal): void {
  const apply = (width: number): void => {
    // Width 0 means the chart is hidden or detached; keep the full size.
    root.classList.toggle(
      COMPACT_CLASS,
      width > 0 && width <= tokens.kpi.compactBelow,
    );
  };
  // The threshold is the chart's outer width, border and padding included,
  // so a padded tile is not judged by its smaller content box.
  apply(root.getBoundingClientRect().width);
  observeSize(root, ({width}) => apply(width), {box: 'border-box', signal});
}
