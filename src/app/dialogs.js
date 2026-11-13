/* ---------------- dialogs ---------------- */
// #dlgBox stays for good and each dialog hangs its own handlers on it. They all go when that dialog goes, so a leftover can't answer the next dialog's buttons or keys.
let dlgOff = new AbortController();   // for the handlers a dialog adds with addEventListener
let dlgGone = null;   // for a dialog someone's waiting on: what to do when it goes, however it goes
function dlgClear() {
  dlgOff.abort(); dlgOff = new AbortController();
  const box = $('#dlgBox'); box.onclick = box.onchange = box.oninput = box.ondblclick = box.onkeydown = null;
  const gone = dlgGone; dlgGone = null; if (gone) gone();
}
// The Grades, Insights and Return tabs of an open assignment are these same boxes, drawn on the page in place of the papers and not over them: each
// has its own address, and Back and Refresh work. dlgTab: the tab whose screen the next openDlg draws (tabNext sets it on the line before).
// dlgPage: the tab's screen that is on the page now ('' for a box over the page, or none).
let dlgTab = '', dlgPage = '';
function dlgPlace(page) {
  const d = $('#dlg'), host = page ? $('#cols') : document.body, box = $('#dlgBox');
  if (d.parentNode !== host) { if (page) host.appendChild(d); else host.insertBefore(d, $('.toast')); }
  d.classList.toggle('aspage', !!page);
  for (const c of $('#cols').children) if (c !== d) c.inert = !!page;   // the papers underneath take no Tab and no click while a tab's screen covers them
  box.setAttribute('role', page ? 'region' : 'dialog');
  if (page) box.removeAttribute('aria-modal'); else box.setAttribute('aria-modal', 'true');
}
// Says the box about to open is this tab's screen, and puts its address in the bar. Outside an open assignment it does nothing, and the box opens as a box.
function tabNext(key) {
  if (!batch || $('#app').hidden) return false;
  dlgTab = key;
  const h = batchHash(batch.id, key); if (location.hash !== h) location.hash = h;   // applyRoute finds this screen already drawn
  return true;
}
// The two views of a tab, as links in its heading.
const tabSeg = (tab, on, views) => batch ? '<span class="seg vseg" role="group">' + views.map(([sub, l]) => '<a href="' + batchHash(batch.id, tab + (sub ? '/' + sub : '')) + '"' + (sub === on ? ' aria-current="page"' : '') + '>' + l + '</a>').join('') + '</span>' : '';
// lg: a box that is put into the app's language (lang.js); the others are still in English, whole.
function openDlg(html, narrow, lg) {
  commitEditors(); dlgClear(); ovTipHide();
  const tab = dlgTab; dlgTab = '';
  dlgPage = tab; dlgPlace(tab);
  $('#dlgBox').className = 'box' + (narrow && !tab ? ' narrow' : '');
  $('#dlgBox').toggleAttribute('data-lg', !!lg);
  $('#dlgBox').innerHTML = html; $('#dlg').hidden = false; dlgShown();
  if (shellReady) tabsRender();
}
function dlgShut() { ovTipHide(); dlgClear(); if (eachKeys) { document.removeEventListener('keydown', eachKeys, true); eachKeys = null; } $('#dlg').hidden = true; $('#dlgBox').innerHTML = ''; $('#dlgBox').removeAttribute('data-lg'); dlgPage = ''; dlgPlace(''); }
function closeDlg() {
  const was = dlgPage;
  dlgShut(); dlgFocusBack();
  if (!batch || $('#app').hidden || !routeNow().tab) return;
  // The same click may open another box next (Mark key from the Return screen, a student's paper). Only once it's over:
  queueMicrotask(() => {
    if (!$('#dlg').hidden || !batch || $('#app').hidden) return;
    const r = routeNow(); if (r.v !== 'a' || !r.tab) return;
    if (was) go(batchHash(batch.id));   // leaving a tab's screen is going back to the papers
    else tabShow(r);                     // a box over a tab's screen has gone: the screen again, as it stands now
  });
}
$('#dlg').addEventListener('pointerdown', e => { if (e.target.id === 'dlg' && !dlgPage) { if (SP) splitLeave(); else leaveDlg(); } });
// From any screen or box straight to a paper. A box over a tab's screen would otherwise fall back to that screen when it closes.
function toPaper(i, path) { closeDlg(); if (batch && routeNow().tab) go(batchHash(batch.id)); return openStudent(i, path); }
const TAB_DRAW = { grades: () => openGrades(), 'grades/sheet': () => openSheet(false), insights: () => openOverview(), 'insights/consistency': () => openCons(), examples: () => openExamples(), return: () => openExport() };
// The screen for where the address says she is in the open assignment.
function tabShow(r) {
  const key = r.tab ? r.tab + (r.sub ? '/' + r.sub : '') : '';
  if (shellReady) tabsRender();
  if (!key) { if (dlgPage) { dlgShut(); dlgFocusBack(); } return; }
  if (dlgPage !== key && (dlgPage || $('#dlg').hidden)) TAB_DRAW[key]();   // a box over the screen stays; closing it draws the screen
}

