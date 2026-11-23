// npm run rehearsal: the switch, rehearsed in a real Chrome. A teacher's work made on the version before the switch is carried into
// this one at the same address, with the page she had open when the new version went up.
//
//   node test/tools/rehearsal.js                    from origin/main's files
//   node test/tools/rehearsal.js --from <commit>    from that commit's files
//
// One address serves the files of <commit> (read with git show) and then this working tree's, as the web address does on the day:
//
//   1. Before: the work is made with the previous version's pages at the root (classes and a term of scores, a download marked and
//      scored, a timetable and a lesson in the Planner); signed in to Google and synced; a Drive video streams through its worker
//      (gs-drive/<id>); a second tab signs in through Google's page (as on an iPhone), which keeps the key in the tab. Its worker
//      keeps the pages (gs-app-1); the new app is opened at next/ once, so its worker is there too. Everything kept is read.
//   2. The switch goes up while she marks: a mark is typed; the previous version's worker checks first and keeps nothing of the new
//      app (its version.json names files under sums, which that worker does not take); then the page checks for a new version. The
//      root's new worker takes over, fetches the new app whole (gs-next-2) and leaves the previous version's pages in use (gs-app-1):
//      the page says Update ready, the mark is saved as usual, the video goes on streaming. A sign-in started from classic/ now comes
//      back to the root, where the previous version's page takes it.
//   3. Another mark, and Update now straight after it (Settings, About and updates). The page reloads into the new app; gs-app-1 and
//      gs-next-1 are gone, gs-app-2 is whole; both marks are there. Still signed in: the computer as the same teacher with the last
//      sync kept, the iPhone-style tab with the same key, which the new app streams the video with. next/ sends her to the root, and
//      its worker and caches are gone.
//   4. Everything kept is read again: nothing is lost or changed. Sync now works from the new app, and its Check for an update answers at once. The previous version opens at
//      classic/ with the same classes and the same marks; a change made there shows in the new app and one made in the new app shows
//      there. A sign-in from classic/ goes through the root and is handed back to classic/. Old addresses land on new screens.
//
// Google is played here: next/test/browser/fakedrive.js for the sign-in script and the sync file, Drive's video bytes answered to
// the workers by CDP, and Google's sign-in page as a redirect back with a key in the address.
//
// Exits 1 when any step fails. Every student, class and lesson here is made up.
const fs = require('fs'), path = require('path'), http = require('http'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const { launch } = require('../helpers/chrome');
const { plant, appReady, goTo, openZip, score, settle } = require('../helpers/app');
const { standardFiles, zipOf } = require('../helpers/fixtures');
const { gradingSeed, PLAN_SETUP, makeLesson } = require('../helpers/steady');
const { fakeDrive } = require('../../next/test/browser/fakedrive');

const args = process.argv.slice(2), fi = args.indexOf('--from'), FROM = fi >= 0 ? args[fi + 1] : 'origin/main';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
const gitShow = p => { try { return execFileSync('git', ['show', FROM + ':' + p], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };

// The site: <commit>'s files until the switch goes up, this working tree's after. Only built files, never the repository's insides.
const site = { switched: false };
function file(p) {
  if (p.endsWith('/')) p += 'index.html';
  p = p.replace(/^\//, '');
  if (!p || p.split('/').some(s => !s || s === '..' || s.startsWith('.')) || /^(node_modules|test|src|next\/src|next\/test)\//.test(p)) return null;
  if (!site.switched) return gitShow(p);
  const f = path.join(ROOT, p);
  return fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f) : null;
}
function serve() {
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    const body = file(p);
    if (!body) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[(p.endsWith('/') ? 'html' : p.split('.').pop())] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) })));
}

