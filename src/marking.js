/* ---------------- marking: smoother ink, a highlighter that knows the page's lines, easier text boxes ---------------- */
// Pen and freehand highlight are stored as plain points and drawn by strokePath, so the screen, the export and a
// reopened export all draw exactly the same line. All the smoothing happens before the points are kept.
// A highlight is still { t: 'hl', color, x, y, w, h }, the box around it. Two optional extras, kept in step with that box:
//   rects: [{ x, y, w, h }, ...]  several typed lines, one mark (a comment's highlight can have these too, with m.hl as the box)
//   pts: [[x, y], ...], sw        a freehand stroke, sw points wide

// The curve through a stroke's points. Old pen marks have always been drawn this way.
function strokePath(ctx, p) {
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  if (p.length === 1) ctx.lineTo(p[0][0] + 0.01, p[0][1]);
  for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
  if (p.length > 1) ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
}
// Painted by drawHls. One fill or one stroke, so lines that overlap don't darken where they meet.
function fillHl(ctx, m) {
  if (m.pts) { ctx.save(); ctx.strokeStyle = m.color; ctx.lineWidth = m.sw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; strokePath(ctx, m.pts); ctx.stroke(); ctx.restore(); return; }
  ctx.fillStyle = m.color;
  if (!m.rects) { ctx.fillRect(m.x, m.y, m.w, m.h); return; }
  ctx.beginPath(); for (const r of m.rects) ctx.rect(r.x, r.y, r.w, r.h); ctx.fill();
}
// Highlighting over a highlight swaps its color, the way a real highlighter can't but she expects: the same color
// again stays the same, and a new color covers the old one instead of mixing with it. So all of a page's highlights
// are painted plainly onto one sheet, newest on top, and that sheet is multiplied onto the page once.
let hlSheet = null;
function drawHls(ctx, hls) {
  if (!hls.length) return;
  if (hls.length === 1) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; fillHl(ctx, hls[0]); ctx.restore(); return; }
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  if (!hlSheet) hlSheet = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(cw, ch) : document.createElement('canvas');
  if (hlSheet.width !== cw || hlSheet.height !== ch) { hlSheet.width = cw; hlSheet.height = ch; }
  const hc = hlSheet.getContext('2d');
  hc.setTransform(1, 0, 0, 1, 0, 0); hc.clearRect(0, 0, cw, ch);
  hc.setTransform(ctx.getTransform());
  for (const m of hls) fillHl(hc, m);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(hlSheet, 0, 0); ctx.restore();
}
const rectBox = rs => { const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y)); return { x, y, w: r1(Math.max(...rs.map(r => r.x + r.w)) - x), h: r1(Math.max(...rs.map(r => r.y + r.h)) - y) }; };
// moveMark and turnMarks handle the box; these are the extras.
function moveExtras(m, dx, dy) {
  if (m.rects) m.rects = m.rects.map(r => ({ ...r, x: r1(r.x + dx), y: r1(r.y + dy) }));
  if (m.pts) m.pts = m.pts.map(([x, y]) => [r1(x + dx), r1(y + dy)]);
}
const inRect = (r, x, y, slop) => x >= r.x - slop && x <= r.x + r.w + slop && y >= r.y - slop && y <= r.y + r.h + slop;
function strokeHit(p, x, y, reach) {
  for (let j = 0; j < p.length; j++) if (distToSeg(x, y, p[j], p[Math.min(j + 1, p.length - 1)]) <= reach) return true;
  return false;
}
// Hit test for the marks whose outline isn't their box. Returns null for the rest, which go by their box.
function hitShape(m, x, y, slop, W) {
  if (m.t === 'pen') return strokeHit(m.pts, x, y, m.w / 2 + slop);
  if (m.pts) return strokeHit(m.pts, x, y, m.sw / 2 + slop);
  if (m.rects) return m.rects.some(r => inRect(r, x, y, slop));
  if (m.t === 'text' && !(selected && selected.mark === m && !selected.fresh)) { const L = textLayout(m, W); return inRect({ x: m.x, y: m.y, w: Math.max(L.ink, 30), h: L.h }, x, y, slop); }   // the words, not the empty part of a wide box
  return null;
}

