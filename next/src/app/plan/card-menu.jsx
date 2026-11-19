// The Calendar's occasional tools, loaded the first time one is wanted (router.js PARTS.calx): what a lesson card's menu does
// (src/planner/lessons.js week cards: download, present today, copy to another day, delete; extras.js ctxOpen), a class's page
// link on the week (lessons.js mbDlg, kept on the class in the timetable and by name in gs.mblinks, as both apps read it), and
// a unit opened from the week's unit bar (units.js weekUnitBar).
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Dialog, Sheet, Button, IconButton, Icon, Select, TextInput, Chip, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { go, href, PARTS } from '../router.js';
import { engine } from '../../planning/engine.js';
import { saveLesson, deleteLesson, saveKv, savePref, saveLessonFile } from '../../planning/write.js';
import { lessonBlob } from '../../planning/plan.js';
import { today, classOf, at } from './lessons.js';
import './lines.js';
import { manageBacLinks } from '../../planning/index.js';
import { saveFailed } from './save.js';
import { linkOf, mbUrl, linkKey } from './classlink.js';
import './cal-lines.js';
export { UnitSheet } from './unit-edit.jsx';

const copy = x => JSON.parse(JSON.stringify(x));
function saveAs(name, b) { const a = document.createElement('a'), url = URL.createObjectURL(b); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }

// A copy of the lesson for another class or day, as the lesson menu makes it (plan/lesson-menu.jsx CopyTo, written again here so
// the lesson page's chunk stays whole; src/planner/extras.js copyLesson): its own slides, notes and materials, so
// changing one doesn't change the other; not taught, not ready.
export function CopyTo({ p, l, onClose }) {
  const E = engine(p), cls = (p.setup && p.setup.classes) || [], s0 = (l.slots || [])[0];
  const [c, setC] = useState(s0 ? s0.classId : ''), [d, setD] = useState(s0 ? s0.date : today()), [title, setTitle] = useState(l.title || ''), [busy, setBusy] = useState(false);
  const make = async () => {
    setBusy(true);
    try {
      const j = copy(l); delete j._file; delete j._mod; delete j._sync; delete j.pending; delete j.taught; delete j.ready;
      j.id = E.lid(); j.title = title.trim() || l.title; j.slots = c && d ? [{ classId: c, date: d }] : []; j.created = j.updated = Date.now(); j.status = ''; j.claudeNote = '';
      j.slides = j.slides.map(s => ({ ...s, id: E.lid() })); j.files = [];
      for (const f of l.files || []) { const b = await lessonBlob(f.id); if (!b) continue; const id = E.lid(); await saveLessonFile(b, id); j.files.push({ ...f, id, added: Date.now() }); }
      const n = await saveLesson(E.normLesson(j));
      toast(t('plan.copied_lesson')); onClose(); go('lesson', n.id);
    } catch (e) { saveFailed(e); } finally { setBusy(false); }
  };
  return <Sheet open title={t('plan.copy_named', { title: l.title || t('plan.untitled') })} icon={<Icon name="copy" />} onClose={onClose}
    footer={<><span class="grow" /><Button variant="quiet" onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" disabled={busy} onClick={make} data-focus="copy-make">{t('plan.make_copy')}</Button></>}>
    <div class="actedit">
      {cls.length > 0 && <><Select label={t('plan.class')} value={c} options={[{ value: '', label: t('plan.no_class') }, ...cls.map(x => ({ value: x.id, label: x.name }))]} onChange={setC} data-raw />
        <TextInput label={t('plan.date')} type="date" value={d} onInput={setD} /></>}
      <TextInput label={t('plan.lesson_title')} value={title} onInput={setTitle} data-focus="copy-title" />
      <p class="mute">{t('plan.copy_own')}</p></div>
  </Sheet>;
}

// The finished PowerPoint when it is up to date with the slides, else one made from the slides (as the lesson's Download does).
export async function download(p, l) {
  try {
    if (l.final) { const T = await PARTS.tools(); if (T.finFresh(l)) return T.downloadFinal(l); }
    const E = engine(p);
    saveAs(E.fileBase(l) + '.pptx', new Blob([E.buildPptx(l)], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }));
  } catch (e) { console.error(e); toast(t('plan.pptx_failed')); }
}
export async function remove(l) {
  const was = copy(l);
  try { await deleteLesson(l); } catch (e) { return saveFailed(e); }
  toast(t('plan.lesson_deleted'), { undo: async () => { try { const { _file, _mod, ...back } = was; await saveLesson(back); toast(t('plan.lesson_back')); } catch (e) { saveFailed(e); } } });
}

