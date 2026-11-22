// Undo and redo of a list or map that other routes also change (a sync, My setup, another tab): the step is applied as an edit to what
// is stored now, not as a copy put back, so whatever arrived in between stays (audit H-012). from is what the step changed, to is
// what it should go back to (undo: from = after, to = before; redo the other way round).
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// key names an item (a comment is its own key, a rubric its id). first: items that arrived since go first (newest-first lists).
export function rebaseList(cur, from, to, { key = x => x, first = false } = {}) {
  cur = Array.isArray(cur) ? cur : []; from = Array.isArray(from) ? from : []; to = Array.isArray(to) ? to : [];
  const F = new Map(from.map(x => [key(x), x])), T = new Set(to.map(key)), C = new Map(cur.map(x => [key(x), x]));
  const arrived = cur.filter(x => !F.has(key(x)) && !T.has(key(x))), out = [];
  for (const x of to) {
    const k = key(x);
    if (!F.has(k)) { if (!out.some(y => key(y) === k)) out.push(x); continue; }   // the step took it away: it comes back
    if (!C.has(k)) continue;                                                    // taken away since, somewhere else: stays away
    out.push(same(C.get(k), F.get(k)) ? x : C.get(k));                          // changed since: the newer wording stays
  }
  return first ? arrived.concat(out) : out.concat(arrived);
}
export function rebaseMap(cur, from, to) {
  cur = cur && typeof cur === 'object' ? cur : {}; from = from && typeof from === 'object' ? from : {}; to = to && typeof to === 'object' ? to : {};
  const out = { ...cur };
  for (const k of Object.keys(from)) if (!(k in to) && same(cur[k], from[k])) delete out[k];
  for (const k of Object.keys(to)) if (!(k in from) || (!same(from[k], to[k]) && same(cur[k], from[k]))) out[k] = to[k];
  return out;
}
