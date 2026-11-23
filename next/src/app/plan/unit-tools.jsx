// A unit's occasional tools on the Course line, loaded when the page wants them (router.js PARTS.unit), doing what the current
// Planner's unit page does (src/planner/units.js renderUnit, addUnitFiles, viewFile, askWeeks, pasteWeeksDlg):
//   UnitSide     beside the weeks: the unit's goals (the standards its weeks name, and its summative tasks), its summative and unit
//                files (added, opened, a new document written here and put in the assistant's box, kind changed, replaced, downloaded,
//                taken off with undo) and the screenshots of its unit plan
//   UnitAssist   the weeks filled by the teacher's assistant from those screenshots: one self-contained message (it never names a
//                folder, path or file on anyone's computer), the screenshots attached by hand, and one .zip back with unit.json, also
//                given as a file of its own; or its weeks pasted as lines. Looked at, then kept.
// A unit's files are planning files only, never a student's work. Units are kept in kv "units" as the current Planner keeps them.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Sheet, Dialog, Button, IconButton, Icon, Select, Menu, toast } from '../../ui/index.js';
import { TextBox } from '../../ui/services.jsx';
import { t, date } from '../../i18n/t.js';
import { PARTS, href } from '../router.js';
import { engine } from '../../planning/engine.js';
import { saveKv, saveLessonFile, dropLessonFile } from '../../planning/write.js';
import { lessonBlob } from '../../planning/plan.js';
import { words } from '../../planning/index.js';
import { at } from './lessons.js';
import { assistant } from '../../services/assistant.js';
import { saveFailed } from './save.js';
import { usePart } from '../parts.js';
import './lines.js';
import './more-lines.js';
import './cal-lines.js';
import './les-lines.js';
import { boxAdd } from './cbox.js';
import { UnitBank } from './bank-edit.jsx';
import { DriveButton, useDrivePick } from '../drive-button.jsx';