// A class's page in the school's system: set on the class in the timetable and remembered by its name for the grading side.
export function LinkDialog({ p, c, onClose }) {
  const [v, setV] = useState(linkOf(c));
  const save = async () => {
    const u = mbUrl(v); if (v.trim() && !u) return toast(t('cal.link_bad'));
    try {
      const s = copy(p.setup), k = s.classes.find(x => String(x.id) === String(c.id)); if (!k) return onClose();
      if (u) k.mb = u; else delete k.mb;
      await saveKv('setup', s);
      const m = { ...(manageBacLinks.json(null) || {}) }, n = linkKey(c.name); if (n) { if (u) m[n] = u; else delete m[n]; savePref('gs.mblinks', m); }
      onClose();
    } catch (e) { saveFailed(e); }
  };
  return <Dialog open title={t('cal.link_title', { name: c.name })} onClose={onClose}
    actions={<><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} data-link-save>{t('common.save')}</Button></>}>
    <TextInput label={t('cal.link_label')} hint={t('cal.link_hint')} value={v} maxLength={500} onInput={setV} onKeyDown={e => { if (e.key === 'Enter') save(); }} data-link-url autoFocus /></Dialog>;
}

// A lesson on no class or day (src/planner/lessons.js "Make a lesson without a class", rail.js "Make a new lesson"): it waits under
// Not on the calendar until it is put on one.
export async function newLoose(p) {
  try {
    const E = engine(p), name = t('plan.new_lesson');
    const l = await saveLesson(E.deckStart(E.normLesson({ title: name, slots: [], slides: [{ layout: 'title', title: name, fmt: 2 }, { layout: 'content', title: '', body: '', fmt: 2 }] })));
    go('lesson', l.id);
  } catch (e) { saveFailed(e); }
}
// Every lesson in one list (src/planner/lessons.js allLessonsDlg): found by its title, its classes or its dates; opened; deleted
// with a second press (and Undo). Those not on the timetable can be shown on their own.
export function AllLessons({ p, loose: only0, onClose }) {
  const [q, setQ] = useState(''), [only, setOnly] = useState(!!only0), [sure, setSure] = useState('');
  const fold = x => String(x || '').toLowerCase();
  const where = l => (l.slots || []).map(s => ((classOf(p, s.classId) || {}).name || '') + ' ' + date(at(s.date), { day: 'numeric', month: 'short' })).join(', ');
  const all = [...(p.lessons || [])].sort((a, b) => ((b.slots || [])[0] || {}).date > ((a.slots || [])[0] || {}).date ? 1 : -1);
  const shown = all.filter(l => (!only || !(l.slots || []).length) && (!q.trim() || fold(l.title + ' ' + where(l)).includes(fold(q.trim()))));
  const del = l => { if (sure !== l.id) return setSure(l.id); setSure(''); remove(l); };
  return <Sheet open wide title={t('cal.all_lessons')} icon={<Icon name="slides" />} onClose={onClose}
    footer={<><Button icon="plus" onClick={() => { onClose(); newLoose(p); }} data-all-new>{t('cal.new_loose')}</Button><span class="grow" /><Button variant="quiet" onClick={onClose}>{t('common.close')}</Button></>}>
    <div class="row gap-s"><span class="grow"><TextInput label={t('cal.all_find')} icon="search" value={q} onInput={setQ} data-all-find /></span>
      <Chip on={only} onClick={() => setOnly(!only)} data-all-loose>{t('cal.no_slot')}</Chip></div>
    <p class="mute">{t('cal.n_lessons', { n: shown.length })}</p>
    {shown.length ? <ul class="list alll">{shown.map(l => <li><div class="lrow"><a class="main link" href={href('lesson', l.id)} onClick={onClose} data-all-open={l.id}><b data-raw>{l.title || t('plan.untitled')}</b>
      <small data-raw={(l.slots || []).length ? '' : undefined}>{(l.slots || []).length ? where(l) : t('cal.no_slot')}</small></a>
      <span class="end">{sure === l.id ? <Button size="sm" variant="quiet" icon="trash" onClick={() => del(l)} data-all-del={l.id}>{t('cal.del_sure')}</Button>
        : <IconButton size="sm" icon="trash" label={t('plan.delete_lesson')} onClick={() => del(l)} data-all-del={l.id} />}</span></div></li>)}</ul>
      : <p class="mute">{t('cal.none_found')}</p>}
  </Sheet>;
}
