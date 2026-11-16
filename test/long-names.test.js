// A long name in the student list wraps to a second line instead of ending in "…", so every student can be told apart (11/16).
// The pills (late, group, sent, High/Mid/Low) sit under the name, the score keeps its place, and short names keep the one-line row.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, settle } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const NAMES = ['Ann Alpha', 'Alexandria Montgomery-Fitzgerald', 'Cleo Beta', 'Bartholomew Featherstonehaugh-Worthington', 'Dee Gamma'];
const libOf = names => ({ classes: [{ id: 'c1', name: 'Period 1', names, units: [] }] });
const rows = page => page.$$eval('#stuList .stu', b => b.map(x => { const nm = x.querySelector('.nm'), lh = parseFloat(getComputedStyle(nm).lineHeight);
  return { name: nm.textContent, lines: Math.round(nm.getBoundingClientRect().height / lh), cut: nm.scrollHeight > nm.clientHeight + 1, h: Math.round(x.getBoundingClientRect().height), score: x.querySelector('.tail').getBoundingClientRect().width > 0 }; }));

test('long names wrap to two lines in the open list; short ones stay one line; the strip keeps every row the same height', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(libOf(NAMES)), 'gs.listOpen': 'true' } } });
  const z = {}; for (const n of NAMES) z[n + '/Essay.pdf'] = await makePaper({ title: n });
  await openZip(page, await zipOf(z));
  await page.waitForSelector('#cols.open #stuList .stu .nm');
  const open = await rows(page);
  assert.deepEqual(open.map(r => r.name), NAMES);
  assert.deepEqual(open.map(r => r.lines > 1), [false, true, false, true, false], 'the long names take more than one line');
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, clip: { x: 0, y: 0, width: 520, height: 420 } });
  assert.ok(open.every(r => !r.cut), 'no name is cut: ' + JSON.stringify(open));
  assert.ok(open[0].h <= 34 && open[2].h <= 34, 'a short name keeps the slim row');
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, clip: { x: 0, y: 0, width: 520, height: 420 } });
  // a pill (late) goes on its own line under the name, so it never narrows the name
  await page.evaluate(() => { for (const i of [1, 2]) window.__gs.state().batch.students[i].grade.status = 'late'; const f = document.querySelector('#stuFind'); f.dispatchEvent(new Event('input', { bubbles: true })); });
  const pill = await page.$$eval('#stuList .stu', b => b.slice(0, 3).map(x => { const p = x.querySelector('.pills'), n = x.querySelector('.nm').getBoundingClientRect(); return p.children.length ? Math.round(p.getBoundingClientRect().top - n.bottom) : null; }));
  assert.equal(pill[0], null); assert.ok(pill[1] >= 0 && pill[2] >= 0, 'pills sit under the name: ' + pill);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT.replace('.png', '-pills.png'), clip: { x: 0, y: 0, width: 520, height: 460 } });
  // folded to the strip, names hide and every row is the same slim height again
  await page.click('#colL'); await page.waitForSelector('#cols:not(.open)');
  await page.mouse.move(900, 400); await page.waitForFunction(() => !document.querySelector('#cols.peek'));
  const hs = await page.$$eval('#stuList .stu', b => b.map(x => Math.round(x.getBoundingClientRect().height)));
  assert.equal(new Set(hs).size, 1, 'strip rows: ' + hs);
  await settle(page);
  assert.deepEqual(page.errors, []);
  await close();
});
