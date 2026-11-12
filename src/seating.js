/* ---------------- a class's Seating tab: who sits where, shuffling, groups and picking a name ---------------- */
// Kept on the class beside its roster, as c.seats: { w, h, desks: { "x,y": roster name or '' }, flip, pins: [roster names] }.
// The room is a grid w across and h deep with the front at y = 0; a square with a desk is in desks, with the student at it or ''.
// It lives in lib, so it stays in this browser, goes wherever the roster goes and merges like the rest of the class.
// Anything else that wants to know where students sit (attendance, say) reads it with seatOf(c) and never c.seats itself.
const SEAT_MAX_W = 14, SEAT_MAX_H = 12;
const SEAT_ROOMS = [['rows', 'Rows', 'Single desks in rows'], ['pairs', 'Pairs', 'Desks side by side in twos'], ['tables', 'Tables of four', 'Four desks pushed together'], ['horseshoe', 'Horseshoe', 'Desks around three sides, open to the front']];
const ST = { cid: '', sel: null, arrange: false, dragged: 0 };
const seatXY = k => k.split(',').map(Number);
// The desks from the front row back, left to right.
const seatKeys = s => Object.keys(s.desks).sort((a, b) => { const [ax, ay] = seatXY(a), [bx, by] = seatXY(b); return ay - by || ax - bx; });
// A room of one kind with a desk for each of n students: { w, h, cells } with the cells in the order they fill.
function seatRoom(kind, n) {
  n = Math.max(1, Math.min(60, n));
  const cells = [];
  if (kind === 'pairs') {
    const across = n <= 16 ? 2 : 3, per = across * 2, rows = Math.ceil(n / per);
    for (let y = 0; y < rows; y++) for (let p = 0; p < across; p++) cells.push([3 * p, y], [3 * p + 1, y]);
  } else if (kind === 'tables') {
    const tables = Math.ceil(n / 4), across = tables <= 4 ? 2 : tables <= 9 ? 3 : 4;
    for (let t = 0; t < tables; t++) { const x = 3 * (t % across), y = 3 * Math.floor(t / across); cells.push([x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]); }
  } else if (kind === 'horseshoe') {
    const w = Math.min(SEAT_MAX_W, Math.max(4, Math.ceil(n * .4))), h = Math.min(SEAT_MAX_H, Math.max(2, Math.ceil((n - w) / 2) + 1));
    for (let y = 0; y < h - 1; y++) cells.push([0, y]);
    for (let x = 0; x < w; x++) cells.push([x, h - 1]);
    for (let y = h - 2; y >= 0; y--) cells.push([w - 1, y]);
    for (let y = h - 3; y >= 0 && cells.length < n; y -= 2) for (let x = 2; x < w - 2 && cells.length < n; x++) cells.push([x, y]);   // a very big class: rows inside the horseshoe
  } else {
    const per = n <= 12 ? 4 : n <= 20 ? 5 : n <= 36 ? 6 : 7, rows = Math.ceil(n / per);
    for (let y = 0; y < rows; y++) for (let x = 0; x < per; x++) cells.push([x, y]);
  }
  if (kind !== 'horseshoe') cells.length = Math.min(cells.length, n);   // no more desks than students; a horseshoe keeps its shape
  return { w: Math.max(...cells.map(c => c[0])) + 1, h: Math.max(...cells.map(c => c[1])) + 1, cells: cells.map(c => c.join(',')) };
}
// The class's seats, tidied: a student who has left the roster has left their desk, and nobody sits twice. Null when no room has been set up.
function seatOf(c) {
  const s = c && c.seats; if (!s || typeof s !== 'object' || !s.desks || typeof s.desks !== 'object') return null;
  const w = Math.max(1, Math.min(SEAT_MAX_W, Math.round(+s.w) || 1)), h = Math.max(1, Math.min(SEAT_MAX_H, Math.round(+s.h) || 1)), desks = {}, used = new Set();
  for (const [k, v] of Object.entries(s.desks)) {
    if (!/^\d+,\d+$/.test(k)) continue;
    const [x, y] = seatXY(k); if (x >= w || y >= h) continue;
    const n = typeof v === 'string' && v && c.names.includes(v) && !used.has(v) ? v : '';
    if (n) used.add(n); desks[k] = n;
  }
  return { w, h, desks, flip: !!s.flip, pins: (Array.isArray(s.pins) ? s.pins : []).filter(n => used.has(n)) };
}
// Where each seated student is: [{ name, x, y }], front row first. For other parts of the app.
const seatList = c => { const s = seatOf(c); return s ? seatKeys(s).filter(k => s.desks[k]).map(k => ({ name: s.desks[k], x: seatXY(k)[0], y: seatXY(k)[1] })) : []; };
function seatSave(c, s) {
  if (!s) delete c.seats;
  else c.seats = { w: s.w, h: s.h, desks: s.desks, ...(s.flip ? { flip: true } : {}), ...(s.pins && s.pins.length ? { pins: s.pins } : {}) };
  saveLib(); seatDraw();
}
// A change that can be taken back from the note that says it happened.
function seatUndoable(c, msg, change) {
  const was = c.seats ? JSON.stringify(c.seats) : null;
  const more = change() || ''; ST.sel = null;
  toastDo(msg + more, 'Undo', () => { if (was) c.seats = JSON.parse(was); else delete c.seats; saveLib(); seatDraw(); });
}
// Everyone into the desks from the front, in roster order or shuffled. A student kept in their seat stays.
function seatFill(c, shuffle) {
  const s = seatOf(c), pinned = new Set(s.pins), keys = seatKeys(s).filter(k => !pinned.has(s.desks[k]));
  let who = c.names.filter(n => !pinned.has(n)); if (shuffle) who = pkShuffle(who);
  keys.forEach((k, i) => { s.desks[k] = who[i] || ''; });
  seatSave(c, s);
  return Math.max(0, who.length - keys.length);
}
// One student to a desk (changing places with whoever is there) or, with no desk, off the chart.
function seatPut(c, name, key) {
  const s = seatOf(c), from = Object.keys(s.desks).find(k => s.desks[k] === name) || null;
  if (key === from || (key && !(key in s.desks))) return;
  const other = key ? s.desks[key] : '';
  if (key) s.desks[key] = name;
  if (from) s.desks[from] = other || '';
  s.pins = s.pins.filter(n => n !== name && n !== other);
  seatSave(c, s);
}
// A new room, with the students who were seated put into it in the order they sat.
function seatSetRoom(c, kind) {
  const was = seatOf(c), who = was ? seatKeys(was).map(k => was.desks[k]).filter(Boolean) : [], r = seatRoom(kind, c.names.length), desks = {};
  r.cells.forEach(k => { desks[k] = ''; });
  const order = seatKeys({ desks }); who.forEach((n, i) => { if (order[i]) desks[order[i]] = n; });
  seatSave(c, { w: r.w, h: r.h, desks, flip: was ? was.flip : false, pins: [] });
}

