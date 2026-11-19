// Two windows at once (stage 6): windows of the new app, and of the new app beside the current one, keep each other's work by the
// current app's own protocol (next/src/shared/tabs.js, students/write.js saveWork with a hold, mark/windows.js). And a browser that
// has only ever opened the new app gets the current app's databases made as the current app makes them, which the current app then
// opens unchanged. npm run next:browser. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip, settle, goToStudent } = require('../../../test/helpers/app.js');
const { standardFiles, zipOf } = require('../../../test/helpers/fixtures.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const onDisk = require('./site-path');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|proof\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p) || onDisk.extra(p);
    const f = onDisk(p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}

let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
// A download of made-up papers, opened and saved once in the current app. Returns its id and the students' keys.
async function makeWork(ctx, errors) {
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.goto(srv.url); await appReady(p);
  await openZip(p, zipOf(await standardFiles()));
  await p.evaluate(() => window.__gs.saveNow()); await settle(p);
  const out = await p.evaluate(() => { const s = window.__gs.state(); return { id: s.batch.id, keys: s.batch.students.map(st => st.key) }; });
  await p.close();
  return out;
}
// The newest saved copy of the download (quick or full), read in the page.
const stored = (p, id) => p.evaluate(id => new Promise(res => {
  const q = (() => { try { return JSON.parse(localStorage.getItem(id)); } catch { return null; } })();
  const r = indexedDB.open('grading-studio-keep');
  r.onsuccess = () => { const db = r.result, g = db.transaction('work').objectStore('work').get(id); g.onsuccess = () => { db.close(); const f = g.result; res(!q ? f : !f ? q : (f.t || 0) > (q.t || 0) ? f : q); }; };
}), id);
const comments = async (p, id, keys) => { const w = await stored(p, id); return keys.map(k => (((w.s || {})[k] || {}).g || {}).comment || ''); };

const openNew = async (ctx, errors, id) => {
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready && document.querySelector('.shell[data-lock="writer"]'), { timeout: 60000 });
  return p;
};
const openOld = async (ctx, errors, id) => {
  const p = await page(ctx, errors);
  await p.goto(srv.url); await appReady(p);
  await p.evaluate(id => window.__gs.reopenKept(id), id);
  await p.waitForFunction(id => window.__gs.state().batch && window.__gs.state().batch.id === id, { timeout: 60000 }, id);
  await settle(p);
  return p;
};
// A comment typed on student i in the new app, and saved.
async function newComment(p, i, text) {
  await p.bringToFront();
  // coming to the front may open the download again with another window's newer work (mark/windows.js): let that finish
  await p.evaluate(() => new Promise(r => setTimeout(r, 1500)));
  await p.waitForFunction(() => window.__mark.ready && document.querySelector('.mk-row[data-st="0"]'), { timeout: 60000 });
  if (await p.evaluate(() => window.__mark.state().cur) !== i) {
    await p.evaluate(i => document.querySelector(`.mk-row[data-st="${i}"]`).click(), i);
    await p.waitForFunction(i => window.__mark.ready && window.__mark.state().cur === i, { timeout: 60000 }, i);
  }
  await p.click('.mk-cmt');
  await p.waitForFunction(() => document.activeElement && document.activeElement.matches('.mk-cmt, .mk-cmt *'));
  await p.keyboard.type(text);
  await p.evaluate(() => window.__mark.saved());
}
// The same in the current app, through its own grade and save.
async function oldComment(p, i, text) {
  await p.bringToFront();
  // coming to the front, the current app opens the download again with the other window's newer work (src/saving.js tabsCatchUp)
  await p.evaluate(() => new Promise(r => setTimeout(r, 2500)));
  await p.waitForFunction(() => window.__gs.state().batch && !window.__gs.state().batch.catching, { timeout: 60000 });
  await goToStudent(p, i);
  await p.evaluate((i, text) => { const s = window.__gs.state(); s.batch.students[i].grade.comment = text; return window.__gs.saveNow(); }, i, text);
  await settle(p);
}

