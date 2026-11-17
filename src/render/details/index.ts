// The details view: the info button after the title toggles the plot area
// into a view of where the data came from and the data itself as a table.

import type {ResolvedSpec} from '../../defaults';
import type {ChartModel} from '../../model';
import type {PopoverPlacement, Rect} from '../../layout/popover';
import {placePopover, toContainingBlock} from '../../layout/popover';
import {tokens} from '../../tokens';
import {html} from '../dom';
import {INFO_GLYPH, glyph} from '../icons';
import {MESSAGES} from '../messages';
import type {ChartMotion} from '../motion';
import {frameScheduler, observeSize} from '../observe';
import {onOutsidePress} from '../outsidePress';
import {detailsContent} from './content';
import {dataTable, detailsNotes} from './tableModel';

export type DetailsHandle = {
  trigger: HTMLElement;
  view: HTMLElement;
};

export type DetailsOptions = {
  id: string;
  /** The header title's id: it names the view, which doesn't repeat it. */
  titleId: string;
  tile: boolean;
  motion: ChartMotion;
  signal: AbortSignal;
};

const OPEN_CLASS = 'sc-details-open';
const FLOATING_CLASS = 'sc-details-floating';
const NARROW_CLASS = 'sc-details-narrow';
const LABEL_ABOVE_CLASS = 'sc-info-label-above';
const PLOT_AREA = '.sc-plot-area';
const COVERED = `${PLOT_AREA}, .sc-tooltip, .sc-legend`;
const TABLE_SCROLL = '.sc-table-scroll';
// Sent on the document when a view opens, so another chart's floating
// panel closes: one panel at a time, with no state shared between charts.
const OPENED_EVENT = 'stripe-charts:details-open';

// Rows built as the view opens: more than a tall view shows, so the first
// paint is complete. The rest are added a chunk per frame, so a table of
// the maximum 1000 points never blocks the page in one long task. (Skipping
// layout of off-screen rows with `content-visibility` is not an option:
// containment does not apply to table rows or row groups. Showing fewer
// rows would make the table an incomplete view of the data.)
const FIRST_ROWS = 100;
const ROWS_PER_FRAME = 150;

/**
 * True when `target` is a node inside `container`. Checked by shape, not
 * `instanceof Node`: a chart drawn into another window (a same-origin
 * iframe) has nodes made by that window's `Node`, which fail `instanceof`
 * against this one's, so every press inside the panel would read as
 * outside it.
 */
function inside(container: Element, target: EventTarget | null): boolean {
  return (
    typeof target === 'object' &&
    target !== null &&
    'nodeType' in target &&
    container.contains(target as Node)
  );
}

function placeLabel(root: HTMLElement, label: HTMLElement): void {
  label.classList.remove(LABEL_ABOVE_CLASS);
  const overflows =
    label.getBoundingClientRect().right > root.getBoundingClientRect().right;
  label.classList.toggle(LABEL_ABOVE_CLASS, overflows);
}

/** True when `element`'s content is larger than its box, either way. */
function hasOverflow(element: Element): boolean {
  return (
    element.scrollWidth > element.clientWidth ||
    element.scrollHeight > element.clientHeight
  );
}

/** The panel's anchor: below or above the button, from the card's left edge. */
function anchorFor(button: HTMLElement, root: HTMLElement): Rect {
  const buttonRect = button.getBoundingClientRect();
  return {
    left: root.getBoundingClientRect().left,
    right: buttonRect.right,
    top: buttonRect.top,
    bottom: buttonRect.bottom,
  };
}

function viewportOf(doc: Document): {width: number; height: number} {
  return {
    width: doc.documentElement.clientWidth,
    height: doc.documentElement.clientHeight,
  };
}

function placement(
  anchor: Rect,
  size: {width: number; height: number},
  viewport: {width: number; height: number},
): PopoverPlacement {
  const {offset, viewportMargin, maxHeight} = tokens.details.panel;
  const placed = placePopover({
    anchor,
    size: {width: size.width, height: Math.min(size.height, maxHeight)},
    viewport,
    offset,
    margin: viewportMargin,
  });
  return {...placed, maxHeight: Math.min(placed.maxHeight, maxHeight)};
}

function setStyle(
  element: HTMLElement,
  name: 'left' | 'top' | 'maxHeight',
  px: number,
): void {
  const value = `${px}px`;
  // Unchanged values aren't written, so a panel that doesn't need to move
  // doesn't cost the growing table a relayout.
  if (element.style[name] !== value) element.style[name] = value;
}

