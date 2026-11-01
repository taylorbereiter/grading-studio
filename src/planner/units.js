/* ================= Units and the semester =================
   A unit belongs to a course (both sections of a course share it) and runs for some weeks from a Monday.
   Each week has a focus (usually from Atlas), the teacher's own notes and standards. Atlas screenshots and
   summative files live with the unit. Everything here is planning only, in the Planner's own database,
   and it goes to the Planner folder so Claude can fill in weeks from a screenshot. */
const UNIT_COLORS = ['#1F6FB2', '#7B3FC4', '#B71E42', '#0E7C66', '#B35C00', '#3D5A80', '#8E3B8A', '#2F6B2F'];
const MAX_FILE = 40 * 1024 * 1024;

/* ---------- top bar shared by every Planner view ---------- */
function topBar(view, extra) {
  const tab = (v, t) => '<button class="pl-tab' + (view === v ? ' on' : '') + '" data-a="tab" data-v="' + v + '"' + (view === v ? ' aria-current="page"' : '') + '>' + t + '</button>';
  return '<div class="ls-top"><span class="title">Planner</span><nav class="pl-tabs" aria-label="Views">' + tab('semester', 'Semester') + tab('week', 'Week') + tab('units', 'Units') + tab('activities', 'Activities') + tab('bank', 'Rubrics') + '</nav>' +
    (extra || '') + '<span class="sp"></span>' + folderChip() +
    '<button class="btn sm ghost" data-a="import">Import…</button><button class="btn sm ghost" data-a="setup">Timetable</button><button class="btn sm ghost themeBtn">' + (document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode') + '</button>' +
    '<button class="btn sm" data-a="close" title="Go to grading. The Planner and grading keep their work apart.">Grading Studio</button></div>';
}

// The Planner folder must never be the grading folder, or hold it: Claude reads everything in the Planner folder.
async function notGradingFolder(h) {
  const why = 'That folder has Grading Studio’s grading files in it. Pick or make a folder just for planning, like “Lessons”.';
  try { await h.getFileHandle('gs-folder.json'); return why; } catch { }
  try { await h.getDirectoryHandle('Grading Studio'); return why; } catch { }
  try { for await (const [n] of h.entries()) if (/^(downloads|snapshots|library\.json|tombstones\.json)$/.test(n)) return why; } catch { }
  return '';
}

/* ---------- storage: units in kv 'units', each file's bytes under kv 'file:<id>' ---------- */
async function unitsLoad() { L.units = ((await kvGet('units')) || []).map(normUnit); }
async function unitsSave() { await kvSet('units', L.units.map(u => { const c = { ...u }; delete c._file; delete c._mod; return { ...c, _file: u._file, _mod: u._mod }; })); }
function normUnit(x) {
  x = x && typeof x === 'object' ? x : {};
  const weeks = (Array.isArray(x.weeks) ? x.weeks : []).map(w => ({ focus: String((w && w.focus) || ''), notes: String((w && w.notes) || ''), standards: String((w && w.standards) || '') }));
  const files = (Array.isArray(x.files) ? x.files : []).filter(f => f && typeof f.name === 'string').map(f => ({ id: typeof f.id === 'string' ? f.id : '', name: f.name, kind: ['atlas', 'summative', 'other'].includes(f.kind) ? f.kind : 'other', type: String(f.type || ''), size: +f.size || 0, added: +f.added || 0 }));
  const start = /^\d{4}-\d\d-\d\d$/.test(x.start) ? ymd(mondayOf(parseYmd(x.start))) : ymd(mondayOf(new Date()));
  const u = { id: typeof x.id === 'string' && x.id ? x.id : lid(), course: String(x.course || ''), title: String(x.title || 'New unit'), start, weeks: weeks.length ? weeks : [{ focus: '', notes: '', standards: '' }],
    atlas: /^https?:\/\//.test(x.atlas) ? String(x.atlas) : '', color: /^#[0-9a-f]{6}$/i.test(x.color) ? x.color : '', files, updated: +x.updated || Date.now() };
  if (x._file) u._file = x._file; if (x._mod) u._mod = x._mod;
  return u;
}
async function unitPut(u, quiet) {
  u.updated = Date.now();
  const i = L.units.findIndex(x => x.id === u.id); if (i >= 0) L.units[i] = u; else L.units.push(u);
  await unitsSave();
  unitWriteSoon(u);
  if (!quiet) savedMark();
}
function savedMark() { const e = $('#plSaved'); if (e) { e.textContent = '✓ Saved'; } }
async function unitDelete(u) {
  for (const f of u.files) if (f.id) await lTx('kv', 'readwrite', s => { s.delete('file:' + f.id); });
  L.units = L.units.filter(x => x.id !== u.id); await unitsSave();
  if (L.dir && L.dirOk && u._file) { try { const d = await L.dir.getDirectoryHandle('Units'); await d.removeEntry(u._file); await d.removeEntry(u._file.replace(/\.unit\.json$/, ' files'), { recursive: true }); } catch { } }
}
const fileBlob = id => kvGet('file:' + id);

/* ---------- courses, weeks, which unit a week is in ---------- */
function courses() {
  const out = [];
  for (const c of (L.setup && L.setup.classes) || []) {
    const k = c.course || c.name; let o = out.find(x => x.course === k);
    if (!o) out.push(o = { course: k, classes: [], color: c.color });
    o.classes.push(c);
  }
  for (const u of L.units) if (u.course && !out.some(x => x.course === u.course)) out.push({ course: u.course, classes: [], color: '#5C616A' });
  return out;
}
const unitColor = u => u.color || UNIT_COLORS[Math.max(0, L.units.filter(x => x.course === u.course).sort((a, b) => a.start.localeCompare(b.start)).indexOf(u)) % UNIT_COLORS.length];
const unitEnd = u => ymd(addDays(parseYmd(u.start), 7 * (u.weeks.length - 1)));
function unitAt(course, monday) {
  for (const u of L.units) {
    if (u.course !== course) continue;
    const n = Math.round((parseYmd(monday) - parseYmd(u.start)) / 864e5 / 7);
    if (n >= 0 && n < u.weeks.length) return { u, n };
  }
  return null;
}
function semesterMondays() {
  const s = L.setup || {}, today = mondayOf(new Date());
  let a = s.semStart ? parseYmd(s.semStart) : null, b = s.semEnd ? parseYmd(s.semEnd) : null;
  if (!a) { const starts = L.units.map(u => u.start).sort(); a = starts.length ? parseYmd(starts[0]) : addDays(today, -28); }
  if (!b) { const ends = L.units.map(unitEnd).sort(); b = addDays(today, 7 * 12); if (ends.length && parseYmd(ends[ends.length - 1]) > b) b = parseYmd(ends[ends.length - 1]); }
  if (b < a) b = addDays(a, 7 * 18);
  const out = []; for (let d = mondayOf(a); d <= b && out.length < 60; d = addDays(d, 7)) out.push(ymd(d));
  return out;
}
const schoolWeek = monday => { const s = L.setup && L.setup.semStart; if (!s) return 0; const n = Math.round((parseYmd(monday) - parseYmd(s)) / 864e5 / 7) + 1; return n >= 1 ? n : 0; };
const weekDays = monday => [0, 1, 2, 3, 4].map(i => ymd(addDays(parseYmd(monday), i)));
function weekMeetings(course, monday) {
  const ids = new Set(((courses().find(c => c.course === course) || {}).classes || []).map(c => c.id));
  return weekDays(monday).flatMap(d => meetingsOn(d).filter(m => ids.has(m.c.id)));
}
const rangeLabel = monday => { const a = parseYmd(monday), b = addDays(a, 4); return (a.getMonth() + 1) + '/' + a.getDate() + '–' + (b.getMonth() !== a.getMonth() ? (b.getMonth() + 1) + '/' : '') + b.getDate(); };

/* ---------- semester view: every week down, each course across ---------- */
function renderSemester() {
  const cs = courses(), weeks = semesterMondays(), now = ymd(mondayOf(new Date()));
  let h = topBar('semester', '<button class="btn sm" data-a="newunit">+ New unit</button>');
  if (!L.setup) { $('#lessons').innerHTML = h + setupNeeded(); return; }
  h += '<div class="pl-sem" style="--cols:' + Math.max(1, cs.length) + '"><div class="pl-row pl-head"><div class="pl-wkc">Week</div>' + cs.map(c => '<div class="pl-cc"><span class="pl-dot" style="background:' + esc(c.color) + '"></span>' + esc(c.course) + '</div>').join('') + '</div>';
  for (const m of weeks) {
    const off = weekDays(m).map(dayOff).filter(Boolean), ev = [...new Set(weekDays(m).flatMap(eventsOn).map(e => e.label))];
    const sw = schoolWeek(m);
    h += '<div class="pl-row' + (m === now ? ' now' : '') + (m < now ? ' past' : '') + '" data-wk="' + m + '"><div class="pl-wkc"><b>' + (sw ? 'Week ' + sw : rangeLabel(m)) + '</b>' + (sw ? '<span>' + rangeLabel(m) + '</span>' : '') +
      off.map(o => '<span class="pl-off">' + esc(shortDate(o.date)) + ' ' + esc(o.label) + '</span>').join('') + ev.map(e => '<span class="pl-ev">' + esc(e) + '</span>').join('') + '</div>';
    for (const c of cs) {
      const at = unitAt(c.course, m), ms = weekMeetings(c.course, m), planned = ms.filter(x => lessonsAt(x.c.id, x.date).length).length;
      h += '<button class="pl-cell' + (at ? ' has' : '') + '" data-a="gowk" data-wk="' + m + '"' + (at ? ' style="--uc:' + esc(unitColor(at.u)) + '"' : '') + ' title="Open this week">';
      if (at) {
        h += (at.n === 0 ? '<span class="pl-ut">' + esc(at.u.title) + '</span>' : '<span class="pl-un">' + esc(at.u.title) + '</span>') +
          '<span class="pl-wn">Week ' + (at.n + 1) + ' of ' + at.u.weeks.length + '</span>' + (at.u.weeks[at.n].focus ? '<span class="pl-fo">' + esc(at.u.weeks[at.n].focus) + '</span>' : '');
      } else h += '<span class="pl-nou">No unit</span>';
      if (ms.length) h += '<span class="pl-dots" aria-label="' + planned + ' of ' + ms.length + ' classes have a lesson">' + ms.map(x => '<i class="' + (lessonsAt(x.c.id, x.date).length ? 'on' : '') + '"></i>').join('') + '<em>' + planned + '/' + ms.length + ' planned</em></span>';
      h += '</button>';
    }
    h += '</div>';
  }
  h += '</div>';
  $('#lessons').innerHTML = h;
  const cur = document.querySelector('.pl-row.now'); if (cur) cur.scrollIntoView({ block: 'center' });
}
function setupNeeded() {
  return '<div class="ls-empty"><h2>Load your timetable</h2><p>The Planner lines lessons and units up with your classes once it knows when they meet. Load a setup file (timetable, days off, semester dates and slide template), or type your classes in.</p>' +
    '<div class="row"><button class="btn primary" data-a="loadsetup">Load setup file…</button><button class="btn" data-a="setup">Type in my classes</button></div></div>';
}

/* ---------- the unit strip above the week view ---------- */
function weekUnitsBar(monday) {
  const cs = courses(); if (!cs.length) return '';
  return '<div class="pl-wbar">' + cs.map(c => {
    const at = unitAt(c.course, monday);
    if (!at) return '<div class="pl-wu none"><b>' + esc(c.course) + '</b><span>No unit this week</span><button class="btn sm ghost" data-a="newunit" data-course="' + esc(c.course) + '" data-start="' + monday + '">+ Unit</button></div>';
    const w = at.u.weeks[at.n];
    return '<div class="pl-wu" style="--uc:' + esc(unitColor(at.u)) + '"><b>' + esc(c.course) + ' · ' + esc(at.u.title) + '</b><span>Week ' + (at.n + 1) + ' of ' + at.u.weeks.length + (w.focus ? ': ' + esc(w.focus) : '') + '</span>' +
      (w.standards ? '<span class="pl-std">' + esc(w.standards) + '</span>' : '') + '<button class="btn sm ghost" data-a="openunit" data-u="' + at.u.id + '">Open unit</button></div>';
  }).join('') + '</div>';
}

/* ---------- units list ---------- */
function renderUnits() {
  let h = topBar('units', '<button class="btn sm" data-a="newunit">+ New unit</button>');
  const cs = courses();
  if (!L.units.length) h += '<div class="ls-empty"><h2>No units yet</h2><p>Make a unit for each course: its weeks, what each week is about, your Atlas screenshots and the summative files, all in one place.</p><div class="row"><button class="btn primary" data-a="newunit">+ New unit</button></div></div>';
  else {
    h += '<div class="pl-units">';
    for (const c of cs) {
      const us = L.units.filter(u => u.course === c.course).sort((a, b) => a.start.localeCompare(b.start)); if (!us.length) continue;
      h += '<section><h2>' + esc(c.course) + '</h2><div class="ls-cards">' + us.map(u => '<button class="ls-card pl-ucard" style="--uc:' + esc(unitColor(u)) + '" data-a="openunit" data-u="' + u.id + '"><b>' + esc(u.title) + '</b><span>' + shortDate(u.start) + ' to ' + shortDate(ymd(addDays(parseYmd(unitEnd(u)), 4))) + ' · ' + u.weeks.length + ' week' + (u.weeks.length === 1 ? '' : 's') + (u.files.length ? ' · ' + u.files.length + ' file' + (u.files.length === 1 ? '' : 's') : '') + '</span></button>').join('') + '</div></section>';
    }
    h += '</div>';
  }
  $('#lessons').innerHTML = h;
}

/* ---------- one unit ---------- */
function renderUnit() {
  const u = L.unit, cs = courses(), mons = semesterMondays();
  if (!mons.includes(u.start)) mons.push(u.start), mons.sort();
  const atlas = u.files.filter(f => f.kind === 'atlas'), other = u.files.filter(f => f.kind !== 'atlas');
  let h = '<div class="ls-top"><button class="btn sm ghost" data-a="uback">‹ ' + (L.unitBack === 'semester' ? 'Semester' : L.unitBack === 'week' ? 'Week' : 'Units') + '</button>' +
    '<input class="ls-title-in" data-uf="title" value="' + esc(u.title) + '" aria-label="Unit name">' +
    '<span class="sp"></span><span class="savest" id="plSaved">Saved</span><button class="btn sm ghost" data-a="udel">Delete unit</button></div>';
  h += '<div class="pl-unit">';
  h += '<section class="pl-card pl-meta"><label>Course <select class="btn sm" data-uf="course">' + cs.map(c => '<option' + (c.course === u.course ? ' selected' : '') + '>' + esc(c.course) + '</option>').join('') + '</select></label>' +
    '<label>Starts <select class="btn sm" data-uf="start">' + mons.map(m => '<option value="' + m + '"' + (m === u.start ? ' selected' : '') + '>' + (schoolWeek(m) ? 'Week ' + schoolWeek(m) + ' · ' : '') + rangeLabel(m) + '</option>').join('') + '</select></label>' +
    '<label>Weeks <span class="pl-step"><button class="btn sm" data-a="wkminus" aria-label="One week fewer">−</button><b>' + u.weeks.length + '</b><button class="btn sm" data-a="wkplus" aria-label="One week more">+</button></span></label>' +
    '<label class="pl-atl">Atlas page <input class="btn sm" data-uf="atlas" placeholder="Paste the unit’s Atlas link" value="' + esc(u.atlas) + '">' + (u.atlas ? '<a class="btn sm" href="' + esc(u.atlas) + '" target="_blank" rel="noopener">Open</a>' : '') + '</label></section>';
  // Atlas screenshots
  h += '<section class="pl-card"><div class="lhead"><h2>From Atlas</h2><span class="sp"></span><button class="btn sm" data-a="addshot">Add screenshot…</button><button class="btn sm" data-a="pasteweeks">Type or paste the weeks…</button>' +
    '<button class="btn sm primary" data-a="askweeks"' + (atlas.length ? '' : ' disabled title="Add an Atlas screenshot first"') + '>Ask Claude to fill the weeks</button></div>' +
    '<div class="pl-drop" id="plShotDrop" tabindex="0">' + (atlas.length ? '<div class="pl-shots">' + atlas.map(f => '<figure class="pl-shot"><button class="pl-shotimg" data-a="viewfile" data-fid="' + f.id + '" aria-label="Look at ' + esc(f.name) + '"><img data-fimg="' + f.id + '" alt=""></button><figcaption>' + esc(f.name) + '<button class="btn sm ghost" data-a="rmfile" data-fid="' + f.id + '">Remove</button></figcaption></figure>').join('') + '</div>' : '') +
    '<p class="muted">' + (atlas.length ? 'Paste or drop more screenshots here.' : 'Take a screenshot of the unit in Atlas, then paste it here (Ctrl+V or ⌘V) or drop the picture in.') + '</p></div></section>';
  // weeks
  h += '<section class="pl-card"><div class="lhead"><h2>Weeks</h2></div><div class="pl-weeks">';
  u.weeks.forEach((w, i) => {
    const m = ymd(addDays(parseYmd(u.start), 7 * i)), cls = ((cs.find(c => c.course === u.course) || {}).classes || []);
    const ms = weekMeetings(u.course, m), off = weekDays(m).map(dayOff).filter(Boolean), ev = [...new Set(weekDays(m).flatMap(eventsOn).map(e => e.label))];
    h += '<div class="pl-week"><div class="pl-wh"><b>Week ' + (i + 1) + '</b><span>' + (schoolWeek(m) ? 'School week ' + schoolWeek(m) + ' · ' : '') + rangeLabel(m) + '</span>' + off.map(o => '<span class="pl-off">' + esc(shortDate(o.date)) + ' ' + esc(o.label) + '</span>').join('') + ev.map(e => '<span class="pl-ev">' + esc(e) + '</span>').join('') + '</div>' +
      '<label class="pl-fl">Focus<textarea rows="2" data-uw="focus" data-i="' + i + '" placeholder="What this week is about">' + esc(w.focus) + '</textarea></label>' +
      '<label class="pl-fl">Standards<input class="btn sm" data-uw="standards" data-i="' + i + '" placeholder="Like RL.1, RL.4" value="' + esc(w.standards) + '"></label>' +
      '<label class="pl-fl">My notes<textarea rows="2" data-uw="notes" data-i="' + i + '" placeholder="Ideas, reminders, what to bring">' + esc(w.notes) + '</textarea></label>' +
      '<div class="pl-wl">' + (cls.length ? ms.map(x => {
        const ls = lessonsAt(x.c.id, x.date);
        return '<div class="ls-slot" style="--cc:' + esc(x.c.color || '#1F6FB2') + '"><div class="ls-sh"><b>' + esc(x.c.name) + ' · ' + shortDate(x.date) + '</b><span>' + hm(x.m.start) + '–' + hm(x.m.end) + '</span></div>' +
          ls.map(l => '<button class="ls-card" data-open="' + l.id + '"><b>' + esc(l.title) + '</b><span>' + l.slides.length + ' slides</span></button>').join('') +
          (ls.length ? '' : '<button class="btn sm ghost" data-new="' + esc(x.c.id) + '|' + x.date + '">+ New lesson</button>') + '</div>';
      }).join('') || '<span class="muted">No classes this week</span>' : '') + '</div></div>';
  });
  h += '</div></section>';
  // files
  h += '<section class="pl-card"><div class="lhead"><h2>Summative and unit files</h2><span class="sp"></span><button class="btn sm" data-a="addfile">Add files…</button></div>' +
    '<div class="pl-drop" id="plFileDrop">' + (other.length ? '<div class="pl-files">' + other.map(f => '<div class="pl-file"><span class="pl-ft">' + esc((f.name.split('.').pop() || '').slice(0, 4).toUpperCase()) + '</span><div class="pl-fn"><b>' + esc(f.name) + '</b><span>' + (f.kind === 'summative' ? 'Summative' : 'Unit file') + ' · ' + kb(f.size) + '</span></div>' +
      '<select class="btn sm" data-fkind="' + f.id + '" aria-label="Kind"><option value="summative"' + (f.kind === 'summative' ? ' selected' : '') + '>Summative</option><option value="other"' + (f.kind === 'other' ? ' selected' : '') + '>Unit file</option></select>' +
      '<button class="btn sm" data-a="viewfile" data-fid="' + f.id + '">Open</button><button class="btn sm ghost" data-a="dlfile" data-fid="' + f.id + '">Download</button><button class="btn sm ghost" data-a="rmfile" data-fid="' + f.id + '">Remove</button></div>').join('') + '</div>' : '') +
    '<p class="muted">Drop task sheets, rubrics or exemplars here. Planning files only: never student work. They go to the Planner folder, where Claude can read them.</p></div></section>';
  h += bankUnitSection(u);
  h += '</div><input type="file" id="plFileIn" multiple hidden><input type="file" id="plShotIn" accept="image/*" multiple hidden>';
  $('#lessons').innerHTML = h;
  for (const im of document.querySelectorAll('[data-fimg]')) fileBlob(im.dataset.fimg).then(b => { if (b) { im.src = URL.createObjectURL(b); im.onload = () => URL.revokeObjectURL(im.src); } });
}
const kb = n => n > 1e6 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
function openUnit(u, back) { if (!u) return; L.unitBack = back || (L.view === 'unit' ? L.unitBack : L.view); L.unit = u; L.view = 'unit'; renderUnit(); window.scrollTo(0, 0); }
async function newUnit(course, start) {
  const cs = courses();
  const u = normUnit({ course: course || (cs[0] && cs[0].course) || '', start: start || L.weekOf || ymd(mondayOf(new Date())), title: 'New unit', weeks: Array.from({ length: 6 }, () => ({})) });
  await unitPut(u, true); openUnit(u);
  const t = document.querySelector('[data-uf="title"]'); if (t) { t.focus(); t.select(); }
}

/* ---------- files and screenshots ---------- */
function uniqueName(u, name) {
  name = String(name || 'file').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'file';
  if (!u.files.some(f => f.name === name)) return name;
  const m = /^(.*?)(\.[^.]*)?$/.exec(name); let i = 2;
  while (u.files.some(f => f.name === m[1] + ' (' + i + ')' + (m[2] || ''))) i++;
  return m[1] + ' (' + i + ')' + (m[2] || '');
}
async function addUnitFiles(u, files, kind) {
  let n = 0;
  for (const f of files) {
    if (f.size > MAX_FILE) { toast(f.name + ' is too big (over 40 MB)'); continue; }
    const k = kind || (/summative|task|rubric/i.test(f.name) ? 'summative' : 'other');
    const pasted = !f.name || f.name === 'image.png';   // a pasted screenshot has no real name
    const id = lid(), name = uniqueName(u, pasted ? (k === 'atlas' ? 'Atlas ' + (u.files.filter(x => x.kind === 'atlas').length + 1) : 'Picture') + '.png' : f.name);
    await kvSet('file:' + id, f);
    u.files.push({ id, name, kind: k, type: f.type || '', size: f.size, added: Date.now() }); n++;
  }
  if (n) { await unitPut(u); if (L.view === 'unit' && L.unit === u) renderUnit(); toast(n === 1 ? 'Added' : 'Added ' + n + ' files'); }
}
async function viewFile(u, id) {
  const f = u.files.find(x => x.id === id), b = await fileBlob(id); if (!f || !b) return toast('That file is missing');
  if (/^image\//.test(b.type || f.type)) {
    const url = URL.createObjectURL(b);
    openDlg('<div class="bh"><h2>' + esc(f.name) + '</h2></div><div class="bb pl-big"><img src="' + url + '" alt=""></div><div class="bf"><button class="btn" data-x>Close</button></div>');
    $('#dlgBox').onclick = e => { if (e.target.closest('[data-x]')) { URL.revokeObjectURL(url); closeDlg(); } };
    return;
  }
  if (/pdf/.test(b.type || f.type) || /\.pdf$/i.test(f.name)) { const url = URL.createObjectURL(new Blob([b], { type: 'application/pdf' })); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 120000); return; }
  saveBlob(f.name, b);   // Word files and the rest open in their own app
}
function askWeeks(u) {
  const where = L.dir && L.dirOk ? 'In my Planner folder ("' + L.dir.name + '"), the unit file is Units/' + unitBase(u) + '.unit.json and its Atlas screenshots are in Units/' + unitBase(u) + ' files/. ' : '';
  const msg = 'Please fill in the weeks of my ' + u.course + ' unit "' + u.title + '" from its Atlas screenshots. ' + where +
    'It starts the week of ' + shortDate(u.start) + ' and has ' + u.weeks.length + ' weeks. Read the screenshots and write each week\'s focus (and standards, if shown) into "weeks" in the unit file, one entry per week, in order. Keep my notes. Then tell me what you filled in and anything you weren\'t sure of.' +
    (where ? '' : '\n\n(My Planner folder isn\'t linked yet, so I\'ll attach the screenshots.)');
  copyText(msg).then(() => { toast(where ? 'Message copied. Paste it into Claude.' : 'Message copied. Link the Planner folder so Claude can read the screenshots, or attach them.', 6000); });
}
function pasteWeeksDlg(u) {
  openDlg('<div class="bh"><h2>Weeks of ' + esc(u.title) + '</h2></div><div class="bb"><p class="muted" style="margin-top:0">One line per week: what that week is about. You can copy the week list straight out of Atlas. Lines starting with “Week 3:” or similar are fine.</p>' +
    '<textarea id="pwT" rows="12" style="width:100%">' + esc(u.weeks.map(w => w.focus).join('\n')) + '</textarea></div><div class="bf"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Use these weeks</button></div>');
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    if (!e.target.closest('[data-ok]')) return;
    const lines = $('#pwT').value.split('\n').map(x => x.trim()).filter(Boolean).map(x => x.replace(/^(week|wk)\s*\d+\s*[:.\-–)]\s*/i, ''));
    if (!lines.length) return closeDlg();
    u.weeks = lines.map((f, i) => ({ focus: f, notes: (u.weeks[i] || {}).notes || '', standards: (u.weeks[i] || {}).standards || '' }));
    closeDlg(); await unitPut(u); renderUnit();
  };
}

