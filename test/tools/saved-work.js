// npm run saved-work: work made with main's pages still opens, unchanged, in this build's pages at the same address.
//
//   node test/tools/saved-work.js                    against origin/main's pages
//   node test/tools/saved-work.js --against <commit> against that commit's pages
//
// Browsers keep saved work by address, so what matters is one address whose pages change underneath the work.
// The check, with the clock stopped:
//
//   1. main's pages make work once: a class with a term of scores, an assignment opened from a ZIP, marks, scores, a comment,
//      a late file, a timetable and a lesson in the Planner. Chrome is closed and its profile copied twice.
//   2. From each copy every screen is opened and nothing is changed: once with main's pages again, once with this build's.
//   3. Everything the browser keeps (every localStorage entry, every IndexedDB record, bytes compared by their SHA-256)
//      is read after each, and so is what the app shows for the assignment and the lesson.
//
// The two have to match exactly. Opening a screen can rewrite a record (a "last opened" time, say), which is why this
// build is held against main doing the same steps and not against the work as it was first made.
// Last, main's pages open the work once more after this build has had it, in case a change has to be taken back.
// The same is done for the copy that is double-clicked from a folder (a file:// address).
//
// A change that means to alter what is stored says which records in test/saved-work-changed.txt, in the same pull request
// (one per line: localStorage:<key> or <database>/<store>/<key>, * for any run of letters). The file only counts when
// it differs from main's copy. Nothing listed there may be work that is lost: the report shows before and after.
//
// Every student, class and lesson here is made up.
const fs = require('fs'), os = require('os'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { launch } = require('../helpers/chrome');
const { plant, appReady, openZip, goToStudent, score, markPage, settle, goTo, builtHtml } = require('../helpers/app');
const { standardFiles, zipOf } = require('../helpers/fixtures');
const { loadLegacy } = require('../helpers/legacy');
const { STEADY, serveBuild, gradingSeed, PLAN_SETUP, makeLesson, pagesAt, changedList, matches } = require('../helpers/steady');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const plannerReady = page => page.waitForFunction(() => window.__planner && document.querySelector('#lessons'), { timeout: 60000 });
// Every save the app has started has landed in both of its places.
const savedAll = page => page.waitForFunction(async () => {
  const ids = Object.keys(JSON.parse(localStorage.getItem('gs.batches') || '{}')).filter(id => localStorage.getItem(id)); if (!ids.length) return true;
  const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); if (!db) return false;
  const ws = await Promise.all(ids.map(id => new Promise(res => { const q = db.transaction('work').objectStore('work').get(id); q.onsuccess = () => res(q.result); q.onerror = () => res(null); })));
  db.close(); return ids.every((id, i) => ws[i] && ws[i].t === JSON.parse(localStorage.getItem(id)).t);
}, { timeout: 20000, polling: 100 });

