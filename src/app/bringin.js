/* ---------------- other files: kept with the student, downloadable, returned in the export if you added them ---------------- */
function textCard(f) {
  const el = document.createElement('div'); el.className = 'docx'; el.wordF = f;
  const t = textOf(f);
  el.innerHTML = '<div class="fhead"><span style="color:var(--fg)">' + esc(f.name) + '</span><span>Text</span>' + (f.added ? addTag(f) : '') + '<span style="flex:1"></span><button class="btn sm ghost" data-odl>Download</button></div><div class="dpage" style="white-space:pre-wrap"></div>';
  el.querySelector('.dpage').textContent = t;
  el.querySelector('[data-odl]').onclick = () => saveBlob(f.name, new Blob([f.data]));
  return el;
}
function otherCard(f) {
  const el = document.createElement('div'); el.className = 'nofile'; el.style.marginBottom = '12px'; el.style.maxWidth = '640px';
  const why = (troubleText(troubleOf(f)) || 'This kind of file can’t be shown here. Download to open it.') + (f.hurt && photoHasWork(f) ? ' Your marks on it are still saved.' : '');
  el.innerHTML = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b>' + esc(f.name) + '</b>' + (f.added ? addTag(f) : '') + carryTag(f) + '<span style="flex:1"></span>' + (f.data ? '<button class="btn sm" data-odl>Download</button>' : '') + '</div><div style="margin-top:6px">' + why + ' You can still give a score.' + (f.added ? ' It goes back with the export because you added it.' : '') + '</div>';
  const b = el.querySelector('[data-odl]'); if (b) b.onclick = () => saveBlob(f.name, new Blob([f.data]));
  return el;
}

