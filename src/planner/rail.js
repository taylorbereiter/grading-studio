/* ================= The sidebar =================
   The same sidebar as on the grading page, drawn by the Planner's own code. Its classes are the ones on the Planner's
   timetable. It shows no grading counts and reads nothing of grading's: Today, a class and Settings are plain links
   to the grading page, which looks the class up by its name when it opens. */
// Grading Studio sits next to this page: index.html online, "Grading Studio.html" for the double-click copy.
const GS_PAGE = location.protocol === 'file:' || /Planner\.html$/.test(decodeURIComponent(location.pathname)) ? 'Grading Studio.html' : './';
const gsUrl = hash => GS_PAGE + (hash || '#/');
const classUrl = c => gsUrl('#/class-named/' + encodeURIComponent(c.name));
// The calendar is two views, the week and the semester: the Calendar tab opens the one she used last.
let calView = 'week';

// Everything typed is saved before the screen changes or the page is left.
async function settleAll() {
  try { editorCommit(); clearTimeout(lSaveT); if (L.open) await lPut(L.open); } catch { }
  try { if (L.view === 'unit' && L.unit) { clearTimeout(uSaveT); await unitPut(L.unit, true); } } catch { }
  try { if (L.view === 'doc' && L.doc) { clearTimeout(docT); await docSave(); } } catch { }
}
async function toView(v) { await settleAll(); L.open = null; L.unit = null; L.doc = null; L.backTo = null; L.view = v; renderLessons(); window.scrollTo(0, 0); }
async function leaveTo(url) { await settleAll(); location.href = url; }

function railRender() {
  const classes = (L.setup && L.setup.classes) || [];
  const h = classes.map(c => '<a class="rnav" href="' + esc(classUrl(c)) + '" title="' + esc(c.name) + ': its assignments, gradebook and students"><span class="rdot" style="background:' + esc(c.color || '#1F6FB2') + '"></span><span class="rl rname">' + esc(c.name) + '</span></a>').join('');
  const box = $('#railClasses'); if (box.dataset.h !== h) { box.dataset.h = h; box.innerHTML = h; }
  for (const a of document.querySelectorAll('#rail [data-gs]')) a.setAttribute('href', gsUrl(a.dataset.gs));
  $('#railTimetable').querySelector('.rl').textContent = classes.length ? 'Timetable' : 'Set up your timetable';
  // Saved, and where. The folder is the Planner's own, never the grading folder.
  const el = $('#railSaved'), can = 'showDirectoryPicker' in window;
  const where = L.dir && L.dirOk ? 'This browser and your Planner folder' : L.dir ? 'This browser. The Planner folder needs reconnecting' : 'This browser';
  const tip = L.dir && L.dirOk ? 'Lessons are kept in this browser and in your Planner folder (' + L.dir.name + '). Click to look for lessons added or changed there.' : L.dir ? 'Click to reconnect your Planner folder.' : can ? 'Lessons are kept only in this browser. Click to choose a Planner folder as a second copy.' : 'Lessons are kept only in this browser. A Planner folder needs Chrome or Edge on a computer.';
  // The same words as the grading page: "Saved" only once a folder holds a second copy, and "Not backed up" in amber until then.
  const safe = !!(L.dir && L.dirOk), head = safe ? 'Saved' : 'Not backed up';
  const s = '<span class="rdot"></span><span class="rl"><b>' + head + '</b>' + esc(where) + '</span>';
  el.className = 'rsaved' + (safe ? '' : ' warn'); el.title = head + '. ' + tip; el.disabled = !can;
  if (el.dataset.h !== s) { el.dataset.h = s; el.innerHTML = s; }
  // A lesson, a unit or a document gets the room: the sidebar folds to icons.
  document.body.classList.toggle('pfold', L.view === 'edit' || L.view === 'doc' || L.view === 'unit');
  if (L.view === 'week' || L.view === 'semester') calView = L.view;
  const t = (L.view === 'edit' && L.open ? L.open.title + ' · ' : L.view === 'unit' && L.unit ? L.unit.title + ' · ' : '') + 'Planner · Grading Studio';
  if (document.title !== t) document.title = t;
}
$('#rail').addEventListener('click', async e => {
  const a = e.target.closest('a[href]');
  if (a) {
    if (a.id === 'railPlanner') { e.preventDefault(); return toView('week'); }
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // a new tab, as the browser does it
    e.preventDefault(); return leaveTo(a.href);
  }
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'findBtn') return openFind();
  if (b.id === 'railTimetable') return openTimetable();
  if (b.id === 'railSaved') return L.dir && L.dirOk ? folderRead(true) : L.dir ? folderReconnect(true) : folderLink();
});
new MutationObserver(railRender).observe($('#lessons'), { childList: true });

