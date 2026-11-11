'use strict';
/* Grading Studio: open a class's papers (a download from the school's system, a folder, scans), mark PDFs, score with a rubric, list grades in folder order,
   and export the marked files back into their student folders.
   Files live in memory only. Marks, scores and comments are kept in this browser's localStorage
   (per download), so the same download can be reopened later. Nothing is uploaded. */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Assignment types, for the Gradebook's term grades (src/book.js): key, full name, short name.
// In the order the gradebook shows them, left to right.
// BK_TYPES is kept as the teacher's own list of types (bkCats in src/book.js); BK_DEF is the usual three, as they start out.
const BK_TYPES = [['ic', 'In-class assessment', 'In-class'], ['sum', 'Summative assessment', 'Summative'], ['fm', 'Formative activity', 'Formative']];
const BK_DEF = BK_TYPES.map(x => x.slice());
let bkCatsSeen;
let libVer = 0;   // goes up each time the units and rosters are saved, so a screen that kept a copy knows it's out of date
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

/* ---------------- light by default, with a switch ---------------- */
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
// A grading scale for a 12-point rubric: the "usual" one offered in Rubric setup. Half points fall halfway between two rows.
const SCALE12 = { 12: 100, 11: 95, 10: 91, 9: 86, 8: 82, 7: 77, 6: 73, 5: 68, 4: 64, 3: 60 };
const RUBRIC_STEPS = [0, 1, 1.5, 2, 2.5, 3, 3.5, 4];
const SCALE_FIVES = { 12: 100, 11: 95, 10: 90, 9: 85, 8: 80, 7: 75, 6: 70, 5: 65, 4: 60, 3: 55, 2: 50, 1: 45, 0: 40 };
// What a new assignment starts with. In a browser from before the welcome it is this, as it always was; a teacher who has said how
// they grade (the welcome, or Settings) gets their own instead: gradeDefaultApply, in library.js, once their answer has been read.
const DEFAULT_SETUP = { mode: 'rubric', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 10, scale: SCALE12 };
let setup = { ...DEFAULT_SETUP, ...store.get('gs.setup', {}) };

function maxPoints() { return setup.mode === 'rubric' ? setup.criteria.length * 4 : +setup.outOf || 0; }
// Uses the grading scale when its top score matches the total possible; half points fall between two rows.
// Percents are whole numbers, with halves rounded up (10.5 between 95 and 90 is 92.5, so 93%), the way a teacher rounds by hand.
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
  if (noScore(st)) return { total: null, pct: null, done: true, status: st.grade.status };   // missing or excused: settled, with no number
  const g0 = scoreOf(st), g = addXc(g0, st.grade.xc, g0.outOf != null ? g0.outOf : maxPoints(), st.grade.xcU), r = st.grade.status === 'late' ? { ...g, status: 'late' } : g;
  return st.grade.outAvg ? { ...r, out: true } : r;   // left out of the average: the score stays and copies, it just isn't counted
}
// Extra credit on one paper (grade.xc, in the assignment's own points) goes on top of the score. The score itself is still read on
// the assignment's scale exactly as before; then each extra point adds its share of the total as percentage points. So 12/15 read as
// 85% on a school's scale, plus 1 extra point, is 85 + 6.67 = 92% (13/15 on the paper). A score can go above 100% this way.
// unit 'pct' (grade.xcU): the extra credit is percentage points on the paper's percent instead, and the total grows by that share of the points.
function addXc(r, xc, max, unit) {
  xc = +xc; if (!xc || isNaN(xc) || r.total == null) return r;
  if (unit === 'pct') return { ...r, total: max ? r.total + Math.round(xc * max) / 100 : r.total, base: r.total, xc, xcU: 'pct', pct: r.pct == null ? r.pct : roundPct(r.pct + xc) };
  return { ...r, total: r.total + xc, base: r.total, xc, pct: r.pct == null || !max ? r.pct : roundPct(r.pct + xc / max * 100) };
}
function scoreOf(st) {
  const own = ownGrade(st);
  if (own.total != null) return own;
  const ty = st.grade.sheet;   // typed on the Grade sheet from the picture, for handwritten grades
  if (ty !== '' && ty != null && !isNaN(+ty)) return { total: +ty, pct: percentFor(+ty), done: true, paper: true };
  if (!st.found || !st.found.found) return own;
  const fd = st.found;   // a grade typed on the paper (Grade sheet), used until she scores it here
  const off = fd.outOf != null && fd.outOf !== maxPoints();   // a confirmed 10/15 is out of 15, and says so wherever it shows
  const pct = fd.pct != null ? fd.pct : off ? percentWith(fd.score, fd.outOf, setup.scale) : percentFor(fd.score);
  return off ? { total: fd.score, pct, done: true, paper: true, outOf: fd.outOf } : { total: fd.score, pct, done: true, paper: true };
}
function ownGrade(st) {
  const g = st.grade;
  if (setup.mode === 'rubric') {
    const sc = setup.criteria.map((_, i) => g.rubric[i]);
    if (sc.every(v => v == null)) return { total: null, pct: null, done: false };
    const total = sc.reduce((a, v) => a + (v || 0), 0);
    return sc.every(v => v != null) ? { total, pct: percentFor(total), done: true } : { total, pct: percentFor(total), done: false, partial: true };
  }
  const t = g.points === '' || g.points == null ? null : +g.points;
  if (t != null && !isNaN(t) && wordPart(st, t)) return { total: t, pct: percentFor(t), done: false, partial: true };
  if (t != null && !isNaN(t) && quizPart(st)) return { total: t, pct: percentFor(t), done: false, partial: true };   // Quick mark with questions still to mark   // from a Word rubric that isn't fully highlighted
  return { total: t, pct: t == null || isNaN(t) ? null : percentFor(t), done: t != null && !isNaN(t) };
}
const fmtNum = n => n == null ? '' : (Math.round(n * 100) / 100).toString();
const fmtPct = p => p == null ? '' : fmtNum(p) + '%';

/* ---------------- state ---------------- */
let batch = null;        // { id, name, students:[...] }
let cur = 0;             // index of the open student
let tool = 'pen';
let once = null, onceEl = null;   // a tool picked from the right-click for one go: { k, prev } (src/stamps.js)
const COLORS = { red: '#D7263D', blue: '#1F5FD1', green: '#1E8A4C', purple: '#7B3FC4', black: '#1B1F27' };
// Every check mark shows in one check color (green unless the teacher picks another), whatever ink is picked, on screen
// and in every export. Checks saved before keep their stored color; they draw in the check color too.
let checkInk = COLORS[store.get('gs.checkInk', 'green')] ? store.get('gs.checkInk', 'green') : 'green';
let CHECK_INK = COLORS[checkInk];
function setCheckInk(k) { if (!COLORS[k]) return; checkInk = k; CHECK_INK = COLORS[k]; store.set('gs.checkInk', k); }
const HL = { yellow: '#FFE45C', green: '#B4F0A8', pink: '#FFB8D6', blue: '#B0E0FF' };
let inkColor = store.get('gs.ink', 'red'), hlColor = store.get('gs.hl', 'yellow'), penW = store.get('gs.penW', 2);
const DISP0 = { ui: 1, tsize: 14, fit: 'width', dfs: 15, dlh: 1.45, trim: true };
let disp = { ...DISP0, ...store.get('gs.disp', {}) };   // Display panel: app text size, new text box size, paper fit, Word doc text
let zoom = store.get('gs.zoom', 1);
let undoStack = [];
let selected = null;     // { page, mark }
let bank = store.get('gs.bank', []);   // the teacher's saved comments (their own words, no student data)

