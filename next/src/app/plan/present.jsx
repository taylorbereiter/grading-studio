// Present: the lesson's slides on the whole screen, one at a time, as the current Planner shows them (src/planner/present.js).
// Moving: arrows, Page Up and Down, space and Enter go on; Backspace goes back; Home and End; a number then Enter goes to that slide;
// a click goes on. The class's tools, each on its key as today: N speaker notes, B or . a blank screen, A the agenda, L the
// lesson's links (a number opens one), T the class timer (1 to 9 starts that many minutes, + and - add or take a minute), P picks a
// name, G makes groups (a number sets their size), F full screen. Esc closes what is open, then ends. Names come from the class's
// roster as the grading side last left it (crossings.js rosterNamesForPresent): shown, never kept.
import { h } from 'preact';
import { useState, useLayoutEffect, useEffect, useRef } from 'preact/hooks';
import { IconButton } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { rosterNamesForPresent } from '../../crossings.js';
import { nameKey } from '../../planning/plan.js';
import { Slide } from './slide.jsx';

const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
// Groups of about n, nobody left alone (src/pickshare.js pkCount, pkGroups).
function groupsOf(names, n) {
  const len = names.length; if (!len) return [];
  const up = Math.ceil(len / n), least = Math.floor(len / up), k = least >= Math.max(2, n - 1) || up === 1 ? up : Math.max(1, Math.floor(len / n));
  const out = Array.from({ length: k }, () => []); shuffle(names).forEach((x, i) => out[i % k].push(x)); return out;
}
const lines = body => String(body || '').split('\n').map(x => x.replace(/^\s*(?:[•\-*]|\d+[.)])\s*/, '').trim()).filter(Boolean);
const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const PANEL = { notes: 'plan.pr_notes', agenda: 'plan.pr_agenda', links: 'plan.pr_links', timer: 'plan.pr_timer', pick: 'plan.pr_pick', groups: 'plan.pr_groups' };

