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
//   dropLessonFile(id)        a material's bytes, when it is taken off the lesson
//   saveVersions(id, list)    a lesson's versions as a whole (kv ver:<id>), when one is put back
//   saveSchoolFile(hash, data) a School file's bytes by their SHA-256 (grading-studio-school/files; src/school.js schPut)
// A lesson written while a Planner folder is linked also goes to its file there (planning/folder.js), as the current Planner does.
import { lessons, kv, school, schoolFiles, manageBacLinks, taughtIn, planTime, newYear, words, look, theme, language, mailApp, googleEmail, googleAuto, drivePaperDir, driveVideoDir, planCopy, planSeen, planBig, presentTimer, presentSound, presentBig, presentOwn } from './index.js';
import { mayWrite } from '../shared/lock.js';
import * as tabs from '../shared/tabs.js';
import { saved } from '../shared/saved.js';
import { writeMany } from '../shared/idb.js';
import { plannerFolder, writeLessonFile, removeLessonFile, writeTimetableFile, writeActivitiesFile } from './folder.js';

export class CannotSave extends Error { constructor(why, what) { super(what + ': ' + why); this.name = 'CannotSave'; this.why = why; } }
export const check = what => { mayWrite(what); if (!tabs.live()) throw new CannotSave('replaced', what); };
export const tell = name => { try { const ch = new BroadcastChannel(name); ch.postMessage(name === 'gs-bank' ? 'changed' : 'saved'); ch.close(); } catch {} };

