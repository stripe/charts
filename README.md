# Stripe Charts

Stripe Charts is intended for use with the Stripe BFCM Dashboard skill.

![A gross-volume chart comparing this year with last year](docs/assets/chart-preview.svg)

**[Run Storybook locally](#run-from-source)** ·
[API and spec reference](docs/reference.md) ·
[React](docs/reference.md#react)

## Try it

Install [Stripe Charts from npm](https://www.npmjs.com/package/@stripe/charts):

```sh
npm install @stripe/charts
```

### JavaScript

Render into a `<div id="chart"></div>`:

```js
import {render} from '@stripe/charts';

render(document.getElementById('chart'), {
  version: 1,
  title: 'Orders',
  series: [{label: 'Orders', data: [
    {x: '2026-11-01', y: 120},
    {x: '2026-11-02', y: 180},
  ]}],
});
```

### TypeScript

```ts
import {render, type ChartSpec} from '@stripe/charts';

const spec: ChartSpec = {
  version: 1,
  title: 'Orders',
  series: [{label: 'Orders', data: [
    {x: '2026-11-01', y: 120},
    {x: '2026-11-02', y: 180},
  ]}],
};

const element = document.getElementById('chart');
if (element) render(element, spec);
```

### React

```jsx
import {StripeChart} from '@stripe/charts/react';

export function OrdersChart() {
  return <StripeChart spec={{
    version: 1,
    title: 'Orders',
    series: [{label: 'Orders', data: [
      {x: '2026-11-01', y: 120},
      {x: '2026-11-02', y: 180},
    ]}],
  }} />;
}
```

## Build a report

Start with the [reporting examples](examples/)
or a [complete recap page](examples/dashboards/sales-recap.html).

| Need | Guide |
| --- | --- |
| Amounts straight from the Stripe API | [Money and units](docs/reference.md#units-and-correctness) |
| Compare matching periods across years | [Comparisons](docs/reference.md#comparisons-line-up-by-position) |
| Report in the business’s time zone | [Dates and time zones](docs/reference.md#dates-and-time-zones) |
| Explain a promotion, outage, or partial day | [Annotations](docs/reference.md#annotations-incomplete-periods-and-forecasts) |
| Understand a rejected spec | [Validation](docs/reference.md#errors-and-how-to-fix-them) |

Use up to 12 series and 1000 points per series. Aggregate dense data before
charting.

## Run from source

With Node.js 22.12 or newer:

```sh
git clone https://github.com/stripe/charts.git
cd charts
npm ci
npm run storybook
```

Open <http://127.0.0.1:6107>. This builds the package and serves local examples;
no published npm release is needed. See [development instructions](docs/development.md)
for builds, checks, and the static gallery.

## License

[MIT](LICENSE). Maintained by Stripe. [Project information](CONTRIBUTING.md).
