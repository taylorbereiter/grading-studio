/* ---------------- toolbar ---------------- */
const IC = {
  select: '<path d="M5 3l14 8-6 2-3 6z"/>',
  pen: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 6l3 3"/>',
  hl: '<path d="M9 15l-3 3h5l1-1"/><path d="M9 15l7-10 4 3-7 10z"/><path d="M4 21h16"/>',
  text: '<path d="M5 6V4h14v2"/><path d="M12 4v16"/><path d="M9 20h6"/>',
  note: '<path d="M4 5h16v11H9l-5 4z"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  oval: '<ellipse cx="12" cy="12" rx="9" ry="6.5"/>',
  erase: '<path d="M8 20h12"/><path d="M4 15l9-9 6 6-7 7H8z"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12H9a5 5 0 0 0 0 10h3"/>',
  minus: '<path d="M5 12h14"/>', plus: '<path d="M5 12h14M12 5v14"/>',
};
const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
const TOOLS = [['select', 'Select', 'V'], ['pen', 'Pen', 'P'], ['hl', 'Highlight', 'H'], ['oval', 'Circle', 'O'], ['text', 'Text', 'T'], ['note', 'Comment', 'C'], ['check', 'Check', 'K'], ['erase', 'Eraser', 'E']];
function renderTools() {
  const bar = once ? once.prev : tool;   // a one-time tool keeps her own tool's bar, so the toolbar doesn't jump
  const isHl = bar === 'hl';
  const sw = isHl ? Object.entries(HL).map(([k, v]) => '<button class="sw" data-hl="' + k + '" style="background:' + v + '" aria-pressed="' + (k === hlColor) + '" title="' + k + '"></button>').join('')
    : bar === 'check' ? Object.entries(COLORS).map(([k, v]) => '<button class="sw" data-chk="' + k + '" style="background:' + v + '" aria-pressed="' + (k === checkInk) + '" title="Checks in ' + k + '"></button>').join('')   // the check tool sets the color every check shows in
    : Object.entries(COLORS).map(([k, v]) => '<button class="sw" data-ink="' + k + '" style="background:' + v + '" aria-pressed="' + (k === inkColor) + '" title="' + k + '"></button>').join('');
  // One dock down the left edge of the paper: the tools, what the tool in hand can be set to, undo and redo, zoom.
  const opts = (bar === 'select' || bar === 'erase' ? '' : '<span class="swatches">' + sw + '</span>') +
    (bar === 'pen' ? '<span class="seg penw">' + [[1.2, 'Fine'], [2, 'Medium'], [3.5, 'Bold']].map(([w, l]) => '<button data-w="' + w + '" aria-pressed="' + (penW === w) + '" title="' + l + ' pen" aria-label="' + l + ' pen"><i style="--w:' + w + '"></i></button>').join('') + '</span>' : '') + (isHl ? hlBar() : '');
  $('#tools').innerHTML = TOOLS.map(([k, l, key]) => '<button class="tool' + (once && once.k === k ? ' once' : '') + '" data-tool="' + k + '" aria-pressed="' + ((once ? once.prev : tool) === k) + '" title="' + l + ' (' + key + ')">' + svg(IC[k]) + '<span class="lb">' + l + '</span></button>').join('') +
    (opts ? '<span class="sep"></span><span class="topts">' + opts + '</span>' : '') + '<span class="sep"></span>' +
    '<span class="tpair"><button class="icon" id="undoBtn" title="Undo (' + keyLabel('⌘Z') + ')" aria-label="Undo" ' + (undoStack.length ? '' : 'disabled') + '>' + svg(IC.undo) + '</button>' +
    '<button class="icon" id="redoBtn" title="Redo (' + keyLabel('⇧⌘Z') + ')" aria-label="Redo" ' + (redoStack.length ? '' : 'disabled') + '>' + svg(IC.redo) + '</button></span>';
  // Zoom sits at the foot of the paper, out of the way until it's wanted.
  $('#zoomPill').innerHTML = '<span class="zoom"><button class="icon" data-z="-1" aria-label="Zoom out" title="Zoom out (' + keyLabel('⌘−') + ')">' + svg(IC.minus) + '</button><button class="zlab" data-z0 title="' + keyLabel('Back to 100% (⌘0). Pinch or ⌘-scroll on the paper to zoom.') + '">' + Math.round(zoom * 100) + '%</button><button class="icon" data-z="1" aria-label="Zoom in" title="Zoom in (' + keyLabel('⌘+') + ')">' + svg(IC.plus) + '</button></span>';
  for (const pg of pages) pg.canvas.style.cursor = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';
}
$('#tools').addEventListener('click', e => {
  const t = e.target.closest('[data-tool]'); if (t) { setTool(t.dataset.tool); return; }
  const i = e.target.closest('[data-ink]'); if (i) { inkColor = i.dataset.ink; store.set('gs.ink', inkColor); recolorSelected(COLORS[inkColor]); renderTools(); return; }
  const ck = e.target.closest('[data-chk]'); if (ck) { setCheckInk(ck.dataset.chk); renderTools(); redrawAll(); return; }
  const h = e.target.closest('[data-hl]'); if (h) { hlColor = h.dataset.hl; store.set('gs.hl', hlColor); renderTools(); return; }
  if (hlBarClick(e)) return;
  const w = e.target.closest('[data-w]'); if (w) { penW = +w.dataset.w; store.set('gs.penW', penW); renderTools(); return; }
  if (e.target.closest('#undoBtn')) { undo(); return; }
  if (e.target.closest('#redoBtn')) { redo(); return; }
});
$('#zoomPill').addEventListener('click', e => {
  const z = e.target.closest('[data-z]');
  if (z) setZoom(Math.round((zoom + (+z.dataset.z) * 0.15) * 100) / 100);
  if (e.target.closest('[data-z0]')) setZoom(1);
});
// Zoom keeps the spot under the mouse (or the middle of the view) in place.
let zoomT = null;
function setZoom(z, at) {
  z = clamp(Math.round(z * 100) / 100, 0.5, 3);
  if (z === zoom) return;
  const P = $('#paper'), r = P.getBoundingClientRect(), ay = at ? at.y - r.top : P.clientHeight / 2, ax = at ? at.x - r.left : P.clientWidth / 2;
  const fy = (P.scrollTop + ay) / Math.max(1, P.scrollHeight), fx = (P.scrollLeft + ax) / Math.max(1, P.scrollWidth), k = z / zoom;
  zoom = z; store.set('gs.zoom', zoom); renderTools();
  // Stretch what's on screen right away, then draw it sharp once the zooming stops.
  commitEditors();
  for (const pg of pages) { const c = pg.canvas; if (c.style.width && pg.s) { pg.s *= k; c.style.width = parseFloat(c.style.width) * k + 'px'; c.style.height = parseFloat(c.style.height) * k + 'px'; if (pg.rchip) pg.rchip.style.left = pg.W * pg.s + 'px'; } }
  P.scrollTop = fy * P.scrollHeight - ay; P.scrollLeft = fx * P.scrollWidth - ax;
  clearTimeout(zoomT);
  zoomT = setTimeout(async () => { for (const pg of pages) await renderPage(pg); P.scrollTop = fy * P.scrollHeight - ay; }, 180);
}
$('#paper').addEventListener('wheel', e => {   // a trackpad pinch arrives as ⌘/Ctrl + scroll
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  setZoom(zoom * Math.exp(-clamp(e.deltaY * (e.deltaMode ? 20 : 1), -40, 40) * 0.005), { x: e.clientX, y: e.clientY });
}, { passive: false });
function setTool(t) { commitEditors(); if (once) dropOnce(); tool = t; if (t !== 'select') { selected = null; redrawAll(); } renderTools(); }
function recolorSelected(col) {
  if (!selected || selected.fresh || selected.mark.t === 'hl' || selected.mark.t === 'check') return;
  snap(selected.page); selected.mark.color = col; changed(selected.page);
}

