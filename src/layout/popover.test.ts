import {placePopover, toContainingBlock} from './popover';

const viewport = {width: 390, height: 844};
const base = {viewport, offset: 4, margin: 8};
const anchor = (left: number, top: number) => ({
  left,
  top,
  right: left + 20,
  bottom: top + 20,
});

describe('placePopover', () => {
  it('opens below the anchor when it fits, aligned with it', () => {
    expect(
      placePopover({
        ...base,
        anchor: anchor(40, 100),
        size: {width: 280, height: 300},
      }),
    ).toEqual({side: 'below', left: 40, top: 124, maxHeight: 712});
  });

  it('opens above when only the space above fits', () => {
    const placed = placePopover({
      ...base,
      anchor: anchor(40, 700),
      size: {width: 280, height: 300},
    });
    expect(placed).toMatchObject({side: 'above', top: 396});
  });

  it('takes the larger side and caps its height when neither fits', () => {
    const placed = placePopover({
      ...base,
      anchor: anchor(40, 300),
      size: {width: 280, height: 2000},
    });
    // 512px below against 288px above.
    expect(placed).toEqual({side: 'below', left: 40, top: 324, maxHeight: 512});
  });

  it('shifts left to stay inside the viewport, but never past its left edge', () => {
    expect(
      placePopover({
        ...base,
        anchor: anchor(300, 100),
        size: {width: 280, height: 100},
      }).left,
    ).toBe(102);
    expect(
      placePopover({
        ...base,
        anchor: anchor(300, 100),
        size: {width: 500, height: 100},
      }).left,
    ).toBe(8);
  });
});

describe('toContainingBlock', () => {
  it('leaves viewport positions alone when the viewport contains the panel', () => {
    expect(
      toContainingBlock({left: 40, top: 124}, {left: 0, top: 0}, {x: 1, y: 1}),
    ).toEqual({left: 40, top: 124});
  });

  it('offsets and unscales positions under a transformed ancestor', () => {
    // The ancestor's box starts at (100, 50) and is drawn at half size.
    expect(
      toContainingBlock(
        {left: 140, top: 174},
        {left: 100, top: 50},
        {x: 0.5, y: 0.5},
      ),
    ).toEqual({left: 80, top: 248});
  });
});
