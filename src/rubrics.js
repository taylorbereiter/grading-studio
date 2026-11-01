/* ---------------- rubric library: what each score means on each row, and saved rubrics to reuse ---------------- */
// setup.levels[row][score] is her words for a whole score, 0 to 4. Old setups don't have it and look as they always did.
// gs.rubrics: [{ id, name, criteria, levels, scale, at }]. It's under gs.*, so the take-home file, the folder and safety copies carry it. A rubric file she brought in isn't part of a saved rubric.
const LEVELS = [4, 3, 2, 1, 0], levelsOpen = new Set(), levelEditOpen = new Set();
const levelIn = (d, i, v) => { const r = d.levels && d.levels[i]; return (r && r[v]) || ''; };
const levelOf = (i, v) => levelIn(setup, i, v);
const rowHasLevels = i => LEVELS.some(v => levelOf(i, v));
// A half point sits between two levels, so it shows both.
function levelPick(i, v) {
  if (v == null) return '';
  const say = (v % 1 ? [Math.ceil(v), Math.floor(v)] : [v]).filter(w => levelOf(i, w)).map(w => '<b>' + w + '</b> ' + esc(levelOf(i, w)));
  return say.length > 1 ? say.map(t => '<span class="lvh">' + t + '</span>').join(' ') : say.join('');   // two levels get a line each, so a long one can't hide the other
}
const levelHint = (i, v) => levelPick(i, v) || '<span class="muted">' + (v == null ? 'Point at a score to see what it means.' : 'Nothing written for ' + fmtNum(v) + '.') + '</span>';
// Under a row's score buttons: two quiet lines for the score she picked or is pointing at. All opens the whole row, and it stays open from student to student.
function levelsHtml(i, v) {
  if (!rowHasLevels(i)) return '';
  if (levelsOpen.has(i)) {
    const on = v == null ? [] : [Math.ceil(v), Math.floor(v)];
    return '<div class="lvrow"><ul class="lvall">' + LEVELS.filter(w => levelOf(i, w)).map(w => '<li' + (on.includes(w) ? ' class="on"' : '') + '><b>' + w + '</b><span>' + esc(levelOf(i, w)) + '</span></li>').join('') + '</ul><button class="link lvbtn" data-lvopen="' + i + '" aria-expanded="true">Less</button></div>';
  }
  return '<div class="lvrow" data-lvline="' + i + '"><div class="lvtxt" aria-live="polite">' + levelHint(i, v) + '</div><button class="link lvbtn" data-lvopen="' + i + '" aria-expanded="false" aria-label="See what every score means on this row">All</button></div>';
}
function levelPreview(e, leaving) {
  const b = e.target.closest('.scores button'); if (!b) return;
  const i = +b.closest('.scores').dataset.c, el = $('#grade [data-lvline="' + i + '"] .lvtxt');
  if (el && batch) el.innerHTML = levelHint(i, leaving ? batch.students[cur].grade.rubric[i] : +b.dataset.v);
}
$('#grade').addEventListener('mouseover', e => levelPreview(e));
$('#grade').addEventListener('focusin', e => levelPreview(e));
$('#grade').addEventListener('mouseout', e => levelPreview(e, true));
$('#grade').addEventListener('focusout', e => levelPreview(e, true));
$('#grade').addEventListener('click', e => {
  const b = e.target.closest('[data-lvopen]'); if (!b) return;
  const i = +b.dataset.lvopen;
  if (!levelsOpen.delete(i)) levelsOpen.add(i);
  renderGrade();
  const again = $('#grade [data-lvopen="' + i + '"]'); if (again) again.focus({ preventScroll: true });
});

