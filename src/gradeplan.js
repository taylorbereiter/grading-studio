/* ---------- Planning your grading: how long the papers will take, free periods, picking up where she left off, small starts, a look
   back at the week, and quiet while focusing. Built on the focus timer (src/focus.js) and the time tracker (src/tracker.js).
   Settings are in lib.me.focus with the timer's: free (false: no free periods), wk (the day of the look-back, 0 Sunday to 6 Saturday,
   or false), quiet (true: counts hidden during a session), short (true: shortest papers first). The only thing stored here is
   gs.focus.lbHid, the Monday of the week whose look-back was put away. No names: assignment names, class names and times only. */
// Other screens can draw before this file has run, so each way in waits for gpReady, a var that reads false until the last line.
var gpReady = false;
const GP_FREE = 20, GP_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ---------- the teacher's pace ---------- */
// Seconds a paper takes on one assignment: all the time counted on it over all its papers finished, from its own papers only. Nothing
// is borrowed from other assignments: before its first paper there is no time, only the number of papers. gpPaceN says how many
// papers it comes from, so one from fewer than three can be called rough.
// Worked out once for each drawing: what is kept for one pass is dropped as soon as the code drawing it has finished.
let gpMemo = null;
function gpMemoOf(k, f) { if (!gpMemo) { gpMemo = {}; queueMicrotask(() => { gpMemo = null; }); } return k in gpMemo ? gpMemo[k] : (gpMemo[k] = f()); }
// The same sums as the tracker's line on the assignment (tkAsg), so the two never disagree.
const gpPaceN = id => { const t = tkReady && tkAsg(id); return t && t.s > 0 ? t.p : 0; };
const gpPaces = () => id => { const t = tkReady && tkAsg(id); return t && t.s > 0 && t.p > 0 ? t.s / t.p : 0; };
// The newest set of papers kept for each assignment.
function gpKept() {
  return gpMemoOf('kept', () => {
    const by = new Map();
    for (const m of keptMeta.values()) { if (!m || (m.newer && keptMeta.has(m.newer))) continue; const it = cardOfKept(m.id); if (it && (!by.has(it.id) || by.get(it.id).t < m.t)) by.set(it.id, m); }
    return by;
  });
}
// Seconds still to go on one assignment's papers at her pace, or 0.
function gpLeft(id) {
  if (!gpReady || !id) return 0;
  const m = gpKept().get(id); if (!m || keptBack(m)) return 0;
  return keptState(m).left * gpPaces()(id);
}
// What is due between two days and still to grade: papers left in a set that is in, or the whole class for work not in yet that is
// due today or later. Typed-in scores and extra credit take no grading.
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
// A total in time only when every set in it has a pace of its own; else -1, and the papers are said instead.
const gpSum = list => list.reduce((a, x) => ({ n: a.n + 1, p: a.p + x.left, s: a.s < 0 || !(x.secs > 0) ? -1 : a.s + x.secs }), { n: 0, p: 0, s: 0 });
// "about 2 hr 20 min" at her pace, or the papers when there is no pace yet.
const gpSay = e => e.s >= 60 ? '<span>about</span> <span data-raw>' + esc(tkDur(e.s)) + '</span>' : '<span>' + esc(people(e.p, 'paper')) + '</span>';
const gpMon = fcMon;
const gpAdd = (day, n) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDay(d.getTime()); };

// Under the date in an assignment's box: what else is due that week, so a week that piles up is seen while there is time to move it.
function gpDueHint(day, except) {
  if (!gpReady || !/^\d{4}-\d\d-\d\d$/.test(day || '')) return '';
  const mon = gpMon(day), e = gpSum(gpDue(mon, gpAdd(mon, 6), except));
  if (!e.n) return '<span>Nothing else to grade is due that week.</span>';
  return '<span>Also due that week</span>: <b><span>' + esc(people(e.n, 'set')) + '</span>, ' + gpSay(e) + '</b>';
}

