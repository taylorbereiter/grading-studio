// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
// The class page hands in which class the gradebook is on (src/book.js keeps it in bk.cls); saving is the screen's, through
// students/write.js: what the lifted code changes is the library it was handed inside saveLibrary.
export const bkUse = o => Object.assign(bk, o);
// Its own library, setup and kept rows (bookUse), so a class page or Home reading the book never changes the marking screen's.
let lib = { classes: [], loose: { id: '', units: [] } }, setup = null, keptMeta = new Map();
export const bookUse = o => { if ('lib' in o) lib = o.lib; if ('setup' in o) setup = o.setup; if ('keptMeta' in o) keptMeta = o.keptMeta; };
// A retake's counting rule (gcore retakeRule) is read from the library: this one, for just the moment of the call.
import { withTries as coreTries, state as coreState, set as coreSet } from './gcore.js';
const withTries = (...a) => { const was = coreState().lib; coreSet.lib(lib); try { return coreTries(...a); } finally { coreSet.lib(was); } };
const saveLib = () => {}, bkSaveLib = () => {}, renderLib = () => {}, seatDraw = () => {};
// The Planner's timetable as attendance reads it (src/today.js plan: { classes: [{ name, meets: [{ dow }] }], daysOff: [{ date }] }), handed in by the page.
let plan = null;
export const planUse = p => { plan = p; };
import { batch, LANG_LOCALE, store, kdo, ROW_TOP, rowTop, setupMax, rowScaleOf, setupOver, roundPct, pointsWith, percentWith, addXc, fmtNum, fmtPct } from './gcore.js';

