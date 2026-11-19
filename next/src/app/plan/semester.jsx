// The Semester view and planning ahead (src/planner/units.js renderSemester, src/planner/plannext.js planNextBar). The semester:
// every week down, each course across, with the unit that week is in, its week and focus, and how many of the week's classes have
// a lesson; a week opens in the week view. Above it, the classes in the next two weeks with no lesson yet (Plan it, a focus
// session on a new lesson, or a lesson she has), next week's lessons planned, and her planning pace. Reads the plan; stores
// nothing itself (Plan it makes a lesson through planning/write.js, like an empty period does).
import { h, Fragment } from 'preact';
import { Button, Icon, Menu, IconButton } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { go } from '../router.js';
import { toneOf } from '../colors.js';
import { planTime } from '../../planning/index.js';
import { engine } from '../../planning/engine.js';
import { saveFailed } from './save.js';
import './cal-lines.js';
import './lines.js';
import { lessonsOn, periods, dayOff, eventsOn, newLesson, mondayOf, weekDays, today, plus, at, mins } from './lessons.js';

const UNIT_COLORS = ['#1F6FB2', '#7B3FC4', '#B71E42', '#0E7C66', '#B35C00', '#3D5A80', '#8E3B8A', '#2F6B2F'];
const raw = s => <span data-raw>{s}</span>;
const md = s => date(at(s), { day: 'numeric', month: 'short' });
const clock = s => { const m = /^(\d{1,2}):(\d\d)$/.exec(s || ''); return m ? date(new Date(2000, 0, 1, +m[1], +m[2]), { hour: 'numeric', minute: '2-digit' }) : ''; };

// The courses, in the timetable's order, and any course only a unit names.
export function courses(p) {
  const out = [];
  for (const c of (p.setup && p.setup.classes) || []) { const k = c.course || c.name; let o = out.find(x => x.course === k); if (!o) out.push(o = { course: k, classes: [], color: c.color }); o.classes.push(c); }
  for (const u of p.units || []) if (u && u.course && !out.some(x => x.course === u.course)) out.push({ course: u.course, classes: [], color: '' });
  return out;
}
const unitEnd = u => plus(u.start, 7 * ((u.weeks || []).length - 1));
// The semester's Mondays: from the setup's first day to its last, or else from the units (as the current Planner works it out).
export function semesterMondays(p, now = today()) {
  const s = p.setup || {}, mon = d => mondayOf(p, d), thisMon = mon(now), us = (p.units || []).filter(u => u && u.start);
  let a = s.semStart || '', b = s.semEnd || '';
  if (!a) { const st = us.map(u => u.start).sort(); a = st[0] || plus(thisMon, -28); }
  if (!b) { const en = us.map(unitEnd).sort(); b = plus(thisMon, 7 * 12); if (en.length && en[en.length - 1] > b) b = en[en.length - 1]; }
  if (b < a) b = plus(a, 7 * 18);
  const out = []; for (let d = mon(a); d <= b && out.length < 60; d = plus(d, 7)) out.push(d);
  return out;
}
const schoolWeek = (p, m) => { const s = p.setup && p.setup.semStart; if (!s) return 0; const n = Math.round((at(m) - at(s)) / 864e5 / 7) + 1; return n >= 1 ? n : 0; };
const unitColor = (p, u) => u.color || UNIT_COLORS[Math.max(0, (p.units || []).filter(x => x.course === u.course).sort((a, b) => a.start.localeCompare(b.start)).indexOf(u)) % UNIT_COLORS.length];
const meetings = (p, course, m) => { const ids = new Set(course.classes.map(c => String(c.id))); return weekDays(p, m).flatMap(d => periods(p, d).filter(x => ids.has(String(x.c.id))).map(x => ({ ...x, d }))); };