/* ---------------- ink: every point of a fast stroke, without the jaggies ---------------- */
// Two steps, tried against simulated mouse and trackpad input: this is about 70% smoother than before on slow writing, and small loops stay round.
// First a short string pulls the line along, so the pixel steps of a mouse and small shake never get through. It works the same at any speed.
// Then a One Euro filter: a slow hand gets heavy smoothing, a fast hand almost none, so the line keeps up. All in screen pixels and seconds.
const INK_STRING = 0.8, INK_SLOW_HZ = 6, INK_SPEED = 0.08, INK_DRIFT_HZ = 12;
function inkFilter() {
  let sx, sy, x0, y0, t0, vx = 0, vy = 0;
  const pull = (hz, dt) => { const r = 2 * Math.PI * hz * dt; return r / (r + 1); };
  return (x, y, t) => {
    if (x0 == null) { sx = x0 = x; sy = y0 = y; t0 = t; return [x, y]; }
    const d = Math.hypot(x - sx, y - sy);
    if (d > INK_STRING) { sx += (x - sx) * (d - INK_STRING) / d; sy += (y - sy) * (d - INK_STRING) / d; }
    const dt = clamp((t - t0) / 1000, 0.001, 0.05), av = pull(INK_DRIFT_HZ, dt);
    vx += av * ((sx - x0) / dt - vx); vy += av * ((sy - y0) / dt - vy);
    const a = pull(INK_SLOW_HZ + INK_SPEED * Math.hypot(vx, vy), dt);
    x0 += a * (sx - x0); y0 += a * (sy - y0); t0 = t;
    return [x0, y0];
  };
}
// Fewer points for the same line, so a page of handwriting doesn't fill the browser's storage. tol is how far the line may shift,
// and gap is the longest piece between points: the curve rounds a corner by about as much as the pieces beside it are long.
function thinStroke(p, tol, gap) {
  if (p.length < 3) return p;
  const out = [p[0]];
  let a = 0;
  for (let i = 1; i < p.length - 1; i++) {
    let ok = Math.hypot(p[i + 1][0] - p[a][0], p[i + 1][1] - p[a][1]) <= gap;
    for (let j = a + 1; ok && j <= i; j++) ok = distToSeg(p[j][0], p[j][1], p[a], p[i + 1]) <= tol;
    if (!ok) { out.push(p[i]); a = i; }
  }
  out.push(p[p.length - 1]);
  return out;
}
const inkBegin = (m, x, y, e, s) => { const f = inkFilter(); f(x * s, y * s, e.timeStamp); return { m, f, raw: null }; };
// One pointer move, which can stand for many points of a fast stroke. at turns an event into page points.
function inkMove(pg, g, e, at) {
  const p = g.m.pts, s = pg.s, n0 = p.length, was = g.raw, all = e.getCoalescedEvents ? e.getCoalescedEvents() : [], list = all.length ? all : [e];
  const step = Math.min(0.7, 1 / s);
  for (const q of list) {
    const [ax, ay] = at(q), x = clamp(ax, 0, pg.W), y = clamp(ay, 0, pg.H), [fx, fy] = g.f(x * s, y * s, q.timeStamp);
    g.raw = [r1(x), r1(y)];
    if (e.shiftKey) continue;
    const last = p[p.length - 1];
    if (Math.hypot(fx / s - last[0], fy / s - last[1]) > step) p.push([r1(fx / s), r1(fy / s)]);
  }
  if (e.shiftKey) {   // Shift: a straight line, level or upright when it's close
    const pt = g.raw, dx = Math.abs(pt[0] - p[0][0]), dy = Math.abs(pt[1] - p[0][1]);
    if (dy < dx * 0.15) pt[1] = p[0][1]; else if (dx < dy * 0.15) pt[0] = p[0][0];
    g.m.pts = [p[0], pt]; g.raw = null; g.straight = true;
    draw(pg, [g.m]);
    return;
  }
  if (g.straight) { g.straight = false; draw(pg, [g.m]); return; }   // Shift let go: the straight line just drawn goes away
  // Only the end of the stroke changes, so only that part of the page is drawn again.
  const pad = (g.m.t === 'pen' ? g.m.w : g.m.sw) / 2 + 2, near = p.slice(Math.max(0, n0 - 3)).concat(was ? [was] : [], g.raw ? [g.raw] : []);
  const xs = near.map(q => q[0]), ys = near.map(q => q[1]), x1 = Math.min(...xs) - pad, y1 = Math.min(...ys) - pad;
  // The line runs on to the pointer, so it never seems to lag behind the hand.
  if (g.raw) p.push(g.raw);
  draw(pg, [g.m], { x: x1, y: y1, w: Math.max(...xs) + pad - x1, h: Math.max(...ys) + pad - y1 });
  if (g.raw) p.pop();
}
function inkEnd(pg, g) {
  const p = g.m.pts;
  if (g.raw && !g.straight) { const l = p[p.length - 1]; if (l[0] !== g.raw[0] || l[1] !== g.raw[1]) p.push(g.raw); }   // ends where she let go
  g.m.pts = thinStroke(p, Math.min(0.12, 0.4 / pg.s), 6);
}