// Everything this address keeps, as { 'localStorage:key': text, 'db/store/key': json }. Bytes are shown as their length and SHA-256.
const snapshot = page => page.evaluate(async () => {
  const out = {}, hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  const flat = async v => {
    if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) { const u = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength); return { bytes: u.length, sha256: hex(await crypto.subtle.digest('SHA-256', u)) }; }
    if (v instanceof Blob) { const u = await v.arrayBuffer(); return { blob: v.type, bytes: u.byteLength, sha256: hex(await crypto.subtle.digest('SHA-256', u)) }; }
    if (Array.isArray(v)) return Promise.all(v.map(flat));
    if (v && typeof v === 'object') { if (typeof FileSystemHandle !== 'undefined' && v instanceof FileSystemHandle) return { handle: v.kind + ':' + v.name }; const o = {}; for (const k of Object.keys(v).sort()) o[k] = await flat(v[k]); return o; }
    return v === undefined ? { undefined: true } : v;
  };
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out['localStorage:' + k] = localStorage.getItem(k); }
  for (const d of await indexedDB.databases()) {
    const db = await new Promise((res, rej) => { const r = indexedDB.open(d.name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    for (const s of db.objectStoreNames) {
      const got = await new Promise((res, rej) => { const tx = db.transaction(s), o = tx.objectStore(s), a = o.getAll(), b = o.getAllKeys(); tx.oncomplete = () => res({ k: b.result, v: a.result }); tx.onerror = () => rej(tx.error); });
      for (let i = 0; i < got.k.length; i++) out[d.name + '/' + s + '/' + (typeof got.k[i] === 'string' ? got.k[i] : JSON.stringify(got.k[i]))] = JSON.stringify(await flat(got.v[i]));
    }
    db.close();
  }
  return out;
});
// Records a page may write on any visit, which say nothing of her work: who holds the lock and when, the last screen and visit, the
// daily count of browsers. A change to one of these is shown in the report but is not a failure.
const VOLATILE = /^localStorage:(gs\.lock.*|gs\.tabs.*|gs\.last.*|gs\.seen.*|gs\.visit.*|gs\.route.*|gs\.navAt|gs\.phoneAsk.*|gsn?\.ver.*|gs\.boot.*)$/;
const caches = page => page.evaluate(async () => { const o = {}; for (const n of await window.caches.keys()) { const c = await window.caches.open(n); o[n] = (await c.keys()).map(r => new URL(r.url).pathname); } return o; });
const whole = (c, name) => (c[name] || []).includes('/version.json');
const regs = page => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(r => new URL(r.scope).pathname).sort());

