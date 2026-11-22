// Go back in time, one assignment at a time (src/safe.js gbLook, gbRestoreOne): a dated copy (a snapshot in the linked folder, or
// one of this browser's safety copies) is read, and each assignment in it that is still kept here is compared with how it is now:
// how many were scored then and now, how many students' work differs, and whether its setup does. One of them is put back on its
// own through the grading side's write (students/write.js restoreWork), after how things are now is kept first (in the folder when
// there is one, else as a safety copy), and Undo puts it back as it was. Papers never change.
import { snapshot, readCopy } from './safety.js';
import { F, folderRun } from './folder.js';
import { meta, newestWork, library } from '../students/index.js';
import { restoreWork } from '../students/write.js';

let got = null;   // the copy last looked at: { key, work, edits }
const newer = (a, b) => (!a ? b || null : !b ? a : (b.t || 0) > (a.t || 0) ? b : a);
async function read(m) {
  if (m.src === 'f') { const R = await folderRun(); return R.snapRead(m.name); }
  const rec = await readCopy(m.id), work = {}, edits = {};
  if (!rec) throw new Error('That safety copy is gone');
  const w = rec.stores['grading-studio-keep/work'] || { k: [], v: [] }, ed = rec.stores['grading-studio-keep/edits'] || { k: [], v: [] };
  w.k.forEach((id, i) => { work[id] = w.v[i]; });
  for (const [k, v] of Object.entries(rec.ls || {})) if (k.startsWith('gs.b.')) { let d = null; try { d = JSON.parse(v); } catch { } if (d) work[k] = newer(work[k], d); }
  ed.k.forEach((k, i) => { const at = String(k).indexOf('|'), r = ed.v[i]; (edits[k.slice(0, at)] ||= {})[k.slice(at + 1)] = { t: r.t || 1, data: async () => r.data, orig: async () => r.orig || null }; });
  return { work, edits };
}
// The assignment's name on its card, else the download's (src/safe.js gbName).
function nameOf(id, m) {
  const l = library.json(null) || {};
  for (const c of [...(l.classes || []), l.loose || { units: [] }]) for (const u of (c && c.units) || []) for (const it of (u && u.items) || []) if (it && it.batchId === id) return String(it.name || '');
  return String((m && m.name) || '');
}
// m: { src: 'f', name } or { src: 'b', id }. Rows with something different come first, then the newest.
export async function look(m) {
  const M = await import('../engines/merge.js'), copy = await read(m), rows = [];
  for (const [id, then] of Object.entries(copy.work)) {
    const k = await meta.get(id); if (!k || !then) continue;   // forgotten since, or never here: nothing to put it back onto
    const now = await newestWork(id), a = M.revsOf(then), b = M.revsOf(now || { s: {} });
    let n = 0; for (const s of new Set([...Object.keys(a.s), ...Object.keys(b.s)])) if (((a.s[s] || {}).h || '') !== ((b.s[s] || {}).h || '')) n++;
    rows.push({ id, name: nameOf(id, k), students: n, set: a.set !== b.set, then: M.workCounts(then).scored, now: now ? M.workCounts(now).scored : 0, of: Math.max(0, (k.n || 0) - (k.off || 0)), t: k.t || 0 });
  }
  got = { key: m.src + ':' + (m.name || m.id), ...copy };
  return rows.sort((x, y) => (y.students || y.set ? 1 : 0) - (x.students || x.set ? 1 : 0) || y.t - x.t);
}
// Puts one assignment back as it was in the copy last looked at. Returns the Undo.
export async function restoreOne(m, id) {
  if (!got || got.key !== m.src + ':' + (m.name || m.id)) await look(m);
  const want = got.work[id]; if (!want) throw new Error('Not in that copy');
  const R = F.state !== 'none' ? await folderRun() : null;
  if (R && R.snapOn()) await R.folderSnapshot('Before restoring an assignment');
  else await snapshot('Before restoring an assignment to an earlier day');
  const was = await restoreWork(id, want, got.edits[id] || {});
  return async () => { if (was.cur) await restoreWork(id, was.cur, was.had); };
}
