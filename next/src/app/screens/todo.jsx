// To do (src/todo.js): the teacher's own lines beside the ones the app noticed in her work, as a list (by day or by category) or
// as a week. Solid circles are hers, dashed ones the app's (they go by themselves when the work is done; ticking one hides it).
// Every change is one step Undo takes back, saved in the library as the current app saves it (students/todo.js todoChange), so
// the current app opens the same list. Which view is shown is this browser's choice (gs.tdBy, as the current app keeps it).
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, IconButton, Icon, Switch, Mic, Dialog, TextInput, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { href, go } from '../router.js';
import * as undoList from '../../services/undo.js';
import { onSaved } from '../../shared/saved.js';
import { readTodo, todoChange, engine as E } from '../../students/todo.js';
import { appLinesForTodo } from '../../crossings.js';
import { toneOf } from '../tone.js';
import { takeAdd, onAdd } from '../todo-add.js';
import LINES from '../../../lang/todo.en.json';
import { addLines } from '../../i18n/t.js';
addLines(LINES);

const KINDS = [['mark', 'todo.k_mark'], ['back', 'todo.k_back'], ['plan', 'todo.k_plan'], ['miss', 'todo.k_miss']];
const EG = { grade: 'conferences', plan: 'labs', admin: 'IEP', role: 'tech' };   // not-words: examples of a teacher's own words
const CAT_LINE = { grade: 'todo.cat_grade', plan: 'todo.cat_plan', admin: 'todo.cat_admin', role: 'todo.cat_role' }, REP_LINE = { day: 'todo.r_day', week: 'todo.r_week', meet: 'todo.r_meet' };
const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch {} return null; };
const at = d => new Date(d + 'T12:00:00');
const dayLong = d => date(at(d), { weekday: 'short', month: 'short', day: 'numeric' });
const dayShort = d => date(at(d), { month: 'short', day: 'numeric' });
// A day in the fewest words: Today, Tomorrow, the weekday within a week either way, else the date (src/todo.js tdDaySay).
function daySay(d, today) {
  if (!d) return '';
  const n = E.tdGap(d, today);
  return n === 0 ? t('todo.today') : n === 1 ? t('todo.tomorrow') : n > -7 && n < 7 ? date(at(d), { weekday: 'short' }) : dayShort(d);
}
const catName = c => (c.own || !CAT_LINE[c.id] ? c.name : t(CAT_LINE[c.id]));
const raw = s => <span data-raw>{s}</span>;

