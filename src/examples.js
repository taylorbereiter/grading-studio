/* ---------------- strong examples: a strong answer, paper or part of a page, kept as pictures with the names blacked out (11/11) ---------------- */
// Picking one is always an option and never a step. Nothing about marking, scores or exports changes when one is kept.
// An example is a new, separate thing: pictures of the pages with every cover painted in, so no typed text, file name or student name is inside it,
// and a cover can't be taken off later, because the words under it were never kept.
// Its own database, grading-studio-examples, so the main one's version never has to go up (an older page would then be locked out of it):
//   ex:  id -> { id, t, kind: 'answer'|'paper'|'part'|'shot', tags: [words she typed] (optional), work, asg, cls, title, q: { id, lab, pts, v } | null, row, why, letter, pages: [{ w, h }], marks, score, from: { key } | null }
//   pix: id|n -> the n-th picture, a JPEG
// work is the download, asg the assignment, title the assignment's name when it was kept. from.key is the only place a student appears: shown only
// to the teacher, never on a picture, in a download or in Show to the class, and dropped when the download is forgotten.
// The database is made only when the first example is kept, so a browser that never keeps one never has it.
const EX_DB = 'grading-studio-examples';
let exDbP = null, exList = [], exReady = null;
const exDb = () => exDbP ||= new Promise((res, rej) => {
  const r = indexedDB.open(EX_DB, 1);
  r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('ex')) db.createObjectStore('ex'); if (!db.objectStoreNames.contains('pix')) db.createObjectStore('pix'); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
function exTx(stores, mode, fn) {
  return exDb().then(db => new Promise((res, rej) => {
    const tx = db.transaction(stores, mode), out = fn(tx);
    tx.oncomplete = () => res(out && 'result' in out ? out.result : out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  }));
}
// The records, read once at the start, if the database is there at all. A deleted example leaves { id, u, gone: true } behind, so a folder or
// take-home file that still has it doesn't bring it back. u is when a record last changed (t when it never has): the newer one wins a merge.
const exU = r => r.u || r.t || 0;
const exHave = async () => !indexedDB.databases || (await indexedDB.databases()).some(d => d.name === EX_DB);
exReady = (async () => {
  try {
    if (!await exHave()) return;
    exList = ((await exTx('ex', 'readonly', tx => tx.objectStore('ex').getAll())) || []).filter(r => !r.gone);
    exList.sort((a, b) => a.t - b.t);
  } catch (e) { console.error(e); exList = []; }
  exTabSay();
  if (batch && dlgPage === 'examples') openExamples();   // the tab was drawn before the examples were read
})();
const exOfWork = id => exList.filter(r => r.work === id);
// raw: a record from the folder or a take-home file, put in as it is, with its own u.
async function exPut(rec, blobs, raw) {
  if (!raw) rec = { ...rec, u: Date.now() };
  await exTx(['ex', 'pix'], 'readwrite', tx => {
    tx.objectStore('ex').put(rec, rec.id);
    if (rec.gone) tx.objectStore('pix').delete(IDBKeyRange.bound(rec.id + '|', rec.id + '|\uffff'));
    if (blobs) blobs.forEach((b, n) => tx.objectStore('pix').put(b, rec.id + '|' + n));
  });
  const k = exList.findIndex(r => r.id === rec.id);
  if (rec.gone) { if (k >= 0) exList.splice(k, 1); exUrlsDrop(rec.id); }
  else if (k >= 0) exList[k] = rec; else { exList.push(rec); exList.sort((a, b) => a.t - b.t); }
  exTabSay(); exRailSay();
  if (!raw) exFolderSoon();
  return rec;
}
async function exDelete(id) {
  if (!exList.some(r => r.id === id)) return;
  await exPut({ id, t: Date.now(), gone: true });
}
const exUrlsDrop = id => { for (const [k, u] of exUrls) if (k.startsWith(id + '|')) { u.then(x => x && URL.revokeObjectURL(x)); exUrls.delete(k); } };
// Every record, the deleted ones too, and the pictures of one.
const exAll = async () => await exHave() ? (await exTx('ex', 'readonly', tx => tx.objectStore('ex').getAll())) || [] : [];
const exPics = async r => { const out = []; for (let n = 0; n < (r.pages || []).length; n++) { const b = await exPic(r.id, n); if (!b) return null; out.push(b); } return out; };
const exPic = (id, n) => exTx('pix', 'readonly', tx => tx.objectStore('pix').get(id + '|' + n));
const exUrls = new Map();
const exUrl = (id, n) => { const k = id + '|' + n; if (!exUrls.has(k)) exUrls.set(k, exPic(id, n).then(b => b ? URL.createObjectURL(b) : null, () => null)); return exUrls.get(k); };
// Forgetting a download keeps its examples: they are anonymous pictures meant to outlast the stack. Only whose they were goes.
async function exForgetWork(id) {
  try { await exReady; } catch {}
  for (const r of exOfWork(id)) if (r.from) { try { await exPut({ ...r, from: null }); } catch (e) { console.error(e); } }
}

/* how an example is named: never after the student */
const exLabel = r => r.kind === 'answer' ? 'Question ' + ((r.q && r.q.lab) || '?') : r.kind === 'paper' ? 'Example ' + (r.letter || 'A') : r.kind === 'shot' ? 'Screenshot ' + (r.letter || '1') : 'Part of a page';
const exFileLabel = r => r.kind === 'part' ? 'Part ' + (r.letter || 'A') : exLabel(r);
const exTitleNow = () => nameFreeText((batch.assignment && batch.assignment.name) || batch.name || 'Assignment');
const exFileName = (r, ext) => (nameFreeText(r.title || 'Assignment') + ' - ' + exFileLabel(r) + '.' + ext).replace(/[\\/:*?"<>|]+/g, '-');
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function exNextLetter(work, kind) {
  const used = exOfWork(work).filter(r => r.kind === kind).map(r => LETTERS.indexOf(r.letter));
  return LETTERS[Math.min(25, Math.max(-1, ...used) + 1)];
}
const exFrom = st => ({ key: st.key });
const exBase = (kind, st) => ({ id: uid() + uid(), t: Date.now(), kind, work: batch.id, asg: (batch.assignment && batch.assignment.id) || null, cls: (batchClass() || {}).id || null, title: exTitleNow(), q: null, row: null, why: '', letter: null, pages: [], marks: false, score: false, from: exFrom(st) });
const exJpg = c => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('picture too big')), 'image/jpeg', 0.88));
// The covers for one page, in page points: typed names of the student and classmates, whatever follows a Name label, and every box drawn by hand
// in Check the covers or here, less the covers she took off. The handwriting name finder is not used.
async function exCovers(st, f, page, p) {
  const vp = vpRot(f, p, page, 1);
  let auto = [];
  try { auto = keptCovers(await autoCovers(page, vp, coverRx(st), skewXf(f, p, vp), shareOpts(st)), f.path, p, vp.width, vp.height); } catch (e) { console.error(e); }
  return auto.concat(ownCovers(f.path, p, vp.width, vp.height));
}

/* one answer, from Quick mark: cut from the clean page, so the teacher's ✗, ✓ or points aren't on it */
const exAnswerOf = (st, q) => batch && exList.find(r => r.kind === 'answer' && r.work === batch.id && r.q && r.q.id === q.id && r.from && r.from.key === st.key);
let exBusy = false;
async function exAnswerPic(st, q) {
  const [path, p] = quizPages(st)[q.n] || [], f = path && fileByPath(st, path);
  if (!f) return null;
  await workerReady; await classCommon();
  const js = await qzDoc(f), page = await js.getPage(p + 1), v1 = vpRot(f, p, page, 1), k = Math.min(4, 2000 / v1.width);
  const c = document.createElement('canvas'); c.width = Math.ceil(v1.width * k); c.height = Math.ceil(v1.height * k);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, ...vpDraw(f, p, page, k), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
  const L = lightForPage(st, f, p); if (L) lightCanvas(ctx, c.width, c.height, L);
  // Every cover on the page is painted before the cut, so any cover that touches the cut is in it.
  ctx.fillStyle = '#111';
  for (const r of await exCovers(st, f, page, p)) ctx.fillRect(r.x * k, r.y * k, r.w * k, r.h * k);
  page.cleanup();
  // Her box, moved by this student's shift, with a little room: not the wider part Quick mark shows to reach the mark's spot.
  const [dx, dy] = qzShift(st, q.n), x0 = clamp(q.x + dx - QZ_PAD, 0, 1), y0 = clamp(q.y + dy - QZ_PAD, 0, 1), x1 = clamp(q.x + dx + q.w + QZ_PAD, 0, 1), y1 = clamp(q.y + dy + q.h + QZ_PAD, 0, 1);
  const sx = Math.round(x0 * c.width), sy = Math.round(y0 * c.height), sw = Math.max(1, Math.round((x1 - x0) * c.width)), sh = Math.max(1, Math.round((y1 - y0) * c.height));
  const out = document.createElement('canvas'); out.width = sw; out.height = sh;
  out.getContext('2d').drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh);
  c.width = c.height = 0;
  const blob = await exJpg(out), size = { w: sw, h: sh };
  out.width = out.height = 0;
  return { blob, size };
}
// The ☆ Example button on an answer card, or E: kept at once, with Undo. A second press takes it back.
async function exStar(el) {
  if (!el || !batch || !quizOn()) return;
  const i = +el.dataset.st, st = batch.students[i], q = batch.quiz.qs.find(x => x.id === el.dataset.q), qi = batch.quiz.qs.indexOf(q);
  if (!st || !q) return;
  await exReady;
  const had = exAnswerOf(st, q);
  if (had) {
    try { await exDelete(had.id); } catch (e) { console.error(e); return toast('That didn’t work. Try again.'); }
    if (el.isConnected) qmRefresh(el);
    return toast('Taken off the examples');
  }
  if (exBusy) return;
  exBusy = true;
  const b = el.querySelector('[data-ex]'); if (b) b.disabled = true;
  try {
    const pic = await exAnswerPic(st, q);
    if (!pic) return toast('This page isn’t in their scan.');
    const v = quizMarks(st)[q.id];
    const rec = { ...exBase('answer', st), q: { id: q.id, lab: quizLabel(q, qi), pts: +q.pts || 1, v: v == null ? null : v }, pages: [pic.size] };
    await exPut(rec, [pic.blob]);
    if (el.isConnected) qmRefresh(el);
    exToast('Saved as an example for Question ' + rec.q.lab + '.', [['See examples', () => { qmClose(); exGo(); }], ['Undo', async () => { await exDelete(rec.id); const c = el.isConnected ? el : null; if (c) qmRefresh(c); }]]);
  } catch (e) { console.error(e); toast('That answer couldn’t be kept: ' + (e.message || e), 6000); }
  finally { exBusy = false; if (b && b.isConnected) b.disabled = false; }
}
// A short note with more than one button.
function exToast(msg, acts) {
  const t = $('.toast');
  toast(msg, 7000);
  for (const [label, fn] of acts) {
    const b = document.createElement('button'); b.className = 'tact'; b.textContent = label;
    b.onclick = () => { t.hidden = true; t.textContent = ''; fn(); };
    t.append(' ', b);
  }
}
const exGo = () => { if (batch) go(batchHash(batch.id, 'examples')); };
const exStarBtn = (st, q) => { const on = !!exAnswerOf(st, q); return '<button class="btn sm qmex' + (on ? ' on' : '') + '" data-ex aria-pressed="' + on + '" title="' + (on ? 'Kept as a strong example. Click to take it off (E)' : 'Keep this answer as a strong example, with the name covered (E)') + '"><span aria-hidden="true">' + (on ? '★' : '☆') + '</span> Example</button>'; };

