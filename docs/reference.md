# Stripe Charts reference

Reference for `@stripe/charts@0.0.1`. Start with the [README](../README.md)
or the Storybook guides for a first chart.

## Units and correctness

A chart that silently shows money 100 times too large, or a "total" that is
really the last day's value, is worse than no chart. So the spec asks you to
say what the numbers mean in four places, and rejects the spec, with a
message naming the field, when one is missing or doesn't fit the data.

| Field | Required when | Values | Why |
|---|---|---|---|
| `format.unit` | `format.style` is `"currency"` | `"minor"` or `"major"` | The Stripe API returns amounts in minor units (cents): `1999` is $19.99. Say `"minor"` and pass the API's integers unchanged, or `"major"` if you already converted them. |
| `format.unit` | `format.style` is `"percent"` | `"ratio"` or `"percent"` | Is 2.5% given as `0.025` (`"ratio"`) or as `2.5` (`"percent"`)? |
| `timeZone` | any `x` is a date-time | an IANA zone, such as `"America/New_York"` | An instant can fall on different days in different zones. Name the zone the data was reported in, or `"UTC"`. Date-only data doesn't need it. |
| `kpi.basis` | there is a `kpi` | `"total"`, `"latest"`, `"average"` or `"custom"` | Says how `kpi.value` relates to the primary series: the sum, last value or mean of its actual values (forecast points are left out), or a figure computed elsewhere. For the first three the value is checked against the series, and `comparisonValue` against the first comparison series over the same slots, like periods: for `"latest"`, the comparison's value at the slot of the primary's latest actual value; for `"total"` and `"average"`, its values at the primary's actual slots. |

Minor units follow the Stripe API's currency decimals:

| Currency | Minor-unit decimals | `1999` with `"unit": "minor"` |
|---|---|---|
| USD, EUR and most others | 2 | $19.99 |
| JPY and other zero-decimal currencies | 0 | ¥1,999 |
| KWD, BHD, JOD, OMR, TND | 3 | KWD 1.999 |

ISK and UGX follow Stripe's special case and use 2. `kpi.basis` checks allow
a small rounding tolerance: 0.5% of the expected value, or one displayed unit,
whichever is larger.

## API

### `render(element, spec, options?)`

Draws the chart described by `spec` into `element` (an `HTMLElement`) and
returns a handle:

- `update(spec, options?)` redraws in place with a new spec. Leaving
  `options` out keeps the previous options.
- `destroy()` removes every node, listener and observer the chart added.
  `update` after `destroy` does nothing.

If the spec is invalid, `render` and `update` draw a card listing every
problem inside `element`, then throw a `SpecError`. A later valid `update`
replaces the card with the chart; when the first spec is invalid, the
handle comes with the error as `error.chart`. If `element` is not a DOM element, `render`
throws a `TypeError`.

### Render options

The optional third argument holds the JavaScript-only parts: callbacks and
formatters. The spec stays plain JSON.

| Option | Called with | Use |
|---|---|---|
| `onPointClick(event)` | the clicked slot | Click a slot, or press Enter on the focused plot. Shows a pointer cursor. |
| `onPointHover(event)` | the hovered or focused slot, or `null` on leave | Sync other UI with the chart. |
| `onLegendChange(state)` | `{hidden: string[]}`, the hidden series' labels | Remember the reader's legend choices. |
| `renderTooltip(context)` | the slot, its default `title` and its `annotations` | Return a `Node` (inserted as is), a string (shown as text) or `null` (the default tooltip). The box, placement and screen reader announcement stay. |
| `formatYTick(value, label)` | the tick value and the default label | Return the label to show. |
| `formatXTick(x, label)` | the tick's x and the default label | Return the label to show. |

A point event has the slot `index`, the primary series' `x`, every visible
series at the slot (`label`, its own `x`, `y` in major units, `formatted`,
`kind` "actual", "incomplete" or "forecast", and `color`), the bar's
`seriesLabel` for a click on a bar, and the `nativeEvent` (`null` for the
keyboard). Labels from the formatters are measured like any other, so they
still don't collide. An error thrown by a callback is logged with
`console.error` and never breaks the chart.

```js
StripeCharts.render(element, spec, {
  onPointClick: (event) => console.log(event.x, event.series),
  formatYTick: (value, label) => label + ' orders',
});
```

### `validate(spec)`

Checks a spec without drawing anything. Returns `{ok: true, spec}` or
`{ok: false, errors}`, where each error is `{path, message}`, for example
`{path: "series[1].data[0].x", message: "expected an ISO date like ..."}`.

### `SpecError`

Thrown by `render` and `update` for an invalid spec. `error.errors` holds
the same `{path, message}` list as `validate`; `error.message` has one line
per problem, `path: message`. `error.chart` is the handle for the element,
which now shows the error card: call `error.chart.update(fixedSpec)` to draw
the chart, or `error.chart.destroy()` to remove the card. It is set whenever
`render` or `update` throws, so an invalid first spec still leaves a usable
handle.

```js
let chart;
try {
  chart = StripeCharts.render(element, spec);
} catch (error) {
  if (!(error instanceof StripeCharts.SpecError)) throw error;
  console.error(error.message); // one "path: message" line per problem
  chart = error.chart; // later: chart.update(fixedSpec)
}
```

### `version`

The package version, as a string.

The JSON Schema for the spec ships as `dist/stripe-charts.schema.json`
(`@stripe/charts/schema.json`), and TypeScript types for every field come with
the package.

## React

A React component is available from a separate entry point,
`@stripe/charts/react`. It wraps `render`, `update` and `destroy`; the
script-tag build and the main entry point do not include or require React.

```sh
npm install @stripe/charts react react-dom
```

React 18 or later is required for this entry point only (`react` is an
optional peer dependency).

```tsx
import type {ChartSpec} from '@stripe/charts';
import {StripeChart} from '@stripe/charts/react';

const spec: ChartSpec = {
  title: 'Gross volume',
  // Amounts in cents, as the Stripe API returns them.
  format: {style: 'currency', currency: 'usd', unit: 'minor'},
  series: [
    {label: '2026', data: [{x: '2026-11-27', y: 41200025}]},
    {label: '2025', comparison: true, data: [{x: '2025-11-28', y: 35010000}]},
  ],
};

export function GrossVolume() {
  return (
    <StripeChart
      spec={spec}
      style={{height: 400}}
      onError={(error) => console.warn(error.errors)}
    />
  );
}
```

| Prop | Type | Description |
|---|---|---|
| `spec` | `ChartSpec` | Required. The chart to draw. Compared by serialized value, including object key order, so an inline object literal with the same serialization does not redraw it; a changed spec updates the chart in place. Unserializable specs are compared by identity. |
| `style` | `CSSProperties` | Inline style for the container `div`. Line and bar charts fill the container, so give it a height. |
| `className` | `string` | Class name for the container `div`. |
| `id` | `string` | `id` for the container `div`. |
| `onError` | `(error: SpecError) => void` | Called when validation fails on mount or when the serialized spec or set of callback options changes, with the same `{path, message}` list as `validate` in `error.errors`. An unchanged invalid spec can be reported again. |
| `ref` | `Ref<HTMLDivElement>` | Forwarded to the container `div`. |
| `onPointClick` | `(event: PointEvent) => void` | Called when a day is clicked, or Enter is pressed on the focused plot. The plot shows a pointer cursor while it is set. |
| `onPointHover` | `(event: PointEvent \| null) => void` | Called as the hovered (or keyboard-focused) day changes; `null` on leave. |
| `onLegendChange` | `(state: {hidden: string[]}) => void` | Called when the legend shows or hides a series. |
| `renderTooltip` | `(context: TooltipContext) => ReactNode` | Replaces the tooltip's contents with React content, rendered through a portal, so your components and context work inside it. The chart keeps the box, its placement and its screen reader announcement. Return `null` for the default tooltip. |
| `formatYTick` | `(value: number, defaultLabel: string) => string` | Rewrites a y-axis label. |
| `formatXTick` | `(x: string, defaultLabel: string) => string` | Rewrites an x-axis label. |

