// Library (design: library, stage 3 brief item 8): what every class shares. Activities is the current Planner's activity bank
// (src/planner/activities.js, lifted as engines/activities.js): find one, filter by part of class and kind, how to run it, the steps
// for students, a video, put it in a lesson as a slide, and the teacher's own activities (kv "activities", and activities.json in a
// linked Planner folder). Past lessons are every lesson already taught, to open or reuse. Units lists each course's units and opens
// one on its class's Course line. Rubrics shows the bank (kv "bank": rubrics and grading scales, wording only), sorted by unit.
// The built-in activities are the app's own English text, as in the current Planner; they are shown as written.
import { h, Fragment } from 'preact';
import { useState, useId, useEffect, useRef } from 'preact/hooks';
import { Tabs, Chip, Button, Checkbox, Select, TextInput, Field, Sheet, EmptyState, Icon, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { href, go, PARTS as PART } from '../router.js';
import { usePlan } from '../plan.js';
import { engine } from '../../planning/engine.js';
import { saveKv, saveLesson } from '../../planning/write.js';
import { nameKey, plannerKv } from '../../planning/plan.js';
import { saveFailed } from '../plan/save.js';
import { today, at, classOf, mondayOf } from '../plan/lessons.js';
import { ACTIVITIES, BOOK, actVideo, actSlide, normActivity } from '../../engines/activities.js';
import '../plan/lines.js';
import '../plan/cal-lines.js';

const TABS = ['activities', 'past', 'units', 'rubrics', 'examples'];
const TAB_LINE = { activities: 'plan.lib_activities', past: 'plan.lib_past', units: 'plan.lib_units', rubrics: 'plan.lib_rubrics', examples: 'plan.lib_examples' };
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
  // found by its title, its pack's name and its files' names (src/planner/library.js renderLibrary)
  const hit = l => !s || [l.title, l.library, ...(l.files || []).map(f => f.name)].join(' ').toLowerCase().includes(s);
  const rows = (p.lessons || []).map(l => ({ l, past: (l.slots || []).filter(x => x.date && x.date < now && (!cls || x.classId === cls)) }))
    .filter(r => r.past.length && hit(r.l))
    .map(r => ({ ...r, last: r.past.map(x => x.date).sort().pop() })).sort((a, b) => b.last.localeCompare(a.last));
  // lessons from a lesson pack (l.library), by the pack's name: on no class, so shown here and nowhere else
  const packs = cls ? [] : [...new Set((p.lessons || []).filter(l => l.library).map(l => l.library))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(g => ({ g, ls: p.lessons.filter(l => l.library === g && !(l.slots || []).some(x => x.date && x.date < now) && hit(l)).sort((a, b) => String(a.title).localeCompare(String(b.title), undefined, { numeric: true })) })).filter(x => x.ls.length);
  const classes = (p.setup && p.setup.classes) || [];
  const pick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.zip,application/zip'; i.onchange = () => i.files[0] && PART.packs().then(m => m.packImport(p, i.files[0])).catch(saveFailed); i.click(); };
  const imp = <Button icon="upload" onClick={pick} data-pack-import>{t('cal.import_pack')}</Button>;
  const card = (l, sub) => <li><div class="lrow"><a class="main link" href={href('lesson', l.id)}><span class="lead"><Icon name="slides" /></span><span><b data-raw>{l.title}</b><small>{sub}</small></span></a>
    <span class="end mute">{t('plan.n_slides', { n: (l.slides || []).length })}</span></div>
    {(l.files || []).length > 0 && <div class="lfiles">{l.files.slice(0, 6).map(f => <button type="button" class="chip" onClick={() => openFile(f)} title={t('cal.open_file', { name: f.name })} data-libf={l.id + '|' + f.id}><Icon name="file" size="xs" /><span data-raw>{f.name.replace(/\.[^.]+$/, '')}</span></button>)}
      {l.files.length > 6 && <span class="mute">{t('cal.n_more', { n: l.files.length - 6 })}</span>}</div>}</li>;
  return <>
    <div class="libtools"><TextInput label={t('plan.find_lesson')} icon="search" type="search" value={q} onInput={setQ} data-focus="find-lesson" />
      <Select label={t('plan.class')} value={cls} options={[{ value: '', label: t('plan.all_classes') }, ...classes.map(c => ({ value: c.id, label: c.name }))]} onChange={setCls} data-raw /><span class="grow" />{imp}</div>
    {rows.length ? <ul class="list">{rows.map(({ l, past }) => card(l, t('plan.taught_to', { day: day(past[0].date), classes: [...new Set(past.map(x => (classOf(p, x.classId) || {}).name).filter(Boolean))].join(', ') })))}</ul>
      : !packs.length && <EmptyState icon="slides" title={t('plan.no_past')} text={t('plan.no_past_text') + ' ' + t('cal.past_packs_text')} />}
    {packs.map(({ g, ls }) => <section class="libsec" data-pack={g}><h2 class="t4"><span data-raw>{g}</span> <span class="mute">{t('cal.n_lessons', { n: ls.length })}</span></h2>
      <ul class="list">{ls.map(l => card(l, (l.slots || []).length ? (l.slots || []).map(x => ((classOf(p, x.classId) || {}).name || '') + ' ' + day(x.date)).join(', ') : t('cal.from_pack')))}</ul></section>)}
  </>;
}
// A lesson's file from a pack: a PDF or picture opens in a new tab, anything else is saved (src/planner/library.js matOpen).
async function openFile(f) {
  const b = await plannerKv('file:' + f.id); if (!b) return toast(t('cal.file_missing'));
  const url = URL.createObjectURL(/pdf/.test(b.type || '') || /\.pdf$/i.test(f.name) ? new Blob([b], { type: 'application/pdf' }) : b);
  if (/pdf|^image\//.test(b.type || '') || /\.pdf$/i.test(f.name)) window.open(url, '_blank', 'noopener');
  else { const a = document.createElement('a'); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); }
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}

// ---------- Units ----------
function Units({ p, classes, sub }) {
  const E = engine(p), tt = (p.setup && p.setup.classes) || [], [edit, setEdit] = useState(null), [X, setX] = useState(null);
  const courses = [...new Set((p.units || []).filter(u => u && u.course).map(u => u.course))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const ttCourses = [...new Set(tt.map(c => c.course || c.name).filter(Boolean))];
  // A unit made or changed here, in the same sheet as on the Course line and the week (app/plan/unit-edit.jsx, through PARTS.calx).
  const open = u => PART.calx().then(m => { setX(m); setEdit(u); }, e => console.error(e));
  const newUnit = () => open(E.normUnit({ course: ttCourses[0] || '', start: mondayOf(p, today()), title: t('plan.new_unit'), weeks: Array.from({ length: 6 }, () => ({})) }));
  const add = ttCourses.length ? <Button icon="plus" onClick={newUnit} data-lib-newunit>{t('plan.new_unit')}</Button> : null;
  const sheet = edit && X && <X.UnitSheet p={p} unit={edit} courses={[...new Set([...ttCourses, ...courses])]} onClose={() => setEdit(null)} />;
  // A course's units open on the Course line of the first class that takes it; a unit of a course no class takes opens in the sheet.
  const lineFor = course => { for (const x of classes || []) { if (x.loose) continue; const c = tt.find(k => nameKey(k.name) === nameKey(x.name)); if (c && c.course === course) return { x, c }; } return null; };
  const toLine = (u, to) => { try { sessionStorage.setItem('gsn.class.unit:' + to.c.id, JSON.stringify(u.id)); } catch {} };
  // library/units/<unit id> (a unit from the command bar): its Course line, or the sheet
  // (only once the classes are read: before that no Course line can be found)
  const did = useRef('');
  useEffect(() => { const u = sub && (p.units || []).find(x => x.id === sub); if (!u || !classes || did.current === sub) return; did.current = sub; const to = lineFor(u.course); if (to) { toLine(u, to); location.replace(href('class', to.x.id || '-')); } else { open(u); history.replaceState(null, '', href('library', 'units')); } }, [sub, classes]);
  if (!courses.length) return <><EmptyState icon="cal" title={t('plan.no_units')} text={t('cal.units_text')} action={add} />{sheet}</>;
  return <>{add && <div class="row libtop"><span class="grow" />{add}</div>}{sheet}{courses.map(course => { const to = lineFor(course), us = p.units.filter(u => u.course === course && u.start).sort((a, b) => a.start.localeCompare(b.start));
    return <section class="libsec"><h2 class="t4" data-raw>{course}</h2>
      <ul class="list">{us.map(u => { const inner = <><span class="main"><b data-raw>{u.title}</b>
        <small>{t('plan.unit_dates', { from: day(u.start), to: day(E.unitEnd(u)), n: (u.weeks || []).length })}</small></span>{to && <span class="end"><Icon name="chr" /></span>}</>;
        return <li>{to ? <a class="lrow" href={href('class', to.x.id || '-')} onClick={() => toLine(u, to)} data-lib-unit={u.id}>{inner}</a>
          : <button type="button" class="lrow" onClick={() => open(u)} data-lib-unit={u.id}>{inner}</button>}</li>; })}</ul>
    </section>; })}</>;
}

// ---------- Rubrics ----------
// The bank, edited (app/plan/bank-edit.jsx), loaded with this tab.
function Rubrics({ p }) {
  const [B, setB] = useState(null);
  useEffect(() => { PART.bank().then(setB); }, []);
  return B ? <B.BankList p={p} /> : <div class="loading" aria-busy="true" />;
}
// Strong examples, the watch list and whose work: the grading side's part (class/examples.jsx), loaded when the tab opens.
function Examples({ view }) {
  const [E, setE] = useState(null);
  useEffect(() => { PART.examples().then(setE); }, []);
  return E ? <E.default view={view} /> : <div class="loading" aria-busy="true" />;
}

export default function Library({ route, classes }) {
  const p = usePlan();
  const tab = TABS.includes(route.params.tab) ? route.params.tab : 'activities';
  return <div class="page library">
    <header class="ph"><div><h1>{t('nav.library')}</h1><p class="mute">{t('plan.lib_about')}</p></div></header>
    <Tabs label={t('nav.library')} value={tab} onChange={v => go('library', v === 'activities' ? '' : v)} tabs={TABS.map(id => ({ id, label: t(TAB_LINE[id]) }))} />
    <div role="tabpanel" id={'panel-' + tab} aria-labelledby={'tab-' + tab} class="libpanel">
      {!p ? <div class="loading" aria-busy="true" />
        : tab === 'activities' ? <Activities p={p} /> : tab === 'past' ? <Past p={p} /> : tab === 'units' ? <Units p={p} classes={classes} sub={route.params.sub} /> : tab === 'examples' ? <Examples view={route.params.sub} /> : <Rubrics p={p} />}
    </div>
  </div>;
}
