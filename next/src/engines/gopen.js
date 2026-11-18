// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, cur, setup, lib, pages, tr, keptMeta, saveSoon, pdfjsLib, PDFLib, fflate, workerReady, heicLoad, toast, store, kdo, kget, idbDo, pickedUpNew, groupNoteRefresh, SCALE12, rowTop, rowsMax, rowScaleOf, setupOver, maxPoints, gradeOf, xcSay, fmtNum, noScore, ibSetup } from './gcore.js';
import { rotOf, skewOf, viewable, fileByPath, draw, nameFold, rosterMatch, batchClass, WORD_RX, lostPages, one, stampHidden, tnHasG } from './gdraw.js';

// src/app/start.js
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
// src/app/open.js
const isPdf = n => /\.pdf$/i.test(n), isImg = n => /\.(png|jpe?g)$/i.test(n);
// src/app/open.js
const junk = p => /(^|\/)(__MACOSX|\.)/.test(p);
// src/app/open.js
const houseFile = p => /(^|\/)(Thumbs\.db|ehthumbs\.db|desktop\.ini|~\$[^/]*)$/i.test(p);
// src/app/open.js
function zipName(n) {
  if (!/[\u0080-\u00ff]/.test(n) || /[^\u0000-\u00ff]/.test(n)) return n;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(n, c => c.charCodeAt(0))); } catch { return n; }
}
// src/app/open.js
let zipSkipped = 0;
// src/app/open.js
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
// src/app/open.js
function rubricFitting(work, last) {
  let n = 0, pts = false;
  for (const r of Object.values(work.s || {})) {
    const g = (r && r.g) || {};
    (g.rubric || []).forEach((v, i) => { if (v != null && i >= n) n = i + 1; });
    if (g.points != null && g.points !== '') pts = true;
  }
  if (last.mode === 'points' ? pts || !n : n === last.criteria.length || (!n && !pts)) return null;
  if (!n) return { ...last, mode: 'points' };
  return { ...last, mode: 'rubric', criteria: Array.from({ length: n }, (_, i) => last.criteria[i] || 'Criterion ' + (i + 1)), levels: undefined };
}
// src/app/open.js
function revsBase(saved) {
  if (!saved) return saved;
  const w = { ...saved, s: { ...saved.s } };
  if (w.setup) w.setup = setupOver(w.setup);
  for (const st of batch.students) for (const f of st.files) {
    const r = w.s[st.key];
    if (f.edited && !(r && r.v) && !(r && r.e && r.e[f.path])) w.s[st.key] = { ...(r || { f: {}, g: st.grade, h: {} }), e: { ...(r && r.e), [f.path]: f.edited } };
  }
  return w;
}
// src/app/open.js
function groupRaw(raw) {
  const map = new Map();
  for (const r of raw) {
    if (/^Grade sheet - [^/]*\.pdf$/i.test(r.path)) continue;   // the grade sheet from an earlier export isn't a student
    const key = studentOf(r.path);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}
// src/app/open.js
const SRC_CANVAS = /^([^_\/A-Z\s]*[^_\/A-Z\s\d][^_\/A-Z\s]*)_(?:LATE_|late_)?(\d{3,})_(\d{3,})_[^\/]+$/, SRC_MOODLE = /^([^\/]+?)_(\d+)_assignsubmission_[a-z]+_(?:\/.+|[^\/]*)$/i;
// src/app/open.js
const SRC_GCLASS = /^([^\/]*[^\/\s\d][^\/]*?) - ([^\/]+?)(?:\.[^.\/]+)?$/;
// src/app/open.js
function srcClassroom(list) {
  const hits = list.map(r => [r, SRC_GCLASS.exec(r.path)]).filter(x => x[1] && !/\d{3,}/.test(x[1][1]) && x[1][1].trim().split(/\s+/).length <= 5);
  const whos = new Set(hits.map(x => nameFold(x[1][1].trim()))), titles = new Set(hits.map(x => nameFold(x[1][2].replace(/\s*\(\d+\)$/, '').trim())));
  if (hits.length < 2 || whos.size < 2 || titles.size * 2 > whos.size) return null;
  return new Map(hits.map(([r, m]) => [r.path, m[1].trim()]));
}
// src/app/open.js
let srcWho = new Map();   // path -> student, for the download being opened or open
// src/app/open.js
const plainStudent = path => { const parts = path.split('/').filter(Boolean); return parts.length > 1 ? parts[0] : parts[0].replace(/\.[^.]+$/, ''); };
// src/app/open.js
const studentOf = path => srcWho.get(path) || plainStudent(path);
// src/app/open.js
async function srcRead(raw) {
  srcWho = new Map();
  const list = raw.filter(r => !houseFile(r.path) && !/^Grade sheet - [^/]*\.pdf$/i.test(r.path));
  const rx = list.length >= 2 && [SRC_CANVAS, SRC_MOODLE].find(x => list.every(r => x.test(r.path)));
  const gcl = rx ? null : srcClassroom(list);
  if (!rx && !gcl) return;
  const id = batchIdOf(raw);   // as it would have opened before: with work saved that way, it stays that way
  if (store.get(id, null) || keptMeta.has(id) || await kget('work', id)) return;
  if (gcl) { srcWho = gcl; return; }
  const ids = new Map();   // two students whose names read the same are told apart by their number
  for (const r of list) { const m = rx.exec(r.path), n = m[1].trim(); if (!ids.has(n)) ids.set(n, new Set()); ids.get(n).add(m[2]); }
  if (ids.size < 2) return;   // one name for every file is a naming habit (IMG_2026_1110_…), not a class
  const who = new Map();
  for (const r of raw) { const m = rx.exec(r.path); if (m) who.set(r.path, ids.get(m[1].trim()).size > 1 ? m[1].trim() + ' ' + m[2] : m[1].trim()); }
  srcWho = who;
}
// src/app/open.js
function batchIdOf(raw) {
  const map = groupRaw(raw), size = r => r.data ? r.data.length : r.file ? r.file.size : 0;
  return 'gs.b.' + hash([...map.keys()].sort(natural).map(k => map.get(k).sort((a, b) => natural(a.path, b.path)).map(r => r.path + ':' + size(r)).join('|')).join('/'));
}
// src/app/open.js
async function spellLikeSaved(raw) {
  if (raw.every(r => r.path === r.path.normalize('NFC') && r.path === r.path.normalize('NFD'))) return;
  const one = raw.map(r => ({ ...r, path: r.path.normalize('NFC') }));
  if (new Set(one.map(r => r.path)).size < new Set(raw.map(r => r.path)).size || groupRaw(one).size < groupRaw(raw).size) return;
  for (const form of [null, 'NFC', 'NFD']) {
    const id = batchIdOf(raw.map(r => ({ ...r, path: form ? r.path.normalize(form) : r.path })));
    if (store.get(id, null) || keptMeta.has(id) || await kget('work', id)) { if (form) for (const r of raw) r.path = r.path.normalize(form); return; }
  }
  for (const r of raw) r.path = r.path.normalize('NFC');
}
// src/app/open.js
async function makeFile(path, data) {
  const name = path.split('/').pop();
  const magic = data && data.length > 4 && data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46;   // "%PDF"
  let kind = trueKind(isPdf(name) || magic ? 'pdf' : isImg(name) || IMG_MORE.test(name) ? 'img' : MEDIA_RX.test(name) ? 'media' : WORD_RX.test(name) ? 'docx' : TEXT_RX.test(name) ? 'text' : LINK_RX.test(name) && (linkOf(data) || vidRef(data)) ? 'link' : 'other', name, data);
  let pdf = kind === 'pdf' ? data : null;
  if (kind === 'pdf' && gsExportLike(data)) {   // a file exported from here with its marks kept: back to the original pages and the marks
    const back = await unpackExport(data);
    if (back) return { path, name, kind, data: back.data, size: data.length, marks: back.marks, rot: back.rot, skew: back.skew, noauto: true, pages: null };
  }
  let pic = null;
  if (kind === 'img') { try { pic = await pictureToPdf(data, name); pdf = pic.pdf; if (pic.hurt) kind = 'other'; } catch { kind = 'other'; } }
  return { path, name, kind, data: kind === 'pdf' || kind === 'img' ? pdf : data, size: data ? data.length : 0, marks: {}, pages: null, photoTurn: (pic && pic.turn) || 0, was: !!(pic && pic.was), hurt: !!(pic && pic.hurt) };
}
// src/app/open.js
const GS_TAIL = '%GradingStudio-editable';
// src/app/open.js
const hasGsTail = d => !!d && d.length > 64 && new TextDecoder().decode(d.subarray(d.length - 64)).includes(GS_TAIL);
// src/app/open.js
const hasAttached = d => !!d && d.length > 64 && new TextDecoder('latin1').decode(d).includes('/EmbeddedFile');
// src/app/open.js
const gsExportLike = d => hasGsTail(d) || hasAttached(d);
// src/app/open.js
const markFits = m => !!m && typeof m === 'object' && ['pen', 'hl', 'text', 'check', 'oval', 'note', 'stamp'].includes(m.t) && (m.t !== 'stamp' || (typeof m.k === 'string' && isFinite(m.x) && isFinite(m.y))) && (m.t !== 'pen' || Array.isArray(m.pts)) && (m.t !== 'text' || typeof m.text === 'string') && (m.t !== 'note' || (typeof m.text === 'string' && /^#[0-9a-f]{6}$/i.test(m.color))) && (m.t !== 'hl' || Array.isArray(m.pts) || Array.isArray(m.rects) || m.x != null);
// src/app/open.js
async function unpackExport(data) {
  try {
    await workerReady;
    const js = await pdfjsLib.getDocument({ data: data.slice(), isEvalSupported: false }).promise;
    const att = (await js.getAttachments()) || {}; js.destroy();
    const meta = att['grading-studio.json']; if (!meta) return null;
    const info = JSON.parse(new TextDecoder().decode(meta.content)), srcs = [], marks = {}, rot = {}, skew = {};
    info.pages.forEach(([, , m, r, k], i) => { const ok = Array.isArray(m) ? m.filter(markFits) : []; if (ok.length) marks[i] = ok; if (r) rot[i] = r; if (k) skew[i] = k; });
    const orig = k => att['gs-original-' + (k + 1) + '.pdf'].content;
    const one = info.pages.every(([s]) => s === 0) && info.pages.every(([, p], i) => p === i);
    if (one) {   // the whole original in order: kept exactly as it was
      const src = await PDFLib.PDFDocument.load(orig(0), { ignoreEncryption: true, updateMetadata: false });
      if (src.getPageCount() === info.pages.length) return { data: orig(0), marks, rot, skew };
    }
    const out = await PDFLib.PDFDocument.create();
    for (const [s, p] of info.pages) {
      srcs[s] ||= await PDFLib.PDFDocument.load(orig(s), { ignoreEncryption: true, updateMetadata: false });
      const [cp] = await out.copyPages(srcs[s], [p]); out.addPage(cp);
    }
    return { data: await out.save(), marks, rot, skew };
  } catch (e) { console.error(e); return null; }
}
// src/app/open.js
const IMG_MORE = /\.(gif|webp|bmp|heic|heif|tiff?|avif)$/i, TEXT_RX = /\.(txt|md|rtf)$/i;
// src/app/open.js
async function anyImageToPdf(bytes) {
  const bmp = await createImageBitmap(new Blob([bytes]));
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0);
  const jpg = await canvasJpg(c, 0.92);
  c.width = c.height = 0;
  return imageToPdf(jpg, 'page.jpg');
}
// src/app/open.js
async function imageToPdf(bytes, name) {
  const doc = await PDFLib.PDFDocument.create();
  const img = /\.png$/i.test(name) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  const W = 612, H = Math.round(W * img.height / img.width);
  doc.addPage([W, H]).drawImage(img, { x: 0, y: 0, width: W, height: H });
  return await doc.save();
}
// src/app/open.js
function hash(s) {
  let h1 = 0x811c9dc5, h2 = 0x1234567;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
// src/app/keep.js
function restore() {
  const data = newestWork(store.get(batch.id, null), batch.keptWork);
  if (!data) return;
  if (data.carry) batch.carry = data.carry;
  if (data.setup && data.setup.spot) setup.spot = data.setup.spot;
  batch.moved = data.moved || {};
  // Someone with no folder is only here because of the work on them: a paper that was moved to them, or a score, comment or status. They come back before anything is put on them.
  for (const [path, key] of Object.entries(batch.moved)) {
    if (!batch.students.some(s => s.key === key) && batch.students.some(s => s.files.some(f => f.path === path))) batch.students.push(gapStudent(key));
    moveFileNow(path, key);
  }
  for (const [key, s] of Object.entries(data.s)) if (gradeHasWork(s.g) && !batch.students.some(st => st.key === key)) batch.students.push(gapStudent(key));
  let n = 0;
  for (const st of batch.students) {
    const s = data.s[st.key]; if (!s) continue;
    if (s.o) st.forder = s.o;
    st.grade = { rubric: [], points: '', comment: '', ...s.g };
    for (const fl of st.files) { if (s.f[fl.path]) fl.marks = s.f[fl.path]; if (s.h && s.h[fl.path]) fl.hand = s.h[fl.path]; if (s.tr && s.tr[fl.path]) fl.tr = s.tr[fl.path]; if (s.r && s.r[fl.path]) fl.rot = s.r[fl.path]; if (s.sk && s.sk[fl.path]) fl.skew = s.sk[fl.path]; if (s.im && s.im[fl.path]) fl.imp = s.im[fl.path]; if (s.imn && s.imn.includes(fl.path)) fl.impNo = 1; }
    if (s.L) { st.layout = s.L.map(d => ({ ...d, pages: d.pages.filter(([path]) => st.files.some(f => f.path === path)) })); st.layoutOld = !s.Lp; }
    if (s.inc) st.inc = s.inc;
    n++;
  }
  batch.removed = data.removed || {};
  for (const [path, r] of Object.entries(batch.removed)) { if (r.back) continue; const st = batch.students.find(x => x.files.some(f => f.path === path)); if (st) goneNow(st, fileByPath(st, path)); }
  // A file moved on one computer and marked on the other: the marks follow the file.
  for (const [path, key] of Object.entries(batch.moved)) {
    const st = batch.students.find(x => x.key === key), fl = st && st.files.find(f => f.path === path);
    if (!fl || Object.values(fl.marks).some(a => a.length)) continue;
    for (const [k, r] of Object.entries(data.s)) if (k !== key && r.f && r.f[path]) { fl.marks = r.f[path]; break; }
  }
  scanRestore(data.scan);
  if (data.share) batch.share = data.share;
  if (data.read) batch.read = data.read;
  if (data.light) batch.light = data.light;
  if (data.lightOpt) batch.lightOpt = data.lightOpt;
  if (data.lightPg) batch.lightPg = data.lightPg;
  if (data.lightPgL) batch.lightPgL = data.lightPgL;
  if (data.anon) batch.anon = data.anon;
  if (data.refSkip) batch.refSkip = data.refSkip;
  if (data.quiz) batch.quiz = data.quiz;
  if (data.goal) batch.goal = data.goal;
  if (data.returned) batch.returned = data.returned;
  batch.groups = [...(data.groups || []), ...(data.groupsOwn || []).map(g => ({ ...g, own: g.own || 1 }))];
  batch.clips = data.clips || [];
  if (data.vrot) batch.vrot = data.vrot; else delete batch.vrot;
  groupSync();
  if (data.drive && !batch.drive) batch.drive = data.drive;
  batch.restoredCur = Math.min(data.cur || 0, batch.students.length - 1); batch.restoredKey = data.ck;
  if (n && pickedUpNew(batch.id)) setTimeout(() => { if (/^#\/a\//.test(location.hash)) toast('Picked up where you left off (' + n + (n === 1 ? ' student' : ' students') + ' started)'); }, 300);
}
// src/app/files.js
function moveFileNow(path, key) {
  const src = batch.students.find(s => s.files.some(f => f.path === path)), dst = batch.students.find(s => s.key === key);
  if (!src || !dst || src === dst || dst.files.some(f => f.path === path)) return null;
  const f = fileByPath(src, path);
  src.files.splice(src.files.indexOf(f), 1); dst.files.push(f);
  return { src, dst, f };
}
// src/app/paper.js
function setRot(f, p, r) { r = ((r % 360) + 360) % 360; coverTurn(f, p, r - rotOf(f, p)); f.rot ||= {}; if (r) f.rot[p] = r; else delete f.rot[p]; }
// src/app/paper.js
function setSkew(f, p, a) { f.skew ||= {}; if (a) f.skew[p] = a; else delete f.skew[p]; }
// src/app/panels.js
function critStampOf(st, i) {
  const v = st.grade.rubric[i]; if (v == null || i < 0 || i >= setup.criteria.length) return null;
  const ib = ibSetup() && setup.ib[i];
  return ib ? { of: ib, name: ib, text: fmtNum(v) } : { of: setup.criteria[i], name: setup.criteria[i], text: fmtNum(v) + '/' + rowTop(setup, i) };
}
// src/app/panels.js
const critRowOf = m => setup.mode !== 'rubric' ? -1 : ibSetup() ? setup.ib.indexOf(m.of) : setup.criteria.indexOf(m.of);
// src/app/panels.js
function scoreStampText(gr, st) {
  if (ibSetup()) return ibStampText(st || batch.students[cur]);
  const max = gr.outOf != null ? gr.outOf : maxPoints();
  // Extra credit goes on a line of its own under the score it was added to: "17/20 = 85% + 5% extra credit" (src/stamps.js draws the three lines).
  if (gr.xc && gr.base != null) return fmtNum(gr.base) + (max ? '/' + fmtNum(max) : '') + (gr.bpct != null ? ' = ' + gr.bpct + '%' : '') + ' + ' + xcSay(gr) + ' extra credit';
  return fmtNum(gr.total) + (max ? '/' + fmtNum(max) : '') + (gr.pct != null ? ' = ' + gr.pct + '%' : '');
}
// src/app/panels.js
function syncScoreStamps(st) {
  if (!st || noScore(st)) return false;
  const gr = gradeOf(st);
  const text = gr.total == null || gr.paper ? null : scoreStampText(gr, st);   // a score read off the paper itself isn't the app's own
  let changed = false;
  for (const f of st.files) {
    if (!f.marks || tryOfFile(st, f)) continue;
    for (const l of Object.values(f.marks)) for (const m of l || []) {
      if (m.t !== 'stamp' || stampHidden(m, st.key)) continue;
      if (m.k === 'score' && text != null && m.text !== text) { m.text = text; changed = true; }
      if (m.k === 'crit') { const c = critStampOf(st, critRowOf(m)); if (c && (m.text !== c.text || m.name !== c.name)) { m.text = c.text; m.name = c.name; changed = true; } }
    }
  }
  return changed;
}
// src/app/dialogs.js
const RUBRIC_NAME = 'Rubric page.pdf';
// src/app/dialogs.js
const rubricBytes = () => { const rp = setup.rubricPage; if (!rp) return null; const b64 = store.get('gs.rp.' + rp.id, null); if (!b64) return null; const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
// src/app/dialogs.js
async function applyRubricPage(only) {
  const bytes = rubricBytes(), rp = setup.rubricPage, isWord = !!rp && WORD_RX.test(rp.name || '');
  let n = 0;
  if (bytes && !isWord) { try { n = (await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount(); } catch {} }
  for (const st of only || batch.students) {
    const old = st.files.find(f => f.virtual);
    st.files = st.files.filter(f => !f.virtual);
    const real = st.files.filter(viewable);
    if (st.layout) for (const d of st.layout) d.pages = d.pages.filter(([path]) => !old || path !== old.path);
    if (bytes && isWord) {   // each student gets their own copy of her Word rubric, edited and returned like any Word file
      const any = st.files.find(f => f.path.includes('/')), dir = any ? any.path.slice(0, any.path.lastIndexOf('/') + 1) : st.key + '/';
      const name = rp.name.replace(/[\\/]+/g, '-'), mv = batch.moved || {}, path = old && old.path.endsWith('/' + name) && mv[old.path] === st.key ? old.path : dir + name, keep = old && old.kind === 'docx' && old.edited ? old : null;   // a copy that went with its score keeps its path, like any moved file. A copy she's worked on stays hers, even under a rubric with a new name
      if (mv[path] && mv[path] !== st.key) continue;   // this one went with its score to someone with no copy of their own
      const nf = { path, name: rp.name, kind: 'docx', data: keep ? keep.data : bytes, orig: keep ? bytes : null, edited: keep ? keep.edited : 0, size: bytes.length, marks: {}, virtual: true, rubric: true };   // its original is the rubric as it is now, so Back to the original starts her over on it
      st.files.push(nf);
      if (keep && await keepEdit(st, nf) && keep.path !== path) await dropEdit(st, keep);
      continue;
    }
    if (!bytes || !n) continue;
    // with nothing of theirs to sit in (only a video, or every page taken out), the rubric is a file of its own on the paper
    const any = real[0] || st.files.find(f => f.path.includes('/')) || (old && old.path.includes('/') ? old : null);
    const dir = any && any.path.includes('/') ? any.path.slice(0, any.path.lastIndexOf('/') + 1) : st.key + '/';
    const f = { path: dir + RUBRIC_NAME, name: 'Rubric page', kind: 'pdf', data: bytes, size: bytes.length, marks: old && old.path === dir + RUBRIC_NAME ? old.marks : {}, hand: old && old.hand, virtual: true, numPages: n };
    st.files.push(f);
    if (st.layout) {
      const pg = [...Array(n).keys()].map(p => [f.path, p]);
      if (st.layout.length) st.layout[0].pages = setup.rubricPos === 'start' ? pg.concat(st.layout[0].pages) : st.layout[0].pages.concat(pg);
      else st.layout.push({ name: f.name, file: f.path, pages: pg });
    }
  }
}
// src/app/claude.js
const boxKey = (path, p) => path + '|' + p;
// src/app/media.js
const MEDIA_RX = /\.(mp4|mov|m4v|webm|mkv|3gp|mp3|m4a|wav|aac|ogg|oga|opus|flac|weba|aif|aiff|caf|amr)$/i;
// src/app/readings.js
const REF_KEY = '\u0001reading';   // can't be a student's folder name
// src/app/readings.js
let refFiles = [];   // [{ path, name, data, for }]: for = a student's key when the file is only for that student
// src/app/readings.js
async function loadRefs() {
  refFiles = [];
  let recs = [];
  try { recs = (await idbDo('readonly', o => o.getAll(underId(batch.id)))) || []; } catch { return; }
  for (const r of recs.filter(r => r.bid === batch.id && r.key === REF_KEY).sort((a, b) => a.added - b.added)) refFiles.push({ path: r.path, name: r.name, data: r.data, for: r.for || '' });
}
// src/app/library.js
const holders = () => lib.classes.concat([lib.loose]);
// src/app/library.js
const findItem = id => { for (const c of holders()) for (const u of c.units) { const it = u.items.find(x => x.id === id); if (it) return { c, u, it }; } return null; };
// src/app/screens.js
const gapStudent = (key, s) => ({ key, files: [], grade: { rubric: [], points: '', comment: '', ...(s && s.g) }, layout: null, inc: (s && s.inc) || {}, gap: true });
// src/app/screens.js
function rosterSort() {
  if (!batch) return;
  let c = batchClass();
  if (!c && batch.classId !== '') {
    let best = null, bn = 0;
    for (const k of lib.classes) if (k.names.length) { const n = rosterMatch(k.names).size; if (n > bn) { bn = n; best = k; } }
    if (best && bn >= Math.max(2, batch.students.length / 2)) { c = best; batch.classId = best.id; }
  }
  // Everyone on the roster is in the list, even with nothing turned in yet; their paper can be added from their name.
  // A roster place-holder goes away if the roster changes, unless it has a file, score, comment or status: then it stays in the list, as not on the roster.
  batch.students = batch.students.filter(st => !(st.gap && !st.files.length && !gradeHasWork(st.grade) && !(c && c.names.includes(st.key))));
  if (c && c.names.length) {
    let have = rosterMatch(c.names);
    // an empty spot another folder now fills
    const spare = batch.students.filter(st => st.gap && !st.files.length && !gradeHasWork(st.grade) && have.has(st.key) && have.get(st.key) !== st);
    if (spare.length) { batch.students = batch.students.filter(st => !spare.includes(st)); have = rosterMatch(c.names); }
    const saved = newestWork(store.get(batch.id, null), batch.keptWork);
    for (const nm of c.names) if (!have.has(nm)) {
      const s = saved && saved.s && saved.s[nm];
      batch.students.push(gapStudent(nm, s));
    }
  }
  const byFolder = [...batch.students].sort((a, b) => natural(a.key, b.key));
  if (!c || !c.names.length) { batch.students = byFolder; return; }
  batch.students = byFolder;
  const m = rosterMatch(c.names), used = new Set(c.names.filter(n => m.has(n)).map(n => m.get(n)));
  batch.students = [...used].concat(byFolder.filter(st => !used.has(st)));
}
// src/app/kept.js
const underId = id => IDBKeyRange.bound(id + '|', id + '|\uffff');
// src/app/kept.js
async function keptBytes(id, i, e) {
  if (e.parts == null) return e.data || null;
  const out = new Uint8Array(e.size);
  for (let n = 0, at = 0; n < e.parts; n++) {
    const part = await kdo('papers', 'readonly', o => o.get(id + '|' + i + '|' + n));
    if (!part) throw new Error('A piece of a kept file is missing: ' + e.path);
    out.set(part, at); at += part.length;
  }
  return out;
}
// src/app/kept.js
async function paperGet(id) {
  const rec = await kget('papers', id);
  if (!rec || !rec.entries || !rec.entries.some(e => e.parts != null)) return rec;
  try {
    const entries = [];
    for (let i = 0; i < rec.entries.length; i++) entries.push({ path: rec.entries[i].path, data: await keptBytes(id, i, rec.entries[i]) });
    return { ...rec, entries };
  } catch (e) { console.error(e); return null; }
}
// src/app/kept.js
function cardOfKept(id) {
  const m = keptMeta.get(id), f = m && m.asg ? findItem(m.asg) : null;
  if (f) return f.it;
  for (const c of holders()) for (const u of c.units) { const it = u.items.find(x => x.batchId === id); if (it) return it; }
  return null;
}
// src/app/kept.js
async function loadAdded() {
  let recs = [];
  try { recs = (await idbDo('readonly', o => o.getAll(underId(batch.id)))) || []; } catch { return; }
  // readings sit in the same store, and aren't a student
  for (const r of recs.filter(r => r.bid === batch.id && r.key !== REF_KEY).sort((a, b) => a.added - b.added)) {
    let st = batch.students.find(s => s.key === r.key);
    // added from a later scan
    if (!st) { st = { key: r.key, files: [], grade: { rubric: [], points: '', comment: '' }, layout: null, inc: {} }; batch.students.push(st); }
    if (st.files.some(f => f.path === r.path)) continue;
    const f = await makeFile(r.path, r.data); f.added = r.added; f.akey = r.key; if (r.from) f.from = r.from; st.files.push(f);
  }
}
// src/app/replace.js
function goneNow(st, f) {
  if (!f) return;
  st.files.splice(st.files.indexOf(f), 1); (st.gone ||= []).push(f);
  if (st.layout) { st.layout = st.layout.map(d => ({ ...d, pages: d.pages.filter(([q]) => q !== f.path) })).filter(d => d.pages.length); if (!st.layout.length) st.layout = null; }
  if (st.forder) st.forder = st.forder.filter(x => x !== 'f:' + f.path);
}
// src/app/word.js
async function keepEdit(st, f) {
  try { await kdo('edits', 'readwrite', o => o.put({ data: f.data, orig: f.orig || null, t: f.edited }, batch.id + '|' + f.path)); saveSoon(); return true; }
  catch { toast('This browser couldn’t keep your edit. Download the file to keep it.'); }
}
// src/app/word.js
async function dropEdit(st, f) { try { await kdo('edits', 'readwrite', o => o.delete(batch.id + '|' + f.path)); noteGone(batch, EDIT_OFF + f.path); saveSoon(); } catch {} }
// src/app/word.js
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
  // Highlights on a rubric that was replaced under a new name on the other computer: kept, but no file here shows them, so she's told. Their scores stay.
  const b0 = batch, lost = new Set();
  for (const k of keys) {
    const path = k.slice(b0.id.length + 1);
    if (b0.students.some(st => st.files.some(x => x.path === path))) continue;
    const st = b0.students.find(st => path.startsWith(st.key + '/'));
    if (st && st.files.some(f => f.virtual && f.kind === 'docx')) lost.add(st.key);
  }
  if (lost.size) setTimeout(() => { if (batch === b0) toast('A highlighted copy of an older rubric is kept for ' + lost.size + (lost.size === 1 ? ' student' : ' students') + ', but this rubric doesn’t show it. Their scores stay, so check them against this rubric.', 12000); }, 1200);
}
// src/grades.js
const hasSheet = g => g.sheet != null && g.sheet !== '';
// src/grades.js
const gradeHasWork = g => !!g && ((g.rubric || []).some(v => v != null) || (g.points != null && g.points !== '') || (g.pk != null && g.pk !== '') || hasSheet(g) || !!g.comment || !!g.status || !!g.fb || !!+g.xc || tnHasG(g));
// src/grades.js
const stampWait = new Set();
// src/grades.js
function stampSoon(st) {
  if (stampWait.has(st)) return;
  stampWait.add(st);
  setTimeout(() => {
    stampWait.delete(st);
    if (!batch || !batch.students.includes(st) || !syncScoreStamps(st)) return;
    if (st === batch.students[cur]) for (const pg of pages) draw(pg);
    saveSoon();
  }, 0);
}
// src/grades.js
function tryOfFile(st, f) {
  const ts = st && st.grade && st.grade.tries; if (!ts || !ts.length || !f) return 0;
  const i = ts.findIndex(t => (t.files || []).includes(f.path));
  return i < 0 ? 0 : i + 1;
}
// src/saving.js
const newestWork = (a, b) => !a ? b || null : !b ? a : (b.t || 0) > (a.t || 0) ? b : a;
// src/carryover.js
const nfc = s => String(s).normalize('NFC');
// src/carryover.js
const sameBytes = (a, b) => { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
// src/carryover.js
const rubricNamed = (d, path) => { const rp = d.setup && d.setup.rubricPage, base = path.split('/').pop(); return base === RUBRIC_NAME || (!!rp && !!rp.name && base === rp.name.replace(/[\\/]+/g, '-')); };
// src/carryover.js
function compareFiles(oldList, newList) {
  const byPath = new Map(newList.map(e => [nfc(e.path), e])), map = {}, flags = {}, used = new Set(), goneFiles = [];
  let same = 0, named = 0;
  const left = [];
  for (const o of oldList) {
    const n = byPath.get(nfc(o.path));
    if (!n) { left.push(o); continue; }
    used.add(n); map[o.path] = n.path; named++;
    if (sameBytes(o.data, n.data)) same++; else flags[n.path] = 'changed';
  }
  for (const o of left) {
    const n = newList.find(e => !used.has(e) && nfc(studentOf(e.path)) === nfc(studentOf(o.path)) && sameBytes(o.data, e.data));
    if (n) { used.add(n); map[o.path] = n.path; same++; } else goneFiles.push(o.path);
  }
  for (const n of newList) if (!used.has(n)) flags[n.path] = 'new';
  return { map, flags, goneFiles, same, named, nOld: oldList.length, nNew: newList.length };
}
// src/carryover.js
function compareNames(d, newList) {
  const byPath = new Map(newList.map(e => [nfc(e.path), e])), map = {}, goneFiles = [];
  let named = 0;
  for (const s of Object.values(d.s)) for (const part of [s.f, s.h, s.tr, s.r, s.sk]) for (const path of Object.keys(part || {})) {
    if (path in map || goneFiles.includes(path)) continue;
    const n = byPath.get(nfc(path));
    if (n) { map[path] = n.path; named++; } else if (!rubricNamed(d, path)) goneFiles.push(path);
  }
  return { map, flags: {}, goneFiles, same: 0, named, nOld: named + goneFiles.length, nNew: newList.length, unchecked: true };
}
// src/carryover.js
function matchLevel(c, linked) {
  const small = Math.max(1, Math.min(c.nOld, c.nNew));
  if (linked) return 2;
  if (c.unchecked) return c.named > 0 && c.named * 2 >= c.nOld ? 1 : 0;
  if (c.same * 2 >= small) return 2;
  return c.same || c.named * 2 >= small ? 1 : 0;
}
// src/carryover.js
const mapBoxes = (o, map) => { if (!o) return o; const out = {}; for (const [k, v] of Object.entries(o)) { const at = k.lastIndexOf('|'), p = k.slice(0, at); out[(map[p] || p) + k.slice(at)] = v; } return out; };
// src/carryover.js
const mapLit = (o, map) => { if (!o) return o; const out = {}; for (const [k, v] of Object.entries(o)) { const a = k.indexOf('|'), b = k.lastIndexOf('|'), p = k.slice(a + 1, b); out[k.slice(0, a + 1) + (map[p] || p) + k.slice(b)] = v; } return out; };
// src/carryover.js
const mapPaths = (o, map) => { if (!o) return o; const out = {}; for (const [p, v] of Object.entries(o)) if (map[p]) out[map[p]] = v; return out; };
// src/carryover.js
function carryRoster({ d }) {
  const carry = batch.carry;
  carry.goneStudents = carry.goneStudents.filter(key => {
    const st = rosterMatch([key]).get(key);
    if (!st || !st.gap || st.files.length) return true;
    st.grade = { ...st.grade, ...d.s[key].g };
    batch.keptWork.s[st.key] = { f: {}, g: st.grade, h: {} };
    return false;
  });
}
// src/exportreport.js
const canvasJpg = (c, q) => new Promise((res, rej) => c.toBlob(b => { if (!b) { const er = new Error('page too big'); er.name = 'PageTooBig'; return rej(er); } b.arrayBuffer().then(x => res(new Uint8Array(x)), rej); }, 'image/jpeg', q));
// src/rubrics.js
const PCT_TENS = [90, 80, 70, 60], PCT_FIVES = [95, 90, 85, 80, 75, 70, 65, 60];
// src/rubrics.js
let pv = { late: true, out: false, part: false, mid: 'mean', target: 70, band: '10', cuts: PCT_TENS.slice(), add: 0, sort: 'pct', dir: -1 };
// src/intake.js
function realType(d) {
  if (!d || !d.length) return 'empty';
  const at = (i, s) => { for (let k = 0; k < s.length; k++) if (d[i + k] !== s.charCodeAt(k)) return false; return true; };
  if (at(0, '%PDF')) return 'pdf';
  if (d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff) return 'jpeg';
  if (at(0, '\x89PNG')) return 'png';
  if (at(0, 'GIF8')) return 'gif';
  if (at(0, 'RIFF') && at(8, 'WEBP')) return 'webp';
  if (at(0, 'BM')) return 'bmp';
  if (at(0, 'II*\0') || at(0, 'MM\0*')) return 'tiff';
  if (at(4, 'ftyp')) { const b = String.fromCharCode(d[8], d[9], d[10], d[11]); return /^(hei[cxms]|hev[cxms]|mif1|msf1)$/.test(b) ? 'heic' : /^avi[fs]$/.test(b) ? 'avif' : ''; }
  if (at(0, 'PK\x03\x04')) return 'zip';
  if (at(0, '\xd0\xcf\x11\xe0')) return 'ole';   // an old Office file, or a new one locked with a password
  if (at(0, '{\\rtf')) return 'rtf';
  if (/^(\xef\xbb\xbf)?\s*<(!doctype html|html)/i.test(String.fromCharCode(...d.subarray(0, 40)))) return 'html';
  return '';
}
// src/intake.js
const textBytes = d => { if (!d) return false; for (let i = 0; i < Math.min(d.length, 512); i++) if (d[i] < 9 || (d[i] > 13 && d[i] < 27)) return false; return true; };
// src/intake.js
function trueKind(kind, name, data) {
  if (kind === 'text' && textBytes(data)) return kind;   // notes that happen to begin "BMW" or "GIF89a is": a real picture has bytes no text file has
  const real = realType(data);
  if (/^(jpeg|png|gif|webp|bmp|heic|avif)$/.test(real)) return 'img';
  if (real === 'rtf' && /\.(doc|rtf|txt)$/i.test(name)) return 'text';
  if (real === 'zip' && /\.doc$/i.test(name)) { try { if (fflate.unzipSync(data, { filter: x => x.name === 'word/document.xml' })['word/document.xml']) return 'docx'; } catch {} }
  return kind;
}
// src/intake.js
const picReads = d => createImageBitmap(new Blob([d])).then(b => { b.close(); return true; }, () => false);
// src/intake.js
async function pictureToPdf(data, name) {
  const real = realType(data), named = isImg(name), more = IMG_MORE.test(name);
  if (!more && (real === 'jpeg' || real === 'png') && !await picReads(data)) return { hurt: true };
  if (!more && (real === 'jpeg' || real === 'png')) return { pdf: await imageToPdf(data, real === 'png' ? 'page.png' : 'page.jpg'), turn: real === 'jpeg' ? jpegTurn(data) : 0, was: !(named && (real === 'png') === /\.png$/i.test(name)) };
  if (named && !/^(heic|gif|webp|bmp|avif)$/.test(real)) return { pdf: await imageToPdf(data, name) };   // bytes it doesn't know: stops here, as a damaged picture
  if (real === 'heic') { try { return { pdf: await anyImageToPdf(data) }; } catch {} return { pdf: await heicToPdf(data), was: true }; }
  return { pdf: await anyImageToPdf(data), was: !more };
}
// src/intake.js
function jpegTurn(b) {
  try {
    for (let i = 2; i + 4 < b.length && b[i] === 0xff;) {
      const m = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
      if (m === 0xda || m === 0xd9) return 0;
      if (m === 0xe1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) {   // "Exif"
        const t = i + 10, le = b[t] === 0x49, u16 = o => le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1], u32 = o => le ? u16(o) + u16(o + 2) * 65536 : u16(o) * 65536 + u16(o + 2);
        const ifd = t + u32(t + 4), n = u16(ifd);
        for (let k = 0; k < n; k++) { const e = ifd + 2 + k * 12; if (u16(e) === 0x112) return { 3: 180, 4: 180, 5: 270, 6: 90, 7: 90, 8: 270 }[u16(e + 8)] || 0; }
        return 0;
      }
      i += 2 + len;
    }
  } catch {}
  return 0;
}
// src/intake.js
const photoHasWork = f => Object.values(f.marks).some(a => a.length) || !!f.hand || !!batch.share?.boxes?.[boxKey(f.path, 0)]?.length;
// src/intake.js
async function photoTurns() {
  for (const st of batch.students) for (const f of st.files) {
    // A damaged JPEG she marked before that was noticed stays a page, as she marked it. The opening report still says. A damaged PNG can freeze the PDF maker, so it stays a file, and her marks stay saved.
    if (f.hurt && photoHasWork(f) && realType(f.data) === 'jpeg') { try { f.data = await imageToPdf(f.data, realType(f.data) === 'png' ? 'page.png' : 'page.jpg'); f.kind = 'img'; } catch {} }
    if (f.photoTurn && !f.rot && !photoHasWork(f)) f.rot = { 0: f.photoTurn };
    // A picture that only now opens (an iPhone photo, one with the wrong name) isn't in a page order she made before it could. A saved order newer than that (Lp) left it out on purpose.
    if (f.was && st.layoutOld && !st.layout.some(d => d.pages.some(([q]) => q === f.path))) st.layout.push({ name: f.name, file: f.path, pages: [[f.path, 0]] });
  }
}
// src/intake.js
let heicLib = null, heicDec = null;
// src/intake.js
async function heicToPdf(bytes) {
  toast('Reading an iPhone photo…', 4000);
  await new Promise(r => setTimeout(r, 0));
  const lib = heicLoad(), imgs = (heicDec ||= new lib.HeifDecoder()).decode(bytes);   // the next decode frees this one's memory
  if (!imgs || !imgs.length) throw new Error('no picture in it');
  const im = imgs[0], W = im.get_width(), H = im.get_height(), c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d'), out = ctx.createImageData(W, H);
  await new Promise((res, rej) => im.display(out, d => d ? res() : rej(new Error('couldn’t read the picture'))));
  ctx.putImageData(out, 0, 0);
  for (const x of imgs) x.free();
  const jpg = await canvasJpg(c, 0.92);
  c.width = c.height = 0;
  return imageToPdf(jpg, 'page.jpg');
}
// src/insight.js
function coverTurn(f, p, by) {
  const sh = batch && batch.share, k = boxKey(f.path, p), fx = v => Math.round(v * 10000) / 10000;
  if (!sh || !by) return;
  if (sh.checked) delete sh.checked[k];
  const list = (sh.boxes && sh.boxes[k]) || [];
  const off = (sh.off && sh.off[k]) || [];
  for (let n = (by + 360) % 360; n > 0; n -= 90) for (const b of list.concat(off)) [b[0], b[1], b[2], b[3]] = [fx(1 - b[1] - b[3]), b[0], b[3], b[2]];
}
// src/scans.js
function scanRestore(saved) {
  if (!saved) return;
  for (const st of batch.students) for (const f of st.files) {
    const s = saved[f.path]; if (!s) continue;
    f.sc = { ...s.rec };
    // A fix the app made never overrides her: a page with her marks or a turn of her own stays as she left it, whichever computer the fix came from.
    for (const [p, o] of Object.entries(s.at || {})) { const hers = (f.marks[p] || []).length; if (o.r && !hers && !rotOf(f, p)) setRot(f, p, o.r); if (o.k && !hers && !skewOf(f, p)) setSkew(f, p, o.k); }
  }
}
// src/merge.js
const mHash = s => {
  let h1 = 0x811c9dc5, h2 = 0x1234567;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
};
// src/merge.js
function canon(v) {
  if (v == null || v === '') return undefined;
  if (Array.isArray(v)) {
    const a = v.map(canon);
    while (a.length && a[a.length - 1] === undefined) a.pop();
    return a.length ? a.map(x => x === undefined ? null : x) : undefined;
  }
  if (typeof v !== 'object') return v;
  const o = {};
  for (const k of Object.keys(v).sort()) { const x = canon(v[k]); if (x !== undefined) o[k] = x; }
  return Object.keys(o).length ? o : undefined;
}
// src/merge.js
const hashOf = v => { const c = canon(v); return c === undefined ? '' : mHash(JSON.stringify(c)); };
// src/merge.js
function recHash(rec) {
  if (!rec) return '';
  const { v, at, ft, Lp, ...x } = rec;
  if (x.g) { const { at: a, atR, ...g } = x.g; x.g = g; }
  return hashOf(x);
}
// src/merge.js
const WORK_SET = ['carry', 'setup', 'cls', 'share', 'drive', 'light', 'lightOpt', 'lightPg', 'lightPgL', 'anon', 'moved', 'removed', 'refSkip', 'quiz', 'groups', 'groupsOwn', 'returned', 'goal', 'clips', 'vrot'];
// src/merge.js
const setOf = w => { const o = {}; if (w) for (const k of WORK_SET) if (w[k] !== undefined) o[k] = w[k]; return o; };
// src/merge.js
const partHashes = w => { const o = {}; for (const k of WORK_SET) { const h = hashOf(w && w[k]); if (h) o[k] = h; } return o; };
// src/merge.js
const FILE_PARTS = ['f', 'h', 'tr', 'r', 'sk', 'e', 'inc'];
// src/merge.js
function fileHashes(rec) {
  const by = {}, out = {};
  for (const p of FILE_PARTS) for (const path of Object.keys((rec && rec[p]) || {})) (by[path] ||= {})[p] = rec[p][path];
  for (const path of Object.keys(by)) { const h = hashOf(by[path]); if (h) out[path] = h; }
  return out;
}
// src/merge.js
function revsOf(work) {
  const o = { s: {}, set: hashOf(setOf(work)), sv: work && work.sv, sat: work && work.sat, pv: work && work.pv, ph: partHashes(work), gone: (work && work.gone) || {} };
  for (const [k, r] of Object.entries((work && work.s) || {})) o.s[k] = { h: recHash(r), fh: fileHashes(r), v: r.v, at: r.at, ft: r.ft };
  return o;
}
// src/merge.js
function rubricKey(su) {
  const s = su || {}, pts = s.mode === 'points', max = pts ? +(s.outOf == null ? 10 : s.outOf) || 0 : (!s.criteria ? 12 : typeof rowsMax === 'function' ? rowsMax(s) : s.criteria.length * 4), sc   /* this file also runs on its own in tests, where a row is always 0 to 4 */ = s.scale === undefined ? SCALE12 : s.scale || {};
  const keys = Object.keys(sc).filter(k => sc[k] !== '' && sc[k] != null && !isNaN(+sc[k])).map(Number).sort((a, b) => a - b);
  // rows scored on another scale than 0 to 4 with halves: a different rubric, even when the total is the same
  const own = pts || typeof rowScaleOf !== 'function' ? {} : rowScaleOf(s);
  return JSON.stringify([pts, max, keys.length >= 2 && keys[keys.length - 1] === max ? keys.map(k => [k, +sc[k]]) : 0].concat(Object.keys(own).length ? [own] : []));
}
// src/merge.js
const rubricsDiffer = (x, y) => rubricKey(x) !== rubricKey(y);
// src/merge.js
function workScored(w) {
  const blank = v => v == null || v === '';
  if (w && Object.keys(w.read || {}).length) return true;
  return !!w && Object.values(w.s || {}).some(r => { const g = (r && r.g) || {}; return g.status !== 'missing' && g.status !== 'excused' && ((g.rubric || []).some(v => v != null) || !blank(g.points) || !blank(g.pk) || !blank(g.sheet)); });
}
// src/merge.js
const EDIT_OFF = '~edit|';
// src/folder.js
function noteGone(b, k) { b.goneNow = { ...(b.goneNow || (b.revs || {}).gone || {}), [k]: Date.now() }; }
// src/quizmake.js
const qmkFor = (had, q) => ({ ...JSON.parse(JSON.stringify(q)), shift: (had && had.shift) || {}, spot: (had && had.spot) || {} });
// src/groups.js
function groupFileOf(g, st) { const p = g.p && g.p[st.key]; return p ? st.files.find(f => f.path === p) || null : null; }
// src/groups.js
const GROUP_SKIP = new Set(['reads', 'sent', 'anchor']);   // a partner's paper exported on its own isn't the others'
// src/groups.js
function groupGradeCopy(to, from) {
  const a = to.grade, b = from.grade;
  for (const k of Object.keys(a)) if (!GROUP_SKIP.has(k) && !(k in b)) delete a[k];
  for (const [k, v] of Object.entries(b)) if (!GROUP_SKIP.has(k)) a[k] = v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
  if (!a.rubric) a.rubric = [];
}
// src/groups.js
const GROUP_NOTES = ['tn'];   // typed notes; the comment branches off, one for each partner
// src/groups.js
const groupOwn = g => !!(g && g.own);
// src/groups.js
const groupAdj = g => !!(g && g.own === 2);
// src/groups.js
const ADJ_KEYS = ['points', 'pk', 'xc', 'xcU', 'status'];
// src/groups.js
const adjFields = sts => [...Array(Math.max(0, ...sts.map(s => (s.grade.rubric || []).length), setup && setup.criteria ? setup.criteria.length : 0)).keys(), ...ADJ_KEYS];
// src/groups.js
const adjGet = (gr, f) => JSON.stringify(typeof f === 'number' ? (gr.rubric || [])[f] ?? null : gr[f] ?? null);
// src/groups.js
function adjPut(gr, f, from) {
  if (typeof f === 'number') { (gr.rubric ||= [])[f] = (from.rubric || [])[f] ?? null; }
  else if (from[f] == null) delete gr[f]; else gr[f] = JSON.parse(JSON.stringify(from[f]));
  const t = from.atR && from.atR[f]; if (t) (gr.atR ||= {})[f] = t;
}
// src/groups.js
const adjTime = (gr, f) => (gr.atR && gr.atR[f]) || gr.at || 0;
// src/groups.js
function adjSync(sts) {
  let changed = false;
  for (const f of adjFields(sts)) {
    const free = sts.filter(s => !(s.grade.adj && s.grade.adj[f])); if (!free.length) continue;
    // a partner scored with Write for: Just them, whose value differs from the rest: it's theirs now
    for (const s of free) if (groupJust === s.key && free.length > 1) { const rest = free.filter(x => x !== s), v = adjGet(rest[0].grade, f); if (rest.every(x => adjGet(x.grade, f) === v) && adjGet(s.grade, f) !== v) { (s.grade.adj ||= {})[f] = 1; changed = true; } }
    const live = free.filter(s => !(s.grade.adj && s.grade.adj[f])); if (live.length < 2) continue;
    const src = live.reduce((a, s) => (adjTime(s.grade, f) > adjTime(a.grade, f) ? s : a), live[0]), v = adjGet(src.grade, f);
    for (const s of live) if (s !== src && adjGet(s.grade, f) !== v) { adjPut(s.grade, f, src.grade); changed = true; stampSoon(s); }
  }
  return changed;
}
// src/groups.js
const notesSig = gr => JSON.stringify(GROUP_NOTES.map(k => gr[k] ?? null));
// src/groups.js
function groupNotesCopy(to, from) { for (const k of GROUP_NOTES) { if (from.grade[k] != null) to.grade[k] = JSON.parse(JSON.stringify(from.grade[k])); else delete to.grade[k]; } }
// src/groups.js
let groupJust = null;
// src/groups.js
const gradeSig = g => JSON.stringify(Object.fromEntries(Object.entries(g).filter(([k]) => !GROUP_SKIP.has(k)).sort()));
// src/groups.js
function groupMergeMarks(into, from) {
  for (const [p, list] of Object.entries(from || {})) {
    const have = new Set((into[p] ||= []).map(m => JSON.stringify(m)));
    for (const m of list) if (!have.has(JSON.stringify(m))) into[p].push(m);
  }
}
// src/groups.js
function groupSync() {
  if (!batch || !batch.groups || !batch.groups.length) return false;
  let changed = false;
  const seen = new Set();   // a student in two groups (two copies made one) stays in the first
  batch.groups = batch.groups.filter(g => g.k.filter(k => batch.students.some(s => s.key === k)).length > 1 && !g.k.some(k => seen.has(k)) && (g.k.forEach(k => seen.add(k)), true));
  for (const g of batch.groups) {
    const sts = g.k.map(k => batch.students.find(s => s.key === k)).filter(Boolean);
    const newest = l => l.reduce((a, s) => ((s.grade.at || 0) > (a.grade.at || 0) ? s : a), l[0]);
    if (groupOwn(g)) {
      // only the notes go round: from whoever changed them since they were last shared (the newest of those, after a merge)
      const moved = sts.filter(s => notesSig(s.grade) !== g.ns), src = moved.length ? newest(moved) : sts[0], sig = notesSig(src.grade);
      for (const s of sts) if (s !== src && notesSig(s.grade) !== sig) { groupNotesCopy(s, src); changed = true; }
      if (g.ns !== sig) { g.ns = sig; changed = true; }
      if (groupAdj(g) && adjSync(sts)) { changed = true; setTimeout(groupNoteRefresh); }
    } else {
      const src = newest(sts), sig = gradeSig(src.grade);
      for (const s of sts) if (s !== src && gradeSig(s.grade) !== sig) { groupGradeCopy(s, src); changed = true; }
    }
    const files = sts.map(s => groupFileOf(g, s)).filter(Boolean);
    if (files.length < 2) continue;
    const base = files[0];
    for (const f of files.slice(1)) {
      if (f.marks !== base.marks) { groupMergeMarks(base.marks, f.marks); f.marks = base.marks; changed = true; }
      for (const k of ['rot', 'skew']) if (base[k] || f[k]) { if (!base[k]) base[k] = f[k] || {}; if (f[k] !== base[k]) { f[k] = base[k]; changed = true; } }
    }
  }
  return changed;
}
// src/video.js
const LINK_RX = /\.(url|webloc)$/i;
// src/video.js
function linkClean(v) {
  v = String(v || '').trim().replace(/&amp;/g, '&'); if (!v || /\s/.test(v)) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : ''; } catch { return ''; }
}
// src/video.js
function linkOf(data) {
  if (!data || !data.length || data.length > 20000) return '';
  let s = ''; try { s = new TextDecoder().decode(data); } catch { return ''; }
  const m = /^\s*URL\s*=\s*(\S+)/mi.exec(s) || /<string>\s*([^<\s]+)\s*<\/string>/i.exec(s);
  return m ? linkClean(m[1]) : '';
}
// src/video.js
const vidRef = data => { if (!data || !data.length || data.length > 4000) return ''; let s = ''; try { s = new TextDecoder().decode(data); } catch { return ''; } const m = /^\s*URL\s*=\s*gs-video:([\w-]{6,40})\s*$/mi.exec(s); return m ? m[1] : ''; };
// src/video.js
const NP_W = 595.28, NP_H = 841.89, NP_M = 48, NP_TAIL = '%GradingStudio-notes';
// src/video.js
const isNotes = d => !!d && d.length > 64 && new TextDecoder('latin1').decode(d.subarray(d.length - 64)).includes(NP_TAIL);
// src/ib.js
const ibTaskLevels = st => setup.ib.map((k, i) => [k, noScore(st) ? null : st.grade.rubric[i]]).filter(x => x[0]);
// src/ib.js
function ibStampText(st) { return ibTaskLevels(st).filter(x => x[1] != null).map(([k, v]) => k + ' ' + fmtNum(v)).join('   '); }
// src/phone.js
const ph = { cols: null, ver: -1, busy: null, lib: null, later: false };
export { paperGet, srcRead, spellLikeSaved, groupRaw, houseFile, makeFile, batchIdOf, revsBase, restore, rosterSort, loadAdded, loadEdits, applyRubricPage, loadRefs, photoTurns, natural, newestWork, cardOfKept, findItem, holders, rubricsDiffer, workScored, rubricFitting, junk, unzipInto, qmkFor, revsOf, partHashes, batchClass, compareFiles, compareNames, matchLevel, mapBoxes, mapLit, mapPaths, rubricNamed, sameBytes, nfc, carryRoster, lostPages, studentOf, hasGsTail, underId, REF_KEY, isNotes };
export { GS_TAIL, syncScoreStamps, boxKey, hasSheet, stampSoon, tryOfFile, canvasJpg, groupFileOf, groupOwn, groupJust, hash, realType, moveFileNow, goneNow, gradeHasWork };
