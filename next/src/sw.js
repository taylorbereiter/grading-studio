// Grading Studio's service worker at the root (next/docs/sw.md, "At the switch"). next/build.js copies this file to sw.js at the root;
// it is not bundled. It keeps the new app on this computer, holds a newer version back until the teacher says so, streams Drive videos
// (gs-drive/<id>), and takes over from the previous version's root worker without breaking a page of that version still open.
//
// It touches nothing of her work. Marks, scores, papers and rosters live in localStorage and IndexedDB, which this file never opens;
// the pages live in the browser's cache storage, which is separate. Deleting every cache here loses nothing but the offline copy.
//
// A version is only ever taken whole: version.json lists every file with its SHA-256, the files are checked against it, and
// version.json is written last, so a cache without it is not used. APP is the version in use, NEXT a newer one waiting. It becomes
// APP only when a page asks (Update now), or, if she chose "update by itself", at the moment the app is next opened.
//
// The handover. Before the switch the root worker was the previous version's (src/sw.js then), with its pages in gs-app-1, a waiting
// version in gs-next-1 and her choice in gs-kept-1. While gs-app-1 holds a whole version, this worker goes on answering the root
// with those pages, and answers their messages (gs-state, gs-check, gs-apply, gs-mode) as that worker did, so a teacher mid-session
// sees Update ready as on any other day. The new app is fetched whole into NEXT meanwhile. Update now (or "update by itself", on the
// next open) makes it APP, and only then are gs-app-1, gs-next-1 and gs-kept-1 deleted. Her choice in gs-kept-1 is carried into KEPT.
//
// The previous version itself now lives at classic/ with its own worker and gsc-* caches; next/ has a worker that retires itself.
// Neither address is answered here. Anything from another site (cdn.jsdelivr.net, Google) goes to the web as if this weren't here.
const APP = 'gs-app-2', NEXT = 'gs-next-2', KEPT = 'gs-kept-2';
const OLD_APP = 'gs-app-1', OLD_NEXT = 'gs-next-1', OLD_KEPT = 'gs-kept-1';
const SCOPE = self.registration.scope, at = n => SCOPE + n;
const AWAY = /^(classic|next)\//;   // the previous version's address and the retired one: never answered here
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const versionIn = async name => { try { const r = await caches.has(name) && await (await caches.open(name)).match(at('version.json')); return r ? await r.json() : null; } catch { return null; } };
const modeIn = async name => { try { const r = await caches.has(name) && await (await caches.open(name)).match(at('mode')); return r ? await r.text() : null; } catch { return null; } };
const mode = async () => ((await modeIn(KEPT)) ?? (await modeIn(OLD_KEPT))) === 'auto' ? 'auto' : 'ask';
const setMode = async m => (await caches.open(KEPT)).put(at('mode'), new Response(m === 'auto' ? 'auto' : 'ask'));
// The previous version's pages, while they are still the ones in use here.
const old = () => versionIn(OLD_APP);
let queue = Promise.resolve();
const inTurn = fn => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', png: 'image/png', webp: 'image/webp', webmanifest: 'application/manifest+json' };
const typeOf = p => TYPES[p.split('.').pop()] || 'application/octet-stream';

async function download(name, v) {
  const got = [];
  for (const [p, sum] of Object.entries(v.sums)) {
    const r = await fetch(at(p), { cache: 'no-store' });
    if (!r.ok) throw new Error(p + ': ' + r.status);
    const buf = await r.arrayBuffer();
    if (hex(await crypto.subtle.digest('SHA-256', buf)) !== sum) throw new Error(p + ' is not the file version.json describes');   // caught between two versions going up: try again later
    got.push([p, new Response(buf, { headers: { 'Content-Type': typeOf(p) } })]);
  }
  await caches.delete(name);
  const c = await caches.open(name);
  for (const [p, r] of got) await c.put(at(p), r);
  await c.put(at('version.json'), new Response(JSON.stringify(v), { headers: { 'Content-Type': 'application/json' } }));
}
const latest = async () => { const r = await fetch(at('version.json'), { cache: 'no-store' }); if (!r.ok) throw new Error('version.json: ' + r.status); const v = await r.json(); if (!v || !v.build || !v.sums) throw new Error('version.json is not a version'); return v; };   // sums, never files: see next/build.js writeVersion
// The previous version's caches go, once the new version is whole in APP. Her choice of how updates arrive stays (KEPT).
async function dropOld() {
  if (!await versionIn(APP)) return;
  const m = await modeIn(OLD_KEPT); if (m != null && (await modeIn(KEPT)) == null) await setMode(m);
  for (const n of [OLD_APP, OLD_NEXT, OLD_KEPT]) await caches.delete(n);
}
// Looks for a newer version. With nothing kept yet, the version on the web becomes the one in use. With the previous version's pages
// still in use, the new one waits in NEXT, like any update.
async function check() {
  const v = await latest(), cur = await versionIn(APP), was = await old();
  if (cur && was) await dropOld();   // a handover cut short: the new version is whole, so it is finished now
  if (!cur && !was) { await download(APP, v); await dropOld(); return; }
  if (cur && v.build === cur.build) { await caches.delete(NEXT); return; }
  const nx = await versionIn(NEXT);
  if (!nx || nx.build !== v.build) await download(NEXT, v);
}
// The waiting version becomes the one in use, whole: APP is emptied, filled, and version.json goes across last.
async function promote() {
  const nx = await versionIn(NEXT); if (!nx) return false;
  const from = await caches.open(NEXT);
  await caches.delete(APP);
  const to = await caches.open(APP);
  for (const p of Object.keys(nx.sums)) { const r = await from.match(at(p)); if (r) await to.put(at(p), r); }
  await to.put(at('version.json'), await from.match(at('version.json')));
  await caches.delete(NEXT);
  await dropOld();
  return true;
}
// What a page is told. The new app's (gsn-state) is about APP and NEXT. A page of the previous version (gs-state) has its own
// version as the one in use until the handover, so it shows Update ready for the new one, and afterwards "Reload to update".
async function tell(extra) {
  const cur = await versionIn(APP), next = await versionIn(NEXT), m = await mode(), was = await old();
  const mine = { type: 'gsn-state', state: { current: cur, next, mode: m }, ...extra };
  const theirs = { type: 'gs-state', state: { current: was || cur, next, mode: m }, ...extra };
  for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
    if (!c.url.startsWith(SCOPE) || AWAY.test(c.url.slice(SCOPE.length))) continue;
    c.postMessage(mine); c.postMessage(theirs);
  }
}

