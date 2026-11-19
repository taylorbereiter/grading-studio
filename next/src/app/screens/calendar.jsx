// Calendar: the week by class, the week by time, and the month, on one connected grid (stage 3 brief, item 2; design screenshots
// 8 to 10). Lessons are coloured chips in their class's one colour; an empty period says so and plans a lesson in one press; days
// off, events and the semester come from the timetable setup. A lesson drags to another of its class's periods. Work due and the
// teacher's own to-dos come from the grading side through crossings.js (names and days only).
import { h, Fragment } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { Segmented, IconButton, Button, Icon, Chip, Switch, EmptyState, Menu, toast } from '../../ui/index.js';
import { t, date, dateRange } from '../../i18n/t.js';
import { href, go, PARTS } from '../router.js';
import { usePart } from '../parts.js';
import { assistant } from '../../services/assistant.js';
import { usePlan } from '../plan.js';
import { toneOf } from '../colors.js';
import { workForCalendar } from '../../crossings.js';
import { startFocus } from '../focus/bus.js';
import { nameKey } from '../../planning/plan.js';
import { lessonsOn, stateOf, arrived, STATE_LINE, periods, dayOff, eventsOn, newLesson, moveLesson, mondayOf, weekDays, today, plus, at, iso, mins } from '../plan/lessons.js';

const VIEWS = ['class', 'time', 'month'];
const clock = s => { const m = /^(\d{1,2}):(\d\d)$/.exec(s || ''); return m ? date(new Date(2000, 0, 1, +m[1], +m[2]), { hour: 'numeric', minute: '2-digit' }) : ''; };
const raw = s => <span data-raw>{s}</span>;
const STATE_ICON = { taught: '', ready: 'check', draft: 'half', none: 'dash' };
const keep = (k, v) => { try { if (v === undefined) return JSON.parse(sessionStorage.getItem('gsn.cal.' + k)); sessionStorage.setItem('gsn.cal.' + k, JSON.stringify(v)); } catch {} return null; };

export { saveFailed } from '../plan/save.js';
import { saveFailed } from '../plan/save.js';
import { printWeek } from '../plan/print.js';
import '../plan/lines.js';

function State({ s }) {
  return <span class={'st st-' + s}>{STATE_ICON[s] && <Icon name={STATE_ICON[s]} size="xs" />}{t(STATE_LINE[s])}</span>;
}

