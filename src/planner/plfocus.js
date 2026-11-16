/* ---------- Focus in the Planner: the session going on keeps going here ----------
   The focus timer starts on the grading page (src/focus.js). Its session is kept in gsp.focusRun, a key this page may read and write,
   so opening the Planner in the middle of one doesn't stop it: the same panel shows in the bottom left, the clock goes on, and it can
   be paused, given more minutes, ended, or followed by a break. The settings it needs (how long a break is, the chime, the time in the
   tab's name, the music) are copied by the grading page into gsp.timeCount.
   A session on papers ends here without being written into the grading log, which this page can't open: what it came to waits in
   gsp.focusQ ([{ d: day, s: seconds, m: on papers, x: extra minutes, got: papers }]) and the grading page writes it in when it next
   opens. Both keys stay in this browser (src/takehome.js PLAN_LS_SKIP). Every word here is one the grading page's panel already uses,
   so the languages cover it as they are. */
const PF_KEY = 'gsp.focusRun', PF_Q = 'gsp.focusQ', PF_P0 = 1e9;
const pfGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const pfSetK = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { } };
const pfRun = () => { const r = pfGet(PF_KEY, null); return r && r.st ? r : null; };
function pfConf() {
  const f = pfGet('gsp.timeCount', null) || {};
  return { len: +f.len > 0 ? +f.len : 10, brk: +f.brk > 0 ? +f.brk : 5, sound: f.sound !== false, title: f.title !== false,
    music: f.music === true, mood: typeof f.mood === 'string' ? f.mood : 'mix', mvol: +f.mvol >= .05 && +f.mvol <= 1 ? +f.mvol : .5, mamb: f.mamb === true };
}
const pfDay = () => ymd(new Date());
const pfElapsed = r => Math.max(0, Math.round(((r.st === 'paused' ? r.pz : Date.now()) - r.at) / 1000));
const pfIdle = r => (r.idl || 0) + (r.ii ? Math.max(0, Math.round(((r.st === 'paused' ? r.pz : Date.now()) - r.ii) / 1000)) : 0);
const pfLeft = r => r.st === 'brk' ? Math.max(0, Math.round((r.brkAt + r.brkLen * 1000 - Date.now()) / 1000)) : Math.max(0, r.len - pfElapsed(r));
const pfClock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const pfMins = n => n === 1 ? '1 minute' : n + ' minutes';
let pfS = { mute: false };

// A session that ends here: its minutes wait for the grading page (once: r.secs says it is written down).
function pfRecord(r) {
  if (r.secs != null) return r;
  const secs = Math.min(r.one ? 4 * 3600 : r.len, Math.max(0, pfElapsed(r) - pfIdle(r))), got = Math.max(0, r.pg || 0);
  if (secs > 0) { const q = pfGet(PF_Q, []); pfSetK(PF_Q, [...(Array.isArray(q) ? q : []), { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), d: pfDay(), s: secs, m: /^mark:/.test(r.w || '') ? 1 : 0, x: r.ext ? 1 : 0, got }].slice(-50)); }
  return Object.assign(r, { secs, got });
}
function pfSet(r) { pfSetK(PF_KEY, r); pfTickOn(); pfRender(); }
function pfStartAgain(min) {
  const r = pfRun(); if (!r) return;
  pfSet({ st: 'run', len: Math.round(min * 60), at: Date.now(), w: r.w || '', t: r.t || '', one: 0, p0: PF_P0, pg: 0, fold: false, no: (r.no || 1) + 1 });
}
function pfAct(a, n) {
  const r = pfRun(); if (!r) return;
  const on = r.st === 'run' || r.st === 'paused';
  if (a === 'pause' && r.st === 'run') { r.st = 'paused'; r.pz = Date.now(); r.idl = pfIdle(r); delete r.ii; }
  else if (a === 'resume' && r.st === 'paused') { r.at += Date.now() - r.pz; delete r.pz; r.st = 'run'; }
  else if (a === 'more' && on) r.len += n * 60;
  else if (a === 'ext' && r.st === 'up') return pfSet({ st: 'run', len: n * 60, at: Date.now(), w: r.w || '', t: r.t || '', one: 0, p0: PF_P0, pg: 0, fold: false, no: r.no, ext: 1, ...(r.sg && r.sg.k !== 'papers' ? { sg: r.sg } : {}) });
  else if (a === 'break') { if (on) pfRecord(r); Object.assign(r, { st: 'brk', brkAt: Date.now(), brkLen: pfConf().brk * 60, fold: false }); }
  else if (a === 'stop') { if (on) pfRecord(r); Object.assign(r, { st: 'done', fold: false }); }
  else if (a === 'close') return pfSet(null);
  else if (a === 'fold') r.fold = true;
  else if (a === 'unfold') r.fold = false;
  else return;
  pfSet(r);
}