/* ---------- the week in To do ---------- */
// The grading due on each day of the week shown, and the week's total, with the day that has the most.
function gpWeek(mon, end) {
  const list = gpReady ? gpDue(mon, end) : [], by = new Map();
  for (const x of list) { if (!by.has(x.it.due)) by.set(x.it.due, []); by.get(x.it.due).push(x); }
  const top = [...by.entries()].map(([d, l]) => [d, gpSum(l)]).sort((a, b) => b[1].s - a[1].s || b[1].p - a[1].p)[0];
  const e = gpSum(list);
  return {
    bar: e.n ? '<span class="tdwsum">Grading due this week: <b>' + esc(people(e.n, 'set')) + ', ' + gpSay(e) + '</b>' + (e.s >= 60 ? ' <span>at your pace</span>' : '') + (by.size > 1 && top ? ' · <span>Most on</span> <span data-raw>' + esc(new Date(top[0] + 'T12:00:00').toLocaleDateString(LANG_LOCALE, { weekday: 'long' })) + '</span>' : '') + '</span>' : '',
    day: d => { const l = by.get(d); if (!l) return ''; const s = gpSum(l); return '<div class="tdest' + (s.s >= 3 * 3600 ? ' heavy' : '') + '">' + l.map(x => '<span>Due: <b data-raw>' + esc(x.it.name) + '</b></span><span><span data-raw>' + esc(x.c.name) + '</span> · ' + esc(people(x.left, 'paper')) + (x.inn ? ' left' : '') + (x.secs >= 60 ? ' · ' + gpSay({ s: x.secs, p: x.left }) : '') + '</span>').join('') + '</div>'; },
  };
}

