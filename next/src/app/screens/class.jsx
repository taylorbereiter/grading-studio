// A class's page (design screenshot 5). Stage 3 builds its Course line: the units of the class's course in order with today marked,
// and the unit now under way week by week, each lesson on its day with how far along it is, past weeks folded. Beside it, the
// planning pace (this week's lessons ready, next week's empty periods) and the sections that share its lessons. People and Grades
// are parts of their own (app/class/), loaded with the gradebook's engine when opened; To do keeps the "not built yet" state until
// its part comes. #/class/new is a new class: its name and roster.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Tabs, Icon, EmptyState, Progress, Button, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { href, go, PARTS } from '../router.js';
import { usePlan } from '../plan.js';
import { toneOf, classTone } from '../colors.js';
import { timetableClass } from '../../planning/plan.js';
import { engine } from '../../planning/engine.js';
import { lessonsOn, stateOf, arrived, STATE_LINE, periods, dayOff, today, plus, at, mondayOf, weekDays, newLesson } from '../plan/lessons.js';
import { saveFailed } from '../plan/save.js';
import Later from './later.jsx';
import { UnitSheet } from '../plan/unit-edit.jsx';
import { usePart } from '../parts.js';
import '../plan/lines.js';

const TABS = ['course', 'work', 'people', 'grades', 'todo'];
const keep = (k, v) => { try { if (v === undefined) return JSON.parse(sessionStorage.getItem('gsn.class.' + k)); sessionStorage.setItem('gsn.class.' + k, JSON.stringify(v)); } catch {} return null; };

// The class's periods from one Monday for n weeks: [{ day, m, lesson }].
function weekRows(p, c, mon) {
  const out = [];
  for (const d of weekDays(p, mon)) { if (dayOff(p, d)) continue; for (const x of periods(p, d)) if (x.c.id === c.id) out.push({ day: d, m: x.m, lessons: lessonsOn(p, c.id, d) }); }
  return out;
}
function Pace({ p, c }) {
  const mon = mondayOf(p, today()), next = plus(mon, 7);
  const now = weekRows(p, c, mon), nx = weekRows(p, c, next);
  const ready = now.filter(r => r.lessons.some(l => stateOf(l, c.id, r.day) !== 'draft')).length, empty = nx.filter(r => !r.lessons.length).length;
  return <section class="side-sec" aria-labelledby="h-pace"><h2 id="h-pace" class="sub">{t('plan.pace')}</h2>
    <p>{t('plan.pace_text', { n: ready, of: now.length })} {nx.length ? t('plan.pace_next', { n: empty }) : ''}</p>
    <div class="pacebar" aria-hidden="true">{now.map(r => <i class={'s-' + (r.lessons[0] ? stateOf(r.lessons[0], c.id, r.day) : 'none')} />)}<b />{nx.map(r => <i class={'s-' + (r.lessons[0] ? stateOf(r.lessons[0], c.id, r.day) : 'none')} />)}</div>
  </section>;
}

