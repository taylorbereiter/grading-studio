// A class's link to its page in the school's system, in the class header (src/app/screens.js mbLink, askMb): the link when there is
// one, with a way to change it, or a way to add one. Named for her system (Settings > Classes), or "Class page".
// Beside it, Class setup (src/app/screens.js clsSetup): what is set once for a class, one step away: the roster and the class's name,
// Import scores… while it has no roster (the file can become the roster), how it is graded, linked classes, and its place in the
// sidebar. Each opens the box that already does it; nothing here saves on its own except Move up and Move down (one undo step each).
import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { Button, IconButton, Dialog, TextInput, Menu, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { go, PARTS } from '../router.js';
import { useBook, classBook, fullLibrary } from './data.js';
import { classIn, classLink, setClassLink, linkUrl, change } from '../../students/book.js';
import './lines.js';

export function ClassLink({ classId }) {
  const b = useBook(), [edit, setEdit] = useState(false);
  const c = b && !b.error ? classIn(b.lib, classId) : null; if (!c) return null;
  const sys = String((b.lib.me || {}).sys || '').trim(), what = sys || t('class.cl_page'), url = classLink(c);
  return <>
    {url ? <span class="row gap-s" data-clink><a class="btn sm" href={url} target="_blank" rel="noopener" data-clink-go><span data-raw={sys ? '' : undefined}>{what}</span> ↗</a>
      <IconButton size="sm" icon="edit" label={t('class.cl_change', { what })} onClick={() => setEdit(true)} data-clink-edit /></span>
      : <Button size="sm" variant="quiet" icon="link" onClick={() => setEdit(true)} data-clink-add>{t('class.cl_add', { what })}</Button>}
    {edit && <LinkDialog c={c} sys={sys} url={url} onClose={() => setEdit(false)} />}
  </>;
}
function LinkDialog({ c, sys, url, onClose }) {
  const [v, setV] = useState(url);
  const save = async () => {
    const u = linkUrl(v); if (v.trim() && !u) { toast(t('class.cl_bad')); return; }
    await setClassLink(t('class.u_link'), c.id, u); onClose();
  };
  return <Dialog open title={sys ? t('class.cl_ask_sys', { sys, name: c.name }) : t('class.cl_ask', { name: c.name })} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} data-clink-save>{t('class.save')}</Button></>}>
    <TextInput label={t('class.cl_label')} hint={t('class.cl_hint')} value={v} maxLength={500} onInput={setV} onKeyDown={e => { if (e.key === 'Enter') save(); }} data-clink-url autoFocus /></Dialog>;
}


export function ClassSetup({ classId }) {
  const b = useBook(), [box, setBox] = useState(null);
  const c = b && !b.error ? classIn(b.lib, classId) : null; if (!c) return null;
  const all = b.lib.classes, at = all.findIndex(k => String(k.id) === String(c.id));
  const load = (k, part, f) => () => part().then(m => setBox({ k, C: f(m) }), e => console.error(e));
  const place = d => change(t('class.u_order'), l => { const a = l.classes.findIndex(k => String(k.id) === String(c.id)), j = a + d; if (a < 0 || j < 0 || j >= l.classes.length) return; [l.classes[a], l.classes[j]] = [l.classes[j], l.classes[a]]; }, true).catch(e => console.error(e));
  const items = [
    { label: t(c.names.length ? 'class.edit_roster' : 'class.add_roster'), sub: t('class.cs_roster_sub'), icon: 'people', onSelect: load('roster', PARTS.people, m => m.RosterDialog) },
    ...(c.names.length ? [] : [{ label: t('class.bki_menu'), sub: t('class.bki_menu_sub'), icon: 'upload', onSelect: load('imp', PARTS.bki, m => m.ImportSheet) }]),
    { label: t('class.graded_how_short'), icon: 'grades', onSelect: load('way', () => import('./ib.jsx'), m => m.GradingDialog) },
    ...(all.length > 1 ? [{ label: t('class.lk_title'), icon: 'link', onSelect: load('lk', PARTS.linked, m => m.LinkEdit) }] : []),
    ...(all.length > 1 ? [{ sep: true }, { label: t('class.c_up'), icon: 'chu', disabled: at <= 0, onSelect: () => place(-1) }, { label: t('class.c_down'), icon: 'chd', disabled: at < 0 || at >= all.length - 1, onSelect: () => place(1) }] : []),
  ];
  const C = box && box.C, k = box && box.k, shut = () => { setBox(null); if (k === 'imp' && ((classIn(fullLibrary(), classId) || {}).names || []).length) go('class', classId, 'grades'); };
  return <>
    <Menu label={t('class.cs_title')} items={items} trigger={m => <Button {...m} size="sm" icon="settings" iconEnd="chd" data-class-setup>{t('class.cs_title')}</Button>} />
    {C && (k === 'imp' ? <C x={classBook(b, classId)} onClose={shut} /> : k === 'lk' ? <C lib={b.lib} classId={classId} onClose={shut} /> : <C c={c} onClose={shut} />)}
  </>;
}
