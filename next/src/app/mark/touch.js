// Tablets (src/touch.js): a finger that moves the page, a pencil that draws, and a palm that does nothing. A page's canvas takes
// every pointer itself (touch-action: none), which is right for a mouse and a pencil but leaves a finger unable to scroll the paper.
// So a finger on a page is given one of two jobs:
//   - two fingers always move the page and pinch to zoom;
//   - one finger draws with the tool in hand, until a pencil has been used in this browser (gs.penSeen). From then on one finger
//     moves the page and the pencil does the marking. Settings > Marking > Tablet and pencil can fix it either way (gs.touch:
//     'auto', 'move' or 'draw').
// While the pencil is down, and for a moment after it lifts, a touch on the page is the side of her hand and does nothing. Nothing
// here runs for a mouse or a trackpad. installTouch(area, { zoom, setZoom, commit }) is called by the marking screen's paper; it returns
// the function that takes it all away again.
import { prefs } from '../../students/prefs.js';

export const touchMode = () => { const v = prefs.get('gs.touch', 'auto'); return v === 'move' || v === 'draw' ? v : 'auto'; };
let penSeen = prefs.get('gs.penSeen', false) === true, penDown = 0, penUpAt = -1e9;   // a pencil used here once is remembered
// For the checks: what the tablet code knows now, and starting again as a browser that never saw a pencil.
export const touchNow = () => ({ penSeen, penDown, set: touchMode() });
export function touchReset() { prefs.del('gs.penSeen'); penSeen = false; penDown = 0; penUpAt = -1e9; }

export function installTouch(P, { zoom, setZoom, commit }) {
  const tch = { f: new Map(), mode: '', z0: 1, d0: 0, glide: 0, v: [0, 0], last: 0, far: 0 };
  const fingerMoves = () => { const m = touchMode(); return m === 'move' || (m === 'auto' && penSeen); };
  const pts = () => [...tch.f.values()];
  const mid = () => { const p = pts(); return { x: p.reduce((a, q) => a + q.x, 0) / p.length, y: p.reduce((a, q) => a + q.y, 0) / p.length }; };
  const dist = () => { const p = pts(); return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
  const dropAll = () => { for (const c of P.querySelectorAll('canvas')) c.dispatchEvent(new Event('gsdrop')); };
  // Lets the page go on moving for a moment after a quick flick, as a finger expects.
  const glide = () => {
    cancelAnimationFrame(tch.glide);
    let [vx, vy] = tch.v, t0 = performance.now();
    if (Math.hypot(vx, vy) < 0.35) return;
    const step = t => { const dt = Math.min(40, t - t0); t0 = t; P.scrollLeft -= vx * dt; P.scrollTop -= vy * dt; const k = Math.pow(0.995, dt); vx *= k; vy *= k; if (Math.hypot(vx, vy) > 0.03) tch.glide = requestAnimationFrame(step); };
    tch.glide = requestAnimationFrame(step);
  };
  const down = e => {
    cancelAnimationFrame(tch.glide);
    if (e.pointerType === 'pen') {
      // Her hand often lands a moment before the pencil does. Whatever it began (a line, or moving the page) stops here.
      if (!penSeen) { penSeen = true; prefs.set('gs.penSeen', true); }
      penDown++;
      if (tch.f.size) { if (!tch.mode) dropAll(); tch.mode = 'lift'; }
      return;
    }
    if (e.pointerType !== 'touch') return;
    if (e.target.tagName !== 'CANVAS') return;   // anywhere else the browser scrolls and taps as usual
    // The side of her hand: while the pencil is down and just after, or a touch far wider than a fingertip.
    if (penDown > 0 || performance.now() - penUpAt < 500 || Math.max(e.width || 0, e.height || 0) > 60) { e.stopPropagation(); e.preventDefault(); return; }
    tch.f.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (tch.f.size === 2) {
      // A second finger: whatever the first one began to draw is taken back, and the two move and zoom the page.
      dropAll(); tch.mode = 'two'; tch.z0 = zoom(); tch.d0 = dist(); tch.v = [0, 0];
      e.stopPropagation(); e.preventDefault();
    } else if (tch.f.size > 2) { e.stopPropagation(); e.preventDefault(); }
    else if (fingerMoves()) { tch.mode = 'one'; tch.v = [0, 0]; tch.far = 0; tch.last = e.timeStamp; commit(); e.stopPropagation(); e.preventDefault(); }
    else tch.mode = '';   // this finger draws: the page's own handler takes it from here
  };
  const move = e => {
    const f = tch.f.get(e.pointerId); if (!f) return;
    if (!tch.mode) { f.x = e.clientX; f.y = e.clientY; return; }   // this finger is drawing: only where it is now is kept
    const was = mid(); f.x = e.clientX; f.y = e.clientY; const now = mid(), dx = now.x - was.x, dy = now.y - was.y;
    e.stopPropagation();
    if (tch.mode === 'lift') return;
    // One finger has to travel a little before the page follows, so a hand that only rests on the screen moves nothing.
    if (tch.mode === 'one' && tch.far < 8) { tch.far += Math.hypot(dx, dy); return; }
    if (tch.mode === 'one' || tch.f.size >= 2) { P.scrollLeft -= dx; P.scrollTop -= dy; }
    if (tch.mode === 'one') { const dt = Math.max(1, e.timeStamp - tch.last); tch.last = e.timeStamp; tch.v = [tch.v[0] * 0.6 + dx / dt * 0.4, tch.v[1] * 0.6 + dy / dt * 0.4]; }
    if (tch.mode === 'two' && tch.f.size === 2 && tch.d0 > 20) { const k = dist() / tch.d0; if (Math.abs(k - 1) > 0.04 || zoom() !== tch.z0) setZoom(tch.z0 * k); }
  };
  const up = e => {
    if (e.pointerType === 'pen') { penDown = Math.max(0, penDown - 1); penUpAt = performance.now(); return; }
    if (!tch.f.delete(e.pointerId)) return;
    if (tch.mode === 'one' && e.type === 'pointerup' && e.timeStamp - tch.last < 80) glide();
    if (tch.mode) e.stopPropagation();
    if (!tch.f.size) tch.mode = '';
    else if (tch.mode === 'two') tch.mode = 'lift';   // one of two fingers lifted: the other neither draws nor drags the page about
  };
  P.addEventListener('pointerdown', down, true);
  addEventListener('pointermove', move, true); addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
  return () => { cancelAnimationFrame(tch.glide); P.removeEventListener('pointerdown', down, true); removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true); };
}