// Each meeting from now to two weeks ahead with no lesson, soonest first; one already over today is left out.
export function gaps(p, now = new Date()) {
  const out = [], d0 = today(), hm = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < 14; i++) {
    const d = plus(d0, i); if (dayOff(p, d)) continue;
    for (const x of periods(p, d)) { if (d === d0 && x.m && x.m.end && mins(x.m.end) <= hm) continue; if (!lessonsOn(p, x.c.id, d).length) out.push({ c: x.c, m: x.m, d }); }
  }
  return out;
}
// Next week, inside the semester: each meeting, whether it has a lesson, and whether that lesson is ready or finished.
export function nextWeek(p) {
  const s = p.setup || {}, mon = plus(mondayOf(p, today()), 7), out = { of: 0, planned: 0, ready: 0, dots: [] };
  if (s.semEnd && mon > mondayOf(p, s.semEnd)) return out;
  for (let i = 0; i < 7; i++) {
    const d = plus(mon, i); if (s.semStart && d < s.semStart) continue;
    for (const x of periods(p, d)) { const ls = lessonsOn(p, x.c.id, d), ok = ls.some(l => l.ready || l.final); out.of++; if (ls.length) out.planned++; if (ok) out.ready++; out.dots.push(ok ? 2 : ls.length ? 1 : 0); }
  }
  return out;
}
// Her planning pace: the middle of the planning times of the last ten lessons she said were ready (a minute or more each), once
// there are three (src/planner/plantime.js ptPace, from gsp.planTime).
export function pace(p) {
  const P = planTime.json(null) || {}, days = Object.values((P && P.days) || {});
  const tot = id => days.reduce((s, d) => s + (d && d.a && +d.a[id] || 0), 0);
  const xs = (p.lessons || []).filter(l => l.ready && l.ready.at).sort((a, b) => b.ready.at - a.ready.at).map(l => tot(l.id)).filter(s => s >= 60).slice(0, 10);
  if (xs.length < 3) return null;
  const o = xs.slice().sort((a, b) => a - b), k = o.length >> 1;
  return { s: o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2, n: xs.length };
}
const paceTime = s => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? t('cal.mins', { n: m }) : m % 60 ? t('cal.hr_min', { h: Math.floor(m / 60), m: m % 60 }) : t('cal.hrs', { n: m / 60 }); };

export function NextWeekLine({ p }) {
  const w = nextWeek(p); if (!w.of) return null;
  return <span class={'nwk' + (w.planned >= w.of ? ' all' : '')} data-nextweek={w.planned + '/' + w.of}>{w.planned >= w.of && <Icon name="check" size="xs" />}
    {t(w.ready ? 'cal.next_week_ready' : 'cal.next_week', { n: w.planned, of: w.of, r: w.ready })}
    {w.of <= 30 && <span class="dots" aria-hidden="true">{w.dots.map(d => <i class={d === 2 ? 'on' : d === 1 ? 'pl' : ''} />)}</span>}</span>;
}

function Ahead({ p, onTool }) {
  const gs = gaps(p), pc = pace(p), d0 = today(), when = d => d === d0 ? t('plan.today') : d === plus(d0, 1) ? t('cal.tomorrow') : date(at(d), { weekday: 'short', day: 'numeric', month: 'short' });
  const plan = async (c, d) => { try { const l = await newLesson(p, c.id, d); go('lesson', l.id); } catch (e) { saveFailed(e); } };
  return <section class="card ahead" aria-labelledby="h-ahead">
    <div class="ahh"><h2 id="h-ahead">{t('cal.ahead')}</h2><span class="mute">{gs.length ? t('cal.ahead_n', { n: gs.length }) : t('cal.ahead_none')}</span>
      {pc && <span class="pace" title={t('cal.pace_title')} data-pace={Math.round(pc.s)}>{t('cal.pace', { time: paceTime(pc.s), n: pc.n })}</span>}</div>
    <NextWeekLine p={p} />
    {gs.length > 0 && <ul class="gaps">{gs.slice(0, 4).map(g => <li style={{ '--cc': toneOf(g.c.color) }} data-gap={g.c.id + '|' + g.d}><span class="dot" />
      <b>{raw(g.c.name)}</b><span class="mute">{raw(when(g.d))} · {raw(clock(g.m.start))}{g.m.end ? <>–{raw(clock(g.m.end))}</> : null}{g.m.label ? <> · {raw(g.m.label)}</> : null}</span><span class="grow" />
      <Button size="sm" onClick={() => plan(g.c, g.d)} data-gap-plan>{t('cal.plan_it')}</Button>
      <Menu label={t('cal.gap_more', { name: g.c.name })} items={[{ id: 'focus', label: t('plan.focus_lesson'), icon: 'timer', onSelect: () => go('plan', g.c.id, g.d) },
        { id: 'use', label: t('plan.slot_have'), icon: 'slides', onSelect: () => onTool({ name: 'use', c: g.c, day: g.d }) }]}
        trigger={q => <IconButton icon="dots" size="sm" label={t('cal.gap_more', { name: g.c.name })} {...q} data-gap-menu />} /></li>)}</ul>}
    {gs.length > 4 && <p class="mute">{t('cal.ahead_more', { n: gs.length - 4 })}</p>}
  </section>;
}

