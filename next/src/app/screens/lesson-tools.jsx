// A lesson's tools that are used now and then, loaded when first wanted (router.js PARTS.tools), doing what the current Planner
// does with them:
//   share       a lesson file a colleague can open (src/planner/share.js): a .gslesson zip of the lesson, its pictures, its
//               materials and the finished PowerPoint. Classes, days, taught notes, comments and asks for the assistant, screenshots
//               for context, versions and older finished decks stay behind. Opening one never replaces a lesson: the same lesson
//               comes in as a separate copy. Strong examples travel only as references, never the picture.
//   import      a .gslesson, a .lesson.json (or pasted lesson) from the assistant (src/planner/lessons.js importLesson)
//   variants    alternative versions of a lesson: its own lesson with variantOf and variant (src/planner/variants.js)
//   finished    the finished PowerPoint: an upload reads its slides into the lesson, older finished decks are kept, and Download
//               gives the finished file while the slides are unchanged since (src/planner/finished.js)
//   downloads   everything for one lesson, or every lesson this week, in one .zip (finished.js dlLessonZip, dlWeek)
//   document    a material written here: an A4 page with headings, lists, boxes, tables and lines, printed or saved as .docx
//               (src/planner/materials.js docOpen), with dictation
// Every write goes through planning/write.js. Planning material only: nothing here reads a student's work.
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import * as fflate from 'fflate';
import { Sheet, Dialog, Button, IconButton, Icon, TextInput, Checkbox, Segmented, toast } from '../../ui/index.js';
import { Mic } from '../../ui/services.jsx';
import { t, date } from '../../i18n/t.js';
import { go, PARTS } from '../router.js';
import { engine } from '../../planning/engine.js';
import * as T from '../../engines/plantools.js';
import { saveLesson, saveVersion, saveLessonFile, dropLessonFile } from '../../planning/write.js';
import { lessonBlob } from '../../planning/plan.js';
import { periods, lessonsOn, weekDays, at, classOf } from '../plan/lessons.js';
import { isExample } from '../plan/examples.js';
import { assistant } from '../../services/assistant.js';
import { saveFailed } from '../plan/save.js';
import '../plan/tool-lines.js';
import { DriveButton } from '../drive-button.jsx';

