// Typing on the page: a text box and a margin comment, as the current app's editText and openNote do them (src/app/paper.js),
// with the same marks made, the same undo steps and the same Enter / Shift+Enter / Escape. The lifted marking code calls these
// through its hooks (mark/marking.js) and finishes them with commitEditors, which closes whatever is open in state().activeEditor.
import { use, state, TEXT_COLORS, NOTE_COLORS, HL } from '../../engines/gcore.js';
import { textLayout } from '../../engines/gdraw.js';
import * as K from '../../engines/gmark.js';
import { prefs } from '../../students/prefs.js';
import { t } from '../../i18n/t.js';
import { PARTS } from '../router.js';
import './lines.js';
import { toast } from '../../ui/index.js';
import { micFor } from './dictate.js';

const el = (tag, cls, attrs = {}) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const button = (cls, attrs, text) => { const b = el('button', cls, { type: 'button', ...attrs }); if (text != null) b.textContent = text; return b; };
const COLOR_NAME = { red: () => t('mark.c_red'), blue: () => t('mark.c_blue'), green: () => t('mark.c_green'), purple: () => t('mark.c_purple'), black: () => t('mark.c_black'), yellow: () => t('mark.c_yellow'), pink: () => t('mark.c_pink') };
const colorName = k => (COLOR_NAME[k] ? COLOR_NAME[k]() : k);
const r1 = v => Math.round(v * 10) / 10, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* a text box on the page */
export function editText(pg, m, isNew) {
  K.commitEditors();
  pg.editing = m; K.redrawAll();
  const ta = el('textarea', 'ed', { 'aria-label': t('mark.text_box'), 'data-raw': '' }); ta.value = m.text;
  const s = pg.s;
  const hd = el('div', 'edh', { title: t('mark.wrap_drag') });
  const bar = el('div', 'edbar', { role: 'toolbar', 'aria-label': t('mark.text_box') });
  const grip = el('span', 'edgrip', { 'data-grip': '', title: t('mark.move_box') }); grip.textContent = t('mark.move');
  const smaller = button('', { 'data-sz': '-1', title: t('mark.smaller'), 'aria-label': t('mark.smaller') }, 'A−');
  const size = el('b'); const bigger = button('', { 'data-sz': '1', title: t('mark.bigger'), 'aria-label': t('mark.bigger') }, 'A+');
  const full = button('', { 'data-full': '', title: t('mark.page_width_tip') }, t('mark.page_width'));
  const sws = Object.entries(TEXT_COLORS).map(([k, v]) => { const b = button('edsw', { 'data-tc': k, style: '--c:' + v, title: colorName(k), 'aria-label': t('mark.text_in', { c: colorName(k) }) }); return b; });
  bar.append(grip, smaller, size, bigger, el('span', 'edsep'), full, el('span', 'edsep'), ...sws);
  const fit = () => {
    const L = textLayout(m, pg.W);
    Object.assign(ta.style, { left: m.x * s + 'px', top: m.y * s + 'px', fontSize: m.size * s + 'px', color: m.color, width: L.maxW * s + 'px' });
    ta.style.height = '0'; ta.style.height = Math.max(m.size * 1.3 * s, ta.scrollHeight) + 'px';
    Object.assign(hd.style, { left: (m.x + L.maxW) * s + 'px', top: m.y * s + Math.min(ta.offsetHeight / 2, 18) + 'px' });
    Object.assign(bar.style, { left: m.x * s + 'px', top: m.y * s + 'px' });
    size.textContent = m.size; full.classList.toggle('on', !m.bw);
    for (const b of sws) { const on = TEXT_COLORS[b.dataset.tc] === m.color; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
  };
  pg.wrap.append(ta, hd, bar); fit(); ta.focus();
  if (!isNew) K.snap(pg);
  ta.addEventListener('input', fit);
  hd.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); hd.setPointerCapture(e.pointerId);
    const r = pg.canvas.getBoundingClientRect();
    const mv = ev => { delete m.bwFull; m.bw = r1(clamp((ev.clientX - r.left) / s - m.x, 24, pg.W - m.x - 6)); fit(); };
    const up = () => { hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up); ta.focus(); };
    hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
  });
  bar.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (e.target.closest('[data-grip]')) K.gripDrag(e, bar, pg, m, fit, ta); });
  bar.addEventListener('click', e => {
    const z = e.target.closest('[data-sz]'), disp = state().disp;
    if (z) { m.size = clamp(m.size + 2 * z.dataset.sz, 8, 40); disp.tsize = m.size; prefs.set('gs.disp', disp); }   // the next new box uses this size too
    if (e.target.closest('[data-full]')) delete m.bw;
    const tc = e.target.closest('[data-tc]'); if (tc) m.color = TEXT_COLORS[tc.dataset.tc];   // this box only; the pen keeps its own color
    fit(); ta.focus();
  });
  ta.addEventListener('keydown', e => {
    if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229)) { e.preventDefault(); K.commitEditors(); }   // Enter finishes, Shift Enter is a new line
    e.stopPropagation();
  });
  const me = { commit() {
    m.text = ta.value.replace(/\s+$/, '');
    ta.remove(); hd.remove(); bar.remove(); pg.editing = null;
    K.keepOnPage(m, pg.W, pg.H);
    const st = state();
    if (!m.text) { const a = pg.marks(), i = a.indexOf(m); if (i >= 0) a.splice(i, 1); if (isNew) st.undoStack.pop(); if (st.selected && st.selected.mark === m) use({ selected: null }); }
    else if (st.pages.includes(pg)) use({ selected: { page: pg, mark: m, fresh: true } });   // it keeps its handles; until she clicks it, keys and swatches leave it alone
    K.changed(pg); st.renderTools();
  } };
  use({ activeEditor: me });
  ta.addEventListener('blur', () => setTimeout(() => { if (state().activeEditor === me && document.activeElement !== ta) K.commitEditors(); }, 0));
}