export function Semester({ p, onOpen, onTool }) {
  const cs = courses(p), weeks = semesterMondays(p), now = mondayOf(p, today()), E = engine(p);
  const range = m => { const ds = weekDays(p, m); return md(ds[0]) + '–' + md(ds[ds.length - 1]); };
  return <>
    <Ahead p={p} onTool={onTool} />
    <div class="semh"><span class="grow" />
      <Button icon="plus" onClick={() => onTool({ name: 'unit', u: E.normUnit({ course: (cs[0] || {}).course || '', start: now, title: t('plan.new_unit'), weeks: Array.from({ length: 6 }, () => ({})) }) })} data-sem-new>{t('plan.new_unit')}</Button></div>
    <div class="sem" role="table" aria-label={t('cal.sem')} style={{ '--cols': Math.max(1, cs.length) }}>
      <div class="sr hd" role="row"><span role="columnheader">{t('cal.sem_week')}</span>{cs.map(c => <span role="columnheader" style={{ '--cc': c.color ? toneOf(c.color) : 'var(--g500)' }}><i class="dot" />{raw(c.course)}</span>)}</div>
      {weeks.map(m => { const sw = schoolWeek(p, m), ds = weekDays(p, m), off = ds.map(d => dayOff(p, d)).filter(Boolean), ev = [...new Set(ds.flatMap(d => eventsOn(p, d)).map(e => e.label))];
        return <div class={'sr' + (m === now ? ' now' : '') + (m < now ? ' past' : '')} role="row" data-wk={m}>
          <span role="rowheader" class="wkc"><button type="button" class="link" onClick={() => onOpen(m)} aria-label={t('cal.open_week', { range: range(m) })} data-open-week={m}><b>{sw ? t('plan.week_n', { n: sw }) : raw(range(m))}</b></button>
            {sw ? <small data-raw>{range(m)}</small> : null}{off.map(o => <small class="off" data-raw>{md(o.date)} {o.label}</small>)}{ev.map(e => <small class="ev">{raw(e)}</small>)}</span>
          {cs.map(c => { const u = E.unitAt(c.course, m), ms = meetings(p, c, m), done = ms.filter(x => lessonsOn(p, x.c.id, x.d).length).length, w = u && u.u.weeks[u.n];
            return <span role="cell" class={'cell' + (u ? ' has' : '')} style={u ? { '--uc': unitColor(p, u.u) } : null} onClick={() => onOpen(m)} data-cell={c.course + '|' + m}>
              {u ? <>{u.n === 0 ? <b data-raw>{u.u.title}</b> : <span class="un" data-raw>{u.u.title}</span>}<small>{t('plan.unit_week', { n: u.n + 1, of: u.u.weeks.length })}</small>{w && w.focus ? <small data-raw>{w.focus}</small> : null}</> : <small class="mute">{t('cal.no_unit_short')}</small>}
              {ms.length > 0 && <span class="dots" title={t('cal.n_planned', { n: done, of: ms.length })}>{ms.map(x => <i class={lessonsOn(p, x.c.id, x.d).length ? 'on' : ''} />)}<em>{t('cal.n_planned', { n: done, of: ms.length })}</em></span>}</span>; })}
        </div>; })}
    </div></>;
}
