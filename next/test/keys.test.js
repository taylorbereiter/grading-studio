// The registry (next/src/shared/keys.js) knows every name the current app keeps saved work under. A key or a database added to
// the current app needs a line there, with its side of the wall.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { scan } = require('../tools/scan-keys');

test('every localStorage and sessionStorage key the current app names is in the registry', async () => {
  const { LOCAL, SESSION, entryFor } = await import('../src/shared/keys.js');
  const { keys } = scan();
  const missing = Object.keys(keys).filter(k => !entryFor(k, LOCAL) && !entryFor(k, SESSION));
  assert.deepEqual(missing, [], 'add these to next/src/shared/keys.js: ' + missing.map(k => k + ' (' + keys[k].join(', ') + ')').join('; '));
});
test('every database the current app names is in the registry, at the version it opens it at', async () => {
  const { DATABASES } = await import('../src/shared/keys.js');
  const { dbs } = scan();
  assert.deepEqual(Object.keys(dbs).sort(), Object.keys(DATABASES).sort());
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'samplemode.js'), 'utf8');
  const listed = JSON.parse(/var DBS = (\[[^\]]+\])/.exec(src)[1].replace(/'/g, '"'));
  assert.deepEqual(listed.sort(), Object.keys(DATABASES).sort(), 'the sample lines (src/samplemode.js) and the registry list the same databases');
  const ROOT = path.join(__dirname, '..', '..');
  for (const [name, d] of Object.entries(DATABASES)) {
    const at = [...scanOpen(ROOT, name)];
    assert.ok(at.every(v => v === d.version), name + ' is opened at ' + at.join(', ') + ' but the registry says ' + d.version);
  }
});
test('every entry has a known side, kind and format, and no name is listed twice', async () => {
  const { LOCAL, SESSION, DATABASES } = await import('../src/shared/keys.js');
  for (const e of [...LOCAL, ...SESSION]) {
    assert.ok(['students', 'planning', 'shared'].includes(e[1]), e[0]);
    assert.ok(['work', 'pref', 'coord', 'cache', 'legacy'].includes(e[2]), e[0]);
    assert.ok(['json', 'text'].includes(e[3]), e[0]);
  }
  assert.equal(new Set(LOCAL.map(e => e[0])).size, LOCAL.length);
  for (const d of Object.values(DATABASES)) assert.ok(['students', 'planning', 'shared'].includes(d.side));
});
// The versions a database is opened at in src/: indexedDB.open('name', n). A bare open (no version) is not counted.
function* scanOpen(root, name) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(x => x.isDirectory() ? walk(path.join(d, x.name)) : x.name.endsWith('.js') ? [path.join(d, x.name)] : []);
  const re = new RegExp("indexedDB\\.open\\('" + name + "', (\\d+)\\)", 'g');
  for (const f of walk(path.join(root, 'src'))) { const t = fs.readFileSync(f, 'utf8'); if (!t.includes(name)) continue; for (const m of t.matchAll(re)) yield +m[1]; }
}
test('next/docs/saved-work.md is what the registry makes (npm run next:docs)', async () => {
  const { make } = require('../tools/saved-work-doc');
  assert.equal(fs.readFileSync(path.join(__dirname, '..', 'docs', 'saved-work.md'), 'utf8'), await make(), 'run npm run next:docs');
});
// The new app makes a database the current app hasn't made yet (shared/idb.js ensure): with the same version and stores, and a
// keyPath only where the current app gives one (gs-lessons/lessons). The browser proof (two-windows.test.js) compares the result.
test('the databases the new app can make have the registry’s versions and stores', async () => {
  const { DATABASES } = await import('../src/shared/keys.js');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'shared', 'idb.js'), 'utf8');
  const SHAPES = (0, eval)('(' + /export const SHAPES = (\{[\s\S]*?\n\});/.exec(src)[1] + ')');
  assert.deepEqual(Object.keys(SHAPES).sort(), Object.keys(DATABASES).sort());
  for (const [name, d] of Object.entries(DATABASES)) {
    assert.equal(SHAPES[name][0], d.version, name);
    assert.deepEqual(Object.keys(SHAPES[name][1]).sort(), Object.keys(d.stores).sort(), name);
  }
  const all = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'planner', 'lessons.js'), 'utf8');
  assert.match(all, /createObjectStore\('lessons', \{ keyPath: 'id' \}\)/);
});