// Everything this address keeps, as { 'localStorage:key': text, 'db/store/key': json }. Bytes are shown as their length and SHA-256.
// viaNext: read it all through the new app's saved-work layer instead (next/proof.html must be open), in the same form.
const snapshot = (page, viaNext) => page.evaluate(async viaNext => {
  const out = {}, hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  const flat = async v => {
    if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) { const u = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength); return { bytes: u.length, sha256: hex(await crypto.subtle.digest('SHA-256', u)) }; }
    if (v instanceof Blob) { const u = await v.arrayBuffer(); return { blob: v.type, bytes: u.byteLength, sha256: hex(await crypto.subtle.digest('SHA-256', u)) }; }
    if (v instanceof Date) return { date: v.getTime() };
    if (v instanceof Map) return { map: await flat([...v.entries()]) };
    if (v instanceof Set) return { set: await flat([...v.values()]) };
    if (Array.isArray(v)) return Promise.all(v.map(flat));
    if (v && typeof v === 'object') { if (typeof FileSystemHandle !== 'undefined' && v instanceof FileSystemHandle) return { handle: v.kind + ':' + v.name }; const o = {}; for (const k of Object.keys(v).sort()) o[k] = await flat(v[k]); return o; }
    return v === undefined ? { undefined: true } : v;
  };
  if (viaNext) {
    const d = await window.__next.dumpRaw();
    for (const [k, v] of Object.entries(d.ls)) out['localStorage:' + k] = v;
    for (const [n, x] of Object.entries(d.dbs)) out['(database) ' + n] = 'version ' + x.version + ', stores ' + x.stores.join(' ');
    for (const [k, v] of Object.entries(d.idb)) out[k] = JSON.stringify(await flat(v));
    for (const u of d.unknown) out['(not in the registry) ' + u] = 'unknown';
    return out;
  }
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out['localStorage:' + k] = localStorage.getItem(k); }
  for (const d of await indexedDB.databases()) {
    const db = await new Promise((res, rej) => { const r = indexedDB.open(d.name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    out['(database) ' + d.name] = 'version ' + db.version + ', stores ' + [...db.objectStoreNames].sort().join(' ');
    for (const s of db.objectStoreNames) {
      const got = await new Promise((res, rej) => { const tx = db.transaction(s), o = tx.objectStore(s), a = o.getAll(), b = o.getAllKeys(); tx.oncomplete = () => res({ k: b.result, v: a.result }); tx.onerror = () => rej(tx.error); });
      for (let i = 0; i < got.k.length; i++) out[d.name + '/' + s + '/' + (typeof got.k[i] === 'string' ? got.k[i] : JSON.stringify(got.k[i]))] = JSON.stringify(await flat(got.v[i]));
    }
    db.close();
  }
  return out;
}, !!viaNext);

// One place the two pages live: a web address, or a folder they are double-clicked from.
async function placeFor(kind, pages) {
  if (kind === 'web') { const srv = await serveBuild(pages); return { url: n => srv.url + (n === 'index' ? '' : n === 'planner' ? 'planner.html' : n.startsWith('next/') ? n : 'blank'), show: () => {}, close: () => srv.close() }; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-test-copy-')), u = f => 'file://' + path.join(dir, f).split(path.sep).map(encodeURIComponent).join('/').replace(/%3A/g, ':');
  const show = () => { fs.writeFileSync(path.join(dir, 'Grading Studio.html'), pages.index); fs.writeFileSync(path.join(dir, 'Planner.html'), pages.planner); fs.writeFileSync(path.join(dir, 'blank.html'), '<!doctype html><title>blank</title>'); };
  show();
  return { url: n => u(n === 'index' ? 'Grading Studio.html' : n === 'planner' ? 'Planner.html' : 'blank.html'), show, close: async () => fs.rmSync(dir, { recursive: true, force: true }) };
}
async function newPage(ctx) {
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', e => page.errors.push(String(e).split('\n')[0].slice(0, 300)));
  page.on('dialog', d => d.accept());
  await page.emulateTimezone('UTC');
  await page.evaluateOnNewDocument(STEADY);
  await page.setViewport({ width: 1366, height: 768 });
  return page;
}

// Step 1: the work, made through the app. Returns the ids the later steps open.
async function makeWork(ctx, place) {
  const page = await newPage(ctx);
  await page.goto(place.url('blank')); await plant(page, gradingSeed());
  await page.goto(place.url('index')); await appReady(page);
  await openZip(page, zipOf(await standardFiles()), 'River essay.zip');
  await markPage(page, 0); await score(page, [3.5, 3, 4]);
  await page.type('#comment', 'A clear opening. Next time, link each paragraph back to the question.').catch(() => {});
  await goToStudent(page, 1); await score(page, [3, 2.5, null]);
  await page.evaluate(async () => { await window.__gs.addFiles(window.__gs.state().batch.students[1], [{ path: 'Late page.txt', file: new File(['handed in late'], 'Late page.txt') }], true); await window.__gs.saveNow(); });
  await goToStudent(page, 0);
  await settle(page);
  const A = await page.evaluate(() => window.__gs.state().batch.id.replace(/^gs\.b\./, ''));
  await goTo(page, '#/'); await savedAll(page);
  await page.goto(place.url('planner')); await plannerReady(page);
  await page.evaluate(async s => { await window.__planner.applySetup(s); }, PLAN_SETUP);
  const L = await makeLesson(page);
  await sleep(400);
  const errors = page.errors.slice();
  await page.close();
  return { A, L, errors };
}
// Step 2: every screen opened, nothing changed. Returns what the app shows, and any error the pages reported.
async function walk(ctx, place, { A, L }) {
  const page = await newPage(ctx), seen = {};
  const at = async (hash, ready) => { await goTo(page, hash); if (ready) await page.waitForSelector(ready, { timeout: 20000 }); await sleep(150); };
  await page.goto(place.url('index')); await appReady(page);
  await at('#/', '#railClasses a');
  seen.sidebar = await page.$$eval('#railClasses a[data-railcls]', xs => xs.map(a => a.textContent.replace(/\s+/g, ' ').trim()));
  await at('#/class/c1', '#vClass:not([hidden]) .cls');
  await at('#/class/c1/gradebook', '#bkTab');
  // Each student's row: their name, then every figure in the row in sorted order, so the gradebook's columns can move
  // between builds while the scores it shows for each student still have to match exactly.
  seen.gradebook = await page.$$eval('#bkTab tbody tr', rs => rs.map(r => { const t = [...r.children].map(c => c.innerText.replace(/\s+/g, ' ').trim()); return t[0] + ': ' + t.slice(1).sort().join(' | '); }));
  await at('#/class/c1/students', '#peopleTbl table');
  await at('#/class/c1/students/2');
  await at('#/class/c1/charts');
  await at('#/a/' + A);
  await page.waitForFunction(() => !!window.__gs.state().batch, { timeout: 30000 });
  await goToStudent(page, 0);
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.pages.length > 0 && s.pages[0].s > 0 && !!s.pages[0].bmp; }, { timeout: 30000 });
  await goToStudent(page, 1); await goToStudent(page, 3); await goToStudent(page, 0);
  seen.assignment = await page.evaluate(() => {
    const b = window.__gs.state().batch;
    return { name: b.name, students: b.students.map(s => ({ key: s.key, grade: s.grade, status: s.status || '', files: s.files.map(f => ({ path: f.path, bytes: f.data ? f.data.byteLength || f.data.length : 0, marks: f.marks, rot: f.rot, added: !!f.added })) })) };
  });
  for (const t of ['/grades', '/grades/sheet', '/insights', '/insights/consistency', '/return']) await at('#/a/' + A + t, '#dlg.aspage');
  seen.grades = await (async () => { await at('#/a/' + A + '/grades', '#dlg.aspage'); return page.$eval('#dlg', e => e.innerText.replace(/\s+/g, ' ').trim()); })();   // every word and number in order; where a line breaks is the layout's (a row to check became a table row again, 1.27.34)
  for (const k of ['saving', 'classes', 'terms', 'grading', 'marking', 'timetable', 'display', 'claude', 'keys']) await at('#/settings/' + k);
  await at('#/', '#railClasses a');
  await savedAll(page); await sleep(500);
  const errors = page.errors.slice();
  await page.goto(place.url('planner') + '#week'); await plannerReady(page);
  await page.goto(place.url('blank'));
  await page.goto(place.url('planner') + '#lesson/' + L); await plannerReady(page);
  await page.waitForFunction(() => !!window.__planner.L.open, { timeout: 20000 }).catch(() => {});   // the lesson opens last, once the classes and everything else have been read
  seen.planner = await page.evaluate(() => { const P = window.__planner.L; return { classes: (P.setup && P.setup.classes || []).map(c => c.name), lessons: P.lessons.map(l => ({ id: l.id, title: l.title, slots: l.slots, slides: l.slides.map(s => [s.layout, s.title, s.body]) })), open: P.open && P.open.title }; });
  await sleep(500);
  errors.push(...page.errors);
  await page.goto(place.url('blank'));
  const kept = await snapshot(page);
  await page.close();
  return { seen, kept, errors };
}
// The work is made once, by main's pages, in a Chrome profile that is then closed. Each run starts from its own copy of
// that profile, so both start from the very same bytes; then the pages named in then walk through it in turn.
async function runs(kind, old, thens) {
  const pages = { ...old }, place = await placeFor(kind, pages), workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-saved-work-'));
  try {
    let browser = await launch({ userDataDir: workDir, keepProfile: true }), ids, made;
    try {
      ids = await makeWork(browser.defaultBrowserContext(), place);
      const p = await newPage(browser.defaultBrowserContext()); await p.goto(place.url('blank')); made = await snapshot(p); await p.close();
    } finally { await browser.close(); }
    const out = [];
    for (const then of thens) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-saved-work-'));
      fs.cpSync(workDir, dir, { recursive: true, filter: f => !/Singleton/.test(path.basename(f)) });
      browser = await launch({ userDataDir: dir });
      try {
        const ctx = browser.defaultBrowserContext(), walks = [];
        Object.assign(pages, old); place.show();
        const p = await newPage(ctx); await p.goto(place.url('blank')); const start = await snapshot(p); await p.close();
        for (const b of then) { Object.assign(pages, b); place.show(); walks.push(await walk(ctx, place, ids)); }
        out.push({ made, start, makeErrors: ids.errors, walks });
      } finally { await browser.close(); }
    }
    return out;
  } finally { await place.close(); fs.rmSync(workDir, { recursive: true, force: true }); }
}
// The new app (next/): its saved-work layer reads every record main's pages left exactly as they are, and every record written back
// through it opens in main's pages unchanged. Web address only: the new app has no double-clicked copy. Always run, since the
// layer can change even when the current app's pages don't.
const proofOpen = async (ctx, place) => { const p = await newPage(ctx); await p.goto(place.url('next/proof.html')); await p.waitForFunction(() => !!window.__next, { timeout: 20000 }); return p; };
const copyProfile = from => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-saved-work-')); fs.cpSync(from, dir, { recursive: true, filter: f => !/Singleton/.test(path.basename(f)) }); return dir; };
// The browser's private folder, every file under the linked folder's data directory, as { path: sha256 of its text }.
const folderTree = page => page.evaluate(async () => {
  const out = {}, hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  let root; try { root = await (await navigator.storage.getDirectory()).getDirectoryHandle('Linked'); } catch { return out; }
  try { root = await root.getDirectoryHandle('Grading Studio'); } catch {}
  // Main's pages write a download's record with its fields in the order they were last set, which varies with timing, and its work
  // timer fills gs.focus's base (each download's marked count) in the background as it gets to each one. Neither is work: a file
  // is compared by what it reads as, its fields sorted, and library.json without that base.
  const sort = v => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])])) : v;
  const same = (f, t) => { let o; try { o = JSON.parse(t); } catch { return t; }
    if (f === 'library.json' && o && o.ls && typeof o.ls['gs.focus'] === 'string') { try { const x = JSON.parse(o.ls['gs.focus']); delete x.base; o.ls['gs.focus'] = JSON.stringify(sort(x)); } catch {} }
    return JSON.stringify(sort(o)); };
  const walk = async (d, pre) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await walk(h, pre + n + '/'); else { const t = same(pre + n, await (await h.getFile()).text()); out[pre + n] = t.length > 400 ? 'sha256 ' + hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))) : t; } } };
  await walk(root, ''); return out;
});
// Like inProfile, but keeps the profile afterwards.
async function inProfile2(dir, fn) { const browser = await launch({ userDataDir: dir, keepProfile: true }); try { return await fn(browser.defaultBrowserContext()); } finally { await browser.close(); } }
async function inProfile(dir, fn) { const browser = await launch({ userDataDir: dir }); try { return await fn(browser.defaultBrowserContext()); } finally { await browser.close(); fs.rmSync(dir, { recursive: true, force: true }); } }
// Google, as far as main's sync uses it, played in the page: a sign-in that answers at once, Drive's hidden folder always empty,
// and every upload kept. Nothing leaves the computer. D.body is the last sync file sent.
async function fakeDrive(page) {
  const D = { body: null };
  await page.evaluateOnNewDocument(() => {
    window.google = { accounts: { oauth2: { initTokenClient: o => ({ requestAccessToken: () => setTimeout(() => o.callback({ access_token: 'tok', expires_in: 3600, scope: o.scope }), 10) }), revoke: () => {} } } };
  });
  await page.setRequestInterception(true);
  page.on('request', r => (async () => {
    const u = r.url(); if (process.env.SW_DEBUG_DRIVE && /google/.test(u)) console.log('drive:', r.method(), u.slice(0, 160)); if (!/googleapis\.com|accounts\.google\.com/.test(u)) return r.continue();
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match', 'Access-Control-Allow-Methods': 'GET, POST, PATCH', 'Access-Control-Expose-Headers': 'ETag' };
    const json = o => r.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: cors, body: '' });
    if (/\/about\?/.test(u)) return json({ user: { emailAddress: 'teacher@example.com' } });
    if (/drive\/v3\/files\?/.test(u) && r.method() === 'GET') return json({ files: [] });
    if (/upload\/drive\/v3\/files/.test(u)) {   // a new file (multipart) or a file sent again (media): keep the sync file
      const t = r.postData() || await r.fetchPostData() || '', i = t.indexOf('{"app":"Grading Studio sync"');
      if (i >= 0) D.body = /uploadType=multipart/.test(u) ? t.slice(i, t.lastIndexOf('}') + 1) : t.slice(i);
      return json({ id: 'f' + Math.random().toString(36).slice(2), version: '1' });
    }
    return json({});
  })().catch(e => r.respond({ status: 500, body: String(e) }).catch(() => {})));
  return D;
}
async function nextLegs(old) {
  const out = [], bad = m => { out.push('  ' + m); failed = true; }; let failed = false;
  const pages = { ...old }, place = await placeFor('web', pages), workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-saved-work-'));
  try {
    // A browser with nothing saved: the layer reads nothing, and makes no database (that would stop the current app making its own).
    await inProfile(fs.mkdtempSync(path.join(os.tmpdir(), 'gs-saved-work-')), async ctx => {
      const p = await proofOpen(ctx, place);
      const got = await p.evaluate(async () => { const d = await window.__next.dumpRaw(); for (const s of window.__next.students ? Object.values(window.__next.students) : []) if (s && s.entries) await s.entries(); return { d, dbs: (await indexedDB.databases()).map(x => x.name), gaps: window.__next.coverage() }; });
      if (got.dbs.length) bad('Reading an empty browser through the layer made databases: ' + got.dbs.join(', '));
      if (Object.keys(got.d.ls).length || Object.keys(got.d.idb).length) bad('The layer read work from an empty browser.');
      if (got.gaps.length) bad('No typed accessor for: ' + got.gaps.join(', '));
      if (!failed) out.push('  An empty browser: the layer reads nothing and makes no database, and every store and work key has a typed accessor.');
    });
    // The work, made by main's pages, as the other checks make it.
    let browser = await launch({ userDataDir: workDir, keepProfile: true }), ids, made;
    try { ids = await makeWork(browser.defaultBrowserContext(), place); const p = await newPage(browser.defaultBrowserContext()); await p.goto(place.url('blank')); made = await snapshot(p); await p.close(); } finally { await browser.close(); }
    const n = Object.keys(made).filter(k => !k.startsWith('(database)')).length;
    // Read through the layer: the same records, and nothing written by reading.
    await inProfile(copyProfile(workDir), async ctx => {
      const p = await proofOpen(ctx, place), via = await snapshot(p, true); await p.goto(place.url('blank'));
      const d = differ(made, via), after = differ(made, await snapshot(p));
      if (d.length) bad('Read through the layer, ' + d.length + ' records differ:\n' + d.slice(0, 12).map(x => '    ' + x.key + '\n      kept: ' + short(x.was) + '\n      layer: ' + short(x.now)).join('\n'));
      else out.push('  Read through the layer: all ' + n + ' records main’s pages made are the same, and every name is in the registry.');
      if (after.length) bad('Reading through the layer changed: ' + after.map(x => x.key).join(', '));
    });
    // Written back through the layer: every record the same, and main's pages show and keep the same work as from an untouched copy.
    const base = await inProfile(copyProfile(workDir), ctx => walk(ctx, place, ids));
    await inProfile(copyProfile(workDir), async ctx => {
      const p = await proofOpen(ctx, place);
      const r = await p.evaluate(async () => { const s = await window.__next.start(); if (s !== 'writer') return { s }; const r = await window.__next.rewriteAll(); window.__next.stop(); return { s, ...r }; });
      if (r.s !== 'writer') { bad('The proof page could not get the lock to write (' + r.s + ').'); return; }
      if (r.missing.length) bad('Work written back without a typed accessor: ' + r.missing.join(', '));
      await p.goto(place.url('blank'));
      const d = differ(made, await snapshot(p)); await p.close();
      if (d.length) bad('Written back through the layer, ' + d.length + ' records differ:\n' + d.slice(0, 12).map(x => '    ' + x.key + '\n      was: ' + short(x.was) + '\n      now: ' + short(x.now)).join('\n'));
      else out.push('  Written back through the typed accessors (' + r.records + ' records): every one is the same.');
      const w = await walk(ctx, place, ids), kd = differ(base.kept, w.kept), same = JSON.stringify(base.seen) === JSON.stringify(w.seen);
      if (kd.length || !same || w.errors.length) bad('Opened in main’s pages after that: ' + (same ? '' : 'THE APP SHOWS DIFFERENT WORK; ') + kd.length + ' records differ from an untouched copy' + (kd.length ? ' (' + kd.slice(0, 8).map(x => x.key).join(', ') + ')' : '') + (w.errors.length ? '; errors: ' + w.errors.join(' | ') : ''));
      else out.push('  Opened in main’s pages after that: the same scores, marks, comments, files and lesson as an untouched copy, and the same records.');
    });
    // A change made through the layer shows in main's pages: a lesson renamed, and a comment changed.
    await inProfile(copyProfile(workDir), async ctx => {
      const p = await proofOpen(ctx, place);
      const who = await p.evaluate(async (L, A) => {
        await window.__next.start(); const N = window.__next;
        const l = (await N.planning.lessons.entries()).map(e => e[1]).find(x => x.id === L); await N.planning.lessons.put({ ...l, title: 'Reading a poem aloud, again' });
        const id = 'gs.b.' + A, w = await N.students.work.get(id); w.t = (w.t || 0) + 1; const who = Object.keys(w.s).find(k => w.s[k] && w.s[k].g); if (!who) throw new Error('no scored student in ' + JSON.stringify(Object.keys(w))); w.s[who].g.comment = 'Changed through the new layer.'; await N.students.work.put(w, id);
        const q = N.students.quick.json(A); if (q) { q.t = w.t; q.s[who].g.comment = w.s[who].g.comment; N.students.quick.setJson(A, q); }
        const ix = N.students.quickList.json({}); if (ix[id] != null) { ix[id] = w.t; N.students.quickList.setJson(ix); }
        N.stop(); return who;
      }, ids.L, ids.A);
      await p.close();
      // main's marking screen, opened on that download, before anything else has opened it
      const com = await (async () => {
        const q = await newPage(ctx); await q.goto(place.url('index') + '#/a/' + ids.A); await appReady(q);
        await q.waitForFunction(who => { const b = window.__gs.state().batch, s = b && b.students.find(x => x.key === who); return !!(s && s.grade && s.grade.comment); }, { timeout: 20000 }, who).catch(() => {});
        const c = await q.evaluate(who => { const b = window.__gs.state().batch, s = b && b.students.find(x => x.key === who); return s ? s.grade.comment : '(no such student: ' + who + ')'; }, who);
        await q.close(); return c;
      })();
      const w = await walk(ctx, place, ids);
      const title = (w.seen.planner.lessons.find(l => l.id === ids.L) || {}).title;
      if (title !== 'Reading a poem aloud, again' || com !== 'Changed through the new layer.') bad('A change made through the layer did not show in main’s pages: lesson "' + title + '", comment "' + com + '"');
      else out.push('  A lesson renamed and a comment changed through the layer show in main’s pages.');
    });
    // Home's counts (stage 2): the new app's Home works out the same numbers as main's Today for the same saved work: today's
    // classes, sets of papers to mark and to hand back, and lessons still to plan. Main's own functions give its side.
    await inProfile(copyProfile(workDir), async ctx => {
      const q = await newPage(ctx); await q.goto(place.url('index') + '#/'); await appReady(q);
      // Main keeps these functions to itself, so its side is read off Today as drawn: a class row is a link, a set to mark a row
      // in "To mark", a set to hand back a row in "Ready to hand back"; lessons to plan are its to-do list's own rows of that kind.
      await q.waitForFunction(() => /Teaching today|timetable/.test((document.querySelector('#today') || {}).textContent || ''), { timeout: 30000 });
      await sleep(1500);
      // missing work (stage 5): main's To do lines that remind about missing work, once main has read the gradebook for them
      await q.waitForFunction(() => !window.__gs.bgBusy(), { timeout: 30000 });
      const mainSide = await q.evaluate(() => ({ classesToday: document.querySelectorAll('#today a.trow').length, mark: document.querySelectorAll('#toMark .krow').length,
        back: document.querySelectorAll('#handBack .krow.back').length, toPlan: window.__gs.todoRows().filter(r => !r.own && r.kind === 'plan' && !r.done).length,
        missing: window.__gs.todoRows().filter(r => !r.own && r.kind === 'miss' && !r.done).length }));
      await q.close();
      const p = await proofOpen(ctx, place), nextSide = (await p.evaluate(() => window.__next.crossings.countsForHome())).counts; await p.close();
      if (JSON.stringify(mainSide) !== JSON.stringify(nextSide)) bad('Home’s counts differ from main’s Today: main ' + JSON.stringify(mainSide) + ', new app ' + JSON.stringify(nextSide));
      else out.push('  Home’s counts are main’s Today’s: ' + JSON.stringify(nextSide) + '.');
    });
    // The write path (stage 2): the same change, made once in main's pages and once through the layer's save functions, leaves the
    // same records, the same files in the linked folder, and the same Drive sync file. A folder (the browser's private one) is
    // linked first by main's pages, as a teacher would. The change: a comment typed on a student, and a class renamed.
    {
      const linked = copyProfile(workDir);
      await inProfile2(linked, async ctx => {
        const q = await newPage(ctx); await q.goto(place.url('index') + '#/'); await appReady(q);
        await q.evaluate(() => { localStorage.setItem('gs.gcid', JSON.stringify('1234-test.apps.googleusercontent.com')); localStorage.setItem('gs.gEmail', JSON.stringify('teacher@example.com')); });
        await q.evaluate(async () => { const h = await (await navigator.storage.getDirectory()).getDirectoryHandle('Linked', { create: true }); await window.__gs.folderUse(h); await window.__gs.folderWait(); });
        // The download opened and saved once with nothing changed, as a teacher who has worked on it before: main's pages fill in what
        // an open download always carries (an empty "moved" list and the like), so both changes below start from the same records.
        await q.goto(place.url('index') + '#/a/' + ids.A); await appReady(q);
        await q.waitForFunction(() => { const b = window.__gs.state().batch; return !!(b && b.revs); }, { timeout: 30000 }); await sleep(1000);
        await q.evaluate(async () => { await window.__gs.saveNow(); await window.__gs.folderWait(); });
        await sleep(500); await q.evaluate(() => window.__gs.folderWait());
        await q.close();
      });
      // And opened once more in a new browser session, so what main's pages do on opening with a folder linked (the whole folder
      // compared again, each download's row filled in) is done before either change.
      await inProfile2(linked, async ctx => {
        const q = await newPage(ctx); await q.goto(place.url('index') + '#/a/' + ids.A); await appReady(q);
        await q.waitForFunction(() => { const b = window.__gs.state().batch, f = window.__gs.folderState(); return !!(b && b.revs && f.at && f.state === 'ok'); }, { timeout: 30000 });
        await sleep(2000); await q.evaluate(() => window.__gs.folderWait());
        await q.close();
      });
      const TOUCHED = k => /^localStorage:gs\.(b\..+|batches|lib|rolls|words)$/.test(k) || /^grading-studio-keep\/(work|meta)\//.test(k);
      const FOLDER = f => /^(library|tombstones)\.json$/.test(f) || /^downloads\/[^/]+\/(work|info)\.json$/.test(f);
      const COMMENT = 'Changed through one save path.', NAME = 'Grade 9 English (renamed)';
      const viaMain = await inProfile(copyProfile(linked), async ctx => {
        const q = await newPage(ctx), D = await fakeDrive(q); await q.goto(place.url('index') + '#/a/' + ids.A); await appReady(q);
        await q.waitForFunction(() => { const b = window.__gs.state().batch; return !!(b && b.revs); }, { timeout: 30000 }); await sleep(1000);
        const who = await q.evaluate(async (C, N) => {
          try {
            const b = window.__gs.state().batch, st = b.students.find(s => s.grade && (s.grade.rubric || []).some(v => v != null)) || b.students[0];
            st.grade.comment = C; await window.__gs.saveNow();
            window.__gs.state().lib.classes[0].name = N; window.__gs.saveLib();
            await window.__gs.folderWait(); return st.key;
          } catch (e) { throw new Error('main’s pages could not save: ' + e.stack); }
        }, COMMENT, NAME);
        await sleep(500); await q.evaluate(() => window.__gs.folderWait());
        // main's pages put the library in the folder a moment after saveLib, later still on a busy machine: wait until it holds the rename
        await q.waitForFunction(async N => { try { let d = await (await navigator.storage.getDirectory()).getDirectoryHandle('Linked'); try { d = await d.getDirectoryHandle('Grading Studio'); } catch {} return (await (await (await d.getFileHandle('library.json')).getFile()).text()).includes(N); } catch { return false; } }, { polling: 250, timeout: 20000 }, NAME).catch(() => {});
        await q.evaluate(() => window.__gs.folderWait());
        const folder = await folderTree(q);
        // Main's own sync, Drive played here with nothing in it yet, so what goes up is built from this browser's storage alone.
        D.body = null; await q.evaluate(async () => { await window.__gs.gIn(); await window.__gs.syncNow(); });
        if (!D.body) throw new Error('main’s pages sent no sync file: ' + await q.evaluate(() => JSON.stringify({ say: (document.querySelector('[data-sync], #syncState, .gline') || {}).textContent, at: localStorage.getItem('gs.syncAt'), em: localStorage.getItem('gs.gEmail') })));
        const pay = D.body;
        await q.goto(place.url('blank'));
        return { who, kept: await snapshot(q), folder, pay };
      });
      const viaNext = await inProfile(copyProfile(linked), async ctx => {
        const p = await proofOpen(ctx, place);
        const r = await p.evaluate(async (A, who, C, N) => {
          const X = window.__next; if (await X.start() !== 'writer') return { err: 'no lock' };
          await X.write.saveWork('gs.b.' + A, d => { d.s[who].g.comment = C; });
          await X.write.saveLibrary(l => { l.classes[0].name = N; });
          await X.whole.settled();
          const pay = JSON.stringify(await X.whole.syncPayload());
          X.stop(); return { pay, folderState: X.whole.folderState(), carry: X.LS_LOCAL };
        }, ids.A, viaMain.who, COMMENT, NAME);
        if (r.err) return r;
        await p.goto(place.url('blank'));
        return { ...r, kept: await snapshot(p), folder: await folderTree(p) };
      });
      const base = process.env.SW_DUMP ? await inProfile(copyProfile(linked), async ctx => { const q = await newPage(ctx); await q.goto(place.url('blank')); return { kept: await snapshot(q), folder: await folderTree(q) }; }) : null;
      if (process.env.SW_DUMP) fs.writeFileSync(process.env.SW_DUMP, JSON.stringify({ base, viaMain, viaNext }));
      if (viaNext.err) bad('The write-path proof could not write through the layer: ' + viaNext.err);
      else {
        // A record main's pages save from the download on screen keeps its empty fields as fields holding undefined (the snapshot
        // writes those as {"undefined":true}); the layer leaves them out. Read back, sent to the folder or to Drive, they are the same.
        const noUndef = v => JSON.stringify(JSON.parse(v), (k, x) => (x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length === 1 && x.undefined === true ? undefined : x));
        const pick = (o, f) => Object.fromEntries(Object.entries(o).filter(([k]) => f(k)).map(([k, v]) => [k, /^grading-studio-keep\//.test(k) && typeof v === 'string' ? noUndef(v) : v]));
        const dk = differ(pick(viaMain.kept, TOUCHED), pick(viaNext.kept, TOUCHED)), df = differ(pick(viaMain.folder, FOLDER), pick(viaNext.folder, FOLDER));
        const strip = o => { delete o.t; delete o.planT; delete o.files; return o; }, pm = strip(JSON.parse(viaMain.pay)), pn = strip(JSON.parse(viaNext.pay)), dp = Object.keys({ ...pm, ...pn }).filter(k => canon(pm[k]) !== canon(pn[k]));
        const src = fs.readFileSync(path.join(ROOT, 'src/folder.js'), 'utf8'), lsLocal = /const LS_LOCAL = \/(.+)\/;/.exec(src)[1];
        if (lsLocal !== viaNext.carry) bad('What travels with the work differs from src/folder.js LS_LOCAL: ' + viaNext.carry);
        if (dk.length) bad('The same change through the layer left ' + dk.length + ' records different from main’s pages:\n' + dk.slice(0, 10).map(x => '    ' + x.key + '\n      main: ' + short(x.was) + '\n      layer: ' + short(x.now)).join('\n'));
        else out.push('  The same change (a comment, a class renamed) saved through the layer leaves the same ' + Object.keys(pick(viaNext.kept, TOUCHED)).length + ' work, quick-copy, library, roster and words records as main’s pages.');
        if (df.length || viaNext.folderState !== 'ok') bad('The linked folder after a layer save (' + viaNext.folderState + ') differs from main’s pages in ' + df.length + ' files:\n' + df.slice(0, 10).map(x => '    ' + x.key + '\n      main: ' + short(x.was) + '\n      layer: ' + short(x.now)).join('\n'));
        else out.push('  The linked folder: library.json, tombstones.json and each download’s work.json and info.json are the same as main’s pages write.');
        if (dp.length) bad('The Drive sync file built after a layer save differs from main’s in: ' + dp.join(', ') + dp.slice(0, 3).map(k => '\n    ' + k + '\n      main: ' + short(JSON.stringify(pm[k])) + '\n      layer: ' + short(JSON.stringify(pn[k]))).join(''));
        else out.push('  The Drive sync file built from storage after the save is the same as main’s, part for part (Drive’s own answers, planT and files, left out of both).');
      }
      fs.rmSync(linked, { recursive: true, force: true });
    }
  } finally { await place.close(); fs.rmSync(workDir, { recursive: true, force: true }); }
  // Work saved by the old format (test/fixtures/legacy-v1) reads through the layer the same.
  const leg = await loadLegacy(), pl = await placeFor('web', { ...old });
  try {
    await inProfile(fs.mkdtempSync(path.join(os.tmpdir(), 'gs-saved-work-')), async ctx => {
      const p = await newPage(ctx); await p.goto(pl.url('blank')); await plant(p, leg.seed());
      const raw = await snapshot(p); await p.goto(pl.url('next/proof.html')); await p.waitForFunction(() => !!window.__next);
      const d = differ(raw, await snapshot(p, true));
      if (d.length) bad('Old-format work (legacy-v1) read through the layer, ' + d.length + ' records differ: ' + d.slice(0, 8).map(x => x.key).join(', '));
      else out.push('  Old-format work (test/fixtures/legacy-v1, ' + Object.keys(raw).length + ' records) reads through the layer the same.');
    });
  } finally { await pl.close(); }
  return { failed, text: 'Through the new app’s saved-work layer (next/):\n' + out.join('\n') + '\n' };
}
const short = v => v == null ? '(nothing)' : v.length > 300 ? v.slice(0, 300) + '… (' + v.length + ' characters)' : v;
// The records that differ between two readings.
// JSON with every object's keys in order: two files that say the same thing in a different key order read the same.
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(n => [n, x[n]])) : x));
function differ(a, b) {
  const out = [];
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) if (a[k] !== b[k]) out.push({ key: k, was: a[k], now: b[k] });
  return out;
}

