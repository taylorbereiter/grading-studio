// Grading Studio's service worker: keeps the pages on this computer, and holds a newer version back until the teacher says so.
//
// It touches nothing of her work. Marks, scores, papers and rosters live in localStorage and IndexedDB, which this file never opens;
// the pages live in the browser's cache storage, which is separate. Deleting every cache here loses nothing but the offline copy.
//
// Two caches. APP is the version in use: every visit is answered from it, with or without internet. NEXT is a newer version that has
// been fetched and checked and is waiting. It becomes APP only when a page asks (Update now), or, if she chose "update by itself",
// at the moment the app is next opened. A version is only ever taken whole: version.json lists a hash for each page, the pages are
// checked against it, and version.json is written last, so a cache without it is not used.
//
// To switch all of this off for everyone, replace this file with one that unregisters itself and deletes the caches; browsers fetch
// sw.js fresh, so that reaches every computer on its next visit.
const APP = 'gs-app-1', NEXT = 'gs-next-1', KEPT = 'gs-kept-1';
const PAGES = ['index.html', 'planner.html'], EXTRA = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
const SCOPE = self.registration.scope, at = n => SCOPE + n;
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const versionIn = async name => { try { const r = await caches.has(name) && await (await caches.open(name)).match(at('version.json')); return r ? await r.json() : null; } catch { return null; } };
const mode = async () => { try { const r = await caches.has(KEPT) && await (await caches.open(KEPT)).match(at('mode')); return r && (await r.text()) === 'auto' ? 'auto' : 'ask'; } catch { return 'ask'; } };
// One thing at a time: a check, a download and a swap never overlap.
let queue = Promise.resolve();
const inTurn = fn => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };

// Fetches version v whole into the cache called name. Nothing is kept unless every page matches its hash.
async function download(name, v) {
  const got = [];
  for (const p of PAGES) {
    const r = await fetch(at(p), { cache: 'no-store' });
    if (!r.ok) throw new Error(p + ': ' + r.status);
    const buf = await r.arrayBuffer();
    if (hex(await crypto.subtle.digest('SHA-256', buf)) !== v.files[p]) throw new Error(p + ' is not the page version.json describes');   // caught between two versions going up: try again later
    got.push([p, new Response(buf, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })]);
  }
  // The languages in use on this computer come along, so a version is whole in her language too. One the new version no longer has is left out.
  for (const p of await langsKept()) {
    if (!v.langs || !v.langs[p]) continue;
    const r = await fetch(at(p), { cache: 'no-store' });
    if (!r.ok) throw new Error(p + ': ' + r.status);
    const buf = await r.arrayBuffer();
    if (hex(await crypto.subtle.digest('SHA-256', buf)) !== v.langs[p]) throw new Error(p + ' is not the file version.json describes');
    got.push([p, new Response(buf, { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } })]);
  }
  await caches.delete(name);
  const c = await caches.open(name);
  for (const [p, r] of got) await c.put(at(p), r);
  for (const p of EXTRA) { try { const r = await fetch(at(p), { cache: 'no-store' }); if (r.ok) await c.put(at(p), r); } catch {} }   // the icon and the install card: nice to have
  await c.put(at('version.json'), new Response(JSON.stringify(v), { headers: { 'Content-Type': 'application/json' } }));
}
// A language is one file beside the pages, lang/<code>.js. Only the ones a teacher on this computer chose are kept: the first time
// a page asks for one it comes from the web and, if it is the file the version in use describes, it is kept with that version.
const LANG_FILE = /^lang\/[A-Za-z-]+\.js$/;
const langsIn = async name => { try { if (!await caches.has(name)) return []; const from = SCOPE.length; return (await (await caches.open(name)).keys()).map(r => r.url.slice(from)).filter(p => LANG_FILE.test(p)); } catch { return []; } };
const langsKept = () => langsIn(APP);
async function answerLang(key, req) {
  try { if (await versionIn(APP)) { const hit = await (await caches.open(APP)).match(at(key)); if (hit) return hit; } } catch {}
  const r = await fetch(req);
  try {
    const cur = await versionIn(APP);
    if (r.ok && cur && cur.langs && cur.langs[key]) {
      const buf = await r.clone().arrayBuffer();
      if (hex(await crypto.subtle.digest('SHA-256', buf)) === cur.langs[key]) await (await caches.open(APP)).put(at(key), new Response(buf, { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } }));
    }
  } catch {}
  return r;
}
const latest = async () => { const r = await fetch(at('version.json'), { cache: 'no-store' }); if (!r.ok) throw new Error('version.json: ' + r.status); const v = await r.json(); if (!v || !v.build || !v.files) throw new Error('version.json is not a version'); return v; };
// Looks for a newer version. The first time, there is nothing kept yet, so the version on the web becomes the one in use.
async function check() {
  const v = await latest(), cur = await versionIn(APP);
  if (!cur) { await download(APP, v); return; }
  if (v.build === cur.build) { await caches.delete(NEXT); return; }
  const nx = await versionIn(NEXT);
  if (!nx || nx.build !== v.build) await download(NEXT, v);
}
// The waiting version becomes the one in use. version.json goes across last, so a swap cut short is finished by the next one.
async function promote() {
  const nx = await versionIn(NEXT); if (!nx) return false;
  const from = await caches.open(NEXT), to = await caches.open(APP);
  await to.delete(at('version.json'));   // not a whole version again until the last piece is across
  const langs = await langsIn(NEXT);
  for (const p of await langsKept()) if (!langs.includes(p)) await to.delete(at(p));   // chosen after the new version was fetched: it is fetched again, for the new pages
  for (const p of [...PAGES, ...EXTRA, ...langs, 'version.json']) { const r = await from.match(at(p)); if (r) await to.put(at(p), r); }
  await caches.delete(NEXT);
  return true;
}
const state = async () => ({ current: await versionIn(APP), next: await versionIn(NEXT), mode: await mode() });
async function tell(extra) {
  const msg = { type: 'gs-state', state: await state(), ...extra };
  for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) c.postMessage(msg);
}

