// A late paper on an assignment whose scores were typed into the gradebook: the card offers Add papers…, the paper is marked
// and scored, and every other student's typed score stays as it was. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { launch } = require('./helpers/chrome');
const { openApp, classPage, tmpDir, settle, goToStudent, pick } = require('./helpers/app');
const { makePaper } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'];
const PTS = { mode: 'points', criteria: [], outOf: 20 };
const seed = () => ({ ls: { 'gs.lib': JSON.stringify({
  classes: [{ id: 'c1', name: 'Grade 9 Art', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [
    { id: 'i1', name: 'Poster', classId: 'c1', type: 'ic', due: '2026-09-10', setup: PTS, typed: { max: 20, s: { 'Aria Testwell': { v: 18, st: '', t: 1 }, 'Bram Sample': { v: 15.5, st: '', t: 1 } } } },
  ] }] }],
  loose: { id: '', units: [] }, seed2627: true,
  book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2027-01-31' }] },
}) } });
const closed = page => page.waitForFunction(() => document.querySelector('#dlg').hidden);
// Each student's row in the gradebook, as text.
async function rows(page) {
  await classPage(page, 'c1');
  await page.waitForSelector('[data-book="c1"]'); await page.click('[data-book="c1"]'); await page.waitForSelector('#bkTab');
  await page.waitForSelector('#bkBody tbody tr');
  return page.evaluate(names => Object.fromEntries([...document.querySelectorAll('#bkBody tbody tr')].map(tr => [names.find(n => tr.textContent.includes(n)), tr.innerText.replace(/\s+/g, ' ')]).filter(x => x[0])), NAMES);
}
async function lateFile(page, dir, name) {
  const f = path.join(dir, name + ' poster.pdf'); fs.writeFileSync(f, await makePaper({ title: 'Poster' }));
  await page.waitForSelector('#dlgBox [data-match]');
  await page.click('#dlgBox [data-match]');
  await page.waitForSelector('#dlgBox [data-pf]');
  const [fc] = await Promise.all([page.waitForFileChooser(), page.click('#dlgBox [data-pf]')]);
  await fc.accept([f]);
  await page.waitForSelector('#dlgBox select[data-row]');
  assert.equal(await page.$eval('#dlgBox [data-go]', b => b.textContent), 'Open 1 file for 1 student', name + ' is matched by the file name');
  await page.click('#dlgBox [data-go]');
  await closed(page);
  await page.waitForFunction(n => { const b = window.__gs.state().batch; return b && b.students.some(s => s.key === n && s.files.length); }, { timeout: 30000 }, name);
}
async function scoreHim(page, name, pts) {
  await goToStudent(page, await page.evaluate(n => window.__gs.state().batch.students.findIndex(s => s.key === n), name));
  await page.waitForSelector('#ptsIn');
  await page.$eval('#ptsIn', e => { e.focus(); e.select(); }); await page.keyboard.type(pts); await page.keyboard.press('Tab');
  await settle(page);
}

test('a late paper on a typed-in assignment: Add papers… on the card, scored, and the typed scores stay', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  const dir = tmpDir('late');
  const was = await rows(page);
  await classPage(page, 'c1');
  const btn = await page.waitForSelector('#classes .card[data-card="i1"] .row > [data-open-asg]');
  assert.equal(await btn.evaluate(b => b.textContent), 'Add papers…', 'the card shows the way to add a paper, not only in its ⋯ menu');
  await btn.click();
  await page.waitForSelector('#dlgBox .typednote');
  await lateFile(page, dir, 'Dov Madeup');
  await scoreHim(page, 'Dov Madeup', '17');
  const st = await page.evaluate(() => window.__gs.state().lib.classes[0].units[0].items[0]);
  assert.ok(st.batchId, 'the card keeps the paper');
  assert.deepEqual(Object.keys(st.typed.s).sort(), ['Aria Testwell', 'Bram Sample'], 'the typed scores are all still there');
  let now = await rows(page);
  for (const n of ['Aria Testwell', 'Bram Sample', 'Cleo Fixture']) assert.equal(now[n], was[n], n + '’s row is unchanged');
  assert.match(now['Dov Madeup'], /85%/, 'the paper’s score is in the gradebook');
  await classPage(page, 'c1');
  assert.ok(await page.$('#classes .card[data-card="i1"] .bkpill.typed'), 'the card still says some scores were typed in');
  // a second late paper goes into the same papers, so the first one stays on the card
  await page.click('#classes .card[data-card="i1"] [data-kopen]');
  await page.waitForFunction(() => window.__gs.state().batch && window.__gs.state().batch.students.length);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.id), st.batchId, 'Open goes back to the same papers');
  await goToStudent(page, 2);
  const f = path.join(dir, 'late.pdf'); fs.writeFileSync(f, await makePaper({ title: 'Late poster' }));
  await page.evaluate(() => { window.__pick = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === 'file') { this.id = 'pickHere'; document.body.appendChild(this); return; } return window.__pick.call(this); }; });
  await pick(page, '#addFileBtn');
  await page.waitForSelector('#pickHere');
  await (await page.$('#pickHere')).uploadFile(f);
  await page.waitForFunction(() => window.__gs.state().batch.students[2].files.length, { timeout: 20000 });
  await scoreHim(page, 'Cleo Fixture', '12');
  now = await rows(page);
  for (const n of ['Aria Testwell', 'Bram Sample']) assert.equal(now[n], was[n], n + '’s row is still unchanged');
  assert.match(now['Dov Madeup'], /85%/, 'the first late paper still counts');
  assert.match(now['Cleo Fixture'], /60%/, 'and so does the second');
  assert.deepEqual(page.errors, []);
  await close(); fs.rmSync(dir, { recursive: true, force: true });
});
