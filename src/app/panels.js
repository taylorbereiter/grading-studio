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
    : Object.entries(COLORS).map(([k, v]) => '<button class="sw" data-ink="' + k + '" style="background:' + v + '" aria-pressed="' + (k === inkColor) + '" title="' + k + '"></button>').join('');
  // One dock down the left edge of the paper: the tools, what the tool in hand can be set to, undo and redo, zoom.
  const opts = (bar === 'select' || bar === 'erase' ? '' : '<span class="swatches">' + sw + '</span>') +
    (bar === 'pen' ? '<span class="seg penw">' + [[1.2, 'Fine'], [2, 'Medium'], [3.5, 'Bold']].map(([w, l]) => '<button data-w="' + w + '" aria-pressed="' + (penW === w) + '" title="' + l + ' pen" aria-label="' + l + ' pen"><i style="--w:' + w + '"></i></button>').join('') + '</span>' : '') + (isHl ? hlBar() : '');
  $('#tools').innerHTML = TOOLS.map(([k, l, key]) => '<button class="tool' + (once && once.k === k ? ' once' : '') + '" data-tool="' + k + '" aria-pressed="' + ((once ? once.prev : tool) === k) + '" title="' + l + ' (' + key + ')">' + svg(IC[k]) + '<span class="lb">' + l + '</span></button>').join('') +
    (opts ? '<span class="sep"></span><span class="topts">' + opts + '</span>' : '') + '<span class="sep"></span>' +
    '<span class="tpair"><button class="icon" id="undoBtn" title="Undo (' + keyLabel('⌘Z') + ')" aria-label="Undo" ' + (undoStack.length ? '' : 'disabled') + '>' + svg(IC.undo) + '</button>' +
    '<button class="icon" id="redoBtn" title="Redo (' + keyLabel('⇧⌘Z') + ')" aria-label="Redo" ' + (redoStack.length ? '' : 'disabled') + '>' + svg(IC.redo) + '</button></span>' +
    '<span class="zoom"><button class="icon" data-z="-1" aria-label="Zoom out" title="Zoom out (' + keyLabel('⌘−') + ')">' + svg(IC.minus) + '</button><span data-z0 title="' + keyLabel('Back to 100% (⌘0). Pinch or ⌘-scroll on the paper to zoom.') + '">' + Math.round(zoom * 100) + '%</span><button class="icon" data-z="1" aria-label="Zoom in" title="Zoom in (' + keyLabel('⌘+') + ')">' + svg(IC.plus) + '</button></span>';
  for (const pg of pages) pg.canvas.style.cursor = tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';
}
$('#tools').addEventListener('click', e => {
  const t = e.target.closest('[data-tool]'); if (t) { setTool(t.dataset.tool); return; }
  const i = e.target.closest('[data-ink]'); if (i) { inkColor = i.dataset.ink; store.set('gs.ink', inkColor); recolorSelected(COLORS[inkColor]); renderTools(); return; }
  const h = e.target.closest('[data-hl]'); if (h) { hlColor = h.dataset.hl; store.set('gs.hl', hlColor); renderTools(); return; }
  if (hlBarClick(e)) return;
  const w = e.target.closest('[data-w]'); if (w) { penW = +w.dataset.w; store.set('gs.penW', penW); renderTools(); return; }
  if (e.target.closest('#undoBtn')) { undo(); return; }
  if (e.target.closest('#redoBtn')) { redo(); return; }
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
    let right = noScore(st) ? '<span class="stag" title="You marked this student ' + g.status + '. No score counts.">' + STATUS_LABEL[g.status] + '</span>' : val != null ? '<span class="sc" title="' + (g.paper ? 'Read from the paper' : g.done ? 'Scored' : 'Partly scored') + '"' + (g.paper || g.out ? ' style="color:var(--muted);font-weight:600"' : g.done ? '' : ' style="color:var(--warn)"') + '>' + fmtNum(g.total != null ? g.total : g.pct) + (g.total == null ? '%' : g.outOf != null ? '/' + fmtNum(g.outOf) : '') + (g.partial ? '<small>partial</small>' : '') + '</span>'
      : manyReads(st) ? '<span class="sc" style="color:var(--warn)" title="More than one grade found on the paper. Check the Grade sheet.">?</span>'
      : st.doubts && st.doubts.length ? '<span class="sc" style="color:var(--warn)" title="A reading on the paper may not be a grade. Confirm it on the Grade sheet.">?</span>'
      : hasMarks(st) ? '<span class="dot" title="Marked"></span>' : '';
    const sent = st.grade.sent ? '<span class="sent" title="You exported this paper on its own at ' + esc(sentWhen(st.grade.sent)) + '">↗ sent</span>' : '';
    if (fmNow() && !noScore(st)) right = st.grade.fb ? '<span class="fbck" title="Feedback complete">✓</span>' : hasMarks(st) || (st.grade.comment || '').trim() ? '<span class="dot" title="Started, not complete yet"></span>' : '';
    const nAdd = st.files.filter(f => f.added && !f.from && !madeFromWord(f)).length, re = st.files.some(f => Object.values(f.sc || {}).some(r => r.re)), grp = st.files.some(f => f.from || Object.values(f.sc || {}).some(r => r.w)) || st.files.some(f => !f.added && shareCopies(st, f).length);
    return '<button class="stu' + (i === cur ? ' on' : '') + (st.files.length ? '' : ' empty') + '" data-i="' + i + '"><span class="num">' + (pos + 1) + '</span><span class="nm" title="' + esc(full) + '">' + esc(nm) + '</span>' + (anonOn() ? '' : whoBtn('data-wi="' + i + '"', st.key)) +
      '<span style="display:inline-flex;align-items:center;gap:4px">' + (st.files.length || noScore(st) ? '' : '<span class="muted" style="font-size:11px">no paper</span>') + (g.status === 'late' ? '<span class="stag" title="You marked this student late">late</span>' : '') + (g.out ? '<span class="stag out" title="Left out of the average">left out</span>' : '') + (nAdd ? '<span class="add" title="' + nAdd + (nAdd === 1 ? ' file' : ' files') + ' added by you">+' + nAdd + '</span>' : '') + (re ? '<span class="add" title="A page needs a rescan">⚑</span>' : '') + (groupOf(st) ? '<span class="add grp" title="Group work: marked and graded once with ' + esc(groupNames(groupMates(st))) + '">group</span>' : grp ? '<span class="add grp" title="Group work: shares pages or a file with another student">shared</span>' : '') + carryPill(st) + sent + right + '</span></button>';
  }).join('');
  if (listFilter !== 'all' && !q && !order.some(i => lfMatch(batch.students[i]))) $('#stuList').insertAdjacentHTML('beforeend', '<div class="muted lfnone">No one else here. <button class="link" data-lf="all">Show everyone</button></div>');
  const on = $('#stuList .on'); if (on) on.scrollIntoView({ block: 'nearest' });
  const nExp = exportPlan(true).length;
  $('#exportBtn').innerHTML = 'Return' + (nExp ? ' <span class="atn" title="' + nExp + (nExp === 1 ? ' marked file' : ' marked files') + ' ready to give back">' + nExp + '</span>' : '');
  renderProg();
}
// The top left: how many are scored, the class average so far (the same one Insights gives), and the list's filters.
function renderProg() {
  const fm = fmNow();
  const on = batch.students.filter(s => !noScore(s)), N = on.length, n = on.filter(s => fm ? s.grade.fb : gradeOf(s).done).length, nOff = batch.students.length - N;
  const cs = fm ? null : classStats();
  const avg = fm ? '' : cs.n ? '<button class="pavg" id="pAvg" title="Average of ' + people(cs.n, 'finished score') + '’s percents: ' + oneDp(cs.mean) + ' / ' + fmtNum(cs.max) + '. Partial, missing, excused and left-out papers don’t count. Click for Insights."><span class="k">Avg</span> <span class="v">' + (cs.meanPct != null ? pctAvgText(cs.meanPct) : oneDp(cs.mean)) + '</span><span class="s">' + oneDp(cs.mean) + ' / ' + fmtNum(cs.max) + '</span></button>'
    : '<span class="pavg none" id="pAvg" title="No finished scores yet"><span class="k">Avg</span> <span class="v">–</span></span>';
  $('#progS').innerHTML = '<div class="phrow"><div class="ph">' + n + ' of ' + N + ' <span>' + (fm ? 'feedback complete' : 'scored') + (nOff ? ' · ' + nOff + ' missing or excused' : '') + '</span></div>' + avg + '</div>' +
    '<div class="pb"><i style="width:' + (N ? 100 * n / N : 0) + '%"></i></div>' + lfChips();
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
function renderGrade() {
  const st = batch.students[cur], g = st.grade, gr = gradeOf(st);
  let h = '';
  if (fmNow()) return renderFeedback(st);
  if (setup.mode === 'rubric') {
    h += '<h3>Rubric <button class="link" id="editRubric" style="font-size:12.5px;text-transform:none;letter-spacing:0">Edit rubric</button></h3>';
    // Each row is a slider over the steps 0, 1, 1.5 … 4, with its numbers underneath to click straight to one. Not scored yet: the slider waits, faded, for her first touch.
    h += setup.criteria.map((c, i) => { const v = g.rubric[i], k = RUBRIC_STEPS.indexOf(v);
      return '<div class="crit"><div class="cn"><span>' + esc(c) + '</span><em>' + (v == null ? '' : fmtNum(v) + ' / 4') + '</em></div><div class="scores slide" data-c="' + i + '">' +
        '<input type="range" class="srange' + (v == null ? ' unset' : '') + '" min="0" max="' + (RUBRIC_STEPS.length - 1) + '" step="1" value="' + Math.max(0, k) + '" aria-label="Score for ' + esc(c) + '" aria-valuetext="' + (v == null ? 'Not scored' : fmtNum(v) + ' out of 4') + '">' +
        '<div class="sticks">' + RUBRIC_STEPS.map((w, j) => '<button class="' + (w % 1 ? 'half' : '') + '" style="--k:' + j + '" data-v="' + w + '" tabindex="-1" aria-pressed="' + (v === w) + '">' + w + '</button>').join('') + '</div></div>' + levelsHtml(i, v) + '</div>'; }).join('');
  } else {
    h += '<h3>Score <button class="link" id="editRubric" style="font-size:12px;text-transform:none;letter-spacing:0">Edit</button></h3>' +
      '<div class="pts"><input type="number" step="0.5" min="0" id="ptsIn" value="' + esc(g.points) + '" aria-label="Points"><span class="muted">out of ' + esc(setup.outOf) + '</span></div>';
  }
  h += '<div class="total">' + totalHtml(st) + '</div>' + statusHtml(st);
  h += cmtHtml(g) + navHtml(st) + histSlot(st);
  h += '<div class="hint"><button class="link" data-keys style="font-size:12.5px">All keys ( ? )</button></div>';
  $('#grade').innerHTML = h;
}
// The comment that goes to ManageBac, with her saved comments one click away.
const cmtHtml = g => '<div class="cmt"><h3 style="margin-bottom:6px">Comment for ManageBac</h3><textarea id="cmtIn" placeholder="Optional. Shows on the Grades tab so you can copy it.">' + esc(g.comment) + '</textarea>' + cmtChips() + '</div>';
// Previous, the next paper that still needs a score, and plain Next. Once nothing is left, Next takes the wide button.
function navHtml(st) {
  const o = navOrder(), at = o.indexOf(cur), first = at <= 0, last = at >= o.length - 1, fm = fmNow();
  const more = batch.students.some(s => !noScore(s) && (fm ? !s.grade.fb : !gradeOf(s).done));
  return '<div class="nav"><button class="btn navi" id="prevBtn" aria-label="Previous student" title="Previous student (←)" ' + (first ? 'disabled' : '') + '>‹</button>' +
    (more ? '<button class="btn primary" id="nextUn" title="Opens the next student ' + (fm ? 'whose feedback isn’t complete' : 'without a full score') + '">' + (fm ? 'Next without feedback' : 'Next unscored') + ' <kbd>N</kbd></button><button class="btn navi" id="nextBtn" aria-label="Next student" title="Next student (→)" ' + (last ? 'disabled' : '') + '>›</button>'
      : '<button class="btn primary" id="nextBtn" ' + (last ? 'disabled' : '') + '>Next ▶</button>') + oneOutHtml(st) + '</div>';
}
// The panel for a formative activity: one Feedback complete switch in place of the score.
function renderFeedback(st) {
  const g = st.grade, on = !!g.fb, off = noScore(st), nav = navOrder(), navAt = nav.indexOf(cur), last = navAt >= nav.length - 1;
  $('#grade').innerHTML = '<h3>Feedback</h3><div class="fbnote"><b>Formative activity</b>Feedback only, so there’s no score. <button class="link" id="fbType">Change the type</button></div>' +
    (off ? '<div class="total"><b>' + STATUS_LABEL[g.status] + '</b><span style="width:100%;font-size:12.5px">Nothing to give feedback on. Click it again under Mark as to take this off.</span></div>'
      : '<button class="fbtog" id="fbTog" role="switch" aria-checked="' + on + '"><span class="bx">' + (on ? '✓' : '') + '</span><span>Feedback complete<small>' + (on ? 'Click again to undo.' : 'Click, or press F, when you’ve finished with this paper.') + '</small></span></button>') +
    statusHtml(st, true) + cmtHtml(g) +
    '<div class="nav"><button class="btn navi" id="prevBtn" aria-label="Previous student" title="Previous student (←)" ' + (navAt ? '' : 'disabled') + '>‹</button>' + (off || on ? '<button class="btn primary" id="nextBtn" ' + (last ? 'disabled' : '') + '>Next ▶</button>' : '<button class="btn primary" id="fbNext">Complete' + (last ? '' : ' and next ▶') + '</button>') + oneOutHtml(st) + '</div>' +
    (batch.students.some(s => !noScore(s) && !s.grade.fb && s !== st) ? '<button class="link nextun" id="nextUn" title="Opens the next student whose feedback isn’t complete">Next without feedback <kbd>N</kbd></button>' : '') +
    histSlot(st) +
    '<div class="hint"><kbd>F</kbd> feedback complete · <kbd>Shift</kbd> <kbd>F</kbd> complete and next · <button class="link" data-keys style="font-size:12.5px">All keys ( ? )</button></div>';
}
function fbToggle(next) {
  const st = batch.students[cur]; if (noScore(st)) return;
  setFb(st, next ? true : !st.grade.fb);
  renderList();
  if (next && navOrder().indexOf(cur) < navOrder().length - 1) stepStudent(1); else renderGrade();
}
function totalHtml(st) {
  const gr = gradeOf(st), own = ownGrade(st);
  if (noScore(st)) return '<b>' + STATUS_LABEL[gr.status] + '</b><span style="width:100%;font-size:12.5px">No score counts. Giving a score takes this off.</span>';
  let h = '<b>' + (gr.total == null ? '–' : fmtNum(gr.total)) + '</b><span>/ ' + (gr.outOf != null ? fmtNum(gr.outOf) : maxPoints()) + '</span><span class="pc">' + (gr.pct == null ? '' : fmtPct(gr.pct)) + '</span>';
  if (gr.partial) h += '<span class="sc-warn" style="width:100%">Partial: ' + partNote(st) + '. This total isn’t final.</span>';
  if (gr.paper) h += '<span style="width:100%;font-size:12.5px">From the paper (Grade sheet)</span>';
  const ps = paperScore(st);
  if (own.total != null && ps != null && Math.abs(ps - own.total) > 0.001) h += '<span class="sc-warn" style="width:100%">The paper says ' + fmtNum(ps) + '</span>';
  return h;
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
    st.grade.rubric[i] = st.grade.rubric[i] === v ? null : v;
    scoreTouched(st, i);
    renderGrade(); renderList(); saveSoon(); return;
  }
  const sb = e.target.closest('[data-status]'); if (sb) return setStatus(batch.students[cur], sb.dataset.status);
  if (e.target.closest('#outAvg, [data-outoff]')) return setOutAvg(batch.students[cur]);
  if (e.target.closest('#prevBtn')) stepStudent(-1);
  if (e.target.closest('#nextBtn')) stepStudent(1);
  if (e.target.closest('#nextUn')) return nextUnscored();
  if (e.target.closest('[data-gcalc]')) return openCalc();
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
  st.grade.rubric[i] = v; scoreTouched(st, i);
  r.classList.remove('unset'); r.setAttribute('aria-valuetext', fmtNum(v) + ' out of 4');
  const crit = r.closest('.crit'), em = crit.querySelector('.cn em'); if (em) em.textContent = fmtNum(v) + ' / 4';
  for (const t of crit.querySelectorAll('.sticks button')) t.setAttribute('aria-pressed', String(+t.dataset.v === v));
  const lv = crit.querySelector('.lvtxt'); if (lv) lv.innerHTML = levelHint(i, v);
  const tot = $('#grade .total'); if (tot) tot.innerHTML = totalHtml(st);
  const gs = $('#gstat'); if (gs) gs.outerHTML = statusHtml(st);
  renderList(); saveSoon();
}
// After the mouse, focus leaves the slider so ← → go on moving between students. After the keyboard, it stays.
let slidePtr = false;
function slideDone(r) { const i = r.closest('.scores').dataset.c, kb = !slidePtr; slidePtr = false; renderGrade(); const again = $('#grade .scores[data-c="' + i + '"] .srange'); if (again && kb) again.focus({ preventScroll: true }); }
$('#grade').addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('.srange')) slidePtr = true; });
$('#grade').addEventListener('input', e => { if (e.target.classList.contains('srange')) slideTo(e.target, RUBRIC_STEPS[+e.target.value]); });
$('#grade').addEventListener('change', e => { if (e.target.classList.contains('srange')) slideDone(e.target); });
// A first touch on the very spot the faded slider rests on changes nothing, so it wouldn't count. This counts it.
$('#grade').addEventListener('pointerup', e => {
  const r = e.target.closest && e.target.closest('.srange'); if (!r || !r.classList.contains('unset')) return;
  setTimeout(() => { if (r.isConnected && r.classList.contains('unset')) { slideTo(r, RUBRIC_STEPS[+r.value]); slideDone(r); } }, 0);
});
// Delete or Backspace clears the row, the way clicking its score again does.
$('#grade').addEventListener('keydown', e => {
  if (!e.target.classList || !e.target.classList.contains('srange') || (e.key !== 'Delete' && e.key !== 'Backspace')) return;
  e.preventDefault(); e.stopPropagation();
  const st = batch.students[cur], i = +e.target.closest('.scores').dataset.c; if (st.grade.rubric[i] == null) return;
  st.grade.rubric[i] = null; scoreTouched(st, i); renderList(); saveSoon(); slideDone(e.target);
});
$('#grade').addEventListener('input', e => {
  const st = batch.students[cur];
  if (e.target.id === 'cmtIn') { st.grade.comment = e.target.value; touchGrade(st); saveSoon(); }
  if (e.target.id === 'ptsIn') {
    st.grade.points = e.target.value; const was = st.grade.status; scoreTouched(st); saveSoon(); renderList();
    if (was !== st.grade.status) { $('#gstat').outerHTML = statusHtml(st); }
    $('#grade .total').innerHTML = totalHtml(st);
  }
});
$('#grade').addEventListener('keydown', e => {   // Enter or Escape leaves the box, so the arrow keys go back to moving between students
  if ((e.target.id === 'ptsIn' && e.key === 'Enter') || (e.target.id === 'cmtIn' && e.key === 'Escape')) { e.preventDefault(); e.target.blur(); }
  if (e.target.id === 'ptsIn' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); e.stopPropagation(); stepStudent(e.key === 'ArrowDown' ? 1 : -1); }   // not half a point up or down: these keys move between students
});
$('#grade').addEventListener('wheel', e => { if (e.target.id === 'ptsIn') e.target.blur(); }, { passive: true });   // scrolling past the box mustn't change the score in it

