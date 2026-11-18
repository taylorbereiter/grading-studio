// A merge's rows put into this browser, the way the current app puts them (src/folder.js localState, addedDates, applyRow): the same
// reading of the browser's copy, the same order of writes. Only the writes go through the grading side's own functions
// (students/write.js take*), so every window hears of them and the copy they came from isn't sent them again as news.
import { work, meta, edits, added, quick, deleted, papers } from '../students/index.js';
import { takeWork, takeMeta, takePapers, takeAdded, takeEdit, takeTombs, dropDownload } from '../students/write.js';

const newer = (a, b) => !a ? b || null : !b ? a : (b.t || 0) > (a.t || 0) ? b : a;
export const tombs = () => deleted.json({}) || {};
// Everything about the browser's copy except the bytes.
export async function localState() {
  const A = { work: {}, meta: {}, tomb: tombs(), added: {}, edits: {} };
  for (const id of quick.ids()) { const d = quick.json(id, null); if (d) A.work['gs.b.' + id] = d; }
  for (const [k, v] of await work.entries()) A.work[k] = newer(A.work[k], v);
  for (const [k, v] of await meta.entries()) A.meta[k] = v;
  for (const [k, v] of await edits.entries()) { const i = k.indexOf('|'); (A.edits[k.slice(0, i)] ||= {})[k.slice(i + 1)] = (v && v.t) || 1; }
  let keys = []; try { keys = await added.keys(); } catch {}
  for (const k of keys) { const i = k.indexOf('|'); (A.added[k.slice(0, i)] ||= {})[k.slice(i + 1)] = 0; }
  return A;
}
// A late file's own date matters only when the other copy says it was taken off, or has one with the same name.
export async function addedDates(A, B) {
  for (const [id, have] of Object.entries(A.added)) {
    const gone = (B.work[id] && B.work[id].gone) || {}, there = (B.added && B.added[id]) || {};
    for (const k of Object.keys(have)) if (k in gone || k in there) { const r = await added.get(id + '|' + k); have[k] = (r && r.added) || 0; }
  }
}
// One download's row of a merge. src gives the bytes: papers(id), added(id, k), edit(id, path). hold: the marking screen's note of
// the download open there ({ id, seen }), so it knows a write was its own window's.
export async function applyRow(row, src, from, hold) {
  const { id } = row;
  if (row.kind === 'gone') { if (row.onA) { const tb = tombs(); tb[id] ||= { t: row.t, name: row.name, v: {} }; takeTombs(tb, from); await dropDownload(id, from); } return; }
  if (row.kind === 'askGone' || row.kind === 'onlyA' && !row.toA) return;
  let m = row.meta;
  if (!(row.ma && row.ma.papers)) {
    const rec = await src.papers(id);
    if (rec) { await takePapers(id, rec, from); m = { ...m, papers: true, size: rec.entries.reduce((a, e) => a + (e.data ? e.data.length : 0), 0) }; }
    else if (row.meta) m = { ...m, papers: false };
  }
  for (const k of row.files.fromB) { const rec = await src.added(id, k); if (rec) await takeAdded(id + '|' + k, rec, from); }
  for (const k of row.files.dropA) await takeAdded(id + '|' + k, null, from);
  for (const p of row.edits.fromB) { const rec = await src.edit(id, p); if (rec) await takeEdit(id + '|' + p, rec, from); }
  for (const p of row.edits.dropA) await takeEdit(id + '|' + p, null, from);
  if (row.work && row.toA) { const v = await takeWork(id, row.work, from); if (hold && hold.id === id) hold.seen = v; }
  if (m && JSON.stringify(m) !== JSON.stringify(row.ma)) await takeMeta(id, m, from);
}
// One kept paper's bytes: whole, or put together from its pieces (a big download, "id|file|piece").
export async function keptBytes(id, i, e) {
  if (e.parts == null) return e.data || null;
  const out = new Uint8Array(e.size);
  for (let n = 0, at = 0; n < e.parts; n++) { const part = await papers.get(id + '|' + i + '|' + n); if (!part) throw new Error('A piece of a kept file is missing'); out.set(part, at); at += part.length; }
  return out;
}