/* ---------- drawing ---------- */
const seatMini = kind => { const r = seatRoom(kind, 24), on = new Set(r.cells); let h = ''; for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) h += '<i' + (on.has(x + ',' + y) ? ' class="d"' : '') + '></i>'; return '<span class="seatmini" style="--w:' + r.w + '" aria-hidden="true">' + h + '</span>'; };
const seatRoomBtns = cls => SEAT_ROOMS.map(([k, l, sub]) => '<button class="' + cls + '" data-seatroom="' + k + '" title="' + sub + '">' + (cls === 'seatkind' ? seatMini(k) + '<b>' + l + '</b><small>' + sub + '</small>' : l) + '</button>').join('');
// The grid of a room. how: 'use' (students can be moved), 'arrange' (every square is a button) or 'show' (to look at only).
function seatGrid(c, s, how, flip) {
  const short = pkShort(c.names), pins = new Set(s.pins); let h = '';
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
    const x = flip ? s.w - 1 - i : i, y = flip ? s.h - 1 - j : j, k = x + ',' + y, has = k in s.desks, name = has ? s.desks[k] : '', n = name ? c.names.indexOf(name) : -1;
    const inner = name ? '<span>' + esc(short[n]) + '</span>' + (pins.has(name) ? '<i class="seatpin" title="Stays here when the class is shuffled"></i>' : '') : '';
    if (how === 'arrange') h += '<button class="seat' + (has ? name ? '' : ' empty' : ' gap') + '" data-cell="' + k + '" aria-pressed="' + has + '" aria-label="' + (has ? 'Desk' + (name ? ', ' + esc(pkNice(name)) : '') + '. Click to take it away' : 'No desk. Click to put one here') + '">' + inner + '</button>';
    else if (!has) h += '<span class="seatgap"></span>';
    else if (how === 'show') h += '<span class="seat' + (name ? '' : ' empty') + '">' + inner + '</span>';
    else h += '<button class="seat' + (name ? '' : ' empty') + (n >= 0 && n === ST.sel ? ' sel' : '') + '" data-desk="' + k + '"' + (n >= 0 ? ' data-n="' + n + '" title="' + esc(pkNice(name)) + '"' : '') + ' aria-label="' + (name ? esc(pkNice(name)) : 'Empty desk') + '">' + inner + '</button>';
  }
  const front = '<div class="seatfront">Front of the room</div>';
  return (flip ? '' : front) + '<div class="seatgrid" style="--w:' + s.w + '">' + h + '</div>' + (flip ? front : '');
}
function seatPanel(el, c) {
  ST.cid = c.id; ST.sel = null; ST.arrange = false;
  el.onclick = seatClick; el.onpointerdown = seatDown;
  seatDraw();
}
function seatDraw() {
  const el = $('#classPanel'), c = classById(ST.cid), r = routeNow();
  if (!el || !c || r.v !== 'class' || r.c !== c || r.tab !== 'seating') return;
  const s = seatOf(c);
  if (!s) {
    el.innerHTML = '<div class="seatstart" id="seatStart"><h2>How is the room set up?</h2><p class="muted">Pick the closest one. There is a desk for each of the ' + c.names.length + ' students, and any desk can be moved or taken away afterwards.</p><div class="seatkinds">' + seatRoomBtns('seatkind') + '</div></div>';
    return;
  }
  const seated = new Set(Object.values(s.desks).filter(Boolean)), out = c.names.map((n, i) => ({ n, i })).filter(o => !seated.has(o.n)), desks = Object.keys(s.desks).length, short = pkShort(c.names);
  if (ST.sel != null && !c.names[ST.sel]) ST.sel = null;
  const sum = seated.size + ' of ' + c.names.length + ' seated' + (desks < c.names.length ? ' · ' + people(c.names.length - desks, 'more desk') + ' needed' : '');
  if (ST.arrange) {
    const step = (k, label, v, max) => '<span class="seatstep"><span>' + label + '</span><button class="icon" data-seatsize="' + k + ':-1" aria-label="Fewer ' + label.toLowerCase() + '"' + (v <= 1 ? ' disabled' : '') + '>−</button><b>' + v + '</b><button class="icon" data-seatsize="' + k + ':1" aria-label="More ' + label.toLowerCase() + '"' + (v >= max ? ' disabled' : '') + '>+</button></span>';
    el.innerHTML = '<div class="pplbar seatbar"><b>Arrange the room</b><span class="muted">Click a square to put a desk there or take it away.</span><span class="sp"></span><button class="btn sm primary" data-seat="done">Done</button></div>' +
      '<div class="pplbar seatbar seatbar2"><span class="muted">Start again from</span>' + seatRoomBtns('btn sm') + '<span class="sp"></span>' + step('w', 'Columns', s.w, SEAT_MAX_W) + step('h', 'Rows', s.h, SEAT_MAX_H) + '</div>' +
      '<div class="seatwrap"><div class="seatroom arr" id="seatRoom">' + seatGrid(c, s, 'arrange', s.flip) + '</div></div>';
    return;
  }
  const sel = ST.sel != null ? c.names[ST.sel] : null, selSeated = sel && seated.has(sel), pinned = sel && s.pins.includes(sel);
  el.innerHTML = '<div class="pplbar seatbar"><span class="muted" id="seatSum">' + sum + '</span><span class="sp"></span>' +
    '<button class="btn sm" data-seat="shuffle" title="Everyone to a new seat">Shuffle</button><button class="btn sm" data-seat="groups" title="Deal the class into groups, on a screen the class can read">Make groups</button><button class="btn sm primary" data-seat="pick" title="A student at random, on a screen the class can read">Pick a name</button>' +
    kmWrap('⋯', 'class="icon kdots" aria-label="More for the seating chart" title="More"',
      '<button class="mitem" data-seat="arrange">Arrange the room<small>Add or take away desks, or start from another layout</small></button>' +
      '<button class="mitem" data-seat="order">Seat in roster order<small>From the front, left to right</small></button>' +
      '<button class="mitem" data-seat="empty">Empty every seat</button>' +
      '<button class="mitem" data-seat="flip">' + (s.flip ? 'Front of the room at the top' : 'Front of the room at the bottom') + '<small>' + (s.flip ? 'As the students see it' : 'As you see it from the front') + '</small></button>' +
      '<button class="mitem" data-seat="show">Show to the class<small>The chart on its own, full screen</small></button>' +
      '<button class="mitem" data-seat="print">Print</button>', 'right') + '</div>' +
    '<div class="seatselbar" id="seatSel" aria-live="polite"' + (sel ? '' : ' hidden') + '>' + (sel ? '<span><b>' + esc(pkNice(sel)) + '</b> · click a desk to move them there' + (selSeated ? '' : ', or drag them') + '.</span><span class="sp"></span>' +
      (selSeated ? '<button class="btn sm" data-seat="pin" aria-pressed="' + !!pinned + '" title="Shuffle and Seat in roster order leave this student where they are">' + (pinned ? 'Kept in this seat ✓' : 'Keep in this seat') + '</button><button class="btn sm" data-seat="unseat">Take off the chart</button>' : '') +
      '<button class="btn sm ghost" data-seat="unsel">Cancel</button>' : '') + '</div>' +
    '<div class="seatwrap"><div class="seatroom" id="seatRoom">' + seatGrid(c, s, 'use', s.flip) + '</div>' +
    '<aside class="seattray" id="seatTray" aria-label="Not seated"><h3>Not seated' + (out.length ? ' <span>' + out.length + '</span>' : '') + '</h3>' +
      (out.length ? '<div class="seatchips">' + out.map(o => '<button class="seatchip' + (o.i === ST.sel ? ' sel' : '') + '" data-n="' + o.i + '" title="' + esc(pkNice(o.n)) + '">' + esc(short[o.i]) + '</button>').join('') + '</div>'
        : '<p class="muted">Everyone has a seat.</p>') +
      '<p class="muted seathint">Drag a student to a desk, or click the student and then the desk. Dropping one student on another swaps them. Drag someone here to take them off the chart.</p></aside></div>';
}

