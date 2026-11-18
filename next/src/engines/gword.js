// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, cur, setup, pages, tr, saveSoon, fflate, toast, renderList, gradeMarksChanged, groupJust, store, SCALE12, rowTop, rowsMax, rowScaleOf, maxPoints, percentWith, gradeOf, xcSay, ownGrade, fmtNum, noScore, ibSetup } from './gcore.js';
import { rgb, draw, one, stampHidden } from './gdraw.js';

// src/app/start.js
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// src/app/paper.js
function changed(pg) { justTag(pg); scanned = false; draw(pg); gradeMarksChanged(pg.file); saveSoon(); renderList(); }
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
let scanned = false;
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
function wordBytes(w) {
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + new XMLSerializer().serializeToString(w.doc.documentElement);
  return fflate.zipSync({ ...w.files, 'word/document.xml': new TextEncoder().encode(xml) });
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
// src/app/word.js
const wRunText = r => [...r.children].map(c => c.localName === 't' ? c.textContent : c.localName === 'tab' ? '\t' : c.localName === 'br' || c.localName === 'cr' ? '\n' : '').join('');
// src/app/word.js
function wSetText(w, r, text) {
  for (const c of [...r.children]) if (['t', 'tab', 'br', 'cr', 'noBreakHyphen'].includes(c.localName)) r.removeChild(c);
  text.split(/(\t|\n)/).forEach(part => {
    if (!part) return;
    if (part === '\t') r.appendChild(w.doc.createElementNS(W_NS, 'w:tab'));
    else if (part === '\n') r.appendChild(w.doc.createElementNS(W_NS, 'w:br'));
    else { const t = w.doc.createElementNS(W_NS, 'w:t'); t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); t.textContent = part; r.appendChild(t); }
  });
}
// src/app/word.js
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
// src/app/word.js
const CELL_COLORS = [['#FFF59D', 'Yellow'], ['#C8E6C9', 'Green'], ['#BBDEFB', 'Blue'], ['#F8BBD0', 'Pink'], ['', 'No color']];
// src/app/wordrubric.js
const RUB_HL = '#FFF59D';
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
function fillTotalBlank(w, page, m, s, filled) {
  const re = new RegExp('(^|[^\\d])([_\\s.\\d]*)\\/\\s*' + m.max + '(?!\\d)');
  const spots = [...page.querySelectorAll('p.wp')].filter(p => !m.cells.some(c => c.td.contains(p)) && re.test(p.textContent) && /score|total|grade|points/i.test((p.closest('td') || p).textContent));
  if (spots.length !== 1) return false;
  const p = spots[0], was = p.textContent;
  if (filled && (s.total == null || !/\d\s*%/.test(was))) return false;
  const sp = [...p.querySelectorAll('[data-ri]')].find(x => re.test(x.textContent)) ;
  if (!sp) return false;
  sp.textContent = sp.textContent.replace(re, (all, a, blank) => a + (blank && /\S/.test(blank) && !/[_\d]/.test(blank) ? blank : ' ') + (s.total == null ? '____' : fmtNum(s.total)) + ' /' + (all.match(/\/(\s*)/)[1] || ' ') + m.max);
  const pc = [...p.querySelectorAll('[data-ri]')].find(x => /[_\d.]*\s*%/.test(x.textContent) && x !== sp) || (/%/.test(sp.textContent) ? sp : null);
  if (pc) pc.textContent = pc.textContent.replace(/([=:]?\s*)[_\d.]*\s*%/, (a, pre) => (pre || '') + (s.pct == null ? '____' : fmtNum(s.pct)) + '%');
  if (p.textContent === was) return false;
  wApplyPara(w, p);
  return true;
}
// src/app/wordrubric.js
const wordLineHers = (st, s) => s.total != null && ownGrade(st).total === s.total;
// src/app/wordrubric.js
function rubricToGrade(st, s, max, nCrit) {
  if (setup.mode === 'points') { if (+setup.outOf === max) setWordPoints(st, s); }
  else if (setup.criteria.length === nCrit) { const was = st.grade.rubric; st.grade.rubric = s.per.map(v => v == null ? null : v); s.per.forEach((v, k) => { if ((was[k] ?? null) !== (v ?? null)) touchGrade(st, k); }); }
  else setWordPoints(st, s);
}
// src/app/wordrubric.js
function wordScoreGone(st, was) {
  if (!was || was.total == null) return;
  const g = st.grade;
  if (setup.mode === 'rubric' && setup.criteria.length === was.per.length) { was.per.forEach((v, k) => { if (v != null && g.rubric[k] === v) { g.rubric[k] = null; touchGrade(st, k); } }); return; }
  if (String(g.points) === String(was.total)) { g.points = ''; touchGrade(st); }
}
// src/app/wordrubric.js
const scaleDiffers = scale => !!scale && setup.mode === 'points' && JSON.stringify(scale) !== JSON.stringify(setup.scale);
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
// src/grades.js
const hasSheet = g => g.sheet != null && g.sheet !== '';
// src/grades.js
const hasOwnScore = st => ownGrade(st).total != null || hasSheet(st.grade);
// src/grades.js
function touchGrade(st, rowIndex) {
  const g = st.grade, t = Date.now();
  if (rowIndex !== 'points' && g.at && g.points !== '' && g.points != null && !(g.atR && g.atR.points)) (g.atR ||= {}).points = g.at;   // a points score from before these times were kept: when it last changed is the last we know of
  g.at = t;
  if (rowIndex != null) (g.atR ||= {})[rowIndex] = t;
  stampSoon(st);
}
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
function liftStatus(st) {
  if (!noScore(st)) return;
  const was = st.grade.status;
  st.grade.status = ''; touchGrade(st);
  toast('No longer marked ' + was);
}
// src/grades.js
function tryOfFile(st, f) {
  const ts = st && st.grade && st.grade.tries; if (!ts || !ts.length || !f) return 0;
  const i = ts.findIndex(t => (t.files || []).includes(f.path));
  return i < 0 ? 0 : i + 1;
}
// src/grades.js
function setWordPoints(st, s) {
  const v = String(s.total);
  if (String(st.grade.points) !== v) touchGrade(st, 'points');
  st.grade.points = v;
}
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
const readKey = g => (g.page != null ? g.page : 'w') + '|' + g.text;
// src/rubrics.js
const people = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
// src/merge.js
function rubricKey(su) {
  const s = su || {}, pts = s.mode === 'points', max = pts ? +(s.outOf == null ? 10 : s.outOf) || 0 : (!s.criteria ? 12 : typeof rowsMax === 'function' ? rowsMax(s) : s.criteria.length * 4), sc   /* this file also runs on its own in tests, where a row is always 0 to 4 */ = s.scale === undefined ? SCALE12 : s.scale || {};
  const keys = Object.keys(sc).filter(k => sc[k] !== '' && sc[k] != null && !isNaN(+sc[k])).map(Number).sort((a, b) => a - b);
  // rows scored on another scale than 0 to 4 with halves: a different rubric, even when the total is the same
  const own = pts || typeof rowScaleOf !== 'function' ? {} : rowScaleOf(s);
  return JSON.stringify([pts, max, keys.length >= 2 && keys[keys.length - 1] === max ? keys.map(k => [k, +sc[k]]) : 0].concat(Object.keys(own).length ? [own] : []));
}
// src/groups.js
function groupOf(st) { return (st && batch && (batch.groups || []).find(g => g.k.includes(st.key))) || null; }
// src/groups.js
function groupFileOf(g, st) { const p = g.p && g.p[st.key]; return p ? st.files.find(f => f.path === p) || null : null; }
// src/groups.js
const groupOwn = g => !!(g && g.own);
// src/groups.js
const groupJustOn = st => !!(st && groupJust === st.key && groupOwn(groupOf(st)) && groupFileOf(groupOf(st), st));
// src/groups.js
function justTag(pg) { if (!pg.seen || !groupJustOn(batch.students[cur])) return; for (const m of pg.marks()) if (!pg.seen.has(m) && !m.o) m.o = groupJust; pg.seen = null; }
// src/wordnotes.js
const WCM_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments';
// src/wordnotes.js
const WCM_CT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml';
// src/wordnotes.js
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
// src/wordnotes.js
const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
// src/wordnotes.js
const wXml = bytes => new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
// src/wordnotes.js
const wXmlBytes = doc => new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + new XMLSerializer().serializeToString(doc.documentElement));
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
function wCommentsMade(w) {
  const have = wComments(w);
  if (have === false) return null;
  if (have) return have;
  w.cdoc = new DOMParser().parseFromString('<w:comments xmlns:w="' + W_NS + '"></w:comments>', 'application/xml');
  if (!w.cpath) {
    w.cpath = 'word/comments.xml';
    const rp = 'word/_rels/document.xml.rels';
    const rd = w.files[rp] ? wXml(w.files[rp]) : new DOMParser().parseFromString('<Relationships xmlns="' + PKG_REL_NS + '"></Relationships>', 'application/xml');
    const ids = new Set([...rd.getElementsByTagName('Relationship')].map(r => r.getAttribute('Id')));
    let n = 1; while (ids.has('rIdGs' + n)) n++;
    const r = rd.createElementNS(PKG_REL_NS, 'Relationship');
    r.setAttribute('Id', 'rIdGs' + n); r.setAttribute('Type', WCM_REL); r.setAttribute('Target', 'comments.xml');
    rd.documentElement.appendChild(r);
    w.files[rp] = wXmlBytes(rd);
  }
  const cp = '[Content_Types].xml';
  if (w.files[cp]) {
    const cd = wXml(w.files[cp]), part = '/' + w.cpath;
    if (!wXmlBad(cd) && ![...cd.getElementsByTagName('Override')].some(o => o.getAttribute('PartName') === part)) {
      const o = cd.createElementNS(CT_NS, 'Override'); o.setAttribute('PartName', part); o.setAttribute('ContentType', WCM_CT);
      cd.documentElement.appendChild(o); w.files[cp] = wXmlBytes(cd);
    }
  }
  wCommentsKeep(w);
  return w.cdoc;
}
// src/wordnotes.js
const wCommentsKeep = w => { w.files[w.cpath] = wXmlBytes(w.cdoc); };
// src/wordnotes.js
const wCommentEls = w => wComments(w) ? [...w.cdoc.documentElement.children].filter(c => c.localName === 'comment') : [];
// src/wordnotes.js
const wCommentText = c => [...c.children].filter(p => p.localName === 'p').map(p => [...p.getElementsByTagNameNS(W_NS, 'r')].map(wRunText).join('')).join('\n').trim();
// src/wordnotes.js
function wCommentSet(w, c, text) {
  const d = w.cdoc;
  for (const p of [...c.children]) if (p.localName === 'p') c.removeChild(p);
  for (const line of text.split('\n')) {
    const p = d.createElementNS(W_NS, 'w:p'), r = d.createElementNS(W_NS, 'w:r'), t = d.createElementNS(W_NS, 'w:t');
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); t.textContent = line;
    r.appendChild(t); p.appendChild(r); c.appendChild(p);
  }
}
// src/wordnotes.js
function wNextId(w) {
  let n = -1;
  for (const c of wCommentEls(w)) n = Math.max(n, +wId(c) || 0);
  for (const k of ['commentRangeStart', 'commentRangeEnd', 'commentReference']) for (const e of w.doc.getElementsByTagNameNS(W_NS, k)) n = Math.max(n, +wId(e) || 0);
  return String(n + 1);
}
// src/wordnotes.js
const wMarker = (w, kind, id) => { const e = w.doc.createElementNS(W_NS, 'w:' + kind); e.setAttributeNS(W_NS, 'w:id', id); return e; };
// src/wordnotes.js
const wRefRun = (w, id) => { const r = w.doc.createElementNS(W_NS, 'w:r'); r.appendChild(wMarker(w, 'commentReference', id)); return r; };
// src/wordnotes.js
function wSplitSpan(w, span, off) {
  const text = span.textContent;
  if (off <= 0) return span;
  if (off >= text.length) return null;
  const r = w.runs[+span.dataset.ri], r2 = r.cloneNode(true);
  for (const c of [...r2.children]) if (c.localName !== 'rPr') r2.removeChild(c);
  wSetText(w, r, text.slice(0, off)); wSetText(w, r2, text.slice(off));
  r.parentNode.insertBefore(r2, r.nextSibling);
  const s2 = span.cloneNode(false); s2.dataset.ri = w.runs.push(r2) - 1; s2.textContent = text.slice(off);
  span.textContent = text.slice(0, off); span.after(s2);
  return s2;
}
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
function wPickWords(w, page, e) {
  const sel = window.getSelection();
  if (sel && sel.rangeCount && !sel.isCollapsed) {
    const rg = sel.getRangeAt(0);
    if (page.contains(rg.commonAncestorContainer)) {
      const spans = [...page.querySelectorAll('[data-ri]')].filter(s => rg.intersectsNode(s) && s.textContent);
      if (spans.length) {
        const offIn = (s, node, off) => { if (!s.contains(node)) return null; const r = document.createRange(); r.setStart(s, 0); r.setEnd(node, off); return r.toString().length; };
        const first = spans[0], last = spans[spans.length - 1];
        const a = offIn(first, rg.startContainer, rg.startOffset) ?? 0, b = offIn(last, rg.endContainer, rg.endOffset) ?? last.textContent.length;
        if (first !== last || b > a) return { first, a, last, b };
      }
    }
  }
  if (!e) return null;
  const cr = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
  const node = cr && cr.startContainer, span = node && (node.nodeType === 3 ? node.parentElement : node).closest('[data-ri]');
  if (span && page.contains(span)) {
    const t = span.textContent, isW = ch => /[\p{L}\p{N}'’\-]/u.test(ch || '');
    let i = cr.startContainer.nodeType === 3 ? Math.min(cr.startOffset, t.length) : 0;
    if (!isW(t[i]) && isW(t[i - 1])) i--;
    if (isW(t[i])) { let a = i, b = i; while (a > 0 && isW(t[a - 1])) a--; while (b < t.length && isW(t[b])) b++; return { first: span, a, last: span, b }; }
  }
  const p = e.target.closest && e.target.closest('p.wp');
  return p && page.contains(p) ? { para: p } : null;
}
// src/wordnotes.js
function wCommentAdd(w, at, text) {
  if (!wCommentsMade(w)) return null;
  const id = wNextId(w);
  if (at.para) {
    const p = w.paras[+at.para.dataset.pi];
    p.appendChild(wMarker(w, 'commentRangeStart', id)); p.appendChild(wMarker(w, 'commentRangeEnd', id)); p.appendChild(wRefRun(w, id));
  } else {
    const s = w.runs[+at.first.dataset.ri], e = w.runs[+at.last.dataset.ri];
    s.parentNode.insertBefore(wMarker(w, 'commentRangeStart', id), s);
    const end = wMarker(w, 'commentRangeEnd', id);
    e.parentNode.insertBefore(end, e.nextSibling);
    e.parentNode.insertBefore(wRefRun(w, id), end.nextSibling);
  }
  const author = store.get('gs.cmAuthor', '') || 'Teacher';
  const c = w.cdoc.createElementNS(W_NS, 'w:comment');
  c.setAttributeNS(W_NS, 'w:id', id); c.setAttributeNS(W_NS, 'w:author', author);
  c.setAttributeNS(W_NS, 'w:date', new Date().toISOString().replace(/\.\d+Z$/, 'Z'));
  c.setAttributeNS(W_NS, 'w:initials', author.split(/\s+/).map(x => x[0] || '').join('').slice(0, 3).toUpperCase());
  wCommentSet(w, c, text);
  w.cdoc.documentElement.appendChild(c);
  wCommentsKeep(w);
  return id;
}
// src/wordnotes.js
function wCommentDrop(w, id) {
  for (const c of wCommentEls(w)) if (wId(c) === id) c.parentNode.removeChild(c);
  for (const k of ['commentRangeStart', 'commentRangeEnd']) for (const e of [...w.doc.getElementsByTagNameNS(W_NS, k)]) if (wId(e) === id) e.parentNode.removeChild(e);
  for (const e of [...w.doc.getElementsByTagNameNS(W_NS, 'commentReference')]) {
    if (wId(e) !== id) continue;
    const r = e.parentNode;
    if (r.localName === 'r' && [...r.children].every(c => c === e || c.localName === 'rPr')) r.parentNode.removeChild(r); else r.removeChild(e);
  }
  wCommentsKeep(w);
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
function wordCanPdf(f) { return !!f && f.kind === 'docx' && !f.virtual && !f.rubric && !f.from && !!f.data; }
// src/ib.js
const ibTaskLevels = st => setup.ib.map((k, i) => [k, noScore(st) ? null : st.grade.rubric[i]]).filter(x => x[0]);
// src/ib.js
function ibStampText(st) { return ibTaskLevels(st).filter(x => x[1] != null).map(([k, v]) => k + ' ' + fmtNum(v)).join('   '); }
export { openWord, wordBytes, renderWord, wApplyPara, wToggle, wShadeCell, CELL_COLORS, wordScore, wordCanPdf, wCommentAdd, wCommentDrop, wCommentSet, wCommentEls, wCommentText, wCommentMap, wPickWords, wId, wComments, wCommentsKeep, wSplitSpan, wNotesPaint, rubricModel, rubricScore, isShaded, RUB_HL, fillTotalBlank, wordLineHers, rubricToGrade, wordScoreGone, scaleDiffers, wordTabOn, tryOfFile, liftStatus, ownGrade, hasOwnScore, wordFound, wordTableRead, readKey, rubricKey };
