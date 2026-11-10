/* ---------------- drawing (shared by the screen and the export) ---------------- */
const FONT = 'Helvetica, Arial, "PingFang TC", "Microsoft JhengHei", sans-serif';
const measureCtx = document.createElement('canvas').getContext('2d');
const sideFor = W => Math.round(Math.max(200, W * 0.4));
function wrapText(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    if (!para.trim()) { lines.push(''); continue; }
    let line = '';
    for (const tok of para.match(/\S+\s*|\s+/g) || []) {
      const t = line + tok;
      if (ctx.measureText(t.trimEnd()).width <= maxW) { line = t; continue; }
      if (line) { lines.push(line.trimEnd()); line = ''; }
      if (ctx.measureText(tok.trimEnd()).width <= maxW) { line = tok; continue; }
      for (const ch of tok) { if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ''; } line += ch; }
    }
    if (line.trim()) lines.push(line.trimEnd());
  }
  return lines;
}
const rgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
function textLayout(m, W) {
  measureCtx.font = m.size + 'px ' + FONT;
  const room = Math.max(40, W - m.x - 6), maxW = m.bw ? Math.max(24, Math.min(m.bw, room)) : room;
  const lines = wrapText(measureCtx, m.text || '', maxW);
  const w = m.bw ? maxW : Math.max(10, ...lines.map(l => measureCtx.measureText(l).width));
  return { lines, w, h: Math.max(1, lines.length) * m.size * 1.25, maxW, ink: Math.max(10, ...lines.map(l => measureCtx.measureText(l).width)) };
}
// Comment boxes in the right margin, each with a line to its spot (the look Taylor liked from Kami's flattened files).
function layoutNotes(notes, W, H, side) {
  const M = 10, pad = 7, gap = 8, boxX = W + 12, boxW = side - 22;
  const list = notes.map(n => ({ n, ax: n.ax, ay: n.ay })).sort((p, q) => p.ay - q.ay || p.ax - q.ax);
  let fs = 10, boxes = [];
  const run = () => {
    const lh = fs * 1.3;
    measureCtx.font = fs + 'px ' + FONT;
    boxes = list.map(o => { const lines = wrapText(measureCtx, o.n.text, boxW - pad * 2); return { ...o, lines, lh, h: Math.max(1, lines.length) * lh + pad * 2 }; });
    let y = M;
    for (const b of boxes) { b.y = Math.max(b.ay - 10, y); y = b.y + b.h + gap; }
    let bottom = H - M;
    for (let i = boxes.length - 1; i >= 0; i--) { if (boxes[i].y + boxes[i].h > bottom) boxes[i].y = bottom - boxes[i].h; bottom = boxes[i].y - gap; }
    return !boxes.length || boxes[0].y >= M - 0.5;
  };
  while (!run() && fs > 6) fs -= 0.5;
  for (const b of boxes) { b.x = boxX; b.w = boxW; b.y = Math.max(b.y, M / 2); b.fs = fs; b.pad = pad; }
  return boxes;
}
function drawCheck(ctx, m) {
  const s = m.size || 22;
  ctx.save(); ctx.strokeStyle = CHECK_INK; ctx.lineWidth = s * 0.13; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(m.x - s * 0.4, m.y); ctx.lineTo(m.x - s * 0.1, m.y + s * 0.3); ctx.lineTo(m.x + s * 0.45, m.y - s * 0.35); ctx.stroke();
  ctx.restore();
}
const noteInk = n => { const [r, g, b] = rgb(n.color), dk = v => Math.round(v * 0.72); return 'rgb(' + dk(r) + ',' + dk(g) + ',' + dk(b) + ')'; };
// A comment's highlight is a lighter tint of the highlight color, so it reads as different from a plain highlight.
const noteTint = hex => { const c = rgb(hex).map(v => Math.round(v + (255 - v) * 0.45)); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); };
function numberBadge(ctx, cx, cy, n, col) {
  if (!n) return;
  const t = String(n), r = t.length > 1 ? 6 : 5.2;
  ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '700 ' + (t.length > 1 ? 6.5 : 7.5) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(t, cx, cy + 0.3); ctx.restore();
}
function noteMarkings(ctx, n, num) {
  const rects = n.rects || [n.hl], col = noteInk(n);
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.lineCap = 'butt';
  for (const r of rects) { ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h + 0.4); ctx.lineTo(r.x + r.w, r.y + r.h + 0.4); ctx.stroke(); }
  ctx.restore();
  const last = rects[rects.length - 1];
  numberBadge(ctx, last.x + last.w + 1, last.y - 1, num, col);
}
// ctx is in PDF points (page at 0,0, margin to the right of W). Returns the comment boxes for hit testing.
function drawMarks(ctx, marks, W, H, side, screen) {
  const notes = marks.filter(m => m.t === 'note');
  if (side) {
    ctx.fillStyle = '#F6F7F9'; ctx.fillRect(W, 0, side, H);
    ctx.strokeStyle = '#E1E4EA'; ctx.lineWidth = 0.75; ctx.beginPath(); ctx.moveTo(W + 0.4, 0); ctx.lineTo(W + 0.4, H); ctx.stroke();
    if (screen && !notes.length) {
      ctx.fillStyle = '#A3A9B6'; ctx.font = '9px ' + FONT; ctx.textAlign = 'center';
      ctx.fillText('Comments appear here', W + side / 2, 22); ctx.textAlign = 'left';
    }
  }
  // highlights under everything, multiplied so the writing stays dark. Where they overlap, the newest one wins (hlLayer).
  drawHls(ctx, marks.filter(m => m.t === 'hl' || (m.t === 'note' && m.hl)).map(m => m.t === 'hl' ? m : { color: noteTint(m.hc || HL.yellow), ...m.hl, rects: m.rects }));
  for (const m of marks) {
    if (m.t === 'pen') {
      ctx.save(); ctx.strokeStyle = m.color; ctx.lineWidth = m.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      strokePath(ctx, m.pts);
      ctx.stroke(); ctx.restore();
    } else if (m.t === 'text' && !(screen && screen.editing === m)) {
      const L = textLayout(m, W);
      ctx.fillStyle = m.color; ctx.font = m.size + 'px ' + FONT; ctx.textBaseline = 'top';
      L.lines.forEach((ln, i) => ctx.fillText(ln, m.x, m.y + i * m.size * 1.25 + m.size * 0.1));
      ctx.textBaseline = 'alphabetic';
    } else if (m.t === 'check') drawCheck(ctx, m);
    else if (m.t === 'stamp') drawStamp(ctx, m);
    else if (m.t === 'oval') {
      ctx.save(); ctx.strokeStyle = m.color; ctx.lineWidth = m.sw || 1.6;
      ctx.beginPath(); ctx.ellipse(m.x + m.w / 2, m.y + m.h / 2, Math.max(1, m.w / 2), Math.max(1, m.h / 2), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }
  // A comment's words: a lighter tint, a line under them in the comment's color, and its number, the same as on its card.
  const order = side ? notes.filter(n => n.hl).sort((p, q) => p.ay - q.ay || p.ax - q.ax) : [];
  for (const n of notes) if (n.hl) noteMarkings(ctx, n, side ? order.indexOf(n) + 1 : 0);
  let boxes = [];
  if (side && notes.length) {
    boxes = layoutNotes(notes, W, H, side);
    for (const b of boxes) {
      const [r, g, bl] = rgb(b.n.color), dk = v => Math.round(v * 0.72), col = 'rgb(' + dk(r) + ',' + dk(g) + ',' + dk(bl) + ')';
      const midY = b.y + Math.min(b.h / 2, 12);
      ctx.strokeStyle = col; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(b.ax, b.ay); ctx.lineTo(W + 4, b.ay); ctx.lineTo(b.x, midY); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(b.ax, b.ay, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + bl + ',0.14)'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = col; ctx.lineWidth = 0.9; ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = col; ctx.fillRect(b.x, b.y, 2.5, b.h);
      ctx.fillStyle = '#1B1F27'; ctx.font = b.fs + 'px ' + FONT;
      b.lines.forEach((ln, i) => ctx.fillText(ln, b.x + b.pad, b.y + b.pad + b.fs * 0.95 + i * b.lh));
      if (b.n.hl) numberBadge(ctx, b.x + 1.25, b.y, order.indexOf(b.n) + 1, col);
    }
  }
  if (screen && screen.sel) {
    const bb = bboxOf(screen.sel, W);
    if (bb) {
      ctx.save(); ctx.strokeStyle = '#1F6FB2'; ctx.setLineDash([3, 2]); ctx.lineWidth = 0.8; ctx.strokeRect(bb.x - 3, bb.y - 3, bb.w + 6, bb.h + 6);
      if (screen.sel.t === 'text') drawGrips(ctx, screen.sel, W, screen.s || 1);   // drag these edges to set where the text wraps
      if (canResize(screen.sel)) drawCorner(ctx, screen.sel, W, screen.s || 1);   // and this corner to make it bigger or smaller
      ctx.restore();
    }
  }
  return boxes;
}
function bboxOf(m, W) {
  if (m.t === 'pen') {
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    for (const [x, y] of m.pts) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
    return { x: x1 - m.w / 2, y: y1 - m.w / 2, w: x2 - x1 + m.w, h: y2 - y1 + m.w };
  }
  if (m.t === 'hl' || m.t === 'oval') return { x: m.x, y: m.y, w: m.w, h: m.h };
  if (m.t === 'text') { const L = textLayout(m, W); return { x: m.x, y: m.y, w: L.w, h: L.h }; }
  if (m.t === 'check') { const s = m.size || 22; return { x: m.x - s * 0.45, y: m.y - s * 0.4, w: s * 0.95, h: s * 0.75 }; }
  if (m.t === 'stamp') return stampBox(m);
  if (m.t === 'note') return m.hl ? { ...m.hl } : { x: m.ax - 5, y: m.ay - 5, w: 10, h: 10 };
  return null;
}
// A text box never runs off the page: it stays inside on the right, keeping its width if it has one, and moves up from the bottom edge.
// One line of words only needs room for the words: near the edge the empty part of its box gives way, and m.bwFull remembers the width to go back to.
function keepOnPage(m, W, H) {
  if (m.bw) {
    const want = m.bwFull || m.bw, one = textLayout({ ...m, x: 0, bw: want }, 1e6), need = one.lines.length === 1 ? Math.min(m.bw, Math.ceil(one.ink) + 1) : m.bw;
    m.x = r1(clamp(m.x, 0, Math.max(0, W - need - 6)));
    m.bw = r1(Math.min(want, W - m.x - 6));
    if (m.bw < want) m.bwFull = want; else delete m.bwFull;
  } else { delete m.bwFull; m.x = r1(clamp(m.x, 0, W - 30)); }
  m.y = r1(clamp(m.y, 0, Math.max(0, H - textLayout(m, W).h - 2)));
}
function distToSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  let t = L ? ((px - a[0]) * dx + (py - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}
function hitMark(pg, x, y, slop) {
  const marks = pg.marks();
  for (const b of pg.boxes || []) if (!b.n.ro && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.n;
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i];
    const shape = hitShape(m, x, y, slop, pg.W);
    if (shape) return m;
    if (shape === null) {
      const bb = bboxOf(m, pg.W);
      if (bb && x >= bb.x - slop && x <= bb.x + bb.w + slop && y >= bb.y - slop && y <= bb.y + bb.h + slop) return m;
    }
  }
  return null;
}

