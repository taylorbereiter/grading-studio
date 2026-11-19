// Present: the lesson's slides on the whole screen, one at a time, as the current Planner shows them (src/planner/present.js).
// Moving: arrows, Page Up and Down, space and Enter go on; Backspace goes back; Home and End; a number then Enter goes to that slide;
// a click goes on. The class's tools, each on its key as today: N speaker notes, B or . a blank screen, A the agenda, L the
// lesson's links (a number opens one), T the class timer (1 to 9 starts that many minutes, + and - add or take a minute), P picks a
// name, G makes groups (a number sets their size), F full screen, W the class screen in its own window (the slide, or the blank
// screen, for a second screen; the keys work in either window and the speaker notes show here). Esc closes what is open, then ends. Names come from the class's
// roster as the grading side last left it (crossings.js rosterNamesForPresent): shown, never kept.
import { h, Fragment } from 'preact';
import { useState, useLayoutEffect, useEffect, useRef } from 'preact/hooks';
import { IconButton, Button, Switch } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import * as PT from '../plan/ptimer.js';
import { live, clsOf, norm, host } from '../../planning/school.js';
import { PARTS } from '../router.js';
import '../plan/present-lines.js';
import { rosterNamesForPresent } from '../../crossings.js';
import { nameKey } from '../../planning/plan.js';
import { Slide, SLIDE_CSS } from '../plan/slide.jsx';
import { engine } from '../../planning/engine.js';
import { exampleUrl, isExample } from '../plan/examples.js';
import '../plan/lines.js';

