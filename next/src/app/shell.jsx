// The frame every screen lives in: the sidebar (a computer), the tabs along the bottom (a phone), the command bar, notices, and
// the strip that says when this window may not save. A screen is a chunk the router loads; the shell hands it the route.
//
// The class list comes from the teacher's saved work through the layer (crossings.js classesForHome), in the order the current
// app shows them, with the same colour by place and the same "left to score" count.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { NavItem, NavSection, IconButton, Icon, CommandBar, ToastHost, toast, LOOK_LINES } from '../ui/index.js';
import { t, addLines } from '../i18n/t.js';
import * as router from './router.js';
import { addCommand, openCommandBar, loadWhenOpened } from '../services/commands.js';
import { register, start as keysStart, pieces, shortcuts } from '../services/shortcuts.js';
import * as undo from '../services/undo.js';
import { assistant } from '../services/assistant.js';
import { fullCan, fullToggle } from '../services/size.js';
import { lockState, onLockChange } from '../shared/lock.js';
import { stopped as tabsStopped, onStopped } from '../shared/tabs.js';
import { onLook, currentLook, saveLook } from '../services/theme.js';
import { LOOKS, SWATCH } from '../ui/looks.js';
import { classesForHome, todoCountForSidebar } from '../crossings.js';
import { askAdd } from './todo-add.js';
import { runner, openFocus } from './focus/bus.js';
import { usePlan } from './plan.js';
import { classTone } from './colors.js';
import { onSaved } from '../shared/saved.js';
import { sampleOn } from './sample.js';
import { useUpdate } from './update.js';
import { useSaving } from '../services/saving.js';
import { troubles, onTrouble } from './saving/trouble.js';

const TOP = [['home', 'home', 'nav.home'], ['calendar', 'cal', 'nav.calendar'], ['todo', 'todo', 'nav.todo']];
const FOOT = [['library', 'library', 'nav.library'], ['school', 'school', 'nav.school'], ['settings', 'settings', 'nav.settings'], ['help', 'help', 'nav.help']];
const TABS = [['home', 'home', 'nav.home'], ['todo', 'todo', 'nav.todo'], ['classes', 'people', 'nav.classes'], ['find', 'search', 'nav.find_short'], ['more', 'menu', 'nav.more']];
// A class's colour: the one from the timetable setup (app/colors.js), for every screen.
export { classTone } from './colors.js';