/* ---------------- bringing in many files at once: each one sorted to its student by name ---------------- */
const SORT_STOP = new Set(['pdf', 'docx', 'docm', 'doc', 'rubric', 'final', 'draft', 'copy', 'marked', 'graded', 'feedback', 'interview', 'summative', 'formative', 'assignment', 'the', 'and', 'of', 'for', 'version', 'v', 'el', 'grade', 'resume', 'cover', 'letter', 'essay', 'paragraph', 'analysis', 'notes', 'comments', 'scan', 'img', 'image', 'page']);
function sortGuess(path) {
  const c = batchClass(), extra = new Map();
  if (c) for (const [n, s] of rosterMatch(c.names)) extra.set(s, nameWords(n));
  return guessAmong(path, batch.students.map(st => [nameWords(st.key), extra.get(st) || []]));
}
async function bringIn(list) {
  list = list.filter(e => e.file && !junk(e.path) && !houseFile(e.path));
  if (!list.length) return;
  const { fresh: rows, dups } = await freshRows(list.map(e => ({ e, ...sortGuess(e.path) })));
  if (!rows.length) return toast('Those files are already here, so there’s nothing new to add');
  const opts = i => '<option value="-1"' + (i < 0 ? ' selected' : '') + '>Choose a student…</option>' + (anonOn() ? anonOrder() : batch.students.map((_, k) => k)).map(k => '<option value="' + k + '"' + (k === i ? ' selected' : '') + '>' + (anonOn() ? '' : (k + 1) + '. ') + esc(shownName(batch.students[k], k)) + '</option>').join('') + '<option value="-3">New student…</option><option value="-2">Skip this file</option>';
  const count = () => rows.filter(r => r.i >= 0 || r.newKey).length;
  openDlg('<div class="bh"><h2>Bring in files</h2><span class="muted">' + rows.length + (rows.length === 1 ? ' file' : ' files') + ', sorted by the names in the file names</span><button class="icon" data-close aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb"><p class="muted" style="margin:0 0 10px;font-size:14px">Each file goes into that student’s submission in this download, tagged “Added by you”. Check the ones marked “Check” or “Choose”. Tick <b>Late</b> beside anyone you want marked late; nothing is taken off.' + (dups ? ' ' + dups + (dups === 1 ? ' file is' : ' files are') + ' already here, so ' + (dups === 1 ? 'it’s' : 'they’re') + ' left out.' : '') + '</p>' +
    '<table class="gl"><thead><tr><th>File</th><th>Goes to</th><th></th><th><label style="white-space:nowrap"><input type="checkbox" data-lateall aria-label="Mark all late"> Late</label></th></tr></thead><tbody>' +
    rows.map((r, k) => '<tr><td style="overflow-wrap:anywhere">' + esc(r.e.path) + '</td><td><select class="btn" data-row="' + k + '" style="max-width:280px">' + opts(r.i) + '</select></td><td data-tag="' + k + '">' + sortTag(r) + rowNote(r) + '</td><td><input type="checkbox" data-late="' + k + '" aria-label="Mark late"></td></tr>').join('') +
    '</tbody></table></div><div class="bf"><button class="btn" data-close>Cancel</button><button class="btn primary" data-go>Add ' + count() + (count() === 1 ? ' file' : ' files') + '</button></div>');
  const box = $('#dlgBox');
  box.onchange = async e => {
    if (e.target.closest('[data-lateall]')) { for (const c of box.querySelectorAll('[data-late]')) { c.checked = e.target.checked; rows[+c.dataset.late].late = c.checked; } return; }
    const l = e.target.closest('[data-late]'); if (l) { rows[+l.dataset.late].late = l.checked; return; }
    const s = e.target.closest('[data-row]'); if (!s) return; const r = rows[+s.dataset.row];
    r.newKey = '';
    if (s.value === '-3') {   // someone who isn't in this download yet
      const nk = (await askTextDlg('The new student’s name', guessNewName(r.e.path)) || '').replace(/[\\/]+/g, ' ').trim();
      if (!nk) { s.value = String(r.i); return; }
      r.newKey = nk;
    }
    r.i = +s.value; r.sure = true; r.set = true; box.querySelector('[data-tag="' + s.dataset.row + '"]').innerHTML = (r.newKey ? '' : sortTag(r)) + rowNote(r); const n = count(); box.querySelector('[data-go]').textContent = 'Add ' + n + (n === 1 ? ' file' : ' files');
  };
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (!e.target.closest('[data-go]')) return;
    if (!count()) return toast('Choose a student for at least one file');
    const groups = new Map(), late = new Set(), keep = batch.students[cur], t0 = Date.now();
    let made = false;
    for (const r of rows) {
      let st = r.i >= 0 ? batch.students[r.i] : null;
      if (r.newKey) { st = batch.students.find(x => x.key === r.newKey); if (!st) { st = { key: r.newKey, files: [], grade: { rubric: [], points: '', comment: '' }, layout: null, inc: {} }; batch.students.push(st); made = true; } }
      if (!st) continue;
      if (!groups.has(st)) groups.set(st, []);
      groups.get(st).push(r.e);
      if (r.late) late.add(st);
    }
    closeDlg();
    let last = keep;
    for (const [st, fl] of groups) { await addFiles(st, fl, true); last = st; }
    late.forEach(markLate);
    if (made) { rosterSort(); cur = Math.max(0, batch.students.indexOf(keep)); setBatchName(); saveNow(); }
    renderList(); openStudent(batch.students.indexOf(groups.has(keep) ? keep : last));
    bringInDone([...groups.keys()], t0, late.size);
  };
}
const sortTag = r => r.i === -2 ? '<span class="muted">Skipped</span>' : r.i < 0 ? '<span class="pill" style="font-size:12px;padding:2px 8px;border-radius:999px;background:var(--warn-soft);color:var(--warn)">Choose</span>'
  : r.set ? '<span class="muted">Chosen by you</span>' : r.sure ? '<span style="color:var(--ok);font-size:13px;font-weight:600">Matched by name</span>' : '<span class="pill" style="font-size:12px;padding:2px 8px;border-radius:999px;background:var(--warn-soft);color:var(--warn)">Check</span>';