const copy = x => JSON.parse(JSON.stringify(x));
const aiName = () => assistant().name || t('assistant.generic');
const kb = n => n > 1e6 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const DOC = 'text/html';
const esc = s => String(s).replace(/[&"><]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function saveAs(name, b) { const a = document.createElement('a'), url = URL.createObjectURL(b); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
// The name of the teacher's unit plan tool (Settings > Classes and terms), when given.
const toolName = () => { const w = words.json(null); return (w && typeof w.unit === 'string' && w.unit.trim()) || ''; };

export async function saveUnit(p, u) {
  const E = engine(p), n = E.normUnit({ ...u, updated: Date.now() });
  const list = (p.units || []).filter(x => x.id !== n.id); list.push(n);
  await saveKv('units', list); return n;
}
// Files added to a unit: pasted screenshots get a plain name, Planner-style (units.js addUnitFiles).
export async function addFiles(p, u, files, kind) {
  const E = engine(p), n = copy(u); let k = 0;
  for (const f of files) {
    if (f.size > E.MAX_FILE) { toast(t('more.too_big', { name: f.name })); continue; }
    const kk = kind || (/summative|task|rubric/i.test(f.name) ? 'summative' : 'other'), pasted = !f.name || f.name === 'image.png';
    const name = E.uniqueName(n, pasted ? (kk === 'atlas' ? (toolName() || t('more.unit_plan')) + ' ' + (n.files.filter(x => x.kind === 'atlas').length + 1) : t('more.picture')) + '.png' : f.name);
    const id = E.lid(); await saveLessonFile(f, id);
    n.files.push({ id, name, kind: kk, type: f.type || '', size: f.size, added: Date.now() }); k++;
  }
  if (k) { await saveUnit(p, n); toast(t('more.added_n', { n: k })); }
  return n;
}

function Thumb({ id, alt }) {
  const [u, setU] = useState('');
  useEffect(() => { let url = ''; lessonBlob(id).then(b => { if (b) { url = URL.createObjectURL(b); setU(url); } }); return () => url && URL.revokeObjectURL(url); }, [id]);
  return u ? <img src={u} alt={alt} data-raw /> : <span class="ph" />;
}

/* ---------- beside the weeks ---------- */
export function UnitSide({ p, u }) {
  const [big, setBig] = useState(null), [doc, setDoc] = useState(null), [asking, setAsking] = useState(false), [over, setOver] = useState(false), [overF, setOverF] = useState(false);
  const shotIn = useRef(null), fileIn = useRef(null), shotDrive = useDrivePick(shotIn);   // the file boxes Google Drive's chooser fills (drive-button.jsx)
  const took = kind => e => { const fs = [...e.currentTarget.files]; e.currentTarget.value = ''; if (fs.length) addFiles(p, u, fs, kind).catch(saveFailed); };
  const Doc = usePart('doc', !!doc), E = engine(p), name = aiName(), tool = toolName();
  const shots = u.files.filter(f => f.kind === 'atlas'), files = u.files.filter(f => f.kind !== 'atlas');
  const stds = [...new Set(u.weeks.flatMap(w => String(w.standards || '').split(/[,;]+/).map(s => s.trim()).filter(Boolean)))];
  const summ = files.filter(f => f.kind === 'summative');
  const pickFiles = (kind, accept) => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; if (accept) i.accept = accept; i.onchange = () => addFiles(p, u, [...i.files], kind).catch(saveFailed); i.click(); };
  const open = async f => {
    if (f.kind === 'doc') return setDoc(f.id);
    const b = await lessonBlob(f.id); if (!b) return toast(t('more.file_missing'));
    if (/^image\//.test(b.type || f.type)) return setBig({ f, url: URL.createObjectURL(b) });
    if (/pdf/.test(b.type || f.type) || /\.pdf$/i.test(f.name)) { const url = URL.createObjectURL(new Blob([b], { type: 'application/pdf' })); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 120000); return; }
    saveAs(f.name, b);
  };
  const download = async f => { const b = await lessonBlob(f.id); if (!b) return toast(t('more.file_missing')); if (f.kind === 'doc') { const T = await import('../../engines/plantools.js'); saveAs(f.name + '.docx', await T.docxOf(await b.text(), f.name)); } else saveAs(f.name, b); };
  const put = fn => { const n = copy(u); fn(n); return saveUnit(p, n).catch(saveFailed); };
  const remove = f => {
    let undone = false;
    put(n => { n.files = n.files.filter(x => x.id !== f.id); });
    toast(t('more.file_removed', { name: f.name }), { undo: () => { undone = true; put(n => { n.files.push(f); }); } });
    setTimeout(() => { if (!undone) dropLessonFile(f.id).catch(e => console.error(e)); }, 12000);
  };
  const replace = f => { const i = document.createElement('input'); i.type = 'file'; i.onchange = async () => { const x = i.files[0]; if (!x) return; try { await saveLessonFile(x, f.id); await put(n => { const y = n.files.find(z => z.id === f.id); if (y) Object.assign(y, { name: E.uniqueName({ files: n.files.filter(z => z.id !== f.id) }, x.name), type: x.type || '', size: x.size, added: Date.now() }); }); toast(t('more.replaced')); } catch (e) { saveFailed(e); } }; i.click(); };
  const newDoc = async () => {
    try { const n = copy(u), nm = E.uniqueName(n, t('more.doc_untitled')), id = E.lid(), b = new Blob(['<h1>' + esc(nm) + '</h1><p></p>'], { type: DOC });
      await saveLessonFile(b, id); n.files.push({ id, name: nm, kind: 'doc', type: DOC, size: b.size, added: Date.now() }); await saveUnit(p, n); setDoc(id); } catch (e) { saveFailed(e); }
  };
  const paste = e => { const fs = [...((e.clipboardData && e.clipboardData.files) || [])].filter(f => /^image\//.test(f.type)); if (fs.length) { e.preventDefault(); addFiles(p, u, fs, 'atlas').catch(saveFailed); } };
  // A screenshot pasted anywhere on the page goes to the unit plan's pictures, as on the current Planner's unit page (units.js), unless
  // it is pasted into a box or a sheet is open (rebuild/audit/hooks.md H-072).
  useEffect(() => {
    const any = e => { const el = e.target; if (e.defaultPrevented || document.querySelector('dialog[open]') || (el && el.closest && el.closest('input,textarea,select,[contenteditable],.ushots'))) return; paste(e); };
    document.addEventListener('paste', any); return () => document.removeEventListener('paste', any);
  }, [u.id, u.files.length]);
  // The lessons tied to this unit (l.unit), newest first (src/planner/library.js unitLessonsSection).
  const tied = (p.lessons || []).filter(l => l && l.unit === u.id).sort((a, b) => (((b.slots || [])[0] || {}).date || '').localeCompare(((a.slots || [])[0] || {}).date || '') || String(a.title).localeCompare(String(b.title), undefined, { numeric: true }));
  return <>
    <section class="side-sec ugoals" aria-labelledby="h-goals"><h2 id="h-goals" class="sub">{t('more.unit_goals')}</h2>
      {stds.length > 0 && <p class="chips">{stds.map(s => <span class="chip sm" data-raw>{s}</span>)}</p>}
      {summ.length > 0 && <p><b>{t('more.summative')}</b> <span data-raw>{summ.map(f => f.name).join(', ')}</span></p>}
      {u.weeks.some(w => w.focus) && <p class="mute small">{t('more.goals_weeks', { n: u.weeks.filter(w => w.focus).length, of: u.weeks.length })}</p>}
      {!stds.length && !summ.length && <p class="mute small">{t('more.goals_none')}</p>}
    </section>
    <section class={'side-sec ufiles' + (overF ? ' over' : '')} aria-labelledby="h-ufiles"
      onDragOver={e => { e.preventDefault(); setOverF(true); }} onDragLeave={() => setOverF(false)} onDrop={e => { e.preventDefault(); setOverF(false); const fs = [...e.dataTransfer.files]; if (fs.length) addFiles(p, u, fs, null).catch(saveFailed); }} data-ufiles-drop><h2 id="h-ufiles" class="sub">{t('more.unit_files')}</h2>
      {files.length > 0 && <ul class="mlist">{files.map(f => { const chip = { kind: 'file', t: 'unit', owner: u.id, id: f.id, label: f.name }; return <li data-ufile={f.id}>
        <button type="button" class="link mopen" onClick={() => open(f)} data-chip={JSON.stringify(chip)}><Icon name={f.kind === 'doc' ? 'note' : 'file'} size="sm" /><span data-raw>{f.name}</span></button>
        <small class="mute">{f.kind === 'doc' ? t('more.document') : kb(f.size)}</small>
        {f.kind !== 'doc' && <Select label={t('more.kind')} value={f.kind} options={[{ value: 'summative', label: t('more.summative') }, { value: 'other', label: t('more.unit_file') }]} onChange={v => put(n => { const y = n.files.find(z => z.id === f.id); if (y) y.kind = v; })} />}
        <span class="row">{f.kind === 'doc' && <IconButton icon="assist" size="sm" label={t('les.to_box', { name: aiName() })} onClick={() => boxAdd(chip)} data-ufile-box={f.id} />}
          {f.kind !== 'doc' && <IconButton icon="replace" size="sm" label={t('more.replace')} onClick={() => replace(f)} />}<IconButton icon="download" size="sm" label={t('more.download')} onClick={() => download(f)} />
          <IconButton icon="trash" size="sm" label={t('common.remove')} onClick={() => remove(f)} /></span></li>; })}</ul>}
      <div class="row"><Button size="sm" icon="upload" onClick={() => pickFiles(null)} data-focus="unit-add-file">{t('more.add_files')}</Button><Button size="sm" icon="note" onClick={newDoc} data-focus="unit-new-doc">{t('plan.new_document')}</Button>
        <input type="file" multiple class="vh" tabIndex={-1} aria-hidden="true" ref={fileIn} onChange={took(null)} data-ufile-input /><DriveButton input={fileIn} small /></div>
      <p class="mute small">{t('more.files_help')}</p>
    </section>
    <section class={'side-sec ushots' + (over ? ' over' : '')} aria-labelledby="h-ushots" onPaste={paste}
      onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); const fs = [...e.dataTransfer.files].filter(f => /^image\//.test(f.type)); if (fs.length) addFiles(p, u, fs, 'atlas').catch(saveFailed); }}>
      <h2 id="h-ushots" class="sub">{tool ? t('more.from_named', { name: tool }) : t('more.from_plan')}</h2>
      {shots.length > 0 && <div class="shots">{shots.map(f => <figure key={f.id + ':' + f.added}><button type="button" class="shot" onClick={() => open(f)} aria-label={t('more.look_at', { name: f.name })}><Thumb id={f.id} alt={f.name} /></button>
        <figcaption><span data-raw>{f.name}</span><IconButton icon="replace" size="sm" label={t('more.replace')} onClick={() => replace(f)} data-shot-replace={f.id} /><IconButton icon="trash" size="sm" label={t('common.remove')} onClick={() => remove(f)} /></figcaption></figure>)}</div>}
      <p class="mute small">{t('more.shots_help')}</p>
      <div class="row">{shotDrive ? <Menu label={t('more.add_shot')} items={[{ id: 'pc', label: t('file.from_computer'), icon: 'upload', onSelect: () => pickFiles('atlas', 'image/*') }, { id: 'drive', label: t('file.from_drive_pick'), icon: 'drive', onSelect: shotDrive }]}
          trigger={q => <Button size="sm" icon="image" {...q} data-focus="unit-add-shot">{t('more.add_shot')}</Button>} />
        : <Button size="sm" icon="image" onClick={() => pickFiles('atlas', 'image/*')} data-focus="unit-add-shot">{t('more.add_shot')}</Button>}
        <input type="file" multiple accept="image/*" class="vh" tabIndex={-1} aria-hidden="true" ref={shotIn} onChange={took('atlas')} data-shot-input />
        <Button size="sm" icon="assist" onClick={() => setAsking(true)} data-focus="unit-ask">{t('more.fill_with', { name })}</Button></div>
    </section>
    {tied.length > 0 && <section class="side-sec ulessons" aria-labelledby="h-ulessons"><h2 id="h-ulessons" class="sub">{t('cal.unit_lessons')} <span class="mute">{tied.length}</span></h2>
      <ul class="mlist">{tied.map(l => <li data-ulesson={l.id}><a class="link" href={href('lesson', l.id)}><Icon name="slides" size="sm" /><span data-raw>{l.title || t('plan.untitled')}</span></a>
        {(l.slots || [])[0] && <small class="mute" data-raw>{date(at(l.slots[0].date), { day: 'numeric', month: 'short' })}</small>}</li>)}</ul></section>}
    <UnitBank p={p} u={u} />
    {asking && <UnitAssist p={p} u={u} onClose={() => setAsking(false)} />}
    <Dialog open={!!big} title={big ? big.f.name : ''} onClose={() => { URL.revokeObjectURL(big.url); setBig(null); }} actions={<Button onClick={() => { URL.revokeObjectURL(big.url); setBig(null); }}>{t('common.close')}</Button>}>{big && <img class="shotbig" src={big.url} alt="" />}</Dialog>
    {doc && Doc && <Doc.DocEditor p={p} l={u} id={doc} save={n => saveUnit(p, n)} onClose={() => setDoc(null)} />}
  </>;
}

/* ---------- the assistant fills the weeks ---------- */
export function unitBrief(p, u, extra) {
  const n = u.files.filter(x => x.kind === 'atlas').length, tool = toolName() || 'unit plan';
  return 'Please fill in the weeks of my ' + (u.course ? u.course + ' ' : '') + 'unit "' + u.title + '" from its ' + tool + (n ? ' screenshot' + (n === 1 ? '' : 's') + ', which I am attaching. Everything you need is in this message and the screenshots.' : ', using what I tell you below. Everything you need is in this message.') + ' Don\'t look for, open or ask for any folder or file on my computer.\n\n' +
    'It starts the week of ' + date(at(u.start), { month: 'long', day: 'numeric', year: 'numeric' }) + ' and has ' + u.weeks.length + ' weeks. If the screenshots show a different number of weeks or a different unit name, use what they show.\n\n' +
    'When you are done, give me ONE downloadable .zip file with unit.json in it: { "kind": "grading-studio-unit-zip", "unit": { "title": "…", "weeks": [ { "focus": "what this week is about", "standards": "codes, if shown", "notes": "anything else useful for planning" } ] } }, one entry per week, in order.\n' +
    'Also give me unit.json as its own downloadable file, and write the weeks in your reply as one line per week, like "Week 1: what this week is about (standards, if shown)", so I can paste them if I need to.\n' +
    'Put nothing about any student in any of them. Then tell me anything you weren\'t sure of.' +
    (u.weeks.some(w => w.focus) ? '\n\n## The weeks as I have them now\n' + u.weeks.map((w, i) => 'Week ' + (i + 1) + ': ' + (w.focus || '…') + (w.standards ? ' (' + w.standards + ')' : '')).join('\n') : '') +
    (extra && extra.trim() ? '\n\n## Anything else from me\n' + extra.trim() : '');
}
// The reply: a .zip or unit.json, or pasted lines. { title, weeks } or null.
export async function readUnitReply(p, file, text) {
  const E = engine(p);
  const fromJson = s => { let j; try { j = JSON.parse(s); } catch { return null; } const x = j && (j.unit || j); return x && Array.isArray(x.weeks) && x.weeks.length ? { title: String(x.title || '').trim().slice(0, 200), weeks: x.weeks.map(w => ({ focus: String((w && w.focus) || ''), standards: String((w && w.standards) || ''), notes: String((w && w.notes) || '') })) } : null; };
  if (file && /\.zip$/i.test(file.name)) {
    const fflate = await import('fflate'), z = fflate.unzipSync(new Uint8Array(await file.arrayBuffer()));
    const n = Object.keys(z).find(k => E.baseName(k).toLowerCase() === 'unit.json') || Object.keys(z).find(k => /\.json$/i.test(k) && !E.ZIP_SKIP(k));
    return n ? fromJson(fflate.strFromU8(z[n])) : null;
  }
  if (file) return fromJson(await file.text());
  const s = String(text || '').trim(); if (!s) return null;
  if (s.startsWith('{')) return fromJson(s);
  const lines = s.split('\n').map(x => x.trim()).filter(x => /^(week|wk)\s*\d+/i.test(x)).map(x => x.replace(/^(week|wk)\s*\d+\s*[:.\-–)]\s*/i, ''));
  return lines.length ? { title: '', weeks: lines.map(x => { const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(x); return { focus: m ? m[1] : x, standards: m ? m[2] : '', notes: '' }; }) } : null;
}
export function UnitAssist({ p, u, onClose }) {
  const ai = assistant(), name = aiName(), shots = u.files.filter(f => f.kind === 'atlas').length;
  const [extra, setExtra] = useState(''), [pasted, setPasted] = useState(''), [got, setGot] = useState(null), [busy, setBusy] = useState(false), [over, setOver] = useState(false);
  const doCopy = async () => { try { await navigator.clipboard.writeText(unitBrief(p, u, extra)); toast(t('more.unit_copied', { name, n: shots })); } catch (e) { console.error(e); toast(t('plan.copy_failed')); } };
  const take = async (file, text) => { setBusy(true); try { const r = await readUnitReply(p, file, text); if (!r) toast(t('more.unit_none_back')); else setGot(r); } catch (e) { console.error(e); toast(t('plan.zip_bad')); } finally { setBusy(false); } };
  const keepIt = async () => {
    setBusy(true);
    try { const n = copy(u); if (got.title) n.title = got.title; n.weeks = got.weeks.map((w, i) => ({ focus: w.focus, standards: w.standards, notes: w.notes || (u.weeks[i] || {}).notes || '' })); await saveUnit(p, n); toast(t('more.unit_kept', { n: n.weeks.length })); onClose(); }
    catch (e) { saveFailed(e); } finally { setBusy(false); }
  };
  return <Sheet open wide title={t('more.fill_with', { name })} icon={<Icon name="assist" />} onClose={onClose}
    footer={got ? <><Button variant="quiet" onClick={() => setGot(null)}>{t('common.cancel')}</Button><Button variant="primary" disabled={busy} onClick={keepIt} data-focus="unit-keep">{t('more.unit_keep', { n: got.weeks.length })}</Button></> : null}>
    {!got ? <div class="asst"><ol class="asteps">
      <li><b>{t('plan.step_copy')}</b><p class="mute">{shots ? t('more.unit_copy_text', { name, n: shots }) : t('more.unit_no_shots')}</p>
        <TextBox label={t('plan.anything_to_add')} hint={t('plan.anything_hint', { name })} value={extra} onInput={setExtra} rows={3} data-focus="unit-extra" />
        <div class="row"><Button variant="primary" icon="copy" onClick={doCopy} data-focus="unit-copy">{t('plan.copy_brief')}</Button>
          {ai.link && <a class="btn" href={ai.link} target="_blank" rel="noopener">{t('plan.open_name', { name })}<Icon name="arrow" size="xs" /></a>}</div></li>
      <li><b>{t('plan.step_zip')}</b><p class="mute">{t('more.unit_zip_text', { name })}</p>
        <label class={'drop' + (over ? ' over' : '')} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}>
          <Icon name="upload" /><span>{busy ? t('plan.reading') : t('more.unit_drop')}</span>
          <input type="file" accept=".zip,.json,application/zip,application/json" class="vh" onChange={e => { const f = e.currentTarget.files[0]; e.currentTarget.value = ''; if (f) take(f); }} data-unitzip /></label><DriveButton />
        <TextBox label={t('more.unit_paste')} value={pasted} onInput={setPasted} rows={4} data-focus="unit-paste" />
        <div class="row"><span class="grow" /><Button size="sm" disabled={!pasted.trim()} onClick={() => take(null, pasted)} data-focus="unit-paste-use">{t('more.unit_paste_use')}</Button></div></li>
      <li><b>{t('plan.step_review')}</b><p class="mute">{t('more.unit_review_text')}</p></li>
    </ol></div>
      : <div class="asst">{got.title && got.title !== u.title && <p>{t('more.unit_new_name', { name: got.title })}</p>}
        <ol class="uweeks">{got.weeks.map((w, i) => <li><b>{t('plan.week_n', { n: i + 1 })}</b> <span data-raw>{w.focus}</span>{w.standards && <small class="mute" data-raw> ({w.standards})</small>}
          {u.weeks[i] && u.weeks[i].focus && u.weeks[i].focus !== w.focus && <p class="mute small">{t('more.unit_was', { text: u.weeks[i].focus })}</p>}</li>)}</ol></div>}
  </Sheet>;
}