/**
 * Caps the table's own scroller so the panel fits `maxHeight`: the panel's
 * other content (`extra`) keeps its height and only the rows scroll. An
 * explicit height, because a shrinking flex item would make the browser lay
 * the whole table out again for every chunk of rows added.
 */
function capTable(view: HTMLElement, maxHeight: number, extra: number): void {
  const scroller = view.querySelector<HTMLElement>(TABLE_SCROLL);
  if (!scroller) return;
  const room = Math.max(tokens.details.panel.tableMinHeight, maxHeight - extra);
  setStyle(scroller, 'maxHeight', room);
}

/** The panel's size and frame, kept between placements. */
type Sized = {
  /** Its height before the cap. */
  natural: number;
  /** The height of everything in it but the table's rows. */
  extra: number;
  /** Its rendered size over its layout size, under a scaled ancestor. */
  scale: {x: number; y: number};
};

function setPosition(
  view: HTMLElement,
  position: {left: number; top: number},
  origin: {left: number; top: number},
  scale: {x: number; y: number},
): void {
  const {left, top} = toContainingBlock(position, origin, scale);
  setStyle(view, 'left', left);
  setStyle(view, 'top', top);
}

/**
 * Places the floating panel by the info button, lined up with the card's
 * left edge: sized to its content within the panel's width limits (wider,
 * up to the viewport, if the table needs it), below or above the button
 * wherever it fits in the viewport, its height capped to the room there
 * (then only the table scrolls). Positions are worked out in the viewport
 * and converted to the panel's containing block. Measures from scratch, so
 * it relays the panel out: for opening and viewport resizes, not for every
 * change while rows fill.
 */
function placeFloating(
  view: HTMLElement,
  button: HTMLElement,
  root: HTMLElement,
): Sized {
  const {panel} = tokens.details;
  const viewport = viewportOf(view.ownerDocument);
  const widest = viewport.width - 2 * panel.viewportMargin;
  for (const name of ['left', 'top', 'maxHeight', 'width'] as const) {
    view.style[name] = '';
  }
  const scroller = view.querySelector<HTMLElement>(TABLE_SCROLL);
  if (scroller) scroller.style.maxHeight = '';
  // On a phone narrower than the minimum, the minimum gives way.
  const minWidth = Math.max(0, Math.min(panel.minWidth, widest));
  view.style.minWidth = `${minWidth}px`;
  let maxWidth = Math.max(minWidth, Math.min(panel.maxWidth, widest));
  view.style.maxWidth = `${maxWidth}px`;
  view.classList.toggle(
    NARROW_CLASS,
    view.getBoundingClientRect().width < panel.narrowBelow,
  );
  // Many series of large values: give the table the room it needs before
  // it would have to scroll sideways.
  const short = (): number =>
    scroller ? scroller.scrollWidth - scroller.clientWidth : 0;
  if (short() > 0) {
    maxWidth = Math.max(maxWidth, Math.min(widest, maxWidth + short()));
    view.style.maxWidth = `${maxWidth}px`;
  }
  // Still too wide: pack the cells tighter, with dates under the values,
  // before it has to scroll sideways.
  if (short() > 0) view.classList.add(NARROW_CLASS);
  // At left: 0; top: 0 the panel sits at its containing block's origin:
  // the viewport's, unless a transformed ancestor contains it.
  const natural = view.getBoundingClientRect();
  const origin = {left: natural.left, top: natural.top};
  const scale = {
    x: view.offsetWidth > 0 ? natural.width / view.offsetWidth : 1,
    y: view.offsetHeight > 0 ? natural.height / view.offsetHeight : 1,
  };
  const anchor = anchorFor(button, root);
  const extra = natural.height - (scroller?.offsetHeight ?? 0) * scale.y;
  const placed = placement(anchor, natural, viewport);
  setStyle(view, 'maxHeight', placed.maxHeight / scale.y);
  capTable(view, placed.maxHeight / scale.y, extra / scale.y);
  // Capping the height can add the table's scrollbar, widening the panel,
  // so the left edge is fitted to the width it ends up with.
  const capped = view.getBoundingClientRect();
  const {left} = placement(
    anchor,
    {width: capped.width, height: natural.height},
    viewport,
  );
  setPosition(view, {left, top: placed.top}, origin, scale);
  // Pinned: a shrink-to-fit panel would make the browser re-measure every
  // row's width each time rows are added. The table's sizer row (see
  // `content.ts`) already gave it room for the widest values.
  view.style.width = `${capped.width / scale.x}px`;
  return {natural: natural.height, extra, scale};
}

/**
 * Moves an open panel after its button moved (scrolling) or it grew (rows
 * filling in), from one read of the layout, writing only what changes.
 */