/* In Rubric setup. */
let rubDlg = null;   // the setup being edited: { draft, re, was, pageNew, from, n0, told }
// The setup as Save would keep it, to tell if anything changed. The name of a rubric she saved for later isn't a change to this setup.
const setupSnap = d => JSON.stringify({ ...d, levels: tidyLevels(d), rubricName: undefined });
// from: where each row in the draft came from, by its place when the dialog opened (null for a new row). told: the scoring mode she's already been asked about.
function rubricsSetup(draft, re, pageNew) { rubDlg = { draft, re, was: setupSnap(draft), pageNew, from: draft.criteria.map((_, i) => i), n0: draft.criteria.length, told: null }; }
// Esc or a click outside. All that writing only lives in the dialog until Save, so Rubric setup asks first. Its Cancel button is already a clear choice.
async function leaveDlg() {
  if ($('#setupBody') && (rubDlg.pageNew() || setupSnap(rubDlg.draft) !== rubDlg.was) && !await askDlg('Leave Rubric setup without saving? The changes you made here won’t be kept.', { ok: 'Leave', cancel: 'Keep editing', danger: true })) return;
  closeDlg();
}
function levelsEditHtml(d, i) {
  const n = LEVELS.filter(v => levelIn(d, i, v).trim()).length;
  return '<details class="lved" data-lvrow="' + i + '"' + (levelEditOpen.has(i) ? ' open' : '') + '><summary>What each score means' + (n ? ' (' + n + ' of 5 written)' : '') + '</summary>' +
    LEVELS.map(v => '<label class="lvin"><b>' + v + '</b><textarea rows="2" data-lvi="' + i + '" data-lvv="' + v + '" aria-label="What ' + v + ' means on this row">' + esc(levelIn(d, i, v)) + '</textarea></label>').join('') +
    '<span class="muted lvnote">Leave any of these blank. A half point shows the two scores around it.</span></details>';
}
function levelsRowGone(d, i) { if (d.levels) d.levels.splice(i, 1); rubDlg.from.splice(i, 1); levelEditOpen.clear(); }
// Only what she wrote is kept, and nothing at all if she wrote nothing, so an old setup stays as it was.
function tidyLevels(d) {
  const out = d.criteria.map((_, i) => { const r = {}; for (const v of LEVELS) { const t = levelIn(d, i, v).trim(); if (t) r[v] = t; } return r; });
  return out.some(r => Object.keys(r).length) ? out : undefined;
}
const savedRubrics = () => { const a = store.get('gs.rubrics', []); return Array.isArray(a) ? a.filter(r => r && r.id && r.name && Array.isArray(r.criteria) && r.criteria.length) : []; };
function rubricLibHtml(d) {
  const list = savedRubrics();
  if (!list.length && d.mode !== 'rubric') return '';
  const about = r => r.criteria.length + (r.criteria.length === 1 ? ' row' : ' rows') + (r.levels ? ', with what each score means' : '');
  return '<div class="field"><label>Saved rubrics</label>' +
    (list.length ? '<div class="rlib">' + list.map(r => '<div class="rl"><span class="rln"><b>' + esc(r.name) + '</b><span class="muted">' + about(r) + '</span></span><button class="btn sm" data-rbuse="' + esc(r.id) + '">Use</button><button class="btn sm" data-rbdel="' + esc(r.id) + '" aria-label="Delete ' + esc(r.name) + '">×</button></div>').join('') + '</div>'
      : '<span class="muted" style="font-size:13px">Save this rubric to use it again on another assignment. It keeps the rows, what each score means and the grading scale.</span>') +
    (d.mode === 'rubric' ? '<div style="margin-top:4px"><button class="btn sm" data-rbsave>Save this rubric…</button></div>' : '') + '</div>';
}
// What using a saved rubric would do to scores already given. Scores belong to a row by its place, and nothing is ever deleted.
function rubricUseNote(r, d) {
  if (!batch) return '';
  const S = batch.students, rows = st => st.grade.rubric || [], out = [];
  if (d.mode !== 'rubric') {
    const n = S.filter(st => st.grade.points !== '' && st.grade.points != null).length;
    if (n) out.push((n === 1 ? '1 student has a total' : n + ' students have totals') + ' typed in. Those stay saved, but won’t count while this assignment uses rubric rows.');
  } else {
    const gone = S.filter(st => rows(st).slice(r.criteria.length).some(v => v != null)).length, any = S.some(st => rows(st).some(v => v != null));
    if (gone) out.push((gone === 1 ? '1 student has a score' : gone + ' students have scores') + ' on rows this rubric doesn’t have. Those stay saved, but won’t count.');
    else if (any && r.criteria.some((c, i) => c !== d.criteria[i])) out.push('Scores you already gave stay in the same place: a first-row score stays in the first row, under its new name.');
    if (any && r.criteria.length > d.criteria.length) out.push('Students with every row scored will show as partial until the new rows are scored.');
  }
  if (S.some(st => rows(st).some(v => v != null) || st.grade.points) && JSON.stringify(r.scale || null) !== JSON.stringify(d.scale || null)) out.push('Percents will follow the grading scale saved with this rubric.');
  return out.join('\n\n');
}
// The rows she's taking out of this setup, by their place when it opened.
const rowsGone = () => [...Array(rubDlg.n0).keys()].filter(i => !rubDlg.from.includes(i));
// What a new rubric file, or taking it off, does to copies she's already worked on. A Word copy stays hers under a new Word rubric, and a marked page stays under a new page. page: { name } of the new file, or null.
function rubricCopiesNote(S, page) {
  const word = !!page && WORD_RX.test(page.name), kept = [], lost = [];
  for (const st of S) for (const f of st.files) {
    if (!f.virtual) continue;
    if (f.kind === 'docx' ? f.edited : page === null || word ? fileMarked(f) : false) (word && f.kind === 'docx' ? kept : lost).push(st);
  }
  const out = [], n = kept.length, m = lost.length;
  if (n) out.push((n === 1 ? '1 student already has' : n + ' students already have') + ' highlights or typing on their copy of your rubric. ' + (n === 1 ? 'That copy stays as it is, so it won’t show the new version' : 'Those copies stay as they are, so they won’t show the new version') + '. Everyone else gets the new one. To start a student over on the new one, press Edit on their copy, then Back to the original.');
  if (m) out.push((m === 1 ? '1 student has' : m + ' students have') + ' marks on their copy of your rubric. ' + (m === 1 ? 'That copy goes' : 'Those copies go') + ', along with what’s on ' + (m === 1 ? 'it' : 'them') + '. Scores stay as they are.');
  return out.join('\n\n');
}
// What Save would do to scores already given, for her to say yes to. Empty when nothing is at stake. page: the new rubric file, null if it's coming off, undefined if neither.
function setupSaveNote(d, page) {
  if (!batch) return '';
  const S = batch.students, gone = rowsGone(), out = [], has = v => v !== '' && v != null;
  const nGone = S.filter(st => gone.some(i => st.grade.rubric[i] != null)).length;
  if (nGone) out.push((nGone === 1 ? '1 student has a score' : nGone + ' students have scores') + ' on ' + (gone.length === 1 ? 'the row' : 'the rows') + ' you took out. ' + (nGone === 1 ? 'That score goes' : 'Those scores go') + ' with ' + (gone.length === 1 ? 'the row' : 'the rows') + ', and ' + (nGone === 1 ? 'that total changes' : 'those totals change') + '. Every other score stays on its own row.');
  if (d.mode !== setup.mode && d.mode !== rubDlg.told) {
    if (d.mode === 'points') {
      const n = S.filter(st => st.grade.rubric.some(v => v != null)).length;
      if (n) out.push((n === 1 ? '1 student has rubric row scores' : n + ' students have rubric row scores') + '. Those stay saved, but won’t count while this assignment uses just a total. Switch back to rows and they count again.');
    } else {
      const n = S.filter(st => has(st.grade.points)).length;
      if (n) out.push((n === 1 ? '1 student has a total' : n + ' students have totals') + ' typed in. Those stay saved, but won’t count while this assignment uses rubric rows. Switch back to just the total and they count again.');
    }
  }
  if (page !== undefined) { const c = rubricCopiesNote(S, page); if (c) out.push(c); }
  return out.join('\n\n');
}
// A score belongs to a row by its place, so when a row goes, the scores after it move up with their rows. Each row keeps its own time.
function rowsTakenOut() {
  const gone = rowsGone(); if (!gone.length || !batch) return;
  const low = gone[0], left = k => k - gone.filter(i => i < k).length;
  for (const st of batch.students) {
    const g = st.grade, keys = Object.keys(g.atR || {}).filter(k => k !== 'points').map(Number);
    if (g.rubric.length <= low && !keys.some(k => k >= low)) continue;
    g.rubric = Array.from(g.rubric, v => v == null ? null : v).filter((_, k) => !gone.includes(k));   // a row never clicked this session is a gap in the list, and filter would skip it and close it up
    if (g.atR) g.atR = Object.fromEntries(keys.filter(k => !gone.includes(k)).map(k => [left(k), g.atR[k]]).concat(g.atR.points ? [['points', g.atR.points]] : []));   // a points score's time isn't a row's
    touchGrade(st);
  }
  levelsOpen.clear();
}
async function rubricUse(r) {
  const { draft: d, re } = rubDlg, note = rubricUseNote(r, d);
  if (note && !await askDlg('Use “' + r.name + '”?\n\n' + note, { ok: 'Use it', cancel: 'Keep what I have' })) return;
  Object.assign(d, { mode: 'rubric', criteria: r.criteria.slice(), levels: r.levels ? JSON.parse(JSON.stringify(r.levels)) : undefined, scale: r.scale ? { ...r.scale } : null, rubricName: r.name });
  Object.assign(rubDlg, { from: r.criteria.map((_, i) => i), n0: r.criteria.length, told: 'rubric' });   // a saved rubric's rows go by place, and this has just said so
  levelEditOpen.clear(); re();
  toast('“' + r.name + '” is filled in. Press Save to keep it.');
}
async function rubricSave() {
  const { draft: d, re } = rubDlg;
  const name = ((await askTextDlg('What should this rubric be called?', d.rubricName || (batch && batch.assignment && batch.assignment.name) || '', { ok: 'Save rubric' })) || '').trim();
  if (!name) return;
  const list = savedRubrics(), at = list.findIndex(r => r.name.toLowerCase() === name.toLowerCase());
  if (at >= 0 && !await askDlg('You already have a rubric called “' + list[at].name + '”. Replace it with this one?', { ok: 'Replace it', cancel: 'Keep the old one', danger: true })) return;
  const r = { id: at >= 0 ? list[at].id : uid(), name, criteria: d.criteria.map((c, i) => c.trim() || 'Criterion ' + (i + 1)), levels: tidyLevels(d), scale: d.scale ? { ...d.scale } : null, at: Date.now() };
  if (at >= 0) list[at] = r; else list.push(r);
  list.sort((a, b) => natural(a.name, b.name));
  if (!store.set('gs.rubrics', list)) return sayDlg('This browser is out of room, so that rubric wasn’t saved.');
  d.rubricName = name; re();
  toast('Saved “' + name + '”');
}
async function rubricDelete(r) {
  if (!await askDlg('Delete “' + r.name + '” from your saved rubrics?\n\nAssignments already using it keep their rows and what each score means.', { ok: 'Delete', cancel: 'Keep it', danger: true })) return;
  store.set('gs.rubricsGone', { ...store.get('gs.rubricsGone', {}), [r.id]: Date.now() });   // so an older copy of her work doesn't bring it back
  store.set('gs.rubrics', savedRubrics().filter(x => x.id !== r.id));
  rubDlg.re();
}
$('#dlgBox').addEventListener('input', e => {
  const t = e.target; if (t.dataset.lvi == null || !rubDlg) return;
  const d = rubDlg.draft, i = +t.dataset.lvi;
  d.levels ||= [];
  (d.levels[i] ||= {})[t.dataset.lvv] = t.value;
});
$('#dlgBox').addEventListener('toggle', e => {   // re-drawing the setup keeps a row's descriptions open
  if (!e.target.matches || !e.target.matches('.lved')) return;
  const i = +e.target.dataset.lvrow;
  if (e.target.open) levelEditOpen.add(i); else levelEditOpen.delete(i);
}, true);
$('#dlgBox').addEventListener('click', e => {
  const find = id => savedRubrics().find(r => r.id === id);
  const u = e.target.closest('[data-rbuse]'); if (u) { const r = find(u.dataset.rbuse); if (r) rubricUse(r); return; }
  const x = e.target.closest('[data-rbdel]'); if (x) { const r = find(x.dataset.rbdel); if (r) rubricDelete(r); return; }
  if (e.target.closest('[data-rbsave]')) rubricSave();
});