/* ---------------- the page's typed lines, for the highlighter ---------------- */
// Lines come from the PDF's own text, in the turned page's points. Sideways text can't be dragged along, so it doesn't count.
function loadLines(pg) {
  const rot = rotOf(pg.file, pg.idx);
  if (pg.tlRot === rot) return;
  pg.tlRot = rot; pg.tl = null;
  const vp = vpRot(pg.file, pg.idx, pg.page, 1);
  pg.page.getTextContent().then(tc => { if (pg.tlRot === rot) pg.tl = groupLines(textItems(tc, vp)); }, () => { if (pg.tlRot === rot) pg.tl = []; });
}
function textItems(tc, vp) {
  const out = [];
  for (const it of tc.items) {
    if (!it.str || !it.str.trim() || !(it.width > 0)) continue;
    const t = pdfjsLib.Util.transform(vp.transform, it.transform), fh = Math.hypot(t[2], t[3]);
    if (fh < 3 || t[0] <= 0 || Math.abs(t[1]) > t[0] * 0.2) continue;
    out.push({ str: it.str, x: t[4], y: t[5], w: it.width * vp.scale, fh, font: (tc.styles && tc.styles[it.fontName] && tc.styles[it.fontName].fontFamily) || 'sans-serif' });
  }
  return out;
}
// Where each word of a piece of text starts and ends. The PDF only gives the whole piece's width, so a like font shares it out.
const HL_WORD_RX = /[⺀-鿿豈-﫿＀-￯]|[^\s⺀-鿿豈-﫿＀-￯]+/g;
function itemWords(it) {
  measureCtx.font = '20px ' + it.font;
  const k = it.w / (measureCtx.measureText(it.str).width || 1), out = [];
  for (const w of it.str.matchAll(HL_WORD_RX)) out.push({ x0: it.x + measureCtx.measureText(it.str.slice(0, w.index)).width * k, x1: it.x + measureCtx.measureText(it.str.slice(0, w.index + w[0].length)).width * k, one: w[0].length === 1 && w[0].charCodeAt(0) >= 0x2E80 });
  return out;
}
// Pieces on one baseline make a row. A wide gap splits a row, so columns and table cells stay apart. Reading order: down the page, then across.
function groupLines(items) {
  const rows = [];
  for (const it of items.slice().sort((a, b) => a.y - b.y)) {
    const r = rows[rows.length - 1];
    if (r && Math.abs(it.y - r.y) < 0.4 * Math.min(it.fh, r.fh)) { r.its.push(it); r.fh = Math.max(r.fh, it.fh); } else rows.push({ y: it.y, fh: it.fh, its: [it] });
  }
  const segs = [];
  for (const r of rows) {
    const words = r.its.flatMap(itemWords).sort((a, b) => a.x0 - b.x0), joined = [];
    for (const w of words) {   // a word can be split into several pieces; side by side, they are one word
      const l = joined[joined.length - 1];
      if (l && !l.one && !w.one && w.x0 - l.x1 < 0.12 * r.fh) l.x1 = Math.max(l.x1, w.x1); else joined.push({ ...w });
    }
    let s = null;
    for (const w of joined) {
      if (!s || w.x0 - s.x1 > Math.max(2.5 * r.fh, 24)) { s = { x0: w.x0, x1: w.x1, top: r.y - 0.82 * r.fh, bot: r.y + 0.24 * r.fh, fh: r.fh, words: [] }; segs.push(s); }
      s.x1 = Math.max(s.x1, w.x1); s.words.push([w.x0, w.x1]);
    }
  }
  return segs;
}
const segFar = (s, x, y) => [y < s.top ? s.top - y : y > s.bot ? y - s.bot : 0, x < s.x0 ? s.x0 - x : x > s.x1 ? x - s.x1 : 0];
// The line under the pointer: close to it going down the page, and a loose fit across, since a line can end anywhere.
// While dragging (keep is set), how far past a line's end the pointer has gone only counts so much: level with a short line, it stays on that line.
function nearestSeg(segs, x, y, keep) {
  let best = -1, bd = 1e9;
  segs.forEach((s, i) => { const [dy, dx] = segFar(s, x, y), across = keep == null ? dx * 0.2 : Math.min(dx * 0.2, s.fh * 0.35), d = dy + across - (i === keep ? s.fh * 0.3 : 0); if (d < bd) { bd = d; best = i; } });   // a wobbly drag stays on its line
  return best;
}
// Where a highlight starts decides what it does: on or beside a typed line it snaps, anywhere else it's freehand.
function lineAt(pg, x, y) {
  if (hlMode === 'free' || !pg.tl || !pg.tl.length) return -1;
  const i = nearestSeg(pg.tl, x, y);
  if (i < 0) return -1;
  const [dy, dx] = segFar(pg.tl[i], x, y);
  return dy <= pg.tl[i].fh * 0.75 && dx <= 24 ? i : -1;
}
const wordAt = (s, x) => { let b = s.words[0], bd = 1e9; for (const w of s.words) { const d = x < w[0] ? w[0] - x : x > w[1] ? x - w[1] : 0; if (d < bd) { bd = d; b = w; } } return b; };
// The boxes from one spot to another, like selecting text: from the first word to the end of its line, whole lines between, then on to the last word.
function snapRects(segs, a, ax, b, bx) {
  if (b < a) { [a, ax, b, bx] = [b, bx, a, ax]; }
  const L = Math.min(segs[a].x0, segs[b].x0), R = Math.max(segs[a].x1, segs[b].x1), out = [];
  for (let i = a; i <= b; i++) {
    const s = segs[i];
    if (i !== a && i !== b && (s.x1 < L || s.x0 > R)) continue;   // another column
    let x0 = i === a ? wordAt(s, ax)[0] : s.x0, x1 = i === b ? wordAt(s, bx)[1] : s.x1;
    if (a === b) { const u = wordAt(s, Math.min(ax, bx)), v = wordAt(s, Math.max(ax, bx)); x0 = u[0]; x1 = v[1]; }
    out.push({ x: r1(x0 - 1), y: r1(s.top), w: r1(x1 - x0 + 2), h: r1(s.bot - s.top) });
  }
  return out;
}
function setRects(m, rects) {
  Object.assign(m, rectBox(rects));
  if (rects.length > 1) m.rects = rects; else delete m.rects;
  return m;
}

