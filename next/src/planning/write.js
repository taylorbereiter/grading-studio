// The planning side's writes: one function per kind of record, each doing what the current app does when it saves it. Rows of
// the cross-store list (next/docs/saved-work.md, "Where the two pages touch") that were one page writing the other's storage are
// calls to these now, whoever calls (next/docs/parts/wall.md has the table).
//
//   saveLesson(lesson)        a lesson (src/planner/lessons.js lTx), then tells the windows that read lessons (gs-plan-out)
//   saveKv(name, value)       a gs-lessons kv record: setup (row 8), units, bank (row 3; also tells gs-bank), activities, words, deflook
//   savePref(key, value)      a teacher-wide setting: gs.look, gs.theme (38), gs.lang, gs.words, gs.mailApp, gs.mblinks (41), gs.school
//   addPlanTime(r, secs)      planning time on a lesson (22; src/planner/plfocus.js pfPlanAdd)
//   saveTaughtNote(key, note) an after-class note (29). MAY HOLD NAMES: never sent to an assistant unless the teacher puts it in
//   startNewYear(v)           tells the Planner a new year is under way (32)
//   setGoogleToken(v)         the Google sign-in token for this window (49; sessionStorage, as the current app keeps it)
//   deleteLesson(lesson)      a lesson removed (src/planner/lessons.js lDelete), and its file in the Planner folder
//   saveVersion(lesson, label) the lesson as it is, kept under its Versions (kv ver:<id>; src/planner/review.js saveVersion)
//   saveLessonFile(blob)      a file kept with a lesson, as its Materials (kv file:<id>; src/planner/finished.js lessonZip); returns the id
// A lesson written while a Planner folder is linked also goes to its file there (planning/folder.js), as the current Planner does.
import { lessons, kv, school, manageBacLinks, taughtIn, planTime, newYear, words, look, theme, language, mailApp } from './index.js';
import { mayWrite } from '../shared/lock.js';
import * as tabs from '../shared/tabs.js';
import { saved } from '../shared/saved.js';
import { plannerFolder, writeLessonFile, removeLessonFile, writeTimetableFile } from './folder.js';

export class CannotSave extends Error { constructor(why, what) { super(what + ': ' + why); this.name = 'CannotSave'; this.why = why; } }
const check = what => { mayWrite(what); if (!tabs.live()) throw new CannotSave('replaced', what); };
const tell = name => { try { const ch = new BroadcastChannel(name); ch.postMessage(name === 'gs-bank' ? 'changed' : 'saved'); ch.close(); } catch {} };

