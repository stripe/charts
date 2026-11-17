// Helpers for stories that are compared against fixed-size screenshots.
//
// The intended screenshot size is recorded in the story's
// parameters, which a screenshot script can read from the running preview
// (`window.__STORYBOOK_PREVIEW__.extract()`); tags would not work because
// Storybook reads them statically from the source.

/** A named screenshot of a story at a fixed viewport, in CSS pixels. */
export type Shot = {name: string; width: number; height: number};

/** Story annotations returned by {@link shot}. */
export type ShotAnnotations = {
  parameters: {shot: Shot};
};

/**
 * Records a screenshot size without constraining normal browsing. Spread it into
 * the story: `export const Bar: StoryObj = {...shot('bar', 800, 640), render}`.
 */
export function shot(
  name: string,
  width: number,
  height: number,
): ShotAnnotations {
  return {
    parameters: {shot: {name, width, height}},
  };
}
