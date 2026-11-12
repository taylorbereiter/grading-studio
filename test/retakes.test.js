// Retakes: a second try at the same assignment that keeps the first try's score, comment and paper,
// and the teacher's own rule for which try counts (highest, latest or the average). Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goToStudent, score, classPage, pick, settle } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });
const noErrors = page => assert.deepEqual(page.errors, []);
const first = page => page.evaluate(() => { const G = window.__gs, s = G.state().batch.students[0], g = G.gradeOf(s); return { total: g.total, pct: g.pct, done: g.done, wait: !!g.wait, n: (s.grade.tries || []).length, rule: g.tryRule, own: G.tryGrade(s).total, rubric: s.grade.rubric, comment: s.grade.comment }; });
const note = page => page.$eval('#tryNote', e => e.textContent);

test('a retake keeps the first try, and the highest, the latest or the average counts by the teacher’s rule', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'River essay.zip');
  // No score yet: nothing to keep.
  await pick(page, '[data-gretake]');
  assert.equal((await first(page)).n, 0);
  await score(page, [2, 2, 3]);   // 7 of 12 = 77% on the scale
  await page.type('#cmtIn', 'Reread the question.');
  await pick(page, '[data-gretake]');
  await page.waitForSelector('#tryNote');
  await page.waitForSelector('#paper .trytag');
  assert.equal(await page.$eval('#paper .trytag', e => e.textContent), 'First try');
  // The panel is empty for the retake; the first try stands until it has a full score, and the paper still waits for one.
  let g = await first(page);
  assert.deepEqual([g.n, g.total, g.pct, g.done, g.wait, g.own, g.comment], [1, 7, 77, false, true, null, '']);
  assert.match(await note(page), /First try7 \/ 12 · 77%/);
  assert.match(await note(page), /“Reread the question.”/);
  assert.match(await note(page), /Until the retake has a full score, the first try counts: 77%/);
  assert.match(await page.$eval('#grade .total', e => e.textContent), /^–\/ 12/);
  assert.match(await page.$eval('#stuList .stu.on', e => e.textContent), /retake/);
  // One row scored is not a full score yet.
  await score(page, [3]);
  g = await first(page);
  assert.deepEqual([g.total, g.pct, g.wait], [7, 77, true]);
  // The retake scored: 10 of 12 = 91%. The highest counts unless the teacher says otherwise.
  await score(page, [4, 3, 3]);
  g = await first(page);
  assert.deepEqual([g.total, g.pct, g.done, g.wait, g.rule, g.own], [10, 91, true, false, 'high', 10]);
  assert.match(await note(page), /Counts: 91%, the highest of 2 tries/);
  // A lower retake: 6 of 12 = 73%.
  await score(page, [2, 2, 2]);
  g = await first(page);
  assert.deepEqual([g.total, g.pct, g.own], [7, 77, 6], 'the first try is still the best');
  assert.match(await page.$eval('#grade .total', e => e.textContent), /^6\/ 1273%/, 'the big number is the try being scored');
  await pick(page, '[data-tryrule="last"]');
  g = await first(page);
  assert.deepEqual([g.total, g.pct, g.rule], [6, 73, 'last']);
  await pick(page, '[data-tryrule="avg"]');
  g = await first(page);
  assert.deepEqual([g.total, g.pct, g.rule], [6.5, 75, 'avg']);
  assert.match(await note(page), /Counts: 75%, the average of 2 tries/);
  assert.equal(await page.evaluate(() => window.__gs.state().lib.book.retake), 'avg', 'the rule is the teacher’s, kept with their terms and weights');
  // The Grades list, the spreadsheet and saved work read back all give what counts.
  const row = await page.evaluate(() => window.__gs.tableRow(window.__gs.state().batch.students[0]));
  assert.deepEqual(row.slice(5, 7), ['6.5', '75']);
  assert.match(row[7], /Retake: First try 77%, retake 73%; counts: the average of 2 tries/);
  await settle(page);
  const past = await page.evaluate(() => { const G = window.__gs, s = G.state().batch.students[0]; return G.pastScore(G.state().setup, JSON.parse(JSON.stringify(s.grade))); });
  assert.deepEqual([past.total, past.pct, past.max], [6.5, 75, 12]);
  // It stays with the paper: away and back.
  await goToStudent(page, 1); await goToStudent(page, 0);
  await page.waitForSelector('#tryNote');
  // Taking it off asks twice when the retake has a score, then the first try is the score again, comment and all.
  await page.click('[data-tryoff]');
  assert.equal((await first(page)).n, 1);
  assert.match(await page.$eval('[data-tryoff]', e => e.textContent), /Click again/);
  await page.click('[data-tryoff]');
  await page.waitForFunction(() => !document.querySelector('#tryNote'));
  g = await first(page);
  assert.deepEqual([g.n, g.total, g.pct, g.done, g.comment], [0, 7, 77, true, 'Reread the question.']);
  assert.deepEqual(g.rubric, [2, 2, 3]);
  await page.waitForFunction(() => !document.querySelector('#paper .trytag'));
  noErrors(page); await close();
});

