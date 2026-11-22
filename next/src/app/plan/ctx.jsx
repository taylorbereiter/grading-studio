// A right-click anywhere in the Planner (src/planner/extras.js ctxOpen, ctxTarget, noteOpen), loaded the first time
// (router.js PARTS.ctx; plan/ctx-on.js opens it): on a slide, a lesson, a file, the words selected or the words clicked, a short
// menu with a comment for the assistant on it, or it put in the assistant's box (plan/cbox.js, kv "cbox", as the current Planner
// keeps it). A comment on a slide or a lesson is also kept in that slide's or lesson's comments, so it goes with the lesson's
// message; every comment goes in the box with what it is about. Shift + right-click, and text boxes, keep the browser's own menu.
import { h, Fragment, render } from 'preact';
import { useState, useRef, useLayoutEffect, useEffect } from 'preact/hooks';
import { Button } from '../../ui/index.js';
import { TextBox } from '../../ui/services.jsx';
import { t } from '../../i18n/t.js';
import { assistant } from '../../services/assistant.js';
import { boxAdd, chipName, whereEn, cut } from './cbox.js';
import { changeLesson } from '../../planning/lesson-change.js';
import { saveFailed } from './save.js';
import './les-lines.js';
import './tool-lines.js';

const aiName = () => assistant().name || t('assistant.generic');
const NOTE = { slide: 'les.ctx_note_slide', lesson: 'les.ctx_note_lesson', file: 'les.ctx_note_file', sel: 'les.ctx_note_sel', this: 'les.ctx_note_this' };
const ADD = { slide: 'les.ctx_add_slide', lesson: 'les.ctx_add_lesson', file: 'les.ctx_add_file', sel: 'les.ctx_add_sel', this: 'les.ctx_add_this' };
const lessonChip = (p, id) => { const l = ((p && p.lessons) || []).find(x => x.id === id); return l && { kind: 'lesson', lesson: id, label: l.title || 'Lesson' }; }; // not-words
const slideChip = (l, i) => { const s = l && l.slides[i]; return s && { kind: 'slide', lesson: l.id, i, label: (l.title || 'Lesson') + ', slide ' + (i + 1) + (s.title ? ': ' + s.title : '') }; }; // not-words
// What was right-clicked, as a chip the box can hold (src/planner/extras.js ctxTarget), in the current Planner's shapes.
function target(at, o) {
  const el = at.el, w = o.where || { k: 'planner' };
  const quote = text => ({ kind: 'quote', label: whereEn(w) + (text ? ': “' + cut(text, 70) + '”' : ''), text, where: w });
  if (at.sel) return quote(at.sel.slice(0, 4000));
  if (o.l) { const th = el.closest('[data-slide-i]'), i = th ? +th.dataset.slideI : el.closest('.stage,.ed-stage') ? o.cur : null; const c = i != null && slideChip(o.l, i); if (c) return c; }
  const ch = el.closest('[data-chip]'); if (ch) { try { const c = JSON.parse(ch.dataset.chip); if (c && c.kind) return c; } catch { } }
  const a = el.closest('a[href^="#/lesson/"]'), m = a && /^#\/lesson\/([^/?#]+)/.exec(a.getAttribute('href')), lc = m && lessonChip(o.p, decodeURIComponent(m[1]));
  if (lc) return lc;
  const blk = el.closest('p,li,td,h1,h2,h3,section,article') || el;
  return quote((blk.innerText || blk.textContent || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1500));
}
// A comment kept where it belongs and put in the box (src/planner/extras.js noteOpen ok).
async function keepNote(c, text, o) {
  const id = c.kind === 'slide' || c.kind === 'lesson' ? c.lesson : c.kind === 'quote' && o.l ? o.l.id : null;
  if (id) {
    const m = { by: 'you', text: c.kind === 'quote' && c.text ? t('tool.note_about', { q: cut(c.text, 300) }) + '\n' + text : text, at: Date.now() };
    const edit = l => { const n = JSON.parse(JSON.stringify(l)); if (c.kind !== 'slide') { n.talk = [...(n.talk || []), m]; return n; } const s = n.slides[c.i]; if (!s) return; s.talk = [...(s.talk || []), m]; return n; };
    // The open lesson goes through its page's own save, so the page and storage stay one; any other is changed where it is stored.
    if (o.l && o.save && o.l.id === id) { const n = edit(o.l); if (n) await o.save(n); }
    else await changeLesson(id, edit);
  }
  await boxAdd({ kind: 'note', about: c, text, label: 'Comment on ' + c.label }); // not-words
}

