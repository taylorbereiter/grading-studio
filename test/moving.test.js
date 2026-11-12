// Moving to a new web address. Saved work belongs to the address, so the take-home file has to carry everything, the Planner
// included, and the copy at the address being left has to say so. Every student, class and lesson here is made up.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { ROOT, openOwn, closeOwn, goTo, closeBox } = require('./helpers/app');
const { takeHome, openFile, bringIt } = require('./helpers/carry');

after(closeOwn);

// A Planner with two lessons, a unit, a timetable and a handout, written the way the Planner page keeps them.
const plannerWork = page => page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('gs-lessons', 1); r.onupgradeneeded = () => { r.result.createObjectStore('lessons', { keyPath: 'id' }); r.result.createObjectStore('kv'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise(res => {
    const tx = db.transaction(['lessons', 'kv'], 'readwrite'), L = tx.objectStore('lessons'), K = tx.objectStore('kv');
    const slide = { id: 's1', layout: 'title', title: 'Hello' };
    L.put({ id: 'l1', title: 'Annotating a story', slots: [{ classId: 'A1', date: '2026-09-07' }], slides: [slide], created: 1, updated: 1 });
    L.put({ id: 'l2', title: 'A lesson to reuse', slots: [], slides: [slide], created: 1, updated: 1 });
    K.put([{ id: 'u1', course: 'Grade 9', title: 'Stories', start: '2026-08-31', weeks: [], files: [] }], 'units');
    K.put({ kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-08-31', semEnd: '2027-01-18', classes: [{ id: 'A1', name: 'Grade 9 English', course: 'Grade 9', color: '#1F6FB2', meets: [] }], daysOff: [], events: [] }, 'setup');
    K.put(new File(['made-up handout'], 'Handout.txt', { type: 'text/plain' }), 'file:f1');
    tx.oncomplete = res;
  });
  db.close();
  localStorage.setItem('gsp.view', 'units'); localStorage.setItem('gsp.presentTimer', '{"end":1}');
});
// What the Planner's store holds now, or null when this browser has never had one.
const plannerNow = page => page.evaluate(async () => {
  if (!(await indexedDB.databases()).some(d => d.name === 'gs-lessons')) return null;
  const db = await new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = (s, f) => new Promise(res => { const q = db.transaction(s).objectStore(s)[f](); q.onsuccess = () => res(q.result); });
  const lessons = (await all('lessons', 'getAll')).map(l => [l.id, l.title]).sort(), keys = (await all('kv', 'getAllKeys')).sort(), vals = await all('kv', 'getAll');
  const get = k => new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); });
  const f = await get('file:f1'), units = await get('units'), setup = await get('setup');
  db.close();
  return { lessons, keys, n: vals.length, file: f ? { text: await f.text(), type: f.type, name: f.name || '' } : null, units: (units || []).map(u => u.title), sem: setup ? setup.semStart : null, view: localStorage.getItem('gsp.view'), timer: localStorage.getItem('gsp.presentTimer') };
});

test('the take-home file carries the Planner to a browser with none, and a Planner in use keeps what it has', async () => {
  const a = await openOwn(), b = await openOwn();
  await plannerWork(a.page);
  const bytes = await takeHome(a.page);
  assert.equal(await plannerNow(b.page), null, 'the other browser starts with no Planner');
  let { preview } = await openFile(b.page, bytes);
  assert.match(preview, /Your Planner comes in: 2 lessons, with its units, timetable and files/);
  await bringIt(b.page);
  let P = await plannerNow(b.page);
  assert.deepEqual(P.lessons, [['l1', 'Annotating a story'], ['l2', 'A lesson to reuse']]);
  assert.deepEqual(P.keys, ['file:f1', 'setup', 'units']);
  assert.deepEqual(P.file, { text: 'made-up handout', type: 'text/plain', name: 'Handout.txt' }, 'a file comes across whole, with its name and kind');
  assert.deepEqual(P.units, ['Stories']); assert.equal(P.sem, '2026-08-31');
  assert.equal(P.view, 'units', 'the Planner’s own settings come too');
  assert.equal(P.timer, null, 'a running timer belongs to the browser it was started in');
  // The same file again: nothing to bring in.
  ({ preview } = await openFile(b.page, bytes));
  assert.match(preview, /Nothing to bring in/);
  await closeBox(b.page);
  // The Planner here is in use now: a lesson changed, one deleted, the units changed. Only what it lacks comes in.
  await b.page.evaluate(async () => {
    const db = await new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => res(r.result); });
    await new Promise(res => { const tx = db.transaction(['lessons', 'kv'], 'readwrite'); tx.objectStore('lessons').put({ id: 'l1', title: 'Changed here', slots: [], slides: [], created: 1, updated: 9 }); tx.objectStore('lessons').delete('l2'); tx.objectStore('kv').put([{ id: 'u9', course: 'Grade 9', title: 'Poems', start: '2026-10-05', weeks: [], files: [] }], 'units'); tx.objectStore('kv').delete('file:f1'); tx.oncomplete = res; });
    db.close();
  });
  ({ preview } = await openFile(b.page, bytes));
  assert.match(preview, /1 lesson you don’t have here/);
  assert.match(preview, /1 file or setting the Planner here doesn’t have/);
  assert.match(preview, /already in the Planner here stay as they are/);
  await bringIt(b.page);
  P = await plannerNow(b.page);
  assert.deepEqual(P.lessons, [['l1', 'Changed here'], ['l2', 'A lesson to reuse']], 'the lesson changed here is not replaced');
  assert.deepEqual(P.units, ['Poems'], 'nor are the units');
  assert.equal(P.file.text, 'made-up handout');
  // A year's archive never touches the Planner: it moved itself on when that year ended.
  assert.equal(await b.page.evaluate(async () => (await window.__gs.planBringPlan({ info: { kind: 'year' }, plan: [{ f: { k: 'plan', s: 'lessons', key: 'zz', v: { id: 'zz' } } }] })).n), 0);
  assert.deepEqual(a.page.errors, []); assert.deepEqual(b.page.errors, []);
  await a.close(); await b.close();
});

