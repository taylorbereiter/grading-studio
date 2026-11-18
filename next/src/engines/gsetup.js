// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, setup, lib, tr, pdfjsLib, fflate, workerReady, ROW_TOP, topOk, rowLevels, fmtNum, noScore } from './gcore.js';
import { batchClass, one } from './gdraw.js';

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
// src/app/wordrubric.js
const cellNum = td => { const m = /(\d+(?:\.\d+)?)/.exec(td.textContent || ''); return m ? +m[1] : null; };
// src/app/wordrubric.js
const LEVEL_WORD = /(?<![\p{L}])(?:score|level|band|marks?|points?|pts)(?![\p{L}])/iu;
// src/app/wordrubric.js
function levelsSure(tds) {
  const txt = tds.map(td => (td.textContent || '').replace(/\s+/g, ' ').trim()), v = tds.map(cellNum);
  if (tds.length < 2 || txt.some(t => t.length > 30 || (t.match(/\d+(?:\.\d+)?/g) || []).length !== 1)) return false;
  return txt.every(t => LEVEL_WORD.test(t)) || (v.every((x, i) => !i || x <= v[i - 1]) && v[0] > v[v.length - 1]);
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
// src/rubrics.js
const levelIn = (d, i, v) => { const r = d.levels && d.levels[i]; return (r && r[v]) || ''; };
// src/rubrics.js
function tidyLevels(d) {
  const out = d.criteria.map((_, i) => { const r = {}; for (const v of rowLevels(d, i)) { const t = levelIn(d, i, v).trim(); if (t) r[v] = t; } return r; });
  return out.some(r => Object.keys(r).length) ? out : undefined;
}
// src/rubricup.js
const RU_NUM = /^(?:(?:level|score|band|points?|pts|marks?)\s*)?(\d{1,2})(?:\s*(?:pts?|points?|marks?))?$/i;
// src/rubricup.js
const ruTidy = t => String(t || '').replace(/\s+/g, ' ').trim();
// src/rubricup.js
const ruCell = (t, v) => ruTidy(t).replace(new RegExp('^(?:(?:level|score|band)\\s*)?' + v + '(?:\\s*(?:pts?|points?|marks?))?\\s*[:.)–-]?\\s*', 'i'), '').slice(0, 600);
// src/rubricup.js
function ruFromWord(bytes) {
  const w = openWord(bytes), page = document.createElement('div'); page.className = 'dpage'; w.pRuns = []; renderWord(w, page);
  const m = rubricModel(page); if (!m || m.crits.length < 1 || m.levels.length < 2) return null;
  const rows = m.crits.slice(0, 10).map((name, i) => {
    const levels = {};
    for (const c of m.cells) if (c.crit === i) { const t = ruCell(c.td.textContent, c.val); if (t) levels[c.val] = t; }
    return { name: ruTidy(name).slice(0, 80) || 'Criterion ' + (i + 1), levels };
  });
  return { rows, top: Math.max(...m.levels) };
}
// src/rubricup.js
async function ruFromPdf(bytes) {
  await workerReady;
  const d = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  let tc; try { tc = await (await d.getPage(1)).getTextContent(); } finally { d.destroy(); }
  const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5], w: i.width || 0, h: Math.abs(i.transform[3]) || 10 }));
  if (items.length < 6) return null;
  const lines = [];
  for (const it of items.sort((a, b) => b.y - a.y)) { const l = lines.find(L => Math.abs(L.y - it.y) <= 3); if (l) l.items.push(it); else lines.push({ y: it.y, items: [it] }); }
  // the heading: two or more level numbers on one line, counting down or up, none above 10
  let head = null;
  for (const l of lines) {
    const nums = l.items.map(it => { const m = RU_NUM.exec(it.s); return m ? { v: +m[1], c: it.x + it.w / 2 } : null; }).filter(Boolean).sort((a, b) => a.c - b.c);
    if (nums.length < 2 || nums.some(n => n.v > 10) || new Set(nums.map(n => n.v)).size !== nums.length) continue;
    const down = nums.every((n, k) => !k || n.v < nums[k - 1].v), up = nums.every((n, k) => !k || n.v > nums[k - 1].v);
    if (down || up) { head = { y: l.y, cols: nums }; break; }
  }
  if (!head) return null;
  const cols = head.cols, gap = (cols[cols.length - 1].c - cols[0].c) / Math.max(1, cols.length - 1), edge = cols[0].c - gap / 2;
  const below = items.filter(it => it.y < head.y - 2), lh = below.length ? below.map(i => i.h).sort((a, b) => a - b)[below.length >> 1] : 10;
  const left = below.filter(it => it.x + Math.min(it.w, gap) / 2 < edge).sort((a, b) => b.y - a.y);
  if (!left.length) return null;
  // a row starts where words come back on the left after a gap
  const tops = [];
  let last = null;
  for (const it of left) { if (last == null || last - it.y > lh * 2.1) tops.push({ y: it.y, words: [] }); tops[tops.length - 1].words.push(it.s); last = it.y; }
  if (tops.length > 10) return null;
  const rows = tops.map((t, k) => {
    const hi = t.y + lh * 0.8, lo = k + 1 < tops.length ? tops[k + 1].y + lh * 0.8 : -1e9, levels = {};
    for (const c of cols) {
      const words = below.filter(it => it.y <= hi && it.y > lo && it.x + it.w / 2 >= edge && Math.abs(it.x + it.w / 2 - c.c) === Math.min(...cols.map(q => Math.abs(it.x + it.w / 2 - q.c)))).sort((a, b) => b.y - a.y || a.x - b.x).map(it => it.s);
      const txt = ruTidy(words.join(' ')).slice(0, 600); if (txt) levels[c.v] = txt;
    }
    return { name: ruTidy(t.words.join(' ')).slice(0, 80), levels };
  }).filter(r => r.name && Object.keys(r.levels).length);
  if (!rows.length) return null;
  return { rows, top: Math.max(...cols.map(c => c.v)) };
}
// src/rubricup.js
function rubricRowsInto(d, r) {
  d.mode = 'rubric'; d.criteria = r.rows.map(x => x.name);
  const lv = r.rows.map(x => x.levels || {}); if (lv.some(o => Object.keys(o).length)) d.levels = lv; else delete d.levels;
  for (const k of ['tops', 'top', 'ib']) delete d[k];
  if (r.top && r.top !== ROW_TOP && topOk(r.top)) d.top = r.top;
  return d;
}
// src/goals.js
function goalList() { return Array.isArray(lib.goals) ? lib.goals.filter(g => g && g.id && String(g.name || '').trim()) : []; }
// src/goals.js
function goalById(id) { return id ? goalList().find(g => g.id === id) || null : null; }
// src/goals.js
const goalName = id => { const g = goalById(id); return g ? g.name : ''; };
// src/goals.js
function goalsTidy(d) {
  const a = (d.criteria || []).map((_, i) => (d.goals && d.goals[i]) || null);
  return a.some(Boolean) ? a : undefined;
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
const ibLetter = i => String.fromCharCode(65 + i);
// src/ib.js
function classWay(c) { return c && (c.way === 'myp' || c.way === 'dp') ? c.way : ''; }
// src/ib.js
const ibGroup = k => IB_GROUPS.find(g => g[0] === k) || null;
// src/ib.js
const ibGroupCrit = k => (ibGroup(k) || IB_GROUPS[IB_GROUPS.length - 1])[2].map((name, i) => ({ k: ibLetter(i), name }));
// src/ib.js
function ibCrit(c) {
  const ib = c && c.ib || {}, own = Array.isArray(ib.crit) ? ib.crit.filter(x => x && String(x.k || '').trim()).map(x => ({ k: String(x.k).trim().slice(0, 2), name: String(x.name || '').trim().slice(0, 80) })) : [];
  return own.length ? own : ibGroupCrit(ib.group);
}
// src/ib.js
const ibTaskClass = () => { const c = batch && batchClass(); return c && classWay(c) === 'myp' ? c : null; };
// src/ib.js
const ibTaskLevels = st => setup.ib.map((k, i) => [k, noScore(st) ? null : st.grade.rubric[i]]).filter(x => x[0]);
// src/ib.js
function ibListSay(st) { return ibTaskLevels(st).map(x => x[1] == null ? '–' : fmtNum(x[1])).join(' '); }
// src/ib.js
function ibStampText(st) { return ibTaskLevels(st).filter(x => x[1] != null).map(([k, v]) => k + ' ' + fmtNum(v)).join('   '); }
export { tidyLevels, levelIn, goalList, goalById, goalName, goalsTidy, ruFromWord, ruFromPdf, rubricRowsInto, classWay, ibCrit, IB_TOP, ibTaskClass, ibTaskLevels, ibListSay, ibStampText };
