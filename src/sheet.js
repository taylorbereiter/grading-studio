/* ---------------- progress sheets: one printed page per student, for a parent meeting (11/11) ---------------- */
// Everything on a sheet is worked out from the gradebook's own columns (book.js), the same way its table and the one-student page are.
// It's printed from this browser: nothing is sent anywhere, and nothing is saved but the teacher's three choices, in lib.book.sheet
// { cls: show the class average, rep: the report comment, notes: lines for notes } (each on unless it's false).
let pss = { cls: '', who: null, term: null, cols: null };
function pssConf() { const s = (lib.book && lib.book.sheet) || {}; return { cls: s.cls !== false, rep: s.rep !== false, notes: s.notes !== false }; }
function pssSave(part) { bkSave({ sheet: { ...((lib.book || {}).sheet || {}), ...part } }); }
const pssToday = () => new Date().toLocaleDateString(LANG_LOCALE, { year: 'numeric', month: 'long', day: 'numeric' });
// who: one roster name, or none for every student in the class.
async function openSheets(clsId, who) {
  const c = classById(clsId);
  if (!c || !c.names.length) return toast('Add a roster to this class first.');
  rptKeep(true);
  const cols = bk.cols || await bkLoad().catch(e => { console.error(e); return []; });
  const conf = ibConf(c, bkConf()), tabs = bkTabs(bkClassCols(c, cols));
  pss = { cls: c.id, who: who && c.names.includes(who) ? who : null, cols, term: tabs.some(t => t[0] === bk.term) ? bk.term : conf.terms.length ? bkTermNow(conf.terms) : '' };
  openDlg('<div class="bh"><h2 id="pssTitle"></h2><button class="icon" data-close aria-label="Close" style="margin-left:auto">✕</button></div><div class="bb pssbody" id="pssBody"></div>', false, 'lg');
  $('#dlgBox').classList.add('pssbox');
  $('#dlgBox').onclick = pssClick;
  $('#dlgBox').onchange = pssChange;
  pssDraw();
}
const pssClass = () => classById(pss.cls);
// The comment for the period on the sheet: what she wrote or ticked done on the Report comments tab, else the draft that tab would show.
function pssRep(c, cols, conf, n, rc) {
  const key = pss.term === '*' ? 'year' : pss.term || 'all', e = ((infoOf(c, n).rep || {})[key]) || {};
  return { text: e.text != null ? e.text : rptDraft(c, n, rptFacts(c, cols, conf, n, pss.term), rc, e.v), draft: !e.done && e.text == null, done: !!e.done };
}
function pssDraw() {
  const c = pssClass(), body = $('#pssBody'); if (!c || !body) return;
  const conf = ibConf(c, bkConf()), all = bkClassCols(c, pss.cols), tabs = bkTabs(all), o = pssConf(), rc = rptConf();
  if (!tabs.some(t => t[0] === pss.term)) pss.term = tabs[0][0];
  const cols = pss.term === '*' ? all : all.filter(x => x.termId === pss.term), names = pss.who ? [pss.who] : c.names;
  $('#pssTitle').textContent = pss.who ? 'Progress sheet' : 'Progress sheets';
  const sheets = names.map(n => pssOne(c, all, cols, conf, n, o, rc)), drafts = o.rep ? sheets.filter(s => s.draft).length : 0;
  const ck = (k, l, t) => '<label class="pssck" title="' + esc(t) + '"><input type="checkbox" data-pssopt="' + k + '"' + (o[k] ? ' checked' : '') + '> ' + l + '</label>';
  body.innerHTML = '<div class="pssbar"><div class="ovtabs bkterms" role="group" aria-label="Term">' + tabs.map(([id, l]) => '<button data-pssterm="' + esc(id) + '" aria-selected="' + (pss.term === id) + '">' + esc(l) + '</button>').join('') + '</div><span class="sp"></span>' +
    (classWay(c) === 'myp' ? ck('cls', 'Class middle level', 'Show the level half the class is at or above beside each of the student’s levels') : ck('cls', 'Class average', 'Show the class average beside each of the student’s numbers')) + ck('rep', 'Report comment', 'The comment from the Report comments tab for this term') + ck('notes', 'Lines for notes', 'Empty lines at the bottom to write on during the meeting') +
    '<button class="btn primary" data-pssprint>' + (names.length === 1 ? 'Print' : 'Print ' + people(names.length, 'page')) + '</button></div>' +
    '<p class="muted pssnote" id="pssNote">' + (names.length === 1 ? 'One page' : 'One page for each student, in roster order') + ', made on this computer from your gradebook. Nothing is sent anywhere. In the print window, choose a printer or Save as PDF.' +
    (drafts ? ' <span class="psswarn">' + (drafts === 1 ? (names.length === 1 ? 'The report comment is' : 'One report comment is') + ' still a draft you haven’t looked at.' : drafts + ' report comments are still drafts you haven’t looked at.') + ' <a href="' + classHash(c, 'reports') + '" data-close>Open Report comments</a></span>' : '') + '</p>' +
    '<div class="psspages" id="pssPages">' + sheets.map(s => s.html).join('') + '</div>';
  pssFit();
}
// Each sheet is one page: one that runs longer (a term with many assignments, a long comment) is drawn smaller until it fits.
// 245 mm is what a Letter page holds inside its margins, with a little to spare; A4 holds more.
function pssFit() {
  const room = 245 * 96 / 25.4;
  for (const el of document.querySelectorAll('#pssPages .pssin')) {
    el.style.zoom = '';
    for (let k = 0, z = 1; k < 4; k++) {   // measured again each time: smaller text can wrap differently
      const h = el.getBoundingClientRect().height; if (h <= room || z <= 0.6) break;
      z = Math.max(0.6, Math.floor(z * room / h * 100) / 100); el.style.zoom = String(z);
    }
  }
}
// One student's page. all: every column this year; cols: the ones in the period on the sheet.
function pssOne(c, all, cols, conf, n, o, rc) {
  if (classWay(c) === 'myp') return ibSheetOne(c, all, cols, conf, n, o, rc);   // levels by criterion and a 1 to 7, never a percent (ib.js)
  const i = c.names.indexOf(n), shown = bkWho(n, i), r = bkGrade(n, cols, conf), everyone = c.names.filter(bkIn).map(x => bkGrade(x, cols, conf));
  const cavg = t => { const ps = everyone.map(g => t ? g.by[t] : g.grade).filter(v => v != null); return ps.length ? bkMean(ps) : null; };
  const pct = v => v != null ? pctAvgText(v) : '–', vs = v => o.cls && v != null ? 'class ' + pctAvgText(v) : '';
  const period = (bkTabs(all).find(t => t[0] === pss.term) || [, 'This year'])[1];
  const fm = cols.filter(x => x.type === 'fm'), miss = cols.filter(x => x.type !== 'xc' && (x.cells.get(n) || {}).st === 'missing');
  const tile = (l, v, s, main) => '<div class="psst' + (main ? ' main' : '') + '"><span>' + l + '</span><b>' + v + '</b><small>' + (s || '&nbsp;') + '</small></div>';
  let h = '<article class="pss" data-pss="' + esc(n) + '"><div class="pssin"><header class="psshead"><div><small>Progress report</small><h3 data-raw>' + esc(shown) + '</h3></div><p><span data-raw>' + esc(c.name) + '</span><br>' + esc(period) + '<span data-raw> · ' + esc(pssToday()) + '</span></p></header>' +
    '<div class="psstiles">' + tile(pss.term === '*' || !conf.terms.length ? 'Grade' : 'Term grade', pct(r.grade) + (r.grade != null && r.soFar ? ' <small>so far</small>' : ''), [ibDpTile(c, r.grade, n, pss.term), r.xc ? 'includes +' + fmtNum(r.xc) + ' extra credit' : '', vs(cavg(''))].filter(Boolean).join(' · '), true) +
    bkCountTypes(conf).map(([t, , l]) => tile(l, pct(r.by[t]), [cols.filter(x => x.type === t && bkCounts(x.cells.get(n))).length + ' of ' + cols.filter(x => x.type === t).length + ' counted', vs(cavg(t))].filter(Boolean).join(' · '))).join('') +
    tile('Missing', String(miss.length), miss.length ? (miss.length === 1 ? 'piece of work' : 'pieces of work') : 'nothing outstanding') +
    (fm.length ? tile('Feedback', fm.filter(x => (x.cells.get(n) || {}).fb).length + ' of ' + fm.length, 'formative activities') : '') + '</div>';
  // how the scores moved, over the class's middle half when the class is shown
  const sc = bkScored(cols), w = bk.w;
  bk.w = 860;   // drawn wider than the page, so it prints smaller: the chart takes a third of the page, not half
  let chart;
  try {
    chart = o.cls ? bkBandLine(c, sc, n, shown) : bkLine(sc, [{ cls: 'bkln', pts: sc.map(col => { const x = col.cells.get(n); return bkCounts(x) ? x.pct : null; }), dots: true }], 'pssLine');
  } finally { bk.w = w; }
  h += '<section class="psschart"><h4>Scores over time</h4>' + chart.replace(/ id="(bkStuLine|pssLine)"/, ' data-pssline') + (o.cls ? '' : '<div class="bkleg">' + bkLeg() + '</div>') + '</section>';
  // every assignment in the period, beside each term's numbers and the missing work
  // a long list goes across the whole page in two halves, with the term table and the missing work underneath
  const rows = cols.filter(x => x.type !== 'xc' || x.cells.get(n)).map(col => '<tr><td data-raw>' + esc(col.name) + '</td><td>' + esc(bkLabel(col.type, true)) + '</td><td>' + esc(bkDay(col.due)) + '</td><td class="pssv">' + pssScore(col, col.cells.get(n)) + '</td></tr>'), wide = rows.length > 14;
  const tab = list => '<table class="psstab"><thead><tr><th>Assignment</th><th>Type</th><th>Date</th><th class="pssv">Score</th></tr></thead><tbody>' + list.join('') + '</tbody></table>', half = Math.ceil(rows.length / 2);
  h += '<div class="pssgrid' + (wide ? ' wide' : '') + '"><section><h4>Assignments</h4>' + (!rows.length ? '<p class="muted">Nothing in this period yet.</p>' : wide ? '<div class="psshalves">' + tab(rows.slice(0, half)) + tab(rows.slice(half)) + '</div>' : tab(rows)) + '</section>' +
    '<aside>' + pssTerms(c, all, conf, n, o) + '<section><h4>Missing work</h4>' + (miss.length ? '<ul class="psslist">' + miss.map(x => '<li><span data-raw>' + esc(x.name) + '</span>' + (x.due ? ' <small>' + esc(bkDay(x.due)) + '</small>' : '') + '</li>').join('') + '</ul>' : '<p class="pssnone">Nothing missing.</p>') + '</section></aside></div>';
  const rep = o.rep ? pssRep(c, cols, conf, n, rc) : null;
  if (rep && rep.text.trim()) h += '<section class="pssrep"><h4>Comment</h4><p data-raw>' + esc(rep.text) + '</p></section>';
  if (o.notes) h += '<section class="pssnotes"><h4>Notes</h4><i></i><i></i><i></i></section>';
  return { html: h + '</div></article>', draft: !!(rep && rep.draft && rep.text.trim()) };
}
function pssScore(col, cell) {
  if (col.type === 'xc') return '+' + fmtNum(cell.xc) + ' extra';
  if (cell && cell.st === 'missing') return '<b class="pssmiss">Missing</b>';
  if (cell && cell.st === 'excused') return 'Excused';
  if (col.type === 'fm') return cell && cell.fb ? '✓ Feedback' : 'No feedback yet';
  if (!cell || cell.pct == null) return '<span class="muted">Not scored</span>';
  return cell.pct + '%' + (cell.total != null ? ' <small>' + fmtNum(cell.total) + '/' + fmtNum(cell.max) + '</small>' : '') + (cell.st === 'late' ? ' <small>late</small>' : cell.partial ? ' <small>partial</small>' : cell.out ? ' <small>not counted</small>' : '');
}
// Each term's type averages and grade, then the year, the way the gradebook's Whole year works them out.
function pssTerms(c, all, conf, n, o) {
  const terms = conf.terms; if (!terms.length) return '';
  const ct = bkCountTypes(conf), keys = ct.map(([t]) => t).concat(['']);
  const vals = terms.map(t => { const cols = all.filter(x => x.termId === t.id), r = bkGrade(n, cols, conf), cl = c.names.filter(bkIn).map(x => bkGrade(x, cols, conf).grade).filter(v => v != null); return { name: t.name, v: keys.map(k => k ? r.by[k] : r.grade), cls: cl.length ? bkMean(cl) : null }; });
  const yr = keys.map((k, j) => { const have = vals.map(x => x.v[j]).filter(v => v != null); return have.length ? bkMean(have) : null; });
  const cell = v => '<td class="pssv">' + (v != null ? pctAvgText(v) : '–') + '</td>';
  return '<section><h4>By term</h4><table class="psstab"><thead><tr><th></th>' + ct.map(([, , s]) => '<th class="pssv">' + esc(s) + '</th>').join('') + '<th class="pssv">Grade</th>' + (o.cls ? '<th class="pssv">Class</th>' : '') + '</tr></thead><tbody>' +
    vals.map(x => '<tr><td>' + esc(x.name) + '</td>' + x.v.map(cell).join('') + (o.cls ? cell(x.cls) : '') + '</tr>').join('') +
    '<tr class="pssyr"><td>Year</td>' + yr.map(cell).join('') + (o.cls ? '<td></td>' : '') + '</tr></tbody></table></section>';
}
// Printing: the sheets are copied to the end of the page, and everything else is hidden from the printer until the print window closes.
function pssPrint() {
  const pages = $('#pssPages'); if (!pages) return;
  const old = $('#pssOut'); if (old) old.remove();
  const out = document.createElement('div'); out.id = 'pssOut'; out.innerHTML = pages.innerHTML;
  document.body.appendChild(out); document.documentElement.classList.add('pssprint');
  const done = () => { window.removeEventListener('afterprint', done); out.remove(); document.documentElement.classList.remove('pssprint'); };
  window.addEventListener('afterprint', done);
  window.print();
}
function pssClick(e) {
  if (e.target.closest('[data-close]')) return closeDlg();
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.pssterm != null) { pss.term = b.dataset.pssterm; return pssDraw(); }
  if (b.dataset.pssprint != null) return pssPrint();
}
function pssChange(e) {
  const t = e.target.closest('[data-pssopt]'); if (!t) return;
  pssSave({ [t.dataset.pssopt]: t.checked });
  pssDraw();
}
// The buttons that open them: Progress sheets on the Students list and the Report comments tab, Progress sheet on one student's page.
$('#vClass').addEventListener('click', e => {
  const b = e.target.closest('[data-pssall], [data-pssone]'), r = routeNow(); if (!b || !r.c) return;
  openSheets(r.c.id, b.dataset.pssone != null ? r.c.names[r.stu || 0] : null);
});
