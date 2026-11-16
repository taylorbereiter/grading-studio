// A goal for each focus session (src/focus.js): suggested from the teacher's pace, picked in a press, kept in view while the session
// runs, looked at when it ends, and carried into the next session when it isn't reached. Goals a week or on some days, and a set to
// finish by a day. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { builtHtml, openApp, goTo } = require('./helpers/app');
const { gradingSeed } = require('./helpers/steady');

let browser;
before(async () => { builtHtml(); browser = await launch(); });
after(async () => { await browser.close(); });

const pause = ms => new Promise(r => setTimeout(r, ms));
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return iso(d); };
const log = page => page.evaluate(() => JSON.parse(localStorage.getItem('gs.focus') || 'null'));
const run = page => page.evaluate(() => window.__gs.fcRun());
const text = (page, sel) => page.$eval(sel, e => e.textContent);
// The made-up class with a pace behind it (5 minutes a paper on Poetry analysis), and Poetry analysis with 3 of 6 papers scored.
function paceSeed(todo) {
  const s = gradingSeed(), lib = JSON.parse(s.ls['gs.lib']);
  if (todo) lib.todo = { items: todo };
  const focus = { day: dayAgo(0), base: {}, days: { [dayAgo(1)]: { p: 6, s: 0, g: 1800, a: { i5: 1800 }, pa: { i5: 6 } } }, pace: [], last: 'mark:gs.b.n2' };
  const idb = JSON.parse(JSON.stringify(s.idb)), meta = idb['grading-studio-keep'].stores.meta;
  for (const m of meta) if (m[0] === 'gs.b.n2') Object.assign(m[1], { scored: 3, papers: true, t: Date.now() - 3 * 3600e3 });
  return { ls: { ...s.ls, 'gs.lib': JSON.stringify(lib), 'gs.focus': JSON.stringify(focus) }, idb };
}
// The session's clock moved on, as if its minutes had gone by.
const timeUp = page => page.evaluate(() => { const r = window.__gs.fcRun(); r.at -= r.len * 1000 + 1000; localStorage.setItem('gs.focusRun', JSON.stringify(r)); window.__gs.fcTick(); });

