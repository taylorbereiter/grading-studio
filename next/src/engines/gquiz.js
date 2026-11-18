// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
// the papers' documents are let go once the answers being cut from them are done, so a cut under way isn't cancelled
export const qzLetGo = () => qzQueue.then(() => qzClose());
import { batch, cur, setup, disp, inkColor, CHECK_INK, tr, saveSoon, pdfjsLib, workerReady, renderList, renderGrade, store, fmtNum, COLORS, PTS_AMBER, QZ_GOLD, NOTE_COLORS, ptsColor, totalInk, noScore, quizOn, quizMarks, quizCount, quizPart, ibSetup } from './gcore.js';
import { FONT, measureCtx, rotOf, vpRot, skewOf, skewXf, vpDraw, viewable, fileByPath, layoutOf, docIn, docAuto, anonOn, anonOrder, anonRx, lightForPage, lightCanvas, quizLabel, qzAnsLab, viewBytes, stampHidden } from './gdraw.js';
import { boxKey, tryOfFile, ibStampText } from './gopen.js';
import { keepOnPage, redrawAll, r1, clamp, touchGrade, liftStatus, stampOwner } from './gmark.js';
import { shareState, autoCovers, keptCovers, scanClip, IB_TOP, ibCrit } from './gexport.js';
import { stickerText } from './gcalc.js';
import { ibTaskClass } from './gsetup.js';

