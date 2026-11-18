// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, cur, lib, pages, saveSoon, pdfjsLib, PDFLib, workerReady, store, idbDo, ownGrade, fmtNum, COLORS, HL } from './gcore.js';
import { vpRot, skewXf, viewable, madeFromWord, scrub, nameFold, anonOn, SORT_STOP, AT_START, ID_RX, latinRx, isLatin, anyRx, wordOk, bounded, alt, runAlts, latinParts, initialAlts, altsRx, namesNow, ownNames, AT_END, FILE_SEP } from './gdraw.js';
import { moveFileNow, REF_KEY, underId, paperGet, goneNow, hasSheet, gradeHasWork, nfc, sameBytes } from './gopen.js';

// src/app/files.js
function setDocIn(st, d, on) {
  if (st.layout) { const t = st.layout.find(x => x === d || (x.name === d.name && JSON.stringify(x.pages) === JSON.stringify(d.pages))); if (t) t.out = !on; }
  else { st.inc = st.inc || {}; st.inc[d.file] = on; }
  saveSoon();
}
// src/app/paper.js
const r1 = v => Math.round(v * 10) / 10;
// src/app/gradesheet.js
const commentText = a => ((a.contentsObj && a.contentsObj.str) || a.contents || '').replace(/\r\n?/g, '\n').trim();
// src/app/library.js
let fresh = store.get('gs.lib', null) == null;   // a browser nobody has used yet: it gets the welcome, and nothing of anyone's
// src/app/replace.js
const markCount = f => Object.values(f.marks || {}).reduce((n, a) => n + a.length, 0);
// src/app/replace.js
const replacedOf = f => { const st = batch && batch.students[cur]; if (!st || !batch.removed) return null; const p = Object.keys(batch.removed).find(k => batch.removed[k].by === f.path && !batch.removed[k].back); return p ? ((st.gone || []).find(g => g.path === p) || { name: p.slice(p.lastIndexOf('/') + 1) }) : null; };
// src/app/replace.js
function outPages(st) {
  if (!st.layout) return [];
  const has = new Set(st.layout.flatMap(d => d.pages.map(([q, p]) => q + '|' + p))), out = [];
  for (const f of st.files) if (viewable(f) && f.numPages) for (let p = 0; p < f.numPages; p++) if (!has.has(f.path + '|' + p)) out.push([f.path, p]);
  return out;
}
// src/app/bringin.js
const sortTag = r => r.i === -2 ? '<span class="muted">Skipped</span>' : r.i < 0 ? '<span class="pill" style="font-size:12px;padding:2px 8px;border-radius:999px;background:var(--warn-soft);color:var(--warn)">Choose</span>'
  : r.set ? '<span class="muted">Chosen by you</span>' : r.sure ? '<span style="color:var(--ok);font-size:13px;font-weight:600">Matched by name</span>' : '<span class="pill" style="font-size:12px;padding:2px 8px;border-radius:999px;background:var(--warn-soft);color:var(--warn)">Check</span>';