/* a whole paper or part of a page, from the paper's ⋯ menu */
let EXU = null;
// Every page of their paper that can be drawn: their files in order, and each Word file drawn as pages the way Convert to PDF does, for the picture only.
function exItems(st) {
  const out = [];
  // a file still waiting for its first mark counts; one she left out herself doesn't
  for (const d of layoutOf(st).filter(d => docIn(st, d) || docAuto(st, d))) for (const [path, p] of d.pages) { const f = fileByPath(st, path); if (f && !f.virtual && viewable(f)) out.push({ f, p, path }); }
  for (const f of st.files) if (f.kind === 'docx' && !f.virtual && !f.rubric && f.data) out.push({ word: f });
  return out;
}
const exCanUse = st => !!st && exItems(st).length > 0;
async function exuDoc(it) {
  const D = EXU.docs;
  if (!D.has(it.path)) D.set(it.path, (async () => pdfjsLib.getDocument({ data: (await viewBytes(it.f)).slice(), isEvalSupported: false }).promise)());
  return D.get(it.path);
}
// Word files become pages here, once each: { f: a stand-in for the file, so its own marks and turns aren't used }.
async function exuExpand(items) {
  const out = [];
  for (const it of items) {
    if (!it.word) { out.push(it); continue; }
    try {
      const bytes = await wordPagesPdf(it.word), path = it.word.path + '#pdf';
      const doc = pdfjsLib.getDocument({ data: bytes, isEvalSupported: false }).promise;
      EXU.docs.set(path, doc);
      const f = { path, name: it.word.name, kind: 'docx', marks: {}, wordOf: it.word };
      for (let p = 0; p < (await doc).numPages; p++) out.push({ f, p, path });
    } catch (e) { console.error(e); }
  }
  return out;
}
function exScoreText(st) {
  const g = gradeOf(st);
  if (g.status === 'missing' || g.status === 'excused' || (g.total == null && g.pct == null)) return '';
  return (g.total != null ? fmtNum(g.total) + ' / ' + fmtNum(g.outOf != null ? g.outOf : maxPoints()) : '') + (g.pct != null ? (g.total != null ? '   ' : '') + g.pct + '%' : '');
}
// The score, in the marks' red, at the top right of a picture.
function exScoreOn(c, text) {
  if (!text) return;
  const ctx = c.getContext('2d'), s = Math.max(14, Math.round(c.width * 0.028));
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '600 ' + s + 'px Inter, Arial, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillStyle = COLORS.red;
  ctx.fillText(text, c.width - s, s * 0.8);
  ctx.restore();
}
// One page as the example will keep it, at scale (pixels per point): covers, and her marks only when the switch is on.
async function exuCanvas(k, scale) {
  const it = EXU.items[k], js = await exuDoc(it), st = EXU.st;
  const r = await sharePage(st, it.f, js, it.p, scale, coverRx(st), shareOpts(st), { bare: !EXU.marks, light: true });
  return r;
}
async function openUseExample(i) {
  if (!batch) return;
  if (i == null) i = cur;
  const st = batch.students[i];
  if (!exCanUse(st)) return toast('This paper has no pages to keep as an example.');
  await exReady;
  EXU = { st, i, items: [], kind: 'paper', marks: false, score: false, row: null, part: null, docs: new Map(), shown: [], tok: 0 };
  const rows = setup.mode === 'rubric' ? setup.criteria.filter(c => String(c || '').trim() && !/^Criterion \d+$/.test(c)) : [];   // the rows of a rubric she has named, not the starting ones
  openDlg('<div class="bh"><h2>Use as an example</h2><span class="sp"></span><button class="icon" data-close aria-label="Close">✕</button></div>' +
    '<div class="bb exuse"><div class="expv" id="exPv"><p class="muted">Getting the pages ready…</p></div>' +
    '<aside class="exside">' +
      '<h3 class="exh">What to keep</h3><div class="exkind" role="group" aria-label="What to keep"><button data-exk="paper" aria-pressed="true"><b>Whole paper</b><small id="exPages"> </small></button><button data-exk="part" aria-pressed="false"><b>Part of a page</b><small>Drag a box</small></button></div>' +
      '<h3 class="exh">Names</h3><p class="exnames" id="exNames">Looking for names…</p>' +
      '<h3 class="exh">Show on it</h3><button class="exsw" role="switch" aria-checked="false" data-exsw="marks"><i></i>My marks and comments</button>' +
        (exScoreText(st) ? '<button class="exsw" role="switch" aria-checked="false" data-exsw="score"><i></i>The score</button>' : '') +
      '<h3 class="exh">Why it’s strong <span class="muted">(optional)</span></h3><input type="text" id="exWhy" class="exwhyin" maxlength="160" placeholder="Every claim is tied to a moment in the story." aria-label="Why it’s strong">' +
      (rows.length ? '<div class="exrows" role="group" aria-label="Rubric row">' + rows.map(c => '<button class="exrow" data-exrow="' + esc(c) + '" aria-pressed="false">' + esc(c) + '</button>').join('') + '</div>' : '') +
    '</aside></div>' +
    '<div class="bf"><span class="exlock"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span id="exLockSay"></span></span><span class="sp"></span><button class="btn" data-close>Cancel</button><button class="btn primary" data-exsave disabled>Save example</button></div>');
  const box = $('#dlgBox');
  box.classList.add('exbox');
  const shut = () => { if (!EXU) return; for (const d of EXU.docs.values()) d.then(x => x.destroy(), () => {}); EXU = null; };
  dlgGone = shut;
  exuLockSay();
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    const k = e.target.closest('[data-exk]');
    if (k) { EXU.kind = k.dataset.exk; for (const b of box.querySelectorAll('[data-exk]')) b.setAttribute('aria-pressed', String(b === k)); exuCrop(); exuNames(); exuLockSay(); exuSaveOk(); return; }
    const sw = e.target.closest('[data-exsw]');
    if (sw) { const on = sw.getAttribute('aria-checked') !== 'true'; sw.setAttribute('aria-checked', String(on)); EXU[sw.dataset.exsw] = on; return exuDrawAll(); }
    const rw = e.target.closest('[data-exrow]');
    if (rw) { EXU.row = EXU.row === rw.dataset.exrow ? null : rw.dataset.exrow; for (const b of box.querySelectorAll('[data-exrow]')) b.setAttribute('aria-pressed', String(b.dataset.exrow === EXU.row)); return; }
    if (e.target.closest('[data-exsave]')) return exuSave();
  };
  box.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'exWhy') { e.preventDefault(); exuSave(); } };
  exuBind($('#exPv'));
  try {
    await workerReady; await classCommon();
    if (!EXU || EXU.st !== st) return;
    const items = await exuExpand(exItems(st));
    if (!EXU || EXU.st !== st) return;
    EXU.items = items;
    if (!items.length) { $('#exPv').innerHTML = '<p class="muted">This paper couldn’t be drawn.</p>'; return; }
    $('#exPages').textContent = items.length + (items.length === 1 ? ' page' : ' pages');
    $('#exPv').innerHTML = items.map((_, k) => '<div class="expg" data-k="' + k + '"><div class="excv"><canvas></canvas><div class="excrop" hidden></div><div class="exdrag" hidden></div></div><span class="expgn">' + (k + 1) + ' of ' + items.length + '</span></div>').join('');
    $('#exPv').classList.toggle('one', items.length === 1);
    await exuDrawAll();
  } catch (e) { console.error(e); if (EXU && $('#exPv')) $('#exPv').innerHTML = '<p class="muted">This paper couldn’t be drawn: ' + esc(e.message || String(e)) + '</p>'; }
}
const exuLockSay = () => { const el = $('#exLockSay'); if (!el || !EXU) return; const L = exNextLetter(batch.id, EXU.kind); el.textContent = 'Kept as pictures with the names blacked out for good. It’s called “' + (EXU.kind === 'paper' ? 'Example ' + L : 'Part of a page') + '”, never by name.'; };
const exuSaveOk = () => { const b = $('#dlgBox [data-exsave]'); if (b && EXU) b.disabled = !EXU.items.length || (EXU.kind === 'part' && !EXU.part); };
function exuNames() {
  const el = $('#exNames'); if (!el || !EXU) return;
  const n = EXU.shown.reduce((a, s) => a + (s ? exGroups(s.covers) : 0), 0);
  el.innerHTML = '<b>' + (n === 1 ? '1 name covered.' : n + ' names covered.') + '</b> ' + (EXU.kind === 'part' ? 'Drag a box around the part to keep. Click a cover to take it off.' : 'Drag on a page to cover anything else, like a handwritten name. Click a cover to take it off.');
}
// Covers that touch or sit side by side on a line are one name to her: Cara and Sample are two covers, one name.
function exGroups(cs) {
  const near = (a, b) => a.x <= b.x + b.w + 8 && b.x <= a.x + a.w + 8 && a.y <= b.y + b.h + 2 && b.y <= a.y + a.h + 2;
  const seen = new Set(); let n = 0;
  for (let i = 0; i < cs.length; i++) {
    if (seen.has(i)) continue; n++;
    const todo = [i]; seen.add(i);
    while (todo.length) { const a = cs[todo.pop()]; cs.forEach((b, j) => { if (!seen.has(j) && near(a, b)) { seen.add(j); todo.push(j); } }); }
  }
  return n;
}
async function exuDrawAll() {
  if (!EXU || !EXU.items.length) return;
  const my = ++EXU.tok;
  for (let k = 0; k < EXU.items.length; k++) { await exuDraw(k, my); if (!EXU || EXU.tok !== my) return; }
  exuNames(); exuSaveOk();
}
async function exuDraw(k, my) {
  const cell = $('#exPv .expg[data-k="' + k + '"]'); if (!cell || !EXU) return;
  const it = EXU.items[k], js = await exuDoc(it), pg0 = await js.getPage(it.p + 1), v1 = vpRot(it.f, it.p, pg0, 1), dpr = window.devicePixelRatio || 1;
  const colW = Math.max(240, cell.clientWidth || 360), scale = Math.min(3, colW * 1.25 / v1.width) * dpr;
  const r = await exuCanvas(k, scale);
  if (!EXU || (my != null && EXU.tok !== my) || !cell.isConnected) { r.c.width = 0; return; }
  if (EXU.score && k === 0) exScoreOn(r.c, exScoreText(EXU.st));
  const ctx = r.c.getContext('2d');
  // Where a cover she took off was: a dashed outline, so she can put it back.
  if (r.gone.length) { ctx.save(); ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.strokeStyle = '#1F6FB2'; ctx.lineWidth = 1.5 / scale * dpr; ctx.setLineDash([5 / scale * dpr, 3 / scale * dpr]); for (const g of r.gone) ctx.strokeRect(g.x, g.y, g.w, g.h); ctx.restore(); }
  const old = cell.querySelector('canvas'); r.c.className = 'exc'; old.replaceWith(r.c); old.width = 0;
  EXU.shown[k] = { W: r.W, H: r.H, side: r.side, covers: r.covers, gone: r.gone };
  exuCrop();
}
// The part being kept: a blue outline on its page.
function exuCrop() {
  if (!EXU) return;
  for (const cell of document.querySelectorAll('#exPv .expg')) {
    const box = cell.querySelector('.excrop'), p = EXU.part, on = EXU.kind === 'part' && p && p.k === +cell.dataset.k;
    box.hidden = !on;
    if (on) Object.assign(box.style, { left: p.x * 100 + '%', top: p.y * 100 + '%', width: p.w * 100 + '%', height: p.h * 100 + '%' });
  }
}
function exuBind(pv) {
  let d = null;
  pv.onpointerdown = e => {
    const cv = e.target.closest('.excv'); if (!cv || e.button !== 0 || !EXU) return;
    const k = +cv.closest('.expg').dataset.k; if (!EXU.shown[k]) return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    d = { cv, k, r: cv.getBoundingClientRect(), x0: e.clientX, y0: e.clientY, moved: false };
  };
  pv.onpointermove = e => {
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 5) return;
    d.moved = true;
    const b = d.cv.querySelector('.exdrag'), x = Math.min(d.x0, e.clientX) - d.r.left, y = Math.min(d.y0, e.clientY) - d.r.top;
    b.hidden = false; b.classList.toggle('part', EXU.kind === 'part');
    Object.assign(b.style, { left: x + 'px', top: y + 'px', width: Math.abs(e.clientX - d.x0) + 'px', height: Math.abs(e.clientY - d.y0) + 'px' });
  };
  pv.onpointerup = e => {
    if (!d || !EXU) { d = null; return; }
    const g = d; d = null;
    g.cv.querySelector('.exdrag').hidden = true;
    const s = EXU.shown[g.k], it = EXU.items[g.k], fx = v => clamp((v - g.r.left) / (g.r.width || 1), 0, 1), fy = v => clamp((v - g.r.top) / (g.r.height || 1), 0, 1);
    const ax = fx(Math.min(g.x0, e.clientX)), bx = fx(Math.max(g.x0, e.clientX)), ay = fy(Math.min(g.y0, e.clientY)), by = fy(Math.max(g.y0, e.clientY));
    const TW = s.W + s.side, R = v => Math.round(v * 10000) / 10000;
    if (!g.moved) return exuToggle(g.k, ax * TW, ay * s.H);
    if (EXU.kind === 'part') { EXU.part = { k: g.k, x: R(ax), y: R(ay), w: R(Math.max(0.01, bx - ax)), h: R(Math.max(0.01, by - ay)) }; exuCrop(); exuSaveOk(); return; }
    // A cover drawn by hand: kept with the paper's other covers, so it is there in Check the covers too.
    const x0 = Math.min(ax * TW, s.W) / s.W, x1 = Math.min(bx * TW, s.W) / s.W;
    if (x1 - x0 < 0.002) return;
    const k = boxKey(it.f.path, it.p), sh = shareState();
    (sh.boxes[k] ||= []).push([R(x0), R(ay), R(x1 - x0), R(by - ay)]);
    saveSoon(); exuDraw(g.k).then(exuNames);
  };
}
// A click on a cover takes it off; on the dashed outline of one she took off, puts it back.
function exuToggle(k, x, y) {
  const s = EXU.shown[k], it = EXU.items[k], key = boxKey(it.f.path, it.p), sh = shareState();
  const inside = q => x >= q.x - 2 && x <= q.x + q.w + 2 && y >= q.y - 2 && y <= q.y + q.h + 2;
  const R = v => Math.round(v * 10000) / 10000, frac = q => [q.x / s.W, q.y / s.H, q.w / s.W, q.h / s.H].map(R);
  const hit = s.covers.filter(inside).sort((a, b) => a.w * a.h - b.w * b.h)[0];
  if (hit && hit.own) {
    const own = sh.boxes[key] || [], at = own.findIndex(b => Math.abs(b[0] * s.W - hit.x) < 1 && Math.abs(b[1] * s.H - hit.y) < 1);
    if (at >= 0) own.splice(at, 1); if (!own.length) delete sh.boxes[key];
  } else if (hit) (sh.off ||= {})[key] = [...(sh.off[key] || []), frac(hit)];
  else {
    const g = s.gone.find(inside); if (!g) return;
    const off = (sh.off || {})[key] || [], at = off.findIndex(b => sameSpot(g, b, s.W, s.H));
    if (at >= 0) off.splice(at, 1); if (!off.length && sh.off) delete sh.off[key];
  }
  saveSoon(); exuDraw(k).then(exuNames);
}
async function exuSave() {
  if (!EXU || !EXU.items.length) return;
  const U = EXU, btn = $('#dlgBox [data-exsave]');
  if (U.kind === 'part' && !U.part) return toast('Drag a box around the part to keep.');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  U.tok++;   // a redraw on its way stops
  try {
    const list = U.kind === 'paper' ? U.items.map((_, k) => k) : [U.part.k], blobs = [], pages = [], score = U.score ? exScoreText(U.st) : '';
    for (const k of list) {
      const it = U.items[k], js = await exuDoc(it), v1 = vpRot(it.f, it.p, await js.getPage(it.p + 1), 1);
      const r = await exuCanvas(k, Math.min(4, (U.kind === 'part' ? 2400 : 1600) / v1.width));
      let c = r.c;
      if (U.kind === 'part') {
        const p = U.part, sx = Math.round(p.x * c.width), sy = Math.round(p.y * c.height), sw = Math.max(1, Math.round(p.w * c.width)), sh = Math.max(1, Math.round(p.h * c.height));
        const o = document.createElement('canvas'); o.width = sw; o.height = sh; o.getContext('2d').drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh);
        c.width = 0; c = o;
      }
      if (score && !blobs.length) exScoreOn(c, score);
      blobs.push(await exJpg(c)); pages.push({ w: c.width, h: c.height });
      c.width = c.height = 0;
    }
    const why = ($('#exWhy') ? $('#exWhy').value : '').trim().slice(0, 160);
    const rec = { ...exBase(U.kind, U.st), why, row: U.row, letter: exNextLetter(batch.id, U.kind), pages, marks: U.marks, score: !!score };
    await exPut(rec, blobs);
    closeDlg();
    exToast('Saved as ' + (rec.kind === 'paper' ? 'Example ' + rec.letter : 'an example') + '.', [['See examples', exGo]]);
  } catch (e) {
    console.error(e);
    if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = 'Save example'; }
    toast('The example couldn’t be kept: ' + (e.message || e), 6000);
  }
}

