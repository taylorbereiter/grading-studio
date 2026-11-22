// Home: today's classes and lessons, and what the app worked out from the saved work (papers to mark, to hand back, lessons to plan).
// Read only. Every number comes from crossings.js countsForHome, which works them out the way the current app's Today does; the
// saved-work proof holds the two to the same counts.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { toast, Button, Card, ClassDot, Icon, IconButton, Menu, EmptyState, Progress } from '../../ui/index.js';
import { t, date, num } from '../../i18n/t.js';
import { href } from '../router.js';
import { countsForHome, focusForHome } from '../../crossings.js';
import { openFocus, onFocus, runner } from '../focus/bus.js';
import { usePlan } from '../plan.js';
import { toneOf, classTone } from '../colors.js';
import { Slide } from '../plan/slide.jsx';
import { usePart } from '../parts.js';
import './home-lines.js';
import '../plan/lines.js';
import '../saving/lines.js';
import { useSaving } from '../../services/saving.js';
import { sampleOn, enterSample } from '../sample.js';

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
    useHome.read = read;
    return () => { live = false; document.removeEventListener('visibilitychange', vis); window.removeEventListener('storage', read); clearInterval(iv); };
  }, []);
  return [v, tick];
}

// Take attendance, or what was taken today (src/attend.js attTodayLine)
function attLine(a) {
  if (!a.taken) return t('home.att_take');
  const say = [a.l ? t('home.att_l', { n: a.l }) : '', a.a ? t('home.att_a', { n: a.a }) : '', a.e ? t('home.att_e', { n: a.e }) : ''].filter(Boolean).join(' · ');
  return t('home.att_done', { say: say || t('home.att_all') });
}
function NowCard({ teach, now, plan }) {
  if (!teach) return <Card class="card pad now"><EmptyState icon="cal" title={t('home.no_timetable')} text={t('home.no_timetable_text')} action={<a class="btn" href={href('settings', 'timetable')} data-tt-go>{t('home.tt_go')}</a>} /></Card>;
  if (teach.off || !teach.rows.length) return <Card class="card pad now"><EmptyState icon="sun" title={t('home.no_classes_today')} text={typeof teach.off === 'string' ? raw(teach.off) : null} /></Card>;
  const cur = teach.rows.find(r => r.now), d = new Date(now), mins = d.getHours() * 60 + d.getMinutes();
  return <section class="card now" aria-label={t('home.next_class')} data-home="teach">
    {cur ? <div class="nowtop">
      <div class="cls"><ClassDot color={toneOf(cur.color)} /><b data-raw>{cur.name}</b><span class="mute">{t('home.time_range', { from: clock(cur.start), to: clock(cur.end) })}</span></div>
      {hm(cur.start) > mins ? <div class="cd"><b class="num">{t('home.minutes', { n: hm(cur.start) - mins })}</b><span>{t('home.until_starts')}</span></div>
        : <div class="cd"><b class="num">{t('home.minutes', { n: Math.max(0, hm(cur.end) - mins) })}</b><span>{t('home.until_ends')}</span></div>}
      <h2>{cur.lesson ? (raw(cur.lesson.title) || t('home.untitled_lesson')) : t('home.nothing_planned')}</h2>
      {cur.lesson && <div class="meta">{(cur.lesson.ready || cur.lesson.done) && <span class="ok"><Icon name="check" size="xs" />{t('home.ready')}</span>}
        {cur.lesson.n > 0 && <span><Icon name="slides" size="xs" />{t('home.slides', { n: cur.lesson.n })}</span>}</div>}
      {cur.lesson && (l => l && l.slides && l.slides[0] ? <a class="first" href={href('lesson', l.id)} aria-label={t('home.open_lesson')}><Slide slide={l.slides[0]} lesson={l} plan={plan} width={240} /></a> : null)(plan && plan.lessons.find(x => x.id === cur.lesson.id))}
      <div class="acts">{cur.lesson ? <>{cur.lesson.show && <a class="btn pri lg" href={href('lesson', cur.lesson.id, 'present', cur.classId)} data-now-present><Icon name="play" />{t('home.present')}</a>}<a class={'btn lg' + (cur.lesson.show ? '' : ' pri')} href={href('lesson', cur.lesson.id)}>{t('home.open_lesson')}</a></>
        : <a class="btn pri lg" href={href('class', cur.classId)}>{t('home.plan_it')}</a>}</div>
    </div> : <p class="mute nowdone">{t('home.day_over')}</p>}
    <ol class="day" aria-label={t('home.today_classes')}>{teach.rows.map(r => { const l = r.lesson, what = l ? (l.show ? t('home.present') : t('home.open_lesson')) : t('home.plan_it');
      // each class goes where the current app's Teaching today row goes: presenting, its lesson, or planning it (src/today.js todayHtml)
      const to = l ? (l.show ? href('lesson', l.id, 'present', r.classId) : href('lesson', l.id)) : href('class', r.classId);
      const note = l && l.got ? (l.got.slide >= l.got.of ? t('home.taught') : t('home.taught_to', { n: l.got.slide, of: l.got.of })) : '';
      return <li class={r.now ? 'on' : hm(r.end) <= mins ? 'past' : ''} style={{ '--cc': toneOf(r.color) }}>
        <a class="p" href={to} title={what} aria-label={t('home.row_go', { cls: r.name, what })} data-teach={r.classId}><ClassDot color={toneOf(r.color)} />{raw(r.name)}</a>
        <span class="tm"><span data-raw>{clock(r.start)}</span>{note && <span data-taught> · {note}</span>}{r.todo && <> · <a href={href('class', r.todo.classId, 'todo')} data-ttodo={r.todo.classId}>{t('home.row_todo', { n: r.todo.n })}</a></>}</span>
        {r.att && <a class={'tatt' + (r.att.taken ? ' done' : '')} href={href('class', r.att.classId, 'people', 'attendance')} data-tatt={r.att.classId}>{attLine(r.att)}</a>}</li>; })}</ol>
  </section>;
}