/* ---------- Find anything (Ctrl K, or ⌘K) ---------- */
// Everything she can go to or do from here. Each row does what the button for it does.
function findRows() {
  const out = [], add = (group, label, sub, run) => { if (label) out.push({ group, label: String(label), sub: sub || '', run }); };
  add('Go to', 'Today', 'What you teach today, what is waiting to be marked, what is ready to hand back', () => leaveTo(gsUrl('#/')));
  add('Go to', 'This week', 'The calendar, a week at a time', async () => { L.weekOf = ymd(mondayOf(new Date())); await toView('week'); });
  add('Go to', 'Semester', 'The calendar, every week and its units', () => toView('semester'));
  add('Go to', 'Units', 'Each unit, its weeks and its files', () => toView('units'));
  add('Go to', 'Past lessons', 'Old decks and their handouts, to use again', () => toView('library'));
  add('Go to', 'Activities', 'The activity bank', () => toView('activities'));
  add('Go to', 'Rubrics', 'Saved rubrics and grading scales', () => toView('bank'));
  add('Go to', 'Settings', 'Saving, classes, display and keys, on the grading page', () => leaveTo(gsUrl('#/settings')));
  for (const c of (L.setup && L.setup.classes) || []) add('Classes', c.name, 'Its assignments, gradebook and students', () => leaveTo(classUrl(c)));
  const when = l => l.slots.length ? l.slots.map(s => className(s.classId) + ' ' + shortDate(s.date)).join(', ') : l.library ? 'A past lesson' : 'Not on a class';
  for (const l of [...L.lessons].sort((a, b) => ((b.slots[0] || {}).date || '').localeCompare((a.slots[0] || {}).date || '') || b.updated - a.updated)) add('Lessons', l.title, when(l), async () => { await settleAll(); openLesson(l); });
  for (const u of L.units) add('Units', u.title, u.course, async () => { await settleAll(); L.open = null; L.doc = null; openUnit(u, calView); });
  add('Do', 'Make a new lesson', 'Not on a class yet', async () => { await toView('week'); createLesson([]); });
  add('Do', 'Import a lesson', 'A lesson file, a lesson pack, or pasted text', () => importLesson());
  add('Do', 'Timetable', 'Your classes, when they meet, and the school calendar', () => openTimetable());
  if ('showDirectoryPicker' in window) add('Do', L.dir && L.dirOk ? 'Look in the Planner folder' : L.dir ? 'Reconnect the Planner folder' : 'Link the Planner folder', L.dir && L.dirOk ? 'For lessons added or changed there' : 'A second copy of your lessons, in a folder of their own', () => L.dir && L.dirOk ? folderRead(true) : L.dir ? folderReconnect(true) : folderLink());
  add('Do', 'Side panel', 'Books, video, ' + (plCur() || 'the unit') + ', the notebook and the Claude box', () => panelToggle());
  add('Do', document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode', 'Display', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  return out;
}
// Every word typed has to be somewhere in the row. A name that starts with what she typed comes first.
function findMatch(rows, q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return rows.filter(r => r.group !== 'Lessons' && r.group !== 'Units');
  const hit = [];
  for (const r of rows) {
    const l = r.label.toLowerCase(), all = l + ' ' + r.sub.toLowerCase() + ' ' + r.group.toLowerCase();
    if (!words.every(w => all.includes(w))) continue;
    hit.push({ r, rank: l.startsWith(words[0]) ? 0 : l.split(/[^a-z0-9]+/).some(p => p.startsWith(words[0])) ? 1 : words.every(w => l.includes(w)) ? 2 : 3 });
  }
  const got = hit.sort((a, b) => a.rank - b.rank).map(x => x.r).slice(0, 40);
  // what is inside lessons, slides and documents is one step further: the Planner's own search
  if (q.trim().length >= 2) got.push({ group: 'Search', label: 'Search inside lessons for “' + q.trim() + '”', sub: 'Slides, notes, documents and units', run: () => findDlg(q.trim()) });
  return got;
}
function openFind() {
  if ($('#findDlg') || !$('#dlg').hidden) return;
  const back = document.activeElement, el = document.createElement('div');
  el.className = 'dlg finddlg'; el.id = 'findDlg';
  el.innerHTML = '<div class="fbox" role="dialog" aria-modal="true" aria-label="Find anything"><div class="fin"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>' +
    '<input type="text" id="findIn" role="combobox" aria-expanded="true" aria-controls="findList" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Find a lesson, a unit, a class or a setting"><kbd>Esc</kbd></div>' +
    '<div id="findList" role="listbox" aria-label="Results"></div><div class="ffoot"><span>↑ ↓ to move</span><span>Enter to open</span><span class="sp"></span><span id="findCount"></span></div></div>';
  const rows = findRows(), inp = el.querySelector('#findIn'), list = el.querySelector('#findList');
  let shown = [], at = 0;
  const mark = () => { [...list.querySelectorAll('.frow')].forEach((b, i) => { b.classList.toggle('on', i === at); b.setAttribute('aria-selected', String(i === at)); if (i === at) { b.scrollIntoView({ block: 'nearest' }); inp.setAttribute('aria-activedescendant', b.id); } }); };
  const render = () => {
    const hits = findMatch(rows, inp.value), groups = [];
    for (const r of hits) { let g = groups.find(x => x.name === r.group); if (!g) groups.push(g = { name: r.group, rows: [] }); g.rows.push(r); }
    shown = groups.flatMap(g => g.rows); at = 0;
    let k = 0;
    list.innerHTML = groups.map(g => '<div class="fcap">' + esc(g.name) + '</div>' + g.rows.map(r => '<button class="frow" role="option" id="fr' + k + '" data-fi="' + (k++) + '"><b>' + esc(r.label) + '</b><span>' + esc(r.sub) + '</span></button>').join('')).join('');
    el.querySelector('#findCount').textContent = inp.value.trim() ? '' : 'Lessons, units, classes and settings';
    mark();
  };
  const close = () => { document.removeEventListener('keydown', keys, true); el.remove(); if (back && back.isConnected && back !== document.body) try { back.focus({ preventScroll: true }); } catch { } };
  const run = i => { const r = shown[i]; if (!r) return; close(); r.run(); };
  const keys = e => {
    e.stopPropagation();   // nothing behind gets a key while this is up
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (shown.length) { at = (at + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length; mark(); } }
    else if (e.key === 'Enter') { e.preventDefault(); run(at); }
    else if (e.key === 'Tab') { e.preventDefault(); inp.focus(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); close(); }
  };
  inp.oninput = render;
  list.onclick = e => { const b = e.target.closest('.frow'); if (b) run(+b.dataset.fi); };
  list.onpointermove = e => { const b = e.target.closest('.frow'); if (b && +b.dataset.fi !== at) { at = +b.dataset.fi; mark(); } };
  el.addEventListener('pointerdown', e => { if (e.target === el) close(); });
  document.addEventListener('keydown', keys, true);
  editorCommit();
  document.body.appendChild(el);
  render(); inp.focus();
}
$('#findKey').textContent = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘K' : 'Ctrl K';
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k' || $('#findDlg') || !$('#dlg').hidden) return;
  e.preventDefault(); e.stopPropagation(); openFind();
}, true);

/* ---------- arriving from the grading page ---------- */
// planner.html#week opens this week, #timetable the timetable, #rubrics the rubric bank, #lesson/<id> one lesson,
// #present/<id>/<class id> one lesson, presenting.
// The address is tidied afterwards, so a refresh doesn't do it again.
function arriveAt() {
  let h; try { h = decodeURIComponent(location.hash.replace(/^#\/?/, '')); } catch { h = ''; }
  if (!h) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch { }
  const list = v => { L.open = null; L.unit = null; L.doc = null; L.view = v; renderLessons(); };
  if (h === 'week') { L.weekOf = ymd(mondayOf(new Date())); list('week'); }
  else if (h === 'rubrics') list('bank');
  else if (h === 'timetable') { list('week'); openTimetable(); }
  else if (h.startsWith('lesson/')) { const l = L.lessons.find(x => x.id === h.slice(7)); L.weekOf = ymd(mondayOf(new Date())); list('week'); if (l) openLesson(l); }
  else if (h.startsWith('present/')) { L.weekOf = ymd(mondayOf(new Date())); list('week'); presentArrive(h.slice(8)); }
}
