// The start of a session, shared by To do's Focus and the panel opened by hand (src/focus.js fcStartHtml): today against the goal,
// the work it suggests and why, how long, a blue Start, Just one paper, the session's goal with Change, the week so far, and under More:
// other lengths, the goal picker, Finish by and Shortest papers first. Every answer is the lifted engine's (students/focus.js), read after focusRead.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, Icon, IconButton, Segmented, Switch } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { engine as E, focusConf, cardFor } from '../../students/focus.js';
import { onFocus, startFocus } from './bus.js';
import { href } from '../router.js';
import './lines.js';

const raw = s => <span data-raw>{s}</span>;
// Redrawn whenever the timer changes (the runner says so), and every half minute for the clock and the free periods.
export function useFocusTick() {
  const [, bump] = useState(0);
  useEffect(() => { const off = onFocus(() => bump(n => n + 1)), iv = setInterval(() => bump(n => n + 1), 30000); return () => { off(); clearInterval(iv); }; }, []);
}
// A ring: how far along, from 0 to 1.
export function Ring({ frac, size = 44, w = 4, cls }) {
  const r = (size - w) / 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac || 0));
  return <svg class={'fcring ' + (cls || '')} width={size} height={size} viewBox={'0 0 ' + size + ' ' + size} aria-hidden="true">
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke-width={w} class="bg" />
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke-width={w} class="on" stroke-dasharray={c.toFixed(2)} stroke-dashoffset={(c * (1 - f)).toFixed(2)} transform={'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'} stroke-linecap="round" />
  </svg>;
}
// Today (or this week) against her goal: "12 of 30 papers", with a ring; without a goal, today's papers and a way to set one.
export function Goal({ big }) {
  const c = E.fcConf(), n = c.goal ? E.fcGoalNow(c) : 0, ns = ((E.fcLog().days[E.fcToday()] || {}).n) || 0;
  if (!c.goal || !E.fcGoalDay(c)) {
    const p = E.fcPapersToday();
    return <div class="fcgoal none" data-fc-goal="none"><Ring frac={0} size={big ? 44 : 28} />
      <div><b>{p ? t('focus.today_papers', { n: p }) : c.goal ? t('focus.no_goal_today') : t('focus.no_goal')}</b>
        <a class="link" href="#/settings/focus">{t('focus.set_goal')}</a></div></div>;
  }
  const met = n >= c.goal.n;
  return <div class={'fcgoal' + (met ? ' met' : '')} data-fc-goal={n + '/' + c.goal.n}><Ring frac={n / c.goal.n} size={big ? 44 : 28} cls={met ? 'met' : ''} />
    <div><b>{met ? t('focus.goal_reached') : c.goal.k === 'min' ? t('focus.goal_of_min', { n, of: c.goal.n }) : t('focus.goal_of', { n, of: c.goal.n })}</b>
      <span class="mute">{c.goal.per === 'week' ? t('focus.goal_week') : t('focus.goal_today')}{ns ? ', ' + t('focus.sessions_so_far', { n: ns }) : ''}</span></div></div>;
}
// What the work is: papers left and how long at her pace on this set (from its own papers only), a lesson, a to-do, or the timer.
export function workSay(w) {
  if (!w) return [t('focus.say_timer')];
  if (w.les) { const lp = E.gpLesPace(); return [w.fresh ? t('focus.say_new_lesson') : t('focus.say_lesson'), lp ? t('focus.say_pace', { n: Math.max(1, Math.round(lp / 60)) }) : ''].filter(Boolean); }
  if (!w.mark) return [t('focus.say_todo')];
  if (!w.left) return [w.fm ? t('focus.say_all_fb') : t('focus.say_all_scored')];
  const it = cardFor(w.id), id = it ? it.id : '', pace = E.gpPaces()(id), n = pace ? E.gpPaceN(id) : 0;
  return [t('focus.say_left', { n: w.left }), pace ? t('focus.say_pace', { n: Math.max(1, Math.round(w.left * pace / 60)) }) : '', n && n < 3 ? t('focus.say_from', { n }) : ''].filter(Boolean);
}
export const sgText = (g, w) => !g ? t('focus.sg_none') : g.k === 'papers' ? t('focus.papers', { n: g.n }) : g.k === 'set' ? t('focus.sg_set') : g.k === 'td' ? t('focus.sg_td') : g.x;
const hmTime = s => { const m = /^(\d{1,2}):(\d\d)$/.exec(s || ''); return m ? date(new Date(2000, 0, 1, +m[1], +m[2]), { hour: 'numeric', minute: '2-digit' }) : s; };

