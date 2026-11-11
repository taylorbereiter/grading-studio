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
const classWay = c => c && (c.way === 'myp' || c.way === 'dp') ? c.way : '';
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
const ibPill = c => classWay(c) ? '<span class="ibpill" title="' + (classWay(c) === 'myp' ? 'This class is graded with IB MYP criteria' : 'This class is graded as an IB DP class') + '">' + (classWay(c) === 'myp' ? 'MYP' : 'DP') + '</span>' : '';
const ibClassBtn = (c, ci) => '<button class="btn sm" data-ib-class="' + ci + '">Grading</button>';

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
Object.assign(window.__gs, { classWay, ibCrit, ibBounds, ibBoundsFor, ibGradeOf, ibTerm, ibEvidence, ibLevel, ibDlg, IB_GROUPS });