/* ---------------- the highlighter ---------------- */
const HL_WIDTHS = { 8: 'S', 14: 'M', 22: 'L' };
let hlMode = store.get('gs.hlMode', 'auto'), hlW = store.get('gs.hlW', 14);   // 'auto' snaps to typed lines where there are any; 'free' never does
function hlBegin(pg, x, y, e) {
  const color = HL[hlColor], a = lineAt(pg, x, y);
  if (a >= 0) return { snapHl: true, a, x0: x, y0: y, m: setRects({ t: 'hl', color }, snapRects(pg.tl, a, x, a, x)) };
  return { ...inkBegin({ t: 'hl', color, sw: hlW, pts: [[r1(x), r1(y)]], x, y, w: 0, h: 0 }, x, y, e, pg.s), x0: x, y0: y };
}
function hlMove(pg, g, e, at) {
  if (!g.snapHl) { inkMove(pg, g, e, at); return; }
  const [x, y] = at(e), b = nearestSeg(pg.tl, clamp(x, 0, pg.W), clamp(y, 0, pg.H), g.a);
  setRects(g.m, snapRects(pg.tl, g.a, g.x0, b, x));
  draw(pg, [g.m]);
}
function hlEnd(pg, g) {
  if (g.snapHl) return;
  const m = g.m;
  inkEnd(pg, g);
  if (m.pts.length < 2 || Math.max(...m.pts.map(q => Math.hypot(q[0] - g.x0, q[1] - g.y0))) < 3) {   // a click: one line-height strip, as it has always been
    delete m.pts; delete m.sw;
    Object.assign(m, { x: r1(g.x0 - 30), y: r1(g.y0 - 7), w: 60, h: 14 });
    return;
  }
  const xs = m.pts.map(q => q[0]), ys = m.pts.map(q => q[1]), x = r1(Math.min(...xs) - m.sw / 2), y = r1(Math.min(...ys) - m.sw / 2);
  Object.assign(m, { x, y, w: r1(Math.max(...xs) + m.sw / 2 - x), h: r1(Math.max(...ys) + m.sw / 2 - y) });
}
function setHlMode(mode, say) {
  hlMode = mode; store.set('gs.hlMode', mode); renderTools();
  if (say) toast(mode === 'free' ? 'Highlight: freehand' : 'Highlight: snaps to typed lines. Freehand where there are none.');
}
const hlBar = () => '<span class="seg" style="margin-left:4px"><button data-hlm="auto" aria-pressed="' + (hlMode !== 'free') + '" title="Snaps to typed lines. Goes freehand on scans and handwriting. Press H again to switch.">Snap</button><button data-hlm="free" aria-pressed="' + (hlMode === 'free') + '" title="Always draw it by hand. Hold Shift for a straight line. Press H again to switch.">Freehand</button></span>' +
  '<span class="seg" style="margin-left:4px"><button data-hlw title="How wide a freehand highlight is. Click to change.">' + (HL_WIDTHS[hlW] || 'M') + '</button></span>';
