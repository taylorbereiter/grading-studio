// A right-click comment for the assistant (src/planner/extras.js ctxOpen, noteOpen): on a slide it is kept with that slide's
// comments, anywhere else on the lesson with the lesson's comments, with the words that were selected or clicked. Both go with the
// lesson's message. Typed or said; Ctrl+Enter keeps it, Escape leaves it.
import { h } from 'preact';
import { useState, useRef, useLayoutEffect, useEffect } from 'preact/hooks';
import { Button } from '../../ui/index.js';
import { TextBox } from '../../ui/services.jsx';
import { t } from '../../i18n/t.js';
import { assistant } from '../../services/assistant.js';
import './lines.js';
import './tool-lines.js';

export function NotePop({ l, at, save, onClose }) {
  const name = assistant().name || t('assistant.generic'), box = useRef(), [v, setV] = useState(''), [pos, setPos] = useState({ left: at.x, top: at.y });
  const s = at.i != null ? l.slides[at.i] : null;
  useLayoutEffect(() => { const r = box.current.getBoundingClientRect(); setPos({ left: Math.max(8, Math.min(at.x, innerWidth - r.width - 8)), top: Math.max(8, Math.min(at.y, innerHeight - r.height - 8)) }); const ta = box.current.querySelector('textarea'); if (ta) ta.focus(); }, []);
  useEffect(() => { const out = e => { if (box.current && !box.current.contains(e.target)) onClose(); }; document.addEventListener('mousedown', out, true); return () => document.removeEventListener('mousedown', out, true); }, []);
  const ok = () => {
    const ta = box.current.querySelector('textarea'), text = (ta ? ta.value : v).trim(); if (!text) return;
    const n = JSON.parse(JSON.stringify(l)), m = { by: 'you', text: s ? text : (at.quote ? t('tool.note_about', { q: at.quote.replace(/\s+/g, ' ').slice(0, 300) }) + '\n' : '') + text, at: Date.now() };
    if (s) n.slides[at.i].talk = [...(n.slides[at.i].talk || []), m]; else n.talk = [...(n.talk || []), m];
    save(n); onClose();
  };
  const where = s ? t('tool.note_slide', { n: at.i + 1, title: s.title || '' }) : at.quote ? '"' + at.quote.replace(/\s+/g, ' ').slice(0, 70) + (at.quote.length > 70 ? '…' : '') + '"' : t('tool.note_lesson');
  return <div class="notepop" role="dialog" aria-label={t('tool.note_for', { name })} ref={box} style={{ left: pos.left + 'px', top: pos.top + 'px' }}
    onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ok(); } }}>
    <b>{t('tool.note_for', { name })}</b><small class="mute" data-raw>{where}</small>
    <TextBox label={t('tool.note_what', { name })} value={v} onInput={setV} rows={4} data-focus="note-text" />
    <div class="row"><small class="mute">{t('tool.note_keys')}</small><span class="grow" /><Button size="sm" variant="quiet" onClick={onClose}>{t('common.cancel')}</Button><Button size="sm" variant="primary" onClick={ok} data-focus="note-ok">{t('tool.note_add')}</Button></div>
  </div>;
}
