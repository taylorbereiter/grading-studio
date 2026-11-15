/* ---------------- The time tracker: how much time goes to grading, and how much to planning, kept apart ----------------
   Time counts by itself while the teacher works: grading while the marking screen is open in a tab that is in front, planning
   while the Planner is (src/planner/plantime.js, but not while a lesson is presented). It stops when nothing has been pressed,
   typed or scrolled for a few minutes (Settings, Focus and goals: 2, 5, 10 or 15), and it can be switched off there.
   Time spent away from the app (marking on paper, planning in a notebook) can be added by hand.
   What is kept, beside the focus timer's own log (src/focus.js):
     gs.focus     days[day].g: seconds grading, .a: { <assignment id> | '': seconds } (an assignment from the classes; '' is papers
                  not filed under one), .pa: papers finished by assignment, .sm: focus seconds on papers; add: time added by hand.
     gsp.planTime  written by the Planner: { days: { day: { l: seconds, a: { <lesson id> | '': seconds } } }, names: { <lesson id>: title } }.
                  A lesson's title is the teacher's own; nothing about a student is in it.
   A day from before time was counted has only its focus sessions: those are its grading time. */
// Other screens can draw before this file has run (a reload straight onto a class page draws its cards at start), so each
// way in waits for tkReady, a var that reads false until the last line here.
var tkReady = false;
const TK_STEP = 15, TK_FLUSH = 60e3;
let tkLast = 0, tkPend = { g: 0, a: {} }, tkFlushed = Date.now(), tkTimer = 0;
const tkS = { range: 'week', off: 0, kind: 'g', adding: false };

