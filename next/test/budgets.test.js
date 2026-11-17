// The new app's size budgets (next/budgets.json), on what next/build.js last built.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const NEXT = path.join(__dirname, '..'), B = require('../budgets.json');
const gz = f => zlib.gzipSync(fs.readFileSync(path.join(NEXT, 'dist', f)), { level: 9 }).length;

test('the new app keeps to its size budgets', () => {
  const meta = JSON.parse(fs.readFileSync(path.join(NEXT, 'dist', 'meta.json'), 'utf8'));
  const outs = Object.entries(meta.outputs).filter(([f]) => f.endsWith('.js')).map(([f, o]) => ({ f: path.basename(f), o }));
  // What the first page load needs: main.js and the chunks it imports straight away (not the ones it loads later).
  const main = outs.find(x => x.f === 'main.js'), first = new Set(['main.js']);
  const add = o => { for (const i of o.imports || []) if (i.kind === 'import-statement') { const b = path.basename(i.path); if (!first.has(b)) { first.add(b); add(outs.find(x => x.f === b).o); } } };
  add(main.o);
  const firstLoad = [...first].reduce((n, f) => n + gz(f), 0), total = outs.reduce((n, x) => n + gz(x.f), 0);
  assert.ok(firstLoad <= B.firstLoad, 'first load ' + firstLoad + ' > ' + B.firstLoad);
  for (const x of outs) assert.ok(gz(x.f) <= B.anyChunk, x.f + ' ' + gz(x.f) + ' > ' + B.anyChunk);
  assert.ok(total <= B.total, 'total ' + total + ' > ' + B.total);
});
