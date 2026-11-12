/* ---------------- wiring ---------------- */
let toastT;
function toast(msg, ms) {
  const t = $('.toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; t.textContent = ''; }, ms || 3000);
}
// The Planner is its own page beside this one, with its own code and saved work: nothing from grading goes there.
$('#lessonsBtn').href = /Grading Studio\.html$/i.test(decodeURIComponent(location.pathname)) ? 'Planner.html' : 'planner.html';
$('#addClass').onclick = () => editClass(-1);
$('#setDisp').onclick = openDisplay;
$('#setKeysBtn').onclick = openKeys;
$('#pickFiles').onclick = () => $('#fileIn').click();
$('#pickFolder').onclick = () => pickDir('#dirIn');
$('#pickDrive').onclick = () => openFromDrive(null);
$('#sample').onclick = () => sampleClass();
let scanFor = null;
let scanInto = false;
$('#pickScan').onclick = () => { scanFor = null; scanInto = false; $('#scanIn').click(); };
$('#pickMatch').onclick = () => askFilesOrFolder('Match files to a roster', 'For files that aren’t in one folder per student, like rubrics you marked outside Grading Studio. Each file is matched to a student on your roster by the name in its file name or folder name, and you can fix any match.', list => matchToRoster(list, null));
$('#scanIn').onchange = e => { const f = e.target.files[0]; e.target.value = ''; const into = scanInto && !!batch; scanInto = false; if (f) openSplit(f, scanFor, into); };
$('#fileIn').onchange = e => { const fs = [...e.target.files]; intake(fs.map(f => ({ path: f.name, file: f })), fs.length === 1 ? fs[0].name.replace(/\.[^.]+$/, '') : ''); e.target.value = ''; };
$('#dirIn').onchange = e => {
  const fs = [...e.target.files];
  const top = fs.length ? (fs[0].webkitRelativePath || '').split('/')[0] : '';
  intake(fs.map(f => ({ path: (f.webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name, file: f })), top);
  e.target.value = '';
};
const drop = $('#drop');
['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => { if (batch || ldrag) return; e.preventDefault(); if (e.target.closest && e.target.closest('.card')) return; drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { if (ev === 'dragleave' && e.relatedTarget) return; drop.classList.remove('over'); }));
async function entriesFromDrop(dt) {
  const out = [];
  const entries = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  let label = '';
  if (entries.length) {
    if (entries.length === 1 && entries[0].isDirectory) {   // the dropped folder is the assignment itself
      label = entries[0].name;
      const tmp = []; await walkEntry(entries[0], '', tmp);
      for (const t of tmp) out.push({ path: t.path.split('/').slice(1).join('/'), file: t.file });
    } else for (const en of entries) await walkEntry(en, '', out);
  } else for (const f of dt.files) out.push({ path: f.name, file: f });
  return { list: out, label };
}
document.addEventListener('drop', async e => {
  if (batch) return;
  e.preventDefault();
  if (!e.dataTransfer || !e.dataTransfer.files.length) return;
  const r = await entriesFromDrop(e.dataTransfer);
  intake(r.list, r.label);
});
// With a download open, files dropped on the paper or on a student's name are added to that student.
let dropEl = null;
const setDropEl = el => { if (dropEl === el) return; if (dropEl) dropEl.classList.remove('drop-on'); dropEl = el; if (el) el.classList.add('drop-on'); };
const hasFiles = e => !!e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
const dropTarget = e => {
  if (!e.target.closest) return null;
  const s = e.target.closest('.stu'); if (s) return { el: s, i: +s.dataset.i };
  const p = e.target.closest('#paper'); return p ? { el: p, i: cur } : null;
};
document.addEventListener('dragover', e => {
  if (!batch || ldrag || !hasFiles(e)) return;
  e.preventDefault();   // never let a dropped file replace the page
  const t = $('#dlg').hidden ? dropTarget(e) : null;
  setDropEl(t && t.el); e.dataTransfer.dropEffect = t ? 'copy' : 'none';
});
document.addEventListener('dragleave', e => { if (batch && !e.relatedTarget) setDropEl(null); });
document.addEventListener('drop', async e => {
  if (!batch || !hasFiles(e)) return;
  e.preventDefault(); setDropEl(null);
  const t = $('#dlg').hidden ? dropTarget(e) : null; if (!t) return;
  const onName = t.el.classList.contains('stu');
  const r = await entriesFromDrop(e.dataTransfer);
  if (!onName && r.list.length > 1) return bringIn(r.list);
  addFiles(batch.students[t.i], r.list);
});
$('#trAllBtn').onclick = openTranscripts;
$('#dispBtn').onclick = openDisplay;
$('#mkeyBtn').onclick = () => openMarkKey();
$('#setMkey').onclick = () => openMarkKey();
$('#impBtn').onclick = () => openImported();
// The score panel folds away to give the paper more room; remembered in this browser. ] also folds it.
// (L is from when the student list folded away too. It is kept as it was saved and no longer read: the list is a strip now.)
function setPanels(L, R) {
  const c = $('#cols'); c.classList.toggle('noR', !!R);
  $('#colR').querySelector('.pa').textContent = R ? '‹' : '›';
  $('#colR').title = R ? 'Show the score panel ( ] )' : 'Hide the score panel ( ] )';
  store.set('gs.panels', { L: !!L, R: !!R });
  clearTimeout(resizeT); resizeT = setTimeout(() => pages.forEach(renderPage), 60);
}
const panelsNow = () => ({ L: !!store.get('gs.panels', {}).L, R: $('#cols').classList.contains('noR') });
$('#colR').onclick = () => { const p = panelsNow(); setPanels(p.L, !p.R); };
{ const p = store.get('gs.panels', {}); setPanels(p.L, p.R); }

/* ---------------- the student list: a strip beside the paper, the whole list when it's wanted ---------------- */
// Folded, it is a narrow strip of numbers and scores and the paper has the room. Pointing at it (or / to find someone) opens the whole
// list over the paper's edge, and it folds again when the pointer leaves. [ or the arrow at its edge keeps it open beside the paper.
// Only "kept open" is remembered (gs.listOpen), and only once she chooses it.
let listOpen = !!store.get('gs.listOpen', false), peekT = null;
function listDraw() {
  const c = $('#cols'), b = $('#colL'); c.classList.toggle('open', listOpen); if (listOpen) c.classList.remove('peek');
  b.querySelector('.pa').textContent = listOpen ? '‹' : '›'; b.setAttribute('aria-pressed', String(listOpen));
  b.title = (listOpen ? 'Fold the student list to a strip' : 'Keep the student list open') + ' ( [ )'; b.setAttribute('aria-label', listOpen ? 'Fold the student list to a strip' : 'Keep the student list open');
}
function setList(open) {
  listOpen = !!open; store.set('gs.listOpen', listOpen); clearTimeout(peekT); listDraw(); listToCur();
  clearTimeout(resizeT); resizeT = setTimeout(() => pages.forEach(renderPage), 60);
}
const peekHeld = () => document.activeElement === $('#stuFind') || !!$('#side [data-km][aria-expanded=true]') || $('#side').matches(':hover') || $('#colL').matches(':hover');
function listPeek(on, wait) {
  clearTimeout(peekT); if (listOpen) return;
  const go = () => { if (!on && peekHeld()) return; const c = $('#cols'); if (c.classList.contains('peek') === on) return; c.classList.toggle('peek', on); if (!on && document.activeElement && $('#side').contains(document.activeElement) && !document.activeElement.classList.contains('stu')) document.activeElement.blur(); listToCur(); };
  if (wait) peekT = setTimeout(go, wait); else go();
}
for (const el of [$('#side'), $('#colL')]) {
  el.addEventListener('mouseenter', () => listPeek(true, 160));
  el.addEventListener('mouseleave', () => listPeek(false, 280));
}
$('#side').addEventListener('focusout', () => listPeek(false, 200));
$('#side').addEventListener('dragenter', () => listPeek(true));   // a file dragged to the strip: the names open so it can be dropped on one
// A click on the strip's own tools (find, the filter) opens the list first, so they have room.
$('#side').addEventListener('pointerdown', e => { if (!listOpen && e.target.closest('.lbar')) listPeek(true); }, true);
$('#stuFind').addEventListener('focus', () => listPeek(true));
$('#colL').onclick = () => setList(!listOpen);
listDraw();
$('#lightBtn').onclick = openLight;
$('#rescanBtn').onclick = openRescans;
$('#calcBtn').onclick = openCalc;
$('#bringBtn').onclick = () => {
  askFilesOrFolder('Bring in files', 'Each file goes to its student by the name in its file name or folder name, for example your marked rubrics. You check the matches before anything is added.<br><br><b>Late work:</b> pick the late files, or the whole new download. What’s already here is left out, and you can mark anyone late as you add them.<br><br><b>A scan of papers</b> (like a makeup day): split it page by page onto names, and each student’s pages are added to them here.', bringIn);
  $('#dlgBox .bf').insertAdjacentHTML('afterbegin', '<button class="btn" data-scanin style="margin-right:auto">A scan to split…</button>');
  const box = $('#dlgBox'), was = box.onclick;
  box.onclick = e => { if (e.target.closest('[data-scanin]')) { closeDlg(); scanInto = true; return $('#scanIn').click(); } return was(e); };
};
$('#setupBtn').onclick = openSetup;
$('#sheetBtn').onclick = () => openSheet(false);
$('#shareBtn').onclick = openShare;
$('#backBtn').onclick = openBringBack;
// routed: the address has already moved on (Back, the sidebar), so only the paper is put away.
function closeDownload(routed) {
  if (dlgPage) dlgShut();
  for (const d of docs) d.destroy();
  batch = null; pages = []; docs = []; openToken++;   // a student still opening stops there
  histAll = null;   // Past work is read again next time: she may forget a download from Home
  $('#paper').innerHTML = '';
  if (!routed && routeNow().v === 'a') { routeTok++; routeOpening = ''; go('#/', true); }
  else showScreen(routeNow().v === 'a' ? { v: 'opening' } : routeNow());
  renderLib(); loadKept();
}
$('#closeBtn').onclick = () => {
  commitEditors(); saveNow();   // what she's still typing first, so it's in this save
  go('#/');   // closes it on the way
};
document.addEventListener('keydown', e => {
  if (!batch || !$('#dlg').hidden) { if (e.key === 'Escape' && !$('#dlg').hidden) { if (SP) splitLeave(); else leaveDlg(); } return; }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) || (document.activeElement && document.activeElement.isContentEditable);
  const cmd = e.metaKey || e.ctrlKey, key = e.key.toLowerCase();
  // On a score's slider Ctrl Z is hers too: a slider has no typing of its own to undo.
  if (cmd && !e.altKey && typing && document.activeElement.type === 'range' && (key === 'z' || key === 'y')) { e.preventDefault(); key === 'z' && !e.shiftKey ? undo() : redo(); return; }
  if (cmd && !typing && !e.altKey) {
    if (key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (key === 'y') { e.preventDefault(); redo(); return; }
    if (key === '=' || key === '+') { e.preventDefault(); setZoom(zoom + 0.15); return; }
    if (key === '-' || key === '_') { e.preventDefault(); setZoom(zoom - 0.15); return; }
    if (key === '0') { e.preventDefault(); setZoom(1); return; }
    if (key === 'c' && selected && !String(getSelection())) { e.preventDefault(); copyMark(); return; }
    if (key === 'v' && markClip) { e.preventDefault(); pasteMark(); return; }
    if (key === 'd' && selected) { e.preventDefault(); copyMark(true); pasteMark(); return; }
  }
  // Scoring from the keyboard: a number for the row in hand, Enter for the next student. These work from a rubric slider too.
  const onRange = !!(document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('srange'));
  if (!e.metaKey && !e.ctrlKey && !e.altKey && (!typing || onRange) && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName === 'INPUT' && e.target.type === 'range' ? '' : e.target.tagName) && scoreKey(e, onRange)) return;
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape' && once) { e.preventDefault(); endOnce(); return; }
  if (e.key === '?') { e.preventDefault(); openKeys(); return; }
  // A picked sticker, mark, check, circle or text box: + and − make it bigger or smaller.
  if ((e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') && selected && !(selected.fresh && selected.mark.t === 'text') && canResize(selected.mark)) { e.preventDefault(); stepSize(e.key === '+' || e.key === '=' ? 1 : -1); return; }
  if (e.key === '/') { e.preventDefault(); $('#stuFind').focus(); return; }
  // A picked mark moves with the arrow keys (Shift for bigger steps); Esc lets go of it.
  if (selected && tool === 'select' && /^Arrow/.test(e.key)) {
    e.preventDefault();
    const d = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
    const pg = selected.page;
    if (!e.repeat || !nudging) { snap(pg); nudging = true; }
    moveMark(selected.mark, dx, dy); if (selected.mark.t === 'text') keepOnPage(selected.mark, pg.W, pg.H);
    changed(pg); return;
  }
  if (curMedia && curMedia.isConnected) {
    if (e.key === ' ') { e.preventDefault(); curMedia.paused ? curMedia.play().catch(() => {}) : curMedia.pause(); return; }
    if (e.key.toLowerCase() === 'j') { curMedia.currentTime = Math.max(0, curMedia.currentTime - 5); return; }
    if (e.key.toLowerCase() === 'l') { curMedia.currentTime += 5; return; }
  }
  const map = { v: 'select', p: 'pen', h: 'hl', o: 'oval', t: 'text', c: 'note', k: 'check', e: 'erase' };
  if (e.key.toLowerCase() === 'h' && tool === 'hl') { setHlMode(hlMode === 'free' ? 'auto' : 'free', true); return; }
  if (map[e.key.toLowerCase()]) { setTool(map[e.key.toLowerCase()]); return; }
  if (e.key.toLowerCase() === 'n') { nextUnscored(); return; }
  if (e.key.toLowerCase() === 's' && !e.shiftKey) { e.preventDefault(); snipStart(); return; }   // a screenshot (src/snip.js)
  if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey && fmNow()) { e.preventDefault(); fbToggle(e.shiftKey); return; }
  if (e.key === '=' && !$('#calcPanel')) { e.preventDefault(); openCalc(); return; }
  // With the calculator open, numbers and + − × ÷ ( ) go straight into it, even after a click on the paper.
  // ( / still finds a student, and − with a picked mark still makes it smaller, above.)
  if ($('#calcPanel') && e.key !== '/' && !(e.key === 'x' || e.key === 'X')) { const k = calcKeyOf(e); if (k && k !== 'Escape' && (k !== '=' || e.code === 'Equal' || e.code === 'NumpadEqual')) { e.preventDefault(); $('#calcPanel').typeIn(k); return; } }
  if (e.key === '[' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); return setList(!listOpen); }
  if (e.key === ']' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); const p = panelsNow(); return setPanels(p.L, !p.R); }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); stepStudent(1); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); stepStudent(-1); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !selected.fresh) { e.preventDefault(); deleteSelected(); }
  if (e.key === 'Escape' && selected) { selected = null; redrawAll(); }
});
let nudging = false;
document.addEventListener('keyup', e => { if (/^Arrow/.test(e.key)) nudging = false; });
window.addEventListener('beforeunload', () => { if (!batch || !batch.revs || !tabLive()) return;   // no revs yet: still opening, so nothing of hers has changed
  try { commitEditors(); } catch (e) { console.error(e); } saveNow(true); });
