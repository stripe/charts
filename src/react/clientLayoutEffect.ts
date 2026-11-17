import {useEffect, useLayoutEffect} from 'react';

/**
 * `useLayoutEffect` in the browser, so charts are drawn before the browser
 * paints and the first measurement sees the final layout. On the server,
 * where layout effects never run and React 18 warns about them, the plain
 * effect is used instead.
 */
export const useClientLayoutEffect: typeof useLayoutEffect =
  typeof document === 'undefined' ? useEffect : useLayoutEffect;
