import {tooltipPosition} from './tooltip';

describe('tooltipLeft', () => {
  it('centres on the crosshair, but moves beside it rather than cover the hovered points', () => {
    const base = {
      width: 100,
      height: 60,
      top: 0,
      containerWidth: 400,
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
  });
});
