'use strict';
/* Grading Studio: open a ManageBac download, mark PDFs, score with a rubric, list grades in folder order,
   and export the marked files back into their student folders.
   Files live in memory only. Marks, scores and comments are kept in this browser's localStorage
   (per download), so the same download can be reopened later. Nothing is uploaded. */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/* ---------------- pdf.js worker (inlined, works from file://) ---------------- */
const workerReady = (async () => {
  const src = $('#pdfWorkerSrc').textContent;
  let url = null;
  try {
    url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const ok = await new Promise(res => {
      let w;
      try { w = new Worker(URL.createObjectURL(new Blob(['onmessage=e=>postMessage(e.data)'], { type: 'text/javascript' }))); }
      catch { return res(false); }
      const t = setTimeout(() => { w.terminate(); res(false); }, 2500);
      w.onmessage = () => { clearTimeout(t); w.terminate(); res(true); };
      w.onerror = () => { clearTimeout(t); res(false); };
      w.postMessage(1);
    });
    if (ok) { pdfjsLib.GlobalWorkerOptions.workerSrc = url; return; }
  } catch {}
  const s = document.createElement('script');
  s.textContent = src;
  document.head.appendChild(s);
  pdfjsLib.GlobalWorkerOptions.workerSrc = url || 'about:blank';
})();

/* ---------------- small storage helpers (never throw) ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

/* ---------------- light by default (Taylor), with a switch ---------------- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  for (const b of document.querySelectorAll('.themeBtn')) b.textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
}
applyTheme(store.get('gs.theme', 'light'));
document.addEventListener('click', e => {
  if (!e.target.closest('.themeBtn')) return;
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  store.set('gs.theme', t); applyTheme(t);
});

/* ---------------- grading setup ---------------- */
// Taylor's grading scale for a 12-point rubric. Half points fall halfway between two rows.
const SCALE12 = { 12: 100, 11: 95, 10: 91, 9: 86, 8: 82, 7: 77, 6: 73, 5: 68, 4: 64, 3: 60 };
const RUBRIC_STEPS = [4, 3.5, 3, 2.5, 2, 1.5, 1];
const SCALE_FIVES = { 12: 100, 11: 95, 10: 90, 9: 85, 8: 80, 7: 75, 6: 70, 5: 65, 4: 60, 3: 55, 2: 50, 1: 45, 0: 40 };
const DEFAULT_SETUP = { mode: 'rubric', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 10, scale: SCALE12 };
let setup = { ...DEFAULT_SETUP, ...store.get('gs.setup', {}) };

function maxPoints() { return setup.mode === 'rubric' ? setup.criteria.length * 4 : +setup.outOf || 0; }
// Uses the grading scale when its top score matches the total possible; half points fall between two rows.
function percentFor(total) {
  if (total == null || total === '' || isNaN(total)) return null;
  const max = maxPoints();
  if (!max) return null;
  const sc = setup.scale, keys = sc ? Object.keys(sc).map(Number).filter(k => sc[k] !== '' && sc[k] != null && !isNaN(+sc[k])).sort((a, b) => a - b) : [];
  if (keys.length >= 2 && keys[keys.length - 1] === max) {
    const val = k => +sc[k];
    if (total >= max) return val(max);
    let v;
    if (total <= keys[0]) v = val(keys[0]) - (keys[0] - total) * (val(keys[1]) - val(keys[0])) / (keys[1] - keys[0]);
    else {
      let i = 0; while (keys[i + 1] < total) i++;
      const lo = keys[i], hi = keys[i + 1];
      v = total === lo ? val(lo) : val(lo) + (val(hi) - val(lo)) * (total - lo) / (hi - lo);
    }
    return Math.max(0, Math.round(v * 10) / 10);
  }
  return Math.round(total / max * 1000) / 10;
}
function gradeOf(st) {
  const own = ownGrade(st);
  if (own.total != null || !st.found || !st.found.found) return own;
  const fd = st.found;   // a grade typed on the paper (Grade sheet), used until she scores it here
  return { total: fd.score, pct: fd.pct != null ? fd.pct : percentFor(fd.score), done: true, paper: true };
}
function ownGrade(st) {
  const g = st.grade;
  if (setup.mode === 'rubric') {
    const sc = setup.criteria.map((_, i) => g.rubric[i]);
    if (sc.every(v => v == null)) return { total: null, pct: null, done: false };
    const total = sc.reduce((a, v) => a + (v || 0), 0);
    return { total, pct: percentFor(total), done: sc.every(v => v != null) };
  }
  const t = g.points === '' || g.points == null ? null : +g.points;
  return { total: t, pct: t == null || isNaN(t) ? null : percentFor(t), done: t != null && !isNaN(t) };
}
const fmtNum = n => n == null ? '' : (Math.round(n * 100) / 100).toString();
const fmtPct = p => p == null ? '' : fmtNum(p) + '%';

/* ---------------- state ---------------- */
let batch = null;        // { id, name, students:[...] }
let cur = 0;             // index of the open student
let tool = 'pen';
const COLORS = { red: '#D7263D', blue: '#1F5FD1', green: '#1E8A4C', purple: '#7B3FC4', black: '#1B1F27' };
const HL = { yellow: '#FFE45C', green: '#B4F0A8', pink: '#FFB8D6', blue: '#B0E0FF' };
let inkColor = store.get('gs.ink', 'red'), hlColor = store.get('gs.hl', 'yellow'), penW = store.get('gs.penW', 2);
let zoom = 1;
let undoStack = [];
let selected = null;     // { page, mark }
let bank = store.get('gs.bank', []);   // Taylor's saved comments (her own words, no student data)

/* ---------------- intake ---------------- */
const isPdf = n => /\.pdf$/i.test(n), isImg = n => /\.(png|jpe?g)$/i.test(n);
const junk = p => /(^|\/)(__MACOSX|\.)/.test(p);
function unzipInto(data, prefix, raw, depth) {
  const un = fflate.unzipSync(data, { filter: f => !junk(f.name) && !f.name.endsWith('/') });
  const inner = Object.keys(un);
  // Drive and ManageBac often wrap everything in one top folder; drop that layer.
  const tops = new Set(inner.map(p => p.split('/')[0]));
  const strip = tops.size === 1 && inner.every(p => p.includes('/')) && (new Set(inner.map(p => p.split('/')[1])).size > 1 || inner.every(p => p.split('/').length > 2) || prefix);
  for (const p of inner) {
    const q = prefix + (strip ? p.split('/').slice(1).join('/') : p);
    // a ZIP inside the ZIP (for example one per student) opens as that student's folder
    if (/\.zip$/i.test(q) && depth < 2) { try { unzipInto(un[p], q.replace(/\.zip$/i, '') + '/', raw, depth + 1); continue; } catch {} }
    raw.push({ path: q, data: un[p] });
  }
}
async function intake(entries, label, assignment) {   // entries: [{ path, file|data }]
  const raw = [];
  for (const e of entries) {
    if (junk(e.path)) continue;
    if (/\.zip$/i.test(e.path)) {
      const data = e.data || new Uint8Array(await e.file.arrayBuffer());
      try { unzipInto(data, '', raw, 0); }
      catch { toast('Couldn’t open ' + e.path.split('/').pop() + ' as a ZIP'); continue; }
      if (!label) label = e.path.split('/').pop().replace(/\.zip$/i, '');
      continue;
    }
    raw.push({ path: e.path, file: e.file, data: e.data });
  }
  if (!raw.length) { toast('Nothing found in what you dropped'); return; }

  // One student per top-level folder; loose files are one student each.
  const map = new Map();
  for (const r of raw) {
    const parts = r.path.split('/').filter(Boolean);
    const key = parts.length > 1 ? parts[0] : parts[0].replace(/\.[^.]+$/, '');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  const keys = [...map.keys()].sort(natural);
  const students = [];
  for (const key of keys) {
    const files = [];
    for (const r of map.get(key).sort((a, b) => natural(a.path, b.path))) {
      const name = r.path.split('/').pop();
      const data = r.data || (r.file ? new Uint8Array(await r.file.arrayBuffer()) : null);
      const magic = data && data.length > 4 && data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46;   // "%PDF"
      let kind = isPdf(name) || magic ? 'pdf' : isImg(name) ? 'img' : MEDIA_RX.test(name) ? 'media' : /\.docx$/i.test(name) ? 'docx' : 'other';
      let pdf = kind === 'pdf' ? data : null;
      if (kind === 'img') { try { pdf = await imageToPdf(data, name); } catch { kind = 'other'; } }
      files.push({ path: r.path, name, kind, data: kind === 'media' || kind === 'docx' ? data : pdf, size: data ? data.length : 0, marks: {}, pages: null });
    }
    students.push({ key, files, grade: { rubric: [], points: '', comment: '' }, layout: null, inc: {} });
  }
  const id = 'gs.b.' + hash(students.map(s => s.files.map(f => f.path + ':' + f.size).join('|')).join('/'));
  batch = { id, name: (assignment && assignment.name) || label || 'Your download', students, assignment: assignment || null };
  delete setup.spot;   // the grade spot belongs to one download
  if (assignment) { setup = { ...DEFAULT_SETUP, ...(assignment.setup || store.get('gs.setup', {})) }; delete setup.spot; }
  thumbCache.clear();
  const saved = store.get(id, null);
  if (!assignment && saved && saved.setup) setup = { ...DEFAULT_SETUP, ...saved.setup };
  await applyRubricPage();
  restore();
  if (saved && saved.cls != null) batch.classId = saved.cls;
  renderClassSel();
  if (assignment) { assignment.batchId = id; assignment.opened = Date.now(); saveLib(); }
  cur = 0; undoStack = []; selected = null;
  $('#start').hidden = true; $('#app').hidden = false;
  $('#batchName').textContent = batch.name + ' · ' + students.length + (students.length === 1 ? ' student' : ' students');
  renderTools(); renderList(); openStudent(batch.restoredCur || 0);
  scanned = false; scanAll();
}
async function imageToPdf(bytes, name) {
  const doc = await PDFLib.PDFDocument.create();
  const img = /\.png$/i.test(name) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  const W = 612, H = Math.round(W * img.height / img.width);
  doc.addPage([W, H]).drawImage(img, { x: 0, y: 0, width: W, height: H });
  return await doc.save();
}
function hash(s) {
  let h1 = 0x811c9dc5, h2 = 0x1234567;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
async function walkEntry(entry, prefix, out) {
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    out.push({ path: prefix + file.name, file });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    let b;
    do {
      b = await new Promise((res, rej) => reader.readEntries(res, rej));
      for (const ch of b) await walkEntry(ch, prefix + entry.name + '/', out);
    } while (b.length);
  }
}

/* ---------------- keeping work in this browser ---------------- */
let saveT;
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(saveNow, 500); }
function saveNow() {
  if (!batch) return;
  const data = { t: Date.now(), cur, setup, cls: batch.classId, share: batch.share, drive: batch.drive, s: {} };
  for (const st of batch.students) {
    const f = {};
    for (const fl of st.files) if (Object.values(fl.marks).some(a => a.length)) f[fl.path] = fl.marks;
    const g = st.grade;
    const hb = {};
    for (const fl of st.files) if (fl.hand) hb[fl.path] = fl.hand;
    const inc = st.inc && Object.keys(st.inc).length ? st.inc : undefined;
    const tr = {}; for (const fl of st.files) if (fl.tr) tr[fl.path] = fl.tr;
    if (Object.keys(tr).length || Object.keys(hb).length || st.layout || inc || Object.keys(f).length || g.rubric.some(v => v != null) || g.points !== '' || g.comment)
      data.s[st.key] = { f, g, h: hb, L: st.layout || undefined, inc, tr: Object.keys(tr).length ? tr : undefined };
  }
  if (!store.set(batch.id, data)) toast('This browser is out of room to keep your marks. Export soon.');
  const idx = store.get('gs.batches', {}); idx[batch.id] = data.t;
  const old = Object.entries(idx).sort((a, b) => b[1] - a[1]).slice(12);   // keep the 12 most recent downloads
  for (const [k] of old) { store.del(k); delete idx[k]; }
  store.set('gs.batches', idx);
}
function restore() {
  const data = store.get(batch.id, null);
  if (!data) return;
  if (data.setup && !batch.assignment) setup = { ...DEFAULT_SETUP, ...data.setup };
  else if (data.setup && data.setup.spot) setup.spot = data.setup.spot;
  let n = 0;
  for (const st of batch.students) {
    const s = data.s[st.key]; if (!s) continue;
    st.grade = { rubric: [], points: '', comment: '', ...s.g };
    for (const fl of st.files) { if (s.f[fl.path]) fl.marks = s.f[fl.path]; if (s.h && s.h[fl.path]) fl.hand = s.h[fl.path]; if (s.tr && s.tr[fl.path]) fl.tr = s.tr[fl.path]; }
    if (s.L) st.layout = s.L.map(d => ({ ...d, pages: d.pages.filter(([path]) => st.files.some(f => f.path === path)) }));
    if (s.inc) st.inc = s.inc;
    n++;
  }
  if (data.share) batch.share = data.share;
  if (data.drive && !batch.drive) batch.drive = data.drive;
  batch.restoredCur = Math.min(data.cur || 0, batch.students.length - 1);
  if (n) setTimeout(() => toast('Picked up where you left off (' + n + (n === 1 ? ' student' : ' students') + ' started)'), 300);
}

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
  const maxW = Math.max(40, W - m.x - 6);
  const lines = wrapText(measureCtx, m.text || '', maxW);
  const w = Math.max(10, ...lines.map(l => measureCtx.measureText(l).width));
  return { lines, w, h: Math.max(1, lines.length) * m.size * 1.25, maxW };
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
  ctx.save(); ctx.strokeStyle = m.color; ctx.lineWidth = s * 0.13; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(m.x - s * 0.4, m.y); ctx.lineTo(m.x - s * 0.1, m.y + s * 0.3); ctx.lineTo(m.x + s * 0.45, m.y - s * 0.35); ctx.stroke();
  ctx.restore();
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
  // highlights under everything, multiplied so the writing stays dark
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  for (const m of marks) if (m.t === 'hl') { ctx.fillStyle = m.color; ctx.fillRect(m.x, m.y, m.w, m.h); }
  ctx.restore();
  for (const m of marks) {
    if (m.t === 'pen') {
      ctx.save(); ctx.strokeStyle = m.color; ctx.lineWidth = m.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      const p = m.pts;
      ctx.moveTo(p[0][0], p[0][1]);
      if (p.length === 1) ctx.lineTo(p[0][0] + 0.01, p[0][1]);
      for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
      if (p.length > 1) ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      ctx.stroke(); ctx.restore();
    } else if (m.t === 'text' && !(screen && screen.editing === m)) {
      const L = textLayout(m, W);
      ctx.fillStyle = m.color; ctx.font = m.size + 'px ' + FONT; ctx.textBaseline = 'top';
      L.lines.forEach((ln, i) => ctx.fillText(ln, m.x, m.y + i * m.size * 1.25 + m.size * 0.1));
      ctx.textBaseline = 'alphabetic';
    } else if (m.t === 'check') drawCheck(ctx, m);
    else if (m.t === 'oval') {
      ctx.save(); ctx.strokeStyle = m.color; ctx.lineWidth = m.sw || 1.6;
      ctx.beginPath(); ctx.ellipse(m.x + m.w / 2, m.y + m.h / 2, Math.max(1, m.w / 2), Math.max(1, m.h / 2), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }
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
    }
  }
  if (screen && screen.sel) {
    const bb = bboxOf(screen.sel, W);
    if (bb) { ctx.save(); ctx.strokeStyle = '#2747D0'; ctx.setLineDash([3, 2]); ctx.lineWidth = 0.8; ctx.strokeRect(bb.x - 3, bb.y - 3, bb.w + 6, bb.h + 6); ctx.restore(); }
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
  if (m.t === 'note') return { x: m.ax - 5, y: m.ay - 5, w: 10, h: 10 };
  return null;
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
    if (m.t === 'pen') {
      const p = m.pts;
      for (let j = 0; j < p.length; j++) if (distToSeg(x, y, p[j], p[Math.min(j + 1, p.length - 1)]) <= m.w / 2 + slop) return m;
    } else {
      const bb = bboxOf(m, pg.W);
      if (bb && x >= bb.x - slop && x <= bb.x + bb.w + slop && y >= bb.y - slop && y <= bb.y + bb.h + slop) return m;
    }
  }
  return null;
}

/* ---------------- what goes out for each student: files, page order, left out ---------------- */
// A student's "layout" is the list of files that go back to them, each a list of [source path, page].
// Untouched, it is just their files as turned in. Marks stay tied to the source page, so moving pages keeps them.
const thumbCache = new Map();
const viewable = f => f.kind === 'pdf' || f.kind === 'img';
const fileByPath = (st, path) => st.files.find(f => f.path === path);
function defaultLayout(st) {
  const L = st.files.filter(f => viewable(f) && !f.virtual && f.numPages).map(f => ({ name: f.name, file: f.path, pages: [...Array(f.numPages).keys()].map(p => [f.path, p]) }));
  const v = st.files.find(f => f.virtual);
  if (v && L.length) { const pg = [...Array(v.numPages).keys()].map(p => [v.path, p]); L[0].pages = setup.rubricPos === 'start' ? pg.concat(L[0].pages) : L[0].pages.concat(pg); }
  return L;
}
const layoutOf = st => st.layout || defaultLayout(st);
function pageMarked(st, path, p) { const f = fileByPath(st, path); return !!f && (((f.marks[p] || []).length > 0) || !!(f.kami && f.kami[p]) || !!(f.scan && f.scan.found && f.scan.found.some(g => g.page === p)) || !!(f.hand && f.hand.page === p)); }
const docMarked = (st, d) => d.pages.some(([path, p]) => pageMarked(st, path, p));
function batchHasMarks() { return !!batch && batch.students.some(st => st.files.some(f => fileMarked(f))); }
// Left out: chosen by Taylor, or (by default) a file with no marks at all while other papers are marked.
function docIn(st, d) {
  if (d.out != null) return !d.out;
  if (d.file && st.inc && st.inc[d.file] != null) return st.inc[d.file];
  const read = d.pages.every(([path]) => { const f = fileByPath(st, path); return f && f.kami !== undefined; });
  if (!read) return true;
  return docMarked(st, d) || !batchHasMarks();
}
const docAuto = (st, d) => d.out == null && !(d.file && st.inc && st.inc[d.file] != null);
function setDocIn(st, d, on) {
  if (st.layout) { const t = st.layout.find(x => x === d || (x.name === d.name && JSON.stringify(x.pages) === JSON.stringify(d.pages))); if (t) t.out = !on; }
  else { st.inc = st.inc || {}; st.inc[d.file] = on; }
  saveSoon();
}
function fileIn(st, f) { return layoutOf(st).some(d => docIn(st, d) && d.pages.some(([path]) => path === f.path)); }

/* ---------------- the open student ---------------- */
let pages = [];          // on-screen pages for the open student
let docs = [];           // pdf.js documents for the open student
let docMap = new Map();  // source path -> pdf.js document, for the open student
let openToken = 0;
async function openStudent(i, filePath) {
  if (!batch) return;
  commitEditors();
  cur = Math.max(0, Math.min(batch.students.length - 1, i));
  selected = null;
  const token = ++openToken;
  for (const d of docs) d.destroy();
  docs = []; pages = []; docMap = new Map();
  renderList(); renderGrade(); saveSoon();
  const st = batch.students[cur];
  const paper = $('#paper');
  paper.innerHTML = '<div class="who"><h2>' + esc(st.key) + '</h2><span>' + (cur + 1) + ' of ' + batch.students.length + '</span><span style="flex:1"></span>' +
    (st.files.some(viewable) ? '<button class="btn sm" id="arrangeBtn">Arrange pages</button>' : '') + '</div>';
  paper.scrollTop = 0;
  if (!st.files.length) paper.insertAdjacentHTML('beforeend', '<div class="nofile"><b>No file in this folder.</b> Nothing was turned in, so there’s nothing to mark. You can still give a score.</div>');
  curMedia = null;
  for (const f of st.files.filter(f => f.kind === 'media')) paper.appendChild(mediaCard(st, f));
  const rd = refDoc();
  if (rd) { const det = document.createElement('details'); det.className = 'refd'; det.open = store.get('gs.rdOpen', true); det.innerHTML = '<summary>Your document: ' + esc(rd.name) + '</summary>'; det.ontoggle = () => store.set('gs.rdOpen', det.open); paper.appendChild(det); docxCard(rd, rd.name).then(c => { c.querySelector('.fhead').remove(); det.appendChild(c); }); }
  for (const f of st.files.filter(f => f.kind === 'other'))
    paper.insertAdjacentHTML('beforeend', '<div class="nofile" style="margin-bottom:12px"><b>' + esc(f.name) + '</b> can’t be opened here' + (/\.doc$/i.test(f.name) ? ' (an older Word file). Open it in Word, or save it as .docx or PDF.' : '.') + ' You can still give a score.</div>');
  for (const f of st.files.filter(f => f.kind === 'docx')) { const c = await docxCard(f); if (token !== openToken) return; paper.appendChild(c); }
  await workerReady;
  for (const f of st.files.filter(viewable)) {
    try {
      const doc = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
      if (token !== openToken) { doc.destroy(); return; }
      docs.push(doc); docMap.set(f.path, doc); f.numPages = doc.numPages;
    } catch (e) {
      f.bad = /password/i.test(e && e.message) ? 'it’s password-protected' : 'it couldn’t be opened';
      paper.insertAdjacentHTML('beforeend', '<div class="nofile" style="margin-bottom:12px"><b>' + esc(f.name) + '</b>: ' + f.bad + '.</div>');
    }
  }
  if (token !== openToken) return;
  const L = layoutOf(st);
  for (let di = 0; di < L.length; di++) {
    const d = L[di], on = docIn(st, d), auto = docAuto(st, d);
    const head = document.createElement('div'); head.className = 'fhead';
    head.innerHTML = '<span style="color:var(--fg)">' + esc(d.name) + '</span><span>' + d.pages.length + (d.pages.length === 1 ? ' page' : ' pages') + '</span>' +
      (on ? '' : '<span class="pill warn" style="font-size:12px;padding:2px 8px;border-radius:999px;background:var(--warn-soft);color:var(--warn)">' + (auto ? 'No marks, left out' : 'Left out') + '</span>') +
      '<span style="flex:1"></span><button class="link" style="font-size:13px" data-inout="' + di + '">' + (on ? 'Leave out' : 'Bring back') + '</button>';
    paper.appendChild(head);
    if (!on && !auto) continue;   // left out on purpose: just the bar
    for (const [path, p] of d.pages) {
      if (token !== openToken) return;
      const f = fileByPath(st, path), doc = docMap.get(path);
      if (!f || !doc || p >= doc.numPages) continue;
      const page = await doc.getPage(p + 1);
      if (token !== openToken) return;
      const vp = page.getViewport({ scale: 1 });
      const pg = { file: f, idx: p, page, W: vp.width, H: vp.height, side: sideFor(vp.width), marks: () => (f.marks[p] ||= []) };
      const wrap = document.createElement('div'); wrap.className = 'pg';
      if (!on) wrap.style.opacity = '.75';
      const c = document.createElement('canvas');
      wrap.appendChild(c); paper.appendChild(wrap);
      pg.wrap = wrap; pg.canvas = c;
      pages.push(pg);
      pg.extra = (f.kami && f.kami[p] && f.kami[p].notes) || [];
      bindPage(pg);
      await renderPage(pg);
      if (filePath && f.path === filePath && p === 0) wrap.scrollIntoView({ block: 'start' });
    }
  }
  renderTools();
}
$('#paper').addEventListener('click', e => {
  if (e.target.closest('#arrangeBtn')) return openArrange();
  const io = e.target.closest('[data-inout]');
  if (io) {
    const st = batch.students[cur], d = layoutOf(st)[+io.dataset.inout];
    setDocIn(st, d, !docIn(st, d)); renderList(); openStudent(cur);
  }
});

