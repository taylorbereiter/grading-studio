// The screenshot on the marking screen (src/snip.js): S on a paper, Alt S, or the button at the foot of the tools. Drag over an area,
// click a page for the whole page, or Enter for everything on screen. Pages of the paper are drawn fresh from the file
// (engines/gsnip.js snipPage), so name covers are painted in even off screen, and the marks come only with "With my marks"
// (gs.snipMarks). The student's name and the file names are left off. Anything else shows as it is on screen. The picture goes on
// the clipboard, or is saved as a file where the browser can't copy pictures; nothing is sent anywhere. Or it is kept as a strong
// example or on the watch list (class/exsave.jsx saveShot). Loaded on its own (router.js PARTS.snip).
import { h, render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { t } from '../../i18n/t.js';
import { state, batch, cur } from '../../engines/gcore.js';
import { anonRx, scrub } from '../../engines/gdraw.js';
import { commitEditors } from '../../engines/gmark.js';
import { snipPage, snipRect, copyPicture, canvasPng, nameFindOn, fileRx } from '../../engines/gsnip.js';
import { prefs } from '../../students/prefs.js';
import { PARTS } from '../router.js';
import './paper-lines.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const paperEl = () => document.querySelector('.mk-paper');
// The paper's pages are on screen, nothing over them, and can be drawn fresh.
const onPaper = () => { const p = paperEl(); return !!(batch && state().pages.length && p && p.offsetParent && !document.querySelector('dialog[open]')); };
const withMarks = () => prefs.get('gs.snipMarks', 1) !== 0;
let host = null, say = () => {};

export function snipOpen() { return !!host; }
export function startSnip({ toast }) {
  if (host) return; say = toast || say;
  commitEditors();
  host = document.createElement('div'); host.className = 'mk-sniplay'; host.setAttribute('data-sniplayer', '');
  document.body.appendChild(host);
  render(<Layer paper={onPaper()} />, host);
  addEventListener('keydown', key, true);
}
export function stopSnip() { if (!host) return; removeEventListener('keydown', key, true); render(null, host); host.remove(); host = null; }
let whole = () => {};
// nothing behind gets a key while this is up: Esc stops, Enter takes everything on screen
function key(e) {
  const inside = host && host.contains(e.target);
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stopSnip(); }
  else if (e.key === 'Enter' && !(inside && e.target.closest('button,input'))) { e.preventDefault(); e.stopPropagation(); whole(); }
  else if (!inside) { e.preventDefault(); e.stopPropagation(); }
}

