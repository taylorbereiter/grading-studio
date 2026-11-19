// Present's class timer, kept where the current Planner keeps it (src/planner/present.js prTimer*): gsp.presentTimer holds
// { end, left, total, paused, done } so the timer outlives Present and a refresh, and either app picks it up. Only times.
// gsp.presentSound ('0' turns the sound off), gsp.presentBig ('1' shows it big), gsp.presentOwn (the last own time, in seconds).
import { presentTimer, presentSound, presentBig, presentOwn } from '../../planning/index.js';
import { savePref } from '../../planning/write.js';

const subs = new Set();
let T = null, ac = null, tick = 0;
const put = (k, v) => { try { savePref(k, v); } catch (e) { console.error(e); } };
const num = v => typeof v === 'number' && isFinite(v);
function load() {
  const t = presentTimer.json(null);
  if (!t || typeof t !== 'object' || !num(t.end) || !num(t.left) || !num(t.total) || t.done) return null;
  if (!t.paused && t.end < Date.now() - 60 * 1000) { put('gsp.presentTimer', undefined); return null; }
  return { end: t.end, left: Math.max(0, Math.round(t.left)), total: Math.max(1, Math.round(t.total)), paused: !!t.paused, done: false };
}
T = load();
const keep = () => put('gsp.presentTimer', T && !T.done ? T : undefined);
const tell = () => { for (const f of subs) { try { f(T); } catch (e) { console.error(e); } } };

export const soundOn = () => String(presentSound.text() || '') !== '0';
export const bigOn = () => String(presentBig.text() || '') === '1';
export const ownLast = () => +presentOwn.text() || 0;
export const setSound = on => { put('gsp.presentSound', on ? 1 : 0); tell(); };
export const setBig = on => { put('gsp.presentBig', on ? 1 : 0); tell(); };
export const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

function chime() {
  if (!soundOn()) return;
  try {
    const C = ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (C.state === 'suspended') C.resume();
    const t0 = C.currentTime;
    [[0, 660], [.4, 660], [.8, 880]].forEach(([d, f]) => {
      const o = C.createOscillator(), g = C.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(.3, t0 + d + .03); g.gain.exponentialRampToValueAtTime(.0001, t0 + d + .35);
      o.connect(g); g.connect(C.destination); o.start(t0 + d); o.stop(t0 + d + .4);
    });
  } catch { }
}
// The time left, from the clock; the sound once when it runs out.
function step() {
  if (!T || T.paused || T.done) return;
  const left = Math.max(0, Math.ceil((T.end - Date.now()) / 1000));
  if (left === T.left && left) return;
  T.left = left;
  if (!left) { T.done = true; keep(); chime(); }
  tell();
}
function run() { clearInterval(tick); tick = 0; if (T && !T.done && !T.paused) tick = setInterval(step, 250); }

export const timer = () => { step(); return T; };
export function subscribe(f) { subs.add(f); if (subs.size === 1) run(); return () => { subs.delete(f); if (!subs.size) { clearInterval(tick); tick = 0; } }; }
export function start(sec) {
  sec = Math.max(1, Math.min(180 * 60, Math.round(sec)));
  T = { end: Date.now() + sec * 1000, left: sec, total: sec, paused: false, done: false };
  try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); } catch { }
  keep(); run(); tell();
}
export function own(sec) { if (!(sec > 0)) return false; put('gsp.presentOwn', Math.round(sec)); start(sec); return true; }
export function pause() {
  if (!T || T.done) return;
  if (T.paused) { T.end = Date.now() + T.left * 1000; T.paused = false; } else { T.left = Math.max(0, Math.ceil((T.end - Date.now()) / 1000)); T.paused = true; }
  keep(); run(); tell();
}
// More time or less, running or paused. Taking away more than is left ends it: time's up.
export function add(sec) {
  if (!T || T.done) { if (sec > 0) start(sec); return; }
  if (T.paused) T.left = Math.max(0, Math.min(180 * 60, T.left + sec));
  else { const left = Math.max(0, Math.ceil((T.end - Date.now()) / 1000)); T.end = Date.now() + Math.max(0, Math.min(180 * 60, left + sec)) * 1000; T.left = Math.max(0, Math.ceil((T.end - Date.now()) / 1000)); }
  if (T.paused && !T.left) { T.paused = false; T.end = Date.now(); }
  keep(); run(); step(); tell();
}
export const restart = () => { if (T) start(T.total); };
export function stop() { T = null; keep(); run(); tell(); }
// The chip's press: pause or go on; once time is up, clear it.
export const press = () => { if (T && T.done) stop(); else pause(); };
