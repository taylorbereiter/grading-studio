// The marking tools, loaded as a part of their own once a paper is open (router.js PARTS.marking): the toolbar, the keys that
// choose a tool, and the current app's own marking code behind them (mark/marking.js, engines/gmark.js).
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { IconButton, Icon } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { register } from '../../services/shortcuts.js';
import { state, COLORS, HL } from '../../engines/gcore.js';
import { drawStamp, STICKERS } from '../../engines/gdraw.js';
import * as K from '../../engines/gmark.js';
import { prefs } from '../../students/prefs.js';
import * as M from '../mark/marking.js';
import { useRove } from '../mark/rove.js';
import { PARTS } from '../router.js';
import '../mark/lines.js';

export { M };
// The tools down the left of the paper, as the current app has them: the tools, what the tool in hand can be set to, undo and redo.
const TOOLS = [['select', 'cursor', 'v'], ['pen', 'pen', 'p'], ['hl', 'hl', 'h'], ['oval', 'oval', 'o'], ['text', 'text', 't'], ['note', 'comment', 'c'], ['check', 'check', 'k'], ['erase', 'eraser', 'e']];
const TOOL_LINE = { select: () => t('mark.t_select'), pen: () => t('mark.t_pen'), hl: () => t('mark.t_hl'), oval: () => t('mark.t_oval'), text: () => t('mark.t_text'), note: () => t('mark.t_note'), check: () => t('mark.t_check'), erase: () => t('mark.t_erase') };
const COLOR_LINE = { red: () => t('mark.c_red'), blue: () => t('mark.c_blue'), green: () => t('mark.c_green'), purple: () => t('mark.c_purple'), black: () => t('mark.c_black'), yellow: () => t('mark.c_yellow'), pink: () => t('mark.c_pink') };
const WIDTHS = [[1.2, () => t('mark.w_fine')], [2, () => t('mark.w_medium')], [3.5, () => t('mark.w_bold')]];
// a freehand highlight's width (src/marking.js hlBar): the current app's S, M and L
const HL_W = [[8, () => t('mark.hlw_s')], [14, () => t('mark.hlw_m')], [22, () => t('mark.hlw_l')]];
// a set of choices inside the tools: one stop in the Tab order, up and down move among them
function ToolSet({ class: c, label, children }) { const rv = useRove(true); return <span class={c} role="group" aria-label={label} {...rv}>{children}</span>; }
function Tools() {
  const s = state(), bar = M.stampTool() ? 'stamp' : s.once ? s.once.prev : s.tool;
  const sw = (list, on, pick, label) => <ToolSet class="mk-sw" label={label}>{Object.entries(list).map(([k, v]) =>
    <button type="button" class="sw" style={'background:' + v} aria-pressed={k === on ? 'true' : 'false'} title={COLOR_LINE[k] ? COLOR_LINE[k]() : k} aria-label={COLOR_LINE[k] ? COLOR_LINE[k]() : k} data-sw={k} onClick={() => pick(k)} />)}</ToolSet>;
  const rv = useRove(true);
  // a phone shows the papers and the scores, as the current phone layout does: a finger moves the page and never draws
  useEffect(() => { if (matchMedia('(max-width:760px) and (pointer:coarse)').matches && state().tool !== 'select') M.chooseTool('select'); }, []);
  return <div class="mk-tools" role="toolbar" aria-label={t('mark.tools')} aria-orientation="vertical" {...rv}>
    {TOOLS.map(([k, icon, key]) => <IconButton icon={icon} label={TOOL_LINE[k]()} kbd={key.toUpperCase()} aria-pressed={bar === k ? 'true' : 'false'} data-tool={k} onClick={() => M.chooseTool(k)} />)}
    <IconButton icon="stamp" label={t('mark.t_stamp')} aria-pressed={bar === 'stamp' ? 'true' : 'false'} onClick={() => M.setStampTool(bar !== 'stamp')} data-tool="stamp" />
    {bar !== 'select' && bar !== 'erase' && bar !== 'stamp' && <span class="sep" />}
    {bar === 'hl' ? sw(HL, s.hlColor, M.chooseHl, t('mark.hl_color')) : bar === 'check' ? sw(COLORS, s.checkInk, M.chooseCheck, t('mark.check_color')) : bar !== 'select' && bar !== 'erase' && bar !== 'stamp' ? sw(COLORS, s.inkColor, M.chooseInk, t('mark.ink')) : null}
    {bar === 'hl' && <ToolSet class="mk-hlm" label={t('mark.hl_how')}><button type="button" aria-pressed={M.hlFree() ? 'false' : 'true'} title={t('mark.hl_snap_tip')} data-hlm="auto" onClick={() => M.setHlFree(false)}>{t('mark.hl_snap')}</button><button type="button" aria-pressed={M.hlFree() ? 'true' : 'false'} title={t('mark.hl_free_tip')} data-hlm="free" onClick={() => M.setHlFree(true)}>{t('mark.hl_free')}</button></ToolSet>}
    {bar === 'hl' && <ToolSet class="mk-w mk-hlw" label={t('mark.hl_width')}>{HL_W.map(([w, l]) => <button type="button" aria-pressed={M.hlWidth() === w ? 'true' : 'false'} title={l()} aria-label={l()} data-hlw={w} onClick={() => M.setHlWidth(w)}><i style={'--w:' + w / 3} /></button>)}</ToolSet>}
    {bar === 'pen' && <ToolSet class="mk-w" label={t('mark.width')}>{WIDTHS.map(([w, l]) => <button type="button" aria-pressed={s.penW === w ? 'true' : 'false'} title={l()} aria-label={l()} data-w={w} onClick={() => M.chooseWidth(w)}><i style={'--w:' + w} /></button>)}</ToolSet>}
    <span class="sep" />
    <IconButton icon="undo" label={t('mark.undo')} kbd="mod+z" disabled={!s.undoStack.length} onClick={M.undo} data-undo />
    <IconButton icon="redo" label={t('mark.redo')} kbd="mod+y" disabled={!s.redoStack.length} onClick={M.redo} data-redo />
    <span class="sep" />
    <IconButton icon="crop" label={t('mark.t_snip')} kbd="S" onClick={snip} data-snip />
  </div>;
}

