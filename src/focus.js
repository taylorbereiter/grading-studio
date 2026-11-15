/* ---------------- Focus: a work timer for grading, a daily goal, and a way straight into the next piece of work ----------------
   Made for getting started and keeping going: one press starts a short session on the next set of papers (or a to-do), a small
   panel keeps the time and the next paper in view, a soft chime says when the time is up, and a break is offered. Nothing scolds:
   there are no streaks and no red, and a day the goal isn't reached simply isn't mentioned.
   Three places draw it: the card on Today (#fcCard), Focus in the sidebar (#railFocus, with the time left while a session runs),
   and the panel in the bottom left (#fcPanel), over every screen, which folds down to a pill.
   What is kept:
     lib.me.focus  the teacher's own settings, only those that differ from the usual: { len: minutes, brk: minutes,
                   goal: { k: 'papers' | 'min', n }, sound: false, title: false }. It goes wherever lib goes, and My setup carries it.
     gs.focus      this teacher's log, in this browser (it travels with the folder and the take-home file like other gs. keys):
                   { day, base: { <download id>: papers done when the day began }, days: { 'YYYY-MM-DD': { p: papers, s: seconds focused,
                     sm: seconds focused on papers, pa: { <assignment id>: papers }, g: seconds grading, a: { <assignment id>: seconds } } },
                     pace: [[seconds, papers], …] the last sessions that finished a paper, last: the work picked last,
                     add: [{ id, d: day, k: 'g' | 'l', s: seconds, x: a few words }] time added by hand (src/tracker.js) }
                   Ids and numbers only: no name, no title, nothing a student wrote. Days are kept for 400 days.
     gs.focusRun   the session going on in this browser, so a refresh keeps it. It stays in this browser (LS_LOCAL).
   A paper counts toward the day when its score is finished, or its feedback complete on a formative activity, wherever that is
   done: the count is how far each download has come since the day began (keptState), so marking in Quick mark counts too. */
var FC_ON = false;   // set at the end of this file; keepWork (src/app/kept.js) may run before it
const FC_LENS = [5, 10, 15, 20, 25, 30, 45, 60], FC_BRKS = [3, 5, 10, 15], FC_AWAY = 180e3, FC_DAY = 864e5, FC_KEEP = 400, TK_IDLES = [2, 5, 10, 15];
const FC_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.3 1.6M10 3h4"/></svg>';
const FC_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
const FC_TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
let fcS = { len: 0, open: false, pick: null };   // for this visit only: a length picked on the card, the panel opened by hand, the work picked

/* ---------- the teacher's settings ---------- */
function fcConf() {
  const f = me().focus || {}, g = f.goal || null;
  return { len: FC_LENS.includes(+f.len) ? +f.len : 10, brk: FC_BRKS.includes(+f.brk) ? +f.brk : 5, sound: f.sound !== false, title: f.title !== false,
    track: f.track !== false, idle: TK_IDLES.includes(+f.idle) ? +f.idle : 5,
    free: f.free !== false, wk: f.wk === false ? false : [0, 1, 2, 3, 4, 5, 6].includes(f.wk) ? f.wk : 5, quiet: f.quiet === true, short: f.short === true,   // src/gradeplan.js
    goal: g && (g.k === 'papers' || g.k === 'min') && +g.n > 0 ? { k: g.k, n: Math.min(g.k === 'min' ? 600 : 500, Math.round(+g.n)) } : null };
}
// Only what differs from the usual is kept; nothing at all for a teacher who changed nothing.
function fcConfSet(part) {
  const c = { ...fcConf(), ...part }, o = {};
  if (c.len !== 10) o.len = c.len;
  if (c.brk !== 5) o.brk = c.brk;
  if (c.goal) o.goal = { k: c.goal.k, n: c.goal.n };
  if (!c.sound) o.sound = false;
  if (!c.title) o.title = false;
  if (!c.track) o.track = false;
  if (c.idle !== 5) o.idle = c.idle;
  if (!c.free) o.free = false;
  if (c.wk !== 5) o.wk = c.wk;
  if (c.quiet) o.quiet = true;
  if (c.short) o.short = true;
  meDrop('focus', Object.keys(o).length ? o : null);
  if (typeof tkShare === 'function') tkShare();
  fcRender();
}