/* ---------------- arrange pages: combine files, drag pages, take pages out ---------------- */
async function thumbFor(path, p) {
  const k = path + '|' + p;
  if (thumbCache.has(k)) return thumbCache.get(k);
  const doc = docMap.get(path); if (!doc) return '';
  const page = await doc.getPage(p + 1);
  const vp = page.getViewport({ scale: 180 / page.getViewport({ scale: 1 }).width });
  const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
  const u = c.toDataURL('image/jpeg', 0.7);
  thumbCache.set(k, u);
  return u;
}
function openArrange() {
  const st = batch.students[cur];
  const start = layoutOf(st).map(d => ({ name: d.name, file: d.file, pages: d.pages.map(x => x.slice()), out: docAuto(st, d) ? null : !docIn(st, d) }));
  let L = JSON.parse(JSON.stringify(start)), tray = [];
  const nameOf = path => (fileByPath(st, path) || { name: path }).name;
  let drag = null;
  const render = () => {
    const col = (items, where, head) => '<div class="acol" data-where="' + where + '">' + head +
      '<div class="adrop" data-where="' + where + '">' + items.map(([path, p], i) =>
        '<div class="ath" draggable="true" data-where="' + where + '" data-i="' + i + '"><img data-th="' + esc(path) + '|' + p + '" alt=""><div class="cap">p. ' + (p + 1) + (st.files.filter(viewable).length > 1 ? ' · ' + esc(nameOf(path)) : '') + '</div>' +
        (where === 'tray' ? '' : '<button class="rm" data-rm="' + where + ':' + i + '" title="Take this page out" aria-label="Take this page out">×</button>') + '</div>').join('') +
      (items.length ? '' : '<div class="empty">' + (where === 'tray' ? 'Pages you take out land here.' : 'Drag pages here') + '</div>') + '</div></div>';
    $('#arrBody').innerHTML = '<div class="acols">' + L.map((d, di) => col(d.pages, di,
      '<div class="ahead"><input type="text" data-name="' + di + '" value="' + esc(d.name) + '" aria-label="File name">' +
      '<label class="chk" style="margin:4px 0 0;font-size:13px"><input type="checkbox" data-in="' + di + '"' + (docIn(st, d) ? ' checked' : '') + '> Send back to the student</label>' +
      (L.length > 1 ? '<button class="link" style="font-size:12px" data-delfile="' + di + '">Remove this file (pages go to the tray)</button>' : '') + '</div>')).join('') +
      col(tray, 'tray', '<div class="ahead"><b>Taken out</b><div class="muted" style="font-size:12px">Drag back to use again</div></div>') + '</div>';
    for (const img of $('#arrBody').querySelectorAll('img[data-th]')) {
      const [path, p] = [img.dataset.th.slice(0, img.dataset.th.lastIndexOf('|')), +img.dataset.th.slice(img.dataset.th.lastIndexOf('|') + 1)];
      thumbFor(path, p).then(u => { img.src = u; });
    }
  };
  const listOf = w => w === 'tray' ? tray : L[+w].pages;
  openDlg('<div class="bh"><h2>Arrange pages</h2><span class="muted">' + esc(st.key) + '</span><button class="icon" data-cancel aria-label="Close">✕</button></div>' +
    '<div class="bb" id="arrBody"></div>' +
    '<div class="bf" style="justify-content:space-between"><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-combine>Combine into one file</button><button class="btn" data-newfile>+ New file</button><button class="btn" data-reset>Back to how it was turned in</button></span>' +
    '<span style="display:flex;gap:8px"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-save>Save</button></span></div>');
  render();
  const box = $('#dlgBox');
  box.addEventListener('dragstart', e => {
    const t = e.target.closest('.ath'); if (!t) return;
    drag = { from: t.dataset.where, i: +t.dataset.i };
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'page');
    setTimeout(() => t.classList.add('dragging'), 0);
  });
  box.addEventListener('dragend', () => { drag = null; for (const x of box.querySelectorAll('.dragging,.ins,.insEnd')) x.classList.remove('dragging', 'ins', 'insEnd'); });
  const dropIndex = (zone, e) => {
    const kids = [...zone.querySelectorAll('.ath')];
    for (let k = 0; k < kids.length; k++) {
      const r = kids[k].getBoundingClientRect();
      if (e.clientY < r.top) return k;
      if (e.clientY <= r.bottom && e.clientX < r.left + r.width / 2) return k;
    }
    return kids.length;
  };
  box.addEventListener('dragover', e => {
    const zone = e.target.closest('.adrop'); if (!zone || !drag) return;
    e.preventDefault();
    for (const x of box.querySelectorAll('.ins,.insEnd')) x.classList.remove('ins', 'insEnd');
    const k = dropIndex(zone, e), kids = zone.querySelectorAll('.ath');
    if (kids[k]) kids[k].classList.add('ins'); else zone.classList.add('insEnd');
  });
  box.addEventListener('drop', e => {
    const zone = e.target.closest('.adrop'); if (!zone || !drag) return;
    e.preventDefault();
    let k = dropIndex(zone, e);
    const src = listOf(drag.from), dst = listOf(zone.dataset.where);
    const [item] = src.splice(drag.i, 1);
    if (src === dst && drag.i < k) k--;
    dst.splice(k, 0, item);
    drag = null; render();
  });
  box.addEventListener('input', e => { if (e.target.dataset.name != null) L[+e.target.dataset.name].name = e.target.value; });
  box.addEventListener('change', e => { if (e.target.dataset.in != null) L[+e.target.dataset.in].out = !e.target.checked; });
  box.onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    const rm = e.target.closest('[data-rm]');
    if (rm) { const [w, i] = rm.dataset.rm.split(':'); tray.push(...listOf(w).splice(+i, 1)); return render(); }
    const df = e.target.closest('[data-delfile]');
    if (df) { tray.push(...L[+df.dataset.delfile].pages); L.splice(+df.dataset.delfile, 1); return render(); }
    if (e.target.closest('[data-combine]')) {
      const keep = L.filter(d => !d.out);
      const all = (keep.length ? keep : L).flatMap(d => d.pages);
      const first = (keep.length ? keep : L)[0] || { name: 'Combined.pdf' };
      L = [{ name: first.name, pages: all, out: false }].concat(L.filter(d => keep.length && d.out));
      return render();
    }
    if (e.target.closest('[data-newfile]')) { L.push({ name: 'New file ' + (L.length + 1) + '.pdf', pages: [], out: false }); return render(); }
    if (e.target.closest('[data-reset]')) { L = defaultLayout(st).map(d => ({ ...d, out: null })); tray = []; return render(); }
    if (e.target.closest('[data-save]')) {
      L = L.filter(d => d.pages.length).map(d => ({ name: (d.name.trim() || 'File') .replace(/(\.pdf)?$/i, '.pdf'), file: d.file, pages: d.pages, out: d.out }));
      const def = defaultLayout(st);
      const same = L.length === def.length && L.every((d, k) => d.file === def[k].file && d.name === def[k].name && JSON.stringify(d.pages) === JSON.stringify(def[k].pages) && d.out == null);
      st.layout = same ? null : L.map(d => ({ ...d, out: d.out == null ? undefined : d.out }));
      if (st.layout) for (const d of st.layout) if (d.out === undefined) delete d.out;
      saveSoon(); closeDlg(); renderList(); openStudent(cur);
      toast('Saved. Export uses this order.');
    }
  };
}

function fitScale(pg) {
  const avail = $('#paper').clientWidth - 40;
  return Math.max(0.3, Math.min(2.2, avail / (pg.W + pg.side))) * zoom;
}
async function renderPage(pg) {
  const s = fitScale(pg), dpr = window.devicePixelRatio || 1;
  pg.s = s;
  const vp = pg.page.getViewport({ scale: s * dpr });
  const bmp = document.createElement('canvas');
  bmp.width = Math.ceil(vp.width); bmp.height = Math.ceil(vp.height);
  const bctx = bmp.getContext('2d'); bctx.fillStyle = '#fff'; bctx.fillRect(0, 0, bmp.width, bmp.height);
  try { await pg.page.render({ canvasContext: bctx, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise; } catch (e) { if (e && e.name === 'RenderingCancelledException') return; }
  pg.bmp = bmp;
  const c = pg.canvas;
  c.width = Math.ceil((pg.W + pg.side) * s * dpr); c.height = Math.ceil(pg.H * s * dpr);
  c.style.width = (pg.W + pg.side) * s + 'px'; c.style.height = pg.H * s + 'px';
  draw(pg);
}
function draw(pg, live) {
  if (!pg.bmp) return;
  const c = pg.canvas, ctx = c.getContext('2d'), k = c.width / (pg.W + pg.side);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(pg.bmp, 0, 0, pg.bmp.width, pg.bmp.height, 0, 0, pg.W * k, pg.H * k);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const marks = pg.marks().concat(pg.extra || [], live || []);
  pg.boxes = drawMarks(ctx, marks, pg.W, pg.H, pg.side, { sel: selected && selected.page === pg ? selected.mark : null, editing: pg.editing });
}
function redrawAll() { for (const pg of pages) draw(pg); }
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => pages.forEach(renderPage), 150); });

/* ---------------- undo ---------------- */
function snap(pg) { undoStack.push({ file: pg.file, idx: pg.idx, before: JSON.stringify(pg.marks()) }); if (undoStack.length > 200) undoStack.shift(); renderTools(); }
function changed(pg) { draw(pg); saveSoon(); renderList(); }
function undo() {
  const u = undoStack.pop(); if (!u) return;
  u.file.marks[u.idx] = JSON.parse(u.before);
  selected = null;
  const pg = pages.find(p => p.file === u.file && p.idx === u.idx);
  if (pg) draw(pg); else { const si = batch.students.findIndex(s => s.files.includes(u.file)); if (si >= 0 && si !== cur) openStudent(si); }
  saveSoon(); renderList(); renderTools();
}

/* ---------------- pointer input on a page ---------------- */
function bindPage(pg) {
  const c = pg.canvas;
  const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / pg.s, (e.clientY - r.top) / pg.s]; };
  const onPage = (x, y) => x >= 0 && x <= pg.W && y >= 0 && y <= pg.H;
  let g = null;   // the gesture in progress
  c.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    commitEditors();
    const [x, y] = pt(e);
    // A comment box in the margin always opens for editing, whatever the tool.
    const box = (pg.boxes || []).find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (box && !box.n.ro && tool !== 'erase') { e.preventDefault(); openNote(pg, box.n); return; }
    if (tool !== 'select' && tool !== 'erase' && !onPage(x, y)) return;
    e.preventDefault();
    c.setPointerCapture(e.pointerId);
    if (tool === 'pen') g = { m: { t: 'pen', color: COLORS[inkColor], w: penW, pts: [[r1(x), r1(y)]] } };
    else if (tool === 'hl') g = { x0: x, y0: y, m: { t: 'hl', color: HL[hlColor], x, y, w: 0, h: 0 } };
    else if (tool === 'oval') g = { x0: x, y0: y, m: { t: 'oval', color: COLORS[inkColor], sw: Math.max(1.2, penW * 0.8), x, y, w: 0, h: 0 } };
    else if (tool === 'erase') { g = { erase: true, snapped: false }; eraseAt(pg, x, y, g); }
    else if (tool === 'check') { snap(pg); pg.marks().push({ t: 'check', color: COLORS[inkColor], x: r1(x), y: r1(y), size: 22 }); changed(pg); }
    else if (tool === 'text') {
      const hit = hitMark(pg, x, y, 3);
      if (hit && hit.t === 'text') editText(pg, hit);
      else { snap(pg); const m = { t: 'text', color: COLORS[inkColor], x: r1(x), y: r1(y - 7), size: 14, text: '' }; pg.marks().push(m); editText(pg, m, true); }
    } else if (tool === 'note') {
      const m = { t: 'note', color: COLORS[inkColor], ax: r1(x), ay: r1(y), text: '' };
      openNote(pg, m, true);
    } else if (tool === 'select') {
      const hit = hitMark(pg, x, y, 4);
      selected = hit ? { page: pg, mark: hit } : null;
      redrawAll();
      if (hit) g = { move: hit, x, y, moved: false };
    }
  });
  c.addEventListener('pointermove', e => {
    if (!g) { if (tool === 'select') { const [x, y] = pt(e); c.style.cursor = hitMark(pg, x, y, 4) ? 'move' : 'default'; } return; }
    const [x, y] = pt(e);
    if (g.m && g.m.t === 'pen') {
      const p = g.m.pts, last = p[p.length - 1];
      if (Math.hypot(x - last[0], y - last[1]) > 0.7) p.push([r1(clamp(x, 0, pg.W)), r1(clamp(y, 0, pg.H))]);
      draw(pg, [g.m]);
    } else if (g.m && (g.m.t === 'hl' || g.m.t === 'oval')) {
      const x1 = clamp(x, 0, pg.W), y1 = clamp(y, 0, pg.H);
      Object.assign(g.m, { x: Math.min(g.x0, x1), y: Math.min(g.y0, y1), w: Math.abs(x1 - g.x0), h: Math.abs(y1 - g.y0) });
      draw(pg, [g.m]);
    } else if (g.erase) eraseAt(pg, x, y, g);
    else if (g.move) {
      const dx = x - g.x, dy = y - g.y;
      if (!g.moved) { if (Math.hypot(dx, dy) < 1.5) return; snap(pg); g.moved = true; }
      moveMark(g.move, dx, dy); g.x = x; g.y = y; draw(pg);
    }
  });
  const end = () => {
    if (!g) return;
    if (g.m && g.m.t === 'pen') { snap(pg); pg.marks().push(g.m); changed(pg); }
    else if (g.m && g.m.t === 'oval') {
      if (g.m.w >= 6 && g.m.h >= 6) { for (const k of ['x', 'y', 'w', 'h']) g.m[k] = r1(g.m[k]); snap(pg); pg.marks().push(g.m); changed(pg); }
      else draw(pg);
    }
    else if (g.m && g.m.t === 'hl') {
      if (g.m.w < 4 && g.m.h < 4) {   // a click: highlight one line-height strip
        Object.assign(g.m, { x: g.x0 - 30, y: g.y0 - 7, w: 60, h: 14 });
      }
      if (g.m.h < 6) { g.m.y -= (6 - g.m.h) / 2; g.m.h = 6; }
      for (const k of ['x', 'y', 'w', 'h']) g.m[k] = r1(g.m[k]);
      snap(pg); pg.marks().push(g.m); changed(pg);
    } else if (g.move && g.moved) changed(pg);
    g = null;
  };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
  c.addEventListener('dblclick', e => {
    if (tool !== 'select') return;
    const [x, y] = pt(e);
    const hit = hitMark(pg, x, y, 3);
    if (hit && hit.t === 'text') editText(pg, hit);
    if (hit && hit.t === 'note') openNote(pg, hit);
  });
}
const r1 = v => Math.round(v * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function moveMark(m, dx, dy) {
  if (m.t === 'pen') m.pts = m.pts.map(([x, y]) => [r1(x + dx), r1(y + dy)]);
  else if (m.t === 'note') { m.ax = r1(m.ax + dx); m.ay = r1(m.ay + dy); }
  else { m.x = r1(m.x + dx); m.y = r1(m.y + dy); }
}
function eraseAt(pg, x, y, g) {
  const hit = hitMark(pg, x, y, 3);
  if (!hit) return;
  if (!g.snapped) { snap(pg); g.snapped = true; }
  const a = pg.marks(); a.splice(a.indexOf(hit), 1);
  changed(pg);
}
function deleteSelected() {
  if (!selected) return;
  const pg = selected.page, a = pg.marks(), i = a.indexOf(selected.mark);
  if (i >= 0) { snap(pg); a.splice(i, 1); }
  selected = null; changed(pg);
}

/* ---------------- text on the page ---------------- */
let activeEditor = null;
function editText(pg, m, isNew) {
  commitEditors();
  pg.editing = m; draw(pg);
  const ta = document.createElement('textarea');
  ta.className = 'ed'; ta.value = m.text;
  const s = pg.s;
  Object.assign(ta.style, { left: m.x * s + 'px', top: m.y * s + 'px', fontSize: m.size * s + 'px', color: m.color, width: Math.max(60, (pg.W - m.x - 6) * s) + 'px' });
  const fit = () => { ta.style.height = '0'; ta.style.height = Math.max(m.size * 1.3 * s, ta.scrollHeight) + 'px'; };
  pg.wrap.appendChild(ta); fit(); ta.focus();
  if (!isNew) snap(pg);
  ta.addEventListener('input', fit);
  ta.addEventListener('keydown', e => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); commitEditors(); }
    e.stopPropagation();
  });
  const me = { commit() {
    m.text = ta.value.replace(/\s+$/, '');
    ta.remove(); pg.editing = null;
    if (!m.text) { const a = pg.marks(), i = a.indexOf(m); if (i >= 0) a.splice(i, 1); if (isNew) undoStack.pop(); }
    changed(pg); renderTools();
  } };
  activeEditor = me;
  ta.addEventListener('blur', () => setTimeout(() => { if (activeEditor === me && document.activeElement !== ta) commitEditors(); }, 0));
}

/* ---------------- margin comments ---------------- */
function openNote(pg, m, isNew) {
  commitEditors();
  const pop = document.createElement('div'); pop.className = 'pop';
  const s = pg.s;
  pop.innerHTML =
    '<div class="lbl">' + (isNew ? 'New comment' : 'Comment') + '</div>' +
    '<textarea placeholder="Type a comment…"></textarea>' +
    '<div class="lbl" data-bank>My saved comments</div><div class="chips"></div>' +
    '<div class="row"><button class="btn sm" data-a="star" title="Keep this comment so you can reuse it">☆ Save for reuse</button><span class="sp"></span>' +
    (isNew ? '' : '<button class="btn sm" data-a="del">Delete</button>') +
    '<button class="btn sm primary" data-a="ok">Done</button></div>';
  const ta = pop.querySelector('textarea'); ta.value = m.text;
  const chips = () => {
    pop.querySelector('.chips').innerHTML = bank.map((t, i) => '<span class="chip" data-i="' + i + '"><span title="' + esc(t) + '">' + esc(t) + '</span><button data-x="' + i + '" title="Remove from saved comments" aria-label="Remove">×</button></span>').join('');
    pop.querySelector('[data-bank]').hidden = !bank.length;
  };
  chips();
  // place next to the spot, inside the page frame
  const left = Math.min(Math.max(0, m.ax * s + 12), Math.max(0, (pg.W + pg.side) * s - 300));
  pop.style.left = left + 'px'; pop.style.top = Math.max(0, m.ay * s + 12) + 'px';
  pg.wrap.appendChild(pop);
  ta.focus();
  const close = save => {
    pop.remove(); activeEditor = null;
    const text = ta.value.trim();
    if (!save) return;
    const a = pg.marks(), i = a.indexOf(m);
    if (!text) { if (i >= 0) { snap(pg); a.splice(i, 1); changed(pg); } return; }
    if (text === m.text && i >= 0) return;
    snap(pg); m.text = text; if (i < 0) a.push(m); changed(pg);
  };
  activeEditor = { commit: () => close(true) };
  pop.addEventListener('pointerdown', e => e.stopPropagation());
  pop.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(false); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); close(true); }
  });
  pop.addEventListener('click', e => {
    const x = e.target.closest('[data-x]');
    if (x) { bank.splice(+x.dataset.x, 1); store.set('gs.bank', bank); chips(); return; }
    const ch = e.target.closest('.chip');
    if (ch) { const t = bank[+ch.dataset.i]; ta.value = ta.value.trim() ? ta.value.trim() + ' ' + t : t; ta.focus(); return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'star') {
      const t = ta.value.trim(); if (!t) return;
      if (!bank.includes(t)) { bank.unshift(t); store.set('gs.bank', bank); chips(); toast('Saved. It’ll show up under every new comment.'); }
    }
    if (b.dataset.a === 'ok') close(true);
    if (b.dataset.a === 'del') { ta.value = ''; close(true); }
  });
}
function commitEditors() { if (activeEditor) { const a = activeEditor; activeEditor = null; a.commit(); } }

/* ---------------- toolbar ---------------- */
const IC = {
  select: '<path d="M5 3l14 8-6 2-3 6z"/>',
  pen: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 6l3 3"/>',
  hl: '<path d="M9 15l-3 3h5l1-1"/><path d="M9 15l7-10 4 3-7 10z"/><path d="M4 21h16"/>',
  text: '<path d="M5 6V4h14v2"/><path d="M12 4v16"/><path d="M9 20h6"/>',
  note: '<path d="M4 5h16v11H9l-5 4z"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  oval: '<ellipse cx="12" cy="12" rx="9" ry="6.5"/>',
  erase: '<path d="M8 20h12"/><path d="M4 15l9-9 6 6-7 7H8z"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 0 10h-3"/>',
  minus: '<path d="M5 12h14"/>', plus: '<path d="M5 12h14M12 5v14"/>',
};
const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
const TOOLS = [['select', 'Select', 'V'], ['pen', 'Pen', 'P'], ['hl', 'Highlight', 'H'], ['oval', 'Circle', 'O'], ['text', 'Text', 'T'], ['note', 'Comment', 'C'], ['check', 'Check', 'K'], ['erase', 'Eraser', 'E']];
function renderTools() {
  const isHl = tool === 'hl';
  const sw = isHl ? Object.entries(HL).map(([k, v]) => '<button class="sw" data-hl="' + k + '" style="background:' + v + '" aria-pressed="' + (k === hlColor) + '" title="' + k + '"></button>').join('')
    : Object.entries(COLORS).map(([k, v]) => '<button class="sw" data-ink="' + k + '" style="background:' + v + '" aria-pressed="' + (k === inkColor) + '" title="' + k + '"></button>').join('');
  $('#tools').innerHTML = TOOLS.map(([k, l, key]) => '<button class="tool" data-tool="' + k + '" aria-pressed="' + (tool === k) + '" title="' + l + ' (' + key + ')">' + svg(IC[k]) + '<span class="lb">' + l + '</span></button>').join('') +
    '<span class="sep"></span><span class="swatches">' + (tool === 'select' || tool === 'erase' ? '' : sw) + '</span>' +
    (tool === 'pen' ? '<span class="seg" style="margin-left:4px"><button data-w="1.2" aria-pressed="' + (penW === 1.2) + '">Fine</button><button data-w="2" aria-pressed="' + (penW === 2) + '">Medium</button><button data-w="3.5" aria-pressed="' + (penW === 3.5) + '">Bold</button></span>' : '') +
    '<button class="icon" id="undoBtn" title="Undo (⌘Z)" aria-label="Undo" ' + (undoStack.length ? '' : 'disabled') + '>' + svg(IC.undo) + '</button>' +
    '<span class="zoom"><button class="icon" data-z="-1" aria-label="Zoom out">' + svg(IC.minus) + '</button><span>' + Math.round(zoom * 100) + '%</span><button class="icon" data-z="1" aria-label="Zoom in">' + svg(IC.plus) + '</button></span>';
  for (const pg of pages) pg.canvas.style.cursor = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';
}
$('#tools').addEventListener('click', e => {
  const t = e.target.closest('[data-tool]'); if (t) { setTool(t.dataset.tool); return; }
  const i = e.target.closest('[data-ink]'); if (i) { inkColor = i.dataset.ink; store.set('gs.ink', inkColor); recolorSelected(COLORS[inkColor]); renderTools(); return; }
  const h = e.target.closest('[data-hl]'); if (h) { hlColor = h.dataset.hl; store.set('gs.hl', hlColor); renderTools(); return; }
  const w = e.target.closest('[data-w]'); if (w) { penW = +w.dataset.w; store.set('gs.penW', penW); renderTools(); return; }
  if (e.target.closest('#undoBtn')) { undo(); return; }
  const z = e.target.closest('[data-z]');
  if (z) { zoom = clamp(Math.round((zoom + (+z.dataset.z) * 0.15) * 100) / 100, 0.5, 2.5); renderTools(); pages.forEach(renderPage); }
});
function setTool(t) { commitEditors(); tool = t; if (t !== 'select') { selected = null; redrawAll(); } renderTools(); }
function recolorSelected(col) {
  if (!selected || selected.mark.t === 'hl') return;
  snap(selected.page); selected.mark.color = col; changed(selected.page);
}

