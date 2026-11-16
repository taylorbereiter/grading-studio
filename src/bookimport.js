/* ---------------- gradebook import: past scores from a spreadsheet (CSV, TSV, Excel, or cells pasted) ----------------
   For a teacher who starts mid-year: their old gradebook comes in as typed-in cards, one per assignment column, so nothing
   starts from zero. It is read in this browser and nothing leaves it. Nothing is saved until the teacher has seen the preview
   and pressed Import. Rows are matched to the class roster by name (rosterPairs, as everywhere else); a row it can't match is
   shown so the teacher can pick the student or leave it out. A column with the same name as an assignment already in the class
   may be the same as one already in the class, spelled a little differently: a close name is suggested, and the teacher says
   Same, New or Skip for each column before anything happens. A score already there is only replaced when the teacher says so,
   score by score or all at once ("Keep what's there" is the default). Students are never added unless the teacher picks that
   for a row, or the class has no students yet, when the file's rows become its roster. The file's categories are matched once
   to the teacher's own types (or make a new type). Student IDs and emails fill in only where the class has none. One Undo.
   Each imported column is stored exactly as "+ Add scores" stores one: item.typed = { max, s: { roster name: { v, st } } }. */

// One table from CSV or TSV text. Quotes may hold commas, tabs and line breaks; "" is a quote inside quotes.
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

// The first sheet of an Excel file (.xlsx), as a table. Only the values: a formula's last result, a date as a day.
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

// What one cell says: a number (points or a percent), points out of something ("17/20"), missing, excused, or nothing it can read.
const BKI_MISS = /^(m|mi|mis|msg|missing|nhi|not handed in|not submitted|0\s*\(missing\))$/i, BKI_EXC = /^(e|ex|exc|excused|exempt|exempted)$/i;
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
// A date in a header or a "Due" row: 2026-10-02, 10/2/2026, 2 Oct, Oct 2. Days with no year take this school year's.
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

