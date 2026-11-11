// A new school year: this year to a checked file, then the same classes with empty class lists, and the year opened back
// from its file. Every student, class and lesson here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('./helpers/chrome');
const { ROOT, builtHtml, openApp, openZip, goTo, appReady, pickFile, settle, score, closeBox, waitPaper } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');
const { gradingSeed } = require('./helpers/steady');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

function serveBoth() {
  builtHtml();
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0], file = p === '/' || p === '/index.html' ? 'index.html' : p === '/planner.html' ? 'planner.html' : null;
    if (!file && p !== '/blank') { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(file ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '<!doctype html><title>blank</title>');
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
const PASS = 'paper lantern orchard';
const has = (bytes, text) => Buffer.from(bytes).includes(Buffer.from(text));
// The made-up year: the steady seed, with a quiz on one download, a record by student name on a class and in a key of its own
// (as attendance or seating might be kept), a saved comment, and a Planner with a unit, a semester and two lessons on classes.
function seed() {
  const s = gradingSeed(), lib = JSON.parse(s.ls['gs.lib']);
  lib.classes[0].info = { 'Aria Testwell': { id: '20001', note: 'Made-up note' } };
  lib.classes[0].att = { '2026-09-01': { t: 1, m: { 'Aria Testwell': 'l', 'Bram Sample': 'e' }, n: { 'Aria Testwell': 'Bus' } }, '2026-09-02': { t: 2 } };   // attendance (attend.js)
  lib.goals = [{ id: 'g1', name: 'Argue a claim', at: 1 }];
  lib.classes[0].seats = { w: 3, h: 2, desks: { '0,0': 'Aria Testwell', '1,0': 'Bram Sample', '2,0': '' }, pins: ['Aria Testwell'] };   // seating (seating.js)   // learning goals (goals.js)
  lib.classes[0].link = 'https://example.org/class/9';
  s.ls['gs.lib'] = JSON.stringify(lib);
  const w = JSON.parse(s.ls['gs.b.n1']);
  w.goal = 'g1';
  w.s['Aria Testwell'].g.tries = [{ rubric: [2, 2, 2], points: '', comment: 'First try', at: 1 }];   // a retake (grades.js)
  w.quiz = { qs: [{ id: 'q1', lab: '1', n: 0, x: 0.1, y: 0.1, w: 0.3, h: 0.1, pts: 2, key: 'B' }], how: 'cx', side: 'left', total: null, shift: { 'Aria Testwell': { 0: [0.01, 0] } } };
  s.ls['gs.b.n1'] = JSON.stringify(w);
  s.ls['gs.seatsTry'] = JSON.stringify({ rows: [['Aria Testwell', 'Bram Sample']] });
  s.ls['gs.bank'] = JSON.stringify(['Check your citations.']);
  return s;
}
async function plannerWork(page) {
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('gs-lessons', 1); r.onupgradeneeded = () => { r.result.createObjectStore('lessons', { keyPath: 'id' }); r.result.createObjectStore('kv'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise(res => {
      const tx = db.transaction(['lessons', 'kv'], 'readwrite'), L = tx.objectStore('lessons'), K = tx.objectStore('kv');
      const slide = { id: 's1', layout: 'title', title: 'Hello' };
      L.put({ id: 'l1', title: 'Annotating a story', slots: [{ classId: 'A1', date: '2026-09-07' }], slides: [slide], created: 1, updated: 1, taught: [{ classId: 'A1', date: '2026-09-07', slide: 1, of: 1 }] });
      L.put({ id: 'l2', title: 'A lesson to reuse', slots: [], slides: [slide], created: 1, updated: 1, library: 'Shared' });
      K.put([{ id: 'u1', course: 'Grade 9', title: 'Stories', start: '2026-08-31', weeks: [{ focus: 'Plot', notes: '', standards: '' }], files: [] }], 'units');
      K.put({ kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-08-31', semEnd: '2027-01-18', classes: [{ id: 'A1', name: 'Grade 9 English', course: 'Grade 9', color: '#1F6FB2', meets: [] }], daysOff: [{ date: '2026-10-09', label: 'No school' }], events: [] }, 'setup');
      K.put(new Blob(['made-up handout'], { type: 'text/plain' }), 'file:f1');
      tx.oncomplete = res;
    });
    db.close();
  });
}
const fileBytes = async (page, name) => new Uint8Array(Buffer.from(await page.evaluate(async n => {
  const f = await (await (await navigator.storage.getDirectory()).getFileHandle(n)).getFile();
  const u = new Uint8Array(await f.arrayBuffer()); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}, name), 'base64'));
const useFile = (page, name) => page.evaluate(async n => window.__gs.takeUse(await (await navigator.storage.getDirectory()).getFileHandle(n, { create: true })), name);

test('a new year: this year goes to a checked file, the classes carry on empty, and the year opens back from its file', async () => {
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    const { page, close } = await openApp(browser, { server: srv, context: ctx, seed: seed() });
    await plannerWork(page);
    await openZip(page, zip, 'River essay.zip');   // a download with its papers, and a score on it
    await score(page, [3, 3, 3]);
    await settle(page);
    await goTo(page, '#/settings');
    const before = await page.evaluate(() => ({ kept: window.__gs.kept().size, lib: localStorage.getItem('gs.lib') }));
    assert.equal(before.kept, 3);
    assert.match(await page.$eval('#yearLine', e => e.textContent), /This year: 2026–27/);

    // the box: names guessed from the term dates, and a passphrase asked for
    await useFile(page, 'year-a.gswork');
    await page.click('#yearBtn');
    await page.waitForSelector('#nyGo');
    assert.equal(await page.$eval('#nyFrom', e => e.value), '2026–27');
    assert.equal(await page.$eval('#nyTo', e => e.value), '2027–28');
    assert.ok(await page.$('#nyPlan'), 'the Planner choice shows when there is Planner work');
    await page.$eval('#takeP1', (e, p) => { e.value = p; }, PASS);
    await page.$eval('#takeP2', e => { e.value = 'something else'; });
    await page.click('#nyGo');
    assert.match(await page.$eval('#takeErr', e => e.textContent), /don’t match/);
    assert.equal(await page.evaluate(() => window.__gs.kept().size), 3, 'nothing happens before the file');
    await page.$eval('#takeP2', (e, p) => { e.value = p; }, PASS);
    await page.click('#nyGo');
    await page.waitForSelector('#nyDone', { timeout: 120000 });
    const done = await page.$eval('#nyDone', e => e.textContent);
    assert.match(done, /Everything from 2026–27 is in year-a\.gswork/);
    assert.match(done, /checked/);
    await closeBox(page);

    // the file: protected, with every download, the papers, and the Planner
    const bytes = await fileBytes(page, 'year-a.gswork');
    assert.equal(new TextDecoder().decode(bytes.subarray(0, 8)), 'GSWORK1\n');
    for (const t of ['Aria Testwell', 'Narrative essay', 'Annotating a story', 'made-up handout', '%PDF']) assert.ok(!has(bytes, t), t + ' is not readable in the file');

    // the new year: the same classes, units and cards, with nothing about a student left
    const now = await page.evaluate(() => {
      const l = window.__gs.state().lib, c = l.classes[0];
      return { kept: window.__gs.kept().size, year: l.year, years: l.years.map(y => [y.name, y.file]), names: l.classes.map(c => c.names.length), info: 'info' in c, att: 'att' in c, link: c.link,
        units: c.units.map(u => u.name), cards: c.units.flatMap(u => u.items.map(i => [i.name, i.due, !!i.batchId, i.typed ? Object.keys(i.typed.s).length : null])),
        quiz: c.units[0].items[2].quiz, goal: c.units[0].items[2].goal, goals: l.goals, chart: c.seats, rolls: localStorage.getItem('gs.rolls'), setup: c.units[0].items[2].setup && c.units[0].items[2].setup.criteria, terms: l.book.terms.map(t => [t.start, t.end]), dl: 'dl' in l.book,
        bank: localStorage.getItem('gs.bank'), seats: localStorage.getItem('gs.seatsTry'), move: JSON.parse(localStorage.getItem('gsp.newYear')), work: Object.keys(localStorage).filter(k => k.startsWith('gs.b.')) };
    });
    assert.equal(now.kept, 0);
    assert.equal(now.year, '2027–28');
    assert.deepEqual(now.years, [['2026–27', 'year-a.gswork']]);
    assert.deepEqual(now.names, [0, 0]);
    assert.equal(now.info, false); assert.equal(now.att, false, 'a record by student name goes, whatever it is called');
    assert.equal(now.link, 'https://example.org/class/9', 'the class keeps its own settings');
    assert.deepEqual(now.units, ['Unit 1: Stories', 'Unit 2: Poetry']);
    assert.deepEqual(now.cards, [['Reading check 1', '2027-09-01', false, 0], ['Story map', '2027-09-05', false, 0], ['Narrative essay', '2027-09-19', false, null], ['Vocabulary quiz', '2027-09-30', false, 0], ['Poetry analysis', '2027-10-20', false, null], ['Timed paragraph', '2027-10-29', false, 0]]);
    assert.deepEqual(now.quiz.qs.map(q => [q.id, q.pts, q.key]), [['q1', 2, 'B']], 'the quiz boxes go on the card');
    assert.equal(now.quiz.shift, undefined, 'without any one student’s nudges');
    assert.deepEqual(now.setup, ['Ideas', 'Organization', 'Language'], 'the rubric goes on the card');
    assert.equal(now.goal, 'g1', 'and the whole score’s learning goal');
    assert.deepEqual(now.chart, { w: 3, h: 2, desks: { '0,0': '', '1,0': '', '2,0': '' }, pins: [] }, 'the room carries, with every desk empty');
    assert.doesNotMatch(now.rolls || '', /Aria Testwell|Bram Sample/, 'the Planner’s name picker has nobody from last year');
    assert.deepEqual(now.goals, [{ id: 'g1', name: 'Argue a claim', at: 1 }], 'the teacher’s learning goals stay');
    assert.deepEqual(now.terms, [['2027-08-10', '2027-12-18']]);
    assert.equal(now.dl, false);
    assert.equal(now.bank, '["Check your citations."]', 'the comment bank stays');
    assert.equal(now.seats, null, 'a key of its own about students goes');
    assert.equal(now.move.from, '2026–27');
    assert.deepEqual(now.work, []);
    assert.doesNotMatch(await page.evaluate(() => localStorage.getItem('gs.lib')), /Aria Testwell|Bram Sample|Made-up note/);
    assert.match(await page.$eval('#yearLine', e => e.textContent), /This year: 2027–28\. Archived: 2026–27 in year-a\.gswork/);

    // the Planner moves on when it opens: units and semester a year on, the year's lessons in Past lessons
    const pl = await ctx.newPage(); pl.errors = []; pl.on('pageerror', e => pl.errors.push(String(e)));
    await pl.goto(srv.url + 'planner.html');
    await pl.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
    await pl.waitForFunction(() => window.__planner.L.lessons.every(l => !l.slots.length));
    const P = await pl.evaluate(() => { const L = window.__planner.L; return { lessons: L.lessons.map(l => [l.id, l.library || '', l.slots.length, !!l.taught]).sort(), units: L.units.map(u => u.start), sem: [L.setup.semStart, L.setup.semEnd], off: L.setup.daysOff.length }; });
    assert.deepEqual(P.lessons, [['l1', '2026–27', 0, false], ['l2', 'Shared', 0, false]]);
    assert.deepEqual(P.units, ['2027-08-30']);
    assert.deepEqual(P.sem, ['2027-08-30', '2028-01-17']);
    assert.equal(P.off, 0);
    await pl.reload(); await pl.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
    assert.deepEqual(await pl.evaluate(() => window.__planner.L.units.map(u => u.start)), ['2027-08-30'], 'only once');
    assert.deepEqual(pl.errors, []);
    await pl.close();

    // a new download on last year's card starts with its quiz
    const entries = Object.entries(await standardFiles()).map(([p, d]) => ({ path: p, data: [...d] }));
    await page.evaluate(list => { const it = window.__gs.state().lib.classes[0].units[0].items[2]; return window.__gs.intake(list.map(e => ({ path: e.path, data: new Uint8Array(e.data) })), 'Narrative essay', it); }, entries);
    await waitPaper(page);
    assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.quiz.qs.map(q => q.id)), ['q1']);
    assert.equal(await page.evaluate(() => window.__gs.state().batch.goal), 'g1');
    await settle(page);
    await page.click('#closeBtn');
    // opening the old year back: a wrong passphrase changes nothing
    await goTo(page, '#/settings');
    await useFile(page, 'year-b.gswork');
    let clean = await pickFile(page, '#yearIn', bytes, 'year-a.gswork');
    await page.waitForSelector('#takeP1');
    await page.$eval('#takeP1', e => { e.value = 'not the passphrase'; });
    await page.click('#takeGo');
    await page.waitForFunction(() => document.querySelector('#takeErr') && !document.querySelector('#takeErr').hidden && document.querySelector('#takeP1'), { timeout: 60000 });
    await page.$eval('#takeP1', (e, p) => { e.value = p; }, PASS);
    await page.click('#takeGo');
    await page.waitForSelector('#nyOpenGo', { timeout: 60000 }).catch(async e => { console.log(await page.$eval('#dlgBox', x => x.textContent).catch(() => '')); throw e; });
    assert.match(await page.$eval('#dlgBox', e => e.textContent), /Open 2026–27[\s\S]*3 sets of papers[\s\S]*2027–28 is saved to its own file/);
    const nav = page.waitForNavigation({ timeout: 120000 });
    await page.click('#nyOpenGo');
    await nav; await appReady(page); clean();
    await page.waitForFunction(() => window.__gs.kept().size === 3);
    const back = await page.evaluate(() => ({ lib: localStorage.getItem('gs.lib'), seats: localStorage.getItem('gs.seatsTry') }));
    const was = JSON.parse(before.lib), got = JSON.parse(back.lib);
    assert.deepEqual(got.classes, was.classes, 'the classes, class lists and cards as they were');
    assert.equal(got.year, '2026–27');
    assert.deepEqual(got.years.map(y => [y.name, y.file]), [['2027–28', 'year-b.gswork']], 'and the year just left is listed with its file');
    assert.ok(back.seats);
    assert.deepEqual(got.classes[0].att['2026-09-02'], { t: 2 }, 'attendance comes back with the year');
    assert.equal(got.classes[0].seats.desks['0,0'], 'Aria Testwell', 'and the seating chart');
    const tries = await page.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => { const q = r.result.transaction('work').objectStore('work').get('gs.b.n1'); q.onsuccess = () => { const w = q.result; res(w && w.s['Aria Testwell'].g.tries); r.result.close(); }; }; }));
    assert.deepEqual(tries, [{ rubric: [2, 2, 2], points: '', comment: 'First try', at: 1 }], 'and a retake’s first try');
    // the year just left is in its own file, and starting it again from there works the same way
    const b2 = await fileBytes(page, 'year-b.gswork');
    assert.ok(b2.length > 1000 && !has(b2, 'Narrative essay'));
    assert.deepEqual(page.errors, []);
    await close();
  } finally { await ctx.close().catch(() => {}); await srv.close(); }
});

