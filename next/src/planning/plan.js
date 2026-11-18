// The Planner's saved work, read whole: the timetable (kv "setup"), every lesson, the units, the rubric bank and the teacher's own
// activities, as the current Planner holds them in memory (src/planner/lessons.js L, lLoadAll; units.js unitsLoad). Records are read
// raw, never put through normLesson on the way in (the current Planner doesn't either: a lesson is cleaned only when it is made or
// brought in). The Planner's engines read the same copy from their L (planning/engine.js puts it there), so they answer for this
// teacher's week. This file holds no engine itself, so the sidebar can read the timetable without loading them.
//
// Read again when another window saves (gs-plan-out), when this window saves (shared/saved.js), and when she comes back to it.
import { lessons as lessonStore, kv, units as unitRec, bank as bankRec, activities as actRec, setupRecord, lessonLook, planCopy } from './index.js';
import { onSaved } from '../shared/saved.js';

let cur = null, reading = null, stamp = 0;
const told = new Set();

export async function readAll() {
  const [setup, list, units, bank, activities, deflook, dir] = await Promise.all([setupRecord.get(), lessonStore.entries().then(e => e.map(([, v]) => v)),
    unitRec.get(), bankRec.get(), actRec.get(), lessonLook.get(), kv.get('dir')].map(p => p.catch(() => undefined)));
  const s = setup && Array.isArray(setup.classes) ? setup : (planCopy.json(null) || null);
  const p = { setup: s || null, lessons: (list || []).filter(l => l && l.id), units: Array.isArray(units) ? units : [], bank: bank || null,
    activities: Array.isArray(activities) ? activities : [], deflook: deflook || '', folder: !!dir, at: Date.now() };
  use(p);
  return p;
}
export function use(p) { cur = p; }
export const plan = () => cur;

// The plan, read once and shared by every screen until something changes.
export function loadPlan(fresh) {
  if (cur && !fresh) return Promise.resolve(cur);
  if (!reading) { const my = ++stamp; reading = readAll().then(p => { if (my === stamp) told.forEach(f => f(p)); return p; }).finally(() => { reading = null; }); }
  return reading;
}
export function onPlan(f) { told.add(f); return () => told.delete(f); }

let listening = false;
export function listenPlan() {
  if (listening) return; listening = true;
  const again = () => loadPlan(true).catch(e => console.error(e));
  try { const ch = new BroadcastChannel('gs-plan-out'); ch.onmessage = again; } catch {}
  onSaved(e => { if (e.side === 'planning' && (e.kind === 'lesson' || e.kind === 'plan')) again(); });
}

// The timetable class a grading class is (the current app matches them by name: src/todo.js tdGradeClass, tdKey).
export const nameKey = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function timetableClass(p, name) { const k = nameKey(name); return ((p && p.setup && p.setup.classes) || []).find(c => nameKey(c.name) === k) || null; }