/* tags: short words she types on an example, to find it again in the bank (11/13) */
const EX_TAG_MAX = 8, EX_TAG_LEN = 30;
const exTags = r => Array.isArray(r && r.tags) ? r.tags : [];
const exAllTags = () => [...new Set(exList.flatMap(exTags))].sort(natural);
// Comma-separated words, tidied: a tag already used somewhere keeps the way it was first written, so "Thesis" and "thesis" are one tag.
function exTagsOf(text) {
  const known = new Map(exAllTags().map(t => [t.toLowerCase(), t])), out = [];
  for (let t of String(text || '').split(/[,;\n]/)) {
    t = t.replace(/\s+/g, ' ').trim().slice(0, EX_TAG_LEN); if (!t) continue;
    t = known.get(t.toLowerCase()) || t;
    if (!out.some(x => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, EX_TAG_MAX);
}
const exTagChips = r => exTags(r).map(t => '<button class="extag" data-extag="' + esc(t) + '" title="Every example tagged ' + esc(t) + '">' + esc(t) + '</button>').join('');
function exTagsEdit(card, r) {
  kmClose();
  const p = card.querySelector('.extags'); if (!p || p.querySelector('input')) return;
  p.innerHTML = '<input type="text" class="exwhyin" maxlength="200" aria-label="Tags" placeholder="Tags, with commas between">';
  const inp = p.firstChild; inp.value = exTags(r).join(', '); inp.focus();
  let done = false;
  const save = async keep => {
    if (done) return; done = true;
    const tags = keep ? exTagsOf(inp.value) : exTags(r);
    if (tags.join('\n') !== exTags(r).join('\n')) { try { await exPut({ ...r, tags }); } catch (e) { console.error(e); toast('That didn’t work. Try again.'); } }
    const now = exList.find(x => x.id === r.id) || r;
    p.innerHTML = exTagChips(now);
    const m = card.querySelector('[data-extags].mitem'); if (m) m.textContent = exTags(now).length ? 'Change tags' : 'Add tags';
    if (!batch && routeNow().v === 'examples') exPageRender();   // a new tag joins the filter
  };
  inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); save(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); save(false); } };
  inp.onblur = () => save(true);
}

