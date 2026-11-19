// The Planner folder in the new app (stage 6: inventory rows 193, 194, 492, 500): linked from Settings > Working with AI, the
// planning work written there as the current Planner writes it (README for the assistant, the folder's mark, timetable.json, each
// lesson, Units/, activities.json, Rubrics/), and what the assistant adds or changes there coming back in: a new lesson marked not
// reviewed, a changed one kept under Versions with Back to your version, a unit's weeks, a new rubric. A folder with grading files
// in it is refused. The folder is the browser's own private folder (OPFS) handed to the app as if chosen, so nothing on the
// computer is touched. All of the work is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { plantPlan } = require('./planseed.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/next/') p = '/next/index.html';
    const ok = /^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p);
    const f = path.join(ROOT, p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

const until = async (f, ms = 15000) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t0 > ms) return v; await new Promise(r => setTimeout(r, 100)); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
// "Link the Planner folder" gets a folder called Lessons in the browser's private folder (or Mixed, which holds grading files).
const chooser = async (p, name) => { await p.setBypassServiceWorker(true); await p.evaluateOnNewDocument(n => { window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(localStorage.getItem('test.pick') || n, { create: true }); }, name); };
// A private browser context dies reading a stored folder back (headless Chrome), so each test uses the main one, emptied first.
const clean = p => p.evaluate(async () => {
  localStorage.clear();
  for (const d of await indexedDB.databases()) await new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r; });
  const root = await navigator.storage.getDirectory(); for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
});
async function open() {
  const p = await browser.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY); await chooser(p, 'Lessons'); await p.goto(srv.url + 'blank'); await clean(p); await plant(p, gradingSeed()); await plantPlan(p);
  p.errors = errors; return p;
}
const toasts = p => p.$$eval('.toast', l => l.map(e => e.textContent).join(' | ')).catch(() => '');
const ls = (p, sub) => p.evaluate(async sub => {
  let d = await (await navigator.storage.getDirectory()).getDirectoryHandle('Lessons'); for (const s of sub ? sub.split('/') : []) d = await d.getDirectoryHandle(s);
  const o = []; for await (const [n] of d.entries()) o.push(n); return o.sort();
}, sub || '');
const readF = (p, file) => p.evaluate(async file => {
  let d = await (await navigator.storage.getDirectory()).getDirectoryHandle('Lessons'); const parts = file.split('/'), name = parts.pop(); for (const s of parts) d = await d.getDirectoryHandle(s);
  return (await (await d.getFileHandle(name)).getFile()).text();
}, file);
const writeF = (p, file, text) => p.evaluate(async (file, text) => {
  let d = await (await navigator.storage.getDirectory()).getDirectoryHandle('Lessons'); const parts = file.split('/'), name = parts.pop(); for (const s of parts) d = await d.getDirectoryHandle(s, { create: true });
  const w = await (await d.getFileHandle(name, { create: true })).createWritable(); await w.write(text); await w.close();
}, file, text);
const db = (p, store, key) => p.evaluate((store, key) => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction(store).objectStore(store).get(key); q.onsuccess = () => { r.result.close(); res(q.result); }; q.onerror = () => rej(q.error); }; r.onerror = () => rej(r.error); }), store, key);
const allLessons = p => p.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('lessons').objectStore('lessons').getAll(); q.onsuccess = () => { r.result.close(); res(q.result); }; q.onerror = () => rej(q.error); }; r.onerror = () => rej(r.error); }));