// One lesson in a period: its title, the time, how far along it is. Opens the lesson; drags to another of its class's periods.
function LessonCard({ l, c, m, day, compact, onDrag }) {
  const s = stateOf(l, c.id, day);
  return <a class={'lc st-' + s + (compact ? ' compact' : '')} href={href('lesson', l.id)} style={{ '--cc': toneOf(c.color) }} draggable="true"
    onDragStart={e => { e.dataTransfer.setData('text/x-gs-lesson', JSON.stringify({ id: l.id, classId: c.id, date: day })); e.dataTransfer.effectAllowed = 'move'; onDrag && onDrag(c.id); }}
    onDragEnd={() => onDrag && onDrag(null)} data-lesson={l.id}>
    <b data-raw>{l.title || t('plan.untitled')}</b>
    <span class="lm"><span data-raw>{clock(m.start)}</span><State s={s} />{arrived(l) && <span class="st st-new" data-notreviewed><Icon name="assist" size="xs" />{t('plan.not_reviewed')}</span>}</span>
  </a>;
}
function PlanIt({ p, c, m, day, compact, busy, setBusy, onTool }) {
  const go2 = async ask => {
    if (busy) return; setBusy(true);
    try { const l = await newLesson(p, c.id, day); if (ask) { try { sessionStorage.setItem('gsn.ask', l.id); } catch { } } go('lesson', l.id); } catch (e) { saveFailed(e); } finally { setBusy(false); }
  };
  const ai = assistant().name || t('assistant.generic');
  // One press makes a blank lesson; the menu beside it starts one another way (the design's empty-slot choices).
  return <span class={'planit' + (compact ? ' compact' : '')}><button type="button" class={'lc open' + (compact ? ' compact' : '')} style={{ '--cc': toneOf(c.color) }} onClick={() => go2()} data-plan={c.id + '|' + day}>
    {compact ? <><b class="one" data-raw>{c.name}</b><span class="lm"><span><Icon name="plus" size="xs" />{t('plan.not_planned')}</span><span data-raw>{clock(m.start)}</span></span></>
      : <><b><Icon name="plus" size="xs" />{t('plan.plan_this')}</b><span class="lm" data-raw>{clock(m.start)}</span></>}
  </button>
    <Menu label={t('plan.slot_menu')} items={[{ id: 'blank', label: t('plan.slot_blank'), icon: 'plus', onSelect: () => go2() }, { id: 'have', label: t('plan.slot_have'), icon: 'slides', onSelect: () => onTool({ name: 'use', c, day }) },
      { id: 'lib', label: t('plan.slot_library'), icon: 'spark', onSelect: () => onTool({ name: 'lib', c, day }) }, { id: 'ask', label: t('plan.slot_assist', { name: ai }), icon: 'assist', onSelect: () => go2(true) },
      { id: 'import', label: t('plan.import_lesson'), icon: 'upload', onSelect: () => onTool({ name: 'import', c, day }) }]}
      trigger={q => <IconButton icon="dots" size="sm" label={t('plan.slot_menu')} {...q} data-slotmenu={c.id + '|' + day} />} /></span>;
}
function DueChip({ x, p }) {
  const c = ((p.setup && p.setup.classes) || []).find(k => nameKey(k.name) === nameKey(x.cls));
  return <span class="due" style={{ '--cc': c ? toneOf(c.color) : 'var(--g500)' }}><Icon name="flag" size="xs" /><span data-raw>{x.name}</span>{x.cls && <small data-raw>{x.cls}</small>}</span>;
}
function TodoChip({ x }) { return <span class={'todo' + (x.done ? ' done' : '')}><Icon name={x.done ? 'check' : 'todo'} size="xs" /><span data-raw>{x.text}</span></span>; }

// Where a dragged lesson may go: another period of the same class.
function useDrop(p, dragging) {
  return (c, day) => ({
    onDragOver: e => { if (dragging === c.id) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } },
    onDrop: async e => {
      e.preventDefault();
      let d; try { d = JSON.parse(e.dataTransfer.getData('text/x-gs-lesson')); } catch { return; }
      if (!d || d.classId !== c.id || d.date === day) return;
      const l = p.lessons.find(x => x.id === d.id); if (!l) return;
      try { const r = await moveLesson(l, { classId: d.classId, date: d.date }, { classId: c.id, date: day }); toast(r ? t('plan.moved', { day: date(at(day), { weekday: 'long', day: 'numeric', month: 'short' }) }) : t('plan.already_there')); } catch (err) { saveFailed(err); }
    },
  });
}

