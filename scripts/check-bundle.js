// Fails if the browser bundle contains anything that could run generated code,
// make a network request or write markup, then prints its size. The package
// promises none of these, and this makes the promise checkable on every build.
//   node scripts/check-bundle.js [bundle path]
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const file =
  process.argv[2] ?? path.join(__dirname, '..', 'dist', 'stripe-charts.min.js');
const code = fs.readFileSync(file, 'utf8');

const FORBIDDEN = [
  // Running strings as code.
  ['eval', /\beval\s*\(/],
  ['new Function', /\bnew\s+Function\b/],
  ['Function()', /(^|[^\w$.])Function\s*\(/],
  // Network access and loading code at runtime.
  ['fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
  ['sendBeacon', /\bsendBeacon\b/],
  ['import()', /\bimport\s*\(/],
  ['importScripts', /\bimportScripts\b/],
  ['require()', /\brequire\s*\(/],
  // Parsing strings as markup; every string must be set as text.
  ['innerHTML', /\binnerHTML\b/],
  ['outerHTML', /\bouterHTML\b/],
  ['insertAdjacentHTML', /\binsertAdjacentHTML\b/],
  ['document.write', /\bdocument\.write/],
  // The script-tag build is framework-free; React is only for the separate
  // `./react` entry. Every React build tags its elements with these symbols.
  ['React', /Symbol\.for\(\s*["'`]react\./],
];

// Namespace identifiers needed to create SVG elements. They are names, never
// requested.
const ALLOWED_URLS = new Set([
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/XML/1998/namespace',
]);
const URL_PATTERN = /(?:https?:|wss?:)?\/\/[\w.-]+\.[a-z]{2,}[^\s"'`)]*/gi;

const problems = [];
for (const [name, pattern] of FORBIDDEN) {
  const match = pattern.exec(code);
  if (match) {
    problems.push(`${name} at ${match.index}: ${excerpt(match.index)}`);
  }
}
for (const match of code.matchAll(URL_PATTERN)) {
  if (!ALLOWED_URLS.has(match[0])) {
    problems.push(`URL ${match[0]} at ${match.index}: ${excerpt(match.index)}`);
  }
}

const name = path.relative(process.cwd(), file);
if (problems.length) {
  process.stderr.write(`${name} failed the bundle check:\n`);
  process.stderr.write(problems.map((p) => `  ${p}\n`).join(''));
  process.exit(1);
}

const raw = Buffer.byteLength(code);
const gzipped = zlib.gzipSync(code, {level: 9}).length;
process.stdout.write(
  `${name}: bundle check passed, ${raw} bytes raw, ${gzipped} bytes gzipped\n`,
);

function excerpt(index) {
  return JSON.stringify(code.slice(Math.max(0, index - 40), index + 40));
}
