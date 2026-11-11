/* ---------------- the frame: the sidebar, Home's "Needs a look", and Find anything (11/9) ---------------- */
// The screens themselves are drawn by app.js (routeNow, applyRoute, renderLib). app.js and folder.js call the functions here while the
// app is still loading, before this file has run, so each one waits for shellReady.
var shellReady, screenWas = '';

// One colour per class, by its place in the sidebar. No sage or yellow-green, and no red: red is for marks on the paper.
function classColor(c) {
  const list = ['#1F6FB2', '#7B3FC4', '#0E7C86', '#A8327E', '#3D4CB8', '#9A5B13', '#0B6E99', '#5B6472'], i = lib.classes.indexOf(c);
  return i < 0 ? '#8A8F98' : list[i % list.length];
}
// Papers left to score in a class: its kept downloads, counted the way Home counts them. Formative work has no score to wait for.
function classLeft(c) {
  let n = 0;
  for (const u of c.units) for (const it of u.items) { const m = it.batchId && it.type !== 'fm' ? keptMeta.get(it.batchId) : null; if (m) n += keptState(m).left; }
  return n;
}
function railRender() {
  if (!shellReady) return;
  const r = routeNow(), open = batch ? batchClass() : null, cur = batch ? open : r.v === 'class' ? r.c : null;
  const row = c => {
    const n = classLeft(c), name = c === lib.loose ? 'No class' : c.name, on = cur === c;
    return '<a class="rnav' + (on ? ' on' : '') + '" href="' + classHash(c) + '" data-railcls="' + esc(c.id) + '" title="' + esc(name) + (n ? ' · ' + n + ' left to score' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' +
      '<span class="rdot" style="background:' + classColor(c) + '"></span><span class="rl rname">' + esc(name) + '</span>' + (n ? '<span class="rl rcnt">' + n + '</span>' : '') + '</a>';
  };
  const h = lib.classes.map(row).join('') + (lib.loose.units.some(u => u.items.length) ? row(lib.loose) : '');
  const box = $('#railClasses'); if (box.dataset.h !== h) { box.dataset.h = h; box.innerHTML = h; }   // a link shouldn't be swapped out from under her click
  for (const a of document.querySelectorAll('#rail [data-nav]')) { const on = !batch && a.dataset.nav === r.v; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  const cr = $('#crumbClass'); cr.hidden = !(batch && open);
  if (batch && open) { cr.textContent = open.name; cr.href = classHash(open); cr.title = 'Back to ' + open.name; }
  tabsRender(); setRender(); helpRender(); todoRender();
  if (!batch && r.v === 'home' && screenWas !== 'home') planRefresh();
  screenWas = batch ? 'a' : r.v;
  const d = $('#homeDate'), today = new Date().toLocaleDateString(LANG_LOCALE, { weekday: 'long', month: 'long', day: 'numeric' }); if (d.textContent !== today) d.textContent = today;   // Today's title is the day itself
  // The tab's name goes into the browser's history, which some browsers copy to an account. A download's name can be a student's, so it stays out;
  // an assignment or class name she typed herself is fine.
  const asg = batch && batch.assignment && findItem(batch.assignment.id);
  document.title = batch ? (asg ? asg.it.name + ' · ' : '') + 'Grading Studio' : r.v === 'class' ? (r.c === lib.loose ? 'No class' : r.c.name) + ' · Grading Studio' : r.v === 'settings' ? (r.sec === 'saving' ? '' : SET_SECS.find(x => x[0] === r.sec)[1] + ' · ') + 'Settings · Grading Studio' : r.v === 'help' ? 'Help · Grading Studio' : r.v === 'todo' ? 'To do · Grading Studio' : 'Grading Studio';
}
// "Saved", and where: the same words as the top bar while grading and the line in Settings (folder.js says them).
function railSavedRender() {
  if (!shellReady) return;
  const el = $('#railSaved'), w = whereSay(), st = batch ? ($('#saveState').textContent || '').replace(/^[✓⚠]\s*/, '').trim() : '';
  // "Saved" is only said when a second copy exists outside this browser. Until then it is "Not backed up", in amber.
  const bad = saveBad.size > 0, head = bad ? (/saved/i.test(st) && !/^Saved/.test(st) ? st : 'Not saved') : /^Saving/.test(st) ? 'Saving…' : w.safe ? 'Saved' : 'Not backed up';
  const h = '<span class="rdot"></span><span class="rl"><b>' + esc(head) + '</b>' + esc(w.sub || w.text) + '</span>';
  el.className = 'rsaved' + (bad ? ' bad' : w.cls ? ' ' + w.cls : '');
  el.title = (w.safe || bad ? head + '. ' : '') + w.text + '. ' + w.tip;
  el.toggleAttribute('data-wact', !!w.act); el.toggleAttribute('data-wopen', !w.act);
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
}
// Today: the few things waiting on her, gathered from where each used to be said.
function renderNeeds() { if (shellReady) homeRender(); }
function renderNeedsOnly() {
  safeAskRender(); sampleNoteRender();
  const el = $('#needs'), rows = [], chev = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  for (const m of [...keptMeta.values()].sort((a, b) => b.t - a.t)) {
    if (m.partial && m.papers) rows.push({ t: m.partial + (m.partial === 1 ? ' paper is' : ' papers are') + ' partly scored', s: m.name || 'A download', open: m.id });
    else if (!m.papers) rows.push({ t: 'Papers not kept in this browser', s: (m.name || 'A download') + ': drop the download in again to reopen it' });
  }
  const last = store.get('gs.lastBackup', 0), days = Math.floor((Date.now() - last) / 864e5);
  if (keptMeta.size > 0 && fld.state === 'none' && days >= 7 && !safeAskShown()) rows.push({ t: last ? 'Your take-home file is ' + days + ' days old' : 'Your work is not backed up', s: 'Choose a folder or make a take-home file, in Settings', href: '#/settings' });
  const h = !rows.length ? '' : '<section class="ncard"><div class="nhead"><h2>Needs a look</h2><span class="schip warn">' + rows.length + '</span></div>' +
    rows.slice(0, 6).map(r => { const body = '<span class="nt"><b>' + esc(r.t) + '</b><span class="ns">' + esc(r.s) + '</span></span>'; return r.open ? '<button class="nrow" data-nopen="' + esc(r.open) + '">' + body + chev + '</button>' : r.href ? '<a class="nrow" href="' + r.href + '">' + body + chev + '</a>' : '<div class="nrow">' + body + '</div>'; }).join('') +
    (rows.length > 6 ? '<div class="nrow"><span class="ns">and ' + (rows.length - 6) + ' more</span></div>' : '') + '</section>';
  el.hidden = !h;
  if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
}
$('#needs').addEventListener('click', e => { const b = e.target.closest('[data-nopen]'); if (b && !b.disabled) { b.disabled = true; reopenKept(b.dataset.nopen).finally(() => { b.disabled = false; }); } });

// Links inside the app go at once, so the screen has changed by the time the click is over. With Ctrl or ⌘ held, the browser opens the screen in a new tab as usual.
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href^="#/"]'); if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault(); go(a.getAttribute('href'));
});
window.addEventListener('hashchange', applyRoute);
// The sidebar's "Saved" follows the top bar's while a paper is open.
new MutationObserver(railSavedRender).observe($('#saveState'), { childList: true, characterData: true, subtree: true });

