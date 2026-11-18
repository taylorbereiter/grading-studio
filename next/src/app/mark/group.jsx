// Group work on the marking screen (src/groups.js groupBand, groupClick, groupModePick, openShareFile): the band above a partner's
// paper (who they work with, how the group is graded, Both or Just them, Grade on their own), the band on a scan's shared pages (Mark
// and grade once for the group), and Group work… on a file. What changes the work is mark/change.js, each change one undo step; the
// current app asks before Grade on their own and before One grade, and here they happen at once with Undo.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button, Segmented, Dialog, TextInput, Switch, toast } from '../../ui/index.js';
import { state } from '../../engines/gcore.js';
import { shownName } from '../../engines/gdraw.js';
import { groupOf } from '../../engines/gmark.js';
import * as G from '../../engines/ggroup.js';
import { t } from '../../i18n/t.js';
import * as C from './change.js';
import { useGroupSync } from './marking.js';
import './lines.js';

useGroupSync(G.groupSync);

const b = () => state().batch;
const nameOf = st => shownName(st, b().students.indexOf(st));
const namesOf = list => list.map(nameOf).join(', ');

export function GroupBand({ st }) {
  const mates = G.groupMates(st);
  if (mates.length) {
    const g = groupOf(st), own = !!(g && g.own), mode = g && g.own === 2 ? '2' : own ? '1' : '0', just = C.groupJustNow() === st.key;
    const pick = v => {
      C.groupMode(st, +v);
      toast(t(v === '2' ? 'mark.gw_mode_adj' : v === '1' ? 'mark.gw_mode_own' : 'mark.gw_mode_all'), { undo: C.undo });
    };
    return <div class="mk-grp" data-grpband>
      <b>{t('mark.gw_title')}</b><span>{t('mark.gw_with')} <span data-raw>{namesOf(mates)}</span></span>
      <select class="input mk-grpmode" aria-label={t('mark.gw_mode')} title={t('mark.gw_mode_tip')} value={mode} onChange={e => pick(e.currentTarget.value)} data-grpmode>
        <option value="0">{t('mark.gw_all')}</option><option value="2">{t('mark.gw_adj')}</option><option value="1">{t('mark.gw_own')}</option></select>
      {own && <Segmented label={t('mark.gw_goes')} value={just ? 'one' : 'all'} onChange={v => C.groupJustSet(v === 'one' ? st.key : null)}
        options={[{ value: 'all', label: t('mark.gw_both') }, { value: 'one', label: t('mark.gw_just', { name: nameOf(st) }) }]} />}
      <span class="grow" />
      <Button size="sm" variant="quiet" title={t('mark.gw_out_tip')} onClick={() => { C.groupOut(st); toast(t('mark.gw_out_done', { name: nameOf(st) }), { undo: C.undo }); }} data-grpout>{t('mark.gw_out')}</Button>
    </div>;
  }
  const sm = G.splitMates(st);
  if (!sm.length) return null;
  return <div class="mk-grp" data-grpband>
    <b>{t('mark.gw_title')}</b><span>{t('mark.gw_split')} <span data-raw>{namesOf(sm.map(o => o.s))}</span>{t('mark.gw_split_own')}</span><span class="grow" />
    <Button size="sm" variant="quiet" title={t('mark.gw_join_tip')} onClick={() => { C.groupJoinSplit(st); toast(t('mark.gw_joined'), { undo: C.undo }); }} data-grpjoin>{t('mark.gw_join')}</Button>
  </div>;
}

// Group work… on a file: each student picked gets their own copy, so the export gives each of them the marked paper. With Mark and
// grade once on (the default), they're one group; Own score for each partner keeps the notes shared and the scores apart.
export function GroupDialog({ st, path, onClose }) {
  const f = st.files.find(x => x.path === path), [, again] = useState(0), [q, setQ] = useState(''), [busy, setBusy] = useState(false);
  const focusFind = () => { const e = document.querySelector('input[data-grpfind]'); if (e) e.focus(); };
  const [once, setOnce] = useState(() => !(G.shareCopies(st, f).length && !groupOf(st))), [own, setOwn] = useState(() => !!(groupOf(st) && groupOf(st).own));
  useEffect(focusFind, []);
  if (!f) return null;
  const words = q.toLowerCase().split(/\s+/).filter(Boolean), mates = G.groupMates(st);
  const rows = b().students.map((s, i) => ({ s, i, label: shownName(s, i) })).filter(x => x.s !== st && words.every(w => x.label.toLowerCase().split(/[\s,_-]+/).some(y => y.startsWith(w))));
  const has = s => s.files.some(x => x.from === st.key && x.name === f.name);
  const give = async s => {
    setBusy(true);
    try { await C.groupGive(st, f, s, once, own); toast(t(once ? 'mark.gw_in' : 'mark.gw_shared', { name: nameOf(s) })); }
    catch (e) { console.error(e); toast((e && e.message) || String(e)); }
    setBusy(false); setQ(''); again(n => n + 1); focusFind();
  };
  return <Dialog open title={t('mark.gw_dlg', { name: f.name.replace(/^.*\//, '') })} onClose={onClose} actions={<Button variant="primary" onClick={onClose} data-grpdone>{t('mark.gw_done')}</Button>}>
    <div data-grponce><Switch checked={once} onChange={v => { setOnce(v); C.groupOnce(st, f, v, own); again(n => n + 1); }} label={t('mark.gw_once')} /></div>
    <p class="mute mk-swsay">{t('mark.gw_once_say')}</p>
    {once && <div data-grpown><Switch checked={own} onChange={v => { setOwn(v); if (groupOf(st)) C.groupMode(st, v ? 1 : 0); again(n => n + 1); }} label={t('mark.gw_own_sw')} /></div>}
    {once && <p class="mute mk-swsay">{t('mark.gw_own_say')}</p>}
    <p class="mute">{t('mark.gw_pick', { name: nameOf(st) })}</p>
    <TextInput icon="search" label={t('mark.gw_find')} value={q} onInput={setQ} onKeyDown={e => { if (e.key === 'Enter' && rows[0]) { e.preventDefault(); const r = rows.find(x => !(once ? mates.includes(x.s) : has(x.s))); if (r) give(r.s); } }} data-grpfind />
    <ul class="mk-mvlist">{rows.map(r => { const inG = mates.includes(r.s), got = has(r.s), done = once ? inG : got;
      return <li><Button variant="quiet" disabled={done || busy} onClick={() => give(r.s)} data-grpto={r.s.key}><span data-raw>{r.label}</span>
        <span class="mute">{inG ? t('mark.gw_is_in') : got ? t('mark.gw_has') : r.s.files.length ? t('mark.gw_files', { n: r.s.files.length }) : t('mark.gw_nothing')}</span></Button></li>; })}</ul>
  </Dialog>;
}