function CourseLine({ p, c, lib }) {
  const E = engine(p), course = c.course || c.name, now = today(), mon = mondayOf(p, now);
  const units = (p.units || []).filter(u => u && u.course === course && u.start && Array.isArray(u.weeks)).sort((a, b) => a.start.localeCompare(b.start));
  const here = E.unitAt(course, mon);
  const [pick, setPick] = useState(() => keep('unit:' + c.id));
  const u = units.find(x => x.id === pick) || (here && here.u) || units.find(x => x.start > now) || units[units.length - 1] || null;
  const [fold, setFold] = useState(() => keep('fold') !== false);
  const [busy, setBusy] = useState(false), [editing, setEditing] = useState(null);
  const Unit = usePart('unit', !!u);
  const courses = [...new Set((p.setup.classes || []).map(x => x.course || x.name).filter(Boolean))];
  const newUnit = () => setEditing(E.normUnit({ course, start: plus(units.length ? E.unitEnd(units[units.length - 1]) : mon, 7), title: t('plan.new_unit'), weeks: Array.from({ length: 6 }, () => ({})) }));
  // A unit from its unit plan's screenshots (src/planner/units.js: new unit, screenshots, the assistant fills the weeks): made at once,
  // then the screenshots are added and the assistant asked from beside its weeks.
  const fromShots = async () => {
    if (busy) return; setBusy(true);
    try { const n = E.normUnit({ course, start: plus(units.length ? E.unitEnd(units[units.length - 1]) : mon, 7), title: t('plan.new_unit'), weeks: Array.from({ length: 6 }, () => ({})) });
      const M = await PARTS.unit(); await M.saveUnit(p, n); setPick(n.id); keep('unit:' + c.id, n.id); toast(t('plan.unit_made_shots')); }
    catch (e) { saveFailed(e); } finally { setBusy(false); }
  };
  const partners = (p.setup.classes || []).filter(x => x.id !== c.id && (x.course || x.name) === course && x.course);
  // Lessons kept without a class or day (src/planner Not scheduled): newest first.
  const loose = (p.lessons || []).filter(l => !(l.slots || []).length).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  // The weeks to show: the unit's, or without units the four weeks around today.
  const weeks = u ? u.weeks.map((w, i) => ({ mon: plus(u.start, i * 7), focus: w && w.focus, n: i + 1 })) : [-1, 0, 1, 2].map(i => ({ mon: plus(mon, i * 7), focus: '', n: 0 }));
  const plan = async day => { if (busy) return; setBusy(true); try { const l = await newLesson(p, c.id, day); go('lesson', l.id); } catch (e) { saveFailed(e); } finally { setBusy(false); } };
  return <div class="courseline">
    {units.length > 0 && <nav class="ustrip" aria-label={t('plan.units')}>
      {units.map((x, i) => { const end = plus(E.unitEnd(x), 4), on = x === u, past = end < now, cur = x.start <= now && now <= end;
        return <button type="button" class={'us' + (on ? ' on' : '') + (past ? ' past' : '') + (cur ? ' cur' : '')} style={{ '--cc': toneOf(c.color) }} aria-pressed={String(on)} onClick={() => { setPick(x.id); keep('unit:' + c.id, x.id); }}>
          <span class="bar">{cur && <i style={{ left: Math.round((at(now) - at(x.start)) / (at(end) - at(x.start) + 864e5) * 100) + '%' }} title={t('plan.today')} />}</span>
          <small>{past && <Icon name="check" size="xs" />}{t('plan.unit_n', { n: i + 1 })}</small><b data-raw>{x.title}</b></button>; })}
      <a class="link calk" href={href('calendar', 'class')}><Icon name="cal" size="sm" />{t('nav.calendar')}</a>
    </nav>}
    <div class="clgrid">
      <section class="cl-main" aria-labelledby="h-unit">
        <div class="hrow"><h2 id="h-unit" class="t4">{u ? <span data-raw>{u.title}</span> : t('plan.these_weeks')}</h2>
          {u && here && here.u === u && <span class="mute">{t('plan.unit_week', { n: here.n + 1, of: u.weeks.length })}</span>}
          <span class="grow" /><button type="button" class="link" onClick={() => { setFold(!fold); keep('fold', !fold); }}>{t(fold ? 'plan.show_past' : 'plan.fold_past')}</button>
          {u && <Button size="sm" icon="pen" onClick={() => setEditing(u)} data-focus="edit-unit">{t('plan.edit_unit')}</Button>}
          <Button size="sm" icon="plus" onClick={newUnit} data-focus="new-unit">{t('plan.new_unit')}</Button>
          <Button size="sm" icon="image" onClick={fromShots} data-focus="unit-from-shots">{t('plan.unit_from_shots')}</Button></div>
        <ol class="weeks">{weeks.map(w => {
          const rows = weekRows(p, c, w.mon), past = plus(w.mon, 6) < now, cur = w.mon === mon;
          const taught = rows.filter(r => r.lessons.some(l => stateOf(l, c.id, r.day) === 'taught')).length, ready = rows.filter(r => r.lessons.some(l => stateOf(l, c.id, r.day) === 'ready')).length;
          const folded = fold && past;
          return <li class={'wk' + (cur ? ' cur' : '') + (past ? ' past' : '')}>
            <div class="wkh"><span class="wd mute" data-raw>{date(at(w.mon), { day: 'numeric', month: 'short' })}</span>
              <span><b>{w.n ? t('plan.week_n', { n: w.n }) : t('plan.week_of', { day: date(at(w.mon), { day: 'numeric', month: 'short' }) })}</b> {w.focus && <span data-raw>{w.focus}</span>}{cur && <span class="tag">{t('plan.this_week')}</span>}
                <small class="mute">{past ? t('plan.week_taught', { n: taught, of: rows.length }) : t('plan.week_ready', { n: ready, of: rows.length })}</small></span></div>
            {!folded && <ul class="days">{rows.map(r => <li class={'dr' + (r.day === now ? ' today' : '')}>
              <span class="dd mute" data-raw>{date(at(r.day), { weekday: 'short', day: 'numeric' })}</span>
              {r.lessons.length ? r.lessons.map(l => { const s = stateOf(l, c.id, r.day); return <a class={'dl st-' + s} href={href('lesson', l.id)} style={{ '--cc': toneOf(c.color) }}><i class="pip" /><span data-raw>{l.title || t('plan.untitled')}</span><span class={'st st-' + s}>{t(STATE_LINE[s])}</span>{arrived(l) && <span class="st st-new" data-notreviewed>{t('plan.not_reviewed')}</span>}</a>; })
                : r.day >= now ? <button type="button" class="dl open" onClick={() => plan(r.day)} data-plan={c.id + '|' + r.day}><i class="pip" /><span>{t('plan.plan_this')}</span></button>
                : <span class="dl none"><i class="pip" /><span class="mute">{t('plan.nothing_planned')}</span></span>}
            </li>)}{!rows.length && <li class="dr mute">{t('plan.no_periods')}</li>}</ul>}
          </li>;
        })}</ol>
      </section>
      <aside class="cl-side">
        <Pace p={p} c={c} />
        {u && Unit && <Unit.UnitSide key={u.id} p={p} u={u} />}
        {loose.length > 0 && <section class="side-sec" aria-labelledby="h-loose"><h2 id="h-loose" class="sub">{t('plan.not_on_calendar')}</h2>
          <ul class="loose">{loose.slice(0, 8).map(l => <li><a class="link" href={href('lesson', l.id)} data-raw>{l.title || t('plan.untitled')}</a></li>)}</ul>
          {loose.length > 8 && <a class="link" href={href('library', 'past')}>{t('plan.n_more', { n: loose.length - 8 })}</a>}</section>}
        {partners.length > 0 && <section class="side-sec" aria-labelledby="h-share"><h2 id="h-share" class="sub">{t('plan.shares_with')}</h2>
          {partners.map(x => <p class="share"><span class="dot" style={{ '--cc': toneOf(x.color) }} /><b data-raw>{x.name}</b> {lib.find(k => k.name === x.name) && <a class="link" href={href('class', lib.find(k => k.name === x.name).id)}>{t('plan.open_course_line')}</a>}</p>)}
        </section>}
      </aside>
    </div>
    {editing && <UnitSheet p={p} unit={editing} courses={courses} onClose={ok => { if (ok && editing && !(p.units || []).some(x => x.id === editing.id)) { setPick(editing.id); keep('unit:' + c.id, editing.id); } setEditing(null); }} />}
  </div>;
}

