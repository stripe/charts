/** Text the chart shows or announces that does not come from the spec. */
export const MESSAGES = {
  noData: 'No data',
  /** The accessible summary while `loading` is true. */
  loading: 'Loading chart data',
  noValue: 'No value',
  /** The KPI while the hovered slot has no value. */
  missingValue: '\u2013',
  /** The info button's accessible name: it opens the details view. */
  details: 'Details',
  /** The info button's label, shown on hover and focus. */
  detailsHint: 'Click for details',
  /** Caption of the details view's data table. */
  dataTable: 'Data',
  /** Heading of the table's column that flags forecast and incomplete rows. */
  status: 'Status',
  /** Heading of the details view's list of annotations. */
  notes: 'Notes',
  /** Heading of the table's date column. */
  date: 'Date',
  source: 'Source',
  fetchedAt: 'Fetched',
  errorTitle: 'This chart could not be drawn',
  plotInstructions:
    'Chart values. Use the left and right arrow keys to read each point.',
  comparison: 'comparison',
  /** Tags on tooltip rows for points that are not final values. */
  incomplete: 'Incomplete',
  forecast: 'Forecast',
  /** The legend key for projected values of an incomplete period. */
  onPace: 'On pace',
  /** After an incomplete point's value, and before its projection. */
  soFar: 'so far',
  onPaceFor: 'on pace for',
  /** After a KPI change computed from an incomplete period's projection. */
  paceChange: 'on pace',
  /** The legend's name: what its buttons do. */
  legend:
    'Series. Press to show or hide; Shift+Enter or double-click to show only one.',
  /** Announced when a press would hide the last visible series. */
  lastSeriesVisible: 'At least one series stays visible.',
} as const;