// The goal for this session (src/focus.js fcSgPick): none, a few papers (with - and +) or the whole set; the to-do; or a few words of
// her own when nothing is picked. What she picks holds for this work until the session starts (the engine's fcS.sg, fcS.sgw).
function SgPick({ w, len, redo }) {
  if (w && (w.les || (w.mark ? !w.left : w.done))) return null;
  const g = E.fcSgNow(w, len), k = g ? g.k : '', n = E.fcSgN(g, w, len);
  const set = v => { E.fcS.sgw = w ? w.key : ''; E.fcS.sg = v; redo(); };
  const pick = v => set(v === 'papers' ? { k: 'papers', n } : v ? { k: v } : null);
  const opts = w ? [{ value: '', label: t('focus.sg_none') }, ...(w.mark ? [{ value: 'papers', label: t('focus.papers', { n }) }, ...(w.left > 1 ? [{ value: 'set', label: t('focus.sg_set') }] : [])] : [{ value: 'td', label: t('focus.sg_td') }])] : null;
  return <div class="fcsgpick" data-fc-sgpick><span class="fcl">{t('focus.goal_session')}</span>
    <div class="fcsgrow">{opts ? <Segmented size="sm" label={t('focus.goal_session')} value={k} onChange={pick} options={opts} />
      : <input type="text" class="input" maxLength={80} placeholder={t('focus.sg_own')} aria-label={t('focus.goal_session')} value={k === 'note' ? g.x : ''} data-fc-sgx
        onInput={e => { const v = e.currentTarget.value; set(v.trim() ? { k: 'note', x: v } : null); }} />}
      {k === 'papers' && <span class="fcsgn"><IconButton icon="minus" size="sm" label={t('focus.sg_fewer')} disabled={n <= 1} onClick={() => set({ k: 'papers', n: n - 1 })} data-fc-sgn="-1" />
        <IconButton icon="plus" size="sm" label={t('focus.sg_more')} disabled={n >= w.left} onClick={() => set({ k: 'papers', n: n + 1 })} data-fc-sgn="1" /></span>}</div>
    {g && g.c ? <p class="fcl">{t('focus.sg_carried')}</p> : null}</div>;
}
// The week so far on the start card (src/tracker.js tkWeekHtml): papers and grading time since Monday, planning time when there is some.
export function WeekLine() {
  const today = E.fcToday(), days = [];
  for (let d = E.fcMon(today); d <= today; d = E.gpAdd(d, 1)) days.push(d);
  const s = E.tkSum(days, E.fcLog(), E.tkPlan()), g = s.g + (E.tkPending().g || 0);
  return <p class="fctk mute" data-fc-week={E.fcWeekPapersNow()}><span>{t('focus.wk_papers', { n: E.fcWeekPapersNow() })}</span> · <span>{t('focus.t_grading')} <b>{raw(E.tkDur(g))}</b></span>
    {s.l ? <> · <span>{t('focus.t_planning')} <b>{raw(E.tkDur(s.l))}</b></span></> : null} · <a class="link" href={href('time')} data-fc-tk>{t('focus.time_title')}</a></p>;
}