/* ---------------- student list ---------------- */
// Counts as marked: marks made here, marks already on the file (Kami), a grade found in its text, or a grade boxed by hand.
const fileMarked = f => viewable(f) && (Object.values(f.marks).some(a => a.length) || (f.kami && Object.keys(f.kami).length > 0) || !!(f.scan && f.scan.found && f.scan.found.length) || !!f.hand);
function hasMarks(st) { return st.files.some(fileMarked); }
function renderList() {
  if (!batch) return;
  $('#stuList').innerHTML = batch.students.map((st, i) => {
    const g = gradeOf(st);
    const val = g.total != null ? g.total : g.pct != null ? g.pct + '%' : null;
    const right = val != null ? '<span class="sc" title="' + (g.paper ? 'Read from the paper' : g.done ? 'Scored' : 'Partly scored') + '"' + (g.paper ? ' style="color:var(--muted);font-weight:600"' : g.done ? '' : ' style="color:var(--warn)"') + '>' + fmtNum(g.total != null ? g.total : g.pct) + (g.total == null ? '%' : '') + '</span>'
      : st.foundCount > 1 ? '<span class="sc" style="color:var(--warn)" title="More than one grade found on the paper. Check the Grade sheet.">?</span>'
      : hasMarks(st) ? '<span class="dot" title="Marked"></span>' : '';
    return '<button class="stu' + (i === cur ? ' on' : '') + (st.files.length ? '' : ' empty') + '" data-i="' + i + '"><span class="num">' + (i + 1) + '</span><span class="nm" title="' + esc(st.key) + '">' + esc(st.key) + '</span>' + right + '</button>';
  }).join('');
  const on = $('#stuList .on'); if (on) on.scrollIntoView({ block: 'nearest' });
  const nExp = batch.students.reduce((a, st) => a + st.files.filter(fileMarked).length, 0);
  $('#exportBtn').textContent = 'Export marked' + (nExp ? ' (' + nExp + ')' : '');
}
$('#stuList').addEventListener('click', e => { const b = e.target.closest('.stu'); if (b) openStudent(+b.dataset.i); });

/* ---------------- grade panel ---------------- */
function renderGrade() {
  const st = batch.students[cur], g = st.grade, gr = gradeOf(st);
  let h = '';
  if (setup.mode === 'rubric') {
    h += '<h3>Rubric <button class="link" id="editRubric" style="font-size:12px;text-transform:none;letter-spacing:0">Edit</button></h3>';
    h += setup.criteria.map((c, i) => '<div class="crit"><div class="cn">' + esc(c) + '</div><div class="scores" data-c="' + i + '">' +
      RUBRIC_STEPS.map(v => '<button class="' + (v % 1 ? 'half' : '') + '" data-v="' + v + '" aria-pressed="' + (g.rubric[i] === v) + '">' + v + '</button>').join('') + '</div></div>').join('');
  } else {
    h += '<h3>Score <button class="link" id="editRubric" style="font-size:12px;text-transform:none;letter-spacing:0">Edit</button></h3>' +
      '<div class="pts"><input type="number" step="0.5" min="0" id="ptsIn" value="' + esc(g.points) + '" aria-label="Points"><span class="muted">out of ' + esc(setup.outOf) + '</span></div>';
  }
  h += '<div class="total"><b>' + (gr.total == null ? '–' : fmtNum(gr.total)) + '</b><span>/ ' + maxPoints() + '</span><span>' + (gr.pct == null ? '' : '= ' + fmtPct(gr.pct)) + '</span></div>';
  h += '<div class="cmt"><h3 style="margin-bottom:6px">Comment for ManageBac</h3><textarea id="cmtIn" placeholder="Optional. Shows in the Grades list so you can copy it.">' + esc(g.comment) + '</textarea></div>';
  { const rd = store.get(refKey(), null); h += '<div class="refl">' + (rd ? 'Beside every paper: <b>' + esc(rd.name) + '</b> <button class="link" data-refdoc>Change</button> · <button class="link" data-refdel>Remove</button>' : '<button class="link" data-refdoc>Keep a Word doc beside every paper…</button>') + '</div>'; }
  h += '<div class="nav"><button class="btn" id="prevBtn" ' + (cur ? '' : 'disabled') + '>◀ Previous</button><button class="btn primary" id="nextBtn" ' + (cur < batch.students.length - 1 ? '' : 'disabled') + '>Next ▶</button></div>';
  h += '<div class="hint">Keys: ← → students · V P H O T C K E tools · Space play · J L back/ahead 5s · ⌘Z undo · Delete removes the selected mark</div>';
  $('#grade').innerHTML = h;
}
$('#grade').addEventListener('click', e => {
  const b = e.target.closest('.scores button');
  if (b) {
    const st = batch.students[cur], i = +b.closest('.scores').dataset.c, v = +b.dataset.v;
    st.grade.rubric[i] = st.grade.rubric[i] === v ? null : v;
    renderGrade(); renderList(); saveSoon(); return;
  }
  if (e.target.closest('#prevBtn')) openStudent(cur - 1);
  if (e.target.closest('#nextBtn')) openStudent(cur + 1);
  if (e.target.closest('#editRubric')) openSetup();
  if (e.target.closest('[data-refdoc]')) pickRefDoc();
  if (e.target.closest('[data-refdel]')) { store.del(refKey()); renderGrade(); openStudent(cur); }
});
$('#grade').addEventListener('input', e => {
  const st = batch.students[cur];
  if (e.target.id === 'cmtIn') { st.grade.comment = e.target.value; saveSoon(); }
  if (e.target.id === 'ptsIn') {
    st.grade.points = e.target.value; saveSoon(); renderList();
    const gr = gradeOf(st);
    $('#grade .total').innerHTML = '<b>' + (gr.total == null ? '–' : fmtNum(gr.total)) + '</b><span>/ ' + maxPoints() + '</span><span>' + (gr.pct == null ? '' : '= ' + fmtPct(gr.pct)) + '</span>';
  }
});

/* ---------------- dialogs ---------------- */
function openDlg(html, narrow) {
  commitEditors();
  $('#dlgBox').className = 'box' + (narrow ? ' narrow' : '');
  $('#dlgBox').innerHTML = html; $('#dlg').hidden = false;
}
function closeDlg() { if (eachKeys) { document.removeEventListener('keydown', eachKeys, true); eachKeys = null; } $('#dlg').hidden = true; $('#dlgBox').innerHTML = ''; }
$('#dlg').addEventListener('pointerdown', e => { if (e.target.id === 'dlg') closeDlg(); });

function openSetup() {
  let draft = JSON.parse(JSON.stringify(setup));
  let newPage = undefined;   // undefined: unchanged, null: removed, {bytes,name}: new upload
  const scaleRows = () => {
    const max = draft.mode === 'rubric' ? draft.criteria.length * 4 : Math.round(+draft.outOf || 0);
    if (!draft.scale) return '<p class="muted" style="font-size:13px;margin:4px 0 0">No scale: percent is the plain share of points.</p>';
    if (max > 40) return '<p class="muted" style="font-size:13px">A scale needs a total of 40 or less.</p>';
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px;margin-top:6px">';
    for (let k = max; k >= 0; k--) h += '<label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600"><span style="width:22px;text-align:right">' + k + '</span>=<input type="number" step="0.5" data-sk="' + k + '" value="' + esc(draft.scale[k] == null ? '' : draft.scale[k]) + '" style="width:54px;border:1px solid var(--line-strong);border-radius:6px;padding:4px;background:var(--surface)">%</label>';
    return h + '</div><p class="muted" style="font-size:12.5px;margin:6px 0 0">Leave a row blank if you never use it. Half points land between two rows.</p>';
  };
  const body = () => {
    let h = '<div class="field"><label>How do you score this one?</label><span class="seg"><button data-m="rubric" aria-pressed="' + (draft.mode === 'rubric') + '">Rubric, 4 to 1 per row</button><button data-m="points" aria-pressed="' + (draft.mode === 'points') + '">Plain points</button></span></div>';
    if (draft.mode === 'rubric') {
      h += '<div class="field"><label>Rubric rows</label>' + draft.criteria.map((c, i) => '<div class="critrow"><input type="text" data-ci="' + i + '" value="' + esc(c) + '">' + (draft.criteria.length > 1 ? '<button class="btn sm" data-rm="' + i + '" aria-label="Remove row">×</button>' : '') + '</div>').join('') +
        (draft.criteria.length < 6 ? '<div><button class="btn sm" data-add>+ Add a row</button></div>' : '') + '</div>';
    } else {
      h += '<div class="field"><label for="outOf">Out of</label><input type="number" id="outOf" min="1" step="0.5" value="' + esc(draft.outOf) + '" style="width:120px"></div>';
    }
    h += '<div class="field"><label>Grading scale</label><span style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-preset="usual">12 = 100, 11 = 95, 10 = 91…</button><button class="btn sm" data-preset="fives">Steps of 5 (9 = 85%)</button><button class="btn sm" data-preset="none">No scale</button></span>' + scaleRows() + '</div>';
    const rp = newPage === undefined ? draft.rubricPage : newPage;
    h += '<div class="field"><label>Rubric page for every student</label><span class="muted" style="font-size:13px">Upload your blank rubric (PDF or picture) and it’s added to each student’s paper, so you can circle and type on it. It goes back with their file.</span>' +
      '<span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px"><button class="btn sm" data-rpup>' + (rp ? 'Replace…' : 'Upload rubric page…') + '</button>' +
      (rp ? '<span style="font-size:13px;font-weight:600">' + esc(rp.name || 'Rubric page') + '</span><span class="seg"><button data-pos="end" aria-pressed="' + ((draft.rubricPos || 'end') === 'end') + '">After their work</button><button data-pos="start" aria-pressed="' + (draft.rubricPos === 'start') + '">Before</button></span><button class="link" data-rprm>Remove</button>' : '') +
      '</span><input type="file" id="rpIn" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" hidden></div>';
    h += '<p class="muted" style="font-size:13px;margin:0">Scores you already gave stay put if you rename rows.' + (batch && batch.assignment ? ' This setup is remembered for “' + esc(batch.assignment.name) + '”.' : '') + '</p>';
    return h;
  };
  openDlg('<div class="bh"><h2>Rubric setup</h2></div><div class="bb" id="setupBody">' + body() + '</div><div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-save>Save</button></div>', true);
  const box = $('#dlgBox'), re = () => { $('#setupBody').innerHTML = body(); };
  box.addEventListener('input', e => {
    if (e.target.dataset.ci != null) draft.criteria[+e.target.dataset.ci] = e.target.value;
    if (e.target.id === 'outOf') draft.outOf = e.target.value;
    if (e.target.dataset.sk != null && draft.scale) { const v = e.target.value; if (v === '') delete draft.scale[e.target.dataset.sk]; else draft.scale[e.target.dataset.sk] = +v; }
  });
  box.addEventListener('change', async e => {
    if (e.target.id !== 'rpIn' || !e.target.files[0]) return;
    const f = e.target.files[0], bytes = new Uint8Array(await f.arrayBuffer());
    try {
      const pdf = isImg(f.name) ? await imageToPdf(bytes, f.name) : bytes;
      await PDFLib.PDFDocument.load(pdf, { ignoreEncryption: true });
      newPage = { bytes: pdf, name: f.name }; re();
    } catch { toast('That file couldn’t be opened as a PDF or picture'); }
  });
  box.addEventListener('click', e => {
    const m = e.target.closest('[data-m]'); if (m) { draft.mode = m.dataset.m; return re(); }
    const rm = e.target.closest('[data-rm]'); if (rm) { draft.criteria.splice(+rm.dataset.rm, 1); return re(); }
    if (e.target.closest('[data-add]')) { draft.criteria.push('Criterion ' + (draft.criteria.length + 1)); return re(); }
    const pr = e.target.closest('[data-preset]');
    if (pr) {
      const max = draft.mode === 'rubric' ? draft.criteria.length * 4 : Math.round(+draft.outOf || 0);
      if (pr.dataset.preset === 'none') draft.scale = null;
      else if (max === 12) draft.scale = { ...(pr.dataset.preset === 'usual' ? SCALE12 : SCALE_FIVES) };
      else { draft.scale = {}; for (let k = max; k >= 0; k--) draft.scale[k] = Math.round((pr.dataset.preset === 'fives' ? 100 - (max - k) * 5 : k / max * 100) * 10) / 10; }
      return re();
    }
    const pos = e.target.closest('[data-pos]'); if (pos) { draft.rubricPos = pos.dataset.pos; return re(); }
    if (e.target.closest('[data-rpup]')) return $('#rpIn').click();
    if (e.target.closest('[data-rprm]')) { newPage = null; return re(); }
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target.closest('[data-save]')) {
      draft.criteria = draft.criteria.map((c, i) => c.trim() || 'Criterion ' + (i + 1));
      if (newPage === null) { if (draft.rubricPage) store.del('gs.rp.' + draft.rubricPage.id); draft.rubricPage = null; }
      else if (newPage) {
        const id = uid();
        let bin = ''; for (let i = 0; i < newPage.bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, newPage.bytes.subarray(i, i + 0x8000));
        if (!store.set('gs.rp.' + id, btoa(bin))) { toast('That rubric file is too big to keep. Try a smaller PDF or a screenshot.'); return; }
        if (draft.rubricPage) store.del('gs.rp.' + draft.rubricPage.id);
        draft.rubricPage = { id, name: newPage.name };
      }
      const pageChanged = JSON.stringify(draft.rubricPage) !== JSON.stringify(setup.rubricPage) || draft.rubricPos !== setup.rubricPos;
      setup = draft; store.set('gs.setup', { ...setup, spot: undefined, rubricPage: undefined });
      if (batch && batch.assignment) { batch.assignment.setup = { ...setup, spot: undefined }; saveLib(); }
      closeDlg(); renderGrade(); renderList(); saveSoon();
      if (pageChanged && batch) applyRubricPage().then(() => { scanned = false; openStudent(cur); scanAll(); });
    }
  });
}
// The rubric page is added to every student as a file of its own ("Rubric page"), placed inside their first file.
const RUBRIC_NAME = 'Rubric page.pdf';
const rubricBytes = () => { const rp = setup.rubricPage; if (!rp) return null; const b64 = store.get('gs.rp.' + rp.id, null); if (!b64) return null; const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
async function applyRubricPage() {
  const bytes = rubricBytes();
  let n = 0;
  if (bytes) { try { n = (await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount(); } catch {} }
  for (const st of batch.students) {
    const old = st.files.find(f => f.virtual);
    st.files = st.files.filter(f => !f.virtual);
    const real = st.files.filter(viewable);
    if (st.layout) for (const d of st.layout) d.pages = d.pages.filter(([path]) => !old || path !== old.path);
    if (!bytes || !n || !real.length) continue;
    const dir = real[0].path.includes('/') ? real[0].path.slice(0, real[0].path.lastIndexOf('/') + 1) : st.key + '/';
    const f = { path: dir + RUBRIC_NAME, name: 'Rubric page', kind: 'pdf', data: bytes, size: bytes.length, marks: old && old.path === dir + RUBRIC_NAME ? old.marks : {}, hand: old && old.hand, virtual: true, numPages: n };
    st.files.push(f);
    if (st.layout && st.layout.length) {
      const pg = [...Array(n).keys()].map(p => [f.path, p]);
      st.layout[0].pages = setup.rubricPos === 'start' ? pg.concat(st.layout[0].pages) : st.layout[0].pages.concat(pg);
    }
  }
}
let gradesOrder = 'folder';
// Rows in folder order, or in roster order with gaps for students who turned nothing in.
function gradeRows() {
  const c = batchClass();
  if (gradesOrder !== 'roster' || !c || !c.names.length) return batch.students.map((st, i) => ({ st, i }));
  const m = rosterMatch(c.names), used = new Set(m.values());
  return c.names.map(n => m.has(n) ? { st: m.get(n), i: batch.students.indexOf(m.get(n)), rn: n } : { missing: n })
    .concat(batch.students.filter(st => !used.has(st)).map(st => ({ st, i: batch.students.indexOf(st), off: true })));
}
function openGrades() {
  const rub = setup.mode === 'rubric', c = batchClass();
  const rows = gradeRows().map(({ st, i, missing, off }, k) => {
    if (missing) return '<tr><td class="n">' + (k + 1) + '</td><td class="nm" style="cursor:default">' + esc(missing) + ' <span class="muted" style="font-weight:400">(no folder: nothing turned in)</span></td>' + (rub ? setup.criteria.map(() => '<td></td>').join('') : '') + '<td></td><td></td><td></td></tr>';
    const g = gradeOf(st);
    const cells = rub ? setup.criteria.map((_, q) => '<td class="c" data-copy="' + fmtNum(st.grade.rubric[q]) + '">' + fmtNum(st.grade.rubric[q]) + '</td>').join('') : '';
    return '<tr class="go" data-i="' + i + '"><td class="n">' + (k + 1) + '</td><td class="nm">' + esc(st.key) + (st.files.length ? '' : ' <span class="muted" style="font-weight:400">(nothing turned in)</span>') + (off ? ' <span class="pill" style="font-size:11px;padding:2px 7px;border-radius:999px;background:var(--warn-soft);color:var(--warn)">not on roster</span>' : '') + '</td>' + cells +
      '<td class="c" data-copy="' + fmtNum(g.total) + '">' + fmtNum(g.total) + (g.paper ? ' <span class="muted" style="font-weight:400;font-size:12px" title="Read from the paper">(paper)</span>' : '') + '</td><td class="c" data-copy="' + fmtNum(g.pct) + '">' + fmtPct(g.pct) + '</td>' +
      '<td class="cm" data-copy="' + esc(st.grade.comment) + '">' + esc(st.grade.comment) + '</td></tr>';
  }).join('');
  const done = batch.students.filter(s => gradeOf(s).done).length;
  openDlg('<div class="bh"><h2>Grades list</h2><span class="muted">' + done + ' of ' + batch.students.length + ' scored</span>' +
    (c ? '<span class="seg" style="margin-left:8px"><button data-ord="folder" aria-pressed="' + (gradesOrder === 'folder') + '">Folder order</button><button data-ord="roster" aria-pressed="' + (gradesOrder === 'roster') + '">' + esc(c.name) + ' roster order</button></span>' : '') +
    '<button class="icon" data-close aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb"><p class="muted" style="margin:0 0 10px;font-size:14px">Click any score or comment to copy it, then paste it into ManageBac. Click a name to open that paper.' + (c ? '' : ' Pick a roster at the top of the screen to see this list in roster order.') + '</p>' +
    '<table class="gl"><thead><tr><th>#</th><th>Student</th>' + (rub ? setup.criteria.map(x => '<th>' + esc(x) + '</th>').join('') : '') + '<th>Total /' + maxPoints() + '</th><th>%</th><th>Comment</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="bf"><button class="btn" data-cp="total">Copy all totals</button><button class="btn" data-cp="pct">Copy all percents</button><button class="btn" data-cp="tsv">Copy as a table</button><button class="btn primary" data-csv>Download spreadsheet (CSV)</button></div>');
  const box = $('#dlgBox');
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    const o = e.target.closest('[data-ord]'); if (o) { gradesOrder = o.dataset.ord; return openGrades(); }
    const cc = e.target.closest('[data-copy]');
    if (cc) { copy(cc.dataset.copy, cc.dataset.copy ? 'Copied “' + (cc.dataset.copy.length > 40 ? cc.dataset.copy.slice(0, 40) + '…' : cc.dataset.copy) + '”' : 'That cell is empty'); return; }
    const nm = e.target.closest('tr.go td.nm');
    if (nm) { closeDlg(); openStudent(+nm.parentElement.dataset.i); return; }
    const cp = e.target.closest('[data-cp]');
    if (cp) {
      const k = cp.dataset.cp, R = gradeRows();
      const lines = R.map(r => { if (r.missing) return k === 'tsv' ? [String(R.indexOf(r) + 1), r.missing].join('\t') : ''; const g = gradeOf(r.st); return k === 'total' ? fmtNum(g.total) : k === 'pct' ? fmtNum(g.pct) : tableRow(r.st, R.indexOf(r)).join('\t'); });
      if (k === 'tsv') lines.unshift(tableHead().join('\t'));
      copy(lines.join('\n'), 'Copied ' + R.length + ' rows in ' + (gradesOrder === 'roster' && c ? 'roster' : 'folder') + ' order');
    }
    if (e.target.closest('[data-csv]')) {
      const q = v => /[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v, R = gradeRows();
      const csv = [tableHead()].concat(R.map((r, k) => r.missing ? [String(k + 1), r.missing] : tableRow(r.st, k))).map(r => r.map(q).join(',')).join('\r\n');
      saveBlob('Grades - ' + batch.name + '.csv', new Blob(['﻿' + csv], { type: 'text/csv' }));
    }
  };
}
function tableHead() { return ['#', 'Student'].concat(setup.mode === 'rubric' ? setup.criteria : [], ['Total / ' + maxPoints(), 'Percent', 'Comment']); }
function tableRow(st, pos) {
  const g = gradeOf(st), i = pos != null ? pos : batch.students.indexOf(st);
  return [String(i + 1), st.key].concat(setup.mode === 'rubric' ? setup.criteria.map((_, k) => fmtNum(st.grade.rubric[k])) : [], [fmtNum(g.total), fmtNum(g.pct), st.grade.comment.replace(/\s*\n\s*/g, ' ')]);
}
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch {} t.remove();
  }
  toast(msg);
}

