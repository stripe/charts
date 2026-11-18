import {resolveSpec} from '../defaults';
import {buildModel} from '../model';
import type {RenderOptions} from '../options';
import type {ChartSpec} from '../spec';
import {watchCompact} from './compact';
import {html, visuallyHidden} from './dom';
import {renderEmpty} from './empty';
import {renderHeader} from './header';
import {idPrefix} from './ids';
import {renderKpi} from './kpi';
import {legendShown, mountLegend} from './legend';
import type {LegendPresses} from './legendPresses';
import type {HiddenSeries} from './legendState';
import {NONE_HIDDEN} from './legendState';
import {mountLoading} from './loading';
import {MESSAGES} from './messages';
import type {ChartMotion} from './motion';
import {seriesColors} from './palette';
import {mountPlot} from './plot';
import {mountSparkline} from './sparkline';
import {describeChart} from './summary';

/** The legend's state, kept by the chart handle across renders. */
export type LegendInput = {
  /** Labels of the series to hide; ignored when the chart has no legend. */
  hidden: HiddenSeries;
  /** The series whose legend button takes focus once drawn. */
  focusLabel: string | null;
  /** Where the legend's presses go; owned by the handle, across renders. */
  presses: LegendPresses;
};

/**
 * Fills `root` with the chart for `spec`, calling back through `options`.
 * Returns a cleanup that removes every listener and observer it added; the
 * caller removes the nodes.
 */
export function mountChart(
  root: HTMLElement,
  spec: ChartSpec,
  motion: ChartMotion,
  options: RenderOptions,
  legend: LegendInput,
): () => void {
  const doc = root.ownerDocument;
  const resolved = resolveSpec(spec);
  // Without a legend nothing could show a hidden series again.
  const withLegend = legendShown(resolved);
  const model = buildModel(spec, {
    hidden: withLegend ? legend.hidden : NONE_HIDDEN,
  });
  const controller = new AbortController();
  const ids = idPrefix();
  const titleId = `${ids}-title`;
  const summaryId = `${ids}-summary`;
  const tile = resolved.chartType === 'kpi';

  root.className = tile ? 'sc-root sc-tile' : 'sc-root';
  root.setAttribute('role', 'figure');
  root.setAttribute('aria-labelledby', titleId);
  root.setAttribute('aria-describedby', summaryId);
  // The root is kept across updates, so the flag is cleared as well as set.
  if (resolved.loading) root.setAttribute('aria-busy', 'true');
  else root.removeAttribute('aria-busy');

  const kpi = resolved.kpi
    ? renderKpi(doc, resolved.kpi, resolved, model)
    : null;
  const header = renderHeader(doc, resolved, {
    titleId,
    kpi: kpi?.element ?? null,
    tile,
  });
  root.appendChild(header);
  motion.revealHeader(header);
  // Only the KPI reads layout at mount: its row must be laid out before
  // the first paint, and restacking it later, from a resize callback, would
  // change the plot's height inside the observer. Charts without one force
  // no layout until the browser's first resize notification.
  if (kpi) {
    watchCompact(root, controller.signal);
    kpi.reserve();
  }

  const hover = {
    onSlot: (slot: number | null) => kpi?.showSlot(slot),
    onResize: () => kpi?.reserve(),
  };

  const summary = visuallyHidden(
    doc,
    resolved.loading && model.empty
      ? MESSAGES.loading
      : describeChart(resolved, model),
  );
  summary.id = summaryId;
  root.appendChild(summary);

  const placeholder = resolved.loading && model.empty;
  if (placeholder) {
    mountLoading(root, header, resolved, motion);
  } else if (!tile) {
    if (model.empty) root.appendChild(renderEmpty(doc, resolved.emptyMessage));
    else {
      // The legend goes in before the plot measures its area, or the plot
      // would size itself into the legend's row for its first frame.
      const colors = seriesColors(model.series);
      const legendRow = withLegend
        ? mountLegend(root, {
            series: model.series.map((s, index) => ({
              label: s.label,
              comparison: s.comparison,
              color: colors[index],
            })),
            chartType: resolved.chartType === 'bar' ? 'bar' : 'line',
            hidden: legend.hidden,
            forecast: model.hasForecast,
            projected: model.hasProjected,
            focusLabel: legend.focusLabel,
            presses: legend.presses,
            signal: controller.signal,
          })
        : null;
      mountPlot(
        root,
        resolved,
        model,
        controller.signal,
        motion,
        hover,
        options,
      );
      if (legendRow) {
        root.appendChild(legendRow.element);
        legendRow.restoreFocus();
      }
    }
  } else if (!model.empty) {
    root.classList.add('sc-has-sparkline');
    motion.revealSparkline(
      mountSparkline(root, resolved, model, controller.signal, hover),
    );
  }
  if (resolved.loading && !placeholder) motion.updating(root);
  return () => controller.abort();
}

export function createRoot(element: HTMLElement): HTMLElement {
  const root = html(element.ownerDocument, 'div', 'sc-root');
  element.appendChild(root);
  return root;
}
