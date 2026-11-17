// Builds the files for loading the package without a bundler:
//   dist/stripe-charts.min.js       one minified script that defines the
//                                   StripeCharts global (entry: src/browser.ts)
//   dist/stripe-charts.schema.json  JSON Schema for the spec
// The schema is also available as a standalone JSON file for validators.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const schema = path.join(root, 'src', 'schema.json');

esbuild.buildSync({
  entryPoints: [path.join(root, 'src', 'browser.ts')],
  outfile: path.join(dist, 'stripe-charts.min.js'),
  bundle: true,
  platform: 'browser',
  // A classic script, so a plain <script src> tag works without type="module".
  format: 'iife',
  target: 'es2020',
  minify: true,
  // The package's own license notice ships alongside, not inside, the bundle.
  legalComments: 'none',
  logLevel: 'warning',
});

fs.copyFileSync(schema, path.join(dist, 'stripe-charts.schema.json'));
fs.copyFileSync(schema, path.join(dist, 'schema.json'));