// The classes, read again whenever the teacher comes back to this window (another window may have changed them).
export function useClasses() {
  const [list, setList] = useState(null);
  useEffect(() => {
    let live = true;
    // a list that reads the same is kept as it was, so a save that changes nothing here draws nothing again
    let was = '';
    const keep = l => { const k = JSON.stringify(l); if (live && k !== was) { was = k; setList(l); } };
    const read = () => classesForHome().then(keep, e => { console.error(e); keep([]); });
    read();
    const vis = () => { if (!document.hidden) read(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('storage', read);
    // and after a save on the students' side here (a class added, a roster changed), so a new class opens at once
    const off = onSaved(e => { if (e.side === 'students' && e.kind === 'library') read(); });
    return () => { live = false; off(); document.removeEventListener('visibilitychange', vis); window.removeEventListener('storage', read); };
  }, []);
  return list;
}

// The To do count, read again with the classes.
function useTodoCount() {
  const [n, set] = useState(0);
  useEffect(() => {
    let live = true;
    const read = () => todoCountForSidebar().then(v => live && set(v), e => console.error(e));
    read();
    const vis = () => { if (!document.hidden) read(); };
    const off = onSaved(read), iv = setInterval(read, 60000);
    document.addEventListener('visibilitychange', vis); window.addEventListener('storage', read);
    return () => { live = false; off(); clearInterval(iv); document.removeEventListener('visibilitychange', vis); window.removeEventListener('storage', read); };
  }, []);
  return n;
}
// "Saved 2 min ago" at the foot of the sidebar: the last save this window made through the write functions.
function SavedLine() {
  const [at, setAt] = useState(0), [, tick] = useState(0);
  useEffect(() => { const off = onSaved(() => setAt(Date.now())), iv = setInterval(() => tick(n => n + 1), 30000); return () => { off(); clearInterval(iv); }; }, []);
  const mins = at ? Math.floor((Date.now() - at) / 60000) : -1;
  // Until a folder or Drive holds a second copy, or when the folder needs her, it says so in amber (src/folder.js whereSay, railSaved).
  const S = useSaving(), f = S && S.folder ? S.folder() : null, g = S ? S.google() : {};
  const warn = !f || sampleOn() ? '' : f.state === 'ask' ? 'saved.f_ask' : f.state === 'lost' ? 'saved.f_lost' : f.state === 'decide' ? 'saved.f_decide' : f.state === 'none' && f.booted && !g.email ? 'saved.not_backed' : '';
  return <div class="saved" role="status" data-saved={at || ''}><Icon name="check" size="xs" /><span>{mins < 0 ? t('saved.all') : mins < 1 ? t('saved.now') : t('saved.ago', { n: mins })}</span>
    {warn && <span class="sv-w" data-savewarn={f.state}>{t(warn)}</span>}</div>;
}

function useLock() {
  const [s, set] = useState(lockState().state);
  // The lock is asked for as soon as the shell is drawn, so it can answer before this effect runs: read it again once listening.
  useEffect(() => { const off = onLockChange(set); set(lockState().state); return off; }, []);
  return s;
}

function Sidebar({ route, classes, folded, onFold }) {
  const ai = assistant(), look = useLookValue(), plan = usePlan(), todo = useTodoCount();
  const on = id => route.nav === id;
  const cls = route.nav === 'class' ? route.params.id : null;
  return <nav class={'side' + (folded ? ' folded' : '')} aria-label={t('nav.main')} data-shell-nav>
    <div class="brand"><span class="logo"><Icon name="line" /></span><span class="bn">{t('app.name')}</span>
      <IconButton icon="chl" size="sm" label={t('nav.collapse')} onClick={onFold} data-focus="fold" /></div>
    <button type="button" class="find" onClick={openCommandBar}><Icon name="search" /><span>{t('nav.find')}</span><span class="fk">{pieces('mod+k').map(k => <kbd>{k}</kbd>)}</span></button>
    {TOP.map(([id, icon, line]) => <NavItem icon={icon} label={t(line)} href={router.href(id)} current={on(id)} count={id === 'todo' && todo ? todo : null} />)}
    <NavSection>{t('nav.classes')}</NavSection>
    <div class="sclasses">
      {(classes || []).map((c, i) => <NavItem color={classTone(plan, c.name, c.loose ? -1 : i)} label={c.loose ? t('nav.no_class') : <span data-raw>{c.name}</span>} count={c.left || null} href={router.href('class', c.id || '-')} current={cls === (c.id || '-')} />)}
      <NavItem icon="plus" label={t('nav.add_class')} href={router.href('class', 'new')} current={cls === 'new'} />
    </div>
    <div class="grow" />
    {FOOT.map(([id, icon, line]) => <NavItem icon={icon} label={t(line)} href={router.href(id)} current={on(id)} />)}
    {ai.link && <a class="nav" href={ai.link} target="_blank" rel="noopener"><Icon name="assist" /><span>{ai.name ? t('assistant.open_named', { name: ai.name }) : t('assistant.open_generic')}</span></a>}
    <div class="sfoot">
      <div class="swatches" role="radiogroup" aria-label={t('look.title')}>
        {LOOKS.map(n => <button type="button" role="radio" class="swt" aria-checked={String(n === look)} aria-label={t(LOOK_LINES[n][0])} style={{ '--sa': SWATCH[n][0], '--sb2': SWATCH[n][1] }} onClick={() => pickLook(n)} />)}
      </div>
      <UpdateLine />
      <SavedLine />
    </div>
  </nav>;
}
let lightWas = 'graphite';
function pickLook(n) { if (!saveLook(n)) toast(t('look.not_kept')); }
function useLookValue() {
  const [v, set] = useState(currentLook());
  useEffect(() => onLook(set), []);
  return v;
}
// The update line at the foot of the sidebar, above a phone's tabs (src/phone.js phUpd), and on More on a phone.
export function UpdateLine({ big }) {
  const u = useUpdate();
  // another window updated: the strip over the page says so (StaleStrip), and this says the version still in use
  if (!u.waiting) return big ? <p class="mute upd-none">{u.current ? t('update.current', { v: u.current }) : t('update.not_kept')}</p> : null;
  return <div class={'upd' + (big ? ' big' : '')} role="status"><Icon name="download" /><span>{t('update.ready')}</span>
    <button type="button" class="btn sm pri" onClick={u.apply} data-focus="update-now">{t('update.now')}</button></div>;
}

function Tabs({ route }) {
  const cur = route.nav === 'class' ? 'classes' : route.path === 'classes' ? 'classes' : route.nav;
  return <nav class="tabbar" aria-label={t('nav.tabs')}><UpdateLine />
    {TABS.map(([id, icon, line]) => id === 'find'
      ? <button type="button" class="tb" onClick={openCommandBar}><Icon name={icon} /><span>{t(line)}</span></button>
      : <a class="tb" href={router.href(id)} aria-current={cur === id ? 'page' : undefined}><Icon name={icon} /><span>{t(line)}</span></a>)}
  </nav>;
}

function Strip({ lock }) {
  if (lock === 'read-only') return <div class="strip" role="alert"><Icon name="info" /><span>{t('lock.read_only')}</span></div>;
  return null;
}
// Another window updated: this one stays on the older version, with its work, until she reloads it (src/safe.js, the current
// app's "Reload to update"). Over the page, so it shows while marking too.
function StaleStrip() {
  const u = useUpdate();
  return u.stale ? <div class="strip" role="status" data-upd-strip><Icon name="download" /><span>{t('update.stale')}</span>
    <button type="button" class="btn sm pri" onClick={u.reload} data-focus="update-reload">{t('update.reload')}</button></div> : null;
}
// Another window is replacing everything (Bring work in, Put back, Remove): this one stops writing and says so over the whole
// page, and reloads by itself when that is done (shared/tabs.js, as the current app's src/saving.js tabLive).
function OverCover() {
  const [on, set] = useState(tabsStopped());
  useEffect(() => { const off = onStopped(() => set(true)); set(tabsStopped()); return off; }, []);
  return on ? <div class="tabover" role="alert" data-tabover>{t('lock.over')}</div> : null;
}
// Work that didn't save: the red bar (saving/bar.jsx), loaded only then.
function SaveBar() {
  const [B, setB] = useState(null), [n, set] = useState(troubles().length);
  useEffect(() => onTrouble(() => { const k = troubles().length; set(k); if (k) router.PARTS.savebar().then(setB, e => console.error(e)); }), []);
  return n && B ? <B.SaveBar /> : null;
}
// The sample strip (app/help/sample-strip.jsx: what it is, what to try, and the way out), loaded only while the sample is open.
function SampleStrip() {
  const [S, setS] = useState(null);   // the sample opens and closes with a reload (sample.js), so once is enough
  useEffect(() => { if (sampleOn()) import('./help/sample-strip.jsx').then(setS, e => console.error(e)); }, []);
  return S && <S.SampleStrip />;
}

// The screen for a route: its chunk, loaded once. Until it arrives the old screen stays, so nothing flashes.
const loaded = {};
function Screen({ route, classes }) {
  const [, bump] = useState(0);
  const mod = loaded[route.chunk];
  useEffect(() => {
    if (mod) return;
    let live = true;
    router.CHUNKS[route.chunk]().then(m => { loaded[route.chunk] = m; if (live) bump(n => n + 1); }, e => { console.error(e); toast(t('app.chunk_failed')); });
    return () => { live = false; };
  }, [route.chunk]);
  if (!mod) return <div class="loading" aria-busy="true" />;
  const S = mod.default;
  return <S route={route} classes={classes} />;
}

export function Shell() {
  const [route, setRoute] = useState(router.current());
  const [folded, setFolded] = useState(() => { try { return sessionStorage.getItem('gsn.fold') === '1'; } catch { return false; } });
  const classes = useClasses(), lock = useLock(), main = useRef(null), first = useRef(true);
  useEffect(() => { router.setMain(main.current); router.start(); return router.onRoute(setRoute); }, []);
  // After the screen is drawn: scroll and focus back where they were on this route, or the heading on a new one.
  useEffect(() => {
    const fresh = !first.current; first.current = false;
    const id = setTimeout(() => router.restore(route.path, fresh), 30);
    document.title = t('app.title');
    return () => clearTimeout(id);
  }, [route.path, loaded[route.chunk]]);
  const fold = useCallback(() => setFolded(f => { const n = !f; try { sessionStorage.setItem('gsn.fold', n ? '1' : '0'); } catch {} return n; }), []);
  useEffect(() => {
    keysStart();
    const offs = [
      register({ id: 'undo', keys: 'mod+z', label: 'keys.undo', run: () => { const e = undo.undo(); if (e) toast(t('undo.undone', { what: e.label })); } }),
      register({ id: 'redo', keys: ['mod+shift+z', 'mod+y'], label: 'keys.redo', run: () => undo.redo() }),
      register({ id: 'fold', keys: 'mod+\\', label: 'keys.fold', run: fold }),
      register({ id: 'todo-add', keys: 'n', label: 'nav.todo_add', when: () => router.current().chunk !== 'mark', run: () => { askAdd(); router.go('todo'); } }),
      register({ id: 'full', keys: 'f', label: 'keys.full', when: () => { const r = router.current(); return fullCan() && r.chunk !== 'mark' && r.params.view !== 'present' && (!document.fullscreenElement || document.fullscreenElement === document.documentElement); }, run: fullToggle }),
      register({ id: 'keys', keys: '?', label: 'keys.show_list', run: () => router.go('help', 'keys') }),
      ...[['home', 'nav.home', 'home'], ['calendar', 'nav.calendar', 'cal'], ['todo', 'nav.todo', 'todo'], ['library', 'nav.library', 'library'], ['school', 'nav.school', 'school'], ['settings', 'nav.settings', 'settings'], ['help', 'nav.help', 'help']]
        .map(([id, line, icon]) => addCommand({ id: 'go-' + id, label: () => t(line), group: t('cmd.group_go'), icon, run: () => router.go(id) })),
      addCommand({ id: 'go-time', label: () => t('nav.time'), group: t('cmd.group_go'), icon: 'clock', run: () => router.go('time') }),
      addCommand({ id: 'focus', label: () => t('nav.focus'), group: t('cmd.group_do'), icon: 'timer', run: openFocus }),
      (loadWhenOpened(() => import('./help/find.js').then(m => addLines.ready().then(() => m.addHelpCommands(shortcuts)), e => console.error(e))), () => {}),
      (loadWhenOpened(() => router.PARTS.planFind().then(m => addLines.ready().then(() => m.addPlanCommands()), e => console.error(e))), () => {}),
      (loadWhenOpened(() => router.PARTS.planFind().then(m => addLines.ready().then(() => m.addUnitCommands()), e => console.error(e)), true), () => {}),
      (loadWhenOpened(() => router.PARTS.planFind().then(m => addLines.ready().then(() => m.addFolderCommand()), e => console.error(e)), true), () => {}),
      addCommand({ id: 'go-keys', label: () => t('keys.title'), group: t('cmd.group_go'), icon: 'keyboard', run: () => router.go('help', 'keys') }),
      // Dark mode / Light mode flips between Midnight and the light theme she had (src/planner/rail.js); Change theme picks any
      addCommand({ id: 'dark', label: () => t(currentLook() === 'midnight' ? 'cmd.light_mode' : 'cmd.dark_mode'), group: t('cmd.group_do'), icon: 'moon', run: () => { const was = currentLook(); if (was !== 'midnight') lightWas = was; pickLook(was === 'midnight' ? lightWas : 'midnight'); } }),
      addCommand({ id: 'theme', label: () => t('cmd.change_theme'), group: t('cmd.group_do'), icon: 'sun', run: () => router.go('settings', 'display') }),
      addCommand({ id: 'fold', label: () => t('keys.fold'), group: t('cmd.group_do'), icon: 'menu', keys: 'mod+\\', run: fold }),
    ];
    // the focus timer's runner and panel (app/focus/run.js): a session going on shows on every screen, and time is counted
    const fc = setTimeout(runner, 600);
    // a new school year started in Settings: the Planner's side moves on once (app/plan/setupfile.js yearMoveOn)
    let ny = null; try { ny = localStorage.getItem('gsp.newYear'); } catch {}
    if (ny) router.PARTS.setupFile().then(m => m.yearMoveOn(), e => console.error(e));
    return () => { offs.forEach(f => f()); clearTimeout(fc); };
  }, []);
  // Planning destinations, and every lesson by its title (with its class and day), so typing finds a lesson (the Planner's Search).
  const plan = usePlan();
  useEffect(() => {
    const go = (...a) => () => router.go(...a);
    const offs = [
      addCommand({ id: 'go-cal-class', label: () => t('plan.by_class'), also: t('nav.calendar'), group: t('nav.calendar'), icon: 'cal', run: go('calendar', 'class') }),
      addCommand({ id: 'go-cal-time', label: () => t('plan.by_time'), also: t('nav.calendar'), group: t('nav.calendar'), icon: 'week', run: go('calendar', 'time') }),
      addCommand({ id: 'go-cal-month', label: () => t('plan.month'), also: t('nav.calendar'), group: t('nav.calendar'), icon: 'cal', run: go('calendar', 'month') }),
      addCommand({ id: 'go-timetable', label: () => t('settings.timetable'), also: t('nav.settings'), group: t('cmd.group_go'), icon: 'cal', run: go('settings', 'timetable') }),
      ...[['activities', 'plan.lib_activities', 'spark', ''], ['past', 'plan.lib_past', 'slides', 'past'], ['units', 'plan.lib_units', 'cal', 'units'], ['rubrics', 'plan.lib_rubrics', 'grades', 'rubrics']]
        .map(([id, line, icon, tab]) => addCommand({ id: 'go-lib-' + id, label: () => t(line), also: t('nav.library'), group: t('nav.library'), icon, run: go('library', tab) })),
    ];
    const cls = id => (((plan && plan.setup && plan.setup.classes) || []).find(c => c.id === id) || {}).name || '';
    for (const l of (plan && plan.lessons) || []) {
      const s = [...(l.slots || [])].sort((a, b) => b.date.localeCompare(a.date))[0];
      offs.push(addCommand({ id: 'lesson-' + l.id, label: l.title || t('plan.untitled'), also: (s ? cls(s.classId) + ' ' + s.date : '') + ' ' + t('plan.lessons'), group: t('plan.lessons'), icon: 'slides', run: go('lesson', l.id) }));
    }
    return () => offs.forEach(f => f());
  }, [plan]);
  // The classes as commands, so typing a class's name opens it.
  useEffect(() => {
    const offs = (classes || []).map(c => addCommand({ id: 'class-' + (c.id || '-'), label: c.loose ? t('nav.no_class') : c.name, also: t('nav.classes'), group: t('nav.classes'), icon: 'people', run: () => router.go('class', c.id || '-') }));
    return () => offs.forEach(f => f());
  }, [classes]);
  return <div class={'shell' + (folded ? ' folded' : '') + (route.chunk === 'mark' ? ' marking' : '')} data-lock={lock}>
    <a class="skip" href="#main" onClick={e => { e.preventDefault(); const hd = main.current && main.current.querySelector('h1'); if (hd) { hd.setAttribute('tabindex', '-1'); hd.focus(); } }}>{t('nav.skip')}</a>
    <Sidebar route={route} classes={classes} folded={folded} onFold={fold} />
    {folded && <IconButton class="unfold" icon="menu" label={t('nav.expand')} onClick={fold} />}
    <div class="mainwrap">
      <SampleStrip />
      <SaveBar />
      <StaleStrip />
      <Strip lock={lock} />
      <OverCover />
      <main id="main" ref={main} class="main" data-route={route.path}><Screen route={route} classes={classes} /></main>
    </div>
    <Tabs route={route} />
    <CommandBar />
    <ToastHost />
  </div>;
}
