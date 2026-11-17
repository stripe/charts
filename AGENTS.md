# Stripe Charts

This is a standalone public package. Use public npm dependencies and keep all
source, examples, documentation, and configuration suitable for this repository.

- Keep the core and browser bundle free of runtime dependencies, network calls,
  telemetry, `eval`, and HTML string injection. React is an optional peer for
  the separate `./react` entry point.
- Preserve the layers: spec and validation, model, layout, then DOM/SVG render.
  Visual values belong in `src/tokens.ts`.
- Keep the public types, JSON Schema, validation, and docs/reference.md aligned. Comparison
  series align by position; calendar dates must not shift with the viewer's zone.
- Storybook lives here: `.storybook/` loads `stories/**/*.stories.ts`.
- Use `npm ci` with Node.js 22.12 or newer. Verify changes with `npm run types`,
  `npm run types:stories`, `npm run lint`, `npm test -- --runInBand`,
  `npm run build:all`, and `npm run storybook:build` as appropriate.
- Add tests for consequential behavior, reuse existing coverage, and visually
  verify changes that affect rendering or Storybook.
- Keep the name and version in `package.json` and `src/meta.ts` aligned.
