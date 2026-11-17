import {layoutOffsetX} from './dom';

function element(rect: {left: number; width: number}, offsetWidth: number) {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({left: rect.left, width: rect.width} as DOMRect);
  Object.defineProperty(el, 'offsetWidth', {value: offsetWidth});
  return el;
}

describe('layoutOffsetX', () => {
  it('converts a pointer under a scaled ancestor to layout pixels', () => {
    // A 400px-wide plot drawn at half size starting at x = 100.
    expect(layoutOffsetX(element({left: 100, width: 200}, 400), 300)).toBe(400);
  });

  it('is the plain offset when nothing is scaled', () => {
    expect(layoutOffsetX(element({left: 20, width: 300}, 300), 170)).toBe(150);
  });
});
