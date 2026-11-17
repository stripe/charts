import {linearScale, slotScale} from '../../layout/scale';
import {projectedExtension, projectedMarkers} from './kinds';

describe('projectedExtension', () => {
  it('outlines from the actual top to the projected height, open at the bar', () => {
    const path = projectedExtension(document, {x: 10, width: 20}, 100, 40);
    // Up the left side from the actual top, across the projected end
    // (inset half the 1px stroke), down the right side.
    expect(path?.getAttribute('d')).toBe('M10.5,100V40.5H29.5V100');
    expect(
      projectedExtension(document, {x: 10, width: 20}, 100, 100),
    ).toBeNull();
  });
});

describe('projectedMarkers', () => {
  const layout = {
    x: slotScale(3, 200, 'point'),
    y: linearScale([0, 100], [100, 0]),
  };

  it('joins the so-far marker to the projected value at the same x', () => {
    const group = projectedMarkers(document, [2], [10, 20, 30], layout, [
      null,
      null,
      80,
    ]);
    const connector = group.querySelector('.sc-projected-connector');
    // x on a crisp pixel at the slot; from the marker's edge (y 70, minus the
    // 3px radius and half the 2px ring) up to the projection (y 20).
    expect(
      ['x1', 'x2', 'y1', 'y2'].map((a) => connector?.getAttribute(a)),
    ).toEqual(['200.5', '200.5', '66', '20']);
    expect(
      group.querySelector('.sc-projected-marker')?.getAttribute('cy'),
    ).toBe('70');
  });

  it('draws no connector without a projection', () => {
    const group = projectedMarkers(document, [2], [10, 20, 30], layout);
    expect(group.querySelector('.sc-projected-connector')).toBeNull();
  });
});