The component renders one `div` and draws the chart into it after mount; it
is removed on unmount. Rendering twice under `StrictMode` leaves one chart.

The callbacks can be inline functions: the chart always calls the latest
one, and a new function on every render does not redraw it. Formatters are
applied the next time the chart lays out (a resize or a spec change), so
keep them pure functions of their arguments.

**Server rendering.** On the server only the empty `div` is rendered; the
chart is drawn on the client after hydration. Nothing touches `window` or
`document` while rendering.

**Errors.** An invalid spec never throws during rendering. The chart shows
the same card listing every problem as `render` does, and `onError` is
called; a later valid spec replaces the card. To pass JSON of unknown shape,
cast it (`JSON.parse(text) as ChartSpec`): the spec is validated at runtime
either way. Other errors, which would be bugs, reach your error boundary.

## Examples

### Complete pages

Each is a single HTML file that loads `dist/stripe-charts.min.js` with a
`<script>` tag, the way an agent writes an artifact. Build first, then open
the file or serve the package directory.

- [`examples/standalone.html`](../examples/standalone.html): one line chart,
  November 26–30 against last year.
- [`examples/dashboards/sales-recap.html`](../examples/dashboards/sales-recap.html):
  a Sales recap for an online retailer, with KPI cards,
  daily and hourly charts against last year, and volume by payment method as
  stacked bars.
- [`examples/dashboards/subscription-health.html`](../examples/dashboards/subscription-health.html):
  24 months of subscription (SaaS) health: MRR against plan, MRR movements
  with losses below zero, churn rate, and one card in euros.
- [`examples/dashboards/marketplace-ops.html`](../examples/dashboards/marketplace-ops.html):
  90 days of marketplace operations in Japanese (`ja-JP`), yen and Japan time,
  with a loading placeholder that turns into data and an empty-state card.

The specs below, and the JSON files in [`examples/`](../examples/), are single
charts.

### Line chart with a comparison

```json
{
  "title": "Gross volume",
  "description": "November 26–30, compared with last year",
  "format": {"style": "currency", "currency": "usd", "unit": "minor"},
  "kpi": {"basis": "total", "value": 179431180, "comparisonValue": 156955125},
  "chart": {"type": "line"},
  "series": [
    {"label": "2026", "data": [
      {"x": "2026-11-26", "y": 28641025}, {"x": "2026-11-27", "y": 41200025},
      {"x": "2026-11-28", "y": 33895080}, {"x": "2026-11-29", "y": 30122040},
      {"x": "2026-11-30", "y": 45573010}
    ]},
    {"label": "2025", "comparison": true, "data": [
      {"x": "2025-11-27", "y": 25180000}, {"x": "2025-11-28", "y": 35010000},
      {"x": "2025-11-29", "y": 29740050}, {"x": "2025-11-30", "y": 26895000},
      {"x": "2025-12-01", "y": 40130075}
    ]}
  ]
}
```

The comparison series is drawn as a muted dashed line under the primary one.

### Bar chart

```json
{
  "title": "Orders",
  "description": "Successful payments per day",
  "format": {"style": "number", "maximumFractionDigits": 0},
  "kpi": {"basis": "total", "value": 22300, "comparisonValue": 20283},
  "chart": {"type": "bar"},
  "series": [
    {"label": "2026", "data": [
      {"x": "2026-11-26", "y": 3412}, {"x": "2026-11-27", "y": 5208},
      {"x": "2026-11-28", "y": 4110}, {"x": "2026-11-29", "y": 3694},
      {"x": "2026-11-30", "y": 5876}
    ]},
    {"label": "2025", "comparison": true, "data": [
      {"x": "2025-11-27", "y": 3050}, {"x": "2025-11-28", "y": 4710},
      {"x": "2025-11-29", "y": 3820}, {"x": "2025-11-30", "y": 3402},
      {"x": "2025-12-01", "y": 5301}
    ]}
  ]
}
```

Bars of the same slot sit side by side in series order, primary first; up to
12 series get colors from the series palette, and comparison series keep the
muted style. The y axis of a bar chart always includes zero; a line chart's
axis fits the data.

