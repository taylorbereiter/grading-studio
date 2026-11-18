// Keeping a phone and a computer the same through the teacher's own Google Drive (src/app/drive.js), and the phone's own screens
// (src/phone.js). Google is played by this test: every request to it is answered here, from one file held in memory, so nothing
// leaves the computer. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { launch } = require('./helpers/chrome');
const { openApp, builtHtml, appReady } = require('./helpers/app');
const { serve } = require('./helpers/serve');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture'];
const GCID = '1234-test.apps.googleusercontent.com';
function seed(extra = {}) {
  const lib = {
    classes: [{ id: 'c1', name: 'Grade 9 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [
      { id: 'i1', name: 'Poetry quiz', classId: 'c1', type: 'ic', due: '2026-11-10', typed: { max: 10, s: { 'Aria Testwell': { v: 8, t: 1000 } } } },
    ] }] }],
    loose: { id: '', units: [] }, seed2627: true,
  };
  return { ls: { 'gs.lib': JSON.stringify(lib), 'gs.gcid': JSON.stringify(GCID), 'gs.gEmail': JSON.stringify('teacher@example.com'), ...extra } };
}
// One Drive for every page in a test: the hidden app file, its version (Drive's count of changes), and what was asked of it.
function fakeDrive() {
  const D = { body: null, plan: null, planV: 0, etag: 0, readAt: null, blobs: {}, n: 0, writes: 0, refused: 0, afterRead: null, seq: [] };
  D.hook = async page => {
    await page.evaluateOnNewDocument(() => {
      // Google's sign-in script, as far as the app uses it: a key straight away, for whatever was asked
      window.google = { accounts: { oauth2: {
        initTokenClient: o => ({ requestAccessToken: () => (window.__gReq = (window.__gReq || 0) + 1) && setTimeout(() => o.callback({ access_token: 'tok-' + o.scope.length, expires_in: 3600, scope: o.scope }), 10) }),
        revoke: () => {},
      } } };
    });
    await page.setRequestInterception(true);
    page.on('request', r => answer(r).catch(e => { console.error(e); r.respond({ status: 500, body: String(e) }).catch(() => {}); }));
    const answer = async r => {
      const u = r.url();
      if (!/googleapis\.com|accounts\.google\.com/.test(u)) return r.continue();
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match', 'Access-Control-Allow-Methods': 'GET, POST, PATCH', 'Access-Control-Expose-Headers': 'ETag' };
      const json = (o, status = 200, h = {}) => r.respond({ status, headers: { ...cors, ...h }, contentType: 'application/json', body: JSON.stringify(o) });
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: cors, body: '' });
      if (/\/about\?/.test(u)) return json({ user: { emailAddress: 'teacher@example.com' } });
      if (/drive\/v3\/files\?spaces=appDataFolder/.test(u) && /\.dat/.test(decodeURIComponent(u))) return json({ files: Object.entries(D.blobs).map(([id, b]) => ({ id, name: b.name })) });
      // the Planner's own file (src/app/drive.js, planSync)
      if (/drive\/v3\/files\?spaces=appDataFolder/.test(u) && /grading-studio-plan/.test(decodeURIComponent(u))) return json({ files: D.plan ? [{ id: 'f2' }] : [] });
      if (/drive\/v3\/files\/f2\?fields=id,version/.test(u)) return json({ id: 'f2', version: String(D.planV) });
      if (/drive\/v3\/files\/f2\?alt=media/.test(u)) return json(JSON.parse(D.plan));
      if (/upload\/drive\/v3\/files\/f2\?uploadType=media/.test(u) && r.method() === 'PATCH') { D.plan = r.postData() || await r.fetchPostData(); D.planV++; return json({ id: 'f2' }); }
      if (/drive\/v3\/files\?spaces=appDataFolder/.test(u)) return json({ files: D.body ? [{ id: 'f1' }] : [] });
      const blob = u.match(/drive\/v3\/files\/(p\d+)\?alt=media/);
      if (blob && D.failGet) return json({ error: { message: 'Backend Error' } }, 500);
      if (blob) return r.respond({ status: 200, headers: cors, contentType: 'application/octet-stream', body: D.blobs[blob[1]].body });
      if (/drive\/v3\/files\/f1\?fields=id,version/.test(u)) { if (D.readAt != null && D.readAt !== D.etag) D.refused++; D.readAt = null; return json({ id: 'f1', version: String(D.etag) }); }
      if (/drive\/v3\/files\/f1\?alt=media/.test(u)) { D.readAt = D.etag; const out = json(JSON.parse(D.body), 200, { ETag: '"' + D.etag + '"' }); if (D.afterRead) { const f = D.afterRead; D.afterRead = null; f(); } return out; }
      if (/upload\/drive\/v3\/files\/f1\?uploadType=media/.test(u) && r.method() === 'PATCH') {
        D.body = r.postData() || await r.fetchPostData(); D.etag++; D.writes++; D.readAt = null; D.seq.push('sync'); return json({ id: 'f1' });
      }
      if (/upload\/drive\/v3\/files\?uploadType=multipart/.test(u)) {
        const t = r.postData() || await r.fetchPostData() || '', dat = t.match(/"name":"([0-9a-f]+\.dat)"/);
        if (dat && D.failDat) return json({ error: { message: 'Backend Error' } }, 500);
        if (dat) {   // a paper: the part after the metadata, up to the closing boundary
          const b = t.split(/\r\n/)[0], parts = t.split(b), body = parts[2].slice(parts[2].indexOf('\r\n\r\n') + 4, -2), id = 'p' + (++D.n);
          D.blobs[id] = { name: dat[1], body }; D.seq.push('pic'); return json({ id });
        }
        if (/grading-studio-plan\.json/.test(t)) { const b = t.split(/\r\n/)[0], parts = t.split(b); D.plan = parts[2].slice(parts[2].indexOf('\r\n\r\n') + 4, -2); D.planV++; D.planMade = (D.planMade || 0) + 1; return json({ id: 'f2' }); }
        const i = t.indexOf('{"app"'), j = t.lastIndexOf('}');
        D.body = t.slice(i, j + 1); D.etag++; D.writes++; D.readAt = null; D.seq.push('sync'); return json({ id: 'f1' });
      }
      return json({ error: { message: 'not in this test: ' + u } }, 404);
    };
  };
  D.file = () => JSON.parse(D.body);
  D.planFile = () => JSON.parse(D.plan);
  return D;
}
const sync = page => page.evaluate(async () => { await window.__gs.gIn(); return window.__gs.syncNow(); });   // signed in (a press on the Google line), then sync
const typed = (page, id) => page.evaluate(id => { const l = JSON.parse(localStorage.getItem('gs.lib')); for (const c of l.classes) for (const u of c.units) for (const it of u.items) if (it.id === id) return it.typed; return null; }, id);

