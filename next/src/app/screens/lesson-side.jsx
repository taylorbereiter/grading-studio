// The lesson page's classes (router.js PARTS side2), loaded with the page: every class and day the lesson is on, a way to put it on
// another and to take it off one (src/planner/lessons.js ls-slots chips with ×, addSlotDlg). To keep the page's presses at rest
// under the brief's 25, adding and taking off sit in the lesson's ⋯ menu (slotItems); a lesson on no class shows + Class itself.
// Kept as the current Planner keeps them: slots [{ classId, date }] in date order, never the same one twice.
import { h, Fragment } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Button, IconButton, Icon, Select, TextInput, Sheet, Menu, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { toneOf } from '../colors.js';
import { engine } from '../../planning/engine.js';
import { school } from '../../planning/index.js';
import { classOf, at, today, periods } from '../plan/lessons.js';
import '../plan/les-lines.js';
import '../plan/rev-lines.js';
import '../plan/lines.js';

const clock = s => { const m = /^(\d{1,2}):(\d\d)$/.exec(s || ''); return m ? date(new Date(2000, 0, 1, +m[1], +m[2]), { hour: 'numeric', minute: '2-digit' }) : ''; };
const copy = x => JSON.parse(JSON.stringify(x));
const day = s => date(at(s.date), { weekday: 'short', day: 'numeric', month: 'short' });
let opener = null, cOpen = null, tOpen = null;

// The lesson menu's items: put it on another class or day, take it off each one it is on, and the name kept with the title slide.
export function slotItems(p, l, save) {
  return [{ id: 'slot-add', label: t('les.add_slot'), icon: 'plus', onSelect: () => opener && opener(true) },
    ...(l.slots || []).map((s, i) => { const k = classOf(p, s.classId); return { id: 'unslot' + i, label: t('les.take_off', { name: (k ? k.name : '') + ', ' + day(s) }), icon: 'x',
      onSelect: () => { const n = copy(l); n.slots.splice(i, 1); save(n); } }; }),
    // The lesson's name and its title slide's title kept the same (src/planner/lessons.js titlesLinked, in its More menu).
    ...(l.slides.some(s => s.layout === 'title') ? [{ id: 'tlink', label: t('les.title_linked'), checked: !l.titleApart, onSelect: () => { const n = copy(l);
      if (n.titleApart) { delete n.titleApart; n.slides.find(s => s.layout === 'title').title = n.title; } else n.titleApart = true; save(n); } }] : []),
    // Every comment in one list, and a note on where a class got to: here, so the page's presses at rest stay under 25.
    { id: 'cmts', label: t('rev.all_comments'), icon: 'comment', onSelect: () => cOpen && cOpen() },
    ...((l.taught || []).length || (l.slots || []).some(s => s.date <= today()) ? [{ id: 'tnote', label: (l.taught || []).length ? t('rev.add_note') : t('rev.note_where'), icon: 'check', onSelect: () => tOpen && tOpen({}) }] : []), { sep: true }];   // not-words
}

export function Classes({ p, l }) {
  const slots = l.slots || [];
  return <section class="lclasses"><h2 class="sub">{slots.length ? t('les.classes') : t('plan.not_on_calendar')}</h2>
    {slots.length > 0 ? <ul class="slotlist">{slots.map(s => { const k = classOf(p, s.classId), m = k && (k.meets || []).find(x => +x.dow === at(s.date).getDay());
      return <li class="slotchip" data-slot={s.classId + '|' + s.date}><span class="dot" style={{ '--cc': k ? toneOf(k.color) : 'var(--g500)' }} />
        <span><b data-raw>{k ? k.name : s.classId}</b> <span class="mute" data-raw>{day(s)}{m ? ', ' + (m.label ? m.label + ', ' : '') + clock(m.start) : ''}</span></span></li>; })}</ul>
      : ((p.setup && p.setup.classes) || []).length > 0 && <Button size="sm" icon="plus" onClick={() => opener && opener(true)} data-focus="add-slot">{t('les.add_class')}</Button>}
  </section>;
}

