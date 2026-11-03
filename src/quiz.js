/* ---------------- Quick mark: a paper quiz marked one question at a time, across the class ---------------- */
// She draws a box around each question once, on any student's paper. Each box is kept as a share of its page, by its place in
// the student's page list (the first page, the second, ...), so the same box finds the same question on every scan.
// batch.quiz = { qs: [{ id, lab, n, x, y, w, h, pts, key }], side: 'left' | 'right', total: { n, x, y } | null, shift: { student: { n: [dx, dy] } } }
// A student's marks are st.grade.q = { id: points }. Each one also goes on the paper as a check, a cross or "1/2" by its box
// (marks tagged qz: id), and the sum is their points score, partial until every question is marked.
const QZ_PAD = 0.012;   // a little room around each box, since scans sit a bit differently
const quizOn = () => !!(batch && batch.quiz && batch.quiz.qs && batch.quiz.qs.length);
const quizMax = () => quizOn() ? batch.quiz.qs.reduce((a, q) => a + (+q.pts || 0), 0) : 0;
const quizLabel = (q, i) => (q.lab || '').trim() || String(i + 1);
// Every page of their scan, in order, including a file still waiting for its first mark (left out only until then). A file she left out herself isn't.
const quizPages = st => layoutOf(st).filter(d => docIn(st, d) || docAuto(st, d)).flatMap(d => d.pages.filter(([path]) => { const f = fileByPath(st, path); return f && !f.virtual && viewable(f); }));
const quizMarks = st => (st.grade && st.grade.q) || {};
function quizCount(st) { const m = quizMarks(st); return quizOn() ? batch.quiz.qs.filter(q => m[q.id] != null).length : 0; }
// Some questions marked, not all: the score shows as partial.
function quizPart(st) { const n = quizCount(st); return quizOn() && n > 0 && n < batch.quiz.qs.length; }
const quizSum = st => { const m = quizMarks(st); return batch.quiz.qs.reduce((a, q) => a + (m[q.id] != null ? +m[q.id] : 0), 0); };
// Who is marked: everyone with a paper, in list order, except anyone marked missing or excused.
function quizWho() {
  const order = anonOn() ? anonOrder() : batch.students.map((_, i) => i);
  return order.filter(i => { const st = batch.students[i]; return !noScore(st) && quizPages(st).length; });
}

/* drawing a student's page and cutting out the boxes */
const qzDocs = new Map();     // file path -> pdf.js document, while Quick mark is open
const qzCrops = new Map();    // student|question|shift|light -> picture URL
const qzSize = new Map();     // student|page -> { W, H }, the page's size in points
let qzQueue = Promise.resolve();
async function qzDoc(f) {
  if (!qzDocs.has(f.path)) qzDocs.set(f.path, pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise);
  return qzDocs.get(f.path);
}
function qzClose() {
  for (const p of qzDocs.values()) p.then(d => d.destroy(), () => {});
  qzDocs.clear();
}
function qzForget() { for (const u of qzCrops.values()) URL.revokeObjectURL(u); qzCrops.clear(); qzSize.clear(); }
const qzShift = (st, n) => ((batch.quiz.shift || {})[st.key] || {})[n] || [0, 0];
function qzCropKey(st, q) {
  const [path, p] = quizPages(st)[q.n] || [], f = path && fileByPath(st, path), L = f ? lightForPage(st, f, p) : null;
  return st.key + '|' + q.id + '|' + [q.n, q.x, q.y, q.w, q.h].join(',') + '|' + qzShift(st, q.n).join(',') + '|' + (L ? JSON.stringify(L) : '') + '|' + (f ? rotOf(f, p) + ',' + skewOf(f, p) : '');
}
// One page of one student, drawn at about 1600 pixels across. Returns the canvas and the page's size in points.
async function qzPage(st, n, wide = 1600) {
  const [path, p] = quizPages(st)[n] || [];
  const f = path && fileByPath(st, path);
  if (!f) return null;
  await workerReady;
  const js = await qzDoc(f), page = await js.getPage(p + 1), v1 = vpRot(f, p, page, 1), k = wide / v1.width;
  const c = document.createElement('canvas'); c.width = Math.ceil(v1.width * k); c.height = Math.ceil(v1.height * k);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, ...vpDraw(f, p, page, k), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
  page.cleanup();
  qzSize.set(st.key + '|' + n, { W: v1.width, H: v1.height });
  return { c, W: v1.width, H: v1.height, f, p };
}
// Where a box sits on this student's page, as shares of the page: her box, moved by this student's shift, with room around it.
function qzRect(st, q) {
  const [dx, dy] = qzShift(st, q.n);
  const x = clamp(q.x + dx - QZ_PAD, 0, 1), y = clamp(q.y + dy - QZ_PAD, 0, 1);
  return { x, y, w: Math.min(1 - x, q.w + QZ_PAD * 2), h: Math.min(1 - y, q.h + QZ_PAD * 2) };
}
// The pictures of every box on one page of one student, made together so the page is drawn once. One page at a time, in order.
function qzCut(st, n) {
  const run = qzQueue.then(async () => {
    const want = batch.quiz.qs.filter(q => q.n === n && !qzCrops.has(qzCropKey(st, q)));
    if (!want.length) return;
    let pg;
    try { pg = await qzPage(st, n); } catch (e) { console.error(e); return; }
    if (!pg) return;
    const L = lightForPage(st, pg.f, pg.p);
    for (const q of want) {
      const r = qzRect(st, q), sx = Math.round(r.x * pg.c.width), sy = Math.round(r.y * pg.c.height), sw = Math.max(1, Math.round(r.w * pg.c.width)), sh = Math.max(1, Math.round(r.h * pg.c.height));
      const c = document.createElement('canvas'); c.width = sw; c.height = sh;
      const ctx = c.getContext('2d'); ctx.drawImage(pg.c, sx, sy, sw, sh, 0, 0, sw, sh);
      if (L) lightCanvas(ctx, sw, sh, L);
      const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.86));
      if (blob) qzCrops.set(qzCropKey(st, q), URL.createObjectURL(blob));
    }
    pg.c.width = pg.c.height = 0;
  });
  qzQueue = run.catch(() => {});
  return run;
}
async function qzCrop(st, q) {
  const k = qzCropKey(st, q);
  if (!qzCrops.has(k)) await qzCut(st, q.n);
  return qzCrops.get(k) || null;
}
async function qzPageSize(st, n) {
  const k = st.key + '|' + n;
  if (qzSize.has(k)) return qzSize.get(k);
  const [path, p] = quizPages(st)[n] || [], f = path && fileByPath(st, path);
  if (!f) return null;
  await workerReady;
  const js = await qzDoc(f), page = await js.getPage(p + 1), v1 = vpRot(f, p, page, 1);
  const s = { W: v1.width, H: v1.height }; qzSize.set(k, s);
  return s;
}

