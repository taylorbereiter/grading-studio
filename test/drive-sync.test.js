// Keeping a phone and a computer the same through the teacher's own Google Drive (src/app/drive.js), and the phone's own screens
// (src/phone.js). Google is played by this test: every request to it is answered here, from one file held in memory, so nothing
// leaves the computer. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { launch } = require('./helpers/chrome');
const { openApp, builtHtml } = require('./helpers/app');
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
  const D = { body: null, etag: 0, readAt: null, blobs: {}, n: 0, writes: 0, refused: 0, afterRead: null };
  D.hook = async page => {
    await page.evaluateOnNewDocument(() => {
      // Google's sign-in script, as far as the app uses it: a key straight away, for whatever was asked
      window.google = { accounts: { oauth2: {
        initTokenClient: o => ({ requestAccessToken: () => setTimeout(() => o.callback({ access_token: 'tok-' + o.scope.length, expires_in: 3600, scope: o.scope }), 10) }),
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
      if (/drive\/v3\/files\?spaces=appDataFolder/.test(u)) return json({ files: D.body ? [{ id: 'f1' }] : [] });
      const blob = u.match(/drive\/v3\/files\/(p\d+)\?alt=media/);
      if (blob) return r.respond({ status: 200, headers: cors, contentType: 'application/octet-stream', body: D.blobs[blob[1]].body });
      if (/drive\/v3\/files\/f1\?fields=id,version/.test(u)) { if (D.readAt != null && D.readAt !== D.etag) D.refused++; D.readAt = null; return json({ id: 'f1', version: String(D.etag) }); }
      if (/drive\/v3\/files\/f1\?alt=media/.test(u)) { D.readAt = D.etag; const out = json(JSON.parse(D.body), 200, { ETag: '"' + D.etag + '"' }); if (D.afterRead) { const f = D.afterRead; D.afterRead = null; f(); } return out; }
      if (/upload\/drive\/v3\/files\/f1\?uploadType=media/.test(u) && r.method() === 'PATCH') {
        D.body = r.postData() || await r.fetchPostData(); D.etag++; D.writes++; D.readAt = null; return json({ id: 'f1' });
      }
      if (/upload\/drive\/v3\/files\?uploadType=multipart/.test(u)) {
        const t = r.postData() || await r.fetchPostData() || '', dat = t.match(/"name":"([0-9a-f]+\.dat)"/);
        if (dat) {   // a paper: the part after the metadata, up to the closing boundary
          const b = t.split(/\r\n/)[0], parts = t.split(b), body = parts[2].slice(parts[2].indexOf('\r\n\r\n') + 4, -2), id = 'p' + (++D.n);
          D.blobs[id] = { name: dat[1], body }; return json({ id });
        }
        const i = t.indexOf('{"app"'), j = t.lastIndexOf('}');
        D.body = t.slice(i, j + 1); D.etag++; D.writes++; D.readAt = null; return json({ id: 'f1' });
      }
      return json({ error: { message: 'not in this test: ' + u } }, 404);
    };
  };
  D.file = () => JSON.parse(D.body);
  return D;
}
const sync = page => page.evaluate(() => window.__gs.syncNow());
const typed = (page, id) => page.evaluate(id => { const l = JSON.parse(localStorage.getItem('gs.lib')); for (const c of l.classes) for (const u of c.units) for (const it of u.items) if (it.id === id) return it.typed; return null; }, id);

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
