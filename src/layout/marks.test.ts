import {decimateLine} from './marks';

describe('decimateLine', () => {
  it('keeps the first, lowest, highest and last point of each pixel column, and gaps', () => {
    const column = [
      {x: 0.1, y: 50},
      {x: 0.3, y: 90}, // lowest on screen (largest y)
      {x: 0.5, y: 60},
      {x: 0.7, y: 10}, // highest on screen
      {x: 0.9, y: 40},
    ];
    expect(decimateLine([...column, null, {x: 1.2, y: 5}])).toEqual([
      {x: 0.1, y: 50},
      {x: 0.3, y: 90},
      {x: 0.7, y: 10},
      {x: 0.9, y: 40},
      null,
      {x: 1.2, y: 5},
    ]);

    // 10,000 points over 300 pixels: at most four vertices per column.
    const long = Array.from({length: 10_000}, (_, i) => ({
      x: (i / 10_000) * 300,
      y: Math.sin(i),
    }));
    expect(decimateLine(long).length).toBeLessThanOrEqual(4 * 300);
  });
});