test('with Renew it by itself turned off, Google’s window never opens by itself: the sync waits and says so, and a press there signs in and syncs; on (the default), it renews by itself', async () => {
  const D = fakeDrive(), srv = await serve(builtHtml());
  const mac = await openApp(browser, { server: srv, seed: seed({ 'gs.gAuto': 'false' }), beforeLoad: D.hook });
  try {
    await mac.page.evaluate(() => window.__gs.syncNow());
    await mac.page.waitForSelector('button#syncState[data-gin]', { timeout: 26000 });
    assert.match(await mac.page.$eval('#syncState', b => b.textContent), /sign in again to sync/);
    assert.equal(await mac.page.evaluate(() => window.__gReq || 0), 0, 'no window opened');
    // focus and coming back to the tab don't open it either
    await mac.page.evaluate(() => { window.dispatchEvent(new Event('focus')); });
    await new Promise(r => setTimeout(r, 300));
    assert.equal(await mac.page.evaluate(() => window.__gReq || 0), 0);
    await mac.page.click('#syncState');
    await mac.page.waitForFunction(() => document.querySelector('#syncState') && !/sign in again/.test(document.querySelector('#syncState').textContent) && window.__gReq === 1, { timeout: 25000 });
    await mac.page.waitForFunction(() => /synced/.test(document.querySelector('#syncState').textContent), { timeout: 15000 });
    assert.ok(D.writes >= 1, 'synced once signed in');
    assert.deepEqual(mac.page.errors, []);
  } finally { await mac.close(); }
  // the default: no key yet, and the sync gets one by itself
  const pc = await openApp(browser, { server: srv, seed: seed(), beforeLoad: fakeDrive().hook });   // a Drive of its own: the choice above travels with her work
  try {
    // the first sync done (its time kept), so the key has come back: the Google line says "synced" from the start, before any sync
    await pc.page.waitForFunction(() => window.__gReq >= 1 && localStorage.getItem('gs.syncAt') && /synced/.test((document.querySelector('#syncState') || {}).textContent || ''), { timeout: 15000 });
    // coming back with the key in its last quarter hour: a new one then, not mid-work
    const n = await pc.page.evaluate(() => window.__gReq);
    await pc.page.evaluate(() => window.__gs.gAge(50 * 60000));
    await pc.page.evaluate(() => { window.dispatchEvent(new Event('focus')); });
    await pc.page.waitForFunction(n => window.__gReq === n + 1, { timeout: 27000 }, n);
    assert.deepEqual(pc.page.errors, []);
  } finally { await pc.close(); await srv.close(); }
});

test('typed-in scores merge student by student: the later change for each student stays, a score taken out stays out', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'merge.js'), 'utf8');
  const M = vm.runInNewContext(src + ';({ typedMerge, mergeLib })', { console, crypto: require('crypto').webcrypto, structuredClone });
  const a = { max: 10, s: { 'Aria Testwell': { v: 8, t: 100 }, 'Bram Sample': { v: 5, t: 300 } } };
  const b = { max: 10, s: { 'Aria Testwell': { v: 9, t: 200 }, 'Cleo Fixture': { v: 7, t: 250 } }, gone: { 'Bram Sample': 400 } };
  const m = JSON.parse(JSON.stringify(M.typedMerge(a, b, false)));
  assert.deepEqual(m.s, { 'Aria Testwell': { v: 9, t: 200 }, 'Cleo Fixture': { v: 7, t: 250 } });
  assert.deepEqual(m.gone, { 'Bram Sample': 400 });
  // scores from before scores had times: the copy changed later decides
  const old = JSON.parse(JSON.stringify(M.typedMerge({ max: 10, s: { 'Aria Testwell': { v: 4 } } }, { max: 20, s: { 'Aria Testwell': { v: 6 } } }, true)));
  assert.deepEqual(old, { max: 20, s: { 'Aria Testwell': { v: 6 } } });
});

test('a score typed on the phone and another typed on the computer both reach both, through one hidden file in Drive', async () => {
  const D = fakeDrive(), srv = await serve(builtHtml());
  const mac = await openApp(browser, { server: srv, seed: seed(), beforeLoad: D.hook });
  const ph = await openApp(browser, { server: srv, seed: seed({ 'gs.phone': '1' }), beforeLoad: D.hook });
  try {
    await sync(mac.page);
    assert.equal(D.writes, 1, 'the computer made the file');
    assert.ok(D.file().lib.classes[0].names.includes('Cleo Fixture'));
    assert.ok(!JSON.stringify(D.file()).includes('"papers":true'), 'where the papers are kept stays on each device');
    // the phone: Scores, the class, the quiz, a score for Bram
    await ph.page.evaluate(() => { location.hash = '#/scores/c1/i1'; });
    await ph.page.waitForSelector('.phin[data-phn="Bram Sample"]');
    assert.ok(await ph.page.$eval('html', h => h.classList.contains('gsphone')));
    await ph.page.type('.phin[data-phn="Bram Sample"]', '6');
    await ph.page.keyboard.press('Enter');
    await ph.page.waitForFunction(() => document.activeElement && document.activeElement.dataset.phn === 'Cleo Fixture');
    // meanwhile on the computer, a score for Cleo and a to-do
    await mac.page.evaluate(() => { const l = window.__gs.state().lib; l.classes[0].units[0].items[0].typed.s['Cleo Fixture'] = { v: 9, t: Date.now() }; window.__gs.saveLib(); });
    await ph.page.waitForFunction(() => /"Bram Sample":\{"v":6/.test(localStorage.getItem('gs.lib')));
    await sync(ph.page);
    await sync(mac.page);
    await sync(ph.page);
    for (const p of [mac.page, ph.page]) {
      const t = await typed(p, 'i1');
      assert.deepEqual(Object.fromEntries(Object.entries(t.s).map(([k, r]) => [k, r.v])), { 'Aria Testwell': 8, 'Bram Sample': 6, 'Cleo Fixture': 9 });
    }
    // only the app's own hidden folder was asked for, never the whole Drive
    assert.deepEqual(mac.page.errors, []); assert.deepEqual(ph.page.errors, []);
  } finally { await mac.close(); await ph.close(); await srv.close(); }
});

test('two devices saving at once: the second sees the file changed, merges again, and nothing is lost', async () => {
  const D = fakeDrive(), srv = await serve(builtHtml());
  const b = await openApp(browser, { server: srv, seed: seed(), beforeLoad: D.hook });
  try {
    await sync(b.page);
    await b.page.evaluate(() => { const l = window.__gs.state().lib; l.classes[0].units[0].items[0].typed.s['Cleo Fixture'] = { v: 4, t: Date.now() }; window.__gs.saveLib(); });
    // just after this device reads the file, another device saves a score for Bram into it
    D.afterRead = () => { const f = D.file(); f.lib.classes[0].units[0].items[0].typed.s['Bram Sample'] = { v: 3, t: Date.now() }; D.body = JSON.stringify(f); D.etag++; };
    await sync(b.page);
    assert.equal(D.refused, 1, 'the out-of-date write was held back');
    await b.page.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('gs.lib')); return l.classes[0].units[0].items[0].typed.s['Bram Sample']; }, { timeout: 15000 });
    await sync(b.page);
    const t = await typed(b.page, 'i1'), f = D.file().lib.classes[0].units[0].items[0].typed;
    assert.equal(t.s['Bram Sample'].v, 3); assert.equal(t.s['Cleo Fixture'].v, 4);
    assert.equal(f.s['Bram Sample'].v, 3); assert.equal(f.s['Cleo Fixture'].v, 4);
    assert.deepEqual(b.page.errors, []);
  } finally { await b.close(); await srv.close(); }
});