/* ---------------- Find anything (Ctrl K, or ⌘K): one box that reaches every student, assignment, tool and setting ---------------- */
// Everything she can go to or do right now. Each row presses the same button or runs the same function as doing it by hand.
function findRows() {
  const out = [], add = (group, label, sub, run, key) => { if (label) out.push({ group, label: String(label), sub: sub || '', run, key: key || '' }); };
  const press = sel => () => { const b = $(sel); if (b) b.click(); };
  const toMark = () => { if (dlgPage) closeDlg(); };   // a student or a marking tool is on the papers: a tab's screen steps aside first
  if (batch) {
    const order = anonOn() ? anonOrder() : batch.students.map((_, i) => i);
    order.forEach((i, pos) => { const st = batch.students[i], g = gradeOf(st); add('Students', shownName(st, i), noScore(st) ? STATUS_LABEL[g.status] : g.done ? 'Scored' : g.total != null ? 'Partly scored' : st.files.length ? 'Not scored yet' : 'No paper', () => { toMark(); openStudent(i); }, String(pos + 1)); });
    for (const b of document.querySelectorAll('#tools .tool[data-tool]')) { const m = /^(.*?) \((.*)\)$/.exec(b.title) || [0, b.title, '']; add('Marking tools', m[1], 'Tool for the paper', () => { toMark(); setTool(b.dataset.tool); }, m[2]); }
    // what + Add and the ⋯ beside the student's name hold, for the paper that is open
    for (const b of document.querySelectorAll('#paper .who .km .mitem:not([data-whodo])')) { const s = b.querySelector('small'); add('This paper', (b.closest('.kmw').querySelector('#addMenuBtn') ? 'Add ' : '') + b.firstChild.textContent.trim().replace(/^A /, 'a ').replace(/^Pasted/, 'pasted').replace(/^From/, 'pages from'), s ? s.textContent : '', () => { toMark(); if (b.isConnected) b.click(); }); }
    const tabGo = (k, label, sub) => add('This assignment', label, sub, () => go(batchHash(batch.id, k)));
    tabGo('', 'Mark', 'The papers, one student at a time');
    tabGo('grades', 'Grades', 'Scores and comments to copy into ' + sysOr('your gradebook') + ', beside the grade written on each paper');
    tabGo('grades/sheet', 'Grade sheet', 'Every grade found on the papers, with a crop of each');
    tabGo('insights', 'Insights', 'The class at a glance: average, spread, rubric rows, charts');
    tabGo('insights/consistency', 'Consistency check', 'Did you get harder or softer as you went?');
    tabGo('return', 'Return marked files', 'The marked files, back in their student folders');
    { const b = $('#quizTop'); if (b && !b.hidden) add('This assignment', b.textContent, b.title, press('#quizTop')); }
    for (const b of document.querySelectorAll('#moreMenu .mitem, #toolStash .mitem')) {
      if (b.hidden || b.classList.contains('themeBtn') || b.id === 'keysBtn' || b.id === 'sheetBtn' || b.id === 'overviewBtn' || b.id === 'consBtn') continue;
      const k = b.querySelector('kbd'), label = [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      add(b.dataset.fg || 'This assignment', label, b.title, () => { if (b.dataset.paper) toMark(); b.click(); }, k ? k.textContent : '');
    }
    const words = wordPdfList();
    if (words.length) add('This assignment', 'Convert Word papers to PDF pages', words.length + (words.length === 1 ? ' Word paper' : ' Word papers') + ' here. The Word files are kept', () => {
      const x = words.find(x => x.st === batch.students[cur]) || words[0];
      toMark();
      if (x.st !== batch.students[cur]) openStudent(batch.students.indexOf(x.st));
      openWordPdf(x.st, x.f);
    });
    add('This assignment', 'Close this assignment', 'Saved first, then back to Today', () => go('#/'));
  }
  add('Go to', 'Today', 'What you teach today, what is waiting to be marked, what is ready to hand back', () => go('#/'));
  add('Go to', 'To do', 'Your own list, with what the app noticed from your work', () => go('#/todo'));
  add('Go to', 'Planner', 'Units and lessons, on its own page', () => { location.href = $('#lessonsBtn').href; });
  add('Go to', 'Settings', 'Saving, classes, terms, marking, display and keys', () => go('#/settings'));
  add('Go to', 'Help', 'Short answers to common questions', () => go('#/help'));
  for (const c of lib.classes) {
    add('Classes', c.name, (c.names.length ? c.names.length + ' students' : 'No roster yet') + (classLeft(c) ? ' · ' + classLeft(c) + ' left to score' : ''), () => go(classHash(c)));
    if (c.names.length) for (const [k, l, sub] of [['gradebook', 'gradebook', 'Every assignment by term, with each term grade'], ['students', 'students', 'The roster, with IDs and emails, and each student’s own page'], ['missing', 'missing work', 'Who still owes work, with a reminder email for each student'], ['charts', 'charts', 'Grades and scores as charts'], ['reports', 'report comments', 'A draft comment for each student, from your own scores and comments']]) add('Class pages', c.name + ' ' + l, sub, () => go(classHash(c, k)));
  }
  const carded = new Set();
  for (const c of holders()) for (const u of c.units) for (const it of u.items) {
    const m = it.batchId ? keptMeta.get(it.batchId) : null; if (it.batchId) carded.add(it.batchId);
    const here = batch && batch.id === it.batchId;
    add('Assignments', it.name, (c === lib.loose ? 'No class' : c.name) + ' · ' + u.name + (here ? ' · open now' : m && m.papers ? ' · ' + keptState(m).done + ' of ' + keptState(m).of + ' scored' : ''), () => here ? null : m && m.papers ? reopenKept(it.batchId, it) : go(classHash(c)));
  }
  for (const m of keptMeta.values()) if (!carded.has(m.id) && m.papers && !(batch && batch.id === m.id)) add('Assignments', m.name || 'A download', 'Kept in this browser · ' + keptState(m).done + ' of ' + keptState(m).of + ' scored', () => reopenKept(m.id));
  if (!batch) {
    add('Do', sysName() ? 'Open a ' + sysName() + ' download' : 'Open student work', sysName() ? 'The ZIP or PDFs' : 'A ZIP, PDFs, Word files or photos', press('#pickFiles'));
    add('Do', 'Open a folder of papers', '', press('#pickFolder'));
    add('Do', 'Split a scan of everyone’s papers', '', press('#pickScan'));
    add('Do', 'Match files to a roster', '', press('#pickMatch'));
    add('Do', 'Add a class', 'Its name and roster', press('#addClass'));
    add('Do', 'Try it with a sample class', 'Made-up students and papers', press('#sample'));
    add('Settings', 'Take my work with me', 'A take-home file for another computer', press('#takeBtn'));
    add('Settings', 'Bring work in', 'From a take-home file', press('#restoreBtn'));
    add('Settings', 'Remove from this computer', 'Clears student work from this browser', () => go('#/settings'));
  }
  if (!batch) add('Do', 'Add a to-do', 'Type it the way you would say it', () => tdFocusAdd(), 'N');
  add('Settings', 'Where my work is saved', 'This browser, and a folder you choose', () => openWhere());
  add('Settings', 'Go back in time', 'An assignment, or everything, as it was on an earlier day', () => go(setHash('history')));
  add('Settings', 'Updates and installing', 'This version, what’s new, install as an app', () => go(setHash('about')));
  add('Settings', document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode', 'Display', press('.themeBtn'));
  add('Settings', 'Text size and zoom', 'Display', () => openDisplay());
  add('Settings', 'App language', 'English, Spanish or Traditional Chinese', () => go('#/settings/display'));
  add('Settings', 'Word papers', wordPdfAlways() ? 'Converted to PDF pages as each assignment opens' : 'Kept as Word files. They can be converted to PDF pages', () => go('#/settings/marking'));
  add('Settings', 'Tablet and pencil', 'What a finger does on the paper, and pencil pressure', () => go('#/settings/marking'));
  add('Settings', 'All keys', 'Every keyboard shortcut', () => openKeys(), '?');
  for (const [k, t, sub] of SET_SECS) if (k !== 'saving' && k !== 'display' && k !== 'keys' && k !== 'history' && k !== 'about') add('Settings', t, sub, () => go(setHash(k)));
  if (plan) add('Go to', 'This week in the Planner', 'Today’s classes and the lessons planned for them', () => { location.href = planUrl('#week'); });
  out.push(...helpFindRows());
  return out;
}
// Every word typed has to be somewhere in the row. A name that starts with what she typed comes first.
function findMatch(rows, q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return rows.filter(r => r.group !== 'Students' && r.group !== 'Assignments' && r.group !== 'Class pages' && r.group !== 'Help' || batch && r.group === 'Students').slice(0, 60);
  const hit = [];
  for (const r of rows) {
    const l = tr(r.label).toLowerCase(), all = l + ' ' + r.label.toLowerCase() + ' ' + r.sub.toLowerCase() + ' ' + tr(r.sub).toLowerCase() + ' ' + r.group.toLowerCase() + ' ' + tr(r.group).toLowerCase() + ' ' + (r.words || '').toLowerCase();   // in another language (lang.js) a row is found by its words in either
    if (!words.every(w => all.includes(w))) continue;
    hit.push({ r, rank: l.startsWith(words[0]) ? 0 : l.split(/[^a-z0-9]+/).some(p => p.startsWith(words[0])) ? 1 : words.every(w => l.includes(w)) ? 2 : 3 });
  }
  return hit.sort((a, b) => a.rank - b.rank).map(x => x.r).slice(0, 40);
}
// Rows named by something she typed (a class, a student, an assignment): never put into another language (lang.js).
const FIND_NAMES = new Set(['Classes', 'Students', 'Assignments']);
function openFind() {
  if ($('#findDlg') || $('#askDlg') || (!$('#dlg').hidden && !dlgPage)) return;
  commitEditors(); setMore(false);
  const back = document.activeElement, el = document.createElement('div');
  el.className = 'dlg finddlg'; el.id = 'findDlg';
  el.innerHTML = '<div class="fbox" role="dialog" aria-modal="true" aria-label="Find anything"><div class="fin"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>' +
    '<input type="text" id="findIn" role="combobox" aria-expanded="true" aria-controls="findList" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Find a student, an assignment, a tool or a setting"><kbd>Esc</kbd></div>' +
    '<div id="findList" role="listbox" aria-label="Results"></div><div class="ffoot"><span>↑ ↓ to move</span><span>Enter to open</span><span class="sp"></span><span id="findCount"></span></div></div>';
  const rows = findRows(), inp = el.querySelector('#findIn'), list = el.querySelector('#findList');
  let shown = [], at = 0;
  const mark = () => { [...list.querySelectorAll('.frow')].forEach((b, i) => { b.classList.toggle('on', i === at); b.setAttribute('aria-selected', String(i === at)); if (i === at) { b.scrollIntoView({ block: 'nearest' }); inp.setAttribute('aria-activedescendant', b.id); } }); };
  const render = () => {
    const hits = findMatch(rows, inp.value), groups = [];
    for (const r of hits) { let g = groups.find(x => x.name === r.group); if (!g) groups.push(g = { name: r.group, rows: [] }); g.rows.push(r); }
    shown = groups.flatMap(g => g.rows); at = 0;
    let k = 0;
    list.innerHTML = groups.map(g => '<div class="fcap">' + esc(g.name) + '</div>' + g.rows.map(r => '<button class="frow" role="option" id="fr' + k + '" data-fi="' + (k++) + '"><b' + (FIND_NAMES.has(g.name) ? ' data-raw' : '') + '>' + esc(r.label) + '</b><span>' + esc(r.sub) + '</span>' + (r.key ? '<kbd>' + esc(keyLabel(r.key)) + '</kbd>' : '') + '</button>').join('')).join('') || '<div class="fnone">Nothing matches “' + esc(inp.value.trim()) + '”.</div>';
    el.querySelector('#findCount').textContent = inp.value.trim() ? shown.length + (shown.length === 1 ? ' match' : ' matches') : 'Students, assignments, tools and settings';
    mark();
  };
  const close = () => { document.removeEventListener('keydown', keys, true); el.remove(); if (back && back.isConnected && back !== document.body) back.focus({ preventScroll: true }); };
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
  document.body.appendChild(el);
  render(); inp.focus();
}
$('#findBtn').onclick = openFind;
$('#findKey').textContent = isMac() ? '⌘K' : 'Ctrl K';
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k' || $('#findDlg')) return;
  if ($('#askDlg') || (!$('#dlg').hidden && !dlgPage)) return;
  e.preventDefault(); e.stopPropagation(); openFind();
}, true);

shellReady = true;
railSavedRender(); renderNeeds(); safeAskRender(); updRender();
applyRoute();
Object.assign(window.__gs, { go, routeNow, applyRoute, openFind, findRows, keptState, classLeft });
