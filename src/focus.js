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
                     add: [{ id, d: day, k: 'g' | 'l', s: seconds, x: a few words }] time added by hand (src/tracker.js),
                     carry: a session goal not reached, by: { <download id>: the day to finish it by } }
                   A day also keeps n: the sessions of a minute or more. The goal can be { k, n, per: 'week' } or for some days { days: [1, 3] }.
                   A session's own goal (sg on gs.focusRun) is a few papers, the whole set, the to-do, or a few words she typed.
                   Ids and numbers only: no name, no title, nothing a student wrote. Days are kept for 400 days.
     gs.focusRun   the session going on in this browser, so a refresh keeps it. It stays in this browser (LS_LOCAL).
   A paper counts toward the day when its score is finished, or its feedback complete on a formative activity, wherever that is
   done: the count is how far each download has come since the day began (keptState), so marking in Quick mark counts too. */
var FC_ON = false;   // set at the end of this file; keepWork (src/app/kept.js) may run before it
const FC_LENS = [5, 10, 15, 20, 25, 30, 45, 60], FC_BRKS = [3, 5, 10, 15], FC_AWAY = 180e3, FC_DAY = 864e5, FC_KEEP = 400, TK_IDLES = [2, 5, 10, 15];
// A goal a week can be bigger than a goal a day. The days are 0 Sunday to 6 Saturday; null is every day.
const FC_DOWS = [1, 2, 3, 4, 5, 6, 0];
const fcGoalMax = (k, per) => (k === 'min' ? 600 : 500) * (per === 'week' ? 7 : 1);
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
    sg: f.sg !== false,   // a goal suggested for each session
    music: f.music === true, mood: LOFI_STYLES.some(x => x.id === f.mood) ? f.mood : 'mix', mvol: +f.mvol >= .05 && +f.mvol <= 1 ? +f.mvol : .5, mamb: f.mamb === true,   // lo-fi music while a session runs (src/lofi.js)
    goal: g && (g.k === 'papers' || g.k === 'min') && +g.n > 0 ? { k: g.k, n: Math.min(fcGoalMax(g.k, g.per), Math.round(+g.n)), per: g.per === 'week' ? 'week' : 'day',
      days: g.per !== 'week' && Array.isArray(g.days) && g.days.some(d => FC_DOWS.includes(d)) ? FC_DOWS.filter(d => g.days.includes(d)) : null } : null };
}
// Only what differs from the usual is kept; nothing at all for a teacher who changed nothing.
function fcConfSet(part) {
  const c = { ...fcConf(), ...part }, o = {};
  if (c.len !== 10) o.len = c.len;
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
    ...(typeof L.lbHid === 'string' ? { lbHid: L.lbHid } : {}),   // the week whose look-back was put away (src/gradeplan.js)
    // carry: a session goal not reached, for the next session on the same work: { w, t: when, k: 'papers' | 'set' | 'td' | 'note', n, x }
    ...(L.carry && typeof L.carry.w === 'string' && L.carry.t > 0 ? { carry: L.carry } : {}),
    ...(L.by && typeof L.by === 'object' ? { by: L.by } : {}) };   // { <download>: 'YYYY-MM-DD' }: the day a set is to be finished by
}
const fcLogSet = L => store.set('gs.focus', L);
// The Monday of a day's week ('YYYY-MM-DD'): a week starts on Monday, and Sunday belongs to the week before. Noon keeps a change
// of clocks from moving the day.
function fcMon(day) { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoDay(d); }
const fcToday = () => isoDay(Date.now());
// Papers marked: a formative activity's feedback complete, else scored papers she worked on (src/merge.js workCounts marked). A grade
// only typed in, with no marking, isn't one. A download saved before marked was counted falls back on its scores until its next save.
const fcDone = m => { const st = keptState(m); return st.fm || m.marked == null ? st.done : Math.min(st.of, m.marked); };
// Papers finished today: how far each download has come since the day began, never below nothing.
// A download whose papers marked aren't known yet (a row from before they were counted, until loadKept works them out) isn't counted.
// One with no counts at all hasn't been saved yet: nothing is finished in it.
const fcKnown = m => !!m && (m.marked != null || m.scored == null || keptState(m).fm);
function fcPapersOf(L) { let n = 0; for (const m of keptMeta.values()) if (fcKnown(m) && m.id in L.base) n += Math.max(0, fcDone(m) - L.base[m.id]); return n; }
// The same, by assignment (an id from the classes, or '' for papers that aren't filed under one), for the tracker.
function fcPapersBy(L) {
  const o = {};
  for (const m of keptMeta.values()) if (fcKnown(m) && m.id in L.base) { const n = Math.max(0, fcDone(m) - L.base[m.id]); if (!n) continue; const it = cardOfKept(m.id), k = it ? it.id : ''; o[k] = (o[k] || 0) + n; }
  return o;
}
// Where a download's count starts today: where it stands, or where the older copy it carried marks over from stood. A new copy is
// listed before its first save, with no count yet, so the marks it carries from yesterday would otherwise all count as today's.
function fcFrom(id, m) { const old = [...keptMeta.values()].find(o => o && o.newer === id); return Math.max(m ? fcDone(m) : 0, old ? fcDone(old) : 0); }
// Called before a download's count changes (keepWork) and whenever the card or panel is drawn: a new day starts from where each
// download stands, a download seen for the first time starts from where it is, and today's total is written down for the week.
// id: a download about to be saved (keepWork). One not known yet is new: it starts from nothing, or from where the older copy it
// carried marks over from stood, so carried marks don't count as today's.
// Nothing is counted or written before the downloads have been read: at first the list is empty, and every count would start again.
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
// Work that comes in from somewhere else (the folder, with marks made on another computer, or a copy restored from an earlier day) wasn't
// finished here today: the day's starting point moves with it, so only what is done here from now on counts. m0, m: the row before and after.
function fcCame(id, m0, m) {
  if (!FC_ON || !keptRead || !m) return;
  const L = fcLog(); if (L.day !== fcToday() || !(id in L.base)) return;
  const b = Math.max(0, L.base[id] + fcDone(m) - (m0 ? fcDone(m0) : 0));
  if (b !== L.base[id]) { L.base[id] = b; fcLogSet(L); }
}
const fcPapersToday = () => { fcSeen(); return fcPapersOf(fcLog()); };
const fcSecsToday = () => { const d = fcLog().days[fcToday()] || {}, r = fcRun(); return (d.s || 0) + (r && (r.st === 'run' || r.st === 'paused') ? fcBusy(r) : 0); };
function fcWeekPapers() {
  const L = fcLog(), today = fcToday(), mon = fcMon(today); return Object.entries(L.days).filter(([k]) => k >= mon && k <= today).reduce((a, [, v]) => a + (v.p || 0), 0);
}
function fcWeekMins() {
  const L = fcLog(), today = fcToday(), mon = fcMon(today); return Math.floor((Object.entries(L.days).filter(([k]) => k >= mon && k < today).reduce((a, [, v]) => a + (v.s || 0), 0) + fcSecsToday()) / 60);
}
const fcWeekPapersNow = () => { const L = fcLog(), t = (L.days[fcToday()] || {}).p || 0; return fcWeekPapers() - t + fcPapersToday(); };
const fcGoalNow = c => !c.goal ? 0 : c.goal.per === 'week' ? (c.goal.k === 'papers' ? fcWeekPapersNow() : fcWeekMins()) : (c.goal.k === 'papers' ? fcPapersToday() : Math.floor(fcSecsToday() / 60));
// Whether today is one of the days a daily goal is for.
const fcGoalDay = (c, day) => !c.goal || c.goal.per === 'week' || !c.goal.days || c.goal.days.includes(new Date((day || fcToday()) + 'T12:00:00').getDay());

