/* ---------------- IB classes: MYP criteria and levels, DP boundaries (11/11) ---------------- */
// Each class says how it is graded: c.way is 'myp' or 'dp'; absent is points and percent, as every class was before, so saved work
// from before has nothing new in it. What an IB class needs lives in c.ib:
//   MYP: { group, crit: [{ k: 'A', name }], bounds: [[lowest total, grade]…] highest first }
//   DP:  { bounds: [[lowest percent, grade]…] highest first }
// What the app ships with is only this: the letter and name of each criterion, the 0 to 8 scale with its four band names, and the
// published table that turns a total of the four levels into 1 to 7. Every one of them is the teacher's to change. None of the IB's
// descriptor wording, markbands or DP boundaries is here: those are the IB's own text and numbers, and a teacher pastes their own.
const IB_TOP = 8;
const IB_BANDS = [[1, 2, 'limited'], [3, 4, 'adequate'], [5, 6, 'substantial'], [7, 8, 'excellent']];
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
// The published MYP table for four criteria: the lowest total of 32 that earns each grade.
const IB_BOUNDS_32 = [[28, 7], [24, 6], [19, 5], [15, 4], [10, 3], [6, 2], [1, 1]];
// A starting table for a DP class. Made-up round numbers, not any subject's: the teacher types in their own.
const IB_BOUNDS_DP = [[80, 7], [68, 6], [56, 5], [44, 4], [32, 3], [18, 2], [0, 1]];
const IB_WAYS = [
  ['', 'Points and percent', 'Rubrics, points, a percent and a term average.'],
  ['myp', 'IB MYP', 'Criteria marked 0 to 8, a best-fit level each term, a 1 to 7 grade.'],
  ['dp', 'IB DP', 'Marks for each component, turned into 1 to 7 by your boundaries.'],
];
const ibLetter = i => String.fromCharCode(65 + i);
// These three are plain functions, not consts: a page opened straight on a class draws its head before this file has run.
function classWay(c) { return c && (c.way === 'myp' || c.way === 'dp') ? c.way : ''; }
const ibGroup = k => IB_GROUPS.find(g => g[0] === k) || null;
const ibGroupCrit = k => (ibGroup(k) || IB_GROUPS[IB_GROUPS.length - 1])[2].map((name, i) => ({ k: ibLetter(i), name }));
// For a subject with another number of criteria no table is published, so the four-criterion one is scaled to its top total.
// It is only somewhere to start: the class's own table is shown beside it and every number can be typed over.
function ibBoundsFor(n) {
  if (n === 4) return IB_BOUNDS_32.map(b => b.slice());
  const top = n * IB_TOP; let last = top + 1;
  return IB_BOUNDS_32.map(([lo, g]) => { const v = Math.max(g === 1 ? 1 : 2, Math.min(last - 1, Math.round(lo * top / 32))); last = v; return [v, g]; });
}
// A table as it was saved, tidied: numbers only, highest first, one row per grade. Anything unusable reads as the starting table.
function ibBoundsClean(b, def) {
  const rows = Array.isArray(b) ? b.filter(r => Array.isArray(r) && isFinite(+r[0]) && r[0] !== '' && r[0] != null && isFinite(+r[1])).map(r => [+r[0], +r[1]]) : [];
  const seen = new Set(), out = rows.sort((a, c) => c[1] - a[1]).filter(r => !seen.has(r[1]) && seen.add(r[1]));
  for (let i = 1; i < out.length; i++) if (out[i][0] >= out[i - 1][0]) return def.map(r => r.slice());
  return out.length >= 2 ? out : def.map(r => r.slice());
}
// The criteria of an MYP class, in order: [{ k, name }]. A class with none saved reads as its subject group's.
function ibCrit(c) {
  const ib = c && c.ib || {}, own = Array.isArray(ib.crit) ? ib.crit.filter(x => x && String(x.k || '').trim()).map(x => ({ k: String(x.k).trim().slice(0, 2), name: String(x.name || '').trim().slice(0, 80) })) : [];
  return own.length ? own : ibGroupCrit(ib.group);
}
function ibBounds(c) {
  if (classWay(c) === 'dp') return ibBoundsClean(c.ib && c.ib.bounds, IB_BOUNDS_DP);
  return ibBoundsClean(c && c.ib && c.ib.bounds, ibBoundsFor(ibCrit(c).length));
}
// The grade a number earns on a table: the first boundary it reaches. Below the lowest boundary there is no grade.
function ibGradeOf(v, bounds) { if (v == null || v === '' || isNaN(v)) return null; const b = bounds.find(r => +v >= r[0]); return b ? b[1] : null; }
// A whole level from 0 to the top, or null.
const ibLevel = v => v === '' || v == null || isNaN(v) || +v < 0 || +v > IB_TOP || Math.round(+v) !== +v ? null : +v;
const ibBandName = v => { const b = IB_BANDS.find(b => v >= b[0] && v <= b[1]); return b ? b[2] : ''; };
// A term for one student of an MYP class. levels: { A: 6, B: 5 … } as the teacher set them. The total and the grade exist only
// once every criterion has a level: a missing one is never counted as 0 and never filled in from the others.
function ibTerm(levels, crit, bounds) {
  const lv = crit.map(x => ibLevel((levels || {})[x.k])), need = crit.filter((x, i) => lv[i] == null).map(x => x.k);
  if (need.length) return { total: null, grade: null, need, set: crit.length - need.length };
  const total = lv.reduce((a, b) => a + b, 0);
  return { total, grade: ibGradeOf(total, bounds), need, set: crit.length };
}
// What the evidence for one criterion looks like, for the teacher to judge from: [{ v, t }] in any order.
// The hint is the most recent level, shown beside the buttons and never written anywhere by itself.
function ibEvidence(list) {
  const ev = (list || []).filter(e => e && ibLevel(e.v) != null).sort((a, b) => (a.t || 0) - (b.t || 0));
  if (!ev.length) return { n: 0, hint: null, last: null, high: null };
  return { n: ev.length, hint: ev[ev.length - 1].v, last: ev[ev.length - 1].v, high: Math.max(...ev.map(e => e.v)) };
}
// A new class starts the way its teacher grades: MYP for a teacher who said so in the welcome or Settings, else points and percent.
function classNewWay() { const g = meGrade(); return (g && g.way === 'myp') || /^\s*(ib\s*)?myp\b/i.test(me().prog || '') ? { way: 'myp' } : {}; }   // me().prog: the programme My setup brought in (setupin.js)
function ibPill(c) { const w = classWay(c); return w ? '<span class="ibpill" title="' + (w === 'myp' ? 'This class is graded with IB MYP criteria' : 'This class is graded as an IB DP class') + '">' + (w === 'myp' ? 'MYP' : 'DP') + '</span>' : ''; }
function ibClassItem(c, ci) { return '<button class="mitem" data-ib-class="' + ci + '">Grading<small>Points and percent, or IB criteria</small></button>'; }

// A DP class's term grade: the 1 to 7 its percent earns on the class's own boundaries, shown after the percent. '' for any other class.
// With a student's name, the grade the teacher predicted for the term that is on follows it.
function ibDpSay(pct, c, name) {
  if (classWay(c) !== 'dp') return '';
  const g = pct == null ? null : ibGradeOf(roundPct(pct), ibBounds(c)), p = name == null ? null : ibPredOf(c, name);
  return (g == null ? '' : ' <b class="ibg7" title="On this class’s boundaries">' + g + '</b>') + (p == null ? '' : ' <small class="ibpred" title="The grade you predicted">predicted ' + p + '</small>');
}
// A DP class can weigh its components (the types of work: Paper 1, Paper 2, the internal assessment) its own way:
// c.ib.w = { type id: weight }. Every other class, and a DP class with none, uses the teacher's usual weights.
function ibConf(c, conf) { const w = classWay(c) === 'dp' && c.ib && c.ib.w && typeof c.ib.w === 'object' ? c.ib.w : null; return w ? { ...conf, w: { ...conf.w, ...w } } : conf; }
// The grade a teacher predicts for a student of a DP class: c.pred[term][name] = { g: 1 to 7, t } ('' with no terms, '*' for the
// whole year). It is hers alone: the worked-out grade is only a hint beside it. A cleared one keeps its time, so a merge knows.
function ibPredOf(c, name, term) { const p = ((c.pred || {})[term == null ? ibTermKey() : term] || {})[name]; return p && Number.isInteger(p.g) && p.g >= 1 && p.g <= 7 ? p.g : null; }
function ibPredSet(c, name, g) { const t = ibTermKey(); c.pred ||= {}; c.pred[t] ||= {}; c.pred[t][name] = g == null ? { t: Date.now() } : { g, t: Date.now() }; bkSaveLib(); }
// A DP student's grade tile on a progress sheet: the 1 to 7 the percent earns, and the predicted grade when there is one.
function ibDpTile(c, pct, name, term) { if (classWay(c) !== 'dp') return ''; const g = pct == null ? null : ibGradeOf(roundPct(pct), ibBounds(c)), p = ibPredOf(c, name, term); return [g != null ? 'IB grade ' + g : '', p != null ? 'predicted ' + p : ''].filter(Boolean).join(' · '); }

