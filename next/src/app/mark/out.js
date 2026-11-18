// What leaves the marking screen: the Grades tab's rows and copies, Insights' numbers, and Return's files. Every one is the current
// app's own code (engines/gexport.js, lifted from src/app/export.js, src/feedback.js, src/app/gradesheet.js, src/anchors.js,
// src/rubrics.js classStats and src/app/dialogs.js gradeRows), so a returned PDF, a copied table and an average come out of the new
// app exactly as they come out of the current one. Loaded with its libraries (pdf-lib, fflate) when Grades, Insights or Return
// opens (router.js PARTS.out), as pdf.js is loaded for a paper. Nothing here writes saved work: a returned time and "Returned" go
// through mark/marking.js, which saves through students/write.js.
import * as X from '../../engines/gexport.js';
import { use, state, gradeOf, fmtNum, noScore } from '../../engines/gcore.js';
import { layoutOf, docIn, docAuto } from '../../engines/gdraw.js';
import { store } from '../../engines/gstore.js';
import { PARTS } from '../router.js';
import { libs as pdfReady } from './paper.js';
// The marking code (mark/marking.js), handed in by the marking screen once its tools have loaded (saving and undo live there).
let M = null;
export const withMarking = m => { M = m; };
export { X };
export const marking = () => M;
let ready = null;
// pdf.js (reading the papers), pdf-lib (writing the returned PDFs) and fflate (the ZIP), as the current app has them at hand.
export function load() {
  return (ready ||= (async () => {
    const [pl, ff] = await Promise.all([PARTS.pdflib(), PARTS.zip(), pdfReady()]);
    use({ PDFLib: pl, fflate: ff });
  })());
}

// A grade written on a paper counts, so the papers are read first, as the current app reads them before Grades, Insights and Return.
// Word rubrics already highlighted give their scores first (mark/word.js scoresAll), as the current app runs wordScoresAll here.
export async function readPapers(onStep) { await load(); M.commit(); if (hasWord()) await (await PARTS.word()).scoresAll(M); await X.scanAll(onStep); }
const hasWord = () => state().batch.students.some(st => st.files.some(f => f.kind === 'docx'));

/* ---------- Grades ---------- */
export const order = () => state().gradesOrder;
export const setOrder = k => use({ gradesOrder: k });
// One row a student (or a roster name with nothing in), as the current Grades tab lists them.
export function rows() {
  const s = state(), rub = s.setup.mode === 'rubric', ib = X.ibSetup();
  return X.gradeRows().map((r, k) => {
    if (r.missing) return { n: k + 1, missing: r.missing };
    const g = gradeOf(r.st);
    return {
      n: k + 1, i: r.i, st: r.st, off: !!r.off, none: !r.st.files.length, g,
      rows: rub ? s.setup.criteria.map((_, q) => fmtNum(X.rowShown(r.st, q))) : [],
      total: ib ? '' : X.cellCopy(g, 'total'), totalText: ib ? '' : X.totalText(g), pct: ib ? '' : X.cellCopy(g, 'pct'),
      band: X.bandOf(g.pct), status: X.statusText(r.st), comment: r.st.grade.comment || '',
      paper: onPaper(r.st),
    };
  });
}
// What the paper itself says, beside her score (src/tabs.js glPaperOf), in words: a grade read off it, or one to confirm.
function onPaper(st) {
  if (!st.files.length || noScore(st)) return null;
  const g = gradeOf(st), open = g.total == null && g.pct == null;
  if (X.manyReads(st)) return { ask: 'many', n: X.readsCount(st) };
  if (open && st.doubts && st.doubts.length) return { ask: 'confirm', said: X.foundLabel(st.doubts[0]) };
  const note = X.disagreeNote(st), ty = st.grade.sheet;
  const said = st.found && st.found.found ? X.foundLabel(st.found) : ty !== '' && ty != null && !isNaN(+ty) ? fmtNum(+ty) : '';
  if (!said) return null;
  return { said, differs: note || '' };
}
export const summary = () => X.gradesSummary();
export const head = () => X.tableHead();
// The words the current app copies: every total, every percent, every level, or the whole table with tabs between.
export function copyText(k) {
  const R = X.gradeRows(), s = state();
  const lines = R.map((r, n) => {
    if (r.missing) return k === 'tsv' ? X.tsvLine([String(n + 1), r.missing]) : '';
    if (k === 'tsv') return X.tsvLine(X.tableRow(r.st, n));
    if (k === 'lv') return s.setup.criteria.map((_, q) => fmtNum(X.rowShown(r.st, q))).join('\t');
    return X.scoreText(gradeOf(r.st), k);
  });
  if (k === 'tsv') lines.unshift(X.tsvLine(X.tableHead()));
  return { text: lines.join('\n'), n: R.length };
}
export function csv() {
  const R = X.gradeRows();
  return '﻿' + [X.tableHead()].concat(R.map((r, k) => r.missing ? [String(k + 1), r.missing] : X.tableRow(r.st, k))).map(r => r.map(X.csvCell).join(',')).join('\r\n');
}
export async function sheetPdf() { await readPapers(); return new Blob([await X.buildSheetPdf()], { type: 'application/pdf' }); }

