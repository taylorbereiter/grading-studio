/* ---------------- where she is: every screen has its own address, the part after # ---------------- */
// #/help is Help, with /<answer> for one answer. #/ is Home, #/class/<id> a class (- for "No class") with /gradebook, /students, /students/<place on the roster>, /seating, /missing, /charts and /reports under it, #/settings Settings,
// #/a/<download> an open assignment (its papers), with /grades, /grades/sheet, /insights, /insights/consistency and /return under it.
// Back, Forward and Refresh follow it. Nothing here is saved: the address only says which screen to show.
const routeOf = hash => {
  let p; try { p = decodeURIComponent(String(hash || '').replace(/^#\/?/, '')).split('/'); } catch { p = ['']; }
  if (p[0] === 'class' && p[1]) {
    const c = p[1] === '-' ? lib.loose : classById(p[1]);
    if (c) {
      const tab = c !== lib.loose && c.names.length && CLASS_TABS.some(t => t[0] && t[0] === p[2]) ? p[2] : '';
      // one student: by place on the roster, never by name, since an address stays in the browser's history
      const stu = tab === 'students' && /^\d+$/.test(p[3] || '') && +p[3] >= 1 && +p[3] <= c.names.length ? +p[3] - 1 : null;
      return { v: 'class', c, tab, stu };
    }
  }
  // from the Planner's sidebar, which knows a class only by the name on its timetable (spaces, dashes and capitals don’t count: “Course A 2” there is “CourseA2” here)
  if (p[0] === 'class-named' && p[1]) { const nk = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''), k = nk(p.slice(1).join('/')), c = k && lib.classes.find(c => nk(c.name) === k); return c ? { v: 'class', c, tab: '', stu: null, named: true } : { v: 'home', noClass: p.slice(1).join('/').slice(0, 60) }; }
  if (p[0] === 'help') return { v: 'help', topic: HELP.some(t => t.id === p[1]) ? p[1] : '' };
  if (p[0] === 'settings') return { v: 'settings', sec: SET_SECS.some(x => x[0] === p[1]) ? p[1] : 'saving' };
  if (p[0] === 'a' && p[1]) {
    const tab = A_TABS.some(t => t[0] && t[0] === p[2]) ? p[2] : '', sub = tab && (A_SUBS[tab] || []).includes(p[3]) ? p[3] : '';
    return { v: 'a', id: 'gs.b.' + p[1], tab, sub };
  }
  return { v: 'home' };
};
const routeNow = () => routeOf(location.hash);
// Settings is one page per subject: #/settings is the first, #/settings/<key> the others.
const SET_SECS = [['saving', 'Saving and carrying', 'Folder, take-home file, safety copies'], ['history', 'Go back in time', 'Your work as it was on an earlier day'], ['classes', 'Classes and rosters', 'Names, students, ' + (sysName() ? sysName() + ' links' : 'class links')], ['terms', 'Terms and weights', 'Your terms and how each type counts'],
  ['grading', 'Grading scale and rubrics', 'Your saved scales and rubrics'], ['marking', 'Marking', 'Mark key, Word papers, tablet and pencil'], ['timetable', 'Timetable and calendar', 'Class times and days off, in the Planner'],
  ['display', 'Display', 'Text size, zoom, dark mode'], ['claude', 'Working with Claude', 'Optional. What Claude can and can’t see'], ['keys', 'Keys', 'Every shortcut'], ['about', 'About and updates', 'Version, what’s new, install as an app']];
const CLASS_TABS = [['', 'Assignments'], ['gradebook', 'Gradebook'], ['students', 'Students'], ['seating', 'Seating'], ['missing', 'Missing work'], ['charts', 'Charts'], ['reports', 'Report comments']];
const classHash = (c, tab, stu) => '#/class/' + (c === lib.loose || !c.id ? '-' : encodeURIComponent(c.id)) + (tab ? '/' + tab + (stu != null ? '/' + (stu + 1) : '') : '');
// An open assignment has four screens: the papers (Mark), Grades, Insights and Return. Grades and Insights each have a second view.
const A_TABS = [['', 'Mark'], ['grades', 'Grades'], ['insights', 'Insights'], ['return', 'Return']], A_SUBS = { grades: ['sheet'], insights: ['consistency'] };
const batchHash = (id, tab) => '#/a/' + encodeURIComponent(String(id).replace(/^gs\.b\./, '')) + (tab ? '/' + tab : '');
// When the app reloads itself (work was put back or brought in), it starts again from Home, where that work is listed.
// A note for the page that loads next, in this tab only, says so; it's read once, here, and gone.
function reloadHome() { try { sessionStorage.setItem('gs.goHome', '1'); } catch {} location.reload(); }
try { if (sessionStorage.getItem('gs.goHome')) { sessionStorage.removeItem('gs.goHome'); if (location.hash) history.replaceState(null, '', location.pathname + location.search); } } catch {}
// Goes to a screen. replace: instead of the one she's on, so Back doesn't come back here.
function go(hash, replace) {
  if (location.hash !== hash && !(hash === '#/' && !location.hash)) {
    if (replace) { try { history.replaceState(null, '', hash); } catch { location.replace(hash); } }
    else location.hash = hash;
  }
  applyRoute();
}
let routeTok = 0, routeOpening = '', routeTab = null;
function applyRoute() {
  const r = routeNow();
  if (r.named) { go(classHash(r.c), true); return; }   // its own address from here on
  if (r.noClass) { toast('There is no class called “' + r.noClass + '” in grading yet. “Add a class” in the sidebar makes one.', 7000); go('#/', true); return; }
  if (r.v === 'a') {
    if (batch && batch.id === r.id) return showScreen(r);
    if (routeOpening !== r.id) openRoute(r.id);
    return;
  }
  routeTok++; routeOpening = ''; routeTab = null;
  if (dlgPage) dlgShut();
  if (batch && !$('#app').hidden) { commitEditors(); saveNow(); closeDownload(true); }   // leaving the paper closes it, saved first. (Still hidden: a download on its way in, which shows itself when it's ready.)
  showScreen(r);
  if (r.v === 'class') renderLib();
}
// The address of an open assignment, with no paper on screen: after a refresh, or Back or Forward. Its kept papers open again where she left off.
async function openRoute(id) {
  const tok = ++routeTok, want = routeNow(); routeOpening = id;
  routeTab = want.v === 'a' && want.tab ? { id, tab: want.tab + (want.sub ? '/' + want.sub : '') } : null;   // a refresh on one of its tabs comes back to that tab, once the papers are open
  if (dlgPage) dlgShut();
  if (batch && !$('#app').hidden) { commitEditors(); saveNow(); closeDownload(true); }
  showScreen({ v: 'opening' });
  try { await keptFirst; await workerReady; } catch {}   // the list of kept work, and the PDF reader, which a click would have given time to start
  const stale = () => tok !== routeTok;
  if (stale()) return;
  const m = keptMeta.get(id);
  if (!m || !m.papers) { routeOpening = ''; if (m) toast('The papers for this one aren’t kept in this browser. Drop the download in again.', 6000); return go('#/', true); }
  try { await reopenKept(id); } catch (e) { console.error(e); }
  if (stale()) return;
  routeOpening = '';
  if (!batch || batch.id !== id) return go('#/', true);   // not opened (Not now, or its papers are gone)
  showScreen(routeNow());
}
let screenKey = '';
// A short number that changes when a roster does. The names themselves stay out of it.
const rosterSig = c => { let h = 5381; for (const ch of c.names.join('\n')) h = (h * 33 ^ ch.codePointAt(0)) >>> 0; return h.toString(36); };
function classLeave() { const box = $('#classes'); if (box.firstChild) { box.innerHTML = ''; delete box.dataset.h; } if (shellReady) classPanelGone(); }
function showScreen(r) {
  const grading = r.v === 'a' && !!batch;
  if (grading && !$('#welcome').hidden) wlClose();   // papers opened past the welcome (dropped on the page): the questions wait on Home's card instead
  $('#shell').classList.toggle('grading', grading);
  $('#app').hidden = !grading; $('#start').hidden = grading;
  for (const [id, v] of [['vHome', 'home'], ['vClass', 'class'], ['vSettings', 'settings'], ['vHelp', 'help'], ['vOpening', 'opening']]) $('#' + id).hidden = grading || r.v !== v;
  if (r.v !== 'class') classLeave();
  const key = grading ? 'a' : r.v + (r.c ? ':' + r.c.id + ':' + r.tab + (r.stu != null ? ':one' : '') : '');   // moving from one student to the next keeps her place on the page
  if (!grading && key !== screenKey) $('#shellMain').scrollTop = 0;
  screenKey = key;
  railRender();
  if (grading) tabShow(r); else if (dlgPage) dlgShut();
}
// How far along a kept download is, in the same words everywhere: on Home, on a class page and in the sidebar's counts.
function keptState(m) {
  const of = Math.max(0, (m.n || 0) - (m.off || 0)), done = Math.min(of, m.scored || 0), left = of - done;
  return { of, done, left, pct: of ? Math.round(done / of * 100) : 0, label: !of ? '' : !left ? (m.ret ? 'Returned' : 'Ready to return') : done || m.partial ? 'Scoring' : 'Not started', cls: !of ? '' : !left ? (m.ret ? 'ret' : 'ok') : done || m.partial ? 'on' : '' };
}
const stateChip = st => st.label ? '<span class="schip ' + st.cls + '">' + st.label + '</span>' : '';
const stateBar = st => st.of ? '<span class="sbar" role="img" aria-label="' + st.done + ' of ' + st.of + ' scored"><i style="width:' + st.pct + '%"></i></span>' : '';
function renderLib() {
  renderKept();
  const card = it => {
    const m = it.batchId ? keptMeta.get(it.batchId) : null, st = m ? keptState(m) : null, typedOnly = !!it.typed && !it.batchId;
    return '<div class="card" draggable="true" data-card="' + it.id + '" title="' + (m && m.papers ? 'Open the papers' : it.typed && !it.batchId ? 'Scores typed in: open the gradebook' : 'Add this assignment’s papers') + '"><div class="cmain"><div class="t">' + esc(it.name) + '</div>' +
      (it.type || it.typed ? '<div class="bkpills">' + bkPill(it.type) + (it.typed ? '<span class="bkpill typed">Typed in</span>' : '') + '</div>' : '') + '</div>' +
      '<div class="cdue">' + (it.due ? 'Due ' + bkDay(it.due) : '') + '</div>' +
      '<div class="cstate">' + (st ? stateBar(st) : '') + '<div class="m">' + esc(it.typed && !it.batchId ? 'Scores typed in' : batchSummary(it)) + '</div>' + (st ? stateChip(st) : '') + '</div>' +
      '<div class="row">' + (m && m.papers ? '<button class="btn sm" data-kopen="' + esc(it.batchId) + '" data-kasg="' + it.id + '">Open</button>'
        : typedOnly ? '' : '<button class="btn sm" data-open-asg="' + it.id + '">Add papers…</button>') + '<button class="btn sm ghost" data-edit-asg="' + it.id + '">Edit</button>' +
        (m && m.papers || typedOnly ? kmWrap('⋯', 'class="icon kdots" aria-label="More for ' + esc(it.name) + '" title="More"', '<button class="mitem" data-open-asg="' + it.id + '">' + (typedOnly ? 'Add papers…<small>Mark this one’s papers here as well</small>' : 'Open other papers…<small>A newer download, or a different set of files</small>') + '</button>', 'right') : '') + '</div></div>';
  };
  const unit = u => '<div class="unit" draggable="true" data-unit="' + u.id + '">' +
    '<div class="uhead" title="Drag to move this unit"><span class="nm">' + esc(u.name) + '</span><span class="ucount">' + u.items.length + (u.items.length === 1 ? ' assignment' : ' assignments') + '</span><span class="sp"></span>' +
    '<span class="atl">' + (u.atlas ? '<a href="' + esc(u.atlas) + '" target="_blank" rel="noopener noreferrer" title="' + esc(u.atlas) + '">' + (unitLinkName() ? 'Open in ' + esc(unitLinkName()) : 'Unit plan') + ' ↗</a><button class="link" data-uatlas="' + u.id + '">Change</button>'
      : '<button class="link" data-uatlas="' + u.id + '">+ Link to ' + esc(unitLinkName() || 'a unit plan') + '</button>') + '</span>' +
    '<button class="icon" data-urename="' + u.id + '" title="Rename unit" aria-label="Rename unit">✎</button>' +
    '<button class="icon" data-udel="' + u.id + '" title="Delete unit" aria-label="Delete unit">✕</button></div>' +
    '<div class="cards">' + u.items.map(card).join('') + '</div>' +
    '<button class="addcard" data-additem="' + u.id + '">+ Assignment</button></div>';
  const r = routeNow(), c = r.v === 'class' ? r.c : null, tab = c ? r.tab : '';
  const tabs = (c, ci) => ci < 0 || !c.names.length ? '' : '<nav class="ctabs" aria-label="' + esc(c.name) + '">' + CLASS_TABS.map(([k, l]) => { const on = tab === k;
    return '<a class="ctab' + (on ? ' on' : '') + '" href="' + classHash(c, k) + '" data-ctab="' + k + '"' + (k === 'gradebook' ? ' data-book="' + esc(c.id) + '"' : k === 'students' ? ' data-people="' + ci + '"' : '') + (on ? ' aria-current="page"' : '') + '>' + l + '</a>'; }).join('') + '</nav>';
  const block = (c, ci) => '<div class="cls" data-cls="' + esc(c.id) + '"><div class="clshead"><h1>' + esc(ci < 0 ? 'No class' : c.name) + '</h1>' +
    (ci < 0 ? '<span class="muted">Assignments with no roster. Drag them onto a class in the sidebar, or use Edit to pick a class.</span><span class="sp"></span>' :
      '<span class="muted">' + (c.names.length ? c.names.length + ' students on the roster' : 'No roster yet') + '</span><span class="sp"></span>' + mbClassBtns(c, ci) + '<button class="btn sm" data-edit-class="' + ci + '">' + (c.names.length ? 'Edit roster' : 'Add roster') + '</button>' +
      '<button class="icon" data-cmove="' + ci + ':-1" title="Move this class up in the sidebar" aria-label="Move this class up in the sidebar"' + (ci ? '' : ' disabled') + '>↑</button><button class="icon" data-cmove="' + ci + ':1" title="Move this class down in the sidebar" aria-label="Move this class down in the sidebar"' + (ci < lib.classes.length - 1 ? '' : ' disabled') + '>↓</button>') + '</div>' + tabs(c, ci) +
    (tab ? '<div class="cpanel" id="classPanel" data-sig="' + rosterSig(c) + '"></div>'
      : '<div class="ctools"><span class="sp"></span><button class="btn sm" data-addunit="' + esc(c.id) + '">+ Unit</button><button class="btn sm primary" data-newasg="' + esc(c.id) + '">+ Assignment</button></div>' +
        '<div class="board">' + (c.units.map(unit).join('') || '<div class="empty-note">No units yet. Click + Unit.</div>') + '</div>') + '</div>';
  // One class at a time: the one whose page she's on. The Gradebook, Students and Charts tabs draw themselves into the panel (classpage.js),
  // and keep what's in it while nothing around it has changed, so a list she's part-way through isn't redrawn under her.
  const box = $('#classes'), h = c ? block(c, c === lib.loose ? -1 : lib.classes.indexOf(c)) : '';
  const fresh = !tab || box.dataset.h !== h;
  if (fresh) { box.dataset.h = h; box.innerHTML = h; }
  if (r.v === 'class' && !c) go('#/', true);
  $('#classHint').hidden = !!tab;
  if (shellReady) classPanelDraw(fresh);
  railRender();
}
// Drag and drop: assignment cards between units (in any class), and units between classes.
let ldrag = null;
document.addEventListener('dragstart', e => {
  if (!$('#start') || $('#start').hidden) return;
  const card = e.target.closest('.card'), unit = e.target.closest('.unit');
  if (card) ldrag = { kind: 'card', id: card.dataset.card, el: card };
  else if (unit) ldrag = { kind: 'unit', id: unit.dataset.unit, el: unit };
  else return;
  e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ldrag.kind);
  setTimeout(() => ldrag && ldrag.el.classList.add('dragging'), 0);
});
function clearIns() { for (const x of document.querySelectorAll('.ins,.insEnd,.over')) x.classList.remove('ins', 'insEnd', 'over'); }
document.addEventListener('dragend', () => { if (ldrag) ldrag.el.classList.remove('dragging'); ldrag = null; clearIns(); });
function slot(list, e, horiz) {
  for (let k = 0; k < list.length; k++) { const r = list[k].getBoundingClientRect(); if (horiz ? e.clientX < r.left + r.width / 2 && e.clientY < r.bottom : e.clientY < r.top + r.height / 2) return k; }
  return list.length;
}
function libDragTarget(e) {
  if (!ldrag || !e.target.closest) return null;
  if (ldrag.kind === 'card') { const z = e.target.closest('.unit'); if (!z) return null; const cards = z.querySelector('.cards'); const list = [...cards.querySelectorAll('.card')]; return { unit: z.dataset.unit, k: slot(list, e, false), list, cards }; }
  if (ldrag.kind === 'unit') { const z = e.target.closest('.cls'); if (!z) return null; const board = z.querySelector('.board'), list = [...board.querySelectorAll('.unit')]; return { cls: z.dataset.cls, k: slot(list, e, false), list, cards: board }; }
}
// The same drag, onto a class in the sidebar: the assignment goes to that class's unit of the same name (made if it isn't there), a unit goes to the end of that class.
const railDragTarget = e => { const a = ldrag && e.target.closest && e.target.closest('#railClasses [data-railcls]'); return a ? holderById(a.dataset.railcls) : null; };
document.addEventListener('dragover', e => { const c = railDragTarget(e); if (!c) return; e.preventDefault(); e.stopPropagation(); clearIns(); e.target.closest('[data-railcls]').classList.add('over'); }, true);
document.addEventListener('drop', e => {
  const to = railDragTarget(e); if (!to) return;
  e.preventDefault(); e.stopPropagation(); clearIns();
  if (ldrag.kind === 'card') {
    const from = findItem(ldrag.id); if (!from || from.c === to) return;
    let u = to.units.find(x => x.name === from.u.name); if (!u) to.units.push(u = { id: uid(), name: from.u.name, items: [] });
    from.u.items.splice(from.u.items.indexOf(from.it), 1); u.items.push(from.it); from.it.classId = to.id;
    toast('Moved to ' + (to === lib.loose ? 'No class' : to.name));
  } else {
    const from = findUnit(ldrag.id); if (!from || from.c === to) return;
    from.c.units.splice(from.c.units.indexOf(from.u), 1); to.units.push(from.u);
    for (const it of from.u.items) it.classId = to.id;
    toast('Moved to ' + (to === lib.loose ? 'No class' : to.name));
  }
  ldrag = null; saveLib(); renderLib();
}, true);
document.addEventListener('dragover', e => {
  const t = libDragTarget(e); if (!t) return;
  e.preventDefault(); e.stopPropagation(); clearIns();
  if (t.list[t.k]) t.list[t.k].classList.add('ins'); else if (t.cards) t.cards.classList.add('insEnd');
}, true);
document.addEventListener('drop', e => {
  const t = libDragTarget(e); if (!t) return;
  e.preventDefault(); e.stopPropagation(); clearIns();
  let k = t.k;
  if (ldrag.kind === 'card') {
    const from = findItem(ldrag.id), to = findUnit(t.unit); if (!from || !to) return;
    const i = from.u.items.indexOf(from.it);
    from.u.items.splice(i, 1); if (from.u === to.u && i < k) k--;
    to.u.items.splice(k, 0, from.it);
    from.it.classId = to.c.id;   // moved to another class: it uses that class's roster
  } else {
    const from = findUnit(ldrag.id), to = holderById(t.cls); if (!from || !to) return;
    const i = from.c.units.indexOf(from.u);
    from.c.units.splice(i, 1); if (from.c === to && i < k) k--;
    to.units.splice(k, 0, from.u);
    for (const it of from.u.items) it.classId = to.id;
  }
  ldrag = null; saveLib(); renderLib();
}, true);
// A ZIP dropped straight onto an assignment card opens it as that assignment.
document.addEventListener('dragover', e => {
  if (ldrag || batch) return;
  const card = e.target.closest('.card'); if (!card || !e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
  e.preventDefault(); e.stopPropagation(); clearIns(); card.classList.add('over');
}, true);
document.addEventListener('drop', async e => {
  if (ldrag || batch) return;
  const card = e.target.closest('.card'); if (!card || !e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault(); e.stopPropagation(); clearIns(); $('#drop').classList.remove('over');
  const f = findItem(card.dataset.card); if (!f) return;
  const out = await entriesFromDrop(e.dataTransfer);
  intake(out.list, out.label, f.it);
}, true);

let asgTarget = null;
$('#asgDirIn').onchange = e => {
  const fs = [...e.target.files], top = fs.length ? (fs[0].webkitRelativePath || '').split('/')[0] : '';
  if (asgTarget && fs.length) intake(fs.map(f => ({ path: (f.webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name, file: f })), top, asgTarget);
  e.target.value = '';
};
$('#asgIn').onchange = e => { const fs = [...e.target.files]; if (asgTarget && fs.length) intake(fs.map(f => ({ path: f.name, file: f })), fs.length === 1 ? fs[0].name.replace(/\.[^.]+$/, '') : '', asgTarget); e.target.value = ''; };
$('#start').addEventListener('click', async e => {
  let b = e.target.closest('button');
  // A click anywhere else on an assignment's row opens it: its papers if they are kept, its scores if they were typed in, else the way to add its papers.
  if (!b) {
    const card = !e.target.closest('a, input, select, textarea, .km') && e.target.closest('#classes .card[data-card]'), f = card && findItem(card.dataset.card);
    if (!f) return;
    if (f.it.typed && !f.it.batchId && f.c !== lib.loose && f.c.names.length) return go(classHash(f.c, 'gradebook'));
    b = card.querySelector('[data-kopen], [data-open-asg]'); if (!b || b.disabled) return;
  }
  if (b.dataset.addunit != null) { const c = holderById(b.dataset.addunit); const name = await askTextDlg('Unit name', 'Unit ' + (c.units.length + 1), { ok: 'Add unit' }); if (name && name.trim()) { c.units.push({ id: uid(), name: name.trim(), items: [] }); saveLib(); renderLib(); } return; }
  if (b.dataset.newasg != null) return editAssignment(null, null, b.dataset.newasg);
  if (b.dataset.cmove) { const [ci, d] = b.dataset.cmove.split(':').map(Number), j = ci + d; if (j >= 0 && j < lib.classes.length) { [lib.classes[ci], lib.classes[j]] = [lib.classes[j], lib.classes[ci]]; saveLib(); renderLib(); const again = $('#classes [data-cmove="' + j + ':' + d + '"]'); if (again && !again.disabled) again.focus(); } return; }
  if (b.dataset.urename != null) { const f = findUnit(b.dataset.urename); if (!f) return; const name = await askTextDlg('Unit name', f.u.name, { ok: 'Rename' }); if (name && name.trim()) { f.u.name = name.trim(); saveLib(); renderLib(); } return; }
  if (b.dataset.uatlas != null) return askAtlas(b.dataset.uatlas);
  if (b.dataset.udel != null) {
    const f = findUnit(b.dataset.udel); if (!f) return; const u = f.u;
    if (u.items.length && !await askDlg('Delete “' + u.name + '” and its ' + u.items.length + ' assignment' + (u.items.length === 1 ? '' : 's') + '? Saved marks for those downloads stay in this browser.', { ok: 'Delete', danger: true })) return;
    f.c.units.splice(f.c.units.indexOf(u), 1); saveLib(); renderLib(); return;
  }
  if (b.dataset.additem != null) return editAssignment(null, b.dataset.additem);
  if (b.dataset.editAsg) return editAssignment(b.dataset.editAsg);
  if (b.dataset.kopen) { const f = b.dataset.kasg ? findItem(b.dataset.kasg) : null; const was = b.textContent, named = b.classList.contains('kname'); b.disabled = true; if (!named) b.textContent = 'Opening…'; return reopenKept(b.dataset.kopen, f ? f.it : null).finally(() => { b.disabled = false; if (!named) b.textContent = was; }); }   // a button that is the assignment's own name keeps saying it
  if (b.dataset.kforget) {   // two clicks, so a stray click can't throw work away
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Click again to forget it'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'Forget'; } }, 4000); return; }
    return forgetKept(b.dataset.kforget);
  }
  if (b.dataset.openAsg) {
    asgTarget = findItem(b.dataset.openAsg).it;
    openDlg('<div class="bh"><h2>Open “' + esc(asgTarget.name) + '”</h2></div><div class="bb"><p style="margin-top:0">' + (sysName() ? 'Where is the ' + esc(sysName()) + ' download?' : 'Where are the papers?') + ' You can also drop the ZIP or the folder straight onto this assignment’s card.</p></div>' +
      '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn" data-pc>The ZIP or files…</button><button class="btn" data-dir>A whole folder…</button><button class="btn" data-scan>A scan of everyone’s papers…</button><button class="btn" data-match>Files to match to a roster…</button>' + (gcid() ? '<button class="btn primary" data-dv>From Google Drive…</button>' : '') + '</div>', true);
    $('#dlgBox').onclick = ev => { if (ev.target.closest('[data-cancel]')) return closeDlg(); if (ev.target.closest('[data-pc]')) { closeDlg(); $('#asgIn').click(); } if (ev.target.closest('[data-dir]')) { closeDlg(); pickDir('#asgDirIn'); } if (ev.target.closest('[data-scan]')) { closeDlg(); scanFor = asgTarget; $('#scanIn').click(); } if (ev.target.closest('[data-match]')) { const a = asgTarget; askFilesOrFolder('Match files to a roster', 'Each file is matched to a student by the name in its file name or folder name, and you can fix any match.', list => matchToRoster(list, a)); } if (ev.target.closest('[data-dv]')) { closeDlg(); openFromDrive(asgTarget); } };
    return;
  }
  if (b.dataset.editClass != null) return editClass(+b.dataset.editClass);
  if (b.dataset.mbset != null) return askMb(+b.dataset.mbset);
});
// The unit's page in the school's curriculum tool, Atlas for one (web links only); empty removes it. Shown on the unit and in the top bar while grading.
async function askAtlas(unitId) {
  const f = findUnit(unitId); if (!f) return;
  let v = await askTextDlg('Paste the ' + (unitLinkName() ? unitLinkName() + ' link' : 'link to the unit plan') + ' for ' + f.u.name + ' (leave empty to remove it)', f.u.atlas || '', { ok: 'Save' });
  if (v == null) return; v = v.trim();
  if (v && !/^https?:\/\//i.test(v)) v = 'https://' + v;
  if (v && !/^https?:\/\/[^\s]+$/i.test(v)) return toast('That doesn’t look like a web link');
  if (v) f.u.atlas = v; else delete f.u.atlas;
  saveLib(); if (batch) renderTopAtlas(); else renderLib();
}
function renderTopAtlas() {
  const el = $('#topAtlas'); if (!el) return;
  const f = batch && batch.assignment && findItem(batch.assignment.id);
  el.innerHTML = !f ? '' : f.u.atlas ? '<a href="' + esc(f.u.atlas) + '" target="_blank" rel="noopener noreferrer" title="' + esc(f.u.name) + (unitLinkName() ? ' in ' + esc(unitLinkName()) : ': its unit plan') + '">' + esc(unitLinkName() || 'Unit plan') + ' ↗</a>'
    : '<button class="link" data-uatlas="' + f.u.id + '" title="Link ' + esc(f.u.name) + ' to its ' + (unitLinkName() ? esc(unitLinkName()) + ' page' : 'unit plan') + '">+ ' + esc(unitLinkName() || 'Unit plan') + ' link</button>';
  // the class's page in the school's system, where the grades go
  const c = batchClass(), ci = c ? lib.classes.indexOf(c) : -1;
  const tm = $('#topMb'); if (tm) tm.innerHTML = c && mbOf(c) ? mbLink(c) : '';   // in the top bar, beside the Grades list
  if (c) el.innerHTML += mbOf(c) ? ' <a href="' + esc(mbOf(c)) + '" target="_blank" rel="noopener" title="' + esc(c.name) + (sysName() ? ' on ' + esc(sysName()) : ': its class page') + '">' + esc(sysLink()) + ' ↗</a>' : ' <button class="link" data-mbset="' + ci + '" title="Link ' + esc(c.name) + ' to its ' + (sysName() ? esc(sysName()) + ' page' : 'page in your school’s system') + '">+ ' + esc(sysLink()) + ' link</button>';
}
$('#topAtlas').addEventListener('click', e => { const b = e.target.closest('[data-uatlas]'); if (b) askAtlas(b.dataset.uatlas); const m = e.target.closest('[data-mbset]'); if (m) askMb(+m.dataset.mbset); });
// The unit list follows the class picked; a class with no units gets a "Unit 1" when the assignment is saved.
// A new assignment can go to several classes at once: each ticked class gets its own card (its own roster and download),
// placed in that class's unit of the chosen name (made if missing). The copies share a group id, so the first rubric set
// up in one class is given to the copies that have none yet (shareRubric).
function editAssignment(id, unitId, clsId) {
  const f = id ? findItem(id) : null, start = f ? f : findUnit(unitId) || { c: (clsId != null ? holderById(clsId) : null) || lib.classes[0] || lib.loose, u: null };
  const it = f ? f.it : { id: uid(), name: '', classId: start.c.id };
  const classPick = f
    ? '<div class="field"><label for="aClass">Class</label><select id="aClass" class="btn" style="justify-content:flex-start">' + lib.classes.map(c => '<option value="' + c.id + '"' + (c === start.c ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '<option value=""' + (start.c === lib.loose ? ' selected' : '') + '>No class</option></select></div>'
    : '<div class="field"><label>Classes</label><div class="ctags" id="aClasses">' + holders().map(c => '<label class="ctag"><input type="checkbox" value="' + esc(c.id) + '"' + (c === start.c ? ' checked' : '') + '><span>' + esc(c === lib.loose ? 'No class' : c.name) + '</span></label>').join('') + '</div></div>';
  openDlg('<div class="bh"><h2>' + (f ? 'Edit assignment' : 'New assignment') + '</h2></div><div class="bb">' +
    '<div class="field"><label for="aName">Name</label><input type="text" id="aName" value="' + esc(it.name) + '" placeholder="e.g. Ch 3 Analysis Paragraph"></div>' +
    classPick +
    '<div class="field"><label for="aUnit">Unit</label><select id="aUnit" class="btn" style="justify-content:flex-start"></select><p class="muted" id="aUnitNote" style="font-size:13px;margin:6px 0 0" hidden></p></div>' +
    '<div class="field"><label>Type</label><div class="pseg" role="group" id="aType">' + BK_TYPES.map(([t, l]) => '<button type="button" data-atype="' + t + '" aria-pressed="' + (it.type === t) + '">' + l.replace(' assessment', '').replace(' activity', '') + '</button>').join('') + '</div><p class="muted" style="font-size:12.5px;margin:4px 0 0">Summatives and in-class assessments count toward the term grade in the Gradebook. Formative activities are feedback only.</p></div>' +
    '<div class="field"><label for="aDue">Due</label><input type="date" id="aDue" class="btn" value="' + esc(it.due || '') + '"></div>' +
    '<p class="muted" style="font-size:13px;margin:0">The rubric is set the first time you open a download for it, with Rubric setup, and it’s remembered for this assignment.' + (f ? '' : ' Copies in other classes get the same rubric.') + '</p></div>' +
    '<div class="bf">' + (f ? '<button class="btn" data-del style="margin-right:auto">Delete</button>' : '') + '<button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Save</button></div>', true);
  const ticked = () => [...document.querySelectorAll('#aClasses input:checked')].map(x => holderById(x.value)).filter(Boolean);
  const fillUnits = keep => {
    if (f) {
      const c = holderById($('#aClass').value);
      $('#aUnit').innerHTML = c.units.map(u => '<option value="' + u.id + '"' + (keep && u === keep ? ' selected' : '') + '>' + esc(u.name) + '</option>').join('') || '<option value="">Unit 1 (new)</option>';
      return;
    }
    // New: unit names from every ticked class, the one already picked kept if it's still there
    const cs = ticked(), was = $('#aUnit').value || (keep && keep.name) || '', names = [];
    for (const c of cs) for (const u of c.units) if (!names.includes(u.name)) names.push(u.name);
    $('#aUnit').innerHTML = names.map(n => '<option value="' + esc(n) + '"' + (n === was ? ' selected' : '') + '>' + esc(n) + '</option>').join('') || '<option value="">Unit 1 (new)</option>';
    const n = $('#aUnit').value || 'Unit 1', made = cs.filter(c => !c.units.some(u => u.name === n)).map(c => c === lib.loose ? 'No class' : c.name);
    const note = $('#aUnitNote');
    note.hidden = !(cs.length > 1 && made.length && made.length < cs.length);
    if (!note.hidden) note.textContent = made.join(', ') + (made.length === 1 ? ' has' : ' have') + ' no unit called “' + n + '” yet, so one is made there.';
    const ok = $('#dlgBox [data-ok]'); ok.textContent = cs.length > 1 ? 'Add to ' + cs.length + ' classes' : 'Save'; ok.disabled = !cs.length;
  };
  fillUnits(start.u);
  if (f) $('#aClass').onchange = () => fillUnits(null);
  else { $('#aClasses').onchange = () => fillUnits(null); $('#aUnit').onchange = () => fillUnits(null); }
  setTimeout(() => $('#aName').focus(), 0);
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    const tb = e.target.closest('[data-atype]');
    if (tb) { const on = tb.getAttribute('aria-pressed') !== 'true'; for (const x of document.querySelectorAll('[data-atype]')) x.setAttribute('aria-pressed', String(on && x === tb)); return; }
    if (e.target.closest('[data-del]')) { if (!await askDlg('Delete “' + it.name + '”?', { ok: 'Delete', danger: true })) return; f.u.items.splice(f.u.items.indexOf(it), 1); saveLib(); closeDlg(); return renderLib(); }
    if (e.target.closest('[data-ok]')) {
      const name = $('#aName').value.trim(); if (!name) { $('#aName').focus(); return; }
      const ty = document.querySelector('[data-atype][aria-pressed="true"]'), due = $('#aDue').value;
      const setKind = a => { if (ty) a.type = ty.dataset.atype; else delete a.type; if (due) a.due = due; else delete a.due; };   // every copy in every class gets the same type and date
      if (!f) {
        const cs = ticked(); if (!cs.length) return;
        const un = $('#aUnit').value || 'Unit 1', group = cs.length > 1 ? uid() : undefined;
        cs.forEach((c, k) => {
          let to = c.units.find(u => u.name === un);
          if (!to) c.units.push(to = { id: uid(), name: un, items: [] });
          const a = k ? { id: uid(), name, classId: c.id } : Object.assign(it, { name, classId: c.id });
          if (group) a.group = group;
          setKind(a);
          to.items.push(a);
        });
        saveLib(); closeDlg(); renderLib();
        if (cs.length > 1) toast('Added to ' + cs.map(c => c === lib.loose ? 'No class' : c.name).join(', ').replace(/, ([^,]*)$/, ' and $1'));
        return;
      }
      const c = holderById($('#aClass').value);
      let to = c.units.find(u => u.id === $('#aUnit').value);
      if (!to) c.units.push(to = { id: uid(), name: 'Unit 1', items: [] });
      it.name = name; it.classId = c.id;
      setKind(it);
      if (f.u !== to) f.u.items.splice(f.u.items.indexOf(it), 1);
      if (f.u !== to) to.items.push(it);
      saveLib(); closeDlg(); renderLib();
      if (batch) { renderGrade(); renderList(); }   // a type changed while grading: the score panel follows
    }
  };
}
// The first rubric set up for an assignment added to several classes goes to the copies that have no rubric yet.
function shareRubric(a) {
  if (!a || !a.group || !a.setup) return;
  for (const c of holders()) for (const u of c.units) for (const x of u.items) if (x !== a && x.group === a.group && !x.setup) x.setup = JSON.parse(JSON.stringify(a.setup));
}
// Class lists: pasted from a spreadsheet, or a .csv / .txt file. A student ID column (numbers) and an email column are kept
// beside the name as the student's details (see people.js), and never become part of the name.
const EMAIL_RX = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
function parseRosterRows(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const all = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim()).filter(Boolean);
    if (all.some(c => /^(e-?mail( address)?|student id|student number|id)$/i.test(c))) continue;   // a header row
    const cells = all.filter(c => !/^\d[\d\s-]*$/.test(c) && !EMAIL_RX.test(c));
    if (!cells.length || /^(name|student|students|first|last|first name|last name|student name)$/i.test(cells[0])) continue;
    const id = all.find(c => /^\d[\d\s-]*$/.test(c)), email = all.find(c => EMAIL_RX.test(c));
    out.push({ name: cells.slice(0, 2).join(cells.length > 1 && !/,/.test(cells[0]) ? ' ' : ', '), id: id ? id.replace(/\s+/g, '') : '', email: email || '' });
  }
  return out;
}
const parseRoster = text => parseRosterRows(text).map(r => r.name);
// A class's page in the school's system (ManageBac, Google Classroom, Canvas…), so it opens in one click from the class and its Grades list.
function mbUrl(v) { v = String(v || '').trim(); if (/^[\w.-]+\.[a-z]{2,}\//i.test(v)) v = 'https://' + v; return /^https?:\/\/[^\s"<>]+$/i.test(v) ? v : ''; }
// Links are also remembered by class name in this browser, so the Planner shows the same link for "11 EL-2" as grading does for "11EL-2".
const MB_KEY = 'gs.mblinks', mbNorm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function mbMap() { try { return JSON.parse(localStorage.getItem(MB_KEY) || '{}') || {}; } catch { return {}; } }
function mbRemember(name, url) { try { const m = mbMap(), k = mbNorm(name); if (!k) return; if (url) m[k] = url; else delete m[k]; localStorage.setItem(MB_KEY, JSON.stringify(m)); } catch { } }
const mbOf = c => (c && (mbUrl(c.mb) || mbUrl(mbMap()[mbNorm(c.name)]))) || '';
const mbLink = (c, cls) => mbOf(c) ? '<a class="' + (cls || 'btn sm') + ' mb-go" href="' + esc(mbOf(c)) + '" target="_blank" rel="noopener" title="Open ' + esc(c.name) + (sysName() ? ' on ' + esc(sysName()) : '’s class page') + '">' + esc(sysLink()) + ' ↗</a>' : '';
// On the class itself: the link, or a button to add one. ✎ changes it.
const mbClassBtns = (c, ci) => mbOf(c) ? mbLink(c) + '<button class="icon" data-mbset="' + ci + '" title="Change the ' + esc(sysLink()) + ' link" aria-label="Change the ' + esc(sysLink()) + ' link">✎</button>' : '<button class="btn sm ghost mb-add" data-mbset="' + ci + '">+ ' + esc(sysLink()) + ' link</button>';
async function askMb(ci) {
  const c = lib.classes[ci]; if (!c) return;
  const v = await askTextDlg('Paste the ' + (sysName() ? sysName() + ' page' : 'web address of the class page') + ' for ' + c.name + ' (leave empty to remove it)', mbOf(c), { ok: 'Save' });
  if (v == null) return;
  const u = mbUrl(v); if (v.trim() && !u) return toast('That doesn’t look like a web link');
  if (u) c.mb = u; else delete c.mb; mbRemember(c.name, u);
  saveLib(); if (batch) renderTopAtlas(); else renderLib();
}
function editClass(ci) {
  let upRows = [];
  const c = ci >= 0 ? lib.classes[ci] : { id: uid(), name: '', names: [], units: [] };
  openDlg('<div class="bh"><h2>' + (ci >= 0 ? 'Edit roster' : 'New roster') + '</h2></div><div class="bb">' +
    '<div class="field"><label for="cName">Class name</label><input type="text" id="cName" value="' + esc(c.name) + '" placeholder="e.g. Period 2 Biology"></div>' +
    '<div class="field"><label for="cMb">' + esc(sysLink()) + ' link <span class="muted" style="font-weight:400">(optional)</span></label><input type="url" id="cMb" value="' + esc(mbOf(c)) + '" placeholder="Paste this class’s ' + (sysName() ? esc(sysName()) + ' page address' : 'page address in your school’s system') + '"></div>' +
    '<div class="field"><label for="cNames">Students, one per line, in the order you want' + (sysName() ? ' (' + esc(sysName()) + ' order works well)' : '') + '</label><textarea class="big" id="cNames" placeholder="Paste from a spreadsheet' + (sysName() ? ' or ' + esc(sysName()) : '') + ', or upload a file. Student ID and email columns are kept as each student’s details.">' + esc(c.names.join('\n')) + '</textarea></div>' +
    '<button class="btn sm" data-up>Upload a list (.csv or .txt)…</button><input type="file" id="cFile" accept=".csv,.txt,text/csv,text/plain" hidden>' +
    '<p class="muted" style="font-size:13px">Kept in this browser.</p></div>' +
    '<div class="bf">' + (ci >= 0 ? '<button class="btn" data-del style="margin-right:auto">Delete</button>' : '') + '<button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Save</button></div>', true);
  $('#cFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; const rows = parseRosterRows(await f.text()); $('#cNames').value = rows.map(r => r.name).join('\n'); upRows = rows; e.target.value = ''; };
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-up]')) return $('#cFile').click();
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target.closest('[data-del]')) { if (!await askDlg('Delete the ' + c.name + ' class? Its assignments move to “No class”.', { ok: 'Delete', danger: true })) return; for (const u of c.units) { for (const it of u.items) it.classId = ''; lib.loose.units.push(u); } lib.classes.splice(ci, 1); saveLib(); closeDlg(); renderLib(); if (!batch && routeNow().v !== 'class') go(lib.loose.units.some(u => u.items.length) ? classHash(lib.loose) : '#/', true); return; }
    if (e.target.closest('[data-ok]')) {
      const name = $('#cName').value.trim(); if (!name) { $('#cName').focus(); return; }
      const mb = mbUrl($('#cMb').value); if ($('#cMb').value.trim() && !mb) { toast('That ' + sysLink() + ' link isn’t a web address'); $('#cMb').focus(); return; }
      c.name = name; const rows = parseRosterRows($('#cNames').value).map(r => ({ ...(upRows.find(u => u.name === r.name) || {}), ...r, id: r.id || (upRows.find(u => u.name === r.name) || {}).id || '', email: r.email || (upRows.find(u => u.name === r.name) || {}).email || '' })), was = c.names; c.names = rows.map(r => r.name); keepInfo(c, was, rows);
      if (mb) c.mb = mb; else delete c.mb; mbRemember(name, mb);
      if (ci < 0) lib.classes.push(c);
      saveLib(); closeDlg(); renderLib();
      if (ci < 0 && !batch) go(classHash(c));
    }
  };
}
// Matching folder names to roster names: every word of one appears in the other, in any order ("Doe, Sam" = "Sam Doe").
const LETTER_PLAIN = { ø: 'o', đ: 'd', ð: 'd', ł: 'l', ħ: 'h', ı: 'i', ŧ: 't', æ: 'ae', œ: 'oe', ß: 'ss', þ: 'th' };
const nameFold = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[øđðłħıŧæœßþ]/g, c => LETTER_PLAIN[c]);
const nameWords = s => (nameFold(s).match(/[a-z0-9]+|[^\x00-\x7f\s,.()_-]+/g) || []);
// The closest fit goes first, so a name inside another ("Wei Chen", "Wei Chen Lin") can't take the other's folder. A fit by some of the words has to be the only one both ways.
function rosterMatch(names) {
  const used = new Set(), map = new Map(), left = () => [...new Set(names)].filter(n => !map.has(n));
  const studs = batch.students.map(st => ({ st, w: new Set(nameWords(st.key)) }));
  const give = (n, x) => { used.add(x.st); map.set(n, x.st); };
  const c = classOfNames(names);   // a spelling she linked, or the student's ID in the folder name, is a sure match, even over an empty roster spot of the same name
  if (c && c.info) for (const x of studs) { if (used.has(x.st) || (x.st.gap && !x.st.files.length)) continue; const h = infoHits(c, x.st.key).filter(n => !map.has(n)); if (h.length === 1) give(h[0], x); }
  for (const n of left()) { const x = studs.find(x => !used.has(x.st) && x.st.key === n); if (x) give(n, x); }
  for (const n of left()) {
    const w = new Set(nameWords(n)), hits = studs.filter(x => !used.has(x.st) && x.w.size === w.size && [...w].every(t => x.w.has(t)));
    if (w.size && hits.length === 1) give(n, hits[0]);
  }
  // Canvas names a student's files by their name with the words run together, family name first ("doejane"): one word that is the roster name's words joined.
  for (const n of left()) {
    const w = nameWords(n); if (w.length < 2 || w.length > 5) continue;
    const forms = new Set([w.join(''), w.slice(1).concat(w[0]).join(''), [w[w.length - 1]].concat(w.slice(0, -1)).join('')]);
    const hits = studs.filter(x => !used.has(x.st) && x.w.size === 1 && forms.has([...x.w][0]));
    if (hits.length === 1) give(n, hits[0]);
  }
  const fits = (w, x) => w.every(t => x.w.has(t)) || (x.w.size >= 2 && [...x.w].every(t => w.includes(t)));
  const rest = left().map(n => ({ n, w: nameWords(n) })).filter(r => r.w.length);
  for (const { n, w } of rest) {
    const hits = studs.filter(x => !used.has(x.st) && fits(w, x));
    if (hits.length === 1 && rest.filter(r => fits(r.w, hits[0])).length === 1) give(n, hits[0]);
  }
  return map;
}
// Someone on the roster with no folder. s: their saved record, if there is one.
const gapStudent = (key, s) => ({ key, files: [], grade: { rubric: [], points: '', comment: '', ...(s && s.g) }, layout: null, inc: (s && s.inc) || {}, gap: true });
// The order the student list, and so the Grade sheet, is really in.
function listOrder() {
  const c = batchClass();
  if (!c || !c.names.length) return 'folder order';
  return rosterMatch(c.names).size < batch.students.length ? 'roster order, then anyone not on it' : 'roster order';
}
// Students always go in the order of the class roster: matched names first, in roster order, then anyone the roster
// doesn't name, in folder order. With no class picked, the class whose roster names most of the folders is used.
function rosterSort() {
  if (!batch) return;
  let c = batchClass();
  if (!c && batch.classId !== '') {
    let best = null, bn = 0;
    for (const k of lib.classes) if (k.names.length) { const n = rosterMatch(k.names).size; if (n > bn) { bn = n; best = k; } }
    if (best && bn >= Math.max(2, batch.students.length / 2)) { c = best; batch.classId = best.id; }
  }
  // Everyone on the roster is in the list, even with nothing turned in yet; their paper can be added from their name.
  // A roster place-holder goes away if the roster changes, unless it has a file, score, comment or status: then it stays in the list, as not on the roster.
  batch.students = batch.students.filter(st => !(st.gap && !st.files.length && !gradeHasWork(st.grade) && !(c && c.names.includes(st.key))));
  if (c && c.names.length) {
    let have = rosterMatch(c.names);
    const spare = batch.students.filter(st => st.gap && !st.files.length && !gradeHasWork(st.grade) && have.has(st.key) && have.get(st.key) !== st);   // an empty spot another folder now fills
    if (spare.length) { batch.students = batch.students.filter(st => !spare.includes(st)); have = rosterMatch(c.names); }
    const saved = newestWork(store.get(batch.id, null), batch.keptWork);
    for (const nm of c.names) if (!have.has(nm)) {
      const s = saved && saved.s && saved.s[nm];
      batch.students.push(gapStudent(nm, s));
    }
  }
  const byFolder = [...batch.students].sort((a, b) => natural(a.key, b.key));
  if (!c || !c.names.length) { batch.students = byFolder; return; }
  batch.students = byFolder;
  const m = rosterMatch(c.names), used = new Set(c.names.filter(n => m.has(n)).map(n => m.get(n)));
  batch.students = [...used].concat(byFolder.filter(st => !used.has(st)));
}
function setBatchName() { $('#batchName').textContent = batch.name + ' · ' + batch.students.length + (batch.students.length === 1 ? ' student' : ' students'); railRender(); }
function batchClass() { const id = batch && (batch.classId != null ? batch.classId : batch.assignment && batch.assignment.classId); return id ? classById(id) : null; }
function renderClassSel() {
  const sel = $('#classSel'), c = batchClass();
  sel.hidden = !lib.classes.length;
  sel.innerHTML = '<option value="">No roster</option>' + lib.classes.map(k => '<option value="' + k.id + '"' + (c && c.id === k.id ? ' selected' : '') + '>' + esc(k.name) + '</option>').join('');
}
$('#classSel').onchange = e => {
  batch.classId = e.target.value;
  const a = batch.assignment, f = a && findItem(a.id);
  if (f && f.c.id !== batch.classId) {   // the assignment card moves to that class, into a unit of the same name
    const to = holderById(batch.classId);
    let u = to.units.find(x => x.name === f.u.name); if (!u) to.units.push(u = { id: uid(), name: f.u.name, items: [] });
    f.u.items.splice(f.u.items.indexOf(a), 1); u.items.push(a); a.classId = batch.classId; saveLib();
  } else if (a) { a.classId = batch.classId; saveLib(); }
  const st = batch.students[cur]; rosterSort(); cur = Math.max(0, batch.students.indexOf(st));
  setBatchName(); renderList(); renderTopAtlas(); openStudent(cur); saveSoon();
};

