// Focus and time (src/focus.js, src/tracker.js, src/gradeplan.js): the timer's settings (lib.me.focus), its log (gs.focus), the
// session going on (gsp.focusRun, shared with the current app's pages and its Planner), the time tracker's days and the grading
// plan. The working out is the lifted engines' (engines/gfocus.js, gcount.js), handed the library, every kept row, the timetable
// and the store (students/count.js timerStore). Nothing here draws: the panel and the cards are app/focus/.
import * as E from '../engines/gfocus.js';
import * as K from '../engines/gcount.js';
import * as C from './counts.js';
import { libraryChange } from './undo.js';
import { timerStore } from './count.js';
import { readPlan, dayRows, isoDay } from '../planning/today.js';
import { planTime, lessons } from '../planning/index.js';
import { saveLesson } from '../planning/write.js';
import { getLocale } from '../i18n/t.js';

// The timer's engine in one: gfocus with the counting it shares with each save (gcount: fcLog, fcRun, fcToday…).
export const engine = { ...E, ...K };
let hooks = {}, last = null;
// The card a download belongs to, from the library and rows read last (src/app/kept.js cardOfKept).
export const cardFor = id => (last ? C.cardOf(last.lib, last.keptMeta, id) : null);
// The hooks the lifted timer calls to draw, move to the work, chime and so on: the session runner's (app/focus/run.js).
export function focusHooks(h) { hooks = { ...hooks, ...h }; E.focusUse({ hooks }); }
// Everything read once, so the engine's answers match the saved work as it is now.
export async function focusRead() {
  const lib = C.readLibrary(), keptMeta = await C.readKept(), plan = await readPlan();
  E.focusUse({ lib, keptMeta, plan, store: timerStore, canOpen: C.canOpen, locale: getLocale(), hooks });
  last = { lib, keptMeta, plan };
  return { lib, keptMeta, plan, conf: E.fcConf() };
}
// A change to her settings (lib.me.focus), one step Undo takes back. fcConfSet keeps only what differs from the usual.
export async function focusConf(label, part) {
  await libraryChange(label, lib => { E.focusUse({ lib }); E.fcConfSet(part); }, true);
  E.focusUse({ lib: C.readLibrary() });
  E.tkShare();
}
// Time added by hand (src/tracker.js tkAddTime), and taken off again: kept in gs.focus, where the tracker reads it.
export function addTime(day, kind, min, note) { E.tkAddTime(day, kind, min, note); }
export function dropTime(id) {
  const L = K.fcLog(); L.add = L.add.filter(x => x.id !== id); L.addGone = [...(L.addGone || []), id].slice(-200); K.fcLogSet(L);
}

// Planning time outside a session (src/planner/plantime.js ptTick, ptFlush): a planning screen in front, something typed, clicked,
// pasted or dropped within the last 90 seconds, not in a lesson's own focus session, and not while one of her classes meets. It
// counts only once it has gone on for her minutes (Settings, 3 by default; 0 never), and then all of it counts.
const PT_GAP = 90e3;
let ptRun = { s: 0, a: {}, n: {}, live: false }, ptPend = { l: 0, a: {}, n: {} };
const ptAdd = (to, k, secs, title) => { to.a[k] = (to.a[k] || 0) + secs; if (title) to.n[k] = title; };
const hm = s => { const m = /^(\d{1,2}):(\d\d)/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
// One of her classes meeting now, by the timetable.
export function inClass(plan, d = new Date()) {
  if (!plan) return false;
  const rows = dayRows(plan, d.getTime()).rows, now = d.getHours() * 60 + d.getMinutes();
  return rows.some(r => { const a = hm(r.m.start), b = hm(r.m.end); return a != null && b != null && a <= now && now < b; });
}
// step: seconds since the last step; planning: a planning screen is in front and the window has focus; last: when she last did
// something there; lesson: { id, title } of the lesson open, or null.
export function planStep(step, { planning, last, lesson, plan }) {
  const c = E.fcConf(), r = K.fcRun(), now = Date.now();
  const may = c.pe && planning && !(r && r.k === 'l' && (r.st === 'run' || r.st === 'paused')) && !inClass(plan);
  if (!may || now - last >= (ptRun.live ? c.idle * 60e3 : PT_GAP)) { ptRun = { s: 0, a: {}, n: {}, live: false }; return; }
  const k = lesson ? lesson.id : '', title = lesson ? String(lesson.title || '').slice(0, 120) : '';
  if (ptRun.live) { ptPend.l += step; ptAdd(ptPend, k, step, title); return; }
  ptRun.s += step; ptAdd(ptRun, k, step, title);
  if (ptRun.s >= c.pe * 60) { ptPend.l += ptRun.s; for (const [id, v] of Object.entries(ptRun.a)) ptAdd(ptPend, id, v, ptRun.n[id]); ptRun = { s: 0, a: {}, n: {}, live: true }; }
}
export function planFlush() {
  if (!ptPend.l) return;
  const P = planTime.json(null) || {}, days = P.days && typeof P.days === 'object' ? P.days : {}, names = P.names && typeof P.names === 'object' ? P.names : {}, k = isoDay(Date.now());
  const d = { ...(days[k] || {}) }, a = { ...(d.a || {}) };
  d.l = (d.l || 0) + ptPend.l;
  for (const [id, v] of Object.entries(ptPend.a)) a[id] = (a[id] || 0) + v;
  d.a = a; days[k] = d;
  for (const [id, x] of Object.entries(ptPend.n)) if (x) names[id] = x;
  for (const day of Object.keys(days)) if (Date.now() - new Date(day + 'T12:00:00') > 400 * 864e5) delete days[day];
  const used = new Set(Object.values(days).flatMap(x => Object.keys((x && x.a) || {})));
  for (const id of Object.keys(names)) if (!used.has(id)) delete names[id];
  ptPend = { l: 0, a: {}, n: {} };
  planTime.setJson({ ...P, days, names });
}
// A lesson planned in a session: ready to teach, or not after all (src/planner/plfocus.js pfReadySet), saved on the lesson.
export async function lessonReady(id, on) {
  const l = await lessons.get(id); if (!l) return null;
  const was = l.ready ? { ...l.ready } : null;
  if (on) l.ready = { at: Date.now() }; else delete l.ready;
  await saveLesson(l);
  return was;
}
