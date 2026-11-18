import {tooltipPosition} from './tooltip';

describe('tooltipLeft', () => {
  it('centres on the crosshair, but moves beside it rather than cover the hovered points', () => {
    const base = {
      width: 100,
      height: 60,
      top: 0,
      containerWidth: 400,
      containerHeight: 200,
      sideGap: 12,
    };
    // Points below the tooltip: centred.
    expect(
      tooltipPosition({...base, anchor: 200, avoid: {top: 80, bottom: 90}}),
    ).toEqual({left: 150, top: 0});
    // Points under it: to the right of the crosshair...
    expect(
      tooltipPosition({...base, anchor: 200, avoid: {top: 20, bottom: 30}}),
    ).toEqual({left: 212, top: 0});
    // ...or to the left when the right side has no room.
    expect(
      tooltipPosition({...base, anchor: 350, avoid: {top: 20, bottom: 30}}),
    ).toEqual({left: 238, top: 0});
    // ...or above them when neither side has room (a narrow chart).
    const narrow = {...base, containerWidth: 150, anchor: 75};
    expect(
      tooltipPosition({...narrow, avoid: {top: 90, bottom: 100}, top: 40}),
    ).toEqual({left: 25, top: 18});
    // ...or below them when there is no room above.
    expect(
      tooltipPosition({...narrow, avoid: {top: 50, bottom: 60}, top: 40}),
    ).toEqual({left: 25, top: 72});
  });

  it('stays inside the container rather than overflow its bottom', () => {
    const tiny = {
      width: 100,
      height: 60,
      containerWidth: 150,
      containerHeight: 100,
      anchor: 75,
      sideGap: 12,
    };
    // No room above or below the points: back at the fixed top, over them.
    expect(
      tooltipPosition({...tiny, avoid: {top: 40, bottom: 50}, top: 10}),
    ).toEqual({left: 25, top: 10});
    // A fixed top too low for the tooltip's height moves up to fit.
    expect(tooltipPosition({...tiny, avoid: null, top: 70})).toEqual({
      left: 25,
      top: 40,
    });
    // Taller than the container: pinned to its top.
    expect(
      tooltipPosition({...tiny, height: 140, avoid: null, top: 10}),
    ).toEqual({left: 25, top: 0});
  });
});
