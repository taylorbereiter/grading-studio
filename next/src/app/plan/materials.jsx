// A lesson's materials and links (design: Lesson > Materials), kept as the current Planner keeps them (src/planner/materials.js,
// links.js): files in l.files [{ id, name, kind, type, size, added }] with the bytes in kv file:<id>; links in l.links
// [{ id, name, url }], only addresses, each opening in a new tab. Replace keeps the file's id, so anything that points at it still
// does. Taking a file or link off can be undone from the toast. Planning material only, never student work.
import { h, Fragment } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { Button, IconButton, Icon, TextInput, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { engine } from '../../planning/engine.js';
import { saveLessonFile, dropLessonFile } from '../../planning/write.js';
import { lessonBlob } from '../../planning/plan.js';
import { saveFailed } from './save.js';

const copy = x => JSON.parse(JSON.stringify(x));
const ICON = f => f.kind === 'doc' ? 'note' : /^image\//.test(f.type || '') ? 'image' : 'file';
const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
function saveAs(name, b) { const a = document.createElement('a'), url = URL.createObjectURL(b); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }

export function Materials({ p, l, onSave }) {
  const E = engine(p), files = l.files || [], links = l.links || [];
  const pick = useRef(), form = useRef(), swap = useRef(''), [over, setOver] = useState(false), [adding, setAdding] = useState(false), [url, setUrl] = useState(''), [name, setName] = useState('');
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
    const b = await lessonBlob(f.id); if (!b) return toast(t('plan.file_missing'));
    const type = f.kind === 'doc' ? 'text/html' : b.type || f.type;
    if (/^image\/|pdf|text\/html/.test(type) || /\.pdf$/i.test(f.name)) { const u = URL.createObjectURL(new Blob([b], { type: /\.pdf$/i.test(f.name) ? 'application/pdf' : type })); window.open(u, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(u), 120000); }
    else saveAs(f.name, b);
  };
  const remove = async f => {
    const b = await lessonBlob(f.id), n = copy(l); n.files = n.files.filter(x => x.id !== f.id); if (!n.files.length) delete n.files;
    await put(n); await dropLessonFile(f.id).catch(e => console.error(e));
    toast(t('plan.removed', { name: f.name }), { undo: async () => { if (b) await saveLessonFile(b, f.id); const m = copy(n); m.files = [...(m.files || []), f]; await put(m); } });
  };
  // Read from the boxes themselves, so a key pressed straight after typing never misses the last letter.
  const addLink = async () => {
    const box = form.current ? [...form.current.querySelectorAll('input')] : [], uv = box[0] ? box[0].value : url, nv = box[1] ? box[1].value : name;
    const u = E.lkUrl(uv); if (!u) return toast(t('plan.link_bad'));
    const n = copy(l); n.links = E.normLinks([...(n.links || []), { name: nv.trim(), url: u }]);
    setUrl(''); setName(''); setAdding(false); await put(n);
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
      {files.map(f => <li><button type="button" class="link mopen" onClick={() => open(f)}><Icon name={ICON(f)} size="sm" /><span data-raw>{f.name}</span></button>
        {f.size > 0 && <small class="mute num">{kb(f.size)}</small>}
        {f.kind !== 'doc' && <IconButton icon="replace" size="sm" label={t('file.replace')} onClick={() => { swap.current = f.id; pick.current.multiple = false; pick.current.click(); pick.current.multiple = true; }} />}
        <IconButton icon="trash" size="sm" label={t('common.remove')} onClick={() => remove(f)} /></li>)}
      {links.map(x => <li><a class="link mopen" href={x.url} target="_blank" rel="noopener"><Icon name="link" size="sm" /><span data-raw>{x.name}</span></a>
        <small class="mute" data-raw>{E.lkHost(x.url)}</small><IconButton icon="trash" size="sm" label={t('common.remove')} onClick={() => removeLink(x)} /></li>)}
    </ul>
    {adding ? <div class="mlink" ref={form}>
      <TextInput label={t('plan.link_address')} type="url" value={url} onInput={setUrl} onKeyDown={e => { if (e.key === 'Enter') addLink(); }} data-focus="link-url" />
      <TextInput label={t('plan.link_name')} value={name} onInput={setName} onKeyDown={e => { if (e.key === 'Enter') addLink(); }} />
      <div class="row"><Button size="sm" variant="quiet" onClick={() => setAdding(false)}>{t('common.cancel')}</Button><Button size="sm" variant="primary" onClick={addLink} data-focus="link-add">{t('plan.add_link')}</Button></div></div>
      : <div class="row"><Button size="sm" icon="upload" onClick={() => { swap.current = ''; pick.current.click(); }} data-focus="add-files">{t('plan.add_files')}</Button>
        <Button size="sm" icon="link" onClick={() => setAdding(true)} data-focus="add-link">{t('plan.add_link')}</Button></div>}
  </section>;
}
