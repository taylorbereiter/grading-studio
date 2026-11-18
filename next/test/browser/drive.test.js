// Google Drive in the new app (stage 6, item 5): sign-in with the hourly renewal, the sync file sent and taken in, and the Planner's
// file, against a stand-in for Google (no real account, nothing leaves the test). Two browsers share one stand-in Drive: the new app
// with the new app, and the new app with the current app, each taking in what the other sent. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { plantPlan } = require('./planseed.js');
const { fakeDrive } = require('./fakedrive.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p);
    const f = path.join(ROOT, p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}

let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

async function page(ctx, errors, D) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await p.setBypassServiceWorker(true);
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  if (D) await D.hook(p);
  return p;
}
const ls = (p, k) => p.evaluate(k => JSON.parse(localStorage.getItem(k)), k);
const until = async (f, ms = 15000) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t0 > ms) return v; await new Promise(r => setTimeout(r, 150)); } };
const typedOf = (l, id) => { for (const c of l.classes) for (const u of c.units) for (const it of u.items) if (it.id === id) return it.typed; return null; };
const lessonsIn = p => p.evaluate(() => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const db = r.result; try { const q = db.transaction('lessons').objectStore('lessons').getAll(); q.onsuccess = () => { res(q.result); db.close(); }; } catch { res([]); } }; r.onerror = () => res([]); }));
const signedIn = { 'gs.gEmail': JSON.stringify('teacher@example.com') };
// Settings > Saving and sync: Sync now, and the line says synced once it is done.
async function syncNew(p, D) {
  if (!/#\/settings\/saving/.test(p.url())) { await p.goto(srv.url + 'next/#/settings/saving'); }
  await p.waitForSelector('[data-svsync]:not([disabled])', { timeout: 30000 });
  const n = D.reads || 0;
  await p.evaluate(() => localStorage.removeItem('gs.syncAt'));   // the clock stands still in these checks, so the stamp is taken away and waited for
  await p.click('[data-svsync]');
  assert.ok(await until(() => (D.reads || 0) > n), 'the sync read the file');
  // the line reads "synced" from the sync before, so the round is over once gs.syncAt is back and the line says synced again
  await p.waitForFunction(() => localStorage.getItem('gs.syncAt') && /synced/.test((document.querySelector('[data-svstate]') || {}).textContent || ''));
}

test('signing in from Settings, the sync file sent with the library, the work and the Planner, and signing out', async () => {
  const errors = [], D = fakeDrive(), ctx = await browser.createBrowserContext(), p = await page(ctx, errors, D);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed()); await plantPlan(p);
  await p.goto(srv.url + 'next/#/settings/saving');
  await p.waitForSelector('[data-svin]', { timeout: 30000 });
  await p.click('[data-svin]');
  await p.waitForSelector('[data-svacct]');
  assert.match(await p.$eval('[data-svacct]', e => e.textContent), /teacher@example\.com/);
  assert.equal(await ls(p, 'gs.gEmail'), 'teacher@example.com');
  assert.ok(await until(() => D.writes >= 1), 'the sync file went up after signing in');
  const f = D.file();
  assert.equal(f.app, 'Grading Studio sync');
  assert.equal(f.lib.classes[0].name, 'Grade 9 English');
  assert.ok(f.work['gs.b.n1'] && f.meta['gs.b.n1'] && !('papers' in f.meta['gs.b.n1']), 'a download’s work and its row, without where its papers are kept');
  assert.ok(!('gs.lib' in f.ls) && !('gs.gEmail' in f.ls), 'the library goes on its own and the account stays here');
  assert.ok(f.plan && f.plan.classes.length >= 2, 'the timetable for a device with no Planner');
  assert.ok(await until(() => D.plan), 'the Planner’s own file');
  assert.equal(Object.keys(D.planFile().lessons).length, 6);
  assert.ok(D.planFile().kv.units && D.planFile().kv.setup);
  // nothing new: no new write
  await syncNew(p, D);   // the first merge stamps the library, as the current app's does
  const w = D.writes; await syncNew(p, D); assert.equal(D.writes, w, 'nothing changed, so nothing is written');
  // the renewal by itself, on by default, turned off and kept
  await p.waitForSelector('[data-svauto] input');
  assert.equal(await p.$eval('[data-svauto] input', e => e.checked), true);
  await p.click('[data-svauto] .cb'); assert.equal(await ls(p, 'gs.gAuto'), false);
  await p.click('[data-svauto] .cb'); assert.equal(await ls(p, 'gs.gAuto'), true);
  await p.click('[data-svout]');
  await p.waitForSelector('[data-svin]');
  assert.equal(await ls(p, 'gs.gEmail'), null);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the new app with the current app on one Drive: a score typed in each comes to the other, and a lesson both ways', async () => {
  const errors = [], D = fakeDrive();
  // the current app's computer, with the work and the Planner
  const c1 = await browser.createBrowserContext(), old = await page(c1, errors, D);
  await old.goto(srv.url + 'blank'); await plant(old, { ...gradingSeed(), ls: { ...gradingSeed().ls, ...signedIn } }); await plantPlan(old);
  await old.goto(srv.url); await old.waitForFunction(() => window.__gs && window.__gs.syncNow, { timeout: 60000 });
  await old.evaluate(async () => { await window.__gs.gIn(); await window.__gs.syncNow(); });
  assert.ok(await until(() => D.writes >= 1 && D.plan));
  // the new app on another computer with nothing yet, signed in to the same account
  const c2 = await browser.createBrowserContext(), nw = await page(c2, errors, D);
  await nw.goto(srv.url + 'blank'); await plant(nw, { ls: signedIn });
  await nw.goto(srv.url + 'next/#/settings/saving');
  await syncNew(nw, D);
  const l1 = await ls(nw, 'gs.lib');
  assert.equal(l1.classes[0].name, 'Grade 9 English', 'the classes came');
  assert.ok(await nw.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => { try { const q = r.result.transaction('work').objectStore('work').get('gs.b.n1'); q.onsuccess = () => res(!!q.result); } catch { res(false); } }; r.onerror = () => res(false); })), 'a download’s work came');
  assert.ok(await until(async () => (await lessonsIn(nw)).length === 6), 'the lessons came to the new app’s Planner');
  // a score typed on the new app's Grades tab goes to the current app
  const who = l1.classes[0].names[0];
  await nw.goto(srv.url + 'next/#/class/c1/grades');
  await nw.waitForSelector('table.book td[data-bked="i4"]', { timeout: 60000 });
  await nw.evaluate((k, nm) => document.querySelector('td[data-bked="' + k + '"][data-bkn="' + nm + '"]').focus(), 'i4', who);
  await nw.keyboard.type('11'); await nw.keyboard.press('Enter');
  assert.ok(await until(async () => (typedOf(await ls(nw, 'gs.lib'), 'i4').s[who] || {}).v === 11));
  await syncNew(nw, D);
  assert.equal((typedOf(D.file().lib, 'i4').s[who] || {}).v, 11, 'the new app sent its change');
  await old.evaluate(async () => { await window.__gs.syncNow(); });
  assert.equal(typedOf(await ls(old, 'gs.lib'), 'i4').s[who].v, 11, 'the current app has the score typed in the new app');
  // and one typed in the current app comes to the new app
  const who2 = l1.classes[0].names[1];
  await old.evaluate(who => { const l = window.__gs.state().lib; for (const c of l.classes) for (const u of c.units) for (const it of u.items) if (it.id === 'i4') it.typed.s[who] = { ...it.typed.s[who], v: 7, t: Date.now() }; window.__gs.saveLib(); }, who2);
  await old.evaluate(async () => { await window.__gs.syncNow(); });
  await syncNew(nw, D);
  assert.equal(typedOf(await ls(nw, 'gs.lib'), 'i4').s[who2].v, 7, 'the new app has the score typed in the current app');
  // a lesson changed in the current app's Planner goes to the new app
  await old.evaluate(() => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const db = r.result, tx = db.transaction('lessons', 'readwrite'), o = tx.objectStore('lessons'); const q = o.get('L3'); q.onsuccess = () => { o.put({ ...q.result, title: 'Sonnets: the volta', updated: Date.now() + 60000 }); }; tx.oncomplete = () => { db.close(); res(); }; }; }));
  await old.evaluate(async () => { await window.__gs.syncNow(); });
  await syncNew(nw, D);
  assert.ok(await until(async () => ((await lessonsIn(nw)).find(l => l.id === 'L3') || {}).title === 'Sonnets: the volta'), 'the lesson changed in the current app came to the new app');
  assert.deepEqual(errors, []);
  await c1.close(); await c2.close();
});