/* ---------- the log: what today and this week came to ---------- */
function fcLog() {
  const L = store.get('gs.focus', null) || {};
  return { day: typeof L.day === 'string' ? L.day : '', base: L.base && typeof L.base === 'object' ? L.base : {}, days: L.days && typeof L.days === 'object' ? L.days : {},
    pace: Array.isArray(L.pace) ? L.pace.filter(x => Array.isArray(x) && x[0] > 0 && x[1] > 0) : [], last: typeof L.last === 'string' ? L.last : '',
    add: Array.isArray(L.add) ? L.add.filter(x => x && typeof x.d === 'string' && (x.k === 'g' || x.k === 'l') && x.s > 0) : [],
    ...(typeof L.lbHid === 'string' ? { lbHid: L.lbHid } : {}) };   // the week whose look-back was put away (src/gradeplan.js)
}
const fcLogSet = L => store.set('gs.focus', L);
const fcToday = () => isoDay(Date.now());
const fcDone = m => keptState(m).done;
// Papers finished today: how far each download has come since the day began, never below nothing.
function fcPapersOf(L) { let n = 0; for (const m of keptMeta.values()) if (m && m.id in L.base) n += Math.max(0, fcDone(m) - L.base[m.id]); return n; }
// The same, by assignment (an id from the classes, or '' for papers that aren't filed under one), for the tracker.
function fcPapersBy(L) {
  const o = {};
  for (const m of keptMeta.values()) if (m && m.id in L.base) { const n = Math.max(0, fcDone(m) - L.base[m.id]); if (!n) continue; const it = cardOfKept(m.id), k = it ? it.id : ''; o[k] = (o[k] || 0) + n; }
  return o;
}
// Called before a download's count changes (keepWork) and whenever the card or panel is drawn: a new day starts from where each
// download stands, a download seen for the first time starts from where it is, and today's total is written down for the week.
// id: a download about to be saved (keepWork). One not known yet is new: it starts from nothing, or from where the older copy it
// carried marks over from stood, so carried marks don't count as today's.
// Nothing is counted or written before the downloads have been read: at first the list is empty, and every count would start again.
function fcSeen(id) {
  if (!FC_ON || !keptRead) return;
  const L = fcLog(), today = fcToday(); let ch = false;
  if (L.day !== today) { L.day = today; L.base = {}; ch = true; }
  if (id && !keptMeta.has(id) && !(id in L.base)) { const old = [...keptMeta.values()].find(m => m && m.newer === id); L.base[id] = old ? fcDone(old) : 0; ch = true; }
  for (const m of keptMeta.values()) if (m && m.id && !(m.id in L.base)) { L.base[m.id] = fcDone(m); ch = true; }
  for (const k of Object.keys(L.base)) if (k !== id && !keptMeta.has(k)) { delete L.base[k]; ch = true; }
  const p = fcPapersOf(L), d = L.days[today] || {}, pa = fcPapersBy(L);
  if ((d.p || 0) !== p || JSON.stringify(d.pa || {}) !== JSON.stringify(pa)) { L.days[today] = { ...d, p, pa }; if (!p) delete L.days[today].pa; ch = true; }
  for (const k of Object.keys(L.days)) if (Date.now() - new Date(k + 'T12:00:00') > FC_KEEP * FC_DAY) { delete L.days[k]; ch = true; }
  const old = L.add.length; L.add = L.add.filter(x => Date.now() - new Date(x.d + 'T12:00:00') <= FC_KEEP * FC_DAY); if (L.add.length !== old) ch = true;
  if (ch) fcLogSet(L);
}
const fcPapersToday = () => { fcSeen(); return fcPapersOf(fcLog()); };
const fcSecsToday = () => { const d = fcLog().days[fcToday()] || {}, r = fcRun(); return (d.s || 0) + (r && (r.st === 'run' || r.st === 'paused') ? fcElapsed(r) : 0); };
function fcWeekPapers() {
  const L = fcLog(), today = fcToday(), d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  const mon = isoDay(d); return Object.entries(L.days).filter(([k]) => k >= mon && k <= today).reduce((a, [, v]) => a + (v.p || 0), 0);
}
// Seconds a paper usually takes, from the last sessions that finished at least one. Nothing is said until three papers are behind it.
function fcPace() { const p = fcLog().pace, s = p.reduce((a, x) => a + x[0], 0), n = p.reduce((a, x) => a + x[1], 0); return n >= 3 ? s / n : 0; }
const fcGoalNow = c => c.goal ? (c.goal.k === 'papers' ? fcPapersToday() : Math.floor(fcSecsToday() / 60)) : 0;

/* ---------- the session ---------- */
// { st: 'run' | 'paused' | 'up' | 'brk' | 'brkup' | 'done', len: seconds, at: when it started (moved on by any pause), pz: when it was paused,
//   w: 'mark:<download>' | 'td:<to-do>' | '', one: just one paper, p0: papers today when it started, fold, hid: when the tab was left,
//   away: minutes away to say so, got: papers the session finished, secs: seconds it ran, brkAt, brkLen }
const fcRun = () => { const r = store.get('gs.focusRun', null); return r && r.st ? r : null; };
const fcRunSet = r => { if (r) store.set('gs.focusRun', r); else store.del('gs.focusRun'); fcTickOn(); fcRender(); };
const fcElapsed = r => Math.max(0, Math.round(((r.st === 'paused' ? r.pz : Date.now()) - r.at) / 1000));
const fcLeft = r => r.st === 'brk' ? Math.max(0, Math.round((r.brkAt + r.brkLen * 1000 - Date.now()) / 1000)) : Math.max(0, r.len - fcElapsed(r));
const fcGot = r => r.got != null ? r.got : Math.max(0, fcPapersToday() - (r.p0 || 0));
const fcN = r => r.one ? Math.max(1, +r.one || 1) : 0;   // papers a "Just one paper" or "Just 3 papers" session is for
const fcClock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

// The work a session can be about: each set of papers waiting to be marked, then the teacher's own to-dos for today or with no day.
function fcWorks() {
  const out = [], today = tdToday();
  for (const m of homeGroups().mark) {
    if (!m.papers) continue;
    const st = keptState(m), w = keptWhere(m);
    out.push({ key: 'mark:' + m.id, id: m.id, mark: true, name: m.name || 'Student work', cls: w.cls ? w.cls.name : '', left: st.left, fm: st.fm });
  }
  for (const it of tdItems().filter(it => !it.done && (!it.d || it.d <= today)).sort((a, b) => (a.d || '9').localeCompare(b.d || '9') || (a.made || 0) - (b.made || 0)).slice(0, 12))
    out.push({ key: 'td:' + it.id, id: it.id, name: it.x, cls: it.c && classById(it.c) ? classById(it.c).name : '' });
  return out;
}
function fcWork(key) {
  if (!key) return null;
  const [k, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  if (k === 'mark') { const m = keptMeta.get(id); if (!m) return null; const st = keptState(m), w = keptWhere(m); return { key, id, mark: true, name: m.name || 'Student work', cls: w.cls ? w.cls.name : '', left: st.left, fm: st.fm }; }
  if (k === 'td') { const it = tdItem(id); return it ? { key, id, name: it.x, cls: it.c && classById(it.c) ? classById(it.c).name : '', done: !!it.done } : null; }
  return null;
}
function fcPicked(works) {
  const want = fcS.pick != null ? fcS.pick : fcLog().last;
  if (want === '' && fcS.pick === '') return '';
  return works.some(w => w.key === want) ? want : works.length ? works[0].key : '';
}

// The sound at the end: two soft notes, made here, so nothing is fetched. The browser lets a page play sound once it has been pressed,
// which starting a session is, so the player is made then and kept.
let fcAudio = null;
function fcAudioWake() { try { if (!fcAudio) fcAudio = new (window.AudioContext || window.webkitAudioContext)(); if (fcAudio.state === 'suspended') fcAudio.resume(); } catch { fcAudio = null; } }
function fcChime() {
  if (!fcConf().sound) return;
  try {
    fcAudioWake(); if (!fcAudio) return;
    const t = fcAudio.currentTime + 0.02;
    for (const [f, d] of [[659.25, 0], [987.77, 0.22]]) {
      const o = fcAudio.createOscillator(), g = fcAudio.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.11, t + d + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 1.4);
      o.connect(g); g.connect(fcAudio.destination); o.start(t + d); o.stop(t + d + 1.5);
    }
  } catch {}
}

