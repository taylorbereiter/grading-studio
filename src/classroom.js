/* ---------------- Google Classroom: bring a class over with two downloads, and no sign-in ----------------
   1. The grades file ("Download all grades as CSV" on any assignment's Student work page, or the Google Sheet saved as Excel):
      one row per student and one column per assignment. It gives the roster, each assignment with its points and date, and
      every score. The class is made here; the scores then go through the gradebook's own import (bookimport.js), so the teacher
      sees them before anything is saved.
   2. The assignment's folder from Google Drive (Classroom / the class / the assignment), downloaded as a ZIP and opened like any
      download. open.js puts files named "Student name - title" together under each student.
   Both files are read in this browser. Nothing is sent anywhere, and nothing is asked of Google. */

let gc = null;
// The class name a grades file is likely about: its file name without the ending, a date or the word "grades".
function gcNameOf(file) {
  return String(file || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').replace(/\s*\(\d+\)\s*$/, '')
    .replace(/\s*[-–]?\s*\d{4}-\d{1,2}-\d{1,2}.*$/, '').replace(/\s*[-–]?\s*\b(all\s+)?grades?\b\s*$/i, '').replace(/\s+/g, ' ').trim();
}
// What a grades file holds: the students in the file's order (with an email, if it has that column), and how many columns of scores.
function gcRead(rows) {
  const d = bkiRead(rows || []);
  if (!d || d.err || !d.students.length) return null;
  const head = rows[0] || [], ei = head.findIndex(h => /e-?mail/i.test(h)), seen = new Set(), students = [];
  for (const s of d.students) {
    const k = normName(s.name); if (!k || seen.has(k)) continue;
    seen.add(k);
    const email = ei >= 0 && EMAIL_RX.test(s.cells[ei] || '') ? s.cells[ei] : '';
    students.push({ name: s.name, email });
  }
  return { rows, students, cols: d.cols.length };
}
function gcOpen() {
  gc = { data: null, file: '' };
  openDlg('<div class="bh"><h2>Bring a class over from Google Classroom</h2><button class="icon" data-gcclose aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb gcbox"><p class="gcin">Two downloads bring a class over. Both are read in this browser: nothing is sent anywhere, and there is no sign-in.</p>' +
    '<section class="gccard"><span class="gcn" aria-hidden="true">1</span><div class="gcbody"><h3>Students, assignments and grades</h3>' +
      '<ol class="gcsteps"><li>In Google Classroom, open the class, then any assignment’s <b>Student work</b> page.</li><li>Click the gear at the top right and choose <b>Download all grades as CSV</b>.</li><li>Choose that file here.</li></ol>' +
      '<div class="gcrow"><button class="btn primary" data-gcfile>Choose the grades file…</button><span class="muted" id="gcSay">A CSV, or the grades sheet saved as Excel (.xlsx).</span><input type="file" id="gcFile" accept=".csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></div>' +
      '<p class="bkierr" id="gcErr" role="alert" hidden></p><div id="gcFound" hidden></div></div></section>' +
    '<section class="gccard"><span class="gcn" aria-hidden="true">2</span><div class="gcbody"><h3>Student work to mark</h3>' +
      '<ol class="gcsteps"><li>In Google Drive, open the <b>Classroom</b> folder, then the class, then the assignment’s folder.</li><li>Download the folder. Drive makes a ZIP, and Google Docs come as Word files.</li><li>Drop the ZIP on Today, or choose it here.</li></ol>' +
      '<div class="gcrow"><button class="btn" data-gczip>Choose the ZIP…</button></div>' +
      '<p class="muted gcnote">Files named “Student name - title” are put together under each student. A file a student uploaded under its own name opens as its own entry, for you to match.</p></div></section>' +
    '<p class="muted gcnote">Scores can’t be sent back into Google Classroom from here. The Grades tab of an assignment lists every score to copy across.</p></div>' +
    '<div class="bf"><button class="btn" data-gcclose>Close</button><button class="btn primary" data-gcgo disabled>Make the class</button></div>');
  $('#dlgBox').classList.add('gcdlg');
}
function gcErr(msg) { const e = $('#gcErr'); if (!e) return; e.hidden = !msg; e.textContent = msg || ''; }
async function gcTake(f) {
  if (!f || !gc) return;
  let rows = null;
  try {
    const buf = new Uint8Array(await f.arrayBuffer());
    if (buf[0] === 0xd0 && buf[1] === 0xcf) return gcErr('That is an old Excel file (.xls). Save it as .xlsx or CSV and choose that.');
    rows = buf[0] === 0x50 && buf[1] === 0x4b ? bkiXlsx(buf) : bkiParse(new TextDecoder().decode(buf));
  } catch (e) { console.error(e); return gcErr('That file couldn’t be read.'); }
  const d = gcRead(rows);
  if (!d) return gcErr('No students were found in that file. It needs one row per student, with their names in the first columns.');
  gcErr(''); gc.data = d; gc.file = f.name;
  // A class already here with the same name, or most of the same students, is the likely home for it.
  const guess = gcNameOf(f.name), keys = d.students.map(s => s.name);
  const hit = lib.classes.find(c => guess && normName(c.name) === normName(guess)) || lib.classes.find(c => c.names.length && rosterPairs(c.names, keys).size >= Math.max(2, keys.length / 2));
  gc.to = hit ? hit.id : ''; gc.name = guess;
  gcDraw();
}
// The students in the file who aren't on a class's roster yet.
function gcNew(c) { const d = gc.data, took = new Set(rosterPairs(c.names, d.students.map(s => s.name)).values()); return d.students.filter(s => !took.has(s.name)); }
function gcDraw() {
  const d = gc.data, box = $('#gcFound'); if (!d || !box) return;
  const c = gc.to ? classById(gc.to) : null, add = c ? gcNew(c) : d.students;
  $('#gcSay').textContent = gc.file;
  box.hidden = false;
  box.innerHTML = '<p class="gcsum">Found <b>' + people(d.students.length, 'student') + '</b>' + (d.cols ? ' and <b>' + people(d.cols, 'assignment') + '</b> with scores' : '. No columns of scores were found, so only the roster comes in') + '.</p>' +
    '<div class="gcfields"><label class="bkpf">Put them in<select class="btn sm" id="gcTo"><option value="">A new class</option>' + lib.classes.map(k => '<option value="' + esc(k.id) + '"' + (k === c ? ' selected' : '') + '>' + esc(k.name) + '</option>').join('') + '</select></label>' +
    (c ? '' : '<label class="bkpf">Class name<input type="text" class="bkin" id="gcName" value="' + esc(gc.name) + '" placeholder="e.g. Period 2 Biology"></label>') + '</div>' +
    '<p class="muted gcnote">' + (c ? (add.length ? people(add.length, 'student') + ' not on its roster yet will be added: ' + esc(add.map(s => s.name).join(', ')) + '.' : 'Everyone in the file is already on its roster.') : 'The roster is in the file’s order. You can reorder or rename it later on the class’s page.') +
    (d.cols ? ' Next you see every assignment and score, and nothing is saved in the gradebook until you press Import there.' : '') + '</p>';
  const go = $('[data-gcgo]'); go.disabled = false; go.textContent = c ? (d.cols ? 'Check the scores' : add.length ? 'Add ' + people(add.length, 'student') : 'Done') : d.cols ? 'Make the class and check the scores' : 'Make the class';
}
async function gcSave() {
  const d = gc.data; if (!d) return;
  let c = gc.to ? classById(gc.to) : null;
  if (!c) {
    const name = ($('#gcName').value || '').trim(); if (!name) { $('#gcName').focus(); return toast('Give the class a name'); }
    c = { id: uid(), name, names: [], units: [] }; lib.classes.push(c);
  }
  const was = c.names.slice(), add = gcNew(c);
  c.names = c.names.concat(add.map(s => s.name));
  // An email in the file is kept as that student's details, the same as one pasted with a roster.
  const pairs = rosterPairs(c.names, d.students.map(s => s.name)), by = new Map([...pairs].map(([n, k]) => [k, n]));
  keepInfo(c, was, d.students.filter(s => s.email && by.has(s.name)).map(s => ({ name: by.get(s.name), email: s.email })));
  saveLib(); closeDlg(); renderLib(); if (window.railRender) railRender();
  const rows = d.rows, cols = d.cols; gc = null;
  if (!batch) go(classHash(c));
  if (!cols) return toast((was.length ? 'Added ' + people(add.length, 'student') + ' to ' : 'Made ') + c.name);
  await openBook(c.id);
  if (!$('#bkBody')) return;
  bkImportView(); bkiTake(rows);
}
$('#dlgBox').addEventListener('click', e => {
  if (!gc || !$('#dlgBox').classList.contains('gcdlg')) return;
  if (e.target.closest('[data-gcclose]')) { gc = null; return closeDlg(); }
  if (e.target.closest('[data-gcfile]')) return $('#gcFile').click();
  if (e.target.closest('[data-gczip]')) { gc = null; closeDlg(); if (!batch) go('#/'); return $('#pickFiles').click(); }
  if (e.target.closest('[data-gcgo]')) return gcSave();
});
$('#dlgBox').addEventListener('change', e => {
  if (!gc || !$('#dlgBox').classList.contains('gcdlg')) return;
  const t = e.target;
  if (t.id === 'gcFile') { gcTake(t.files && t.files[0]); t.value = ''; return; }
  if (t.id === 'gcTo') { const n = $('#gcName'); if (n) gc.name = n.value; gc.to = t.value; return gcDraw(); }
});
Object.assign(window.__gs, { gcOpen, gcRead, gcNameOf });
