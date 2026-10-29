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
const RUBRIC_STEPS = [1, 1.5, 2, 2.5, 3, 3.5, 4];
const SCALE_FIVES = { 12: 100, 11: 95, 10: 90, 9: 85, 8: 80, 7: 75, 6: 70, 5: 65, 4: 60, 3: 55, 2: 50, 1: 45, 0: 40 };
const DEFAULT_SETUP = { mode: 'rubric', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 10, scale: SCALE12 };
let setup = { ...DEFAULT_SETUP, ...store.get('gs.setup', {}) };

function maxPoints() { return setup.mode === 'rubric' ? setup.criteria.length * 4 : +setup.outOf || 0; }
// Uses the grading scale when its top score matches the total possible; half points fall between two rows.
// Percents are whole numbers, with halves rounded up (10.5 between 95 and 90 is 92.5, so 93%), as on Taylor's rubrics.
const roundPct = v => Math.max(0, Math.round(v + 1e-9));
function percentFor(total) { return percentWith(total, maxPoints(), setup.scale); }
function percentWith(total, max, sc) {
  if (total == null || total === '' || isNaN(total)) return null;
  if (!max) return null;
  const keys = sc ? Object.keys(sc).map(Number).filter(k => sc[k] !== '' && sc[k] != null && !isNaN(+sc[k])).sort((a, b) => a - b) : [];
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
    return roundPct(v);
  }
  return roundPct(total / max * 100);
}
function gradeOf(st) {
  const own = ownGrade(st);
  if (own.total != null) return own;
  const ty = st.grade.sheet;   // typed on the Grade sheet from the picture, for handwritten grades
  if (ty !== '' && ty != null && !isNaN(+ty)) return { total: +ty, pct: percentFor(+ty), done: true, paper: true };
  if (!st.found || !st.found.found) return own;
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
const DISP0 = { ui: 1, tsize: 14, fit: 'width', dfs: 15, dlh: 1.45, trim: true };
let disp = { ...DISP0, ...store.get('gs.disp', {}) };   // Display panel: app text size, new text box size, paper fit, Word doc text
let zoom = store.get('gs.zoom', 1);
let undoStack = [];
let selected = null;     // { page, mark }
let bank = store.get('gs.bank', []);   // Taylor's saved comments (her own words, no student data)

/* ---------------- intake ---------------- */
const isPdf = n => /\.pdf$/i.test(n), isImg = n => /\.(png|jpe?g)$/i.test(n);
const junk = p => /(^|\/)(__MACOSX|\.)/.test(p);
// Names in ZIPs made without the "UTF-8" flag (Mac and Windows often skip it) come out garbled, like "JosÃ©";
// read them back as UTF-8 when they are.
function zipName(n) {
  if (!/[\u0080-\u00ff]/.test(n) || /[^\u0000-\u00ff]/.test(n)) return n;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(n, c => c.charCodeAt(0))); } catch { return n; }
}
// Files packed in a way a browser can't unpack (anything but the usual "deflate" or no packing) are skipped and counted.
let zipSkipped = 0;
function unzipInto(data, prefix, raw, depth) {
  const un0 = fflate.unzipSync(data, { filter: f => { if (junk(f.name) || f.name.endsWith('/')) return false; if (f.compression !== 0 && f.compression !== 8) { zipSkipped++; return false; } return true; } });
  const un = {}; for (const [k, v] of Object.entries(un0)) un[zipName(k)] = v;
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
async function intake(entries, label, assignment, fromKeep) {   // entries: [{ path, file|data }]
  const raw = [], zipProblems = []; zipSkipped = 0;
  for (const e of entries) {
    if (junk(e.path)) continue;
    if (/\.zip$/i.test(e.path)) {
      const data = e.data || new Uint8Array(await e.file.arrayBuffer());
      // A ZIP inside a student's folder (they turned in a ZIP) opens inside that folder, not as new students.
      const dir = e.path.includes('/') ? e.path.slice(0, e.path.lastIndexOf('/') + 1) : '';
      if (data.length > 30e6) { toast('Opening the ZIP…', 20000); await new Promise(r => setTimeout(r, 30)); }
      try { unzipInto(data, dir, raw, dir ? 1 : 0); }
      catch (er) { console.error(er); zipProblems.push(e.path.split('/').pop()); if (dir) raw.push({ path: e.path, data }); continue; }
      if (!label && !dir) label = e.path.split('/').pop().replace(/\.zip$/i, '');
      continue;
    }
    raw.push({ path: e.path, file: e.file, data: e.data });
  }
  const zipNote = zipProblems.length ? zipProblems.join(', ') + (zipProblems.length === 1 ? ' couldn’t be opened. It may be damaged or still downloading.' : ' couldn’t be opened.') + ' Try unzipping it in Finder (double-click it), then choose the folder.'
    : zipSkipped ? zipSkipped + (zipSkipped === 1 ? ' file in the ZIP is' : ' files in the ZIP are') + ' packed in a way a browser can’t open. Unzip it in Finder (double-click it), then choose the folder.' : '';
  if (!raw.length) { toast(zipNote || 'Nothing found in what you dropped', zipNote ? 9000 : 3000); return; }
  if (zipNote) setTimeout(() => toast(zipNote, 9000), 900);

  // One student per top-level folder; loose files are one student each.
  const map = new Map();
  for (const r of raw) {
    if (/^Grade sheet - [^/]*\.pdf$/i.test(r.path)) continue;   // the grade sheet from an earlier export isn't a student
    const parts = r.path.split('/').filter(Boolean);
    const key = parts.length > 1 ? parts[0] : parts[0].replace(/\.[^.]+$/, '');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  const keys = [...map.keys()].sort(natural);
  const students = [], keepList = [];
  for (const key of keys) {
    const files = [];
    for (const r of map.get(key).sort((a, b) => natural(a.path, b.path))) {
      const data = r.data || (r.file ? new Uint8Array(await r.file.arrayBuffer()) : null);
      keepList.push({ path: r.path, data });
      files.push(await makeFile(r.path, data));
    }
    students.push({ key, files, grade: { rubric: [], points: '', comment: '' }, layout: null, inc: {} });
  }
  const id = 'gs.b.' + hash(students.map(s => s.files.map(f => f.path + ':' + f.size).join('|')).join('/'));
  batch = { id, name: (assignment && assignment.name) || label || 'Your download', students, assignment: assignment || null };
  delete setup.spot;   // the grade spot belongs to one download
  if (assignment) { setup = { ...DEFAULT_SETUP, ...(assignment.setup || store.get('gs.setup', {})) }; delete setup.spot; }
  thumbCache.clear();
  askToKeep();
  if (!store.get(id, null)) batch.keptWork = await kget('work', id);   // this browser's backup copy of the work
  const saved = store.get(id, null) || batch.keptWork || null;
  if (!assignment && saved && saved.setup) setup = { ...DEFAULT_SETUP, ...saved.setup };
  await applyRubricPage();
  await loadAdded();
  await loadRefs();
  await loadEdits();
  restore();
  if (saved && saved.cls != null) batch.classId = saved.cls;
  rosterSort();
  if (batch.restoredKey) { const k = batch.students.findIndex(st => st.key === batch.restoredKey); if (k >= 0) batch.restoredCur = k; }
  renderClassSel();
  if (assignment) { assignment.batchId = id; assignment.opened = Date.now(); saveLib(); }
  keepPapers(batch, label, fromKeep ? null : keepList);
  cur = 0; undoStack = []; selected = null;
  $('#start').hidden = true; $('#app').hidden = false;
  setBatchName();
  $('#trAllBtn').hidden = !CAN_TRANSCRIBE || !students.some(st => st.files.some(f => f.kind === 'media'));
  renderTools(); renderList(); renderTopAtlas(); openStudent(batch.restoredCur || 0);
  scanned = false; scanAll();
  setTimeout(wordScoresAll, 50);
}
async function makeFile(path, data) {
  const name = path.split('/').pop();
  const magic = data && data.length > 4 && data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46;   // "%PDF"
  let kind = isPdf(name) || magic ? 'pdf' : isImg(name) || IMG_MORE.test(name) ? 'img' : MEDIA_RX.test(name) ? 'media' : WORD_RX.test(name) ? 'docx' : TEXT_RX.test(name) ? 'text' : 'other';
  let pdf = kind === 'pdf' ? data : null;
  if (kind === 'pdf' && hasGsTail(data)) {   // a file exported from here with its marks kept: back to the original pages and the marks
    const back = await unpackExport(data);
    if (back) return { path, name, kind, data: back.data, size: data.length, marks: back.marks, rot: back.rot, pages: null };
  }
  if (kind === 'img') { try { pdf = isImg(name) ? await imageToPdf(data, name) : await anyImageToPdf(data); } catch { kind = 'other'; } }
  return { path, name, kind, data: kind === 'pdf' || kind === 'img' ? pdf : data, size: data ? data.length : 0, marks: {}, pages: null };
}
// An editable export carries its original pages and its marks as attachments, and ends with this line so it's found without opening it.
const GS_TAIL = '%GradingStudio-editable';
const hasGsTail = d => !!d && d.length > 64 && new TextDecoder().decode(d.subarray(d.length - 64)).includes(GS_TAIL);
async function unpackExport(data) {
  try {
    await workerReady;
    const js = await pdfjsLib.getDocument({ data: data.slice(), isEvalSupported: false }).promise;
    const att = (await js.getAttachments()) || {}; js.destroy();
    const meta = att['grading-studio.json']; if (!meta) return null;
    const info = JSON.parse(new TextDecoder().decode(meta.content)), srcs = [], marks = {}, rot = {};
    info.pages.forEach(([, , m, r], i) => { if (m && m.length) marks[i] = m; if (r) rot[i] = r; });
    const orig = k => att['gs-original-' + (k + 1) + '.pdf'].content;
    const one = info.pages.every(([s]) => s === 0) && info.pages.every(([, p], i) => p === i);
    if (one) {   // the whole original in order: kept exactly as it was
      const src = await PDFLib.PDFDocument.load(orig(0), { ignoreEncryption: true, updateMetadata: false });
      if (src.getPageCount() === info.pages.length) return { data: orig(0), marks, rot };
    }
    const out = await PDFLib.PDFDocument.create();
    for (const [s, p] of info.pages) {
      srcs[s] ||= await PDFLib.PDFDocument.load(orig(s), { ignoreEncryption: true, updateMetadata: false });
      const [cp] = await out.copyPages(srcs[s], [p]); out.addPage(cp);
    }
    return { data: await out.save(), marks, rot };
  } catch (e) { console.error(e); return null; }
}
// Pictures other than PNG and JPEG (GIF, WebP, BMP, and HEIC/TIFF where the browser can read them) become a JPEG page.
const IMG_MORE = /\.(gif|webp|bmp|heic|heif|tiff?|avif)$/i, TEXT_RX = /\.(txt|md|rtf)$/i;
async function anyImageToPdf(bytes) {
  const bmp = await createImageBitmap(new Blob([bytes]));
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0);
  const jpg = await new Promise(res => c.toBlob(b => b.arrayBuffer().then(x => res(new Uint8Array(x))), 'image/jpeg', 0.92));
  c.width = c.height = 0;
  return imageToPdf(jpg, 'page.jpg');
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
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(saveNow, 500); const el = $('#saveState'); if (el && batch) el.textContent = 'Saving…'; }
function saveNow() {
  if (!batch) return;
  clearTimeout(saveT);
  { const el = $('#saveState'); if (el) el.textContent = '✓ Saved'; }
  const data = { t: Date.now(), cur, ck: batch.students[cur] && batch.students[cur].key, setup, cls: batch.classId, share: batch.share, drive: batch.drive, light: batch.light, lightOpt: batch.lightOpt, lightPg: batch.lightPg, anon: batch.anon, moved: batch.moved, s: {} };
  for (const st of batch.students) {
    const f = {};
    for (const fl of st.files) if (Object.values(fl.marks).some(a => a.length)) f[fl.path] = fl.marks;
    const g = st.grade;
    const hb = {};
    for (const fl of st.files) if (fl.hand) hb[fl.path] = fl.hand;
    const inc = st.inc && Object.keys(st.inc).length ? st.inc : undefined;
    const tr = {}; for (const fl of st.files) if (fl.tr) tr[fl.path] = fl.tr;
    const rt = {}; for (const fl of st.files) if (fl.rot && Object.keys(fl.rot).length) rt[fl.path] = fl.rot;
    if (Object.keys(rt).length || Object.keys(tr).length || Object.keys(hb).length || st.layout || st.forder || inc || Object.keys(f).length || g.rubric.some(v => v != null) || g.points !== '' || g.comment || g.sheet)
      data.s[st.key] = { f, g, h: hb, L: st.layout || undefined, o: st.forder || undefined, inc, tr: Object.keys(tr).length ? tr : undefined, r: Object.keys(rt).length ? rt : undefined };
  }
  keepWork(batch, data);
  const idx = store.get('gs.batches', {}); idx[batch.id] = data.t;
  let ok = store.set(batch.id, data);
  // The full copy of every download lives in IndexedDB (keepWork). Only once that works are older quick copies
  // in localStorage let go, so nothing is ever only in one place that gets cleared.
  if (keepOk) {
    const order = Object.entries(idx).sort((a, b) => b[1] - a[1]).map(([k]) => k);
    for (const k of order.slice(12)) { store.del(k); delete idx[k]; }
    while (!ok && order.length > 1) { const k = order.pop(); if (k === batch.id) continue; store.del(k); delete idx[k]; ok = store.set(batch.id, data); }
  } else if (!ok) toast('This browser is out of room to keep your marks. Export soon.');
  store.set('gs.batches', idx);
}
function restore() {
  const data = store.get(batch.id, null) || batch.keptWork || null;
  if (!data) return;
  if (data.setup && !batch.assignment) setup = { ...DEFAULT_SETUP, ...data.setup };
  else if (data.setup && data.setup.spot) setup.spot = data.setup.spot;
  batch.moved = data.moved || {};
  for (const [path, key] of Object.entries(batch.moved)) moveFileNow(path, key);
  let n = 0;
  for (const st of batch.students) {
    const s = data.s[st.key]; if (!s) continue;
    if (s.o) st.forder = s.o;
    st.grade = { rubric: [], points: '', comment: '', ...s.g };
    for (const fl of st.files) { if (s.f[fl.path]) fl.marks = s.f[fl.path]; if (s.h && s.h[fl.path]) fl.hand = s.h[fl.path]; if (s.tr && s.tr[fl.path]) fl.tr = s.tr[fl.path]; if (s.r && s.r[fl.path]) fl.rot = s.r[fl.path]; }
    if (s.L) st.layout = s.L.map(d => ({ ...d, pages: d.pages.filter(([path]) => st.files.some(f => f.path === path)) }));
    if (s.inc) st.inc = s.inc;
    n++;
  }
  if (data.share) batch.share = data.share;
  if (data.light) batch.light = data.light;
  if (data.lightOpt) batch.lightOpt = data.lightOpt;
  if (data.lightPg) batch.lightPg = data.lightPg;
  if (data.anon) batch.anon = data.anon;
  if (data.drive && !batch.drive) batch.drive = data.drive;
  batch.restoredCur = Math.min(data.cur || 0, batch.students.length - 1); batch.restoredKey = data.ck;
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
  const room = Math.max(40, W - m.x - 6), maxW = m.bw ? Math.max(24, Math.min(m.bw, room)) : room;
  const lines = wrapText(measureCtx, m.text || '', maxW);
  const w = m.bw ? maxW : Math.max(10, ...lines.map(l => measureCtx.measureText(l).width));
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
  for (const m of marks) {
    if (m.t === 'hl') { ctx.fillStyle = m.color; ctx.fillRect(m.x, m.y, m.w, m.h); }
    else if (m.t === 'note' && m.hl) { ctx.fillStyle = m.hc || HL.yellow; ctx.fillRect(m.hl.x, m.hl.y, m.hl.w, m.hl.h); }
  }
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
    if (bb) {
      ctx.save(); ctx.strokeStyle = '#1F6FB2'; ctx.setLineDash([3, 2]); ctx.lineWidth = 0.8; ctx.strokeRect(bb.x - 3, bb.y - 3, bb.w + 6, bb.h + 6);
      if (screen.sel.t === 'text') {   // drag this edge to set where the text wraps
        const h = textHandle(screen.sel, W);
        ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.lineWidth = 1.2; ctx.fillRect(h.x - 2.5, h.y - 6, 5, 12); ctx.strokeRect(h.x - 2.5, h.y - 6, 5, 12);
      }
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
  if (m.t === 'note') return m.hl ? { ...m.hl } : { x: m.ax - 5, y: m.ay - 5, w: 10, h: 10 };
  return null;
}
function textHandle(m, W) { const bb = bboxOf(m, W); return { x: bb.x + bb.w + 3, y: bb.y + Math.min(bb.h / 2, 10), top: bb.y, bottom: bb.y + bb.h }; }
// A text box never runs off the page: it stays inside on the right and moves up from the bottom edge.
function keepOnPage(m, W, H) {
  m.x = r1(clamp(m.x, 0, W - 30));
  if (m.bw) m.bw = r1(Math.min(m.bw, W - m.x - 6));
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
// A page turned by Taylor (f.rot[page]: 90, 180 or 270, clockwise) on top of the PDF's own turn. Marks are kept
// in the turned page's points, so every place that draws a page asks for its viewport here.
const rotOf = (f, p) => (f && f.rot && f.rot[p]) || 0;
const vpRot = (f, p, page, scale) => page.getViewport({ scale, rotation: ((page.rotate || 0) + rotOf(f, p)) % 360 });
const viewable = f => f.kind === 'pdf' || f.kind === 'img';
const fileByPath = (st, path) => st.files.find(f => f.path === path);
function defaultLayout(st) {
  const L = st.files.filter(f => viewable(f) && !f.virtual && f.numPages).map(f => ({ name: f.name, file: f.path, pages: [...Array(f.numPages).keys()].map(p => [f.path, p]) }));
  const v = st.files.find(f => f.virtual && viewable(f));
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
  if (docAdded(st, d)) return true;   // a file you added goes back unless you leave it out
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

/* ---------------- the order of a student's files on screen: Word and other files among the PDF files ---------------- */
// Ids: 'f:<path>' for a file shown as one card (Word, text, other), 'd<n>' for the n-th file of pages in the layout.
// Untouched, cards come first and her Rubric setup Word rubric goes where Rubric setup puts it.
function fileSeq(st) {
  const L = layoutOf(st), rl = setup.rubricPos === 'end', of = k => st.files.filter(f => f.kind === k);
  const def = [...of('other'), ...of('text'), ...of('docx').filter(f => !(f.rubric && rl))].map(f => ({ id: 'f:' + f.path, f }))
    .concat(L.map((d, di) => ({ id: 'd' + di, d, di })))
    .concat(of('docx').filter(f => f.rubric && rl).map(f => ({ id: 'f:' + f.path, f })));
  const o = st.forder; if (!o) return def;
  const rank = (it, k) => { const i = o.indexOf(it.id); return i >= 0 ? i : o.length + k; };
  return def.map((it, k) => [rank(it, k), k, it]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
}
// A kind of file, to line up the same order on every student's paper: "their Word file you added", "the PDF they turned in"…
const seqSig = (st, it) => it.f ? it.f.kind + (it.f.rubric ? 'R' : '') + (it.f.added ? 'A' : '') : 'doc' + (it.d.pages.length && (fileByPath(st, it.d.pages[0][0]) || {}).added ? 'A' : '') + ((fileByPath(st, (it.d.pages[0] || [])[0]) || {}).virtual ? 'R' : '');

/* ---------------- a file in the wrong student's folder: move it to the right one ---------------- */
// The file keeps its path, marks and edits; batch.moved remembers the move so it holds when the download is opened again.
const moveLink = f => '<button class="link" style="font-size:13px;margin-right:10px" data-mvfile="' + esc(f.path) + '" title="This file belongs to someone else? Move it to the right student">Move to…</button>';
function moveFileNow(path, key) {
  const src = batch.students.find(s => s.files.some(f => f.path === path)), dst = batch.students.find(s => s.key === key);
  if (!src || !dst || src === dst || dst.files.some(f => f.path === path)) return null;
  const f = fileByPath(src, path);
  src.files.splice(src.files.indexOf(f), 1); dst.files.push(f);
  return { src, dst, f };
}
function moveFile(st, path, dst) {
  const L0 = layoutOf(st), m = moveFileNow(path, dst.key);
  if (!m) return toast(dst.files.some(f => f.path === path) ? dst.key + ' already has this file' : 'Couldn’t move that file');
  const { f } = m;
  // a scored Word rubric that was in the wrong folder takes its score with it
  const ws = wordScore(f);
  if (ws && ws.total != null && ownGrade(st).total === ws.total) { st.grade.points = ''; st.grade.rubric = []; }
  if (st.layout || L0.some(d => d.pages.some(([q]) => q !== path) && d.pages.some(([q]) => q === path))) {
    st.layout = L0.map(d => ({ ...d, pages: d.pages.filter(([q]) => q !== path) })).filter(d => d.pages.length);
    if (!st.layout.length) st.layout = null;
  }
  if (dst.layout && viewable(f) && f.numPages) dst.layout.push({ name: f.name, file: f.path, pages: [...Array(f.numPages).keys()].map(p => [f.path, p]) });
  if (st.inc && st.inc[path] != null) { (dst.inc ||= {})[path] = st.inc[path]; delete st.inc[path]; }
  if (st.forder) st.forder = st.forder.filter(x => x !== 'f:' + path);
  if (batch.lightPg) for (const k of Object.keys(batch.lightPg)) if (k.startsWith(st.key + '|' + path + '|')) { batch.lightPg[dst.key + k.slice(st.key.length)] = batch.lightPg[k]; delete batch.lightPg[k]; }
  (batch.moved ||= {})[path] = dst.key;
  refound(st); refound(dst); wordScoresAll(); saveNow(); renderList(); openStudent(cur);
  toast('Moved ' + f.name + ' to ' + shownName(dst, batch.students.indexOf(dst)));
}
function openMoveFile(st, path) {
  const f = fileByPath(st, path); if (!f) return;
  const others = batch.students.map((s, i) => ({ s, i })).filter(x => x.s !== st);
  openDlg('<div class="bh"><h2>Move ' + esc(f.name) + '</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb"><p class="muted" style="margin:0 0 10px;font-size:14px">The file goes to that student with your marks on it. Moving it back works the same way.</p>' +
    '<input class="btn" id="mvFind" placeholder="Type a name" autocomplete="off" style="width:100%;margin-bottom:8px"><div id="mvList" class="mvlist"></div></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button></div>', true);
  const draw = () => {
    const q = $('#mvFind').value.toLowerCase().split(/\s+/).filter(Boolean);
    const list = others.filter(x => q.every(w => x.s.key.toLowerCase().split(/[\s,_-]+/).some(y => y.startsWith(w))));
    $('#mvList').innerHTML = list.length ? list.map((x, k) => '<button class="mvrow' + (k === 0 && q.length ? ' top' : '') + '" data-mvto="' + x.i + '">' + esc(x.s.key) + '<span class="muted">' + x.s.files.length + (x.s.files.length === 1 ? ' file' : ' files') + '</span></button>').join('') : '<p class="muted">No name matches.</p>';
  };
  draw();
  const box = $('#dlgBox');
  $('#mvFind').oninput = draw;
  $('#mvFind').onkeydown = e => { if (e.key === 'Enter') { const b = $('#mvList [data-mvto]'); if (b) b.click(); } };
  box.onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    const b = e.target.closest('[data-mvto]'); if (!b) return;
    closeDlg(); moveFile(st, path, batch.students[+b.dataset.mvto]);
  };
  $('#mvFind').focus();
}

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
  if ($('#lightPanel')) $('#lightPanel').refresh();
  const token = ++openToken;
  for (const d of docs) d.destroy();
  docs = []; pages = []; docMap = new Map();
  renderList(); renderGrade(); saveSoon();
  const st = batch.students[cur];
  const paper = $('#paper');
  paper.innerHTML = '<div class="who"><h2>' + esc(shownName(st, cur)) + '</h2><span>' + ((anonOn() ? anonPos(cur) : cur) + 1) + ' of ' + batch.students.length + '</span><span style="flex:1"></span>' +
    '<button class="btn sm" id="addFileBtn" title="Add a late or forgotten file to this student. You can also drop files on the paper or on a name.">+ Add file</button>' +
    (st.files.some(viewable) || fileSeq(st).length > 1 ? '<button class="btn sm" id="arrangeBtn">Arrange pages</button>' : '') + '</div>';
  paper.scrollTop = 0;
  if (!st.files.length) {
    paper.insertAdjacentHTML('beforeend', '<div class="nofile"><b>Nothing turned in yet.</b> Add their paper here, or drop the file on the page or on their name. You can still give a score without one.' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn sm primary" id="gapFile">Add their file…</button>' + (st.gap || batch.students.some(x => x.files.length) ? '<button class="btn sm" id="gapScan">From a scan…</button>' : '') + '</div></div>');
    $('#gapFile').onclick = () => pickAdd(st);
    const gs = $('#gapScan'); if (gs) gs.onclick = () => { scanInto = true; scanFor = null; $('#scanIn').click(); };
  }
  curMedia = null;
  for (const f of st.files.filter(f => f.kind === 'media')) { if (f.added) paper.insertAdjacentHTML('beforeend', '<div class="fhead"><span style="color:var(--fg)">' + esc(f.name) + '</span>' + addTag(f) + '</div>'); paper.appendChild(mediaCard(st, f)); }
  const rd = refDoc();
  if (rd) { const det = document.createElement('details'); det.className = 'refd'; det.open = store.get('gs.rdOpen', true); det.innerHTML = '<summary>Your document: ' + esc(rd.name) + '</summary>'; det.ontoggle = () => store.set('gs.rdOpen', det.open); paper.appendChild(det); docxCard(rd, rd.name).then(c => { c.querySelector('.fhead').remove(); det.appendChild(c); }); }
  for (const r of refFiles) { const hold = document.createElement('div'); paper.appendChild(hold); refCard(r).then(c => { if (token === openToken) hold.replaceWith(c); }); }
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
  for (const it of fileSeq(st)) {
    if (it.f) {   // a Word, text or other file, as one card
      const f = it.f, c = f.kind === 'docx' ? await wordCard(st, f) : f.kind === 'text' ? textCard(f) : otherCard(f);
      if (token !== openToken) return;
      const fh = c.querySelector('.fhead'); if (fh && !f.virtual && !f.rubric) fh.insertAdjacentHTML('beforeend', moveLink(f));
      paper.appendChild(c);
      if (filePath && f.path === filePath) c.scrollIntoView({ block: 'start' });
      continue;
    }
    const d = it.d, di = it.di, on = docIn(st, d), auto = docAuto(st, d), af = d.file && fileByPath(st, d.file);
    const one = af && d.pages.every(([q]) => q === af.path) && !af.virtual;
    const head = document.createElement('div'); head.className = 'fhead';
    head.innerHTML = '<span style="color:var(--fg)">' + esc(d.name) + '</span><span>' + d.pages.length + (d.pages.length === 1 ? ' page' : ' pages') + '</span>' + (af && af.added ? addTag(af) : '') +
      (on ? '' : '<span class="pill warn" style="font-size:12px;padding:2px 8px;border-radius:999px;background:var(--warn-soft);color:var(--warn)">' + (auto ? 'No marks, left out' : 'Left out') + '</span>') +
      '<span style="flex:1"></span>' + (on || auto ? '<button class="link" style="font-size:13px;margin-right:10px" data-rotdoc="' + di + '" title="Turn every page of this file a quarter turn to the right">⟳ Turn all pages</button>' : '') + (one ? moveLink(af) : '') + '<button class="link" style="font-size:13px" data-inout="' + di + '">' + (on ? 'Leave out' : 'Bring back') + '</button>';
    paper.appendChild(head);
    if (!on && !auto) continue;   // left out on purpose: just the bar
    for (const [path, p] of d.pages) {
      if (token !== openToken) return;
      const f = fileByPath(st, path), doc = docMap.get(path);
      if (!f || !doc || p >= doc.numPages) continue;
      const page = await doc.getPage(p + 1);
      if (token !== openToken) return;
      const vp = vpRot(f, p, page, 1);
      const pg = { file: f, idx: p, page, W: vp.width, H: vp.height, side: sideFor(vp.width), marks: () => (f.marks[p] ||= []) };
      const wrap = document.createElement('div'); wrap.className = 'pg';
      if (!on) wrap.style.opacity = '.75';
      const c = document.createElement('canvas');
      wrap.appendChild(c); paper.appendChild(wrap);
      pg.wrap = wrap; pg.canvas = c;
      pages.push(pg);
      lightChip(pg); lightChips(); rotChip(pg, d.pages.length > 1 ? d.pages.findIndex(x => x[0] === path && x[1] === p) + 1 : 0);
      pg.extra = (f.kami && f.kami[p] && f.kami[p].notes) || [];
      bindPage(pg);
      await renderPage(pg);
      if (filePath && f.path === filePath && p === 0) wrap.scrollIntoView({ block: 'start' });
    }
  }
  renderTools();
}
$('#paper').addEventListener('click', e => {
  if (!e.target.closest('#lmenu, [data-lmenu]') && $('#lmenu')) $('#lmenu').remove();
  const lm = e.target.closest('[data-lm]'); if (lm) return lightMenuDo(lm.dataset.lm);
  const lc = e.target.closest('.lchip'); if (lc) return lightChipClick(e, pages.find(q => q.chip === lc));
  if (e.target.closest('#arrangeBtn')) return openArrange();
  const rb = e.target.closest('[data-rot]');
  if (rb) { const pg = pages.find(q => q.rchip === rb.parentNode); if (pg) turnPages(pg.file, [pg.idx], +rb.dataset.rot); return; }
  const rd = e.target.closest('[data-rotdoc]');
  if (rd) {
    const st = batch.students[cur], d = layoutOf(st)[+rd.dataset.rotdoc]; if (!d) return;
    const by = new Map(); for (const [path, p] of d.pages) { if (!by.has(path)) by.set(path, []); by.get(path).push(p); }
    (async () => { for (const [path, list] of by) await turnPages(fileByPath(st, path), list, 1); })();
    return;
  }
  const mvf = e.target.closest('[data-mvfile]'); if (mvf) return openMoveFile(batch.students[cur], mvf.dataset.mvfile);
  if (e.target.closest('#addFileBtn')) return pickAdd(batch.students[cur]);
  const ra = e.target.closest('[data-rmadd]');
  if (ra) {   // two clicks, so a stray click can't throw a file away
    if (!ra.dataset.armed) { ra.dataset.armed = '1'; ra.textContent = 'Click again to remove'; setTimeout(() => { if (ra.isConnected) { delete ra.dataset.armed; ra.textContent = 'Remove'; } }, 4000); return; }
    return removeAdded(batch.students[cur], ra.dataset.rmadd);
  }
  const io = e.target.closest('[data-inout]');
  if (io) {
    const st = batch.students[cur], d = layoutOf(st)[+io.dataset.inout];
    setDocIn(st, d, !docIn(st, d)); renderList(); openStudent(cur);
  }
});

/* ---------------- arrange pages: combine files, drag pages, take pages out ---------------- */
async function thumbFor(path, p, extra) {
  const f = batch && fileByPath(batch.students[cur], path), r = (rotOf(f, p) + (extra || 0)) % 360, k = path + '|' + p + '|' + r;
  if (thumbCache.has(k)) return thumbCache.get(k);
  const doc = docMap.get(path); if (!doc) return '';
  const page = await doc.getPage(p + 1), at = sc => page.getViewport({ scale: sc, rotation: ((page.rotate || 0) + r) % 360 });
  const vp = at(180 / at(1).width);
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
  const lp = { ...(batch.lightPg || {}) }, lit = lightLive(st);   // page lighting choices, kept on Save
  const nameOf = path => (fileByPath(st, path) || { name: path }).name;
  let drag = null, sel = new Set(), anchor = null, size = +store.get('gs.arrsize', 1);
  const turns = new Map();   // pages turned here, in quarter turns to the right; done on Save
  const turnKey = ([path, p]) => path + '|' + p;
  const lists = () => L.map(d => d.pages).concat([tray]);
  const listOf = w => w === 'tray' ? tray : L[+w].pages;
  const itemAt = el => listOf(el.dataset.where)[+el.dataset.i];
  const picked = () => lists().flatMap(l => l.filter(it => sel.has(it)));
  const many = st.files.filter(viewable).length > 1;
  // The order of whole files on screen: Word and other files (by 'f:<path>') among the files of pages (the objects in L).
  const seqNow = () => fileSeq(st).map(it => it.f ? 'f:' + it.f.path : L[it.di]);
  let strip = seqNow(), everyone = false;
  const seqDefault = () => { const keep = st.forder; st.forder = null; const v = fileSeq(st).map(it => it.f ? 'f:' + it.f.path : L[it.di]); st.forder = keep; return v; };
  const cardName = id => { const f = fileByPath(st, id.slice(2)); return f ? f.name : id.slice(2); };
  const kindOf = id => { const f = fileByPath(st, id.slice(2)); return !f ? '' : f.kind === 'docx' ? 'Word' : f.kind === 'text' ? 'Text' : 'File'; };
  const drawStrip = () => {
    strip = strip.filter(x => typeof x === 'string' || L.includes(x));
    for (const d of L) if (!strip.includes(d)) strip.push(d);
    const el = $('#arrSeq'); if (!el) return;
    el.hidden = !strip.some(x => typeof x === 'string');
    el.innerHTML = '<div class="aseqh"><b>Order of files</b><span class="muted">Word and other files sit among the page files in this order.</span><span class="sp"></span>' +
      '<label class="chk" style="margin:0;font-size:13px"><input type="checkbox" data-sqall' + (everyone ? ' checked' : '') + '> Use this order for every student</label></div>' +
      '<div class="aseqr">' + strip.map((x, k) => '<span class="aseqc' + (typeof x === 'string' ? ' card' : '') + '"><b>' + (k + 1) + '</b> ' + esc(typeof x === 'string' ? cardName(x) : x.name) + '<span class="muted">' + (typeof x === 'string' ? kindOf(x) : x.pages.length + (x.pages.length === 1 ? ' page' : ' pages')) + '</span>' +
        '<button data-sq="' + k + ':-1" title="Earlier"' + (k ? '' : ' disabled') + '>←</button><button data-sq="' + k + ':1" title="Later"' + (k < strip.length - 1 ? '' : ' disabled') + '>→</button></span>').join('') + '</div>';
  };
  const render = () => {
    const col = (items, where, head) => '<div class="acol" data-where="' + where + '">' + head +
      '<div class="adrop" data-where="' + where + '">' + items.map(([path, p], i) => {
        const f = fileByPath(st, path), off = lit && f && !pageLit(st, f, p, lp);
        return '<div class="ath" draggable="true" data-where="' + where + '" data-i="' + i + '"><img data-th="' + esc(path) + '|' + p + '" alt=""><div class="cap">' + (where === 'tray' ? '' : '<b>' + (i + 1) + '</b> · ') + 'p. ' + (p + 1) + (many ? ' · ' + esc(nameOf(path)) : '') + '</div>' +
          (off ? '<span class="aoff">☀ off</span>' : '') +
          (where === 'tray' ? '' : '<button class="rm" data-rm="' + where + ':' + i + '" title="Take this page out" aria-label="Take this page out">×</button>') + '</div>';
      }).join('') +
      (items.length ? '' : '<div class="empty">' + (where === 'tray' ? 'Pages you take out land here.' : 'Drag pages here') + '</div>') + '</div></div>';
    $('#arrBody').style.setProperty('--aw', ([90, 130, 190][size] || 130) + 'px');
    $('#arrBody').innerHTML = '<div class="acols">' + L.map((d, di) => col(d.pages, di,
      '<div class="ahead"><input type="text" data-name="' + di + '" value="' + esc(d.name) + '" aria-label="File name">' +
      '<label class="chk" style="margin:4px 0 0;font-size:13px"><input type="checkbox" data-in="' + di + '"' + (docIn(st, d) ? ' checked' : '') + '> Send back to the student</label>' +
      (L.length > 1 ? '<button class="link" style="font-size:12px" data-delfile="' + di + '">Remove this file (pages go to the tray)</button>' : '') + '</div>')).join('') +
      col(tray, 'tray', '<div class="ahead"><b>Taken out</b><div class="muted" style="font-size:12px">Drag back to use again</div></div>') + '</div>';
    for (const img of $('#arrBody').querySelectorAll('img[data-th]')) {
      const [path, p] = [img.dataset.th.slice(0, img.dataset.th.lastIndexOf('|')), +img.dataset.th.slice(img.dataset.th.lastIndexOf('|') + 1)];
      thumbFor(path, p, 90 * (turns.get(path + '|' + p) || 0)).then(u => { img.src = u; });
    }
    for (const b of document.querySelectorAll('#arrSize [data-asz]')) b.setAttribute('aria-pressed', +b.dataset.asz === size);
    drawStrip(); drawSel();
  };
  // Selection only, in place, so a double-click still lands on the same page.
  const drawSel = () => {
    for (const el of $('#arrBody').querySelectorAll('.ath')) el.classList.toggle('sel', sel.has(itemAt(el)));
    const n = sel.size;
    $('#arrSelInfo').textContent = n ? n + (n === 1 ? ' page picked' : ' pages picked') : 'No pages picked';
    $('#arrSelInfo').classList.toggle('on', !!n);
    for (const b of document.querySelectorAll('#arrBar [data-mv],#arrBar [data-aout],#arrBar [data-alight],#arrBar [data-aturn]')) b.disabled = !n;
  };
  const move = how => {
    if (!sel.size) return toast('Pick pages first');
    for (const l of lists()) {
      if (how === 'start' || how === 'end') { const a = l.filter(it => sel.has(it)), b = l.filter(it => !sel.has(it)); l.splice(0, l.length, ...(how === 'start' ? a.concat(b) : b.concat(a))); }
      else if (how < 0) { for (let i = 1; i < l.length; i++) if (sel.has(l[i]) && !sel.has(l[i - 1])) [l[i - 1], l[i]] = [l[i], l[i - 1]]; }
      else { for (let i = l.length - 2; i >= 0; i--) if (sel.has(l[i]) && !sel.has(l[i + 1])) [l[i], l[i + 1]] = [l[i + 1], l[i]]; }
    }
    render();
  };
  const turn = () => {
    if (!sel.size) return toast('Pick pages first');
    for (const it of picked()) turns.set(turnKey(it), ((turns.get(turnKey(it)) || 0) + 1) % 4);
    render();
  };
  const takeOut = () => {
    if (!sel.size) return toast('Pick pages first');
    for (const d of L) { const out = d.pages.filter(it => sel.has(it)); d.pages = d.pages.filter(it => !sel.has(it)); tray.push(...out); }
    render();
  };
  openDlg('<div class="bh"><h2>Arrange pages</h2><span class="muted">' + esc(shownName(st, cur)) + '</span><button class="icon" data-cancel aria-label="Close">✕</button></div>' +
    '<div class="arrbar" id="arrBar"><span class="seg" id="arrSize"><button data-asz="0">S</button><button data-asz="1">M</button><button data-asz="2">L</button></span>' +
      '<button class="btn sm" data-mv="start" title="Move the picked pages to the start of their file">⇤ To start</button><button class="btn sm" data-mv="-1" title="Move the picked pages one place earlier (← key)">← Earlier</button>' +
      '<button class="btn sm" data-mv="1" title="Move the picked pages one place later (→ key)">Later →</button><button class="btn sm" data-mv="end" title="Move the picked pages to the end of their file">To end ⇥</button>' +
      '<button class="btn sm" data-aout title="Take the picked pages out (Delete key)">Take out</button>' +
      '<button class="btn sm" data-aturn title="Turn the picked pages a quarter turn to the right (R key)">⟳ Turn</button>' +
      (lit ? '<button class="btn sm" data-alight title="Turn lighting off or on for the picked pages">☀ Lighting on/off</button>' : '') +
      '<span class="sp"></span><span id="arrSelInfo"></span></div>' +
    '<div id="arrSeq" class="aseq" hidden></div>' +
    '<p class="muted sphint" style="margin:8px 18px 0">Click a page to pick it, Shift-click to pick a run, ⌘/Ctrl-click to add one. Drag the picked pages, or use the buttons or the ← → keys. Double-click a page to see it big.</p>' +
    '<div class="bb" id="arrBody"></div>' +
    '<div class="bf" style="justify-content:space-between"><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-combine>Combine into one file</button><button class="btn" data-newfile>+ New file</button><button class="btn" data-reset>Back to how it was turned in</button></span>' +
    '<span style="display:flex;gap:8px"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-save>Save</button></span></div>');
  const box = $('#dlgBox'); box.classList.add('arrbox');
  render();
  box.tabIndex = -1; box.focus();
  box.addEventListener('dragstart', e => {
    const t = e.target.closest('.ath'); if (!t) return;
    const it = itemAt(t);
    if (!sel.has(it)) { sel = new Set([it]); anchor = it; drawSel(); }
    drag = { item: it };
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'page');
    if (sel.size > 1) { const gh = document.createElement('div'); gh.className = 'spghost'; gh.textContent = sel.size + ' pages'; document.body.appendChild(gh); e.dataTransfer.setDragImage(gh, 20, 20); setTimeout(() => gh.remove(), 0); }
    setTimeout(() => { for (const el of box.querySelectorAll('.ath.sel')) el.classList.add('dragging'); }, 0);
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
    const dst = listOf(zone.dataset.where), k = dropIndex(zone, e), moving = picked();
    // Land in front of the first page at the drop spot that isn't itself moving.
    let before = null; for (let j = k; j < dst.length; j++) if (!sel.has(dst[j])) { before = dst[j]; break; }
    for (const l of lists()) for (let j = l.length - 1; j >= 0; j--) if (sel.has(l[j])) l.splice(j, 1);
    dst.splice(before ? dst.indexOf(before) : dst.length, 0, ...moving);
    drag = null; render();
  });
  box.addEventListener('input', e => { if (e.target.dataset.name != null) L[+e.target.dataset.name].name = e.target.value; });
  box.addEventListener('change', e => { if (e.target.dataset.in != null) L[+e.target.dataset.in].out = !e.target.checked; if (e.target.dataset.sqall != null) everyone = e.target.checked; });
  box.ondblclick = e => { const th = e.target.closest('.ath'); if (th && !e.target.closest('[data-rm]')) { const [path, p] = itemAt(th); bigPage(docMap.get(path), p, thumbCache.get(path + '|' + p)); } };
  box.onkeydown = e => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || !sel.size || $('#spBig')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); takeOut(); }
    else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); turn(); }
  };
  box.onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target.closest('#spBig')) return splitZoomClose();
    const sq = e.target.closest('[data-sq]');
    if (sq) { const [k, dk] = sq.dataset.sq.split(':').map(Number), j = k + dk; if (j >= 0 && j < strip.length) [strip[k], strip[j]] = [strip[j], strip[k]]; return drawStrip(); }
    const rm = e.target.closest('[data-rm]');
    if (rm) { const [w, i] = rm.dataset.rm.split(':'); tray.push(...listOf(w).splice(+i, 1)); return render(); }
    const th = e.target.closest('.ath');
    if (th) {
      const it = itemAt(th), l = listOf(th.dataset.where);
      if (e.shiftKey && anchor && l.includes(anchor)) { const a = l.indexOf(anchor), b = l.indexOf(it); sel = new Set(l.slice(Math.min(a, b), Math.max(a, b) + 1)); }
      else if (e.metaKey || e.ctrlKey) { sel.has(it) ? sel.delete(it) : sel.add(it); anchor = it; }
      else { sel = new Set([it]); anchor = it; }
      return drawSel();
    }
    if (e.target.closest('.adrop') && !e.target.closest('button,input')) { sel = new Set(); return drawSel(); }
    const sz = e.target.closest('[data-asz]');
    if (sz) { size = +sz.dataset.asz; store.set('gs.arrsize', size); return render(); }
    const mv = e.target.closest('[data-mv]');
    if (mv) return move(/^-?\d+$/.test(mv.dataset.mv) ? +mv.dataset.mv : mv.dataset.mv);
    if (e.target.closest('[data-aout]')) return takeOut();
    if (e.target.closest('[data-aturn]')) return turn();
    if (e.target.closest('[data-alight]')) {
      const its = picked().map(([path, p]) => [fileByPath(st, path), p]).filter(([f]) => f);
      const on = !its.every(([f, p]) => pageLit(st, f, p, lp));
      for (const [f, p] of its) setPageLit(st, f, p, on, lp);
      return render();
    }
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
    if (e.target.closest('[data-reset]')) { L = defaultLayout(st).map(d => ({ ...d, pages: d.pages.map(x => x.slice()), out: null })); tray = []; sel = new Set(); strip = seqDefault(); return render(); }
    if (e.target.closest('[data-save]')) {
      drawStrip();
      const inStrip = strip.filter(x => typeof x !== 'string' && x.pages.length);
      L = inStrip.concat(L.filter(d => !inStrip.includes(d) && d.pages.length));
      const ord = strip.filter(x => typeof x === 'string' || L.includes(x)).map(x => typeof x === 'string' ? x : 'd' + L.indexOf(x));
      L = L.filter(d => d.pages.length).map(d => ({ name: (d.name.trim() || 'File') .replace(/(\.pdf)?$/i, '.pdf'), file: d.file, pages: d.pages, out: d.out }));
      const def = defaultLayout(st);
      const same = L.length === def.length && L.every((d, k) => d.file === def[k].file && d.name === def[k].name && JSON.stringify(d.pages) === JSON.stringify(def[k].pages) && d.out == null);
      st.layout = same ? null : L.map(d => ({ ...d, out: d.out == null ? undefined : d.out }));
      if (st.layout) for (const d of st.layout) if (d.out === undefined) delete d.out;
      const plain = fileSeq({ ...st, forder: null }).map(it => it.id);
      st.forder = JSON.stringify(ord) === JSON.stringify(plain) ? null : ord;
      if (everyone) {   // line the others up the same way, matching files by kind
        const tmpl = fileSeq(st).map(it => seqSig(st, it));
        let n = 0;
        for (const o of batch.students) {
          if (o === st) continue;
          const used = new Set(), sq = fileSeq({ ...o, forder: null });
          const at = it => { const sig = seqSig(o, it); for (let k = 0; k < tmpl.length; k++) if (tmpl[k] === sig && !used.has(k)) { used.add(k); return k; } return tmpl.length; };
          const ranked = sq.map((it, k) => [at(it), k, it]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2].id);
          o.forder = JSON.stringify(ranked) === JSON.stringify(sq.map(it => it.id)) ? null : ranked; n++;
        }
        toast('Same order for ' + (n + 1) + ' students');
      }
      batch.lightPg = lp;
      const todo = [...turns].filter(([, q]) => q);
      saveSoon(); closeDlg(); renderList();
      (async () => {
        for (const [key, q] of todo) { const i = key.lastIndexOf('|'), f = fileByPath(st, key.slice(0, i)); for (let k = 0; k < q; k++) await turnPages(f, [+key.slice(i + 1)], 1); }
        openStudent(cur);
      })();
      toast('Saved. Export uses this order.');
    }
  };
}

