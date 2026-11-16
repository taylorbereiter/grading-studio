// The focus timer and the daily goal (src/focus.js): a session opens the work, papers finished anywhere count toward the day's goal
// (a score finished, or feedback complete on a formative activity), and the time, the breaks and the pace are written into a log
// with no names in it. Every student, class and to-do here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { launch } = require('./helpers/chrome');
const { builtHtml, openApp, openZip, goTo, score, settle, classPage, pickFile, waitPaper } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');
const { gradingSeed } = require('./helpers/steady');

let browser, zip;
before(async () => { builtHtml(); browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const pause = ms => new Promise(r => setTimeout(r, ms));
const withMe = (s, me) => { const lib = JSON.parse(s.ls['gs.lib']); lib.me = { ...(lib.me || {}), ...me }; return { ...s, ls: { ...s.ls, 'gs.lib': JSON.stringify(lib) } }; };
const meFocus = page => page.evaluate(() => { const f = (window.__gs.state().lib.me || {}).focus; return f === undefined ? undefined : JSON.parse(JSON.stringify(f)); });
const log = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.fcLog())));
const papers = page => page.evaluate(() => window.__gs.fcPapersToday());
const runState = page => page.evaluate(() => { const r = window.__gs.fcRun(); return r ? r.st : null; });
// moves a running session's clock on, as if the time had passed
const later = (page, f) => page.evaluate(f => { const G = window.__gs, r = G.fcRun(); new Function('r', f)(r); G.fcRunSet(r); G.fcTick(); }, f);
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('a session opens the next paper with nothing finished, finished papers count toward the goal, and the time and the pace are written down', async () => {
  const { page, close } = await openApp(browser, { seed: withMe(gradingSeed(), { focus: { goal: { k: 'papers', n: 2 } } }) });
  await openZip(page, zip); await score(page, [4, 3, 3]); await settle(page);
  await page.click('#closeBtn'); await page.waitForSelector('#fcCard [data-fcstart]');
  await page.waitForFunction(() => window.__gs.fcPapersToday() === 1);
  assert.match(await page.$eval('#fcCard .fcgh', e => e.textContent), /1 of 2 papers/);
  assert.deepEqual(await page.$$eval('#fcCard .fcdots i', d => d.map(i => i.classList.contains('fon'))), [true, false], 'a dot for each paper of the goal, one filled');
  assert.equal(await page.$eval('#railFocusT', e => e.textContent), '1/2');
  const title = await page.title();
  // Start: the set of papers opens at the next paper that has nothing finished
  await page.click('#fcCard [data-fcstart]');
  await page.waitForFunction(() => !document.querySelector('#app').hidden && window.__gs.state().cur === 1);
  await page.waitForSelector('#fcPanel:not([hidden]) .fcclock');
  await page.waitForFunction(t => /^\d+:\d\d · /.test(document.title) && document.title.endsWith(t), {}, title);
  assert.match(await page.$eval('#railFocusT', e => e.textContent), /^\d+:\d\d$/, 'the sidebar shows the time left');
  await score(page, [3, 3, 2]); await settle(page);
  await page.waitForFunction(() => window.__gs.fcPapersToday() === 2);
  await page.waitForSelector('#railFocus.fcmet, #fcPanel .fcmet');
  // the time is up: ten minutes go into today, with one paper for the pace, and the tab says so
  await later(page, 'r.at -= r.len * 1000 + 2000;');
  await page.waitForSelector('#fcPanel [data-fcbreak]');
  assert.equal(await runState(page), 'up');
  assert.ok((await page.title()).startsWith('0:00 ✓ · '));
  let L = await log(page);
  assert.equal(L.days[today()].s, 600); assert.equal(L.days[today()].p, 2);
  assert.deepEqual(L.pace, [[600, 1]]);
  // a break, then its end
  await page.click('#fcPanel [data-fcbreak]');
  assert.equal(await runState(page), 'brk');
  await page.waitForFunction(() => /^\S+ \d+:\d\d · /.test(document.title));
  await later(page, 'r.brkAt -= r.brkLen * 1000 + 2000;');
  assert.equal(await runState(page), 'brkup');
  // stopping writes nothing more, and closing puts the tab's name back as it was
  await page.click('#fcPanel [data-fcstop]'); await page.click('#fcPanel [data-fcclose]');
  assert.equal(await runState(page), null);
  await page.waitForFunction(t => document.title === t, {}, title);
  L = await log(page);
  assert.equal(L.days[today()].s, 600, 'a break is not counted as work');
  assert.ok(!JSON.stringify(L).match(/Aria|Bram|Cleo|Dov|Testwell/), 'the log has no names in it');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.focusRun')), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a paper whose feedback is complete on a formative activity counts as done', async () => {
  const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'];
  const lib = { classes: [{ id: 'c1', name: 'Grade 9 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [{ id: 'i1', name: 'Story map', classId: 'c1', type: 'fm', due: '2026-09-05' }] }] }], loose: { id: '', units: [] }, seed2627: true, me: { focus: { goal: { k: 'papers', n: 2 } } } };
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(lib) } } });
  await classPage(page, 'i1');
  await page.waitForSelector('[data-open-asg="i1"]'); await page.click('[data-open-asg="i1"]');
  await page.waitForSelector('#dlgBox [data-cancel]'); await page.click('#dlgBox [data-cancel]');
  const clean = await pickFile(page, '#asgIn', zip, 'Story map.zip'); await waitPaper(page); clean();
  await page.waitForSelector('#fbTog');
  await page.click('#fbTog');
  await page.waitForFunction(() => document.querySelector('#fbTog').getAttribute('aria-checked') === 'true');
  await page.click('#nextBtn'); await page.waitForFunction(() => window.__gs.state().cur === 1);
  await page.keyboard.down('Shift'); await page.keyboard.press('KeyF'); await page.keyboard.up('Shift');
  await page.waitForFunction(() => window.__gs.state().cur === 2);
  await settle(page);
  await page.waitForFunction(() => window.__gs.fcPapersToday() === 2);
  // a comment with no switch is not a paper done
  await page.type('#cmtIn', 'Add the setting.'); await page.$eval('#cmtIn', e => e.blur()); await settle(page);
  assert.equal(await papers(page), 2);
  await page.click('#closeBtn'); await page.waitForSelector('#fcCard .fcmet');
  assert.match(await page.$eval('#fcCard .fcmet', e => e.textContent), /Goal reached/);
  assert.equal(await page.$eval('#railFocusT', e => e.textContent), '2/2');
  assert.ok(await page.$('#railFocus.fcmet'), 'the sidebar ring goes green');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Settings keep only what differs from the usual, and a setup from an assistant brings the timer and the goal in and out', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  await goTo(page, '#/settings/focus'); await page.waitForSelector('#fcLen');
  assert.equal(await meFocus(page), undefined);
  await page.select('#fcLen', '25'); await pause(200);
  assert.deepEqual(await meFocus(page), { len: 25 });
  await page.select('#fcLen', '10'); await pause(200);
  assert.equal(await meFocus(page), undefined, 'back to the usual leaves nothing stored');
  await page.click('#fcGoalK [data-v="papers"]'); await page.waitForSelector('#fcGoalN');
  await page.$eval('#fcGoalN', e => { e.value = 8; e.dispatchEvent(new Event('change', { bubbles: true })); }); await pause(200);
  assert.deepEqual(await meFocus(page), { goal: { k: 'papers', n: 8 } });
  await page.click('#fcSound'); await pause(200);
  assert.deepEqual(await meFocus(page), { goal: { k: 'papers', n: 8 }, sound: false });
  await page.click('#fcGoalK [data-v="min"]'); await pause(200);
  assert.equal((await meFocus(page)).goal.k, 'min');
  await page.click('#fcGoalK [data-v=""]'); await pause(200);
  assert.deepEqual(await meFocus(page), { sound: false });
  await page.click('#fcSound'); await pause(200);
  assert.equal(await meFocus(page), undefined);
  // a setup brings it in, says what it changes, goes out again the same, and Undo puts it back
  const r = await page.evaluate(async () => {
    const G = window.__gs, S = G.stpRead({ gradingStudioSetup: 1, focus: { sessionMinutes: 15, breakMinutes: 7, dailyGoal: { minutes: 90 }, chime: false, timeInTab: true, stopCountingAfterMinutes: 4 } });
    const diff = JSON.stringify(G.stpDiff(S)); await G.stpApply(S, { focus: true });
    const me = JSON.parse(JSON.stringify(G.state().lib.me.focus)), ex = await G.stpExport(), out = (typeof ex === 'string' ? JSON.parse(ex) : ex).focus;
    await G.stpUndo();
    return { read: S.focus, diff, me, out, after: (G.state().lib.me || {}).focus };
  });
  assert.deepEqual(r.read, { len: 15, goal: { k: 'min', n: 90 }, sound: false, title: true }, 'a break length the app does not offer is left out');
  assert.match(r.diff, /Focus timer and daily goal/);
  assert.deepEqual(r.me, { len: 15, goal: { k: 'min', n: 90 }, sound: false });
  assert.deepEqual(r.out, { sessionMinutes: 15, breakMinutes: 5, dailyGoal: { minutes: 90 }, chime: false, timeInTab: true, countTime: true, stopCountingAfterMinutes: 5, freePeriods: true, weeklyLookBack: 'friday', quietWhileFocusing: false, shortestFirst: false, sessionGoals: true });
  assert.equal(r.after, undefined);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Focus on this in To do starts a session on the to-do, and the end offers to tick it', async () => {
  const s = gradingSeed(), lib = JSON.parse(s.ls['gs.lib']);
  lib.todo = { items: [{ id: 'a', x: 'Write the unit test questions', d: '', c: '', who: '', a: '', rep: '', note: '', done: 0, made: 1, t: 1 }] };
  const { page, close } = await openApp(browser, { seed: { ...s, ls: { ...s.ls, 'gs.lib': JSON.stringify(lib), 'gsc.folderLater': String(Date.now()) } } });
  await goTo(page, '#/todo'); await page.waitForSelector('#tdList [data-td="a"] .tdmain');
  await page.click('#tdList [data-td="a"] .tdmain'); await page.waitForSelector('#tdSide [data-tdfocus]');
  await page.click('#tdSide [data-tdfocus]');
  await page.waitForSelector('#fcPanel:not([hidden]) .fcclock');
  assert.equal(await page.evaluate(() => window.__gs.fcRun().w), 'td:a');
  assert.match(await page.$eval('#fcPanel', e => e.textContent), /Write the unit test questions/);
  await page.click('#fcPanel [data-fcstop]'); await page.waitForSelector('#fcPanel [data-fctick]');
  assert.match(await page.$eval('#fcPanel', e => e.textContent), /Is this to-do done\?/);
  await page.click('#fcPanel [data-fctick]');
  await page.waitForFunction(() => window.__gs.state().lib.todo.items.find(i => i.id === 'a').done);
  assert.equal(await runState(page), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the running session stays in this browser; the settings and the log go with the teacher’s work', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'folder.js'), 'utf8');
  const re = new RegExp(src.match(/const LS_LOCAL = \/(.+?)\/;/)[1]);
  assert.ok(re.test('gs.focusRun'), 'a session half done on one computer is not carried to another');
  assert.ok(!re.test('gs.focus'), 'the log of days and the pace go with the folder and the take-home file');
});
