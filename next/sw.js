// The new app's worker at next/ retires (next/docs/sw.md, "At the switch"). The new app now lives at the root, with the root's worker
// (sw.js there). A browser that kept the new app at next/ fetches this file on its next visit; it then deletes the caches the old
// next/ worker kept (gsn-*, holding next/ addresses), sends each window it had to the root (../), and unregisters. It never opens a
// cache of the root's (gs-*) or the previous version's (gsc-*), and touches no saved work: that lives in localStorage and IndexedDB.
const SCOPE = self.registration.scope, HERE = new URL(SCOPE).pathname, ROOT = new URL('../', SCOPE).href;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  try { await self.clients.claim(); } catch {}
  for (const n of await caches.keys()) {
    if (!/^gsn-/.test(n)) continue;
    try { const keys = await (await caches.open(n)).keys(); if (!keys.length || keys.some(r => new URL(r.url).pathname.startsWith(HERE))) await caches.delete(n); } catch {}
  }
  for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
    if (!c.url.startsWith(SCOPE)) continue;
    const u = new URL(c.url);
    try { await c.navigate(ROOT + u.search + u.hash); } catch {}
  }
  await self.registration.unregister();
})()));
// Until it is gone, nothing here is answered from a cache: every address goes to the web, where next/ sends her to the root.