/* a comment in the margin */
export function openNote(pg, m, isNew) {
  K.commitEditors();
  const pop = el('div', 'pop', { role: 'dialog', 'aria-label': isNew ? t('mark.new_comment') : t('mark.comment') });
  const s = pg.s;
  const lbl = el('div', 'lbl'); lbl.textContent = isNew ? t('mark.new_comment') : t('mark.comment');
  const ta = el('textarea', '', { placeholder: t('mark.comment_ph'), 'aria-label': t('mark.comment'), 'data-raw': '' }); ta.value = m.text;
  const inkRow = el('div', 'row ncol'); const inkL = el('span', 'lbl'); inkL.textContent = t('mark.color'); inkRow.append(inkL);
  for (const [k, v] of Object.entries(NOTE_COLORS)) inkRow.append(button('nsw', { 'data-nc': k, style: 'background:' + v, 'aria-pressed': v === m.color, title: colorName(k), 'aria-label': t('mark.comment_in', { c: colorName(k) }) }));
  const rows = [lbl, ta, inkRow];
  if (m.hl) {
    const hlRow = el('div', 'row ncol'); const hlL = el('span', 'lbl'); hlL.textContent = t('mark.highlight'); hlRow.append(hlL);
    for (const [k, v] of Object.entries(HL)) hlRow.append(button('nsw sq', { 'data-nh': k, style: 'background:' + v, 'aria-pressed': v === (m.hc || HL.yellow), title: colorName(k), 'aria-label': t('mark.highlight_in', { c: colorName(k) }) }));
    rows.push(hlRow);
  }
  const bankL = el('div', 'lbl', { 'data-bank': '' }); bankL.textContent = t('mark.saved_comments');
  const chips = el('div', 'chips');
  const foot = el('div', 'row'), mic = micFor(ta);
  foot.append(button('btn', { 'data-a': 'star', title: t('mark.save_reuse_tip') }, t('mark.save_reuse')), mic, el('span', 'sp'));
  if (!isNew) foot.append(button('btn', { 'data-a': 'del' }, t('mark.delete')));
  foot.append(button('btn primary', { 'data-a': 'ok' }, t('mark.done')));
  pop.append(...rows, bankL, chips, foot);
  // Its color can change at any time, new or old: shown on the paper straight away, kept with Done, put back on Escape.
  const was = { color: m.color, hc: m.hc, ly: m.ly };
  const bank = () => state().bank;
  const drawChips = () => {
    chips.replaceChildren(...bank().map((txt, i) => { const c = el('span', 'chip', { 'data-i': i }); const w = el('span', '', { title: txt, 'data-raw': '' }); w.textContent = txt; c.append(w, button('', { 'data-x': i, title: t('mark.bank_remove'), 'aria-label': t('mark.bank_remove') }, '×')); return c; }));
    bankL.hidden = !bank().length;
  };
  drawChips();
  // Next to the spot (below a highlight), kept inside the part of the paper on screen.
  pg.wrap.appendChild(pop);
  const area = pg.wrap.closest('.mk-paper') || document.body;
  const P = area.getBoundingClientRect(), R = pg.wrap.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
  const sx = (m.hl ? m.hl.x : m.ax) * s, sy = (m.hl ? m.hl.y + m.hl.h : m.ay) * s, top0 = (m.hl ? m.hl.y : m.ay) * s;
  const x0 = Math.max(0, P.left - R.left) + 8, x1 = Math.min(R.width, P.right - R.left) - pw - 8;
  const y0 = Math.max(0, P.top - R.top) + 8, y1 = P.bottom - R.top - ph - 8;
  let y = sy + 12; if (y > y1 && top0 - ph - 12 >= y0) y = top0 - ph - 12;   // above the spot when there's no room below
  pop.style.left = clamp(sx + 12, x0, Math.max(x0, x1)) + 'px'; pop.style.top = clamp(y, y0, Math.max(y0, y1)) + 'px';
  ta.focus({ preventScroll: true });
  if (isNew) { pg.pending = m; K.redrawAll(); }
  const close = save => {
    mic.stop(); pop.remove(); use({ activeEditor: null });
    if (pg.pending === m) pg.pending = null;
    const text = ta.value.trim(), now = { color: m.color, hc: m.hc, ly: m.ly };
    Object.assign(m, was); for (const k of ['hc', 'ly']) if (m[k] === undefined) delete m[k];   // the step Ctrl Z goes back to holds the colors it had when it opened
    if (!save) { K.redrawAll(); return; }
    const a = pg.marks(), i = a.indexOf(m), st = state();
    if (!text) { if (st.selected && st.selected.mark === m) use({ selected: null }); if (i >= 0) { K.snap(pg); a.splice(i, 1); K.changed(pg); } else K.redrawAll(); return; }
    const recolored = now.color !== was.color || now.hc !== was.hc || now.ly !== was.ly;
    if (text === m.text && i >= 0 && !recolored) { K.redrawAll(); return; }
    K.snap(pg); m.text = text; m.color = now.color; for (const k of ['hc', 'ly']) if (now[k] !== undefined) m[k] = now[k]; if (i < 0) a.push(m); K.changed(pg);
  };
  use({ activeEditor: { commit: () => close(true), note: true, m, pg, ta } });
  pop.addEventListener('pointerdown', e => e.stopPropagation());
  pop.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(false); }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); close(true); }   // never while a Chinese or Japanese word is still being put together
  });
  pop.addEventListener('click', e => {
    const nc = e.target.closest('[data-nc]'), nh = e.target.closest('[data-nh]');
    if (nc || nh) {
      if (nc) m.color = NOTE_COLORS[nc.dataset.nc]; else m.hc = HL[nh.dataset.nh];
      for (const b of pop.querySelectorAll('[data-nc]')) b.setAttribute('aria-pressed', NOTE_COLORS[b.dataset.nc] === m.color);
      for (const b of pop.querySelectorAll('[data-nh]')) b.setAttribute('aria-pressed', HL[b.dataset.nh] === (m.hc || HL.yellow));
      K.redrawAll(); ta.focus({ preventScroll: true }); return;
    }
    const x = e.target.closest('[data-x]');
    if (x) { const b = bank().slice(); b.splice(+x.dataset.x, 1); keepBank(b); drawChips(); return; }
    const ch = e.target.closest('.chip');
    if (ch) { const txt = bank()[+ch.dataset.i]; ta.value = ta.value.trim() ? ta.value.trim() + ' ' + txt : txt; ta.focus(); return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'star') {
      const txt = ta.value.trim(); if (!txt) return;
      if (!bank().includes(txt)) { keepBank([txt, ...bank()]); drawChips(); toast(t('mark.bank_saved')); }
    }
    if (b.dataset.a === 'ok') close(true);
    if (b.dataset.a === 'del') { ta.value = ''; close(true); }
  });
}
// The saved comments go where the current app keeps them (gs.bank), through students/write.js.
export function keepBank(b) { use({ bank: b }); PARTS.write().then(W => W.saveSetting('gs.bank', b)).catch(e => console.error(e)); }

export const editMark = (pg, m) => { if (m.t === 'text') editText(pg, m); else if (m.t === 'note') openNote(pg, m); };