test('two computers on the new app: a score comes across, and with the renewal turned off the sync waits for a press', async () => {
  const errors = [], D = fakeDrive();
  const c1 = await browser.createBrowserContext(), a = await page(c1, errors, D);
  await a.goto(srv.url + 'blank'); await plant(a, { ...gradingSeed(), ls: { ...gradingSeed().ls, ...signedIn } });
  await syncNew(a, D);
  // the second computer turned the renewal off: nothing opens Google's window by itself, the line asks for a press
  const c2 = await browser.createBrowserContext(), b = await page(c2, errors, D);
  await b.goto(srv.url + 'blank'); await plant(b, { ls: { ...signedIn, 'gs.gAuto': 'false' } });
  await b.goto(srv.url + 'next/#/settings/saving');
  await b.waitForSelector('[data-svagain]', { timeout: 30000 });
  assert.equal(await b.evaluate(() => window.__gReq || 0), 0, 'Google’s window never opened by itself');
  await b.click('[data-svagain]');
  await b.waitForSelector('[data-svsync]', { timeout: 15000 });
  assert.ok(await until(async () => ((await ls(b, 'gs.lib')) || { classes: [] }).classes.length === 2), 'signing in again synced');
  // a score typed on the first comes to the second
  const who = (await ls(a, 'gs.lib')).classes[0].names[2];
  await a.goto(srv.url + 'next/#/class/c1/grades');
  await a.waitForSelector('table.book td[data-bked="i4"]', { timeout: 60000 });
  await a.evaluate((k, nm) => document.querySelector('td[data-bked="' + k + '"][data-bkn="' + nm + '"]').focus(), 'i4', who);
  await a.keyboard.type('19.5'); await a.keyboard.press('Enter');
  assert.ok(await until(async () => (typedOf(await ls(a, 'gs.lib'), 'i4').s[who] || {}).v === 19.5));
  await syncNew(a, D);
  await syncNew(b, D);
  assert.equal(typedOf(await ls(b, 'gs.lib'), 'i4').s[who].v, 19.5);
  assert.deepEqual(errors, []);
  await c1.close(); await c2.close();
});

