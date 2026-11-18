import schema from './schema.json';
import {FIELDS, LIMITS} from './spec';
import {validate} from './validate';
import {validateOptions} from './validateOptions';

const valid = {
  title: 'Gross volume',
  timeZone: 'America/New_York',
  format: {style: 'currency', currency: 'usd', unit: 'major'},
  kpi: {value: 412000.25, basis: 'total', comparisonValue: 350100},
  series: [
    {label: '2026', data: [{x: '2026-11-27', y: 412000.25}]},
    {label: '2025', comparison: true, data: [{x: '2025-11-28', y: 350100}]},
  ],
};

function errorsFor(spec: unknown) {
  const result = validate(spec);
  if (result.ok) throw new Error('expected the spec to be invalid');
  return result.errors;
}

describe('validate', () => {
  it('accepts a full spec', () => {
    expect(validate(valid)).toEqual({ok: true, spec: valid});
  });

  it('accepts twelve series and rejects a thirteenth', () => {
    const series = Array.from({length: 12}, (_, index) => ({
      label: `Series ${index + 1}`,
      data: [{x: '2026-10-01', y: index + 1}],
    }));
    expect(validate({title: 'Series palette', series}).ok).toBe(true);
    expect(
      errorsFor({
        title: 'Series palette',
        series: [...series, {label: 'Series 13', data: []}],
      }),
    ).toEqual([{path: 'series', message: 'expected 1 to 12 items, got 13'}]);
    expect(schema.properties.series.maxItems).toBe(LIMITS.maxSeries);
  });

  it('reports every realistic mistake with its path and what was expected', () => {
    const {title: _title, ...noTitle} = valid;
    const errors = errorsFor({
      ...noTitle,
      timeZone: 'US/Nowhere',
      format: {style: 'currency', unit: 'cents'},
      kpi: {value: '1284300', comparison_value: 1012400},
      series: [
        {
          label: '2026',
          data: [
            {x: 'Nov 27', y: 1},
            {x: '2026-11-28', y: Number.NaN},
          ],
        },
      ],
    });
    expect(errors).toEqual([
      {path: 'title', message: 'required; expected a non-empty string'},
      {
        path: 'format.unit',
        message:
          'expected one of "minor", "major", got "cents"; did you mean "minor"?',
      },
      {
        path: 'format.currency',
        message:
          'required when format.style is "currency"; expected an ISO 4217 code like "usd"',
      },
      {
        path: 'timeZone',
        message: '"US/Nowhere" is not an IANA time zone this browser supports',
      },
      {
        path: 'kpi.comparison_value',
        message:
          'unexpected field "comparison_value"; did you mean "comparisonValue"?',
      },
      {
        path: 'kpi.value',
        message: 'expected a finite number, got "1284300"',
      },
      {
        path: 'kpi.basis',
        message:
          'required; expected how kpi.value relates to the primary series: "total" (its sum), "latest" (its last value), "average" (its mean), or "custom" for a figure computed elsewhere',
      },
      {
        path: 'series[0].data[0].x',
        message:
          'expected an ISO date like "2026-11-27" or a date-time like "2026-11-27T18:00:00Z", got "Nov 27"',
      },
      {
        path: 'series[0].data[1].y',
        message: 'expected a finite number or null, got the number NaN',
      },
    ]);
  });

  it('allows stacking only for bars without comparison series', () => {
    const {series} = valid;
    expect(
      errorsFor({...valid, chart: {type: 'line', stacking: 'stacked'}}),
    ).toEqual([
      {
        path: 'chart.stacking',
        message: 'only allowed when chart.type is "bar"; got chart.type "line"',
      },
    ]);
    expect(
      errorsFor({...valid, chart: {type: 'bar', stacking: 'stacked'}, series}),
    ).toEqual([
      {
        path: 'series[1].comparison',
        message:
          'comparison series can\'t be stacked; use chart.stacking "grouped" or remove "comparison"',
      },
    ]);
  });

  it('does not require series while loading, and allows them on KPI tiles', () => {
    expect(validate({title: 'Gross volume', loading: true}).ok).toBe(true);
    // A KPI chart's series, comparison included, draw a sparkline.
    expect(validate({...valid, chart: {type: 'kpi'}}).ok).toBe(true);
  });

  it('rejects years before 1000 and mixed date forms, naming the point', () => {
    const point = (x: string) => ({x, y: 1});
    expect(
      errorsFor({
        title: 'Gross volume',
        series: [
          {label: '2026', data: [point('0026-11-27'), point('2026-11-28')]},
          {label: '2025', data: [point('2025-11-28T05:00:00Z')]},
        ],
      }),
    ).toEqual([
      {
        path: 'series[0].data[0].x',
        message:
          'expected a year from 1000 on, got "0026-11-27"; write the full year, like "2026-11-27"',
      },
      {
        path: 'series[1].data[0].x',
        message:
          'expected a date like "2026-11-27", as series[0].data[1].x is; dates and date-times can\'t be mixed in one chart, got "2025-11-28T05:00:00Z"',
      },
      // A date-time needs the zone it was reported in.
      {
        path: 'timeZone',
        message:
          'required because series[1].data[0].x is a date-time; expected the IANA time zone the data was reported in, like "America/New_York", or "UTC" if its times are UTC',
      },
    ]);
  });

  it('requires a percent unit and checks the KPI against its basis', () => {
    expect(
      errorsFor({...valid, format: {style: 'percent'}, kpi: undefined}),
    ).toEqual([
      {
        path: 'format.unit',
        message:
          'required for percent; use "ratio" if 0.025 means 2.5%, or "percent" if 2.5 means 2.5%',
      },
    ]);
    expect(errorsFor({...valid, kpi: {...valid.kpi, value: 300000}})).toEqual([
      {
        path: 'kpi.value',
        message:
          'expected about 412000.25 for basis "total" (the sum of series[0]\'s actual values), got the number 300000; fix the value, pick the basis that matches it, or use "custom" for a figure computed differently',
      },
    ]);
    // Within 0.5%: a rounded or separately aggregated total still matches.
    expect(validate({...valid, kpi: {...valid.kpi, value: 413000}}).ok).toBe(
      true,
    );
  });

  it('rejects values too large to chart, which used to hang the axis', () => {
    const tooLarge = 'expected a number from -1e15 to 1e15, got the number';
    const hint =
      'larger values lose precision, so give them in a larger unit (thousands or millions) and say so in the title';
    expect(
      errorsFor({
        ...valid,
        kpi: undefined,
        series: [
          {
            label: '2026',
            data: [
              {x: '2026-11-27', y: -1e308},
              {x: '2026-11-28', y: 1e308},
            ],
          },
        ],
      }),
    ).toEqual([
      {path: 'series[0].data[0].y', message: `${tooLarge} -1e+308; ${hint}`},
      {path: 'series[0].data[1].y', message: `${tooLarge} 1e+308; ${hint}`},
    ]);
  });

  it('checks annotations, forecasts and the incomplete period against the data', () => {
    const point = (x: string, y: number, extra = {}) => ({x, y, ...extra});
    const spec = {
      title: 'MRR',
      chart: {type: 'line', incomplete: {from: '2026-04-01'}},
      series: [
        {
          label: '2026',
          color: 'red',
          data: [
            point('2026-01-01', 10),
            point('2026-02-01', 11, {forecast: true, low: 12, high: 13}),
            point('2026-03-01', 12),
            point('2026-04-01', 13, {forecast: true}),
          ],
        },
      ],
      annotations: [
        {label: 'Launch', at: '2026-02-15'},
        {label: 'Promo', at: '2026-01-01', to: '2026-02-01'},
      ],
    };
    expect(errorsFor(spec)).toEqual([
      {
        path: 'series[0].color',
        message: 'expected a hex color like "#635bff" or "#fff", got "red"',
      },
      {
        path: 'series[0].data[1].low',
        message: 'expected at most y (11), got the number 12',
      },
      {
        path: 'series[0].data[2].forecast',
        message:
          'expected true: forecast points must run to the end of the series, and series[0].data[1] is already a forecast; move actual points before it',
      },
      {
        path: 'chart.incomplete.from',
        message:
          'expected an x value before the forecast, which starts at "2026-02-01"; the incomplete period is actual data and ends where the forecast begins',
      },
      {
        path: 'annotations[0].at',
        message:
          'expected an x value of the primary series, written exactly as there (series line up by position), got "2026-02-15"; nearest are "2026-02-01", "2026-03-01", "2026-01-01"',
      },
      {
        path: 'annotations[1]',
        message:
          'expected either "at" (a marker) or "from"/"to" (a range), not both',
      },
    ]);
  });

  it('requires unique series labels and times for time labels', () => {
    const data = [{x: '2026-01-01', y: 1}];
    expect(
      errorsFor({
        title: 'Volume',
        chart: {type: 'line', axes: {x: {labels: 'time'}}},
        series: [
          {label: '2025', data},
          {label: '2025', data},
        ],
      }),
    ).toEqual([
      {
        path: 'series[1].label',
        message:
          '"2025" is already used by series[0]; labels name series in the legend, tooltip and onLegendChange, so each must be unique',
      },
      {
        path: 'chart.axes.x.labels',
        message:
          '"time" needs date-time x values, and the series has dates like "2026-01-01"; use "day" or "auto"',
      },
    ]);
  });

  it('compares the KPI with like periods of the comparison series', () => {
    const months = Array.from({length: 6}, (_, i) => `2026-0${i + 1}-01`);
    // Actuals for 4 months, then a forecast; the plan runs all 6 months.
    const spec = (comparisonValue: number) => ({
      title: 'MRR',
      kpi: {value: 13, basis: 'latest', comparisonValue},
      series: [
        {
          label: 'Actual',
          data: months.map((x, i) =>
            i < 4 ? {x, y: 10 + i} : {x, y: 20, forecast: true},
          ),
        },
        {
          label: 'Plan',
          comparison: true,
          data: months.map((x, i) => ({x, y: 100 + i})),
        },
      ],
    });
    expect(validate(spec(103)).ok).toBe(true);
    expect(errorsFor(spec(105))).toEqual([
      {
        path: 'kpi.comparisonValue',
        message:
          'expected about 103 for basis "latest" (series[1]\'s value at slot 3, where series[0]\'s latest actual value is), got the number 105; fix the value, pick the basis that matches it, or use "custom" for a figure computed differently',
      },
    ]);
    // A shorter comparison is summed over the slots both series have.
    expect(
      validate({
        title: 'Orders',
        kpi: {value: 33, basis: 'total', comparisonValue: 11},
        series: [
          {
            label: '2026',
            data: months.slice(0, 3).map((x, i) => ({x, y: 10 + i})),
          },
          {
            label: '2025',
            comparison: true,
            data: months.slice(0, 2).map((x, i) => ({x, y: 5 + i})),
          },
        ],
      }).ok,
    ).toBe(true);
  });

  it('allows projected only on incomplete actual points of the measured series', () => {
    const months = ['2026-09-01', '2026-10-01', '2026-11-01'];
    const errors = errorsFor({
      title: 'Volume',
      chart: {type: 'bar', incomplete: {from: '2026-11-01'}},
      // The KPI uses the value so far (30), not the projection.
      kpi: {value: 30, basis: 'latest'},
      series: [
        {
          label: '2026',
          data: [
            {x: months[0], y: 10, projected: 12},
            {x: months[1], y: 20},
            {x: months[2], y: 30, projected: 45},
          ],
        },
        {
          label: '2025',
          comparison: true,
          data: [
            {x: months[0], y: 9},
            {x: months[1], y: 19},
            {x: months[2], y: 29, projected: 31},
          ],
        },
      ],
    });
    expect(errors).toEqual([
      {
        path: 'series[0].data[0].projected',
        message:
          'only for points inside chart.incomplete (from "2026-11-01"); this point is final, so leave out "projected"',
      },
      {
        path: 'series[1].data[2].projected',
        message:
          'only for the series being measured; a comparison series is final data',
      },
    ]);
  });

  it('rejects a bar projection short of the value so far, but not a line one', () => {
    const spec = {
      title: 'Conversion rate',
      format: {style: 'percent', unit: 'percent'},
      chart: {type: 'bar', incomplete: {from: '2026-11-01'}},
      series: [
        {
          label: '2026',
          data: [
            {x: '2026-10-01', y: 4},
            {x: '2026-11-01', y: 4.2, projected: 3.9},
          ],
        },
      ],
    } as const;
    expect(errorsFor(spec)).toEqual([
      {
        path: 'series[0].data[1].projected',
        message:
          'expected at least y (4.2) on a bar chart, since the projection extends the bar beyond the value so far; use a line chart for a value on pace to end lower',
      },
    ]);
    expect(validate({...spec, chart: {...spec.chart, type: 'line'}}).ok).toBe(
      true,
    );
  });

  it('leaves forecast points out of the KPI basis', () => {
    expect(
      validate({
        title: 'MRR',
        kpi: {value: 12, basis: 'latest'},
        series: [
          {
            label: '2026',
            data: [
              {x: '2026-01-01', y: 10},
              {x: '2026-02-01', y: 12},
              {x: '2026-03-01', y: 15, forecast: true},
            ],
          },
        ],
      }).ok,
    ).toBe(true);
  });

  it('rejects malformed currency codes and truncates long received values', () => {
    const errors = errorsFor({
      ...valid,
      format: {style: 'currency', currency: 'dollars', unit: 'major'},
      kpi: {...valid.kpi, basis: 'custom'},
      description: 1,
      series: [{label: 'x'.repeat(60), data: [{x: '2026-11-27', y: 1}]}],
    });
    expect(errors).toEqual([
      {
        path: 'description',
        message: 'expected a string, got the number 1',
      },
      {
        path: 'format.currency',
        message: 'expected a 3-letter ISO 4217 code like "usd", got "dollars"',
      },
    ]);
    expect(
      errorsFor({...valid, chart: {type: 'x'.repeat(60)}})[0].message,
    ).toBe(`expected one of "line", "bar", "kpi", got "${'x'.repeat(40)}..."`);
  });
});