test('a session goal is suggested from her pace, set in a press, shown while it runs, and carried into the next session', async () => {
  const { page, close } = await openApp(browser, { seed: paceSeed() });
  await page.waitForFunction(() => window.__gs.kept().size > 0);
  await page.waitForFunction(() => { const s = document.querySelector('#fcCard [data-fcwork]'); return s && s.value === 'mark:gs.b.n2'; });
  // 10 minutes at 5 minutes a paper: 2 of the 3 papers left
  await page.waitForSelector('#fcCard .fcsgpick');
  assert.equal(await text(page, '#fcCard [data-fcsg][aria-pressed="true"]'), '2 papers');
  await page.click('#fcCard [data-fcsgn="1"]');
  assert.equal(await text(page, '#fcCard [data-fcsg][aria-pressed="true"]'), '3 papers');
  assert.equal(await page.$eval('#fcCard [data-fcsgn="1"]', b => b.disabled), true, 'never more than the papers left');
  await page.click('#fcCard [data-fcsgn="-1"]');
  // 25 minutes holds the whole set
  await page.click('#fcCard [data-fclen="25"]');
  assert.equal(await text(page, '#fcCard [data-fcsg][aria-pressed="true"]'), '2 papers', 'a goal picked by hand stays');
  await page.click('#fcCard [data-fcsg=""]'); await page.click('#fcCard [data-fclen="10"]');
  assert.equal(await page.$$eval('#fcCard [data-fcsg][aria-pressed="true"]', l => l.map(b => b.dataset.fcsg).join()), '', 'no goal, picked by hand');
  await page.click('#fcCard [data-fcsg="papers"]');
  // start: the goal goes with the session, and the panel shows it
  await page.click('#fcCard [data-fcstart]');
  let r = await run(page);
  assert.deepEqual(r.sg, { k: 'papers', n: 2 }); assert.equal(r.no, 1);
  await page.waitForSelector('#fcPanel .fcsg');
  assert.equal(await text(page, '#fcPanel .fcsg'), 'Session goal0 of 2 papers');
  // time is up with nothing finished: it says how far it got, and the rest goes into the next session
  await timeUp(page);
  await page.waitForSelector('#fcPanel .fcsgr');
  assert.match(await text(page, '#fcPanel .fcsgr'), /^Session goal 0 of 2 papersThe rest goes into your next session\. Don’t carry it over$/);
  let L = await log(page);
  assert.deepEqual({ w: L.carry.w, k: L.carry.k, n: L.carry.n }, { w: 'mark:gs.b.n2', k: 'papers', n: 2 });
  assert.equal(L.days[dayAgo(0)].n, 1, 'one session today');
  // a break says what comes next, and the next session picks it up
  await page.click('#fcPanel [data-fcbreak]');
  assert.equal(await text(page, '#fcPanel .fcsgnext'), 'Session goal 2 papers (carried over)');
  await page.evaluate(() => { const r = window.__gs.fcRun(); r.brkAt -= r.brkLen * 1000 + 1000; localStorage.setItem('gs.focusRun', JSON.stringify(r)); window.__gs.fcTick(); });
  await page.waitForSelector('#fcPanel [data-fcother]');
  assert.equal(await text(page, '#fcPanel .fcsgnext'), 'Session goal 2 papers (carried over)');
  await page.click('#fcPanel [data-fcstart]');
  r = await run(page);
  assert.deepEqual(r.sg, { k: 'papers', n: 2 }); assert.equal(r.no, 2);
  assert.equal((await log(page)).carry, undefined, 'used up');
  await page.waitForSelector('#fcPanel .fcstat');
  assert.match(await text(page, '#fcPanel .fcstat'), /^Session 2/);
  // a paper finished in this one counts toward it
  await page.evaluate(() => { const r = window.__gs.fcRun(); r.p0 -= 2; localStorage.setItem('gs.focusRun', JSON.stringify(r)); window.__gs.fcRunSet(r); });
  assert.match(await text(page, '#fcPanel .fcsg'), /^Session goal2 papersReached$/);
  // stopping early with it reached: nothing to carry
  await page.click('#fcPanel [data-fcstop]');
  await page.waitForSelector('#fcPanel .fcsgr.met');
  assert.equal(await text(page, '#fcPanel .fcsgr.met'), 'Session goal reached');
  assert.equal((await log(page)).carry, undefined);
  await page.click('#fcPanel [data-fcclose]');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a goal of her own words, a to-do as the goal, letting a goal go, and starting something else after a break', async () => {
  const { page, close } = await openApp(browser, { seed: paceSeed([{ id: 't1', x: 'Write the parent letter', d: '', made: Date.now() }]) });
  await page.waitForFunction(() => window.__gs.kept().size > 0);
  await page.waitForSelector('#fcCard [data-fcwork]');
  await page.select('#fcCard [data-fcwork]', '');
  await page.waitForSelector('#fcCard [data-fcsgx]');
  await page.type('#fcCard [data-fcsgx]', 'Plan the poetry lesson');
  await page.click('#fcCard [data-fcstart]');
  assert.deepEqual((await run(page)).sg, { k: 'note', x: 'Plan the poetry lesson' });
  await page.waitForSelector('#fcPanel .fcsg');
  assert.equal(await text(page, '#fcPanel .fcsg'), 'Session goalPlan the poetry lesson');
  await page.click('#fcPanel [data-fcstop]');
  await page.waitForSelector('#fcPanel [data-fcsgdone]');
  assert.equal((await log(page)).carry.x, 'Plan the poetry lesson', 'kept for the next session until she says it is done');
  await page.click('#fcPanel [data-fcsgdone]');
  await page.waitForSelector('#fcPanel .fcsgr.met');
  assert.equal((await log(page)).carry, undefined);
  await page.click('#fcPanel [data-fcclose]');
  // not reached, and let go
  await page.waitForSelector('#fcCard [data-fcsgx]');
  await page.type('#fcCard [data-fcsgx]', 'Read the rubric');
  await page.click('#fcCard [data-fcstart]');
  await timeUp(page);
  await page.waitForSelector('#fcPanel [data-fccarryno]');
  await page.click('#fcPanel [data-fccarryno]');
  assert.equal((await log(page)).carry, undefined);
  assert.equal(await page.$('#fcPanel [data-fccarryno]'), null);
  // after a break: something else opens the start again
  await page.click('#fcPanel [data-fcbreak]');
  await page.evaluate(() => { const r = window.__gs.fcRun(); r.brkAt -= r.brkLen * 1000 + 1000; localStorage.setItem('gs.focusRun', JSON.stringify(r)); window.__gs.fcTick(); });
  await page.waitForSelector('#fcPanel [data-fcother]');
  await page.click('#fcPanel [data-fcother]');
  assert.equal(await run(page), null);
  await page.waitForSelector('#fcPanel [data-fcwork]');
  // a to-do: finishing it is the goal, and it can be ticked from the end of the session
  await page.evaluate(() => window.__gs.focusOn('td:t1'));
  assert.deepEqual((await run(page)).sg, { k: 'td' });
  await page.click('#fcPanel [data-fcstop]');
  await page.waitForSelector('#fcPanel [data-fctick]');
  await page.click('#fcPanel [data-fctick]');
  assert.equal(await page.evaluate(() => window.__gs.state().lib.todo.items[0].done > 0), true);
  // Settings can stop the suggestions
  await goTo(page, '#/settings/focus'); await page.waitForSelector('#fcSg');
  await page.click('#fcSg'); await pause(100);
  assert.equal(await page.evaluate(() => window.__gs.state().lib.me.focus.sg), false);
  await goTo(page, '#/');
  await page.waitForSelector('#fcCard [data-fcwork]');
  await page.select('#fcCard [data-fcwork]', 'mark:gs.b.n2');
  await page.waitForSelector('#fcCard .fcsgpick');
  assert.equal(await page.$eval('#fcCard [data-fcsg][aria-pressed="true"]', b => b.dataset.fcsg), '');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a goal for the week or for some days, a set finished by a day, and both in My setup', async () => {
  const { page, close } = await openApp(browser, { seed: paceSeed() });
  await page.waitForFunction(() => window.__gs.kept().size > 0);
  await goTo(page, '#/settings/focus'); await page.waitForSelector('#fcGoalK');
  await page.click('#fcGoalK [data-v="papers"]'); await page.waitForSelector('#fcGoalPer');
  await page.select('#fcGoalPer', 'week'); await pause(100);
  assert.deepEqual(await page.evaluate(() => window.__gs.state().lib.me.focus.goal), { k: 'papers', n: 50, per: 'week' });
  assert.equal(await page.$('[data-fcgday]'), null, 'a week goal has no days');
  assert.match(await page.$eval('#railFocus', e => e.title), /^Focus: \d+ of 50 papers this week$/);
  await goTo(page, '#/'); await page.waitForSelector('#fcCard .fcgoal');
  assert.match(await text(page, '#fcCard .fcgh'), /^This week\d+ of 50 papers$/);
  assert.notEqual(await page.$('#fcCard .fcbar'), null, 'a bar, not dots');
  // back to a day, on one day only: tomorrow
  await goTo(page, '#/settings/focus'); await page.waitForSelector('#fcGoalPer');
  await page.select('#fcGoalPer', 'day'); await page.waitForSelector('[data-fcgday]');
  const tomorrow = (new Date().getDay() + 1) % 7;
  for (let d = 0; d < 7; d++) if (d !== tomorrow) { await page.click('[data-fcgday="' + d + '"]'); await pause(50); }
  assert.deepEqual(await page.evaluate(() => window.__gs.state().lib.me.focus.goal), { k: 'papers', n: 10, days: [tomorrow] });
  await page.click('[data-fcgday="' + tomorrow + '"]'); await pause(50);
  assert.equal(await page.$eval('[data-fcgday="' + tomorrow + '"]', b => b.checked), true, 'at least one day stays');
  await goTo(page, '#/'); await page.waitForSelector('#fcCard .fcnogoal');
  assert.match(await text(page, '#fcCard .fcnogoal'), /^No goal todayGoal days$/);
  // finish the set by a day: the papers a day it takes
  await page.waitForSelector('#fcCard [data-fcby]');
  await page.evaluate(d => { const i = document.querySelector('#fcCard [data-fcby]'); i.value = d; i.dispatchEvent(new Event('change', { bubbles: true })); }, dayAgo(-14));
  assert.equal((await log(page)).by['gs.b.n2'], dayAgo(-14));
  assert.match(await text(page, '#fcCard .fcby'), /^Finish by 1 paper a day$/);
  // My setup carries the goal's week and days, and whether sessions get a goal
  const S = await page.evaluate(() => window.__gs.stpRead({ gradingStudioSetup: 1, focus: { dailyGoal: { minutes: 300, per: 'week' }, sessionGoals: false } }).focus);
  assert.deepEqual(S, { goal: { k: 'min', n: 300, per: 'week' }, sg: false });
  const D = await page.evaluate(() => window.__gs.stpRead({ gradingStudioSetup: 1, focus: { dailyGoal: { papers: 8, days: ['Monday', 'wednesday'] } } }).focus);
  assert.deepEqual(D, { goal: { k: 'papers', n: 8, days: [1, 3] } });
  const out = JSON.parse(await page.evaluate(async () => await window.__gs.stpExport())).focus;
  assert.deepEqual(out.dailyGoal, { papers: 10, days: [['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][tomorrow]] });
  assert.equal(out.sessionGoals, true);
  assert.deepEqual(page.errors, []);
  await close();
});