/* ---------- the mouse, a finger and the keys ---------- */
function seatClick(e) {
  const c = classById(ST.cid); if (!c) return;
  if (Date.now() - ST.dragged < 400) return;   // the end of a drag is not a click
  const t = e.target, s = seatOf(c);
  const room = t.closest('[data-seatroom]');
  if (room) { if (!s) return seatSetRoom(c, room.dataset.seatroom); return seatUndoable(c, 'The room is laid out again', () => { seatSetRoom(c, room.dataset.seatroom); }); }
  if (!s) return;
  const act = (t.closest('[data-seat]') || {}).dataset, sel = ST.sel != null ? c.names[ST.sel] : null;
  if (act) {
    const a = act.seat;
    if (a === 'shuffle') return seatUndoable(c, 'Seats shuffled', () => { const left = seatFill(c, true); return left ? '. ' + people(left, 'student has', 'students have') + ' no desk: “Arrange the room” in ⋯ adds desks' : ''; });
    if (a === 'order') return seatUndoable(c, 'Seated in roster order', () => { seatFill(c, false); });
    if (a === 'empty') return seatUndoable(c, 'Every seat is empty', () => { for (const k of Object.keys(s.desks)) s.desks[k] = ''; s.pins = []; seatSave(c, s); });
    if (a === 'flip') { s.flip = !s.flip; return seatSave(c, s); }
    if (a === 'arrange') { ST.arrange = true; ST.sel = null; return seatDraw(); }
    if (a === 'done') { ST.arrange = false; return seatDraw(); }
    if (a === 'groups' || a === 'pick') return pkOpen({ host: document.body, classes: [{ name: c.name, names: c.names }], mode: a, full: true });
    if (a === 'show') return seatShow(c);
    if (a === 'print') return seatPrint(c);
    if (a === 'unsel') { ST.sel = null; return seatDraw(); }
    if (a === 'unseat' && sel) { ST.sel = null; return seatPut(c, sel, null); }
    if (a === 'pin' && sel) { s.pins = s.pins.includes(sel) ? s.pins.filter(n => n !== sel) : [...s.pins, sel]; return seatSave(c, s); }
    return;
  }
  const size = t.closest('[data-seatsize]');
  if (size) {
    const [k, d] = size.dataset.seatsize.split(':'), v = s[k] + +d; if (v < 1 || v > (k === 'w' ? SEAT_MAX_W : SEAT_MAX_H)) return;
    s[k] = v; for (const key of Object.keys(s.desks)) { const [x, y] = seatXY(key); if (x >= s.w || y >= s.h) delete s.desks[key]; }
    return seatSave(c, s);
  }
  const cell = t.closest('[data-cell]');
  if (cell) { const k = cell.dataset.cell; if (k in s.desks) delete s.desks[k]; else s.desks[k] = ''; seatSave(c, s); const again = $('#classPanel [data-cell="' + k + '"]'); if (again) again.focus(); return; }
  const desk = t.closest('[data-desk]'), chip = t.closest('.seatchip');
  if (desk) {
    const k = desk.dataset.desk, there = s.desks[k];
    if (sel && there !== sel) { ST.sel = null; seatPut(c, sel, k); return seatFocus('[data-desk="' + k + '"]'); }
    ST.sel = there && there !== sel ? c.names.indexOf(there) : null; seatDraw(); return seatFocus('[data-desk="' + k + '"]');
  }
  if (chip) { const n = +chip.dataset.n; ST.sel = ST.sel === n ? null : n; seatDraw(); return seatFocus('.seatchip[data-n="' + n + '"]'); }
  if (t.closest('#seatTray') && sel && Object.values(s.desks).includes(sel)) { ST.sel = null; return seatPut(c, sel, null); }
}
const seatFocus = q => { const x = $('#classPanel ' + q); if (x) x.focus(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ST.sel != null && $('#seatSel') && !PK.on && !$('#seatShow')) { ST.sel = null; seatDraw(); } });
// Dragging a student: by mouse, finger or pencil. A press that doesn't move is left to be a click.
function seatDown(e) {
  const from = e.target.closest('[data-n]'), c = classById(ST.cid);
  if (!from || !c || ST.arrange || (e.button != null && e.button > 0)) return;
  const n = +from.dataset.n, name = c.names[n], x0 = e.clientX, y0 = e.clientY; let ghost = null, over = null;
  const at = ev => { ghost.hidden = true; const el = document.elementFromPoint(ev.clientX, ev.clientY); ghost.hidden = false; return el ? el.closest('[data-desk]') || el.closest('#seatTray') : null; };
  const move = ev => {
    if (!ghost) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
      ghost = document.createElement('div'); ghost.className = 'seatghost'; ghost.textContent = pkShort(c.names)[n]; document.body.appendChild(ghost); from.classList.add('lift');
    }
    ev.preventDefault();
    ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
    const o = at(ev); if (o !== over) { if (over) over.classList.remove('over'); over = o; if (over) over.classList.add('over'); }
  };
  const up = ev => {
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
    if (!ghost) return;
    const o = ev.type === 'pointerup' ? at(ev) : null;
    ghost.remove(); from.classList.remove('lift'); if (over) over.classList.remove('over');
    ST.dragged = Date.now(); ST.sel = null;
    if (o && o.dataset.desk) seatPut(c, name, o.dataset.desk);
    else if (o && o.id === 'seatTray') seatPut(c, name, null);
    seatDraw();
  };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
}