/* a mark: the score, the check or cross on the paper, and the total */
async function quizSet(st, q, v) {
  const g = st.grade, m = g.q ? { ...g.q } : {};
  if (v == null) delete m[q.id]; else m[q.id] = v;
  g.q = m;
  await qzPaper(st, q, v);
  quizScore(st);
  await qzTotal(st);
  saveSoon(); renderList();
  if (batch.students[cur] === st) { renderGrade(); redrawAll(); }
}
// The points score follows her marks. Nothing marked: the score the marks gave goes too.
function quizScore(st) {
  const g = st.grade, n = quizCount(st);
  const v = n ? fmtNum(quizSum(st)) : '';
  if (!n && !g.qAuto) return;
  if (String(g.points) !== v) { g.points = v; touchGrade(st, 'points'); if (v !== '') liftStatus(st); }
  g.qAuto = !!n || undefined;
}
// What goes by the box on the paper: a check for full marks on a 1-point question, a cross for none, and "1/2" otherwise.
async function qzPaper(st, q, v) {
  const [path, p] = quizPages(st)[q.n] || [], f = path && fileByPath(st, path);
  if (!f) return;
  const list = (f.marks[p] ||= []);
  for (let i = list.length - 1; i >= 0; i--) if (list[i].qz === q.id) list.splice(i, 1);
  if (v == null) return;
  const sz = await qzPageSize(st, q.n); if (!sz) return;
  const [dx, dy] = qzShift(st, q.n), right = batch.quiz.side === 'right';
  const bx = (q.x + dx) * sz.W, by = (q.y + dy) * sz.H, bw = q.w * sz.W;
  const color = COLORS[inkColor] || COLORS.red, pts = +q.pts || 1;
  const ax = right ? bx + bw + 4 : Math.max(2, bx - 26), ay = Math.max(2, by + 2);   // just outside the box, in the margin
  if (pts === 1 && v >= 1) list.push({ t: 'check', color, x: r1(ax + 11), y: r1(ay + 10), size: 22, qz: q.id });
  else if (v <= 0) {
    const s = 9, cx = ax + 11, cy = ay + 10;
    list.push({ t: 'pen', color, w: 2.2, pts: [[r1(cx - s), r1(cy - s)], [r1(cx + s), r1(cy + s)]], qz: q.id });
    list.push({ t: 'pen', color, w: 2.2, pts: [[r1(cx + s), r1(cy - s)], [r1(cx - s), r1(cy + s)]], qz: q.id });
  } else {
    const text = fmtNum(v) + '/' + fmtNum(pts);
    measureCtx.font = '14px ' + FONT;
    const tw = measureCtx.measureText(text).width;
    list.push({ t: 'text', color, x: r1(right ? ax : Math.max(2, bx - tw - 6)), y: r1(ay + 2), size: 14, text, qz: q.id });
  }
  if (!list.length) delete f.marks[p];
}
// The total, as a score sticker in the spot she picked, once every question is marked. The grade sheet reads it off the paper.
async function qzTotal(st) {
  const t = batch.quiz.total;
  for (const [path, p] of quizPages(st)) { const f = fileByPath(st, path), l = f && f.marks[p]; if (l) for (let i = l.length - 1; i >= 0; i--) if (l[i].qz === 'total') l.splice(i, 1); }
  if (!t || quizCount(st) < batch.quiz.qs.length) return;
  const [path, p] = quizPages(st)[t.n] || [], f = path && fileByPath(st, path), sz = await qzPageSize(st, t.n);
  if (!f || !sz) return;
  const [dx, dy] = qzShift(st, t.n);
  (f.marks[p] ||= []).push({ t: 'stamp', k: 'score', text: stickerText(quizSum(st)), x: r1((t.x + dx) * sz.W), y: r1((t.y + dy) * sz.H), size: 52, color: COLORS[inkColor] || COLORS.red, qz: 'total' });
}
// After boxes move or a student's page is lined up again, the marks already given move with them.
async function qzRedoPaper(st) {
  const m = quizMarks(st);
  for (const q of batch.quiz.qs) if (m[q.id] != null) await qzPaper(st, q, m[q.id]);
  await qzTotal(st);
}
// Questions taken out: their marks come off the paper and out of the score.
function qzDropGone(keep) {
  for (const st of batch.students) {
    const m = st.grade.q; if (!m) continue;
    let hit = false;
    for (const id of Object.keys(m)) if (!keep.has(id)) { delete m[id]; hit = true; }
    for (const f of st.files) for (const l of Object.values(f.marks || {})) for (let i = l.length - 1; i >= 0; i--) if (l[i].qz && l[i].qz !== 'total' && !keep.has(l[i].qz)) { l.splice(i, 1); hit = true; }
    if (hit) quizScore(st);
  }
}