/* ---------------- export ---------------- */
function exportPlan(keepFolders) {
  const out = [];
  for (const st of batch.students) for (const d of layoutOf(st)) {
    if (!docIn(st, d) || !docMarked(st, d)) continue;
    const first = d.pages[0][0], dir = first.includes('/') ? first.slice(0, first.lastIndexOf('/') + 1) : '';
    let path = dir + d.name.replace(/\.(png|jpe?g)$/i, '.pdf');
    if (!/\.pdf$/i.test(path)) path += '.pdf';
    if (!keepFolders) path = (dir ? st.key + ' - ' : '') + path.split('/').pop();
    out.push({ st, d, path: path.replace(/[\\:*?"<>|]+/g, '-') });
  }
  const used = new Set();
  for (const o of out) { let p = o.path, k = 2; while (used.has(p.toLowerCase())) p = o.path.replace(/(\.pdf)?$/i, ' (' + k++ + ').pdf'); used.add(p.toLowerCase()); o.path = p; }
  return out;
}
// Builds one returned file from its pages (possibly from several turned-in files), baking in every mark.
async function flattenDoc(st, d, dpi) {
  await workerReady;
  const srcs = new Map();
  const src = async path => {
    if (!srcs.has(path)) {
      const f = fileByPath(st, path);
      srcs.set(path, { f, js: await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise, lib: await PDFLib.PDFDocument.load(f.data, { ignoreEncryption: true, updateMetadata: false }) });
    }
    return srcs.get(path);
  };
  const out = await PDFLib.PDFDocument.create();
  try {
    for (const [path, p] of d.pages) {
      const { f, js, lib } = await src(path);
      const marks = (f.marks[p] || []).concat((f.kami && f.kami[p] && f.kami[p].notes) || []);
      if (!marks.length && !(f.kami && f.kami[p])) { const [cp] = await out.copyPages(lib, [p]); out.addPage(cp); continue; }
      const page = await js.getPage(p + 1);
      const vp1 = page.getViewport({ scale: 1 }), W = vp1.width, H = vp1.height;
      const side = marks.some(m => m.t === 'note') ? sideFor(W) : 0;
      const scale = dpi / 72;
      const c = document.createElement('canvas');
      c.width = Math.ceil((W + side) * scale); c.height = Math.ceil(H * scale);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale }), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawMarks(ctx, marks, W, H, side, null);
      const jpg = await new Promise(res => c.toBlob(b => b.arrayBuffer().then(x => res(new Uint8Array(x))), 'image/jpeg', 0.88));
      const img = await out.embedJpg(jpg);
      out.addPage([W + side, H]).drawImage(img, { x: 0, y: 0, width: W + side, height: H });
      c.width = c.height = 0; page.cleanup();
    }
  } finally { for (const v of srcs.values()) v.js.destroy(); }
  return await out.save();
}
async function openExport() {
  saveNow(); commitEditors();
  if (!scanned || scanP) { toast('Reading the files first…'); await scanAll(); }
  let keep = true, dpi = 150;
  const plan = exportPlan(true);
  const nStu = new Set(plan.map(o => o.st)).size, skipped = batch.students.length - nStu;
  const nLeft = batch.students.reduce((a, st) => a + layoutOf(st).filter(d => !docIn(st, d)).length, 0);
  openDlg('<div class="bh"><h2>Export marked files</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb">' +
    (plan.length ? '<p style="margin-top:0"><b>' + plan.length + (plan.length === 1 ? ' marked file' : ' marked files') + '</b> from ' + nStu + (nStu === 1 ? ' student' : ' students') + ', in their own folders, ready to upload back on ManageBac.' +
      (skipped ? ' <span class="muted">' + skipped + ' ' + (skipped === 1 ? 'student has' : 'students have') + ' nothing marked, so they’re not in it.</span>' : '') +
      (nLeft ? ' <span class="muted">' + nLeft + (nLeft === 1 ? ' file is' : ' files are') + ' left out (no marks, or you left it out).</span>' : '') + '</p>' +
      '<label class="chk"><input type="checkbox" id="xKeep" checked> Keep student folders</label>' +
      '<label class="chk"><input type="checkbox" id="xSheet" checked> Add the grade sheet (a crop of each typed grade, in folder order)</label>' +
      '<div class="chk" style="cursor:default">Sharpness <span class="seg" id="xDpi"><button data-dpi="150" aria-pressed="true">Standard</button><button data-dpi="220" aria-pressed="false">Extra sharp</button></span></div>' +
      '<p class="muted" style="font-size:13px;margin-bottom:0">Your original files aren’t changed. Grades are read and cropped first, then every marked file is flattened, including marks made in Kami. Pages with no marks are copied as they are, and comments go in a right-hand margin.</p><div class="prog" hidden><i></i></div><p class="muted" id="xStatus" style="font-size:13px"></p>'
      : '<p style="margin-top:0">Nothing is marked yet. Mark a paper and it will show up here.</p>') +
    '</div><div class="bf"><button class="btn" data-close>Close</button>' + (plan.length ? ((window.showDirectoryPicker && window.self === window.top) ? '<button class="btn" data-go="dir">Save into a folder…</button>' : '') + (G.email ? '<button class="btn" data-go="drive">Save to Google Drive</button>' : '') + '<button class="btn primary" data-go="zip">Download ZIP</button>' : '') + '</div>', true);
  const box = $('#dlgBox');
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    const d = e.target.closest('[data-dpi]');
    if (d) { dpi = +d.dataset.dpi; for (const x of $('#xDpi').children) x.setAttribute('aria-pressed', x === d); return; }
    const go = e.target.closest('[data-go]'); if (!go) return;
    keep = $('#xKeep').checked;
    const withSheet = $('#xSheet').checked;
    let dir = null;
    if (go.dataset.go === 'dir') {
      try { dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'grading-studio' }); }
      catch (er) { if (er && er.name !== 'AbortError') toast('This browser didn’t allow saving to a folder. Use Download ZIP.'); return; }
    }
    for (const b of box.querySelectorAll('[data-go]')) b.disabled = true;
    const bar = box.querySelector('.prog'); bar.hidden = false;
    const files = {};
    let items = [];
    try {
      // Grades are read and cropped first, from the files as they are now; then everything is flattened.
      $('#xStatus').textContent = 'Reading the grades…';
      await scanAll((n, t) => { bar.firstChild.style.width = (30 * n / t) + '%'; });
      items = exportPlan(keep);
      if (withSheet) {
        const name = ('Grade sheet - ' + batch.name + '.pdf').replace(/[\\/:*?"<>|]+/g, '-');
        const bytes = await buildSheetPdf();
        if (dir) { const w = await (await dir.getFileHandle(name, { create: true })).createWritable(); await w.write(bytes); await w.close(); }
        else files[name] = [bytes, { level: 0 }];
      }
      for (let i = 0; i < items.length; i++) {
        $('#xStatus').textContent = 'Baking in marks ' + (i + 1) + ' of ' + items.length + '…';
        bar.firstChild.style.width = (30 + 70 * i / items.length) + '%';
        const bytes = await flattenDoc(items[i].st, items[i].d, dpi);
        if (dir) {
          const parts = items[i].path.split('/'); let h = dir;
          for (const part of parts.slice(0, -1)) h = await h.getDirectoryHandle(part, { create: true });
          const w = await (await h.getFileHandle(parts[parts.length - 1], { create: true })).createWritable(); await w.write(bytes); await w.close();
        } else files[items[i].path] = [bytes, { level: 0 }];
      }
      bar.firstChild.style.width = '100%';
      if (go.dataset.go === 'drive') {
        const plain = {}; for (const [k, v] of Object.entries(files)) plain[k] = v[0];
        const fname = 'Marked - ' + batch.name;
        await saveToDrive(fname, plain, (n, t) => { $('#xStatus').textContent = 'Saving to Google Drive ' + n + ' of ' + t + '…'; });
        $('#xStatus').textContent = 'Done. Saved to Google Drive in “' + fname + '”' + (batch.drive && batch.drive.kind === 'folder' ? ', inside the folder you opened.' : batch.drive ? ', next to the ZIP you opened.' : ', in My Drive.');
      } else {
        if (!dir) saveBlob('Marked - ' + batch.name + '.zip', new Blob([fflate.zipSync(files)], { type: 'application/zip' }));
        $('#xStatus').textContent = 'Done. ' + items.length + (items.length === 1 ? ' file' : ' files') + (dir ? ' saved into “' + dir.name + '”.' : ' in the ZIP.');
      }
    } catch (er) {
      console.error(er); $('#xStatus').textContent = 'Something went wrong: ' + (er.message || er);
    }
    for (const b of box.querySelectorAll('[data-go]')) b.disabled = false;
  };
}
// Inside a published claude.ai page, files are offered through its downloads prompt; as a local file, a normal download.
const downloadsP = window.claude && typeof window.claude.use === 'function' ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
async function saveBlob(name, blob) {
  name = name.replace(/[\\/:*?"<>|]+/g, '-');
  const dl = await downloadsP;
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); return; }
    catch (e) { if (e && e.code === 'declined') return; if (e && e.code === 'rate_limited') { toast('One moment, then try again'); return; } }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name.replace(/[\\/:*?"<>|]+/g, '-');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

/* ---------------- grade sheet: find the grade typed on each paper and crop it ---------------- */
// Looks for what Taylor types on a paper, like "9.5 = 88%", "9.5/12 = 88%", "10/12" or "88%".
// Typed comments (Kami text boxes, sticky notes) are checked first, then the page's own text.
const NUM = '(\\d{1,3}(?:[.,]\\d{1,2})?)';
const RX_FULL = new RegExp(NUM + '\\s*(?:(?:\\/|out of|of)\\s*' + NUM + ')?\\s*(?:=|:|→|->|–|—|-|\\(|,)\\s*' + NUM + '\\s*%');
const RX_OUTOF = new RegExp(NUM + '\\s*(?:\\/|out of)\\s*' + NUM + '(?![\\d/])', 'i');
const RX_PCT_ANY = new RegExp(NUM + '\\s*%');
const RX_OUT = new RegExp(NUM + '\\s*\\/\\s*' + NUM + '(?![\\d/])');
const RX_PCT = new RegExp('^\\s*' + NUM + '\\s*%\\s*$');
const num = v => v == null ? null : +String(v).replace(',', '.');
function parseGrade(str, strict) {
  let m = RX_FULL.exec(str);
  if (m) return { rank: 3, score: num(m[1]), outOf: num(m[2]), pct: num(m[3]), at: m.index, len: m[0].length };
  if (strict) return null;
  m = RX_OUTOF.exec(str);
  if (m && num(m[1]) <= num(m[2]) && num(m[2]) <= 200) return { rank: 2, score: num(m[1]), outOf: num(m[2]), pct: null, at: m.index, len: m[0].length };
  m = RX_PCT.exec(str) || RX_PCT_ANY.exec(str);
  if (m && num(m[1]) <= 110) return { rank: 1, score: null, outOf: null, pct: num(m[1]), at: m.index, len: m[0].length };
  m = /^\s*(\d{1,2}(?:[.,]\d)?)\s*$/.exec(str);   // a text box with only a number, like "9.5"
  if (m) return { rank: 0.5, score: num(m[1]), outOf: null, pct: null, at: m.index, len: m[0].length };
  return null;
}
const annText = a => {
  const sq = t => String(t || '').replace(/\s+/g, ' ').trim();
  const c = sq((a.contentsObj && a.contentsObj.str) || a.contents) || sq(a.richText && a.richText.str), t = sq(Array.isArray(a.textContent) ? a.textContent.join(' ') : '');
  return !t || t === c ? c : !c ? t : c + ' ' + t;
};
const inside = (r, s) => !s || (r[0] < s.x + s.w && r[2] > s.x && r[1] < s.y + s.h && r[3] > s.y);
// Reads one file: Kami (or other) marks already on it, and every grade typed on it, each with a cropped picture.
// Never changes the file itself.
async function scanFile(f, spot) {
  const doc = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
  const found = [], kami = {}, seen = [];
  try {
    f.numPages = doc.numPages;
    const pick = spot ? [typeof spot.page === 'number' ? Math.min(spot.page, doc.numPages - 1) : spot.page === 'last' ? doc.numPages - 1 : 0] : [...Array(doc.numPages).keys()];
    for (let p = 0; p < doc.numPages; p++) {
      const page = await doc.getPage(p + 1);
      const vp = page.getViewport({ scale: 1 });
      const annots = (await page.getAnnotations({ intent: 'display' })).filter(a => !SKIP_TYPES.has(a.subtype) && !(a.annotationFlags & 2) && !(a.annotationFlags & 32));
      if (annots.length) kami[p] = { notes: annots.filter(isPopupComment).map(a => kamiNote(a, vp)) };
      if (!pick.includes(p)) { page.cleanup(); continue; }
      const area = spot ? { x: spot.x * vp.width, y: spot.y * vp.height, w: spot.w * vp.width, h: spot.h * vp.height } : null;
      const add = (g, rect, from, text, hover) => {
        if (!g) return;
        const r = [Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3])];
        if (!inside(r, area)) return;
        // the same grade at the same place counts once
        if (found.some(o => o.page === p && o.score === g.score && o.pct === g.pct && Math.abs(o.rect[0] - r[0]) < 20 && Math.abs(o.rect[1] - r[1]) < 20)) return;
        found.push({ ...g, page: p, rect: r, from, hover: !!hover, full: text, text: text.length > 140 ? text.slice(0, 140) + '…' : text });
      };
      for (const a of annots) { const t = annText(a); if (t && seen.length < 4) seen.push(t.length > 60 ? t.slice(0, 60) + '…' : t); if (t) add(parseGrade(t, false), vp.convertToViewportRectangle(a.rect), 'note', t, isPopupComment(a)); }
      for (const m of f.marks[p] || []) {
        if (m.t === 'text') { const L = textLayout(m, vp.width); add(parseGrade(m.text, false), [m.x, m.y, m.x + L.w, m.y + L.h], 'note', m.text); }
        if (m.t === 'note') add(parseGrade(m.text, false), [m.ax - 4, m.ay - 4, m.ax + 4, m.ay + 4], 'note', m.text, true);
      }
      // text in the page itself (already flattened files): strict "9.5 = 88%" form only, so essay numbers don't count
      const tc = await page.getTextContent();
      let str = '';
      const spans = [];
      for (const it of tc.items) {
        if (!it.str) { if (it.hasEOL) str += ' '; continue; }
        const [, , , d, e, fy] = it.transform;
        spans.push({ a: str.length, b: str.length + it.str.length, r: vp.convertToViewportRectangle([e, fy, e + it.width, fy + (it.height || Math.abs(d))]) });
        str += it.str + (it.hasEOL ? ' ' : '');
      }
      const re = new RegExp(RX_FULL.source, 'g');
      let m;
      while ((m = re.exec(str))) {
        const g = parseGrade(m[0], true); if (!g) continue;
        const hit = spans.filter(s => s.b > m.index && s.a < m.index + m[0].length);
        if (!hit.length) continue;
        const xs = hit.flatMap(s => [s.r[0], s.r[2]]), ys = hit.flatMap(s => [s.r[1], s.r[3]]);
        add(g, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], 'text', m[0]);
      }
      page.cleanup();
    }
    // pictures: one per grade found, or just the picked spot when nothing was read there
    const shots = found.length ? found : spot ? [{ page: pick[0], rect: null, none: true }] : [];
    for (const g of shots) {
      const page = await doc.getPage(g.page + 1), vp1 = page.getViewport({ scale: 1 });
      let x, y, w, h;
      if (spot) { x = spot.x * vp1.width; y = spot.y * vp1.height; w = spot.w * vp1.width; h = spot.h * vp1.height; }
      else {
        const [x1, y1, x2, y2] = g.rect, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
        w = Math.max(x2 - x1 + 60, 240); h = Math.max(y2 - y1 + 36, 72); x = cx - w / 2; y = cy - h / 2;
      }
      x = clamp(x, 0, vp1.width - 20); y = clamp(y, 0, vp1.height - 20);
      w = Math.min(w, vp1.width - x); h = Math.min(h, vp1.height - y);
      const k = 2.5, c = document.createElement('canvas');
      c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.translate(-x * k, -y * k);
      await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: k }), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
      ctx.setTransform(k, 0, 0, k, -x * k, -y * k);
      const mk = (f.marks[g.page] || []).filter(m => m.t !== 'note');
      if (mk.length) drawMarks(ctx, mk, vp1.width, vp1.height, 0, null);
      if (g.hover) {   // a comment that only shows on hover: print its words next to the spot so the picture shows them
        ctx.font = '11px ' + FONT;
        const bw = Math.min(220, w - 8), lines = wrapText(ctx, g.full, bw - 12).slice(0, 4), bh = lines.length * 14 + 10;
        const bx = clamp(g.rect[2] + 6, x + 4, x + w - bw - 4), by = clamp(g.rect[1] - 4, y + 4, y + h - bh - 4);
        ctx.fillStyle = '#FFF6D6'; ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = '#C99A00'; ctx.lineWidth = 0.8; ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = '#1B1F27'; lines.forEach((ln, i) => ctx.fillText(ln, bx + 6, by + 15 + i * 14));
      }
      g.img = c.toDataURL('image/jpeg', 0.85);
      c.width = c.height = 0;
    }
    return { found, shots, kami, seen, nAnnots: Object.keys(kami).length, hasText: seen.length > 0 };
  } finally { doc.destroy(); }
}
function kamiNote(a, vp) {
  const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect);
  const l = Math.min(x1, x2), r = Math.max(x1, x2), t = Math.min(y1, y2), b = Math.max(y1, y2);
  const k = a.color && a.color.length >= 3 ? a.color : [244, 180, 0];
  const hex = '#' + [k[0], k[1], k[2]].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  return { t: 'note', ro: true, color: hex, text: commentText(a), ax: Math.min(a.subtype === 'Text' ? (l + r) / 2 : r, vp.width - 2), ay: a.subtype === 'Text' ? (t + b) / 2 : t + Math.min(8, (b - t) / 2) };
}
const SKIP_TYPES = new Set(['Link', 'Popup', 'Widget']);
const commentText = a => ((a.contentsObj && a.contentsObj.str) || a.contents || '').replace(/\r\n?/g, '\n').trim();
// Hover-only comments (sticky notes, highlight comments) go in the margin; text boxes already show on the page.
const isPopupComment = a => !!commentText(a) && a.subtype !== 'FreeText';

