// A student's paper on the marking screen: their pages, each a canvas, drawn the way the current app draws them (src/app/student.js
// openStudent, src/app/arrange.js renderPage and draw). The page objects have today's shape ({ file, idx, page, W, H, side, s, canvas,
// bmp, marks() }), so the lifted drawing and marking code works on them unchanged, and a page draws to the same pixels in both apps.
import { use, state, batch as B } from '../../engines/gcore.js';
import * as D from '../../engines/gdraw.js';
import { PARTS } from '../router.js';

let pdfjs = null, viewW = null;
export async function libs() {
  if (!pdfjs) { const m = await PARTS.pdf(); pdfjs = m.pdfjs(); use({ pdfjsLib: pdfjs }); }
  return pdfjs;
}
function viewWorker() { try { if (!viewW || viewW.destroyed) viewW = new pdfjs.PDFWorker({ name: 'papers' }); return viewW; } catch { return undefined; } }

// The open student's documents and pages, in the order the current app shows them (fileSeq). token: a newer open cancels this one.
// before(f): anything to do to a file before it's drawn (marks from other apps made hers, when she asked for that).
export async function openPages(st, live, before) {
  await libs();
  const docs = [], docMap = new Map(), pages = [], cards = [];
  for (const d of state().docs) d.destroy();
  use({ docs, docMap, pages, selected: null });
  for (const f of st.files.filter(D.viewable)) {
    try {
      if (before) { try { await before(f); } catch (e) { console.error(e); } if (!live()) return null; }
      const doc = await pdfjs.getDocument({ data: (await D.viewBytes(f)).slice(), isEvalSupported: false, worker: viewWorker() }).promise;
      if (!live()) { doc.destroy(); return null; }
      docs.push(doc); docMap.set(f.path, doc); f.numPages = doc.numPages;
    } catch (e) { console.error(e); f.bad = true; }
  }
  for (const it of D.fileSeq(st)) {
    if (it.f) { cards.push({ kind: 'file', f: it.f }); continue; }
    const d = it.d, on = D.docIn(st, d), auto = D.docAuto(st, d);
    const doc = { kind: 'doc', d, di: it.di, on, auto, pages: [] };
    cards.push(doc);
    if (!on && !auto) continue;
    for (const [path, p] of d.pages) {
      const f = D.fileByPath(st, path), pd = docMap.get(path);
      if (!f || !pd || p >= pd.numPages) continue;
      let page; try { page = await pd.getPage(p + 1); } catch { continue; }
      if (!live()) return null;
      const vp = D.vpRot(f, p, page, 1);
      const pg = { file: f, idx: p, page, W: vp.width, H: vp.height, side: D.sideScreen(vp.width), marks: () => (f.marks[p] ||= []), extra: (f.kami && f.kami[p] && f.kami[p].notes) || [], out: !on };
      if (!pages.some(q => q.file === f)) pg.impTop = true;
      pages.push(pg); doc.pages.push(pg);
    }
  }
  return { cards, pages };
}
// The scale a page is shown at (src/app/arrange.js fitScale), for a paper area room pixels wide (padding taken off) and tall.
export function fitScale(pg, room, tall, fit, zoom) {
  let s = (room - 4) / (pg.W + pg.side);
  if (fit === 'page') s = Math.min(s, (tall - 40) / pg.H);
  s = Math.min(s, 1000 / pg.W);
  return Math.max(0.3, Math.min(2.2, s)) * (zoom || 1);
}
// renderPage: the page's picture at its size, then its marks over it.
export async function renderPage(pg, s, dpr = window.devicePixelRatio || 1) {
  const job = pg.job = (pg.job || 0) + 1, c = pg.canvas;
  pg.s = s;
  c.width = Math.ceil((pg.W + pg.side) * s * dpr); c.height = Math.ceil(pg.H * s * dpr);
  c.style.width = (pg.W + pg.side) * s + 'px'; c.style.height = pg.H * s + 'px';
  if (D.anonOn() && !pg.covers) pg.bmp = null;
  if (!pg.bmp) { const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#F6F7F9'; x.fillRect(Math.round(pg.W * s * dpr), 0, c.width, c.height); }
  D.draw(pg);
  const vp = D.vpRot(pg.file, pg.idx, pg.page, s * dpr);
  const bmp = document.createElement('canvas');
  bmp.width = Math.ceil(vp.width); bmp.height = Math.ceil(vp.height);
  const bctx = bmp.getContext('2d'); bctx.fillStyle = '#fff'; bctx.fillRect(0, 0, bmp.width, bmp.height);
  try { await pg.page.render({ canvasContext: bctx, viewport: vp, transform: D.skewXf(pg.file, pg.idx, vp), annotationMode: pdfjs.AnnotationMode.ENABLE }).promise; }
  catch (e) { if (e && e.name === 'RenderingCancelledException') return; console.error(e); }
  if (job !== pg.job) return;
  D.loadLines(pg);
  pg.bmp = bmp;
  await D.stickersReady;
  D.draw(pg);
}
export const redraw = pg => D.draw(pg);
export const redrawAll = () => { for (const pg of state().pages) D.draw(pg); };
export const studentName = (st, i) => D.shownName(st, i);
export const currentBatch = () => B;
