import {shot} from '../../.storybook/shots';
import type {ShotAnnotations} from '../../.storybook/shots';

export type Pointer = {x: number; y: number};

/**
 * Like `shot`, for a hover state: also records where a screenshot script
 * should move the pointer before capturing (`parameters.pointer`).
 */
export function hoverShot(
  name: string,
  width: number,
  height: number,
  pointer: Pointer,
): ShotAnnotations & {parameters: {pointer: Pointer}} {
  const annotations = shot(name, width, height);
  return {...annotations, parameters: {...annotations.parameters, pointer}};
}