/* setting the boxes */
// The score is out of the quiz's points. A rubric download changes to points, after she says so if it has rubric scores.
async function qzOutOf() {
  const max = quizMax();
  if (!max || (setup.mode === 'points' && +setup.outOf === max)) return true;
  if (setup.mode === 'rubric' && batch.students.some(st => (st.grade.rubric || []).some(v => v != null)) &&
    !await askDlg('This assignment is scored with a rubric, and some students have rubric scores. Quick mark scores it out of ' + fmtNum(max) + ' points instead. The rubric scores stay saved but stop counting.', { ok: 'Score out of ' + fmtNum(max), cancel: 'Go back' })) return false;
  setup = { ...setup, mode: 'points', outOf: max };
  store.set('gs.setup', { ...setup, spot: undefined, rubricPage: undefined });
  if (batch.assignment) { batch.assignment.setup = { ...setup, spot: undefined }; saveLib(); }
  batch.students.forEach(refound);
  return true;
}
function openQuizBoxes(back) {
  const who = quizWho();
  if (!who.length) return toast('No scanned papers to draw boxes on');
  const Q = batch.quiz ? JSON.parse(JSON.stringify(batch.quiz)) : { qs: [], side: 'left', total: null, shift: {} };
  let si = who[0], selId = null, picking = false;
  if (Q.qs.length) { const was = who.find(i => batch.students[i].key === Q.from); if (was != null) si = was; }
  openDlg('<div class="bh"><h2>Quiz boxes</h2><label class="mrow" style="font-size:14px;gap:6px">Draw on <select id="qbWho" class="btn sm">' +
    who.map(i => '<option value="' + i + '">' + esc(shownName(batch.students[i], i)) + '</option>').join('') + '</select></label>' +
    '<button class="icon" data-close aria-label="Close">✕</button></div>' +
    '<div class="bb qbwrap"><div class="qbpages" id="qbPages"><p class="muted">Drawing the pages…</p></div><div class="qbside">' +
    '<p class="hsm" style="margin-top:0">Drag a box around each question, in order. Make it big enough to hold the answer. Then give each one its points, and the right answer if it has one.</p>' +
    '<div id="qbList"></div>' +
    '<div class="qbopt"><div class="chk" style="cursor:default">Marks go <span class="seg" id="qbSide"><button data-side="left">Left of each box</button><button data-side="right">Right</button></span></div>' +
    '<div class="chk" style="cursor:default;flex-wrap:wrap">Total <button class="btn sm" id="qbTotal"></button><span class="muted hsm" id="qbTotalSay"></span></div></div>' +
    '</div></div>' +
    '<div class="bf"><span class="muted hsm" id="qbSum" style="margin-right:auto"></span><button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save boxes</button></div>');
  $('#dlgBox').classList.add('spbox', 'qbdlg');
  const box = $('#dlgBox'), pagesEl = $('#qbPages');
  $('#qbWho').value = String(si);
  const st = () => batch.students[si];
  const sideSay = () => { for (const b of $('#qbSide').children) b.setAttribute('aria-pressed', String(b.dataset.side === (Q.side || 'left'))); };
  const totalSay = () => {
    $('#qbTotal').textContent = picking ? 'Click on the page…' : Q.total ? 'Move it' : 'Pick a spot';
    $('#qbTotalSay').textContent = Q.total ? 'The score goes on page ' + (Q.total.n + 1) + ' once every question is marked.' : 'Optional: a spot on the paper for the score, like 18/20 = 90%.';
    if (Q.total && !picking) $('#qbTotalSay').insertAdjacentHTML('beforeend', ' <button class="link" data-nototal>No total</button>');
  };
  const sum = () => { const t = Q.qs.reduce((a, q) => a + (+q.pts || 0), 0); $('#qbSum').textContent = Q.qs.length ? Q.qs.length + (Q.qs.length === 1 ? ' question' : ' questions') + ', out of ' + fmtNum(t) + ' points' : 'No boxes yet'; };
  const list = () => {
    $('#qbList').innerHTML = Q.qs.length ? '<table class="qbt"><thead><tr><th>Question</th><th>Points</th><th>Answer</th><th></th></tr></thead><tbody>' + Q.qs.map((q, i) =>
      '<tr data-q="' + q.id + '"' + (q.id === selId ? ' class="on"' : '') + '><td><input class="qlab" value="' + esc(q.lab || String(i + 1)) + '" aria-label="Question name" maxlength="12"></td>' +
      '<td><input class="qpts" type="number" min="0.5" step="0.5" value="' + esc(String(q.pts)) + '" aria-label="Points"></td>' +
      '<td><input class="qkey" value="' + esc(q.key || '') + '" placeholder="optional" aria-label="Right answer" maxlength="40"></td>' +
      '<td><button class="icon" data-del="' + q.id + '" aria-label="Take out this box" title="Take out">✕</button></td></tr>').join('') + '</tbody></table>'
      : '<p class="muted hsm">No boxes yet.</p>';
    sum();
  };
  const overlays = () => {
    for (const w of pagesEl.querySelectorAll('.qbpg')) {
      const n = +w.dataset.n;
      for (const el of w.querySelectorAll('.qbbox,.qbtot')) el.remove();
      Q.qs.forEach((q, i) => {
        if (q.n !== n) return;
        const d = document.createElement('div'); d.className = 'qbbox' + (q.id === selId ? ' on' : ''); d.dataset.q = q.id;
        Object.assign(d.style, { left: q.x * 100 + '%', top: q.y * 100 + '%', width: q.w * 100 + '%', height: q.h * 100 + '%' });
        d.innerHTML = '<span>' + esc(quizLabel(q, i)) + '</span>';
        w.appendChild(d);
      });
      if (Q.total && Q.total.n === n) { const d = document.createElement('div'); d.className = 'qbtot'; Object.assign(d.style, { left: Q.total.x * 100 + '%', top: Q.total.y * 100 + '%' }); d.textContent = fmtNum(Q.qs.reduce((a, q) => a + (+q.pts || 0), 0)) + '/' + fmtNum(Q.qs.reduce((a, q) => a + (+q.pts || 0), 0)); w.appendChild(d); }
    }
  };
  let tok = 0;
  const draw = async () => {
    const my = ++tok, s = st(), n = quizPages(s).length;
    pagesEl.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const w = document.createElement('div'); w.className = 'qbpg'; w.dataset.n = i;
      w.innerHTML = '<div class="qbpn">Page ' + (i + 1) + '</div>';
      pagesEl.appendChild(w);
    }
    overlays();
    for (let i = 0; i < n; i++) {
      let pg; try { pg = await qzPage(s, i, 1100); } catch (e) { console.error(e); continue; }
      if (my !== tok || !pagesEl.isConnected) { if (pg) pg.c.width = 0; return; }
      if (!pg) continue;
      const w = pagesEl.querySelector('.qbpg[data-n="' + i + '"]');
      pg.c.className = 'qbimg'; w.insertBefore(pg.c, w.children[1] || null);
    }
  };
  // Drawing a box: drag on a page. A click on a box picks it.
  let drag = null;
  pagesEl.onpointerdown = e => {
    const w = e.target.closest('.qbpg'); if (!w || e.button !== 0) return;
    const img = w.querySelector('canvas'); if (!img) return;
    const r = img.getBoundingClientRect(), at = ev => [clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)];
    const n = +w.dataset.n, p0 = at(e);
    if (picking) { Q.total = { n, x: r1(p0[0] * 1000) / 1000, y: r1(p0[1] * 1000) / 1000 }; picking = false; totalSay(); overlays(); return; }
    const hit = e.target.closest('.qbbox');
    if (hit) { selId = hit.dataset.q; list(); overlays(); const inp = $('#qbList').querySelector('tr.on .qpts'); if (inp) inp.focus(); return; }
    e.preventDefault(); w.setPointerCapture(e.pointerId);
    const ghost = document.createElement('div'); ghost.className = 'qbbox ghost'; w.appendChild(ghost);
    drag = { w, n, p0, at, ghost, sel: null };
  };
  pagesEl.onpointermove = e => {
    if (!drag) return;
    const [x, y] = drag.at(e), p0 = drag.p0;
    drag.sel = { x: Math.min(x, p0[0]), y: Math.min(y, p0[1]), w: Math.abs(x - p0[0]), h: Math.abs(y - p0[1]) };
    Object.assign(drag.ghost.style, { left: drag.sel.x * 100 + '%', top: drag.sel.y * 100 + '%', width: drag.sel.w * 100 + '%', height: drag.sel.h * 100 + '%' });
  };
  pagesEl.onpointerup = () => {
    if (!drag) return;
    const d = drag; drag = null; d.ghost.remove();
    if (!d.sel || d.sel.w < 0.02 || d.sel.h < 0.01) return;
    const last = Q.qs[Q.qs.length - 1], R = v => Math.round(v * 10000) / 10000;
    const q = { id: uid(), lab: '', n: d.n, x: R(d.sel.x), y: R(d.sel.y), w: R(d.sel.w), h: R(d.sel.h), pts: last ? last.pts : 1, key: '' };
    Q.qs.push(q); selId = q.id; list(); overlays();
  };
  box.oninput = e => {
    const tr = e.target.closest('tr[data-q]'); if (!tr) return;
    const q = Q.qs.find(x => x.id === tr.dataset.q); if (!q) return;
    if (e.target.classList.contains('qlab')) q.lab = e.target.value.trim() === String(Q.qs.indexOf(q) + 1) ? '' : e.target.value;
    if (e.target.classList.contains('qpts')) { const v = +e.target.value; if (v > 0 && v <= 100) q.pts = Math.round(v * 2) / 2; sum(); }
    if (e.target.classList.contains('qkey')) q.key = e.target.value;
    overlays();
  };
  box.onfocusin = e => { const tr = e.target.closest && e.target.closest('tr[data-q]'); if (tr && tr.dataset.q !== selId) { selId = tr.dataset.q; for (const x of box.querySelectorAll('tr[data-q]')) x.classList.toggle('on', x === tr); overlays(); } };
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) { if (back) return back(); closeDlg(); return qzClose(); }
    const dl = e.target.closest('[data-del]'); if (dl) { Q.qs = Q.qs.filter(q => q.id !== dl.dataset.del); if (selId === dl.dataset.del) selId = null; list(); overlays(); return; }
    const sd = e.target.closest('[data-side]'); if (sd) { Q.side = sd.dataset.side; sideSay(); return; }
    if (e.target.closest('#qbTotal')) { picking = !picking; totalSay(); return; }
    if (e.target.closest('[data-nototal]')) { Q.total = null; totalSay(); overlays(); return; }
    if (e.target.closest('[data-save]')) {
      for (const q of Q.qs) if (!(+q.pts > 0)) q.pts = 1;
      const old = batch.quiz;
      Q.from = st().key;
      batch.quiz = Q;
      if (!await qzOutOf()) { batch.quiz = old; return; }
      qzDropGone(new Set(Q.qs.map(q => q.id)));
      qzForget();
      for (const s of batch.students) if (s.grade.q && Object.keys(s.grade.q).length) { await qzRedoPaper(s); quizScore(s); }
      saveSoon(); renderGrade(); renderList(); quizBtn();
      if (pages.length) redrawAll();
      return Q.qs.length ? openQuiz('q') : closeDlg();
    }
  };
  box.onkeydown = e => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selId && !e.target.closest('input,select')) { e.preventDefault(); Q.qs = Q.qs.filter(q => q.id !== selId); selId = null; list(); overlays(); }
  };
  $('#qbWho').onchange = e => { si = +e.target.value; draw(); };
  sideSay(); totalSay(); list(); draw();
}