function Ctx({ at, o, c, what, host, start, done }) {
  const [mode, setMode] = useState(start), [pos, setPos] = useState(null), [v, setV] = useState(''), box = useRef(), name = aiName();
  useLayoutEffect(() => {
    const r = box.current.getBoundingClientRect(), hr = host === document.body ? { left: 0, top: 0, width: innerWidth, height: innerHeight } : host.getBoundingClientRect();
    setPos({ left: Math.max(8, Math.min(at.x - hr.left, hr.width - r.width - 8)), top: Math.max(8, Math.min(at.y - hr.top, hr.height - r.height - 8)) });
    const f = box.current.querySelector(mode === 'menu' ? 'button' : 'textarea'); if (f) f.focus({ preventScroll: true });
  }, [mode]);
  useEffect(() => {
    const out = e => { if (box.current && !box.current.contains(e.target)) done(); }, roll = e => { if (mode === 'menu' && box.current && !box.current.contains(e.target)) done(); };
    document.addEventListener('mousedown', out, true); addEventListener('scroll', roll, true);
    return () => { document.removeEventListener('mousedown', out, true); removeEventListener('scroll', roll, true); };
  }, [mode]);
  const add = () => { done(); boxAdd(c); };
  const ok = () => { const text = v.trim(); if (!text) return box.current.querySelector('textarea').focus(); done(); keepNote(c, text, o).catch(saveFailed); };
  const keys = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return done(); }
    if (mode === 'note' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); return ok(); }
    if (mode === 'menu' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); const bs = [...box.current.querySelectorAll('[role=menuitem]')], i = bs.indexOf(document.activeElement); bs[(i + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus(); }
  };
  // placed before it is painted (useLayoutEffect), so it never shows where it would not fit
  const style = { left: (pos ? pos.left : at.x) + 'px', top: (pos ? pos.top : at.y) + 'px' };
  return <div class={'notepop' + (mode === 'menu' ? ' ctxmenu' : '') + (host === document.body ? '' : ' inside')} role={mode === 'menu' ? 'menu' : 'dialog'} aria-label={t('tool.note_for', { name })} ref={box} style={style} onKeyDown={keys} data-ctx={mode}>
    {mode === 'menu' ? <>
      <button type="button" role="menuitem" class="btn quiet sm" onClick={() => setMode('note')} data-ctx-do="note">{t(NOTE[what], { name })}</button>
      <button type="button" role="menuitem" class="btn quiet sm" onClick={add} data-ctx-do="add">{t(ADD[what], { name })}</button>
      <small class="mute">{t('les.ctx_hint')}</small>
    </> : <>
      <b>{t('tool.note_for', { name })}</b><small class="mute" data-raw>{chipName(o.p, c)}</small>
      <TextBox label={t('tool.note_what', { name })} value={v} onInput={setV} rows={4} data-focus="ctx-note-text" />
      <div class="row"><small class="mute">{t('tool.note_keys')}</small><span class="grow" /><Button size="sm" variant="quiet" onClick={done}>{t('common.cancel')}</Button><Button size="sm" variant="primary" onClick={ok} data-focus="ctx-note-ok">{t('tool.note_add')}</Button></div>
    </>}
  </div>;
}

let shut = null;
function show(at, o, c, what, start) {
  if (shut) shut();
  const host = (at.el.closest && at.el.closest('dialog[open]')) || document.body, div = document.createElement('div');
  host.appendChild(div);
  const done = () => { if (shut !== done) return; shut = null; render(null, div); div.remove(); };
  shut = done;
  render(<Ctx at={at} o={o} c={c} what={what} host={host} start={start} done={done} />, div);
}
// at: { x, y, el, sel } from the right-click; o: { p, where: { k, v }, and on the lesson page l, save, cur }.
export function open(at, o) {
  const c = target(at, o);
  show(at, o, c, at.sel ? 'sel' : { slide: 'slide', lesson: 'lesson', file: 'file' }[c.kind] || 'this', 'menu');
}
// From a lesson card's menu (the Calendar): a comment on that lesson, written beside the card, or the lesson put in the box.
export function lesson(how, p, id, el) {
  const c = lessonChip(p, id); if (!c) return;
  if (how === 'add') return boxAdd(c);
  const r = el.getBoundingClientRect();
  show({ x: r.left, y: r.bottom + 4, el }, { p }, c, 'lesson', 'note');
}
