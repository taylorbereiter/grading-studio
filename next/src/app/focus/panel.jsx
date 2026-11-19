// The focus panel in the bottom left, over every screen (src/focus.js fcPanelHtml): the session's clock and ring, what it is on,
// the papers it has finished and today's goal, the music, and Pause, +5 minutes and End; when the time is up, a break or a few
// more minutes; the break's own clock; and a look back when it is done. A running session folds down to a pill.
import { h, Fragment } from 'preact';
import { Button, Icon, IconButton, Select } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { engine as E, focusConf, lessonReady } from '../../students/focus.js';
import { todoChange } from '../../students/todo.js';
import { href } from '../router.js';
import { Start, Goal, Ring, sgText } from './start.jsx';
import { nextTrack, setVolume } from './run.js';
import './lines.js';

const raw = s => <span data-raw>{s}</span>;
const MOODS = [['mix', 'focus.mood_mix'], ['rain', 'focus.mood_rain'], ['library', 'focus.mood_library'], ['coffee', 'focus.mood_coffee'], ['night', 'focus.mood_night'], ['tape', 'focus.mood_tape'], ['garden', 'focus.mood_garden'], ['blue', 'focus.mood_blue'], ['quiet', 'focus.mood_quiet']];
const conf = (part, draw) => focusConf(t('focus.u_settings'), part).then(draw);

function Head({ cap, fold, onClose }) {
  return <div class="fchead"><h2>{cap}</h2>{fold ? <IconButton icon="minus" size="sm" label={t('focus.fold')} onClick={fold} data-fc-fold /> : <IconButton icon="x" size="sm" label={t('focus.close')} onClick={onClose} data-fc-close />}</div>;
}
function Music({ c, draw }) {
  if (!c.music) return <div class="fcmrow"><Button size="sm" variant="quiet" icon="music" data-fc-music onClick={() => conf({ music: true }, draw)}>{t('focus.lofi')}</Button></div>;
  return <div class="fcmrow on">
    <IconButton icon="music" size="sm" label={t('focus.lofi')} aria-pressed="true" onClick={() => conf({ music: false }, draw)} data-fc-music />
    <select class="input sm" aria-label={t('focus.mood')} value={c.mood} onChange={e => conf({ mood: e.currentTarget.value }, draw)}>{MOODS.map(([v, k]) => <option value={v}>{t(k)}</option>)}</select>
    <IconButton icon="chr" size="sm" label={t('focus.next_track')} onClick={nextTrack} />
    <input type="range" min="0.05" max="1" step="0.05" value={c.mvol} aria-label={t('focus.volume')} onInput={e => setVolume(+e.currentTarget.value)} onChange={e => conf({ mvol: +e.currentTarget.value }, draw)} />
  </div>;
}
function What({ r, w }) {
  if (r.k === 'l') return <div class="fcwhat"><b>{raw(w ? w.name : r.t || '')}</b><span class="mute">{t('focus.say_lesson')}</span>
    {r.st !== 'brk' && r.l && <a class="btn sm pri" href={href('lesson', r.l)}>{t('focus.open_lesson')}</a>}</div>;
  const sub = [r.one ? (E.fcN(r) > 1 ? t('focus.just_three') : t('focus.just_one')) : w && w.mark ? (w.left ? t('focus.say_left', { n: w.left }) : w.fm ? t('focus.say_all_fb') : t('focus.say_all_scored')) : w ? t('focus.say_todo') : t('focus.say_timer')];
  return <div class="fcwhat"><b>{w ? raw(w.name) : t('focus.title')}</b><span class="mute">{w && w.cls ? <>{raw(w.cls)} · </> : null}{sub}</span>
    {w && w.mark && w.left > 0 && r.st !== 'brk' && <a class="btn sm pri" href={href('mark', w.id)} data-fc-next>{t('focus.next_paper')}<Icon name="chr" /></a>}</div>;
}
function Clock({ r, big }) {
  const secs = r.st === 'brk' ? E.fcLeft(r) : r.one ? E.fcElapsed(r) : E.fcLeft(r);
  return <div class={'fcclock' + (r.st === 'paused' ? ' paused' : '') + (r.st === 'brk' ? ' brk' : '')}><Ring frac={E.fcFrac(r)} size={big ? 84 : 22} w={big ? 6 : 3} /><span class="fct num" data-fc-time>{E.fcClock(secs)}</span></div>;
}
function SgLine({ r, w }) {
  const g = r.sg; if (!g) return null;
  const met = E.fcSgMet(r, w);
  return <div class={'fcsgl' + (met ? ' met' : '')}><span class="mute">{t('focus.goal_session')}</span>
    <b>{g.k === 'note' ? raw(g.x) : g.k === 'papers' && !met ? t('focus.sg_got', { n: E.fcGot(r), of: g.n }) : sgText(g, w)}</b>{met && <span class="ok"><Icon name="check" size="xs" />{t('focus.sg_reached')}</span>}</div>;
}

