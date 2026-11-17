/** Explanations supplement the runnable stories; the schema remains the API reference. */
export type Guide = {
  lead: string;
  fields?: readonly (readonly [
    field: string,
    defaultValue: string,
    meaning: string,
  ])[];
};

const guides: Record<string, Guide> = {
  Intro: {
    lead: 'Start with a small JSON spec; the library draws the chart, formats the axes, and handles interaction. Examples use fictional data.',
    fields: [
      ['title', 'Required', 'The chart’s accessible name.'],
      [
        'series',
        'No data',
        'Named series containing {x, y} points. Dates are ISO strings; values are numbers.',
      ],
      [
        'chart.type',
        'line',
        'Choose line, bar, or kpi. Give line and bar containers a height.',
      ],
    ],
  },
  Charts: {
    lead: 'Line, bar, and KPI charts share the same JSON spec.',
  },
  'Charts/Line': {
    lead: 'Use a line to show how orders or volume change through the reporting period. Begin with one series; add a comparison when the periods match.',
    fields: [
      ['chart.type', 'line', 'Connect the series’ points over time.'],
      [
        'series[].data',
        'No data',
        'Use ISO dates and numeric values; null values show gaps.',
      ],
      ['kpi', 'Hidden', 'An optional headline; choose its basis explicitly.'],
    ],
  },
  'Charts/Bar': {
    lead: 'Use bars to compare daily totals, payment methods, or revenue movements. Grouped bars compare series; stacked bars show their contribution to a total.',
    fields: [
      ['chart.type', 'line', 'Set bar for a bar chart.'],
      ['chart.stacking', 'grouped', 'Set stacked to stack compatible series.'],
      ['series', 'No data', 'Up to twelve series; units must be consistent.'],
    ],
  },
  'Charts/KPI': {
    lead: 'Use a KPI card for a headline such as total sales or the latest conversion rate. Add a comparison value or a small sparkline when context helps.',
    fields: [
      ['chart.type', 'line', 'Set kpi to show a card without the main plot.'],
      [
        'kpi.basis',
        'Required with kpi',
        'total, latest, average, or custom explains the headline’s relationship to the data.',
      ],
      [
        'kpi.comparisonValue',
        'Hidden',
        'The number used to calculate the change.',
      ],
    ],
  },
  Features: {
    lead: 'Add context to a chart without changing its basic shape: explain dates and units, compare matching periods, annotate events, or show the source behind a number.',
  },
  'Features/Axes': {
    lead: 'Axes choose labels to fit the chart. Use explicit label formats when a report needs a particular calendar unit or number notation.',
    fields: [
      ['chart.axes.x.labels', 'auto', 'auto, day, month, year, or time.'],
      [
        'chart.axes.y.notation',
        'compact',
        'Compact labels such as $300K, or standard numbers.',
      ],
      [
        'chart.axes.y.maximumFractionDigits',
        'Automatic',
        'An optional decimal cap from 0 to 20.',
      ],
    ],
  },
  'Features/Legend': {
    lead: 'A legend identifies series and lets readers focus a comparison. Click to toggle a series, or double-click to isolate it.',
    fields: [
      ['chart.legend', 'auto', 'auto, show, or hide.'],
      [
        'series[].label',
        'Required',
        'A unique label used by the legend and tooltips.',
      ],
    ],
  },
  'Features/Annotations': {
    lead: 'Explain promotions, outages, and other events in the reporting period. Point annotations use the series color; range annotations shade an interval.',
    fields: [
      ['label', 'Required', 'Short note, up to 80 characters.'],
      [
        'at',
        'Unset',
        'A primary-series x value; draws a dashed vertical marker.',
      ],
      [
        'series',
        'Unset',
        'With at, marks that series’ point as a hollow circle.',
      ],
      [
        'from / to',
        'Open plot edge',
        'Use instead of at for a range. Supplied dates get dashed boundaries.',
      ],
      [
        'description',
        'Hidden',
        'Optional longer explanation, up to 200 characters.',
      ],
    ],
  },
  'Features/Forecast': {
    lead: 'Distinguish future estimates from actual results. Forecast lines use a separate dash pattern and can include a low/high band.',
    fields: [
      [
        'series[].data[].forecast',
        'false',
        'Marks a trailing run of predicted points.',
      ],
      [
        'low / high',
        'Hidden',
        'Optional forecast bounds in the same units as y.',
      ],
      [
        'chart.incomplete',
        'Unset',
        'Marks an actual period that has started but is not final.',
      ],
    ],
  },
  'Features/Details': {
    lead: 'Let readers inspect the numbers behind a chart. The details view combines a table, notes, and caller-supplied provenance.',
    fields: [
      ['details', 'true', 'Set false to omit the details affordance.'],
      [
        'provenance',
        'Hidden',
        'Source, fetch time, and label/value details to help explain the data.',
      ],
    ],
  },
  'Features/States': {
    lead: 'A report can distinguish loading, empty results, and invalid input. A chart with existing data can remain visible while an update is in progress.',
    fields: [
      ['loading', 'false', 'Show a placeholder or updating state.'],
      [
        'emptyMessage',
        'Default message',
        'Explain an empty result in the reader’s language.',
      ],
    ],
  },
  'Features/Money and units': {
    lead: 'Use Stripe API amounts without silently changing their scale. Currency and percent values require an explicit unit.',
    fields: [
      ['format.style', 'number', 'number, currency, or percent.'],
      [
        'format.unit',
        'Required for currency/percent',
        'Currency: minor or major. Percent: ratio or percent.',
      ],
      [
        'format.currency',
        'Required for currency',
        'An ISO currency code such as usd, jpy, or kwd.',
      ],
    ],
  },
  'Features/Dates and time zones': {
    lead: 'Keep a report’s dates tied to the business’s reporting calendar. Date-only strings keep their day; timestamps are formatted in the specified zone.',
    fields: [
      [
        'series[].data[].x',
        'Required',
        'ISO date, or ISO date-time with an offset.',
      ],
      [
        'timeZone',
        'Required for date-times',
        'IANA zone such as America/New_York, or UTC.',
      ],
      ['locale', 'en-US', 'Controls localized date and number labels.'],
    ],
  },
  'Features/Comparisons': {
    lead: 'Compare corresponding business periods. Business periods can start on different dates; series line up by position rather than by their date strings.',
    fields: [
      [
        'series[].comparison',
        'false',
        'Marks a comparison series and uses comparison styling.',
      ],
      [
        'series[].data',
        'No data',
        'Put the corresponding days in the same order in each series.',
      ],
    ],
  },
  'Features/Provenance': {
    lead: 'Give a reader enough context to trust and interpret the number: where it came from, when it was fetched, and what was included.',
    fields: [
      ['provenance.source', 'Required with provenance', 'A short source name.'],
      ['provenance.fetchedAt', 'Hidden', 'ISO timestamp; requires timeZone.'],
      [
        'provenance.details',
        'Empty',
        'Label/value pairs such as metric, reporting window, or exclusions.',
      ],
    ],
  },
  'Features/Validation': {
    lead: 'Errors identify the field and explain what to fix. Validate a spec before rendering, or handle SpecError from render/update.',
    fields: [
      [
        'validate(spec)',
        'No rendering',
        'Returns {ok: true, spec} or {ok: false, errors}.',
      ],
      [
        'SpecError.errors',
        'On invalid input',
        'Structured path/message pairs.',
      ],
      [
        'SpecError.chart',
        'When a chart was created',
        'A handle you can update with corrected input or destroy.',
      ],
    ],
  },
  React: {
    lead: 'Use the optional React binding when a chart belongs in an application. The component takes the same JSON spec and manages the chart’s lifecycle.',
  },
  'React/StripeChart': {
    lead: 'Import StripeChart from @stripe/charts/react. React and React DOM 18 or newer are optional peer dependencies for this entry point only.',
    fields: [
      ['spec', 'Required', 'The same JSON spec as the JavaScript API.'],
      [
        'style.height',
        'Set for plots',
        'Provide a height for line and bar charts.',
      ],
      ['onError', 'Optional', 'Receives invalid-spec errors.'],
      [
        'renderTooltip',
        'Default tooltip',
        'Can return React content while retaining tooltip placement.',
      ],
    ],
  },
  Examples: {
    lead: 'Start with a complete report or copy a focused chart into your own page. Examples use fictional data and can be adapted to your reporting workflow.',
  },
  'Examples/Reporting': {
    lead: 'Daily and hourly Gross volume, order totals, year-over-year comparisons, and currencies. Start with gross volume, then add only the context your report needs.',
  },
  'Examples/Dashboard': {
    lead: 'Combine KPI cards and plots to tell a reporting story. Each chart is independent and can be copied into another layout.',
  },
  'Examples/API': {
    lead: 'Try updating a chart, changing its type, handling invalid input, and destroying it. The generated HTML includes the example’s buttons and behavior.',
  },
  'Examples/Options': {
    lead: 'Use JavaScript callbacks for events, custom tooltips, and axis formatting. The chart spec itself stays JSON.',
  },
};

export function guideFor(title: string): Guide | undefined {
  return guides[title];
}