function useTodo() {
  const [v, set] = useState(null);
  useEffect(() => {
    let live = true, tok = 0;
    const read = () => { const k = ++tok; appLinesForTodo().then(readTodo).then(x => { if (live && k === tok) set(x); }, e => { console.error(e); if (live) set({ error: true }); }); };
    read();
    const off = onSaved(e => { if (e.side === 'students') read(); });
    const other = e => { if (!e.key || e.key === 'gs.lib' || e.key.startsWith('gsp.') || e.key === 'gs.school') read(); };
    const vis = () => { if (!document.hidden) read(); };
    window.addEventListener('storage', other); document.addEventListener('visibilitychange', vis);
    const iv = setInterval(read, 60000);
    return () => { live = false; off(); clearInterval(iv); window.removeEventListener('storage', other); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return v;
}

export default function Todo({ route, classes }) {
  const v = useTodo(), week = route.params && route.params.view === 'week';
  const [sel, setSel] = useState(''), [filter, setFilter] = useState('all'), [showDone, setShowDone] = useState(false), [by, setBy] = useState(() => pref('gs.tdBy') === 'cat' ? 'cat' : 'day');
  if (!v) return <div class="loading" aria-busy="true" />;
  if (v.error) return <p class="mute">{t('home.read_failed')}</p>;
  const today = E.tdToday(), { lib, plan, people } = v;
  E.todoUse({ lib, plan, people });
  const cls = id => lib.classes.find(c => String(c.id) === String(id)) || null;
  const tone = c => { if (!c) return 'var(--g500)'; const k = E.tdKey(c.name), p = plan && plan.classes.find(x => E.tdKey(x.name) === k); return p ? toneOf(p.color) : 'var(--c' + ((lib.classes.indexOf(c) % 8) + 1) + ')'; };
  const rows = v.rows.map(r => r.auto ? { ...r, x: autoTitle(r, cls), sub: autoSub(r, cls) } : r);
  const all = rows, pf = filter.startsWith('p:') ? filter.slice(2) : '';
  const f = filter !== 'all' && filter !== 'mine' && !(pf ? people.some(p => p.id === pf) : cls(filter)) ? 'all' : filter;
  const shown = all.filter(x => f === 'all' || (f === 'mine' ? x.own : pf ? x.own && (x.it.ppl || []).includes(pf) : String(x.classId) === String(f)));
  const g = E.tdGroups(shown, today), nDone = E.tdGroups(all, today).done.length;
  const late = all.filter(x => !x.done && x.d && x.d < today).length, now = all.filter(x => !x.done && x.d === today).length;
  const say = late || now ? [late ? t('todo.say_late', { n: late }) : '', now ? t('todo.say_now', { n: now }) : ''].filter(Boolean).join(', ') + '.' : all.some(x => !x.done) ? t('todo.say_nothing_today') : t('todo.say_empty');
  const picked = sel ? all.find(x => x.id === sel) || null : null;
  const ctx = { today, lib, plan, people, cls, tone, sel, setSel: id => setSel(s => (s === id ? '' : id)), filter: f };
  const named = people.filter(p => f === 'p:' + p.id || all.some(x => x.own && !x.done && (x.it.ppl || []).includes(p.id)));
  const fp = pf && people.find(p => p.id === pf);
  return <div class={'tdpage' + (week ? ' wk' : '')} data-todo>
    <header class="tdhead">
      <div><h1 tabIndex={-1}>{t('todo.title')}</h1><p class="mute">{t('todo.say')}</p></div>
      <span class="grow" />
      <Button icon={week ? 'todo' : 'week'} onClick={() => go(...(week ? ['todo'] : ['todo', 'week']))} data-td-view>{week ? t('todo.see_list') : t('todo.see_week')}</Button>
    </header>
    <div class="tdgrid">
      <div class="tdmainc">
        <Adder ctx={ctx} />
        <p class="tdsay" data-td-say>{say}</p>
        <div class="tdchips" role="group" aria-label={t('todo.filter')} data-td-chips>
          <FChip on={f === 'all'} k="all" set={setFilter}>{t('todo.everything')}</FChip><FChip on={f === 'mine'} k="mine" set={setFilter}>{t('todo.only_mine')}</FChip>
          {lib.classes.map(c => <FChip on={f === String(c.id)} k={String(c.id)} set={setFilter} color={tone(c)}>{raw(c.name)}</FChip>)}
          {named.length > 0 && <span class="tdcsep" aria-hidden="true" />}
          {named.map(p => <FChip on={f === 'p:' + p.id} k={'p:' + p.id} set={setFilter} icon="user">{raw(p.name)}</FChip>)}
        </div>
        {fp && <div class="tdpbar" data-td-person><Icon name="user" size="xs" /><b data-raw>{fp.name}</b>{fp.role && raw(' · ' + fp.role)}
          {fp.email && <a class="btn sm" href={'mailto:' + encodeURIComponent(fp.email)}><Icon name="mail" size="xs" />{t('todo.email')}</a>}<a class="link" href={href('school')}>{t('todo.on_school')}</a></div>}
        {week ? <Week ctx={ctx} rows={shown} /> : <>
          <div class="tdbar">
            <div class="seg sm" role="radiogroup" aria-label={t('todo.by')}>{[['day', 'todo.by_day'], ['cat', 'todo.by_cat']].map(([k, l]) => <button type="button" role="radio" aria-checked={String(by === k)} onClick={() => { setBy(k); pref('gs.tdBy', k); }} data-td-by={k}>{t(l)}</button>)}</div>
            <span class="grow" />
            {nDone > 0 && <Button size="sm" variant="quiet" aria-pressed={String(showDone)} onClick={() => setShowDone(x => !x)} data-td-done>{t(showDone ? 'todo.hide_done' : 'todo.show_done', { n: nDone })}</Button>}
          </div>
          <List ctx={ctx} g={g} by={by} showDone={showDone} empty={f === 'all' ? t('todo.none') : t('todo.none_view')} />
        </>}
      </div>
      <aside class="tdaside" aria-label={t('todo.title')}>
        {picked ? <Pane key={picked.id} ctx={ctx} r={picked} close={() => setSel('')} /> : !week && <><Kinds lib={lib} /><Cats /></>}
      </aside>
    </div>
  </div>;
}
const FChip = ({ on, k, set, color, icon, children }) => <button type="button" class="chip" aria-pressed={String(on)} onClick={() => set(k)} data-td-f={k}>
  {color && <span class="dot" style={{ '--cc': color }} />}{icon && <Icon name={icon} size="xs" />}{children}</button>;

// What the app's lines say (src/todo.js todoAuto), in the app's language.
function autoTitle(r, cls) {
  const name = r.name || t('todo.student_work'), c = cls(r.classId);
  if (r.kind === 'mark') return t(r.fm ? 'todo.a_feedback' : r.began ? 'todo.a_finish' : 'todo.a_mark', { name });
  if (r.kind === 'back') return t('todo.a_back', { name });
  if (r.kind === 'plan') return r.in === 0 ? t('todo.a_plan_today', { cls: r.pname }) : r.in === 1 ? t('todo.a_plan_tomorrow', { cls: r.pname }) : t('todo.a_plan_day', { cls: r.pname, day: date(at(r.day), { weekday: 'long' }) });
  return t('todo.a_miss', { n: r.n, cls: c ? c.name : '' });
}
function autoSub(r, cls) {
  const c = cls(r.classId), cn = c ? c.name : '';
  if (r.kind === 'mark') return [cn, r.fm ? t('todo.s_feedback') + (r.done ? ' · ' + t('todo.s_left', { left: r.left, of: r.of }) : '') : r.began ? t('todo.s_left', { left: r.left, of: r.of }) : t('todo.s_not_started', { n: r.of })].filter(Boolean).join(' · ');
  if (r.kind === 'back') return [cn, t('todo.s_ready', { n: r.of })].filter(Boolean).join(' · ');
  if (r.kind === 'plan') return [r.start, r.lesson || t('todo.s_nothing_planned')].filter(Boolean).join(' · ');
  return cn;
}
const autoBtn = r => r.kind === 'mark' ? [r.began || r.fm ? 'todo.b_continue' : 'todo.b_start', href('mark', r.open)] : r.kind === 'back' ? ['todo.b_return', href('mark', r.open, 'return')]
  : r.kind === 'plan' ? ['todo.b_plan', href('class', r.pid)] : ['todo.b_see_who', href('class', r.classId, 'todo')];

// Ticking: her line is done (or not after all); the app's line is hidden until the work changes.
async function tick(r) {
  if (r.auto) { await todoChange(t('todo.u_hide'), E => E.tdAutoPut(r.key, { h: r.sig })); toast(t('todo.hidden'), { undo: () => undoList.undo() }); return; }
  await todoChange(t('todo.u_tick'), E => E.todoTick(r.id));
}
const put = (id, part) => todoChange(t('todo.u_change'), E => E.tdPut(id, part), null, false);
const autoPut = (key, part) => todoChange(t('todo.u_move'), E => E.tdAutoPut(key, part));
async function remove(id) {
  await todoChange(t('todo.u_delete'), E => E.tdSave({ items: E.tdData().items.map(x => (x.id === id ? { id, t: Date.now(), gone: 1 } : x)) }));
  toast(t('todo.deleted'), { undo: () => undoList.undo() });
}
function Check({ r }) {
  const done = !!r.done;
  return <button type="button" class={'tdck' + (r.auto ? ' app' : '') + (done ? ' done' : '')} onClick={() => tick(r)} data-td-tick={r.id}
    {...(r.auto ? { title: t('todo.hide_tip'), 'aria-label': t('todo.hide_aria', { what: r.x }) } : { role: 'checkbox', 'aria-checked': String(done), 'aria-label': r.x, title: done ? t('todo.undone_tip') : t('todo.done') })}>
    {done && <Icon name="check" size="xs" />}</button>;
}
function Row({ ctx, r, cat }) {
  const { today, cls, tone } = ctx, done = !!r.done, late = !done && r.d && r.d < today;
  const due = done ? t('todo.done') : late ? t('todo.was_due', { day: daySay(r.d, today) }) : daySay(r.d, today);
  const c = cls(r.classId), k = cat ? E.tdCat(E.tdCatOf(r).id) : null, it = r.it;
  const a = it && it.a && c ? c.units.flatMap(u => u.items).find(i => i.id === it.a) : null;
  const ppl = it ? (it.ppl || []).map(id => ctx.people.find(p => p.id === id)).filter(Boolean) : [];
  const meta = r.auto ? [<span class="tdtag">{t('todo.from_work')}</span>, r.kind !== 'plan' && c && <span class="tdc"><span class="dot" style={{ '--cc': tone(c) }} />{raw(c.name)}</span>, raw(r.kind === 'plan' ? r.sub : r.sub.slice(c ? c.name.length + 3 : 0))]
    : [c && <span class="tdc"><span class="dot" style={{ '--cc': tone(c) }} />{raw(c.name)}</span>, it.who && raw(it.who), ...ppl.map(p => <span class="tdp"><Icon name="user" size="xs" />{raw(p.name)}</span>), a && raw(a.name), REP_LINE[it.rep] && <span>{t(REP_LINE[it.rep])}</span>, it.note && <span>{t('todo.note')}</span>];
  if (k) meta.push(<span class="tdcat">{k.own ? raw(k.name) : catName(k)}</span>);
  const [bl, bh] = r.auto ? autoBtn(r) : [];
  return <li class={'tdl' + (done ? ' done' : '') + (r.auto ? ' auto' : '') + (ctx.sel === r.id ? ' sel' : '')} data-td-row={r.id}>
    <Check r={r} />
    <button type="button" class="tdmain" onClick={() => ctx.setSel(r.id)} aria-expanded={String(ctx.sel === r.id)}><span class="tdx" data-raw>{r.x}</span>
      <span class="tdm">{meta.filter(Boolean)}{!r.auto && due && <span class={late ? 'late' : ''} data-td-due>{due}</span>}</span></button>
    {r.auto && <a class="btn sm" href={bh} data-td-go={r.id}>{t(bl)}</a>}
    {r.auto && <span class="tddue" data-td-due>{due}</span>}
  </li>;
}
function List({ ctx, g, by, showDone, empty }) {
  const sec = (k, name, list, attrs = {}) => list.length ? <section class={'tdg' + (k === 'late' ? ' late' : '')} data-td-group={k} {...attrs}>
    <h2 class="tdgh">{name}<span class="n">{k === 'done' ? list.length : list.filter(x => !x.done).length}</span></h2>
    <ul class="tdul">{list.map(r => <Row ctx={ctx} r={r} cat={by !== 'cat'} />)}</ul></section> : null;
  let out;
  if (by === 'cat') {
    const live = [...g.late, ...g.now, ...g.week, ...g.later], m = new Map(), order = l => l.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || E.tdSort(a, b));
    for (const r of live) { const k = E.tdCatOf(r).id; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
    out = [...E.tdCats().map(c => sec('cat:' + c.id, c.own ? raw(c.name) : catName(c), order(m.get(c.id) || []))), sec('cat:', t('todo.no_cat'), order(m.get('') || [])), showDone && sec('done', t('todo.g_done'), g.done)];
  } else out = [sec('late', t('todo.g_late'), g.late), sec('now', t('todo.g_now'), g.now), sec('week', t('todo.g_week'), g.week), sec('later', t('todo.g_later'), g.later), showDone && sec('done', t('todo.g_done'), g.done)];
  out = out.filter(Boolean);
  return out.length ? <div class="tdlist" data-td-list>{out}</div> : <p class="tdnone mute" data-td-none>{empty}</p>;
}

// The box at the top: a line the way she would say it. What it understood shows under it, each piece taken off with a click.
function Adder({ ctx }) {
  const [text, setText] = useState(''), [drop, setDrop] = useState({}), box = useRef(null);
  useEffect(() => { const focus = () => { if (box.current) { box.current.focus(); box.current.select(); } }; if (takeAdd()) focus(); return onAdd(focus); }, []);
  const r = text.trim() ? E.todoRead(text, ctx.today) : null, c = r && r.c ? ctx.cls(r.c) : null, parts = [];
  const off = k => () => { setDrop(d => ({ ...d, [k]: 1 })); box.current && box.current.focus(); };
  if (r) {
    if (r.d && !drop.d) parts.push(<button type="button" class="chip" aria-pressed="true" title={t('todo.not_day')} onClick={off('d')} data-td-drop="d">{raw(dayLong(r.d) + (r.rep ? ' · ' : ''))}{r.rep && t('todo.every_week')}</button>);
    if (c && !drop.c) parts.push(<button type="button" class="chip" title={t('todo.not_class')} onClick={off('c')} data-td-drop="c"><span class="dot" style={{ '--cc': ctx.tone(c) }} />{raw(c.name)}</button>);
    if (c && r.who && !drop.c && !drop.who) parts.push(<button type="button" class="chip" title={t('todo.not_student')} onClick={off('who')} data-td-drop="who">{raw(r.who)}</button>);
    if (!drop.p) for (const p of r.ppl.map(id => ctx.people.find(x => x.id === id)).filter(Boolean)) parts.push(<button type="button" class="chip" title={t('todo.not_person', { name: p.name })} onClick={off('p')} data-td-drop="p"><Icon name="user" size="xs" />{raw(p.name)}</button>);
    const k = !drop.k ? E.tdCat(E.tdGuess(r.x)) : null;
    if (k) parts.push(<button type="button" class="chip" title={t('todo.not_cat')} onClick={off('k')} data-td-drop="k">{k.own ? raw(k.name) : catName(k)}</button>);
  }
  const add = async e => {
    e.preventDefault(); const v = text; if (!v.trim()) return;
    const pf = ctx.filter.startsWith('p:') ? ctx.filter.slice(2) : '', cf = ctx.cls(ctx.filter) ? ctx.filter : '';
    setText(''); setDrop({});
    await todoChange(t('todo.u_add'), E => { const it = E.todoAdd(v, drop, pf ? { ppl: [pf] } : null); if (it && cf && !it.c) E.tdPut(it.id, { c: cf }); return it; }, ctx.plan);
    box.current && box.current.focus();
  };
  return <form class="tdadder" onSubmit={add} data-td-adder>
    <Icon name="plus" />
    <input ref={box} value={text} onInput={e => { const x = e.currentTarget.value; setText(x); if (!x.trim()) setDrop({}); }} placeholder={t('todo.add_ph')} aria-label={t('todo.add')} maxLength={300} data-td-new />
    <Mic onText={w => setText(x => (x ? x.replace(/\s*$/, ' ') : '') + w)} /><kbd class="enter">↵</kbd>
    {parts.length > 0 && <div class="tdparse" data-td-parse><span class="mute">{t('todo.understood')}</span>{parts}<span class="mute small">{t('todo.take_off')}</span></div>}
  </form>;
}

// One line, opened at the side: everything about it, each change saved as she makes it.
function Pane({ ctx, r, close }) {
  const { today, lib, cls } = ctx, it = r.it, c = r.own ? cls(it.c) : null;
  const setDay = d => (r.auto ? (d && d >= today ? autoPut(r.key, { d }) : toast(t('todo.needs_day'))) : put(r.id, { d, ...(d ? {} : { rep: '' }) }));
  const chip = (on, label, fn, attr) => <button type="button" class="chip" aria-pressed={String(!!on)} onClick={fn} data-td-when={attr}>{label}</button>;
  const ck = E.tdCatOf(r);
  const pickCat = async val => {
    if (val === '+') { return askCat(id => (r.auto ? autoPut(r.key, { k: id }) : put(r.id, { k: id }))); }
    return r.auto ? autoPut(r.key, { k: val }) : put(r.id, { k: val });
  };
  const [asking, setAsking] = useState(null);
  const askCat = then => setAsking(() => then);
  const when = <div class="tdf"><span class="tdlab">{t('todo.when')}</span><div class="tdv">
    {chip(r.d === today, t('todo.today'), () => setDay(today), 'today')}{chip(r.d === E.tdAdd(today, 1), t('todo.tomorrow'), () => setDay(E.tdAdd(today, 1)), 'tomorrow')}
    {chip(r.d === E.tdNextMon(today), t('todo.next_week'), () => setDay(E.tdNextMon(today)), 'week')}{r.own && chip(!r.d, t('todo.no_day'), () => setDay(''), 'none')}
    <input type="date" class="input sm" value={r.d} aria-label={t('todo.pick_day')} title={t('todo.pick_day')} onChange={e => setDay(e.currentTarget.value || '')} data-td-date /></div></div>;
  const catF = <div class="tdf"><label class="tdlab" for="td-cat">{t('todo.category')}</label><div class="tdv">
    <select id="td-cat" class="input sm" value={ck.id || '-'} onChange={e => pickCat(e.currentTarget.value)} data-td-cat>
      {E.tdCats().map(k => <option value={k.id}>{catName(k)}</option>)}<option value="-">{t('todo.no_cat')}</option><option value="+">{t('todo.cat_new')}</option></select>
    {!ck.chose && <span class="mute small">{ck.id ? t('todo.from_words') : t('todo.no_fit')}</span>}</div></div>;
  const ask = asking && <NewCat onClose={() => setAsking(null)} then={asking} />;
  if (r.auto) {
    const [bl, bh] = autoBtn(r);
    return <section class="tdpane" data-td-pane={r.id}><IconButton icon="x" label={t('todo.close')} onClick={close} class="tdclose" />
      <h2 class="tdtitle" data-raw>{r.x}</h2><p class="tdm"><span class="tdtag">{t('todo.from_work')}</span>{raw(r.sub)}</p>{when}{catF}
      <p class="mute small">{t('todo.auto_say')}</p>
      <div class="tdacts"><a class="btn pri" href={bh}>{t(bl)}</a><span class="grow" /><Button onClick={() => tick(r)} data-td-hide>{t('todo.hide')}</Button></div>{ask}</section>;
  }
  const items = c ? c.units.flatMap(u => u.items) : [], si = c && it.who ? c.names.indexOf(it.who) : -1, a = it.a && items.find(i => i.id === it.a);
  const mine = (it.ppl || []).map(id => ctx.people.find(p => p.id === id)).filter(Boolean), others = ctx.people.filter(p => !mine.includes(p));
  const pc = c && ctx.plan && ctx.plan.classes.find(p => E.tdKey(p.name) === E.tdKey(c.name));
  // the words and the note are kept as typed until she leaves the box (one save, never a stale copy over newer typing)
  return <section class="tdpane" data-td-pane={r.id}><IconButton icon="x" label={t('todo.close')} onClick={close} class="tdclose" />
    <textarea class="tdtitle input" rows="2" maxLength={300} aria-label={t('todo.what')} defaultValue={it.x} data-td-x
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
      onChange={e => { const x = e.currentTarget.value.replace(/\s+/g, ' ').trim(); if (x && x !== it.x) put(r.id, { x }); else if (!x) e.currentTarget.value = it.x; }} />
    {when}{catF}
    <div class="tdf"><label class="tdlab" for="td-cls">{t('todo.class')}</label><div class="tdv"><select id="td-cls" class="input sm" value={it.c || ''} data-td-cls
      onChange={e => put(r.id, { c: e.currentTarget.value, who: '', a: '', ...(it.rep === 'meet' ? { rep: 'week' } : {}) })}>
      <option value="">{t('todo.no_class')}</option>{lib.classes.map(k => <option value={k.id}>{k.name}</option>)}</select></div></div>
    {c && <div class="tdf"><label class="tdlab" for="td-with">{t('todo.goes_with')}</label><div class="tdv"><select id="td-with" class="input sm" value={si >= 0 ? 's:' + si : a ? 'a:' + a.id : ''} data-td-with
      onChange={e => { const x = e.currentTarget.value; put(r.id, { who: x.startsWith('s:') ? c.names[+x.slice(2)] || '' : '', a: x.startsWith('a:') ? x.slice(2) : '' }); }}>
      <option value="">{t('todo.nothing')}</option>
      {items.length > 0 && <optgroup label={t('todo.assignments')}>{items.map(i => <option value={'a:' + i.id}>{i.name}</option>)}</optgroup>}
      {c.names.length > 0 && <optgroup label={t('todo.students')}>{c.names.map((n, i) => <option value={'s:' + i}>{n}</option>)}</optgroup>}</select>
      {si >= 0 ? <a class="link" href={href('class', c.id, 'people', si + 1)}>{t('todo.open_their')}</a> : a ? <a class="link" href={href('class', c.id)}>{t('todo.open_class')}</a> : null}</div></div>}
    {(ctx.people.length > 0 || mine.length > 0) && <div class="tdf"><label class="tdlab" for="td-ppl">{t('todo.people')}</label><div class="tdv">
      {mine.map(p => <span class="chip" data-td-person={p.id}><Icon name="user" size="xs" />{raw(p.name)}
        {p.email && <a class="link" href={'mailto:' + encodeURIComponent(p.email) + '?subject=' + encodeURIComponent(it.x)} title={t('todo.write_to', { email: p.email })}>{t('todo.email')}</a>}
        <IconButton icon="x" size="sm" label={t('todo.take_person', { name: p.name })} onClick={() => put(r.id, { ppl: (it.ppl || []).filter(x => x !== p.id) })} /></span>)}
      {others.length > 0 && <select id="td-ppl" class="input sm" value="" data-td-ppl onChange={e => { const pid = e.currentTarget.value; e.currentTarget.value = ''; if (pid && !(it.ppl || []).includes(pid)) put(r.id, { ppl: [...(it.ppl || []), pid] }); }}>
        <option value="">{mine.length ? t('todo.add_someone_else') : t('todo.add_someone')}</option>{others.map(p => <option value={p.id}>{p.role ? p.name + ' · ' + p.role : p.name}</option>)}</select>}</div></div>}
    <div class="tdf"><span class="tdlab">{t('todo.repeats')}</span><div class="tdv">
      {[['', 'todo.r_no'], ['day', 'todo.r_day'], ['week', 'todo.r_week'], ...(pc || it.rep === 'meet' ? [['meet', 'todo.r_meet']] : [])].map(([k, l]) =>
        <button type="button" class="chip" aria-pressed={String((it.rep || '') === k)} onClick={() => put(r.id, { rep: k, ...(k && !it.d ? { d: today } : {}) })} data-td-rep={k}>{t(l)}</button>)}</div></div>
    <div class="tdf top"><label class="tdlab" for="td-note">{t('todo.note')}</label><div class="tdv"><textarea id="td-note" class="input" rows="3" maxLength={2000} placeholder={t('todo.note_ph')} defaultValue={it.note || ''} data-td-note
      onChange={e => { const x = e.currentTarget.value.trim(); if (x !== (it.note || '')) put(r.id, { note: x }); }} /></div></div>
    <div class="tdacts"><Button variant="primary" onClick={() => tick(r)} data-td-fin>{it.done ? t('todo.undone_tip') : t('todo.done')}</Button>
      {!it.done && <Button onClick={() => setDay(E.tdAdd(today, 1))} data-td-tomorrow>{t('todo.move_tomorrow')}</Button>}
      <span class="grow" /><Button variant="quiet" onClick={() => { close(); remove(r.id); }} data-td-del>{t('todo.delete')}</Button></div>{ask}
  </section>;
}
function NewCat({ onClose, then }) {
  const [name, setName] = useState('');
  const go2 = async () => { const n = name.trim(); if (!n) return; const { out } = await todoChange(t('todo.u_cats'), E => E.todoCatAdd(n)); onClose(); if (out) then(out); };
  return <Dialog open title={t('todo.cat_new_t')} onClose={onClose} actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={go2} disabled={!name.trim()} data-td-catok>{t('todo.cat_add')}</Button></>}>
    <TextInput label={t('todo.cat_name')} value={name} onInput={setName} maxLength={40} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); go2(); } }} data-td-catname />
  </Dialog>;
}

