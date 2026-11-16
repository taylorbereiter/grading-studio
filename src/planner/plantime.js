/* ---------- Planning time, for the grading app's time tracker (src/tracker.js) ----------
   Planning time counts only in a focus session on a lesson (src/planner/plfocus.js here, src/focus.js on the grading page): opening a
   lesson to change it before class, or presenting it, isn't planning. A session's minutes are written when it ends, into
   gsp.planTime: { days: { 'YYYY-MM-DD': { l: seconds, a: { <lesson id> | '': seconds }, f: seconds in focus sessions, n: sessions } },
   names: { <lesson id>: title } }, for 400 days. Days from before this kept the time the Planner was open; they stay as they were.
   This file shows a lesson's own planning time beside its name in the editor. */
// The lesson editor can draw before this file has run (a reload straight onto a lesson), so ptReady, a var, guards the badge.
var ptReady = false;
const PT_STEP = 15;
function ptPlan() { try { const P = JSON.parse(localStorage.getItem('gsp.planTime') || 'null'); return P && typeof P === 'object' ? P : {}; } catch { return {}; } }
// The time this lesson has had: what is written down, and the session on it going on now.
function ptLessonSecs(id) {
  if (!ptReady || !id) return 0;
  let s = 0;
  for (const d of Object.values(ptPlan().days || {})) if (d && d.a && d.a[id]) s += d.a[id];
  const r = pfReady ? pfRun() : null;   // src/planner/plfocus.js, which runs after this file
  if (r && r.k === 'l' && r.l === id && (r.st === 'run' || r.st === 'paused')) s += Math.min(r.len, pfElapsed(r));
  return s;
}
function ptSay(secs) { const m = Math.round(secs / 60), h = Math.floor(m / 60); return h ? h + ' hr' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min'; }
function ptBadge(l) {
  const s = l && l.id ? ptLessonSecs(l.id) : 0;
  return '<span class="savest ls-ptime" id="lsTime" title="Time spent planning this lesson in focus sessions"' + (s < 60 ? ' hidden' : '') + '>' + (s >= 60 ? ptSay(s) + ' planning' : '') + '</span>';
}
function ptBadgeDraw() { const el = document.getElementById('lsTime'); if (!el || !L.open) return; const s = ptLessonSecs(L.open.id); el.hidden = s < 60; el.textContent = s >= 60 ? ptSay(s) + ' planning' : ''; }
function ptTick() { ptBadgeDraw(); }
setInterval(ptTick, PT_STEP * 1000);
window.__plantime = { tick: ptTick, lessonSecs: ptLessonSecs };
ptReady = true;