/* a screenshot kept as a strong example: from the Screenshot tool, of any paper or anything on screen (11/13) */
// Where the picture was taken, read when it was taken: the open assignment and, on a paper, whose it was (for her eyes only, like
// every example), or the class page she was on. Away from an assignment a screenshot belongs to no assignment and sits under
// "Screenshots" for its class in the bank.
function exShotWhere() {
  try {
    if (batch) { const st = snipPaper() ? batch.students[cur] : null; return { work: batch.id, asg: (batch.assignment && batch.assignment.id) || null, cls: (batchClass() || {}).id || null, title: exTitleNow(), from: st ? exFrom(st) : null, paper: !!st }; }
    const r = routeNow();
    return { work: null, asg: null, cls: r.v === 'class' && r.c && r.c !== lib.loose ? r.c.id : null, title: 'Screenshots', from: null, paper: false };
  } catch (e) { console.error(e); return { work: null, asg: null, cls: null, title: 'Screenshots', from: null, paper: false }; }
}
const exShotKey = w => w.asg || (w.work ? 'w:' + w.work : 'loose:' + (w.cls || '-'));
const exShotNext = w => String(1 + Math.max(0, ...exList.filter(r => r.kind === 'shot' && exAsgKey(r) === exShotKey(w)).map(r => parseInt(r.letter, 10) || 0)));
let EXS = null;
async function exSaveShot(blob, where) {
  await exReady;
  let im; try { im = await createImageBitmap(blob); } catch (e) { console.error(e); return toast('That picture couldn’t be read.'); }
  EXS = { im, where, covers: [] };
  const known = exAllTags();
  const classes = lib.classes.slice().sort((a, b) => natural(a.name, b.name));
  const place = where.work ? '<p class="exnames">From <b>' + esc(where.title) + '</b>' + (where.cls ? ' · ' + esc(exClassName(where.cls)) : '') + '</p>'
    : '<select class="btn sm exshotcls" id="exShotCls" aria-label="Class"><option value="">No class</option>' + classes.map(c => '<option value="' + esc(c.id) + '"' + (c.id === where.cls ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select>';
  openDlg('<div class="bh"><h2>Save as a strong example</h2><span class="sp"></span><button class="icon" data-close aria-label="Close">✕</button></div>' +
    '<div class="bb exuse"><div class="expv one" id="exShotPv"><div class="expg"><div class="excv"><canvas class="exc"></canvas><div class="exdrag" hidden></div></div></div></div>' +
    '<aside class="exside">' +
      '<h3 class="exh">Names</h3><p class="exnames" id="exShotNames"></p>' +
      '<h3 class="exh">Why it’s strong <span class="muted">(optional)</span></h3><input type="text" id="exWhy" class="exwhyin" maxlength="160" placeholder="Every claim is tied to a moment in the story." aria-label="Why it’s strong">' +
      '<h3 class="exh">Tags <span class="muted">(optional)</span></h3><input type="text" id="exTagsIn" class="exwhyin" maxlength="200" placeholder="thesis, evidence, Unit 2" aria-label="Tags, with commas between">' +
      (known.length ? '<div class="exrows exknown" role="group" aria-label="Tags you have used">' + known.slice(0, 12).map(t => '<button class="exrow" data-exaddtag="' + esc(t) + '">' + esc(t) + '</button>').join('') + '</div>' : '') +
      '<h3 class="exh">Kept with</h3>' + place +
    '</aside></div>' +
    '<div class="bf"><span class="exlock"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span>Kept in this browser only, with what you blacked out gone for good. It’s called “Screenshot ' + exShotNext(where) + '”, never by name.</span></span><span class="sp"></span><button class="btn" data-close>Cancel</button><button class="btn primary" data-exsave>Save example</button></div>');
  const box = $('#dlgBox');
  box.classList.add('exbox');
  dlgGone = () => { if (EXS) { try { EXS.im.close(); } catch {} EXS = null; } };
  exsDraw(); exsNames();
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    const t = e.target.closest('[data-exaddtag]');
    if (t) { const inp = $('#exTagsIn'); inp.value = exTagsOf(inp.value + ',' + t.dataset.exaddtag).join(', '); return; }
    if (e.target.closest('[data-exsave]')) return exsSave();
  };
  box.onkeydown = e => { if (e.key === 'Enter' && (e.target.id === 'exWhy' || e.target.id === 'exTagsIn')) { e.preventDefault(); exsSave(); } };
  exsBind($('#exShotPv .excv'));
  const w = $('#exWhy'); if (w) w.focus({ preventScroll: true });
}
const exsNames = () => { const el = $('#exShotNames'); if (!el || !EXS) return; const n = EXS.covers.length;
  el.innerHTML = (EXS.where.paper ? 'Name covers on the paper are already painted in. ' : '') + (n ? '<b>' + (n === 1 ? '1 area blacked out.' : n + ' areas blacked out.') + '</b> ' : '') + 'Drag over anything ' + (n || EXS.where.paper ? 'else ' : '') + 'that shows a name to black it out. Click a black box to take it off.'; };
// The picture with her black boxes on it, at the size given (the preview, or the saved picture).
function exsPaint(c, W) {
  const { im, covers } = EXS, k = W / im.width;
  c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(im, 0, 0, c.width, c.height);
  ctx.fillStyle = '#111';
  for (const r of covers) ctx.fillRect(Math.floor(r.x * c.width), Math.floor(r.y * c.height), Math.ceil(r.w * c.width) + 1, Math.ceil(r.h * c.height) + 1);
}
function exsDraw() { const c = $('#exShotPv canvas'); if (c && EXS) exsPaint(c, Math.min(EXS.im.width, 1800)); }
function exsBind(cv) {
  if (!cv) return;
  let d = null;
  cv.onpointerdown = e => { if (e.button !== 0 || !EXS) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); d = { r: cv.getBoundingClientRect(), x0: e.clientX, y0: e.clientY, moved: false }; };
  cv.onpointermove = e => {
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 5) return;
    d.moved = true;
    const b = cv.querySelector('.exdrag');
    b.hidden = false;
    Object.assign(b.style, { left: Math.min(d.x0, e.clientX) - d.r.left + 'px', top: Math.min(d.y0, e.clientY) - d.r.top + 'px', width: Math.abs(e.clientX - d.x0) + 'px', height: Math.abs(e.clientY - d.y0) + 'px' });
  };
  cv.onpointerup = e => {
    if (!d || !EXS) { d = null; return; }
    const g = d; d = null; cv.querySelector('.exdrag').hidden = true;
    const fx = v => clamp((v - g.r.left) / (g.r.width || 1), 0, 1), fy = v => clamp((v - g.r.top) / (g.r.height || 1), 0, 1);
    if (!g.moved) {   // a click on a black box takes it off; the smallest one under the click first
      const x = fx(e.clientX), y = fy(e.clientY), hits = EXS.covers.map((r, i) => ({ r, i })).filter(({ r }) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h).sort((a, b) => a.r.w * a.r.h - b.r.w * b.r.h);
      if (hits.length) { EXS.covers.splice(hits[0].i, 1); exsDraw(); exsNames(); }
      return;
    }
    const x = fx(Math.min(g.x0, e.clientX)), y = fy(Math.min(g.y0, e.clientY)), w = fx(Math.max(g.x0, e.clientX)) - x, h = fy(Math.max(g.y0, e.clientY)) - y;
    if (w < 0.004 || h < 0.004) return;
    EXS.covers.push({ x, y, w, h }); exsDraw(); exsNames();
  };
}
async function exsSave() {
  if (!EXS) return;
  const S = EXS, btn = $('#dlgBox [data-exsave]');
  if (btn) { if (btn.disabled) return; btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    const c = document.createElement('canvas'); exsPaint(c, Math.min(S.im.width, 2400));
    const size = { w: c.width, h: c.height }, jpg = await exJpg(c); c.width = c.height = 0;
    const w = S.where, sel = $('#exShotCls'), cls = w.work ? w.cls : sel ? sel.value || null : w.cls;
    const at = { ...w, cls };
    const rec = { id: uid() + uid(), t: Date.now(), kind: 'shot', work: w.work, asg: w.asg, cls, title: w.title, q: null, row: null,
      why: ($('#exWhy') ? $('#exWhy').value : '').trim().slice(0, 160), tags: exTagsOf($('#exTagsIn') ? $('#exTagsIn').value : ''),
      letter: exShotNext(at), pages: [size], marks: true, score: false, from: w.from };
    await exPut(rec, [jpg]);
    closeDlg();
    const see = () => { if (batch && rec.work === batch.id) exGo(); else go('#/examples'); };
    exToast('Saved as Screenshot ' + rec.letter + ' in your strong examples.', [['See examples', see]]);
  } catch (e) {
    console.error(e);
    if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = 'Save example'; }
    toast('The example couldn’t be kept: ' + (e.message || e), 6000);
  }
}