// Under the rows in Rubric setup: how every row is scored. 0 to 4 with half points unless the teacher says otherwise.
function rowScaleHtml(d) {
  const t = rowsTop(d);
  let o = t ? '' : '<option value="" selected>each its own</option>';
  for (let k = 1; k <= ROW_TOP_MAX; k++) o += '<option value="' + k + '"' + (k === t ? ' selected' : '') + '>' + k + '</option>';
  return '<div class="rowscale"><label for="rowTopSel">Each row is scored 0 to</label><select id="rowTopSel" class="btn sm">' + o + '</select>' +
    '<label class="rowhalf"><input type="checkbox" id="rowHalfIn"' + (rowHalf(d) ? ' checked' : '') + '> Half points</label>' +
    '<span class="muted">Out of ' + rowsMax(d) + ' in all.</span></div>';
}
// A draft's total: a rubric's rows on their own scales, or the whole number of points.
const draftMax = d => d.mode === 'rubric' ? rowsMax(d) : Math.round(+d.outOf || 0);
// pre: { draft, page } to start from, as when a rubric was brought in from the assignment's card (rubricup.js)
function openSetup(pre) {
  let draft = JSON.parse(JSON.stringify(pre && pre.draft || setup));
  let newPage = pre && pre.page ? pre.page : undefined;   // undefined: unchanged, null: removed, {bytes,name}: new upload
  let found = null;   // rows read from the rubric file just brought in
  const scaleRows = () => {
    const max = draftMax(draft);
    if (!draft.scale) return '<p class="muted" style="font-size:13px;margin:4px 0 0">No scale: percent is the plain share of points.</p>';
    if (max > 40) return '<p class="muted" style="font-size:13px">A scale needs a total of 40 or less.</p>';
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px 10px;margin-top:6px">';
    for (let k = max; k >= 0; k--) h += '<label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600"><span style="width:22px;text-align:right">' + k + '</span>=<input type="number" step="0.5" data-sk="' + k + '" value="' + esc(draft.scale[k] == null ? '' : draft.scale[k]) + '" style="width:54px;border:1px solid var(--line-strong);border-radius:6px;padding:4px;background:var(--surface)">%</label>';
    return h + '</div><p class="muted" style="font-size:12.5px;margin:6px 0 0">Leave a row blank if you never use it. Half points land between two rows.</p>';
  };
  const body = () => {
    let h = '<div class="field"><label>How do you score this one?</label><span class="seg"><button data-m="points" aria-pressed="' + (draft.mode === 'points') + '">Just the total</button><button data-m="rubric" aria-pressed="' + (draft.mode === 'rubric') + '">Rubric rows</button></span>' +
      '<span class="muted" style="font-size:12.5px;margin-top:4px">Grading right on your own rubric? Use Just the total: one score box, and the Grades tab and percents still work.</span></div>';
    h += rubricLibHtml(draft);
    if (draft.mode === 'rubric') {
      h += '<div class="field"><label>Rubric rows</label>' + draft.criteria.map((c, i) => '<div class="critrow"><input type="text" data-ci="' + i + '" value="' + esc(c) + '">' + goalRowHtml(draft, i) + (draft.criteria.length > 1 ? '<button class="btn sm" data-rm="' + i + '" aria-label="Remove row">×</button>' : '') + '</div>' + levelsEditHtml(draft, i)).join('') +
        (draft.criteria.length < 6 ? '<div><button class="btn sm" data-add>+ Add a row</button></div>' : '') + rowScaleHtml(draft) + '</div>';
    } else {
      h += '<div class="field"><label for="outOf">Out of</label><input type="number" id="outOf" min="1" step="0.5" value="' + esc(draft.outOf) + '" style="width:120px"></div>';
    }
    h += goalsSetupHtml(draft);
    h += '<div class="field"><label>Grading scale</label><span style="display:flex;gap:6px;flex-wrap:wrap">' + (me().scale12 ? '<button class="btn sm" data-preset="usual">12 = 100, 11 = 95, 10 = 91…</button>' : '') + '<button class="btn sm" data-preset="fives">Steps of 5 (9 = 85%)</button><button class="btn sm" data-preset="none">No scale</button>' + scaleBankHtml(draft, draftMax(draft)) + '</span>' + scaleRows() + '</div>';
    const rp = newPage === undefined ? draft.rubricPage : newPage;
    h += '<div class="field"><label>Your rubric, for every student</label><span class="muted" style="font-size:13px">Bring in your rubric once and every student gets their own copy to grade on. A Word rubric (.docx or .docm) stays a Word file: type in it, check its boxes and shade its cells. A PDF or picture is added as a page you can mark up. Each copy goes back with that student’s work.</span>' +
      '<span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px"><button class="btn sm" data-rpup>' + (rp ? 'Replace…' : 'Bring in my rubric…') + '</button>' +
      (rp ? '<span style="font-size:13px;font-weight:600">' + esc(rp.name || 'Rubric page') + '</span><span class="seg"><button data-pos="end" aria-pressed="' + ((draft.rubricPos || 'end') === 'end') + '">After their work</button><button data-pos="start" aria-pressed="' + (draft.rubricPos === 'start') + '">Before</button></span><button class="link" data-rprm>Remove</button>' : '') +
      '</span>' + (found ? '<span class="rufound"><span>Rows were found in it.</span> <button class="btn sm" data-rpuse>Use these rows</button></span>' : '') + '<input type="file" id="rpIn" hidden></div>';
    h += '<p class="muted" style="font-size:13px;margin:0">Scores you already gave stay put if you rename rows.' + (batch && batch.assignment ? ' This setup is remembered for “' + esc(batch.assignment.name) + '”.' : '') + '</p>';
    return h;
  };
  openDlg('<div class="bh"><h2>Rubric setup</h2></div><div class="bb" id="setupBody">' + body() + '</div><div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-save>Save</button></div>', true);
  const box = $('#dlgBox'), re = () => { $('#setupBody').innerHTML = body(); };
  rubricsSetup(draft, re, () => newPage !== undefined);
  const live = { signal: dlgOff.signal };
  box.addEventListener('input', e => {
    if (e.target.dataset.ci != null) draft.criteria[+e.target.dataset.ci] = e.target.value;
    if (e.target.id === 'outOf') draft.outOf = e.target.value;
    if (e.target.dataset.sk != null && draft.scale) { const v = e.target.value; if (v === '') delete draft.scale[e.target.dataset.sk]; else draft.scale[e.target.dataset.sk] = +v; }
  }, live);
  box.addEventListener('change', async e => {
    if (e.target.id === 'rowTopSel') { const t = topOk(e.target.value); if (t) { delete draft.tops; if (t === ROW_TOP) delete draft.top; else draft.top = t; levelEditOpen.clear(); } return re(); }
    if (e.target.id === 'rowHalfIn') { if (e.target.checked) delete draft.half; else draft.half = false; return re(); }
    if (e.target.id !== 'rpIn' || !e.target.files[0]) return;
    const f = e.target.files[0], bytes = new Uint8Array(await f.arrayBuffer());
    try {
      if (WORD_RX.test(f.name)) {
        openWord(bytes);
        newPage = { bytes, name: f.name };
        try { found = ruFromWord(bytes); } catch { found = null; }
        if (!draft.rubricPos) draft.rubricPos = 'start';   // a Word rubric sits above their work unless she moves it
      } else {
        if (isImg(f.name) && !await picReads(bytes)) throw new Error('damaged');
        const pdf = isImg(f.name) ? await imageToPdf(bytes, f.name) : IMG_MORE.test(f.name) ? await anyImageToPdf(bytes) : bytes;
        await PDFLib.PDFDocument.load(pdf, { ignoreEncryption: true });
        newPage = { bytes: pdf, name: f.name };
        found = pdf === bytes ? await ruFromPdf(bytes).catch(() => null) : null;
      }
      if (found && !found.rows.length) found = null;
      if (draft.mode === 'rubric' && draft.criteria.every((c, i) => c === 'Criterion ' + (i + 1))) { draft.outOf = rowsMax(draft); draft.mode = 'points'; }   // her rubric replaces the generic rows
      re();
    } catch { toast('That file couldn’t be opened as a Word file, PDF or picture'); }
  }, live);
  box.addEventListener('click', async e => {
    const m = e.target.closest('[data-m]'); if (m) { draft.mode = m.dataset.m; return re(); }
    const rm = e.target.closest('[data-rm]'); if (rm) { draft.criteria.splice(+rm.dataset.rm, 1); levelsRowGone(draft, +rm.dataset.rm); return re(); }
    if (e.target.closest('[data-add]')) { draft.criteria.push('Criterion ' + (draft.criteria.length + 1)); if (Array.isArray(draft.tops)) draft.tops.push(null); if (Array.isArray(draft.ib)) draft.ib.push(null); rubDlg.from.push(null); return re(); }
    const pr = e.target.closest('[data-preset]');
    if (pr) {
      const max = draftMax(draft);
      if (pr.dataset.preset === 'none') draft.scale = null;
      else if (max === 12) draft.scale = { ...(pr.dataset.preset === 'usual' ? SCALE12 : SCALE_FIVES) };
      else { draft.scale = {}; for (let k = max; k >= 0; k--) draft.scale[k] = Math.round((pr.dataset.preset === 'fives' ? 100 - (max - k) * 5 : k / max * 100) * 10) / 10; }
      return re();
    }
    const pos = e.target.closest('[data-pos]'); if (pos) { draft.rubricPos = pos.dataset.pos; return re(); }
    if (e.target.closest('[data-rpup]')) return $('#rpIn').click();
    if (e.target.closest('[data-rprm]')) { newPage = null; found = null; return re(); }
    if (e.target.closest('[data-rpuse]') && found) { rubricRowsInto(draft, found); levelEditOpen.clear(); if (rubDlg) rubDlg.from = draft.criteria.map((_, i) => i < rubDlg.n0 ? i : null); found = null; return re(); }
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target.closest('[data-save]')) {
      if (newPage !== undefined) await Promise.all([...wordSaves].map(s => s()));   // boxes highlighted a moment ago count
      const note = setupSaveNote(draft, newPage);   // the dialog stays open behind this, so "Go back" loses nothing
      if (note && !await askDlg(note, { ok: 'Save', cancel: 'Go back' })) return;
      draft.criteria = draft.criteria.map((c, i) => c.trim() || 'Criterion ' + (i + 1));
      draft.levels = tidyLevels(draft);
      { const rs = rowScaleOf(draft); for (const k of ['top', 'tops', 'half']) delete draft[k]; if (draft.mode === 'rubric') Object.assign(draft, rs); }   // only a scale that isn't 0 to 4 with halves is written down
      draft.goals = goalsTidy(draft);
      if (batch && rubDlg.goalAll !== (batch.goal || '')) { if (rubDlg.goalAll) batch.goal = rubDlg.goalAll; else delete batch.goal; }
      if (newPage === null) { if (draft.rubricPage) store.del('gs.rp.' + draft.rubricPage.id); draft.rubricPage = null; }
      else if (newPage) {
        const id = uid();
        let bin = ''; for (let i = 0; i < newPage.bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, newPage.bytes.subarray(i, i + 0x8000));
        if (!store.set('gs.rp.' + id, btoa(bin))) { toast('That rubric file is too big to keep. Try a smaller PDF or a screenshot.'); return; }
        if (draft.rubricPage) store.del('gs.rp.' + draft.rubricPage.id);
        draft.rubricPage = { id, name: newPage.name };
      }
      const pageChanged = JSON.stringify(draft.rubricPage) !== JSON.stringify(setup.rubricPage) || draft.rubricPos !== setup.rubricPos;
      rowsTakenOut();
      setup = draft; store.set('gs.setup', { ...setup, spot: undefined, rubricPage: undefined });
      if (batch && batch.assignment) { batch.assignment.setup = { ...setup, spot: undefined }; shareRubric(batch.assignment); saveLib(); }
      if (batch) batch.students.forEach(refound);
      closeDlg(); renderGrade(); renderList(); saveSoon();
      for (const el of document.querySelectorAll('.docx')) if (el.wordShow) el.wordShow();   // the percent over an open Word rubric follows the new setup
      if (pageChanged && batch) applyRubricPage().then(() => { scanned = false; openStudent(cur); scanAll(); wordLinesFollow(); });
      else wordLinesFollow();
    }
  }, live);
}
// The rubric page is added to every student as a file of its own ("Rubric page"), placed inside their first file.
const RUBRIC_NAME = 'Rubric page.pdf';
const rubricBytes = () => { const rp = setup.rubricPage; if (!rp) return null; const b64 = store.get('gs.rp.' + rp.id, null); if (!b64) return null; const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
async function applyRubricPage(only) {
  const bytes = rubricBytes(), rp = setup.rubricPage, isWord = !!rp && WORD_RX.test(rp.name || '');
  let n = 0;
  if (bytes && !isWord) { try { n = (await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount(); } catch {} }
  for (const st of only || batch.students) {
    const old = st.files.find(f => f.virtual);
    st.files = st.files.filter(f => !f.virtual);
    const real = st.files.filter(viewable);
    if (st.layout) for (const d of st.layout) d.pages = d.pages.filter(([path]) => !old || path !== old.path);
    if (bytes && isWord) {   // each student gets their own copy of her Word rubric, edited and returned like any Word file
      const any = st.files.find(f => f.path.includes('/')), dir = any ? any.path.slice(0, any.path.lastIndexOf('/') + 1) : st.key + '/';
      const name = rp.name.replace(/[\\/]+/g, '-'), mv = batch.moved || {}, path = old && old.path.endsWith('/' + name) && mv[old.path] === st.key ? old.path : dir + name, keep = old && old.kind === 'docx' && old.edited ? old : null;   // a copy that went with its score keeps its path, like any moved file. A copy she's worked on stays hers, even under a rubric with a new name
      if (mv[path] && mv[path] !== st.key) continue;   // this one went with its score to someone with no copy of their own
      const nf = { path, name: rp.name, kind: 'docx', data: keep ? keep.data : bytes, orig: keep ? bytes : null, edited: keep ? keep.edited : 0, size: bytes.length, marks: {}, virtual: true, rubric: true };   // its original is the rubric as it is now, so Back to the original starts her over on it
      st.files.push(nf);
      if (keep && await keepEdit(st, nf) && keep.path !== path) await dropEdit(st, keep);
      continue;
    }
    if (!bytes || !n || !real.length) continue;
    const dir = real[0].path.includes('/') ? real[0].path.slice(0, real[0].path.lastIndexOf('/') + 1) : st.key + '/';
    const f = { path: dir + RUBRIC_NAME, name: 'Rubric page', kind: 'pdf', data: bytes, size: bytes.length, marks: old && old.path === dir + RUBRIC_NAME ? old.marks : {}, hand: old && old.hand, virtual: true, numPages: n };
    st.files.push(f);
    if (st.layout && st.layout.length) {
      const pg = [...Array(n).keys()].map(p => [f.path, p]);
      st.layout[0].pages = setup.rubricPos === 'start' ? pg.concat(st.layout[0].pages) : st.layout[0].pages.concat(pg);
    }
  }
}
let gradesOrder = 'roster';
// Rows in folder order, or in roster order with gaps for students who turned nothing in.
function gradeRows() {
  const c = batchClass();
  if (gradesOrder !== 'roster' || !c || !c.names.length) return batch.students.map((st, i) => ({ st, i })).sort((a, b) => gradesOrder === 'folder' ? natural(a.st.key, b.st.key) : 0);
  const m = rosterMatch(c.names), used = new Set(m.values());
  return c.names.map(n => m.has(n) ? { st: m.get(n), i: batch.students.indexOf(m.get(n)), rn: n } : { missing: n })
    .concat(batch.students.filter(st => !used.has(st)).map(st => ({ st, i: batch.students.indexOf(st), off: true })));
}
function openGrades() {
  if (rereadsPending()) { rereadsDone().then(openGrades); return; }   // a grade she just typed or changed counts here
  const rub = setup.mode === 'rubric', c = batchClass(), ib = ibSetup(), banded = !ib && !!(meGrade() || {}).bands;   // an MYP task (ib.js) shows its levels and a status, with no total, percent or grade column;   // a teacher who grades in letters or 1 to 7 gets that grade in its own column
  const rows = gradeRows().map(({ st, i, missing, off }, k) => {
    if (missing) return '<tr><td class="n">' + (k + 1) + '</td><td class="nm" style="cursor:default">' + esc(missing) + (c ? ' ' + whoBtn('data-wc="' + esc(c.id) + '" data-wn="' + esc(missing) + '"', missing) : '') + ' <span class="muted" style="font-weight:400">(no folder: nothing turned in)</span></td>' + (rub ? setup.criteria.map(() => '<td></td>').join('') : '') + '<td></td>' + (ib ? '' : '<td></td>') + (banded ? '<td></td>' : '') + '<td></td><td></td></tr>';
    const g = gradeOf(st);
    const cells = rub ? setup.criteria.map((_, q) => '<td class="c" data-copy="' + fmtNum(rowShown(st, q)) + '">' + fmtNum(rowShown(st, q)) + '</td>').join('') : '';
    return '<tr class="go" data-i="' + i + '"><td class="n">' + (k + 1) + '</td><td class="nm">' + esc(st.key) + (anonOn() ? '' : ' ' + whoBtn('data-wi="' + i + '"', st.key)) + (st.files.length ? '' : ' <span class="muted" style="font-weight:400">(nothing turned in)</span>') + (off ? ' <span class="pill" style="font-size:11px;padding:2px 7px;border-radius:999px;background:var(--warn-soft);color:var(--warn)">not on roster</span>' : '') + '</td>' + cells +
      '<td class="c' + (g.partial ? ' part" data-partial="1' : '') + '" data-copy="' + esc(ib ? '' : cellCopy(g, 'total')) + '">' + (ib ? '' : totalText(g)) + statusPills(g) + (g.total == null && g.pct == null && ((st.doubts && st.doubts.length) || manyReads(st)) ? ' <span class="stag" title="Confirm it on the Grade sheet">to confirm</span>' : '') + (g.paper ? ' <span class="muted" style="font-weight:400;font-size:12px" title="Read from the paper">(paper)</span>' : '') + '</td>' + (ib ? '' : '<td class="c' + (g.partial ? ' part" data-partial="1' : '') + '" data-copy="' + esc(cellCopy(g, 'pct')) + '">' + fmtPct(g.pct) + '</td>') + (banded ? '<td class="c" data-copy="' + esc(bandOf(g.pct)) + '">' + esc(bandOf(g.pct)) + '</td>' : '') +
      '<td class="op" data-op="' + i + '"></td><td class="cm" data-copy="' + esc(st.grade.comment) + '">' + esc(st.grade.comment) + '</td></tr>';
  }).join('');
  tabNext('grades');
  openDlg('<div class="bh"><h2>Grades</h2><span class="muted" id="glSum">' + gradesSummary() + '</span>' +
    (c ? '<span class="seg" style="margin-left:8px"><button data-ord="folder" aria-pressed="' + (gradesOrder === 'folder') + '">Folder order</button><button data-ord="roster" aria-pressed="' + (gradesOrder === 'roster') + '">' + esc(c.name) + ' roster order</button></span>' : '') +
    '<span class="sp"></span>' + tabSeg('grades', '', GRADE_VIEWS) + '<button class="icon" data-close aria-label="Close">✕</button></div>' +
    '<div class="bb" id="glBody"><div id="glChk" hidden></div><p class="muted" style="margin:0 0 10px;font-size:14px">Click any score or comment to copy it, then paste it into ' + esc(sysOr('your gradebook')) + '. Click a name to open that paper.' + (c ? '' : ' Pick a roster under Setup to see this list in roster order.') + '</p>' +
    '<table class="gl" id="glTable"><thead><tr><th>#</th><th>Student</th>' + (rub ? setup.criteria.map(x => '<th>' + esc(x) + '</th>').join('') : '') + (ib ? '<th>Status</th>' : '<th>Total /' + maxPoints() + '</th><th>%</th>') + (banded ? '<th>Grade</th>' : '') + '<th title="The grade written on the paper itself, read from the file">On the paper</th><th>Comment</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="bf">' + mbLink(c, 'btn') + '<span style="margin-right:auto"></span>' + (ib ? '<button class="btn" data-cp="lv">Copy all levels</button>' : '<button class="btn" data-cp="total">Copy all totals</button><button class="btn" data-cp="pct">Copy all percents</button>') + '<button class="btn" data-cp="tsv">Copy as a table</button><button class="btn" data-glpdf title="A crop of each grade written on a paper, one row per file">Grade sheet (PDF)</button><button class="btn primary" data-csv>Download spreadsheet (CSV)</button></div>');
  const box = $('#dlgBox');
  glPaper();
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-glonly]')) { const t = $('#glTable'), on = t.classList.toggle('only'); e.target.closest('[data-glonly]').textContent = on ? 'Show everyone' : 'Show only these'; return; }
    if (e.target.closest('[data-glpdf]')) { const b0 = batch; if (!scanned || scanP) { toast('Reading the files first…'); await scanAll(); if (batch !== b0) return; } return saveBlob('Grade sheet - ' + batch.name + '.pdf', new Blob([await buildSheetPdf()], { type: 'application/pdf' })); }
    const o = e.target.closest('[data-ord]'); if (o) { gradesOrder = o.dataset.ord; return openGrades(); }
    const cc = e.target.closest('[data-copy]');
    if (cc && cc.dataset.partial && !await okCellPartial(+cc.closest('tr').dataset.i, cc.dataset.copy)) return;
    if (cc) { copy(cc.dataset.copy, cc.dataset.copy ? 'Copied “' + (cc.dataset.copy.length > 40 ? cc.dataset.copy.slice(0, 40) + '…' : cc.dataset.copy) + '”' : 'That cell is empty'); return; }
    const nm = e.target.closest('tr.go td.nm');
    if (nm) { toPaper(+nm.parentElement.dataset.i); return; }
    const cp = e.target.closest('[data-cp]');
    if (cp) {
      const k = cp.dataset.cp, R = gradeRows();
      if (!await okPartial(R.filter(r => !r.missing).map(r => r.st))) return;
      const lines = R.map(r => { if (r.missing) return k === 'tsv' ? tsvLine([String(R.indexOf(r) + 1), r.missing]) : ''; return k === 'tsv' ? tsvLine(tableRow(r.st, R.indexOf(r))) : k === 'lv' ? setup.criteria.map((_, q) => fmtNum(rowShown(r.st, q))).join('\t') : scoreText(gradeOf(r.st), k); });
      if (k === 'tsv') lines.unshift(tsvLine(tableHead()));
      copy(lines.join('\n'), 'Copied ' + R.length + ' rows in ' + (gradesOrder === 'folder' ? 'folder order' : listOrder()));
    }
    if (e.target.closest('[data-csv]')) {
      const R = gradeRows();
      const csv = [tableHead()].concat(R.map((r, k) => r.missing ? [String(k + 1), r.missing] : tableRow(r.st, k))).map(r => r.map(csvCell).join(',')).join('\r\n');
      saveBlob('Grades - ' + batch.name + '.csv', new Blob(['﻿' + csv], { type: 'text/csv' }));
    }
  };
}
// The two views of the Grades tab: her scores for each student, and the grade written on each paper, cropped from its file.
const GRADE_VIEWS = [['', 'Scores and comments'], ['sheet', 'Grade sheet']];
function tableHead() { return ['#', 'Student'].concat(setup.mode === 'rubric' ? setup.criteria : [], ibSetup() ? [] : ['Total / ' + maxPoints(), 'Percent'], ['Status', 'Comment']); }
function tableRow(st, pos) {
  const g = gradeOf(st), i = pos != null ? pos : batch.students.indexOf(st);
  return [String(i + 1), st.key].concat(setup.mode === 'rubric' ? setup.criteria.map((_, k) => fmtNum(rowShown(st, k))) : [], ibSetup() ? [] : [cellOut(g, 'total'), cellOut(g, 'pct')], [statusText(st), st.grade.comment.replace(/\s*\n\s*/g, ' ')]);
}
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch {} t.remove();
  }
  toast(msg);
}