test('a third try, a late first try, and a retake that is out of something else', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'River essay.zip');
  const R = (g, tries, rule) => page.evaluate((g, tries, rule) => { const G = window.__gs; G.state().lib.book = { ...(G.state().lib.book || {}), retake: rule }; return G.pastScore({ mode: 'points', criteria: [], outOf: 20 }, { ...g, tries }); }, g, tries, rule);
  const T = [{ t: 1, total: 10, max: 20, pct: 50 }, { t: 2, total: 16, max: 20, pct: 80 }];
  let p = await R({ points: '14' }, T, 'high'); assert.deepEqual([p.total, p.pct], [16, 80]);
  p = await R({ points: '14' }, T, 'last'); assert.deepEqual([p.total, p.pct], [14, 70]);
  p = await R({ points: '14' }, T, 'avg'); assert.deepEqual([p.total, p.pct], [13.33, 67]);
  p = await R({ points: '' }, T, 'last'); assert.deepEqual([p.total, p.pct, !!p.partial], [16, 80, false], 'no score on the newest: the one before it');
  p = await R({ points: '18', xc: 2 }, T, 'high'); assert.deepEqual([p.total, p.pct, p.xc], [20, 100, 2], 'extra credit on the retake counts with it');
  p = await R({ points: '8', xc: 2 }, T, 'high'); assert.deepEqual([p.total, p.pct, p.xc], [16, 80, undefined], 'and stays out of a try it was not given on');
  p = await R({ points: '14' }, [{ t: 1, total: 9, max: 10, pct: 90 }], 'high'); assert.deepEqual([p.total, p.max, p.pct], [9, 10, 90], 'an earlier try out of 10 says so');
  p = await R({ points: '14' }, [{ t: 1, total: 9, max: 10, pct: 90 }], 'avg'); assert.deepEqual([p.total, p.pct], [16, 80], 'the average of percents when the tries are out of different totals');
  p = await R({ status: 'missing', points: '' }, T, 'high'); assert.deepEqual([p.total, p.status], [null, 'missing']);
  noErrors(page); await close();
});

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'];
function seed(book = {}) {
  const lib = {
    classes: [{ id: 'c1', name: 'Grade 9 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [
      { id: 'i1', name: 'Poetry test', classId: 'c1', type: 'sum', due: '2026-10-01', typed: { max: 20, s: { 'Aria Testwell': { v: 16 }, 'Bram Sample': { v: 14 }, 'Cleo Fixture': { v: 20 }, 'Dov Madeup': { v: 12 } } } },
    ] }] }],
    loose: { id: '', units: [] }, seed2627: true,
    book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2026-12-20' }], ...book },
  };
  return { ls: { 'gs.lib': JSON.stringify(lib) } };
}
async function openBook(page) {
  await classPage(page, 'c1');
  await page.waitForSelector('[data-book="c1"]');
  await page.click('[data-book="c1"]');
  await page.waitForSelector('#bkTab');
}
const rowText = (page, n) => page.$eval('#bkTab tbody tr:nth-child(' + n + ')', r => r.textContent);

test('a typed-in score takes a retake as "14 > 18", and Term setup holds the rule', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openBook(page);
  await page.click('#bkTab tbody tr:nth-child(2) td[data-bked="i1"]');
  await page.waitForSelector('#bkTab .bkcin');
  assert.equal(await page.$eval('#bkTab .bkcin', i => i.value), '14');
  await page.keyboard.type('14 > 18'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => /90%/.test(document.querySelector('#bkTab tbody tr:nth-child(2)').textContent));
  assert.match(await rowText(page, 2), /Bram Sample90% retake/);
  assert.match(await page.$eval('#bkTab tbody tr:nth-child(2) .retk', e => e.title), /First try 70%, retake 90%\. Counts: the highest of 2 tries\./);
  assert.deepEqual(await page.evaluate(() => window.__gs.state().lib.classes[0].units[0].items[0].typed.s['Bram Sample']), { v: 18, st: '', tries: [14] });
  // The cell shows both again when it is changed.
  await page.click('#bkTab tbody tr:nth-child(2) td[data-bked="i1"]');
  await page.waitForSelector('#bkTab .bkcin');
  assert.equal(await page.$eval('#bkTab .bkcin', i => i.value), '14 > 18');
  await page.keyboard.press('Escape');
  // A lower retake under each rule.
  await page.click('#bkTab tbody tr:nth-child(1) td[data-bked="i1"]');
  await page.waitForSelector('#bkTab .bkcin');
  await page.keyboard.type('16 > 12'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => /retake/.test(document.querySelector('#bkTab tbody tr:nth-child(1)').textContent));
  assert.match(await rowText(page, 1), /Aria Testwell80% retake/);
  for (const [rule, a, b] of [['avg', '70%', '80%'], ['last', '60%', '90%'], ['high', '80%', '90%']]) {
    await page.click('[data-bksetup]');
    await page.waitForSelector('[data-bkretake]');
    await page.click('[data-bkretake="' + rule + '"]');
    await page.click('[data-bksavesetup]');
    await page.waitForSelector('#bkTab');
    assert.match(await rowText(page, 1), new RegExp('Aria Testwell' + a + ' retake'), rule);
    assert.match(await rowText(page, 2), new RegExp('Bram Sample' + b + ' retake'), rule);
  }
  assert.equal(await page.evaluate(() => window.__gs.state().lib.book.retake), 'high');
  noErrors(page); await close();
});