test('the Planner folder: linked in Settings, written whole, and what the assistant adds or changes there comes back in, marked not reviewed', async () => {
  const p = await open();
  await p.goto(srv.url + 'next/#/settings/ai');
  await p.waitForSelector('[data-pfolder] [data-pflink]', { timeout: 30000 });
  assert.equal(await p.$eval('[data-pfstate]', e => e.dataset.pfstate), 'none');
  await p.click('[data-pflink]');
  assert.ok(await until(async () => /Planner folder linked: Lessons/.test(await toasts(p)), 20000), 'linked');
  assert.equal(await until(async () => p.$eval('[data-pfstate]', e => e.dataset.pfstate).catch(() => '')), 'ok');
  // written as the current Planner writes it
  const top = await until(async () => { const l = await ls(p); return l.includes('Rubrics') && l.includes('Units') && l.filter(n => n.endsWith('.lesson.json')).length === 6 ? l : null; }, 20000);
  assert.ok(top, 'everything written: ' + (await ls(p)).join(', '));
  for (const n of ['activities.json', 'planner-folder.json', 'timetable.json']) assert.ok(top.includes(n), n);
  assert.ok(top.some(n => /^README - for .+\.md$/.test(n)), 'the README for the assistant');
  assert.deepEqual(await ls(p, 'Units'), ['Grade 10 - Unit 2- Narrators.unit.json', 'Grade 9 - Unit 1- Stories.unit.json', 'Grade 9 - Unit 2- Poetry.unit.json']);
  assert.deepEqual(await ls(p, 'Rubrics'), ['School percent scale.scale.json', 'Story analysis.rubric.json']);
  const l3 = (await allLessons(p)).find(l => l.id === 'L3');
  assert.ok(l3._file && l3._mod, 'the lesson keeps where it was written');
  const units = await db(p, 'kv', 'units'), banked = await db(p, 'kv', 'bankFiles');
  assert.ok(units.every(u => u._file && u._mod), 'each unit keeps its file');
  assert.deepEqual(Object.keys(banked).sort(), ['R1', 'S1']);

  // the assistant at work in the folder, a moment later
  await wait(1700);
  const f3 = JSON.parse(await readF(p, l3._file));
  f3.slides[3].title = 'Where does the sonnet turn?'; f3.title = 'Sonnets: finding the turn';
  await writeF(p, l3._file, JSON.stringify(f3, null, 2));
  await writeF(p, 'Haiku in three lines.lesson.json', JSON.stringify({ title: 'Haiku in three lines', slots: [{ classId: 'A1', date: '2026-10-30' }], slides: [{ layout: 'content', title: 'What is a haiku?', body: '• Three lines\n• 5, 7, 5' }] }));
  const uf = 'Units/Grade 9 - Unit 2- Poetry.unit.json', u2 = JSON.parse(await readF(p, uf)); u2.weeks[2].focus = 'Voice and tone';
  await writeF(p, uf, JSON.stringify(u2, null, 2));
  await writeF(p, 'Rubrics/Poem reading.rubric.json', JSON.stringify({ name: 'Poem reading', criteria: ['Fluency', 'Expression'] }));
  await p.click('[data-pflook]');
  assert.ok(await until(async () => /2 new, 2 updated from the Planner folder/.test(await toasts(p)), 20000), 'what came in is said: ' + await toasts(p));

  const all = await allLessons(p), haiku = all.find(l => l.title === 'Haiku in three lines'), c3 = all.find(l => l.id === 'L3');
  assert.ok(haiku && haiku.id, 'the new lesson is in');
  assert.equal(haiku.status, 'review', 'a new one waits for review');
  assert.equal(haiku.slides[0].layout, 'title', 'with its title slide first, as the Planner starts a deck');
  assert.ok(haiku._file && JSON.parse(await readF(p, haiku._file)).id === haiku.id, 'its file now carries its id');
  assert.equal(c3.title, 'Sonnets: finding the turn');
  assert.ok(c3.pending && c3.pending.title === 'Sonnets: the turn' && c3.pending.before.length === 5, 'the changed one keeps hers to go back to');
  const vers = await db(p, 'kv', 'ver:L3');
  assert.match(vers[0].label, /^Before .+’s changes$/);
  assert.equal((await db(p, 'kv', 'units')).find(u => u.id === 'U2').weeks[2].focus, 'Voice and tone');
  const bank = await db(p, 'kv', 'bank'), pr = bank.rubrics.find(r => r.name === 'Poem reading');
  assert.ok(pr && pr.id, 'the new rubric is in the bank');
  assert.equal(JSON.parse(await readF(p, 'Rubrics/Poem reading.rubric.json')).id, pr.id, 'its file now carries its id');

  // on the Calendar and the lesson page: not reviewed; Back to your version puts hers back
  await p.goto(srv.url + 'next/#/calendar/class');
  await p.waitForSelector('[data-lesson]', { timeout: 20000 });
  assert.ok(await until(() => p.$('[data-lesson="L3"] [data-notreviewed]')), 'the changed lesson is marked on the Calendar');
  await p.goto(srv.url + 'next/#/lesson/L3');
  await p.waitForSelector('[data-arrived]', { timeout: 20000 });
  await p.click('[data-arrived-back]');
  assert.ok(await until(async () => { const l = await db(p, 'lessons', 'L3'); return l && !l.pending && l.title === 'Sonnets: the turn'; }), 'hers is back');
  assert.match((await db(p, 'kv', 'ver:L3'))[0].label, /version \(you went back to yours\)$/);
  assert.ok(await until(async () => !(await p.$('[data-arrived]'))), 'the mark is gone');
  // the new one: marked Ready, it is reviewed
  await p.goto(srv.url + 'next/#/lesson/' + haiku.id);
  await p.waitForSelector('[data-arrived]', { timeout: 20000 });
  await p.click('[data-arrived-keep]');
  assert.ok(await until(async () => (await db(p, 'lessons', haiku.id)).status === ''), 'reviewed');
  // a file the app wrote itself is not read back in again
  await p.goto(srv.url + 'next/#/settings/ai');
  await p.waitForSelector('[data-pflook]', { timeout: 20000 });
  await p.click('[data-pflook]');
  assert.ok(await until(async () => /No changes in the Planner folder/.test(await toasts(p)), 20000), await toasts(p));
  assert.deepEqual(p.errors, []);
  await p.close();
});

test('the Planner folder: a folder with grading files in it is refused', async () => {
  const p = await open();
  await p.evaluate(async () => { localStorage.setItem('test.pick', 'Mixed'); const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('Mixed', { create: true }); await d.getFileHandle('gs-folder.json', { create: true }); });
  await p.goto(srv.url + 'next/#/settings/ai');
  await p.waitForSelector('[data-pfolder] [data-pflink]', { timeout: 30000 });
  await p.click('[data-pflink]');
  assert.ok(await until(async () => /grading files in it/.test(await toasts(p))), 'refused');
  assert.equal(await db(p, 'kv', 'dir'), undefined, 'not linked');
  assert.deepEqual(p.errors, []);
  await p.close();
});