function hlBarClick(e) {
  const m = e.target.closest('[data-hlm]'); if (m) { setHlMode(m.dataset.hlm); return true; }
  if (e.target.closest('[data-hlw]')) { hlW = hlW === 14 ? 22 : hlW === 22 ? 8 : 14; store.set('gs.hlW', hlW); renderTools(); return true; }
  return false;
}
// A comment dragged over typed words highlights those words; anywhere else it's the drag box, as before.
function noteHlBegin(pg, g) {
  const a = lineAt(pg, g.x0, g.y0);
  if (a >= 0) { g.snapA = a; g.m = setRects({ t: 'hl', color: HL[hlColor] }, snapRects(pg.tl, a, g.x0, a, g.x0)); }
}
function noteHlMove(pg, g, x, y) {
  setRects(g.m, snapRects(pg.tl, g.snapA, g.x0, nearestSeg(pg.tl, x, y, g.snapA), x));
}
// The line to the margin leaves from just under the words, so it doesn't read as crossing them out.
function noteFromSnap(g, color) {
  const rects = g.m.rects || [{ x: g.m.x, y: g.m.y, w: g.m.w, h: g.m.h }], last = rects[rects.length - 1];
  const m = { t: 'note', color, ax: r1(last.x + last.w), ay: r1(last.y + last.h), hl: rectBox(rects), hc: g.m.color, text: '' };
  if (rects.length > 1) m.rects = rects;
  return m;
}

