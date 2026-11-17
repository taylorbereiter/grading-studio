// The only module that may import both sides. Each crossing is a named, read-only function that hands the planning side what it
// needs from the grading side, and no more. Today's crossings, in the current app (next/docs/saved-work.md lists every one):
// - the Planner's classes (gs-lessons kv "setup") are written by the grading page too (setup import, sync, take-home, new year)
// - the Planner reads the strong examples database (src/planner/plexamples.js)
// - Present shows roster names without storing them
// - attendance lives on the student side
import * as students from './students/index.js';
import * as planning from './planning/index.js';

// Classes with their names and periods, without the students in them.
export async function classListsForPlanning() {
  const s = await planning.setupRecord.get();
  return ((s && s.classes) || []).map(c => { const { names: _n, students: _s, ...rest } = c; return rest; });
}
// The strong examples, as the Planner shows them: what they are and their pictures. Read only.
export async function examplesForPlanning() {
  const ex = (await students.examples.entries()).filter(([k]) => !String(k).startsWith('watch:')).map(([, v]) => v);
  return ex;
}
// The names on each class's roster, to show while presenting (pick a name, groups), as the Planner reads them today from gs.rolls
// (src/pickshare.js pkRolls, written by the grading page's src/seating.js rollsShare). Shown, never stored by the caller.
export function rosterNamesForPresent() {
  const r = students.pickerRolls.json([]);
  return Array.isArray(r) ? r.filter(x => Array.isArray(x) && typeof x[0] === 'string' && Array.isArray(x[1])).map(([name, names]) => ({ name, names: names.filter(n => typeof n === 'string') })) : [];
}

// Home and the sidebar (stage 2): the classes in the current app's order, each with its papers left to score. Class names and
// numbers only: no student is named.
export async function classesForHome() {
  const { readLibrary, readKept, sidebarClasses } = await import('./students/counts.js');
  return sidebarClasses(readLibrary(), await readKept());
}
// Home: what the app worked out, the same as the current app's Today (src/today.js homeRender) for the same saved work. Today's
// classes and lessons (planning), the sets of papers to mark and to hand back (assignment and class names, counts), and the
// lessons still to plan in the next four days (src/todo.js "plan" lines, minus the ones the teacher hid or switched off).
// Missing work is not worked out yet: it needs the gradebook's engine, which comes with the class pages (null until then).
export async function countsForHome(now = Date.now()) {
  const C = await import('./students/counts.js'), T = await import('./planning/today.js');
  const lib = C.readLibrary(), kept = await C.readKept(), plan = await T.readPlan();
  const g = C.groups(lib, kept), where = m => { const w = C.whereOf(lib, kept, m.id); return w.cls ? String(w.cls.name || '') : ''; };
  const sets = list => list.map(m => { const st = C.stateOf(lib, kept, m); return { id: m.id, name: String(m.name || ''), cls: where(m), of: st.of, done: st.done, left: st.left, fm: st.fm, open: C.canOpen(m), t: m.t || 0 }; });
  let teach = null;
  if (plan) {
    const t = T.dayRows(plan, now), cur = T.nowRow(t.rows, now);
    teach = { off: t.off, rows: t.rows.map(r => ({ classId: r.c.id, name: r.c.name, color: r.c.color, start: r.m.start, end: r.m.end, now: r === cur,
      lesson: r.lessons[0] ? { id: r.lessons[0].id, title: r.lessons[0].title, n: r.lessons[0].n, ready: r.lessons[0].ready, done: r.lessons[0].done } : null, more: Math.max(0, r.lessons.length - 1) })) };
  }
  const ch = C.todoChoices(lib);
  const toPlan = ch.off.plan ? [] : T.toPlan(plan, now).filter(x => { const a = ch.auto[x.key] || {}; return !(a.h != null && a.h === (x.lesson ? 'w' : 'x')); });
  const mark = sets(g.mark), back = sets(g.back);
  return { teach, mark, back, toPlan, missing: null, counts: { classesToday: teach ? teach.rows.length : 0, mark: mark.length, back: back.length, toPlan: toPlan.length } };
}
