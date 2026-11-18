// Library (design: library, stage 3 brief item 8): what every class shares. Activities is the current Planner's activity bank
// (src/planner/activities.js, lifted as engines/activities.js): find one, filter by part of class and kind, how to run it, the steps
// for students, a video, put it in a lesson as a slide, and the teacher's own activities (kv "activities", and activities.json in a
// linked Planner folder). Past lessons are every lesson already taught, to open or reuse. Units lists each course's units and opens
// one on its class's Course line. Rubrics shows the bank (kv "bank": rubrics and grading scales, wording only), sorted by unit.
// The built-in activities are the app's own English text, as in the current Planner; they are shown as written.
import { h, Fragment } from 'preact';
import { useState, useId, useEffect } from 'preact/hooks';
import { Tabs, Chip, Button, Checkbox, Select, TextInput, Field, Sheet, EmptyState, Icon, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { href, go, PARTS as PART } from '../router.js';
import { usePlan } from '../plan.js';
import { engine } from '../../planning/engine.js';
import { saveKv, saveLesson } from '../../planning/write.js';
import { nameKey } from '../../planning/plan.js';
import { saveFailed } from '../plan/save.js';
import { today, at, classOf } from '../plan/lessons.js';
import { ACTIVITIES, BOOK, actVideo, actSlide, normActivity } from '../../engines/activities.js';
import '../plan/lines.js';

const TABS = ['activities', 'past', 'units', 'rubrics'];
const TAB_LINE = { activities: 'plan.lib_activities', past: 'plan.lib_past', units: 'plan.lib_units', rubrics: 'plan.lib_rubrics' };
const PARTS = ['warmup', 'activity', 'review'], KINDS = ['talk', 'read', 'write', 'words', 'move', 'check'];
const PART_LINE = { warmup: 'plan.part_warmup', activity: 'plan.part_activity', review: 'plan.part_review' };
const KIND_LINE = { talk: 'plan.kind_talk', read: 'plan.kind_read', write: 'plan.kind_write', words: 'plan.kind_words', move: 'plan.kind_move', check: 'plan.kind_check' };
const raw = s => <span data-raw>{s}</span>;
const day = s => date(at(s), { day: 'numeric', month: 'long' });
const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
const mine = p => ((p && p.activities) || []).filter(a => a && a.name);

function Area({ label, value, onInput, rows = 3 }) {
  const id = useId();
  return <Field label={label} id={id}><textarea id={id} class="input" rows={rows} value={value} onInput={e => onInput(e.currentTarget.value)} /></Field>;
}

// ---------- Activities ----------
function ActivityRow({ a, open, onOpen, onUse, onEdit }) {
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
      <div class="row"><Button size="sm" variant="primary" icon="plus" onClick={onUse}>{t('plan.add_to_lesson')}</Button>
        <a class="btn sm" href={v.url} target="_blank" rel="noopener">{v.found ? t('plan.see_it') : t('plan.find_video')}<Icon name="arrow" size="xs" /></a>
        {a.mine && <Button size="sm" variant="quiet" onClick={onEdit}>{t('common.edit')}</Button>}</div>
    </div>}
  </li>;
}