(async () => {
  const args = process.argv.slice(2), ai = args.indexOf('--against'), ref = ai >= 0 ? args[ai + 1] : 'origin/main';
  const old = pagesAt(ref);
  if (!old) { console.error('Can’t read the pages of ' + ref + '. Try: git fetch origin main'); process.exit(1); }
  builtHtml();
  const cur = { index: fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), planner: fs.readFileSync(path.join(ROOT, 'planner.html'), 'utf8') };
  const t0 = Date.now(), ok = changedList('test/saved-work-changed.txt', ref);
  let failed = false, report = '';
  if (old.index === cur.index && old.planner === cur.planner) report += 'The pages are the same as ' + ref + '’s, byte for byte, so saved work is read by the same code.\n';
  else for (const kind of ['web', 'copy']) {
    const where = kind === 'web' ? 'On the web address' : 'In the double-clicked copy';
    const [base, next] = await runs(kind, old, [[old], [cur, old]]);
    const n = Object.keys(base.made).length;
    const errs = [['while main’s pages made the work', base.makeErrors], ['with main’s pages', base.walks[0].errors], ['with this build’s pages', next.walks[0].errors], ['with main’s pages after this build’s', next.walks[1].errors]].filter(e => e[1].length);
    const unsteady = differ(base.made, base.start).concat(differ(base.made, next.start));
    if (unsteady.length) { failed = true; report += where + ': the two runs did not start from the same work, so the check can’t compare them. Differing records:\n' + unsteady.slice(0, 10).map(d => '  ' + d.key).join('\n') + '\n'; continue; }
    const stored = differ(base.walks[0].kept, next.walks[0].kept), shown = JSON.stringify(base.walks[0].seen) === JSON.stringify(next.walks[0].seen);
    const back = differ(next.walks[0].kept, next.walks[1].kept).filter(d => base.walks[0].kept[d.key] !== d.now), backShown = JSON.stringify(base.walks[0].seen) === JSON.stringify(next.walks[1].seen);
    const listed = d => ok.some(p => matches(p, d.key)), surprise = stored.filter(d => !listed(d));
    report += where + ': ' + n + ' saved records made with ' + ref + '’s pages.\n';
    if (!stored.length && shown) report += '  Opened in this build: every record is the same, and the app shows the same scores, marks, comments, files and lesson.\n';
    if (stored.length) report += '  Opened in this build, these records differ from what ' + ref + '’s pages leave:\n' + stored.map(d => '    ' + d.key + (listed(d) ? '  (listed in test/saved-work-changed.txt)' : '  NOT LISTED') + '\n      main: ' + short(d.was) + '\n      this: ' + short(d.now)).join('\n') + '\n';
    if (!shown) { failed = true; report += '  THE APP SHOWS DIFFERENT WORK in this build:\n' + Object.keys(base.walks[0].seen).filter(k => JSON.stringify(base.walks[0].seen[k]) !== JSON.stringify(next.walks[0].seen[k])).map(k => '    ' + k + '\n      main: ' + short(JSON.stringify(base.walks[0].seen[k])) + '\n      this: ' + short(JSON.stringify(next.walks[0].seen[k]))).join('\n') + '\n'; }
    if (surprise.length) failed = true;
    if (!back.length && backShown) report += '  Opened in ' + ref + '’s pages again afterwards: still the same, so the change can be taken back.\n';
    else { if (!backShown || back.some(d => !listed(d))) failed = true; report += '  Opened in ' + ref + '’s pages again afterwards, ' + (backShown ? '' : 'THE APP SHOWS DIFFERENT WORK and ') + back.length + ' record' + (back.length === 1 ? ' differs' : 's differ') + ':\n' + back.map(d => '    ' + d.key + (listed(d) ? '  (listed)' : '  NOT LISTED')).join('\n') + '\n'; }
    if (errs.length) { failed = true; report += '  The pages reported errors ' + errs.map(e => e[0] + ':\n' + e[1].map(x => '    ' + x).join('\n')).join('\n  and ') + '\n'; }
  }
  { const nx = await nextLegs(old); report += nx.text; if (nx.failed) failed = true; }
  report += '\n' + (failed ? 'FAILED: saved work would not survive this change as it stands.' : 'Saved work survives this change.') + ' ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s.';
  console.log('\n' + report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Saved work\n```\n' + report.trim() + '\n```\n');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