/* ---------------- student list ---------------- */
// Counts as marked: marks made here, marks already on the file (Kami), a grade found in its text, or a grade boxed by hand.
const fileMarked = f => viewable(f) && (Object.values(f.marks).some(a => a.length) || (f.kami && Object.keys(f.kami).length > 0) || !!(f.scan && f.scan.found && f.scan.found.length) || !!f.hand);
// A formative activity is feedback only: no score, just Feedback complete per student (st.grade.fb).
function fmNow() { const a = batch && batch.assignment, f = a && findItem(a.id); return ((f && f.it) || a || {}).type === 'fm'; }
function setFb(st, on) { if (on) st.grade.fb = true; else delete st.grade.fb; touchGrade(st); saveSoon(); }
function hasMarks(st) { return st.files.some(f => fileMarked(f) || f.edited); }
function renderList() {
  if (!batch) return;
  renderAnonHead();
  const order = anonOn() ? anonOrder() : batch.students.map((_, i) => i);
  const q = ($('#stuFind').value || '').trim().toLowerCase();
  lfCheck();
  const rn = anonOn() ? null : rosterNames();
  $('#stuList').innerHTML = order.map((i, pos) => { const st = batch.students[i];
    const nm = rn && rn.get(st) || shownName(st, i), full = rn && rn.has(st) && st.key !== nm ? nm + ' (' + st.key + ')' : nm;
    if (q && !full.toLowerCase().includes(q)) return '';
    if (!lfShows(i)) return '';
    const g = gradeOf(st);
    const val = g.total != null ? g.total : g.pct != null ? g.pct + '%' : null;
    let right = noScore(st) ? '<span class="stag" title="You marked this student ' + g.status + '. No score counts.">' + STATUS_LABEL[g.status] + '</span>' : val != null ? '<span class="sc" title="' + (g.tries ? esc(triesSay(g)) : g.paper ? 'Read from the paper' : g.done ? 'Scored' : 'Partly scored') + '"' + (g.paper || g.out ? ' style="color:var(--muted);font-weight:600"' : g.done ? '' : ' style="color:var(--warn)"') + '>' + fmtNum(g.total != null ? g.total : g.pct) + (g.total == null ? '%' : g.outOf != null ? '/' + fmtNum(g.outOf) : '') + (g.partial ? '<small>partial</small>' : '') + '</span>'
      : manyReads(st) ? '<span class="sc" style="color:var(--warn)" title="More than one grade found on the paper. Check the Grade sheet.">?</span>'
      : st.doubts && st.doubts.length ? '<span class="sc" style="color:var(--warn)" title="A reading on the paper may not be a grade. Confirm it on the Grade sheet.">?</span>'
      : hasMarks(st) ? '<span class="dot" title="Marked"></span>' : '';
    const sent = st.grade.sent ? '<span class="sent" title="You exported this paper on its own at ' + esc(sentWhen(st.grade.sent)) + '">↗ sent</span>' : '';
    if (fmNow() && !noScore(st)) right = st.grade.fb ? '<span class="fbck" title="Feedback complete">✓</span>' : hasMarks(st) || (st.grade.comment || '').trim() ? '<span class="dot" title="Started, not complete yet"></span>' : '';
    const nAdd = st.files.filter(f => f.added && !f.from && !madeFromWord(f)).length, re = st.files.some(f => Object.values(f.sc || {}).some(r => r.re)), grp = st.files.some(f => f.from || Object.values(f.sc || {}).some(r => r.w)) || st.files.some(f => !f.added && shareCopies(st, f).length);
    // Folded to a strip, a row is its number and one sign: the score, a ring for nothing yet, a dot for marked, a dash for no paper.
    const fm = fmNow(), sv = noScore(st) ? ['–', 'none'] : fm ? (st.grade.fb ? ['✓', 'ok'] : hasMarks(st) || (st.grade.comment || '').trim() ? ['', 'dot'] : st.files.length ? ['', 'ring'] : ['–', 'none'])
      : val != null ? [fmtNum(g.total != null ? g.total : g.pct) + (g.total == null ? '%' : ''), g.paper || g.out ? 'quiet' : g.done ? '' : 'part'] : manyReads(st) || (st.doubts && st.doubts.length) ? ['?', 'part'] : hasMarks(st) ? ['', 'dot'] : st.files.length ? ['', 'ring'] : ['–', 'none'];
    return '<button class="stu' + (i === cur ? ' on' : '') + (st.files.length ? '' : ' empty') + (sv[1] ? ' sv-' + sv[1] : '') + (g.status === 'late' ? ' is-late' : '') + '" data-i="' + i + '" data-sv="' + sv[0] + '"' + (i === cur ? ' aria-current="true"' : '') + '><span class="num">' + (pos + 1) + '</span><span class="nm" title="' + esc(full) + '">' + esc(nm) + '</span>' + (anonOn() ? '' : whoBtn('data-wi="' + i + '"', st.key)) +
      '<span class="tail">' + (st.files.length || noScore(st) ? '' : '<span class="muted" style="font-size:11px">no paper</span>') + (g.status === 'late' ? '<span class="stag" title="You marked this student late">late</span>' : '') + (g.out ? '<span class="stag out" title="Left out of the average">left out</span>' : '') + (g.tries ? '<span class="stag retk" title="' + esc(triesSay(g)) + '">retake</span>' : '') + (nAdd ? '<span class="add" title="' + nAdd + (nAdd === 1 ? ' file' : ' files') + ' added by you">+' + nAdd + '</span>' : '') + (re ? '<span class="add" title="A page needs a rescan">⚑</span>' : '') + (groupOf(st) ? '<span class="add grp" title="Group work: marked and graded once with ' + esc(groupNames(groupMates(st))) + '">group</span>' : grp ? '<span class="add grp" title="Group work: shares pages or a file with another student">shared</span>' : '') + carryPill(st) + anchorTag(st) + sent + right + '</span></button>';
  }).join('');
  if (listFilter !== 'all' && !q && !order.some(i => lfMatch(batch.students[i]))) $('#stuList').insertAdjacentHTML('beforeend', '<div class="muted lfnone">No one else here. <button class="link" data-lf="all">Show everyone</button></div>');
  listToCur();
  const nExp = exportPlan(true).length;
  $('#exportBtn').innerHTML = 'Return' + (nExp ? ' <span class="atn" title="' + nExp + (nExp === 1 ? ' marked file' : ' marked files') + ' ready to give back">' + nExp + '</span>' : '');
  renderProg();
}
// The open student stays in view in the list, without the page behind it moving.
function listToCur() {
  const on = $('#stuList .on'), box = $('#side'); if (!on || !box) return;
  const r = on.getBoundingClientRect(), b = box.getBoundingClientRect(), foot = $('#sideFoot'), fh = foot && foot.offsetHeight ? foot.getBoundingClientRect().height : 0;
  if (r.top < b.top + 4) box.scrollTop -= (b.top + 4 - r.top) / (disp.ui || 1);
  else if (r.bottom > b.bottom - fh - 4) box.scrollTop += (r.bottom - (b.bottom - fh - 4)) / (disp.ui || 1);
}
// The top left: how many are scored, the class average so far (the same one Insights gives), and the list's filters.
function renderProg() {
  const fm = fmNow();
  const on = batch.students.filter(s => !noScore(s)), N = on.length, n = on.filter(s => fm ? s.grade.fb : gradeOf(s).done).length, nOff = batch.students.length - N;
  const cs = fm ? null : classStats();
  const avg = fm ? '' : cs.n ? '<button class="pavg" id="pAvg" title="Average of ' + people(cs.n, 'finished score') + '’s percents: ' + oneDp(cs.mean) + ' / ' + fmtNum(cs.max) + '. Partial, missing, excused and left-out papers don’t count. Click for Insights."><span class="k">Avg</span> <span class="v">' + (cs.meanPct != null ? pctAvgText(cs.meanPct) : oneDp(cs.mean)) + '</span><span class="s">' + oneDp(cs.mean) + ' / ' + fmtNum(cs.max) + '</span></button>'
    : '<span class="pavg none" id="pAvg" title="No finished scores yet"><span class="k">Avg</span> <span class="v">–</span></span>';
  $('#progS').innerHTML = '<div class="phrow"><div class="ph">' + n + ' of ' + N + ' <span>' + (fm ? 'feedback complete' : 'scored') + (nOff ? ' · ' + nOff + ' missing or excused' : '') + '</span></div>' + avg + '</div>' +
    '<div class="pb"><i style="width:' + (N ? 100 * n / N : 0) + '%"></i></div>';
  $('#progS').title = n + ' of ' + N + (fm ? ' with feedback complete' : ' scored');
  lfDraw();
}
function nextUnscored() {
  const N = batch.students.length, o = anonOn() ? anonOrder() : batch.students.map((_, i) => i), p = o.indexOf(cur);
  const fm = fmNow(), left = st => fm ? !st.grade.fb && !noScore(st) : !gradeOf(st).done;
  for (let k = 1; k <= N; k++) { const i = o[(p + k) % N]; if (left(batch.students[i])) return openStudent(i); }
  toast(fm ? 'Feedback is complete for everyone' : 'Everyone has a score');
}
$('#progS').addEventListener('click', e => {
  if (e.target.closest('button#pAvg')) openOverview();
});
$('#stuList').addEventListener('click', e => { const b = e.target.closest('.stu'); if (b) openStudent(+b.dataset.i); });
// Find a student: type part of a name; Enter opens the first match, Esc clears it.
$('#stuFind').addEventListener('input', () => { renderList(); if (!$('#stuList .stu')) $('#stuList').innerHTML = '<div class="muted" style="font-size:13px;padding:6px 8px">No one matches.</div>'; });
$('#stuFind').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const b = $('#stuList .stu'); if (b) openStudent(+b.dataset.i); e.target.value = ''; renderList(); e.target.blur(); }
  if (e.key === 'Escape') { e.target.value = ''; renderList(); e.target.blur(); }
});

