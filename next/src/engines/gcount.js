// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
// The library, the kept rows (all of them, as they stand before this save) and the store, handed in by students/count.js.
import { useKept } from './gkept.js';
let lib = { classes: [], loose: { id: '', units: [] } }, keptMeta = new Map(), keptRead = false;
let store = { get: (k, d) => d, set: () => {}, del: () => {} };
export function countUse(o) { if ('lib' in o) lib = o.lib; if ('keptMeta' in o) { keptMeta = o.keptMeta; keptRead = true; } if ('store' in o) store = o.store; useKept(lib, keptMeta); }
const FC_ON = true;
import { keptState } from './gkept.js';

// src/app/library.js
const holders = () => lib.classes.concat([lib.loose]);
// src/app/library.js
const findItem = id => { for (const c of holders()) for (const u of c.units) { const it = u.items.find(x => x.id === id); if (it) return { c, u, it }; } return null; };
// src/app/kept.js
function cardOfKept(id) {
  const m = keptMeta.get(id), f = m && m.asg ? findItem(m.asg) : null;
  if (f) return f.it;
  for (const c of holders()) for (const u of c.units) { const it = u.items.find(x => x.batchId === id); if (it) return it; }
  return null;
}
// src/book.js
const isoDay = t => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// src/focus.js
const FC_LENS = [5, 10, 15, 20, 25, 30, 45, 60], FC_BRKS = [3, 5, 10, 15], FC_AWAY = 180e3, FC_DAY = 864e5, FC_KEEP = 400, TK_IDLES = [2, 5, 10, 15], TK_PES = [0, 2, 3, 5, 10];
// src/focus.js
function fcLog() {
  const L = store.get('gs.focus', null) || {};
  return { day: typeof L.day === 'string' ? L.day : '', base: L.base && typeof L.base === 'object' ? L.base : {}, days: L.days && typeof L.days === 'object' ? L.days : {},
    pace: Array.isArray(L.pace) ? L.pace.filter(x => Array.isArray(x) && x[0] > 0 && x[1] > 0) : [], last: typeof L.last === 'string' ? L.last : '',
    add: Array.isArray(L.add) ? L.add.filter(x => x && typeof x.d === 'string' && (x.k === 'g' || x.k === 'l') && x.s > 0) : [],
    ...(typeof L.lbHid === 'string' ? { lbHid: L.lbHid } : {}),
    ...(Array.isArray(L.addGone) ? { addGone: L.addGone.filter(x => typeof x === 'string').slice(-200) } : {}),   // time added by hand and taken off, so another device's copy doesn't bring it back (src/merge.js)
    ...(Array.isArray(L.qd) ? { qd: L.qd.filter(x => typeof x === 'string').slice(-50) } : {}),   // sessions from the Planner written in already (fcDrain)   // the week whose look-back was put away (src/gradeplan.js)
    // carry: a session goal not reached, for the next session on the same work: { w, t: when, k: 'papers' | 'set' | 'td' | 'note', n, x }
    ...(L.carry && typeof L.carry.w === 'string' && L.carry.t > 0 ? { carry: L.carry } : {}),
    ...(L.by && typeof L.by === 'object' ? { by: L.by } : {}) };   // { <download>: 'YYYY-MM-DD' }: the day a set is to be finished by
}
// src/focus.js
const fcLogSet = L => store.set('gs.focus', L);
// src/focus.js
function fcMon(day) { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoDay(d); }
// src/focus.js
const fcToday = () => isoDay(Date.now());
// src/focus.js
const fcDone = m => { const st = keptState(m); return st.fm || m.marked == null ? st.done : Math.min(st.of, m.marked); };
// src/focus.js
const fcKnown = m => !!m && (m.marked != null || m.scored == null || keptState(m).fm);
// src/focus.js
function fcPapersOf(L) { let n = 0; for (const m of keptMeta.values()) if (fcKnown(m) && m.id in L.base) n += Math.max(0, fcDone(m) - L.base[m.id]); return n; }
// src/focus.js
function fcPapersBy(L) {
  const o = {};
  for (const m of keptMeta.values()) if (fcKnown(m) && m.id in L.base) { const n = Math.max(0, fcDone(m) - L.base[m.id]); if (!n) continue; const it = cardOfKept(m.id), k = it ? it.id : ''; o[k] = (o[k] || 0) + n; }
  return o;
}
// src/focus.js
function fcFrom(id, m) { const old = [...keptMeta.values()].find(o => o && o.newer === id); return Math.max(m ? fcDone(m) : 0, old ? fcDone(old) : 0); }
// src/focus.js
function fcSeen(id) {
  if (!FC_ON || !keptRead) return;
  const L = fcLog(), today = fcToday(); let ch = false;
  if (L.day !== today) { L.day = today; L.base = {}; ch = true; }
  if (id && !keptMeta.has(id) && !(id in L.base)) { L.base[id] = fcFrom(id, null); ch = true; }
  for (const m of keptMeta.values()) if (fcKnown(m) && m.id && !(m.id in L.base)) { L.base[m.id] = fcFrom(m.id, m); ch = true; }
  for (const k of Object.keys(L.base)) if (k !== id && !keptMeta.has(k)) { delete L.base[k]; ch = true; }
  const p = fcPapersOf(L), d = L.days[today] || {}, pa = fcPapersBy(L);
  if ((d.p || 0) !== p || JSON.stringify(d.pa || {}) !== JSON.stringify(pa)) { L.days[today] = { ...d, p, pa }; if (!p) delete L.days[today].pa; ch = true; }
  for (const k of Object.keys(L.days)) if (Date.now() - new Date(k + 'T12:00:00') > FC_KEEP * FC_DAY) { delete L.days[k]; ch = true; }
  if (L.by) for (const k of Object.keys(L.by)) if (!keptMeta.has(k) || !(L.by[k] >= today)) { delete L.by[k]; ch = true; }
  if (L.carry && Date.now() - L.carry.t > 3 * FC_DAY) { delete L.carry; ch = true; }
  const old = L.add.length; L.add = L.add.filter(x => Date.now() - new Date(x.d + 'T12:00:00') <= FC_KEEP * FC_DAY); if (L.add.length !== old) ch = true;
  if (ch) fcLogSet(L);
}
// src/focus.js
function fcCame(id, m0, m) {
  if (!FC_ON || !keptRead || !m) return;
  const L = fcLog(); if (L.day !== fcToday() || !(id in L.base)) return;
  const b = Math.max(0, L.base[id] + fcDone(m) - (m0 ? fcDone(m0) : 0));
  if (b !== L.base[id]) { L.base[id] = b; fcLogSet(L); }
}
// src/focus.js
const FC_KEY = 'gsp.focusRun';
// src/focus.js
const fcRun = () => { const r = store.get(FC_KEY, null); return r && r.st ? r : null; };
// src/focus.js
const fcPut = r => { if (r) store.set(FC_KEY, r); else store.del(FC_KEY); };
// src/focus.js
function fcGain(m0, m) {
  if (!FC_ON || !m0 || !m) return;
  const r = fcOwnRun(fcRun()); if (!r || r.k === 'l' || (r.st !== 'run' && r.st !== 'paused') || r.got != null) return;   // papers never count toward a lesson
  if (!fcKnown(m0) || !fcKnown(m)) return;
  // a first save brings marks carried over from an older copy, which weren't finished now
  const d = fcDone(m) - (m0.scored == null && m0.marked == null ? fcFrom(m.id, m0) : fcDone(m0)); if (!d) return;
  r.pg = (r.pg || 0) + d; fcPut(r);
}
// src/focus.js
const FC_P0 = 1e9;
// src/focus.js
function fcOwnRun(r) { if (r && r.k !== 'l' && r.st !== 'done' && r.got == null && r.p0 !== FC_P0) { r.p0 = FC_P0; r.pg = r.pg || 0; fcPut(r); } return r; }
export { fcSeen, fcGain, fcCame, fcLog, fcLogSet, fcToday, fcMon, fcRun, fcPut, fcOwnRun, FC_P0, FC_KEY, fcDone, fcKnown, fcPapersOf, fcPapersBy, fcFrom };
