// A slide's text box with its formatting shown as it will look (src/planner/rich.js rtEditor, rtDo, rtKey): bold, italic,
// underline, the slide colors, bullets, numbers and two levels of indent. What is kept is the current Planner's own text
// ("• " bullets, "1. " numbers, tabs to indent, **bold**, *italic*, __underline__, {red}…{/}), read back from the box by the
// Planner's own code, so a lesson saved here reads the same in the current Planner. Words can be said as well as typed.
//
// Keys, as the current Planner has them: Ctrl+B, I, U; Ctrl+Shift+8 bullets; Ctrl+Shift+7 numbers; Tab and Shift+Tab indent;
// Shift+Enter a new paragraph; Enter on an empty bullet ends the list; Backspace at the start of a bullet takes the bullet off.
import { h } from 'preact';
import { useRef, useLayoutEffect, useState, useId } from 'preact/hooks';
import { Mic } from '../../ui/services.jsx';
import { t } from '../../i18n/t.js';
import * as T from '../../engines/plantools.js';
import { RT_COLORS } from '../../engines/planner.js';
import './edit-lines.js';

const COLOR_LINE = { red: 'edit.color_red', orange: 'edit.color_orange', green: 'edit.color_green', blue: 'edit.color_blue', purple: 'edit.color_purple', gray: 'edit.color_gray' };
const empty = () => T.rtLineHtml({ lvl: 0, kind: 'p', text: '' }, true);