export function Present({ p, l, start = 0, className, onClose }) {
  const n = l.slides.length;
  const [i, setI] = useState(Math.max(0, Math.min(start, n - 1)));
  const [size, setSize] = useState(() => fit());
  const [panel, setPanel] = useState(''), [blank, setBlank] = useState(false), [typed, setTyped] = useState('');
  const [timer, setTimer] = useState({ left: 0, run: false }), [pick, setPick] = useState(''), [groups, setGroups] = useState([]), [gsize, setGsize] = useState(4);
  const box = useRef(null), st = useRef({}), far = useRef(i), began = useRef(Date.now()); st.current = { i, panel, typed, gsize, blank }; far.current = Math.max(far.current, i);
  function fit() { const w = window.innerWidth, hh = window.innerHeight; return Math.floor(Math.min(w, hh * 1280 / 720)); }
  const names = () => { const r = rosterNamesForPresent(), k = nameKey(className || ''); const c = r.find(x => nameKey(x.name) === k); return c ? c.names : []; };
  const links = l.links || [];
  const ag = l.slides.find((s, j) => j > 0 && s.layout === 'agenda');
  const go = d => setI(x => Math.max(0, Math.min(n - 1, x + d)));
  const toggle = k => setPanel(v => v === k ? '' : k);
  const pickName = () => { const ns = names(); setPick(ns.length ? ns[Math.floor(Math.random() * ns.length)] : ''); setPanel('pick'); };
  const makeGroups = sz => { setGsize(sz); setGroups(groupsOf(names(), sz)); setPanel('groups'); };
  const full = () => { try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (box.current && box.current.requestFullscreen) box.current.requestFullscreen().catch(() => {}); } catch {} };
  // Before the first paint, so a key pressed as soon as Present shows is not lost.
  useLayoutEffect(() => {
    const key = e => {
      const k = e.key, s = st.current;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const stop = () => { e.preventDefault(); e.stopPropagation(); };
      if (k === 'Escape') { stop(); if (s.blank) setBlank(false); else if (s.panel) setPanel(''); else if (s.typed) setTyped(''); else end(); return; }
      if (/^[0-9]$/.test(k)) {
        stop();
        if (s.panel === 'timer' && k !== '0') { setTimer({ left: +k * 60, run: true }); return; }
        if (s.panel === 'links') { const x = links[+k - 1]; if (x) window.open(x.url, '_blank', 'noopener'); return; }
        if (s.panel === 'groups' && +k >= 2) { makeGroups(+k); return; }
        setTyped(v => (v + k).slice(-3)); return;
      }
      if ((k === '+' || k === '=') && s.panel === 'timer') { stop(); setTimer(x => ({ ...x, left: x.left + 60 })); return; }
      if (k === '-' && s.panel === 'timer') { stop(); setTimer(x => ({ ...x, left: Math.max(0, x.left - 60) })); return; }
      if (k === 'Enter' && s.typed) { stop(); const m = +s.typed; setTyped(''); if (m >= 1 && m <= n) setI(m - 1); return; }
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'ArrowDown' || k === 'Enter') { stop(); go(1); return; }
      if (k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp' || k === 'Backspace') { stop(); go(-1); return; }
      if (k === 'Home') { stop(); setI(0); return; }
      if (k === 'End') { stop(); setI(n - 1); return; }
      const c = k.toLowerCase();
      if (c === 'n') { stop(); toggle('notes'); } else if (c === 'b' || c === '.') { stop(); setBlank(b => !b); } else if (c === 'a') { stop(); toggle('agenda'); }
      else if (c === 'l') { stop(); toggle('links'); } else if (c === 't') { stop(); toggle('timer'); } else if (c === 'p') { stop(); pickName(); }
      else if (c === 'g') { stop(); if (s.panel === 'groups') setPanel(''); else makeGroups(s.gsize); } else if (c === 'f') { stop(); full(); }
    };
    const rs = () => setSize(fit());
    window.addEventListener('keydown', key, true); window.addEventListener('resize', rs);
    try { if (box.current && box.current.requestFullscreen && !document.fullscreenElement) box.current.requestFullscreen().catch(() => {}); } catch {}
    const fs = () => { if (!document.fullscreenElement) setSize(fit()); };
    document.addEventListener('fullscreenchange', fs);
    if (box.current) box.current.focus();
    return () => { window.removeEventListener('keydown', key, true); window.removeEventListener('resize', rs); document.removeEventListener('fullscreenchange', fs); };
  }, [l.id]);
  // The class timer counts down once a second while it runs.
  useEffect(() => { if (!timer.run) return; const id = setInterval(() => setTimer(x => x.left <= 1 ? { left: 0, run: false } : { ...x, left: x.left - 1 }), 1000); return () => clearInterval(id); }, [timer.run]); // not-words
  function end() { try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch {} onClose(st.current.i, far.current, (Date.now() - began.current) / 1000); }
  const s = l.slides[i];
  return <div class={'present' + (blank ? ' blank' : '')} ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('plan.presenting', { title: l.title })}
    onClick={e => { if (!e.target.closest('button,a,.prpanel')) go(1); }}>
    {!blank && <Slide slide={s} lesson={l} plan={p} width={size} label={t('plan.slide_of', { n: i + 1, of: n })} />}
    {panel && !blank && <div class={'prpanel pr-' + panel} role="region" aria-label={t(PANEL[panel])}>
      {panel === 'notes' && (s.notes ? <p data-raw>{s.notes}</p> : <p class="mute">{t('plan.no_notes')}</p>)}
      {panel === 'agenda' && (ag ? <ol>{lines(ag.body).map(x => <li data-raw>{x}</li>)}</ol> : <p class="mute">{t('plan.no_agenda')}</p>)}
      {panel === 'links' && (links.length ? <ol>{links.map(x => <li><a href={x.url} target="_blank" rel="noopener" data-raw>{x.name}</a></li>)}</ol> : <p class="mute">{t('plan.no_links')}</p>)}
      {panel === 'timer' && <div class="prtimer"><b class={timer.run ? 'run' : ''}>{mmss(timer.left)}</b><p class="mute">{t('plan.timer_help')}</p></div>}
      {panel === 'pick' && (pick ? <p class="prpick" data-raw>{pick}</p> : <p class="mute">{t('plan.no_roster')}</p>)}
      {panel === 'groups' && (groups.length ? <div class="prgroups">{groups.map((g, j) => <div><b>{t('plan.group_n', { n: j + 1 })}</b><ul>{g.map(x => <li data-raw>{x}</li>)}</ul></div>)}</div> : <p class="mute">{t('plan.no_roster')}</p>)}
    </div>}
    {typed && <div class="prtyped" aria-live="polite">{t('plan.go_to_slide', { n: typed })}</div>}
    {timer.run && panel !== 'timer' && <div class="prclock" aria-live="off">{mmss(timer.left)}</div>}
    <div class="prbar"><span class="num">{t('plan.slide_of', { n: i + 1, of: n })}</span>
      <IconButton icon="chl" label={t('plan.prev_slide')} onClick={() => go(-1)} />
      <IconButton icon="chr" label={t('plan.next_slide')} onClick={() => go(1)} />
      <IconButton icon="note" label={t('plan.pr_notes')} kbd="N" onClick={() => toggle('notes')} />
      <IconButton icon="timer" label={t('plan.pr_timer')} kbd="T" onClick={() => toggle('timer')} />
      <IconButton icon="people" label={t('plan.pr_pick')} kbd="P" onClick={pickName} />
      <IconButton icon="x" label={t('plan.end_present')} onClick={end} /></div>
  </div>;
}