export default function ClassPage({ route, classes }) {
  const p = usePlan();
  const lib = (classes || []).filter(x => !x.loose);
  const x = (classes || []).find(k => (k.id || '-') === route.params.id);
  const tab = TABS.includes(route.params.tab) ? route.params.tab : 'course';
  const [pk, setPk] = useState(false), Pk = usePart('picker', pk), Cl = usePart('clink', !!x && !x.loose);
  const Work = usePart('work', tab === 'work'), People = usePart('people', tab === 'people' || route.params.id === 'new'), Grades = usePart('grades', tab === 'grades'), Todo = usePart('ctodo', tab === 'todo');
  if (route.params.id === 'new') return <div class="page classpage"><header class="ph"><h1>{t('nav.add_class')}</h1></header>
    {People ? <People.RosterDialog c={null} onClose={id => (id ? go('class', id, 'people') : history.length > 1 ? history.back() : go('home'))} /> : <div class="loading" aria-busy="true" />}</div>;
  if (!x) return <Later route={route} classes={classes} />;
  const c = p && timetableClass(p, x.name);
  const days = c ? [...new Set((c.meets || []).map(m => +m.dow))].sort().map(d => date(new Date(2024, 0, 7 + d), { weekday: 'short' })) : [];
  const partners = c && p ? (p.setup.classes || []).filter(k => k.id !== c.id && c.course && k.course === c.course) : [];
  return <div class="page classpage">
    <header class="ph clh"><div>
      <h1><span class="dot big" style={{ '--cc': classTone(p, x.name, x.loose ? -1 : lib.indexOf(x)) }} />{x.loose ? t('nav.no_class') : <span data-raw>{x.name}</span>}</h1>
      <p class="mute meta">{x.students > 0 && <span>{t('home.students', { n: x.students })}</span>}{days.length > 0 && <span data-raw>{days.join(', ')}</span>}
        {partners.length > 0 && <span><Icon name="link" size="xs" />{t('plan.shares_lessons', { names: partners.map(k => k.name).join(', ') })}</span>}</p></div>
      <div class="row gap">{Cl && <Cl.ClassLink classId={x.id} />}
      {!x.loose && x.students > 0 && <Button size="sm" icon="shuffle" onClick={() => setPk(true)} data-pick-name>{t('plan.pr_pick')}</Button>}</div></header>
    {pk && Pk && <Pk.PickerFor classId={x.id} onClose={() => setPk(false)} />}
    <Tabs label={t('plan.class_tabs')} value={tab} onChange={v => go('class', route.params.id, v === 'course' ? '' : v)}
      tabs={[{ id: 'course', label: t('plan.course_line') }, { id: 'work', label: t('plan.assignments') }, { id: 'people', label: t('plan.people'), count: x.students || null }, { id: 'grades', label: t('plan.grades') }, { id: 'todo', label: t('nav.todo') }]} />
    {tab === 'work' ? (Work ? <Work.default classId={route.params.id} /> : <div class="loading" aria-busy="true" />)
      : tab === 'people' && !x.loose ? (People ? <People.default classId={route.params.id} sub={route.params.sub} /> : <div class="loading" aria-busy="true" />)
      : tab === 'grades' && !x.loose ? (Grades ? <Grades.default classId={route.params.id} /> : <div class="loading" aria-busy="true" />)
      : tab === 'todo' && !x.loose ? (Todo ? <Todo.default classId={route.params.id} /> : <div class="loading" aria-busy="true" />)
      : tab !== 'course' ? <Later route={{ ...route, path: 'class', known: true }} classes={classes} embedded />
      : !p ? <div class="loading" aria-busy="true" />
      : !c ? <EmptyState icon="cal" title={t('plan.not_on_timetable')} text={t('plan.not_on_timetable_text')} action={<a class="btn" href={href('settings', 'timetable')}>{t('plan.set_up_timetable')}</a>} />
      : <CourseLine p={p} c={c} lib={lib} />}
  </div>;
}