test('the address being left says where the app is going and how to take work along; any other address says nothing', async () => {
  const { page, close } = await openOwn();
  await goTo(page, '#/settings');
  assert.equal(await page.evaluate(() => window.__gs.movingTo()), '', 'no move is on');
  assert.equal(await page.$('#setMoving'), null);
  await page.evaluate(() => window.__gs.moveTest('https://example.org/grading/'));
  await page.waitForSelector('#moveBox');
  assert.match(await page.$eval('#moveBox', e => e.innerText), /https:\/\/example\.org\/grading\/[\s\S]*Take my work with me[\s\S]*Bring work in/);
  assert.equal(await page.$eval('#dlgBox a.btn', a => a.href), 'https://example.org/grading/');
  await closeBox(page);
  assert.match(await page.$eval('#setMoving', e => e.innerText), /moving to a new address[\s\S]*https:\/\/example\.org\/grading\//);
  assert.equal(await page.$eval('#setMoving', e => e.hidden), false, 'it heads Saving and carrying');
  // Asking again (the test clears today's mark) shows it again, and today is marked.
  await page.evaluate(() => { const to = window.__gs.movingTo(); window.__gs.moveTest(to); });
  await page.waitForSelector('#moveBox'); await closeBox(page);
  assert.ok(await page.evaluate(() => localStorage.getItem('gsc.moveSeen')), 'today is remembered, outside the work that travels');
  assert.equal(await page.evaluate(() => 'gsc.moveSeen' in window.__gs.carryLs()), false);
  // The file made here points at the new address.
  await page.evaluate(async () => window.__gs.takeUse(await (await navigator.storage.getDirectory()).getFileHandle('move.gswork', { create: true })));
  await page.click('#setMoving [data-movetake]');
  await page.waitForSelector('#takeP1');
  for (const s of ['#takeP1', '#takeP2']) await page.$eval(s, e => { e.value = 'paper lantern orchard'; });
  await page.click('#takeGo');
  await page.waitForSelector('#takeDone', { timeout: 120000 });
  assert.match(await page.$eval('#takeDone', e => e.textContent), /^Done.*Now open the new address, https:\/\/example\.org\/grading\/, and use Bring work in/);
  await closeBox(page);
  // The same address named as where it lives and where it is going is no move at all.
  await page.evaluate(() => window.__gs.moveTest(location.href));
  assert.equal(await page.$('#setMoving'), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('site.json is the one place that names the address, and the app has none written into it', () => {
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.json'), 'utf8'));
  assert.match(site.address, /^https:\/\/[^/]+\/.*\/$/);
  assert.equal(typeof site.movingTo, 'string');
  const host = new URL(site.address).host, owner = host.split('.')[0];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of walk(path.join(ROOT, 'src')).filter(f => /\.(js|html|css|json)$/.test(f))) {
    const t = fs.readFileSync(f, 'utf8');
    assert.ok(!t.includes(host) && !t.includes(owner + '/'), path.relative(ROOT, f) + ' names the address or its owner');
  }
});