/* ---------------- folder import: many files (a folder, a ZIP), each matched to a student by the name in its file or folder name ---------------- */
// Picked files as [{ path, file }], keeping folder names (they often hold the student's name) and opening ZIPs.
async function expandPicked(files) {
  const out = [];
  for (const f of files) {
    const path = f.webkitRelativePath || f.name;
    if (junk(path)) continue;
    if (/\.zip$/i.test(f.name)) {
      const raw = [];
      zipSkipped = 0;
      try { unzipInto(new Uint8Array(await f.arrayBuffer()), '', raw, 0); } catch { toast(zipSay({ names: [f.name] }), 9000); continue; }
      if (zipSkipped) toast(zipSay({ skip: zipSkipped }), 9000);
      for (const r of raw) if (r.data && !junk(r.path)) out.push({ path: f.name.replace(/\.zip$/i, '') + '/' + r.path, file: new File([r.data], r.path.split('/').pop()) });
      continue;
    }
    out.push({ path, file: f });
  }
  return out;
}
// The Mac app chooses folders through macOS itself; files come back with their folder path, like the web picker's.
async function nativeFolder() {
  const p = await window.gsNative.pickFolder(); if (!p) return null;
  toast('Opening ' + p.name + '…');
  const r = await window.gsNative.readFolder(); if (!r) return null;
  if (r.error) { toast(r.error === 'perm' ? 'macOS didn’t let Grading Studio open that folder. Allow it in System Settings → Privacy & Security → Files and Folders.' : 'Couldn’t open that folder: ' + r.error, 8000); return null; }
  if (!r.files.length) { toast('No files found in ' + r.name, 6000); return null; }
  return r.files.map(f => { const file = new File([f.data], f.rel.split('/').pop(), { lastModified: f.mtime }); Object.defineProperty(file, 'webkitRelativePath', { value: r.name + '/' + f.rel }); return file; });
}
// A folder for one of the folder inputs: the web picker, or macOS's own in the Mac app.
function pickDir(sel) {
  if (!window.gsNative) return $(sel).click();
  nativeFolder().then(fs => { if (fs) $(sel).onchange({ target: { files: fs, value: '' } }); }, e => toast('Couldn’t open that folder: ' + (e.message || e), 8000));
}
function pickMany(folder) {
  if (folder && window.gsNative) return nativeFolder().then(fs => fs ? expandPicked(fs) : new Promise(() => {}), e => { toast('Couldn’t open that folder: ' + (e.message || e), 8000); return new Promise(() => {}); });
  return new Promise(res => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true;
    if (folder) inp.webkitdirectory = true;
    inp.onchange = async () => res(await expandPicked([...inp.files]));
    inp.click();
  });
}
// Files or folder? Then hands the files on.
function askFilesOrFolder(title, text, then, lg) {
  openDlg('<div class="bh"><h2>' + esc(title) + '</h2><button class="icon" data-cancel aria-label="Close">✕</button></div><div class="bb"><p style="margin:0">' + text + '</p></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn" data-pf>Files or a ZIP…</button><button class="btn primary" data-pd>A whole folder…</button></div>', true, lg);
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    const pf = e.target.closest('[data-pf]'), pd = e.target.closest('[data-pd]');
    if (!pf && !pd) return;
    closeDlg();
    const list = await pickMany(!!pd);
    if (!list.length) return toast('No files found there');
    then(list);
  };
}
// Best match among people, each given as one or more lists of name words. Same scoring as Bring in files.
function guessAmong(path, people) {
  const fw = new Set(nameWords(path.replace(/\.[^./]+$/, '')).filter(x => !SORT_STOP.has(x)));
  let best = [], bestScore = 0;
  people.forEach((lists, i) => {
    let sc = 0;
    for (const ws0 of lists) {
      const ws = ws0.filter(x => x.length >= 2 || /[^\x00-\x7f]/.test(x) || /^\d+$/.test(x)); if (!ws.length) continue;
      const hit = ws.filter(x => fw.has(x)).length;
      sc = Math.max(sc, hit === ws.length && hit >= 2 ? 100 + hit : hit);
      if (ws.some(x => /^\d{4,}$/.test(x) && fw.has(x))) sc = Math.max(sc, 150);   // a student ID number in the file name
    }
    if (sc > bestScore) { bestScore = sc; best = [i]; } else if (sc === bestScore && sc > 0) best.push(i);
  });
  if (best.length !== 1 || !bestScore) return { i: -1, sure: false };
  return { i: best[0], sure: bestScore >= 2 };
}
// Outside files with no ManageBac download: match them to a roster and open them as a new download.
function matchToRoster(list, assignment) {
  let c = assignment && assignment.classId ? classById(assignment.classId) : (lib.classes.find(k => k.names.length) || null);
  let rows = [];
  const guess = () => { const names = c ? c.names : []; rows = list.map(e => ({ e, ...guessAmong(e.path, names.map(n => [nameWords(n)])) })); };
  guess();
  const render = () => {
    const names = c ? c.names : [];
    const opts = i => '<option value="-1"' + (i < 0 ? ' selected' : '') + '>Choose a student…</option>' + names.map((n, k) => '<option value="' + k + '"' + (k === i ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '<option value="-2"' + (i === -2 ? ' selected' : '') + '>Skip this file</option>';
    const n = rows.filter(r => r.i >= 0).length, who = new Set(rows.filter(r => r.i >= 0).map(r => r.i)).size;
    const missing = names.filter((_, k) => !rows.some(r => r.i === k));
    openDlg('<div class="bh"><h2>Match files to students</h2><span class="muted">' + list.length + (list.length === 1 ? ' file' : ' files') + '</span><button class="icon" data-close aria-label="Close" style="margin-left:auto">✕</button></div>' +
      '<div class="bb"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><label style="display:flex;gap:6px;align-items:center;font-weight:500">Class <select class="btn" id="mrCls">' +
        lib.classes.map(k => '<option value="' + k.id + '"' + (c && c.id === k.id ? ' selected' : '') + '>' + esc(k.name) + ' (' + k.names.length + ')</option>').join('') + '</select></label>' +
        '<span class="muted" style="font-size:13px">Matched by the names in the file and folder names. Check the ones marked “Check” or “Choose”.</span></div>' +
      (names.length ? '<table class="gl"><thead><tr><th>File</th><th>Student</th><th></th></tr></thead><tbody>' +
        rows.map((r, k) => '<tr><td style="overflow-wrap:anywhere">' + esc(r.e.path) + '</td><td><select class="btn" data-row="' + k + '" style="max-width:280px">' + opts(r.i) + '</select></td><td>' + sortTag(r) + '</td></tr>').join('') + '</tbody></table>'
        : '<p>Add a roster for this class first (on the class’s own page, from the sidebar), then try again.</p>') +
      (missing.length && names.length ? '<p class="muted" style="font-size:13px;margin:10px 0 0">No file yet: ' + esc(missing.join(', ')) + '</p>' : '') + '</div>' +
      '<div class="bf"><button class="btn" data-close>Cancel</button><button class="btn primary" data-go' + (n ? '' : ' disabled') + '>Open ' + n + (n === 1 ? ' file' : ' files') + ' for ' + who + (who === 1 ? ' student' : ' students') + '</button></div>');
    box.onchange = changed; box.onclick = clicked;   // openDlg takes the handlers off, so each redraw puts them back
  };
  const box = $('#dlgBox');
  const changed = e => {
    if (e.target.id === 'mrCls') { c = classById(e.target.value); guess(); return render(); }
    const s = e.target.closest('[data-row]'); if (!s) return;
    Object.assign(rows[+s.dataset.row], { i: +s.value, sure: true, set: true }); render();
  };
  const clicked = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (!e.target.closest('[data-go]')) return;
    const used = new Set(), entries = [];
    for (const r of rows) if (r.i >= 0) {
      const base = c.names[r.i].replace(/[\\/:*?"<>|]+/g, ' ').trim() + '/' + r.e.path.split('/').pop();
      let p = base, k = 2; while (used.has(p.toLowerCase())) p = base.replace(/(\.[^./]+)?$/, ' (' + k++ + ')$1');
      used.add(p.toLowerCase()); entries.push({ path: p, file: r.e.file });
    }
    closeDlg();
    await intake(entries, (assignment && assignment.name) || 'Matched files', assignment || null);
    if (batch) { batch.classId = c.id; renderClassSel(); saveNow(); renderList(); }
  };
  render();
}