/* ---------------- grade panel ---------------- */
// The rubric row the number keys score next. It starts on the first row with no score, so a stray key can't change a finished paper:
// with every row scored there is no row until she picks one (Tab, a click on its name, or its slider).
let rowOn = -1, rowOnOf = null, rowKeyed = -1;
function rowStart() {
  const st = batch && batch.students[cur]; rowOnOf = st || null; rowKeyed = -1;
  rowOn = st && setup.mode === 'rubric' && !fmNow() ? setup.criteria.findIndex((_, i) => st.grade.rubric[i] == null) : -1;
}
function rowPick(i) { if (i === rowOn) return; rowOn = i; rowKeyed = -1; for (const c of document.querySelectorAll('#grade .crit')) c.classList.toggle('on', +c.dataset.row === i); lvDraw(); }
// How far along its slider a row's score sits, for the blue part of the track.
const critScore = (v, i) => v == null ? '' : fmtNum(v) + '<small> / ' + rowTop(setup, i) + '</small>';
function renderGrade() {
  const st = batch.students[cur], g = st.grade, gr = gradeOf(st);
  let h = '';
  if (rowOnOf !== st) rowStart();
  if (fmNow()) return renderFeedback(st);
  if (setup.mode === 'rubric') {
    if (rowOn >= setup.criteria.length) rowOn = -1;
    h += '<h3>Score <button class="link" id="editRubric">Edit rubric</button></h3><div class="crits">';
    // Each row is one line: its name, its score, and a slider over its steps (0, 1, 1.5 … 4 unless the rubric says otherwise). The numbers under the slider show on the row in hand and under the pointer.
    h += setup.criteria.map((c, i) => { const v = g.rubric[i], steps = rowSteps(setup, i), k = steps.indexOf(v), top = rowTop(setup, i);
      return '<div class="crit' + (i === rowOn ? ' on' : '') + '" data-row="' + i + '"><div class="cn"><span title="' + esc(c) + '">' + esc(c) + '</span><em>' + critScore(v, i) + '</em></div><div class="scores slide' + (steps.length > 9 ? ' many' : '') + '" data-c="' + i + '" style="--n:' + (steps.length - 1) + '">' +
        '<input type="range" class="srange' + (v == null ? ' unset' : '') + '" style="--k:' + Math.max(0, k) + '" min="0" max="' + (steps.length - 1) + '" step="1" value="' + Math.max(0, k) + '" aria-label="Score for ' + esc(c) + '" aria-valuetext="' + (v == null ? 'Not scored' : fmtNum(v) + ' out of ' + top) + '">' +
        '<div class="sticks">' + steps.map((w, j) => '<button class="' + (w % 1 ? 'half' : '') + '" style="--k:' + j + '" data-v="' + w + '" tabindex="-1" aria-pressed="' + (v === w) + '">' + w + '</button>').join('') + '</div></div></div>'; }).join('') + '</div>' + lvBox();
  } else {
    h += '<h3>Score <button class="link" id="editRubric">Edit</button></h3>' +
      '<div class="pts"><input type="number" step="0.5" min="0" id="ptsIn" value="' + esc(g.points) + '" aria-label="Points"><span class="muted">out of ' + esc(setup.outOf) + '</span></div>';
  }
  h += '<div class="total">' + totalHtml(st) + '</div>' + statusHtml(st) + anchorHtml(st);
  h += cmtHtml(g) + histSlot(st) + '<div class="gfoot"><div class="hint keysrow">' + (setup.mode === 'rubric' ? '<span><kbd>1</kbd>–<kbd>' + Math.min(9, Math.max(...setup.criteria.map((_, i) => rowTop(setup, i)))) + '</kbd> score</span>' + (rowHalf(setup) ? '<span><kbd>.</kbd> half</span>' : '') : '<span>Type the score</span>') + '<button class="link" data-keys title="Every key">All keys <kbd>?</kbd></button></div>' + navHtml(st) + '</div>';
  $('#grade').innerHTML = h;
  if (syncScoreStamps(st)) { for (const pg of pages) draw(pg); saveSoon(); }
}
// The comment that goes back with the score, with her saved comments one click away.
const cmtHtml = g => '<div class="cmt"><textarea id="cmtIn" aria-label="Comment for ' + esc(sysOr('the student')) + '" placeholder="Comment for ' + esc(sysOr('the student')) + ' (optional). It shows on the Grades tab so you can copy it.">' + esc(g.comment) + '</textarea>' + cmtChips() + '</div>';
// Previous, the next paper that still needs a score, and plain Next. Once nothing is left, Next takes the wide button. Enter presses the wide one.
function navHtml(st) {
  const o = navOrder(), at = o.indexOf(cur), first = at <= 0, last = at >= o.length - 1, fm = fmNow();
  const more = batch.students.some(s => !noScore(s) && (fm ? !s.grade.fb : !gradeOf(s).done));
  return '<div class="nav"><button class="btn navi" id="prevBtn" aria-label="Previous student" title="Previous student (←)" ' + (first ? 'disabled' : '') + '>‹</button>' +
    (more ? '<button class="btn primary" id="nextUn" title="Opens the next student ' + (fm ? 'whose feedback isn’t complete' : 'without a full score') + ' (Enter, or N)">' + (fm ? 'Next without feedback' : 'Next to score') + ' <kbd>↵</kbd></button><button class="btn navi" id="nextBtn" aria-label="Next student" title="Next student (→)" ' + (last ? 'disabled' : '') + '>›</button>'
      : '<button class="btn primary" id="nextBtn" ' + (last ? 'disabled' : '') + '>Next <kbd>↵</kbd></button>') + oneOutHtml(st) + '</div>';
}
// The panel for a formative activity: one Feedback complete switch in place of the score.
function renderFeedback(st) {
  const g = st.grade, on = !!g.fb, off = noScore(st), nav = navOrder(), navAt = nav.indexOf(cur), last = navAt >= nav.length - 1;
  $('#grade').innerHTML = '<h3>Feedback</h3><div class="fbnote"><b>Formative activity</b>Feedback only, so there’s no score. <button class="link" id="fbType">Change the type</button></div>' +
    (off ? '<div class="total"><b>' + STATUS_LABEL[g.status] + '</b><span style="width:100%;font-size:12.5px">Nothing to give feedback on. Click it again under Mark as to take this off.</span></div>'
      : '<button class="fbtog" id="fbTog" role="switch" aria-checked="' + on + '"><span class="bx">' + (on ? '✓' : '') + '</span><span>Feedback complete<small>' + (on ? 'Click again to undo.' : 'Click, or press F, when you’ve finished with this paper.') + '</small></span></button>') +
    statusHtml(st, true) + cmtHtml(g) + histSlot(st) +
    '<div class="gfoot"><div class="hint keysrow"><span><kbd>F</kbd> complete</span><span><kbd>Shift</kbd> <kbd>F</kbd> and next</span><button class="link" data-keys title="Every key">All keys <kbd>?</kbd></button></div>' +
    '<div class="nav"><button class="btn navi" id="prevBtn" aria-label="Previous student" title="Previous student (←)" ' + (navAt ? '' : 'disabled') + '>‹</button>' + (off || on ? '<button class="btn primary" id="nextBtn" ' + (last ? 'disabled' : '') + '>Next <kbd>↵</kbd></button>' : '<button class="btn primary" id="fbNext">Complete' + (last ? '' : ' and next') + ' <kbd>↵</kbd></button>') + oneOutHtml(st) + '</div>' +
    (batch.students.some(s => !noScore(s) && !s.grade.fb && s !== st) ? '<button class="link nextun" id="nextUn" title="Opens the next student whose feedback isn’t complete">Next without feedback <kbd>N</kbd></button>' : '') + '</div>';
}
function fbToggle(next) {
  const st = batch.students[cur]; if (noScore(st)) return;
  setFb(st, next ? true : !st.grade.fb);
  renderList();
  if (next && navOrder().indexOf(cur) < navOrder().length - 1) stepStudent(1); else renderGrade();
}
function totalHtml(st) {
  const gr = noScore(st) ? gradeOf(st) : tryGrade(st), own = ownGrade(st);   // with a retake, the big number is the try being scored; what counts is in the retake box under it
  if (noScore(st)) return '<b>' + STATUS_LABEL[gr.status] + '</b><span style="width:100%;font-size:12.5px">No score counts. Giving a score takes this off.</span>';
  let h = '<b>' + (gr.total == null ? '–' : fmtNum(gr.total)) + '</b><span>/ ' + (gr.outOf != null ? fmtNum(gr.outOf) : maxPoints()) + '</span><span class="pc">' + (gr.pct == null ? '' : fmtPct(gr.pct) + bandSay(gr.pct)) + '</span>';
  if (gr.total != null) h += '<button class="btn sm ghost" id="stampScore" title="Put the score on the paper: ' + esc(scoreStampText(gr)) + '">' + STAMP_ICON + 'Stamp</button>';
  if (gr.xc) h += '<span class="xcsay" style="width:100%">' + fmtNum(gr.base) + ' earned + ' + fmtNum(gr.xc) + (gr.xcU === 'pct' ? '%' : '') + ' extra credit</span>';
  if (gr.partial) h += '<span class="sc-warn" style="width:100%">Partial: ' + partNote(st) + '. This total isn’t final.</span>';
  if (gr.paper) h += '<span style="width:100%;font-size:12.5px">From the paper (Grade sheet)</span>';
  const ps = paperScore(st);
  if (own.total != null && ps != null && Math.abs(ps - own.total) > 0.001) h += '<span class="sc-warn" style="width:100%">The paper says ' + fmtNum(ps) + '</span>';
  return h;
}
// The score stamp, the same one the calculator's "Score sticker" places: "12.5/15 = 83%", from the score however it was given
// (rubric, points, Quick mark or the grade sheet), so she doesn't need the calculator to get it onto the paper.
const STAMP_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="9.5" width="12" height="3.5" rx="1"/><path d="M6 9.5V7.2a2 2 0 1 1 4 0v2.3M3.5 15h9"/></svg>';
function scoreStampText(gr) {
  const max = gr.outOf != null ? gr.outOf : maxPoints();
  return fmtNum(gr.total) + (max ? '/' + fmtNum(max) : '') + (gr.pct != null ? ' = ' + gr.pct + '%' : '');
}
// Every score stamp on a paper says the score the app holds for that student, so the stamp, the score panel, the grade sheet
// and the export all show one number. A stamp placed earlier changes when the score does (more points, extra credit, a retake).
// Stamps on an earlier try's paper keep that try's words. With no score in the app, a stamp keeps what it says. True when one changed.
function syncScoreStamps(st) {
  if (!st || noScore(st)) return false;
  const gr = gradeOf(st);
  if (gr.total == null || gr.paper) return false;   // a score read off the paper itself isn't the app's own
  const text = scoreStampText(gr);
  let changed = false;
  for (const f of st.files) {
    if (!f.marks || tryOfFile(st, f)) continue;
    for (const l of Object.values(f.marks)) for (const m of l || []) if (m.t === 'stamp' && m.k === 'score' && m.text !== text) { m.text = text; changed = true; }
  }
  return changed;
}
// The score on the paper: read from typed text, or typed by her on the Grade sheet from the picture.
function paperScore(st) {
  if (st.found && st.found.found && st.found.score != null) return st.found.score;
  const ty = st.grade.sheet;
  return ty !== '' && ty != null && !isNaN(+ty) ? +ty : null;
}
$('#grade').addEventListener('click', e => {
  if (e.target.closest('#oneOutBtn')) return exportOne(batch.students[cur]);
  const b = e.target.closest('.scores button');
  if (b) {
    const st = batch.students[cur], i = +b.closest('.scores').dataset.c, v = +b.dataset.v;
    gradeSnap(st);
    st.grade.rubric[i] = st.grade.rubric[i] === v ? null : v;
    scoreTouched(st, i); rowOn = lvAt = i; rowKeyed = -1;
    renderGrade(); renderList(); saveSoon(); return;
  }
  const rn = e.target.closest('.crit .cn'); if (rn) return rowPick(+rn.parentNode.dataset.row);
  const sb = e.target.closest('[data-status]'); if (sb) { gradeSnap(batch.students[cur]); return setStatus(batch.students[cur], sb.dataset.status); }
  const ab = e.target.closest('[data-anchor]'); if (ab) return setAnchor(batch.students[cur], ab.dataset.anchor);
  if (e.target.closest('#outAvg, [data-outoff]')) return setOutAvg(batch.students[cur]);
  if (e.target.closest('[data-gxc]')) { kmClose(); return xcStart(batch.students[cur]); }
  { const u = e.target.closest('[data-xcu]'); if (u) return xcUnitSet(batch.students[cur], u.dataset.xcu); }
  if (e.target.closest('[data-xcoff]')) return xcSet(batch.students[cur], 0, true);
  if (e.target.closest('[data-gretake]')) { kmClose(); return retakeStart(batch.students[cur]); }
  if (e.target.closest('[data-tryoff]')) return retakeOff(batch.students[cur]);
  { const u = e.target.closest('[data-tryrule]'); if (u) { kmClose(); return retakeRuleSet(u.dataset.tryrule); } }
  if (e.target.closest('[data-tryadd]')) return pickAdd(batch.students[cur]);
  if (e.target.closest('#prevBtn')) stepStudent(-1);
  if (e.target.closest('#nextBtn')) stepStudent(1);
  if (e.target.closest('#nextUn')) return nextUnscored();
  if (e.target.closest('[data-gcalc]')) return openCalc();
  if (e.target.closest('#stampScore')) { const gr = gradeOf(batch.students[cur]); if (gr.total == null) return; if (!pages.length) return toast('Open the paper first, then stamp the score on it'); startScorePlace(scoreStampText(gr)); return; }
  if (cmtClick(e)) return;
  if (e.target.closest('#editRubric')) openSetup();
  if (e.target.closest('[data-keys]')) openKeys();
  if (e.target.closest('#fbTog')) fbToggle(false);
  if (e.target.closest('#fbNext')) fbToggle(true);
  if (e.target.closest('#fbType') && batch.assignment) editAssignment(batch.assignment.id);
});
// Dragging a row's slider: the score, the total and the list keep up without redrawing the slider under her pointer. Letting go redraws the panel.
function slideTo(r, v) {
  const st = batch.students[cur], i = +r.closest('.scores').dataset.c;
  if (st.grade.rubric[i] === v && !r.classList.contains('unset')) return;
  if (!slideSnap) { gradeSnap(st); slideSnap = true; }   // one step for a whole drag, however many scores it passed over
  st.grade.rubric[i] = v; scoreTouched(st, i);
  r.classList.remove('unset'); r.setAttribute('aria-valuetext', fmtNum(v) + ' out of ' + rowTop(setup, i)); r.style.setProperty('--k', r.value);
  const crit = r.closest('.crit'), em = crit.querySelector('.cn em'); if (em) em.innerHTML = critScore(v, i);
  for (const t of crit.querySelectorAll('.sticks button')) t.setAttribute('aria-pressed', String(+t.dataset.v === v));
  rowOn = -2; rowPick(i);   // the row in hand, and what its score means under the rows
  const tot = $('#grade .total'); if (tot) tot.innerHTML = totalHtml(st);
  const gs = $('#gstat'); if (gs) gs.outerHTML = statusHtml(st);
  renderList(); saveSoon();
}
// After the mouse, focus leaves the slider so ← → go on moving between students. After the keyboard, it stays.
let slidePtr = false, slideSnap = false;
function slideDone(r) { slideSnap = false; const i = r.closest('.scores').dataset.c, kb = !slidePtr; slidePtr = false; renderGrade(); const again = $('#grade .scores[data-c="' + i + '"] .srange'); if (again && kb) again.focus({ preventScroll: true }); }
$('#grade').addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('.srange')) slidePtr = true; });
$('#grade').addEventListener('input', e => { if (e.target.classList.contains('srange')) slideTo(e.target, rowSteps(setup, +e.target.closest('.scores').dataset.c)[+e.target.value]); });
$('#grade').addEventListener('change', e => { if (e.target.classList.contains('srange')) slideDone(e.target); });
// A first touch on the very spot the faded slider rests on changes nothing, so it wouldn't count. This counts it.
$('#grade').addEventListener('pointerup', e => {
  const r = e.target.closest && e.target.closest('.srange'); if (!r || !r.classList.contains('unset')) return;
  setTimeout(() => { if (r.isConnected && r.classList.contains('unset')) { slideTo(r, rowSteps(setup, +r.closest('.scores').dataset.c)[+r.value]); slideDone(r); } }, 0);
});
// Delete or Backspace clears the row, the way clicking its score again does.
$('#grade').addEventListener('keydown', e => {
  if (!e.target.classList || !e.target.classList.contains('srange') || (e.key !== 'Delete' && e.key !== 'Backspace')) return;
  e.preventDefault(); e.stopPropagation();
  const st = batch.students[cur], i = +e.target.closest('.scores').dataset.c; if (st.grade.rubric[i] == null) return;
  gradeSnap(st);
  st.grade.rubric[i] = null; scoreTouched(st, i); renderList(); saveSoon(); slideDone(e.target);
});
// Tab into a row's slider, and that row is the one in hand.
$('#grade').addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('srange')) rowPick(+e.target.closest('.crit').dataset.row); });