/* ---------------- class overview: the spread of scores, the rows the class found hardest, and who isn't finished ---------------- */
// The spread counts finished scores on this assignment's scale. Missing and excused have no number and a partial total isn't final, so they stay out. A real 0 stays in.
function onThisScale(st, g, max) {
  if (g.total == null || !(g.total >= 0 && g.total <= max)) return false;
  const typed = hasSheet(st.grade) && !isNaN(+st.grade.sheet);
  return !(g.paper && !typed && st.found && st.found.outOf != null && st.found.outOf !== max);   // a confirmed 10/15 on a 12-point assignment
}
function spreadBins(counted, max) {
  if (!max) return [];
  const w = max <= 20 ? 1 : Math.ceil(max / 10), bins = [];
  for (let lo = 0; lo < max || (w === 1 && lo === max); lo += w) bins.push({ lo, top: w === 1 && lo === max, label: w === 1 && lo === max ? fmtNum(lo) : fmtNum(lo) + ' to under ' + fmtNum(Math.min(lo + w, max)), who: [] });
  if (w > 1 || max % 1) bins[bins.length - 1].label = fmtNum(bins[bins.length - 1].lo) + ' to ' + fmtNum(max);
  for (const x of counted) bins[Math.min(Math.floor(x.total / w), bins.length - 1)].who.push(x.name);
  return bins;
}
function classStats() {
  const max = maxPoints(), s = { counted: [], partial: [], notScored: [], missing: [], excused: [], offScale: [], ownOff: [], rosterOnly: [], rows: [] };
  batch.students.forEach((st, i) => {
    const g = gradeOf(st), who = { i, name: shownName(st, i) };
    if (g.status === 'missing' || g.status === 'excused') s[g.status].push(who);
    else if (g.partial) s.partial.push({ ...who, note: partNote(st) });
    else if (!g.done || (g.total == null && g.pct == null)) s.notScored.push({ ...who, note: !st.files.length ? 'No paper' : st.foundCount > 1 || (st.doubts && st.doubts.length) ? 'A grade on the paper to confirm' : '' });
    else if (!onThisScale(st, g, max) && !g.paper) s.ownOff.push({ ...who, note: 'You gave ' + fmtNum(g.total) + ', out of ' + fmtNum(max) });
    else if (!onThisScale(st, g, max)) s.offScale.push({ ...who, note: g.total != null ? 'The paper says ' + (g.paper && st.found && st.found.outOf != null ? fmtNum(g.total) + ' out of ' + fmtNum(st.found.outOf) : fmtNum(g.total)) : 'The paper says ' + fmtPct(g.pct) });
    else s.counted.push({ ...who, total: g.total, pct: g.pct, late: g.status === 'late', paper: !!g.paper });
  });
  const c = batchClass();
  if (c && c.names.length) { const m = rosterMatch(c.names); s.rosterOnly = c.names.filter(n => !m.has(n)); }
  if (anonOn()) for (const k of ['counted', 'partial', 'notScored', 'missing', 'excused', 'offScale', 'ownOff']) s[k].sort((a, b) => natural(a.name, b.name));   // never in folder order while names are hidden
  const tot = s.counted.map(x => x.total).sort((a, b) => a - b), n = tot.length, pcts = s.counted.map(x => x.pct).filter(v => v != null);
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  s.n = n; s.everyone = batch.students.length + s.rosterOnly.length; s.max = max;
  s.nLate = s.counted.filter(x => x.late).length;
  if (n) Object.assign(s, { mean: mean(tot), median: n % 2 ? tot[(n - 1) / 2] : (tot[n / 2 - 1] + tot[n / 2]) / 2, low: tot[0], high: tot[n - 1], meanPct: pcts.length ? roundPct(mean(pcts)) : null });
  s.bins = spreadBins(s.counted, max);
  // Rows use every row with a score, partial papers included, since those rows are real scores. Scores of a missing or excused student stay out.
  if (setup.mode === 'rubric') {
    s.rows = setup.criteria.map((name, r) => {
      const v = batch.students.map(st => rowShown(st, r)).filter(x => x != null);
      return { r, name, n: v.length, avg: v.length ? mean(v) : null, low: v.filter(x => x <= 2).length };
    }).sort((a, b) => (a.avg == null ? 9 : a.avg) - (b.avg == null ? 9 : b.avg) || a.r - b.r);
    const av = s.rows.filter(x => x.n).map(x => x.avg), least = Math.min(...av);
    for (const x of s.rows) x.lowest = x.n > 0 && x.avg === least && av.some(a => a !== least);
    s.nRowless = s.counted.filter(x => x.paper).length;
  }
  return s;
}
const oneDp = v => fmtNum(Math.round(v * 10) / 10);
const people = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
function leftOutText(s) {
  const parts = [[s.missing.length, 'marked missing'], [s.excused.length, 'excused'], [s.partial.length, 'partial'], [s.notScored.length, 'not scored yet'], [s.offScale.length, 'from the paper, not on this scale'], [s.ownOff.length, 'above the total or below 0'], [s.rosterOnly.length, 'on the roster with nothing here']].filter(p => p[0]).map(p => p[0] + ' ' + p[1]);
  let t = 'Counted: ' + s.n + ' of ' + people(s.everyone, 'student') + '.';
  if (parts.length) t += ' Left out: ' + parts.join(', ') + '.';
  if (s.missing.length || s.excused.length) t += ' Missing and excused don’t count as 0.';
  if (s.counted.some(x => x.total === 0)) t += ' A score of 0 is counted.';
  if (s.nLate) t += ' ' + (s.nLate === 1 ? '1 late score is' : s.nLate + ' late scores are') + ' counted.';
  return t;
}
const ovTile = (l, v, sub) => '<div class="ovt"><div class="ovl">' + l + '</div><div class="ovv">' + v + (sub ? ' <small>' + sub + '</small>' : '') + '</div></div>';
function spreadHtml(s) {
  if (!s.n || !s.bins.length) return '<p class="muted">No finished scores yet, so there’s nothing to chart.</p>';
  const most = Math.max(...s.bins.map(b => b.who.length)), tens = 10 ** Math.floor(Math.log10(Math.max(most / 5, 1))), step = [1, 2, 5, 10].map(x => x * tens).find(x => x * 5 >= most), ticks = [];
  for (let t = step; t <= most; t += step) ticks.push(t);
  const whole = s.bins[s.bins.length - 1].top, halves = whole && s.counted.some(x => x.total % 1);
  return '<div class="ovh" role="group" aria-label="Score spread"><div class="ovplot">' +
    ticks.map(t => '<div class="ovgrid" style="bottom:' + t / most * 100 + '%"><span>' + t + '</span></div>').join('') +
    '<div class="ovcols">' + s.bins.map(b => {
      const n = b.who.length;
      return '<div class="ovc"' + (n ? ' tabindex="0" aria-label="' + esc('Score ' + b.label + ': ' + people(n, 'student')) + '"' : '') + ' data-tv="' + esc(people(n, 'student')) + '" data-tl="' + esc('Score ' + b.label) + '" data-tn="' + esc(b.who.slice(0, 12).join(', ') + (n > 12 ? ' and ' + (n - 12) + ' more' : '')) + '">' +
        (n ? '<div class="ovb" style="height:' + n / most * 100 + '%"></div>' + (n === most ? '<span class="ovcap">' + n + '</span>' : '') : '') + '</div>';
    }).join('') + '</div></div>' +
    '<div class="ovx" aria-hidden="true">' + s.bins.map(b => '<span>' + fmtNum(b.lo) + '</span>').join('') + '</div></div>' +
    '<p class="muted ovcap2">Points, out of ' + fmtNum(s.max) + '.' + (halves ? ' A half point counts with the whole number below it.' : '') + '</p>' +
    '<details class="ovtbl"><summary>See this as a table</summary><table class="ovtab"><thead><tr><th>Score</th><th>Students</th><th>Who</th></tr></thead><tbody>' +
    s.bins.filter(b => b.who.length).reverse().map(b => '<tr><td>' + esc(b.label) + '</td><td>' + b.who.length + '</td><td>' + esc(b.who.join(', ')) + '</td></tr>').join('') + '</tbody></table></details>';
}
function rowsHtml(s) {
  if (setup.mode !== 'rubric') return '<p class="muted">This assignment is scored with just a total, so there are no rows to compare.</p>';
  if (!s.rows.some(x => x.n)) return '<p class="muted">No rubric rows scored yet.</p>';
  const nPart = s.partial.length, notes = ['Average out of 4, lowest first. It uses every row with a score' + (nPart ? ', including the scored rows on ' + (nPart === 1 ? '1 partial paper' : nPart + ' partial papers') : '') + '.'];
  if (s.missing.length || s.excused.length) notes.push('Missing and excused students aren’t in it.');
  if (s.nRowless) notes.push((s.nRowless === 1 ? '1 score' : s.nRowless + ' scores') + ' read from the paper ' + (s.nRowless === 1 ? 'has' : 'have') + ' no rows, so ' + (s.nRowless === 1 ? 'it isn’t' : 'they aren’t') + ' here.');
  return '<div class="ovrows" role="group" aria-label="Rubric rows, lowest average first">' + s.rows.map(x => {
    const sum = x.n ? people(x.n, 'score') + ', ' + x.low + ' at 2 or less' : 'No scores yet', tip = x.n ? oneDp(x.avg) + ' average' : 'No scores yet';
    return '<div class="ovr"' + (x.n ? ' tabindex="0"' : '') + ' aria-label="' + esc(x.name + ': ' + tip + '. ' + sum) + '" data-tv="' + esc(tip) + '" data-tl="' + esc(x.name) + '" data-tn="' + esc(sum) + '">' +
      '<div class="ovrn"><span>' + esc(x.name) + '</span>' + (x.lowest ? ' <span class="stag">lowest</span>' : '') + '</div>' +
      '<div class="ovrt">' + [1, 2, 3].map(t => '<i style="left:' + t * 25 + '%"></i>').join('') + (x.n ? '<div class="ovrb' + (x.lowest ? ' on' : '') + '" style="width:' + x.avg * 25 + '%"></div>' : '') + '<span class="ovrv" style="left:' + (x.n ? x.avg * 25 : 0) + '%">' + (x.n ? oneDp(x.avg) : '–') + '</span></div>' +
      '<div class="muted ovrs">' + sum + '</div></div>';
  }).join('') + '</div><div class="ovrx" aria-hidden="true"><span></span><div>' + [0, 1, 2, 3, 4].map(t => '<span style="left:' + t * 25 + '%">' + t + '</span>').join('') + '</div><span></span></div><p class="muted ovcap2">' + notes.join(' ') + '</p>';
}
function whoHtml(s) {
  const item = o => '<li><button class="link" data-ovgo="' + o.i + '">' + esc(o.name) + '</button>' + (o.note ? ' <span class="muted">' + esc(o.note) + '</span>' : '') + '</li>';
  const late = s.counted.filter(x => x.late);
  const groups = [['Not scored yet', s.notScored], ['Partial: some rows scored', s.partial], ['Marked missing', s.missing], ['Excused', s.excused], ['Read from the paper, not on this scale', s.offScale], ['Your score is above the total or below 0', s.ownOff], ['Late, and counted', late]].filter(g => g[1].length);
  let h = groups.map(([t, list]) => '<details class="ovg" data-group="' + esc(t) + '" open><summary>' + esc(t) + ' (' + list.length + ')</summary><ul>' + list.map(item).join('') + '</ul></details>').join('');
  if (s.rosterOnly.length) h += '<details class="ovg" data-group="On the roster" open><summary>On the roster, nothing here (' + s.rosterOnly.length + ')</summary>' + (anonOn() ? '<p class="muted" style="margin:4px 0 0">Names stay hidden during anonymous grading.</p>' : '<ul>' + s.rosterOnly.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>') + '</details>';
  const open = s.notScored.length + s.partial.length + s.rosterOnly.length;
  return (open ? '' : '<p class="ovok">Everyone has a finished score or a mark saying why not.</p>') + h;
}
async function openOverview() {
  if (!scanned || scanP) {   // a grade read off a paper counts, so finish reading first, as the Grade sheet and export do
    toast('Reading the files first…');
    const b0 = batch, shown = $('#dlg').hidden ? null : $('#dlgBox').firstElementChild;   // it may be opening from the Grades list
    await scanAll();
    if (batch !== b0 || (!$('#dlg').hidden && $('#dlgBox').firstElementChild !== shown)) return;   // she's moved on to something else
  }
  const s = classStats();
  openDlg('<div class="bh"><h2>Class overview</h2><button class="icon" data-close aria-label="Close" style="margin-left:auto">✕</button></div><div class="bb" id="ovBody">' +
    '<p class="ovleft" id="ovLeft">' + esc(leftOutText(s)) + '</p>' +
    (s.n ? '<div class="ovtiles" id="ovTiles">' + ovTile('Average', oneDp(s.mean), '/ ' + fmtNum(s.max) + (s.meanPct != null ? ' · ' + s.meanPct + '%' : '')) + ovTile('Middle score', fmtNum(s.median)) + ovTile('Lowest', fmtNum(s.low)) + ovTile('Highest', fmtNum(s.high)) + '</div>' : '') +
    '<div class="ovcharts"><section id="ovSpread"><h3 class="ovh3">Score spread</h3>' + spreadHtml(s) + '</section><section id="ovRows"><h3 class="ovh3">Rows the class found hardest</h3>' + rowsHtml(s) + '</section></div>' +
    '<section id="ovWho"><h3 class="ovh3">Who’s missing or unfinished</h3>' + whoHtml(s) + '</section></div>' +
    '<div class="bf"><button class="btn" data-ovgrades>Grades list</button><button class="btn primary" data-close>Close</button></div>');
  ovTipHide();
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-ovgrades]')) return openGrades();
    const g = e.target.closest('[data-ovgo]'); if (g) { closeDlg(); openStudent(+g.dataset.ovgo); }
  };
}
// One tooltip, for pointing and for the keyboard. The same numbers are in the table and the row labels. textContent, since names are in it.
function ovTip() {
  let t = $('#ovTip');
  if (!t) { t = document.createElement('div'); t.id = 'ovTip'; t.setAttribute('role', 'tooltip'); t.hidden = true; t.innerHTML = '<b></b><span></span><em></em>'; $('#dlg').appendChild(t); }
  return t;
}
function ovTipHide() { const t = $('#ovTip'); if (t) t.hidden = true; }
function ovTipShow(el) {
  const t = ovTip(), [v, l, n] = t.children;
  v.textContent = el.dataset.tv; l.textContent = el.dataset.tl; n.textContent = el.dataset.tn; n.hidden = !el.dataset.tn;
  t.hidden = false;
  const r = el.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight, x = r.left + r.width / 2 - w / 2, y = r.top - h - 6;
  t.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px';
  t.style.top = (y < 8 ? r.bottom + 6 : y) + 'px';
}
const ovMark = e => e.target.closest && e.target.closest('[data-tv]');
$('#dlgBox').addEventListener('mouseover', e => { const m = ovMark(e); if (m) ovTipShow(m); });
$('#dlgBox').addEventListener('mouseout', e => { if (ovMark(e)) ovTipHide(); });
$('#dlgBox').addEventListener('focusin', e => { const m = ovMark(e); if (m) ovTipShow(m); });
$('#dlgBox').addEventListener('focusout', e => { if (ovMark(e)) ovTipHide(); });
$('#dlgBox').addEventListener('scroll', ovTipHide, true);
$('#overviewBtn').onclick = openOverview;

Object.assign(window.__gs, { classStats, openOverview, openSetup, savedRubrics, levelOf, tidyLevels, spreadBins });
