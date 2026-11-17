import {layoutAnnotations} from './annotations';
import {linearScale, slotScale} from './scale';
import {forecastBand, splitByKind} from './segments';

const scales = {
  x: slotScale(10, 200, 'band'),
  y: linearScale([0, 100], [180, 0]),
  plot: {top: 0, bottom: 180, width: 200},
};

describe('layoutAnnotations', () => {
  it('places range boundaries at dates and leaves open plot edges unmarked', () => {
    const {ranges, markers} = layoutAnnotations(
      [
        {kind: 'range', from: 2, to: 3},
        {kind: 'range', from: 8, to: null},
        {kind: 'range', from: null, to: 0},
        {kind: 'range', from: -5, to: 20},
      ],
      scales,
      () => null,
      1,
    );
    expect(ranges).toEqual([
      {index: 0, x: 50, width: 20},
      {index: 1, x: 170, width: 30},
      {index: 2, x: 0, width: 10},
      {index: 3, x: 0, width: 200},
    ]);
    expect(markers).toEqual([
      {index: 0, x: 50.5},
      {index: 0, x: 70.5},
      {index: 1, x: 170.5},
      {index: 2, x: 10.5},
    ]);
  });

  it('keeps incomplete shading across whole slots without boundary markers', () => {
    const {ranges, markers} = layoutAnnotations(
      [{kind: 'range', from: 8, to: 9, wholeSlots: true}],
      scales,
      () => null,
      1,
    );
    expect(ranges).toEqual([{index: 0, x: 160, width: 40}]);
    expect(markers).toEqual([]);
  });
});

describe('splitByKind', () => {
  it('starts each dashed tail at the last point before it', () => {
    const segments = splitByKind(
      [1, 2, 3, 4, 5, 6],
      ['actual', 'actual', 'incomplete', 'incomplete', 'forecast', 'forecast'],
    );
    expect(segments.actual).toEqual([1, 2, null, null, null, null]);
    expect(segments.incomplete).toEqual([null, 2, 3, 4, null, null]);
    expect(segments.forecast).toEqual([null, null, null, 4, 5, 6]);
  });

  it('ends the incomplete tail at the projected value', () => {
    const segments = splitByKind(
      [10, 20, 8],
      ['actual', 'actual', 'incomplete'],
      [null, null, 30],
    );
    expect(segments.actual).toEqual([10, 20, null]);
    expect(segments.incomplete).toEqual([null, 20, 30]);
  });

  it('joins a forecast band where its line starts: at the projection', () => {
    const kinds = ['actual', 'incomplete', 'forecast'] as const;
    const projected = [null, 200, null];
    const line = splitByKind([50, 100, 250], kinds, projected);
    const band = forecastBand(
      [50, 100, 250],
      kinds,
      [null, null, 220],
      [null, null, 280],
      projected,
    );
    expect(line.forecast).toEqual([null, 200, 250]);
    expect(band).toEqual({low: [null, 200, 220], high: [null, 200, 280]});
  });
});