test('a download marked on the computer shows on the phone as what is left, with no papers, and the computer keeps its papers', async () => {
  const D = fakeDrive(), srv = await serve(builtHtml());
  const PTS = { mode: 'points', criteria: [], outOf: 20 }, g = points => ({ f: {}, h: {}, g: { rubric: [], points, comment: '' } });
  const work = { t: Date.now() - 6e4, cls: 'c1', setup: PTS, s: { 'Aria Testwell': g('16'), 'Bram Sample': g('14'), 'Cleo Fixture': g('') } };
  const s0 = seed({ 'gs.b.a1': JSON.stringify(work) }), l = JSON.parse(s0.ls['gs.lib']);
  l.classes[0].units[0].items.push({ id: 'i2', name: 'Narrative essay', classId: 'c1', type: 'sum', due: '2026-11-12', batchId: 'gs.b.a1' });
  s0.ls['gs.lib'] = JSON.stringify(l);
  s0.idb = { 'grading-studio-keep': { version: 2, stores: { papers: [], work: [], edits: [], meta: [['gs.b.a1', { id: 'gs.b.a1', name: 'Narrative essay', n: 3, scored: 2, t: work.t, asg: 'i2', papers: true }]] } } };
  const mac = await openApp(browser, { server: srv, seed: s0, beforeLoad: D.hook });
  const ph = await openApp(browser, { server: srv, seed: seed({ 'gs.phone': '1' }), beforeLoad: D.hook });
  try {
    await sync(mac.page); await sync(ph.page);
    await ph.page.evaluate(() => { location.hash = '#/'; });
    await ph.page.waitForFunction(() => /Narrative essay/.test(document.querySelector('#toMark').innerText) && /2 of 3 scored/.test(document.querySelector('#toMark').innerText), { timeout: 15000 });
    assert.ok(!/papers not kept/.test(await ph.page.$eval('#toMark', e => e.innerText)), 'the phone never asks for the papers');
    assert.equal(await ph.page.evaluate(() => window.__gs.kept().get('gs.b.a1').papers), false);
    await sync(ph.page); await sync(mac.page);
    assert.equal(await mac.page.evaluate(() => window.__gs.kept().get('gs.b.a1').papers), true, 'the computer still has its papers');
    assert.deepEqual(mac.page.errors, []); assert.deepEqual(ph.page.errors, []);
  } finally { await mac.close(); await ph.close(); await srv.close(); }
});

test('papers go up to Drive once, after the marks, and another computer fetches them the first time they are opened there', async () => {
  const D = fakeDrive(), srv = await serve(builtHtml());
  const work = { t: Date.now() - 6e4, cls: 'c1', setup: { mode: 'points', criteria: [], outOf: 20 }, s: { 'Aria Testwell': { f: {}, h: {}, g: { rubric: [], points: '16', comment: '' } } } };
  const s0 = seed({ 'gs.b.a1': JSON.stringify(work) }), l = JSON.parse(s0.ls['gs.lib']);
  l.classes[0].units[0].items.push({ id: 'i2', name: 'Narrative essay', classId: 'c1', type: 'sum', due: '2026-11-12', batchId: 'gs.b.a1' });
  s0.ls['gs.lib'] = JSON.stringify(l);
  s0.idb = { 'grading-studio-keep': { version: 2, stores: { papers: [], work: [], edits: [], meta: [['gs.b.a1', { id: 'gs.b.a1', name: 'Narrative essay', n: 1, scored: 1, t: work.t, asg: 'i2', papers: true }]] } } };
  const PAPER = 'pretend paper for Aria, plain letters only';
  const mac = await openApp(browser, { server: srv, seed: s0, beforeLoad: D.hook });
  const other = await openApp(browser, { server: srv, seed: seed(), beforeLoad: D.hook });
  try {
    // the kept papers, put in the way the app keeps them
    await mac.page.evaluate(async text => {
      const db = await new Promise((res, rej) => { const q = indexedDB.open('grading-studio-keep'); q.onsuccess = () => res(q.result); q.onerror = rej; });
      await new Promise((res, rej) => { const t = db.transaction('papers', 'readwrite'); t.objectStore('papers').put({ id: 'gs.b.a1', label: 'Essays', entries: [{ path: 'Aria Testwell/notes.txt', data: new TextEncoder().encode(text) }] }, 'gs.b.a1'); t.oncomplete = res; t.onerror = rej; });
      db.close();
    }, PAPER);
    await sync(mac.page);
    await mac.page.evaluate(() => window.__gs.dvUp());
    assert.equal(Object.keys(D.blobs).length, 1, 'one file in Drive for the one paper');
    assert.equal(Object.values(D.blobs)[0].body, PAPER);
    const listed = D.file().files['gs.b.a1'];
    assert.equal(listed.papers.length, 1); assert.equal(listed.papers[0].path, 'Aria Testwell/notes.txt');
    // sending again sends nothing new
    await mac.page.evaluate(() => window.__gs.dvUp());
    assert.equal(Object.keys(D.blobs).length, 1);
    // the other computer: the download's row, papers waiting in Drive, fetched when asked
    await sync(other.page);
    assert.equal(await other.page.evaluate(() => window.__gs.kept().get('gs.b.a1').papers), false);
    assert.equal(await other.page.evaluate(() => window.__gs.canOpen('gs.b.a1')), true);
    const got = await other.page.evaluate(async () => { const r = await window.__gs.dvPull('gs.b.a1'); return new TextDecoder().decode(r.entries[0].data); });
    assert.equal(got, PAPER);
    assert.equal(await other.page.evaluate(() => window.__gs.kept().get('gs.b.a1').papers), true, 'kept here from then on');
    // a phone: the score from the paper, and that one student's file fetched to look at
    const ph = await openApp(browser, { server: srv, seed: seed({ 'gs.phone': '1' }), beforeLoad: D.hook });
    try {
      await sync(ph.page);
      await ph.page.evaluate(() => { location.hash = '#/scores/c1/i2'; });
      await ph.page.waitForSelector('[data-phsee="Aria Testwell"]', { timeout: 15000 });
      const before = Object.keys(D.blobs).length;
      await ph.page.click('[data-phsee="Aria Testwell"]');
      await ph.page.waitForFunction(() => /notes\.txt opens on your computer/.test(document.querySelector('.phview').innerText), { timeout: 15000 });
      assert.equal(Object.keys(D.blobs).length, before);
      assert.equal(await ph.page.evaluate(() => window.__gs.kept().get('gs.b.a1').papers), false, 'a phone keeps no papers');
      assert.deepEqual(ph.page.errors, []);
    } finally { await ph.close(); }
    assert.deepEqual(mac.page.errors, []); assert.deepEqual(other.page.errors, []);
  } finally { await mac.close(); await other.close(); await srv.close(); }
});

test('the Planner on two devices: each lesson by its own time, each setting by its time, a deleted lesson stays deleted', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'merge.js'), 'utf8');
  const M = vm.runInNewContext(src + ';({ mergePlan })', { console, crypto: require('crypto').webcrypto, structuredClone });
  const A = { lessons: { l1: { id: 'l1', title: 'Mine, later', updated: 300 }, l2: { id: 'l2', title: 'Old', updated: 100 } }, kv: { setup: { v: { a: 1 }, t: 50 }, words: { v: ['x'], t: 400 } }, gone: {} };
  const B = { lessons: { l1: { id: 'l1', title: 'Theirs', updated: 200 }, l3: { id: 'l3', title: 'Only there', updated: 150 } }, kv: { setup: { v: { a: 2 }, t: 60 } }, gone: { 'l:l2': 250, 'l:l9': 10 } };
  const m = JSON.parse(JSON.stringify(M.mergePlan(A, B)));
  assert.deepEqual(Object.keys(m.lessons).sort(), ['l1', 'l3']);
  assert.equal(m.lessons.l1.title, 'Mine, later');
  assert.deepEqual(m.kv.setup.v, { a: 2 }); assert.deepEqual(m.kv.words.v, ['x']);
  assert.deepEqual(m.gone, { 'l:l2': 250, 'l:l9': 10 });
  // written again after it was deleted elsewhere: it comes back, and the deletion is forgotten
  const again = JSON.parse(JSON.stringify(M.mergePlan({ lessons: { l2: { id: 'l2', title: 'Back', updated: 500 } }, kv: {}, gone: {} }, B)));
  assert.equal(again.lessons.l2.title, 'Back'); assert.ok(!again.gone['l:l2']);
});