test('nothing is cleared when the file does not check out', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await goTo(page, '#/settings');
  await useFile(page, 'year-c.gswork');
  // the file is cut short as it is read back: the check fails
  await page.evaluate(() => { const real = File.prototype.slice; window.__cut = true; File.prototype.slice = function (a, b) { return real.call(this, a, Math.min(b == null ? this.size : b, this.size - 40)); }; });
  await page.click('#yearBtn');
  await page.waitForSelector('#nyGo');
  await page.$eval('#takeP1', (e, p) => { e.value = p; }, PASS);
  await page.$eval('#takeP2', (e, p) => { e.value = p; }, PASS);
  await page.click('#nyGo');
  await page.waitForSelector('#nyDone', { timeout: 120000 });
  assert.match(await page.$eval('#nyDone', e => e.textContent), /Nothing here was cleared|nothing here was cleared/);
  const st = await page.evaluate(() => ({ names: window.__gs.state().lib.classes[0].names.length, kept: window.__gs.kept().size, year: window.__gs.state().lib.year || null }));
  assert.deepEqual(st, { names: 6, kept: 2, year: null });
  await close();
});

test('the new year’s library works from the saved data, not a list of fields', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  const r = await page.evaluate(() => {
    const G = window.__gs, old = { classes: [{ id: 'c', name: 'Made-up class', names: ['Kai Pretend', 'Lu Invented'], color: '#123456', goals: ['Argue a claim'], units: [{ id: 'u', name: 'U', items: [{ id: 'i', name: 'Essay', due: '2028-02-29', retake: { 'Kai Pretend': { n: 2 } }, goals: ['Argue a claim'], setup: { mode: 'points', outOf: 10 } }] }],
      seats: [['Lu Invented', null]], att: { '2028-01-05': { t: 1 } } }], loose: { id: '', units: [] }, book: { terms: [] }, someday: { 'Kai Pretend': 1 }, me: { sys: '' } };
    const a = G.nyLib(old, {}, { from: '2027–28', to: '2028–29', dates: true, roster: false, file: 'f.gswork' });
    const b = G.nyLib(old, {}, { from: '2027–28', to: '2028–29', dates: false, roster: true, file: 'f.gswork' });
    return { a, b, next: [G.nyNext('2025–26'), G.nyNext('2025-2026'), G.nyNext('2025'), G.nyNext('Year 7')] };
  });
  const c = r.a.classes[0], it = c.units[0].items[0];
  assert.deepEqual(c.names, []); assert.equal(c.color, '#123456'); assert.deepEqual(c.goals, ['Argue a claim']);
  assert.equal('seats' in c, false);
  assert.equal('att' in c, false, 'attendance never carries, even a day with nobody in it');
  assert.equal('att' in r.b.classes[0], false, 'nor when the class lists stay');
  assert.equal('retake' in it, false); assert.deepEqual(it.goals, ['Argue a claim']); assert.equal(it.due, '2029-02-28');
  assert.equal('someday' in r.a, false); assert.deepEqual(r.a.me, { sys: '' });
  assert.deepEqual(r.b.classes[0].names, ['Kai Pretend', 'Lu Invented'], 'kept class lists');
  assert.equal(r.b.classes[0].units[0].items[0].due, '2028-02-29', 'dates left alone');
  assert.equal('retake' in r.b.classes[0].units[0].items[0], false, 'a year’s records about students go even when the class list stays');
  assert.deepEqual(r.next, ['2026–27', '2026–27', '2026', '']);
  await close();
});