export function SlotSheet({ p, l, save }) {
  const cls = (p.setup && p.setup.classes) || [], slots = l.slots || [];
  const [on, setOn] = useState(false), [c, setC] = useState(''), [d, setD] = useState('');
  opener = v => { setC(cls[0] ? cls[0].id : ''); setD(slots[0] ? slots[0].date : today()); setOn(v); };
  if (!on) return null;
  const add = () => {
    if (!c || !/^\d{4}-\d\d-\d\d$/.test(d)) return;
    const n = copy(l); n.slots = n.slots || [];
    if (!n.slots.some(s => s.classId === c && s.date === d)) n.slots.push({ classId: c, date: d });
    n.slots.sort((a, b) => a.date.localeCompare(b.date)); save(n); setOn(false);
  };
  const meets = c && /^\d{4}-\d\d-\d\d$/.test(d) && periods(p, d).some(m => m.c.id === c);
  return <Sheet open title={t('les.add_slot')} icon={<Icon name="cal" />} onClose={() => setOn(false)}
    footer={<><span class="grow" /><Button onClick={() => setOn(false)}>{t('common.cancel')}</Button><Button variant="primary" onClick={add} data-focus="slot-add">{t('les.add')}</Button></>}>
    <div class="addslot"><Select label={t('plan.class')} value={c} options={cls.map(x => ({ value: x.id, label: x.name }))} onChange={setC} data-focus="slot-class" data-raw />
      <TextInput label={t('plan.date')} type="date" value={d} onInput={setD} data-focus="slot-date" />
      {c && d && !meets && <p class="mute" role="status" data-focus="slot-warn">{t('les.not_meet')}</p>}</div>
  </Sheet>;
}

// A finished .pptx, or a lesson .zip with the deck and its handouts, let go anywhere on the lesson page (src/planner/finished.js
// finishedDrop): the Finished PowerPoint, as its upload button does. Materials and the assistant's sheet take their own drops first.
const deckOf = e => [...((e.dataTransfer && e.dataTransfer.files) || [])].find(f => /\.(pptx|zip)$/i.test(f.name));
export function pageOver(e) { if ([...((e.dataTransfer && e.dataTransfer.types) || [])].includes('Files')) e.preventDefault(); }
export function pageDrop(e, p, l, save, Tools) {
  const f = deckOf(e); if (!f || !Tools || e.defaultPrevented) return;
  e.preventDefault(); Tools.dropFinal(p, l, f, save);
}

// Every comment on the lesson and its slides in one list (src/planner/review.js commentsDlg): the whole lesson first, then each
// slide; Done or Open again on each; done ones hidden until Show done. Going to a slide opens it in Edit, where its comments are.
export function Comments({ l, ai, save, onGo }) {
  const [open, setOpen] = useState(false), [all, setAll] = useState(false);
  cOpen = () => setOpen(true);
  if (!open) return null;
  const done = l.slides.reduce((k, s) => k + (s.talk || []).filter(c => c.done).length, (l.talk || []).filter(c => c.done).length);
  const rows = [{ s: l, i: -1 }, ...l.slides.map((s, i) => ({ s, i }))].map(r => ({ ...r, ms: (r.s.talk || []).map((c, j) => ({ c, j })).filter(m => all || !m.c.done) })).filter(r => r.ms.length);
  const flip = (i, j) => { const x = JSON.parse(JSON.stringify(l)), o = i < 0 ? x : x.slides[i], c = o.talk[j]; if (c.done) delete c.done; else c.done = true; save(x); };
  const go = i => { setOpen(false); if (i >= 0) return onGo(i); const el = document.querySelector('.lside .talk'); if (el) { el.scrollIntoView({ block: 'center' }); const b = el.querySelector('button'); if (b) b.focus(); } };
  return <>
    <Sheet open title={t('rev.comments_on', { title: l.title })} icon={<Icon name="comment" />} onClose={() => setOpen(false)}
      footer={<>{done > 0 && <Button variant="quiet" onClick={() => setAll(!all)} data-focus="show-done">{all ? t('rev.hide_done') : t('rev.show_done', { n: done })}</Button>}<span class="grow" /><Button onClick={() => setOpen(false)}>{t('common.close')}</Button></>}>
      {rows.length ? <div class="cmts">{rows.map(r => <section class="cmt-s"><button type="button" class="link" onClick={() => go(r.i)} data-cgo={r.i}><b>{r.i < 0 ? t('rev.whole_lesson') : t('plan.slide_n', { n: r.i + 1 })}</b>{r.i >= 0 && r.s.title && <span data-raw>: {r.s.title}</span>}</button>
        {r.ms.map(m => <div class={'cmt' + (m.c.done ? ' done' : '')}><b>{m.c.by === 'claude' ? ai : t('plan.you')}</b><span data-raw>{m.c.text}</span>
          <Button size="sm" variant="quiet" onClick={() => flip(r.i, m.j)} data-cdone={r.i + ':' + m.j}>{m.c.done ? t('rev.c_open') : t('rev.c_done')}</Button></div>)}</section>)}</div>
        : <p class="mute">{done ? t('rev.no_open') : t('rev.no_comments')}</p>}
    </Sheet>
  </>;
}

