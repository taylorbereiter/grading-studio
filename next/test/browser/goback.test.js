// Stage 8, slice A: Settings > Go back in time, one assignment at a time (rebuild/audit/gaps.md A-036, A-037, A-038), as the current
// app's src/safe.js has it: Look at a dated copy (a safety copy here, or the linked folder's), how each assignment stood then and
// stands now, Restore this assignment with a copy of how things are now kept first and Undo, and Choose a folder… while there is
// none. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const onDisk = require('./site-path');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p) || onDisk.extra(p);
    const f = onDisk(p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

const NOW = Date.parse('2026-10-27T10:20:00Z');
const until = async (f, ms = 15000) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t0 > ms) return v; await new Promise(r => setTimeout(r, 100)); } };
async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await p.setBypassServiceWorker(true);
  await p.evaluateOnNewDocument(STEADY); await p.setViewport({ width: 1440, height: 1000 });
  return p;
}
const newest = (p, id) => p.evaluate(id => new Promise(res => {
  const q = JSON.parse(localStorage.getItem(id) || 'null'), r = indexedDB.open('grading-studio-keep');
  r.onsuccess = () => { const g = r.result.transaction('work').objectStore('work').get(id); g.onsuccess = () => { r.result.close(); const f = g.result; res(!q ? f : !f ? q : (f.t || 0) > (q.t || 0) ? f : q); }; };
}), id);
const copies = p => p.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-safety'); r.onsuccess = () => { const q = r.result.transaction('meta').objectStore('meta').getAll(); q.onsuccess = () => { res(q.result.map(m => m.why)); r.result.close(); }; }; }));
const toasts = p => p.$$eval('.toast', l => l.map(e => e.textContent).join(' | ')).catch(() => '');

// A safety copy from two days ago in which the first student of the narrative essay had a different comment.
function seed() {
  const s = gradingSeed(), n1 = JSON.parse(s.ls['gs.b.n1']), n2 = JSON.parse(s.ls['gs.b.n2']), name = Object.keys(n1.s)[0];
  const then = JSON.parse(JSON.stringify(n1)); then.s[name].g.comment = 'A comment from two days ago.'; then.t = NOW - 2 * 864e5;
  n1.s[name].g.comment = 'Today’s comment.'; s.ls['gs.b.n1'] = JSON.stringify(n1);
  const id = (NOW - 2 * 864e5) + '-abcd';
  s.idb['grading-studio-safety'] = { version: 1, stores: {
    meta: [[id, { id, t: NOW - 2 * 864e5, why: 'Before bringing work in', app: 'new app', fromV: 1, toV: 1 }]],
    data: [[id, { ls: { 'gs.lib': s.ls['gs.lib'] } }], [id + '|0', { where: 'grading-studio-keep/work', k: ['gs.b.n1', 'gs.b.n2'], v: [then, n2] }]],
  } };
  return { s, name };
}

// Settings, Saving and sync draws its School year card once the year is read (saving/carry.jsx YearCard, a part loaded later), above
// Go back in time and Safety copies, which move down by its height: a click aimed before then lands where a button was, not on it
// (the folder was never chosen). The cards are clicked once it is there.
const savingDrawn = p => p.waitForSelector('[data-svyear]', { timeout: 30000 });