function fitScale(pg) {
  const P = $('#paper');
  let s = (P.clientWidth - 40) / (pg.W + pg.side);
  if (disp.fit === 'page') s = Math.min(s, (P.clientHeight - 40) / pg.H);
  return Math.max(0.3, Math.min(2.2, s)) * zoom;
}
async function renderPage(pg) {
  const s = fitScale(pg), dpr = window.devicePixelRatio || 1;
  pg.s = s;
  const vp = vpRot(pg.file, pg.idx, pg.page, s * dpr);
  const bmp = document.createElement('canvas');
  bmp.width = Math.ceil(vp.width); bmp.height = Math.ceil(vp.height);
  const bctx = bmp.getContext('2d'); bctx.fillStyle = '#fff'; bctx.fillRect(0, 0, bmp.width, bmp.height);
  try { await pg.page.render({ canvasContext: bctx, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise; } catch (e) { if (e && e.name === 'RenderingCancelledException') return; }
  pg.bmp = bmp;
  if (anonOn() && !pg.covers) pg.covers = await anonCovers(batch.students[cur], pg);
  const c = pg.canvas;
  c.width = Math.ceil((pg.W + pg.side) * s * dpr); c.height = Math.ceil(pg.H * s * dpr);
  c.style.width = (pg.W + pg.side) * s + 'px'; c.style.height = pg.H * s + 'px';
  if (pg.rchip) pg.rchip.style.left = pg.W * s + 'px';
  draw(pg);
}
function draw(pg, live) {
  if (!pg.bmp) return;
  const c = pg.canvas, ctx = c.getContext('2d'), k = c.width / (pg.W + pg.side);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  const src = lightBmp(pg);
  ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, pg.W * k, pg.H * k);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const anon = anonOn() && batch.students[cur];
  if (anon && pg.covers) { ctx.fillStyle = '#111'; for (const r of pg.covers) ctx.fillRect(r.x, r.y, r.w, r.h); }
  const marks = pg.marks().concat(anon ? scrubMarks(pg.extra || [], anonRx(anon)) : pg.extra || [], live || [], pg.pending ? [pg.pending] : []);
  pg.boxes = drawMarks(ctx, marks, pg.W, pg.H, pg.side, { sel: selected && selected.page === pg ? selected.mark : null, editing: pg.editing });
  if (pg.ghost) { const b = pg.ghost; ctx.save(); ctx.strokeStyle = '#1F6FB2'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.restore(); }
}
function redrawAll() { for (const pg of pages) draw(pg); }
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => pages.forEach(renderPage), 150); });

/* ---------------- undo and redo ---------------- */
// Each step remembers one page's marks as they were (and its turn, for a rotation), so undo and redo swap them back.
let redoStack = [];
const stepOf = (file, idx, withRot) => ({ file, idx, before: JSON.stringify(file.marks[idx] || []), rot: withRot ? rotOf(file, idx) : undefined });
function pushUndo(u) { undoStack.push(u); if (undoStack.length > 200) undoStack.shift(); redoStack = []; renderTools(); }
function snap(pg) { pushUndo(stepOf(pg.file, pg.idx)); }
function changed(pg) { draw(pg); saveSoon(); renderList(); }
function undo() { swapStep(undoStack, redoStack); }
function redo() { swapStep(redoStack, undoStack); }
function swapStep(from, to) {
  commitEditors();
  const u = from.pop(); if (!u) return;
  to.push(stepOf(u.file, u.idx, u.rot !== undefined));
  u.file.marks[u.idx] = JSON.parse(u.before);
  selected = null;
  const turned = u.rot !== undefined && u.rot !== rotOf(u.file, u.idx);
  if (turned) setRot(u.file, u.idx, u.rot);
  const pg = pages.find(p => p.file === u.file && p.idx === u.idx);
  if (pg) { if (turned) reshape(pg); else draw(pg); }
  else { const si = batch.students.findIndex(s => s.files.includes(u.file)); if (si >= 0 && si !== cur) openStudent(si); }
  if (turned) rescanFile(u.file);
  saveSoon(); renderList(); renderTools();
}

/* ---------------- turning pages ---------------- */
// A turn of 90° clockwise (dir 1) or counterclockwise (dir -1). Marks turn with the page; text stays upright.
function setRot(f, p, r) { r = ((r % 360) + 360) % 360; f.rot ||= {}; if (r) f.rot[p] = r; else delete f.rot[p]; }
function turnMarks(marks, W, H, dir) {
  const pt = ([x, y]) => dir > 0 ? [r1(H - y), r1(x)] : [r1(y), r1(W - x)];
  const box = b => { const [ax, ay] = pt([b.x, b.y]), [bx, by] = pt([b.x + b.w, b.y + b.h]); return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) }; };
  for (const m of marks) {
    if (m.t === 'pen') m.pts = m.pts.map(pt);
    else if (m.t === 'hl' || m.t === 'oval') Object.assign(m, box(m));
    else if (m.t === 'check') [m.x, m.y] = pt([m.x, m.y]);
    else if (m.t === 'note') { [m.ax, m.ay] = pt([m.ax, m.ay]); if (m.hl) m.hl = box(m.hl); }
    else if (m.t === 'text') {
      const L = textLayout(m, W), [cx, cy] = pt([m.x + L.w / 2, m.y + L.h / 2]);
      if (m.bw) m.bw = Math.min(m.bw, H - 12);
      const L2 = textLayout({ ...m, x: 0 }, H);
      m.x = r1(cx - L2.w / 2); m.y = r1(cy - L2.h / 2); keepOnPage(m, H, W);
    }
  }
}
// Turns pages of one file; with no page list, every page. One undo step per page, undone together.
async function turnPages(f, list, dir) {
  if (!f || !viewable(f)) return;
  commitEditors();
  if (!list) list = [...Array(f.numPages || 0).keys()];
  const steps = [];
  for (const p of list) {
    const pg = pages.find(q => q.file === f && q.idx === p);
    let W = pg && pg.W, H = pg && pg.H;
    if (!pg && docMap.get(f.path)) { try { const vp = vpRot(f, p, await docMap.get(f.path).getPage(p + 1), 1); W = vp.width; H = vp.height; } catch {} }
    steps.push(stepOf(f, p, true));
    if (W && f.marks[p] && f.marks[p].length) turnMarks(f.marks[p], W, H, dir);
    setRot(f, p, rotOf(f, p) + 90 * dir);
    if (pg) reshape(pg);
  }
  if (steps.length === 1) pushUndo(steps[0]);
  else for (const u of steps) pushUndo(u);   // undo turns them back one page at a time
  selected = null; thumbCache.clear();
  rescanFile(f); saveSoon(); renderList();
}
// Re-measures a page after a turn and draws it again.
function reshape(pg) {
  const vp = vpRot(pg.file, pg.idx, pg.page, 1);
  pg.W = vp.width; pg.H = vp.height; pg.side = sideFor(vp.width); pg.covers = null; pg.adj = null; pg.extra = [];
  renderPage(pg);
}
// Kami notes and typed grades are found again on the turned page.
async function rescanFile(f) {
  const st = batch && batch.students.find(s => s.files.includes(f)); if (!st || !viewable(f)) return;
  try { f.scan = await scanFile(f, f.hand || setup.spot || null); if (f.hand) f.scan.hand = true; f.kami = f.scan.kami; } catch (e) { console.error(e); return; }
  refound(st); renderList();
  for (const pg of pages) if (pg.file === f) { pg.extra = (f.kami && f.kami[pg.idx] && f.kami[pg.idx].notes) || []; draw(pg); }
}

/* ---------------- pointer input on a page ---------------- */
function bindPage(pg) {
  const c = pg.canvas;
  const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / pg.s, (e.clientY - r.top) / pg.s]; };
  const onPage = (x, y) => x >= 0 && x <= pg.W && y >= 0 && y <= pg.H;
  let g = null;   // the gesture in progress
  const onHandle = (x, y) => {
    if (!selected || selected.page !== pg || selected.mark.t !== 'text') return false;
    const h = textHandle(selected.mark, pg.W);
    return Math.abs(x - h.x) < 6 && y >= h.top - 4 && y <= h.bottom + 4;
  };
  c.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    commitEditors();
    // Clicking the paper leaves the score or comment box, so the arrow keys move between students again.
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && !pg.wrap.contains(ae)) ae.blur();
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
      else g = { text: true, x0: x, y0: y, x1: x };   // click for a box, or drag across to set its width
    } else if (tool === 'note') g = { note: true, x0: x, y0: y, m: null };   // click a point, or drag over words to highlight them
    else if (tool === 'select') {
      if (onHandle(x, y)) { g = { resize: selected.mark, moved: false }; return; }
      const hit = hitMark(pg, x, y, 4);
      selected = hit ? { page: pg, mark: hit } : null;
      redrawAll();
      if (hit) g = { move: hit, x, y, moved: false };
    }
  });
  c.addEventListener('pointermove', e => {
    if (!g) { if (tool === 'select') { const [x, y] = pt(e); c.style.cursor = onHandle(x, y) ? 'ew-resize' : hitMark(pg, x, y, 4) ? 'move' : 'default'; } return; }
    const [x, y] = pt(e);
    if (g.text) {
      g.x1 = clamp(x, 0, pg.W);
      const w = Math.abs(g.x1 - g.x0);
      pg.ghost = w > 8 ? { x: Math.min(g.x0, g.x1), y: g.y0 - disp.tsize * 0.65, w, h: disp.tsize * 1.3 } : null;
      draw(pg);
    } else if (g.note) {
      const x1 = clamp(x, 0, pg.W), y1 = clamp(y, 0, pg.H);
      if (!g.m && Math.hypot(x1 - g.x0, y1 - g.y0) < 5) return;
      g.m = { t: 'hl', color: HL[hlColor], x: Math.min(g.x0, x1), y: Math.min(g.y0, y1), w: Math.abs(x1 - g.x0), h: Math.abs(y1 - g.y0) };
      draw(pg, [g.m]);
    } else if (g.resize) {
      if (!g.moved) { snap(pg); g.moved = true; }
      g.resize.bw = r1(clamp(x - g.resize.x, 24, pg.W - g.resize.x - 6));
      draw(pg);
    } else if (g.m && g.m.t === 'pen') {
      const p = g.m.pts, last = p[p.length - 1], pt = [r1(clamp(x, 0, pg.W)), r1(clamp(y, 0, pg.H))];
      if (e.shiftKey) {   // Shift: a straight line, level or upright when it's close
        const dx = Math.abs(pt[0] - p[0][0]), dy = Math.abs(pt[1] - p[0][1]);
        if (dy < dx * 0.15) pt[1] = p[0][1]; else if (dx < dy * 0.15) pt[0] = p[0][0];
        g.m.pts = [p[0], pt];
      } else if (Math.hypot(x - last[0], y - last[1]) > 0.7) p.push(pt);
      draw(pg, [g.m]);
    } else if (g.m && (g.m.t === 'hl' || g.m.t === 'oval')) {
      const x1 = clamp(x, 0, pg.W), y1 = clamp(y, 0, pg.H);
      Object.assign(g.m, { x: Math.min(g.x0, x1), y: Math.min(g.y0, y1), w: Math.abs(x1 - g.x0), h: Math.abs(y1 - g.y0) });
      draw(pg, [g.m]);
    } else if (g.erase) eraseAt(pg, x, y, g);
    else if (g.move) {
      const dx = x - g.x, dy = y - g.y;
      if (!g.moved) { if (Math.hypot(dx, dy) < 1.5) return; snap(pg); g.moved = true; }
      moveMark(g.move, dx, dy); if (g.move.t === 'text') keepOnPage(g.move, pg.W, pg.H); g.x = x; g.y = y; draw(pg);
    }
  });
  const end = () => {
    if (!g) return;
    if (g.text) {
      pg.ghost = null;
      const w = Math.abs(g.x1 - g.x0), m = { t: 'text', color: COLORS[inkColor], x: r1(w > 24 ? Math.min(g.x0, g.x1) : Math.min(g.x0, pg.W - 106)), y: r1(g.y0 - disp.tsize / 2), size: disp.tsize, text: '' };
      if (w > 24) m.bw = r1(w);
      keepOnPage(m, pg.W, pg.H);
      g = null; snap(pg); pg.marks().push(m); editText(pg, m, true);
      return;
    }
    if (g.note) {
      let m;
      if (g.m && g.m.w >= 4) {
        const h = Math.max(6, g.m.h), hl = { x: r1(g.m.x), y: r1(g.m.y - (h - g.m.h) / 2), w: r1(g.m.w), h: r1(h) };
        m = { t: 'note', color: COLORS[inkColor], ax: r1(hl.x + hl.w), ay: r1(hl.y + hl.h / 2), hl, hc: HL[hlColor], text: '' };
      } else m = { t: 'note', color: COLORS[inkColor], ax: r1(g.x0), ay: r1(g.y0), text: '' };
      g = null; openNote(pg, m, true);
      return;
    }
    if (g.resize) { const m = g.resize; if (g.moved) { keepOnPage(m, pg.W, pg.H); changed(pg); } g = null; return; }
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
  else if (m.t === 'note') { m.ax = r1(m.ax + dx); m.ay = r1(m.ay + dy); if (m.hl) m.hl = { ...m.hl, x: r1(m.hl.x + dx), y: r1(m.hl.y + dy) }; }
  else { m.x = r1(m.x + dx); m.y = r1(m.y + dy); }
}
function eraseAt(pg, x, y, g) {
  const hit = hitMark(pg, x, y, 3);
  if (!hit) return;
  if (!g.snapped) { snap(pg); g.snapped = true; }
  const a = pg.marks(); a.splice(a.indexOf(hit), 1);
  changed(pg);
}
// Copy a mark (⌘C) and paste it (⌘V) on the page in view, even on another student's paper; ⌘D duplicates.
let markClip = null;
function copyMark(quiet) {
  if (!selected) return;
  markClip = { m: JSON.parse(JSON.stringify(selected.mark)), file: selected.page.file, idx: selected.page.idx, n: 0 };
  delete markClip.m.ro;
  if (!quiet) toast('Copied. ⌘V pastes it on the page you’re looking at.');
}
function pageInView() {
  if (selected && pages.includes(selected.page)) return selected.page;
  const P = $('#paper').getBoundingClientRect(), mid = P.top + P.height / 3;
  let best = null, bd = 1e9;
  for (const pg of pages) { const r = pg.canvas.getBoundingClientRect(), d = mid < r.top ? r.top - mid : mid > r.bottom ? mid - r.bottom : 0; if (d < bd) { bd = d; best = pg; } }
  return best;
}
function pasteMark() {
  const pg = pageInView(); if (!pg || !markClip) return;
  const m = JSON.parse(JSON.stringify(markClip.m));
  if (pg.file === markClip.file && pg.idx === markClip.idx) { markClip.n++; moveMark(m, 12 * markClip.n, 12 * markClip.n); }
  const bb = bboxOf(m, pg.W);   // keep it on the page
  if (bb) moveMark(m, clamp(bb.x, 0, Math.max(0, pg.W - bb.w)) - bb.x, clamp(bb.y, 0, Math.max(0, pg.H - bb.h)) - bb.y);
  if (m.t === 'text') keepOnPage(m, pg.W, pg.H);
  snap(pg); pg.marks().push(m);
  setTool('select'); selected = { page: pg, mark: m }; changed(pg); redrawAll();
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
  const hd = document.createElement('div'); hd.className = 'edh'; hd.title = 'Drag to set where the text wraps';
  const bar = document.createElement('div'); bar.className = 'edbar';
  const fit = () => {
    const L = textLayout(m, pg.W);
    Object.assign(ta.style, { left: m.x * s + 'px', top: m.y * s + 'px', fontSize: m.size * s + 'px', color: m.color, width: L.maxW * s + 'px' });
    ta.style.height = '0'; ta.style.height = Math.max(m.size * 1.3 * s, ta.scrollHeight) + 'px';
    Object.assign(hd.style, { left: (m.x + L.maxW) * s + 'px', top: m.y * s + Math.min(ta.offsetHeight / 2, 18) + 'px' });
    Object.assign(bar.style, { left: m.x * s + 'px', top: m.y * s + 'px' });
    bar.innerHTML = '<button data-sz="-1" title="Smaller text">A−</button><b>' + m.size + '</b><button data-sz="1" title="Bigger text">A+</button>' +
      '<span style="width:1px;height:16px;background:rgba(255,255,255,.25);margin:0 3px"></span><button data-full class="' + (m.bw ? '' : 'on') + '" title="Wrap at the edge of the page">Page width</button>';
  };
  pg.wrap.append(ta, hd, bar); fit(); ta.focus();
  if (!isNew) snap(pg);
  ta.addEventListener('input', fit);
  hd.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); hd.setPointerCapture(e.pointerId);
    const r = pg.canvas.getBoundingClientRect();
    const mv = ev => { m.bw = r1(clamp((ev.clientX - r.left) / s - m.x, 24, pg.W - m.x - 6)); fit(); };
    const up = () => { hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up); ta.focus(); };
    hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
  });
  bar.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
  bar.addEventListener('click', e => {
    const z = e.target.closest('[data-sz]');
    if (z) { m.size = clamp(m.size + 2 * z.dataset.sz, 8, 40); disp.tsize = m.size; store.set('gs.disp', disp); }   // the next new box uses this size too
    if (e.target.closest('[data-full]')) delete m.bw;
    fit(); ta.focus();
  });
  ta.addEventListener('keydown', e => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); commitEditors(); }
    e.stopPropagation();
  });
  const me = { commit() {
    m.text = ta.value.replace(/\s+$/, '');
    ta.remove(); hd.remove(); bar.remove(); pg.editing = null;
    keepOnPage(m, pg.W, pg.H);
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
  // place next to the spot (below a highlight), inside the page frame
  const left = Math.min(Math.max(0, (m.hl ? m.hl.x : m.ax) * s + 12), Math.max(0, (pg.W + pg.side) * s - 300));
  pop.style.left = left + 'px'; pop.style.top = Math.max(0, (m.hl ? m.hl.y + m.hl.h : m.ay) * s + 12) + 'px';
  pg.wrap.appendChild(pop);
  ta.focus();
  if (isNew) { pg.pending = m; draw(pg); }
  const close = save => {
    pop.remove(); activeEditor = null;
    if (pg.pending === m) pg.pending = null;
    const text = ta.value.trim();
    if (!save) { draw(pg); return; }
    const a = pg.marks(), i = a.indexOf(m);
    if (!text) { if (i >= 0) { snap(pg); a.splice(i, 1); changed(pg); } else draw(pg); return; }
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
  redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12H9a5 5 0 0 0 0 10h3"/>',
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
    '<button class="icon" id="redoBtn" title="Redo (⇧⌘Z)" aria-label="Redo" ' + (redoStack.length ? '' : 'disabled') + '>' + svg(IC.redo) + '</button>' +
    '<span class="zoom"><button class="icon" data-z="-1" aria-label="Zoom out" title="Zoom out (⌘−)">' + svg(IC.minus) + '</button><span data-z0 title="Back to 100% (⌘0). Pinch or ⌘-scroll on the paper to zoom.">' + Math.round(zoom * 100) + '%</span><button class="icon" data-z="1" aria-label="Zoom in" title="Zoom in (⌘+)">' + svg(IC.plus) + '</button></span>';
  for (const pg of pages) pg.canvas.style.cursor = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';
}
$('#tools').addEventListener('click', e => {
  const t = e.target.closest('[data-tool]'); if (t) { setTool(t.dataset.tool); return; }
  const i = e.target.closest('[data-ink]'); if (i) { inkColor = i.dataset.ink; store.set('gs.ink', inkColor); recolorSelected(COLORS[inkColor]); renderTools(); return; }
  const h = e.target.closest('[data-hl]'); if (h) { hlColor = h.dataset.hl; store.set('gs.hl', hlColor); renderTools(); return; }
  const w = e.target.closest('[data-w]'); if (w) { penW = +w.dataset.w; store.set('gs.penW', penW); renderTools(); return; }
  if (e.target.closest('#undoBtn')) { undo(); return; }
  if (e.target.closest('#redoBtn')) { redo(); return; }
  const z = e.target.closest('[data-z]');
  if (z) setZoom(Math.round((zoom + (+z.dataset.z) * 0.15) * 100) / 100);
  if (e.target.closest('[data-z0]')) setZoom(1);
});
// Zoom keeps the spot under the mouse (or the middle of the view) in place.
let zoomT = null;
function setZoom(z, at) {
  z = clamp(Math.round(z * 100) / 100, 0.5, 3);
  if (z === zoom) return;
  const P = $('#paper'), r = P.getBoundingClientRect(), ay = at ? at.y - r.top : P.clientHeight / 2, ax = at ? at.x - r.left : P.clientWidth / 2;
  const fy = (P.scrollTop + ay) / Math.max(1, P.scrollHeight), fx = (P.scrollLeft + ax) / Math.max(1, P.scrollWidth), k = z / zoom;
  zoom = z; store.set('gs.zoom', zoom); renderTools();
  // Stretch what's on screen right away, then draw it sharp once the zooming stops.
  commitEditors();
  for (const pg of pages) { const c = pg.canvas; if (c.style.width && pg.s) { pg.s *= k; c.style.width = parseFloat(c.style.width) * k + 'px'; c.style.height = parseFloat(c.style.height) * k + 'px'; if (pg.rchip) pg.rchip.style.left = pg.W * pg.s + 'px'; } }
  P.scrollTop = fy * P.scrollHeight - ay; P.scrollLeft = fx * P.scrollWidth - ax;
  clearTimeout(zoomT);
  zoomT = setTimeout(async () => { for (const pg of pages) await renderPage(pg); P.scrollTop = fy * P.scrollHeight - ay; }, 180);
}
$('#paper').addEventListener('wheel', e => {   // a trackpad pinch arrives as ⌘/Ctrl + scroll
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  setZoom(zoom * Math.exp(-clamp(e.deltaY * (e.deltaMode ? 20 : 1), -40, 40) * 0.005), { x: e.clientX, y: e.clientY });
}, { passive: false });
function setTool(t) { commitEditors(); tool = t; if (t !== 'select') { selected = null; redrawAll(); } renderTools(); }
function recolorSelected(col) {
  if (!selected || selected.mark.t === 'hl') return;
  snap(selected.page); selected.mark.color = col; changed(selected.page);
}

/* ---------------- student list ---------------- */
// Counts as marked: marks made here, marks already on the file (Kami), a grade found in its text, or a grade boxed by hand.
const fileMarked = f => viewable(f) && (Object.values(f.marks).some(a => a.length) || (f.kami && Object.keys(f.kami).length > 0) || !!(f.scan && f.scan.found && f.scan.found.length) || !!f.hand);
function hasMarks(st) { return st.files.some(f => fileMarked(f) || f.edited); }
function renderList() {
  if (!batch) return;
  renderAnonHead();
  const order = anonOn() ? anonOrder() : batch.students.map((_, i) => i);
  const q = ($('#stuFind').value || '').trim().toLowerCase();
  $('#stuList').innerHTML = order.map((i, pos) => { const st = batch.students[i];
    if (q && !shownName(st, i).toLowerCase().includes(q)) return '';
    const g = gradeOf(st);
    const val = g.total != null ? g.total : g.pct != null ? g.pct + '%' : null;
    const right = val != null ? '<span class="sc" title="' + (g.paper ? 'Read from the paper' : g.done ? 'Scored' : 'Partly scored') + '"' + (g.paper ? ' style="color:var(--muted);font-weight:600"' : g.done ? '' : ' style="color:var(--warn)"') + '>' + fmtNum(g.total != null ? g.total : g.pct) + (g.total == null ? '%' : '') + '</span>'
      : st.foundCount > 1 ? '<span class="sc" style="color:var(--warn)" title="More than one grade found on the paper. Check the Grade sheet.">?</span>'
      : hasMarks(st) ? '<span class="dot" title="Marked"></span>' : '';
    const nAdd = st.files.filter(f => f.added).length;
    return '<button class="stu' + (i === cur ? ' on' : '') + (st.files.length ? '' : ' empty') + '" data-i="' + i + '"><span class="num">' + (pos + 1) + '</span><span class="nm" title="' + esc(shownName(st, i)) + '">' + esc(shownName(st, i)) + '</span>' +
      '<span style="display:inline-flex;align-items:center;gap:4px">' + (st.files.length ? '' : '<span class="muted" style="font-size:11px">no paper</span>') + (nAdd ? '<span class="add" title="' + nAdd + (nAdd === 1 ? ' file' : ' files') + ' added by you">+' + nAdd + '</span>' : '') + right + '</span></button>';
  }).join('');
  const on = $('#stuList .on'); if (on) on.scrollIntoView({ block: 'nearest' });
  const nExp = exportPlan(true).length;
  $('#exportBtn').textContent = 'Export marked' + (nExp ? ' (' + nExp + ')' : '');
  renderProg();
}
function renderProg() {
  const N = batch.students.length, n = batch.students.filter(s => gradeOf(s).done).length;
  $('#progS').innerHTML = '<div class="ph">' + n + ' of ' + N + ' <span>scored</span></div><div class="pb"><i style="width:' + (N ? 100 * n / N : 0) + '%"></i></div>' +
    (n < N ? '<button class="btn sm" id="nextUn" title="Opens the next student without a full score">Next unscored <kbd>N</kbd></button>' : '<div class="muted" style="font-size:13px;margin-bottom:6px">Everyone has a score.</div>');
}
function nextUnscored() {
  const N = batch.students.length, o = anonOn() ? anonOrder() : batch.students.map((_, i) => i), p = o.indexOf(cur);
  for (let k = 1; k <= N; k++) { const i = o[(p + k) % N]; if (!gradeOf(batch.students[i]).done) return openStudent(i); }
  toast('Everyone has a score');
}
$('#progS').addEventListener('click', e => { if (e.target.closest('#nextUn')) nextUnscored(); });
$('#stuList').addEventListener('click', e => { const b = e.target.closest('.stu'); if (b) openStudent(+b.dataset.i); });
// Find a student: type part of a name; Enter opens the first match, Esc clears it.
$('#stuFind').addEventListener('input', () => { renderList(); if (!$('#stuList .stu')) $('#stuList').innerHTML = '<div class="muted" style="font-size:13px;padding:6px 8px">No one matches.</div>'; });
$('#stuFind').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const b = $('#stuList .stu'); if (b) openStudent(+b.dataset.i); e.target.value = ''; renderList(); e.target.blur(); }
  if (e.key === 'Escape') { e.target.value = ''; renderList(); e.target.blur(); }
});