// Where each class got to (src/planner/present.js taughtHtml, taughtDlg): every note once the lesson's day has come, each with Edit and
// Remove in its menu, and Add a note. Saved in "taught" as the current Planner keeps it, one note a class and day; an edited note keeps
// its agenda ticks. Present records one by itself after two minutes.
const shortDay = d => date(at(d), { day: 'numeric', month: 'short' });
export function Taught({ p, l, save }) {
  const ts = l.taught || [];
  if (!ts.length) return null;
  const who = whoOf(p);
  const where = x => x.slide >= x.of ? t('rev.finished', { n: x.of }) : t('rev.got_slide', { slide: x.slide, of: x.of });
  const del = i => { const n = copy(l); n.taught.splice(i, 1); if (!n.taught.length) delete n.taught; save(n); toast(t('rev.removed'), { undo: () => save(l) }); };
  return <section class="taught" data-taught><h2 class="sub">{t('rev.taught')}</h2>
    <p class="mute">{t('rev.taught_about')}</p>
    {<ul class="tglist">{ts.map((x, i) => <li data-tg={i}><b data-raw>{who(x)}</b><span>{where(x)}{x.agenda ? ' · ' + t('rev.agenda', { a: x.agenda[0], b: x.agenda[1] }) : ''}</span>
      {x.note && <span class="mute" data-raw>{x.note}</span>}
      <Menu label={t('rev.note_menu', { who: who(x) })} trigger={q => <IconButton icon="dots" size="sm" label={t('rev.note_menu', { who: who(x) })} {...q} />} items={[{ id: 'tedit', label: t('common.edit'), icon: 'pen', onSelect: () => tOpen && tOpen({ edit: x }) }, { id: 'tdel', label: t('common.remove'), icon: 'trash', onSelect: () => del(i) }]} /></li>)}</ul>}
  </section>;
}
const whoOf = p => s => { const k = s.classId && classOf(p, s.classId); return (k ? k.name + ' · ' : '') + shortDay(s.date); };
export function TaughtAdd({ p, l, save }) {
  const [ed, setEd] = useState(null);
  tOpen = setEd;
  return ed && <TaughtSheet p={p} l={l} pre={ed} who={whoOf(p)} save={save} onClose={() => setEd(null)} />;
}
function TaughtSheet({ p, l, pre, who, save, onClose }) {
  const n = l.slides.length, now = today();
  const slots = (l.slots || []).length ? l.slots.slice().sort((a, b) => a.date.localeCompare(b.date)) : [{ classId: (pre.edit || {}).classId || '', date: (pre.edit || {}).date || now }];
  const want = pre.edit || slots.filter(s => s.date <= now).pop() || slots[0];   // not-words
  if (!slots.some(s => s.classId === want.classId && s.date === want.date)) slots.push({ classId: want.classId, date: want.date });
  const had = s => (l.taught || []).find(x => x.classId === s.classId && x.date === s.date);
  const [at0, setAt] = useState(() => slots.findIndex(s => s.classId === want.classId && s.date === want.date));
  const h0 = had(slots[at0]), [sl, setSl] = useState(String(h0 ? h0.slide : n)), [note, setNote] = useState(h0 ? h0.note || '' : '');
  const pick = v => { const i = +v, h = had(slots[i]); setAt(i); if (h) { setSl(String(h.slide)); setNote(h.note || ''); } };
  const keep = () => {
    const s = slots[at0], o = had(s), x = { classId: s.classId, date: s.date, slide: Math.max(1, Math.min(n, +sl || n)), of: n, note: note.replace(/\s+/g, ' ').trim().slice(0, 300), at: Date.now() };
    if (o && o.agenda) x.agenda = o.agenda;
    const c = copy(l); c.taught = [...(c.taught || []).filter(y => !(y.classId === s.classId && y.date === s.date) && !(pre.edit && y.classId === pre.edit.classId && y.date === pre.edit.date)), x].sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at);
    save(c); toast(t('rev.noted')); onClose();
  };
  return <Sheet open title={t('rev.where_title')} icon={<Icon name="check" />} onClose={onClose}
    footer={<><span class="grow" /><Button onClick={onClose}>{t('rev.not_now')}</Button><Button variant="primary" onClick={keep} data-focus="taught-save">{t('common.save')}</Button></>}>
    <div class="addslot">{slots.length > 1 ? <Select label={t('plan.class')} value={String(at0)} options={slots.map((s, i) => ({ value: String(i), label: who(s) }))} onChange={pick} data-focus="taught-class" data-raw /> : <p data-raw>{who(slots[0])}</p>}
      <Select label={t('rev.got_to')} value={sl} options={l.slides.map((s, i) => ({ value: String(i + 1), label: (i === n - 1 ? t('rev.slide_end', { n: i + 1 }) : t('plan.slide_n', { n: i + 1 })) + (s.title ? ' · ' + String(s.title).replace(/<[^>]*>/g, '').slice(0, 60) : '') }))} onChange={setSl} data-focus="taught-slide" />
      <TextInput label={t('rev.next_time')} hint={t('rev.next_hint')} value={note} onInput={setNote} maxLength={200} data-focus="taught-note" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); keep(); } }} /></div>
  </Sheet>;
}

