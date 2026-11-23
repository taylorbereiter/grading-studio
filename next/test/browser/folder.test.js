// The linked folder in the new app (stage 6, item 4): chosen in Settings > Saving and sync, every save goes there too, it keeps a
// copy of each day to go back to, it comes back by itself after a reload, a cleared browser gets everything back from it, and
// going back in time leaves a safety copy to put back. The folder is the browser's own private folder (OPFS) handed to the app as
// if chosen, so nothing on the computer is touched. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed } = require('../../../test/helpers/steady.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const onDisk = require('./site-path');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/next/') p = '/next/index.html';
    const ok = /^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p) || onDisk.extra(p);
    const f = onDisk(p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

const until = async (f, ms = 15000) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t0 > ms) return v; await new Promise(r => setTimeout(r, 100)); } };
// "Choose a folder…" gets a folder called Mine in the browser's private folder.
const chooser = async p => { await p.setBypassServiceWorker(true); await p.evaluateOnNewDocument(() => { window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Mine', { create: true }); }); };
// A private browser context dies reading a stored folder back (headless Chrome), so each test uses the main one, emptied first.
const clean = p => p.evaluate(async () => {
  localStorage.clear();
  for (const d of await indexedDB.databases()) await new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r; });
  const root = await navigator.storage.getDirectory(); for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
});
async function open() { const p = await browser.newPage(); await chooser(p); await p.goto(srv.url + 'blank'); await clean(p); await plant(p, gradingSeed()); return p; }
const say = p => p.$eval('[data-svsay]', e => e.dataset.svsay).catch(() => '');
const inFolder = (p, sub) => p.evaluate(async sub => {
  let d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mine')).getDirectoryHandle('Grading Studio');
  if (sub) d = await d.getDirectoryHandle(sub);
  const o = []; for await (const [n] of d.entries()) o.push(n); return o.sort();
}, sub);
const workOf = (p, id) => p.evaluate(id => new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onupgradeneeded = () => r.transaction.abort(); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('work')) return res(null); const q = db.transaction('work').objectStore('work').get(id); q.onsuccess = () => { db.close(); res(q.result || null); }; }; r.onerror = () => res(null); }), id);
const toasts = p => p.$$eval('.toast', l => l.map(e => e.textContent).join(' | ')).catch(() => '');

test('the linked folder: chosen in Settings, saved to, kept after a reload, and everything comes back to a cleared browser', async () => {
  const p = await open();
  await p.goto(srv.url + 'next/#/settings/saving');
  await p.waitForSelector('[data-svwhere]', { timeout: 30000 });
  assert.equal(await until(async () => (await say(p)) === 'none'), true, 'no folder yet');
  // the line says "Checking where your work is kept…" until the check is done, which can be after the folder state reads none
  assert.equal(await until(async () => /Not backed up/.test(await p.$eval('[data-svsay]', e => e.textContent))), true, 'Not backed up');
  assert.ok(await p.$eval('[data-svsay]', e => e.classList.contains('sv-warn')), 'said in amber until there is a second copy');
  assert.equal(await p.$eval('[data-savewarn]', e => e.textContent), 'Not backed up', 'the sidebar says so too');
  await p.click('[data-svpick]');
  assert.equal(await until(async () => (await say(p)) === 'ok', 30000), true, 'linked and level');
  assert.match(await p.$eval('[data-svsay]', e => e.textContent), /“Mine” folder/);
  assert.match(await toasts(p), /now saves to “Mine”/);
  assert.equal(await p.$('[data-savewarn]'), null, 'and stops saying it once the folder has a copy');
  const top = await inFolder(p);
  for (const n of ['downloads', 'files', 'gs-folder.json', 'snapshots']) assert.ok(top.includes(n), n + ' is in the folder');
  assert.ok((await inFolder(p, 'downloads')).some(n => n.includes('n1')), 'a download’s work is in the folder');
  // the day's copy is listed under Go back in time
  await p.waitForSelector('[data-svhist] [data-svsnap]', { timeout: 15000 });
  assert.match(await p.$eval('[data-svhist]', e => e.textContent), /Copy of the day/);
  // a reload finds the folder again by itself
  await p.goto(srv.url + 'blank'); await p.goto(srv.url + 'next/#/settings/saving'); await p.waitForSelector('[data-svwhere]', { timeout: 30000 });
  assert.equal(await until(async () => (await say(p)) === 'ok', 30000), true, 'linked again after a reload');
  // a cleared browser: link the same folder and the work comes back
  await p.goto(srv.url + 'blank');
  await p.evaluate(async () => { localStorage.clear(); for (const d of await indexedDB.databases()) await new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r; }); });   // the folder stays
  await p.goto(srv.url + 'next/#/settings/saving');
  await p.waitForSelector('[data-svpick]', { timeout: 30000 });
  assert.equal(await workOf(p, 'gs.b.n1'), null, 'the browser is empty');
  await p.click('[data-svpick]');
  assert.equal(await until(async () => (await say(p)) === 'ok', 30000), true);
  assert.match(await toasts(p), /Everything came back from your folder/);
  assert.ok(await until(async () => { const w = await workOf(p, 'gs.b.n1'); return w && w.s && Object.keys(w.s).length === 6; }), 'every student’s work came back from the folder');
  assert.ok(await until(async () => { const l = await p.evaluate(() => localStorage.getItem('gs.lib')); return l && /Grade 9 English/.test(l); }), 'the classes came back');
  await p.close();
});

