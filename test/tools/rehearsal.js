// npm run rehearsal: the switch, rehearsed in a real Chrome. A teacher's work made on the version before the switch is carried into
// this one at the same address, with the page she had open when the new version went up.
//
//   node test/tools/rehearsal.js                    from origin/main's files
//   node test/tools/rehearsal.js --from <commit>    from that commit's files
//
// One address serves the files of <commit> (read with git show) and then this working tree's, as the web address does on the day:
//
//   1. Before: the work is made with the previous version's pages at the root (classes and a term of scores, a timetable and a lesson
//      in the Planner); its worker keeps the pages (gs-app-1); the new app is opened at next/ once, so its worker is there too.
//      Everything the browser keeps is read.
//   2. The switch goes up. The page still open checks for a new version: the root's new worker takes over and fetches the new app whole
//      (gs-next-2) and leaves the previous version's pages in use (gs-app-1), so the page says Update ready as on any other day.
//   3. Update now, from Settings, About and updates. The page reloads into the new app; gs-app-1 and gs-next-1 are gone, gs-app-2 is
//      whole. next/ sends her to the root, and its worker and caches are gone.
//   4. Everything the browser keeps is read again: nothing is lost or changed. The previous version opens at classic/ with the same
//      classes; a change made there shows in the new app and one made in the new app shows there. Old addresses land on new screens.
//
// Exits 1 when any step fails. Every student, class and lesson here is made up.
const fs = require('fs'), path = require('path'), http = require('http'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const { launch } = require('../helpers/chrome');
const { plant, appReady, goTo } = require('../helpers/app');
const { gradingSeed, PLAN_SETUP, makeLesson } = require('../helpers/steady');

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

async function main() {
  if (!gitShow('index.html')) { console.log('Can’t read the files of ' + FROM + ' (try: git fetch origin main).'); process.exit(1); }
  if (gitShow('classic/index.html')) { console.log(FROM + ' is already switched: nothing to rehearse. Passed.'); return; }
  for (const f of ['index.html', 'classic/index.html', 'sw.js', 'version.json', 'dist']) if (!fs.existsSync(path.join(ROOT, f))) { console.log(f + ' is not built: run npm run build and node next/build.js first.'); process.exit(1); }
  const srv = await serve(), browser = await launch({ args: ['--no-sandbox'] }), steps = [];
  let failed = false;
  const step = (ok, what, more) => { steps.push((ok ? 'ok    ' : 'FAIL  ') + what + (more ? '\n        ' + more : '')); if (!ok) failed = true; return ok; };
  const until = (page, fn, arg, timeout = 60000) => page.waitForFunction(fn, { timeout, polling: 250 }, arg).then(() => true, () => false);
  const errors = [];
  const newPage = async () => { const p = await browser.newPage(); p.on('pageerror', e => errors.push(String(e).split('\n')[0].slice(0, 200))); p.on('dialog', d => d.accept()); await p.setViewport({ width: 1366, height: 800 }); return p; };
  try {
    // 1. Before the switch.
    const page = await newPage();
    await page.goto(srv.url + 'blank'); await plant(page, gradingSeed());
    await page.goto(srv.url + '?sw=1'); await appReady(page);
    step(await until(page, async () => { const c = await caches.open('gs-app-1'); return !!(await c.match(new URL('version.json', location.href).href)); }), 'before: the previous version’s worker keeps its pages (gs-app-1)');
    const plan = await newPage();
    await plan.goto(srv.url + 'planner.html?sw=1');
    await plan.waitForFunction(() => window.__planner && document.querySelector('#lessons'), { timeout: 60000 });
    await plan.evaluate(async s => { await window.__planner.applySetup(s); }, PLAN_SETUP);
    const L = await makeLesson(plan); await sleep(400); await plan.close();
    const nx = await newPage();
    await nx.goto(srv.url + 'next/');
    const hadNext = await until(nx, async () => (await navigator.serviceWorker.getRegistrations()).some(r => /\/next\/$/.test(r.scope)), null, 30000);
    step(hadNext, 'before: the new app at next/ has its own worker');
    await nx.close();
    const before = await snapshot(page);
    step(Object.keys(before).length > 5, 'before: the work is kept (' + Object.keys(before).length + ' records)');

    // 2. The switch goes up; the page still open checks for a new version.
    site.switched = true;
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration('./'); await r.update(); });
    const fetched = await until(page, async () => { const n = await caches.keys(); if (!n.includes('gs-next-2')) return false; return !!(await (await caches.open('gs-next-2')).match(new URL('version.json', location.href).href)); }, null, 90000);
    let c = await caches(page);
    step(fetched && whole(c, 'gs-app-1'), 'the switch: the new app is fetched whole (gs-next-2) and the previous version’s pages stay in use (gs-app-1)', JSON.stringify(Object.keys(c)));
    await page.evaluate(() => navigator.serviceWorker.ready.then(r => r.active && r.active.postMessage({ type: 'gs-state' })));
    step(await until(page, () => { const r = document.querySelector('#railUpdate'); return r && !r.hidden; }, null, 30000), 'the page still open says Update ready');
    await page.reload(); await appReady(page);
    step(await page.evaluate(() => !!window.__gs && !document.querySelector('script[src*="dist/"]')), 'reloaded before Update now, it is still the previous version');

    // 3. Update now.
    await goTo(page, '#/settings/about');
    const btn = await page.waitForSelector('#setAbout [data-updnow]', { timeout: 30000 }).catch(() => null);
    step(!!btn, 'Settings, About and updates offers Update now');
    if (btn) {
      await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => {}), btn.click()]);
      await page.waitForSelector('[data-shell-nav], nav.tabbar', { timeout: 60000 }).catch(() => {});
    }
    step(await page.evaluate(() => !window.__gs && !![...document.scripts].find(s => /dist\//.test(s.src))), 'Update now opens the new app at the root');
    const swapped = await until(page, async () => { const n = await caches.keys(); return !n.includes('gs-app-1') && !n.includes('gs-next-1') && n.includes('gs-app-2'); }, null, 30000);
    c = await caches(page);
    step(swapped && whole(c, 'gs-app-2'), 'gs-app-1 and gs-next-1 are gone and the new app is whole in gs-app-2', JSON.stringify(Object.keys(c)));
    const nx2 = await newPage();
    await nx2.goto(srv.url + 'next/#/calendar');
    step(await until(nx2, () => location.pathname === '/' && location.hash === '#/calendar', null, 30000), 'next/ sends her to the same screen at the root', await nx2.evaluate(() => location.href));
    const gone = await until(nx2, async () => !(await navigator.serviceWorker.getRegistrations()).some(r => /\/next\/$/.test(r.scope)) && !(await caches.keys()).some(n => n.startsWith('gsn-')), null, 30000);
    step(!hadNext || gone, 'next/’s worker and its caches are gone', JSON.stringify(await regs(nx2)) + ' ' + JSON.stringify(Object.keys(await caches(nx2))));
    await nx2.close();

    // 4. Her work.
    await sleep(1000);
    const after = await snapshot(page), lost = [], changed = [], moved = [];
    for (const [k, v] of Object.entries(before)) {
      if (!(k in after)) (VOLATILE.test(k) ? moved : lost).push(k);
      else if (after[k] !== v) (VOLATILE.test(k) ? moved : changed).push(k);
    }
    step(!lost.length, 'nothing she kept is lost', lost.join(', '));
    step(!changed.length, 'nothing she kept is changed', changed.join(', '));
    if (moved.length) steps.push('      (records of visits and locks, rewritten as on any visit: ' + moved.join(', ') + ')');
    step(Object.keys(after).some(k => k.startsWith('gs-lessons/lessons/') && k.endsWith(L)), 'the lesson made in the Planner is kept');
    const cl = await newPage();
    await cl.goto(srv.url + 'classic/?sw=1'); await appReady(cl);
    await cl.waitForSelector('#railClasses a[data-railcls]', { timeout: 30000 }).catch(() => {});
    const names = await cl.$$eval('#railClasses a[data-railcls]', xs => xs.map(a => a.textContent.replace(/\s+/g, ' ').trim()));
    step(names.some(n => n.includes('Grade 9 English')) && names.some(n => n.includes('Grade 10 Literature')), 'classic/ opens the same classes', names.join(' | '));
    step(await until(cl, () => navigator.serviceWorker.getRegistrations().then(rs => rs.some(r => /\/classic\/$/.test(r.scope))), null, 30000), 'classic/ has its own worker');
    // A change each way.
    await cl.evaluate(async () => { const l = JSON.parse(localStorage.getItem('gs.lib')); l.classes.find(x => x.id === 'c2').name = 'Grade 10 Literature (renamed in classic)'; localStorage.setItem('gs.lib', JSON.stringify(l)); await window.__gs.reloadKept?.(); });
    await page.goto(srv.url + '#/classes'); await page.waitForSelector('[data-shell-nav]', { timeout: 30000 }).catch(() => {});
    step(await until(page, () => (document.querySelector('[data-shell-nav]') || {}).textContent?.includes('renamed in classic'), null, 20000), 'a class renamed in classic/ shows in the new app’s sidebar');
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
    // Old addresses.
    for (const [from, to] of [['#/class/c1/gradebook', '/#/class/c1/grades'], ['#/a/n1', '/#/mark/n1'], ['#/settings/claude', '/#/settings/ai'], ['planner.html#plan', '/#/calendar'], ['planner.html#lesson/' + L, '/#/lesson/' + encodeURIComponent(L)]]) {
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
