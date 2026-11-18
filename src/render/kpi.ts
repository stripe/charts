import type {ResolvedSpec} from '../defaults';
import {formatChange, formatKpiValue, formatValue} from '../format';
import type {ChartModel, SlotPoint} from '../model';
import {kpiChange} from '../model';
import type {GoodDirection, Kpi} from '../spec';
import {html} from './dom';
import {MESSAGES} from './messages';

/** The KPI row and the controls the plot uses while hovering. */
export type KpiHandle = {
  element: HTMLElement;
  /** Shows slot `index`'s values, or the spec's KPI again for null. */
  showSlot(index: number | null): void;
  /**
   * Estimates the room needed on hover by measuring a sample of the longest
   * value-and-change pairs. If one does not fit, the change is placed under
   * the value for every slot. With proportional fonts, a shorter string may
   * be wider than the sample. Call again after a resize, since width and
   * type size change.
   */
  reserve(): void;
};

/** The texts the KPI row shows at one moment. */
type KpiText = {
  /** The value as shown: compact ("$3.8M") when the spec asks for it. */
  value: string;
  /** The value in full ("$3,798,040"), for assistive technology. */
  exact: string;
  change: string | null;
  ratio: number | null;
};

const STACKED_CLASS = 'sc-kpi-stacked';

// Values of equal length can still differ in width (a "1" next to an "8"
// without tabular numerals, or a separator). Sampling the longest avoids
// measuring every slot, but can miss a wider string in a proportional font.
const RESERVE_CANDIDATES = 3;

/**
 * The change's class: good or bad by `goodDirection` (a fall is good for
 * costs or refunds), neutral for no change. One place for the resting KPI
 * and every hover (plot and sparkline), so they always agree.
 */
function changeClass(
  ratio: number | null,
  goodDirection: GoodDirection,
): string {
  if (ratio === null || ratio === 0) return 'sc-kpi-change';
  const good = goodDirection === 'down' ? ratio < 0 : ratio > 0;
  return good ? 'sc-kpi-change sc-change-good' : 'sc-kpi-change sc-change-bad';
}

/**
 * How a slot's change is computed: from its value, from its projection
 * (an incomplete period on pace), or not at all (an incomplete period with
 * no projection, whose partial value can't fairly be compared).
 */
type ChangeBasis = 'value' | {projected: number} | 'none';

function comparedValue(value: number, basis: ChangeBasis): number | null {
  if (basis === 'none') return null;
  return basis === 'value' ? value : basis.projected;
}

// An incomplete period's value so far against a full period would read as
// a fall; its projection compares like with like.
function changeBasis(point: SlotPoint | undefined): ChangeBasis {
  if (point?.kind !== 'incomplete') return 'value';
  return point.projected === null ? 'none' : {projected: point.projected};
}

function kpiText(
  value: number | null,
  comparison: number | null | undefined,
  spec: ResolvedSpec,
  basis: ChangeBasis = 'value',
): KpiText {
  if (value === null) {
    return {
      value: MESSAGES.missingValue,
      exact: MESSAGES.missingValue,
      change: null,
      ratio: null,
    };
  }
  const compared = comparedValue(value, basis);
  const ratio =
    compared === null ? null : kpiChange(compared, comparison ?? undefined);
  const change = ratio === null ? null : formatChange(ratio, spec.locale);
  return {
    value: formatKpiValue(value, spec.format, spec.locale, spec.kpiNotation),
    exact: formatValue(value, spec.format, spec.locale),
    change:
      change !== null && typeof basis === 'object'
        ? `${change} ${MESSAGES.paceChange}`
        : change,
    ratio,
  };
}

/**
 * The values the KPI follows: the first primary series and, for the change,
 * the first comparison series at the same slot. On a stacked chart, the
 * slot's stack total over visible series, since that is what the bar's
 * height shows; stacked charts have no comparison series, so there is no
 * change.
 */
