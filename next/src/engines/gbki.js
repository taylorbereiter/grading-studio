// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
// the teacher's types as the class page's gradebook reads them (gbook's own library), not a copy reading the marking screen's
import { bkCats } from './gbook.js';
import { fflate } from './gcore.js';
import { EMAIL_RX, bkIsType } from './gbook.js';

// src/bookimport.js
function bkiParse(text) {
  text = String(text || '').replace(/^﻿/, '');
  const first = (text.split(/\r?\n/).find(l => l.trim()) || '');
  const count = ch => first.split(ch).length - 1;
  const sep = count('\t') ? '\t' : count(';') > count(',') ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"' && !cell.trim()) { q = true; cell = ''; }
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => c.trim())).filter(r => r.some(Boolean));
}
// src/bookimport.js
function bkiXlsx(bytes) {
  const z = fflate.unzipSync(bytes), td = new TextDecoder(), dp = new DOMParser();
  const xml = n => z[n] ? dp.parseFromString(td.decode(z[n]), 'application/xml') : null;
  const strings = [...((xml('xl/sharedStrings.xml') || { getElementsByTagName: () => [] }).getElementsByTagName('si'))].map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join(''));
  let path = 'xl/worksheets/sheet1.xml';
  const wb = xml('xl/workbook.xml'), rel = xml('xl/_rels/workbook.xml.rels');
  if (wb && rel) {   // the first sheet in the workbook's own order, which isn't always sheet1.xml
    const s = wb.getElementsByTagName('sheet')[0], id = s && (s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
    const r = id && [...rel.getElementsByTagName('Relationship')].find(x => x.getAttribute('Id') === id);
    if (r) { const t = r.getAttribute('Target').replace(/^\/?(xl\/)?/, ''); if (z['xl/' + t]) path = 'xl/' + t; }
  }
  const sh = xml(path); if (!sh) throw new Error('no sheet');
  const col = ref => { let n = 0; for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const rows = [];
  for (const r of sh.getElementsByTagName('row')) {
    const out = [];
    for (const c of r.getElementsByTagName('c')) {
      const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0], is = c.getElementsByTagName('is')[0];
      let val = t === 's' ? strings[+(v && v.textContent)] || '' : t === 'inlineStr' ? (is ? is.textContent : '') : v ? v.textContent : '';
      if (t !== 's' && t !== 'inlineStr' && t !== 'str' && val !== '' && !isNaN(+val)) val = String(Math.round(+val * 1e6) / 1e6);
      const i = c.getAttribute('r') ? col(c.getAttribute('r')) : out.length;
      out[i] = val;
    }
    rows.push([...out].map(x => (x || '').trim()));
  }
  return rows.filter(r => r.some(Boolean));
}
// src/bookimport.js
const BKI_MISS = /^(m|mi|mis|msg|missing|nhi|not handed in|not submitted|0\s*\(missing\))$/i, BKI_EXC = /^(e|ex|exc|excused|exempt|exempted)$/i;
// src/bookimport.js
function bkiCell(s) {
  s = String(s || '').trim();
  if (!s || s === '-' || s === '–') return null;
  if (BKI_MISS.test(s)) return { st: 'missing' };
  if (BKI_EXC.test(s)) return { st: 'excused' };
  const late = /\blate\b/i.test(s), t = s.replace(/\(?\blate\b\)?/i, '').trim().replace(/(\d),(\d)/, '$1.$2');
  let m = t.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (m) return { v: +m[1], of: +m[2], st: late ? 'late' : '' };
  m = t.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
  if (m) return { pct: +m[1], st: late ? 'late' : '' };
  if (/^-?\d+(\.\d+)?$/.test(t)) return { v: +t, st: late ? 'late' : '' };
  return { bad: true };
}
// src/bookimport.js
function bkiDate(s) {
  s = String(s || '');
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  const now = new Date(), yr = (mo, d) => { const y = now.getFullYear(), t = new Date(y, mo - 1, d); return t - now > 60 * 864e5 ? y - 1 : y; };
  const iso = (y, mo, d) => mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0') : '';
  m = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (m && (m[3] || !/\d\s*\/\s*\d+\s*$/.test(s.trim()) || /\b(due|date)\b/i.test(s))) {   // "Quiz 17/20" is a score, not a date
    let a = +m[1], b = +m[2], y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : 0;
    const dayFirst = /^(en-(gb|au|nz|ie|in|za)|es|fr|de|it|pt|nl)/i.test(navigator.language || '') || a > 12;
    const [mo, d] = dayFirst ? [b, a] : [a, b];
    return iso(y || yr(mo, d), mo, d);
  }
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  m = s.match(/\b(\d{1,2})\s+([a-z]{3})[a-z]*\.?(?:\s+(\d{4}))?\b/i) || null;
  if (m && MON.includes(m[2].toLowerCase())) { const mo = MON.indexOf(m[2].toLowerCase()) + 1, d = +m[1]; return iso(m[3] ? +m[3] : yr(mo, d), mo, d); }
  m = s.match(/\b([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i);
  if (m && MON.includes(m[1].toLowerCase())) { const mo = MON.indexOf(m[1].toLowerCase()) + 1, d = +m[2]; return iso(m[3] ? +m[3] : yr(mo, d), mo, d); }
  return '';
}
// src/bookimport.js
const BKI_SKIP = /(^|\b)(id|student\s*(id|no|number|#)|e-?mail|homeroom|advis[eo]r|section|period|gender|grade level|year level|dob|birth)(\b|$)|^#$|^no\.?$/i;
// src/bookimport.js
const BKI_SUM = /(total|average|avg|overall|final grade|term grade|semester|quarter|grade to date|current grade|^grade$|^%$|percent)/i;
// src/bookimport.js
const BKI_FIRST = /^(first|given|preferred)(\s*name)?$/i, BKI_LAST = /^(last|sur|family)(\s*name)?$|^surname$/i, BKI_NAME = /(name|student|pupil|learner)/i;
// src/bookimport.js
const BKI_MAXROW = /^(points?(\s*possible)?|possible|max(imum)?(\s*(points|score))?|out\s*of|total\s*points|pts\s*possible|worth)$/i, BKI_DUEROW = /^(due(\s*date)?|date(\s*due)?|assigned)$/i;
// src/bookimport.js
const BKI_AVGROW = /^(class\s*)?(average|avg|mean|median|high|low|count)$/i, BKI_CATROW = /^(category|categories|type|assessment type|task type|grading category)$/i;
// src/bookimport.js
const BKI_IDH = /^(student\s*(id|no\.?|number|#)|id(\s*(no\.?|number))?)$/i, BKI_MAILH = /e-?mail/i;
// src/bookimport.js
function bkiWide(rows) {
  const h = rows[0] || [], f = rx => h.findIndex(x => rx.test(String(x).trim()));
  const ai = f(/^(assignment|task|assessment|activity|item|title)(\s*(name|title))?$/i), si = f(/^(score|points?(\s*earned)?|marks?|result)$/i);
  if (ai < 0 || si < 0 || rows.length < 2) return rows;
  const ci = f(BKI_CATROW), oi = f(/^(out of|max(imum)?(\s*(points|score))?|points possible|possible|total points|worth)$/i), di = f(/^(due(\s*date)?|date)$/i);
  const rest = h.map((_, i) => i).filter(i => ![ai, si, ci, oi, di].includes(i)), who0 = rest.filter(i => [BKI_NAME, BKI_FIRST, BKI_LAST, BKI_IDH, BKI_MAILH].some(rx => rx.test(String(h[i]).trim())));
  const keep = who0.length ? who0 : rest; if (!keep.length) return rows;   // a student is their name, ID and email; a comment or "submitted" column isn't
  const tasks = [], who = new Map();
  for (const r of rows.slice(1)) {
    const t = r[ai]; if (!t) continue;
    let k = tasks.findIndex(x => x[0] === t); if (k < 0) k = tasks.push([t, r[ci] || '', r[oi] || '', r[di] || '']) - 1;
    const key = keep.map(i => r[i]).join('\u0001'); if (!who.has(key)) who.set(key, keep.map(i => r[i]));
    who.get(key)[keep.length + k] = r[si];
  }
  const pad = Array(keep.length - 1).fill(''), meta = [['Category', 1], ['Points possible', 2], ['Due', 3]].filter(([, j]) => tasks.some(x => x[j])).map(([l, j]) => [l, ...pad, ...tasks.map(x => x[j])]);
  return [keep.map(i => h[i]).concat(tasks.map(x => x[0])), ...meta, ...[...who.values()].map(r => [...r].map(x => x || ''))];
}
// src/bookimport.js
function bkiRead(rows) {
  if (!rows.length) return null;
  rows = bkiWide(rows);
  const w = Math.max(...rows.map(r => r.length));
  rows = rows.map(r => { const x = r.slice(); while (x.length < w) x.push(''); return x; });
  const isNum = s => { const c = bkiCell(s); return !!c && !c.bad; };
  // A header row is one where most cells aren't scores. Without one, the columns get plain names.
  const hasHead = rows[0].filter(s => s && !isNum(s)).length >= Math.max(1, rows[0].filter(Boolean).length / 2);
  const head = hasHead ? rows[0] : rows[0].map((_, i) => 'Column ' + (i + 1));
  let body = hasHead ? rows.slice(1) : rows;
  // Names: first + last columns joined, else the column headed "name"/"student", else the column with the most words.
  const textish = i => body.filter(r => r[i] && !isNum(r[i])).length;
  let fi = head.findIndex(h => BKI_FIRST.test(h)), li = head.findIndex(h => BKI_LAST.test(h)), ni = -1;
  if (fi < 0 || li < 0) { fi = li = -1; ni = head.findIndex((h, i) => BKI_NAME.test(h) && !BKI_SKIP.test(h) && textish(i) >= body.length / 2); }
  if (fi < 0 && ni < 0) { let best = 0; head.forEach((h, i) => { const n = textish(i); if (n > best && !BKI_SKIP.test(h)) { best = n; ni = i; } }); }
  if (fi < 0 && ni < 0) return { err: 'none' };
  const nameOf = r => { let n = fi >= 0 ? (r[fi] + ' ' + r[li]).trim() : r[ni]; const m = n.match(/^([^,]+),\s*([^,]+)$/); return m ? m[2] + ' ' + m[1] : n; };   // "Testwell, Aria" is Aria Testwell
  const nameCols = new Set([fi, li, ni].filter(i => i >= 0));
  // Rows that describe the columns rather than a student.
  const row = rx => body.find(r => rx.test(nameOf(r)) || rx.test(r[0])), maxRow = row(BKI_MAXROW), dueRow = row(BKI_DUEROW), catRow = row(BKI_CATROW);
  body = body.filter(r => r !== maxRow && r !== dueRow && r !== catRow && !BKI_AVGROW.test(nameOf(r)) && nameOf(r));
  const idc = head.findIndex(x => BKI_IDH.test(x.trim())), mc = head.findIndex(x => BKI_MAILH.test(x));
  const cols = [];
  head.forEach((h0, i) => {
    if (nameCols.has(i) || BKI_SKIP.test(h0)) return;
    const tag = h0.match(/\s*\[([^\]]+)\]\s*$/), h = tag ? h0.slice(0, tag.index).trim() || h0 : h0;   // "Essay [Summative]": the category in the heading
    const cells = body.map(r => bkiCell(r[i])), filled = cells.filter(Boolean), good = filled.filter(c => !c.bad);
    if (!good.length || good.length < filled.length / 2) return;
    // Out of: the "points possible" row, else "17/20" cells, else the header ("Quiz (20)", "/20", "out of 20", "20 pts"), else guessed.
    let max = null, how = '';
    const mr = maxRow && bkiCell(maxRow[i]);
    if (mr && mr.v > 0) { max = mr.v; how = 'row'; }
    if (!max) { const ofs = good.filter(c => c.of).map(c => c.of); if (ofs.length) { max = ofs.sort((a, b) => ofs.filter(x => x === b).length - ofs.filter(x => x === a).length)[0]; how = 'cells'; } }
    if (!max) { const m = h.match(/(?:\/\s*|out of\s*|\(\s*)(\d+(?:\.\d+)?)\s*(?:pts?|points?|marks?)?\s*\)?\s*$/i) || h.match(/\b(\d+(?:\.\d+)?)\s*(?:pts|points|marks)\b/i); if (m && +m[1] > 0) { max = +m[1]; how = 'head'; } }
    const pcts = good.filter(c => c.pct != null).length, top = Math.max(0, ...good.filter(c => c.v != null).map(c => c.v));
    let pct = false;
    if (!max) { if (pcts >= good.filter(c => c.v != null).length || top > 20) { pct = true; how = pcts ? 'cells' : 'guess'; } else if (top > 0) { max = Math.ceil(top); how = 'guess'; } else { pct = true; how = 'guess'; } }
    const name = h.replace(/\s*(?:\(\s*\d+(?:\.\d+)?\s*(?:pts?|points?|marks?)?\s*\)|\/\s*\d+(?:\.\d+)?|out of\s*\d+(?:\.\d+)?)\s*$/i, '').trim() || h;
    const due = bkiDate(dueRow ? dueRow[i] : '') || bkiDate(h);
    cols.push({ i, head: h, name, max, pct, how, due, on: !BKI_SUM.test(h), type: bkiGuess(h),
      bad: filled.length - good.length, cat: ((catRow && catRow[i]) || (tag && tag[1]) || '').trim() });
  });
  return { students: body.map(r => ({ name: nameOf(r), cells: r, id: idc >= 0 ? r[idc] : '', email: mc >= 0 && EMAIL_RX.test(r[mc]) ? r[mc] : '' })), cols, ids: idc >= 0, mails: mc >= 0 };
}
// src/bookimport.js
function bkiGuess(h) {
  const cats = bkCats(), low = h.toLowerCase(), named = cats.find(([t, l, s]) => t !== 'fm' && [l, s].some(x => x && x.length > 2 && low.includes(x.toLowerCase())));
  if (named) return named[0];
  if (/\b(test|exam|essay|summative|project|final|unit\s*assessment|lab report)\b/i.test(h) && bkIsType('sum')) return 'sum';
  if (bkIsType('ic')) return 'ic';
  const sc = cats.find(([t]) => t !== 'fm'); return (sc || cats[0] || ['ic'])[0];
}
// src/bookimport.js
const bkiWords = s => String(s || '').toLowerCase().replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
// src/bookimport.js
const BKI_COMMON = /^(test|quiz|exam|essay|project|lab|report|homework|hw|assignment|task|unit|chapter|ch|assessment|summative|formative|worksheet|practice|review|final|midterm|presentation|the|a|an|of|on|and|in|to|for|part|week|term|semester|draft)$/;
// src/bookimport.js
function bkiFit(a, b) {
  const A = bkiWords(a), B = bkiWords(b); if (!A.length || !B.length) return 0;
  const nums = W => W.filter(w => /^\d+$/.test(w)).sort().join(); if (nums(A) !== nums(B)) return 0;
  const raw = x => (String(x).match(/\d+/g) || []).sort().join(), ra = raw(a), rb = raw(b); if (ra && rb && ra !== rb) return 0;   // "Test (Unit 2)" is not "Test (Unit 1)"
  if (A.join(' ') === B.join(' ')) return String(a).trim().toLowerCase() === String(b).trim().toLowerCase() ? 1 : 0.95;
  const like = (x, y) => x === y || (x.length > 3 && y.length > 3 && (oneEdit(x, y) || x.startsWith(y) || y.startsWith(x)));
  const used = new Set(); let hit = 0, own = 0;
  for (const x of A) { const j = B.findIndex((y, k) => !used.has(k) && like(x, y)); if (j >= 0) { used.add(j); hit++; if (!BKI_COMMON.test(x) && !/^\d+$/.test(x)) own++; } }
  return own ? Math.min(0.94, 2 * hit / (A.length + B.length)) : 0;   // "Map test" and "Poetry test" share only "test": not alike
}
// src/bookimport.js
function bkiMatch(cols, ex) {
  const pairs = [];
  for (const col of cols) for (const x of ex) {
    let f = bkiFit(col.name, x.name); if (!f) continue;
    if (f < 1 && col.due && x.due && Math.abs(Date.parse(col.due) - Date.parse(x.due)) < 4 * 864e5) f = Math.min(0.99, f + 0.1);
    pairs.push([f, col, x.it.id]);
  }
  pairs.sort((a, b) => b[0] - a[0]);
  for (const col of cols) { col.to = ''; col.sure = 0; col.opts = pairs.filter(p => p[1] === col && p[0] >= 0.5).map(p => p[2]); }
  const took = new Set();
  for (const [f, col, id] of pairs) {
    if (f < 0.5 || col.sure || took.has(id)) continue;
    took.add(id); col.sure = f >= 1 ? 2 : 1; col.to = f >= 0.75 ? id : null;
  }
}
// src/bookimport.js
function bkiCatGuess(cat) {
  const low = cat.toLowerCase(), cats = bkCats();
  const t = cats.find(([, l, s]) => [l, s].some(x => x && x.toLowerCase() === low)) || cats.find(([t, , s]) => t !== 'fm' && low.length > 3 && s && s.length > 3 && (low.includes(s.toLowerCase()) || s.toLowerCase().includes(low)));
  return t ? t[0] : '+:' + cat;
}
// src/insight.js
function oneEdit(a, b) {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, n = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++n > 1) return false;
    if (a.length === b.length && a[i] === b[j + 1] && a[i + 1] === b[j]) { i += 2; j += 2; continue; }   // two letters swapped
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return true;
}
// src/merge.js
const normName = s => String(s || '').replace(/\s+/g, '').toLowerCase();
// src/classroom.js
function gcNameOf(file) {
  return String(file || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').replace(/\s*\(\d+\)\s*$/, '')
    .replace(/\s*[-–]?\s*\d{4}-\d{1,2}-\d{1,2}.*$/, '').replace(/\s*[-–]?\s*\b(all\s+)?grades?\b\s*$/i, '').replace(/\s+/g, ' ').trim();
}
// src/classroom.js
function gcRead(rows) {
  const d = bkiRead(rows || []);
  if (!d || d.err || !d.students.length) return null;
  const head = rows[0] || [], ei = head.findIndex(h => /e-?mail/i.test(h)), seen = new Set(), students = [];
  for (const s of d.students) {
    const k = normName(s.name); if (!k || seen.has(k)) continue;
    seen.add(k);
    const email = ei >= 0 && EMAIL_RX.test(s.cells[ei] || '') ? s.cells[ei] : '';
    students.push({ name: s.name, email });
  }
  return { rows, students, cols: d.cols.length };
}
export { bkiParse, bkiXlsx, bkiCell, bkiDate, bkiWide, bkiRead, bkiGuess, bkiFit, bkiMatch, bkiCatGuess, BKI_SUM, normName, gcRead, gcNameOf };