// The lesson is stored as given, with updated set to now (src/planner/lessons.js lPut; Drive sync goes by it), and returned as
// stored (with _file and _mod, or _sync, when a Planner folder is linked). file: false for a lesson just read from its file there.
export async function saveLesson(lesson, { file = true } = {}) {
  check('gs-lessons/lessons');
  const l = JSON.parse(JSON.stringify(lesson)); l.updated = Date.now();
  await lessons.put(l);
  const f = file ? await plannerFolder() : null;
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
// A material taken off a lesson: its bytes go too (src/planner/materials.js matClick rm). The screen keeps the Blob for undo.
export async function dropLessonFile(id) {
  check('gs-lessons/kv/file');
  await kv.del('file:' + id);
}
// Versions as the Planner keeps them: newest first, at most max (src/planner/review.js saveVersion, verRestore).
export async function saveVersions(id, list) {
  check('gs-lessons/kv/ver');
  await kv.put(list, 'ver:' + id);
}
// The Planner's other records kept by key (src/planner: panel.js books 'pdfs' and 'pdf:<id>', notebook.js 'nb:general'). Bytes of
// a book stay in this browser, as today.
// pdfpg:<id> is the page a book was left on; it is kept quietly (no other window needs to read the plan again for it).
const KVX = /^(pdfs|pdf:[\w-]+|pdfpg:[\w-]+|nb:general)$/;
export async function savePlannerKv(key, value) {
  if (!KVX.test(key)) throw new Error('Not a Planner record: ' + key);
  check('gs-lessons/kv/' + key.split(':')[0]);
  await kv.put(value, key);
  if (key.startsWith('pdfpg:')) return;
  tell('gs-plan-out'); saved({ kind: 'plan', id: key, side: 'planning' });
}
export async function dropPlannerKv(key) {
  if (!KVX.test(key)) throw new Error('Not a Planner record: ' + key);
  check('gs-lessons/kv/' + key.split(':')[0]);
  await kv.del(key);
  tell('gs-plan-out'); saved({ kind: 'plan', id: key, side: 'planning', gone: true });
}
const KV = ['setup', 'units', 'bank', 'activities', 'words', 'deflook'];
// file: false for a record just read from the Planner folder, so it isn't written straight back.
export async function saveKv(name, value, { file = true } = {}) {
  if (!KV.includes(name)) throw new Error('Not a Planner record: ' + name);
  check('gs-lessons/kv/' + name);
  const was = name === 'units' ? await kv.get('units').catch(() => null) : null;
  await kv.put(value, name);
  const f = file ? await plannerFolder() : null;
  // The timetable also goes to its file in a linked Planner folder, as the current Planner writes it when it is changed there.
  if (name === 'setup') await writeTimetableFile(value, f).catch(e => console.error(e));
  // The teacher's own activities go to activities.json there too (src/planner/activities.js actFolderWrite).
  if (name === 'activities') await writeActivitiesFile(value, f).catch(e => console.error(e));
  // A unit she changed goes to Units/ there, and the bank to Rubrics/ (planning/folder-more.js afterSave).
  if (f && (name === 'units' || name === 'bank')) await import('./folder-more.js').then(m => m.afterSave(name, value, was, f)).catch(e => console.error(e));
  tell('gs-plan-out'); if (name === 'bank') tell('gs-bank');
  saved({ kind: 'plan', id: name, side: 'planning' });
}

// Linking the Planner folder, writing it whole and what reading it keeps are in planning/folder-more.js (loaded only with a folder).

const PREFS = { 'gs.look': look, 'gs.theme': theme, 'gs.lang': language, 'gs.words': words, 'gs.mailApp': mailApp, 'gs.mblinks': manageBacLinks, 'gs.school': school,
  'gs.gEmail': googleEmail, 'gs.gAuto': googleAuto, 'gs.gPaperDir': drivePaperDir, 'gs.gVidDir': driveVideoDir, 'gs.planCopy': planCopy, 'gs.planSeen': planSeen, 'gs.planBig': planBig,
  'gsp.presentTimer': presentTimer, 'gsp.presentSound': presentSound, 'gsp.presentBig': presentBig, 'gsp.presentOwn': presentOwn };
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
export async function saveSchoolFile(hash, data) {
  check('grading-studio-school/files');
  await schoolFiles.put({ data }, hash);
  saved({ kind: 'pref', id: 'gs.school', side: 'planning' });
}

// What the Drive sync brings in for the Planner (src/app/drive.js planApply), as one transaction: each lesson and record only if
// it is still what the sync read before merging (otherwise she saved it again meanwhile, and hers stays: it goes up next time).
// put: lessons to write; del: lesson ids; keys: [[name, value]]; had: id -> the lesson as read; seenKv: name -> the value as read;
// out(name, value): a record as the sync compares it (units without where each is kept in the Planner folder).
export async function takePlan({ put = [], del = [], keys = [], had = {}, seenKv = {}, out = (k, v) => v }) {
  check('gs-lessons/lessons');
  await writeMany('gs-lessons', ['lessons', 'kv'], o => {
    const ls = o.lessons, kvs = o.kv, goneFiles = [];
    const same = (was, id) => (was ? was.updated || 0 : null) === (had[id] ? had[id].updated || 0 : null);
    for (const l of put) { const r = ls.get(l.id); r.onsuccess = () => { const was = r.result; if (!same(was, l.id)) return; ls.put(was && was._file ? { ...l, _file: was._file, _mod: was._mod, _sync: 1 } : l); }; }
    for (const id of del) { const r = ls.get(id); r.onsuccess = () => { const was = r.result; if (!was || !same(was, id)) return; if (was._file) goneFiles.push(was._file); ls.delete(id); }; }
    for (const [k, v0] of keys) {
      const r = kvs.get(k);
      r.onsuccess = () => {
        const was = r.result; if (JSON.stringify(out(k, was)) !== JSON.stringify(seenKv[k])) return;
        let v = v0;
        if (k === 'units' && Array.isArray(v) && Array.isArray(was)) v = v.map(u => { const w = was.find(x => x && u && x.id === u.id); return w && w._file ? { ...u, _file: w._file, _mod: w._mod } : u; });
        kvs.put(v, k);
      };
    }
    // after the reads above: the files of lessons deleted by the sync, for the Planner to take out of its folder
    const g = kvs.get('syncGoneFiles');
    const last = ls.count(); last.onsuccess = () => { if (goneFiles.length) kvs.put([...new Set([...(g.result || []), ...goneFiles])], 'syncGoneFiles'); };
  });
  tell('gs-plan-in');
  saved({ kind: 'plan', id: 'sync', side: 'planning', from: 'sync' });
}

