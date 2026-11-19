// A material written here, and a strong example put in Materials, loaded when first wanted (router.js PARTS.doc).
//   DocEditor      an A4 page with headings, lists, boxes, tables and lines, printed or saved as .docx, with dictation
//                  (src/planner/materials.js docOpen, docTool, docSave, docPrint)
//   ExampleToMats  a strong example into Materials by reference (src/planner/plexamples.js plxToMats): the picture stays on the
//                  grading side, so the Planner folder, downloads and shared lessons never carry it
import { h, Fragment } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { Sheet, Button, TextInput, Icon, toast } from '../../ui/index.js';
import { Mic } from '../../ui/services.jsx';
import { t } from '../../i18n/t.js';
import * as T from '../../engines/plantools.js';
import { saveLessonFile } from '../../planning/write.js';
import { lessonBlob } from '../../planning/plan.js';
import { ExamplePicker, exampleName } from '../plan/example-pick.jsx';
import { saveFailed } from '../plan/save.js';
import '../plan/lines.js';
import '../plan/tool-lines.js';
import '../plan/les-lines.js';
import { boxAdd } from '../plan/cbox.js';
import { assistant } from '../../services/assistant.js';

const copy = x => JSON.parse(JSON.stringify(x));
const DOC_TYPE = 'text/html';
function saveAs(name, b) { const a = document.createElement('a'), url = URL.createObjectURL(b); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }

const DOC_TOOLS = [['h1', 'tool.doc_h1'], ['h2', 'tool.doc_h2'], ['p', 'tool.doc_p'], null, ['bold', 'tool.doc_b'], ['italic', 'tool.doc_i'], ['underline', 'tool.doc_u'], null, ['ul', 'tool.doc_ul'], ['ol', 'tool.doc_ol'], null,
  ['box', 'tool.doc_box'], ['table', 'tool.doc_table'], ['lines', 'tool.doc_lines'], null, ['left', 'tool.doc_left'], ['center', 'tool.doc_center'], null, ['undo', 'tool.doc_undo'], ['redo', 'tool.doc_redo']];
