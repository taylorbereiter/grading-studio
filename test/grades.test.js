// Grade math and reading grades off papers, run in the real built app in Chrome.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp } = require('./helpers/app');

let browser, app, page;
before(async () => { browser = await launch(); app = await openApp(browser); page = app.page; });
after(async () => { await app.close(); await browser.close(); });

const gs = (fn, ...args) => page.evaluate(fn, ...args);

test('the grading scale is exactly Taylor’s', async () => {
  assert.deepEqual(await gs(() => window.__gs.SCALE12), { 12: 100, 11: 95, 10: 91, 9: 86, 8: 82, 7: 77, 6: 73, 5: 68, 4: 64, 3: 60 });
  assert.deepEqual(await gs(() => window.__gs.SCALE_FIVES), { 12: 100, 11: 95, 10: 90, 9: 85, 8: 80, 7: 75, 6: 70, 5: 65, 4: 60, 3: 55, 2: 50, 1: 45, 0: 40 });
  assert.deepEqual(await gs(() => window.__gs.RUBRIC_STEPS), [0, 1, 1.5, 2, 2.5, 3, 3.5, 4]);
});

test('every whole and half point on the 12-point scale', async () => {
  // Worked out by hand from the scale: halves fall midway between rows, and a percent ending in .5 rounds up.
  const want = { 12: 100, 11.5: 98, 11: 95, 10.5: 93, 10: 91, 9.5: 89, 9: 86, 8.5: 84, 8: 82, 7.5: 80, 7: 77, 6.5: 75, 6: 73, 5.5: 71, 5: 68, 4.5: 66, 4: 64, 3.5: 62, 3: 60, 2.5: 58, 2: 56, 1: 52, 0: 48, 13: 100 };
  const got = await gs(w => Object.fromEntries(Object.keys(w).map(k => [k, window.__gs.percentWith(+k, 12, window.__gs.SCALE12)])), want);
  assert.deepEqual(got, want);
  assert.equal(await gs(() => window.__gs.percentFor(10.5)), 93, 'the default setup uses the scale: 10.5 = 93%');
});

test('other scales and no scale', async () => {
  const p = (t, m, s) => gs((t, m, s) => window.__gs.percentWith(t, m, s === 'S12' ? window.__gs.SCALE12 : s === 'S5' ? window.__gs.SCALE_FIVES : s), t, m, s);
  assert.equal(await p(10.5, 12, 'S5'), 93, 'the fives scale: 92.5 rounds up');
  assert.equal(await p(17, 20, null), 85);
  assert.equal(await p(7, 9, null), 78, 'plain share of points, whole number');
  assert.equal(await p(10, 20, 'S12'), 50, 'a scale whose top isn’t the total possible isn’t used');
  assert.equal(await p(11, 12, { 12: '100', 11: '95', 10: '', 9: '86' }), 95, 'numbers saved as text still work, and blank rows are skipped');
  assert.equal(await p(10, 12, { 12: '100', 11: '95', 10: '', 9: '86' }), 91, 'halfway across a blank row');
  for (const bad of [null, '', NaN]) assert.equal(await p(bad, 12, 'S12'), null);
  assert.equal(await p(5, 0, null), null, 'nothing to divide by');
});

test('a student’s grade from rubric rows, points and the paper', async () => {
  const of = st => gs(st => window.__gs.gradeOf({ grade: { rubric: [], points: '', ...st.grade }, found: st.found }), st);
  assert.deepEqual(await of({ grade: { rubric: [3.5, 3.5, 3.5] } }), { total: 10.5, pct: 93, done: true });
  const part = await of({ grade: { rubric: [4] } });
  assert.equal(part.total, 4); assert.equal(part.done, false, 'one row of three isn’t finished');
  assert.deepEqual(await of({ grade: {} }), { total: null, pct: null, done: false });
  assert.deepEqual(await of({ grade: {}, found: { found: true, score: 9.5, pct: 88 } }), { total: 9.5, pct: 88, done: true, paper: true }, 'the percent typed on the paper stands');
  assert.deepEqual(await of({ grade: { sheet: '9' } }), { total: 9, pct: 86, done: true, paper: true }, 'typed on the Grade sheet');
  assert.deepEqual(await of({ grade: { rubric: [3, 3, 3] }, found: { found: true, score: 11, pct: 95 } }), { total: 9, pct: 86, done: true }, 'her own score wins over the paper');
});

