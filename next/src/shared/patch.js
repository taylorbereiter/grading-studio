// What one step changed, as a patch that can be put on the record as it is now (students/undo.js libraryChange, planning/school.js).
// The step as a patch: each place that differs between from and to, with what it should become. Lists of things with ids
// (classes, units, cards) are matched by id, so a card added, moved or changed elsewhere since keeps its place and its change.
// top: keys at the top left to the save (for the library, its deleted list and save counter: what was deleted stays deleted).
const copy = v => JSON.parse(JSON.stringify(v));
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const idList = (a, b) => [a, b].every(x => Array.isArray(x) && x.every(e => obj(e) && e.id != null)) && (a.length || b.length) && [a, b].every(x => new Set(x.map(e => e.id)).size === x.length);
export function patch(from, to, top = [], path = [], out = []) {
  if (JSON.stringify(from) === JSON.stringify(to)) return out;
  if (obj(from) && obj(to)) {
    for (const k of new Set([...Object.keys(from), ...Object.keys(to)])) if (!(path.length === 0 && top.includes(k))) patch(from[k], to[k], top, path.concat(k), out);
  } else if (idList(from, to)) {
    const was = from.map(e => e.id), now = to.map(e => e.id), common = now.filter(id => was.includes(id));
    out.push({ p: path, list: { add: to.filter(e => !was.includes(e.id)).map(e => [now.indexOf(e.id), copy(e)]), drop: was.filter(id => !now.includes(id)), order: common.join('\n') !== was.filter(id => now.includes(id)).join('\n') ? now : null } });
    for (const e of to) { const f = from.find(x => x.id === e.id); if (f) patch(f, e, top, path.concat({ id: e.id }), out); }
  } else out.push({ p: path, v: to === undefined ? undefined : copy(to) });
  return out;
}
const step = (o, k) => (o == null ? undefined : typeof k === 'object' ? (Array.isArray(o) ? o.find(e => e && e.id === k.id) : undefined) : o[k]);
export function apply(l, ops) {
  for (const op of ops) {
    const at = op.p.slice(0, -1).reduce(step, l), k = op.p[op.p.length - 1];
    if (op.list) {
      let arr = op.p.length ? step(at, k) : l;
      if (!Array.isArray(arr)) { if (at == null || typeof k === 'object') continue; arr = at[k] = []; }
      for (const id of op.list.drop) { const i = arr.findIndex(e => e && e.id === id); if (i >= 0) arr.splice(i, 1); }
      for (const [i, e] of op.list.add) if (!arr.some(x => x && x.id === e.id)) arr.splice(Math.min(i, arr.length), 0, copy(e));
      if (op.list.order) { const rank = id => { const i = op.list.order.indexOf(id); return i < 0 ? op.list.order.length : i; }; const s = arr.map((e, i) => [e, i]).sort((a, b) => rank(a[0].id) - rank(b[0].id) || a[1] - b[1]).map(x => x[0]); arr.splice(0, arr.length, ...s); }
    } else {
      if (at == null || typeof at !== 'object' || typeof k === 'object') continue;
      if (op.v === undefined) delete at[k]; else at[k] = copy(op.v);
    }
  }
}