// The Planner's own store in a page (src/planner/lessons.js keeps it): put records in, read them back.
const planPut = (page, lessons, kv) => page.evaluate(async (lessons, kv) => {
  const db = await new Promise((res, rej) => { const q = indexedDB.open('gs-lessons', 1); q.onupgradeneeded = () => { q.result.createObjectStore('lessons', { keyPath: 'id' }); q.result.createObjectStore('kv'); }; q.onsuccess = () => res(q.result); q.onerror = rej; });
  await new Promise((res, rej) => { const t = db.transaction(['lessons', 'kv'], 'readwrite'); for (const l of lessons) t.objectStore('lessons').put(l); for (const [k, v] of Object.entries(kv || {})) t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = rej; });
  db.close();
}, lessons, kv);
const planGet = page => page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const q = indexedDB.open('gs-lessons'); q.onsuccess = () => res(q.result); q.onerror = rej; });
  if (!db.objectStoreNames.contains('kv')) { db.close(); return null; }
  const t = db.transaction(['lessons', 'kv']), get = r => new Promise(res => { r.onsuccess = () => res(r.result); });
  const out = { lessons: await get(t.objectStore('lessons').getAll()), setup: await get(t.objectStore('kv').get('setup')) };
  db.close(); return out;
});

test('lesson plans and the timetable go from the computer to the phone through Drive, a deletion follows, and the phone shows them under Plans', async () => {
  const D = fakeDrive(), srv = await serve(builtHtml());
  const iso = d => d.toISOString().slice(0, 10), today = iso(new Date()), dow = new Date().getDay();
  const setup = { classes: [{ id: 'k1', name: 'Grade 9 English', color: '#1F6FB2', meets: [{ dow, start: '00:00', end: '23:59' }] }], semStart: '', semEnd: '', daysOff: [] };
  const lesson = { id: 'L1', title: 'Sonnets, day one', slots: [{ classId: 'k1', date: today }], slides: [{ id: 's1', layout: 'content', title: 'What a volta does', body: '• The turn in the poem', notes: 'Read it aloud first' }], created: 1000, updated: Date.now(), _file: 'here-only.html', _mod: 5 };
  const mac = await openApp(browser, { server: srv, seed: seed(), beforeLoad: D.hook });
  const ph = await openApp(browser, { server: srv, seed: seed({ 'gs.phone': '1' }), beforeLoad: D.hook });
  try {
    await planPut(mac.page, [lesson, { id: 'L2', title: 'Spare lesson', slots: [], slides: [], created: 1, updated: Date.now() }], { setup, profMod: 7 });
    await sync(mac.page);
    const f = D.planFile();
    assert.deepEqual(Object.keys(f.lessons).sort(), ['L1', 'L2']);
    assert.ok(!('_file' in f.lessons.L1), 'where a lesson is kept on the computer stays there');
    assert.ok(!('profMod' in f.kv), 'only the Planner records that travel');
    assert.equal(D.file().planT.length > 0, true, 'the main file says when the Planner changed');
    await sync(ph.page);
    let got = await planGet(ph.page);
    assert.deepEqual(got.lessons.map(l => l.title).sort(), ['Sonnets, day one', 'Spare lesson']);
    assert.equal(got.setup.classes[0].name, 'Grade 9 English');
    // Plans on the phone: today's class with its lesson, and the lesson's slides to read
    await ph.page.evaluate(() => { location.hash = '#/plans'; });
    await ph.page.waitForFunction(() => /Sonnets, day one/.test((document.querySelector('#phPlans') || {}).innerText || ''), { timeout: 15000 });
    await ph.page.click('#phPlans a[href="#/plans/L1"]');
    await ph.page.waitForFunction(() => /What a volta does/.test(document.querySelector('#phPlans').innerText) && /Read it aloud first/.test(document.querySelector('#phPlans').innerText), { timeout: 15000 });
    // the computer deletes the spare lesson and renames the class; the phone follows, and the lesson's file stays the computer's own
    await mac.page.evaluate(async () => {
      const db = await new Promise(res => { const q = indexedDB.open('gs-lessons'); q.onsuccess = () => res(q.result); });
      await new Promise(res => { const t = db.transaction(['lessons', 'kv'], 'readwrite'); t.objectStore('lessons').delete('L2'); const k = t.objectStore('kv'), g = k.get('setup'); g.onsuccess = () => { const su = g.result; su.classes[0].name = 'Grade 9 English A'; k.put(su, 'setup'); }; t.oncomplete = res; });
      db.close();
    });
    await planPut(ph.page, [{ ...(await planGet(ph.page)).lessons.find(l => l.id === 'L2'), _file: 'spare.lesson.json', _mod: 9 }]);   // the phone keeps it in a folder too
    await sync(mac.page);
    assert.ok(D.planFile().gone['l:L2']);
    await sync(ph.page);
    got = await planGet(ph.page);
    assert.deepEqual(got.lessons.map(l => l.title), ['Sonnets, day one']);
    assert.equal(got.setup.classes[0].name, 'Grade 9 English A');
    assert.deepEqual(await ph.page.evaluate(async () => { const db = await new Promise(res => { const q = indexedDB.open('gs-lessons'); q.onsuccess = () => res(q.result); }); const v = await new Promise(res => { const r = db.transaction('kv').objectStore('kv').get('syncGoneFiles'); r.onsuccess = () => res(r.result); }); db.close(); return v; }), ['spare.lesson.json'], 'the Planner takes its file out of the folder');
    const macL1 = (await planGet(mac.page)).lessons.find(l => l.id === 'L1');
    assert.equal(macL1._file, 'here-only.html');
    // nothing new on either side: the Planner's file isn't written again
    const v = D.planV; await sync(mac.page); await sync(ph.page); assert.equal(D.planV, v);
    assert.deepEqual(mac.page.errors, []); assert.deepEqual(ph.page.errors, []);
  } finally { await mac.close(); await ph.close(); await srv.close(); }
});

test('the Planner on a second computer: Drive’s settings come first, a store emptied by the phone deletes nothing, a lesson too big to send keeps its pictures, and an older version’s sync makes no second file', async () => {
  const D = fakeDrive(), srv = await serve(builtHtml());
  const setup = n => ({ classes: [{ id: 'k1', name: n, color: '#1F6FB2', meets: [] }], daysOff: [] });
  const a = await openApp(browser, { server: srv, seed: seed(), beforeLoad: D.hook });
  const b = await openApp(browser, { server: srv, seed: seed(), beforeLoad: D.hook });
  try {
    const now = Date.now();
    await planPut(a.page, [{ id: 'L1', title: 'Small', slots: [], slides: [], created: 1, updated: now - 5000 }, { id: 'P1', title: 'Pictures', slots: [], slides: [{ id: 's', title: 'x', body: '' }], created: 1, updated: now - 5000 }], { setup: setup('From the first computer'), bank: { items: ['a'] } });
    await sync(a.page);
    // the second computer already had its own Planner: Drive's timetable comes in, its own lessons go up, and both settle
    await planPut(b.page, [{ id: 'L9', title: 'Only on the second', slots: [], slides: [], created: 1, updated: now - 4000 }], { setup: setup('Old on the second') });
    await sync(b.page); await sync(a.page); await sync(b.page);
    for (const p of [a.page, b.page]) {
      const g = await planGet(p);
      assert.equal(g.setup.classes[0].name, 'From the first computer');
      assert.deepEqual(g.lessons.map(l => l.id).sort(), ['L1', 'L9', 'P1']);
    }
    const v = D.planV; await sync(a.page); await sync(b.page); assert.equal(D.planV, v, 'settled: nothing written again');
    // a lesson that grows past what is sent stays as it is here, and Drive keeps its last copy
    const pic = 'data:image/png;base64,' + 'A'.repeat(2100000);
    const P1 = (await planGet(a.page)).lessons.find(l => l.id === 'P1');
    await planPut(a.page, [{ ...P1, slides: [{ id: 's', title: 'x', body: '', img: { src: pic, w: 1, h: 1 } }], updated: Date.now() }]);
    await planPut(a.page, [{ ...(await planGet(a.page)).lessons.find(l => l.id === 'L1'), title: 'Small, changed', updated: Date.now() }]);
    await sync(a.page);
    assert.equal((await planGet(a.page)).lessons.find(l => l.id === 'P1').slides[0].img.src.length, pic.length);
    assert.ok(D.planFile().lessons.P1 && !D.planFile().lessons.P1.slides[0].img, 'Drive keeps the copy from before');
    assert.equal(D.planFile().lessons.L1.title, 'Small, changed');
    // the second computer's store is emptied (as an iPhone does after weeks unused): it fills again, and nothing is deleted anywhere
    await b.page.evaluate(() => new Promise(res => { const q = indexedDB.deleteDatabase('gs-lessons'); q.onsuccess = q.onerror = q.onblocked = () => res(); }));
    await sync(b.page);
    assert.deepEqual(Object.keys(D.planFile().lessons).sort(), ['L1', 'L9', 'P1']);
    assert.deepEqual(Object.keys(D.planFile().gone), []);
    assert.deepEqual((await planGet(b.page)).lessons.map(l => l.id).sort(), ['L1', 'L9', 'P1']);
    // an older version writes the main file without the Planner's mark: the next sync still finds the Planner's file, and makes no second one
    const f = D.file(); delete f.planT; D.body = JSON.stringify(f); D.etag++;
    await planPut(b.page, [{ id: 'L5', title: 'New on the second', slots: [], slides: [], created: 1, updated: Date.now() }]);
    await sync(b.page);
    assert.equal(D.planMade, 1, 'one Planner file in Drive');
    assert.deepEqual(Object.keys(D.planFile().lessons).sort(), ['L1', 'L5', 'L9', 'P1']);
    assert.deepEqual(a.page.errors, []); assert.deepEqual(b.page.errors, []);
  } finally { await a.close(); await b.close(); await srv.close(); }
});

