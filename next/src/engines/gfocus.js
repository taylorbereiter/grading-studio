// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
// What the lifted timer reads and writes, handed in by students/focus.js: the library (lib.me.focus is her settings), the kept rows, the
// timetable, and the store (gs.focus on the students side, gsp.focusRun, gsp.focusQ, gsp.planTime and gsp.timeCount on the planning
// side). What it calls that draws or moves between screens are the hooks (H), quiet until the new app hands its own in.
import { useKept } from './gkept.js';
import { todoUse } from './gtodo.js';
import { countUse } from './gcount.js';
let lib = { classes: [], loose: { id: '', units: [] } }, keptMeta = new Map(), keptRead = false, plan = null, LANG_LOCALE = undefined;
let store = { get: (k, d) => d, set: () => {}, del: () => {} }, canOpen = m => !!m && !!m.papers;
const H = { render() {}, clock() {}, title() {}, goTo() {}, lesOpen() {}, chime() {}, wake() {}, page() {} };
export function focusUse(o) {
  if ('lib' in o) lib = o.lib; if ('keptMeta' in o) { keptMeta = o.keptMeta; keptRead = true; } if ('plan' in o) plan = o.plan; if ('store' in o) store = o.store;
  if ('canOpen' in o) canOpen = o.canOpen; if ('locale' in o) LANG_LOCALE = o.locale; if ('hooks' in o) Object.assign(H, o.hooks);
  useKept(lib, keptMeta); todoUse({ lib, plan }); countUse({ lib, keptMeta, store });
}
// Something pressed, typed or scrolled (src/tracker.js tkLast): the new app's shell tells it.
export const fcActive = t => { tkLast = t; };
export const fcActiveAt = () => tkLast;
export const tkPending = () => tkPend;
export const tkCount = (k, secs) => { tkPend.g += secs; tkPend.a[k] = (tkPend.a[k] || 0) + secs; };
const FC_ON = true, tkReady = true, gpReady = true, batch = null, cur = 0, $ = () => ({ hidden: true });
const fcRender = () => H.render(), fcClockDraw = () => H.clock(), fcTitle = () => H.title(), fcGoTo = n => H.goTo(n), fcLesOpen = () => H.lesOpen();
const fcChime = () => H.chime(), fcAudioWake = () => H.wake(), tkPageRender = () => H.page(), renderProg = () => {}, routeNow = () => ({});
const me = () => lib.me || {}, meDrop = (k, v) => { const m = { ...me() }; if (v) m[k] = v; else delete m[k]; lib.me = m; };
// The music's moods, by id (engines/glofi.js LOFI_STYLES, which next/test/focus.test.js holds this to): fcConf only checks a mood is one.
const LOFI_STYLES = ['rain', 'library', 'coffee', 'night', 'tape', 'garden', 'blue', 'quiet'].map(id => ({ id }));
const tr = s => s;
import { keptState, keptBack, homeGroups } from './gkept.js';
import { tdItems, tdItem, tdToday, tdAt, tdAdd } from './gtodo.js';
import { fcLog, fcLogSet, fcMon, fcToday, fcPapersOf, fcSeen, fcRun, fcPut, FC_P0, fcOwnRun } from './gcount.js';

