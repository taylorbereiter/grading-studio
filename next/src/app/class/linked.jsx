// Linked classes (src/linked.js): sections of one course on the same schedule. Classes with the same course (c.course) are linked; an
// assignment can be added to the others, joined to one made twice, or unlinked, and the copies share it.group. Rosters, papers,
// scores and comments are never shared: each copy is its own card. What goes together is the lifted engine's (gbook lkSibs, lkTwins,
// lkSuggest, lkJoin1); each change is one undo step through students/undo.js. The Planner's offer to link (lkOfferOf) waits for the
// Planner's class page (stage 6). Shown on the class's Assignments tab.
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Button, Checkbox, Dialog, TextInput, Icon, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { href } from '../router.js';
import * as B from '../../engines/gbook.js';
import { libraryChange } from '../../students/undo.js';
import * as undoList from '../../services/undo.js';
import './lines.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const J = v => JSON.parse(JSON.stringify(v));
const clsOf = (l, id) => (id === '-' || id === '' ? l.loose : l.classes.find(x => String(x.id) === String(id)));
const itemOf = (l, id) => { for (const c of [...l.classes, l.loose].filter(Boolean)) for (const u of c.units || []) { const it = u.items.find(x => x.id === id); if (it) return { c, u, it }; } return null; };
// The engine reads the library it was handed: this one, read fresh or inside the change.
const on = l => { B.bookUse({ lib: l }); return l; };
const lc = (label, fn) => libraryChange(t(label), l => fn(on(l)), true).catch(e => { console.error(e); toast(t('mark.cannot')); return false; });
export const sibsOf = (lib, cid) => { const c = clsOf(on(lib), cid); return c ? B.lkSibs(c) : []; };
export const twinsOf = (lib, id) => { const f = itemOf(on(lib), id); return f ? B.lkTwins(f.it) : []; };
const names = cs => cs.map(c => c.name).join(', ');

// Under the tab's top: the classes this one is linked with, Change and Link assignments; or a quiet way to link it.
export function LinkedHead({ lib, classId }) {
  const [edit, setEdit] = useState(false), [match, setMatch] = useState(false);
  const c = clsOf(on(lib), classId); if (!c || c === lib.loose) return null;
  const s = B.lkSibs(c), pairs = s.length ? B.lkSuggest(c) : [];
  return <div class="lkhead" data-lkhead>
    {s.length ? <><span class="lkchip"><Icon name="link" size="xs" /><span>{t('class.lk_with')}</span> {s.map((x, i) => <>{i > 0 && ', '}<a href={href('class', x.id, 'work')} data-raw>{x.name}</a></>)}</span>
      <Button size="sm" variant="quiet" onClick={() => setEdit(true)} data-lkedit>{t('class.lk_change')}</Button>
      {pairs.length > 0 && <Button size="sm" variant="quiet" onClick={() => setMatch(true)} data-lkmatch>{t('class.lk_match')}</Button>}</>
      : lib.classes.length > 1 && <Button size="sm" variant="quiet" icon="link" onClick={() => setEdit(true)} data-lkedit>{t('class.lk_link')}</Button>}
    {edit && <LinkEdit lib={lib} classId={classId} onClose={more => { setEdit(false); if (more) setMatch(true); }} />}
    {match && <LinkMatch lib={lib} classId={classId} onClose={() => setMatch(false)} />}
  </div>;
}

// Linked classes: tick the classes on the same schedule. They share one course name.
function LinkEdit({ lib, classId, onClose }) {
  const c = clsOf(on(lib), classId), was = B.lkSibs(c), others = lib.classes.filter(x => x !== c);
  const [pick, setPick] = useState(() => new Set(was.map(x => String(x.id)))), [course, setCourse] = useState(c.course || '');
  const flip = id => setPick(o => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const save = async () => {
    const ids = [...pick], text = course.trim().slice(0, 60);
    const after = await lc('class.lk_step', l => {
      const k = clsOf(l, classId); if (!k) return;
      const before = B.lkSibs(k), now = l.classes.filter(x => x !== k && ids.includes(String(x.id))), name = text || k.course || k.name;
      for (const x of before) if (!now.includes(x)) x.course = '';
      if (now.length) for (const x of [k, ...now]) x.course = name; else k.course = '';
    });
    const k = after && ids.length ? clsOf(on(J(after)), classId) : null;
    onClose(!!(k && B.lkSuggest(k).length));   // then the cards made in each class that look alike
  };
  return <Dialog open title={t('class.lk_title')} onClose={() => onClose(false)}
    actions={<><Button onClick={() => onClose(false)}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} data-lksave>{t('class.save')}</Button></>}>
    <p class="mute small">{t('class.lk_say')}</p>
    <div class="lkpick" role="group" aria-label={t('class.lk_with')}>{others.length ? others.map(x => <span data-lkpick={x.id}><Checkbox label={x.name} checked={pick.has(String(x.id))} onChange={() => flip(String(x.id))} /></span>) : <p class="mute">{t('class.lk_no_others')}</p>}</div>
    <TextInput label={t('class.lk_course')} hint={t('class.lk_course_hint')} value={course} maxLength={60} onInput={setCourse} data-lkcourse />
  </Dialog>;
}

