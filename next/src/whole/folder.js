// The linked folder (Settings, Saving and sync: "Choose a folder…"), kept the way the current app keeps it (src/folder.js): every
// save goes to this browser and to a folder she picked once. This part loads with the app and stays small: what travels with the
// work, the folder's state, and handing each save to the folder's own part (whole/folder-run.js), which loads only once a folder is
// linked. The folder's layout and every step are in that file.
import { folderHandle } from '../shared/device.js';

// What travels with the work, and what belongs to this browser (src/folder.js LS_LOCAL, kept the same; a test compares them).
export const LS_LOCAL = /^gs\.(b\..+|batches|syncT|syncAt|cloudP|planCopy|planSeen|planBig|phone|phCls|dataV|lastBackup|gcid|gEmail|tomb|rolls|setupUndo|focusRun|wlCodes|refOpen\..*)$/;
export function carryLs() {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('gs.') && !LS_LOCAL.test(k)) o[k] = localStorage.getItem(k); }
  return o;
}
// state: none (no folder), saving, ok, ask (a click to reconnect), lost (can't reach it), decide (two versions to choose between)
export const F = { state: 'none', booted: false, name: '', mod: null };   // mod: folder-run.js, once loaded
const told = new Set();
export const folderState = () => F.state;
export function onFolder(f) { told.add(f); return () => told.delete(f); }
export function setFolder(s) { if (s) F.state = s; told.forEach(f => { try { f(F.state); } catch (e) { console.error(e); } }); }
let R = null;
export const folderRun = () => R || (R = import('./folder-run.js').then(m => (F.mod = m)));
// At start: a folder linked here before (the current app's or this app's) is brought level with this browser.
export async function folderBoot() {
  let h = null; try { h = await folderHandle.get('dir'); } catch (e) { console.error(e); }
  F.booted = true;
  if (!h || (window.__gsSample && window.__gsSample.on)) return setFolder('none');
  F.name = h.name; F.state = 'ask';
  (await folderRun()).boot(h);
}
// After a save through the layer (shared/saved.js).
export function folderSaved(e) { if (F.state === 'none' || e.from === 'folder') return; return folderRun().then(m => m.saved(e)); }