function fcStart(len, key, one) {
  fcAudioWake();
  const L = fcLog(); L.last = key || ''; fcLogSet(L);
  const was = fcRun(); if (was && (was.st === 'run' || was.st === 'paused')) fcRecord(was);
  fcRunSet({ st: 'run', len: Math.round(len * 60), at: Date.now(), w: key || '', one: one ? Math.max(1, +one || 1) : 0, p0: fcPapersToday(), fold: false });
  fcGoTo(false);
}
// Into the work: a set of papers opens at the next paper with nothing finished; one already on screen is left where it is.
function fcGoTo(next) {
  const r = fcRun(), w = r && fcWork(r.w); if (!w || !w.mark) return;
  if (batch && batch.id === w.id) {
    if (!$('#app').hidden && (next || fcLeftHere(cur))) { if (next || w.left) nextUnscored(); }
    else if ($('#app').hidden || routeNow().tab) go(batchHash(w.id));
    return;
  }
  const f = cardOfKept(w.id);
  reopenKept(w.id, f || null).then(() => { if (batch && batch.id === w.id && fcLeftHere(cur) && w.left) nextUnscored(); }).catch(e => console.error(e));
}
// Whether the paper on screen is finished already, so the next one is wanted.
function fcLeftHere(i) { const st = batch && batch.students[i]; if (!st) return true; return fmNow() ? !!st.grade.fb || noScore(st) : gradeOf(st).done; }
// A session that ends is written into today: its minutes, and how long its papers took for the pace.
function fcRecord(r) {
  if (r.secs != null) return r;
  const secs = Math.min(r.one ? 4 * 3600 : r.len, fcElapsed(r)), got = fcGot(r), L = fcLog(), today = fcToday(), d = L.days[today] || {};
  L.days[today] = { ...d, s: (d.s || 0) + secs, ...(/^mark:/.test(r.w || '') ? { sm: (d.sm || 0) + secs } : {}) };
  if (got > 0 && secs >= 30) L.pace = [...L.pace, [secs, got]].slice(-20);
  fcLogSet(L);
  return Object.assign(r, { secs, got });
}
function fcUp(r) { fcRecord(r); r.st = 'up'; r.fold = false; fcRunSet(r); fcChime(); }
function fcPause() { const r = fcRun(); if (!r || r.st !== 'run') return; r.st = 'paused'; r.pz = Date.now(); fcRunSet(r); }
function fcResume() { const r = fcRun(); if (!r || r.st !== 'paused') return; r.at += Date.now() - r.pz; delete r.pz; r.st = 'run'; fcRunSet(r); }
function fcMore(min) { const r = fcRun(); if (!r) return; if (r.st === 'run' || r.st === 'paused') { r.len += min * 60; fcRunSet(r); } }
function fcBreak() { const r = fcRun(); if (!r) return; fcAudioWake(); if (r.st === 'run' || r.st === 'paused') fcRecord(r); fcRunSet({ ...r, st: 'brk', brkAt: Date.now(), brkLen: fcConf().brk * 60, fold: false }); }
function fcStop() { const r = fcRun(); if (!r) return; if (r.st === 'run' || r.st === 'paused') fcRecord(r); fcRunSet({ ...r, st: 'done', fold: false }); }
function fcClose() { fcS.open = false; const r = fcRun(); if (r && (r.st === 'done' || r.st === 'brkup' || r.st === 'up')) fcRunSet(null); else fcRender(); }

/* ---------- the clock: once a second while a session or a break is on ---------- */
let fcTimer = 0;
function fcTickOn() {
  const r = fcRun(), on = !!r && (r.st === 'run' || r.st === 'brk');
  if (on && !fcTimer) fcTimer = setInterval(fcTick, 1000);
  if (!on && fcTimer) { clearInterval(fcTimer); fcTimer = 0; }
  fcTitle();
}
function fcTick() {
  const r = fcRun(); if (!r) return fcTickOn();
  if (r.st === 'run') {
    if (r.one ? fcGot(r) >= fcN(r) : fcLeft(r) <= 0) return fcUp(r);
  } else if (r.st === 'brk' && fcLeft(r) <= 0) { r.st = 'brkup'; r.fold = false; fcRunSet(r); fcChime(); return; }
  fcClockDraw(); fcTitle();
}
// The time in the tab's name, so it can be seen from another tab. Put back as it was when nothing is running.
let fcTitlePre = '';
function fcTitle() {
  const r = fcRun(), now = document.title, base = fcTitlePre && now.startsWith(fcTitlePre + ' · ') ? now.slice(fcTitlePre.length + 3) : now;
  let pre = '';
  if (r && fcConf().title) pre = r.st === 'run' ? (r.one ? fcClock(fcElapsed(r)) : fcClock(fcLeft(r))) : r.st === 'brk' ? tr('Break') + ' ' + fcClock(fcLeft(r)) : r.st === 'up' ? '0:00 ✓' : r.st === 'brkup' ? tr('Break’s over') : '';
  fcTitlePre = pre;
  const t = (pre ? pre + ' · ' : '') + base; if (document.title !== t) document.title = t;
}
// Leaving the tab while the clock runs: on the way back after a few minutes, the panel says how long, and the session can go on or start again.
document.addEventListener('visibilitychange', () => {
  const r = fcRun(); if (!r || r.st !== 'run') return;
  if (document.hidden) { r.hid = Date.now(); store.set('gs.focusRun', r); return; }
  if (r.hid && Date.now() - r.hid >= FC_AWAY && !r.one) { r.away = Math.round((Date.now() - r.hid) / 60000); r.fold = false; }
  delete r.hid; fcRunSet(r);
});
// Another tab of the app started, paused or ended a session: this one shows the same.
window.addEventListener('storage', e => { if (e.key === 'gs.focusRun' || e.key === 'gs.focus') { fcTickOn(); fcRender(); } });

