// Stage 8, slice A: work that doesn't save is never lost quietly (rebuild/audit/gaps.md A-087, A-088, A-089, A-027; the audit's
// no-press pass): the red bar with Try again and Export what I have, saving tried again by itself, leaving the page asks first,
// and Update now in one window never reloads another window over its work (src/saving.js, src/safe.js). Made-up papers only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip, settle } = require('../../../test/helpers/app.js');
const { standardFiles, zipOf } = require('../../../test/helpers/fixtures.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const onDisk = require('./site-path');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
// nextBuild, when set, stands in for next/version.json's build: a newer version going up.
const site = { nextBuild: null };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p) || onDisk.extra(p);
    const f = onDisk(p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    let body = fs.readFileSync(f);
    if (p === '/next/version.json' && site.nextBuild) body = JSON.stringify({ ...JSON.parse(body), build: site.nextBuild });
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon|QuotaExceeded|disk is full|Failed to load resource/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
// A download of made-up papers, opened and saved once in the current app.
async function makeWork(ctx, errors) {
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.goto(srv.url); await appReady(p);
  await openZip(p, zipOf(await standardFiles()));
  await p.evaluate(() => window.__gs.saveNow()); await settle(p);
  const id = await p.evaluate(() => window.__gs.state().batch.id);
  await p.close();
  return id;
}
const openMark = async (p, id) => {
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready && document.querySelector('.mk-row[data-st="0"]'), { timeout: 60000 });
};
// The full copy can't be written (as when the computer is out of space), or can again.
const breakFull = p => p.evaluate(() => { window.__put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function (v, k) { if (this.name === 'work') throw new DOMException('The disk is full', 'QuotaExceededError'); return window.__put.call(this, v, k); }; });
const mendFull = p => p.evaluate(() => { IDBObjectStore.prototype.put = window.__put; });
async function typeComment(p, text) {
  await p.bringToFront(); await p.focus('.mk-cmt'); await p.evaluate(() => { const e = document.querySelector('.mk-cmt'); e.selectionStart = e.selectionEnd = e.value.length; });
  await p.waitForFunction(() => document.activeElement && document.activeElement.matches('.mk-cmt, .mk-cmt *'));
  await p.keyboard.type(text);
}
const leaveAsks = p => p.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
const toastSays = (p, s) => p.waitForFunction(s => [...document.querySelectorAll('.toast')].some(x => x.textContent.includes(s)), { timeout: 15000 }, s);

test('A-087, A-088, A-089: a save that fails shows the red bar on every screen, leaving asks first, Try again saves, Export goes to Return', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const id = await makeWork(ctx, errors), p = await page(ctx, errors);
  await openMark(p, id);
  assert.equal(await leaveAsks(p), false, 'nothing to ask about yet');
  await breakFull(p);
  await typeComment(p, 'Kept only in the quick copy.');
  await p.waitForSelector('[data-savebar="partly"]', { timeout: 20000 });
  assert.match(await p.$eval('[data-savebar]', e => e.textContent), /only partly saved.*Keep this window open/s);
  assert.equal(await leaveAsks(p), true, 'closing the window asks first');
  // on another screen too
  await p.evaluate(() => { location.hash = '#/home'; });
  await p.waitForFunction(() => location.hash === '#/home' && document.querySelector('[data-savebar]'), { timeout: 15000 });
  await p.click('[data-savehelp]');
  await p.waitForFunction(id => location.hash === '#/mark/' + id + '/return', { timeout: 15000 }, id);
  // Try again while it still can't save: the bar stays
  await p.click('[data-saveretry]'); await new Promise(r => setTimeout(r, 1000));
  assert.ok(await p.$('[data-savebar]'), 'still not saved, so the bar stays');
  await mendFull(p);
  await p.click('[data-saveretry]');
  await p.waitForFunction(() => !document.querySelector('[data-savebar]'), { timeout: 20000 });
  await toastSays(p, 'Your work is safe again');
  assert.equal(await leaveAsks(p), false);
  const full = await p.evaluate(id => new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => { const g = r.result.transaction('work').objectStore('work').get(id); g.onsuccess = () => { r.result.close(); res(JSON.stringify(g.result)); }; }; }), id);
  assert.ok(full.includes('Kept only in the quick copy.'), 'the full copy has the comment now');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a failed save is tried again by itself', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const id = await makeWork(ctx, errors), p = await page(ctx, errors);
  await p.evaluateOnNewDocument(() => { const st = window.setTimeout; window.setTimeout = (f, ms, ...a) => st(f, ms === 20000 ? 1500 : ms, ...a); });   // the 20 s wait, shortened
  await openMark(p, id);
  await breakFull(p);
  await typeComment(p, 'Saved on the second go.');
  await p.waitForSelector('[data-savebar]', { timeout: 20000 });
  await mendFull(p);
  await p.waitForFunction(() => !document.querySelector('[data-savebar]'), { timeout: 20000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('A-027: Update now in one window saves it and reloads only that window; the other keeps its work, and reloads only once it is saved', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const id = await makeWork(ctx, errors);
  const a = await page(ctx, errors); await openMark(a, id);
  // the worker at /next/ here is the root's (next/test/browser/site-path.js), which keeps the version in use in gs-app-2
  await a.waitForFunction(async () => (await caches.keys()).includes('gs-app-2') && !!(await (await caches.open('gs-app-2')).match(new URL('version.json', location.href).href)), { timeout: 60000, polling: 300 });
  await a.evaluate(() => { window.__stay = 1; });
  site.nextBuild = 'newer-build-for-the-test';
  try {
    const b = await page(ctx, errors);
    await b.goto(srv.url + 'next/#/settings/about');
    const now = await b.waitForSelector('[data-focus="update-now"]', { visible: true, timeout: 60000 });
    // A has a mark it hasn't saved yet (typed this instant)
    await typeComment(a, 'Typed just before the update.');
    await b.bringToFront();
    await Promise.all([b.waitForNavigation({ timeout: 30000 }), now.click()]);
    await b.waitForSelector('[data-shell-nav]', { timeout: 30000 });
    // A did not reload: it says another window updated, and its work is saved
    await a.bringToFront();
    await a.waitForSelector('[data-upd-strip] [data-focus="update-reload"]', { visible: true, timeout: 30000 });
    assert.equal(await a.evaluate(() => window.__stay), 1, 'A was not reloaded');
    await a.evaluate(() => window.__mark.saved());
    // A window whose work can't be saved doesn't reload, and says why
    await breakFull(a);
    await typeComment(a, ' And a bit more.');
    await a.waitForSelector('[data-savebar]', { timeout: 20000 });
    await a.click('[data-focus="update-reload"]');
    await toastSays(a, 'the update is waiting');
    assert.equal(await a.evaluate(() => window.__stay), 1, 'not reloaded over unsaved work');
    // once it saves, Reload this window reloads it
    await mendFull(a); await a.click('[data-saveretry]');
    await a.waitForFunction(() => !document.querySelector('[data-savebar]'), { timeout: 20000 });
    await Promise.all([a.waitForNavigation({ timeout: 30000 }), a.click('[data-focus="update-reload"]')]);
    await a.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
    assert.equal(await a.evaluate(() => window.__stay), undefined, 'reloaded');
    const w = await a.evaluate(() => JSON.stringify(window.__mark.state().batch.students[0].grade.comment));
    assert.match(w, /Typed just before the update\. And a bit more\./, 'every word she typed is there after the reload');
  } finally { site.nextBuild = null; }
  assert.deepEqual(errors, []);
  await ctx.close();
});