/* ---------------- text boxes: handles, and less re-selecting ---------------- */
// A new box is a sensible width, or whatever's left of the page near the right edge.
const newTextW = (pg, x) => r1(Math.min(Math.max(200, pg.W * 0.4), pg.W - x - 6));
const textGrips = (m, W) => { const bb = bboxOf(m, W); return { l: bb.x - 3, r: bb.x + bb.w + 3, top: bb.y, bottom: bb.y + bb.h }; };
function drawGrips(ctx, m, W, s) {   // the same size on screen at any zoom
  const h = textGrips(m, W), gw = 7 / s, gh = 22 / s, y = (h.top + h.bottom) / 2 - gh / 2;
  ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1F6FB2'; ctx.lineWidth = 1.5 / s;
  for (const x of [h.l, h.r]) { ctx.beginPath(); ctx.roundRect(x - gw / 2, y, gw, gh, gw / 2); ctx.fill(); ctx.stroke(); }
}
// Which grip of the picked text box is at this spot: 'l', 'r' or nothing.
function gripAt(pg, x, y) {
  if (!selected || selected.page !== pg || selected.mark.t !== 'text') return '';
  const h = textGrips(selected.mark, pg.W), near = 8 / pg.s;
  if (y < h.top - near || y > h.bottom + near) return '';
  return Math.abs(x - h.r) < near ? 'r' : Math.abs(x - h.l) < near ? 'l' : '';
}
function gripBegin(pg, side) {
  const m = selected.mark, bb = bboxOf(m, pg.W);
  return { resize: m, moved: false, side, right: bb.x + bb.w };
}
function gripMove(pg, g, x) {
  const m = g.resize;
  delete m.bwFull;   // she's set the width herself
  if (g.side === 'l') { m.x = r1(clamp(x + 3, 0, g.right - 24)); m.bw = r1(g.right - m.x); }   // the grips sit 3 points outside the box
  else m.bw = r1(clamp(x - 3 - m.x, 24, pg.W - m.x - 6));
}
function pickToGrab(pg, hit, x, y, edit) {
  selected = { page: pg, mark: hit };
  redrawAll();
  return { move: hit, x, y, moved: false, edit };
}
const editMark = (pg, m) => { if (m.t === 'text') editText(pg, m); else if (m.t === 'note') openNote(pg, m); };
// What the pointer can do here, shown by its shape. Empty: leave it as the tool set it.
function hoverCursor(pg, x, y) {
  const grip = gripAt(pg, x, y);
  if (tool === 'select') return grip ? 'ew-resize' : hitMark(pg, x, y, 4) ? (x > pg.W ? 'pointer' : 'move') : 'default';
  if (tool === 'text') { const h = hitMark(pg, x, y, 3); return grip ? 'ew-resize' : h && h.t === 'text' ? 'move' : h && x > pg.W ? 'pointer' : 'text'; }
  if (tool === 'note') { const h = hitMark(pg, x, y, 3); return h && h.t === 'note' ? (x > pg.W ? 'pointer' : 'move') : 'crosshair'; }
  if (tool === 'hl') return lineAt(pg, x, y) >= 0 ? 'text' : 'crosshair';
  return '';
}
// The Move grip on the bar above a box being typed in. fit lays the box out again.
function gripDrag(e, bar, pg, m, fit, ta) {
  const r = pg.canvas.getBoundingClientRect(), s = pg.s, ox = (e.clientX - r.left) / s - m.x, oy = (e.clientY - r.top) / s - m.y;
  bar.setPointerCapture(e.pointerId);
  const mv = ev => { m.x = r1((ev.clientX - r.left) / s - ox); m.y = r1((ev.clientY - r.top) / s - oy); keepOnPage(m, pg.W, pg.H); fit(); };
  const up = () => { bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); ta.focus(); };
  bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
}
Object.assign(window.__gs, { inkFilter, thinStroke, groupLines, snapRects, strokePath, hlMode: () => hlMode, setHlMode, draw, bboxOf, hitMark, drawMarks, sharePage });