/* ---------- the session ---------- */
// { st: 'run' | 'paused' | 'up' | 'brk' | 'brkup' | 'done', len: seconds, at: when it started (moved on by any pause), pz: when it was paused,
//   w: 'mark:<download>' | 'td:<to-do>' | '', one: just one paper, p0: see FC_P0, pg: papers finished so far (fcGain), fold, hid: when the tab was left,
//   away: minutes away to say so, got: papers the session finished, secs: seconds it ran, brkAt, brkLen }
const fcRun = () => { const r = store.get('gs.focusRun', null); return r && r.st ? r : null; };
const fcRunSet = r => { if (r) store.set('gs.focusRun', r); else store.del('gs.focusRun'); fcTickOn(); fcRender(); };
const fcElapsed = r => Math.max(0, Math.round(((r.st === 'paused' ? r.pz : Date.now()) - r.at) / 1000));
// On papers, time with nothing pressed, typed or scrolled for longer than the tracker's minutes (src/tracker.js) doesn't count, the
// same as grading time: a session left running, or a laptop asleep, isn't grading. A to-do may be done away from the screen, so its
// time counts as it runs. r.idl: seconds not counted so far; r.ii: when the stretch going on began.
const fcBoot = Date.now();
const fcIdle = r => (r.idl || 0) + (r.ii ? Math.max(0, Math.round(((r.st === 'paused' ? r.pz : Date.now()) - r.ii) / 1000)) : 0);
const fcBusy = r => Math.max(0, fcElapsed(r) - fcIdle(r));
function fcIdleSee(r) {
  if (!/^mark:/.test(r.w || '')) return false;
  // r.seen: the last time she did something, written every half minute, so another tab of the app doesn't take her for away
  const a = Math.max(fcBoot, r.at, r.seen || 0, tkReady ? tkLast : 0), lim = fcConf().idle * 60e3;
  if (tkReady && tkLast - (r.seen || 0) > 30e3 && !r.ii) { r.seen = tkLast; return true; }
  if (r.ii && a > r.ii) { r.idl = (r.idl || 0) + Math.round((a - r.ii) / 1000); delete r.ii; return true; }
  if (!r.ii && Date.now() - a > lim) { r.ii = a + lim; return true; }
  return false;
}
const fcLeft = r => r.st === 'brk' ? Math.max(0, Math.round((r.brkAt + r.brkLen * 1000 - Date.now()) / 1000)) : Math.max(0, r.len - fcElapsed(r));
// Papers a session has finished: counted as they are saved (fcGain), in the run itself, so every tab says the same. A count of the day
// in each tab would differ between tabs (each has its own list of downloads), and the first tab to see a bigger one ended the session.
const fcGot = r => r.got != null ? r.got : Math.max(0, r.pg || 0);
// A save of a download's work while a session runs: the papers it finished (or took back) go into the session. Called by keepWork in the
// tab that saved, with the row before and after. A row from before marked was counted says nothing, rather than a jump.
function fcGain(m0, m) {
  if (!FC_ON || !m0 || !m) return;
  const r = fcOwnRun(fcRun()); if (!r || (r.st !== 'run' && r.st !== 'paused') || r.got != null) return;
  if (!fcKnown(m0) || !fcKnown(m)) return;
  // a first save brings marks carried over from an older copy, which weren't finished now
  const d = fcDone(m) - (m0.scored == null && m0.marked == null ? fcFrom(m.id, m0) : fcDone(m0)); if (!d) return;
  r.pg = (r.pg || 0) + d; store.set('gs.focusRun', r);
}
// p0 is for pages from before fcGain (a tab not updated yet), which count a session from the day's papers less p0: a number they never
// reach keeps such a tab from ending a session it didn't see.
const FC_P0 = 1e9;
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
// The work the card suggests: one picked by hand, else the set she left off on, else the work picked last, else the first.
function fcPicked(works) {
  if (fcS.pick === '') return '';
  const b = gpReady && fcS.pick == null && gpBack(), want = fcS.pick != null ? fcS.pick : b ? 'mark:' + b.id : fcLog().last;
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

/* ---------- a goal for each session ----------
   Set in a press before the session starts, kept in view while it runs, and looked at when it ends. A goal not reached goes into the
   next session on the same work (for three days), so a set can be worked through over several sittings. Without a goal picked by hand,
   one is suggested: what was carried over, or as many papers as the session usually holds at her pace (Settings can switch that off). */
const FC_CARRY = 12 * 3600e3;
function fcSgSuggest(w, len) {
  const cy = fcLog().carry, key = w ? w.key : '';
  if (cy && cy.w === key && Date.now() - cy.t < FC_CARRY) {
    if (cy.k === 'papers' && w && w.mark && w.left) return { k: 'papers', n: Math.max(1, Math.min(+cy.n || 1, w.left)), c: 1 };
    if (cy.k === 'set' && w && w.mark && w.left) return { k: 'set', c: 1 };
    if (cy.k === 'td' && w && !w.mark && !w.done) return { k: 'td', c: 1 };
    if (cy.k === 'note' && !w && cy.x) return { k: 'note', x: String(cy.x).slice(0, 80), c: 1 };
  }
  if (!fcConf().sg || !w) return null;
  if (!w.mark) return w.done ? null : { k: 'td' };
  if (!w.left) return null;
  const it = cardOfKept(w.id), pace = gpReady ? gpPaces()(it ? it.id : '') : 0;
  if (!pace) return null;
  const n = Math.max(1, Math.round(len * 60 / pace));
  return n >= w.left ? { k: 'set' } : { k: 'papers', n };
}
// The goal the next session gets: one picked by hand on this work, else the suggestion.
const fcSgNow = (w, len) => fcS.sg !== undefined && fcS.sgw === (w ? w.key : '') ? fcS.sg : fcSgSuggest(w, len);
// The papers a goal in papers starts at: the one picked, else as many as the session usually holds, else 3.
function fcSgN(g, w, len) {
  if (g && g.k === 'papers') return g.n;
  const s = len ? fcSgSuggest(w, len) : null;
  return Math.min(w && w.left || 1, s && s.k === 'papers' ? s.n : 3);
}
// Whether the session's goal is reached: its papers finished, the set finished, the to-do ticked, or "I got it done" pressed.
function fcSgMet(r, w) {
  const g = r.sg; if (!g) return false;
  if (r.sgMet != null) return r.sgMet;
  return g.k === 'papers' ? fcGot(r) >= g.n : g.k === 'set' ? !!w && !!w.mark && !w.left : g.k === 'td' ? !!w && !!w.done : false;
}
function fcSgText(g, r, w) {
  if (g.k === 'papers') return r && !fcSgMet(r, w) ? fcGot(r) + ' of ' + g.n + ' papers' : people(g.n, 'paper');
  return g.k === 'set' ? 'Finish the set' : g.k === 'td' ? 'Finish this to-do' : '';
}
const fcSgSpan = (g, r, w) => g.k === 'note' ? '<span data-raw>' + esc(g.x) + '</span>' : '<span>' + esc(fcSgText(g, r, w)) + '</span>';
// The choice before a session: none, a few papers (with − and +), the whole set; the to-do; or a few words of her own.
function fcSgPick(w, len) {
  if (w && (w.mark ? !w.left : w.done)) return '';
  const g = fcSgNow(w, len), k = g ? g.k : '';
  const b = (v, label) => '<button data-fcsg="' + v + '" aria-pressed="' + (k === v) + '">' + label + '</button>';
  let h;
  if (w && w.mark) {
    const n = fcSgN(g, w, len);
    h = '<span class="seg" role="group" aria-label="Goal for this session">' + b('', 'No goal') + b('papers', people(n, 'paper')) + (w.left > 1 ? b('set', 'Finish the set') : '') + '</span>' +
      (k === 'papers' ? '<span class="fcsgn"><button class="icon" data-fcsgn="-1" aria-label="Fewer papers"' + (n <= 1 ? ' disabled' : '') + '>−</button><button class="icon" data-fcsgn="1" aria-label="More papers"' + (n >= w.left ? ' disabled' : '') + '>+</button></span>' : '');
  } else if (w) h = '<span class="seg" role="group" aria-label="Goal for this session">' + b('', 'No goal') + b('td', 'Finish this to-do') + '</span>';
  else h = '<input type="text" class="fcsgx" data-fcsgx maxlength="80" placeholder="What do you want to get done?" aria-label="Goal for this session" value="' + esc(g && g.k === 'note' ? g.x : '') + '">';
  return '<div class="fcsgpick"><span class="fcl">Goal for this session</span><div class="fcsgrow">' + h + '</div>' + (g && g.c ? '<p class="fcsgc">Carried over from your last session</p>' : '') + '</div>';
}
// While it runs: the goal and how far along it is.
function fcSgLine(r, w) {
  const g = r.sg; if (!g) return '';
  const met = fcSgMet(r, w);
  return '<div class="fcsg' + (met ? ' met' : '') + '"><span class="fcl">Session goal</span>' + fcSgSpan(g, r, w) + (met ? '<span class="fcmet">' + FC_TICK + '<span>Reached</span></span>' : '') + '</div>';
}
// When it ends: reached, or how far it got, what goes into the next session, and a way to say it's done or to let it go.
function fcSgReview(r, w) {
  const g = r.sg; if (!g) return '';
  if (fcSgMet(r, w)) return '<p class="fcsgr met"><span class="fcok">' + FC_TICK + '</span><span>Session goal reached</span></p>';
  const cy = fcLog().carry, carried = !!cy && cy.w === (r.w || '');
  const what = g.k === 'set' ? (w && w.left ? '<span>' + esc(people(w.left, 'paper') + ' left') + '</span>' : '') : fcSgSpan(g, r, w);
  return '<div class="fcsgr"><p><span class="fcl">Session goal</span> ' + what + '</p>' +
    (carried ? '<p class="fcsgc"><span>' + (g.k === 'papers' || g.k === 'set' ? 'The rest goes into your next session.' : 'It goes into your next session.') + '</span> <button class="link" data-fccarryno>Don’t carry it over</button></p>' : '') +
    (g.k === 'td' && w && !w.done ? '<button class="btn sm" data-fcsgdone>Mark it done</button>' : g.k === 'note' ? '<button class="btn sm" data-fcsgdone>I got it done</button>' : '') + '</div>';
}
// Finish a set by a day: the papers a day it takes, over the days left (her goal days, or Monday to Friday, and today).
function fcDaysTo(by) {
  const c = fcConf(), days = c.goal && c.goal.days ? c.goal.days : [1, 2, 3, 4, 5], today = fcToday(), d = new Date(today + 'T12:00:00'); let n = 0;
  for (let i = 0; i < 400 && isoDay(d) <= by; i++, d.setDate(d.getDate() + 1)) if (isoDay(d) === today || days.includes(d.getDay())) n++;
  return Math.max(1, n);
}
function fcByHtml(w) {
  if (!w || !w.mark || !w.left) return '';
  const today = fcToday(), by = (fcLog().by || {})[w.id] || '';
  return '<div class="fcby"><label><span>Finish by</span> <input type="date" data-fcby min="' + today + '" value="' + esc(by >= today ? by : '') + '"></label>' +
    (by >= today ? '<span>' + esc(people(Math.ceil(w.left / fcDaysTo(by)), 'paper') + ' a day') + '</span>' : '') + '</div>';
}

function fcStart(len, key, one, sg) {
  fcAudioWake();
  const was = fcRun(); if (was && (was.st === 'run' || was.st === 'paused')) fcRecord(was);
  const L = fcLog(), w = fcWork(key);
  if (sg === undefined) sg = one ? null : fcSgNow(w, len);
  L.last = key || ''; if (L.carry && L.carry.w === (key || '')) delete L.carry; fcLogSet(L);
  fcS.sg = undefined; fcS.sgw = null;
  const no = ((fcLog().days[fcToday()] || {}).n || 0) + 1;
  fcRunSet({ st: 'run', len: Math.round(len * 60), at: Date.now(), w: key || '', one: one ? Math.max(1, +one || 1) : 0, p0: FC_P0, pg: 0, fold: false, no,
    ...(sg ? { sg: sg.k === 'papers' ? { k: 'papers', n: sg.n } : sg.k === 'note' ? { k: 'note', x: sg.x } : { k: sg.k } } : {}) });
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
// A few more minutes when the time is up: the same session goes on (its number stays), as a short one of its own, so ending it early
// counts only the minutes it ran. What is left of its goal goes with it.
function fcExt(min) {
  const r = fcRun(); if (!r || r.st !== 'up') return;
  const L = fcLog(), w = fcWork(r.w), g = r.sg && !fcSgMet(r, w) ? (r.sg.k === 'papers' ? { k: 'papers', n: Math.max(1, r.sg.n - (r.got || 0)) } : r.sg) : null;
  if (L.carry && L.carry.w === (r.w || '')) { delete L.carry; fcLogSet(L); }
  fcRunSet({ st: 'run', len: min * 60, at: Date.now(), w: r.w || '', one: 0, p0: FC_P0, pg: 0, fold: false, no: r.no, ext: 1, ...(g ? { sg: g } : {}) });
}
function fcUp(r) { fcRecord(r); r.st = 'up'; r.fold = false; fcRunSet(r); fcChime(); }
function fcPause() { const r = fcRun(); if (!r || r.st !== 'run') return; r.st = 'paused'; r.pz = Date.now(); r.idl = fcIdle(r); delete r.ii; fcRunSet(r); }
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
// A session started in a window not updated yet counts from p0: from here on it counts by pg, and that window can't end it.
function fcOwnRun(r) { if (r && r.st !== 'done' && r.got == null && r.p0 !== FC_P0) { r.p0 = FC_P0; r.pg = r.pg || 0; store.set('gs.focusRun', r); } return r; }
function fcTick() {
  const r = fcOwnRun(fcRun()); if (!r) return fcTickOn();
  if (r.st === 'run') {
    if (r.one ? fcGot(r) >= fcN(r) : fcLeft(r) <= 0) return fcUp(r);
    if (fcIdleSee(r)) store.set('gs.focusRun', r);
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
  if (c.goal && !fcGoalDay(c)) { const p = fcPapersToday(); return '<div class="fcnogoal"><span>' + (p ? 'Today: ' + people(p, 'paper') : 'No goal today') + '</span><a class="link" href="#/settings/focus">Goal days</a></div>'; }
  if (!c.goal) {
    const p = fcPapersToday();
    return '<div class="fcnogoal"><span>' + (p ? 'Today: ' + people(p, 'paper') : 'No daily goal yet') + '</span><a class="link" href="#/settings/focus">' + (p ? 'Set a goal' : 'Set one') + '</a></div>';
  }
  const n = fcGoalNow(c), met = n >= c.goal.n, r = fcRun(), mins = c.goal.k === 'min';
  const sess = r && (r.st === 'run' || r.st === 'paused') ? (mins ? Math.floor(Math.min(fcBusy(r), r.one ? 1e9 : r.len) / 60) : fcGot(r)) : 0;
  const step = mins ? 5 : 1, total = Math.ceil(c.goal.n / step), had = Math.floor(n / step), was = Math.floor(Math.max(0, n - sess) / step);
  const pop = card ? '' : fcS.popAt != null && fcS.popAt < had ? had - 1 : -1;
  fcS.popAt = card ? fcS.popAt : had;
  let viz;
  if (total <= FC_DOTS && c.goal.per !== 'week') {
    const half = Math.ceil(total / 2);
    viz = '<span class="fcdots' + (mins ? ' blk' : '') + '" aria-hidden="true">' + Array.from({ length: total }, (_, i) => '<i class="' + [i < was ? 'fon' : i < had ? 'fnow' : '', i === half && total >= 6 ? 'fhalf' : '', i === pop ? 'fpop' : ''].filter(Boolean).join(' ') + '"></i>').join('') + '</span>';
  } else viz = '<span class="fcbar" aria-hidden="true"><i style="width:' + Math.min(100, Math.round(n / c.goal.n * 100)) + '%"></i><b style="left:50%"></b></span>';
  const extra = met && n > c.goal.n ? ' +' + (n - c.goal.n) : '';
  const wk = c.goal.per === 'week';
  return '<div class="fcgoal' + (met ? ' met' : '') + '" role="img" aria-label="' + (wk ? 'This week' : 'Today') + ': ' + n + ' of ' + c.goal.n + ' ' + fcUnit(c.goal.k) + '"><div class="fcgh"><b>' + (wk ? 'This week' : 'Today') + '</b><span class="fcnum">' +
    (met ? '<span class="fcmet">' + FC_TICK + '<span>Goal reached</span></span>' + (extra ? '<span data-raw>' + extra + '</span>' : '') : '<span>' + n + ' of ' + c.goal.n + ' ' + fcUnit(c.goal.k) + '</span>') + '</span></div>' + viz + '</div>';
}
// This week, one short bar a day from Monday, with a line at the goal and a check over each day that reached it. A day with nothing
// on it is left empty: no mark, no colour. Saturday and Sunday show only when something was done on them. The day names come from
// the browser in the app's language, so the chart is left as it is (data-raw).
function fcWeekHtml(c) {
  const L = fcLog(), today = fcToday(), d0 = new Date(fcMon(today) + 'T12:00:00');
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(d0); d.setDate(d0.getDate() + i); const k = isoDay(d), v = L.days[k] || {}; return { k, d, v: c.goal && c.goal.k === 'min' ? Math.floor((v.s || 0) / 60) + (k === today ? Math.floor(fcSecsToday() / 60) - Math.floor((v.s || 0) / 60) : 0) : (k === today ? fcPapersToday() : v.p || 0) }; })
    .filter((x, i) => i < 5 || x.v > 0 || x.k === today);
  if (!days.some(x => x.v > 0)) return '';
  const goal = c.goal && c.goal.per !== 'week' ? c.goal.n : 0, top = Math.max(goal * 1.25, ...days.map(x => x.v), 1);
  return '<div class="fcweek"><span class="fcl">This week</span><div class="fcwk' + (goal ? ' hasg' : '') + '" style="--g:' + Math.round(goal / top * 100) + '%" role="img" data-raw aria-label="' + esc(days.map(x => x.d.toLocaleDateString(LANG_LOCALE, { weekday: 'short' }) + ' ' + x.v).join(', ')) + '">' +
    days.map(x => '<span class="fcwd' + (x.k === today ? ' now' : '') + (x.k > today ? ' later' : '') + (goal && x.v >= goal && fcGoalDay(c, x.k) ? ' met' : '') + '"><span class="fcwc">' + (goal && x.v >= goal && fcGoalDay(c, x.k) ? FC_TICK : '') + '</span><span class="fcwb"><i style="height:' + Math.round(x.v / top * 100) + '%"></i></span><span class="fcwl" data-raw>' + esc(x.d.toLocaleDateString(LANG_LOCALE, { weekday: 'narrow' })) + '</span></span>').join('') + '</div></div>';
}
// What the work is, as spans: the papers left and how long they will take at her pace on this set, from its own papers only.
// Before its first paper only the papers are said; from fewer than three, how many it comes from.
function fcWorkSay(w) {
  const sp = x => '<span>' + esc(x) + '</span>';
  if (!w) return sp('A session with nothing set: the timer only.');
  if (!w.mark) return sp('A to-do');
  if (!w.left) return sp(w.fm ? 'Feedback is complete for everyone' : 'Everyone has a score');
  const it = cardOfKept(w.id), id = it ? it.id : '', pace = gpReady ? gpPaces()(id) : 0, n = pace ? gpPaceN(id) : 0;
  return [people(w.left, 'paper') + ' left', pace ? 'about ' + people(Math.max(1, Math.round(w.left * pace / 60)), 'minute') + ' at your pace' : '', n && n < 3 ? 'from ' + people(n, 'paper') + ' so far' : ''].filter(Boolean).map(sp).join(' · ');
}
const FC_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
const FC_CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
// The start, shared by the card on Today and the panel: today against the goal, one suggestion with why, a blue Start and Just one
// paper, the session's goal in a line, and the rest under More. "Change" opens the list of work in place.
// fcS.chg: the list is open; fcS.more: More is open; fcS.hand: the work was picked by hand on this visit.
function fcStartHtml(card) {
  const c = fcConf(), works = fcWorks(), key = fcPicked(works), w = works.find(x => x.key === key) || null, f = gpReady ? gpFreeNow() : null;
  const len = fcS.len || (f ? gpFreeLen(f) : c.len), g = fcSgNow(w, len), open = w && w.mark && w.left, why = [];
  const opt = x => '<option value="' + esc(x.key) + '"' + (x.key === key ? ' selected' : '') + ' data-raw>' + esc(x.name + (x.cls ? ' · ' + x.cls : '')) + '</option>';
  const marks = works.filter(x => x.mark), tds = works.filter(x => !x.mark);
  let h = '<div class="fcbody">' + fcGoalHtml(c, true) + '<div class="fcline"></div><div class="sug">';
  if (fcS.chg) h += '<div class="sugpick"><div class="fcgh"><label class="fcl">Work on</label><button class="link" data-fckeep>Done</button></div><select class="fcwork" data-fcwork aria-label="Work on">' + marks.map(opt).join('') +
    (marks.length && tds.length ? '<option disabled data-raw>──────────</option>' : '') + tds.map(opt).join('') + '<option value=""' + (key === '' ? ' selected' : '') + '>' + esc(tr('Nothing in particular')) + '</option></select></div>';
  else h += '<div class="sugh"><span class="t"><b data-raw>' + esc(w ? w.name : tr('Nothing in particular')) + '</b>' + (w && w.cls ? ' <span data-raw>· ' + esc(w.cls) + '</span>' : '') + '</span><button class="link" data-fcchg>Change</button></div>';
  h += '<p class="fcsay">' + fcWorkSay(w) + '</p>';
  const b = gpReady && w && w.mark && fcS.pick == null ? gpBack() : null;
  if (b && b.id === w.id) { const t = new Date(b.t); why.push('<span>' + FC_BACK + '<span>You left off here:</span> <span data-raw>' + esc((isoDay(b.t) === fcToday() ? '' : t.toLocaleDateString(LANG_LOCALE, { weekday: 'long' }) + ' ') + t.toLocaleTimeString(LANG_LOCALE, { hour: 'numeric', minute: '2-digit' })) + '</span></span>'); }
  else if (fcS.hand) why.push('<span>' + FC_BACK + '<span>You picked this</span></span>');
  if (f) why.push('<span class="free">' + GP_CLOCK + '<span>Free period until</span> <span data-raw>' + esc(planTime(f.to)) + '</span></span>');
  if (why.length) h += '<p class="sugwhy">' + why.join('') + '</p>';
  h += '<div class="fcgo"><button class="btn primary" data-fcstart="' + len + '">' + FC_PLAY + '<span>Start ' + len + ' minutes</span></button>' + (open ? '<button class="btn" data-fcone>Just one paper</button>' : '') + '</div>';
  if (!(w && (w.mark ? !w.left : w.done))) h += '<p class="sugsg"><span>Goal for this session</span>: <b>' + (g ? fcSgSpan(g, null, w) : '<span>' + esc(tr('No goal')) + '</span>') + '</b> · <button class="link" data-fcsgchg>Change</button></p>';
  h += '</div>' + (card && tkReady ? tkWeekHtml() : '') + '<button class="fcmoreb" data-fcmo aria-expanded="' + !!fcS.more + '"><span>More</span>' + FC_CHEV + '</button>';
  if (fcS.more) h += '<div class="fcmorebox"><div class="fclens" role="group" aria-label="How long"><span>Or</span>' + [5, 10, 15, 25].concat(FC_LENS.includes(len) && ![5, 10, 15, 25].includes(len) ? [len] : []).sort((x, y) => x - y).map(n => '<button data-fclen="' + n + '" aria-pressed="' + (n === len) + '">' + n + '</button>').join('') + '<span>minutes</span></div>' +
    (open && w.left >= 3 ? '<div class="fcgo"><button class="btn" data-fcone="3">Just 3 papers</button></div>' : '') + fcSgPick(w, len) + fcByHtml(w) +
    (open && w.left > 1 ? '<label class="fcshort"><input type="checkbox" data-fcshort' + (c.short ? ' checked' : '') + '> Shortest papers first</label>' : '') + '</div>';
  return h + '</div>';
}
function fcCardRender() {
  const box = $('#fcCardBody'); if (!box) return;
  const r = fcRun(), on = r && r.st !== 'done';
  if (box.contains(document.activeElement) && document.activeElement.matches('[data-fcsgx], [data-fcby]')) return;   // not under her typing
  const h = on ? '<div class="fcbody">' + fcGoalHtml(fcConf(), true) + (tkReady ? tkWeekHtml() : '') + '<div class="fcline"></div><div class="fcnogoal"><span>' + (r.st === 'brk' || r.st === 'brkup' ? 'You are on a break' : 'A session is on') + '</span><button class="btn sm" data-fcshow>Show the timer</button></div></div>' : fcStartHtml(true);
  if (box.dataset.h !== h) { box.dataset.h = h; box.innerHTML = h; }
}
const fcHead = (cap, fold) => '<div class="fchead"><h2 class="tcap">' + cap + '</h2><span class="sp"></span>' + (fold ? '<button class="icon" data-fcfold title="Fold it away" aria-label="Fold it away">–</button>' : '<button class="icon" data-fcclose title="Close" aria-label="Close">✕</button>') + '</div>';
function fcWhatHtml(r, w) {
  const sub = [w && w.cls ? '<span data-raw>' + esc(w.cls) + '</span>' : '', r.one ? (fcN(r) > 1 ? 'Just 3 papers' : 'Just one paper') : w && w.mark ? (w.left ? people(w.left, 'paper') + ' left' : w.fm ? 'Feedback is complete for everyone' : 'Everyone has a score') : w ? 'A to-do' : 'The timer only'].filter(Boolean);
  return '<div class="fcwhat"><b data-raw>' + esc(w ? w.name : tr('Focus')) + '</b><span>' + sub.map(x => x.startsWith('<') ? x : '<span>' + esc(x) + '</span>').join(' · ') + '</span>' +
    (w && w.mark && w.left && r.st !== 'brk' ? '<button class="btn sm primary" data-fcnext>Next paper →</button>' : '') + '</div>';
}
// After a break: the goal the next session will have, said before it starts.
function fcSgNext(w, len) {
  const g = fcSgNow(w, len); if (!g) return '';
  return '<p class="fcp fcsgnext"><span class="fcl">Session goal</span> ' + fcSgSpan(g, null, w) + (g.c ? ' <span class="muted">(carried over)</span>' : '') + '</p>';
}
/* ---------- lo-fi music while a session runs (src/lofi.js writes and plays it) ---------- */
const FC_NOTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg>';
const FC_SKIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6v12l9-6zM18 6v12"/></svg>';
const fcMoods = (id, v) => '<select ' + id + ' class="btn sm" aria-label="Mood">' + [{ id: 'mix', name: 'Mix of everything' }, ...LOFI_STYLES].map(m => '<option value="' + m.id + '"' + (m.id === v ? ' selected' : '') + '>' + m.name + '</option>').join('') + '</select>';
const fcVol = (id, v) => '<input type="range" ' + id + ' min="0.05" max="1" step="0.05" value="' + v + '" aria-label="Volume">';
function fcMusicHtml(c) {
  return '<div class="fcmus' + (c.music ? ' on' : '') + '"><button class="btn sm' + (c.music ? '' : ' ghost') + '" data-fcmus aria-pressed="' + c.music + '" title="Lo-fi music">' + FC_NOTE + (c.music ? '' : '<span>Lo-fi music</span>') + '</button>' +
    (c.music ? fcMoods('data-fcmood', c.mood) + '<button class="btn sm" data-fcskip title="Next track">' + FC_SKIP + '</button>' + fcVol('data-fcvol', c.mvol) : '') + '</div>';
}
// One tab plays at a time: the one being used. A tab that starts playing tells the others, and they go quiet until they are pressed again.
let fcMusCh = null;
try { fcMusCh = new BroadcastChannel('gs-lofi'); fcMusCh.onmessage = () => { fcS.myield = true; fcMusicSync(); }; } catch { }
// Music plays while a session's clock runs, and stops with it: on a pause, when the time is up, on a break.
function fcMusicSync() {
  const r = fcRun(), c = fcConf(), run = !!r && r.st === 'run' && c.music;
  if (!run) { if (lofi.on) lofiPause(); if (lofi.E && !(r && r.st === 'paused' && c.music)) lofiStop(); return; }   // only a pause keeps the player, to carry on mid-track
  if (lofi.vol !== c.mvol) lofiVolume(c.mvol);
  if (lofi.amb !== c.mamb) lofiAmb(c.mamb);
  if (lofi.style !== c.mood) lofiStyle(c.mood);
  // A browser lets sound start only on a page that has been pressed, and a tab in the background doesn't start any.
  const pressed = !navigator.userActivation || navigator.userActivation.hasBeenActive;
  if (fcS.myield) { if (lofi.on) lofiPause(); }
  else if (!lofi.on && pressed && !document.hidden && lofiPlay() && fcMusCh) fcMusCh.postMessage(1);
}
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => { if (!lofi.on && fcConf().music) setTimeout(() => { fcS.myield = false; fcMusicSync(); }, 0); }, true);
document.addEventListener('click', e => {
  const t = e.target.closest('[data-fcmus], [data-fcskip]'); if (!t) return;
  if (t.dataset.fcskip != null) return lofiNext();
  fcS.myield = false; fcConfSet({ music: !fcConf().music }); if ($('#setFocus')) setRender();
});
document.addEventListener('input', e => { if (e.target.matches('[data-fcvol], #fcVol')) lofiVolume(e.target.value); });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('[data-fcvol]')) fcConfSet({ mvol: +t.value });
  else if (t.matches('[data-fcmood]')) fcConfSet({ mood: t.value });
});
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
      '<div class="fcstats"><div class="fcstat"><span>' + (r.no > 1 ? 'Session ' + r.no : 'This session') + '</span><span>' + people(got, 'paper') + '</span></div>' + fcSgLine(r, w) + fcGoalHtml(c) + '</div>' + fcMusicHtml(c) +
      '<div class="fcacts">' + (r.st === 'paused' ? '<button class="btn sm primary" data-fcresume>Carry on</button>' : '<button class="btn sm" data-fcpause>Pause</button>') + (r.one ? '' : '<button class="btn sm" data-fcmore="5">+5 minutes</button>') + '<span class="sp"></span><button class="btn sm ghost" data-fcstop>End</button></div></div>';
  }
  if (r.st === 'up') {
    const got = r.got || 0;
    return fcHead('Focus') + '<div class="fcrunv"><p class="fcbig ok"><span class="fcok">' + FC_TICK + '</span><span>' + (r.one ? (fcN(r) > 1 ? '3 papers done' : 'One paper done') : people(Math.round(r.len / 60), 'minute') + ' done') + '</span></p>' +
      (w && !w.mark && !got ? '' : '<p class="fcp">' + (got ? esc('You finished ' + people(got, 'paper') + '.') : 'Nothing was finished in this one.') + '</p>') +
      fcSgReview(r, w) + '<div class="fcstats">' + fcGoalHtml(c) + '</div>' +
      (r.one ? '<div class="fcacts">' + (w && w.left ? (fcN(r) > 1 && w.left >= 3 ? '<button class="btn primary" data-fcone="3">3 more papers</button>' : '<button class="btn primary" data-fcone>One more paper</button>') : '') + '<button class="btn" data-fcstart="' + c.len + '">' + 'Keep going for ' + c.len + ' minutes' + '</button></div>'
        : '<div class="fcacts"><button class="btn primary" data-fcbreak>Take a ' + c.brk + '-minute break</button><button class="btn" data-fcstart="' + Math.round(r.len / 60) + '" data-fcagain>' + Math.round(r.len / 60) + ' more minutes</button></div>' +
          '<div class="fcacts fcext" role="group" aria-label="A few more minutes"><span>A few more minutes</span>' + [2, 5, 10].map(n => '<button class="btn sm" data-fcext="' + n + '" data-raw>+' + n + '</button>').join('') + '</div>') +
      '<div class="fcacts"><button class="btn sm ghost" data-fcstop>Stop for now</button></div></div>';
  }
  if (r.st === 'brk') return fcHead('Break', true) + '<div class="fcrunv"><div class="fctop"><div class="fcclock brk"><span class="fcpr"></span><span class="fctime fct"></span></div>' +
    '<div class="fcwhat"><b>' + (w ? 'After the break' : 'A break') + '</b>' + (w ? '<span data-raw>' + esc(w.name) + '</span>' : '') + '</div></div>' + fcSgNext(w, c.len) +
    '<div class="fcbrkbox">Stand up, get some water, look at something far away. A chime says when the break is over.</div>' +
    '<div class="fcacts"><button class="btn sm primary" data-fcstart="' + c.len + '" data-fcagain>Back to work now</button><span class="sp"></span><button class="btn sm ghost" data-fcstop>Stop for now</button></div></div>';
  if (r.st === 'brkup') return fcHead('Focus') + '<div class="fcrunv"><p class="fcbig">Break’s over</p>' + (w ? '<p class="fcp"><span class="fcl">Next</span><b data-raw>' + esc(w.name) + '</b></p>' : '') + fcSgNext(w, c.len) +
    '<div class="fcacts"><button class="btn primary" data-fcstart="' + c.len + '" data-fcagain>' + FC_PLAY + '<span>Start ' + c.len + ' minutes</span></button><button class="btn sm" data-fcother>Something else</button><span class="sp"></span><button class="btn sm ghost" data-fcstop>Stop for now</button></div></div>';
  // done for now
  const p = fcPapersToday(), mins = Math.round(fcSecsToday() / 60), wk = fcWeekPapers(), met = c.goal && fcGoalNow(c) >= c.goal.n, tdOpen = w && !w.mark && !w.done, ns = (fcLog().days[fcToday()] || {}).n || 0;
  return fcHead('Focus') + '<div class="fcrunv">' + (met ? '<p class="fcbig ok"><span class="fcok">' + FC_TICK + '</span><span>' + (c.goal.per === 'week' ? 'This week’s goal reached' : 'Today’s goal reached') + '</span></p>' : '<p class="fcbig">Done for now</p>') +
    '<p class="fcp"><span>' + esc(mins ? 'Today: ' + people(p, 'paper') + ' in ' + people(mins, 'minute') + ' of focus.' : 'Today: ' + people(p, 'paper') + '.') + '</span>' + (wk > p ? ' <span>' + esc('This week: ' + people(wk, 'paper') + '.') + '</span>' : '') + (ns > 1 ? ' <span>' + esc(people(ns, 'session') + ' today.') + '</span>' : '') + '</p>' +
    (tdOpen ? '' : fcSgReview(r, w)) +
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
  rb.title = on ? (r.st === 'brk' ? 'Break: ' : r.st === 'paused' ? 'Paused: ' : r.one ? (fcN(r) > 1 ? 'Just 3 papers: ' : 'Just one paper: ') : 'Focus: ') + s + (r.one || r.st === 'paused' ? '' : ' left') : c.goal ? 'Focus: ' + gn + ' of ' + c.goal.n + ' ' + fcUnit(c.goal.k) + (c.goal.per === 'week' ? ' this week' : ' today') : 'Focus: a timer for grading, and your daily goal';
}
function fcPanelRender() {
  const el = $('#fcPanel'); if (!el) return;
  const r = fcRun(), show = !!r || fcS.open;
  el.hidden = !show;
  if (show) {
    const rail = $('#rail'), rr = rail && rail.offsetParent !== null ? rail.getBoundingClientRect().right : 0;
    el.style.setProperty('--fc-left', Math.max(0, Math.round(rr)) + 16 + 'px');
    const h = fcPanelHtml(r), fold = !!r && r.fold && (r.st === 'run' || r.st === 'paused' || r.st === 'brk');
    if (el.contains(document.activeElement) && document.activeElement.matches('[data-fcsgx], [data-fcby]') && !r) return fcClockDraw();
    el.classList.toggle('fold', fold);
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  } else if (el.dataset.h) { el.dataset.h = ''; el.innerHTML = ''; }
  fcClockDraw();
}
function fcRender() {
  if (!FC_ON || !shellReady) return;
  fcCardRender(); fcPanelRender(); fcTitle(); gpQuiet(); fcMusicSync();
}

