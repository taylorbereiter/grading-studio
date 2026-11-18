// The lines To do adds from saved work (src/todo.js todoAuto), worked out each time and never stored, and the sidebar's count. One
// source for the To do screen, the sidebar and Home (crossings.js appLinesForTodo, todoCountForSidebar, countsForHome).
import * as C from './counts.js';
import { readPlan, toPlan, isoDay } from '../planning/today.js';

// The lines the app adds from saved work (src/todo.js todoAuto), each with its key, the signature that hides it (a line hidden at one
// signature comes back when the work changes), and the day it shows on (a later day she moved it to, else its own, never before
// today). Kinds she switched off are left out. classId is the grading class (a timetable class is matched to one by name, as
// src/todo.js tdGradeClass does).
export async function autoLines(now = Date.now(), had = {}) {
  const lib = had.lib || C.readLibrary(), kept = had.kept || await C.readKept(), plan = had.plan !== undefined ? had.plan : await readPlan();
  const today = isoDay(now), ch = C.todoChoices(lib), out = [];
  const add = (kind, key, day, sig, o) => {
    const a = ch.auto[key] || {}; if (a.h != null && a.h === sig) return;
    out.push({ auto: true, id: 'auto:' + key, key, kind, sig, d: a.d && a.d > day && a.d > today ? a.d : day < today ? today : day, ...o });
  };
  const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''), gradeOf = name => lib.classes.find(c => key(c.name) === key(name)) || null;
  const g = C.groups(lib, kept);
  if (!ch.off.mark) for (const m of g.mark) {
    if (!C.canOpen(m)) continue;
    const st = C.stateOf(lib, kept, m), w = C.whereOf(lib, kept, m.id);
    add('mark', 'mark:' + m.id, today, 'x', { open: m.id, name: String(m.name || ''), classId: w.cls ? String(w.cls.id) : '', fm: !!(w.it && w.it.type === 'fm'), began: !!(st.done || m.partial), left: st.left, of: st.of, done: st.done });
  }
  if (!ch.off.back) for (const m of g.back) {
    if (!C.canOpen(m)) continue;
    const st = C.stateOf(lib, kept, m), w = C.whereOf(lib, kept, m.id);
    add('back', 'back:' + m.id, today, 'x', { open: m.id, name: String(m.name || ''), classId: w.cls ? String(w.cls.id) : '', of: st.of });
  }
  if (!ch.off.plan) for (const p of toPlan(plan, now)) {
    const gc = gradeOf(p.className);
    add('plan', p.key, p.day, p.lesson ? 'w' : 'x', { in: p.in, pid: p.classId, pname: p.className, color: p.color, classId: gc ? String(gc.id) : '', start: p.start, lesson: p.lesson, day: p.day });
  }
  if (!ch.off.miss) {
    const by = await (await import('./book.js')).missingByClass();
    for (const c of lib.classes) if (by[c.id]) add('miss', 'miss:' + c.id, today, by[c.id], { classId: String(c.id), n: by[c.id] });
  }
  return out;
}
// The sidebar's count (src/todo.js todoCount): every line not done that is overdue or for today.
export async function countDue(now = Date.now()) {
  const lib = C.readLibrary(), today = isoDay(now), items = Array.isArray(lib.todo.items) ? lib.todo.items : [];
  const own = items.filter(it => it && it.id && !it.gone && !it.done && it.d && it.d <= today).length;
  return own + (await autoLines(now, { lib })).filter(r => r.d <= today).length;
}

