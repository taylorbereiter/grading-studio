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
  assert.equal(await page.evaluate(() => localStorage.getItem('gsp.focusRun')), null);
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
  assert.deepEqual(r.out, { sessionMinutes: 15, breakMinutes: 5, dailyGoal: { minutes: 90 }, chime: false, timeInTab: true, countTime: true, stopCountingAfterMinutes: 5, freePeriods: true, weeklyLookBack: 'friday', quietWhileFocusing: false, shortestFirst: false, sessionGoals: true, music: false, musicMood: 'mix', musicVolume: 50, musicBackground: false });
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
  const th = fs.readFileSync(path.join(__dirname, '..', 'src', 'takehome.js'), 'utf8'), skip = new RegExp(th.match(/const PLAN_LS_SKIP = \/(.+?)\/;/)[1]);
  for (const k of ['gsp.focusRun', 'gsp.focusQ', 'gsp.focusGo']) assert.ok(skip.test(k), 'a session half done on one computer is not carried to another: ' + k);
  assert.ok(!re.test('gs.focus'), 'the log of days and the pace go with the folder and the take-home file');
});

test('the card shows one suggestion with one blue Start; Change opens the list of work, More the rest; idle time on papers is not counted', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  await page.bringToFront();
  await openZip(page, zip); await score(page, [4, 3, 3]); await settle(page);
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await page.click('#closeBtn'); await page.waitForSelector('#fcCard .sug');
  assert.deepEqual(await page.$$eval('#fcCard .btn.primary', b => b.map(x => x.textContent)), ['Start 10 minutes'], 'one blue button, on Start');
  assert.equal(await page.$('#fcCard [data-fcwork]'), null, 'the list of work waits behind Change');
  assert.equal(await page.$('#fcCard [data-fclen]'), null, 'the lengths wait under More');
  assert.match(await page.$eval('#fcCard .fcsay', e => e.textContent), /^\d+ papers left$/, 'no time before any time is counted on this set');
  assert.match(await page.$eval('#fcCard .fctk', e => e.textContent), /^This week1 paper·Grading time\d+ minTime tracker$/);
  await page.click('#fcCard [data-fcchg]'); await page.waitForSelector('#fcCard [data-fcwork]');
  assert.equal(await page.$eval('#fcCard [data-fcwork]', s => s.value), 'mark:' + id);
  await page.click('#fcCard [data-fckeep]'); await page.waitForSelector('#fcCard [data-fcchg]');
  await page.click('#fcCard [data-fcmo]'); await page.waitForSelector('#fcCard .fcmorebox [data-fclen]');
  assert.equal(await page.$eval('#fcCard [data-fcmo]', b => b.getAttribute('aria-expanded')), 'true');
  assert.notEqual(await page.$('#fcCard .fcmorebox [data-fcone="3"]'), null, 'Just 3 papers is under More');
  // Just one paper, left alone for twenty minutes: only the first five count, as the tracker would (Settings: 5 minutes)
  const secs = await page.evaluate(k => {
    const G = window.__gs, now = Date.now, t0 = now(); let t = t0;
    Date.now = () => t;
    try {
      const s0 = (G.fcLog().days[Object.keys(G.fcLog().days).sort().pop()] || {}).s || 0;
      G.fcStart(10, k, 1);
      t = t0 + 20 * 60e3; G.fcTick(); G.fcTick();
      G.tkActive(); G.fcTick();
      const r = G.fcRun();
      document.querySelector('#fcPanel [data-fcstop]').click();
      const L = G.fcLog(), d = L.days[Object.keys(L.days).sort().pop()];
      return { idl: r.idl, s: d.s - s0 };
    } finally { Date.now = now; }
  }, 'mark:' + id);
  assert.ok(Math.abs(secs.idl - 900) <= 2, JSON.stringify(secs));
  assert.ok(Math.abs(secs.s - 300) <= 2, JSON.stringify(secs));
  // starting the clock again after time away starts the uncounted time again too
  await page.evaluate(k => { const G = window.__gs; G.fcStart(10, k, 1); const r = G.fcRun(); Object.assign(r, { idl: 600, ii: Date.now() - 1000, away: 6, fold: false }); G.fcRunSet(r); }, 'mark:' + id);
  await page.waitForSelector('#fcPanel [data-fcaway="again"]'); await page.click('#fcPanel [data-fcaway="again"]');
  assert.deepEqual(await page.evaluate(() => { const r = window.__gs.fcRun(); return [r.idl, r.ii, r.away].map(x => x === undefined ? null : x); }), [null, null, null]);
  await page.evaluate(() => window.__gs.fcRunSet(null));
  assert.deepEqual(page.errors, []);
  await close();
});