/* the chime and the clock */
let pfAudio = null;
function pfChime() {
  if (!pfConf().sound) return;
  try {
    if (!pfAudio) pfAudio = new (window.AudioContext || window.webkitAudioContext)();
    if (pfAudio.state === 'suspended') pfAudio.resume();
    const t = pfAudio.currentTime + 0.02;
    for (const [f, d] of [[659.25, 0], [987.77, 0.22]]) {
      const o = pfAudio.createOscillator(), g = pfAudio.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.11, t + d + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 1.4);
      o.connect(g); g.connect(pfAudio.destination); o.start(t + d); o.stop(t + d + 1.5);
    }
  } catch { }
}
let pfTimer = 0;
function pfTickOn() {
  const r = pfRun(), on = !!r && (r.st === 'run' || r.st === 'brk');
  if (on && !pfTimer) pfTimer = setInterval(pfTick, 1000);
  if (!on && pfTimer) { clearInterval(pfTimer); pfTimer = 0; }
  pfTitle();
}
function pfTick() {
  const r = pfRun(); if (!r) return pfTickOn();
  // "Just one paper" is finished on the grading page; here its clock only counts up
  if (r.st === 'run' && !r.one && pfLeft(r) <= 0) { pfRecord(r); r.st = 'up'; r.fold = false; pfSet(r); pfChime(); return; }
  if (r.st === 'brk' && pfLeft(r) <= 0) { r.st = 'brkup'; r.fold = false; pfSet(r); pfChime(); return; }
  pfClockDraw(); pfTitle();
}
let pfTitlePre = '';
function pfTitle() {
  const r = pfRun(), now = document.title, base = pfTitlePre && now.startsWith(pfTitlePre + ' · ') ? now.slice(pfTitlePre.length + 3) : now;
  let pre = '';
  if (r && pfConf().title) pre = r.st === 'run' ? pfClock(r.one ? pfElapsed(r) : pfLeft(r)) : r.st === 'brk' ? tr('Break') + ' ' + pfClock(pfLeft(r)) : r.st === 'up' ? '0:00 ✓' : r.st === 'brkup' ? tr('Break’s over') : '';
  pfTitlePre = pre;
  const t = (pre ? pre + ' · ' : '') + base; if (document.title !== t) document.title = t;
}