function slotTexts(model: ChartModel, spec: ResolvedSpec): KpiText[] {
  if (model.stacked) {
    return model.slots.map((slot) => {
      const values = slot.points.flatMap((point, index) =>
        point.y === null || model.series[index]?.hidden ? [] : [point.y],
      );
      const total =
        values.length === 0 ? null : values.reduce((sum, y) => sum + y, 0);
      return kpiText(total, null, spec);
    });
  }
  const primary = model.series.findIndex((s) => !s.comparison);
  const comparison = model.series.findIndex((s) => s.comparison);
  if (primary === -1) return [];
  return model.slots.map((slot) => {
    const point = slot.points[primary];
    const basis = changeBasis(point);
    return kpiText(
      point?.y ?? null,
      comparison === -1 ? null : slot.points[comparison]?.y ?? null,
      spec,
      basis,
    );
  });
}

/** Width-measurement candidates selected by character count. */
function longest(texts: readonly KpiText[]): KpiText[] {
  const length = (t: KpiText): number =>
    t.value.length + (t.change?.length ?? 0);
  return [...texts]
    .sort((a, b) => length(b) - length(a))
    .slice(0, RESERVE_CANDIDATES);
}

/**
 * The KPI row: the value, then the signed change as plain colored text
 * (`+23.4%`), omitted when there is nothing to compare against.
 */
export function renderKpi(
  doc: Document,
  kpi: Kpi,
  spec: ResolvedSpec,
  model: ChartModel | null,
): KpiHandle {
  const row = html(doc, 'p', 'sc-kpi');
  const valueElement = html(doc, 'span', 'sc-kpi-value');
  const changeElement = html(doc, 'span', 'sc-kpi-change');
  row.append(valueElement, changeElement);

  const rest = kpiText(kpi.value, kpi.comparisonValue, spec);
  const slots = model ? slotTexts(model, spec) : [];

  const fill = (
    valueTarget: HTMLElement,
    changeTarget: HTMLElement,
    text: KpiText,
  ): void => {
    const {value, exact, change, ratio} = text;
    if (value === exact) {
      valueTarget.textContent = value;
    } else {
      // Compact text is for the eye; screen readers get the exact value.
      const shown = html(doc, 'span', '', value);
      shown.setAttribute('aria-hidden', 'true');
      valueTarget.replaceChildren(
        shown,
        html(doc, 'span', 'sc-visually-hidden', exact),
      );
    }
    changeTarget.textContent = change ?? '';
    changeTarget.className = changeClass(ratio, spec.goodDirection);
  };
  const show = (text: KpiText): void => fill(valueElement, changeElement, text);
  show(rest);

  // Each candidate goes in its own hidden copy of the row, so every width
  // is read in one layout rather than one per candidate.
  const fits = (candidates: readonly KpiText[]): boolean => {
    const parent = row.parentElement;
    if (!parent) return true;
    const probes = candidates.map((text) => {
      const probe = html(doc, 'p', 'sc-kpi sc-kpi-probe');
      probe.setAttribute('aria-hidden', 'true');
      const value = html(doc, 'span', 'sc-kpi-value');
      const change = html(doc, 'span', 'sc-kpi-change');
      fill(value, change, text);
      probe.append(value, change);
      parent.appendChild(probe);
      return {probe, value, change};
    });
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const available = row.clientWidth;
    // Rects include a scaled ancestor's scale; the row's width and gap don't.
    const rowWidth = row.offsetWidth;
    const scale =
      rowWidth > 0 ? row.getBoundingClientRect().width / rowWidth : 1;
    const layoutWidth = (element: Element): number =>
      element.getBoundingClientRect().width / (scale || 1);
    const widths = probes.map(({value, change}) => {
      const changeWidth = layoutWidth(change);
      return layoutWidth(value) + (changeWidth > 0 ? gap + changeWidth : 0);
    });
    for (const {probe} of probes) probe.remove();
    // Zero means the page cannot measure (hidden): keep the default.
    const widest = Math.max(0, ...widths);
    return widest === 0 || widest <= available;
  };

  return {
    element: row,
    showSlot: (index) =>
      show((index === null ? undefined : slots[index]) ?? rest),
    reserve: () => {
      if (slots.length === 0) return;
      row.classList.remove(STACKED_CLASS);
      // If a sampled pair does not fit, reserve a separate change row for
      // every slot to reduce wrapping on hover.
      row.classList.toggle(STACKED_CLASS, !fits(longest([rest, ...slots])));
    },
  };
}