// A small picture of a mark for the menu, drawn as on the paper (src/stamps.js stampPicture).
function Pic({ k, color, big }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, dpr = window.devicePixelRatio || 1, sz = K.isSticker(k) ? 40 : 34;
    c.width = c.height = Math.round(sz * dpr); c.style.width = c.style.height = sz + 'px';
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const m = { t: 'stamp', k, x: sz / 2, y: sz / 2, size: K.isSticker(k) ? sz - 6 : big ? 22 : 16, color };
    if (K.isSticker(k) && K.stickerAspect(k) > 1) m.size = (sz - 6) / K.stickerAspect(k);
    drawStamp(x, m);
  }, [k, color]);
  return <canvas ref={ref} aria-hidden="true" />;
}
// The right-click menu on a page, as the current app has it: her mark's own actions, a comment, a check, recent marks, a circle or
// highlight once, a text box, the pen once, then punctuation, proofreading marks and stickers in panels beside it, and the ink.
// The names of the marks are the current app's (and the teacher's own, from the mark key); they are drawn on the paper too.
function StampMenu() {
  const m = M.menuAt(), [fly, setFly] = useState(null), box = useRef(null), flyBox = useRef(null), into = useRef(false);
  useEffect(() => { setFly(null); if (!m) return; const el = box.current; if (!el) return;
    const r = el.getBoundingClientRect(); el.style.left = Math.max(8, Math.min(m.cx, innerWidth - r.width - 8)) + 'px'; el.style.top = Math.max(8, Math.min(m.cy, innerHeight - r.height - 8)) + 'px';
    el.focus({ preventScroll: true });
    const away = e => { if (!el.contains(e.target) && !(e.target.closest && e.target.closest('.mk-fly'))) M.closeMenu(); };
    // and when the window loses focus, as src/stamps.js closes it on blur and scroll
    document.addEventListener('pointerdown', away, true); document.addEventListener('scroll', M.closeMenu, true); window.addEventListener('blur', M.closeMenu);
    return () => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('scroll', M.closeMenu, true); window.removeEventListener('blur', M.closeMenu); };
  }, [m]);
  if (!m) return null;
  const s = state(), color = COLORS[s.inkColor], on = m.on, u = m.word;
  const recent = (prefs.get(K.RECENT_STAMPS, []) || []).filter(k => K.isSticker(k) || K.isProof(k));
  const item = (key, icon, label, act, extra = {}) => <button type="button" role="menuitem" class="st-item" data-act={act} onClick={() => M.menuDo(act)} {...extra}>{icon && <Icon name={icon} />}<span>{label}</span></button>;
  const sub = (name, icon, label) => <button type="button" role="menuitem" class={'st-item' + (fly === name ? ' on' : '')} aria-haspopup="menu" aria-expanded={fly === name ? 'true' : 'false'} data-sub={name} onClick={() => setFly(name)} onMouseEnter={() => setFly(name)}>{icon && <Icon name={icon} />}<span>{label}</span><Icon name="chr" size="xs" /></button>;
  const stamp = (k, cls) => <button type="button" role="menuitem" class={cls} data-mark={k} title={K.stampName(k)} aria-label={K.stampName(k)} onClick={() => M.menuDo('stamp', k)}><Pic k={k} color={color} big={cls === 'st-punc'} />{cls === 'st-proof' && <span>{K.stampName(k)}</span>}</button>;
  const key = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (fly) setFly(null); else M.closeMenu(); return; }
    const items = [...box.current.querySelectorAll('button')], i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i < 0 ? items.length - 1 : i - 1 + items.length) % items.length].focus(); }
    // Arrow Right on a row with a panel opens it and goes in (src/stamps.js showFly)
    if (e.key === 'ArrowRight' && document.activeElement.dataset.sub) { e.preventDefault(); into.current = true; setFly(document.activeElement.dataset.sub); }
  };
  // in a panel: the arrows walk its marks, Arrow Left (from the first) or Esc goes back to its row
  const flyKey = e => {
    const items = [...flyBox.current.querySelectorAll('button')], i = items.indexOf(document.activeElement);
    const back = () => { const r = box.current && box.current.querySelector('[data-sub="' + fly + '"]'); setFly(null); if (r) r.focus({ preventScroll: true }); };
    if (e.key === 'Escape' || (e.key === 'ArrowLeft' && i <= 0)) { e.preventDefault(); e.stopPropagation(); return back(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  };
  // (the flag is cleared only where it is used: a panel closed and opened again in quick turns still goes in)
  useEffect(() => { if (fly && into.current && flyBox.current) { into.current = false; const b = flyBox.current.querySelector('button'); if (b) b.focus({ preventScroll: true }); } }, [fly]);
  return <>
    <div ref={box} class="mk-menu" role="menu" aria-label={t('mark.menu')} tabindex="-1" onKeyDown={key}>
      {on && <>{item('del', 'trash', t('mark.m_delete'), 'del')}{(on.t === 'note' || on.t === 'text') && item('edit', 'edit', on.t === 'note' ? t('mark.m_edit_comment') : t('mark.m_edit_text'), 'edit')}<div class="st-sep" /></>}
      {item('note', 'comment', t('mark.m_comment'), 'note', { class: 'st-item st-pri' })}
      {item('check', 'check', t('mark.m_check'), 'check')}
      {recent.length > 0 && <div class="st-recent"><span class="st-rl">{t('mark.m_recent')}</span>{recent.map(k => stamp(k, 'st-stick'))}</div>}
      <div class="st-sep" />
      {u && item('cw', 'oval', t('mark.m_circle_word'), 'circleWord')}
      {item('oval', 'oval', t('mark.m_circle_once'), 'oval', { title: t('mark.m_once_tip') })}
      {u && item('hw', 'hl', t('mark.m_hl_word'), 'hlWord')}
      {item('hl', 'hl', t('mark.m_hl_once'), 'hl', { title: t('mark.m_once_tip') })}
      {item('text', 'text', t('mark.m_text'), 'text')}
      {item('pen', 'pen', t('mark.m_pen'), 'pen')}
      <div class="st-sep" />
      {sub('punct', null, t('mark.m_punct'))}{sub('proof', null, t('mark.m_proof'))}{sub('stick', 'stamp', t('mark.m_stickers'))}
      <div class="st-sep" />
      <div class="st-inks st-hls" role="group" aria-label={t('mark.hl_color')}>{Object.entries(HL).map(([k, v]) => <button type="button" class="st-sw sq" style={'background:' + v} aria-pressed={k === s.hlColor ? 'true' : 'false'} aria-label={COLOR_LINE[k]()} title={COLOR_LINE[k]()} data-hl-pick={k} onClick={() => M.chooseHl(k)} />)}</div>
      <div class="st-inks" role="group" aria-label={t('mark.ink')}>{Object.entries(COLORS).map(([k, v]) => <button type="button" class="st-sw" style={'background:' + v} aria-pressed={k === s.inkColor ? 'true' : 'false'} aria-label={COLOR_LINE[k]()} data-ink-pick={k} onClick={() => M.chooseInk(k)} />)}</div>
    </div>
    {fly && <div ref={flyBox} onKeyDown={flyKey} class="mk-fly" role="menu" aria-label={fly === 'punct' ? t('mark.m_punct') : fly === 'proof' ? t('mark.m_proof') : t('mark.m_stickers')} style={flyAt(box.current)}>
      {fly === 'punct' && <div class="st-puncs">{K.PUNCT.map(p => stamp(p[0], 'st-punc'))}</div>}
      {fly === 'proof' && <div class="st-proofs">{K.PROOF.map(p => stamp(p[0], 'st-proof'))}</div>}
      {fly === 'stick' && <><div class="st-sticks">{STICKERS.filter(x => !K.BRAINROT.has(x[0])).map(x => stamp(x[0], 'st-stick'))}</div>
        <div class="st-head">{t('mark.m_fun')}</div><div class="st-sticks">{STICKERS.filter(x => K.BRAINROT.has(x[0])).map(x => stamp(x[0], 'st-stick'))}</div></>}
    </div>}
    {s.once && <div class="mk-once" role="status"><span>{s.once.k === 'pen' ? t('mark.once_pen') : s.once.k === 'oval' ? t('mark.once_oval') : t('mark.once_hl')}</span>
      {s.once.k === 'pen' ? <button type="button" data-done onClick={M.endOnce}>{t('mark.done')}</button> : <u>{t('mark.once_esc')}</u>}</div>}
  </>;
}
const flyAt = el => { if (!el) return ''; const r = el.getBoundingClientRect(); const left = r.right + 4 + 330 > innerWidth ? r.left - 334 : r.right + 4; return 'left:' + Math.max(8, left) + 'px;top:' + Math.max(8, r.top) + 'px'; };
function Marking() { return <><Tools /><StampMenu /></>; }
export { Marking as Tools };
// Starts marking on the open paper: the hooks, the keys, and the pages already on screen. Returns what stops it again.
let say = () => {};
const snip = () => PARTS.snip().then(m => m.startSnip({ toast: say })).catch(e => console.error(e));
const hlSwitch = () => { const free = !M.hlFree(); M.setHlFree(free); say(t(free ? 'mark.hl_free_on' : 'mark.hl_snap_on')); };
export function start({ toast, openStudent, changed, zoom }) {
  say = toast; M.startMarking({ toast, openStudent });
  const up = e => { if (/^Arrow/.test(e.key)) M.nudgeDone(); }; addEventListener('keyup', up);
  // Zoom: Ctrl (Cmd) and the scroll wheel or a trackpad pinch zoom at the pointer (src/app/panels.js), and Ctrl + − 0 (src/app/wiring.js)
  const zoomAt = (z, at) => {
    const P = document.querySelector('.mk-paper'); z = Math.min(3, Math.max(0.5, Math.round(z * 100) / 100)); if (!P || z === zoom.get()) return;
    const r = P.getBoundingClientRect(), ay = at ? at.y - r.top : P.clientHeight / 2, ax = at ? at.x - r.left : P.clientWidth / 2;
    const fy = (P.scrollTop + ay) / Math.max(1, P.scrollHeight), fx = (P.scrollLeft + ax) / Math.max(1, P.scrollWidth);
    zoom.set(z);
    // the spot under the pointer stays put once the pages are their new size
    const keep = () => { P.scrollTop = fy * P.scrollHeight - ay; P.scrollLeft = fx * P.scrollWidth - ax; };
    requestAnimationFrame(() => requestAnimationFrame(keep)); setTimeout(keep, 250);
  };
  const wheel = e => { if (!(e.ctrlKey || e.metaKey) || !e.target.closest || !e.target.closest('.mk-paper')) return; e.preventDefault();
    zoomAt(zoom.get() * Math.exp(-Math.max(-40, Math.min(40, e.deltaY * (e.deltaMode ? 20 : 1))) * 0.005), { x: e.clientX, y: e.clientY }); };
  addEventListener('wheel', wheel, { passive: false });
  const onPaper = () => !!document.querySelector('.mk-paper');
  for (const pg of state().pages) if (pg.wrapEl && pg.canvas) M.bind(pg, pg.wrapEl);
  const offs = [
    M.onMarking(changed),
    ...TOOLS.map(([k, , key]) => register({ id: 'mark-tool-' + k, keys: key, label: TOOL_KEY[k], group: 'mark.tools', run: () => (k === 'hl' && state().tool === 'hl' ? hlSwitch() : M.chooseTool(k)) })),
    // a picked mark: the arrow keys move it, + and − resize it, copy, paste and a copy beside it, Esc lets go (src/app/wiring.js keydown)
    ...[['arrowleft', -1, 0], ['arrowright', 1, 0], ['arrowup', 0, -1], ['arrowdown', 0, 1]].flatMap(([a, x, y]) => [
      register({ id: 'mark-nudge-' + a, keys: a, label: 'mark.k_nudge', group: 'mark.tools', hidden: a !== 'arrowleft', when: M.pickedNow, run: e => M.nudge(x, y, e.repeat) }),
      register({ id: 'mark-nudge10-' + a, keys: 'shift+' + a, label: 'mark.k_nudge10', group: 'mark.tools', hidden: a !== 'arrowleft', when: M.pickedNow, run: e => M.nudge(10 * x, 10 * y, e.repeat) })]),
    register({ id: 'mark-bigger', keys: ['+', '='], label: 'mark.k_bigger', group: 'mark.tools', when: M.resizable, run: () => M.resize(1) }),
    register({ id: 'mark-smaller', keys: ['-', '_'], label: 'mark.k_smaller', group: 'mark.tools', when: M.resizable, run: () => M.resize(-1) }),
    register({ id: 'mark-copy', keys: 'mod+c', label: 'mark.k_copy', group: 'mark.tools', when: () => !!state().selected && !String(getSelection()), run: () => { if (M.copyMark()) say(t('mark.k_copied')); } }),
    register({ id: 'mark-paste', keys: 'mod+v', label: 'mark.k_paste', group: 'mark.tools', when: M.hasClip, run: () => M.pasteMark() }),
    register({ id: 'mark-dup', keys: 'mod+d', label: 'mark.k_dup', group: 'mark.tools', when: () => !!state().selected, run: () => { if (M.copyMark()) M.pasteMark(); } }),
    register({ id: 'mark-letgo', keys: 'escape', label: 'mark.k_letgo', group: 'mark.tools', when: () => !!state().selected && !state().once, run: () => M.letGo() }),
    register({ id: 'mark-once-end', keys: 'escape', label: 'mark.once_esc', group: 'mark.tools', when: () => !!state().once, run: () => M.endOnce() }),
    // the screenshot: S on the paper, Alt S (on a Mac Alt S types ß)
    register({ id: 'mark-snip', keys: ['s', 'alt+s', 'alt+ß'], label: 'mark.k_snip', group: 'mark.tools', when: () => !document.querySelector('[data-sniplayer]'), run: snip }),
    register({ id: 'mark-zoom-in', keys: ['mod+=', 'mod++'], label: 'mark.zoom_in', group: 'mark.tools', when: onPaper, run: () => zoomAt(Math.round((zoom.get() + 0.1) * 10) / 10) }),
    register({ id: 'mark-zoom-out', keys: ['mod+-', 'mod+_'], label: 'mark.zoom_out', group: 'mark.tools', when: onPaper, run: () => zoomAt(Math.round((zoom.get() - 0.1) * 10) / 10) }),
    register({ id: 'mark-zoom-100', keys: 'mod+0', label: 'mark.zoom_100', group: 'mark.tools', when: onPaper, run: () => zoomAt(1) }),
    register({ id: 'mark-del', keys: ['delete', 'backspace'], label: 'mark.delete_mark', group: 'mark.tools', when: () => !!state().selected, run: () => M.deleteSelected() }),
  ];
  return () => { removeEventListener('keyup', up); removeEventListener('wheel', wheel); offs.forEach(f => f()); };
}
const TOOL_KEY = { select: 'mark.t_select', pen: 'mark.t_pen', hl: 'mark.t_hl', oval: 'mark.t_oval', text: 'mark.t_text', note: 'mark.t_note', check: 'mark.t_check', erase: 'mark.t_erase' };