/* ---------- drawing ---------- */
const fcRing = (r, w, frac, cls) => { const c = 2 * Math.PI * r, s = 2 * (r + w); return '<svg viewBox="0 0 ' + s + ' ' + s + '"' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true"><circle class="tr" cx="' + (r + w) + '" cy="' + (r + w) + '" r="' + r + '"/><circle class="on" cx="' + (r + w) + '" cy="' + (r + w) + '" r="' + r + '" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + (c * (1 - Math.max(0, Math.min(1, frac)))).toFixed(2) + '"/></svg>'; };
const fcFrac = r => r.st === 'brk' ? fcLeft(r) / (r.brkLen || 1) : r.one ? 1 : fcLeft(r) / (r.len || 1);
const fcUnit = k => k === 'min' ? 'minutes' : 'papers';
// Today against the goal, to be seen at a glance: a dot for each paper of the goal (a block for each 5 minutes of a goal in minutes),
// filled as papers are finished, the ones from the session going on in a deeper blue, a gap at the halfway point, and green with a
// check once it is reached. A goal too big for dots is a bar. With no goal, a quiet line and a way to set one.
const FC_DOTS = 30;
function fcGoalHtml(c, card) {
  if (!c.goal) {
    const p = fcPapersToday();
    return '<div class="fcnogoal"><span>' + (p ? 'Today: ' + people(p, 'paper') : 'No daily goal yet') + '</span><a class="link" href="#/settings/focus">' + (p ? 'Set a goal' : 'Set one') + '</a></div>';
  }
  const n = fcGoalNow(c), met = n >= c.goal.n, r = fcRun(), mins = c.goal.k === 'min';
  const sess = r && (r.st === 'run' || r.st === 'paused') ? (mins ? Math.floor(Math.min(fcElapsed(r), r.one ? 1e9 : r.len) / 60) : fcGot(r)) : 0;
  const step = mins ? 5 : 1, total = Math.ceil(c.goal.n / step), had = Math.floor(n / step), was = Math.floor(Math.max(0, n - sess) / step);
  const pop = card ? '' : fcS.popAt != null && fcS.popAt < had ? had - 1 : -1;
  fcS.popAt = card ? fcS.popAt : had;
  let viz;
  if (total <= FC_DOTS) {
    const half = Math.ceil(total / 2);
    viz = '<span class="fcdots' + (mins ? ' blk' : '') + '" aria-hidden="true">' + Array.from({ length: total }, (_, i) => '<i class="' + [i < was ? 'fon' : i < had ? 'fnow' : '', i === half && total >= 6 ? 'fhalf' : '', i === pop ? 'fpop' : ''].filter(Boolean).join(' ') + '"></i>').join('') + '</span>';
  } else viz = '<span class="fcbar" aria-hidden="true"><i style="width:' + Math.min(100, Math.round(n / c.goal.n * 100)) + '%"></i><b style="left:50%"></b></span>';
  const extra = met && n > c.goal.n ? ' +' + (n - c.goal.n) : '';
  return '<div class="fcgoal' + (met ? ' met' : '') + '" role="img" aria-label="Today: ' + n + ' of ' + c.goal.n + ' ' + fcUnit(c.goal.k) + '"><div class="fcgh"><b>Today</b><span class="fcnum">' +
    (met ? '<span class="fcmet">' + FC_TICK + '<span>Goal reached</span></span>' + (extra ? '<span data-raw>' + extra + '</span>' : '') : '<span>' + n + ' of ' + c.goal.n + ' ' + fcUnit(c.goal.k) + '</span>') + '</span></div>' + viz + '</div>';
}
// This week, one short bar a day from Monday, with a line at the goal and a check over each day that reached it. A day with nothing
// on it is left empty: no mark, no colour. Saturday and Sunday show only when something was done on them. The day names come from
// the browser in the app's language, so the chart is left as it is (data-raw).
function fcWeekHtml(c) {
  const L = fcLog(), today = fcToday(), d0 = new Date(today + 'T12:00:00'); d0.setDate(d0.getDate() - (d0.getDay() + 6) % 7);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(d0); d.setDate(d0.getDate() + i); const k = isoDay(d), v = L.days[k] || {}; return { k, d, v: c.goal && c.goal.k === 'min' ? Math.floor((v.s || 0) / 60) + (k === today ? Math.floor(fcSecsToday() / 60) - Math.floor((v.s || 0) / 60) : 0) : (k === today ? fcPapersToday() : v.p || 0) }; })
    .filter((x, i) => i < 5 || x.v > 0 || x.k === today);
  if (!days.some(x => x.v > 0)) return '';
  const goal = c.goal ? c.goal.n : 0, top = Math.max(goal * 1.25, ...days.map(x => x.v), 1);
  return '<div class="fcweek"><span class="fcl">This week</span><div class="fcwk' + (goal ? ' hasg' : '') + '" style="--g:' + Math.round(goal / top * 100) + '%" role="img" data-raw aria-label="' + esc(days.map(x => x.d.toLocaleDateString(LANG_LOCALE, { weekday: 'short' }) + ' ' + x.v).join(', ')) + '">' +
    days.map(x => '<span class="fcwd' + (x.k === today ? ' now' : '') + (x.k > today ? ' later' : '') + (goal && x.v >= goal ? ' met' : '') + '"><span class="fcwc">' + (goal && x.v >= goal ? FC_TICK : '') + '</span><span class="fcwb"><i style="height:' + Math.round(x.v / top * 100) + '%"></i></span><span class="fcwl" data-raw>' + esc(x.d.toLocaleDateString(LANG_LOCALE, { weekday: 'narrow' })) + '</span></span>').join('') + '</div></div>';
}
function fcWorkSay(w) {
  if (!w) return 'A session with nothing set: the timer only.';
  if (!w.mark) return 'A to-do';
  if (!w.left) return w.fm ? 'Feedback is complete for everyone' : 'Everyone has a score';
  const it = cardOfKept(w.id), pace = gpReady ? gpPaces()(it ? it.id : '') : fcPace();
  return [people(w.left, 'paper') + ' left', pace ? 'about ' + people(Math.max(1, Math.round(w.left * pace / 60)), 'minute') + ' at your pace' : ''].filter(Boolean).join(' · ');
}
// The start: today against the goal, what to work on, and one button. Shared by the card on Today and the panel. On Today the
// button is a plain one, as Today keeps its one blue button for the next thing to do with the papers.
function fcStartHtml(card) {
  const c = fcConf(), works = fcWorks(), key = fcPicked(works), w = works.find(x => x.key === key) || null, len = fcS.len || c.len;
  const opt = x => '<option value="' + esc(x.key) + '"' + (x.key === key ? ' selected' : '') + ' data-raw>' + esc(x.name + (x.cls ? ' · ' + x.cls : '')) + '</option>';
  const marks = works.filter(x => x.mark), tds = works.filter(x => !x.mark);
  return '<div class="fcbody">' + gpTopHtml(w) + fcGoalHtml(c, true) + (card ? fcWeekHtml(c) + tkTodayHtml() : '') + '<div class="fcline"></div>' +
    '<div><label class="fcl">Work on</label><select class="fcwork" data-fcwork aria-label="Work on">' + marks.map(opt).join('') +
    (marks.length && tds.length ? '<option disabled data-raw>──────────</option>' : '') + tds.map(opt).join('') + '<option value=""' + (key === '' ? ' selected' : '') + '>' + esc(tr('Nothing in particular')) + '</option></select>' +
    '<p class="fcsay">' + esc(fcWorkSay(w)) + '</p></div>' +
    '<div class="fcgo"><button class="btn' + (card ? '' : ' primary') + '" data-fcstart="' + len + '">' + FC_PLAY + '<span>Start ' + len + ' minutes</span></button>' + (w && w.mark && w.left ? '<button class="btn" data-fcone>Just one paper</button>' : '') + (w && w.mark && w.left >= 3 ? '<button class="btn" data-fcone="3">Just 3 papers</button>' : '') + '</div>' +
    (w && w.mark && w.left > 1 ? '<label class="fcshort"><input type="checkbox" data-fcshort' + (c.short ? ' checked' : '') + '> Shortest papers first</label>' : '') +
    '<div class="fclens" role="group" aria-label="How long"><span>Or</span>' + [5, 10, 15, 25].concat(FC_LENS.includes(len) && ![5, 10, 15, 25].includes(len) ? [len] : []).sort((a, b) => a - b).map(n => '<button data-fclen="' + n + '" aria-pressed="' + (n === len) + '">' + n + '</button>').join('') + '<span>minutes</span></div></div>';
}
function fcCardRender() {
  const box = $('#fcCardBody'); if (!box) return;
  const r = fcRun(), on = r && r.st !== 'done';
  const h = on ? '<div class="fcbody">' + fcGoalHtml(fcConf(), true) + fcWeekHtml(fcConf()) + '<div class="fcline"></div><div class="fcnogoal"><span>' + (r.st === 'brk' || r.st === 'brkup' ? 'You are on a break' : 'A session is on') + '</span><button class="btn sm" data-fcshow>Show the timer</button></div></div>' : fcStartHtml(true);
  if (box.dataset.h !== h) { box.dataset.h = h; box.innerHTML = h; }
}
const fcHead = (cap, fold) => '<div class="fchead"><h2 class="tcap">' + cap + '</h2><span class="sp"></span>' + (fold ? '<button class="icon" data-fcfold title="Fold it away" aria-label="Fold it away">–</button>' : '<button class="icon" data-fcclose title="Close" aria-label="Close">✕</button>') + '</div>';
function fcWhatHtml(r, w) {
  const sub = [w && w.cls ? '<span data-raw>' + esc(w.cls) + '</span>' : '', r.one ? (fcN(r) > 1 ? 'Just 3 papers' : 'Just one paper') : w && w.mark ? (w.left ? people(w.left, 'paper') + ' left' : w.fm ? 'Feedback is complete for everyone' : 'Everyone has a score') : w ? 'A to-do' : 'The timer only'].filter(Boolean);
  return '<div class="fcwhat"><b data-raw>' + esc(w ? w.name : tr('Focus')) + '</b><span>' + sub.map(x => x.startsWith('<') ? x : '<span>' + esc(x) + '</span>').join(' · ') + '</span>' +
    (w && w.mark && w.left && r.st !== 'brk' ? '<button class="btn sm primary" data-fcnext>Next paper →</button>' : '') + '</div>';
}
function fcPanelHtml(r) {
  const c = fcConf(), w = r ? fcWork(r.w) : null;
  if (!r) return fcHead('Focus') + fcStartHtml();
  if (r.fold && (r.st === 'run' || r.st === 'paused' || r.st === 'brk')) {
    const got = r.st === 'brk' ? 0 : fcGot(r);
    return '<button class="fcpill' + (r.st === 'brk' ? ' brk' : '') + '" data-fcunfold title="Show the timer"><span class="fcpr"></span><b class="fct"></b>' + (w ? '<span data-raw>' + esc(w.name) + '</span>' : '') + (c.goal ? '<span class="fcpg' + (fcGoalNow(c) >= c.goal.n ? ' met' : '') + '">' + fcGoalNow(c) + '/' + c.goal.n + '</span>' : got ? '<span>' + got + ' done</span>' : '') + '</button>';
  }
  if (r.st === 'run' || r.st === 'paused') {
    if (r.away) return fcHead('Focusing', true) + '<div class="fcrunv"><p class="fcbig">Welcome back</p><p class="fcp">' + esc('You were away for ' + people(r.away, 'minute') + ', and the clock kept going.') + '</p>' +
      '<div class="fcacts"><button class="btn sm primary" data-fcaway="keep">Keep going</button><button class="btn sm" data-fcaway="again">Start the clock again</button></div></div>';
    const got = fcGot(r);
    return fcHead(r.st === 'paused' ? 'Paused' : 'Focusing', true) + '<div class="fcrunv"><div class="fctop"><div class="fcclock' + (r.st === 'paused' ? ' paused' : '') + '"><span class="fcpr"></span><span class="fctime fct"></span></div>' + fcWhatHtml(r, w) + '</div>' +
      '<div class="fcstats"><div class="fcstat"><span>This session</span><span>' + people(got, 'paper') + '</span></div>' + fcGoalHtml(c) + '</div>' +
      '<div class="fcacts">' + (r.st === 'paused' ? '<button class="btn sm primary" data-fcresume>Carry on</button>' : '<button class="btn sm" data-fcpause>Pause</button>') + (r.one ? '' : '<button class="btn sm" data-fcmore="5">+5 minutes</button>') + '<span class="sp"></span><button class="btn sm ghost" data-fcstop>End</button></div></div>';
  }
  if (r.st === 'up') {
    const got = r.got || 0;
    return fcHead('Focus') + '<div class="fcrunv"><p class="fcbig ok"><span class="fcok">' + FC_TICK + '</span><span>' + (r.one ? (fcN(r) > 1 ? '3 papers done' : 'One paper done') : people(Math.round(r.len / 60), 'minute') + ' done') + '</span></p>' +
      (w && !w.mark && !got ? '' : '<p class="fcp">' + (got ? esc('You finished ' + people(got, 'paper') + '.') : 'Nothing was finished in this one.') + '</p>') +
      '<div class="fcstats">' + fcGoalHtml(c) + '</div>' +
      (r.one ? '<div class="fcacts">' + (w && w.left ? (fcN(r) > 1 && w.left >= 3 ? '<button class="btn primary" data-fcone="3">3 more papers</button>' : '<button class="btn primary" data-fcone>One more paper</button>') : '') + '<button class="btn" data-fcstart="' + c.len + '">' + 'Keep going for ' + c.len + ' minutes' + '</button></div>'
        : '<div class="fcacts"><button class="btn primary" data-fcbreak>Take a ' + c.brk + '-minute break</button><button class="btn" data-fcstart="' + Math.round(r.len / 60) + '" data-fcagain>' + Math.round(r.len / 60) + ' more minutes</button></div>') +
      '<div class="fcacts"><button class="btn sm ghost" data-fcstop>Stop for now</button></div></div>';
  }
  if (r.st === 'brk') return fcHead('Break', true) + '<div class="fcrunv"><div class="fctop"><div class="fcclock brk"><span class="fcpr"></span><span class="fctime fct"></span></div>' +
    '<div class="fcwhat"><b>' + (w ? 'After the break' : 'A break') + '</b>' + (w ? '<span data-raw>' + esc(w.name) + '</span>' : '') + '</div></div>' +
    '<div class="fcbrkbox">Stand up, get some water, look at something far away. A chime says when the break is over.</div>' +
    '<div class="fcacts"><button class="btn sm primary" data-fcstart="' + c.len + '" data-fcagain>Back to work now</button><span class="sp"></span><button class="btn sm ghost" data-fcstop>Stop for now</button></div></div>';
  if (r.st === 'brkup') return fcHead('Focus') + '<div class="fcrunv"><p class="fcbig">Break’s over</p>' + (w ? '<p class="fcp"><span class="fcl">Next</span><b data-raw>' + esc(w.name) + '</b></p>' : '') +
    '<div class="fcacts"><button class="btn primary" data-fcstart="' + c.len + '" data-fcagain>' + FC_PLAY + '<span>Start ' + c.len + ' minutes</span></button><button class="btn sm ghost" data-fcstop>Stop for now</button></div></div>';
  // done for now
  const p = fcPapersToday(), mins = Math.round(fcSecsToday() / 60), wk = fcWeekPapers(), met = c.goal && fcGoalNow(c) >= c.goal.n, tdOpen = w && !w.mark && !w.done;
  return fcHead('Focus') + '<div class="fcrunv">' + (met ? '<p class="fcbig ok"><span class="fcok">' + FC_TICK + '</span><span>Today’s goal reached</span></p>' : '<p class="fcbig">Done for now</p>') +
    '<p class="fcp"><span>' + esc(mins ? 'Today: ' + people(p, 'paper') + ' in ' + people(mins, 'minute') + ' of focus.' : 'Today: ' + people(p, 'paper') + '.') + '</span>' + (wk > p ? ' <span>' + esc('This week: ' + people(wk, 'paper') + '.') + '</span>' : '') + '</p>' +
    (c.goal ? '<div class="fcstats">' + fcGoalHtml(c) + fcWeekHtml(c) + '</div>' : '') +
    (tdOpen ? '<p class="fcp muted"><span>Is this to-do done?</span> <b data-raw>' + esc(w.name) + '</b></p><div class="fcacts"><button class="btn sm primary" data-fctick>Mark it done</button><button class="btn sm" data-fcclose>Not yet</button></div>' : '<div class="fcacts"><button class="btn sm" data-fcclose>Close</button></div>') + '</div>';
}
// The parts that change each second are set on their own, so the buttons around them are never redrawn under a press.
function fcClockDraw() {
  const r = fcRun(), el = $('#fcPanel');
  if (r && el && !el.hidden) {
    const t = r.st === 'brk' ? fcLeft(r) : r.one ? fcElapsed(r) : fcLeft(r), frac = fcFrac(r), pill = el.querySelector('.fcpill');
    for (const x of el.querySelectorAll('.fct')) { const s = fcClock(t); if (x.textContent !== s) x.textContent = s; }
    for (const x of el.querySelectorAll('.fcpr')) { const k = pill ? 'p' : 'c', h = pill ? fcRing(10, 3, frac) : fcRing(40, 6, frac); if (x.dataset.k !== k || !x.firstChild) { x.dataset.k = k; x.innerHTML = h; } else { const on = x.querySelector('.on'), c = +on.getAttribute('stroke-dasharray'); on.setAttribute('stroke-dashoffset', (c * (1 - Math.max(0, Math.min(1, frac)))).toFixed(2)); } }
  }
  const rb = $('#railFocus'); if (!rb) return;
  // Focus in the sidebar: the time left and the session's ring while one is on; otherwise today against the goal, "6/10", and its ring.
  const on = r && (r.st === 'run' || r.st === 'paused' || r.st === 'brk'), c = fcConf(), cnt = $('#railFocusT');
  const gn = c.goal ? fcGoalNow(c) : 0, gfrac = c.goal ? Math.min(1, gn / c.goal.n) : 0, met = !!c.goal && gn >= c.goal.n;
  const s = on ? (r.st === 'brk' ? fcClock(fcLeft(r)) : r.one ? fcClock(fcElapsed(r)) : fcClock(fcLeft(r))) : r && r.st === 'up' ? '0:00' : c.goal ? gn + '/' + c.goal.n : '';
  if (cnt.textContent !== s) cnt.textContent = s;
  cnt.classList.toggle('fcrun', !!on); cnt.classList.toggle('fcmetc', !on && met);
  rb.classList.toggle('fcbrk', !!on && r.st === 'brk'); rb.classList.toggle('fcgoalon', !on && !!c.goal); rb.classList.toggle('fcmet', !on && met);
  const ico = rb.querySelector('.fcico'), ring = ico.querySelector('.fcring'), frac = on ? fcFrac(r) : gfrac, want = on || !!c.goal;
  if (!want) { if (ring) ring.remove(); }
  else if (!ring) ico.insertAdjacentHTML('beforeend', fcRing(15, 2, frac, 'fcring'));
  else { const o = ring.querySelector('.on'), cc = +o.getAttribute('stroke-dasharray'); o.setAttribute('stroke-dashoffset', (cc * (1 - Math.max(0, Math.min(1, frac)))).toFixed(2)); }
  rb.title = on ? (r.st === 'brk' ? 'Break: ' : r.st === 'paused' ? 'Paused: ' : r.one ? (fcN(r) > 1 ? 'Just 3 papers: ' : 'Just one paper: ') : 'Focus: ') + s + (r.one || r.st === 'paused' ? '' : ' left') : c.goal ? 'Focus: ' + gn + ' of ' + c.goal.n + ' ' + fcUnit(c.goal.k) + ' today' : 'Focus: a timer for grading, and your daily goal';
}
function fcPanelRender() {
  const el = $('#fcPanel'); if (!el) return;
  const r = fcRun(), show = !!r || fcS.open;
  el.hidden = !show;
  if (show) {
    const rail = $('#rail'), rr = rail && rail.offsetParent !== null ? rail.getBoundingClientRect().right : 0;
    el.style.setProperty('--fc-left', Math.max(0, Math.round(rr)) + 16 + 'px');
    const h = fcPanelHtml(r), fold = !!r && r.fold && (r.st === 'run' || r.st === 'paused' || r.st === 'brk');
    el.classList.toggle('fold', fold);
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  } else if (el.dataset.h) { el.dataset.h = ''; el.innerHTML = ''; }
  fcClockDraw();
}
function fcRender() {
  if (!FC_ON || !shellReady) return;
  fcCardRender(); fcPanelRender(); fcTitle(); gpQuiet();
}

