// A Word file in a lesson's materials made into an editable document beside it (src/planner/materials.js matEditDocx, "Edit a
// copy"): the original stays as it is. The current Planner reads it with mammoth; this reads the file's own document.xml for what a
// handout carries: titles and headings, paragraphs, bold, italic and underline, bulleted and numbered lists, line breaks and tables.
// Loaded through router.js PARTS.docxin only when it is pressed.
import { unzipSync, strFromU8 } from 'fflate';
import { t } from '../../i18n/t.js';
import { toast } from '../../ui/index.js';
import { engine } from '../../planning/engine.js';
import { lessonBlob } from '../../planning/plan.js';
import { saveLessonFile } from '../../planning/write.js';
import './lines.js';
import './rev-lines.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const kids = (el, name) => [...el.childNodes].filter(n => n.namespaceURI === W && n.localName === name);
const kid = (el, name) => kids(el, name)[0] || null;
const on = (rp, name) => { const x = rp && kid(rp, name); return !!x && !/^(0|false|none)$/.test(x.getAttributeNS(W, 'val') || ''); };
function runs(p) {
  let out = '';
  for (const r of p.getElementsByTagNameNS(W, 'r')) {
    const rp = kid(r, 'rPr'); let s = '';
    for (const n of r.childNodes) { if (n.namespaceURI !== W) continue; if (n.localName === 't') s += esc(n.textContent); else if (n.localName === 'br') s += '<br>'; else if (n.localName === 'tab') s += ' '; }
    if (!s) continue;
    if (on(rp, 'u')) s = '<u>' + s + '</u>'; if (on(rp, 'i')) s = '<em>' + s + '</em>'; if (on(rp, 'b')) s = '<strong>' + s + '</strong>';   // not-words
    out += s;
  }
  return out;
}
export function docxHtml(u8) {
  const z = unzipSync(u8), x = z['word/document.xml']; if (!x) throw new Error('not a Word file');
  const doc = new DOMParser().parseFromString(strFromU8(x), 'application/xml'), body = doc.getElementsByTagNameNS(W, 'body')[0]; if (!body) throw new Error('no body');
  let html = '', list = '';
  const close = () => { if (list) { html += '</' + list + '>'; list = ''; } };
  for (const n of body.childNodes) {
    if (n.namespaceURI !== W) continue;
    if (n.localName === 'tbl') { close(); html += '<table>' + kids(n, 'tr').map(tr => '<tr>' + kids(tr, 'tc').map(tc => '<td>' + kids(tc, 'p').map(runs).filter(Boolean).join('<br>') + '</td>').join('') + '</tr>').join('') + '</table>'; continue; }
    if (n.localName !== 'p') continue;
    const pp = kid(n, 'pPr'), st = ((pp && kid(pp, 'pStyle') && kid(pp, 'pStyle').getAttributeNS(W, 'val')) || '').toLowerCase(), num = pp && kid(pp, 'numPr'), text = runs(n);
    if (num) { const fmt = /number|decimal|list ?number/.test(st) ? 'ol' : 'ul'; if (list !== fmt) { close(); html += '<' + fmt + '>'; list = fmt; } html += '<li>' + text + '</li>'; continue; }   // not-words
    close();
    if (!text) continue;
    html += st === 'title' ? '<h1>' + text + '</h1>' : /^heading ?[1-3]$/.test(st) ? '<h2>' + text + '</h2>' : '<p>' + text + '</p>';   // not-words
  }
  close();
  return html || '<p></p>';
}
// The copy goes beside the Word file as a document of its own; its id comes back for the editor to open.
export async function editCopy(p, l, id, save) {
  const f = (l.files || []).find(x => x.id === id), b = f && await lessonBlob(id); if (!b) { toast(t('plan.file_missing')); return null; }
  let html; try { html = docxHtml(new Uint8Array(await b.arrayBuffer())); } catch (e) { console.warn(e); toast(t('rev.docx_failed')); return null; }
  const E = engine(p), nid = E.lid(), doc = new Blob([html], { type: 'text/html' }), name = E.uniqueName(l, f.name.replace(/\.docx$/i, ''));
  await saveLessonFile(doc, nid);
  const n = JSON.parse(JSON.stringify(l)); n.files = [...(n.files || []), { id: nid, name, kind: 'doc', type: 'text/html', size: doc.size, added: Date.now() }];
  await save(n); return nid;
}
// ↓ on a file in Materials (src/planner/materials.js 'dl'): a document made here comes down as .docx, any other file as it is.
export async function download(f) {
  const b = await lessonBlob(f.id); if (!b) return toast(t('plan.file_missing'));
  const out = f.kind === 'doc' ? await (await import('../../engines/plantools.js')).docxOf(await b.text(), f.name) : b;
  const a = document.createElement('a'), u = URL.createObjectURL(out); a.href = u; a.download = f.kind === 'doc' ? f.name + '.docx' : f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
}
