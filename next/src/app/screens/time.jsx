// The time tracker (src/tracker.js tkPageRender): time spent marking and planning, kept apart, by week, month or three months, with
// what it went to, time added by hand (1 to 720 minutes), and a spreadsheet of it all. Reached from To do > Time this week and the
// command bar. Every sum is the lifted engine's (students/focus.js), from gs.focus and the Planner's gsp.planTime.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Button, Icon, Segmented, toast, EmptyState } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { engine as E, addTime, dropTime } from '../../students/focus.js';
import { useFocusData } from '../focus/aside.jsx';
import '../focus/lines.js';

const raw = s => <span data-raw>{s}</span>;
const findName = (lib, id) => { for (const c of lib.classes.concat([lib.loose])) for (const u of c.units || []) { const it = (u.items || []).find(x => x && x.id === id); if (it) return it.name; } return ''; };

function AddTime({ done }) {
  const today = E.fcToday(), [kind, setKind] = useState('g');
  const submit = e => {
    e.preventDefault();
    const f = e.currentTarget, day = f.day.value, min = Math.round(+f.min.value);
    if (!/^\d{4}-\d\d-\d\d$/.test(day) || day > today) return toast(t('focus.pick_day'));
    if (!(min >= 1 && min <= 720)) return toast(t('focus.min_range'));
    try { addTime(day, kind, min, f.note.value.trim()); } catch (err) { console.error(err); return toast(t('settings.not_kept')); }
    done(true);
  };
  return <form class="card pad tkadd" onSubmit={submit} data-tk-form>
    <p class="mute">{t('focus.add_time_say')}</p>
    <div class="tkrow">
      <label><span>{t('focus.day')}</span><input class="input" type="date" name="day" max={today} defaultValue={today} required /></label>
      <Segmented size="sm" label={t('focus.kind')} value={kind} onChange={setKind} options={[{ value: 'g', label: t('focus.grading') }, { value: 'l', label: t('focus.planning') }]} />
      <label><span>{t('focus.minutes_box')}</span><input class="input" type="number" name="min" min="1" max="720" step="1" defaultValue="30" data-tk-min /></label>
      <label class="grow"><span>{t('focus.note')}</span><input class="input" type="text" name="note" maxLength={80} placeholder={t('focus.note_ph')} /></label>
    </div>
    <div class="row gap"><Button type="submit" variant="primary" data-tk-addok>{t('focus.add')}</Button><Button onClick={() => done(false)}>{t('focus.cancel')}</Button></div>
  </form>;
}
export default function Time() {
  const v = useFocusData(), [range, setRange] = useState('week'), [off, setOff] = useState(0), [adding, setAdding] = useState(false), [, bump] = useState(0);
  if (!v) return <div class="page" aria-busy="true"><header class="ph"><h1>{t('focus.time_title')}</h1></header><div class="loading" /></div>;
  const p = E.tkPeriod(range, off), L = E.fcLog(), P = E.tkPlan(), s = E.tkSum(p.days, L, P), today = E.fcToday();
  if (p.days.includes(today)) s.g += E.tkPending().g || 0;
  const bars = p.groups.map(g => { const x = { k: g[0], g: 0, l: 0 }; for (const k of g) { const d = s.list.find(y => y.k === k); if (d) { x.g += d.g; x.l += d.l; } } return x; });
  const top = Math.max(1, ...bars.map(b => b.g + b.l));
  const ga = Object.entries(s.ga).filter(([, x]) => x >= 60).sort((a, b) => b[1] - a[1]), la = Object.entries(s.la).filter(([, x]) => x >= 60).sort((a, b) => b[1] - a[1]);
  const hand = L.add.filter(x => x.d >= p.from && x.d <= p.to).sort((a, b) => b.d.localeCompare(a.d));
  const csv = () => { const b = new Blob([E.tkCsvText()], { type: 'text/csv' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'time.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  return <div class="page tkpage" data-tk-page>
    <header class="ph"><div><h1>{t('focus.time_title')}</h1><p>{t('focus.time_say')}</p></div></header>
    <div class="tkbar">
      <Segmented size="sm" label={t('focus.range')} value={range} onChange={x => { setRange(x); setOff(0); }} options={[{ value: 'week', label: t('focus.r_week') }, { value: 'month', label: t('focus.r_month') }, { value: 'quarter', label: t('focus.r_quarter') }]} />
      <Button size="sm" icon="chl" aria-label={t('focus.earlier')} onClick={() => setOff(off - 1)} data-tk-prev />
      <b data-tk-label>{raw(p.label)}</b>
      <Button size="sm" icon="chr" aria-label={t('focus.later')} disabled={off >= 0} onClick={() => setOff(Math.min(0, off + 1))} data-tk-next />
      {off < 0 && <Button size="sm" variant="quiet" onClick={() => setOff(0)}>{t('focus.now')}</Button>}
      <span class="grow" />
      <Button size="sm" icon="plus" onClick={() => setAdding(true)} data-tk-add>{t('focus.add_time')}</Button>
      <Button size="sm" icon="download" onClick={csv} data-tk-csv>{t('focus.csv')}</Button>
    </div>
    {adding && <AddTime done={ok => { setAdding(false); if (ok) bump(n => n + 1); }} />}
    <div class="tktiles">
      <div class="card pad"><span class="mute">{t('focus.t_grading')}</span><b data-tk-g={s.g}>{raw(E.tkDur(s.g))}</b></div>
      <div class="card pad"><span class="mute">{t('focus.t_planning')}</span><b data-tk-l={s.l}>{raw(E.tkDur(s.l))}</b></div>
      <div class="card pad"><span class="mute">{t('focus.t_papers')}</span><b class="num">{s.p}</b></div>
      <div class="card pad"><span class="mute">{t('focus.t_focus')}</span><b>{raw(E.tkDur(s.s))}</b></div>
    </div>
    {s.g + s.l > 0 ? <div class="card pad tkchart" role="img" aria-label={p.label} data-raw>
      {bars.map(b => <span class={'tkb' + (b.k === today ? ' now' : '') + (b.k > today ? ' later' : '')} title={date(new Date(b.k + 'T12:00:00'), { month: 'short', day: 'numeric' }) + ': ' + E.tkDur(b.g) + ' / ' + E.tkDur(b.l)}>
        <span class="tkcol"><i class="l" style={{ height: Math.round(b.l / top * 100) + '%' }} /><i class="g" style={{ height: Math.round(b.g / top * 100) + '%' }} /></span>
        <span class="tkd">{date(new Date(b.k + 'T12:00:00'), range === 'week' ? { weekday: 'short' } : { day: 'numeric' })}</span></span>)}
    </div> : <EmptyState icon="clock" title={t('focus.nothing_counted')} />}
    <div class="tklists">
      {ga.length > 0 && <section class="card pad"><h2 class="h3">{t('focus.by_asg')}</h2><ul class="tklist">{ga.map(([id, x]) => <li><span>{id ? raw(findName(v.lib, id) || id) : t('focus.not_filed')}</span>{s.pa[id] ? <span class="mute num">{t('focus.papers', { n: s.pa[id] })}</span> : null}<b>{raw(E.tkDur(x))}</b></li>)}</ul></section>}
      {la.length > 0 && <section class="card pad"><h2 class="h3">{t('focus.by_lesson')}</h2><ul class="tklist">{la.map(([id, x]) => <li><span>{id ? raw(P.names[id] || id) : t('focus.no_lesson')}</span><b>{raw(E.tkDur(x))}</b></li>)}</ul></section>}
      {hand.length > 0 && <section class="card pad"><h2 class="h3">{t('focus.by_hand')}</h2><ul class="tklist">{hand.map(x => <li data-tk-hand={x.id}><span>{raw(date(new Date(x.d + 'T12:00:00'), { weekday: 'short', month: 'short', day: 'numeric' }))} · {x.k === 'g' ? t('focus.grading') : t('focus.planning')}{x.x ? <> · {raw(x.x)}</> : null}</span>
        <b>{raw(E.tkDur(x.s))}</b><Button size="sm" variant="quiet" icon="trash" aria-label={t('focus.take_off')} onClick={() => { dropTime(x.id); bump(n => n + 1); }} data-tk-del /></li>)}</ul></section>}
    </div>
  </div>;
}
