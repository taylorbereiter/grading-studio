// Home's lists from the grading side, for crossings.js countsForHome (loaded with it, never with the first screen). Names, ids and
// counts only.
import * as B from '../engines/gbook.js';
import { lastBackup } from './index.js';

// Attendance under each of today's classes (src/attend.js attTodayLine): the grading class of that name with a roster, taken today
// or not, and how many were late or away. Nothing while attendance is switched off.
const nk = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const attFor = (lib, today) => name => {
  if (lib.me && lib.me.att === false) return null;
  const k = nk(name), c = k && lib.classes.find(x => nk(x.name) === k && x.names.length); if (!c) return null;
  const r = B.attRec(c, today), o = r ? B.attDayCount(c, today) : null;
  return { classId: String(c.id), taken: !!r, l: o ? o.l : 0, a: o ? o.a : 0, e: o ? o.e : 0 };
};
// Earlier work (src/today.js oldRow): an older copy, handed back already, or nothing in it to score. Needs a look (src/shell.js
// renderNeedsOnly): papers partly scored, papers not kept here; and when a second copy was last made.
export function lists(kept, g, C, oldSets) {
  const old = oldSets.map((x, i) => { const m = g.old[i]; return { ...x, back: C.backOf(m) || 0, stale: !!(m.newer && kept.has(m.newer)) }; });
  const look = [];
  for (const m of [...kept.values()].sort((a, b) => b.t - a.t)) {
    if (m.partial && C.canOpen(m)) look.push({ kind: 'partial', id: m.id, name: String(m.name || ''), n: +m.partial || 0 });
    else if (!C.canOpen(m)) look.push({ kind: 'notkept', id: m.id, name: String(m.name || '') });
  }
  return { old, look, backup: { last: +(lastBackup.json(0) || 0), kept: kept.size } };
}
