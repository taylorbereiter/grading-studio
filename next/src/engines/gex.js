// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, pdfjsLib, workerReady, maxPoints, gradeOf, fmtNum, COLORS } from './gcore.js';
import { vpRot, skewXf, vpDraw, viewable, fileByPath, layoutOf, docIn, docAuto, batchClass, lightForPage, lightCanvas, namesNow, coverRx, one } from './gdraw.js';
import { clamp } from './gmark.js';
import { autoCovers, ownCovers, keptCovers, isScoreMark, classCommon, shareOpts, people, nameFreeText } from './gexport.js';
import { QZ_PAD, quizPages, qzDoc, qzShift } from './gquiz.js';

// src/people.js
function personOf(st) {
  const c = batchClass();
  if (!c) return { c: null, name: null, folder: st.key };
  if (st.gap && c.names.includes(st.key)) return { c, name: st.key };
  const n = (namesNow().roster.get(st.key) || [])[0];
  return n ? { c, name: n, folder: st.key } : { c, name: null, folder: st.key };
}
// src/examples.js
const exTitleNow = () => nameFreeText((batch.assignment && batch.assignment.name) || batch.name || 'Assignment');
// src/examples.js
const exFrom = st => ({ key: st.key });
// src/examples.js
const exWho = st => { try { const p = st && personOf(st); return p && p.c && p.name ? { c: p.c.id, n: p.name } : null; } catch { return null; } };
// src/examples.js
const exJpg = c => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('picture too big')), 'image/jpeg', 0.88));
// src/examples.js
async function exCovers(st, f, page, p) {
  const vp = vpRot(f, p, page, 1);
  let auto = [];
  try { auto = keptCovers(await autoCovers(page, vp, coverRx(st), skewXf(f, p, vp), shareOpts(st)), f.path, p, vp.width, vp.height); } catch (e) { console.error(e); }
  return auto.concat(ownCovers(f.path, p, vp.width, vp.height));
}
// src/examples.js
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
// src/examples.js
function exItems(st) {
  const out = [];
  // a file still waiting for its first mark counts; one she left out herself doesn't
  for (const d of layoutOf(st).filter(d => docIn(st, d) || docAuto(st, d))) for (const [path, p] of d.pages) { const f = fileByPath(st, path); if (f && !f.virtual && viewable(f)) out.push({ f, p, path }); }
  for (const f of st.files) if (f.kind === 'docx' && !f.virtual && !f.rubric && f.data) out.push({ word: f });
  return out;
}
// src/examples.js
function exScoreText(st) {
  const g = gradeOf(st);
  if (g.status === 'missing' || g.status === 'excused' || (g.total == null && g.pct == null)) return '';
  return (g.total != null ? fmtNum(g.total) + ' / ' + fmtNum(g.outOf != null ? g.outOf : maxPoints()) : '') + (g.pct != null ? (g.total != null ? '   ' : '') + g.pct + '%' : '');
}
// src/examples.js
const exScoreMarks = st => st.files.some(f => Object.values(f.marks || {}).some(l => (l || []).some(isScoreMark)));
// src/examples.js
const exScoreTop = (U, ks) => !U.score ? '' : U.marks && U.kind !== 'part' && ks.some(k => { const it = U.items[k]; return it && ((it.f.marks || {})[it.p] || []).some(isScoreMark); }) ? '' : exScoreText(U.st);
// src/examples.js
function exScoreOn(c, text) {
  if (!text) return;
  const ctx = c.getContext('2d'), s = Math.max(14, Math.round(c.width * 0.028));
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '600 ' + s + 'px Inter, Arial, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillStyle = COLORS.red;
  ctx.fillText(text, c.width - s, s * 0.8);
  ctx.restore();
}
export { exAnswerPic, exItems, exScoreText, exScoreMarks, exScoreOn, exScoreTop, exJpg, coverRx, exWho, exFrom, exTitleNow };