test('a score of 0 counts as scored, on points', async () => {
  const of = grade => gs(g => { const G = window.__gs, s = G.state().setup, was = s.mode; s.mode = 'points'; try { return G.gradeOf({ grade: { rubric: [], points: '', ...g } }); } finally { s.mode = was; } }, grade);
  assert.deepEqual(await of({ points: '0' }), { total: 0, pct: 0, done: true });
  assert.deepEqual(await of({ points: 0 }), { total: 0, pct: 0, done: true });
  assert.deepEqual(await of({ points: '' }), { total: null, pct: null, done: false }, 'blank is not 0');
  assert.deepEqual(await of({}), { total: null, pct: null, done: false });
});

test('showing numbers', async () => {
  assert.deepEqual(await gs(() => [window.__gs.fmtNum(10.5), window.__gs.fmtNum(9), window.__gs.fmtNum(null), window.__gs.fmtPct(93), window.__gs.fmtPct(null), window.__gs.roundPct(92.5), window.__gs.roundPct(-3)]), ['10.5', '9', '', '93%', '', 93, 0]);
});

// [what's typed, strict?, what comes back (only the fields named here are compared), or null]
const CASES = [
  ['9.5 = 88%', false, { rank: 3, score: 9.5, outOf: null, pct: 88 }],
  ['9.5/12 = 88%', false, { rank: 3, score: 9.5, outOf: 12, pct: 88 }],
  ['9,5/12 = 88%', false, { rank: 3, score: 9.5, outOf: 12, pct: 88 }],
  ['10 of 12 = 83%', false, { rank: 3, score: 10, outOf: 12, pct: 83 }],
  ['10 out of 12 - 83%', false, { rank: 3, score: 10, outOf: 12, pct: 83 }],
  ['Total 11/12 → 95%', false, { rank: 3, score: 11, outOf: 12, pct: 95 }],
  ['10/12', false, { rank: 2, score: 10, outOf: 12, pct: null }],
  ['10 / 12', false, { rank: 2, score: 10, outOf: 12, pct: null }],
  ['10 out of 12', false, { rank: 2, score: 10, outOf: 12, pct: null }],
  ['88%', false, { rank: 1, score: null, outOf: null, pct: 88 }],
  ['Final grade 88 %', false, { rank: 1, pct: 88 }],
  ['9.5', false, { rank: 0.5, score: 9.5, outOf: null, pct: null }],
  ['  9  ', false, { rank: 0.5, score: 9 }],
  ['13/12', false, null],
  ['5/300', false, null],
  ['150%', false, null],
  ['10/12/2026', false, null],
  ['Good work on this paper', false, null],
  ['', false, null],
  ['9.5 = 88%', true, { rank: 3, score: 9.5, pct: 88 }],
  ['10/12', true, null],
  ['88%', true, null],
  ['9.5', true, null],
];
for (const [str, strict, want] of CASES) test('parseGrade: "' + str + '"' + (strict ? ' (page text)' : ''), async () => {
  const got = await gs((s, k) => window.__gs.parseGrade(s, k), str, strict);
  if (!want) return assert.equal(got, null);
  assert.ok(got, 'should find a grade');
  for (const [k, v] of Object.entries(want)) assert.equal(got[k], v, k);
});
test('parseGrade says where the grade sits, for cropping it', async () => {
  const g = await gs(() => window.__gs.parseGrade('Grade: 9.5/12 = 88% well done', false));
  assert.equal(g.at, 7); assert.equal('Grade: 9.5/12 = 88% well done'.substr(g.at, g.len), '9.5/12 = 88%');
});
