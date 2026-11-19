// Updates for the new app: its own service worker (next/sw.js, scope next/), and the Update now control the sidebar's foot and
// the phone's More screen show. Nothing here talks to the current app's worker or its messages (gs-state); ours are gsn-*.
import { useState, useEffect } from 'preact/hooks';
import { toast } from '../ui/index.js';
import { t } from '../i18n/t.js';
import { saveBeforeReload } from './saving/trouble.js';

let st = { current: '', waiting: '', mode: 'ask', checked: '', install: null, installed: false, stale: false };
// the version this window opened on, and whether it is this window that asked for the update (src/safe.js upd.mine, upd.applying)
let mine = '', applying = false;
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
    // another window took the update: this one stays on the version it has, with her work, until she reloads it
    set({ current: ver(s.current), waiting: s.next && (!s.current || s.next.build !== s.current.build) ? ver(s.next) : '', mode: s.mode || 'ask', checked: d.checked || st.checked, stale: !!(s.current && mine && s.current.build !== mine) });
    if (d.applied && applying) location.reload();
  });
  // Each time the app opens it asks for the state, and for a check: the first visit's worker may not be answering this page yet.
  sw().register('sw.js', { scope: './' }).then(() => { post({ type: 'gsn-state' }); post({ type: 'gsn-check' }); }, e => console.error(e));
}
// Her work first (src/safe.js updApply): what is waiting is saved, and nothing reloads over work that isn't safely stored.
export async function applyUpdate() { if (!(await saveBeforeReload())) return toast(t('update.wait_save'), { ms: 7000 }); applying = true; post({ type: 'gsn-apply' }); }
export async function reloadWindow() { if (!(await saveBeforeReload())) return toast(t('update.wait_save'), { ms: 7000 }); location.reload(); }
export const checkUpdate = () => post({ type: 'gsn-check' });
export const setUpdateMode = m => post({ type: 'gsn-mode', mode: m });
export function useUpdate() {
  const [s, setS] = useState(st);
  useEffect(() => { told.add(setS); setS(st); return () => told.delete(setS); }, []);
  return { ...s, apply: applyUpdate, reload: reloadWindow, check: checkUpdate, setMode: setUpdateMode, installApp };
}