// Add a link, or change one (src/planner/links.js linkDlg), under Materials: adding offers the links kept in School resources
// (gs.school, the School page), kept at the top first, then by name, with a search when there are more than six; a pick goes on at
// once. One lesson holds up to 40 links (LK_MAX), never the same address twice.
const LK_MAX = 40;
function schoolLinks(E) {
  let v = null; try { v = school.json(null); } catch {}
  return (v && Array.isArray(v.items) ? v.items : []).filter(i => i && i.id && !i.gone && i.kind === 'link' && E.lkUrl(i.url))
    .map(i => ({ id: String(i.id), name: String(i.name || E.lkHost(i.url)), url: E.lkUrl(i.url), group: String(i.group || ''), note: String(i.note || ''), pin: !!i.pin, cls: (Array.isArray(i.cls) ? i.cls : []).map(String).filter(Boolean) }))
    .sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}
export function LinkForm({ p, l, was, save, onClose }) {
  const E = engine(p), form = useRef(), [q, setQ] = useState(''), [u0, setU] = useState(was ? was.url : ''), [n0, setN] = useState(was ? was.name : ''), list = was ? [] : schoolLinks(E);
  useEffect(() => { const b = form.current && form.current.querySelector('input'); if (b) b.focus(); }, []);
  const has = url => (l.links || []).some(x => x.url === url && (!was || x.id !== was.id));
  const keep = () => {
    const box = form.current ? [...form.current.querySelectorAll('input')] : [], u = E.lkUrl(box[0] ? box[0].value : ''), name = (box[1] ? box[1].value : '').trim().slice(0, 120);
    if (!u) return toast(t('plan.link_bad'));
    if (has(u)) return toast(t('rev.link_dup'));
    const n = copy(l); n.links = n.links || [];
    if (was) { const x = n.links.find(y => y.id === was.id); if (x) { x.url = u; x.name = name || E.lkHost(u); } }
    else { if (n.links.length >= LK_MAX) return toast(t('rev.link_max', { n: LK_MAX })); n.links.push({ id: E.lid(), name: name || E.lkHost(u), url: u }); }
    save(n); onClose();
  };
  const pick = i => { if (has(i.url)) return; if ((l.links || []).length >= LK_MAX) return toast(t('rev.link_max', { n: LK_MAX })); const n = copy(l); n.links = [...(n.links || []), { id: E.lid(), name: i.name, url: i.url }]; save(n); };
  const words = q.toLowerCase().split(/\s+/).filter(Boolean), hits = list.filter(i => { const s = [i.name, i.group, i.url, i.note, ...i.cls].join(' ').toLowerCase(); return words.every(w => s.includes(w)); });
  const enter = e => { if (e.key === 'Enter') keep(); };
  return <div class="mlink" ref={form}>
    {was && <p><b>{t('rev.edit_link')}</b></p>}
    <TextInput label={t('plan.link_address')} type="url" value={u0} onInput={setU} onKeyDown={enter} data-focus="link-url" />
    <TextInput label={t('plan.link_name')} value={n0} onInput={setN} onKeyDown={enter} />
    <div class="row"><Button size="sm" variant="quiet" onClick={onClose}>{t('common.cancel')}</Button><Button size="sm" variant="primary" onClick={keep} data-focus="link-add">{was ? t('common.save') : t('plan.add_link')}</Button></div>
    {list.length > 0 && <div class="lkpicks"><h3 class="sub">{t('rev.or_school')}</h3>
      {list.length > 6 && <TextInput type="search" label={t('rev.search_school')} value={q} onInput={setQ} data-focus="lk-q" />}
      {hits.length ? <ul class="mlist">{hits.map(i => <li><button type="button" class="link mopen" disabled={has(i.url)} onClick={() => pick(i)} data-lkpick={i.id}><Icon name="link" size="sm" /><span data-raw>{i.name}</span></button>
        <small class="mute" data-raw>{[E.lkHost(i.url), i.group, ...i.cls].filter(Boolean).join(' · ')}</small>{has(i.url) && <small>{t('rev.added')}</small>}</li>)}</ul>
        : <p class="mute">{t('rev.no_match', { q: q.trim() })}</p>}</div>}
  </div>;
}