function EditActivity({ p, a, onClose }) {
  const [d, setD] = useState(() => ({ ...a, how: a.how.join('\n'), slide: a.slide.join('\n'), video: a.video || '' })), [busy, setBusy] = useState(false);
  const set = patch => setD({ ...d, ...patch });
  const isMine = mine(p).some(x => x.id === a.id);
  const write = async list => { setBusy(true); try { await saveKv('activities', list); onClose(true); } catch (e) { saveFailed(e); } finally { setBusy(false); } };
  const save = () => {
    if (!d.name.trim()) return toast(t('plan.act_needs_name'));
    if (d.video.trim() && !/^https?:\/\/\S+$/i.test(d.video.trim())) return toast(t('plan.video_https'));
    const n = normActivity({ ...d, how: lines(d.how), slide: lines(d.slide), parts: d.parts.length ? d.parts : ['activity'], video: d.video.trim() });
    write([n, ...mine(p).filter(x => x.id !== a.id)]);
  };
  return <Sheet open title={isMine ? t('plan.edit_activity') : t('plan.my_activity')} icon={<Icon name="spark" />} onClose={() => onClose(false)}
    footer={<>{isMine && <Button variant="quiet" disabled={busy} onClick={() => write(mine(p).filter(x => x.id !== a.id))} data-focus="delete-activity">{t('common.delete')}</Button>}<span class="grow" />
      <Button variant="quiet" onClick={() => onClose(false)}>{t('common.cancel')}</Button><Button variant="primary" disabled={busy} onClick={save} data-focus="save-activity">{t('common.save')}</Button></>}>
    <div class="actedit">
      <TextInput label={t('plan.act_name')} value={d.name} onInput={v => set({ name: v })} data-act="name" />
      <Area label={t('plan.act_what')} value={d.what} rows={2} onInput={v => set({ what: v })} />
      <div class="row"><Select label={t('plan.act_kind')} value={d.kind} options={KINDS.map(k => ({ value: k, label: t(KIND_LINE[k]) }))} onChange={v => set({ kind: v })} />
        <TextInput label={t('plan.act_group')} value={d.group} onInput={v => set({ group: v })} /></div>
      <fieldset class="parts"><legend class="lbl">{t('plan.act_parts')}</legend>{PARTS.map(k => <Checkbox label={t(PART_LINE[k])} checked={d.parts.includes(k)}
        onChange={v => set({ parts: v ? [...d.parts, k] : d.parts.filter(x => x !== k) })} />)}</fieldset>
      <Area label={t('plan.act_how')} value={d.how} rows={5} onInput={v => set({ how: v })} />
      <Area label={t('plan.act_slide')} value={d.slide} rows={4} onInput={v => set({ slide: v })} />
      <TextInput label={t('plan.act_video')} type="url" value={d.video} onInput={v => set({ video: v })} />
    </div>
  </Sheet>;
}

