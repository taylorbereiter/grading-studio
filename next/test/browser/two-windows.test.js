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

let browser, srv, pages = 0;
const START = Date.now();
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  // Windows as a teacher's are: the clock moves on from the stopped time, the same clock in every window, and each window has its
  // own random numbers, so its own id (shared/tabs.js TAB, src/saving.js TAB). With the clock stopped, a window's save stamp
  // ("<window>:<time>:full") came out the same as its stamp before, and the other window could only tell it had saved by catching
  // the stamp between its two writes: a window that heard it late took the save for one it had seen and wrote over it.
  await p.evaluateOnNewDocument((start, n) => { const D0 = Object.getPrototypeOf(Date), T = Date.now(); Date.now = () => T + (D0.now() - start); for (let i = 0; i < n; i++) Math.random(); }, START, 97 * ++pages);
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
// A window come back to the front has caught up once it shows the newest saved comments and is not in the middle of opening the
// download again. It looks when it gets the focus (mark/windows.js, src/saving.js tabsCatchUp), at the save stamp in its own copy of
// localStorage, which the browser brings over from the window that saved a moment later; on a busy computer that can be after the
// focus, and the window then only notes the save (its next save merges) and catches up the next time she comes back. So the stamp
// is let arrive first (it names the time of the full copy, which every window reads at once), and then the window gets its focus.
async function upToDate(p, id, kind) {
  await p.waitForFunction(id => new Promise(res => {
    const st = localStorage.getItem('gsc.saved.' + id), r = indexedDB.open('grading-studio-keep');
    r.onsuccess = () => { const db = r.result, g = db.transaction('work').objectStore('work').get(id); g.onsuccess = () => { db.close(); res(!!st && !!g.result && st.split(':')[1] === String(g.result.t)); }; };
  }), { timeout: 60000, polling: 100 }, id);
  await p.evaluate(() => window.dispatchEvent(new Event('focus')));
  await p.waitForFunction((id, kind) => new Promise(res => {
    const b = kind === 'new' ? window.__mark && window.__mark.ready && window.__mark.state().batch : window.__gs.state().batch;
    if (!b || b.catching || b.reopening) return res(false);
    const q = (() => { try { return JSON.parse(localStorage.getItem(id)); } catch { return null; } })();
    const r = indexedDB.open('grading-studio-keep');
    r.onsuccess = () => { const db = r.result, g = db.transaction('work').objectStore('work').get(id); g.onsuccess = () => { db.close(); const f = g.result, w = !q ? f : !f ? q : (f.t || 0) > (q.t || 0) ? f : q; res(b.students.every(st => ((((w.s || {})[st.key] || {}).g || {}).comment || '') === (st.grade.comment || ''))); }; };
  }), { timeout: 60000, polling: 100 }, id, kind);
}
// A comment typed on student i in the new app, and saved.
async function newComment(p, i, text, id) {
  await p.bringToFront();
  // coming to the front opens the download again with another window's newer work (mark/windows.js): it has once it shows it
  await upToDate(p, id, 'new');
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
async function oldComment(p, i, text, id) {
  await p.bringToFront();
  // coming to the front, the current app opens the download again with the other window's newer work (src/saving.js tabsCatchUp)
  await upToDate(p, id, 'old');
  await goToStudent(p, i);
  await p.evaluate((i, text) => { const s = window.__gs.state(); s.batch.students[i].grade.comment = text; return window.__gs.saveNow(); }, i, text);
  await settle(p);
}

test('two windows of the new app mark one download: each keeps the other’s work, and the window behind opens the newer work when she comes back to it', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const { id, keys } = await makeWork(ctx, errors);
  const a = await openNew(ctx, errors, id), b = await openNew(ctx, errors, id);   // both open before either saves
  await newComment(a, 0, 'From window A.', id);
  await newComment(b, 1, 'From window B.', id);
  assert.deepEqual((await comments(a, id, keys)).slice(0, 2), ['From window A.', 'From window B.'], 'B’s save merged A’s in, never wrote over it');
  // A again, on student 2: its own save keeps B's too
  await newComment(a, 2, 'A again.', id);
  assert.deepEqual((await comments(a, id, keys)).slice(0, 3), ['From window A.', 'From window B.', 'A again.']);
  // B, coming back to the front, opens the newer work on the student it was on
  await b.bringToFront(); await upToDate(b, id, 'new');
  assert.equal(await b.evaluate(() => window.__mark.state().batch.students[2].grade.comment), 'A again.');
  assert.equal(await b.evaluate(() => window.__mark.state().cur), 1, 'still on the student she was on');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the new app beside the current app: either window saving keeps the other’s work', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const { id, keys } = await makeWork(ctx, errors);
  const old = await openOld(ctx, errors, id), nx = await openNew(ctx, errors, id);
  assert.equal(await old.evaluate(() => !!document.getElementById('gsWriterBlock')), false, 'the current app is not covered');
  await oldComment(old, 0, 'From the current app.', id);
  await newComment(nx, 1, 'From the new app.', id);   // the new app is behind the current app's save: it merges
  assert.deepEqual((await comments(nx, id, keys)).slice(0, 2), ['From the current app.', 'From the new app.']);
  await oldComment(old, 2, 'Current app again.', id);   // and the current app is behind the new app's: it merges by its own rule
  assert.deepEqual((await comments(nx, id, keys)).slice(0, 3), ['From the current app.', 'From the new app.', 'Current app again.']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The ordering the stopped clock let through: the new app hears the current app's save only after that save is done (a busy window
// handles its storage events late), so it never sees the stamp between the save's two writes. The stamp itself is new, so the new
// app still finds the current app's save and keeps it.
test('the new app hearing the current app’s save only once it is done still keeps it', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const { id, keys } = await makeWork(ctx, errors);
  const old = await openOld(ctx, errors, id);
  const nx = await page(ctx, errors);
  let heard = 0; await nx.exposeFunction('__heardLate', () => { heard++; });
  await nx.evaluateOnNewDocument(() => {
    window.__late = [];
    window.addEventListener('storage', e => {
      if (e.__late || !(e.key || '').startsWith('gsc.saved.')) return;
      e.stopImmediatePropagation();
      const ev = new StorageEvent('storage', { key: e.key, oldValue: e.oldValue, newValue: e.newValue, storageArea: e.storageArea, url: e.url }); ev.__late = 1;
      window.__late.push(ev);
    }, true);
    window.__hearLate = () => { for (const ev of window.__late.splice(0)) { window.dispatchEvent(ev); window.__heardLate(); } };
  });
  await nx.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await nx.waitForFunction(() => window.__mark && window.__mark.ready && document.querySelector('.shell[data-lock="writer"]'), { timeout: 60000 });
  const at = await nx.evaluate(() => window.__mark.state().cur), other = at === 0 ? 1 : 0;
  await oldComment(old, other, 'From the current app.', id);
  assert.equal((await comments(old, id, keys))[other], 'From the current app.', 'the current app saved');
  // the save's stamps reach the new app's window a moment later (between processes); held there until the save is done
  await nx.waitForFunction(id => { const st = localStorage.getItem('gsc.saved.' + id); return /:full$/.test(st || '') && window.__late.some(e => e.newValue === st); }, { timeout: 20000, polling: 100 }, id);
  await nx.evaluate(() => window.__hearLate());   // now, with the current app's save done and its stamp back to ":full"
  assert.ok(heard > 0, 'the new app heard the save late');
  // coming back to it, the new app compares the stamp with the one it opened (mark/windows.js), and its save does the same
  // (students/write.js saveWork): the stamp is new, so the current app's work is found either way and nothing is written over it
  await newComment(nx, at, 'From the new app.', id);
  const c = await comments(nx, id, keys);
  assert.deepEqual([c[other], c[at]], ['From the current app.', 'From the new app.']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// She comes back to the new app and goes straight on typing in the comment box, while the download opens again with the current
// app's newer work: the box comes back with the focus and the caret where it was, and every key she typed is there and saved.
test('typing straight away in the new app as it catches up: the box keeps the focus and caret, and nothing typed is dropped', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const { id, keys } = await makeWork(ctx, errors);
  const nx = await openNew(ctx, errors, id);
  const at = await nx.evaluate(() => window.__mark.state().cur), other = at === 0 ? 1 : 0;
  await newComment(nx, at, 'Good start.', id);
  const old = await openOld(ctx, errors, id);
  await oldComment(old, other, 'From the current app.', id);
  // the current app's save has reached this window, so coming back to it opens the download again
  await nx.waitForFunction(id => { const st = localStorage.getItem('gsc.saved.' + id); return /:full$/.test(st || '') && st !== window.__mark.state().batch.seen; }, { timeout: 20000, polling: 100 }, id);
  // her caret in the comment, after "Good", and she comes back to the window and types at once
  const was = await nx.evaluate(() => { const b = window.__mark.state().batch, ta = document.querySelector('.mk-cmt'); ta.focus(); ta.setSelectionRange(4, 4); window.__was = b; return b.id; });
  await nx.bringToFront(); await nx.evaluate(() => window.dispatchEvent(new Event('focus')));
  await nx.keyboard.type(' and clear', { delay: 25 });   // typed at once, as the download opens again
  await nx.waitForFunction(() => window.__mark.ready && window.__mark.state().batch !== window.__was, { timeout: 30000, polling: 100 });
  assert.equal(was, id);
  await nx.waitForFunction(() => document.querySelector('.mk-cmt').value === 'Good and clear start.', { timeout: 20000, polling: 100 });
  assert.equal(await nx.evaluate(() => document.activeElement === document.querySelector('.mk-cmt') && document.activeElement.selectionStart), 14, 'the focus and caret are back, after what she typed');
  await nx.evaluate(() => window.__mark.saved());
  const c = await comments(nx, id, keys);
  assert.deepEqual([c[at], c[other]], ['Good and clear start.', 'From the current app.']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The same in the current app (src/saving.js tabsCatchUp): she comes back to it and types at once while it opens the download
// again with the new app's newer work.
test('typing straight away in the current app as it catches up: the box keeps the focus and caret, and nothing typed is dropped', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const { id, keys } = await makeWork(ctx, errors);
  const old = await openOld(ctx, errors, id);
  const at = await old.evaluate(() => window.__gs.state().cur), other = at === 0 ? 1 : 0;
  await old.click('#cmtIn'); await old.keyboard.type('Good start.'); await settle(old);   // typed in the box, as she does
  const nx = await openNew(ctx, errors, id);
  await newComment(nx, other, 'From the new app.', id);
  // the new app's save has reached the current app's window, so coming back to it opens the download again
  await old.waitForFunction((id, k) => { const w = JSON.parse(localStorage.getItem(id) || '{}'); return /:full$/.test(localStorage.getItem('gsc.saved.' + id) || '') && ((((w.s || {})[k] || {}).g || {}).comment === 'From the new app.'); }, { timeout: 20000, polling: 100 }, id, keys[other]);
  await old.evaluate(() => { const ta = document.querySelector('#cmtIn'); ta.focus(); ta.setSelectionRange(4, 4); window.__was = window.__gs.state().batch; });
  await old.bringToFront(); await old.evaluate(() => window.dispatchEvent(new Event('focus')));
  await old.keyboard.type(' and clear', { delay: 25 });   // typed at once, as the download opens again
  await old.waitForFunction(() => window.__gs.state().batch !== window.__was && !window.__gs.state().batch.catching, { timeout: 30000, polling: 100 });
  await old.waitForFunction(() => document.querySelector('#cmtIn').value === 'Good and clear start.', { timeout: 20000, polling: 100 });
  assert.equal(await old.evaluate(() => document.activeElement === document.querySelector('#cmtIn') && document.activeElement.selectionStart), 14, 'the focus and caret are back, after what she typed');
  await settle(old);
  const c = await comments(old, id, keys);
  assert.deepEqual([c[at], c[other]], ['Good and clear start.', 'From the new app.']);
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
  // Read where it was written: another window's copy of localStorage catches up a moment later (Chrome hands each window's writes to
  // the others between processes), so reading it in the new app's window straight away could see the library from before the to-do.
  await old.waitForFunction(() => { const t = JSON.parse(localStorage.getItem('gs.lib')).todo; return t && (t.items || []).some(it => it.x === 'Added in the current app'); }, { timeout: 20000 });
  const lib = await old.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));
  assert.equal(lib.classes[0].name, 'Renamed in the new app');
  assert.ok(lib.todo.items.some(it => it.x === 'Added in the current app'));
  // and the new app's window, once the write has reached it, reads the same library: nothing it saves next starts from an older one
  // (polled: the new app's window is behind the current app's, and a window behind draws no frames, so it would never look again)
  await pr.waitForFunction(want => JSON.stringify(JSON.parse(localStorage.getItem('gs.lib'))) === want, { timeout: 20000, polling: 100 }, JSON.stringify(lib));
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
