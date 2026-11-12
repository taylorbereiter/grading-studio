/* ---------------- Quick mark: a paper quiz marked one question at a time, across the class ---------------- */
// She draws a box around each question once, on any student's paper. Each box is kept as a share of its page, by its place in
// the student's page list (the first page, the second, ...), so the same box finds the same question on every scan.
// batch.quiz = { qs: [{ id, lab, n, x, y, w, h, pts, key, how, kind, mx, my }], how, words, side: 'left' | 'right', total: { n, x, y } | null,
//   shift: { student: { n: [dx, dy] } }, spot: { student: { id: [x, y] } } }
// how is the way a question is marked on the paper: 'x' an ✗ on wrong answers only, 'cx' a check and an ✗, 'pts' the points
// ("1/2"). A question saved before there was a choice has none and keeps the old look. mx, my is the spot she picked for its
// mark; without one it goes in the margin by the box. kind is how it is scored: 'rw' right or wrong (none or all of its points),
// 'scale' a point scale from 0 to its points, like a short answer: 0 understanding not shown, 1 partial, 2 full. A question
// with no kind is a scale when it is worth more than 1 point or marked in points, as it was before there was a choice.
// words are what 0, the middle and the top of a scale mean, shown on the scale's buttons. spot is a mark moved on one student's paper only.
// A student's marks are st.grade.q = { id: points }. Each one also goes on the paper by its box (marks tagged qz: id),
// and the sum is their points score, partial until every question is marked.
const QZ_PAD = 0.012;   // a little room around each box, since scans sit a bit differently
const QZ_HOW = { x: '✗ on wrong', cx: '✓ and ✗', pts: 'Points' };
const quizOn = () => !!(batch && batch.quiz && batch.quiz.qs && batch.quiz.qs.length);
const quizMax = () => quizOn() ? batch.quiz.qs.reduce((a, q) => a + (+q.pts || 0), 0) : 0;
const quizLabel = (q, i) => (q.lab || '').trim() || String(i + 1);
const qzHow = q => q.how || 'old';
// A scale: whole points as buttons (with halves from +½). Otherwise ✗ and ✓, for none or all of its points.
const qzByPts = q => q.kind ? q.kind === 'scale' : qzHow(q) === 'pts' || (+q.pts || 1) !== 1;
const QZ_KIND = { rw: 'Right / wrong', scale: 'Scale' };
// The steps of a scale up to pts: each whole point, and pts itself when it ends in a half.
const qzSteps = pts => { const a = []; for (let s = 0; s <= pts; s++) a.push(s); if (pts % 1) a.push(pts); return a; };
// What each step of a scale means, by its top: { '2': ['Not shown', 'Partial', 'Full'] }. Each teacher writes her own; a scale
// she hasn't written words for starts with Not shown at the bottom and Full at the top.
const qzWordsOk = w => w && typeof w === 'object' && !Array.isArray(w) && Object.values(w).every(l => Array.isArray(l) && l.every(x => typeof x === 'string'));
const qzWordsMine = () => { const w = store.get('gs.qmWords', null); return qzWordsOk(w) ? w : {}; };
const qzWordsAll = () => ({ ...qzWordsMine(), ...(batch && batch.quiz && qzWordsOk(batch.quiz.words) ? batch.quiz.words : {}) });
function qzStepWords(pts, all = qzWordsAll()) {
  const n = qzSteps(pts).length, own = all[String(pts)];
  if (own && own.length === n) return own.slice();
  if (n === 3) return ['Not shown', 'Partial', 'Full'];
  return Array.from({ length: n }, (_, k) => k === 0 ? 'Not shown' : k === n - 1 ? 'Full' : '');
}
const qzWord = (s, pts) => qzStepWords(pts)[qzSteps(pts).indexOf(s)] || '';
// Every page of their scan, in order, including a file still waiting for its first mark (left out only until then). A file she left out herself isn't.
const quizPages = st => layoutOf(st).filter(d => docIn(st, d) || docAuto(st, d)).flatMap(d => d.pages.filter(([path]) => { const f = fileByPath(st, path); return f && !f.virtual && viewable(f) && !tryOfFile(st, f); }));
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
const qzCrops = new Map();    // student|question|shift|spot|light -> { url, r }: the picture and the part of the page it shows
const qzSize = new Map();     // student|page -> { W, H }, the page's size in points
let qzQueue = Promise.resolve();
async function qzDoc(f) {
  if (!qzDocs.has(f.path)) qzDocs.set(f.path, viewBytes(f).then(b => pdfjsLib.getDocument({ data: b.slice(), isEvalSupported: false }).promise));
  return qzDocs.get(f.path);
}
function qzClose() {
  for (const p of qzDocs.values()) p.then(d => d.destroy(), () => {});
  qzDocs.clear();
}
function qzForget() { for (const c of qzCrops.values()) URL.revokeObjectURL(c.url); qzCrops.clear(); qzSize.clear(); }
const qzShift = (st, n) => ((batch.quiz.shift || {})[st.key] || {})[n] || [0, 0];
const qzSz = (st, n) => qzSize.get(st.key + '|' + n) || { W: 612, H: 792 };
// A mark she moved on this student's paper only, kept as a share of the page before their shift.
const qzOwn = (st, q) => ((batch.quiz.spot || {})[st.key] || {})[q.id] || null;
// The middle of the mark on this student's page, as shares of the page.
function qzSpot(st, q, sz) {
  sz = sz || qzSz(st, q.n);
  const [dx, dy] = qzShift(st, q.n), own = qzOwn(st, q);
  if (own) return { x: own[0] + dx, y: own[1] + dy, own: true };
  if (q.mx != null) return { x: q.mx + dx, y: q.my + dy };
  const right = batch.quiz.side === 'right';
  return { x: right ? q.x + dx + q.w + 15 / sz.W : Math.max(13 / sz.W, q.x + dx - 15 / sz.W), y: Math.max(12 / sz.H, q.y + dy + 12 / sz.H), margin: true, right };
}
function qzCropKey(st, q) {
  const [path, p] = quizPages(st)[q.n] || [], f = path && fileByPath(st, path), L = f ? lightForPage(st, f, p) : null;
  return st.key + '|' + q.id + '|' + [q.n, q.x, q.y, q.w, q.h].join(',') + '|' + qzShift(st, q.n).join(',') + '|' + [q.mx, q.my, batch.quiz.side, qzOwn(st, q)].join(',') + '|' +
    (L ? JSON.stringify(L) : '') + '|' + (f ? rotOf(f, p) + ',' + skewOf(f, p) : '');
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
// The part of this student's page an answer shows, as shares of the page: her box, moved by this student's shift, with room
// around it, and always the spot where its mark goes.
function qzRect(st, q) {
  const [dx, dy] = qzShift(st, q.n), sz = qzSz(st, q.n), s = qzSpot(st, q, sz), ex = 30 / sz.W, ey = 14 / sz.H;
  const x0 = clamp(Math.min(q.x + dx - QZ_PAD, s.x - ex), 0, 1), y0 = clamp(Math.min(q.y + dy - QZ_PAD, s.y - ey), 0, 1);
  const x1 = clamp(Math.max(q.x + dx + q.w + QZ_PAD, s.x + ex), 0, 1), y1 = clamp(Math.max(q.y + dy + q.h + QZ_PAD, s.y + ey), 0, 1);
  return { x: x0, y: y0, w: Math.max(0.001, x1 - x0), h: Math.max(0.001, y1 - y0) };
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
      if (blob) qzCrops.set(qzCropKey(st, q), { url: URL.createObjectURL(blob), r });
    }
    pg.c.width = pg.c.height = 0;
  });
  qzQueue = run.catch(() => {});
  return run;
}
// The picture of one answer and the part of the page it shows, or null when the page isn't in their scan.
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

