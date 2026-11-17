/* ---------------- Make a quiz, read back: the code on each page and the bubbles filled in ---------------- */
// A printed page (src/quizmake.js) is 816 by 1056 CSS px, with a black square 19 px wide 53 px in from each corner and a row of
// 28 squares at the top: two guards (black, white), then the quiz, the student (their number in made.names, 0 for a blank copy),
// the page, the printing (made.ver) and a check. The four squares fix where everything else is, through a homography, so a
// scan that is crooked, shrunk to fit or upside down still reads. A bubble's darkness is weighed against the other bubbles on
// that student's pages, so pencil, pen, a pale scanner and a dark one all work. Anything not clear goes to her, never guessed.
const QR_REG = [[62.5, 62.5], [753.5, 62.5], [753.5, 993.5], [62.5, 993.5]];   // the squares' centres: top left, top right, bottom right, bottom left
function qrGrey(c) {
  const W = c.width, H = c.height, d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data, g = new Uint8Array(W * H), hist = new Uint32Array(256);
  for (let i = 0; i < W * H; i++) { const v = (d[4 * i] * 77 + d[4 * i + 1] * 150 + d[4 * i + 2] * 29) >> 8; g[i] = v; hist[v]++; }
  let k = 0, P = 255; for (let v = 0; v < 256; v++) { k += hist[v]; if (k >= W * H * .9) { P = v; break; } }   // the paper: lighter than nearly everything
  return { g, W, H, P: Math.max(P, 60) };
}
// The four squares, as points in the picture: top left, top right, bottom right, bottom left of the picture. null: not a quiz page.
function qrFind(im) {
  const { g, W, H, P } = im, cut = Math.min(140, P * .6), I = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += g[y * W + x] < cut ? 1 : 0; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row; } }
  const sum = (x0, y0, x1, y1) => { x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1); return x1 <= x0 || y1 <= y0 ? 0 : I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]; };
  const s = Math.min(W, H) / 816, a = 19 * s, reach = Math.round(.2 * Math.min(W, H));
  const corner = (cx, cy) => {
    let best = null;
    for (const k of [.88, 1, 1.12]) {
      const b = Math.max(4, Math.round(a * k)), m = Math.max(2, Math.round(b / 3)), ringA = (b + 2 * m) ** 2 - b * b;
      const xs = cx ? W - reach : 0, ys = cy ? H - reach : 0;
      for (let y = ys; y + b <= ys + reach; y++) for (let x = xs; x + b <= xs + reach; x++) {
        const inn = sum(x, y, x + b, y + b); if (inn < b * b * .8) continue;
        const ring = sum(x - m, y - m, x + b + m, y + b + m) - inn; if (ring > ringA * .2) continue;
        const score = inn / (b * b) - 2 * ring / ringA;
        if (!best || score > best.score) best = { score, x, y, b };
      }
    }
    if (!best) return null;
    let n = 0, sx = 0, sy = 0; const { x, y, b } = best;
    for (let v = Math.max(0, y - 3); v < Math.min(H, y + b + 3); v++) for (let u = Math.max(0, x - 3); u < Math.min(W, x + b + 3); u++) if (g[v * W + u] < cut) { n++; sx += u; sy += v; }
    return n ? [sx / n + .5, sy / n + .5] : null;
  };
  const p = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)], miss = p.filter(x => !x).length;
  if (miss > 1) return null;
  if (miss === 1) { const k = p.findIndex(x => !x), A = p[(k + 3) % 4], B = p[(k + 1) % 4], C = p[(k + 2) % 4]; p[k] = [A[0] + B[0] - C[0], A[1] + B[1] - C[1]]; }
  const d = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]), top = d(p[0], p[1]), bot = d(p[3], p[2]), lef = d(p[0], p[3]), rig = d(p[1], p[2]);
  if (Math.abs(top - bot) > .04 * top || Math.abs(lef - rig) > .04 * lef) return null;
  const ar = top / lef, want = 691 / 931;
  if (Math.abs(ar - want) > .06 * want && Math.abs(ar - 1 / want) > .06 / want) return null;
  return { p, weak: miss === 1 };
}
// The homography that takes four points to four others (page CSS px to picture px).
function qrH(src, dst) {
  const A = [];
  for (let k = 0; k < 4; k++) { const [x, y] = src[k], [u, v] = dst[k]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]); }
  for (let c = 0; c < 8; c++) {
    let r = c; for (let i = c + 1; i < 8; i++) if (Math.abs(A[i][c]) > Math.abs(A[r][c])) r = i;
    [A[c], A[r]] = [A[r], A[c]]; const pv = A[c][c]; if (Math.abs(pv) < 1e-12) return null;
    for (let j = c; j < 9; j++) A[c][j] /= pv;
    for (let i = 0; i < 8; i++) if (i !== c && A[i][c]) { const f = A[i][c]; for (let j = c; j < 9; j++) A[i][j] -= f * A[c][j]; }
  }
  const h = A.map(r => r[8]);
  return (x, y) => { const w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };
}
// Mean grey in a disc of radius r (picture px) around a point.
function qrMean(im, x, y, r) {
  const { g, W, H } = im; let n = 0, t = 0, r2 = r * r;
  for (let v = Math.max(0, Math.floor(y - r)); v <= Math.min(H - 1, Math.ceil(y + r)); v++) for (let u = Math.max(0, Math.floor(x - r)); u <= Math.min(W - 1, Math.ceil(x + r)); u++) if ((u - x) ** 2 + (v - y) ** 2 <= r2) { n++; t += g[v * W + u]; }
  return n ? t / n : 255;
}
// Share of dark pixels in a ring from r0 to r1: a stroke crossing a bubble out leaves it, a filled bubble doesn't.
function qrRing(im, x, y, r0, r1) {
  const { g, W, H, P } = im, cut = P * .6; let n = 0, k = 0;
  for (let v = Math.max(0, Math.floor(y - r1)); v <= Math.min(H - 1, Math.ceil(y + r1)); v++) for (let u = Math.max(0, Math.floor(x - r1)); u <= Math.min(W - 1, Math.ceil(x + r1)); u++) { const d2 = (u - x) ** 2 + (v - y) ** 2; if (d2 < r0 * r0 || d2 > r1 * r1) continue; n++; if (g[v * W + u] < cut) k++; }
  return n ? k / n : 0;
}
// The code on a page, read through each way the page could be turned. { id, who, pg, ver, map, s, turn } or null.
function qrCode(im, found) {
  for (const t of [0, 2, 1, 3]) {
    const dst = [0, 1, 2, 3].map(k => found.p[(k + t) % 4]), map = qrH(QR_REG, dst); if (!map) continue;
    const a = map(...QR_REG[0]), b = map(...QR_REG[1]), s = Math.hypot(a[0] - b[0], a[1] - b[1]) / 691;
    const cell = k => qrMean(im, ...map(192 + 16 * k, 62), 3 * s), B = cell(0), Wt = cell(1);
    if (Wt - B < 40) continue;
    const bits = []; for (let k = 2; k < 28; k++) bits.push(cell(k) < (B + Wt) / 2 ? 1 : 0);
    const num = (i, n) => bits.slice(i, i + n).reduce((v, x) => v * 2 + x, 0);
    const id = num(0, 8), who = num(8, 8), pg = num(16, 3), ver = num(19, 2), chk = num(21, 5);
    if ((id + who + pg + ver) % 31 === chk) return { id, who, pg, ver, map, s, turn: t };
  }
  return null;
}
// One page of a scan, drawn small enough to be quick: what its code says, or null.
async function qrPageCode(page, wide = 900) {
  const v1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: wide / Math.min(v1.width, v1.height) });
  const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const im = qrGrey(c), f = qrFind(im), code = f && qrCode(im, f);
  c.width = c.height = 0;
  return code;
}
// In the split: pages with this quiz's code go to their student by themselves, turned the right way up, in page order.
async function qrSplitPage(me, i, page) {
  const made = (me.asg && me.asg.quiz && me.asg.quiz.made) || (me.into && batch && batch.quiz && batch.quiz.made); if (!made || !made.names) return;
  let code = null; try { code = await qrPageCode(page); } catch { }
  if (!code || code.id !== made.id) return;
  (me.qpg ||= {})[i] = code.pg;
  me.qnew ||= 0;
  if (code.turn === 2) { me.rot[i] = 180; if (me.sc[i]) me.sc[i].didTurn = 180; } else if (!code.turn && me.sc[i] && me.sc[i].didTurn) { delete me.rot[i]; me.sc[i].didTurn = 0; }   // the code says which way is up; a page on its side is left to the usual turning
  const nm = code.who ? made.names[code.who - 1] : '';
  if (nm && !me.owner[i] && !me.skip.has(i)) {
    const own = me.names.find(x => x === nm) || me.names.find(x => normName(x) === normName(nm));
    if (own) { me.owner[i] = own; me.qnew++; }
  }
}
// The split's line about the codes it read.
function qrSplitSays(me) {
  if (!me.qpg) return '';
  const got = Object.keys(me.qpg).length, who = new Set(Object.keys(me.qpg).map(i => me.owner[i]).filter(Boolean)).size, left = Object.keys(me.qpg).filter(i => !me.owner[i]).length;
  return got + (got === 1 ? ' page' : ' pages') + ' of this quiz: ' + who + (who === 1 ? ' student' : ' students') + ' found by the code' + (left ? ', ' + left + (left === 1 ? ' page needs a name' : ' pages need a name') : '');
}