applyDisp();
renderLib(); renderGoogle();
const keptFirst = loadKept();   // the address of an open assignment waits for this list before it reopens
/* ---------------- Saving and carrying, in Settings (src/folder.js and src/takehome.js do the work) ---------------- */
function renderBackup() {
  const el = $('#backupInfo'); if (!el) return;
  const t = store.get('gs.lastBackup', 0);
  yearRender();
  el.textContent = t ? 'Last take-home file: ' + new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'No take-home file made from this link yet.';
  // A nudge once a week has gone by since the last one, when there's work kept here and no folder holding a second copy.
  const due = keptMeta.size > 0 && Date.now() - t > 7 * 864e5 && fld.state === 'none';
  el.classList.toggle('due', due);
  if (due) el.textContent += t ? ' · It’s been over a week; a fresh one, or linking a folder, keeps your work safe.' : ' Linking a folder, or a take-home file, keeps your work safe if this browser is cleared.';
  renderSafety(); renderNeeds();
}
// Safety copies made automatically before an update to how work is saved, or before putting one back (src/migrate.js). Only shown once there is one.
async function renderSafety() {
  const el = $('#safetyList'); if (!el) return;
  let list = []; try { list = await gsData.snapshots(); } catch {}
  el.hidden = !list.length;
  el.innerHTML = list.map(s => '<p class="muted" style="margin:6px 0 0;font-size:13px">Safety copy from ' + esc(new Date(s.t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })) + '. ' + esc(s.why) + (s.state && s.state !== 'done' ? ', which didn’t finish' : '') + '. <button class="link" style="font-size:13px" data-putback="' + esc(s.id) + '">Put back</button></p>').join('');
}
$('#safetyList').onclick = e => { const b = e.target.closest('[data-putback]'); if (b) putBackAsk(b.dataset.putback); };
$('#restoreBtn').onclick = () => $('#restoreIn').click();
$('#restoreIn').onchange = () => { const f = $('#restoreIn').files[0]; $('#restoreIn').value = ''; if (f) bringFile(f); };
renderBackup();
for (const el of document.querySelectorAll('.gsVer')) el.textContent = versionLabel();
{ const t = $('#app .title'); if (t) t.title = versionLabel(); }
if (gsData.info.note) { const el = $('#bootNote'); el.textContent = gsData.info.note; el.hidden = false; toast(gsData.info.note, 15000); }