/* marking */
let qzView = 'q', qzAt = 0, qzStu = 0, qzKeys = null;
function openQuiz(view) {
  if (!batch) return;
  if (!quizOn()) return openQuizBoxes();
  if (view) qzView = view;
  qzAt = clamp(qzAt, 0, batch.quiz.qs.length - 1);
  const who = quizWho();
  if (!who.length) return toast('No scanned papers to mark');
  if (!who.includes(qzStu)) qzStu = who[0];
  openDlg('<div class="bh qmhd"><h2>Quick mark</h2><span class="seg" id="qmView"><button data-view="q">By question</button><button data-view="s">By student</button></span>' +
    '<span id="qmNav" class="qmnav"></span><span class="muted hsm" id="qmProg"></span>' +
    '<button class="btn sm" data-boxes>Boxes</button><button class="icon" data-close aria-label="Close">✕</button></div>' +
    '<div class="bb qmbody" id="qmBody"></div>' +
    '<div class="bf qmfoot"><span class="muted hsm" id="qmHint" style="margin-right:auto"></span><span id="qmFoot"></span></div>');
  $('#dlgBox').classList.add('spbox');
  const box = $('#dlgBox');
  box.oninput = box.onfocusin = box.onkeydown = null;
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return qmClose();
    if (e.target.closest('[data-boxes]')) return openQuizBoxes(() => openQuiz());
    const v = e.target.closest('[data-view]'); if (v) { qzView = v.dataset.view; return qmRender(); }
    const mv = e.target.closest('[data-qgo]'); if (mv) { qmGo(+mv.dataset.qgo); return; }
    const op = e.target.closest('[data-open]'); if (op) { qmClose(); return openStudent(+op.dataset.open); }
    if (e.target.closest('[data-rest]')) return qmRest();
    const b = e.target.closest('[data-v]');
    if (b) { const c = b.closest('[data-st]'); return qmMark(c, b.dataset.v === '' ? null : +b.dataset.v, true); }
  };
  box.onchange = e => {
    if (e.target.id === 'qmPick') { if (qzView === 'q') qzAt = +e.target.value; else qzStu = +e.target.value; qmRender(); }
  };
  if (qzKeys) document.removeEventListener('keydown', qzKeys, true);
  qzKeys = qmKey;
  document.addEventListener('keydown', qzKeys, true);
  qmRender();
}
function qmClose() {
  if (qzKeys) { document.removeEventListener('keydown', qzKeys, true); qzKeys = null; }
  closeDlg(); qzClose();
  if (batch && pages.length) openStudent(cur);   // the open paper shows the new marks
}
const qmCard = (i, q, qi) => {
  const st = batch.students[i], v = quizMarks(st)[q.id], pts = +q.pts || 1, steps = [];
  for (let s = 0; s <= pts; s += (pts <= 2 ? 0.5 : 1)) steps.push(s);
  const state = v == null ? '' : v >= pts ? ' right' : v <= 0 ? ' wrong' : ' some';
  const btns = pts === 1 ? '<button class="qmb ok" data-v="1" aria-pressed="' + (v === 1) + '" title="Right (1)">✓</button><button class="qmb no" data-v="0" aria-pressed="' + (v === 0) + '" title="Wrong (0)">✗</button>'
    : steps.map(s => '<button class="qmb' + (s >= pts ? ' ok' : s <= 0 ? ' no' : '') + '" data-v="' + s + '" aria-pressed="' + (v === s) + '">' + fmtNum(s) + '</button>').join('');
  const head = qzView === 'q' ? '<button class="link" data-open="' + i + '" title="Open their paper">' + esc(shownName(st, i)) + '</button>'
    : '<b>' + esc(quizLabel(q, qi)) + '</b>' + (q.key ? '<span class="qmkey">' + esc(q.key) + '</span>' : '') + '<span class="muted">' + fmtNum(pts) + (pts === 1 ? ' pt' : ' pts') + '</span>';
  return '<div class="qmc' + state + '" tabindex="0" data-st="' + i + '" data-q="' + q.id + '"><div class="qmch">' + head + '</div>' +
    '<div class="qmimg" title="Click: wrong / right. Drag: line this paper up"><span class="muted hsm">…</span></div>' +
    '<div class="qmbtns">' + btns + (v != null ? '<button class="qmb clr" data-v="" title="Clear">Clear</button>' : '') + '</div></div>';
};
let qmTok = 0;
function qmRender() {
  const body = $('#qmBody'); if (!body) return;
  const qs = batch.quiz.qs, who = quizWho(), my = ++qmTok;
  for (const b of $('#qmView').children) b.setAttribute('aria-pressed', String(b.dataset.view === qzView));
  let cards;
  if (qzView === 'q') {
    const q = qs[qzAt], done = who.filter(i => quizMarks(batch.students[i])[q.id] != null).length;
    $('#qmNav').innerHTML = '<button class="btn sm" data-qgo="-1" aria-label="Earlier question"' + (qzAt ? '' : ' disabled') + '>‹</button><select id="qmPick" class="btn sm" aria-label="Question">' +
      qs.map((x, i) => '<option value="' + i + '"' + (i === qzAt ? ' selected' : '') + '>Question ' + esc(quizLabel(x, i)) + '</option>').join('') + '</select>' +
      '<button class="btn sm" data-qgo="1" aria-label="Next question"' + (qzAt < qs.length - 1 ? '' : ' disabled') + '>›</button>' +
      (q.key ? '<span class="qmkey big" title="The right answer">' + esc(q.key) + '</span>' : '') + '<span class="muted hsm">' + fmtNum(+q.pts || 1) + ((+q.pts || 1) === 1 ? ' point' : ' points') + '</span>';
    $('#qmProg').textContent = done + ' of ' + who.length + ' marked';
    $('#qmFoot').innerHTML = '<button class="btn primary" data-rest' + (done === who.length ? ' disabled' : '') + '>Mark the rest right</button>';
    $('#qmHint').textContent = 'Click an answer to mark it wrong, click again for right. Keys: ← → to move, ' + ((+q.pts || 1) === 1 ? '1 right, 0 wrong' : 'a number for its points') + ', [ and ] for the question.';
    cards = who.map(i => [i, q, qzAt]);
    body.className = 'bb qmbody qmgrid';
  } else {
    const st = batch.students[qzStu], n = quizCount(st);
    $('#qmNav').innerHTML = '<button class="btn sm" data-qgo="-1" aria-label="Earlier student"' + (who.indexOf(qzStu) > 0 ? '' : ' disabled') + '>‹</button><select id="qmPick" class="btn sm" aria-label="Student">' +
      who.map(i => '<option value="' + i + '"' + (i === qzStu ? ' selected' : '') + '>' + esc(shownName(batch.students[i], i)) + '</option>').join('') + '</select>' +
      '<button class="btn sm" data-qgo="1" aria-label="Next student"' + (who.indexOf(qzStu) < who.length - 1 ? '' : ' disabled') + '>›</button>' +
      '<span class="qmtot">' + fmtNum(quizSum(st)) + ' / ' + fmtNum(quizMax()) + (n === qs.length && percentFor(quizSum(st)) != null ? ' = ' + percentFor(quizSum(st)) + '%' : '') + '</span>';
    $('#qmProg').textContent = n + ' of ' + qs.length + ' marked';
    $('#qmFoot').innerHTML = '<button class="btn" data-open="' + qzStu + '">Open their paper</button><button class="btn primary" data-rest' + (n === qs.length ? ' disabled' : '') + '>Mark the rest right</button>';
    $('#qmHint').textContent = 'Click an answer to mark it wrong, click again for right. Keys: ↑ ↓ to move, a number for its points, [ and ] for the student.';
    cards = qs.map((q, qi) => [qzStu, q, qi]);
    body.className = 'bb qmbody qmcol';
  }
  const keep = document.activeElement && document.activeElement.closest && document.activeElement.closest('.qmc');
  const keepAt = keep ? keep.dataset.st + '|' + keep.dataset.q : null;
  body.innerHTML = cards.map(c => qmCard(...c)).join('');
  if (keepAt) { const el = body.querySelector('.qmc[data-st="' + keepAt.split('|')[0] + '"][data-q="' + keepAt.split('|')[1] + '"]'); if (el) el.focus({ preventScroll: true }); }
  qmBindDrag(body);
  (async () => {
    for (const el of body.querySelectorAll('.qmc')) {
      const st = batch.students[+el.dataset.st], q = batch.quiz.qs.find(x => x.id === el.dataset.q);
      const url = await qzCrop(st, q);
      if (my !== qmTok || !el.isConnected) return;
      qmPic(el, url);
    }
  })();
}
function qmPic(el, url) {
  const spot = el.querySelector('.qmimg');
  spot.innerHTML = url ? '<img alt="" draggable="false" src="' + url + '">' : '<span class="muted hsm">This page isn’t in their scan.</span>';
}
// One card changed: its look, its buttons and the counts, without drawing the rest again.
function qmRefresh(el) {
  const i = +el.dataset.st, q = batch.quiz.qs.find(x => x.id === el.dataset.q), qi = batch.quiz.qs.indexOf(q);
  const tmp = document.createElement('div'); tmp.innerHTML = qmCard(i, q, qi);
  const fresh = tmp.firstChild;
  el.className = fresh.className;
  el.querySelector('.qmbtns').replaceWith(fresh.querySelector('.qmbtns'));
  const who = quizWho(), qs = batch.quiz.qs;
  if (qzView === 'q') {
    const done = who.filter(k => quizMarks(batch.students[k])[q.id] != null).length;
    $('#qmProg').textContent = done + ' of ' + who.length + ' marked';
    const r = $('#qmFoot').querySelector('[data-rest]'); if (r) r.disabled = done === who.length;
  } else {
    const st = batch.students[qzStu], n = quizCount(st);
    $('#qmProg').textContent = n + ' of ' + qs.length + ' marked';
    const t = $('#qmNav').querySelector('.qmtot'); if (t) t.textContent = fmtNum(quizSum(st)) + ' / ' + fmtNum(quizMax()) + (n === qs.length && percentFor(quizSum(st)) != null ? ' = ' + percentFor(quizSum(st)) + '%' : '');
    const r = $('#qmFoot').querySelector('[data-rest]'); if (r) r.disabled = n === qs.length;
  }
}
async function qmMark(el, v, keepFocus) {
  if (!el) return;
  const st = batch.students[+el.dataset.st], q = batch.quiz.qs.find(x => x.id === el.dataset.q);
  if (!st || !q) return;
  const pts = +q.pts || 1;
  if (v != null) v = clamp(v, 0, pts);
  await quizSet(st, q, v);
  if (el.isConnected) qmRefresh(el);
  if (!keepFocus) { const nx = el.nextElementSibling; if (nx) nx.focus(); }
}
async function qmRest() {
  const body = $('#qmBody'); if (!body) return;
  for (const el of body.querySelectorAll('.qmc')) {
    const st = batch.students[+el.dataset.st], q = batch.quiz.qs.find(x => x.id === el.dataset.q);
    if (quizMarks(st)[q.id] == null) await qmMark(el, +q.pts || 1, true);
  }
}
function qmGo(d) {
  if (qzView === 'q') qzAt = clamp(qzAt + d, 0, batch.quiz.qs.length - 1);
  else { const who = quizWho(), k = who.indexOf(qzStu); qzStu = who[clamp(k + d, 0, who.length - 1)]; }
  qmRender();
  const first = $('#qmBody') && $('#qmBody').querySelector('.qmc'); if (first) first.focus({ preventScroll: true });
}
function qmKey(e) {
  if (!$('#qmBody') || e.target.closest('select,input,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  const el = e.target.closest && e.target.closest('.qmc');
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  if (e.key === 'Escape') { stop(); return qmClose(); }
  if (e.key === '[' || e.key === ']') { stop(); return qmGo(e.key === ']' ? 1 : -1); }
  if (!el) {
    if (/^(Arrow|Tab)/.test(e.key)) { const f = $('#qmBody').querySelector('.qmc'); if (f && e.key !== 'Tab') { stop(); f.focus(); } }
    return;
  }
  const cards = [...$('#qmBody').querySelectorAll('.qmc')], k = cards.indexOf(el);
  const cols = qzView === 'q' ? Math.max(1, Math.round($('#qmBody').clientWidth / el.offsetWidth)) : 1;
  const move = d => { const t = cards[clamp(k + d, 0, cards.length - 1)]; if (t) { t.focus(); t.scrollIntoView({ block: 'nearest' }); } };
  if (e.key === 'ArrowRight') { stop(); return move(1); }
  if (e.key === 'ArrowLeft') { stop(); return move(-1); }
  if (e.key === 'ArrowDown') { stop(); return move(cols); }
  if (e.key === 'ArrowUp') { stop(); return move(-cols); }
  if (/^[0-9]$/.test(e.key)) { stop(); return qmMark(el, +e.key); }
  if (e.key === 'x' || e.key === 'X') { stop(); return qmMark(el, 0); }
  if (e.key === 'Backspace' || e.key === 'Delete') { stop(); return qmMark(el, null, true); }
}
// On a picture: a click marks it wrong (or right again if it was wrong); a drag lines that paper's page up, moving every box on it.
function qmBindDrag(body) {
  let d = null;
  body.onpointerdown = e => {
    const spot = e.target.closest('.qmimg'); if (!spot || e.button !== 0) return;
    const img = spot.querySelector('img');   // a click marks even before the picture is in; a drag needs it
    e.preventDefault(); spot.setPointerCapture(e.pointerId);
    d = { spot, img, x0: e.clientX, y0: e.clientY, moved: false, el: spot.closest('.qmc') };
    d.el.focus({ preventScroll: true });
  };
  body.onpointermove = e => {
    if (!d) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.img || (!d.moved && Math.hypot(dx, dy) < 5)) return;
    d.moved = true; d.img.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  };
  body.onpointerup = async e => {
    if (!d) return;
    const g = d; d = null;
    if (!g.moved) {
      const st = batch.students[+g.el.dataset.st], q = batch.quiz.qs.find(x => x.id === g.el.dataset.q), v = quizMarks(st)[q.id];
      return qmMark(g.el, v != null && v <= 0 ? +q.pts || 1 : 0, true);
    }
    const st = batch.students[+g.el.dataset.st], q = batch.quiz.qs.find(x => x.id === g.el.dataset.q), r = qzRect(st, q), shown = g.img.getBoundingClientRect();
    const fx = -(e.clientX - g.x0) / (shown.width || 1) * r.w, fy = -(e.clientY - g.y0) / (shown.height || 1) * r.h;
    const sh = ((batch.quiz.shift ||= {})[st.key] ||= {}), [ox, oy] = sh[q.n] || [0, 0], R = v => Math.round(v * 10000) / 10000;
    sh[q.n] = [R(clamp(ox + fx, -0.3, 0.3)), R(clamp(oy + fy, -0.3, 0.3))];
    await qzRedoPaper(st);
    saveSoon();
    if (batch.students[cur] === st) redrawAll();
    const url = await qzCrop(st, q);
    g.img.style.transform = '';
    if (g.el.isConnected) qmPic(g.el, url);
    for (const el of body.querySelectorAll('.qmc[data-st="' + g.el.dataset.st + '"]')) if (el !== g.el) { const q2 = batch.quiz.qs.find(x => x.id === el.dataset.q); if (q2.n === q.n) qzCrop(st, q2).then(u => el.isConnected && qmPic(el, u)); }
  };
}

/* the button */
function quizBtn() {
  const b = $('#quizTop'); if (b) b.hidden = !quizOn();
}
$('#quizBtn').onclick = () => openQuiz();
$('#quizTop').onclick = () => openQuiz();
Object.assign(window.__gs, { openQuiz, openQuizBoxes, quizSet, quizSum, quizCount, quizPart, quizMax, quizOn, qzCrop, qzRect, quizBtn });