function Layer({ paper }) {
  const box = useRef(null), me = useRef(null), [mk, setMk] = useState(withMarks), [r, setR] = useState(null), d = useRef(null);
  useEffect(() => { if (me.current) me.current.focus({ preventScroll: true }); }, []);
  const [then, setThen] = useState('copy');
  const take = (R, pg) => { const marks = paper ? mk : true; stopSnip(); shoot(R, pg, marks, paper, then); };
  whole = () => take({ x: 0, y: 0, w: innerWidth, h: innerHeight });
  const down = e => { if (e.button !== 0 || e.target.closest('.snipbar')) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); d.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
  const move = e => { const a = d.current; if (!a || e.pointerId !== a.id) return; const q = snipRect(a, e); if (q.w < 4 && q.h < 4) return; setR(q); };
  const up = e => {
    const a = d.current; if (!a || e.pointerId !== a.id) return;
    const q = snipRect(a, e); d.current = null;
    if (q.w >= 6 || q.h >= 6) return take(q);
    const pg = paper && state().pages.find(p => { if (!p.canvas) return false; const b = p.canvas.getBoundingClientRect(); return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom; });
    if (pg) return take(null, pg);
    setR(null); say(t(paper ? 'paper.snip_miss_paper' : 'paper.snip_miss'));
  };
  const marks = e => { const on = e.currentTarget.checked; setMk(on); if (on) prefs.del('gs.snipMarks'); else prefs.set('gs.snipMarks', 0); };
  return <div ref={me} class="mk-snip" tabindex="-1" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { d.current = null; setR(null); }}>
    <div class="snipbar" role="dialog" aria-label={t('paper.snip_title')}>
      <div class="snipt"><b>{t('paper.snip_title')}</b><span>{t(paper ? 'paper.snip_drag_page' : 'paper.snip_drag')}</span></div>
      <div class="snipacts">
        <span class="snipthen" role="radiogroup" aria-label={t('paper.snip_then')}>{[['copy', 'paper.snip_copy'], ['ex', 'paper.snip_ex'], ['wl', 'paper.snip_wl']].map(([k, l]) => <button type="button" role="radio" class={'btn sm' + (then === k ? ' on' : '')} aria-checked={String(then === k)} onClick={() => setThen(k)} data-snipthen={k}>{t(l)}</button>)}</span>
        {paper && <label class="snipmk"><input type="checkbox" checked={mk} onChange={marks} data-snipmk />{t('paper.snip_marks')}</label>}
        <button type="button" class="btn sm" title={t('paper.snip_whole_tip')} onClick={() => whole()} data-snipall>{t('paper.snip_whole')}</button>
        <button type="button" class="btn sm" title={t('paper.snip_esc')} onClick={stopSnip} data-snipx>{t('paper.snip_cancel')}</button>
      </div>
      <p class="mute snipnote">{t(paper ? 'paper.snip_note_paper' : 'paper.snip_note')}</p>
    </div>
    {r && <div ref={box} class="snipbox" style={{ left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' }} />}
  </div>;
}

async function shoot(R, pg, marks, paper, then) {
  const blobP = (R ? area(R, marks, paper) : wholePage(pg, marks)).then(canvasPng);
  if (then && then !== 'copy') { const [blob, m] = await Promise.all([blobP, PARTS.exsave()]); return m.saveShot(blob, then === 'wl', paper ? batch.students[cur] : null); }
  const how = await copyPicture(blobP, 'Screenshot.png');
  if (how === 'none') return say(t('paper.snip_fail'));
  say(t(how === 'copied' ? 'paper.snip_copied' : 'paper.snip_saved'));
}
// A click on a page: all of it, about 1700 pixels across. The comment margin comes only when a comment is in it.
async function wholePage(pg, marks) {
  const k = clamp(1700 / pg.W, 1, 4), c = await snipPage(pg, k, marks);
  if (marks && pg.marks().concat(pg.extra || []).some(m => m.t === 'note')) return c;
  const o = document.createElement('canvas'); o.width = Math.ceil(pg.W * k); o.height = c.height;
  o.getContext('2d').drawImage(c, 0, 0); c.width = c.height = 0;
  return o;
}
async function area(R, marks, paper) {
  const k = clamp(window.devicePixelRatio || 1, 2, 3);
  let out = null;
  try {
    const h2c = (await PARTS.h2c()).default;
    out = await h2c(document.body, { x: R.x + scrollX, y: R.y + scrollY, width: R.w, height: R.h, scale: k, backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff', logging: false, useCORS: true,
      ignoreElements: el => el.hasAttribute && (el.hasAttribute('data-sniplayer') || (el.classList && el.classList.contains('toasts'))), onclone: doc => clean(doc, paper) });
  } catch (e) { console.error(e); }
  if (!out) { out = document.createElement('canvas'); out.width = Math.ceil(R.w * k); out.height = Math.ceil(R.h * k); const x = out.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, out.width, out.height); }
  if (!paper) return out;
  // the pages under the area, drawn again from the file: covers painted in, and the marks only if she wants them
  const el = paperEl(); if (!el) return out;
  const P = el.getBoundingClientRect(), ctx = out.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);   // html2canvas leaves its own scale on the canvas
  const vis = { l: Math.max(R.x, P.left), t: Math.max(R.y, P.top), r: Math.min(R.x + R.w, P.left + el.clientWidth), b: Math.min(R.y + R.h, P.top + el.clientHeight) };
  for (const pg of state().pages) {
    if (!pg.canvas || !pg.s) continue;
    const b = pg.canvas.getBoundingClientRect();
    if (b.right <= vis.l || b.left >= vis.r || b.bottom <= vis.t || b.top >= vis.b) continue;
    const c = await snipPage(pg, pg.s * k, marks);
    ctx.save();
    ctx.beginPath(); ctx.rect((vis.l - R.x) * k, (vis.t - R.y) * k, (vis.r - vis.l) * k, (vis.b - vis.t) * k); ctx.clip();
    ctx.drawImage(c, (b.left - R.x) * k, (b.top - R.y) * k, b.width * k, b.height * k);
    ctx.restore();
    c.width = c.height = 0;
  }
  return out;
}
// The copy html2canvas draws from: no student name or file name, names in Word papers covered the way anonymous grading covers them,
// and colors it can't read written the plain way.
function clean(doc, paper) {
  const st = batch && batch.students[cur];
  if (st && paper) {
    for (const el of doc.querySelectorAll('.markscreen .who, .mk-solo [data-raw]')) el.style.visibility = 'hidden';
    const rf = fileRx(st), rx = anonRx(st);
    for (const el of doc.querySelectorAll('.mk-paper .fhead > span[data-raw]')) el.textContent = scrub(el.textContent, rf);
    if (nameFindOn()) for (const el of doc.querySelectorAll('.mk-paper .dpage p, .mk-paper .dpage td, .mk-paper .dpage li')) { rx.lastIndex = 0; if (rx.test(el.textContent)) { el.style.background = '#111'; el.style.color = '#111'; } }
  }
  const win = doc.defaultView, odd = /\b(?:color|oklab|oklch|lab|lch)\(/;
  if (!win) return;
  for (const el of doc.body.querySelectorAll('*')) {
    const cs = win.getComputedStyle(el);
    for (const p of COLOR_PROPS) { const v = cs[p]; if (v && odd.test(v)) el.style[p] = rgbOf(v); }
  }
}
const COLOR_PROPS = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'boxShadow', 'textDecorationColor', 'textShadow', 'fill', 'stroke'];
// color(srgb 0.1 0.4 0.7 / 0.3), as a browser gives color-mix(), becomes rgba(); anything else it can't read is left out.
const rgbOf = v => v.replace(/\bcolor\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)/g, (m, r, g, b, a) => 'rgba(' + [r, g, b].map(n => Math.round(clamp(+n, 0, 1) * 255)).join(', ') + ', ' + (a == null ? 1 : +a) + ')')
  .replace(/\b(?:color|oklab|oklch|lab|lch)\([^)]*\)/g, 'rgba(0, 0, 0, 0)');