/* ---------- events (return true when handled here) ---------- */
let uSaveT;
function unitChangedSoon() { const e = $('#plSaved'); if (e) e.textContent = 'Saving…'; clearTimeout(uSaveT); uSaveT = setTimeout(() => unitPut(L.unit), 450); }
async function unitsClick(e) {
  const t = e.target.closest('[data-a]'); if (!t) return false;
  const a = t.dataset.a, u = L.unit;
  if (a === 'tab') { editorCommit(); L.view = t.dataset.v; L.open = null; renderLessons(); window.scrollTo(0, 0); return true; }
  if (a === 'gowk') { L.weekOf = t.dataset.wk; L.view = 'week'; renderLessons(); window.scrollTo(0, 0); return true; }
  if (a === 'newunit') { await newUnit(t.dataset.course, t.dataset.start); return true; }
  if (a === 'openunit') { openUnit(L.units.find(x => x.id === t.dataset.u)); return true; }
  if (L.view !== 'unit' || !u) return false;
  if (a === 'uback') { clearTimeout(uSaveT); await unitPut(u, true); L.unit = null; L.view = L.unitBack || 'units'; renderLessons(); return true; }
  if (a === 'wkplus') { u.weeks.push({ focus: '', notes: '', standards: '' }); await unitPut(u); renderUnit(); return true; }
  if (a === 'wkminus') {
    if (u.weeks.length <= 1) return true;
    const last = u.weeks[u.weeks.length - 1];
    if ((last.focus || last.notes || last.standards) && t.dataset.sure !== '1') { t.dataset.sure = '1'; toast('The last week has writing in it. Click − again to remove it.'); return true; }
    u.weeks.pop(); await unitPut(u); renderUnit(); return true;
  }
  if (a === 'addshot') { const i = $('#plShotIn'); i.onchange = () => { const fs = [...i.files]; i.value = ''; addUnitFiles(u, fs, 'atlas'); }; i.click(); return true; }
  if (a === 'addfile') { const i = $('#plFileIn'); i.onchange = () => { const fs = [...i.files]; i.value = ''; addUnitFiles(u, fs, null); }; i.click(); return true; }
  if (a === 'viewfile') { await viewFile(u, t.dataset.fid); return true; }
  if (a === 'dlfile') { const f = u.files.find(x => x.id === t.dataset.fid), b = await fileBlob(t.dataset.fid); if (f && b) saveBlob(f.name, b); return true; }
  if (a === 'rmfile') {
    if (t.dataset.sure !== '1') { t.dataset.sure = '1'; t.textContent = 'Click again to remove'; return true; }
    const f = u.files.find(x => x.id === t.dataset.fid); u.files = u.files.filter(x => x.id !== t.dataset.fid);
    await lTx('kv', 'readwrite', s => { s.delete('file:' + t.dataset.fid); });
    if (f && L.dir && L.dirOk && u._file) { try { const d = await (await L.dir.getDirectoryHandle('Units')).getDirectoryHandle(unitBase(u) + ' files'); await d.removeEntry(f.name); } catch { } }
    await unitPut(u); renderUnit(); return true;
  }
  if (a === 'askweeks') { askWeeks(u); return true; }
  if (a === 'pasteweeks') { pasteWeeksDlg(u); return true; }
  if (a === 'udel') {
    if (t.dataset.sure !== '1') { t.dataset.sure = '1'; t.textContent = 'Click again to delete the unit and its files'; return true; }
    await unitDelete(u); L.unit = null; L.view = L.unitBack === 'unit' ? 'units' : (L.unitBack || 'units'); renderLessons(); toast('Unit deleted. Its lessons are still here.'); return true;
  }
  return false;
}
function unitsInput(e) {
  if (L.view !== 'unit' || !L.unit) return false;
  const t = e.target, u = L.unit;
  if (t.dataset.uf === 'title') { u.title = t.value; unitChangedSoon(); return true; }
  if (t.dataset.uf === 'atlas') { u.atlas = /^https?:\/\//.test(t.value.trim()) ? t.value.trim() : ''; unitChangedSoon(); return true; }
  if (t.dataset.uw) { u.weeks[+t.dataset.i][t.dataset.uw] = t.value; unitChangedSoon(); return true; }
  return false;
}
function unitsChange(e) {
  if (L.view !== 'unit' || !L.unit) return false;
  const t = e.target, u = L.unit;
  if (t.dataset.uf === 'course' || t.dataset.uf === 'start') { u[t.dataset.uf] = t.value; unitPut(u).then(renderUnit); return true; }
  if (t.dataset.uf === 'atlas') { renderUnit(); return true; }
  if (t.dataset.fkind) { const f = u.files.find(x => x.id === t.dataset.fkind); if (f) { f.kind = t.value; unitPut(u).then(renderUnit); } return true; }
  return !!(t.dataset.uf || t.dataset.uw);
}
async function unitsDrop(e) {
  if (L.view !== 'unit' || !L.unit) return false;
  const fs = [...((e.dataTransfer && e.dataTransfer.files) || [])]; if (!fs.length) return true;
  const shot = e.target.closest && e.target.closest('#plShotDrop');
  await addUnitFiles(L.unit, fs, shot ? 'atlas' : null);
  return true;
}
// A screenshot on the clipboard goes straight in as an Atlas picture.
document.addEventListener('paste', e => {
  if (L.view !== 'unit' || !L.unit) return;
  if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  const fs = [...((e.clipboardData && e.clipboardData.files) || [])].filter(f => /^image\//.test(f.type));
  if (!fs.length) return;
  e.preventDefault(); addUnitFiles(L.unit, fs, 'atlas');
});

/* ---------- the Planner folder: Units/<course> - <title>.unit.json, files next to it ---------- */
const unitBase = u => ((u.course ? u.course + ' - ' : '') + (u.title || 'Unit')).replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 90);
const uTimers = new Map();
function unitWriteSoon(u) { if (!L.dir || !L.dirOk) return; clearTimeout(uTimers.get(u.id)); uTimers.set(u.id, setTimeout(() => unitFolderWrite(u).catch(e => console.warn(e)), 800)); }
function unitForFile(u) { const { _file, _mod, ...c } = u; c.files = u.files.map(({ name, kind, type, size }) => ({ name, kind, type, size })); return c; }
async function unitFolderWrite(u) {
  if (!L.dir || !L.dirOk) return;
  const dir = await L.dir.getDirectoryHandle('Units', { create: true }), name = unitBase(u) + '.unit.json';
  if (u._file && u._file !== name) {   // renamed: move its files folder too
    try { await dir.removeEntry(u._file); } catch { }
    try { await dir.removeEntry(u._file.replace(/\.unit\.json$/, ' files'), { recursive: true }); } catch { }
  }
  if (u.files.length) {
    const fd = await dir.getDirectoryHandle(unitBase(u) + ' files', { create: true });
    for (const f of u.files) {
      let have = null; try { have = await (await fd.getFileHandle(f.name)).getFile(); } catch { }
      if (have && have.size === f.size) continue;
      const b = await fileBlob(f.id); if (b) await writeFile(fd, f.name, b);
    }
  }
  u._mod = await writeFile(dir, name, JSON.stringify(unitForFile(u), null, 2)); u._file = name;
  await unitsSave();
}
// Picks up units Claude changed in the folder: the weeks, title, start and Atlas link. Files stay as the app has them.
async function unitsFolderRead() {
  const out = { added: 0, changed: 0 };
  if (!L.dir || !L.dirOk) return out;
  let dir; try { dir = await L.dir.getDirectoryHandle('Units'); } catch { return out; }
  for await (const [name, h] of dir.entries()) {
    if (h.kind !== 'file' || !/\.unit\.json$/i.test(name)) continue;
    const f = await h.getFile(), mine = L.units.find(u => u._file === name);
    if (mine && mine._mod && f.lastModified <= mine._mod + 1500) continue;
    let j; try { j = JSON.parse(await f.text()); } catch { continue; }
    const old = L.units.find(u => u.id === j.id) || mine;
    if (old && old._file && old._file !== name) continue;
    const n = normUnit({ ...j, id: old ? old.id : j.id });
    if (old) { n.files = old.files; n.color = n.color || old.color; }
    else n.files = [];   // files only come in through the app
    n._file = name; n._mod = f.lastModified;
    const i = L.units.findIndex(u => u.id === n.id); if (i >= 0) L.units[i] = n; else L.units.push(n);
    if (L.unit && L.unit.id === n.id) L.unit = n;
    old ? out.changed++ : out.added++;
    if (!j.id) await unitFolderWrite(n);
  }
  if (out.added || out.changed) await unitsSave();
  return out;
}

window.__planner = { bankPut, normRubric, slideHtml, LOOKS, TEACH, TEACH_SAMPLE, versions: versionsOf, ytIds: us => us.map(u => [ytId(u), ytStart(u)]), openLessonForTest: (l, i) => { openLesson(l); goSlide(i || 0); }, L, applySetup, renderLessons, setPicture, folderWriteAll, folderRead, buildPptx, normLesson, normUnit, unitPut, unitAt, addUnitFiles, notGradingFolder, unitsFolderRead, semesterMondays };
openLessons();
