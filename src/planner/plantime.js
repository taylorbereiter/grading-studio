/* ---------- Planning time, for the grading app's time tracker (src/tracker.js) ----------
   While the Planner is the tab in front and something was pressed, typed or scrolled in the last few minutes, the time counts as
   planning: to the lesson that is open, or to '' (the week, the units, the bank). Presenting a lesson is teaching, so it doesn't count.
   Kept in gsp.planTime: { days: { 'YYYY-MM-DD': { l: seconds, a: { <lesson id> | '': seconds } } }, names: { <lesson id>: title } },
   for 400 days. The grading app's Settings, Focus and goals can switch it off and say how soon it stops: the grading app copies those two
   into gsp.timeCount { on, idle }, so the Planner reads only its own keys. */
// The lesson editor can draw before this file has run (a reload straight onto a lesson), so ptReady, a var, guards the badge.
var ptReady = false;
const PT_STEP = 15, PT_FLUSH = 60e3;
let ptLast = 0, ptMoved = 0, ptPend = { l: 0, a: {}, n: {} }, ptFlushed = Date.now();
for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'input']) document.addEventListener(ev, () => { ptLast = Date.now(); }, { capture: true, passive: true });
document.addEventListener('pointermove', () => { const t = Date.now(); if (t - ptMoved > 5000) { ptMoved = t; ptLast = t; } }, { capture: true, passive: true });
function ptConf() {
  let f = {}; try { f = JSON.parse(localStorage.getItem('gsp.timeCount') || 'null') || {}; } catch { }
  return { on: f.on !== false, idle: [2, 5, 10, 15].includes(+f.idle) ? +f.idle : 5 };
}
const ptDay = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function ptTick() {
  const c = ptConf();
  if (c.on && !PR.on && document.visibilityState === 'visible' && document.hasFocus() && Date.now() - ptLast < c.idle * 60e3) {
    const l = L.view === 'edit' && L.open ? L.open : null, k = l ? l.id : '';
    ptPend.l += PT_STEP; ptPend.a[k] = (ptPend.a[k] || 0) + PT_STEP;
    if (l) ptPend.n[k] = String(l.title || '').slice(0, 120);
  }
  if (Date.now() - ptFlushed >= PT_FLUSH) ptFlush();
  ptBadgeDraw();
}
function ptFlush() {
  ptFlushed = Date.now();
  if (!ptPend.l) return;
  let P = null; try { P = JSON.parse(localStorage.getItem('gsp.planTime') || 'null'); } catch { }
  P = P && typeof P === 'object' ? P : {};
  const days = P.days && typeof P.days === 'object' ? P.days : {}, names = P.names && typeof P.names === 'object' ? P.names : {}, k = ptDay();
  const d = { ...(days[k] || {}) }, a = { ...(d.a || {}) };
  d.l = (d.l || 0) + ptPend.l;
  for (const [id, v] of Object.entries(ptPend.a)) a[id] = (a[id] || 0) + v;
  d.a = a; days[k] = d;
  for (const [id, t] of Object.entries(ptPend.n)) if (t) names[id] = t;
  for (const day of Object.keys(days)) if (Date.now() - new Date(day + 'T12:00:00') > 400 * 864e5) delete days[day];
  const used = new Set(Object.values(days).flatMap(x => Object.keys((x && x.a) || {})));
  for (const id of Object.keys(names)) if (!used.has(id)) delete names[id];
  try { localStorage.setItem('gsp.planTime', JSON.stringify({ days, names })); } catch { }
  ptPend = { l: 0, a: {}, n: {} };
}
// The time this lesson has had, beside its name in the editor: what is written down, and what is waiting to be.
function ptLessonSecs(id) {
  if (!ptReady) return 0;
  let P = null; try { P = JSON.parse(localStorage.getItem('gsp.planTime') || 'null'); } catch { }
  let s = ptPend.a[id] || 0;
  for (const d of Object.values((P && P.days) || {})) if (d && d.a && d.a[id]) s += d.a[id];
  return s;
}
function ptSay(secs) { const m = Math.round(secs / 60), h = Math.floor(m / 60); return h ? h + ' hr' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min'; }
function ptBadge(l) {
  const s = l && l.id ? ptLessonSecs(l.id) : 0;
  return '<span class="savest ls-ptime" id="lsTime" title="Time spent planning this lesson, counted while it is open"' + (s < 60 ? ' hidden' : '') + '>' + (s >= 60 ? ptSay(s) + ' planning' : '') + '</span>';
}
function ptBadgeDraw() { const el = document.getElementById('lsTime'); if (!el || !L.open) return; const s = ptLessonSecs(L.open.id); el.hidden = s < 60; el.textContent = s >= 60 ? ptSay(s) + ' planning' : ''; }
setInterval(ptTick, PT_STEP * 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') ptFlush(); });
window.addEventListener('pagehide', ptFlush);
window.addEventListener('blur', ptFlush);
window.__plantime = { tick: ptTick, flush: ptFlush, lessonSecs: ptLessonSecs, active: () => { ptLast = Date.now(); }, pend: () => ptPend };
ptReady = true;
