/* ================= Present: teach from the lesson =================
   The lesson's slides fill the screen. One key away: the agenda (tick items off as the class goes), a countdown the
   class can watch, the speaker notes, a blank screen, and how long the class has left by the timetable.
   Afterwards one line says where the class got to. It is kept on the lesson as "taught", so it goes to the Planner
   folder with the lesson and shows on the week.
   This reads the lesson and the timetable and nothing else. Its buttons carry data-pr and are handled here. */
const PR = { on: false, askMs: 2 * 60 * 1000 };   // askMs: presenting for at least this long asks where the class got to
const PR_I = {
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  prev: '<path d="M14.5 6l-6 6 6 6"/>', next: '<path d="M9.5 6l6 6-6 6"/>',
  agenda: '<path d="M9.5 7H19M9.5 12H19M9.5 17H19M5 7h.01M5 12h.01M5 17h.01"/>',
  timer: '<circle cx="12" cy="13.5" r="6.5"/><path d="M12 10v3.5l2.3 1.4M10 3.5h4"/>',
  notes: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8.5 9h7M8.5 13h7M8.5 17h4"/>',
  blank: '<rect x="3.5" y="5" width="17" height="12" rx="1.5"/><path d="M9 20.5h6"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
};
const prIcon = k => '<svg viewBox="0 0 24 24" aria-hidden="true">' + PR_I[k] + '</svg>';
const prToday = () => ymd(new Date());
const prMin = t => { const [h, m] = String(t || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const prNowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
const prSameSlot = (a, b) => !!a && !!b && a.classId === b.classId && a.date === b.date;

/* ---------- which class this is, and how long it has ---------- */
// The meeting a slot stands for: the one on now, else the next one that day, else the last.
function prMeeting(slot) {
  if (!slot) return null;
  const ms = meetingsOn(slot.date).filter(x => x.c.id === slot.classId).map(x => x.m).filter(m => m.start && m.end);
  if (!ms.length) return null;
  const now = prNowMin();
  return ms.find(m => prMin(m.start) <= now && now < prMin(m.end)) || ms.find(m => prMin(m.start) > now) || ms[ms.length - 1];
}
// Of the classes this lesson is on today: the one meeting now (or about to), else the next, else the one just over.
function prSlotNow(l) {
  const today = l.slots.filter(s => s.date === prToday()); if (!today.length) return null;
  const now = prNowMin();
  const rank = s => { const m = prMeeting(s); if (!m) return [3, 0]; const a = prMin(m.start), b = prMin(m.end); return a - 10 <= now && now < b ? [0, a] : now < a ? [1, a] : [2, -b]; };
  return today.map(s => ({ s, r: rank(s) })).sort((x, y) => x.r[0] - y.r[0] || x.r[1] - y.r[1])[0].s;
}
function prClock() {
  const d = new Date(), t = (d.getHours() % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0');
  const m = PR.slot && PR.slot.date === prToday() ? prMeeting(PR.slot) : null; if (!m) return t;
  const now = prNowMin(), a = prMin(m.start), b = prMin(m.end);
  if (now < a) return t + ' · starts at ' + hm(m.start);
  if (now >= b) return t + ' · class ended at ' + hm(m.end);
  return t + ' · ' + Math.ceil(b - now) + ' min left';
}
const prSlideName = s => plainTitle(s.title) || LAYOUTS[s.layout];

/* ---------- the note on where a class got to ("taught", kept on the lesson) ---------- */
// [{ classId, date, slide, of, note, at, agenda: [done, of] }]: one for each class and day; slide counts from 1.
function normTaught(a) {
  const seen = new Map();
  for (const t of Array.isArray(a) ? a : []) {
    if (!t || typeof t !== 'object' || !/^\d{4}-\d\d-\d\d$/.test(t.date)) continue;
    const of = Math.max(1, Math.round(+t.of) || Math.round(+t.slide) || 1), slide = Math.max(1, Math.min(of, Math.round(+t.slide) || 1));
    const o = { classId: typeof t.classId === 'string' ? t.classId : '', date: t.date, slide, of, note: String(t.note || '').replace(/\s+/g, ' ').trim().slice(0, 300), at: +t.at || 0 };
    if (Array.isArray(t.agenda) && Math.round(+t.agenda[1]) > 0) { const n = Math.round(+t.agenda[1]); o.agenda = [Math.max(0, Math.min(n, Math.round(+t.agenda[0]) || 0)), n]; }
    seen.set(o.classId + '|' + o.date, o);
  }
  return [...seen.values()].sort((x, y) => x.date.localeCompare(y.date) || x.at - y.at);
}
const taughtAt = (l, classId, date) => (l.taught || []).find(t => t.classId === classId && t.date === date);
const taughtWhere = t => t.slide >= t.of ? 'finished all ' + t.of + ' slides' : 'got to slide ' + t.slide + ' of ' + t.of;
const taughtWho = t => (t.classId ? className(t.classId) + ' · ' : '') + shortDate(t.date);
// On the week: one quiet word on the lesson's card for that class and day.
function taughtChip(l, classId, date) {
  const t = taughtAt(l, classId, date); if (!t) return '';
  return '<span class="pl-taught" title="' + esc(taughtWho(t) + ': ' + taughtWhere(t) + (t.note ? '. ' + t.note : '')) + '">Taught · ' + (t.slide >= t.of ? 'finished' : 'to slide ' + t.slide + ' of ' + t.of) + '</span>';
}
// On the week: today's lesson can be presented from its card.
function presentCardBtn(l, classId, date) {
  return date === prToday() ? '<button class="ls-dl ls-go" data-pr="go" data-id="' + esc(l.id) + '" data-c="' + esc(classId) + '" data-d="' + date + '" title="Present this lesson" aria-label="Present ' + esc(l.title) + '">' + prIcon('play') + '</button>' : '';
}
// In the lesson: every note, once the lesson's day has come.
function taughtHtml(l) {
  const ts = l.taught || [], due = l.slots.some(s => s.date <= prToday());
  if (!ts.length && !due) return '';
  return '<div class="pl-fin" id="plTaught"><div class="pl-fin-h"><h3>Taught</h3><span class="muted sp-small">' + (ts.length ? 'Where each class got to.' : 'Nothing noted yet. Presenting the lesson on its day asks at the end.') +
    '</span><span class="sp"></span><button class="btn sm ghost" data-pr="note">' + (ts.length ? 'Add a note' : 'Note where the class got to') + '</button></div>' +
    (ts.length ? '<div class="pl-tgs">' + ts.map((t, i) => '<div class="pl-tg"><b>' + esc(taughtWho(t)) + '</b><span class="w">' + taughtWhere(t) + (t.agenda ? ' · agenda ' + t.agenda[0] + ' of ' + t.agenda[1] : '') + '</span><span class="nt">' + esc(t.note) + '</span>' +
      '<button class="btn sm ghost" data-pr="tedit" data-i="' + i + '">Edit</button><button class="btn sm ghost" data-pr="tdel" data-i="' + i + '">Remove</button></div>').join('') + '</div>' : '') + '</div>';
}
// For Claude, with the rest of the lesson's text.
function taughtText(l) {
  return (l.taught || []).map(t => 'Taught: ' + (t.classId ? className(t.classId) + ', ' : '') + longDate(t.date) + ': ' + taughtWhere(t) + (t.agenda ? ' (agenda: ' + t.agenda[0] + ' of ' + t.agenda[1] + ' done)' : '') + (t.note ? '. Note: ' + t.note : '') + '\n').join('');
}
function taughtRedraw(l) { if (L.view === 'edit' && L.open === l) renderEditor(); else if (L.view === 'week') renderWeek(); }
// pre: { slot, slide, agenda } from presenting, { edit: the note } to change one, or nothing to add one by hand.
function taughtDlg(l, pre) {
  pre = pre || {};
  const today = prToday(), n = l.slides.length;
  const slots = l.slots.length ? l.slots.slice().sort((a, b) => a.date.localeCompare(b.date)) : [{ classId: (pre.edit || {}).classId || '', date: (pre.edit || {}).date || today }];
  const want = pre.edit || pre.slot || prSlotNow(l) || slots.filter(s => s.date <= today).pop() || slots[0];
  let at = slots.findIndex(s => prSameSlot(s, want)); if (at < 0) { slots.push({ classId: want.classId, date: want.date }); at = slots.length - 1; }
  const had = taughtAt(l, slots[at].classId, slots[at].date);
  const slide = Math.max(1, Math.min(n, pre.slide || (had ? had.slide : n)));
  const who = s => (s.classId ? className(s.classId) + ' · ' : '') + shortDate(s.date);
  openDlg('<div class="bh"><h2>Where did the class get to?</h2></div><div class="bb pl-tgd">' +
    (slots.length > 1 ? '<label class="ls-f">Class <select id="tgC" class="btn">' + slots.map((s, i) => '<option value="' + i + '"' + (i === at ? ' selected' : '') + '>' + esc(who(s)) + '</option>').join('') + '</select></label>' : '<p class="who">' + esc(who(slots[0])) + '</p>') +
    '<label class="ls-f">Got to <select id="tgS" class="btn">' + l.slides.map((s, i) => '<option value="' + (i + 1) + '"' + (i + 1 === slide ? ' selected' : '') + '>Slide ' + (i + 1) + ' · ' + esc(prSlideName(s)) + (i === n - 1 ? ' (the end)' : '') + '</option>').join('') + '</select></label>' +
    '<label class="ls-f">A line for next time <input id="tgN" class="btn" maxlength="200" autocomplete="off" placeholder="Optional. For example: start with the exit ticket" value="' + esc((had || {}).note || '') + '"></label>' +
    '</div><div class="bf"><button class="btn" data-x>Not now</button><button class="btn primary" data-ok>Save</button></div>', true);
  const box = $('#dlgBox'); $('#tgN').focus();
  const save = async () => {
    const s = slots[$('#tgC') ? +$('#tgC').value : 0], num = +$('#tgS').value || 1;
    const t = { classId: s.classId, date: s.date, slide: num, of: n, note: $('#tgN').value, at: Date.now() };
    if (pre.agenda && pre.agenda[1]) t.agenda = pre.agenda; else { const old = taughtAt(l, s.classId, s.date); if (old && old.agenda) t.agenda = old.agenda; }
    l.taught = normTaught([...(l.taught || []).filter(x => !(pre.edit && x === pre.edit)), t]);
    closeDlg(); await lPut(l); taughtRedraw(l); toast('Noted on the lesson');
  };
  // Another class picked: show what was already noted for it.
  box.onchange = e => { if (e.target.id !== 'tgC') return; const s = slots[+e.target.value], h = taughtAt(l, s.classId, s.date); if (h) { $('#tgS').value = h.slide; $('#tgN').value = h.note; } };
  box.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'tgN') { e.preventDefault(); save(); } };
  box.onclick = e => { if (e.target.closest('[data-x]')) return closeDlg(); if (e.target.closest('[data-ok]')) save(); };
}

/* ---------- starting ---------- */
// Where to begin: the slide asked for; or, from slide 1, the slide this class stopped on last time if it stopped partway.
function prResume(l, slot) {
  const ts = (l.taught || []).filter(t => !slot || t.classId === slot.classId), t = ts[ts.length - 1];
  return t && t.slide < l.slides.length && t.slide < t.of ? t : null;
}
async function presentStart(l, o) {
  if (!l || PR.on) return;
  o = o || {};
  try { editorCommit(); } catch { }
  const slot = o.slot && l.slots.some(s => prSameSlot(s, o.slot)) ? o.slot : prSlotNow(l);
  const back = prResume(l, slot), i = o.at > 0 ? Math.min(o.at, l.slides.length - 1) : back ? back.slide - 1 : 0;
  const ag = l.slides.find(s => s.layout === 'agenda');
  Object.assign(PR, { on: true, l, i, far: i, slot, began: Date.now(), ended: false, blank: false, notes: false, agenda: false, menu: false, ticks: new Set(), timer: null, num: '', keep: false, video: false, full: false, back: document.activeElement,
    items: ag ? rtParse(ag.body).filter(x => x.text.trim()) : null, agTitle: ag ? plainTitle(ag.title) || 'Agenda' : '' });
  const el = PR.el = document.createElement('div');
  el.id = 'present'; el.className = 'pr'; el.tabIndex = -1; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Presenting ' + l.title);
  const b = (p, icon, label, key, cls) => '<button data-p="' + p + '"' + (cls ? ' class="' + cls + '"' : '') + ' title="' + label + ' (' + key + ')"' + (cls === 'ic' ? ' aria-label="' + label + '"' : '') + '>' + prIcon(icon) + (cls === 'ic' ? '' : '<span class="lb">' + label + '</span>') + '</button>';
  el.innerHTML = '<div class="pr-stage" id="prStage"><div class="pr-fit" id="prFit"></div></div>' +
    '<div class="pr-notes" id="prNotes" hidden></div>' +
    '<aside class="pr-agenda" id="prAgenda" aria-label="Agenda" hidden></aside>' +
    '<button class="pr-chip" id="prChip" data-p="chip" hidden></button>' +
    '<div class="pr-cover" id="prCover" hidden></div>' +
    '<div class="pr-menu" id="prMenu" role="group" aria-label="Timer" hidden></div>' +
    '<div class="pr-hint" id="prHint" hidden></div><div class="pr-say" id="prSay" aria-live="polite"></div>' +
    '<div class="pr-bar" id="prBar" role="toolbar" aria-label="Presenting">' + b('prev', 'prev', 'Previous slide', '←', 'ic') + '<span class="pr-count" id="prCount"></span>' + b('next', 'next', 'Next slide', '→', 'ic') + '<span class="pr-sep"></span>' +
    b('agenda', 'agenda', 'Agenda', 'A') + b('timer', 'timer', 'Timer', 'T') + b('notes', 'notes', 'Notes', 'N') + b('blank', 'blank', 'Blank', 'B') + b('full', 'full', 'Full screen', 'F') +
    '<span class="pr-sep"></span><span class="pr-time" id="prTime"></span><button data-p="end" class="pr-end" title="Finish (Esc)">Finish</button></div>';
  document.body.appendChild(el);
  document.addEventListener('keydown', prKey, true);
  document.addEventListener('fullscreenchange', prFull);
  window.addEventListener('resize', prFit);
  el.addEventListener('click', prClick);
  el.addEventListener('pointermove', prWake);
  PR.tickT = setInterval(prTick, 250);
  prShow(); prTick(); prWake(); el.focus();
  if (!o.window) try { await el.requestFullscreen(); } catch { }
  prFit();
  try { PR.lock = await navigator.wakeLock.request('screen'); } catch { }
  prHint(back && !(o.at > 0) ? 'Picking up at slide ' + back.slide + ', where ' + (back.classId ? className(back.classId) : 'the class') + ' stopped on ' + shortDate(back.date) + '. Home goes to slide 1.'
    : (document.fullscreenElement ? '' : 'F for full screen · ') + '→ next · A agenda · T timer · Esc to finish', back && !(o.at > 0) ? 7000 : 4500);
}
// planner.html#present/<lesson id>/<class id>: the lesson opens and presents, in the window (a page can't go full screen by itself).
function presentArrive(rest) {
  const [id, classId] = rest.split('/'), l = L.lessons.find(x => x.id === id); if (!l) return;
  openLesson(l);
  presentStart(l, { slot: classId ? { classId, date: prToday() } : null, window: true });
}

/* ---------- drawing ---------- */
function prFit() {
  const st = $('#prStage'), f = $('#prFit'); if (!st || !f) return;
  const k = Math.min(st.clientWidth / 1280, st.clientHeight / 720) || 1;
  f.style.setProperty('--k', k); f.style.width = 1280 * k + 'px'; f.style.height = 720 * k + 'px';
}
function prShow() {
  const l = PR.l, n = l.slides.length, s = l.slides[PR.i];
  PR.video = false;
  $('#prFit').innerHTML = '<div class="ls-slide">' + slideHtml(s, l, false) + '</div>';
  prPaint();
}
// Everything around the slide. The slide itself is left alone, so a video on it keeps playing.
function prPaint() {
  const l = PR.l, n = l.slides.length, s = l.slides[PR.i];
  $('#prCount').textContent = (PR.i + 1) + ' / ' + n;
  const c = $('#prCover');
  c.hidden = !PR.ended && !PR.blank;
  c.innerHTML = PR.ended && !PR.blank ? '<b>End of the lesson</b><span>Click, or press Esc, to finish</span>' : '';
  const nt = $('#prNotes'); nt.hidden = !PR.notes; nt.classList.toggle('none', !s.notes.trim()); nt.textContent = s.notes.trim() || 'No speaker notes on this slide.';
  PR.el.style.setProperty('--nb', PR.notes ? nt.offsetHeight + 'px' : '0px');   // the bar sits above the notes
  for (const [p, on] of [['agenda', PR.agenda], ['notes', PR.notes], ['blank', PR.blank]]) PR.el.querySelector('[data-p="' + p + '"]').setAttribute('aria-pressed', String(!!on));
  PR.el.querySelector('[data-p="timer"]').setAttribute('aria-expanded', String(!!PR.menu));
  PR.el.querySelector('[data-p="full"] .lb').textContent = document.fullscreenElement ? 'Leave full screen' : 'Full screen';
  $('#prSay').textContent = PR.blank ? 'The screen is blank' : PR.ended ? 'End of the lesson' : 'Slide ' + (PR.i + 1) + ' of ' + n + (prSlideName(s) ? ': ' + prSlideName(s) : '');
  prAgenda(); prFit();
}
function prAgenda() {
  const a = $('#prAgenda'); a.hidden = !PR.agenda; if (!PR.agenda) return;
  const it = PR.items || [], top = it.map((x, i) => ({ x, i })).filter(o => o.x.lvl === 0), now = top.find(o => !PR.ticks.has(o.i));
  let h = '';
  if (top.length) {
    h = '<h2>' + esc(PR.agTitle) + '</h2>' + it.map((x, i) => x.lvl ? '<div class="pr-asub">' + rtInlineHtml(x.text) + '</div>'
      : '<button class="pr-ai' + (PR.ticks.has(i) ? ' done' : '') + (now && now.i === i ? ' now' : '') + '" data-ag="' + i + '" aria-pressed="' + PR.ticks.has(i) + '"><span class="bx">' + prIcon('check') + '</span><span class="tx">' + rtInlineHtml(x.text) + '</span></button>').join('');
  } else {
    // No agenda slide, or an empty one: the slides by name, to jump to.
    h = '<h2>Slides</h2><p class="pr-anone">This lesson has no agenda yet. Its slides:</p>' + PR.l.slides.map((s, i) => '<button class="pr-ai' + (i === PR.i ? ' now' : '') + '" data-goto="' + i + '"><span class="tx">' + (i + 1) + '. ' + esc(prSlideName(s)) + '</span></button>').join('');
  }
  a.innerHTML = h + '<div class="pr-aclock" id="prAClock">' + esc(prClock()) + '</div>';
}
let prHintT;
function prHint(msg, ms) {
  const h = $('#prHint'); if (!h) return;
  h.textContent = msg; h.hidden = !msg; clearTimeout(prHintT);
  if (msg) prHintT = setTimeout(() => { const x = $('#prHint'); if (x) x.hidden = true; }, ms || 3500);
}
// The bar and the mouse pointer go away when the mouse has been still for a moment.
function prWake() {
  if (!PR.on) return;
  PR.el.classList.remove('idle'); clearTimeout(PR.idleT);
  PR.idleT = setTimeout(() => { if (PR.on && !PR.menu && !PR.el.querySelector('.pr-bar:hover')) PR.el.classList.add('idle'); }, 2600);
}

/* ---------- moving ---------- */
function prGo(i) {
  const n = PR.l.slides.length;
  if (PR.blank) PR.blank = false;
  if (i >= n) { if (PR.ended) return presentEnd(); PR.ended = true; PR.far = n - 1; return prShow(); }
  PR.ended = false; PR.i = Math.max(0, i); PR.far = Math.max(PR.far, PR.i); prShow();
}
const prNext = () => prGo(PR.ended ? PR.l.slides.length : PR.i + 1);
const prPrev = () => prGo(PR.ended ? PR.l.slides.length - 1 : PR.i - 1);
function prToggle(k) {
  if (k === 'blank') PR.blank = !PR.blank; else if (k === 'notes') PR.notes = !PR.notes; else if (k === 'agenda') PR.agenda = !PR.agenda;
  prPaint();
}
async function prFullToggle() {
  try { if (document.fullscreenElement) { PR.keep = true; await document.exitFullscreen(); } else await PR.el.requestFullscreen(); } catch { }
}
// Esc in full screen is taken by the browser to leave full screen: that is the teacher finishing.
function prFull() {
  if (!PR.on) return;
  // Only a stage that was full screen can be left that way: a late event from the last time it was shown doesn't count.
  const full = document.fullscreenElement === PR.el, was = PR.full; PR.full = full;
  if (was && !full && !PR.keep && !PR.video) return presentEnd();
  PR.keep = false; prPaint();
}
// A video slide plays in place (YouTube, on the web address); anything else opens in its own tab.
function prPlay() {
  const s = PR.l.slides[PR.i], v = s.video, box = PR.el.querySelector('.pr-fit .ls-vid'); if (!v || !box) return;
  const id = ytId(v.url);
  if (id && /^https?:$/.test(location.protocol)) {
    PR.video = true;
    box.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0' + (v.start ? '&start=' + v.start : '') + '" title="' + esc(v.title || 'Video') + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
  } else { PR.keep = true; window.open(videoLink(v), '_blank', 'noopener'); }
}

/* ---------- the timer ---------- */
const prSound = () => { try { return localStorage.getItem('gsp.presentSound') !== '0'; } catch { return true; } };
function prChime() {
  if (!prSound() || !PR.ac) return;
  try {
    const C = PR.ac, t0 = C.currentTime;
    [[0, 660], [.4, 660], [.8, 880]].forEach(([d, f]) => {
      const o = C.createOscillator(), g = C.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(.3, t0 + d + .03); g.gain.exponentialRampToValueAtTime(.0001, t0 + d + .35);
      o.connect(g); g.connect(C.destination); o.start(t0 + d); o.stop(t0 + d + .4);
    });
  } catch { }
}
function prTimerStart(sec) {
  sec = Math.max(1, Math.min(180 * 60, Math.round(sec)));
  PR.timer = { end: Date.now() + sec * 1000, left: sec, paused: false, done: false };
  try { PR.ac = PR.ac || new (window.AudioContext || window.webkitAudioContext)(); } catch { }
  prMenu(false); prTick();
}
function prTimerPause() {
  const t = PR.timer; if (!t || t.done) return;
  if (t.paused) { t.end = Date.now() + t.left * 1000; t.paused = false; } else { t.left = Math.max(0, Math.ceil((t.end - Date.now()) / 1000)); t.paused = true; }
  prTick(); if (PR.menu) prMenu(true);
}
function prTimerAdd(sec) {
  const t = PR.timer; if (!t) return prTimerStart(sec);
  if (t.done) return prTimerStart(sec);
  if (t.paused) t.left += sec; else t.end += sec * 1000;
  prTick();
}
function prTimerStop() { PR.timer = null; prTick(); if (PR.menu) prMenu(true); }
function prTick() {
  if (!PR.on) return;
  const clock = prClock(), tm = $('#prTime'), ac = $('#prAClock');
  if (tm && tm.textContent !== clock) tm.textContent = clock;
  if (ac && ac.textContent !== clock) ac.textContent = clock;
  const t = PR.timer, chip = $('#prChip');
  if (!t) { if (!chip.hidden) chip.hidden = true; return; }
  if (!t.paused && !t.done) { t.left = Math.max(0, Math.ceil((t.end - Date.now()) / 1000)); if (!t.left) { t.done = true; prChime(); if (PR.menu) prMenu(true); } }
  const txt = t.done ? 'Time’s up' : mmss(t.left) + (t.paused ? '<small>Paused</small>' : '');
  if (chip.dataset.h !== txt) { chip.dataset.h = txt; chip.innerHTML = txt; }
  chip.hidden = false; chip.className = 'pr-chip' + (t.done ? ' done' : t.paused ? ' paused' : '');
  chip.setAttribute('aria-label', t.done ? 'Time’s up. Click to clear' : mmss(t.left) + ' left. Click to ' + (t.paused ? 'go on' : 'pause'));
}
function prMenu(open) {
  PR.menu = !!open;
  const m = $('#prMenu'); m.hidden = !PR.menu;
  PR.el.querySelector('[data-p="timer"]').setAttribute('aria-expanded', String(PR.menu));
  if (!PR.menu) return prWake();
  const t = PR.timer, run = t && !t.done;
  m.innerHTML = '<h3>' + (run ? 'Timer' : 'Start a timer the class can see') + '</h3>' +
    (run ? '<div class="pr-run"><button data-p="tpause">' + (t.paused ? 'Go on' : 'Pause') + '</button><button data-p="tadd">+1 min</button><button data-p="tstop">Stop</button></div>'
      : '<div class="pr-mins">' + [1, 2, 3, 5, 10, 15].map(n => '<button data-tm="' + n + '" aria-label="' + n + ' minute' + (n === 1 ? '' : 's') + '">' + n + '</button>').join('') + '</div>' +
        '<div class="pr-own"><label for="prOwn">Minutes</label><input type="number" id="prOwn" min="1" max="180" step="1" inputmode="numeric"><span class="sp"></span><button data-p="town">Start</button></div>') +
    '<label class="pr-snd"><input type="checkbox" id="prSnd"' + (prSound() ? ' checked' : '') + '> A sound when the time is up</label>';
  m.querySelector('#prSnd').onchange = e => { try { localStorage.setItem('gsp.presentSound', e.target.checked ? '1' : '0'); } catch { } };
}

/* ---------- the mouse and the keys ---------- */
function prClick(e) {
  prWake();
  const t = e.target;
  // A button pressed with the mouse gives the keys back to the slides, so Space still means the next slide.
  if (e.detail && t.closest('#prBar,#prChip')) PR.el.focus();
  if (t.closest('#prMenu')) {
    const b = t.closest('button'); if (!b) return;
    if (b.dataset.tm) return prTimerStart(+b.dataset.tm * 60);
    if (b.dataset.p === 'town') { const v = +$('#prOwn').value; return v > 0 ? prTimerStart(v * 60) : $('#prOwn').focus(); }
    if (b.dataset.p === 'tpause') return prTimerPause();
    if (b.dataset.p === 'tadd') return prTimerAdd(60);
    if (b.dataset.p === 'tstop') return prTimerStop();
    return;
  }
  const p = (t.closest('[data-p]') || {}).dataset;
  if (PR.menu && !(p && p.p === 'timer')) { prMenu(false); if (!p) return; }
  if (p) {
    if (p.p === 'prev') return prPrev();
    if (p.p === 'next') return prNext();
    if (p.p === 'agenda' || p.p === 'notes' || p.p === 'blank') return prToggle(p.p);
    if (p.p === 'timer') return prMenu(!PR.menu);
    if (p.p === 'full') return prFullToggle();
    if (p.p === 'end') return presentEnd();
    if (p.p === 'chip') return PR.timer && PR.timer.done ? prTimerStop() : prTimerPause();
    return;
  }
  if (t.closest('#prBar')) return;
  const ag = t.closest('#prAgenda');
  if (ag) {
    const a = t.closest('[data-ag]'), g = t.closest('[data-goto]');
    if (a) { const i = +a.dataset.ag; if (PR.ticks.has(i)) PR.ticks.delete(i); else PR.ticks.add(i); return prAgenda(); }
    if (g) return prGo(+g.dataset.goto);
    return;
  }
  if (t.closest('#prNotes')) return;
  if (PR.blank) return prToggle('blank');
  if (PR.ended) return presentEnd();
  if (t.closest('.pr-fit .ls-vid') && PR.l.slides[PR.i].video) { if (!PR.video) prPlay(); return; }
  if (t.closest('.pr-fit a[href]')) return;
  prNext();
}
function prKey(e) {
  if (!PR.on) return;
  e.stopPropagation();   // nothing behind the stage gets a key
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key, own = e.target && e.target.id === 'prOwn';
  if (own) { if (k === 'Enter') { e.preventDefault(); const v = +e.target.value; if (v > 0) prTimerStart(v * 60); } else if (k === 'Escape') { e.preventDefault(); prMenu(false); PR.el.focus(); } return; }
  if (k === 'Tab') return prWake();
  if ((k === ' ' || k === 'Enter') && e.target && e.target.closest && e.target.closest('#present button,#present input')) return;   // the button in hand does its own thing
  const stop = () => e.preventDefault();
  if (PR.menu) {
    stop();
    if (/^[1-9]$/.test(k)) return prTimerStart(+k * 60);
    if (k === 'Escape' || k.toLowerCase() === 't') return prMenu(false);
    return;
  }
  if (PR.blank) { stop(); return prToggle('blank'); }
  if (/^\d$/.test(k)) { stop(); PR.num = (PR.num + k).slice(-3); clearTimeout(PR.numT); PR.numT = setTimeout(() => { PR.num = ''; }, 2500); return prHint('Slide ' + PR.num + ': press Enter', 2500); }
  if (k === 'Enter' && PR.num) { stop(); const i = +PR.num - 1; PR.num = ''; prHint(''); return prGo(Math.min(i, PR.l.slides.length - 1)); }
  PR.num = '';
  if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Enter') { stop(); return prNext(); }
  if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') { stop(); return prPrev(); }
  if (k === 'Home') { stop(); return prGo(0); }
  if (k === 'End') { stop(); return prGo(PR.l.slides.length - 1); }
  if (k === 'Escape') { stop(); return presentEnd(); }
  const c = k.toLowerCase();
  if (c === 'a') { stop(); return prToggle('agenda'); }
  if (c === 'n') { stop(); return prToggle('notes'); }
  if (c === 'b' || k === '.') { stop(); return prToggle('blank'); }
  if (c === 't') { stop(); return prMenu(true); }
  if (c === 'f') { stop(); return prFullToggle(); }
}

/* ---------- finishing ---------- */
async function presentEnd() {
  if (!PR.on) return;
  const { l, i, far, slot, began, el, back, ticks, items } = PR;
  PR.on = false;
  clearInterval(PR.tickT); clearTimeout(PR.idleT); clearTimeout(prHintT); clearTimeout(PR.numT);
  document.removeEventListener('keydown', prKey, true); document.removeEventListener('fullscreenchange', prFull); window.removeEventListener('resize', prFit);
  const lock = PR.lock, ac = PR.ac, full = document.fullscreenElement === el;
  PR.lock = PR.ac = PR.timer = PR.el = null;
  el.remove();   // a full-screen stage taken off the page leaves full screen by itself
  try { if (full && document.fullscreenElement) await document.exitFullscreen(); } catch { }
  try { if (lock) await lock.release(); } catch { }
  try { if (ac) ac.close(); } catch { }
  if (L.view === 'edit' && L.open === l) { L.cur = Math.min(i, l.slides.length - 1); renderEditor(); }
  if (back && back.isConnected && back.focus) try { back.focus({ preventScroll: true }); } catch { }
  // Taught on its day, for more than a moment: one line on where the class got to.
  const top = (items || []).filter(x => x.lvl === 0).length, done = (items || []).filter((x, k) => x.lvl === 0 && ticks.has(k)).length;
  if (slot && slot.date === prToday() && l.slots.some(s => prSameSlot(s, slot)) && Date.now() - began >= PR.askMs) taughtDlg(l, { slot, slide: far + 1, agenda: done ? [done, top] : null });
}

/* ---------- the buttons in the Planner ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-pr]'); if (!b || PR.on) return;
  const a = b.dataset.pr, l = a === 'go' ? L.lessons.find(x => x.id === b.dataset.id) : L.open;
  if (!l) return;
  if (a === 'present') return presentStart(l, { at: L.cur });
  if (a === 'go') return presentStart(l, { slot: { classId: b.dataset.c, date: b.dataset.d } });
  if (a === 'note') return taughtDlg(l);
  const t = (l.taught || [])[+b.dataset.i]; if (!t) return;
  if (a === 'tedit') return taughtDlg(l, { edit: t });
  if (a === 'tdel') {
    l.taught = l.taught.filter(x => x !== t); if (!l.taught.length) delete l.taught;
    lPut(l); taughtRedraw(l);
    return undoToast('Note removed', () => { l.taught = normTaught([...(l.taught || []), t]); lPut(l); taughtRedraw(l); });
  }
});
window.__present = { PR, start: presentStart, end: presentEnd, timer: prTimerStart, normTaught, taughtDlg };