/* ---------- presses ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-fcstart], [data-fcone], [data-fclen], [data-fcnext], [data-fcpause], [data-fcresume], [data-fcmore], [data-fcstop], [data-fcbreak], [data-fcfold], [data-fcunfold], [data-fcclose], [data-fcshow], [data-fcaway], [data-fctick], #railFocus');
  if (!t) return;
  const d = t.dataset, box = t.closest('.fcbody, #fcPanel'), sel = box && box.querySelector('[data-fcwork]');
  const pick = () => sel ? sel.value : fcRun() ? fcRun().w : fcPicked(fcWorks());
  if (t.id === 'railFocus') { e.preventDefault(); const r = fcRun(); if (r) { r.fold = !r.fold && (r.st === 'run' || r.st === 'paused' || r.st === 'brk'); fcRunSet(r); } else { fcS.open = !fcS.open; fcRender(); } return; }
  if (d.fcstart != null) return fcStart(+d.fcstart, d.fcagain != null && fcRun() ? fcRun().w : pick(), false);
  if (d.fcone != null) return fcStart(fcConf().len, fcRun() && fcRun().st === 'up' ? fcRun().w : pick(), +d.fcone || 1);
  if (d.fclen != null) { fcS.len = +d.fclen; return fcRender(); }
  if (d.fcnext != null) return fcGoTo(true);
  if (d.fcpause != null) return fcPause();
  if (d.fcresume != null) return fcResume();
  if (d.fcmore != null) return fcMore(+d.fcmore);
  if (d.fcbreak != null) return fcBreak();
  if (d.fcstop != null) return fcStop();
  if (d.fcfold != null || d.fcunfold != null || d.fcshow != null) { const r = fcRun(); if (r) { r.fold = d.fcfold != null; fcRunSet(r); } else { fcS.open = true; fcRender(); } return; }
  if (d.fcaway) { const r = fcRun(); if (!r) return; delete r.away; if (d.fcaway === 'again') { r.at = Date.now(); r.st = 'run'; delete r.pz; } return fcRunSet(r); }
  if (d.fctick != null) { const r = fcRun(), w = r && fcWork(r.w); if (w && !w.mark && !w.done) todoTick(w.id); fcS.open = false; return fcRunSet(null); }
  if (d.fcclose != null) return fcClose();
});
document.addEventListener('change', e => {
  const s = e.target.closest('[data-fcwork]'); if (!s) return;
  fcS.pick = s.value; const L = fcLog(); L.last = s.value; fcLogSet(L); fcRender();
});
// Esc folds a running session's panel, or closes the panel opened by hand.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !$('#fcPanel') || $('#fcPanel').hidden || !e.target.closest || !(e.target.closest('#fcPanel') || e.target === document.body)) return;
  const r = fcRun();
  if (r && (r.st === 'run' || r.st === 'paused' || r.st === 'brk')) { if (!r.fold) { r.fold = true; fcRunSet(r); } }
  else if (!r && fcS.open) { fcS.open = false; fcRender(); }
});
// A to-do's own Focus button (src/todo.js) starts a session on it.
function focusOn(key) { fcStart(fcConf().len, key, false); }

/* ---------- Settings, Focus and goals ---------- */
function fcSetRender(sec) {
  if (sec !== 'focus') return;
  const c = fcConf(), put = (id, h) => { const el = $(id); if (el && el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; } };
  const sel = (id, list, v, label) => '<select id="' + id + '" class="btn sm" aria-label="' + label + '">' + list.map(n => '<option value="' + n + '"' + (n === v ? ' selected' : '') + '>' + n + ' minutes</option>').join('') + '</select>';
  put('#setFocus', '<div class="lhead"><h2>Focus timer</h2><span class="muted">A timer for grading in short sessions, with breaks in between. Start it from Focus in the sidebar or the card on Today.</span></div>' +
    '<p class="setp fcset"><label for="fcLen"><b>A session lasts</b></label>' + sel('fcLen', FC_LENS, c.len, 'A session lasts') + '<label for="fcBrk"><b>A break lasts</b></label>' + sel('fcBrk', FC_BRKS, c.brk, 'A break lasts') + '</p>' +
    '<p class="setp"><label><input type="checkbox" id="fcSound"' + (c.sound ? ' checked' : '') + '> A soft chime when a session or a break ends</label></p>' +
    '<p class="setp"><label><input type="checkbox" id="fcTitle"' + (c.title ? ' checked' : '') + '> The time left in the browser tab’s name, so you can see it from another tab</label></p>');
  const k = c.goal ? c.goal.k : '';
  put('#setGoal', '<div class="lhead"><h2>Daily goal</h2><span class="muted">How much you want to grade in a day. Today and the timer show how far along you are. Nothing happens on a day you don’t get there.</span></div>' +
    '<p class="setp fcset"><span class="seg" id="fcGoalK" role="group" aria-label="Daily goal">' + [['', 'No goal'], ['papers', 'Papers'], ['min', 'Minutes']].map(([v, l]) => '<button data-v="' + v + '" aria-pressed="' + (k === v) + '">' + l + '</button>').join('') + '</span>' +
    (c.goal ? '<input type="number" id="fcGoalN" min="1" max="' + (k === 'min' ? 600 : 500) + '" step="1" value="' + c.goal.n + '" aria-label="' + (k === 'min' ? 'Minutes a day' : 'Papers a day') + '"><span class="muted">' + (k === 'min' ? 'minutes of focus a day' : 'papers a day') + '</span>' : '') + '</p>' +
    '<p class="muted setp">A paper counts when its score is finished, or its feedback is complete on a formative activity, wherever you do it. Minutes count while a session runs.</p>');
}
$('#setPane').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'fcLen') { fcS.len = 0; fcConfSet({ len: +t.value }); return setRender(); }
  if (t.id === 'fcBrk') { fcConfSet({ brk: +t.value }); return setRender(); }
  if (t.id === 'fcSound') { fcConfSet({ sound: t.checked }); if (t.checked) { fcAudioWake(); fcChime(); } return setRender(); }
  if (t.id === 'fcTitle') { fcConfSet({ title: t.checked }); return setRender(); }
  if (t.id === 'fcGoalN') { const g = fcConf().goal; if (!g) return; const n = Math.round(+t.value); if (n > 0) fcConfSet({ goal: { k: g.k, n } }); return setRender(); }
});
$('#setPane').addEventListener('click', e => {
  const b = e.target.closest('#fcGoalK [data-v]'); if (!b) return;
  const v = b.dataset.v, g = fcConf().goal;
  fcConfSet({ goal: v ? { k: v, n: g && g.k === v ? g.n : v === 'min' ? 60 : 10 } : null });
  setRender();
  const n = $('#fcGoalN'); if (n) { n.focus(); n.select(); }
});

FC_ON = true;
fcSeen(); fcTickOn();
window.__gs = Object.assign(window.__gs || {}, { fcConf, fcLog, fcRun, fcRunSet, fcStart, fcPapersToday, fcSeen, fcTick, fcPace, focusOn });