// The new worker takes over at once: the previous version's pages stay in its caches and are answered from there (below).
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(inTurn(async () => { const m = await modeIn(OLD_KEPT); if (m != null && (await modeIn(KEPT)) == null) await setMode(m); await check(); }).then(() => tell(), () => {})); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// The previous version's own files, answered from its cache while it is in use. A language or the sample's builder it had not kept
// comes from classic/, where that version now lives, since the root no longer has them.
const OLD_FILE = /^(index\.html|planner\.html|manifest\.webmanifest|icons\/[\w-]+\.png|lang\/[A-Za-z-]+\.js)$/;
const CLASSIC_FILE = /^(lang\/[A-Za-z-]+\.js|sample\.js|Grading Studio\.html|Planner\.html)$/;
async function answer(key, req, page) {
  try {
    if (page && await mode() === 'auto') await inTurn(promote);   // she is opening the app, not using it: the moment an update may arrive by itself
    if (await old()) { if (OLD_FILE.test(key)) { const hit = await (await caches.open(OLD_APP)).match(at(key)); if (hit) return hit; } }
    else { const cur = await versionIn(APP); if (cur && cur.sums[key]) { const hit = await (await caches.open(APP)).match(at(key)); if (hit) return hit; } }
  } catch {}
  if (CLASSIC_FILE.test(key)) return fetch(at('classic/' + key) + new URL(req.url).search);
  return fetch(req);
}

// A Drive video played straight from Drive: the page's player asks for gs-drive/<id>, and this asks Drive for the same bytes (the part being
// watched, by its Range), signed with the teacher's token. The token is asked of the page (the new app's whole/stream.js, or the previous
// version's src/app/drive.js, which answer the same gs-drive-token) each time this worker starts, and held only in memory.
let dTok = null;
async function driveToken(clientId, fresh) {
  if (!fresh && dTok && dTok.exp > Date.now() + 30000) return dTok.token;
  const c = (clientId && await self.clients.get(clientId)) || (await self.clients.matchAll({ type: 'window' })).find(x => x.url.startsWith(SCOPE) && !AWAY.test(x.url.slice(SCOPE.length)));
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
  let rel = new URL(req.url).pathname.slice(new URL(SCOPE).pathname.length); try { rel = decodeURIComponent(rel); } catch {}
  // A page of the previous version opened at classic/ before its own worker took it asks for classic/gs-drive/<id>.
  const dm = /^(?:classic\/)?gs-drive\/([\w-]{10,})$/.exec(rel);
  if (dm) { e.respondWith(driveStream(dm[1], req, e.clientId)); return; }
  if (AWAY.test(rel) || rel === 'version.json') return;   // everything else here goes to the web as if this file weren't here
  const key = rel === '' ? 'index.html' : rel, page = req.mode === 'navigate';
  if (page ? !/^(index|planner)\.html$/.test(key) && !CLASSIC_FILE.test(key) : !/^(dist\/|icons\/|manifest\.webmanifest$|lang\/|sample\.js$)/.test(key)) return;
  e.respondWith(answer(key, req, page && /^(index|planner)\.html$/.test(key)));
  if (page) e.waitUntil(inTurn(check).then(() => tell(), () => {}));
});
self.addEventListener('message', e => {
  const d = e.data || {}, ty = String(d.type || '').replace(/^gsn-/, 'gs-');   // the new app's messages are gsn-*, the previous version's gs-*
  if (d.type === 'gs-drive-ok' && e.ports[0]) e.ports[0].postMessage({ drive: 1 });
  else if (ty === 'gs-state') e.waitUntil(tell());
  else if (ty === 'gs-check') e.waitUntil(inTurn(check).then(() => tell({ checked: 'ok' }), () => tell({ checked: 'offline' })));
  else if (ty === 'gs-apply') e.waitUntil(inTurn(promote).then(done => tell({ applied: !!done })));
  else if (ty === 'gs-mode') e.waitUntil(setMode(d.mode).then(() => tell()));
});
