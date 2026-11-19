// A lesson's materials and links (design: Lesson > Materials), kept as the current Planner keeps them (src/planner/materials.js,
// links.js): files in l.files [{ id, name, kind, type, size, added }] with the bytes in kv file:<id>; links in l.links
// [{ id, name, url }], only addresses, each opening in a new tab. Replace keeps the file's id, so anything that points at it still
// does. Taking a file or link off can be undone from the toast. Planning material only, never student work.
import { h, Fragment } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { Button, IconButton, Icon, Menu, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { engine } from '../../planning/engine.js';
import { saveLessonFile, dropLessonFile } from '../../planning/write.js';
import { lessonBlob } from '../../planning/plan.js';
import { school } from '../../planning/index.js';
import { isExample, loadExample } from './examples.js';
import { classOf } from './lessons.js';
import { href } from '../router.js';
import { saveFailed } from './save.js';
import './lines.js';
import { useDrivePick } from '../drive-button.jsx';

const copy = x => JSON.parse(JSON.stringify(x));
const ICON = f => f.kind === 'doc' ? 'note' : /^image\//.test(f.type || '') ? 'image' : 'file';
const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
function saveAs(name, b) { const a = document.createElement('a'), url = URL.createObjectURL(b); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }

// The lasting links of the classes this lesson is for, from School (gs.school items with classes; src/planner/links.js lkClassGroups):
// one group for each course, with the names of that class's other School resources, which open on the School page.
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function classGroups(p, l, E) {
  let v = null; try { v = school.json(null); } catch { }
  const items = (v && Array.isArray(v.items) ? v.items : []).filter(i => i && i.id && !i.gone && Array.isArray(i.cls) && i.cls.length), out = [], seen = new Set();
  if (!items.length) return out;
  for (const s of l.slots || []) {
    const c = classOf(p, s.classId); if (!c) continue;
    const label = c.course || c.name, k = norm(label); if (seen.has(k)) continue; seen.add(k);
    const keys = new Set([norm(c.course), norm(c.name)].filter(Boolean)), mine = items.filter(i => i.cls.some(n => keys.has(norm(n))));
    const links = mine.filter(i => i.kind === 'link' && E.lkUrl(i.url)).map(i => ({ id: String(i.id), name: String(i.name || E.lkHost(i.url)), url: E.lkUrl(i.url) })), more = mine.filter(i => !(i.kind === 'link' && E.lkUrl(i.url))).map(i => String(i.name || ''));
    if (links.length || more.length) out.push({ label, links, more });
  }
  return out;
}

export function Materials({ p, l, onSave, onTool = () => {}, More }) {
  const E = engine(p), files = l.files || [], links = l.links || [];
  const pick = useRef(), drive = useDrivePick(pick, true), swap = useRef(''), [over, setOver] = useState(false), [adding, setAdding] = useState(null);
  const put = async n => { try { await onSave(n); } catch (e) { saveFailed(e); } };
  const add = async list => {
    const n = copy(l); n.files = n.files || []; let k = 0;
    for (const f of list) {
      if (f.size > E.MAX_FILE) { toast(t('plan.file_too_big', { name: f.name })); continue; }
      if (swap.current) {
        const old = n.files.find(x => x.id === swap.current); if (!old) continue;
        await saveLessonFile(f, old.id);
        Object.assign(old, { name: E.uniqueName({ files: n.files.filter(x => x !== old) }, f.name || old.name), kind: 'other', type: f.type || '', size: f.size, added: Date.now() });
        toast(t('plan.replaced', { name: old.name })); k++; break;
      }
      const id = E.lid(); await saveLessonFile(f, id);
      n.files.push({ id, name: E.uniqueName(n, f.name || 'File'), kind: 'other', type: f.type || '', size: f.size, added: Date.now() }); k++;
    }
    swap.current = '';
    if (k) await put(n);
  };
  const open = async f => {
    if (f.kind === 'doc') return onTool('doc', f.id);
    if (isExample(f.id)) { const u = await loadExample(f.id); return u ? window.open(u, '_blank', 'noopener') : toast(t('plan.file_missing')); }
    const b = await lessonBlob(f.id); if (!b) return toast(t('plan.file_missing'));
    const type = f.kind === 'doc' ? 'text/html' : b.type || f.type;
    if (/^image\/|pdf|text\/html/.test(type) || /\.pdf$/i.test(f.name)) { const u = URL.createObjectURL(new Blob([b], { type: /\.pdf$/i.test(f.name) ? 'application/pdf' : type })); window.open(u, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(u), 120000); }
    else saveAs(f.name, b);
  };
  const remove = async f => {
    const ex = isExample(f.id), b = ex ? null : await lessonBlob(f.id), n = copy(l); n.files = n.files.filter(x => x.id !== f.id); if (!n.files.length) delete n.files;
    await put(n); if (!ex) await dropLessonFile(f.id).catch(e => console.error(e));
    toast(t('plan.removed', { name: f.name }), { undo: async () => { if (b) await saveLessonFile(b, f.id); const m = copy(n); m.files = [...(m.files || []), f]; await put(m); } });
  };
  const removeLink = async x => {
    const n = copy(l); n.links = n.links.filter(y => y.id !== x.id); if (!n.links.length) delete n.links;
    await put(n); toast(t('plan.removed', { name: x.name }), { undo: () => { const m = copy(n); m.links = E.normLinks([...(m.links || []), x]); put(m); } });
  };
  return <section class={'mats' + (over ? ' over' : '')} aria-labelledby="h-mats"
    onDragOver={e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)}
    onDrop={e => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); setOver(false); swap.current = ''; add([...e.dataTransfer.files]); }}>
    <h2 class="sub" id="h-mats">{t('plan.materials')}</h2>
    <input ref={pick} type="file" hidden multiple onChange={e => { const fs = [...e.currentTarget.files]; e.currentTarget.value = ''; add(fs); }} data-mats />
    {files.length + links.length === 0 && <p class="mute">{t('plan.no_materials')}</p>}
    <ul class="mlist">
      {files.map(f => <li><button type="button" class="link mopen" onClick={() => open(f)} draggable onDragStart={e => e.dataTransfer.setData('text/x-chip', JSON.stringify({ kind: 'file', t: 'lesson', owner: l.id, id: f.id, label: f.name }))}><Icon name={ICON(f)} size="sm" /><span data-raw>{f.name}</span></button>
        {f.size > 0 && <small class="mute num">{kb(f.size)}</small>}
        {More && /\.docx$/i.test(f.name) && <IconButton icon="edit" size="sm" label={More.matWords().editCopy} onClick={() => onTool('editdocx', f.id)} data-editcopy={f.id} />}
        {More && !isExample(f.id) && <IconButton icon="download" size="sm" label={More.matWords().download} onClick={() => onTool('dl', f)} data-dl={f.id} />}
        {f.kind !== 'doc' && !isExample(f.id) && <IconButton icon="replace" size="sm" label={t('file.replace')} onClick={() => { swap.current = f.id; pick.current.multiple = false; pick.current.click(); pick.current.multiple = true; }} />}
        <IconButton icon="trash" size="sm" label={t('common.remove')} onClick={() => remove(f)} /></li>)}
      {links.map(x => <li><a class="link mopen" href={x.url} target="_blank" rel="noopener"><Icon name="link" size="sm" /><span data-raw>{x.name}</span></a>
        <small class="mute" data-raw>{E.lkHost(x.url)}</small>{More && <IconButton icon="pen" size="sm" label={t('common.edit')} onClick={() => setAdding({ was: x })} data-lkedit={x.id} />}<IconButton icon="trash" size="sm" label={t('common.remove')} onClick={() => removeLink(x)} /></li>)}
    </ul>
    {classGroups(p, l, E).map(g => <div class="lkgroup"><p class="lkh"><b>{t('plan.for_all_year', { name: g.label })}</b><a class="link" href={href('school')}>{t('plan.change_in_school')}</a></p>
      <ul class="mlist">{g.links.map(x => <li><a class="link mopen" href={x.url} target="_blank" rel="noopener"><Icon name="link" size="sm" /><span data-raw>{x.name}</span></a><small class="mute" data-raw>{E.lkHost(x.url)}</small></li>)}</ul>
      {g.more.length > 0 && <p class="mute small">{t('plan.also_in_school', { name: g.label })} <span data-raw>{g.more.join(', ')}</span></p>}</div>)}
    {adding && More ? <More.LinkForm p={p} l={l} was={adding.was} save={put} onClose={() => setAdding(null)} />
      : <div class="row">{drive ? <Menu label={t('plan.add_files')} trigger={b => <Button {...b} size="sm" icon="upload" data-focus="add-files">{t('plan.add_files')}</Button>}
          items={[{ label: t('file.from_computer'), icon: 'upload', onSelect: () => { swap.current = ''; pick.current.click(); } }, { label: t('file.from_drive_pick'), icon: 'drive', onSelect: () => { swap.current = ''; drive(); } }]} />
          : <Button size="sm" icon="upload" onClick={() => { swap.current = ''; pick.current.click(); }} data-focus="add-files">{t('plan.add_files')}</Button>}
        <Button size="sm" icon="link" onClick={() => setAdding({})} data-focus="add-link">{t('plan.add_link')}</Button>
        <Button size="sm" icon="note" onClick={() => onTool('newdoc')} data-focus="new-doc">{t('plan.new_document')}</Button>
        <Button size="sm" icon="image" onClick={() => onTool('example')} data-focus="add-example-mat">{t('plan.add_example')}</Button></div>}
  </section>;
}
