// Builds a copy of the browser bundle with higher size limits, to measure
// how the renderer behaves past them. Only the limits in src/spec.ts
// change, in memory while bundling; the sources are not modified and the
// result is for benchmarks only.
//   node bench/build-raised-limits.js <outfile> [maxPoints] [maxSeries]
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const [outfile, maxPoints = '20000', maxSeries = '8'] = process.argv.slice(2);
if (!outfile) {
  process.stderr.write(
    'usage: node bench/build-raised-limits.js <outfile> [maxPoints] [maxSeries]\n',
  );
  process.exit(1);
}

const root = path.join(__dirname, '..');
const specFile = path.join(root, 'src', 'spec.ts');

/** Replaces one `name: number` entry of LIMITS, failing if it is missing. */
function raise(source, name, value) {
  const pattern = new RegExp(`(\\n  ${name}: )\\d+,`);
  if (!pattern.test(source)) throw new Error(`LIMITS.${name} not found`);
  return source.replace(pattern, `$1${Number(value)},`);
}

const raisedLimits = {
  name: 'raised-limits',
  setup(build) {
    build.onLoad({filter: /[\\/]src[\\/]spec\.ts$/}, () => {
      let contents = fs.readFileSync(specFile, 'utf8');
      contents = raise(contents, 'maxPoints', maxPoints);
      contents = raise(contents, 'maxSeries', maxSeries);
      return {contents, loader: 'ts'};
    });
  },
};

// The same options as scripts/build-browser.js. Plugins need the async API.
esbuild
  .build({
    entryPoints: [path.join(root, 'src', 'browser.ts')],
    outfile: path.resolve(outfile),
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2020',
    minify: true,
    legalComments: 'none',
    logLevel: 'warning',
    plugins: [raisedLimits],
  })
  .then(() => {
    process.stdout.write(
      `${outfile}: maxPoints ${maxPoints}, maxSeries ${maxSeries}\n`,
    );
  })
  .catch(() => process.exit(1));
