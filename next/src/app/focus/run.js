// The focus timer's runner (src/focus.js, src/tracker.js, src/planner/plantime.js): it keeps a session going on every screen, with
// its panel in the bottom left; counts marking time while the marking screen is in front, and planning time after a few minutes of
// steady work on a planning screen (never during her classes); puts the time left in the tab's name; chimes; and plays the lo-fi
// music while a session's clock runs. The session itself is gsp.focusRun, which the current app's pages and its Planner share,
// so a session started in one carries on in the others. The shell loads this a moment after the first screen (app/focus/bus.js).
import { h, render } from 'preact';
import { engine as E, focusRead, focusHooks, planStep, planFlush } from '../../students/focus.js';
import { cardOf } from '../../students/counts.js';
import { onSaved } from '../../shared/saved.js';
import { focusChanged } from './bus.js';
import * as router from '../router.js';
import { t } from '../../i18n/t.js';
import './lines.js';
import { Panel } from './panel.jsx';
// Home's look back at the week, drawn by Home once the runner is in (screens/home.jsx)
export { WeekCard } from './week.jsx';

const ui = { open: false };
let booted = false, root = null, data = null, ptLast = 0, steps = 0;
const STEP = 15;

export function boot() {
  if (booted) return; booted = true;
  focusHooks({ render: draw, clock: drawPanel, title, goTo, lesOpen, chime, wake, page: focusChanged });
  root = document.createElement('div'); root.className = 'fcroot'; document.body.appendChild(root);
  refresh().then(() => { try { E.fcDrain(); E.fcSeen(); E.tkShare(); } catch (e) { console.error(e); } E.fcTickOn(); draw(); });
  // Something done: grading counts while something was pressed, typed or scrolled lately (src/tracker.js tkLast); planning only on
  // typing, clicking, pasting or dropping (src/planner/plantime.js ptLast); a lesson's session notes it every half minute.
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) document.addEventListener(ev, () => E.fcActive(Date.now()), { capture: true, passive: true });
  let moved = 0;
  document.addEventListener('pointermove', () => { const n = Date.now(); if (n - moved > 5000) { moved = n; E.fcActive(n); } }, { capture: true, passive: true });
  for (const ev of ['pointerdown', 'keydown', 'input', 'paste', 'drop']) document.addEventListener(ev, () => { ptLast = Date.now(); }, { capture: true, passive: true });
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => {
    const r = E.fcRun(); if (r && r.k === 'l' && r.st === 'run' && Date.now() - (r.seen || 0) > 30e3) { r.seen = Date.now(); safe(() => E.fcPut(r)); }
    if (E.fcConf().music && music.yield) { music.yield = false; setTimeout(syncMusic, 0); }
  }, { capture: true, passive: true });
  setInterval(step, STEP * 1000);
  const flush = () => safe(() => { E.tkFlush(); planFlush(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  // Leaving the tab while the clock runs (src/focus.js): on the way back after a few minutes, the panel says how long, and the session
  // can go on or start again. A lesson's session takes other tabs too, so nothing is said about being away from it.
  document.addEventListener('visibilitychange', () => safe(() => {
    const r = E.fcRun(); if (!r || r.st !== 'run' || r.k === 'l') return;
    if (document.hidden) { r.hid = Date.now(); E.fcPut(r); return; }
    if (r.hid && Date.now() - r.hid >= E.FC_AWAY && !r.one) { r.away = Math.round((Date.now() - r.hid) / 60000); r.fold = false; }
    delete r.hid; E.fcRunSet(r);
  }));
  window.addEventListener('pagehide', flush); window.addEventListener('blur', flush);
  // Another window (of this app or the current one) started, ended or changed a session, or saved work: read again.
  window.addEventListener('storage', e => { if (!e.key || /^(gsp\.focusRun|gs\.focus|gs\.lib|gsp\.planTime)$/.test(e.key)) later(); });
  onSaved(e => { if (e.kind === 'work' || e.kind === 'library' || (e.kind === 'setting' && e.id === 'gs.focus')) later(); });
  // Esc folds a running session's panel, or closes the panel opened by hand.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !root.firstChild || !(root.contains(e.target) || e.target === document.body)) return;
    const r = E.fcRun();
    if (r && (r.st === 'run' || r.st === 'paused' || r.st === 'brk')) { if (!r.fold) { r.fold = true; E.fcRunSet(r); } }
    else if (!r && ui.open) { ui.open = false; draw(); }
  });
}
const safe = f => { try { return f(); } catch (e) { console.error(e); } };
let soon = 0;
const later = () => { clearTimeout(soon); soon = setTimeout(() => refresh().then(() => { E.fcTickOn(); draw(); }), 150); };
async function refresh() { try { data = await focusRead(); } catch (e) { console.error(e); } }

// Start a session (a set of papers, a to-do, a lesson, or the timer only). From a press, so the chime and the music may play.
export async function start(key, len, one) {
  wake();
  if (!data) await refresh();
  const c = E.fcConf();
  ui.open = false; E.fcS.len = 0;
  safe(() => E.fcStart(len || (/^les:/.test(key || '') ? c.llen : c.len), key || '', one || false));
  draw();
}
export function open() { ui.open = true; draw(); setTimeout(() => { const b = root.querySelector('[data-fc-start]'); if (b) b.focus(); }, 30); }
export function close() { ui.open = false; safe(() => E.fcClose()); draw(); }

