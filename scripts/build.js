const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

// Shared chunks preserve one copy of the renderer across the core and React
// entry points. React remains an optional peer, outside either bundle.
esbuild.buildSync({
  absWorkingDir: root,
  entryPoints: {index: 'src/index.ts', 'react/index': 'src/react/index.ts'},
  outdir: 'dist',
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  packages: 'external',
  sourcemap: true,
});

fs.writeFileSync(path.join(root, 'dist/package.json'), '{"type":"module"}\n');
