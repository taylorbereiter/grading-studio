/* ---------------- group work: one paper for several students, marked and graded once ---------------- */
// batch.groups: [{ k: [student keys], p: { key: path of that student's copy of the paper } }]
// Everyone in a group has the same score, comment and status, and the marks on their copies are one set: a mark made on any copy is on all of them.
// A student with no entry in p (their pages from a scan split don't line up with the others') shares the grade only.
// Each student still keeps their own copy of the file, so the export gives each of them the marked paper.
function groupOf(st) { return (st && batch && (batch.groups || []).find(g => g.k.includes(st.key))) || null; }
function groupMates(st) { const g = groupOf(st); return g ? g.k.filter(k => k !== st.key).map(k => batch.students.find(s => s.key === k)).filter(Boolean) : []; }
function groupNames(list) { return wordsJoin(list.map(s => shownName(s, batch.students.indexOf(s)))); }
function groupFileOf(g, st) { const p = g.p && g.p[st.key]; return p ? st.files.find(f => f.path === p) || null : null; }

// The grade fields a group shares. Answers about what's written on each paper (reads) stay each student's own.
const GROUP_SKIP = new Set(['reads']);
function groupGradeCopy(to, from) {
  const a = to.grade, b = from.grade;
  for (const k of Object.keys(a)) if (!GROUP_SKIP.has(k) && !(k in b)) delete a[k];
  for (const [k, v] of Object.entries(b)) if (!GROUP_SKIP.has(k)) a[k] = v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
  if (!a.rubric) a.rubric = [];
}
const gradeSig = g => JSON.stringify(Object.fromEntries(Object.entries(g).filter(([k]) => !GROUP_SKIP.has(k)).sort()));

// Marks on two copies become one set, with nothing lost: each page keeps every mark either copy had.
function groupMergeMarks(into, from) {
  for (const [p, list] of Object.entries(from || {})) {
    const have = new Set((into[p] ||= []).map(m => JSON.stringify(m)));
    for (const m of list) if (!have.has(JSON.stringify(m))) into[p].push(m);
  }
}

// Keeps every group in step: called on each save. The newest grade in a group goes to the others, and the copies share one set of marks (and turns, so the marks sit right).
function groupSync() {
  if (!batch || !batch.groups || !batch.groups.length) return false;
  let changed = false;
  batch.groups = batch.groups.filter(g => g.k.filter(k => batch.students.some(s => s.key === k)).length > 1);
  for (const g of batch.groups) {
    const sts = g.k.map(k => batch.students.find(s => s.key === k)).filter(Boolean);
    const src = sts.reduce((a, s) => ((s.grade.at || 0) > (a.grade.at || 0) ? s : a), sts[0]), sig = gradeSig(src.grade);
    for (const s of sts) if (s !== src && gradeSig(s.grade) !== sig) { groupGradeCopy(s, src); changed = true; }
    const files = sts.map(s => groupFileOf(g, s)).filter(Boolean);
    if (files.length < 2) continue;
    const base = files[0];
    for (const f of files.slice(1)) {
      if (f.marks !== base.marks) { groupMergeMarks(base.marks, f.marks); f.marks = base.marks; changed = true; }
      for (const k of ['rot', 'skew']) if (base[k] || f[k]) { if (!base[k]) base[k] = f[k] || {}; if (f[k] !== base[k]) { f[k] = base[k]; changed = true; } }
    }
  }
  return changed;
}