/* a mark: the score, the mark on the paper, and the total */
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
// What a mark of v looks like on the paper for this question: 'check', 'x', a text like "1/2", or nothing.
function qzLook(q, v) {
  if (v == null) return null;
  const pts = +q.pts || 1, how = qzHow(q), text = fmtNum(v) + '/' + fmtNum(pts);
  if (how === 'pts') return { k: 'text', text };
  if (v <= 0) return { k: 'x' };
  if (v >= pts) return how === 'x' ? null : how === 'cx' || pts === 1 || !qzByPts(q) ? { k: 'check' } : { k: 'text', text };
  return { k: 'text', text };
}
async function qzPaper(st, q, v) {
  const [path, p] = quizPages(st)[q.n] || [], f = path && fileByPath(st, path);
  if (!f) return;
  const list = (f.marks[p] ||= []);
  for (let i = list.length - 1; i >= 0; i--) if (list[i].qz === q.id) list.splice(i, 1);
  const look = qzLook(q, v);
  if (look) {
    const sz = await qzPageSize(st, q.n); if (!sz) return;
    const s = qzSpot(st, q, sz), cx = s.x * sz.W, cy = s.y * sz.H, color = COLORS[inkColor] || COLORS.red;
    if (look.k === 'check') list.push({ t: 'check', color: CHECK_INK, x: r1(cx), y: r1(cy), size: 22, qz: q.id });
    else if (look.k === 'x') {
      const d = 9;
      list.push({ t: 'pen', color, w: 2.2, pts: [[r1(cx - d), r1(cy - d)], [r1(cx + d), r1(cy + d)]], qz: q.id });
      list.push({ t: 'pen', color, w: 2.2, pts: [[r1(cx + d), r1(cy - d)], [r1(cx - d), r1(cy + d)]], qz: q.id });
    } else {
      measureCtx.font = '14px ' + FONT;
      const tw = measureCtx.measureText(look.text).width, bx = (q.x + qzShift(st, q.n)[0]) * sz.W;
      const x = s.margin ? (s.right ? cx - 11 : Math.max(2, bx - tw - 6)) : cx - tw / 2;   // in the margin it sits beside the box, like before
      list.push({ t: 'text', color, x: r1(Math.max(2, x)), y: r1(Math.max(2, cy - 8)), size: 14, text: look.text, qz: q.id });
    }
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
// Questions taken out: their marks come off the paper and out of the score, and any mark moved on one paper is forgotten.
function qzDropGone(keep) {
  for (const sp of Object.values(batch.quiz.spot || {})) for (const id of Object.keys(sp)) if (!keep.has(id)) delete sp[id];
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
const qzKindOpts = q => '<option value="rw"' + (qzByPts(q) ? '' : ' selected') + '>Right / wrong</option><option value="scale"' + (qzByPts(q) ? ' selected' : '') + '>Scale 0 to ' + fmtNum(+q.pts || 1) + '</option>';
const qzHowOpts = q => Object.entries(QZ_HOW).map(([k, t]) => '<option value="' + k + '"' + ((q.how || 'cx') === k ? ' selected' : '') + '>' + t + '</option>').join('');
function openQuizBoxes(back) {
  const who = quizWho();
  if (!who.length) return toast('No scanned papers to draw boxes on');
  const Q = batch.quiz ? JSON.parse(JSON.stringify(batch.quiz)) : { qs: [], how: 'x', side: 'left', total: null, shift: {} };
  Q.how ||= 'x';
  Q.words = JSON.parse(JSON.stringify(qzWordsAll()));
  let si = who[0], selId = null, picking = false, spotPick = false;
  if (Q.qs.length) { const was = who.find(i => batch.students[i].key === Q.from); if (was != null) si = was; }
  openDlg('<div class="bh"><h2>Quiz boxes</h2><label class="mrow" style="font-size:14px;gap:6px">Draw on <select id="qbWho" class="btn sm">' +
    who.map(i => '<option value="' + i + '">' + esc(shownName(batch.students[i], i)) + '</option>').join('') + '</select></label>' +
    '<button class="icon" data-close aria-label="Close">✕</button></div>' +
    '<div class="bb qbwrap"><div class="qbpages" id="qbPages" tabindex="-1"><p class="muted">Drawing the pages…</p></div><div class="qbside">' +
    '<p class="hsm" style="margin-top:0">Drag a box around each question, in order. Boxes can overlap. Drag a box’s number to move it. Click a box to resize it from a corner or set where its mark goes. Then give each one its points, how it’s scored (right or wrong, or a scale like 0 to 2 for a short answer) and the right answer if it has one.</p>' +
    '<div id="qbList"></div><div id="qbWords"></div><div id="qbSpot"></div>' +
    '<div class="qbopt"><div class="chk" style="cursor:default;flex-wrap:wrap">New boxes mark with <span class="seg" id="qbHow">' + Object.entries(QZ_HOW).map(([k, t]) => '<button data-how="' + k + '">' + t + '</button>').join('') + '</span></div>' +
    '<div class="chk" style="cursor:default;flex-wrap:wrap">Marks go <span class="seg" id="qbSide"><button data-side="left">Left of each box</button><button data-side="right">Right</button></span><span class="muted hsm">unless you picked a spot</span></div>' +
    '<div class="chk" style="cursor:default;flex-wrap:wrap">Total <button class="btn sm" id="qbTotal"></button><span class="muted hsm" id="qbTotalSay"></span></div>' +
    '<p class="muted hsm" style="margin:0">Keys for the picked box: arrows move it, Shift + arrows resize it, Ctrl D copies it just below, Delete takes it out.</p></div>' +
    '</div></div>' +
    '<div class="bf"><span class="muted hsm" id="qbSum" style="margin-right:auto"></span><button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save boxes</button></div>');
  $('#dlgBox').classList.add('spbox', 'qbdlg');
  const box = $('#dlgBox'), pagesEl = $('#qbPages');
  $('#qbWho').value = String(si);
  const st = () => batch.students[si];
  const R = v => Math.round(v * 10000) / 10000;
  const qOf = id => Q.qs.find(q => q.id === id);
  const sideSay = () => {
    for (const b of $('#qbSide').children) b.setAttribute('aria-pressed', String(b.dataset.side === (Q.side || 'left')));
    for (const b of $('#qbHow').children) b.setAttribute('aria-pressed', String(b.dataset.how === Q.how));
  };
  const totalSay = () => {
    $('#qbTotal').textContent = picking ? 'Click on the page…' : Q.total ? 'Move it' : 'Pick a spot';
    $('#qbTotalSay').textContent = Q.total ? 'The score goes on page ' + (Q.total.n + 1) + ' once every question is marked.' : 'Optional: a spot on the paper for the score, like 18/20 = 90%.';
    if (Q.total && !picking) $('#qbTotalSay').insertAdjacentHTML('beforeend', ' <button class="link" data-nototal>No total</button>');
  };
  const spotSay = () => {
    const q = qOf(selId), el = $('#qbSpot');
    if (!q) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="qbspot"><b class="hsm">Question ' + esc(quizLabel(q, Q.qs.indexOf(q))) + ' mark:</b><button class="btn sm" data-spot>' + (spotPick ? 'Click on the page…' : 'Pick mark spot') + '</button>' +
      (q.mx != null ? '<button class="link" data-margin>Back to the margin</button>' : '<span class="muted hsm">in the margin</span>') + '</div>';
  };
  // What each step of each scale in this quiz means, shown on its buttons while marking. Only there while some question is on a scale.
  const wordsSay = () => {
    const el = $('#qbWords'), tops = [...new Set(Q.qs.filter(qzByPts).map(q => +q.pts || 1))].sort((a, b) => a - b);
    const key = tops.join(','); if (el.dataset.tops === key) return;
    el.dataset.tops = key;
    el.innerHTML = tops.length ? '<div class="qbwords"><p class="hsm" style="margin:0"><b>What each point means</b> <span class="muted">shown on the buttons while you mark</span></p>' + tops.map(t => {
      const w = Q.words[String(t)] && Q.words[String(t)].length === qzSteps(t).length ? Q.words[String(t)] : qzStepWords(t, Q.words);
      return '<div class="qbwrow"><span class="muted hsm">0 to ' + fmtNum(t) + '</span>' + qzSteps(t).map((s, k) =>
        '<label class="qbw"><b>' + fmtNum(s) + '</b><input class="qword" data-top="' + t + '" data-k="' + k + '" value="' + esc(w[k] || '') + '" placeholder="—" aria-label="What ' + fmtNum(s) + ' of ' + fmtNum(t) + ' means" maxlength="30"></label>').join('') + '</div>';
    }).join('') + '</div>' : '';
  };
  const sum = () => { const t = Q.qs.reduce((a, q) => a + (+q.pts || 0), 0); $('#qbSum').textContent = Q.qs.length ? Q.qs.length + (Q.qs.length === 1 ? ' question' : ' questions') + ', out of ' + fmtNum(t) + ' points' : 'No boxes yet'; };
  const list = () => {
    $('#qbList').innerHTML = Q.qs.length ? '<table class="qbt"><thead><tr><th>Question</th><th>Points</th><th>Scored</th><th>How to mark</th><th>Answer</th><th></th></tr></thead><tbody>' + Q.qs.map((q, i) =>
      '<tr data-q="' + q.id + '"' + (q.id === selId ? ' class="on"' : '') + '><td><input class="qlab" value="' + esc(q.lab || String(i + 1)) + '" aria-label="Question name" maxlength="12"></td>' +
      '<td><input class="qpts" type="number" min="0.5" step="0.5" value="' + esc(String(q.pts)) + '" aria-label="Points"></td>' +
      '<td><select class="qkind" aria-label="Scored">' + qzKindOpts(q) + '</select></td>' +
      '<td><select class="qhow" aria-label="How to mark">' + qzHowOpts(q) + '</select></td>' +
      '<td><input class="qkey" value="' + esc(q.key || '') + '" placeholder="optional" aria-label="Right answer" maxlength="40"></td>' +
      '<td><button class="icon" data-del="' + q.id + '" aria-label="Take out this box" title="Take out">✕</button></td></tr>' +
      (goalList().length ? '<tr class="qgrow' + (q.id === selId ? ' on' : '') + '" data-q="' + q.id + '"><td colspan="6"><label>Goal ' + goalPick('data-qgoal', q.goal || '', 'Learning goal for question ' + quizLabel(q, i)) + '</label></td></tr>' : '')).join('') + '</tbody></table>' +
      '<p class="hsm goalline"><button class="link" data-qgoals>' + (goalList().length ? 'Edit goals…' : 'Tag questions with learning goals…') + '</button></p>'
      : '<p class="muted hsm">No boxes yet.</p>';
    wordsSay(); sum(); spotSay();
  };
  // Where a box's mark shows while setting up: her spot, or the margin by the box.
  const pinAt = q => {
    if (q.mx != null) return [q.mx, q.my];
    const sz = qzSz(st(), q.n), right = (Q.side || 'left') === 'right';
    return [right ? q.x + q.w + 15 / sz.W : Math.max(13 / sz.W, q.x - 15 / sz.W), Math.max(12 / sz.H, q.y + 12 / sz.H)];
  };
  const overlays = () => {
    for (const w of pagesEl.querySelectorAll('.qbpg')) {
      const n = +w.dataset.n;
      for (const el of w.querySelectorAll('.qbbox,.qbtot,.qbpin')) el.remove();
      Q.qs.forEach((q, i) => {
        if (q.n !== n) return;
        const on = q.id === selId;
        const d = document.createElement('div'); d.className = 'qbbox' + (on ? ' on' : ''); d.dataset.q = q.id;
        Object.assign(d.style, { left: q.x * 100 + '%', top: q.y * 100 + '%', width: q.w * 100 + '%', height: q.h * 100 + '%' });
        d.innerHTML = '<span>' + esc(quizLabel(q, i)) + '</span>' + (on ? ['nw', 'ne', 'sw', 'se'].map(c => '<i class="qbh ' + c + '" data-c="' + c + '"></i>').join('') : '');
        w.appendChild(d);
        const [px, py] = pinAt(q), pin = document.createElement('div');
        pin.className = 'qbpin' + (on ? ' on' : ''); pin.dataset.q = q.id; pin.title = 'Where the mark goes. Drag to move it.';
        Object.assign(pin.style, { left: px * 100 + '%', top: py * 100 + '%' });
        pin.textContent = (q.how || 'cx') === 'pts' ? fmtNum(+q.pts || 1) : '✗';
        w.appendChild(pin);
      });
      if (Q.total && Q.total.n === n) { const d = document.createElement('div'); d.className = 'qbtot'; Object.assign(d.style, { left: Q.total.x * 100 + '%', top: Q.total.y * 100 + '%' }); d.textContent = fmtNum(Q.qs.reduce((a, q) => a + (+q.pts || 0), 0)) + '/' + fmtNum(Q.qs.reduce((a, q) => a + (+q.pts || 0), 0)); w.appendChild(d); }
    }
  };
  const pick = id => { selId = id; spotPick = false; list(); overlays(); };
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
    overlays();   // the margin spots now know the page's size
  };
  // On a page: a drag draws a new box, even starting inside another one, so boxes can overlap. A click picks the box under it.
  // A drag on a box's number tab moves it; on the picked box's corners, resizes it. A drag on a mark's circle moves the mark.
  let drag = null;
  pagesEl.onpointerdown = e => {
    const w = e.target.closest('.qbpg'); if (!w || e.button !== 0) return;
    const img = w.querySelector('canvas'); if (!img) return;
    const r = img.getBoundingClientRect(), at = ev => [clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)];
    const n = +w.dataset.n, p0 = at(e);
    if (picking) { Q.total = { n, x: r1(p0[0] * 1000) / 1000, y: r1(p0[1] * 1000) / 1000 }; picking = false; totalSay(); overlays(); return; }
    if (spotPick) {
      const q = qOf(selId); spotPick = false;
      if (q && q.n === n) { q.mx = R(p0[0]); q.my = R(p0[1]); } else if (q) toast('Pick a spot on page ' + (q.n + 1) + ', where question ' + quizLabel(q, Q.qs.indexOf(q)) + ' is');
      spotSay(); overlays(); return;
    }
    e.preventDefault(); w.setPointerCapture(e.pointerId); pagesEl.focus({ preventScroll: true });
    const pin = e.target.closest('.qbpin'), hd = e.target.closest('.qbh'), tab = e.target.closest('.qbbox>span');
    let kind = 'draw', q = null;
    if (pin) { kind = 'pin'; q = qOf(pin.dataset.q); }
    else if (hd) { kind = hd.dataset.c; q = qOf(selId); }
    else if (tab) { kind = 'move'; q = qOf(tab.parentNode.dataset.q); }
    drag = { kind, q, orig: q ? { ...q } : null, hit: e.target.closest('.qbbox'), w, n, p0, at, r, moved: false };
  };
  pagesEl.onpointermove = e => {
    if (!drag) return;
    const d = drag, p = d.at(e), dx = p[0] - d.p0[0], dy = p[1] - d.p0[1];
    if (!d.moved && Math.hypot(dx * d.r.width, dy * d.r.height) < 4) return;
    d.moved = true;
    const q = d.q, o = d.orig;
    if (d.kind === 'draw') {
      if (!d.ghost) { d.ghost = document.createElement('div'); d.ghost.className = 'qbbox ghost'; d.w.appendChild(d.ghost); }
      d.sel = { x: Math.min(p[0], d.p0[0]), y: Math.min(p[1], d.p0[1]), w: Math.abs(dx), h: Math.abs(dy) };
      Object.assign(d.ghost.style, { left: d.sel.x * 100 + '%', top: d.sel.y * 100 + '%', width: d.sel.w * 100 + '%', height: d.sel.h * 100 + '%' });
      return;
    }
    if (!q) return;
    if (d.kind === 'pin') { q.mx = R(p[0]); q.my = R(p[1]); }
    else if (d.kind === 'move') {
      q.x = R(clamp(o.x + dx, 0, 1 - o.w)); q.y = R(clamp(o.y + dy, 0, 1 - o.h));
      if (o.mx != null) { q.mx = R(clamp(o.mx + q.x - o.x, 0, 1)); q.my = R(clamp(o.my + q.y - o.y, 0, 1)); }
    } else {   // a corner: nw, ne, sw or se
      let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h;
      if (d.kind[1] === 'w') x0 = p[0]; else x1 = p[0];
      if (d.kind[0] === 'n') y0 = p[1]; else y1 = p[1];
      q.x = R(Math.min(x0, x1)); q.y = R(Math.min(y0, y1)); q.w = R(Math.max(0.02, Math.abs(x1 - x0))); q.h = R(Math.max(0.01, Math.abs(y1 - y0)));
    }
    overlays();
  };
  pagesEl.onpointerup = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.ghost) d.ghost.remove();
    if (d.kind === 'draw') {
      if (!d.moved) return pick(d.hit ? d.hit.dataset.q : null);
      if (!d.sel || d.sel.w < 0.02 || d.sel.h < 0.01) return;
      const last = Q.qs[Q.qs.length - 1];
      const q = { id: uid(), lab: '', n: d.n, x: R(d.sel.x), y: R(d.sel.y), w: R(d.sel.w), h: R(d.sel.h), pts: last ? last.pts : 1, key: '', how: Q.how };
      if (last && last.kind) q.kind = last.kind;   // after a short answer, the next box is one too
      Q.qs.push(q); return pick(q.id);
    }
    if (d.q) pick(d.q.id);
  };
  box.oninput = e => {
    if (e.target.classList.contains('qword')) { const w = Q.words[e.target.dataset.top] ||= qzStepWords(+e.target.dataset.top, Q.words); w[+e.target.dataset.k] = e.target.value.trim().slice(0, 30); return; }
    const tr = e.target.closest('tr[data-q]'); if (!tr) return;
    const q = qOf(tr.dataset.q); if (!q) return;
    if (e.target.classList.contains('qlab')) q.lab = e.target.value.trim() === String(Q.qs.indexOf(q) + 1) ? '' : e.target.value;
    if (e.target.classList.contains('qpts')) { const v = +e.target.value; if (v > 0 && v <= 100) q.pts = Math.round(v * 2) / 2; tr.querySelector('.qkind').innerHTML = qzKindOpts(q); sum(); wordsSay(); }
    if (e.target.classList.contains('qkind')) {
      q.kind = e.target.value;
      if (q.kind === 'scale' && (+q.pts || 1) <= 1) { q.pts = 2; tr.querySelector('.qpts').value = '2'; sum(); }   // a scale of 0 to 1 is right or wrong
      tr.querySelector('.qkind').innerHTML = qzKindOpts(q);
      wordsSay();
    }
    if (e.target.classList.contains('qkey')) q.key = e.target.value;
    if (e.target.classList.contains('qhow')) q.how = e.target.value;
    if (e.target.dataset.qgoal != null) {   // a learning goal for this question (goals.js); the last choice makes a new one
      if (e.target.value === '+') { goalsDlg({ add: true }).then(r => { if (r.added) q.goal = r.added; if (pagesEl.isConnected) list(); }); return; }
      if (e.target.value) q.goal = e.target.value; else delete q.goal;
    }
    overlays();
  };
  if (box._qbFocus) box.removeEventListener('focusin', box._qbFocus);
  box._qbFocus = e => { if (!pagesEl.isConnected) return; const tr = e.target.closest && e.target.closest('tr[data-q]'); if (tr && tr.dataset.q !== selId) { selId = tr.dataset.q; spotPick = false; for (const x of box.querySelectorAll('tr[data-q]')) x.classList.toggle('on', x.dataset.q === selId); spotSay(); overlays(); } };
  box.addEventListener('focusin', box._qbFocus);
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) { if (back) return back(); closeDlg(); return qzClose(); }
    const dl = e.target.closest('[data-del]'); if (dl) { Q.qs = Q.qs.filter(q => q.id !== dl.dataset.del); if (selId === dl.dataset.del) selId = null; list(); overlays(); return; }
    const sd = e.target.closest('[data-side]'); if (sd) { Q.side = sd.dataset.side; sideSay(); overlays(); return; }
    const hw = e.target.closest('[data-how]'); if (hw) { Q.how = hw.dataset.how; sideSay(); return; }
    if (e.target.closest('[data-spot]')) { spotPick = !spotPick; picking = false; totalSay(); spotSay(); return; }
    if (e.target.closest('[data-margin]')) { const q = qOf(selId); if (q) { delete q.mx; delete q.my; } spotSay(); overlays(); return; }
    if (e.target.closest('#qbTotal')) { picking = !picking; spotPick = false; totalSay(); spotSay(); return; }
    if (e.target.closest('[data-nototal]')) { Q.total = null; totalSay(); overlays(); return; }
    if (e.target.closest('[data-qgoals]')) { goalsDlg().then(() => { if (pagesEl.isConnected) list(); }); return; }
    if (e.target.closest('[data-save]')) {
      for (const q of Q.qs) if (!(+q.pts > 0)) q.pts = 1;
      for (const t of Object.keys(Q.words)) if (Q.words[t].length !== qzSteps(+t).length) delete Q.words[t];
      if (Object.keys(Q.words).length) store.set('gs.qmWords', { ...qzWordsMine(), ...Q.words }); else delete Q.words;   // her words start her next quiz too
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
    if (!selId || e.target.closest('input,select,textarea')) return;
    const q = qOf(selId); if (!q) return;
    const k = e.key, step = 0.002;
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); Q.qs = Q.qs.filter(x => x.id !== selId); selId = null; list(); overlays(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === 'd' || k === 'D')) {
      e.preventDefault();
      const y = R(clamp(q.y + q.h + 0.01, 0, 1 - q.h)), c = { ...q, id: uid(), lab: '', y };
      if (q.mx != null) c.my = R(clamp(q.my + y - q.y, 0, 1));
      Q.qs.splice(Q.qs.indexOf(q) + 1, 0, c); return pick(c.id);
    }
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (!mv) return;
    e.preventDefault();
    if (e.shiftKey) { q.w = R(clamp(q.w + mv[0] * step, 0.02, 1 - q.x)); q.h = R(clamp(q.h + mv[1] * step, 0.01, 1 - q.y)); }
    else {
      const x = R(clamp(q.x + mv[0] * step, 0, 1 - q.w)), y = R(clamp(q.y + mv[1] * step, 0, 1 - q.h));
      if (q.mx != null) { q.mx = R(clamp(q.mx + x - q.x, 0, 1)); q.my = R(clamp(q.my + y - q.y, 0, 1)); }
      q.x = x; q.y = y;
    }
    overlays();
  };
  $('#qbWho').onchange = e => { si = +e.target.value; draw(); };
  sideSay(); totalSay(); list(); draw();
}

