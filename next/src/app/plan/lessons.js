// What the planning screens say about lessons: where each class's lesson is, whether it is ready, and the few writes the calendar
// makes (a new lesson in an empty period, a lesson moved to another of its class's periods). Every write goes through
// planning/write.js saveLesson, so the record is the one the current Planner writes (src/planner/lessons.js createLesson, the
// week view's drag).
import { saveLesson } from '../../planning/write.js';
import { engine } from '../../planning/engine.js';
import { t } from '../../i18n/t.js';
import './lines.js';

export const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const at = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
export const plus = (s, n) => { const d = at(s); d.setDate(d.getDate() + n); return iso(d); };
export const today = () => iso(new Date());
export const mins = s => { const m = /^(\d{1,2}):(\d\d)/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };

// The lessons on a class's period. A lesson planned for two sections is in both.
export const lessonsOn = (p, classId, day) => ((p && p.lessons) || []).filter(l => Array.isArray(l.slots) && l.slots.some(s => s.classId === classId && s.date === day));
// 'taught' (where the class got to was noted), 'ready' (she said so, or its finished deck is in), 'draft', or 'none'.
export function stateOf(l, classId, day) {
  if (!l) return 'none';
  if ((l.taught || []).some(x => x && x.classId === classId && x.date === day)) return 'taught';
  if ((l.ready && +l.ready.at) || l.final) return 'ready';
  return 'draft';
}
// Made or changed by the assistant in the Planner folder and not looked at yet (planning/folder-read.js).
export const arrived = l => !!l && (!!l.pending || l.status === 'review');
export const STATE_LINE = { taught: 'plan.taught', ready: 'plan.ready', draft: 'plan.draft', none: 'plan.not_planned' };

// The periods on a day: [{ c, m, date }] in time order, none on a day off (src/planner/lessons.js meetingsOn).
export function periods(p, day) { return p && p.setup ? engine(p).meetingsOn(day) : []; }
export const dayOff = (p, day) => ((p && p.setup && p.setup.daysOff) || []).find(d => d && d.date === day) || null;
export const eventsOn = (p, day) => ((p && p.setup && p.setup.events) || []).filter(e => e && (e.date === day || (e.to && e.date <= day && day <= e.to)));
export const classOf = (p, id) => ((p && p.setup && p.setup.classes) || []).find(c => c && String(c.id) === String(id)) || null;

// A new lesson in an empty period, and on the other section's matching period that week when it shares the course
// (src/planner/lessons.js createLesson + partnerSlots). Returns the lesson as stored.
export async function newLesson(p, classId, day) {
  const E = engine(p), name = t('plan.new_lesson');
  const slots = [{ classId, date: day }, ...E.partnerSlots(classId, day)];
  const l = E.deckStart(E.normLesson({ title: name, slots, slides: [{ layout: 'title', title: name, fmt: 2 }, { layout: 'content', title: '', body: '', fmt: 2 }] }));
  return saveLesson(l);
}
// A lesson moved from one period of a class to another (the week view's drag): its slot changes, nothing else.
export async function moveLesson(l, from, to) {
  const slots = l.slots.map(s => (s.classId === from.classId && s.date === from.date ? { classId: to.classId, date: to.date } : s));
  if (slots.some((s, i) => slots.findIndex(x => x.classId === s.classId && x.date === s.date) !== i)) return null;
  return saveLesson({ ...l, slots });
}
// The Monday of the week a day is in (a school that meets on Sunday counts Sunday with the week after it, as the Planner does).
export function mondayOf(p, day) { return iso(engine(p).mondayOf(at(day))); }
export function weekDays(p, mon) { return engine(p).plWeekOffs().map(i => plus(mon, i)); }