function repositionFloating(
  view: HTMLElement,
  button: HTMLElement,
  root: HTMLElement,
  {natural, extra, scale}: Sized,
): void {
  const rect = view.getBoundingClientRect();
  // Where its containing block is now: it may have scrolled with the page.
  const origin = {
    left: rect.left - (parseFloat(view.style.left) || 0) * scale.x,
    top: rect.top - (parseFloat(view.style.top) || 0) * scale.y,
  };
  const placed = placement(
    anchorFor(button, root),
    {width: rect.width, height: Math.max(natural, rect.height)},
    viewportOf(view.ownerDocument),
  );
  setPosition(view, placed, origin, scale);
  setStyle(view, 'maxHeight', placed.maxHeight / scale.y);
  capTable(view, placed.maxHeight / scale.y, extra / scale.y);
}

/**
 * A chart without provenance still gets the button, because the table is
 * the one place its exact values can be read, by anyone, and the way
 * screen reader users browse them.
 */
export function renderDetails(
  root: HTMLElement,
  spec: ResolvedSpec,
  model: ChartModel,
  {id, titleId, tile, motion, signal}: DetailsOptions,
): DetailsHandle | null {
  // A chart that is loading without data has an empty model; one that is
  // refreshing still has its data to tabulate.
  const hasTable = !model.empty;
  if (!spec.details || (!spec.provenance && !hasTable)) return null;
  const doc = root.ownerDocument;
  const viewId = `${id}-view`;

  const trigger = html(doc, 'span', 'sc-details-trigger');
  const button = html(doc, 'button', 'sc-info');
  button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', viewId);
  button.setAttribute('aria-label', MESSAGES.details);
  const label = html(doc, 'span', 'sc-info-label', MESSAGES.detailsHint);
  label.setAttribute('aria-hidden', 'true');
  button.append(glyph(doc, INFO_GLYPH), label);
  trigger.appendChild(button);

  const view = html(doc, 'section', 'sc-details');
  view.id = viewId;
  view.hidden = true;
  // Built on first open and kept until the next render: the table grows
  // with the data (a few elements per point per series), and a chart whose
  // details are never opened should not pay for it. The closed view is
  // hidden, so nothing reads it before then.
  let built: HTMLElement | null = null;
  const build = (): HTMLElement => {
    if (built) return built;
    const {content, table} = detailsContent(doc, {
      spec,
      table: hasTable ? dataTable(model, spec) : null,
      notes: detailsNotes(model),
    });
    view.appendChild(content);
    if (table) {
      table.fill(FIRST_ROWS);
      const fillMore = frameScheduler(
        view,
        () => {
          table.fill(ROWS_PER_FRAME);
          if (!table.done()) fillMore();
        },
        signal,
      );
      if (!table.done()) fillMore();
    }
    // The scrolling area takes focus on open, so the arrow keys scroll it;
    // as a region it is announced by the chart's title.
    content.setAttribute('role', 'region');
    content.setAttribute('aria-labelledby', titleId);
    content.tabIndex = -1;
    built = content;
    return built;
  };

  // In place over the plot area when everything fits there; otherwise, and
  // always for a KPI tile, a panel floating by the info button.
  let floating = tile;
  const placeInPlace = (): void => {
    const area = root.querySelector<HTMLElement>(PLOT_AREA);
    if (area) view.style.top = `${area.offsetTop}px`;
    view.classList.toggle(
      NARROW_CLASS,
      view.clientWidth < tokens.details.panel.narrowBelow,
    );
  };
  // The panel's height before the cap: what it would take with room.
  let sized: Sized = {natural: 0, extra: 0, scale: {x: 1, y: 1}};
  const place = (): void => {
    if (floating) sized = placeFloating(view, button, root);
    else placeInPlace();
  };
  const setMode = (next: boolean): void => {
    floating = next;
    view.classList.toggle(FLOATING_CLASS, next);
    root.classList.toggle(OPEN_CLASS, !next);
    view.removeAttribute('style');
    view.classList.remove(NARROW_CLASS);
  };
  const covered = (): Element[] =>
    floating ? [] : [...root.querySelectorAll(COVERED)];
  const isOpen = (): boolean => !view.hidden;
  // Immediate: the view is positioned out of flow, so placing it cannot
  // change the size of what is observed. The view itself grows as the
  // table fills in, which can move a panel opened above the button.
  observeSize(root, () => isOpen() && place(), {immediate: true, signal});
  // Moves the panel at most once a frame, however many rows or scrolls
  // asked for it since the last.
  const follow = frameScheduler(
    view,
    () => {
      if (isOpen() && floating) repositionFloating(view, button, root, sized);
    },
    signal,
  );
  observeSize(
    view,
    ({height}) => {
      if (!isOpen() || !floating) return;
      // At its cap the panel stops growing and only the table scrolls.
      if (height >= parseFloat(view.style.maxHeight)) return;
      // Below the cap, its height is its own: rows filling in add to it.
      // The observer reports layout pixels and `natural` is in viewport
      // pixels, which differ under a scaled ancestor.
      const rendered = height * sized.scale.y;
      if (rendered > sized.natural) sized = {...sized, natural: rendered};
      follow();
    },
    {box: 'border-box', immediate: true, signal},
  );
  const win = doc.defaultView;
  // Only while a floating panel is open, so closed charts cost nothing as
  // the page scrolls.
  let watchingViewport: AbortController | null = null;
  const unwatchViewport = (): void => {
    watchingViewport?.abort();
    watchingViewport = null;
  };
  signal.addEventListener('abort', unwatchViewport, {once: true});
  const watchViewport = (): void => {
    unwatchViewport();
    watchingViewport = new AbortController();
    const listen = {signal: watchingViewport.signal};
    win?.addEventListener('resize', place, listen);
    // Capture: a scroll in any container moves the button too, except the
    // panel's own table scrolling.
    doc.addEventListener(
      'scroll',
      (event) => {
        if (!inside(view, event.target)) follow();
      },
      {...listen, capture: true, passive: true},
    );
  };

  const open = (): void => {
    root.querySelector(PLOT_AREA)?.dispatchEvent(new Event('pointerleave'));
    const content = build();
    view.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    setMode(tile);
    place();
    const scrollers = [content, ...content.querySelectorAll(TABLE_SCROLL)];
    if (!floating && scrollers.some(hasOverflow)) {
      setMode(true);
      place();
    }
    if (floating) watchViewport();
    content.scrollTop = 0;
    motion.crossFade(covered(), [view]);
    content.focus({preventScroll: true});
    const Opened = win?.CustomEvent ?? CustomEvent;
    doc.dispatchEvent(new Opened(OPENED_EVENT, {detail: view}));
  };
  const close = ({restoreFocus}: {restoreFocus: boolean}): void => {
    const wasCovered = covered();
    view.hidden = true;
    unwatchViewport();
    // A floating panel's own class and placement go too, so nothing it set
    // can keep the closed view on screen.
    view.classList.remove(FLOATING_CLASS, NARROW_CLASS);
    view.removeAttribute('style');
    root.classList.remove(OPEN_CLASS);
    button.setAttribute('aria-expanded', 'false');
    motion.crossFade([], wasCovered);
    if (restoreFocus) button.focus({preventScroll: true});
  };

  const options = {signal};
  button.addEventListener(
    'click',
    () => (isOpen() ? close({restoreFocus: true}) : open()),
    options,
  );
  button.addEventListener(
    'pointerenter',
    () => placeLabel(root, label),
    options,
  );
  button.addEventListener('focus', () => placeLabel(root, label), options);
  // On the document: after a press inside a panel on something that
  // can't take focus, focus falls back to the page, outside the chart. A
  // floating panel closes on Escape wherever focus is; the in-place view
  // only when focus is in the chart. Focus returns to the button unless
  // the reader has moved it somewhere else.
  doc.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !isOpen()) return;
      // The chart's own document or shadow root knows which of its
      // elements has focus; the document would only name a shadow host.
      const focused = (root.getRootNode() as Document | ShadowRoot)
        .activeElement;
      const lost = !doc.activeElement || doc.activeElement === doc.body;
      if (!floating && !inside(root, focused)) return;
      event.preventDefault();
      close({restoreFocus: lost || inside(root, focused)});
    },
    options,
  );
  doc.addEventListener(
    OPENED_EVENT,
    (event) => {
      const opened = (event as CustomEvent<unknown>).detail;
      if (opened !== view && isOpen() && floating) close({restoreFocus: false});
    },
    options,
  );
  // A floating panel covers other content, so a press or focus elsewhere
  // dismisses it, leaving focus where the reader put it.
  onOutsidePress(
    root,
    doc,
    () => {
      if (isOpen() && floating) close({restoreFocus: false});
    },
    signal,
  );
  root.addEventListener(
    'focusout',
    (event) => {
      // Only when focus lands on another element: focus falling back to
      // the page (no element; some engines report the document) is not
      // the reader moving on.
      const next = event.relatedTarget;
      const element =
        typeof next === 'object' &&
        next !== null &&
        'nodeType' in next &&
        (next as Node).nodeType === 1;
      if (isOpen() && floating && element && !inside(root, next))
        close({restoreFocus: false});
    },
    options,
  );
  return {trigger, view};
}
