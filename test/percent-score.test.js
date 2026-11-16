// A percent typed as the score stays the score; the points it comes to follow the assignment's own scale. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, score, settle, pick } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });
const stu = (page, i) => page.evaluate(i => { const G = window.__gs, st = G.state().batch.students[i]; return { grade: st.grade, computed: G.gradeOf(st) }; }, i);
const total = page => page.$eval('#grade .total', e => e.textContent.replace(/\s+/g, ' ').trim());

test('the usual scale both ways: 6 of 12 is 73%, and 73% comes back as 6', async () => {
  const { page, close } = await openApp(browser);
  const r = await page.evaluate(() => { const G = window.__gs, sc = { 12: 100, 11: 95, 10: 91, 9: 86, 8: 82, 7: 77, 6: 73, 5: 68, 4: 64, 3: 60 }; return [G.pointsWith(73, 12, sc), G.pointsWith(75, 12, sc), G.pointsWith(73, 15, null), G.pointsWith(73, 20, null), G.pointsWith(110, 20, null), G.pointsWith(0, 12, sc)]; });
  assert.deepEqual(r, [6, 6.5, 11, 14.5, 22, 0]);
  const past = await page.evaluate(() => { const G = window.__gs, p = G.pastScore(G.DEFAULT_SETUP, { rubric: [2, 2, 2], pk: 73 }); return [p.total, p.pct]; });
  assert.deepEqual(past, [6, 73], 'the gradebook reads a saved paper’s percent the same way');
  await close();
});

test('with a rubric: Score as a percent keeps 73% whatever the rows say, shows 6 / 12, and Remove gives the rows back', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'River essay.zip');
  await score(page, [2, 2, 2]);
  await pick(page, '[data-gpk]');
  await page.waitForSelector('#pkIn');
  await page.type('#pkIn', '73'); await page.keyboard.press('Enter');
  assert.deepEqual((await stu(page, 0)).computed, { total: 6, pct: 73, done: true, pk: true });
  assert.match(await total(page), /^6\s*\/\s*12\s*73%/);
  await page.click('.crit[data-row="0"] .scores button[data-v="4"]');
  assert.equal((await stu(page, 0)).computed.pct, 73, 'a rubric row moved later doesn’t change it');
  await page.click('[data-pkoff]');
  const s = await stu(page, 0);
  assert.equal(s.grade.pk, undefined); assert.equal(s.computed.total, 8, 'the rows count again: 4 + 2 + 2');
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  assert.equal((await stu(page, 0)).grade.pk, 73, 'Undo puts the percent back');
  await settle(page);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].grade.pk), 73);
  assert.deepEqual(page.errors, []);
  await close();
});

test('in points mode "73%" in the box is a percent, a plain number is points again, and extra credit goes on top', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'River essay.zip');
  await page.evaluate(() => { const s = window.__gs.state().setup; s.mode = 'points'; s.outOf = 20; window.__gs.openStudent(0); });
  await page.waitForSelector('#ptsIn');
  await page.type('#ptsIn', '73%');
  let s = await stu(page, 0);
  assert.deepEqual([s.grade.pk, s.computed.total, s.computed.pct], [73, 14.5, 73]);
  await page.evaluate(() => window.__gs.openStudent(1)); await page.evaluate(() => window.__gs.openStudent(0)); await page.waitForSelector('#ptsIn');
  assert.equal(await page.$eval('#ptsIn', e => e.value), '73%', 'the box shows the percent it keeps');
  await pick(page, '[data-gxc]'); await page.type('#xcIn', '2');
  assert.equal((await stu(page, 0)).computed.pct, 83, '73% + 2 of 20 points');
  await page.$eval('#ptsIn', e => { e.focus(); e.select(); }); await page.keyboard.type('15');
  s = await stu(page, 0);
  assert.equal(s.grade.pk, undefined); assert.equal(s.computed.total, 17);
  assert.deepEqual(page.errors, []);
  await close();
});
