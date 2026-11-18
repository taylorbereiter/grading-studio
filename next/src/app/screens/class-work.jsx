// A class's assignments (the current app's class page, Assignments: src/app/screens.js renderLib), loaded as a part of their own
// (router.js PARTS.work): each unit's cards with where their papers stand, the same words as Home, and the way to their papers:
// Open when they are kept in this browser, or Bring in papers, which reads them the way the current app reads a download dropped
// on it (mark/open.js bringIn), keeps them, links the card to them and opens them for marking.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Button, IconButton, Icon, EmptyState, Menu, Dialog, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { href, go, PARTS } from '../router.js';
import { readLibrary, readKept, stateOf, backOf, canOpen } from '../../students/counts.js';
import '../mark/lines.js';

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
  const load = () => { setLib(readLibrary()); readKept().then(setKept); };
  useEffect(load, [classId]);
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
  const units = c.units.filter(u => u.items.length);
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
    {split && <split.S.Split file={split.f} asg={split.it} lib={lib} onClose={() => { setSplit(null); load(); }} />}
    {!units.length ? <EmptyState icon="inbox" title={t('mark.w_none')} />
      : units.map(u => <div class="wunit"><h3 class="t5" data-raw>{u.name}</h3>
        <ul class="wlist">{u.items.map(it => { const st = standing(lib, kept, it), open = st.m && canOpen(st.m);
          return <li class="wrow" data-item={it.id}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over'); }} onDragLeave={e => e.currentTarget.classList.remove('over')}
            onDrop={e => { e.currentTarget.classList.remove('over'); e.preventDefault(); bring(it, e.dataTransfer.files); }}>
            <div class="wn"><b data-raw>{it.name}</b>
              <small class="mute">{[KIND[it.type] && t(KIND[it.type]), it.due && t('mark.w_due', { d: date(new Date(it.due + 'T12:00'), { day: 'numeric', month: 'short' }) })].filter(Boolean).join(' · ')}</small></div>
            <span class={'wst ' + st.cls}>{t(st.key)}{st.s && st.s.left ? ' · ' + t('home.left_of', { left: st.s.left, of: st.s.of }) : ''}</span>
            {open ? <span class="wopen"><a class="btn sm" href={href('mark', st.m.id)}>{t('mark.w_open')}</a>
              {/* a newer copy of the papers: her work comes over (mark/carry.js) */}
              <Menu label={t('mark.w_again')} trigger={b => <IconButton {...b} icon="dots" size="sm" label={t('mark.w_again')} disabled={busy === it.id} data-again-for={it.id} />}
                items={[{ label: t('mark.w_again_files'), icon: 'file', onSelect: () => pick(it, files) }, { label: t('mark.w_again_folder'), icon: 'folder', onSelect: () => pick(it, folder) }]} /></span>
              : <Menu label={t('mark.w_bring')} trigger={b => <Button {...b} size="sm" icon="upload" disabled={busy === it.id} data-bring-for={it.id}>{t('mark.w_bring')}</Button>}
                items={[{ label: t('mark.w_files'), icon: 'file', onSelect: () => pick(it, files) }, { label: t('mark.w_folder'), icon: 'folder', onSelect: () => pick(it, folder) }, { label: t('mark.w_scan'), icon: 'image', onSelect: () => pick(it, scan) }]} />}
          </li>; })}</ul></div>)}
    <p class="mute hint">{t('mark.w_drop')}</p>
  </section>;
}