test('two windows of the new app mark one download: each keeps the other’s work, and the window behind opens the newer work when she comes back to it', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const { id, keys } = await makeWork(ctx, errors);
  const a = await openNew(ctx, errors, id), b = await openNew(ctx, errors, id);   // both open before either saves
  await newComment(a, 0, 'From window A.');
  await newComment(b, 1, 'From window B.');
  assert.deepEqual((await comments(a, id, keys)).slice(0, 2), ['From window A.', 'From window B.'], 'B’s save merged A’s in, never wrote over it');
  // A again, on student 2: its own save keeps B's too
  await newComment(a, 2, 'A again.');
  assert.deepEqual((await comments(a, id, keys)).slice(0, 3), ['From window A.', 'From window B.', 'A again.']);
  // B, coming back to the front, opens the newer work on the student it was on
  await b.bringToFront(); await b.evaluate(() => window.dispatchEvent(new Event('focus')));
  await b.waitForFunction(() => { const s = window.__mark.state(); return window.__mark.ready && s.batch.students[2].grade.comment === 'A again.'; }, { timeout: 60000 });
  assert.equal(await b.evaluate(() => window.__mark.state().cur), 1, 'still on the student she was on');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the new app beside the current app: either window saving keeps the other’s work', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const { id, keys } = await makeWork(ctx, errors);
  const old = await openOld(ctx, errors, id), nx = await openNew(ctx, errors, id);
  assert.equal(await old.evaluate(() => !!document.getElementById('gsWriterBlock')), false, 'the current app is not covered');
  await oldComment(old, 0, 'From the current app.');
  await newComment(nx, 1, 'From the new app.');   // the new app is behind the current app's save: it merges
  assert.deepEqual((await comments(nx, id, keys)).slice(0, 2), ['From the current app.', 'From the new app.']);
  await oldComment(old, 2, 'Current app again.');   // and the current app is behind the new app's: it merges by its own rule
  assert.deepEqual((await comments(nx, id, keys)).slice(0, 3), ['From the current app.', 'From the new app.', 'Current app again.']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the library beside the current app: a class renamed in the new app and a to-do added in the current app both stay', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p0 = await page(ctx, errors); await p0.goto(srv.url + 'blank'); await plant(p0, gradingSeed()); await p0.close();
  const old = await page(ctx, errors); await old.goto(srv.url + '#/todo'); await appReady(old);
  const pr = await page(ctx, errors); await pr.goto(srv.url + 'next/proof.html'); await pr.waitForFunction(() => !!window.__next);
  assert.equal(await pr.evaluate(() => window.__next.start()), 'writer', 'the new app writes beside the current app');
  await pr.evaluate(() => window.__next.write.saveLibrary(l => { l.classes[0].name = 'Renamed in the new app'; }));
  await old.bringToFront();
  await old.waitForSelector('#tdIn'); await old.click('#tdIn'); await old.keyboard.type('Added in the current app'); await old.keyboard.press('Enter');
  await old.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).todo, { timeout: 20000 });
  const lib = await pr.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));
  assert.equal(lib.classes[0].name, 'Renamed in the new app');
  assert.ok(lib.todo.items.some(it => it.x === 'Added in the current app'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('another window replacing everything: the new app saves what is waiting, stops writing, covers itself and reloads when it is done', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const { id, keys } = await makeWork(ctx, errors);
  const nx = await openNew(ctx, errors, id);
  await nx.click('.mk-cmt'); await nx.waitForFunction(() => document.activeElement && document.activeElement.matches('.mk-cmt, .mk-cmt *'));
  await nx.keyboard.type('Half typed.');   // not saved yet (the half-second wait)
  const pr = await page(ctx, errors); await pr.goto(srv.url + 'next/proof.html'); await pr.waitForFunction(() => !!window.__next);
  await pr.evaluate(() => window.__next.start());
  await pr.evaluate(() => window.__next.tabs.finish());
  assert.equal((await comments(pr, id, keys))[0], 'Half typed.', 'what was waiting was saved before the other window went on');
  const reloads = nx.waitForNavigation({ timeout: 30000 });
  await pr.evaluate(() => window.__next.tabs.over('go'));
  await nx.waitForSelector('[data-tabover]');
  assert.equal(await nx.evaluate(() => window.__next === undefined && !!document.querySelector('[data-tabover]')), true);
  await pr.evaluate(() => window.__next.tabs.over('done'));
  await reloads;
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The databases, as the browser holds them: version, and each store's keyPath, autoIncrement and indexes.
const shapes = p => p.evaluate(async () => {
  const out = {};
  for (const { name, version } of await indexedDB.databases()) {
    const db = await new Promise(r => { const q = indexedDB.open(name); q.onsuccess = () => r(q.result); });
    const st = {};
    for (const s of [...db.objectStoreNames].sort()) { const o = db.transaction(s).objectStore(s); st[s] = { keyPath: o.keyPath, auto: o.autoIncrement, idx: [...o.indexNames] }; }
    out[name] = { version, st }; db.close();
  }
  return out;
});
test('a browser with only the new app: every database it writes to is made as the current app makes it, and the current app opens them unchanged', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const pr = await page(ctx, errors); await pr.goto(srv.url + 'next/proof.html'); await pr.waitForFunction(() => !!window.__next);
  await pr.evaluate(() => window.__next.start());
  const names = await pr.evaluate(() => Object.keys(window.__next.idb.SHAPES));
  // the first write to each makes it: here a strong example (grading-studio-examples), and every other one by ensure
  await pr.evaluate(() => window.__next.write.keepExample({ id: 'ex1', t: 1, name: 'Made-up example' }, []));
  for (const n of names) assert.equal(await pr.evaluate(n => window.__next.idb.ensure(n), n), true, n);
  const made = await shapes(pr);
  assert.deepEqual(Object.keys(made).sort(), [...names].sort());
  for (const n of names) {
    const want = await pr.evaluate(n => window.__next.idb.SHAPES[n], n);
    assert.equal(made[n].version, want[0], n);
    assert.deepEqual(Object.keys(made[n].st), Object.keys(want[1]).sort(), n);
    for (const [s, k] of Object.entries(want[1])) assert.deepEqual(made[n].st[s], { keyPath: k, auto: false, idx: [] }, n + '/' + s);
  }
  // ensure never upgrades a database that is there
  assert.equal(await pr.evaluate(() => window.__next.idb.ensure('grading-studio-keep')), true);
  // the current app's pages open on them: no upgrade, no error, and its own work goes in
  const g = await page(ctx, errors); await g.goto(srv.url + 'blank'); await plant(g, gradingSeed()); await g.goto(srv.url); await appReady(g);
  await openZip(g, zipOf(await standardFiles()));
  await g.evaluate(() => window.__gs.saveNow()); await settle(g);
  const pl = await page(ctx, errors); await pl.goto(srv.url + 'planner.html'); await pl.waitForFunction(() => !!window.__planner, { timeout: 60000 });
  const after = await shapes(g);
  for (const n of names) assert.deepEqual(after[n], made[n], n + ' unchanged by the current app');
  assert.ok(await g.evaluate(() => window.__gs.kept().has(window.__gs.state().batch.id)), 'the current app kept its download in the database the new app made');
  assert.deepEqual(errors, []);
  await ctx.close();
});