test('going back in time to the folder’s copy leaves a safety copy, which puts things back; stopping keeps the folder’s files', async () => {
  const p = await open();
  await p.goto(srv.url + 'next/#/settings/saving');
  await p.waitForSelector('[data-svpick]', { timeout: 30000 });
  await p.click('[data-svpick]');
  assert.equal(await until(async () => (await say(p)) === 'ok', 30000), true);
  await p.waitForSelector('[data-svhist] [data-svsnap]', { timeout: 15000 });
  assert.ok(await p.$('[data-svsafe]'), 'the safety copies card is there');
  await p.click('[data-svhist] [data-svlook]');   // Look first, as in the current app: going back with everything is inside it
  await p.waitForSelector('[data-svhist] [data-gball]');
  await p.click('[data-svhist] [data-gball]');
  await p.waitForSelector('dialog[open] [data-ok]');
  assert.match(await p.$eval('dialog[open]', e => e.textContent), /Go back to this copy from/);
  const nav = p.waitForNavigation({ timeout: 30000 }).catch(() => null);
  await p.click('dialog[open] [data-ok]');
  await nav;
  await p.waitForSelector('[data-svsafe] [data-svcopy]', { timeout: 30000 });
  assert.match(await p.$eval('[data-svsafe]', e => e.textContent), /Before going back/);
  assert.equal(await until(async () => (await say(p)) === 'ok', 30000), true, 'the folder is still linked after going back');
  const work = await workOf(p, 'gs.b.n1');
  assert.ok(work && Object.keys(work.s).length === 6, 'the work is all there after going back');
  // put back the safety copy
  await p.click('[data-svsafe] [data-svlook]');
  await p.waitForSelector('[data-svsafe] [data-gball]');
  await p.click('[data-svsafe] [data-gball]');
  await p.waitForSelector('dialog[open] [data-ok]');
  const nav2 = p.waitForNavigation({ timeout: 30000 }).catch(() => null);
  await p.click('dialog[open] [data-ok]');
  await nav2;
  await p.waitForSelector('[data-svsafe] [data-svcopy]', { timeout: 30000 });
  assert.match(await p.$eval('[data-svsafe]', e => e.textContent), /Before putting back/, 'how things were is kept first, so a wrong click can be undone');
  // stop using the folder: its files stay
  await until(async () => (await say(p)) === 'ok', 30000);
  await p.click('[data-svstop]');
  await p.waitForSelector('dialog[open] [data-ok]');
  await p.click('dialog[open] [data-ok]');
  assert.equal(await until(async () => (await say(p)) === 'none'), true);
  assert.ok((await inFolder(p)).includes('gs-folder.json'), 'nothing in the folder is deleted');
  await p.close();
});

