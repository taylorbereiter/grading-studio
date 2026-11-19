// Carrying work in the new app (stage 6, item 4): the take-home file made and brought in, a new school year and opening the
// archived one, and Remove from this computer. The save box and the folder are the browser's own private folder (OPFS), so
// nothing on the computer is touched. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed } = require('../../../test/helpers/steady.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png' };
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
// "Choose a folder…" gets a folder called Mine in the browser's private folder.
// The save box gets a file of that name in the browser's private folder; the folder box a folder called Mine.
const chooser = async p => { await p.setBypassServiceWorker(true); await p.evaluateOnNewDocument(() => {
  window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('Mine', { create: true });
  // (headless Chrome dies on a private-folder file named with a dash like the one in 2026–27, so the test's names are plain)
  window.showSaveFilePicker = async o => (await navigator.storage.getDirectory()).getFileHandle(o.suggestedName.replace(/[^\x20-\x7e]/g, '-'), { create: true });
}); };
// A private browser context dies reading a stored folder back (headless Chrome), so each test uses the main one, emptied first.
const clean = p => p.evaluate(async () => {
  localStorage.clear();
  for (const d of await indexedDB.databases()) await new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r; });
  const root = await navigator.storage.getDirectory(); for await (const [n] of root.entries()) await root.removeEntry(n, { recursive: true });
});
async function open() { const p = await browser.newPage(); if (process.env.SHOW) { p.on('console', m => console.log('PAGE', m.type(), m.text())); p.on('pageerror', e => console.log('PAGEERR', e.message)); p.on('error', e => console.log('CRASH', e.message)); p.on('framenavigated', f => f === p.mainFrame() && console.log('NAV', f.url())); p.on('close', () => console.log('CLOSED')); } await chooser(p); await p.goto(srv.url + 'blank'); await clean(p); await plant(p, gradingSeed()); return p; }
const say = p => p.$eval('[data-svsay]', e => e.dataset.svsay).catch(() => '');
const inFolder = (p, sub) => p.evaluate(async sub => {
  let d = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('Mine')).getDirectoryHandle('Grading Studio');
  if (sub) d = await d.getDirectoryHandle(sub);
  const o = []; for await (const [n] of d.entries()) o.push(n); return o.sort();
}, sub);
const workOf = (p, id) => p.evaluate(id => new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onupgradeneeded = () => r.transaction.abort(); r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('work')) return res(null); const q = db.transaction('work').objectStore('work').get(id); q.onsuccess = () => { db.close(); res(q.result || null); }; }; r.onerror = () => res(null); }), id);
const toasts = p => p.$$eval('.toast', l => l.map(e => e.textContent).join(' | ')).catch(() => '');