const hide = (page, h) => page.evaluate(h => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }, h);
test('a change still waiting for its sync goes when the tab is left, never with Google’s window, and a computer left in front takes the phone’s changes every few minutes', async () => {
  const D = fakeDrive(), srv = await serve(builtHtml());
  const mac = await openApp(browser, { server: srv, seed: seed(), beforeLoad: D.hook });
  const ph = await openApp(browser, { server: srv, seed: seed({ 'gs.phone': '1' }), beforeLoad: D.hook });
  try {
    await sync(mac.page); await sync(ph.page);
    await new Promise(r => setTimeout(r, 1500));   // the syncs each page starts as it opens, done
    const asked = await mac.page.evaluate(() => window.__gReq || 0);
    await mac.page.evaluate(() => { const l = window.__gs.state().lib; l.classes[0].units[0].items[0].typed.s['Cleo Fixture'] = { v: 7, t: Date.now() }; window.__gs.saveLib(); });
    await new Promise(r => setTimeout(r, 400));
    assert.notEqual((D.file().lib.classes[0].units[0].items[0].typed.s['Cleo Fixture'] || {}).v, 7, 'waiting its 15 seconds');
    await hide(mac.page, true);
    for (let i = 0; i < 50 && (D.file().lib.classes[0].units[0].items[0].typed.s['Cleo Fixture'] || {}).v !== 7; i++) await new Promise(r => setTimeout(r, 100));
    assert.equal((D.file().lib.classes[0].units[0].items[0].typed.s['Cleo Fixture'] || {}).v, 7, 'sent as the tab was left');
    assert.equal(D.file().lib.classes[0].units[0].items[0].typed.s['Cleo Fixture'].v, 7);
    // out of sight with the key run out: nothing asks Google, and nothing is pulled
    const at = await mac.page.evaluate(() => localStorage.getItem('gs.syncAt'));
    await mac.page.evaluate(async () => { window.__gs.gAge(3 * 3600e3); window.__gs.syncPull(); await window.__gs.syncNow(); });
    await new Promise(r => setTimeout(r, 300));
    assert.equal(await mac.page.evaluate(() => localStorage.getItem('gs.syncAt')), at);
    assert.equal(await mac.page.evaluate(() => window.__gReq || 0), asked, 'no Google window while away');
    await hide(mac.page, false);
    await mac.page.waitForFunction(at => localStorage.getItem('gs.syncAt') !== at, { timeout: 15000 }, at);   // back in front: a new key, then a sync
    // the phone types a score; the computer, left in front, takes it on its next pull with no press
    await ph.page.evaluate(() => { const l = window.__gs.state().lib; l.classes[0].units[0].items[0].typed.s['Bram Sample'] = { v: 5, t: Date.now() }; window.__gs.saveLib(); });
    await sync(ph.page);
    await mac.page.evaluate(() => window.__gs.syncPull());
    await mac.page.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('gs.lib')); const r = l.classes[0].units[0].items[0].typed.s['Bram Sample']; return r && r.v === 5; }, { timeout: 15000 });
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'drive.js'), 'utf8'), /setInterval\(syncPull, 5 \* 60000\)/, 'every five minutes');
    assert.deepEqual(mac.page.errors, []); assert.deepEqual(ph.page.errors, []);
  } finally { await mac.close(); await ph.close(); await srv.close(); }
});

test('focus and planning time reach the other device day by day: the larger of each count, never added twice, and each device keeps its own start of the day', async () => {
  const D = fakeDrive(), srv = await serve(builtHtml());
  const d = new Date(), day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const focus = (x, t) => JSON.stringify({ day, base: {}, last: x, days: { [day]: t }, add: [], qd: [] });
  const mac = await openApp(browser, { server: srv, seed: seed({ 'gs.focus': focus('mark:mac', { s: 1200, n: 1, g: 1500, a: { i1: 1500 } }), 'gsp.planTime': JSON.stringify({ days: { [day]: { l: 600, a: { L1: 600 } } }, names: { L1: 'Sonnets, day one' } }) }), beforeLoad: D.hook });
  const ph = await openApp(browser, { server: srv, seed: seed({ 'gs.phone': '1', 'gs.focus': focus('mark:phone', { s: 1800, n: 2 }), 'gsp.planTime': JSON.stringify({ days: { [day]: { l: 300, f: 300, n: 1, a: { L2: 300 } } }, names: { L2: 'Volta' } }) }), beforeLoad: D.hook });
  try {
    await sync(mac.page); await sync(ph.page); await sync(mac.page); await sync(ph.page);
    for (const [p, last] of [[mac.page, 'mark:mac'], [ph.page, 'mark:phone']]) {
      const f = await p.evaluate(() => JSON.parse(localStorage.getItem('gs.focus'))), t = await p.evaluate(() => JSON.parse(localStorage.getItem('gsp.planTime')));
      assert.equal(f.days[day].s, 1800); assert.equal(f.days[day].n, 2); assert.equal(f.days[day].g, 1500); assert.equal(f.days[day].a.i1, 1500);
      assert.equal(f.last, last, 'the work picked last stays each device’s own');
      assert.deepEqual(t.days[day], { l: 600, f: 300, n: 1, a: { L1: 600, L2: 300 } });
      assert.deepEqual(t.names, { L1: 'Sonnets, day one', L2: 'Volta' });
    }
    const w = D.writes; await sync(mac.page); await sync(ph.page); assert.equal(D.writes, w, 'settled: nothing counted again, nothing written again');
    assert.deepEqual(mac.page.errors, []); assert.deepEqual(ph.page.errors, []);
  } finally { await mac.close(); await ph.close(); await srv.close(); }
});

