// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import STICKER_SRC from './stickers.js';
import { batch, cur, setup, lib, selected, zoom, pages, CHECK_INK, pdfjsLib, PDFLib, HL } from './gcore.js';

// src/app/draw.js
const FONT = 'Helvetica, Arial, "PingFang TC", "Microsoft JhengHei", sans-serif';
// src/app/draw.js
const measureCtx = document.createElement('canvas').getContext('2d');
// src/app/draw.js
const sideFor = W => Math.round(Math.max(200, W * 0.4));
// src/app/draw.js
const sideScreen = W => Math.round(Math.max(150, W * 0.25));
// src/app/draw.js
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
// src/app/draw.js
const rgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
// src/app/draw.js
function textLayout(m, W) {
  measureCtx.font = m.size + 'px ' + FONT;
  const room = Math.max(40, W - m.x - 6), maxW = m.bw ? Math.max(24, Math.min(m.bw, room)) : room;
  const lines = wrapText(measureCtx, m.text || '', maxW);
  const w = m.bw ? maxW : Math.max(10, ...lines.map(l => measureCtx.measureText(l).width));
  return { lines, w, h: Math.max(1, lines.length) * m.size * 1.25, maxW, ink: Math.max(10, ...lines.map(l => measureCtx.measureText(l).width)) };
}
// src/app/draw.js
function layoutNotes(notes, W, H, side) {
  const M = 10, pad = 7, gap = 8, boxX = W + 12, boxW = side - 22;
  // ry is the height the line runs across the page at: its spot, unless she dragged the line up or down off the words (n.ly).
  const list = notes.map(n => ({ n, ax: n.ax, ay: n.ay, ry: noteRunY(n, H) })).sort((p, q) => p.ry - q.ry || p.ax - q.ax);
  let fs = 10, boxes = [];
  const run = () => {
    const lh = fs * 1.3;
    measureCtx.font = fs + 'px ' + FONT;
    boxes = list.map(o => { const lines = wrapText(measureCtx, o.n.text, boxW - pad * 2 - (o.n.qza ? 4 : 0)); return { ...o, lines, lh, h: Math.max(1, lines.length) * lh + pad * 2 }; });
    let y = M;
    for (const b of boxes) { b.y = Math.max(b.ry - 10, y); y = b.y + b.h + gap; }
    let bottom = H - M;
    for (let i = boxes.length - 1; i >= 0; i--) { if (boxes[i].y + boxes[i].h > bottom) boxes[i].y = bottom - boxes[i].h; bottom = boxes[i].y - gap; }
    return !boxes.length || boxes[0].y >= M - 0.5;
  };
  while (!run() && fs > 6) fs -= 0.5;
  for (const b of boxes) { b.x = boxX; b.w = boxW; b.y = Math.max(b.y, M / 2); b.fs = fs; b.pad = pad; }
  return boxes;
}
// src/app/draw.js
const noteRunY = (n, H) => n.ly == null ? n.ay : Math.max(0, Math.min(H, n.ly));
// src/app/draw.js
function noteLeader(ctx, b, W) {
  const midY = b.y + Math.min(b.h / 2, 12);
  ctx.beginPath(); ctx.moveTo(b.ax, b.ay);
  if (Math.abs(b.ry - b.ay) > 0.5) ctx.lineTo(Math.min(b.ax + 6, W), b.ry);
  ctx.lineTo(W + 4, b.ry); ctx.lineTo(b.x, midY); ctx.stroke();
}
// src/app/draw.js
function drawCheck(ctx, m) {
  const s = m.size || 22;
  ctx.save(); ctx.strokeStyle = CHECK_INK; ctx.lineWidth = s * 0.13; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(m.x - s * 0.4, m.y); ctx.lineTo(m.x - s * 0.1, m.y + s * 0.3); ctx.lineTo(m.x + s * 0.45, m.y - s * 0.35); ctx.stroke();
  ctx.restore();
}
// src/app/draw.js
const noteInk = n => { const [r, g, b] = rgb(n.color), dk = v => Math.round(v * 0.72); return 'rgb(' + dk(r) + ',' + dk(g) + ',' + dk(b) + ')'; };
// src/app/draw.js
const noteTint = hex => { const c = rgb(hex).map(v => Math.round(v + (255 - v) * 0.45)); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); };
// src/app/draw.js
function numberBadge(ctx, cx, cy, n, col) {
  if (!n) return;
  const t = String(n), r = t.length > 1 ? 6 : 5.2;
  ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '700 ' + (t.length > 1 ? 6.5 : 7.5) + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(t, cx, cy + 0.3); ctx.restore();
}
// src/app/draw.js
const ansLab = n => !n.qza ? '' : n.qzl || (() => { const Q = typeof batch !== 'undefined' && batch && batch.quiz, q = Q && (Q.qs || []).find(x => x.id === n.qza); return q ? qzAnsLab(q) : ''; })();
// src/app/draw.js
function qzPill(ctx, cx, cy, t, col) {
  ctx.save(); ctx.font = '700 7px ' + FONT;
  const w = Math.max(11, ctx.measureText(t).width + 6), h = 10, x = cx - w / 2, y = cy - h / 2, r = h / 2;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x - 1.2, y - 1.2, w + 2.4, h + 2.4, r + 1.2); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, cx, cy + 0.3);
  ctx.restore();
  return w;
}
// src/app/draw.js
function noteMarkings(ctx, n, num) {
  const rects = n.rects || [n.hl], col = noteInk(n);
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.lineCap = 'butt';
  for (const r of rects) { ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h + 0.4); ctx.lineTo(r.x + r.w, r.y + r.h + 0.4); ctx.stroke(); }
  ctx.restore();
  const last = rects[rects.length - 1];
  numberBadge(ctx, last.x + last.w + 1, last.y - 1, num, col);
}
// src/app/draw.js
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
      if (hasPress(m.pts)) strokeWide(ctx, m.pts, m.w);
      else { strokePath(ctx, m.pts); ctx.stroke(); }
      ctx.restore();
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
      const qa = ansLab(b.n), hot = qa && screen && screen.hot === b.n;
      if (hot && b.n.qzr) {   // the pointer is on this answer: its question's box shows, outlined in gold
        const [x, y, w, h] = b.n.qzr;
        ctx.save(); ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + bl + ',0.10)'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.setLineDash([4, 2]); ctx.strokeRect(x, y, w, h); ctx.restore();
      }
      ctx.strokeStyle = col; ctx.lineWidth = screen && screen.line === b.n ? 1.4 : hot ? 1.8 : qa ? 1.1 : 0.7;
      noteLeader(ctx, b, W);
      if (!qa) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(b.ax, b.ay, 2.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + bl + ',0.14)'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = col; ctx.lineWidth = 0.9; ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = col; ctx.fillRect(b.x, b.y, 2.5, b.h);
      ctx.fillStyle = '#1B1F27'; ctx.font = b.fs + 'px ' + FONT;
      b.lines.forEach((ln, i) => {
        const x = b.x + b.pad, y = b.y + b.pad + b.fs * 0.95 + i * b.lh, k = i ? -1 : ln.indexOf(':');
        if (!b.n.qza || k < 1) return ctx.fillText(ln, x, y);
        // a quiz answer note: its label (Answer:) in bold gold, the answer after it in the usual dark text
        ctx.fillStyle = col; ctx.font = '700 ' + b.fs + 'px ' + FONT; ctx.fillText(ln.slice(0, k + 1), x, y);
        const w = ctx.measureText(ln.slice(0, k + 1)).width;
        ctx.fillStyle = '#1B1F27'; ctx.font = b.fs + 'px ' + FONT; ctx.fillText(ln.slice(k + 1), x + w, y);
      });
      if (b.n.hl) numberBadge(ctx, b.x + 1.25, b.y, order.indexOf(b.n) + 1, col);
      if (hot) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.strokeRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2); ctx.restore(); }
    }
    // the pills last, over every line, so none is hidden where lines cross
    for (const b of boxes) {
      const lab = ansLab(b.n); if (!lab) continue;
      const col = noteInk(b.n);
      qzPill(ctx, b.ax, b.ay, lab, col);
      ctx.save(); ctx.font = '700 7px ' + FONT; const w = Math.max(11, ctx.measureText(lab).width + 6); ctx.restore();
      qzPill(ctx, b.x + b.w - w / 2 - 3, b.y, lab, col);
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
// src/app/draw.js
function bboxOf(m, W) {
  if (m.t === 'pen') {
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    for (const [x, y] of m.pts) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
    const w = m.w * (hasPress(m.pts) ? PRESS_MAX : 1);
    return { x: x1 - w / 2, y: y1 - w / 2, w: x2 - x1 + w, h: y2 - y1 + w };
  }
  if (m.t === 'hl' || m.t === 'oval') return { x: m.x, y: m.y, w: m.w, h: m.h };
  if (m.t === 'text') { const L = textLayout(m, W); return { x: m.x, y: m.y, w: L.w, h: L.h }; }
  if (m.t === 'check') { const s = m.size || 22; return { x: m.x - s * 0.45, y: m.y - s * 0.4, w: s * 0.95, h: s * 0.75 }; }
  if (m.t === 'stamp') return stampBox(m);
  if (m.t === 'note') return m.hl ? { ...m.hl } : { x: m.ax - 5, y: m.ay - 5, w: 10, h: 10 };
  return null;
}
// src/app/files.js
const rotOf = (f, p) => (f && f.rot && f.rot[p]) || 0;
// src/app/files.js
const vpRot = (f, p, page, scale) => page.getViewport({ scale, rotation: ((page.rotate || 0) + rotOf(f, p)) % 360 });
// src/app/files.js
const skewOf = (f, p) => (f && f.skew && f.skew[p]) || 0;
// src/app/files.js
const skewXf = (f, p, vp) => { const a = skewOf(f, p) * Math.PI / 180; if (!a) return undefined; const c = Math.cos(a), s = Math.sin(a), x = vp.width / 2, y = vp.height / 2; return [c, s, -s, c, x - c * x + s * y, y - s * x - c * y]; };
// src/app/files.js
const vpDraw = (f, p, page, scale) => { const viewport = vpRot(f, p, page, scale); return { viewport, transform: skewXf(f, p, viewport) }; };
// src/app/files.js
const viewable = f => f.kind === 'pdf' || f.kind === 'img';
// src/app/files.js
const fileByPath = (st, path) => st.files.find(f => f.path === path);
// src/app/files.js
function defaultLayout(st) {
  const L = st.files.filter(f => viewable(f) && !f.virtual && f.numPages).map(f => ({ name: f.name, file: f.path, pages: [...Array(f.numPages).keys()].map(p => [f.path, p]) }));
  const v = st.files.find(f => f.virtual && viewable(f));
  if (v && v.numPages) { const pg = [...Array(v.numPages).keys()].map(p => [v.path, p]); if (!L.length) L.push({ name: v.name, file: v.path, pages: pg }); else L[0].pages = setup.rubricPos === 'start' ? pg.concat(L[0].pages) : L[0].pages.concat(pg); }
  return L;
}
// src/app/files.js
const layoutOf = st => st.layout || defaultLayout(st);
// src/app/files.js
function pageMarked(st, path, p) { const f = fileByPath(st, path); return !!f && (((f.marks[p] || []).length > 0) || !!(f.kami && f.kami[p]) || !!(f.scan && f.scan.found && f.scan.found.some(g => g.page === p)) || !!(f.hand && f.hand.page === p)); }
// src/app/files.js
const docMarked = (st, d) => d.pages.some(([path, p]) => pageMarked(st, path, p) || lostPages(fileByPath(st, path)).length > 0);
// src/app/files.js
function batchHasMarks() { return !!batch && batch.students.some(st => st.files.some(f => fileMarked(f))); }
// src/app/files.js
function docIn(st, d) {
  if (d.out != null) return !d.out;
  if (d.file && st.inc && st.inc[d.file] != null) return st.inc[d.file];
  if (docAdded(st, d)) return true;   // a file you added goes back unless you leave it out
  const read = d.pages.every(([path]) => { const f = fileByPath(st, path); return f && f.kami !== undefined; });
  if (!read) return true;
  return docMarked(st, d) || tnOut(st) || !batchHasMarks();
}
// src/app/files.js
const docAuto = (st, d) => d.out == null && !(d.file && st.inc && st.inc[d.file] != null);
// src/app/files.js
function fileSeq(st) {
  const L = layoutOf(st), rl = setup.rubricPos === 'end', of = k => st.files.filter(f => f.kind === k);
  const def = [...of('other'), ...of('text'), ...of('docx').filter(f => !(f.rubric && rl))].map(f => ({ id: 'f:' + f.path, f }))
    .concat(L.map((d, di) => ({ id: 'd' + di, d, di })))
    .concat(of('docx').filter(f => f.rubric && rl).map(f => ({ id: 'f:' + f.path, f })));
  const o = st.forder; if (!o) return def;
  const rank = (it, k) => { const i = o.indexOf(it.id); return i >= 0 ? i : o.length + k; };
  return def.map((it, k) => [rank(it, k), k, it]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
}
// src/app/files.js
const seqSig = (st, it) => it.f ? it.f.kind + (it.f.rubric ? 'R' : '') + (it.f.added ? 'A' : '') : 'doc' + (it.d.pages.length && (fileByPath(st, it.d.pages[0][0]) || {}).added ? 'A' : '') + ((fileByPath(st, (it.d.pages[0] || [])[0]) || {}).virtual ? 'R' : '');
// src/app/arrange.js
function draw(pg, live, part) {
  if (!pg.bmp) return;
  const c = pg.canvas, ctx = c.getContext('2d'), k = c.width / (pg.W + pg.side);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (part) { const x = Math.floor(part.x * k), y = Math.floor(part.y * k); ctx.save(); ctx.beginPath(); ctx.rect(x, y, Math.ceil((part.x + part.w) * k) - x, Math.ceil((part.y + part.h) * k) - y); ctx.clip(); }
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  const src = lightBmp(pg);
  ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, pg.W * k, pg.H * k);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const anon = anonOn() && batch.students[cur];
  if (anon && pg.covers) { ctx.fillStyle = '#111'; for (const r of pg.covers) ctx.fillRect(r.x, r.y, r.w, r.h); }
  const marks = marksMine(pg.marks(), pg.file, batch.students[cur]).concat(anon ? scrubMarks(pg.extra || [], anonRx(anon)) : pg.extra || [], live || [], pg.pending ? [pg.pending] : []);
  pg.boxes = drawMarks(ctx, marks, pg.W, pg.H, pg.side, { sel: selected && selected.page === pg && selected.mark !== pg.editing ? selected.mark : null, editing: pg.editing, s: pg.s, line: pg.lineOn || null, hot: pg.noteOn || null });
  if (pg.ghost) { const b = pg.ghost; ctx.save(); ctx.strokeStyle = '#1F6FB2'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.restore(); }
  if (part) ctx.restore();
}
// src/app/panels.js
const fileMarked = f => viewable(f) && (Object.values(f.marks).some(a => a.length) || (f.kami && Object.keys(f.kami).length > 0) || !!(f.scan && f.scan.found && f.scan.found.length) || !!f.hand);
// src/app/export.js
function madeFromWord(f) {
  if (!f || !f.added || !batch || !batch.removed || !/\.pdf$/i.test(f.name)) return false;
  return Object.keys(batch.removed).some(k => { const r = batch.removed[k]; if (r.by !== f.path || r.back || !WORD_RX.test(k)) return false; const base = k.slice(k.lastIndexOf('/') + 1).replace(WORD_RX, ''); return f.name === base + '.pdf' || (f.name.startsWith(base + ' (added ') && /^ \(added \d+\)\.pdf$/.test(f.name.slice(base.length))); });
}
// src/app/export.js
const docAdded = (st, d) => d.pages.some(([path]) => { const f = fileByPath(st, path); return !!f && !!f.added && !madeFromWord(f); });
// src/app/claude.js
const rxEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// src/app/claude.js
const scrub = (text, rx) => rx ? String(text || '').replace(rx, '[name]') : String(text || '');
// src/app/claude.js
const scrubMarks = (marks, rx) => marks.map(m => m.text != null ? { ...m, text: scrub(m.text, rx) } : m);
// src/app/library.js
const classById = id => lib.classes.find(c => c.id === id);
// src/app/screens.js
const LETTER_PLAIN = { ø: 'o', đ: 'd', ð: 'd', ł: 'l', ħ: 'h', ı: 'i', ŧ: 't', æ: 'ae', œ: 'oe', ß: 'ss', þ: 'th' };
// src/app/screens.js
const nameFold = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[øđðłħıŧæœßþ]/g, c => LETTER_PLAIN[c]);
// src/app/screens.js
const nameWords = s => (nameFold(s).match(/[a-z0-9]+|[^\x00-\x7f\s,.()_-]+/g) || []);
// src/app/screens.js
function rosterMatch(names) {
  const used = new Set(), map = new Map(), left = () => [...new Set(names)].filter(n => !map.has(n));
  const studs = batch.students.map(st => ({ st, w: new Set(nameWords(st.key)) }));
  const give = (n, x) => { used.add(x.st); map.set(n, x.st); };
  // a spelling she linked, or the student's ID in the folder name, is a sure match, even over an empty roster spot of the same name
  const c = classOfNames(names);
  if (c && c.info) for (const x of studs) { if (used.has(x.st) || (x.st.gap && !x.st.files.length)) continue; const h = infoHits(c, x.st.key).filter(n => !map.has(n)); if (h.length === 1) give(h[0], x); }
  for (const n of left()) { const x = studs.find(x => !used.has(x.st) && x.st.key === n); if (x) give(n, x); }
  for (const n of left()) {
    const w = new Set(nameWords(n)), hits = studs.filter(x => !used.has(x.st) && x.w.size === w.size && [...w].every(t => x.w.has(t)));
    if (w.size && hits.length === 1) give(n, hits[0]);
  }
  // Canvas names a student's files by their name with the words run together, family name first ("doejane"): one word that is the roster name's words joined.
  for (const n of left()) {
    const w = nameWords(n); if (w.length < 2 || w.length > 5) continue;
    const forms = new Set([w.join(''), w.slice(1).concat(w[0]).join(''), [w[w.length - 1]].concat(w.slice(0, -1)).join('')]);
    const hits = studs.filter(x => !used.has(x.st) && x.w.size === 1 && forms.has([...x.w][0]));
    if (hits.length === 1) give(n, hits[0]);
  }
  const fits = (w, x) => w.every(t => x.w.has(t)) || (x.w.size >= 2 && [...x.w].every(t => w.includes(t)));
  const rest = left().map(n => ({ n, w: nameWords(n) })).filter(r => r.w.length);
  for (const { n, w } of rest) {
    const hits = studs.filter(x => !used.has(x.st) && fits(w, x));
    if (hits.length === 1 && rest.filter(r => fits(r.w, hits[0])).length === 1) give(n, hits[0]);
  }
  return map;
}
// src/app/screens.js
function batchClass() { const id = batch && (batch.classId != null ? batch.classId : batch.assignment && batch.assignment.classId); return id ? classById(id) : null; }
// src/app/anon.js
const anonOn = () => !!(batch && batch.anon && batch.anon.on);
// src/app/anon.js
function anonOrder() {
  const A = batch.anon || (batch.anon = { on: false, order: [] }), keys = batch.students.map(st => st.key), have = new Set(keys);
  A.order = A.order.filter(k => have.has(k));
  for (const k of keys) if (!A.order.includes(k)) A.order.splice(Math.floor(Math.random() * (A.order.length + 1)), 0, k);
  const at = new Map(keys.map((k, i) => [k, i]));
  return A.order.map(k => at.get(k));
}
// src/app/anon.js
const anonPos = i => anonOrder().indexOf(i);
// src/app/anon.js
const shownName = (st, i) => anonOn() ? 'Paper ' + (anonPos(i) + 1) : st.key;
// src/app/anon.js
const anonRx = st => coverRx(st);
// src/app/lighting.js
const LIGHT0 = { b: 0, c: 0, d: 0, s: 0, g: 0 };
// src/app/lighting.js
const lightKey = st => (batch.light && st && batch.light[st.key]) ? st.key : '*';
// src/app/lighting.js
const lightFor = st => (batch && batch.light && ((st && batch.light[st.key]) || batch.light['*'])) || LIGHT0;
// src/app/lighting.js
const lightOn = L => !!(L && (L.b || L.c || L.d || L.s || L.g));
// src/app/lighting.js
function lightLut(L) {
  const t = new Uint8ClampedArray(256), k = 1 + L.c / 100, g = 1 + L.d / 40;
  for (let v = 0; v < 256; v++) { let x = 1 - (1 - v / 255) * k + L.b / 200; x = Math.min(1, Math.max(0, x)); t[v] = Math.round(Math.pow(x, g) * 255); }
  return t;
}
// src/app/lighting.js
const lightOpts = () => ({ on: true, rub: false, exp: true, ...((batch && batch.lightOpt) || {}) });
// src/app/lighting.js
const isRubricPage = f => !!(f.rubric || f.virtual);
// src/app/lighting.js
const lightPgKey = (st, f, p) => st.key + '|' + f.path + '|' + p;
// src/app/lighting.js
const pageLitDefault = f => lightOpts().rub || !isRubricPage(f);
// src/app/lighting.js
function pageLit(st, f, p, map) {
  const v = (map || (batch && batch.lightPg) || {})[lightPgKey(st, f, p)];
  return v != null ? v : pageLitDefault(f);
}
// src/app/lighting.js
function setPageLit(st, f, p, on, map) {
  if (!map) map = batch.lightPg || (batch.lightPg = {});
  const k = lightPgKey(st, f, p);
  if (on === pageLitDefault(f)) delete map[k]; else map[k] = on;
}
// src/app/lighting.js
const pageOwnL = (st, f, p) => (batch && batch.lightPgL && batch.lightPgL[lightPgKey(st, f, p)]) || null;
// src/app/lighting.js
function setPageOwnL(st, f, p, L) {
  const m = batch.lightPgL || (batch.lightPgL = {}), k = lightPgKey(st, f, p);
  if (L) m[k] = { ...LIGHT0, ...L }; else delete m[k];
}
// src/app/lighting.js
const hasOwnL = st => !!(st && batch && batch.lightPgL && Object.keys(batch.lightPgL).some(k => k.startsWith(st.key + '|')));
// src/app/lighting.js
const lightLive = st => { const o = lightOpts(); return !!st && o.on && (lightOn(lightFor(st)) || hasOwnL(st)); };
// src/app/lighting.js
function lightForPage(st, f, p) {
  if (!lightLive(st) || f.kind === 'docx' || !pageLit(st, f, p)) return null;
  const L = pageOwnL(st, f, p) || lightFor(st);
  return lightOn(L) ? L : null;
}
// src/app/lighting.js
function lightCanvas(ctx, w, h, L) {
  const im = ctx.getImageData(0, 0, w, h), d = im.data, t = lightLut(L);
  // Change each pixel's lightness and keep its color, so a slightly yellow scan doesn't turn bright yellow.
  for (let i = 0; i < d.length; i += 4) { const y = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8, sh = t[y] - y; if (L.g) d[i] = d[i + 1] = d[i + 2] = t[y]; else { d[i] += sh; d[i + 1] += sh; d[i + 2] += sh; } }   // black and white: the color goes, for a tinted page or colored paper
  if (L.s) lightSharpen(d, w, h, L.s);
  ctx.putImageData(im, 0, 0);
}
// src/app/lighting.js
function lightSharpen(d, w, h, s) {
  const n = w * h, Y = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n), r = w > 1800 ? 2 : 1, k = s / 100 * 1.6, span = 2 * r + 1;
  for (let i = 0, j = 0; i < n; i++, j += 4) Y[i] = d[j] * .299 + d[j + 1] * .587 + d[j + 2] * .114;
  for (let y = 0; y < h; y++) {   // average across, then down
    const o = y * w;
    for (let x = 0; x < w; x++) { let a = 0; for (let q = -r; q <= r; q++) a += Y[o + Math.min(w - 1, Math.max(0, x + q))]; A[o + x] = a / span; }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let q = -r; q <= r; q++) a += A[Math.min(h - 1, Math.max(0, y + q)) * w + x]; B[y * w + x] = a / span; }
  for (let i = 0, j = 0; i < n; i++, j += 4) { const sh = (Y[i] - B[i]) * k; d[j] += sh; d[j + 1] += sh; d[j + 2] += sh; }
}
// src/app/lighting.js
function lightBmp(pg) {
  const L = lightForPage(batch && batch.students[cur], pg.file, pg.idx);
  if (!L) return pg.bmp;
  const key = L.b + '|' + L.c + '|' + L.d + '|' + (L.s || 0) + '|' + (L.g || 0);
  if (pg.adj && pg.adjSrc === pg.bmp && pg.adjKey === key) return pg.adj;
  const c = pg.adj && pg.adj.width === pg.bmp.width && pg.adj.height === pg.bmp.height ? pg.adj : document.createElement('canvas');
  c.width = pg.bmp.width; c.height = pg.bmp.height;
  const x = c.getContext('2d'); x.drawImage(pg.bmp, 0, 0);
  lightCanvas(x, c.width, c.height, L);
  pg.adj = c; pg.adjSrc = pg.bmp; pg.adjKey = key;
  return c;
}
// src/app/lighting.js
function lightAuto(pg) {
  const b = pg.bmp, s = Math.min(1, 400 / b.width), c = document.createElement('canvas'); c.width = Math.round(b.width * s); c.height = Math.round(b.height * s);
  const x = c.getContext('2d'); x.drawImage(b, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data, h = new Uint32Array(256); let n = 0;
  for (let i = 0; i < d.length; i += 4) { h[Math.round(d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11)]++; n++; }
  const pct = p => { let a = 0; for (let v = 0; v < 256; v++) { a += h[v]; if (a >= n * p) return v / 255; } return 1; };
  const lo = pct(.002), hi = pct(.5);   // the darkest writing, and the paper
  if (hi - lo < .03) return { b: 0, c: 0, d: 30 };
  const k = Math.max(1, Math.min(5, .9 / (hi - lo))), bb = (1 - hi) * k * 200;
  return { b: Math.round(Math.max(-60, Math.min(60, bb))), c: Math.round((k - 1) * 100), d: 20 };
}
// src/app/word.js
const WORD_RX = /\.(docx|docm|dotx|dotm)$/i;
// src/app/bringin.js
const SORT_STOP = new Set(['pdf', 'docx', 'docm', 'doc', 'rubric', 'final', 'draft', 'copy', 'marked', 'graded', 'feedback', 'interview', 'summative', 'formative', 'assignment', 'the', 'and', 'of', 'for', 'version', 'v', 'el', 'grade', 'resume', 'cover', 'letter', 'essay', 'paragraph', 'analysis', 'notes', 'comments', 'scan', 'img', 'image', 'page']);
// src/names.js
const NAME_PLAIN = new Set(('al am an art as at august autumn ban bay be best bill bin black brown by can case chase chin dawn day de dean do don dung da ed faith far frank gay go grace gray green grey ha hang he hope ho hung if in is it ivy jade joy june king la lane le little long love major man mark may me min my new no nice on or page pan park pat pearl pen penny price rich rose ruby sandy sang short sing small so son song star stone su sue summer sun sung tan tang ten tin to tu up us van violet von we white will win wing won wood wu ye young april').split(' '));
// src/names.js
const NAME_MOSTLY = new Set('al april august autumn chin dawn dean don dung ed faith frank grace hung ivy jade joy june min pat pearl penny rose ruby sandy sang sue summer sung tang violet wu'.split(' '));
// src/names.js
const isPlainWord = w => NAME_PLAIN.has(w) || SORT_STOP.has(w);   // and words a file's name brings along, when a loose file is taken for a student
// src/names.js
const PLAIN_OTHER = ('على عليه عليها عليهم عليك عليكم علينا عليكما إلى الى إليه اليه إليها اليها إليهم اليهم أن ان إن أنا انا أنت انت أنه انه إنه أنها انها إنها أو او هو هي هم هذا هذه ذلك تلك لي له لها لك لنا لهم بي به بها في فى فيه فيها من مني منه منها منك ما لا لم لن قد كل مع عن عنه عند ثم هل كان كانت أية اية ' +
  'این را از با در که تو ' +   // Persian
  'של על אל את לא גם כל עם מי זה זו הוא היא אני עלי אלי הם ' +   // Hebrew
  'вера надежда любовь роза слава мир лев он она они мы вы ты да нет на по за из от до но не ни то так как это ли ' +   // Cyrillic
  'και το τα να θα με σε δε για από νίκη ελπίδα ειρήνη ' +   // Greek
  '美丽 快乐 幸福 学习 老师 学生 朋友 明天 今天 昨天 世界 中国 文化 大家 大海 海洋 天气 春天 夏天 秋天 冬天 平安 希望 未来 太阳 阳光 月亮 大地 太陽 学校 先生 友達 今日 明日 ' +   // Chinese and Japanese
  '하나 나라 사랑 우리 하늘 바다 구름 가을 여름 겨울 마음 나무 노래 사람 오늘 내일 학교 친구 수정 이름 선생 ' +   // Korean
  'ใหม่ น้ำ ฟ้า นก ดี ใจ').normalize('NFKC').split(' ');   // Thai
// src/names.js
const CJK_NAME = /[\p{Script=Han}\p{Script=Hangul}]/u, NO_SPACES = /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
// src/names.js
const AT_START = '(?<![\\p{L}\\p{M}\\p{N}])', AT_END = '(?![\\p{L}\\p{N}])', NOT_PART = "(?!['’](?:t|re|ve|ll|d|m)(?!\\p{L})|-\\p{L})", MID_SENTENCE = '(?<=[\\p{L}\\p{N},;:)"”\'’\\]-][ \\t]+)', ALONE = ['(?<=(?:^|[\\r\\n])[ \\t]*)', '(?=[ \\t]*(?:$|[\\r\\n]))'], LABEL = '(?<=(?:[Nn][Aa][Mm][Ee]|[Ss][Tt][Uu][Dd][Ee][Nn][Tt]|[Aa][Uu][Tt][Hh][Oo][Rr]|[Bb][Yy]|[Ff][Rr][Oo][Mm])[ \\t]*:[ \\t]*)', NAME_SEP = "[\\s,.'’_-]*", FILE_SEP = '[._-]?';
// src/names.js
const ID_RX = '[\\p{L}\\p{N}._%+-]+@[\\p{L}\\p{N}-]+(?:\\.[\\p{L}\\p{N}-]+)+|' + AT_START + '(?:[Ss]tudent\\s+(?:[Ii][Dd]|[Nn]o\\.?|[Nn]umber|#)|ID)[\\s:#.]*\\d{3,}|(?<![\\p{L}\\p{N}.,])\\p{L}{0,2}\\d{6,}(?![\\p{L}\\p{N}]|[.,]\\d)';
// src/names.js
let nameLetters = null;
// src/names.js
function letterTable() {
  if (nameLetters) return nameLetters;
  const T = nameLetters = {}, add = (k, c) => { (T[k] ||= { lo: '', up: '' })[c === c.toLowerCase() ? 'lo' : 'up'] += c; };
  for (const [a, b] of [[0x41, 0x5a], [0x61, 0x7a], [0xc0, 0x24f], [0x1e00, 0x1eff]]) for (let i = a; i <= b; i++) { const c = String.fromCodePoint(i), k = nameFold(c); if (/^[a-z]{1,2}$/.test(k)) add(k, c); }
  for (const [k, cs] of [['ae', 'äÄ'], ['oe', 'öÖøØ'], ['ue', 'üÜ'], ['aa', 'åÅ']]) for (const c of cs) add(k, c);
  return T;
}
// src/names.js
function latinRx(word, title) {
  const T = letterTable(), set = (e, first) => '[' + (title ? (first || title === 'caps' ? e.up : e.lo) : e.lo + e.up) + ']\\p{M}*';
  let out = '';
  for (let i = 0; i < word.length;) {
    const c = word[i], one = T[c] ? set(T[c], i === 0) : c, pair = T[word.slice(i, i + 2)];
    if (pair && word.length > i + 1 && T[word[i + 1]]) { out += '(?:' + one + set(T[word[i + 1]], false) + '|' + set(pair, i === 0) + ')'; i += 2; }
    else { out += one; i++; }
  }
  return out;
}
// src/names.js
const SAME_LETTERS = new Map('اأإآ يیى هھہة كک 厂⺁ 乙⺄ 刀⺈ 卜⺊ 小⺌⺍ 兀⺎ 尢⺐ 巳⺒ 幺⺓ 心⺗ 旡⺛ 日⺜ 月⺝ 母⺟ 民⺠ 牛⺧ 王⺩ 疋⺪ 目⺫ 示⺬ 竹⺮ 网⺳⺴ 羊⺶ 聿⺻ 肉⺼ 臼⺽ 虎⻁ 西⻄ 见⻅ 角⻆ 贝⻉ 车⻋ 長⻑ 镸⻒ 长⻓ 门⻔ 雨⻗ 青⻘ 韦⻙ 页⻚ 风⻛ 飞⻜ 食⻝ 飠⻟ 马⻢ 骨⻣ 鬼⻤ 鱼⻥ 鸟⻦ 卤⻧ 麦⻨ 黄⻩ 黾⻪ 斉⻫ 齐⻬ 歯⻭ 齿⻮ 竜⻯ 龙⻰ 龜⻱ 亀⻲ 龟⻳ 戶户戸 黑黒'.split(' ').flatMap(g => [...g].map(c => [c, g])));
// src/names.js
const ONE_LETTER = new Map('ำ ຳ ໜ ໝ և'.split(' ').map(c => [c.normalize('NFKC'), c]));
// src/names.js
const ONE_LETTER_RX = new RegExp([...ONE_LETTER.keys(), '.'].join('|'), 'gsu');
// src/names.js
const eitherWay = (s, each) => (s.match(ONE_LETTER_RX) || []).map(p => ONE_LETTER.has(p) ? '(?:' + each(p) + '|' + ONE_LETTER.get(p) + ')' : each(p)).join('');
// src/names.js
function spelledRx(raw, marked) {
  const lit = s => eitherWay(s, p => [...p].map(c => { const v = new Set([c, c.toLowerCase(), c.toUpperCase(), ...(SAME_LETTERS.get(c) || '')].filter(x => [...x].length === 1)); return v.size > 1 ? '[' + [...v].join('') + ']' : rxEsc(c); }).join(''));
  const nfd = raw.normalize('NFD');
  return '(?:' + [...new Set([raw.normalize('NFC'), nfd, marked ? nfd : nfd.replace(/[̀-ͯ]/g, '')])].map(lit).concat(THAI.test(raw) ? thaiRx(raw) : []).join('|') + ')';
}
// src/names.js
const THAI = /\p{Script=Thai}/u;
// src/names.js
const thaiRx = raw => (raw.normalize('NFC').match(/\P{M}\p{M}*/gu) || []).map(c => { const n = [...c].length; return n > 2 ? rxEsc([...c][0]) + '\\p{M}+[\\s\\x00]?' : n === 2 ? rxEsc(c) + '[\\s\\x00]?' : rxEsc(c); }).join('');
// src/names.js
const isLatin = raw => /^[a-z0-9]+$/.test(nameFold(raw));
// src/names.js
const shortBare = raw => { const w = nameFold(raw); return isLatin(raw) && w.length <= 3 && w !== raw.toLowerCase(); };
// src/names.js
const plainForms = raw => { const rx = new RegExp('^' + spelledRx(raw), 'u'); return PLAIN_OTHER.filter(w => rx.test(w)); };
// src/names.js
const notPlain = raw => { const f = plainForms(raw); return f.length ? '(?!(?:' + f.map(w => eitherWay(w, rxEsc)).join('|') + ')' + (NO_SPACES.test(raw) ? '' : AT_END) + ')' : ''; };
// src/names.js
const isEveryday = raw => isLatin(raw) ? isPlainWord(nameFold(raw)) || shortBare(raw) : plainForms(raw).length > 0;
// src/names.js
const anyRx = raw => isLatin(raw) ? latinRx(nameFold(raw)) : spelledRx(raw);
// src/names.js
const rawWords = name => String(name).normalize('NFKC').match(/[\p{L}\p{M}\p{N}]+/gu) || [];
// src/names.js
const wordOk = raw => { const w = nameFold(raw); return /^\d+$/.test(w) ? w.length >= 4 : [...raw].length >= 2 && !/^(the|and|of)$/.test(w); };
// src/names.js
function spellings(raw) {
  const c = [...raw.normalize('NFC')], out = [raw];
  if (c.every(x => CJK_NAME.test(x))) { if (c.length === 3 || c.length === 4) out.push(c.slice(-2).join('')); if (c.length === 4) out.push(c.slice(0, 2).join('')); }
  return out;
}
// src/names.js
const respelled = raw => /[äöüøåÄÖÜØÅ]/.test(raw) ? raw.replace(/[äÄ]/g, 'ae').replace(/[öÖøØ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/[åÅ]/g, 'aa') : null;
// src/names.js
const bounded = (raw, src) => (NO_SPACES.test(raw) ? src : AT_START + src + (isLatin(raw) ? AT_END : ''));
// src/names.js
const alt = (len, src) => ({ len, src });
// src/names.js
function wordAlts(raw, whose) {
  const out = [], own = whose === 'own';
  for (const r of [raw, respelled(raw)].filter(Boolean)) for (const s of spellings(r)) {
    if (!wordOk(s)) continue;
    const w = nameFold(s);
    if (!isLatin(s)) {
      // Not on the student's own paper, it can't be an everyday word, and two letters have to be a word of their own: ли and литература stay for a classmate named Ли.
      const no = own ? '' : notPlain(s), end = !own && [...s].length <= 2 && !NO_SPACES.test(s) ? AT_END : '';
      out.push(alt(w.length, bounded(s, no + anyRx(s)) + end));
      if (no) out.push(alt(w.length, LABEL + AT_START + anyRx(s)));
      continue;
    }
    const plain = isPlainWord(w), bare = !own && shortBare(s);
    if (!plain && !bare) out.push(alt(w.length, bounded(s, anyRx(s))));
    else {
      const mostly = NAME_MOSTLY.has(w) || !plain, caps = AT_START + latinRx(w, 'caps') + AT_END, label = alt(w.length, LABEL + AT_START + latinRx(w) + AT_END);
      const marked = w !== s.toLowerCase() ? [alt(w.length, AT_START + spelledRx(s, true) + AT_END)] : [];   // Mỹ can't be anything but the name, but my can
      if (whose === 'sure' && !mostly) { out.push(label, ...marked); continue; }
      out.push(alt(w.length, (own || mostly ? '' : MID_SENTENCE) + AT_START + latinRx(w, true) + AT_END + NOT_PART));
      // In capitals, RUBY is the name anywhere, and WILL only on a line of its own, since a heading can say IN MY VIEW. After Name: it's the name however it's written.
      out.push(alt(w.length, mostly ? caps : ALONE[0] + caps + ALONE[1]), label, ...marked);
    }
  }
  return out;
}
// src/names.js
function runAlts(parts) {
  const out = [], use = p => wordOk(p) && !isEveryday(p);
  if (parts.length < 2) return out;
  const sep = parts.every(use) ? '' : NAME_SEP, orders = [parts, [...parts].reverse()];
  // Everyday words or single letters, all of them (Tô Mỹ, or the Tô and Mỹ of Tô Thị Mỹ): only written like a name, or "to my" would be one.
  const everyday = p => isLatin(p) ? nameFold(p).length < 2 || isPlainWord(nameFold(p)) : isEveryday(p), named = p => isLatin(p) ? '(?:' + latinRx(nameFold(p), true) + '|' + latinRx(nameFold(p), 'caps') + ')' : notPlain(p) + anyRx(p);
  if (parts.length > 2) orders.push([parts[0], parts[parts.length - 1]], [parts[parts.length - 1], parts[0]]);
  for (const o of orders) out.push(alt(o.join('').length + 1, bounded(o[0] + o[o.length - 1], o.map(o.every(everyday) ? named : anyRx).join(sep))));
  return out;
}
// src/names.js
const latinParts = parts => parts.filter(p => isLatin(p) && !/^\d+$/.test(nameFold(p)));
// src/names.js
function initialAlts(parts) {
  const out = [], L = latinParts(parts);
  for (const a of L) for (const b of L) { const fb = nameFold(b); if (a !== b && fb.length >= 3 && !NAME_PLAIN.has(nameFold(a)[0] + fb)) out.push(alt(fb.length + 1, AT_START + latinRx(nameFold(a)[0]) + FILE_SEP + latinRx(fb) + AT_END)); }
  return out;
}
// src/names.js
const altsRx = (lists, more) => {
  const src = lists.flat().sort((a, b) => b.len - a.len).map(a => a.src).filter((s, i, all) => all.indexOf(s) === i).concat(more || []);
  return src.length ? src.join('|') : '';
};
// src/names.js
let nameMemo = { sig: null };
// src/names.js
function namesNow() {
  const c = batchClass(), sig = batch.students.map(s => s.key).join('\n') + '\n\n' + (c ? c.names.join('\n') + '\n\n' + infoSig(c) : '');
  if (nameMemo.sig === sig) return nameMemo;
  const roster = new Map();
  if (c) for (const [n, s] of rosterMatch(c.names)) roster.set(s.key, [...(roster.get(s.key) || []), n]);
  const all = [...new Set(batch.students.map(s => s.key).concat(c ? c.names : []))];
  const classAlts = all.map(n => { const parts = rawWords(n); return [...parts.flatMap(p => wordAlts(p, 'class')), ...runAlts(parts)]; });
  return nameMemo = { sig, roster, all, classSrc: altsRx(classAlts), own: new Map(), file: new Map(), cls: null, sure: new Map(), found: new Map() };
}
// src/names.js
const ownNames = st => [st.key, ...(namesNow().roster.get(st.key) || [])].map(rawWords);
// src/names.js
function coverRx(st) {
  const N = namesNow(); let rx = N.own.get(st.key);
  if (!rx) N.own.set(st.key, rx = new RegExp([ID_RX, altsRx(ownNames(st).map(p => [...p.flatMap(w => wordAlts(w, 'own')), ...runAlts(p), ...initialAlts(p)])), N.classSrc].filter(Boolean).join('|'), 'gu'));
  return rx;
}
// src/marking.js
function strokePath(ctx, p) {
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  if (p.length === 1) ctx.lineTo(p[0][0] + 0.01, p[0][1]);
  for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
  if (p.length > 1) ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
}
// src/marking.js
const hasPress = p => p.some(q => q.length > 2);
// src/marking.js
const pressW = (w, q) => w * (0.35 + 1.3 * (q[2] == null ? 0.5 : q[2]));
// src/marking.js
const PRESS_MAX = 1.65;
// src/marking.js
function strokeWide(ctx, p, w) {
  if (p.length === 1) { ctx.lineWidth = pressW(w, p[0]); ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[0][0] + 0.01, p[0][1]); ctx.stroke(); return; }
  let sx = p[0][0], sy = p[0][1];
  for (let i = 1; i < p.length; i++) {
    const last = i === p.length - 1, ex = last ? p[i][0] : (p[i][0] + p[i + 1][0]) / 2, ey = last ? p[i][1] : (p[i][1] + p[i + 1][1]) / 2;
    ctx.lineWidth = (pressW(w, p[i - 1]) + pressW(w, p[i])) / 2;
    ctx.beginPath(); ctx.moveTo(sx, sy);
    if (last) ctx.lineTo(ex, ey); else ctx.quadraticCurveTo(p[i][0], p[i][1], ex, ey);
    ctx.stroke(); sx = ex; sy = ey;
  }
}
// src/marking.js
function fillHl(ctx, m) {
  if (m.pts) { ctx.save(); ctx.strokeStyle = m.color; ctx.lineWidth = m.sw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; strokePath(ctx, m.pts); ctx.stroke(); ctx.restore(); return; }
  ctx.fillStyle = m.color;
  if (!m.rects) { ctx.fillRect(m.x, m.y, m.w, m.h); return; }
  ctx.beginPath(); for (const r of m.rects) ctx.rect(r.x, r.y, r.w, r.h); ctx.fill();
}
// src/marking.js
let hlSheet = null;
// src/marking.js
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
// src/marking.js
function loadLines(pg) {
  const rot = rotOf(pg.file, pg.idx);
  if (pg.tlRot === rot) return;
  pg.tlRot = rot; pg.tl = null;
  const vp = vpRot(pg.file, pg.idx, pg.page, 1);
  pg.page.getTextContent().then(tc => { if (pg.tlRot === rot) pg.tl = groupLines(textItems(tc, vp)); }, () => { if (pg.tlRot === rot) pg.tl = []; });
}
// src/marking.js
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
// src/marking.js
const HL_WORD_RX = /[⺀-鿿豈-﫿＀-￯]|[^\s⺀-鿿豈-﫿＀-￯]+/g;
// src/marking.js
function itemWords(it) {
  measureCtx.font = '20px ' + it.font;
  const k = it.w / (measureCtx.measureText(it.str).width || 1), out = [];
  for (const w of it.str.matchAll(HL_WORD_RX)) out.push({ x0: it.x + measureCtx.measureText(it.str.slice(0, w.index)).width * k, x1: it.x + measureCtx.measureText(it.str.slice(0, w.index + w[0].length)).width * k, one: w[0].length === 1 && w[0].charCodeAt(0) >= 0x2E80 });
  return out;
}
// src/marking.js
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
// src/marking.js
const textGrips = (m, W) => { const bb = bboxOf(m, W); return { l: bb.x - 3, r: bb.x + bb.w + 3, top: bb.y, bottom: bb.y + bb.h }; };
// src/marking.js
function drawGrips(ctx, m, W, s) {   // the same size on screen at any zoom
  const h = textGrips(m, W), gw = 7 / s, gh = 22 / s, y = (h.top + h.bottom) / 2 - gh / 2;
  ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1F6FB2'; ctx.lineWidth = 1.5 / s;
  for (const x of [h.l, h.r]) { ctx.beginPath(); ctx.roundRect(x - gw / 2, y, gw, gh, gw / 2); ctx.fill(); ctx.stroke(); }
}
// src/marking.js
const RESIZABLE = new Set(['stamp', 'check', 'text', 'oval']);
// src/marking.js
const canResize = m => !!m && RESIZABLE.has(m.t) && !m.ro;
// src/marking.js
function cornerPt(m, W) { const bb = bboxOf(m, W), o = m.t === 'text' ? 4 : 3; return [bb.x + bb.w + o, bb.y + bb.h + o]; }
// src/marking.js
function drawCorner(ctx, m, W, s) {   // the same size on screen at any zoom
  const [x, y] = cornerPt(m, W), h = 9 / s;
  ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1F6FB2'; ctx.lineWidth = 1.5 / s;
  ctx.beginPath(); ctx.roundRect(x - h / 2, y - h / 2, h, h, 2 / s); ctx.fill(); ctx.stroke();
}
// src/stamps.js
const PUNCT_SIGN = { comma: [',', 1], apos: ['\u2019', -1], quote: ['\u201C \u201D', -1], semi: [';', 1], colon: [':', 1], qmark: ['?', 1], excl: ['!', 1], hyphen: ['=', 1], dash: ['\u2014', 1] };   // [sign, 1 caret / -1 upside down]
// src/stamps.js
const PROOF_TAG = { gr: 'gr', sp: 'sp', ro: 'RO', frag: 'frag', wc: 'WC', awk: 'awk', vt: 'VT', unclear: '?' };   // the ones written in a circle
// src/stamps.js
const STICKERS = [
  ['star', 'Star', 0.895], ['check', 'Check', 0.86], ['thumbsup', 'Thumbs up', 0.985], ['lightbulb', 'Great idea', 1.02],
  ['evidence', 'Add evidence', 0.97], ['sideeye', 'Look here', 0.535], ['question', 'Unclear', 1.282], ['rocket', 'Big improvement', 0.975],
  ['trophy', 'Top work', 1.036], ['connect', 'Connect your ideas', 1.005], ['pencil', 'Revise this', 0.99], ['fire', 'This is fire', 1.156],
  ['cat', 'Crying thumbs up', 1.005], ['skull', 'Dead (funny)', 1.064], ['frog', 'Cool', 0.98],
];
// src/stamps.js
const stickerImg = {};
// src/stamps.js
const stickersReady = Promise.all(STICKERS.map(([k]) => new Promise(done => {
  if (!STICKER_SRC[k]) { done(); return; }
  const im = new Image(); im.onload = im.onerror = () => done(); im.src = STICKER_SRC[k]; stickerImg[k] = im;
})));
// src/stamps.js
const isSticker = k => STICKERS.some(s => s[0] === k);
// src/stamps.js
const isScoreStamp = k => k === 'score' || k === 'crit';
// src/stamps.js
const stampScore = t => String(t || '').split(' + ')[0];
// src/stamps.js
const scoreLines = m => { const t = String(m.text || ''), i = t.indexOf(' + '), L = stampScore(t).split(' = ').map(x => x.replace('/', ' / ')); if (i >= 0) L.push(t.slice(i + 1)); return L; };   // with no percent line the extra credit is the second line
// src/stamps.js
function scoreSize(m) {
  if (m.k === 'crit') return critSize(m);
  const s = m.size || 52, [a, b, c] = scoreLines(m);
  measureCtx.font = '700 ' + (s * 0.34) + 'px ' + FONT; const wa = measureCtx.measureText(a || '').width;
  measureCtx.font = '600 ' + (s * 0.26) + 'px ' + FONT; const wb = b ? measureCtx.measureText(b).width : 0;
  measureCtx.font = '600 ' + (s * 0.19) + 'px ' + FONT; const wc = c ? measureCtx.measureText(c).width : 0;
  return { w: Math.max(s * 1.5, Math.max(wa, wb, wc) + s * 0.4), h: c ? s * 1.28 : b ? s : s * 0.6, two: b != null, xc: c };
}
// src/stamps.js
function critName(m, s) {
  let t = String(m.name || '').trim(); if (!t) return '';
  measureCtx.font = '600 ' + (s * 0.24) + 'px ' + FONT;
  const room = s * 3.4;
  if (measureCtx.measureText(t).width <= room) return t;
  while (t.length > 1 && measureCtx.measureText(t + '…').width > room) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}
// src/stamps.js
function critSize(m) {
  const s = m.size || 40, nm = critName(m, s);
  measureCtx.font = '700 ' + (s * 0.4) + 'px ' + FONT; const wa = measureCtx.measureText(String(m.text || '').replace('/', ' / ')).width;
  measureCtx.font = '600 ' + (s * 0.24) + 'px ' + FONT; const wb = nm ? measureCtx.measureText(nm).width : 0;
  return { w: Math.max(s * 1.1, Math.max(wa, wb) + s * 0.36), h: nm ? s : s * 0.62, two: !!nm, nm };
}
// src/stamps.js
const stickerAspect = k => (STICKERS.find(s => s[0] === k) || [0, 0, 1])[2];
// src/stamps.js
function stampBox(m) {
  const s = m.size || 16, x = m.x, y = m.y;
  if (isSticker(m.k)) { const h = s * stickerAspect(m.k); return { x: x - s / 2, y: y - h / 2, w: s, h }; }
  if (isScoreStamp(m.k)) { const z = scoreSize(m); return { x: x - z.w / 2, y: y - z.h / 2, w: z.w, h: z.h }; }
  if (PUNCT_SIGN[m.k]) return { x: x - 0.42 * s, y: y - 0.62 * s, w: 0.84 * s, h: 1.2 * s };
  if (PROOF_TAG[m.k]) { const r = tagRadii(m.k, s); return { x: x - r[0] - 1, y: y - r[1] - 1, w: r[0] * 2 + 2, h: r[1] * 2 + 2 }; }
  const half = { cap: [0.4, 0.3], lower: [0.3, 0.5], insert: [0.35, 0.4], para: [0.4, 0.55], delete: [0.7, 0.5], swap: [0.65, 0.6], space: [0.3, 0.95], close: [0.35, 0.55], period: [0.3, 0.3] }[m.k] || [0.5, 0.5];
  return { x: x - half[0] * s, y: y - half[1] * s, w: half[0] * s * 2, h: half[1] * s * 2 };
}
// src/stamps.js
function tagRadii(k, s) {
  measureCtx.font = '600 ' + (s * 0.62) + 'px ' + FONT;
  const tw = measureCtx.measureText(PROOF_TAG[k]).width;
  return [Math.max(s * 0.5, tw / 2 + s * 0.28), s * 0.5];
}
// src/stamps.js
function drawStamp(ctx, m) {
  const s = m.size || 16, x = m.x, y = m.y;
  if (isSticker(m.k)) {
    const im = stickerImg[m.k];
    if (!im || !im.complete || !im.naturalWidth) return;
    const h = s * stickerAspect(m.k);
    ctx.save(); ctx.translate(x, y); ctx.rotate((m.rot || 0) * Math.PI / 180);
    ctx.shadowColor = 'rgba(15,20,30,0.22)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1.5;
    ctx.drawImage(im, -s / 2, -h / 2, s, h);
    ctx.restore();
    return;
  }
  if (m.k === 'crit') {
    const z = critSize(m), l = x - z.w / 2, t = y - z.h / 2;
    ctx.save(); ctx.lineWidth = Math.max(1, s * 0.045);
    ctx.beginPath(); ctx.roundRect(l, t, z.w, z.h, s * 0.14); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = m.color; ctx.stroke();
    ctx.fillStyle = m.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (z.two) { ctx.font = '600 ' + (s * 0.24) + 'px ' + FONT; ctx.fillText(z.nm, x, t + s * 0.25); }
    ctx.font = '700 ' + (s * 0.4) + 'px ' + FONT; ctx.fillText(String(m.text || '').replace('/', ' / '), x, z.two ? t + s * 0.66 : y + s * 0.01);
    ctx.restore(); return;
  }
  if (isScoreStamp(m.k)) {
    const z = scoreSize(m), [a, b] = scoreLines(m), l = x - z.w / 2, t = y - z.h / 2, r = s * 0.14;
    ctx.save(); ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath(); ctx.roundRect(l, t, z.w, z.h, r); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = m.color; ctx.stroke();
    ctx.fillStyle = m.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 ' + (s * 0.34) + 'px ' + FONT; ctx.fillText(a || '', x, z.two ? t + s * 0.31 : y + s * 0.01);
    if (z.two) {
      ctx.lineWidth = Math.max(0.8, s * 0.022); ctx.beginPath(); ctx.moveTo(l, t + s * 0.6); ctx.lineTo(l + z.w, t + s * 0.6); ctx.stroke();
      ctx.font = '600 ' + (s * 0.26) + 'px ' + FONT; ctx.fillText(b, x, t + s * 0.8);
    }
    if (z.xc) { ctx.font = '600 ' + (s * 0.19) + 'px ' + FONT; ctx.fillText(z.xc, x, t + s * 1.1); }
    ctx.restore(); return;
  }
  ctx.save(); ctx.strokeStyle = ctx.fillStyle = m.color; ctx.lineWidth = Math.max(1.1, s * 0.085); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (...p) => { ctx.beginPath(); ctx.moveTo(x + p[0] * s, y + p[1] * s); for (let i = 2; i < p.length; i += 2) ctx.lineTo(x + p[i] * s, y + p[i + 1] * s); ctx.stroke(); };
  const text = (t, size, dy) => { ctx.font = '600 ' + size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y + (dy || 0)); };
  switch (m.k) {
    case 'cap': for (const d of [-0.18, 0, 0.18]) line(-0.35, d, 0.35, d); break;   // three lines under a letter
    case 'lower': line(-0.25, 0.45, 0.25, -0.45); break;
    case 'insert': line(-0.3, 0.35, 0, -0.35, 0.3, 0.35); break;
    case 'para': text('¶', s * 1.15); break;
    case 'delete':
      ctx.beginPath(); ctx.moveTo(x - 0.65 * s, y); ctx.lineTo(x + 0.25 * s, y);
      ctx.bezierCurveTo(x + 0.6 * s, y, x + 0.62 * s, y - 0.45 * s, x + 0.4 * s, y - 0.45 * s);
      ctx.bezierCurveTo(x + 0.2 * s, y - 0.45 * s, x + 0.22 * s, y - 0.1 * s, x + 0.55 * s, y + 0.35 * s); ctx.stroke(); break;
    case 'swap':
      ctx.beginPath(); ctx.moveTo(x - 0.6 * s, y + 0.15 * s);
      ctx.bezierCurveTo(x - 0.55 * s, y - 0.6 * s, x - 0.1 * s, y - 0.5 * s, x, y);
      ctx.bezierCurveTo(x + 0.1 * s, y + 0.5 * s, x + 0.55 * s, y + 0.6 * s, x + 0.6 * s, y - 0.15 * s); ctx.stroke(); break;
    case 'space': line(0, -0.35, 0, 0.9); text('#', s * 0.6, -0.68 * s); break;
    case 'close':
      ctx.beginPath(); ctx.arc(x, y - 0.15 * s, 0.32 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y + 0.15 * s, 0.32 * s, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); break;
    case 'period':
      ctx.beginPath(); ctx.arc(x, y, 0.26 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 0.07 * s, 0, Math.PI * 2); ctx.fill(); break;
    default:
      if (PUNCT_SIGN[m.k]) {
        const [sign, way] = PUNCT_SIGN[m.k];
        if (way > 0) { line(-0.3, 0.55, 0, 0.12, 0.3, 0.55); text(sign, s * (sign === '=' ? 0.7 : 0.95), -0.25 * s); }   // the caret, the mark above its point
        else { line(-0.32, -0.45, 0, 0.5, 0.32, -0.45); text(sign, s * (sign.length > 1 ? 0.55 : 0.8), -0.1 * s); }   // the mark sitting inside an upside-down caret
      } else if (PROOF_TAG[m.k]) {
        const [rx, ry] = tagRadii(m.k, s);
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        text(PROOF_TAG[m.k], s * 0.62, s * 0.02);
      }
  }
  ctx.restore();
}
// src/carryover.js
const lostPages = f => f && f.numPages ? Object.keys(f.marks).map(Number).filter(p => p >= f.numPages && f.marks[p].length) : [];
// src/people.js
const classOfNames = names => (names && lib.classes.find(k => k.names === names)) || null;   // rosterMatch and rosterPairs are handed c.names itself
// src/people.js
const infoSig = c => c && c.info ? JSON.stringify(c.info) : '';
// src/people.js
const idDigits = v => String(v || '').replace(/\D/g, '');
// src/people.js
const wordKey = s => nameWords(s).sort().join(' ');
// src/people.js
function infoHits(c, key) {
  if (!c || !c.info || !key) return [];
  const kw = wordKey(key), nums = String(key).match(/\d{4,}/g) || [];
  return c.names.filter(n => {
    const i = c.info[n]; if (!i) return false;
    if ((i.other || []).some(o => o === key || (kw && wordKey(o) === kw))) return true;
    const d = idDigits(i.id); return d.length >= 4 && nums.includes(d);
  });
}
// src/quiz.js
const quizLabel = (q, i) => (q.lab || '').trim() || String(i + 1);
// src/quiz.js
const qzAnsLab = q => { const i = batch.quiz.qs.indexOf(q), l = quizLabel(q, i < 0 ? 0 : i); return /^\d/.test(l) ? 'Q' + l : l; };
// src/imported.js
function impHas(f) { return !!(f && f.imp && Object.values(f.imp).some(a => a.length)); }
// src/imported.js
async function viewBytes(f) {
  if (!impHas(f) || f.kind !== 'pdf') return f.data;
  const key = JSON.stringify(f.imp);
  if (f.view && f.viewOf === f.data && f.viewKey === key) return f.view;
  try { f.view = await impStrip(f.data, f.imp); } catch (e) { console.error(e); return f.data; }
  f.viewOf = f.data; f.viewKey = key;
  return f.view;
}
// src/imported.js
function impRefId(r) { return r instanceof PDFLib.PDFRef ? r.objectNumber + 'R' + (r.generationNumber ? r.generationNumber : '') : ''; }
// src/imported.js
async function impStrip(data, imp) {
  const doc = await PDFLib.PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
  const list = doc.getPages();
  for (const [p, ids] of Object.entries(imp)) {
    const page = list[+p]; if (!page || !ids.length) continue;
    const arr = page.node.lookupMaybe(PDFLib.PDFName.of('Annots'), PDFLib.PDFArray); if (!arr) continue;
    const gone = new Set(ids), keep = [];
    for (let i = 0; i < arr.size(); i++) {
      const r = arr.get(i);
      if (gone.has(impRefId(r))) continue;
      // a comment's pop-up goes with it
      const d = doc.context.lookup(r);
      if (d instanceof PDFLib.PDFDict && gone.has(impRefId(d.get(PDFLib.PDFName.of('Parent'))))) continue;
      keep.push(r);
    }
    page.node.set(PDFLib.PDFName.of('Annots'), doc.context.obj(keep));
  }
  return doc.save();
}
// src/marksout.js
const one = t => String(t || '').replace(/\s*\n\s*/g, ' ').trim();
// src/groups.js
const stampHidden = (m, key) => !!(m && m.o && m.o !== key && batch.students.some(s => s.key === m.o));
// src/groups.js
function marksMine(list, f, st) {
  if (!list || !list.some(m => m && m.o)) return list;
  st = st || (batch && batch.students.find(s => s.files.includes(f)));
  return st ? list.filter(m => !stampHidden(m, st.key)) : list;
}
// src/typednotes.js
function tnHasG(g) { return !!(g && g.tn && Array.isArray(g.tn.l) && g.tn.l.some(x => x && x.k !== 'h' && x.y !== 'h2' && String(x.s || '').trim())); }
// src/typednotes.js
function tnHas(st) { return !!st && tnHasG({ tn: { l: tnMine(st, (st.grade.tn && st.grade.tn.l) || []) } }); }
// src/typednotes.js
const tnHidden = (x, st) => !!(x && x.o && x.o !== st.key && batch && batch.students.some(s => s.key === x.o));
// src/typednotes.js
const tnMine = (st, L) => (Array.isArray(L) ? L.filter(x => !tnHidden(x, st)) : []);
// src/typednotes.js
const tnBackOn = () => setup.tnBack !== false;
// src/typednotes.js
function tnOut(st) { return tnBackOn() && tnHas(st); }
export { FONT, AT_END, drawMarks, layoutNotes, textLayout, wrapText, bboxOf, sideFor, sideScreen, drawStamp, stampBox, strokePath, drawHls, stickersReady, STICKERS, lightLut, lightCanvas, draw, marksMine, loadLines, anonOn, shownName, viewBytes, impHas, fileSeq, layoutOf, docIn, docAuto, fileByPath, viewable, vpRot, vpDraw, skewXf, rotOf, skewOf, defaultLayout, seqSig, pageLit, setPageLit, lightLive, lightAuto, lightFor, lightOpts, lightKey, pageOwnL, setPageOwnL, LIGHT0, lightOn };
export { nameFold, rosterMatch, batchClass, WORD_RX, lostPages, one, stampHidden, tnHasG, noteRunY, anonOrder, hasPress, PRESS_MAX, textGrips, canResize, cornerPt, isSticker, isScoreStamp, stickerAspect, measureCtx, rgb, docMarked, docAdded, scrub, scrubMarks, lightForPage, isLatin, rawWords, namesNow, ownNames, coverRx, stampScore, tnMine, tnOut, nameWords, SORT_STOP, madeFromWord, AT_START, ID_RX, latinRx, anyRx, wordOk, bounded, alt, runAlts, latinParts, initialAlts, altsRx, FILE_SEP, tnHas, tnHidden, tnBackOn, anonRx, classById, classOfNames, infoHits, wordAlts };