/* ---------- counting while grading ---------- */
for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) document.addEventListener(ev, () => { tkLast = Date.now(); }, { capture: true, passive: true });
let tkMoved = 0;
document.addEventListener('pointermove', () => { const t = Date.now(); if (t - tkMoved > 5000) { tkMoved = t; tkLast = t; } }, { capture: true, passive: true });
// Grading: the marking screen, in this tab, in front, with something done in the last few minutes.
function tkGrading() { return !!batch && !$('#app').hidden && document.visibilityState === 'visible' && document.hasFocus() && Date.now() - tkLast < fcConf().idle * 60e3; }
function tkTick() {
  if (!tkReady) return;
  if (!fcConf().track) return;
  if (tkGrading()) { const it = batch.assignment && findItem(batch.assignment.id), k = it ? it.it.id : ''; tkPend.g += TK_STEP; tkPend.a[k] = (tkPend.a[k] || 0) + TK_STEP; }
  if (Date.now() - tkFlushed >= TK_FLUSH) tkFlush();
}
// Written down once a minute, and whenever the marking screen closes or the tab is left, so a minute is the most a closed tab loses.
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
function tkOn() { if (!tkTimer) tkTimer = setInterval(tkTick, TK_STEP * 1000); tkShare(); }
// The Planner reads only its own keys, so the two settings it needs are copied into one of them.
function tkShare() {
  const c = fcConf(), v = JSON.stringify({ on: !!c.track, idle: c.idle });
  try { if (localStorage.getItem('gsp.timeCount') !== v) localStorage.setItem('gsp.timeCount', v); } catch { }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') tkFlush(); });
window.addEventListener('pagehide', tkFlush);
window.addEventListener('blur', tkFlush);

/* ---------- reading the days back ---------- */
function tkPlan() {
  const P = store.get('gsp.planTime', null) || {};
  return { days: P.days && typeof P.days === 'object' ? P.days : {}, names: P.names && typeof P.names === 'object' ? P.names : {} };
}
// One day, everything about it: grading and planning seconds (counted and added by hand), papers, focus seconds, and what they went to.
function tkDay(k, L, P) {
  const d = L.days[k] || {}, pd = P.days[k] || {}, hand = L.add.filter(x => x.d === k);
  const hg = hand.filter(x => x.k === 'g').reduce((s, x) => s + x.s, 0), hl = hand.filter(x => x.k === 'l').reduce((s, x) => s + x.s, 0);
  const auto = d.g != null ? Math.max(d.g, d.sm || 0) : (d.s || 0);
  const ga = d.g != null ? { ...(d.a || {}) } : d.s ? { '': d.s } : {};
  if (d.g != null && auto > d.g) ga[''] = (ga[''] || 0) + auto - d.g;
  return { k, g: auto + hg, l: (pd.l || 0) + hl, hg, hl, p: d.p || 0, pa: d.pa || {}, s: d.s || 0, ga, la: pd.a || {}, hand };
}
const tkYmd = d => isoDay(d.getTime());
const tkDate = (k, o) => new Date(k + 'T12:00:00').toLocaleDateString(LANG_LOCALE, o);
function tkMonday(d) { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
function tkAdd(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
// The days a range covers, and how its bars are grouped: a day each for a week or a month, a week each for three months.
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
// A length of time in the app's language: "1 hr 20 min", "45 min" (the browser's own words for hours and minutes).
function tkDur(secs) {
  const m = Math.round(secs / 60), h = Math.floor(m / 60), r = m % 60;
  const u = (n, unit) => { try { return new Intl.NumberFormat(LANG_LOCALE, { style: 'unit', unit, unitDisplay: 'short' }).format(n); } catch { return n + (unit === 'hour' ? ' h' : ' min'); } };
  return h ? u(h, 'hour') + (r ? ' ' + u(r, 'minute') : '') : u(m, 'minute');
}
const tkD = secs => '<span data-raw>' + esc(tkDur(secs)) + '</span>';

/* ---------- the page ---------- */
const TK_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
const TK_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
const TK_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
function tkAsgName(id) {
  if (!id) return { name: tr('Other grading'), cls: tr('Papers not filed under an assignment, and focus sessions from before time was counted') };
  const f = findItem(id); return f ? { name: f.it.name, cls: f.c && f.c !== lib.loose ? f.c.name : '' } : { name: tr('An assignment that was removed'), cls: '' };
}
// A faint line at each hour (or every two, five or ten on a tall chart), named on the left.
function tkGrid(top) {
  const hrs = top / 3600, step = [1, 2, 5, 10, 20].find(n => hrs / n <= 5) || 50, out = [];
  for (let h = step; h * 3600 <= top; h += step) out.push('<span class="tkgl" style="bottom:calc(18px + (100% - 18px - var(--space-2)) * ' + (h * 3600 / top).toFixed(4) + ')"><span>' + esc(tkDur(h * 3600)) + '</span></span>');
  return out.join('');
}
function tkPageRender() {
  if (!tkReady) return;
  const r = routeNow(); if (r.v !== 'time' || batch) return;
  const box = $('#tkBody'); if (!box) return;
  const L = fcLog(), P = tkPlan(), c = fcConf(), per = tkPeriod(tkS.range, tkS.off), t = tkSum(per.days, L, P);
  const prevPer = tkPeriod(tkS.range, tkS.off - 1), pt = tkSum(prevPer.days, L, P), today = fcToday();
  const word = { week: 'Last week', month: 'Last month', quarter: 'The 3 months before' }[tkS.range];
  const seg = '<div class="pseg" role="group" aria-label="How much to show">' + [['week', 'Week'], ['month', 'Month'], ['quarter', '3 months']].map(([k, l]) => '<button data-tkrange="' + k + '" aria-pressed="' + (tkS.range === k) + '">' + l + '</button>').join('') + '</div>';
  const head = '<div class="tkrange"><button class="icon" data-tkoff="-1" title="Earlier" aria-label="Earlier">' + TK_PREV + '</button><span class="tkwhen" data-raw>' + esc(per.label) + '</span>' +
    '<button class="icon" data-tkoff="1" title="Later" aria-label="Later"' + (tkS.off >= 0 ? ' disabled' : '') + '>' + TK_NEXT + '</button>' + (tkS.off ? '<button class="btn sm" data-tknow>Back to now</button>' : '') + '<span class="sp"></span>' + seg + '</div>';
  // the tiles: grading and planning side by side, never added together
  const lessons = Object.keys(t.la).filter(k => k && t.la[k] >= 60).length;
  const pacePer = t.p && t.g ? Math.max(1, Math.round(t.g / 60 / t.p)) : 0;
  const school = per.days.filter(k => k <= today);
  const met = c.goal ? school.filter(k => { const d = L.days[k] || {}; return c.goal.k === 'papers' ? (d.p || 0) >= c.goal.n : Math.floor((d.s || 0) / 60) >= c.goal.n; }).length : 0;
  const busy = t.list.filter(d => d.g + d.l > 0).sort((a, b) => b.g + b.l - (a.g + a.l))[0];
  const tile = (key, label, v, sub, sub2) => '<div class="tktile"><span class="tkl">' + (key ? '<i class="tkkey ' + key + '"></i>' : '') + '<span>' + label + '</span></span><span class="tkv">' + v + '</span>' + (sub ? '<span class="tks">' + sub + '</span>' : '') + (sub2 ? '<span class="tks">' + sub2 + '</span>' : '') + '</div>';
  const tiles = '<div class="tktiles">' +
    tile('g', 'Grading time', tkD(t.g), t.p ? '<span>' + esc(people(t.p, 'paper')) + '</span>' + (pacePer ? ' · <span>' + esc('about ' + people(pacePer, 'minute') + ' a paper') + '</span>' : '') : '', '<span>' + esc(word) + ':</span> ' + tkD(pt.g)) +
    tile('l', 'Planning time', tkD(t.l), lessons ? '<span>' + esc(people(lessons, 'lesson')) + '</span>' : '', '<span>' + esc(word) + ':</span> ' + tkD(pt.l)) +
    tile('f', 'In focus sessions', tkD(t.s), '<span>Time on the focus timer</span>') +
    (c.goal ? tile('', 'Daily goal', '<span data-raw>' + met + ' / ' + school.length + '</span>', '<span>' + esc(people(met, 'day') + ' reached the goal') + '</span>')
      : tile('', 'Busiest day', busy ? '<span data-raw>' + esc(tkDate(busy.k, { weekday: 'short', month: 'short', day: 'numeric' })) + '</span>' : '–', busy ? tkD(busy.g + busy.l) : '')) + '</div>';
  // day by day: two bars, grading and planning
  const bars = per.groups.map(g => { const ds = g.map(k => tkDay(k, L, P)); return { k: g[0], last: g[g.length - 1], g: ds.reduce((s, d) => s + d.g, 0), l: ds.reduce((s, d) => s + d.l, 0) }; });
  const top = Math.max(3600, ...bars.map(b => Math.max(b.g, b.l)));
  const many = bars.length > 10;
  const dl = b => tkS.range === 'quarter' ? tkDate(b.k, { month: 'numeric', day: 'numeric' }) : tkS.range === 'month' ? String(+b.k.slice(8)) : tkDate(b.k, { weekday: 'short' });
  const lab = b => (tkS.range === 'quarter' ? tkDate(b.k, { month: 'short', day: 'numeric' }) + ' – ' + tkDate(b.last, { month: 'short', day: 'numeric' }) : tkDate(b.k, { weekday: 'long', month: 'short', day: 'numeric' })) + ': ' + tkDur(b.g) + ' · ' + tkDur(b.l);
  const chart = '<div class="tcard tkchart"><div class="tkch"><h2>' + (tkS.range === 'quarter' ? 'Week by week' : 'Day by day') + '</h2><span class="tklegend"><span><i class="tkkey g"></i>Grading time</span><span><i class="tkkey l"></i>Planning time</span></span></div>' +
    '<div class="tkbars' + (many ? ' many' : '') + '" role="img" data-raw aria-label="' + esc(bars.map(lab).join('; ')) + '">' + tkGrid(top) +
    bars.map(b => '<span class="tkday' + (b.k <= today && b.last >= today ? ' now' : '') + (b.k > today ? ' later' : '') + '" title="' + esc(lab(b)) + '" data-raw><span class="tkpair"><i class="g" style="height:' + (b.g / top * 100).toFixed(1) + '%"></i><i class="l" style="height:' + (b.l / top * 100).toFixed(1) + '%"></i></span><span class="tkdl">' + esc(dl(b)) + '</span></span>').join('') + '</div></div>';
  // what the time went to
  const row = (name, sub, secs, max, extra) => '<div class="tkrow"><b data-raw title="' + esc(name) + '">' + esc(name) + '</b><span class="tkt">' + tkD(secs) + '</span><span class="tkm"><span class="tkbar"><i style="width:' + Math.max(2, secs / max * 100).toFixed(1) + '%"></i></span>' + (sub ? '<span data-raw>' + esc(sub) + '</span>' : '') + (extra || '') + '</span></div>';
  const ga = Object.entries(t.ga).filter(([, v]) => v >= 60).sort((a, b) => b[1] - a[1]), la = Object.entries(t.la).filter(([, v]) => v >= 60).sort((a, b) => b[1] - a[1]);
  const hg = t.list.reduce((s, d) => s + d.hg, 0), hl = t.list.reduce((s, d) => s + d.hl, 0);
  const gmax = Math.max(1, ...ga.map(x => x[1]), hg), lmax = Math.max(1, ...la.map(x => x[1]), hl);
  const gRows = ga.map(([id, v]) => { const n = tkAsgName(id), p = t.pa[id] || 0; return row(n.name, n.cls, v, gmax, p ? '<span>' + esc(people(p, 'paper')) + '</span>' : ''); }).join('') + (hg >= 60 ? row(tr('Added by hand'), '', hg, gmax) : '');
  const lRows = la.map(([id, v]) => row(id ? P.names[id] || tr('A lesson') : tr('The week, units and the bank'), '', v, lmax)).join('') + (hl >= 60 ? row(tr('Added by hand'), '', hl, lmax) : '');
  const lists = '<div class="tkcols"><div class="tcard tklist g"><h2>Grading, by assignment</h2>' + (gRows || '<p class="tknone">No grading time in this stretch.</p>') + '</div>' +
    '<div class="tcard tklist l"><h2>Planning, by lesson</h2>' + (lRows || '<p class="tknone">No planning time in this stretch. Time in the Planner counts here, except while a lesson is presented.</p>') + '</div></div>';
  // added by hand
  const ents = L.add.filter(x => x.d >= per.from && x.d <= per.to).sort((a, b) => b.d.localeCompare(a.d));
  const form = tkS.adding ? '<form class="tkadd" id="tkAdd" autocomplete="off"><label>Day<input type="date" id="tkDay" value="' + today + '" max="' + today + '"></label>' +
    '<label>What<span class="seg" role="group" aria-label="What">' + [['g', 'Grading time'], ['l', 'Planning time']].map(([k, l]) => '<button type="button" data-tkkind="' + k + '" aria-pressed="' + (tkS.kind === k) + '">' + l + '</button>').join('') + '</span></label>' +
    '<label>Minutes<input type="number" id="tkMin" min="1" max="720" step="1" value="30"></label><label>Note<input type="text" id="tkNote" maxlength="80" placeholder="Optional, like “Essays on paper”"></label>' +
    '<button class="btn primary" type="submit">Add</button><button class="btn" type="button" data-tkcancel>Cancel</button></form>' : '';
  const hand = '<div class="tcard tkhand"><div class="tkch"><h2>Added by hand</h2><span class="muted">For time away from the app, like marking on paper</span><span class="sp"></span>' + (tkS.adding ? '' : '<button class="btn sm" data-tkadd>Add time</button>') + '</div>' + form +
    ents.map(x => '<div class="tkent"><b data-raw>' + esc(tkDate(x.d, { weekday: 'short', month: 'short', day: 'numeric' })) + '</b><span>' + (x.k === 'g' ? 'Grading time' : 'Planning time') + '</span>' + tkD(x.s) + '<span class="sp" data-raw>' + esc(x.x || '') + '</span><button class="icon" data-tkdel="' + esc(x.id) + '" title="Remove" aria-label="Remove">' + TK_X + '</button></div>').join('') + '</div>';
  const foot = '<div class="tkfoot"><p>' + (c.track ? esc('Time counts while the marking screen or the Planner is in front and you have done something there in the last ' + people(c.idle, 'minute') + '.') : 'Time isn’t being counted. Turn it on in Settings, Focus and goals.') + ' <a class="link" href="#/settings/focus">Settings</a></p><button class="btn sm" data-tkcsv>Download as a spreadsheet</button></div>';
  const h = head + tiles + chart + lists + hand + foot;
  if (box.dataset.h !== h) { box.dataset.h = h; box.innerHTML = h; }
}
// The whole log as a spreadsheet: one row a day, grading and planning in minutes.
function tkCsvText() {
  tkFlush();
  const L = fcLog(), P = tkPlan(), keys = [...new Set([...Object.keys(L.days), ...Object.keys(P.days), ...L.add.map(x => x.d)])].sort();
  const rows = [['Date', 'Grading minutes', 'Planning minutes', 'Focus minutes', 'Papers', 'Grading added by hand', 'Planning added by hand']];
  for (const k of keys) { const d = tkDay(k, L, P); if (d.g || d.l || d.s || d.p) rows.push([k, Math.round(d.g / 60), Math.round(d.l / 60), Math.round(d.s / 60), d.p, Math.round(d.hg / 60), Math.round(d.hl / 60)]); }
  return rows.map(r => r.join(',')).join('\r\n') + '\r\n';
}
function tkCsv() {
  const blob = new Blob([tkCsvText()], { type: 'text/csv' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'Time tracker ' + fcToday() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function tkAddTime(d, k, min, x) {
  const L = fcLog(); L.add = [...L.add, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), d, k, s: Math.round(min * 60), x: String(x || '').slice(0, 80) }];
  fcLogSet(L);
}
$('#vTime').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if (d.tkrange) { tkS.range = d.tkrange; tkS.off = 0; return tkPageRender(); }
  if (d.tkoff) { tkS.off = Math.min(0, tkS.off + +d.tkoff); return tkPageRender(); }
  if (d.tknow != null) { tkS.off = 0; return tkPageRender(); }
  if (d.tkadd != null) { tkS.adding = true; tkPageRender(); const m = $('#tkMin'); if (m) { m.focus(); m.select(); } return; }
  if (d.tkcancel != null) { tkS.adding = false; return tkPageRender(); }
  if (d.tkkind) { tkS.kind = d.tkkind; $('#vTime').querySelectorAll('[data-tkkind]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.tkkind === tkS.kind))); return; }
  if (d.tkdel) { const L = fcLog(); L.add = L.add.filter(x => x.id !== d.tkdel); fcLogSet(L); fcRender(); return tkPageRender(); }
  if (d.tkcsv != null) return tkCsv();
});
$('#vTime').addEventListener('submit', e => {
  if (e.target.id !== 'tkAdd') return;
  e.preventDefault();
  const day = $('#tkDay').value, min = Math.round(+$('#tkMin').value);
  if (!/^\d{4}-\d\d-\d\d$/.test(day) || day > fcToday()) return toast('Pick a day up to today');
  if (!(min >= 1 && min <= 720)) return toast('Between 1 and 720 minutes');
  tkAddTime(day, tkS.kind, min, $('#tkNote').value.trim());
  tkS.adding = false; fcRender(); tkPageRender();
});

/* ---------- one assignment's time, where the assignment is: the marking screen and its card on the class page ---------- */
const TK_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.3 1.6"/></svg>';
function tkAsg(id) {
  if (!id || !tkReady) return null;
  const L = fcLog(); let s = 0, p = 0;
  for (const d of Object.values(L.days)) { if (!d) continue; if (d.a && d.a[id]) s += d.a[id]; if (d.pa && d.pa[id]) p += d.pa[id]; }
  return { s: s + (tkPend.a[id] || 0), p };
}
// "1 hr 5 min so far · about 4 minutes a paper": the time counted on this assignment since the tracker began, and how long a
// paper took, from the papers finished on the days it was counted.
function tkAsgHtml(id) {
  const t = tkAsg(id); if (!t || t.s < 60 || !fcConf().track && !t.s) return '';
  const per = t.p ? Math.max(1, Math.round(t.s / 60 / t.p)) : 0;
  return '<span class="tkc" title="' + esc(tr('Time spent grading this assignment, from the time tracker')) + '">' + TK_CLOCK + '<span>' + esc(tkDur(t.s) + ' so far') + '</span>' + (per ? '<span>·</span><span>' + esc('about ' + people(per, 'minute') + ' a paper') + '</span>' : '') + '</span>';
}

/* ---------- the line on Today's Focus card ---------- */
function tkTodayHtml() {
  if (!tkReady) return '';
  const L = fcLog(), P = tkPlan(), d = tkDay(fcToday(), L, P), g = d.g + (tkPend.g || 0);
  if (!g && !d.l) return '<div class="fctk"><span>' + (fcConf().track ? 'Grading and planning time count here as you work.' : 'Grading and planning time') + '</span><a class="link" href="#/time">Time tracker</a></div>';
  return '<div class="fctk"><span><i class="tkkey g"></i><span>Grading time</span><b>' + tkD(g) + '</b><i class="tkkey l"></i><span>Planning time</span><b>' + tkD(d.l) + '</b></span><a class="link" href="#/time">Time tracker</a></div>';
}

/* ---------- Settings, Focus and goals: counting time ---------- */
function tkSetRender(sec) {
  if (sec !== 'focus' || !tkReady) return;
  const el = $('#setTrack'); if (!el) return;
  const c = fcConf();
  const h = '<div class="lhead"><h2>Time tracker</h2><span class="muted">How much time goes to grading and to planning, kept apart. <a class="link" href="#/time">Open the time tracker</a></span></div>' +
    '<p class="setp"><label><input type="checkbox" id="tkOn"' + (c.track ? ' checked' : '') + '> Count grading time on the marking screen and planning time in the Planner</label></p>' +
    '<p class="setp fcset"><label for="tkIdle"><b>Stop counting after</b></label><select id="tkIdle" class="btn sm" aria-label="Stop counting after"' + (c.track ? '' : ' disabled') + '>' + TK_IDLES.map(n => '<option value="' + n + '"' + (n === c.idle ? ' selected' : '') + '>' + n + ' minutes</option>').join('') + '</select><span class="muted">with nothing pressed, typed or scrolled</span></p>';
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
}
$('#setPane').addEventListener('change', e => {
  if (e.target.id === 'tkOn') { tkFlush(); fcConfSet({ track: e.target.checked }); tkSetRender('focus'); }
  else if (e.target.id === 'tkIdle') fcConfSet({ idle: +e.target.value });
});
tkOn();
Object.assign(window.__gs, { tkCsvText, tkFlush, tkTick, tkDay: k => tkDay(k, fcLog(), tkPlan()), tkPeriod, tkAddTime, tkDur, tkPend: () => tkPend, tkActive: () => { tkLast = Date.now(); }, tkHold: () => { clearInterval(tkTimer); tkTimer = 0; } });   // tkHold: tests move the clock themselves
tkReady = true;
