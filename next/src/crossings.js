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
// The strong examples, as the Planner lists them (src/planner/plexamples.js plxLoad): what each one is and how many pages, never
// whose it was, its work or its class, and never the watch list. Read only; a browser that never kept one gets [] and no database.
const EX_KINDS = { answer: 1, paper: 1, part: 1, shot: 1 };
export async function examplesForPlanning() {
  const ex = await students.exampleRecords();
  return ex.filter(r => r && !r.gone && !r.watch && EX_KINDS[r.kind] && Array.isArray(r.pages) && r.pages.length).map(r => ({
    id: String(r.id), t: +r.t || 0, kind: r.kind, title: String(r.title || ''), letter: String(r.letter || ''), q: r.q && r.q.lab ? String(r.q.lab) : '',
    why: String(r.why || ''), tags: Array.isArray(r.tags) ? r.tags.map(String) : [], pages: r.pages.length })).sort((a, b) => b.t - a.t);
}
// One page of a strong example (a JPEG, every cover painted in), to draw on a slide that refers to it (gsex:<id>|<page>). The
// picture stays in the examples database: the caller shows it and keeps nothing.
export async function examplePictureForSlide(id, page = 0) {
  const b = await students.examplePictures.get(String(id) + '|' + (+page || 0));
  return b instanceof Blob ? b : null;
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
// Missing work: the classes with students who owe work this term and haven't been reminded (src/todo.js tdMissLoad, its "miss" lines),
// through the gradebook's engine (students/book.js), less the lines she hid. Earlier work and what needs a look, by assignment name.
export async function countsForHome(now = Date.now()) {
  const C = await import('./students/counts.js'), T = await import('./planning/today.js');
  const lib = C.readLibrary(), kept = await C.readKept(), plan = await T.readPlan();
  const g = C.groups(lib, kept), where = m => { const w = C.whereOf(lib, kept, m.id); return w.cls ? String(w.cls.name || '') : ''; };
  const sets = list => list.map(m => { const st = C.stateOf(lib, kept, m); return { id: m.id, name: String(m.name || ''), cls: where(m), of: st.of, done: st.done, left: st.left, fm: st.fm, open: C.canOpen(m), t: m.t || 0 }; });
  let teach = null;
  // attendance under each class (src/attend.js attTodayLine): the grading class of that name with a roster, taken today or not, and
  // how many were late or away; numbers only. Nothing while attendance is switched off.
  const B = await import('./engines/gbook.js'), nk = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, ''), today = T.isoDay(now);
  const attFor = name => {
    if (lib.me && lib.me.att === false) return null;
    const k = nk(name), c = k && lib.classes.find(x => nk(x.name) === k && x.names.length); if (!c) return null;
    const r = B.attRec(c, today), o = r ? B.attDayCount(c, today) : null;
    return { classId: String(c.id), taken: !!r, l: o ? o.l : 0, a: o ? o.a : 0, e: o ? o.e : 0 };
  };
  if (plan) {
    const t = T.dayRows(plan, now), cur = T.nowRow(t.rows, now);
    teach = { off: t.off, rows: t.rows.map(r => ({ classId: r.c.id, name: r.c.name, color: r.c.color, start: r.m.start, end: r.m.end, now: r === cur,
      lesson: r.lessons[0] ? (l => { const got = l.taught.find(x => x.classId === String(r.c.id) && x.date === T.isoDay(now)) || null;
        // presents unless this class was taught it to the end today (src/today.js todayHtml row)
        return { id: l.id, title: l.title, n: l.n, ready: l.ready, done: l.done, got: got ? { slide: got.slide, of: got.of } : null, show: l.n > 0 && !(got && got.slide >= got.of) }; })(r.lessons[0]) : null,
      more: Math.max(0, r.lessons.length - 1), att: attFor(r.c.name) })) };
  }
  // the lines To do works out (students/todo.js autoLines), so Home, To do and the sidebar count the same
  const auto = await (await import('./students/todo-auto.js')).autoLines(now, { lib, kept, plan }), cname = id => String((lib.classes.find(c => String(c.id) === id) || {}).name || '');
  const toPlan = auto.filter(a => a.kind === 'plan').map(a => ({ in: a.in, key: a.key, classId: a.pid, className: a.pname, color: a.color, day: a.day, start: a.start, lesson: a.lesson }));
  // earlier work (src/today.js oldRow): an older copy, handed back already, or nothing in it to score
  const old = sets(g.old).map((x, i) => { const m = g.old[i]; return { ...x, back: C.backOf(m) || 0, stale: !!(m.newer && kept.has(m.newer)) }; });
  // needs a look (src/shell.js renderNeedsOnly): papers partly scored, papers not kept here; and when a second copy was last made
  const look = [];
  for (const m of [...kept.values()].sort((a, b) => b.t - a.t)) {
    if (m.partial && C.canOpen(m)) look.push({ kind: 'partial', id: m.id, name: String(m.name || ''), n: +m.partial || 0 });
    else if (!C.canOpen(m)) look.push({ kind: 'notkept', id: m.id, name: String(m.name || '') });
  }
  const backup = { last: +(students.lastBackup.json(0) || 0), kept: kept.size };
  // what the class needs next (src/today.js nextHtml): the newest finished rubric set's rows, as class averages
  const next = await (await import('./students/home-next.js')).nextCard(lib, kept, g, now).catch(e => { console.error(e); return null; });
  const mark = sets(g.mark), back = sets(g.back), missing = auto.filter(a => a.kind === 'miss').map(a => ({ classId: a.classId, name: cname(a.classId), n: a.n }));
  return { teach, mark, back, old, look, backup, next, toPlan, missing, counts: { classesToday: teach ? teach.rows.length : 0, mark: mark.length, back: back.length, toPlan: toPlan.length, missing: missing.length } };
}
// The sidebar's To do count, the way the current app counts it (src/todo.js todoCount): every line not done that is overdue or for
// today, her own lines and the ones the app noticed (papers to mark and to hand back, today's classes still to plan), less the ones
// she hid or moved to a later day, and the missing-work reminders (one for each class with students to remind).
export async function todoCountForSidebar(now = Date.now()) {
  return (await import('./students/todo-auto.js')).countDue(now);
}
// The School page's people (src/school.js nTodo): how many of her open to-do lines name each one. Person ids and counts only; the
// lines themselves stay on the grading side.
export function todoCountsForSchool() {
  const l = students.library.json(null), items = l && l.todo && Array.isArray(l.todo.items) ? l.todo.items : [], out = {};
  for (const it of items) if (it && it.id && !it.gone && !it.done && Array.isArray(it.ppl)) for (const id of new Set(it.ppl.map(String))) out[id] = (out[id] || 0) + 1;
  return out;
}
// To do: the lines the app adds from saved work (students/todo-auto.js), the same ones Home and the sidebar count. Assignment and
// class names, keys and numbers only: no student is named.
export async function appLinesForTodo(now = Date.now()) {
  return (await import('./students/todo-auto.js')).autoLines(now);
}
// The calendar's "Work due" and "To-dos": each assignment with a due date (its name, its class's name, the day) and the teacher's own
// to-do lines with a day. No student is in either. Shown, never stored by the calendar.
export function workForCalendar() {
  const l = students.library.json(null) || {};
  const due = [];
  for (const c of Array.isArray(l.classes) ? l.classes : []) for (const u of (c && Array.isArray(c.units) ? c.units : [])) for (const it of (u && Array.isArray(u.items) ? u.items : []))
    if (it && it.id && /^\d{4}-\d\d-\d\d/.test(it.due || '')) due.push({ id: it.id, name: String(it.name || ''), cls: String(c.name || ''), day: String(it.due).slice(0, 10), type: String(it.type || '') });
  const t = l.todo || {}, todos = (Array.isArray(t.items) ? t.items : []).filter(it => it && it.id && !it.gone && /^\d{4}-\d\d-\d\d$/.test(it.d || ''))
    .map(it => ({ id: it.id, text: String(it.x || ''), day: it.d, done: !!it.done, cls: (((l.classes || []).find(c => c && c.id === it.c)) || {}).name || '' }));
  return { due, todos };
}
// Home's Focus button (src/focus.js fcGoalHtml, the sidebar's Focus ring): today against her goal, and the session going on, if
// any, with its seconds. Numbers only.
export async function focusForHome() {
  const F = await import('./students/focus.js'); await F.focusRead();
  const E = F.engine, c = E.fcConf(), r = E.fcRun(), on = !!r && (r.st === 'run' || r.st === 'paused' || r.st === 'brk');
  return { goal: c.goal ? { n: E.fcGoalNow(c), of: c.goal.n } : null, run: on ? { st: r.st, secs: r.st === 'brk' ? E.fcLeft(r) : r.one ? E.fcElapsed(r) : E.fcLeft(r) } : null };
}
