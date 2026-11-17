import {barBands, slotPixels} from './scale';

describe('bar widths', () => {
  it('keeps the reference gaps, collapses them for thin bars, and tiles dense slots in whole pixels', () => {
    // A 20px slot, two series: 80% group, two 8px bars, 2px gaps either side.
    expect(barBands(20, 2, 0.8, 2)).toEqual([
      {offset: -8, width: 8},
      {offset: 0, width: 8},
    ]);
    // A 4px slot would give 1.6px bars; the gaps shrink until they are 2px.
    expect(barBands(4, 2, 0.8, 2)).toEqual([
      {offset: -2, width: 2},
      {offset: 0, width: 2},
    ]);
    // Slots too narrow for side-by-side bars are overlaid in whole-pixel
    // columns: 2.025px slots are each 2 or 3px wide and tile with no gap or
    // overlap.
    const step = 243 / 120;
    const columns = Array.from({length: 120}, (_, i) => slotPixels(i, step));
    columns.forEach((column, i) => {
      expect([2, 3]).toContain(column.width);
      const previous = columns[i - 1];
      if (previous) expect(column.x).toBe(previous.x + previous.width);
    });
  });
});
