// The new app's size budgets (next/budgets.json), on what next/build.js last built.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const NEXT = path.join(__dirname, '..'), B = require('../budgets.json');
const gz = f => zlib.gzipSync(fs.readFileSync(path.join(NEXT, '..', 'dist', f)), { level: 9 }).length;

test('the new app keeps to its size budgets', () => {
  const meta = JSON.parse(fs.readFileSync(path.join(NEXT, '..', 'dist', 'meta.json'), 'utf8'));
  const outs = Object.entries(meta.outputs).filter(([f]) => f.endsWith('.js')).map(([f, o]) => ({ f: path.basename(f), o }));
  // What the first page load needs: main.js and the chunks it imports straight away (not the ones it loads later).
  const loads = entry => { const s = new Set([entry]); const add = o => { for (const i of o.imports || []) if (i.kind === 'import-statement') { const b = path.basename(i.path); if (!s.has(b)) { s.add(b); add(outs.find(x => x.f === b).o); } } }; add(outs.find(x => x.f === entry).o); return s; };
  const first = loads('main.js');
  const firstLoad = [...first].reduce((n, f) => n + gz(f), 0), total = outs.reduce((n, x) => n + gz(x.f), 0);
  // Every shared part (next/src/ui/index.js) with everything it imports; and the two stylesheets every page with parts loads.
  const parts = [...loads('parts.js')].reduce((n, f) => n + gz(f), 0), css = gz('tokens.css') + gz('parts-css.css');
  assert.ok(parts <= B.parts, 'parts ' + parts + ' > ' + B.parts);
  assert.ok(css <= B.css, 'css ' + css + ' > ' + B.css);
  assert.ok(firstLoad <= B.firstLoad, 'first load ' + firstLoad + ' > ' + B.firstLoad);
  // The iPhone photo decoder alone has its own line (heic); only it may pass anyChunk, and only an import() reaches it.
  const heic = outs.filter(x => Object.keys(x.o.inputs).some(i => /libheif-js\//.test(i)));
  assert.equal(heic.length, 1, 'the decoder is one chunk of its own');
  assert.ok(gz(heic[0].f) <= B.heic, 'heic ' + gz(heic[0].f) + ' > ' + B.heic);
  assert.ok(!first.has(heic[0].f), 'the first load does not bring the decoder');
  for (const x of outs) assert.ok(!(x.o.imports || []).some(i => i.kind === 'import-statement' && path.basename(i.path) === heic[0].f), x.f + ' loads the decoder at once');
  for (const x of outs) if (x !== heic[0]) assert.ok(gz(x.f) <= B.anyChunk, x.f + ' ' + gz(x.f) + ' > ' + B.anyChunk);
  assert.ok(total <= B.total, 'total ' + total + ' > ' + B.total);
  // Each language's lines (next/lang/<code>.json), a chunk of its own, loaded only for a teacher who chose that language.
  const langs = outs.filter(x => Object.keys(x.o.inputs).some(i => /next\/lang\/(zh-Hant|zh-Hans|es|fr|de|pt-BR|ja|ko)\.json$/.test(i)));
  assert.equal(langs.length, 8, 'one chunk per language');
  for (const x of langs) { assert.ok(gz(x.f) <= B.langFile, x.f + ' (a language) ' + gz(x.f) + ' > ' + B.langFile); assert.ok(!first.has(x.f), 'the first load does not bring a language'); }
  // Each screen the shell loads by its address (next/src/app/router.js CHUNKS), with everything it loads in turn that the first
  // load hasn't already brought.
  // (the iPhone photo decoder, and what only it loads, are counted on their own line above, not with a screen)
  const all = entry => { const s = new Set([entry]); const add = o => { for (const i of o.imports || []) { const b = path.basename(i.path); if (b.endsWith('.js') && b !== heic[0].f && !s.has(b) && !first.has(b)) { s.add(b); add(outs.find(x => x.f === b).o); } } }; add(outs.find(x => x.f === entry).o); return s; };
  const screens = outs.filter(x => /next\/src\/app\/screens\//.test(x.o.entryPoint || ''));
  assert.ok(screens.length >= 5, 'the screens are chunks of their own');
  for (const x of screens) { const n = [...all(x.f)].reduce((m, f) => m + gz(f), 0); assert.ok(n <= B.route, x.o.entryPoint + ' ' + n + ' > ' + B.route); }
});
