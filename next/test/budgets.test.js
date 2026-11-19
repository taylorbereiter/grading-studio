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
  // Each language's lines, in files by area like the English (next/lang/<code>/<area>.json), each file a chunk of its own, loaded
  // only for a teacher who chose that language and only with the screens that use that area.
  const CODES = ['zh-Hant', 'zh-Hans', 'es', 'fr', 'de', 'pt-BR', 'ja', 'ko'], codeOf = x => { for (const i of Object.keys(x.o.inputs)) { const m = /next\/lang\/([\w-]+)\/\w+\.json$/.exec(i); if (m) return m[1]; } return null; };
  const langs = outs.filter(codeOf);
  assert.deepEqual([...new Set(langs.map(codeOf))].sort(), [...CODES].sort(), 'every language has its files');
  for (const x of langs) assert.equal(Object.keys(x.o.inputs).length, 1, x.f + ' holds one language file and nothing else');
  // The total is what one teacher can download: the app and one language, the largest (Taylor, 19 Nov 2026).
  const shared = outs.filter(x => Object.keys(x.o.inputs).some(i => i === 'next/src/app/lang-load.js' || i === 'next/src/i18n/unpack-area.js'));
  const sharedBytes = shared.reduce((n, x) => n + gz(x.f), 0);
  const sum = c => langs.filter(x => codeOf(x) === c).reduce((n, x) => n + gz(x.f), sharedBytes);
  const appOnly = total - sharedBytes - langs.reduce((n, x) => n + gz(x.f), 0), one = Math.max(...CODES.map(sum));
  assert.ok(appOnly + one <= B.total, 'total ' + (appOnly + one) + ' (the app and its largest language) > ' + B.total);
  // Count every area of one language, including areas only loaded on demand.
  for (const c of CODES) assert.ok(sum(c) <= B.langFile, c + ' (whole language) ' + sum(c) + ' > ' + B.langFile);
  console.log('each whole language, squeezed: ' + CODES.map(c => c + ' ' + sum(c)).join(', '));
  for (const x of langs) { assert.ok(gz(x.f) <= B.langFile, x.f + ' (a language file) ' + gz(x.f) + ' > ' + B.langFile); assert.ok(!first.has(x.f), 'the first load does not bring a language'); }
  // Each screen the shell loads by its address (next/src/app/router.js CHUNKS), with everything it loads in turn that the first
  // load hasn't already brought.
  // (the iPhone photo decoder, and what only it loads, are counted on their own line above, not with a screen)
  const all = entry => { const s = new Set([entry]); const add = o => { for (const i of o.imports || []) { const b = path.basename(i.path); if (b.endsWith('.js') && b !== heic[0].f && !s.has(b) && !first.has(b)) { s.add(b); add(outs.find(x => x.f === b).o); } } }; add(outs.find(x => x.f === entry).o); return s; };
  const screens = outs.filter(x => /next\/src\/app\/screens\//.test(x.o.entryPoint || ''));
  assert.ok(screens.length >= 5, 'the screens are chunks of their own');
  for (const x of screens) { const n = [...all(x.f)].reduce((m, f) => m + gz(f), 0); assert.ok(n <= B.route, x.o.entryPoint + ' ' + n + ' > ' + B.route); }
});