const copy = x => JSON.parse(JSON.stringify(x));
const DOC_TYPE = 'text/html';
const esc = s => String(s).replace(/[&"><]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
export function saveAs(name, b) { const a = document.createElement('a'), url = URL.createObjectURL(b); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
const safeName = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Lesson'; // not-words
const size = n => n / 1048576 >= 1 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const when = ms => date(new Date(ms), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const u8ToB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
// A lesson's own files: a strong example in Materials is only a reference (its picture stays on the grading side), so it never travels.
const ownFiles = l => (l.files || []).filter(f => !isExample(f.id));

/* ---------- a lesson file to share ---------- */
const SHARE_KIND = 'grading-studio-lesson';
async function shareBuild(p, l) {
  const E = engine(p), te = new TextEncoder(), z = {}, used = new Set();
  const put = (dir, name, u8) => { let n = safeName(name), k = 2; while (used.has((dir + n).toLowerCase())) n = safeName(name).replace(/(\.\w+)?$/, m => ' (' + (k++) + ')' + m); used.add((dir + n).toLowerCase()); z[dir + n] = [u8, { level: 0 }]; return dir + n; };
  const imgs = new Map(), data = E.lessonForFile(T.shareLesson(l), imgs);
  for (const [path, src] of imgs) z[path] = [E.b64ToU8(src.slice(src.indexOf(',') + 1)), { level: 0 }];
  const files = [];
  for (const f of ownFiles(l)) { const b = await lessonBlob(f.id); if (!b) continue; files.push({ name: f.name, kind: f.kind === 'doc' ? 'doc' : 'other', type: b.type || f.type || '', path: put('files/', f.name, new Uint8Array(await b.arrayBuffer())) }); }
  let final = null;
  if (l.final) { const b = await lessonBlob(l.final.id); if (b) final = { name: l.final.name, path: put('final/', l.final.name, new Uint8Array(await b.arrayBuffer())) }; }
  z['gslesson.json'] = te.encode(JSON.stringify({ kind: SHARE_KIND, version: 1, made: new Date().toISOString().slice(0, 10), lesson: data, files, final }, null, 2));
  z['README.txt'] = te.encode('A lesson from Grading Studio.\r\nOpen it in the Planner: Import a lesson, then choose this file.\r\n'); // not-words
  return fflate.zipSync(z);
}
export async function shareSave(p, l) {
  let u8; try { u8 = await shareBuild(p, l); } catch (e) { console.error(e); return toast(t('tool.share_failed')); }
  const name = safeName(T.shareLesson(l).title || l.title) + '.gslesson';
  saveAs(name, new Blob([u8], { type: 'application/octet-stream' }));
  toast(t('tool.share_saved', { name, size: size(u8.length) }), { ms: 6000 });
}
// A lesson file opened: always a lesson of its own (a copy when this lesson is already here), on slot when one is given.
async function shareOpen(p, file, slot) {
  const E = engine(p);
  let z, j;
  try { z = fflate.unzipSync(new Uint8Array(await file.arrayBuffer())); } catch { return toast(t('tool.not_opened')); }
  try { j = JSON.parse(fflate.strFromU8(z['gslesson.json'])); } catch { return toast(t('tool.not_lesson')); }
  if (!j || j.kind !== SHARE_KIND || !j.lesson || !Array.isArray(j.lesson.slides)) return toast(t('tool.not_lesson'));
  const pic = src => { const m = /^images\/[^/]+\.(png|jpe?g)$/i.exec(src || ''); const d = m && z[src]; return d ? 'data:image/' + (/png/i.test(m[1]) ? 'png' : 'jpeg') + ';base64,' + u8ToB64(d) : src; };
  const x = T.shareLesson(E.normLesson({ ...j.lesson, slides: (j.lesson.slides || []).map(s => s && typeof s === 'object' ? { ...s, img: s.img && typeof s.img === 'object' ? { ...s.img, src: pic(s.img.src) } : undefined } : s) }));
  const l = E.normLesson(x); l.slides.forEach(s => { if (s.img && !T.imgSrc(s.img.src) && !isExample(s.img.src)) delete s.img; });
  const again = (p.lessons || []).some(o => o.id === l.id);
  if (again) { l.id = E.lid(); l.slides.forEach(s => { s.id = E.lid(); }); }
  l.created = l.updated = Date.now(); l.files = []; if (slot) l.slots = [slot];
  let big = 0;
  for (const f of Array.isArray(j.files) ? j.files : []) {
    const d = f && z[f.path]; if (!d) continue;
    if (d.length > E.MAX_FILE) { big++; continue; }
    const id = E.lid(), kind = f.kind === 'doc' ? 'doc' : 'other', b = new Blob([d], { type: kind === 'doc' ? DOC_TYPE : String(f.type || '') || E.mimeOf(String(f.name || '')) });
    await saveLessonFile(b, id);
    l.files.push({ id, name: E.uniqueName(l, String(f.name || 'File')), kind, type: b.type, size: b.size, added: Date.now() });
  }
  if (!l.files.length) delete l.files;
  const fd = j.final && z[j.final.path];
  if (fd && fd.length <= E.MAX_FILE) { const id = E.lid(); await saveLessonFile(new Blob([fd], { type: PPTX }), id); l.final = { id, name: String(j.final.name || safeName(l.title) + '.pptx'), size: fd.length, at: Date.now(), sig: T.finSig(l) }; }
  const n = await saveLesson(l);
  toast(t('tool.opened', { title: l.title, n: l.slides.length }) + (again ? ' ' + t('tool.opened_copy') : '') + (big ? ' ' + t('tool.too_big_n', { n: big }) : ''), { ms: 8000 });
  return n;
}
// A .lesson.json from the assistant, or one pasted: the same id replaces the lesson here (its versions keep the one before).
async function importText(p, text, slot) {
  const E = engine(p);
  let j; try { j = JSON.parse(String(text).replace(/^\s*```(json)?|```\s*$/g, '')); } catch { toast(t('tool.not_lesson')); return []; }
  const done = [];
  for (const x of Array.isArray(j) ? j : [j]) {
    if (!x || !Array.isArray(x.slides)) continue;
    const l = E.normLesson(x); l.slides.forEach(s => { if (s.img && !T.imgSrc(s.img.src) && !isExample(s.img.src)) delete s.img; });
    const old = (p.lessons || []).find(o => o.id === l.id);
    if (old) { await saveVersion(old, t('tool.before_import'), E.snap, E.MAX_VERSIONS); l.created = old.created; if (!l.slots.length) l.slots = old.slots; } else E.deckStart(l);
    if (slot && !l.slots.some(s => s.classId === slot.classId && s.date === slot.date)) l.slots = [...l.slots, slot];
    done.push(await saveLesson(l));
  }
  if (!done.length) toast(t('tool.no_lesson_found'));
  else toast(done.length === 1 ? t('tool.imported', { title: done[0].title }) : t('tool.imported_n', { n: done.length }));
  return done;
}
export function ImportSheet({ p, slot, onClose }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), box = useRef();
  const after = ls => { if (ls && ls.length === 1) { onClose(); go('lesson', ls[0].id); } else if (ls && ls.length) onClose(); };
  const file = async f => {
    if (!f) return; setBusy(true);
    try {
      if (/\.gslesson$/i.test(f.name)) { const n = await shareOpen(p, f, slot); after(n ? [n] : null); }
      else if (/\.zip$/i.test(f.name)) toast(t('tool.zip_in_library'));
      else after(await importText(p, await f.text(), slot));
    } catch (e) { saveFailed(e); } finally { setBusy(false); }
  };
  const pasted = async () => { const v = box.current ? box.current.querySelector('textarea').value : text; if (!v.trim()) return; setBusy(true); try { after(await importText(p, v, slot)); } catch (e) { saveFailed(e); } finally { setBusy(false); } };
  return <Sheet open title={t('tool.import_title')} icon={<Icon name="upload" />} onClose={onClose}
    footer={<><span class="grow" /><Button variant="quiet" onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" disabled={busy || !text.trim()} onClick={pasted} data-focus="import-paste">{t('tool.import_pasted')}</Button></>}>
    <div class="actedit" ref={box}>
      <p class="mute">{t('tool.import_text')}</p>
      <label class="btn"><Icon name="upload" />{t('tool.choose_file')}<input type="file" class="vh" accept=".gslesson,.json,application/json" onChange={e => { const f = e.currentTarget.files[0]; e.currentTarget.value = ''; file(f); }} data-import /></label><DriveButton />
      <label class="fld"><span class="lab">{t('tool.or_paste')}</span><textarea rows={8} value={text} onInput={e => setText(e.currentTarget.value)} data-focus="import-text" /></label>
    </div>
  </Sheet>;
}

/* ---------- alternative versions ---------- */
const famId = l => l.variantOf || l.id;
export const varName = l => l.variant || (l.variantOf ? t('tool.var_alt') : t('tool.var_original'));
export const variantsOf = (p, l) => { const f = famId(l); return (p.lessons || []).filter(x => x.id === f || x.variantOf === f).sort((a, b) => (a.id === f ? -1 : b.id === f ? 1 : (a.created || 0) - (b.created || 0))); };
// The switch in the lesson's top bar, shown when a lesson has two or more versions.
export function VariantBar({ p, l, save }) {
  const vs = variantsOf(p, l), [naming, setNaming] = useState(false);
  if (vs.length < 2) return null;
  return <div class="varbar" role="group" aria-label={t('tool.var_label')}>
    <span class="mute">{t('tool.var_label')}</span>
    <Segmented label={t('tool.var_label')} value={l.id} onChange={id => id !== l.id && go('lesson', id)} options={vs.map(v => ({ value: v.id, label: varName(v) }))} />
    <IconButton icon="edit" size="sm" label={t('tool.var_rename')} onClick={() => setNaming(true)} data-focus="var-rename" />
    {naming && <NameSheet title={t('tool.var_rename')} value={varName(l)} onClose={() => setNaming(false)} onOk={v => { setNaming(false); save({ ...copy(l), variant: v, _file: l._file, _mod: l._mod }); }} />}
  </div>;
}
function NameSheet({ title, value = '', hint, extra, onOk, onClose }) {
  const [v, setV] = useState(value);
  return <Sheet open title={title} icon={<Icon name="copy" />} onClose={onClose}
    footer={<><span class="grow" /><Button variant="quiet" onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" disabled={!v.trim()} onClick={() => onOk(v.trim().slice(0, 60))} data-focus="name-ok">{t('tool.ok')}</Button></>}>
    <div class="actedit"><TextInput label={t('tool.var_name')} hint={hint} value={v} onInput={setV} onKeyDown={e => { if (e.key === 'Enter' && v.trim()) onOk(v.trim().slice(0, 60)); }} data-focus="var-name" />{extra}</div>
  </Sheet>;
}
export function MakeVariant({ p, l, save, onClose }) {
  const E = engine(p), [same, setSame] = useState(false), [busy, setBusy] = useState(false);
  const slots = (l.slots || []).map(s => ((classOf(p, s.classId) || {}).name || '') + ' ' + date(at(s.date), { day: 'numeric', month: 'short' })).join(', ');
  const make = async name => {
    if (busy) return; setBusy(true);
    try {
      const n = copy(l); for (const k of ['_file', '_mod', '_sync', 'pending', 'taught', 'ready', 'final', 'finals']) delete n[k];
      n.id = E.lid(); n.created = n.updated = Date.now(); n.variantOf = famId(l); n.variant = name; n.slots = same ? copy(l.slots || []) : [];
      n.slides = n.slides.map(s => ({ ...s, id: E.lid() })); n.files = [];
      for (const f of l.files || []) { if (isExample(f.id)) { n.files.push({ ...f }); continue; } const b = await lessonBlob(f.id); if (!b) continue; const id = E.lid(); await saveLessonFile(b, id); n.files.push({ ...f, id }); }
      if (!n.files.length) delete n.files;
      // its own copy of the finished decks, so removing one never touches the other
      const cp = async f => { const b = await lessonBlob(f.id); if (!b) return null; const id = E.lid(); await saveLessonFile(b, id); return { ...f, id }; };
      if (l.final) { const f = await cp(l.final); if (f) n.final = { ...f, sig: T.finSig(n) }; }
      const older = []; for (const f of l.finals || []) { const c = await cp(f); if (c) older.push(c); } if (older.length) n.finals = older;
      const made = await saveLesson(n);
      if (!l.variantOf && !l.variant) await save({ ...copy(l), variant: t('tool.var_original'), _file: l._file, _mod: l._mod });
      toast(t('tool.var_made', { name, from: varName(l) }), { ms: 6000 }); onClose(); go('lesson', made.id);
    } catch (e) { saveFailed(e); } finally { setBusy(false); }
  };
  return <NameSheet title={t('tool.var_new', { title: l.title || t('plan.untitled') })} hint={t('tool.var_hint')} onClose={onClose} onOk={make}
    extra={<><p class="mute">{t('tool.var_starts', { name: varName(l) })}</p>{(l.slots || []).length > 0 && <Checkbox label={t('tool.var_same', { slots })} checked={same} onChange={setSame} />}</>} />;
}

/* ---------- the finished PowerPoint ---------- */
export const finFresh = l => !!(l.final && l.final.sig === T.finSig(l));
async function finUpload(p, l, file, save, keepId) {
  const E = engine(p);
  if (!/\.pptx$/i.test(file.name || '')) return toast(t('tool.not_pptx'));
  if (file.size > E.MAX_FILE) return toast(t('tool.too_big'));
  let slides;
  try { slides = await T.pptxToSlides(new Uint8Array(await file.arrayBuffer())); } catch (e) { console.warn(e); return toast(t('tool.pptx_unread')); }
  if (!slides.length) return toast(t('tool.no_slides'));
  await saveVersion(l, l.final ? t('tool.before_named', { name: file.name }) : t('tool.before_final'), E.snap, E.MAX_VERSIONS);
  const id = keepId || E.lid(); if (!keepId) await saveLessonFile(file, id);
  const n = copy(l), finals = (l.finals || []).filter(o => o.id !== id);
  if (l.final && l.final.id !== id) finals.unshift(l.final);
  // comments and notes for the assistant stay with the slide they were on, matched by place
  slides.forEach((s, i) => { const was = l.slides[i]; if (was) { s.ask = was.ask; s.talk = was.talk; if (was.ctx) s.ctx = was.ctx; } });
  n.slides = slides.map(s => E.normSlide({ ...s, fmt: 2 }));
  n.finals = finals; if (!finals.length) delete n.finals;
  n.final = { id, name: file.name, size: file.size, at: Date.now(), sig: T.finSig(n) };
  await save(n);
  toast(t('tool.final_saved', { n: slides.length }), { ms: 6000 });
}
// A lesson .zip: the finished deck plus the lesson's materials in one upload (finished.js lessonZip). The assistant's .zip with a
// lesson.json goes through the assistant sheet instead, where it is looked at slide by slide.
async function lessonZip(p, l, file, save) {
  const E = engine(p);
  let z; try { z = fflate.unzipSync(new Uint8Array(await file.arrayBuffer())); } catch { return toast(t('tool.not_opened')); }
  const names = Object.keys(z).filter(n => !n.endsWith('/') && !E.ZIP_SKIP(n) && z[n].length);
  const mf = names.find(n => E.baseName(n).toLowerCase() === 'lesson.json');
  let man = {}; if (mf) { try { man = JSON.parse(fflate.strFromU8(z[mf])) || {}; } catch { } }
  if (man.lesson && Array.isArray(man.lesson.slides)) return toast(t('tool.zip_to_assistant'));
  const files = names.filter(n => n !== mf), byBase = b => files.find(n => E.baseName(n).toLowerCase() === E.baseName(b || '').toLowerCase());
  const decks = files.filter(n => /\.pptx$/i.test(n)), deck = byBase(man.finished) || (decks.length === 1 ? decks[0] : decks.find(n => !n.includes('/')) || decks[0]);
  let mats = Array.isArray(man.materials) ? man.materials.map(byBase).filter(Boolean) : files.filter(n => n !== deck);
  mats = mats.filter((n, i) => mats.indexOf(n) === i && n !== deck);
  const big = mats.filter(n => z[n].length > E.MAX_FILE); mats = mats.filter(n => z[n].length <= E.MAX_FILE); // not-words
  if (!deck && !mats.length) return toast(t('tool.zip_nothing'));
  let n = copy(l);
  if (mats.length) {
    n.files = n.files || [];
    for (const m of mats) {
      const name = E.baseName(m), old = n.files.find(f => f.kind !== 'doc' && f.name === name);
      if (old) { await dropLessonFile(old.id).catch(() => {}); n.files = n.files.filter(f => f !== old); }
      const id = E.lid(), b = new Blob([z[m]], { type: E.mimeOf(name) }); await saveLessonFile(b, id);
      n.files.push({ id, name, kind: 'other', type: b.type, size: b.size, added: Date.now() });
    }
    n = (await save(n)) || n;
  }
  if (deck) await finUpload(p, { ...n, _file: l._file, _mod: l._mod }, new File([z[deck]], E.baseName(deck), { type: PPTX }), save);
  toast(t('tool.zip_added', { n: mats.length }) + (big.length ? ' ' + t('tool.too_big_n', { n: big.length }) : ''), { ms: 6000 });
}
export function Finished({ p, l, save, onClose }) {
  const [busy, setBusy] = useState(false), f = l.final, old = l.finals || [];
  const pick = async file => { if (!file) return; setBusy(true); try { await (/\.zip$/i.test(file.name) ? lessonZip(p, l, file, save) : finUpload(p, l, file, save)); } catch (e) { saveFailed(e); } finally { setBusy(false); } };
  const dl = async x => { const b = await lessonBlob(x.id); if (!b) return toast(t('tool.file_missing')); saveAs(x.name, b); };
  const back = async x => { const b = await lessonBlob(x.id); if (!b) return toast(t('tool.file_missing')); setBusy(true); try { await finUpload(p, l, new File([b], x.name, { type: b.type || PPTX }), save, x.id); } catch (e) { saveFailed(e); } finally { setBusy(false); } };
  return <Sheet open title={t('tool.final_title')} icon={<Icon name="slides" />} onClose={onClose} footer={<><span class="grow" /><Button variant="quiet" onClick={onClose}>{t('common.close')}</Button></>}>
    <div class="fin">
      <p class="mute">{f ? t('tool.final_has') : t('tool.final_none')}</p>
      <label class={'btn' + (busy ? ' busy' : '')}><Icon name="upload" />{f ? t('tool.final_newer') : t('tool.final_upload')}<input type="file" class="vh" disabled={busy} accept=".pptx,.zip,application/zip" onChange={e => { const x = e.currentTarget.files[0]; e.currentTarget.value = ''; pick(x); }} data-final /></label><DriveButton />
      {f && <div class="frow"><Icon name="slides" /><span class="main"><b data-raw>{f.name}</b><small class="mute">{size(f.size)} · {t('tool.uploaded', { when: when(f.at) })}{finFresh(l) ? '' : ' · ' + t('tool.changed_since')}</small></span>
        <Button size="sm" icon="download" onClick={() => dl(f)} data-focus="final-dl">{t('tool.download')}</Button></div>}
      {old.length > 0 && <details class="finold"><summary>{t('tool.older_finals', { n: old.length })}</summary>
        {old.map(x => <div class="frow"><Icon name="slides" /><span class="main"><b data-raw>{x.name}</b><small class="mute">{size(x.size)} · {t('tool.uploaded', { when: when(x.at) })}</small></span>
          <Button size="sm" variant="quiet" onClick={() => dl(x)}>{t('tool.download')}</Button><Button size="sm" disabled={busy} onClick={() => back(x)} data-focus="final-back">{t('tool.use_again')}</Button></div>)}</details>}
    </div>
  </Sheet>;
}
// Download slides: the finished file while it still matches the slides; otherwise asks which.
export function WhichDeck({ p, l, onClose }) {
  const fin = async () => { onClose(); const b = await lessonBlob(l.final.id); if (!b) return toast(t('tool.file_missing')); saveAs(l.final.name, b); };
  const make = () => { onClose(); try { saveAs(engine(p).fileBase(l) + '.pptx', new Blob([engine(p).buildPptx(l)], { type: PPTX })); } catch (e) { console.error(e); toast(t('tool.pptx_failed')); } };
  return <Dialog open title={t('tool.which_deck')} onClose={onClose} actions={<><Button variant="quiet" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={fin} data-focus="deck-final">{t('tool.the_final')}</Button><Button variant="primary" onClick={make}>{t('tool.make_from_slides')}</Button></>}>
    <p>{t('tool.which_deck_text', { name: l.final.name })}</p>
  </Dialog>;
}

/* ---------- downloads: one lesson with its files, a whole week ---------- */
async function deckFor(p, l) {
  if (l.final) { const b = await lessonBlob(l.final.id); if (b) return { name: l.final.name, u8: new Uint8Array(await b.arrayBuffer()) }; }
  try { const E = engine(p); return { name: E.fileBase(l) + '.pptx', u8: E.buildPptx(l) }; } catch (e) { console.warn(e); return null; }
}
async function lessonEntries(p, l, dir) {
  const out = {}, used = new Set(), put = (name, u8) => { let n = safeName(name), k = 2; while (used.has(n.toLowerCase())) n = safeName(name).replace(/(\.\w+)?$/, m => ' (' + (k++) + ')' + m); used.add(n.toLowerCase()); out[(dir ? dir + '/' : '') + n] = [u8, { level: 0 }]; };
  const d = await deckFor(p, l); if (d) put(d.name, d.u8);
  for (const f of ownFiles(l)) {
    const b = await lessonBlob(f.id); if (!b) continue;
    if (f.kind === 'doc') put(f.name + '.docx', new Uint8Array(await (await T.docxOf(await b.text(), f.name)).arrayBuffer()));
    else put(f.name, new Uint8Array(await b.arrayBuffer()));
  }
  return out;
}
export async function downloadAll(p, l) {
  const e = await lessonEntries(p, l, ''); if (!Object.keys(e).length) return toast(t('tool.nothing_yet'));
  saveAs(engine(p).fileBase(l) + '.zip', new Blob([fflate.zipSync(e)], { type: 'application/zip' }));
}
export async function downloadWeek(p, mon) {
  const all = {}; let n = 0;
  toast(t('tool.week_getting'), { ms: 4000 });
  for (const d of weekDays(p, mon)) for (const { c } of periods(p, d)) for (const l of lessonsOn(p, c.id, d)) {
    const dir = safeName(date(at(d), { weekday: 'short', month: 'numeric', day: 'numeric' }).replace(/\//g, '-') + ' · ' + c.name + ' · ' + (l.title || '') + (l.variantOf || l.variant ? ' (' + varName(l) + ')' : ''));
    Object.assign(all, await lessonEntries(p, l, dir)); n++;
  }
  if (!n) return toast(t('tool.week_none'));
  saveAs(safeName(t('tool.week_file', { day: date(at(mon), { month: 'short', day: 'numeric' }) })) + '.zip', new Blob([fflate.zipSync(all)], { type: 'application/zip' }));
  toast(t('tool.week_done', { n }), { ms: 5000 });
}

/* ---------- screenshots for context beside a slide (src/planner/review.js ctxHtml) ---------- */
// Pictures for the assistant, not on the slide: pasted, dropped or chosen. Each can be seen bigger, named, put on a slide of its own,
// copied to paste into the assistant, or taken off (with undo).
export function Shots({ p, l, i, save, setCur }) {
  const E = engine(p), s = l.slides[i], list = (s && s.ctx) || [], [big, setBig] = useState(null), [over, setOver] = useState(false), name = assistant().name || t('assistant.generic');
  const put = fn => { const n = copy(l); fn(n.slides[i], n); if (n.slides[i].ctx && !n.slides[i].ctx.length) delete n.slides[i].ctx; return save(n); };
  const add = async files => {
    const got = [];
    for (const f of files) { if (!/^image\//.test(f.type)) continue; try { got.push({ id: E.lid(), ...(await T.shrinkPic(f)), note: '' }); } catch { toast(t('tool.pic_unread')); } }
    if (got.length) put(x => { x.ctx = [...(x.ctx || []), ...got]; });
  };
  const toSlide = x => { const n = copy(l); n.slides.splice(i + 1, 0, E.normSlide({ layout: 'picture', title: x.note || '', img: { src: x.src, w: x.w, h: x.h, source: '' }, fmt: 2 })); save(n); setCur(i + 1); toast(t('tool.shot_on_slide')); };
  const copyPic = async x => {
    try { const im = new Image(); im.src = x.src; await im.decode(); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0);
      const b = await new Promise(r => c.toBlob(r, 'image/png')); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); toast(t('tool.shot_copied', { name })); }
    catch { toast(t('tool.shot_copy_failed'), { ms: 6000 }); }
  };
  const remove = k => { const gone = list[k]; put(x => { x.ctx.splice(k, 1); }); toast(t('tool.shot_removed'), { undo: () => put(x => { (x.ctx = x.ctx || []).splice(k, 0, gone); }) }); };
  if (!s) return null;
  return <section class={'shotsbox' + (over ? ' over' : '')} aria-labelledby="h-shots" tabIndex={-1}
    onPaste={e => { const fs = [...((e.clipboardData && e.clipboardData.files) || [])]; if (fs.length) { e.preventDefault(); add(fs); } }}
    onDragOver={e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)}
    onDrop={e => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); setOver(false); add([...e.dataTransfer.files]); }}>
    <div class="row"><h2 class="sub grow" id="h-shots">{t('tool.shots', { name })}</h2>
      <label class="btn sm"><Icon name="image" />{t('tool.add_shot')}<input type="file" class="vh" accept="image/*" multiple onChange={e => { const fs = [...e.currentTarget.files]; e.currentTarget.value = ''; add(fs); }} data-shot /></label><DriveButton /></div>
    {!list.length && <p class="mute small">{t('tool.shots_help')}</p>}
    <ul class="shotlist">{list.map((x, k) => <li>
      <button type="button" class="shotimg" onClick={() => setBig(x)} aria-label={t('tool.shot_bigger')}><img src={x.src} alt={x.note || ''} data-raw /></button>
      <TextInput label={t('tool.shot_note')} value={x.note || ''} onInput={v => put(y => { y.ctx[k].note = v.slice(0, 200); })} />
      <div class="row"><Button size="sm" onClick={() => toSlide(x)}>{t('tool.shot_put')}</Button><Button size="sm" variant="quiet" onClick={() => copyPic(x)}>{t('tool.shot_copy')}</Button>
        <IconButton icon="trash" size="sm" label={t('common.remove')} onClick={() => remove(k)} /></div></li>)}</ul>
    <Dialog open={!!big} title={big ? big.note || t('tool.shot') : ''} onClose={() => setBig(null)} actions={<Button onClick={() => setBig(null)}>{t('common.close')}</Button>}>{big && <img class="shotbig" src={big.src} alt="" />}</Dialog>
  </section>;
}

// A new document on the lesson: a heading with its name, kept as a material (kind 'doc', HTML).
export async function newDoc(p, l, save) {
  const E = engine(p), name = E.uniqueName(l, t('tool.doc_untitled')), id = E.lid(), b = new Blob(['<h1>' + esc(name) + '</h1><p></p>'], { type: DOC_TYPE });
  await saveLessonFile(b, id);
  const n = copy(l); n.files = [...(n.files || []), { id, name, kind: 'doc', type: DOC_TYPE, size: b.size, added: Date.now() }];
  await save(n); return id;
}
export async function downloadFinal(l) { const b = await lessonBlob(l.final.id); if (!b) return toast(t('tool.file_missing')); saveAs(l.final.name, b); }
export { NotePop } from '../plan/note-pop.jsx';

// The document editor and the strong example picker come in their own file (router.js PARTS.doc).
function DocPart({ name, ...rest }) {
  const [m, setM] = useState(null);
  useEffect(() => { PARTS.doc().then(setM, e => { console.error(e); toast(t('app.chunk_failed')); }); }, []);
  return m ? (name === 'doc' ? <m.DocEditor {...rest} /> : <m.ExampleToMats {...rest} />) : null;
}
// Which tool the lesson page asked for.
export default function Tool({ name, arg, p, l, slot, save, onClose }) {
  if (name === 'import') return <ImportSheet p={p} slot={arg === 'slot' ? slot : null} onClose={onClose} />;
  if (name === 'variant') return <MakeVariant p={p} l={l} save={save} onClose={onClose} />;
  if (name === 'finished') return <Finished p={p} l={l} save={save} onClose={onClose} />;
  if (name === 'which') return <WhichDeck p={p} l={l} onClose={onClose} />;
  if (name === 'doc' || name === 'example') return <DocPart name={name} p={p} l={l} id={arg} save={save} onClose={onClose} />;
  return null;
}
