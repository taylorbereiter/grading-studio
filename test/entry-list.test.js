// The entry list: one task's scores, in the school system's order, in a small window to type from. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { classPage, openApp } = require('./helpers/app');
const { ibSeed } = require('./helpers/ibseed');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'];
function seed() {
  const lib = {
    classes: [{ id: 'c1', name: 'Grade 9 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [
      { id: 'i1', name: 'Quiz 3', classId: 'c1', type: 'ic', due: '2026-09-10', typed: { max: 10, s: { 'Aria Testwell': { v: 8, st: '' }, 'Bram Sample': { v: 7.5, st: '' }, 'Cleo Fixture': { v: null, st: 'missing' } } } },
      { id: 'i2', name: 'Paragraph', classId: 'c1', type: 'ic', due: '2026-09-12', typed: { max: null, s: { 'Dov Madeup': { v: 85, st: '' } } } },
    ] }] }],
    loose: { id: '', units: [] }, seed2627: true,
    book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2027-01-31' }] },
  };
  return { ls: { 'gs.lib': JSON.stringify(lib) } };
}
async function openBook(page, sel) {
  await classPage(page, 'c1');
  await page.waitForSelector('[data-book="c1"]');
  await page.click('[data-book="c1"]');
  await page.waitForSelector(sel);
}
// What the list shows, from its own window (found again by its name) or the panel on the page.
const list = page => page.evaluate(() => {
  const w = window.open('', 'gsEntryList'), root = (w && w.document.getElementById('mbRoot')) || document.getElementById('mbPanel');
  if (!root || !root.querySelector('.mbx')) return null;
  return { rows: [...root.querySelectorAll('li')].map(li => li.querySelector('.mbn').textContent + ' ' + li.querySelector('.mbv').textContent), count: root.querySelector('.mbcount span').textContent,
    task: root.querySelector('[data-mbtask]').selectedOptions[0].textContent, cur: [...root.querySelectorAll('li')].findIndex(li => li.classList.contains('cur')), done: root.querySelectorAll('li.done').length };
});
const press = (page, sel) => page.evaluate(sel => { const w = window.open('', 'gsEntryList'), root = (w && w.document.getElementById('mbRoot')) || document.getElementById('mbPanel'); root.querySelector(sel).click(); }, sel);

test('a column’s box opens its scores in a small window: in order, missing as a word, ticked off a click at a time, and the order is remembered', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openBook(page, '#bkTab');
  await page.click('[data-bkcol="i1"]'); await page.waitForSelector('#bkPop [data-mbopen="i1"]');
  await page.click('#bkPop [data-mbopen="i1"]');
  let l = await list(page);
  assert.equal(l.task, 'Quiz 3');
  assert.deepEqual(l.rows, ['Aria Testwell 8', 'Bram Sample 7.5', 'Cleo Fixture missing', 'Dov Madeup –']);
  assert.match(l.count, /^0 of 4 done · out of 10$/);
  await press(page, '[data-mbrow="0"]');
  l = await list(page);
  assert.deepEqual([l.done, l.cur], [1, 1], 'a click ticks the student and moves to the next');
  assert.match(l.count, /^1 of 4 done/);
  await press(page, '[data-mborder="last"]');
  l = await list(page);
  assert.deepEqual(l.rows.map(x => x.split(' ')[1]), ['Fixture', 'Madeup', 'Sample', 'Testwell'], 'by last name');
  assert.equal(await page.evaluate(() => window.__gs.state().lib.me.mbOrder), 'last');
  // another task from the list's own menu: a percent column shows the percent
  await page.evaluate(() => { const w = window.open('', 'gsEntryList'), s = w.document.querySelector('[data-mbtask]'); s.value = 'i2'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  l = await list(page);
  assert.equal(l.task, 'Paragraph');
  assert.ok(l.rows.includes('Dov Madeup 85%'));
  assert.deepEqual(page.errors, []);
  await page.evaluate(() => { const w = window.open('', 'gsEntryList'); if (w) w.close(); });
  await close();
});

test('in dark mode the list is dark too, in its own window and when it comes up as a panel', async () => {
  const s = seed(); s.ls['gs.theme'] = '"dark"';
  const { page, close } = await openApp(browser, { seed: s });
  const surface = await page.evaluate(() => { const d = document.createElement('div'); d.style.background = 'var(--surface)'; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; });
  assert.notEqual(surface, 'rgb(255, 255, 255)');
  await openBook(page, '#bkTab');
  await page.click('[data-bkcol="i1"]'); await page.waitForSelector('#bkPop [data-mbopen="i1"]');
  await page.click('#bkPop [data-mbopen="i1"]');
  assert.ok(await list(page));
  assert.equal(await page.evaluate(() => { const w = window.open('', 'gsEntryList'); return w.getComputedStyle(w.document.body).backgroundColor; }), surface, 'its own window');
  await page.evaluate(() => { const w = window.open('', 'gsEntryList'); if (w) w.close(); });
  // a browser that blocks the window: the panel on the page
  await page.evaluate(() => { window.open = () => null; });
  await page.click('[data-bkcol="i1"]'); await page.waitForSelector('#bkPop [data-mbopen="i1"]');
  await page.click('#bkPop [data-mbopen="i1"]'); await page.waitForSelector('#mbPanel .mbx');
  assert.equal(await page.$eval('#mbPanel', e => getComputedStyle(e).backgroundColor), surface, 'the panel');
  assert.deepEqual(page.errors, []);
  await close();
});

test('an MYP class lists each student’s level for every criterion the task assessed, and a browser that blocks the window gets a panel', async () => {
  const { page, close } = await openApp(browser, { seed: ibSeed() });
  await page.evaluate(() => { window.open = () => null; });
  await openBook(page, '#ibTab');
  await page.click('#bkBody [data-mbopen]');
  await page.waitForSelector('#mbPanel .mbx');
  let l = await list(page);
  assert.equal(l.task, 'Energy investigation', 'the newest task first');
  assert.equal(l.rows[0], 'Aria Testwell B6C6D6');
  assert.equal(l.rows[3], 'Dov Madeup B4C4D–', 'a level not given yet is a dash');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  l = await list(page);
  assert.deepEqual([l.done, l.cur], [2, 2], 'the arrow keys tick and move too');
  await page.keyboard.press('ArrowUp');
  assert.equal((await list(page)).done, 1);
  await page.evaluate(() => { const s = document.querySelector('#mbPanel [data-mbtask]'); s.value = '*lv'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  l = await list(page);
  assert.equal(l.task, 'Term levels');
  assert.equal(l.rows[1], 'Bram Sample A4B4C5D4');
  await press(page, '[data-mbclose]');
  assert.equal(await page.$('#mbPanel'), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the order goes out with My setup and comes back in', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  const r = await page.evaluate(async () => {
    const g = window.__gs, S = g.stpRead({ gradingStudioSetup: 1, school: { entryOrder: 'Last name' } });
    const diff = JSON.stringify(g.stpDiff(S, null));
    await g.stpApply(S, { school: true });
    return { got: S.school.mbOrder, diff, me: g.state().lib.me.mbOrder, out: JSON.parse(await g.stpExport()).school };
  });
  assert.equal(r.got, 'last');
  assert.match(r.diff, /entry list goes by last name/);
  assert.equal(r.me, 'last');
  assert.equal(r.out.entryOrder, 'last');
  await close();
});