// Put an activity in a lesson: the activity's steps for students as one slide at the end, the how-to in its speaker notes.
function UseActivity({ p, a, onClose }) {
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

function Activities({ p }) {
  const [q, setQ] = useState(''), [part, setPart] = useState(''), [kind, setKind] = useState(''), [open, setOpen] = useState('');
  const [edit, setEdit] = useState(null), [use, setUse] = useState(null);
  const all = [...mine(p).map(a => ({ ...normActivity(a), mine: true })), ...ACTIVITIES], s = q.trim().toLowerCase();
  const list = all.filter(a => (!part || a.parts.includes(part)) && (!kind || a.kind === kind) && (!s || (a.name + ' ' + a.what + ' ' + a.group + (a.book ? ' routine ' + a.book : '')).toLowerCase().includes(s)));
  return <>
    <div class="libtools">
      <TextInput label={t('plan.find_activity')} icon="search" type="search" value={q} onInput={setQ} data-focus="find-activity" />
      <Button icon="plus" onClick={() => setEdit({ id: '', name: '', what: '', kind: 'talk', parts: ['activity'], group: '', how: [], slide: [] })} data-focus="new-activity">{t('plan.my_activity')}</Button></div>
    <div class="chips" role="group" aria-label={t('plan.act_parts')}><Chip on={!part} onClick={() => setPart('')}>{t('plan.any_part')}</Chip>{PARTS.map(k => <Chip on={part === k} onClick={() => setPart(part === k ? '' : k)}>{t(PART_LINE[k])}</Chip>)}</div>
    <div class="chips" role="group" aria-label={t('plan.act_kind')}><Chip on={!kind} onClick={() => setKind('')}>{t('plan.any_kind')}</Chip>{KINDS.map(k => <Chip on={kind === k} onClick={() => setKind(kind === k ? '' : k)}>{t(KIND_LINE[k])}</Chip>)}</div>
    <p class="mute" role="status">{t('plan.n_activities', { n: list.length })}</p>
    {list.length ? <ul class="actlist">{list.map(a => <ActivityRow a={a} open={open === a.id} onOpen={() => setOpen(open === a.id ? '' : a.id)} onUse={() => setUse(a)} onEdit={() => setEdit(a)} />)}</ul>
      : <EmptyState icon="search" title={t('plan.nothing_matches')} text={t('plan.try_another')} />}
    <p class="mute credit">{t('plan.act_credit')} {raw(BOOK)}</p>
    {edit && <EditActivity p={p} a={edit.id ? edit : { ...edit, id: 'my-' + engine(p).lid() }} onClose={ok => { setEdit(null); if (ok) { setQ(''); setPart(''); setKind(''); } }} />}
    {use && <UseActivity p={p} a={use} onClose={() => setUse(null)} />}
  </>;
}

// ---------- Past lessons ----------
function Past({ p }) {
  const [q, setQ] = useState(''), [cls, setCls] = useState('');
  const now = today(), s = q.trim().toLowerCase();
  const rows = (p.lessons || []).map(l => ({ l, past: (l.slots || []).filter(x => x.date && x.date < now && (!cls || x.classId === cls)) }))
    .filter(r => r.past.length && (!s || String(r.l.title || '').toLowerCase().includes(s)))
    .map(r => ({ ...r, last: r.past.map(x => x.date).sort().pop() })).sort((a, b) => b.last.localeCompare(a.last));
  const classes = (p.setup && p.setup.classes) || [];
  return <>
    <div class="libtools"><TextInput label={t('plan.find_lesson')} icon="search" type="search" value={q} onInput={setQ} data-focus="find-lesson" />
      <Select label={t('plan.class')} value={cls} options={[{ value: '', label: t('plan.all_classes') }, ...classes.map(c => ({ value: c.id, label: c.name }))]} onChange={setCls} data-raw /></div>
    {rows.length ? <ul class="list">{rows.map(({ l, past }) => <li><a class="lrow" href={href('lesson', l.id)}><span class="lead"><Icon name="slides" /></span>
      <span class="main"><b data-raw>{l.title}</b><small>{t('plan.taught_to', { day: day(past[0].date), classes: [...new Set(past.map(x => (classOf(p, x.classId) || {}).name).filter(Boolean))].join(', ') })}</small></span>
      <span class="end mute">{t('plan.n_slides', { n: (l.slides || []).length })}</span></a></li>)}</ul>
      : <EmptyState icon="slides" title={t('plan.no_past')} text={t('plan.no_past_text')} />}
  </>;
}

// ---------- Units ----------
function Units({ p, classes }) {
  const E = engine(p), tt = (p.setup && p.setup.classes) || [];
  const courses = [...new Set((p.units || []).filter(u => u && u.course).map(u => u.course))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  // A course's units open on the Course line of the first class that takes it.
  const lineFor = course => { for (const x of classes || []) { if (x.loose) continue; const c = tt.find(k => nameKey(k.name) === nameKey(x.name)); if (c && c.course === course) return { x, c }; } return null; };
  if (!courses.length) return <EmptyState icon="cal" title={t('plan.no_units')} text={t('plan.no_units_text')} />;
  return <>{courses.map(course => { const to = lineFor(course), us = p.units.filter(u => u.course === course && u.start).sort((a, b) => a.start.localeCompare(b.start));
    return <section class="libsec"><h2 class="t4" data-raw>{course}</h2>
      <ul class="list">{us.map(u => { const inner = <><span class="main"><b data-raw>{u.title}</b>
        <small>{t('plan.unit_dates', { from: day(u.start), to: day(E.unitEnd(u)), n: (u.weeks || []).length })}</small></span>{to && <span class="end"><Icon name="chr" /></span>}</>;
        return <li>{to ? <a class="lrow" href={href('class', to.x.id || '-')} onClick={() => { try { sessionStorage.setItem('gsn.class.unit:' + to.c.id, JSON.stringify(u.id)); } catch {} }}>{inner}</a> : <div class="lrow">{inner}</div>}</li>; })}</ul>
    </section>; })}</>;
}

// ---------- Rubrics ----------
// The bank, edited (app/plan/bank-edit.jsx), loaded with this tab.
function Rubrics({ p }) {
  const [B, setB] = useState(null);
  useEffect(() => { PART.bank().then(setB); }, []);
  return B ? <B.BankList p={p} /> : <div class="loading" aria-busy="true" />;
}

export default function Library({ route, classes }) {
  const p = usePlan();
  const tab = TABS.includes(route.params.tab) ? route.params.tab : 'activities';
  return <div class="page library">
    <header class="ph"><div><h1>{t('nav.library')}</h1><p class="mute">{t('plan.lib_about')}</p></div></header>
    <Tabs label={t('nav.library')} value={tab} onChange={v => go('library', v === 'activities' ? '' : v)} tabs={TABS.map(id => ({ id, label: t(TAB_LINE[id]) }))} />
    <div role="tabpanel" id={'panel-' + tab} aria-labelledby={'tab-' + tab} class="libpanel">
      {!p ? <div class="loading" aria-busy="true" />
        : tab === 'activities' ? <Activities p={p} /> : tab === 'past' ? <Past p={p} /> : tab === 'units' ? <Units p={p} classes={classes} /> : <Rubrics p={p} />}
    </div>
  </div>;
}