test('changed in both places: both are shown, nothing is chosen without her, and her pick is kept', async () => {
  const p = await open();
  await p.goto(srv.url + 'next/#/settings/saving');
  await p.waitForSelector('[data-svpick]', { timeout: 30000 });
  await p.click('[data-svpick]');
  assert.equal(await until(async () => (await say(p)) === 'ok', 30000), true);
  // the folder's copy and this browser's each change one student's comment, neither knowing of the other
  const dl = ['downloads', encodeURIComponent('gs.b.n1'), 'work.json'];
  const rw = (fn, dl) => p.evaluate(async (fn, dl) => {
    let d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mine')).getDirectoryHandle('Grading Studio');
    for (const n of dl.slice(0, -1)) d = await d.getDirectoryHandle(n);
    const fh = await d.getFileHandle(dl[dl.length - 1]), w = JSON.parse(await (await fh.getFile()).text());
    const out = new Function('w', fn)(w), wr = await fh.createWritable(); await wr.write(JSON.stringify(out)); await wr.close();
  }, fn, dl);
  await rw("const s = w.s['Aria Testwell']; s.g.comment = 'From the folder'; s.v = { ...(s.v || {}), other: 7 }; w.t = Date.now(); return w;", dl);
  await p.goto(srv.url + 'blank');
  await p.evaluate(() => { const w = JSON.parse(localStorage.getItem('gs.b.n1')), s = w.s['Aria Testwell']; s.g.comment = 'From this browser'; s.v = { ...(s.v || {}), here: 9 }; w.t = Date.now(); localStorage.setItem('gs.b.n1', JSON.stringify(w)); });
  await p.goto(srv.url + 'next/#/settings/saving');
  await p.waitForSelector('[data-svwhere]', { timeout: 30000 });
  assert.equal(await until(async () => (await say(p)) === 'decide', 30000), true, 'nothing chosen without her');
  assert.match(await p.$eval('[data-svsay]', e => e.textContent), /One thing to decide/);
  assert.equal(await p.$eval('[data-savewarn]', e => e.textContent), 'Things to decide');
  await p.click('[data-svdecide]');
  await p.waitForSelector('dialog[open] [data-cf]');
  const text = await p.$eval('dialog[open]', e => e.innerText);
  for (const x of [/Aria Testwell/, /From this browser/, /From the folder/, /On this computer/, /In your folder/]) assert.match(text, x);
  // Use what I picked with nothing picked asks for a pick
  await p.click('[data-cfok]');
  assert.match(await toasts(p), /choose a version for each/);
  await p.click('[data-cf="0"] input[value="b"]');
  await p.click('[data-cfok]');
  assert.equal(await until(async () => (await say(p)) === 'ok', 30000), true);
  assert.ok(await until(async () => { const w = await p.evaluate(() => JSON.parse(localStorage.getItem('gs.b.n1'))); const r = await workOf(p, 'gs.b.n1'); return [w, r].some(x => x && x.s['Aria Testwell'].g.comment === 'From the folder'); }), 'the folder’s version is kept here');
  await p.close();
});

// A-080: the browser asks again for the folder (as after a restart): Home says so at the top, and Reconnect gives it back.
test('A-080: a folder that needs a press is said at the top of Home, and Reconnect there links it again', async () => {
  const p = await open();
  await p.goto(srv.url + 'next/#/settings/saving');
  await p.waitForSelector('[data-svpick]', { timeout: 30000 });
  await p.click('[data-svpick]');
  assert.equal(await until(async () => (await say(p)) === 'ok', 30000), true, 'linked');
  // the next visit: the browser hasn't said yes to the folder yet
  await p.evaluateOnNewDocument(() => { const P = FileSystemHandle.prototype; let asked = false; P.queryPermission = async function () { return asked ? 'granted' : 'prompt'; }; P.requestPermission = async function () { asked = true; return 'granted'; }; });
  await p.goto(srv.url + 'blank'); await p.goto(srv.url + 'next/#/home');
  await p.waitForSelector('[data-home="folderfix"][data-fix="ask"] [data-fix-reconnect]', { timeout: 30000 });
  assert.match(await p.$eval('[data-home="folderfix"]', e => e.textContent), /Mine/);
  await p.click('[data-fix-reconnect]');
  await p.waitForFunction(() => !document.querySelector('[data-home="folderfix"]'), { timeout: 30000 });
  await p.close();
});
