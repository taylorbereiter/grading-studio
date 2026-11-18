// Updates for the new app: its own service worker (next/sw.js, scope next/), and the Update now control the sidebar's foot and
// the phone's More screen show. Nothing here talks to the current app's worker or its messages (gs-state); ours are gsn-*.
import { useState, useEffect } from 'preact/hooks';

let st = { current: '', waiting: '', mode: 'ask', checked: '', install: null, installed: false };
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
    set({ current: ver(s.current), waiting: s.next && (!s.current || s.next.build !== s.current.build) ? ver(s.next) : '', mode: s.mode || 'ask', checked: d.checked || st.checked });
    if (d.applied) location.reload();
  });
  // Each time the app opens it asks for the state, and for a check: the first visit's worker may not be answering this page yet.
  sw().register('sw.js', { scope: './' }).then(() => { post({ type: 'gsn-state' }); post({ type: 'gsn-check' }); }, e => console.error(e));
}
export const applyUpdate = () => post({ type: 'gsn-apply' });
export const checkUpdate = () => post({ type: 'gsn-check' });
export const setUpdateMode = m => post({ type: 'gsn-mode', mode: m });
export function useUpdate() {
  const [s, setS] = useState(st);
  useEffect(() => { told.add(setS); setS(st); return () => told.delete(setS); }, []);
  return { ...s, apply: applyUpdate, check: checkUpdate, setMode: setUpdateMode, installApp };
}