// Scans every file. A student's grade only counts as read when exactly one grade was found across their files.
let scanP = null;
async function scanAll(onStep) {
  while (scanP) await scanP;
  const b0 = batch;
  scanP = scanRun(onStep).finally(() => { scanP = null; });
  await scanP;
  if (b0 !== batch) return;
}
async function scanRun(onStep) {
  const b0 = batch;
  const spot = setup.spot || null;
  const files = batch.students.flatMap(st => st.files.filter(f => viewable(f)));
  let n = 0;
  for (const st of batch.students) {
    for (const f of st.files.filter(f => viewable(f))) {
      if (batch !== b0) return;
      try { f.scan = await scanFile(f, f.hand || spot); if (f.hand) f.scan.hand = true; }
      catch (e) { console.error(e); f.scan = { found: [], shots: [], kami: {}, err: true }; }
      f.kami = f.scan.kami;
      onStep && onStep(++n, files.length);
    }
    const all = st.files.filter(f => fileIn(st, f)).flatMap(f => (f.scan && f.scan.found) || []);
    st.found = all.length === 1 ? { ...all[0], found: true } : null;
    st.foundCount = all.length;
  }
  scanned = true;
  renderList();
  for (const pg of pages) { pg.extra = (pg.file.kami && pg.file.kami[pg.idx] && pg.file.kami[pg.idx].notes) || []; draw(pg); }
}
let scanned = false;
function foundLabel(fd) {
  if (!fd) return '';
  return (fd.score != null ? fmtNum(fd.score) + (fd.outOf ? '/' + fmtNum(fd.outOf) : '') : '') + (fd.pct != null ? (fd.score != null ? ' = ' : '') + fmtNum(fd.pct) + '%' : '');
}
// One row per file (and one for each empty folder), always in folder order.
let sheetShowOut = false;
function sheetRows(all) {
  const rows = [];
  batch.students.forEach((st, i) => {
    const fs = st.files.filter(viewable);
    const inc = fs.filter(f => fileIn(st, f)), out = fs.filter(f => !fileIn(st, f));
    if (!inc.length && (!out.length || !(all || sheetShowOut))) rows.push({ st, i, f: null, none: !fs.length });
    for (const f of inc) rows.push({ st, i, f });
    if (all || sheetShowOut) for (const f of out) rows.push({ st, i, f, out: true });
  });
  return rows;
}
async function openSheet(rescan) {
  openDlg('<div class="bh"><h2>Grade sheet</h2><span class="muted" id="shSub"></span><button class="icon" data-close aria-label="Close">✕</button></div>' +
    '<div class="bb" id="shBody"><p class="muted">Looking for the grade on each paper…</p><div class="prog"><i></i></div></div>' +
    '<div class="bf"><button class="btn" data-each>Box each grade by hand</button><button class="btn" data-spot>' + (setup.spot ? 'Change the shared spot' : 'Same spot on every paper') + '</button>' + (setup.spot ? '<button class="btn" data-auto>Stop using the shared spot</button>' : '') +
    '<button class="btn" data-cp>Copy all scores</button><button class="btn primary" data-pdf>Download grade sheet (PDF)</button></div>');
  const box = $('#dlgBox');
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-spot]')) return pickSpot();
    if (e.target.closest('[data-each]')) return pickEach();
    const rb = e.target.closest('[data-rebox]'); if (rb) return pickEach(+rb.dataset.rebox);
    if (e.target.closest('[data-showout]')) { sheetShowOut = !sheetShowOut; return renderSheet(); }
    const io = e.target.closest('[data-bring],[data-leave]');
    if (io) {
      const v = io.dataset.bring || io.dataset.leave, bar = v.indexOf('|'), st = batch.students[+v.slice(0, bar)], path = v.slice(bar + 1);
      for (const d of layoutOf(st)) if (d.pages.some(([q]) => q === path)) setDocIn(st, d, !!io.dataset.bring);
      const all = st.files.filter(f => fileIn(st, f)).flatMap(f => (f.scan && f.scan.found) || []);
      st.found = all.length === 1 ? { ...all[0], found: true } : null; st.foundCount = all.length;
      renderList(); return renderSheet();
    }
    if (e.target.closest('[data-auto]')) { delete setup.spot; store.set('gs.setup', { ...setup, spot: undefined }); saveSoon(); return openSheet(true); }
    const c = e.target.closest('[data-copy]'); if (c) return copy(c.dataset.copy, c.dataset.copy ? 'Copied ' + c.dataset.copy : 'Nothing to copy');
    const go = e.target.closest('[data-open]'); if (go) { closeDlg(); return openStudent(+go.dataset.open, go.dataset.file); }
    if (e.target.closest('[data-cp]')) return copy(batch.students.map(st => { const g = gradeOf(st); return fmtNum(g.total != null ? g.total : g.pct); }).join('\n'), 'Copied ' + batch.students.length + ' scores in folder order (blank where unsure)');
    if (e.target.closest('[data-pdf]')) return saveBlob('Grade sheet - ' + batch.name + '.pdf', new Blob([await buildSheetPdf()], { type: 'application/pdf' }));
  };
  const bar = box.querySelector('.prog i');
  await scanAll((n, t) => { if (bar) bar.style.width = (100 * n / t) + '%'; });
  if ($('#dlg').hidden || !$('#shBody')) return;
  renderSheet();
}
function renderSheet() {
  const rows = sheetRows();
  const nOut = batch.students.reduce((a, st) => a + st.files.filter(f => viewable(f) && !fileIn(st, f)).length, 0);
  const nOne = batch.students.filter(st => st.foundCount === 1).length, nMany = batch.students.filter(st => st.foundCount > 1).length;
  $('#shSub').textContent = (setup.spot ? 'Same spot on every paper · ' : '') + nOne + ' of ' + batch.students.length + ' read' + (nMany ? ' · ' + nMany + ' to check' : '');
  $('#shBody').innerHTML = '<p class="muted" style="margin:0 0 10px;font-size:14px">Every row is made from the file named on it, inside that student’s folder. Click a picture to open that exact file. Click a score to copy it.</p>' +
    (nOut ? '<p style="margin:0 0 10px;font-size:14px;background:var(--warn-soft);padding:8px 10px;border-radius:8px">' + nOut + (nOut === 1 ? ' file has' : ' files have') + ' no marks, so ' + (nOut === 1 ? 'it’s' : 'they’re') + ' left out as extra papers. <button class="link" data-showout>' + (sheetShowOut ? 'Hide them' : 'Show them') + '</button></p>' : '') +
    '<table class="gl"><thead><tr><th>#</th><th>Folder and file</th><th>On the paper</th><th>Read as</th></tr></thead><tbody>' +
    rows.map(({ st, i, f, out, none }) => {
      const where = '<div style="font-weight:600">' + esc(st.key) + '</div>' + (f ? '<div class="muted" style="font-size:13px;overflow-wrap:anywhere">' + esc(f.path) + '</div>' : '');
      if (!f) return '<tr><td class="n">' + (i + 1) + '</td><td>' + where + '</td><td class="muted">' + (none ? 'Nothing turned in' : 'Only unmarked files, left out') + '</td><td></td></tr>';
      if (out) return '<tr style="opacity:.7"><td class="n">' + (i + 1) + '</td><td>' + where + '</td><td class="muted">Left out (no marks). <button class="link" data-bring="' + i + '|' + esc(f.path) + '">Bring back</button></td><td></td></tr>';
      const sc = f.scan || { found: [], shots: [] };
      const many = sc.found.length > 1;
      const pics = sc.shots.map(g => '<div style="margin-bottom:6px"><img src="' + g.img + '" alt="" data-open="' + i + '" data-file="' + esc(f.path) + '" title="Open this file" style="display:block;max-width:360px;max-height:150px;border:1px solid ' + (many ? 'var(--warn)' : 'var(--line)') + ';border-radius:4px;cursor:pointer;background:#fff">' +
        (g.text && g.from === 'note' ? '<div class="muted" style="font-size:12px;max-width:360px">Typed: “' + esc(g.text) + '” · page ' + (g.page + 1) + '</div>' : '<div class="muted" style="font-size:12px">Page ' + (g.page + 1) + '</div>') + '</div>').join('') ||
        '<span class="muted">' + (f.hand ? 'Boxed by hand' : sc.err ? 'Couldn’t read this file' : sc.seen && sc.seen.length ? 'No grade in the typed text I found: “' + esc(sc.seen.join('” · “')) + '”' : sc.nAnnots ? 'There are marks here but no typed text, so the grade may be handwritten or flattened. Try Box it by hand.' : 'No marks or typed text in this file. If you marked it in Kami, the marks may not have been saved into the file. Try Box it by hand.') + '</span>';
      const ri = rows.findIndex(r => r.f === f);
      const handNote = '<div style="margin-top:4px;display:flex;gap:14px"><button class="link" style="font-size:12px" data-rebox="' + ri + '">' + (f.hand ? 'Boxed by hand · redo' : 'Box it by hand') + '</button><button class="link" style="font-size:12px;color:var(--muted)" data-leave="' + i + '|' + esc(f.path) + '">Leave out</button></div>';
      const reads = sc.found.map(g => '<div class="c" data-copy="' + esc(fmtNum(g.score != null ? g.score : g.pct)) + '" style="cursor:copy">' + esc(foundLabel(g)) + '</div>').join('');
      return '<tr><td class="n">' + (i + 1) + '</td><td>' + where + '</td><td>' + pics + handNote + '</td><td style="font-weight:700">' +
        (many ? '<span class="pill warn" style="display:inline-block;font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--warn-soft);color:var(--warn);margin-bottom:6px">' + sc.found.length + ' grades found, check</span>' : '') + reads + '</td></tr>';
    }).join('') + '</tbody></table>';
}
// Box each grade by hand: one paper at a time, drag a box around the grade, and it moves to the next paper.
let eachKeys = null;
async function pickEach(start) {
  const rows = sheetRows();
  const fileRows = rows.map((r, k) => ({ ...r, k })).filter(r => r.f);
  if (!fileRows.length) return toast('No papers to box');
  let pos = start != null ? Math.max(0, fileRows.findIndex(r => r.k === start)) : Math.max(0, fileRows.findIndex(r => !r.f.hand));
  let token = 0;
  openDlg('<div class="bh"><h2 id="peTitle">Box the grade</h2><span class="muted" id="peCount"></span><button class="icon" data-done aria-label="Done">✕</button></div>' +
    '<div class="bb" id="peBody" style="background:var(--surface-2)"></div>' +
    '<div class="bf" style="justify-content:space-between"><span class="muted" style="font-size:13px;align-self:center">Drag a box around the grade. It saves and goes to the next paper.</span><span style="display:flex;gap:8px"><button class="btn" data-back>◀ Back</button><button class="btn" data-skip>Skip (no grade)</button><button class="btn primary" data-done>Done</button></span></div>');
  const box = $('#dlgBox');
  const finish = () => { if (eachKeys) document.removeEventListener('keydown', eachKeys, true); eachKeys = null; saveSoon(); openSheet(true); };
  const go = d => { pos += d; if (pos >= fileRows.length) { toast('That was the last paper'); return finish(); } pos = Math.max(0, pos); show(); };
  async function show() {
    const my = ++token, { st, i, f } = fileRows[pos];
    $('#peTitle').textContent = st.key;
    $('#peCount').textContent = 'Student ' + (i + 1) + ' of ' + batch.students.length + ' · paper ' + (pos + 1) + ' of ' + fileRows.length;
    const body = $('#peBody');
    body.innerHTML = '<div class="muted" style="font-size:13px;margin-bottom:8px;overflow-wrap:anywhere">File: ' + esc(f.path) + (f.hand ? ' · already boxed (drag again to change it)' : '') + '</div>';
    body.scrollTop = 0;
    box.querySelector('[data-back]').disabled = pos === 0;
    let doc;
    try { doc = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise; }
    catch { body.insertAdjacentHTML('beforeend', '<p>This file couldn’t be opened. Click Skip.</p>'); return; }
    const avail = body.clientWidth - 40;
    for (let p = 0; p < doc.numPages; p++) {
      if (my !== token) break;
      const page = await doc.getPage(p + 1);
      const v1 = page.getViewport({ scale: 1 }), k = Math.min(1.8, avail / v1.width, Math.max(body.clientHeight - 50, 480) / v1.height), dpr = window.devicePixelRatio || 1;
      const vp = page.getViewport({ scale: k * dpr });
      const c = document.createElement('canvas');
      c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      Object.assign(c.style, { width: v1.width * k + 'px', height: v1.height * k + 'px', display: 'block', margin: '0 auto 14px', background: '#fff', boxShadow: 'var(--shadow)', cursor: 'crosshair', touchAction: 'none' });
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
      if (my !== token) break;
      const mk = (f.marks[p] || []).filter(m => m.t !== 'note');
      if (mk.length) { ctx.save(); ctx.scale(k * dpr, k * dpr); drawMarks(ctx, mk, v1.width, v1.height, 0, null); ctx.restore(); }
      const base = ctx.getImageData(0, 0, c.width, c.height);
      const paint = sel => {
        ctx.putImageData(base, 0, 0);
        if (!sel) return;
        ctx.fillStyle = 'rgba(39,71,208,.14)'; ctx.fillRect(sel.x * c.width, sel.y * c.height, sel.w * c.width, sel.h * c.height);
        ctx.strokeStyle = '#2747D0'; ctx.lineWidth = 2 * dpr; ctx.strokeRect(sel.x * c.width, sel.y * c.height, sel.w * c.width, sel.h * c.height);
      };
      if (f.hand && f.hand.page === p) paint(f.hand);
      let d0 = null, sel = null;
      const rel = e => { const r = c.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
      c.onpointerdown = e => { e.preventDefault(); c.setPointerCapture(e.pointerId); d0 = rel(e); sel = null; };
      c.onpointermove = e => { if (!d0) return; const [x, y] = rel(e); sel = { x: Math.min(x, d0[0]), y: Math.min(y, d0[1]), w: Math.abs(x - d0[0]), h: Math.abs(y - d0[1]) }; paint(sel); };
      c.onpointerup = () => {
        if (!d0) return; d0 = null;
        if (!sel || sel.w < 0.015 || sel.h < 0.008) { paint(f.hand && f.hand.page === p ? f.hand : null); return; }
        f.hand = { page: p, x: r4(sel.x), y: r4(sel.y), w: r4(sel.w), h: r4(sel.h) };
        f.scan = undefined; saveSoon();
        paint(sel);
        setTimeout(() => { if (my === token) go(1); }, 250);
      };
      body.appendChild(c);
      page.cleanup();
    }
    doc.destroy();
  }
  const r4 = v => Math.round(v * 10000) / 10000;
  box.onclick = e => {
    if (e.target.closest('[data-done]')) return finish();
    if (e.target.closest('[data-back]')) return go(-1);
    if (e.target.closest('[data-skip]')) return go(1);
  };
  if (eachKeys) document.removeEventListener('keydown', eachKeys, true);
  eachKeys = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(1); }
  };
  document.addEventListener('keydown', eachKeys, true);
  show();
}
function pickSpot() {
  const st = batch.students.find(s => s.files.some(f => viewable(f)));
  if (!st) return toast('No papers to pick from');
  const f = st.files.find(f => viewable(f));
  let which = (setup.spot && setup.spot.page) || 'first';
  openDlg('<div class="bh"><h2>Pick the grade spot</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb">' +
    '<p style="margin-top:0">Drag a box around where you put the grade. The same spot gets cropped on every paper, which also catches handwritten grades.</p>' +
    '<div class="chk" style="cursor:default">Page <span class="seg" id="spPage"><button data-pg="first" aria-pressed="' + (which === 'first') + '">First page</button><button data-pg="last" aria-pressed="' + (which === 'last') + '">Last page</button></span></div>' +
    '<div style="position:relative;display:inline-block;margin-top:6px"><canvas id="spC" style="display:block;border:1px solid var(--line);cursor:crosshair;touch-action:none;max-width:100%"></canvas></div></div>' +
    '<div class="bf"><button class="btn" data-close>Cancel</button><button class="btn primary" data-use disabled>Use this spot</button></div>');
  const box = $('#dlgBox'), c = $('#spC');
  let bmp = null, sel = null, W = 0, H = 0;
  const paint = () => {
    const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0);
    if (sel) { ctx.fillStyle = 'rgba(39,71,208,.12)'; ctx.fillRect(sel.x * c.width, sel.y * c.height, sel.w * c.width, sel.h * c.height); ctx.strokeStyle = '#2747D0'; ctx.lineWidth = 2; ctx.strokeRect(sel.x * c.width, sel.y * c.height, sel.w * c.width, sel.h * c.height); }
  };
  const load = async () => {
    const doc = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
    const page = await doc.getPage(which === 'last' ? doc.numPages : 1);
    const v1 = page.getViewport({ scale: 1 }); const k = Math.min(1.4, 640 / v1.width);
    const vp = page.getViewport({ scale: k }); W = vp.width; H = vp.height;
    bmp = document.createElement('canvas'); bmp.width = W; bmp.height = H;
    const bc = bmp.getContext('2d'); bc.fillStyle = '#fff'; bc.fillRect(0, 0, W, H);
    await page.render({ canvasContext: bc, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
    doc.destroy();
    c.width = W; c.height = H; paint();
  };
  load();
  let d0 = null;
  const rel = e => { const r = c.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
  c.onpointerdown = e => { c.setPointerCapture(e.pointerId); d0 = rel(e); sel = null; };
  c.onpointermove = e => { if (!d0) return; const [x, y] = rel(e); sel = { x: Math.min(x, d0[0]), y: Math.min(y, d0[1]), w: Math.abs(x - d0[0]), h: Math.abs(y - d0[1]) }; paint(); };
  c.onpointerup = () => { d0 = null; if (sel && (sel.w < 0.02 || sel.h < 0.01)) sel = null; paint(); box.querySelector('[data-use]').disabled = !sel; };
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return openSheet(false);
    const pg = e.target.closest('[data-pg]');
    if (pg) { which = pg.dataset.pg; for (const x of $('#spPage').children) x.setAttribute('aria-pressed', x === pg); sel = null; box.querySelector('[data-use]').disabled = true; load(); return; }
    if (e.target.closest('[data-use]') && sel) { setup.spot = { page: which, ...sel }; store.set('gs.setup', { ...setup, spot: undefined }); saveSoon(); openSheet(true); }
  };
}
// One PDF with every row of the grade sheet, in folder order, drawn on a canvas so any name prints correctly.
async function buildSheetPdf() {
  if (!scanned) await scanAll();
  const doc = await PDFLib.PDFDocument.create();
  const PW = 612, PH = 792, M = 36, k = 2, X = M + 200, maxW = PW - M - X;
  const rows = sheetRows().filter(r => !r.out);
  const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  let ri = 0, pageNo = 0;
  while (ri < rows.length) {
    const c = document.createElement('canvas'); c.width = PW * k; c.height = PH * k;
    const ctx = c.getContext('2d'); ctx.scale(k, k); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PW, PH);
    ctx.fillStyle = '#151922'; ctx.font = 'bold 13px ' + FONT; ctx.fillText(batch.name + ' · grade sheet' + (pageNo ? ' (continued)' : ''), M, M - 8);
    let y = M + 6;
    while (ri < rows.length) {
      const { st, i, f } = rows[ri], sc = f && f.scan ? f.scan : { found: [], shots: [] };
      const imgs = [];
      for (const g of sc.shots) { const im = await loadImg(g.img); if (im) imgs.push({ im, h: Math.min(90, maxW * im.height / im.width) }); }
      const rh = Math.max(56, imgs.reduce((a, o) => a + o.h + 6, 0)) + 10;
      if (y + rh > PH - M && y > M + 6) break;
      ctx.fillStyle = '#8A90A0'; ctx.font = '11px ' + FONT; ctx.fillText(String(i + 1), M, y + 13);
      ctx.fillStyle = '#151922'; ctx.font = 'bold 12px ' + FONT;
      let ly = y + 13;
      for (const ln of wrapText(ctx, st.key, 170).slice(0, 2)) { ctx.fillText(ln, M + 20, ly); ly += 14; }
      ctx.fillStyle = '#5D6475'; ctx.font = '9.5px ' + FONT;
      if (f) for (const ln of wrapText(ctx, f.path, 170).slice(0, 2)) { ctx.fillText(ln, M + 20, ly); ly += 12; }
      ctx.font = 'bold 12px ' + FONT;
      if (sc.found.length > 1) { ctx.fillStyle = '#9A6411'; ctx.fillText(sc.found.length + ' grades found, check', M + 20, ly + 4); ly += 16; }
      ctx.fillStyle = '#1C7F54';
      for (const g of sc.found) { ctx.fillText(foundLabel(g), M + 20, ly + 4); ly += 15; }
      let iy = y;
      for (const { im, h } of imgs) { const w = h * im.width / im.height; ctx.drawImage(im, X, iy, w, h); ctx.strokeStyle = sc.found.length > 1 ? '#E8B451' : '#DADDE6'; ctx.strokeRect(X, iy, w, h); iy += h + 6; }
      if (!imgs.length) { ctx.fillStyle = '#8A90A0'; ctx.font = 'italic 11px ' + FONT; ctx.fillText(f ? 'No typed grade found' : 'Nothing turned in', X, y + 13); }
      y += rh; ctx.strokeStyle = '#ECEEF3'; ctx.beginPath(); ctx.moveTo(M, y - 5); ctx.lineTo(PW - M, y - 5); ctx.stroke();
      ri++;
    }
    const jpg = await new Promise(res => c.toBlob(b => b.arrayBuffer().then(x => res(new Uint8Array(x))), 'image/jpeg', 0.9));
    doc.addPage([PW, PH]).drawImage(await doc.embedJpg(jpg), { x: 0, y: 0, width: PW, height: PH });
    c.width = c.height = 0; pageNo++;
  }
  return await doc.save();
}

/* ---------------- share with Claude: papers by code, names covered; bring Claude's feedback back ---------------- */
// The code key (which code is which student) lives only in this browser, with the rest of this download's work.
const CODE_ABC = 'ACDEFGHJKMNPQRTUVWXY34679';
function shareState() {
  if (!batch.share) batch.share = { codes: {}, boxes: {} };
  const sh = batch.share, used = new Set(Object.values(sh.codes));
  for (const st of batch.students) if (!sh.codes[st.key]) {
    let c; do { c = 'S-' + Array.from(crypto.getRandomValues(new Uint8Array(4)), b => CODE_ABC[b % CODE_ABC.length]).join(''); } while (used.has(c));
    used.add(c); sh.codes[st.key] = c;
  }
  return sh;
}
const codeOf = st => shareState().codes[st.key];
// Words that could name the student: from the folder name and the matching roster name. Long numbers (IDs) count too.
function coverWords(st) {
  const w = new Set(nameWords(st.key));
  const c = batchClass();
  if (c) for (const [n, s] of rosterMatch(c.names)) if (s === st) for (const x of nameWords(n)) w.add(x);
  return [...w].filter(x => /^\d+$/.test(x) ? x.length >= 4 : x.length >= 2 && !/^(the|and|of|de|da|van|von|le|la)$/.test(x));
}
const rxEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRx = words => words.length ? new RegExp(words.map(w => /^[\x00-\x7f]+$/.test(w) ? '(?<![\\p{L}\\p{N}])' + rxEsc(w) + '(?![\\p{L}\\p{N}])' : rxEsc(w)).join('|'), 'giu') : null;
const scrub = (text, rx) => rx ? String(text || '').replace(rx, '[name]') : String(text || '');
// Covers (in page points) for one page: every name word in the page text, any Kami box whose text names them, plus her own boxes.
async function autoCovers(page, vp, rx) {
  const out = [];
  if (!rx) return out;
  const tc = await page.getTextContent();
  for (const it of tc.items) {
    if (!it.str) continue;
    const tx = pdfjsLib.Util.transform(vp.transform, it.transform), fh = Math.hypot(tx[2], tx[3]) || 10;
    const W = it.width * vp.scale, L = it.str.length || 1;
    rx.lastIndex = 0; let m;
    while ((m = rx.exec(it.str))) {
      const cw = W / L;
      out.push({ x: tx[4] + cw * m.index - cw - 2, y: tx[5] - fh * 1.05 - 2, w: cw * (m[0].length + 2) + 4, h: fh * 1.45 + 4 });
      if (!m[0].length) rx.lastIndex++;
    }
  }
  for (const a of await page.getAnnotations()) {
    rx.lastIndex = 0;
    if (!SKIP_TYPES.has(a.subtype) && rx.test(annText(a) || '')) {
      const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect);
      out.push({ x: Math.min(x1, x2) - 2, y: Math.min(y1, y2) - 2, w: Math.abs(x2 - x1) + 4, h: Math.abs(y2 - y1) + 4 });
    }
  }
  return out;
}
const boxKey = (path, p) => path + '|' + p;
function ownCovers(path, p, W, H) { return (shareState().boxes[boxKey(path, p)] || []).map(b => ({ x: b[0] * W, y: b[1] * H, w: b[2] * W, h: b[3] * H, own: true })); }
const scrubMarks = (marks, rx) => marks.map(m => m.text != null ? { ...m, text: scrub(m.text, rx) } : m);
// Renders one page the way Claude will see it: her marks (names scrubbed from her text) and black covers.
async function sharePage(st, f, js, p, scale, rx) {
  const page = await js.getPage(p + 1);
  const vp = page.getViewport({ scale: 1 }), W = vp.width, H = vp.height;
  const marks = scrubMarks((f.marks[p] || []).concat((f.kami && f.kami[p] && f.kami[p].notes) || []), rx);
  const side = marks.some(m => m.t === 'note') ? sideFor(W) : 0;
  const c = document.createElement('canvas');
  c.width = Math.ceil((W + side) * scale); c.height = Math.ceil(H * scale);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale }), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawMarks(ctx, marks, W, H, side, null);
  const covers = (await autoCovers(page, vp, rx)).concat(ownCovers(f.path, p, W, H));
  ctx.fillStyle = '#111';
  for (const r of covers) ctx.fillRect(r.x, r.y, r.w, r.h);
  page.cleanup();
  return { c, W, H, side, covers };
}
const shareDocs = st => layoutOf(st).filter(d => docIn(st, d)).map(d => ({ ...d, pages: d.pages.filter(([path]) => { const f = fileByPath(st, path); return f && !f.virtual && viewable(f); }) })).filter(d => d.pages.length);

function openShare() {
  saveNow(); commitEditors(); shareState(); saveSoon();
  const who = batch.students.filter(st => shareDocs(st).length);
  openDlg('<div class="bh"><h2>Share with Claude</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb">' +
    '<p style="margin-top:0">This makes a ZIP you can give to Claude with <b>no names in it</b>. ' + who.length + (who.length === 1 ? ' student' : ' students') + ' get a random code, like <b>' + esc(codeOf(who[0] || batch.students[0])) + '</b>. The list of who is who stays only in this browser.</p>' +
    '<ul style="margin:0 0 12px;padding-left:20px;line-height:1.55">' +
    '<li>Every page becomes a picture, so no hidden text or file details go with it.</li>' +
    '<li>Names are covered in black wherever they’re typed on the page' + (batchClass() ? ' (folder names and your roster names)' : ' (from the folder names)') + ', and in any Kami box that has a name.</li>' +
    '<li>Your scores, rubric and comments go too, with names swapped for [name].</li></ul>' +
    '<p style="margin:0 0 12px;padding:10px 12px;border-radius:10px;background:var(--warn-soft);color:var(--warn);font-size:14px"><b>Check the covers first.</b> The automatic cover can’t see handwriting or a name inside a picture. In the check, drag a box over anything it missed. If students write their name in the same spot, box it once and use it on every paper.</p>' +
    '<div class="prog" hidden><i></i></div><p class="muted" id="shStatus" style="font-size:13px;margin:0"></p></div>' +
    '<div class="bf"><button class="btn" data-check>Check the covers</button><button class="btn primary" data-make>Download ZIP for Claude</button></div>', true);
  const box = $('#dlgBox');
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-check]')) return checkCovers(0);
    if (e.target.closest('[data-make]')) {
      for (const b of box.querySelectorAll('.bf .btn')) b.disabled = true;
      const bar = box.querySelector('.prog'); bar.hidden = false;
      try { await makeSharePackage((n, t) => { bar.firstChild.style.width = (100 * n / t) + '%'; $('#shStatus').textContent = 'Covering names and making pictures ' + n + ' of ' + t + '…'; }); $('#shStatus').textContent = 'Done. Give the ZIP to Claude, then use Bring back from Claude with what it sends.'; }
      catch (er) { console.error(er); $('#shStatus').textContent = 'Something went wrong: ' + (er.message || er); }
      for (const b of box.querySelectorAll('.bf .btn')) b.disabled = false;
    }
  };
}