test('papers through Drive: the computer sends a download’s papers up after the marks, and another computer fetches them when the download is opened there', async () => {
  const { zipOf, makePaper } = require('../../../test/helpers/fixtures.js');
  const os = require('os'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-dpapers-'));
  const errors = [], D = fakeDrive(), stores = p => p.evaluate(() => Promise.all([['grading-studio-added', 'files'], ['grading-studio-videos', 'v']].map(([n, s]) => new Promise(res => { const r = indexedDB.open(n, 1); r.onupgradeneeded = () => r.result.createObjectStore(s); r.onsuccess = () => { r.result.close(); res(); }; }))));
  const seed = () => { const s = gradingSeed(), lib = JSON.parse(s.ls['gs.lib']); lib.classes[0].units[0].items.push({ id: 'i9', name: 'Speech', classId: 'c1', type: 'sum', due: '2026-11-20' }); s.ls['gs.lib'] = JSON.stringify(lib); Object.assign(s.ls, signedIn); return s; };
  const c1 = await browser.createBrowserContext(), a = await page(c1, errors, D);
  await a.goto(srv.url + 'blank'); await plant(a, seed()); await stores(a);
  const z = path.join(dir, 'Speech.zip'); fs.writeFileSync(z, zipOf({ 'Aria Testwell/Outline.pdf': await makePaper({ title: 'An outline' }), 'Bram Sample/Outline.pdf': await makePaper({ title: 'Another outline' }) }));
  await a.goto(srv.url + 'next/#/class/c1/work');
  await a.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await a.click('[data-bring-for="i9"]');
  await a.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([a.waitForFileChooser(), a.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await a.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await a.evaluate(() => window.__mark.state().batch.id);
  // after the marks go up, the papers follow, and the sync file lists the download's papers once they are all there
  assert.ok(await until(() => Object.keys(D.blobs).length >= 2 && D.body && (JSON.parse(D.body).files || {})[id], 60000), 'the papers went up and the sync file lists them');
  const listed = JSON.parse(D.body).files[id];
  assert.equal(listed.papers.filter(e => e.hash).length, 2, 'both papers, each named by what is in it');
  assert.ok(Object.values(D.blobs).every(b => /^[0-9a-f]{64}\.dat$/.test(b.name)), 'in the app’s own hidden folder, never under a student’s name');

  // another computer: signed in, synced, and the download opened there fetches its papers from Drive
  const c2 = await browser.createBrowserContext(), b = await page(c2, errors, D);
  await b.goto(srv.url + 'blank'); await plant(b, { ls: signedIn }); await stores(b);
  await syncNew(b, D);
  assert.ok(await until(async () => !!(await ls(b, 'gs.cloudP') || {})[id]), 'the second computer knows the papers are in Drive');
  await b.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await b.waitForFunction(() => window.__mark && window.__mark.ready && window.__mark.read && window.__mark.state().batch, { timeout: 60000 }).catch(async e => { throw new Error(e.message + ' ' + await b.evaluate(() => location.hash + ' | ' + document.querySelector('main, body').textContent.slice(0, 500) + ' | ' + JSON.stringify(Object.keys(window.__mark || {}))) + JSON.stringify(errors)); });
  assert.deepEqual(await b.evaluate(() => window.__mark.state().batch.students.filter(s => s.files.length).map(s => s.key).sort()), ['Aria Testwell', 'Bram Sample'], 'the papers came from Drive');
  assert.ok(await b.evaluate(id => new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => { const q = r.result.transaction('papers').objectStore('papers').get(id); q.onsuccess = () => { res(!!q.result); r.result.close(); }; }; }), id), 'and are kept in this browser from then on');
  assert.deepEqual(errors, []);
  await c1.close(); await c2.close(); fs.rmSync(dir, { recursive: true, force: true });
});
