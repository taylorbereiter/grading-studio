// The Drive sync file (src/app/drive.js syncOnce), as this browser would send it when nothing new has come from Drive: the
// library, every download's work and its row (without where its papers are kept on this device), the tombstones, the settings
// that travel, the timetable, planning time and after-class notes. A save through the layer marks the sync as due, the way the
// current app's store.set does (syncSoon).
//
// Sending it, and taking in what comes from Drive (merging, rows 18 and 30 of the cross-store list), comes before the switch
// (stage 6): until then the current app syncs as soon as it is opened, so nothing is lost, only later.
// planT (the Planner's own file) and files (papers kept in Drive) are Drive's answers, so they are passed in, not made here.
import { work, meta, quick, library, deleted } from '../students/index.js';
import { setupRecord, planTime, taughtIn } from '../planning/index.js';
import { carryLs } from './folder.js';

const newest = (a, b) => !a ? b || null : !b ? a : (b.t || 0) > (a.t || 0) ? b : a;
export async function syncPayload({ now = Date.now(), planT = null, files = {}, got = null } = {}) {
  const M = await import('../engines/merge.js');
  const tomb = deleted.json({}) || {}, A = { work: {}, meta: {} };
  for (const id of quick.ids()) { const d = quick.json(id, null); if (d) A.work['gs.b.' + id] = d; }
  for (const [k, v] of await work.entries()) A.work[k] = newest(A.work[k], v);
  for (const [k, v] of await meta.entries()) A.meta[k] = v;
  const out = { app: 'Grading Studio sync', v: 1, t: now, lib: library.json(null), work: {}, meta: {}, tomb, ls: carryLs() };
  for (const id of new Set([...Object.keys(A.work), ...Object.keys(A.meta)])) {
    if (tomb[id]) continue;
    if (A.work[id]) out.work[id] = A.work[id];
    if (A.meta[id]) { const { papers, size, ...rest } = A.meta[id]; out.meta[id] = rest; }
  }
  delete out.ls['gs.lib'];
  if (out.ls['gs.focus']) try { out.ls['gs.focus'] = JSON.stringify(M.focusShared(JSON.parse(out.ls['gs.focus']))); } catch {}
  const su = await setupRecord.get().catch(() => null);
  out.plan = su && Array.isArray(su.classes) && su.classes.length ? { classes: su.classes.map(c => ({ id: c.id, name: c.name, color: c.color, meets: c.meets })), semStart: su.semStart || '', semEnd: su.semEnd || '', daysOff: su.daysOff || [] } : (got && got.plan) || null;
  out.planT = planT;
  out.files = { ...files }; for (const id of Object.keys(out.files)) if (tomb[id]) delete out.files[id];
  const pt = planTime.json(null); if (pt && typeof pt === 'object') out.pt = pt;
  const tn = M.taughtInMerge(taughtIn.json(null), null).out; if (Object.keys(tn.items).length) out.tn = tn;
  return out;
}
