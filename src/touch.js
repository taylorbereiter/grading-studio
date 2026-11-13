/* ---------------- tablets: a finger that moves the page, a pencil that draws, and a palm that does nothing (Stage 6) ----------------
   A page's canvas takes every pointer itself (touch-action: none), which is right for a mouse and a pencil but leaves a finger
   unable to scroll the paper. So here a finger on a page is given one of two jobs:
     - two fingers always move the page and pinch to zoom;
     - one finger draws with the tool in hand, until a pencil has been used in this browser (gs.penSeen). From then on one finger
       moves the page and the pencil does the marking. Settings, Marking can fix it either way (gs.touch: 'auto', 'move' or 'draw').
   While the pencil is down, and for a moment after it lifts, a touch on the page is the side of her hand and does nothing.
   Nothing here runs for a mouse or a trackpad. It is all pointer events on the paper, so it is the same in every browser. */
const touchMode = () => { const v = store.get('gs.touch', 'auto'); return v === 'move' || v === 'draw' ? v : 'auto'; };
const ptrLive = new Set();   // every pointer that is down now, for bindPage to know its own gesture is still going
let penSeen = store.get('gs.penSeen', false) === true, penDown = 0, penUpAt = -1e9;   // a pencil used here once is remembered, so the next visit starts with a finger moving the page
const tch = { f: new Map(), mode: '', z0: 1, d0: 0, glide: 0, v: [0, 0], last: 0, far: 0 };
const fingerMoves = () => { const m = touchMode(); return m === 'move' || (m === 'auto' && penSeen); };
const tchPts = () => [...tch.f.values()];
const tchMid = () => { const p = tchPts(); return { x: p.reduce((a, q) => a + q.x, 0) / p.length, y: p.reduce((a, q) => a + q.y, 0) / p.length }; };
const tchDist = () => { const p = tchPts(); return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
// Lets the page go on moving for a moment after a quick flick, as a finger expects.
function tchGlide() {
  cancelAnimationFrame(tch.glide);
  let [vx, vy] = tch.v, t0 = performance.now();
  if (Math.hypot(vx, vy) < 0.35) return;
  const P = $('#paper'), step = t => { const dt = Math.min(40, t - t0); t0 = t; P.scrollLeft -= vx * dt; P.scrollTop -= vy * dt; const k = Math.pow(0.995, dt); vx *= k; vy *= k; if (Math.hypot(vx, vy) > 0.03) tch.glide = requestAnimationFrame(step); };
  tch.glide = requestAnimationFrame(step);
}
$('#paper').addEventListener('pointerdown', e => {
  ptrLive.add(e.pointerId);
  cancelAnimationFrame(tch.glide);
  if (e.pointerType === 'pen') {
    // Her hand often lands a moment before the pencil does. Whatever it began (a line, or moving the page) stops here.
    if (!penSeen) { penSeen = true; store.set('gs.penSeen', true); }
    penDown++;
    if (tch.f.size) { if (!tch.mode) for (const c of document.querySelectorAll('#paper .pg canvas')) c.dispatchEvent(new Event('gsdrop')); tch.mode = 'lift'; }
    return;
  }
  if (e.pointerType !== 'touch') return;
  if (e.target.tagName !== 'CANVAS' || !e.target.closest('.pg')) return;   // anywhere else the browser scrolls and taps as usual
  // The side of her hand: while the pencil is down and just after, or a touch far wider than a fingertip.
  if (penDown > 0 || performance.now() - penUpAt < 500 || Math.max(e.width || 0, e.height || 0) > 60) { e.stopPropagation(); e.preventDefault(); return; }
  tch.f.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (tch.f.size === 2) {
    // A second finger: whatever the first one began to draw is taken back, and the two move and zoom the page.
    for (const c of document.querySelectorAll('#paper .pg canvas')) c.dispatchEvent(new Event('gsdrop'));
    tch.mode = 'two'; tch.z0 = zoom; tch.d0 = tchDist(); tch.v = [0, 0];
    e.stopPropagation(); e.preventDefault();
  } else if (tch.f.size > 2) { e.stopPropagation(); e.preventDefault(); }
  else if (fingerMoves()) { tch.mode = 'one'; tch.v = [0, 0]; tch.far = 0; tch.last = e.timeStamp; commitEditors(); e.stopPropagation(); e.preventDefault(); }
  else tch.mode = '';   // this finger draws: the page's own handler takes it from here
}, true);
window.addEventListener('pointermove', e => {
  const f = tch.f.get(e.pointerId); if (!f) return;
  if (!tch.mode) { f.x = e.clientX; f.y = e.clientY; return; }   // this finger is drawing: only where it is now is kept, for when a second one lands
  const was = tchMid(); f.x = e.clientX; f.y = e.clientY; const now = tchMid(), P = $('#paper'), dx = now.x - was.x, dy = now.y - was.y;
  e.stopPropagation();
  if (tch.mode === 'lift') return;
  // One finger has to travel a little before the page follows, so a hand that only rests on the screen moves nothing.
  if (tch.mode === 'one' && tch.far < 8) { tch.far += Math.hypot(dx, dy); return; }
  if (tch.mode === 'one' || tch.f.size >= 2) { P.scrollLeft -= dx; P.scrollTop -= dy; }
  if (tch.mode === 'one') { const dt = Math.max(1, e.timeStamp - tch.last); tch.last = e.timeStamp; tch.v = [tch.v[0] * 0.6 + dx / dt * 0.4, tch.v[1] * 0.6 + dy / dt * 0.4]; }
  if (tch.mode === 'two' && tch.f.size === 2 && tch.d0 > 20) { const k = tchDist() / tch.d0; if (Math.abs(k - 1) > 0.04 || zoom !== tch.z0) setZoom(tch.z0 * k, now); }
}, true);
const tchUp = e => {
  ptrLive.delete(e.pointerId);
  if (e.pointerType === 'pen') { penDown = Math.max(0, penDown - 1); penUpAt = performance.now(); return; }
  if (!tch.f.delete(e.pointerId)) return;
  if (tch.mode === 'one' && e.type === 'pointerup' && e.timeStamp - tch.last < 80) tchGlide();
  if (tch.mode) e.stopPropagation();
  if (!tch.f.size) tch.mode = '';
  else if (tch.mode === 'two') tch.mode = 'lift';   // one of two fingers lifted: the other neither draws nor drags the page about
};
window.addEventListener('pointerup', tchUp, true);
window.addEventListener('pointercancel', tchUp, true);
// Settings, Marking, Tablet and pencil.
{
  const sel = $('#setTouchMode'), box = $('#setPress');
  sel.value = touchMode(); box.checked = pressOn();
  sel.onchange = () => { if (sel.value === 'auto') store.del('gs.touch'); else store.set('gs.touch', sel.value); };
  box.onchange = () => { if (box.checked) store.del('gs.press'); else store.set('gs.press', false); };
}
// With a finger or a pencil there is no pointing at the student strip to open it and no moving away to fold it: a tap on the paper folds it.
$('#paper').addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && !listKept()) listPeek(false, 60); });
Object.assign(window.__gs, { touch: () => ({ penSeen, penDown, mode: tch.mode, fingers: tch.f.size, moves: fingerMoves(), set: touchMode() }), touchReset: () => { store.del('gs.penSeen'); penSeen = false; penDown = 0; penUpAt = -1e9; tch.f.clear(); tch.mode = ''; } });