// st's copy of the paper and the student joining: they share st's grade from now on, unless st has none yet and they do.
function groupAdd(st, f, to, toFile) {
  batch.groups ||= [];
  let g = groupOf(st);
  if (!g) { g = { k: [st.key], p: { [st.key]: f.path } }; batch.groups.push(g); }
  if (!g.p[st.key]) g.p[st.key] = f.path;
  const old = groupOf(to); if (old && old !== g) groupLeave(to, true);
  if (!g.k.includes(to.key)) g.k.push(to.key);
  if (toFile) g.p[to.key] = toFile.path; else delete g.p[to.key];
  if (gradeHasWork(st.grade) || !gradeHasWork(to.grade)) { groupGradeCopy(to, st); if (!st.grade.at) touchGrade(st); to.grade.at = st.grade.at; }
  else { groupGradeCopy(st, to); }
  groupSync();
}
// One student goes back to their own grade and their own copy of the marks so far.
function groupLeave(st, quiet) {
  const g = groupOf(st); if (!g) return;
  const f = groupFileOf(g, st);
  if (f) { f.marks = JSON.parse(JSON.stringify(f.marks || {})); for (const k of ['rot', 'skew']) if (f[k]) f[k] = { ...f[k] }; }
  g.k = g.k.filter(k => k !== st.key); delete g.p[st.key];
  if (g.k.length < 2) { batch.groups = batch.groups.filter(x => x !== g); const last = g.k[0] && batch.students.find(s => s.key === g.k[0]), lf = last && groupFileOf(g, last); if (lf) lf.marks = JSON.parse(JSON.stringify(lf.marks || {})); }
  touchGrade(st);
  if (!quiet) { saveSoon(); renderList(); openStudent(cur); toast(shownName(st, batch.students.indexOf(st)) + ' is graded on their own now'); }
}

// Pages a scan split gave to several students: the others who got them, with their file, for Mark and grade once.
function splitMates(st) {
  const out = [];
  for (const f of st.files) for (const r of Object.values(f.sc || {})) for (const k of r.w || []) {
    const s = batch.students.find(x => x.key === k); if (!s || s === st || out.some(o => o.s === s)) continue;
    const sf = s.files.find(x => Object.values(x.sc || {}).some(q => (q.w || []).includes(st.key)));
    out.push({ s, f: sf, mine: f });
  }
  return out;
}
// Marks are shared only when the two files are the same pages: every page went to both.
const pagesIn = f => f.numPages || Object.keys(f.sc || {}).length;
const allShared = (f, k) => !!f && pagesIn(f) > 0 && [...Array(pagesIn(f)).keys()].every(p => f.sc && f.sc[p] && (f.sc[p].w || []).includes(k));
function groupFromSplit(st) {
  const mates = splitMates(st); if (!mates.length) return;
  for (const { s, f, mine } of mates) groupAdd(st, mine, s, allShared(mine, s.key) && allShared(f, st.key) && pagesIn(f) === pagesIn(mine) ? f : null);
  const g = groupOf(st); if (g && !Object.keys(g.p).some(k => k !== st.key)) g.p = {};
  saveSoon(); renderList(); openStudent(cur);
  toast('Marked and graded once with ' + groupNames(groupMates(st)));
}

// The band above the paper.
function groupBand(st) {
  const mates = groupMates(st);
  if (mates.length) {
    const g = groupOf(st), marks = !!groupFileOf(g, st);
    return '<div class="grpband" id="grpBand"><b>Group work</b><span>with ' + esc(groupNames(mates)) + ' · ' + (marks ? 'marks and grade shared' : 'grade shared') + '</span><span style="flex:1"></span>' +
      '<button class="link" data-grpout title="Give this student their own grade and their own copy of the marks so far. The rest stay together.">Grade on their own…</button></div>';
  }
  const sm = splitMates(st);
  if (!sm.length) return '';
  return '<div class="grpband" id="grpBand"><b>Group work</b><span>pages shared with ' + esc(groupNames(sm.map(o => o.s))) + ', each graded on their own</span><span style="flex:1"></span>' +
    '<button class="link" data-grpjoin title="One set of marks and one grade for all of them">Mark and grade once for the group</button></div>';
}
// The band again, once a scan split's notes on who else got the pages have come in.
function groupBandRefresh() {
  if (!batch || !$('#paper .who')) return;
  const html = groupBand(batch.students[cur]), old = $('#grpBand');
  if (old) { if (html) old.outerHTML = html; else old.remove(); }
  else if (html) $('#paper .who').insertAdjacentHTML('afterend', html);
}
function groupClick(e) {
  const st = batch.students[cur];
  if (e.target.closest('[data-grpjoin]')) { groupFromSplit(st); return true; }
  if (e.target.closest('[data-grpout]')) {
    askDlg(shownName(st, cur) + ' gets their own grade and their own copy of the marks so far. ' + groupNames(groupMates(st)) + (groupMates(st).length > 1 ? ' stay together.' : ' keeps theirs.'), { ok: 'Grade on their own', cancel: 'Keep the group' }).then(ok => { if (ok) groupLeave(st); });
    return true;
  }
  return false;
}

