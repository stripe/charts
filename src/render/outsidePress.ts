// Document listeners cannot tell where a press inside a shadow root landed:
// the target is retargeted to the host, and in a closed root the composed
// path seen from outside omits the inner nodes too. So the element marks its
// own presses as they pass through it, and the document listener ignores those.

/**
 * Calls `onOutside` for every press on `doc` that did not start inside
 * `element`, until `signal` aborts.
 */
export function onOutsidePress(
  element: Element,
  doc: Document,
  onOutside: () => void,
  signal: AbortSignal,
): void {
  let insidePress: Event | null = null;
  element.addEventListener(
    'pointerdown',
    (event) => {
      insidePress = event;
    },
    {signal},
  );
  doc.addEventListener(
    'pointerdown',
    (event) => {
      if (event !== insidePress) onOutside();
      insidePress = null;
    },
    {signal},
  );
}