/* the Examples tab: between Insights and Return, once the assignment has an example */
function exTabSay() {
  const a = $('#examplesTab'); if (!a) return;
  let n = 0; try { n = batch ? exOfWork(batch.id).length : 0; } catch { return; }   // asked before this file has run
  const here = batch && routeNow().v === 'a' && routeNow().tab === 'examples';
  a.hidden = !n && !here;
  const c = a.querySelector('.atn'); if (c) { c.textContent = n || ''; c.hidden = !n; }
}
// Answers by question, in the quiz's order; then whole papers and parts of pages.
function exSorted(list) {
  const qs = quizOn() ? batch.quiz.qs.map(q => q.id) : [], at = r => { const k = qs.indexOf(r.q && r.q.id); return k < 0 ? 999 : k; };
  const ans = list.filter(r => r.kind === 'answer').sort((a, b) => at(a) - at(b) || natural(String(a.q && a.q.lab), String(b.q && b.q.lab)) || a.t - b.t);
  const rest = list.filter(r => r.kind !== 'answer').sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'paper' ? -1 : 1) || a.t - b.t);
  return [...ans, ...rest];
}
const exCanCopy = () => !!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem);
function exCard(r) {
  const chip = r.kind === 'answer' && r.q && r.q.v != null ? fmtNum(r.q.v) + ' of ' + fmtNum(r.q.pts) : r.kind === 'paper' ? r.pages.length + (r.pages.length === 1 ? ' page' : ' pages') : '';
  const who = r.from && !anonOn() ? '<p class="exwho"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>Only you see this: ' + esc(r.from.key) + '</p>' : '';
  return '<div class="excard ' + r.kind + '" data-exid="' + esc(r.id) + '"><button class="exthumb" data-exopen title="Show to the class"><img alt="' + esc(exLabel(r)) + '" data-expic="' + esc(r.id) + '"></button>' +
    '<div class="exct"><span class="exstar" aria-hidden="true">★</span><b>' + esc(exLabel(r)) + '</b>' + (r.row ? '<span class="exrowtag">' + esc(r.row) + '</span>' : chip ? '<span class="exchip">' + esc(chip) + '</span>' : '') + '</div>' +
    '<p class="exwhy">' + (r.why ? esc(r.why) : '<button class="link exadd" data-exwhy>Add why it’s strong</button>') + '</p>' +
    '<p class="extags">' + exTagChips(r) + '</p>' +
    '<div class="exacts">' + (r.kind !== 'paper' && exCanCopy() ? '<button class="btn sm" data-excopy>Copy picture</button>' : '') + '<button class="btn sm" data-exdl>Download</button>' +
      kmWrap('⋯', 'class="icon kdots" aria-label="More for this example" title="More for this example"', '<button class="mitem" data-exopen>Show to the class</button><button class="mitem" data-exwhy>' + (r.why ? 'Change why it’s strong' : 'Add why it’s strong') + '</button><button class="mitem" data-extags>' + (exTags(r).length ? 'Change tags' : 'Add tags') + '</button><button class="mitem" data-exdel>Delete</button>') + '</div>' + who + '</div>';
}
function openExamples() {
  if (!batch) return;
  const list = exSorted(exOfWork(batch.id)), ans = list.filter(r => r.kind === 'answer'), rest = list.filter(r => r.kind !== 'answer');
  const qs = quizOn() ? batch.quiz.qs : [], none = qs.map((q, i) => ({ q, i })).filter(x => !ans.some(r => r.q && r.q.id === x.q.id)).map(x => quizLabel(x.q, x.i));
  const and = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  const noneCard = qs.length && none.length ? '<div class="excard exnone"><p>' + (none.length === 1 ? 'Question ' + esc(none[0]) + ' has' : 'Questions ' + esc(and(none)) + ' have') + ' no example yet.<br>Press ☆ on an answer in Quick mark.</p></div>' : '';
  tabNext('examples');
  openDlg('<div class="bh"><h2>Examples</h2><span class="muted exsub">Strong work from this assignment, with no names on it.</span><span class="sp"></span>' +
    (list.length ? '<button class="btn" data-exsheet><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Download as a sheet</button><button class="btn primary" data-exshow><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>Show to the class</button>' : '') +
    '<button class="icon" data-close aria-label="Close">✕</button></div>' +
    '<div class="bb exbb" id="exBody">' +
      (!list.length ? '<div class="exempty"><p><b>No examples yet.</b></p><p class="muted">Press ☆ Example on an answer in Quick mark, pick <b>Use as an example</b> in a paper’s ⋯ menu, or take a screenshot (S) and save it as a strong example. Picking one is always up to you.</p></div>' : '') +
      (ans.length || noneCard ? '<h3 class="exsec">Answers, by question</h3><div class="exgrid">' + ans.map(exCard).join('') + noneCard + '</div>' : '') +
      (rest.length ? '<h3 class="exsec">' + (rest.some(r => r.kind === 'shot') ? 'Whole papers, parts of pages and screenshots' : 'Whole papers and parts of pages') + '</h3><div class="exgrid">' + rest.map(exCard).join('') + '</div>' : '') +
    '</div>');
  const box = $('#dlgBox');
  box.classList.add('exbox-tab');
  for (const im of box.querySelectorAll('img[data-expic]')) exUrl(im.dataset.expic, 0).then(u => { if (u && im.isConnected) im.src = u; });
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-exshow]')) return exShow(exSorted(exOfWork(batch.id)), 0);
    if (e.target.closest('[data-exsheet]')) return exSheet(exSorted(exOfWork(batch.id)));
    exCardAct(e, () => exSorted(exOfWork(batch.id)), () => { if (dlgPage === 'examples') openExamples(); });
  };
}
// A click on an example's card, on the tab or the page. list() gives the examples Show to the class steps through; after() draws again once one is deleted.
function exCardAct(e, list, after) {
  const card = e.target.closest('[data-exid]'); if (!card) return;
  const r = exList.find(x => x.id === card.dataset.exid); if (!r) return;
  if (e.target.closest('[data-exopen]')) { const all = list(); return exShow(all, Math.max(0, all.findIndex(x => x.id === r.id))); }
  if (e.target.closest('[data-excopy]')) return exCopy(r);
  if (e.target.closest('[data-exdl]')) return exDownload(r);
  if (e.target.closest('[data-exwhy]')) return exWhyEdit(card, r);
  if (e.target.closest('[data-extags]')) return exTagsEdit(card, r);
  const tg = e.target.closest('[data-extag]');
  if (tg) { if ($('#exPage') && $('#exPage').contains(tg)) { exPageF.tag = tg.dataset.extag; exPageRender(); } return; }
  const del = e.target.closest('[data-exdel]');
  if (del) {   // two clicks, so a stray click can't throw an example away
    if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Click again to delete'; del.style.color = 'var(--bad)'; setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = 'Delete'; del.style.color = ''; } }, 4000); return; }
    kmClose();
    exDelete(r.id).then(() => { toast('Example deleted'); after(); }, er => { console.error(er); toast('That didn’t work. Try again.'); });
  }
}
function exWhyEdit(card, r) {
  kmClose();
  const p = card.querySelector('.exwhy'); if (!p || p.querySelector('input')) return;
  p.innerHTML = '<input type="text" class="exwhyin" maxlength="160" aria-label="Why it’s strong" placeholder="Why it’s strong">';
  const inp = p.firstChild; inp.value = r.why || ''; inp.focus();
  let done = false;
  const save = async keep => {
    if (done) return; done = true;
    const why = keep ? inp.value.trim().slice(0, 160) : r.why || '';
    if (why !== (r.why || '')) { try { await exPut({ ...r, why }); } catch (e) { console.error(e); toast('That didn’t work. Try again.'); } }
    const now = exList.find(x => x.id === r.id) || r;
    p.innerHTML = now.why ? esc(now.why) : '<button class="link exadd" data-exwhy>Add why it’s strong</button>';
    const m = card.querySelector('[data-exwhy].mitem'); if (m) m.textContent = now.why ? 'Change why it’s strong' : 'Add why it’s strong';
  };
  inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); save(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); save(false); } };
  inp.onblur = () => save(true);
}

