/* ---------------- what goes out for each student: files, page order, left out ---------------- */
// A student's "layout" is the list of files that go back to them, each a list of [source path, page].
// Untouched, it is just their files as turned in. Marks stay tied to the source page, so moving pages keeps them.
const thumbCache = new Map();
// A page turned by Taylor (f.rot[page]: 90, 180 or 270, clockwise) on top of the PDF's own turn. Marks are kept
// in the turned page's points, so every place that draws a page asks for its viewport here.
const rotOf = (f, p) => (f && f.rot && f.rot[p]) || 0;
const vpRot = (f, p, page, scale) => page.getViewport({ scale, rotation: ((page.rotate || 0) + rotOf(f, p)) % 360 });
// A crooked scan straightened (f.skew[page]: a small turn in degrees, clockwise, about the middle of the page). The page keeps its size and marks are
// kept in the straightened page's points, so every place that draws a page passes this on to pdf.js, and the screen and the export come out the same.
const skewOf = (f, p) => (f && f.skew && f.skew[p]) || 0;
const skewXf = (f, p, vp) => { const a = skewOf(f, p) * Math.PI / 180; if (!a) return undefined; const c = Math.cos(a), s = Math.sin(a), x = vp.width / 2, y = vp.height / 2; return [c, s, -s, c, x - c * x + s * y, y - s * x - c * y]; };
const vpDraw = (f, p, page, scale) => { const viewport = vpRot(f, p, page, scale); return { viewport, transform: skewXf(f, p, viewport) }; };
const viewable = f => f.kind === 'pdf' || f.kind === 'img';
const fileByPath = (st, path) => st.files.find(f => f.path === path);
function defaultLayout(st) {
  const L = st.files.filter(f => viewable(f) && !f.virtual && f.numPages).map(f => ({ name: f.name, file: f.path, pages: [...Array(f.numPages).keys()].map(p => [f.path, p]) }));
  const v = st.files.find(f => f.virtual && viewable(f));
  if (v && v.numPages) { const pg = [...Array(v.numPages).keys()].map(p => [v.path, p]); if (!L.length) L.push({ name: v.name, file: v.path, pages: pg }); else L[0].pages = setup.rubricPos === 'start' ? pg.concat(L[0].pages) : L[0].pages.concat(pg); }
  return L;
}
const layoutOf = st => st.layout || defaultLayout(st);
function pageMarked(st, path, p) { const f = fileByPath(st, path); return !!f && (((f.marks[p] || []).length > 0) || !!(f.kami && f.kami[p]) || !!(f.scan && f.scan.found && f.scan.found.some(g => g.page === p)) || !!(f.hand && f.hand.page === p)); }
const docMarked = (st, d) => d.pages.some(([path, p]) => pageMarked(st, path, p) || lostPages(fileByPath(st, path)).length > 0);
function batchHasMarks() { return !!batch && batch.students.some(st => st.files.some(f => fileMarked(f))); }
// Left out: chosen by Taylor, or (by default) a file with no marks at all while other papers are marked.
function docIn(st, d) {
  if (d.out != null) return !d.out;
  if (d.file && st.inc && st.inc[d.file] != null) return st.inc[d.file];
  if (docAdded(st, d)) return true;   // a file you added goes back unless you leave it out
  const read = d.pages.every(([path]) => { const f = fileByPath(st, path); return f && f.kami !== undefined; });
  if (!read) return true;
  return docMarked(st, d) || !batchHasMarks();
}
const docAuto = (st, d) => d.out == null && !(d.file && st.inc && st.inc[d.file] != null);
function setDocIn(st, d, on) {
  if (st.layout) { const t = st.layout.find(x => x === d || (x.name === d.name && JSON.stringify(x.pages) === JSON.stringify(d.pages))); if (t) t.out = !on; }
  else { st.inc = st.inc || {}; st.inc[d.file] = on; }
  saveSoon();
}
function fileIn(st, f) { return layoutOf(st).some(d => docIn(st, d) && d.pages.some(([path]) => path === f.path)); }