// Paper by paper: every page with its covers; drag to add a cover, click one of yours to remove it.
async function checkCovers(start) {
  const list = [];
  for (const st of batch.students) shareDocs(st).forEach((d, k) => list.push({ st, d, k }));
  if (!list.length) return toast('No papers to share');
  let pos = Math.min(start || 0, list.length - 1), token = 0, last = null;
  openDlg('<div class="bh"><h2 id="ccTitle">Check the covers</h2><span class="muted" id="ccCount"></span><button class="icon" data-done aria-label="Done">✕</button></div>' +
    '<div class="bb" id="ccBody" style="background:var(--surface-2)"></div>' +
    '<div class="bf" style="justify-content:space-between"><span class="muted" style="font-size:13px;align-self:center;max-width:46%">Drag a box over a name it missed. Click one of your boxes to take it off.</span><span style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="btn" data-every hidden>Use my last box on every paper</button><button class="btn" data-back>◀ Back</button><button class="btn primary" data-next>Next ▶</button></span></div>');
  const box = $('#dlgBox');
  const finish = () => { if (eachKeys) document.removeEventListener('keydown', eachKeys, true); eachKeys = null; saveSoon(); openShare(); };
  const go = d => { pos += d; if (pos >= list.length) { toast('That was the last paper'); return finish(); } pos = Math.max(0, pos); show(); };
  async function show() {
    const my = ++token, { st, d, k } = list[pos], rx = wordRx(coverWords(st));
    $('#ccTitle').textContent = st.key + ' → ' + codeOf(st) + (k ? '-' + (k + 1) : '');
    $('#ccCount').textContent = 'paper ' + (pos + 1) + ' of ' + list.length;
    box.querySelector('[data-back]').disabled = pos === 0;
    box.querySelector('[data-next]').textContent = pos === list.length - 1 ? 'Done' : 'Next ▶';
    const body = $('#ccBody'); body.innerHTML = ''; body.scrollTop = 0;
    const js = new Map();
    try {
      for (const [path, p] of d.pages) {
        if (my !== token) break;
        const f = fileByPath(st, path);
        if (!js.has(path)) js.set(path, await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise);
        const avail = body.clientWidth - 40, dpr = window.devicePixelRatio || 1;
        const pg0 = await js.get(path).getPage(p + 1), v1 = pg0.getViewport({ scale: 1 });
        const kk = Math.min(1.6, avail / (v1.width * 1.4));
        const r = await sharePage(st, f, js.get(path), p, kk * dpr, rx);
        if (my !== token) break;
        const c = r.c;
        Object.assign(c.style, { width: (r.W + r.side) * kk + 'px', height: r.H * kk + 'px', display: 'block', margin: '0 auto 14px', background: '#fff', boxShadow: 'var(--shadow)', cursor: 'crosshair', touchAction: 'none' });
        const ctx = c.getContext('2d'), base = ctx.getImageData(0, 0, c.width, c.height);
        const own = () => shareState().boxes[boxKey(path, p)] || (shareState().boxes[boxKey(path, p)] = []);
        const fr = e => { const b = c.getBoundingClientRect(); return [(e.clientX - b.left) / kk, (e.clientY - b.top) / kk]; };
        let d0 = null, sel = null;
        const paint = () => { ctx.putImageData(base, 0, 0); if (sel) { ctx.save(); ctx.setTransform(kk * dpr, 0, 0, kk * dpr, 0, 0); ctx.fillStyle = 'rgba(17,17,17,.75)'; ctx.fillRect(sel.x, sel.y, sel.w, sel.h); ctx.restore(); } };
        c.onpointerdown = e => { e.preventDefault(); c.setPointerCapture(e.pointerId); d0 = fr(e); sel = null; };
        c.onpointermove = e => { if (!d0) return; const [x, y] = fr(e); sel = { x: Math.min(x, d0[0]), y: Math.min(y, d0[1]), w: Math.abs(x - d0[0]), h: Math.abs(y - d0[1]) }; paint(); };
        c.onpointerup = e => {
          if (!d0) return; const start = d0; d0 = null;
          if (!sel || sel.w < 4 || sel.h < 3) {
            sel = null; paint();
            const [x, y] = start, arr = own(), hit = arr.findIndex(b => x >= b[0] * r.W && x <= (b[0] + b[2]) * r.W && y >= b[1] * r.H && y <= (b[1] + b[3]) * r.H);
            if (hit >= 0) { arr.splice(hit, 1); saveSoon(); show(); }
            return;
          }
          const fx = v => Math.round(v * 10000) / 10000;
          const b = [fx(clamp(sel.x / r.W, 0, 1)), fx(clamp(sel.y / r.H, 0, 1)), fx(Math.min(sel.w / r.W, 1)), fx(Math.min(sel.h / r.H, 1))];
          own().push(b); last = { b, first: d.pages[0][0] === path && d.pages[0][1] === p, p }; saveSoon();
          box.querySelector('[data-every]').hidden = false;
          show();
        };
        body.appendChild(c);
        if (pg0) pg0.cleanup();
      }
    } finally { for (const v of js.values()) v.destroy(); }
  }
  box.onclick = e => {
    if (e.target.closest('[data-done]')) return finish();
    if (e.target.closest('[data-back]')) return go(-1);
    if (e.target.closest('[data-next]')) return go(1);
    if (e.target.closest('[data-every]') && last) {
      // Same spot on every paper: the first page of each paper (or the same page number when the box wasn't on a first page).
      let n = 0;
      for (const { d } of list) {
        const at = last.first ? d.pages[0] : d.pages.find(([, p]) => p === last.p);
        if (!at) continue;
        const arr = shareState().boxes[boxKey(at[0], at[1])] || (shareState().boxes[boxKey(at[0], at[1])] = []);
        if (!arr.some(b => b.join() === last.b.join())) { arr.push(last.b.slice()); n++; }
      }
      saveSoon(); toast('Added that cover to ' + n + ' more ' + (n === 1 ? 'paper' : 'papers')); show();
    }
  };
  if (eachKeys) document.removeEventListener('keydown', eachKeys, true);
  eachKeys = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(1); }
  };
  document.addEventListener('keydown', eachKeys, true);
  show();
}

const README_FOR_CLAUDE = (n) => [
  'Grading Studio package for Claude',
  '',
  'Assignment: ' + batch.name.replace(/[\r\n]+/g, ' '),
  'Papers: ' + n + ' students, each named by a random code (S-XXXX). Names are covered and swapped for [name].',
  'A second paper from the same student is S-XXXX-2, and so on.',
  '',
  'Files',
  '  papers/        one PDF per paper, as pictures, with the teacher\'s marks and comments drawn on',
  '  scores.csv     code, rubric scores, total, percent, the teacher\'s comment',
  '  comments.json  every typed comment and text mark the teacher left, by code, page and kind',
  '  rubric.json    the rubric rows and grading scale',
  '',
  'How to send feedback back',
  '  Give one block per student that starts with the code on its own line, then the feedback:',
  '',
  '    S-XXXX',
  '    Feedback for this student...',
  '',
  '  Or a CSV with the columns code,feedback. Paste the reply, or drop the file, into',
  '  "Bring back from Claude" in Grading Studio and each block goes to the right student.',
  '  Only these codes are known to Grading Studio; never guess or ask for names.',
].join('\r\n');

async function makeSharePackage(onStep) {
  await workerReady;
  if (!scanned || scanP) await scanAll();
  const files = {}, rows = [], notes = {};
  const crit = setup.mode === 'rubric' ? setup.criteria : [];
  const q = v => /[",\n\r]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
  const jobs = [];
  for (const st of batch.students) shareDocs(st).forEach((d, k) => jobs.push({ st, d, k }));
  const total = jobs.reduce((a, j) => a + j.d.pages.length, 0);
  let done = 0;
  const seen = new Set();
  for (const { st, d, k } of jobs) {
    const rx = wordRx(coverWords(st)), code = codeOf(st);
    const out = await PDFLib.PDFDocument.create();
    out.setTitle(code); out.setAuthor(''); out.setCreator('Grading Studio'); out.setProducer('');
    const js = new Map();
    try {
      for (const [path, p] of d.pages) {
        const f = fileByPath(st, path);
        if (!js.has(path)) js.set(path, await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise);
        const r = await sharePage(st, f, js.get(path), p, 120 / 72, rx);
        const jpg = await new Promise(res => r.c.toBlob(b => b.arrayBuffer().then(x => res(new Uint8Array(x))), 'image/jpeg', 0.85));
        out.addPage([r.W + r.side, r.H]).drawImage(await out.embedJpg(jpg), { x: 0, y: 0, width: r.W + r.side, height: r.H });
        r.c.width = r.c.height = 0;
        const list = (notes[code] = notes[code] || []);
        const pageNo = d.pages.findIndex(x => x[0] === path && x[1] === p) + 1;
        for (const m of (f.marks[p] || []).concat((f.kami && f.kami[p] && f.kami[p].notes) || []))
          if (m.text) list.push({ paper: code + (k ? '-' + (k + 1) : ''), page: pageNo, kind: m.t === 'note' ? (m.ro ? 'Kami comment' : 'margin comment') : 'text on page', text: scrub(m.text, rx) });
        onStep && onStep(++done, total);
      }
    } finally { for (const v of js.values()) v.destroy(); }
    files['papers/' + code + (k ? '-' + (k + 1) : '') + '.pdf'] = [await out.save(), { level: 0 }];
    if (!seen.has(st)) {
      seen.add(st);
      const g = gradeOf(st);
      rows.push([code].concat(crit.map((_, i) => fmtNum(st.grade.rubric[i])), [fmtNum(g.total), fmtNum(g.pct), scrub(st.grade.comment, rx).replace(/\s*\n\s*/g, ' ')]));
    }
  }
  const head = ['code'].concat(crit, ['total / ' + maxPoints(), 'percent', 'teacher comment']);
  const enc = s => new TextEncoder().encode(s);
  files['scores.csv'] = enc('﻿' + [head].concat(rows).map(r => r.map(q).join(',')).join('\r\n'));
  files['comments.json'] = enc(JSON.stringify(notes, null, 1));
  files['rubric.json'] = enc(JSON.stringify({ mode: setup.mode, criteria: crit, levels: setup.mode === 'rubric' ? '4 to 1 per row, half points allowed' : undefined, outOf: maxPoints(), scale: setup.scale || null }, null, 1));
  files['README.txt'] = enc(README_FOR_CLAUDE(seen.size));
  saveBlob(('For Claude - ' + batch.name + '.zip'), new Blob([fflate.zipSync(files)], { type: 'application/zip' }));
}

// Claude's reply: blocks that start with a code, a code,feedback CSV, JSON, or a ZIP with those and/or papers named by code.
function parseFeedback(text) {
  const out = new Map(), t = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  try {
    const j = JSON.parse(t);
    const put = (c, v) => { if (c && v != null) out.set(String(c).toUpperCase().trim(), String(typeof v === 'object' ? (v.feedback || v.comment || '') : v).trim()); };
    if (Array.isArray(j)) j.forEach(x => put(x.code, x.feedback != null ? x.feedback : x.comment)); else for (const [c, v] of Object.entries(j)) put(c, v);
    return out;
  } catch {}
  const lines = t.split('\n'), h = lines[0].toLowerCase();
  if (/^\s*"?code"?\s*,/.test(h) && /feedback|comment/.test(h)) {   // CSV
    const rows = [], cell = []; let f = '', inQ = false, row = [];
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (inQ) { if (ch === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (ch === '"') inQ = false; else f += ch; }
      else if (ch === '"') inQ = true; else if (ch === ',') { row.push(f); f = ''; } else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else f += ch;
    }
    row.push(f); rows.push(row);
    const hd = rows[0].map(x => x.toLowerCase().trim()), ci = hd.indexOf('code'), fi = hd.findIndex(x => /feedback/.test(x)) >= 0 ? hd.findIndex(x => /feedback/.test(x)) : hd.findIndex(x => /comment/.test(x));
    for (const r of rows.slice(1)) if (r[ci] && r[ci].trim()) out.set(r[ci].trim().toUpperCase(), (r[fi] || '').trim());
    return out;
  }
  const rx = /(?:^|\n)[\s#*>\-]*\**\s*(S-[A-Z0-9]{4})\b\**\s*[:.\-–—)]*\**/gi;   // blocks
  const hits = [...t.matchAll(rx)];
  hits.forEach((m, i) => {
    const s = m.index + m[0].length, e = i + 1 < hits.length ? hits[i + 1].index : t.length;
    const body = t.slice(s, e).replace(/^\s+|\s+$/g, '').replace(/\n{3,}/g, '\n\n');
    if (body) out.set(m[1].toUpperCase(), (out.has(m[1].toUpperCase()) ? out.get(m[1].toUpperCase()) + '\n\n' : '') + body);
  });
  return out;
}
function openBringBack() {
  shareState();
  const byCode = new Map(batch.students.map(st => [codeOf(st), st]));
  let fb = new Map(), papers = [];
  openDlg('<div class="bh"><h2>Bring back from Claude</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb">' +
    '<p style="margin-top:0">Paste Claude’s reply here, or drop the file it gave you (CSV, text or ZIP). Each code is matched to its student in this browser.</p>' +
    '<textarea id="bbText" rows="7" style="width:100%;font:inherit;font-size:14px;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink)" placeholder="S-7QK4&#10;Your thesis is clear…&#10;&#10;S-M3TD&#10;…"></textarea>' +
    '<div style="display:flex;gap:8px;margin:8px 0 12px"><button class="btn sm" data-file>Open a file…</button><button class="btn sm" data-read>Match to students</button><input type="file" id="bbFile" accept=".csv,.txt,.json,.md,.zip" hidden></div>' +
    '<div id="bbOut"></div></div>' +
    '<div class="bf"><label class="chk" style="margin:0 auto 0 0"><input type="checkbox" id="bbAdd" checked> Add below what’s already in the comment box (untick to replace it)</label><button class="btn" data-papers hidden>Download papers in student folders</button><button class="btn primary" data-apply disabled>Put in comment boxes</button></div>');
  const box = $('#dlgBox');
  const show = () => {
    const rows = [...fb].map(([c, v]) => { const st = byCode.get(c); return '<tr><td class="n" style="white-space:nowrap">' + esc(c) + '</td><td class="nm" style="cursor:default">' + (st ? esc(st.key) : '<span style="color:var(--warn)">not in this download</span>') + '</td><td class="cm" style="white-space:pre-wrap">' + esc(v) + '</td></tr>'; }).join('');
    const nOk = [...fb.keys()].filter(c => byCode.has(c)).length, nP = papers.filter(p => byCode.has(p.code)).length;
    $('#bbOut').innerHTML = (fb.size ? '<p style="margin:0 0 8px"><b>' + nOk + ' of ' + batch.students.length + '</b> students matched.' + (fb.size > nOk ? ' <span style="color:var(--warn)">' + (fb.size - nOk) + ' code' + (fb.size - nOk === 1 ? ' doesn’t' : 's don’t') + ' belong to this download.</span>' : '') + ' Read it over before you put it in.</p><table class="gl"><thead><tr><th>Code</th><th>Student</th><th>Feedback</th></tr></thead><tbody>' + rows + '</tbody></table>' : '') +
      (papers.length ? '<p class="muted" style="font-size:14px">' + nP + ' paper' + (nP === 1 ? '' : 's') + ' named by code can be sorted back into student folders.</p>' : '') +
      (!fb.size && !papers.length ? '<p class="muted" style="font-size:14px">No codes found yet. Each block should start with a code like S-7QK4.</p>' : '');
    box.querySelector('[data-apply]').disabled = !nOk;
    box.querySelector('[data-papers]').hidden = !nP;
  };
  const readText = s => { fb = parseFeedback(s); show(); };
  const takeFile = async file => {
    const data = new Uint8Array(await file.arrayBuffer());
    if (/\.zip$/i.test(file.name)) {
      let z; try { z = fflate.unzipSync(data); } catch { return toast('Couldn’t open that ZIP'); }
      papers = []; let txt = '';
      for (const [p, b] of Object.entries(z)) {
        if (junk(p)) continue;
        const m = p.split('/').pop().match(/^(S-[A-Z0-9]{4})(?:-(\d+))?.*\.pdf$/i);
        if (m) papers.push({ code: m[1].toUpperCase(), n: +(m[2] || 1), name: p.split('/').pop(), data: b });
        else if (/\.(csv|txt|json|md)$/i.test(p) && !/readme/i.test(p)) txt += '\n' + new TextDecoder().decode(b);
      }
      $('#bbText').value = txt.trim(); readText(txt);
    } else { const s = new TextDecoder().decode(data); $('#bbText').value = s; readText(s); }
  };
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-file]')) return $('#bbFile').click();
    if (e.target.closest('[data-read]')) return readText($('#bbText').value);
    if (e.target.closest('[data-apply]')) {
      const add = $('#bbAdd').checked; let n = 0;
      for (const [c, v] of fb) { const st = byCode.get(c); if (!st || !v) continue; st.grade.comment = add && st.grade.comment.trim() ? st.grade.comment.replace(/\s+$/, '') + '\n\n' + v : v; n++; }
      saveNow(); renderList(); renderGrade();
      toast('Put feedback in ' + n + (n === 1 ? ' comment box' : ' comment boxes') + '. It’s in the Grades list too.');
      closeDlg();
    }
    if (e.target.closest('[data-papers]')) {
      const files = {};
      for (const p of papers) {
        const st = byCode.get(p.code); if (!st) continue;
        const real = st.files.find(f => !f.virtual && viewable(f)) || st.files[0];
        const dir = real && real.path.includes('/') ? real.path.slice(0, real.path.lastIndexOf('/') + 1) : st.key + '/';
        files[(dir + 'Feedback' + (p.n > 1 ? ' ' + p.n : '') + '.pdf').replace(/[\\:*?"<>|]+/g, '-')] = [p.data, { level: 0 }];
      }
      saveBlob('From Claude - ' + batch.name + '.zip', new Blob([fflate.zipSync(files)], { type: 'application/zip' }));
    }
  };
  $('#bbFile').onchange = e => { const f = e.target.files[0]; if (f) takeFile(f); e.target.value = ''; };
  $('#bbText').addEventListener('input', () => { clearTimeout(box._t); box._t = setTimeout(() => readText($('#bbText').value), 400); });
  const bb = box.querySelector('.bb');
  bb.addEventListener('dragover', e => e.preventDefault());
  bb.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) takeFile(f); });
}

/* ---------------- Google sign-in: open from Drive, save to Drive, keep work the same on every computer ---------------- */
// Everything happens between this browser and Taylor's own Google account. The sign-in is never stored or sent anywhere else.
const GOOGLE_CLIENT_ID = '/*@@GCID@@*/';
const gcid = () => (/apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID) ? GOOGLE_CLIENT_ID : '') || store.get('gs.gcid', '');
const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.appdata';
const G = { token: null, exp: 0, client: null, email: store.get('gs.gEmail', ''), waiters: [] };
let gisP = null;
function loadGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return gisP || (gisP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = res; s.onerror = () => { gisP = null; rej(new Error('Couldn’t reach Google. Check the internet connection.')); }; document.head.appendChild(s); }));
}
// Gets a fresh token; silent when she's already signed in to Google in this browser.
async function gToken(interactive) {
  if (G.token && Date.now() < G.exp - 60000) return G.token;
  if (!gcid()) throw new Error('setup');
  await loadGis();
  if (!G.client) G.client = google.accounts.oauth2.initTokenClient({
    client_id: gcid(), scope: DRIVE_SCOPES, hint: G.email || undefined,
    callback: r => { const w = G.waiters.splice(0); if (r.error) w.forEach(x => x.rej(new Error(r.error))); else { G.token = r.access_token; G.exp = Date.now() + (r.expires_in || 3600) * 1000; w.forEach(x => x.res(G.token)); } },
    error_callback: e => { const w = G.waiters.splice(0); w.forEach(x => x.rej(new Error(e && e.type === 'popup_closed' ? 'Sign-in was closed' : 'Sign-in didn’t finish'))); },
  });
  return new Promise((res, rej) => { G.waiters.push({ res, rej }); G.client.requestAccessToken({ prompt: interactive && !G.email ? 'consent' : '' }); });
}
async function gfetch(url, opt = {}, interactive) {
  const t = await gToken(interactive);
  const r = await fetch(url.startsWith('http') ? url : 'https://www.googleapis.com/drive/v3/' + url, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + t } });
  if (r.status === 401) { G.token = null; return gfetch(url, opt, interactive); }
  if (!r.ok) throw new Error('Google Drive said ' + r.status + ': ' + ((await r.text()).match(/"message":\s*"([^"]+)/) || [, ''])[1]);
  return r;
}
const gjson = (u, o, i) => gfetch(u, o, i).then(r => r.json());
async function gList(q, fields) {
  const out = []; let page = '';
  do {
    const j = await gjson('files?pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=folder,name_natural&fields=nextPageToken,files(' + (fields || 'id,name,mimeType,size') + ')&q=' + encodeURIComponent(q) + (page ? '&pageToken=' + page : ''));
    out.push(...j.files); page = j.nextPageToken;
  } while (page);
  return out;
}
const FOLDER = 'application/vnd.google-apps.folder';
async function signIn() {
  if (!gcid()) return driveSetup();
  try {
    await gToken(true);
    const me = await gjson('about?fields=user(emailAddress)');
    G.email = me.user.emailAddress; store.set('gs.gEmail', G.email);
    renderGoogle(); toast('Signed in as ' + G.email);
    syncPull();
  } catch (e) { toast(e.message || 'Sign-in didn’t finish'); }
}
function signOut() {
  if (G.token && window.google) try { google.accounts.oauth2.revoke(G.token); } catch {}
  G.token = null; G.email = ''; store.del('gs.gEmail'); renderGoogle(); toast('Signed out of Google');
}
// Google sign-in only works on the hosted copy (not a downloaded file or a preview frame).
const GOK = /^https?:$/.test(location.protocol) && window.self === window.top;
function renderGoogle() {
  for (const el of document.querySelectorAll('.gAcct, #pickDrive')) el.hidden = !GOK;
  if (!GOK) return;
  for (const el of document.querySelectorAll('.gAcct')) el.innerHTML = G.email
    ? '<span class="muted" style="font-size:13px">Google: ' + esc(G.email) + ' · <span id="syncState">' + (syncState || 'synced') + '</span></span> <button class="link" data-gout>Sign out</button>'
    : '<button class="btn sm" data-gin>Sign in with Google</button>';
  for (const b of document.querySelectorAll('.needG')) b.hidden = !G.email;
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-gin]')) signIn();
  if (e.target.closest('[data-gout]')) signOut();
});
// Only shown if the page was built without its Google key.
function driveSetup() {
  openDlg('<div class="bh"><h2>Connect Google</h2></div><div class="bb"><p style="margin-top:0">This copy of Grading Studio doesn’t have its Google key yet. Paste the Client ID here (it ends in apps.googleusercontent.com).</p>' +
    '<div class="field"><input type="text" id="gcidIn" placeholder="1234-abc.apps.googleusercontent.com" style="width:100%"></div></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Save</button></div>', true);
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target.closest('[data-ok]')) { const v = $('#gcidIn').value.trim(); if (!/apps\.googleusercontent\.com$/.test(v)) return toast('That doesn’t look like a Client ID'); store.set('gs.gcid', v); G.client = null; closeDlg(); signIn(); }
  };
}