const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
// Groups of about n, nobody left alone (src/pickshare.js pkCount, pkGroups).
function groupsOf(names, n) {
  const len = names.length; if (!len) return [];
  const up = Math.ceil(len / n), least = Math.floor(len / up), k = least >= Math.max(2, n - 1) || up === 1 ? up : Math.max(1, Math.floor(len / n));
  const out = Array.from({ length: k }, () => []); shuffle(names).forEach((x, i) => out[i % k].push(x)); return out;
}
const lines = body => String(body || '').split('\n').map(x => x.replace(/^\s*(?:[•\-*]|\d+[.)])\s*/, '').trim()).filter(Boolean);
const mmss = PT.mmss;
const plain = x => String(x || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const esc = x => String(x == null ? '' : x).replace(/[&"><]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const PANEL = { notes: 'plan.pr_notes', agenda: 'plan.pr_agenda', links: 'plan.pr_links', timer: 'plan.pr_timer', pick: 'plan.pr_pick', groups: 'plan.pr_groups' };

// The class's lasting links (School resources marked for this class or its course, src/planner/links.js lkClassGroups), after the
// lesson's own: [{ label, links }].
function linkGroups(p, l, className) {
  const out = [];
  if ((l.links || []).length) out.push({ label: t('present.this_lesson'), links: l.links });
  const c = ((p && p.setup && p.setup.classes) || []).find(x => norm(x.name) === norm(className));
  if (c) {
    const keys = new Set([norm(c.course), norm(c.name)].filter(Boolean));
    const links = live().filter(i => i.kind === 'link' && i.url && clsOf(i).some(n => keys.has(norm(n)))).map(i => ({ name: i.name || host(i.url), url: i.url }));
    if (links.length) out.push({ label: c.course || c.name, links });
  }
  return out;
}
const isTyping = e => { const x = e.target; return !!(x && x.closest && x.closest('input,textarea,select')); };

// The class timer's panel (T): ready-made times, an own time, and while it runs, more or less time, pause, restart and stop.
function TimerPanel({ tm, onOwn }) {
  const run = tm && !tm.done, last = PT.ownLast();
  const [m, setM] = useState(last ? String(Math.floor(last / 60)) : ''), [sc, setSc] = useState(last ? String(last % 60) : '');
  const own = () => { if (!PT.own(Math.max(0, +m || 0) * 60 + Math.max(0, +sc || 0))) onOwn(); };
  return <div class="prtimer">
    <h3>{run ? t('present.t_running', { time: mmss(tm.total) }) : t('present.t_head')}</h3>
    {run && <b class={tm.paused ? '' : 'run'}>{mmss(tm.left)}</b>}
    {run ? <>
      <div class="prrow" role="group">
        <Button size="sm" onClick={() => PT.add(-60)} data-ta="-60">{t('present.less_min')}</Button><Button size="sm" onClick={() => PT.add(-10)} data-ta="-10">{t('present.less_10')}</Button>
        <Button size="sm" onClick={() => PT.add(10)} data-ta="10">{t('present.more_10')}</Button><Button size="sm" onClick={() => PT.add(60)} data-ta="60">{t('present.more_min')}</Button></div>
      <div class="prrow"><Button size="sm" variant="primary" onClick={PT.pause} data-tp="pause">{tm.paused ? t('present.go_on') : t('present.pause')}</Button>
        <Button size="sm" onClick={PT.restart} data-tp="restart">{t('present.restart')}</Button><Button size="sm" onClick={PT.stop} data-tp="stop">{t('present.stop')}</Button></div>
    </> : <>
      <div class="prrow" role="group"><Button size="sm" onClick={() => PT.start(30)} aria-label={t('present.s30')} data-ts="30">0:30</Button>
        {[1, 2, 3, 5, 10, 15].map(n => <Button size="sm" onClick={() => PT.start(n * 60)} aria-label={t('present.n_min', { n })} data-tm={n}>{n}</Button>)}</div>
      <div class="prrow own"><label><input type="number" min="0" max="180" inputMode="numeric" value={m} onInput={e => setM(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') own(); }} aria-label={t('present.minutes_box')} data-own="m" /> {t('present.min')}</label>
        <label><input type="number" min="0" max="59" step="5" inputMode="numeric" value={sc} onInput={e => setSc(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') own(); }} aria-label={t('present.seconds_box')} data-own="s" /> {t('present.sec')}</label>
        <Button size="sm" variant="primary" onClick={own} data-tp="own">{t('present.start')}</Button></div>
    </>}
    {tm && tm.done && <p class="prup">{t('present.up')}</p>}
    <Switch label={t('present.big')} checked={PT.bigOn()} onChange={PT.setBig} />
    <Switch label={t('present.sound')} checked={PT.soundOn()} onChange={PT.setSound} />
    <p class="mute">{t('plan.timer_help')}</p>
  </div>;
}

export function Present({ p, l, start = 0, className, onClose }) {
  const n = l.slides.length;
  const [i, setI] = useState(Math.max(0, Math.min(start, n - 1)));
  const [size, setSize] = useState(() => fit());
  const [panel, setPanel] = useState(''), [blank, setBlank] = useState(false), [typed, setTyped] = useState('');
  const [tm, setTm] = useState(() => PT.timer()), [pick, setPick] = useState(''), [groups, setGroups] = useState([]), [gsize, setGsize] = useState(4);
  const [ticks, setTicks] = useState(() => new Set()), [now, setNow] = useState(() => new Date()), [isFull, setIsFull] = useState(false);
  const box = useRef(null), st = useRef({}), pop = useRef(null), [out, setOut] = useState(false), far = useRef(i), began = useRef(Date.now()); st.current = { ...st.current, i, panel, typed, gsize, blank }; far.current = Math.max(far.current, i);
  function fit() { const w = window.innerWidth, hh = window.innerHeight; return Math.floor(Math.min(w, hh * 1280 / 720)); }
  const names = () => { const r = rosterNamesForPresent(), k = nameKey(className || ''); const c = r.find(x => nameKey(x.name) === k); return c ? c.names : []; };
  const groupsL = linkGroups(p, l, className), links = groupsL.flatMap(g => g.links);
  const ag = l.slides.find((s, j) => j > 0 && s.layout === 'agenda'), items = ag ? lines(ag.body) : [];
  const go = d => setI(x => Math.max(0, Math.min(n - 1, x + d)));
  const toggle = k => setPanel(v => v === k ? '' : k);
  const pickName = () => { const ns = names(); setPick(ns.length ? ns[Math.floor(Math.random() * ns.length)] : ''); setPanel('pick'); };
  const makeGroups = sz => { setGsize(sz); setGroups(groupsOf(names(), sz)); setPanel('groups'); };
  const full = () => { try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (box.current && box.current.requestFullscreen) box.current.requestFullscreen().catch(() => {}); } catch {} };
  const tick = j => setTicks(s => { const x = new Set(s); if (x.has(j)) x.delete(j); else x.add(j); return x; });
  // The timer lives on outside Present (plan/ptimer.js); here it is drawn, and its chip shows the time of day when none runs.
  useEffect(() => PT.subscribe(x => setTm(x ? { ...x } : null)), []);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(id); }, []); // not-words
  // Before the first paint, so a key pressed as soon as Present shows is not lost.
  useLayoutEffect(() => {
    const key = e => {
      const k = e.key, s = st.current;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e) && k !== 'Escape') return;
      const stop = () => { e.preventDefault(); e.stopPropagation(); };
      if (k === 'Escape') { stop(); if (s.blank) setBlank(false); else if (s.panel) setPanel(''); else if (s.typed) setTyped(''); else end(); return; }
      if (/^[0-9]$/.test(k)) {
        stop();
        if (s.panel === 'timer' && k !== '0') { PT.start(+k * 60); return; }
        if (s.panel === 'links') { const x = s.links[+k - 1]; if (x) window.open(x.url, '_blank', 'noopener'); return; }
        if (s.panel === 'groups' && +k >= 2) { makeGroups(+k); return; }
        setTyped(v => (v + k).slice(-3)); return;
      }
      if ((k === '+' || k === '=') && s.panel === 'timer') { stop(); PT.add(60); return; }
      if (k === '-' && s.panel === 'timer') { stop(); PT.add(-60); return; }
      if (k === 'Enter' && s.typed) { stop(); const m = +s.typed; setTyped(''); if (m >= 1 && m <= n) setI(m - 1); return; }
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'ArrowDown' || k === 'Enter') { if (e.target && e.target.closest && e.target.closest('.prpanel button')) return; stop(); go(1); return; }
      if (k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp' || k === 'Backspace') { stop(); go(-1); return; }
      if (k === 'Home') { stop(); setI(0); return; }
      if (k === 'End') { stop(); setI(n - 1); return; }
      const c = k.toLowerCase();
      if (c === 'n') { stop(); toggle('notes'); } else if (c === 'b' || c === '.') { stop(); setBlank(b => !b); } else if (c === 'a') { stop(); toggle('agenda'); }
      else if (c === 'l') { stop(); toggle('links'); } else if (c === 't') { stop(); toggle('timer'); } else if (c === 'p') { stop(); pickName(); }
      else if (c === 'g') { stop(); if (s.panel === 'groups') setPanel(''); else makeGroups(s.gsize); } else if (c === 'f') { stop(); if (e.view && e.view !== window) popFull(); else full(); }
      else if (c === 'w') { stop(); popOut(key); }
    };
    st.current.key = key;
    const rs = () => setSize(fit());
    window.addEventListener('keydown', key, true); window.addEventListener('resize', rs);
    try { if (box.current && box.current.requestFullscreen && !document.fullscreenElement) box.current.requestFullscreen().catch(() => {}); } catch {}
    const fs = () => { setIsFull(!!document.fullscreenElement); if (!document.fullscreenElement) setSize(fit()); };
    document.addEventListener('fullscreenchange', fs);
    if (box.current) box.current.focus();
    return () => { shut(); window.removeEventListener('keydown', key, true); window.removeEventListener('resize', rs); document.removeEventListener('fullscreenchange', fs); };
  }, [l.id]);
  st.current.links = links;
  // The class screen window: the slide drawn the same way, scaled to the window, kept in step below. F there (or its own button)
  // puts that window on its whole screen.
  function shut() { const w = pop.current; pop.current = null; setOut(false); try { if (w && !w.closed) w.close(); } catch {} }
  function popFull() { const w = pop.current; if (!w || w.closed) return; const d = w.document; try { if (d.fullscreenElement) d.exitFullscreen().catch(() => {}); else d.documentElement.requestFullscreen().catch(() => {}); } catch {} }
  function popOut(key) {
    if (pop.current && !pop.current.closed) return shut();
    let w = null; try { w = window.open('', 'gsClassScreen', 'popup,width=960,height=560'); } catch {}
    if (!w) return;
    const d = w.document;
    d.open(); d.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(l.title) + '</title><style>' + SLIDE_CSS + 'html,body{margin:0;height:100%;overflow:hidden;background:#000}#fit{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}#fs{position:fixed;right:12px;bottom:12px;z-index:2;font:14px system-ui,sans-serif;padding:6px 12px;border-radius:8px;border:0;background:rgba(255,255,255,.85);opacity:.2}#fs:hover,#fs:focus{opacity:1}:fullscreen #fs{display:none}</style></head><body><div id="fit"></div><button id="fs" type="button"></button></body></html>'); d.close(); // not-words
    const fsb = d.getElementById('fs'); fsb.textContent = t('present.full'); fsb.setAttribute('data-popfull', '');
    fsb.addEventListener('click', e => { e.stopPropagation(); popFull(); });
    d.addEventListener('keydown', key, true); w.addEventListener('resize', () => paint());
    d.addEventListener('click', () => go(1));
    pop.current = w; setOut(true); setPanel('notes');
    try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch {}
  }
  function paint() {
    const w = pop.current; if (!w) return;
    if (w.closed) { pop.current = null; setOut(false); return; }
    const fitEl = w.document.getElementById('fit'); if (!fitEl) return;
    const { i: at, blank: off } = st.current, sl = l.slides[at];
    if (off || !sl) { fitEl.innerHTML = ''; return; }
    const ex = sl.img && isExample(sl.img.src) ? sl.img.src : '', shown = ex ? { ...sl, img: { ...sl.img, src: exampleUrl(ex) || '' } } : sl;
    let html = ''; try { html = engine(p).slideHtml(shown, l, false); } catch (e) { console.error(e); }
    const k = Math.min(w.innerWidth / 1280, w.innerHeight / 720);
    fitEl.innerHTML = '<div style="width:' + Math.floor(1280 * k) + 'px;height:' + Math.floor(720 * k) + 'px;overflow:hidden;position:relative"><div class="ls-slide" style="transform:scale(' + k + ');transform-origin:0 0">' + html + '</div></div>'; // not-words
  }
  useEffect(() => { paint(); }, [i, blank, out]);
  // Ending Present leaves a running timer in the corner of the app (plan/ptimer-float.jsx).
  function end() { try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch {} if (PT.timer()) PARTS.ptimer().then(m => m.showFloat()).catch(e => console.error(e)); onClose(st.current.i, far.current, (Date.now() - began.current) / 1000); }
  const s = l.slides[i], cur = items.findIndex((x, j) => !ticks.has(j)), big = PT.bigOn();
  const chip = tm ? (tm.done ? t('present.up') : mmss(tm.left)) : '', clock = date(now, { hour: 'numeric', minute: '2-digit' });
  const chipLabel = tm ? (tm.done ? t('present.up_clear') : t(tm.paused ? 'present.chip_go' : 'present.chip_pause', { time: mmss(tm.left) })) : '';
  let ln = 0;
  return <div class={'present' + (blank ? ' blank' : '')} ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('plan.presenting', { title: l.title })}
    onClick={e => { if (!e.target.closest('button,a,input,label,.prpanel')) go(1); }}>
    {!blank && <Slide slide={s} lesson={l} plan={p} width={size} label={t('plan.slide_of', { n: i + 1, of: n })} />}
    {panel && !blank && <div class={'prpanel pr-' + panel} role="region" aria-label={t(PANEL[panel])}>
      {panel === 'notes' && (s.notes ? <p data-raw>{s.notes}</p> : <p class="mute">{t('plan.no_notes')}</p>)}
      {panel === 'agenda' && (items.length ? <ul class="pragenda">{items.map((x, j) => <li><button type="button" class={(ticks.has(j) ? 'done' : '') + (j === cur ? ' now' : '')} aria-pressed={String(ticks.has(j))} onClick={() => tick(j)} data-ag={j}><span class="bx" aria-hidden="true" /><span data-raw>{x}</span></button></li>)}</ul>
        : <><p class="mute">{t('plan.no_agenda')}</p><ol class="pragenda">{l.slides.map((x, j) => <li><button type="button" class={j === i ? 'now' : ''} onClick={() => setI(j)} data-goto={j}><span data-raw>{plain(x.title) || t('plan.slide_of', { n: j + 1, of: n })}</span></button></li>)}</ol></>)}
      {panel === 'links' && (groupsL.length ? groupsL.map(g => <><h3 data-raw>{g.label}</h3><ul class="prlinks">{g.links.map(x => { ln++; return <li><a href={x.url} target="_blank" rel="noopener" data-link={ln}>{ln <= 9 && <kbd>{ln}</kbd>}<span data-raw>{x.name}</span></a></li>; })}</ul></>) : <p class="mute">{t('plan.no_links')}</p>)}
      {panel === 'timer' && <TimerPanel tm={tm} onOwn={() => { const x = box.current && box.current.querySelector('[data-own="m"]'); if (x) x.focus(); }} />}
      {panel === 'pick' && (pick ? <p class="prpick" data-raw>{pick}</p> : <p class="mute">{t('plan.no_roster')}</p>)}
      {panel === 'groups' && (groups.length ? <div class="prgroups">{groups.map((g, j) => <div><b>{t('plan.group_n', { n: j + 1 })}</b><ul>{g.map(x => <li data-raw>{x}</li>)}</ul></div>)}</div> : <p class="mute">{t('plan.no_roster')}</p>)}
    </div>}
    {typed && <div class="prtyped" aria-live="polite">{t('plan.go_to_slide', { n: typed })}</div>}
    {tm && panel !== 'timer' && <button type="button" class={'prclock' + (big ? ' big' : '') + (tm.done ? ' done' : tm.paused ? ' paused' : '')} onClick={PT.press} aria-label={chipLabel} data-chip>{chip}{tm.paused && !tm.done && <small>{t('present.paused')}</small>}</button>}
    <div class="prbar" role="toolbar" aria-label={t('plan.presenting', { title: l.title })}><span class="num">{t('plan.slide_of', { n: i + 1, of: n })}</span>
      <IconButton icon="chl" label={t('plan.prev_slide')} onClick={() => go(-1)} />
      <IconButton icon="chr" label={t('plan.next_slide')} onClick={() => go(1)} />
      <IconButton icon="todo" label={t('plan.pr_agenda')} kbd="A" aria-pressed={String(panel === 'agenda')} onClick={() => toggle('agenda')} data-pb="agenda" />
      <IconButton icon="timer" label={t('plan.pr_timer')} kbd="T" aria-expanded={String(panel === 'timer')} onClick={() => toggle('timer')} data-pb="timer" />
      <IconButton icon="people" label={t('plan.pr_pick')} kbd="P" onClick={pickName} data-pb="pick" />
      <IconButton icon="shuffle" label={t('plan.pr_groups')} kbd="G" onClick={() => panel === 'groups' ? setPanel('') : makeGroups(gsize)} data-pb="groups" />
      <IconButton icon="note" label={t('plan.pr_notes')} kbd="N" aria-pressed={String(panel === 'notes')} onClick={() => toggle('notes')} data-pb="notes" />
      {links.length > 0 && <IconButton icon="link" label={t('plan.pr_links')} kbd="L" aria-expanded={String(panel === 'links')} onClick={() => toggle('links')} data-pb="links" />}
      <IconButton icon="eye" label={t('present.blank')} kbd="B" aria-pressed={String(blank)} onClick={() => setBlank(b => !b)} data-pb="blank" />
      <IconButton icon="slides" label={out ? t('plan.pr_out_close') : t('plan.pr_out')} kbd="W" onClick={() => popOut(st.current.key)} data-pb="out" />
      <IconButton icon="arrow" label={isFull ? t('present.full_leave') : t('present.full')} kbd="F" onClick={full} data-pb="full" />
      <span class="prtime num" title={t('present.clock')} data-raw>{clock}</span>
      <IconButton icon="x" label={t('plan.end_present')} onClick={end} /></div>
  </div>;
}