const esc = s => String(s).replace(/[&"><]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const blocks = () => ({
  box: '<table class="box"><tbody><tr><td><b>' + esc(t('tool.doc_question')) + '</b><p><br></p><p><br></p></td></tr></tbody></table><p><br></p>',
  table: '<table><tbody>' + '<tr><td><br></td><td><br></td><td><br></td></tr>'.repeat(3) + '</tbody></table><p><br></p>',
  lines: '<p class="lines"><br></p><p class="lines"><br></p><p class="lines"><br></p><p><br></p>',
});
function docBlock(pg, html) {
  const sel = getSelection(); let n = sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
  if (!n || !pg.contains(n)) n = pg.lastChild;
  while (n && n !== pg && n.parentNode !== pg) n = n.parentNode;
  const tp = document.createElement('template'); tp.innerHTML = html; const first = tp.content.firstChild, last = tp.content.lastChild;
  if (n && n !== pg) n.after(tp.content); else pg.append(tp.content);
  const cell = first.querySelector ? first.querySelector('td p, td') || first : first, r = document.createRange();
  r.selectNodeContents(first.tagName === 'TABLE' ? cell : last); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
}
export function DocEditor({ p, l, id, save, onClose }) {
  const f = (l.files || []).find(x => x.id === id), pg = useRef(), timer = useRef(0), [state, setState] = useState(''), [name, setName] = useState(f ? f.name : '');
  const lRef = useRef(l); lRef.current = l;
  useEffect(() => { lessonBlob(id).then(async b => { if (pg.current) pg.current.innerHTML = T.docClean(b ? await b.text() : ''); }); return () => { if (timer.current) { clearTimeout(timer.current); keep(); } }; }, [id]);
  const keep = async () => {
    timer.current = 0; if (!pg.current) return;
    const b = new Blob([pg.current.innerHTML], { type: DOC_TYPE });
    try { await saveLessonFile(b, id); const n = copy(lRef.current), x = (n.files || []).find(y => y.id === id); if (x) { x.size = b.size; await save(n); } setState('saved'); } catch (e) { saveFailed(e); }
  };
  const changed = () => { setState('saving'); clearTimeout(timer.current); timer.current = setTimeout(keep, 500); };
  const tool = k => {
    const el = pg.current; el.focus(); const ex = (c, v) => document.execCommand(c, false, v);
    if (/^(h1|h2|p)$/.test(k)) ex('formatBlock', k === 'p' ? 'P' : k.toUpperCase());
    else if (k === 'ul') ex('insertUnorderedList'); else if (k === 'ol') ex('insertOrderedList');
    else if (k === 'left') ex('justifyLeft'); else if (k === 'center') ex('justifyCenter');
    else if (/^(bold|italic|underline|undo|redo)$/.test(k)) ex(k);
    else if (blocks()[k]) docBlock(el, blocks()[k]);
    changed();
  };
  const rename = v => { setName(v); const s = v.trim(); if (!s) return; const n = copy(lRef.current), x = (n.files || []).find(y => y.id === id); if (x && x.name !== s) { x.name = s; save(n); } };
  const print = async () => {
    if (timer.current) { clearTimeout(timer.current); await keep(); }
    const w = window.open('', '_blank'); if (!w) return toast(t('tool.print_blocked'));
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(name) + '</title><style>@page{size:A4;margin:2cm}body{font:12pt/1.4 Calibri,Arial,sans-serif;margin:0}' + T.DOC_CSS + '</style></head><body>' + pg.current.innerHTML + '</body></html>'); // not-words
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };
  const docx = async () => { if (timer.current) { clearTimeout(timer.current); await keep(); } saveAs(name + '.docx', await T.docxOf(pg.current.innerHTML, name)); };
  // Words said go in where the cursor is, as typed words do.
  const said = words => { const el = pg.current; if (!el) return; if (!el.contains(document.activeElement) && document.activeElement !== el) el.focus(); document.execCommand('insertText', false, (words.match(/^\s/) ? '' : ' ') + words); changed(); };
  if (!f) return null;
  return <Sheet open wide title={t('tool.doc_title')} icon={<Icon name="note" />} onClose={onClose}
    footer={<><small class="mute" role="status">{state === 'saving' ? t('tool.saving') : state === 'saved' ? t('tool.saved') : ''}</small><span class="grow" />
      <Button icon="assist" variant="quiet" onClick={async () => { if (timer.current) { clearTimeout(timer.current); await keep(); } boxAdd({ kind: 'file', t: 'lesson', owner: l.id, id, label: name || (f && f.name) || '' }); }} data-focus="doc-to-box">{t('les.to_box', { name: assistant().name || t('assistant.generic') })}</Button><Button icon="file" onClick={print} data-focus="doc-print">{t('tool.print')}</Button><Button icon="download" onClick={docx} data-focus="doc-docx">{t('tool.save_docx')}</Button><Button variant="primary" onClick={onClose}>{t('common.close')}</Button></>}>
    <div class="docwrap">
      <TextInput label={t('tool.doc_name')} value={name} onInput={rename} data-focus="doc-name" />
      <div class="doctools" role="toolbar" aria-label={t('tool.doc_tools')}>
        {DOC_TOOLS.map(x => x ? <button type="button" class={'btn sm quiet dt-' + x[0]} onMouseDown={e => { e.preventDefault(); tool(x[0]); }} data-dt={x[0]}>{t(x[1])}</button> : <span class="dsep" />)}
        <span class="grow" /><Mic onText={said} />
      </div>
      <div class="docpage" ref={pg} contentEditable="true" spellcheck={true} role="textbox" aria-multiline="true" aria-label={t('tool.doc_page')} data-raw onInput={changed}
        onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && !e.shiftKey && /^[biu]$/i.test(e.key)) { e.preventDefault(); tool({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); } }} data-docpage />
    </div>
  </Sheet>;
}


// A strong example into Materials (src/planner/plexamples.js plxToMats), by reference: the picture stays on the grading side, so
// the Planner folder, downloads and shared lessons never carry it.
export function ExampleToMats({ l, save, onClose }) {
  return <ExamplePicker open onClose={onClose} onPick={async (ref, r, page) => {
    const n = copy(l), name = (r.title + ' - ' + exampleName(r)).replace(/[\\/:*?"<>|]+/g, '-') + (r.pages > 1 ? ' p' + (page + 1) : '');
    if ((n.files || []).some(f => f.id === ref)) { onClose(); return toast(t('tool.example_there')); }
    n.files = [...(n.files || []), { id: ref, name, kind: 'other', type: 'image/jpeg', size: 0, added: Date.now() }];
    await save(n); onClose(); toast(t('tool.example_added'));
  }} />;
}

