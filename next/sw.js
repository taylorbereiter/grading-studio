// The new app's service worker (next/docs/sw.md). Registered by next/index.html with the scope next/, so it answers only the new
// app's own addresses; the current app's worker (sw.js at the root) keeps answering the current app, and this file never opens,
// deletes or renames one of its caches (gs-*). Its own are gsn-*. It touches no saved work: that lives in localStorage and
// IndexedDB, which this file never opens.
//
// The same way of keeping a version as the root worker: next/version.json lists every file of the new app with its SHA-256; a
// version is fetched whole, checked against it, and version.json is written last, so a cache without it is not used. A newer
// version waits (gsn-next-1) until the teacher presses Update now, or, if she chose "update by itself", until the app is next opened.
const APP = 'gsn-app-1', NEXT = 'gsn-next-1', KEPT = 'gsn-kept-1';
const SCOPE = self.registration.scope, at = n => SCOPE + n;
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const versionIn = async name => { try { const r = await caches.has(name) && await (await caches.open(name)).match(at('version.json')); return r ? await r.json() : null; } catch { return null; } };
const mode = async () => { try { const r = await caches.has(KEPT) && await (await caches.open(KEPT)).match(at('mode')); return r && (await r.text()) === 'auto' ? 'auto' : 'ask'; } catch { return 'ask'; } };
let queue = Promise.resolve();
// The check running now (one at a time: a press while it runs joins it) and how far its download is, told to the page now and then.
let run = null, prog = null, saidAt = 0;
const said = () => { if (Date.now() - saidAt > 700) { saidAt = Date.now(); tell({ progress: prog }); } };
const checkNow = () => run || (run = inTurn(check).finally(() => { run = null; prog = null; }));
// What a failed check says: no connection at all, or the site answered but the version wasn't whole (a file missing or changed
// while the site was being updated).
const why = e => (e instanceof TypeError ? 'offline' : 'site');
const checkTell = () => checkNow().then(() => tell({ checked: 'ok' }), err => tell({ checked: why(err) }));
const inTurn = fn => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp' };
const typeOf = p => TYPES[p.split('.').pop()] || 'application/octet-stream';

