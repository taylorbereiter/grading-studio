// The lesson's menu (design: Lesson > menu), doing what the current Planner's lesson menu does (src/planner/lessons.js moreClick,
// review.js versionsDlg): copy the lesson as text, save the lesson's file, its versions (look, save one now, go back to one), and
// delete it with undo. Going back keeps where it was taught and saves the version being left, as the Planner does.
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Menu, IconButton, Sheet, Button, Icon, Select, TextInput, toast } from '../../ui/index.js';
import { t, date } from '../../i18n/t.js';
import { go } from '../router.js';
import { engine } from '../../planning/engine.js';
import { saveVersion, saveLesson, deleteLesson, saveLessonFile } from '../../planning/write.js';
import { lessonVersions, lessonBlob } from '../../planning/plan.js';
import { today } from './lessons.js';
import { saveFailed } from './save.js';
import { printLesson } from './print.js';
import './lines.js';

const copy = x => JSON.parse(JSON.stringify(x));
function saveAs(name, b) { const a = document.createElement('a'), url = URL.createObjectURL(b); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
async function copyText(s) { try { await navigator.clipboard.writeText(s); return true; } catch { return false; } }

function Versions({ p, l, onClose, save }) {
  const E = engine(p), [vs, setVs] = useState(null), [busy, setBusy] = useState(false);
  useEffect(() => { lessonVersions(l.id).then(setVs); }, [l.id]);
  const now = async () => { setBusy(true); try { await saveVersion(l, t('plan.ver_by_you'), E.snap, E.MAX_VERSIONS); setVs(await lessonVersions(l.id)); toast(t('plan.ver_saved')); } catch (e) { saveFailed(e); } finally { setBusy(false); } };
  const back = async v => {
    setBusy(true);
    try {
      await saveVersion(l, t('plan.ver_before', { label: v.label }), E.snap, E.MAX_VERSIONS);
      const b = E.normLesson({ ...copy(v.lesson), id: l.id, slots: l.slots, created: l.created, taught: l.taught });
      const seen = new Set([b.final && b.final.id, ...(b.finals || []).map(f => f.id)]);
      const extra = [l.final, ...(l.finals || [])].filter(f => f && !seen.has(f.id));
      if (extra.length) b.finals = [...extra, ...(b.finals || [])];
      const n = { ...copy(l), ...b, _file: l._file, _mod: l._mod }; delete n.pending;
      await save(n); toast(t('plan.ver_back', { label: v.label })); onClose();
    } catch (e) { saveFailed(e); } finally { setBusy(false); }
  };
  return <Sheet open title={t('plan.versions_of', { title: l.title || t('plan.untitled') })} icon={<Icon name="copy" />} onClose={onClose}
    footer={<><Button disabled={busy} onClick={now} data-focus="ver-now">{t('plan.ver_save_now')}</Button><span class="grow" /><Button variant="quiet" onClick={onClose}>{t('common.close')}</Button></>}>
    {!vs ? <div class="loading" aria-busy="true" /> : vs.length ? <ul class="list vers">{vs.map(v => <li><div class="lrow"><span class="main"><b data-raw>{v.label}</b>
      <small>{date(new Date(v.at), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {t('plan.n_slides', { n: ((v.lesson && v.lesson.slides) || []).length })}</small></span>
      <span class="end"><Button size="sm" disabled={busy} onClick={() => back(v)}>{t('plan.ver_go_back')}</Button></span></div></li>)}</ul>
      : <p class="mute">{t('plan.no_versions')}</p>}
  </Sheet>;
}

// A copy of the lesson for another class or day (src/planner/extras.js copyLesson): its own slides, notes and materials, so
// changing one doesn't change the other; not taught, not ready.
function CopyTo({ p, l, onClose }) {
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

export function LessonMenu({ p, l, save, onTool = () => {}, extra = [] }) {
  const E = engine(p), [vers, setVers] = useState(false), [copying, setCopying] = useState(false);
  const items = [...extra,
    { id: 'copy', label: t('plan.copy_text'), icon: 'copy', onSelect: async () => toast(await copyText(E.lessonText(copy(l))) ? t('plan.copied') : t('plan.copy_failed')) },
    { id: 'file', label: t('plan.save_file'), icon: 'download', onSelect: () => saveAs(E.fileBase(l) + '.lesson.json', new Blob([JSON.stringify(E.lessonForFile(copy(l), null), null, 2)], { type: 'application/json' })) },
    { id: 'print', label: t('plan.print_plan'), icon: 'file', onSelect: () => printLesson(p, l) },
    { id: 'copyto', label: t('plan.copy_to'), icon: 'copy', onSelect: () => setCopying(true) },
    { id: 'versions', label: t('plan.versions'), icon: 'copy', onSelect: () => setVers(true) },
    { id: 'variant', label: t('plan.make_variant'), icon: 'copy', onSelect: () => onTool('variant') },
    { sep: true },
    { id: 'share', label: t('plan.share_file'), icon: 'mail', onSelect: () => onTool('share') },
    { id: 'import', label: t('plan.import_lesson'), icon: 'upload', onSelect: () => onTool('import') },
    { id: 'final', label: t('plan.finished_pptx'), icon: 'slides', onSelect: () => onTool('finished') },
    { id: 'zip', label: t('plan.download_all'), icon: 'download', onSelect: () => onTool('zip') },
    { id: 'beside', label: t('plan.beside'), icon: 'book', onSelect: () => onTool('beside') },
    { sep: true },
    { id: 'delete', label: t('plan.delete_lesson'), icon: 'trash', onSelect: async () => {
      const was = copy(l);
      try { await deleteLesson(l); } catch (e) { return saveFailed(e); }
      go('calendar');
      toast(t('plan.lesson_deleted'), { undo: async () => { try { const { _file, _mod, ...back } = was; await saveLesson(back); go('lesson', was.id); toast(t('plan.lesson_back')); } catch (e) { saveFailed(e); } } });
    } },
  ];
  return <>
    <Menu label={t('plan.lesson_menu')} items={items} trigger={pr => <IconButton icon="dots" label={t('plan.lesson_menu')} {...pr} data-focus="lesson-menu" />} />
    {copying && <CopyTo p={p} l={l} onClose={() => setCopying(false)} />}
    {vers && <Versions p={p} l={l} save={save} onClose={() => setVers(false)} />}
  </>;
}
