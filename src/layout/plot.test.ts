import {tokens} from '../tokens';
import type {PlotInput} from './plot';
import {barRects} from './marks';
import {layoutPlot} from './plot';
import type {XLabel} from './xAxis';

// A 100px plot area leaves about 60px of plot once the insets and x labels
// are taken out: too short for three ticks at the minimum spacing.
const SHORT: Omit<PlotInput, 'yDomain'> = {
  width: 400,
  height: 100,
  chartType: 'line',
  times: [0, 1, 2, 3].map((day) => Date.UTC(2026, 10, 27 + day)),
  timeZone: 'UTC',
  seriesCount: 1,
  formatYTicks: (values) => values.map(String),
  formatXTick: () => '',
  measure: (text) => text.length * 7,
};

describe('layoutPlot y ticks', () => {
  it('keeps ticks the minimum distance apart on a short plot, with a domain the data fills', () => {
    // A $252K-$456K line, as the model pads it for a line chart.
    const layout = layoutPlot({...SHORT, yDomain: [239760, 462120]});
    expect(layout.plot.height).toBeLessThan(2 * tokens.axis.yTickMinSpacing);
    // At 60px a $100K step would be 27px apart, so the step is $200K: two
    // ticks, the minimum distance apart, on a domain the data still fills.
    expect(layout.yLabels.map((label) => label.value)).toEqual([
      200000, 400000,
    ]);
    const [first, second] = layout.yLabels;
    expect(Math.abs(first.y - second.y)).toBeGreaterThanOrEqual(
      tokens.axis.yTickMinSpacing,
    );
    const [low, high] = layout.yDomain;
    expect((456000 - 252000) / (high - low)).toBeGreaterThan(2 / 3);
  });

  it('draws bars narrower than a pixel one per column, keeping spikes', () => {
    const count = 1000;
    const layout = layoutPlot({
      ...SHORT,
      chartType: 'bar',
      height: 240,
      times: Array.from({length: count}, (_, day) =>
        Date.UTC(2026, 0, 1 + day),
      ),
      yDomain: [0, 100],
    });
    expect(layout.x.step).toBeLessThan(1);
    // Flat data with one spike in the middle.
    const values = Array.from({length: count}, (_, slot) =>
      slot === 500 ? 100 : 10,
    );
    const rects = barRects(values, 0, layout);
    const columns = new Set(rects.map((rect) => rect.x));
    expect(columns.size).toBe(rects.length);
    expect(rects.length).toBeGreaterThanOrEqual(Math.floor(layout.plot.width));
    expect(rects.length).toBeLessThanOrEqual(Math.ceil(layout.plot.width));
    expect(rects.some((rect) => rect.slot === 500)).toBe(true);
  });

  it('reuses x labels across frames of one animation', () => {
    const formatXTick = jest.fn(() => 'Nov 27');
    const xLabelCache = new Map<number, XLabel[]>();
    const frame = (high: number) =>
      layoutPlot({
        ...SHORT,
        height: 240,
        formatXTick,
        xLabelCache,
        yDomain: [0, high],
      });
    // Two frames of a y tween with the same y label widths ("0".."90").
    const first = frame(90);
    const calls = formatXTick.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    const second = frame(80);
    expect(formatXTick.mock.calls.length).toBe(calls);
    expect(second.xLabels).toBe(first.xLabels);
  });
});
