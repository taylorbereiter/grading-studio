// The linked folder (Settings, Saving and sync: "Save to computer"), kept the way the current app keeps it (src/folder.js): the
// library and tombstones after a library save, a download's work.json and info.json after a save of its marks. JSON goes to
// name.new first, then name, and the .new is removed last, so a half-written file is never the only copy.
//
// The new app only keeps up a folder the current app has already set up and brought level with this browser. It writes a
// download's work.json only when the folder's copy is the one this browser had just before the save (so nothing another computer
// put there is written over); anything else, or a folder that needs asking for permission again, leaves the folder "behind", and
// the current app's next open brings it level by merging (src/folder.js folderReconcile). Papers and other bytes, daily snapshots
// and the papers mirror are not written yet: they come with the screens that bring papers in (stage 4).
import { folderHandle } from '../shared/device.js';
import { meta, deleted } from '../students/index.js';

const SUB = 'Grading Studio';
// What travels with the work, and what belongs to this browser (src/folder.js LS_LOCAL, kept the same; a test compares them).
export const LS_LOCAL = /^gs\.(b\..+|batches|syncT|syncAt|cloudP|planCopy|planSeen|planBig|phone|phCls|dataV|lastBackup|gcid|gEmail|tomb|rolls|setupUndo|focusRun|wlCodes|refOpen\..*)$/;
export function carryLs() {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('gs.') && !LS_LOCAL.test(k)) o[k] = localStorage.getItem(k); }
  return o;
}
let state = 'none';
const told = new Set();
const set = s => { if (s !== state) { state = s; told.forEach(f => f(s)); } };
export const folderState = () => state;
export function onFolder(f) { told.add(f); return () => told.delete(f); }

async function writeBytes(dir, name, data) { const fh = await dir.getFileHandle(name, { create: true }), w = await fh.createWritable(); try { await w.write(data); await w.close(); } catch (e) { try { await w.abort(); } catch {} throw e; } return fh; }
export async function writeJson(dir, name, obj) {
  const t = JSON.stringify(obj);
  await writeBytes(dir, name + '.new', t);
  const fh = await writeBytes(dir, name, t);
  await dir.removeEntry(name + '.new').catch(() => {});
  return fh;
}
async function readJson(dir, name) {
  for (const n of [name + '.new', name]) {
    let t; try { t = await (await (await dir.getFileHandle(n)).getFile()).text(); } catch (e) { if (e.name === 'NotFoundError') continue; throw e; }
    try { return JSON.parse(t); } catch { continue; }
  }
  return null;
}
// The folder's data directory, or null (none linked, permission to ask for again, or never set up by the current app).
export async function folderRoot() {
  if (window.__gsSample && window.__gsSample.on) { set('none'); return null; }
  const h = await folderHandle.get('dir').catch(() => null);
  if (!h) { set('none'); return null; }
  let p = 'lost'; try { p = await h.queryPermission({ mode: 'readwrite' }); } catch {}
  if (p !== 'granted') { set('ask'); return null; }
  const has = async d => { try { await d.getFileHandle('gs-folder.json'); return true; } catch { return false; } };
  let root = h;
  if (!(await has(h)) && h.name !== SUB) { try { root = await h.getDirectoryHandle(SUB); } catch { set('behind'); return null; } }
  if (!(await has(root))) { set('behind'); return null; }
  return root;
}
export async function pushLibrary(root) {
  await writeJson(root, 'library.json', { t: Date.now(), ls: carryLs() });
  await writeJson(root, 'tombstones.json', deleted.json({}) || {});
}
// A download's marks and scores, and the row in its info.json. before: the work as stored just before this save.
export async function pushWork(root, id, data, before) {
  let dir; try { dir = await (await root.getDirectoryHandle('downloads')).getDirectoryHandle(encodeURIComponent(id)); } catch { return false; }
  const info = await readJson(dir, 'info.json'), there = await readJson(dir, 'work.json');
  if (!info || !info.papers || !there || JSON.stringify(there) !== JSON.stringify(before)) return false;
  const was = JSON.stringify(info), m = await meta.get(id); if (m) info.meta = m;
  if (JSON.stringify(info) !== was) await writeJson(dir, 'info.json', info);
  await writeJson(dir, 'work.json', data);
  return true;
}
// After a save through the layer. Returns the folder's state.
export async function folderSaved(e) {
  const root = await folderRoot(); if (!root) return state;
  try {
    if (e.kind === 'work') { if (!(await pushWork(root, e.id, e.data, e.before))) { set('behind'); return state; } }
    else if (e.kind === 'library' || e.kind === 'setting' || (e.kind === 'pref' && e.id === 'gs.school')) await pushLibrary(root);
    else return state;
    set('ok');
  } catch (err) { console.error(err); set('behind'); }
  return state;
}