// Focus: today against her goal on a ring ("6/10"), or the time left while a session runs; it opens the timer (src/focus.js, the
// sidebar's Focus). Numbers only, through crossings.js focusForHome.
function HomeFocus() {
  const [v, set] = useState(null);
  useEffect(() => { const read = () => focusForHome().then(set, e => console.error(e)); read(); const off = onFocus(read), iv = setInterval(read, 15000); return () => { off(); clearInterval(iv); }; }, []);
  const g = v && v.goal, f = g ? Math.min(1, g.n / g.of) : 0, c = 2 * Math.PI * 7;
  const clock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  return <button type="button" class="btn fchome" onClick={openFocus} data-fc-home={g ? g.n + '/' + g.of : ''}>
    {g ? <svg class={'fcring' + (g.n >= g.of ? ' met' : '')} width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7" fill="none" stroke-width="3" class="bg" />
      <circle cx="9" cy="9" r="7" fill="none" stroke-width="3" class="on" stroke-dasharray={c.toFixed(2)} stroke-dashoffset={(c * (1 - f)).toFixed(2)} transform="rotate(-90 9 9)" stroke-linecap="round" /></svg> : <Icon name="timer" />}
    <span>{v && v.run ? <span class="num" data-raw>{clock(v.run.secs)}</span> : t('nav.focus')}</span>{g && !(v && v.run) ? <span class="mute num" data-raw>{g.n}/{g.of}</span> : null}</button>;
}
// The look back at the week (src/gradeplan.js gpLookHtml), from the timer's runner, which is on its way in anyway.
function WeekLook() {
  const [m, set] = useState(null);
  useEffect(() => { let live = true; runner().then(x => live && set(x), e => console.error(e)); return () => { live = false; }; }, []);
  return m ? <m.WeekCard /> : null;
}
// First thing on Home while no folder or Drive keeps a second copy (src/safe.js safeAskRender): choose a folder, or where a browser
// can't, make a take-home file. "Not now" puts it away for a week, in this browser only (gsc.folderLater).
const WEEK = 7 * 864e5;
function askShows(S, work) {
  const f = S && S.folder ? S.folder() : null, g = S ? S.google() : {};
  let later = 0; try { later = +localStorage.getItem('gsc.folderLater') || 0; } catch { }
  return !(!f || sampleOn() || matchMedia('(max-width:640px)').matches || f.state !== 'none' || !f.booted || g.email || Date.now() - later < WEEK || !(f.canPick || work));
}
function FolderAsk({ work }) {
  const S = useSaving(), [, bump] = useState(0), f = S && S.folder ? S.folder() : null;
  if (!askShows(S, work)) return null;
  const pick = async () => { try { const st = await S.folderPick(); if (st === 'ok' || st === 'decide') toast(t('saving.f_done', { name: S.folder().name })); } catch (e) { if (!e || e.name !== 'AbortError') { console.error(e); toast(t('saving.f_bad')); } } bump(n => n + 1); };
  const away = () => { try { localStorage.setItem('gsc.folderLater', String(Date.now())); } catch { } toast(t('saving.ask_later_done')); bump(n => n + 1); };
  return <section class="card pad fask" data-home="folder"><Icon name="cloud" /><div>
    <h2>{t(f.canPick ? 'saving.ask_h' : 'saving.ask_none_h')}</h2><p>{t(f.canPick ? 'saving.ask_text' : 'saving.w_none_nopick')}</p>
    <div class="row gap">{f.canPick ? <Button variant="primary" onClick={pick} data-fask-pick>{t('saving.f_choose')}</Button> : <a class="btn pri" href={href('settings', 'saving')}>{t('saving.ask_take')}</a>}
      <Button variant="quiet" onClick={away} data-fask-later>{t('saving.ask_later')}</Button>{f.canPick && <span class="mute" data-fask-have>{t('saving.ask_have')}</span>}</div></div></section>;
}
// The lesson she worked on last, within three days (src/planner/plannext.js planRecent), with its next class.
function pickUp(plan, now) {
  const l = ((plan && plan.lessons) || []).filter(x => x && !x.library && now - (x.updated || 0) < 3 * 864e5).sort((a, b) => b.updated - a.updated)[0];
  if (!l) return null;
  const d = new Date(now), today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const slot = (l.slots || []).filter(s => s.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const c = slot && ((plan.setup && plan.setup.classes) || []).find(x => x.id === slot.classId);
  return { l, sub: slot ? [c ? raw(c.name) : null, slot.date === today ? t('plan.today') : dayOf(slot.date)] : [t('plan.off_timetable')] };
}
function Line({ icon, title, sub, href: to, kind, menu, id }) {
  return <li class="hl" data-kind={kind} data-id={id}><span class="hi"><Icon name={icon} /></span><span class="tx"><b>{title}</b>{sub && sub.length > 0 && <small>{sub}</small>}</span>
    {menu && <Menu label={menu.label} trigger={b => <IconButton {...b} icon="dots" size="sm" label={menu.label} data-hmenu={id} />} items={menu.items} />}
    {to && <a class="go" href={to} aria-label={title}><Icon name="chr" /></a>}</li>;
}
// Needs a look (src/shell.js renderNeedsOnly): papers partly scored, papers not kept in this browser, and work with no second copy
// for a week (only while the folder question isn't already asking). Six rows, then how many more.
function Look({ v }) {
  const S = useSaving(), f = S && S.folder ? S.folder() : null, g = S ? S.google() : {}, rows = [];
  for (const m of v.look) rows.push(m.kind === 'partial'
    ? { k: 'partial', title: t('home.look_partly', { n: m.n }), sub: [raw(m.name) || t('home.a_download')], to: href('mark', m.id), id: m.id }
    : { k: 'notkept', title: t('home.look_notkept'), sub: m.name ? t('home.look_notkept_s', { name: m.name }) : t('home.look_notkept_s', { name: t('home.a_download') }), id: m.id });
  const b = v.backup, days = Math.floor((Date.now() - b.last) / 864e5);
  if (b.kept > 0 && f && f.booted && f.state === 'none' && !g.email && days >= 7 && !askShows(S, v.mark.length + v.back.length > 0))
    rows.push({ k: 'backup', title: b.last ? t('home.look_backup_old', { n: days }) : t('home.look_backup_none'), sub: t('home.look_backup_s'), to: href('settings', 'saving') });
  if (!rows.length) return null;
  return <section aria-labelledby="h-look" data-home="look"><div class="hrow"><h2 id="h-look">{t('home.look_h')}</h2><span class="hcount num">{rows.length}</span></div>
    <ul class="card hlist">{rows.slice(0, 6).map(r => <Line kind={r.k} id={r.id} icon={r.k === 'backup' ? 'cloud' : 'warn'} title={r.title} sub={r.sub} href={r.to} />)}
      {rows.length > 6 && <li class="hl"><span class="mute">{t('home.look_more', { n: rows.length - 6 })}</span></li>}</ul></section>;
}
// What the class needs next (src/today.js nextHtml): the newest finished rubric set's weakest row, every row's class average as a
// bar, how many scored at half the row's top or below, and the way to Insights to see who. Numbers and row names only.
function NextCard({ n }) {
  if (!n) return null;
  const low = n.rows[n.low], half = num(low.top / 2), name = n.name || t('home.nx_last');
  const head = n.flat ? (n.cls ? t('home.nx_flat_cls', { cls: n.cls, name }) : t('home.nx_flat', { name })) : (n.cls ? t('home.nx_weak_cls', { cls: n.cls, row: low.name, name }) : t('home.nx_weak', { row: low.name, name }));
  return <section aria-labelledby="h-next" data-home="next"><div class="hrow"><h2 id="h-next">{t('home.nx_h')}</h2></div>
    <div class="card pad hnext"><p class="big" data-raw>{head}</p>
      <div class="bars" role="img" aria-label={n.rows.map(r => t('home.nx_bar', { name: r.name, avg: num(r.avg), top: r.top })).join(', ')}>
        {n.rows.map((r, i) => <><span class="bn" data-raw>{r.name}</span><span class="bt"><i class={i === n.low && !n.flat ? 'low' : ''} style={{ width: Math.round(r.avg / r.top * 100) + '%' }} /></span><span class="bv num" data-raw>{r.avg.toFixed(1)}</span></>)}</div>
      {!n.flat && <p class="mute" data-raw>{low.low ? t('home.nx_who', { n: low.low, half, row: low.name }) : t('home.nx_nobody', { half, row: low.name })}</p>}
      {n.open && <a class="link" href={href('mark', n.id, 'insights')} data-next-go>{low.low && !n.flat ? t('home.nx_see') : t('home.nx_open')}<Icon name="chr" size="sm" /></a>}
    </div></section>;
}
// Earlier work (src/today.js oldRow): an older copy, handed back already, or nothing in it to score. The newest three, or all.
const OLD_SHOWN = 3;
function Earlier({ v, menu }) {
  const [all, setAll] = useState(false);
  if (!v.old.length) return null;
  const list = all ? v.old : v.old.slice(0, OLD_SHOWN), day = ms => date(new Date(ms), { day: 'numeric', month: 'short' });
  return <section aria-labelledby="h-earlier" data-home="earlier"><div class="hrow"><h2 id="h-earlier">{t('home.earlier_h')}</h2>
    {v.old.length > OLD_SHOWN && <button type="button" class="link" onClick={() => setAll(!all)} data-earlier-all>{all ? t('home.earlier_newest') : t('home.earlier_all', { n: v.old.length })}</button>}</div>
    <ul class="card hlist">{list.map(m => <Line kind="old" id={m.id} icon="inbox" title={raw(m.name) || t('home.student_work')} menu={menu(m)} href={m.open ? href('mark', m.id) : null}
      sub={dot([raw(m.cls), m.stale ? t('home.old_stale') : m.back ? t('home.old_returned', { date: day(m.back) }) : t('home.old_worked', { date: day(m.t) }), m.of ? t('home.old_scored', { done: m.done, of: m.of }) : null, m.open ? null : t('home.old_notkept')])} />)}</ul></section>;
}
export default function Home({ classes }) {
  const [v, now] = useHome(), plan = usePlan(), Sv = usePart('setsave', matchMedia('(max-width:640px)').matches);   // a phone's sign-in card
  const [fg, setFg] = useState(null), A = usePart('asg', !!fg);
  const TD = usePart('hometodo');   // Forget (class/assignment.jsx), asked first
  const OS = usePart('oldsample', !!(v && v.oldSample && !sampleOn())), G = usePart('homeg', !matchMedia('(max-width:640px)').matches);   // a sample class from before; Google in the header
  const DR = usePart('homedrop');   // new student work dropped anywhere on Home, and Bring in papers (app/home/drop.jsx)
  const Sf = useSaving(), fs = Sf && Sf.folder ? Sf.folder().state : '', FX = usePart('folderfix', fs === 'ask' || fs === 'decide');   // the folder needs a press
  const menu = m => ({ label: t('home.row_more', { name: m.name || t('home.student_work') }), items: [{ label: t('home.forget'), icon: 'trash', onSelect: () => setFg(m) }] });
  const d = new Date(now);
  if (!v) return <div class="page" aria-busy="true"><header class="ph"><h1>{greeting(d)}</h1></header><div class="loading" /></div>;
  if (v.error) return <div class="page"><header class="ph"><h1>{greeting(d)}</h1></header><EmptyState icon="warn" title={t('home.read_failed')} /></div>;
  const c = v.counts, say = [c.classesToday ? t('home.say_classes', { n: c.classesToday }) : '', c.mark ? t('home.say_mark', { n: c.mark }) : '', c.back ? t('home.say_back', { n: c.back }) : '', c.toPlan ? t('home.say_plan', { n: c.toPlan }) : '', c.missing ? t('home.say_missing', { n: v.missing.reduce((a, x) => a + x.n, 0) }) : ''].filter(Boolean).join(' ');
  const pk = pickUp(plan, now);
  const left = new Map((classes || []).map((x, i) => [x.loose ? '' : x.name, { ...x, i }]));
  return <div class="page home">
    <header class="ph hello"><div><h1>{greeting(d)}</h1><p data-raw>{date(d, { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
      <div class="row gap">{G && G.HomeGoogle && <G.HomeGoogle />}{DR && <DR.HomeBring />}<HomeFocus /><a class="btn" href={href('calendar')}><Icon name="week" />{t('home.this_week')}</a></div></header>
    <p class="say" data-home="say" data-mark={c.mark} data-back={c.back} data-today={c.classesToday} data-plan={c.toPlan} data-missing={c.missing}>{say || t('home.say_none')}</p>
    {DR && <DR.HomeDrop />}
    {FX && <FX.FolderFix />}
    {OS && v.oldSample && !sampleOn() && <OS.OldSample s={v.oldSample} L={{ os_h: t('home.os_h'), os_text: t('home.os_text'), os_setup: t('home.os_setup'), os_open: t('home.os_open'), os_rm: t('home.os_rm'), os_gone: t('home.os_gone'), os_cant: t('home.os_cant') }} onGone={() => useHome.read && useHome.read()} />}
    <FolderAsk work={v.mark.length + v.back.length > 0} />
    {Sv && <Sv.PhoneSign />}
    <NowCard teach={v.teach} now={now} plan={plan} />
    <WeekLook />
    <div class="homegrid">
      <section aria-labelledby="h-classes"><div class="hrow"><h2 id="h-classes">{t('nav.classes')}</h2></div>
        {classes && classes.length ? <div class="card ctable" role="table" aria-labelledby="h-classes">
          <div class="hd" role="row"><span role="columnheader">{t('home.col_class')}</span><span role="columnheader">{t('home.col_today')}</span><span role="columnheader" class="r">{t('home.col_mark')}</span></div>
          {classes.map((x, i) => { const r = v.teach && v.teach.rows.find(y => y.name === x.name); return <a class="row" role="row" href={href('class', x.id || '-')}>
            <span role="cell" class="nm"><ClassDot color={classTone(plan, x.name, x.loose ? -1 : i)} /><span><b>{x.loose ? t('nav.no_class') : raw(x.name)}</b>{x.students > 0 && <small>{t('home.students', { n: x.students })}</small>}</span></span>
            <span role="cell" class="nx">{r ? <><small data-raw>{clock(r.start)}</small><span>{r.lesson ? raw(r.lesson.title) || t('home.untitled_lesson') : t('home.nothing_planned')}</span></> : <span class="mute">{t('home.not_today')}</span>}</span>
            <span role="cell" class="r tm"><b class="num">{x.left}</b></span></a>; })}
        </div> : <EmptyState icon="people" title={t('home.no_classes')} />}
      </section>
      <div class="hcol">{TD && <TD.TodoCard L={{ title: t('nav.todo'), all: t('home.all_todos'), none: t('home.td_none'), add: t('home.td_add'), more: n => t('home.td_more', { n }), see: t('home.td_all'), tick_step: t('home.td_step_tick'), add_step: t('home.td_step_add') }} />}
      <section aria-labelledby="h-needs"><div class="hrow"><h2 id="h-needs">{t('home.needs_you')}</h2>{!TD && <a class="link" href={href('todo')}>{t('home.all_todos')}</a>}</div>
        <ul class="card hlist" data-home="needs">
          {pk && <Line kind="pick" icon="slides" title={t('plan.pick_up')} sub={dot([raw(pk.l.title) || t('home.untitled_lesson'), ...pk.sub])} href={href('lesson', pk.l.id)} />}
          {v.mark.map(m => <Line kind="mark" id={m.id} menu={menu(m)} icon="pen" title={t(m.fm ? 'home.feedback_on' : m.done ? 'home.finish_marking' : 'home.mark', { name: m.name || t('home.student_work') })}
            sub={dot([raw(m.cls), m.fm ? t('home.feedback_only') : t('home.left_of', { left: m.left, of: m.of })])} href={m.open ? href('mark', m.id) : null} />)}
          {v.back.map(m => <Line kind="back" id={m.id} menu={menu(m)} icon="upload" title={t('home.hand_back', { name: m.name || t('home.student_work') })} sub={dot([raw(m.cls), t('home.all_scored', { n: m.of })])} href={m.open ? href('mark', m.id, 'return') : null} />)}
          {v.toPlan.map(p => <Line kind="plan" icon="slides" title={p.in === 0 ? t('home.plan_today', { cls: p.className }) : p.in === 1 ? t('home.plan_tomorrow', { cls: p.className }) : t('home.plan_lesson', { cls: p.className, day: dayOf(p.day) })} sub={dot([raw(clock(p.start)), raw(p.lesson) || t('home.nothing_planned')])} href={href('class', p.classId)} />)}
          {(v.missing || []).map(m => <Line kind="miss" icon="warn" title={t('home.remind', { n: m.n })} sub={raw(m.name)} href={href('class', m.classId, 'todo')} />)}
          {!pk && !v.mark.length && !v.back.length && !v.toPlan.length && !(v.missing || []).length && <li class="hl none"><span class="mute">{t('home.all_clear')}</span></li>}
        </ul>
        <Look v={v} />
        <NextCard n={v.next} />
      </section></div>
    </div>
    <Earlier v={v} menu={menu} />
    {!sampleOn() && <p class="mute hfoot" data-home-foot>{t('home.foot')} <button type="button" class="link" data-home-sample onClick={() => { if (!enterSample()) toast(t('sample.cant')); }}>{t('home.try_sample')}</button></p>}
    {fg && A && <A.Forget it={{ name: fg.name || t('home.student_work') }} id={fg.id} onClose={ok => { setFg(null); if (ok && useHome.read) useHome.read(); }} />}
  </div>;
}