export function Panel({ ui, close, start, draw }) {
  const r = E.fcRun(), c0 = E.fcConf(), w = r ? E.fcWork(r.w) : null, c = r && r.k === 'l' ? { ...c0, len: c0.llen } : c0;
  const set = r2 => { E.fcRunSet(r2); draw(); };
  const fold = () => { const x = E.fcRun(); if (x) { x.fold = true; set(x); } };
  if (!r) return <aside class="fcpanel" aria-label={t('focus.title')} data-fc-panel="start"><Head cap={t('focus.title')} onClose={close} /><Start /></aside>;
  if (r.fold && (r.st === 'run' || r.st === 'paused' || r.st === 'brk')) {
    const n = c.goal && r.k !== 'l' ? E.fcGoalNow(c) : 0;
    return <aside class="fcpanel fold" aria-label={t('focus.title')} data-fc-panel="pill"><button type="button" class={'fcpill' + (r.st === 'brk' ? ' brk' : '')} title={t('focus.unfold')} data-fc-unfold onClick={() => { const x = E.fcRun(); x.fold = false; set(x); }}>
      <Clock r={r} />{w && raw(w.name)}{c.goal && r.k !== 'l' ? <span class={'fcpg' + (n >= c.goal.n ? ' met' : '')}>{n}/{c.goal.n}</span> : null}</button></aside>;
  }
  // back after a few minutes away from the tab: how long, and the session goes on or starts again (src/focus.js fcaway)
  if (r.st === 'run' && r.away) return <aside class="fcpanel" aria-label={t('focus.title')} data-fc-panel="away"><Head cap={t('focus.focusing')} fold={fold} />
    <div class="fcrunv"><p class="fcbig">{t('focus.wb')}</p><p class="mute">{t('focus.wb_away', { n: r.away })}</p>
      <div class="fcacts"><Button size="sm" variant="primary" data-fcaway="keep" onClick={() => { const x = E.fcRun(); if (x) { delete x.away; set(x); } }}>{t('focus.wb_keep')}</Button>
        <Button size="sm" data-fcaway="again" onClick={() => { const x = E.fcRun(); if (x) { delete x.away; x.at = Date.now(); x.st = 'run'; delete x.pz; delete x.idl; delete x.ii; set(x); } }}>{t('focus.wb_again')}</Button></div></div></aside>;
  if (r.st === 'run' || r.st === 'paused') {
    return <aside class="fcpanel" aria-label={t('focus.title')} data-fc-panel={r.st}><Head cap={r.st === 'paused' ? t('focus.paused') : t('focus.focusing')} fold={fold} />
      <div class="fctop"><Clock r={r} big /><What r={r} w={w} /></div>
      {r.k !== 'l' && <div class="fcstats"><div class="fcstat"><span class="mute">{r.no > 1 ? t('focus.session_n', { n: r.no }) : t('focus.this_session')}</span><b data-fc-got={E.fcGot(r)}>{t('focus.papers', { n: E.fcGot(r) })}</b></div><SgLine r={r} w={w} /><Goal /></div>}
      <Music c={c} draw={draw} />
      <div class="fcacts">{r.st === 'paused' ? <Button size="sm" variant="primary" data-fc-resume onClick={() => { E.fcResume(); draw(); }}>{t('focus.carry_on')}</Button> : <Button size="sm" data-fc-pause onClick={() => { E.fcPause(); draw(); }}>{t('focus.pause')}</Button>}
        {!r.one && <Button size="sm" data-fc-more onClick={() => { E.fcMore(5); draw(); }}>{t('focus.plus5')}</Button>}<span class="sp" />
        <Button size="sm" variant="quiet" data-fc-stop onClick={() => { E.fcStop(); draw(); }}>{t('focus.end')}</Button></div>
    </aside>;
  }
  if (r.st === 'up') {
    const got = r.got || 0, mins = Math.round(r.len / 60);
    return <aside class="fcpanel" aria-label={t('focus.title')} data-fc-panel="up"><Head cap={t('focus.title')} onClose={close} />
      <p class="fcbig ok"><Icon name="check" />{r.one ? (E.fcN(r) > 1 ? t('focus.three_done') : t('focus.one_done')) : t('focus.done_min', { n: mins })}</p>
      {!(w && !w.mark && !got) && r.k !== 'l' && <p>{got ? t('focus.you_finished', { n: got }) : t('focus.nothing_finished')}</p>}
      <SgLine r={r} w={w} />{r.k !== 'l' && <Goal />}
      {r.one ? <div class="fcacts">{w && w.left > 0 && (E.fcN(r) > 1 && w.left >= 3 ? <Button variant="primary" onClick={() => start(r.w, c.len, 3)}>{t('focus.three_more')}</Button> : <Button variant="primary" onClick={() => start(r.w, c.len, 1)}>{t('focus.one_more')}</Button>)}
        <Button onClick={() => start(r.w, c.len)}>{t('focus.keep_going', { n: c.len })}</Button></div>
        : <><div class="fcacts"><Button variant="primary" data-fc-break onClick={() => { E.fcBreak(); draw(); }}>{t('focus.take_break', { n: c.brk })}</Button><Button data-fc-again onClick={() => start(r.w, mins)}>{t('focus.more_min', { n: mins })}</Button></div>
          <div class="fcacts fcext" role="group" aria-label={t('focus.few_more')}><span class="mute">{t('focus.few_more')}</span>{[2, 5, 10].map(n => <Button size="sm" data-fc-ext={n} onClick={() => { E.fcExt(n); draw(); }}>{t('focus.plus_n', { n })}</Button>)}</div></>}
      <div class="fcacts"><Button size="sm" variant="quiet" data-fc-stop onClick={() => { E.fcStop(); draw(); }}>{t('focus.stop_now')}</Button></div>
    </aside>;
  }
  if (r.st === 'brk') return <aside class="fcpanel" aria-label={t('focus.title')} data-fc-panel="brk"><Head cap={t('focus.break')} fold={fold} />
    <div class="fctop"><Clock r={r} big /><div class="fcwhat"><b>{w ? t('focus.after_break') : t('focus.a_break')}</b>{w && raw(w.name)}</div></div>
    <p class="fcbrkbox">{t('focus.break_say')}</p>
    <div class="fcacts"><Button size="sm" variant="primary" data-fc-back onClick={() => start(r.w, c.len)}>{t('focus.back_now')}</Button><span class="sp" /><Button size="sm" variant="quiet" data-fc-stop onClick={() => { E.fcStop(); draw(); }}>{t('focus.stop_now')}</Button></div>
  </aside>;
  if (r.st === 'brkup') return <aside class="fcpanel" aria-label={t('focus.title')} data-fc-panel="brkup"><Head cap={t('focus.title')} onClose={close} />
    <p class="fcbig">{t('focus.break_over')}</p>{w && <p><span class="mute">{t('focus.next')} </span><b>{raw(w.name)}</b></p>}
    <div class="fcacts"><Button variant="primary" icon="play" data-fc-again onClick={() => start(r.w, c.len)}>{t('focus.start_min', { n: c.len })}</Button><Button size="sm" onClick={() => { E.fcStop(); E.fcClose(); ui.open = true; draw(); }}>{t('focus.something_else')}</Button>
      <span class="sp" /><Button size="sm" variant="quiet" data-fc-stop onClick={() => { E.fcStop(); draw(); }}>{t('focus.stop_now')}</Button></div>
  </aside>;
  // done for now
  if (r.k === 'l') return <aside class="fcpanel" aria-label={t('focus.title')} data-fc-panel="done"><Head cap={t('focus.title')} onClose={close} /><p class="fcbig">{t('focus.done_for_now')}</p>
    {r.l && !r.rq && <div class="fcacts" role="group" aria-label={t('focus.lesson_ready_q')}><span>{t('focus.lesson_ready_q')}</span>
      <Button size="sm" data-fc-ready onClick={() => lessonReady(r.l, true).then(() => { const x = E.fcRun(); if (x) { x.rq = 1; set(x); } })}>{t('focus.ready')}</Button>
      <Button size="sm" variant="quiet" onClick={() => { const x = E.fcRun(); if (x) { x.rq = 1; set(x); } }}>{t('focus.not_yet')}</Button></div>}
    <div class="fcacts"><Button size="sm" data-fc-close onClick={close}>{t('focus.close')}</Button></div></aside>;
  const p = E.fcPapersToday(), mins = Math.round(E.fcSecsToday() / 60), wk = E.fcWeekPapers(), met = c.goal && E.fcGoalNow(c) >= c.goal.n, tdOpen = w && !w.mark && !w.les && !w.done;
  return <aside class="fcpanel" aria-label={t('focus.title')} data-fc-panel="done"><Head cap={t('focus.title')} onClose={close} />
    <p class={'fcbig' + (met ? ' ok' : '')}>{met ? <><Icon name="check" />{c.goal.per === 'week' ? t('focus.week_reached') : t('focus.today_reached')}</> : t('focus.done_for_now')}</p>
    <p>{t('focus.sum_today', { n: p, m: t('focus.minutes', { n: mins }) })}{wk > p ? ' ' + t('focus.sum_week', { n: wk }) : ''}</p>
    {c.goal && <Goal />}
    {tdOpen ? <><p class="mute">{t('focus.todo_done_q')} <b>{raw(w.name)}</b></p><div class="fcacts"><Button size="sm" variant="primary" data-fc-tick onClick={() => todoChange(t('focus.mark_done'), T => T.todoTick(w.id)).then(close)}>{t('focus.mark_done')}</Button><Button size="sm" onClick={close}>{t('focus.not_yet')}</Button></div></>
      : <div class="fcacts"><Button size="sm" data-fc-close onClick={close}>{t('focus.close')}</Button></div>}
  </aside>;
}
