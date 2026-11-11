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
function ibPill(c) { const w = classWay(c); return w ? '<span class="ibpill" title="' + (w === 'myp' ? 'This class is graded with IB MYP criteria' : 'This class is graded as an IB DP class') + '">' + (w === 'myp' ? 'MYP' : 'DP') + '</span>' : ''; }
function ibClassBtn(c, ci) { return '<button class="btn sm" data-ib-class="' + ci + '">Grading</button>'; }

// A DP class's term grade: the 1 to 7 its percent earns on the class's own boundaries, shown after the percent. '' for any other class.
function ibDpSay(pct, c) { if (classWay(c) !== 'dp' || pct == null) return ''; const g = ibGradeOf(roundPct(pct), ibBounds(c)); return g == null ? '' : ' <b class="ibg7" title="On this class’s boundaries">' + g + '</b>'; }

/* ---------- how this class is graded: the box behind the Grading button on a class ---------- */
let ibDraft = null;
function ibDlg(ci) {
  const c = lib.classes[ci]; if (!c) return;
  const way = classWay(c), ib = c.ib || {};
  ibDraft = { ci, way, group: ibGroup(ib.group) ? ib.group : 'own', crit: way === 'myp' ? ibCrit(c) : ibGroupCrit(ibGroup(ib.group) ? ib.group : 'sci'), mypB: way === 'myp' ? ibBounds(c) : null, dpB: way === 'dp' ? ibBounds(c) : IB_BOUNDS_DP.map(r => r.slice()), fresh: way !== 'myp' };
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
    h += '<div class="ibcols"><div><p class="ibcap"><b>Grade boundaries</b> <span class="muted">The lowest percent for each grade.</span></p>' + ibBoundRows(d.dpB, 100) + '</div>' +
      '<div><p class="muted ibnote">These numbers are only somewhere to start, and are not any subject’s own. Type in the boundaries your subject and level use; they are different for each subject and can change with each exam session.</p>' +
      '<p class="muted ibnote">Work is still marked in points or with a rubric. The percent is turned into 1 to 7 with this table.</p></div></div>';
  } else h += '<p class="muted ibnote">Each assignment has its own rubric or points, and the gradebook works out a percent and a term average.</p>';
  el.innerHTML = h;
}
const ibBoundRows = (b, top) => '<div class="ibbounds">' + b.map(([lo, g], i) => '<label class="ibbound"><span>Grade ' + g + '</span><span class="muted">from</span><input type="number" data-ibb="' + i + '" value="' + lo + '" min="0" max="' + top + '" step="1" aria-label="Lowest for grade ' + g + '"></label>').join('') + '</div>';
function ibDlgRead() {
  const d = ibDraft; if (!d) return;
  for (const i of document.querySelectorAll('#ibBody [data-ibcrit]')) d.crit[+i.dataset.ibcrit].name = i.value.trim();
  const b = d.way === 'myp' ? (d.mypB ||= ibBoundsFor(d.crit.length)) : d.way === 'dp' ? d.dpB : null;
  if (b) for (const i of document.querySelectorAll('#ibBody [data-ibb]')) if (i.value !== '' && isFinite(+i.value)) b[+i.dataset.ibb][0] = Math.round(+i.value);
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
    c.way = 'dp'; c.ib = { ...(c.ib || {}), bounds: b.map(r => r.slice()) };
  } else delete c.way;   // c.ib stays, so switching back later finds the criteria and boundaries as they were
  ibDraft = null; saveLib(); closeDlg(); renderLib();
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
  return '<div class="bkpad"><div class="bkstu"><button class="icon" data-bkstu="-1" aria-label="Previous student"' + (i ? '' : ' disabled') + '>‹</button><b id="bkStuName">' + esc(bkWho(n, i)) + '</b>' + bkInfo(n) + '<button class="icon" data-bkstu="1" aria-label="Next student"' + (i < c.names.length - 1 ? '' : ' disabled') + '>›</button><span class="muted">' + (i + 1) + ' of ' + c.names.length + ' · ← → to move</span></div>' +
    '<div class="ovtiles" id="bkStuTiles">' + bkTile('Grade', r.grade != null ? r.grade : '–', r.need.length ? 'still to set: ' + esc(r.need.join(', ')) : '1 to 7', true) + bkTile('Total', r.total != null ? r.total : '–', 'of ' + crit.length * IB_TOP) +
    crit.map(x => { const v = ibLevel(lv[x.k]), ev = ibEvidence(ibEvFor(icols, n, x.k)); return bkTile(esc(x.k) + ' ' + esc(x.name), v != null ? v : '–', v != null ? ibBandName(v) : ev.n ? 'most recent ' + ev.last + ', not set' : 'no evidence'); }).join('') +
    bkTile('Missing', miss.length, miss.length ? esc(miss.map(x => x.name).join(', ')) : 'nothing outstanding') + '</div>' + ibFitBox(c, crit, bounds, icols, i, termName, false) + '<div class="ovcharts">' + attStuHtml(c, n) + '</div></div>';
}
// The Students list on a class page: the 1 to 7 for the term that is on now, or how far the levels have got.
function ibPeopleSay(c, name, term) { const crit = ibCrit(c), r = ibTerm(((c.lv || {})[term] || {})[name], crit, ibBounds(c)); return r.grade != null ? String(r.grade) : r.set ? r.set + ' of ' + crit.length + ' set' : '–'; }
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
Object.assign(window.__gs, { classWay, ibCrit, ibBounds, ibBoundsFor, ibGradeOf, ibTerm, ibEvidence, ibLevel, ibDlg, IB_GROUPS, ibCols, ibMid, ibk: () => ibk });