/* ---------------- grade panel ---------------- */
function renderGrade() {
  const st = batch.students[cur], g = st.grade, gr = gradeOf(st);
  let h = '';
  if (setup.mode === 'rubric') {
    h += '<h3>Rubric <button class="link" id="editRubric" style="font-size:12px;text-transform:none;letter-spacing:0">Edit</button></h3>';
    h += setup.criteria.map((c, i) => '<div class="crit"><div class="cn"><span>' + esc(c) + '</span><em>' + (g.rubric[i] == null ? '' : fmtNum(g.rubric[i]) + ' / 4') + '</em></div><div class="scores" data-c="' + i + '">' +
      RUBRIC_STEPS.map(v => '<button class="' + (v % 1 ? 'half' : '') + '" data-v="' + v + '" aria-pressed="' + (g.rubric[i] === v) + '">' + v + '</button>').join('') + '</div></div>').join('');
  } else {
    h += '<h3>Score <button class="link" id="editRubric" style="font-size:12px;text-transform:none;letter-spacing:0">Edit</button></h3>' +
      '<div class="pts"><input type="number" step="0.5" min="0" id="ptsIn" value="' + esc(g.points) + '" aria-label="Points"><span class="muted">out of ' + esc(setup.outOf) + '</span></div>';
  }
  h += '<div class="total">' + totalHtml(st) + '</div>';
  h += '<div class="cmt"><h3 style="margin-bottom:6px">Comment for ManageBac</h3><textarea id="cmtIn" placeholder="Optional. Shows in the Grades list so you can copy it.">' + esc(g.comment) + '</textarea></div>';
  { const rd = store.get(refKey(), null), items = (rd ? ['<b>' + esc(rd.name) + '</b> <button class="link" data-refdel>Remove</button>'] : []).concat(refFiles.map(r => '<b>' + esc(r.name) + '</b> <button class="link" data-refrm="' + esc(r.path) + '">Remove</button>'));
    h += '<div class="refl">' + (items.length ? 'With every paper: ' + items.join(' · ') + '<br>' : '') + '<button class="link" data-refdoc>' + (items.length ? '+ Add another file for everyone…' : 'Add a reading or file for everyone…') + '</button></div>'; }
  h += '<div class="nav"><button class="btn" id="prevBtn" ' + (cur ? '' : 'disabled') + '>◀ Previous</button><button class="btn primary" id="nextBtn" ' + (cur < batch.students.length - 1 ? '' : 'disabled') + '>Next ▶</button></div>';
  h += '<div class="hint">Keys: <kbd>←</kbd> <kbd>→</kbd> or <kbd>↑</kbd> <kbd>↓</kbd> students · <kbd>N</kbd> next unscored · <kbd>=</kbd> calculator · V P H O T C K E tools · ⌘Z undo, ⇧⌘Z redo · <button class="link" data-keys style="font-size:12.5px">All keys ( ? )</button></div>';
  $('#grade').innerHTML = h;
}
function totalHtml(st) {
  const gr = gradeOf(st), own = ownGrade(st);
  let h = '<b>' + (gr.total == null ? '–' : fmtNum(gr.total)) + '</b><span>/ ' + maxPoints() + '</span><span class="pc">' + (gr.pct == null ? '' : fmtPct(gr.pct)) + '</span>';
  if (gr.paper) h += '<span style="width:100%;font-size:12.5px">From the paper (Grade sheet)</span>';
  const ps = paperScore(st);
  if (own.total != null && ps != null && Math.abs(ps - own.total) > 0.001) h += '<span class="sc-warn" style="width:100%">The paper says ' + fmtNum(ps) + '</span>';
  return h;
}
// The score on the paper: read from typed text, or typed by her on the Grade sheet from the picture.
function paperScore(st) {
  if (st.found && st.found.found && st.found.score != null) return st.found.score;
  const ty = st.grade.sheet;
  return ty !== '' && ty != null && !isNaN(+ty) ? +ty : null;
}
$('#grade').addEventListener('click', e => {
  const b = e.target.closest('.scores button');
  if (b) {
    const st = batch.students[cur], i = +b.closest('.scores').dataset.c, v = +b.dataset.v;
    st.grade.rubric[i] = st.grade.rubric[i] === v ? null : v;
    renderGrade(); renderList(); saveSoon(); return;
  }
  if (e.target.closest('#prevBtn')) stepStudent(-1);
  if (e.target.closest('#nextBtn')) stepStudent(1);
  if (e.target.closest('#editRubric')) openSetup();
  if (e.target.closest('[data-keys]')) openKeys();
  if (e.target.closest('[data-refdoc]')) pickRefs();
  { const rr = e.target.closest('[data-refrm]'); if (rr) dropRef(rr.dataset.refrm); }
  if (e.target.closest('[data-refdel]')) { store.del(refKey()); renderGrade(); openStudent(cur); }
});
$('#grade').addEventListener('input', e => {
  const st = batch.students[cur];
  if (e.target.id === 'cmtIn') { st.grade.comment = e.target.value; saveSoon(); }
  if (e.target.id === 'ptsIn') {
    st.grade.points = e.target.value; saveSoon(); renderList();
    $('#grade .total').innerHTML = totalHtml(st);
  }
});
$('#grade').addEventListener('keydown', e => {   // Enter or Escape leaves the box, so the arrow keys go back to moving between students
  if ((e.target.id === 'ptsIn' && e.key === 'Enter') || (e.target.id === 'cmtIn' && e.key === 'Escape')) { e.preventDefault(); e.target.blur(); }
});

