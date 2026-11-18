// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
// the Grade sheet's choices, which the current app keeps in module variables: read and set from the Grades tab
export function sheetSet(o) { if ('all' in o) sheetAll = !!o.all; if ('found' in o) sheetFound = !!o.found; if ('out' in o) sheetShowOut = !!o.out; }
export const sheetNow = () => ({ all: sheetAll, found: sheetFound, out: sheetShowOut });
import { batch, cur, setup, lib, selected, pages, docs, undoStack, redoStack, disp, once, LANG_LOCALE, tr, gradesOrder, saveSoon, pdfjsLib, PDFLib, fflate, mammoth, html2canvas, workerReady, toast, renderList, renderTools, renderGrade, openStudent, gradeMarksChanged, openImported, rescanFile, refound, groupJust, store, ROW_TOP, rowTop, rowScaleOf, maxPoints, roundPct, percentWith, gradeOf, tryGrade, ownGrade, fmtNum, fmtPct, COLORS, HL, noScore, wordPart, quizCount, quizPart, ibSetup, set } from './gcore.js';
import { FONT, measureCtx, sideFor, wrapText, rgb, textLayout, drawMarks, rotOf, vpRot, skewOf, skewXf, vpDraw, viewable, fileByPath, layoutOf, docMarked, docIn, docAuto, draw, docAdded, scrub, scrubMarks, nameFold, rosterMatch, batchClass, anonOn, shownName, lightOpts, lightForPage, lightCanvas, WORD_RX, isLatin, rawWords, namesNow, ownNames, coverRx, stampScore, stampBox, drawStamp, viewBytes, one, marksMine, tnMine, tnOut } from './gdraw.js';
import { natural, GS_TAIL, syncScoreStamps, boxKey, findItem, hasSheet, stampSoon, tryOfFile, canvasJpg, groupFileOf, groupOwn } from './gopen.js';

