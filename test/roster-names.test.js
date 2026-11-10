// The student list shows each student by the name on her roster, not the longer name from the file or folder (11/10).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, settle } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const libOf = (...names) => ({ classes: [{ id: 'c1', name: 'Period 1', names, units: [] }] });
const seeded = (...names) => openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(libOf(...names)) } } });
const papers = async (...paths) => { const o = {}; for (const p of paths) o[p] = await makePaper({ title: p }); return zipOf(o); };
const shown = page => page.$$eval('#stuList .stu', b => b.map(x => [x.querySelector('.nm').textContent, x.querySelector('.nm').title]));
const keys = page => page.evaluate(() => window.__gs.state().batch.students.map(s => s.key));

test('matched papers show the roster name, with the file name kept in the hover text; others keep their file name', async () => {
  const { page, close } = await seeded('Ann Alpha', 'Ben Beta', 'Zed Nopaper');
  await openZip(page, await papers('Alpha, Ann Marie - 4411 - Essay draft/Essay.pdf', 'Ben Beta/Essay.pdf', 'Quinn Stranger - Essay/Essay.pdf'));
  assert.deepEqual(await shown(page), [
    ['Ann Alpha', 'Ann Alpha (Alpha, Ann Marie - 4411 - Essay draft)'],
    ['Ben Beta', 'Ben Beta'],
    ['Zed Nopaper', 'Zed Nopaper'],
    ['Quinn Stranger - Essay', 'Quinn Stranger - Essay'],
  ]);
  // only the list changes: the student is still stored under the folder name, so saved work opens the same
  assert.deepEqual(await keys(page), ['Alpha, Ann Marie - 4411 - Essay draft', 'Ben Beta', 'Zed Nopaper', 'Quinn Stranger - Essay']);
  // Find in the list still finds a student by either name
  const find = async q => { await page.evaluate(q => { const f = document.querySelector('#stuFind'); f.value = q; f.dispatchEvent(new Event('input', { bubbles: true })); }, q); return (await shown(page)).map(r => r[0]); };
  assert.deepEqual(await find('ann alpha'), ['Ann Alpha']);
  assert.deepEqual(await find('4411'), ['Ann Alpha']);
  assert.deepEqual(await find(''), ['Ann Alpha', 'Ben Beta', 'Zed Nopaper', 'Quinn Stranger - Essay']);
  await settle(page);
  assert.deepEqual(page.errors, []);
  await close();
});

test('with no roster picked, the list keeps the file names', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, await papers('Alpha, Ann Marie - Essay/Essay.pdf', 'Ben Beta/Essay.pdf'));
  assert.deepEqual((await shown(page)).map(r => r[0]), ['Alpha, Ann Marie - Essay', 'Ben Beta']);
  await close();
});
