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

The sidebar is ordered Intro, Charts, Features, Examples. Chart types
live under Charts; behavior such as annotations and comparisons lives under
Features. Each code panel has React and JavaScript tabs (HTML for the intro’s
setup example). Storybook shows the chart and generated code together, with
controls where they help explain a choice.

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

## Static Storybook

The Storybook workflow builds the static site and uploads it as a workflow
artifact. To view it locally, download and extract it to `storybook-static/`,
then run `npm run storybook:serve`.
