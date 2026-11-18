// Pick a name, make groups (src/pickshare.js): one screen the class can read, from the class header and the seating chart.
// Nobody is picked twice until everyone here has had a turn. Groups are dealt as evenly as they go (the lifted pkGroups, which
// keeps the same students apart from last time), or made by hand: click a name and then a group (or a name in another group, to
// swap them), or drag it. Who's here leaves students out for now. Nothing here is saved: who has had a turn, who is away and the
// groups are remembered until the page is closed. Keys: P pick, G groups, W who's here, Space again, 2 to 8 the size, Ctrl Z undo,
// F full screen, Esc close.
import { h, Fragment } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { t } from '../../i18n/t.js';
import { engine as B, fullLibrary } from '../../students/book.js';
import { copyText } from '../../services/clipboard.js';
import './lines.js';

const MEM = new Map();
function memOf(c) {
  const k = c.id + '|' + c.names.length;
  if (!MEM.has(k)) MEM.set(k, { away: new Set(), bag: [], turns: 0, last: '', again: false, by: 'size', n: 4, groups: null, pool: [], hand: false, undo: [], sel: null });
  return MEM.get(k);
}
const where = (m, n) => { for (let g = 0; g < (m.groups || []).length; g++) { const i = m.groups[g].indexOf(n); if (i >= 0) return { g, i }; } const i = m.pool.indexOf(n); return i >= 0 ? { g: -1, i } : null; };
const list = (m, g) => (g < 0 ? m.pool : m.groups[g]);
const take = (m, n) => { const w = where(m, n); if (w) list(m, w.g).splice(w.i, 1); return w; };
const snap = m => { m.undo.push({ groups: m.groups ? m.groups.map(g => g.slice()) : null, pool: m.pool.slice(), hand: m.hand }); if (m.undo.length > 40) m.undo.shift(); };