// With no line open: which kinds of line the app adds, and her categories.
function Kinds({ lib }) {
  const off = (lib.todo && lib.todo.off) || {};
  const flip = k => todoChange(t('todo.u_kinds'), E => { const d = E.tdData(), o = { ...d.off }; if (o[k]) delete o[k]; else o[k] = 1; E.tdSave({ off: o, offT: Date.now() }); });
  return <section class="tdsec" data-td-kinds><h2 class="tdcap">{t('todo.kinds')}</h2>
    {KINDS.map(([k, l]) => <div data-td-kind={k}><Switch label={t(l)} checked={!off[k]} onChange={() => flip(k)} /></div>)}
    <p class="mute small">{t('todo.kinds_say')}</p></section>;
}
function Cats() {
  const cats = E.tdCats(), [name, setName] = useState('');
  const save = (label, fn) => todoChange(label, fn);
  const del = async c => { await save(t('todo.u_cats'), E => E.tdCatSave([{ id: c.id, gone: 1 }])); toast(t('todo.cat_deleted', { name: c.own ? c.name : catName(c) }), { undo: () => undoList.undo() }); };
  const add = async e => { e.preventDefault(); const n = name.trim(); if (!n) return; setName(''); await save(t('todo.u_cats'), E => E.todoCatAdd(n)); };
  return <details class="tdsec" data-td-cats><summary class="tdcap">{t('todo.cats')}</summary>
    {cats.map((c, i) => <div class="tdcatrow" data-td-catrow={c.id} key={c.id}>
      <input class="input sm" maxLength={40} defaultValue={catName(c)} aria-label={t('todo.cat_name')} data-td-catn
        onChange={e => { const x = e.currentTarget.value.replace(/\s+/g, ' ').trim(); if (!x) { e.currentTarget.value = catName(c); return; } if (x !== catName(c)) save(t('todo.u_cats'), E => E.tdCatPut(c.id, { name: c.base && !c.own && CAT_LINE[c.id] && x === t(CAT_LINE[c.id]) ? '' : x })); }} />
      <IconButton icon="chu" size="sm" label={t('todo.cat_up')} disabled={!i} onClick={() => save(t('todo.u_cats'), E => E.todoCatMove(c.id, -1))} />
      <IconButton icon="chd" size="sm" label={t('todo.cat_down')} disabled={i === cats.length - 1} onClick={() => save(t('todo.u_cats'), E => E.todoCatMove(c.id, 1))} />
      <IconButton icon="x" size="sm" label={t('todo.cat_delete', { name: catName(c) })} onClick={() => del(c)} data-td-catdel />
      <input class="input sm tdcatw" maxLength={300} defaultValue={c.w} aria-label={t('todo.cat_words', { name: catName(c) })} data-td-catw
        placeholder={c.id === 'role' && !c.own ? t('todo.cat_role_ph') : t('todo.cat_words_ph', { eg: EG[c.id] || 'yearbook, club' })}
        onChange={e => { const x = e.currentTarget.value.replace(/\s+/g, ' ').trim(); if (x !== c.w) save(t('todo.u_cats'), E => E.tdCatPut(c.id, { w: x })); }} />
    </div>)}
    <form class="tdcatadd" onSubmit={add}><input class="input sm" value={name} onInput={e => setName(e.currentTarget.value)} maxLength={40} placeholder={t('todo.cat_add_ph')} aria-label={t('todo.cat_add_ph')} data-td-catadd />
      <Button type="submit" size="sm" disabled={!name.trim()}>{t('todo.cat_add')}</Button></form>
    <p class="mute small">{t('todo.cat_say')}</p></details>;
}