function ByClass({ p, days, shown, work, layers, dragging, setDragging, busy, setBusy, onTool }) {
  const drop = useDrop(p, dragging), now = today();
  const classes = p.setup.classes.filter(c => shown(c.id));
  return <div class="cal byclass" role="table" aria-label={t('plan.by_class')} style={{ '--days': days.length }}>
    <div class="cr hd" role="row"><span role="columnheader" />{days.map(d => <span role="columnheader" class={'dh' + (d === now ? ' now' : '') + (dayOff(p, d) ? ' off' : '')}><span data-raw>{date(at(d), { weekday: 'short' })}</span> <b class="num">{at(d).getDate()}</b></span>)}</div>
    {eventRow(p, days, layers, work)}
    {classes.map(c => <div class="cr" role="row">
      <span role="rowheader" class="rh"><span class="dot" style={{ '--cc': toneOf(c.color) }} /><b data-raw>{c.name}</b></span>
      {days.map(d => {
        const off = dayOff(p, d), ms = off ? [] : periods(p, d).filter(x => x.c.id === c.id);
        const dues = layers.work ? work.due.filter(x => x.day === d && nameKey(x.cls) === nameKey(c.name)) : [];
        return <span role="cell" class={'cc' + (d === now ? ' now' : '') + (off ? ' off' : '')} {...drop(c, d)}>
          {off && c === classes[0] ? <span class="offl" data-raw>{off.label || t('plan.day_off')}</span> : null}
          {layers.lessons && ms.map(x => { const ls = lessonsOn(p, c.id, d); return ls.length ? ls.map(l => <LessonCard l={l} c={c} m={x.m} day={d} onDrag={setDragging} />) : d >= now ? <PlanIt p={p} c={c} m={x.m} day={d} busy={busy} setBusy={setBusy} onTool={onTool} /> : null; })}
          {dues.map(x => <DueChip x={x} p={p} />)}
        </span>;
      })}
    </div>)}
  </div>;
}
// Events, days off and to-dos across the top of a week.
function eventRow(p, days, layers, work) {
  const any = days.some(d => eventsOn(p, d).length || (layers.todos && work.todos.some(x => x.day === d)));
  if (!any) return null;
  return <div class="cr ev" role="row"><span role="rowheader" class="rh mute">{t('plan.all_day')}</span>
    {days.map(d => <span role="cell" class="cc">{eventsOn(p, d).map(e => <span class="evc" data-raw>{e.label || e.title || ''}</span>)}{layers.todos && work.todos.filter(x => x.day === d).map(x => <TodoChip x={x} />)}</span>)}
  </div>;
}

function ByTime({ p, days, shown, work, layers, dragging, setDragging, busy, setBusy, onTool }) {
  const drop = useDrop(p, dragging), now = today();
  const all = days.flatMap(d => periods(p, d)).filter(x => shown(x.c.id));
  const from = Math.floor(Math.min(8 * 60, ...all.map(x => mins(x.m.start)).filter(v => v != null)) / 60) * 60;
  const to = Math.ceil(Math.max(15 * 60, ...all.map(x => mins(x.m.end) || mins(x.m.start) + 45).filter(v => v != null)) / 60) * 60;
  const px = 1.3, hours = []; for (let m = from; m <= to; m += 60) hours.push(m);
  const nowD = new Date(), nowM = nowD.getHours() * 60 + nowD.getMinutes();
  return <div class="cal bytime" style={{ '--days': days.length }}>
    <div class="cr hd"><span />{days.map(d => <span class={'dh' + (d === now ? ' now' : '') + (dayOff(p, d) ? ' off' : '')}><span data-raw>{date(at(d), { weekday: 'short' })}</span> <b class="num">{at(d).getDate()}</b></span>)}</div>
    {eventRow(p, days, layers, work) || null}
    {layers.work && work.due.some(x => days.includes(x.day)) && <div class="cr ev"><span class="rh mute">{t('plan.work_due')}</span>{days.map(d => <span class="cc">{work.due.filter(x => x.day === d).map(x => <DueChip x={x} p={p} />)}</span>)}</div>}
    <div class="tgrid" style={{ height: (to - from) * px + 'px' }}>
      <div class="hours">{hours.map(m => <span style={{ top: (m - from) * px + 'px' }} data-raw>{clock(String(Math.floor(m / 60)) + ':00')}</span>)}</div>
      {days.map(d => {
        const off = dayOff(p, d);
        return <div class={'tcol' + (d === now ? ' now' : '') + (off ? ' off' : '')}>
          {off && <span class="offl" data-raw>{off.label || t('plan.day_off')}</span>}
          {d === now && nowM >= from && nowM <= to && <i class="nowline" style={{ top: (nowM - from) * px + 'px' }} />}
          {!off && periods(p, d).filter(x => shown(x.c.id)).map(x => {
            const top = (mins(x.m.start) - from) * px, ht = Math.max(40, ((mins(x.m.end) || mins(x.m.start) + 45) - mins(x.m.start)) * px - 4), ls = lessonsOn(p, x.c.id, d);
            return <div class="tslot" style={{ top: top + 'px', height: ht + 'px' }} {...drop(x.c, d)}>
              {layers.lessons && (ls.length ? <LessonCard l={ls[0]} c={x.c} m={x.m} day={d} onDrag={setDragging} /> : d >= now ? <PlanIt p={p} c={x.c} m={x.m} day={d} busy={busy} setBusy={setBusy} onTool={onTool} compact /> : <span class="lc past" style={{ '--cc': toneOf(x.c.color) }}><b data-raw>{x.c.name}</b></span>)}
            </div>;
          })}
        </div>;
      })}
    </div>
  </div>;
}