// classes: [{ id, name, names }]; mode: 'pick' or 'groups'.
export function Picker({ classes, at = 0, mode: first = 'pick', onClose }) {
  const [ci, setCi] = useState(Math.max(0, Math.min(classes.length - 1, at))), c = classes[ci];
  const [mode, setMode] = useState(first === 'groups' ? 'groups' : 'pick'), [who, setWho] = useState(false), [shown, setShown] = useState(''), [say, setSay] = useState(''), [, bump] = useState(0);
  const m = memOf(c), here = c.names.filter(n => !m.away.has(n)), el = useRef(null), spin = useRef(0), back = useRef(document.activeElement), drag = useRef(null);
  const redraw = () => bump(v => v + 1);
  const next = () => {
    clearInterval(spin.current);
    if (!here.length) { m.last = ''; setShown(''); return; }
    m.bag = m.bag.filter(n => here.includes(n)); m.again = false;
    if (!m.bag.length) { m.bag = B.pkShuffle(here); m.again = m.turns > 0; m.turns = 0; if (m.bag.length > 1 && m.bag[m.bag.length - 1] === m.last) m.bag.reverse(); }
    const name = m.bag.pop(); m.last = name; m.turns++;
    const still = here.length < 2 || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || window.__pkFast;
    if (still) { setShown(name); setSay(B.pkNice(name)); return; }
    let ticks = 0; setShown('\u0000' + here[Math.floor(Math.random() * here.length)]);
    spin.current = setInterval(() => { if (++ticks >= 9) { clearInterval(spin.current); setShown(name); setSay(B.pkNice(name)); return; } setShown('\u0000' + here[Math.floor(Math.random() * here.length)]); }, 70);
  };
  const deal = () => { if (m.groups) snap(m); m.groups = B.pkGroups(here, m.by, m.n, m.groups); m.pool = []; m.hand = false; m.sel = null; setSay(t('class.pk_n_groups', { n: m.groups.length })); redraw(); };
  const run = fresh => { if (mode === 'pick') { if (fresh) next(); } else if (fresh || !m.groups) deal(); };
  useEffect(() => { if (mode === 'pick') next(); else if (!m.groups) deal(); }, [ci]);
  useEffect(() => { const box = el.current; box && box.focus(); return () => { clearInterval(spin.current); try { if (box && document.fullscreenElement === box) document.exitFullscreen().catch(() => {}); } catch {} const b = back.current; if (b && b.isConnected && b.focus) try { b.focus({ preventScroll: true }); } catch {} }; }, []);
  const toPick = () => { const was = mode; setMode('pick'); if (was === 'pick' || !m.last) next(); else setShown(m.last); };
  const toGroups = () => { const was = mode; setMode('groups'); if (was === 'groups' || !m.groups) deal(); };
  const undo = () => { const u = m.undo.pop(); if (!u) return; const ok = n => !m.away.has(n) && c.names.includes(n); m.groups = u.groups ? u.groups.map(g => g.filter(ok)) : null; m.pool = u.pool.filter(ok); m.hand = u.hand; m.sel = null; setSay(t('class.pk_undone')); redraw(); };
  const mine = () => { snap(m); m.groups = Array.from({ length: m.groups && m.groups.length ? m.groups.length : Math.max(1, B.pkCount(here.length, m.by, m.n)) }, () => []); m.pool = here.slice(); m.hand = true; m.sel = null; redraw(); };
  const addGroup = () => { snap(m); if (!m.groups) m.groups = []; m.groups.push([]); m.hand = true; redraw(); };
  const dropGroup = i => { if (m.groups && m.groups[i] && !m.groups[i].length) { snap(m); m.groups.splice(i, 1); m.hand = true; redraw(); } };
  const gName = g => (g < 0 ? t('class.pk_pool') : t('class.pk_group_n', { n: g + 1 }));
  const move = (n, g, before) => {
    const from = where(m, n); if (!from || !(g < 0 ? m.hand : m.groups && m.groups[g])) return;
    if (from.g === g && !before) { m.sel = null; return redraw(); }
    snap(m); take(m, n); const to = list(m, g), i = before ? to.indexOf(before) : -1; if (i >= 0) to.splice(i, 0, n); else to.push(n);
    m.hand = true; m.sel = null; setSay(t('class.pk_moved', { name: B.pkNice(n), to: gName(g) })); redraw();
  };
  const swap = (a, b) => { const x = where(m, a), y = where(m, b); if (!x || !y) return; snap(m); list(m, x.g)[x.i] = b; list(m, y.g)[y.i] = a; m.hand = true; m.sel = null; setSay(t('class.pk_swapped', { a: B.pkNice(a), b: B.pkNice(b) })); redraw(); };
  const nameClick = n => { const a = where(m, n), b = m.sel ? where(m, m.sel) : null; if (m.sel && m.sel !== n && a && b && a.g !== b.g) return swap(m.sel, n); m.sel = m.sel === n ? null : n; redraw(); };
  const away = n => {
    if (m.away.has(n)) m.away.delete(n); else m.away.add(n);
    // groups made by hand stay: someone away leaves their group, someone back waits to be put in one
    if (m.hand && m.groups) { if (m.away.has(n)) take(m, n); else if (!where(m, n)) m.pool.push(n); if (m.sel === n) m.sel = null; return redraw(); }
    m.groups = null; if (mode === 'groups') deal(); else redraw();
  };
  const copy = () => copyText((m.groups || []).map((g, i) => (g.length ? t('class.pk_group_n', { n: i + 1 }) + ': ' + g.map(B.pkNice).join(', ') : '')).filter(Boolean).join('\n')).then(ok => setSay(ok ? t('class.mb_copied') : t('class.copy_failed')));
  const full = () => { try { (document.fullscreenElement ? document.exitFullscreen() : el.current.requestFullscreen()).catch(() => {}); } catch {} };
  const key = e => {
    e.stopPropagation();
    const k = e.key, ch = k.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && ch === 'z') { e.preventDefault(); if (mode === 'groups') undo(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey || k === 'Tab') return;
    if (e.target && e.target.tagName === 'SELECT' && k !== 'Escape') return;
    const nmEl = (k === ' ' || k === 'Enter') && e.target && e.target.closest && e.target.closest('[data-pk-s]');
    if (nmEl) { e.preventDefault(); nameClick(nmEl.dataset.pkS); return; }
    if ((k === ' ' || k === 'Enter') && e.target && e.target.closest && e.target.closest('button')) return;
    e.preventDefault();
    if (k === 'Escape') { if (who) setWho(false); else if (m.sel && mode === 'groups') { m.sel = null; redraw(); } else onClose(); return; }
    if (k === ' ' || k === 'Enter') run(true);
    else if (ch === 'p') toPick(); else if (ch === 'g') toGroups(); else if (ch === 'w') setWho(!who); else if (ch === 'f') full();
    else if (mode === 'groups' && /^[2-8]$/.test(k)) { m.n = +k; deal(); }
  };
  // the keys are the stage's while it is open, wherever the focus is (src/pickshare.js pkKeyOwn)
  const keyRef = useRef(null); keyRef.current = key;
  useEffect(() => { const k = e => keyRef.current(e); document.addEventListener('keydown', k, true); return () => document.removeEventListener('keydown', k, true); }, []);
  // Dragging a name to another group
  const down = e => {
    const s = e.target.closest && e.target.closest('[data-pk-s]'); if (!s || mode !== 'groups' || (e.button != null && e.button > 0)) return;
    const n = s.dataset.pkS, x0 = e.clientX, y0 = e.clientY; let ghost = null, over = null;
    const at = ev => { ghost.hidden = true; const t2 = document.elementFromPoint(ev.clientX, ev.clientY); ghost.hidden = false; return t2 ? { g: t2.closest('[data-pk-g]'), s: t2.closest('[data-pk-s]') } : {}; };
    const mv = ev => { if (!ghost) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return; ghost = document.createElement('div'); ghost.className = 'pk-ghost'; ghost.textContent = B.pkNice(n); el.current.appendChild(ghost); }
      ev.preventDefault(); ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; const o = at(ev).g; if (o !== over) { if (over) over.classList.remove('over'); over = o; if (over) over.classList.add('over'); } };
    const up = ev => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      if (!ghost) return; const o = ev.type === 'pointerup' ? at(ev) : {}; ghost.remove(); if (over) over.classList.remove('over'); drag.current = Date.now();
      if (o.g) move(n, +o.g.dataset.pkG, o.s && o.s.dataset.pkS !== n ? o.s.dataset.pkS : null); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  };
  const nice = shown.startsWith('\u0000') ? B.pkNice(shown.slice(1)) : B.pkNice(shown), done = !shown.startsWith('\u0000');
  const g = m.groups || [], rows = Math.max(1, Math.round(Math.sqrt(g.length / 1.6))), cols = Math.max(1, Math.ceil(g.length / rows)), most = Math.max(1, ...g.map(x => x.length));
  const long = Math.max(8, ...g.flat().concat(m.hand ? m.pool : []).map(n => [...B.pkNice(n)].length)), fs = Math.max(1.5, Math.min(4.6, (m.hand ? 54 : 70) / (rows * (most + 1.9)) / 1.3)), fw = Math.max(0.8, (90 / cols - 3) / (long * 0.6));
  const fsz = 'min(' + fs.toFixed(2) + 'vh,' + fw.toFixed(2) + 'vw)';
  const nm = n => <div class={'pk-s' + (m.sel === n ? ' sel' : '')} role="button" tabIndex={0} onClick={() => { if (Date.now() - (drag.current || 0) > 400) nameClick(n); }} data-pk-s={n} data-raw>{B.pkNice(n)}</div>;
  const groupClick = (e, i) => { if (m.sel && !e.target.closest('[data-pk-s]') && !e.target.closest('button')) move(m.sel, i, null); };
  const b = (k, label, on, more = {}) => <button type="button" onClick={on} data-pk={k} {...more}>{label}</button>;
  return <div class="pk" ref={el} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t(mode === 'pick' ? 'class.pk_pick' : 'class.pk_groups')} onPointerDown={down} onClick={e => e.stopPropagation()} data-picker>
    <div class={'pk-main ' + (mode === 'pick' ? 'pick' : 'groups')}>
      <div class="pk-cls" data-raw>{c.name}</div>
      {mode === 'pick' ? <>
        <div class={'pk-name' + (done ? ' done' : '')} style={{ fontSize: 'min(15vh,' + (150 / Math.max(6, [...nice].length)).toFixed(1) + 'vw)' }} data-pk-name data-raw>{nice || '–'}</div>
        <div class="pk-sub">{!here.length ? t('class.pk_nobody') : !done ? '' : (m.again ? t('class.pk_again_all') + ' ' : '') + t('class.pk_n_of', { n: m.turns, of: here.length })}</div>
      </> : g.length || m.pool.length ? <>
        {m.hand && <div class="pk-pool" data-pk-g="-1" style={{ '--fs': fsz }} onClick={e => groupClick(e, -1)}><h3>{t('class.pk_pool')}</h3><div class="pk-pl">{m.pool.length ? m.pool.map(nm) : <p class="pk-empty">{t('class.pk_all_in')}</p>}</div></div>}
        <div class="pk-groups" style={{ '--cols': cols, '--fs': fsz }} data-pk-groups>{g.map((x, i) => <section class="pk-g" data-pk-g={i} onClick={e => groupClick(e, i)}><h3>{t('class.pk_group_n', { n: i + 1 })}</h3>
          {x.length ? x.map(nm) : <><p class="pk-empty">{t('class.pk_drag_here')}</p><button type="button" class="pk-gx" aria-label={t('class.pk_drop_group', { n: i + 1 })} onClick={() => dropGroup(i)}>×</button></>}</section>)}</div>
      </> : <div class="pk-sub">{t('class.pk_nobody')}</div>}
    </div>
    {who && <aside class="pk-who" aria-label={t('class.pk_who')}><button type="button" class="pk-wx" onClick={() => setWho(false)}>{t('class.done')}</button><h2>{t('class.pk_who')}</h2><p>{t('class.pk_who_say')}</p>
      <div class="pk-wl">{c.names.map((n, i) => <button type="button" aria-pressed={String(!m.away.has(n))} onClick={() => away(n)} data-pk-w={i} data-raw>{B.pkNice(n)}</button>)}</div></aside>}
    <div class="pk-bar" role="toolbar" aria-label={t('class.pk_tools')}>
      {classes.length > 1 && <><select aria-label={t('class.pk_class')} value={ci} onChange={e => { setCi(+e.currentTarget.value); setWho(false); }}>{classes.map((k, i) => <option value={i}>{k.name}</option>)}</select><span class="pk-sep" /></>}
      {b('pick', t('class.pk_pick'), toPick, { 'aria-pressed': String(mode === 'pick'), title: 'P' })}{b('groups', t('class.pk_groups'), toGroups, { 'aria-pressed': String(mode === 'groups'), title: 'G' })}<span class="pk-sep" />
      {mode === 'pick' ? <>{b('again', t('class.pk_pick_again'), () => next(), { class: 'pk-go', title: 'Space' })}{b('reset', t('class.pk_start_over'), () => { m.bag = []; m.turns = 0; m.last = ''; next(); })}</>
        : <><span class="pk-seg" role="group" aria-label={t('class.pk_how')}>{[['size', 'class.pk_by_size'], ['count', 'class.pk_by_count']].map(([v, l]) => <button type="button" aria-pressed={String(m.by === v)} onClick={() => { m.by = v; deal(); }} data-pk-by={v}>{t(l)}</button>)}</span>
          <span class="pk-seg" role="group" aria-label={t(m.by === 'size' ? 'class.pk_in_group' : 'class.pk_groups')}>{[2, 3, 4, 5, 6, 7, 8].map(n => <button type="button" aria-pressed={String(m.n === n)} onClick={() => { m.n = n; deal(); }} data-pk-n={n}>{n}</button>)}</span>
          {b('again', t('class.pk_shuffle'), deal, { class: 'pk-go', title: 'Space' })}{b('hand', t('class.pk_mine'), mine)}{b('addg', t('class.pk_add_group'), addGroup)}
          {m.undo.length > 0 && b('undo', t('class.pk_undo'), undo, { title: t('class.pk_key_undo') })}{b('copy', t('class.pk_copy'), copy)}</>}
      <span class="pk-sep" />{b('who', m.away.size ? t('class.pk_who_away', { n: m.away.size }) : t('class.pk_who'), () => setWho(!who), { 'aria-pressed': String(who), title: 'W' })}
      {b('full', t('class.pk_full'), full, { title: 'F' })}<button type="button" class="pk-end" onClick={onClose} data-pk="close">{t('class.close_esc')}</button>
    </div>
    <div class="pk-say" aria-live="polite">{say}</div>
  </div>;
}

// From the class header: every class with a roster, starting on this one.
export function PickerFor({ classId, mode, onClose }) {
  const [list] = useState(() => fullLibrary().classes.filter(k => k.names.length).map(k => ({ id: String(k.id), name: k.name, names: k.names.slice() })));
  if (!list.length) { onClose(); return null; }
  return <Picker classes={list} at={Math.max(0, list.findIndex(k => k.id === String(classId)))} mode={mode} onClose={onClose} />;
}