export function RichBox({ label, hint, value, onInput, ...rest }) {
  const el = useRef(), last = useRef(null), id = useId(), [pal, setPal] = useState(false), [on, setOn] = useState({});
  useLayoutEffect(() => { if (value !== last.current) { el.current.innerHTML = T.rtHtml(value || '', true) || empty(); last.current = value; } }, [value]);
  const changed = () => { const b = el.current; T.rtTidy(b); T.rtRenumber(b); const v = T.rtRead(b); last.current = v; onInput(v); state(); };
  const state = () => {
    const b = el.current, ls = document.activeElement === b ? T.rtCurLines(b) : [];
    let s = {}; try { s = { bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline') }; } catch { }
    setOn({ ...s, bullets: ls.length > 0 && ls.every(d => d.classList.contains('rt-b')), numbers: ls.length > 0 && ls.every(d => d.classList.contains('rt-n')) });
  };
  const run = cmd => {
    const b = el.current; setPal(false);
    if (document.activeElement !== b) { b.focus(); const r = document.createRange(); r.selectNodeContents(b); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
    if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline') { document.execCommand(cmd); return changed(); }
    if (cmd.startsWith('color:')) {
      const c = cmd.slice(6);
      document.execCommand('styleWithCSS', false, false);
      document.execCommand('foreColor', false, RT_COLORS[c] || T.RT_NOCOLOR);
      // Automatic: the words go back to the slide's own text color (marked, so a color around them doesn't count)
      if (!RT_COLORS[c]) for (const n of [...b.querySelectorAll('font[color]')]) if (n.getAttribute('color').toLowerCase() === T.RT_NOCOLOR) { const sp = document.createElement('span'); sp.dataset.c = ''; sp.style.color = getComputedStyle(b).color; sp.append(...n.childNodes); n.replaceWith(sp); }
      return changed();
    }
    const ls = T.rtCurLines(b); if (!ls.length) return;
    if (cmd === 'bullets' || cmd === 'numbers') { const k = cmd === 'bullets' ? 'b' : 'n', all = ls.every(d => d.classList.contains('rt-' + k)); for (const d of ls) T.rtSetKind(d, all ? 'p' : k); }
    if (cmd === 'indent') for (const d of ls) T.rtSetLvl(d, T.rtLvl(d) + 1);
    if (cmd === 'outdent') for (const d of ls) T.rtSetLvl(d, T.rtLvl(d) - 1);
    changed();
  };
  const key = e => {
    const b = el.current, mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (mod && !e.shiftKey && (k === 'b' || k === 'i' || k === 'u')) { e.preventDefault(); return run({ b: 'bold', i: 'italic', u: 'underline' }[k]); }
    if (mod && e.shiftKey && (e.key === '8' || e.key === '*' || e.code === 'Digit8')) { e.preventDefault(); return run('bullets'); }
    if (mod && e.shiftKey && (e.key === '7' || e.key === '&' || e.code === 'Digit7')) { e.preventDefault(); return run('numbers'); }
    if (e.key === 'Tab') { e.preventDefault(); return run(e.shiftKey ? 'outdent' : 'indent'); }
    const sel = getSelection(); if (!sel.isCollapsed || !sel.rangeCount) return;
    const [d] = T.rtCurLines(b); if (!d) return;
    const r = sel.getRangeAt(0), pre = document.createRange(); pre.selectNodeContents(d); pre.setEnd(r.startContainer, r.startOffset);
    const atStart = !pre.toString().length;
    if (e.key === 'Enter' && !e.shiftKey && !d.textContent.trim() && !d.classList.contains('rt-p')) { e.preventDefault(); if (T.rtLvl(d)) T.rtSetLvl(d, T.rtLvl(d) - 1); else T.rtSetKind(d, 'p'); return changed(); }
    if (e.key === 'Backspace' && atStart && (!d.classList.contains('rt-p') || T.rtLvl(d))) { e.preventDefault(); if (!d.classList.contains('rt-p')) T.rtSetKind(d, 'p'); else T.rtSetLvl(d, T.rtLvl(d) - 1); return changed(); }
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); document.execCommand('insertParagraph'); changed(); }
  };
  const paste = e => { const s = (e.clipboardData && e.clipboardData.getData('text/plain')) || ''; if (!s) return; e.preventDefault(); s.replace(/\r/g, '').split('\n').forEach((line, i) => { if (i) document.execCommand('insertParagraph'); if (line) document.execCommand('insertText', false, line); }); changed(); };
  const said = w => { const b = el.current; if (document.activeElement !== b) { b.focus(); const r = document.createRange(); r.selectNodeContents(b); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } document.execCommand('insertText', false, (w.match(/^\s/) ? '' : ' ') + w); changed(); };
  const B = (cmd, line, tip, cls) => <button type="button" class={'btn sm quiet rtb ' + (cls || '') + (on[cmd] ? ' on' : '')} aria-pressed={String(!!on[cmd])} title={t(tip)} aria-label={t(tip)} onMouseDown={e => { e.preventDefault(); run(cmd); }} data-rt={cmd}>{t(line)}</button>;
  return <div class="fld rtfield">
    <span class="lab" id={id}>{label}</span>
    <div class="rttools" role="toolbar" aria-labelledby={id}>
      {B('bold', 'edit.rt_b', 'edit.rt_b_tip', 'dt-bold')}{B('italic', 'edit.rt_i', 'edit.rt_i_tip', 'dt-italic')}{B('underline', 'edit.rt_u', 'edit.rt_u_tip', 'dt-underline')}
      <span class="rtc"><button type="button" class="btn sm quiet rtb" aria-expanded={String(pal)} title={t('edit.rt_color_tip')} aria-label={t('edit.rt_color_tip')} onMouseDown={e => { e.preventDefault(); setPal(!pal); }} data-rt="colors">{t('edit.rt_color')}</button>
        {pal && <span class="rtpal" role="group" aria-label={t('edit.rt_color_tip')}>{Object.entries(RT_COLORS).map(([k, v]) => <button type="button" class="sw" style={{ background: v }} title={t(COLOR_LINE[k])} aria-label={t(COLOR_LINE[k])} onMouseDown={e => { e.preventDefault(); run('color:' + k); }} data-rt={'color:' + k} />)}
          <button type="button" class="btn sm quiet" onMouseDown={e => { e.preventDefault(); run('color:'); }}>{t('edit.rt_auto')}</button></span>}</span>
      <span class="dsep" />{B('bullets', 'edit.rt_bullets', 'edit.rt_bullets_tip')}{B('numbers', 'edit.rt_numbers', 'edit.rt_numbers_tip')}{B('outdent', 'edit.rt_outdent', 'edit.rt_outdent_tip')}{B('indent', 'edit.rt_indent', 'edit.rt_indent_tip')}
      <span class="grow" /><Mic onText={said} />
    </div>
    <div class="rtbox ls-slide-text" ref={el} contentEditable="true" spellcheck={true} role="textbox" aria-multiline="true" aria-labelledby={id} data-raw
      onInput={changed} onKeyDown={key} onKeyUp={state} onMouseUp={state} onPaste={paste} {...rest} />
    {hint && <small class="hint">{hint}</small>}
  </div>;
}