test('a lesson on the phone shows its pictures and opens its links and videos, and one too big to send says so', async () => {
  const D = fakeDrive(), srv = await serve(builtHtml());
  const d = new Date(), today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const setup = { classes: [{ id: 'k1', name: 'Grade 9 English', color: '#1F6FB2', meets: [{ dow: d.getDay(), start: '00:00', end: '23:59' }] }], daysOff: [] };
  const dot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const L1 = { id: 'L1', title: 'Sonnets, day one', slots: [{ classId: 'k1', date: today }], atlas: 'https://plans.example.com/unit/sonnets', links: [{ id: 'k', name: 'Poem text', url: 'https://poems.example.com/sonnet-18' }],
    slides: [{ id: 's1', title: 'What a volta does', body: 'The turn', img: { src: dot, w: 1, h: 1 } }, { id: 's2', title: 'Watch', body: '', video: { url: 'https://www.youtube.com/watch?v=abc', title: 'A reading' } }, { id: 's3', title: 'Folder picture', body: '', img: { src: 'images/a.png' } }], created: 1, updated: Date.now() };
  const P2 = { id: 'P2', title: 'Pictures galore', slots: [{ classId: 'k1', date: today }], slides: [{ id: 's', title: 'x', body: 'Words '.repeat(360000) }], created: 1, updated: Date.now() };
  const mac = await openApp(browser, { server: srv, seed: seed(), beforeLoad: D.hook });
  const ph = await openApp(browser, { server: srv, seed: seed({ 'gs.phone': '1' }), beforeLoad: D.hook });
  try {
    await planPut(mac.page, [L1, P2], { setup });
    await sync(mac.page);
    assert.ok(!D.planFile().lessons.P2, 'too big to send, even without pictures');
    assert.deepEqual(D.planFile().big.P2.slots, [{ classId: 'k1', date: today }]);
    assert.ok(!JSON.stringify(D.planFile().big).includes('Words Words'), 'only its title and days');
    await sync(ph.page);
    await ph.page.evaluate(() => { location.hash = '#/plans/L1'; });
    await ph.page.waitForFunction(() => /What a volta does/.test((document.querySelector('#phPlans') || {}).innerText || ''), { timeout: 15000 });
    const got = await ph.page.$eval('#phPlans', b => ({ imgs: [...b.querySelectorAll('img')].map(i => i.getAttribute('src').slice(0, 22)), w: [...b.querySelectorAll('img')].map(i => i.style.maxWidth),
      links: [...b.querySelectorAll('a[target=_blank]')].map(a => [a.getAttribute('href'), a.rel, a.textContent]), text: b.innerText }));
    assert.deepEqual(got.imgs, ['data:image/png;base64,']); assert.deepEqual(got.w, ['100%']);
    assert.deepEqual(got.links.map(x => x[0]), ['https://plans.example.com/unit/sonnets', 'https://poems.example.com/sonnet-18', 'https://www.youtube.com/watch?v=abc']);
    assert.ok(got.links.every(x => /noopener/.test(x[1])));
    assert.match(got.links[2][2], /A reading/);
    assert.match(got.text, /A picture, on your computer/, 'one kept only in the computer’s folder');
    // the big one is on its day, and says why it isn't here
    await ph.page.evaluate(() => { location.hash = '#/plans'; });
    await ph.page.waitForFunction(() => /Pictures galore/.test((document.querySelector('#phPlans') || {}).innerText || ''), { timeout: 15000 });
    await ph.page.click('#phPlans a[href="#/plans/P2"]');
    await ph.page.waitForFunction(() => /too big to send to the phone yet/.test(document.querySelector('#phPlans').innerText), { timeout: 15000 });
    assert.doesNotMatch(await ph.page.$eval('#phPlans', b => b.innerText), /next sync/);
    // made small again on the computer: it goes, and the note goes with it
    await planPut(mac.page, [{ ...P2, slides: [{ id: 's', title: 'Now small', body: '' }], updated: Date.now() }]);
    await sync(mac.page); await sync(ph.page);
    assert.ok(D.planFile().lessons.P2 && !D.planFile().big);
    await ph.page.evaluate(() => { location.hash = '#/plans'; }); await ph.page.evaluate(() => { location.hash = '#/plans/P2'; });
    await ph.page.waitForFunction(() => /Now small/.test(document.querySelector('#phPlans').innerText), { timeout: 15000 });
    assert.deepEqual(mac.page.errors, []); assert.deepEqual(ph.page.errors, []);
  } finally { await mac.close(); await ph.close(); await srv.close(); }
});