// Folder browser: My Drive and Shared drives, or search by name. Opens a folder (one subfolder per student) or a ZIP.
async function openFromDrive(assignment) {
  if (!G.email) { await signIn(); if (!G.email) return; }
  const trail = [{ id: 'root', name: 'My Drive' }];
  let mode = 'browse', q = '';
  openDlg('<div class="bh"><h2>Open from Google Drive</h2><button class="icon" data-close aria-label="Close">✕</button></div>' +
    '<div class="bb"><div style="display:flex;gap:8px;margin-bottom:10px"><input type="search" id="dvQ" placeholder="Search your Drive for a folder or ZIP" style="flex:1;padding:8px 10px;border:1px solid var(--line-strong);border-radius:8px;background:var(--surface);color:var(--fg);font:inherit"><button class="btn sm" data-shared>Shared drives</button><button class="btn sm" data-recent>Recent</button></div>' +
    '<div id="dvTrail" style="font-size:14px;margin-bottom:8px"></div><div id="dvList" style="min-height:260px"></div><div class="prog" hidden><i></i></div><p class="muted" id="dvStatus" style="font-size:13px"></p></div>' +
    '<div class="bf"><span class="muted" style="font-size:13px;margin-right:auto;align-self:center">Pick the folder with one folder per student, or the ZIP.</span><button class="btn" data-close>Cancel</button><button class="btn primary" data-here>Open this folder</button></div>');
  const box = $('#dlgBox');
  const row = f => '<button class="dvRow" data-id="' + esc(f.id) + '" data-kind="' + (f.mimeType === FOLDER || f.kind === 'drive#drive' ? 'folder' : 'zip') + '" data-name="' + esc(f.name) + '" style="display:flex;gap:10px;align-items:center;width:100%;text-align:left;padding:9px 10px;border:0;border-bottom:1px solid var(--line);background:none;color:var(--fg);font:inherit;cursor:pointer"><span>' + (f.mimeType === FOLDER || f.kind === 'drive#drive' ? '📁' : '🗜️') + '</span><span style="overflow-wrap:anywhere">' + esc(f.name) + '</span></button>';
  async function show() {
    const L = $('#dvList'); L.innerHTML = '<p class="muted">Loading…</p>';
    $('#dvTrail').innerHTML = mode === 'browse' ? trail.map((t, i) => i === trail.length - 1 ? '<b>' + esc(t.name) + '</b>' : '<button class="link" data-up="' + i + '">' + esc(t.name) + '</button> › ').join('') : '<button class="link" data-up="0">My Drive</button> › <b>' + (mode === 'search' ? 'Search: ' + esc(q) : mode === 'shared' ? 'Shared drives' : 'Recent') + '</b>';
    box.querySelector('[data-here]').disabled = mode !== 'browse' || trail.length === 1 && trail[0].id === 'root';
    try {
      let files;
      if (mode === 'shared') files = (await gjson('drives?pageSize=100')).drives.map(d => ({ ...d, kind: 'drive#drive' }));
      else if (mode === 'search') files = await gList("name contains '" + q.replace(/['\\]/g, '\\$&') + "' and (mimeType='" + FOLDER + "' or name contains '.zip') and trashed=false");
      else if (mode === 'recent') files = (await gjson("files?pageSize=30&orderBy=modifiedByMeTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType)&q=" + encodeURIComponent("(mimeType='" + FOLDER + "' or name contains '.zip') and trashed=false"))).files;
      else files = await gList("'" + trail[trail.length - 1].id + "' in parents and trashed=false and (mimeType='" + FOLDER + "' or name contains '.zip')");
      L.innerHTML = files.length ? files.map(row).join('') : '<p class="muted">No folders or ZIPs here.</p>';
    } catch (e) { L.innerHTML = '<p>' + esc(e.message) + '</p>'; }
  }
  const take = async (id, name, kind) => {
    for (const b of box.querySelectorAll('.bf .btn')) b.disabled = true;
    const bar = box.querySelector('.prog'); bar.hidden = false;
    try {
      const entries = kind === 'zip' ? [{ path: name, data: new Uint8Array(await (await gfetch('files/' + id + '?alt=media&supportsAllDrives=true')).arrayBuffer()) }] : await driveFolderFiles(id, (n, t) => { bar.firstChild.style.width = (100 * n / Math.max(t, 1)) + '%'; $('#dvStatus').textContent = 'Downloading ' + n + ' of ' + t + ' files…'; });
      closeDlg();
      await intake(entries, name.replace(/\.zip$/i, ''), assignment || null);
      if (batch) { batch.drive = { id, name, kind }; saveSoon(); }
    } catch (e) { $('#dvStatus').textContent = e.message; for (const b of box.querySelectorAll('.bf .btn')) b.disabled = false; }
  };
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    const u = e.target.closest('[data-up]'); if (u) { mode = 'browse'; trail.splice(+u.dataset.up + 1); return show(); }
    if (e.target.closest('[data-shared]')) { mode = 'shared'; return show(); }
    if (e.target.closest('[data-recent]')) { mode = 'recent'; return show(); }
    if (e.target.closest('[data-here]')) { const t = trail[trail.length - 1]; return take(t.id, t.name, 'folder'); }
    const r = e.target.closest('.dvRow'); if (!r) return;
    if (r.dataset.kind === 'zip') return take(r.dataset.id, r.dataset.name, 'zip');
    if (mode !== 'browse') trail.splice(1);
    mode = 'browse'; trail.push({ id: r.dataset.id, name: r.dataset.name }); show();
  };
  let qt; $('#dvQ').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { q = e.target.value.trim(); mode = q ? 'search' : 'browse'; show(); }, 350); };
  show();
}
// Every file under a folder, with paths relative to it. Google Docs come down as PDFs.
async function driveFolderFiles(id, onStep) {
  const files = [];
  const walk = async (fid, prefix) => {
    for (const f of await gList("'" + fid + "' in parents and trashed=false")) {
      if (f.mimeType === FOLDER) await walk(f.id, prefix + f.name + '/');
      else if (/^application\/vnd\.google-apps\.(document|presentation|spreadsheet|drawing)$/.test(f.mimeType)) files.push({ ...f, path: prefix + f.name + '.pdf', exp: true });
      else if (/\.(pdf|png|jpe?g|zip|docx)$/i.test(f.name) || MEDIA_RX.test(f.name) || /^(application\/pdf|image\/(png|jpeg)|audio\/.*|video\/.*)$/.test(f.mimeType)) files.push({ ...f, path: prefix + f.name });
      else files.push({ ...f, path: prefix + f.name, skip: true });
    }
  };
  await walk(id, '');
  const out = [];
  const todo = files.filter(f => !f.skip);
  for (const f of files.filter(f => f.skip)) out.push({ path: f.path, data: new Uint8Array(0) });
  const total = todo.length; let done = 0;
  const step = () => onStep && onStep(++done, total);
  const run2 = async () => { while (todo.length) { const f = todo.shift(); const r = await gfetch(f.exp ? 'files/' + f.id + '/export?mimeType=application/pdf' : 'files/' + f.id + '?alt=media&supportsAllDrives=true'); out.push({ path: f.path, data: new Uint8Array(await r.arrayBuffer()) }); step(); } };
  await Promise.all([run2(), run2(), run2(), run2()]);
  // Same as a ZIP: one wrapping folder around all the student folders is dropped.
  const tops = new Set(out.map(o => o.path.split('/')[0]));
  if (tops.size === 1 && out.every(o => o.path.split('/').length > 2)) for (const o of out) o.path = o.path.split('/').slice(1).join('/');
  return out;
}
// Saves the export into a new folder in Drive: next to the download she opened from Drive, or in My Drive.
async function saveToDrive(name, files, onStep) {
  let parent = 'root';
  if (batch.drive) { try { const j = await gjson('files/' + batch.drive.id + '?fields=parents&supportsAllDrives=true'); parent = batch.drive.kind === 'folder' ? batch.drive.id : (j.parents && j.parents[0]) || 'root'; } catch {} }
  const mk = async (nm, par) => (await gjson('files?supportsAllDrives=true&fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nm, mimeType: FOLDER, parents: [par] }) })).id;
  const top = await mk(name, parent), dirs = new Map([['', top]]);
  const dirOf = async d => { if (dirs.has(d)) return dirs.get(d); const i = d.lastIndexOf('/'), up = await dirOf(i < 0 ? '' : d.slice(0, i)); const id = await mk(d.slice(i + 1), up); dirs.set(d, id); return id; };
  const list = Object.entries(files); let n = 0;
  for (const [path, bytes] of list) {
    const i = path.lastIndexOf('/'), par = await dirOf(i < 0 ? '' : path.slice(0, i));
    const meta = new Blob([JSON.stringify({ name: path.slice(i + 1), parents: [par] })], { type: 'application/json' });
    const fd = new FormData(); fd.append('metadata', meta); fd.append('file', new Blob([bytes], { type: /\.pdf$/i.test(path) ? 'application/pdf' : 'application/octet-stream' }));
    await gfetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', { method: 'POST', body: fd });
    onStep && onStep(++n, list.length);
  }
  return top;
}

// Sync: units, assignments, rosters, setup, saved comments and each download's marks and scores, in a hidden app file in her Drive.
const SYNC_RX = /^gs\.(lib|setup|bank|batches|b\..+|rp\..+|rd\..+)$/;
const SYNC_NAME = 'grading-studio-sync.json';
let syncState = '', syncT = null, syncBusy = false, syncFileId = null;
const syncTimes = () => store.get('gs.syncT', {});
{
  const raw = store.set.bind(store);
  store.set = (k, v) => { const ok = raw(k, v); if (ok && SYNC_RX.test(k)) { const t = syncTimes(); t[k] = Date.now(); raw('gs.syncT', t); syncSoon(); } return ok; };
  const rawDel = store.del.bind(store);
  store.del = k => { rawDel(k); if (SYNC_RX.test(k)) { const t = syncTimes(); t[k] = -Date.now(); raw('gs.syncT', t); syncSoon(); } };
}
function setSyncState(s) { syncState = s; const el = document.getElementById('syncState'); if (el) el.textContent = s; }
function syncSoon() { if (!G.email) return; clearTimeout(syncT); setSyncState('saving…'); syncT = setTimeout(syncPush, 4000); }
async function syncFile() {
  if (syncFileId) return syncFileId;
  const f = (await gjson("files?spaces=appDataFolder&fields=files(id)&q=" + encodeURIComponent("name='" + SYNC_NAME + "'"))).files[0];
  return (syncFileId = f ? f.id : null);
}
async function syncRead() { const id = await syncFile(); return id ? await (await gfetch('files/' + id + '?alt=media')).json() : { t: {}, v: {} }; }
// Newest copy of each item wins, so work from two computers merges instead of overwriting.
async function syncPull() {
  if (!G.email || syncBusy) return;
  syncBusy = true; setSyncState('syncing…');
  try {
    const remote = await syncRead(), local = syncTimes(); let changed = 0;
    for (const [k, t] of Object.entries(remote.t || {})) {
      if (Math.abs(t) <= Math.abs(local[k] || 0)) continue;
      if (batch && k === batch.id) continue;   // the open download keeps what's on screen
      try { if (t < 0) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(remote.v[k])); } catch {}
      local[k] = t; changed++;
    }
    try { localStorage.setItem('gs.syncT', JSON.stringify(local)); } catch {}
    if (changed) {
      const l = store.get('gs.lib', null); if (l) lib = l;
      bank = store.get('gs.bank', bank);
      if (!batch) { const s = store.get('gs.setup', null); if (s) setup = { ...DEFAULT_SETUP, ...s }; }
      renderLib(); if (batch) renderClassSel();
    }
    syncBusy = false;
    if (Object.keys(local).some(k => Math.abs(local[k]) > Math.abs((remote.t || {})[k] || 0))) await syncPush(); else setSyncState('synced');
  } catch (e) { syncBusy = false; setSyncState('not synced'); console.warn(e); }
}
async function syncPush() {
  if (!G.email) return;
  if (syncBusy) { syncSoon(); return; }
  syncBusy = true; setSyncState('saving…');
  try {
    const remote = await syncRead(), local = syncTimes(), out = { t: { ...(remote.t || {}) }, v: { ...(remote.v || {}) } };
    for (const [k, t] of Object.entries(local)) if (Math.abs(t) > Math.abs(out.t[k] || 0)) { out.t[k] = t; if (t < 0) delete out.v[k]; else out.v[k] = store.get(k, null); }
    const body = JSON.stringify(out), id = await syncFile();
    if (id) await gfetch('https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    else {
      const fd = new FormData();
      fd.append('metadata', new Blob([JSON.stringify({ name: SYNC_NAME, parents: ['appDataFolder'] })], { type: 'application/json' }));
      fd.append('file', new Blob([body], { type: 'application/json' }));
      syncFileId = (await (await gfetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: fd })).json()).id;
    }
    setSyncState('synced');
  } catch (e) { setSyncState('not synced'); console.warn(e); }
  syncBusy = false;
}
window.addEventListener('focus', () => { if (G.email && !batch) syncPull(); });
// Signed in last time: reconnect quietly when the page opens.
if (GOK && G.email && gcid()) setTimeout(() => gToken(false).then(() => { renderGoogle(); syncPull(); }).catch(() => { setSyncState('sign in again to sync'); }), 400);

