// Stage 8, slice E2: the Planner's commands in the command bar and the focus panel's Esc (rows E2-098, E2-100, E2-101, E2-103 of
// rebuild/audit/gaps.md). Made-up work at the stopped clock (planseed.js).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./e2harness.js');
const h = harness(before, after);
const until = (p, fn, ...a) => p.waitForFunction(fn, { timeout: 10000 }, ...a);
async function bar(p, words) {
  await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control');
  await p.waitForSelector('dialog.cmd[open] input');
  await p.keyboard.type(words);
}
const choose = (p, label) => until(p, l => { const o = [...document.querySelectorAll('dialog.cmd [role="option"]')].find(x => x.textContent === l); if (o) o.click(); return !!o; }, label);

test('E2-100 E2-101 E2-098: Dark mode and Light mode flip the theme from the command bar; Full screen and the Planner folder are there too', async () => {
  const p = await h.fresh();
  await h.open(p, 'calendar/class');
  await bar(p, 'dark mode');
  await choose(p, 'Dark mode');
  await until(p, () => document.documentElement.dataset.look === 'midnight');
  assert.equal(await h.local(p, 'gs.look'), '"midnight"');
  await bar(p, 'light mode');
  await choose(p, 'Light mode');
  await until(p, () => document.documentElement.dataset.look === 'graphite');
  assert.equal(await h.local(p, 'gs.look'), '"graphite"');
  // Full screen, as a shortcut that can run now
  await bar(p, 'full screen');
  await until(p, () => [...document.querySelectorAll('dialog.cmd [role="option"]')].some(o => o.textContent === 'Full screen'));
  await p.keyboard.press('Escape');
  // the Planner folder: with none linked, Link it (the folder chooser, here put away unanswered)
  await p.evaluate(() => { window.__picked = 0; window.showDirectoryPicker = () => { window.__picked++; return Promise.reject(Object.assign(new Error('no'), { name: 'AbortError' })); }; });
  await bar(p, 'planner folder');
  await choose(p, 'Link the Planner folder');
  await until(p, () => window.__picked === 1);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-103: Esc in a running focus session’s panel folds it to the pill', async () => {
  const p = await h.fresh();
  await h.open(p, 'lesson/L3');
  await p.waitForSelector('[data-focus="lesson-focus"]');
  await p.click('[data-focus="lesson-focus"]');
  await p.waitForSelector('[data-fc-panel="run"]', { timeout: 20000 });
  await p.focus('[data-fc-panel="run"] [data-fc-fold]');
  await p.keyboard.press('Escape');
  await p.waitForSelector('[data-fc-panel="pill"]');
  assert.equal(JSON.parse(await h.local(p, 'gsp.focusRun')).fold, true);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});
