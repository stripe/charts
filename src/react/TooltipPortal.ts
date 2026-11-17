// A component of its own so a hover re-renders only the tooltip content,
// not <StripeChart> (whose render compares the whole spec).

import {useState} from 'react';
import type {MutableRefObject, ReactNode, ReactPortal} from 'react';
import {createPortal} from 'react-dom';

import {useClientLayoutEffect} from './clientLayoutEffect';

/** Lets the chart's tooltip callback hand content to the portal. */
export type TooltipOutlet = {
  /** Renders `content` into `host`. */
  show(host: HTMLElement, content: ReactNode): void;
  /** Removes the content. */
  clear(): void;
};

type Content = {host: HTMLElement; node: ReactNode};

/**
 * Fills `outlet.current` while mounted. Child effects run before the
 * parent's, so the outlet is ready before the chart is drawn.
 */
export function TooltipPortal({
  outlet,
}: {
  outlet: MutableRefObject<TooltipOutlet | null>;
}): ReactPortal | null {
  const [content, setContent] = useState<Content | null>(null);
  useClientLayoutEffect(() => {
    outlet.current = {
      show: (host, node) => setContent({host, node}),
      clear: () => setContent(null),
    };
    return () => {
      outlet.current = null;
    };
  }, [outlet]);
  return content && createPortal(content.node, content.host);
}