/* ---------------- audio, video and Word files ---------------- */
// Recordings play beside the rubric; a transcript can be made in this browser (Whisper), and Word files are shown as pages.
const MEDIA_RX = /\.(mp4|mov|m4v|webm|mkv|3gp|mp3|m4a|wav|aac|ogg|oga|opus|flac|weba|aif|aiff|caf|amr)$/i;
const VIDEO_RX = /\.(mp4|mov|m4v|webm|mkv|3gp)$/i;
const MIME = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', '3gp': 'video/3gpp', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', weba: 'audio/webm', aif: 'audio/aiff', aiff: 'audio/aiff', caf: 'audio/x-caf', amr: 'audio/amr' };
const extOf = n => (n.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
const mediaUrl = f => f.url || (f.url = URL.createObjectURL(new Blob([f.data], { type: MIME[extOf(f.name)] || '' })));
const fmtTime = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const CAN_TRANSCRIBE = window.self === window.top;   // the speech engine downloads its model; a preview frame can't
let curMedia = null;   // the first player on screen, for the keys

function mediaCard(st, f) {
  const el = document.createElement('div'); el.className = 'media';
  const vid = VIDEO_RX.test(f.name);
  el.innerHTML = '<div class="mstick"><div class="mhead"><b>' + esc(f.name) + '</b><span class="muted">' + (vid ? 'video' : 'audio') + '</span></div>' +
    (vid ? '<video controls preload="metadata" playsinline></video>' : '<audio controls preload="metadata"></audio>') +
    '<div class="mctl"><button class="btn sm" data-skip="-10">◀◀ 10s</button><button class="btn sm" data-skip="10">10s ▶▶</button>' +
    '<span class="seg">' + [1, 1.25, 1.5, 2].map(r => '<button data-rate="' + r + '" aria-pressed="' + (r === (store.get('gs.rate', 1))) + '">' + r + '×</button>').join('') + '</span>' +
    '<button class="btn sm" data-stamp title="Adds the time to your comment, like [2:15]">+ Time to comment</button>' +
    (CAN_TRANSCRIBE ? '<button class="btn sm" data-tr>' + (f.tr ? 'Transcript ✓' : 'Make transcript') + '</button>' : '') + '</div></div>' +
    '<div class="trans" ' + (f.tr ? '' : 'hidden') + '></div><p class="muted trstat" style="font-size:13px;margin:6px 0 0"></p>';
  const m = el.querySelector('audio,video');
  m.src = mediaUrl(f); m.playbackRate = store.get('gs.rate', 1);
  m.onratechange = () => {};
  m.onerror = () => { el.querySelector('.trstat').textContent = 'This browser can’t play this file. Chrome or Edge play most phone recordings; a .mov from an iPhone may need Safari or a convert to .mp4.'; };
  if (!curMedia) curMedia = m;
  const tr = el.querySelector('.trans');
  const showTr = () => {
    if (!f.tr) return;
    tr.hidden = false;
    tr.innerHTML = f.tr.w.map(([w, t], i) => '<span data-t="' + t + '" data-i="' + i + '">' + esc(w) + '</span>').join('');
  };
  showTr();
  let last = -1;
  m.ontimeupdate = () => {
    if (!f.tr) return;
    const t = m.currentTime, W = f.tr.w; let lo = 0, hi = W.length - 1, k = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (W[mid][1] <= t) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    if (k === last) return;
    const old = tr.querySelector('.now'); if (old) old.classList.remove('now');
    const sp = k >= 0 && tr.children[k]; if (sp) { sp.classList.add('now'); if (!m.paused) { const r = sp.offsetTop - tr.offsetTop; if (r < tr.scrollTop + 10 || r > tr.scrollTop + tr.clientHeight - 30) tr.scrollTop = r - 40; } }
    last = k;
  };
  el.onclick = async e => {
    const s = e.target.closest('[data-skip]'); if (s) { m.currentTime = Math.max(0, m.currentTime + +s.dataset.skip); return; }
    const r = e.target.closest('[data-rate]');
    if (r) { m.playbackRate = +r.dataset.rate; store.set('gs.rate', m.playbackRate); for (const b of el.querySelectorAll('[data-rate]')) b.setAttribute('aria-pressed', b === r); return; }
    if (e.target.closest('[data-stamp]')) { addStamp(st, m.currentTime); return; }
    const w = e.target.closest('.trans [data-t]'); if (w) { m.currentTime = +w.dataset.t; if (m.paused) m.play().catch(() => {}); return; }
    if (e.target.closest('[data-tr]')) {
      if (f.tr && !confirm('Make the transcript again? The one you have will be replaced.')) return;
      const btn = el.querySelector('[data-tr]'); btn.disabled = true;
      try { await transcribeFile(f, msg => { el.querySelector('.trstat').textContent = msg; }); btn.textContent = 'Transcript ✓'; showTr(); el.querySelector('.trstat').textContent = ''; saveSoon(); }
      catch (er) { el.querySelector('.trstat').textContent = er.message || String(er); }
      btn.disabled = false;
    }
  };
  return el;
}
function addStamp(st, t) {
  const tag = '[' + fmtTime(t) + '] ';
  st.grade.comment = (st.grade.comment && !/\s$/.test(st.grade.comment) ? st.grade.comment + '\n' : st.grade.comment || '') + tag;
  saveSoon(); renderGrade(); renderList();
  const ta = $('#cmtIn'); if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; }
}
// Word (.docx) files show as a readable page. Old .doc files can't be read in a browser.
// A link in a student's Word file keeps only web or email addresses, so a planted script link can't run here.
let mammothP = null;
async function docxHtml(bytes) {
  const r = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
  return r.value;
}
async function docxCard(f, title) {
  const el = document.createElement('div'); el.className = 'docx';
  el.innerHTML = '<div class="fhead"><span style="color:var(--fg)">' + esc(title || f.name) + '</span><span>Word file</span></div><div class="dpage"><p class="muted">Opening…</p></div>';
  try { el.querySelector('.dpage').innerHTML = await docxHtml(f.data); for (const a of el.querySelectorAll('a')) { if (!/^(https?:|mailto:|#)/i.test((a.getAttribute('href') || '').trim())) a.removeAttribute('href'); a.target = '_blank'; a.rel = 'noopener noreferrer'; } }
  catch { el.querySelector('.dpage').innerHTML = '<p>This Word file couldn’t be opened.</p>'; }
  return el;
}
// A Word document Taylor keeps beside every student in one download (her rubric and notes). Kept in this browser.
const refKey = () => 'gs.rd.' + batch.id;
function refDoc() { const r = store.get(refKey(), null); if (!r) return null; const bin = atob(r.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return { name: r.name, data: u }; }
async function pickRefDoc() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    const u = new Uint8Array(await f.arrayBuffer());
    let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    if (!store.set(refKey(), { name: f.name, b64: btoa(s) })) return toast('That document is too big to keep in this browser');
    toast('“' + f.name + '” now shows above every paper'); openStudent(cur);
  };
  inp.click();
}

/* the speech engine (same as the Interview Transcriber), in a worker so the page stays smooth */
function whisperWorker() {
  let pipeline, env, asr = null, loadedKey = '';
  const libReady = (async () => {
    ({ pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1'));
    env.allowLocalModels = false;
    let ok = false; try { ok = !!(await caches.open('gs-probe')); } catch (e) {}
    if (!ok) {
      const open = () => new Promise((res, rej) => { const r = indexedDB.open('grading-studio-models', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const key = k => typeof k === 'string' ? k : k.url;
      env.useBrowserCache = false; env.useCustomCache = true;
      env.customCache = {
        async match(k) { try { const db = await open(); const v = await new Promise((res, rej) => { const q = db.transaction('files').objectStore('files').get(key(k)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); return v ? new Response(v.body, { headers: v.headers }) : undefined; } catch (e) { return undefined; } },
        async put(k, response) { try { const body = await response.arrayBuffer(); const headers = {}; response.headers.forEach((v, n) => headers[n] = v); const db = await open(); await new Promise((res, rej) => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').put({ body, headers }, key(k)); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) {} },
      };
    }
  })();
  const MODEL = 'onnx-community/whisper-base.en_timestamped';
  const DT = { wasm: { encoder_model: 'fp32', decoder_model_merged: 'q8' }, webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' } };
  async function load() {
    if (asr) return;
    let device = 'wasm'; try { if (navigator.gpu && await navigator.gpu.requestAdapter()) device = 'webgpu'; } catch (e) {}
    const files = {};
    const progress_callback = p => { if (p.status === 'progress' && p.total) { files[p.file] = [p.loaded, p.total]; let l = 0, t = 0; for (const k in files) { l += files[k][0]; t += files[k][1]; } postMessage({ type: 'loading', loaded: l, total: t }); } };
    try { asr = await pipeline('automatic-speech-recognition', MODEL, { device, dtype: DT[device], progress_callback }); if (device === 'webgpu') await asr(new Float32Array(16000), { return_timestamps: 'word' }); }
    catch (e) { if (device !== 'webgpu') throw e; device = 'wasm'; asr = await pipeline('automatic-speech-recognition', MODEL, { device, dtype: DT.wasm, progress_callback }); }
    loadedKey = device;
  }
  async function run(audio) {
    try {
      const out = await asr(audio, { return_timestamps: 'word' });
      const w = (out.chunks || []).map(c => [c.text, c.timestamp[0]]);
      if (!w.length && out.text && out.text.trim()) throw 0;
      return w;
    } catch (e) {
      const out = await asr(audio, { return_timestamps: true }), w = [];
      for (const c of out.chunks || []) { const parts = c.text.trim().split(/\s+/).filter(Boolean), a = c.timestamp[0] || 0, b = c.timestamp[1] || audio.length / 16000; parts.forEach((p, i) => w.push([' ' + p, a + (b - a) * i / parts.length])); }
      return w;
    }
  }
  self.onmessage = async ({ data }) => {
    try {
      try { await libReady; } catch (e) { throw new Error('Couldn’t download the speech engine. Check the internet connection (it’s only needed the first time).'); }
      await load();
      if (data.type === 'load') postMessage({ type: 'ready' });
      else postMessage({ type: 'result', job: data.job, words: await run(data.audio) });
    } catch (e) { postMessage({ type: 'error', job: data.job, message: String(e && e.message || e) }); }
  };
}
let asrW = null; const asrJobs = new Map(); let asrSeq = 0, asrLoad = null;
function asrCall(msg, transfer) {
  if (!asrW) {
    asrW = new Worker(URL.createObjectURL(new Blob(['(' + whisperWorker.toString() + ')()'], { type: 'text/javascript' })));
    asrW.onmessage = ({ data }) => {
      if (data.type === 'loading') { if (asrLoad) asrLoad(data.loaded / data.total); return; }
      const j = asrJobs.get(data.job ?? 0); if (!j) return; asrJobs.delete(data.job ?? 0);
      data.type === 'error' ? j.rej(new Error(data.message)) : j.res(data);
    };
    asrW.onerror = e => { for (const j of asrJobs.values()) j.rej(new Error(e.message || 'The speech engine couldn’t start.')); asrJobs.clear(); asrW = null; };
  }
  const job = msg.type === 'load' ? 0 : ++asrSeq;
  return new Promise((res, rej) => { asrJobs.set(job, { res, rej }); asrW.postMessage({ ...msg, job }, transfer || []); });
}
const SR = 16000;
async function decodeAudio(bytes) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  let ctx; try { ctx = new Ctx({ sampleRate: SR }); } catch (e) { ctx = new Ctx(); }
  try {
    const ab = await ctx.decodeAudioData(bytes.slice().buffer);
    let x = ab.getChannelData(0).slice();
    if (ab.numberOfChannels > 1) { const b = ab.getChannelData(1); for (let i = 0; i < x.length; i++) x[i] = (x[i] + b[i]) / 2; }
    if (ab.sampleRate !== SR) { const n = Math.round(x.length * SR / ab.sampleRate), y = new Float32Array(n), r = ab.sampleRate / SR; for (let i = 0; i < n; i++) { const p = i * r, k = Math.floor(p), fr = p - k; y[i] = (x[k] || 0) * (1 - fr) + (x[k + 1] || 0) * fr; } x = y; }
    return x;
  } finally { try { ctx.close(); } catch (e) {} }
}
// Pieces of at most 28 s, cut at the quietest moment between 18 and 28 s so words aren't split.
function planChunks(x) {
  const F = 320, frames = Math.ceil(x.length / F), rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) { let s = 0; const a = f * F, b = Math.min(x.length, a + F); for (let i = a; i < b; i++) s += x[i] * x[i]; rms[f] = Math.sqrt(s / Math.max(1, b - a)); }
  const out = []; let start = 0;
  while (start < x.length) {
    if (x.length - start <= 28 * SR) { out.push([start, x.length]); break; }
    const lo = Math.floor((start + 18 * SR) / F), hi = Math.floor((start + 28 * SR) / F);
    let best = hi, bv = Infinity;
    for (let f = lo; f <= hi - 15; f++) { let v = 0; for (let k = 0; k < 15; k++) v += rms[f + k] || 0; if (v < bv) { bv = v; best = f + 7; } }
    out.push([start, best * F]); start = best * F;
  }
  return out.map(([a, b]) => { let s = 0; for (let i = a; i < b; i += 4) s += x[i] * x[i]; return { a, b, rms: Math.sqrt(s / Math.max(1, (b - a) / 4)) }; });
}
async function transcribeFile(f, say) {
  say('Starting the speech engine…');
  asrLoad = p => say('Downloading the speech engine, one time only… ' + Math.round(p * 100) + '%');
  await asrCall({ type: 'load' }); asrLoad = null;
  say('Reading the sound…');
  let x; try { x = await decodeAudio(f.data); } catch { throw new Error('This browser couldn’t read the sound in this file. Try Chrome, or convert it to .mp4 or .m4a.'); }
  const chunks = planChunks(x), dur = x.length / SR, words = [];
  for (let c = 0; c < chunks.length; c++) {
    const { a, b, rms } = chunks[c];
    if (rms > 0.002) {
      const res = await asrCall({ type: 'run', audio: x.slice(a, b) });
      for (const [w, t] of res.words) { const s = (w || '').trim(); if (!s || /^[\[(].*[\])]$/.test(s)) continue; words.push([w, +(a / SR + Math.max(0, t || 0)).toFixed(2)]); }
    }
    say('Transcribing ' + fmtTime(b / SR) + ' of ' + fmtTime(dur) + '…');
  }
  f.tr = { w: words };
}

/* ---------------- units, assignments and rosters (kept in this browser only) ---------------- */
const uid = () => Math.random().toString(36).slice(2, 10);
const fresh = store.get('gs.lib', null) == null;
let lib = store.get('gs.lib', null) || { units: [{ id: uid(), name: 'Unit 1', items: [] }, { id: uid(), name: 'Unit 2', items: [] }], classes: [] };
// Taylor's 2026-27 classes are there from the start (empty until she adds a roster); added once, so deleting one sticks.
if (!lib.seed2627) {
  for (const n of ['12EL-1', '12EL-2', '11EL-2']) if (!lib.classes.some(c => c.name.replace(/\s+/g, '').toLowerCase() === n.toLowerCase())) lib.classes.push({ id: uid(), name: n, names: [] });
  lib.seed2627 = true; store.set('gs.lib', lib);
  // A brand-new browser's starter list never wins over units and rosters already synced from another computer.
  if (fresh) { const t = syncTimes(); t['gs.lib'] = 1; try { localStorage.setItem('gs.syncT', JSON.stringify(t)); } catch {} }
}
function saveLib() { if (!store.set('gs.lib', lib)) toast('This browser is out of room to keep your units and rosters.'); }
const findItem = id => { for (const u of lib.units) { const it = u.items.find(x => x.id === id); if (it) return { u, it }; } return null; };
const classById = id => lib.classes.find(c => c.id === id);
function batchSummary(it) {
  if (!it.batchId) return 'No download opened yet';
  const data = store.get(it.batchId, null);
  const d = new Date(it.opened || (data && data.t) || Date.now());
  let n = 0;
  if (data) for (const k in data.s) { const g = data.s[k].g; if (g && (g.rubric.some(v => v != null) || g.points !== '')) n++; }
  return 'Opened ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + (data ? ' · ' + n + ' scored' : '') + ' · drop the same ZIP to keep going';
}
function renderLib() {
  $('#board').innerHTML = lib.units.map((u, ui) => '<div class="unit" draggable="true" data-unit="' + ui + '">' +
    '<div class="uhead" title="Drag to move this unit"><span class="nm">' + esc(u.name) + '</span><button class="icon" data-urename="' + ui + '" title="Rename unit" aria-label="Rename unit">✎</button>' +
    '<button class="icon" data-udel="' + ui + '" title="Delete unit" aria-label="Delete unit">✕</button></div>' +
    '<div class="cards" data-cards="' + ui + '">' + u.items.map((it, ii) => {
      const c = classById(it.classId);
      return '<div class="card" draggable="true" data-card="' + ui + ':' + ii + '"><div class="t">' + esc(it.name) + '</div>' +
        '<div class="m">' + (c ? '<span class="tag">' + esc(c.name) + '</span> ' : '') + esc(batchSummary(it)) + '</div>' +
        '<div class="row"><button class="btn sm primary" data-open-asg="' + it.id + '">Open download…</button><button class="btn sm" data-edit-asg="' + it.id + '">Edit</button></div></div>';
    }).join('') + '</div>' +
    '<button class="addcard" data-additem="' + ui + '">+ Assignment</button></div>').join('') ||
    '<div class="empty-note">No units yet. Click + Unit.</div>';
  $('#rosters').innerHTML = lib.classes.map((c, ci) => '<div class="rcard" draggable="true" data-class="' + ci + '"><b>' + esc(c.name) + '</b><span class="muted" style="font-size:13px">' + c.names.length + ' students</span>' +
    '<div style="display:flex;gap:6px;margin-top:6px"><button class="btn sm" data-edit-class="' + ci + '">Edit</button></div></div>').join('') ||
    '<div class="empty-note">No rosters yet. Click + Class and paste or upload a class list.</div>';
}
// Drag and drop for units (whole columns), assignment cards (between units) and roster cards.
let ldrag = null;
document.addEventListener('dragstart', e => {
  if (!$('#start') || $('#start').hidden) return;
  const card = e.target.closest('.card'), unit = e.target.closest('.unit'), rc = e.target.closest('.rcard');
  if (card) { const [u, i] = card.dataset.card.split(':').map(Number); ldrag = { kind: 'card', u, i, el: card }; }
  else if (rc) ldrag = { kind: 'class', i: +rc.dataset.class, el: rc };
  else if (unit) ldrag = { kind: 'unit', i: +unit.dataset.unit, el: unit };
  else return;
  e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ldrag.kind);
  setTimeout(() => ldrag && ldrag.el.classList.add('dragging'), 0);
});
function clearIns() { for (const x of document.querySelectorAll('.ins,.insEnd,.over')) x.classList.remove('ins', 'insEnd', 'over'); }
document.addEventListener('dragend', () => { if (ldrag) ldrag.el.classList.remove('dragging'); ldrag = null; clearIns(); });
function slot(list, e, horiz) {
  for (let k = 0; k < list.length; k++) { const r = list[k].getBoundingClientRect(); if (horiz ? e.clientX < r.left + r.width / 2 && e.clientY < r.bottom : e.clientY < r.top + r.height / 2) return k; }
  return list.length;
}
function libDragTarget(e) {
  if (!ldrag) return null;
  if (ldrag.kind === 'card') { const z = e.target.closest('.unit'); if (!z) return null; const cards = z.querySelector('.cards'); const list = [...cards.querySelectorAll('.card')]; return { u: +z.dataset.unit, k: slot(list, e, false), list, cards }; }
  if (ldrag.kind === 'unit') { if (!e.target.closest('#board')) return null; const list = [...$('#board').querySelectorAll('.unit')]; return { k: slot(list, e, true), list }; }
  if (ldrag.kind === 'class') { if (!e.target.closest('#rosters')) return null; const list = [...$('#rosters').querySelectorAll('.rcard')]; return { k: slot(list, e, true), list }; }
}
document.addEventListener('dragover', e => {
  const t = libDragTarget(e); if (!t) return;
  e.preventDefault(); e.stopPropagation(); clearIns();
  if (t.list[t.k]) t.list[t.k].classList.add('ins'); else if (t.cards) t.cards.classList.add('insEnd');
}, true);
document.addEventListener('drop', e => {
  const t = libDragTarget(e); if (!t) return;
  e.preventDefault(); e.stopPropagation(); clearIns();
  let k = t.k;
  if (ldrag.kind === 'card') {
    const [item] = lib.units[ldrag.u].items.splice(ldrag.i, 1);
    if (ldrag.u === t.u && ldrag.i < k) k--;
    lib.units[t.u].items.splice(k, 0, item);
  } else {
    const arr = ldrag.kind === 'unit' ? lib.units : lib.classes;
    const [x] = arr.splice(ldrag.i, 1); if (ldrag.i < k) k--; arr.splice(k, 0, x);
  }
  ldrag = null; saveLib(); renderLib();
}, true);
// A ZIP dropped straight onto an assignment card opens it as that assignment.
document.addEventListener('dragover', e => {
  if (ldrag || batch) return;
  const card = e.target.closest('.card'); if (!card || !e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
  e.preventDefault(); e.stopPropagation(); clearIns(); card.classList.add('over');
}, true);
document.addEventListener('drop', async e => {
  if (ldrag || batch) return;
  const card = e.target.closest('.card'); if (!card || !e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault(); e.stopPropagation(); clearIns(); $('#drop').classList.remove('over');
  const [u, i] = card.dataset.card.split(':').map(Number);
  const out = await entriesFromDrop(e.dataTransfer);
  intake(out.list, out.label, lib.units[u].items[i]);
}, true);

let asgTarget = null;
$('#asgIn').onchange = e => { const fs = [...e.target.files]; if (asgTarget && fs.length) intake(fs.map(f => ({ path: f.name, file: f })), fs.length === 1 ? fs[0].name.replace(/\.[^.]+$/, '') : '', asgTarget); e.target.value = ''; };
$('#start').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'addUnit') { const name = prompt('Unit name', 'Unit ' + (lib.units.length + 1)); if (name && name.trim()) { lib.units.push({ id: uid(), name: name.trim(), items: [] }); saveLib(); renderLib(); } return; }
  if (b.id === 'addClass') return editClass(-1);
  if (b.dataset.urename != null) { const u = lib.units[+b.dataset.urename]; const name = prompt('Unit name', u.name); if (name && name.trim()) { u.name = name.trim(); saveLib(); renderLib(); } return; }
  if (b.dataset.udel != null) {
    const u = lib.units[+b.dataset.udel];
    if (u.items.length && !confirm('Delete “' + u.name + '” and its ' + u.items.length + ' assignment' + (u.items.length === 1 ? '' : 's') + '? Saved marks for those downloads stay in this browser.')) return;
    lib.units.splice(+b.dataset.udel, 1); saveLib(); renderLib(); return;
  }
  if (b.dataset.additem != null) return editAssignment(null, +b.dataset.additem);
  if (b.dataset.editAsg) return editAssignment(b.dataset.editAsg);
  if (b.dataset.openAsg) {
    asgTarget = findItem(b.dataset.openAsg).it;
    if (!G.email) { $('#asgIn').click(); return; }
    openDlg('<div class="bh"><h2>Open “' + esc(asgTarget.name) + '”</h2></div><div class="bb"><p style="margin-top:0">Where is the ManageBac download?</p></div><div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn" data-pc>On this computer…</button><button class="btn primary" data-dv>In Google Drive…</button></div>', true);
    $('#dlgBox').onclick = ev => { if (ev.target.closest('[data-cancel]')) return closeDlg(); if (ev.target.closest('[data-pc]')) { closeDlg(); $('#asgIn').click(); } if (ev.target.closest('[data-dv]')) { closeDlg(); openFromDrive(asgTarget); } };
    return;
  }
  if (b.dataset.editClass != null) return editClass(+b.dataset.editClass);
});
function editAssignment(id, unitIndex) {
  const f = id ? findItem(id) : null;
  const it = f ? f.it : { id: uid(), name: '', classId: lib.classes[0] ? lib.classes[0].id : '' };
  openDlg('<div class="bh"><h2>' + (f ? 'Edit assignment' : 'New assignment') + '</h2></div><div class="bb">' +
    '<div class="field"><label for="aName">Name</label><input type="text" id="aName" value="' + esc(it.name) + '" placeholder="e.g. Ch 3 Analysis Paragraph"></div>' +
    '<div class="field"><label for="aClass">Class</label><select id="aClass" class="btn" style="justify-content:flex-start"><option value="">No roster</option>' + lib.classes.map(c => '<option value="' + c.id + '"' + (c.id === it.classId ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div>' +
    '<div class="field"><label for="aUnit">Unit</label><select id="aUnit" class="btn" style="justify-content:flex-start">' + lib.units.map((u, k) => '<option value="' + k + '"' + ((f ? f.u === u : k === unitIndex) ? ' selected' : '') + '>' + esc(u.name) + '</option>').join('') + '</select></div>' +
    '<p class="muted" style="font-size:13px;margin:0">The rubric is set the first time you open a download for it, with Rubric setup, and it’s remembered for this assignment.</p></div>' +
    '<div class="bf">' + (f ? '<button class="btn" data-del style="margin-right:auto">Delete</button>' : '') + '<button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Save</button></div>', true);
  setTimeout(() => $('#aName').focus(), 0);
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target.closest('[data-del]')) { if (!confirm('Delete “' + it.name + '”?')) return; f.u.items.splice(f.u.items.indexOf(it), 1); saveLib(); closeDlg(); return renderLib(); }
    if (e.target.closest('[data-ok]')) {
      const name = $('#aName').value.trim(); if (!name) { $('#aName').focus(); return; }
      it.name = name; it.classId = $('#aClass').value;
      const to = lib.units[+$('#aUnit').value];
      if (f && f.u !== to) f.u.items.splice(f.u.items.indexOf(it), 1);
      if (!f || f.u !== to) to.items.push(it);
      saveLib(); closeDlg(); renderLib();
    }
  };
}
// Class lists: pasted from a spreadsheet, or a .csv / .txt file. Student ID columns (numbers) are skipped.
function parseRoster(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim()).filter(c => c && !/^\d[\d\s-]*$/.test(c));
    if (!cells.length || /^(name|student|students|first|last|first name|last name|student name)$/i.test(cells[0])) continue;
    out.push(cells.slice(0, 2).join(cells.length > 1 && !/,/.test(cells[0]) ? ' ' : ', '));
  }
  return out;
}
function editClass(ci) {
  const c = ci >= 0 ? lib.classes[ci] : { id: uid(), name: '', names: [] };
  openDlg('<div class="bh"><h2>' + (ci >= 0 ? 'Edit roster' : 'New roster') + '</h2></div><div class="bb">' +
    '<div class="field"><label for="cName">Class name</label><input type="text" id="cName" value="' + esc(c.name) + '" placeholder="e.g. 11EL-2"></div>' +
    '<div class="field"><label for="cNames">Students, one per line, in the order you want (ManageBac order works well)</label><textarea class="big" id="cNames" placeholder="Paste from a spreadsheet or ManageBac, or upload a file">' + esc(c.names.join('\n')) + '</textarea></div>' +
    '<button class="btn sm" data-up>Upload a list (.csv or .txt)…</button><input type="file" id="cFile" accept=".csv,.txt,text/csv,text/plain" hidden>' +
    '<p class="muted" style="font-size:13px">Kept in this browser, and in your own Google Drive if you sign in.</p></div>' +
    '<div class="bf">' + (ci >= 0 ? '<button class="btn" data-del style="margin-right:auto">Delete</button>' : '') + '<button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Save</button></div>', true);
  $('#cFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; $('#cNames').value = parseRoster(await f.text()).join('\n'); e.target.value = ''; };
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-up]')) return $('#cFile').click();
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target.closest('[data-del]')) { if (!confirm('Delete the ' + c.name + ' roster?')) return; lib.classes.splice(ci, 1); saveLib(); closeDlg(); return renderLib(); }
    if (e.target.closest('[data-ok]')) {
      const name = $('#cName').value.trim(); if (!name) { $('#cName').focus(); return; }
      c.name = name; c.names = parseRoster($('#cNames').value);
      if (ci < 0) lib.classes.push(c);
      saveLib(); closeDlg(); renderLib();
    }
  };
}
// Matching folder names to roster names: every word of one appears in the other, in any order ("Doe, Sam" = "Sam Doe").
const nameWords = s => (String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+|[^\x00-\x7f\s,.()_-]+/g) || []);
function rosterMatch(names) {
  const used = new Set(), map = new Map();
  const studs = batch.students.map(st => ({ st, w: new Set(nameWords(st.key)) }));
  for (const n of names) {
    const w = nameWords(n); if (!w.length) continue;
    const hits = studs.filter(x => !used.has(x.st) && (w.every(t => x.w.has(t)) || ([...x.w].length >= 2 && [...x.w].every(t => w.includes(t)))));
    if (hits.length === 1) { used.add(hits[0].st); map.set(n, hits[0].st); }
  }
  return map;
}
function batchClass() { const id = batch && (batch.classId != null ? batch.classId : batch.assignment && batch.assignment.classId); return id ? classById(id) : null; }
function renderClassSel() {
  const sel = $('#classSel'), c = batchClass();
  sel.hidden = !lib.classes.length;
  sel.innerHTML = '<option value="">No roster</option>' + lib.classes.map(k => '<option value="' + k.id + '"' + (c && c.id === k.id ? ' selected' : '') + '>' + esc(k.name) + '</option>').join('');
}
$('#classSel').onchange = e => { batch.classId = e.target.value; if (batch.assignment) { batch.assignment.classId = e.target.value; saveLib(); } saveSoon(); };

/* ---------------- sample papers (made-up names) ---------------- */
async function makeSample() {
  const names = ['Sample Student 01', 'Sample Student 02', 'Sample Student 03', 'Sample Student 04', 'Sample Student 05'];
  const para = 'In When the Emperor Was Divine, Otsuka uses quiet, plain diction to build a mood of loss. When the mother buries the family dog, the narrator does not describe her feelings at all, which makes the silence feel heavier. The short sentences slow the reader down and make each small action matter.';
  const entries = [];
  for (let i = 0; i < names.length; i++) {
    if (i === 3) continue;   // one student turned nothing in
    const doc = await PDFLib.PDFDocument.create();
    const font = await doc.embedFont(PDFLib.StandardFonts.TimesRoman);
    const page = doc.addPage([612, 792]);
    page.drawText('Analysis Paragraph', { x: 72, y: 720, size: 16, font });
    let y = 690;
    for (let k = 0; k < 3; k++) {
      const words = para.split(' '); let line = '';
      for (const w of words) { if (font.widthOfTextAtSize(line + w, 12) > 468) { page.drawText(line, { x: 72, y, size: 12, font }); y -= 22; line = ''; } line += w + ' '; }
      page.drawText(line, { x: 72, y, size: 12, font }); y -= 34;
    }
    entries.push({ path: names[i] + '/Analysis paragraph.pdf', data: await doc.save() });
  }
  entries.push({ path: names[3] + '/', data: null });
  await intake(entries.filter(e => e.data), 'Sample assignment');
  // the empty folder: add the student with no files so the list shows the gap
  if (!batch.students.find(s => s.key === names[3])) { batch.students.splice(3, 0, { key: names[3], files: [], grade: { rubric: [], points: '', comment: '' } }); restore(); renderList(); $('#batchName').textContent = batch.name + ' · ' + batch.students.length + ' students'; }
}

/* ---------------- wiring ---------------- */
let toastT;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3000);
}
$('#pickFiles').onclick = () => $('#fileIn').click();
$('#pickFolder').onclick = () => $('#dirIn').click();
$('#pickDrive').onclick = () => openFromDrive(null);
$('#sample').onclick = makeSample;
$('#fileIn').onchange = e => { const fs = [...e.target.files]; intake(fs.map(f => ({ path: f.name, file: f })), fs.length === 1 ? fs[0].name.replace(/\.[^.]+$/, '') : ''); e.target.value = ''; };
$('#dirIn').onchange = e => {
  const fs = [...e.target.files];
  const top = fs.length ? (fs[0].webkitRelativePath || '').split('/')[0] : '';
  intake(fs.map(f => ({ path: (f.webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name, file: f })), top);
  e.target.value = '';
};
const drop = $('#drop');
['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => { if (batch || ldrag) return; e.preventDefault(); if (e.target.closest && e.target.closest('.card')) return; drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { if (ev === 'dragleave' && e.relatedTarget) return; drop.classList.remove('over'); }));
async function entriesFromDrop(dt) {
  const out = [];
  const entries = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  let label = '';
  if (entries.length) {
    if (entries.length === 1 && entries[0].isDirectory) {   // the dropped folder is the assignment itself
      label = entries[0].name;
      const tmp = []; await walkEntry(entries[0], '', tmp);
      for (const t of tmp) out.push({ path: t.path.split('/').slice(1).join('/'), file: t.file });
    } else for (const en of entries) await walkEntry(en, '', out);
  } else for (const f of dt.files) out.push({ path: f.name, file: f });
  return { list: out, label };
}
document.addEventListener('drop', async e => {
  if (batch) return;
  e.preventDefault();
  if (!e.dataTransfer || !e.dataTransfer.files.length) return;
  const r = await entriesFromDrop(e.dataTransfer);
  intake(r.list, r.label);
});
$('#setupBtn').onclick = openSetup;
$('#gradesBtn').onclick = openGrades;
$('#sheetBtn').onclick = () => openSheet(false);
$('#exportBtn').onclick = openExport;
$('#shareBtn').onclick = openShare;
$('#backBtn').onclick = openBringBack;
$('#closeBtn').onclick = () => {
  saveNow(); commitEditors();
  for (const d of docs) d.destroy();
  batch = null; pages = []; docs = [];
  $('#app').hidden = true; $('#start').hidden = false; $('#paper').innerHTML = ''; renderLib();
};
document.addEventListener('keydown', e => {
  if (!batch || !$('#dlg').hidden) { if (e.key === 'Escape' && !$('#dlg').hidden) closeDlg(); return; }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); undo(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (curMedia && curMedia.isConnected) {
    if (e.key === ' ') { e.preventDefault(); curMedia.paused ? curMedia.play().catch(() => {}) : curMedia.pause(); return; }
    if (e.key.toLowerCase() === 'j') { curMedia.currentTime = Math.max(0, curMedia.currentTime - 5); return; }
    if (e.key.toLowerCase() === 'l') { curMedia.currentTime += 5; return; }
  }
  const map = { v: 'select', p: 'pen', h: 'hl', o: 'oval', t: 'text', c: 'note', k: 'check', e: 'erase' };
  if (map[e.key.toLowerCase()]) { setTool(map[e.key.toLowerCase()]); return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); openStudent(cur + 1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); openStudent(cur - 1); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); deleteSelected(); }
  if (e.key === 'Escape' && selected) { selected = null; redrawAll(); }
});
window.addEventListener('beforeunload', saveNow);
renderLib(); renderGoogle();
window.__gs = { intake, parseGrade, scanFile, scanAll, state: () => ({ batch, cur, setup, pages }), gradeOf, percentFor, flattenDoc, exportPlan, layoutOf, docIn, openStudent, setTool };
