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
const inTurn = fn => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp' };
const typeOf = p => TYPES[p.split('.').pop()] || 'application/octet-stream';

async function download(name, v) {
  const got = [];
  for (const [p, sum] of Object.entries(v.files)) {
    const r = await fetch(at(p), { cache: 'no-store' });
    if (!r.ok) throw new Error(p + ': ' + r.status);
    const buf = await r.arrayBuffer();
    if (hex(await crypto.subtle.digest('SHA-256', buf)) !== sum) throw new Error(p + ' is not the file version.json describes');
    got.push([p, new Response(buf, { headers: { 'Content-Type': typeOf(p) } })]);
  }
  await caches.delete(name);
  const c = await caches.open(name);
  for (const [p, r] of got) await c.put(at(p), r);
  await c.put(at('version.json'), new Response(JSON.stringify(v), { headers: { 'Content-Type': 'application/json' } }));
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
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(inTurn(check).then(() => tell(), () => {})); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
async function answer(key, req, page) {
  try {
    if (page && await mode() === 'auto') await inTurn(promote);
    const cur = await versionIn(APP);
    if (cur && cur.files[key]) { const hit = await (await caches.open(APP)).match(at(key)); if (hit) return hit; }
  } catch {}
  return fetch(req);
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET' || !req.url.startsWith(SCOPE)) return;
  const rel = new URL(req.url).pathname.slice(new URL(SCOPE).pathname.length);
  const page = req.mode === 'navigate';
  const key = rel === '' ? 'index.html' : rel;
  if (page && key !== 'index.html') return;   // the gallery and the proof page always come from the web
  if (!page && !/^dist\//.test(key)) return;
  e.respondWith(answer(key, req, page));
  if (page) e.waitUntil(inTurn(check).then(() => tell(), () => {}));
});
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'gsn-state') e.waitUntil(tell());
  else if (d.type === 'gsn-check') e.waitUntil(inTurn(check).then(() => tell({ checked: 'ok' }), () => tell({ checked: 'offline' })));
  else if (d.type === 'gsn-apply') e.waitUntil(inTurn(promote).then(done => tell({ applied: !!done })));
  else if (d.type === 'gsn-mode') e.waitUntil(caches.open(KEPT).then(c => c.put(at('mode'), new Response(d.mode === 'auto' ? 'auto' : 'ask'))).then(() => tell()));
});