/* ---------- how this class is graded: the box behind the Grading button on a class ---------- */
let ibDraft = null;
function ibDlg(ci) {
  const c = lib.classes[ci]; if (!c) return;
  const way = classWay(c), ib = c.ib || {};
  ibDraft = { ci, way, group: ibGroup(ib.group) ? ib.group : 'own', crit: way === 'myp' ? ibCrit(c) : ibGroupCrit(ibGroup(ib.group) ? ib.group : 'sci'), mypB: way === 'myp' ? ibBounds(c) : null, dpB: way === 'dp' ? ibBounds(c) : IB_BOUNDS_DP.map(r => r.slice()), fresh: way !== 'myp',
    dpW: Object.fromEntries(bkCats().filter(t => t[0] !== 'fm').map(t => [t[0], +((way === 'dp' && ib.w && ib.w[t[0]] != null ? ib.w : bkConf().w)[t[0]]) || 0])) };
  if (ibDraft.fresh) ibDraft.group = 'sci';
  openDlg('<div class="bh"><h2>How ' + esc(c.name) + ' is graded</h2></div><div class="bb" id="ibBody"></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Save</button></div>');
  ibDlgDraw();
  $('#dlgBox').onclick = ibDlgClick; $('#dlgBox').onchange = ibDlgChange; $('#dlgBox').oninput = ibDlgInput;
}
function ibDlgDraw() {
  const d = ibDraft, el = $('#ibBody'); if (!d || !el) return;
  let h = '<div class="ibways" role="radiogroup" aria-label="How this class is graded">' + IB_WAYS.map(([k, t, s]) => '<button class="wlway' + (d.way === k ? ' on' : '') + '" role="radio" aria-checked="' + (d.way === k) + '" data-ibway="' + k + '"><b>' + t + '</b><span>' + s + '</span></button>').join('') + '</div>';
  if (d.way === 'myp') {
    const b = d.mypB || ibBoundsFor(d.crit.length), top = d.crit.length * IB_TOP;
    h += '<div class="ibcols"><div><div class="field"><label for="ibGroup">Subject group</label><select id="ibGroup">' + IB_GROUPS.map(g => '<option value="' + g[0] + '"' + (d.group === g[0] ? ' selected' : '') + '>' + esc(g[1]) + '</option>').join('') + '</select></div>' +
      '<p class="ibcap"><b>Criteria</b> <span class="muted">Each is marked 0 to ' + IB_TOP + '. The names are yours to change.</span></p>' +
      d.crit.map((x, i) => '<div class="ibcrit"><b>' + esc(x.k) + '</b><input type="text" data-ibcrit="' + i + '" value="' + esc(x.name) + '" maxlength="80" aria-label="Name of criterion ' + esc(x.k) + '">' +
        '<button class="icon" data-ibcut="' + i + '" title="Remove criterion ' + esc(x.k) + '" aria-label="Remove criterion ' + esc(x.k) + '"' + (d.crit.length > 1 ? '' : ' disabled') + '>×</button></div>').join('') +
      (d.crit.length < 6 ? '<button class="link" data-ibadd>+ Add a criterion</button>' : '') + '</div>' +
      '<div><p class="ibcap"><b>Grade boundaries</b> <span class="muted">The lowest total of ' + top + ' for each grade.</span></p>' + ibBoundRows(b, top) +
      '<p class="muted ibnote">' + (d.crit.length === 4 ? 'These start as the published MYP boundaries. Change them if your school uses others.' : 'No table is published for ' + d.crit.length + ' criteria, so these are scaled from the four-criterion one. Check them against your school’s.') + '</p></div></div>' +
      '<p class="muted ibnote">The app holds the names of the criteria and these boundaries, nothing else from the IB. Descriptors are yours to paste in.</p>';
  } else if (d.way === 'dp') {
    h += '<div class="ibcols"><div><p class="ibcap"><b>Grade boundaries</b> <span class="muted">The lowest percent for each grade.</span></p>' + ibBoundRows(d.dpB, 100) +
      '<p class="muted ibnote">These numbers are only somewhere to start, and are not any subject’s own. Type in the boundaries your subject and level use; they are different for each subject and can change with each exam session.</p></div>' +
      '<div><p class="ibcap"><b>Components</b> <span class="muted">How much each type of work counts in this class.</span></p><div class="ibbounds" id="ibComps">' +
      bkCats().filter(t => t[0] !== 'fm').map(t => '<label class="ibbound ibcomp"><span>' + esc(t[1]) + '</span><input type="number" data-ibw="' + esc(t[0]) + '" value="' + (d.dpW[t[0]] || 0) + '" min="0" max="100" step="1" aria-label="' + esc('Weight of ' + t[1]) + '"><span class="muted">%</span></label>').join('') + '</div>' +
      '<p class="muted ibnote">A component is a type of work, such as Paper 1 or the internal assessment. Add or rename types in the gradebook’s Term setup. These weights are for this class only: your other classes keep your usual ones.</p>' +
      '<p class="muted ibnote">Work is still marked in points or with a rubric. The weighted percent is turned into 1 to 7 with the boundaries.</p></div></div>';
  } else h += '<p class="muted ibnote">Each assignment has its own rubric or points, and the gradebook works out a percent and a term average.</p>';
  el.innerHTML = h;
}
const ibBoundRows = (b, top) => '<div class="ibbounds">' + b.map(([lo, g], i) => '<label class="ibbound"><span>Grade ' + g + '</span><span class="muted">from</span><input type="number" data-ibb="' + i + '" value="' + lo + '" min="0" max="' + top + '" step="1" aria-label="Lowest for grade ' + g + '"></label>').join('') + '</div>';
function ibDlgRead() {
  const d = ibDraft; if (!d) return;
  for (const i of document.querySelectorAll('#ibBody [data-ibcrit]')) d.crit[+i.dataset.ibcrit].name = i.value.trim();
  const b = d.way === 'myp' ? (d.mypB ||= ibBoundsFor(d.crit.length)) : d.way === 'dp' ? d.dpB : null;
  if (b) for (const i of document.querySelectorAll('#ibBody [data-ibb]')) if (i.value !== '' && isFinite(+i.value)) b[+i.dataset.ibb][0] = Math.round(+i.value);
  for (const i of document.querySelectorAll('#ibBody [data-ibw]')) if (i.value !== '' && isFinite(+i.value)) d.dpW[i.dataset.ibw] = Math.max(0, Math.min(100, Math.round(+i.value)));
}
function ibDlgInput(e) { if (e.target.closest('[data-ibb]') && ibDraft) ibDraft.touched = true; }
function ibDlgChange(e) {
  const d = ibDraft; if (!d) return;
  if (e.target.id === 'ibGroup') { ibDlgRead(); d.group = e.target.value; d.crit = ibGroupCrit(d.group); if (!d.touched) d.mypB = null; ibDlgDraw(); }
}
function ibDlgClick(e) {
  const d = ibDraft; if (!d) return;
  const t = e.target, w = t.closest('[data-ibway]');
  if (w) { ibDlgRead(); d.way = w.dataset.ibway; ibDlgDraw(); const on = $('#ibBody [data-ibway="' + d.way + '"]'); if (on) on.focus(); return; }
  if (t.closest('[data-ibadd]')) { ibDlgRead(); d.crit.push({ k: ibLetter(d.crit.length), name: 'Criterion ' + ibLetter(d.crit.length) }); if (!d.touched) d.mypB = null; return ibDlgDraw(); }
  const cut = t.closest('[data-ibcut]');
  if (cut) { ibDlgRead(); d.crit.splice(+cut.dataset.ibcut, 1); d.crit.forEach((x, i) => { x.k = ibLetter(i); }); if (!d.touched) d.mypB = null; return ibDlgDraw(); }
  if (t.closest('[data-cancel]')) { ibDraft = null; return closeDlg(); }
  if (t.closest('[data-ok]')) return ibDlgSave();
}
function ibDlgSave() {
  const d = ibDraft, c = lib.classes[d.ci]; if (!c) return;
  ibDlgRead();
  if (d.way === 'myp') {
    const crit = d.crit.map((x, i) => ({ k: x.k, name: x.name || 'Criterion ' + ibLetter(i) })), def = ibBoundsFor(crit.length), b = d.mypB || def;
    for (let i = 1; i < b.length; i++) if (b[i][0] >= b[i - 1][0]) { toast('Each grade’s boundary has to be higher than the one below it'); return; }
    c.way = 'myp'; c.ib = { ...(c.ib || {}), group: d.group, crit, bounds: b.map(r => r.slice()) };
  } else if (d.way === 'dp') {
    const b = d.dpB;
    for (let i = 1; i < b.length; i++) if (b[i][0] >= b[i - 1][0]) { toast('Each grade’s boundary has to be higher than the one below it'); return; }
    if (!Object.values(d.dpW).some(v => v > 0)) { toast('At least one component has to count'); return; }
    c.way = 'dp'; c.ib = { ...(c.ib || {}), bounds: b.map(r => r.slice()) };
    // weights are kept only when they differ from the teacher's usual ones
    const usual = bkConf().w; if (Object.keys(d.dpW).every(k => d.dpW[k] === (+usual[k] || 0))) delete c.ib.w; else c.ib.w = { ...d.dpW };
  } else delete c.way;   // c.ib stays, so switching back later finds the criteria and boundaries as they were
  ibDraft = null; saveLib(); closeDlg(); renderLib();
  if ($('#bkBody') && bk.cols && bkClass() === c) { bk.ver = libVer; bkDraw(); }   // the gradebook on screen shows the new weights and boundaries straight away
  toast(d.way === 'myp' ? c.name + ' is graded with MYP criteria' : d.way === 'dp' ? c.name + ' is graded as a DP class' : c.name + ' is graded with points and percent');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-ib-class]'); if (b) ibDlg(+b.dataset.ibClass); });
