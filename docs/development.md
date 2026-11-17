# Working with the source

Use Node.js 22.12 or newer and npm. From the repository root:

```sh
npm ci
npm run storybook
```

Open <http://127.0.0.1:6107>. The command builds the package before starting
Storybook. The gallery serves its own browser bundle, reference files, and
standalone HTML examples, so all examples work before an npm release exists.

## Builds and checks

```sh
npm run types
npm run types:stories
npm run lint
npm test -- --runInBand
npm run build:all
npm run storybook:build
```

`build:all` produces the ESM entry points, TypeScript declarations, standalone
browser bundle, and JSON Schema in `dist/`, and checks the bundle and generated
reference tables. `storybook:build` builds the package and the gallery.
Use `npm run storybook:serve` to serve the static result at
<http://127.0.0.1:6108>.

## Use the package in another project

Until the first npm publication, build a tarball from this checkout:

```sh
npm ci
npm pack
```

Then, from your application, install that file:

```sh
npm install /path/to/charts/stripe-charts-0.0.1.tgz
```

For React, also install compatible React and React DOM versions (18 or newer).
Import `render` from `@stripe/charts`, or `StripeChart` from
`@stripe/charts/react`. The tarball includes the Markdown reference and schema.

## Documentation and examples

The sidebar is ordered Intro, Charts, Features, React, Examples. Chart types
live under Charts; behavior such as annotations and comparisons lives under
Features. Keep explanatory material beside small, runnable demonstrations.
Storybook’s guide wrapper shows the chart and generated code together, and
provides controls where they help explain a choice.

The full API reference is [reference.md](reference.md). Its theme table is
generated from the design tokens:

```sh
node scripts/theming-table.js --write
```

The README preview is a static SVG assembled from the chart renderer using
synthetic example data and fixed geometry; it is not a browser screenshot:

```sh
npm run preview:build
```

## Public gallery

GitHub Actions builds and deploys Storybook to <https://stripe.github.io/charts/>
on pushes to `main`, or when the Storybook workflow is run manually. The
repository’s Pages source must be GitHub Actions. The workflow publishes only
the built site, browser bundle, reference files, and examples; it does not
publish an npm package.