/* drawing */
function drawPanel() {
  if (!root) return;
  const r = E.fcRun();
  render(r || ui.open ? h(Panel, { ui, close, start, draw }) : null, root);
  document.body.classList.toggle('fcquiet', !!r && E.fcConf().quiet && (r.st === 'run' || r.st === 'paused'));
}
export function draw() { drawPanel(); title(); syncMusic(); focusChanged(); }

/* every 15 seconds: the time counted */
function step() {
  if (!data) return;
  const r = router.current(), now = Date.now(), c = E.fcConf(), shown = document.visibilityState === 'visible' && document.hasFocus();
  safe(() => {
    if (c.track && r.chunk === 'mark' && shown && now - lastActive() < c.idle * 60e3) { const it = cardOf(data.lib, data.keptMeta, r.params.id); E.tkCount(it ? it.id : '', STEP); }
    const planning = shown && (r.chunk === 'lesson' || r.chunk === 'calendar' || r.chunk === 'library' || (r.chunk === 'class' && (!r.params.tab || r.params.tab === 'plan')));
    const l = r.chunk === 'lesson' && data.plan ? data.plan.lessons.find(x => x.id === r.params.id) || { id: r.params.id, title: '' } : null;
    planStep(STEP, { planning, last: ptLast, lesson: l, plan: data.plan });
  });
  if (++steps % 4 === 0) safe(() => { E.tkFlush(); planFlush(); });
}
const lastActive = () => E.fcActiveAt();

/* the hooks the lifted timer calls */
// Into the work: the marking screen at its papers. One already open stays where it is.
function goTo() {
  const r = E.fcRun(), w = r && E.fcWork(r.w); if (!w || !w.mark) return;
  const cur = router.current(); if (cur.chunk === 'mark' && cur.params.id === w.id) return;
  router.go('mark', w.id);
}
// A lesson's session opens the lesson; a class meeting with nothing planned yet opens the class, where it is planned.
function lesOpen() {
  const r = E.fcRun(); if (!r || r.k !== 'l') return;
  if (r.l) router.go('lesson', r.l); else if (r.nw) router.go('class', r.nw.c); else router.go('calendar');
}
let pre = '';
function title() {
  const r = E.fcRun(), now = document.title, base = pre && now.startsWith(pre + ' · ') ? now.slice(pre.length + 3) : now;
  let p = '';
  if (r && E.fcConf().title) p = r.st === 'run' ? E.fcClock(r.one ? E.fcElapsed(r) : E.fcLeft(r)) : r.st === 'brk' ? t('focus.title_break', { time: E.fcClock(E.fcLeft(r)) }) : r.st === 'up' ? '0:00 ✓' : r.st === 'brkup' ? t('focus.title_over') : '';
  pre = p;
  const nt = (p ? p + ' · ' : '') + base; if (document.title !== nt) document.title = nt;
}
// The sound at the end: two soft notes, made here, so nothing is fetched (src/focus.js fcChime).
let audio = null;
function wake() { try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch { audio = null; } }
function chime() {
  if (!E.fcConf().sound) return;
  try {
    wake(); if (!audio) return;
    const at = audio.currentTime + 0.02;
    for (const [f, d] of [[659.25, 0], [987.77, 0.22]]) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, at + d); g.gain.exponentialRampToValueAtTime(0.11, at + d + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, at + d + 1.4);
      o.connect(g); g.connect(audio.destination); o.start(at + d); o.stop(at + d + 1.5);
    }
  } catch {}
}

/* lo-fi music while a session's clock runs (src/focus.js fcMusicSync), from engines/glofi.js, loaded when it first plays.
   One tab plays at a time, the one being used: a tab that starts tells the others (the current app's pages listen too). */
const music = { M: null, yield: false, ch: null };
try { music.ch = new BroadcastChannel('gs-lofi'); music.ch.onmessage = () => { music.yield = true; syncMusic(); }; } catch {}
export async function syncMusic() {
  const r = E.fcRun(), c = E.fcConf(), on = !!r && r.st === 'run' && c.music, M = music.M;
  if (!on) { if (M) { if (M.lofi.on) M.lofiPause(); if (M.lofi.E && !(r && r.st === 'paused' && c.music)) M.lofiStop(); } return; }
  const L = music.M || (music.M = await import('../../engines/glofi.js'));
  if (L.lofi.vol !== c.mvol) L.lofiVolume(c.mvol);
  if (L.lofi.amb !== c.mamb) L.lofiAmb(c.mamb);
  if (L.lofi.style !== c.mood) L.lofiStyle(c.mood);
  const pressed = !navigator.userActivation || navigator.userActivation.hasBeenActive;
  if (music.yield) { if (L.lofi.on) L.lofiPause(); }
  else if (!L.lofi.on && pressed && !document.hidden && L.lofiPlay() && music.ch) music.ch.postMessage(1);
}
export const nextTrack = () => { if (music.M) music.M.lofiNext(); };
export const setVolume = v => { if (music.M) music.M.lofiVolume(v); };
