// Updates for the new app: its service worker (next/src/sw.js, copied to sw.js at the root), and the Update now control the sidebar's foot and
// the phone's More screen show. Nothing here talks to the current app's worker or its messages (gs-state); ours are gsn-*.
import { useState, useEffect } from 'preact/hooks';
import { toast } from '../ui/index.js';
import { t } from '../i18n/t.js';
import { saveBeforeReload } from './saving/trouble.js';

let st = { current: '', waiting: '', mode: 'ask', checked: '', checking: false, progress: null, install: null, installed: false, stale: false };
// the version this window opened on, and whether it is this window that asked for the update (src/safe.js upd.mine, upd.applying)
let mine = '', applying = false, build = '', waitT = 0, giveT = 0;
const told = new Set();
const set = s => { st = { ...st, ...s }; told.forEach(f => f(st)); };
const sw = () => navigator.serviceWorker;
const post = msg => { const c = sw() && sw().controller; if (c) c.postMessage(msg); else if (sw()) sw().ready.then(r => r.active && r.active.postMessage(msg)); };
const ver = v => (v ? v.version + (v.build ? ' (' + v.build.slice(0, 7) + ')' : '') : '');
let started = false;
// Install as an app (src/safe.js): the browser offers it once the page can be installed; Install in About asks it.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); set({ install: e }); });
  window.addEventListener('appinstalled', () => set({ install: null, installed: true }));
}
export async function installApp() { const e = st.install; if (!e) return false; e.prompt(); try { await e.userChoice; } catch {} set({ install: null }); return true; }
export function startUpdates() {
  if (started || !sw() || !/^https?:$/.test(location.protocol)) return; started = true;
  sw().addEventListener('message', e => {
    const d = e.data || {}; if (d.type !== 'gsn-state') return;
    const s = d.state || {};
    if (!mine && s.current) mine = s.current.build;
    build = s.current ? s.current.build : '';
    const done = d.checked ? { checking: false, progress: null } : d.progress ? { checking: true, progress: d.progress } : {};
    if (d.checked) { clearTimeout(waitT); clearTimeout(giveT); } else if (d.progress) giveUp(60000);   // files arrive every second or so
    // another window took the update: this one stays on the version it has, with her work, until she reloads it
    set({ current: ver(s.current), waiting: s.next && (!s.current || s.next.build !== s.current.build) ? ver(s.next) : '', mode: s.mode || 'ask', checked: d.checked || st.checked, stale: !!(s.current && mine && s.current.build !== mine), ...done });
    if (d.applied && applying) location.reload();
  });
  // Each time the app opens it asks for the state, and for a check: the first visit's worker may not be answering this page yet.
  sw().register('sw.js', { scope: './' }).then(() => { post({ type: 'gsn-state' }); post({ type: 'gsn-check' }); }, e => console.error(e));
}
// Her work first (src/safe.js updApply): what is waiting is saved, and nothing reloads over work that isn't safely stored.
export async function applyUpdate() { if (!(await saveBeforeReload())) return toast(t('update.wait_save'), { ms: 7000 }); applying = true; post({ type: 'gsn-apply' }); }
export async function reloadWindow() { if (!(await saveBeforeReload())) return toast(t('update.wait_save'), { ms: 7000 }); location.reload(); }
// Check for an update answers in the card at once, and always: Checking…, then how far the download is, the newest version, an
// update ready, or why it couldn't check. The browser is asked for the newest sw.js too, since a worker kept from an older version
// is the one answering until then, and that one says nothing until its whole download is done: after 10 s without a word the
// page looks at the site's version.json itself, and after 6 minutes (longer than a browser lets a worker run) it gives up.
function giveUp(ms) { clearTimeout(giveT); giveT = setTimeout(() => { if (st.checking) set({ checking: false, progress: null, checked: 'site' }); }, ms); }
export async function checkUpdate() {
  if (st.checking) return;
  set({ checking: true, checked: '', progress: null });
  clearTimeout(waitT); clearTimeout(giveT);
  giveUp(350000);
  try { const r = sw() && await sw().getRegistration(); if (r) r.update().catch(() => {}); } catch {}
  post({ type: 'gsn-check' });
  waitT = setTimeout(async () => {
    if (!st.checking || st.progress) return;
    const r = await fetch('version.json', { cache: 'no-store' }).catch(() => null), off = !r;
    let v = null; try { v = r && r.ok ? await r.json() : null; } catch {}
    if (!st.checking || st.progress) return;
    if (!v || !v.build) return set({ checking: false, checked: off ? 'offline' : 'site' });
    if (v.build === build) return set({ checking: false, checked: 'ok' });
    set({ progress: { v: v.version } });
  }, 10000);
}
export const setUpdateMode = m => post({ type: 'gsn-mode', mode: m });
export function useUpdate() {
  const [s, setS] = useState(st);
  useEffect(() => { told.add(setS); setS(st); return () => told.delete(setS); }, []);
  return { ...s, apply: applyUpdate, reload: reloadWindow, check: checkUpdate, setMode: setUpdateMode, installApp };
}
