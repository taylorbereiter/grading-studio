// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, docs, saveSoon, pdfjsLib, nameFlagsShow } from './gcore.js';
import { vpRot, skewXf, viewable, fileByPath, anonOn, shownName, anonRx, wordAlts, runAlts, initialAlts, altsRx, namesNow, ownNames } from './gdraw.js';
import { boxKey } from './gopen.js';
import { shareState, autoCovers, ownCovers, sameSpot, keptCovers, ensureCounts, wordScore, nameFindOn, paperKey, coverList, coverSig } from './gexport.js';
import { textOf } from './greport.js';

// src/app/anon.js
function anonShuffle() {
  const k = batch.students.map(st => st.key);
  for (let i = k.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [k[i], k[j]] = [k[j], k[i]]; }
  batch.anon = { ...(batch.anon || {}), order: k };
}
// src/app/anon.js
async function anonCovers(st, pg) {
  try { const vp = vpRot(pg.file, pg.idx, pg.page, 1); return keptCovers(await autoCovers(pg.page, vp, anonRx(st), skewXf(pg.file, pg.idx, vp)), pg.file.path, pg.idx, pg.W, pg.H).concat(ownCovers(pg.file.path, pg.idx, pg.W, pg.H)); }
  catch { return ownCovers(pg.file.path, pg.idx, pg.W, pg.H); }
}
// src/names.js
const NOT_LATIN = /(?![\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}])\p{L}/u;
// src/names.js
function sureRx(st) {
  const N = namesNow(); let rx = N.sure.get(st.key);
  if (rx === undefined) { const src = altsRx(ownNames(st).map(p => [...p.flatMap(w => wordAlts(w, 'sure')), ...runAlts(p), ...initialAlts(p)])); N.sure.set(st.key, rx = src ? new RegExp(src, 'gu') : null); }
  return rx;
}
// src/names.js
async function pageInk(page) {
  const v1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: Math.min(1, 1600 / Math.max(v1.width, v1.height)) }), c = document.createElement('canvas');
  c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const d = ctx.getImageData(0, 0, c.width, c.height).data; c.width = c.height = 0;
  for (let i = 0, n = 0; i < d.length; i += 4) if ((d[i] < 225 || d[i + 1] < 225 || d[i + 2] < 225) && ++n >= 3) return true;
  return false;
}
// src/names.js
async function lookForName(st, d) {
  const rx = sureRx(st), docs = new Map(); let has = false;
  try {
    for (const [path, p] of d.pages) {
      if (!docs.has(path)) docs.set(path, await pdfjsLib.getDocument({ data: fileByPath(st, path).data.slice(), isEvalSupported: false }).promise);
      const page = await docs.get(path).getPage(p + 1);
      if (rx && (await autoCovers(page, page.getViewport({ scale: 1 }), rx)).length) return 'found';
      has = has || (await page.getTextContent()).items.some(it => it.str && it.str.trim()) || (await page.getAnnotations({ intent: 'display' })).length > 0 || await scanCover(page) > 0 || await pageInk(page);
      page.cleanup();
    }
    return has ? 'none' : 'blank';
  } catch (er) { console.error(er); return 'none'; }
  finally { for (const js of docs.values()) js.destroy(); }
}
// src/names.js
let nameLook = null;
// src/names.js
function findNames() {
  if (!nameFindOn()) return Promise.resolve();
  return nameLook ||= (async () => {
    const b = batch, left = () => batch === b ? coverList(true).filter(x => !namesNow().found.has(paperKey(x.st, x.d))) : [];
    try {
      await ensureCounts();
      // Over again if the papers changed while it looked.
      for (let list = left(); list.length; list = left()) for (const x of list) {
        const k = paperKey(x.st, x.d), r = await lookForName(x.st, x.d);
        if (batch !== b) break;
        namesNow().found.set(k, r);
      }
      if (batch) nameFlagsShow();
    } catch (er) { console.error(er); }
    finally { nameLook = null; }
  })();
}
// src/names.js
const namesLooking = () => nameFindOn() && (stillCounting() || coverList(true).some(x => !namesNow().found.has(paperKey(x.st, x.d))));
// src/names.js
function nameFlag(st, d) {
  if (!nameFindOn()) return '';
  const r = namesNow().found.get(paperKey(st, d));
  if (r === 'none') return 'Name not found';
  return r === 'found' && ownNames(st).flat().some(w => NOT_LATIN.test(w)) ? 'Name in another alphabet' : '';
}
// src/names.js
const nameFlagged = all => coverList(all).map((x, i) => ({ ...x, i, say: nameFlag(x.st, x.d) })).filter(x => x.say && !coverOk(x.st, x.d));
// src/names.js
function wordNoName(st, f) {
  if (f.virtual || !f.data || (f.kind !== 'docx' && f.kind !== 'text')) return false;
  if (f.kind === 'docx') { wordScore(f); if (f.wtext == null) return true; }
  const t = f.kind === 'docx' ? f.wtext : textOf(f), rx = sureRx(st);
  if (!/\S/.test(t) && !(f.kind === 'docx' && f.wpic)) return false;
  return !rx || t.search(rx) < 0;
}
// src/insight.js
function coverOk(st, d) {
  const c = shareState().checked || {};
  return d.pages.every(([path, p]) => { const f = fileByPath(st, path); return !!f && c[boxKey(path, p)] === coverSig(f); });
}
// src/insight.js
function coverMark(st, d, on) {
  const c = (shareState().checked ||= {});
  for (const [path, p] of d.pages) { if (on) c[boxKey(path, p)] = coverSig(fileByPath(st, path)); else delete c[boxKey(path, p)]; }
  saveSoon();
}
// src/insight.js
function coverAgain(path, p) { const sh = batch && batch.share; if (sh && sh.checked) delete sh.checked[boxKey(path, p)]; }
// src/insight.js
const coverName = (st, k) => (anonOn() ? shownName(st, batch.students.indexOf(st)) : st.key) + (k ? ' (paper ' + (k + 1) + ')' : '');
// src/insight.js
const coverFirst = all => Math.max(0, coverList(all).findIndex(x => !coverOk(x.st, x.d)));
// src/insight.js
const stillCounting = () => batch.students.some(s => s.files.some(f => viewable(f) && !f.numPages && !f.bad));
// src/insight.js
function coverLine(all) {
  if (stillCounting()) return 'Counting the papers…';
  const list = coverList(all), n = list.filter(x => coverOk(x.st, x.d)).length;
  if (!list.length) return 'No PDFs or pictures to check.';
  return n + ' of ' + list.length + (list.length === 1 ? ' paper' : ' papers') + ' checked.';
}
// src/scans.js
async function scanCover(page) {
  const ol = await page.getOperatorList(), O = pdfjsLib.OPS, V = page.view, mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const pics = new Set([O.paintImageXObject, O.paintInlineImageXObject, O.paintImageMaskXObject, O.paintImageXObjectRepeat, O.paintImageMaskXObjectRepeat, O.paintSolidColorImageMask]), groups = new Set([O.paintInlineImageXObjectGroup, O.paintImageMaskXObjectGroup]);
  let m = [1, 0, 0, 1, 0, 0], area = 0; const st = [];
  ol.fnArray.forEach((fn, i) => {
    const a = ol.argsArray[i];
    if (fn === O.save) st.push(m);
    else if (fn === O.restore) m = st.pop() || m;
    else if (fn === O.transform) m = mul(m, a);
    else if (fn === O.paintFormXObjectBegin) { st.push(m); if (a && a[0]) m = mul(m, a[0]); }
    else if (fn === O.paintFormXObjectEnd) m = st.pop() || m;
    else if (groups.has(fn)) area += 1e12;
    else if (pics.has(fn)) area += Math.abs(m[0] * m[3] - m[1] * m[2]);
  });
  return Math.min(1, area / ((V[2] - V[0]) * (V[3] - V[1]) || 1));
}
export { anonShuffle, coverList, coverOk, coverMark, coverAgain, coverName, coverFirst, coverLine, boxKey, shareState, sameSpot, findNames, nameFlag, nameFlagged, namesLooking, wordNoName, stillCounting, ensureCounts, anonCovers };
