import type {ResolvedSpec} from '../defaults';
import type {DateStyle} from '../format';
import {formatChange, formatDate, formatValue} from '../format';
import {parseIsoDate} from '../isoDate';
import {MONTHLY_RESOLUTION, medianInterval} from '../layout/timeTicks';
import type {ChartModel} from '../model';
import {kpiChange} from '../model';
import type {Series} from '../spec';
import {MESSAGES} from './messages';

const CHART_NAMES = {line: 'Line chart', bar: 'Bar chart'} as const;

type Extreme = {y: number; x: string};

/**
 * How the summary names a series' dates: monthly or coarser data by month
 * and year ("Dec 2024"), since its day and weekday mean nothing; finer data
 * in full ("Sun, Dec 1, 2024"). The same threshold the x axis uses.
 */
function summaryDateStyle(series: Series): DateStyle {
  const times = series.data.flatMap((point) => {
    const parsed = parseIsoDate(point.x);
    return parsed ? [parsed.time] : [];
  });
  return medianInterval(times) >= MONTHLY_RESOLUTION
    ? 'axisMonthYear'
    : 'tooltip';
}

function describeSeries(series: Series, spec: ResolvedSpec): string {
  const points = series.data.flatMap((point) =>
    point.y === null ? [] : [{y: point.y, x: point.x}],
  );
  const style = summaryDateStyle(series);
  const date = (x: string): string =>
    formatDate(x, {
      style,
      locale: spec.locale,
      timeZone: spec.timeZone,
    });
  const value = (y: number): string => formatValue(y, spec.format, spec.locale);
  const first = series.data[0];
  const last = series.data[series.data.length - 1];
  if (!first || !last || points.length === 0) {
    return `${series.label}: ${MESSAGES.noData.toLowerCase()}.`;
  }
  const lowest = points.reduce<Extreme>(
    (a, b) => (b.y < a.y ? b : a),
    points[0],
  );
  const highest = points.reduce<Extreme>(
    (a, b) => (b.y > a.y ? b : a),
    points[0],
  );
  const latest = points[points.length - 1];
  return (
    `${series.label}: ${series.data.length} points from ${date(
      first.x,
    )} to ${date(last.x)}; ` +
    `lowest ${value(lowest.y)} on ${date(lowest.x)}, ` +
    `highest ${value(highest.y)} on ${date(highest.x)}, ` +
    `latest ${value(latest.y)} on ${date(latest.x)}.`
  );
}

function describeKpi(spec: ResolvedSpec): string {
  if (!spec.kpi) return '';
  const {value, comparisonValue} = spec.kpi;
  const formatted = formatValue(value, spec.format, spec.locale);
  const change = kpiChange(value, comparisonValue);
  if (change === null || comparisonValue === undefined) {
    return `Headline value ${formatted}.`;
  }
  return (
    `Headline value ${formatted}, ${formatChange(change, spec.locale)} ` +
    `compared with ${formatValue(comparisonValue, spec.format, spec.locale)}.`
  );
}

/**
 * Describes the chart in a few sentences: chart type and series, each
 * series' date range with its lowest, highest and latest values, and the
 * KPI with its change.
 */
export function describeChart(spec: ResolvedSpec, model: ChartModel): string {
  const kpi = describeKpi(spec);
  if (spec.chartType === 'kpi') return kpi;
  const names = model.series
    .map((s) =>
      s.comparison ? `${s.label} (${MESSAGES.comparison})` : s.label,
    )
    .join(', ');
  const parts = [`${CHART_NAMES[spec.chartType]} of ${names}.`];
  if (model.empty) parts.push(`${spec.emptyMessage}.`);
  else parts.push(...spec.series.map((s) => describeSeries(s, spec)));
  if (kpi) parts.push(kpi);
  return parts.join(' ');
}