// Google, played here (next/test/browser/fakedrive.js for the sync and the sign-in window). A Drive video is answered to the workers
// (gs-drive/<id>, CDP Fetch on each worker as it starts), by Range, from bytes made here. Google's sign-in page, for a sign-in that
// goes there (an iPhone, an installed app on one), sends the page back to the address it was given with a key in it, as Google does.
const VIDEO_ID = '1VidVidVidVidVidVidVidVidVid55555', VIDEO = Buffer.from(Array.from({ length: 60000 }, (_, i) => (i * 7919 + (i >> 8)) & 255));
const drive = { asked: [] };
function answerVideo(cdp, ev) {
  const h = ev.request.headers, rg = h.Range || h.range || '', auth = h.Authorization || h.authorization || '';
  drive.asked.push({ url: ev.request.url, rg, auth, method: ev.request.method });
  const cors = [{ name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization, Range' }, { name: 'Access-Control-Expose-Headers', value: 'Content-Range, Content-Length, Accept-Ranges' }];
  const done = o => cdp.send('Fetch.fulfillRequest', { requestId: ev.requestId, ...o }).catch(() => {});
  if (ev.request.method === 'OPTIONS') return done({ responseCode: 204, responseHeaders: cors, body: '' });
  if (!ev.request.url.includes(VIDEO_ID + '?alt=media') || !/^Bearer \S/.test(auth)) return done({ responseCode: 404, responseHeaders: cors, body: '' });
  const m = /bytes=(\d+)-(\d*)/.exec(rg), a = m ? +m[1] : 0, b = m && m[2] ? Math.min(+m[2], VIDEO.length - 1) : VIDEO.length - 1, part = VIDEO.subarray(a, b + 1);
  done({ responseCode: m ? 206 : 200, body: part.toString('base64'), responseHeaders: [...cors, { name: 'Content-Type', value: 'video/webm' }, { name: 'Accept-Ranges', value: 'bytes' }, { name: 'Content-Length', value: String(part.length) }, ...(m ? [{ name: 'Content-Range', value: 'bytes ' + a + '-' + b + '/' + VIDEO.length }] : [])] });
}
const workerSessions = [];
// The browser rests a worker whenever it likes, and a worker that starts again has no key: this does that, so the next part asks a page.
const restWorkers = () => Promise.all(workerSessions.map(s => s.send('Runtime.evaluate', { expression: 'typeof dTok !== "undefined" && (dTok = null)' }).catch(() => {})));
async function watchWorkers(browser) {
  const seen = new Set();
  const watch = async t => {
    if (t.type() !== 'service_worker' || seen.has(t)) return; seen.add(t);
    const cdp = await t.createCDPSession(); workerSessions.push(cdp);
    cdp.on('Fetch.requestPaused', ev => answerVideo(cdp, ev));
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*googleapis.com*' }] });
  };
  browser.on('targetcreated', t => watch(t).catch(() => {}));
  await Promise.all(browser.targets().map(t => watch(t).catch(() => {})));
}
// A part of the video through this site, as the player asks for it: [status, the bytes are the right ones].
const videoPart = (page, a, b) => page.evaluate(async (id, a, b) => {
  const r = await fetch('gs-drive/' + id, { headers: { Range: 'bytes=' + a + '-' + b } }), u = new Uint8Array(await r.arrayBuffer());
  let s = ''; for (const x of u) s += String.fromCharCode(x); return [r.status, btoa(s)];
}, VIDEO_ID, a, b).then(([st, b64]) => [st, Buffer.from(b64, 'base64').equals(VIDEO.subarray(a, b + 1))]);
// A tab whose Google sign-in goes to Google's page and back (as on an iPhone: navigator.standalone), with Google's page played here.
const SIGNED = { n: 0 };
async function redirectTab(newPage) {
  const p = await newPage();
  await p.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
  await p.setRequestInterception(true);
  p.on('request', r => {
    const u = r.url();
    if (!/^https:\/\//.test(u)) return r.continue();
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' };
    const a = /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?(.*)$/.exec(u);
    if (a) { const q = new URLSearchParams(a[1]), tok = 'tok-back-' + (++SIGNED.n); p.lastToken = tok; p.lastBack = q.get('redirect_uri'); return r.respond({ status: 302, headers: { Location: q.get('redirect_uri') + '#access_token=' + tok + '&expires_in=3600&token_type=Bearer&scope=' + encodeURIComponent(q.get('scope')) + '&state=' + q.get('state') }, body: '' }); }
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: cors, body: '' });
    if (/\/about\?/.test(u)) return r.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ user: { emailAddress: 'teacher@example.com' } }) });
    r.respond({ status: 404, headers: cors, contentType: 'application/json', body: '{"error":{"message":"not in the rehearsal"}}' });
  });
  return p;
}
// A sign-in started from classic/: where the tab ends up, and whether classic/ (or the page there) took the key.
async function signInFromClassic(p, url) {
  await p.goto(url + 'classic/?sw=1'); await appReady(p);
  await p.evaluate(() => { window.__gs.gIn('pick').catch(() => {}); });
  await p.waitForFunction(() => /^#?$/.test(location.hash) && document.readyState === 'complete' && !!window.__gs, { timeout: 30000 }).catch(() => {});
  await p.waitForFunction(() => { try { return !!JSON.parse(sessionStorage.getItem('gs.gTok')); } catch { return false; } }, { timeout: 30000 }).catch(() => {});
  return p.evaluate(() => ({ at: location.pathname + location.hash, tok: (JSON.parse(sessionStorage.getItem('gs.gTok') || 'null') || {}).t || null, note: sessionStorage.getItem('gs.gBack'), newApp: !![...document.scripts].find(s => /dist\//.test(s.src)) }));
}
// The previous version's page opens the download by its address; tried again from Today if the first try is still settling.
async function openDownload(page, A) {
  for (let i = 0; ; i++) {
    await page.evaluate(h => window.__gs.go(h), '#/a/' + A.replace(/^gs\.b\./, ''));
    if (await page.waitForFunction(() => !!window.__gs.state().batch, { timeout: 15000, polling: 200 }).then(() => true, () => false)) return;
    if (i === 2) throw new Error('the download did not open in the previous version');
    await page.evaluate(() => window.__gs.go('#/')); await sleep(500);
  }
}
// A student's paper, open and drawn; asked again if the download was still settling when first asked.
async function toStudent(page, i) {
  for (let k = 0; ; k++) {
    await page.evaluate(i => window.__gs.openStudent(i), i);
    if (await page.waitForFunction(i => { const s = window.__gs.state(); return s.cur === i && (s.pages.length === 0 || s.pages[0].s > 0); }, { timeout: 10000, polling: 200 }, i).then(() => true, () => false)) return;
    if (k === 2) throw new Error('student ' + i + '’s paper did not open');
  }
}
const workOf = (page, id, who) => page.evaluate((id, who) => { const w = JSON.parse(localStorage.getItem(id) || 'null'); return w && w.s && w.s[who] ? w.s[who].g || null : null; }, id, who);

async function main() {
  if (!gitShow('index.html')) { console.log('Can’t read the files of ' + FROM + ' (try: git fetch origin main).'); process.exit(1); }
  if (gitShow('classic/index.html')) { console.log(FROM + ' is already switched: nothing to rehearse. Passed.'); return; }
  for (const f of ['index.html', 'classic/index.html', 'sw.js', 'version.json', 'dist']) if (!fs.existsSync(path.join(ROOT, f))) { console.log(f + ' is not built: run npm run build and node next/build.js first.'); process.exit(1); }
  const srv = await serve(), browser = await launch({ args: ['--no-sandbox'] }), steps = [];
  await watchWorkers(browser);
  let failed = false;
  const step = (ok, what, more) => { steps.push((ok ? 'ok    ' : 'FAIL  ') + what + (more ? '\n        ' + more : '')); if (!ok) failed = true; return ok; };
  const note = what => steps.push('      ' + what);
  const until = (page, fn, arg, timeout = 60000) => page.waitForFunction(fn, { timeout, polling: 250 }, arg).then(() => true, () => false);
  const errors = [];
  const newPage = async () => { const p = await browser.newPage(); p.on('pageerror', e => errors.push(String(e).split('\n')[0].slice(0, 200))); p.on('dialog', d => d.accept()); await p.setViewport({ width: 1366, height: 800 }); return p; };
  const D = fakeDrive();
  try {
    // 1. Before the switch: the work, a Planner lesson, a download marked and scored, signed in to Google and synced.
    const page = await newPage();
    await D.hook(page);
    const seed = gradingSeed();
    Object.assign(seed.ls, { 'gs.gcid': JSON.stringify('1234-test.apps.googleusercontent.com'), 'gs.gEmail': JSON.stringify('teacher@example.com') });
    await page.goto(srv.url + 'blank'); await plant(page, seed);
    await page.goto(srv.url + '?sw=1'); await appReady(page);
    step(await until(page, async () => { const c = await caches.open('gs-app-1'); return !!(await c.match(new URL('version.json', location.href).href)); }), 'before: the previous version’s worker keeps its pages (gs-app-1)');
    await openZip(page, zipOf(await standardFiles()), 'River essay.zip');
    await score(page, [3.5, 3, 4]); await settle(page);
    const A = await page.evaluate(() => window.__gs.state().batch.id);
    await page.evaluate(async () => { await window.__gs.gIn('pick'); await window.__gs.syncNow(); });
    step(await until(page, () => !!localStorage.getItem('gs.syncAt'), null, 30000), 'before: signed in to Google (the stand-in) and synced');
    // On a computer the previous version holds Google's key in the page only (Google's little window, no gs.gTok): what stays is who
    // she is (gs.gEmail) and the last sync (gs.syncAt), and a new key is asked for by itself when the next sync needs one.
    const signed = await page.evaluate(() => ({ email: localStorage.getItem('gs.gEmail'), syncAt: localStorage.getItem('gs.syncAt'), tok: sessionStorage.getItem('gs.gTok') }));
    const writes0 = D.writes;
    let v = await videoPart(page, 0, 999);
    step(v[0] === 206 && v[1], 'before: a Drive video streams through the previous version’s worker (gs-drive, 206, the right bytes)', JSON.stringify(v));
    const plan = await newPage();
    await plan.goto(srv.url + 'planner.html?sw=1');
    await plan.waitForFunction(() => window.__planner && document.querySelector('#lessons'), { timeout: 60000 });
    await plan.evaluate(async s => { await window.__planner.applySetup(s); }, PLAN_SETUP);
    const L = await makeLesson(plan); await sleep(400); await plan.close();
    // On an iPhone, or an app installed on one, the sign-in goes to Google's page and back, and the key is kept in the tab (gs.gTok).
    const phone = await redirectTab(newPage);
    await phone.goto(srv.url + '?sw=1'); await appReady(phone);
    await phone.evaluate(() => { window.__gs.gIn('pick').catch(() => {}); });
    const phoneTok = await until(phone, () => { try { return !!JSON.parse(sessionStorage.getItem('gs.gTok')); } catch { return false; } }, null, 30000) && await phone.evaluate(() => JSON.parse(sessionStorage.getItem('gs.gTok')).t);
    step(!!phoneTok && phoneTok === phone.lastToken, 'before: in a tab signing in through Google’s page (as on an iPhone), the key comes back to the root and is kept in the tab');
    await phone.goto(srv.url + 'blank');   // the tab stays (and its key with it), out of the way of the page she marks in
    const nx = await newPage();
    await nx.goto(srv.url + 'next/');
    const hadNext = await until(nx, async () => (await navigator.serviceWorker.getRegistrations()).some(r => /\/next\/$/.test(r.scope)), null, 30000);
    step(hadNext, 'before: the new app at next/ has its own worker');
    await nx.close();
    await goTo(page, '#/');
    const before = await snapshot(page);
    step(Object.keys(before).length > 5, 'before: the work is kept (' + Object.keys(before).length + ' records)');

    // 2. The switch goes up while she is marking: a mark is made and, without waiting for its save, the page checks for a new version.
    await page.bringToFront();
    await openDownload(page, A);
    await toStudent(page, 1);
    const WHO1 = await page.evaluate(() => window.__gs.state().batch.students[1].key), EARLY = 'Typed as the new version went up.';
    await score(page, [3, 3, 3]); await page.type('#cmtIn', EARLY);
    site.switched = true;
    // The race before the browser fetches the new sw.js: the previous version's worker, still the root's, checks for a version itself
    // (as its page asks it to every so often). It must not keep the new index.html, which would open without the dist/ it needs: the
    // new version.json names its files under sums, so that worker takes it as no version, and nothing is kept or swapped in.
    const oldAsk = type => page.evaluate(type => new Promise(res => {
      const sw = navigator.serviceWorker, to = setTimeout(() => { sw.removeEventListener('message', on); res('no answer'); }, 30000);
      const on = e => { const d = e.data || {}; if (d.type === 'gs-state' && ('checked' in d || 'applied' in d)) { clearTimeout(to); sw.removeEventListener('message', on); res({ checked: d.checked, applied: d.applied, next: d.state.next, current: d.state.current && d.state.current.version }); } };
      sw.addEventListener('message', on); sw.controller.postMessage({ type });
    }), type);
    const cur1 = await page.evaluate(async () => (await (await caches.open('gs-app-1')).match(new URL('version.json', location.href).href)).json());
    const raced = await oldAsk('gs-check'), applied = await oldAsk('gs-apply');
    let c = await caches(page);
    const cur2 = await page.evaluate(async () => (await (await caches.open('gs-app-1')).match(new URL('version.json', location.href).href)).json());
    step(raced.checked === 'offline' && !raced.next && applied.applied === false && !(c['gs-next-1'] || []).length && cur2.build === cur1.build,
      'the race: the previous version’s worker, checking before the new sw.js arrives, keeps nothing of the new app (gs-next-1 empty) and Update now there swaps nothing in', JSON.stringify({ raced, applied, caches: Object.keys(c) }));
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration('./'); await r.update(); });
    const fetched = await until(page, async () => { const n = await caches.keys(); if (!n.includes('gs-next-2')) return false; return !!(await (await caches.open('gs-next-2')).match(new URL('version.json', location.href).href)); }, null, 90000);
    c = await caches(page);
    step(fetched && whole(c, 'gs-app-1'), 'the switch: the new app is fetched whole (gs-next-2) and the previous version’s pages stay in use (gs-app-1)', JSON.stringify(Object.keys(c)));
    await page.evaluate(() => navigator.serviceWorker.ready.then(r => r.active && r.active.postMessage({ type: 'gs-state' })));
    step(await until(page, () => { const r = document.querySelector('#railUpdate'); return r && !r.hidden; }, null, 30000), 'the page still open says Update ready');
    v = await videoPart(page, 1000, 4999);
    step(v[0] === 206 && v[1], 'the same page’s Drive video goes on streaming once the new worker has taken over (206, the right bytes)', JSON.stringify(v));
    // A sign-in started from classic/ while the root still shows the previous version (before Update now).
    const pre = await redirectTab(newPage), preAt = await signInFromClassic(pre, srv.url);
    step(preAt.tok === pre.lastToken && preAt.at.startsWith('/') && !preAt.at.startsWith('/classic/') && !preAt.newApp,
      'before Update now, a sign-in from classic/ comes back to the root, where the previous version’s page (still in use) takes the key: she is signed in there, not sent on to classic/', JSON.stringify(preAt));
    await pre.close();
    await page.bringToFront();   // the page she marks in is the one in front (a tab behind draws no frames)
    await page.reload(); await appReady(page);
    const early = await workOf(page, A, WHO1);
    step(!!early && early.comment === EARLY && JSON.stringify(early.rubric) === JSON.stringify([3, 3, 3]), 'the mark made as the new worker arrived is saved by the previous version as usual: nothing changed under it', JSON.stringify(early));
    step(await page.evaluate(() => !!window.__gs && !document.querySelector('script[src*="dist/"]')), 'reloaded before Update now, it is still the previous version');

    // 3. A mark made and Update now pressed straight after, before the save that follows a change (half a second) has run.
    await openDownload(page, A);
    await toStudent(page, 0);
    const WHO = await page.evaluate(() => window.__gs.state().batch.students[0].key);
    const COMMENT = 'Typed just before Update now.';
    await score(page, [4, 3.5, 3]);
    await page.type('#cmtIn', COMMENT);
    const at = await page.evaluate(async (A, WHO, COMMENT) => {
      const has = () => { const w = JSON.parse(localStorage.getItem(A) || 'null'); return !!w && !!w.s[WHO] && (w.s[WHO].g || {}).comment === COMMENT; };
      const typed = has();
      window.__gs.go('#/settings/about');   // then Update now, clicked once this answer is on its way (the page reloads)
      for (let i = 0; i < 200; i++) { const b = document.querySelector('#setAbout [data-updnow]'); if (b) { const saved = has(); setTimeout(() => b.click(), 0); return { typed, saved, ms: i * 10 }; } await new Promise(r => setTimeout(r, 10)); }
      return null;
    }, A, WHO, COMMENT);
    step(!!at, 'Settings, About and updates offers Update now');
    if (at) note('the comment was ' + (at.saved ? '' : 'not yet ') + 'in the saved work when Update now was pressed (' + at.ms + ' ms after leaving the paper; saved as it was typed: ' + at.typed + ')');
    await page.waitForNavigation({ timeout: 60000 }).catch(() => {});
    await page.waitForSelector('[data-shell-nav], nav.tabbar', { timeout: 60000 }).catch(() => {});
    step(await page.evaluate(() => !window.__gs && !![...document.scripts].find(s => /dist\//.test(s.src))), 'Update now opens the new app at the root');
    const swapped = await until(page, async () => { const n = await caches.keys(); return !n.includes('gs-app-1') && !n.includes('gs-next-1') && n.includes('gs-app-2'); }, null, 30000);
    c = await caches(page);
    step(swapped && whole(c, 'gs-app-2'), 'gs-app-1 and gs-next-1 are gone and the new app is whole in gs-app-2', JSON.stringify(Object.keys(c)));
    const w = await workOf(page, A, WHO), w1 = await workOf(page, A, WHO1);
    step(!!w1 && w1.comment === EARLY, 'and the mark made as the new worker arrived is there too');
    step(!!w && w.comment === COMMENT && JSON.stringify(w.rubric) === JSON.stringify([4, 3.5, 3]), 'the mark made just before Update now is saved (the comment and the scores)', JSON.stringify(w));
    // Google, after Update now, on the computer: who she is and the last sync are kept (the key never outlives a page there).
    const after1 = await page.evaluate(() => ({ email: localStorage.getItem('gs.gEmail'), syncAt: localStorage.getItem('gs.syncAt') }));
    step(after1.email === signed.email && +after1.syncAt >= +signed.syncAt, 'after Update now, on a computer, she is still signed in as the same teacher, and the last sync’s time (gs.syncAt) is kept (or later: the page reloaded before Update now synced again by itself)', JSON.stringify({ signed, after1 }));
    v = await videoPart(page, 5000, 5999);
    step(v[0] === 206 && v[1], 'after Update now the Drive video streams through the new app (206, the right bytes)', JSON.stringify(v));
    // and in the tab that signed in through Google's page: the same key, used by the new app with no new sign-in
    await page.goto(srv.url + 'blank');   // so the worker can only ask that tab for the key
    await phone.goto(srv.url); await phone.waitForSelector('[data-shell-nav], nav.tabbar', { timeout: 60000 }).catch(() => {});
    await restWorkers();
    const asked0 = drive.asked.length;
    const pv = await videoPart(phone, 7000, 7999), phoneNow = await phone.evaluate(() => (JSON.parse(sessionStorage.getItem('gs.gTok') || 'null') || {}).t);
    const usedPhone = drive.asked.slice(asked0).filter(x => x.url.includes(VIDEO_ID) && x.method === 'GET').map(x => x.auth);
    step(phoneNow === phoneTok && pv[0] === 206 && pv[1] && usedPhone.length > 0 && usedPhone.every(a => a === 'Bearer ' + phoneTok) && !(await phone.evaluate(() => window.__gReq || 0)),
      'after Update now, the tab that signed in through Google’s page keeps its key, and the new app streams the video with it, with no new sign-in', JSON.stringify({ pv, usedPhone }));
    await phone.close();
    const gets = drive.asked.filter(x => x.url.includes(VIDEO_ID) && x.method === 'GET');
    step(gets.length >= 4 && gets.every(x => /^Bearer tok-/.test(x.auth)), 'Drive was asked for the video with her key each time (' + gets.length + ' parts)');

    const nx2 = await newPage();
    await nx2.goto(srv.url + 'next/#/calendar');
    step(await until(nx2, () => location.pathname === '/' && location.hash === '#/calendar', null, 30000), 'next/ sends her to the same screen at the root', await nx2.evaluate(() => location.href));
    const gone = await until(nx2, async () => !(await navigator.serviceWorker.getRegistrations()).some(r => /\/next\/$/.test(r.scope)) && !(await caches.keys()).some(n => n.startsWith('gsn-')), null, 30000);
    step(!hadNext || gone, 'next/’s worker and its caches are gone', JSON.stringify(await regs(nx2)) + ' ' + JSON.stringify(Object.keys(await caches(nx2))));
    await nx2.close();

    // 4. Her work.
    await sleep(1000);
    // the download marked again after this was read, and the work timer's log of that marking (gs.focus)
    const id = A.replace(/^gs\.b\./, ''), mine = k => k.includes(id) || k === 'localStorage:gs.focus';
    const after = await snapshot(page), lost = [], changed = [], moved = [];
    for (const [k, v0] of Object.entries(before)) {
      if (mine(k) && k in after) continue;
      if (!(k in after)) (VOLATILE.test(k) ? moved : lost).push(k);
      else if (after[k] !== v0) (VOLATILE.test(k) || k === 'localStorage:gs.batches' || k === 'localStorage:gs.syncAt' ? moved : changed).push(k);
    }
    step(!lost.length, 'nothing she kept is lost', lost.join(', '));
    step(!changed.length, 'nothing she kept is changed (apart from the download marked again after the switch went up, and the work timer’s log of that)', changed.join(', '));
    if (moved.length) note('(records rewritten as on any visit: visits, locks, the list of downloads, the last sync\'s time: ' + moved.join(', ') + ')');
    step(Object.keys(after).some(k => k.startsWith('gs-lessons/lessons/') && k.endsWith(L)), 'the lesson made in the Planner is kept');
    // the sync, from the new app
    await page.goto(srv.url + '#/settings/saving');
    await page.waitForSelector('[data-svsync]:not([disabled])', { timeout: 30000 }).catch(() => {});
    const reads = D.reads || 0;
    await page.evaluate(() => localStorage.removeItem('gs.syncAt'));
    await page.click('[data-svsync]').catch(() => {});
    step(await until(page, () => !!localStorage.getItem('gs.syncAt'), null, 30000) && (D.reads || 0) > reads, 'Sync now in the new app reads and writes the same Drive file', 'writes before the switch ' + writes0 + ', now ' + D.writes);
    note('Google’s sign-in was asked ' + (await page.evaluate(() => window.__gReq || 0)) + ' time(s) for a fresh key for that sync (by itself: renew by itself is on)');
    // Check for an update in the new app answers in the card at once, then says it is the newest (the way every later fix reaches her)
    await page.goto(srv.url + '#/settings/about');
    await page.waitForSelector('.setbody .card [data-updcheck]:not([disabled])', { timeout: 30000 }).catch(() => {});
    await page.click('.setbody .card [data-updcheck]').catch(() => {});
    const asked = await until(page, () => /Checking for an update…|Getting version|You have the newest version/.test((document.querySelector('[data-updsays]') || {}).textContent || ''), null, 1500);
    const newest = await until(page, () => /You have the newest version/.test((document.querySelector('[data-updsays]') || {}).textContent || ''), null, 30000);
    step(asked && newest, 'Check for an update in the new app answers at once and then says this is the newest version', await page.evaluate(() => (document.querySelector('[data-updsays]') || {}).textContent || '(no line)'));
    // the mark in the new app's own screen
    await page.bringToFront();
    await page.goto(srv.url + '#/a/' + encodeURIComponent(id));   // by the previous version's own address for it
    await page.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000, polling: 200 }).catch(() => {});
    const shown = await until(page, C => [...document.querySelectorAll('.mk-cmt')].some(e => (e.value || e.textContent || '').includes(C)), COMMENT, 30000);
    step(shown, 'the new app shows the comment typed just before Update now (opened by the previous version’s address for the download)', shown ? '' : JSON.stringify(await page.evaluate(() => [location.hash, !!(window.__mark && window.__mark.ready), document.body.innerText.replace(/\s+/g, ' ').slice(0, 400)])));

    const cl = await newPage();
    await cl.goto(srv.url + 'classic/?sw=1'); await appReady(cl);
    await cl.waitForSelector('#railClasses a[data-railcls]', { timeout: 30000 }).catch(() => {});
    const names = await cl.$$eval('#railClasses a[data-railcls]', xs => xs.map(a => a.textContent.replace(/\s+/g, ' ').trim()));
    step(names.some(n => n.includes('Grade 9 English')) && names.some(n => n.includes('Grade 10 Literature')), 'classic/ opens the same classes', names.join(' | '));
    step(await until(cl, () => navigator.serviceWorker.getRegistrations().then(rs => rs.some(r => /\/classic\/$/.test(r.scope))), null, 30000), 'classic/ has its own worker');
    await goTo(cl, '#/a/' + id);
    await cl.bringToFront(); await cl.waitForFunction(() => !!window.__gs.state().batch, { timeout: 30000, polling: 200 }).catch(() => {});
    await toStudent(cl, 0).catch(() => {});
    step(await until(cl, C => (document.querySelector('#cmtIn') || {}).value === C, COMMENT, 20000), 'classic/ shows the same comment on the same paper');
    // A change each way.
    await cl.evaluate(async () => { const l = JSON.parse(localStorage.getItem('gs.lib')); l.classes.find(x => x.id === 'c2').name = 'Grade 10 Literature (renamed in classic)'; localStorage.setItem('gs.lib', JSON.stringify(l)); await window.__gs.reloadKept?.(); });
    await page.goto(srv.url + '#/classes'); await page.waitForSelector('[data-shell-nav]', { timeout: 30000 }).catch(() => {});
    step(await until(page, () => (document.querySelector('[data-shell-nav]') || {}).textContent?.includes('renamed in classic'), null, 20000), 'a class renamed in classic/ shows in the new app’s sidebar');
    // Two windows: a classic/ window open beside the new app takes its share of gs-writer as the new app does (shared/lock.js), so the
    // new app is not read-only beside it (that strip, lock.read_only, is only for an older new-app window holding the lock alone).
    step(await page.evaluate(() => !document.querySelector('.strip[role="alert"]')), 'with classic/ open in another window, the new app is not read-only');
    // One window writes at a time (the Web Lock gs-writer): the others are closed first, as she would close them.
    await cl.goto(srv.url + 'blank'); await page.goto(srv.url + 'blank');
    const proof = await newPage();
    await proof.goto(srv.url + 'proof.html'); await proof.waitForFunction(() => window.__next && window.__next.write, { timeout: 30000 });
    await proof.evaluate(() => window.__next.takeOver());
    await until(proof, () => window.__next.lockState().state.startsWith('writer'), null, 20000);
    await proof.evaluate(async () => { await window.__next.write.saveLibrary(l => { l.classes.find(x => x.id === 'c1').name = 'Grade 9 English (renamed in the new app)'; }); });
    await proof.close();
    await cl.goto(srv.url + 'classic/?sw=1'); await appReady(cl);
    await cl.waitForSelector('#railClasses a[data-railcls]', { timeout: 30000 }).catch(() => {});
    const names2 = await cl.$$eval('#railClasses a[data-railcls]', xs => xs.map(a => a.textContent.replace(/\s+/g, ' ').trim()));
    step(names2.some(n => n.includes('renamed in the new app')), 'a class renamed in the new app shows in classic/', names2.join(' | '));
    await cl.close();
    // A sign-in started from classic/ once the root is the new app: back through the root, and handed on to classic/ with its key.
    const post = await redirectTab(newPage), postAt = await signInFromClassic(post, srv.url);
    step(postAt.tok === post.lastToken && postAt.at === '/classic/' && postAt.note == null && post.lastBack === srv.url,
      'after Update now, a sign-in from classic/ goes to the root (the only address Google returns to) and the root hands the key on to classic/, which takes it', JSON.stringify(postAt));
    // a note left by a sign-in that ended elsewhere never sends a later sign-in of the new app's to classic/
    await post.evaluate(() => sessionStorage.setItem('gs.gBack', 'classic:12345'));
    await post.goto(srv.url + '#access_token=other&expires_in=3600&state=67890');
    await sleep(1500);
    step(await post.evaluate(() => location.pathname === '/'), 'a sign-in of the new app’s own comes back to the new app, whatever an old note says', await post.evaluate(() => location.href));
    await post.close();
    // Old addresses.
    for (const [from, to] of [['#/class/c1/gradebook', '/#/class/c1/grades'], ['#/a/n1', '/#/mark/gs.b.n1'], ['#/settings/claude', '/#/settings/ai'], ['planner.html#plan', '/#/calendar'], ['planner.html#lesson/' + L, '/#/lesson/' + encodeURIComponent(L)]]) {
      const q = await newPage();
      await q.goto(srv.url + from);
      const ok = await until(q, w => location.pathname + location.hash === w, to, 20000);
      step(ok, 'the old address ' + from + ' lands on ' + to, ok ? '' : await q.evaluate(() => location.pathname + location.hash));
      await q.close();
    }
  } catch (e) {
    step(false, 'the rehearsal ran to its end', String(e && e.stack || e).split('\n').slice(0, 3).join(' '));
  } finally {
    await browser.close(); await srv.close();
  }
  console.log('The switch, rehearsed from ' + FROM + ':\n' + steps.map(s => '  ' + s).join('\n'));
  if (errors.length) console.log('Errors the pages reported (not failures by themselves):\n  ' + [...new Set(errors)].join('\n  '));
  console.log(failed ? 'FAILED' : 'Passed.');
  process.exit(failed ? 1 : 0);
}
main();
