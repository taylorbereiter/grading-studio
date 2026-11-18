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
    const spec = m[1] || m[2] || m[3]; if (!spec.startsWith('.') || /\.(webp|png|woff2|css)$/.test(spec)) continue;   // pictures and fonts hold no data
    let p = path.resolve(path.dirname(f), spec); if (!fs.existsSync(p) && fs.existsSync(p + '.js')) p += '.js';
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.js');
    out.push(p);
  }
  return out;
}
// Everything f reaches by its imports. Traversal stops at the files in `stop` (they are reached, but not gone through).
function reach(f, stop = () => false, seen = new Set()) { for (const p of importsOf(f)) if (!seen.has(p)) { seen.add(p); if (!stop(p)) reach(p, stop, seen); } return seen; }
const side = f => { const r = rel(f); const d = r.split('/')[0]; return ['students', 'planning', 'shared', 'whole', 'engines'].includes(d) && r.includes('/') ? d : 'top'; };
const isBoth = p => BOTH.has(rel(p));

// The wall (stage 2): by kind of data. students/ may use planning/; planning/ never uses students/. whole/ (year file, take-home,
// sample, Drive sync, the folder copy) spans both by nature: it may use both sides and is used by neither. shared/ uses neither.
test('planning code never reaches the grading side, whole/, or the crossings, not even through another file', () => {
  for (const f of all(SRC).filter(f => side(f) === 'planning')) {
    const bad = [...reach(f)].filter(p => side(p) === 'students' || side(p) === 'whole' || isBoth(p));
    assert.deepEqual(bad.map(rel), [], rel(f) + ' reaches the grading side');
  }
});
test('the grading side may use planning, but never whole/ or the crossings', () => {
  for (const f of all(SRC).filter(f => side(f) === 'students')) assert.deepEqual([...reach(f)].filter(p => side(p) === 'whole' || isBoth(p)).map(rel), [], rel(f));
});
test('shared code reaches neither side', () => {
  for (const f of all(SRC).filter(f => side(f) === 'shared' || side(f) === 'engines')) assert.deepEqual([...reach(f)].filter(p => side(p) !== 'shared' && side(p) !== 'engines').map(rel), [], rel(f));
});
test('whole/ is used only by main.js, the proof page and itself', () => {
  for (const f of all(SRC).filter(f => side(f) !== 'whole' && !['main.js', 'proof.js'].includes(rel(f)))) assert.deepEqual(importsOf(f).filter(p => side(p) === 'whole').map(rel), [], rel(f) + ' imports whole/');
  assert.ok(all(SRC).some(f => side(f) === 'whole'), 'whole/ exists');
});
test('a screen or service holds both sides only through crossings.js (or main.js through whole/)', () => {
  // router.js is the address book: the screens it loads by address are each checked on their own (stage 4: the marking screen
  // holds the students side and reaches the router for its links, as every screen does).
  const stop = p => isBoth(p) || side(p) === 'whole' || side(p) === 'students' || rel(p) === 'app/router.js';
  for (const f of all(SRC).filter(f => side(f) === 'top' && !BOTH.has(rel(f)) && rel(f) !== 'app/router.js')) {
    const r = [...reach(f, stop)].map(side);
    assert.ok(!(r.includes('students') && r.includes('planning')), rel(f) + ' reaches both sides: go through crossings.js');
    assert.ok(![...reach(f, stop)].some(p => isBoth(p) && rel(p) !== 'crossings.js'), rel(f) + ' imports the proof page');
  }
});
test('every crossing is a named function that only reads', () => {
  const text = fs.readFileSync(path.join(SRC, 'crossings.js'), 'utf8');
  const named = [...text.matchAll(/^export (?:async )?function (\w+)/gm)].map(m => m[1]);
  assert.ok(named.length >= 3);
  // the named crossings, and no others (stage 2 brief, item 7)
  assert.deepEqual(named.sort(), ['classListsForPlanning', 'classesForHome', 'countsForHome', 'examplesForPlanning', 'examplePictureForSlide', 'rosterNamesForPresent', 'todoCountForSidebar', 'workForCalendar', 'appLinesForTodo'].sort());
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
