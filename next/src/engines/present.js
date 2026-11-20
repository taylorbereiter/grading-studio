// MADE BY next/build.js FROM src/planner/*.js (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { meetingsOn } from './planner.js';
// src/planner/lessons.js
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
// src/planner/present.js
const prToday = () => ymd(new Date());
// src/planner/present.js
const prMin = t => { const [h, m] = String(t || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
// src/planner/present.js
const prNowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
// src/planner/present.js
function prMeeting(slot) {
  if (!slot) return null;
  const ms = meetingsOn(slot.date).filter(x => x.c.id === slot.classId).map(x => x.m).filter(m => m.start && m.end);
  if (!ms.length) return null;
  const now = prNowMin();
  return ms.find(m => prMin(m.start) <= now && now < prMin(m.end)) || ms.find(m => prMin(m.start) > now) || ms[ms.length - 1];
}
// src/planner/present.js
function prSlotNow(l) {
  const today = l.slots.filter(s => s.date === prToday()); if (!today.length) return null;
  const now = prNowMin();
  const rank = s => { const m = prMeeting(s); if (!m) return [3, 0]; const a = prMin(m.start), b = prMin(m.end); return a - 10 <= now && now < b ? [0, a] : now < a ? [1, a] : [2, -b]; };
  return today.map(s => ({ s, r: rank(s) })).sort((x, y) => x.r[0] - y.r[0] || x.r[1] - y.r[1])[0].s;
}
export { prSlotNow };