function Month({ p, anchor, shown, work, layers, weekends, setView, setAnchor, busy, setBusy, onTool }) {
  const first = at(anchor.slice(0, 8) + '01'), now = today();
  const start = mondayOf(p, iso(first)), month = first.getMonth();
  const weeks = []; for (let w = start; at(w).getMonth() === month || at(w) < first || weeks.length === 0; w = plus(w, 7)) { weeks.push(w); if (weeks.length > 6) break; }
  const offs = weekends ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
  const units = (p.units || []).filter(u => u && u.start && unitsShown(u, p, shown)).filter(u => { const end = unitEndOf(p, u); return u.start <= plus(weeks[weeks.length - 1], 6) && end >= weeks[0]; });
  return <>
    {units.length > 0 && <section class="card units" aria-label={t('plan.units_month')}><h2 class="sub">{t('plan.units_month')}</h2>
      {units.map(u => { const end = unitEndOf(p, u), a = Math.max(0, (at(u.start) - at(weeks[0])) / 864e5), b = Math.min(weeks.length * 7, (at(end) - at(weeks[0])) / 864e5 + 1), span = weeks.length * 7;
        return <div class="ub"><span class="un" data-raw>{u.course}</span><span class="ut"><span class="ubar" style={{ left: (a / span * 100) + '%', width: ((b - a) / span * 100) + '%', '--cc': courseTone(p, u.course) }}><b data-raw>{u.title}</b> <small data-raw>{date(at(u.start), { day: 'numeric', month: 'short' })} – {date(at(end), { day: 'numeric', month: 'short' })}</small></span></span></div>; })}
    </section>}
    <div class="cal month" role="grid" aria-labelledby="cal-title" style={{ '--days': offs.length }}>
      <div class="cr hd" role="row">{offs.map(i => <span role="columnheader" class="dh" data-raw>{date(at(plus(start, i)), { weekday: 'short' })}</span>)}</div>
      {weeks.map(w => <div class="cr" role="row">{offs.map(i => {
        const d = plus(w, i), off = dayOff(p, d), ms = off ? [] : periods(p, d).filter(x => shown(x.c.id)), out = at(d).getMonth() !== month;
        const items = [];
        for (const e of eventsOn(p, d)) items.push(<span class="evc" data-raw>{e.label || e.title || ''}</span>);
        if (off) items.push(<span class="evc off" data-raw>{off.label || t('plan.day_off')}</span>);
        const empty = [];
        if (layers.lessons) for (const x of ms) { const ls = lessonsOn(p, x.c.id, d); if (ls.length) ls.forEach(l => items.push(<LessonCard l={l} c={x.c} m={x.m} day={d} compact />)); else if (d >= now) empty.push(x); }
        if (empty.length === 1) items.push(<PlanIt p={p} c={empty[0].c} m={empty[0].m} day={d} compact busy={busy} setBusy={setBusy} onTool={onTool} />);
        else if (empty.length > 1) items.push(<button type="button" class="lc open compact" onClick={() => { setAnchor(d); setView('class'); }}><b>{t('plan.n_not_planned', { n: empty.length })}</b><span class="lm" data-raw>{clock(empty[0].m.start)}</span></button>);
        if (layers.work) for (const x of work.due.filter(x => x.day === d)) items.push(<DueChip x={x} p={p} />);
        if (layers.todos) for (const x of work.todos.filter(x => x.day === d)) items.push(<TodoChip x={x} />);
        const more = items.length > 4 ? items.length - 3 : 0;
        return <div role="gridcell" class={'md' + (d === now ? ' now' : '') + (out ? ' out' : '')} onDblClick={() => { setAnchor(d); setView('class'); }}>
          <span class="mdn num">{at(d).getDate()}</span>
          {(more ? items.slice(0, 3) : items)}
          {more > 0 && <button type="button" class="link more" onClick={() => { setAnchor(d); setView('class'); }}>{t('plan.n_more', { n: more })}</button>}
        </div>;
      })}</div>)}
    </div>
  </>;
}
const unitEndOf = (p, u) => { const n = Array.isArray(u.weeks) && u.weeks.length ? u.weeks.length : 1; return plus(u.start, n * 7 - 3); };
const courseTone = (p, course) => { const c = ((p.setup && p.setup.classes) || []).find(x => (x.course || x.name) === course); return c ? toneOf(c.color) : 'var(--g500)'; };
const unitsShown = (u, p, shown) => { const cs = ((p.setup && p.setup.classes) || []).filter(c => (c.course || c.name) === u.course); return !cs.length || cs.some(c => shown(c.id)); };