/* ---------------- the order of a student's files on screen: Word and other files among the PDF files ---------------- */
// Ids: 'f:<path>' for a file shown as one card (Word, text, other), 'd<n>' for the n-th file of pages in the layout.
// Untouched, cards come first and her Rubric setup Word rubric goes where Rubric setup puts it.
function fileSeq(st) {
  const L = layoutOf(st), rl = setup.rubricPos === 'end', of = k => st.files.filter(f => f.kind === k);
  const def = [...of('other'), ...of('text'), ...of('docx').filter(f => !(f.rubric && rl))].map(f => ({ id: 'f:' + f.path, f }))
    .concat(L.map((d, di) => ({ id: 'd' + di, d, di })))
    .concat(of('docx').filter(f => f.rubric && rl).map(f => ({ id: 'f:' + f.path, f })));
  const o = st.forder; if (!o) return def;
  const rank = (it, k) => { const i = o.indexOf(it.id); return i >= 0 ? i : o.length + k; };
  return def.map((it, k) => [rank(it, k), k, it]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
}
// A kind of file, to line up the same order on every student's paper: "their Word file you added", "the PDF they turned in"…
const seqSig = (st, it) => it.f ? it.f.kind + (it.f.rubric ? 'R' : '') + (it.f.added ? 'A' : '') : 'doc' + (it.d.pages.length && (fileByPath(st, it.d.pages[0][0]) || {}).added ? 'A' : '') + ((fileByPath(st, (it.d.pages[0] || [])[0]) || {}).virtual ? 'R' : '');

/* ---------------- a file in the wrong student's folder: move it to the right one ---------------- */
// The file keeps its path, marks and edits; batch.moved remembers the move so it holds when the download is opened again.
const moveLink = f => shareLink(f) + '<button class="link" style="font-size:13px;margin-right:10px" data-mvfile="' + esc(f.path) + '" title="This file belongs to someone else? Move it to the right student">Move to…</button>';
// Group work… is in src/groups.js.
function moveFileNow(path, key) {
  const src = batch.students.find(s => s.files.some(f => f.path === path)), dst = batch.students.find(s => s.key === key);
  if (!src || !dst || src === dst || dst.files.some(f => f.path === path)) return null;
  const f = fileByPath(src, path);
  src.files.splice(src.files.indexOf(f), 1); dst.files.push(f);
  return { src, dst, f };
}
const wordCopy = st => st.files.find(f => f.virtual && f.kind === 'docx');   // this student's copy of her Word rubric
async function moveFile(st, path, dst) {
  const a = shownName(st, batch.students.indexOf(st)), b = shownName(dst, batch.students.indexOf(dst)), f0 = fileByPath(st, path);
  if (!f0 || st === dst || dst.files.some(f => f.path === path)) return toast(dst.files.some(f => f.path === path) ? b + ' already has this file' : 'Couldn’t move that file');
  await Promise.all([...wordSaves].map(s => s()));   // boxes highlighted a moment ago count
  // a scored Word rubric that was in the wrong folder takes its score with it, if there's room for it there. If not, the score stays and she's told below.
  const ws = wordScore(f0), carried = !!ws && ws.total != null && ownGrade(st).total === ws.total && !hasOwnScore(dst) && !noScore(dst);
  if (carried) { st.grade.points = ''; st.grade.rubric.forEach((_, k) => touchGrade(st, k)); st.grade.rubric = []; touchGrade(st); }
  // Her score, comment and status may be about this file or about another one the student keeps, so she says. What's already on the other student is never written over.
  const said = gradeWords(st), others = st.files.filter(x => !x.virtual && x !== f0).length, clash = said.length > 0 && gradeHasWork(dst.grade);
  const take = said.length > 0 && !clash && await askDlg(a + ' has ' + wordsJoin(said) + '.\n\nMove ' + (said.length > 1 ? 'them' : 'it') + ' to ' + b + ' with this file?' + (others ? '\n\n' + a + ' still has ' + others + ' other file' + (others === 1 ? '' : 's') + '. Leave ' + (said.length > 1 ? 'them' : 'it') + ' if ' + (said.length > 1 ? 'they’re' : 'it’s') + ' about ' + (others === 1 ? 'that one' : 'those') + '.' : ''), { ok: 'Move to ' + b, cancel: 'Leave on ' + a });
  const L0 = layoutOf(st), m = moveFileNow(path, dst.key);
  if (!m) return toast('Couldn’t move that file');
  const { f } = m;
  if (take) {   // answers about what's written on the papers stay with both, since she may keep another paper
    const g = st.grade;
    dst.grade = g; st.grade = { rubric: [], points: '', comment: '', ...(g.reads ? { reads: { ...g.reads } } : {}) };
    touchGrade(st);
    // Her Word rubric copy holds the score as highlights. Left behind it would give the score straight back, so the two copies change places.
    const c = wordCopy(st), c2 = wordCopy(dst);
    if (c && c.edited) for (const [x, to] of [[c, dst], [c2, st]]) if (x && moveFileNow(x.path, to.key)) (batch.moved ||= {})[x.path] = to.key;
  }
  if (carried && !f0.virtual) (dst.grade.reads ||= {})[readKey(wordTableRead(f0))] = 1;   // her OK goes with the score: it's the same boxes she already counted, so they don't wait for a question on the new student
  if (st.layout || L0.some(d => d.pages.some(([q]) => q !== path) && d.pages.some(([q]) => q === path))) {
    st.layout = L0.map(d => ({ ...d, pages: d.pages.filter(([q]) => q !== path) })).filter(d => d.pages.length);
    if (!st.layout.length) st.layout = null;
  }
  if (dst.layout && viewable(f) && f.numPages) dst.layout.push({ name: f.name, file: f.path, pages: [...Array(f.numPages).keys()].map(p => [f.path, p]) });
  if (st.inc && st.inc[path] != null) { (dst.inc ||= {})[path] = st.inc[path]; delete st.inc[path]; }
  if (st.forder) st.forder = st.forder.filter(x => x !== 'f:' + path);
  for (const m of [batch.lightPg, batch.lightPgL]) if (m) for (const k of Object.keys(m)) if (k.startsWith(st.key + '|' + path + '|')) { m[dst.key + k.slice(st.key.length)] = m[k]; delete m[k]; }
  (batch.moved ||= {})[path] = dst.key;
  refound(st); refound(dst); wordScoresAll(); saveNow(); renderList(); openStudent(cur);
  toast('Moved ' + fileShown(st, f.name) + ' to ' + b + (take ? ' with ' + wordsJoin(said) : ''));
  if (clash) sayDlg(a + ' keeps ' + wordsJoin(said) + ', because ' + b + ' already has their own. Nothing was written over. Change either one if it belongs with this file.');
}
function openMoveFile(st, path) {
  const f = fileByPath(st, path); if (!f) return;
  const anon = anonOn(), others = batch.students.map((s, i) => ({ s, i, label: shownName(s, i) })).filter(x => x.s !== st);
  if (anon) others.sort((a, b) => anonPos(a.i) - anonPos(b.i));
  openDlg('<div class="bh"><h2>Move ' + esc(fileShown(st, f.name)) + '</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb"><p class="muted" style="margin:0 0 10px;font-size:14px">The file goes to that student with your marks on it. If this student has a score or comment, you’ll be asked whether it goes too. Moving it back works the same way.</p>' +
    '<input class="btn" id="mvFind" placeholder="' + (anon ? 'Type a paper number' : 'Type a name') + '" autocomplete="off" style="width:100%;margin-bottom:8px"><div id="mvList" class="mvlist"></div></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button></div>', true);
  const draw = () => {
    const q = $('#mvFind').value.toLowerCase().split(/\s+/).filter(Boolean);
    const list = others.filter(x => q.every(w => x.label.toLowerCase().split(/[\s,_-]+/).some(y => y.startsWith(w))));
    $('#mvList').innerHTML = list.length ? list.map((x, k) => '<button class="mvrow' + (k === 0 && q.length ? ' top' : '') + '" data-mvto="' + x.i + '">' + esc(x.label) + '<span class="muted">' + x.s.files.length + (x.s.files.length === 1 ? ' file' : ' files') + '</span></button>').join('') : '<p class="muted">No name matches.</p>';
  };
  draw();
  const box = $('#dlgBox');
  $('#mvFind').oninput = draw;
  $('#mvFind').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const b = $('#mvList [data-mvto]'); if (b) b.click(); } };   // or this Enter would also press the button on the question that comes next
  box.onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    const b = e.target.closest('[data-mvto]'); if (!b) return;
    closeDlg(); moveFile(st, path, batch.students[+b.dataset.mvto]);
  };
  $('#mvFind').focus();
}

