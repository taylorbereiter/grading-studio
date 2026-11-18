// Home: today's classes and lessons, and what the app worked out from the saved work (papers to mark, to hand back, lessons to plan).
// Read only. Every number comes from crossings.js countsForHome, which works them out the way the current app's Today does; the
// saved-work proof holds the two to the same counts.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button, Card, ClassDot, Icon, EmptyState, Progress } from '../../ui/index.js';
import { t, date, num } from '../../i18n/t.js';
import { href } from '../router.js';
import { countsForHome } from '../../crossings.js';
import { classColor } from '../shell.jsx';

const hm = s => { const m = /^(\d{1,2}):(\d\d)$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
const clock = s => { const m = /^(\d{1,2}):(\d\d)$/.exec(s || ''); return m ? date(new Date(2000, 0, 1, +m[1], +m[2]), { hour: 'numeric', minute: '2-digit' }) : ''; };
const dayOf = s => date(new Date(s + 'T12:00:00'), { weekday: 'long' });
const raw = s => (s ? <span data-raw>{s}</span> : null);   // a teacher's own words, or a time or day written by the browser
const dot = parts => parts.filter(Boolean).flatMap((x, i) => (i ? [' · ', x] : [x]));
function greeting(d) { const hr = d.getHours(); return t(hr < 12 ? 'home.morning' : hr < 18 ? 'home.afternoon' : 'home.evening'); }

function useHome() {
  const [v, set] = useState(null), [tick, setTick] = useState(Date.now());
  useEffect(() => {
    let live = true;
    const read = () => countsForHome().then(x => live && set(x), e => { console.error(e); live && set({ error: true }); });
    read();
    const vis = () => { if (!document.hidden) read(); };
    document.addEventListener('visibilitychange', vis); window.addEventListener('storage', read);
    const iv = setInterval(() => setTick(Date.now()), 30000);
    return () => { live = false; document.removeEventListener('visibilitychange', vis); window.removeEventListener('storage', read); clearInterval(iv); };
  }, []);
  return [v, tick];
}

function NowCard({ teach, now }) {
  if (!teach) return <Card class="card pad now"><EmptyState icon="cal" title={t('home.no_timetable')} text={t('home.no_timetable_text')} /></Card>;
  if (teach.off || !teach.rows.length) return <Card class="card pad now"><EmptyState icon="sun" title={t('home.no_classes_today')} text={typeof teach.off === 'string' ? raw(teach.off) : null} /></Card>;
  const cur = teach.rows.find(r => r.now), d = new Date(now), mins = d.getHours() * 60 + d.getMinutes();
  return <section class="card now" aria-label={t('home.next_class')} data-home="teach">
    {cur ? <div class="nowtop">
      <div class="cls"><ClassDot color={cur.color} /><b data-raw>{cur.name}</b><span class="mute">{t('home.time_range', { from: clock(cur.start), to: clock(cur.end) })}</span></div>
      {hm(cur.start) > mins ? <div class="cd"><b class="num">{t('home.minutes', { n: hm(cur.start) - mins })}</b><span>{t('home.until_starts')}</span></div>
        : <div class="cd"><b class="num">{t('home.minutes', { n: Math.max(0, hm(cur.end) - mins) })}</b><span>{t('home.until_ends')}</span></div>}
      <h2>{cur.lesson ? (raw(cur.lesson.title) || t('home.untitled_lesson')) : t('home.nothing_planned')}</h2>
      {cur.lesson && <div class="meta">{(cur.lesson.ready || cur.lesson.done) && <span class="ok"><Icon name="check" size="xs" />{t('home.ready')}</span>}
        {cur.lesson.n > 0 && <span><Icon name="slides" size="xs" />{t('home.slides', { n: cur.lesson.n })}</span>}</div>}
      <div class="acts">{cur.lesson ? <><a class="btn pri lg" href={href('lesson', cur.lesson.id)}><Icon name="play" />{t('home.present')}</a><a class="btn lg" href={href('lesson', cur.lesson.id)}>{t('home.open_lesson')}</a></>
        : <a class="btn pri lg" href={href('class', cur.classId)}>{t('home.plan_it')}</a>}</div>
    </div> : <p class="mute nowdone">{t('home.day_over')}</p>}
    <ol class="day" aria-label={t('home.today_classes')}>{teach.rows.map(r => <li class={r.now ? 'on' : hm(r.end) <= mins ? 'past' : ''} style={{ '--cc': r.color }}>
      <span class="p"><ClassDot color={r.color} />{raw(r.name)}</span><span class="tm" data-raw>{clock(r.start)}</span></li>)}</ol>
  </section>;
}

function Line({ icon, title, sub, href: to, kind }) {
  return <li class="hl" data-kind={kind}><span class="hi"><Icon name={icon} /></span><span class="tx"><b>{title}</b>{sub && sub.length > 0 && <small>{sub}</small>}</span>{to && <a class="go" href={to} aria-label={title}><Icon name="chr" /></a>}</li>;
}
export default function Home({ classes }) {
  const [v, now] = useHome();
  const d = new Date(now);
  if (!v) return <div class="page"><header class="ph"><h1>{greeting(d)}</h1></header><div class="loading" aria-busy="true" /></div>;
  if (v.error) return <div class="page"><header class="ph"><h1>{greeting(d)}</h1></header><EmptyState icon="warn" title={t('home.read_failed')} /></div>;
  const c = v.counts, say = [c.classesToday ? t('home.say_classes', { n: c.classesToday }) : '', c.mark ? t('home.say_mark', { n: c.mark }) : '', c.back ? t('home.say_back', { n: c.back }) : '', c.toPlan ? t('home.say_plan', { n: c.toPlan }) : ''].filter(Boolean).join(' ');
  const left = new Map((classes || []).map((x, i) => [x.loose ? '' : x.name, { ...x, i }]));
  return <div class="page home">
    <header class="ph hello"><div><h1>{greeting(d)}</h1><p data-raw>{date(d, { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
      <a class="btn" href={href('calendar')}><Icon name="week" />{t('home.this_week')}</a></header>
    <p class="say" data-home="say" data-mark={c.mark} data-back={c.back} data-today={c.classesToday} data-plan={c.toPlan}>{say || t('home.say_none')}</p>
    <NowCard teach={v.teach} now={now} />
    <div class="homegrid">
      <section aria-labelledby="h-classes"><div class="hrow"><h2 id="h-classes">{t('nav.classes')}</h2></div>
        {classes && classes.length ? <div class="card ctable" role="table" aria-labelledby="h-classes">
          <div class="hd" role="row"><span role="columnheader">{t('home.col_class')}</span><span role="columnheader">{t('home.col_today')}</span><span role="columnheader" class="r">{t('home.col_mark')}</span></div>
          {classes.map((x, i) => { const r = v.teach && v.teach.rows.find(y => y.name === x.name); return <a class="row" role="row" href={href('class', x.id || '-')}>
            <span role="cell" class="nm"><ClassDot color={classColor(x.loose ? -1 : i)} /><span><b>{x.loose ? t('nav.no_class') : raw(x.name)}</b>{x.students > 0 && <small>{t('home.students', { n: x.students })}</small>}</span></span>
            <span role="cell" class="nx">{r ? <><small data-raw>{clock(r.start)}</small><span>{r.lesson ? raw(r.lesson.title) || t('home.untitled_lesson') : t('home.nothing_planned')}</span></> : <span class="mute">{t('home.not_today')}</span>}</span>
            <span role="cell" class="r tm"><b class="num">{x.left}</b></span></a>; })}
        </div> : <EmptyState icon="people" title={t('home.no_classes')} />}
      </section>
      <section aria-labelledby="h-needs"><div class="hrow"><h2 id="h-needs">{t('home.needs_you')}</h2><a class="link" href={href('todo')}>{t('home.all_todos')}</a></div>
        <ul class="card hlist" data-home="needs">
          {v.mark.map(m => <Line kind="mark" icon="pen" title={t(m.fm ? 'home.feedback_on' : m.done ? 'home.finish_marking' : 'home.mark', { name: m.name || t('home.student_work') })}
            sub={dot([raw(m.cls), m.fm ? t('home.feedback_only') : t('home.left_of', { left: m.left, of: m.of })])} href={m.open ? href('mark', m.id) : null} />)}
          {v.back.map(m => <Line kind="back" icon="upload" title={t('home.hand_back', { name: m.name || t('home.student_work') })} sub={dot([raw(m.cls), t('home.all_scored', { n: m.of })])} href={m.open ? href('mark', m.id, 'return') : null} />)}
          {v.toPlan.map(p => <Line kind="plan" icon="slides" title={p.in === 0 ? t('home.plan_today', { cls: p.className }) : p.in === 1 ? t('home.plan_tomorrow', { cls: p.className }) : t('home.plan_lesson', { cls: p.className, day: dayOf(p.day) })} sub={dot([raw(clock(p.start)), raw(p.lesson) || t('home.nothing_planned')])} href={href('class', p.classId)} />)}
          {!v.mark.length && !v.back.length && !v.toPlan.length && <li class="hl none"><span class="mute">{t('home.all_clear')}</span></li>}
        </ul>
      </section>
    </div>
  </div>;
}