// Link assignments: one row a pair, the same names ticked, the very similar ones left to tick. One undo step for all of it.
function LinkMatch({ lib, classId, onClose }) {
  const c = clsOf(on(J(lib)), classId), ps = c ? B.lkSuggest(c) : [];
  const [pick, setPick] = useState(() => new Set(ps.map((p, i) => (p.k === 2 ? i : -1)).filter(i => i >= 0)));
  const flip = i => setPick(o => { const n = new Set(o); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const save = async () => {
    const want = ps.filter((_, i) => pick.has(i)).map(p => [p.a.id, p.b.id]); let n = 0;
    await lc('class.lk_match', l => {
      const holders = [...l.classes, l.loose].filter(Boolean);
      for (const [ai, bi] of want) {
        const a = itemOf(l, ai), b = itemOf(l, bi); if (!a || !b) continue;
        // one copy per class: a pair whose groups would put two cards of one class together is skipped
        const g = new Set([a.it.group, b.it.group].filter(Boolean)), cls = new Map(); let clash = false;
        for (const h of holders) for (const u of h.units) for (const x of u.items) if (x === a.it || x === b.it || (x.group && g.has(x.group))) { if (cls.has(h) && cls.get(h) !== x) clash = true; cls.set(h, x); }
        if (!clash) { B.lkJoin1(a.it, b.it); n++; }
      }
    });
    onClose();
    if (n) toast(t('class.lk_linked_n', { n }), { undo: () => undoList.undo() });
  };
  return <Dialog open title={t('class.lk_match')} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} disabled={!pick.size} data-lkmatch-save>{t('class.lk_link_them')}</Button></>}>
    <p class="mute small">{t('class.lk_own')}</p>
    <div class="lkrows">{ps.map((p, i) => <span class="lkrow" data-lkrow={i}><Checkbox label={<><span data-raw>{p.a.name}</span> <span class="mute">·</span> <span data-raw>{p.b.name}</span> <span class="mute" data-raw>{p.x.name}</span></>} checked={pick.has(i)} onChange={() => flip(i)} /></span>)}</div>
  </Dialog>;
}

// The ⋯ on an assignment: Add to a linked class, Link with the copy made there, Unlink.
export function linkItems(lib, classId, it) {
  const c = clsOf(on(lib), classId); if (!c || c === lib.loose) return [];
  const f = itemOf(lib, it.id); if (!f) return [];
  const tw = B.lkTwins(f.it), have = new Set(tw.map(x => x.c)), out = [];
  for (const x of B.lkSibs(c)) {
    if (have.has(x)) continue;
    const drop = [c.name, x.name, c.course].map(d => String(d || '').normalize('NFKC').toLowerCase().trim());
    const same = x.units.flatMap(u => u.items).find(y => !(y.group && y.group === f.it.group) && B.lkLike(f.it, y, drop));
    out.push(same ? { label: t('class.lk_join_in', { name: x.name }), icon: 'link', onSelect: () => join(it.id, same.id, x.name) }
      : { label: t('class.lk_add_to', { name: x.name }), icon: 'plus', onSelect: () => add(it.id, x.id, x.name) });
  }
  if (tw.length) out.push({ label: t('class.lk_off'), icon: 'minus', onSelect: () => off(it.id, it.name) });
  return out;
}
// A copy in another class: same name, type, due date, rubric and Quick mark boxes, in the unit of the same name (made if missing).
async function add(id, cid, cname) {
  let name = '';
  await lc('class.lk_add_step', l => {
    const f = itemOf(l, id), x = clsOf(l, cid); if (!f || !x) return;
    const it = f.it; it.group ||= uid(); name = it.name;
    let to = x.units.find(u => B.lkKey(u.name) === B.lkKey(f.u.name)); if (!to) x.units.push(to = { id: uid(), name: f.u.name, items: [] });
    const a = { id: uid(), name: it.name, classId: x.id, group: it.group };
    for (const k of ['type', 'due', 'setup', 'quiz', 'goal', 'crit']) if (it[k] != null) a[k] = B.lkCopy(it[k]);
    if (a.setup) delete a.setup.spot;
    to.items.push(a);
  });
  if (name) toast(t('class.lk_added', { name, cls: cname }), { undo: () => undoList.undo() });
}
async function join(id, other, cname) {
  let ok = false;
  await lc('class.lk_join_step', l => { const a = itemOf(l, id), b = itemOf(l, other); if (!a || !b) return; B.lkJoin1(a.it, b.it); ok = true; });
  if (ok) toast(t('class.lk_joined', { cls: cname }), { undo: () => undoList.undo() });
}
async function off(id, name) {
  await lc('class.lk_off', l => { const f = itemOf(l, id); if (!f || !f.it.group) return; const tw = B.lkTwins(f.it); delete f.it.group; if (tw.length === 1) delete tw[0].it.group; });
  toast(t('class.lk_unlinked', { name }), { undo: () => undoList.undo() });
}
// On a card with copies: the classes they are in.
export function AlsoIn({ lib, it }) {
  const tw = twinsOf(lib, it.id); if (!tw.length) return null;
  return <small class="lktw mute" data-lktw><Icon name="link" size="xs" />{t('class.lk_also', { names: names(tw.map(x => x.c === lib.loose ? { name: t('nav.no_class') } : x.c)) })}</small>;
}
// The edit box of a card with copies: what changed here can go to the copies too (only what changed, so a copy's own due date stays).
export function alsoDo(l, id, was) {
  on(l); const f = itemOf(l, id); if (!f) return;
  for (const { it: x } of B.lkTwins(f.it)) for (const k of ['name', 'type', 'due']) if (f.it[k] !== was[k]) { if (f.it[k] == null) delete x[k]; else x[k] = f.it[k]; }
}
