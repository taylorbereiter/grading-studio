// A class's assignments (the current app's class page, Assignments: src/app/screens.js renderLib), loaded as a part of their own
// (router.js PARTS.work): each unit's cards with where their papers stand, the same words as Home, and the way to their papers:
// Open when they are kept in this browser, or Bring in papers, which reads them the way the current app reads a download dropped
// on it (mark/open.js bringIn), keeps them, links the card to them and opens them for marking. Units are added, renamed and deleted
// here, and an assignment moves to another unit or class (src/app/screens.js addunit, urename, udel, its drag and drop), each one
// undo step (students/undo.js libraryChange); a deleted unit comes back with Undo, with no question first.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, IconButton, Icon, EmptyState, Menu, Dialog, TextInput, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { href, go, PARTS } from '../router.js';
import { readLibrary, readKept, stateOf, backOf, canOpen } from '../../students/counts.js';
import { libraryChange } from '../../students/undo.js';
import * as undoList from '../../services/undo.js';
import { onSaved } from '../../shared/saved.js';
import '../mark/lines.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const holderOf = (l, id) => (id === '-' || id === '' ? l.loose : l.classes.find(x => String(x.id) === String(id)));
// The same change on the library as saved (it's read fresh there): a unit or a card found by its id.
const unitIn = (l, id) => { for (const c of [...l.classes, l.loose]) { const u = c.units.find(x => x.id === id); if (u) return { c, u }; } return null; };
const itemIn = (l, id) => { for (const c of [...l.classes, l.loose]) for (const u of c.units) { const it = u.items.find(x => x.id === id); if (it) return { c, u, it }; } return null; };

// A unit's name: a new one, or a new name for one there is.
function NameUnit({ was, onDone }) {
  const [v, setV] = useState(was.name);
  const ok = () => { if (v.trim()) onDone(v.trim()); };
  return <Dialog open title={t(was.id ? 'mark.u_rename_t' : 'mark.u_add_t')} onClose={() => onDone(null)}
    actions={<><Button onClick={() => onDone(null)}>{t('mark.u_cancel')}</Button><Button variant="primary" disabled={!v.trim()} onClick={ok} data-uok>{t(was.id ? 'mark.u_rename' : 'mark.u_add')}</Button></>}>
    <TextInput label={t('mark.u_name')} value={v} onInput={setV} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } }} data-uname autofocus />
  </Dialog>;
}
// Move to…: every unit of every class, and No class; the card goes to the end of the one picked and takes that class.
function MoveTo({ lib, it, onDone }) {
  const here = itemIn(lib, it.id), all = [...lib.classes.map(c => ({ c, name: c.name })), { c: lib.loose, name: t('mark.u_noclass') }];
  return <Dialog open title={t('mark.u_move_t', { name: it.name })} onClose={() => onDone(null)} actions={<Button onClick={() => onDone(null)}>{t('mark.u_cancel')}</Button>}>
    {all.filter(x => x.c.units.length).map(x => <div class="wmove"><h4 class="t6" data-raw>{x.name}</h4>
      <ul class="mk-mvlist">{x.c.units.map(u => <li><Button variant="quiet" disabled={here && here.u.id === u.id} onClick={() => onDone(u.id)} data-moveto={u.id}><span data-raw>{u.name}</span></Button></li>)}</ul></div>)}
  </Dialog>;
}

const KIND = { sum: 'mark.k_sum', ic: 'mark.k_ic', fm: 'mark.k_fm', xc: 'mark.k_xc' };
// Where the papers stand, in the words the current app uses on its class page and Home (keptState).
function standing(lib, kept, it) {
  const m = it.batchId ? kept.get(it.batchId) : null;
  if (!m) return { key: it.typed ? 'mark.s_typed' : 'mark.s_none', cls: '' };
  const s = stateOf(lib, kept, m), back = !!backOf(m), began = s.done || (!s.fm && m.partial);
  if (!s.of) return { key: 'mark.s_none', cls: '', m };
  if (!s.left) return { key: back ? 'mark.s_returned' : 'mark.s_ready', cls: back ? 'ret' : 'ok', m, s };
  return { key: began ? (s.fm ? 'mark.s_feedback' : 'mark.s_scoring') : 'mark.s_started_not', cls: began ? 'on' : '', m, s };
}
// Files from a picker or a drop: each with the path it had (a folder keeps its folders, as the current app reads them).
const entriesOf = files => [...files].map(f => ({ path: f.webkitRelativePath || f.name, file: f }));