// src/app/anon.js
async function anonPaint(ctx, st, f, p, page, vp, turned) {
  let cs = [];
  try { cs = keptCovers(await autoCovers(page, vp, anonRx(st), skewXf(f, p, vp)), f.path, p, vp.width, vp.height); } catch (er) { console.error(er); }
  ctx.fillStyle = '#111';
  for (const r of cs) ctx.fillRect(r.x, r.y, r.w, r.h);
  for (let b of shareState().boxes[boxKey(f.path, p)] || []) {
    for (let n = turned || 0; n > 0; n -= 90) b = [1 - b[1] - b[3], b[0], b[3], b[2]];
    ctx.fillRect(b[0] * vp.width, b[1] * vp.height, b[2] * vp.width, b[3] * vp.height);
  }
}
// src/quiz.js
const QZ_PAD = 0.012;   // a little room around each box, since scans sit a bit differently
// src/quiz.js
const QZ_HOW = { x: '✗ on wrong', cx: '✓ and ✗', pts: 'Points' };
// src/quiz.js
const quizMax = () => quizOn() ? batch.quiz.qs.reduce((a, q) => a + (+q.pts || 0), 0) : 0;
// src/quiz.js
const qzHow = q => q.how || 'old';
// src/quiz.js
const qzByPts = q => q.kind ? q.kind === 'scale' : qzHow(q) === 'pts' || (+q.pts || 1) !== 1;
// src/quiz.js
const QZ_KIND = { rw: 'Right / wrong', scale: 'Scale' };
// src/quiz.js
const qzSteps = pts => { const a = []; for (let s = 0; s <= pts; s++) a.push(s); if (pts % 1) a.push(pts); return a; };
// src/quiz.js
const qzWordsOk = w => w && typeof w === 'object' && !Array.isArray(w) && Object.values(w).every(l => Array.isArray(l) && l.every(x => typeof x === 'string'));
// src/quiz.js
const qzWordsMine = () => { const w = store.get('gs.qmWords', null); return qzWordsOk(w) ? w : {}; };
// src/quiz.js
const qzWordsAll = () => ({ ...qzWordsMine(), ...(batch && batch.quiz && qzWordsOk(batch.quiz.words) ? batch.quiz.words : {}) });
// src/quiz.js
function qzStepWords(pts, all = qzWordsAll()) {
  const n = qzSteps(pts).length, own = all[String(pts)];
  if (own && own.length === n) return own.slice();
  if (n === 3) return ['Not shown', 'Partial', 'Full'];
  return Array.from({ length: n }, (_, k) => k === 0 ? 'Not shown' : k === n - 1 ? 'Full' : '');
}
// src/quiz.js
const qzWord = (s, pts) => qzStepWords(pts)[qzSteps(pts).indexOf(s)] || '';
// src/quiz.js
const quizPages = st => layoutOf(st).filter(d => docIn(st, d) || docAuto(st, d)).flatMap(d => d.pages.filter(([path]) => { const f = fileByPath(st, path); return f && !f.virtual && viewable(f) && !tryOfFile(st, f); }));
// src/quiz.js
const quizSum = st => { const m = quizMarks(st); return batch.quiz.qs.reduce((a, q) => a + (m[q.id] != null ? +m[q.id] : 0), 0); };
// src/quiz.js
function quizWho() {
  const order = anonOn() ? anonOrder() : batch.students.map((_, i) => i);
  return order.filter(i => { const st = batch.students[i]; return !noScore(st) && quizPages(st).length; });
}
// src/quiz.js
const qzDocs = new Map();     // file path -> pdf.js document, while Quick mark is open
// src/quiz.js
const qzCrops = new Map();    // student|question|shift|spot|light -> { url, r }: the picture and the part of the page it shows
// src/quiz.js
const qzSize = new Map();     // student|page -> { W, H }, the page's size in points
// src/quiz.js
let qzQueue = Promise.resolve();
// src/quiz.js
async function qzDoc(f) {
  if (!qzDocs.has(f.path)) qzDocs.set(f.path, viewBytes(f).then(b => pdfjsLib.getDocument({ data: b.slice(), isEvalSupported: false }).promise));
  return qzDocs.get(f.path);
}
// src/quiz.js
function qzClose() {
  for (const p of qzDocs.values()) p.then(d => d.destroy(), () => {});
  qzDocs.clear();
}
// src/quiz.js
function qzForget() { for (const c of qzCrops.values()) URL.revokeObjectURL(c.url); qzCrops.clear(); qzSize.clear(); }
// src/quiz.js
const qzShift = (st, n) => ((batch.quiz.shift || {})[st.key] || {})[n] || [0, 0];
// src/quiz.js
const qzSz = (st, n) => qzSize.get(st.key + '|' + n) || { W: 612, H: 792 };
// src/quiz.js
const qzOwn = (st, q) => ((batch.quiz.spot || {})[st.key] || {})[q.id] || null;
// src/quiz.js
function qzSpot(st, q, sz) {
  sz = sz || qzSz(st, q.n);
  const [dx, dy] = qzShift(st, q.n), own = qzOwn(st, q);
  if (own) return { x: own[0] + dx, y: own[1] + dy, own: true };
  if (q.mx != null) return { x: q.mx + dx, y: q.my + dy };
  const right = batch.quiz.side === 'right';
  return { x: right ? q.x + dx + q.w + 15 / sz.W : Math.max(13 / sz.W, q.x + dx - 15 / sz.W), y: Math.max(12 / sz.H, q.y + dy + 12 / sz.H), margin: true, right };
}
// src/quiz.js
function qzCropKey(st, q) {
  const [path, p] = quizPages(st)[q.n] || [], f = path && fileByPath(st, path), L = f ? lightForPage(st, f, p) : null;
  return st.key + '|' + q.id + '|' + [q.n, q.x, q.y, q.w, q.h].join(',') + '|' + qzShift(st, q.n).join(',') + '|' + [q.mx, q.my, batch.quiz.side, qzOwn(st, q)].join(',') + '|' +
    (L ? JSON.stringify(L) : '') + '|' + (f ? rotOf(f, p) + ',' + skewOf(f, p) : '');
}
// src/quiz.js
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
// src/quiz.js
function qzRect(st, q) {
  const [dx, dy] = qzShift(st, q.n), sz = qzSz(st, q.n), s = qzSpot(st, q, sz), ex = 30 / sz.W, ey = 14 / sz.H;
  const x0 = clamp(Math.min(q.x + dx - QZ_PAD, s.x - ex), 0, 1), y0 = clamp(Math.min(q.y + dy - QZ_PAD, s.y - ey), 0, 1);
  const x1 = clamp(Math.max(q.x + dx + q.w + QZ_PAD, s.x + ex), 0, 1), y1 = clamp(Math.max(q.y + dy + q.h + QZ_PAD, s.y + ey), 0, 1);
  return { x: x0, y: y0, w: Math.max(0.001, x1 - x0), h: Math.max(0.001, y1 - y0) };
}
// src/quiz.js
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
// src/quiz.js
async function qzCrop(st, q) {
  const k = qzCropKey(st, q);
  if (!qzCrops.has(k)) await qzCut(st, q.n);
  return qzCrops.get(k) || null;
}
// src/quiz.js
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
// src/quiz.js
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
// src/quiz.js
function quizScore(st) {
  if (ibQzOn()) return ibQzScore(st);
  const g = st.grade, n = quizCount(st);
  const v = n ? fmtNum(quizSum(st)) : '';
  if (!n && !g.qAuto) return;
  if (String(g.points) !== v) { g.points = v; touchGrade(st, 'points'); if (v !== '') liftStatus(st); }
  g.qAuto = !!n || undefined;
}
// src/quiz.js
function qzLook(q, v) {
  if (v == null) return null;
  const pts = +q.pts || 1, how = qzHow(q), text = fmtNum(v) + '/' + fmtNum(pts);
  if (how === 'pts') return { k: 'text', text };
  if (v <= 0) return { k: 'x' };
  if (v >= pts) return how === 'x' ? null : how === 'cx' || pts === 1 || !qzByPts(q) ? { k: 'check' } : { k: 'text', text };
  return { k: 'text', text };
}
// src/quiz.js
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
      list.push({ t: 'text', color: ptsColor(v, +q.pts || 1), x: r1(Math.max(2, x)), y: r1(Math.max(2, cy - 8)), size: 14, text: look.text, qz: q.id });
    }
  }
  await qzAns(st, q, v, list);
  if (!list.length) delete f.marks[p];
}
// src/quiz.js
const QZ_ANS = { miss: 'Where points were lost', all: 'Every question', off: 'Off' };
// src/quiz.js
const qzAnsMode = () => (batch.quiz && QZ_ANS[batch.quiz.ans]) ? batch.quiz.ans : 'off';
// src/quiz.js
const qzAnsText = q => tr('Answer') + ': ' + String(q.key || '').trim();
// src/quiz.js
function qzAnsWant(q, v) {
  const mode = qzAnsMode();
  if (v == null || mode === 'off' || !String(q.key || '').trim()) return false;
  return mode === 'all' || v < (+q.pts || 1);
}
// src/quiz.js
const QZ_AT = { right: 'Right of each box', under: 'Under each box', mark: 'By the mark' };
// src/quiz.js
const qzAnsAt = () => (batch.quiz && QZ_AT[batch.quiz.at]) ? batch.quiz.at : 'right';
// src/quiz.js
function qzAnsSpot(st, q, sz) {
  const [dx, dy] = qzShift(st, q.n), at = qzAnsAt();
  let x, y;
  if (q.nx != null) { x = (q.nx + dx) * sz.W; y = (q.ny + dy) * sz.H; }
  else if (at === 'under') { x = (q.x + q.w + dx) * sz.W - 10; y = (q.y + q.h + dy) * sz.H + 6; }
  else if (at === 'mark') { const s = qzSpot(st, q, sz); x = s.x * sz.W + 16; y = s.y * sz.H; }
  else { x = (q.x + q.w + dx) * sz.W; y = (q.y + q.h / 2 + dy) * sz.H + 6; }
  return [r1(clamp(x, 4, sz.W - 4)), r1(clamp(y, 4, sz.H - 4))];
}
// src/quiz.js
function qzAnsOld(st, q, sz) {
  const [dx, dy] = qzShift(st, q.n);
  return [r1(clamp((q.x + q.w + dx) * sz.W, 4, sz.W - 4)), r1(clamp((q.y + q.h / 2 + dy) * sz.H + 6, 4, sz.H - 4))];
}
// src/quiz.js
const qzMoved = m => !!m.qza && (!!m.qzm || (!!m.qzp && (Math.abs(m.ax - m.qzp[0]) > 0.6 || Math.abs(m.ay - m.qzp[1]) > 0.6)));
// src/quiz.js
async function qzAns(st, q, v, list) {
  const i = list.findIndex(m => m.qza === q.id), old = i >= 0 ? list[i] : null;
  if (!qzAnsWant(q, v)) { if (old) list.splice(i, 1); return; }
  const sz = await qzPageSize(st, q.n);
  if (old) { old.text = qzAnsText(q); old.color = QZ_GOLD; }
  if (!sz) return;
  const [dx, dy] = qzShift(st, q.n), at = qzAnsSpot(st, q, sz), n = old || { t: 'note', color: QZ_GOLD, text: qzAnsText(q), qza: q.id };
  n.qzl = qzAnsLab(q);
  n.qzr = [r1((q.x + dx) * sz.W), r1((q.y + dy) * sz.H), r1(q.w * sz.W), r1(q.h * sz.H)];
  if (old) {
    const was = old.qzp || qzAnsOld(st, q, sz);
    if (old.qzm || Math.abs(old.ax - was[0]) > 0.6 || Math.abs(old.ay - was[1]) > 0.6) { old.qzm = 1; delete old.qzp; return; }
    if (old.ly != null) old.ly = r1(old.ly + at[1] - old.ay);
  } else list.push(n);
  n.ax = at[0]; n.ay = at[1]; n.qzp = at;
}
// src/quiz.js
function qzAnsOf(st, q) {
  const [path, p] = quizPages(st)[q.n] || [], f = path && fileByPath(st, path), l = f && f.marks[p];
  return (l && l.find(m => m.qza === q.id)) || null;
}
// src/quiz.js
async function qzTotal(st) {
  const t = batch.quiz.total;
  for (const [path, p] of quizPages(st)) { const f = fileByPath(st, path), l = f && f.marks[p]; if (l) for (let i = l.length - 1; i >= 0; i--) if (l[i].qz === 'total' && !stampHidden(l[i], st.key)) l.splice(i, 1); }
  if (!t || quizCount(st) < batch.quiz.qs.length) return;
  const text = ibQzOn() ? ibStampText(st) : stickerText(quizSum(st));
  if (!text) return;
  const [path, p] = quizPages(st)[t.n] || [], f = path && fileByPath(st, path), sz = await qzPageSize(st, t.n);
  if (!f || !sz) return;
  const [dx, dy] = qzShift(st, t.n);
  (f.marks[p] ||= []).push(stampOwner({ t: 'stamp', k: 'score', text, x: r1((t.x + dx) * sz.W), y: r1((t.y + dy) * sz.H), size: 52, color: totalInk(), qz: 'total' }, st));
}
// src/quiz.js
async function qzRedoPaper(st) {
  const m = quizMarks(st);
  for (const q of batch.quiz.qs) if (m[q.id] != null) await qzPaper(st, q, m[q.id]);
  await qzTotal(st);
}
// src/quiz.js
function qzDropGone(keep) {
  for (const sp of Object.values(batch.quiz.spot || {})) for (const id of Object.keys(sp)) if (!keep.has(id)) delete sp[id];
  for (const st of batch.students) {
    const m = st.grade.q; if (!m) continue;
    let hit = false;
    for (const id of Object.keys(m)) if (!keep.has(id)) { delete m[id]; hit = true; }
    for (const f of st.files) for (const l of Object.values(f.marks || {})) for (let i = l.length - 1; i >= 0; i--) if ((l[i].qz && l[i].qz !== 'total' && !keep.has(l[i].qz)) || (l[i].qza && !keep.has(l[i].qza))) { l.splice(i, 1); hit = true; }
    if (hit) quizScore(st);
  }
}
// src/quiz.js
function qzMarkInk(id, st) {
  const q = batch.quiz.qs.find(x => x.id === id), v = quizMarks(st)[id];
  return q && v != null ? ptsColor(v, +q.pts || 1) : ptsColor();
}
// src/quiz.js
function qzNoteOf(st, q) {
  const [path, p] = quizPages(st)[q.n] || [], f = path && fileByPath(st, path), l = f && f.marks[p];
  return (l && l.find(m => m.qzn === q.id)) || null;
}
// src/quiz.js
async function qzNoteSet(st, q, text, as, col) {
  const [path, p] = quizPages(st)[q.n] || [], f = path && fileByPath(st, path);
  if (!f) return;
  const list = (f.marks[p] ||= []), i = list.findIndex(m => m.qzn === q.id), old = i >= 0 ? list[i] : null;
  if (i >= 0) list.splice(i, 1);
  if (text) {
    const sz = await qzPageSize(st, q.n); if (!sz) return;
    store.set('gs.qmNoteAs', as);
    const [dx, dy] = qzShift(st, q.n), W = sz.W, H = sz.H, color = as === 'text' && col === NOTE_COLORS.yellow ? PTS_AMBER : as === 'note' && col === PTS_AMBER ? NOTE_COLORS.yellow : col || COLORS[inkColor] || COLORS.red;   // yellow is a shade lighter on a comment, which draws darker
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
// src/quiz.js
async function qzAnswerPic(st, q, qi) {
  const [path, p] = quizPages(st)[q.n] || [], f = path && fileByPath(st, path);
  if (!f) return null;
  await workerReady;
  const js = await qzDoc(f), page = await js.getPage(p + 1), v1 = vpRot(f, p, page, 1), k = 1600 / v1.width, vp = vpRot(f, p, page, k);
  const pc = document.createElement('canvas'); pc.width = Math.ceil(vp.width); pc.height = Math.ceil(vp.height);
  const pctx = pc.getContext('2d'); pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, pc.width, pc.height);
  await page.render({ canvasContext: pctx, ...vpDraw(f, p, page, k), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
  scanClip(pctx, f, p, vp.width, pc.width, pc.height);
  const L = lightForPage(st, f, p); if (L) lightCanvas(pctx, pc.width, pc.height, L);
  await anonPaint(pctx, st, f, p, page, vp);
  page.cleanup();
  const [dx, dy] = qzShift(st, q.n);
  const x0 = clamp(q.x + dx - QZ_PAD, 0, 1), y0 = clamp(q.y + dy - QZ_PAD, 0, 1), x1 = clamp(q.x + dx + q.w + QZ_PAD, 0, 1), y1 = clamp(q.y + dy + q.h + QZ_PAD, 0, 1);
  const sx = Math.round(x0 * pc.width), sy = Math.round(y0 * pc.height), sw = Math.max(1, Math.round((x1 - x0) * pc.width)), sh = Math.max(1, Math.round((y1 - y0) * pc.height));
  // The words on top, wrapped to the picture's width.
  const pts = +q.pts || 1, words = qzByPts(q) ? qzStepWords(pts) : [];
  const lines = [['600', 'Question ' + quizLabel(q, qi) + ' · ' + (qzByPts(q) ? 'scored 0 to ' + fmtNum(pts) : fmtNum(pts) + (pts === 1 ? ' point' : ' points') + ', right or wrong')]];
  if (q.key) lines.push(['400', 'Answer key: ' + q.key]);
  if (words.some(Boolean)) lines.push(['400', 'Scale: ' + qzSteps(pts).map((v, i) => fmtNum(v) + (words[i] ? ' ' + words[i] : '')).join(', ')]);
  const W = Math.max(sw, 560), pad = 16, fs = 20, lh = 28, font = w => w + ' ' + fs + 'px Inter, system-ui, sans-serif';
  const m = document.createElement('canvas').getContext('2d'), rows = [];
  for (const [w, t] of lines) {
    m.font = font(w); let row = '';
    for (const word of t.split(' ')) { const next = row ? row + ' ' + word : word; if (row && m.measureText(next).width > W - pad * 2) { rows.push([w, row]); row = word; } else row = next; }
    rows.push([w, row]);
  }
  const top = pad + rows.length * lh + pad - 8;
  const c = document.createElement('canvas'); c.width = W; c.height = top + sh + pad;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#1F2933'; ctx.textBaseline = 'top';
  rows.forEach(([w, t], i) => { ctx.font = font(w); ctx.fillText(t, pad, pad + i * lh); });
  ctx.fillStyle = '#E4E6EA'; ctx.fillRect(0, top - 1, W, 1);
  ctx.drawImage(pc, sx, sy, sw, sh, Math.round((W - sw) / 2), top + pad / 2, sw, sh);
  pc.width = pc.height = 0;
  return c;
}
// src/ib.js
const ibQzOn = () => !!(ibTaskClass() && quizOn());
// src/ib.js
function ibQzOf(q, c) { const ks = ibCrit(c).map(x => x.k); return ks.includes(q.ib) ? q.ib : (ibSetup() && setup.ib.find(k => ks.includes(k))) || ks[0]; }
// src/ib.js
function ibQzUsed(Q, c) { const u = new Set(Q.qs.map(q => ibQzOf(q, c))); return ibCrit(c).filter(x => u.has(x.k)).map(x => x.k); }
// src/ib.js
const ibQzMax = (Q, c, k) => Q.qs.reduce((a, q) => a + (ibQzOf(q, c) === k ? +q.pts || 0 : 0), 0);
// src/ib.js
const ibQzRaw = (Q, k) => { const t = Q.lvb && Q.lvb[k]; return Array.isArray(t) && t.length === IB_TOP ? t : null; };
// src/ib.js
function ibQzTable(Q, k) { const t = ibQzRaw(Q, k); return t && t.every((v, i) => typeof v === 'number' && v > 0 && (!i || v >= t[i - 1])) ? t : null; }
// src/ib.js
function ibQzLevel(t, pts) { let l = 0; t.forEach((v, i) => { if (pts >= v) l = i + 1; }); return l; }
// src/ib.js
const ibQzEven = max => Array.from({ length: IB_TOP }, (_, i) => Math.max(0.5, Math.ceil(max * (i + 1) / IB_TOP * 2) / 2));
// src/ib.js
function ibQzParts(st) {
  const c = ibTaskClass(), Q = batch.quiz, m = quizMarks(st);
  return ibQzUsed(Q, c).map(k => {
    const qs = Q.qs.filter(q => ibQzOf(q, c) === k), done = qs.every(q => m[q.id] != null), t = ibQzTable(Q, k);
    const pts = qs.reduce((a, q) => a + (m[q.id] != null ? +m[q.id] : 0), 0);
    return { k, pts, max: ibQzMax(Q, c, k), any: qs.some(q => m[q.id] != null), lv: done && t ? ibQzLevel(t, pts) : null };
  });
}
// src/ib.js
function ibQzScore(st) {
  const g = st.grade, was = g.qAutoL || {}, now = {}; let hit = false;
  g.rubric ||= [];
  for (const p of ibQzParts(st)) {
    const i = setup.ib.indexOf(p.k); if (i < 0 || p.lv == null) continue;
    now[p.k] = 1;
    if (g.rubric[i] !== p.lv) { g.rubric[i] = p.lv; touchGrade(st, i); hit = true; }
  }
  for (const k of Object.keys(was)) { const i = setup.ib.indexOf(k); if (!now[k] && i >= 0 && g.rubric[i] != null) { g.rubric[i] = null; touchGrade(st, i); } }
  if (g.qAuto) { g.points = ''; delete g.qAuto; }
  if (Object.keys(now).length) g.qAutoL = now; else delete g.qAutoL;
  if (hit) liftStatus(st);
}
// src/ib.js
function ibQzSay(st) { return ibQzParts(st).map(p => p.k + ' ' + fmtNum(p.pts) + ' / ' + fmtNum(p.max) + (p.lv != null ? ', level ' + p.lv : '')).join(' · '); }
export { QZ_PAD, QZ_HOW, QZ_KIND, QZ_ANS, QZ_AT, quizOn, quizMax, quizLabel, qzHow, qzByPts, qzSteps, qzWordsOk, qzWordsMine, qzWordsAll, qzStepWords, qzWord, quizPages, quizMarks, quizCount, quizPart, quizSum, quizWho, qzDoc, qzClose, qzForget, qzShift, qzSz, qzOwn, qzSpot, qzCropKey, qzPage, qzRect, qzCut, qzCrop, qzPageSize, quizSet, quizScore, qzLook, qzPaper, qzAnsMode, qzAnsText, qzAnsWant, qzAnsAt, qzAnsSpot, qzAnsOld, qzMoved, qzAnsLab, qzAns, qzAnsOf, qzTotal, qzRedoPaper, qzDropGone, qzNoteOf, qzNoteSet, qzMarkInk, qzAnswerPic, ibQzOn, ibQzOf, ibQzUsed, ibQzMax, ibQzRaw, ibQzTable, ibQzLevel, ibQzEven, ibQzParts, ibQzScore, ibQzSay };