/* ---------- free periods ---------- */
const gpMins = t => { const m = /^(\d{1,2}):(\d\d)$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
// The gaps of 20 minutes or more between one class's end and the next one's start, on a day.
function gpGaps(rows) {
  const out = [];
  for (let i = 0; i + 1 < rows.length; i++) { const a = gpMins(rows[i].m.end), b = gpMins(rows[i + 1].m.start); if (a != null && b != null && b - a >= GP_FREE) out.push({ i, a, b, from: rows[i].m.end, to: rows[i + 1].m.start }); }
  return out;
}
// The free period going on now, with at least five minutes of it left, or null.
function gpFreeNow() {
  if (!gpReady || !fcConf().free || typeof plan === 'undefined' || !plan) return null;
  const t = todayRows(plan); if (t.off) return null;
  const d = new Date(), now = d.getHours() * 60 + d.getMinutes();
  return gpGaps(t.rows).find(g => now >= g.a && now < g.b - 5) || null;
}
// A row between two classes in Today's list.
function gpFreeRow(rows, i) {
  if (!gpReady || !fcConf().free) return '';
  const g = gpGaps(rows).find(x => x.i === i); if (!g) return '';
  return '<div class="trow gpfree"><span class="tt"></span><span class="nt"><b>Free period</b><span class="ns" data-raw>' + esc(planTime(g.from) + ' – ' + planTime(g.to)) + '</span></span></div>';
}

/* ---------- for the Focus card's suggestion: a free period, and where she left off ---------- */
const GP_CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.3 1.6"/></svg>';
// The minutes a free period going on leaves for a session, in fives, with five to spare.
const gpFreeLen = f => { const d = new Date(), left = f.b - (d.getHours() * 60 + d.getMinutes()); return Math.max(5, Math.min(60, Math.floor((left - 5) / 5) * 5)); };
// Where she left off: the set worked on last, not finished, from the last week, and not the one open now.
function gpBack() {
  if (!gpReady) return null;
  const m = homeGroups().mark.filter(x => canOpen(x) && keptState(x).left && (keptState(x).done || x.partial)).sort((a, b) => b.t - a.t)[0];
  return m && Date.now() - m.t > 20 * 60e3 && Date.now() - m.t < 7 * 864e5 && !(batch && batch.id === m.id && !$('#app').hidden) ? m : null;
}

/* ---------- planning lessons: next week's lessons, and how long a lesson takes her ---------- */
// Next week (Monday to Sunday after this one) on the Planner's timetable: each class meeting on a school day inside the semester, how
// many have a lesson, and how many of those she said are ready (or have their finished deck). The semester's first and last weeks are
// weeks, as the Planner keeps them. src/planner/plannext.js counts the same for its own page. Not on a phone, where the Planner isn't.
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
// Under today's goal on the Focus card: "Next week 6 / 9 lessons planned", a dot for each meeting, filled for a ready lesson and lighter
// for one planned but not ready yet, in the order they meet. A bar when there are more than the card's dots. Hidden with nothing to plan.
function gpPlanRow() {
  const w = gpPlanWeek(); if (!w || !w.of) return '';
  const all = w.planned >= w.of, n = '<span data-raw>' + w.planned + ' / ' + w.of + '</span>';
  const viz = w.of <= FC_DOTS ? '<span class="fcdots gpdots" aria-hidden="true">' + w.dots.map(d => '<i' + (d === 2 ? ' class="fon"' : d === 1 ? ' class="fpl"' : '') + '></i>').join('') + '</span>'
    : '<span class="fcbar" aria-hidden="true"><i style="width:' + Math.round(w.planned / w.of * 100) + '%"></i></span>';
  return '<div class="fcgoal gpwk' + (all ? ' met' : '') + '"><div class="fcgh"><b>Next week</b><span class="fcnum">' + (all ? '<span class="fcmet">' + FC_TICK + n + '</span>' : n) + '<span>lessons planned</span></span></div>' + viz + '</div>';
}
// The planning time a lesson has had in the last 14 days, from the Planner's own count (src/planner/plantime.js), in seconds.
function gpLesWorked(id) {
  if (!id || typeof tkPlan !== 'function') return 0;
  const from = gpAdd(fcToday(), -13); let s = 0;
  for (const [day, d] of Object.entries(tkPlan().days)) if (day >= from && d && d.a && d.a[id]) s += +d.a[id] || 0;
  return s;
}
// How long a lesson takes her to plan: the middle of the planning times of her last 10 ready lessons that had a minute or more, from
// her own time only, and nothing before there are 3 (src/planner/plantime.js ptPace says the same in the Planner).
function gpLesPace() {
  if (typeof plan === 'undefined' || !plan || typeof tkPlan !== 'function') return 0;
  const days = Object.values(tkPlan().days), tot = id => days.reduce((s, d) => s + (d && d.a && +d.a[id] || 0), 0);
  const xs = (plan.ready || []).slice().sort((a, b) => b.at - a.at).map(x => tot(x.id)).filter(s => s >= 60).slice(0, 10);
  if (xs.length < 3) return 0;
  const o = xs.sort((a, b) => a - b), h = o.length >> 1;
  return o.length % 2 ? o[h] : (o[h - 1] + o[h]) / 2;
}

/* ---------- shortest papers first ---------- */
// How long a paper is: its pages, from the PDF once it is open or by counting its pages, else a guess from its size.
const gpLens = new WeakMap();
function gpPages(f) {
  if (f.numPages) return f.numPages;
  const d = f.data, size = f.size || (d ? d.length : 0);
  if (f.kind === 'pdf' && d && d.length) { try { const m = new TextDecoder('latin1').decode(d.length > 8e6 ? d.subarray(0, 8e6) : d).match(/\/Type\s*\/Page(?![a-zA-Z])/g); if (m && m.length) return m.length; } catch {} }
  return Math.max(1, Math.round(size / (f.kind === 'pdf' ? 6e4 : 4e3)));
}
function gpLen(st) { let n = 0; for (const f of st.files || []) { if (f.virtual) continue; let v = gpLens.get(f); if (v == null) { v = gpPages(f); gpLens.set(f, v); } n += v; } return n; }
// While a session runs on these papers with shortest first on, the next paper is the shortest one not finished; else -1.
function gpShortNext(left) {
  if (!gpReady || !batch || !fcConf().short) return -1;
  const r = fcRun(); if (!r || (r.st !== 'run' && r.st !== 'paused') || r.w !== 'mark:' + batch.id) return -1;
  let best = -1, bl = Infinity;
  // a student with no paper in comes last
  batch.students.forEach((st, i) => { if (i === cur || !left(st)) return; const l = gpLen(st) || 1e9; if (l < bl) { bl = l; best = i; } });
  return best;
}

/* ---------- the look back at the week, on Today ---------- */
function gpLookHtml() {
  if (!gpReady) return '';
  const c = fcConf(); if (c.wk === false) return '';
  const today = fcToday(), mon = gpMon(today), dow = new Date().getDay(), L = fcLog();
  if ((dow + 6) % 7 < (c.wk + 6) % 7 || L.lbHid === mon) return '';
  const days = []; for (let k = mon; k <= today; k = gpAdd(k, 1)) days.push(k);
  const t = tkSum(days, L, tkPlan()), lessons = Object.keys(t.la).filter(Boolean).length, papers = t.p, gday = t.list.filter(d => d.g >= 60).length;
  const back = [...keptMeta.values()].filter(m => m && keptBack(m) && isoDay(keptBack(m)) >= mon && !(m.newer && keptMeta.has(m.newer)));
  const wait = homeGroups().mark.filter(m => keptState(m).left).slice(0, 4), pace = gpPaces();
  const next = gpSum(gpDue(gpAdd(mon, 7), gpAdd(mon, 13)));
  const tile = (label, v, sub) => '<div><span>' + label + '</span><b>' + v + '</b><i>' + sub + '</i></div>';
  const range = new Date(mon + 'T12:00:00').toLocaleDateString(LANG_LOCALE, { weekday: 'long', month: 'short', day: 'numeric' }) + ' – ' + new Date().toLocaleDateString(LANG_LOCALE, { weekday: 'long', month: 'short', day: 'numeric' });
  return '<div class="thd"><h2 class="tcap">Your week</h2><a class="link" href="#/time">Time tracker</a></div><div class="tcard lbk">' +
    '<h2>A look back at the week</h2><p class="lbks" data-raw>' + esc(range) + '</p><div class="lbkg">' +
    tile('Grading time', tkD(t.g), gday ? '<span>' + esc(people(gday, 'day')) + '</span>' : '') +
    tile('Planning time', tkD(t.l), lessons ? '<span>' + esc(people(lessons, 'lesson')) + '</span>' : '') +
    tile('Papers marked', '<span data-raw>' + papers + '</span>', '') +
    tile('Handed back', '<span>' + esc(people(back.length, 'set')) + '</span>', back.length ? '<span data-raw>' + esc(back.slice(0, 3).map(m => m.name || 'Student work').join(', ')) + '</span>' : '') + '</div>' +
    (wait.length ? '<div class="lbkw"><b>Still waiting</b><ul>' + wait.map(m => { const st = keptState(m), it = cardOfKept(m.id), wh = keptWhere(m); return '<li><span data-raw>' + esc((m.name || 'Student work') + (wh.cls ? ', ' + wh.cls.name : '')) + '</span> <span class="m">· <span>' + esc(people(st.left, 'paper') + ' left') + '</span>' + (it && pace(it.id) ? ' · ' + gpSay({ s: st.left * pace(it.id), p: st.left }) : '') + '</span></li>'; }).join('') + '</ul></div>' : '') +
    (next.n ? '<div class="lbkw"><b>Due next week</b> <span class="m">· <span>' + esc(people(next.n, 'set')) + '</span>, ' + gpSay(next) + '</span></div>' : '') +
    '<div class="lbkf"><button class="btn sm" data-gplbhide>Put it away for this week</button><a class="link" href="#/settings/focus">Change the day</a></div></div>';
}

/* ---------- quiet while focusing ---------- */
function gpQuiet() {
  if (!gpReady) return;
  const r = fcRun(), on = fcConf().quiet && !!r && r.k !== 'l' && (r.st === 'run' || r.st === 'paused');   // quiet is for grading
  if (document.body.classList.contains('fcquiet') !== on) document.body.classList.toggle('fcquiet', on);
}

/* ---------- Settings, Focus and goals: planning your grading ---------- */
function gpSetRender(sec) {
  if (sec !== 'focus' || !gpReady) return;
  const el = $('#setPlan'); if (!el) return;
  const c = fcConf(), ck = (id, on, label) => '<p class="setp"><label><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '> ' + label + '</label></p>';
  const h = '<div class="lhead"><h2>Planning your grading</h2><span class="muted">How long the papers will take at your pace, and a few ways to start. Each can be switched off.</span></div>' +
    ck('gpFree', c.free, 'Offer free periods for grading') + '<p class="muted setp gpnote">When a gap of 20 minutes or more between two of your classes starts, the Focus card on Today offers it, with the next papers ready.</p>' +
    '<p class="setp fcset"><label><input type="checkbox" id="gpWk"' + (c.wk !== false ? ' checked' : '') + '> A look back at the week, from</label><select id="gpWkDay" class="btn sm" aria-label="The day of the look back"' + (c.wk === false ? ' disabled' : '') + '>' +
    [1, 2, 3, 4, 5, 6, 0].map(d => '<option value="' + d + '"' + (d === (c.wk === false ? 5 : c.wk) ? ' selected' : '') + '>' + GP_DAYS[d] + '</option>').join('') + '</select></p>' +
    ck('gpQuiet', c.quiet, 'Quiet while focusing: hide the counts in the sidebar and in To do during a session') +
    ck('gpShort', c.short, 'Shortest papers first in a focus session');
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
}
$('#setPane').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'gpFree') fcConfSet({ free: t.checked });
  else if (t.id === 'gpWk') fcConfSet({ wk: t.checked ? +$('#gpWkDay').value : false });
  else if (t.id === 'gpWkDay') fcConfSet({ wk: +t.value });
  else if (t.id === 'gpQuiet') fcConfSet({ quiet: t.checked });
  else if (t.id === 'gpShort') fcConfSet({ short: t.checked });
  else return;
  gpSetRender('focus'); homeRender();
});

/* ---------- presses ---------- */
document.addEventListener('click', e => {
  if (!e.target.closest('[data-gplbhide]')) return;
  const L = fcLog(); L.lbHid = gpMon(fcToday()); fcLogSet(L); homeRender();
});
document.addEventListener('change', e => { if (e.target.matches('[data-fcshort]')) fcConfSet({ short: e.target.checked }); });
// A free period starts or ends as the clock goes on, so the card is looked at again each minute.
setInterval(() => { if (shellReady && !document.hidden) fcRender(); }, 60e3);

window.__gs = Object.assign(window.__gs || {}, { gpPaces: () => gpPaces(), gpPaceN, gpPlanWeek, gpLesPace, gpLesWorked, gpDue, gpLeft, gpFreeNow, gpGaps, gpLen, gpShortNext, gpLookHtml, gpDueHint });
gpReady = true;
