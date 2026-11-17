// A resize callback that changes layout can resize the observed element mid-delivery,
// which browsers report as "ResizeObserver loop completed with undelivered
// notifications". Work therefore runs in the next frame, once per frame.

/** A width and height in CSS pixels. */
export type Size = {width: number; height: number};

/** Options for {@link observeSize}. */
export type ObserveOptions = {
  /** Which box to measure. Defaults to the content box. */
  box?: ResizeObserverBoxOptions;
  /**
   * Call back inside the observer's delivery instead of the next frame.
   * Only for callbacks that cannot change the observed element's size (the
   * plot's absolutely positioned SVG). Defaults to false.
   */
  immediate?: boolean;
  /** Stops observing and cancels a pending callback when aborted. */
  signal: AbortSignal;
};

function sizeOf(
  entry: ResizeObserverEntry,
  box: ResizeObserverBoxOptions,
): Size {
  const border = box === 'border-box' ? entry.borderBoxSize?.[0] : undefined;
  if (border) return {width: border.inlineSize, height: border.blockSize};
  return {width: entry.contentRect.width, height: entry.contentRect.height};
}

/**
 * Calls `onResize` with `element`'s size after it changes, at most once per
 * animation frame and never inside the observer's own callback (unless
 * `immediate`). The first call comes with the first layout. Pages without
 * animation frames get the call at once. Returns false, calling nothing,
 * on pages without ResizeObserver.
 */
export function observeSize(
  element: Element,
  onResize: (size: Size) => void,
  {box = 'content-box', immediate = false, signal}: ObserveOptions,
): boolean {
  if (typeof ResizeObserver === 'undefined') return false;
  const view = element.ownerDocument.defaultView;
  let latest: Size | null = null;
  let frame: number | null = null;
  const flush = (): void => {
    frame = null;
    if (latest) onResize(latest);
  };
  const observer = new ResizeObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (!entry) return;
    latest = sizeOf(entry, box);
    if (frame !== null) return;
    if (!immediate && view?.requestAnimationFrame) {
      frame = view.requestAnimationFrame(flush);
    } else {
      flush();
    }
  });
  observer.observe(element, {box});
  // Not registered with `signal` itself: aborting removes such listeners
  // before the abort event fires.
  signal.addEventListener(
    'abort',
    () => {
      observer.disconnect();
      if (frame !== null) view?.cancelAnimationFrame(frame);
    },
    {once: true},
  );
  return true;
}

/**
 * Runs `callback` in the next animation frame, at most once however often
 * it is asked for before then; at once on pages without animation frames.
 * Cancelled when `signal` aborts. For layout work triggered from a resize
 * callback that may change the size of something being observed.
 */
export function frameScheduler(
  element: Element,
  callback: () => void,
  signal: AbortSignal,
): () => void {
  const view = element.ownerDocument.defaultView;
  let frame: number | null = null;
  signal.addEventListener(
    'abort',
    () => {
      if (frame !== null) view?.cancelAnimationFrame(frame);
    },
    {once: true},
  );
  return () => {
    if (frame !== null || signal.aborted) return;
    if (!view?.requestAnimationFrame) {
      callback();
      return;
    }
    frame = view.requestAnimationFrame(() => {
      frame = null;
      callback();
    });
  };
}