// src/names.js
function fileAlts(parts) {
  const out = [], L = latinParts(parts);
  for (const p of parts) if (wordOk(p)) {
    const w = nameFold(p), latin = isLatin(p);
    out.push(alt(w.length, latin && w.length >= 3 && !SORT_STOP.has(w) ? anyRx(p) : bounded(p, anyRx(p))));
    if (latin && w.length < 3) out.push(alt(w.length, '(?<!\\p{Lu})' + latinRx(w, true) + '(?!\\p{Ll})'));   // MyEssay, EssayMy
  }
  for (const a of L) for (const b of L) if (a !== b && nameFold(b).length >= 2) out.push(alt(nameFold(b).length + 2, AT_START + latinRx(nameFold(b)) + FILE_SEP + latinRx(nameFold(a)[0]) + AT_END));
  if (L.length >= 2) out.push(alt(2, AT_START + L.map(p => latinRx(nameFold(p)[0])).join('') + AT_END));
  return out;
}
// src/names.js
function fileRx(st) {
  const N = namesNow(); let rx = N.file.get(st.key);
  if (!rx) N.file.set(st.key, rx = new RegExp([ID_RX, altsRx(ownNames(st).map(p => [...runAlts(p), ...initialAlts(p), ...fileAlts(p)])), N.classSrc].filter(Boolean).join('|'), 'gu'));
  return rx;
}
// src/names.js
const fileShown = (st, name) => anonOn() && st ? scrub(name, fileRx(st)) : name;
// src/marking.js
const rectBox = rs => { const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y)); return { x, y, w: r1(Math.max(...rs.map(r => r.x + r.w)) - x), h: r1(Math.max(...rs.map(r => r.y + r.h)) - y) }; };
// src/marking.js
function setRects(m, rects) {
  Object.assign(m, rectBox(rects));
  if (rects.length > 1) m.rects = rects; else delete m.rects;
  return m;
}
// src/grades.js
const STATUS_LABEL = { missing: 'Missing', excused: 'Excused', late: 'Late' };
// src/grades.js
function gradeWords(st) {
  const g = st.grade, own = ownGrade(st).total, out = [];
  if (own != null && !isNaN(own)) out.push('a score of ' + fmtNum(own));
  else if (hasSheet(g)) out.push('a score of ' + g.sheet);
  else if ((g.rubric || []).some(v => v != null) || (g.points != null && g.points !== '')) out.push('a score');
  if (g.comment) out.push('a comment');
  if (g.status) out.push('the status ' + STATUS_LABEL[g.status]);
  return out;
}
// src/grades.js
const wordsJoin = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a.join('');
// src/intake.js
async function freshRows(rows) {
  const here = batch.students.flatMap(st => st.files.filter(f => f.kind !== 'img' && !f.virtual && f.data).map(f => ({ path: f.path, data: f.data })));
  try { const rec = await paperGet(batch.id); if (rec && rec.entries) here.push(...rec.entries.filter(e => e.data)); } catch {}
  try { here.push(...((await idbDo('readonly', o => o.getAll(underId(batch.id)))) || []).filter(r => r.bid === batch.id && r.key !== REF_KEY && r.data)); } catch {}
  const sizes = new Set(here.map(x => x.data.length)), fresh = [];
  let dups = 0;
  for (const r of rows) {
    let same = false;
    if (sizes.has(r.e.file.size)) {
      const bytes = new Uint8Array(await r.e.file.arrayBuffer());
      same = here.some(x => sameBytes(x.data, bytes) && (r.i < 0 || !batch.students[r.i] || batch.students[r.i].files.some(f => nfc(f.path) === nfc(x.path))));
    }
    if (same) dups++; else fresh.push(r);
  }
  return { fresh, dups };
}
// src/intake.js
const guessNewName = path => { const p = path.split('/').filter(Boolean); return (p.length > 2 ? p[p.length - 2] : p.length > 1 ? p[0] : p[0].replace(/\.[^.]+$/, '')).trim(); };
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
async function gsFlatCheck(f, doc) {
  if (f.gsFlat !== undefined) return f.gsFlat;
  f.gsFlat = false;
  if (f.kind !== 'pdf' || f.virtual || f.noauto) return false;
  try { const { info } = await doc.getMetadata(); f.gsFlat = !!info && info.Creator === 'Grading Studio'; } catch {}
  return f.gsFlat;
}
// src/pastetext.js
const PT_W = 595.28, PT_H = 841.89, PT_M = 64, PT_SIZE = 12, PT_LINE = 18;
// src/pastetext.js
function pasteClean(s) {
  return String(s || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/[   ]/g, ' ').replace(/[​-‍⁠﻿­]/g, '').replace(/[ \t]+$/gm, '').replace(/^\n+|\s+$/g, '');
}
// src/pastetext.js
const pasteName = s => (String(s || '').replace(/[\\/:*?"<>|\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Emailed work');
// src/pastetext.js
function pasteWrap(text, width, measure, words) {
  const out = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    let line = '';
    for (const w of words(para)) {
      if (measure(line + w) <= width) { line += w; continue; }
      if (line.trim()) { out.push(line.replace(/\s+$/, '')); line = ''; }
      let piece = w.replace(/^\s+/, '');
      while (measure(piece) > width) {
        let k = 1; while (k < piece.length && measure(piece.slice(0, k + 1)) <= width) k++;
        out.push(piece.slice(0, k)); piece = piece.slice(k);
      }
      line = piece;
    }
    out.push(line.replace(/\s+$/, ''));
  }
  return out;
}
// src/pastetext.js
const spaceWords = para => para.match(/\s*\S+/g) || [];
// src/pastetext.js
const segWords = para => {   // languages written without spaces (Thai) break between words, where the browser knows how
  try { return [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(para)].map(s => s.segment); } catch { return para.match(/\s*\S+/g) || []; }
};
// src/pastetext.js
function pastePages(lines, firstTop) {
  const pages = [[]]; let y = firstTop;
  for (const l of lines) {
    if (y - PT_LINE < PT_M) { pages.push([]); y = PT_H - PT_M; }
    pages[pages.length - 1].push(l); y -= PT_LINE;
  }
  return pages;
}
// src/pastetext.js
async function pasteTextPdf(title, text, when) {
  text = pasteClean(text); title = pasteName(title);
  const doc = await PDFLib.PDFDocument.create();
  doc.setTitle(title);   // no Creator: 'Grading Studio' there means a flattened export (imported.js)
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica), bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const sub = 'Pasted from a message on ' + new Date(when || Date.now()).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const can = new Set(font.getCharacterSet()), typed = [...(title + sub + text)].every(ch => ch === '\n' || can.has(ch.codePointAt(0)));
  const width = PT_W - 2 * PT_M, gray = PDFLib.rgb(0.45, 0.45, 0.45), ink = PDFLib.rgb(0.1, 0.1, 0.12);
  if (typed) {
    const lines = pasteWrap(text, width, s => font.widthOfTextAtSize(s, PT_SIZE), spaceWords);
    const titleLines = pasteWrap(title, width, s => bold.widthOfTextAtSize(s, 16), spaceWords);
    let top = PT_H - PT_M - 16 - (titleLines.length - 1) * 21 - 44;
    pastePages(lines, top).forEach((pl, i) => {
      const page = doc.addPage([PT_W, PT_H]);
      let y = PT_H - PT_M - PT_SIZE;
      if (i === 0) {
        y = PT_H - PT_M - 16;
        for (const t of titleLines) { page.drawText(t, { x: PT_M, y, size: 16, font: bold, color: ink }); y -= 21; }
        y += 21 - 16; page.drawText(sub, { x: PT_M, y, size: 9.5, font, color: gray }); y = top;
      }
      for (const l of pl) { if (l) page.drawText(l, { x: PT_M, y, size: PT_SIZE, font, color: ink }); y -= PT_LINE; }
    });
    return { bytes: await doc.save(), typed: true };
  }
  // Pictures of the pages, drawn twice the size for sharp marking
  try { await Promise.all([document.fonts.load('400 24px Inter', text), document.fonts.load('700 32px Inter', title)]); } catch {}
  const S = 2, c = document.createElement('canvas'); c.width = Math.round(PT_W * S); c.height = Math.round(PT_H * S);
  const g = c.getContext('2d'), face = '"Inter", system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Thai", Tahoma, sans-serif';
  const setFont = (px, w) => { g.font = (w || 400) + ' ' + (px * S) + 'px ' + face; };
  setFont(PT_SIZE); const lines = pasteWrap(text, width * S, s => g.measureText(s).width, segWords);
  setFont(16, 700); const titleLines = pasteWrap(title, width * S, s => g.measureText(s).width, segWords);
  const top = PT_H - PT_M - 16 - (titleLines.length - 1) * 21 - 44;
  for (const [i, pl] of pastePages(lines, top).entries()) {
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.textBaseline = 'alphabetic';
    let y = PT_M + PT_SIZE;
    if (i === 0) {
      y = PT_M + 16; g.fillStyle = '#1a1a1f'; setFont(16, 700);
      for (const t of titleLines) { g.fillText(t, PT_M * S, y * S); y += 21; }
      y += 16 - 21; g.fillStyle = '#737373'; setFont(9.5); g.fillText(sub, PT_M * S, y * S); y = PT_H - top;
    }
    g.fillStyle = '#1a1a1f'; setFont(PT_SIZE);
    for (const l of pl) { if (l) g.fillText(l, PT_M * S, y * S); y += PT_LINE; }
    const png = await new Promise(r => c.toBlob(r, 'image/png'));
    const img = await doc.embedPng(new Uint8Array(await png.arrayBuffer()));
    doc.addPage([PT_W, PT_H]).drawImage(img, { x: 0, y: 0, width: PT_W, height: PT_H });
  }
  return { bytes: await doc.save(), typed: false };
}
export { goneNow, markCount, replacedOf, freshRows, guessNewName, fileShown, sortTag, madeFromWord, setDocIn, gradeWords, wordsJoin, moveFileNow, gradeHasWork, pasteTextPdf, pasteClean, pasteName, outPages, impRead, impCount, gsFlatCheck, impKind };