export default function Calendar({ route }) {
  const p = usePlan();
  const view = VIEWS.includes(route.params.view) ? route.params.view : (keep('view') && VIEWS.includes(keep('view')) ? keep('view') : 'class');
  const [anchor, setAnchor] = useState(() => keep('at') || today());
  const [hidden, setHidden] = useState(() => keep('hide') || []);
  const [layers, setLayers] = useState(() => ({ lessons: true, work: true, todos: true, ...(keep('layers') || {}) }));
  const [weekends, setWeekends] = useState(() => !!keep('weekends'));
  const [dragging, setDragging] = useState(null), [busy, setBusy] = useState(false), [tool, setTool] = useState(null);
  const Cal = usePart('cal', !!tool), Tools = usePart('tools', !!tool && tool.name === 'import');
  const work = useMemo(() => { try { return workForCalendar(); } catch (e) { console.error(e); return { due: [], todos: [] }; } }, [p]);
  useEffect(() => { keep('at', anchor); }, [anchor]);
  // plan/<class>/<day> (the old planner.html#plan/<class>/<day>, from Home and the focus timer): that meeting's lesson, opened or
  // made, with a focus session on it (src/planner/rail.js).
  const { cls, day } = route.params;
  useEffect(() => {
    if (!p || !cls || !day) return;
    const l = lessonsOn(p, cls, day)[0];
    (l ? Promise.resolve(l) : newLesson(p, cls, day)).then(x => { startFocus('les:' + x.id); location.replace(href('lesson', x.id)); }, saveFailed);
  }, [!!p, cls, day]);
  const setView = v => { keep('view', v); go('calendar', v); };
  if (!p) return <div class="page"><header class="ph"><h1>{t('nav.calendar')}</h1></header><div class="loading" aria-busy="true" /></div>;
  if (!p.setup || !(p.setup.classes || []).length) return <div class="page"><header class="ph"><h1>{t('nav.calendar')}</h1></header>
    <EmptyState icon="cal" title={t('home.no_timetable')} text={t('plan.no_timetable_text')} action={<a class="btn pri" href={href('settings', 'timetable')}>{t('plan.set_up_timetable')}</a>} /></div>;
  const mon = mondayOf(p, anchor), days = weekDays(p, mon), step = view === 'month' ? null : 7;
  const move = n => { if (step) setAnchor(plus(anchor, n * 7)); else { const d = at(anchor); d.setDate(1); d.setMonth(d.getMonth() + n); setAnchor(iso(d)); } };
  const shown = id => !hidden.includes(String(id));
  const flip = id => { const n = shown(id) ? [...hidden, String(id)] : hidden.filter(x => x !== String(id)); setHidden(n); keep('hide', n); };
  const layer = k => { const n = { ...layers, [k]: !layers[k] }; setLayers(n); keep('layers', n); };
  const title = view === 'month' ? date(at(anchor), { month: 'long', year: 'numeric' })
    : dateRange(at(days[0]), at(days[days.length - 1]), { day: 'numeric', month: 'long' });
  const thisWeek = days.includes(today());
  const counted = days.flatMap(d => periods(p, d).filter(x => shown(x.c.id)).map(x => ({ x, d, l: lessonsOn(p, x.c.id, d)[0] })));
  const done = counted.filter(r => r.l && stateOf(r.l, r.x.c.id, r.d) !== 'draft').length;
  const props = { p, days, shown, work, layers, dragging, setDragging, busy, setBusy, onTool: setTool };
  const close = () => setTool(null), ai = assistant().name || t('assistant.generic');
  return <div class="page calendar" data-view={view}>
    <header class="ph calh">
      <div><h1 id="cal-title" data-raw>{title}</h1><p class="mute">{t(view === 'month' ? 'plan.month_help' : view === 'time' ? 'plan.time_help' : 'plan.class_help')}</p></div>
      <div class="calnav">
        <Segmented label={t('plan.view')} value={view} onChange={setView} options={[{ value: 'class', label: t('plan.by_class') }, { value: 'time', label: t('plan.by_time') }, { value: 'month', label: t('plan.month') }]} />
        <span class="pn"><IconButton icon="chl" label={t(view === 'month' ? 'plan.prev_month' : 'plan.prev_week')} onClick={() => move(-1)} data-focus="cal-prev" />
          <Button onClick={() => setAnchor(today())} data-focus="cal-today">{t('plan.today')}</Button>
          <IconButton icon="chr" label={t(view === 'month' ? 'plan.next_month' : 'plan.next_week')} onClick={() => move(1)} data-focus="cal-next" /></span>
      </div>
    </header>
    <div class="filters" role="group" aria-label={t('plan.show')}>
      {p.setup.classes.map(c => <Chip on={shown(c.id)} color={toneOf(c.color)} onClick={() => flip(c.id)}><span data-raw>{c.name}</span></Chip>)}
      <span class="sep" />
      <Chip on={layers.lessons} icon="slides" onClick={() => layer('lessons')}>{t('plan.lessons')}</Chip>
      <Chip on={layers.work} icon="asg" onClick={() => layer('work')}>{t('plan.work_due')}</Chip>
      <Chip on={layers.todos} icon="todo" onClick={() => layer('todos')}>{t('plan.todos')}</Chip>
      {view === 'month' && <span class="wk"><Switch label={t('plan.weekends')} checked={weekends} onChange={v => { setWeekends(v); keep('weekends', v); }} /></span>}
    </div>
    {view === 'class' && <ByClass {...props} />}
    {view === 'time' && <ByTime {...props} />}
    {view === 'month' && <Month {...props} anchor={anchor} weekends={weekends} setView={setView} setAnchor={setAnchor} />}
    {view !== 'month' && <div class="legend"><State s="ready" /><State s="draft" /><State s="none" /><span class="due plain"><Icon name="flag" size="xs" />{t('plan.due_legend')}</span>
      <span class="grow" /><span class="mute">{thisWeek || counted.length ? t('plan.n_of_ready', { n: done, of: counted.length }) : ''}</span>
      <Button size="sm" variant="quiet" icon="file" onClick={() => printWeek(p, mondayOf(p, anchor))} data-focus="print-week">{t('plan.print_week')}</Button>
      <Menu label={t('plan.week_menu')} items={[{ id: 'week', label: t('plan.week_with', { name: ai }), icon: 'assist', onSelect: () => setTool({ name: 'week' }) },
        { id: 'download', label: t('plan.download_week'), icon: 'download', onSelect: () => PARTS.tools().then(m => m.downloadWeek(p, mondayOf(p, anchor))).catch(e => console.error(e)) }]}
        trigger={q => <IconButton icon="dots" size="sm" label={t('plan.week_menu')} {...q} data-focus="week-menu" />} /></div>}
    {tool && tool.name === 'use' && Cal && <Cal.UseLesson p={p} c={tool.c} d={tool.day} onClose={close} />}
    {tool && tool.name === 'lib' && Cal && <Cal.FromLibrary p={p} c={tool.c} d={tool.day} onClose={close} />}
    {tool && tool.name === 'week' && Cal && <Cal.WeekAssist p={p} mon={mondayOf(p, anchor)} onClose={close} />}
    {tool && tool.name === 'import' && Tools && <Tools.ImportSheet p={p} slot={{ classId: tool.c.id, date: tool.day }} onClose={close} />}
  </div>;
}
