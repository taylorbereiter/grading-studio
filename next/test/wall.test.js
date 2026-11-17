// The wall between the two sides of saved work. Planning code never reaches the grading side's records (student data), shared
// code reaches neither side, and only crossings.js (and the proof's test page) may hold both. Checked on the source, following
// every import, so a planning module can't get there through a third file either.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'src');
const BOTH = new Set(['crossings.js', 'proof.js']);

const rel = f => path.relative(SRC, f).split(path.sep).join('/');
function all(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? all(path.join(dir, d.name)) : /\.jsx?$/.test(d.name) ? [path.join(dir, d.name)] : []); }
function importsOf(f) {
  const text = fs.readFileSync(f, 'utf8'), out = [];
  for (const m of text.matchAll(/(?:^|[\s;])(?:import|export)\s[^'"`]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm)) {
    const spec = m[1] || m[2] || m[3]; if (!spec.startsWith('.')) continue;
    let p = path.resolve(path.dirname(f), spec); if (!fs.existsSync(p) && fs.existsSync(p + '.js')) p += '.js';
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.js');
    out.push(p);
  }
  return out;
}
function reach(f, seen = new Set()) { for (const p of importsOf(f)) if (!seen.has(p)) { seen.add(p); reach(p, seen); } return seen; }
const side = f => { const r = rel(f); return r.startsWith('students/') ? 'students' : r.startsWith('planning/') ? 'planning' : r.startsWith('shared/') ? 'shared' : 'top'; };

test('planning code never reaches the grading side, not even through another file', () => {
  for (const f of all(SRC).filter(f => side(f) === 'planning')) {
    const bad = [...reach(f)].filter(p => side(p) === 'students' || BOTH.has(rel(p)));
    assert.deepEqual(bad.map(rel), [], rel(f) + ' reaches the grading side');
  }
});
test('the grading side does not reach planning code either', () => {
  for (const f of all(SRC).filter(f => side(f) === 'students')) assert.deepEqual([...reach(f)].filter(p => side(p) === 'planning').map(rel), [], rel(f));
});
test('shared code reaches neither side', () => {
  for (const f of all(SRC).filter(f => side(f) === 'shared')) assert.deepEqual([...reach(f)].filter(p => side(p) !== 'shared').map(rel), [], rel(f));
});
test('only crossings.js and the proof page hold both sides', () => {
  for (const f of all(SRC).filter(f => side(f) === 'top' && !BOTH.has(rel(f)))) {
    const r = [...reach(f)].map(side);
    assert.ok(!(r.includes('students') && r.includes('planning')), rel(f) + ' reaches both sides: go through crossings.js');
    assert.ok(![...reach(f)].some(p => BOTH.has(rel(p)) && rel(p) !== 'crossings.js'), rel(f) + ' imports the proof page');
  }
});
test('every crossing is a named function that only reads', () => {
  const text = fs.readFileSync(path.join(SRC, 'crossings.js'), 'utf8');
  const named = [...text.matchAll(/^export (?:async )?function (\w+)/gm)].map(m => m[1]);
  assert.ok(named.length >= 3);
  assert.ok(named.every(n => /For[A-Z]\w*$/.test(n)), 'a crossing says who it is for: ' + named.join(', '));
  assert.ok(!/\.(put|del|setText|setJson|remove)\(/.test(text), 'a crossing writes');
  assert.ok(!/^export (?!(async )?function)/m.test(text), 'crossings.js exports only functions');
});
test('the accessors are made on their own side (records.js checks the registry)', async () => {
  const { idbStore, localKey } = await import('../src/shared/records.js');
  assert.throws(() => idbStore('planning', 'grading-studio-keep', 'work'), /students side/);
  assert.throws(() => localKey('planning', 'gs.lib'), /students side/);
  assert.throws(() => idbStore('students', 'gs-lessons', 'kv'), /planning side/);
  assert.throws(() => localKey('students', 'gs.nothing'), /Not in the registry/);
});
