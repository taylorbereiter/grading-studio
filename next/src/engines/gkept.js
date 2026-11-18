// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
let lib = { classes: [], loose: { units: [] } }, keptMeta = new Map();
export const useKept = (l, k) => { lib = l; keptMeta = k; };


// src/app/library.js
const holders = () => lib.classes.concat([lib.loose]);
// src/app/library.js
const findItem = id => { for (const c of holders()) for (const u of c.units) { const it = u.items.find(x => x.id === id); if (it) return { c, u, it }; } return null; };
// src/app/screens.js
function keptState(m) {
  const it = typeof cardOfKept === 'function' ? cardOfKept(m.id) : null, fm = !!it && it.type === 'fm';
  const of = Math.max(0, (m.n || 0) - (m.off || 0)), done = Math.min(of, (fm ? m.fb : m.scored) || 0), left = of - done, began = done || (!fm && m.partial);
  const back = !!keptBack(m), sent = back ? of : Math.min(of, m.sent || 0);
  return { of, done, left, fm, sent, word: fm ? 'feedback complete' : 'scored', pct: of ? Math.round(done / of * 100) : 0, label: !of ? '' : !left ? (back ? 'Returned' : 'Ready to return') : began ? (fm ? 'Giving feedback' : 'Scoring') : 'Not started', cls: !of ? '' : !left ? (back ? 'ret' : 'ok') : began ? 'on' : '' };
}
// src/app/screens.js
function keptBack(m) {
  if (m.back) return m.back;
  const of = Math.max(0, (m.n || 0) - (m.off || 0));
  return of && (m.sent || 0) >= of ? m.sentT || m.t : 0;
}
// src/app/kept.js
function cardOfKept(id) {
  const m = keptMeta.get(id), f = m && m.asg ? findItem(m.asg) : null;
  if (f) return f.it;
  for (const c of holders()) for (const u of c.units) { const it = u.items.find(x => x.batchId === id); if (it) return it; }
  return null;
}
// src/today.js
function homeGroups() {
  const mark = [], back = [], old = [];
  for (const m of [...keptMeta.values()].sort((a, b) => b.t - a.t)) {
    const st = keptState(m), it = cardOfKept(m.id);
    // an older copy, handed back already, or nothing in it to score
    if ((m.newer && keptMeta.has(m.newer)) || keptBack(m) || !st.of) old.push(m);
    // feedback only: it waits here until it is handed back
    else if (it && it.type === 'fm') mark.push(m);
    else if (st.left) mark.push(m);
    else back.push(m);
  }
  return { mark, back, old };
}
// src/shell.js
function classLeft(c) {
  let n = 0;
  for (const u of c.units) for (const it of u.items) { const m = it.batchId && it.type !== 'fm' ? keptMeta.get(it.batchId) : null; if (m) n += keptState(m).left; }
  return n;
}
export { keptState, keptBack, cardOfKept, homeGroups, classLeft };