// The lesson is stored as given, with updated set to now (src/planner/lessons.js lPut; Drive sync goes by it), and returned as
// stored (with _file and _mod, or _sync, when a Planner folder is linked).
export async function saveLesson(lesson) {
  check('gs-lessons/lessons');
  const l = JSON.parse(JSON.stringify(lesson)); l.updated = Date.now();
  await lessons.put(l);
  const f = await plannerFolder();
  if (f) { try { if (await writeLessonFile(l, f) !== 'none') await lessons.put(l); } catch (e) { console.error(e); l._sync = 1; await lessons.put(l); } }
  tell('gs-plan-out');
  saved({ kind: 'lesson', id: l.id, side: 'planning' });
  return l;
}
export async function deleteLesson(lesson) {
  check('gs-lessons/lessons');
  await lessons.del(lesson.id);
  await removeLessonFile(lesson, await plannerFolder()).catch(e => console.error(e));
  tell('gs-plan-out');
  saved({ kind: 'lesson', id: lesson.id, side: 'planning', gone: true });
}
// snap and max are the Planner's own (engines/planner.js snap, MAX_VERSIONS), passed in so this layer stays without the engine.
export async function saveVersion(lesson, label, snap, max = 30) {
  check('gs-lessons/kv/ver');
  const k = 'ver:' + lesson.id, vs = (await kv.get(k)) || [];
  vs.unshift({ at: Date.now(), label, lesson: snap(lesson) });
  await kv.put(vs.slice(0, max), k);
}
export async function saveLessonFile(blob, id) {
  check('gs-lessons/kv/file');
  await kv.put(blob, 'file:' + id);
  return id;
}
const KV = ['setup', 'units', 'bank', 'activities', 'words', 'deflook'];
export async function saveKv(name, value) {
  if (!KV.includes(name)) throw new Error('Not a Planner record: ' + name);
  check('gs-lessons/kv/' + name);
  await kv.put(value, name);
  // The timetable also goes to its file in a linked Planner folder, as the current Planner writes it when it is changed there.
  if (name === 'setup') await writeTimetableFile(value, await plannerFolder()).catch(e => console.error(e));
  tell('gs-plan-out'); if (name === 'bank') tell('gs-bank');
  saved({ kind: 'plan', id: name, side: 'planning' });
}
const PREFS = { 'gs.look': look, 'gs.theme': theme, 'gs.lang': language, 'gs.words': words, 'gs.mailApp': mailApp, 'gs.mblinks': manageBacLinks, 'gs.school': school };
// value undefined removes the key, as the current app does for English (gs.lang).
export function savePref(key, value) {
  const acc = PREFS[key]; if (!acc) throw new Error('Not a teacher-wide setting: ' + key);
  check(key);
  if (value === undefined) acc.remove(); else acc.setJson(value);
  saved({ kind: 'pref', id: key, side: 'planning' });
}
const day = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// r: { id (the session, so it is counted once), l (lesson id), t (lesson title), ext }. src/planner/plfocus.js pfPlanAdd.
export function addPlanTime(r, secs) {
  if (!(secs > 0)) return;
  check('gsp.planTime');
  const P = planTime.json(null) || {}, days = P.days && typeof P.days === 'object' ? P.days : {}, names = P.names && typeof P.names === 'object' ? P.names : {};
  const ids = Array.isArray(P.ids) ? P.ids.filter(x => typeof x === 'string').slice(-50) : [];
  if (r.id && ids.includes(r.id)) return;
  const id = r.l || '', k = day(), d = { ...(days[k] || {}) }, a = { ...(d.a || {}) };
  d.l = (d.l || 0) + secs; a[id] = (a[id] || 0) + secs; d.f = (d.f || 0) + secs; if (secs >= 60 && !r.ext) d.n = (d.n || 0) + 1;
  d.a = a; days[k] = d; if (id && r.t) names[id] = String(r.t).slice(0, 120);
  for (const dd of Object.keys(days)) if (Date.now() - new Date(dd + 'T12:00:00') > 400 * 864e5) delete days[dd];
  const used = new Set(Object.values(days).flatMap(x => Object.keys((x && x.a) || {})));
  for (const n of Object.keys(names)) if (!used.has(n)) delete names[n];
  planTime.setJson({ days, names, ...(r.id ? { ids: [...ids, r.id] } : {}) });
  saved({ kind: 'pref', id: 'gsp.planTime', side: 'planning' });
}
// key "<lesson id>|<class id>|<date>", note { slide, of, x (the note), t }. MAY HOLD NAMES.
export function saveTaughtNote(key, note) {
  check('gsp.taughtIn');
  const T = taughtIn.json(null), o = T && typeof T === 'object' && T.items && typeof T.items === 'object' ? T : { items: {} };
  o.items = { ...o.items, [key]: note };
  taughtIn.setJson(o);
  saved({ kind: 'pref', id: 'gsp.taughtIn', side: 'planning' });
}
export function startNewYear(v) { check('gsp.newYear'); newYear.setJson(v); saved({ kind: 'pref', id: 'gsp.newYear', side: 'planning' }); }
export function setGoogleToken(v) { mayWrite('sessionStorage:gs.gTok'); try { if (v == null) sessionStorage.removeItem('gs.gTok'); else sessionStorage.setItem('gs.gTok', JSON.stringify(v)); } catch {} }