/* ---------- an MYP class's gradebook: the evidence for each criterion, and the level the teacher judges fits best ---------- */
// Evidence comes from two places. Levels typed in for a task: item.crit = ['A', 'D'], item.typed = { lv: true, s: { name: { l: { A: 6, D: 5 }, st } } }.
// A graded download whose rubric rows are criteria: setup.ib = ['B', 'C', 'D'] beside setup.criteria, and each row's score is the level.
// The level for a term is the teacher's own: c.lv[term][name] = { A: 7, B: 6, t } ('' when there are no terms, '*' for the whole year).
// Nothing here averages levels or fills one in: a term has a total and a grade only once every criterion has been given a level.
let ibk = { view: 'table', stu: 0, add: null };
const ibTermKey = () => bk.term == null ? '' : bk.term;
const ibLvOf = (c, name) => ((c.lv || {})[ibTermKey()] || {})[name] || {};
function ibLvSet(c, name, k, v) {
  const t = ibTermKey(); c.lv ||= {}; c.lv[t] ||= {};
  const r = { ...(c.lv[t][name] || {}) }; if (v == null) delete r[k]; else r[k] = v; r.t = Date.now();
  if (Object.keys(r).length > 1) c.lv[t][name] = r; else delete c.lv[t][name];
  bkSaveLib();
}
// Each column of an MYP class with what it says about each student: { key, name, due, fm, crit: ['A', 'D'], cells: Map(name -> { lv, st }) }.
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
const ibEvFor = (icols, name, k) => icols.filter(x => x.cells.has(name) && x.cells.get(name).lv[k] != null).map(x => ({ v: x.cells.get(name).lv[k], t: x.t, name: x.name, fm: x.fm }));
const ibLvText = (lv, crit) => crit.filter(k => lv[k] != null).map(k => '<span class="iblv"><i>' + esc(k) + '</i>' + lv[k] + '</span>').join('') || '<span class="bknone">–</span>';
function ibBar(c, tabs, more) {
  return '<div class="bkbar"><div class="ovtabs bkterms" role="group" aria-label="Term">' + tabs.map(([id, l]) => '<button data-bkterm="' + esc(id) + '" aria-selected="' + (bk.term === id) + '">' + esc(l) + '</button>').join('') + '</div><span class="sp"></span>' + more + '</div>';
}
function ibBookView(c, cols, all, tabs) {
  if (ibk.view === 'add' && ibk.add) return ibAddView(c);
  const crit = ibCrit(c), bounds = ibBounds(c), icols = ibCols(c, cols), top = crit.length * IB_TOP, termName = (tabs.find(t => t[0] === bk.term) || [, 'This year'])[1];
  if (ibk.view === 'fit') return ibFitView(c, crit, bounds, icols, tabs, termName);
  const bar = ibBar(c, tabs, '<button class="btn sm" data-bksetup>Term setup</button><button class="btn sm" data-ib-class="' + lib.classes.indexOf(c) + '">Criteria and boundaries</button><button class="btn sm" data-ibcopy>Copy levels</button><button class="btn sm primary" data-ibadd-lv>+ Add levels</button>');
  let h = '<div class="bkwrap"><table class="bktab ibtab" id="ibTab"><thead><tr class="bkg"><th></th>' + (icols.length ? '<th colspan="' + icols.length + '">Evidence</th>' : '') + '<th colspan="' + (crit.length + 2) + '" class="bkgsum">' + esc(termName) + ' · your judgment</th></tr>' +
    '<tr><th class="bknm">Student</th>' + icols.map(x => '<th class="bkch' + (x.fm ? ' ibfm' : '') + '">' + (x.typed ? '<button data-ibedit="' + esc(x.key) + '" title="Change these levels">' : '<span>') + esc(x.name) + '<small>' + esc(bkDay(x.due)) + ' · ' + esc(x.crit.join(' ') || 'no criteria') + (x.fm ? ' · formative' : '') + '</small>' + (x.typed ? '</button>' : '</span>') + '</th>').join('') +
    crit.map(x => '<th class="bkavg bksum" title="' + esc(x.name) + '">' + esc(x.k) + '</th>').join('') + '<th class="bkavg bksum">Total<small>of ' + top + '</small></th><th class="bkterm bksum">Grade<small>1 to 7</small></th></tr></thead><tbody>';
  c.names.forEach((nm, i) => {
    const lv = ibLvOf(c, nm), r = ibTerm(lv, crit, bounds);
    h += '<tr><td class="bknm">' + bkName(nm, i) + bkInfo(nm) + '</td>' + icols.map(x => { const cell = x.cells.get(nm); return '<td' + (x.fm ? ' class="ibfm"' : '') + '>' + (!cell ? '<span class="bknone">–</span>' : cell.st ? '<span class="bkst">' + cell.st + '</span>' : ibLvText(cell.lv, x.crit)) + '</td>'; }).join('') +
      crit.map(x => { const v = ibLevel(lv[x.k]), n = ibEvFor(icols, nm, x.k).length;
        return '<td class="bkavg bksum ibset"><button data-ibfit="' + i + '" aria-label="' + esc(x.k + ' for ' + bkWho(nm, i) + ': ' + (v != null ? v : n ? 'not set' : 'no evidence')) + '">' + (v != null ? '<b>' + v + '</b>' : n ? '<span class="ibtodo">set</span>' : '<span class="ibnone">no evidence</span>') + '</button></td>'; }).join('') +
      '<td class="bkavg bksum">' + (r.total != null ? r.total : '<span class="bknone">–</span>') + '</td><td class="bkterm bksum">' + (r.grade != null ? '<b>' + r.grade + '</b>' : '<span class="bknone">–</span>') + '</td></tr>';
  });
  h += '</tbody></table></div>';
  // each criterion should be assessed at least twice in a year: say which have not been, from everything this class has
  const yr = ibCols(c, all).filter(x => !x.fm), few = crit.map(x => [x.k, yr.filter(y => y.crit.includes(x.k)).length]).filter(x => x[1] < 2);
  const note = yr.length && few.length ? '<div class="bknote ibfew">' + few.map(([k, n]) => 'Criterion ' + esc(k) + ' has been assessed ' + (n ? 'once' : 'in no task') + ' this year').join('. ') + '. Each criterion is usually assessed at least twice a year.</div>' : '';
  return bar + note + (icols.length || c.names.some(n => Object.keys(ibLvOf(c, n)).length) ? h : '<p class="muted bkpad">No levels for ' + esc(c.name) + ' in this term yet. Use + Add levels to type in the levels each student earned on a task.</p>' + h) +
    '<p class="muted bkcap">Each task shows the level given for the criteria it assessed. The levels on the right are yours to set: click one to see all of a student’s evidence and choose the level that fits best. Levels are never averaged. The total and the grade appear once every criterion has a level.</p>';
}
// One student: every piece of evidence for each criterion, and the buttons that set its level. The outlined button is the most recent level, as a hint.
function ibFitView(c, crit, bounds, icols, tabs, termName) {
  const i = Math.max(0, Math.min(c.names.length - 1, ibk.stu));
  const bar = ibBar(c, tabs, '<button class="btn sm" data-ibback>← Gradebook</button><button class="btn sm" data-ibstep="-1"' + (i ? '' : ' disabled') + '>Previous student</button><button class="btn sm primary" data-ibstep="1"' + (i < c.names.length - 1 ? '' : ' disabled') + '>Next student</button>');
  return bar + ibFitBox(c, crit, bounds, icols, i, termName, true);
}
// The box itself, for student i: on the best-fit screen with the name on top, on the student's own page without it.
function ibFitBox(c, crit, bounds, icols, i, termName, named) {
  const nm = c.names[i], lv = ibLvOf(c, nm), r = ibTerm(lv, crit, bounds), top = crit.length * IB_TOP;
  let h = '<div class="ibfit" id="ibFit" data-ibstu="' + i + '"><div class="ibfithead"><h3>' + (named ? esc(bkWho(nm, i)) : 'Levels') + '</h3><span class="muted">' + esc(termName) + ' · choose the level that fits best · ' + r.set + ' of ' + crit.length + ' set</span></div>';
  for (const x of crit) {
    const list = ibEvFor(icols, nm, x.k), ev = ibEvidence(list), v = ibLevel(lv[x.k]);
    h += '<div class="ibrow"><div class="ibrowname"><b>' + esc(x.k) + '</b> ' + esc(x.name) + '</div><div class="ibev">' + (list.length ? list.sort((a, b) => a.t - b.t).map(e => '<span class="ibchip' + (e.fm ? ' fm' : '') + '">' + esc(e.name) + ' <b>' + e.v + '</b></span>').join('') : '<span class="ibnone">no evidence</span>') + '</div>' +
      '<div><div class="iblvl" role="radiogroup" aria-label="' + esc('Level for ' + x.k) + '">' + Array.from({ length: IB_TOP + 1 }, (_, n) => '<button role="radio" aria-checked="' + (v === n) + '" class="' + (v === n ? 'on' : v == null && ev.hint === n ? 'hint' : '') + '" data-iblv="' + esc(x.k) + ':' + n + '">' + n + '</button>').join('') + '</div>' +
      '<div class="muted ibsay">' + (v != null ? (ev.n ? 'Most recent ' + ev.last + ', highest ' + ev.high : 'Set with no evidence here') + ' · ' + ibBandName(v) : ev.n ? 'Most recent is ' + ev.last + '. Not set yet.' : 'Nothing to judge from yet.') + '</div></div></div>';
  }
  h += '<div class="ibsum"><div><span class="ibcapw">Total</span><b>' + (r.total != null ? r.total : '–') + '</b> <span class="muted">of ' + top + '</span></div><div><span class="ibcapw">Grade</span><b class="ibg">' + (r.grade != null ? r.grade : '–') + '</b></div>' +
    '<span class="muted">' + (r.need.length ? 'Still to set: ' + esc(r.need.join(', ')) + '.' : r.grade == null ? 'This total is below the lowest boundary.' : '') + ' The outlined number is only a hint from the most recent work. Nothing is set until you click, and clicking a set level again clears it.</span></div></div>';
  return h;
}