// src/app/start.js
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// src/app/start.js
const BK_TYPES = [['ic', 'In-class assessment', 'In-class'], ['sum', 'Summative assessment', 'Summative'], ['fm', 'Formative activity', 'Formative']];
// src/app/start.js
const BK_DEF = BK_TYPES.map(x => x.slice());
// src/app/start.js
let bkCatsSeen;
// src/app/files.js
const thumbCache = new Map();
// src/app/files.js
function fileIn(st, f) { return layoutOf(st).some(d => docIn(st, d) && d.pages.some(([path]) => path === f.path)); }
// src/app/paper.js
function pushUndo(u) { if (stepping) return; undoStack.push(u); if (undoStack.length > 200) undoStack.shift(); set.redoStack([]); renderTools(); }
// src/app/paper.js
let stepping = false;   // while a step is being undone or redone, what it calls doesn't add steps of its own
// src/app/paper.js
const groupStep = (steps, what) => ({ group: steps, what });
// src/app/paper.js
const gradeStep = st => ({ grade: st, before: JSON.stringify(st.grade) });
// src/app/paper.js
function changed(pg) { justTag(pg); scanned = false; draw(pg); gradeMarksChanged(pg.file); saveSoon(); renderList(); }
// src/app/paper.js
const gradeMarks = f => Object.entries(f.marks || {}).flatMap(([p, a]) => marksMine(a, f).filter(m => !m.qza && (m.t === 'text' || m.t === 'note' || (m.t === 'stamp' && m.k === 'score')) && m.text && parseGrade(m.t === 'stamp' ? stampScore(m.text) : m.text, false)).map(m => p + '|' + m.text)).sort();
// src/app/paper.js
const r1 = v => Math.round(v * 10) / 10;
// src/app/paper.js
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// src/app/panels.js
function fmNow() { const a = batch && batch.assignment, f = a && findItem(a.id); return ((f && f.it) || a || {}).type === 'fm'; }
// src/app/panels.js
function paperScore(st) {
  if (st.found && st.found.found && st.found.score != null) return st.found.score;
  const ty = st.grade.sheet;
  return ty !== '' && ty != null && !isNaN(+ty) ? +ty : null;
}
// src/app/dialogs.js
function gradeRows() {
  const c = batchClass();
  if (gradesOrder !== 'roster' || !c || !c.names.length) return batch.students.map((st, i) => ({ st, i })).sort((a, b) => gradesOrder === 'folder' ? natural(a.st.key, b.st.key) : 0);
  const m = rosterMatch(c.names), used = new Set(m.values());
  return c.names.map(n => m.has(n) ? { st: m.get(n), i: batch.students.indexOf(m.get(n)), rn: n } : { missing: n })
    .concat(batch.students.filter(st => !used.has(st)).map(st => ({ st, i: batch.students.indexOf(st), off: true })));
}
// src/app/dialogs.js
function tableHead() { return ['#', 'Student'].concat(setup.mode === 'rubric' ? setup.criteria : [], ibSetup() ? [] : ['Total / ' + maxPoints(), 'Percent'], ['Status', 'Comment']); }
// src/app/dialogs.js
function tableRow(st, pos) {
  const g = gradeOf(st), i = pos != null ? pos : batch.students.indexOf(st);
  return [String(i + 1), st.key].concat(setup.mode === 'rubric' ? setup.criteria.map((_, k) => fmtNum(rowShown(st, k))) : [], ibSetup() ? [] : [cellOut(g, 'total'), cellOut(g, 'pct')], [statusText(st), st.grade.comment.replace(/\s*\n\s*/g, ' ')]);
}
// src/app/export.js
const xAll = () => !!store.get('gs.xall', false);
// src/app/export.js
const xEarly = () => !!store.get('gs.xearly', false);
// src/app/export.js
const gotEarly = st => !!(st.grade && st.grade.sent);
// src/app/export.js
const xEdit = () => store.get('gs.xedit', true) !== false;
// src/app/export.js
const rawOut = f => !viewable(f) && !!f.data && f.kind !== 'link' && (f.virtual ? f.kind === 'docx' && (!!f.edited || !!(wordScore(f) && f.wscore.total != null)) : xAll() || !!f.edited || !!f.added || !!(wordScore(f) && f.wscore.total != null));
// src/app/export.js
const outPath = (st, path) => batch.moved && batch.moved[path] === st.key && path.includes('/') ? st.key + path.slice(path.indexOf('/')) : path;
// src/app/export.js
function exportPlan(keepFolders, early = !xEarly()) {
  const out = [];
  for (const st of batch.students) for (const f of st.files.filter(rawOut)) {
    const fp = outPath(st, f.path), dir = fp.includes('/') ? fp.slice(0, fp.lastIndexOf('/') + 1) : '';
    out.push({ st, f, raw: true, path: (keepFolders ? fp : (dir ? st.key + ' - ' : '') + f.name).replace(/[\\:*?"<>|]+/g, '-') });
  }
  for (const st of batch.students) for (const d of layoutOf(st)) {
    if (xAll() ? !(docIn(st, d) || docAuto(st, d)) : (!docIn(st, d) || !(docMarked(st, d) || docAdded(st, d) || tnOut(st)))) continue;   // typed notes that go back are something to return
    const first = outPath(st, d.pages[0][0]), dir = first.includes('/') ? first.slice(0, first.lastIndexOf('/') + 1) : '';
    let path = dir + d.name.replace(/\.(png|jpe?g|gif|webp|bmp|heic|heif|tiff?|avif)$/i, '.pdf');
    if (!/\.pdf$/i.test(path)) path += '.pdf';
    if (!keepFolders) path = (dir ? st.key + ' - ' : '') + path.split('/').pop();
    out.push({ st, d, path: path.replace(/[\\:*?"<>|]+/g, '-') });
  }
  if (!early) for (let i = out.length - 1; i >= 0; i--) if (gotEarly(out[i].st)) out.splice(i, 1);
  if (xOne()) oneEach(out);
  const used = new Set();
  for (const o of out) { let p = o.path, k = 2; while (used.has(p.toLowerCase())) p = o.path.replace(/(\.[^./]+)?$/, ' (' + k++ + ')$1'); used.add(p.toLowerCase()); o.path = p; }
  return out;
}
// src/app/export.js
const xOne = () => store.get('gs.xone', true) !== false;
// src/app/export.js
const canJoin = o => !!o.d || (o.raw && wordCanPdf(o.f));
// src/app/export.js
function oneEach(out) {
  const groups = new Map();
  for (const o of out) {
    if (!canJoin(o)) continue;
    const f = o.d ? fileByPath(o.st, o.d.pages[0][0]) : o.f, tn = tryOfFile(o.st, f), k = o.st.key + '\n' + tn;
    if (!groups.has(k)) groups.set(k, { st: o.st, tn, list: [] });
    groups.get(k).list.push(o);
  }
  for (const { st, tn, list } of groups.values()) {
    if (list.length < 2) continue;
    const first = list.find(o => o.d) || list[0], dir = first.path.includes('/') ? first.path.slice(0, first.path.lastIndexOf('/') + 1) : '';
    const name = fileSafe([st.key, asgName(), tn ? tr(tryName(tn)) : ''].filter(Boolean).join(' - ')) + '.pdf';
    const d = { name, pages: list.filter(o => o.d).flatMap(o => o.d.pages), words: list.filter(o => !o.d).map(o => o.f) };
    out.splice(out.indexOf(list[0]), 1, { st, d, one: true, path: dir + name });
    for (const o of list.slice(1)) out.splice(out.indexOf(o), 1);
  }
}
// src/app/export.js
function oneLeftOver(o) {
  const dir = o.path.includes('/') ? o.path.slice(0, o.path.lastIndexOf('/') + 1) : '', stem = o.path.slice(dir.length).replace(/\.pdf$/i, '');
  return (o.d.left || []).map(f => ({ path: dir + stem + ' - ' + fileSafe(f.name), bytes: f.data }));
}
// src/app/export.js
const xNames = () => store.get('gs.xnames', true) !== false;
// src/app/export.js
const fileSafe = s => String(s || '').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
// src/app/export.js
const asgName = () => { const a = batch.assignment, f = a && findItem(a.id); return (f && f.it && f.it.name) || (a && a.name) || batch.name; };
// src/app/export.js
function outWord(st) {
  if (fmNow()) return tr('Feedback');
  const g = gradeOf(st);
  const scored = (g.total != null && !g.partial) || st.files.some(f => (f.scan && f.scan.found && f.scan.found.length) || !!f.hand || (!!f.wscore && f.wscore.total != null));
  return scored ? tr('Graded') : tr('Feedback');
}
// src/app/export.js
function outStem(st, rn) { return [(rn || rosterNames()).get(st) || st.key, asgName(), outWord(st)].map(fileSafe).filter(Boolean).join(' - '); }
// src/app/export.js
function nameOut(items) {
  if (!xNames() || !items.length) return items;
  const rn = rosterNames(), by = new Map(), ext = p => (p.match(/\.[^./]+$/) || [''])[0];
  for (const o of items) { if (!by.has(o.st)) by.set(o.st, []); by.get(o.st).push(o); }
  for (const [st, list] of by) {
    const stem = outStem(st, rn);
    const named = list.map(o => {
      const dir = o.path.includes('/') ? o.path.slice(0, o.path.lastIndexOf('/') + 1) : '', e = ext(o.path);
      let base = o.path.slice(dir.length, o.path.length - e.length);
      // "Student - " that a loose export put in front
      if (base.startsWith(st.key + ' - ')) base = base.slice(st.key.length + 3);
      const twin = list.filter(x => ext(x.path).toLowerCase() === e.toLowerCase()).length > 1;
      return dir + stem + (twin && !base.startsWith(stem) ? ' - ' + fileSafe(base) : '') + e;
    });
    list.forEach((o, i) => { o.path = named[i]; });
  }
  const used = new Set();
  for (const o of items) { let p = o.path, k = 2; while (used.has(p.toLowerCase())) p = o.path.replace(/(\.[^./]+)?$/, ' (' + k++ + ')$1'); used.add(p.toLowerCase()); o.path = p; }
  return items;
}
// src/app/export.js
async function flattenDoc(st, d, dpi, edit, key, fb, tn) {
  // a score stamp goes out saying the score as it is now
  syncScoreStamps(st);
  await workerReady;
  const srcs = new Map();
  const src = async path => {
    if (!srcs.has(path)) {
      const f = fileByPath(st, path);
      // less any marks from other apps that are hers now
      const bytes = await viewBytes(f);
      srcs.set(path, { f, js: await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise, lib: await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false }) });
    }
    return srcs.get(path);
  };
  const out = await PDFLib.PDFDocument.create();
  // so a flattened file brought back in can say why its marks can't be changed
  out.setCreator('Grading Studio'); out.setProducer('Grading Studio');
  try {
    const said = fb ? fbData(st, d) : null, notes = !!tn && tnOut(st);
    // only Word papers: a Letter page
    let W0 = 612, H0 = 792;
    if ((said || notes) && d.pages.length) { const [p0, n0] = d.pages[0], { f: f0, js: j0 } = await src(p0), v0 = vpRot(f0, n0, await j0.getPage(n0 + 1), 1); W0 = v0.width; H0 = v0.height; }
    if (said) await fbAddPages(out, said, W0, H0, dpi, notes);
    if (said && notes) await tnAddPages(out, st, W0, H0, dpi, true);
    for (const [path, p] of d.pages) {
      const { f, js, lib } = await src(path);
      const marks = marksMine(f.marks[p] || [], f, st).concat((f.kami && f.kami[p] && f.kami[p].notes) || []);
      const Lx = lightOpts().exp ? lightForPage(st, f, p) : null;
      // A locked (encrypted) PDF can't be copied page for page; its copies come out blank, so those pages are redrawn instead.
      if (!marks.length && !(f.kami && f.kami[p]) && !Lx && !lib.isEncrypted && !skewOf(f, p)) {
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
      await page.render({ canvasContext: ctx, ...vpDraw(f, p, page, scale), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
      scanClip(ctx, f, p, W * scale, c.width, c.height);
      // the page only, before her marks
      if (Lx) lightCanvas(ctx, Math.min(c.width, Math.ceil(W * scale)), c.height, Lx);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawMarks(ctx, marks, W, H, side, null);
      const jpg = await canvasJpg(c, 0.88);
      const img = await out.embedJpg(jpg);
      out.addPage([W + side, H]).drawImage(img, { x: 0, y: 0, width: W + side, height: H });
      c.width = c.height = 0; page.cleanup();
    }
    // One PDF a student: their Word papers follow, as pages. One that can't be drawn goes back as the Word file beside it (d.left).
    if (d.words && d.words.length) {
      // what was typed a moment ago is in the file first
      if (typeof wordSaves !== 'undefined') await Promise.all([...wordSaves].map(s => s()));
      d.left = [];
      for (const f of d.words) {
        try { const wl = await PDFLib.PDFDocument.load(await wordPagesPdf(f)); for (const cp of await out.copyPages(wl, wl.getPageIndices())) out.addPage(cp); }
        catch (er) { console.error(f.path, er); d.left.push(f); }
      }
    }
    // The mark key: what each proofreading mark on this file means, on its own page(s) after the last one, the last page's size.
    // Reopening an editable export rebuilds from the original pages, so the key never comes back in as a page.
    const rows = key ? keyRows(d.pages.flatMap(([path, p]) => fileByPath(st, path).marks[p] || [])) : [];
    if (rows.length && d.pages.length) {
      const [lp, lpn] = d.pages[d.pages.length - 1], { f: lf, js: ljs } = await src(lp), lv = vpRot(lf, lpn, await ljs.getPage(lpn + 1), 1);
      let W = lv.width, H = lv.height;
      if (W < 300 || H < 300 || W > 2000 || H > 2000) { W = 612; H = 792; }
      const scale = dpi / 72;
      for (let from = 0; from < rows.length;) {
        const c = document.createElement('canvas'); c.width = Math.ceil(W * scale); c.height = Math.ceil(H * scale);
        const ctx = c.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0);
        from += drawKeyPage(ctx, rows, from, W, H);
        out.addPage([W, H]).drawImage(await out.embedJpg(await canvasJpg(c, 0.9)), { x: 0, y: 0, width: W, height: H });
        c.width = c.height = 0;
      }
    }
    if (notes && !said) await tnAddPages(out, st, W0, H0, dpi, false);
    // the original pages and her own marks go along, so bringing the file back in opens it ready to change
    if (edit && d.pages.length) {
      const paths = [...new Set(d.pages.map(([path]) => path))];
      const info = { v: 1, pages: d.pages.map(([path, p]) => { const f = fileByPath(st, path); return [paths.indexOf(path), p, marksMine(f.marks[p] || [], f, st), rotOf(f, p), skewOf(f, p)]; }) };
      for (let k = 0; k < paths.length; k++) await out.attach(await viewBytes(fileByPath(st, paths[k])), 'gs-original-' + (k + 1) + '.pdf', { mimeType: 'application/pdf', description: 'Original pages, for reopening in Grading Studio' });
      await out.attach(new TextEncoder().encode(JSON.stringify(info)), 'grading-studio.json', { mimeType: 'application/json', description: 'Marks, for reopening in Grading Studio' });
    }
  } finally { for (const v of srcs.values()) v.js.destroy(); }
  const bytes = await out.save();
  if (!edit || !d.pages.length) return bytes;
  const tail = new TextEncoder().encode('\n' + GS_TAIL + '\n'), all = new Uint8Array(bytes.length + tail.length);
  all.set(bytes); all.set(tail, bytes.length); return all;
}
// src/app/gradesheet.js
const NUM = '(\\d{1,3}(?:[.,]\\d{1,2})?)';
// src/app/gradesheet.js
const NOT_MID = '(?<![\\d.,/])';   // not the tail of a longer number or date
// src/app/gradesheet.js
const RX_FULL = new RegExp(NOT_MID + NUM + '\\s*(?:(?:\\/|out of|of)\\s*' + NUM + ')?\\s*(?:=|:|→|->|–|—|-|\\(|,)\\s*' + NUM + '\\s*%');
// src/app/gradesheet.js
const RX_OUTOF = new RegExp(NOT_MID + NUM + '\\s*(?:\\/|out of)\\s*' + NUM + '(?![\\d/])', 'i');
// src/app/gradesheet.js
const RX_PCT_ANY = new RegExp(NUM + '\\s*%');
// src/app/gradesheet.js
const RX_NAMED = new RegExp(NOT_MID + NUM + '(?:\\s+of\\s+' + NUM + ')?(?![\\d/%]|[.,]\\d|[ \\t]*(?:[/%:=]|[-–—][ \\t]*\\d))', 'i');
// src/app/gradesheet.js
const num = v => v == null ? null : +String(v).replace(',', '.');
// src/app/gradesheet.js
function parseGrade(str, strict) {
  // Each form takes its best match in the text: "Due 10/12" and the like are skipped, and a labelled grade beats one inside a sentence.
  const sure = [], maybe = [], used = [];
  const all = (rx, keep, read) => {
    const out = [];
    for (const m of str.matchAll(new RegExp(rx.source, rx.flags.replace('g', '') + 'g'))) {
      const end = m.index + m[0].length, c = gradeContext(str.slice(0, m.index), str.slice(end), m[0]);
      if (c.no || !keep(m) || used.some(u => m.index < u[1] && end > u[0])) continue;   // the 10/12 inside "10/12 = 91%" isn't another grade
      const g = { ...read(m, c), at: m.index, len: m[0].length, loose: c.loose };
      out.push(g); used.push([m.index, end]);
      if (!c.loose || c.eq || REDONE_BEFORE.test(str.slice(0, m.index))) sure.push(g); else if (!COUNTS_AFTER.test(str.slice(end))) maybe.push(g); else g.counts = true;
    }
    return out;
  };
  const forms = [all(RX_FULL, () => true, (m, c) => ({ rank: 3, score: num(m[1]), outOf: num(m[2]), pct: num(m[3]), eq: c.eq }))];
  if (!strict) forms.push(all(RX_OUTOF, m => num(m[1]) <= num(m[2]) && num(m[2]) <= 200, m => ({ rank: 2, score: num(m[1]), outOf: num(m[2]), pct: null })), all(RX_PCT_ANY, m => num(m[1]) <= 110, m => ({ rank: 1, score: null, outOf: null, pct: num(m[1]) })));
  // A labelled number with no slash or percent ("Revised: 10", "10 points", "Revised: 10 of 12", or "10 of 12" alone). It can be the class ("Grade 10"), so it never stands by itself: she's always asked.
  if (!strict) forms.push(all(RX_NAMED, m => (m[2] == null ? num(m[1]) <= 200 : num(m[1]) <= num(m[2]) && num(m[2]) <= 200) && (labelledNumber(str.slice(0, m.index), str.slice(m.index + m[0].length)) || (m[2] != null && m[0] === str.trim())), m => ({ rank: 0.5, score: num(m[1]), outOf: num(m[2]), pct: null })).map(g => Object.assign(g, { loose: true })));
  // Two grades that differ ("First draft: 8/12. Revised: 10/12", "Grade: 8/12, now 10/12", "Total: 10/12. Grade: 95%"): she has to say. The one offered is the last one on this assignment's total, or else the last one.
  // An unlabelled number out of something else is a part of the grade ("Thesis 3/4. Total 10/12"). A percent agrees with a score if it's that score on the scale or plainly worked out.
  const pctOff = (p, s, of = s.outOf == null ? maxPoints() : s.outOf) => p.score == null && s.score != null && s.pct == null && Math.abs(p.pct - s.score / of * 100) > 1 && Math.abs(p.pct - percentWith(s.score, of, setup.scale)) > 1;
  const differ = (a, b) => (a.score != null && b.score != null && (a.score !== b.score || (a.outOf != null && b.outOf != null && a.outOf !== b.outOf))) || (a.pct != null && b.pct != null && a.pct !== b.pct) || pctOff(a, b) || pctOff(b, a);
  const reads = sure.concat(maybe.filter(g => g.outOf == null || g.outOf === maxPoints() || sure.some(s => s.outOf === g.outOf)));
  if (reads.some(a => reads.some(b => differ(a, b)))) {
    const late = reads.sort((a, b) => b.at - a.at);
    return { ...(late.find(g => g.outOf === maxPoints() || (g.rank === 0.5 && g.outOf == null)) || late[0]), several: true };
  }
  // A labelled grade first, then one that may be a grade, so a count or a part earlier in the comment ("Only 3/12 sources cited. Good rewrite, 10/12") doesn't hide it.
  const any = forms.flat(), best = any.find(g => !g.loose) || any.find(g => reads.includes(g)) || any[0];
  if (best) return best;
  if (strict) return null;
  let m;
  m = /^\s*(\d{1,2}(?:[.,]\d)?)\s*$/.exec(str);   // a text box with only a number, like "9.5"
  if (m) return { rank: 0.5, score: num(m[1]), outOf: null, pct: null, at: m.index, len: m[0].length };
  return null;
}
// src/app/gradesheet.js
const annText = (a, lines) => {   // lines: keep its line breaks, for reading a grade
  const sq = t => lines ? String(t || '').replace(/\r\n?/g, '\n').trim() : String(t || '').replace(/\s+/g, ' ').trim();
  const c = sq((a.contentsObj && a.contentsObj.str) || a.contents) || sq(a.richText && a.richText.str), t = sq(Array.isArray(a.textContent) ? a.textContent.join(' ') : '');
  return !t || t === c ? c : !c ? t : c + ' ' + t;
};
// src/app/gradesheet.js
const inside = (r, s) => !s || (r[0] < s.x + s.w && r[2] > s.x && r[1] < s.y + s.h && r[3] > s.y);
// src/app/gradesheet.js
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
// src/app/gradesheet.js
const paperBytes = async f => f.kind === 'docx' ? wordPdf(f) : viewBytes(f);
// src/app/gradesheet.js
async function scanFile(f, spot) {
  const doc = await pdfjsLib.getDocument({ data: (await paperBytes(f)).slice(), isEvalSupported: false }).promise;
  const found = [], kami = {}, seen = [], marksSig = gradeMarks(f).join('\0');
  let impN = 0;
  try {
    if (f.kind !== 'docx') f.numPages = doc.numPages;
    const pick = spot ? [typeof spot.page === 'number' ? Math.min(spot.page, doc.numPages - 1) : spot.page === 'last' ? doc.numPages - 1 : 0] : [...Array(doc.numPages).keys()];
    for (let p = 0; p < doc.numPages; p++) {
      const page = await doc.getPage(p + 1);
      const vp = vpRot(f, p, page, 1);
      const annots = (await page.getAnnotations({ intent: 'display' })).filter(a => !SKIP_TYPES.has(a.subtype) && !(a.annotationFlags & 2) && !(a.annotationFlags & 32));
      // Marks inside her own rubric page came with the template, not from marking this student, so they don't count as marks here.
      if (annots.length && !f.virtual) kami[p] = { notes: annots.filter(isPopupComment).map(a => kamiNote(a, vp)) };
      if (f.kind === 'pdf') impN += annots.filter(impKind).length;
      if (!pick.includes(p)) { page.cleanup(); continue; }
      const area = spot ? { x: spot.x * vp.width, y: spot.y * vp.height, w: spot.w * vp.width, h: spot.h * vp.height } : null;
      const ofMark = t => { const g = parseGrade(t, false); return g && { ...g, mark: true }; };
      const add = (g, rect, from, text, hover) => {
        if (!g) return;
        const r = [Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3])];
        if (!inside(r, area)) return;
        // the same grade at the same place counts once
        if (found.some(o => o.page === p && o.score === g.score && o.pct === g.pct && Math.abs(o.rect[0] - r[0]) < 20 && Math.abs(o.rect[1] - r[1]) < 20)) return;
        found.push({ ...g, boxed: !!spot, page: p, rect: r, from, hover: !!hover, full: text, text: text.length > 140 ? text.slice(0, 140) + '…' : text });
      };
      for (const a of annots) { const t = annText(a); if (t && seen.length < 4) seen.push(t.length > 60 ? t.slice(0, 60) + '…' : t); if (t && !f.virtual) add(parseGrade(annText(a, true), false), vp.convertToViewportRectangle(a.rect), 'note', t, isPopupComment(a)); }
      for (const m of marksMine((f.marks || {})[p] || [], f)) {
        if (m.t === 'text') { const L = textLayout(m, vp.width); add(ofMark(m.text), [m.x, m.y, m.x + L.ink, m.y + L.h], 'note', m.text); }
        if (m.t === 'note' && !m.qza) add(ofMark(m.text), [m.ax - 4, m.ay - 4, m.ax + 4, m.ay + 4], 'note', m.text, true);
        if (m.t === 'stamp' && m.k === 'score') { const b = stampBox(m); const sg = ofMark(stampScore(m.text)); add(sg && { ...sg, stamp: true }, [b.x, b.y, b.x + b.w, b.y + b.h], 'note', m.text); }   // her score sticker
      }
      // text in the page itself (already flattened files): strict "9.5 = 88%" form only, so essay numbers don't count.
      // A student could type this, so it's only offered, unless she boxed this very paper by hand. A rubric page's own printing isn't anyone's grade.
      const tc = await page.getTextContent();
      let str = '';
      const spans = [];
      for (const it of tc.items) {
        if (!it.str) { if (it.hasEOL) str += '\n'; continue; }
        const [, , , d, e, fy] = it.transform;
        spans.push({ a: str.length, b: str.length + it.str.length, r: vp.convertToViewportRectangle([e, fy, e + it.width, fy + (it.height || Math.abs(d))]) });
        str += it.str + (it.hasEOL ? '\n' : '');
      }
      const re = new RegExp(RX_FULL.source, 'g');
      let m;
      while (!f.virtual && (m = re.exec(str))) {
        const g = parseGrade(m[0], true); if (!g) continue;
        const cx = gradeContext(str.slice(0, m.index), str.slice(m.index + m[0].length), m[0]);
        if (cx.no || (cx.loose && !cx.eq && g.outOf == null)) continue;   // "Of 200, 50% agreed" is the essay talking
        g.loose = cx.loose; g.eq = cx.eq; g.theirs = !(spot && spot === f.hand);
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
      await page.render({ canvasContext: ctx, ...vpDraw(f, g.page, page, k), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
      ctx.setTransform(k, 0, 0, k, -x * k, -y * k);
      const mk = marksMine((f.marks || {})[g.page] || [], f).filter(m => m.t !== 'note');
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
    return { found, shots, kami, seen, marksSig, nAnnots: Object.keys(kami).length, hasText: seen.length > 0, impN };
  } finally { doc.destroy(); }
}
// src/app/gradesheet.js
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
// src/app/gradesheet.js
function kamiNote(a, vp) {
  const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect);
  const l = Math.min(x1, x2), r = Math.max(x1, x2), t = Math.min(y1, y2), b = Math.max(y1, y2);
  const k = a.color && a.color.length >= 3 ? a.color : [244, 180, 0];
  const hex = '#' + [k[0], k[1], k[2]].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  return { t: 'note', ro: true, color: hex, text: commentText(a), ax: Math.min(a.subtype === 'Text' ? (l + r) / 2 : r, vp.width - 2), ay: a.subtype === 'Text' ? (t + b) / 2 : t + Math.min(8, (b - t) / 2) };
}
// src/app/gradesheet.js
const SKIP_TYPES = new Set(['Link', 'Popup', 'Widget']);
// src/app/gradesheet.js
const commentText = a => ((a.contentsObj && a.contentsObj.str) || a.contents || '').replace(/\r\n?/g, '\n').trim();
// src/app/gradesheet.js
const isPopupComment = a => !!commentText(a) && a.subtype !== 'FreeText';
// src/app/gradesheet.js
let scanP = null;
// src/app/gradesheet.js
async function scanAll(onStep) {
  while (scanP) await scanP;
  const b0 = batch;
  scanP = scanRun(onStep).finally(() => { scanP = null; });
  await scanP;
  if (b0 !== batch) return;
}
// src/app/gradesheet.js
async function scanRun(onStep) {
  if (!batch) return;   // closed while an earlier scan was finishing
  const b0 = batch;
  const spot = setup.spot || null;
  const files = batch.students.flatMap(st => st.files.filter(f => viewable(f)));
  let n = 0;
  for (const st of batch.students) {
    if (syncScoreStamps(st)) saveSoon();   // a stamp says the score as it is now before the paper is read
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
  if (batch !== b0) return;   // she closed it during the last file
  scanned = true;
  if (JSON.stringify(paperReads()) !== JSON.stringify(batch.read)) saveSoon();
  renderList();
  for (const pg of pages) { pg.extra = (pg.file.kami && pg.file.kami[pg.idx] && pg.file.kami[pg.idx].notes) || []; draw(pg); if (pg.impFirst) impNote(pg); }
}
// src/app/gradesheet.js
let scanned = false;
// src/app/gradesheet.js
function foundLabel(fd) {
  if (!fd) return '';
  return (fd.score != null ? fmtNum(fd.score) + (fd.outOf ? '/' + fmtNum(fd.outOf) : '') : '') + (fd.pct != null ? (fd.score != null ? ' = ' : '') + fmtNum(fd.pct) + '%' : '');
}
// src/app/gradesheet.js
let sheetFound = !!store.get('gs.sheetfound', false);
// src/app/gradesheet.js
const appScored = st => { if (noScore(st)) return true; const g = gradeOf(st); return g.total != null && !g.paper; };
// src/app/gradesheet.js
const appShots = (st, f, shots) => !appScored(st) || sheetFound ? shots : shots.filter(g => g.stamp || g.boxed || g.none || f.hand);
// src/app/gradesheet.js
const quietReads = r => ({ ok: [], ask: [], mine: [], yes: r.yes, no: r.no });
// src/app/gradesheet.js
let sheetShowOut = false;
// src/app/gradesheet.js
let sheetAll = !!store.get('gs.sheetall', false);
// src/app/gradesheet.js
const rowGraded = r => r.word ? !!((r.f.wscore && r.f.wscore.total != null) || wordFound(r.f, r.st).length || (r.f.hand && r.f.scan && r.f.scan.shots.length))
  : !!(r.f.scan && (r.f.scan.found.length || r.f.scan.shots.length));
// src/app/gradesheet.js
function sheetRows(box) {
  const rows = [];
  batch.students.forEach((st, i) => {
    const fs = st.files.filter(viewable), words = st.files.filter(f => f.kind === 'docx');
    const inc = fs.filter(f => fileIn(st, f)), out = fs.filter(f => !fileIn(st, f));
    const cand = words.map(f => ({ st, i, f, word: true })).concat(inc.map(f => ({ st, i, f })));
    const shown = box || sheetAll ? cand : cand.filter(rowGraded);
    if (!shown.length && cand.length && appScored(st)) shown.push(cand[0]);   // her score shows beside the paper it's for
    if (!shown.length && (!out.length || !sheetShowOut)) rows.push({ st, i, f: null, none: !fs.length && !st.files.length, nograde: cand.length > 0, first: cand[0] && cand[0].f });
    rows.push(...shown);
    if (sheetShowOut) for (const f of out) rows.push({ st, i, f, out: true });
  });
  return rows;
}
// src/app/gradesheet.js
function sheetOwnLines(st, said) {
  if (said.has(st)) return [];
  if (noScore(st)) return [[STATUS_LABEL[st.grade.status], false]];
  const own = ownGrade(st), out = [];
  if (own.total != null) out.push(['Your score: ' + fmtNum(own.total) + ' / ' + maxPoints() + (own.pct != null ? ' = ' + fmtPct(own.pct) : '') + (own.partial ? ' (partial)' : ''), false]);
  const d = disagreeNote(st); if (d) out.push([d.replace(/^.*, t/, 'T'), true]);   // "The paper says 10", which fits the column
  return out;
}
// src/app/gradesheet.js
async function buildSheetPdf() {
  if (!scanned) await scanAll();
  const doc = await PDFLib.PDFDocument.create();
  const PW = 612, PH = 792, M = 36, k = 2, X = M + 200, maxW = PW - M - X;
  const rows = sheetRows().filter(r => !r.out);
  const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  let ri = 0, pageNo = 0;
  const sheetSaid = new Set();   // her own score prints once per student, on their first row
  while (ri < rows.length) {
    const c = document.createElement('canvas'); c.width = PW * k; c.height = PH * k;
    const ctx = c.getContext('2d'); ctx.scale(k, k); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PW, PH);
    ctx.fillStyle = '#151922'; ctx.font = 'bold 13px ' + FONT; ctx.fillText(batch.name + ' · grade sheet' + (pageNo ? ' (continued)' : ''), M, M - 8);
    let y = M + 6;
    while (ri < rows.length) {
      const { st, i, f, word } = rows[ri], wty = word ? wordFound(f, st).filter(g => !g.table) : [], sc = word ? { found: f.virtual && f.wscore && f.wscore.total != null ? [{ score: f.wscore.total, outOf: f.wscore.max, pct: f.wscore.pct }] : wordFound(f, st).length ? wordFound(f, st) : (f.hand && f.scan && f.scan.found) || [], shots: (f.hand && f.scan && f.scan.shots) || [] } : f && f.scan ? f.scan : { found: [], shots: [] };
      const app = appScored(st), quiet = app && !sheetFound;   // her score is the score: what the papers say only shows when she asks
      const rd = quiet ? { ok: [], ask: [] } : splitReads(st, sc.found), okF = app ? [] : rd.ok;
      const imgs = [];
      for (const g of f ? appShots(st, f, sc.shots) : []) { const im = await loadImg(g.img); if (im) imgs.push({ im, h: Math.min(90, maxW * im.height / im.width) }); }
      const mine = app ? [] : sheetOwnLines(st, sheetSaid), lead = app && !sheetSaid.has(st);
      const rh = Math.max(64 + mine.length * 15 + (lead ? 30 : 0), imgs.reduce((a, o) => a + o.h + 6, 0) + (word && imgs.length && f.wscore ? 44 : 0)) + 10;
      if (y + rh > PH - M && y > M + 6) break;
      ctx.fillStyle = '#8A90A0'; ctx.font = '11px ' + FONT; ctx.fillText(String(i + 1), M, y + 13);
      ctx.fillStyle = '#151922'; ctx.font = 'bold 12px ' + FONT;
      let ly = y + 13;
      for (const ln of wrapText(ctx, st.key, 170).slice(0, 2)) { ctx.fillText(ln, M + 20, ly); ly += 14; }
      ctx.fillStyle = '#5D6475'; ctx.font = '9.5px ' + FONT;
      if (f) for (const ln of wrapText(ctx, f.path, 170).slice(0, 2)) { ctx.fillText(ln, M + 20, ly); ly += 12; }
      ctx.font = 'bold 12px ' + FONT;
      for (const [ln, warn] of mine) { sheetSaid.add(st); ctx.fillStyle = warn ? '#9A6411' : '#151922'; ctx.fillText(ln, M + 20, ly + 4); ly += 15; }
      if (lead) {   // her score, big, once per student
        sheetSaid.add(st); ctx.fillStyle = '#1C7F54'; ctx.font = 'bold 18px ' + FONT;
        const g = gradeOf(st), max = g.outOf != null ? g.outOf : maxPoints();
        ctx.fillText(noScore(st) ? STATUS_LABEL[st.grade.status] : fmtNum(g.total) + (max ? '/' + fmtNum(max) : '') + (g.pct != null ? ' = ' + fmtNum(g.pct) + '%' : ''), M + 20, ly + 12);
        ctx.font = '9.5px ' + FONT; ctx.fillStyle = '#5D6475'; if (!noScore(st)) ctx.fillText('Your score' + (g.partial ? ' (partial)' : g.tries ? ' (the try that counts)' : ''), M + 20, ly + 24); ly += 30;
        const d = sheetFound && disagreeNote(st); if (d) { ctx.font = 'bold 12px ' + FONT; ctx.fillStyle = '#9A6411'; ctx.fillText(d.replace(/^.*, t/, 'T'), M + 20, ly + 4); ly += 16; }
      }
      if (!quiet && manyReads(st)) { ctx.fillStyle = '#9A6411'; ctx.fillText(readsCount(st) + ' grades found, check', M + 20, ly + 4); ly += 16; }
      if (rd.ask.length) { ctx.fillStyle = '#9A6411'; ctx.fillText('To confirm: ' + rd.ask.map(foundLabel).join(', '), M + 20, ly + 4); ly += 16; }
      ctx.fillStyle = '#1C7F54';
      if (okF.length === 1 && !manyReads(st)) { ctx.font = 'bold 18px ' + FONT; ctx.fillText(foundLabel(okF[0]), M + 20, ly + 12); ly += 22; }
      else for (const g of okF) { ctx.fillText(foundLabel(g), M + 20, ly + 4); ly += 15; }
      if (f && !app && !okF.length && hasSheet(st.grade)) { ctx.font = 'bold 18px ' + FONT; ctx.fillText(String(st.grade.sheet), M + 20, ly + 12); ctx.font = '9.5px ' + FONT; ctx.fillStyle = '#5D6475'; ctx.fillText('typed from the picture', M + 20, ly + 24); }
      let iy = y;
      for (const { im, h } of imgs) { const w = h * im.width / im.height; ctx.drawImage(im, X, iy, w, h); ctx.strokeStyle = manyReads(st) ? '#E8B451' : '#DADDE6'; ctx.strokeRect(X, iy, w, h); iy += h + 6; }
      if (word) { ctx.fillStyle = '#151922'; ctx.font = '11px ' + FONT; let wy = (imgs.length ? iy : y) + 13; for (const ln of wrapText(ctx, !f.wscore || wty.length ? (wty.length ? 'Word file, typed: ' + wty.map(g => '“' + g.text + '”').join(' · ') : imgs.length ? '' : 'Word file') : 'Word rubric: ' + f.wscore.crits.map((c, k) => c + ' ' + (f.wscore.per[k] == null ? '–' : fmtNum(f.wscore.per[k]))).join(' · '), maxW).slice(0, 4)) { ctx.fillText(ln, X, wy); wy += 14; } }
      else if (!imgs.length) { ctx.fillStyle = '#8A90A0'; ctx.font = 'italic 11px ' + FONT; ctx.fillText(f ? (app ? 'No score stamp on this paper' : 'No typed grade found') : rows[ri].nograde ? 'No grade yet' : 'Nothing turned in', X, y + 13); }
      y += rh; ctx.strokeStyle = '#ECEEF3'; ctx.beginPath(); ctx.moveTo(M, y - 5); ctx.lineTo(PW - M, y - 5); ctx.stroke();
      ri++;
    }
    const jpg = await canvasJpg(c, 0.9);
    doc.addPage([PW, PH]).drawImage(await doc.embedJpg(jpg), { x: 0, y: 0, width: PW, height: PH });
    c.width = c.height = 0; pageNo++;
  }
  return await doc.save();
}
// src/app/claude.js
const CODE_ABC = 'ACDEFGHJKMNPQRTUVWXY34679';
// src/app/claude.js
function shareState() {
  if (!batch.share) batch.share = { codes: {}, boxes: {} };
  const sh = batch.share, used = new Set([...Object.values(sh.codes), ...Object.keys(sh.also || {})]);
  for (const st of batch.students) if (!sh.codes[st.key]) {
    let c; do { c = 'S-' + Array.from(crypto.getRandomValues(new Uint8Array(4)), b => CODE_ABC[b % CODE_ABC.length]).join(''); } while (used.has(c));
    used.add(c); sh.codes[st.key] = c;
  }
  return sh;
}
// src/app/claude.js
const RIGHT_TO_LEFT = /[\p{Script=Arabic}\p{Script=Hebrew}]/u, RTL_STRETCH = /[\p{Script=Arabic}\p{Script=Hebrew}](?:[^\p{L}\p{N}]*[\p{Script=Arabic}\p{Script=Hebrew}])*/gu;
// src/app/claude.js
function acrossItem(it, a, b, x, W) {
  if (!RIGHT_TO_LEFT.test(it.str)) return [x(a), x(b)];
  const back = it.dir === 'rtl', sides = [];
  const stretch = (s, e, rtl) => {
    if (Math.max(a, s) >= Math.min(b, e)) return;
    for (const k of [Math.max(a, s), Math.min(b, e)]) { const along = rtl === back ? x(k) : x(s) + x(e) - x(k); sides.push(back ? W - along : along); }
  };
  let at = 0;
  for (const m of it.str.matchAll(RTL_STRETCH)) { stretch(at, m.index, false); stretch(m.index, m.index + m[0].length, true); at = m.index + m[0].length; }
  stretch(at, it.str.length, false);
  return [Math.min(...sides), Math.max(...sides)];
}
// src/app/claude.js
const textWidth = (s, font) => { measureCtx.font = '100px ' + font; return measureCtx.measureText(s).width; };
// src/app/claude.js
const NAME_SIGN = /(?<![\p{L}\p{N}])(?:(?:student|full|first|last|family|your|given)[’']?s?\s+)?(?:name|nom|nombre)(?:\s*\(s\))?\s*(?:[:：]|_{2,}|\.{3,})|(?:姓名|名字|名前|이름|ชื่อ)\s*[:：_]/giu;
// src/app/claude.js
const NEXT_SIGN = /(?<![\p{L}\p{N}])(?:date|class|period|block|teacher|grade|section|subject|form|homeroom|due|score|mark|total|id|number|no\.|group|level|日期|班级|班級|学号|날짜|반)\s*[:：]/iu;
// src/app/claude.js
function labelCovers(items, cover) {
  const out = [], lines = [];
  // Items on one line: the same way up, and their baselines within half a letter of each other.
  for (const it of items) {
    const t = it.transform, fh = Math.hypot(t[2], t[3]) || 10, len = Math.hypot(t[0], t[1]) || 1, ux = t[0] / len, uy = t[1] / len;
    const off = -t[4] * uy + t[5] * ux, along = t[4] * ux + t[5] * uy;
    let ln = lines.find(l => Math.abs(l.ux - ux) < .05 && Math.abs(l.uy - uy) < .05 && Math.abs(l.off - off) < fh * .5);
    if (!ln) lines.push(ln = { ux, uy, off, list: [] });
    ln.list.push({ it, along });
  }
  for (const ln of lines) {
    const row = ln.list.sort((a, b) => a.along - b.along).map(x => x.it);
    let text = ''; const from = [];
    for (const it of row) { if (text) { text += '  '; from.push(null, null); } for (let i = 0; i < it.str.length; i++) { text += it.str[i]; from.push([it, i]); } }
    NAME_SIGN.lastIndex = 0;
    for (let m; (m = NAME_SIGN.exec(text));) {
      let s = m.index + m[0].length - (/[_.]$/.test(m[0]) ? (m[0].match(/[_.]+$/) || [''])[0].length : 0);
      const rest = text.slice(s), stop = rest.search(NEXT_SIGN), next = rest.slice(1).search(NAME_SIGN);
      let e = s + Math.min(...[stop, next < 0 ? -1 : next + 1, rest.length].filter(v => v >= 0));
      while (s < e && /\s/.test(text[s])) s++;
      while (e > s && /\s/.test(text[e - 1])) e--;
      const said = text.slice(s, e), blank = /^[\s_.\-–—]*$/.test(said);
      if (s >= e || (!blank && (rawWords(said).length > 5 || said.length > 60))) continue;
      const piece = new Map();
      for (let k = s; k < e; k++) { const f = from[k]; if (!f) continue; const p = piece.get(f[0]); piece.set(f[0], p ? [p[0], f[1] + 1] : [f[1], f[1] + 1]); }
      for (const [it, [a, b]] of piece) { cover(it, a, b - a, blank || /_{2,}/.test(it.str.slice(a, b))); out.push([it, a, b]); }
    }
  }
  return out;
}
// src/app/claude.js
async function autoCovers(page, vp, rx, xf, opts) {
  const out = [];
  if (!rx || !nameFindOn()) return out;
  const tc = await page.getTextContent();
  const cover = (it, from, n, tall) => {
    const tx = pdfjsLib.Util.transform(vp.transform, it.transform), fh = Math.hypot(tx[2], tx[3]) || 10, run = Math.hypot(tx[0], tx[1]) || 1;
    const W = it.width * vp.scale, L = it.str.length || 1, at = (a, b) => [tx[4] + tx[0] / run * a + tx[2] / fh * b, tx[5] + tx[1] / run * a + tx[3] / fh * b];
    // Letters aren't all as wide, so where a word sits is its share of the measured line, not a count of letters.
    const font = ((tc.styles || {})[it.fontName] || {}).fontFamily || 'sans-serif', whole = textWidth(it.str, font), x = k => whole ? W * textWidth(it.str.slice(0, k), font) / whole : W * k / L;
    const pad = W / L + 2, [left, right] = acrossItem(it, from, from + n, x, W), a0 = left - pad, a1 = right + pad, up = fh * (tall ? 2.4 : 1.05) + 2, dn = -fh * (tall ? .7 : .4) - 2;
    out.push(coverRound([at(a0, up), at(a1, up), at(a1, dn), at(a0, dn)], xf));
  };
  const hits = text => { const list = []; rx.lastIndex = 0; let m; while ((m = rx.exec(text))) { if (m[0].length) list.push([m.index, m[0].length]); else rx.lastIndex++; } return list; };
  const items = tc.items.filter(it => it.str), done = new Map();
  const signed = opts ? labelCovers(items, cover) : [];
  // Whether a hit counts as a name here. Without opts, every hit does.
  const keep = (t, it, a) => {
    if (!opts || signed.some(([i, s, e]) => i === it && a >= s && a < e) || /[@\d]/.test(t) || rawWords(t).length > 1) return true;
    const w = nameFold(t), own = opts.own.has(w), small = isLatin(t) && t === t.toLowerCase();
    if (small && !own && opts.parts.has(w)) return false;
    return !opts.common.has(w) || (own && !small);
  };
  // Reads these items as one text and covers each name where it sits, piece by piece. A letter stored in a special form, like ⼩ for 小 or a shaped Arabic letter, is read as the plain one.
  const coverIn = list => {
    let text = ''; const from = [];
    for (const it of list) { let i = 0; for (const c of it.str) { const plain = thaiPlain(c).normalize('NFKC'); text += plain; for (let k = 0; k < plain.length; k++) from.push([it, i, i + c.length]); i += c.length; } }
    for (const [start, len] of hits(text)) {
      if (!keep(text.slice(start, start + len), from[start][0], from[start][1])) continue;
      const piece = new Map();
      for (const [it, a, b] of from.slice(start, start + len)) { const p = piece.get(it); piece.set(it, p ? [Math.min(p[0], a), Math.max(p[1], b)] : [a, b]); }
      for (const [it, [a, b]] of piece) { const seen = done.get(it) || new Set(), key = a + '-' + b; done.set(it, seen); if (!seen.has(key)) { seen.add(key); cover(it, a, b - a); } }
    }
  };
  for (const it of items) coverIn([it]);
  // A name can come in pieces on one line, as when a letter like ễ comes from another font: read neighbours together.
  const nextTo = (a, b) => {
    const [p, q] = [a.transform, b.transform], fh = Math.hypot(p[2], p[3]) || 10, len = Math.hypot(p[0], p[1]) || 1, ux = p[0] / len, uy = p[1] / len;
    if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) > fh * .5) return false;
    const dx = q[4] - p[4], dy = q[5] - p[5], along = dx * ux + dy * uy, off = -dx * uy + dy * ux;
    return Math.abs(off) < fh * .3 && Math.abs(along - a.width) < fh * .25;
  };
  for (let i = 0; i < items.length;) {
    let j = i + 1; while (j < items.length && nextTo(items[j - 1], items[j])) j++;
    if (j - i > 1) {
      const run = items.slice(i, j);
      coverIn(run);
      // Arabic and Hebrew letters can come one by one in the order they sit on the line, which is backwards.
      if (run.some(it => RIGHT_TO_LEFT.test(it.str))) coverIn([...run].reverse());
    }
    i = j;
  }
  for (const a of await page.getAnnotations()) {
    rx.lastIndex = 0;
    // A form box is drawn on the page with what's typed in it, so a name there counts too.
    const says = a.subtype === 'Widget' ? [a.fieldValue].flat().filter(v => typeof v === 'string').join(' ') : SKIP_TYPES.has(a.subtype) ? '' : annText(a) || '';
    if (rx.test(says)) {
      const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect);
      const L = Math.min(x1, x2) - 2, T = Math.min(y1, y2) - 2, R = Math.max(x1, x2) + 2, B = Math.max(y1, y2) + 2;
      out.push(coverRound([[L, T], [R, T], [R, B], [L, B]], xf));
    }
  }
  return out;
}
// src/app/claude.js
function ownCovers(path, p, W, H) { return (shareState().boxes[boxKey(path, p)] || []).map(b => ({ x: b[0] * W, y: b[1] * H, w: b[2] * W, h: b[3] * H, own: true })); }
// src/app/claude.js
const offList = (path, p) => (shareState().off ||= {})[boxKey(path, p)] || [];
// src/app/claude.js
const sameSpot = (r, b, W, H) => {
  const x0 = Math.max(r.x, b[0] * W), y0 = Math.max(r.y, b[1] * H), x1 = Math.min(r.x + r.w, (b[0] + b[2]) * W), y1 = Math.min(r.y + r.h, (b[1] + b[3]) * H);
  const both = Math.max(0, x1 - x0) * Math.max(0, y1 - y0), a = r.w * r.h, c = b[2] * W * b[3] * H;
  return both > 0 && both / (a + c - both) >= 0.5;
};
// src/app/claude.js
function keptCovers(cs, path, p, W, H) {
  const off = offList(path, p), gone = [];
  if (!off.length) return Object.assign(cs, { gone });
  const kept = cs.filter(r => { const out = off.some(b => sameSpot(r, b, W, H)); if (out) gone.push(r); return !out; });
  return Object.assign(kept, { gone });
}
// src/app/claude.js
const scoreWordsOnly = t => { const g = parseGrade(t, false); if (!g || g.at == null) return false; return /^[\s:=\-–,.()]*(?:total|score|grade|points?|pts|marks?|final)?[\s:=\-–,.()]*$/i.test(t.slice(0, g.at) + t.slice(g.at + g.len).replace(/^\s*(?:points?|pts)\b/i, '')); };
// src/app/claude.js
const isScoreMark = m => (m.t === 'stamp' && m.k === 'score') || (m.t === 'text' && !!m.qz) || ((m.t === 'text' || m.t === 'note') && !m.qza && m.text != null && String(m.text).trim().length <= 40 && scoreWordsOnly(String(m.text).trim()));
// src/app/claude.js
const scoreOffHides = m => isScoreMark(m) || (m.t === 'stamp' && m.k === 'crit');
// src/app/claude.js
async function sharePage(st, f, js, p, scale, rx, opts, look) {
  const page = await js.getPage(p + 1);
  const vp = vpRot(f, p, page, 1), W = vp.width, H = vp.height;
  let marks = look && look.bare ? [] : scrubMarks(marksMine(f.marks[p] || [], f, st).concat((f.kami && f.kami[p] && f.kami[p].notes) || []), rx);
  if (look && look.noScore) marks = marks.filter(m => !scoreOffHides(m));
  const side = marks.some(m => m.t === 'note') ? sideFor(W) : 0;
  const c = document.createElement('canvas');
  c.width = Math.ceil((W + side) * scale); c.height = Math.ceil(H * scale);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, ...vpDraw(f, p, page, scale), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
  if (look && look.light) { const L = lightForPage(st, f, p); if (L) lightCanvas(ctx, Math.ceil(W * scale), c.height, L); }
  scanClip(ctx, f, p, W * scale, c.width, c.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawMarks(ctx, marks, W, H, side, null);
  const auto = keptCovers(await autoCovers(page, vp, rx, skewXf(f, p, vp), opts), f.path, p, W, H), covers = auto.concat(ownCovers(f.path, p, W, H));
  ctx.fillStyle = '#111';
  for (const r of covers) ctx.fillRect(r.x, r.y, r.w, r.h);
  page.cleanup();
  return { c, W, H, side, covers, gone: auto.gone };
}
// src/app/claude.js
const shareDocs = (st, all) => layoutOf(st).filter(d => all || docIn(st, d)).map(d => ({ ...d, pages: d.pages.filter(([path]) => { const f = fileByPath(st, path); return f && !f.virtual && viewable(f); }) })).filter(d => d.pages.length);
// src/app/media.js
async function docxHtml(bytes) {
  const r = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
  // A link in a student's Word file keeps only web or email addresses, so a planted script link can't run here.
  const t = document.createElement('template'); t.innerHTML = r.value;
  for (const el of t.content.querySelectorAll('*')) for (const at of [...el.attributes]) if (/^on/i.test(at.name)) el.removeAttribute(at.name);
  for (const a of t.content.querySelectorAll('a[href]')) if (!/^(https?:|mailto:|#)/i.test(a.getAttribute('href').trim())) a.removeAttribute('href');
  for (const im of t.content.querySelectorAll('img[src]')) if (!/^data:image\//i.test(im.getAttribute('src'))) im.removeAttribute('src');
  return t.innerHTML;
}
// src/app/library.js
const ME_OLD = { sys: 'ManageBac', unit: 'Atlas', scale12: true, ai: 'Claude' };   // scale12: Rubric setup offers the 12-point scale (12 = 100, 11 = 95…) as a preset
// src/app/library.js
const me = () => lib.me || ME_OLD;
// src/app/library.js
const GRADE_WAYS = [
  ['rubric', 'Rubric rows', 'Score each row 0 to 4, half points too. The total and percent add up by themselves.', { mode: 'rubric', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 10, scale: null }, null],
  ['points', 'Points', 'Type a total, like 17 out of 20. Each assignment has its own “out of”.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 20, scale: null }, null],
  ['percent', 'Percent', 'Type a percent for each paper.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 100, scale: null }, null],
  ['letters', 'Letter grades', 'A to F, worked out from the percent. You set where each letter starts.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 100, scale: null }, [[90, 'A'], [80, 'B'], [70, 'C'], [60, 'D'], [0, 'F']]],
  ['myp', 'IB MYP criteria', 'Each criterion is marked 0 to 8. You choose the level that fits best, and the total becomes a final grade of 1 to 7.', { mode: 'rubric', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 10, scale: null }, null],   // new classes start as MYP classes (classNewWay, ib.js)
  ['ib7', 'IB DP 1 to 7', 'A final grade of 1 to 7, worked out from the percent, as in the Diploma. You set the boundaries for your subject.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 100, scale: null }, [[85, '7'], [70, '6'], [55, '5'], [40, '4'], [25, '3'], [10, '2'], [0, '1']]],
];
// src/app/library.js
const gradeWay = k => GRADE_WAYS.find(w => w[0] === k) || null;
// src/app/library.js
function meGrade() {
  const g = me().grade; if (!g || typeof g !== 'object') return null;
  const w = gradeWay(g.way) || GRADE_WAYS[0], su = g.setup && typeof g.setup === 'object' ? g.setup : w[3];
  const bands = Array.isArray(g.bands) ? g.bands.filter(b => Array.isArray(b) && isFinite(+b[0]) && String(b[1] || '').trim()).map(b => [+b[0], String(b[1]).trim().slice(0, 12)]).sort((a, b) => b[0] - a[0]) : null;
  return { way: w[0], setup: { mode: su.mode === 'points' ? 'points' : 'rubric', criteria: Array.isArray(su.criteria) && su.criteria.length ? su.criteria.map(String) : w[3].criteria.slice(), outOf: +su.outOf || w[3].outOf, scale: su.scale && typeof su.scale === 'object' ? su.scale : null, ...rowScaleOf(su) }, bands: bands && bands.length ? bands : null };
}
// src/app/library.js
function bandOf(pct) {
  const dp = batch ? batchClass() : null;   // a paper of a DP class: that class's own boundaries, whatever the teacher's usual way (ib.js)
  if (dp && classWay(dp) === 'dp') { const v = pct == null || isNaN(pct) ? null : ibGradeOf(roundPct(pct), ibBounds(dp)); return v == null ? '' : String(v); }
  const g = meGrade(); if (!g || !g.bands || pct == null || isNaN(pct)) return '';
  const b = g.bands.find(b => pct >= b[0]); return b ? b[1] : g.bands[g.bands.length - 1][1];
}
// src/app/kept.js
const fmtDay = t => new Date(t).toLocaleDateString(LANG_LOCALE, { month: 'short', day: 'numeric' });
// src/app/anon.js
function rosterNames() {
  const c = batchClass(), out = new Map();
  if (c && c.names.length) for (const [n, st] of rosterMatch(c.names)) out.set(st, n);
  return out;
}
// src/app/lighting.js
async function ensureCounts() {
  await workerReady;
  for (const s of batch.students) for (const f of s.files) {
    if (!viewable(f) || f.numPages || f.bad) continue;
    try { const d = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise; f.numPages = d.numPages; d.destroy(); } catch (e) { pdfBad(f, e); }
  }
}
// src/app/word.js
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
// src/app/word.js
const W14_NS = 'http://schemas.microsoft.com/office/word/2010/wordml';
// src/app/word.js
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
// src/app/word.js
const wkids = (el, name) => el ? [...el.children].filter(c => c.localName === name) : [];
// src/app/word.js
const wkid = (el, name) => wkids(el, name)[0] || null;
// src/app/word.js
const wval = el => el ? (el.getAttributeNS(W_NS, 'val') ?? el.getAttribute('w:val')) : null;
// src/app/word.js
const won = el => !!el && !/^(0|false|off|none)$/i.test(wval(el) || '');
// src/app/word.js
const HLC = { yellow: '#FFFF00', green: '#00FF00', cyan: '#00FFFF', magenta: '#FF00FF', blue: '#0000FF', red: '#FF0000', darkBlue: '#00008B', darkCyan: '#008B8B', darkGreen: '#006400', darkMagenta: '#800080', darkRed: '#8B0000', darkYellow: '#808000', darkGray: '#A9A9A9', lightGray: '#D3D3D3', black: '#000000', white: '#FFFFFF' };
// src/app/word.js
function openWord(bytes) {
  const files = fflate.unzipSync(bytes);
  const xml = files['word/document.xml']; if (!xml) throw new Error('no document.xml');
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(xml), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('bad xml');
  const rels = {}, rx = files['word/_rels/document.xml.rels'];
  if (rx) for (const r of new DOMParser().parseFromString(new TextDecoder().decode(rx), 'application/xml').getElementsByTagName('Relationship')) rels[r.getAttribute('Id')] = r.getAttribute('Target');
  return { files, doc, rels, paras: [], runs: [], cells: [], boxes: [], urls: [], macros: !!files['word/vbaProject.bin'] };
}
// src/app/word.js
function renderWord(w, host) {
  for (const u of w.urls) URL.revokeObjectURL(u);
  w.paras = []; w.runs = []; w.cells = []; w.boxes = []; w.urls = [];
  host.innerHTML = '';
  const body = wkid(w.doc.documentElement, 'body');
  wBlocks(w, body, host);
}
// src/app/word.js
function wBlocks(w, node, out) {
  for (const c of node ? node.children : []) {
    if (c.localName === 'p') out.appendChild(wPara(w, c));
    else if (c.localName === 'tbl') out.appendChild(wTable(w, c));
    else if (c.localName === 'sdt') wBlocks(w, wkid(c, 'sdtContent'), out);
    else if (c.localName === 'customXml' || c.localName === 'ins') wBlocks(w, c, out);
  }
}
// src/app/word.js
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
// src/app/word.js
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
// src/app/word.js
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
// src/app/word.js
function wCheck(w, box) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'wchk'; b.contentEditable = 'false';
  b.dataset.ki = w.boxes.push(box) - 1;
  b.textContent = wChecked(box) ? '☒' : '☐';
  b.setAttribute('aria-pressed', wChecked(box));
  return b;
}
// src/app/word.js
function wChecked(box) {
  if (box.kind === 'sdt') { const c = [...box.cb.children].find(x => x.localName === 'checked'); return !!c && /^(1|true)$/i.test(c.getAttributeNS(W14_NS, 'val') || ''); }
  const ch = wkid(box.cbx, 'checked'); if (ch) return wval(ch) == null || won(ch);
  return won(wkid(box.cbx, 'default'));
}
// src/app/word.js
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
// src/app/word.js
const wRunText = r => [...r.children].map(c => c.localName === 't' ? c.textContent : c.localName === 'tab' ? '\t' : c.localName === 'br' || c.localName === 'cr' ? '\n' : '').join('');
// src/app/word.js
const wordSaves = new Set();   // Word edits waiting out their short pause before they're saved
// src/app/wordrubric.js
const cellNum = td => { const m = /(\d+(?:\.\d+)?)/.exec(td.textContent || ''); return m ? +m[1] : null; };
// src/app/wordrubric.js
const isShaded = td => { const b = (td.style.backgroundColor || '').replace(/\s/g, ''); return !!b && b !== 'rgb(255,255,255)' && b !== 'transparent' && b !== 'white'; };
// src/app/wordrubric.js
const LEVEL_WORD = /(?<![\p{L}])(?:score|level|band|marks?|points?|pts)(?![\p{L}])/iu;
// src/app/wordrubric.js
function levelsSure(tds) {
  const txt = tds.map(td => (td.textContent || '').replace(/\s+/g, ' ').trim()), v = tds.map(cellNum);
  if (tds.length < 2 || txt.some(t => t.length > 30 || (t.match(/\d+(?:\.\d+)?/g) || []).length !== 1)) return false;
  return txt.every(t => LEVEL_WORD.test(t)) || (v.every((x, i) => !i || x <= v[i - 1]) && v[0] > v[v.length - 1]);
}
// src/app/wordrubric.js
const wordTabOn = new Set();
// src/app/wordrubric.js
function wordTableCounts(f, m) {
  if (f.virtual || f.rubric || m.sure || (batch && wordTabOn.has(batch.id))) return true;
  const st = batch && batch.students.find(x => x.files.includes(f) || (x.gone || []).includes(f)), s = st && rubricScore(m);
  if (!s || s.total == null) return false;
  return (st.grade.reads || {})['w|' + wordTableSays(s.per, m.crits)] === 1 || (!!f.edited && ownGrade(st).total === s.total);
}
// src/app/wordrubric.js
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
      const m = { cells, crits, levels: [...new Set(side.filter(lvl))], sure: levelsSure(rows.slice(1).filter((r, k) => lvl(side[k])).map(r => r[0])) };
      if (!best || cells.length > best.cells.length) best = m;
      continue;
    }
    // levels across the top (4 | 3 | 2 | 1 columns, criteria down the side)
    const top = rows[0].map((td, c) => c ? cellNum(td) : null);
    if (top.filter(lvl).length >= 2) {
      const cells = [];
      rows.slice(1).forEach((r, k) => r.forEach((td, c) => { if (c && lvl(top[c])) cells.push({ td, crit: k, val: top[c] }); }));
      const m = { cells, crits: rows.slice(1).map(r => r[0] ? r[0].textContent.trim() : 'Criterion'), levels: [...new Set(top.filter(lvl))], sure: levelsSure(rows[0].filter((td, c) => lvl(top[c]))) };
      if (!best || cells.length > best.cells.length) best = m;
    }
  }
  if (best) { best.scale = scale; best.max = best.crits.length * Math.max(...best.levels); }
  return best;
}
// src/app/wordrubric.js
const wordPct = (total, max, scale) => total == null ? null : percentWith(total, max, scale || (maxPoints() === max ? setup.scale : null));
// src/app/wordrubric.js
function rubricScore(m) {
  const per = m.crits.map((_, i) => { const v = m.cells.filter(c => c.crit === i && isShaded(c.td)).map(c => c.val); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; });
  const done = per.filter(v => v != null);
  const total = done.length ? Math.round(done.reduce((a, b) => a + b, 0) * 100) / 100 : null;
  return { per, total, done: done.length === per.length, pct: wordPct(total, m.max, m.scale) };
}
// src/app/wordrubric.js
function wordScore(f) {
  if (f.kind !== 'docx' || !f.data) return null;
  if (f.wsOf === f.data) return f.wscore;
  let s = null;
  try {
    const w = openWord(f.data), page = document.createElement('div'); page.className = 'dpage'; w.pRuns = []; renderWord(w, page);
    const m = rubricModel(page);
    f.wtab = !!m;   // a table that could be a rubric, whether or not it counts as one
    if (m && wordTableCounts(f, m)) s = { ...rubricScore(m), max: m.max, nCrit: m.crits.length, crits: m.crits, scale: m.scale, get pct() { return wordPct(this.total, this.max, this.scale); } };
    f.wtyped = wordTyped(page, m);
    f.wtext = [...page.querySelectorAll('p')].map(p => p.textContent).join('\n') || page.textContent; f.wpic = !!page.querySelector('img');
  } catch (e) { console.error(e); f.wtyped = []; f.wtext = null; }
  f.wsOf = f.data; f.wscore = s;
  return s;
}
// src/app/wordrubric.js
function wordTyped(page, m) {
  const rub = m && m.cells.length ? m.cells[0].td.closest('table.wt') : null, out = [];
  const skip = new Set(rub ? [rub] : []);
  for (const t of page.querySelectorAll('table.wt')) if ([...t.querySelectorAll('td')].filter(td => { const g = parseGrade(td.textContent, false); return g && g.rank >= 1; }).length >= 3) skip.add(t);
  for (const p of page.querySelectorAll('p')) {
    const t = p.closest('table.wt'); if (t && [...skip].some(k => k.contains(t))) continue;
    const text = p.textContent.replace(/\s+/g, ' ').trim(); if (!text) continue;
    const g = parseGrade(text, false); if (!g || g.rank < 2) continue;
    // written out as a grade: worked out to a percent ("10/12 = 85%"), or with the word for it right against the number ("Total: 11/12", "10/12 points")
    const asGrade = (g.rank === 3 && !(g.loose && !g.eq && g.outOf == null)) || (g.at != null && (GRADE_BEFORE.test(text.slice(0, g.at)) || GRADE_AFTER.test(text.slice(g.at + g.len))));
    out.push({ rank: g.rank, loose: g.loose, eq: g.eq, several: g.several, counts: g.counts, score: g.score, outOf: g.outOf, pct: g.pct, text: text.length > 80 ? text.slice(0, 80) + '…' : text, word: true, asGrade });
  }
  return out;
}
// src/app/wordrubric.js
const wordTableSays = (per, crits) => { const t = 'Shaded boxes in a table: ' + per.map(v => v == null ? '–' : fmtNum(v)).join(', ') + ' (' + crits.join(', ') + ')'; return t.length > 140 ? t.slice(0, 140) + '…' : t; };
// src/app/wordrubric.js
function wordTableRead(f) {
  const w = f.wscore;
  return { rank: 3, score: w.total, outOf: w.max, pct: w.pct, table: true, word: true, text: wordTableSays(w.per, w.crits) };
}
// src/app/wordrubric.js
const wordFound = (f, st) => {
  if (f.kind !== 'docx' || f.wsOf !== f.data) return [];
  if (f.wscore && f.wscore.total != null) return f.virtual ? [] : [wordTableRead(f)];
  if (f.virtual) return f.edited ? f.wtyped || [] : [];
  const rd = (st && st.grade && st.grade.reads) || {};
  return (f.wtyped || []).filter(g => g.asGrade || rd[readKey(g)] === 1).map(g => ({ ...g, theirs: true }));
};
// src/app/wordrubric.js
function wordScoresOf(st) { for (const f of st.files) wordScore(f); }
// src/names.js
const THAI_PUA = '\u0E10\u0E34\u0E35\u0E36\u0E37\u0E48\u0E49\u0E4A\u0E4B\u0E4C\u0E48\u0E49\u0E4A\u0E4B\u0E4C\u0E0D\u0E31\u0E4D\u0E47\u0E48\u0E49\u0E4A\u0E4B\u0E4C\u0E38\u0E39\u0E3A';
// src/names.js
const thaiPlain = s => /[\uF700-\uF71A]/.test(s) ? s.replace(/[\uF700-\uF71A]/g, c => THAI_PUA[c.charCodeAt(0) - 0xF700]) : s;
// src/names.js
function classRx() { const N = namesNow(); return N.cls === null ? (N.cls = N.classSrc ? new RegExp(N.classSrc, 'gu') : false) || null : N.cls || null; }
// src/names.js
const nameFindOn = () => !!store.get('gs.nameFind', false);
// src/names.js
const paperKey = (st, d) => st.key + '\n' + d.pages.map(([path, p]) => boxKey(path, p) + '|' + coverSig(fileByPath(st, path))).join('\n');
// src/names.js
async function classCommon() {
  await ensureCounts();
  const N = namesNow(), list = coverList(), key = list.map(x => paperKey(x.st, x.d)).join('\n');
  if (N.commonKey === key) return N.common;
  const count = new Map(), rx = N.classSrc && list.length >= 3 ? new RegExp(N.classSrc, 'gu') : null;
  if (rx) for (const { st, d } of list) {
    const seen = new Set(), docs = new Map();
    try {
      for (const [path, p] of d.pages) {
        const f = fileByPath(st, path);
        if (!docs.has(path)) docs.set(path, await pdfjsLib.getDocument({ data: (await viewBytes(f)).slice(), isEvalSupported: false }).promise);
        const page = await docs.get(path).getPage(p + 1), t = (await page.getTextContent()).items.map(it => thaiPlain(it.str)).join('\n').normalize('NFKC');
        page.cleanup();
        for (const m of t.matchAll(rx)) if (m[0] && rawWords(m[0]).length === 1 && !/[@\d]/.test(m[0])) seen.add(nameFold(m[0]));
      }
    } catch (er) { console.error(er); }
    finally { for (const js of docs.values()) js.destroy(); }
    for (const w of seen) count.set(w, (count.get(w) || 0) + 1);
  }
  const need = Math.max(3, Math.ceil(list.length * 0.4));
  N.commonKey = key;
  return N.common = new Set([...count].filter(([, n]) => n >= need).map(([w]) => w));
}
// src/names.js
function shareOpts(st) {
  const N = namesNow();
  N.parts ||= new Set(N.all.flatMap(rawWords).map(nameFold));
  return { common: N.common || new Set(), own: new Set(ownNames(st).flat().map(nameFold)), parts: N.parts };
}
// src/marking.js
const rectBox = rs => { const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y)); return { x, y, w: r1(Math.max(...rs.map(r => r.x + r.w)) - x), h: r1(Math.max(...rs.map(r => r.y + r.h)) - y) }; };
// src/marking.js
function setRects(m, rects) {
  Object.assign(m, rectBox(rects));
  if (rects.length > 1) m.rects = rects; else delete m.rects;
  return m;
}
// src/stamps.js
const PROOF = [
  ['gr', 'Grammar'], ['cap', 'Capitalize'], ['lower', 'Make lowercase'], ['insert', 'Insert'], ['para', 'New paragraph'],
  ['delete', 'Delete'], ['swap', 'Swap order'], ['space', 'Add a space'], ['close', 'Close up'],
  ['sp', 'Spelling'], ['ro', 'Run-on'], ['frag', 'Fragment'],
  ['wc', 'Word choice'], ['awk', 'Awkward'], ['vt', 'Verb tense'], ['unclear', 'Unclear'],
];
// src/stamps.js
const PUNCT = [
  ['period', 'Add a period', 'Period'], ['comma', 'Add a comma', 'Comma'], ['apos', 'Add an apostrophe', 'Apostrophe'], ['quote', 'Add quotation marks', 'Quotes'], ['semi', 'Add a semicolon', 'Semicolon'],
  ['colon', 'Add a colon', 'Colon'], ['qmark', 'Add a question mark', 'Question'], ['excl', 'Add an exclamation mark', 'Exclamation'], ['hyphen', 'Add a hyphen', 'Hyphen'], ['dash', 'Add a dash', 'Dash'],
];
// src/stamps.js
const isProof = k => PROOF.some(p => p[0] === k) || PUNCT.some(p => p[0] === k);
// src/stamps.js
const MARK_MEAN = {
  gr: 'A grammar mistake here, such as a verb that doesn’t match its subject.',
  cap: 'Make this letter a capital.', lower: 'Make this letter lowercase.',
  insert: 'Something is missing here. Add the word or letter written above it.',
  para: 'Start a new paragraph here.', delete: 'Take this out.', swap: 'Switch the order of these words or letters.',
  space: 'Put a space here.', close: 'Take out the space and join these together.',
  sp: 'This word is spelled wrong.', ro: 'Two sentences run together. Split them, or join them with the right punctuation.',
  frag: 'This isn’t a full sentence. It’s missing a subject or a verb, or the thought isn’t finished.',
  wc: 'A different word would fit better here.', awk: 'This is hard to read. Try saying it out loud and rewording it.',
  vt: 'The verb is in the wrong tense. Keep the tense the same.', unclear: 'I’m not sure what you mean here.',
  period: 'Add a period where the mark points.', comma: 'Add a comma where the mark points.', apos: 'Add an apostrophe here.',
  quote: 'Add quotation marks here.', semi: 'Add a semicolon here.', colon: 'Add a colon here.', qmark: 'Add a question mark here.',
  excl: 'Add an exclamation mark here.', hyphen: 'Add a hyphen here.', dash: 'Add a dash here.',
};
// src/stamps.js
const MARK_KEY = 'gs.markKey';
// src/stamps.js
const KEY_KINDS = PROOF.map(p => p[0]).concat(PUNCT.map(p => p[0]));
// src/stamps.js
const keySet = () => { const v = store.get(MARK_KEY, null); return v && typeof v === 'object' ? v : {}; };
// src/stamps.js
const keyOn = () => keySet().on !== false;
// src/stamps.js
const markLabel0 = k => ((PROOF.find(p => p[0] === k) || PUNCT.find(p => p[0] === k)) || [k, k])[1];
// src/stamps.js
const markLabel = k => { const v = (keySet().names || {})[k]; return typeof v === 'string' && v.trim() ? v.trim() : markLabel0(k); };
// src/stamps.js
const markMean = k => { const m = keySet().means || {}; return typeof m[k] === 'string' ? m[k].trim() : (MARK_MEAN[k] || ''); };
// src/stamps.js
function setKey(change) { const v = { ...keySet() }; change(v); store.set(MARK_KEY, v); }
// src/stamps.js
function keyRows(marks) {
  const seen = new Map();
  for (const m of marks) if (m && m.t === 'stamp' && isProof(m.k) && !seen.has(m.k)) seen.set(m.k, m.color || '#D92D20');
  return KEY_KINDS.filter(k => seen.has(k)).map(k => ({ k, color: seen.get(k), name: markLabel(k), mean: markMean(k) }));
}
// src/stamps.js
function drawKeyPage(ctx, rows, from, W, H) {
  const M = Math.max(36, Math.round(W * 0.09)), pic = 46, tx = M + pic + 10, tw = W - M - tx, UI = 'Inter, ' + FONT;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#1E2024'; ctx.font = '600 17px ' + UI; ctx.fillText(from ? 'Marks on this paper (continued)' : 'Marks on this paper', M, M + 14);
  ctx.fillStyle = '#5C616A'; ctx.font = '12.5px ' + UI; ctx.fillText('What each mark your teacher used means.', M, M + 34);
  const wrap = (t, font) => {
    ctx.font = font; const out = []; let line = '';
    for (const w of t.split(/\s+/).filter(Boolean)) { const tryL = line ? line + ' ' + w : w; if (line && ctx.measureText(tryL).width > tw) { out.push(line); line = w; } else line = tryL; }
    if (line) out.push(line); return out;
  };
  let y = M + 50, n = 0;
  const rule = yy => { ctx.fillStyle = '#E4E6EA'; ctx.fillRect(M, yy, W - 2 * M, 1); };
  rule(y);
  for (let i = from; i < rows.length; i++) {
    const r = rows[i], nm = wrap(r.name, '600 13px ' + UI), mn = r.mean ? wrap(r.mean, '12.5px ' + UI) : [];
    const h = Math.max(pic - 6, 10 + nm.length * 17 + mn.length * 17 + 6);
    if (n && y + h > H - M) break;
    drawStamp(ctx, { t: 'stamp', k: r.k, x: M + pic / 2, y: y + h / 2, size: 20, color: r.color });
    let ty = y + 10 + 12;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#1E2024'; ctx.font = '600 13px ' + UI; for (const l of nm) { ctx.fillText(l, tx, ty); ty += 17; }
    ctx.fillStyle = '#3F444C'; ctx.font = '12.5px ' + UI; for (const l of mn) { ctx.fillText(l, tx, ty); ty += 17; }
    y += h; rule(y); n++;
  }
  return n;
}
// src/grades.js
const STATUS_LABEL = { missing: 'Missing', excused: 'Excused', late: 'Late' };
// src/grades.js
function touchGrade(st, rowIndex) {
  const g = st.grade, t = Date.now();
  if (rowIndex !== 'points' && g.at && g.points !== '' && g.points != null && !(g.atR && g.atR.points)) (g.atR ||= {}).points = g.at;   // a points score from before these times were kept: when it last changed is the last we know of
  g.at = t;
  if (rowIndex != null) (g.atR ||= {})[rowIndex] = t;
  stampSoon(st);
}
// src/grades.js
const tryName = n => n === 1 ? 'First try' : 'Try ' + n;
// src/grades.js
const tryRuleSay = (rule, n) => rule === 'last' ? 'the latest try' : rule === 'avg' ? 'the average of ' + n + ' tries' : 'the highest of ' + n + ' tries';
// src/grades.js
function partNote(st) {
  if (setup.mode !== 'rubric' && quizPart(st)) return quizCount(st) + ' of ' + batch.quiz.qs.length + ' questions marked in Quick mark';
  const w = setup.mode === 'rubric' ? null : wordPart(st, +st.grade.points);
  const per = w ? w.per : setup.criteria.map((_, i) => st.grade.rubric[i]);
  return per.filter(v => v != null).length + ' of ' + per.length + ' rows scored';
}
// src/grades.js
const rowShown = (st, i) => noScore(st) ? null : st.grade.rubric[i];
// src/grades.js
const totalText = g => fmtNum(g.total) + (g.outOf != null ? ' out of ' + fmtNum(g.outOf) : '');
// src/grades.js
function scoreText(g, k) {
  if (g.status === 'missing' || g.status === 'excused') return STATUS_LABEL[g.status];
  const v = k === 'pct' ? g.pct : k === 'total' ? g.total : g.total != null ? g.total : g.pct;
  return (k === 'any' && g.total == null ? fmtPct(v) : k === 'pct' || g.total == null ? fmtNum(v) : totalText(g)) + (g.partial && v != null ? ' (partial)' : '');
}
// src/grades.js
const cellOut = (g, k) => g.total == null && g.pct == null ? '' : scoreText(g, k);
// src/grades.js
const cellCopy = (g, k) => g.status === 'missing' || g.status === 'excused' ? (k === 'total' ? STATUS_LABEL[g.status] : '') : k === 'pct' ? fmtNum(g.pct) : totalText(g);
// src/grades.js
function statusText(st) {
  const g = gradeOf(st), out = [];
  if (g.status) out.push(STATUS_LABEL[g.status]);
  if (g.tries) out.push('Retake: ' + triesSay(g).replace(/\.$/, '').replace('. Counts', '; counts'));
  if (g.out) out.push('Left out of the average');
  if (g.partial) out.push('Partial: ' + partNote(st));
  return out.join(', ');
}
// src/grades.js
function triesSay(g) {
  const all = g.tries.concat(g.tryNow ? [g.tryNow] : []);
  return all.map((t, i) => (i ? (all.length === 2 ? 'retake ' : 'try ' + (i + 1) + ' ') : 'First try ') + fmtPct(t.pct)).join(', ') + (g.tryNow ? '' : ', retake not scored yet') + '. Counts: ' + (g.tryNow ? tryRuleSay(g.tryRule, all.length) : 'the ' + (g.tries.length > 1 ? 'earlier tries' : 'first try')) + '.';
}
// src/grades.js
function gradesSummary() {
  const all = batch.students, on = all.filter(s => !noScore(s)), nOff = all.length - on.length, nPart = on.filter(s => gradeOf(s).partial).length;
  if (typeof fmNow === 'function' && fmNow()) return on.filter(s => s.grade.fb).length + ' of ' + on.length + ' feedback complete' + (nOff ? ' · ' + nOff + ' missing or excused' : '');
  return on.filter(s => gradeOf(s).done).length + ' of ' + on.length + ' scored' + (nPart ? ' · ' + nPart + ' partial' : '') + (nOff ? ' · ' + nOff + ' missing or excused' : '');
}
// src/grades.js
function csvSafe(v) {
  const t = String(v);
  return /^[\s 　]*[=+\-@＝＋－＠]/.test(t) || /^[\t\r\n]/.test(t) ? "'" + t : t;
}
// src/grades.js
function csvCell(v) {
  const t = csvSafe(v);
  return /[",;\n\r\t]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}
// src/grades.js
const tsvLine = cells => cells.map(c => csvSafe(c).replace(/[\t\r\n]+/g, ' ')).join('\t');
// src/grades.js
const NOT_A_GRADE = /(?:(?:^|[^\p{L}])(?:(?:due|dates?|dated|by|on|until|till|before|after|since|from|mon|tues?|wed|thu|thur|thurs|fri|sat|sun|pages?|questions?|turned in|handed in|submitted|posted)[ \t]*[:\-–—]?|(?:pgs?|pp?|ques|qu?)\.?)[ \t]*#?|#)[ \t]*$/iu;
// src/grades.js
const GRADE_BEFORE = /(?:^|[^\p{L}])(?:total|grade|score|scored|final|points|pts?|marks?|result|overall|rubric)(?:[ \t]+(?:is|was|of))?[ \t]*[:=\-–—(]?[ \t]*$/iu;
// src/grades.js
const GRADE_ABOVE = /(?:^|\n)[ \t]*(?:(?:your|final|total|overall)[ \t]+)?(?:total|grade|score|final|points|pts?|marks?|result|overall|rubric)[ \t]*[:=\-–—(]?[ \t]*\n[ \t]*$/iu;
// src/grades.js
const GRADE_AFTER = /^[ \t:\-–—]*(?:total|points?|pts?|marks?|overall)[ \t]*(?:[^\p{L}\d \t]|$)/iu;
// src/grades.js
const COUNTS_AFTER = /^[ \t]*(?:of\b|(?:correct|right|wrong|sources|quotes|quotations|citations|references|sentences|paragraphs|pages|words|lines|questions|problems|items|answers|responses|errors|mistakes|examples|students|people|parts|sections|criteria|requirements|tasks|steps|claims|details|ideas|reasons|arguments)\b(?![ \t]*(?:\?|(?:now|the|an?|your|more|well)\b)))/iu;
// src/grades.js
const REDONE_BEFORE = /(?:^|[^\p{L}])(?:re-?writes?|re-?written|revised|revisions?|re-?do(?:ne)?|re-?submi\p{L}+|drafts?|now|new|updated)[ \t]*[:=\-–—(]?[ \t]*$/iu;
// src/grades.js
function gradeContext(before, after, text) {
  const eq = /=|→|->/.test(text);
  if (NOT_A_GRADE.test(before)) return { no: !eq, loose: true, eq: false };
  return { no: false, eq, loose: /[\p{L}\d]/u.test(before + after) && !GRADE_BEFORE.test(before) && !GRADE_ABOVE.test(before) && !GRADE_AFTER.test(after) };
}
// src/grades.js
const TAKEN_TO_BEFORE = /(?:→|->|(?:^|[^\p{L}])(?:revised|raised|changed|moved)[ \t]+to)[ \t]*$/iu;
// src/grades.js
const WORD_MAY_FOLLOW = /(?:[:=\-–—(]|(?:^|[^\p{L}])(?:re-?writes?|re-?written|revised|re-?do(?:ne)?|re-?submi\p{L}+|updated|score|scored))[ \t]*$/iu;   // "Revised: 10 shows growth", but not "Grade 10 English" or "Draft 2 looks better"
// src/grades.js
const DOCKED_BEFORE = /(?:[-−+]|(?:^|[^\p{L}])(?:lost|lose|loses|losing|minus|plus|missing|deduct\p{L}*|takes?|took|taking|another|extra|bonus|worth|each|per|more|less)[ \t]+)$/iu;   // "Lost 2 points", "-2 pts"
// src/grades.js
const PART_BEFORE = /(?:^|[.!?;,\n])[ \t]*\p{L}+[ \t]*[:\-–—]?[ \t]*$/u;   // "Thesis 3 points", "Evidence: 4 pts"
// src/grades.js
function labelledNumber(before, after) {
  if (!GRADE_BEFORE.test(before) && !GRADE_ABOVE.test(before) && !REDONE_BEFORE.test(before) && !TAKEN_TO_BEFORE.test(before)) return GRADE_AFTER.test(after) && !DOCKED_BEFORE.test(before) && !PART_BEFORE.test(before);
  return !COUNTS_AFTER.test(after) && (!/^[ \t]*\p{L}/u.test(after) || GRADE_AFTER.test(after) || WORD_MAY_FOLLOW.test(before));
}
// src/grades.js
function readingDoubt(g) {
  if (g.rank == null) return '';   // a Word rubric's own highlighted score
  const max = maxPoints();
  if (g.several) return 'This comment has more than one grade in it, so check this is the one you want.';
  if (g.score != null && g.outOf != null && g.score > g.outOf) return 'The score is more than it’s out of.';
  if (g.pct != null && g.pct > 110) return 'That percent is over 100.';
  if (g.outOf != null && g.outOf !== max) return 'It’s out of ' + fmtNum(g.outOf) + ', but this assignment is out of ' + max + '.';
  if (g.score != null && max && g.score > max) return 'That’s more than the ' + max + ' points this assignment is out of.';
  if (g.table) return 'These are shaded boxes in a Word table. Use it if this is your rubric. It may be the student’s own table.';
  if (g.theirs) return g.word ? 'It’s typed in the student’s Word file, so they may have typed it themselves.' : 'It’s part of the page’s own text, so the student may have typed it. A flattened Kami grade looks the same.';
  if (g.boxed) return '';   // she drew the box around it
  if (g.rank === 0.5 && g.score < max / 2) return 'A number on its own, this small, may not be the total.';
  if (g.loose && !g.eq) return 'It’s inside a longer comment, so it may not be the grade.';
  return '';
}
// src/grades.js
const readKey = g => (g.page != null ? g.page : 'w') + '|' + g.text;
// src/grades.js
const rivalReads = st => (st.doubts || []).filter(g => !g.counts);
// src/grades.js
const readsCount = st => (st.foundAll || []).length + rivalReads(st).length;
// src/grades.js
const manyReads = st => readsCount(st) > 1;
// src/grades.js
function splitReads(st, list) {
  const rd = st.grade.reads || {}, out = { ok: [], ask: [], no: [], yes: [], mine: [] };
  for (const g of list) {
    const a = rd[readKey(g)];
    if (g.table && a == null && ownGrade(st).total === g.score) { out.ok.push(g); out.mine.push(g); }   // she scored this table already, by its boxes or from an older copy of the app: nothing to ask, and her score is what counts
    else if (a === 0) out.no.push(g);
    else if (a === 1) { out.ok.push(g); if (readingDoubt(g)) out.yes.push(g); }
    else if (readingDoubt(g)) out.ask.push(g);
    else out.ok.push(g);
  }
  return out;
}
// src/grades.js
function disagreeNote(st) {
  const own = ownGrade(st);
  if (own.total == null || own.partial) return '';
  const ps = paperScore(st);
  const many = manyReads(st) ? [...new Set([...(st.foundAll || []), ...rivalReads(st)].filter(g => g.score != null).map(g => g.score))] : [];
  if (many.length && !many.some(v => Math.abs(v - own.total) <= 0.001)) return 'Your score is ' + fmtNum(own.total) + ', the paper says ' + many.map(fmtNum).join(' and ');
  if (ps != null && Math.abs(ps - own.total) > 0.001) return 'Your score is ' + fmtNum(own.total) + ', the paper says ' + fmtNum(ps);
  if (ps == null && st.found && st.found.found && st.found.pct != null && own.pct != null && Math.abs(st.found.pct - own.pct) > 1) return 'Your score is ' + fmtPct(own.pct) + ', the paper says ' + fmtPct(st.found.pct);
  const ws = st.files.map(wordScore).filter(w => w && w.total != null);
  if (ws.length === 1 && Math.abs(ws[0].total - own.total) > 0.001) return 'Your score is ' + fmtNum(own.total) + ', the Word rubric says ' + fmtNum(ws[0].total);
  return '';
}
// src/exportreport.js
function exportWhy(er, toFolder) {
  const n = er && er.name, msg = String((er && er.message) || er || '');
  if (n === 'PageTooBig') return 'one of its pages is too big to put your marks on. If you picked Extra sharp, try Standard';
  if (n === 'PasswordException' || /password/i.test(msg)) return 'it’s password-protected';
  if (n === 'QuotaExceededError') return toFolder ? 'there’s no room left on the disk' : 'this computer ran out of room';
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'the folder didn’t allow saving it';
  if (n === 'NoModificationAllowedError') return 'the file is open in another program, or the folder is read-only';
  if (n === 'InvalidPDFException' || n === 'MissingPDFException' || /invalid pdf|failed to parse|no pdf header/i.test(msg)) return 'the PDF is damaged';
  return 'something went wrong while making it (' + msg.slice(0, 120) + ')';
}
// src/feedback.js
const fbOn = () => store.get('gs.xfb', true) !== false;
// src/feedback.js
const FB_INK = '#1E2024', FB_INK2 = '#3F444C', FB_MUTED = '#5C616A', FB_LINE = '#E4E6EA', FB_BLUE = '#1F6FB2', FB_SOFT = '#E6F0F8';
// src/feedback.js
function fbData(st, d) {
  // A retake: each paper carries its own try's score, rows and comment. The newer one also says what counts when that isn't its own score.
  const tries = st.grade.tries || [], tn = tries.length ? tryOfFile(st, fileByPath(st, (d.pages[0] || [])[0]) || (d.words && d.words[0])) : 0, old = tn ? tries[tn - 1] : null, cnt = tries.length && !old ? gradeOf(st) : null;
  const g = old ? { total: old.total, pct: old.pct, outOf: old.max, status: old.late ? 'late' : '' } : tries.length ? tryGrade(st) : gradeOf(st), rub = setup.mode === 'rubric', c = batchClass();
  if (cnt && !g.status && st.grade.status === 'late') g.status = 'late';
  const rubricOf = old ? old.rubric || [] : st.grade.rubric;
  const rows = rub ? setup.criteria.map((name, i) => { const v = rubricOf[i]; return v == null ? null : { name, v, ...(rowTop(setup, i) !== ROW_TOP ? { top: rowTop(setup, i) } : {}), text: ((setup.levels && setup.levels[i] && setup.levels[i][Math.floor(v)]) || '').trim() }; }).filter(Boolean) : [];
  const notes = [];
  d.pages.forEach(([path, p], k) => {
    const f = fileByPath(st, path); if (!f) return;
    const all = (f.marks[p] || []).concat((f.kami && f.kami[p] && f.kami[p].notes) || []).filter(m => m.t === 'note' && (m.text || '').trim());
    const numbered = all.filter(n => n.hl).sort((a, b) => a.ay - b.ay || a.ax - b.ax);   // the numbers the page itself shows
    for (const n of [...all].sort((a, b) => a.ay - b.ay || a.ax - b.ax)) notes.push({ n: numbered.indexOf(n) + 1, text: n.text.trim(), color: n.color, page: k });
  });
  const comment = ((old ? old.comment : st.grade.comment) || '').trim(), scored = g.total != null && !g.partial && !ibSetup();   // an MYP task goes back with its levels, no total
  const trySay = old ? tr(tryName(tn)) : cnt ? tr('Retake') + (cnt.tryNow && cnt.pct !== g.pct ? ' · ' + tr('counts as') + ' ' + fmtPct(cnt.pct) : '') : '';
  if (!scored && !rows.length && !comment && !notes.length) return null;
  const rn = rosterNames(), who = rn.get(st) || st.key;   // the paper goes back to its student, so it carries their name even while she marks with names hidden
  return { title: (batch.assignment && batch.assignment.name) || batch.name, sub: [who, c && c.name, tr('returned ' + fmtDay(Date.now()))].filter(Boolean).join(' · '),
    total: scored ? g.total : null, max: g.outOf != null ? g.outOf : maxPoints(), pct: scored ? g.pct : null, status: [g.status ? tr(STATUS_LABEL[g.status]) : '', trySay].filter(Boolean).join(' · '), rows, comment, notes };
}
// src/feedback.js
function fbWrap(ctx, t, font, w) {
  ctx.font = font; const lines = [];
  for (const para of String(t).split(/\n/)) {
    let line = '';
    for (let word of para.split(/\s+/).filter(Boolean)) {
      while (ctx.measureText(word).width > w) { let k = word.length - 1; while (k > 1 && ctx.measureText(word.slice(0, k)).width > w) k--; if (line) { lines.push(line); line = ''; } lines.push(word.slice(0, k)); word = word.slice(k); }   // a word longer than the line
      const t2 = line ? line + ' ' + word : word;
      if (line && ctx.measureText(t2).width > w) { lines.push(line); line = word; } else line = t2;
    }
    lines.push(line);
  }
  while (lines.length > 1 && !lines[lines.length - 1]) lines.pop();
  return lines;
}
// src/feedback.js
function fbBlocks(ctx, data, W, M, off) {
  const UI = 'Inter, ' + FONT, cw = W - 2 * M, out = [];
  const wrap = (t, font, w) => fbWrap(ctx, t, font, w);
  const text = (lines, font, color, x, y, lh) => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh)); };
  const cap = t => out.push({ h: 34, draw: y => { ctx.font = '600 8.5px ' + UI; ctx.fillStyle = FB_MUTED; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; try { ctx.letterSpacing = '0.9px'; } catch { } ctx.fillText(t.toUpperCase(), M, y + 26); try { ctx.letterSpacing = '0px'; } catch { } } });

  // the assignment, whose paper it is, and the score
  const big = data.total != null ? fmtNum(data.total) : '', of = data.total != null && data.max ? ' / ' + fmtNum(data.max) : '';
  ctx.font = '700 28px ' + UI; const bw = ctx.measureText(big).width; ctx.font = '13px ' + UI; const ow = ctx.measureText(of).width;
  const sw = big ? Math.max(bw + ow, 64) + 18 : data.status ? 110 : 0;
  const tl = wrap(data.title, '700 19px ' + UI, cw - sw), sl = wrap(data.sub, '11.5px ' + UI, cw - sw);
  const hh = Math.max(tl.length * 24 + sl.length * 16 + 6, big ? 56 : 0) + 14;
  out.push({ h: hh + 4, draw: y => {
    text(tl, '700 19px ' + UI, FB_INK, M, y + 20, 24);
    text(sl, '11.5px ' + UI, FB_MUTED, M, y + 20 + (tl.length - 1) * 24 + 20, 16);
    ctx.textAlign = 'right';
    if (big) {
      ctx.font = '13px ' + UI; ctx.fillStyle = FB_MUTED; ctx.fillText(of, M + cw, y + 24);
      ctx.font = '700 28px ' + UI; ctx.fillStyle = FB_INK; ctx.fillText(big, M + cw - ow, y + 24);
      if (data.pct != null) { ctx.font = '700 14px ' + UI; ctx.fillStyle = FB_BLUE; ctx.fillText(data.pct + '%', M + cw, y + 44); }
      if (data.status) { ctx.font = '11px ' + UI; ctx.fillStyle = FB_MUTED; ctx.fillText(data.status, M + cw, y + (data.pct != null ? 59 : 44)); }
    } else if (data.status) { ctx.font = '600 13px ' + UI; ctx.fillStyle = FB_MUTED; ctx.fillText(data.status, M + cw, y + 20); }
    ctx.textAlign = 'left'; ctx.fillStyle = FB_INK; ctx.fillRect(M, y + hh - 1, cw, 1.2);
  } });

  // each rubric row: its name, the level given as words and as a bar, and what that level means
  if (data.rows.length) {
    cap(tr('How it was scored'));
    const nameW = Math.min(132, Math.round(cw * 0.25)), barW = 96, tx = M + nameW + barW + 14, tw = cw - nameW - barW - 14, any = data.rows.some(r => r.text);
    out.push({ h: 1, draw: y => { ctx.fillStyle = FB_LINE; ctx.fillRect(M, y, cw, 1); } });
    for (const r of data.rows) {
      const nl = wrap(r.name, '600 12.5px ' + UI, (any ? nameW : cw - barW - 14) - 10), dl = r.text ? wrap(r.text, '11.5px ' + UI, tw) : [];
      const h = Math.max(nl.length * 16, dl.length * 16, 30) + 18, bx = any ? M + nameW : M + cw - barW;
      out.push({ h, draw: y => {
        text(nl, '600 12.5px ' + UI, FB_INK, M, y + 21, 16);
        const top = r.top || ROW_TOP, sw = (89 - (top - 1) * 3) / top;   // one segment for each point, the same width in all as four always were; a half point fills half of one
        text([tr(fmtNum(r.v) + ' of ' + top)], '600 12px ' + UI, FB_BLUE, bx, y + 21, 16);
        for (let k = 0; k < top; k++) {
          const x = bx + k * (sw + 3), fill = Math.max(0, Math.min(1, r.v - k));
          ctx.fillStyle = FB_LINE; ctx.fillRect(x, y + 28, sw, 3.5);
          if (fill) { ctx.fillStyle = FB_BLUE; ctx.fillRect(x, y + 28, sw * fill, 3.5); }
        }
        text(dl, '11.5px ' + UI, FB_INK2, tx, y + 21, 16);
        ctx.fillStyle = FB_LINE; ctx.fillRect(M, y + h - 1, cw, 1);
      } });
    }
  }

  // her comment to the student
  if (data.comment) {
    cap(tr('From your teacher'));
    const cl = wrap(data.comment, '12.5px ' + UI, cw - 28);
    // one block a line, so a long comment runs on to the next page where the page ends
    cl.forEach((line, i) => {
      const first = !i, last = i === cl.length - 1, h = 19 + (first ? 11 : 0) + (last ? 11 : 0);
      out.push({ h, draw: y => {
        ctx.fillStyle = FB_SOFT; ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(M, y, cw, h + (last ? 0 : 0.5), [first ? 6 : 0, first ? 6 : 0, last ? 6 : 0, last ? 6 : 0]); else ctx.rect(M, y, cw, h);
        ctx.fill();
        text([line], '12.5px ' + UI, FB_INK, M + 14, y + (first ? 11 : 0) + 14, 19);
      } });
    });
  }

  // every comment written on the paper, with its number there and its page in this file
  if (data.notes.length) {
    cap(tr(data.notes.length === 1 ? 'Comment on your paper' : 'Comments on your paper'));
    for (const n of data.notes) {
      const nl = wrap(n.text, '12px ' + UI, cw - 26 - 44), h = nl.length * 17 + 9, page = tr('p. ' + (n.page + 1 + off));
      const [r, g, b] = rgb(n.color || '#C8321F'), col = 'rgb(' + Math.round(r * 0.8) + ',' + Math.round(g * 0.8) + ',' + Math.round(b * 0.8) + ')';
      out.push({ h, draw: y => {
        if (n.n) {
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(M + 7, y + 11, 7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = '700 ' + (n.n > 9 ? 7.5 : 8.5) + 'px ' + UI; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n.n), M + 7, y + 11.4);
        } else { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(M + 7, y + 11, 2.6, 0, Math.PI * 2); ctx.fill(); }
        text(nl, '12px ' + UI, FB_INK, M + 26, y + 15, 17);
        ctx.font = '11px ' + UI; ctx.fillStyle = FB_MUTED; ctx.textAlign = 'right'; ctx.fillText(page, M + cw, y + 15); ctx.textAlign = 'left';
      } });
    }
  }
  return out;
}
// src/feedback.js
function fbPages(blocks, top, bottom) {
  const pages = [[]]; let y = top;
  blocks.forEach((b, i) => {
    const next = blocks[i + 1], need = b.h + (b.h === 34 && next ? next.h : 0);
    if (pages[pages.length - 1].length && y + need > bottom) { pages.push([]); y = top; }
    pages[pages.length - 1].push(b); y += b.h;
  });
  return pages;
}
// src/feedback.js
async function fbAddPages(out, data, W, H, dpi, more) {
  if (!(W >= 400 && H >= 500 && W <= 1300 && H <= 1300) || W > H) { W = 612; H = 792; }
  const M = Math.max(44, Math.round(W * 0.095)), top = M, bottom = H - M - 22, UI = 'Inter, ' + FONT, scale = dpi / 72;
  const probe = document.createElement('canvas').getContext('2d');
  // The page numbers beside the comments count the feedback pages, so lay out until the count settles (it almost always is one page).
  let n = 1, pages;
  for (let pass = 0; pass < 3; pass++) { pages = fbPages(fbBlocks(probe, data, W, M, n), top, bottom); if (pages.length === n) break; n = pages.length; }
  for (let i = 0; i < pages.length; i++) {
    const c = document.createElement('canvas'); c.width = Math.ceil(W * scale); c.height = Math.ceil(H * scale);
    const ctx = c.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    // the same blocks, measured again on this canvas so they draw on it
    const mine = fbPages(fbBlocks(ctx, data, W, M, pages.length), top, bottom)[i] || [];
    let y = top; for (const b of mine) { b.draw(y); y += b.h; }
    ctx.font = '10px ' + UI; ctx.fillStyle = FB_MUTED; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(tr(i === pages.length - 1 && !more ? 'Your marked paper starts on the next page.' : 'Your feedback continues on the next page.'), M, H - M + 6);
    out.addPage([W, H]).drawImage(await out.embedJpg(await canvasJpg(c, 0.92)), { x: 0, y: 0, width: W, height: H });
    c.width = c.height = 0;
  }
  return pages.length;
}
// src/rubrics.js
function onThisScale(st, g, max) {
  if (g.total == null || !(g.total >= 0 && g.total <= max)) return false;
  const typed = hasSheet(st.grade) && !isNaN(+st.grade.sheet);
  return !(g.paper && !typed && st.found && st.found.outOf != null && st.found.outOf !== max);   // a confirmed 10/15 on a 12-point assignment
}
// src/rubrics.js
function spreadBins(counted, max) {
  if (!max) return [];
  const w = max <= 20 ? 1 : Math.ceil(max / 10), bins = [];
  for (let lo = 0; lo < max || (w === 1 && lo === max); lo += w) bins.push({ lo, top: w === 1 && lo === max, label: w === 1 && lo === max ? fmtNum(lo) : fmtNum(lo) + ' to under ' + fmtNum(Math.min(lo + w, max)), who: [] });
  if (w > 1 || max % 1) bins[bins.length - 1].label = fmtNum(bins[bins.length - 1].lo) + ' to ' + fmtNum(max);
  for (const x of counted) bins[Math.min(Math.floor(x.total / w), bins.length - 1)].who.push(x.name);
  return bins;
}
// src/rubrics.js
function classStats() {
  const max = maxPoints(), s = { counted: [], partial: [], notScored: [], missing: [], excused: [], offScale: [], ownOff: [], leftOut: [], rosterOnly: [], rows: [] };
  batch.students.forEach((st, i) => {
    const g = gradeOf(st), who = { i, name: shownName(st, i) };
    if (g.status === 'missing' || g.status === 'excused') s[g.status].push(who);
    else if (g.partial) s.partial.push({ ...who, note: partNote(st) });
    else if (!g.done || (g.total == null && g.pct == null)) s.notScored.push({ ...who, note: !st.files.length ? 'No paper' : st.foundCount > 1 || (st.doubts && st.doubts.length) ? 'A grade on the paper to confirm' : '' });
    else if (g.out) s.leftOut.push(who);   // left out of the average by the teacher; one with no score yet is still "not scored"
    else if (!onThisScale(st, g, max) && !g.paper) s.ownOff.push({ ...who, note: 'You gave ' + fmtNum(g.total) + ', out of ' + fmtNum(max) });
    else if (!onThisScale(st, g, max)) s.offScale.push({ ...who, note: g.total != null ? 'The paper says ' + (g.paper && st.found && st.found.outOf != null ? fmtNum(g.total) + ' out of ' + fmtNum(st.found.outOf) : fmtNum(g.total)) : 'The paper says ' + fmtPct(g.pct) });
    else s.counted.push({ ...who, total: g.total, pct: g.pct, late: g.status === 'late', paper: !!g.paper });
  });
  const c = batchClass();
  if (c && c.names.length) { const m = rosterMatch(c.names); s.rosterOnly = c.names.filter(n => !m.has(n)); }
  if (anonOn()) for (const k of ['counted', 'partial', 'notScored', 'missing', 'excused', 'offScale', 'ownOff', 'leftOut']) s[k].sort((a, b) => natural(a.name, b.name));   // never in folder order while names are hidden
  const tot = s.counted.map(x => x.total).sort((a, b) => a - b), n = tot.length, pcts = s.counted.map(x => x.pct).filter(v => v != null);
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  s.n = n; s.everyone = batch.students.length + s.rosterOnly.length; s.max = max;
  s.nLate = s.counted.filter(x => x.late).length;
  if (n) Object.assign(s, { mean: mean(tot), median: n % 2 ? tot[(n - 1) / 2] : (tot[n / 2 - 1] + tot[n / 2]) / 2, low: tot[0], high: tot[n - 1], meanPct: pcts.length ? pct2(mean(pcts)) : null });
  const ps = pcts.slice().sort((a, b) => a - b);
  if (ps.length) Object.assign(s, { medPct: roundPct(ps.length % 2 ? ps[(ps.length - 1) / 2] : (ps[ps.length / 2 - 1] + ps[ps.length / 2]) / 2), lowPct: ps[0], highPct: ps[ps.length - 1] });
  s.bins = spreadBins(s.counted, max);
  // Rows use every row with a score, partial papers included, since those rows are real scores. Scores of a missing or excused student stay out.
  if (setup.mode === 'rubric') {
    s.rows = setup.criteria.map((name, r) => {
      const v = batch.students.map(st => st.grade.outAvg ? null : rowShown(st, r)).filter(x => x != null);
      const top = rowTop(setup, r); return { r, name, top, n: v.length, avg: v.length ? mean(v) : null, low: v.filter(x => x <= top / 2).length };
    }).sort((a, b) => (a.avg == null ? 9 : a.avg) - (b.avg == null ? 9 : b.avg) || a.r - b.r);
    const av = s.rows.filter(x => x.n).map(x => x.avg), least = Math.min(...av);
    for (const x of s.rows) x.lowest = x.n > 0 && x.avg === least && av.some(a => a !== least);
    s.nRowless = s.counted.filter(x => x.paper).length;
  }
  return s;
}
// src/rubrics.js
const people = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
// src/rubrics.js
function leftOutText(s) {
  const parts = [[s.missing.length, 'marked missing'], [s.excused.length, 'excused'], [s.partial.length, 'partial'], [s.notScored.length, 'not scored yet'], [s.offScale.length, 'from the paper, not on this scale'], [s.ownOff.length, 'above the total or below 0'], [s.leftOut.length, 'left out of the average by you'], [s.rosterOnly.length, 'on the roster with nothing here']].filter(p => p[0]).map(p => p[0] + ' ' + p[1]);
  let t = 'Counted: ' + s.n + ' of ' + people(s.everyone, 'student') + '.';
  if (parts.length) t += ' Left out: ' + parts.join(', ') + '.';
  if (s.missing.length || s.excused.length) t += ' Missing and excused don’t count as 0.';
  if (s.counted.some(x => x.total === 0)) t += ' A score of 0 is counted.';
  if (s.nLate) t += ' ' + (s.nLate === 1 ? '1 late score is' : s.nLate + ' late scores are') + ' counted.';
  return t;
}
// src/rubrics.js
const pct2 = v => Math.round(v * 100 + 1e-9) / 100;
// src/rubrics.js
const avgDp = () => { const d = +store.get('gs.avgDp', 2); return d === 0 || d === 1 ? d : 2; };
// src/rubrics.js
const pctAvgText = v => { if (v == null) return ''; const d = avgDp(), k = 10 ** d; return (Math.round(v * k + 1e-9) / k).toFixed(d) + '%'; };
// src/book.js
function bkCats() {
  let cats; try { cats = (lib.book || {}).cats; } catch (e) { return BK_TYPES; }
  if (cats === bkCatsSeen) return BK_TYPES;
  bkCatsSeen = cats;
  const seen = new Set(), out = [];
  for (const c of Array.isArray(cats) ? cats : BK_DEF.map(([id]) => ({ id }))) {
    if (!c || !c.id || c.id === 'xc' || seen.has(c.id)) continue;
    const d = BK_DEF.find(x => x[0] === c.id), nm = String(c.name || '').trim();
    if (!d && !nm) continue;
    seen.add(c.id); out.push(nm ? [c.id, nm, nm, d ? 0 : +c.k || 1] : d.slice());
  }
  BK_TYPES.splice(0, BK_TYPES.length, ...(out.length ? out : BK_DEF.map(x => x.slice())));
  return BK_TYPES;
}
// src/intake.js
function pdfBad(f, e) {
  const locked = !!e && (e.name === 'PasswordException' || /password/i.test(e.message || ''));
  f.badIs = locked ? 'locked' : 'damaged'; f.bad = locked ? 'it’s password-protected' : 'it couldn’t be opened';
}
// src/insight.js
function paperReads() {
  const r = {}, was = batch.read || {};
  for (const st of batch.students) {
    const f = st.found;
    if (f === undefined) { if (was[st.key]) r[st.key] = was[st.key]; }
    else if (f && f.found && (f.score != null || f.pct != null)) r[st.key] = { score: f.score, outOf: f.outOf, pct: f.pct };
  }
  return Object.keys(r).length ? r : undefined;
}
// src/insight.js
const coverList = all => { const list = []; for (const st of batch.students) shareDocs(st, all).forEach((d, k) => list.push({ st, d, k })); return list; };
// src/insight.js
const coverSig = f => (f.data && f.data.length) || 0;
// src/insight.js
const nameFreeText = t => scrub(t, classRx());
// src/scans.js
function coverRound(pts, xf) {
  const q = xf ? pts.map(p => pdfjsLib.Util.applyTransform(p, xf)) : pts, xs = q.map(p => p[0]), ys = q.map(p => p[1]), x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
// src/scans.js
function scanClip(ctx, f, p, w, cw, ch) { if (skewOf(f, p) && cw > w) { ctx.fillStyle = '#fff'; ctx.fillRect(w, 0, cw - w, ch); } }
// src/imported.js
const IMP_ID = /^\d+R\d*$/;
// src/imported.js
const IMP_LINES = new Set(['Ink', 'Line', 'PolyLine', 'Polygon', 'Underline', 'StrikeOut', 'Squiggly']);
// src/imported.js
function impVisible(a) { return !IMP_SKIP.has(a.subtype) && !(a.annotationFlags & 2) && !(a.annotationFlags & 32); }
// src/imported.js
const IMP_SKIP = new Set(['Link', 'Popup', 'Widget']);
// src/imported.js
function impKind(a) {
  if (!IMP_ID.test(String(a.id || ''))) return null;
  if (IMP_LINES.has(a.subtype)) return 'pen';
  if (a.subtype === 'Highlight') return 'hl';
  if (a.subtype === 'Square' || a.subtype === 'Circle') return 'oval';
  if (a.subtype === 'FreeText') return commentText(a) ? 'text' : null;
  if (a.subtype === 'Text') return commentText(a) ? 'note' : null;
  return null;
}
// src/imported.js
function impHex(c, dflt) { return c && c.length >= 3 ? '#' + [0, 1, 2].map(i => Math.round(c[i]).toString(16).padStart(2, '0')).join('') : dflt; }
// src/imported.js
function impMarks(a, vp, xf, line) {
  const P = (x, y) => {
    let [X, Y] = vp.convertToViewportPoint(x, y);
    if (xf) [X, Y] = [xf[0] * X + xf[2] * Y + xf[4], xf[1] * X + xf[3] * Y + xf[5]];
    return [r1(X), r1(Y)];
  };
  const box = pts => { const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), x = Math.min(...xs), y = Math.min(...ys); return { x: r1(x), y: r1(y), w: r1(Math.max(...xs) - x), h: r1(Math.max(...ys) - y) }; };
  const rectBoxOf = rc => box([P(rc[0], rc[1]), P(rc[2], rc[3]), P(rc[0], rc[3]), P(rc[2], rc[1])]);
  const quads = () => (a.quadPoints || []).map(q => box(q.map(o => P(o.x, o.y)))).filter(r => r.w > 0 && r.h > 0);
  const col = impHex(a.color, COLORS.red), w = r1(Math.max(0.6, (a.borderStyle && a.borderStyle.width) || 1)), text = commentText(a);
  const out = [], rb = rectBoxOf(a.rect);
  // a pen mark, shape or highlight can have a comment too: it goes in the margin, pointing at the mark's top right
  const withNote = () => { if (text) out.push({ t: 'note', color: col, ax: r1(Math.min(rb.x + rb.w, vp.width - 2)), ay: r1(rb.y + Math.min(8, rb.h / 2)), text }); };
  switch (a.subtype) {
    case 'Ink':
      for (const L of a.inkLists || []) if (L.length) out.push({ t: 'pen', color: col, w, pts: L.map(o => P(o.x, o.y)) });
      withNote(); break;
    case 'Line': {
      const c = line && line.length === 4 ? line : a.lineCoordinates;
      if (c) out.push({ t: 'pen', color: col, w, pts: [P(c[0], c[1]), P(c[2], c[3])] });
      withNote(); break;
    }
    case 'PolyLine': case 'Polygon': {
      const v = (a.vertices || []).map(o => P(o.x, o.y));
      if (v.length) out.push({ t: 'pen', color: col, w, pts: a.subtype === 'Polygon' ? v.concat([v[0]]) : v });
      withNote(); break;
    }
    case 'Underline': case 'StrikeOut': case 'Squiggly':
      for (const r of quads()) {
        const y = r1(a.subtype === 'StrikeOut' ? r.y + r.h / 2 : r.y + r.h - 0.6), lw = r1(Math.max(1, r.h / 14));
        if (a.subtype !== 'Squiggly') { out.push({ t: 'pen', color: col, w: lw, pts: [[r.x, y], [r1(r.x + r.w), y]] }); continue; }
        const pts = [], step = Math.max(2, r.h / 5);
        for (let x = r.x, k = 0; x <= r.x + r.w; x += step, k++) pts.push([r1(x), r1(y - (k % 2 ? step * 0.6 : 0))]);
        if (pts.length > 1) out.push({ t: 'pen', color: col, w: lw, pts });
      }
      withNote(); break;
    case 'Highlight': {
      const rs = quads(); if (!rs.length) rs.push(rb);
      const hc = impHex(a.color, HL.yellow);
      if (text) {
        const last = rs[rs.length - 1], m = { t: 'note', color: hc, ax: r1(last.x + last.w), ay: r1(last.y + last.h / 2), hl: rectBox(rs), hc, text };
        if (rs.length > 1) m.rects = rs;
        out.push(m);
      } else out.push(setRects({ t: 'hl', color: hc }, rs));
      break;
    }
    case 'Square': case 'Circle':
      out.push({ t: 'oval', color: col, sw: w, x: r1(rb.x + w / 2), y: r1(rb.y + w / 2), w: r1(Math.max(2, rb.w - w)), h: r1(Math.max(2, rb.h - w)) });
      withNote(); break;
    case 'FreeText': {
      const da = a.defaultAppearanceData || {}, size = r1(Math.min(48, Math.max(6, da.fontSize || 12)));
      out.push({ t: 'text', color: impHex(da.fontColor, COLORS.black), x: r1(rb.x + 2), y: r1(rb.y + 2), size, text, bw: r1(Math.max(24, rb.w - 4)) });
      break;
    }
    case 'Text':
      out.push({ t: 'note', color: col, ax: r1(Math.min(rb.x + rb.w / 2, vp.width - 2)), ay: r1(rb.y + rb.h / 2), text });
      break;
  }
  for (const m of out) m.imp = a.id;
  return out;
}
// src/imported.js
async function impRead(f) {
  const res = { pages: {}, n: 0, keep: 0, kinds: {}, locked: false };
  if (f.kind !== 'pdf' || !f.data || f.virtual) return res;
  await workerReady;
  const js = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
  let lib = null;
  try {
    for (let p = 0; p < js.numPages; p++) {
      const page = await js.getPage(p + 1);
      const done = new Set((f.imp && f.imp[p]) || []);
      const annots = (await page.getAnnotations({ intent: 'display' })).filter(a => impVisible(a) && !done.has(a.id));
      if (!annots.length) { page.cleanup(); continue; }
      if (!lib) {
        lib = await PDFLib.PDFDocument.load(f.data, { ignoreEncryption: true, updateMetadata: false });
        // a locked file can't be saved again without its marks, so they stay as they are
        if (lib.isEncrypted) { res.locked = true; }
      }
      const vp = vpRot(f, p, page, 1), xf = skewXf(f, p, vp), list = [];
      for (const a of annots) {
        const kind = res.locked ? null : impKind(a);
        if (!kind) { res.keep++; continue; }
        let line = null;
        if (a.subtype === 'Line') { try { const [num, gen] = a.id.split('R'); const d = lib.context.lookup(PDFLib.PDFRef.of(+num, +(gen || 0))); const L = d && d.lookupMaybe(PDFLib.PDFName.of('L'), PDFLib.PDFArray); if (L) line = L.asArray().map(v => v.asNumber()); } catch {} }
        const marks = impMarks(a, vp, xf, line);
        if (!marks.length) { res.keep++; continue; }
        list.push({ id: a.id, kind, marks });
        res.kinds[kind] = (res.kinds[kind] || 0) + 1; res.n++;
      }
      if (list.length) res.pages[p] = list;
      page.cleanup();
    }
  } finally { js.destroy(); }
  return res;
}
// src/imported.js
function impCount(f) { return (f && !f.impNo && f.scan && f.scan.impN) || 0; }
// src/imported.js
async function impConvert(f, read) {
  const r = read || await impRead(f);
  if (!r.n) return { n: 0, keep: r.keep, locked: r.locked };
  f.imp ||= {};
  for (const [p, list] of Object.entries(r.pages)) {
    const marks = (f.marks[p] ||= []);
    for (const it of list) { marks.push(...it.marks); (f.imp[p] ||= []).push(it.id); }
  }
  delete f.impNo;
  f.impNew = { n: r.n, keep: r.keep };
  impForgetUndo(f);
  return { n: r.n, keep: r.keep };
}
// src/imported.js
function impPutBack(f) {
  for (const p of Object.keys(f.marks)) f.marks[p] = f.marks[p].filter(m => !m.imp);
  delete f.imp; delete f.view; delete f.viewOf; delete f.viewKey; delete f.impNew;
  f.impNo = 1;
  impForgetUndo(f);
}
// src/imported.js
function impForgetUndo(f) {
  set.undoStack(undoStack.filter(u => u.file !== f)); set.redoStack(redoStack.filter(u => u.file !== f));
  if (selected && selected.page && selected.page.file === f) set.selected(null);
  renderTools();
}
// src/imported.js
async function impAfter(f) {
  thumbCache.clear(); scanned = false;
  await rescanFile(f);
  gradeMarksChanged(f);
  saveSoon(); renderList();
  const st = batch && batch.students[cur];
  if (st && st.files.includes(f)) await openStudent(cur, f.path);
}
// src/imported.js
const impPlural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
// src/imported.js
function impNote(pg) {
  if (pg.inote) { pg.inote.remove(); pg.inote = null; }
  const f = pg.file;
  if (f.virtual || f.kind !== 'pdf') return;
  const lines = [];
  if (f.impNew) {
    lines.push(impPlural(f.impNew.n, 'mark is', 'marks are') + ' now yours to change.<button class="link" data-imp="back">Put back</button>');
    if (f.impNew.keep) lines.push('<span class="muted" style="font-size:12px">' + impPlural(f.impNew.keep, 'mark', 'marks') + ' (like a stamp or a picture) couldn’t be changed and ' + (f.impNew.keep === 1 ? 'stays' : 'stay') + ' on the page as ' + (f.impNew.keep === 1 ? 'it was' : 'they were') + '.</span>');
  } else if (f.gsFlat) {
    lines.push('This file was exported from Grading Studio with its marks drawn into the page, so they can’t be changed here.');
    lines.push('<span class="muted" style="font-size:12px">To change them, open the download you marked them in: your marks are kept there. Files exported with Keep marks editable on come back with their marks.</span>');
  } else {
    const n = impCount(f);
    if (!n) return;
    lines.push('This paper has ' + impPlural(n, 'mark', 'marks') + ' from another app. You can see ' + (n === 1 ? 'it' : 'them') + ' but not change ' + (n === 1 ? 'it' : 'them') + '.<button class="link" data-imp="make">Make ' + (n === 1 ? 'it' : 'them') + ' editable</button><button class="link" data-imp="no">Not now</button>');
    const others = batch.students.flatMap(st => st.files).filter(x => x !== f && impCount(x)).length;
    if (others) lines.push('<span class="muted" style="font-size:12px">' + impPlural(others + 1, 'paper', 'papers') + ' in this download have marks like these.<button class="link" data-imp="all" style="font-size:12px">Make all of them editable</button></span>');
  }
  const el = document.createElement('div'); el.className = 'scnote impnote';
  el.innerHTML = lines.map(t => '<div>' + t + '</div>').join('');
  el.onclick = e => {
    const b = e.target.closest('[data-imp]'); if (!b) return;
    const a = b.dataset.imp;
    if (a === 'all') return openImported();
    if (a === 'no') { f.impNo = 1; saveSoon(); el.remove(); pg.inote = null; return; }
    b.disabled = true;
    (async () => {
      if (a === 'make') {
        const r = await impConvert(f);
        if (!r.n) { f.impNo = 1; toast(r.locked ? 'This file is locked, so its marks stay as they are.' : 'None of these marks could be made editable, so they stay as they are.'); }
      }
      else impPutBack(f);
      await impAfter(f);
    })().catch(err => { console.error(err); toast('That didn’t work on this file. Its marks are as they were.'); b.disabled = false; });
  };
  pg.wrap.before(el); pg.inote = el;
}
// src/groups.js
function groupOf(st) { return (st && batch && (batch.groups || []).find(g => g.k.includes(st.key))) || null; }
// src/groups.js
const groupJustOn = st => !!(st && groupJust === st.key && groupOwn(groupOf(st)) && groupFileOf(groupOf(st), st));
// src/groups.js
function justTag(pg) { if (!pg.seen || !groupJustOn(batch.students[cur])) return; for (const m of pg.marks()) if (!pg.seen.has(m) && !m.o) m.o = groupJust; pg.seen = null; }
// src/typednotes.js
const TN_K = { h: ['Heading', 'H'], p: ['Strength', '✓'], n: ['Next step', '→'], q: ['Question', '?'] };
// src/typednotes.js
const TN_SIZE = { s: [10, 'Compact'], '': [12, 'Standard'], l: [15, 'Large'] };
// src/typednotes.js
const tnSizeOf = () => (TN_SIZE[setup.tnSize] && setup.tnSize) || '';
// src/typednotes.js
const tnListOf = x => x.y === 'ul' || x.y === 'ol';
// src/typednotes.js
function tnBits(x) { const a = new Array(x.s.length).fill(0); for (const r of Array.isArray(x.f) ? x.f : []) if (Array.isArray(r)) for (let i = Math.max(0, r[0] | 0); i < Math.min(a.length, r[1] | 0); i++) a[i] |= r[2] & 15; return a; }
// src/typednotes.js
function tnRuns(a) { const f = []; for (let i = 0; i < a.length;) { let j = i + 1; while (j < a.length && a[j] === a[i]) j++; if (a[i]) f.push([i, j, a[i]]); i = j; } return f; }
// src/typednotes.js
function tnClean(x) {
  const o = { s: String(x.s || '').replace(/[\r\n\t ]/g, ' ') };
  if (TN_K[x.k]) o.k = x.k;
  if (/^(h2|ul|ol)$/.test(x.y) && o.k !== 'h') o.y = x.y;
  if (typeof x.o === 'string' && x.o) o.o = x.o;
  if (o.y === 'h2' && o.k) delete o.k;
  if (tnListOf(o) && +x.d === 2) o.d = 2;
  if (typeof x.t === 'number' && isFinite(x.t) && x.t >= 0) { o.t = Math.floor(x.t); if (x.h && +x.h) o.h = 1; }
  const f = tnRuns(tnBits({ s: o.s, f: x.f })); if (f.length) o.f = f;
  return o;
}
// src/typednotes.js
const TN_HL = '#FBF3D6';   // the pale amber of a highlight, on white paper
// src/typednotes.js
function tnWrapRuns(ctx, x, face, w) {
  const a = tnBits(x), bits = [], lines = [[]]; let lw = 0;
  for (let i = 0; i < x.s.length;) {   // pieces: a word with the space after it, split again where the formatting changes
    let j = i; while (j < x.s.length && a[j] === a[i] && x.s[j] !== ' ' && !/[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/.test(x.s[j])) j++;
    if (j === i) j++;
    while (j < x.s.length && x.s[j] === ' ' && a[j] === a[i]) j++;
    bits.push({ t: x.s.slice(i, j), b: a[i] }); i = j;
  }
  for (const p of bits) {
    ctx.font = face(p.b); p.w = ctx.measureText(p.t).width;
    if (lw && lw + ctx.measureText(p.t.trimEnd()).width > w) { lines.push([]); lw = 0; if (!p.t.trim()) continue; }
    while (p.w > w && p.t.length > 1) {   // a word wider than the line
      let k = p.t.length - 1; while (k > 1 && ctx.measureText(p.t.slice(0, k)).width > w) k--;
      lines[lines.length - 1].push({ t: p.t.slice(0, k), b: p.b, w: ctx.measureText(p.t.slice(0, k)).width }); lines.push([]); lw = 0;
      p.t = p.t.slice(k); p.w = ctx.measureText(p.t).width;
    }
    lines[lines.length - 1].push(p); lw += p.w;
  }
  return lines.filter((l, i) => l.length || !i);
}
// src/typednotes.js
function tnBlocks(ctx, st, W, M) {
  // everything on the page is drawn to the body size: Standard 12 pt, and the headings, indents, spacing and marks with it
  const z = TN_SIZE[tnSizeOf()][0] / 12, zz = n => Math.round(n * z * 10) / 10;
  const UI = 'Inter, ' + FONT, cw = W - 2 * M, L = tnMine(st, st.grade.tn.l || []).map(tnClean), out = [];
  const words = { p: tr('Strength'), n: tr('Next step'), q: tr('Question') };
  ctx.font = '600 ' + zz(11) + 'px ' + UI;
  const kinds = L.filter(x => words[x.k] && x.s.trim()), labW = kinds.length ? Math.min(Math.round(cw * 0.3), Math.max(...kinds.map(x => ctx.measureText(TN_K[x.k][1] + ' ' + words[x.k]).width)) + 14) : 0;
  const text = (lines, font, color, x, y, lh) => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh)); };
  const title = fbWrap(ctx, (batch.assignment && batch.assignment.name) || batch.name, '11.5px ' + UI, cw);
  out.push({ h: 30 + title.length * 16 + 14, draw: y => { text([tr('Notes from your teacher')], '700 19px ' + UI, FB_INK, M, y + 20, 24); text(title, '11.5px ' + UI, FB_MUTED, M, y + 40, 16); ctx.fillStyle = FB_INK; ctx.fillRect(M, y + 30 + title.length * 16 + 12, cw, 1.2); } });
  let n1 = 0, n2 = 0, first = true;
  for (const x of L) {
    const list = tnListOf(x), d2 = list && x.d === 2;
    if (x.y === 'ol') { if (d2) n2++; else { n1++; n2 = 0; } } else if (!d2) { n1 = 0; n2 = 0; }
    if (!x.s.trim()) { if (!first) out.push({ h: zz(8), draw: () => {} }); continue; }
    const head = x.k === 'h', small = x.y === 'h2', size = zz(head ? 15 : small ? 13.5 : 12), base = head ? 700 : small ? 650 : 400, lh = zz(head ? 21 : small ? 19 : 18);
    const face = b => ((b & 2) ? 'italic ' : '') + ((b & 1) ? Math.max(base, 700) : base) + ' ' + size + 'px ' + UI;
    const tx = M + labW + (list ? zz(d2 ? 40 : 20) : 0), lines = tnWrapRuns(ctx, { ...x, s: x.s.trim() === x.s ? x.s : x.s.replace(/\s+$/, '') }, face, M + cw - tx);
    const gap = first ? 0 : zz(head ? 14 : small ? 10 : list ? 3 : 6), mark = list ? (x.y === 'ol' ? (d2 ? n2 : n1) + '.' : d2 ? '◦' : '•') : '';
    first = false;
    // one block a line of text, so a long note runs on to the next page where the page ends
    lines.forEach((ln, k) => out.push({ h: (k ? 0 : gap) + lh, draw: y => {
      const b = y + (k ? 0 : gap) + lh - zz(5);
      if (!k && words[x.k]) text([TN_K[x.k][1] + ' ' + words[x.k]], '600 ' + zz(11) + 'px ' + UI, FB_INK2, M, b, lh);
      if (!k && mark) text([mark], face(0), FB_INK2, tx - zz(d2 ? 18 : 16), b, lh);
      let px = tx;
      for (const p of ln) {
        if (p.b & 8) { ctx.fillStyle = TN_HL; ctx.fillRect(px, b - size, p.w, size + zz(4)); }
        text([p.t], face(p.b), FB_INK, px, b, lh);
        if (p.b & 4) { ctx.fillStyle = FB_INK; ctx.fillRect(px, b + zz(2), ctx.measureText(p.t.trimEnd()).width, 0.8); }
        px += p.w;
      }
    } }));
  }
  return out;
}
// src/typednotes.js
async function tnAddPages(out, st, W, H, dpi, before) {
  if (!(W >= 400 && H >= 500 && W <= 1300 && H <= 1300) || W > H) { W = 612; H = 792; }
  const M = Math.max(40, Math.round(W * 0.088)), scale = dpi / 72, UI = 'Inter, ' + FONT;
  const pages = fbPages(tnBlocks(document.createElement('canvas').getContext('2d'), st, W, M), M, H - M - 22);
  for (let i = 0; i < pages.length; i++) {
    const c = document.createElement('canvas'); c.width = Math.ceil(W * scale); c.height = Math.ceil(H * scale);
    const ctx = c.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    const mine = fbPages(tnBlocks(ctx, st, W, M), M, H - M - 22)[i] || [];
    let y = M; for (const b of mine) { b.draw(y); y += b.h; }
    const foot = i < pages.length - 1 ? 'The notes continue on the next page.' : before ? 'Your marked paper starts on the next page.' : '';
    if (foot) { ctx.font = '10px ' + UI; ctx.fillStyle = FB_MUTED; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(tr(foot), M, H - M + 6); }
    out.addPage([W, H]).drawImage(await out.embedJpg(await canvasJpg(c, 0.92)), { x: 0, y: 0, width: W, height: H });
    c.width = c.height = 0;
  }
  tnPagesMade = pages.length;
  return pages.length;
}
// src/typednotes.js
let tnPagesMade = 0;
// src/anchors.js
const ANCHORS = [['high', 'High'], ['mid', 'Mid'], ['low', 'Low']];
// src/anchors.js
const anchorCoverOn = () => store.get('gs.anchorCover', true) !== false;
// src/anchors.js
function anchorType() { const a = batch && batch.assignment, f = a && findItem(a.id); return ((f && f.it) || a || {}).type || ''; }
// src/anchors.js
function anchorKind() {
  const t = anchorType(), c = t && bkCats().find(x => x[0] === t);
  return c ? c[2] || c[1] : 'Summative';
}
// src/anchors.js
function anchorsHere() { const t = anchorType(); return t !== 'ic' && t !== 'fm' && t !== 'xc'; }
// src/anchors.js
const anchorOf = lv => batch.students.findIndex(s => s.grade.anchor === lv);
// src/anchors.js
const anchorLabel = lv => anchorKind() + ' ' + (ANCHORS.find(a => a[0] === lv) || ['', ''])[1];
// src/anchors.js
function anchorFile(lv, k, n) { return (nameFreeText(batch.name) + ' - ' + anchorLabel(lv) + (n > 1 ? ' (' + (k + 1) + ')' : '') + '.pdf').replace(/[\\/:*?"<>|]+/g, '-'); }
// src/anchors.js
function setAnchor(st, lv) {
  const was = st.grade.anchor || '';
  // One Ctrl Z puts back both papers: this one, and the one whose tag moved here.
  pushUndo(groupStep([gradeStep(st), ...batch.students.filter(s => s !== st && s.grade.anchor === lv).map(gradeStep)], 'anchor paper'));
  if (was === lv) delete st.grade.anchor;
  else {
    for (const s of batch.students) if (s !== st && s.grade.anchor === lv) { delete s.grade.anchor; touchGrade(s); }
    st.grade.anchor = lv;
  }
  touchGrade(st); saveSoon(); renderGrade(); renderList();
  if (st.grade.anchor) toast(anchorLabel(lv) + ' anchor paper. It’s on the Return tab, ready to export.');
}
// src/anchors.js
async function anchorDocPdf(st, d, cover) {
  if (!cover) return flattenDoc(st, d, 150, false, keyOn(), false);
  const rx = coverRx(st), out = await PDFLib.PDFDocument.create(), js = new Map();
  out.setTitle(''); out.setAuthor(''); out.setCreator('Grading Studio'); out.setProducer('');
  try {
    for (const [path, p] of d.pages) {
      const f = fileByPath(st, path);
      if (!js.has(path)) js.set(path, await pdfjsLib.getDocument({ data: (await viewBytes(f)).slice(), isEvalSupported: false }).promise);
      const v1 = vpRot(f, p, await js.get(path).getPage(p + 1), 1);
      const r = await sharePage(st, f, js.get(path), p, Math.min(150 / 72, 8000 / Math.max(v1.width * 1.5, v1.height)), rx, shareOpts(st));
      out.addPage([r.W + r.side, r.H]).drawImage(await out.embedJpg(await canvasJpg(r.c, 0.88)), { x: 0, y: 0, width: r.W + r.side, height: r.H });
      r.c.width = r.c.height = 0;
    }
  } finally { for (const v of js.values()) v.destroy(); }
  return out.save();
}
// src/anchors.js
const anchorDocs = st => layoutOf(st).filter(d => !(d.out === true || (d.file && st.inc && st.inc[d.file] === false))).map(d => ({ ...d, pages: d.pages.filter(([path]) => { const f = fileByPath(st, path); return f && viewable(f); }) })).filter(d => d.pages.length);
// src/wordnotes.js
const WCM_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments';
// src/wordnotes.js
const wXml = bytes => new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
// src/wordnotes.js
const wXmlBad = doc => doc.getElementsByTagName('parsererror').length > 0;
// src/wordnotes.js
const wId = el => el.getAttributeNS(W_NS, 'id') ?? el.getAttribute('w:id');
// src/wordnotes.js
const wPart = t => 'word/' + t.replace(/^\/?word\//, '').replace(/^\.\//, '');
// src/wordnotes.js
function wComments(w) {
  if (w.cdoc !== undefined) return w.cdoc;
  w.cdoc = null; w.cpath = null;
  const rx = w.files['word/_rels/document.xml.rels'];
  const rel = rx && [...wXml(rx).getElementsByTagName('Relationship')].find(r => r.getAttribute('Type') === WCM_REL);
  if (rel) {
    w.cpath = wPart(rel.getAttribute('Target'));
    const b = w.files[w.cpath];
    if (b) { const d = wXml(b); w.cdoc = wXmlBad(d) ? false : d; }
  }
  return w.cdoc;
}
// src/wordnotes.js
const wCommentEls = w => wComments(w) ? [...w.cdoc.documentElement.children].filter(c => c.localName === 'comment') : [];
// src/wordnotes.js
const wCommentText = c => [...c.children].filter(p => p.localName === 'p').map(p => [...p.getElementsByTagNameNS(W_NS, 'r')].map(wRunText).join('')).join('\n').trim();
// src/wordnotes.js
function wCommentMap(w) {
  const runs = new Map(), order = [], para = new Map(), open = new Set();
  const seen = (id, node) => { if (!order.includes(id)) order.push(id); if (!para.has(id)) { let p = node; while (p && p.localName !== 'p') p = p.parentNode; if (p) para.set(id, p); } };
  const walk = node => {
    for (const c of node.children) {
      const n = c.localName;
      if (n === 'commentRangeStart') { open.add(wId(c)); seen(wId(c), c); }
      else if (n === 'commentRangeEnd') open.delete(wId(c));
      else if (n === 'r') { if (open.size) runs.set(c, [...open]); const ref = wkid(c, 'commentReference'); if (ref) seen(wId(ref), c); }
      else if (n !== 'rPr' && n !== 'pPr') walk(c);
    }
  };
  walk(w.doc.documentElement);
  for (const c of wCommentEls(w)) if (!order.includes(wId(c))) order.push(wId(c));
  return { runs, order: order.filter(id => wCommentEls(w).some(c => wId(c) === id)), para };
}
// src/wordnotes.js
function wNotesPaint(w, page, aside) {
  const { runs, order, para } = wCommentMap(w), num = id => order.indexOf(id) + 1, last = new Map();
  for (const b of page.querySelectorAll('.wcref')) b.remove();
  for (const s of page.querySelectorAll('[data-ri]')) {
    const ids = (runs.get(w.runs[+s.dataset.ri]) || []).filter(id => order.includes(id));
    s.classList.toggle('wcm', ids.length > 0);
    if (ids.length) s.dataset.cm = ids.join(' '); else delete s.dataset.cm;
    for (const id of ids) last.set(id, s);
  }
  const anchor = new Map();
  for (const id of order) {
    const b = document.createElement('sup'); b.className = 'wcref'; b.contentEditable = 'false'; b.dataset.cm = id; b.textContent = num(id);
    const s = last.get(id), p = para.get(id), pel = !s && p ? page.querySelector('p.wp[data-pi="' + w.paras.indexOf(p) + '"]') : null;
    if (s) s.after(b); else if (pel) pel.appendChild(b); else continue;
    anchor.set(id, b);
  }
  const cs = new Map(wCommentEls(w).map(c => [wId(c), c]));
  aside.hidden = !order.length;
  aside.innerHTML = order.map(id => { const c = cs.get(id), who = c.getAttributeNS(W_NS, 'author') || c.getAttribute('w:author') || '';
    return '<button type="button" class="wnote" data-cm="' + esc(id) + '"><i>' + num(id) + '</i><span>' + esc(wCommentText(c) || ' ') + (who ? '<small>' + esc(who) + '</small>' : '') + '</span></button>'; }).join('');
  // each card beside its words, pushed down so none overlap
  requestAnimationFrame(() => {
    const top0 = aside.getBoundingClientRect().top; let y = 0;
    for (const card of aside.children) {
      const a = anchor.get(card.dataset.cm), want = a ? a.getBoundingClientRect().top - top0 - 6 : y;
      y = Math.max(y, want); card.style.top = y + 'px'; y += card.offsetHeight + 8;
    }
    aside.style.height = y + 'px';
  });
}
// src/wordpdf.js
const WP_MAX = 60, WP_PX = 96 / 72, WP_FONT = 14.67;   // pages at most; screen dots to a point; 11 pt in screen dots
// src/wordpdf.js
function wordCanPdf(f) { return !!f && f.kind === 'docx' && !f.virtual && !f.rubric && !f.from && !!f.data; }
// src/wordpdf.js
function wordPageBox(w) {
  const tw = (el, k) => { const v = el ? +(el.getAttributeNS(W_NS, k) || el.getAttribute('w:' + k)) : 0; return v > 0 ? v / 20 : null; };
  let sect = null, sz = null, mar = null;
  try { sect = w && wkid(wkid(w.doc.documentElement, 'body'), 'sectPr'); sz = sect && wkid(sect, 'pgSz'); mar = sect && wkid(sect, 'pgMar'); } catch {}
  const W = clamp(tw(sz, 'w') || 595.28, 360, 1224), H = clamp(tw(sz, 'h') || 841.89, 360, 1224);
  const m = k => clamp(tw(mar, k) || 72, 28, Math.min(W, H) / 4);
  return { W, H, t: m('top'), r: m('right'), b: m('bottom'), l: m('left') };
}
// src/wordpdf.js
function wordPdfNotes(w, page) {
  let els = [];
  try { els = wCommentEls(w); } catch {}
  if (!els.length) return;
  try {
    wNotesPaint(w, page, document.createElement('aside'));
    const by = new Map(els.map(c => [wId(c), c])), order = wCommentMap(w).order;
    const box = document.createElement('div'); box.style.cssText = 'margin-top:28px;padding-top:10px;border-top:1px solid #9aa0ad;font-size:.92em';
    box.innerHTML = '<p class="wp" style="font-weight:700">Comments</p>' + order.map((id, i) => '<p class="wp"><span style="color:#D7263D;font-weight:700">' + (i + 1) + '</span>  ' + esc(wCommentText(by.get(id)) || '') + '</p>').join('');
    page.appendChild(box);
  } catch (e) { console.error(e); }
}
// src/wordpdf.js
function wordPdfParts(page) {
  const o = page.getBoundingClientRect(), P = { fills: [], lines: [], imgs: [], checks: [], words: [] };
  const rel = b => ({ x: b.left - o.left, y: b.top - o.top, w: b.width, h: b.height });
  const col = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const v = m[1].split(/[,\s/]+/).filter(Boolean).map(Number), a = v.length > 3 ? v[3] : 1; return a > 0 ? { r: v[0] / 255, g: v[1] / 255, b: v[2] / 255, a } : null; };
  for (const el of page.querySelectorAll('*')) {
    if (el.closest('button')) { if (el.matches('.wchk')) P.checks.push({ ...rel(el.getBoundingClientRect()), on: el.getAttribute('aria-pressed') === 'true' }); continue; }
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.tagName === 'IMG') { const b = rel(el.getBoundingClientRect()); if (b.w > 1 && b.h > 1) P.imgs.push({ el, ...b }); continue; }
    const whole = rel(el.getBoundingClientRect()), bg = col(cs.backgroundColor);
    if (bg) for (const b of cs.display === 'inline' ? [...el.getClientRects()].map(rel) : [whole]) if (b.w > .5 && b.h > .5) P.fills.push({ ...b, c: bg });
    // a table's shared edges sit on the cell's own edge; any other edge is just inside the box
    const cell = /^T[DH]$/.test(el.tagName) && cs.borderCollapse === 'collapse';
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const wd = parseFloat(cs['border' + side + 'Width']) || 0, c = wd && !/none|hidden/.test(cs['border' + side + 'Style']) ? col(cs['border' + side + 'Color']) : null;
      if (!c) continue;
      const k = cell ? 0 : wd / 2, x1 = whole.x + k, y1 = whole.y + k, x2 = whole.x + whole.w - k, y2 = whole.y + whole.h - k;
      P.lines.push({ wd, c, ...(side === 'Top' ? { x1, y1, x2, y2: y1 } : side === 'Bottom' ? { x1, y1: y2, x2, y2 } : side === 'Left' ? { x1, y1, x2: x1, y2 } : { x1: x2, y1, x2, y2 }) });
    }
  }
  const tw = document.createTreeWalker(page, NodeFilter.SHOW_TEXT), r = document.createRange(), looks = new Map(), g = document.createElement('canvas').getContext('2d');
  const lookOf = el => {
    if (looks.has(el)) return looks.get(el);
    const cs = getComputedStyle(el); let deco = '';
    for (let e = el; e; e = e.parentElement) { deco += ' ' + getComputedStyle(e).textDecorationLine; if (e === page) break; }   // an underline belongs to the words inside it too
    const font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    g.font = font; const m = g.measureText('Hg');
    const L = { size: parseFloat(cs.fontSize) || WP_FONT, bold: (+cs.fontWeight || 400) >= 600, ital: /italic|oblique/.test(cs.fontStyle), c: col(cs.color) || { r: 0, g: 0, b: 0, a: 1 }, under: /underline/.test(deco), strike: /line-through/.test(deco), font,
      asc: m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * .9, desc: m.fontBoundingBoxDescent || parseFloat(cs.fontSize) * .22, show: cs.visibility !== 'hidden' && cs.display !== 'none' };
    looks.set(el, L); return L;
  };
  for (let n; (n = tw.nextNode());) {
    const el = n.parentElement; if (!el || !/\S/.test(n.data) || el.closest('button')) continue;
    const L = lookOf(el); if (!L.show) continue;
    for (const m of n.data.matchAll(/\S+/g)) {
      r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      const b = r.getClientRects()[0];   // a word broken over two lines keeps its first piece
      if (!b || b.width < .5 || b.height < 2) continue;
      const q = rel(b);
      P.words.push({ s: m[0], ...q, base: q.y + (q.h - L.asc - L.desc) / 2 + L.asc, L });
    }
  }
  // bullets and numbers of a plain list (a file the simple reader opened): the browser draws them, so they aren't text to find
  for (const li of page.querySelectorAll('li')) {
    const b = rel(li.getBoundingClientRect()), L = lookOf(li), ol = li.parentElement && li.parentElement.tagName === 'OL';
    const s = ol ? ([...li.parentElement.children].indexOf(li) + 1) + '.' : '•';
    P.words.push({ s, x: b.x - L.size * (ol ? 1.5 : 1.1), y: b.y, w: L.size * (ol ? .9 : .35), h: L.asc + L.desc, base: b.y + (parseFloat(getComputedStyle(li).lineHeight) || L.size * 1.4) / 2 + (L.asc - L.desc) / 2, L, mark: true });
  }
  return P;
}
// src/wordpdf.js
function wordPdfCuts(total, pageH, atoms) {
  const cuts = [0];
  while (total - cuts[cuts.length - 1] > pageH + 1) {
    if (cuts.length >= WP_MAX) throw new Error('too long');
    const start = cuts[cuts.length - 1];
    let y = start + pageH;
    for (let moved = true; moved;) {
      moved = false;
      for (const [a, b] of atoms) if (a < y - .5 && b > y + .5 && a - 2 > start + pageH * .35) { y = a - 2; moved = true; }
    }
    cuts.push(y);
  }
  cuts.push(total);
  return cuts;
}
// src/wordpdf.js
async function wordPdfStage(f) {
  let w = null;
  try { w = openWord(f.data); w.pRuns = []; } catch (e) { console.error(e); }
  const box = wordPageBox(w), Wpx = Math.round(box.W * WP_PX);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + Wpx + 'px;pointer-events:none;--dfs:' + WP_FONT + 'px;--dlh:1.4';
  const page = document.createElement('div'); page.className = 'dpage';
  page.style.cssText = 'max-width:none;width:' + Wpx + 'px;box-sizing:border-box;margin:0;box-shadow:none;overflow:visible;border-radius:0;padding:0 ' + (box.r * WP_PX).toFixed(1) + 'px 0 ' + (box.l * WP_PX).toFixed(1) + 'px;' +
    'font-family:Arial,Helvetica,"Liberation Sans",Arimo,"Nimbus Sans",sans-serif;font-kerning:none;font-variant-ligatures:none';
  host.appendChild(page); document.body.appendChild(host);
  const done = () => { host.remove(); if (w) for (const u of w.urls) URL.revokeObjectURL(u); };
  try {
    if (w) { renderWord(w, page); wordPdfNotes(w, page); }
    else page.innerHTML = await docxHtml(f.data);
    await Promise.all([...page.querySelectorAll('img')].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
    const P = wordPdfParts(page), total = Math.max(1, Math.ceil(page.getBoundingClientRect().height)), pageH = (box.H - box.t - box.b) * WP_PX;
    const cuts = wordPdfCuts(total, pageH, P.words.filter(q => !q.mark).map(q => [q.y, q.y + q.h]).concat(P.imgs.map(q => [q.y, q.y + q.h]), P.checks.map(q => [q.y, q.y + q.h])));
    return { w, box, Wpx, host, page, P, cuts, done };
  } catch (e) { done(); throw e; }
}
// src/wordpdf.js
async function wordPagesPdf(f) {
  const S = await wordPdfStage(f);
  try {
    try { return await wordPdfWrite(f, S); }
    catch (e) { if (/too long/.test(String(e && e.message))) throw e; console.error(e); return await wordPdfPictures(f, S); }
  } finally { S.done(); }
}
// src/wordpdf.js
const WP_BLANK = 'AAEAAAAKAIAAAwAgT1MvMkT/RUAAAAEoAAAAYGNtYXAADABzAAABkAAAADRnbHlmAAAAAAAAAcwAAAABaGVhZC1GmP4AAACsAAAANmhoZWED6QH2AAAA5AAAACRobXR4AfQAAAAAAYgAAAAGbG9jYQAAAAAAAAHEAAAABm1heHAAAwACAAABCAAAACBuYW1lGZ8ZNAAAAdAAAABycG9zdG1nc80AAAJEAAAALAABAAAAAQAApyfBol8PPPUAAwPoAAAAAOcYLA8AAAAA5xgsDwAAAAAAAAAAAAAAAwACAAAAAAAAAAEAAAPoAAAAAAH0AAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAEAAAACAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAwH0AZAABQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAPz8/PwAAACAAIAPoAAAAAAPoAAAAAAAAAAAAAAAAAAAAAAAgAAAB9AAAAAAAAAAAAAIAAAADAAAAFAADAAEAAAAUAAQAIAAAAAQABAABAAAAIP//AAAAIP///+EAAQAAAAAAAAAAAAAAAAAAAAAAAAAEADYAAQAAAAAAAQANAAAAAQAAAAAAAgAHAA0AAwABBAkAAQAaABQAAwABBAkAAgAOAC5HbHlwaExlc3NGb250UmVndWxhcgBHAGwAeQBwAGgATABlAHMAcwBGAG8AbgB0AFIAZQBnAHUAbABhAHIAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAECBWJsYW5r';
// src/wordpdf.js
function wordPdfUnseen(pdf) {
  let ref = null;
  const make = () => {
    const ctx = pdf.context, S = PDFLib.PDFString.of, ttf = Uint8Array.from(atob(WP_BLANK), c => c.charCodeAt(0));
    const map = new Uint8Array(131072); for (let i = 1; i < map.length; i += 2) map[i] = 1;   // every letter is the blank glyph
    const cmap = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n1 beginbfrange\n<0000> <FFFF> <0000>\nendbfrange\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n';
    const desc = ctx.register(ctx.obj({ Type: 'FontDescriptor', FontName: 'GlyphLessFont', Flags: 5, FontBBox: [0, 0, 500, 1000], ItalicAngle: 0, Ascent: 1000, Descent: -1, CapHeight: 1000, StemV: 80, FontFile2: ctx.register(ctx.flateStream(ttf, { Length1: ttf.length })) }));
    const cid = ctx.register(ctx.obj({ Type: 'Font', Subtype: 'CIDFontType2', BaseFont: 'GlyphLessFont', CIDSystemInfo: { Registry: S('Adobe'), Ordering: S('Identity'), Supplement: 0 }, FontDescriptor: desc, DW: 500, CIDToGIDMap: ctx.register(ctx.flateStream(map)) }));
    return ctx.register(ctx.obj({ Type: 'Font', Subtype: 'Type0', BaseFont: 'GlyphLessFont', Encoding: 'Identity-H', DescendantFonts: [cid], ToUnicode: ctx.register(ctx.flateStream(cmap)) }));
  };
  // what writes s from x, y, as wide as w (in points); the caller says the writing is unseen
  return (pg, keys, s, size, x, y, w) => {
    ref ||= make();
    if (!keys.has('unseen')) keys.set('unseen', pg.node.newFontDictionary('GlyphLess', ref));
    let hex = ''; for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0');
    return [PDFLib.setFontAndSize(keys.get('unseen'), size), PDFLib.setWordSpacing(0), PDFLib.setTextMatrix(Math.max(.01, w / (s.length * size / 2)), 0, 0, 1, x, y), PDFLib.showText(PDFLib.PDFHexString.of(hex.toUpperCase()))];
  };
}
// src/wordpdf.js
async function wordPdfWrite(f, { box, P, cuts }) {
  const pdf = await PDFLib.PDFDocument.create(), SF = PDFLib.StandardFonts, rgb = c => PDFLib.rgb(c.r, c.g, c.b);
  pdf.setTitle(f.name.replace(WORD_RX, ''));   // no Creator: 'Grading Studio' there means a flattened export (imported.js)
  const fonts = {}, fontOf = async L => { const k = (L.bold ? 'b' : '') + (L.ital ? 'i' : ''); return fonts[k] ||= { font: await pdf.embedFont(L.bold ? (L.ital ? SF.HelveticaBoldOblique : SF.HelveticaBold) : L.ital ? SF.HelveticaOblique : SF.Helvetica), wd: new Map() }; };
  for (const q of P.words) q.F = await fontOf(q.L);
  const can = new Set((await fontOf({})).font.getCharacterSet());
  // how wide the built-in font writes this, letter by letter (it doesn't tuck letters together, and neither did the page)
  const wide = (F, s, size) => { let n = 0; for (const ch of s) { let v = F.wd.get(ch); if (v == null) F.wd.set(ch, v = F.font.widthOfTextAtSize(ch, 1000)); n += v; } return n * size / 1000; };
  const pics = new Map(), unseen = wordPdfUnseen(pdf), TR = PDFLib.setTextRenderingMode, TM = PDFLib.TextRenderingMode;
  for (const im of P.imgs) {
    try {
      const el = im.el, k = Math.min(1, 2400 / Math.max(el.naturalWidth, el.naturalHeight, 1), 2.5 * im.w / Math.max(el.naturalWidth, 1)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(el.naturalWidth * k)); c.height = Math.max(1, Math.round(el.naturalHeight * k));
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(el, 0, 0, c.width, c.height);
      pics.set(im, await pdf.embedJpg(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86))).arrayBuffer()));
      c.width = c.height = 0;
    } catch (e) { console.error(e); }
  }
  // a word the font can't write, drawn by the browser
  const wordPic = async q => {
    const K = 3, pad = 2, c = document.createElement('canvas'); c.width = Math.ceil((q.w + pad * 2) * K); c.height = Math.ceil((q.h + pad * 2) * K);
    const x = c.getContext('2d'); x.scale(K, K); x.font = q.L.font; x.fillStyle = 'rgb(' + [q.L.c.r, q.L.c.g, q.L.c.b].map(v => Math.round(v * 255)).join(',') + ')'; x.textBaseline = 'alphabetic';
    x.fillText(q.s, pad, pad + (q.base - q.y));
    const png = await pdf.embedPng(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer()); c.width = c.height = 0;
    return { png, pad };
  };
  for (let k = 0; k + 1 < cuts.length; k++) {
    const y0 = cuts[k], y1 = cuts[k + 1], pg = pdf.addPage([box.W, box.H]), X = x => x / WP_PX, Y = y => box.H - box.t - (y - y0) / WP_PX, inY = (a, b) => b > y0 && a < y1;
    pg.pushOperators(PDFLib.pushGraphicsState(), PDFLib.rectangle(0, Y(y1), box.W, (y1 - y0) / WP_PX), PDFLib.clip(), PDFLib.endPath());
    for (const q of P.fills) if (inY(q.y, q.y + q.h)) pg.drawRectangle({ x: X(q.x), y: Y(q.y + q.h), width: q.w / WP_PX, height: q.h / WP_PX, color: rgb(q.c), opacity: q.c.a });
    for (const im of P.imgs) if (pics.get(im) && inY(im.y, im.y + im.h)) pg.drawImage(pics.get(im), { x: X(im.x), y: Y(im.y + im.h), width: im.w / WP_PX, height: im.h / WP_PX });
    for (const q of P.lines) if (inY(Math.min(q.y1, q.y2) - 1, Math.max(q.y1, q.y2) + 1)) pg.drawLine({ start: { x: X(q.x1), y: Y(q.y1) }, end: { x: X(q.x2), y: Y(q.y2) }, thickness: q.wd / WP_PX, color: rgb(q.c), opacity: q.c.a });
    for (const q of P.checks) if (inY(q.y, q.y + q.h)) {
      const s = Math.min(q.w, q.h) * .7 / WP_PX, x = X(q.x + q.w / 2) - s / 2, y = Y(q.y + q.h / 2) - s / 2, ink = PDFLib.rgb(.08, .1, .13);
      pg.drawRectangle({ x, y, width: s, height: s, borderColor: ink, borderWidth: .8 });
      if (q.on) { pg.drawLine({ start: { x, y }, end: { x: x + s, y: y + s }, thickness: .8, color: ink }); pg.drawLine({ start: { x, y: y + s }, end: { x: x + s, y }, thickness: .8, color: ink }); }
    }
    const mine = P.words.filter(q => q.y + q.h / 2 >= y0 && q.y + q.h / 2 < y1), keys = new Map(), ops = [PDFLib.beginText()], after = [];
    for (const [i, q] of mine.entries()) {
      const size = q.L.size / WP_PX, x = X(q.x), y = Y(q.base);
      // as far as the next word on its line, so words that sit together read together
      const nx = mine[i + 1], joined = !q.mark && nx && !nx.mark && Math.abs(nx.base - q.base) < 1 && nx.x > q.x + q.w - 1 && nx.x - (q.x + q.w) < q.L.size * 1.2 && nx.L.size === q.L.size;
      const to = joined ? nx.x : q.x + q.w;
      if (q.L.under) after.push({ x1: q.x, x2: to, y: q.base + q.L.size * .12, wd: Math.max(.6, q.L.size / 16), c: q.L.c });
      if (q.L.strike) after.push({ x1: q.x, x2: to, y: q.base - q.L.size * .3, wd: Math.max(.6, q.L.size / 16), c: q.L.c });
      if (![...q.s].every(ch => can.has(ch.codePointAt(0)))) {
        const pic = await wordPic(q); pg.drawImage(pic.png, { x: X(q.x - pic.pad), y: Y(q.y + q.h + pic.pad), width: (q.w + pic.pad * 2) / WP_PX, height: (q.h + pic.pad * 2) / WP_PX });
        ops.push(TR(TM.Invisible), ...unseen(pg, keys, joined ? q.s + ' ' : q.s, size, x, y, (to - q.x) / WP_PX), TR(TM.Fill));
        continue;
      }
      const F = q.F, has = wide(F, q.s, size); if (!(has > 0)) continue;
      if (!keys.has(F)) keys.set(F, pg.node.newFontDictionary(F.font.name, F.font.ref));
      const sx = q.mark ? 1 : (q.w / WP_PX) / has;
      ops.push(PDFLib.setFillingColor(rgb(q.L.c)), PDFLib.setFontAndSize(keys.get(F), size), PDFLib.setWordSpacing(joined ? (nx.x - q.x) / WP_PX / sx - wide(F, q.s + ' ', size) : 0), PDFLib.setTextMatrix(sx, 0, 0, 1, x, y), PDFLib.showText(F.font.encodeText(joined ? q.s + ' ' : q.s)));
    }
    ops.push(PDFLib.endText());
    pg.pushOperators(...ops);
    for (const u of after) pg.drawLine({ start: { x: X(u.x1), y: Y(u.y) }, end: { x: X(u.x2), y: Y(u.y) }, thickness: u.wd / WP_PX, color: rgb(u.c) });
    pg.pushOperators(PDFLib.popGraphicsState());
  }
  return await pdf.save();
}
// src/wordpdf.js
async function wordPdfPictures(f, { box, Wpx, host, page, P, cuts }) {
  const pdf = await PDFLib.PDFDocument.create(), font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica), can = new Set(font.getCharacterSet()), unseen = wordPdfUnseen(pdf);
  pdf.setTitle(f.name.replace(WORD_RX, ''));
  const skip = el => el.parentNode === document.body && el !== host && !/^(STYLE|LINK)$/.test(el.tagName);   // only this page is copied to be drawn
  for (let k = 0; k + 1 < cuts.length; k++) {
    const y0 = cuts[k], y1 = cuts[k + 1], hpx = Math.max(1, Math.ceil(y1 - y0));
    const c = await html2canvas(page, { scale: 1.5, backgroundColor: '#ffffff', logging: false, useCORS: true, x: 0, y: y0, width: Wpx, height: hpx, ignoreElements: skip });
    const jpg = await pdf.embedJpg(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82))).arrayBuffer());
    c.width = c.height = 0;
    const pg = pdf.addPage([box.W, box.H]);
    pg.drawImage(jpg, { x: 0, y: box.H - box.t - hpx / WP_PX, width: box.W, height: hpx / WP_PX });
    const key = pg.node.newFontDictionary(font.name, font.ref), keys = new Map(), ops = [PDFLib.beginText(), PDFLib.setTextRenderingMode(PDFLib.TextRenderingMode.Invisible)];
    for (const q of P.words) {
      if (q.mark || q.y + q.h / 2 < y0 || q.y + q.h / 2 >= y1) continue;
      const size = q.L.size / WP_PX;
      if (![...q.s].every(ch => can.has(ch.codePointAt(0)))) { ops.push(...unseen(pg, keys, q.s, size, q.x / WP_PX, box.H - box.t - (q.base - y0) / WP_PX, q.w / WP_PX)); continue; }
      const has = font.widthOfTextAtSize(q.s, size); if (!(has > 0)) continue;
      ops.push(PDFLib.setFontAndSize(key, size), PDFLib.setTextMatrix((q.w / WP_PX) / has, 0, 0, 1, q.x / WP_PX, box.H - box.t - (q.base - y0) / WP_PX), PDFLib.showText(font.encodeText(q.s)));
    }
    ops.push(PDFLib.endText());
    pg.pushOperators(...ops);
  }
  return await pdf.save();
}
// src/ib.js
const IB_TOP = 8;
// src/ib.js
const IB_GROUPS = [
  ['langlit', 'Language and literature', ['Analysing', 'Organizing', 'Producing text', 'Using language']],
  ['langacq', 'Language acquisition', ['Listening', 'Reading', 'Speaking', 'Writing']],
  ['indsoc', 'Individuals and societies', ['Knowing and understanding', 'Investigating', 'Communicating', 'Thinking critically']],
  ['sci', 'Sciences', ['Knowing and understanding', 'Inquiring and designing', 'Processing and evaluating', 'Reflecting on the impacts of science']],
  ['math', 'Mathematics', ['Knowing and understanding', 'Investigating patterns', 'Communicating', 'Applying mathematics in real-life contexts']],
  ['arts', 'Arts', ['Investigating', 'Developing', 'Creating or performing', 'Evaluating']],
  ['phe', 'Physical and health education', ['Knowing and understanding', 'Planning for performance', 'Applying and performing', 'Reflecting and improving performance']],
  ['design', 'Design', ['Inquiring and analysing', 'Developing ideas', 'Creating the solution', 'Evaluating']],
  ['idu', 'Interdisciplinary', ['Evaluating', 'Synthesizing', 'Reflecting']],
  ['pp', 'Personal project', ['Planning', 'Applying skills', 'Reflecting']],
  ['own', 'Another subject', ['Criterion A', 'Criterion B', 'Criterion C', 'Criterion D']],
];
// src/ib.js
const IB_BOUNDS_32 = [[28, 7], [24, 6], [19, 5], [15, 4], [10, 3], [6, 2], [1, 1]];
// src/ib.js
const IB_BOUNDS_DP = [[80, 7], [68, 6], [56, 5], [44, 4], [32, 3], [18, 2], [0, 1]];
// src/ib.js
const ibLetter = i => String.fromCharCode(65 + i);
// src/ib.js
function classWay(c) { return c && (c.way === 'myp' || c.way === 'dp') ? c.way : ''; }
// src/ib.js
const ibGroup = k => IB_GROUPS.find(g => g[0] === k) || null;
// src/ib.js
const ibGroupCrit = k => (ibGroup(k) || IB_GROUPS[IB_GROUPS.length - 1])[2].map((name, i) => ({ k: ibLetter(i), name }));
// src/ib.js
function ibBoundsFor(n) {
  if (n === 4) return IB_BOUNDS_32.map(b => b.slice());
  const top = n * IB_TOP; let last = top + 1;
  return IB_BOUNDS_32.map(([lo, g]) => { const v = Math.max(g === 1 ? 1 : 2, Math.min(last - 1, Math.round(lo * top / 32))); last = v; return [v, g]; });
}
// src/ib.js
function ibBoundsClean(b, def) {
  const rows = Array.isArray(b) ? b.filter(r => Array.isArray(r) && isFinite(+r[0]) && r[0] !== '' && r[0] != null && isFinite(+r[1])).map(r => [+r[0], +r[1]]) : [];
  const seen = new Set(), out = rows.sort((a, c) => c[1] - a[1]).filter(r => !seen.has(r[1]) && seen.add(r[1]));
  for (let i = 1; i < out.length; i++) if (out[i][0] >= out[i - 1][0]) return def.map(r => r.slice());
  return out.length >= 2 ? out : def.map(r => r.slice());
}
// src/ib.js
function ibCrit(c) {
  const ib = c && c.ib || {}, own = Array.isArray(ib.crit) ? ib.crit.filter(x => x && String(x.k || '').trim()).map(x => ({ k: String(x.k).trim().slice(0, 2), name: String(x.name || '').trim().slice(0, 80) })) : [];
  return own.length ? own : ibGroupCrit(ib.group);
}
// src/ib.js
function ibBounds(c) {
  if (classWay(c) === 'dp') return ibBoundsClean(c.ib && c.ib.bounds, IB_BOUNDS_DP);
  return ibBoundsClean(c && c.ib && c.ib.bounds, ibBoundsFor(ibCrit(c).length));
}
// src/ib.js
function ibGradeOf(v, bounds) { if (v == null || v === '' || isNaN(v)) return null; const b = bounds.find(r => +v >= r[0]); return b ? b[1] : null; }
export { exportPlan, nameOut, outStem, flattenDoc, oneLeftOver, xOne, xNames, xEdit, xAll, xEarly, gotEarly, canvasJpg, exportWhy, fbOn, keyOn, asgName, fileSafe, outWord, scanAll, buildSheetPdf, parseGrade, foundLabel, manyReads, readsCount, disagreeNote, gradeRows, tableHead, tableRow, gradesSummary, cellCopy, totalText, statusText, rowShown, scoreText, cellOut, csvCell, tsvLine, bandOf, ibSetup, meGrade, pctAvgText, setKey, keyRows, classStats, leftOutText, spreadBins, onThisScale, partNote, STATUS_LABEL, triesSay, anchorDocs, anchorDocPdf, anchorFile, anchorsHere, ANCHORS, anchorOf, anchorLabel, setAnchor, anchorCoverOn, wordPagesPdf, WP_MAX, scanFile, sheetRows, appScored, appShots, rowGraded, splitReads, readKey, readingDoubt, quietReads, paperScore, rivalReads, paperBytes, fileIn, sharePage, shareDocs, classCommon, nameFreeText, shareOpts, nameFindOn };
export { shareState, autoCovers, ownCovers, sameSpot, keptCovers, ensureCounts, wordScore, paperKey, coverList, coverSig, scanClip, IB_TOP, ibCrit };
