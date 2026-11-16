// Criterion stickers: a small stamp with one rubric row's score, placed from a button on that row, that follows the row's score
// (by the row's name, so moving rows never swaps them) and never counts as the paper's total. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip } = require('./helpers/app');
const { zipOf, makePaper } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const SETUP = { mode: 'rubric', criteria: ['Thesis', 'Evidence', 'Style'], outOf: 12 };
const crits = page => page.evaluate(() => Object.values(window.__gs.state().batch.students[0].files[0].marks).flat().filter(m => m.t === 'stamp' && m.k === 'crit').map(m => ({ of: m.of, name: m.name, text: m.text })));
const placeAt = async (page, fx, fy) => {
  const c = await page.evaluate((fx, fy) => { const pg = window.__gs.state().pages[0], r = pg.canvas.getBoundingClientRect(); return { x: r.left + pg.W * pg.s * fx, y: r.top + pg.H * pg.s * fy }; }, fx, fy);
  await page.mouse.move(c.x, c.y); await page.mouse.click(c.x, c.y);
};

test('a scored rubric row has a stamp button that puts that row’s score on the paper, and the stamp follows the score', async () => {
  const { page, close } = await openApp(browser, { beforeLoad: p => p.evaluateOnNewDocument(s => { if (!localStorage.getItem('gs.setup')) localStorage.setItem('gs.setup', s); }, JSON.stringify(SETUP)) });
  await openZip(page, zipOf({ 'Ann Example/Essay.pdf': await makePaper({ title: 'Ann' }) }), 'Crit.zip');
  await page.waitForSelector('#grade .crit');
  assert.equal(await page.$('[data-critstamp]'), null, 'no button before a row has a score');
  await page.click('#grade .scores[data-c="0"] button[data-v="3"]');
  await page.waitForSelector('[data-critstamp="0"]');
  assert.equal(await page.$('[data-critstamp="1"]'), null, 'only the scored row has one');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].grade.rubric[0]), 3, 'the click on the stamp button is not a score click');
  await page.click('[data-critstamp="0"]');
  assert.ok(await page.$('#scoreBar'), 'it follows the pointer until placed');
  await placeAt(page, 0.8, 0.2);
  assert.equal(await page.$('#scoreBar'), null);
  assert.deepEqual(await crits(page), [{ of: 'Thesis', name: 'Thesis', text: '3/4' }]);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].grade.rubric[0]), 3, 'placing it leaves the score alone');
  // the row's score changes: the stamp on the paper changes with it
  await page.click('#grade .scores[data-c="0"] button[data-v="2"]');
  await page.waitForFunction(() => Object.values(window.__gs.state().batch.students[0].files[0].marks).flat().some(m => m.k === 'crit' && m.text === '2/4'));
  // the total stamp and the grade sheet still say the total, never the row's score
  await page.click('#grade .scores[data-c="1"] button[data-v="4"]'); await page.click('#grade .scores[data-c="2"] button[data-v="3"]');
  await page.waitForSelector('#stampScore'); await page.click('#stampScore'); await placeAt(page, 0.8, 0.08);
  await page.evaluate(() => window.__gs.openSheet(false));
  await page.waitForSelector('#dlgBox .big-sc');
  assert.deepEqual(await page.$$eval('#dlgBox .big-sc', e => e.map(x => x.textContent)), ['9/ 12']);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a criterion stamp follows its row by name when rows move, and keeps what it says once its row is gone', async () => {
  const { page, close } = await openApp(browser, { beforeLoad: p => p.evaluateOnNewDocument(s => { if (!localStorage.getItem('gs.setup')) localStorage.setItem('gs.setup', s); }, JSON.stringify(SETUP)) });
  await openZip(page, zipOf({ 'Ben Example/Essay.pdf': await makePaper({ title: 'Ben' }) }), 'Crit2.zip');
  await page.waitForSelector('#grade .crit');
  await page.click('#grade .scores[data-c="1"] button[data-v="4"]');
  await page.click('[data-critstamp="1"]'); await placeAt(page, 0.5, 0.5);
  assert.deepEqual(await crits(page), [{ of: 'Evidence', name: 'Evidence', text: '4/4' }]);
  // Evidence moves to the top with a new score, Thesis below it has another: the stamp keeps following Evidence
  await page.evaluate(() => { const { setup, batch } = window.__gs.state(); setup.criteria = ['Evidence', 'Thesis', 'Style']; batch.students[0].grade.rubric = [2.5, 1, null]; window.__gs.openStudent(0); });
  await page.waitForFunction(() => Object.values(window.__gs.state().batch.students[0].files[0].marks).flat().some(m => m.k === 'crit' && m.text === '2.5/4'));
  assert.deepEqual(await crits(page), [{ of: 'Evidence', name: 'Evidence', text: '2.5/4' }]);
  // the row is taken out: the stamp stays as it was rather than taking another row's score
  await page.evaluate(() => { const { setup, batch } = window.__gs.state(); setup.criteria = ['Thesis', 'Style']; batch.students[0].grade.rubric = [1, 3]; window.__gs.openStudent(0); });
  await page.waitForSelector('[data-critstamp="1"]');
  assert.deepEqual(await crits(page), [{ of: 'Evidence', name: 'Evidence', text: '2.5/4' }]);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the strong example “The score” switch off leaves criterion stamps off too, without dropping the example’s own score caption', async () => {
  const { page, close } = await openApp(browser);
  const r = await page.evaluate(() => { const m = { t: 'stamp', k: 'crit', of: 'A', name: 'A', text: '5' }; return { hides: window.__gs.scoreOffHides(m), total: window.__gs.isScoreMark(m), check: window.__gs.scoreOffHides({ t: 'check', x: 1, y: 1 }) }; });
  assert.deepEqual(r, { hides: true, total: false, check: false });
  await close();
});