/* ---------------- scoring from the keyboard ---------------- */
// A number scores the row in hand and moves to the next row. A full stop right after adds or takes off the half. Enter presses the blue button.
// Returns true when the key was used.
function scoreKey(e, onRange) {
  if (!batch || $('#calcPanel')) return false;
  const st = batch.students[cur], ae = document.activeElement, free = e.target === document.body || onRange;   // not while she's in a box or on a button
  if (e.key === 'Enter') {
    if (!free) return false;
    const b = $('#grade .gfoot .btn.primary'); if (!b || b.disabled) return false;
    e.preventDefault(); if (onRange) ae.blur(); b.click(); return true;
  }
  if (fmNow()) return false;
  if (setup.mode !== 'rubric') {   // plain points: a number starts typing in the score box
    if (onRange || !/^[0-9.]$/.test(e.key) || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return false;
    const box = $('#ptsIn'); if (!box) return false;
    box.focus(); box.select(); return true;   // the key itself then lands in the box
  }
  const n = setup.criteria.length; if (!n) return false;
  const redraw = to => { renderGrade(); renderList(); saveSoon(); if (onRange) { const r = $('#grade .scores[data-c="' + to + '"] .srange'); if (r) r.focus({ preventScroll: true }); } };
  if (e.key === 'Tab') {   // from nowhere in particular, Tab goes to the row in hand; after that it walks the rows as Tab does
    if (onRange || e.shiftKey || e.target !== document.body) return false;
    const i = rowOn >= 0 ? rowOn : Math.max(0, setup.criteria.findIndex((_, k) => st.grade.rubric[k] == null)), r = $('#grade .scores[data-c="' + i + '"] .srange');
    if (!r) return false;
    e.preventDefault(); r.focus({ preventScroll: true }); return true;
  }
  if (/^[0-9]$/.test(e.key)) {
    const i = onRange ? +ae.closest('.scores').dataset.c : rowOn;
    if (+e.key > Math.max(ROW_TOP, ...setup.criteria.map((_, k) => rowTop(setup, k)))) return false;   // a number no row of this rubric has: not a score
    e.preventDefault();
    if (i < 0) { toast('Every row has a score. To change one, press Tab or click the row first.'); return true; }
    if (+e.key > rowTop(setup, i)) { toast('This row goes up to ' + rowTop(setup, i) + '.'); return true; }
    gradeSnap(st);
    st.grade.rubric[i] = +e.key; scoreTouched(st, i);
    rowKeyed = i; rowOn = lvAt = Math.min(i + 1, n - 1);
    redraw(rowOn); return true;
  }
  if (e.key === '.' && rowKeyed >= 0) {
    const v = st.grade.rubric[rowKeyed]; if (v == null) return false;
    const to = v % 1 ? Math.floor(v) : v + 0.5;
    e.preventDefault();
    if (!rowSteps(setup, rowKeyed).includes(to)) { toast('There’s no ' + fmtNum(to) + ' on this scale.'); return true; }
    gradeSnap(st);
    st.grade.rubric[rowKeyed] = to; scoreTouched(st, rowKeyed);
    redraw(rowOn); return true;
  }
  return false;
}
let ptsSnapFor = null;
$('#grade').addEventListener('focusout', e => { if (e.target.id === 'ptsIn') ptsSnapFor = null; });
$('#grade').addEventListener('input', e => {
  const st = batch.students[cur];
  if (e.target.id === 'cmtIn') { st.grade.comment = e.target.value; touchGrade(st); saveSoon(); }
  if (e.target.id === 'xcIn') xcSet(st, e.target.value);
  if (e.target.id === 'ptsIn') {
    if (ptsSnapFor !== e.target) { gradeSnap(st); ptsSnapFor = e.target; }   // one step for a visit to the box, not one a keystroke
    st.grade.points = e.target.value; const was = st.grade.status; scoreTouched(st); saveSoon(); renderList();
    if (was !== st.grade.status) { $('#gstat').outerHTML = statusHtml(st); }
    $('#grade .total').innerHTML = totalHtml(st);
  }
});
$('#grade').addEventListener('keydown', e => {   // Enter or Escape leaves the box, so the arrow keys go back to moving between students
  if (e.target.id === 'xcIn' && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); e.stopPropagation(); e.target.blur(); return; }
  if ((e.target.id === 'ptsIn' && e.key === 'Enter') || (e.target.id === 'cmtIn' && e.key === 'Escape')) { e.preventDefault(); e.target.blur(); }
  if (e.target.id === 'ptsIn' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); e.stopPropagation(); stepStudent(e.key === 'ArrowDown' ? 1 : -1); }   // not half a point up or down: these keys move between students
});
$('#grade').addEventListener('wheel', e => { if (e.target.id === 'ptsIn' || e.target.id === 'xcIn') e.target.blur(); }, { passive: true });   // scrolling past the box mustn't change the score in it