/* reading the bubbles once the papers are open */
// Every bubble on one student's pages, with how dark it is. The questions on a page come from its code, not its place in the file.
async function qrStudent(st, Q, made) {
  const out = { b: [], pages: 0, old: 0 };
  const pages = quizPages(st);
  for (let n = 0; n < pages.length; n++) {
    let r; try { r = await qzPage(st, n, 1224); } catch { r = null; }
    if (!r) continue;
    const im = qrGrey(r.c), f = qrFind(im), code = f && qrCode(im, f);
    r.c.width = r.c.height = 0;
    if (!code || code.id !== made.id) continue;
    if (code.ver !== (made.ver || 0) % 4) { out.old++; continue; }
    out.pages++;
    // how far this scan sits from the printed page, so Quick mark's pictures of each question line up
    const [cx, cy] = code.map(408, 528), dx = Math.round((cx / im.W - .5) * 1e4) / 1e4, dy = Math.round((cy / im.H - .5) * 1e4) / 1e4;
    if (!code.turn && (Math.abs(dx) > .003 || Math.abs(dy) > .003)) ((Q.shift ||= {})[st.key] ||= {})[n] = [dx, dy];
    for (const q of Q.qs) {
      if (!q.auto || q.n !== code.pg) continue;
      const r0 = 13 * code.s;
      q.auto.b.forEach(([x, y], k) => {
        const [u, v] = code.map(x * 816, y * 1056);
        out.b.push({ q, k, d: (im.P - qrMean(im, u, v, r0 * .62)) / im.P, spill: qrRing(im, u, v, r0 * 1.2, r0 * 1.55) });
      });
    }
  }
  return out;
}
// What each question says, from its bubbles: { q, ans, v, why, guess }. v null with a why: she decides.
function qrDecide(bs) {
  if (!bs.length) return [];
  const ds = bs.map(b => b.d).sort((a, b) => a - b), base = ds[Math.floor(ds.length * .25)], top = Math.max(ds[ds.length - 1], base + .35);
  // filled; middling (not sure); faint (a light mark or an erasure: it only matters where nothing else is marked); blank
  for (const b of bs) { b.n = (b.d - base) / (top - base); b.on = b.n >= .6 && b.d - base >= .18; b.mid = !b.on && b.n > .3; b.faint = !b.on && !b.mid && b.d - base >= .05; }
  const byQ = new Map(); for (const b of bs) { if (!byQ.has(b.q)) byQ.set(b.q, []); byQ.get(b.q).push(b); }
  const out = [];
  for (const [q, list] of byQ) {
    const L = qzAutoLetters(q), F = list.filter(b => b.on && b.spill <= .06), X = list.filter(b => b.on && b.spill > .06), U = list.filter(b => b.mid), Wk = list.filter(b => b.faint);
    const s = list.slice().sort((a, b) => b.d - a.d), lead = s[0].d - (s[1] ? s[1].d : base) >= .04 ? L[s[0].k] : '';
    const pts = +q.pts || 1, none = !F.length && !X.length && !U.length;
    if (q.auto.t === 'sa') {   // her score bubbles
      if (none && !Wk.length) continue;
      if (F.length === 1 && !X.length && !U.length) { out.push({ q, ans: L[F[0].k], v: qzSteps(pts)[F[0].k] }); continue; }
      out.push({ q, why: 'Score unclear', guess: lead }); continue;
    }
    if (none) { if (Wk.length) out.push({ q, why: 'Very light', guess: Wk.length === 1 ? L[Wk[0].k] : lead }); else out.push({ q, ans: '', v: 0, blank: 1 }); continue; }
    if (q.auto.t === 'ms') {
      if (U.length || X.length) { out.push({ q, why: 'Not clear', guess: F.map(b => L[b.k]).join('') }); continue; }
      const ans = F.map(b => L[b.k]).join(''); out.push({ q, ans, v: qrScoreOf(q, ans) }); continue;
    }
    if (F.length === 1 && !X.length && !U.length) { out.push({ q, ans: L[F[0].k], v: qrScoreOf(q, L[F[0].k]) }); continue; }
    if (F.length === 1) { out.push({ q, why: 'Another bubble marked', guess: L[F[0].k] }); continue; }
    out.push({ q, why: F.length + X.length > 1 ? 'Two bubbles filled' : 'Not clear', guess: F.length + X.length > 1 ? '' : lead });
  }
  return out;
}
const qzAutoLetters = q => q.auto.t === 'tf' ? ['T', 'F'] : q.auto.t === 'sa' ? qzSteps(+q.pts || 1).map(fmtNum) : q.auto.b.map((_, k) => QMK_L[k]);
// Points for an answer: all of them for the right one (every right one, and no others, when several apply), none otherwise.
function qrScoreOf(q, ans) {
  if (q.auto.t === 'sa') { const k = qzAutoLetters(q).indexOf(ans); return k < 0 ? null : qzSteps(+q.pts || 1)[k]; }
  const key = q.auto.key || ''; if (!key) return null;
  return ans === key ? +q.pts || 1 : 0;
}
// Scores set together are one step: Ctrl Z takes every one of them back, marks on the papers too.
async function qrApply(list, what) {
  if (!list.length) return;
  const put = async (st, q, v) => { const g = st.grade, m = g.q ? { ...g.q } : {}; if (v == null) delete m[q.id]; else m[q.id] = v; g.q = m; await qzPaper(st, q, v); };
  const run = async to => { const sts = new Set(); for (const x of list) { await put(x.st, x.q, to(x)); sts.add(x.st); } for (const st of sts) { quizScore(st); await qzTotal(st); } saveSoon(); renderList(); renderGrade(); redrawAll(); };
  for (const x of list) x.was = quizMarks(x.st)[x.q.id];
  await run(x => x.v);
  pushUndo(actStep(() => run(x => x.was), () => run(x => x.v), what));
}
// Read every scanned page of this quiz: clear answers are scored (only questions not marked yet, unless again), the rest wait for her.
async function qrReadAll(again) {
  const Q = batch && batch.quiz, made = Q && Q.made; if (!made || !Q.qs.some(q => q.auto)) return;
  const b0 = batch;
  // papers just brought in take a moment to be laid out as pages
  for (let k = 0; k < 100 && batch === b0 && b0.students.some(st => st.files.some(f => viewable(f) && !f.virtual) && !quizPages(st).length); k++) await new Promise(r => setTimeout(r, 200));
  const who = quizWho(), list = [], look = [];
  let pages = 0, old = 0, read = 0, blank = 0, seen = 0;
  toast('Reading the bubbles…');
  for (const i of who) {
    const st = b0.students[i]; if (batch !== b0) return;
    const r = await qrStudent(st, Q, made); pages += r.pages; old += r.old;
    if (r.pages) seen++;
    const qa = { ...(st.grade.qa || {}) };
    for (const a of qrDecide(r.b)) {
      if (a.why) { if (again || quizMarks(st)[a.q.id] == null) look.push({ s: st.key, q: a.q.id, why: a.why, guess: a.guess || '' }); continue; }
      qa[a.q.id] = a.ans; read++; if (a.blank) blank++;
      if (a.v != null && (again || quizMarks(st)[a.q.id] == null)) list.push({ st, q: a.q, v: a.v });
    }
    if (Object.keys(qa).length) st.grade.qa = qa;
  }
  if (batch !== b0) return;
  Q.look = look.length ? look : undefined;
  Q.lastRead = { pages, seen, read, blank, old, t: Date.now() };
  await qrApply(list, 'quiz scan');
  saveSoon();
  if (look.length || old) openQuizLook();
  else toast(seen ? 'Scored ' + read + ' answers on ' + seen + (seen === 1 ? ' student’s quiz' : ' students’ quizzes') : 'No pages of this quiz were found in the papers');
}
// The answers the scan wasn't sure of, each with its picture, to pick what the student meant.
async function openQuizLook() {
  const Q = batch && batch.quiz; if (!Q) return;
  const look = (Q.look || []).map(l => ({ ...l, st: batch.students.find(s => s.key === l.s), q: Q.qs.find(q => q.id === l.q) })).filter(l => l.st && l.q);
  const R = Q.lastRead || {}, n = R.read || 0;
  const row = (l, k) => { const L = qzAutoLetters(l.q), sa = l.q.auto.t === 'sa', ms = l.q.auto.t === 'ms';
    return '<div class="qfrr" data-k="' + k + '"><div class="qfrw"><b data-raw>' + esc(shownName(l.st, batch.students.indexOf(l.st))) + '</b><span class="muted hsm">Question ' + esc(l.q.lab) + ' · ' + esc(l.why) + '</span></div>' +
      '<div class="qfcrop"><span class="muted hsm">Drawing…</span></div>' +
      '<div class="qfpick"><span class="hsm muted">' + (sa ? 'Your score' : ms ? 'Their answers' : 'Their answer') + '</span>' + L.map(x => '<button class="btn sm' + (l.guess.includes(x) && (ms || l.guess === x) ? ' primary' : '') + '" data-ans="' + esc(x) + '">' + esc(x) + '</button>').join('') +
      (sa ? '<button class="btn sm" data-ans="-">Later</button>' : '<button class="btn sm' + (!l.guess && !ms ? '' : '') + '" data-ans="-">None</button>') + '</div></div>'; };
  openDlg('<div class="bh"><h2>Quiz scan read</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb">' +
    '<div class="qftiles"><div><b>' + (R.pages || 0) + '</b><span>pages read</span></div><div><b>' + (R.seen || 0) + '</b><span>students found by the code on their pages</span></div><div><b>' + n + '</b><span>answers read' + (R.blank ? ', ' + R.blank + ' left blank' : '') + '</span></div><div class="need"><b>' + look.length + '</b><span>need you</span></div></div>' +
    (R.old ? '<p class="hsm qfwarn">' + R.old + (R.old === 1 ? ' page was' : ' pages were') + ' printed before the quiz was last changed, so ' + (R.old === 1 ? 'it wasn’t' : 'they weren’t') + ' read. Mark ' + (R.old === 1 ? 'it' : 'them') + ' in Quick mark.</p>' : '') +
    (look.length ? '<p class="hsm">These weren’t clear enough to score on their own. Pick what each student meant. A highlighted button is the scan’s best guess.</p>' + look.map(row).join('') : '<p class="hsm">Nothing needs you.</p>') +
    '</div><div class="bf"><span class="muted hsm" style="margin-right:auto">Every score can be changed in Quick mark. Ctrl Z takes the scan’s scores back.</span><button class="btn" data-qfagain title="Read every page again. Answers you already have stay as they are.">Read again</button><button class="btn" data-close>Later</button><button class="btn primary" data-qfdone>Save scores</button></div>');
  $('#dlgBox').classList.add('qfread');
  const box = $('#dlgBox');
  box.addEventListener('click', async e => {
    const b = e.target.closest('[data-ans]');
    if (b) { const r = b.closest('.qfrr'), l = look[+r.dataset.k], ms = l.q.auto.t === 'ms';
      if (ms && b.dataset.ans !== '-') { b.classList.toggle('primary'); r.querySelector('[data-ans="-"]').classList.remove('primary'); }
      else for (const x of r.querySelectorAll('[data-ans]')) x.classList.toggle('primary', x === b);
      r.classList.add('done'); return; }
    if (e.target.closest('[data-qfagain]')) { closeDlg(); return qrReadAll(); }
    if (!e.target.closest('[data-qfdone]')) return;
    const list = [], keep = [];
    look.forEach((l, k) => {
      const r = box.querySelector('.qfrr[data-k="' + k + '"]'), on = [...r.querySelectorAll('[data-ans].primary')].map(x => x.dataset.ans);
      if (!on.length || (l.q.auto.t === 'sa' && on[0] === '-')) return keep.push(Q.look.find(x => x.s === l.s && x.q === l.q.id));
      const ans = on[0] === '-' ? '' : on.sort().join('');
      (l.st.grade.qa ||= {})[l.q.id] = ans;
      const v = ans ? qrScoreOf(l.q, ans) : 0; if (v != null) list.push({ st: l.st, q: l.q, v });
    });
    Q.look = keep.filter(Boolean); if (!Q.look.length) delete Q.look;
    closeDlg(); await qrApply(list, 'answers picked from the quiz scan');
    toast(list.length ? 'Saved ' + list.length + (list.length === 1 ? ' score' : ' scores') : 'Nothing changed');
  });
  // the real picture of each answer, from the student's scan
  for (const [k, l] of look.entries()) {
    const el = box.querySelector('.qfrr[data-k="' + k + '"] .qfcrop'); if (!el) continue;
    try { const c = await qzCrop(l.st, l.q); if (c && el.isConnected) el.innerHTML = '<img alt="Question ' + esc(l.q.lab) + ' on ' + esc(shownName(l.st, batch.students.indexOf(l.st))) + '’s paper" src="' + c.url + '">'; } catch { }
  }
}
// From the card: the scan of the whole stack. With papers already open for it, the pages are added to them (students who were away).
function qrScanIn(itId) {
  const f = findItem(itId); if (!f) return;
  const it = f.it, inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/pdf,.pdf';
  inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    if (it.batchId && keptMeta.get(it.batchId) && keptMeta.get(it.batchId).papers) { await reopenKept(it.batchId, it); if (batch && batch.id === it.batchId) return openSplit(file, null, true); }
    openSplit(file, it, false);
  };
  inp.click();
}
Object.assign(window.__gs, { findItem, qrGrey, qrFind, qrH, qrCode, qrDecide, qrReadAll, openQuizLook, qrScanIn, qmkBits, qmkPages, qmkBoxes, qmkLayout, openQuizMaker });
