/** Explanations supplement the runnable stories; the schema remains the API reference. */
export type Guide = {lead: string};

const guides: Record<string, Guide> = {
  Intro: {
    lead: 'Start with a small JSON spec; the library draws the chart, formats the axes, and handles interaction. Examples use fictional data.',
  },
  Charts: {
    lead: 'Line, bar, and KPI charts share the same JSON spec.',
  },
  'Charts/Line': {
    lead: 'Use a line to show how orders or volume change through the reporting period. Begin with one series; add a comparison when the periods match.',
  },
  'Charts/Bar': {
    lead: 'Use bars to compare daily totals, payment methods, or revenue movements. Grouped bars compare series; stacked bars show their contribution to a total.',
  },
  'Charts/KPI': {
    lead: 'Use a KPI card for a headline such as total sales or the latest conversion rate. Add a comparison value or a small sparkline when context helps.',
  },
  Features: {
    lead: 'Add context to a chart without changing its basic shape: explain dates and units, compare matching periods, annotate events, or show the source behind a number.',
  },
  'Features/Axes': {
    lead: 'Axes choose labels to fit the chart. Use explicit label formats when a report needs a particular calendar unit or number notation.',
  },
  'Features/Legend': {
    lead: 'A legend identifies series and lets readers focus a comparison. Click to toggle a series, or double-click to isolate it.',
  },
  'Features/Annotations': {
    lead: 'Explain promotions, outages, and other events in the reporting period. Point annotations use the series color; range annotations shade an interval.',
  },
  'Features/Forecast': {
    lead: 'Distinguish future estimates from actual results. Forecast lines use a separate dash pattern and can include a low/high band.',
  },
  'Features/Details': {
    lead: 'Let readers inspect the numbers behind a chart. The details view combines a table, notes, and caller-supplied provenance.',
  },
  'Features/States': {
    lead: 'A report can distinguish loading, empty results, and invalid input. A chart with existing data can remain visible while an update is in progress.',
  },
  'Features/Money and units': {
    lead: 'Use Stripe API amounts without silently changing their scale. Currency and percent values require an explicit unit.',
  },
  'Features/Dates and time zones': {
    lead: 'Keep a report’s dates tied to the business’s reporting calendar. Date-only strings keep their day; timestamps are formatted in the specified zone.',
  },
  'Features/Comparisons': {
    lead: 'Compare corresponding business periods. Business periods can start on different dates; series line up by position rather than by their date strings.',
  },
  'Features/Provenance': {
    lead: 'Give a reader enough context to trust and interpret the number: where it came from, when it was fetched, and what was included.',
  },
  'Features/Validation': {
    lead: 'Errors identify the field and explain what to fix. Validate a spec before rendering, or handle SpecError from render/update.',
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