/* drawing: the grading page's panel, with what this page can do */
const PF_TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const PF_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
const PF_NOTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg>';
const PF_SKIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6v12l9-6zM18 6v12"/></svg>';
const pfRing = (r, w, frac) => { const c = 2 * Math.PI * r, s = 2 * (r + w); return '<svg viewBox="0 0 ' + s + ' ' + s + '" aria-hidden="true"><circle class="tr" cx="' + (r + w) + '" cy="' + (r + w) + '" r="' + r + '"/><circle class="on" cx="' + (r + w) + '" cy="' + (r + w) + '" r="' + r + '" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + (c * (1 - Math.max(0, Math.min(1, frac)))).toFixed(2) + '"/></svg>'; };
const pfFrac = r => r.st === 'brk' ? pfLeft(r) / (r.brkLen || 1) : r.one ? 1 : pfLeft(r) / (r.len || 1);
const pfHead = (cap, fold) => '<div class="fchead"><h2 class="tcap">' + cap + '</h2><span class="sp"></span>' + (fold ? '<button class="icon" data-pf="fold" title="Fold it away" aria-label="Fold it away">–</button>' : '<button class="icon" data-pf="close" title="Close" aria-label="Close">✕</button>') + '</div>';
const pfName = r => r.t ? '<b data-raw>' + esc(r.t) + '</b>' : '<b>' + esc(tr('Focus')) + '</b>';
function pfSub(r) {
  return '<span>' + (r.one ? (r.one > 1 ? 'Just 3 papers' : 'Just one paper') : r.w ? '' : 'The timer only') + '</span>' +
    (/^mark:/.test(r.w || '') && r.st === 'run' ? '<button class="btn sm primary" data-pf="next">Next paper →</button>' : '');
}
function pfMusicHtml(c) {
  if (!c.music || typeof lofiPlay !== 'function') return '';
  const on = !pfS.mute;
  return '<div class="fcmus' + (on ? ' on' : '') + '"><button class="btn sm' + (on ? '' : ' ghost') + '" data-pf="mus" aria-pressed="' + on + '" title="Lo-fi music">' + PF_NOTE + (on ? '' : '<span>Lo-fi music</span>') + '</button>' +
    (on ? '<button class="btn sm" data-pf="skip" title="Next track">' + PF_SKIP + '</button>' : '') + '</div>';
}
function pfPanelHtml(r) {
  const c = pfConf(), len = Math.round(r.len / 60);
  if (r.fold && (r.st === 'run' || r.st === 'paused' || r.st === 'brk'))
    return '<button class="fcpill' + (r.st === 'brk' ? ' brk' : '') + '" data-pf="unfold" title="Show the timer"><span class="fcpr"></span><b class="fct"></b>' + (r.t ? '<span data-raw>' + esc(r.t) + '</span>' : '') + '</button>';
  if (r.st === 'run' || r.st === 'paused')
    return pfHead(r.st === 'paused' ? 'Paused' : 'Focusing', true) + '<div class="fcrunv"><div class="fctop"><div class="fcclock' + (r.st === 'paused' ? ' paused' : '') + '"><span class="fcpr"></span><span class="fctime fct"></span></div><div class="fcwhat">' + pfName(r) + pfSub(r) + '</div></div>' + pfMusicHtml(c) +
      '<div class="fcacts">' + (r.st === 'paused' ? '<button class="btn sm primary" data-pf="resume">Carry on</button>' : '<button class="btn sm" data-pf="pause">Pause</button>') + (r.one ? '' : '<button class="btn sm" data-pf="more" data-n="5">+5 minutes</button>') + '<span class="sp"></span><button class="btn sm ghost" data-pf="stop">End</button></div></div>';
  if (r.st === 'up')
    return pfHead('Focus') + '<div class="fcrunv"><p class="fcbig ok"><span class="fcok">' + PF_TICK + '</span><span>' + esc(pfMins(len) + ' done') + '</span></p>' +
      '<div class="fcacts"><button class="btn primary" data-pf="break">Take a ' + c.brk + '-minute break</button><button class="btn" data-pf="again" data-n="' + len + '">' + len + ' more minutes</button></div>' +
      '<div class="fcacts fcext" role="group" aria-label="A few more minutes"><span>A few more minutes</span>' + [2, 5, 10].map(n => '<button class="btn sm" data-pf="ext" data-n="' + n + '" data-raw>+' + n + '</button>').join('') + '</div>' +
      '<div class="fcacts"><button class="btn sm ghost" data-pf="stop">Stop for now</button></div></div>';
  if (r.st === 'brk')
    return pfHead('Break', true) + '<div class="fcrunv"><div class="fctop"><div class="fcclock brk"><span class="fcpr"></span><span class="fctime fct"></span></div><div class="fcwhat"><b>' + (r.w ? 'After the break' : 'A break') + '</b>' + (r.t ? '<span data-raw>' + esc(r.t) + '</span>' : '') + '</div></div>' +
      '<div class="fcbrkbox">Stand up, get some water, look at something far away. A chime says when the break is over.</div>' +
      '<div class="fcacts"><button class="btn sm primary" data-pf="again" data-n="' + c.len + '">Back to work now</button><span class="sp"></span><button class="btn sm ghost" data-pf="stop">Stop for now</button></div></div>';
  if (r.st === 'brkup')
    return pfHead('Focus') + '<div class="fcrunv"><p class="fcbig">Break’s over</p>' + (r.t ? '<p class="fcp"><span class="fcl">Next</span><b data-raw>' + esc(r.t) + '</b></p>' : '') +
      '<div class="fcacts"><button class="btn primary" data-pf="again" data-n="' + c.len + '">' + PF_PLAY + '<span>Start ' + c.len + ' minutes</span></button><span class="sp"></span><button class="btn sm ghost" data-pf="stop">Stop for now</button></div></div>';
  return pfHead('Focus') + '<div class="fcrunv"><p class="fcbig">Done for now</p><div class="fcacts"><button class="btn sm" data-pf="close">Close</button></div></div>';
}
function pfClockDraw() {
  const r = pfRun(), el = document.getElementById('fcPanel'); if (!r || !el || el.hidden) return;
  const t = r.st === 'brk' ? pfLeft(r) : r.one ? pfElapsed(r) : pfLeft(r), frac = pfFrac(r), pill = el.querySelector('.fcpill');
  for (const x of el.querySelectorAll('.fct')) { const s = pfClock(t); if (x.textContent !== s) x.textContent = s; }
  for (const x of el.querySelectorAll('.fcpr')) x.innerHTML = pill ? pfRing(10, 3, frac) : pfRing(40, 6, frac);
}
function pfRender() {
  let el = document.getElementById('fcPanel');
  if (!el) { el = document.createElement('div'); el.className = 'fcpanel'; el.id = 'fcPanel'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Focus'); el.hidden = true; document.body.appendChild(el); }
  const r = pfRun();
  el.hidden = !r;
  if (r) {
    const rail = document.getElementById('rail'), rr = rail && rail.offsetParent !== null ? rail.getBoundingClientRect().right : 0;
    el.style.setProperty('--fc-left', Math.max(0, Math.round(rr)) + 16 + 'px');
    const h = pfPanelHtml(r);
    el.classList.toggle('fold', !!r.fold && (r.st === 'run' || r.st === 'paused' || r.st === 'brk'));
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  } else if (el.dataset.h) { el.dataset.h = ''; el.innerHTML = ''; }
  pfClockDraw(); pfMusic();
}
// The music goes on here too, while the clock runs (src/lofi.js). A browser lets it start only once this page has been pressed.
function pfMusic() {
  if (typeof lofiPlay !== 'function') return;
  const r = pfRun(), c = pfConf(), run = !!r && r.st === 'run' && c.music && !pfS.mute;
  if (!run) { if (lofi.on) lofiPause(); if (lofi.E && !(r && r.st === 'paused')) lofiStop(); return; }
  if (lofi.vol !== c.mvol) lofiVolume(c.mvol);
  if (lofi.amb !== c.mamb) lofiAmb(c.mamb);
  if (lofi.style !== c.mood) lofiStyle(c.mood);
  const pressed = !navigator.userActivation || navigator.userActivation.hasBeenActive;
  if (!lofi.on && pressed && !document.hidden) lofiPlay();
}
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => { if (typeof lofi !== 'undefined' && !lofi.on) setTimeout(pfMusic, 0); pfSeen(); }, true);
// She is working here: a grading tab left open in the background must not take the time for idle (src/focus.js fcIdleSee reads
// r.seen, and r.ii is a stretch with nothing done), so what she does here is noted on the session, at most every half minute.
function pfSeen() {
  const r = pfRun(); if (!r || (r.st !== 'run' && r.st !== 'paused')) return;
  const now = Date.now(); if (!r.ii && now - (r.seen || 0) < 30e3) return;
  if (r.ii) { r.idl = (r.idl || 0) + Math.max(0, Math.round(((r.st === 'paused' ? r.pz : now) - r.ii) / 1000)); delete r.ii; }
  r.seen = now; pfSetK(PF_KEY, r);
}
// Back to this page (another tab, or the browser's back button): no "you were away", and the panel catches up.
function pfBack() { const r = pfRun(); if (r && r.hid) { delete r.hid; pfSetK(PF_KEY, r); } pfTickOn(); pfRender(); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) pfBack(); });
window.addEventListener('pageshow', e => { if (e.persisted) pfBack(); });
document.addEventListener('click', e => {
  const b = e.target.closest('#fcPanel [data-pf]'); if (!b) return;
  const a = b.dataset.pf, n = +b.dataset.n || 0;
  if (a === 'again') return pfStartAgain(n);
  // back to the papers: the grading page opens the next one when it has read them (src/focus.js)
  if (a === 'next') { pfSetK('gsp.focusGo', Date.now()); location.href = GS_PAGE; return; }
  if (a === 'mus') { pfS.mute = !pfS.mute; return pfRender(); }
  if (a === 'skip') return typeof lofiNext === 'function' && lofiNext();
  pfAct(a, n);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const r = pfRun(), el = document.getElementById('fcPanel');
  if (r && el && el.contains(e.target) && (r.st === 'run' || r.st === 'paused' || r.st === 'brk') && !r.fold) pfAct('fold');
});
// The grading page in another tab started, paused or ended it: this page shows the same.
window.addEventListener('storage', e => { if (e.key === PF_KEY || e.key === 'gsp.timeCount') { pfTickOn(); pfRender(); } });
{ const r = pfRun(); if (r && r.hid) { delete r.hid; pfSetK(PF_KEY, r); } }   // the grading page noted when it was left; here she is still working
pfTickOn(); pfRender();
window.__plfocus = { run: pfRun, tick: pfTick, act: pfAct, conf: pfConf };