/* ---------- presses ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-fcstart], [data-fcone], [data-fclen], [data-fcnext], [data-fcpause], [data-fcresume], [data-fcmore], [data-fcstop], [data-fcbreak], [data-fcfold], [data-fcunfold], [data-fcclose], [data-fcshow], [data-fcaway], [data-fctick], [data-fcsg], [data-fcsgn], [data-fcsgdone], [data-fccarryno], [data-fcother], [data-fcchg], [data-fckeep], [data-fcext], [data-fcmo], [data-fcsgchg], #railFocus');
  if (!t) return;
  const d = t.dataset, box = t.closest('.fcbody, #fcPanel'), sel = box && box.querySelector('[data-fcwork]');
  const pick = () => sel ? sel.value : fcRun() && box && box.closest('#fcPanel') ? fcRun().w : fcPicked(fcWorks());
  if (t.id === 'railFocus') { e.preventDefault(); const r = fcRun(); if (r) { r.fold = !r.fold && (r.st === 'run' || r.st === 'paused' || r.st === 'brk'); fcRunSet(r); } else { fcS.open = !fcS.open; fcRender(); } return; }
  if (d.fcstart != null) return fcStart(+d.fcstart, d.fcagain != null && fcRun() ? fcRun().w : pick(), false);
  if (d.fcone != null) return fcStart(fcConf().len, fcRun() && fcRun().st === 'up' ? fcRun().w : pick(), +d.fcone || 1);
  if (d.fclen != null) { fcS.len = +d.fclen; return fcRender(); }
  if (d.fcnext != null) return fcGoTo(true);
  if (d.fcpause != null) return fcPause();
  if (d.fcresume != null) return fcResume();
  if (d.fcmore != null) return fcMore(+d.fcmore);
  if (d.fcext != null) return fcExt(+d.fcext);
  if (d.fcbreak != null) return fcBreak();
  if (d.fcstop != null) return fcStop();
  if (d.fcfold != null || d.fcunfold != null || d.fcshow != null) { const r = fcRun(); if (r) { r.fold = d.fcfold != null; fcRunSet(r); } else { fcS.open = true; fcRender(); } return; }
  if (d.fcaway) { const r = fcRun(); if (!r) return; delete r.away; if (d.fcaway === 'again') { r.at = Date.now(); r.st = 'run'; delete r.pz; delete r.idl; delete r.ii; } return fcRunSet(r); }
  if (d.fctick != null) { const r = fcRun(), w = r && fcWork(r.w); if (w && !w.mark && !w.done) todoTick(w.id); fcS.open = false; return fcRunSet(null); }
  if (d.fcclose != null) return fcClose();
  if (d.fcchg != null || d.fckeep != null) { fcS.chg = d.fcchg != null; fcRender(); const s2 = document.querySelector((t.closest('#fcPanel') ? '#fcPanel ' : '#fcCardBody ') + (fcS.chg ? '[data-fcwork]' : '[data-fcchg]')); return s2 && s2.focus(); }
  if (d.fcmo != null || d.fcsgchg != null) {
    fcS.more = d.fcsgchg != null || !fcS.more; fcRender();
    const g = d.fcsgchg != null && document.querySelector((t.closest('#fcPanel') ? '#fcPanel' : '#fcCardBody') + ' .fcmorebox .fcsgpick');
    if (g) { g.scrollIntoView({ block: 'nearest' }); const x = g.querySelector('[aria-pressed=true], .fcsgx, button'); if (x) x.focus({ preventScroll: true }); }
    return;
  }
  // the session's goal
  if (d.fcsg != null || d.fcsgn != null) {
    const key = pick(), w = fcWork(key), len = fcS.len || fcConf().len, g = fcSgNow(w, len);
    fcS.sgw = key || '';
    if (d.fcsgn != null) fcS.sg = { k: 'papers', n: Math.max(1, Math.min(w && w.left || 1, fcSgN(g, w, len) + +d.fcsgn)) };
    else fcS.sg = d.fcsg === 'papers' ? { k: 'papers', n: fcSgN(g, w, len) } : d.fcsg === 'set' || d.fcsg === 'td' ? { k: d.fcsg } : null;
    return fcRender();
  }
  if (d.fcsgdone != null) {
    const r = fcRun(); if (!r || !r.sg) return;
    const w = fcWork(r.w); if (r.sg.k === 'td' && w && !w.mark && !w.done) todoTick(w.id);
    r.sgMet = true; const L = fcLog(); if (L.carry && L.carry.w === (r.w || '')) { delete L.carry; fcLogSet(L); }
    return fcRunSet(r);
  }
  if (d.fccarryno != null) { const L = fcLog(); delete L.carry; fcLogSet(L); return fcRender(); }
  if (d.fcother != null) { const r = fcRun(); fcS.open = true; if (r) fcS.pick = r.w; return fcRunSet(null); }
});
document.addEventListener('change', e => {
  const b = e.target.closest('[data-fcby]');
  if (b) {
    const box = b.closest('.fcbody, #fcPanel'), sel = box && box.querySelector('[data-fcwork]'), w = fcWork(sel ? sel.value : fcPicked(fcWorks())); if (!w || !w.mark) return;
    const L = fcLog(), by = { ...(L.by || {}) }; if (/^\d{4}-\d\d-\d\d$/.test(b.value) && b.value >= fcToday()) by[w.id] = b.value; else delete by[w.id];
    if (Object.keys(by).length) L.by = by; else delete L.by;
    fcLogSet(L); b.blur(); return fcRender();
  }
  const s = e.target.closest('[data-fcwork]'); if (!s) return;
  fcS.pick = s.value; fcS.sg = undefined; fcS.chg = false; fcS.hand = true; const L = fcLog(); L.last = s.value; fcLogSet(L); fcRender();
});
// The few words of a session goal of her own, kept as she types them (nothing is drawn again under her).
document.addEventListener('input', e => {
  const x = e.target.closest('[data-fcsgx]'); if (!x) return;
  const v = x.value.trim().slice(0, 80); fcS.sgw = ''; fcS.sg = v ? { k: 'note', x: v } : null;
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
    '<p class="setp"><label><input type="checkbox" id="fcTitle"' + (c.title ? ' checked' : '') + '> The time left in the browser tab’s name, so you can see it from another tab</label></p>' +
    '<p class="setp"><label><input type="checkbox" id="fcSg"' + (c.sg ? ' checked' : '') + '> Suggest a goal for each session, from your pace</label></p>' +
    '<p class="setp"><label><input type="checkbox" id="fcMusic"' + (c.music ? ' checked' : '') + '> Lo-fi music while a session runs</label></p>' +
    (c.music ? '<p class="setp fcset"><label for="fcMood"><b>Mood</b></label>' + fcMoods('id="fcMood"', c.mood) + '<label for="fcVol"><b>Volume</b></label>' + fcVol('id="fcVol"', c.mvol) + '</p>' +
      '<p class="setp"><label><input type="checkbox" id="fcAmb"' + (c.mamb ? ' checked' : '') + '> Record crackle and rain in the background</label></p>' : '') +
    '<p class="muted setp">The music is made in your browser as it plays, so it never repeats and nothing is downloaded.</p>');
  const k = c.goal ? c.goal.k : '';
  put('#setGoal', '<div class="lhead"><h2>Grading goal</h2><span class="muted">How much you want to grade in a day or a week. Today and the timer show how far along you are. Nothing happens on a day you don’t get there.</span></div>' +
    '<p class="setp fcset"><span class="seg" id="fcGoalK" role="group" aria-label="Grading goal">' + [['', 'No goal'], ['papers', 'Papers'], ['min', 'Minutes']].map(([v, l]) => '<button data-v="' + v + '" aria-pressed="' + (k === v) + '">' + l + '</button>').join('') + '</span>' +
    (c.goal ? '<input type="number" id="fcGoalN" min="1" max="' + fcGoalMax(k, c.goal.per) + '" step="1" value="' + c.goal.n + '" aria-label="' + (k === 'min' ? 'Minutes' : 'Papers') + '"><span class="muted">' + (k === 'min' ? 'minutes of focus' : 'papers') + '</span>' +
      '<select id="fcGoalPer" class="btn sm" aria-label="How often"><option value="day"' + (c.goal.per === 'day' ? ' selected' : '') + '>a day</option><option value="week"' + (c.goal.per === 'week' ? ' selected' : '') + '>a week</option></select>' : '') + '</p>' +
    (c.goal && c.goal.per === 'day' ? '<p class="setp fcset fcdays"><span class="muted">On these days</span>' + FC_DOWS.map(d => '<label><input type="checkbox" data-fcgday="' + d + '"' + (!c.goal.days || c.goal.days.includes(d) ? ' checked' : '') + '> <span data-raw>' + esc(new Date(2026, 10, 15 + d).toLocaleDateString(LANG_LOCALE, { weekday: 'short' })) + '</span></label>').join('') + '</p>' : '') +
    '<p class="muted setp"><span>A paper counts when its score is finished, or its feedback is complete on a formative activity, wherever you do it. Minutes count while a session runs.</span> <span>A week starts on Monday.</span></p>');
}
$('#setPane').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'fcLen') { fcS.len = 0; fcConfSet({ len: +t.value }); return setRender(); }
  if (t.id === 'fcBrk') { fcConfSet({ brk: +t.value }); return setRender(); }
  if (t.id === 'fcSound') { fcConfSet({ sound: t.checked }); if (t.checked) { fcAudioWake(); fcChime(); } return setRender(); }
  if (t.id === 'fcMusic') { fcConfSet({ music: t.checked }); return setRender(); }
  if (t.id === 'fcMood') { fcConfSet({ mood: t.value }); return setRender(); }
  if (t.id === 'fcVol') { fcConfSet({ mvol: +t.value }); return setRender(); }
  if (t.id === 'fcAmb') { fcConfSet({ mamb: t.checked }); return setRender(); }
  if (t.id === 'fcTitle') { fcConfSet({ title: t.checked }); return setRender(); }
  if (t.id === 'fcGoalN') { const g = fcConf().goal; if (!g) return; const n = Math.round(+t.value); if (n > 0) fcConfSet({ goal: { ...g, n } }); return setRender(); }
  if (t.id === 'fcGoalPer') { const g = fcConf().goal; if (!g) return; const week = t.value === 'week'; fcConfSet({ goal: { ...g, per: t.value, n: week ? g.n * (g.days ? g.days.length : 5) : Math.max(1, Math.round(g.n / 5)), days: null } }); return setRender(); }
  if (t.dataset.fcgday != null) { const g = fcConf().goal; if (!g) return; const on = [...document.querySelectorAll('[data-fcgday]')].filter(x => x.checked).map(x => +x.dataset.fcgday); if (!on.length) { t.checked = true; return; } fcConfSet({ goal: { ...g, days: on.length === 7 ? null : on } }); return setRender(); }
  if (t.id === 'fcSg') { fcConfSet({ sg: t.checked }); return setRender(); }
});
$('#setPane').addEventListener('click', e => {
  const b = e.target.closest('#fcGoalK [data-v]'); if (!b) return;
  const v = b.dataset.v, g = fcConf().goal;
  fcConfSet({ goal: v ? { k: v, n: g && g.k === v ? g.n : v === 'min' ? 60 : 10, per: g ? g.per : 'day', days: g ? g.days : null } : null });
  setRender();
  const n = $('#fcGoalN'); if (n) { n.focus(); n.select(); }
});

FC_ON = true;
fcSeen(); fcTickOn();
window.__gs = Object.assign(window.__gs || {}, { fcConf, fcLog, fcRun, fcRunSet, fcStart, fcPapersToday, fcSeen, fcCame, fcTick, focusOn, fcMon, fcToday, lofi, lofiCompose, lofiRender, LOFI_STYLES });