/* ---------------- every key, in one list ( ? ) ---------------- */
function openKeys() {
  const row = (k, t) => '<span>' + keyLabel(k).split(' ').map(x => '<kbd>' + esc(x) + '</kbd>').join(' ') + '</span><span>' + keyLabel(t) + '</span>';
  openDlg('<div class="bh"><h2>Keys</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb"><div class="keys">' +
    '<h4>Students</h4>' + row('← →', 'Previous / next student (also ↑ ↓)') + row('Enter', 'The blue button: the next student without a full score') + row('N', 'Next student without a full score') + row('/', 'Find a student by name') +
    '<h4>Scoring</h4>' + row('0 1 2 3 4', 'Score the rubric row in hand, then move to the next row') + row('.', 'Right after a number: add the half, or take it off') + row('Tab', 'Go to the row in hand. Tab again for the next row, and ← → to change its score by a step') +
    '<h4>Marking</h4>' + row('V', 'Select') + row('P', 'Pen (hold Shift for a straight line)') + row('H', 'Highlight, snapping to typed lines. Press H again for freehand (Shift for straight)') + row('O', 'Circle') + row('T', 'Text') + row('C', 'Comment') + row('K', 'Check mark') + row('E', 'Eraser') +
    row('⌘Z', 'Undo') + row('⇧⌘Z', 'Redo (⌘Y works too)') +
    '<h4>A picked mark (Select tool)</h4>' + row('← → ↑ ↓', 'Nudge it (Shift for bigger steps)') + row('⌘C ⌘V', 'Copy it, then paste on the page you’re looking at, even on another student’s paper') + row('⌘D', 'Make a copy of it') + row('+ −', 'Make it bigger or smaller (or drag the square at its corner)') + row('Delete', 'Remove it') + row('Esc', 'Let go of it (the arrows go back to moving between students)') +
    '<h4>The paper</h4>' + row('⌘+ ⌘−', 'Zoom in / out (or pinch, or ⌘-scroll)') + row('⌘0', 'Back to 100%') + row('[ ]', 'Keep the student list open / fold away the score panel') +
    'Turn a page: point at it and use ⟲ ⟳ in its top corner, or “Turn all pages” under the file’s ⋯. In Arrange pages, pick pages and press R.'.replace(/^/, '<h4>Turning pages</h4><span style="grid-column:1/-1">') + '</span>' +
    '<h4>Other</h4>' + row('=', 'Calculator') + row('Shift =', 'Answer, in the calculator (= on its own adds, Enter answers too)') + row('Space', 'Play / pause a recording') + row('J L', 'Back / ahead 5 seconds') + row('?', 'This list') +
    '</div></div><div class="bf"><span class="muted gsVer" style="margin-right:auto;font-size:13px">' + esc(versionLabel()) + '</span><button class="btn primary" data-close>Close</button></div>', true);
  $('#dlgBox').onclick = e => { if (e.target.closest('[data-close]')) closeDlg(); };
}
// The preview copy says so, because its saved work is separate from the real link's.
const versionLabel = () => 'Grading Studio version ' + gsData.APP_VERSION + (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? ' · preview copy, with its own saved work' : '');