test('A-037 A-038: Look at a safety copy shows how each assignment stood then, and Restore this assignment puts one back, keeping a copy first, with Undo', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors), { s, name } = seed();
  await p.goto(srv.url + 'blank'); await plant(p, s);
  await p.goto(srv.url + 'next/#/settings/saving');
  await savingDrawn(p);
  await p.waitForSelector('[data-svsafe] [data-svcopy] [data-svlook]', { timeout: 30000 });
  await p.click('[data-svsafe] [data-svlook]');
  await p.waitForSelector('[data-svmoment] [data-gbrow]', { timeout: 15000 });
  assert.equal(await p.$eval('[data-svsafe] [data-svlook]', b => b.textContent), 'Close');
  const rows = await p.$$eval('[data-svmoment] [data-gbrow]', l => l.map(e => [e.dataset.gbrow, e.textContent, !!e.querySelector('[data-gbone]')]));
  assert.equal(rows[0][0], 'gs.b.n1', 'the one that differs comes first');
  assert.match(rows[0][1], /Narrative essay.*Then 6 of 6 scored, now 6 of 6 scored · 1 student’s work differs/s);
  assert.ok(rows[0][2], 'it can be restored');
  assert.deepEqual(rows.slice(1).map(r => [r[0], /The same then as now/.test(r[1]), r[2]]), [['gs.b.n2', true, false]]);
  await p.click('[data-gbrow="gs.b.n1"] [data-gbone]');
  assert.ok(await until(async () => /“Narrative essay” is back to how it was at/.test(await toasts(p))), await toasts(p));
  assert.equal((await newest(p, 'gs.b.n1')).s[name].g.comment, 'A comment from two days ago.');
  assert.ok((await copies(p)).includes('Before restoring an assignment to an earlier day'), 'how things were is kept first');
  await p.waitForFunction(() => /The same then as now/.test(document.querySelector('[data-gbrow="gs.b.n1"]').textContent), { timeout: 15000 });
  // the current app opens with it: the download's row reads the same, and its quick copy (out of date) is gone, so it reads the full one
  const old = await page(ctx, errors); await old.goto(srv.url); await appReady(old);
  assert.deepEqual(await old.evaluate(() => { const m = window.__gs.kept().get('gs.b.n1'); return [m.scored, m.n, localStorage.getItem('gs.b.n1')]; }), [6, 6, null]);
  await old.close();
  // Undo puts it back as it was before restoring
  await p.bringToFront();
  await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => b.textContent === 'Undo').click());
  assert.ok(await until(async () => (await newest(p, 'gs.b.n1')).s[name].g.comment === 'Today’s comment.'), 'undone');
  assert.ok(await until(async () => /Undone\. “Narrative essay” is as it was before\./.test(await toasts(p))));
  assert.deepEqual(errors, []); await ctx.close();
});

// The folder is the browser's own private folder handed to the app as if chosen (as next/test/browser/folder.test.js does).
test('A-036 A-037: with no folder, Go back in time has Choose a folder…; once chosen, its copy of the day can be looked at', async () => {
  const errors = [], p = await page(browser, errors);
  await p.evaluateOnNewDocument(() => { window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Mine', { create: true }); });
  await p.goto(srv.url + 'blank');
  await p.evaluate(async () => {
    localStorage.clear();
    for (const d of await indexedDB.databases()) await new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r; });
    const root = await navigator.storage.getDirectory(); for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
  });
  await plant(p, gradingSeed());
  await p.goto(srv.url + 'next/#/settings/saving');
  await savingDrawn(p);
  await p.waitForSelector('[data-svhist] [data-svhistpick]', { timeout: 30000 });
  await p.click('[data-svhist] [data-svhistpick]');
  await p.waitForSelector('[data-svhist] [data-svsnap] [data-svlook]', { timeout: 30000 });
  assert.equal(await p.$('[data-svhistpick]'), null, 'chosen: the button goes');
  await p.click('[data-svhist] [data-svlook]');
  await p.waitForSelector('[data-svhist] [data-svmoment] [data-gbrow]', { timeout: 15000 });
  const rows = await p.$$eval('[data-svhist] [data-gbrow]', l => l.map(e => [e.dataset.gbrow, /The same then as now/.test(e.textContent)]));
  assert.deepEqual(rows.map(r => r[0]).sort(), ['gs.b.n1', 'gs.b.n2']);
  assert.ok(rows.every(r => r[1]), 'nothing has changed since the copy of the day');
  assert.ok(await p.$('[data-svhist] [data-gball]'), 'going back with everything is inside');
  await p.click('[data-svhist] [data-svlook]');
  await p.waitForFunction(() => !document.querySelector('[data-svhist] [data-svmoment]'));
  assert.deepEqual(errors, []); await p.close();
});