test('when the time is up, a few more minutes go on with the same session, and ending them early counts only what ran', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  await page.evaluate(() => window.__gs.fcStart(10, '', false));
  await later(page, 'r.at -= r.len * 1000 + 2000;');
  await page.waitForSelector('#fcPanel .fcext [data-fcext="5"]');
  assert.deepEqual(await page.$$eval('#fcPanel .fcext button', b => b.map(x => x.textContent)), ['+2', '+5', '+10']);
  const before = (await log(page)).days[today()];
  await page.click('#fcPanel [data-fcext="5"]');
  const r = await page.evaluate(() => window.__gs.fcRun());
  assert.equal(r.st, 'run'); assert.equal(r.len, 300); assert.equal(r.no, 1, 'the same session goes on');
  // ended after a minute and a half: that is what counts, not the five minutes
  await later(page, 'r.at -= 90 * 1000;');
  await page.click('#fcPanel [data-fcstop]');
  const after = (await log(page)).days[today()];
  assert.ok(Math.abs(after.s - before.s - 90) <= 2, JSON.stringify([before, after]));
  assert.equal(after.n, before.n, 'not counted as another session');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a new copy of a download carries its marks over without counting them as today’s papers', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  const n = await page.evaluate(() => {
    const G = window.__gs, K = G.kept(), out = [];
    // yesterday's copy, 4 of 5 scored, and the new copy listed before its first save, with no count yet
    K.set('older-copy', { id: 'older-copy', name: 'Made-up essay', n: 5, scored: 4, marked: 4, newer: 'newer-copy' });
    G.fcSeen(); const base = G.fcPapersToday();
    K.set('newer-copy', { id: 'newer-copy', name: 'Made-up essay', n: 5 });
    out.push(G.fcPapersToday() - base);
    // its first save brings the carried marks over
    K.set('newer-copy', { ...K.get('newer-copy'), scored: 4, marked: 4 }); out.push(G.fcPapersToday() - base);
    // and one more paper finished today counts
    K.set('newer-copy', { ...K.get('newer-copy'), scored: 5, marked: 5 }); out.push(G.fcPapersToday() - base);
    return out;
  });
  assert.deepEqual(n, [0, 0, 1]);
  await close();
});

test('marks that come in from the folder (made on another computer) or from a restored copy don’t count as today’s papers', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  const n = await page.evaluate(() => {
    const G = window.__gs, K = G.kept(), out = [];
    K.set('two-computers', { id: 'two-computers', name: 'Made-up lab report', n: 6, scored: 1, marked: 1 });
    G.fcSeen(); const base = G.fcPapersToday();
    // one more paper here
    K.set('two-computers', { ...K.get('two-computers'), scored: 2, marked: 2 }); out.push(G.fcPapersToday() - base);
    // four marked yesterday on the school computer arrive through the folder (src/folder.js applyRow)
    const m0 = K.get('two-computers'), m = { ...m0, scored: 6, marked: 6 }; G.fcCame('two-computers', m0, m); K.set('two-computers', m);
    out.push(G.fcPapersToday() - base);
    return out;
  });
  assert.deepEqual(n, [1, 1]);
  await close();
});

