/* ---------------- Screenshot: drag over part of the screen and a picture of it goes on the clipboard ---------------- */
// S on a paper, ⌥S (Alt S) anywhere, the button at the foot of the tool dock, or Screenshot in Find anything.
// Drag over an area, click a page for the whole page, or Enter for everything on screen.
// Pages of a paper are drawn fresh from the file, so name covers are painted in even when they aren't on screen, and
// names in the teacher's own words on the page become [name]. The student's name and file name above the paper are left
// off. Anything else shows as it is on screen. Nothing is sent anywhere: the picture stays on this computer.

// Puts a picture on the clipboard, or saves it as a file where the browser can't copy pictures.
// blobP: a promise of the PNG, so Safari still counts the click that started it.
// Gives 'copied', 'saved', or 'none' when there was no picture to make.
async function copyPicture(blobP, name) {
  try {
    if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') throw new Error('no clipboard');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP })]);
    return 'copied';
  } catch (e) { /* saved as a file below */ }
  let blob = null;
  try { blob = await blobP; } catch { return 'none'; }
  if (!blob) return 'none';
  await saveBlob(name, blob);
  return 'saved';
}
const canvasPng = c => new Promise((res, rej) => c.toBlob(b => { c.width = c.height = 0; b ? res(b) : rej(new Error('no picture')); }, 'image/png'));