**Many bars.** Bars of a slot stay side by side down to about 3px per
series. Narrower than that, the series overlay in whole-pixel columns
(comparison behind, primary in front), and below 1px per slot each pixel
column shows the slot with the largest value, so spikes stay visible but
neighbouring days merge. See [Performance and data size](#performance-and-data-size)
for how many bars stay readable.

### Stacked bars

```json
{
  "title": "Net volume",
  "description": "Charges, refunds and disputes",
  "format": {"style": "currency", "currency": "usd", "unit": "major"},
  "chart": {"type": "bar", "stacking": "stacked"},
  "series": [
    {"label": "Charges", "data": [{"x": "2026-11-27", "y": 412000}, {"x": "2026-11-28", "y": 338950}]},
    {"label": "Refunds", "data": [{"x": "2026-11-27", "y": -45320}, {"x": "2026-11-28", "y": -30510}]},
    {"label": "Disputes", "data": [{"x": "2026-11-27", "y": -14420}, {"x": "2026-11-28", "y": -7460}]}
  ]
}
```

Positive values stack upward from zero and negative values downward, so a
bar spans the slot's gross movement. The y axis covers the stack totals and
includes zero. The tooltip lists rows in visual order, top segment first.
With a `kpi`, hovering or focusing a slot shows that slot's stack total
(net of negative segments) in the KPI, without a change.
Comparison series can't be stacked; use `"grouped"` to compare with last
year.

### KPI only

```json
{
  "title": "Gross volume, the reporting period",
  "format": {"style": "currency", "currency": "usd", "unit": "minor"},
  "kpi": {"basis": "total", "value": 150790155, "comparisonValue": 131775125},
  "chart": {"type": "kpi"}
}
```

A KPI card has no plot, so `series` is optional. With `series`, the card
draws a sparkline of the first series beside the value (under it, at full
width, in narrow cards). Hovering or touching the sparkline shows that
point's value and change in the KPI, and leaving restores it.

```json
{
  "title": "MRR",
  "format": {"style": "currency", "currency": "usd", "unit": "major"},
  "kpi": {"basis": "latest", "value": 294470, "comparisonValue": 238630},
  "chart": {"type": "kpi"},
  "series": [{"label": "MRR", "data": [
    {"x": "2026-10-26", "y": 238630}, {"x": "2026-10-27", "y": 251200},
    {"x": "2026-10-28", "y": 262900}, {"x": "2026-10-29", "y": 270400},
    {"x": "2026-10-30", "y": 281150}, {"x": "2026-10-31", "y": 288020},
    {"x": "2026-11-01", "y": 294470}
  ]}]
}
```

### Compact KPI values

`"notation": "compact"` abbreviates the headline value, for KPI tiles and
dense dashboards where the exact figure would crowd the card. The change,
tooltip and axis stay exact. Screen readers read the exact
value: the abbreviated text is hidden from them and the exact figure sits
next to it as visually hidden text, and the accessible summary uses it too.

```json
{
  "title": "New ARR",
  "format": {"style": "currency", "currency": "usd", "unit": "major"},
  "kpi": {"basis": "custom", "value": 3798040, "comparisonValue": 3705405, "notation": "compact"},
  "chart": {"type": "kpi"}
}
```

This card reads "$3.8M +2.5%".

### Loading

Render a placeholder while the data is fetched, then update it:

```js
const chart = StripeCharts.render(element, {
  title: 'Gross volume',
  format: {style: 'currency', currency: 'usd', unit: 'major'},
  chart: {type: 'line'},
  loading: true,
});
// Later, when the rows arrive:
chart.update(specWithData);
```

The placeholder keeps the title and description and has the shape of
`chart.type` (lines, bars or a KPI block), so nothing moves when the data
arrives. `loading: true` on a spec that also has data means it is being
refreshed: the chart keeps its data in place with the KPI and plot dimmed
and a shimmer sweeping over the plot, and is marked `aria-busy`, until the
next `update`. The title and description stay at full strength.

## Spec reference

Unknown fields are rejected, so a typo is reported instead of silently
ignored. Paths use `[]` for "each item of the array". The same descriptions
are in the TypeScript types and the JSON Schema.

| Field | Type | Default | Description |
|---|---|---|---|
| `title` | string, 1 to 200 characters | required | Card title shown at the top. |
| `description` | string, up to 500 characters | none | One-line subtitle under the title. |
| `format` | object | `{"style": "number"}` | How values (KPI, axis ticks, tooltip) are formatted. Chosen by `format.style`. |
| `format.style` | `"number"`, `"currency"` or `"percent"` | required in `format` | `"number"` for plain numbers, `"currency"` for money, `"percent"` for ratios (0.25 is 25%). |
| `format.currency` | string | required for `"currency"` | Three-letter ISO 4217 code, any case: `"usd"`, `"JPY"`. Only allowed with `"currency"`. |
| `format.unit` | `"minor"` or `"major"` (currency); `"ratio"` or `"percent"` (percent) | required for `"currency"` and `"percent"` | How to read the numbers. See [Units and correctness](#units-and-correctness). Not allowed with `"number"`. |
| `format.maximumFractionDigits` | integer, 0 to 20 | 2 for `"number"`, 1 for `"percent"` | Most decimals to show. Not allowed with `"currency"`: the currency decides. |
| `locale` | string | `"en-US"` | BCP 47 language tag for number and date formatting, for example `"ja-JP"`. |
| `timeZone` | string | required when any `x` is a date-time; otherwise `"UTC"` | IANA time zone for date-time values, for example `"America/New_York"`. See [Dates](#dates-and-time-zones). |
| `kpi` | object | none | Headline value shown above the chart. |
| `kpi.value` | number | required in `kpi` | The headline value, in the units of `format`. |
| `kpi.basis` | `"total"`, `"latest"`, `"average"` or `"custom"` | required in `kpi` | How `kpi.value` relates to the primary series; checked unless `"custom"`. See [Units and correctness](#units-and-correctness). |
| `kpi.comparisonValue` | number | none | Value to compare against. The change is shown as a signed percentage; omitted when this is missing or 0. |
| `kpi.notation` | `"standard"` or `"compact"` | `"standard"` | How the KPI value is written: in full (`$294,470`) or abbreviated as the locale does (`$294K`, `$3.8M`, `￥2.6億`, `3,8 Mio. €`; some locales, such as `de-DE`, don't abbreviate thousands). Values under 1,000 and percentages are always written in full. |
| `kpi.goodDirection` | `"up"` or `"down"` | `"up"` | Which way a change is good, for its color: `"down"` for churn, refund or dispute rates, so a fall shows green. Applies to the KPI, the hover KPI and the sparkline. |
| `chart` | object | `{"type": "line"}` | Chart options. |
| `chart.type` | `"line"`, `"bar"` or `"kpi"` | required in `chart` | `"kpi"` draws only the headline value, with no plot. |
| `chart.legend` | `"auto"`, `"show"` or `"hide"` | `"auto"` | When the legend shows. See [Series colors and legend](#series-colors-and-legend). |
| `chart.axes` | object | none | Axis label settings. See [Axes](#axes). |
| `chart.incomplete` | `{from, message?}` | none | Marks the slots from `from` (a primary x) to the end as not final yet. See [Annotations, incomplete periods and forecasts](#annotations-incomplete-periods-and-forecasts). |
| `chart.stacking` | `"grouped"` or `"stacked"` | `"grouped"` | How bar series share a slot: side by side, or stacked (positive values up from zero, negative values down). Only allowed when `chart.type` is `"bar"`; comparison series can't be stacked. |
| `series` | array of 1 to 12 | required unless `chart.type` is `"kpi"` or `loading` is `true` | The series to plot. Put the primary series first. |
| `series[].label` | string, 1 to 200 characters | required | Series name, shown in the tooltip and the chart's accessible summary. |
| `series[].color` | `#rgb` or `#rrggbb` | palette | The series' color for its marks, legend, tooltip and sparkline. |
| `series[].comparison` | boolean | `false` | `true` draws the series in the muted comparison style, for example last year. |
| `series[].data` | array of up to 1000 | required | Points in display order. May be empty. |
| `series[].data[].x` | string | required | `"YYYY-MM-DD"` for a calendar day, or an ISO 8601 date-time with `Z` or an offset, for example `"2026-11-27T18:00:00Z"`. |
| `series[].data[].color` | `#rgb` or `#rrggbb` | the series color | Bar charts only: this bar's color. |
| `series[].data[].forecast` | boolean | `false` | `true` for a forecast; forecast points run to the end of the series. |
| `series[].data[].low`, `series[].data[].high` | number | none | Forecast points only: the range, `low <= y <= high`. |
| `series[].data[].projected` | number | none | Incomplete points of a non-comparison series only: where the unfinished period is on pace to end, same units and sign as `y`, and on bar charts at least as far from zero. `y` stays the value so far. See [Annotations, incomplete periods and forecasts](#annotations-incomplete-periods-and-forecasts). |
| `series[].data[].y` | number or `null` | required | The value in the units of `format`, or `null` for a gap. A JSON number, not a string. |
| `emptyMessage` | string, up to 200 characters | `"No data"` | Message for an empty plot, in your language, for example `"No disputes this week"`. Plain text. |
| `annotations` | array of up to 10 | none | Markers and ranges: `label` (up to 80 characters), optional `description` (up to 200), and `at` (with optional `series`) or `from`/`to`. |
| `loading` | boolean | `false` | `true` while the data is being fetched: the card shows a placeholder shaped by `chart.type`, and `series` and `kpi` may be omitted. Call `update` with the data to replace it. |

## Performance and data size

- **Use reporting-sized data.** The spec allows up to 1000 points per
  series and 12 series.
- **Aggregate before charting.** A line reads best with about one point per
  3px of plot: about 100 points at 360px wide, 250 at 800px, 450 at 1440px.
  Denser lines are thinned per pixel column automatically, keeping their
  shape and spikes, but readers see a band rather than days. For a year,
  send daily rather than hourly data.
- **Bars need more room.** Grouped bars stay side by side up to about 40,
  100 and 185 days at 360, 800 and 1440px wide; beyond that, use a line or
  fewer days.
- **Many charts on a page.** With more than about 24 charts, render each one
  when it scrolls into view:

  ```js
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      StripeCharts.render(entry.target, specs[entry.target.id]);
    }
  });
  for (const element of document.querySelectorAll('.chart')) observer.observe(element);
  ```

- **Lifecycle.** The script makes no network requests. Call `destroy()`
  when removing a chart; it removes the chart nodes, listeners, and observers.

## Series colors and legend

Non-comparison series take colors from the series palette in order;
comparison series share one muted color (dashed for lines). The palette has
9 distinct colors across 12 slots; slots 10–12 repeat the first three.
Every comparison series uses the same muted color, so for clarity use at
most one comparison series per chart, for example this year against last year.

`series[].color` sets a series' color and, in bar charts, `data[].color`
one bar's, as `#rgb` or `#rrggbb` hex. Prefer the default palette, and check
custom colors for contrast against the background.

**Legend.** By default (`chart.legend: "auto"`) charts with 1 or 2 series
have no legend, because the tooltip names them, and
charts with 3 or more series, any forecast points or any `projected` values
show a wrapping legend row below the plot, in series order. `"show"` always
shows it and `"hide"` never does; KPI cards never have one. Each entry is a
toggle button:

- a click (or Enter or Space) hides or shows that series at once;
- a double-click (or Shift+Enter) shows only that series, even a hidden
  one; a double-click on the only shown series shows all again;
- the last visible series can't be hidden;
- hidden series leave the plot, the tooltip and the y axis, which re-fits
  in the same frame; the KPI doesn't change;
- legend changes don't animate (`update()` and the entrance still do);
- the choice survives `update()` for series whose labels still exist, and
  `onLegendChange` reports every change, once per press (a double-click
  reports its first click's toggle too, then the final state).

The legend takes its room from the plot, so the chart's size doesn't change.
A dashed "Forecast" key explains forecast points, and an "On pace" key
explains projections: a dotted dash with a hollow marker on lines, a dashed
outlined square on bars.

The colors are CSS custom properties, like every other themable value; see
[Theming](#theming).

## Theming

Every color, font, size and stroke the chart draws with reads a CSS custom
property (`--sc-*`), with the default written as its fallback. Set them on
`.sc-root` or any ancestor, for example `:root` or a `body.dark` class, to
retheme the charts inside it; nothing in the chart's own stylesheet
overrides them.

Most component colors follow one of eleven semantic roles, `--sc-color-*`, so a
theme sets those and only a few fixed colors:

| Role | Colors |
|---|---|
| `--sc-color-surface` | Tile and tooltip backgrounds, and the rings that separate marks |
| `--sc-color-text-primary` | Titles, values and other text read first |
| `--sc-color-text-secondary` | Labels and descriptions, the legend, empty and error text, annotations and the incomplete period |
| `--sc-color-text-muted` | Tooltip dates, labels and notes |
| `--sc-color-text-subtle` | Axis labels and the legend's forecast key |
| `--sc-color-border` | Tile and card outlines |
| `--sc-color-divider` | Gridlines, thin rules (tooltip divider) and loading placeholder marks |
| `--sc-color-fill-subtle` | Quiet fills: the empty-state icon, button hovers and loading placeholders |
| `--sc-color-good`, `--sc-color-bad` | KPI changes in the good and bad direction |
| `--sc-color-focus-ring` | Keyboard focus outlines |


```css
/* A dark theme for every chart on the page */
:root {
  --sc-color-surface: #16213a;
  --sc-color-text-primary: #e8edf5;
  --sc-color-text-secondary: #aab6c8;
  --sc-color-text-muted: #94a3b8;
  --sc-color-text-subtle: #8a97ab;
  --sc-color-border: #2b3a55;
  --sc-color-divider: #2b3a55;
  --sc-color-fill-subtle: #1d2a44;
  --sc-color-good: #4ade80;
  --sc-color-bad: #f87171;
  --sc-axis-baseline-color: #3d4d6a;
  --sc-crosshair-color: #8a97ab;
  --sc-series-comparison: #6b7a92;
  --sc-tooltip-tag-color: #8a97ab;
}
```

Any component property can still be set on its own, for example
`--sc-tooltip-background`.

**Fonts.** Charts use a system font stack. To use the page's font, set
`font-family` on the chart root (`.sc-root { font-family: inherit; }`, or
any font family); every label inherits it, and axis labels are measured in
it. Or set `--sc-font-family` to a font stack on `.sc-root` or an ancestor.
`--sc-font-family: inherit` doesn't work, because CSS applies `inherit` to
the custom property itself. Because the defaults are fallbacks, not
declarations, `getComputedStyle` only returns a property you set yourself.
To draw UI in a series' color, use the `color` of each series in point
events (see [Render options](#render-options)), or the defaults below.

The table below is generated from the design tokens. It lists every
property the stylesheet reads, so each one takes effect when set. Layout
values that the chart measures in JavaScript (label spacing, plot heights)
aren't properties, because setting them in CSS would do nothing. Check
custom colors for contrast against the background. After changing tokens,
regenerate the table with `node scripts/theming-table.js --write`; the build
fails while it is out of date.

<!-- theming-table:start (generated by scripts/theming-table.js) -->

**`font`**: Font stacks and numeral style.

| Property | Default | Styles |
|---|---|---|
| `--sc-font-family` | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"` | family |
| `--sc-font-mono` | `ui-monospace, Menlo, Monaco, Consolas, monospace` | mono |
| `--sc-font-numeric` | `tabular-nums` | numeric |

**`color`**: The semantic colors. Component colors that follow a role default to it in CSS, so a theme can recolor the chart by setting these few and still override any component on its own.

| Property | Default | Styles |
|---|---|---|
| `--sc-color-surface` | `#FFFFFF` | Background of the tile and tooltip, and the ring that separates marks. |
| `--sc-color-text-primary` | `#1A2C44` | Titles, values and other text read first. |
| `--sc-color-text-secondary` | `#3C4F69` | Labels and descriptions. |
| `--sc-color-text-muted` | `#50617A` | Tooltip dates, labels and notes. |
| `--sc-color-text-subtle` | `#667691` | The quietest text: axis labels. |
| `--sc-color-border` | `#D5DBE1` | Outlines of the tile. |
| `--sc-color-divider` | `#D4DEE9` | Gridlines and the thin rules between rows and sections. |
| `--sc-color-fill-subtle` | `#F4F7FA` | Quiet fills: the empty-state icon, button hovers and loading placeholders. |
| `--sc-color-good` | `#217005` | A change in the good direction (see `kpi.goodDirection`). |
| `--sc-color-bad` | `#C0123C` | A change in the bad direction. |
| `--sc-color-focus-ring` | `#9966FF` | Keyboard focus outlines. |

**`card`**: The chart's outer frame.

| Property | Default | Styles |
|---|---|---|
| `--sc-card-background` | `transparent` | background |
| `--sc-card-border-width` | `0px` | border width |
| `--sc-card-border-color` | follows `--sc-color-border` (`#D5DBE1`) | border color |
| `--sc-card-radius` | `0px` | radius |
| `--sc-card-padding` | `0px` | padding |

**`tile`**: The KPI-only tile.

| Property | Default | Styles |
|---|---|---|
| `--sc-tile-background` | follows `--sc-color-surface` (`#FFFFFF`) | background |
| `--sc-tile-border-width` | `1px` | border width |
| `--sc-tile-border-color` | follows `--sc-color-border` (`#D5DBE1`) | border color |
| `--sc-tile-radius` | `8px` | radius |
| `--sc-tile-padding` | `12px` | padding |
| `--sc-tile-gap` | `4px` | gap |
| `--sc-tile-label-size` | `14px` | label, size |
| `--sc-tile-label-line-height` | `20px` | label, line height |
| `--sc-tile-label-weight` | `400` | label, weight |
| `--sc-tile-label-color` | follows `--sc-color-text-secondary` (`#3C4F69`) | label, color |
| `--sc-tile-value-size` | `24px` | value, size |
| `--sc-tile-value-line-height` | `32px` | value, line height |
| `--sc-tile-value-weight` | `700` | value, weight |
| `--sc-tile-value-color` | follows `--sc-color-text-primary` (`#1A2C44`) | value, color |
| `--sc-tile-change-size` | `12px` | change, size |
| `--sc-tile-change-line-height` | `16px` | change, line height |
| `--sc-tile-change-weight` | `600` | change, weight |
| `--sc-tile-change-color` | follows `--sc-color-text-secondary` (`#3C4F69`) | change, color |
| `--sc-tile-change-gap` | `8px` | change gap |

**`header`**: Title, description and the gap below them.

| Property | Default | Styles |
|---|---|---|
| `--sc-header-gap` | `4px` | gap |
| `--sc-header-title-size` | `16px` | title, size |
| `--sc-header-title-line-height` | `24px` | title, line height |
| `--sc-header-title-weight` | `400` | title, weight |
| `--sc-header-title-color` | follows `--sc-color-text-primary` (`#1A2C44`) | title, color |
| `--sc-header-description-size` | `12px` | description, size |
| `--sc-header-description-line-height` | `16px` | description, line height |
| `--sc-header-description-weight` | `400` | description, weight |
| `--sc-header-description-color` | follows `--sc-color-text-secondary` (`#3C4F69`) | description, color |
| `--sc-header-plot-gap` | `24px` | plot gap |

**`kpi`**: The headline value in a full chart.

| Property | Default | Styles |
|---|---|---|
| `--sc-kpi-value-size` | `24px` | value, size |
| `--sc-kpi-value-line-height` | `32px` | value, line height |
| `--sc-kpi-value-weight` | `700` | value, weight |
| `--sc-kpi-value-color` | follows `--sc-color-text-primary` (`#1A2C44`) | value, color |
| `--sc-kpi-compact-value-size` | `20px` | compact value, size |
| `--sc-kpi-compact-value-line-height` | `28px` | compact value, line height |
| `--sc-kpi-compact-value-weight` | `700` | compact value, weight |
| `--sc-kpi-compact-value-color` | follows `--sc-color-text-primary` (`#1A2C44`) | compact value, color |
| `--sc-kpi-change-size` | `14px` | change, size |
| `--sc-kpi-change-line-height` | `20px` | change, line height |
| `--sc-kpi-change-weight` | `400` | change, weight |
| `--sc-kpi-change-color` | follows `--sc-color-text-secondary` (`#3C4F69`) | change, color |
| `--sc-kpi-change-gap` | `8px` | change gap |

**`plot`**: The plot area's insets and default height.

| Property | Default | Styles |
|---|---|---|
| `--sc-plot-inset-top` | `8px` | inset top |
| `--sc-plot-inset-bottom` | `8px` | inset bottom |
| `--sc-plot-default-height` | `240px` | default height |

**`axis`**: Axis labels, baseline, ticks and label spacing.

| Property | Default | Styles |
|---|---|---|
| `--sc-axis-label-line-height` | `16px` | label, line height |
| `--sc-axis-label-weight` | `400` | label, weight |
| `--sc-axis-label-color` | follows `--sc-color-text-subtle` (`#667691`) | label, color |
| `--sc-axis-label-gap` | `8px` | label gap |
| `--sc-axis-baseline-color` | `#BAC8DA` | baseline color |
| `--sc-axis-baseline-width` | `1px` | baseline width |

**`grid`**: Horizontal gridlines.

| Property | Default | Styles |
|---|---|---|
| `--sc-grid-color` | follows `--sc-color-divider` (`#D4DEE9`) | color |
| `--sc-grid-opacity` | `0.66` | opacity |
| `--sc-grid-width` | `1px` | width |

**`series`**: Lines and bars.

| Property | Default | Styles |
|---|---|---|
| `--sc-series-primary-0` | `#9966FF` | primary, color 1 |
| `--sc-series-primary-1` | `#0055BC` | primary, color 2 |
| `--sc-series-primary-2` | `#00A1C2` | primary, color 3 |
| `--sc-series-primary-3` | `#ED6804` | primary, color 4 |
| `--sc-series-primary-4` | `#B3063D` | primary, color 5 |
| `--sc-series-primary-5` | `#1C5A0D` | primary, color 6 |
| `--sc-series-primary-6` | `#FA4A67` | primary, color 7 |
| `--sc-series-primary-7` | `#922700` | primary, color 8 |
| `--sc-series-primary-8` | `#3DA00B` | primary, color 9 |
| `--sc-series-primary-9` | `#9966FF` | primary, color 10 |
| `--sc-series-primary-10` | `#0055BC` | primary, color 11 |
| `--sc-series-primary-11` | `#00A1C2` | primary, color 12 |
| `--sc-series-comparison` | `#95A4BA` | comparison |
| `--sc-series-comparison-dash` | `6 10` | comparison dash |
| `--sc-series-bar-group-ratio` | `0.8` | bar group ratio |

**`crosshair`**: The hover crosshair.

| Property | Default | Styles |
|---|---|---|
| `--sc-crosshair-color` | `#667691` | color |
| `--sc-crosshair-width` | `1px` | width |
| `--sc-crosshair-dash` | `2 2` | dash |

**`marker`**: Point markers on the hovered slot.

| Property | Default | Styles |
|---|---|---|
| `--sc-marker-ring-color` | follows `--sc-color-surface` (`#FFFFFF`) | ring color |

**`tooltip`**: The hover tooltip card.

| Property | Default | Styles |
|---|---|---|
| `--sc-tooltip-background` | follows `--sc-color-surface` (`#FFFFFF`) | background |
| `--sc-tooltip-radius` | `8px` | radius |
| `--sc-tooltip-padding` | `16px` | padding |
| `--sc-tooltip-shadow` | `0 3px 6px rgba(0, 0, 0, 0.12), 0 7px 14px rgba(48, 49, 61, 0.08)` | shadow |
| `--sc-tooltip-border-width` | `0px` | border width |
| `--sc-tooltip-border-color` | `transparent` | border color |
| `--sc-tooltip-min-width` | `160px` | min width |
| `--sc-tooltip-date-size` | `12px` | date, size |
| `--sc-tooltip-date-line-height` | `16px` | date, line height |
| `--sc-tooltip-date-weight` | `400` | date, weight |
| `--sc-tooltip-date-color` | follows `--sc-color-text-muted` (`#50617A`) | date, color |
| `--sc-tooltip-label-size` | `12px` | label, size |
| `--sc-tooltip-label-line-height` | `16px` | label, line height |
| `--sc-tooltip-label-weight` | `400` | label, weight |
| `--sc-tooltip-label-color` | follows `--sc-color-text-muted` (`#50617A`) | label, color |
| `--sc-tooltip-value-size` | `12px` | value, size |
| `--sc-tooltip-value-line-height` | `16px` | value, line height |
| `--sc-tooltip-value-weight` | `400` | value, weight |
| `--sc-tooltip-value-color` | follows `--sc-color-text-primary` (`#1A2C44`) | value, color |
| `--sc-tooltip-date-gap` | `8px` | date gap |
| `--sc-tooltip-annotated-date-size` | `14px` | annotated date, size |
| `--sc-tooltip-annotated-date-line-height` | `20px` | annotated date, line height |
| `--sc-tooltip-annotated-date-weight` | `600` | annotated date, weight |
| `--sc-tooltip-annotated-date-color` | follows `--sc-color-text-primary` (`#1A2C44`) | annotated date, color |
| `--sc-tooltip-column-gap` | `8px` | column gap |
| `--sc-tooltip-row-gap` | `4px` | row gap |
| `--sc-tooltip-swatch-width` | `12px` | swatch width |
| `--sc-tooltip-swatch-height` | `2px` | swatch height |
| `--sc-tooltip-swatch-dash` | `4 4` | swatch dash |
| `--sc-tooltip-tag-size` | `12px` | tag, size |
| `--sc-tooltip-tag-line-height` | `16px` | tag, line height |
| `--sc-tooltip-tag-weight` | `400` | tag, weight |
| `--sc-tooltip-tag-color` | `#7D8BA4` | tag, color |
| `--sc-tooltip-range-size` | `12px` | range, size |
| `--sc-tooltip-range-line-height` | `16px` | range, line height |
| `--sc-tooltip-range-weight` | `400` | range, weight |
| `--sc-tooltip-range-color` | follows `--sc-color-text-muted` (`#50617A`) | range, color |
| `--sc-tooltip-note-label-size` | `12px` | note label, size |
| `--sc-tooltip-note-label-line-height` | `16px` | note label, line height |
| `--sc-tooltip-note-label-weight` | `600` | note label, weight |
| `--sc-tooltip-note-label-color` | follows `--sc-color-text-primary` (`#1A2C44`) | note label, color |
| `--sc-tooltip-note-description-size` | `12px` | note description, size |
| `--sc-tooltip-note-description-line-height` | `16px` | note description, line height |
| `--sc-tooltip-note-description-weight` | `400` | note description, weight |
| `--sc-tooltip-note-description-color` | follows `--sc-color-text-muted` (`#50617A`) | note description, color |
| `--sc-tooltip-notes-gap` | `8px` | notes gap |
| `--sc-tooltip-note-gap` | `4px` | note gap |
| `--sc-tooltip-note-max-width` | `240px` | note max width |
| `--sc-tooltip-divider-color` | follows `--sc-color-divider` (`#D4DEE9`) | divider color |
| `--sc-tooltip-divider-width` | `1px` | divider width |

**`legend`**: The legend row below the plot: a button per series, and a forecast key.

| Property | Default | Styles |
|---|---|---|
| `--sc-legend-margin-top` | `16px` | margin top |
| `--sc-legend-column-gap` | `8px` | column gap |
| `--sc-legend-row-gap` | `8px` | row gap |
| `--sc-legend-swatch-gap` | `8px` | swatch gap |
| `--sc-legend-swatch-size` | `12px` | swatch size |
| `--sc-legend-label-size` | `12px` | label, size |
| `--sc-legend-label-line-height` | `16px` | label, line height |
| `--sc-legend-label-weight` | `400` | label, weight |
| `--sc-legend-label-color` | follows `--sc-color-text-secondary` (`#3C4F69`) | label, color |
| `--sc-legend-hover-background` | `#ECF1F6` | Background behind a hovered entry's label. |
| `--sc-legend-hover-color` | follows `--sc-color-text-primary` (`#1A2C44`) | Text color of a hovered entry's label. |
| `--sc-legend-hidden-opacity` | `0.4` | A hidden series' label (its swatch keeps full colour). |
| `--sc-legend-forecast-color` | follows `--sc-color-text-subtle` (`#667691`) | The "Forecast" key's color. |
| `--sc-legend-forecast-band-height` | `8px` | Height of the band behind the line chart's forecast key. |

**`empty`**: The empty plot.

| Property | Default | Styles |
|---|---|---|
| `--sc-empty-icon-size` | `40px` | icon size |
| `--sc-empty-glyph-size` | `16px` | glyph size |
| `--sc-empty-icon-background` | follows `--sc-color-fill-subtle` (`#F4F7FA`) | icon background |
| `--sc-empty-glyph-color` | `#545969` | glyph color |
| `--sc-empty-gap` | `20px` | gap |
| `--sc-empty-message-size` | `12px` | message, size |
| `--sc-empty-message-line-height` | `16px` | message, line height |
| `--sc-empty-message-weight` | `400` | message, weight |
| `--sc-empty-message-color` | follows `--sc-color-text-secondary` (`#3C4F69`) | message, color |

**`error`**: The invalid-spec card.

| Property | Default | Styles |
|---|---|---|
| `--sc-error-gap` | `8px` | gap |
| `--sc-error-title-size` | `14px` | title, size |
| `--sc-error-title-line-height` | `20px` | title, line height |
| `--sc-error-title-weight` | `600` | title, weight |
| `--sc-error-title-color` | follows `--sc-color-text-primary` (`#1A2C44`) | title, color |
| `--sc-error-issue-size` | `12px` | issue, size |
| `--sc-error-issue-line-height` | `16px` | issue, line height |
| `--sc-error-issue-weight` | `400` | issue, weight |
| `--sc-error-issue-color` | follows `--sc-color-text-secondary` (`#3C4F69`) | issue, color |
| `--sc-error-path-color` | follows `--sc-color-text-primary` (`#1A2C44`) | path color |

**`skeleton`**: The loading placeholders.

| Property | Default | Styles |
|---|---|---|
| `--sc-skeleton-color` | follows `--sc-color-fill-subtle` (`#F4F7FA`) | color |
| `--sc-skeleton-mark-color` | follows `--sc-color-divider` (`#D4DEE9`) | Stroke of the placeholder line. |
| `--sc-skeleton-radius` | `4px` | radius |
| `--sc-skeleton-kpi-width` | `25%` | Width of the KPI placeholder, as a share of the chart. |
| `--sc-skeleton-tick-width` | `32px` | Size of the y label placeholders. |
| `--sc-skeleton-tick-height` | `8px` | tick height |
| `--sc-skeleton-shimmer-highlight` | follows `--sc-color-surface` (`#FFFFFF`) | Peak color of the band that slides across a placeholder block. |
| `--sc-skeleton-shimmer-band-start` | `50%` | Where the band starts rising from `color`, across the background. |
| `--sc-skeleton-shimmer-band-peak` | `80%` | Where the band peaks at its highlight. |
| `--sc-skeleton-shimmer-size` | `200% 100%` | shimmer size |
| `--sc-skeleton-updating-opacity` | `0.4` | Opacity of the data while a chart that has data is updating. |
| `--sc-skeleton-sweep-highlight` | follows `--sc-color-surface` (`#FFFFFF`) | Color of the band that sweeps over an updating chart. |
| `--sc-skeleton-sweep-highlight-opacity` | `0.7` | How strongly that band shows over the chart. |

**`annotation`**: Annotations: dashed vertical markers, hollow series-colored point markers on a series, and shaded ranges behind the marks.

| Property | Default | Styles |
|---|---|---|
| `--sc-annotation-line-color` | follows `--sc-color-text-muted` (`#50617A`) | line color |
| `--sc-annotation-line-dash` | `4 4` | line dash |
| `--sc-annotation-point-color` | follows `--sc-color-surface` (`#FFFFFF`) | The hollow marker's interior follows the chart surface. |
| `--sc-annotation-point-ring-width` | `2px` | point ring width |
| `--sc-annotation-point-shadow` | `drop-shadow(0 0 3px rgba(48, 49, 61, 0.2))` | point shadow |
| `--sc-annotation-range-color` | follows `--sc-color-text-secondary` (`#3C4F69`) | range color |
| `--sc-annotation-range-opacity` | `0.08` | range opacity |
| `--sc-annotation-range-end-opacity` | `0` | Opacity at the bottom of the shaded range. |

**`incomplete`**: The incomplete period: dashed lines, hatched lighter bars, a range.

| Property | Default | Styles |
|---|---|---|
| `--sc-incomplete-line-dash` | `0.5 4` | line dash |
| `--sc-incomplete-bar-opacity` | `0.5` | bar opacity |
| `--sc-incomplete-hatch-color` | follows `--sc-color-surface` (`#FFFFFF`) | Surface-colored stripes laid over incomplete bars. |
| `--sc-incomplete-range-color` | follows `--sc-color-text-secondary` (`#3C4F69`) | range color |
| `--sc-incomplete-range-opacity` | `0.08` | range opacity |

**`forecast`**: Forecasts: dashed lines with a low-high band, outlined light bars.

| Property | Default | Styles |
|---|---|---|
| `--sc-forecast-line-dash` | `8 4 0.5 4` | line dash |
| `--sc-forecast-swatch-dash` | `4 2 1 2` | The forecast dash for legend and tooltip swatches. |
| `--sc-forecast-band-opacity` | `0.12` | band opacity |
| `--sc-forecast-bar-fill-opacity` | `0.15` | bar fill opacity |

**`projected`**: Where an incomplete period is on pace to end: lines run their dotted tail to the projected value and mark the actual value so far; bars add a dashed outline from the actual top to the projected height.

| Property | Default | Styles |
|---|---|---|
| `--sc-projected-marker-fill` | follows `--sc-color-surface` (`#FFFFFF`) | marker fill |
| `--sc-projected-connector-dash` | `1 2` | connector dash |
| `--sc-projected-connector-opacity` | `0.5` | connector opacity |
| `--sc-projected-extension-dash` | `3 2` | extension dash |

**`sparkline`**: The sparkline in a KPI tile.

| Property | Default | Styles |
|---|---|---|
| `--sc-sparkline-width` | `96px` | Width beside the value... |
| `--sc-sparkline-height` | `56px` | height |
| `--sc-sparkline-compact-height` | `40px` | Height when the sparkline is under the value. |
| `--sc-sparkline-stroke-width` | `2px` | stroke width |
| `--sc-sparkline-comparison-dash` | `3 3` | comparison dash |
| `--sc-sparkline-area-opacity` | `0.18` | Opacity at the top of the area under the primary line. |
| `--sc-sparkline-halo-opacity` | `0.2` | halo opacity |

<!-- theming-table:end -->

## Formatting

- **Money units.** With `"unit": "minor"`, amounts are the integers the
  Stripe API returns (`1999` is $19.99, ¥1,999 or KWD 1.999 depending on the
  currency). With `"unit": "major"`, `12.5` is $12.50. Either way the chart
  shows the same thing; see [Units and correctness](#units-and-correctness).
- **Intl.** Numbers, currencies and dates are formatted with the browser's
  `Intl` APIs in `locale`.
- **Currency decimals.** The currency decides the decimals, so zero-decimal
  currencies such as JPY never show any: `{"currency": "jpy"}` formats
  `18406500` as ¥18,406,500. Amounts of 1,000 or more are shown in whole
  units in the KPI and tooltip.
- **Axis ticks** use compact labels (`$300K`, `$1M`) when they show every tick
  exactly, and full values otherwise.
- **KPI change** is `(value - comparisonValue) / |comparisonValue|`, shown with
  its sign and one decimal (`+14.3%`), green when positive and red when
  negative (the other way around with `kpi.goodDirection: "down"`). The
  change is always relative, also for the `"percent"` format:
  a conversion rate of 4.12% against 3.97% shows `+3.8%`, not +0.15
  percentage points.
- **Built-in text is English.** Numbers and dates follow `locale`, but the
  few strings the chart adds itself (such as "No data") are English in this version.

## Dates and time zones

- A **date-only** value like `"2026-11-27"` is a calendar day. It is shown as
  that day everywhere and never shifted by a time zone.
- A **date-time** value like `"2026-11-27T18:00:00Z"` is an instant. It is
  shown in `timeZone`, which is required as soon as any date-time is in the
  spec.
- The viewer's own time zone is **never** used, so a chart looks the same for
  everyone.

## Comparisons line up by position

The i-th point of every series is drawn in the same x slot, whatever its
date. You decide which days correspond by putting them at the same index.
The dates of the first non-comparison series label the x axis and the
tooltip header; the tooltip rows show each series' label and value, without
dates. Each comparison point's own date is in the screen-reader announcement
for the slot.

For example, compare five-day sales campaigns that began on different dates.
Put corresponding campaign days in the same slots:

| Index | 2026 (`series[0]`) | 2025 (`series[1]`, `comparison: true`) |
|---|---|---|
| 0 | `2026-11-26` | `2025-11-27` |
| 1 | `2026-11-27` | `2025-11-28` |
| 2 | `2026-11-28` | `2025-11-29` |
| 3 | `2026-11-29` | `2025-11-30` |
| 4 | `2026-11-30` | `2025-12-01` |

Hovering index 1 shows a tooltip headed "Nov 27" with a row for 2026 and a
row for 2025 (which is Nov 28, 2025). Series may have different lengths; the
chart has as many slots as the longest series.

## Annotations, incomplete periods and forecasts

**Annotations** mark events. Each needs a `label` and either `at` (one slot)
or `from` and/or `to` (a shaded range). With `at` and `series`, the marker
sits on that series' point as a hollow circle in its color, with an outer
ring on hover. Its tooltip names the series above the annotation label.
An `at` without `series` draws a dashed vertical line. Ranges fade toward
the bottom of the plot, with dashed boundaries at the specified dates;
an omitted endpoint extends to the plot edge without a boundary line.
Dates are x values of the primary series,
written exactly as there, since series line up by position. Hovering a slot
inside an annotation adds it to the tooltip.

```json
{
  "title": "Gross volume",
  "format": {"style": "currency", "currency": "usd", "unit": "minor"},
  "chart": {"type": "line"},
  "series": [{"label": "2026", "data": [
    {"x": "2026-11-26", "y": 28641025}, {"x": "2026-11-27", "y": 41200025},
    {"x": "2026-11-28", "y": 33895080}, {"x": "2026-11-29", "y": 30122040},
    {"x": "2026-11-30", "y": 45573010}
  ]}],
  "annotations": [
    {"label": "Campaign launch", "at": "2026-11-27"},
    {"label": "Campaign close", "at": "2026-11-30"},
    {"label": "Weekend promo", "from": "2026-11-28", "to": "2026-11-29"}
  ]
}
```

**Incomplete periods.** `chart.incomplete: {"from": x}` marks the slots from
`x` to the end as not final yet, for example today: lines turn dashed from
the last complete point, bars are hatched, the period gets a note
(`message`, default "Data in this period is still being processed") and
tooltip rows are tagged "Incomplete". KPI bases still include these points,
since they are real data.

An incomplete point can also say where its period is on pace to end, with
`projected`: for example this month's revenue so far (`y`) and the month's
projected total. Lines draw the incomplete tail up to the projected value,
still dotted, with a marker at the value so far; bars draw the hatched value
so far plus an outlined extension to the projection. The tooltip reads "so
far … · on pace for …"; the legend gets an "On pace" key, the y axis makes room for
the projection, and `kpi.basis` checks use `y`, the value so far. Hovering
an incomplete point shows the value so far in the KPI and, with `projected`,
the change on pace (for example "+25.1% on pace"); without `projected` the
change is left out, since a partial period can't be compared.

```js
// Month to date on December 15: $3.1M so far, on pace for $6.4M.
{"x": "2026-12-01", "y": 310000000, "projected": 640000000}
```

A projection differs from a forecast: it is the pace of a real period that
hasn't finished, drawn on that period's own point, while a forecast point is
a period that hasn't started yet.

**Forecasts.** Points with `"forecast": true`, one run at the end of a
series, are drawn dashed for lines and outlined for bars, with an optional
`low`/`high` range shown as a band on lines. Tooltip rows are tagged
"Forecast" with the range, and the legend explains the style. The `total`, `latest` and `average` KPI bases
leave forecast points out. An incomplete period must end before the
forecast starts.

```js
// One forecast point in series[].data:
{"x": "2027-01-01", "y": 262000, "forecast": true, "low": 248000, "high": 276000}
```

## Axes

`chart.axes` adjusts the labels without callbacks:

| Field | Values | Default |
|---|---|---|
| `chart.axes.x.labels` | `"auto"`, `"day"`, `"month"`, `"year"` or `"time"` | `"auto"`: picks hours, days, weeks, months or years from the data |
| `chart.axes.y.notation` | `"compact"` (`$300K`) or `"standard"` (`$300,000`) | `"compact"`, exact enough to tell every tick apart |
| `chart.axes.y.maximumFractionDigits` | integer, 0 to 20 | chosen per axis |

Labels are still thinned to fit, and never collide. For anything else, use
the `formatYTick` and `formatXTick` [render options](#render-options).

## Errors and how to fix them

Every problem names the field path and what was expected. Common ones:

| Message | Fix |
|---|---|
| `title: required; expected a non-empty string` | Add a `title`. |
| `subtitle: unexpected field "subtitle"; did you mean "description"?` | Rename the field. Misspellings and common alternatives get a suggestion, for example `date` -> `x`, `value` -> `y`, `type` -> `chart.type`. |
| `format.currency: required when format.style is "currency"; expected an ISO 4217 code like "usd"` | Add `currency`. |
| `format.maximumFractionDigits: unexpected field "maximumFractionDigits"; not allowed for currencies; the currency decides the decimals` | Remove it; currency amounts use the currency's decimals. |
| `format.unit: required for currency; Stripe API amounts are in minor units (1999 = $19.99), so use "minor" for those, or "major" if the values are already converted` | Add `"unit": "minor"` for amounts straight from the Stripe API. |
| `format.unit: required for percent; use "ratio" if 0.025 means 2.5%, or "percent" if 2.5 means 2.5%` | Add the unit your numbers use. |
| `format.unit: expected one of "minor", "major", got "cents"; did you mean "minor"?` | Use one of the listed values. |
| `kpi.basis: required; expected how kpi.value relates to the primary series: "total" (its sum), "latest" (its last value), "average" (its mean), or "custom" for a figure computed elsewhere` | Add the basis that describes how you computed `kpi.value`. |
| `kpi.value: expected about 412000.25 for basis "total" (the sum of series[0]'s actual values), got the number 300000; fix the value, pick the basis that matches it, or use "custom" for a figure computed differently` | The KPI and the series disagree. Fix whichever is wrong, or use `"custom"` if the KPI is computed another way. |
| `kpi.comparisonValue: expected about 6 for basis "latest" (series[1]'s value at slot 1, where series[0]'s latest actual value is), got the number 9; ...` | The comparison is checked at the same slot as the primary's latest actual value (for `"total"` and `"average"`, over the primary's actual slots), so a plan or a longer last-year series past that point doesn't count. |
| `timeZone: required because series[0].data[0].x is a date-time; expected the IANA time zone the data was reported in, like "America/New_York", or "UTC" if its times are UTC` | Add `timeZone`. |
| `kpi.notation: expected one of "standard", "compact", got "short"; did you mean "compact"?` | Use `"compact"` to abbreviate or `"standard"` for the full value. |
| `annotations[0].at: expected an x value of the primary series, written exactly as there (series line up by position), got "2026-11-29"; nearest are "2026-11-28", ...` | Use one of the primary series' own x values. The same applies to `from`, `to` and `chart.incomplete.from`. |
| `annotations[0]: expected "at" for a marker, or "from" and/or "to" for a shaded range` | Give the annotation a place. |
| `series[0].data[1].forecast: expected true: forecast points must run to the end of the series, ...` | Put every forecast point after the actual ones. |
| `series[0].data[0].projected: only for points inside chart.incomplete (from "2026-12-02"); this point is final, so leave out "projected"` | Only unfinished points can carry a projection. Without `chart.incomplete`, set its `from` to the first unfinished x. Comparison series and forecast points can't have one either. |
| `series[0].data[1].projected: expected the same sign as y (30), since the projection extends the value so far` | Keep `projected` on the same side of zero as `y`, and give the point a `y`. |
| `series[0].data[1].projected: expected at least y (4.2) on a bar chart, since the projection extends the bar beyond the value so far; ...` | On bars, a projection only extends the value so far. For a value on pace to end lower, such as a rate, use a line chart. |
| `series[0].data[1].low: expected at most y (2), got the number 3` | Keep `low <= y <= high`. |
| `series[0].color: expected a hex color like "#635bff" or "#fff", got "red"` | Use `#rgb` or `#rrggbb` hex. |
| `chart.type: expected one of "line", "bar", "kpi", got "area"` | Use a supported type. |
| `series: required unless chart.type is "kpi" or loading is true; expected an array of 1 to 12 series` | Add `series`, use `"chart": {"type": "kpi"}`, or set `loading: true` until the data arrives. |
| `chart.stacking: only allowed when chart.type is "bar"; got chart.type "line"` | Remove `stacking`, or use a bar chart. |
| `series[1].comparison: comparison series can't be stacked; use chart.stacking "grouped" or remove "comparison"` | Group the bars, or drop `comparison`. |
| `series: expected 1 to 12 items, got 0` | Give at least one series. To show "No data", pass series with empty `data` arrays. |
| `series[0].data[0].x: expected an ISO date like "2026-11-27" or a date-time like "2026-11-27T18:00:00Z", got "Nov 27"` | Send ISO dates. Date-times need `Z` or an offset. |
| `series[0].data[1].y: expected a finite number or null, got "338950.80"` | Send a JSON number, not a string; `null` marks a gap. |
| `timeZone: "Mars/Base" is not an IANA time zone this browser supports` | Use a zone the browser's `Intl` knows, such as `"America/New_York"`. The same applies to `locale` and `format.currency`. |

All problems are reported at once, so a spec can be fixed in one pass.

## Accessibility

- The chart is a `figure` named by its title and described by a text summary
  that names every series with its range, lowest, highest and latest values,
  and the headline value with its change.
- While a slot is hovered or focused, the KPI shows the primary series'
  value at that slot and its change against the first comparison series,
  and goes back on leave, blur or Escape. In a stacked bar chart it shows
  the slot's stack total (net of negative segments), without a change.
- The plot can be focused with Tab. Left and right arrow keys move between
  points, Home and End jump to the first and last, Escape hides the tooltip.
  The values at the current point are announced to screen readers.
- Taps drive the tooltip and sparkline; hover is not required.
- All motion is turned off under `prefers-reduced-motion: reduce`.
- Legend entries are buttons with `aria-pressed`; hiding the last visible
  series is refused with a polite announcement.
- Annotations and the incomplete period are in the accessible summary.
- The error card uses `role="alert"`.

## Motion

- **Entrance.** When a chart first renders, lines draw in from left to right
  (600ms) and bars grow from the baseline (480ms, 24ms apart), on an ease-out
  curve. Series enter one after another, in series order (80ms apart). The header and KPI
  fade up (200ms), and the info button fades in after the entrance.
- **Updates.** An `update()` with the same shape (the same chart type and the
  same number of slots and series) tweens the values and the y axis over
  400ms. A different shape cross-fades the old marks out while the new ones
  enter.
- **Loading.** The placeholder shimmers. When the data arrives, it fades out
  (200ms) while the chart enters. `loading: true` on a chart that has data
  keeps the chart in place, dimmed, with a shimmer sweeping over the plot.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` every animation
  is off: charts appear at once, the placeholder is static, and a refreshing
  chart is dimmed without the sweep.
- Hover, focus and resizing never animate, and motion never changes layout.

## Security

What the browser file does, and how to check it:

- **No network requests.** No `fetch`, `XMLHttpRequest`, `WebSocket`,
  `EventSource`, `sendBeacon`, dynamic `import()` or `importScripts`, and no
  URLs other than the SVG/XLink/XML namespace names.
- **No code from strings.** No `eval`, `new Function` or `Function()`.
- **No markup from strings.** No `innerHTML`, `outerHTML`,
  `insertAdjacentHTML` or `document.write`; every string from the spec is set
  as text.
- **No dependencies and no telemetry.**

`scripts/check-bundle.js` fails the build if the bundle contains any of the
patterns above, and runs on every build. To check a copy yourself:

```sh
node scripts/check-bundle.js path/to/stripe-charts.min.js
```

`examples/standalone.html` is the end-to-end check: opened in a browser, it
makes exactly two requests (the page and the script).