export default function ClassWork({ classId }) {
  const [lib, setLib] = useState(null), [kept, setKept] = useState(null), [busy, setBusy] = useState(null);
  const files = useRef(null), folder = useRef(null), scan = useRef(null), want = useRef(null), [ask, setAsk] = useState(null), [split, setSplit] = useState(null);
  const [name, setName] = useState(null), [move, setMove] = useState(null);
  const load = () => { setLib(readLibrary()); readKept().then(setKept); };
  useEffect(load, [classId]);
  useEffect(() => onSaved(e => { if (e.kind === 'library') setLib(readLibrary()); }), []);
  if (!lib || !kept) return <div class="loading" aria-busy="true" />;
  const c = classId === '-' ? lib.loose : lib.classes.find(x => String(x.id) === String(classId));
  if (!c) return <EmptyState icon="inbox" title={t('mark.w_none')} />;
  const bring = async (it, list) => {
    if (!list.length || busy) return;
    setBusy(it.id);
    try {
      const O = await PARTS.bring();
      // a newer copy of a download she has worked on: asked whether her marks and scores come over, when it isn't plainly the same one
      const carry = e => new Promise(done => setAsk({ e, done: v => { setAsk(null); done(v); } }));
      const r = await O.bringIn(entriesOf(list), { assignment: it, label: it.name, carry });
      if (r && r.changed) toast(t('mark.c_changed_toast', { n: r.changed }), { ms: 7000 });
      if (r) go('mark', r.batch.id);
    } catch (e) { console.error(e); toast(e && e.name === 'NothingIn' ? t('mark.w_nothing') : e && e.name === 'CannotSave' ? t('mark.cannot') : t('mark.w_failed')); }
    finally { setBusy(null); load(); }
  };
  const pick = (it, el) => { want.current = it; el.current.value = ''; el.current.click(); };
  const units = c.units;
  const lc = (label, fn) => libraryChange(t(label), fn, true).catch(e => { console.error(e); toast(t('mark.cannot')); });
  const named = async v => {
    const was = name; setName(null); if (!v) return;
    if (was.id) await lc('mark.u_rename', l => { const f = unitIn(l, was.id); if (f) f.u.name = v; });
    else await lc('mark.u_add', l => { const h = holderOf(l, classId); if (h) h.units.push({ id: uid(), name: v, items: [] }); });
  };
  const drop = async u => {
    const n = u.items.length;
    await lc('mark.u_del', l => { const f = unitIn(l, u.id); if (f) f.c.units.splice(f.c.units.indexOf(f.u), 1); });
    toast(n ? t('mark.u_gone_n', { name: u.name, n }) : t('mark.u_gone', { name: u.name }), { undo: () => undoList.undo() });
  };
  const moved = async to => {
    const it = move; setMove(null); if (!to) return;
    let where = '';
    await lc('mark.u_move', l => { const f = itemIn(l, it.id), d = unitIn(l, to); if (!f || !d || f.u === d.u) return; f.u.items.splice(f.u.items.indexOf(f.it), 1); d.u.items.push(f.it); f.it.classId = d.c.id; where = d.u.name; });
    if (where) toast(t('mark.u_moved', { name: where }), { undo: () => undoList.undo() });
  };
  const more = it => ({ label: t('mark.u_move'), icon: 'arrow', onSelect: () => setMove(it) });
  return <section class="classwork" aria-labelledby="h-work">
    <h2 id="h-work" class="sr">{t('mark.w_title')}</h2>
    {ask && <Dialog open title={t('mark.c_ask_t')} onClose={() => ask.done(false)}
      actions={<><Button onClick={() => ask.done(false)} data-fresh>{t('mark.c_fresh')}</Button><Button variant="primary" onClick={() => ask.done(true)} data-carry>{t('mark.c_bring')}</Button></>}>
      <p data-raw>{t('mark.c_ask', { name: ask.e.name || t('mark.c_noname') })}</p>
      <p>{ask.e.unchecked ? t('mark.c_ask_unchecked') : t('mark.c_ask_same', { named: ask.e.named, all: ask.e.nOld, n: ask.e.same })}</p>
      <p>{t('mark.c_ask_q')}</p></Dialog>}
    <input ref={files} type="file" multiple hidden accept=".zip,.pdf,.docx,.docm,.doc,.png,.jpg,.jpeg,.heic,.heif,.gif,.webp,.mp4,.mov,.m4v,.webm,.mp3,.m4a,.wav,.txt,.md"
      onChange={e => bring(want.current, e.currentTarget.files)} data-bring="files" />
    <input ref={folder} type="file" multiple hidden webkitdirectory="" onChange={e => bring(want.current, e.currentTarget.files)} data-bring="folder" />
    {/* a scan of everyone's papers, split page by page onto names (mark/split.jsx) */}
    <input ref={scan} type="file" hidden accept=".pdf,application/pdf" data-bring="scan"
      onChange={e => { const f = e.currentTarget.files[0], it = want.current; if (f) PARTS.split().then(S => setSplit({ S, f, it }), er => console.error(er)); }} />
    {name && <NameUnit was={name} onDone={named} />}
    {move && <MoveTo lib={lib} it={move} onDone={moved} />}
    {split && <split.S.Split file={split.f} asg={split.it} lib={lib} onClose={() => { setSplit(null); load(); }} />}
    {!units.length ? <EmptyState icon="inbox" title={t('mark.w_none')} />
      : units.map(u => <div class="wunit" data-unit={u.id}><div class="whead"><h3 class="t5" data-raw>{u.name}</h3>
        <Menu label={t('mark.u_more', { name: u.name })} trigger={b => <IconButton {...b} icon="dots" size="sm" label={t('mark.u_more', { name: u.name })} data-umenu={u.id} />}
          items={[{ label: t('mark.u_rename'), icon: 'edit', onSelect: () => setName(u) }, { label: t('mark.u_del'), icon: 'trash', onSelect: () => drop(u) }]} /></div>
        {!u.items.length && <p class="mute wempty">{t('mark.u_empty')}</p>}
        {!!u.items.length && <ul class="wlist">{u.items.map(it => { const st = standing(lib, kept, it), open = st.m && canOpen(st.m);
          return <li class="wrow" data-item={it.id}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over'); }} onDragLeave={e => e.currentTarget.classList.remove('over')}
            onDrop={e => { e.currentTarget.classList.remove('over'); e.preventDefault(); bring(it, e.dataTransfer.files); }}>
            <div class="wn"><b data-raw>{it.name}</b>
              <small class="mute">{[KIND[it.type] && t(KIND[it.type]), it.due && t('mark.w_due', { d: date(new Date(it.due + 'T12:00'), { day: 'numeric', month: 'short' }) })].filter(Boolean).join(' · ')}</small></div>
            <span class={'wst ' + st.cls}>{t(st.key)}{st.s && st.s.left ? ' · ' + t('home.left_of', { left: st.s.left, of: st.s.of }) : ''}</span>
            {open ? <span class="wopen"><a class="btn sm" href={href('mark', st.m.id)}>{t('mark.w_open')}</a>
              {/* a newer copy of the papers: her work comes over (mark/carry.js) */}
              <Menu label={t('mark.w_again')} trigger={b => <IconButton {...b} icon="dots" size="sm" label={t('mark.w_again')} disabled={busy === it.id} data-again-for={it.id} />}
                items={[{ label: t('mark.w_again_files'), icon: 'file', onSelect: () => pick(it, files) }, { label: t('mark.w_again_folder'), icon: 'folder', onSelect: () => pick(it, folder) }, more(it)]} /></span>
              : <span class="wopen"><Menu label={t('mark.w_bring')} trigger={b => <Button {...b} size="sm" icon="upload" disabled={busy === it.id} data-bring-for={it.id}>{t('mark.w_bring')}</Button>}
                items={[{ label: t('mark.w_files'), icon: 'file', onSelect: () => pick(it, files) }, { label: t('mark.w_folder'), icon: 'folder', onSelect: () => pick(it, folder) }, { label: t('mark.w_scan'), icon: 'image', onSelect: () => pick(it, scan) }]} />
              <Menu label={t('mark.u_item_more', { name: it.name })} trigger={b => <IconButton {...b} icon="dots" size="sm" label={t('mark.u_item_more', { name: it.name })} data-more-for={it.id} />} items={[more(it)]} /></span>}
          </li>; })}</ul>}</div>)}
    {classId !== '-' && <div><Button size="sm" icon="plus" onClick={() => setName({ name: t('mark.u_new', { n: units.length + 1 }) })} data-addunit>{t('mark.u_add')}</Button></div>}
    <p class="mute hint">{t('mark.w_drop')}</p>
  </section>;
}
