// Today's teaching, worked out from the timetable and the lessons: the same answers as the current app's Today (src/today.js
// planRead, todayRows, nowRow) and its planning lines (src/todo.js todoAuto "plan", src/gradeplan.js gpLesWorked).
// Read only. Nothing is stored. Class names, colours, times and lesson titles only: no student data is on this side.
import { setupRecord, lessons as lessonStore, planCopy, planTime } from './index.js';
import { json } from '../shared/ls.js';

export const isoDay = t => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const dayAt = day => new Date(day + 'T12:00:00');
export const addDays = (day, n) => { const d = dayAt(day); d.setDate(d.getDate() + n); return isoDay(d); };
// A phone's screen, not a narrow window on a computer (src/phone.js PHONE, without its ?phone= switch, which only the current app reads).
export function onPhone() {
  try { const k = localStorage.getItem('gs.phone'); if (k === '1' || k === '0') return k === '1'; } catch {}
  try { return Math.min(screen.width, screen.height) < 600 && matchMedia('(pointer: coarse)').matches; } catch { return false; }
}

// { classes, semStart, semEnd, daysOff, lessons, ready } or null when there is no timetable.
export async function readPlan() {
  let setup = null, lessons = [];
  try { [setup, lessons] = await Promise.all([setupRecord.get(), lessonStore.entries().then(e => e.map(([, v]) => v))]); } catch {}
  if (!(setup && Array.isArray(setup.classes) && setup.classes.length)) setup = planCopy.json(null);
  if (onPhone()) for (const [id, b] of Object.entries(json('gs.planBig', null) || {})) if (b && Array.isArray(b.slots) && !lessons.some(l => l && l.id === id)) lessons = [...lessons, { id, title: b.title, slots: b.slots.filter(x => x && x.classId != null && x.date), slides: [] }];
  const hex = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#1F6FB2';
  const classes = (setup && Array.isArray(setup.classes) ? setup.classes : []).filter(c => c && c.id != null).map(c => ({ id: String(c.id), name: String(c.name || c.id), color: hex(c.color),
    meets: (Array.isArray(c.meets) ? c.meets : []).map(m => ({ dow: +m.dow, start: String(m.start || ''), end: String(m.end || '') })) }));
  if (!classes.length) return null;
  const L = Array.isArray(lessons) ? lessons : [];
  return {
    classes, semStart: String(setup.semStart || ''), semEnd: String(setup.semEnd || ''),
    daysOff: (Array.isArray(setup.daysOff) ? setup.daysOff : []).filter(d => d && d.date).map(d => ({ date: String(d.date), label: String(d.label || '') })),
    lessons: L.filter(l => l && l.id && Array.isArray(l.slots) && l.slots.length).map(l => ({ id: String(l.id), title: String(l.title || ''), status: String(l.status || ''), done: !!l.final, ready: !!(l.ready && +l.ready.at), n: Array.isArray(l.slides) ? l.slides.length : 0,
      taught: (Array.isArray(l.taught) ? l.taught : []).filter(t => t && t.date).map(t => ({ classId: String(t.classId || ''), date: String(t.date), slide: +t.slide || 1, of: +t.of || 1 })),
      slots: l.slots.map(s => ({ classId: String(s.classId), date: String(s.date) })) })),
  };
}
// A day's meetings in the order they happen, each with the lessons planned for it.
export function dayRows(p, now = Date.now()) {
  const d = isoDay(now), dow = new Date(now).getDay(), off = p.daysOff.find(x => x.date === d);
  if (off) return { off: off.label || true, rows: [] };
  const rows = [];
  for (const c of p.classes) for (const m of c.meets) if (m.dow === dow) rows.push({ c, m, lessons: p.lessons.filter(l => l.slots.some(s => s.classId === c.id && s.date === d)) });
  return { off: '', rows: rows.sort((a, b) => a.m.start.localeCompare(b.m.start)) };
}
// The class on now, or else the next one: the first that has not ended yet.
export function nowRow(rows, now = Date.now()) {
  const d = new Date(now), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), pad = t => (/^\d:/.test(t) ? '0' : '') + t;
  return rows.find(r => pad(r.m.end || r.m.start) > hm) || null;
}
// Planning seconds on a lesson in the last 14 days (src/gradeplan.js gpLesWorked).
export function lessonWorked(id, now = Date.now()) {
  if (!id) return 0;
  const P = planTime.json(null) || {}, days = P.days && typeof P.days === 'object' ? P.days : {}, from = addDays(isoDay(now), -13);
  let s = 0; for (const [day, d] of Object.entries(days)) if (day >= from && d && d.a && d.a[id]) s += +d.a[id] || 0;
  return s;
}
// Classes in the next four days with nothing planned (src/todo.js todoAuto "plan"): [{ key, classId, className, day, start, lesson }].
// A begun lesson (planning time in the last 14 days) keeps its line until it is ready or finished.
export function toPlan(p, now = Date.now()) {
  const out = [], today = isoDay(now);
  if (!p) return out;
  for (let i = 0; i < 4; i++) {
    const day = addDays(today, i); if ((p.semStart && day < p.semStart) || (p.semEnd && day > p.semEnd)) continue;
    const t = dayRows(p, i ? dayAt(day).getTime() : now), live = i ? null : nowRow(t.rows, now);
    for (const r of t.rows) {
      if (!i && (!live || t.rows.indexOf(r) < t.rows.indexOf(live))) continue;
      let on = null;
      if (r.lessons.length) { if (r.lessons.some(l => l.ready || l.done)) continue; on = r.lessons.find(l => lessonWorked(l.id, now) > 0); if (!on) continue; }
      out.push({ in: i, key: 'plan:' + r.c.id + ':' + day + ':' + r.m.start, classId: r.c.id, className: r.c.name, color: r.c.color, day, start: r.m.start, lesson: on ? on.title : '' });
    }
  }
  return out;
}