test('a lesson too big to send reaches the phone as a copy with its pictures in Drive: once each, never back, the computer’s lesson untouched, kept on the phone once seen', async () => {
  const D = fakeDrive(), srv = await serve(builtHtml());
  const d = new Date(), today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const setup = { classes: [{ id: 'k1', name: 'Grade 9 English', color: '#1F6FB2', meets: [{ dow: d.getDay(), start: '00:00', end: '23:59' }] }], daysOff: [] };
  // made-up pictures in plain letters (Drive is played by this test, which keeps text only)
  const b64 = s => 'data:image/png;base64,' + Buffer.from(s).toString('base64');
  const big = b64('pretend picture of a sonnet '.repeat(56000)), shot = b64('pretend screenshot '.repeat(1800));
  const dot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const P3 = { id: 'P3', title: 'Sonnets in pictures', slots: [{ classId: 'k1', date: today }], created: 1, updated: Date.now(), _file: 'here-only.html', _mod: 3, slides: [
    { id: 's1', title: 'The poem', body: 'Read it first', img: { src: big, w: 800, h: 600 }, notes: 'Point at the volta' },
    { id: 's2', title: 'Again', body: '', img: { src: big, w: 800, h: 600 }, ctx: [{ id: 'c1', src: shot, w: 1, h: 1, note: '' }, { id: 'c2', src: dot, w: 1, h: 1, note: '' }] },
    { id: 's3', title: 'Watch', body: '', video: { url: 'https://www.youtube.com/watch?v=abc', title: 'A reading', thumb: b64('t'.repeat(30000)) } }] };
  const mac = await openApp(browser, { server: srv, seed: seed(), beforeLoad: D.hook });
  const ph = await openApp(browser, { server: srv, seed: seed({ 'gs.phone': '1' }), beforeLoad: D.hook });
  const macP3 = async () => JSON.stringify((await planGet(mac.page)).lessons.find(l => l.id === 'P3'));
  const ref = /^gsblob:[0-9a-f]{64}:\d+:image\/png$/;
  try {
    await planPut(mac.page, [P3], { setup });
    const before = await macP3();
    assert.ok(before.length > 2e6);
    await sync(mac.page);
    let f = D.planFile();
    assert.ok(!f.lessons.P3 && !(f.big && f.big.P3), 'not as it is, and not on the list of lessons too big to send');
    const c = f.lite.P3;
    assert.match(c.slides[0].img.src, ref); assert.equal(c.slides[1].img.src, c.slides[0].img.src);
    assert.match(c.slides[1].ctx[0].src, ref); assert.equal(c.slides[1].ctx[1].src, dot, 'a small picture stays in the lesson');
    assert.ok(!c.slides[2].video.thumb, 'a video goes as its link');
    assert.ok(!('_file' in c), 'where it is kept on the computer stays there');
    assert.equal(c.slides[0].notes, 'Point at the volta');
    assert.equal(Object.keys(D.blobs).length, 2, 'each picture once');
    assert.equal(await macP3(), before, 'the computer’s lesson is just as it was');
    // nothing new: nothing sent; a change to the lesson: a new copy, no picture sent again
    let n = D.n, v = D.planV; await sync(mac.page); assert.equal(D.n, n); assert.equal(D.planV, v);
    await planPut(mac.page, [{ ...JSON.parse(await macP3()), title: 'Sonnets in pictures, again', updated: Date.now() }]);
    const edited = await macP3();
    await sync(mac.page);
    assert.equal(D.n, n, 'no picture sent twice'); assert.equal(D.planFile().lite.P3.title, 'Sonnets in pictures, again');
    assert.equal(await macP3(), edited);
    // the phone: the copy, marked as one, and the lesson with its pictures fetched from Drive
    await sync(ph.page);
    let got = (await planGet(ph.page)).lessons.find(l => l.id === 'P3');
    assert.equal(got._lite, 1); assert.equal(got.title, 'Sonnets in pictures, again');
    const open = async () => {
      await ph.page.evaluate(() => { location.hash = '#/plans'; }); await ph.page.evaluate(() => { location.hash = '#/plans/P3'; });
      await ph.page.waitForFunction(() => /Point at the volta/.test((document.querySelector('#phPlans') || {}).innerText || '') && !document.querySelector('#phPlans .phpic:not(.off)'), { timeout: 15000 });
      return ph.page.$eval('#phPlans', b => ({ imgs: [...b.querySelectorAll('img')].map(i => i.getAttribute('src').slice(0, 5)), off: b.querySelectorAll('.phpic.off').length, text: b.innerText }));
    };
    let seen = await open();
    assert.deepEqual(seen.imgs, ['blob:', 'blob:', 'blob:', 'data:']); assert.equal(seen.off, 0);
    assert.doesNotMatch(seen.text, /on your computer|too big/);
    const bytes = await ph.page.evaluate(async () => { const img = document.querySelector('#phPlans img'); return (await (await fetch(img.src)).text()).slice(0, 24); });
    assert.equal(bytes, 'pretend picture of a son');
    assert.equal(await ph.page.evaluate(async () => (await (await caches.open('gs-lesson-pictures')).keys()).length), 2, 'kept on the phone');
    // the phone's sync never sends the copy back, or counts it deleted
    await planPut(ph.page, [{ id: 'X1', title: 'Spare', slots: [], slides: [], created: 1, updated: Date.now() }]);
    await sync(ph.page);
    f = D.planFile();
    assert.ok(!f.lessons.P3 && f.lite.P3 && !f.gone['l:P3']);
    assert.ok(f.lessons.X1);
    v = D.planV; await sync(ph.page); await sync(mac.page); assert.equal(D.planV, v, 'settled');
    // Drive can't be reached: kept pictures still show; one not kept yet says it shows once online
    D.failGet = true;
    await ph.page.reload(); seen = await open();
    assert.deepEqual(seen.imgs, ['blob:', 'blob:', 'blob:', 'data:']);
    await ph.page.evaluate(() => caches.delete('gs-lesson-pictures'));
    await ph.page.reload(); seen = await open();
    assert.deepEqual(seen.imgs, ['data:']); assert.equal(seen.off, 3);
    assert.match(seen.text, /shows here once the phone is online/);
    D.failGet = false;
    // a picture that doesn't go up: no copy, and the phone says it is on its way; the next sync sends it
    D.failDat = true;
    const P4 = { id: 'P4', title: 'Maps of the poem', slots: [{ classId: 'k1', date: today }], created: 1, updated: Date.now(), slides: [{ id: 's', title: 'Map', body: '', img: { src: b64('pretend map '.repeat(190000)), w: 1, h: 1 } }] };
    await planPut(mac.page, [P4]);
    await sync(mac.page);
    f = D.planFile();
    assert.ok(!f.lite.P4 && !f.lessons.P4); assert.equal(f.big.P4.why, 'up');
    await sync(ph.page);
    await ph.page.evaluate(() => { location.hash = '#/plans'; }); await ph.page.evaluate(() => { location.hash = '#/plans/P4'; });
    await ph.page.waitForFunction(() => /on its way/.test((document.querySelector('#phPlans') || {}).innerText || ''), { timeout: 15000 });
    D.failDat = false;
    await sync(mac.page);
    f = D.planFile();
    assert.ok(f.lite.P4 && !(f.big && f.big.P4), 'sent with the next sync, with nothing changed');
    // deleted on the computer: the copy goes, and the phone's goes with it
    await mac.page.evaluate(async () => { const db = await new Promise(res => { const q = indexedDB.open('gs-lessons'); q.onsuccess = () => res(q.result); }); await new Promise(res => { const t = db.transaction('lessons', 'readwrite'); t.objectStore('lessons').delete('P3'); t.oncomplete = res; }); db.close(); });
    await sync(mac.page);
    f = D.planFile(); assert.ok(!f.lite.P3 && f.gone['l:P3']);
    await sync(ph.page);
    assert.deepEqual((await planGet(ph.page)).lessons.map(l => l.id).sort(), ['P4', 'X1']);
    assert.deepEqual(mac.page.errors, []); assert.deepEqual(ph.page.errors, []);
  } finally { await mac.close(); await ph.close(); await srv.close(); }
});

