// The activity bank's shared pieces (src/planner/activities.js): a row that opens to show how to run it, the search and the part and
// kind chips over the list, and putting an activity in a lesson. Used by Library > Activities and by the lesson's Beside drawer.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Chip, Button, TextInput, Sheet, EmptyState, Icon, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { go } from '../router.js';
import { engine } from '../../planning/engine.js';
import { saveLesson } from '../../planning/write.js';
import { saveFailed } from './save.js';
import { today, at, classOf } from './lessons.js';
import { ACTIVITIES, BOOK, actVideo, actSlide, normActivity } from '../../engines/activities.js';
import './lines.js';

export const PARTS = ['warmup', 'activity', 'review'], KINDS = ['talk', 'read', 'write', 'words', 'move', 'check'];
export const PART_LINE = { warmup: 'plan.part_warmup', activity: 'plan.part_activity', review: 'plan.part_review' };
export const KIND_LINE = { talk: 'plan.kind_talk', read: 'plan.kind_read', write: 'plan.kind_write', words: 'plan.kind_words', move: 'plan.kind_move', check: 'plan.kind_check' };
const raw = s => <span data-raw>{s}</span>;
const day = s => date(at(s), { day: 'numeric', month: 'long' });
export const mine = p => ((p && p.activities) || []).filter(a => a && a.name);

// extra: more buttons beside Add to a lesson (the Beside drawer's Add after the slide I'm on).
export function ActivityRow({ a, open, onOpen, onUse, onEdit, extra }) {
  const v = actVideo(a);
  return <li class={'act' + (open ? ' open' : '')}>
    <button type="button" class="acth" aria-expanded={String(open)} onClick={onOpen}>
      <b data-raw>{a.name}</b>
      <span class="mute">{a.parts.map(x => t(PART_LINE[x])).join(', ')} · {t(KIND_LINE[a.kind] || 'plan.kind_talk')}{a.group && <> · {raw(a.group)}</>}{a.book > 0 && <> · {t('plan.routine_n', { n: a.book })}</>}{a.mine && <> · {t('plan.mine')}</>}</span>
      <Icon name={open ? 'chu' : 'chd'} size="xs" /></button>
    {open && <div class="actb">
      {a.what && <p data-raw>{a.what}</p>}
      {a.how.length > 0 && <><h4 class="sub">{t('plan.how_to_run')}</h4><ol>{a.how.map(x => <li data-raw>{x}</li>)}</ol></>}
      {a.tip && <p class="mute" data-raw>{a.tip}</p>}
      {a.slide.length > 0 && <><h4 class="sub">{t('plan.on_the_slide')}</h4><ol>{a.slide.map(x => <li data-raw>{x}</li>)}</ol></>}
      <div class="row">{extra}<Button size="sm" variant={extra ? undefined : 'primary'} icon="plus" onClick={onUse} data-act-use>{t('plan.add_to_lesson')}</Button>
        <a class="btn sm" href={v.url} target="_blank" rel="noopener">{v.found ? t('plan.see_it') : t('plan.find_video')}<Icon name="arrow" size="xs" /></a>
        {a.mine && <Button size="sm" variant="quiet" onClick={onEdit}>{t('common.edit')}</Button>}</div>
    </div>}
  </li>;
}

// Put an activity in a lesson: the activity's steps for students as one slide at the end, the how-to in its speaker notes.
export function UseActivity({ p, a, onClose }) {
  const E = engine(p), now = today();
  const soon = (p.lessons || []).filter(l => (l.slots || []).some(s => s.date >= now))
    .sort((x, y) => Math.min(...x.slots.map(s => s.date >= now ? +at(s.date) : Infinity)) - Math.min(...y.slots.map(s => s.date >= now ? +at(s.date) : Infinity))).slice(0, 8);
  const put = async l => {
    try {
      const n = JSON.parse(JSON.stringify(l || E.normLesson({ title: a.name, slots: [], slides: [{ layout: 'title', title: a.name }] })));
      n.slides.push(actSlide(a));
      await saveLesson(n); toast(t('plan.act_added', { title: n.title })); onClose(); go('lesson', n.id, 'edit');
    } catch (e) { saveFailed(e); }
  };
  const when = l => l.slots.filter(s => s.date >= now).map(s => { const c = classOf(p, s.classId); return (c ? c.name + ' ' : '') + day(s.date); }).join(', ');
  return <Sheet open title={t('plan.add_name_to', { name: a.name })} icon={<Icon name="plus" />} onClose={onClose}>
    <p class="mute">{t('plan.act_goes_in')}</p>
    {soon.length > 0 && <><h3 class="sub">{t('plan.coming_up')}</h3>
      <ul class="list">{soon.map(l => <li><button type="button" class="lrow" onClick={() => put(l)}><span class="main"><b data-raw>{l.title}</b><small data-raw>{when(l)}</small></span></button></li>)}</ul></>}
    <div class="row"><Button icon="plus" onClick={() => put(null)} data-focus="act-new-lesson">{t('plan.start_with_it')}</Button></div>
  </Sheet>;
}

// The bank, found by name, words or routine number, and narrowed by part of the class and kind. tools: what sits beside the search
// (Library's My activity); row: the props each row gets beyond its activity.
export function ActList({ p, tools, row, onUse, onEdit, reset }) {
  const [q, setQ] = useState(''), [part, setPart] = useState(''), [kind, setKind] = useState(''), [open, setOpen] = useState('');
  if (reset) reset.current = () => { setQ(''); setPart(''); setKind(''); };
  const all = [...mine(p).map(a => ({ ...normActivity(a), mine: true })), ...ACTIVITIES], s = q.trim().toLowerCase();
  const list = all.filter(a => (!part || a.parts.includes(part)) && (!kind || a.kind === kind) && (!s || (a.name + ' ' + a.what + ' ' + a.group + (a.book ? ' routine ' + a.book + ' ' + a.book : '')).toLowerCase().includes(s)));
  return <>
    <div class="libtools">
      <TextInput label={t('plan.find_activity')} icon="search" type="search" value={q} onInput={setQ} data-focus="find-activity" />{tools}</div>
    <div class="chips" role="group" aria-label={t('plan.act_parts')}><Chip on={!part} onClick={() => setPart('')}>{t('plan.any_part')}</Chip>{PARTS.map(k => <Chip on={part === k} onClick={() => setPart(part === k ? '' : k)}>{t(PART_LINE[k])}</Chip>)}</div>
    <div class="chips" role="group" aria-label={t('plan.act_kind')}><Chip on={!kind} onClick={() => setKind('')}>{t('plan.any_kind')}</Chip>{KINDS.map(k => <Chip on={kind === k} onClick={() => setKind(kind === k ? '' : k)}>{t(KIND_LINE[k])}</Chip>)}</div>
    <p class="mute" role="status">{t('plan.n_activities', { n: list.length })}</p>
    {list.length ? <ul class="actlist">{list.map(a => <ActivityRow a={a} open={open === a.id} onOpen={() => setOpen(open === a.id ? '' : a.id)} onUse={() => onUse(a)} onEdit={() => onEdit && onEdit(a)} {...(row ? row(a) : {})} />)}</ul>
      : <EmptyState icon="search" title={t('plan.nothing_matches')} text={t('plan.try_another')} />}
    <p class="mute credit">{t('plan.act_credit')} {raw(BOOK)}</p>
  </>;
}
