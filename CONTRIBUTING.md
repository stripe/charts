# Contributing

Contributions of any kind are welcome! If you've found a bug or have a
feature request, please [open an issue](https://github.com/stripe/charts/issues).
We aim to acknowledge new issues and
pull requests within five business days.

## Reporting a bug

A good report includes:

- the spec you passed to `render` (trim the data to the smallest set of
  points that still shows the problem);
- what you expected and what you saw, with a screenshot if it's visual;
- the browser and version, and the `version` export of the package.

If the bug is a validation message that led you astray, include the full
message: the messages are meant to teach the fix, so a confusing one is a bug.

Please don't open public issues or pull requests for security
vulnerabilities. Report them privately through Stripe's
[vulnerability disclosure program](https://hackerone.com/stripe).

## Making a change

1. [Fork the repository](https://github.com/stripe/charts/fork) and
   [clone it to your machine](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository).
2. Use Node.js 22.12 or newer, install dependencies, and check that everything
   passes before you start:

   ```sh
   npm ci
   npm run types
   npm run types:stories
   npm run lint
   npm run build:all   # ESM, types, browser bundle, schema and bundle check
   npm test            # tests
   npm run storybook   # stories at http://127.0.0.1:6107
   ```

3. Make your change, with a test where it protects behavior that matters.
4. [Open a pull request from your fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork).
   Describe what changed and why, and
   include before and after screenshots for anything visual.

A maintainer at Stripe reviews and merges every pull request.

### Storybook

This repository owns its Storybook. Its configuration lives in `.storybook/`
and loads only `stories/**/*.stories.ts`, using the HTML renderer and Vite.
The sidebar is ordered as Intro, Charts, Features, React, and Examples. Keep
chart types under Charts; annotations, axes, legends, forecasts, details, and
states under Features; React bindings under React; and complete use cases and
API demonstrations under Examples.
Run `npm run storybook` and open <http://127.0.0.1:6107>. The Chart / Code
toggle shows a runnable example for each chart; React examples use the
optional React binding.

To check the static site, run `npm run storybook:build` followed by
`npm run storybook:serve`, then open <http://127.0.0.1:6108>.

`npm run build:all` creates the ESM entry points, TypeScript declarations,
browser bundle, and JSON Schema under `dist/`. `npm pack` runs this build
before packaging. React and React DOM are optional peers; the core and
script-tag bundle have no runtime dependencies.

### What we look for

- **No runtime dependencies.** The package ships as one self-contained file
  that loads with a single script tag, so `dependencies` stays empty.
- **No network, `eval` or `innerHTML`.** The bundle check (`npm run
  build:all`) fails the build if any of these appear. Every string from a spec
  is set as text.
- **Design tokens.** Visual values (colors, sizes, timings) come from
  `src/tokens.ts`, never from literals in render code.
- **Clear layers.** `spec` (types and validation) feeds `model` (pure data),
  which feeds `layout` (pure geometry), which feeds `render` (DOM and SVG).
  Only `render` touches the DOM, so the other layers are tested without a
  browser.
- **Explicit API.** New spec fields are documented in TSDoc, mirrored in
  `src/schema.json`, and validated with a message that names the field path
  and what was expected.
- **Accessibility.** Charts keep an accessible name and summary, and every
  interaction works from the keyboard.

## Contributor License Agreement (CLA)

Once you've opened a pull request, [CLA Assistant](https://github.com/CLAassistant)
will comment asking you to sign our Contributor License Agreement. Click the
badge in that comment to sign it.
We can only merge pull requests from contributors who have signed the CLA.

Thanks for contributing to Stripe! ✨
