// Home's look back at the week (src/gradeplan.js gpLookHtml): grading and planning time, papers marked and work handed back since
// Monday, what is still waiting and what is due next week. It shows from the day she chose in Settings > Focus and goals until
// Sunday, and "Put it away for this week" hides it until next Monday. The numbers are students/focus.js weekLook's.
import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button } from '../../ui/index.js';
import { t, date, dateRange } from '../../i18n/t.js';
import { engine as E, weekLook, hideWeekLook } from '../../students/focus.js';
import { href } from '../router.js';
import './lines.js';

const raw = s => <span data-raw>{s}</span>;
const about = (secs, n) => secs >= 60 ? t('focus.wk_about', { time: E.tkDur(secs) }) : t('focus.papers', { n });
function Tile({ label, value, sub, ...rest }) { return <div class="wktile" {...rest}><span class="mute">{label}</span><b>{value}</b>{sub ? <small>{sub}</small> : null}</div>; }

export function WeekCard() {
  const [v, set] = useState(undefined);
  useEffect(() => { weekLook().then(set, e => { console.error(e); set(null); }); }, []);
  if (!v) return null;
  const day = s => new Date(s + 'T12:00:00'), o = { weekday: 'long', month: 'short', day: 'numeric' };
  const range = v.mon === v.today ? date(day(v.mon), o) : dateRange(day(v.mon), day(v.today), o);
  return <section class="card pad wklook" aria-labelledby="wk-h" data-home="week">
    <div class="hrow"><h2 id="wk-h">{t('focus.wk_title')}</h2><a class="link" href={href('time')}>{t('focus.see_tracker')}</a></div>
    <p class="mute">{raw(range)}</p>
    <div class="wkgrid">
      <Tile label={t('focus.t_grading')} value={raw(E.tkDur(v.g))} sub={v.gdays ? t('focus.wk_gdays', { n: v.gdays }) : ''} data-wk-g={v.g} />
      <Tile label={t('focus.t_planning')} value={raw(E.tkDur(v.l))} sub={v.lessons ? t('focus.wk_lessons', { n: v.lessons }) : ''} />
      <Tile label={t('focus.t_papers')} value={<span class="num" data-raw>{v.papers}</span>} data-wk-p={v.papers} />
      <Tile label={t('focus.wk_back')} value={t('focus.wk_sets', { n: v.back.length })} sub={v.back.length ? raw(v.back.slice(0, 3).map(n => n || t('focus.wk_work')).join(', ')) : ''} data-wk-back={v.back.length} />
    </div>
    {v.wait.length > 0 && <div class="wkrow"><b>{t('focus.wk_wait')}</b><ul>{v.wait.map(w => <li data-wk-wait={w.id}>{raw((w.name || t('focus.wk_work')) + (w.cls ? ', ' + w.cls : ''))}
      <span class="mute"> · {t('focus.say_left', { n: w.left })}{w.secs >= 60 ? ' · ' + t('focus.wk_about', { time: E.tkDur(w.secs) }) : ''}</span></li>)}</ul></div>}
    {v.next.n > 0 && <div class="wkrow" data-wk-next={v.next.n}><b>{t('focus.wk_next')}</b> <span class="mute">· {t('focus.wk_sets', { n: v.next.n })}, {about(v.next.s, v.next.p)}</span></div>}
    <div class="wkfoot"><Button size="sm" onClick={() => { hideWeekLook(); set(null); }} data-wk-hide>{t('focus.wk_hide')}</Button><a class="link" href={href('settings', 'focus')}>{t('focus.wk_day')}</a></div>
  </section>;
}