export function Start({ aside }) {
  const [chg, setChg] = useState(false), [more, setMore] = useState(false), [, bump] = useState(0), box = useRef(null);
  const redo = () => bump(n => n + 1);
  const c = E.fcConf(), works = E.fcWorks(), key = E.fcPicked(works), w = works.find(x => x.key === key) || null, f = E.gpFreeNow();
  const dflt = w && w.les ? (f ? Math.min(c.llen, E.gpFreeLen(f)) : c.llen) : f ? E.gpFreeLen(f) : c.len;
  const len = E.fcS.len || dflt, open = !!(w && w.mark && w.left), three = E.fcS.three && open && w.left >= 3;
  const lens = [...new Set([dflt, c.len, c.llen, len])].sort((a, b) => a - b);
  const pick = v => { if (v === 'three') { E.fcS.three = true; } else { E.fcS.three = false; E.fcS.len = +v; } redo(); };
  // More's own lengths (src/focus.js fcmorebox): 5, 10, 15 and 25 minutes, and the one picked when it is another of the usual ones.
  const ors = [...new Set([5, 10, 15, 25, ...(E.FC_LENS.includes(len) ? [len] : [])])].sort((a, b) => a - b);
  const g = E.fcSgNow(w, len), b = w && w.mark && E.fcS.pick == null ? E.gpBack() : null;
  const by = w && w.mark ? (E.fcLog().by || {})[w.id] || '' : '', today = E.fcToday();
  const setBy = v => { const L = E.fcLog(); L.by = { ...(L.by || {}) }; if (v >= today) L.by[w.id] = v; else delete L.by[w.id]; E.fcLogSet(L); redo(); };
  const go = () => startFocus(key, len, three ? 3 : 0);
  // Change on the goal line opens More at the goal (src/focus.js data-fcsgchg).
  const sgChange = () => { setMore(true); setTimeout(() => { const el = box.current && box.current.querySelector('[data-fc-sgpick] [aria-checked="true"], [data-fc-sgx]'); if (el) el.focus(); }, 0); };
  return <div class="fcstart" data-fc-startbox ref={box}>
    {!aside && <Goal big />}
    {chg ? <label class="fcpick"><span class="fcl">{t('focus.work_on')}</span>
      <select class="input" data-fc-work value={key} onChange={e => { E.fcS.pick = e.currentTarget.value; E.fcS.hand = true; E.fcS.len = 0; E.fcS.three = false; setChg(false); }}>
        {works.map(x => <option value={x.key} data-raw>{x.name + (x.cls ? ' · ' + x.cls : '')}</option>)}
        <option value="">{t('focus.nothing')}</option>
      </select></label>
      : <div class="fcwork"><b>{w ? raw(w.name) : t('focus.nothing')}</b>{w && w.cls && <span class="mute"> · {raw(w.cls)}</span>}
        <button type="button" class="link" data-fc-change onClick={() => setChg(true)}>{t('focus.change')}</button></div>}
    <p class="fcsay mute">{workSay(w).join(' · ')}</p>
    {(b && w && b.id === w.id || f) && <p class="fcwhy">{b && w && b.id === w.id && <span><Icon name="back" size="xs" />{t('focus.left_off', { when: date(new Date(b.t), { weekday: 'long', hour: 'numeric', minute: '2-digit' }) })}</span>}
      {f && <span><Icon name="clock" size="xs" />{t('focus.free_until', { time: hmTime(f.to) })}</span>}</p>}
    <Segmented size="sm" label={t('focus.how_long')} value={three ? 'three' : String(len)} onChange={pick}
      options={[...lens.map(n => ({ value: String(n), label: t('focus.min_short', { n }) })), ...(open && w.left >= 3 ? [{ value: 'three', label: t('focus.three_papers') }] : [])]} />
    <div class="fcmus"><Icon name="music" /><Switch label={t('focus.lofi')} checked={c.music} onChange={v => focusConf(t('focus.u_settings'), { music: v }).then(redo)} /></div>
    <Button variant="primary" icon="play" class="fcgo" data-fc-start onClick={go}>{w ? t('focus.start_on', { name: w.name }) : t('focus.start_min', { n: len })}</Button>
    {open && !three && <Button size="sm" data-fc-one onClick={() => startFocus(key, len, 1)}>{t('focus.just_one')}</Button>}
    {!(w && (w.les || (w.mark ? !w.left : w.done))) && <p class="fcsg mute">{t('focus.goal_session')}: <b>{g && g.k === 'note' ? raw(g.x) : sgText(g, w)}</b>{g && g.c ? ' · ' + t('focus.sg_carried') : ''}
      {' · '}<button type="button" class="link" data-fc-sgchg onClick={sgChange}>{t('focus.change')}</button></p>}
    {!aside && <WeekLine />}
    <details class="fcmore" open={more} onToggle={e => setMore(e.currentTarget.open)} data-fc-more-box><summary>{t('focus.more')}</summary>
      <div class="fclens"><span class="fcl">{t('focus.len_or')}</span><Segmented size="sm" label={t('focus.how_long')} value={three ? '' : String(len)} onChange={pick}
        options={ors.map(n => ({ value: String(n), label: t('focus.min_short', { n }) }))} /></div>
      <SgPick w={w} len={len} redo={redo} />
      {open && <label class="fcby"><span>{t('focus.finish_by')}</span><input type="date" class="input" data-fc-by min={today} value={by >= today ? by : ''} onChange={e => setBy(e.currentTarget.value)} />
        {by >= today && <span class="mute">{t('focus.a_day', { n: Math.ceil(w.left / E.fcDaysTo(by)) })}</span>}</label>}
      {open && w.left > 1 && <label class="cb"><input type="checkbox" data-fc-short checked={c.short} onChange={e => focusConf(t('focus.u_settings'), { short: e.currentTarget.checked }).then(redo)} /><span>{t('focus.shortest')}</span></label>}
    </details>
  </div>;
}