// Six files at a time, each tried three times. A file is kept in the cache as soon as it is checked, so a check stopped part way
// (the browser stops a worker that runs too long, or the window closed) goes on from there next time; a file the version in use
// already has with the same SHA-256 is taken from it, so an update fetches only what changed. The page hears how far it has got.
async function download(name, v) {
  const c = await caches.open(name), mark = await c.match(at('building'));
  if (!mark || (await mark.text()) !== v.build) { await caches.delete(name); }
  const to = await caches.open(name), cur = await versionIn(APP), app = cur && await caches.open(APP);
  await to.put(at('building'), new Response(v.build));
  const todo = Object.entries(v.files);
  prog = { v: v.version, done: 0, of: todo.length };
  const ok = async (r, sum) => r && hex(await crypto.subtle.digest('SHA-256', await r.clone().arrayBuffer())) === sum;
  async function one([p, sum]) {
    if (await ok(await to.match(at(p)), sum)) return;
    const had = name !== APP && cur.files[p] === sum && await app.match(at(p));
    if (await ok(had, sum)) return to.put(at(p), had);
    for (let n = 0; ; n++) {
      try {
        const r = await fetch(at(p), { cache: 'no-store' });
        if (!r.ok) throw new Error(p + ': ' + r.status);
        const buf = await r.arrayBuffer();
        if (hex(await crypto.subtle.digest('SHA-256', buf)) !== sum) throw new Error(p + ' is not the file version.json describes');
        return to.put(at(p), new Response(buf, { headers: { 'Content-Type': typeOf(p) } }));
      } catch (e) { if (n === 2) throw e; await new Promise(r => setTimeout(r, 1500 * (n + 1))); }
    }
  }
  let i = 0, failed = null;
  const lane = async () => { while (!failed && i < todo.length) { try { await one(todo[i++]); prog.done++; said(); } catch (e) { failed = e; } } };
  await Promise.all(Array.from({ length: 6 }, lane));
  if (failed) throw failed;
  await to.delete(at('building'));
  await to.put(at('version.json'), new Response(JSON.stringify(v), { headers: { 'Content-Type': 'application/json' } }));
}
const latest = async () => { const r = await fetch(at('version.json'), { cache: 'no-store' }); if (!r.ok) throw new Error('version.json: ' + r.status); const v = await r.json(); if (!v || !v.build || !v.files) throw new Error('version.json is not a version'); return v; };
async function check() {
  const v = await latest(), cur = await versionIn(APP);
  if (!cur) { await download(APP, v); return; }
  if (v.build === cur.build) { await caches.delete(NEXT); return; }
  const nx = await versionIn(NEXT);
  if (!nx || nx.build !== v.build) await download(NEXT, v);
}
async function promote() {
  const nx = await versionIn(NEXT); if (!nx) return false;
  const from = await caches.open(NEXT);
  await caches.delete(APP);
  const to = await caches.open(APP);
  for (const p of Object.keys(nx.files)) { const r = await from.match(at(p)); if (r) await to.put(at(p), r); }
  await to.put(at('version.json'), await from.match(at('version.json')));
  await caches.delete(NEXT);
  return true;
}
const state = async () => ({ current: await versionIn(APP), next: await versionIn(NEXT), mode: await mode() });
async function tell(extra) {
  const msg = { type: 'gsn-state', state: await state(), ...extra };
  for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) if (c.url.startsWith(SCOPE)) c.postMessage(msg);
}
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(checkTell()); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
async function answer(key, req, page) {
  try {
    if (page && await mode() === 'auto') await inTurn(promote);
    const cur = await versionIn(APP);
    if (cur && cur.files[key]) { const hit = await (await caches.open(APP)).match(at(key)); if (hit) return hit; }
  } catch {}
  return fetch(req);
}
// A Drive video played straight from Drive (as the root worker does): the page's player asks for gs-drive/<id>, and this asks Drive for
// the same bytes (the part being watched, by its Range), signed with her key. The key is asked of the page (whole/stream.js) and held
// only in memory.
let dTok = null;
async function driveToken(clientId, fresh) {
  if (!fresh && dTok && dTok.exp > Date.now() + 30000) return dTok.token;
  const c = (clientId && await self.clients.get(clientId)) || (await self.clients.matchAll({ type: 'window' })).find(x => x.url.startsWith(SCOPE));
  if (!c) return null;
  const t = await new Promise(res => { const ch = new MessageChannel(), to = setTimeout(() => res(null), 10000); ch.port1.onmessage = ev => { clearTimeout(to); res(ev.data); }; c.postMessage({ type: 'gs-drive-token', fresh: !!fresh }, [ch.port2]); });
  dTok = t && t.token ? { token: t.token, exp: t.exp || Date.now() + 300000 } : null;
  return dTok && dTok.token;
}
async function driveStream(id, req, clientId) {
  const go = async fresh => {
    const tok = await driveToken(clientId, fresh);
    if (!tok) return new Response('', { status: 401, statusText: 'Sign in' });
    const h = { Authorization: 'Bearer ' + tok }, rg = req.headers.get('Range'); if (rg) h.Range = rg;
    return fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?alt=media&supportsAllDrives=true', { headers: h, signal: req.signal });
  };
  try { let r = await go(false); if (r.status === 401) r = await go(true); return r; } catch (err) { return new Response('', { status: 502, statusText: String(err && err.message || err) }); }
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET' || !req.url.startsWith(SCOPE)) return;
  const rel = new URL(req.url).pathname.slice(new URL(SCOPE).pathname.length);
  const dm = /^gs-drive\/([\w-]{10,})$/.exec(rel);
  if (dm) { e.respondWith(driveStream(dm[1], req, e.clientId)); return; }
  const page = req.mode === 'navigate';
  const key = rel === '' ? 'index.html' : rel;
  if (page && key !== 'index.html') return;   // the gallery and the proof page always come from the web
  if (!page && !/^dist\//.test(key)) return;
  e.respondWith(answer(key, req, page));
  if (page) e.waitUntil(checkTell());
});
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'gs-drive-ok' && e.ports[0]) e.ports[0].postMessage({ drive: 1 });
  else if (d.type === 'gsn-state') e.waitUntil(tell());
  else if (d.type === 'gsn-check') { if (prog) tell({ progress: prog }); e.waitUntil(checkTell()); }
  else if (d.type === 'gsn-apply') e.waitUntil(inTurn(promote).then(done => tell({ applied: !!done })));
  else if (d.type === 'gsn-mode') e.waitUntil(caches.open(KEPT).then(c => c.put(at('mode'), new Response(d.mode === 'auto' ? 'auto' : 'ask'))).then(() => tell()));
});