/* ---------- an MYP class's Charts tab, a student's own page, and the grade on the Students list ---------- */
// The middle of a list of levels or grades, said without averaging: the middle one, or the two it falls between.
function ibMid(list) { const v = list.filter(x => x != null).sort((a, b) => a - b), n = v.length; if (!n) return null; const a = v[Math.floor((n - 1) / 2)], b = v[Math.ceil((n - 1) / 2)]; return a === b ? String(a) : a + ' to ' + b; }
const IB_SEGS = [['0', v => v === 0]].concat(IB_BANDS.map(([lo, hi, l]) => [lo + ' to ' + hi + ' ' + l, v => v >= lo && v <= hi]));
// One bar per criterion: how many students sit in each band. vals: [{ name, v }] with v null for a student who has no level.
function ibStack(crit, valsOf, id, noneWord) {
  return '<div class="ibstacks" id="' + id + '">' + crit.map(x => {
    const vals = valsOf(x.k), n = vals.length || 1, none = vals.filter(p => p.v == null);
    const seg = (cls, list, label) => list.length ? '<i class="' + cls + '" style="flex:' + list.length + '" tabindex="0"' + chTip(people(list.length, 'student'), x.k + ' ' + x.name + ' · ' + label, list.map(p => p.name).join(', ')) + '>' + list.length + '</i>' : '';
    return '<div class="ibstack"><span title="' + esc(x.name) + '"><b>' + esc(x.k) + '</b> ' + esc(x.name) + '</span><div class="ibsegs">' + IB_SEGS.map(([l, fn], i) => seg('ibseg s' + i, vals.filter(p => p.v != null && fn(p.v)), l)).join('') + seg('ibseg sn', none, noneWord) + '</div><b class="ibmid">' + (ibMid(vals.map(p => p.v)) ?? '–') + '</b></div>';
  }).join('') + '</div><div class="bkleg ibleg">' + IB_SEGS.map(([l], i) => '<span><i class="ibseg s' + i + '"></i>' + esc(l) + '</span>').join('') + '<span><i class="ibseg sn"></i>' + esc(noneWord) + '</span></div>';
}
function ibClassView(c, cols, all) {
  const crit = ibCrit(c), bounds = ibBounds(c), icols = ibCols(c, bk.term === '*' ? all : cols), who = c.names.map((n, i) => ({ n, name: bkWho(n, i) })).filter(p => bkIn(p.n));
  const terms = who.map(p => ({ ...p, lv: ibLvOf(c, p.n), r: ibTerm(ibLvOf(c, p.n), crit, bounds) })), graded = terms.filter(t => t.r.grade != null);
  const miss = icols.flatMap(x => who.filter(p => (x.cells.get(p.n) || {}).st === 'missing').map(p => p.n)), most = Math.max(1, ...[1, 2, 3, 4, 5, 6, 7].map(g => graded.filter(t => t.r.grade === g).length));
  const grades = '<div class="pbands" id="ibGrades">' + [7, 6, 5, 4, 3, 2, 1].map(g => { const l = graded.filter(t => t.r.grade === g); return '<div class="pband"' + (l.length ? ' tabindex="0"' : '') + chTip(people(l.length, 'student'), 'Grade ' + g, l.map(t => t.name).join(', ')) + '><span>Grade ' + g + '</span><div class="pbt"><i style="width:' + l.length / most * 100 + '%"></i></div><span class="pbn"><b>' + l.length + '</b></span></div>'; }).join('') + '</div>';
  const tasks = icols.length ? '<div class="bkwrap ibtaskw"><table class="bktab ibtasks" id="ibTasks"><thead><tr><th class="bknm">Task</th>' + crit.map(x => '<th title="' + esc(x.name) + '">' + esc(x.k) + '</th>').join('') + '<th>Marked</th></tr></thead><tbody>' +
    icols.map(x => '<tr' + (x.fm ? ' class="ibfm"' : '') + '><td class="bknm">' + esc(x.name) + '<small class="muted"> ' + esc(bkDay(x.due)) + (x.fm ? ' · formative' : '') + '</small></td>' + crit.map(k => { if (!x.crit.includes(k.k)) return '<td><span class="bknone">·</span></td>'; const v = who.map(p => (x.cells.get(p.n) || { lv: {} }).lv[k.k]).filter(v => v != null); return '<td>' + (v.length ? '<b>' + ibMid(v) + '</b><small class="muted"> ' + (Math.min(...v) === Math.max(...v) ? '' : Math.min(...v) + '–' + Math.max(...v)) + '</small>' : '<span class="bknone">–</span>') + '</td>'; }).join('') +
      '<td>' + who.filter(p => x.cells.has(p.n) && Object.keys(x.cells.get(p.n).lv).length).length + ' of ' + who.length + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="muted">No task has levels in this term yet.</p>';
  const yr = ibCols(c, all), often = '<div id="ibOften">' + crit.map(x => { const s = yr.filter(y => !y.fm && y.crit.includes(x.k)).length, f = yr.filter(y => y.fm && y.crit.includes(x.k)).length;
    return '<div class="iboften"><span><b>' + esc(x.k) + '</b> ' + esc(x.name) + '</span><span>' + people(s, 'task') + (f ? ' <span class="muted">+ ' + f + ' formative</span>' : '') + '</span>' + (s < 2 ? '<span class="ibnone">fewer than two</span>' : '<span></span>') + '</div>'; }).join('') + '</div>';
  return '<div class="bkpad"><div class="ovtiles" id="ibTiles">' + bkTile('Grades set', graded.length + ' of ' + who.length, 'every criterion has a level' + (bkLeft().size ? ' · ' + bkLeft().size + ' left out' : ''), true) +
    bkTile('Middle grade', ibMid(graded.map(t => t.r.grade)) ?? '–', 'half above, half below') + crit.map(x => bkTile(esc(x.k) + ' middle level', ibMid(terms.map(t => ibLevel(t.lv[x.k]))) ?? '–', esc(x.name))).join('') +
    bkTile('Missing work', miss.length, miss.length ? 'across ' + people(new Set(miss).size, 'student') : 'nothing outstanding') + '</div>' +
    '<div class="ovcharts">' + chSec('Levels you set, by criterion', ibStack(crit, k => terms.map(t => ({ name: t.name, v: ibLevel(t.lv[k]) })), 'ibSet', 'not set'), 'How many students sit in each band on each criterion, from the levels you set for this term. The number on the right is the middle level.') +
    chSec('Most recent level, by criterion', ibStack(crit, k => who.map(p => ({ name: p.name, v: ibEvidence(ibEvFor(icols, p.n, k)).last })), 'ibLast', 'no evidence'), 'The same picture from each student’s latest task on each criterion, before you have set anything.') +
    chSec('Grades', grades, 'Students whose every criterion has a level, by the 1 to 7 their total earns on this class’s boundaries.') +
    chSec('Each task', tasks, 'The middle level the class reached on each criterion a task assessed, with the lowest and highest.') +
    chSec('How often each criterion was assessed this year', often, 'Each criterion is usually assessed at least twice a year.') + '</div>' +
    '<p class="muted ovcap2">Nothing here is an average of levels: a middle level is the one that half the class is at or above.</p></div>';
}
// One student of an MYP class: the grade so far, then the same evidence and level buttons as the best-fit screen.
function ibOneView(c, cols, all) {
  bk.stu = Math.max(0, Math.min(c.names.length - 1, bk.stu));
  const crit = ibCrit(c), bounds = ibBounds(c), icols = ibCols(c, bk.term === '*' ? all : cols), i = bk.stu, n = c.names[i], lv = ibLvOf(c, n), r = ibTerm(lv, crit, bounds);
  const miss = icols.filter(x => (x.cells.get(n) || {}).st === 'missing'), termName = (bkTabs(all).find(t => t[0] === bk.term) || [, 'This year'])[1];
  return '<div class="bkpad"><div class="bkstu"><button class="icon" data-bkstu="-1" aria-label="Previous student"' + (i ? '' : ' disabled') + '>‹</button><b id="bkStuName">' + esc(bkWho(n, i)) + '</b>' + bkInfo(n) + '<button class="icon" data-bkstu="1" aria-label="Next student"' + (i < c.names.length - 1 ? '' : ' disabled') + '>›</button><span class="muted">' + (i + 1) + ' of ' + c.names.length + ' · ← → to move</span><span class="sp"></span><button class="btn sm" data-pssone title="A one-page summary to print for a parent meeting">Progress sheet</button></div>' +
    '<div class="ovtiles" id="bkStuTiles">' + bkTile('Grade', r.grade != null ? r.grade : '–', r.need.length ? 'still to set: ' + esc(r.need.join(', ')) : '1 to 7', true) + bkTile('Total', r.total != null ? r.total : '–', 'of ' + crit.length * IB_TOP) +
    crit.map(x => { const v = ibLevel(lv[x.k]), ev = ibEvidence(ibEvFor(icols, n, x.k)); return bkTile(esc(x.k) + ' ' + esc(x.name), v != null ? v : '–', v != null ? ibBandName(v) : ev.n ? 'most recent ' + ev.last + ', not set' : 'no evidence'); }).join('') +
    bkTile('Missing', miss.length, miss.length ? esc(miss.map(x => x.name).join(', ')) : 'nothing outstanding') + '</div>' + ibFitBox(c, crit, bounds, icols, i, termName, false) + '<div class="ovcharts">' + attStuHtml(c, n) + '</div></div>';
}
// The Students list on a class page: the 1 to 7 for the term that is on now, or how far the levels have got.
function ibPeopleSay(c, name, term) { const crit = ibCrit(c), r = ibTerm(((c.lv || {})[term] || {})[name], crit, ibBounds(c)); return r.grade != null ? String(r.grade) : r.set ? r.set + ' of ' + crit.length + ' set' : '–'; }
/* ---------- an MYP class's report comments and progress sheets ---------- */
const ibLvAt = (c, term, name) => ((c.lv || {})[term == null ? ibTermKey() : term] || {})[name] || {};
// What a report comment is drafted from (rptFacts, reports.js), for one student of an MYP class. The grade is the 1 to 7, and it
// exists only once every criterion has a level. Strongest and to work on come from the levels she set, or, for a criterion she
// has not set, the most recent level a task gave. Nothing is averaged, so there is no "scores going up".
function ibRptFacts(c, cols, n, term, said) {
  const crit = ibCrit(c), icols = ibCols(c, cols), lv = ibLvAt(c, term, n), r = ibTerm(lv, crit, ibBounds(c)), g = r.grade;
  const at = crit.map(x => { const v = ibLevel(lv[x.k]); return { name: x.name, avg: v != null ? v : ibEvidence(ibEvFor(icols, n, x.k)).last }; }).filter(x => x.avg != null).sort((a, b) => b.avg - a.avg);
  const apart = at.length >= 2 && at[0].avg - at[at.length - 1].avg >= 1;
  return { grade: g, soFar: false, band: g == null ? 'None' : g >= 6 ? 'High' : g === 5 ? 'Good' : g >= 3 ? 'Mid' : 'Low', gradeText: g != null ? g + ' out of 7' : '',
    chip: g != null ? 'Grade ' + g + ' · total ' + r.total + ' of ' + crit.length * IB_TOP : r.set ? r.set + ' of ' + crit.length + ' criteria set' : 'No levels set yet',
    strong: apart ? at[0] : null, weak: apart ? at[at.length - 1] : null, words: '', move: 0, best: '', said,
    missing: icols.filter(x => (x.cells.get(n) || {}).st === 'missing').map(x => x.name), scored: icols.filter(x => x.cells.has(n) && Object.keys(x.cells.get(n).lv).length).length };
}
// One student's printed page (pssOne, sheet.js): the grade and each criterion's level for the period, every task with the levels
// it gave, each term's levels, missing work and the comment. Beside each level, when she asks, the level half the class is at or above.
function ibSheetOne(c, all, cols, conf, n, o, rc) {
  const i = c.names.indexOf(n), shown = bkWho(n, i), crit = ibCrit(c), bounds = ibBounds(c), icols = ibCols(c, cols), top = crit.length * IB_TOP, cls = c.names.filter(bkIn);
  const lv = ibLvAt(c, pss.term, n), r = ibTerm(lv, crit, bounds), period = (bkTabs(all).find(t => t[0] === pss.term) || [, 'This year'])[1];
  const miss = icols.filter(x => (x.cells.get(n) || {}).st === 'missing'), mid = list => { const m = o.cls ? ibMid(list) : null; return m != null ? 'class middle ' + m : ''; };
  const tile = (l, v, s, main) => '<div class="psst' + (main ? ' main' : '') + '"><span>' + l + '</span><b>' + v + '</b><small>' + (s || '&nbsp;') + '</small></div>', dash = v => v != null ? v : '–';
  let h = '<article class="pss ibpss" data-pss="' + esc(n) + '"><div class="pssin"><header class="psshead"><div><small>Progress report</small><h3>' + esc(shown) + '</h3></div><p>' + esc(c.name) + '<br>' + esc(period) + ' · ' + esc(pssToday()) + '</p></header>' +
    '<div class="psstiles">' + tile(pss.term === '*' || !conf.terms.length ? 'Grade' : 'Term grade', dash(r.grade) + (r.grade != null ? ' <small>out of 7</small>' : ''), [r.need.length ? 'still to set: ' + esc(r.need.join(', ')) : 'total ' + r.total + ' of ' + top, mid(cls.map(x => ibTerm(ibLvAt(c, pss.term, x), crit, bounds).grade))].filter(Boolean).join(' · '), true) +
    crit.map(x => { const v = ibLevel(lv[x.k]); return tile('<b>' + esc(x.k) + '</b> ' + esc(x.name), dash(v) + (v != null ? ' <small>of ' + IB_TOP + '</small>' : ''), [v != null ? ibBandName(v) : 'not set yet', mid(cls.map(y => ibLevel(ibLvAt(c, pss.term, y)[x.k])))].filter(Boolean).join(' · ')); }).join('') +
    tile('Missing', String(miss.length), miss.length ? (miss.length === 1 ? 'piece of work' : 'pieces of work') : 'nothing outstanding') + '</div>' +
    '<p class="ibpsscap">Each criterion is marked from 0 to 8 with the level that fits the student’s work best. The grade from 1 to 7 comes from the total of the levels.</p>';
  const say = (x, cell) => !cell ? '<span class="muted">Not marked</span>' : cell.st === 'missing' ? '<b class="pssmiss">Missing</b>' : cell.st === 'excused' ? 'Excused' : x.crit.filter(k => cell.lv[k] != null).map(k => esc(k) + ' <b>' + cell.lv[k] + '</b>').join(' · ') || '<span class="muted">Not marked</span>';
  const rows = icols.map(x => '<tr><td>' + esc(x.name) + (x.fm ? ' <small>formative</small>' : '') + '</td><td>' + esc(x.crit.join(' ')) + '</td><td>' + esc(bkDay(x.due)) + '</td><td class="pssv">' + say(x, x.cells.get(n)) + '</td></tr>'), wide = rows.length > 14, half = Math.ceil(rows.length / 2);
  const tab = list => '<table class="psstab"><thead><tr><th>Task</th><th>Criteria</th><th>Date</th><th class="pssv">Levels</th></tr></thead><tbody>' + list.join('') + '</tbody></table>';
  let terms = '';
  if (conf.terms.length) {
    const line = (name, t, cl) => { const l = ibLvAt(c, t, n), q = ibTerm(l, crit, bounds); return '<tr' + cl + '><td>' + esc(name) + '</td>' + crit.map(x => '<td class="pssv">' + dash(ibLevel(l[x.k])) + '</td>').join('') + '<td class="pssv">' + dash(q.total) + '</td><td class="pssv">' + (q.grade != null ? '<b>' + q.grade + '</b>' : '–') + '</td></tr>'; };
    terms = '<section><h4>By term</h4><table class="psstab"><thead><tr><th></th>' + crit.map(x => '<th class="pssv" title="' + esc(x.name) + '">' + esc(x.k) + '</th>').join('') + '<th class="pssv">Total</th><th class="pssv">Grade</th></tr></thead><tbody>' +
      conf.terms.map(t => line(t.name, t.id, '')).join('') + (Object.keys(ibLvAt(c, '*', n)).length ? line('Year', '*', ' class="pssyr"') : '') + '</tbody></table></section>';
  }
  h += '<div class="pssgrid' + (wide ? ' wide' : '') + '"><section><h4>Tasks</h4>' + (!rows.length ? '<p class="muted">Nothing in this period yet.</p>' : wide ? '<div class="psshalves">' + tab(rows.slice(0, half)) + tab(rows.slice(half)) + '</div>' : tab(rows)) + '</section>' +
    '<aside>' + terms + '<section><h4>Missing work</h4>' + (miss.length ? '<ul class="psslist">' + miss.map(x => '<li>' + esc(x.name) + (x.due ? ' <small>' + esc(bkDay(x.due)) + '</small>' : '') + '</li>').join('') + '</ul>' : '<p class="pssnone">Nothing missing.</p>') + '</section></aside></div>';
  const rep = o.rep ? pssRep(c, cols, conf, n, rc) : null;
  if (rep && rep.text.trim()) h += '<section class="pssrep"><h4>Comment</h4><p>' + esc(rep.text) + '</p></section>';
  if (o.notes) h += '<section class="pssnotes"><h4>Notes</h4><i></i><i></i><i></i></section>';
  return { html: h + '</div></article>', draft: !!(rep && rep.text.trim() && rep.draft) };
}
// Levels typed in for one task: its name, date, the criteria it assessed, and a level per student for each.
function ibAddOpen(c, itId) {
  const f = itId && findItem(itId), it = f ? f.it : null, crit = ibCrit(c);
  ibk.add = { it, name: it ? it.name : '', due: it ? it.due || '' : isoDay(Date.now()), fm: !!it && it.type === 'fm', crit: it ? (it.crit || []).slice() : crit.slice(0, 2).map(x => x.k),
    s: it ? JSON.parse(JSON.stringify((it.typed && it.typed.s) || {})) : {} };
  ibk.view = 'add'; bkDraw(); const n = $('#ibaName'); if (n && !it) n.focus();
}
function ibAddView(c) {
  const a = ibk.add, crit = ibCrit(c), on = crit.filter(x => a.crit.includes(x.k));
  return '<div class="ibadd" id="ibAdd"><div class="ibaddhead"><h3>' + (a.it ? 'Change levels' : 'Add levels') + '</h3><span class="muted">For a task you marked on paper or somewhere else.</span></div>' +
    '<div class="ibaddtop"><label>Task <input type="text" id="ibaName" value="' + esc(a.name) + '" maxlength="80" placeholder="e.g. Cells lab report"></label><label>Date <input type="date" id="ibaDue" value="' + esc(a.due) + '"></label>' +
    '<label class="ibchk"><input type="checkbox" id="ibaFm"' + (a.fm ? ' checked' : '') + '> Formative</label></div>' +
    '<div class="ibaddcrit" role="group" aria-label="Criteria this task assessed"><span class="muted">Assessed:</span>' + crit.map(x => '<label class="ibchk" title="' + esc(x.name) + '"><input type="checkbox" data-ibacrit="' + esc(x.k) + '"' + (a.crit.includes(x.k) ? ' checked' : '') + '> ' + esc(x.k) + ' <span class="muted">' + esc(x.name) + '</span></label>').join('') + '</div>' +
    (on.length ? '<div class="bkwrap"><table class="bktab ibaddtab"><thead><tr><th class="bknm">Student</th>' + on.map(x => '<th>' + esc(x.k) + '<small>0 to ' + IB_TOP + '</small></th>').join('') + '</tr></thead><tbody>' +
      c.names.map((nm, i) => '<tr><td class="bknm">' + esc(bkWho(nm, i)) + '</td>' + on.map(x => { const v = ((a.s[nm] || {}).l || {})[x.k]; return '<td><input type="number" class="ibain" min="0" max="' + IB_TOP + '" step="1" data-iban="' + esc(nm) + '" data-ibak="' + esc(x.k) + '" value="' + (v == null ? '' : v) + '" aria-label="' + esc(x.k + ' for ' + bkWho(nm, i)) + '"></td>'; }).join('') + '</tr>').join('') + '</tbody></table></div>'
      : '<p class="muted bkpad">Tick the criteria this task assessed.</p>') +
    '<div class="ibaddfoot">' + (a.it ? '<button class="btn" data-ibadel style="margin-right:auto">Delete these levels</button>' : '') + '<button class="btn" data-ibacancel>Cancel</button><button class="btn primary" data-ibasave>Save</button></div></div>';
}
function ibAddRead() {
  const a = ibk.add; if (!a || !$('#ibAdd')) return;
  a.name = $('#ibaName').value.trim(); a.due = $('#ibaDue').value; a.fm = $('#ibaFm').checked;
  for (const i of document.querySelectorAll('#ibAdd .ibain')) { const n = i.dataset.iban, k = i.dataset.ibak, v = i.value === '' ? null : ibLevel(i.value); a.s[n] ||= {}; a.s[n].l ||= {}; if (v == null) delete a.s[n].l[k]; else a.s[n].l[k] = v; }
}
function ibAddSave(c) {
  const a = ibk.add; ibAddRead();
  if (!a.name) { $('#ibaName').focus(); return; }
  const bad = [...document.querySelectorAll('#ibAdd .ibain')].find(i => i.value !== '' && ibLevel(i.value) == null);
  if (bad) { toast('A level is a whole number from 0 to ' + IB_TOP); bad.focus(); return; }
  if (!a.crit.length) { toast('Tick the criteria this task assessed'); return; }
  const s = {};
  for (const [n, r] of Object.entries(a.s)) { const l = {}; for (const k of a.crit) if (r.l && r.l[k] != null) l[k] = r.l[k]; if (Object.keys(l).length || r.st) s[n] = { l, ...(r.st ? { st: r.st } : {}) }; }
  const typed = { lv: true, s }, type = a.fm ? 'fm' : 'sum', due = a.due || isoDay(Date.now());
  let it = a.it;
  if (it) Object.assign(it, { name: a.name, type, due, crit: a.crit.slice(), typed });
  else { let u = c.units[c.units.length - 1]; if (!u) c.units.push(u = { id: uid(), name: 'Unit 1', items: [] }); u.items.push(it = { id: uid(), name: a.name, classId: c.id, type, due, crit: a.crit.slice(), typed }); }
  bkSaveLib(); if (!batch) renderLib();
  const col = bk.cols.find(x => x.key === it.id);
  if (col) Object.assign(col, { name: it.name, type, due, typed }); else bk.cols.push({ key: it.id, it, cls: c.id, name: it.name, type, due, term: it.term || '', typed, xcTo: '' });
  if (bk.term !== '*') bk.term = bkTermOf({ due, term: it.term || '' }, bkConf().terms);
  ibk.view = 'table'; ibk.add = null; bkDraw(); toast('Levels saved');
}
async function ibAddDel(c) {
  const a = ibk.add, it = a && a.it; if (!it) return;
  if (!await askDlg('Delete the levels typed in for “' + it.name + '”?', { ok: 'Delete', danger: true })) return;
  for (const u of c.units) { const i = u.items.indexOf(it); if (i >= 0) u.items.splice(i, 1); }
  bk.cols = bk.cols.filter(x => x.key !== it.id); bkSaveLib(); if (!batch) renderLib();
  ibk.view = 'table'; ibk.add = null; bkDraw();
}
// The term's levels as rows a spreadsheet or the school's system takes: student, each criterion, total, grade.
function ibCopy(c) {
  const crit = ibCrit(c), bounds = ibBounds(c);
  const rows = [['Student', ...crit.map(x => x.k), 'Total', 'Grade'].join('\t')].concat(c.names.map((nm, i) => { const lv = ibLvOf(c, nm), r = ibTerm(lv, crit, bounds); return [bkWho(nm, i), ...crit.map(x => ibLevel(lv[x.k]) == null ? '' : lv[x.k]), r.total == null ? '' : r.total, r.grade == null ? '' : r.grade].join('\t'); }));
  navigator.clipboard.writeText(rows.join('\n')).then(() => toast('Copied. Paste it into a spreadsheet' + (sysName() ? ' or ' + sysName() : '') + '.'), () => toast('Copying didn’t work in this browser.'));
}
document.addEventListener('click', e => {
  const b = e.target.closest('#bkBody [data-ibfit], #bkBody [data-ibback], #bkBody [data-ibstep], #bkBody [data-iblv], #bkBody [data-ibadd-lv], #bkBody [data-ibedit], #bkBody [data-ibacancel], #bkBody [data-ibasave], #bkBody [data-ibadel], #bkBody [data-ibcopy]');
  if (!b) return; const c = bkClass(), d = b.dataset; if (!c || classWay(c) !== 'myp') return;
  if (d.ibfit != null) { ibk.view = 'fit'; ibk.stu = +d.ibfit; return bkDraw(); }
  if (d.ibback != null) { ibk.view = 'table'; return bkDraw(); }
  if (d.ibstep) { ibk.stu = Math.max(0, Math.min(c.names.length - 1, ibk.stu + +d.ibstep)); return bkDraw(); }
  if (d.iblv) { const [k, n] = d.iblv.split(':'), nm = c.names[+b.closest('[data-ibstu]').dataset.ibstu], was = ibLevel(ibLvOf(c, nm)[k]); ibLvSet(c, nm, k, was === +n ? null : +n); bkDraw(); const on = $('#bkBody [data-iblv="' + k + ':' + n + '"]'); if (on) on.focus(); return; }
  if (d.ibaddLv != null) return ibAddOpen(c, '');
  if (d.ibedit) return ibAddOpen(c, d.ibedit);
  if (d.ibacancel != null) { ibk.view = 'table'; ibk.add = null; return bkDraw(); }
  if (d.ibasave != null) return ibAddSave(c);
  if (d.ibadel != null) return ibAddDel(c);
  if (d.ibcopy != null) return ibCopy(c);
});
document.addEventListener('change', e => { const t = e.target.closest('#ibAdd [data-ibacrit]'); if (!t || !ibk.add) return; ibAddRead(); const k = t.dataset.ibacrit, a = ibk.add; a.crit = ibCrit(bkClass()).map(x => x.k).filter(x => x === k ? t.checked : a.crit.includes(x)); bkDraw(); });
/* ---------- a DP class's predicted grades: one screen, a grade from 1 to 7 for each student ---------- */
// The percent a student has for the period on screen: the term's, or for the whole year the average of the terms' grades.
function ibDpPct(nm, cols, all, conf) {
  if (bk.term !== '*' || !conf.terms.length) return bkGrade(nm, cols, conf).grade;
  const v = conf.terms.map(t => bkGrade(nm, all.filter(x => x.termId === t.id), conf).grade).filter(v => v != null); return v.length ? bkMean(v) : null;
}
function ibPredView(c, cols, all, conf, tabs) {
  const bounds = ibBounds(c), termName = (tabs.find(t => t[0] === bk.term) || [, 'This year'])[1];
  const bar = ibBar(c, tabs, '<button class="btn sm" data-ibback>← Gradebook</button><button class="btn sm" data-ibpcopy>Copy predicted grades</button>');
  let h = '<div class="bkwrap"><table class="bktab ibpredtab" id="ibPred"><thead><tr><th class="bknm">Student</th><th>' + esc(termName) + '<small>percent</small></th><th>Worked out<small>1 to 7</small></th><th>Predicted<small>yours</small></th></tr></thead><tbody>';
  c.names.forEach((nm, i) => {
    const pct = ibDpPct(nm, cols, all, conf), g = pct == null ? null : ibGradeOf(roundPct(pct), bounds), p = ibPredOf(c, nm);
    h += '<tr><td class="bknm">' + bkName(nm, i) + '</td><td>' + (pct != null ? pctAvgText(pct) : '<span class="bknone">–</span>') + '</td><td>' + (g != null ? '<b>' + g + '</b>' : '<span class="bknone">–</span>') + '</td>' +
      '<td><div class="iblvl" role="radiogroup" aria-label="' + esc('Predicted grade for ' + bkWho(nm, i)) + '">' + [1, 2, 3, 4, 5, 6, 7].map(n => '<button role="radio" aria-checked="' + (p === n) + '" class="' + (p === n ? 'on' : p == null && g === n ? 'hint' : '') + '" data-ibpred="' + i + ':' + n + '">' + n + '</button>').join('') + '</div></td></tr>';
  });
  return bar + h + '</tbody></table></div><p class="muted bkcap">A predicted grade is your own judgment. The outlined number is what the percent earns on this class’s boundaries, as a hint. Nothing is set until you click, and clicking a set grade again clears it.</p>';
}
function ibPredCopy(c) {
  const rows = [['Student', 'Predicted'].join('\t')].concat(c.names.map((nm, i) => [bkWho(nm, i), ibPredOf(c, nm) ?? ''].join('\t')));
  navigator.clipboard.writeText(rows.join('\n')).then(() => toast('Copied. Paste it into a spreadsheet' + (sysName() ? ' or ' + sysName() : '') + '.'), () => toast('Copying didn’t work in this browser.'));
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ibpredopen], #bkBody [data-ibback], #bkBody [data-ibpred], #bkBody [data-ibpcopy]');
  if (!b) return; const c = bkClass(), d = b.dataset; if (!c || classWay(c) !== 'dp') return;
  if (d.ibpredopen != null) { ibk.view = 'pred'; return bkDraw(); }
  if (d.ibback != null) { ibk.view = 'table'; return bkDraw(); }
  if (d.ibpcopy != null) return ibPredCopy(c);
  if (d.ibpred) { const [i, n] = d.ibpred.split(':'), nm = c.names[+i]; ibPredSet(c, nm, ibPredOf(c, nm) === +n ? null : +n); bkDraw(); const on = $('#bkBody [data-ibpred="' + i + ':' + n + '"]'); if (on) on.focus(); }
});
/* ---------- marking an MYP task on the paper: its rubric rows are the criteria it assesses, each 0 to 8 ---------- */
// The setup of such a task is a rubric whose rows carry their criterion: setup.ib = ['A', 'D'] beside setup.criteria, every row
// 0 to 8 in whole levels. The gradebook reads the levels by the letters (ibCols), so a row a teacher renames still counts.
// A task has no total and no percent: the levels are what it says.
function ibSetup(su) { su = su || setup; return su.mode === 'rubric' && Array.isArray(su.ib) && su.ib.some(Boolean); }
const ibTaskClass = () => { const c = batch && batchClass(); return c && classWay(c) === 'myp' ? c : null; };
// A student's levels on this task, in the order of its rows: [['A', 6], ['D', null]].
const ibTaskLevels = st => setup.ib.map((k, i) => [k, noScore(st) ? null : st.grade.rubric[i]]).filter(x => x[0]);
// In the list of students: the levels alone, in the order of the rows.
function ibListSay(st) { return ibTaskLevels(st).map(x => x[1] == null ? '–' : fmtNum(x[1])).join(' '); }
function ibStampText(st) { return ibTaskLevels(st).filter(x => x[1] != null).map(([k, v]) => k + ' ' + fmtNum(v)).join('   '); }
// In the score panel, where the total and percent of another task would be.
function ibTotalHtml(st) {
  const lv = ibTaskLevels(st), on = lv.filter(x => x[1] != null);
  return '<span class="ibtl" id="ibTaskLv">' + (on.length ? on.map(([k, v]) => '<span class="iblv"><i>' + esc(k) + '</i><b>' + fmtNum(v) + '</b></span>').join('') : '<b>–</b>') + '</span><span class="ibtlsay muted">' + (on.length < lv.length ? on.length + ' of ' + lv.length + ' criteria marked' : 'levels, 0 to ' + IB_TOP) + '</span>' +
    (on.length ? '<button class="btn sm ghost" id="stampScore" title="Put the levels on the paper: ' + esc(ibStampText(st)) + '">' + STAMP_ICON + 'Stamp</button>' : '');
}
// Above the rows: which criteria this task assesses, or, in an MYP class whose task has none yet, the way to choose them.
function ibPanelHead() {
  const c = ibTaskClass(); if (!c) return '';
  return ibSetup() ? '<button class="link" id="ibTaskSet">Criteria</button>'
    : '';
}
function ibPanelAsk() {
  const c = ibTaskClass(); if (!c || ibSetup()) return '';
  return '<div class="ibask" id="ibAsk"><span>' + esc(c.name) + ' is graded with MYP criteria.</span><button class="btn sm primary" id="ibTaskSet">Choose this task’s criteria</button></div>';
}
let ibTask = null;
function ibTaskDlg() {
  const c = ibTaskClass(); if (!c) return;
  const crit = ibCrit(c), was = ibSetup() ? setup.ib.filter(Boolean) : [];
  ibTask = { on: was.length ? was.slice() : [] };
  openDlg('<div class="bh"><h2>Criteria this task assesses</h2></div><div class="bb" id="ibTaskBody"><p class="muted">Tick the criteria you are marking on this task. Each becomes a row scored 0 to ' + IB_TOP + '. A task usually assesses two or three.</p>' +
    '<div class="ibtaskl" role="group" aria-label="Criteria">' + crit.map(x => '<label class="ibchk"><input type="checkbox" data-ibtk="' + esc(x.k) + '"' + (ibTask.on.includes(x.k) ? ' checked' : '') + '> <b>' + esc(x.k) + '</b> ' + esc(x.name) + '</label>').join('') + '</div>' +
    '<p class="muted ibnote">What each level means on a row is yours to write: use Edit rubric afterwards and paste your own descriptors.</p></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Save</button></div>');
  $('#dlgBox').onchange = null; $('#dlgBox').oninput = null;
  $('#dlgBox').onclick = e => { if (e.target.closest('[data-cancel]')) { ibTask = null; return closeDlg(); } if (e.target.closest('[data-ok]')) return ibTaskSave(); };
}
async function ibTaskSave() {
  const c = ibTaskClass(); if (!c || !ibTask) return;
  const keys = [...document.querySelectorAll('#ibTaskBody [data-ibtk]')].filter(i => i.checked).map(i => i.dataset.ibtk), crit = ibCrit(c).filter(x => keys.includes(x.k));
  if (!crit.length) { toast('Tick at least one criterion'); return; }
  const had = ibSetup(), old = had ? setup.ib : [], from = crit.map(x => old.indexOf(x.k));   // where each new row's scores come from, or -1
  const scored = batch.students.filter(st => (st.grade.rubric || []).some((v, i) => v != null && !from.includes(i)) || (!had && st.grade.points !== '' && st.grade.points != null)).length;
  if (scored && !await askDlg((had ? 'Taking a criterion off this task clears the levels given for it on ' : 'This task’s rows become the criteria, which clears the scores already given on ') + people(scored, 'paper') + '.', { ok: 'Save', cancel: 'Go back', danger: true })) return;
  const pick = a => Array.isArray(a) ? from.map(i => i >= 0 && a[i] != null ? a[i] : null) : null;
  const su = { ...setup, mode: 'rubric', criteria: crit.map((x, n) => from[n] >= 0 ? setup.criteria[from[n]] : x.k + ' ' + x.name), ib: crit.map(x => x.k), top: IB_TOP, half: false, scale: null };
  delete su.tops;
  const lv = pick(setup.levels), gl = pick(setup.goals);
  if (lv && lv.some(Boolean)) su.levels = lv.map(x => x || []); else delete su.levels;
  if (gl && gl.some(Boolean)) su.goals = gl.map(x => x || ''); else delete su.goals;
  for (const st of batch.students) {
    const g = st.grade, r = g.rubric || [], at = g.atR || {}, now = Date.now();
    g.rubric = from.map(i => i >= 0 && r[i] != null ? r[i] : null);
    const nat = {}; from.forEach((i, n) => { nat[n] = i >= 0 && at[i] ? at[i] : now; }); if (at.points) nat.points = now;
    g.atR = nat; if (!had) g.points = '';
  }
  setup = su; store.set('gs.setup', { ...setup, spot: undefined, rubricPage: undefined });
  if (batch.assignment) { batch.assignment.setup = { ...setup, spot: undefined }; shareRubric(batch.assignment); saveLib(); }
  batch.students.forEach(refound);
  ibTask = null; closeDlg(); rowStart(); renderGrade(); renderList(); saveSoon();
  toast('This task assesses ' + crit.map(x => x.k).join(', '));
}
document.addEventListener('click', e => { if (e.target.closest('#ibTaskSet')) ibTaskDlg(); });
Object.assign(window.__gs, { classWay, ibCrit, ibBounds, ibBoundsFor, ibGradeOf, ibTerm, ibEvidence, ibLevel, ibDlg, IB_GROUPS, ibCols, ibMid, ibSetup, ibTaskDlg, classNewWay, GRADE_WAYS, ibConf, ibPredOf, ibk: () => ibk });
