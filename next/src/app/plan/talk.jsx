// Comments on a slide or the whole lesson, for the teacher and the assistant (src/planner/review.js slideTalkHtml, lessonTalkHtml).
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Button, Checkbox } from '../../ui/index.js';
import { TextBox } from '../../ui/services.jsx';
import { t, date } from '../../i18n/t.js';
import './lines.js';

// In the current Planner's shape: { by: 'you' | 'claude', text, at, done? }. Enter adds the comment, as the current Planner's box does;
// Shift+Enter starts a new line.
export function Talk({ talk, onChange, ai, label }) {
  const [text, setText] = useState(''), [writing, setWriting] = useState(false);
  const add = () => { const v = text.trim(); if (!v) return; onChange([...(talk || []), { by: 'you', text: v, at: Date.now() }]); setText(''); setWriting(false); };
  return <section class="talk" aria-label={label}>
    {(talk || []).length > 0 && <ul class="tlist">{talk.map((c, i) => <li class={'tc' + (c.done ? ' done' : '')}>
      <Checkbox round checked={!!c.done} label={c.by === "claude" ? t('plan.from_name', { name: ai }) : t('plan.you')} onChange={on => onChange(talk.map((x, j) => j !== i ? x : on ? { ...x, done: true } : (({ done, ...r }) => r)(x)))} />
      <p data-raw>{c.text}</p><small class="mute" data-raw>{c.at ? date(new Date(c.at), { month: 'short', day: 'numeric' }) : ''}</small></li>)}</ul>}
    {writing ? <>
      <TextBox label={t('plan.add_comment')} value={text} onInput={setText} rows={2} autoFocus onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); add(); } if (e.key === 'Escape' && !text) { e.stopPropagation(); setWriting(false); } }} />
      <div class="row"><Button size="sm" variant="quiet" onClick={() => { setText(''); setWriting(false); }}>{t('common.cancel')}</Button><Button size="sm" variant="primary" disabled={!text.trim()} onClick={add}>{t('plan.add_comment')}</Button></div></>
      : <div><Button size="sm" icon="comment" onClick={() => setWriting(true)}>{t('plan.add_comment')}</Button></div>}
  </section>;
}