/* ---------------- every key, in one list ( ? ) ---------------- */
function openKeys() {
  const row = (k, t) => '<span>' + keyLabel(k).split(' ').map(x => '<kbd>' + esc(x) + '</kbd>').join(' ') + '</span><span>' + keyLabel(t) + '</span>';
  openDlg('<div class="bh"><h2>Keys</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb"><div class="keys">' +
    '<h4>Students</h4>' + row('← →', 'Previous / next student (also ↑ ↓)') + row('N', 'Next student without a full score') + row('/', 'Find a student by name') +
    '<h4>Marking</h4>' + row('V', 'Select') + row('P', 'Pen (hold Shift for a straight line)') + row('H', 'Highlight, snapping to typed lines. Press H again for freehand (Shift for straight)') + row('O', 'Circle') + row('T', 'Text') + row('C', 'Comment') + row('K', 'Check mark') + row('E', 'Eraser') +
    row('⌘Z', 'Undo') + row('⇧⌘Z', 'Redo (⌘Y works too)') +
    '<h4>A picked mark (Select tool)</h4>' + row('← → ↑ ↓', 'Nudge it (Shift for bigger steps)') + row('⌘C ⌘V', 'Copy it, then paste on the page you’re looking at, even on another student’s paper') + row('⌘D', 'Make a copy of it') + row('+ −', 'Make it bigger or smaller (or drag the square at its corner)') + row('Delete', 'Remove it') + row('Esc', 'Let go of it (the arrows go back to moving between students)') +
    '<h4>The paper</h4>' + row('⌘+ ⌘−', 'Zoom in / out (or pinch, or ⌘-scroll)') + row('⌘0', 'Back to 100%') + row('[ ]', 'Fold away the student list / score panel') +
    'Turn a page: point at it and use ⟲ ⟳ in its top corner, or “Turn all pages” under the file’s ⋯. In Arrange pages, pick pages and press R.'.replace(/^/, '<h4>Turning pages</h4><span style="grid-column:1/-1">') + '</span>' +
    '<h4>Other</h4>' + row('=', 'Calculator') + row('Shift =', 'Answer, in the calculator (= on its own adds, Enter answers too)') + row('Space', 'Play / pause a recording') + row('J L', 'Back / ahead 5 seconds') + row('?', 'This list') +
    '</div></div><div class="bf"><span class="muted gsVer" style="margin-right:auto;font-size:13px">' + esc(versionLabel()) + '</span><button class="btn primary" data-close>Close</button></div>', true);
  $('#dlgBox').onclick = e => { if (e.target.closest('[data-close]')) closeDlg(); };
}
// The preview copy says so, because its saved work is separate from the real link's.
const versionLabel = () => 'Grading Studio version ' + gsData.APP_VERSION + (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? ' · preview copy, with its own saved work' : '');