/* ---------------- every key, in one list ( ? ) ---------------- */
function openKeys() {
  const row = (k, t) => '<span>' + k.split(' ').map(x => '<kbd>' + esc(x) + '</kbd>').join(' ') + '</span><span>' + t + '</span>';
  openDlg('<div class="bh"><h2>Keys</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb"><div class="keys">' +
    '<h4>Students</h4>' + row('← →', 'Previous / next student (also ↑ ↓)') + row('N', 'Next student without a full score') + row('/', 'Find a student by name') +
    '<h4>Marking</h4>' + row('V', 'Select') + row('P', 'Pen (hold Shift for a straight line)') + row('H', 'Highlight') + row('O', 'Circle') + row('T', 'Text') + row('C', 'Comment') + row('K', 'Check mark') + row('E', 'Eraser') +
    row('⌘Z', 'Undo') + row('⇧⌘Z', 'Redo (⌘Y works too)') +
    '<h4>A picked mark (Select tool)</h4>' + row('← → ↑ ↓', 'Nudge it (Shift for bigger steps)') + row('⌘C ⌘V', 'Copy it, then paste on the page you’re looking at, even on another student’s paper') + row('⌘D', 'Make a copy of it') + row('Delete', 'Remove it') + row('Esc', 'Let go of it (the arrows go back to moving between students)') +
    '<h4>The paper</h4>' + row('⌘+ ⌘−', 'Zoom in / out (or pinch, or ⌘-scroll)') + row('⌘0', 'Back to 100%') + row('[ ]', 'Fold away the student list / score panel') +
    'Turn a page: point at it and use ⟲ ⟳ in its top corner, or “Turn all pages” above the file. In Arrange pages, pick pages and press R.'.replace(/^/, '<h4>Turning pages</h4><span style="grid-column:1/-1">') + '</span>' +
    '<h4>Other</h4>' + row('=', 'Calculator') + row('Space', 'Play / pause a recording') + row('J L', 'Back / ahead 5 seconds') + row('?', 'This list') +
    '</div></div><div class="bf"><button class="btn primary" data-close>Close</button></div>', true);
  $('#dlgBox').onclick = e => { if (e.target.closest('[data-close]')) closeDlg(); };
}

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
    let h = '<div class="field"><label>How do you score this one?</label><span class="seg"><button data-m="points" aria-pressed="' + (draft.mode === 'points') + '">Just the total</button><button data-m="rubric" aria-pressed="' + (draft.mode === 'rubric') + '">Rubric rows, 1 to 4</button></span>' +
      '<span class="muted" style="font-size:12.5px;margin-top:4px">Grading right on your own rubric? Use Just the total: one score box, and the Grades list and percents still work.</span></div>';
    if (draft.mode === 'rubric') {
      h += '<div class="field"><label>Rubric rows</label>' + draft.criteria.map((c, i) => '<div class="critrow"><input type="text" data-ci="' + i + '" value="' + esc(c) + '">' + (draft.criteria.length > 1 ? '<button class="btn sm" data-rm="' + i + '" aria-label="Remove row">×</button>' : '') + '</div>').join('') +
        (draft.criteria.length < 6 ? '<div><button class="btn sm" data-add>+ Add a row</button></div>' : '') + '</div>';
    } else {
      h += '<div class="field"><label for="outOf">Out of</label><input type="number" id="outOf" min="1" step="0.5" value="' + esc(draft.outOf) + '" style="width:120px"></div>';
    }
    h += '<div class="field"><label>Grading scale</label><span style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-preset="usual">12 = 100, 11 = 95, 10 = 91…</button><button class="btn sm" data-preset="fives">Steps of 5 (9 = 85%)</button><button class="btn sm" data-preset="none">No scale</button></span>' + scaleRows() + '</div>';
    const rp = newPage === undefined ? draft.rubricPage : newPage;
    h += '<div class="field"><label>Your rubric, for every student</label><span class="muted" style="font-size:13px">Bring in your rubric once and every student gets their own copy to grade on. A Word rubric (.docx or .docm) stays a Word file: type in it, check its boxes and shade its cells. A PDF or picture is added as a page you can mark up. Each copy goes back with that student’s work.</span>' +
      '<span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px"><button class="btn sm" data-rpup>' + (rp ? 'Replace…' : 'Bring in my rubric…') + '</button>' +
      (rp ? '<span style="font-size:13px;font-weight:600">' + esc(rp.name || 'Rubric page') + '</span><span class="seg"><button data-pos="end" aria-pressed="' + ((draft.rubricPos || 'end') === 'end') + '">After their work</button><button data-pos="start" aria-pressed="' + (draft.rubricPos === 'start') + '">Before</button></span><button class="link" data-rprm>Remove</button>' : '') +
      '</span><input type="file" id="rpIn" hidden></div>';
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
      if (WORD_RX.test(f.name)) {
        openWord(bytes);
        newPage = { bytes, name: f.name };
        if (!draft.rubricPos) draft.rubricPos = 'start';   // a Word rubric sits above their work unless she moves it
      } else {
        const pdf = isImg(f.name) ? await imageToPdf(bytes, f.name) : IMG_MORE.test(f.name) ? await anyImageToPdf(bytes) : bytes;
        await PDFLib.PDFDocument.load(pdf, { ignoreEncryption: true });
        newPage = { bytes: pdf, name: f.name };
      }
      if (draft.mode === 'rubric' && draft.criteria.every((c, i) => c === 'Criterion ' + (i + 1))) { draft.outOf = draft.criteria.length * 4; draft.mode = 'points'; }   // her rubric replaces the generic rows
      re();
    } catch { toast('That file couldn’t be opened as a Word file, PDF or picture'); }
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
  const bytes = rubricBytes(), rp = setup.rubricPage, isWord = !!rp && WORD_RX.test(rp.name || '');
  let n = 0;
  if (bytes && !isWord) { try { n = (await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount(); } catch {} }
  for (const st of batch.students) {
    const old = st.files.find(f => f.virtual);
    st.files = st.files.filter(f => !f.virtual);
    const real = st.files.filter(viewable);
    if (st.layout) for (const d of st.layout) d.pages = d.pages.filter(([path]) => !old || path !== old.path);
    if (bytes && isWord) {   // each student gets their own copy of her Word rubric, edited and returned like any Word file
      const any = st.files.find(f => f.path.includes('/')), dir = any ? any.path.slice(0, any.path.lastIndexOf('/') + 1) : st.key + '/';
      const path = dir + rp.name.replace(/[\\/]+/g, '-'), keep = old && old.path === path && old.edited ? old : null;
      st.files.push({ path, name: rp.name, kind: 'docx', data: keep ? keep.data : bytes, orig: keep ? keep.orig : null, edited: keep ? keep.edited : 0, size: bytes.length, marks: {}, virtual: true, rubric: true });
      continue;
    }
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
let gradesOrder = 'roster';
// Rows in folder order, or in roster order with gaps for students who turned nothing in.
function gradeRows() {
  const c = batchClass();
  if (gradesOrder !== 'roster' || !c || !c.names.length) return batch.students.map((st, i) => ({ st, i })).sort((a, b) => gradesOrder === 'folder' ? natural(a.st.key, b.st.key) : 0);
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
const xAll = () => !!store.get('gs.xall', false);
const xEdit = () => store.get('gs.xedit', true) !== false;   // "Keep marks editable"   // "Also include files with no marks"
// Word files you edited or scored, any file you added; with "include everything", every file.
const rawOut = f => !viewable(f) && !!f.data && !f.virtual && (xAll() || !!f.edited || !!f.added || !!(wordScore(f) && f.wscore.total != null));
const docAdded = (st, d) => d.pages.some(([path]) => { const f = fileByPath(st, path); return !!f && !!f.added; });
// A file you moved to another student goes back in that student's folder.
const outPath = (st, path) => batch.moved && batch.moved[path] === st.key && path.includes('/') ? st.key + path.slice(path.indexOf('/')) : path;
function exportPlan(keepFolders) {
  const out = [];
  for (const st of batch.students) for (const f of st.files.filter(rawOut)) {
    const fp = outPath(st, f.path), dir = fp.includes('/') ? fp.slice(0, fp.lastIndexOf('/') + 1) : '';
    out.push({ st, f, raw: true, path: (keepFolders ? fp : (dir ? st.key + ' - ' : '') + f.name).replace(/[\\:*?"<>|]+/g, '-') });
  }
  for (const st of batch.students) for (const d of layoutOf(st)) {
    if (xAll() ? !(docIn(st, d) || docAuto(st, d)) : (!docIn(st, d) || !(docMarked(st, d) || docAdded(st, d)))) continue;
    const first = outPath(st, d.pages[0][0]), dir = first.includes('/') ? first.slice(0, first.lastIndexOf('/') + 1) : '';
    let path = dir + d.name.replace(/\.(png|jpe?g)$/i, '.pdf');
    if (!/\.pdf$/i.test(path)) path += '.pdf';
    if (!keepFolders) path = (dir ? st.key + ' - ' : '') + path.split('/').pop();
    out.push({ st, d, path: path.replace(/[\\:*?"<>|]+/g, '-') });
  }
  const used = new Set();
  for (const o of out) { let p = o.path, k = 2; while (used.has(p.toLowerCase())) p = o.path.replace(/(\.[^./]+)?$/, ' (' + k++ + ')$1'); used.add(p.toLowerCase()); o.path = p; }
  return out;
}
// Builds one returned file from its pages (possibly from several turned-in files), baking in every mark.
async function flattenDoc(st, d, dpi, edit) {
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
      const Lx = lightOpts().exp ? lightForPage(st, f, p) : null;
      // A locked (encrypted) PDF can't be copied page for page; its copies come out blank, so those pages are redrawn instead.
      if (!marks.length && !(f.kami && f.kami[p]) && !Lx && !lib.isEncrypted) {
        const [cp] = await out.copyPages(lib, [p]);
        if (rotOf(f, p)) cp.setRotation(PDFLib.degrees((cp.getRotation().angle + rotOf(f, p)) % 360));
        out.addPage(cp); continue;
      }
      const page = await js.getPage(p + 1);
      const vp1 = vpRot(f, p, page, 1), W = vp1.width, H = vp1.height;
      const side = marks.some(m => m.t === 'note') ? sideFor(W) : 0;
      const scale = dpi / 72;
      const c = document.createElement('canvas');
      c.width = Math.ceil((W + side) * scale); c.height = Math.ceil(H * scale);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vpRot(f, p, page, scale), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
      if (Lx) lightCanvas(ctx, Math.min(c.width, Math.ceil(W * scale)), c.height, Lx);   // the page only, before her marks
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawMarks(ctx, marks, W, H, side, null);
      const jpg = await new Promise(res => c.toBlob(b => b.arrayBuffer().then(x => res(new Uint8Array(x))), 'image/jpeg', 0.88));
      const img = await out.embedJpg(jpg);
      out.addPage([W + side, H]).drawImage(img, { x: 0, y: 0, width: W + side, height: H });
      c.width = c.height = 0; page.cleanup();
    }
    if (edit) {   // the original pages and her own marks go along, so bringing the file back in opens it ready to change
      const paths = [...new Set(d.pages.map(([path]) => path))];
      const info = { v: 1, pages: d.pages.map(([path, p]) => { const f = fileByPath(st, path); return [paths.indexOf(path), p, f.marks[p] || [], rotOf(f, p)]; }) };
      for (let k = 0; k < paths.length; k++) await out.attach(fileByPath(st, paths[k]).data, 'gs-original-' + (k + 1) + '.pdf', { mimeType: 'application/pdf', description: 'Original pages, for reopening in Grading Studio' });
      await out.attach(new TextEncoder().encode(JSON.stringify(info)), 'grading-studio.json', { mimeType: 'application/json', description: 'Marks, for reopening in Grading Studio' });
    }
  } finally { for (const v of srcs.values()) v.js.destroy(); }
  const bytes = await out.save();
  if (!edit) return bytes;
  const tail = new TextEncoder().encode('\n' + GS_TAIL + '\n'), all = new Uint8Array(bytes.length + tail.length);
  all.set(bytes); all.set(tail, bytes.length); return all;
}
async function openExport() {
  saveNow(); commitEditors(); wordScoresAll();
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
      '<label class="chk"><input type="checkbox" id="xAll"' + (xAll() ? ' checked' : '') + '> Also include files with no marks (Word files, other files and unmarked pages)</label>' +
      '<label class="chk"><input type="checkbox" id="xEdit"' + (xEdit() ? ' checked' : '') + '> Keep marks editable: bring a file back in later and change its marks (files are about twice as big)</label>' +
      '<label class="chk"><input type="checkbox" id="xSheet" checked> Add the grade sheet (a crop of each typed grade, in folder order)</label>' +
      '<div class="chk" style="cursor:default">Sharpness <span class="seg" id="xDpi"><button data-dpi="150" aria-pressed="true">Standard</button><button data-dpi="220" aria-pressed="false">Extra sharp</button></span></div>' +
      '<p class="muted" style="font-size:13px;margin-bottom:0">Your original files aren’t changed. Grades are read and cropped first, then every marked file is flattened, including marks made in Kami. A file you marked anywhere comes back whole, every page in order, including the pages you didn’t mark. Word rubrics you scored come back as Word files. ' + (xAll() ? 'Files with no marks come too.' : 'Files you didn’t mark at all stay out.') + ' Comments go in a right-hand margin.</p><div class="prog" hidden><i></i></div><p class="muted" id="xStatus" style="font-size:13px"></p>'
      : '<p style="margin-top:0">Nothing is marked yet. Mark a paper and it will show up here.</p><label class="chk"><input type="checkbox" id="xAll"' + (xAll() ? ' checked' : '') + '> Also include files with no marks (Word files, other files and unmarked pages)</label>') +
    '</div><div class="bf"><button class="btn" data-close>Close</button>' + (plan.length ? ((window.showDirectoryPicker && window.self === window.top) ? '<button class="btn" data-go="dir">Save into a folder…</button>' : '') + (G.email ? '<button class="btn" data-go="drive">Save to Google Drive</button>' : '') + '<button class="btn primary" data-go="zip">Download ZIP</button>' : '') + '</div>', true);
  const box = $('#dlgBox');
  box.onchange = e => { if (e.target.id === 'xEdit') store.set('gs.xedit', e.target.checked); if (e.target.id === 'xAll') { store.set('gs.xall', e.target.checked); renderTools(); openExport(); } };
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
        const bytes = items[i].raw ? items[i].f.data : await flattenDoc(items[i].st, items[i].d, dpi, $('#xEdit').checked);
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
// A Word file drawn as letter-size page pictures (a PDF kept in memory), for boxing its grade like a paper's.
async function wordPdf(f) {
  if (f.wpdfOf === f.data && f.wpdf) return f.wpdf;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:816px;pointer-events:none';
  const page = document.createElement('div'); page.className = 'dpage';
  page.style.cssText = 'max-width:none;width:816px;margin:0;box-shadow:none;overflow:visible;border-radius:0';
  host.appendChild(page); document.body.appendChild(host);
  try {
    try { const w = openWord(f.data); w.pRuns = []; renderWord(w, page); } catch { page.innerHTML = await docxHtml(f.data); }
    await Promise.all([...page.querySelectorAll('img')].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
    const c = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
    const pdf = await PDFLib.PDFDocument.create(), sh = Math.round(c.width * 11 / 8.5);
    for (let y = 0, n = 0; y < c.height && n < 30; y += sh, n++) {
      const s = document.createElement('canvas'); s.width = c.width; s.height = sh;
      const x = s.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, s.width, s.height);
      x.drawImage(c, 0, y, c.width, Math.min(sh, c.height - y), 0, 0, c.width, Math.min(sh, c.height - y));
      const jpg = await pdf.embedJpg(await (await new Promise(r => s.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());
      pdf.addPage([612, 792]).drawImage(jpg, { x: 0, y: 0, width: 612, height: 792 });
      s.width = s.height = 0;
    }
    c.width = c.height = 0;
    f.wpdf = await pdf.save(); f.wpdfOf = f.data;
    return f.wpdf;
  } finally { host.remove(); }
}
// The pages to look at for a grade: the PDF itself, or a Word file drawn as pages.
const paperBytes = async f => f.kind === 'docx' ? wordPdf(f) : f.data;
async function scanFile(f, spot) {
  const doc = await pdfjsLib.getDocument({ data: (await paperBytes(f)).slice(), isEvalSupported: false }).promise;
  const found = [], kami = {}, seen = [];
  try {
    if (f.kind !== 'docx') f.numPages = doc.numPages;
    const pick = spot ? [typeof spot.page === 'number' ? Math.min(spot.page, doc.numPages - 1) : spot.page === 'last' ? doc.numPages - 1 : 0] : [...Array(doc.numPages).keys()];
    for (let p = 0; p < doc.numPages; p++) {
      const page = await doc.getPage(p + 1);
      const vp = vpRot(f, p, page, 1);
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
      for (const m of (f.marks || {})[p] || []) {
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
      const page = await doc.getPage(g.page + 1), vp1 = vpRot(f, g.page, page, 1);
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
      await page.render({ canvasContext: ctx, viewport: vpRot(f, g.page, page, k), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
      ctx.setTransform(k, 0, 0, k, -x * k, -y * k);
      const mk = ((f.marks || {})[g.page] || []).filter(m => m.t !== 'note');
      if (mk.length) drawMarks(ctx, mk, vp1.width, vp1.height, 0, null);
      if (g.hover) {   // a comment that only shows on hover: print its words next to the spot so the picture shows them
        ctx.font = '11px ' + FONT;
        const bw = Math.min(220, w - 8), lines = wrapText(ctx, g.full, bw - 12).slice(0, 4), bh = lines.length * 14 + 10;
        const bx = clamp(g.rect[2] + 6, x + 4, x + w - bw - 4), by = clamp(g.rect[1] - 4, y + 4, y + h - bh - 4);
        ctx.fillStyle = '#FFF6D6'; ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = '#C99A00'; ctx.lineWidth = 0.8; ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = '#1B1F27'; lines.forEach((ln, i) => ctx.fillText(ln, bx + 6, by + 15 + i * 14));
      }
      const t = spot && disp.trim && f.kind !== 'docx' ? trimToInk(c, k) : null;   // a loose spot box shrinks to the marks inside it
      g.img = (t || c).toDataURL('image/jpeg', 0.85);
      if (t) t.width = t.height = 0;
      c.width = c.height = 0;
    }
    return { found, shots, kami, seen, nAnnots: Object.keys(kami).length, hasText: seen.length > 0 };
  } finally { doc.destroy(); }
}
// Finds the marks inside a picked spot: her colored ink first (red pen, highlights), or dark ink when nothing is colored.
// Returns a tighter copy with a little room around them, or null to keep the whole spot.
function trimToInk(c, k) {
  const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
  const box = () => ({ x1: W, y1: H, x2: -1, y2: -1, n: 0 }), col = box(), dark = box();
  const grow = (b, x, y) => { if (x < b.x1) b.x1 = x; if (x > b.x2) b.x2 = x; if (y < b.y1) b.y1 = y; if (y > b.y2) b.y2 = y; b.n++; };
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const i = (y * W + x) * 4, hi = Math.max(d[i], d[i + 1], d[i + 2]), lo = Math.min(d[i], d[i + 1], d[i + 2]);
    if (hi - lo > 70) grow(col, x, y); else if (hi < 140) grow(dark, x, y);
  }
  const b = col.n > 8 ? col : dark.n > 8 ? dark : null;
  if (!b) return null;
  const pad = 12 * k, x1 = Math.max(0, b.x1 - pad), y1 = Math.max(0, b.y1 - pad), x2 = Math.min(W, b.x2 + pad), y2 = Math.min(H, b.y2 + pad);
  if ((x2 - x1) * (y2 - y1) > W * H * 0.8) return null;
  const o = document.createElement('canvas'); o.width = Math.ceil(x2 - x1); o.height = Math.ceil(y2 - y1);
  o.getContext('2d').drawImage(c, x1, y1, o.width, o.height, 0, 0, o.width, o.height);
  return o;
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
    for (const f of st.files.filter(f => f.kind === 'docx' && f.hand)) {
      if (batch !== b0) return;
      try { f.scan = await scanFile(f, f.hand); f.scan.hand = true; } catch (e) { console.error(e); f.scan = { found: [], shots: [], kami: {}, err: true }; }
    }
    wordScoresOf(st); refound(st);
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
// The sheet lists only files with a grade on them (read, boxed or highlighted); "Show files with no grade" lists every file.
let sheetAll = !!store.get('gs.sheetall', false);
const rowGraded = r => r.word ? !!((r.f.wscore && r.f.wscore.total != null) || wordFound(r.f).length || (r.f.hand && r.f.scan && r.f.scan.shots.length))
  : !!(r.f.scan && (r.f.scan.found.length || r.f.scan.shots.length));
// box: every file to look through for "Box each grade by hand", graded or not.
function sheetRows(box) {
  const rows = [];
  batch.students.forEach((st, i) => {
    const fs = st.files.filter(viewable), words = st.files.filter(f => f.kind === 'docx');
    const inc = fs.filter(f => fileIn(st, f)), out = fs.filter(f => !fileIn(st, f));
    const cand = words.map(f => ({ st, i, f, word: true })).concat(inc.map(f => ({ st, i, f })));
    const shown = box || sheetAll ? cand : cand.filter(rowGraded);
    if (!shown.length && (!out.length || !sheetShowOut)) rows.push({ st, i, f: null, none: !fs.length && !st.files.length, nograde: cand.length > 0, first: cand[0] && cand[0].f });
    rows.push(...shown);
    if (sheetShowOut) for (const f of out) rows.push({ st, i, f, out: true });
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
    const rb = e.target.closest('[data-rebox]'); if (rb) return pickEach(rb.dataset.rebox);
    if (e.target.matches('[data-sheetall]')) { sheetAll = e.target.checked; store.set('gs.sheetall', sheetAll); return renderSheet(); }
    if (e.target.closest('[data-showout]')) { sheetShowOut = !sheetShowOut; return renderSheet(); }
    const io = e.target.closest('[data-bring],[data-leave]');
    if (io) {
      const v = io.dataset.bring || io.dataset.leave, bar = v.indexOf('|'), st = batch.students[+v.slice(0, bar)], path = v.slice(bar + 1);
      for (const d of layoutOf(st)) if (d.pages.some(([q]) => q === path)) setDocIn(st, d, !!io.dataset.bring);
      refound(st);
      renderList(); return renderSheet();
    }
    if (e.target.closest('[data-auto]')) { delete setup.spot; store.set('gs.setup', { ...setup, spot: undefined }); saveSoon(); return openSheet(true); }
    const c = e.target.closest('[data-copy]'); if (c) return copy(c.dataset.copy, c.dataset.copy ? 'Copied ' + c.dataset.copy : 'Nothing to copy');
    const go = e.target.closest('[data-open]'); if (go) { closeDlg(); return openStudent(+go.dataset.open, go.dataset.file); }
    if (e.target.closest('[data-cp]')) return copy(batch.students.map(st => { const g = gradeOf(st); return fmtNum(g.total != null ? g.total : g.pct); }).join('\n'), 'Copied ' + batch.students.length + ' scores in folder order (blank where unsure)');
    if (e.target.closest('[data-pdf]')) return saveBlob('Grade sheet - ' + batch.name + '.pdf', new Blob([await buildSheetPdf()], { type: 'application/pdf' }));
  };
  box.oninput = e => {
    const t = e.target.closest('[data-typed]'); if (!t) return;
    const st = batch.students[+t.dataset.typed];
    st.grade.sheet = t.value.trim().replace(',', '.'); saveSoon(); renderList(); if (st === batch.students[cur]) renderGrade();
  };
  box.onchange = e => { if (e.target.matches('[data-trim]')) { disp.trim = e.target.checked; store.set('gs.disp', disp); openSheet(true); } };
  const bar = box.querySelector('.prog i');
  await scanAll((n, t) => { if (bar) bar.style.width = (100 * n / t) + '%'; });
  wordScoresAll();
  if ($('#dlg').hidden || !$('#shBody')) return;
  renderSheet();
}
function renderSheet() {
  const rows = sheetRows();
  const nOut = batch.students.reduce((a, st) => a + st.files.filter(f => viewable(f) && !fileIn(st, f)).length, 0);
  const nOne = batch.students.filter(st => st.foundCount === 1).length, nMany = batch.students.filter(st => st.foundCount > 1).length;
  $('#shSub').textContent = (setup.spot ? 'Same spot on every paper · ' : '') + nOne + ' of ' + batch.students.length + ' read' + (nMany ? ' · ' + nMany + ' to check' : '');
  const spotted = !!setup.spot || batch.students.some(st => st.files.some(f => f.hand));
  const nHidden = sheetAll ? 0 : batch.students.reduce((a, st) => a + st.files.filter(f => f.kind === 'docx').map(f => ({ f, word: true })).concat(st.files.filter(f => viewable(f) && fileIn(st, f)).map(f => ({ f }))).filter(r => !rowGraded(r)).length, 0);
  $('#shBody').innerHTML = '<p class="muted" style="margin:0 0 10px;font-size:14px">Every row is made from the file named on it, inside that student’s folder. Click a picture to open that exact file. Click a score to copy it.</p>' +
    '<label class="chk" style="margin:0 0 10px;font-size:14px"><input type="checkbox" data-sheetall' + (sheetAll ? ' checked' : '') + '> Show files with no grade' + (sheetAll ? '' : nHidden ? ' (' + nHidden + ' hidden)' : '') + '<span class="muted" style="font-weight:400">&nbsp;· the downloaded sheet shows the same rows</span></label>' +
    (spotted ? '<label class="chk" style="margin:0 0 10px;font-size:14px"><input type="checkbox" data-trim' + (disp.trim ? ' checked' : '') + '> Trim each spot down to your marks</label>' : '') +
    (nOut ? '<p style="margin:0 0 10px;font-size:14px;background:var(--warn-soft);padding:8px 10px;border-radius:8px">' + nOut + (nOut === 1 ? ' file has' : ' files have') + ' no marks, so ' + (nOut === 1 ? 'it’s' : 'they’re') + ' left out as extra papers. <button class="link" data-showout>' + (sheetShowOut ? 'Hide them' : 'Show them') + '</button></p>' : '') +
    '<table class="gl"><thead><tr><th>#</th><th>Folder and file</th><th>On the paper</th><th>Read as</th></tr></thead><tbody>' +
    rows.map(({ st, i, f, out, none, word, nograde, first }) => {
      const where = '<div style="font-weight:600">' + esc(st.key) + '</div>' + (f ? '<div class="muted" style="font-size:13px;overflow-wrap:anywhere">' + esc(f.path) + '</div>' : '');
      if (word) {   // her Word rubric: the highlighted boxes, read straight from the file
        const w = f.wscore, ty = wordFound(f), hs = (f.hand && f.scan && f.scan.shots) || [], ri = rows.findIndex(r => r.f === f);
        const info = w ? w.crits.map((c, k) => esc(c.length > 28 ? c.slice(0, 28) + '…' : c) + ' <b>' + (w.per[k] == null ? '–' : fmtNum(w.per[k])) + '</b>').join(' · ') + (w.total != null && !w.done ? '<div class="muted" style="font-size:12px">Not every criterion is highlighted yet</div>' : '') : '';
        const pics = hs.map(g => '<div style="margin-bottom:6px"><img src="' + g.img + '" alt="" data-open="' + i + '" data-file="' + esc(f.path) + '" title="Open this file" style="display:block;max-width:360px;max-height:150px;border:1px solid var(--line);border-radius:4px;cursor:pointer;background:#fff"><div class="muted" style="font-size:12px">Page ' + (g.page + 1) + '</div></div>').join('');
        const big = (v, of, pct) => '<div class="big-sc" data-copy="' + esc(fmtNum(v)) + '" title="Click to copy">' + fmtNum(v) + (of ? '<small>/ ' + fmtNum(of) + '</small>' : '') + '</div>' + (pct != null ? '<div class="muted" style="font-size:13px;margin-top:4px;font-weight:500">= ' + fmtNum(pct) + '%</div>' : '');
        const hf = (f.hand && f.scan && f.scan.found) || [];
        const reads = w && w.total != null ? big(w.total, w.max, w.pct)
          : ty.length ? (ty.length > 1 ? '<span class="pill warn" style="display:inline-block;font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--warn-soft);color:var(--warn);margin-bottom:6px">' + ty.length + ' grades found, check</span>' : '') + ty.map(g => '<div class="big-sc" data-copy="' + esc(fmtNum(g.score != null ? g.score : g.pct)) + '" title="Click to copy">' + esc(foundLabel(g)) + '</div>').join('')
          : hf.length === 1 ? big(hf[0].score != null ? hf[0].score : hf[0].pct, hf[0].outOf, hf[0].score != null ? hf[0].pct : null)
          : hs.length ? '<input class="sc-in" type="text" inputmode="decimal" data-typed="' + i + '" value="' + esc(st.grade.sheet || '') + '" placeholder="Score" aria-label="Type the score you see in the picture"><div class="muted" style="font-size:12px;margin-top:4px;font-weight:400">Type what you see</div>'
          : '<span class="muted" style="font-weight:400">No grade found yet</span>';
        return '<tr><td class="n">' + (i + 1) + '</td><td>' + where + '</td><td>' + pics + '<button class="link" data-open="' + i + '" data-file="' + esc(f.path) + '" style="text-align:left">' + (w ? 'Word rubric' : 'Word file') + '</button>' +
          (info ? '<div class="muted" style="font-size:13px">' + info + '</div>' : '') + ty.map(g => '<div class="muted" style="font-size:13px;max-width:360px">Typed: “' + esc(g.text) + '”</div>').join('') +
          '<div style="margin-top:4px"><button class="link" style="font-size:12px" data-rebox="' + i + '|' + esc(f.path) + '">' + (f.hand ? 'Boxed by hand · redo' : 'Box it by hand') + '</button></div></td><td style="font-weight:700">' + reads + '</td></tr>';
      }
      if (!f) return '<tr><td class="n">' + (i + 1) + '</td><td>' + where + '</td><td class="muted">' + (none ? 'Nothing turned in' : nograde ? 'No grade yet. <button class="link" style="font-size:13px" data-rebox="' + i + '|' + esc(first.path) + '">Box it by hand</button>' : 'Only unmarked files, left out') + '</td><td></td></tr>';
      if (out) return '<tr style="opacity:.7"><td class="n">' + (i + 1) + '</td><td>' + where + '</td><td class="muted">Left out (no marks). <button class="link" data-bring="' + i + '|' + esc(f.path) + '">Bring back</button></td><td></td></tr>';
      const sc = f.scan || { found: [], shots: [] };
      const many = sc.found.length > 1;
      const pics = sc.shots.map(g => '<div style="margin-bottom:6px"><img src="' + g.img + '" alt="" data-open="' + i + '" data-file="' + esc(f.path) + '" title="Open this file" style="display:block;max-width:360px;max-height:150px;border:1px solid ' + (many ? 'var(--warn)' : 'var(--line)') + ';border-radius:4px;cursor:pointer;background:#fff">' +
        (g.text && g.from === 'note' ? '<div class="muted" style="font-size:12px;max-width:360px">Typed: “' + esc(g.text) + '” · page ' + (g.page + 1) + '</div>' : '<div class="muted" style="font-size:12px">Page ' + (g.page + 1) + '</div>') + '</div>').join('') ||
        '<span class="muted">' + (f.hand ? 'Boxed by hand' : sc.err ? 'Couldn’t read this file' : sc.seen && sc.seen.length ? 'No grade in the typed text I found: “' + esc(sc.seen.join('” · “')) + '”' : sc.nAnnots ? 'There are marks here but no typed text, so the grade may be handwritten or flattened. Try Box it by hand.' : 'No marks or typed text in this file. If you marked it in Kami, the marks may not have been saved into the file. Try Box it by hand.') + '</span>';
      const ri = rows.findIndex(r => r.f === f);
      const handNote = '<div style="margin-top:4px;display:flex;gap:14px"><button class="link" style="font-size:12px" data-rebox="' + i + '|' + esc(f.path) + '">' + (f.hand ? 'Boxed by hand · redo' : 'Box it by hand') + '</button><button class="link" style="font-size:12px;color:var(--muted)" data-leave="' + i + '|' + esc(f.path) + '">Leave out</button></div>';
      let reads;
      if (sc.found.length === 1) {   // clearly one score: show it big beside the picture
        const g0 = sc.found[0];
        reads = '<div class="big-sc" data-copy="' + esc(fmtNum(g0.score != null ? g0.score : g0.pct)) + '" title="Click to copy">' + (g0.score != null ? fmtNum(g0.score) + (g0.outOf ? '<small>/ ' + fmtNum(g0.outOf) + '</small>' : '') : fmtNum(g0.pct) + '<small>%</small>') + '</div>' +
          (g0.score != null && g0.pct != null ? '<div class="muted" style="font-size:13px;margin-top:4px;font-weight:500">= ' + fmtNum(g0.pct) + '%</div>' : '');
      } else if (sc.found.length) reads = sc.found.map(g => '<div class="c" data-copy="' + esc(fmtNum(g.score != null ? g.score : g.pct)) + '" style="cursor:copy">' + esc(foundLabel(g)) + '</div>').join('');
      else if (sc.shots.length) reads = '<input class="sc-in" type="text" inputmode="decimal" data-typed="' + i + '" value="' + esc(st.grade.sheet || '') + '" placeholder="Score" aria-label="Type the score you see in the picture"><div class="muted" style="font-size:12px;margin-top:4px;font-weight:400">Type what you see</div>';
      else reads = '';
      const own = ownGrade(st), ps = sc.found.length === 1 ? sc.found[0].score : sc.found.length ? null : paperScore(st);
      if (own.total != null && ps != null && Math.abs(own.total - ps) > 0.001) reads += '<span class="sc-warn">Your score in Grading Studio is ' + fmtNum(own.total) + '</span>';
      return '<tr><td class="n">' + (i + 1) + '</td><td>' + where + '</td><td>' + pics + handNote + '</td><td style="font-weight:700">' +
        (many ? '<span class="pill warn" style="display:inline-block;font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--warn-soft);color:var(--warn);margin-bottom:6px">' + sc.found.length + ' grades found, check</span>' : '') + reads + '</td></tr>';
    }).join('') + '</tbody></table>';
}
// Box each grade by hand: one paper at a time, drag a box around the grade, and it moves to the next paper.
let eachKeys = null;
async function pickEach(start) {
  const rows = sheetRows(true);
  const fileRows = rows.map((r, k) => ({ ...r, k })).filter(r => r.f && (viewable(r.f) || r.f.kind === 'docx'));
  if (!fileRows.length) return toast('No papers to box');
  let pos = start != null ? Math.max(0, fileRows.findIndex(r => r.i + '|' + r.f.path === start)) : Math.max(0, fileRows.findIndex(r => !r.f.hand));
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
    if (f.kind === 'docx' && f.wpdfOf !== f.data) body.insertAdjacentHTML('beforeend', '<p class="muted" data-wwait>Getting the Word file ready…</p>');
    try { doc = await pdfjsLib.getDocument({ data: (await paperBytes(f)).slice(), isEvalSupported: false }).promise; }
    catch (e) { console.error(e); if (my === token) body.insertAdjacentHTML('beforeend', '<p>This file couldn’t be opened. Click Skip.</p>'); return; }
    if (my !== token) { doc.destroy(); return; }
    const ww = body.querySelector('[data-wwait]'); if (ww) ww.remove();
    const avail = body.clientWidth - 40;
    for (let p = 0; p < doc.numPages; p++) {
      if (my !== token) break;
      const page = await doc.getPage(p + 1);
      const v1 = vpRot(f, p, page, 1), k = f.kind === 'docx' ? Math.min(1.5, avail / v1.width) : Math.min(1.8, avail / v1.width, Math.max(body.clientHeight - 50, 480) / v1.height), dpr = window.devicePixelRatio || 1;
      const vp = vpRot(f, p, page, k * dpr);
      const c = document.createElement('canvas');
      c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      Object.assign(c.style, { width: v1.width * k + 'px', height: v1.height * k + 'px', display: 'block', margin: '0 auto 14px', background: '#fff', boxShadow: 'var(--shadow)', cursor: 'crosshair', touchAction: 'none' });
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
      if (my !== token) break;
      const mk = ((f.marks || {})[p] || []).filter(m => m.t !== 'note');
      if (mk.length) { ctx.save(); ctx.scale(k * dpr, k * dpr); drawMarks(ctx, mk, v1.width, v1.height, 0, null); ctx.restore(); }
      const base = ctx.getImageData(0, 0, c.width, c.height);
      const paint = sel => {
        ctx.putImageData(base, 0, 0);
        if (!sel) return;
        ctx.fillStyle = 'rgba(31,111,178,.14)'; ctx.fillRect(sel.x * c.width, sel.y * c.height, sel.w * c.width, sel.h * c.height);
        ctx.strokeStyle = '#1F6FB2'; ctx.lineWidth = 2 * dpr; ctx.strokeRect(sel.x * c.width, sel.y * c.height, sel.w * c.width, sel.h * c.height);
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
    if (sel) { ctx.fillStyle = 'rgba(31,111,178,.12)'; ctx.fillRect(sel.x * c.width, sel.y * c.height, sel.w * c.width, sel.h * c.height); ctx.strokeStyle = '#1F6FB2'; ctx.lineWidth = 2; ctx.strokeRect(sel.x * c.width, sel.y * c.height, sel.w * c.width, sel.h * c.height); }
  };
  const load = async () => {
    const doc = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
    const pn = which === 'last' ? doc.numPages - 1 : 0, page = await doc.getPage(pn + 1);
    const v1 = vpRot(f, pn, page, 1); const k = Math.min(1.4, 640 / v1.width);
    const vp = vpRot(f, pn, page, k); W = vp.width; H = vp.height;
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
      const { st, i, f, word } = rows[ri], sc = word ? { found: f.wscore && f.wscore.total != null ? [{ score: f.wscore.total, outOf: f.wscore.max, pct: f.wscore.pct }] : wordFound(f).length ? wordFound(f) : (f.hand && f.scan && f.scan.found) || [], shots: (f.hand && f.scan && f.scan.shots) || [] } : f && f.scan ? f.scan : { found: [], shots: [] };
      const imgs = [];
      for (const g of sc.shots) { const im = await loadImg(g.img); if (im) imgs.push({ im, h: Math.min(90, maxW * im.height / im.width) }); }
      const rh = Math.max(64, imgs.reduce((a, o) => a + o.h + 6, 0) + (word && imgs.length && f.wscore ? 44 : 0)) + 10;
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
      if (sc.found.length === 1) { ctx.font = 'bold 18px ' + FONT; ctx.fillText(foundLabel(sc.found[0]), M + 20, ly + 12); ly += 22; }
      else for (const g of sc.found) { ctx.fillText(foundLabel(g), M + 20, ly + 4); ly += 15; }
      if (f && !sc.found.length && st.grade.sheet) { ctx.font = 'bold 18px ' + FONT; ctx.fillText(st.grade.sheet, M + 20, ly + 12); ctx.font = '9.5px ' + FONT; ctx.fillStyle = '#5D6475'; ctx.fillText('typed from the picture', M + 20, ly + 24); }
      let iy = y;
      for (const { im, h } of imgs) { const w = h * im.width / im.height; ctx.drawImage(im, X, iy, w, h); ctx.strokeStyle = sc.found.length > 1 ? '#E8B451' : '#DADDE6'; ctx.strokeRect(X, iy, w, h); iy += h + 6; }
      if (word) { ctx.fillStyle = '#151922'; ctx.font = '11px ' + FONT; let wy = (imgs.length ? iy : y) + 13; for (const ln of wrapText(ctx, !f.wscore || wordFound(f).length ? (wordFound(f).length ? 'Word file, typed: ' + wordFound(f).map(g => '“' + g.text + '”').join(' · ') : imgs.length ? '' : 'Word file') : 'Word rubric: ' + f.wscore.crits.map((c, k) => c + ' ' + (f.wscore.per[k] == null ? '–' : fmtNum(f.wscore.per[k]))).join(' · '), maxW).slice(0, 4)) { ctx.fillText(ln, X, wy); wy += 14; } }
      else if (!imgs.length) { ctx.fillStyle = '#8A90A0'; ctx.font = 'italic 11px ' + FONT; ctx.fillText(f ? 'No typed grade found' : rows[ri].nograde ? 'No grade yet' : 'Nothing turned in', X, y + 13); }
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
  const vp = vpRot(f, p, page, 1), W = vp.width, H = vp.height;
  const marks = scrubMarks((f.marks[p] || []).concat((f.kami && f.kami[p] && f.kami[p].notes) || []), rx);
  const side = marks.some(m => m.t === 'note') ? sideFor(W) : 0;
  const c = document.createElement('canvas');
  c.width = Math.ceil((W + side) * scale); c.height = Math.ceil(H * scale);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vpRot(f, p, page, scale), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
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
async function checkCovers(start, onDone) {
  const list = [];
  for (const st of batch.students) shareDocs(st).forEach((d, k) => list.push({ st, d, k }));
  if (!list.length) return toast('No papers to share');
  let pos = Math.min(start || 0, list.length - 1), token = 0, last = null;
  openDlg('<div class="bh"><h2 id="ccTitle">Check the covers</h2><span class="muted" id="ccCount"></span><button class="icon" data-done aria-label="Done">✕</button></div>' +
    '<div class="bb" id="ccBody" style="background:var(--surface-2)"></div>' +
    '<div class="bf" style="justify-content:space-between"><span class="muted" style="font-size:13px;align-self:center;max-width:46%">Drag a box over a name it missed. Click one of your boxes to take it off.</span><span style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="btn" data-every hidden>Use my last box on every paper</button><button class="btn" data-back>◀ Back</button><button class="btn primary" data-next>Next ▶</button></span></div>');
  const box = $('#dlgBox');
  const finish = () => { if (eachKeys) document.removeEventListener('keydown', eachKeys, true); eachKeys = null; saveSoon(); (onDone || openShare)(); };
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
        const pg0 = await js.get(path).getPage(p + 1), v1 = vpRot(f, p, pg0, 1);
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
  files['rubric.json'] = enc(JSON.stringify({ mode: setup.mode, criteria: crit, levels: setup.mode === 'rubric' ? '1 to 4 per row, half points allowed' : undefined, outOf: maxPoints(), scale: setup.scale || null }, null, 1));
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
      const l = store.get('gs.lib', null); if (l) lib = migrateLib(l);
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
let mammothP = null;
async function docxHtml(bytes) {
  const r = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
  // A link in a student's Word file keeps only web or email addresses, so a planted script link can't run here.
  const t = document.createElement('template'); t.innerHTML = r.value;
  for (const el of t.content.querySelectorAll('*')) for (const at of [...el.attributes]) if (/^on/i.test(at.name)) el.removeAttribute(at.name);
  for (const a of t.content.querySelectorAll('a[href]')) if (!/^(https?:|mailto:|#)/i.test(a.getAttribute('href').trim())) a.removeAttribute('href');
  for (const im of t.content.querySelectorAll('img[src]')) if (!/^data:image\//i.test(im.getAttribute('src'))) im.removeAttribute('src');
  return t.innerHTML;
}
async function docxCard(f, title) {
  const el = document.createElement('div'); el.className = 'docx';
  el.innerHTML = '<div class="fhead"><span style="color:var(--fg)">' + esc(title || f.name) + '</span><span>Word file</span></div><div class="dpage"><p class="muted">Opening…</p></div>';
  try { el.querySelector('.dpage').innerHTML = await docxHtml(f.data); for (const a of el.querySelectorAll('a')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } }
  catch { el.querySelector('.dpage').innerHTML = '<p>This Word file couldn’t be opened.</p>'; }
  return el;
}
// A Word document Taylor keeps beside every student in one download (her rubric and notes). Kept in this browser.
const refKey = () => 'gs.rd.' + batch.id;
function refDoc() { const r = store.get(refKey(), null); if (!r) return null; const bin = atob(r.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return { name: r.name, data: u }; }
async function pickRefDoc() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.docx,.docm,.dotx,.dotm';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    const u = new Uint8Array(await f.arrayBuffer());
    let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    if (!store.set(refKey(), { name: f.name, b64: btoa(s) })) return toast('That document is too big to keep in this browser');
    toast('“' + f.name + '” now shows above every paper'); openStudent(cur);
  };
  inp.click();
}

/* ---------------- readings: any file shown above every student's paper (kept with this download, never exported) ---------------- */
const REF_KEY = '\u0001reading';   // can't be a student's folder name
let refFiles = [];   // [{ path, name, data }]
const refId = path => batch.id + '|' + REF_KEY + '|' + path;
async function loadRefs() {
  refFiles = [];
  let recs = [];
  try { recs = (await idbDo('readonly', o => o.getAll())) || []; } catch { return; }
  for (const r of recs.filter(r => r.bid === batch.id && r.key === REF_KEY).sort((a, b) => a.added - b.added)) refFiles.push({ path: r.path, name: r.name, data: r.data });
}
function pickRefs() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true;   // any kind of file
  inp.onchange = () => addRefs([...inp.files]);
  inp.click();
}
async function addRefs(files) {
  let n = 0;
  for (const f of files) {
    const data = new Uint8Array(await f.arrayBuffer()), path = f.name;
    try { await idbDo('readwrite', o => o.put({ bid: batch.id, key: REF_KEY, path, name: f.name, data, added: Date.now() }, refId(path))); }
    catch { toast('This browser is out of room to keep ' + f.name); continue; }
    refFiles = refFiles.filter(r => r.path !== path).concat({ path, name: f.name, data }); n++;
  }
  if (!n) return;
  renderGrade(); openStudent(cur);
  toast(n === 1 ? '“' + files[0].name + '” now shows above every paper' : n + ' files now show above every paper');
}
async function dropRef(path) {
  try { await idbDo('readwrite', o => o.delete(refId(path))); } catch {}
  refFiles = refFiles.filter(r => r.path !== path);
  renderGrade(); openStudent(cur);
}
// A folded-open card with the reading: PDF and picture pages, a Word file, text, a recording, or a download link.
async function refCard(r) {
  const det = document.createElement('details'); det.className = 'refd';
  const k = 'gs.refOpen.' + r.path; det.open = store.get(k, true); det.ontoggle = () => store.set(k, det.open);
  det.innerHTML = '<summary>' + esc(r.name) + ' <span class="muted" style="font-weight:400;font-size:13px">· shown with every paper, not sent back</span></summary><div class="refbody"></div>';
  const body = det.querySelector('.refbody');
  const f = await makeFile('reading/' + r.path, r.data.slice());
  try {
    if (f.kind === 'docx') { const c = await docxCard({ name: r.name, data: r.data }, r.name); const h = c.querySelector('.fhead'); if (h) h.remove(); body.appendChild(c); }
    else if (viewable(f)) {
      await workerReady;
      const doc = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
      const box = document.createElement('div'); box.className = 'refpages'; body.appendChild(box);
      const dpr = window.devicePixelRatio || 1, w = Math.min(860, ($('#paper').clientWidth || 900) - 80);
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i), v1 = page.getViewport({ scale: 1 }), s = w / v1.width, vp = page.getViewport({ scale: s * dpr });
        const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height); c.style.width = w + 'px';
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
        box.appendChild(c); page.cleanup();
      }
      doc.destroy();
    }
    else if (f.kind === 'text') { const c = textCard(f); const h = c.querySelector('.fhead'); if (h) h.remove(); body.appendChild(c); }
    else if (f.kind === 'media') { const v = document.createElement(/\.(mp4|mov|webm|m4v)$/i.test(r.name) ? 'video' : 'audio'); v.controls = true; v.src = URL.createObjectURL(new Blob([r.data])); v.style.width = '100%'; body.appendChild(v); }
    else body.appendChild(otherCard(f));
  } catch { body.innerHTML = '<p class="muted">This file couldn’t be shown here.</p>'; }
  return det;
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

// Every recording in the download, one after another. Each transcript is saved as soon as it's done,
// so stopping (or closing the tab) keeps the ones already made.
let trAll = null;
function openTranscripts() {
  const all = batch.students.flatMap((st, i) => st.files.filter(f => f.kind === 'media').map(f => ({ st, i, f })));
  const have = all.filter(x => x.f.tr).length;
  const render = (msg) => {
    $('#trBody').innerHTML = '<p style="margin-top:0"><b>' + all.length + (all.length === 1 ? ' recording' : ' recordings') + '</b> in this download' + (have ? ', ' + have + ' with a transcript already' : '') + '.</p>' +
      (have && !trAll ? '<label class="chk"><input type="checkbox" id="trRedo"> Make the existing ones again too</label>' : '') +
      '<p class="muted" style="font-size:13px">Runs in this browser (nothing is uploaded). The speech engine downloads once. Keep this tab open while it works; you can keep grading in the meantime.</p>' +
      '<div class="prog"' + (trAll ? '' : ' hidden') + '><i style="width:' + (trAll ? trAll.pct : 0) + '%"></i></div><p id="trMsg" style="font-size:14px">' + esc(msg || '') + '</p>';
  };
  openDlg('<div class="bh"><h2>Transcripts</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb" id="trBody"></div>' +
    '<div class="bf"><button class="btn" data-close>Close</button><button class="btn primary" data-go>' + (trAll ? 'Stop' : 'Make transcripts') + '</button></div>', true);
  render(trAll ? trAll.msg : '');
  const box = $('#dlgBox');
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (!e.target.closest('[data-go]')) return;
    if (trAll) { trAll.stop = true; e.target.textContent = 'Stopping after this one…'; return; }
    const redo = !!($('#trRedo') && $('#trRedo').checked), todo = all.filter(x => redo || !x.f.tr);
    if (!todo.length) return toast('Every recording already has a transcript');
    e.target.closest('[data-go]').textContent = 'Stop';
    trAll = { stop: false, pct: 0, msg: '' };
    let lock = null; try { lock = await navigator.wakeLock.request('screen'); } catch {}
    const say = m => { trAll.msg = m; const el = $('#trMsg'); if (el) el.textContent = m; const bar = $('#trBody .prog'); if (bar) { bar.hidden = false; bar.firstChild.style.width = trAll.pct + '%'; } };
    let done = 0, failed = 0;
    for (let k = 0; k < todo.length && !trAll.stop; k++) {
      const { st, i, f } = todo[k];
      trAll.pct = Math.round(100 * k / todo.length);
      try {
        await transcribeFile(f, m => say('Student ' + (i + 1) + ' (' + (k + 1) + ' of ' + todo.length + ') · ' + f.name + ' · ' + m));
        done++; saveNow();
        if (i === cur && $('#dlg').hidden) openStudent(cur);
      } catch (er) { failed++; console.error(er); }
    }
    try { lock && lock.release(); } catch {}
    const stopped = trAll.stop; trAll = null;
    const msg = (stopped ? 'Stopped. ' : 'Done. ') + done + (done === 1 ? ' transcript' : ' transcripts') + ' made' + (failed ? ', ' + failed + ' couldn’t be read (try Chrome, or convert those to .mp4 or .m4a)' : '') + '.';
    toast(msg);
    if (!$('#dlg').hidden && $('#trBody')) { render(msg); const g = box.querySelector('[data-go]'); if (g) g.textContent = 'Make transcripts'; }
    renderList(); if ($('#dlg').hidden) openStudent(cur);
  };
}

/* ---------------- units, assignments and rosters (kept in this browser only) ---------------- */
const uid = () => Math.random().toString(36).slice(2, 10);
const fresh = store.get('gs.lib', null) == null;
// Each class holds its roster and its own units; each unit holds assignment cards. Assignments with no class sit in
// lib.loose. (Before 10/29 units were shared by every class; migrateLib moves each card into its class's unit of the same name.)
function migrateLib(l) {
  l.classes ||= []; for (const c of l.classes) { c.units ||= []; c.names ||= []; }
  l.loose ||= { id: '', units: [] };
  for (const u of l.units || []) for (const it of u.items || []) {
    const c = l.classes.find(k => k.id === it.classId) || l.loose;
    let cu = c.units.find(x => x.name === u.name); if (!cu) c.units.push(cu = { id: uid(), name: u.name, items: [] });
    cu.items.push(it);
  }
  l.units = [];
  return l;
}
let lib = migrateLib(store.get('gs.lib', null) || { classes: [] });
// Taylor's 2026-27 classes are there from the start (empty until she adds a roster); added once, so deleting one sticks.
if (!lib.seed2627) {
  for (const n of ['12EL-1', '12EL-2', '11EL-2']) if (!lib.classes.some(c => c.name.replace(/\s+/g, '').toLowerCase() === n.toLowerCase())) lib.classes.push({ id: uid(), name: n, names: [], units: [] });
  lib.seed2627 = true; store.set('gs.lib', lib);
  // A brand-new browser's starter list never wins over units and rosters already synced from another computer.
  if (fresh) { const t = syncTimes(); t['gs.lib'] = 1; try { localStorage.setItem('gs.syncT', JSON.stringify(t)); } catch {} }
}
function saveLib() { if (!store.set('gs.lib', lib)) toast('This browser is out of room to keep your units and rosters.'); }
const holders = () => lib.classes.concat([lib.loose]);
const holderById = id => id ? lib.classes.find(c => c.id === id) || null : lib.loose;
const findItem = id => { for (const c of holders()) for (const u of c.units) { const it = u.items.find(x => x.id === id); if (it) return { c, u, it }; } return null; };
const findUnit = id => { for (const c of holders()) { const u = c.units.find(x => x.id === id); if (u) return { c, u }; } return null; };
const classById = id => lib.classes.find(c => c.id === id);
function batchSummary(it) {
  if (!it.batchId) return 'No download opened yet';
  const data = store.get(it.batchId, null);
  const d = new Date(it.opened || (data && data.t) || Date.now());
  let n = 0;
  if (data) for (const k in data.s) { const g = data.s[k].g; if (g && (g.rubric.some(v => v != null) || g.points !== '')) n++; }
  const m = keptMeta.get(it.batchId);
  if (m) return 'Last worked on ' + fmtDay(m.t) + ' · ' + (m.scored || 0) + ' of ' + m.n + ' scored' + (m.papers ? '' : ' · drop the same ZIP to keep going');
  return 'Opened ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + (data ? ' · ' + n + ' scored' : '') + ' · drop the same ZIP to keep going';
}
function renderLib() {
  renderKept();
  const card = it => '<div class="card" draggable="true" data-card="' + it.id + '"><div class="t">' + esc(it.name) + '</div>' +
    '<div class="m">' + esc(batchSummary(it)) + '</div>' +
    '<div class="row">' + (it.batchId && (keptMeta.get(it.batchId) || {}).papers ? '<button class="btn sm primary" data-kopen="' + esc(it.batchId) + '" data-kasg="' + it.id + '">Open</button><button class="btn sm" data-open-asg="' + it.id + '">Other download…</button>'
      : '<button class="btn sm primary" data-open-asg="' + it.id + '">Open download…</button>') + '<button class="btn sm" data-edit-asg="' + it.id + '">Edit</button></div></div>';
  const unit = u => '<div class="unit" draggable="true" data-unit="' + u.id + '">' +
    '<div class="uhead" title="Drag to move this unit"><span class="nm">' + esc(u.name) + '</span><button class="icon" data-urename="' + u.id + '" title="Rename unit" aria-label="Rename unit">✎</button>' +
    '<button class="icon" data-udel="' + u.id + '" title="Delete unit" aria-label="Delete unit">✕</button></div>' +
    '<div class="atl">' + (u.atlas ? '<a href="' + esc(u.atlas) + '" target="_blank" rel="noopener noreferrer" title="' + esc(u.atlas) + '">Open in Atlas ↗</a><button class="link" data-uatlas="' + u.id + '">Change</button>'
      : '<button class="link" data-uatlas="' + u.id + '">+ Link to Atlas</button>') + '</div>' +
    '<div class="cards">' + u.items.map(card).join('') + '</div>' +
    '<button class="addcard" data-additem="' + u.id + '">+ Assignment</button></div>';
  const block = (c, ci) => '<div class="cls" data-cls="' + esc(c.id) + '"><div class="clshead"><h3>' + esc(ci < 0 ? 'No class' : c.name) + '</h3>' +
    (ci < 0 ? '<span class="muted">Assignments with no roster. Drag them into a class.</span>' :
      '<span class="muted">' + (c.names.length ? c.names.length + ' students on the roster' : 'No roster yet') + '</span><button class="btn sm" data-edit-class="' + ci + '">' + (c.names.length ? 'Edit roster' : 'Add roster') + '</button>' +
      '<button class="icon" data-cmove="' + ci + ':-1" title="Move this class up" aria-label="Move this class up"' + (ci ? '' : ' disabled') + '>↑</button><button class="icon" data-cmove="' + ci + ':1" title="Move this class down" aria-label="Move this class down"' + (ci < lib.classes.length - 1 ? '' : ' disabled') + '>↓</button>') +
    '<span class="sp"></span><button class="btn sm" data-addunit="' + esc(c.id) + '">+ Unit</button></div>' +
    '<div class="board">' + (c.units.map(unit).join('') || '<div class="empty-note">No units yet. Click + Unit.</div>') + '</div></div>';
  const loose = lib.loose.units.some(u => u.items.length);
  $('#classes').innerHTML = lib.classes.map(block).join('') + (loose ? block(lib.loose, -1) : '') ||
    '<div class="empty-note">No classes yet. Click + Class and paste or upload a class list.</div>';
}
// Drag and drop: assignment cards between units (in any class), and units between classes.
let ldrag = null;
document.addEventListener('dragstart', e => {
  if (!$('#start') || $('#start').hidden) return;
  const card = e.target.closest('.card'), unit = e.target.closest('.unit');
  if (card) ldrag = { kind: 'card', id: card.dataset.card, el: card };
  else if (unit) ldrag = { kind: 'unit', id: unit.dataset.unit, el: unit };
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
  if (!ldrag || !e.target.closest) return null;
  if (ldrag.kind === 'card') { const z = e.target.closest('.unit'); if (!z) return null; const cards = z.querySelector('.cards'); const list = [...cards.querySelectorAll('.card')]; return { unit: z.dataset.unit, k: slot(list, e, false), list, cards }; }
  if (ldrag.kind === 'unit') { const z = e.target.closest('.cls'); if (!z) return null; const board = z.querySelector('.board'), list = [...board.querySelectorAll('.unit')]; return { cls: z.dataset.cls, k: slot(list, e, true), list, cards: board }; }
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
    const from = findItem(ldrag.id), to = findUnit(t.unit); if (!from || !to) return;
    const i = from.u.items.indexOf(from.it);
    from.u.items.splice(i, 1); if (from.u === to.u && i < k) k--;
    to.u.items.splice(k, 0, from.it);
    from.it.classId = to.c.id;   // moved to another class: it uses that class's roster
  } else {
    const from = findUnit(ldrag.id), to = holderById(t.cls); if (!from || !to) return;
    const i = from.c.units.indexOf(from.u);
    from.c.units.splice(i, 1); if (from.c === to && i < k) k--;
    to.units.splice(k, 0, from.u);
    for (const it of from.u.items) it.classId = to.id;
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
  const f = findItem(card.dataset.card); if (!f) return;
  const out = await entriesFromDrop(e.dataTransfer);
  intake(out.list, out.label, f.it);
}, true);

let asgTarget = null;
$('#asgDirIn').onchange = e => {
  const fs = [...e.target.files], top = fs.length ? (fs[0].webkitRelativePath || '').split('/')[0] : '';
  if (asgTarget && fs.length) intake(fs.map(f => ({ path: (f.webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name, file: f })), top, asgTarget);
  e.target.value = '';
};
$('#asgIn').onchange = e => { const fs = [...e.target.files]; if (asgTarget && fs.length) intake(fs.map(f => ({ path: f.name, file: f })), fs.length === 1 ? fs[0].name.replace(/\.[^.]+$/, '') : '', asgTarget); e.target.value = ''; };
$('#start').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.addunit != null) { const c = holderById(b.dataset.addunit); const name = prompt('Unit name', 'Unit ' + (c.units.length + 1)); if (name && name.trim()) { c.units.push({ id: uid(), name: name.trim(), items: [] }); saveLib(); renderLib(); } return; }
  if (b.id === 'addClass') return editClass(-1);
  if (b.dataset.cmove) { const [ci, d] = b.dataset.cmove.split(':').map(Number), j = ci + d; if (j >= 0 && j < lib.classes.length) { [lib.classes[ci], lib.classes[j]] = [lib.classes[j], lib.classes[ci]]; saveLib(); renderLib(); } return; }
  if (b.dataset.urename != null) { const f = findUnit(b.dataset.urename); if (!f) return; const name = prompt('Unit name', f.u.name); if (name && name.trim()) { f.u.name = name.trim(); saveLib(); renderLib(); } return; }
  if (b.dataset.uatlas != null) return askAtlas(b.dataset.uatlas);
  if (b.dataset.udel != null) {
    const f = findUnit(b.dataset.udel); if (!f) return; const u = f.u;
    if (u.items.length && !confirm('Delete “' + u.name + '” and its ' + u.items.length + ' assignment' + (u.items.length === 1 ? '' : 's') + '? Saved marks for those downloads stay in this browser.')) return;
    f.c.units.splice(f.c.units.indexOf(u), 1); saveLib(); renderLib(); return;
  }
  if (b.dataset.additem != null) return editAssignment(null, b.dataset.additem);
  if (b.dataset.editAsg) return editAssignment(b.dataset.editAsg);
  if (b.dataset.kopen) { const f = b.dataset.kasg ? findItem(b.dataset.kasg) : null; b.disabled = true; b.textContent = 'Opening…'; return reopenKept(b.dataset.kopen, f ? f.it : null).finally(() => { b.disabled = false; }); }
  if (b.dataset.kforget) {   // two clicks, so a stray click can't throw work away
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Click again to forget it'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'Forget'; } }, 4000); return; }
    return forgetKept(b.dataset.kforget);
  }
  if (b.dataset.openAsg) {
    asgTarget = findItem(b.dataset.openAsg).it;
    openDlg('<div class="bh"><h2>Open “' + esc(asgTarget.name) + '”</h2></div><div class="bb"><p style="margin-top:0">Where is the ManageBac download? You can also drop the ZIP or the folder straight onto this assignment’s card.</p></div>' +
      '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn" data-pc>The ZIP or files…</button><button class="btn" data-dir>A whole folder…</button><button class="btn" data-scan>A scan of everyone’s papers…</button><button class="btn" data-match>Files to match to a roster…</button>' + (gcid() ? '<button class="btn primary" data-dv>From Google Drive…</button>' : '') + '</div>', true);
    $('#dlgBox').onclick = ev => { if (ev.target.closest('[data-cancel]')) return closeDlg(); if (ev.target.closest('[data-pc]')) { closeDlg(); $('#asgIn').click(); } if (ev.target.closest('[data-dir]')) { closeDlg(); pickDir('#asgDirIn'); } if (ev.target.closest('[data-scan]')) { closeDlg(); scanFor = asgTarget; $('#scanIn').click(); } if (ev.target.closest('[data-match]')) { const a = asgTarget; askFilesOrFolder('Match files to a roster', 'Each file is matched to a student by the name in its file name or folder name, and you can fix any match.', list => matchToRoster(list, a)); } if (ev.target.closest('[data-dv]')) { closeDlg(); openFromDrive(asgTarget); } };
    return;
  }
  if (b.dataset.editClass != null) return editClass(+b.dataset.editClass);
});
// The unit's page in Atlas (web links only); empty removes it. Shown on the unit and in the top bar while grading.
function askAtlas(unitId) {
  const f = findUnit(unitId); if (!f) return;
  let v = prompt('Paste the Atlas link for ' + f.u.name + ' (leave empty to remove it)', f.u.atlas || '');
  if (v == null) return; v = v.trim();
  if (v && !/^https?:\/\//i.test(v)) v = 'https://' + v;
  if (v && !/^https?:\/\/[^\s]+$/i.test(v)) return toast('That doesn’t look like a web link');
  if (v) f.u.atlas = v; else delete f.u.atlas;
  saveLib(); if (batch) renderTopAtlas(); else renderLib();
}
function renderTopAtlas() {
  const el = $('#topAtlas'); if (!el) return;
  const f = batch && batch.assignment && findItem(batch.assignment.id);
  el.innerHTML = !f ? '' : f.u.atlas ? '<a href="' + esc(f.u.atlas) + '" target="_blank" rel="noopener noreferrer" title="' + esc(f.u.name) + ' in Atlas">Atlas ↗</a>'
    : '<button class="link" data-uatlas="' + f.u.id + '" title="Link ' + esc(f.u.name) + ' to its Atlas page">+ Atlas link</button>';
}
$('#topAtlas').addEventListener('click', e => { const b = e.target.closest('[data-uatlas]'); if (b) askAtlas(b.dataset.uatlas); });
// The unit list follows the class picked; a class with no units gets a "Unit 1" when the assignment is saved.
function editAssignment(id, unitId) {
  const f = id ? findItem(id) : null, start = f ? f : findUnit(unitId) || { c: lib.classes[0] || lib.loose, u: null };
  const it = f ? f.it : { id: uid(), name: '', classId: start.c.id };
  openDlg('<div class="bh"><h2>' + (f ? 'Edit assignment' : 'New assignment') + '</h2></div><div class="bb">' +
    '<div class="field"><label for="aName">Name</label><input type="text" id="aName" value="' + esc(it.name) + '" placeholder="e.g. Ch 3 Analysis Paragraph"></div>' +
    '<div class="field"><label for="aClass">Class</label><select id="aClass" class="btn" style="justify-content:flex-start">' + lib.classes.map(c => '<option value="' + c.id + '"' + (c === start.c ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '<option value=""' + (start.c === lib.loose ? ' selected' : '') + '>No class</option></select></div>' +
    '<div class="field"><label for="aUnit">Unit</label><select id="aUnit" class="btn" style="justify-content:flex-start"></select></div>' +
    '<p class="muted" style="font-size:13px;margin:0">The rubric is set the first time you open a download for it, with Rubric setup, and it’s remembered for this assignment.</p></div>' +
    '<div class="bf">' + (f ? '<button class="btn" data-del style="margin-right:auto">Delete</button>' : '') + '<button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Save</button></div>', true);
  const fillUnits = keep => {
    const c = holderById($('#aClass').value);
    $('#aUnit').innerHTML = c.units.map(u => '<option value="' + u.id + '"' + (keep && u === keep ? ' selected' : '') + '>' + esc(u.name) + '</option>').join('') || '<option value="">Unit 1 (new)</option>';
  };
  fillUnits(start.u);
  $('#aClass').onchange = () => fillUnits(null);
  setTimeout(() => $('#aName').focus(), 0);
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target.closest('[data-del]')) { if (!confirm('Delete “' + it.name + '”?')) return; f.u.items.splice(f.u.items.indexOf(it), 1); saveLib(); closeDlg(); return renderLib(); }
    if (e.target.closest('[data-ok]')) {
      const name = $('#aName').value.trim(); if (!name) { $('#aName').focus(); return; }
      const c = holderById($('#aClass').value);
      let to = c.units.find(u => u.id === $('#aUnit').value);
      if (!to) c.units.push(to = { id: uid(), name: 'Unit 1', items: [] });
      it.name = name; it.classId = c.id;
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
  const c = ci >= 0 ? lib.classes[ci] : { id: uid(), name: '', names: [], units: [] };
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
    if (e.target.closest('[data-del]')) { if (!confirm('Delete the ' + c.name + ' class? Its assignments move to “No class”.')) return; for (const u of c.units) { for (const it of u.items) it.classId = ''; lib.loose.units.push(u); } lib.classes.splice(ci, 1); saveLib(); closeDlg(); return renderLib(); }
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
// Students always go in the order of the class roster: matched names first, in roster order, then anyone the roster
// doesn't name, in folder order. With no class picked, the class whose roster names most of the folders is used.
function rosterSort() {
  if (!batch) return;
  let c = batchClass();
  if (!c && batch.classId !== '') {
    let best = null, bn = 0;
    for (const k of lib.classes) if (k.names.length) { const n = rosterMatch(k.names).size; if (n > bn) { bn = n; best = k; } }
    if (best && bn >= Math.max(2, batch.students.length / 2)) { c = best; batch.classId = best.id; }
  }
  // Everyone on the roster is in the list, even with nothing turned in yet; their paper can be added from their name.
  // A roster place-holder that never got a file goes away if the roster changes.
  batch.students = batch.students.filter(st => !(st.gap && !st.files.length && !(c && c.names.includes(st.key))));
  if (c && c.names.length) {
    const have = rosterMatch(c.names), saved = store.get(batch.id, null) || batch.keptWork || null;
    for (const nm of c.names) if (!have.has(nm)) {
      const s = saved && saved.s && saved.s[nm];
      batch.students.push({ key: nm, files: [], grade: { rubric: [], points: '', comment: '', ...(s && s.g) }, layout: null, inc: (s && s.inc) || {}, gap: true });
    }
  }
  const byFolder = [...batch.students].sort((a, b) => natural(a.key, b.key));
  if (!c || !c.names.length) { batch.students = byFolder; return; }
  batch.students = byFolder;
  const m = rosterMatch(c.names), first = c.names.filter(n => m.has(n)).map(n => m.get(n)), used = new Set(first);
  batch.students = first.concat(byFolder.filter(st => !used.has(st)));
}
function setBatchName() { $('#batchName').textContent = batch.name + ' · ' + batch.students.length + (batch.students.length === 1 ? ' student' : ' students'); }
function batchClass() { const id = batch && (batch.classId != null ? batch.classId : batch.assignment && batch.assignment.classId); return id ? classById(id) : null; }
function renderClassSel() {
  const sel = $('#classSel'), c = batchClass();
  sel.hidden = !lib.classes.length;
  sel.innerHTML = '<option value="">No roster</option>' + lib.classes.map(k => '<option value="' + k.id + '"' + (c && c.id === k.id ? ' selected' : '') + '>' + esc(k.name) + '</option>').join('');
}
$('#classSel').onchange = e => {
  batch.classId = e.target.value;
  const a = batch.assignment, f = a && findItem(a.id);
  if (f && f.c.id !== batch.classId) {   // the assignment card moves to that class, into a unit of the same name
    const to = holderById(batch.classId);
    let u = to.units.find(x => x.name === f.u.name); if (!u) to.units.push(u = { id: uid(), name: f.u.name, items: [] });
    f.u.items.splice(f.u.items.indexOf(a), 1); u.items.push(a); a.classId = batch.classId; saveLib();
  } else if (a) { a.classId = batch.classId; saveLib(); }
  const st = batch.students[cur]; rosterSort(); cur = Math.max(0, batch.students.indexOf(st));
  setBatchName(); renderList(); renderTopAtlas(); openStudent(cur); saveSoon();
};

/* ---------------- late or forgotten files: added to a student's submission, kept in this browser ---------------- */
// The download itself never changes. Added files live in IndexedDB under this download's id, so they come back
// when the same download is opened again, and they export with the student's other files.
let addDbP = null;
const addDb = () => addDbP ||= new Promise((res, rej) => { const r = indexedDB.open('grading-studio-added', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
/* ---------------- keeping every download: papers and work in this browser's IndexedDB ---------------- */
// papers: the files as opened (so a download reopens in one click), work: a full copy of marks and scores,
// meta: a small summary per download for the list. All of it stays on this computer.
let keepDbP = null, keepOk = false;
const keepDb = () => keepDbP ||= new Promise((res, rej) => {
  const r = indexedDB.open('grading-studio-keep', 2);
  r.onupgradeneeded = () => { for (const n of ['papers', 'work', 'meta', 'edits']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function kdo(name, mode, fn) {
  const db = await keepDb();
  return new Promise((res, rej) => { const tx = db.transaction(name, mode), req = fn(tx.objectStore(name)); tx.oncomplete = () => res(req && req.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
}
const kget = (name, k) => kdo(name, 'readonly', o => o.get(k)).catch(() => null);
let keptMeta = new Map();
async function loadKept() {
  try { const all = await kdo('meta', 'readonly', o => o.getAll()); keepOk = true; keptMeta = new Map((all || []).map(m => [m.id, m])); } catch { keptMeta = new Map(); }
  if (!batch) renderLib();
  renderBackup();
}
let askedKeep = false;
function askToKeep() {   // asks the browser not to clear this site's storage when the disk gets full
  if (askedKeep || !navigator.storage || !navigator.storage.persist) return;
  askedKeep = true; navigator.storage.persist().catch(() => {});
}
async function keepPapers(b, label, list) {
  const m = { ...(keptMeta.get(b.id) || {}), id: b.id, name: b.name, n: b.students.length, t: Date.now(), asg: b.assignment ? b.assignment.id : (keptMeta.get(b.id) || {}).asg };
  try {
    if (list && !(keptMeta.get(b.id) || {}).papers) {
      await kdo('papers', 'readwrite', o => o.put({ id: b.id, label: label || '', entries: list }, b.id));
      m.papers = true; m.size = list.reduce((a, e) => a + (e.data ? e.data.length : 0), 0);
    }
    await kdo('meta', 'readwrite', o => o.put(m, b.id)); keepOk = true; keptMeta.set(b.id, m);
  } catch (e) {
    console.error(e);
    if (list) toast('This browser has no room to keep these papers. Your marks are still saved; drop the download in again to reopen it.');
  }
}
let keepT = null;
function keepWork(b, data) {
  const n = Object.values(data.s).filter(x => x.g && ((x.g.rubric || []).some(v => v != null) || x.g.points !== '' || x.g.sheet)).length;
  const m = { ...(keptMeta.get(b.id) || { id: b.id, name: b.name, n: b.students.length }), t: data.t, scored: n };
  keptMeta.set(b.id, m);
  kdo('work', 'readwrite', o => o.put(data, b.id)).then(() => kdo('meta', 'readwrite', o => o.put(m, b.id))).then(() => { keepOk = true; })
    .catch(e => { keepOk = false; console.error(e); });
}
async function reopenKept(id, assignment) {
  const rec = await kget('papers', id);
  if (!rec) { toast('The papers for this one aren’t kept in this browser. Drop the download in again.'); return; }
  const m = keptMeta.get(id), f = !assignment && m && m.asg ? findItem(m.asg) : null;
  await intake(rec.entries, rec.label, assignment || (f ? f.it : null), true);
}
async function forgetKept(id) {
  try {
    for (const n of ['papers', 'work', 'meta']) await kdo(n, 'readwrite', o => o.delete(id));
    await kdo('edits', 'readwrite', o => o.delete(IDBKeyRange.bound(id + '|', id + '|\uffff')));
    const recs = (await idbDo('readonly', o => o.getAll())) || [];
    await idbDo('readwrite', o => { for (const r of recs) if (r.bid === id) o.delete(r.bid + '|' + r.key + '|' + r.path); });
  } catch {}
  store.del(id); const idx = store.get('gs.batches', {}); delete idx[id]; store.set('gs.batches', idx);
  keptMeta.delete(id); renderLib();
}
const fmtSize = b => b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b > 1e6 ? Math.round(b / 1e6) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
function renderKept() {
  const el = $('#kept'); if (!el) return;
  const list = [...keptMeta.values()].sort((a, b) => b.t - a.t);
  el.closest('section').hidden = !list.length;
  el.innerHTML = list.map(m => '<div class="krow"><div class="kn"><b>' + esc(m.name) + '</b><span class="muted">' + m.n + (m.n === 1 ? ' student' : ' students') + ' · ' + (m.scored || 0) + ' scored · last worked on ' + fmtDay(m.t) + (m.size ? ' · ' + fmtSize(m.size) : '') + (m.papers ? '' : ' · papers not kept, drop the download again') + '</span></div>' +
    (m.papers ? '<button class="btn sm primary" data-kopen="' + esc(m.id) + '">Open</button>' : '') + '<button class="btn sm" data-kforget="' + esc(m.id) + '" title="Removes the papers, your marks and scores for this download from this browser">Forget</button></div>').join('');
}
async function idbDo(mode, fn) {
  const db = await addDb();
  return new Promise((res, rej) => { const tx = db.transaction('files', mode), req = fn(tx.objectStore('files')); tx.oncomplete = () => res(req && req.result); tx.onerror = () => rej(tx.error); });
}
const addKey = (st, path) => batch.id + '|' + st.key + '|' + path;
const fmtDay = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const addTag = f => '<span class="addtag" title="You added this file">Added by you · ' + fmtDay(f.added) + '</span><button class="link" style="font-size:13px" data-rmadd="' + esc(f.path) + '">Remove</button>';
async function loadAdded() {
  let recs = [];
  try { recs = (await idbDo('readonly', o => o.getAll())) || []; } catch { return; }
  for (const r of recs.filter(r => r.bid === batch.id).sort((a, b) => a.added - b.added)) {
    let st = batch.students.find(s => s.key === r.key);
    if (!st) { st = { key: r.key, files: [], grade: { rubric: [], points: '', comment: '' }, layout: null, inc: {} }; batch.students.push(st); }   // added from a later scan
    if (st.files.some(f => f.path === r.path)) continue;
    const f = await makeFile(r.path, r.data); f.added = r.added; f.akey = r.key; st.files.push(f);
  }
}
function pickAdd(st) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.multiple = true;   // any kind of file
  inp.onchange = () => addFiles(st, [...inp.files].map(f => ({ path: f.name, file: f })));
  inp.click();
}
async function addFiles(st, list, quiet) {
  list = list.filter(e => e.file && !junk(e.path));
  // A ZIP added to a student is opened and its files added. A ZIP with a folder per student goes through Bring in files.
  if (list.some(e => /\.zip$/i.test(e.file.name))) {
    const out = [];
    for (const e of list) {
      if (!/\.zip$/i.test(e.file.name)) { out.push(e); continue; }
      const got = await expandPicked([e.file]), tops = new Set(got.map(g => g.path.split('/')[1]).filter((x, i) => got[i].path.split('/').length > 2));
      if (!quiet && tops.size >= 2) return bringIn(got);
      out.push(...got.map(g => ({ path: g.path, file: g.file })));
    }
    list = out;
  }
  if (!list.length) return;
  commitEditors();
  let last = null;
  for (const e of list) {
    const bytes = new Uint8Array(await e.file.arrayBuffer());
    const name = e.file.name.replace(/[\\/]+/g, '-'), base = st.key + '/' + name;
    let path = base, k = 2;
    while (st.files.some(f => f.path === path)) path = base.replace(/(\.[^./]+)?$/, ' (added ' + k++ + ')$1');
    const f = await makeFile(path, bytes); f.added = Date.now(); f.akey = st.key;
    if (viewable(f)) {
      try { await workerReady; const d = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise; f.numPages = d.numPages; d.destroy(); } catch {}
      if (st.layout && f.numPages) st.layout.push({ name: f.name, file: f.path, pages: [...Array(f.numPages).keys()].map(p => [f.path, p]) });
      try { f.scan = await scanFile(f, f.hand || setup.spot || null); f.kami = f.scan.kami; } catch {}
    }
    st.files.push(f); last = f;
    try { await idbDo('readwrite', o => o.put({ bid: batch.id, key: st.key, path: f.path, name: f.name, data: bytes, added: f.added }, addKey(st, f.path))); }
    catch { toast('This browser couldn’t keep ' + f.name + ' for next time. It’s here until you close the download.'); }
  }
  refound(st); saveSoon(); renderList(); wordScoresAll();
  $('#trAllBtn').hidden = !CAN_TRANSCRIBE || !batch.students.some(x => x.files.some(f => f.kind === 'media'));
  if (quiet) return;
  const i = batch.students.indexOf(st);
  toast('Added ' + list.length + (list.length === 1 ? ' file' : ' files') + ' to ' + shownName(st, batch.students.indexOf(st)));
  openStudent(i, last && last.path);
}
async function removeAdded(st, path) {
  const f = fileByPath(st, path); if (!f || !f.added) return;
  st.files.splice(st.files.indexOf(f), 1);
  if (st.layout) { st.layout = st.layout.map(d => ({ ...d, pages: d.pages.filter(([q]) => q !== path) })).filter(d => d.pages.length); if (!st.layout.length) st.layout = null; }
  if (st.inc) delete st.inc[path];
  try { await idbDo('readwrite', o => o.delete(batch.id + '|' + (f.akey || st.key) + '|' + path)); } catch {}
  if (st.forder) st.forder = st.forder.filter(x => x !== 'f:' + path);
  refound(st); saveSoon(); renderList(); openStudent(cur);
  toast('Removed ' + f.name);
}
function refound(st) {
  const all = st.files.filter(f => f.kind !== 'docx' && fileIn(st, f)).flatMap(f => (f.scan && f.scan.found) || []).concat(st.files.flatMap(wordFound));
  st.found = all.length === 1 ? { ...all[0], found: true } : null; st.foundCount = all.length;
}

/* ---------------- display: app text size, text box size, paper fit, Word documents ---------------- */
function applyDisp() {
  const r = document.documentElement.style;
  r.setProperty('--uz', disp.ui); r.setProperty('--dfs', disp.dfs + 'px'); r.setProperty('--dlh', disp.dlh);
}
function dispChanged(k) {
  store.set('gs.disp', disp); applyDisp();
  if (k === 'zoom') store.set('gs.zoom', zoom);
  if (k === 'fit' || k === 'zoom' || k === 'ui') { clearTimeout(resizeT); resizeT = setTimeout(() => { if (batch) renderTools(); pages.forEach(renderPage); }, 120); }
}
function openDisplay() {
  const seg = (key, opts) => '<span class="seg">' + opts.map(([v, l]) => '<button data-k="' + key + '" data-v="' + v + '" aria-pressed="' + (String(disp[key]) === String(v)) + '">' + l + '</button>').join('') + '</span>';
  const range = (key, min, max, step, val, unit) => '<div class="rv"><input type="range" min="' + min + '" max="' + max + '" step="' + step + '" data-r="' + key + '" value="' + val + '" aria-label="' + key + '"><b>' + val + unit + '</b></div>';
  const render = () => {
    $('#dispBody').innerHTML =
      '<div class="dset"><div class="dl">App text size</div>' + seg('ui', [[0.9, 'Small'], [1, 'Normal'], [1.15, 'Large'], [1.3, 'Extra large']]) +
        '<div class="muted" style="font-size:12.5px;margin-top:6px">The student list, toolbar, grade panel and windows. Papers keep their own zoom.</div></div>' +
      '<div class="dset"><div class="dl">New text boxes on the paper</div>' + range('tsize', 8, 32, 1, disp.tsize, ' pt') +
        '<div id="tsPrev" style="margin-top:6px;font:' + disp.tsize + 'px Helvetica,Arial,sans-serif;color:' + COLORS[inkColor] + '">Aa Bb 123</div></div>' +
      '<div class="dset"><div class="dl">Paper</div>' + seg('fit', [['width', 'Fit width'], ['page', 'Fit whole page']]) +
        '<div style="margin-top:8px">' + range('zoom', 50, 250, 5, Math.round(zoom * 100), '%') + '</div></div>' +
      '<div class="dset"><div class="dl">Word documents</div>' + range('dfs', 12, 24, 1, disp.dfs, ' px') +
        '<div style="margin-top:8px;display:flex;align-items:center;gap:8px"><span class="muted" style="font-size:13px">Line spacing</span>' + seg('dlh', [[1.3, 'Tight'], [1.45, 'Normal'], [1.8, 'Roomy']]) + '</div></div>';
  };
  openDlg('<div class="bh"><h2>Display</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb" id="dispBody"></div>' +
    '<div class="bf"><button class="btn" data-reset>Back to normal</button><button class="btn primary" data-close>Done</button></div>', true);
  render();
  const box = $('#dlgBox');
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-reset]')) { disp = { ...DISP0, trim: disp.trim }; zoom = 1; dispChanged('zoom'); dispChanged('ui'); return render(); }
    const b = e.target.closest('[data-k]');
    if (b) { const v = b.dataset.v; disp[b.dataset.k] = isNaN(+v) ? v : +v; dispChanged(b.dataset.k); render(); }
  };
  box.oninput = e => {
    const k = e.target.dataset.r; if (!k) return;
    const v = +e.target.value;
    if (k === 'zoom') zoom = v / 100; else disp[k] = v;
    e.target.nextElementSibling.textContent = v + (k === 'zoom' ? '%' : k === 'tsize' ? ' pt' : ' px');
    if (k === 'tsize') $('#tsPrev').style.fontSize = v + 'px';
    dispChanged(k);
  };
}

/* ---------------- anonymous grading: papers as Paper 1, 2, 3… in a random order, names covered; scores still go to the right student ---------------- */
const anonOn = () => !!(batch && batch.anon && batch.anon.on);
// The shuffled order, as student indexes. Students added later go in at random places.
function anonOrder() {
  const A = batch.anon || (batch.anon = { on: false, order: [] }), keys = batch.students.map(st => st.key), have = new Set(keys);
  A.order = A.order.filter(k => have.has(k));
  for (const k of keys) if (!A.order.includes(k)) A.order.splice(Math.floor(Math.random() * (A.order.length + 1)), 0, k);
  const at = new Map(keys.map((k, i) => [k, i]));
  return A.order.map(k => at.get(k));
}
function anonShuffle() {
  const k = batch.students.map(st => st.key);
  for (let i = k.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [k[i], k[j]] = [k[j], k[i]]; }
  batch.anon = { ...(batch.anon || {}), order: k };
}
const anonPos = i => anonOrder().indexOf(i);
const shownName = (st, i) => anonOn() ? 'Paper ' + (anonPos(i) + 1) : st.key;
// Next or previous student in the order on screen.
function stepStudent(d) {
  if (!anonOn()) { const n = cur + d; if (n >= 0 && n < batch.students.length) openStudent(n); return; }
  const o = anonOrder(), p = o.indexOf(cur) + d;
  if (p >= 0 && p < o.length) openStudent(o[p]);
}
const anonRx = st => wordRx(coverWords(st));
// Black boxes (page points) over typed names, Kami boxes with names, and the boxes she drew in Check the covers.
async function anonCovers(st, pg) {
  try { return (await autoCovers(pg.page, vpRot(pg.file, pg.idx, pg.page, 1), anonRx(st))).concat(ownCovers(pg.file.path, pg.idx, pg.W, pg.H)); }
  catch { return ownCovers(pg.file.path, pg.idx, pg.W, pg.H); }
}
// File names, Word and text files: names in headings are swapped for [name], and any line of a document that has a
// name is blacked out on screen (the file itself isn't changed).
function anonScrub() {
  if (!anonOn()) return;
  const st = batch.students[cur], rx = anonRx(st); if (!rx) return;
  for (const el of document.querySelectorAll('#paper .fhead > span:first-child, #paper .refd > summary')) {
    rx.lastIndex = 0; if (rx.test(el.textContent)) el.textContent = scrub(el.textContent, rx);
  }
  for (const el of document.querySelectorAll('#paper .dpage p, #paper .dpage td, #paper .dpage li, #paper .dpage')) {
    if (el.classList.contains('anonhide') || (el.classList.contains('dpage') && el.querySelector('p,td,li'))) continue;
    rx.lastIndex = 0; if (rx.test(el.textContent)) el.classList.add('anonhide');
  }
}
let anonT = 0;
new MutationObserver(() => { if (anonOn()) { clearTimeout(anonT); anonT = setTimeout(anonScrub, 30); } }).observe($('#paper'), { childList: true, subtree: true });
function setAnon(on) {
  if (on && !(batch.anon && batch.anon.order && batch.anon.order.length)) anonShuffle();
  batch.anon.on = on; saveNow();
  openStudent(on ? anonOrder()[0] : cur);
  toast(on ? 'Anonymous: papers in a random order, names covered' : 'Names are back');
}
function openAnon() {
  if (anonOn()) return setAnon(false);
  const seen = batch.anon && batch.anon.order && batch.anon.order.length;
  openDlg('<div class="bh"><h2>Anonymous grading</h2><button class="icon" data-cancel aria-label="Close">✕</button></div><div class="bb">' +
    '<p style="margin-top:0">Papers show up as <b>Paper 1, Paper 2…</b> in a random order, with names covered. Every mark and score still goes to the right student, and you can switch back any time.</p>' +
    '<ol style="margin:0 0 12px;padding-left:20px;line-height:1.6">' +
    '<li><b>Get everything in order first:</b> late files, split scans, your rubric.</li>' +
    '<li><b>Cover the names.</b> Typed names (from the folder names' + (batchClass() ? ' and your roster' : '') + ') are covered on their own. For handwritten names, check the covers: drag a box over the name once, then use it on every paper.</li>' +
    '<li><b>Start.</b> ' + (seen ? 'It keeps the same random order as last time, or you can shuffle a new one.' : 'The order is shuffled once and kept, so you can stop and come back.') + '</li></ol>' +
    '<p class="muted" style="font-size:13px;margin:0">The Grades list, Grade sheet and export still use names, since that’s where you copy grades out.</p></div>' +
    '<div class="bf"><button class="btn" data-check style="margin-right:auto">Check the covers…</button>' + (seen ? '<button class="btn" data-shuf>Shuffle a new order and start</button>' : '') + '<button class="btn primary" data-go>Start anonymous grading</button></div>', true);
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target.closest('[data-check]')) return checkCovers(0, openAnon);
    if (e.target.closest('[data-shuf]')) { anonShuffle(); closeDlg(); return setAnon(true); }
    if (e.target.closest('[data-go]')) { closeDlg(); return setAnon(true); }
  };
}
function renderAnonHead() {
  const on = anonOn();
  $('#sideHd').innerHTML = '<span>' + (on ? 'Papers, shuffled' : 'Students') + (on ? '' : batchClass() && batchClass().names.length ? ' <i style="font-style:normal;font-weight:500;text-transform:none;letter-spacing:0">· roster order</i>' : ' <i style="font-style:normal;font-weight:500;text-transform:none;letter-spacing:0">· folder order</i>') + '</span>' +
    '<button class="anonsw" id="anonSw" role="switch" aria-checked="' + on + '" title="Grade without names, in a random order"><i></i>Anonymous</button>' +
    (on ? '<button class="btn sm" id="anonShuf" title="Put the papers in a new random order">⤮ Shuffle</button>' : '');
}
$('#sideHd').addEventListener('click', e => {
  if (e.target.closest('#anonSw')) openAnon();
  if (e.target.closest('#anonShuf')) { anonShuffle(); saveNow(); openStudent(anonOrder()[0]); toast('Shuffled: a new random order'); }
});

/* ---------------- calculator: a small floating calculator with grade helpers; it opens from the top bar or the = key ---------------- */
// Reads + − × ÷ ^ ( ) and %, plus sum(), avg(), min(), max(), round(), sqrt(). No eval: a small parser.
function calcEval(src) {
  const s = String(src).replace(/[×xX*]/g, '*').replace(/[÷:]/g, '/').replace(/[−–]/g, '-').replace(/,(?=\d{3}\b)/g, '').replace(/\s+/g, '');
  let i = 0;
  const peek = () => s[i], eat = c => { if (s[i] === c) { i++; return true; } return false; };
  const FN = { sum: a => a.reduce((x, y) => x + y, 0), avg: a => a.reduce((x, y) => x + y, 0) / a.length, min: a => Math.min(...a), max: a => Math.max(...a), round: a => a.length > 1 ? Math.round(a[0] * 10 ** a[1]) / 10 ** a[1] : Math.round(a[0]), sqrt: a => Math.sqrt(a[0]) };
  function atom() {
    if (eat('(')) { const v = add(); if (!eat(')')) throw 0; return v; }
    if (eat('-')) return -power();
    if (eat('+')) return power();
    const m = /^[a-z]+/i.exec(s.slice(i));
    if (m) {
      const f = FN[m[0].toLowerCase()]; if (!f) throw 0; i += m[0].length;
      if (!eat('(')) throw 0; const args = [add()]; while (eat(',') || eat(';')) args.push(add()); if (!eat(')')) throw 0;
      return f(args);
    }
    const n = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i)); if (!n) throw 0; i += n[0].length;
    return +n[0];
  }
  function post() { let v = atom(); while (eat('%')) v /= 100; return v; }
  function power() { const v = post(); return eat('^') ? v ** power() : v; }
  function mul() { let v = power(); for (;;) { if (eat('*')) v *= power(); else if (eat('/')) v /= power(); else if (peek() === '(') v *= power(); else return v; } }
  function add() { let v = mul(); for (;;) { if (eat('+')) v += mul(); else if (eat('-')) v -= mul(); else return v; } }
  if (!s) return null;
  const v = add(); if (i < s.length || !isFinite(v)) throw 0;
  return v;
}
const calcFmt = v => v == null ? '' : String(+(+v).toFixed(4));
function openCalc() {
  const old = $('#calcPanel'); if (old) { old.remove(); return; }
  const p = document.createElement('div'); p.id = 'calcPanel'; document.body.appendChild(p);
  const pos = store.get('gs.calcpos', null); if (pos) { p.style.left = pos.x + 'px'; p.style.top = pos.y + 'px'; p.style.right = 'auto'; }
  let hist = store.get('gs.calchist', []), last = null;
  const max = maxPoints();
  const keys = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '⌫', '='];
  p.innerHTML = '<div class="cph"><b>Calculator</b><span style="flex:1"></span><button class="icon" data-cx aria-label="Close">✕</button></div>' +
    '<input id="calcIn" autocomplete="off" spellcheck="false" placeholder="Type or tap, e.g. 3.5+4+3" aria-label="Calculation">' +
    '<div id="calcOut" aria-live="polite"></div>' +
    '<div class="cpk">' + keys.map(k => '<button data-ck="' + k + '"' + (k === '=' ? ' class="eq"' : /[÷×−+]/.test(k) ? ' class="op"' : '') + '>' + k + '</button>').join('') + '</div>' +
    '<div class="cpsec"><div class="dl">Score to percent</div>' +
      '<div class="cprow"><input id="calcPts" type="number" step="0.5" min="0" placeholder="Score"><span>out of</span><input id="calcMax" type="number" step="0.5" min="0" value="' + (max || '') + '"></div>' +
      '<div id="calcPct" class="muted"></div></div>' +
    '<div class="cpsec"><div class="dl">Average</div><input id="calcAvg" placeholder="Numbers with spaces, e.g. 4 3.5 3" autocomplete="off"><div id="calcAvgOut" class="muted"></div></div>' +
    '<div class="cpsec"><div class="dl">History</div><div id="calcHist"></div></div>';
  const inp = $('#calcIn'), out = $('#calcOut');
  const show = () => {
    let v = null, bad = false; try { v = calcEval(inp.value); } catch { bad = !!inp.value.trim(); }
    last = v;
    out.innerHTML = bad ? '<span class="muted">…</span>' : v == null ? '<span class="muted">0</span>' : '= <b>' + calcFmt(v) + '</b>' +
      ($('#ptsIn') ? ' <button class="link" data-cuse title="Put this number in the open student’s score box">Use as score</button>' : '');
  };
  const drawHist = () => { $('#calcHist').innerHTML = hist.length ? hist.map((h, k) => '<button class="cphi" data-ch="' + k + '"><span>' + esc(h.e) + '</span><b>' + esc(h.v) + '</b></button>').join('') + '<button class="link" data-chclear style="font-size:12px">Clear history</button>' : '<span class="muted" style="font-size:12px">Your answers show here. Click one to use it again.</span>'; };
  const done = () => {
    if (last == null) return;
    const e = inp.value.trim(), v = calcFmt(last);
    if (e !== v) { hist.unshift({ e, v }); hist = hist.slice(0, 12); store.set('gs.calchist', hist); drawHist(); }
    inp.value = v; show(); inp.select();
  };
  const pct = () => {
    const t = $('#calcPts').value, m = +$('#calcMax').value;
    if (t === '' || !m) { $('#calcPct').textContent = 'Type a score to see its percent.'; return; }
    const straight = +t / m * 100, onScale = m === max ? percentFor(+t) : null;
    $('#calcPct').innerHTML = onScale != null ? '<b>' + onScale + '%</b> on your grading scale · ' + calcFmt(straight) + '% straight' : '<b>' + roundPct(straight) + '%</b> (' + calcFmt(straight) + '%)';
  };
  const avg = () => {
    const ns = ($('#calcAvg').value.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    $('#calcAvgOut').innerHTML = ns.length ? 'Average <b>' + calcFmt(ns.reduce((a, b) => a + b, 0) / ns.length) + '</b> · Total ' + calcFmt(ns.reduce((a, b) => a + b, 0)) + ' · ' + ns.length + (ns.length === 1 ? ' number' : ' numbers') : '';
  };
  inp.oninput = show;
  inp.onkeydown = e => {
    if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); done(); }
    else if (e.key === 'Escape') { e.preventDefault(); p.remove(); }
  };
  p.oninput = e => { if (e.target.id === 'calcPts' || e.target.id === 'calcMax') pct(); if (e.target.id === 'calcAvg') avg(); };
  p.onclick = e => {
    if (e.target.closest('[data-cx]')) return p.remove();
    const k = e.target.closest('[data-ck]');
    if (k) {
      const c = k.dataset.ck;
      if (c === 'C') inp.value = '';
      else if (c === '⌫') inp.value = inp.value.slice(0, -1);
      else if (c === '=') return done();
      else inp.value += c;
      show(); inp.focus(); return;
    }
    if (e.target.closest('[data-cuse]')) {
      const box = $('#ptsIn'); if (!box || last == null) return;
      box.value = calcFmt(last); box.dispatchEvent(new Event('input', { bubbles: true })); box.dispatchEvent(new Event('change', { bubbles: true }));
      return toast('Score set to ' + calcFmt(last));
    }
    const h = e.target.closest('[data-ch]'); if (h) { inp.value = hist[+h.dataset.ch].v; show(); inp.focus(); return; }
    if (e.target.closest('[data-chclear]')) { hist = []; store.set('gs.calchist', hist); drawHist(); }
  };
  // Drag the title bar to move it out of the way; it stays there next time.
  p.querySelector('.cph').onpointerdown = e => {
    if (e.target.closest('button')) return;
    const r = p.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    const mv = ev => { p.style.left = Math.max(0, Math.min(innerWidth - 60, ev.clientX - dx)) + 'px'; p.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)) + 'px'; p.style.right = 'auto'; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); store.set('gs.calcpos', { x: parseInt(p.style.left), y: parseInt(p.style.top) }); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  };
  show(); pct(); drawHist(); inp.focus();
}

/* ---------------- lighting: brightness, contrast and darker writing for washed-out scans (view only; the student's file is not changed) ---------------- */
const LIGHT0 = { b: 0, c: 0, d: 0, s: 0 };
const lightKey = st => (batch.light && st && batch.light[st.key]) ? st.key : '*';
const lightFor = st => (batch && batch.light && ((st && batch.light[st.key]) || batch.light['*'])) || LIGHT0;
const lightOn = L => !!(L.b || L.c || L.d || L.s);
// One lookup table per setting: contrast pulls ink away from white paper (white stays white), brightness lifts
// or dims everything, then a curve darkens faint pencil.
function lightLut(L) {
  const t = new Uint8ClampedArray(256), k = 1 + L.c / 100, g = 1 + L.d / 40;
  for (let v = 0; v < 256; v++) { let x = 1 - (1 - v / 255) * k + L.b / 200; x = Math.min(1, Math.max(0, x)); t[v] = Math.round(Math.pow(x, g) * 255); }
  return t;
}
// Lighting switches for the whole download: on/off, her setup rubric left alone unless she says so, used in the export.
const lightOpts = () => ({ on: true, rub: false, exp: true, ...((batch && batch.lightOpt) || {}) });
// Her rubric from Rubric setup.
const isRubricPage = f => !!(f.rubric || f.virtual);
// Pages she switched by hand, by student, file and page, so a choice moves with the page when pages are rearranged.
const lightPgKey = (st, f, p) => st.key + '|' + f.path + '|' + p;
const pageLitDefault = f => lightOpts().rub || !isRubricPage(f);
function pageLit(st, f, p, map) {
  const v = (map || (batch && batch.lightPg) || {})[lightPgKey(st, f, p)];
  return v != null ? v : pageLitDefault(f);
}
function setPageLit(st, f, p, on, map) {
  if (!map) map = batch.lightPg || (batch.lightPg = {});
  const k = lightPgKey(st, f, p);
  if (on === pageLitDefault(f)) delete map[k]; else map[k] = on;
}
const lightLive = st => { const o = lightOpts(); return !!st && o.on && lightOn(lightFor(st)); };
// The setting for one page, or null when lighting doesn't touch it.
function lightForPage(st, f, p) {
  if (!lightLive(st) || f.kind === 'docx') return null;
  return pageLit(st, f, p) ? lightFor(st) : null;
}
function lightCanvas(ctx, w, h, L) {
  const im = ctx.getImageData(0, 0, w, h), d = im.data, t = lightLut(L);
  // Change each pixel's lightness and keep its color, so a slightly yellow scan doesn't turn bright yellow.
  for (let i = 0; i < d.length; i += 4) { const y = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8, sh = t[y] - y; d[i] += sh; d[i + 1] += sh; d[i + 2] += sh; }
  if (L.s) lightSharpen(d, w, h, L.s);
  ctx.putImageData(im, 0, 0);
}
// Sharpen: each pixel's lightness pushed away from its neighbours' average (an unsharp mask), so soft edges of writing get crisp.
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
function lightBmp(pg) {
  const L = lightForPage(batch && batch.students[cur], pg.file, pg.idx);
  if (!L) return pg.bmp;
  const key = L.b + '|' + L.c + '|' + L.d + '|' + (L.s || 0);
  if (pg.adj && pg.adjSrc === pg.bmp && pg.adjKey === key) return pg.adj;
  const c = pg.adj && pg.adj.width === pg.bmp.width && pg.adj.height === pg.bmp.height ? pg.adj : document.createElement('canvas');
  c.width = pg.bmp.width; c.height = pg.bmp.height;
  const x = c.getContext('2d'); x.drawImage(pg.bmp, 0, 0);
  lightCanvas(x, c.width, c.height, L);
  pg.adj = c; pg.adjSrc = pg.bmp; pg.adjKey = key;
  return c;
}
// Auto: stretch the page so its faintest writing goes near black and the paper goes white.
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
let lightRaf = 0;
function lightApply() { cancelAnimationFrame(lightRaf); lightRaf = requestAnimationFrame(() => { redrawAll(); lightChips(); saveSoon(); }); }
function lightPagesChanged() { lightApply(); const lp = $('#lightPanel'); if (lp) lp.refresh(); }
// A ☀ tag in the corner of each page while lighting is on: click it to switch lighting off or on for that page.
function lightChip(pg) {
  const b = document.createElement('div'); b.className = 'lchip';
  b.innerHTML = '<button data-lpg title="Turn lighting off or on for this page. Shift-click another page’s ☀ to do every page in between.">☀ <span></span></button><button data-lmenu title="More: the rest of the file, the whole file, or the same page on every paper" aria-label="More lighting choices">▾</button>';
  pg.wrap.appendChild(b); pg.chip = b;
}
// Turn buttons in the top corner of each page (they show when the mouse is over the page).
function rotChip(pg, n) {
  const b = document.createElement('div'); b.className = 'rchip';
  b.innerHTML = (n ? '<span>p. ' + n + '</span>' : '') + '<button data-rot="-1" title="Turn this page to the left" aria-label="Turn this page to the left">⟲</button><button data-rot="1" title="Turn this page to the right" aria-label="Turn this page to the right">⟳</button>';
  pg.wrap.appendChild(b); pg.rchip = b;
}
function lightChips() {
  const st = batch && batch.students[cur], live = lightLive(st);
  for (const pg of pages) {
    if (!pg.chip) continue;
    const ok = live && pg.file.kind !== 'docx', on = ok && pageLit(st, pg.file, pg.idx);
    pg.chip.hidden = !ok; pg.chip.classList.toggle('off', !on);
    pg.chip.querySelector('span').textContent = on ? 'Lighting on' : 'Lighting off';
  }
}
let lightLast = null;   // the last page she switched, for Shift-click runs
function lightChipClick(e, pg) {
  if (!pg) return;
  if (e.target.closest('[data-lmenu]')) return lightMenu(pg);
  const st = batch.students[cur], want = !pageLit(st, pg.file, pg.idx);
  let run = [pg];
  if (e.shiftKey && lightLast && lightLast !== pg && pages.includes(lightLast)) { const a = pages.indexOf(lightLast), b = pages.indexOf(pg); run = pages.slice(Math.min(a, b), Math.max(a, b) + 1); }
  for (const q of run) setPageLit(st, q.file, q.idx, want);
  lightLast = pg;
  lightPagesChanged();
  if (run.length > 1) toast('Lighting ' + (want ? 'on' : 'off') + ' for ' + run.length + ' pages');
}
function lightMenu(pg) {
  const old = $('#lmenu'); if (old) { old.remove(); if (old._pg === pg) return; }
  const st = batch.students[cur], want = !pageLit(st, pg.file, pg.idx);
  const L = layoutOf(st), di = L.findIndex(d => d.pages.some(([q, p]) => q === pg.file.path && p === pg.idx)), d = L[di];
  const pos = d ? d.pages.findIndex(([q, p]) => q === pg.file.path && p === pg.idx) : -1, back = d ? d.pages.length - 1 - pos : -1;
  const nth = k => k === 0 ? 'last page' : k === 1 ? '2nd-to-last page' : k === 2 ? '3rd-to-last page' : (k + 1) + 'th-to-last page';
  const m = document.createElement('div'); m.id = 'lmenu'; m._pg = pg; m._at = { di, pos, back, want };
  m.innerHTML = '<div class="dl">Turn lighting ' + (want ? 'on' : 'off') + ' for</div><button data-lm="page">Just this page</button>' +
    (d ? '<button data-lm="rest">This page and the rest of this file</button><button data-lm="file">Every page of this file</button>' +
      '<div class="dl">Every paper</div><button data-lm="from">Page ' + (pos + 1) + ' on every paper</button>' + (back !== pos ? '<button data-lm="back">The ' + nth(back) + ' on every paper</button>' : '') : '');
  pg.wrap.appendChild(m);
}
// Every student's page count, so "every paper" reaches students not opened yet.
async function ensureCounts() {
  await workerReady;
  for (const s of batch.students) for (const f of s.files) {
    if (!viewable(f) || f.numPages || f.bad) continue;
    try { const d = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise; f.numPages = d.numPages; d.destroy(); } catch { f.bad = 'it couldn’t be opened'; }
  }
}
async function lightMenuDo(how) {
  const m = $('#lmenu'); if (!m) return;
  const pg = m._pg, { di, pos, back, want } = m._at, st = batch.students[cur]; m.remove();
  const L = layoutOf(st), d = L[di];
  const setList = (s, list) => { let n = 0; for (const [path, p] of list) { const f = fileByPath(s, path); if (f) { setPageLit(s, f, p, want); n++; } } return n; };
  if (how === 'page' || !d) setPageLit(st, pg.file, pg.idx, want);
  else if (how === 'rest') setList(st, d.pages.slice(pos));
  else if (how === 'file') setList(st, d.pages);
  else {
    await ensureCounts();
    let n = 0;
    for (const s of batch.students) {
      const ds = layoutOf(s)[di]; if (!ds) continue;
      const it = how === 'from' ? ds.pages[pos] : ds.pages[ds.pages.length - 1 - back];
      if (it) n += setList(s, [it]);
    }
    toast('Lighting ' + (want ? 'on' : 'off') + ' for ' + (how === 'from' ? 'page ' + (pos + 1) : 'that page') + ' on ' + n + (n === 1 ? ' paper' : ' papers'));
  }
  lightLast = pg;
  lightPagesChanged();
}

function openLight() {
  const old = $('#lightPanel'); if (old) { old.remove(); return; }
  const p = document.createElement('div'); p.id = 'lightPanel'; document.body.appendChild(p);
  let only = lightKey(batch.students[cur]) !== '*';
  const set = L => { batch.light = batch.light || {}; if (only) batch.light[batch.students[cur].key] = L; else { batch.light['*'] = L; } lightApply(); };
  const opt = (k, v) => { batch.lightOpt = { ...lightOpts(), [k]: v }; lightApply(); render(); };
  const render = () => {
    const L = lightFor(batch.students[cur]), o = lightOpts();
    const offs = Object.entries(batch.lightPg || {}).filter(([, v]) => v === false).map(([k]) => k);
    const offAll = offs.length, offHere = offs.filter(k => k.startsWith(batch.students[cur].key + '|')).length;
    const row = (k, label, min, max) => '<label><span>' + label + '</span><input type="range" min="' + min + '" max="' + max + '" step="1" data-l="' + k + '" value="' + (L[k] || 0) + '"><b>' + (L[k] || 0) + '</b></label>';
    p.innerHTML = '<div class="lph"><b>Lighting</b><span style="flex:1"></span><button class="anonsw" data-lon role="switch" aria-checked="' + o.on + '"><i></i>' + (o.on ? 'On' : 'Off') + '</button><button class="icon" data-lx aria-label="Close" style="margin-left:8px">✕</button></div>' +
      '<div class="lpbody' + (o.on ? '' : ' off') + '">' +
      '<button class="btn sm primary" data-lauto style="width:100%">Auto fix this scan</button>' +
      row('b', 'Brightness', -60, 60) + row('c', 'Contrast', 0, 400) + row('d', 'Darken writing', 0, 100) + row('s', 'Sharpen', 0, 100) +
      '<span class="seg" style="width:100%"><button data-lo="0" aria-pressed="' + !only + '" style="flex:1">All students</button><button data-lo="1" aria-pressed="' + only + '" style="flex:1">Only ' + esc(shownName(batch.students[cur], cur)) + '</button></span>' +
      '<div><button class="link" data-lreset>Back to normal</button></div>' +
      '<div class="lpsec"><div class="dl">Pages</div>' +
        '<div class="muted" style="font-size:12px">Click ☀ in a page’s corner to turn lighting off just there. Shift-click another page’s ☀ to do every page in between. ▾ does the rest of a file, a whole file, or the same page on every paper.</div>' +
        '<div style="font-size:13px">Your rubric from Rubric setup</div><span class="seg" style="width:100%"><button data-lrub="0" aria-pressed="' + !o.rub + '" style="flex:1">Leave alone</button><button data-lrub="1" aria-pressed="' + o.rub + '" style="flex:1">Fix it too</button></span>' +
        (offAll ? '<div style="font-size:13px">Turned off by you: ' + offHere + ' on this paper, ' + offAll + ' in all. <button class="link" data-lpgreset>Turn them all back on</button></div>' : '') + '</div>' +
      '<label class="lprow lpchk"><input type="checkbox" data-lexp' + (o.exp ? ' checked' : '') + '> Use in the export too</label>' +
      '<div class="muted" style="font-size:12px;margin-top:-4px">' + (o.exp ? 'Exported files come out with this lighting. The student’s original file isn’t changed.' : 'Only changes how you see the paper here; the export stays as scanned.') + '</div></div>';
  };
  render();
  p.onchange = e => { if (e.target.dataset.lexp != null) opt('exp', e.target.checked); };
  p.oninput = e => { const k = e.target.dataset.l; if (!k) return; const L = { ...lightFor(batch.students[cur]), [k]: +e.target.value }; e.target.nextElementSibling.textContent = e.target.value; set(L); };
  p.onclick = e => {
    if (e.target.closest('[data-lx]')) return p.remove();
    if (e.target.closest('[data-lon]')) return opt('on', !lightOpts().on);
    const rb = e.target.closest('[data-lrub]'); if (rb) return opt('rub', rb.dataset.lrub === '1');
    if (e.target.closest('[data-lpgreset]')) { for (const [k, v] of Object.entries(batch.lightPg || {})) if (v === false) delete batch.lightPg[k]; lightApply(); return render(); }
    if (e.target.closest('[data-lauto]')) { const pg = pages.find(q => q.bmp && q.file.kind !== 'docx'); if (!pg) return toast('No scanned page to fix here'); set({ ...lightAuto(pg), s: lightFor(batch.students[cur]).s || 0 }); return render(); }
    if (e.target.closest('[data-lreset]')) { set({ ...LIGHT0 }); if (only) { delete batch.light[batch.students[cur].key]; only = false; lightApply(); } return render(); }
    const o = e.target.closest('[data-lo]');
    if (o) { const want = o.dataset.lo === '1', stc = batch.students[cur]; if (want && !only) { batch.light = batch.light || {}; batch.light[stc.key] = { ...lightFor(stc) }; } if (!want && only) { delete batch.light[stc.key]; lightApply(); } only = want; return render(); }
  };
  p.refresh = () => { only = lightKey(batch.students[cur]) !== '*'; render(); };
}

/* ---------------- Word files (.docx, .docm with macros, .dotx): shown as pages, and edited in place ---------------- */
// Edits go straight into the file's own document.xml; every other part of the file (styles, pictures, the macro
// project in a .docm) is kept byte for byte, so the file still opens in Word with its formatting and macros.
// Macros can't run in a browser.
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const W14_NS = 'http://schemas.microsoft.com/office/word/2010/wordml';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const WORD_RX = /\.(docx|docm|dotx|dotm)$/i;
const wkids = (el, name) => el ? [...el.children].filter(c => c.localName === name) : [];
const wkid = (el, name) => wkids(el, name)[0] || null;
const wval = el => el ? (el.getAttributeNS(W_NS, 'val') ?? el.getAttribute('w:val')) : null;
const won = el => !!el && !/^(0|false|off|none)$/i.test(wval(el) || '');
const HLC = { yellow: '#FFFF00', green: '#00FF00', cyan: '#00FFFF', magenta: '#FF00FF', blue: '#0000FF', red: '#FF0000', darkBlue: '#00008B', darkCyan: '#008B8B', darkGreen: '#006400', darkMagenta: '#800080', darkRed: '#8B0000', darkYellow: '#808000', darkGray: '#A9A9A9', lightGray: '#D3D3D3', black: '#000000', white: '#FFFFFF' };
function openWord(bytes) {
  const files = fflate.unzipSync(bytes);
  const xml = files['word/document.xml']; if (!xml) throw new Error('no document.xml');
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(xml), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('bad xml');
  const rels = {}, rx = files['word/_rels/document.xml.rels'];
  if (rx) for (const r of new DOMParser().parseFromString(new TextDecoder().decode(rx), 'application/xml').getElementsByTagName('Relationship')) rels[r.getAttribute('Id')] = r.getAttribute('Target');
  return { files, doc, rels, paras: [], runs: [], cells: [], boxes: [], urls: [], macros: !!files['word/vbaProject.bin'] };
}
function wordBytes(w) {
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + new XMLSerializer().serializeToString(w.doc.documentElement);
  return fflate.zipSync({ ...w.files, 'word/document.xml': new TextEncoder().encode(xml) });
}
function renderWord(w, host) {
  for (const u of w.urls) URL.revokeObjectURL(u);
  w.paras = []; w.runs = []; w.cells = []; w.boxes = []; w.urls = [];
  host.innerHTML = '';
  const body = wkid(w.doc.documentElement, 'body');
  wBlocks(w, body, host);
}
function wBlocks(w, node, out) {
  for (const c of node ? node.children : []) {
    if (c.localName === 'p') out.appendChild(wPara(w, c));
    else if (c.localName === 'tbl') out.appendChild(wTable(w, c));
    else if (c.localName === 'sdt') wBlocks(w, wkid(c, 'sdtContent'), out);
    else if (c.localName === 'customXml' || c.localName === 'ins') wBlocks(w, c, out);
  }
}
function wPara(w, p) {
  const el = document.createElement('p'); el.className = 'wp';
  el.dataset.pi = w.paras.push(p) - 1;
  const pPr = wkid(p, 'pPr');
  const jc = wval(wkid(pPr, 'jc')); if (jc) el.style.textAlign = jc === 'both' ? 'justify' : jc === 'end' ? 'right' : jc === 'start' ? 'left' : jc;
  const st = wval(wkid(pPr, 'pStyle')) || '', hm = /heading\s*(\d)|^title$/i.exec(st);
  if (hm) { el.style.fontWeight = '700'; el.style.fontSize = (hm[1] ? Math.max(1.05, 1.6 - hm[1] * 0.15) : 1.9) + 'em'; }
  const ind = wkid(pPr, 'ind'); if (ind) { const l = +(ind.getAttributeNS(W_NS, 'left') || ind.getAttributeNS(W_NS, 'start') || 0); if (l) el.style.paddingLeft = Math.round(l / 15) + 'px'; }
  const shd = wkid(pPr, 'shd'), fill = shd && shd.getAttributeNS(W_NS, 'fill'); if (fill && /^[0-9a-f]{6}$/i.test(fill)) el.style.background = '#' + fill;
  if (wkid(pPr, 'numPr')) { const b = document.createElement('span'); b.className = 'wbul'; b.contentEditable = 'false'; b.textContent = '•\t'; el.appendChild(b); }
  wInline(w, p, el);
  return el;
}
function wInline(w, node, el) {
  for (const c of node.children) {
    const n = c.localName;
    if (n === 'r') wRun(w, c, el);
    else if (n === 'sdt') {
      const pr = wkid(c, 'sdtPr'), cb = pr && [...pr.children].find(x => x.localName === 'checkbox' && x.namespaceURI === W14_NS);
      if (cb) el.appendChild(wCheck(w, { kind: 'sdt', sdt: c, cb }));
      else wInline(w, wkid(c, 'sdtContent') || c, el);
    } else if (['hyperlink', 'ins', 'smartTag', 'fldSimple', 'customXml', 'sdtContent'].includes(n)) wInline(w, c, el);
  }
}
function wRun(w, r, el) {
  const rPr = wkid(r, 'rPr');
  // an old-style form checkbox: its field starts in this run
  const fc = wkid(r, 'fldChar'), cbx = fc && wkid(wkid(fc, 'ffData'), 'checkBox');
  if (cbx) { el.appendChild(wCheck(w, { kind: 'ff', cbx })); return; }
  for (const d of [...wkids(r, 'drawing'), ...wkids(r, 'pict')]) {
    const blip = d.getElementsByTagNameNS('*', 'blip')[0] || d.getElementsByTagNameNS('*', 'imagedata')[0];
    const id = blip && (blip.getAttributeNS(R_NS, 'embed') || blip.getAttributeNS(R_NS, 'id'));
    const tgt = id && w.rels[id], data = tgt && w.files['word/' + tgt.replace(/^\/?word\//, '').replace(/^\.\//, '')];
    if (data) {
      const ext = /\.(\w+)$/.exec(tgt), u = URL.createObjectURL(new Blob([data], { type: 'image/' + (ext ? ext[1].toLowerCase().replace('jpg', 'jpeg') : 'png') }));
      w.urls.push(u);
      const img = document.createElement('img'); img.src = u; img.alt = ''; img.contentEditable = 'false';
      const ext2 = d.getElementsByTagNameNS('*', 'extent')[0];
      if (ext2) img.style.width = Math.round(+ext2.getAttribute('cx') / 9525) + 'px';
      el.appendChild(img);
    }
  }
  let text = '', hasText = false;
  for (const c of r.children) {
    const n = c.localName;
    if (n === 't') { text += c.textContent; hasText = true; }
    else if (n === 'tab') { text += '\t'; hasText = true; }
    else if (n === 'br' || n === 'cr') { text += '\n'; hasText = true; }
    else if (n === 'noBreakHyphen') { text += '‑'; hasText = true; }
  }
  if (!hasText) return;
  const s = document.createElement('span');
  s.dataset.ri = w.runs.push(r) - 1;
  s.textContent = text;
  if (rPr) {
    if (won(wkid(rPr, 'b'))) s.style.fontWeight = '700';
    if (won(wkid(rPr, 'i'))) s.style.fontStyle = 'italic';
    const u = wkid(rPr, 'u'), deco = [];
    if (u && wval(u) !== 'none') deco.push('underline');
    if (won(wkid(rPr, 'strike')) || won(wkid(rPr, 'dstrike'))) deco.push('line-through');
    if (deco.length) s.style.textDecoration = deco.join(' ');
    const col = wval(wkid(rPr, 'color')); if (col && /^[0-9a-f]{6}$/i.test(col)) s.style.color = '#' + col;
    const hl = wval(wkid(rPr, 'highlight')); if (hl && HLC[hl]) s.style.background = HLC[hl];
    const sh = wkid(rPr, 'shd'), sf = sh && sh.getAttributeNS(W_NS, 'fill'); if (sf && /^[0-9a-f]{6}$/i.test(sf)) s.style.background = '#' + sf;
    const sz = +wval(wkid(rPr, 'sz')); if (sz) s.style.fontSize = (sz / 22).toFixed(2) + 'em';
    const va = wval(wkid(rPr, 'vertAlign')); if (va === 'superscript' || va === 'subscript') { s.style.verticalAlign = va === 'superscript' ? 'super' : 'sub'; s.style.fontSize = '0.75em'; }
  }
  el.appendChild(s);
}
function wCheck(w, box) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'wchk'; b.contentEditable = 'false';
  b.dataset.ki = w.boxes.push(box) - 1;
  b.textContent = wChecked(box) ? '☒' : '☐';
  b.setAttribute('aria-pressed', wChecked(box));
  return b;
}
function wChecked(box) {
  if (box.kind === 'sdt') { const c = [...box.cb.children].find(x => x.localName === 'checked'); return !!c && /^(1|true)$/i.test(c.getAttributeNS(W14_NS, 'val') || ''); }
  const ch = wkid(box.cbx, 'checked'); if (ch) return wval(ch) == null || won(ch);
  return won(wkid(box.cbx, 'default'));
}
function wToggle(w, box) {
  const on = !wChecked(box);
  if (box.kind === 'sdt') {
    let c = [...box.cb.children].find(x => x.localName === 'checked');
    if (!c) { c = w.doc.createElementNS(W14_NS, 'w14:checked'); box.cb.insertBefore(c, box.cb.firstChild); }
    c.setAttributeNS(W14_NS, 'w14:val', on ? '1' : '0');
    const st = [...box.cb.children].find(x => x.localName === (on ? 'checkedState' : 'uncheckedState'));
    const glyph = st && st.getAttributeNS(W14_NS, 'val') ? String.fromCharCode(parseInt(st.getAttributeNS(W14_NS, 'val'), 16)) : on ? '☒' : '☐';
    const t = box.sdt.getElementsByTagNameNS(W_NS, 't')[0]; if (t) t.textContent = glyph;
  } else {
    let ch = wkid(box.cbx, 'checked');
    if (!ch) { ch = w.doc.createElementNS(W_NS, 'w:checked'); box.cbx.appendChild(ch); }
    ch.setAttributeNS(W_NS, 'w:val', on ? '1' : '0');
  }
  return on;
}
function wTable(w, tbl) {
  const t = document.createElement('table'); t.className = 'wt';
  const grid = wkids(wkid(tbl, 'tblGrid'), 'gridCol').map(g => +(g.getAttributeNS(W_NS, 'w') || 0));
  if (grid.length && grid.every(Boolean)) { const cg = document.createElement('colgroup'); for (const g of grid) { const c = document.createElement('col'); c.style.width = Math.round(g / 15) + 'px'; cg.appendChild(c); } t.appendChild(cg); }
  const tb = document.createElement('tbody'); t.appendChild(tb);
  const above = [];   // per grid column: the cell a vertical merge continues
  for (const tr of wkids(tbl, 'tr')) {
    const row = document.createElement('tr'); tb.appendChild(row);
    let col = 0;
    for (const tc of wkids(tr, 'tc')) {
      const pr = wkid(tc, 'tcPr'), span = +(wval(wkid(pr, 'gridSpan')) || 1), vm = wkid(pr, 'vMerge');
      if (vm && wval(vm) !== 'restart' && above[col]) { above[col].rowSpan++; col += span; continue; }
      const td = document.createElement('td'); if (span > 1) td.colSpan = span;
      td.dataset.ci = w.cells.push(tc) - 1;
      const sh = wkid(pr, 'shd'), fill = sh && sh.getAttributeNS(W_NS, 'fill'); if (fill && /^[0-9a-f]{6}$/i.test(fill)) td.style.background = '#' + fill;
      wBlocks(w, tc, td);
      row.appendChild(td);
      for (let k = 0; k < span; k++) above[col + k] = vm ? td : null;
      col += span;
    }
  }
  return t;
}
// Puts what is on screen in one paragraph back into its runs (each run keeps its own formatting).
function wApplyPara(w, el) {
  const p = w.paras[+el.dataset.pi]; if (!p) return;
  const mine = [...el.querySelectorAll('[data-ri]')].map(s => w.runs[+s.dataset.ri]);
  let last = null;
  const place = r => { if (last && last.parentNode) last.parentNode.insertBefore(r, last.nextSibling); else { const pPr = wkid(p, 'pPr'); p.insertBefore(r, pPr ? pPr.nextSibling : p.firstChild); } last = r; };
  const loose = text => {
    if (!text) return;
    if (last) { wSetText(w, last, wRunText(last) + text); return; }
    const r = w.doc.createElementNS(W_NS, 'w:r');
    const like = mine[0] || p.getElementsByTagNameNS(W_NS, 'r')[0], rPr = like && wkid(like, 'rPr');
    if (rPr) r.appendChild(rPr.cloneNode(true));
    place(r); wSetText(w, r, text);
  };
  const walk = node => {
    for (const c of [...node.childNodes]) {
      if (c.nodeType === 3) { loose(c.textContent); continue; }
      if (c.nodeType !== 1 || c.contentEditable === 'false' || c.tagName === 'BR') continue;
      if (c.dataset.ri != null) { const r = w.runs[+c.dataset.ri]; if (r.parentNode !== p && !p.contains(r)) place(r); wSetText(w, r, c.textContent); last = r; continue; }
      walk(c);   // something the browser wrapped text in
    }
  };
  walk(el);
  const keep = new Set(mine);
  for (const r of w.pRuns[+el.dataset.pi] || []) if (!keep.has(r) && r.parentNode) r.parentNode.removeChild(r);
  w.pRuns[+el.dataset.pi] = [...el.querySelectorAll('[data-ri]')].map(s => w.runs[+s.dataset.ri]);
}
const wRunText = r => [...r.children].map(c => c.localName === 't' ? c.textContent : c.localName === 'tab' ? '\t' : c.localName === 'br' || c.localName === 'cr' ? '\n' : '').join('');
function wSetText(w, r, text) {
  for (const c of [...r.children]) if (['t', 'tab', 'br', 'cr', 'noBreakHyphen'].includes(c.localName)) r.removeChild(c);
  text.split(/(\t|\n)/).forEach(part => {
    if (!part) return;
    if (part === '\t') r.appendChild(w.doc.createElementNS(W_NS, 'w:tab'));
    else if (part === '\n') r.appendChild(w.doc.createElementNS(W_NS, 'w:br'));
    else { const t = w.doc.createElementNS(W_NS, 'w:t'); t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); t.textContent = part; r.appendChild(t); }
  });
}
function wShadeCell(w, tc, hex) {
  let pr = wkid(tc, 'tcPr');
  if (!pr) { pr = w.doc.createElementNS(W_NS, 'w:tcPr'); tc.insertBefore(pr, tc.firstChild); }
  let sh = wkid(pr, 'shd');
  if (!hex) { if (sh) pr.removeChild(sh); return; }
  if (!sh) {
    sh = w.doc.createElementNS(W_NS, 'w:shd');
    // shd sits after the other cell settings Word expects before it
    const after = [...pr.children].find(c => ['noWrap', 'tcMar', 'textDirection', 'tcFitText', 'vAlign', 'hideMark', 'headers', 'cellIns', 'cellDel', 'cellMerge', 'tcPrChange'].includes(c.localName));
    pr.insertBefore(sh, after || null);
  }
  sh.setAttributeNS(W_NS, 'w:val', 'clear'); sh.setAttributeNS(W_NS, 'w:color', 'auto'); sh.setAttributeNS(W_NS, 'w:fill', hex.replace('#', '').toUpperCase());
}
const CELL_COLORS = [['#FFF59D', 'Yellow'], ['#C8E6C9', 'Green'], ['#BBDEFB', 'Blue'], ['#F8BBD0', 'Pink'], ['', 'No color']];
// One Word file on screen. Editing: click any text and type; click a table cell then a color to shade it.
async function wordCard(st, f, opts) {
  opts = opts || {};
  const el = document.createElement('div'); el.className = 'docx';
  el.innerHTML = '<div class="fhead"><span style="color:var(--fg)">' + esc(opts.title || f.name) + '</span><span>' + (/\.docm$|\.dotm$/i.test(f.name) ? 'Word file with macros' : 'Word file') + '</span>' +
    (f.rubric ? '<span class="addtag" style="background:var(--accent-soft);color:var(--accent)">Your rubric</span>' : '') + (f.edited ? '<span class="addtag" style="background:var(--accent-soft);color:var(--accent)">Edited by you</span>' : '') + (f.added ? addTag(f) : '') + '<span style="flex:1"></span>' +
    (opts.readOnly ? '' : '<button class="btn sm" data-wedit>Edit</button>') + '<button class="btn sm ghost" data-wdl>Download</button></div>' +
    '<div class="wbar" hidden></div><div class="dpage"><p class="muted">Opening…</p></div>';
  const page = el.querySelector('.dpage'), bar = el.querySelector('.wbar');
  let w;
  try { w = openWord(f.data); w.pRuns = []; renderWord(w, page); }
  catch (e) {
    console.error(e);
    try { page.innerHTML = await docxHtml(f.data); } catch { page.innerHTML = '<p>This Word file couldn’t be opened here. Download it to open it in Word.</p>'; }
    const eb = el.querySelector('[data-wedit]'); if (eb) eb.remove();
  }
  if (w && !opts.readOnly) setTimeout(() => wireRubric(st, f, w, page, el, () => soon()), 0);
  if (w) w.pRuns = w.paras.map((_, i) => [...page.querySelectorAll('p[data-pi="' + i + '"] > [data-ri], p[data-pi="' + i + '"] [data-ri]')].map(s => w.runs[+s.dataset.ri]));
  for (const a of page.querySelectorAll('a')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  let editing = false, cell = null, saveT = null;
  const dirty = new Set();
  const saveNowW = async () => {
    clearTimeout(saveT); saveT = null;
    if (!w) return;
    for (const p of dirty) if (p.isConnected) wApplyPara(w, p);
    dirty.clear();
    if (!f.orig) f.orig = f.data;
    f.data = wordBytes(w); f.edited = Date.now(); f.size2 = f.data.length;
    await keepEdit(st, f);
    renderList();
  };
  const soon = () => { clearTimeout(saveT); saveT = setTimeout(saveNowW, 700); };
  const setEditing = on => {
    editing = on;
    page.classList.toggle('editing', on);
    for (const p of page.querySelectorAll('p.wp')) p.contentEditable = on ? 'true' : 'false';
    el.querySelector('[data-wedit]').textContent = on ? 'Done editing' : 'Edit';
    bar.hidden = !on;
    bar.innerHTML = '<span>Click any text to type. Click a table cell, then a color to shade it:</span>' + CELL_COLORS.map(([c, l]) => '<button class="sw" data-cell="' + c + '" title="' + l + '" style="background:' + (c || '#fff') + '">' + (c ? '' : '⦸') + '</button>').join('') +
      (f.orig || f.edited ? '<span style="flex:1"></span><button class="link" data-wreset>Back to the original</button>' : '') +
      (w && w.macros ? '<div class="muted" style="width:100%;font-size:12.5px">Macros can’t run in a browser, but they stay in the file, so they work again when you open it in Word.</div>' : '');
    if (!on) saveNowW();
  };
  el.addEventListener('click', async e => {
    if (e.target.closest('[data-wdl]')) { await saveNowW(); return saveBlob(f.name, new Blob([f.data])); }
    if (e.target.closest('[data-wedit]')) return setEditing(!editing);
    if (e.target.closest('[data-wreset]')) {
      const orig = f.orig || await origBytes(st, f); if (!orig) return toast('The original isn’t kept in this browser');
      f.data = orig; f.orig = null; f.edited = 0; await dropEdit(st, f); toast('Back to the original'); return openStudent(cur, f.path);
    }
    const k = e.target.closest('.wchk');
    if (k && w) { if (!editing) return toast('Click Edit first to change the file'); const on = wToggle(w, w.boxes[+k.dataset.ki]); k.textContent = on ? '☒' : '☐'; k.setAttribute('aria-pressed', on); soon(); return; }
    const sw = e.target.closest('[data-cell]');
    if (sw && w) { if (!cell) return toast('Click a table cell first'); wShadeCell(w, w.cells[+cell.dataset.ci], sw.dataset.cell); cell.style.background = sw.dataset.cell || ''; soon(); return; }
    const td = e.target.closest('td[data-ci]');
    if (td && editing) { if (cell) cell.classList.remove('wsel'); cell = td; td.classList.add('wsel'); }
  });
  page.addEventListener('input', e => { const p = e.target.closest('p.wp'); if (p) { dirty.add(p); soon(); } });
  page.addEventListener('keydown', e => {
    if (!editing) return;
    e.stopPropagation();   // typing here never triggers the app's shortcut keys
    if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertText', false, '\n'); }
    if ((e.metaKey || e.ctrlKey) && /^[biu]$/i.test(e.key)) e.preventDefault();   // formatting stays as it is in the file
  });
  page.addEventListener('paste', e => { if (!editing) return; e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\r\n?/g, '\n')); });
  page.addEventListener('focusout', () => { if (dirty.size) saveNowW(); });
  return el;
}
// Edited Word files are kept in this browser (per download), so the edits come back next time.
async function keepEdit(st, f) {
  try { await kdo('edits', 'readwrite', o => o.put({ data: f.data, orig: f.orig || null, t: f.edited }, batch.id + '|' + f.path)); }
  catch { toast('This browser couldn’t keep your edit. Download the file to keep it.'); }
}
async function dropEdit(st, f) { try { await kdo('edits', 'readwrite', o => o.delete(batch.id + '|' + f.path)); } catch {} }
async function origBytes(st, f) { const r = await kget('edits', batch.id + '|' + f.path); return r && r.orig; }
async function loadEdits() {
  let recs = [], keys = [];
  try {
    const range = IDBKeyRange.bound(batch.id + '|', batch.id + '|￿');
    recs = await kdo('edits', 'readonly', o => o.getAll(range)) || [];
    keys = await kdo('edits', 'readonly', o => o.getAllKeys(range)) || [];
  } catch { return; }
  keys.forEach((k, i) => {
    const path = k.slice(batch.id.length + 1);
    for (const st of batch.students) { const f = st.files.find(x => x.path === path); if (f && recs[i]) { f.orig = recs[i].orig || f.data; f.data = recs[i].data; f.edited = recs[i].t || 1; } }
  });
}

/* ---------------- scoring on her own Word rubric (what her rubric macros do) ---------------- */
// Click a score box to highlight it; two neighbouring boxes in one criterion = the half point between them.
// The highlighted boxes are added up, the percent comes from the grading scale in the rubric (or Rubric setup),
// halves round up (92.5 → 93), and the score goes into Grading Studio and into the rubric's own Total blank.
const RUB_HL = '#FFF59D';
const cellNum = td => { const m = /(\d+(?:\.\d+)?)/.exec(td.textContent || ''); return m ? +m[1] : null; };
const isShaded = td => { const b = (td.style.backgroundColor || '').replace(/\s/g, ''); return !!b && b !== 'rgb(255,255,255)' && b !== 'transparent' && b !== 'white'; };
function rubricModel(page) {
  let best = null, scale = null;
  for (const t of page.querySelectorAll('table.wt')) {
    if (t.parentElement.closest('table.wt')) continue;
    const rows = [...t.rows].map(r => [...r.cells]);
    if (rows.length < 2) continue;
    // a grading scale table: "12 | 100%", "11 | 95%" …
    const sc = {}; let ns = 0;
    for (const r of rows) if (r.length >= 2) { const a = cellNum(r[0]), b = cellNum(r[1]); if (a != null && b != null && /%/.test(r[1].textContent + r[0].textContent + (rows[0][1] ? rows[0][1].textContent : '')) && b >= 30 && b <= 100) { sc[a] = b; ns++; } }
    if (ns >= 4) { scale = sc; continue; }
    const lvl = v => v != null && v >= 0 && v <= 6;
    // levels down the side (Score 4 / Score 3 … rows, criteria across the top)
    const side = rows.slice(1).map(r => cellNum(r[0]));
    if (side.filter(lvl).length >= 2 && rows[0].length >= 2) {
      const cells = [];
      rows.slice(1).forEach((r, k) => { if (!lvl(side[k])) return; r.slice(1).forEach((td, c) => cells.push({ td, crit: c, val: side[k] })); });
      const crits = rows[0].slice(1).map(td => td.textContent.trim() || 'Criterion');
      const m = { cells, crits, levels: [...new Set(side.filter(lvl))] };
      if (!best || cells.length > best.cells.length) best = m;
      continue;
    }
    // levels across the top (4 | 3 | 2 | 1 columns, criteria down the side)
    const top = rows[0].map((td, c) => c ? cellNum(td) : null);
    if (top.filter(lvl).length >= 2) {
      const cells = [];
      rows.slice(1).forEach((r, k) => r.forEach((td, c) => { if (c && lvl(top[c])) cells.push({ td, crit: k, val: top[c] }); }));
      const m = { cells, crits: rows.slice(1).map(r => r[0] ? r[0].textContent.trim() : 'Criterion'), levels: [...new Set(top.filter(lvl))] };
      if (!best || cells.length > best.cells.length) best = m;
    }
  }
  if (best) { best.scale = scale; best.max = best.crits.length * Math.max(...best.levels); }
  return best;
}
function rubricScore(m) {
  const per = m.crits.map((_, i) => { const v = m.cells.filter(c => c.crit === i && isShaded(c.td)).map(c => c.val); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; });
  const done = per.filter(v => v != null);
  const total = done.length ? Math.round(done.reduce((a, b) => a + b, 0) * 100) / 100 : null;
  return { per, total, done: done.length === per.length, pct: total == null ? null : percentWith(total, m.max, m.scale || (maxPoints() === m.max ? setup.scale : null)) };
}
// Writes the total (and percent) into the rubric's own blank, like "Total: ____ / 12 = ____%", when there is exactly one.
function fillTotalBlank(w, page, m, s) {
  const re = new RegExp('(^|[^\\d])([_\\s.\\d]*)\\/\\s*' + m.max + '(?!\\d)');
  const spots = [...page.querySelectorAll('p.wp')].filter(p => !m.cells.some(c => c.td.contains(p)) && re.test(p.textContent) && /score|total|grade|points/i.test((p.closest('td') || p).textContent));
  if (spots.length !== 1 || s.total == null) return false;
  const p = spots[0];
  const sp = [...p.querySelectorAll('[data-ri]')].find(x => re.test(x.textContent)) ;
  if (!sp) return false;
  sp.textContent = sp.textContent.replace(re, (all, a, blank) => a + (blank && /\S/.test(blank) && !/[_\d]/.test(blank) ? blank : ' ') + fmtNum(s.total) + ' /' + (all.match(/\/(\s*)/)[1] || ' ') + m.max);
  const pc = [...p.querySelectorAll('[data-ri]')].find(x => /[_\d.]*\s*%/.test(x.textContent) && x !== sp) || (/%/.test(sp.textContent) ? sp : null);
  if (pc && s.pct != null) pc.textContent = pc.textContent.replace(/([=:]?\s*)[_\d.]*\s*%/, (a, pre) => (pre || '') + fmtNum(s.pct) + '%');
  wApplyPara(w, p);
  return true;
}
// The score panel follows the rubric.
function rubricToGrade(st, s, max, nCrit) {
  if (setup.mode === 'points') { if (+setup.outOf !== max) { setup.outOf = max; store.set('gs.setup', { ...setup, spot: undefined, rubricPage: undefined }); if (batch.assignment) { batch.assignment.setup = { ...setup, spot: undefined }; saveLib(); } } st.grade.points = String(s.total); }
  else if (setup.criteria.length === nCrit) st.grade.rubric = s.per.map(v => v == null ? null : v);
  else st.grade.points = String(s.total);
}
// A Word rubric's score without opening it: the boxes already highlighted, read the same way as on screen.
function wordScore(f) {
  if (f.kind !== 'docx' || !f.data) return null;
  if (f.wsOf === f.data) return f.wscore;
  let s = null;
  try {
    const w = openWord(f.data), page = document.createElement('div'); page.className = 'dpage'; w.pRuns = []; renderWord(w, page);
    const m = rubricModel(page);
    if (m) s = { ...rubricScore(m), max: m.max, nCrit: m.crits.length, crits: m.crits, scale: m.scale };
    f.wtyped = wordTyped(page, m);
  } catch (e) { console.error(e); f.wtyped = []; }
  f.wsOf = f.data; f.wscore = s;
  return s;
}
// Grades typed in a Word file, like "10/12 = 85%" or "9.5/12". Rubric tables and grading-scale tables are skipped.
function wordTyped(page, m) {
  const rub = m && m.cells.length ? m.cells[0].td.closest('table.wt') : null, out = [];
  const skip = new Set(rub ? [rub] : []);
  for (const t of page.querySelectorAll('table.wt')) if ([...t.querySelectorAll('td')].filter(td => { const g = parseGrade(td.textContent, false); return g && g.rank >= 1; }).length >= 3) skip.add(t);
  for (const p of page.querySelectorAll('p')) {
    const t = p.closest('table.wt'); if (t && [...skip].some(k => k.contains(t))) continue;
    const text = p.textContent.replace(/\s+/g, ' ').trim(); if (!text) continue;
    const g = parseGrade(text, false); if (!g || g.rank < 2) continue;
    out.push({ score: g.score, outOf: g.outOf, pct: g.pct != null ? g.pct : g.score != null && g.outOf ? percentWith(g.score, g.outOf, setup.scale) : null, text: text.length > 80 ? text.slice(0, 80) + '…' : text, word: true });
  }
  return out;
}
// What a Word file adds to the grade sheet: a highlighted rubric gives the score, otherwise a grade typed in it.
const wordFound = f => f.kind === 'docx' && f.wsOf === f.data ? (f.wscore && f.wscore.total != null ? [] : f.wtyped || []) : [];
// Every student's Word rubrics: a rubric already highlighted gives the score, like opening it would.
function wordScoresOf(st) { for (const f of st.files) wordScore(f); }
function wordScoresAll() {
  if (!batch) return;
  let n = 0;
  for (const st of batch.students) { wordScoresOf(st); if (st.files.some(f => wordFound(f).length)) refound(st); }
  for (const st of batch.students) for (const f of st.files) {
    const s = wordScore(f); if (!s || s.total == null) continue;
    if (s.scale && setup.mode === 'points' && JSON.stringify(s.scale) !== JSON.stringify(setup.scale)) { setup.scale = s.scale; store.set('gs.setup', { ...setup, spot: undefined, rubricPage: undefined }); if (batch.assignment) { batch.assignment.setup = { ...setup, spot: undefined }; saveLib(); } }
    if (ownGrade(st).total == null) { rubricToGrade(st, s, s.max, s.nCrit); n++; }
  }
  if (n) { saveSoon(); renderList(); renderGrade(); }
}
function wireRubric(st, f, w, page, el, soon) {
  const m = rubricModel(page); if (!m) return;
  for (const c of m.cells) { c.td.classList.add('rcell'); c.td.title = 'Click to highlight this score (two neighbouring boxes = half point)'; }
  const info = document.createElement('div'); info.className = 'rinfo'; el.insertBefore(info, page);
  const show = s => {
    info.innerHTML = '<b>' + (s.total == null ? '–' : fmtNum(s.total)) + '</b> / ' + m.max + (s.pct != null ? ' <b style="color:var(--accent)">' + fmtNum(s.pct) + '%</b>' : '') +
      '<span class="muted">' + m.crits.map((c, i) => esc(c.length > 24 ? c.slice(0, 24) + '…' : c) + ' ' + (s.per[i] == null ? '–' : fmtNum(s.per[i]))).join(' · ') + '</span>' +
      (s.done ? '' : '<span class="muted">Click a score box in each criterion</span>');
  };
  const push = (s, write) => {
    show(s);
    if (s.total == null) return;
    rubricToGrade(st, s, m.max, m.crits.length);
    if (write && fillTotalBlank(w, page, m, s)) soon();
    saveSoon(); renderList(); if (st === batch.students[cur]) renderGrade();
  };
  if (m.scale && JSON.stringify(m.scale) !== JSON.stringify(setup.scale) && setup.mode === 'points') {   // the scale printed on her rubric wins
    setup.scale = m.scale; store.set('gs.setup', { ...setup, spot: undefined, rubricPage: undefined }); if (batch.assignment) { batch.assignment.setup = { ...setup, spot: undefined }; saveLib(); }
  }
  const s0 = rubricScore(m); show(s0);
  if (s0.total != null && ownGrade(st).total == null) push(s0, false);   // a rubric already highlighted in Word brings its score in
  page.addEventListener('click', e => {
    if (page.classList.contains('editing')) return;   // while editing, clicks place the cursor; use the color buttons
    const td = e.target.closest('td.rcell'); if (!td) return;
    const c = m.cells.find(x => x.td === td), same = m.cells.filter(x => x.crit === c.crit && x !== c && isShaded(x.td));
    const set = (x, on) => { wShadeCell(w, w.cells[+x.td.dataset.ci], on ? RUB_HL : ''); x.td.style.background = on ? RUB_HL : ''; };
    if (isShaded(td)) set(c, false);
    else {
      // a neighbour already picked makes the half point; anything else in this criterion is replaced
      const keep = same.length === 1 && Math.abs(same[0].val - c.val) === 1;
      for (const x of same) if (!keep) set(x, false);
      set(c, true);
    }
    push(rubricScore(m), true); soon();
  });
}

/* ---------------- split a scan: one PDF of everyone's papers (any order), pages dragged onto names on the roster ---------------- */
let SP = null;   // { name, data, doc, n, thumbs[], ink[], owner[], skip:Set, sel:Set, anchor, names[], classId, asg, last, size }
// With a download open (into), the pages go to students in it, like a makeup scan for students who missed the day.
// Names are the roster's plus anyone in the download the roster doesn't name.
function splitIntoNames(c) {
  const r = c ? c.names.slice() : [], m = rosterMatch(r), used = new Set(m.values());
  return r.concat(batch.students.filter(st => !used.has(st)).map(st => st.key));
}
async function openSplit(file, assignment, into) {
  const data = new Uint8Array(await file.arrayBuffer());
  await workerReady;
  let doc;
  try { doc = await pdfjsLib.getDocument({ data: data.slice(), isEvalSupported: false }).promise; }
  catch { return toast('Couldn’t open ' + file.name + ' as a PDF'); }
  const c = into ? batchClass() : assignment && assignment.classId ? classById(assignment.classId) : (lib.classes.find(k => k.names.length) || null);
  SP = { name: file.name.replace(/\.pdf$/i, ''), data, doc, n: doc.numPages, thumbs: [], ink: [], owner: Array(doc.numPages).fill(''), skip: new Set(), sel: new Set(), anchor: 0,
    names: into ? splitIntoNames(c) : c ? c.names.slice() : [], classId: c ? c.id : '', asg: assignment || null, into: !!into, last: 1, size: +(store.get('gs.spsize', 1)) };
  if (into) splitPick(0, 1);
  if (!into) splitPick(0, splitGuess());
  splitShell(); splitRender();
}
const spClass = () => SP.classId ? classById(SP.classId) : null;
// A first guess at pages per student, so the first pick is a whole paper: page count over roster size when it comes out even.
function splitGuess() {
  const r = SP.names.length;
  if (!r || SP.n < r) return 1;
  return SP.n % r === 0 ? SP.n / r : 1;
}
const spFree = i => !SP.owner[i] && !SP.skip.has(i);
// Select k pages that nobody has yet, starting at page i.
function splitPick(i, k) {
  SP.sel = new Set();
  for (let p = i; p < SP.n && SP.sel.size < k; p++) if (spFree(p)) SP.sel.add(p);
  SP.anchor = SP.sel.size ? Math.min(...SP.sel) : 0;
}
async function splitRender() {
  const me = SP;
  for (let i = 0; i < me.n && SP === me; i++) {
    if (me.thumbs[i]) continue;
    const page = await me.doc.getPage(i + 1), vp0 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: 520 / vp0.width });
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    try { await page.render({ canvasContext: ctx, viewport: vp, annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise; } catch {}
    me.ink[i] = splitInk(ctx, cv.width, cv.height);
    me.thumbs[i] = cv.toDataURL('image/jpeg', .78);
    if (SP !== me) return;
    const im = document.querySelector('#spPages img[data-th="' + i + '"]'); if (im) im.src = me.thumbs[i];
    const st = $('#spStat'); if (st) st.textContent = i + 1 < me.n ? 'Reading pages… ' + (i + 1) + ' of ' + me.n : '';
  }
}
// Share of dark pixels, ignoring a margin where scanners leave edge shadows.
function splitInk(ctx, w, h) {
  const m = Math.round(w * .06), d = ctx.getImageData(m, m, w - 2 * m, h - 2 * m).data; let dark = 0;
  for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] < 400) dark++;
  return dark / (d.length / 16);
}
const spPagesOf = nm => SP.owner.map((o, i) => o === nm ? i : -1).filter(i => i >= 0);
// "1-3, 7" from [0,1,2,6]
function spRange(list) {
  const out = []; let a = null, b = null;
  for (const p of list) { if (a != null && p === b + 1) { b = p; continue; } if (a != null) out.push(a === b ? a + 1 : (a + 1) + '–' + (b + 1)); a = b = p; }
  if (a != null) out.push(a === b ? a + 1 : (a + 1) + '–' + (b + 1));
  return out.join(', ');
}
function splitShell() {
  const c = spClass();
  openDlg('<div class="bh"><h2>Split a scan: ' + esc(SP.name) + '</h2><span class="muted" id="spStat"></span><span class="muted">' + SP.n + ' pages</span></div>' +
    '<div class="spwrap"><div class="spleft">' +
      '<div class="spbar"><span class="seg" id="spSize"><button data-sz="0">S</button><button data-sz="1">M</button><button data-sz="2">L</button></span>' +
        '<button class="btn sm" id="spBlank">Leave out blank pages</button><button class="btn sm" id="spSkip">Leave out selected</button><span class="sp"></span><span id="spSelInfo"></span></div>' +
      '<p class="muted sphint">Click a page, then Shift-click another to pick a range (⌘/Ctrl-click adds one page). Drag the pages onto a name, click the name, or type it and press Enter. After that, one Shift-click picks from the next page up to the one you click. Double-click a page to see it big.</p>' +
      '<div id="spPages"></div></div>' +
    '<div class="spright"><div class="spbar"><label>Class <select class="btn" id="spCls"><option value="">No roster</option>' + lib.classes.map(k => '<option value="' + k.id + '"' + (c && c.id === k.id ? ' selected' : '') + '>' + esc(k.name) + ' (' + k.names.length + ')</option>').join('') + '</select></label></div>' +
      '<input class="btn" id="spFind" placeholder="Type a name, Enter to give it the pages" autocomplete="off">' +
      '<div id="spNames"></div><button class="link" id="spAdd" style="margin-top:8px">+ Add a name</button></div></div>' +
    '<div class="bf" style="justify-content:space-between;align-items:center"><span class="muted" id="spFoot" style="font-size:13px"></span>' +
      '<span style="display:flex;gap:8px"><button class="btn" data-cancel>Cancel</button><button class="btn primary" id="spGo">' + (SP.into ? 'Add to this download' : 'Open for grading') + '</button></span></div>');
  const box = $('#dlgBox'); box.classList.add('spbox');
  splitDraw();
  box.ondblclick = ev => { const pg = ev.target.closest('.spg'); if (pg) splitZoom(+pg.dataset.spg); };
  box.onclick = ev => {
    const t = ev.target;
    if (t.closest('[data-cancel]')) { SP = null; splitZoomClose(); return closeDlg(); }
    const pg = t.closest('.spg');
    if (pg) {
      const i = +pg.dataset.spg;
      if (t.closest('[data-zoom]')) return splitZoom(i);
      if (t.closest('[data-unpg]')) { SP.owner[i] = ''; SP.skip.delete(i); return splitDraw(); }
      if (ev.shiftKey) { SP.sel = new Set(); const [a, b] = [Math.min(SP.anchor, i), Math.max(SP.anchor, i)]; for (let p = a; p <= b; p++) if (spFree(p) || a === b) SP.sel.add(p); ev.preventDefault(); }
      else if (ev.metaKey || ev.ctrlKey) { SP.sel.has(i) ? SP.sel.delete(i) : SP.sel.add(i); SP.anchor = i; }
      else { SP.sel = new Set([i]); SP.anchor = i; }
      return splitDrawSel();
    }
    const nr = t.closest('[data-spn]');
    if (nr) {
      if (t.closest('[data-unall]')) { const nm = SP.names[+nr.dataset.spn]; SP.owner = SP.owner.map(o => o === nm ? '' : o); return splitDraw(); }
      return splitGive(SP.names[+nr.dataset.spn]);
    }
    if (t.closest('#spBig')) return splitZoomClose();
    const sz = t.closest('[data-sz]');
    if (sz) { SP.size = +sz.dataset.sz; store.set('gs.spsize', SP.size); return splitDraw(); }
    if (t.id === 'spSkip') { if (!SP.sel.size) return toast('Pick the pages to leave out first'); for (const p of SP.sel) { SP.skip.add(p); SP.owner[p] = ''; } const last = Math.max(...SP.sel); splitPick(last + 1, SP.last); return splitDraw(); }
    if (t.id === 'spBlank') {
      if (SP.ink.filter(v => v != null).length < SP.n) return toast('Still reading the pages, try again in a moment');
      const blank = SP.ink.map((v, i) => v < .0015 && !SP.owner[i] ? i : -1).filter(i => i >= 0);
      if (!blank.length) return toast('No blank pages found');
      for (const i of blank) { SP.skip.add(i); SP.sel.delete(i); }
      toast(blank.length + ' blank ' + (blank.length === 1 ? 'page' : 'pages') + ' left out'); return splitDraw();
    }
    if (t.id === 'spAdd') { const nm = (prompt('Student’s name') || '').trim(); if (nm && !SP.names.includes(nm)) SP.names.push(nm); return splitDraw(); }
    if (t.id === 'spGo') return splitGo(t);
  };
  box.onchange = ev => {
    if (ev.target.id !== 'spCls') return;
    SP.classId = ev.target.value; const k = spClass();
    const extra = [...new Set(SP.owner.filter(Boolean))].filter(nm => !(k ? k.names : []).includes(nm));
    SP.names = SP.into ? splitIntoNames(k) : (k ? k.names.slice() : []);
    SP.names = SP.names.concat(extra.filter(nm => !SP.names.includes(nm)));
    splitDraw();
  };
  box.addEventListener('dragstart', ev => {
    const pg = ev.target.closest && ev.target.closest('.spg'); if (!pg) return;
    const i = +pg.dataset.spg; if (!SP.sel.has(i)) { SP.sel = new Set([i]); SP.anchor = i; splitDraw(); }
    ev.dataTransfer.setData('text/plain', 'pages'); ev.dataTransfer.effectAllowed = 'move';
    const sel = [...SP.sel].sort((a, b) => a - b), gh = document.createElement('div'); gh.className = 'spghost';
    gh.textContent = (sel.length === 1 ? 'Page ' : sel.length + ' pages: ') + spRange(sel); document.body.appendChild(gh);
    ev.dataTransfer.setDragImage(gh, 20, 20); setTimeout(() => gh.remove(), 0);
  });
  box.addEventListener('dragover', ev => { const nr = ev.target.closest && ev.target.closest('[data-spn]'); if (!nr) return; ev.preventDefault(); for (const x of box.querySelectorAll('.spname.over')) if (x !== nr) x.classList.remove('over'); nr.classList.add('over'); });
  box.addEventListener('dragleave', ev => { const nr = ev.target.closest && ev.target.closest('[data-spn]'); if (nr && !nr.contains(ev.relatedTarget)) nr.classList.remove('over'); });
  box.addEventListener('drop', ev => { const nr = ev.target.closest && ev.target.closest('[data-spn]'); if (!nr) return; ev.preventDefault(); nr.classList.remove('over'); splitGive(SP.names[+nr.dataset.spn]); });
  const find = $('#spFind');
  find.oninput = () => splitDrawNames();
  find.onkeydown = ev => {
    if (ev.key !== 'Enter') return; ev.preventDefault();
    const m = splitMatches(); if (m.length) { splitGive(SP.names[m[0]]); find.value = ''; splitDrawNames(); }
  };
}
// One page big enough to read a handwritten name; any click or Esc closes it.
const splitZoom = i => bigPage(SP.doc, i, SP.thumbs[i]);
async function bigPage(doc, i, thumb) {
  splitZoomClose();
  if (!doc) return;
  const d = document.createElement('div'); d.id = 'spBig'; d.innerHTML = '<img alt="Page ' + (i + 1) + '" src="' + (thumb || '') + '"><span>Page ' + (i + 1) + ' · click or Esc to close</span>';
  $('#dlgBox').appendChild(d);
  const esc1 = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); splitZoomClose(); } };
  window.addEventListener('keydown', esc1, true); d._esc = esc1;
  const page = await doc.getPage(i + 1), vp0 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: 1400 / vp0.width });
  const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  try { await page.render({ canvasContext: ctx, viewport: vp }).promise; } catch {}
  if (d.isConnected) d.querySelector('img').src = cv.toDataURL('image/jpeg', .85);
}
function splitZoomClose() { const d = $('#spBig'); if (d) { window.removeEventListener('keydown', d._esc, true); d.remove(); } }
function splitMatches() {
  const q = ($('#spFind') && $('#spFind').value || '').toLowerCase().split(/\s+/).filter(Boolean);
  const idx = SP.names.map((_, i) => i);
  if (!q.length) return idx;
  const words = nm => nm.toLowerCase().split(/[\s,]+/).filter(Boolean);
  return idx.filter(i => q.every(w => words(SP.names[i]).some(x => x.startsWith(w))))
    .sort((a, b) => (spPagesOf(SP.names[a]).length ? 1 : 0) - (spPagesOf(SP.names[b]).length ? 1 : 0));
}
function splitGive(nm) {
  if (!nm) return;
  if (!SP.sel.size) return toast('Pick the pages first');
  const list = [...SP.sel].sort((a, b) => a - b);
  for (const p of list) { SP.owner[p] = nm; SP.skip.delete(p); }
  SP.last = list.length;
  SP.sel = new Set();
  let nx = list[list.length - 1] + 1; while (nx < SP.n && !spFree(nx)) nx++;
  if (nx >= SP.n) { nx = 0; while (nx < SP.n && !spFree(nx)) nx++; }
  SP.anchor = nx < SP.n ? nx : 0;
  splitDraw();
}
function splitDraw() {
  const W = [110, 160, 230][SP.size] || 160;
  for (const b of document.querySelectorAll('#spSize [data-sz]')) b.setAttribute('aria-pressed', +b.dataset.sz === SP.size);
  $('#spPages').style.setProperty('--spw', W + 'px');
  $('#spPages').innerHTML = Array.from({ length: SP.n }, (_, i) => {
    const o = SP.owner[i], sk = SP.skip.has(i);
    return '<div class="spg' + (SP.sel.has(i) ? ' sel' : '') + (o ? ' own' : '') + (sk ? ' skip' : '') + '" data-spg="' + i + '" draggable="true">' +
      '<img data-th="' + i + '" src="' + (SP.thumbs[i] || '') + '" alt="Page ' + (i + 1) + '" draggable="false">' +
      '<span class="sppick"></span><button class="spzoom" data-zoom title="See this page big">⤢</button>' +
      '<div class="spf"><span class="spno">' + (i + 1) + '</span>' +
      (o || sk ? '<span class="spown">' + (sk ? 'Left out' : esc(o)) + '</span><button data-unpg title="Take this page back">×</button>' : '') + '</div></div>';
  }).join('');
  splitDrawSel();
  splitDrawNames();
}
// Selection only: the page cards stay in place, so a double-click still lands on them.
function splitDrawSel() {
  const sel = [...SP.sel].sort((a, b) => a - b);
  for (const el of document.querySelectorAll('#spPages .spg')) {
    const k = sel.indexOf(+el.dataset.spg); el.classList.toggle('sel', k >= 0);
    el.querySelector('.sppick').textContent = k >= 0 ? (sel.length > 1 ? (k + 1) + ' of ' + sel.length : 'Picked') : '';
  }
  const info = $('#spSelInfo');
  info.textContent = sel.length ? (sel.length === 1 ? 'Page ' : 'Pages ') + spRange(sel) + ' picked' : (spFree(SP.anchor) && SP.owner.some(Boolean) ? 'Next starts at page ' + (SP.anchor + 1) + ': Shift-click its last page' : 'No pages picked');
  info.classList.toggle('on', !!sel.length);
}
function splitDrawNames() {
  const m = splitMatches(), q = $('#spFind').value.trim();
  $('#spNames').innerHTML = (m.length ? m.map((i, k) => {
    const nm = SP.names[i], pg = spPagesOf(nm);
    return '<div class="spname' + (pg.length ? ' has' : '') + (q && k === 0 ? ' top' : '') + '" data-spn="' + i + '"><span class="spck">' + (pg.length ? '✓' : '') + '</span><b>' + esc(nm) + '</b>' +
      (pg.length ? '<span class="muted">p. ' + spRange(pg) + '</span><button class="link" data-unall title="Take these pages back">undo</button>' : '') + '</div>';
  }).join('') : '<p class="muted" style="font-size:13px">' + (SP.names.length ? 'No name matches.' : 'Pick a class above, or add names.') + '</p>');
  const given = SP.owner.filter(Boolean).length, left = SP.n - given - SP.skip.size, who = new Set(SP.owner.filter(Boolean)).size;
  const none = SP.names.filter(nm => !spPagesOf(nm).length);
  $('#spFoot').innerHTML = who + (who === 1 ? ' student' : ' students') + ' · ' + given + ' of ' + SP.n + ' pages given' +
    (left ? ' · <b style="color:var(--warn)">' + left + (left === 1 ? ' page' : ' pages') + ' not given to anyone yet (left out if you open now)</b>' : '') +
    (none.length && who ? ' · No pages: ' + esc(none.join(', ')) : '');
  $('#spGo').disabled = !who;
}
// One page drawn as a picture into a new PDF, at its own size.
async function rasterInto(out, jsDoc, i, dpi) {
  const page = await jsDoc.getPage(i + 1), vp1 = page.getViewport({ scale: 1 }), k = dpi / 72;
  const c = document.createElement('canvas'); c.width = Math.ceil(vp1.width * k); c.height = Math.ceil(vp1.height * k);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: k }), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
  const jpg = await new Promise(res => c.toBlob(b => b.arrayBuffer().then(x => res(new Uint8Array(x))), 'image/jpeg', 0.9));
  out.addPage([vp1.width, vp1.height]).drawImage(await out.embedJpg(jpg), { x: 0, y: 0, width: vp1.width, height: vp1.height });
  c.width = c.height = 0; page.cleanup();
}
async function splitGo(btn) {
  btn.disabled = true; btn.textContent = 'Making each student’s paper…';
  const me = SP, src = await PDFLib.PDFDocument.load(me.data, { ignoreEncryption: true, updateMetadata: false });
  const file = ((me.asg && me.asg.name) || me.name).replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Scan';
  const entries = [];
  for (const nm of new Set(me.owner.filter(Boolean))) {
    const out = await PDFLib.PDFDocument.create();
    if (!src.isEncrypted) { for (const pg of await out.copyPages(src, spPagesOf(nm))) out.addPage(pg); }
    else for (const i of spPagesOf(nm)) await rasterInto(out, me.doc, i, 200);   // a locked PDF copies as blank pages
    entries.push({ path: nm.replace(/[\\/:*?"<>|]+/g, ' ').trim() + '/' + file + '.pdf', data: await out.save() });
  }
  SP = null; closeDlg(); me.doc.destroy();
  if (me.into && batch) {   // each student's pages are added to them as a file of their own; someone new to the download is added
    const c = me.classId ? classById(me.classId) : null, m = c ? rosterMatch(c.names) : new Map(), keep = batch.students[cur];
    let first = null;
    for (const e of entries) {
      const nm = e.path.slice(0, e.path.indexOf('/')), owner = [...new Set(me.owner.filter(Boolean))].find(o => o.replace(/[\\/:*?"<>|]+/g, ' ').trim() === nm) || nm;
      let st = batch.students.find(x => x.key === owner) || m.get(owner);
      if (!st) { st = { key: nm, files: [], grade: { rubric: [], points: '', comment: '' }, layout: null, inc: {} }; batch.students.push(st); }
      await addFiles(st, [{ path: e.path, file: new File([e.data], me.name + '.pdf', { type: 'application/pdf' }) }], true);
      first ||= st;
    }
    rosterSort(); cur = Math.max(0, batch.students.indexOf(keep));
    setBatchName();
    saveNow(); renderList();
    if (first) openStudent(batch.students.indexOf(first));
    return toast('Added pages for ' + entries.length + (entries.length === 1 ? ' student' : ' students'));
  }
  await intake(entries, me.name, me.asg);
  if (me.classId && batch) { batch.classId = me.classId; renderClassSel(); saveNow(); renderList(); }
}

/* ---------------- other files: kept with the student, downloadable, returned in the export if you added them ---------------- */
function textCard(f) {
  const el = document.createElement('div'); el.className = 'docx';
  let t = new TextDecoder().decode(f.data);
  if (/\.rtf$/i.test(f.name)) t = t.replace(/\\par[d]?/g, '\n').replace(/\{\\\*[^{}]*\}|\\[a-z]+-?\d* ?|[{}]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
  el.innerHTML = '<div class="fhead"><span style="color:var(--fg)">' + esc(f.name) + '</span><span>Text</span>' + (f.added ? addTag(f) : '') + '<span style="flex:1"></span><button class="btn sm ghost" data-odl>Download</button></div><div class="dpage" style="white-space:pre-wrap"></div>';
  el.querySelector('.dpage').textContent = t;
  el.querySelector('[data-odl]').onclick = () => saveBlob(f.name, new Blob([f.data]));
  return el;
}
function otherCard(f) {
  const el = document.createElement('div'); el.className = 'nofile'; el.style.marginBottom = '12px'; el.style.maxWidth = '640px';
  const ext = (/\.(\w+)$/.exec(f.name) || [, ''])[1].toLowerCase();
  const why = ext === 'doc' ? 'An older Word file. It can’t be shown in a browser; download it to open it in Word (saving it as .docx lets you edit it here).'
    : /^(pptx?|key)$/.test(ext) ? 'Slides can’t be shown here; download to open them.'
    : /^(xlsx?|numbers|csv)$/.test(ext) ? 'A spreadsheet. Download to open it.'
    : /^(heic|heif|tiff?)$/.test(ext) ? 'This browser can’t show this picture type (Safari can). Download to open it.'
    : 'This kind of file can’t be shown here. Download to open it.';
  el.innerHTML = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b>' + esc(f.name) + '</b>' + (f.added ? addTag(f) : '') + '<span style="flex:1"></span>' + (f.data ? '<button class="btn sm" data-odl>Download</button>' : '') + '</div><div style="margin-top:6px">' + why + ' You can still give a score.' + (f.added ? ' It goes back with the export because you added it.' : '') + '</div>';
  const b = el.querySelector('[data-odl]'); if (b) b.onclick = () => saveBlob(f.name, new Blob([f.data]));
  return el;
}

/* ---------------- bringing in many files at once: each one sorted to its student by name ---------------- */
const SORT_STOP = new Set(['pdf', 'docx', 'docm', 'doc', 'rubric', 'final', 'draft', 'copy', 'marked', 'graded', 'feedback', 'interview', 'summative', 'formative', 'assignment', 'the', 'and', 'of', 'for', 'version', 'v', 'el', 'grade', 'resume', 'cover', 'letter', 'essay', 'paragraph', 'analysis', 'notes', 'comments', 'scan', 'img', 'image', 'page']);
function sortGuess(path) {
  const c = batchClass(), extra = new Map();
  if (c) for (const [n, s] of rosterMatch(c.names)) extra.set(s, nameWords(n));
  return guessAmong(path, batch.students.map(st => [nameWords(st.key), extra.get(st) || []]));
}
async function bringIn(list) {
  list = list.filter(e => e.file && !junk(e.path));
  if (!list.length) return;
  const rows = list.map(e => ({ e, ...sortGuess(e.path) }));
  const opts = i => '<option value="-1"' + (i < 0 ? ' selected' : '') + '>Choose a student…</option>' + batch.students.map((st, k) => '<option value="' + k + '"' + (k === i ? ' selected' : '') + '>' + (k + 1) + '. ' + esc(st.key) + '</option>').join('') + '<option value="-2">Skip this file</option>';
  const count = () => rows.filter(r => r.i >= 0).length;
  openDlg('<div class="bh"><h2>Bring in files</h2><span class="muted">' + list.length + (list.length === 1 ? ' file' : ' files') + ', sorted by the names in the file names</span><button class="icon" data-close aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb"><p class="muted" style="margin:0 0 10px;font-size:14px">Each file goes into that student’s submission in this download, tagged “Added by you”. Check the ones marked “Check” or “Choose”.</p>' +
    '<table class="gl"><thead><tr><th>File</th><th>Goes to</th><th></th></tr></thead><tbody>' +
    rows.map((r, k) => '<tr><td style="overflow-wrap:anywhere">' + esc(r.e.path) + '</td><td><select class="btn" data-row="' + k + '" style="max-width:280px">' + opts(r.i) + '</select></td><td data-tag="' + k + '">' + sortTag(r) + '</td></tr>').join('') +
    '</tbody></table></div><div class="bf"><button class="btn" data-close>Cancel</button><button class="btn primary" data-go>Add ' + count() + (count() === 1 ? ' file' : ' files') + '</button></div>');
  const box = $('#dlgBox');
  box.onchange = e => { const s = e.target.closest('[data-row]'); if (!s) return; const r = rows[+s.dataset.row]; r.i = +s.value; r.sure = true; r.set = true; box.querySelector('[data-tag="' + s.dataset.row + '"]').innerHTML = sortTag(r); const n = count(); box.querySelector('[data-go]').textContent = 'Add ' + n + (n === 1 ? ' file' : ' files'); };
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (!e.target.closest('[data-go]')) return;
    const groups = new Map();
    for (const r of rows) if (r.i >= 0) { if (!groups.has(r.i)) groups.set(r.i, []); groups.get(r.i).push(r.e); }
    if (!groups.size) return toast('Choose a student for at least one file');
    closeDlg();
    let n = 0, lastI = cur;
    for (const [i, fl] of groups) { await addFiles(batch.students[i], fl, true); n += fl.length; lastI = i; }
    renderList(); openStudent(groups.has(cur) ? cur : lastI);
    toast('Added ' + n + (n === 1 ? ' file' : ' files') + ' to ' + groups.size + (groups.size === 1 ? ' student' : ' students'));
  };
}
const sortTag = r => r.i === -2 ? '<span class="muted">Skipped</span>' : r.i < 0 ? '<span class="pill" style="font-size:12px;padding:2px 8px;border-radius:999px;background:var(--warn-soft);color:var(--warn)">Choose</span>'
  : r.set ? '<span class="muted">Chosen by you</span>' : r.sure ? '<span style="color:var(--good, #1C7F54);font-size:13px;font-weight:600">Matched by name</span>' : '<span class="pill" style="font-size:12px;padding:2px 8px;border-radius:999px;background:var(--warn-soft);color:var(--warn)">Check</span>';

/* ---------------- folder import: many files (a folder, a ZIP), each matched to a student by the name in its file or folder name ---------------- */
// Picked files as [{ path, file }], keeping folder names (they often hold the student's name) and opening ZIPs.
async function expandPicked(files) {
  const out = [];
  for (const f of files) {
    const path = f.webkitRelativePath || f.name;
    if (junk(path)) continue;
    if (/\.zip$/i.test(f.name)) {
      const raw = [];
      zipSkipped = 0;
      try { unzipInto(new Uint8Array(await f.arrayBuffer()), '', raw, 0); } catch { toast('Couldn’t open ' + f.name + '. Try unzipping it in Finder (double-click it), then choose the folder.', 9000); continue; }
      if (zipSkipped) toast(zipSkipped + ' files in ' + f.name + ' are packed in a way a browser can’t open. Unzip it in Finder first.', 9000);
      for (const r of raw) if (r.data && !junk(r.path)) out.push({ path: f.name.replace(/\.zip$/i, '') + '/' + r.path, file: new File([r.data], r.path.split('/').pop()) });
      continue;
    }
    out.push({ path, file: f });
  }
  return out;
}
// The Mac app chooses folders through macOS itself; files come back with their folder path, like the web picker's.
async function nativeFolder() {
  const p = await window.gsNative.pickFolder(); if (!p) return null;
  toast('Opening ' + p.name + '…');
  const r = await window.gsNative.readFolder(); if (!r) return null;
  if (r.error) { toast(r.error === 'perm' ? 'macOS didn’t let Grading Studio open that folder. Allow it in System Settings → Privacy & Security → Files and Folders.' : 'Couldn’t open that folder: ' + r.error, 8000); return null; }
  if (!r.files.length) { toast('No files found in ' + r.name, 6000); return null; }
  return r.files.map(f => { const file = new File([f.data], f.rel.split('/').pop(), { lastModified: f.mtime }); Object.defineProperty(file, 'webkitRelativePath', { value: r.name + '/' + f.rel }); return file; });
}
// A folder for one of the folder inputs: the web picker, or macOS's own in the Mac app.
function pickDir(sel) {
  if (!window.gsNative) return $(sel).click();
  nativeFolder().then(fs => { if (fs) $(sel).onchange({ target: { files: fs, value: '' } }); }, e => toast('Couldn’t open that folder: ' + (e.message || e), 8000));
}
function pickMany(folder) {
  if (folder && window.gsNative) return nativeFolder().then(fs => fs ? expandPicked(fs) : new Promise(() => {}), e => { toast('Couldn’t open that folder: ' + (e.message || e), 8000); return new Promise(() => {}); });
  return new Promise(res => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true;
    if (folder) inp.webkitdirectory = true;
    inp.onchange = async () => res(await expandPicked([...inp.files]));
    inp.click();
  });
}
// Files or folder? Then hands the files on.
function askFilesOrFolder(title, text, then) {
  openDlg('<div class="bh"><h2>' + esc(title) + '</h2><button class="icon" data-cancel aria-label="Close">✕</button></div><div class="bb"><p style="margin:0">' + text + '</p></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn" data-pf>Files or a ZIP…</button><button class="btn primary" data-pd>A whole folder…</button></div>', true);
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    const pf = e.target.closest('[data-pf]'), pd = e.target.closest('[data-pd]');
    if (!pf && !pd) return;
    closeDlg();
    const list = await pickMany(!!pd);
    if (!list.length) return toast('No files found there');
    then(list);
  };
}
// Best match among people, each given as one or more lists of name words. Same scoring as Bring in files.
function guessAmong(path, people) {
  const fw = new Set(nameWords(path.replace(/\.[^./]+$/, '')).filter(x => !SORT_STOP.has(x)));
  let best = [], bestScore = 0;
  people.forEach((lists, i) => {
    let sc = 0;
    for (const ws0 of lists) {
      const ws = ws0.filter(x => x.length >= 2 || /[^\x00-\x7f]/.test(x) || /^\d+$/.test(x)); if (!ws.length) continue;
      const hit = ws.filter(x => fw.has(x)).length;
      sc = Math.max(sc, hit === ws.length && hit >= 2 ? 100 + hit : hit);
      if (ws.some(x => /^\d{4,}$/.test(x) && fw.has(x))) sc = Math.max(sc, 150);   // a student ID number in the file name
    }
    if (sc > bestScore) { bestScore = sc; best = [i]; } else if (sc === bestScore && sc > 0) best.push(i);
  });
  if (best.length !== 1 || !bestScore) return { i: -1, sure: false };
  return { i: best[0], sure: bestScore >= 2 };
}
// Outside files with no ManageBac download: match them to a roster and open them as a new download.
function matchToRoster(list, assignment) {
  let c = assignment && assignment.classId ? classById(assignment.classId) : (lib.classes.find(k => k.names.length) || null);
  let rows = [];
  const guess = () => { const names = c ? c.names : []; rows = list.map(e => ({ e, ...guessAmong(e.path, names.map(n => [nameWords(n)])) })); };
  guess();
  const render = () => {
    const names = c ? c.names : [];
    const opts = i => '<option value="-1"' + (i < 0 ? ' selected' : '') + '>Choose a student…</option>' + names.map((n, k) => '<option value="' + k + '"' + (k === i ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '<option value="-2"' + (i === -2 ? ' selected' : '') + '>Skip this file</option>';
    const n = rows.filter(r => r.i >= 0).length, who = new Set(rows.filter(r => r.i >= 0).map(r => r.i)).size;
    const missing = names.filter((_, k) => !rows.some(r => r.i === k));
    openDlg('<div class="bh"><h2>Match files to students</h2><span class="muted">' + list.length + (list.length === 1 ? ' file' : ' files') + '</span><button class="icon" data-close aria-label="Close" style="margin-left:auto">✕</button></div>' +
      '<div class="bb"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><label style="display:flex;gap:6px;align-items:center;font-weight:500">Class <select class="btn" id="mrCls">' +
        lib.classes.map(k => '<option value="' + k.id + '"' + (c && c.id === k.id ? ' selected' : '') + '>' + esc(k.name) + ' (' + k.names.length + ')</option>').join('') + '</select></label>' +
        '<span class="muted" style="font-size:13px">Matched by the names in the file and folder names. Check the ones marked “Check” or “Choose”.</span></div>' +
      (names.length ? '<table class="gl"><thead><tr><th>File</th><th>Student</th><th></th></tr></thead><tbody>' +
        rows.map((r, k) => '<tr><td style="overflow-wrap:anywhere">' + esc(r.e.path) + '</td><td><select class="btn" data-row="' + k + '" style="max-width:280px">' + opts(r.i) + '</select></td><td>' + sortTag(r) + '</td></tr>').join('') + '</tbody></table>'
        : '<p>Add a roster for this class first (Rosters, + Class on the start screen), then try again.</p>') +
      (missing.length && names.length ? '<p class="muted" style="font-size:13px;margin:10px 0 0">No file yet: ' + esc(missing.join(', ')) + '</p>' : '') + '</div>' +
      '<div class="bf"><button class="btn" data-close>Cancel</button><button class="btn primary" data-go' + (n ? '' : ' disabled') + '>Open ' + n + (n === 1 ? ' file' : ' files') + ' for ' + who + (who === 1 ? ' student' : ' students') + '</button></div>');
  };
  render();
  const box = $('#dlgBox');
  box.onchange = e => {
    if (e.target.id === 'mrCls') { c = classById(e.target.value); guess(); return render(); }
    const s = e.target.closest('[data-row]'); if (!s) return;
    Object.assign(rows[+s.dataset.row], { i: +s.value, sure: true, set: true }); render();
  };
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (!e.target.closest('[data-go]')) return;
    const used = new Set(), entries = [];
    for (const r of rows) if (r.i >= 0) {
      const base = c.names[r.i].replace(/[\\/:*?"<>|]+/g, ' ').trim() + '/' + r.e.path.split('/').pop();
      let p = base, k = 2; while (used.has(p.toLowerCase())) p = base.replace(/(\.[^./]+)?$/, ' (' + k++ + ')$1');
      used.add(p.toLowerCase()); entries.push({ path: p, file: r.e.file });
    }
    closeDlg();
    await intake(entries, (assignment && assignment.name) || 'Matched files', assignment || null);
    if (batch) { batch.classId = c.id; renderClassSel(); saveNow(); renderList(); }
  };
}

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
  if (!batch.students.find(s => s.key === names[3])) { const st0 = batch.students[cur]; batch.students.splice(3, 0, { key: names[3], files: [], grade: { rubric: [], points: '', comment: '' } }); restore(); rosterSort(); cur = Math.max(0, batch.students.indexOf(st0)); renderList(); $('#batchName').textContent = batch.name + ' · ' + batch.students.length + ' students'; }
}

/* ---------------- wiring ---------------- */
let toastT;
function toast(msg, ms) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 3000);
}
$('#pickFiles').onclick = () => $('#fileIn').click();
$('#pickFolder').onclick = () => pickDir('#dirIn');
$('#pickDrive').onclick = () => openFromDrive(null);
$('#sample').onclick = makeSample;
let scanFor = null;
let scanInto = false;
$('#pickScan').onclick = () => { scanFor = null; scanInto = false; $('#scanIn').click(); };
$('#pickMatch').onclick = () => askFilesOrFolder('Match files to a roster', 'For files that aren’t a ManageBac download, like rubrics you marked outside Grading Studio. Each file is matched to a student on your roster by the name in its file name or folder name, and you can fix any match.', list => matchToRoster(list, null));
$('#scanIn').onchange = e => { const f = e.target.files[0]; e.target.value = ''; const into = scanInto && !!batch; scanInto = false; if (f) openSplit(f, scanFor, into); };
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
// With a download open, files dropped on the paper or on a student's name are added to that student.
let dropEl = null;
const setDropEl = el => { if (dropEl === el) return; if (dropEl) dropEl.classList.remove('drop-on'); dropEl = el; if (el) el.classList.add('drop-on'); };
const hasFiles = e => !!e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
const dropTarget = e => {
  if (!e.target.closest) return null;
  const s = e.target.closest('.stu'); if (s) return { el: s, i: +s.dataset.i };
  const p = e.target.closest('#paper'); return p ? { el: p, i: cur } : null;
};
document.addEventListener('dragover', e => {
  if (!batch || ldrag || !hasFiles(e)) return;
  e.preventDefault();   // never let a dropped file replace the page
  const t = $('#dlg').hidden ? dropTarget(e) : null;
  setDropEl(t && t.el); e.dataTransfer.dropEffect = t ? 'copy' : 'none';
});
document.addEventListener('dragleave', e => { if (batch && !e.relatedTarget) setDropEl(null); });
document.addEventListener('drop', async e => {
  if (!batch || !hasFiles(e)) return;
  e.preventDefault(); setDropEl(null);
  const t = $('#dlg').hidden ? dropTarget(e) : null; if (!t) return;
  const onName = t.el.classList.contains('stu');
  const r = await entriesFromDrop(e.dataTransfer);
  if (!onName && r.list.length > 1) return bringIn(r.list);
  addFiles(batch.students[t.i], r.list);
});
$('#trAllBtn').onclick = openTranscripts;
$('#dispBtn').onclick = openDisplay;
// Side panels fold away to give the paper more room; remembered in this browser. [ and ] also fold them.
function setPanels(L, R) {
  const c = $('#cols'); c.classList.toggle('noL', !!L); c.classList.toggle('noR', !!R);
  $('#colL').querySelector('.pa').textContent = L ? '›' : '‹'; $('#colR').querySelector('.pa').textContent = R ? '‹' : '›';
  $('#colL').title = L ? 'Show the student list ( [ )' : 'Hide the student list ( [ )'; $('#colR').title = R ? 'Show the score panel ( ] )' : 'Hide the score panel ( ] )';
  store.set('gs.panels', { L: !!L, R: !!R });
  clearTimeout(resizeT); resizeT = setTimeout(() => pages.forEach(renderPage), 60);
}
const panelsNow = () => ({ L: $('#cols').classList.contains('noL'), R: $('#cols').classList.contains('noR') });
$('#colL').onclick = () => { const p = panelsNow(); setPanels(!p.L, p.R); };
$('#colR').onclick = () => { const p = panelsNow(); setPanels(p.L, !p.R); };
{ const p = store.get('gs.panels', {}); setPanels(p.L, p.R); }
$('#lightBtn').onclick = openLight;
$('#calcBtn').onclick = openCalc;
$('#bringBtn').onclick = () => {
  askFilesOrFolder('Bring in files', 'Each file goes to its student by the name in its file name or folder name, for example your marked rubrics. You check the matches before anything is added.<br><br><b>A scan of papers</b> (like a makeup day): split it page by page onto names, and each student’s pages are added to them here.', bringIn);
  $('#dlgBox .bf').insertAdjacentHTML('afterbegin', '<button class="btn" data-scanin style="margin-right:auto">A scan to split…</button>');
  const box = $('#dlgBox'), was = box.onclick;
  box.onclick = e => { if (e.target.closest('[data-scanin]')) { closeDlg(); scanInto = true; return $('#scanIn').click(); } return was(e); };
};
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
  $('#app').hidden = true; $('#start').hidden = false; $('#paper').innerHTML = ''; renderLib(); loadKept();
};
document.addEventListener('keydown', e => {
  if (!batch || !$('#dlg').hidden) { if (e.key === 'Escape' && !$('#dlg').hidden && !SP) closeDlg(); return; }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) || (document.activeElement && document.activeElement.isContentEditable);
  const cmd = e.metaKey || e.ctrlKey, key = e.key.toLowerCase();
  if (cmd && !typing && !e.altKey) {
    if (key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (key === 'y') { e.preventDefault(); redo(); return; }
    if (key === '=' || key === '+') { e.preventDefault(); setZoom(zoom + 0.15); return; }
    if (key === '-' || key === '_') { e.preventDefault(); setZoom(zoom - 0.15); return; }
    if (key === '0') { e.preventDefault(); setZoom(1); return; }
    if (key === 'c' && selected && !String(getSelection())) { e.preventDefault(); copyMark(); return; }
    if (key === 'v' && markClip) { e.preventDefault(); pasteMark(); return; }
    if (key === 'd' && selected) { e.preventDefault(); copyMark(true); pasteMark(); return; }
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '?') { e.preventDefault(); openKeys(); return; }
  if (e.key === '/') { e.preventDefault(); $('#stuFind').focus(); return; }
  // A picked mark moves with the arrow keys (Shift for bigger steps); Esc lets go of it.
  if (selected && /^Arrow/.test(e.key)) {
    e.preventDefault();
    const d = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
    const pg = selected.page;
    if (!e.repeat || !nudging) { snap(pg); nudging = true; }
    moveMark(selected.mark, dx, dy); if (selected.mark.t === 'text') keepOnPage(selected.mark, pg.W, pg.H);
    changed(pg); return;
  }
  if (curMedia && curMedia.isConnected) {
    if (e.key === ' ') { e.preventDefault(); curMedia.paused ? curMedia.play().catch(() => {}) : curMedia.pause(); return; }
    if (e.key.toLowerCase() === 'j') { curMedia.currentTime = Math.max(0, curMedia.currentTime - 5); return; }
    if (e.key.toLowerCase() === 'l') { curMedia.currentTime += 5; return; }
  }
  const map = { v: 'select', p: 'pen', h: 'hl', o: 'oval', t: 'text', c: 'note', k: 'check', e: 'erase' };
  if (map[e.key.toLowerCase()]) { setTool(map[e.key.toLowerCase()]); return; }
  if (e.key.toLowerCase() === 'n') { nextUnscored(); return; }
  if (e.key === '=') { e.preventDefault(); if ($('#calcPanel')) $('#calcIn').focus(); else openCalc(); return; }
  if (e.key === '[' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); const p = panelsNow(); return setPanels(!p.L, p.R); }
  if (e.key === ']' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); const p = panelsNow(); return setPanels(p.L, !p.R); }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); stepStudent(1); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); stepStudent(-1); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); deleteSelected(); }
  if (e.key === 'Escape' && selected) { selected = null; redrawAll(); }
});
let nudging = false;
document.addEventListener('keyup', e => { if (/^Arrow/.test(e.key)) nudging = false; });
window.addEventListener('beforeunload', saveNow);
applyDisp();
renderLib(); renderGoogle(); loadKept();
/* ---------------- backup: everything this browser keeps, in one file, to carry to another link or computer ---------------- */
// Browsers keep a site's storage per address, so the Netlify link, the offline file and the claude.ai copy each have
// their own. A backup holds the downloads (papers and work), added files, Word edits, units, rosters and settings.
async function storeDump(open, name) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(name, 'readonly'), o = tx.objectStore(name), out = {};
    const a = o.getAll(), b = o.getAllKeys();
    tx.oncomplete = () => { out.v = a.result || []; out.k = b.result || []; res(out); }; tx.onerror = () => rej(tx.error);
  });
}
async function makeBackup() {
  toast('Making the backup…');
  const bins = [], files = {};
  // Byte arrays go in the ZIP as their own files; the rest is JSON.
  const pack = v => {
    if (v instanceof Uint8Array || v instanceof ArrayBuffer) { const u = v instanceof Uint8Array ? v : new Uint8Array(v); bins.push(u); return { __bin: bins.length - 1 }; }
    if (Array.isArray(v)) return v.map(pack);
    if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = pack(x); return o; }
    return v;
  };
  const ls = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('gs.') && k !== 'gs.syncT') ls[k] = localStorage.getItem(k); }
  const keep = {};
  for (const n of ['papers', 'work', 'meta', 'edits']) { try { keep[n] = pack(await storeDump(keepDb, n)); } catch { keep[n] = { v: [], k: [] }; } }
  let added = { v: [], k: [] }; try { added = pack(await storeDump(addDb, 'files')); } catch {}
  const info = { app: 'Grading Studio', v: 1, t: Date.now(), from: location.origin === 'null' ? 'offline file' : location.host, downloads: keep.meta.v.length };
  files['backup.json'] = new TextEncoder().encode(JSON.stringify({ info, ls, keep, added }));
  bins.forEach((u, i) => { files['bin/' + i] = [u, { level: 0 }]; });
  const day = new Date().toISOString().slice(0, 10);
  await saveBlob('Grading Studio backup ' + day + '.zip', new Blob([fflate.zipSync(files)], { type: 'application/zip' }));
  store.set('gs.lastBackup', Date.now()); renderBackup();
}
async function restoreBackup(file) {
  let z, data;
  try { z = fflate.unzipSync(new Uint8Array(await file.arrayBuffer())); data = JSON.parse(new TextDecoder().decode(z['backup.json'])); } catch { return toast('That isn’t a Grading Studio backup'); }
  if (!data || !data.info || data.info.app !== 'Grading Studio') return toast('That isn’t a Grading Studio backup');
  const unpack = v => {
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && typeof v.__bin === 'number') return z['bin/' + v.__bin] || new Uint8Array(0);
    if (Array.isArray(v)) return v.map(unpack);
    if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = unpack(x); return o; }
    return v;
  };
  const n = data.info.downloads || 0;
  if (!confirm('Restore this backup from ' + new Date(data.info.t).toLocaleString() + ' (' + n + (n === 1 ? ' download' : ' downloads') + ')?\n\nIts downloads, marks and scores are added to this browser. Units, rosters and settings are replaced with the backup’s.')) return;
  toast('Restoring…');
  for (const [k, v] of Object.entries(data.ls || {})) {
    if (k.startsWith('gs.b.')) { const cur = store.get(k, null), bk = JSON.parse(v); if (cur && cur.t && bk && bk.t && cur.t > bk.t) continue; }   // keep the newer work
    try { localStorage.setItem(k, v); } catch {}
  }
  const put = async (open, name, d) => {
    const db = await open(), recs = unpack(d);
    await new Promise((res, rej) => { const tx = db.transaction(name, 'readwrite'), o = tx.objectStore(name); recs.k.forEach((k, i) => o.put(recs.v[i], k)); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  };
  try {
    for (const nm of ['papers', 'work', 'meta', 'edits']) if (data.keep && data.keep[nm]) await put(keepDb, nm, data.keep[nm]);
    if (data.added) await put(addDb, 'files', data.added);
  } catch (e) { console.error(e); return toast('This browser had no room for the whole backup'); }
  toast('Restored. Reloading…');
  setTimeout(() => location.reload(), 700);
}
function renderBackup() {
  const el = $('#backupInfo'); if (!el) return;
  const t = store.get('gs.lastBackup', 0);
  el.textContent = t ? 'Last backup: ' + new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No backup made from this link yet.';
  // A nudge once a week has gone by since the last backup, when there's work kept here.
  const due = keptMeta.size > 0 && Date.now() - t > 7 * 864e5;
  el.classList.toggle('due', due);
  if (due) el.textContent += t ? ' · It’s been over a week; a fresh backup keeps your work safe.' : ' A backup keeps your work safe if this browser is cleared.';
}
$('#backupBtn').onclick = makeBackup;
$('#restoreBtn').onclick = () => $('#restoreIn').click();
$('#restoreIn').onchange = () => { const f = $('#restoreIn').files[0]; $('#restoreIn').value = ''; if (f) restoreBackup(f); };
renderBackup();

window.__gs_pickMany = pickMany;
window.__gs = { wordScore, wordScoresAll, makeBackup, restoreBackup, fileSeq, moveFile, openMoveFile, calcEval, openCalc, pageLit, setPageLit, lightMenuDo, lightChips, ensureCounts, addRefs, refs: () => refFiles, matchToRoster, guessAmong, expandPicked, lightOpts, isRubricPage, openAnon, setAnon, anonOrder, anonOn, openLight, lightFor, lightAuto, openSplit, sp: () => SP, bringIn, sortGuess, openWord, wordBytes, reopenKept, forgetKept, kept: () => keptMeta, addFiles, removeAdded, nextUnscored, openDisplay, trimToInk, intake, parseGrade, scanFile, scanAll, state: () => ({ batch, cur, setup, pages }), gradeOf, percentFor, flattenDoc, exportPlan, layoutOf, docIn, openStudent, setTool };