// Which columns hold names, which hold scores, and which rows say what a column is out of or when it was due.
const BKI_SKIP = /(^|\b)(id|student\s*(id|no|number|#)|e-?mail|homeroom|advis[eo]r|section|period|gender|grade level|year level|dob|birth)(\b|$)|^#$|^no\.?$/i;
const BKI_SUM = /(total|average|avg|overall|final grade|term grade|semester|quarter|grade to date|current grade|^grade$|^%$|percent)/i;
const BKI_FIRST = /^(first|given|preferred)(\s*name)?$/i, BKI_LAST = /^(last|sur|family)(\s*name)?$|^surname$/i, BKI_NAME = /(name|student|pupil|learner)/i;
const BKI_MAXROW = /^(points?(\s*possible)?|possible|max(imum)?(\s*(points|score))?|out\s*of|total\s*points|pts\s*possible|worth)$/i, BKI_DUEROW = /^(due(\s*date)?|date(\s*due)?|assigned)$/i;
const BKI_AVGROW = /^(class\s*)?(average|avg|mean|median|high|low|count)$/i, BKI_CATROW = /^(category|categories|type|assessment type|task type|grading category)$/i;
const BKI_IDH = /^(student\s*(id|no\.?|number|#)|id(\s*(no\.?|number))?)$/i, BKI_MAILH = /e-?mail/i;
// One row per student per assignment (a "long" export: Student, Assignment, Score, maybe Category, Out of, Due) is turned the usual way round.
function bkiWide(rows) {
  const h = rows[0] || [], f = rx => h.findIndex(x => rx.test(String(x).trim()));
  const ai = f(/^(assignment|task|assessment|activity|item|title)(\s*(name|title))?$/i), si = f(/^(score|points?(\s*earned)?|marks?|result)$/i);
  if (ai < 0 || si < 0 || rows.length < 2) return rows;
  const ci = f(BKI_CATROW), oi = f(/^(out of|max(imum)?(\s*(points|score))?|points possible|possible|total points|worth)$/i), di = f(/^(due(\s*date)?|date)$/i);
  const keep = h.map((_, i) => i).filter(i => ![ai, si, ci, oi, di].includes(i)); if (!keep.length) return rows;
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

// A type for a column from its heading, among the teacher's own types: one whose name is in the heading, else a test-like heading is a
// summative and anything else in-class, when those types are on the list, else the first type that takes a score.
function bkiGuess(h) {
  const cats = bkCats(), low = h.toLowerCase(), named = cats.find(([t, l, s]) => t !== 'fm' && [l, s].some(x => x && x.length > 2 && low.includes(x.toLowerCase())));
  if (named) return named[0];
  if (/\b(test|exam|essay|summative|project|final|unit\s*assessment|lab report)\b/i.test(h) && bkIsType('sum')) return 'sum';
  if (bkIsType('ic')) return 'ic';
  const sc = cats.find(([t]) => t !== 'fm'); return (sc || cats[0] || ['ic'])[0];
}
/* ---------- matching a file's column to an assignment already in the class ---------- */
// The words of a name, without a bracketed note, a "(40)" or punctuation.
const bkiWords = s => String(s || '').toLowerCase().replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
// Words many assignments share, which alone don't make two names alike.
const BKI_COMMON = /^(test|quiz|exam|essay|project|lab|report|homework|hw|assignment|task|unit|chapter|ch|assessment|summative|formative|worksheet|practice|review|final|midterm|presentation|the|a|an|of|on|and|in|to|for|part|week|term|semester|draft)$/;
// How alike two names are, 0 to 1. The numbers in them must be the same ("Quiz 1" is never "Quiz 2"); a word one letter off, or cut short, still counts.
function bkiFit(a, b) {
  const A = bkiWords(a), B = bkiWords(b); if (!A.length || !B.length) return 0;
  const nums = W => W.filter(w => /^\d+$/.test(w)).sort().join(); if (nums(A) !== nums(B)) return 0;
  if (A.join(' ') === B.join(' ')) return String(a).trim().toLowerCase() === String(b).trim().toLowerCase() ? 1 : 0.95;
  const like = (x, y) => x === y || (x.length > 3 && y.length > 3 && (oneEdit(x, y) || x.startsWith(y) || y.startsWith(x)));
  const used = new Set(); let hit = 0, own = 0;
  for (const x of A) { const j = B.findIndex((y, k) => !used.has(k) && like(x, y)); if (j >= 0) { used.add(j); hit++; if (!BKI_COMMON.test(x) && !/^\d+$/.test(x)) own++; } }
  return own ? Math.min(0.94, 2 * hit / (A.length + B.length)) : 0;   // "Map test" and "Poetry test" share only "test": not alike
}
// Each column gets the assignment it most likely is, one column per assignment: the same name is taken as it is, a close one is
// taken but flagged to check, a looser one is only suggested and waits for the teacher (col.to null). A due date within a few days helps.
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
// The teacher's type for a category in the file: one of the same name (or one inside the other), else a new type of that name ('+:name').
function bkiCatGuess(cat) {
  const low = cat.toLowerCase(), cats = bkCats();
  const t = cats.find(([, l, s]) => [l, s].some(x => x && x.toLowerCase() === low)) || cats.find(([, , s]) => s && s.length > 3 && (low.includes(s.toLowerCase()) || s.toLowerCase().includes(low)));
  return t ? t[0] : '+:' + cat;
}
/* ---------- the screen ---------- */
let bki = null;
function bkImportView() {
  const c = bkClass(); if (!c) return;
  bki = { data: null, pick: {}, keep: true, over: {}, unit: '', all: '', cats: {}, info: true };
  bkTabsOff();
  $('#bkBody').innerHTML = '<div class="bkpad bkaddv bkiv" id="bkImp"><h3 class="bkh">Import a gradebook · ' + esc(c.name) + '</h3>' +
    '<p class="muted bkimeta">A gradebook downloaded from your school’s system or a spreadsheet: one row per student and one column per assignment. Assignments you already have are matched by name, and you check each match. Nothing is saved until you press Import, and nothing leaves this browser.</p>' +
    '<div class="bkidrop" id="bkiDrop"><button class="btn primary" data-bkifile>Choose a file…</button><span class="muted">CSV, TSV or Excel (.xlsx). In Google Sheets: File, Download, CSV.</span><input type="file" id="bkiFile" accept=".csv,.tsv,.txt,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></div>' +
    '<textarea class="bkin bkpaste" id="bkiPaste" rows="3" placeholder="Or copy the cells in your spreadsheet, headings included, and paste them here."></textarea>' +
    '<p class="bkierr" id="bkiErr" role="alert" hidden></p><div id="bkiOut"></div>' +
    '<div class="bkfootbtns"><span class="muted" id="bkiCount"></span><span class="sp"></span><button class="btn" data-bkback>Cancel</button><button class="btn primary" data-bkisave disabled>Import</button></div></div>';
}
function bkiErr(msg) { const e = $('#bkiErr'); if (!e) return; e.hidden = !msg; e.textContent = msg || ''; }
// Every assignment in the class, with scores yet or not (extra credit aside).
const bkiEx = () => { const c = bkClass(); return c.units.flatMap(u => u.items).filter(it => it.type !== 'xc').map(it => ({ it, name: it.name, due: it.due || '' })); };
function bkiTake(rows) {
  const r = bkiRead(rows || []);
  if (!r || r.err) { bkiErr(r && r.err === 'none' ? 'There’s no column of student names in that. Keep the names in one column (or first and last names in two), with a heading row above.' : 'That looks empty.'); return; }
  if (!r.cols.length) { bkiErr('No column of scores was found. Scores need to be numbers, percents, “17/20”, or Missing and Excused.'); return; }
  bkiErr('');
  const c = bkClass();
  const keys = r.students.map(s => s.name), pairs = rosterPairs(c.names, keys);
  r.match = new Map([...pairs].map(([n, k]) => [k, n]));
  bki.data = r; bki.pick = {}; bki.over = {}; bki.cats = {};
  // A class with no students yet takes the file's rows as its roster (each name once).
  bki.build = !c.names.length;
  if (bki.build) { const seen = new Set(); r.students.forEach((s, i) => { const k = normName(s.name); bki.pick[i] = seen.has(k) ? '' : '+'; seen.add(k); }); }
  const ex = bkiEx(); bkiMatch(r.cols, ex);
  for (const col of r.cols) {
    if (col.cat) { if (!(col.cat in bki.cats)) bki.cats[col.cat] = bkiCatGuess(col.cat); col.type = bki.cats[col.cat]; }
    const t = col.to && ex.find(x => x.it.id === col.to); if (t && !col.due) col.due = t.due || '';
  }
  bkiDraw();
}
// The roster name for each row: the match, or what the teacher picked ('' leaves it out, '+' adds the row as a new student).
function bkiWho(s, i) { const p = Object.prototype.hasOwnProperty.call(bki.pick, i) ? bki.pick[i] : bki.data.match.get(s.name) || ''; return p === '+' ? s.name : p; }
// A file cell as it will be stored on a scale (max points, or null for percents).
function bkiVal(cell, max) {
  if (!cell || cell.bad) return null;
  if (cell.st === 'missing' || cell.st === 'excused') return { v: null, st: cell.st };
  let v;
  if (cell.pct != null) v = max ? cell.pct / 100 * max : cell.pct;
  else if (cell.of && cell.of !== max) v = max ? cell.v / cell.of * max : cell.v / cell.of * 100;
  else v = cell.v;
  return { v: Math.max(0, Math.round(v * 2) / 2), st: cell.st || '' };
}
// An assignment already there keeps its own scale: its typed-in one, or what its graded papers are out of. undefined: the file sets it.
function bkiFixed(col) {
  if (!col.to) return undefined;
  const t = findItem(col.to); if (t && t.it.typed) return t.it.typed.max || null;
  const ex = bkClassCols(bkClass(), bk.cols).find(x => x.key === col.to), cell = ex && [...ex.cells.values()].find(x => !x.typed && x.max > 0);
  return cell ? cell.max : undefined;
}
const bkiMax = col => { const f = bkiFixed(col); return f !== undefined ? f : col.pct ? null : col.max; };
const bkiSame = (a, b) => (a.st || '') === (b.st || '') && (a.v == null ? null : +a.v) === (b.v == null ? null : +b.v);
// Whether the file's score wins where one is already there and differs: the teacher's pick for that score, else the choice for all.
const bkiUse = (col, who) => { const o = bki.over[col.i + '|' + who]; return o ? o === 'file' : !bki.keep; };
// What each included column will store, and where a score is already there and differs.
function bkiPlan() {
  const d = bki.data, out = [];
  for (const col of d.cols) {
    if (!col.on) continue;
    const max = bkiMax(col), t = col.to ? findItem(col.to) : null, old = (t && t.it.typed && t.it.typed.s) || {}, s = {}, clash = [];
    const exCol = col.to ? bkClassCols(bkClass(), bk.cols).find(x => x.key === col.to) : null, fb = (t ? t.it.type : col.type) === 'fm';
    let papers = 0;
    d.students.forEach((st, i) => {
      const who = bkiWho(st, i); if (!who) return;
      const v = bkiVal(bkiCell(st.cells[col.i]), max); if (!v) return;
      const gc = exCol && exCol.cells.get(who);
      if (gc && !gc.typed && (gc.pct != null || gc.st)) { papers++; return; }   // a graded paper's score always wins; it's changed in that paper
      if (old[who] && (old[who].v != null || old[who].st) && !bkiSame(old[who], v)) clash.push({ who, was: old[who], now: v });
      s[who] = fb ? { ...v, fb: true } : v;
    });
    out.push({ col, max, t, s, old, clash, papers });
  }
  return out;
}
const bkiShow = (r, max) => r.st === 'missing' || r.st === 'excused' ? r.st : r.v == null ? '–' : fmtNum(r.v) + (max ? '/' + fmtNum(max) : '%') + (r.st === 'late' ? ' late' : '');
// Student IDs and emails the file has where the class has none (they fill in), and ones that differ (kept as they are).
function bkiInfo() {
  const c = bkClass(), d = bki.data, add = [], differ = [];
  d.students.forEach((s, i) => {
    const who = bkiWho(s, i), had = (who && c.info && c.info[who]) || {}; if (!who) return;
    for (const k of ['id', 'email']) if (s[k]) { if (!had[k]) add.push([who, k, s[k]]); else if (String(had[k]).toLowerCase() !== s[k].toLowerCase()) differ.push(who); }
  });
  return { add, differ };
}
const bkiTypeName = t => t.startsWith('+:') ? t.slice(2) + ' (new type)' : bkLabel(t);
function bkiDraw() {
  const c = bkClass(), d = bki.data, out = $('#bkiOut'); if (!out || !d) return;
  $('#bkiDrop').hidden = $('#bkiPaste').hidden = true;
  const units = c.units, plan = bkiPlan(), ex = bkiEx(), clash = plan.flatMap(p => p.clash.map(x => [p, x]));
  const rows = d.students.map((s, i) => [s, i, bkiWho(s, i)]), matched = rows.filter(r => r[2]), unmatched = rows.filter(r => !r[2] || bki.pick[r[1]] === '+');
  const added = rows.filter(r => bki.pick[r[1]] === '+'), taken = new Set(matched.map(r => r[2])), absent = c.names.filter(n => !taken.has(n));
  const newTypes = [...new Set(Object.values(bki.cats).filter(t => t.startsWith('+:')))];
  const typeOpts = sel => bkCats().map(([t, , s]) => [t, s]).concat(newTypes.map(t => [t, bkiTypeName(t)])).map(([t, s]) => '<option value="' + esc(t) + '"' + (sel === t ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
  const typeCell = col => { const t = col.to && findItem(col.to); return t && t.it.type ? '<span class="muted">' + esc(bkLabel(t.it.type)) + '</span>' : '<select class="btn sm" data-bkitype="' + col.i + '" aria-label="Type">' + typeOpts(col.type) + '</select>'; };
  const scale = col => {
    const f = bkiFixed(col);
    if (f !== undefined) return '<span class="muted">' + (f ? 'Out of ' + fmtNum(f) : 'Percent') + ', as it is now</span>';
    return '<select class="btn sm" data-bkimode="' + col.i + '" aria-label="Scored as"><option value="pts"' + (col.pct ? '' : ' selected') + '>Points out of</option><option value="pct"' + (col.pct ? ' selected' : '') + '>Percent</option></select>' +
      (col.pct ? '' : ' <input type="number" class="bkin bksc" min="0.5" step="0.5" data-bkimax="' + col.i + '" value="' + esc(col.max || '') + '" aria-label="Out of">') + (col.how === 'guess' ? ' <span class="stag" title="Nothing in the file said what it’s out of, so this is a guess from the scores">check</span>' : '');
  };
  const found = col => { const cs = d.students.map(s => bkiCell(s.cells[col.i])).filter(Boolean), n = cs.filter(x => x.v != null || x.pct != null).length, m = cs.filter(x => x.st === 'missing').length, e = cs.filter(x => x.st === 'excused').length;
    return [people(n, 'score'), m ? m + ' missing' : '', e ? e + ' excused' : '', col.bad ? col.bad + ' not read' : ''].filter(Boolean).join(', '); };
  // Where a column goes: the same as an assignment already here (the likely ones first), a new assignment, or left out.
  const usedBy = new Map(d.cols.filter(x => x.on && x.to).map(x => [x.to, x.i]));
  const goes = col => {
    const v = !col.on ? 'skip' : col.to === null ? '' : col.to || 'new', opt = x => '<option value="' + x.it.id + '"' + (v === x.it.id ? ' selected' : '') + (usedBy.has(x.it.id) && usedBy.get(x.it.id) !== col.i ? ' disabled' : '') + '>Same as “' + esc(x.it.name) + '”</option>';
    const sug = col.opts.map(id => ex.find(x => x.it.id === id)).filter(Boolean), rest = ex.filter(x => !col.opts.includes(x.it.id));
    return '<select class="btn sm bkigo' + (v === '' ? ' bkiask' : '') + '" data-bkigo="' + col.i + '" aria-label="' + esc('Where “' + col.name + '” goes') + '">' + (v === '' ? '<option value="" selected>Choose…</option>' : '') +
      sug.map(opt).join('') + '<option value="new"' + (v === 'new' ? ' selected' : '') + '>New assignment</option><option value="skip"' + (v === 'skip' ? ' selected' : '') + '>Skip: leave it out</option>' +
      (rest.length ? '<optgroup label="Same as another assignment">' + rest.map(opt).join('') + '</optgroup>' : '') + '</select>' +
      (col.on && col.to && col.sure === 1 ? ' <span class="stag" title="The names are close, not the same">check</span>' : '');
  };
  const order = d.cols.slice().sort((a, b) => (a.on && a.to === null ? 0 : a.on && a.sure === 1 && a.to ? 1 : 2) - (b.on && b.to === null ? 0 : b.on && b.sure === 1 && b.to ? 1 : 2));
  const ask = d.cols.filter(x => x.on && x.to === null).length, n = d.cols.filter(x => x.on).length;
  const cats = Object.keys(bki.cats), info = (d.ids || d.mails) ? bkiInfo() : null;
  out.innerHTML = '<p class="bkisum">Found <b>' + people(d.cols.length, 'assignment') + '</b> and <b>' + people(d.students.length, 'student') + '</b>. ' +
    (bki.build ? 'This class has no students yet, so they become its roster.' : matched.length - added.length + ' of them match your roster.') + ' <button class="link" data-bkiagain>Use another file</button></p>' +
    (cats.length ? '<h4 class="ovh3">Categories in the file</h4><p class="muted bkhint">Each one goes into one of your gradebook types. You can still change a single assignment below.</p><table class="ptab bkitab bkicats"><tbody>' +
      cats.map(k => '<tr><td>' + esc(k) + '</td><td><select class="btn sm" data-bkicat="' + esc(k) + '" aria-label="' + esc('Type for ' + k) + '">' + bkCats().map(([t, , s]) => '<option value="' + t + '"' + (bki.cats[k] === t ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '<option value="' + esc('+:' + k) + '"' + (bki.cats[k] === '+:' + k ? ' selected' : '') + '>New type: ' + esc(k) + '</option></select></td></tr>').join('') + '</tbody></table>' +
      (newTypes.length ? '<p class="muted bkhint">A new type counts for nothing in the term grade until you give it a weight in the gradebook’s Term setup.</p>' : '') : '') +
    '<h4 class="ovh3">Assignments</h4>' + (ask ? '<p class="bkhint"><b>' + (ask === 1 ? 'One name is' : ask + ' names are') + ' close to an assignment you have.</b> Say for each whether it is the same one, a new one, or to leave it out.</p>' : '') +
    '<div class="bkiwrap"><table class="ptab bkitab"><thead><tr><th>In the file</th><th>Goes to</th><th>Type</th><th>Due</th><th>Scored as</th><th>Scores</th></tr></thead><tbody>' +
    order.map(col => '<tr class="' + (col.on ? '' : 'bkioff') + '"><td><input type="text" class="bkin bkiname" data-bkiname="' + col.i + '" value="' + esc(col.name) + '" aria-label="Assignment name"' + (col.to || !col.on ? ' disabled' : '') + '>' + (BKI_SUM.test(col.head) && !col.on ? '<small class="muted bkiwhy">Looks like a total, so it’s left out</small>' : '') + '</td>' +
      '<td>' + goes(col) + '</td><td>' + (col.on ? typeCell(col) : '') + '</td><td>' + (col.on ? '<input type="date" class="bkin" data-bkidue="' + col.i + '" value="' + esc(col.due) + '" aria-label="Due">' : '') + '</td><td class="bkiscale">' + (col.on ? scale(col) : '') + '</td><td class="muted">' + found(col) + '</td></tr>').join('') + '</tbody></table></div>' +
    '<div class="bkirow"><label class="bkpf">Date for every assignment without one<span class="bkiinl"><input type="date" class="bkin" id="bkiAll" value="' + esc(bki.all) + '"><button class="btn sm" data-bkiall>Use it</button></span></label>' +
    '<label class="bkpf">New assignments go in<select class="btn sm" id="bkiUnit">' + units.map(u => '<option value="' + u.id + '"' + (bki.unit === u.id ? ' selected' : '') + '>' + esc(u.name) + '</option>').join('') + '<option value=""' + (bki.unit ? '' : ' selected') + '>A new unit: Imported</option></select></label></div>' +
    (d.cols.some(x => x.on && !x.to && !x.due) ? '<p class="muted bkhint">An assignment with no date counts in no term until it has one. Set it here, or later from its column in the gradebook.</p>' : '') +
    '<h4 class="ovh3">Students</h4>' +
    (unmatched.length ? '<p class="bkhint">' + (bki.build ? 'Each row becomes a student unless you leave it out.' : (unmatched.length === 1 ? 'This row doesn’t' : 'These rows don’t') + ' match anyone on your roster. Pick the student, or leave the row out. Nobody is added unless you choose that.') + '</p><table class="ptab bkitab bkiwho"><tbody>' +
      unmatched.map(([s, i]) => { const p = bki.pick[i] || ''; return '<tr><td>' + esc(s.name) + '</td><td><select class="btn sm" data-bkipick="' + i + '" aria-label="' + esc('Roster student for ' + s.name) + '"><option value=""' + (p === '' ? ' selected' : '') + '>Leave this row out</option><option value="+"' + (p === '+' ? ' selected' : '') + '>Add as a new student</option>' + absent.map(nm => '<option value="' + esc(nm) + '">' + esc(nm) + '</option>').join('') + '</select></td></tr>'; }).join('') + '</tbody></table>' : '<p class="bkhint">Every row matches a student on your roster.</p>') +
    (absent.length && !bki.build ? '<p class="muted bkhint">On your roster but not in the file, so nothing changes for them: ' + esc(absent.join(', ')) + '.</p>' : '') +
    (matched.length - added.length > 0 ? '<details class="bkidet"><summary>' + people(matched.length - added.length, 'row') + ' matched</summary><ul>' + rows.filter(r => r[2] && bki.pick[r[1]] !== '+').map(([s, , r]) => '<li>' + esc(s.name) + (s.name === r ? '' : ' → ' + esc(r)) + '</li>').join('') + '</ul></details>' : '') +
    (info && (info.add.length || info.differ.length) ? '<label class="bkpf bkiinfo"><span><input type="checkbox" id="bkiInfo"' + (bki.info ? ' checked' : '') + '> Fill in ' + [['id', 'student ID'], ['email', 'email']].map(([k, w]) => { const m = info.add.filter(x => x[1] === k).length; return m ? people(m, w) : ''; }).filter(Boolean).join(' and ') + ' where you have none</span>' +
      (info.differ.length ? '<small class="muted">' + people(new Set(info.differ).size, 'student') + ' already ' + (new Set(info.differ).size === 1 ? 'has' : 'have') + ' a different one, which stays.</small>' : '') + '</label>' : '') +
    (clash.length ? '<div class="bknote bkiclash" id="bkiClash"><div><b>' + (clash.length === 1 ? '1 score is' : clash.length + ' scores are') + ' already in the gradebook and ' + (clash.length === 1 ? 'differs' : 'differ') + ' from the file.</b> Which should stay?</div><div class="pseg" role="group">' +
      [['keep', 'Keep all of mine'], ['file', 'Use all of the file’s']].map(([v, l]) => '<button data-bkikeep="' + v + '" aria-pressed="' + ((v === 'keep') === bki.keep && !Object.keys(bki.over).length) + '">' + l + '</button>').join('') + '</div>' +
      '<table class="ptab bkitab bkiclt"><tbody>' + clash.map(([p, x]) => { const f = bkiUse(p.col, x.who), k = p.col.i + '|' + esc(x.who); return '<tr><td>' + esc(p.t ? p.t.it.name : p.col.name) + '</td><td>' + esc(x.who) + '</td><td><div class="pseg" role="group"><button data-bkiover="' + k + '" data-v="keep" aria-pressed="' + !f + '">Mine: ' + esc(bkiShow(x.was, p.max)) + '</button><button data-bkiover="' + k + '" data-v="file" aria-pressed="' + f + '">File: ' + esc(bkiShow(x.now, p.max)) + '</button></div></td></tr>'; }).join('') + '</tbody></table></div>' : '') +
    (plan.some(p => p.papers) ? '<p class="muted bkhint">' + people(plan.reduce((a, p) => a + p.papers, 0), 'score') + ' already come from graded papers. Those stay as they are; change them in the paper.</p>' : '');
  const sv = $('[data-bkisave]'); sv.disabled = !n || !matched.length || !!ask; sv.textContent = n ? 'Import ' + people(n, 'assignment') : 'Import';
  $('#bkiCount').textContent = ask ? 'Choose where ' + (ask === 1 ? 'one assignment goes' : ask + ' assignments go') + ' first' : n ? people(plan.reduce((a, p) => a + Object.keys(p.s).length, 0), 'score') + ' for ' + people(matched.length, 'student') + (added.length ? ', ' + people(added.length, 'new student') : '') : '';
}
function bkiSave() {
  const c = bkClass(), plan = bkiPlan(); if (!plan.length || plan.some(p => p.col.to === null)) return false;
  const bad = plan.find(p => bkiFixed(p.col) === undefined && !p.col.pct && !(p.col.max > 0));
  if (bad) { toast('Say what “' + bad.col.name + '” is out of.'); return false; }
  // New types first, as the teacher's own (lib.book.cats holds the whole list once it differs from the usual three).
  const made = {}, want = [...new Set(plan.map(p => p.col.type).filter(t => t && t.startsWith('+:')))];
  if (want.length) {
    const b = lib.book || {}, list = (Array.isArray(b.cats) ? b.cats : BK_DEF.map(([id]) => ({ id }))).slice();
    for (const t of want) { const id = 'c' + uid(); made[t] = id; list.push({ id, name: t.slice(2), k: list.filter(x => x.k).length % 5 + 1 }); }
    lib.book = { ...b, cats: list };
  }
  // Students the teacher chose to add (or the whole roster of a class that had none), then their IDs and emails where the class has none.
  const d = bki.data, added = d.students.filter((s, i) => bki.pick[i] === '+' && !c.names.includes(s.name)).map(s => s.name);
  c.names.push(...new Set(added));
  if (bki.info && (d.ids || d.mails)) for (const [who, k, v] of bkiInfo().add) setInfo(c, who, { [k]: v });
  let u = null, first = null;
  for (const p of plan) {
    const col = p.col, name = col.name.trim() || col.head, type = made[col.type] || col.type;
    let it;
    if (p.t) {
      it = p.t.it;
      const s = { ...p.old };
      for (const [who, v] of Object.entries(p.s)) { const was = p.old[who]; if (!was || (was.v == null && !was.st) || bkiSame(was, v) || bkiUse(col, who)) s[who] = v; }
      it.typed = { max: p.max, s };
      if (!it.type) it.type = type;
      if (!it.due && col.due) it.due = col.due;
    } else {
      if (!u) { u = c.units.find(x => x.id === bki.unit); if (!u) c.units.push(u = { id: uid(), name: 'Imported', items: [] }); }
      u.items.push(it = { id: uid(), name, classId: c.id, type, due: col.due, typed: { max: p.max, s: p.s } });
    }
    const bc = bk.cols.find(x => x.key === it.id);
    if (bc) Object.assign(bc, { typed: it.typed, type: it.type, due: it.due || bc.due });
    else bk.cols.push({ key: it.id, it, cls: c.id, name: it.name, type: it.type, due: it.due || '', term: it.term || '', typed: it.typed, xcTo: '' });
    if (!first) first = it;
  }
  bkSaveLib(); if (!batch) renderLib();
  bk.term = bkTermOf({ due: first.due || '', term: first.term || '' }, bkConf().terms); bk.hi = first.id;
  const msg = 'Imported ' + people(plan.length, 'assignment') + (added.length ? ' and ' + people(added.length, 'student') : '') + '.';
  if (batch) toast(msg); else toastDo(msg, 'Undo', libUndo);
  return true;
}
async function bkiFile(f) {
  if (!f) return;
  try {
    const buf = new Uint8Array(await f.arrayBuffer());
    if (buf[0] === 0x50 && buf[1] === 0x4b) { let rows; try { rows = bkiXlsx(buf); } catch { return bkiErr('That Excel file couldn’t be read. Save it as CSV and choose that.'); } return bkiTake(rows); }
    if (buf[0] === 0xd0 && buf[1] === 0xcf) return bkiErr('That is an old Excel file (.xls). Save it as .xlsx or CSV and choose that.');
    bkiTake(bkiParse(new TextDecoder().decode(buf)));
  } catch (e) { console.error(e); bkiErr('That file couldn’t be read.'); }
}

/* ---------- clicks: its own, on the same hosts as the gradebook's ---------- */
const bkiCol = i => bki && bki.data && bki.data.cols.find(x => x.i === +i);
function bkiClick(e) {
  if (!bkHere(e)) return;
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if (d.bkimport != null) return bkImportView();
  if (!bki || !$('#bkImp')) return;
  if (d.bkifile != null) return $('#bkiFile').click();
  if (d.bkiagain != null) return bkImportView();
  if (d.bkiall != null) { const v = $('#bkiAll').value; bki.all = v; if (v) for (const col of bki.data.cols) if (!col.due) col.due = v; return bkiDraw(); }
  if (d.bkikeep) { bki.keep = d.bkikeep === 'keep'; bki.over = {}; return bkiDraw(); }
  if (d.bkiover) { bki.over[d.bkiover] = d.v; return bkiDraw(); }
  if (d.bkisave != null) { if (bkiSave()) { bki = null; bkAdd = null; bkDraw(); } }
}
function bkiChange(e) {
  if (!bkHere(e) || !bki) return;
  const t = e.target, d = t.dataset;
  if (t.id === 'bkiFile') { bkiFile(t.files && t.files[0]); t.value = ''; return; }
  if (!bki.data) return;
  if (d.bkigo != null) {   // Same as an assignment here, New, or Skip
    const col = bkiCol(d.bkigo), v = t.value; col.on = v !== 'skip';
    if (v !== 'skip') { col.to = v === 'new' ? '' : v; col.sure = 2; const x = col.to && findItem(col.to); if (x && x.it.due) col.due = x.it.due; }
    return bkiDraw();
  }
  if (d.bkicat != null) { const k = d.bkicat; bki.cats[k] = t.value; for (const col of bki.data.cols) if (col.cat === k && !col.typeSet) col.type = t.value; return bkiDraw(); }
  if (d.bkitype != null) { const col = bkiCol(d.bkitype); col.type = t.value; col.typeSet = true; return bkiDraw(); }
  if (t.id === 'bkiInfo') { bki.info = t.checked; return; }
  if (d.bkidue != null) { bkiCol(d.bkidue).due = t.value; return; }
  if (d.bkimode != null) { const col = bkiCol(d.bkimode); col.pct = t.value === 'pct'; if (!col.pct && !col.max) col.max = 20; col.how = ''; return bkiDraw(); }
  if (d.bkimax != null) { const col = bkiCol(d.bkimax); col.max = Math.max(0.5, Math.round(+t.value * 2) / 2) || null; col.how = ''; return bkiDraw(); }
  if (d.bkiname != null) { bkiCol(d.bkiname).name = t.value; return; }
  if (d.bkipick != null) { bki.pick[d.bkipick] = t.value; return bkiDraw(); }
  if (t.id === 'bkiUnit') { bki.unit = t.value; return; }
}
function bkiPasted(e) {
  if (!bkHere(e) || e.target.id !== 'bkiPaste' || !bki) return;
  e.preventDefault(); e.stopPropagation();
  bkiTake(bkiParse((e.clipboardData || window.clipboardData).getData('text')));
}
for (const host of [$('#dlgBox'), $('#vClass')]) { host.addEventListener('click', bkiClick); host.addEventListener('change', bkiChange); host.addEventListener('paste', bkiPasted); }
Object.assign(window.__gs, { bkiParse, bkiRead, bkiCell, bkiDate, bkiFit, bkiWide });
