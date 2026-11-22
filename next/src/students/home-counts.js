// Home: what the app worked out (crossings.js countsForHome hands it on; loaded with Home, never with the first screen). Names, ids
// and counts only.
import * as B from '../engines/gbook.js';
import { lastBackup } from './index.js';

// Attendance under each of today's classes (src/attend.js attTodayLine): the grading class of that name with a roster, taken today
// or not, and how many were late or away. Nothing while attendance is switched off.
const nk = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const attFor_ = (lib, today) => name => {
  if (lib.me && lib.me.att === false) return null;
  const k = nk(name), c = k && lib.classes.find(x => nk(x.name) === k && x.names.length); if (!c) return null;
  const r = B.attRec(c, today), o = r ? B.attDayCount(c, today) : null;
  return { classId: String(c.id), taken: !!r, l: o ? o.l : 0, a: o ? o.a : 0, e: o ? o.e : 0 };
};
// Her own to-dos for the grading class of that name, not done and for today or before (src/todo.js todoClassNote).
const todoFor_ = (lib, today) => name => {
  const k = nk(name), c = k && lib.classes.find(x => nk(x.name) === k); if (!c) return null;
  const items = lib.todo && Array.isArray(lib.todo.items) ? lib.todo.items : [];
  const n = items.filter(it => it && it.id && !it.gone && !it.done && String(it.c) === String(c.id) && it.d && it.d <= today).length;
  return n ? { classId: String(c.id), n } : null;
};
// Earlier work (src/today.js oldRow): an older copy, handed back already, or nothing in it to score. Needs a look (src/shell.js
// renderNeedsOnly): papers partly scored, papers not kept here; and when a second copy was last made.
function lists(kept, g, C, oldSets) {
  const old = oldSets.map((x, i) => { const m = g.old[i]; return { ...x, back: C.backOf(m) || 0, stale: !!(m.newer && kept.has(m.newer)) }; });
  const look = [];
  for (const m of [...kept.values()].sort((a, b) => b.t - a.t)) {
    if (m.partial && C.canOpen(m)) look.push({ kind: 'partial', id: m.id, name: String(m.name || ''), n: +m.partial || 0 });
    else if (!C.canOpen(m)) look.push({ kind: 'notkept', id: m.id, name: String(m.name || '') });
  }
  return { old, look, backup: { last: +(lastBackup.json(0) || 0), kept: kept.size } };
}

export async function countsForHome(now = Date.now()) {
  const C = await import('./counts.js'), T = await import('../planning/today.js');
  const lib = C.readLibrary(), kept = await C.readKept(), plan = await T.readPlan();
  const g = C.groups(lib, kept), where = m => { const w = C.whereOf(lib, kept, m.id); return w.cls ? String(w.cls.name || '') : ''; };
  const sets = list => list.map(m => { const st = C.stateOf(lib, kept, m); return { id: m.id, name: String(m.name || ''), cls: where(m), of: st.of, done: st.done, left: st.left, fm: st.fm, open: C.canOpen(m), t: m.t || 0 }; });
  let teach = null;
  const attFor = attFor_(lib, T.isoDay(now)), todoFor = todoFor_(lib, T.isoDay(now));
  if (plan) {
    const t = T.dayRows(plan, now), cur = T.nowRow(t.rows, now);
    teach = { off: t.off, rows: t.rows.map(r => ({ classId: r.c.id, name: r.c.name, color: r.c.color, start: r.m.start, end: r.m.end, now: r === cur,
      lesson: r.lessons[0] ? (l => { const got = l.taught.find(x => x.classId === String(r.c.id) && x.date === T.isoDay(now)) || null;
        // presents unless this class was taught it to the end today (src/today.js todayHtml row)
        return { id: l.id, title: l.title, n: l.n, ready: l.ready, done: l.done, got: got ? { slide: got.slide, of: got.of } : null, show: l.n > 0 && !(got && got.slide >= got.of) }; })(r.lessons[0]) : null,
      more: Math.max(0, r.lessons.length - 1), att: attFor(r.c.name), todo: todoFor(r.c.name) })) };
  }
  // the lines To do works out (students/todo.js autoLines), so Home, To do and the sidebar count the same
  const auto = await (await import('./todo-auto.js')).autoLines(now, { lib, kept, plan }), cname = id => String((lib.classes.find(c => String(c.id) === id) || {}).name || '');
  const toPlan = auto.filter(a => a.kind === 'plan').map(a => ({ in: a.in, key: a.key, classId: a.pid, className: a.pname, color: a.color, day: a.day, start: a.start, lesson: a.lesson }));
  const { old, look, backup } = lists(kept, g, C, sets(g.old));
  // what the class needs next (src/today.js nextHtml): the newest finished rubric set's rows, as class averages
  const next = await (await import('./home-next.js')).nextCard(lib, kept, g, now).catch(e => { console.error(e); return null; });
  const mark = sets(g.mark), back = sets(g.back), missing = auto.filter(a => a.kind === 'miss').map(a => ({ classId: a.classId, name: cname(a.classId), n: a.n }));
  // a sample class from before 11/13, beside her own (src/welcome.js hasSample, sampleNoteRender): its card on Home
  const os = lib.classes.find(c => c.sample), oldSample = os ? { id: String(os.id), asked: !lib.me || !!lib.me.hi } : null;
  return { teach, mark, back, old, look, backup, next, toPlan, missing, oldSample, counts: { classesToday: teach ? teach.rows.length : 0, mark: mark.length, back: back.length, toPlan: toPlan.length, missing: missing.length } };
}
