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
// The sample's things to try (students/sample-try.js): its first class, and the downloads of its marked essay and its quiz. Ids only.
export async function sampleForShell() { return (await import('./students/sample-try.js')).sampleTry(); }
// Home: what the app worked out, the same as the current app's Today (src/today.js homeRender) for the same saved work. Today's
// classes and lessons (planning), the sets of papers to mark and to hand back (assignment and class names, counts), and the
// lessons still to plan in the next four days (src/todo.js "plan" lines, minus the ones the teacher hid or switched off).
// Missing work: the classes with students who owe work this term and haven't been reminded (src/todo.js tdMissLoad, its "miss" lines),
// through the gradebook's engine (students/book.js), less the lines she hid. Earlier work and what needs a look, by assignment name.
export async function countsForHome(now = Date.now()) { return (await import('./students/home-counts.js')).countsForHome(now); }
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