describe('schema.json', () => {
  type Node = {
    properties?: Record<string, Node>;
    items?: Node;
    oneOf?: Node[];
    minimum?: number;
    maximum?: number;
  };
  const keys = (node: Node | undefined) => Object.keys(node?.properties ?? {});
  const root = schema as unknown as Node;
  const props = root.properties ?? {};

  it('accepts exactly the fields the validator accepts at each level', () => {
    expect(keys(root)).toEqual(FIELDS.spec);
    expect(keys(props.kpi)).toEqual(FIELDS.kpi);
    expect(keys(props.chart)).toEqual(FIELDS.chart);
    const chart = props.chart.properties;
    expect(keys(chart?.axes)).toEqual(FIELDS.axes);
    expect(keys(chart?.axes.properties?.x)).toEqual(FIELDS.xAxis);
    expect(keys(chart?.axes.properties?.y)).toEqual(FIELDS.yAxis);
    expect(keys(chart?.incomplete)).toEqual(FIELDS.incomplete);
    expect(keys(props.annotations.items)).toEqual(FIELDS.annotation);
    expect(keys(props.series.items)).toEqual(FIELDS.series);
    expect(keys(props.series.items?.properties?.data.items)).toEqual(
      FIELDS.point,
    );
    const formats = (props.format.oneOf ?? []).map((branch) => [
      (branch.properties?.style as {const?: string}).const,
      keys(branch),
    ]);
    expect(Object.fromEntries(formats)).toEqual(FIELDS.format);
  });

  it('bounds values as the validator does', () => {
    const kpi = props.kpi.properties;
    const y = props.series.items?.properties?.data.items?.properties?.y;
    for (const node of [kpi?.value, kpi?.comparisonValue, y]) {
      expect([node?.minimum, node?.maximum]).toEqual([
        -LIMITS.maxAbsValue,
        LIMITS.maxAbsValue,
      ]);
    }
  });
});

describe('validateOptions', () => {
  it('reports non-functions and unknown options under options.', () => {
    expect(
      validateOptions({onClick: jest.fn(), formatYTick: 'compact'}),
    ).toEqual([
      {
        path: 'options.onClick',
        message: 'unexpected field "onClick"; did you mean "onPointClick"?',
      },
      {
        path: 'options.formatYTick',
        message:
          'expected a function, got "compact"; options hold callbacks, and settings go in the spec',
      },
    ]);
  });
});

test.each(['details', 'provenance'])(
  'rejects the removed %s option',
  (field) => {
    expect(
      errorsFor({
        ...valid,
        [field]: field === 'details' ? true : {source: 'API'},
      }),
    ).toEqual([
      {
        path: field,
        message: expect.stringContaining(`unexpected field "${field}"`),
      },
    ]);
  },
);
