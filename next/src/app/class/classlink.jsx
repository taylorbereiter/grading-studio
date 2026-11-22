// A class's link to its page in the school's system, in the class header (src/app/screens.js mbLink, askMb): the link when there is
// one, with a way to change it, or a way to add one. Named for her system (Settings > Classes), or "Class page".
// Beside it, Class setup (src/app/screens.js clsSetup): what is set once for a class, one step away: the roster and the class's name,
// Import scores… while it has no roster (the file can become the roster), how it is graded, linked classes, and its place in the
// sidebar. Each opens the box that already does it; nothing here saves on its own except Move up and Move down (one undo step each).
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Button, IconButton, Dialog, TextInput, Menu, Switch, toast } from '../../ui/index.js';
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
      : null}
    {edit && <LinkDialog c={c} sys={sys} url={url} onClose={() => setEdit(false)} />}
  </>;
}
export function LinkDialog({ c, sys, url, onClose }) {
  const [v, setV] = useState(url);
  const save = async () => {
    const u = linkUrl(v); if (v.trim() && !u) { toast(t('class.cl_bad')); return; }
    await setClassLink(t('class.u_link'), c.id, u); onClose();
  };
  return <Dialog open title={sys ? t('class.cl_ask_sys', { sys, name: c.name }) : t('class.cl_ask', { name: c.name })} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} data-clink-save>{t('class.save')}</Button></>}>
    <TextInput label={t('class.cl_label')} hint={t('class.cl_hint')} value={v} maxLength={500} onInput={setV} onKeyDown={e => { if (e.key === 'Enter') save(); }} data-clink-url autoFocus /></Dialog>;
}

// The class's other pages a teacher keeps in the tab row beside the five (src/app/screens.js tabsKept, lib.me.tabs, the keys the
// current app and My setup's classTabs use). Each opens its tool at its own address. Attendance only while attendance is on.
const PINS = [['attendance', 'class.attendance', 'people/attendance'], ['seating', 'class.u_seat', 'people/seating'], ['missing', 'class.mis_title', 'todo/missing'],
  ['charts', 'class.charts', 'grades/charts'], ['goals', 'class.gl_title', 'grades/goals'], ['reports', 'class.rp_title', 'grades/reports']];
const pinsOf = lib => { const me = (lib && lib.me) || {}; return PINS.filter(p => p[0] !== 'attendance' || me.att !== false); };
const keptOf = lib => { const k = Array.isArray(((lib && lib.me) || {}).tabs) ? lib.me.tabs : []; return pinsOf(lib).filter(p => k.includes(p[0])); };
// Tells the class page which tabs to add: [{ id: 'pin:<key>', label, to }]. Draws nothing.
export function KeptTabs({ onTabs }) {
  const b = useBook(), lib = b && !b.error ? b.lib : null, list = keptOf(lib).map(([k, l, to]) => ({ id: 'pin:' + k, label: t(l), to })), sig = list.map(x => x.id).join();
  useEffect(() => { onTabs(list); }, [sig]);
  return null;
}
function TabsDialog({ lib, onClose }) {
  const k = Array.isArray((lib.me || {}).tabs) ? lib.me.tabs : [];
  const flip = (key, on) => change(t('class.kt_step'), l => { const now = Array.isArray((l.me || {}).tabs) ? l.me.tabs.filter(x => x !== key) : []; l.me = { ...(l.me || {}), tabs: on ? [...now, key] : now }; }, true).catch(e => console.error(e));
  return <Dialog open title={t('class.kt_title')} onClose={onClose} actions={<Button variant="primary" onClick={onClose}>{t('common.close')}</Button>}>
    <p class="mute">{t('class.kt_text')}</p>
    <div class="stack" data-kept-tabs>{pinsOf(lib).map(([key, l]) => <span data-kt={key}><Switch label={t(l)} checked={k.includes(key)} onChange={v => flip(key, v)} /></span>)}</div></Dialog>;
}

export function ClassSetup({ classId }) {
  const b = useBook(), [box, setBox] = useState(null);
  const c = b && !b.error ? classIn(b.lib, classId) : null; if (!c) return null;
  const sys = String((b.lib.me || {}).sys || '').trim(), url = classLink(c);
  const all = b.lib.classes, at = all.findIndex(k => String(k.id) === String(c.id));
  const load = (k, part, f) => () => part().then(m => setBox({ k, C: f(m) }), e => console.error(e));
  const place = d => change(t('class.u_order'), l => { const a = l.classes.findIndex(k => String(k.id) === String(c.id)), j = a + d; if (a < 0 || j < 0 || j >= l.classes.length) return; [l.classes[a], l.classes[j]] = [l.classes[j], l.classes[a]]; }, true).catch(e => console.error(e));
  const items = [
    { label: t(c.names.length ? 'class.edit_roster' : 'class.add_roster'), sub: t('class.cs_roster_sub'), icon: 'people', onSelect: load('roster', PARTS.people, m => m.RosterDialog) },
    ...(c.names.length ? [] : [{ label: t('class.bki_menu'), sub: t('class.bki_menu_sub'), icon: 'upload', onSelect: load('imp', PARTS.bki, m => m.ImportSheet) }]),
    { label: t('class.graded_how_short'), icon: 'grades', onSelect: load('way', () => import('./ib.jsx'), m => m.GradingDialog) },
    ...(all.length > 1 ? [{ label: t('class.lk_title'), icon: 'link', onSelect: load('lk', PARTS.linked, m => m.LinkEdit) }] : []),
    ...(url ? [] : [{ label: t('class.cl_add', { what: sys || t('class.cl_page') }), icon: 'link', onSelect: () => setBox({ k: 'link' }) }]),
    { label: t('class.kt_menu'), icon: 'menu', onSelect: () => setBox({ k: 'tabs' }) },
    ...(all.length > 1 ? [{ sep: true }, { label: t('class.c_up'), icon: 'chu', disabled: at <= 0, onSelect: () => place(-1) }, { label: t('class.c_down'), icon: 'chd', disabled: at < 0 || at >= all.length - 1, onSelect: () => place(1) }] : []),
  ];
  const C = box && box.C, k = box && box.k, shut = () => { setBox(null); if (k === 'imp' && ((classIn(fullLibrary(), classId) || {}).names || []).length) go('class', classId, 'grades'); };
  return <>
    <Menu label={t('class.cs_title')} items={items} trigger={m => <Button {...m} size="sm" icon="settings" iconEnd="chd" data-class-setup>{t('class.cs_title')}</Button>} />
    {k === 'link' && <LinkDialog c={c} sys={sys} url="" onClose={() => setBox(null)} />}
    {k === 'tabs' && <TabsDialog lib={b.lib} onClose={() => setBox(null)} />}
    {C && (k === 'imp' ? <C x={classBook(b, classId)} onClose={shut} /> : k === 'lk' ? <C lib={b.lib} classId={classId} onClose={shut} /> : <C c={c} onClose={shut} />)}
  </>;
}