/* ---------- Insights ---------- */
export const stats = () => X.classStats();
export const leftOut = s => X.leftOutText(s);

/* ---------- Return ---------- */
// The options the current Return box keeps (the same keys), read fresh each time.
export const opts = () => ({ one: X.xOne(), names: X.xNames(), edit: X.xEdit(), key: X.keyOn(), fb: X.fbOn(), all: X.xAll(), early: X.xEarly() });
const KEYS = { one: 'gs.xone', names: 'gs.xnames', edit: 'gs.xedit', fb: 'gs.xfb', all: 'gs.xall', early: 'gs.xearly' };
export const anchorCover = v => store.set('gs.anchorCover', !!v);
export function setOpt(k, v) { if (k === 'key') X.setKey(o => { o.on = v; }); else if (KEYS[k]) store.set(KEYS[k], v); }
// What would go back now: the files, from how many students, who is left out and why (the current Return box's counts).
export function plan() {
  const s = state(), b = s.batch, list = X.exportPlan(true);
  const early = [...new Set(X.exportPlan(true, true).map(o => o.st))].filter(X.gotEarly), nOut = X.xEarly() ? early.length : 0;
  const nStu = new Set(list.map(o => o.st)).size, skipped = b.students.length - nStu - nOut;
  const nLeft = b.students.reduce((a, st) => a + layoutOf(st).filter(d => !docAuto(st, d) && !docIn(st, d)).length, 0);
  return { files: list.length, students: nStu, skipped, left: nLeft, early, nOut, example: list[0] ? X.nameOut([{ ...list[0] }])[0].path.split('/').pop() : '' };
}
let busy = false;
export const exporting = () => busy;
// Every marked file, flattened as the current app flattens it, into a ZIP (or a folder she picked). Returns the files made and any
// that couldn't be, with the current app's reason for each.
export async function exportAll({ keep = true, dpi = 150, sheet = true, dir = null, onStep = () => {} } = {}) {
  if (busy) throw new Error('busy');
  busy = true;
  try {
    await M.saveNowDone();
    const b = state().batch;
    if (b.lineBusy) await b.lineRun;
    const o = opts(), files = {}, failed = [], fbGiven = new Set(), tnGiven = new Set();
    const putOut = async (path, make, st) => {
      try {
        const bytes = await make();
        if (dir) {
          const parts = path.split('/'); let h = dir;
          for (const part of parts.slice(0, -1)) h = await h.getDirectoryHandle(part, { create: true });
          const w = await (await h.getFileHandle(parts[parts.length - 1], { create: true })).createWritable(); await w.write(bytes); await w.close();
        } else files[path] = [bytes, { level: 0 }];
        return true;
      } catch (er) { console.error(path, er); failed.push({ path, st, why: X.exportWhy(er, !!dir) }); return false; }
    };
    onStep('read', 0, 1);
    await readPapers((n, t) => onStep('read', n, t));
    const items = X.nameOut(X.exportPlan(keep));
    if (sheet) await putOut(('Grade sheet - ' + b.name + '.pdf').replace(/[\\/:*?"<>|]+/g, '-'), X.buildSheetPdf);
    let nOut = 0;
    for (let i = 0; i < items.length; i++) {
      onStep('bake', i, items.length);
      const it = items[i], fk = it.one ? it : it.st;
      if (await putOut(it.path, () => it.raw ? it.f.data : X.flattenDoc(it.st, it.d, dpi, o.edit, o.key, o.fb && !fbGiven.has(fk) && !!fbGiven.add(fk), !tnGiven.has(it.st) && !!tnGiven.add(it.st)), it.st)) nOut++;
      if (it.one) for (const x of X.oneLeftOver(it)) if (await putOut(x.path, () => x.bytes, it.st)) nOut++;
    }
    onStep('bake', items.length, items.length);
    const zip = !dir && Object.keys(files).length ? new Blob([state().fflate.zipSync(files)], { type: 'application/zip' }) : null;
    if (nOut && (dir || zip)) M.setReturned(nOut);
    return { nOut, failed, zip, name: 'Marked - ' + b.name + '.zip', paths: Object.keys(files), files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v[0]])) };
  } finally { busy = false; }
}
// One student's paper on its own (the current app's exportOne): one file as it is, or several in one ZIP. Marks them as exported.
export async function exportOne(st) {
  if (busy) throw new Error('busy');
  busy = true;
  try {
    await M.saveNowDone(); if (hasWord()) await (await PARTS.word()).scoresAll(M);
    const b = state().batch, o = opts(), mine = () => X.nameOut(X.exportPlan(false, true).filter(x => x.st === st));
    let items = mine();
    if (!items.length) { await readPapers(); items = mine(); }
    if (!items.length) return { none: true };
    const files = {}, failed = [];
    let fbGiven = false, tnGiven = false;
    for (const it of items) {
      const base = it.path.split('/').pop(), name = o.names || base.includes(st.key) ? base : st.key + ' - ' + base;
      try {
        files[name] = it.raw ? it.f.data : await X.flattenDoc(st, it.d, 150, o.edit, o.key, o.fb && (it.one || !fbGiven) && (fbGiven = true), !tnGiven && (tnGiven = true));
        if (it.one) for (const x of X.oneLeftOver(it)) files[x.path.split('/').pop()] = x.bytes;
      } catch (er) { console.error(it.path, er); failed.push({ path: it.path, why: X.exportWhy(er, false) }); }
    }
    const names = Object.keys(files);
    if (!names.length) throw new Error('the file couldn’t be made');
    let blob, name;
    if (names.length === 1) { name = names[0]; blob = new Blob([files[name]], { type: /\.pdf$/i.test(name) ? 'application/pdf' : 'application/octet-stream' }); }
    else { const z = {}; for (const n of names) z[n] = [files[n], { level: 0 }]; name = (o.names ? X.outStem(st) : st.key + ' - ' + b.name) + '.zip'; blob = new Blob([state().fflate.zipSync(z)], { type: 'application/zip' }); }
    if (state().batch === b) M.markSent(st);
    return { name, blob, n: names.length, failed };
  } finally { busy = false; }
}
// Anchor papers (src/anchors.js anchorExport): every file of each picked paper, named for the assignment and its level ("Essay -
// Summative High.pdf"), with names covered the way an assistant's copy covers them unless she turned that off; more than one in a ZIP.
export async function anchorsOut() {
  if (busy) throw new Error('busy');
  const picked = X.ANCHORS.map(([k]) => ({ k, j: X.anchorOf(k) })).filter(x => x.j >= 0);
  if (!picked.length) return { none: true };
  busy = true;
  try {
    await M.saveNowDone(); await load();
    const b = state().batch, cover = X.anchorCoverOn(), files = {}, failed = [];
    if (cover) await X.classCommon();
    for (const { k, j } of picked) {
      const st = b.students[j], docs = X.anchorDocs(st);
      if (!docs.length) { failed.push({ lv: X.anchorLabel(k), why: '' }); continue; }
      for (let n = 0; n < docs.length; n++) {
        try { files[X.anchorFile(k, n, docs.length)] = await X.anchorDocPdf(st, docs[n], cover); }
        catch (er) { console.error(er); failed.push({ lv: X.anchorLabel(k), why: X.exportWhy(er, false) }); }
      }
    }
    const names = Object.keys(files);
    if (!names.length) throw new Error(failed.map(f => f.lv + (f.why ? ' (' + f.why + ')' : '')).join(', ') || 'nothing could be made');
    if (names.length === 1) return { name: names[0], blob: new Blob([files[names[0]]], { type: 'application/pdf' }), n: 1, failed };
    const z = {}; for (const nm of names) z[nm] = [files[nm], { level: 0 }];
    return { name: 'Anchor papers - ' + X.nameFreeText(b.name) + '.zip', blob: new Blob([state().fflate.zipSync(z)], { type: 'application/zip' }), n: names.length, failed };
  } finally { busy = false; }
}
// A file to her computer, as the current app's saveBlob does in a browser tab.
export function saveFile(name, blob) {
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
// The checks' way in: one document of one student, flattened as Return would (next/test/browser/mark-out.test.js).
export async function flattenFirst(i, dpi = 150) {
  await readPapers();
  const st = state().batch.students[i], d = layoutOf(st).find(x => docIn(st, x));
  const o = opts();
  return X.flattenDoc(st, d, dpi, o.edit, o.key, o.fb, true);
}