test('the copies for the phone go after the marks: next week’s lessons first, a few seconds’ worth each sync, and each made once while its lesson is unchanged', async () => {
  const D = fakeDrive(), srv = await serve(builtHtml());
  const day = n => { const d = new Date(Date.now() + n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const setup = { classes: [{ id: 'k1', name: 'Grade 9 English', color: '#1F6FB2', meets: [{ dow: 1, start: '09:00', end: '10:00' }] }], daysOff: [] };
  const b64 = s => 'data:image/png;base64,' + Buffer.from(s).toString('base64');
  const lesson = (id, title, d, pic) => ({ id, title, slots: [{ classId: 'k1', date: d }], created: 1, updated: Date.now(), slides: [{ id: 's', title: 'Look', body: '', img: { src: b64(pic.repeat(Math.ceil(1.6e6 / pic.length))), w: 1, h: 1 } }] });
  const mac = await openApp(browser, { server: srv, seed: seed(), beforeLoad: D.hook });
  const n = () => mac.page.evaluate(() => window.__gs.planLiteN());
  try {
    // the later lesson saved last, the one for tomorrow first: tomorrow's goes first all the same
    await planPut(mac.page, [lesson('P6', 'Tomorrow in pictures', day(1), 'pretend tomorrow picture '), lesson('P5', 'Next week in pictures', day(6), 'pretend next week picture ')], { setup });
    await mac.page.evaluate(() => window.__gs.planLiteBudget(0));   // time for one each sync
    await sync(mac.page);
    assert.equal(await n(), 1);
    let f = D.planFile();
    assert.ok(f.lite.P6 && !(f.big && f.big.P6), 'tomorrow’s lesson first');
    assert.ok(!f.lite.P5 && f.big.P5.why === 'up', 'the other waits, on its way');
    assert.equal(D.seq[0], 'sync', 'the marks went up before any picture'); assert.ok(D.seq.includes('pic'));
    assert.match(D.body, /Poetry quiz/);
    await sync(mac.page);
    assert.equal(await n(), 2);
    f = D.planFile(); assert.ok(f.lite.P5 && f.lite.P6 && !f.big, 'the rest with the next sync');
    // another change in the Planner: no copy made again, no picture sent again
    const pics = D.n;
    await planPut(mac.page, [{ id: 'X1', title: 'Spare', slots: [], slides: [], created: 1, updated: Date.now() }]);
    await sync(mac.page);
    assert.equal(await n(), 2); assert.equal(D.n, pics);
    assert.ok(D.planFile().lessons.X1 && D.planFile().lite.P5 && D.planFile().lite.P6);
    // the page opened again: the copies in Drive are this device's own, for the same lessons, so none is made again
    await mac.page.reload(); await appReady(mac.page);
    await planPut(mac.page, [{ id: 'X2', title: 'Spare again', slots: [], slides: [], created: 1, updated: Date.now() }]);
    await sync(mac.page); await sync(mac.page);   // the second, in case the page's own sync on opening was still going
    assert.equal(await n(), 0); assert.equal(D.n, pics);
    f = D.planFile(); assert.ok(f.lessons.X2 && f.lite.P5 && f.lite.P6 && !f.big);
    // a lesson changed: only its copy is made again
    await planPut(mac.page, [{ ...lesson('P5', 'Next week, edited', day(6), 'pretend next week picture '), updated: Date.now() + 1 }]);
    await sync(mac.page);
    assert.equal(await n(), 1); assert.equal(D.planFile().lite.P5.title, 'Next week, edited');
    assert.deepEqual(mac.page.errors, []);
  } finally { await mac.close(); await srv.close(); }
});

test('the phone: a Google card on Today until signed in, a More tab with syncing, updates, help and settings, and Update now one tap away on every screen', async () => {
  const srv = await serve(builtHtml());
  const ph = await openApp(browser, { server: srv, seed: { ls: { ...seed().ls, 'gs.gEmail': '""', 'gs.phone': '1' } } });
  try {
    const p = ph.page;
    // not signed in: the card asks for Google, and nothing on Today is for a computer
    await p.waitForSelector('#phSign:not([hidden]) [data-gin]');
    assert.equal(await p.$eval('#phSign', el => el.textContent.includes('same Google account')), true);
    assert.equal(await p.$$eval('#vHome [data-gphone], #safeAsk:not([hidden])', l => l.filter(x => x.offsetParent).length), 0, 'no Use on your phone, no folder card');
    assert.equal(await p.$$eval('#vHome a[href*="planner"]', l => l.filter(x => x.offsetParent).length), 0, 'no Open the Planner');
    // the fifth tab
    await p.click('[data-phnav="#/more"]');
    await p.waitForSelector('#vMore:not([hidden]) #phMore [data-gin]');
    assert.ok(await p.$eval('[data-phnav="#/more"]', a => a.classList.contains('on')));
    assert.deepEqual(await p.$$eval('#phMore a.phitem', l => l.map(a => a.getAttribute('href'))), ['#/help', '#/settings']);
    assert.match(await p.$eval('#phMore', el => el.textContent), /Grading Studio \d+\.\d+\.\d+/);
    assert.equal(await p.$eval('#phUpd', el => el.hidden), true, 'no bar while there is nothing new');
    // a newer version waiting: the bar on every tab, a dot on More, and Update now in More
    await p.evaluate(() => window.__gs.updAs({ current: { build: 'a' }, next: { build: 'b', version: '9.9.9' }, mode: 'ask' }));
    for (const tab of ['#/', '#/scores', '#/todo', '#/plans', '#/more']) {
      await p.evaluate(h => { location.hash = h; }, tab);
      await p.waitForFunction(() => { const b = document.querySelector('#phUpd'); return b && !b.hidden && b.getClientRects().length && /Update now/.test(b.textContent); });
    }
    assert.equal(await p.$eval('.phbadge', el => el.hidden), false);
    await p.waitForSelector('#phMore [data-phupd].primary');
    // To do keeps the list; the switches and categories are set on the computer
    await p.evaluate(() => { location.hash = '#/todo'; });
    await p.waitForSelector('#tdIn');
    assert.equal(await p.$$eval('.tdkinds, #tdView', l => l.filter(x => x.offsetParent).length), 0);
    assert.deepEqual(p.errors, []);
  } finally { await ph.close(); await srv.close(); }
});

test('after class, a note on the phone reaches the computer for the Planner without the phone writing the lesson, and the Planner putting it on comes back', async () => {
  const D = fakeDrive(), srv = await serve(builtHtml());
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const now = new Date(), today = iso(now), before = iso(new Date(Date.now() - 2 * 864e5)), later = iso(new Date(Date.now() + 7 * 864e5)), dow = now.getDay();
  const setup = { classes: [{ id: 'k1', name: 'Grade 9 English', color: '#1F6FB2', meets: [{ dow, start: '00:00', end: '23:59' }] }, { id: 'k2', name: 'Grade 9 English B', color: '#7B3FC4', meets: [{ dow, start: '00:00', end: '23:59' }] }], semStart: '', semEnd: '', daysOff: [] };
  const L1 = { id: 'L1', title: 'Sonnets, day one', slots: [{ classId: 'k1', date: today }, { classId: 'k2', date: before }, { classId: 'k1', date: later }], created: 1, updated: Date.now() - 5000,
    slides: [{ id: 's1', title: 'Warm-up', body: '' }, { id: 's2', title: 'What a volta does', body: '' }, { id: 's3', title: 'Exit ticket', body: '' }] };
  const L2 = { id: 'L2', title: 'Next week', slots: [{ classId: 'k1', date: later }], created: 1, updated: Date.now(), slides: [{ id: 's', title: 'x', body: '' }] };
  const mac = await openApp(browser, { server: srv, seed: seed(), beforeLoad: D.hook });
  const ph = await openApp(browser, { server: srv, seed: seed({ 'gs.phone': '1' }), beforeLoad: D.hook });
  const key = 'L1|k1|' + today, tin = p => p.evaluate(() => JSON.parse(localStorage.getItem('gsp.taughtIn') || 'null'));
  try {
    await planPut(mac.page, [L1, L2], { setup });
    await sync(mac.page); await sync(ph.page);
    // a lesson whose days are all to come has no After class
    await ph.page.evaluate(() => { location.hash = '#/plans/L2'; });
    await ph.page.waitForFunction(() => /Next week/.test((document.querySelector('#phPlans') || {}).innerText || ''), { timeout: 15000 });
    assert.equal(await ph.page.$('#phAfter .phafter'), null);
    await ph.page.evaluate(() => { location.hash = '#/plans/L1'; });
    await ph.page.waitForSelector('#phAfter .phafter', { timeout: 15000 });
    // today's class first, then the one before; never a day still to come. Every slide, unless she says otherwise
    assert.deepEqual(await ph.page.$$eval('#phAfter [data-phaslot]', b => b.map(x => x.textContent.split(' · ')[0])), ['Grade 9 English', 'Grade 9 English B']);
    assert.equal(await ph.page.$eval('#phaSlide', b => b.textContent), '3');
    assert.deepEqual(await ph.page.$$eval('#phPlans .btn.primary', b => b.map(x => x.textContent)), ['Save'], 'one blue button');
    await ph.page.click('[data-phastep="-1"]');
    assert.equal(await ph.page.$eval('#phaSlide', b => b.textContent), '2');
    await ph.page.type('#phaNote', 'Start with the volta');
    await ph.page.click('[data-phasave]');
    let T = await tin(ph.page);
    assert.deepEqual({ ...T.items[key], t: 0 }, { slide: 2, of: 3, x: 'Start with the volta', t: 0 });
    assert.match(await ph.page.$eval('#phAfter', b => b.innerText), /Saved on this phone/);
    assert.equal((await planGet(ph.page)).lessons.find(l => l.id === 'L1').updated, L1.updated, 'the phone never writes the lesson');
    // through Drive, in the main file
    await sync(ph.page);
    assert.deepEqual(D.file().tn.items[key], T.items[key]);
    await sync(mac.page);
    assert.deepEqual((await tin(mac.page)).items[key], T.items[key]);
    // the Planner on the computer puts it on the lesson and marks it (src/planner/present.js, taughtFold); the phone hears so
    await mac.page.evaluate(k => { const T = JSON.parse(localStorage.getItem('gsp.taughtIn')); T.items[k].f = 1; localStorage.setItem('gsp.taughtIn', JSON.stringify(T)); }, key);
    await sync(mac.page); await sync(ph.page);
    assert.equal((await tin(ph.page)).items[key].f, 1);
    await ph.page.waitForFunction(() => /On the lesson in your Planner/.test(document.querySelector('#phAfter').innerText), { timeout: 15000 });
    const w = D.writes; await sync(mac.page); await sync(ph.page); assert.equal(D.writes, w, 'settled');
    assert.deepEqual(mac.page.errors, []); assert.deepEqual(ph.page.errors, []);
  } finally { await mac.close(); await ph.close(); await srv.close(); }
});
