// Undo for writes through the layer, by today's rules (services/undo.js keeps the one list Ctrl/Cmd+Z takes back from):
//   scoreChange   a student's score (src/app/paper.js gradeSnap / gradeBack): the whole score as it was; what comes back is a
//                 change made now, so its times (g.at, and g.atR for each row or points that differ) are now, and an older copy
//                 elsewhere can't win over it
//   fieldChange   anything else on a download (fieldSnap): one step, typing in one box joined into one
//   libraryChange the library (src/app/libundo.js libTrack): one step per save, saves a second apart joined up to three seconds;
//                 stamps and "last opened" times alone make no step; taking it back keeps what was deleted deleted (gone)
// libraryForget() is libUndoForget: the library came from somewhere else, so earlier steps would take that back too.
import * as undo from '../services/undo.js';
import { saveWork, saveLibrary } from './write.js';
import { library } from './index.js';

const copy = v => JSON.parse(JSON.stringify(v));
export async function scoreChange(id, key, label, change) {
  let before = null;
  const r = await saveWork(id, d => { const s = (d.s[key] ||= { f: {}, g: { rubric: [], points: '', comment: '' }, h: {} }); before = copy(s.g); change(s.g, d); });
  const putBack = async g0 => { let was = null; await saveWork(id, d => { const s = d.s[key]; was = copy(s.g); s.g = timed(was, copy(g0)); }); return was; };
  let other = null;
  undo.record({ label, undo: async () => { other = await putBack(before); }, redo: async () => { await putBack(other); } });
  return r;
}
function timed(was, g) {
  const t = Date.now(); g.at = t;
  for (let i = 0, n = Math.max((was.rubric || []).length, (g.rubric || []).length); i < n; i++) if ((was.rubric || [])[i] !== (g.rubric || [])[i]) (g.atR ||= {})[i] = t;
  if (was.points !== g.points) (g.atR ||= {}).points = t;
  return g;
}
export async function fieldChange(id, label, change, group) {
  let before = null, after = null;
  const r = await saveWork(id, d => { before = copy(d); change(d); after = copy(d); });
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(k => !['t', 's', 'v', 'sv', 'sat', 'pv'].includes(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  const put = from => saveWork(id, d => { for (const k of keys) { if (from[k] === undefined) delete d[k]; else d[k] = copy(from[k]); } });
  undo.record({ label, group: group ? id + ':' + group : undefined, undo: () => put(before), redo: () => put(after) });
  return r;
}
const SKIP = new Set(['v', 'at', 'fv', 'gone', 'opened']);
const sig = l => JSON.stringify(l, (k, v) => (SKIP.has(k) ? undefined : v));
let joinT = 0, joinT0 = 0;
// alone: a step of its own (a unit added, renamed, moved or deleted), never joined to the saves just before it
export async function libraryChange(label, change, alone) {
  const before = library.json(null);
  const after = await saveLibrary(change);
  if (!before || sig(before) === sig(after)) return after;
  const t = Date.now(), join = !alone && t - joinT < 1000 && t - joinT0 < 3000;
  if (!join) joinT0 = t;
  joinT = t;
  const put = to => saveLibrary(l => { const gone = l.gone; for (const k of Object.keys(l)) delete l[k]; Object.assign(l, copy(to)); if (gone) l.gone = { ...(to.gone || {}), ...gone }; });
  undo.record({ label, group: alone ? undefined : 'library:' + joinT0, undo: () => put(before), redo: () => put(after) });
  return after;
}
export const libraryForget = () => undo.forget();