self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(inTurn(() => check()).then(() => tell(), () => {})); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

async function answer(key, req, page) {
  try {
    if (page && await mode() === 'auto') await inTurn(promote);   // she is opening the app, not using it: the moment an update may arrive by itself
    if (await versionIn(APP)) { const hit = await (await caches.open(APP)).match(at(key)); if (hit) return hit; }
  } catch {}
  return fetch(req);
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET' || !req.url.startsWith(SCOPE)) return;
  const rel = new URL(req.url).pathname.slice(new URL(SCOPE).pathname.length);
  const key = rel === '' || rel === 'index.html' ? 'index.html' : rel === 'planner.html' ? 'planner.html' : EXTRA.includes(rel) ? rel : null;
  if (!key && LANG_FILE.test(rel)) { e.respondWith(answerLang(rel, req)); return; }
  if (!key) return;   // everything else goes to the web as if this file weren't here
  const page = req.mode === 'navigate';
  if (!page && !EXTRA.includes(key)) return;
  e.respondWith(answer(key, req, page));
  if (page) e.waitUntil(inTurn(() => check()).then(() => tell(), () => {}));
});
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'gs-state') e.waitUntil(tell());
  else if (d.type === 'gs-check') e.waitUntil(inTurn(() => check()).then(() => tell({ checked: 'ok' }), () => tell({ checked: 'offline' })));
  else if (d.type === 'gs-apply') e.waitUntil(inTurn(promote).then(done => tell({ applied: !!done })));
  else if (d.type === 'gs-mode') e.waitUntil(caches.open(KEPT).then(c => c.put(at('mode'), new Response(d.mode === 'auto' ? 'auto' : 'ask'))).then(() => tell()));
});
