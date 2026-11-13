/* ================= Text boxes on a slide =================
   Each text box on a slide can have its own text size and its own place and size on the slide.
   - s.size is the main text's size (as before); s.fs = { title: 34, foot: 30, … } sizes the other boxes.
   - s.box = { body: { x, y, w, h }, title: {…} } moves or resizes a box, in 1280 x 720 slide units.
   Both are only on a slide when the teacher changed something; everything else draws as the layout says.
   Words are never cut off: the editor marks a box whose text runs past it, and Present and the class screen
   make that box's text smaller until it fits (the editor's warning says so, and offers to split the slide). */
const BOX_KEYS = ['title', 'body', 'body2', 'sub', 'tag', 'foot', 'h1', 'h2', 'cite', 'word', 'pos'];
const BOX_NAME = { title: 'Title', body: 'Text', body2: 'Right side', sub: 'Subtitle', tag: 'Label', foot: 'Bottom line', h1: 'Left heading', h2: 'Right heading', cite: 'Source', word: 'Word', pos: 'Part of speech' };
const TTL_SIZES = [40, 44, 48, 54, 60, 66, 72];   // a title slide's title is bigger than any other text
const BOX_MIN_W = 80, BOX_MIN_H = 36;
// Where the boxes of the plain layouts sit (the teaching layouts' boxes are in teachBoxes).
function boxHome(s, k) {
  if (s.layout === 'title') return k === 'title' ? { x: 254, y: 84, w: 907, h: 266 } : k === 'sub' ? { x: 254, y: 373, w: 907, h: 103 } : null;
  if (k === 'title') return { x: 152, y: 84, w: 1008, h: 110 };
  if (k === 'body') return { x: 152, y: 211, w: 1008, h: 362 };
  return null;
}
function normBoxes(s, out) {
  if (s.fs && typeof s.fs === 'object') {
    const fs = {}; for (const k of BOX_KEYS) if (k !== 'body' && +s.fs[k] >= 10 && +s.fs[k] <= 96) fs[k] = Math.round(+s.fs[k] * 2) / 2;
    if (Object.keys(fs).length) out.fs = fs;
  }
  if (s.box && typeof s.box === 'object') {
    const bx = {};
    for (const k of BOX_KEYS) {
      const b = s.box[k]; if (!b || typeof b !== 'object' || ![b.x, b.y, b.w, b.h].every(v => Number.isFinite(+v))) continue;
      const w = Math.max(BOX_MIN_W, Math.min(1280, Math.round(+b.w))), h = Math.max(BOX_MIN_H, Math.min(720, Math.round(+b.h)));
      bx[k] = { x: Math.max(0, Math.min(1280 - w, Math.round(+b.x))), y: Math.max(0, Math.min(720 - h, Math.round(+b.y))), w, h };
    }
    if (Object.keys(bx).length) out.box = bx;
  }
  return out;
}
// The sizes the teacher can pick for a box, and what it is when nothing was picked.
function boxSizes(s, k) { return s.layout === 'title' && k === 'title' ? TTL_SIZES : deckSizes(); }
function boxUsual(s, k) {
  if (k === 'body') return s.size;
  if (s.layout === 'title') return k === 'title' ? 58.5 : 0;   // 0: the subtitle keeps the template's own size
  if (k === 'title') return 32;
  const b = teachBoxes({ ...s, fs: null, box: null }).find(x => x.k === k); return b ? b.sz : 0;
}
const boxSize = (s, k) => k === 'body' ? s.size : (s.fs && s.fs[k]) || boxUsual(s, k);
// Inline style for a plain box: its own place and text size when the teacher set them.
function boxStyle(s, k) {
  const b = s.box && s.box[k], z = k !== 'body' && s.fs && s.fs[k];
  return (b ? 'left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px;' : '') + (z ? 'font-size:' + (z * PT).toFixed(1) + 'px;' : '');
}
// The boxes on the slide in the editor that can be sized: the title first, then the rest as they are drawn.
const sizable = () => [...document.querySelectorAll('#lsStage .ls-slide [data-k]')].map(e => e.dataset.k).filter((k, i, a) => BOX_KEYS.includes(k) && a.indexOf(k) === i);
function boxPick() {   // the box the size control is about: the one last clicked, or the slide's main text
  const ks = sizable(); if (!ks.length) return '';
  return ks.includes(L.box) ? L.box : ks.includes('body') ? 'body' : ks[0];
}
function sizeCtl() {
  const s = L.open.slides[L.cur], k = boxPick(); if (!k) return '<span id="lsSize"></span>';
  const z = boxSize(s, k), list = boxSizes(s, k), usual = boxUsual(s, k), own = k !== 'body' && s.fs && s.fs[k];
  const opts = (k === 'body' ? '' : '<option value=""' + (own ? '' : ' selected') + '>Usual' + (usual && !list.includes(usual) ? '' : usual ? ' (' + usual + ' pt)' : '') + '</option>') +
    list.map(v => '<option value="' + v + '"' + ((k === 'body' || own) && v === z ? ' selected' : '') + '>' + v + ' pt</option>').join('') + '<option value="fit">Biggest that fits</option>';
  return '<label id="lsSize" title="Text size for the box you clicked on the slide">' + esc(BOX_NAME[k]) + ' <select data-f="size" data-k="' + k + '" class="btn sm">' + opts + '</select></label>';
}
function sizeCtlRefresh() { const c = $('#lsSize'); if (c) c.outerHTML = sizeCtl(); }
function setBoxSize(k, v) {
  const s = L.open.slides[L.cur];
  if (v === 'fit') return fitBox(k);
  if (k === 'body') s.size = +v;
  else { s.fs = { ...(s.fs || {}) }; if (v) s.fs[k] = +v; else delete s.fs[k]; if (!Object.keys(s.fs).length) delete s.fs; }
  L.box = k; lessonChanged(); renderEditor();
}
// The biggest size in the list at which the box's text fits, tried on the slide itself.
function fitBox(k) {
  const s = L.open.slides[L.cur], el = $('#lsStage .ls-slide [data-k="' + k + '"]'); if (!el) return;
  const list = boxSizes(s, k).slice().sort((a, b) => b - a), was = el.style.fontSize;
  let pick = 0;
  for (const v of list) { el.style.fontSize = (v * PT).toFixed(1) + 'px'; if (!boxOver(el)) { pick = v; break; } }
  el.style.fontSize = was;
  if (!pick) { pick = list[list.length - 1]; toast('Even at ' + pick + ' pt this doesn’t fit. Make the box bigger, shorten the text, or split the slide.', 7000); }
  if (k === 'body') s.size = pick; else { s.fs = { ...(s.fs || {}), [k]: pick }; }
  L.box = k; lessonChanged(); renderEditor();
}
const boxOver = el => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2;
const FIT_SEL = '.ls-t,.ls-ttl,.ls-sub,.ls-body,.ls-bx';
// After a slide is drawn. 'edit': mark each box whose words run past it and return their keys.
// 'show': make the text in such a box smaller, a step at a time, until every word shows.
function slideFit(root, mode) {
  const over = [];
  if (!root) return over;
  for (const el of root.querySelectorAll(FIT_SEL)) {
    if (!el.offsetHeight || !boxOver(el)) continue;
    if (mode === 'edit') { el.classList.add('ls-over'); over.push(el.dataset.k); continue; }
    // First the box takes the empty room under it (down to the next box, or near the slide's bottom edge), then the text gets smaller.
    const top = el.offsetTop, l = el.offsetLeft, r = l + el.offsetWidth;
    let floor = root.querySelector('.lk-wood') ? 640 : 700;
    for (const o of root.querySelectorAll(FIT_SEL + ',.ls-pic,.ls-src,.ls-vid')) if (o !== el && o.offsetTop > top && o.offsetLeft < r && o.offsetLeft + o.offsetWidth > l && (o.textContent.trim() || o.querySelector('img'))) floor = Math.min(floor, o.offsetTop - 8);
    if (floor > top + el.offsetHeight) el.style.height = (floor - top) + 'px';
    if (!boxOver(el)) continue;
    const base = parseFloat(getComputedStyle(el).fontSize) || 16;
    for (let f = 0.95; f >= 0.4 && boxOver(el); f -= 0.05) el.style.fontSize = (base * f).toFixed(1) + 'px';
    el.classList.add('ls-shrunk');
  }
  return over;
}