// The week: the same lines on the days they are for, under the classes that meet (src/todo.js tdWeekHtml). A line not done by its
// day shows under today, with the day it was for; what was done stays on the day it was done. Dragging a line moves its day.
function Week({ ctx, rows }) {
  const { today, plan } = ctx, [wk, setWk] = useState(0), drag = useRef('');
  const mon = E.tdAdd(today, -((at(today).getDay() + 6) % 7) + 7 * wk), days = [0, 1, 2, 3, 4, 5, 6].map(i => E.tdAdd(mon, i)), end = days[6], cur = today >= mon && today <= end;
  const by = new Map(days.map(d => [d, []])), later = [];
  for (const r of rows) {
    if (r.done) { const dd = isoOf(r.done); if (by.has(dd)) by.get(dd).push(r); continue; }
    if (!r.d || r.d > end) later.push(r);
    else if (r.d < today) { if (cur) by.get(today).push({ ...r, from: r.d }); }
    else if (r.d >= mon) by.get(r.d).push(r);
  }
  const move = async (id, day) => {
    const r = rows.find(x => x.id === id); if (!r) return;
    if (!r.auto) return put(id, { d: day, ...(day ? {} : { rep: '' }) });
    if (!day || day < today) { toast(t('todo.needs_day')); return; }
    return autoPut(r.key, { d: day });
  };
  const addTo = async (e, day) => {
    e.preventDefault(); const i = e.currentTarget.querySelector('input'), v = i.value; if (!v.trim()) return; i.value = '';
    const cf = ctx.cls(ctx.filter) ? ctx.filter : '';
    await todoChange(t('todo.u_add'), E => { const it = E.todoAdd(v, null, day ? { d: day } : null); if (it && cf && !it.c) E.tdPut(it.id, { c: cf }); return it; }, plan);
    const again = document.querySelector('[data-td-day="' + day + '"] .tdwadd input'); if (again) again.focus();
  };
  const dnd = day => ({ onDragOver: e => { if (drag.current) { e.preventDefault(); e.currentTarget.classList.add('over'); } }, onDragLeave: e => e.currentTarget.classList.remove('over'),
    onDrop: e => { e.preventDefault(); e.currentTarget.classList.remove('over'); const id = drag.current; drag.current = ''; if (id) move(id, day); } });
  const wrow = r => <div class={'tdw' + (r.done ? ' done' : '') + (r.auto ? ' auto' : '') + (ctx.sel === r.id ? ' sel' : '')} data-td-row={r.id} draggable={!r.done}
    onDragStart={e => { drag.current = r.id; try { e.dataTransfer.setData('text/plain', r.id); e.dataTransfer.effectAllowed = 'move'; } catch {} }} onDragEnd={() => { drag.current = ''; }}>
    <Check r={r} /><button type="button" class="tdmain" onClick={() => ctx.setSel(r.id)}><span class="tdx" data-raw>{r.x}</span>
      {r.from ? <span class="tdm late">{t('todo.from_day', { day: date(at(r.from), { weekday: 'long' }) })}</span> : r.auto && r.sub ? <span class="tdm">{raw(r.sub.split(' · ').pop())}</span> : null}</button></div>;
  const addForm = (day, label) => <form class="tdwadd" onSubmit={e => addTo(e, day)} autocomplete="off"><input class="input sm" maxLength={300} placeholder={t('todo.add_short')} aria-label={t('todo.add_for', { day: label })} /></form>;
  const col = day => {
    const list = by.get(day).sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.from ? 0 : 1) - (b.from ? 0 : 1) || E.tdSort(a, b)), dow = at(day).getDay();
    const inTerm = plan && !(plan.semStart && day < plan.semStart) && !(plan.semEnd && day > plan.semEnd), off = inTerm && plan.daysOff.find(x => x.date === day);
    const meets = inTerm && !off ? plan.classes.flatMap(c => c.meets.filter(m => m.dow === dow).map(m => ({ c, m }))).sort((a, b) => a.m.start.localeCompare(b.m.start)).filter((x, i, a) => a.findIndex(y => y.c.id === x.c.id) === i) : [];
    if ((dow === 0 || dow === 6) && !list.length && !meets.length && day !== today) return null;
    const under = new Map(meets.map(m => [m.c.id, []])), any = [];
    const pidOf = r => r.pid || ((p => (p ? p.id : ''))(ctx.cls(r.classId) && plan && plan.classes.find(p => E.tdKey(p.name) === E.tdKey(ctx.cls(r.classId).name))));
    for (const r of list) { const p = pidOf(r); (under.has(p) ? under.get(p) : any).push(r); }
    const name = day === today ? t('todo.today') : date(at(day), { weekday: 'short' });
    return <section class={'tdday' + (day === today ? ' now' : day < today ? ' past' : '')} data-td-day={day} {...dnd(day)}>
      <h3><b>{day === today ? name : raw(name)}</b>{raw(day === today ? dayLong(day) : dayShort(day))}</h3>
      {off && <p class="mute small" data-raw>{off.label}</p>}
      {any.length > 0 && meets.length > 0 && <div class="tdany">{t('todo.any_time')}</div>}{any.map(wrow)}
      {meets.map(m => <><div class="tdcl"><span class="dot" style={{ '--cc': toneOf(m.c.color) }} /><b data-raw>{m.c.name}</b>{raw(m.m.start)}</div>{under.get(m.c.id).map(wrow)}</>)}
      {addForm(day, name)}</section>;
  };
  return <div class="tdweek" data-td-week>
    <div class="tdwbar"><IconButton icon="chl" label={t('todo.week_before')} onClick={() => setWk(w => w - 1)} data-td-wk="-1" /><b>{t('todo.week_of', { day: date(at(mon), { month: 'long', day: 'numeric' }) })}</b>
      <IconButton icon="chr" label={t('todo.week_after')} onClick={() => setWk(w => w + 1)} data-td-wk="1" />{wk !== 0 && <Button size="sm" onClick={() => setWk(0)}>{t('todo.this_week')}</Button>}
      <span class="mute small">{t('todo.week_say')}</span></div>
    <div class="tdwk">{days.map(col)}<section class="tdday tdlater" data-td-day="" {...dnd('')}><h3><b>{t('todo.g_later')}</b><span>{t('todo.later_say')}</span></h3>{later.sort(E.tdSort).map(wrow)}{addForm('', t('todo.g_later'))}</section></div>
  </div>;
}
const isoOf = tm => { const d = new Date(tm); return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