// src/pickshare.js
const pkNice = n => { const s = String(n || '').trim(), m = /^([^,]+),\s*(.+)$/.exec(s); return m ? m[2].trim() + ' ' + m[1].trim() : s; };
// src/pickshare.js
function pkShort(names) {
  const parts = names.map(n => pkNice(n).split(/\s+/).filter(Boolean)), first = parts.map(p => p[0] || '?'), count = new Map();
  for (const f of first) count.set(f.toLowerCase(), (count.get(f.toLowerCase()) || 0) + 1);
  return parts.map((p, i) => count.get(first[i].toLowerCase()) > 1 && p.length > 1 ? first[i] + ' ' + [...p[p.length - 1]][0].toUpperCase() + '.' : first[i]);
}
// src/pickshare.js
function pkShuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// src/pickshare.js
function pkCount(len, by, n) {
  if (len < 1) return 0;
  if (by === 'count') return Math.max(1, Math.min(len, n));
  const up = Math.ceil(len / n), least = Math.floor(len / up);
  return least >= Math.max(2, n - 1) || up === 1 ? up : Math.max(1, Math.floor(len / n));
}
// src/pickshare.js
function pkGroups(names, by, n, prev) {
  const k = pkCount(names.length, by, n);
  const deal = () => { const out = Array.from({ length: k }, () => []); pkShuffle(names).forEach((nm, i) => out[i % k].push(nm)); return out; };
  if (k < 2 || !Array.isArray(prev) || !prev.length) return deal();
  const was = new Map(); prev.forEach((g, i) => g.forEach(nm => was.set(nm, i)));
  const again = gs => { let s = 0; for (const g of gs) for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) if (was.has(g[a]) && was.get(g[a]) === was.get(g[b])) s++; return s; };
  let best = null, least = Infinity;
  for (let t = 0; t < 60 && least > 0; t++) { const g = deal(), s = again(g); if (s < least) { best = g; least = s; } }
  return best;
}
// src/app/start.js
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// src/app/start.js
const BK_TYPES = [['ic', 'In-class assessment', 'In-class'], ['sum', 'Summative assessment', 'Summative'], ['fm', 'Formative activity', 'Formative']];
// src/app/start.js
const BK_DEF = BK_TYPES.map(x => x.slice());
// src/app/start.js
let bkCatsSeen;
// src/app/start.js
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
// src/app/library.js
const uid = () => Math.random().toString(36).slice(2, 10);
// src/app/library.js
const ME_OLD = { sys: 'ManageBac', unit: 'Atlas', scale12: true, ai: 'Claude' };   // scale12: Rubric setup offers the 12-point scale (12 = 100, 11 = 95…) as a preset
// src/app/library.js
const me = () => lib.me || ME_OLD;
// src/app/library.js
const attDayOk = d => { if (!/^\d{4}-\d\d-\d\d$/.test(d || '')) return false; const t = new Date(d + 'T12:00:00'); return !isNaN(t) && t.getMonth() + 1 === +d.slice(5, 7) && t.getDate() === +d.slice(8); };
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
const holders = () => lib.classes.concat([lib.loose]);
// src/app/library.js
const findItem = id => { for (const c of holders()) for (const u of c.units) { const it = u.items.find(x => x.id === id); if (it) return { c, u, it }; } return null; };
// src/app/library.js
const classById = id => lib.classes.find(c => c.id === id);
// src/app/screens.js
const EMAIL_RX = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
// src/app/screens.js
function parseRosterRows(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const all = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim()).filter(Boolean);
    // a header row
    if (all.some(c => /^(e-?mail( address)?|student id|student number|id)$/i.test(c))) continue;
    const cells = all.filter(c => !/^\d[\d\s-]*$/.test(c) && !EMAIL_RX.test(c));
    if (!cells.length || /^(name|student|students|first|last|first name|last name|student name)$/i.test(cells[0])) continue;
    const id = all.find(c => /^\d[\d\s-]*$/.test(c)), email = all.find(c => EMAIL_RX.test(c));
    out.push({ name: cells.slice(0, 2).join(cells.length > 1 && !/,/.test(cells[0]) ? ' ' : ', '), id: id ? id.replace(/\s+/g, '') : '', email: email || '' });
  }
  return out;
}
// src/app/screens.js
const LETTER_PLAIN = { ø: 'o', đ: 'd', ð: 'd', ł: 'l', ħ: 'h', ı: 'i', ŧ: 't', æ: 'ae', œ: 'oe', ß: 'ss', þ: 'th' };
// src/app/screens.js
const nameFold = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[øđðłħıŧæœßþ]/g, c => LETTER_PLAIN[c]);
// src/app/screens.js
const nameWords = s => (nameFold(s).match(/[a-z0-9]+|[^\x00-\x7f\s,.()_-]+/g) || []);
// src/app/kept.js
function cardOfKept(id) {
  const m = keptMeta.get(id), f = m && m.asg ? findItem(m.asg) : null;
  if (f) return f.it;
  for (const c of holders()) for (const u of c.units) { const it = u.items.find(x => x.batchId === id); if (it) return it; }
  return null;
}
// src/app/anon.js
const anonOn = () => !!(batch && batch.anon && batch.anon.on);
// src/grades.js
const hasSheet = g => g.sheet != null && g.sheet !== '';
// src/grades.js
const tryRuleSay = (rule, n) => rule === 'last' ? 'the latest try' : rule === 'avg' ? 'the average of ' + n + ' tries' : 'the highest of ' + n + ' tries';
// src/grades.js
function triesSay(g) {
  const all = g.tries.concat(g.tryNow ? [g.tryNow] : []);
  return all.map((t, i) => (i ? (all.length === 2 ? 'retake ' : 'try ' + (i + 1) + ' ') : 'First try ') + fmtPct(t.pct)).join(', ') + (g.tryNow ? '' : ', retake not scored yet') + '. Counts: ' + (g.tryNow ? tryRuleSay(g.tryRule, all.length) : 'the ' + (g.tries.length > 1 ? 'earlier tries' : 'first try')) + '.';
}
// src/grades.js
function csvSafe(v) {
  const t = String(v);
  return /^[\s 　]*[=+\-@＝＋－＠]/.test(t) || /^[\t\r\n]/.test(t) ? "'" + t : t;
}
// src/saving.js
const newestWork = (a, b) => !a ? b || null : !b ? a : (b.t || 0) > (a.t || 0) ? b : a;
// src/carryover.js
const hasWork = d => !!d && !!d.s && Object.keys(d.s).length > 0;
// src/carryover.js
async function earlierWork(id, keep = hasWork) {
  const all = new Map();
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('gs.b.') && k !== id) all.set(k, store.get(k, null)); }
  try {
    const keys = await kdo('work', 'readonly', o => o.getAllKeys()) || [], vals = await kdo('work', 'readonly', o => o.getAll()) || [];
    keys.forEach((k, i) => { if (k !== id) all.set(k, newestWork(all.get(k), vals[i])); });
  } catch (e) { console.error(e); }
  return [...all].filter(([, d]) => keep(d)).sort((a, b) => (b[1].t || 0) - (a[1].t || 0));
}
// src/rubrics.js
const levelIn = (d, i, v) => { const r = d.levels && d.levels[i]; return (r && r[v]) || ''; };
// src/rubrics.js
const people = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
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
// src/book.js
function bkIsType(t) { return bkCats().some(x => x[0] === t); }
// src/book.js
function bkType(t) { return t === 'xc' || bkIsType(t) ? t : ''; }   // a type as the gradebook reads it: one of the teacher's own, extra credit, or none
// src/book.js
const bkIsDef = t => { const x = bkCats().find(y => y[0] === t), d = BK_DEF.find(y => y[0] === t); return !!x && !!d && x[2] === d[2]; };
// src/book.js
function bkLabel(t, short) { const x = bkCats().find(y => y[0] === t); return x ? x[short ? 2 : 1] : t === 'xc' ? 'Extra credit' : 'No type yet'; }
// src/book.js
const BK_W0 = { sum: 50, ic: 50, fm: 0 };
// src/book.js
function bkConf() {
  const b = lib.book || {};
  return { terms: (b.terms || []).filter(t => t && t.id), w: { ...BK_W0, ...(b.w || {}) }, empty: b.empty === 'zero' ? 'zero' : 'other', dl: b.dl || {}, xcTo: b.xcTo === 'ic' && bkIsType('ic') ? 'ic' : 'term', xcCap: b.xcCap !== false };
}
// src/book.js
const bkXcTo = (col, conf) => col.xcTo === 'ic' ? (bkIsType('ic') ? 'ic' : 'term') : col.xcTo === 'term' ? 'term' : conf.xcTo;
// src/book.js
const isoDay = t => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// src/book.js
function bkDay(s) { return s ? new Date(s + 'T12:00:00').toLocaleDateString(LANG_LOCALE, { month: 'short', day: 'numeric' }) : ''; }
// src/book.js
function bkTermOf(col, terms) {
  if (col.term && terms.some(t => t.id === col.term)) return col.term;
  const t = terms.find(x => x.start && x.end && col.due >= x.start && col.due <= x.end);
  return t ? t.id : '';
}
// src/book.js
const bkMean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
// src/book.js
function bkCellOf(p, g, d, k) {
  const marks = !!(d && d.s && d.s[k] && d.s[k].f && Object.values(d.s[k].f).some(pg => Object.values(pg || {}).some(a => a && a.length)));
  const fb = !!(g && g.fb), started = marks || !!((g && g.comment) || '').trim() || tnHasG(g);   // fb: she switched on Feedback complete
  if (p.status === 'missing' || p.status === 'excused') return { st: p.status, fb };
  if (p.total == null && p.pct == null) return fb || started ? { fb, started } : null;
  const cell = { pct: p.pct, total: p.total, max: p.max, st: p.status, partial: p.partial, out: !!(g && g.outAvg), fb, started };
  if (p.rows && p.rows.length) cell.rows = p.rows;   // each rubric row's score, for the charts
  const goals = d ? goalCell(d, g, p) : null; if (goals) cell.goals = goals;   // what this paper says about each learning goal (goals.js)
  if (p.tries) cell.tries = triesSay(p);   // a retake: every try and which counts, in words
  return cell;
}
// src/book.js
function bkTypedCell(ty, r, sc) {
  if (!r) return null;
  if (r.st === 'missing' || r.st === 'excused') return { st: r.st, typed: true };
  if (r.v == null || r.v === '' || isNaN(+r.v)) return r.fb ? { fb: true, typed: true } : null;
  const v = +r.v, max = ty.max ? +ty.max : null, one = x => ({ pct: max ? percentWith(x, max, sc) : roundPct(x), total: max ? x : null, max }), xc = +r.xc || 0;
  let p0 = r.p != null && max ? { pct: +r.p, total: pointsWith(+r.p, max, sc), max } : one(v);
  if (xc > 0) p0 = { ...p0, total: p0.total != null ? p0.total + xc : null, pct: roundPct(p0.pct + (max ? xc / max * 100 : xc)) };
  const was = (r.tries || []).filter(x => x != null && !isNaN(+x)).map(x => one(+x)), p = was.length ? withTries(p0, was, max, true) : p0;
  return { pct: p.pct, total: p.total, max, st: r.st || '', typed: true, fb: true, ...(was.length ? { tries: triesSay(p) } : {}) };
}
// src/book.js
async function bkLoad() {
  const all = await earlierWork('', d => hasWork(d) || !!(d && d.read)).catch(e => { console.error(e); return []; });
  const conf = bkConf(), byKey = new Map();
  for (const [id, d] of all) {
    const m = keptMeta.get(id) || {};
    if (m.newer && keptMeta.has(m.newer)) continue;   // an older copy of a download that was opened again
    const it = cardOfKept(id), cls = it ? it.classId || '' : pastClass(d, m), key = it ? it.id : 'dl:' + id;
    if (!cls || byKey.has(key)) continue;   // newest first, so the first one is the one that counts
    const o = it || conf.dl[id] || {};
    byKey.set(key, { key, it, dl: id, d, cls, name: (it && it.name) || o.name || m.name || 'A download', type: bkType(o.type), due: o.due || isoDay(workTime(d) || d.t || m.t), term: o.term || '' });
  }
  for (const c of lib.classes) for (const u of c.units) for (const it of u.items) {
    if (!it.typed || byKey.has(it.id)) { if (it.typed && byKey.has(it.id)) byKey.get(it.id).typed = it.typed; continue; }
    byKey.set(it.id, { key: it.id, it, cls: c.id, name: it.name, type: bkType(it.type), due: it.due || isoDay(it.opened), term: it.term || '', typed: it.typed, xcTo: it.xcTo || '' });
  }
  for (const col of byKey.values()) if (!col.typed && col.it && col.it.typed) col.typed = col.it.typed;
  return [...byKey.values()];
}
// src/book.js
function bkClassCols(c, cols) {
  const names = c.names, terms = bkConf().terms;
  return cols.filter(x => x.cls === c.id).map(col => {
    const cells = new Map();
    if (col.d) {
      const d = col.d, pairs = rosterPairs(names, Object.keys({ ...d.s, ...d.read }));
      for (const n of names) {
        const k = pairs.get(n); if (!k) continue;
        const g = (d.s[k] && d.s[k].g) || {}, r = d.read && d.read[k];
        const cell = bkCellOf(pastScore(d.setup, r ? { ...g, read: r } : g), g, d, k);
        if (cell) cells.set(n, cell);
      }
    }
    if (col.type === 'xc') { cells.clear(); if (col.typed) for (const n of names) { const r = col.typed.s && col.typed.s[n], v = r ? +r.v : 0; if (v > 0) cells.set(n, { xc: v, typed: true }); } }
    else if (col.typed) for (const n of names) if (!cells.has(n) || (cells.get(n).pct == null && !cells.get(n).st)) { const cell = bkTypedCell(col.typed, col.typed.s && col.typed.s[n], col.d && setupOver(col.d.setup).scale); if (cell) cells.set(n, cell); }
    return { ...col, cells, termId: bkTermOf(col, terms) };
  }).sort((a, b) => (a.due || '').localeCompare(b.due || '') || natural(a.name, b.name));
}
// src/book.js
const bkCounts = cell => !!cell && cell.pct != null && !cell.partial && !cell.out && cell.st !== 'missing' && cell.st !== 'excused';
// src/book.js
function bkGrade(name, cols, conf) {
  const by = {}, w = conf.w, xc = { term: 0, ic: 0 };
  let sum = 0, wt = 0, soFar = false;
  for (const col of cols) if (col.type === 'xc') { const cell = col.cells.get(name); if (cell && cell.xc) xc[bkXcTo(col, conf)] += cell.xc; }
  for (const [t] of BK_TYPES) {
    const ps = cols.filter(x => x.type === t).map(x => x.cells.get(name)).filter(bkCounts).map(x => x.pct);
    by[t] = ps.length ? bkMean(ps) : null;
    if (t === 'ic' && by.ic != null && xc.ic) by.ic += xc.ic;
    if (t === 'fm' || !(+w[t] > 0)) continue;
    if (by[t] == null) { if (cols.some(x => x.type === t)) soFar = true; if (conf.empty !== 'zero') continue; }
    sum += (by[t] || 0) * +w[t]; wt += +w[t];
  }
  const fmw = +w.fm > 0 ? by.fm : null;
  if (fmw != null) { sum += fmw * +w.fm; wt += +w.fm; }
  let grade = wt ? sum / wt : null;
  if (grade != null && xc.term) grade += xc.term;
  const capped = grade != null && conf.xcCap && grade > 100;
  if (capped) grade = 100;
  return { by, grade, soFar, xc: (by.ic != null ? xc.ic : 0) + (grade != null ? xc.term : 0), xcIc: by.ic != null ? xc.ic : 0, xcTerm: grade != null ? xc.term : 0, capped };
}
// src/book.js
let bk = { tab: 'table', cls: '', term: null, show: 'pct', stu: 0, cols: null, hi: '', host: 'dlg', sort: null, ver: -1, lib: null };
// src/book.js
const bkClass = () => classById(bk.cls);
// src/book.js
function bkTabs(cols) {
  const terms = bkConf().terms, out = terms.map(t => [t.id, t.name || 'Term']);
  if (!terms.length) return [['', 'This year']];
  if (cols.some(x => !x.termId)) out.push(['', 'Outside the terms']);
  out.push(['*', 'Whole year']);
  return out;
}
// src/book.js
function bkTermNow(terms) { const t = isoDay(Date.now()), x = terms.find(y => y.start <= t && t <= y.end); return x ? x.id : terms.length ? terms[terms.length - 1].id : ''; }
// src/book.js
function bkGroups(cols) {
  const g = bkCats().map(([t, , s]) => ({ t, s, cols: cols.filter(x => x.type === t) })).filter(x => x.cols.length);
  const xc = cols.filter(x => x.type === 'xc'); if (xc.length) g.push({ t: 'xc', s: 'Extra credit', cols: xc });
  const none = cols.filter(x => !x.type); if (none.length) g.push({ t: '', s: 'No type yet', cols: none });
  return g;
}
// src/book.js
const bkLeftAll = {};
// src/book.js
const bkLeft = () => bkLeftAll[bk.cls] || (bkLeftAll[bk.cls] = new Set());
// src/book.js
const bkIn = n => !bkLeft().has(n);
// src/book.js
const bkCountTypes = conf => bkCats().filter(([t]) => +conf.w[t] > 0);
// src/book.js
const bkClassAvg = (grades, t) => { const ps = grades.map(r => t ? r.by[t] : r.grade).filter(v => v != null); return ps.length ? pctAvgText(bkMean(ps)) : '–'; };
// src/book.js
const BK_BANDS = [[90, 100, '90 to 100'], [80, 89, '80 to 89'], [70, 79, '70 to 79'], [60, 69, '60 to 69'], [0, 59, 'Below 60']];
// src/book.js
function bkBands(list) {
  const n = list.length, cnt = BK_BANDS.map(([lo, hi]) => list.filter(p => roundPct(p.v) >= lo && (roundPct(p.v) <= hi || (lo === 90 && p.v > 100)))), most = Math.max(1, ...cnt.map(x => x.length));
  return '<div class="pbands" id="bkBands">' + BK_BANDS.map(([, , l], i) => { const k = cnt[i].length; return '<div class="pband"' + (k ? ' tabindex="0"' : '') + ' data-tv="' + esc(people(k, 'student')) + '" data-tl="' + esc(l + '%') + '" data-tn="' + esc(cnt[i].map(p => p.name).join(', ')) + '" data-tnraw><span>' + l + '</span><div class="pbt"><i style="width:' + k / most * 100 + '%"></i></div><span class="pbn"><b>' + k + '</b>' + (n ? ' · ' + Math.round(k / n * 100) + '%' : '') + '</span></div>'; }).join('') + '</div>';
}
// src/book.js
function bkScored(cols) { return cols.filter(x => x.type !== 'fm' && bkIsType(x.type)); }
// src/book.js
function bkTypeUse() {
  const n = new Map(), add = t => { if (t) n.set(t, (n.get(t) || 0) + 1); };
  for (const c of lib.classes) for (const u of c.units) for (const it of u.items) add(it.type);
  for (const o of Object.values(bkConf().dl)) add(o && o.type);
  return n;
}
// src/book.js
function bkParse(t, r, col) {
  t = String(t).trim().toLowerCase(); if (!t) return null;
  const hp = x => Math.round(+x * 2) / 2, ok = x => x !== '' && !isNaN(+x) && +x >= 0, st = /^m(issing)?$/.test(t) ? 'missing' : /^e(xcused)?$/.test(t) ? 'excused' : '';
  if (col.type === 'xc') { t = t.replace(/^\+/, ''); return ok(t) ? hp(t) > 0 ? { v: hp(t) } : null : undefined; }
  if (col.typed && col.typed.lv) {
    if (st) return { st };
    const crit = (col.it && col.it.crit) || [], vs = t.split(/[\s,/]+/), l = {};
    if (vs.length > crit.length || vs.some(x => x !== '-' && ibLevel(x) == null)) return undefined;
    vs.forEach((x, i) => { if (x !== '-') l[crit[i]] = +x; });
    return Object.keys(l).length ? { l, st: '' } : null;
  }
  if (st) return { v: null, st };
  let xc = 0; const mx = t.match(/\s*\+\s*(\d+(?:[.,]\d+)?)$/); if (mx) { xc = hp(mx[1].replace(',', '.')); t = t.slice(0, mx.index).trim(); }   // "8 + 1": extra credit on top
  const late = r.st === 'late' ? 'late' : '', max = col.typed ? col.typed.max : col.d ? bkColMax(col) : null, add = o => xc > 0 ? { ...o, xc } : o;
  if (max && /^\d+([.,]\d+)?\s*%$/.test(t)) { const p = roundPct(+t.replace('%', '').replace(',', '.').trim()); return add({ v: Math.round(p * max) / 100, p, st: late }); }   // "73%" in a points column: the percent stays the score
  if (max && t.includes('%')) return undefined;   // a percent goes in on its own, not in a retake
  const vs = t.split('>').map(x => x.trim().replace('%', '').replace(',', '.')); if (!vs.every(ok)) return undefined;
  const n = vs.map(hp), v = n.pop();
  return add(n.length ? { v, st: late, tries: n } : { v, st: late });
}
// src/book.js
function bkCellVal(r, col) {
  if (r.st === 'missing' || r.st === 'excused') return r.st;
  if (col.typed && col.typed.lv) { const vs = ((col.it && col.it.crit) || []).map(k => r.l && r.l[k] != null ? r.l[k] : '-'); return vs.some(x => x !== '-') ? vs.join(' ') : ''; }
  if (col.type === 'xc') return +r.v > 0 ? fmtNum(+r.v) : '';
  return r.v == null ? '' : (r.tries || []).map(fmtNum).concat(r.p != null ? r.p + '%' : fmtNum(r.v)).join(' > ') + (+r.xc > 0 ? ' + ' + fmtNum(+r.xc) : '');
}
// src/book.js
const bkColMax = col => { for (const x of bkClassCols(bkClass(), [col])[0].cells.values()) if (x.max) return x.max; return null; };
// src/book.js
function bkPut(col, n, rec) {
  if (!col.typed && !rec) return;
  const ty = col.typed || { max: bkColMax(col), s: {} }, s = { ...(ty.s || {}) }, gone = { ...(ty.gone || {}) }, t = Date.now();
  // each score keeps when it was typed, and a score taken out when, so a phone and a computer can merge them student by student (typedMerge)
  if (rec) { s[n] = { ...rec, t }; delete gone[n]; } else { delete s[n]; gone[n] = t; }
  const kept = { ...ty, s }; if (Object.keys(gone).length) kept.gone = gone; else delete kept.gone;
  col.typed = col.d && !Object.keys(s).length ? null : kept;   // a download with no typed score left has none
  if (col.it) { if (col.typed) col.it.typed = col.typed; else delete col.it.typed; }
}
// src/book.js
function typedStamp(old, nu) {
  const so = (old && old.s) || {}, sn = nu.s || {}, gone = { ...((old && old.gone) || {}) }, t = Date.now(), bare = r => { const { t, ...x } = r || {}; return JSON.stringify(x); };
  for (const [n, r] of Object.entries(sn)) { sn[n] = { ...r, t: so[n] && bare(so[n]) === bare(r) ? so[n].t || t : t }; delete gone[n]; }
  for (const n of Object.keys(so)) if (!sn[n]) gone[n] = t;
  if (Object.keys(gone).length) nu.gone = gone; else delete nu.gone;
  return nu;
}
// src/insight.js
const wordsMemo = new Map();
// src/insight.js
const wordSet = s => { let w = wordsMemo.get(s); if (!w) wordsMemo.set(s, w = new Set(nameWords(s))); return w; };
// src/insight.js
function nameFit(a, b) {
  const A = wordSet(a), B = wordSet(b);
  if (!A.size || !B.size) return 0;
  const aInB = [...A].every(w => B.has(w)), bInA = [...B].every(w => A.has(w));
  if (aInB && bInA) return 2;
  return (aInB && A.size > 1) || (bInA && B.size > 1) ? 1 : 0;
}
// src/insight.js
function rosterPairs(names, keys) {
  const sure = new Map(), c = classOfNames(names);
  if (c && c.info) {   // a spelling she linked, or the student's ID in the name, first
    for (const k of keys) { const h = infoHits(c, k); if (h.length === 1 && !sure.has(h[0])) sure.set(h[0], k); }
    const took = new Set(sure.values()); names = names.filter(n => !sure.has(n)); keys = keys.filter(k => !took.has(k));
  }
  const fits = names.map(n => keys.map(k => nameFit(n, k)));
  names.forEach((n, i) => {
    const top = Math.max(0, ...fits[i]); if (!top) return;
    const hits = keys.filter((_, j) => fits[i][j] === top); if (hits.length !== 1) return;
    const j = keys.indexOf(hits[0]), col = fits.map(r => r[j]);
    if (Math.max(...col) === top && col.filter(v => v === top).length === 1) sure.set(n, hits[0]);
  });
  return sure;
}
// src/insight.js
function pastScore(su, g) {
  const s = setupOver(su), rub = s.mode === 'rubric';
  if (g.status === 'missing' || g.status === 'excused') return { total: null, pct: null, status: g.status, rows: [] };
  const r = g.rubric || [];
  let max = setupMax(s), total = null, partial = false, paper = false;
  if (rub) { const v = s.criteria.map((_, i) => r[i]); if (v.some(x => x != null)) { total = v.reduce((a, x) => a + (x || 0), 0); partial = v.some(x => x == null); } }
  else if (g.points !== '' && g.points != null && !isNaN(+g.points)) total = +g.points;
  if (total == null && hasSheet(g) && !isNaN(+g.sheet)) { total = +g.sheet; paper = true; }
  let pct = percentWith(total, max, s.scale);
  if (g.pk != null && g.pk !== '' && !Array.isArray(s.ib)) { pct = +g.pk; total = pointsWith(pct, max, s.scale); partial = paper = false; }   // a percent she typed stays the score
  if (total == null && g.read && !(g.tries && g.tries.length)) { const d = g.read; paper = true; total = d.score; if (d.outOf != null) max = d.outOf; pct = d.pct != null ? d.pct : percentWith(total, max, s.scale); }
  const one = addXc({ total, max, pct, partial, paper, status: g.status || '', rows: rub ? s.criteria.map((c, i) => rowTop(s, i) === ROW_TOP ? [c, r[i]] : [c, r[i], rowTop(s, i)]).filter(x => x[1] != null) : [] }, g.xc, max, g.xcU);
  if (!g.tries || !g.tries.length) return one;
  const out = withTries(one, g.tries, max, one.total != null && !partial);   // a retake: the try that counts by the teacher's rule (start.js)
  if (out.outOf != null) { out.max = out.outOf; delete out.outOf; }
  return out;
}
// src/insight.js
function pastClass(d, m) {
  const f = m.asg && findItem(m.asg);
  if (f) return f.it.classId || '';
  if (d.cls != null) return classById(d.cls) ? d.cls : '';
  const keys = Object.keys({ ...d.s, ...d.read });
  let best = '', bn = 0;
  for (const k of lib.classes) if (k.names.length) { const n = rosterPairs(k.names, keys).size; if (n > bn) { bn = n; best = k.id; } }
  return bn >= Math.max(2, keys.length / 2) ? best : '';
}
// src/insight.js
function workTime(d) {
  const all = Object.values(d.s || {}).flatMap(r => { const g = r.g || {}; return [r.at, g.at, ...Object.values(g.atR || {})]; }).filter(Boolean);
  return all.length ? Math.max(...all) : 0;
}
// src/people.js
const classOfNames = names => (names && lib.classes.find(k => k.names === names)) || null;   // rosterMatch and rosterPairs are handed c.names itself
// src/people.js
const infoOf = (c, n) => (c && c.info && c.info[n]) || {};
// src/people.js
const idDigits = v => String(v || '').replace(/\D/g, '');
// src/people.js
const wordKey = s => nameWords(s).sort().join(' ');
// src/people.js
function infoHits(c, key) {
  if (!c || !c.info || !key) return [];
  const kw = wordKey(key), nums = String(key).match(/\d{4,}/g) || [];
  return c.names.filter(n => {
    const i = c.info[n]; if (!i) return false;
    if ((i.other || []).some(o => o === key || (kw && wordKey(o) === kw))) return true;
    const d = idDigits(i.id); return d.length >= 4 && nums.includes(d);
  });
}
// src/people.js
const blankInfo = i => !i || (!i.id && !i.email && !(i.other || []).length && !(i.note || '').trim() && !i.call && !i.pro && !i.rep && !i.nudge);   // call, pro, rep: report comments (reports.js); nudge: reminders (missing.js)
// src/people.js
function setInfo(c, n, patch) {
  c.info ||= {};
  const i = { ...c.info[n], ...patch };
  for (const k of Object.keys(i)) if (i[k] === '' || (Array.isArray(i[k]) && !i[k].length)) delete i[k];
  if (blankInfo(i)) delete c.info[n]; else c.info[n] = i;
  if (!Object.keys(c.info).length) delete c.info;
}
// src/people.js
function keepInfo(c, was, rows) {
  const old = c.info || {}, next = {};
  for (const n of c.names) if (old[n]) next[n] = old[n];
  for (const r of rows) if (r.id || r.email) next[r.name] = { ...next[r.name], ...(r.id ? { id: r.id } : {}), ...(r.email ? { email: r.email } : {}) };
  for (const n of (was || []).filter(n => !c.names.includes(n) && old[n])) {
    const d = idDigits(old[n].id), to = d && c.names.find(m => idDigits((next[m] || {}).id) === d);
    if (!to) continue;
    const o = old[n], t = next[to] || {};
    next[to] = { ...o, ...t, other: [...new Set([...(o.other || []), ...(t.other || []), n])] };
  }
  c.info = next;
  if (!Object.keys(next).length) delete c.info;
}
// src/marksout.js
const one = t => String(t || '').replace(/\s*\n\s*/g, ' ').trim();
// src/typednotes.js
function tnHasG(g) { return !!(g && g.tn && Array.isArray(g.tn.l) && g.tn.l.some(x => x && x.k !== 'h' && x.y !== 'h2' && String(x.s || '').trim())); }
// src/classpage.js
const chRowName = x => typeof x === 'string' ? x.trim() : String((x && x.name) || '').trim();
// src/classpage.js
function chRowTop(cols) {
  const n = new Map(); for (const col of cols) for (const cell of col.cells.values()) for (const r of (cell && cell.rows) || []) { const t = r[2] || ROW_TOP; n.set(t, (n.get(t) || 0) + 1); }
  let best = ROW_TOP, most = 0; for (const [t, k] of n) if (k > most) { best = t; most = k; }
  return best;
}
// src/seating.js
const SEAT_MAX_W = 14, SEAT_MAX_H = 12;
// src/seating.js
const SEAT_ROOMS = [['rows', 'Rows', 'Single desks in rows'], ['pairs', 'Pairs', 'Desks side by side in twos'], ['tables', 'Tables of four', 'Four desks pushed together'], ['horseshoe', 'Horseshoe', 'Desks around three sides, open to the front']];
// src/seating.js
const seatXY = k => k.split(',').map(Number);
// src/seating.js
const seatKeys = s => Object.keys(s.desks).sort((a, b) => { const [ax, ay] = seatXY(a), [bx, by] = seatXY(b); return ay - by || ax - bx; });
// src/seating.js
function seatRoom(kind, n) {
  n = Math.max(1, Math.min(60, n));
  const cells = [];
  if (kind === 'pairs') {
    const across = n <= 16 ? 2 : 3, per = across * 2, rows = Math.ceil(n / per);
    for (let y = 0; y < rows; y++) for (let p = 0; p < across; p++) cells.push([3 * p, y], [3 * p + 1, y]);
  } else if (kind === 'tables') {
    const tables = Math.ceil(n / 4), across = tables <= 4 ? 2 : tables <= 9 ? 3 : 4;
    for (let t = 0; t < tables; t++) { const x = 3 * (t % across), y = 3 * Math.floor(t / across); cells.push([x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]); }
  } else if (kind === 'horseshoe') {
    const w = Math.min(SEAT_MAX_W, Math.max(4, Math.ceil(n * .4))), h = Math.min(SEAT_MAX_H, Math.max(2, Math.ceil((n - w) / 2) + 1));
    for (let y = 0; y < h - 1; y++) cells.push([0, y]);
    for (let x = 0; x < w; x++) cells.push([x, h - 1]);
    for (let y = h - 2; y >= 0; y--) cells.push([w - 1, y]);
    for (let y = h - 3; y >= 0 && cells.length < n; y -= 2) for (let x = 2; x < w - 2 && cells.length < n; x++) cells.push([x, y]);   // a very big class: rows inside the horseshoe
  } else {
    const per = n <= 12 ? 4 : n <= 20 ? 5 : n <= 36 ? 6 : 7, rows = Math.ceil(n / per);
    for (let y = 0; y < rows; y++) for (let x = 0; x < per; x++) cells.push([x, y]);
  }
  if (kind !== 'horseshoe') cells.length = Math.min(cells.length, n);   // no more desks than students; a horseshoe keeps its shape
  return { w: Math.max(...cells.map(c => c[0])) + 1, h: Math.max(...cells.map(c => c[1])) + 1, cells: cells.map(c => c.join(',')) };
}
// src/seating.js
function seatOf(c) {
  const s = c && c.seats; if (!s || typeof s !== 'object' || !s.desks || typeof s.desks !== 'object') return null;
  const w = Math.max(1, Math.min(SEAT_MAX_W, Math.round(+s.w) || 1)), h = Math.max(1, Math.min(SEAT_MAX_H, Math.round(+s.h) || 1)), desks = {}, used = new Set();
  for (const [k, v] of Object.entries(s.desks)) {
    if (!/^\d+,\d+$/.test(k)) continue;
    const [x, y] = seatXY(k); if (x >= w || y >= h) continue;
    const n = typeof v === 'string' && v && c.names.includes(v) && !used.has(v) ? v : '';
    if (n) used.add(n); desks[k] = n;
  }
  return { w, h, desks, flip: !!s.flip, pins: (Array.isArray(s.pins) ? s.pins : []).filter(n => used.has(n)) };
}
// src/seating.js
const seatList = c => { const s = seatOf(c); return s ? seatKeys(s).filter(k => s.desks[k]).map(k => ({ name: s.desks[k], x: seatXY(k)[0], y: seatXY(k)[1] })) : []; };
// src/seating.js
function seatSave(c, s) {
  if (!s) delete c.seats;
  else c.seats = { w: s.w, h: s.h, desks: s.desks, ...(s.flip ? { flip: true } : {}), ...(s.pins && s.pins.length ? { pins: s.pins } : {}) };
  saveLib(); seatDraw();
}
// src/seating.js
function seatFill(c, shuffle) {
  const s = seatOf(c), pinned = new Set(s.pins), keys = seatKeys(s).filter(k => !pinned.has(s.desks[k]));
  let who = c.names.filter(n => !pinned.has(n)); if (shuffle) who = pkShuffle(who);
  keys.forEach((k, i) => { s.desks[k] = who[i] || ''; });
  seatSave(c, s);
  return Math.max(0, who.length - keys.length);
}
// src/seating.js
function seatPut(c, name, key) {
  const s = seatOf(c), from = Object.keys(s.desks).find(k => s.desks[k] === name) || null;
  if (key === from || (key && !(key in s.desks))) return;
  const other = key ? s.desks[key] : '';
  if (key) s.desks[key] = name;
  if (from) s.desks[from] = other || '';
  s.pins = s.pins.filter(n => n !== name && n !== other);
  seatSave(c, s);
}
// src/seating.js
function seatSetRoom(c, kind) {
  const was = seatOf(c), who = was ? seatKeys(was).map(k => was.desks[k]).filter(Boolean) : [], r = seatRoom(kind, c.names.length), desks = {};
  r.cells.forEach(k => { desks[k] = ''; });
  const order = seatKeys({ desks }); who.forEach((n, i) => { if (order[i]) desks[order[i]] = n; });
  seatSave(c, { w: r.w, h: r.h, desks, flip: was ? was.flip : false, pins: [] });
}
// src/attend.js
const ATT_WAYS = [['p', 'Present'], ['l', 'Late'], ['a', 'Absent, reason unknown'], ['e', 'Absent, excused']], ATT_WORD = Object.fromEntries(ATT_WAYS);
// src/attend.js
const attRec = (c, d) => { const r = c && c.att && c.att[d]; return r && !r.off ? r : null; };
// src/attend.js
const attOf = (c, d, n) => { const r = attRec(c, d); return r ? (r.m && r.m[n]) || 'p' : ''; };
// src/attend.js
const attNote = (c, d, n) => { const r = attRec(c, d); return (r && r.n && r.n[n]) || ''; };
// src/attend.js
const attDays = (c, from, to) => Object.keys((c && c.att) || {}).filter(d => attRec(c, d) && (!from || d >= from) && (!to || d <= to)).sort();
// src/attend.js
function attCount(c, n, days) { const o = { p: 0, l: 0, e: 0, a: 0 }; for (const d of days) o[attOf(c, d, n)]++; return o; }
// src/attend.js
function attDayCount(c, d) { const o = { p: 0, l: 0, e: 0, a: 0 }; for (const n of c.names) o[attOf(c, d, n) || 'p']++; return o; }
// src/attend.js
function attSet(c, d, n, way, note) {
  if (!c || !attDayOk(d) || !c.names.includes(n)) return false;
  const was = attRec(c, d), r = { t: Date.now(), m: { ...((was && was.m) || {}) }, n: { ...((was && was.n) || {}) } };
  if (way) { if (way === 'p' || !ATT_WORD[way]) delete r.m[n]; else r.m[n] = way; }
  if (note !== undefined) { const s = String(note || '').trim().slice(0, 120); if (s) r.n[n] = s; else delete r.n[n]; }
  if (!Object.keys(r.n).length) delete r.n;
  (c.att ||= {})[d] = r; saveLib(); return true;
}
// src/attend.js
function attTake(c, d) { if (!c || !attDayOk(d) || attRec(c, d)) return; (c.att ||= {})[d] = { t: Date.now(), m: {} }; saveLib(); }
// src/attend.js
function attClear(c, d) { if (!c || !c.att || !c.att[d]) return; c.att[d] = { t: Date.now(), off: 1 }; saveLib(); }
// src/attend.js
function keepAtt(c, was, oldInfo) {
  if (!c.att) return;
  for (const n of (was || []).filter(n => !c.names.includes(n))) {
    const d = idDigits(((oldInfo || {})[n] || {}).id), to = d && c.names.find(m => idDigits(infoOf(c, m).id) === d);
    if (!to) continue;
    for (const r of Object.values(c.att)) for (const k of ['m', 'n']) if (r[k] && r[k][n] != null) { if (r[k][to] == null) r[k][to] = r[k][n]; delete r[k][n]; }
  }
}
// src/attend.js
function attMeets(c) {
  if (!plan) return null;
  const nk = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''), k = nk(c.name), pc = k && plan.classes.find(x => nk(x.name) === k);
  return pc && pc.meets.length ? { dows: new Set(pc.meets.map(m => m.dow)), off: new Set(plan.daysOff.map(x => x.date)) } : null;
}
// src/attend.js
function attStep(c, d, dir) {
  const m = attMeets(c), t = new Date(d + 'T12:00:00');
  for (let i = 0; i < 90; i++) { t.setDate(t.getDate() + dir); const x = isoDay(t); if (!m || (m.dows.has(t.getDay()) && !m.off.has(x)) || attRec(c, x)) return x; }
  return isoDay(new Date(new Date(d + 'T12:00:00').getTime() + dir * 864e5));
}
// src/attend.js
const attUnknown = (c, days) => days.flatMap(d => c.names.filter(n => attOf(c, d, n) === 'a').map(n => ({ d, n }))).reverse();
// src/goals.js
function goalList() { return Array.isArray(lib.goals) ? lib.goals.filter(g => g && g.id && String(g.name || '').trim()) : []; }
// src/goals.js
function goalCell(d, g, p) {
  if (!g || !p || p.status === 'missing' || p.status === 'excused' || g.outAvg) return null;
  const s = setupOver(d.setup), rub = s.mode === 'rubric', out = {};
  const max = setupMax(s);
  const put = (id, got, of, part) => { if (!id || !(of > 0) || got == null || isNaN(+got)) return; const e = out[id] ||= { got: 0, of: 0, parts: [] }; e.got += +got; e.of += of; if (!e.parts.includes(part)) e.parts.push(part); };
  const qs = !rub && d.quiz && Array.isArray(d.quiz.qs) ? d.quiz.qs : [], q = g.q || {};
  if (rub) s.criteria.forEach((c, i) => put(s.goals && s.goals[i], (g.rubric || [])[i], rowTop(s, i), String(c)));
  else if (qs.some(x => q[x.id] != null)) qs.forEach((x, i) => put(x.goal || d.goal, q[x.id], +x.pts || 0, 'Question ' + ((x.lab || '').trim() || String(i + 1))));
  else if (d.goal && p.pct != null && !p.partial) out[d.goal] = { got: p.total != null ? p.total : p.pct, of: p.total != null && p.max ? p.max : 100, pct: p.pct, parts: ['The whole score'] };
  for (const e of Object.values(out)) if (e.pct == null) { const share = Math.max(0, Math.min(1, e.got / e.of)), v = max ? percentWith(share * max, max, s.scale) : null; e.pct = v == null ? share * 100 : Math.max(0, v); }
  return Object.keys(out).length ? out : null;
}
// src/goals.js
const GOAL_LOW = 70;
// src/goals.js
function goalData(c, cols) {
  const use = cols.filter(x => x.type !== 'fm' && x.type !== 'xc');
  return goalList().map(g => {
    const per = new Map(), from = [];
    for (const col of use) {
      const parts = []; let n = 0;
      for (const nm of c.names) {
        const cell = col.cells.get(nm), e = cell && cell.goals && cell.goals[g.id]; if (!e) continue;
        n++; for (const p of e.parts) if (!parts.includes(p)) parts.push(p);
        if (!per.has(nm)) per.set(nm, []); per.get(nm).push({ col, pct: e.pct, got: e.got, of: e.of });
      }
      if (n) from.push({ col, parts, n });
    }
    const stu = new Map(); for (const [nm, list] of per) stu.set(nm, bkMean(list.map(x => x.pct)));
    const inAvg = c.names.filter(nm => stu.has(nm) && bkIn(nm)), low = inAvg.filter(nm => roundPct(stu.get(nm)) < GOAL_LOW);
    return { g, per, stu, from, avg: inAvg.length ? bkMean(inAvg.map(nm => stu.get(nm))) : null, n: inAvg.length, low };
  }).filter(x => x.from.length);
}
// src/ib.js
const IB_TOP = 8;
// src/ib.js
const IB_BANDS = [[1, 2, 'limited'], [3, 4, 'adequate'], [5, 6, 'substantial'], [7, 8, 'excellent']];
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
const IB_WAYS = [
  ['', 'Points and percent', 'Rubrics, points, a percent and a term average.'],
  ['myp', 'IB MYP', 'Criteria marked 0 to 8, a best-fit level each term, a 1 to 7 grade.'],
  ['dp', 'IB DP', 'Marks for each component, turned into 1 to 7 by your boundaries.'],
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
// src/ib.js
const ibLevel = v => v === '' || v == null || isNaN(v) || +v < 0 || +v > IB_TOP || Math.round(+v) !== +v ? null : +v;
// src/ib.js
const ibBandName = v => { const b = IB_BANDS.find(b => v >= b[0] && v <= b[1]); return b ? b[2] : ''; };
// src/ib.js
function ibTerm(levels, crit, bounds) {
  const lv = crit.map(x => ibLevel((levels || {})[x.k])), need = crit.filter((x, i) => lv[i] == null).map(x => x.k);
  if (need.length) return { total: null, grade: null, need, set: crit.length - need.length };
  const total = lv.reduce((a, b) => a + b, 0);
  return { total, grade: ibGradeOf(total, bounds), need, set: crit.length };
}
// src/ib.js
function ibEvidence(list) {
  const ev = (list || []).filter(e => e && ibLevel(e.v) != null).sort((a, b) => (a.t || 0) - (b.t || 0));
  if (!ev.length) return { n: 0, hint: null, last: null, high: null };
  return { n: ev.length, hint: ev[ev.length - 1].v, last: ev[ev.length - 1].v, high: Math.max(...ev.map(e => e.v)) };
}
// src/ib.js
function classNewWay() { const g = meGrade(); return (g && g.way === 'myp') || /^\s*(ib\s*)?myp\b/i.test(me().prog || '') ? { way: 'myp' } : {}; }   // me().prog: the programme My setup brought in (setupin.js)
// src/ib.js
function ibConf(c, conf) { const w = classWay(c) === 'dp' && c.ib && c.ib.w && typeof c.ib.w === 'object' ? c.ib.w : null; return w ? { ...conf, w: { ...conf.w, ...w } } : conf; }
// src/ib.js
function ibPredOf(c, name, term) { const p = ((c.pred || {})[term == null ? ibTermKey() : term] || {})[name]; return p && Number.isInteger(p.g) && p.g >= 1 && p.g <= 7 ? p.g : null; }
// src/ib.js
const ibTermKey = () => bk.term == null ? '' : bk.term;
// src/ib.js
function ibCols(c, cols) {
  const keys = new Set(ibCrit(c).map(x => x.k));
  return cols.map(col => {
    const cells = new Map(); let crit = [];
    if (col.typed && col.typed.lv) {
      crit = ((col.it && col.it.crit) || []).filter(k => keys.has(k));
      for (const n of c.names) { const r = col.typed.s && col.typed.s[n]; if (!r) continue; const lv = {}; for (const k of crit) { const v = ibLevel((r.l || {})[k]); if (v != null) lv[k] = v; } if (Object.keys(lv).length || r.st) cells.set(n, { lv, st: r.st || '' }); }
    } else if (col.d && col.d.setup && Array.isArray(col.d.setup.ib)) {
      const d = col.d, rows = d.setup.ib, pairs = rosterPairs(c.names, Object.keys(d.s || {}));
      crit = rows.filter(k => keys.has(k));
      for (const n of c.names) { const k = pairs.get(n), g = k && d.s[k] && d.s[k].g; if (!g) continue; const lv = {}; rows.forEach((ck, i) => { const v = ibLevel((g.rubric || [])[i]); if (keys.has(ck) && v != null) lv[ck] = v; });
        const st = g.status === 'missing' || g.status === 'excused' ? g.status : ''; if (Object.keys(lv).length || st) cells.set(n, { lv, st }); }
    } else return null;
    return { key: col.key, name: col.name, due: col.due, fm: col.type === 'fm', crit, cells, typed: !!(col.typed && col.typed.lv), t: Date.parse((col.due || '1970-01-01') + 'T12:00:00') || 0 };
  }).filter(Boolean);
}
// src/ib.js
const ibEvFor = (icols, name, k) => icols.filter(x => x.cells.has(name) && x.cells.get(name).lv[k] != null).map(x => ({ v: x.cells.get(name).lv[k], t: x.t, name: x.name, fm: x.fm }));
// src/ib.js
function ibMid(list) { const v = list.filter(x => x != null).sort((a, b) => a - b), n = v.length; if (!n) return null; const a = v[Math.floor((n - 1) / 2)], b = v[Math.ceil((n - 1) / 2)]; return a === b ? String(a) : a + ' to ' + b; }
// src/ib.js
const ibLvAt = (c, term, name) => ((c.lv || {})[term == null ? ibTermKey() : term] || {})[name] || {};
// src/ib.js
function ibRptFacts(c, cols, n, term, said) {
  const crit = ibCrit(c), icols = ibCols(c, cols), lv = ibLvAt(c, term, n), r = ibTerm(lv, crit, ibBounds(c)), g = r.grade;
  const at = crit.map(x => { const v = ibLevel(lv[x.k]); return { name: x.name, avg: v != null ? v : ibEvidence(ibEvFor(icols, n, x.k)).last }; }).filter(x => x.avg != null).sort((a, b) => b.avg - a.avg);
  const apart = at.length >= 2 && at[0].avg - at[at.length - 1].avg >= 1;
  return { grade: g, soFar: false, band: g == null ? 'None' : g >= 6 ? 'High' : g === 5 ? 'Good' : g >= 3 ? 'Mid' : 'Low', gradeText: g != null ? g + ' out of 7' : '',
    chip: g != null ? 'Grade ' + g + ' · total ' + r.total + ' of ' + crit.length * IB_TOP : r.set ? r.set + ' of ' + crit.length + ' criteria set' : 'No levels set yet',
    strong: apart ? at[0] : null, weak: apart ? at[at.length - 1] : null, words: '', move: 0, best: '', said,
    missing: icols.filter(x => (x.cells.get(n) || {}).st === 'missing').map(x => x.name), scored: icols.filter(x => x.cells.has(n) && Object.keys(x.cells.get(n).lv).length).length };
}
// src/mbentry.js
const MB_ORDERS = [['', 'Roster order'], ['last', 'Last name'], ['first', 'First name']];
// src/mbentry.js
function mbParts(n) {
  const s = String(n).trim(), c = s.indexOf(',');
  if (c > 0) return { first: s.slice(c + 1).trim(), last: s.slice(0, c).trim() };
  const w = s.split(/\s+/); return { first: w[0], last: w.length > 1 ? w[w.length - 1] : '' };
}
// src/mbentry.js
function mbSorted(names, how) {
  const idx = names.map((n, i) => i);
  if (!how || anonOn()) return idx;
  const key = i => { const p = mbParts(names[i]); return how === 'last' ? [p.last, p.first] : [p.first, p.last]; };
  return idx.sort((a, b) => { const x = key(a), y = key(b); return x[0].localeCompare(y[0], undefined, { sensitivity: 'base' }) || x[1].localeCompare(y[1], undefined, { sensitivity: 'base' }) || a - b; });
}
// src/reports.js
const RPT_LEN = [['short', 'Short'], ['medium', 'Medium'], ['long', 'Long']];
// src/reports.js
const RPT_WORDS = {
  openHigh: ['{name} has had an excellent term{in}.', '{name} has worked to a very high standard{in} this term.', 'This has been a very strong term{in} for {name}.'],
  openGood: ['{name} has had a good term{in}.', '{name} has made solid progress{in} this term.', 'This has been a positive term{in} for {name}.'],
  openMid: ['{name} has had a mixed term{in}.', '{name} has shown what {they} can do at times{in} this term.', 'This has been an uneven term{in} for {name}.'],
  openLow: ['{name} has found this term{in} difficult.', 'This has been a challenging term{in} for {name}.'],
  openNone: ['{name} has not yet finished enough work{in} this term for a grade.'],
  grade: ['{Their} term grade is {grade}.'],
  strong: ['{Their} strongest area is {row}.', '{They} {is} at {their} best in {row}.', '{row} has been a real strength.'],
  best: ['{Their} best piece of work was {work}.', '{work} showed what {they} can do.'],
  up: ['{Their} recent work shows clear improvement.', '{They} {has} improved steadily over the term.'],
  down: ['{Their} most recent scores have been lower than earlier in the term.', 'Recent work has not matched what {they} did earlier in the term.'],
  next: ['The next step is to work on {row}.', '{They} should now focus on {row}.', 'More attention to {row} will lift {their} work.'],
  level: ['To move up in {row}, the aim is: {words}.'],
  missing1: ['{They} still {has} one piece of work to hand in: {list}.'],
  missing: ['{They} still {has} {n} pieces of work to hand in: {list}.'],
  closeHigh: ['Well done, {name}.', '{They} should be proud of this term.'],
  closeGood: ['With the same effort next term, {they} can go further.', 'Keep it up, {name}.'],
  closeMid: ['Steady effort on this next term will make a real difference.', 'A consistent routine next term will help {them} show {their} best work more often.'],
  closeLow: ['Regular practice, and asking for help early, will make a difference next term.', 'I would like {name} to ask for help as soon as something is unclear.'],
};
// src/reports.js
const RPT_SLOTS = [['openHigh', 'Opening, for the highest grades'], ['openGood', 'Opening, for good grades'], ['openMid', 'Opening, for middling grades'], ['openLow', 'Opening, for the lowest grades'], ['openNone', 'Opening, when there is no grade yet'],
  ['grade', 'The grade'], ['strong', 'Strongest rubric row'], ['best', 'Best piece of work'], ['up', 'Scores going up'], ['down', 'Scores going down'], ['next', 'Rubric row to work on'], ['level', 'What the next level asks for'],
  ['missing1', 'One piece of work missing'], ['missing', 'Several pieces missing'], ['closeHigh', 'Closing, for the highest grades'], ['closeGood', 'Closing, for good grades'], ['closeMid', 'Closing, for middling grades'], ['closeLow', 'Closing, for the lowest grades']];
// src/reports.js
const RPT_PRO = { they: ['they', 'them', 'their', 'are', 'have', ''], she: ['she', 'her', 'her', 'is', 'has', 's'], he: ['he', 'him', 'his', 'is', 'has', 's'] };
// src/reports.js
const RPT_PROS = [['they', 'they / their'], ['she', 'she / her'], ['he', 'he / his'], ['name', 'No pronoun: use the name']];
// src/reports.js
function rptConf() {
  const r = (lib.book && lib.book.rep) || {}, cut = Array.isArray(r.cut) && r.cut.length === 3 && r.cut.every(v => isFinite(+v)) ? r.cut.map(Number) : [85, 70, 55];
  return { len: RPT_LEN.some(x => x[0] === r.len) ? r.len : 'medium', grade: !!r.grade, limit: +r.limit > 0 ? Math.round(+r.limit) : 0, cut, words: r.words || {}, subj: r.subj || {} };
}
// src/reports.js
const rptTerm = () => bk.term === '*' ? 'year' : bk.term || 'all';
// src/reports.js
function rptCall(c, n) {
  const own = (infoOf(c, n).call || '').trim(); if (own) return own;
  const t = String(n), part = /,/.test(t) ? t.split(',').slice(1).join(' ') : t;
  return (part.trim().split(/\s+/)[0] || t).trim();
}
// src/reports.js
const rptPro = (c, n) => { const p = infoOf(c, n).pro; return RPT_PROS.some(x => x[0] === p) ? p : 'they'; };
// src/reports.js
const rptEntry = (c, n) => ((infoOf(c, n).rep || {})[rptTerm()]) || {};
// src/reports.js
function rptPut(c, n, patch, term) {
  const key = term || rptTerm(), rep = { ...(infoOf(c, n).rep || {}) }, e = { ...(rep[key] || {}), ...patch };
  for (const k of Object.keys(e)) if (e[k] == null || e[k] === false || e[k] === 0) delete e[k];
  if (Object.keys(e).some(k => k !== 't')) rep[key] = e; else delete rep[key];
  setInfo(c, n, { rep: Object.keys(rep).length ? rep : '' });
  bkSaveLib();
}
// src/reports.js
const rptPairs = new WeakMap();
// src/reports.js
function rptSaid(c, cols, n) {
  const said = [];
  for (const col of cols) {
    if (!col.d || !col.d.s) continue;
    let pairs = rptPairs.get(col); if (!pairs) rptPairs.set(col, pairs = rosterPairs(c.names, Object.keys({ ...col.d.s, ...col.d.read })));
    const k = pairs.get(n), t = k && col.d.s[k] && col.d.s[k].g ? String(col.d.s[k].g.comment || '').trim() : '';
    if (t) said.push({ work: col.name, text: t });
  }
  return said;
}
// src/reports.js
function rptFacts(c, cols, conf, n, term) {
  // an MYP class has levels and a 1 to 7, never a percent (ib.js)
  if (classWay(c) === 'myp') return ibRptFacts(c, cols, n, term, rptSaid(c, cols, n));
  const g = bkGrade(n, cols, conf), scored = bkScored(cols).map(col => ({ col, cell: col.cells.get(n) })).filter(x => bkCounts(x.cell));
  const rows = new Map(), T = chRowTop(scored.map(x => x.col));   // rows on different scales are put on the one most of them use
  for (const { col, cell } of scored) for (const [nm, v0, t] of cell.rows || []) {
    const v = (t || ROW_TOP) !== T && v0 != null ? +v0 * T / (t || ROW_TOP) : v0;
    const name = chRowName(nm), k = name.toLowerCase(); if (!k || v == null || isNaN(+v)) continue;
    if (!rows.has(k)) rows.set(k, { name, v: [] });
    const e = rows.get(k); e.v.push(+v); e.col = col; e.raw = nm;
  }
  const avg = [...rows.values()].map(e => ({ ...e, avg: bkMean(e.v) })).sort((a, b) => b.avg - a.avg);
  // A strongest and a weakest row only when they really differ: a quarter of a point across the term.
  const apart = avg.length >= 2 && avg[0].avg - avg[avg.length - 1].avg >= 0.25 * T / ROW_TOP, strong = apart ? avg[0] : null, weak = apart ? avg[avg.length - 1] : null;
  let words = '';
  if (weak && weak.col.d) {   // her own words for the level above where the student is now, from the newest rubric with that row
    const s = weak.col.d.setup || {}, i = (s.criteria || []).findIndex(x => chRowName(x).toLowerCase() === weak.name.toLowerCase());
    if (i >= 0) words = String(levelIn(s, i, Math.min(rowTop(s, i), Math.floor(weak.avg * rowTop(s, i) / T + 1e-9) + 1)) || '').trim().replace(/[.。]+$/, '');
  }
  const v = scored.map(x => x.cell.pct), move = v.length >= 4 ? bkMean(v.slice(-3)) - bkMean(v.slice(0, -3)) : 0;
  const missing = cols.filter(x => x.type !== 'xc' && (x.cells.get(n) || {}).st === 'missing').map(x => x.name);
  const best = scored.length >= 2 ? scored.reduce((a, b) => b.cell.pct > a.cell.pct ? b : a) : null;
  const said = rptSaid(c, cols, n);
  return { grade: g.grade, soFar: g.soFar, strong, weak, words, move, missing, best: best && best.cell.pct >= 70 ? best.col.name : '', said, scored: scored.length };
}
// src/reports.js
const rptHash = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
// src/reports.js
const rptList = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
// src/reports.js
function rptFill(t, c, n, f, rc) {
  const call = rptCall(c, n), pro = rptPro(c, n), P = RPT_PRO[pro] || [call, call, call + '’s', 'is', 'has', 's'], subj = (rc.subj[c.id] || '').trim();
  const map = { name: call, they: P[0], them: P[1], their: P[2], is: P[3], has: P[4], s: P[5], in: subj ? ' in ' + subj : '', subject: subj, grade: f.gradeText != null ? f.gradeText : f.grade != null ? roundPct(f.grade) + '%' : '',
    row: '', work: f.best, n: String(f.missing.length), list: rptList(f.missing), words: f.words };
  const out = t.replace(/\{(\w+)\}/g, (m, k) => {
    const low = k[0].toLowerCase() + k.slice(1); if (!(low in map)) return m;
    const v = String(map[low]); return k !== low && v ? v[0].toUpperCase() + v.slice(1) : v;
  });
  return out.replace(/\s+([.,;:!?])/g, '$1').replace(/\s{2,}/g, ' ').trim().replace(/^./, ch => ch.toUpperCase());
}
// src/reports.js
function rptDraft(c, n, f, rc, v) {
  const band = f.band ? f.band : f.grade == null ? 'None' : f.grade >= rc.cut[0] ? 'High' : f.grade >= rc.cut[1] ? 'Good' : f.grade >= rc.cut[2] ? 'Mid' : 'Low';
  const say = (k, row) => { const own = (rc.words[k] || []).filter(Boolean), list = own.length ? own : RPT_WORDS[k]; return rptFill(list[(rptHash(n + k) + (v || 0)) % list.length].replace(/\{row\}/g, row || ''), c, n, f, rc); };
  const long = rc.len === 'long', short = rc.len === 'short', out = [say('open' + band)];
  if (rc.grade && f.grade != null) out.push(say('grade'));
  if (!short && f.strong) out.push(say('strong', f.strong.name));
  if (long && f.best) out.push(say('best'));
  if (!short && Math.abs(f.move) >= 5) out.push(say(f.move > 0 ? 'up' : 'down'));
  if (f.weak) out.push(say('next', f.weak.name));
  if (long && f.weak && f.words) out.push(say('level', f.weak.name));
  if (f.missing.length) out.push(say(f.missing.length === 1 ? 'missing1' : 'missing'));
  if (!short && band !== 'None') out.push(say('close' + band));
  return out.join(' ');
}
// src/reports.js
function rptText(c, cols, conf, n, rc) { const e = rptEntry(c, n); return e.text != null ? e.text : rptDraft(c, n, rptFacts(c, cols, conf, n), rc, e.v); }
// src/missing.js
const MIS_WORDS = {
  subj: 'Missing work for {class}',
  body: 'Hi {name},\n\nI still don’t have this work from you for {class}:\n\n{list}\n\nPlease hand it in as soon as you can, or come and see me if you need more time.\n\nThank you',
};
// src/missing.js
function misConf() {
  const m = (lib.book && lib.book.miss) || {};
  return { subj: String(m.subj || '').trim() || MIS_WORDS.subj, body: String(m.body || '').trim() ? m.body : MIS_WORDS.body, cls: m.cls || {} };
}
// src/missing.js
const misClassName = (c, mc) => String(mc.cls[c.id] || '').trim() || c.name;
// src/missing.js
const misCols = cols => cols.filter(x => x.type !== 'xc');
// src/missing.js
const misOwes = (col, n) => (col.cells.get(n) || {}).st === 'missing';
// src/missing.js
function misByStu(c, cols) {
  const list = misCols(cols);
  return c.names.map((n, i) => ({ n, i, cols: list.filter(col => misOwes(col, n)) })).filter(x => x.cols.length);
}
// src/missing.js
function misByCol(c, cols) {
  return misCols(cols).map(col => ({ col, who: c.names.map((n, i) => ({ n, i })).filter(x => misOwes(col, x.n)) })).filter(x => x.who.length);
}
// src/missing.js
const misNudge = (c, n, col) => ((infoOf(c, n).nudge || {})[col.key]) || 0;
// src/missing.js
const misEmail = (c, n) => String(infoOf(c, n).email || '').split(/[;,\s]+/).filter(s => /@/.test(s)).join(',');
// src/missing.js
function misLate(due) {
  if (!due) return 0;
  const d = new Date(due + 'T12:00:00'), now = new Date(isoDay(Date.now()) + 'T12:00:00');
  return isNaN(d) ? 0 : Math.max(0, Math.round((now - d) / 864e5));
}
// src/missing.js
const misDue = col => col.due ? 'Due ' + bkDay(col.due) + (misLate(col.due) ? ' · ' + people(misLate(col.due), 'day') + ' ago' : '') : '';
// src/missing.js
const misLine = col => '- ' + col.name + (col.due ? ' (due ' + bkDay(col.due) + ')' : '');
// src/missing.js
function misFill(t, map) { return String(t).replace(/\{(\w+)\}/g, (m, k) => k in map ? map[k] : m); }
// src/missing.js
function misDraft(c, n, cols, mc) {
  mc = mc || misConf();
  const map = { name: rptCall(c, n), class: misClassName(c, mc), list: cols.map(misLine).join('\n'), n: String(cols.length) };
  return { to: misEmail(c, n), bcc: '', subject: misFill(mc.subj, map), body: misFill(mc.body, map) };
}
// src/missing.js
function misGroup(c, col, who, mc) {
  mc = mc || misConf();
  const map = { name: 'everyone', class: misClassName(c, mc), list: misLine(col), n: '1' };
  return { to: '', bcc: who.map(x => misEmail(c, x.n)).filter(Boolean).join(','), subject: misFill(mc.subj, map), body: misFill(mc.body, map) };
}
// src/missing.js
const misEnc = s => encodeURIComponent(s).replace(/%40/g, '@').replace(/%2C/g, ',');
// src/missing.js
function misHref(m, noBody) {
  const q = [m.bcc ? 'bcc=' + misEnc(m.bcc) : '', 'subject=' + encodeURIComponent(m.subject), noBody ? '' : 'body=' + encodeURIComponent(m.body.replace(/\r?\n/g, '\r\n'))].filter(Boolean).join('&');
  return 'mailto:' + misEnc(m.to) + '?' + q;
}
// src/missing.js
const misPlain = m => (m.to ? 'To: ' + m.to.replace(/,/g, ', ') + '\n' : '') + (m.bcc ? 'Bcc: ' + m.bcc.replace(/,/g, ', ') + '\n' : '') + 'Subject: ' + m.subject + '\n\n' + m.body;
// src/linked.js
function lkKey(s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); }
// src/linked.js
function lkSibs(c) { return c && c !== lib.loose && lkKey(c.course) ? lib.classes.filter(x => x !== c && lkKey(x.course) === lkKey(c.course)) : []; }
// src/linked.js
function lkTwins(it) {
  const out = []; if (!it || !it.group) return out;
  for (const c of holders()) for (const u of c.units) for (const x of u.items) if (x !== it && x.group === it.group) out.push({ c, u, it: x });
  return out;
}
// src/linked.js
function lkCopy(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
// src/linked.js
function lkJoin1(a, b) {
  const g = a.group || b.group || uid(), old = b.group;
  for (const c of holders()) for (const u of c.units) for (const x of u.items) if (old && x.group === old) x.group = g;
  a.group = b.group = g;
}
// src/linked.js
function lkLev(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 9;
  let p = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) { const q = [i]; for (let j = 1; j <= b.length; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = q; }
  return p[b.length];
}
// src/linked.js
function lkLike(a, b, drop) {
  const words = it => { let t = String(it.name || '').normalize('NFKC').toLowerCase().replace(/\s*[([][^)\]]*[)\]]\s*$/, ''); for (const d of drop) if (d) t = t.split(d).join(' '); return t.match(/[\p{L}]+|\p{N}+/gu) || []; };
  const wa = words(a), wb = words(b), ka = wa.join(''), kb = wb.join('');
  if (!ka || !kb) return 0;
  const num = w => w.filter(x => /^\p{N}/u.test(x)).join(' ');
  const odd = (a.type && b.type && a.type !== b.type) || (a.due && b.due && Math.abs(Date.parse(a.due) - Date.parse(b.due)) > 21 * 864e5);
  if (ka === kb) return odd ? 1 : 2;   // the same name, but another type or weeks apart: offered, not ticked
  if (odd || num(wa) !== num(wb)) return 0;
  const la = wa.filter(x => !/^\p{N}/u.test(x)), lb = wb.filter(x => !/^\p{N}/u.test(x)), sb = new Set(lb);
  const dice = la.length + lb.length ? 2 * la.filter(x => sb.has(x)).length / (la.length + lb.length) : 0, ja = la.join(''), jb = lb.join('');
  return dice >= 0.8 || (ja.length > 3 && lkLev(ja, jb) <= Math.max(1, Math.floor(ja.length * 0.15))) ? 1 : 0;
}
// src/linked.js
function lkSuggest(c) {
  const out = [], mine = c.units.flatMap(u => u.items.map(it => ({ u, it })));
  for (const x of lkSibs(c)) {
    const drop = [c.name, x.name, c.course].map(d => String(d || '').normalize('NFKC').toLowerCase().trim()), theirs = x.units.flatMap(u => u.items.map(it => ({ u, it })));
    const inX = new Set(theirs.map(t => t.it.group).filter(Boolean)), inC = new Set(mine.map(m => m.it.group).filter(Boolean)), all = [];
    for (const m of mine) for (const t of theirs) {
      if ((m.it.group && inX.has(m.it.group)) || (t.it.group && inC.has(t.it.group))) continue;
      const k = lkLike(m.it, t.it, drop); if (!k) continue;
      const days = m.it.due && t.it.due ? Math.abs(Date.parse(m.it.due) - Date.parse(t.it.due)) / 864e5 : 99;
      all.push({ a: m.it, b: t.it, x, k, w: k * 1000 + (lkKey(m.u.name) === lkKey(t.u.name) ? 100 : 0) - Math.min(days, 99) });
    }
    all.sort((p, q) => q.w - p.w);
    const used = new Set();
    for (const p of all) {
      if (used.has(p.a) || used.has(p.b)) continue;
      if (all.some(q => q !== p && q.w === p.w && !used.has(q.a) && !used.has(q.b) && (q.a === p.a || q.b === p.b))) { used.add(p.a); used.add(p.b); continue; }
      used.add(p.a); used.add(p.b); out.push(p);
    }
  }
  return out;
}
export { BK_TYPES, bkConf, bkCats, bkType, bkIsType, bkIsDef, bkLabel, bkTermOf, bkMean, bkCellOf, bkTypedCell, bkLoad, bkClassCols, bkCounts, bkGrade, bkXcTo, bkTabs, bkTermNow, bkClassAvg, bkBands, bkGroups, bkCountTypes, pctAvgText, bkParse, bkCellVal, bkColMax, bkPut, typedStamp, isoDay, bkDay, BK_DEF, rosterPairs, bkTypeUse, IB_TOP, IB_BANDS, IB_GROUPS, IB_WAYS, IB_BOUNDS_DP, ibLetter, classWay, ibGroup, ibGroupCrit, ibBoundsFor, ibBoundsClean, ibCrit, ibBounds, ibGradeOf, ibLevel, ibBandName, ibTerm, ibEvidence, ibConf, ibCols, ibEvFor, ibMid, MIS_WORDS, misConf, misCols, misOwes, misByStu, misByCol, misNudge, misLate, misDue, mbParts, mbSorted, MB_ORDERS, parseRosterRows, keepInfo, keepAtt, infoOf, setInfo, blankInfo, attDays, attCount, attOf, attNote, classNewWay, ATT_WAYS, attRec, attDayOk, attSet, attTake, attClear, attDayCount, attUnknown, attMeets, attStep, csvSafe, SEAT_ROOMS, SEAT_MAX_W, SEAT_MAX_H, seatXY, seatKeys, seatRoom, seatOf, seatSave, seatList, seatFill, seatPut, seatSetRoom, pkNice, pkShort, pkShuffle, pkCount, pkGroups, misDraft, misGroup, misHref, misPlain, misEmail, misLine, misFill, misClassName, rptCall, goalList, goalData, GOAL_LOW, RPT_WORDS, RPT_SLOTS, RPT_PROS, RPT_LEN, rptConf, rptEntry, rptPut, rptPro, rptFacts, rptDraft, rptText, bkScored, bkIn, ibLvAt, ibPredOf, lkKey, lkSibs, lkTwins, lkCopy, lkJoin1, lkLev, lkLike, lkSuggest };
export { EMAIL_RX };