/* ---------- moving and resizing a box with the mouse ---------- */
// The box last clicked gets a frame: drag its edge bar to move it, a corner or side handle to resize it.
function boxFrame() {
  const st = $('#lsStage .ls-slide'); if (!st) return;
  const old = st.querySelector('.ls-frame'); if (old) old.remove();
  const k = L.box, el = k && BOX_KEYS.includes(k) && st.querySelector('[data-k="' + k + '"]'); if (!el) return;
  const f = document.createElement('div'); f.className = 'ls-frame'; f.dataset.for = k;
  const moved = !!(L.open.slides[L.cur].box || {})[k];
  f.innerHTML = '<span class="ls-grips"><b class="ls-grip" data-h="move" title="Drag to move this text box">✥ ' + esc(BOX_NAME[k]) + '</b>' + (moved ? '<b class="ls-grip ls-boxback" data-a="boxreset" data-k="' + k + '" title="Put this box back where the layout has it">↺ Put back</b>' : '') + '</span>' + ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => '<i data-h="' + h + '" title="Drag to resize"></i>').join('');
  boxFramePlace(f, el); st.appendChild(f);
}
function boxFramePlace(f, el) { f.style.cssText = 'left:' + el.offsetLeft + 'px;top:' + el.offsetTop + 'px;width:' + el.offsetWidth + 'px;height:' + el.offsetHeight + 'px'; f.classList.toggle('in', el.offsetTop < 40); }
let boxDrag = null;
document.addEventListener('pointerdown', e => {
  if (e.target.closest && e.target.closest('#lsStage .ls-boxback')) return e.preventDefault();   // the text being typed keeps the cursor
  const h = e.target.closest && e.target.closest('#lsStage .ls-frame [data-h]'); if (!h || !L.open) return;
  e.preventDefault(); e.stopPropagation();   // keeps the cursor in the text being typed
  const f = h.closest('.ls-frame'), k = f.dataset.for, st = $('#lsStage'), el = st.querySelector('.ls-slide [data-k="' + k + '"]'); if (!el) return;
  const kk = parseFloat(getComputedStyle(st).getPropertyValue('--k')) || 1;
  boxDrag = { h: h.dataset.h, k, el, f, kk, x0: e.clientX, y0: e.clientY, b: { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }, moved: false };
  try { h.setPointerCapture(e.pointerId); } catch { }
}, true);
document.addEventListener('pointermove', e => {
  const d = boxDrag; if (!d) return;
  const dx = (e.clientX - d.x0) / d.kk, dy = (e.clientY - d.y0) / d.kk; if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
  const snap = v => Math.round(v / 4) * 4; let { x, y, w, h } = d.b;
  if (d.h === 'move') { x += dx; y += dy; }
  else {
    if (d.h.includes('e')) w += dx; if (d.h.includes('s')) h += dy;
    if (d.h.includes('w')) { x += dx; w -= dx; } if (d.h.includes('n')) { y += dy; h -= dy; }
    if (w < BOX_MIN_W) { if (d.h.includes('w')) x -= BOX_MIN_W - w; w = BOX_MIN_W; }
    if (h < BOX_MIN_H) { if (d.h.includes('n')) y -= BOX_MIN_H - h; h = BOX_MIN_H; }
  }
  x = Math.max(0, Math.min(1280 - w, snap(x))); y = Math.max(0, Math.min(720 - h, snap(y))); w = Math.min(1280 - x, snap(w)); h = Math.min(720 - y, snap(h));
  Object.assign(d.el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  d.now = { x, y, w, h }; boxFramePlace(d.f, d.el);
}, true);
document.addEventListener('pointerup', () => {
  const d = boxDrag; if (!d) return; boxDrag = null;
  if (!d.moved || !d.now || !L.open) return;
  const s = L.open.slides[L.cur]; s.box = { ...(s.box || {}), [d.k]: d.now };
  lessonChanged();
  if (!lEditing) renderStage(); else { checkFit(); sizeCtlRefresh(); }
}, true);