test('a grade only typed in, with no marking, is scored but isn’t a paper marked today', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  const out = await page.evaluate(() => {
    const G = window.__gs, wc = G.carryParts.workCounts;
    const pts = { setup: { mode: 'points' }, s: { 'Made-up One': { g: { points: '18' } }, 'Made-up Two': { g: { points: '15', comment: 'Clear opening.' } }, 'Made-up Three': { g: { points: '12' }, f: { 'a.pdf': { 0: [{ t: 'pen' }] } } } } };
    const sheet = { setup: {}, s: { 'Made-up One': { g: { rubric: [], sheet: '17' } }, 'Made-up Two': { g: { rubric: [], sheet: '14' } } }, read: { 'Made-up Four': { score: 9, outOf: 10 } } };
    const a = wc(pts), b = wc(sheet);
    // the Focus count follows marked, not scored
    const K = G.kept();
    K.set('typed-only', { id: 'typed-only', name: 'Made-up email', n: 20, scored: 0, marked: 0 });
    G.fcSeen(); const base = G.fcPapersToday();
    K.set('typed-only', { ...K.get('typed-only'), scored: 19, marked: 0 }); const typed = G.fcPapersToday() - base;
    K.set('typed-only', { ...K.get('typed-only'), scored: 19, marked: 2 }); const two = G.fcPapersToday() - base;
    return [a.scored, a.marked, b.scored, b.marked, typed, two];
  });
  assert.deepEqual(out, [3, 2, 3, 0, 0, 2]);
  await close();
});

test('Just one paper ends only when a paper is marked, even when another tab counts the day differently', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  await openZip(page, zip); await score(page, [4, 3, 3]); await settle(page);
  await page.click('#closeBtn'); await page.waitForSelector('#fcCard [data-fcone]');
  await page.click('#fcCard [data-fcone]');
  await page.waitForFunction(() => !document.querySelector('#app').hidden && window.__gs.fcRun().st === 'run');
  // a tab that counts scores (one not updated yet, or a row from before papers marked were counted) sees 20 more papers today
  await page.evaluate(() => { const G = window.__gs, K = G.kept(); K.set('other-tab', { id: 'other-tab', name: 'Made-up quiz', n: 25, scored: 20 }); G.fcTick(); });
  await pause(1500);
  assert.equal(await runState(page), 'run', 'the session goes on');
  assert.equal(await page.evaluate(() => window.__gs.fcRun().pg), 0);
  // a paper marked here ends it, with one paper
  await score(page, [2, 2, 2]); await settle(page);
  await page.waitForFunction(() => window.__gs.fcRun().st === 'up');
  assert.equal(await page.evaluate(() => window.__gs.fcRun().got), 1);
  await close();
});

test('a paper scored just before Close counts once, and the next session starts from nothing', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  await openZip(page, zip); await settle(page);
  await page.evaluate(() => window.__gs.fcStart(25, '', 0, null));
  await score(page, [4, 3, 3]);
  await page.click('#closeBtn');   // within the wait before a save
  await pause(2500);
  assert.deepEqual(await page.evaluate(() => [window.__gs.fcRun().pg, window.__gs.fcPapersToday()]), [1, 1], 'the list was read after the save, not before it');
  const id = await page.evaluate(() => [...window.__gs.kept().keys()].find(k => k.startsWith('gs.b.') && k !== 'gs.b.n1' && k !== 'gs.b.n2'));
  await page.evaluate(k => { const G = window.__gs; G.fcRunSet(null); G.fcStart(25, 'mark:' + k, 1, null); }, id);
  await pause(4000);
  assert.deepEqual(await page.evaluate(() => { const r = window.__gs.fcRun(); return [r.st, r.pg]; }), ['run', 0], 'opening it again doesn’t count that paper a second time');
  await close();
});

test('a session started in a window not updated yet is counted by papers saved, not by the day', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  await page.evaluate(() => { localStorage.setItem('gsp.focusRun', JSON.stringify({ st: 'run', len: 1500, at: Date.now(), w: '', one: 1, p0: 0, fold: false, no: 1 })); window.__gs.fcTick(); });
  assert.deepEqual(await page.evaluate(() => { const r = window.__gs.fcRun(); return [r.st, r.p0, r.pg]; }), ['run', 1e9, 0]);
  await close();
});