window.__gs_pickMany = pickMany;
window.__gs = { DEFAULT_SETUP, rowTop, rowSteps, rowsMax, setupMax, setupOver, rowScaleOf, pastScore, removeFile, bringBack, replaceFile, stickerText, startScorePlace, stopScorePlace, saveTrouble, batchIdOf, wordScore, wordScoresAll, restoreBackup, fileSeq, moveFile, openMoveFile, calcEval, openCalc, pageLit, setPageLit, lightMenuDo, lightChips, pageOwnL, setPageOwnL, lightForPage, ensureCounts, addRefs, refs: () => refFiles, matchToRoster, guessAmong, expandPicked, lightOpts, isRubricPage, openAnon, setAnon, anonOrder, anonOn, openLight, lightFor, lightAuto, openSplit, sp: () => SP, bringIn, sortGuess, openWord, wordBytes, reopenKept, forgetKept, kept: () => keptMeta, addFiles, removeAdded, nextUnscored, openDisplay, trimToInk, intake, parseGrade, scanFile, scanAll, state: () => ({ batch, cur, setup, pages, zoom, lib }), SCALE12, SCALE_FIVES, RUBRIC_STEPS, percentWith, ownGrade, roundPct, fmtNum, fmtPct, saveNow, undo, redo, gsData, gradeOf, percentFor, flattenDoc, exportPlan, nameOut, layoutOf, docIn, openStudent, setTool, redrawAll };