/* marking */
let qzView = 'q', qzAt = 0, qzStu = 0, qzKeys = null, qzOnly = false, qzUndo = [];
// How big each answer shows: S, M, L or F (full width, one to a row). Kept on this computer, so a laptop and a big screen each keep their own.
const QZ_SIZES = ['S', 'M', 'L', 'F'], QZ_SIZE_SAY = { S: 'S', M: 'M', L: 'L', F: 'Full width' };
const qzSizeNow = () => { const s = store.get('gs.qmSize', null); return QZ_SIZES.includes(s) ? s : window.innerWidth < 900 ? 'F' : 'L'; };
function openQuiz(view) {
  if (!batch) return;
  if (!quizOn()) return openQuizBoxes();
  if (view) qzView = view;
  qzAt = clamp(qzAt, 0, batch.quiz.qs.length - 1);
  const who = quizWho();
  if (!who.length) return toast('No scanned papers to mark');
  if (!who.includes(qzStu)) qzStu = who[0];
  qzUndo = [];
  openDlg('<div class="bh qmhd"><h2>Quick mark</h2><span class="seg" id="qmView"><button data-view="q">By question</button><button data-view="s">By student</button></span>' +
    '<span id="qmNav" class="qmnav"></span><span class="muted hsm" id="qmProg"></span>' +
    '<span class="qmopts"><span class="muted hsm">Size</span><span class="seg" id="qmSize">' + QZ_SIZES.map(s => '<button data-size="' + s + '" title="' + (s === 'F' ? 'One answer per row' : 'Answer size ' + s) + '">' + QZ_SIZE_SAY[s] + '</button>').join('') + '</span>' +
    '<span class="seg" id="qmOnly"><button data-only="0">All</button><button data-only="1">Not marked</button></span>' +
    '<span class="qmink"><button class="btn sm" id="qmInkBtn" data-inkmenu aria-haspopup="true" aria-expanded="false" title="Colors for the marks">Colors <i class="qmdot x"></i><i class="qmdot ok"></i></button>' +
    '<span class="qminkpop" id="qmInkPop" hidden></span></span></span>' +
    '<button class="btn sm" data-boxes>Boxes</button><button class="icon" data-close aria-label="Close">✕</button></div>' +
    '<div class="bb qmbody" id="qmBody"></div>' +
    '<div class="bf qmfoot"><span class="muted hsm" id="qmHint" style="margin-right:auto"></span><span id="qmFoot"></span></div>');
  $('#dlgBox').classList.add('spbox');
  const box = $('#dlgBox');
  box.oninput = box.onkeydown = null;
  if (box._qbFocus) { box.removeEventListener('focusin', box._qbFocus); box._qbFocus = null; }
  box.onclick = e => {
    if (e.target.closest('#qmPeek')) { if (e.target.closest('[data-peekx]') || e.target.id === 'qmPeek') qmPeekClose(); return; }
    if (e.target.closest('[data-close]')) return qmClose();
    const ik = e.target.closest('[data-qink]'); if (ik) { inkColor = ik.dataset.qink; store.set('gs.ink', inkColor); renderTools(); return qmInkSet(); }
    const ic = e.target.closest('[data-qchk]'); if (ic) { setCheckInk(ic.dataset.qchk); renderTools(); return qmInkSet(); }
    if (e.target.closest('[data-inkmenu]')) return qmInkMenu();
    if (!e.target.closest('#qmInkPop')) qmInkMenu(false);
    if (e.target.closest('[data-boxes]')) return openQuizBoxes(() => openQuiz());
    const v = e.target.closest('[data-view]'); if (v) { qzView = v.dataset.view; return qmRender(); }
    const sz = e.target.closest('[data-size]'); if (sz) { store.set('gs.qmSize', sz.dataset.size); return qmSizeSay(); }
    const on = e.target.closest('[data-only]'); if (on) { qzOnly = on.dataset.only === '1'; return qmRender(); }
    const mv = e.target.closest('[data-qgo]'); if (mv) { qmGo(+mv.dataset.qgo); return; }
    const op = e.target.closest('[data-open]'); if (op) { qmClose(); return openStudent(+op.dataset.open); }
    const pk = e.target.closest('[data-peek]'); if (pk) return qmPeek(pk.closest('.qmc'));
    const rs = e.target.closest('[data-reset]'); if (rs) return qmSpotSet(rs.closest('.qmc'), null);
    if (e.target.closest('[data-rest]')) return qmRest();
    const as = e.target.closest('.qmned [data-as]'); if (as) { for (const b of as.parentNode.children) b.setAttribute('aria-pressed', String(b === as)); as.closest('.qmned').querySelector('textarea').focus(); return; }
    const nc = e.target.closest('.qmned [data-qnc]');
    if (nc) { const ed = nc.closest('.qmned'), v = COLORS[nc.dataset.qnc]; ed.dataset.col = v; ed.querySelector('textarea').style.color = v; for (const b of ed.querySelectorAll('[data-qnc]')) b.setAttribute('aria-pressed', String(b === nc)); ed.querySelector('textarea').focus(); return; }
    if (e.target.closest('[data-nsave]')) return qmNoteDone(e.target.closest('.qmc'), true);
    if (e.target.closest('.qmned')) return;
    const qn = e.target.closest('[data-qnote]'); if (qn) return qmNoteOpen(qn.closest('.qmc'));
    const hf = e.target.closest('[data-half]'); if (hf) return qmHalf(hf.closest('.qmc'));
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
// Colors: one for ✗ and points (the same ink as her pen), one for ✓. Marks already given on this quiz change with them.
function qmInkSay() {
  const body = $('#qmBody'), btn = $('#qmInkBtn');
  for (const el of [body, btn]) if (el) { el.style.setProperty('--qm-x', COLORS[inkColor] || COLORS.red); el.style.setProperty('--qm-ok', CHECK_INK); }
  const pop = $('#qmInkPop'); if (!pop || pop.hidden) return;
  const row = (attr, on, say) => '<div class="qmirow"><span class="hsm">' + say + '</span>' + Object.entries(COLORS).map(([k, v]) => '<button class="sw" data-' + attr + '="' + k + '" style="background:' + v + '" aria-pressed="' + (k === on) + '" title="' + k + '" aria-label="' + say + ' ' + k + '"></button>').join('') + '</div>';
  pop.innerHTML = row('qink', inkColor, '✗ and points') + row('qchk', checkInk, '✓ right') + '<p class="muted hsm">Marks already given change too.</p>';
}
function qmInkMenu(open) {
  const pop = $('#qmInkPop'), btn = $('#qmInkBtn'); if (!pop) return;
  const on = open == null ? pop.hidden : open;
  if (on === !pop.hidden) return;
  pop.hidden = !on; btn.setAttribute('aria-expanded', String(on)); qmInkSay();
}
function qmInkSet() {
  for (const st of batch.students) for (const f of st.files || []) for (const list of Object.values(f.marks || {})) for (const m of list) {
    if (!m.qz && !m.qzn) continue;
    m.color = m.t === 'check' ? CHECK_INK : COLORS[inkColor] || COLORS.red;
  }
  saveSoon(); qmInkSay();
}
function qmSizeSay() {
  const s = qzSizeNow(), body = $('#qmBody');
  for (const b of $('#qmSize').children) b.setAttribute('aria-pressed', String(b.dataset.size === s));
  if (body) { for (const z of QZ_SIZES) body.classList.toggle('qmz-' + z, z === s); }
}
// The mark as it will look on the paper, drawn over the answer at its spot. With nothing to show, a faint circle marks the spot.
function qmMarkEl(q, v) {
  const look = qzLook(q, v);
  if (!look) return '<span class="qmmk pin" title="Where the mark goes on this paper. Drag to move it on this paper only."></span>';
  return '<span class="qmmk' + (look.k === 'text' ? ' txt' : look.k === 'check' ? ' ok' : '') + '" title="Drag to move this mark on this paper only">' + (look.k === 'check' ? '✓' : look.k === 'x' ? '✗' : esc(look.text)) + '</span>';
}
const qmCard = (i, q, qi) => {
  const st = batch.students[i], v = quizMarks(st)[q.id], pts = +q.pts || 1;
  const state = v == null ? '' : v >= pts ? ' right' : v <= 0 ? ' wrong' : ' some';
  let btns;
  if (!qzByPts(q)) btns = '<button class="qmb no" data-v="0" aria-pressed="' + (v === 0) + '" title="Wrong (0)">✗</button><button class="qmb ok" data-v="' + pts + '" aria-pressed="' + (v === pts) + '" title="Right (' + fmtNum(pts) + ')">✓</button>';
  else {
    const steps = qzSteps(pts), words = qzStepWords(pts);
    const half = v != null && v % 1 !== 0 && !steps.includes(v);
    btns = steps.map((s, k) => '<button class="qmb' + (s >= pts ? ' ok' : s <= 0 ? ' no' : '') + (words[k] ? ' w' : '') + '" data-v="' + s + '" aria-pressed="' + (v != null && (v === s || (half && Math.floor(v) === s && s !== pts))) + '"' + (words[k] ? ' title="' + esc(fmtNum(s) + ': ' + words[k]) + '"' : '') + '>' + fmtNum(s) + (words[k] ? '<small>' + esc(words[k]) + '</small>' : '') + '</button>').join('') +
      '<button class="qmb half" data-half aria-pressed="' + half + '" title="Add or take off half a point (H)">+½</button>';
  }
  const head = qzView === 'q' ? '<button class="link" data-open="' + i + '" title="Open their paper">' + esc(shownName(st, i)) + '</button>'
    : '<b>' + esc(quizLabel(q, qi)) + '</b>' + (q.key ? '<span class="qmkey">' + esc(q.key) + '</span>' : '') + '<span class="muted">' + fmtNum(pts) + (pts === 1 ? ' pt' : ' pts') + '</span>';
  const tag = v != null && qzByPts(q) ? '<span class="qmchip">' + fmtNum(v) + ' of ' + fmtNum(pts) + '</span>' : '';
  return '<div class="qmc' + state + '" tabindex="0" data-st="' + i + '" data-q="' + q.id + '"><div class="qmch">' + head + tag +
    '<span class="qmchr">' + (qzOwn(st, q) ? '<button class="link hsm" data-reset title="Put this mark back where the question’s mark goes">Reset spot</button>' : '') +
    '<button class="btn sm" data-peek title="See their whole page (Space)">⤢ Whole page</button></span></div>' +
    '<div class="qmimg" title="' + (qzByPts(q) && qzHow(q) === 'pts' ? 'Drag: line this paper up' : 'Click: wrong / right. Drag: line this paper up') + '"><span class="muted hsm">…</span></div>' +
    '<div class="qmbtns">' + btns + '<button class="qmb cm" data-qnote title="Write a comment or text on this paper (C)">Comment</button>' + (v != null ? '<button class="qmb clr" data-v="" title="Clear">Clear</button>' : '') + '</div>' + qmNoteLine(st, q) + '</div>';
};
// Her own words for this question on this paper: a comment in the margin with a line to the answer, or text on the page under it.
// Tagged qzn (not qz), so marking the question again leaves them alone.
function qzNoteOf(st, q) {
  const [path, p] = quizPages(st)[q.n] || [], f = path && fileByPath(st, path), l = f && f.marks[p];
  return (l && l.find(m => m.qzn === q.id)) || null;
}
const qmNoteLine = (st, q) => { const m = qzNoteOf(st, q); return m ? '<button class="qmnote" data-qnote title="Click to change it">' + (m.t === 'note' ? 'Comment: ' : 'Text: ') + esc(m.text) + '</button>' : ''; };
function qmNoteOpen(el) {
  if (!el || el.querySelector('.qmned')) return;
  const st = batch.students[+el.dataset.st], q = batch.quiz.qs.find(x => x.id === el.dataset.q), m = qzNoteOf(st, q);
  const as = m ? (m.t === 'note' ? 'note' : 'text') : store.get('gs.qmNoteAs', 'note');
  const ln = el.querySelector('.qmnote'); if (ln) ln.hidden = true;
  const col = (m && m.color) || COLORS[inkColor] || COLORS.red;   // its color can change while she types, before it is saved
  el.insertAdjacentHTML('beforeend', '<div class="qmned" data-col="' + col + '"><textarea rows="2" placeholder="Type what to write on their paper…" aria-label="Comment" style="color:' + col + '">' + esc(m ? m.text : '') + '</textarea>' +
    '<div class="qmnedc"><span class="muted hsm">Color</span>' + Object.entries(COLORS).map(([k, v]) => '<button type="button" class="sw" data-qnc="' + k + '" style="background:' + v + '" aria-pressed="' + (v === col) + '" title="' + k + '" aria-label="Comment in ' + k + '"></button>').join('') + '</div>' +
    '<div class="qmnedb"><span class="seg sm"><button data-as="note" aria-pressed="' + (as === 'note') + '" title="In the margin, with a line to the answer">Margin comment</button><button data-as="text" aria-pressed="' + (as === 'text') + '" title="Written on the page under the answer">Text on page</button></span>' +
    '<span class="muted hsm">Enter to save, Esc to cancel</span><button class="btn sm primary" data-nsave>Save</button></div></div>');
  const ta = el.querySelector('.qmned textarea'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
}
function qmNoteDone(el, save) {
  const ed = el && el.querySelector('.qmned'); if (!ed) return;
  const text = ed.querySelector('textarea').value.trim(), as = ed.querySelector('[data-as][aria-pressed="true"]').dataset.as, col = ed.dataset.col;
  ed.remove();
  if (save) qzNoteSet(batch.students[+el.dataset.st], batch.quiz.qs.find(x => x.id === el.dataset.q), text, as, col).then(() => { if (el.isConnected) { qmRefresh(el); el.focus({ preventScroll: true }); } });
  else { const ln = el.querySelector('.qmnote'); if (ln) ln.hidden = false; el.focus({ preventScroll: true }); }
}
async function qzNoteSet(st, q, text, as, col) {
  const [path, p] = quizPages(st)[q.n] || [], f = path && fileByPath(st, path);
  if (!f) return;
  const list = (f.marks[p] ||= []), i = list.findIndex(m => m.qzn === q.id), old = i >= 0 ? list[i] : null;
  if (i >= 0) list.splice(i, 1);
  if (text) {
    const sz = await qzPageSize(st, q.n); if (!sz) return;
    store.set('gs.qmNoteAs', as);
    const [dx, dy] = qzShift(st, q.n), W = sz.W, H = sz.H, color = col || COLORS[inkColor] || COLORS.red;
    let m;
    if (as === 'note') m = old && old.t === 'note' ? { ...old, text, color } : { t: 'note', color, ax: r1(clamp((q.x + q.w + dx) * W, 4, W - 4)), ay: r1(clamp((q.y + q.h / 2 + dy) * H, 4, H - 4)), text, qzn: q.id };
    else {
      m = old && old.t === 'text' ? { ...old, text, color } : { t: 'text', color, x: r1(clamp((q.x + dx) * W, 2, W - 60)), y: r1(clamp((q.y + q.h + dy) * H + 3, 2, H - 20)), size: disp.tsize, bw: r1(Math.max(120, q.w * W)), text, qzn: q.id };
      keepOnPage(m, W, H);
    }
    list.push(m);
  }
  if (!list.length) delete f.marks[p];
  saveSoon(); renderList();
}
const qmQ = q => (qzByPts(q) ? 'Scale 0 to ' + fmtNum(+q.pts || 1) : fmtNum(+q.pts || 1) + ((+q.pts || 1) === 1 ? ' point' : ' points') + ', right or wrong') + ' · ' + (QZ_HOW[q.how] || QZ_HOW.cx);
let qmTok = 0;
function qmRender() {
  const body = $('#qmBody'); if (!body) return;
  const qs = batch.quiz.qs, who = quizWho(), my = ++qmTok;
  for (const b of $('#qmView').children) b.setAttribute('aria-pressed', String(b.dataset.view === qzView));
  for (const b of $('#qmOnly').children) b.setAttribute('aria-pressed', String((b.dataset.only === '1') === qzOnly));
  let cards;
  if (qzView === 'q') {
    const q = qs[qzAt], done = who.filter(i => quizMarks(batch.students[i])[q.id] != null).length, full = +q.pts || 1;
    $('#qmNav').innerHTML = '<button class="btn sm" data-qgo="-1" aria-label="Earlier question"' + (qzAt ? '' : ' disabled') + '>‹</button><select id="qmPick" class="btn sm" aria-label="Question">' +
      qs.map((x, i) => '<option value="' + i + '"' + (i === qzAt ? ' selected' : '') + '>Question ' + esc(quizLabel(x, i)) + '</option>').join('') + '</select>' +
      '<button class="btn sm" data-qgo="1" aria-label="Next question"' + (qzAt < qs.length - 1 ? '' : ' disabled') + '>›</button>' +
      (q.key ? '<span class="qmkey big" title="The right answer">' + esc(q.key) + '</span>' : '') + '<span class="muted hsm">' + qmQ(q) + '</span>';
    $('#qmProg').textContent = done + ' of ' + who.length + ' marked';
    $('#qmFoot').innerHTML = '<button class="btn primary" data-rest' + (done === who.length ? ' disabled' : '') + '>' + (qzByPts(q) ? 'Give the rest ' + fmtNum(full) : 'Mark the rest right') + '</button>';
    $('#qmHint').textContent = (qzByPts(q) ? 'Keys: a number for its points, H adds ½' : 'Click an answer to put an ✗ on it, click again to take it off. Keys: 1 right, 0 or X wrong') +
      ', C comment, arrows to move, Space whole page, Ctrl Z undo, [ and ] for the question. Drag a mark to move it on that paper.';
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
    $('#qmHint').textContent = 'Click an answer to put an ✗ on it, click again to take it off. Keys: ↑ ↓ to move, a number for its points, C comment, Space whole page, Ctrl Z undo, [ and ] for the student.';
    cards = qs.map((q, qi) => [qzStu, q, qi]);
    body.className = 'bb qmbody qmcol';
  }
  if (qzOnly) cards = cards.filter(([i, q]) => quizMarks(batch.students[i])[q.id] == null);
  qmSizeSay(); qmInkSay();
  const keep = document.activeElement && document.activeElement.closest && document.activeElement.closest('.qmc');
  const keepAt = keep ? keep.dataset.st + '|' + keep.dataset.q : null;
  body.innerHTML = cards.length ? cards.map(c => qmCard(...c)).join('') : '<p class="muted qmnone">Everything here is marked. Pick <b>All</b> to see the marked ones.</p>';
  if (keepAt) { const el = body.querySelector('.qmc[data-st="' + keepAt.split('|')[0] + '"][data-q="' + keepAt.split('|')[1] + '"]'); if (el) el.focus({ preventScroll: true }); }
  qmBindDrag(body);
  (async () => {
    for (const el of body.querySelectorAll('.qmc')) {
      const st = batch.students[+el.dataset.st], q = batch.quiz.qs.find(x => x.id === el.dataset.q);
      const c = await qzCrop(st, q);
      if (my !== qmTok || !el.isConnected) return;
      qmPic(el, c);
    }
  })();
}
function qmPic(el, c) {
  const spot = el.querySelector('.qmimg');
  if (!c) { spot.innerHTML = '<span class="muted hsm">This page isn’t in their scan.</span>'; return; }
  spot.innerHTML = '<img alt="" draggable="false" src="' + c.url + '">';
  spot._r = c.r;
  qmMarkShow(el);
}
// The mark over the answer, at its spot within the picture.
function qmMarkShow(el) {
  const spot = el.querySelector('.qmimg'), r = spot && spot._r; if (!r || !spot.querySelector('img')) return;
  const st = batch.students[+el.dataset.st], q = batch.quiz.qs.find(x => x.id === el.dataset.q), s = qzSpot(st, q);
  const old = spot.querySelector('.qmmk'); if (old) old.remove();
  spot.insertAdjacentHTML('beforeend', qmMarkEl(q, quizMarks(st)[q.id]));
  // Sized like the mark on the paper: a share of the picture's width, so it grows and shrinks with the answer.
  const mk = spot.querySelector('.qmmk'), W = qzSz(st, q.n).W * r.w, pt = mk.classList.contains('pin') ? 22 : mk.classList.contains('txt') ? 15 : 24;
  Object.assign(mk.style, { left: (s.x - r.x) / r.w * 100 + '%', top: (s.y - r.y) / r.h * 100 + '%', fontSize: 'max(13px, ' + (pt / W * 100).toFixed(2) + 'cqw)' });
  if (mk.classList.contains('pin')) mk.style.width = mk.style.height = '1em';
  if (mk.classList.contains('txt') && s.margin) {   // in the margin, text sits beside the box, as on the paper
    const PW = qzSz(st, q.n).W, x = s.right ? s.x - 11 / PW : q.x + qzShift(st, q.n)[0] - 6 / PW;
    Object.assign(mk.style, { left: (x - r.x) / r.w * 100 + '%', transform: s.right ? 'translate(0,-50%)' : 'translate(-100%,-50%)' });
  }
}
// One card changed: its look, its buttons and the counts, without drawing the rest again.
function qmRefresh(el) {
  const i = +el.dataset.st, q = batch.quiz.qs.find(x => x.id === el.dataset.q), qi = batch.quiz.qs.indexOf(q);
  const tmp = document.createElement('div'); tmp.innerHTML = qmCard(i, q, qi);
  const fresh = tmp.firstChild;
  el.className = fresh.className;
  el.querySelector('.qmch').replaceWith(fresh.querySelector('.qmch'));
  el.querySelector('.qmbtns').replaceWith(fresh.querySelector('.qmbtns'));
  const nl = el.querySelector('.qmnote'), fl = fresh.querySelector('.qmnote');
  if (!el.querySelector('.qmned')) { if (nl) nl.remove(); if (fl) el.querySelector('.qmbtns').after(fl); }
  qmMarkShow(el);
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
// rec: where the mark's undo goes. Left out, it is its own step.
async function qmMark(el, v, keepFocus, rec) {
  if (!el) return;
  const st = batch.students[+el.dataset.st], q = batch.quiz.qs.find(x => x.id === el.dataset.q);
  if (!st || !q) return;
  const pts = +q.pts || 1, was = quizMarks(st)[q.id];
  if (v != null) v = Math.round(clamp(v, 0, pts) * 2) / 2;
  if (v !== was && !(v == null && was == null)) {
    const step = { st, q, was };
    if (rec) rec.push(step); else { qzUndo.push([step]); if (qzUndo.length > 200) qzUndo.shift(); }
    await quizSet(st, q, v);
  }
  if (el.isConnected) qmRefresh(el);
  if (!keepFocus) { const nx = el.nextElementSibling; if (nx && nx.classList.contains('qmc')) nx.focus(); }
}
// +½: half a point on, or off again. With nothing given yet, it gives ½.
function qmHalf(el) {
  if (!el) return;
  const st = batch.students[+el.dataset.st], q = batch.quiz.qs.find(x => x.id === el.dataset.q), v = quizMarks(st)[q.id], pts = +q.pts || 1;
  let n = v == null ? 0.5 : v % 1 ? Math.floor(v) : v + 0.5;
  if (n > pts) n = pts - 0.5;
  return qmMark(el, n, true);
}
async function qmRest() {
  const body = $('#qmBody'); if (!body) return;
  const rec = [];
  for (const el of body.querySelectorAll('.qmc')) {
    const st = batch.students[+el.dataset.st], q = batch.quiz.qs.find(x => x.id === el.dataset.q);
    if (quizMarks(st)[q.id] == null) await qmMark(el, +q.pts || 1, true, rec);
  }
  if (rec.length) qzUndo.push(rec);
}
// Ctrl Z: the last mark given here, or all of the last "Mark the rest", taken back.
async function qmUndoLast() {
  const g = qzUndo.pop();
  if (!g) return toast('Nothing to undo');
  for (const s of g.slice().reverse()) if (batch.students.includes(s.st) && batch.quiz.qs.includes(s.q)) await quizSet(s.st, s.q, s.was == null ? null : s.was);
  qmRender();
}
// A mark moved on one paper only (or put back, with at null). at is the mark's middle, as shares of their page.
async function qmSpotSet(el, at) {
  if (!el) return;
  const st = batch.students[+el.dataset.st], q = batch.quiz.qs.find(x => x.id === el.dataset.q);
  const sp = ((batch.quiz.spot ||= {})[st.key] ||= {});
  if (at) { const [dx, dy] = qzShift(st, q.n), R = v => Math.round(v * 10000) / 10000; sp[q.id] = [R(clamp(at[0], 0, 1) - dx), R(clamp(at[1], 0, 1) - dy)]; }
  else { delete sp[q.id]; if (!Object.keys(sp).length) delete batch.quiz.spot[st.key]; }
  const v = quizMarks(st)[q.id];
  if (v != null) await qzPaper(st, q, v);
  saveSoon();
  if (batch.students[cur] === st) redrawAll();
  if (!el.isConnected) return;
  qmRefresh(el);
  qmPic(el, await qzCrop(st, q));
}
function qmGo(d) {
  if (qzView === 'q') qzAt = clamp(qzAt + d, 0, batch.quiz.qs.length - 1);
  else { const who = quizWho(), k = who.indexOf(qzStu); qzStu = who[clamp(k + d, 0, who.length - 1)]; }
  qmRender();
  const first = $('#qmBody') && $('#qmBody').querySelector('.qmc'); if (first) first.focus({ preventScroll: true });
}
// The student's whole page, with the box and the mark's spot shown, for an answer that runs outside its box.
async function qmPeek(el) {
  if (!el) return;
  const st = batch.students[+el.dataset.st], q = batch.quiz.qs.find(x => x.id === el.dataset.q), qi = batch.quiz.qs.indexOf(q);
  qmPeekClose();
  const box = $('#dlgBox');
  box.insertAdjacentHTML('beforeend', '<div id="qmPeek" class="qmpeek" role="dialog" aria-label="Whole page"><div class="qmpkbar"><b>' + esc(shownName(st, +el.dataset.st)) + '</b><span class="muted hsm">Question ' + esc(quizLabel(q, qi)) + ', page ' + (q.n + 1) + '</span>' +
    '<button class="btn sm" data-peekx style="margin-left:auto">Back (Esc)</button></div><div class="qmpkpg"><span class="muted">Drawing the page…</span></div></div>');
  const back = el;
  $('#qmPeek')._back = back;
  let pg; try { pg = await qzPage(st, q.n, 1400); } catch (e) { console.error(e); }
  const pk = $('#qmPeek'); if (!pk) { if (pg) pg.c.width = 0; return; }
  const spot = pk.querySelector('.qmpkpg');
  if (!pg) { spot.innerHTML = '<span class="muted">This page isn’t in their scan.</span>'; return; }
  const L = lightForPage(st, pg.f, pg.p); if (L) lightCanvas(pg.c.getContext('2d'), pg.c.width, pg.c.height, L);
  const [dx, dy] = qzShift(st, q.n), s = qzSpot(st, q, { W: pg.W, H: pg.H });
  spot.innerHTML = '<div class="qmpkwrap"></div>';
  const w = spot.firstChild; pg.c.className = 'qmpkimg'; w.appendChild(pg.c);
  w.insertAdjacentHTML('beforeend', '<div class="qmpkbox" style="left:' + (q.x + dx) * 100 + '%;top:' + (q.y + dy) * 100 + '%;width:' + q.w * 100 + '%;height:' + q.h * 100 + '%"></div>' +
    '<div class="qmpkspot" style="left:' + s.x * 100 + '%;top:' + s.y * 100 + '%"></div>');
  const bx = w.querySelector('.qmpkbox'); if (bx) bx.scrollIntoView({ block: 'center' });
}
function qmPeekClose() {
  const pk = $('#qmPeek'); if (!pk) return false;
  const back = pk._back; pk.querySelectorAll('canvas').forEach(c => { c.width = 0; }); pk.remove();
  if (back && back.isConnected) back.focus({ preventScroll: true });
  return true;
}
function qmKey(e) {
  if (!$('#qmBody')) return;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  if ($('#qmPeek')) { if (e.key === 'Escape' || e.key === ' ') { stop(); qmPeekClose(); } return; }
  if (e.target.closest('.qmned')) {   // typing a comment: Enter saves, Shift Enter is a new line, Esc leaves it as it was
    if (e.key === 'Escape') { stop(); qmNoteDone(e.target.closest('.qmc'), false); }
    else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { stop(); qmNoteDone(e.target.closest('.qmc'), true); }
    else e.stopPropagation();
    return;
  }
  if (e.target.closest('select,input,textarea')) return;
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    if (e.key === 'z' || e.key === 'Z') { if (!e.shiftKey) { stop(); qmUndoLast(); } return; }
    const d = e.key === '=' || e.key === '+' ? 1 : e.key === '-' || e.key === '_' ? -1 : 0;
    if (d) { stop(); const k = QZ_SIZES.indexOf(qzSizeNow()); store.set('gs.qmSize', QZ_SIZES[clamp(k + d, 0, QZ_SIZES.length - 1)]); qmSizeSay(); }
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const el = e.target.closest && e.target.closest('.qmc');
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
  if (e.key === ' ') { stop(); return qmPeek(el); }
  const q = batch.quiz.qs.find(x => x.id === el.dataset.q), scale = !q || qzByPts(q);
  if ((e.key === 'h' || e.key === 'H' || e.key === '½') && scale) { stop(); return qmHalf(el); }
  if (/^[0-9]$/.test(e.key) && scale) { stop(); return qmMark(el, +e.key); }
  if ((e.key === '1' || e.key === '0') && !scale) { stop(); return qmMark(el, e.key === '1' ? +q.pts || 1 : 0); }   // right is all its points
  if (e.key === 'x' || e.key === 'X') { stop(); return qmMark(el, 0); }
  if (e.key === 'c' || e.key === 'C') { stop(); return qmNoteOpen(el); }
  if (e.key === 'Backspace' || e.key === 'Delete') { stop(); return qmMark(el, null, true); }
}
// On a picture: a click marks it wrong (or right again if it was wrong); a drag lines that paper's page up, moving every box on it.
// A drag on the mark itself moves the mark on that paper only.
function qmBindDrag(body) {
  let d = null;
  body.onpointerdown = e => {
    const spot = e.target.closest('.qmimg'); if (!spot || e.button !== 0) return;
    const img = spot.querySelector('img');   // a click marks even before the picture is in; a drag needs it
    e.preventDefault(); spot.setPointerCapture(e.pointerId);
    const mk = e.target.closest('.qmmk');
    d = { spot, img, mk, x0: e.clientX, y0: e.clientY, moved: false, el: spot.closest('.qmc') };
    if (mk) { const r = mk.getBoundingClientRect(); d.mx0 = r.left + r.width / 2; d.my0 = r.top + r.height / 2; }
    d.el.focus({ preventScroll: true });
  };
  body.onpointermove = e => {
    if (!d) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.img || (!d.moved && Math.hypot(dx, dy) < 5)) return;
    d.moved = true;
    if (d.mk) d.mk.style.translate = dx + 'px ' + dy + 'px'; else d.img.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  };
  body.onpointerup = async e => {
    if (!d) return;
    const g = d; d = null;
    const st = batch.students[+g.el.dataset.st], q = batch.quiz.qs.find(x => x.id === g.el.dataset.q);
    if (!g.moved) {
      if (qzHow(q) === 'pts' && qzByPts(q)) return;   // a points question is scored with its buttons or keys
      const v = quizMarks(st)[q.id];
      return qmMark(g.el, v != null && v <= 0 ? +q.pts || 1 : 0, true);
    }
    const r = g.spot._r, shown = g.img.getBoundingClientRect();
    if (g.mk) {
      const cx = g.mx0 + e.clientX - g.x0, cy = g.my0 + e.clientY - g.y0;
      return qmSpotSet(g.el, [r.x + (cx - shown.left) / (shown.width || 1) * r.w, r.y + (cy - shown.top) / (shown.height || 1) * r.h]);
    }
    const fx = -(e.clientX - g.x0) / (shown.width || 1) * r.w, fy = -(e.clientY - g.y0) / (shown.height || 1) * r.h;
    const sh = ((batch.quiz.shift ||= {})[st.key] ||= {}), [ox, oy] = sh[q.n] || [0, 0], R = v => Math.round(v * 10000) / 10000;
    sh[q.n] = [R(clamp(ox + fx, -0.3, 0.3)), R(clamp(oy + fy, -0.3, 0.3))];
    await qzRedoPaper(st);
    saveSoon();
    if (batch.students[cur] === st) redrawAll();
    const c = await qzCrop(st, q);
    g.img.style.transform = '';
    if (g.el.isConnected) qmPic(g.el, c);
    for (const el of body.querySelectorAll('.qmc[data-st="' + g.el.dataset.st + '"]')) if (el !== g.el) { const q2 = batch.quiz.qs.find(x => x.id === el.dataset.q); if (q2.n === q.n) qzCrop(st, q2).then(u => el.isConnected && qmPic(el, u)); }
  };
}

/* the button */
function quizBtn() {
  const b = $('#quizTop'); if (b) b.hidden = !quizOn();
}
$('#quizBtn').onclick = () => openQuiz();
$('#quizTop').onclick = () => openQuiz();
Object.assign(window.__gs, { openQuiz, openQuizBoxes, quizSet, quizSum, quizCount, quizPart, quizMax, quizOn, qzCrop, qzRect, qzSpot, quizBtn });