let snipOn = null;
// The paper's pages are on screen and can be drawn fresh.
const snipPaper = () => !!(batch && pages.length && $('#paper') && $('#paper').offsetParent && $('#dlg').hidden);
const snipMarks = () => !!store.get('gs.snipMarks', 1);
function snipStart() {
  if (snipOn || $('#findDlg')) return;
  commitEditors();
  const paper = snipPaper();
  const el = document.createElement('div');
  el.id = 'snipLayer'; el.className = 'sniplay'; el.tabIndex = -1;
  el.innerHTML = '<div class="snipbar" role="dialog" aria-label="Screenshot"><div class="snipt"><b>Screenshot</b><span>Drag over what you want to copy' + (paper ? ', or click a page for all of it' : '') + '.</span></div>' +
    '<div class="snipacts">' + (paper ? '<label class="snipmk"><input type="checkbox" id="snipMk"' + (snipMarks() ? ' checked' : '') + '> With my marks</label>' : '') +
    '<button class="btn sm" data-snipall title="Everything on screen (Enter)">Whole screen</button><button class="btn sm" data-snipx title="Esc">Cancel</button></div>' +
    '<p class="snipnote">' + (paper ? 'On the paper, name covers are painted in and the student’s name and file name are left off. ' : '') + 'Anything else shows as it is on screen.</p></div><div class="snipbox" hidden></div>';
  document.body.appendChild(el);
  snipOn = el; el.focus({ preventScroll: true });
  const box = el.querySelector('.snipbox');
  let d = null;
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('.snipbar')) return;
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    d = { x: e.clientX, y: e.clientY, id: e.pointerId };
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return;
    const r = snipRect(d, e);
    if (r.w < 4 && r.h < 4) return;
    box.hidden = false; Object.assign(box.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  });
  el.addEventListener('pointerup', e => {
    if (!d || e.pointerId !== d.id) return;
    const r = snipRect(d, e); d = null; el.classList.remove('dragging');
    if (r.w >= 6 || r.h >= 6) return snipTake(r);
    const pg = paper && pages.find(q => { const b = q.canvas.getBoundingClientRect(); return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom; });
    if (pg) return snipTake(null, pg);
    box.hidden = true;
    toast(paper ? 'Drag over an area, or click a page.' : 'Drag over an area to copy it.');
  });
  el.addEventListener('pointercancel', () => { d = null; box.hidden = true; el.classList.remove('dragging'); });
  el.addEventListener('click', e => {
    if (e.target.closest('[data-snipx]')) return snipStop();
    if (e.target.closest('[data-snipall]')) return snipTake({ x: 0, y: 0, w: innerWidth, h: innerHeight });
  });
  el.addEventListener('change', e => { if (e.target.id === 'snipMk') { if (e.target.checked) store.del('gs.snipMarks'); else store.set('gs.snipMarks', 0); } });
  el.addEventListener('keydown', snipKey);
}
function snipKey(e) {
  e.stopPropagation();   // nothing behind gets a key while this is up
  if (e.key === 'Escape') { e.preventDefault(); snipStop(); }
  else if (e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); snipTake({ x: 0, y: 0, w: innerWidth, h: innerHeight }); }
}
const snipRect = (a, e) => {
  const x = clamp(Math.min(a.x, e.clientX), 0, innerWidth), y = clamp(Math.min(a.y, e.clientY), 0, innerHeight);
  return { x, y, w: clamp(Math.max(a.x, e.clientX), 0, innerWidth) - x, h: clamp(Math.max(a.y, e.clientY), 0, innerHeight) - y };
};
function snipStop() {
  if (!snipOn) return;
  snipOn.remove(); snipOn = null;
}
// R: the area in window points, or null with pg for that whole page.
async function snipTake(R, pg) {
  const marks = snipPaper() ? snipMarks() : true;
  snipStop();
  const blobP = (R ? snipArea(R, marks) : snipWhole(pg, marks)).then(canvasPng);
  const how = await copyPicture(blobP, 'Screenshot.png');
  if (how === 'none') return toast('That picture couldn’t be made. Try a smaller area.');
  toast(how === 'copied' ? 'Picture copied. Paste it wherever you need it.' : 'This browser can’t copy pictures, so it was saved as Screenshot.png.', 4000);
}
// One page of the open paper, drawn fresh at k pixels a point, as wide as on screen (with its comment margin).
async function snipPage(pg, k, marks) {
  const st = batch.students[cur], f = pg.file, p = pg.idx, page = pg.page, W = pg.W, H = pg.H, side = pg.side, rx = anonRx(st);
  const c = document.createElement('canvas'); c.width = Math.ceil((W + side) * k); c.height = Math.ceil(H * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#F6F7F9'; ctx.fillRect(Math.round(W * k), 0, c.width, c.height);
  await page.render({ canvasContext: ctx, ...vpDraw(f, p, page, k), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
  const L = lightForPage(st, f, p); if (L) lightCanvas(ctx, Math.ceil(W * k), c.height, L);
  scanClip(ctx, f, p, W * k, Math.ceil(W * k), c.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (marks) drawMarks(ctx, scrubMarks(pg.marks().concat(pg.extra || []), rx), W, H, side, null);
  ctx.fillStyle = '#111';
  for (const r of await anonCovers(st, pg)) ctx.fillRect(r.x, r.y, r.w, r.h);   // after the marks, so a mark can't show a name either
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}
// A click on a page: all of it, about 1700 pixels across. The comment margin only comes when a comment is in it.
async function snipWhole(pg, marks) {
  const k = clamp(1700 / pg.W, 1, 4), c = await snipPage(pg, k, marks);
  const notes = marks && pg.marks().concat(pg.extra || []).some(m => m.t === 'note');
  if (notes) return c;
  const o = document.createElement('canvas'); o.width = Math.ceil(pg.W * k); o.height = c.height;
  o.getContext('2d').drawImage(c, 0, 0); c.width = c.height = 0;
  return o;
}
async function snipArea(R, marks) {
  const k = clamp(window.devicePixelRatio || 1, 2, 3);
  let out = null;
  try {
    out = await html2canvas(document.body, { x: R.x + scrollX, y: R.y + scrollY, width: R.w, height: R.h, scale: k, backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff', logging: false, useCORS: true,
      ignoreElements: el => el.id === 'snipLayer' || (el.classList && el.classList.contains('toast')), onclone: snipClean });
  } catch (e) { console.error(e); }
  if (!out) { out = document.createElement('canvas'); out.width = Math.ceil(R.w * k); out.height = Math.ceil(R.h * k); const x = out.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, out.width, out.height); }
  if (!snipPaper()) return out;
  // The pages under the area, drawn again from the file: covers painted in, and the marks only if she wants them.
  const P = $('#paper').getBoundingClientRect(), ctx = out.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);   // html2canvas leaves its own scale on the canvas
  const vis = { l: Math.max(R.x, P.left), t: Math.max(R.y, P.top), r: Math.min(R.x + R.w, P.left + $('#paper').clientWidth), b: Math.min(R.y + R.h, P.top + $('#paper').clientHeight) };
  for (const pg of pages) {
    const b = pg.canvas.getBoundingClientRect();
    if (b.right <= vis.l || b.left >= vis.r || b.bottom <= vis.t || b.top >= vis.b || !pg.s) continue;
    const c = await snipPage(pg, pg.s * k, marks);
    ctx.save();
    ctx.beginPath(); ctx.rect((vis.l - R.x) * k, (vis.t - R.y) * k, (vis.r - vis.l) * k, (vis.b - vis.t) * k); ctx.clip();
    ctx.drawImage(c, (b.left - R.x) * k, (b.top - R.y) * k, b.width * k, b.height * k);
    ctx.restore();
    c.width = c.height = 0;
  }
  return out;
}
// The copy html2canvas draws from: no student name or file name above the paper, names in Word papers covered the way
// anonymous grading covers them, and colors it can't read written the plain way.
function snipClean(doc) {
  const st = batch && batch.students[cur];
  if (st && snipPaper()) {
    for (const el of doc.querySelectorAll('#paper .who, #paper .lchip, #paper .rchip')) el.style.visibility = 'hidden';
    const rf = fileRx(st), rx = anonRx(st);
    for (const el of doc.querySelectorAll('#paper .fhead > span:first-child, #paper .refd > summary, #paper .nofile b, #paper .mhead b')) el.textContent = scrub(el.textContent, rf);
    if (nameFindOn()) for (const el of doc.querySelectorAll('#paper .dpage p, #paper .dpage td, #paper .dpage li')) { rx.lastIndex = 0; if (rx.test(el.textContent)) el.classList.add('anonhide'); }
  }
  const win = doc.defaultView, odd = /\b(?:color|oklab|oklch|lab|lch)\(/;
  if (!win) return;
  for (const el of doc.body.querySelectorAll('*')) {
    const cs = win.getComputedStyle(el);
    for (const p of SNIP_COLOR_PROPS) { const v = cs[p]; if (v && odd.test(v)) el.style[p] = snipRgb(v); }
  }
}
const SNIP_COLOR_PROPS = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'boxShadow', 'textDecorationColor', 'textShadow', 'fill', 'stroke'];
// color(srgb 0.1 0.4 0.7 / 0.3), as a browser gives color-mix(), becomes rgba(); anything else it can't read is left out.
const snipRgb = v => v.replace(/\bcolor\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)/g, (m, r, g, b, a) => 'rgba(' + [r, g, b].map(n => Math.round(clamp(+n, 0, 1) * 255)).join(', ') + ', ' + (a == null ? 1 : +a) + ')')
  .replace(/\b(?:color|oklab|oklch|lab|lch)\([^)]*\)/g, 'rgba(0, 0, 0, 0)');
// ⌥S (Alt S) anywhere in the app. e.code, since ⌥S types ß on a Mac.
document.addEventListener('keydown', e => {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.code !== 'KeyS' || snipOn) return;
  const a = document.activeElement;
  if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
  e.preventDefault(); e.stopPropagation(); snipStart();
}, true);
Object.assign(window.__gs || (window.__gs = {}), { snipStart, snipStop, copyPicture });