/* ---------------- Group work… on a file ---------------- */
// Each student picked gets their own copy of the file as it was turned in. With the switch on (the default), they're one group: marked and graded once.
const shareCopies = (st, f) => batch.students.filter(s => s !== st && s.files.some(x => x.from === st.key && x.name === f.name));
const shareLink = f => { const st = batch.students[cur], n = st ? Math.max(shareCopies(st, f).length, groupMates(st).length) : 0; return '<button class="link" style="font-size:13px;margin-right:10px" data-shfile="' + esc(f.path) + '" title="Group work: give this paper to the students who worked on it, and mark and grade it once for all of them">Group work…' + (n ? ' (' + n + ')' : '') + '</button>'; };
function openShareFile(st, path) {
  const f = fileByPath(st, path); if (!f || !f.data) return;
  const anon = anonOn(), others = batch.students.map((s, i) => ({ s, i, label: shownName(s, i) })).filter(x => x.s !== st);
  if (anon) others.sort((a, b) => anonPos(a.i) - anonPos(b.i));
  const copyOf = s => s.files.find(x => x.from === st.key && x.name === f.name);
  let once = !(shareCopies(st, f).length && !groupOf(st));
  openDlg('<div class="bh"><h2>Group work: ' + esc(fileShown(st, f.name)) + '</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb"><button class="outsw" id="grpOnce" role="switch" aria-checked="' + once + '" style="margin:0 0 12px"><i></i><span><b>Mark and grade once for the group</b><small>Your marks, score and comment show on every partner’s paper. Turn off to mark each copy on its own.</small></span></button>' +
    '<p class="muted" style="margin:0 0 10px;font-size:14px">Click each student who worked on it with ' + esc(shownName(st, batch.students.indexOf(st))) + '. They get their own copy of the file, so the export gives each of them the marked paper. Remove on a copy takes it back.</p>' +
    '<input class="btn" id="mvFind" placeholder="' + (anon ? 'Type a paper number' : 'Type a name') + '" autocomplete="off" style="width:100%;margin-bottom:8px"><div id="mvList" class="mvlist"></div></div>' +
    '<div class="bf"><button class="btn primary" data-cancel>Done</button></div>', true);
  const inGrp = s => groupMates(st).includes(s);
  const draw = () => {
    const q = $('#mvFind').value.toLowerCase().split(/\s+/).filter(Boolean);
    const list = others.filter(x => q.every(w => x.label.toLowerCase().split(/[\s,_-]+/).some(y => y.startsWith(w))));
    $('#mvList').innerHTML = list.length ? list.map((x, k) => { const has = !!copyOf(x.s), g = inGrp(x.s), done = once ? g : has;
      return '<button class="mvrow' + (k === 0 && q.length ? ' top' : '') + '" data-shto="' + x.i + '"' + (done ? ' disabled' : '') + '>' + esc(x.label) + '<span class="muted">' + (g ? '✓ In the group' : has ? '✓ Has a copy' : x.s.files.length ? x.s.files.length + (x.s.files.length === 1 ? ' file' : ' files') : 'No files') + '</span></button>'; }).join('') : '<p class="muted">No name matches.</p>';
  };
  draw();
  $('#mvFind').oninput = draw;
  $('#mvFind').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const b = $('#mvList [data-shto]:not([disabled])'); if (b) b.click(); } };
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-cancel]')) { closeDlg(); return openStudent(cur); }
    if (e.target.closest('#grpOnce')) {
      once = !once; $('#grpOnce').setAttribute('aria-checked', once);
      if (once) { for (const s of shareCopies(st, f)) groupAdd(st, f, s, copyOf(s)); }
      else if (groupOf(st)) { for (const s of groupMates(st)) groupLeave(s, true); }
      saveSoon(); renderList(); draw(); return;
    }
    const b = e.target.closest('[data-shto]'); if (!b || b.disabled) return;
    const to = batch.students[+b.dataset.shto]; b.disabled = true;
    if (!copyOf(to)) await addFiles(to, [{ path: f.name, file: new File([f.data], f.name), from: st.key }], true);
    if (once) groupAdd(st, f, to, copyOf(to));
    saveSoon(); renderList();
    toast((once ? 'In the group: ' : 'Shared with ') + shownName(to, +b.dataset.shto)); draw(); $('#mvFind').focus();
  };
  $('#mvFind').focus();
}
