// Beside To do (the approved design, c2-classes 4-todo): Focus (today's goal, how long, lo-fi music, Start on the work it suggests),
// the Grading plan (what is due this week and how long it takes at her pace, src/gradeplan.js gpDue), and Time this week (grading and
// planning by day, src/tracker.js tkSum), with the way to the time tracker.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button, Icon } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { engine as E, focusRead } from '../../students/focus.js';
import { onSaved } from '../../shared/saved.js';
import { href } from '../router.js';
import { openFocus } from './bus.js';
import { Start, Goal, Ring, useFocusTick } from './start.jsx';
import './lines.js';

const raw = s => <span data-raw>{s}</span>;
// The timer's engine read once, and again after a save or a change in another window.
export function useFocusData() {
  const [v, set] = useState(null);
  useFocusTick();
  useEffect(() => {
    let live = true, tm = 0;
    const read = () => focusRead().then(x => live && set(x), e => console.error(e));
    const soon = () => { clearTimeout(tm); tm = setTimeout(read, 120); };
    read();
    const off = onSaved(soon), st = e => { if (!e.key || /^(gsp\.focusRun|gs\.focus|gs\.lib|gsp\.planTime)$/.test(e.key)) soon(); };
    window.addEventListener('storage', st);
    return () => { live = false; off(); window.removeEventListener('storage', st); clearTimeout(tm); };
  }, []);
  return v;
}
const running = r => r && r.st !== 'done';

function FocusSec() {
  const r = E.fcRun();
  return <section class="tdsec fcsec" aria-labelledby="fc-h" data-fc-aside>
    <h2 class="tdcap" id="fc-h"><Icon name="timer" />{t('focus.title')}</h2>
    {running(r) ? <><Goal big /><div class="fcon"><span>{r.st === 'brk' || r.st === 'brkup' ? t('focus.on_break') : t('focus.session_on')}</span>
      <Button size="sm" data-fc-show onClick={() => { const x = E.fcRun(); if (x && x.fold) { x.fold = false; E.fcRunSet(x); } openFocus(); }}>{t('focus.unfold')}</Button></div></>
      : <><Goal big /><Start aside /></>}
  </section>;
}
function PlanSec({ tone }) {
  const mon = E.fcMon(E.fcToday()), list = E.gpDue(mon, E.gpAdd(mon, 6)), sum = E.gpSum(list);
  return <section class="tdsec gpsec" aria-labelledby="gp-h" data-gp-aside>
    <h2 class="tdcap" id="gp-h"><Icon name="inbox" />{t('focus.plan')}</h2>
    {list.length ? <ul class="gplist">{list.map(x => <li data-gp-row={x.it.id}><span class="dot" style={{ '--cc': tone(x.c) }} /><span class="gpn">{raw(x.it.name)} <span class="mute num">{x.left}</span></span>
      <span class="gpt num">{x.secs >= 60 ? raw(E.tkDur(x.secs)) : t('focus.papers', { n: x.left })}</span></li>)}</ul>
      : <p class="mute">{t('focus.plan_none')}</p>}
    {list.length > 0 && <p class="mute">{sum.s >= 60 ? t('focus.plan_total', { time: E.tkDur(sum.s) }) : t('focus.plan_papers', { n: sum.p })}</p>}
  </section>;
}
function TimeSec() {
  const today = E.fcToday(), mon = E.fcMon(today), days = Array.from({ length: 7 }, (_, i) => E.gpAdd(mon, i));
  const s = E.tkSum(days, E.fcLog(), E.tkPlan()), g = s.g + (E.tkPending().g || 0);
  const list = s.list.filter((d, i) => d.g + d.l > 0 || [0, 1, 2, 3, 4].includes(i)), top = Math.max(1, ...list.map(d => d.g + d.l));
  return <section class="tdsec tksec" aria-labelledby="tk-h" data-tk-aside>
    <h2 class="tdcap" id="tk-h"><Icon name="clock" />{t('focus.week_time')}</h2>
    <div class="tkbars" role="img" aria-label={list.map(d => date(new Date(d.k + 'T12:00:00'), { weekday: 'short' }) + ' ' + E.tkDur(d.g + d.l)).join(', ')} data-raw>
      {list.map(d => <span class={'tkb' + (d.k === today ? ' now' : '') + (d.k > today ? ' later' : '')}>
        <span class="tkcol"><i class="l" style={{ height: Math.round(d.l / top * 100) + '%' }} /><i class="g" style={{ height: Math.round(d.g / top * 100) + '%' }} /></span>
        <span class="tkd">{date(new Date(d.k + 'T12:00:00'), { weekday: 'narrow' })}</span></span>)}
    </div>
    <p class="tkleg"><span data-tk-papers={E.fcWeekPapersNow()}>{t('focus.wk_papers', { n: E.fcWeekPapersNow() })}</span><span><i class="g" />{t('focus.legend', { what: t('focus.grading'), time: E.tkDur(g) })}</span><span><i class="l" />{t('focus.legend', { what: t('focus.planning'), time: E.tkDur(s.l) })}</span></p>
    <a class="link" href={href('time')} data-tk-open>{t('focus.see_tracker')}</a>
  </section>;
}
export function FocusAside({ tone }) {
  const v = useFocusData();
  if (!v) return null;
  return <><FocusSec /><PlanSec tone={tone} /><TimeSec /></>;
}
