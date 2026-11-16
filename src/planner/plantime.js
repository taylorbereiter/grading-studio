/* ---------- Planning time, for the grading app's time tracker (src/tracker.js) ----------
   Planning time counts in two ways. A focus session on a lesson (src/planner/plfocus.js here, src/focus.js on the grading page)
   counts all of its minutes when it ends. Outside a session, steady work in the Planner counts too, but only once it has gone on
   for a few minutes (the teacher's choice, 3 unless changed; or never): a quick change before class is not planning. Steady means
   something typed or clicked at least every PT_GAP until then; after that it carries on until nothing has been done for the
   tracker's own idle time. A run that stops before it reaches those minutes counts nothing. None of it counts while a lesson is
   being presented, while a focus session on a lesson is going on (that session counts it), or during one of the teacher's classes
   on the timetable.
   Kept in gsp.planTime: { days: { 'YYYY-MM-DD': { l: seconds, a: { <lesson id> | '': seconds }, f: seconds in focus sessions, n: sessions } },
   names: { <lesson id>: title } }, for 400 days. The grading app copies the settings into gsp.timeCount { pe: minutes, 0 for never,
   idle }, so the Planner reads only its own keys. This file also shows a lesson's own planning time beside its name in the editor. */
// The lesson editor can draw before this file has run (a reload straight onto a lesson), so ptReady, a var, guards the badge.
var ptReady = false;
const PT_STEP = 15, PT_FLUSH = 60e3, PT_GAP = 90e3;
let ptLast = 0, ptRun = { s: 0, a: {}, n: {}, live: false }, ptPend = { l: 0, a: {}, n: {} }, ptFlushed = Date.now();
// Only doing something counts as working: typing, clicking, pasting or dropping. Scrolling or moving the pointer is reading.
for (const ev of ['pointerdown', 'keydown', 'input', 'paste', 'drop']) document.addEventListener(ev, () => { ptLast = Date.now(); }, { capture: true, passive: true });
function ptPlan() { try { const P = JSON.parse(localStorage.getItem('gsp.planTime') || 'null'); return P && typeof P === 'object' ? P : {}; } catch { return {}; } }
function ptConf() {
  let f = {}; try { f = JSON.parse(localStorage.getItem('gsp.timeCount') || 'null') || {}; } catch { }
  return { pe: [0, 2, 3, 5, 10].includes(+f.pe) ? +f.pe : 3, idle: [2, 5, 10, 15].includes(+f.idle) ? +f.idle : 5 };
}
const ptMin = s => { const m = /^(\d{1,2}):(\d\d)/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
// One of the teacher's classes is meeting now, by the timetable.
function ptInClass(d) {
  d = d || new Date();
  const now = d.getHours() * 60 + d.getMinutes();
  return meetingsOn(ymd(d)).some(x => { const a = ptMin(x.m.start), b = ptMin(x.m.end); return a != null && b != null && a <= now && now < b; });
}
function ptLessonFocus() { const r = pfReady ? pfRun() : null; return !!(r && r.k === 'l' && (r.st === 'run' || r.st === 'paused')); }
function ptEnd() { ptRun = { s: 0, a: {}, n: {}, live: false }; }
function ptAdd(to, k, secs, title) { to.a[k] = (to.a[k] || 0) + secs; if (title) to.n[k] = title; }
function ptTick() {
  const c = ptConf(), t = Date.now();
  const may = c.pe && !PR.on && document.visibilityState === 'visible' && document.hasFocus() && !ptLessonFocus() && !ptInClass();
  if (!may || t - ptLast >= (ptRun.live ? c.idle * 60e3 : PT_GAP)) ptEnd();
  else {
    const l = L.view === 'edit' && L.open ? L.open : null, k = l ? l.id : '', title = l ? String(l.title || '').slice(0, 120) : '';
    if (ptRun.live) { ptPend.l += PT_STEP; ptAdd(ptPend, k, PT_STEP, title); }
    else {
      ptRun.s += PT_STEP; ptAdd(ptRun, k, PT_STEP, title);
      if (ptRun.s >= c.pe * 60) {   // long enough: all of it counts, and from now on each step does
        ptPend.l += ptRun.s;
        for (const [id, v] of Object.entries(ptRun.a)) ptAdd(ptPend, id, v, ptRun.n[id]);
        ptRun = { s: 0, a: {}, n: {}, live: true };
      }
    }
  }
  if (t - ptFlushed >= PT_FLUSH) ptFlush();
  ptBadgeDraw();
}
function ptFlush() {
  ptFlushed = Date.now();
  if (!ptPend.l) return;
  const P = ptPlan(), days = P.days && typeof P.days === 'object' ? P.days : {}, names = P.names && typeof P.names === 'object' ? P.names : {}, k = ymd(new Date());
  const d = { ...(days[k] || {}) }, a = { ...(d.a || {}) };
  d.l = (d.l || 0) + ptPend.l;
  for (const [id, v] of Object.entries(ptPend.a)) a[id] = (a[id] || 0) + v;
  d.a = a; days[k] = d;
  for (const [id, t] of Object.entries(ptPend.n)) if (t) names[id] = t;
  for (const day of Object.keys(days)) if (Date.now() - new Date(day + 'T12:00:00') > 400 * 864e5) delete days[day];
  const used = new Set(Object.values(days).flatMap(x => Object.keys((x && x.a) || {})));
  for (const id of Object.keys(names)) if (!used.has(id)) delete names[id];
  try { localStorage.setItem('gsp.planTime', JSON.stringify({ ...P, days, names })); } catch { }
  ptPend = { l: 0, a: {}, n: {} };
}
// The time this lesson has had: what is written down, what is waiting to be, and the focus session on it going on now.
function ptLessonSecs(id) {
  if (!ptReady || !id) return 0;
  let s = ptPend.a[id] || 0;
  for (const d of Object.values(ptPlan().days || {})) if (d && d.a && d.a[id]) s += d.a[id];
  const r = pfReady ? pfRun() : null;   // src/planner/plfocus.js, which runs after this file
  if (r && r.k === 'l' && r.l === id && (r.st === 'run' || r.st === 'paused')) s += Math.min(r.len, pfElapsed(r));
  return s;
}
function ptSay(secs) { const m = Math.round(secs / 60), h = Math.floor(m / 60); return h ? h + ' hr' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min'; }
function ptBadge(l) {
  const s = l && l.id ? ptLessonSecs(l.id) : 0;
  return '<span class="savest ls-ptime" id="lsTime" title="Time spent planning this lesson"' + (s < 60 ? ' hidden' : '') + '>' + (s >= 60 ? ptSay(s) + ' planning' : '') + '</span>';
}
function ptBadgeDraw() { const el = document.getElementById('lsTime'); if (!el || !L.open) return; const s = ptLessonSecs(L.open.id); el.hidden = s < 60; el.textContent = s >= 60 ? ptSay(s) + ' planning' : ''; }
setInterval(ptTick, PT_STEP * 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') ptFlush(); });
window.addEventListener('pagehide', ptFlush);
window.addEventListener('blur', ptFlush);
window.__plantime = { tick: ptTick, flush: ptFlush, lessonSecs: ptLessonSecs, active: ago => { ptLast = Date.now() - (ago || 0); }, pend: () => ptPend, run: () => ptRun, inClass: ptInClass };
ptReady = true;