const os = require('os');
// A file made in the page's private folder, written to disk so it can be handed to a file box.
async function fileOut(p, name) {
  const b64 = await p.evaluate(async n => { const f = await (await (await navigator.storage.getDirectory()).getFileHandle(n)).getFile(), u = new Uint8Array(await f.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }, name);
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gs-carry-')), name); fs.writeFileSync(f, Buffer.from(b64, 'base64')); return f;
}
const files = p => p.evaluate(async () => { const o = []; for await (const [n, h] of (await navigator.storage.getDirectory()).entries()) if (h.kind === 'file') o.push(n); return o.sort(); });
const libOf = p => p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib') || 'null'));
// A box opened a moment ago can still be taking the focus: type, and type again until the box says it.
const typeIn = async (p, sel, v) => {
  for (let n = 0; n < 4; n++) {
    await p.focus(sel); await p.keyboard.down('Control'); await p.keyboard.press('KeyA'); await p.keyboard.up('Control'); await p.keyboard.press('Backspace'); await p.type(sel, v);
    if (await p.$eval(sel, e => e.value) === v) return;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('could not type into ' + sel);
};
const settings = async p => { await p.goto(srv.url + 'next/#/settings/saving'); await p.waitForSelector('[data-svcarry]', { timeout: 30000 }); };
const PASS = 'three plain words';

test('take my work with me: a protected file, the wrong passphrase turned away, and brought in on an empty browser', async () => {
  const p = await open();
  await settings(p);
  await until(() => workOf(p, 'gs.b.n1'));
  await p.click('[data-svtake]');
  await p.waitForSelector('[data-svp1]');
  await p.waitForSelector('[data-svlack]');
  assert.match(await p.$eval('[data-svlack]', e => e.textContent), /Narrative essay/, 'says which downloads have no papers here');
  await typeIn(p, '[data-svp1]', 'short'); await typeIn(p, '[data-svp2]', 'short'); await p.click('dialog[open] [data-ok]');
  assert.match(await p.$eval('.sv-err', e => e.textContent), /at least 8/);
  await typeIn(p, '[data-svp1]', PASS); await typeIn(p, '[data-svp2]', PASS); await p.click('dialog[open] [data-ok]');
  await p.waitForSelector('[data-svsaid]', { timeout: 60000 });
  assert.match(await p.$eval('[data-svsaid]', e => e.textContent), /^Done: Grading Studio work \d{4}-\d\d-\d\d\.gswork/);
  const name = (await files(p)).find(n => n.endsWith('.gswork'));
  assert.ok(name, 'the file was written');
  const file = await fileOut(p, name);
  await p.click('dialog[open] [data-ok]');
  // an empty browser brings it in
  await p.goto(srv.url + 'blank'); await clean(p);
  await settings(p);
  assert.equal(await workOf(p, 'gs.b.n1'), null);
  await (await p.$('[data-svbringin]')).uploadFile(file);
  await p.waitForSelector('[data-svp1]');
  await typeIn(p, '[data-svp1]', 'not the passphrase'); await p.click('dialog[open] [data-ok]');
  await p.waitForSelector('.sv-err', { timeout: 60000 });
  assert.match(await p.$eval('.sv-err', e => e.textContent), /doesn’t open this file/);
  await typeIn(p, '[data-svp1]', PASS); await p.click('dialog[open] [data-ok]');
  await p.waitForSelector('[data-svpreview]', { timeout: 60000 });
  const pv = await p.$eval('[data-svpreview]', e => e.textContent);
  assert.match(pv, /2 new downloads/); assert.match(pv, /Narrative essay/); assert.match(pv, /Poetry analysis/);
  await Promise.all([p.waitForNavigation({ timeout: 60000 }), p.click('[data-svbringgo]')]);
  await p.waitForSelector('[data-svcarry]', { timeout: 30000 });
  const w = await until(() => workOf(p, 'gs.b.n1'));
  assert.ok(w && Object.keys(w.s).length === 6, 'every student’s work came in');
  assert.equal((await libOf(p)).classes.length, 2, 'the classes came in');
  // bringing the same file in again finds nothing to do
  await (await p.$('[data-svbringin]')).uploadFile(file);
  await p.waitForSelector('[data-svp1]'); await typeIn(p, '[data-svp1]', PASS); await p.click('dialog[open] [data-ok]');
  await p.waitForSelector('[data-svnothing]', { timeout: 60000 });
  await p.close();
});

test('a new school year: the year goes into a checked file, the classes carry on empty, and the archived year opens again', async () => {
  const p = await open();
  await settings(p);
  await until(() => workOf(p, 'gs.b.n1'));
  await p.waitForSelector('[data-svyear]');
  assert.match(await p.$eval('[data-svyearline]', e => e.textContent), /This year: 2026–27/);
  await p.click('[data-svyearnew]');
  await p.waitForSelector('[data-svnewyear]');
  await typeIn(p, '[data-svyto]', '2026–27');
  await typeIn(p, '[data-svyfrom]', '2026–27');
  await typeIn(p, '[data-svp1]', PASS); await typeIn(p, '[data-svp2]', PASS);
  await p.click('[data-svyeargo]');
  await p.waitForSelector('.sv-err', { timeout: 5000 });
  assert.match(await p.$eval('.sv-err', e => e.textContent), /different name/);
  await typeIn(p, '[data-svyto]', '2027–28');
  await p.$eval('[data-svyeargo]', e => e.click());
  await p.waitForSelector('[data-svsaid]', { timeout: 90000 });
  assert.match(await p.$eval('[data-svsaid]', e => e.textContent), /Everything from 2026–27 is in Grading Studio 2026-27\.gswork/);
  const name = (await files(p)).find(n => n.endsWith('.gswork'));
  assert.equal(name, 'Grading Studio 2026-27.gswork');
  const L = await libOf(p);
  assert.equal(L.year, '2027–28'); assert.equal(L.years[0].name, '2026–27');
  assert.deepEqual(L.classes.map(c => c.names), [[], []], 'empty class lists');
  assert.equal(L.classes[0].units[0].items.length, 4, 'the cards carry');
  assert.equal(L.classes[0].units[0].items.some(i => i.batchId), false, 'no card points at last year’s download');
  assert.equal(await workOf(p, 'gs.b.n1'), null, 'last year’s work left this browser');
  await Promise.all([p.waitForNavigation({ timeout: 30000 }), p.click('dialog[open] [data-ok]')]);
  await p.waitForSelector('[data-svyear]', { timeout: 30000 });
  assert.match(await p.$eval('[data-svyear]', e => e.textContent), /This year: 2027–28.*Archived: 2026–27 in Grading Studio 2026-27\.gswork/);
  // open the archived year: this one is saved first, then last year comes back
  const file = await fileOut(p, name);
  await (await p.$('[data-svyearin]')).uploadFile(file);
  await p.waitForSelector('[data-svp1]'); await typeIn(p, '[data-svp1]', PASS); await p.click('dialog[open] [data-ok]');
  await p.waitForSelector('[data-svyopengo]', { timeout: 60000 });
  assert.match(await p.$eval('[data-svyopengo]', e => e.textContent), /Save 2027–28 and open 2026–27/);
  await Promise.all([p.waitForNavigation({ timeout: 90000 }), p.click('[data-svyopengo]')]);
  await p.waitForSelector('[data-svyear]', { timeout: 30000 });
  assert.ok((await files(p)).includes('Grading Studio 2027-28.gswork'), 'the year that was here went to its own file first');
  const w = await until(() => workOf(p, 'gs.b.n1'));
  assert.ok(w && Object.keys(w.s).length === 6, 'last year’s work is back');
  const L2 = await libOf(p);
  assert.equal(L2.year, '2026–27'); assert.equal(L2.classes[0].names.length, 6);
  assert.deepEqual(L2.years.map(y => y.name), ['2027–28']);
  await p.close();
});

test('remove from this computer: only after typing REMOVE, and the planning and the look stay', async () => {
  const p = await open();
  await settings(p);
  await until(() => workOf(p, 'gs.b.n1'));
  await p.evaluate(() => { localStorage.setItem('gs.theme', 'midnight'); localStorage.setItem('gsp.keepme', '1'); });
  await p.click('[data-svremove]');
  await p.waitForSelector('dialog[open] [data-svrmtype]');
  assert.match(await p.$eval('dialog[open]', e => e.textContent), /2 downloads.*haven’t made a take-home file/);
  assert.equal(await p.$eval('dialog[open] [data-ok]', e => e.disabled), true, 'not until REMOVE is typed');
  await typeIn(p, '[data-svrmtype]', 'remove');
  await Promise.all([p.waitForNavigation({ timeout: 30000 }), p.click('dialog[open] [data-ok]')]);
  await p.waitForSelector('[data-svcarry]', { timeout: 30000 });
  assert.equal(await workOf(p, 'gs.b.n1'), null);
  assert.equal(await p.evaluate(() => localStorage.getItem('gs.lib')), null);
  assert.equal(await p.evaluate(() => localStorage.getItem('gs.theme')), 'midnight');
  assert.equal(await p.evaluate(() => localStorage.getItem('gsp.keepme')), '1');
  await p.close();
});
