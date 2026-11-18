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
import '../mark/lines.js';

export { M };
// The tools down the left of the paper, as the current app has them: the tools, what the tool in hand can be set to, undo and redo.
const TOOLS = [['select', 'cursor', 'v'], ['pen', 'pen', 'p'], ['hl', 'hl', 'h'], ['oval', 'oval', 'o'], ['text', 'text', 't'], ['note', 'comment', 'c'], ['check', 'check', 'k'], ['erase', 'eraser', 'e']];
const TOOL_LINE = { select: () => t('mark.t_select'), pen: () => t('mark.t_pen'), hl: () => t('mark.t_hl'), oval: () => t('mark.t_oval'), text: () => t('mark.t_text'), note: () => t('mark.t_note'), check: () => t('mark.t_check'), erase: () => t('mark.t_erase') };
const COLOR_LINE = { red: () => t('mark.c_red'), blue: () => t('mark.c_blue'), green: () => t('mark.c_green'), purple: () => t('mark.c_purple'), black: () => t('mark.c_black'), yellow: () => t('mark.c_yellow'), pink: () => t('mark.c_pink') };
const WIDTHS = [[1.2, () => t('mark.w_fine')], [2, () => t('mark.w_medium')], [3.5, () => t('mark.w_bold')]];
function Tools() {
  const s = state(), bar = s.once ? s.once.prev : s.tool;
  const sw = (list, on, pick, label) => <span class="mk-sw" role="group" aria-label={label}>{Object.entries(list).map(([k, v]) =>
    <button type="button" class="sw" style={'background:' + v} aria-pressed={k === on ? 'true' : 'false'} title={COLOR_LINE[k] ? COLOR_LINE[k]() : k} aria-label={COLOR_LINE[k] ? COLOR_LINE[k]() : k} data-sw={k} onClick={() => pick(k)} />)}</span>;
  return <div class="mk-tools" role="toolbar" aria-label={t('mark.tools')} aria-orientation="vertical">
    {TOOLS.map(([k, icon, key]) => <IconButton icon={icon} label={TOOL_LINE[k]()} kbd={key.toUpperCase()} aria-pressed={bar === k ? 'true' : 'false'} data-tool={k} onClick={() => M.chooseTool(k)} />)}
    {bar !== 'select' && bar !== 'erase' && <span class="sep" />}
    {bar === 'hl' ? sw(HL, s.hlColor, M.chooseHl, t('mark.hl_color')) : bar === 'check' ? sw(COLORS, s.checkInk, M.chooseCheck, t('mark.check_color')) : bar !== 'select' && bar !== 'erase' ? sw(COLORS, s.inkColor, M.chooseInk, t('mark.ink')) : null}
    {bar === 'pen' && <span class="mk-w" role="group" aria-label={t('mark.width')}>{WIDTHS.map(([w, l]) => <button type="button" aria-pressed={s.penW === w ? 'true' : 'false'} title={l()} aria-label={l()} data-w={w} onClick={() => M.chooseWidth(w)}><i style={'--w:' + w} /></button>)}</span>}
    <span class="sep" />
    <IconButton icon="undo" label={t('mark.undo')} kbd="mod+z" disabled={!s.undoStack.length} onClick={M.undo} data-undo />
    <IconButton icon="redo" label={t('mark.redo')} kbd="mod+y" disabled={!s.redoStack.length} onClick={M.redo} data-redo />
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
  const m = M.menuAt(), [fly, setFly] = useState(null), box = useRef(null);
  useEffect(() => { setFly(null); if (!m) return; const el = box.current; if (!el) return;
    const r = el.getBoundingClientRect(); el.style.left = Math.max(8, Math.min(m.cx, innerWidth - r.width - 8)) + 'px'; el.style.top = Math.max(8, Math.min(m.cy, innerHeight - r.height - 8)) + 'px';
    el.focus({ preventScroll: true });
    const away = e => { if (!el.contains(e.target) && !(e.target.closest && e.target.closest('.mk-fly'))) M.closeMenu(); };
    document.addEventListener('pointerdown', away, true); document.addEventListener('scroll', M.closeMenu, true);
    return () => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('scroll', M.closeMenu, true); };
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
  };
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
      <div class="st-inks" role="group" aria-label={t('mark.ink')}>{Object.entries(COLORS).map(([k, v]) => <button type="button" class="st-sw" style={'background:' + v} aria-pressed={k === s.inkColor ? 'true' : 'false'} aria-label={COLOR_LINE[k]()} data-ink-pick={k} onClick={() => M.chooseInk(k)} />)}</div>
    </div>
    {fly && <div class="mk-fly" role="menu" aria-label={fly === 'punct' ? t('mark.m_punct') : fly === 'proof' ? t('mark.m_proof') : t('mark.m_stickers')} style={flyAt(box.current)}>
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
export function start({ toast, openStudent, changed }) {
  M.startMarking({ toast, openStudent });
  for (const pg of state().pages) if (pg.wrapEl && pg.canvas) M.bind(pg, pg.wrapEl);
  const offs = [
    M.onMarking(changed),
    ...TOOLS.map(([k, , key]) => register({ id: 'mark-tool-' + k, keys: key, label: TOOL_KEY[k], group: 'mark.tools', run: () => M.chooseTool(k) })),
    register({ id: 'mark-once-end', keys: 'escape', label: 'mark.once_esc', group: 'mark.tools', when: () => !!state().once, run: () => M.endOnce() }),
    register({ id: 'mark-del', keys: ['delete', 'backspace'], label: 'mark.delete_mark', group: 'mark.tools', when: () => !!state().selected, run: () => M.deleteSelected() }),
  ];
  return () => offs.forEach(f => f());
}
const TOOL_KEY = { select: 'mark.t_select', pen: 'mark.t_pen', hl: 'mark.t_hl', oval: 'mark.t_oval', text: 'mark.t_text', note: 'mark.t_note', check: 'mark.t_check', erase: 'mark.t_erase' };
