// The new app's own sample builder (stage 6, item 4): opening the sample in the new app fills it from the same sample.js the current
// app uses, with the new app's own parts, and marks it made with the same stamp, so the current app opens that sample as it is.
// Everything in the sample is invented.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const onDisk = require('./site-path');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp' };
// Both apps at one address, with sample.js beside the current app's page, as on the web.
function serveBoth() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html';
    if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index\.html|sample\.js|next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp)))$/.test(p) || onDisk.extra(p), f = onDisk(p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
let browser, srv;
before(async () => { srv = await serveBoth(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });
const stamp = () => /window\.__gsSampleData\.api = "(\w+)"/.exec(fs.readFileSync(path.join(ROOT, 'classic', 'sample.js'), 'utf8'))[1];
const count = (p, db, store) => p.evaluate((db, store) => new Promise(res => { const r = indexedDB.open(db); r.onupgradeneeded = () => r.transaction.abort(); r.onsuccess = () => { const d = r.result; if (!d.objectStoreNames.contains(store)) { d.close(); return res(0); } const q = d.transaction(store).objectStore(store).count(); q.onsuccess = () => { d.close(); res(q.result); }; }; r.onerror = () => res(0); }), db, store);

test('the sample opened in the new app is filled in by the new app, and the current app opens it as it is', async () => {
  const p = await browser.newPage();
  if (process.env.SHOW) { p.on('console', m => console.log('PAGE', m.type(), m.text().slice(0, 300))); p.on('pageerror', e => console.log('PAGEERR', e.message)); }
  await p.goto(srv.url + 'blank');
  await p.evaluate(async () => { localStorage.clear(); for (const d of await indexedDB.databases()) await new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = r; }); localStorage.setItem('gs.sampleOn', '1'); });
  await p.goto(srv.url + 'next/#/home');
  await p.waitForFunction(() => localStorage.getItem('gs.sampleBuilt'), { timeout: 120000, polling: 300 });   // the sample's own names, as the page sees them
  await p.waitForSelector('[data-shell-nav], nav.tabbar', { timeout: 60000 });   // started again on the finished sample
  await p.goto(srv.url + 'blank');
  const ls = await p.evaluate(() => ({ built: localStorage.getItem('sample:gs.sampleBuilt'), lib: JSON.parse(localStorage.getItem('sample:gs.lib') || 'null'), school: localStorage.getItem('sample:gs.school'), own: localStorage.getItem('gs.lib') }));
  assert.equal(ls.built, JSON.stringify(stamp()), 'marked made with the same stamp the current app uses');
  assert.equal(ls.own, null, 'nothing went to the teacher’s own work');
  assert.ok(ls.lib && ls.lib.classes.length >= 2, 'the made-up classes');
  const cards = ls.lib.classes.flatMap(c => c.units.flatMap(u => u.items));
  assert.ok(cards.filter(i => i.batchId).length >= 4, 'cards linked to their papers');
  assert.ok(ls.school, 'the school’s links');
  assert.ok(await count(p, 'sample-grading-studio-keep', 'work') >= 4, 'marked work');
  assert.ok(await count(p, 'sample-grading-studio-keep', 'papers') >= 4, 'papers');
  assert.ok(await count(p, 'sample-grading-studio-examples', 'ex') >= 2, 'strong examples');
  assert.ok(await count(p, 'sample-gs-lessons', 'lessons') >= 5, 'a week of lessons');
  // the current app takes it as made: no second build
  await p.goto(srv.url + 'index.html#/');
  await p.waitForFunction(() => window.__gs && window.__gs.sampleBuilt, { timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
  assert.equal(await p.evaluate(() => window.__gs.sampleBuilt()), true);
  assert.equal(await p.$('#sampleCover'), null, 'the current app did not make it again');
  await p.close();
});