// src/app/library.js
let fresh = store.get('gs.lib', null) == null;   // a browser nobody has used yet: it gets the welcome, and nothing of anyone's
// src/app/library.js
const holders = () => lib.classes.concat([lib.loose]);
// src/app/library.js
const findItem = id => { for (const c of holders()) for (const u of c.units) { const it = u.items.find(x => x.id === id); if (it) return { c, u, it }; } return null; };
// src/app/library.js
const classById = id => lib.classes.find(c => c.id === id);
// src/app/kept.js
function cardOfKept(id) {
  const m = keptMeta.get(id), f = m && m.asg ? findItem(m.asg) : null;
  if (f) return f.it;
  for (const c of holders()) for (const u of c.units) { const it = u.items.find(x => x.batchId === id); if (it) return it; }
  return null;
}
// src/book.js
const isoDay = t => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// src/marksout.js
const one = t => String(t || '').replace(/\s*\n\s*/g, ' ').trim();
// src/today.js
function todayRows(p, now) {
  const d = isoDay(now || Date.now()), dow = new Date(now || Date.now()).getDay(), off = p.daysOff.find(x => x.date === d);
  if (off) return { off: off.label || 'No school', rows: [] };
  const rows = [];
  for (const c of p.classes) for (const m of c.meets) if (m.dow === dow) rows.push({ c, m, lessons: p.lessons.filter(l => l.slots.some(s => s.classId === c.id && s.date === d)) });
  return { off: '', rows: rows.sort((a, b) => a.m.start.localeCompare(b.m.start)) };
}
// src/today.js
function nowRow(rows, now) {
  const d = new Date(now || Date.now()), hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), pad = t => (/^\d:/.test(t) ? '0' : '') + t;
  return rows.find(r => pad(r.m.end || r.m.start) > hm) || null;
}
// src/today.js
const keptWhere = m => { const it = cardOfKept(m.id), f = it && findItem(it.id); return { it, cls: f && f.c !== lib.loose ? f.c : null }; };
// src/focus.js
const FC_LENS = [5, 10, 15, 20, 25, 30, 45, 60], FC_BRKS = [3, 5, 10, 15], FC_AWAY = 180e3, FC_DAY = 864e5, FC_KEEP = 400, TK_IDLES = [2, 5, 10, 15], TK_PES = [0, 2, 3, 5, 10];
// src/focus.js
const FC_DOWS = [1, 2, 3, 4, 5, 6, 0];
// src/focus.js
const fcGoalMax = (k, per) => (k === 'min' ? 600 : 500) * (per === 'week' ? 7 : 1);
// src/focus.js
let fcS = { len: 0, open: false, pick: null };   // for this visit only: a length picked on the card, the panel opened by hand, the work picked
// src/focus.js
function fcConf() {
  const f = me().focus || {}, g = f.goal || null;
  return { len: FC_LENS.includes(+f.len) ? +f.len : 10, llen: FC_LENS.includes(+f.llen) ? +f.llen : 45, brk: FC_BRKS.includes(+f.brk) ? +f.brk : 5, sound: f.sound !== false, title: f.title !== false,
    track: f.track !== false, idle: TK_IDLES.includes(+f.idle) ? +f.idle : 5, pe: TK_PES.includes(+f.pe) ? +f.pe : 3,   // pe: minutes of steady work in the Planner before it counts as planning; 0 never
    free: f.free !== false, wk: f.wk === false ? false : [0, 1, 2, 3, 4, 5, 6].includes(f.wk) ? f.wk : 5, quiet: f.quiet === true, short: f.short === true,   // src/gradeplan.js
    sg: f.sg !== false,   // a goal suggested for each session
    music: f.music === true, mood: LOFI_STYLES.some(x => x.id === f.mood) ? f.mood : 'mix', mvol: +f.mvol >= .05 && +f.mvol <= 1 ? +f.mvol : .5, mamb: f.mamb === true,   // lo-fi music while a session runs (src/lofi.js)
    goal: g && (g.k === 'papers' || g.k === 'min') && +g.n > 0 ? { k: g.k, n: Math.min(fcGoalMax(g.k, g.per), Math.round(+g.n)), per: g.per === 'week' ? 'week' : 'day',
      days: g.per !== 'week' && Array.isArray(g.days) && g.days.some(d => FC_DOWS.includes(d)) ? FC_DOWS.filter(d => g.days.includes(d)) : null } : null };
}
// src/focus.js
function fcConfSet(part) {
  const c = { ...fcConf(), ...part }, o = {};
  if (c.len !== 10) o.len = c.len;
  if (c.llen !== 45) o.llen = c.llen;   // a session on planning a lesson
  if (c.brk !== 5) o.brk = c.brk;
  if (c.goal) o.goal = { k: c.goal.k, n: c.goal.n, ...(c.goal.per === 'week' ? { per: 'week' } : {}), ...(c.goal.days && c.goal.days.length < 7 ? { days: c.goal.days } : {}) };
  if (!c.sg) o.sg = false;
  if (!c.sound) o.sound = false;
  if (c.music) o.music = true;
  if (c.mood !== 'mix') o.mood = c.mood;
  if (c.mvol !== .5) o.mvol = c.mvol;
  if (c.mamb) o.mamb = true;
  if (!c.title) o.title = false;
  if (!c.track) o.track = false;
  if (c.idle !== 5) o.idle = c.idle;
  if (c.pe !== 3) o.pe = c.pe;
  if (!c.free) o.free = false;
  if (c.wk !== 5) o.wk = c.wk;
  if (c.quiet) o.quiet = true;
  if (c.short) o.short = true;
  meDrop('focus', Object.keys(o).length ? o : null);
  if (typeof tkShare === 'function') tkShare();
  fcRender();
}
// src/focus.js
const fcPapersToday = () => { fcSeen(); return fcPapersOf(fcLog()); };
// src/focus.js
const fcSecsToday = () => { const d = fcLog().days[fcToday()] || {}, r = fcRun(); return (d.s || 0) + (r && r.k !== 'l' && (r.st === 'run' || r.st === 'paused') ? fcBusy(r) : 0); };   // a lesson isn't grading
// src/focus.js
function fcWeekPapers() {
  const L = fcLog(), today = fcToday(), mon = fcMon(today); return Object.entries(L.days).filter(([k]) => k >= mon && k <= today).reduce((a, [, v]) => a + (v.p || 0), 0);
}
// src/focus.js
function fcWeekMins() {
  const L = fcLog(), today = fcToday(), mon = fcMon(today); return Math.floor((Object.entries(L.days).filter(([k]) => k >= mon && k < today).reduce((a, [, v]) => a + (v.s || 0), 0) + fcSecsToday()) / 60);
}
// src/focus.js
const fcWeekPapersNow = () => { const L = fcLog(), t = (L.days[fcToday()] || {}).p || 0; return fcWeekPapers() - t + fcPapersToday(); };
// src/focus.js
const fcGoalNow = c => !c.goal ? 0 : c.goal.per === 'week' ? (c.goal.k === 'papers' ? fcWeekPapersNow() : fcWeekMins()) : (c.goal.k === 'papers' ? fcPapersToday() : Math.floor(fcSecsToday() / 60));
// src/focus.js
const fcGoalDay = (c, day) => !c.goal || c.goal.per === 'week' || !c.goal.days || c.goal.days.includes(new Date((day || fcToday()) + 'T12:00:00').getDay());
// src/focus.js
const fcRunSet = r => { fcPut(r); fcTickOn(); fcRender(); };
// src/focus.js
const fcElapsed = r => Math.max(0, Math.round(((r.st === 'paused' ? r.pz : Date.now()) - r.at) / 1000));
// src/focus.js
const fcBoot = Date.now();
// src/focus.js
const fcIdle = r => (r.idl || 0) + (r.ii ? Math.max(0, Math.round(((r.st === 'paused' ? r.pz : Date.now()) - r.ii) / 1000)) : 0);
// src/focus.js
const fcBusy = r => Math.max(0, fcElapsed(r) - fcIdle(r));
// src/focus.js
function fcIdleSee(r) {
  if (!/^(mark|les):/.test(r.w || '')) return false;   // a lesson is planned at the screen too (fcLesSecs)
  // r.seen: the last time she did something, written every half minute, so another tab of the app doesn't take her for away
  const a = Math.max(fcBoot, r.at, r.seen || 0, tkReady ? tkLast : 0), lim = fcConf().idle * 60e3;
  if (tkReady && tkLast - (r.seen || 0) > 30e3 && !r.ii) { r.seen = tkLast; return true; }
  if (r.ii && a > r.ii) { r.idl = (r.idl || 0) + Math.round((a - r.ii) / 1000); delete r.ii; return true; }
  if (!r.ii && Date.now() - a > lim) { r.ii = a + lim; return true; }
  return false;
}
// src/focus.js
const fcLeft = r => r.st === 'brk' ? Math.max(0, Math.round((r.brkAt + r.brkLen * 1000 - Date.now()) / 1000)) : Math.max(0, r.len - fcElapsed(r));
// src/focus.js
const fcGot = r => r.got != null ? r.got : Math.max(0, r.pg || 0);
// src/focus.js
const fcN = r => r.one ? Math.max(1, +r.one || 1) : 0;   // papers a "Just one paper" or "Just 3 papers" session is for
// src/focus.js
const fcClock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
// src/focus.js
function fcWorks() {
  const out = [], today = tdToday();
  for (const m of homeGroups().mark) {
    if (!canOpen(m)) continue;
    const st = keptState(m), w = keptWhere(m);
    out.push({ key: 'mark:' + m.id, id: m.id, mark: true, name: m.name || 'Student work', cls: w.cls ? w.cls.name : '', left: st.left, fm: st.fm });
  }
  for (const it of tdItems().filter(it => !it.done && (!it.d || it.d <= today)).sort((a, b) => (a.d || '9').localeCompare(b.d || '9') || (a.made || 0) - (b.made || 0)).slice(0, 12))
    out.push({ key: 'td:' + it.id, id: it.id, name: it.x, cls: it.c && classById(it.c) ? classById(it.c).name : '' });
  return out.concat(fcLessons());
}
// src/focus.js
function fcLessons() {
  if (!plan || document.documentElement.classList.contains('gsphone')) return [];
  const out = [], seen = new Set(), today = tdToday();
  for (let i = 0; i < 7 && out.length < 12; i++) {
    const day = tdAdd(today, i); if ((plan.semStart && day < plan.semStart) || (plan.semEnd && day > plan.semEnd)) continue;
    const t = todayRows(plan, tdAt(day).getTime()), live = i ? null : nowRow(t.rows);
    const when = tdAt(day).toLocaleDateString(LANG_LOCALE, { weekday: 'short', month: 'short', day: 'numeric' });
    for (const r of t.rows) {
      if (!i && (!live || t.rows.indexOf(r) < t.rows.indexOf(live))) continue;   // over already today
      if (!r.lessons.length) out.push({ key: 'les:+' + r.c.id + '|' + day, id: '', les: true, fresh: true, nw: { c: r.c.id, d: day }, name: r.c.name, cls: when });
      for (const l of r.lessons) if (!l.done && !l.ready && !seen.has(l.id)) { seen.add(l.id); out.push({ key: 'les:' + l.id, id: l.id, les: true, name: l.title, cls: r.c.name + ' · ' + when }); }
    }
  }
  return out.slice(0, 12);
}
// src/focus.js
function fcWork(key) {
  if (!key) return null;
  const [k, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  if (k === 'mark') { const m = keptMeta.get(id); if (!m) return null; const st = keptState(m), w = keptWhere(m); return { key, id, mark: true, name: m.name || 'Student work', cls: w.cls ? w.cls.name : '', left: st.left, fm: st.fm }; }
  if (k === 'td') { const it = tdItem(id); return it ? { key, id, name: it.x, cls: it.c && classById(it.c) ? classById(it.c).name : '', done: !!it.done } : null; }
  if (k === 'les') {
    const w = fcLessons().find(x => x.key === key); if (w) return w;
    // a meeting with nothing planned that the week's list left out (it keeps twelve): To do's plan lines can be further down
    const m = /^\+(.+)\|(\d{4}-\d\d-\d\d)$/.exec(id), c = m && plan && plan.classes.find(x => String(x.id) === m[1]);
    if (c) return { key, id: '', les: true, fresh: true, nw: { c: c.id, d: m[2] }, name: c.name, cls: '' };
    // a lesson session going on that isn't in the week's list (the timetable not read yet, or the lesson was just made)
    const r = fcRun(); return r && r.k === 'l' && r.w === key ? { key, id: r.l || '', les: true, name: r.t || 'Lesson', cls: '' } : null;
  }
  return null;
}
// src/focus.js
function fcPicked(works) {
  if (fcS.pick === '') return '';
  if (fcS.pick == null && gpReady && gpFreeNow() && !works.some(w => w.mark && w.left > 0)) {
    const les = works.filter(w => w.les), l = les.find(w => w.fresh) || les[0];
    if (l) return l.key;
  }
  const b = gpReady && fcS.pick == null && gpBack(), want = fcS.pick != null ? fcS.pick : b ? 'mark:' + b.id : fcLog().last;
  return works.some(w => w.key === want) ? want : works.length && !works[0].les ? works[0].key : '';
}
// src/focus.js
const FC_CARRY = 12 * 3600e3;
// src/focus.js
function fcSgSuggest(w, len) {
  const cy = fcLog().carry, key = w ? w.key : '';
  if (cy && cy.w === key && Date.now() - cy.t < FC_CARRY) {
    if (cy.k === 'papers' && w && w.mark && w.left) return { k: 'papers', n: Math.max(1, Math.min(+cy.n || 1, w.left)), c: 1 };
    if (cy.k === 'set' && w && w.mark && w.left) return { k: 'set', c: 1 };
    if (cy.k === 'td' && w && !w.mark && !w.les && !w.done) return { k: 'td', c: 1 };
    if (cy.k === 'note' && !w && cy.x) return { k: 'note', x: String(cy.x).slice(0, 80), c: 1 };
  }
  if (!fcConf().sg || !w || w.les) return null;
  if (!w.mark) return w.done ? null : { k: 'td' };
  if (!w.left) return null;
  const it = cardOfKept(w.id), pace = gpReady ? gpPaces()(it ? it.id : '') : 0;
  if (!pace) return null;
  const n = Math.max(1, Math.round(len * 60 / pace));
  return n >= w.left ? { k: 'set' } : { k: 'papers', n };
}
// src/focus.js
const fcSgNow = (w, len) => fcS.sg !== undefined && fcS.sgw === (w ? w.key : '') ? fcS.sg : fcSgSuggest(w, len);
// src/focus.js
function fcSgN(g, w, len) {
  if (g && g.k === 'papers') return g.n;
  const s = len ? fcSgSuggest(w, len) : null;
  return Math.min(w && w.left || 1, s && s.k === 'papers' ? s.n : 3);
}
// src/focus.js
function fcSgMet(r, w) {
  const g = r.sg; if (!g) return false;
  if (r.sgMet != null) return r.sgMet;
  return g.k === 'papers' ? fcGot(r) >= g.n : g.k === 'set' ? !!w && !!w.mark && !w.left : g.k === 'td' ? !!w && !!w.done : false;
}
// src/focus.js
function fcDaysTo(by) {
  const c = fcConf(), days = c.goal && c.goal.days ? c.goal.days : [1, 2, 3, 4, 5], today = fcToday(), d = new Date(today + 'T12:00:00'); let n = 0;
  for (let i = 0; i < 400 && isoDay(d) <= by; i++, d.setDate(d.getDate() + 1)) if (isoDay(d) === today || days.includes(d.getDay())) n++;
  return Math.max(1, n);
}
// src/focus.js
function fcStart(len, key, one, sg) {
  fcAudioWake();
  if (/^les:/.test(key || '')) return fcLesStart(len, key);
  const was = fcRun(); if (was && (was.st === 'run' || was.st === 'paused')) fcRecord(was);
  const L = fcLog(), w = fcWork(key);
  if (sg === undefined) sg = one ? null : fcSgNow(w, len);
  L.last = key || ''; if (L.carry && L.carry.w === (key || '')) delete L.carry; fcLogSet(L);
  fcS.sg = undefined; fcS.sgw = null;
  const no = ((fcLog().days[fcToday()] || {}).n || 0) + 1;
  fcRunSet({ st: 'run', len: Math.round(len * 60), at: Date.now(), w: key || '', t: w ? String(w.name || '').slice(0, 120) : '', one: one ? Math.max(1, +one || 1) : 0, p0: FC_P0, pg: 0, fold: false, no,
    ...(sg ? { sg: sg.k === 'papers' ? { k: 'papers', n: sg.n } : sg.k === 'note' ? { k: 'note', x: sg.x } : { k: sg.k } } : {}) });
  fcGoTo(false);
}
// src/focus.js
function fcLesStart(len, key) {
  const w = fcWork(key); if (!w) return;
  const was = fcRun(); if (was && (was.st === 'run' || was.st === 'paused')) fcRecord(was);
  fcS.sg = undefined; fcS.sgw = null; fcS.pick = null;
  const P = store.get('gsp.planTime', null), no = ((P && P.days && P.days[fcToday()]) || {}).n || 0;
  fcRunSet({ k: 'l', id: fcRid(), st: 'run', len: Math.round(len * 60), at: Date.now(), w: key, l: w.id || '', t: String(w.name || '').slice(0, 120), ...(w.nw ? { nw: w.nw } : {}), one: 0, fold: false, no: no + 1 });
  fcLesOpen();
}
// src/focus.js
const fcRid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// src/focus.js
function fcPlanAdd(r, secs) {
  if (!(secs > 0)) return;
  const P = store.get('gsp.planTime', null) || {}, days = P.days && typeof P.days === 'object' ? P.days : {}, names = P.names && typeof P.names === 'object' ? P.names : {};
  const ids = Array.isArray(P.ids) ? P.ids.filter(x => typeof x === 'string').slice(-50) : [];
  if (r.id && ids.includes(r.id)) return;   // written already, by the Planner or another tab
  const id = r.l || '', k = fcToday(), d = { ...(days[k] || {}) }, a = { ...(d.a || {}) };
  d.l = (d.l || 0) + secs; a[id] = (a[id] || 0) + secs; d.f = (d.f || 0) + secs; if (secs >= 60 && !r.ext) d.n = (d.n || 0) + 1;
  d.a = a; days[k] = d; if (id && r.t) names[id] = String(r.t).slice(0, 120);
  for (const day of Object.keys(days)) if (Date.now() - new Date(day + 'T12:00:00') > FC_KEEP * FC_DAY) delete days[day];
  const used = new Set(Object.values(days).flatMap(x => Object.keys((x && x.a) || {})));
  for (const n of Object.keys(names)) if (!used.has(n)) delete names[n];
  store.set('gsp.planTime', { days, names, ...(r.id ? { ids: [...ids, r.id] } : {}) });
}
// src/focus.js
function fcLesSecs(r) {
  const last = Math.max(r.at, r.seen || 0), cap = r.st === 'paused' ? Infinity : Math.round((last + FC_LES_IDLE - r.at) / 1000);
  return Math.max(0, Math.min(r.len, fcElapsed(r) - fcIdle(r), cap));
}
// src/focus.js
const FC_LES_IDLE = 20 * 60e3;
// src/focus.js
function fcRecord(r) {
  if (r.secs != null) return r;
  if (r.k === 'l') { const secs = fcLesSecs(r); fcPlanAdd(r, secs); return Object.assign(r, { secs, got: 0 }); }
  const secs = Math.min(r.one ? 4 * 3600 : r.len, fcBusy(r)), got = fcGot(r), L = fcLog(), today = fcToday(), d = L.days[today] || {};
  L.days[today] = { ...d, s: (d.s || 0) + secs, ...(/^mark:/.test(r.w || '') ? { sm: (d.sm || 0) + secs } : {}), ...(secs >= 60 && !r.ext ? { n: (d.n || 0) + 1 } : {}) };
  if (got > 0 && secs >= 30) L.pace = [...L.pace, [secs, got]].slice(-20);
  Object.assign(r, { secs, got });
  // A goal not reached goes into the next session on the same work, while there is something left of it.
  const g = r.sg, w = g ? fcWork(r.w) : null;
  if (g && !fcSgMet(r, w) && (g.k === 'note' || (w && (w.mark ? w.left : !w.done)))) L.carry = { w: r.w || '', t: Date.now(), k: g.k, ...(g.k === 'papers' ? { n: Math.max(1, g.n - got) } : g.k === 'note' ? { x: g.x } : {}) };
  else if (L.carry && L.carry.w === (r.w || '')) delete L.carry;
  fcLogSet(L);
  return r;
}
// src/focus.js
function fcExt(min) {
  const r = fcRun(); if (!r || r.st !== 'up') return;
  const L = fcLog(), w = fcWork(r.w), g = r.sg && !fcSgMet(r, w) ? (r.sg.k === 'papers' ? { k: 'papers', n: Math.max(1, r.sg.n - (r.got || 0)) } : r.sg) : null;
  if (L.carry && L.carry.w === (r.w || '')) { delete L.carry; fcLogSet(L); }
  fcRunSet({ ...(r.k === 'l' ? { k: 'l', id: fcRid(), l: r.l || '', ...(r.nw ? { nw: r.nw } : {}) } : {}), st: 'run', len: min * 60, at: Date.now(), w: r.w || '', t: r.t || '', one: 0, p0: FC_P0, pg: 0, fold: false, no: r.no, ext: 1, ...(g ? { sg: g } : {}) });
}
// src/focus.js
function fcUp(r) { fcRecord(r); r.st = 'up'; r.fold = false; fcRunSet(r); fcChime(); }
// src/focus.js
function fcPause() { const r = fcRun(); if (!r || r.st !== 'run') return; r.st = 'paused'; r.pz = Date.now(); r.idl = fcIdle(r); delete r.ii; fcRunSet(r); }
// src/focus.js
function fcResume() { const r = fcRun(); if (!r || r.st !== 'paused') return; r.at += Date.now() - r.pz; delete r.pz; r.st = 'run'; fcRunSet(r); }
// src/focus.js
function fcMore(min) { const r = fcRun(); if (!r) return; if (r.st === 'run' || r.st === 'paused') { r.len += min * 60; fcRunSet(r); } }
// src/focus.js
function fcBreak() { const r = fcRun(); if (!r) return; fcAudioWake(); if (r.st === 'run' || r.st === 'paused') fcRecord(r); fcRunSet({ ...r, st: 'brk', brkAt: Date.now(), brkLen: fcConf().brk * 60, fold: false }); }
// src/focus.js
function fcStop() { const r = fcRun(); if (!r) return; if (r.st === 'run' || r.st === 'paused') fcRecord(r); fcRunSet({ ...r, st: 'done', fold: false }); }
// src/focus.js
function fcClose() { fcS.open = false; const r = fcRun(); if (r && (r.st === 'done' || r.st === 'brkup' || r.st === 'up')) fcRunSet(null); else fcRender(); }
// src/focus.js
let fcTimer = 0;
// src/focus.js
function fcTickOn() {
  const r = fcRun(), on = !!r && (r.st === 'run' || r.st === 'brk');
  if (on && !fcTimer) fcTimer = setInterval(fcTick, 1000);
  if (!on && fcTimer) { clearInterval(fcTimer); fcTimer = 0; }
  fcTitle();
}
// src/focus.js
function fcTick() {
  const r = fcOwnRun(fcRun()); if (!r) return fcTickOn();
  if (r.st === 'run') {
    if (r.one ? fcGot(r) >= fcN(r) : fcLeft(r) <= 0) return fcUp(r);
    if (fcIdleSee(r)) fcPut(r);
  } else if (r.st === 'brk' && fcLeft(r) <= 0) { r.st = 'brkup'; r.fold = false; fcRunSet(r); fcChime(); return; }
  fcClockDraw(); fcTitle();
}
// src/focus.js
const fcFrac = r => r.st === 'brk' ? fcLeft(r) / (r.brkLen || 1) : r.one ? 1 : fcLeft(r) / (r.len || 1);
// src/focus.js
function focusOn(key) { const c = fcConf(); fcStart(/^les:/.test(key || '') ? c.llen : c.len, key, false); }
// src/focus.js
const FC_Q = 'gsp.focusQ';
// src/focus.js
function fcDrain() {
  const q = store.get(FC_Q, null); if (!Array.isArray(q)) return;
  store.del(FC_Q);
  // each entry has an id, kept for a while, so two tabs reading the queue at once write it in once
  const L = fcLog(), had = Array.isArray(L.qd) ? L.qd : [];
  for (const x of q) {
    if (x && x.id && had.includes(x.id)) continue;
    if (x && x.id) had.push(x.id);
    if (!x || !/^\d{4}-\d\d-\d\d$/.test(x.d) || !(x.s > 0)) continue;
    const s = Math.min(4 * 3600, Math.round(x.s)), d = L.days[x.d] || {};
    L.days[x.d] = { ...d, s: (d.s || 0) + s, ...(x.m ? { sm: (d.sm || 0) + s } : {}), ...(s >= 60 && !x.x ? { n: (d.n || 0) + 1 } : {}) };
    if (x.got > 0 && s >= 30) L.pace = [...L.pace, [s, x.got]].slice(-20);
  }
  L.qd = had.slice(-50);
  fcLogSet(L);
}
// src/tracker.js
let tkLast = 0, tkPend = { g: 0, a: {} }, tkFlushed = Date.now(), tkTimer = 0;
// src/tracker.js
function tkFlush() {
  if (!tkReady) return;
  tkFlushed = Date.now();
  if (!tkPend.g) return;
  const L = fcLog(), today = fcToday(), d = { ...(L.days[today] || {}) }, a = { ...(d.a || {}) };
  // the first time counted on a day that already had focus sessions: they were grading, so the day starts from them
  if (d.g == null && d.s) { d.g = d.sm != null ? d.sm : d.s; a[''] = (a[''] || 0) + d.g; }
  d.g = (d.g || 0) + tkPend.g;
  for (const [k, v] of Object.entries(tkPend.a)) a[k] = (a[k] || 0) + v;
  d.a = a; L.days[today] = d; fcLogSet(L);
  tkPend = { g: 0, a: {} };
  if (routeNow().v === 'time') tkPageRender();
  if (batch) renderProg();
}
// src/tracker.js
function tkShare() {
  const c = fcConf(), v = JSON.stringify({ on: !!c.track, idle: c.idle, pe: c.pe, len: c.len, llen: c.llen, brk: c.brk, sound: c.sound, title: c.title, music: c.music, mood: c.mood, mvol: c.mvol, mamb: c.mamb });
  try { if (localStorage.getItem('gsp.timeCount') !== v) localStorage.setItem('gsp.timeCount', v); } catch { }
}
// src/tracker.js
function tkPlan() {
  const P = store.get('gsp.planTime', null) || {};
  return { days: P.days && typeof P.days === 'object' ? P.days : {}, names: P.names && typeof P.names === 'object' ? P.names : {} };
}
// src/tracker.js
function tkDay(k, L, P) {
  const d = L.days[k] || {}, pd = P.days[k] || {}, hand = L.add.filter(x => x.d === k);
  const hg = hand.filter(x => x.k === 'g').reduce((s, x) => s + x.s, 0), hl = hand.filter(x => x.k === 'l').reduce((s, x) => s + x.s, 0);
  const auto = d.g != null ? Math.max(d.g, d.sm || 0) : (d.s || 0);
  const ga = d.g != null ? { ...(d.a || {}) } : d.s ? { '': d.s } : {};
  if (d.g != null && auto > d.g) ga[''] = (ga[''] || 0) + auto - d.g;
  return { k, g: auto + hg, l: (pd.l || 0) + hl, hg, hl, p: d.p || 0, pa: d.pa || {}, s: (d.s || 0) + (pd.f || 0), ga, la: pd.a || {}, hand };   // s: focus time, grading sessions and sessions on a lesson
}
// src/tracker.js
const tkYmd = d => isoDay(d.getTime());
// src/tracker.js
const tkDate = (k, o) => new Date(k + 'T12:00:00').toLocaleDateString(LANG_LOCALE, o);
// src/tracker.js
function tkMonday(d) { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
// src/tracker.js
function tkAdd(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
// src/tracker.js
function tkPeriod(range, off) {
  const now = new Date(); now.setHours(12, 0, 0, 0);
  let from, to, groups;
  if (range === 'month') {
    from = new Date(now.getFullYear(), now.getMonth() + off, 1, 12); to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 12);
  } else if (range === 'quarter') {
    to = tkAdd(tkMonday(now), 6 + off * 91); from = tkAdd(to, -90);
  } else { from = tkAdd(tkMonday(now), off * 7); to = tkAdd(from, 6); }
  const days = []; for (let d = new Date(from); d <= to; d = tkAdd(d, 1)) days.push(tkYmd(d));
  if (range === 'quarter') { groups = []; for (let i = 0; i < days.length; i += 7) groups.push(days.slice(i, i + 7)); } else groups = days.map(k => [k]);
  const label = range === 'month' ? from.toLocaleDateString(LANG_LOCALE, { month: 'long', year: 'numeric' })
    : tkDate(days[0], { month: 'short', day: 'numeric' }) + ' – ' + tkDate(days[days.length - 1], { month: 'short', day: 'numeric', ...(from.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
  return { days, groups, label, from: days[0], to: days[days.length - 1] };
}
// src/tracker.js
function tkSum(days, L, P) {
  const t = { g: 0, l: 0, p: 0, s: 0, ga: {}, la: {}, pa: {}, list: [] };
  for (const k of days) {
    const d = tkDay(k, L, P); t.list.push(d);
    t.g += d.g; t.l += d.l; t.p += d.p; t.s += d.s;
    for (const [a, v] of Object.entries(d.ga)) t.ga[a] = (t.ga[a] || 0) + v;
    for (const [a, v] of Object.entries(d.la)) t.la[a] = (t.la[a] || 0) + v;
    for (const [a, v] of Object.entries(d.pa)) t.pa[a] = (t.pa[a] || 0) + v;
  }
  return t;
}
// src/tracker.js
function tkDur(secs) {
  const m = Math.round(secs / 60), h = Math.floor(m / 60), r = m % 60;
  const u = (n, unit) => { try { return new Intl.NumberFormat(LANG_LOCALE, { style: 'unit', unit, unitDisplay: 'short' }).format(n); } catch { return n + (unit === 'hour' ? ' h' : ' min'); } };
  return h ? u(h, 'hour') + (r ? ' ' + u(r, 'minute') : '') : u(m, 'minute');
}
// src/tracker.js
function tkCsvText() {
  tkFlush();
  const L = fcLog(), P = tkPlan(), keys = [...new Set([...Object.keys(L.days), ...Object.keys(P.days), ...L.add.map(x => x.d)])].sort();
  const rows = [['Date', 'Grading minutes', 'Planning minutes', 'Focus minutes', 'Papers', 'Grading added by hand', 'Planning added by hand']];
  for (const k of keys) { const d = tkDay(k, L, P); if (d.g || d.l || d.s || d.p) rows.push([k, Math.round(d.g / 60), Math.round(d.l / 60), Math.round(d.s / 60), d.p, Math.round(d.hg / 60), Math.round(d.hl / 60)]); }
  return rows.map(r => r.join(',')).join('\r\n') + '\r\n';
}
// src/tracker.js
function tkAddTime(d, k, min, x) {
  const L = fcLog(); L.add = [...L.add, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), d, k, s: Math.round(min * 60), x: String(x || '').slice(0, 80) }];
  fcLogSet(L);
}
// src/tracker.js
function tkAsg(id) {
  if (!id || !tkReady) return null;
  const L = fcLog(); let s = 0, p = 0;
  for (const d of Object.values(L.days)) { if (!d) continue; if (d.a && d.a[id]) s += d.a[id]; if (d.pa && d.pa[id]) p += d.pa[id]; }
  return { s: s + (tkPend.a[id] || 0), p };
}
// src/gradeplan.js
const GP_FREE = 20, GP_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// src/gradeplan.js
let gpMemo = null;
// src/gradeplan.js
function gpMemoOf(k, f) { if (!gpMemo) { gpMemo = {}; queueMicrotask(() => { gpMemo = null; }); } return k in gpMemo ? gpMemo[k] : (gpMemo[k] = f()); }
// src/gradeplan.js
const gpPaceN = id => { const t = tkReady && tkAsg(id); return t && t.s > 0 ? t.p : 0; };
// src/gradeplan.js
const gpPaces = () => id => { const t = tkReady && tkAsg(id); return t && t.s > 0 && t.p > 0 ? t.s / t.p : 0; };
// src/gradeplan.js
function gpKept() {
  return gpMemoOf('kept', () => {
    const by = new Map();
    for (const m of keptMeta.values()) { if (!m || (m.newer && keptMeta.has(m.newer))) continue; const it = cardOfKept(m.id); if (it && (!by.has(it.id) || by.get(it.id).t < m.t)) by.set(it.id, m); }
    return by;
  });
}
// src/gradeplan.js
function gpLeft(id) {
  if (!gpReady || !id) return 0;
  const m = gpKept().get(id); if (!m || keptBack(m)) return 0;
  return keptState(m).left * gpPaces()(id);
}
// src/gradeplan.js
function gpDue(from, to, except) {
  const by = gpKept(), pace = gpPaces(), today = fcToday(), out = [];
  for (const c of lib.classes) for (const u of c.units || []) for (const it of u.items || []) {
    if (!it.due || it.due < from || it.due > to || it.id === except || it.typed && !it.batchId || it.type === 'xc') continue;
    const m = by.get(it.id); let left = 0;
    if (m) { if (keptBack(m)) continue; left = keptState(m).left; } else if (it.due >= today && !it.batchId) left = (c.names || []).length;
    if (left > 0) out.push({ it, c, left, secs: left * pace(it.id), inn: !!m });
  }
  return out.sort((a, b) => a.it.due.localeCompare(b.it.due));
}
// src/gradeplan.js
const gpSum = list => list.reduce((a, x) => ({ n: a.n + 1, p: a.p + x.left, s: a.s < 0 || !(x.secs > 0) ? -1 : a.s + x.secs }), { n: 0, p: 0, s: 0 });
// src/gradeplan.js
const gpMon = fcMon;
// src/gradeplan.js
const gpAdd = (day, n) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDay(d.getTime()); };
// src/gradeplan.js
const gpMins = t => { const m = /^(\d{1,2}):(\d\d)$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
// src/gradeplan.js
function gpGaps(rows) {
  const out = [];
  for (let i = 0; i + 1 < rows.length; i++) { const a = gpMins(rows[i].m.end), b = gpMins(rows[i + 1].m.start); if (a != null && b != null && b - a >= GP_FREE) out.push({ i, a, b, from: rows[i].m.end, to: rows[i + 1].m.start }); }
  return out;
}
// src/gradeplan.js
function gpFreeNow() {
  if (!gpReady || !fcConf().free || typeof plan === 'undefined' || !plan) return null;
  const t = todayRows(plan); if (t.off) return null;
  const d = new Date(), now = d.getHours() * 60 + d.getMinutes();
  return gpGaps(t.rows).find(g => now >= g.a && now < g.b - 5) || null;
}
// src/gradeplan.js
const gpFreeLen = f => { const d = new Date(), left = f.b - (d.getHours() * 60 + d.getMinutes()); return Math.max(5, Math.min(60, Math.floor((left - 5) / 5) * 5)); };
// src/gradeplan.js
function gpBack() {
  if (!gpReady) return null;
  const m = homeGroups().mark.filter(x => canOpen(x) && keptState(x).left && (keptState(x).done || x.partial)).sort((a, b) => b.t - a.t)[0];
  return m && Date.now() - m.t > 20 * 60e3 && Date.now() - m.t < 7 * 864e5 && !(batch && batch.id === m.id && !$('#app').hidden) ? m : null;
}
// src/gradeplan.js
function gpPlanWeek() {
  if (!gpReady || typeof plan === 'undefined' || !plan || document.documentElement.classList.contains('gsphone')) return null;
  const mon = gpAdd(gpMon(fcToday()), 7), out = { of: 0, planned: 0, ready: 0, dots: [] };
  if ((plan.semStart && gpAdd(mon, 6) < plan.semStart) || (plan.semEnd && mon > gpMon(plan.semEnd))) return out;
  for (let i = 0; i < 7; i++) {
    const day = gpAdd(mon, i); if (plan.semStart && day < plan.semStart) continue;
    for (const r of todayRows(plan, new Date(day + 'T12:00:00').getTime()).rows) {
      const p = r.lessons.length > 0, ok = r.lessons.some(l => l.ready || l.done);
      out.of++; if (p) out.planned++; if (ok) out.ready++;
      out.dots.push(ok ? 2 : p ? 1 : 0);
    }
  }
  return out;
}
// src/gradeplan.js
function gpLesWorked(id) {
  if (!id || typeof tkPlan !== 'function') return 0;
  const from = gpAdd(fcToday(), -13); let s = 0;
  for (const [day, d] of Object.entries(tkPlan().days)) if (day >= from && d && d.a && d.a[id]) s += +d.a[id] || 0;
  return s;
}
// src/gradeplan.js
function gpLesPace() {
  if (typeof plan === 'undefined' || !plan || typeof tkPlan !== 'function') return 0;
  const days = Object.values(tkPlan().days), tot = id => days.reduce((s, d) => s + (d && d.a && +d.a[id] || 0), 0);
  const xs = (plan.ready || []).slice().sort((a, b) => b.at - a.at).map(x => tot(x.id)).filter(s => s >= 60).slice(0, 10);
  if (xs.length < 3) return 0;
  const o = xs.sort((a, b) => a - b), h = o.length >> 1;
  return o.length % 2 ? o[h] : (o[h - 1] + o[h]) / 2;
}
export { FC_LENS, FC_BRKS, FC_AWAY, TK_IDLES, TK_PES, FC_DOWS, fcGoalMax, fcConf, fcConfSet, fcPapersToday, fcSecsToday, fcWeekPapers, fcWeekMins, fcWeekPapersNow, fcGoalNow, fcGoalDay, fcRunSet, fcElapsed, fcIdle, fcBusy, fcLeft, fcGot, fcN, fcClock, fcWorks, fcWork, fcPicked, fcSgSuggest, fcSgNow, fcSgN, fcSgMet, fcDaysTo, fcStart, fcLesStart, fcPlanAdd, fcLesSecs, fcRecord, fcExt, fcPause, fcResume, fcMore, fcBreak, fcStop, fcClose, fcTick, fcTickOn, fcDrain, fcUp, focusOn, fcS, fcFrac, tkPlan, tkDay, tkPeriod, tkSum, tkDur, tkAsg, tkAddTime, tkCsvText, tkFlush, tkShare, tkMonday, tkYmd, gpPaces, gpPaceN, gpKept, gpLeft, gpDue, gpSum, gpGaps, gpFreeNow, gpFreeLen, gpBack, gpPlanWeek, gpLesWorked, gpLesPace, gpAdd };