/* the uses: Copy picture, Download, Download as a sheet, Show to the class */
async function exPng(r, n) {
  const b = await exPic(r.id, n); if (!b) throw new Error('the picture is missing');
  const im = await createImageBitmap(b), c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  c.getContext('2d').drawImage(im, 0, 0); im.close();
  const png = await new Promise((res, rej) => c.toBlob(x => x ? res(x) : rej(new Error('picture too big')), 'image/png'));
  c.width = 0;
  return png;
}
async function exCopy(r) {
  if (!exCanCopy()) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': exPng(r, 0) })]);
    // Once: a picture pasted into a lesson is kept with that lesson, where Claude can read it.
    if (store.get('gs.exCopied', false)) toast('Copied');
    else { store.set('gs.exCopied', true); toast('Copied. A picture you paste into a lesson is kept with that lesson.', 6000); }
  } catch (e) { console.error(e); toast('Copying didn’t work here. Use Download instead.'); }
}
// A PDF of pictures, each page as wide as a letter page.
async function exPdfOf(r) {
  const pdf = await PDFLib.PDFDocument.create();
  pdf.setTitle(exFileLabel(r)); pdf.setAuthor(''); pdf.setCreator('Grading Studio'); pdf.setProducer('');
  for (let n = 0; n < r.pages.length; n++) {
    const b = await exPic(r.id, n); if (!b) continue;
    const img = await pdf.embedJpg(new Uint8Array(await b.arrayBuffer())), W = 612, H = W * img.height / img.width;
    pdf.addPage([W, H]).drawImage(img, { x: 0, y: 0, width: W, height: H });
  }
  return pdf.save();
}
async function exDownload(r) {
  try {
    if (r.kind === 'paper') saveBlob(exFileName(r, 'pdf'), new Blob([await exPdfOf(r)], { type: 'application/pdf' }));
    else saveBlob(exFileName(r, 'png'), await exPng(r, 0));
  } catch (e) { console.error(e); toast('That download couldn’t be made: ' + (e.message || e), 6000); }
}
// Words the PDF's built-in font can write.
const exPdfText = s => String(s || '').replace(/[‘’]/g, '\'').replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
// One PDF: each question, its example answers and the why line, then whole papers and parts of pages. For printing or posting.
async function exSheet(list, name) {
  if (!list.length) return;
  toast('Making the sheet…');
  try {
    const pdf = await PDFLib.PDFDocument.create(), F = await pdf.embedFont(PDFLib.StandardFonts.Helvetica), B = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const title = exPdfText(name || list[0].title || 'Assignment'), PW = 612, PH = 792, M = 48, CW = PW - 2 * M, ink = PDFLib.rgb(0.12, 0.13, 0.15), soft = PDFLib.rgb(0.36, 0.38, 0.42), blue = PDFLib.rgb(0.1, 0.4, 0.66);
    pdf.setTitle(title + ' - Examples'); pdf.setAuthor(''); pdf.setCreator('Grading Studio'); pdf.setProducer('');
    let pg = null, y = 0;
    const page = () => { pg = pdf.addPage([PW, PH]); y = PH - M; };
    const room = h => { if (!pg || y - h < M) page(); };
    const wrap = (s, font, size, w) => { const out = []; let line = ''; for (const word of s.split(/\s+/).filter(Boolean)) { const t = line ? line + ' ' + word : word; if (font.widthOfTextAtSize(t, size) > w && line) { out.push(line); line = word; } else line = t; } if (line) out.push(line); return out; };
    page();
    pg.drawText(title, { x: M, y: y - 20, size: 20, font: B, color: ink }); y -= 30;
    pg.drawText('Strong examples, with no names on them', { x: M, y: y - 12, size: 11, font: F, color: soft }); y -= 34;
    let lastQ = null;
    for (const r of list) {
      const head = r.kind === 'answer' || r.kind === 'shot' ? exLabel(r) : r.kind === 'paper' ? 'Example ' + (r.letter || 'A') : 'Part of a page';
      if (r.kind !== 'answer' || lastQ !== (r.q && r.q.id)) {
        if (r.kind === 'paper' && pg && y < PH - M - 80) page();
        room(40);
        pg.drawText(exPdfText(head) + (r.row ? '   ' + exPdfText(r.row) : ''), { x: M, y: y - 14, size: 14, font: B, color: ink }); y -= 24;
        lastQ = r.kind === 'answer' ? r.q && r.q.id : null;
      }
      for (let n = 0; n < r.pages.length; n++) {
        const b = await exPic(r.id, n); if (!b) continue;
        const img = await pdf.embedJpg(new Uint8Array(await b.arrayBuffer()));
        const maxH = r.kind === 'paper' ? PH - 2 * M - 30 : 300, k = Math.min(CW / img.width, maxH / img.height), w = img.width * k, h = img.height * k;
        room(h + 8);
        pg.drawImage(img, { x: M, y: y - h, width: w, height: h });
        pg.drawRectangle({ x: M, y: y - h, width: w, height: h, borderColor: PDFLib.rgb(0.85, 0.86, 0.88), borderWidth: 0.6 });
        y -= h + 8;
      }
      if (exTags(r).length) { room(14); pg.drawText(exPdfText(exTags(r).join(', ')), { x: M, y: y - 10, size: 9.5, font: F, color: soft }); y -= 14; }
      if (r.why) for (const line of wrap('* ' + exPdfText(r.why), F, 11, CW)) { room(16); pg.drawText(line, { x: M, y: y - 11, size: 11, font: F, color: blue }); y -= 15; }
      y -= 14;
    }
    saveBlob((title + ' - Examples.pdf').replace(/[\\/:*?"<>|]+/g, '-'), new Blob([await pdf.save()], { type: 'application/pdf' }));
  } catch (e) { console.error(e); toast('The sheet couldn’t be made: ' + (e.message || e), 6000); }
}
// Full screen, white, one example at a time, large. Arrow keys move, + and − zoom, the why line can be hidden, Esc closes. No names anywhere.
let exShowKeys = null;
function exShow(list, start) {
  if (!list.length) return;
  exShowClose();
  const S = { list, at: clamp(start || 0, 0, list.length - 1), zoom: 1, note: true, full: false };
  const el = document.createElement('div'); el.id = 'exShow'; el.className = 'exshow'; el.tabIndex = -1; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Show to the class');
  document.body.appendChild(el);
  // the why line: under an answer, above a paper's pages so it's seen before scrolling
  const note = r => '<p class="exsnote' + (r.kind === 'paper' ? ' top' : '') + '"><span aria-hidden="true">★</span>' + esc(r.why) + '</p>';
  const draw = () => {
    const r = S.list[S.at];
    el.innerHTML = '<div class="exshd"><h2>' + esc(exLabel(r)) + '</h2><span class="exsbadge">' + (r.kind === 'answer' ? 'A strong answer' : r.kind === 'paper' ? 'A strong paper' : 'Strong work') + '</span><span class="sp"></span>' +
      (r.why ? '<button class="exslink" data-exsnote>' + (S.note ? 'Hide the note' : 'Show the note') + '</button>' : '') + '<button class="exslink" data-exsx>Esc to close</button></div>' +
      '<div class="exsbody">' + (r.why && S.note && r.kind === 'paper' ? note(r) : '') + '<div class="exspics ' + r.kind + '" style="--exz:' + S.zoom + '">' + r.pages.map((_, n) => '<img alt="" data-n="' + n + '">').join('') + '</div>' +
      (r.why && S.note && r.kind !== 'paper' ? note(r) : '') + '</div>' +
      '<div class="exsft"><button class="btn" data-exsgo="-1" aria-label="Earlier example"' + (S.at ? '' : ' disabled') + '>‹</button><span>' + (S.at + 1) + ' of ' + S.list.length + '</span><button class="btn" data-exsgo="1" aria-label="Next example"' + (S.at < S.list.length - 1 ? '' : ' disabled') + '>›</button><span class="sp"></span><span class="muted">No names are shown. Arrow keys move, + and − zoom.</span></div>';
    for (const im of el.querySelectorAll('img[data-n]')) exUrl(r.id, +im.dataset.n).then(u => { if (u && im.isConnected) im.src = u; });
    el.querySelector('.exsbody').scrollTop = 0;
  };
  const move = d => { const n = clamp(S.at + d, 0, S.list.length - 1); if (n !== S.at) { S.at = n; draw(); } };
  const zoom = d => { S.zoom = clamp(Math.round((S.zoom + d) * 100) / 100, 0.5, 2.5); const p = el.querySelector('.exspics'); if (p) p.style.setProperty('--exz', S.zoom); };
  el.onclick = e => {
    if (e.target.closest('[data-exsx]')) return exShowClose();
    if (e.target.closest('[data-exsnote]')) { S.note = !S.note; return draw(); }
    const g = e.target.closest('[data-exsgo]'); if (g) return move(+g.dataset.exsgo);
  };
  exShowKeys = e => {
    if (!$('#exShow')) return;
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === 'Escape') { stop(); return exShowClose(); }
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { stop(); return move(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { stop(); return move(-1); }
    if (e.key === '+' || e.key === '=') { stop(); return zoom(0.25); }
    if (e.key === '-' || e.key === '_' || e.key === '−') { stop(); return zoom(-0.25); }
    if (e.key === 'n' || e.key === 'N') { stop(); S.note = !S.note; return draw(); }
    stop();   // nothing underneath answers a key while the class is looking
  };
  document.addEventListener('keydown', exShowKeys, true);
  el._fs = () => { if (S.full && !document.fullscreenElement) exShowClose(); };
  document.addEventListener('fullscreenchange', el._fs);
  draw(); el.focus();
  try { const p = el.requestFullscreen && el.requestFullscreen(); if (p && p.then) p.then(() => { S.full = true; }, () => {}); } catch {}
}
function exShowClose() {
  const el = $('#exShow'); if (!el) return;
  if (exShowKeys) { document.removeEventListener('keydown', exShowKeys, true); exShowKeys = null; }
  document.removeEventListener('fullscreenchange', el._fs);
  if (gsFull.drop(el)) return;   // the whole page in full screen under it stays so (src/fullscreen.js)
  el.remove();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
/* carrying examples: the linked folder, the take-home file and Bring work in (part 2) */
// By id, the newer u wins, a deleted example's { gone } record too. With the same u, this browser's stays.
function exMergePlan(A, B) {
  const a = new Map(A.map(r => [r.id, r])), b = new Map(B.map(r => [r.id, r]));
  return { toA: B.filter(r => !a.has(r.id) ? !r.gone : exU(r) > exU(a.get(r.id))), toB: A.filter(r => !b.has(r.id) || exU(r) > exU(b.get(r.id))) };
}
// Puts records from elsewhere in, as they are. pics(r) gives their pictures; one whose pictures are missing or damaged is left out.
async function exTake(list, pics) {
  let n = 0;
  for (const r of list) {
    if (r.gone) { await exPut(r, null, true); n++; continue; }
    const blobs = await pics(r); if (!blobs || blobs.length !== (r.pages || []).length) continue;
    await exPut(r, blobs, true); n++;
  }
  return n;
}
function exRefreshViews() {
  exTabSay(); exRailSay();
  if (batch && dlgPage === 'examples') openExamples();
  if (!batch && routeNow().v === 'examples') exPageRender();
}
// The folder: examples/<id>.json holds { rec, pix: [{ hash, size }] }, with the pictures' bytes in files/ beside the papers. A deleted one stays as its { gone } record.
// Folder work never runs beside the folder's own saving: Forget clears out bytes nothing lists, and a picture written but not yet listed would go.
let exSyncP = null, exSyncAgain = false, exSyncT = 0;
function exFolderSoon() { clearTimeout(exSyncT); exSyncT = setTimeout(() => exFolderSync().catch(e => console.error(e)), 400); }
function exFolderSync(inSync) {
  if (typeof fld === 'undefined' || !fld.root || fld.state === 'none' || fld.state === 'ask' || fld.state === 'lost') return Promise.resolve();
  if (!inSync && (fld.run || fld.sync)) { exFolderSoon(); return Promise.resolve(); }   // the folder's sync brings examples up to date at its end anyway
  if (exSyncP) { exSyncAgain = true; return exSyncP; }
  exSyncP = exFolderRun().finally(() => { exSyncP = null; if (exSyncAgain) { exSyncAgain = false; exFolderSoon(); } });
  return exSyncP;
}
async function exFolderRun() {
  const dir = await fld.root.getDirectoryHandle('examples', { create: true }), ids = new Set(), B = new Map();
  for await (const [nm, h] of dir.entries()) { const m = h.kind === 'file' && /^(.+)\.json(?:\.new)?$/.exec(nm); if (m) ids.add(m[1]); }
  for (const id of ids) { const o = await readJson(dir, id + '.json'); if (o && o.rec && o.rec.id === id) B.set(id, o); }
  const A = await exAll();
  if (!A.length && !B.size) return;
  const { toA, toB } = exMergePlan(A, [...B.values()].map(o => o.rec));
  const got = await exTake(toA, async r => {
    const out = [];
    for (const ref of B.get(r.id).pix || []) { try { out.push(new Blob([await getBlob(ref)], { type: 'image/jpeg' })); } catch (e) { if (e.damaged || e.name === 'NotFoundError') return null; throw e; } }
    return out;
  });
  for (const r of toB) {
    if (r.gone) { await writeJson(dir, r.id + '.json', { rec: r, pix: [] }); continue; }
    const blobs = await exPics(r); if (!blobs) continue;
    const pix = []; for (const b of blobs) pix.push(await putBlob(new Uint8Array(await b.arrayBuffer())));
    await writeJson(dir, r.id + '.json', { rec: r, pix });
  }
  if (got) exRefreshViews();
}
// The bytes the folder's examples use, so Forget doesn't clear them out.
async function exFolderHashes() {
  try { await exSyncP; } catch {}
  const out = new Set();
  let dir; try { dir = await fld.root.getDirectoryHandle('examples'); } catch (e) { if (e.name === 'NotFoundError') return out; throw e; }
  const ids = new Set();
  for await (const [nm, h] of dir.entries()) { const m = h.kind === 'file' && /^(.+)\.json(?:\.new)?$/.exec(nm); if (m) ids.add(m[1]); }
  for (const id of ids) { const o = await readJson(dir, id + '.json'); for (const ref of (o && o.pix) || []) if (ref && ref.hash) out.add(ref.hash); }
  return out;
}
// Going back to a snapshot in the folder leaves examples as they are: they're anonymous pictures, kept apart from the work that goes back.
async function exKeepFor(rec) {
  if (!await exHave()) return;
  for (const name of ['ex', 'pix']) {
    const got = await exTx(name, 'readonly', tx => { const o = tx.objectStore(name), a = o.getAll(), b = o.getAllKeys(); return { get result() { return { k: b.result, v: a.result }; } }; });
    rec.stores[EX_DB + '/' + name] = got;
  }
}
// The take-home file: an { k: 'ex', rec } frame for each record, then an { k: 'expix', id, i } frame for each of its pictures. An older copy of the app skips both.
async function exTakeFrames(frame) {
  for (const r of await exAll()) {
    if (r.gone) { await frame({ k: 'ex', rec: r }); continue; }
    const blobs = await exPics(r); if (!blobs) continue;
    await frame({ k: 'ex', rec: r });
    for (let i = 0; i < blobs.length; i++) await frame({ k: 'expix', id: r.id, i }, new Uint8Array(await blobs[i].arrayBuffer()));
  }
}
// What Bring work in would do with a file's examples.
async function exBringPlan(B) {
  const A = await exAll(), { toA } = exMergePlan(A, Object.values(B.ex || {})), had = new Set(A.filter(r => !r.gone).map(r => r.id));
  return { list: toA, add: toA.filter(r => !r.gone && !had.has(r.id)).length, change: toA.filter(r => !r.gone && had.has(r.id)).length, drop: toA.filter(r => r.gone && had.has(r.id)).length };
}
// Remove from this computer takes examples too.
async function exRemoveAll() {
  clearTimeout(exSyncT);
  if (exDbP) { try { (await exDbP).close(); } catch {} exDbP = null; }
  await new Promise(res => { const r = indexedDB.deleteDatabase(EX_DB); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  exList = [];
}

/* the Examples page in the sidebar: every example, from every class and year (part 2) */
// The sidebar shows it once there is an example, like the tab on an assignment.
function exRailSay() {
  const a = $('#railExamples'); if (!a) return;
  let here = false; try { here = !batch && routeNow().v === 'examples'; } catch {}
  a.hidden = !exList.length && !here;
}
const exPageF = { cls: '', asg: '', kind: '', row: '', tag: '', q: '' };
const EX_KINDS = [['answer', 'Answers'], ['paper', 'Whole papers'], ['part', 'Parts of pages'], ['shot', 'Screenshots']];
const exAsgKey = r => r.asg || (r.work ? 'w:' + r.work : 'loose:' + (r.cls || '-'));
const exClassName = id => { const c = id && classById(id); return c ? c.name : id ? 'A class no longer here' : 'No class'; };
function exPageList() {
  const q = exPageF.q.trim().toLowerCase();
  return exList.filter(r => (!exPageF.cls || (r.cls || '-') === exPageF.cls) && (!exPageF.asg || exAsgKey(r) === exPageF.asg) && (!exPageF.kind || r.kind === exPageF.kind) && (!exPageF.row || r.row === exPageF.row) &&
    (!exPageF.tag || exTags(r).includes(exPageF.tag)) && (!q || [r.title, r.why, r.row, exLabel(r), ...exTags(r)].some(x => String(x || '').toLowerCase().includes(q))));
}
// One assignment's examples in the order the tab shows them: answers by question, then whole papers, then parts of pages.
const exPageSort = list => list.slice().sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'answer' ? -1 : b.kind === 'answer' ? 1 : a.kind === 'paper' ? -1 : 1) || (a.kind === 'answer' ? natural(String(a.q && a.q.lab), String(b.q && b.q.lab)) : 0) || a.t - b.t);
function exPageGroups(list) {
  const g = new Map();
  for (const r of list) { const k = exAsgKey(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
  return [...g.values()].map(exPageSort).sort((a, b) => Math.max(...b.map(r => r.t)) - Math.max(...a.map(r => r.t)));
}
function exPageRender() {
  const el = $('#exPage'); if (!el) return;
  exRailSay();
  const opts = (key, list, all) => '<select class="btn sm" data-exf="' + key + '" aria-label="' + all + '"><option value="">' + all + '</option>' + list.map(([v, l]) => '<option value="' + esc(v) + '"' + (exPageF[key] === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
  const uniq = pairs => [...new Map(pairs).entries()];
  const classes = uniq(exList.map(r => [r.cls || '-', exClassName(r.cls)])).sort((a, b) => natural(a[1], b[1]));
  const asgs = uniq(exList.filter(r => !exPageF.cls || (r.cls || '-') === exPageF.cls).map(r => [exAsgKey(r), r.title || 'Assignment'])).sort((a, b) => natural(a[1], b[1]));
  const rows = uniq(exList.filter(r => r.row).map(r => [r.row, r.row])).sort((a, b) => natural(a[1], b[1]));
  const tags = exAllTags().map(t => [t, t]);
  const list = exPageList(), groups = exPageGroups(list), filtered = Object.values(exPageF).some(x => String(x).trim());
  const typing = document.activeElement && document.activeElement.id === 'exFind', at = typing ? document.activeElement.selectionStart : 0;
  el.innerHTML = !exList.length ? '<div class="exempty"><p><b>No examples yet.</b></p><p class="muted">Press ☆ Example on an answer in Quick mark, pick <b>Use as an example</b> in a paper’s ⋯ menu, or take a screenshot (S on a paper, ⌥S anywhere) and save it as a strong example. Every example from every class shows here.</p></div>'
    : '<div class="exbar">' + opts('cls', classes, 'Every class') + opts('asg', asgs, 'Every assignment') + opts('kind', EX_KINDS.filter(k => exList.some(r => r.kind === k[0])), 'Every kind') + (rows.length ? opts('row', rows, 'Every rubric row') : '') + (tags.length ? opts('tag', tags, 'Every tag') : '') +
      '<input type="search" id="exFind" class="exfind" placeholder="Search examples" aria-label="Search the examples" value="' + esc(exPageF.q) + '">' +
      (filtered ? '<button class="link" data-exfclear>Clear</button>' : '') + '<span class="sp"></span><span class="muted exn">' + list.length + (list.length === 1 ? ' example' : ' examples') + '</span>' +
      (list.length ? '<button class="btn sm" data-exsheet>Download as a sheet</button>' : '') + (list.length ? '<button class="btn sm primary" data-exshow>Show to the class</button>' : '') + '</div>' +
      (!list.length ? '<p class="muted exnone2">None match. <button class="link" data-exfclear>Clear the filters</button></p>' : '') +
      groups.map(g => '<section class="exgroup"><h2 class="exgh">' + esc(g[0].title || 'Assignment') + ' <span class="muted">· ' + esc(exClassName(g[0].cls)) + ' · ' + esc(new Date(Math.max(...g.map(r => r.t))).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })) + '</span></h2><div class="exgrid">' + g.map(exCard).join('') + '</div></section>').join('');
  for (const im of el.querySelectorAll('img[data-expic]')) exUrl(im.dataset.expic, 0).then(u => { if (u && im.isConnected) im.src = u; });
  if (typing) { const f = $('#exFind'); if (f) { f.focus(); try { f.setSelectionRange(at, at); } catch {} } }
}
{
  const page = () => exPageGroups(exPageList()).flat();
  const el = $('#exPage');
  if (el) {
    el.addEventListener('input', e => { if (e.target.id === 'exFind') { exPageF.q = e.target.value; exPageRender(); } });
    el.addEventListener('change', e => { const f = e.target.closest('[data-exf]'); if (!f) return; exPageF[f.dataset.exf] = f.value; if (f.dataset.exf === 'cls') exPageF.asg = ''; exPageRender(); });
    el.addEventListener('click', e => {
      if (e.target.closest('[data-exfclear]')) { for (const k of Object.keys(exPageF)) exPageF[k] = ''; return exPageRender(); }
      if (e.target.closest('[data-exshow]')) return exShow(page(), 0);
      if (e.target.closest('[data-exsheet]')) { const l = page(); return exSheet(l, new Set(l.map(exAsgKey)).size > 1 ? 'Strong examples' : null); }
      exCardAct(e, page, exPageRender);
    });
  }
}
exReady.then(exRailSay);

Object.assign(window.__gs, { exList: () => exList, exReady: () => exReady, exStar, openUseExample, openExamples, exShow, exSheet, exPdfOf, exPng, exDownload, exForgetWork, exUse: () => EXU, exItems, exAll, exFolderSync: () => exFolderSync(), exMergePlan, exPageRender, exPageF, exDeleteTest: exDelete, exSaveShot, exTagsOf, exShotWhere });
