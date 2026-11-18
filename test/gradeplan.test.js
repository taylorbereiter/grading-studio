// Planning your grading (src/gradeplan.js): how long papers will take at the teacher's pace, free periods on the timetable, picking
// up where she left off, "Just 3 papers" and shortest papers first, the look back at the week, and quiet while focusing. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { builtHtml, openApp, openZip, goTo, score, settle, classPage } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');
const { gradingSeed } = require('./helpers/steady');

let browser, zip;
before(async () => { builtHtml(); browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const pause = ms => new Promise(r => setTimeout(r, ms));
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return iso(d); };
const today = () => dayAgo(0);
const log = page => page.evaluate(() => JSON.parse(localStorage.getItem('gs.focus') || 'null'));
const me = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().lib.me.focus || {})));
// The made-up class with a pace behind it (5 minutes a paper on Poetry analysis), Poetry analysis half scored, and a short story due today.
function paceSeed() {
  const s = gradingSeed(), lib = JSON.parse(s.ls['gs.lib']);
  lib.classes[0].units[1].items.push({ id: 'i7', name: 'Short story', classId: 'c1', type: 'sum', due: today() });
  const focus = { day: today(), base: {}, days: { [dayAgo(1)]: { p: 6, s: 0, g: 1800, a: { i5: 1800 }, pa: { i5: 6 } } }, pace: [], last: '' };
  const idb = JSON.parse(JSON.stringify(s.idb)), meta = idb['grading-studio-keep'].stores.meta;
  for (const m of meta) if (m[0] === 'gs.b.n2') Object.assign(m[1], { scored: 3, t: Date.now() - 3 * 3600e3 });
  return { ls: { ...s.ls, 'gs.lib': JSON.stringify(lib), 'gs.focus': JSON.stringify(focus) }, idb };
}
// The same, with Poetry analysis's papers kept here to open (the Focus card offers only papers it can open).
const withPapers = s => { for (const m of s.idb['grading-studio-keep'].stores.meta) if (m[0] === 'gs.b.n2') m[1].papers = true; return s; };
// The Planner's timetable with today's two classes either side of now: one ended ten minutes ago, the next starts in forty.
// Near midnight there is no room for that, and the caller skips.
async function freeNow(page) {
  const ok = await page.evaluate(async () => {
    const d = new Date(), now = d.getHours() * 60 + d.getMinutes(); if (now < 70 || now > 23 * 60) return false;
    const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    const db = await new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onupgradeneeded = () => { r.result.createObjectStore('lessons', { keyPath: 'id' }); r.result.createObjectStore('kv'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const meets = [{ id: 'A1', name: 'Grade 9 English', color: '#1F6FB2', meets: [{ dow: d.getDay(), start: hm(now - 60), end: hm(now - 10) }] }, { id: 'B1', name: 'Grade 10 Literature', color: '#0E7C86', meets: [{ dow: d.getDay(), start: hm(now + 40), end: hm(now + 90) }] }];
    await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put({ classes: meets, daysOff: [] }, 'setup'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close(); return true;
  });
  if (ok) { await page.reload(); await page.waitForSelector('#today .trow'); }
  return ok;
}

test('how long papers will take comes from her own pace: on the assignment, in the week in To do, and under a due date', async () => {
  const { page, close } = await openApp(browser, { seed: paceSeed() });
  await page.waitForFunction(() => window.__gs.kept().size > 0);
  const due = await page.evaluate(d => window.__gs.gpDue(d, d).map(x => [x.it.id, x.left, Math.round(x.secs)]), today());
  assert.deepEqual(due, [['i7', 6, 0]], 'work not in yet counts the whole class, with no time: a set has a pace only from its own papers');
  assert.equal(await page.evaluate(() => Math.round(window.__gs.gpLeft('i5'))), 900, 'three papers left on Poetry analysis');
  // under the date in an assignment's box
  assert.equal(await page.evaluate(d => { const e = document.createElement('p'); e.innerHTML = window.__gs.gpDueHint(d); return e.textContent; }, today()), 'Also due that week: 1 set, 6 papers');
  assert.equal(await page.evaluate(d => { const e = document.createElement('p'); e.innerHTML = window.__gs.gpDueHint(d, 'i7'); return e.textContent; }, today()), 'Nothing else to grade is due that week.');
  // on the assignment's card
  await classPage(page, 'c1');
  await page.waitForSelector('#classes .tkc');
  assert.match(await page.$$eval('#classes .tkc', l => l.map(e => e.textContent).join(' | ')), /about 15 min left/);
  // the week in To do: the total, and the day it is due
  await goTo(page, '#/todo'); await page.click('[data-tdview="week"]'); await page.waitForSelector('.tdwsum');
  assert.equal(await page.$eval('.tdwsum', e => e.textContent), 'Grading due this week: 1 set, 6 papers');
  assert.match(await page.$eval('.tdday.now .tdest', e => e.textContent), /^Due: Short storyGrade 9 English · 6 papers$/);
  // with time on its own papers, the set gets a pace of its own: rough from one paper
  await page.evaluate(d => { const L = JSON.parse(localStorage.getItem('gs.focus')); L.days[d] = { a: { i7: 600 }, pa: { i7: 1 } }; localStorage.setItem('gs.focus', JSON.stringify(L)); }, dayAgo(2));
  assert.deepEqual(await page.evaluate(d => window.__gs.gpDue(d, d).map(x => [x.left, Math.round(x.secs)]), today()), [[6, 3600]]);
  assert.equal(await page.evaluate(() => window.__gs.gpPaceN('i7')), 1);
  // with no pace yet, the papers and no time
  await page.evaluate(() => { localStorage.setItem('gs.focus', JSON.stringify({ day: '', base: {}, days: {}, pace: [], last: '' })); });
  assert.deepEqual(await page.evaluate(d => window.__gs.gpDue(d, d).map(x => x.secs), today()), [0]);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a free period offers itself on the Focus card with the next papers, and starts a session that fits; Settings can stop it', async t => {
  const { page, close } = await openApp(browser, { seed: withPapers(paceSeed()) });
  if (!await freeNow(page)) { await close(); return t.skip('too close to midnight for a free period'); }
  await page.waitForSelector('#fcCard .sugwhy .free');
  assert.match(await page.$eval('#fcCard .sugwhy .free', e => e.textContent), /^Free period until \d/);
  assert.equal(await page.$eval('#fcCard .fcgo [data-fcstart]', e => e.textContent), 'Start 35 minutes', 'the suggestion takes the free period’s length');
  assert.equal(await page.$$eval('#today .trow.gpfree', r => r.length), 1, 'and a row for it between the two classes');
  await page.click('#fcCard .fcgo [data-fcstart]');
  const r = await page.evaluate(() => window.__gs.fcRun());
  assert.equal(r.st, 'run'); assert.equal(r.len, 35 * 60);
  await page.evaluate(() => window.__gs.fcRunSet(null));
  await goTo(page, '#/settings/focus'); await page.waitForSelector('#gpFree');
  await page.click('#gpFree'); await pause(200);
  assert.deepEqual(await me(page), { free: false });
  await goTo(page, '#/'); await page.waitForSelector('#fcCard .fcbody');
  assert.equal(await page.$('#fcCard .sugwhy .free'), null);
  assert.equal(await page.$eval('#fcCard .fcgo [data-fcstart]', e => e.textContent), 'Start 10 minutes');
  assert.equal(await page.$('#today .trow.gpfree'), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('“Just 3 papers” ends after three, shortest papers first goes to the shortest one left, and quiet hides the counts meanwhile', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  await page.bringToFront();
  await openZip(page, zip); await settle(page);
  await page.evaluate(() => { const L = window.__gs.state().lib; L.me = { ...(L.me || {}), focus: { short: true, quiet: true } }; });
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  // the pages each paper has: Aria 2, Bram 1 + 1, Cleo 1, Dov a short Word file and a note
  const lens = await page.evaluate(() => window.__gs.state().batch.students.map(st => window.__gs.gpLen(st)));
  assert.deepEqual(lens.slice(0, 3), [2, 2, 1]);
  await page.evaluate(k => window.__gs.fcStart(10, k, 3), 'mark:' + id);
  await page.waitForSelector('#fcPanel .fcwhat');
  assert.match(await page.$eval('#fcPanel .fcwhat', e => e.textContent), /Just 3 papers/);
  assert.equal(await page.evaluate(() => document.body.classList.contains('fcquiet')), true, 'counts hidden while it runs');
  assert.equal(await page.evaluate(() => window.__gs.state().cur), 0);
  await score(page, [4, 3, 3]); await settle(page);
  await page.click('#fcPanel [data-fcnext]');
  await page.waitForFunction(() => window.__gs.state().cur !== 0);
  assert.equal(await page.evaluate(() => window.__gs.state().cur), 2, 'Cleo’s one page comes before Bram’s two');
  await score(page, [3, 3, 3]); await settle(page);
  await page.click('#fcPanel [data-fcnext]'); await page.waitForFunction(() => window.__gs.state().cur !== 2);
  await score(page, [2, 3, 2]); await settle(page);
  await page.evaluate(() => window.__gs.fcTick());
  await page.waitForFunction(() => window.__gs.fcRun() && window.__gs.fcRun().st === 'up');
  assert.match(await page.$eval('#fcPanel', e => e.textContent), /3 papers done/);
  assert.equal(await page.evaluate(() => document.body.classList.contains('fcquiet')), false, 'and back once it is over');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the look back at the week shows on the day she picks, says what happened and what waits, and can be put away for the week', async () => {
  const s = paceSeed(), lib = JSON.parse(s.ls['gs.lib']);
  lib.me = { focus: { wk: new Date().getDay() } };
  const seed = { ...s, ls: { ...s.ls, 'gs.lib': JSON.stringify(lib) } };
  const idb = seed.idb['grading-studio-keep'].stores.meta; for (const m of idb) if (m[0] === 'gs.b.n2') m[1].papers = true;
  const { page, close } = await openApp(browser, { seed });
  await page.waitForSelector('#lbCard .lbk');
  const txt = await page.$eval('#lbCard', e => e.innerText.replace(/\s+/g, ' '));
  assert.match(txt, /A look back at the week/);
  assert.match(txt, /Still waiting Poetry analysis, Grade 9 English · 3 papers left · about 15 min/);
  // and on the Focus card, the set she was on, a few hours ago
  assert.equal(await page.$eval('#fcCard .sugh .t', e => e.textContent), 'Poetry analysis · Grade 9 English');
  assert.match(await page.$eval('#fcCard .sugwhy', e => e.textContent), /^You left off here: \S/);
  assert.equal(await page.$eval('#fcCard .fcsay', e => e.textContent), '3 papers left · about 15 minutes at your pace');
  await page.click('[data-gplbhide]'); await page.waitForFunction(() => document.querySelector('#lbCard').hidden);
  const L = await log(page), mon = await page.evaluate(() => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  assert.equal(L.lbHid, mon);
  // Settings: the day, or none
  await goTo(page, '#/settings/focus'); await page.waitForSelector('#gpWk');
  await page.click('#gpWk'); await pause(200);
  assert.equal((await me(page)).wk, false);
  await page.click('#gpWk'); await page.select('#gpWkDay', '1'); await pause(200);
  assert.equal((await me(page)).wk, 1);
  assert.deepEqual(page.errors, []);
  await close();
});

// The Planner's database, written as the Planner leaves it: its setup and its lessons.
const planPut = (page, setup, lessons) => page.evaluate(async (setup, lessons) => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onupgradeneeded = () => { r.result.createObjectStore('lessons', { keyPath: 'id' }); r.result.createObjectStore('kv'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise((res, rej) => { const tx = db.transaction(['kv', 'lessons'], 'readwrite'); tx.objectStore('kv').put(setup, 'setup'); const o = tx.objectStore('lessons'); o.clear(); for (const l of lessons) o.put(l); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  db.close();
}, setup, lessons);
const monNext = () => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7 + 7); return d; };
const nextDay = n => { const d = monNext(); d.setDate(d.getDate() + n); return iso(d); };

test('next week’s lessons on the Focus card: a dot for each class meeting, filled when ready, lighter when planned; days off and the semester count', async () => {
  const { page, close } = await openApp(browser, {});
  assert.equal(await page.evaluate(() => window.__gs.gpPlanWeek()), null, 'no timetable, nothing to count');
  assert.equal(await page.$('#fcCard .gpwk'), null);
  // two made-up classes: one Monday, Wednesday and Friday, one Tuesday and Thursday; next Wednesday is a day off
  const setup = { classes: [{ id: 'A1', name: 'Course A', color: '#1F6FB2', meets: [1, 3, 5].map(dow => ({ dow, start: '09:00', end: '09:50' })) }, { id: 'B1', name: 'Course B', color: '#0E7C86', meets: [2, 4].map(dow => ({ dow, start: '10:00', end: '10:50' })) }],
    daysOff: [{ date: nextDay(2), label: 'Made-up holiday' }] };
  const les = (id, classId, date, more) => ({ id, title: 'Lesson ' + id, slots: [{ classId, date }], slides: [{}], updated: 1, ...more });
  await planPut(page, setup, [les('L1', 'A1', nextDay(0), { ready: { at: Date.now() } }), les('L2', 'B1', nextDay(1)), les('L3', 'A1', nextDay(4), { final: { id: 'f', name: 'Deck.pptx' } })]);
  await page.reload(); await page.waitForSelector('#fcCard .gpwk');
  const w = await page.evaluate(() => window.__gs.gpPlanWeek());
  assert.deepEqual([w.of, w.planned, w.ready, w.dots], [4, 3, 2, [2, 1, 0, 2]], 'Monday ready, Tuesday planned, Thursday not, Friday finished');
  assert.equal(await page.$eval('#fcCard .gpwk .fcgh', e => e.textContent), 'Next week3 / 4lessons planned');
  assert.deepEqual(await page.$$eval('#fcCard .gpwk .fcdots i', l => l.map(i => i.className)), ['fon', 'fpl', '', 'fon']);
  assert.equal(await page.$$eval('#fcCard .btn.primary', b => b.length), 1, 'still one blue button on the card');
  // every meeting planned: the tick
  await planPut(page, setup, [les('L1', 'A1', nextDay(0)), les('L2', 'B1', nextDay(1)), les('L4', 'B1', nextDay(3)), les('L3', 'A1', nextDay(4))]);
  await page.reload(); await page.waitForSelector('#fcCard .gpwk.met .fcmet');
  // the semester ends this week: nothing to plan next week, and no row
  const mon = new Date(monNext()); mon.setDate(mon.getDate() - 7);
  await planPut(page, { ...setup, semStart: '2026-01-05', semEnd: iso(mon) }, []);
  await page.reload(); await page.waitForSelector('#fcCard .fcbody');
  assert.equal((await page.evaluate(() => window.__gs.gpPlanWeek())).of, 0);
  assert.equal(await page.$('#fcCard .gpwk'), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a free period with no papers to mark suggests the next lesson to plan, at a length that fits; papers left keep the suggestion on marking, and a hand pick stays', async t => {
  const { page, close } = await openApp(browser, {});
  if (!await freeNow(page)) { await close(); return t.skip('too close to midnight for a free period'); }
  await page.waitForSelector('#fcCard .sugwhy .free');
  // Grade 10 Literature meets in forty minutes with nothing planned: it is the suggestion, at the free period's 35 minutes, not the lesson's 45
  assert.equal(await page.$eval('#fcCard .sugh .t', e => e.textContent), 'Grade 10 Literature · ' + await page.evaluate(() => new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })));
  assert.equal(await page.$eval('#fcCard .fcsay', e => e.textContent), 'A new lesson to plan');
  assert.equal(await page.$eval('#fcCard .fcgo [data-fcstart]', e => e.textContent), 'Start 35 minutes');
  // picked by hand, the pick stays
  await page.click('#fcCard [data-fcchg]'); await page.select('#fcCard [data-fcwork]', '');
  assert.equal(await page.$eval('#fcCard .sugh .t', e => e.textContent), 'Nothing in particular');
  // the lesson starts as a lesson session
  await page.click('#fcCard [data-fcchg]'); await page.select('#fcCard [data-fcwork]', 'les:+B1|' + today());
  const errs = [...page.errors];
  await Promise.all([page.waitForNavigation(), page.click('#fcCard .fcgo [data-fcstart]')]);
  const r = await page.evaluate(() => JSON.parse(localStorage.getItem('gsp.focusRun')));
  assert.equal(r.k, 'l'); assert.equal(r.len, 35 * 60); assert.deepEqual(r.nw, { c: 'B1', d: today() });
  assert.deepEqual(errs, []);
  await close();
  // with papers left to mark, the free period goes to the papers
  const o = await openApp(browser, { seed: withPapers(paceSeed()) });
  if (!await freeNow(o.page)) { await o.close(); return; }
  await o.page.waitForSelector('#fcCard .sugwhy .free');
  assert.equal(await o.page.$eval('#fcCard .sugh .t', e => e.textContent), 'Poetry analysis · Grade 9 English');
  assert.deepEqual(o.page.errors, []);
  await o.close();
});