/* ---------- for the class to read, and on paper ---------- */
// The chart on its own, as the students see it: the front of the room at the top.
function seatShow(c) {
  const s = seatOf(c); if (!s || $('#seatShow')) return;
  const el = document.createElement('div'), back = document.activeElement;
  el.id = 'seatShow'; el.className = 'seatshow'; el.tabIndex = -1; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Seating chart for ' + c.name);
  el.innerHTML = '<h2>' + esc(c.name) + '</h2><div class="seatroom" style="--sw:' + s.w + ';--sh:' + s.h + '">' + seatGrid(c, s, 'show', false) + '</div><button class="seatshowx" data-x>Close (Esc)</button>';
  document.body.appendChild(el); el.focus();
  const shut = () => { document.removeEventListener('keydown', key, true); document.removeEventListener('fullscreenchange', full); try { if (document.fullscreenElement === el) document.exitFullscreen(); } catch { } el.remove(); if (back && back.isConnected) back.focus(); };
  const key = e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); shut(); } };
  let was = false; const full = () => { const on = document.fullscreenElement === el; if (was && !on) shut(); was = on; };   // Esc in full screen leaves full screen: that closes it too
  document.addEventListener('keydown', key, true); document.addEventListener('fullscreenchange', full);
  el.onclick = e => { if (e.target.closest('[data-x]')) shut(); };
  try { const p = el.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch { }
}
function seatPrint(c) {
  const s = seatOf(c); if (!s) return;
  const el = document.createElement('div'); el.id = 'seatPrint';
  el.innerHTML = '<h2>' + esc(c.name) + ' · seating chart</h2><div class="seatroom">' + seatGrid(c, s, 'show', s.flip) + '</div>';
  document.body.appendChild(el); document.body.classList.add('seatprinting');
  const done = () => { window.removeEventListener('afterprint', done); document.body.classList.remove('seatprinting'); el.remove(); };
  window.addEventListener('afterprint', done);
  window.print();
}

/* ---------- the rosters, where the Planner can call on a student (src/pickshare.js says why) ---------- */
function rollsShare() {
  try {
    const v = JSON.stringify(lib.classes.filter(c => c.names.length).map(c => [c.name, c.names]));
    if (v === '[]') { if (localStorage.getItem(PK_ROLLS) != null) localStorage.removeItem(PK_ROLLS); }
    else if (localStorage.getItem(PK_ROLLS) !== v) localStorage.setItem(PK_ROLLS, v);
  } catch {}
}
rollsShare();
Object.assign(window.__gs, { seatOf, seatList, seatRoom, seatPut, seatFill, rollsShare, saveLib, carryLs });
