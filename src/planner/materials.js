/* ================= Planner: materials and documents =================
   A lesson keeps its materials the way a unit keeps its files: { id, name, kind, type, size, added } in
   "files", the bytes in kv 'file:<id>'. kind 'doc' is a document made here: its HTML is the stored file,
   edited in the document editor and downloaded as .docx. Word files can be brought in to edit (the original
   stays as it was). Planning material only, never student work. */
const DOC_TYPE = 'text/html';
const fileIcon = f => f.kind === 'doc' ? 'DOC' : /pdf/i.test(f.type) || /\.pdf$/i.test(f.name) ? 'PDF' : /presentation|\.pptx?$/i.test(f.type + f.name) ? 'PPT' : /word|\.docx?$/i.test(f.type + f.name) ? 'W' : /^image\//.test(f.type) ? 'IMG' : 'FILE';
const isDocx = f => /\.docx$/i.test(f.name) || /wordprocessingml/.test(f.type);
function ownerOf(ref) { return ref.t === 'lesson' ? L.lessons.find(l => l.id === ref.id) : L.units.find(u => u.id === ref.id); }
async function ownerSave(ref, o) { if (ref.t === 'lesson') { await lPut(o); if (L.open && L.open.id === o.id) L.open = o; } else await unitPut(o); }

function materialsHtml(o, t) {
  const files = o.files || [];
  return '<div class="pl-mats" data-owner="' + t + '|' + o.id + '"><div class="pl-mats-h"><h3>Materials</h3><span class="muted sp-small">Handouts, readings, task sheets and documents for this ' + t + '. Drag files here.</span><span class="sp"></span>' +
    '<button class="btn sm" data-ma="newdoc">+ New document</button><button class="btn sm ghost" data-ma="add">+ Add files…</button><input type="file" multiple hidden data-mf="in"></div>' +
    (files.length ? '<div class="pl-files">' + files.map(f => '<div class="pl-file" draggable="true" data-chip=\'' + esc(JSON.stringify({ kind: 'file', t, owner: o.id, id: f.id })) + '\'><span class="pl-ft">' + fileIcon(f) + '</span><span class="pl-fn"><b>' + esc(f.name) + '</b><span>' + (f.kind === 'doc' ? 'Document' : (f.size / 1024 < 1024 ? Math.max(1, Math.round(f.size / 1024)) + ' KB' : (f.size / 1048576).toFixed(1) + ' MB')) + '</span></span>' +
      '<button class="btn sm" data-ma="open" data-id="' + f.id + '">' + (f.kind === 'doc' ? 'Edit' : 'Open') + '</button>' + (isDocx(f) ? '<button class="btn sm ghost" data-ma="editdocx" data-id="' + f.id + '" title="Make an editable copy here">Edit a copy</button>' : '') +
      '<button class="btn sm ghost" data-ma="dl" data-id="' + f.id + '" title="Download">↓</button><button class="btn sm ghost" data-ma="rm" data-id="' + f.id + '" title="Remove" aria-label="Remove">×</button></div>').join('') + '</div>'
      : '<p class="muted sp-small" style="margin:4px 0 0">Nothing yet.</p>') + '</div>';
}
async function matAdd(ref, list) {
  const o = ownerOf(ref); if (!o) return; o.files = o.files || [];
  let n = 0;
  for (const f of list) {
    if (f.size > MAX_FILE) { toast(f.name + ' is too big (over 40 MB)'); continue; }
    const id = lid(); await kvSet('file:' + id, f);
    o.files.push({ id, name: uniqueName(o, f.name || 'File'), kind: 'other', type: f.type || '', size: f.size, added: Date.now() }); n++;
  }
  if (n) { await ownerSave(ref, o); renderLessons(); toast(n === 1 ? 'Added' : 'Added ' + n + ' files'); }
}
async function matNewDoc(ref, name, html) {
  const o = ownerOf(ref); if (!o) return; o.files = o.files || [];
  const id = lid(), b = new Blob([html || '<h1>' + esc(name || 'Untitled') + '</h1><p></p>'], { type: DOC_TYPE });
  await kvSet('file:' + id, b);
  o.files.push({ id, name: uniqueName(o, name || 'Untitled document'), kind: 'doc', type: DOC_TYPE, size: b.size, added: Date.now() });
  await ownerSave(ref, o); docOpen(ref, id);
}
async function matOpen(ref, id) {
  const o = ownerOf(ref), f = o && (o.files || []).find(x => x.id === id); if (!f) return;
  if (f.kind === 'doc') return docOpen(ref, id);
  if (ref.t === 'unit') return viewFile(o, id);
  const b = await fileBlob(id); if (!b) return toast('That file is missing');
  if (/^image\//.test(b.type || f.type)) return viewFile({ files: [f] }, id);
  if (/pdf/.test(b.type || f.type) || /\.pdf$/i.test(f.name)) { const url = URL.createObjectURL(new Blob([b], { type: 'application/pdf' })); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 120000); return; }
  saveBlob(f.name, b);
}
async function matEditDocx(ref, id) {
  const o = ownerOf(ref), f = o && o.files.find(x => x.id === id), b = await fileBlob(id); if (!b) return;
  try { const r = await mammoth.convertToHtml({ arrayBuffer: await b.arrayBuffer() }, { styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='heading 1'] => h2:fresh", "p[style-name='heading 2'] => h2:fresh", "p[style-name='heading 3'] => h2:fresh"] }); await matNewDoc(ref, f.name.replace(/\.docx$/i, ''), r.value || '<p></p>'); }
  catch (e) { console.warn(e); toast('That Word file couldn’t be opened here'); }
}
async function matClick(t) {
  const box = t.closest('[data-owner]'); if (!box) return false;
  const [tt, oid] = box.dataset.owner.split('|'), ref = { t: tt, id: oid }, a = t.dataset.ma, id = t.dataset.id;
  if (a === 'add') { const i = box.querySelector('[data-mf="in"]'); i.onchange = () => matAdd(ref, [...i.files]); i.click(); return true; }
  if (a === 'newdoc') { const o = ownerOf(ref); await matNewDoc(ref, (o.title || 'Untitled') + ' handout'); return true; }
  if (a === 'open') { await matOpen(ref, id); return true; }
  if (a === 'claude') { boxAdd({ kind: 'file', t: tt, owner: oid, id }); return true; }
  if (a === 'editdocx') { await matEditDocx(ref, id); return true; }
  if (a === 'dl') { const o = ownerOf(ref), f = o.files.find(x => x.id === id); if (f.kind === 'doc') saveBlob(f.name + '.docx', await docxOf(await (await fileBlob(id)).text(), f.name)); else saveBlob(f.name, await fileBlob(id)); return true; }
  if (a === 'rm') {
    if (t.dataset.sure !== '1') { t.dataset.sure = '1'; t.textContent = 'Remove?'; return true; }
    const o = ownerOf(ref); o.files = o.files.filter(x => x.id !== id); await kvDel('file:' + id); await ownerSave(ref, o); renderLessons(); return true;
  }
  return !!a;
}
async function matDrop(e) {
  const box = e.target.closest && e.target.closest('[data-owner]'), files = [...(e.dataTransfer.files || [])];
  if (!box || !files.length || box.dataset.owner.startsWith('unit|')) return false;
  e.preventDefault(); const [t, id] = box.dataset.owner.split('|'); await matAdd({ t, id }, files); return true;
}

/* ---------- the document editor ---------- */
// One A4 page you can type on. Simple on purpose: headings, bold, lists, boxes and tables, like a handout.
const DOC_TOOLS = [['h1', 'Title'], ['h2', 'Heading'], ['p', 'Text'], ['|'], ['bold', 'B'], ['italic', 'I'], ['underline', 'U'], ['|'], ['ul', '• List'], ['ol', '1. List'], ['|'], ['box', '☐ Box'], ['table', 'Table'], ['lines', 'Lines'], ['|'], ['left', 'Left'], ['center', 'Center'], ['|'], ['undo', '↶'], ['redo', '↷']];
let docT = null;
async function docOpen(ref, id) {
  editorCommit && editorCommit();
  L.doc = { ref, id, back: L.view === 'doc' ? (L.doc && L.doc.back) : L.view };
  L.view = 'doc'; await renderDoc(); window.scrollTo(0, 0);
}
async function renderDoc() {
  const { ref, id } = L.doc, o = ownerOf(ref), f = o && o.files.find(x => x.id === id);
  if (!f) { L.view = L.doc.back || 'week'; return renderLessons(); }
  const html = await (await fileBlob(id)).text();
  $('#lessons').innerHTML = '<div class="pl-dochead"><div class="ls-top"><button class="btn sm ghost" data-da="back">‹ ' + esc(ref.t === 'lesson' ? o.title : o.title) + '</button><input class="ls-title-in" data-df="name" value="' + esc(f.name) + '" aria-label="Document name"><span class="sp"></span><span class="savest" id="docSaved">✓ Saved</span>' +
    '<button class="btn sm ghost" data-dict="#docPage">🎤 Dictate</button><button class="btn sm ghost" data-da="claude" title="Put this document in the Claude box">+ Claude box</button>' + panelBtn() + '<button class="btn sm ghost" data-da="print">Print</button><button class="btn sm primary" data-da="docx">Download .docx</button></div>' +
    '<div class="pl-doctools" role="toolbar" aria-label="Formatting">' + DOC_TOOLS.map(([k, v]) => k === '|' ? '<span class="pl-dsep"></span>' : '<button class="btn sm ghost" data-dt="' + k + '"' + (k === 'bold' ? ' style="font-weight:800"' : k === 'italic' ? ' style="font-style:italic"' : k === 'underline' ? ' style="text-decoration:underline"' : '') + '>' + v + '</button>').join('') + '</div></div>' +
    '<div class="pl-docwrap"><div class="pl-docpage" id="docPage" contenteditable="true" spellcheck="true">' + docClean(html) + '</div></div>';
  const pg = $('#docPage');
  pg.addEventListener('input', () => docChanged());
  pg.addEventListener('change', () => docChanged());
  pg.focus({ preventScroll: true });
  panelContext();
}
// Only the tags the editor makes stay: anything pasted or imported is cleaned to them.
function docClean(html) {
  // a template is inert, so nothing in pasted or imported HTML runs or loads while it is cleaned
  const tp = document.createElement('template'); tp.innerHTML = String(html).replace(/<(script|style|iframe|object)[\s\S]*?<\/\1>/gi, ''); const d = tp.content;
  const ok = /^(H1|H2|H3|P|BR|B|STRONG|I|EM|U|UL|OL|LI|TABLE|TBODY|TR|TD|TH|DIV|SPAN|HR)$/;
  (function walk(n) {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 3) continue;
      if (c.nodeType !== 1 || !ok.test(c.tagName)) { if (c.nodeType === 1) { walk(c); c.replaceWith(...c.childNodes); } else c.remove(); continue; }
      for (const at of [...c.attributes]) if (!(at.name === 'class' && /^(box|lines)$/.test(at.value)) && !(at.name === 'style' && /^text-align:\s*(left|center|right);?$/.test(at.value))) c.removeAttribute(at.name);
      walk(c);
    }
  })(d);
  return tp.innerHTML || '<p></p>';
}
function docChanged() {
  const s = $('#docSaved'); if (s) s.textContent = 'Saving…';
  clearTimeout(docT); docT = setTimeout(docSave, 500);
}
async function docSave() {
  const pg = $('#docPage'); if (!pg || !L.doc) return;
  const b = new Blob([pg.innerHTML], { type: DOC_TYPE });
  await kvSet('file:' + L.doc.id, b);
  const o = ownerOf(L.doc.ref), f = o && o.files.find(x => x.id === L.doc.id); if (f) { f.size = b.size; f.added = f.added || Date.now(); await ownerSave(L.doc.ref, o); }
  const s = $('#docSaved'); if (s) s.textContent = '✓ Saved';
}
// Boxes, tables and lines go after the line the cursor is on, never inside a list or a heading.
const DOC_BLOCKS = {
  box: '<table class="box"><tbody><tr><td><b>Question</b><p><br></p><p><br></p></td></tr></tbody></table><p><br></p>',
  table: '<table><tbody>' + '<tr><td><br></td><td><br></td><td><br></td></tr>'.repeat(3) + '</tbody></table><p><br></p>',
  lines: '<p class="lines"><br></p><p class="lines"><br></p><p class="lines"><br></p><p><br></p>'
};
function docBlock(pg, html) {
  const sel = getSelection();
  let n = sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
  if (!n || !pg.contains(n)) n = pg.lastChild;
  while (n && n !== pg && n.parentNode !== pg) n = n.parentNode;
  const tp = document.createElement('template'); tp.innerHTML = html;
  const first = tp.content.firstChild, last = tp.content.lastChild;
  if (n && n !== pg) n.after(tp.content); else pg.append(tp.content);
  const cell = first.querySelector ? first.querySelector('td p, td') || first : first, r = document.createRange();
  r.selectNodeContents(first.tagName === 'TABLE' ? cell : last); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
}
function docTool(k) {
  const pg = $('#docPage'); pg.focus();
  const ex = (c, v) => document.execCommand(c, false, v);
  if (/^(h1|h2|p)$/.test(k)) ex('formatBlock', k === 'p' ? 'P' : k.toUpperCase());
  else if (k === 'ul') ex('insertUnorderedList'); else if (k === 'ol') ex('insertOrderedList');
  else if (k === 'left') ex('justifyLeft'); else if (k === 'center') ex('justifyCenter');
  else if (/^(bold|italic|underline|undo|redo)$/.test(k)) ex(k);
  else if (DOC_BLOCKS[k]) docBlock(pg, DOC_BLOCKS[k]);
  docChanged();
}
async function docClick(e) {
  if (L.view !== 'doc') return false;
  const t = e.target.closest('[data-da],[data-dt]'); if (!t) return false;
  if (t.dataset.dt) { docTool(t.dataset.dt); return true; }
  const a = t.dataset.da;
  if (a === 'back') { clearTimeout(docT); await docSave(); const back = L.doc.back; L.view = back === 'doc' || !back ? 'week' : back; if (L.view === 'edit' && !L.open) L.view = 'week'; L.doc = null; renderLessons(); return true; }
  if (a === 'print') { await docSave(); docPrint(); return true; }
  if (a === 'docx') { await docSave(); const f = ownerOf(L.doc.ref).files.find(x => x.id === L.doc.id); saveBlob(f.name + '.docx', await docxOf($('#docPage').innerHTML, f.name)); return true; }
  if (a === 'claude') { await docSave(); boxAdd({ kind: 'file', t: L.doc.ref.t, owner: L.doc.ref.id, id: L.doc.id }); return true; }
  return false;
}
function docInput(e) {
  if (L.view !== 'doc' || e.target.dataset.df !== 'name') return false;
  const o = ownerOf(L.doc.ref), f = o.files.find(x => x.id === L.doc.id), v = e.target.value.trim();
  if (v) { f.name = v; clearTimeout(docT); docT = setTimeout(async () => { await ownerSave(L.doc.ref, o); }, 400); }
  return true;
}
function docPrint() {
  const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to print');
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(ownerOf(L.doc.ref).files.find(x => x.id === L.doc.id).name) + '</title><style>@page{size:A4;margin:2cm}body{font:12pt/1.4 Calibri,Arial,sans-serif;margin:0}' + DOC_CSS + '</style></head><body>' + $('#docPage').innerHTML + '</body></html>');
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}
const DOC_CSS = 'h1{font-size:20pt;margin:0 0 8pt}h2{font-size:15pt;margin:12pt 0 6pt}p{margin:0 0 6pt}table{border-collapse:collapse;width:100%;margin:6pt 0}td,th{border:1px solid #000;padding:6pt;vertical-align:top}table.box td{padding:8pt 10pt}p.lines{border-bottom:1px solid #000;min-height:22pt;margin:0}';

/* ---------- .docx ---------- */
async function docxOf(html, title) {
  const d = document.createElement('div'); d.innerHTML = docClean(html);
  const X = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const runs = (n, f) => {
    let out = '';
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { if (c.nodeValue) out += '<w:r><w:rPr>' + (f.b ? '<w:b/>' : '') + (f.i ? '<w:i/>' : '') + (f.u ? '<w:u w:val="single"/>' : '') + '</w:rPr><w:t xml:space="preserve">' + X(c.nodeValue) + '</w:t></w:r>'; continue; }
      if (c.nodeType !== 1) continue;
      if (c.tagName === 'BR') { out += '<w:r><w:br/></w:r>'; continue; }
      out += runs(c, { b: f.b || /^(B|STRONG)$/.test(c.tagName), i: f.i || /^(I|EM)$/.test(c.tagName), u: f.u || c.tagName === 'U' });
    }
    return out;
  };
  const para = (n, style, extra) => { const al = /center/.test(n.getAttribute && n.getAttribute('style') || '') ? '<w:jc w:val="center"/>' : ''; return '<w:p><w:pPr>' + (style ? '<w:pStyle w:val="' + style + '"/>' : '') + (extra || '') + al + '</w:pPr>' + runs(n, {}) + '</w:p>'; };
  const blocks = n => {
    let out = '', inline = null;
    const flush = () => { if (inline && inline.textContent.trim()) out += para(inline); inline = null; };
    for (const c of n.childNodes) {
      const tag = c.nodeType === 1 ? c.tagName : '#t';
      if (/^(H1|H2|H3)$/.test(tag)) { flush(); out += para(c, tag === 'H1' ? 'Title' : 'Heading1'); }
      else if (tag === 'P' || tag === 'DIV') { flush(); out += c.classList && c.classList.contains('lines') ? '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr><w:spacing w:before="240"/></w:pPr></w:p>' : (c.querySelector && c.querySelector('p,ul,ol,table,h1,h2') ? blocks(c) : para(c)); }
      else if (tag === 'UL' || tag === 'OL') { flush(); for (const li of c.children) out += li.querySelector('table,p,ul,ol') ? blocks(li) : para(li, 'ListParagraph', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="' + (tag === 'UL' ? 1 : 2) + '"/></w:numPr>'); }
      else if (tag === 'TABLE') {
        flush();
        const rows = [...c.querySelectorAll('tr')], cols = Math.max(1, ...rows.map(r => r.children.length)), w = Math.floor(9638 / cols);
        out += '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => '<w:' + s + ' w:val="single" w:sz="8" w:color="000000"/>').join('') + '</w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' + '<w:gridCol w:w="' + w + '"/>'.repeat(cols) + '</w:tblGrid>' +
          rows.map(r => '<w:tr>' + [...r.children].map(td => '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/></w:tcPr>' + (blocks(td) || '<w:p/>') + '</w:tc>').join('') + '</w:tr>').join('') + '</w:tbl><w:p/>';
      }
      else if (tag === 'HR') { flush(); out += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; }
      else { if (!inline) inline = document.createElement('p'); inline.appendChild(c.cloneNode(true)); }
    }
    flush();
    return out;
  };
  const body = blocks(d) || '<w:p/>';
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const te = new TextEncoder(), x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const styles = x + '<w:styles ' + W + '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="160"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/><w:spacing w:after="60"/></w:pPr></w:style></w:styles>';
  const lvl = (fmt, txt) => '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="' + fmt + '"/><w:lvlText w:val="' + txt + '"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>';
  const numbering = x + '<w:numbering ' + W + '><w:abstractNum w:abstractNumId="0">' + lvl('bullet', '•') + '</w:abstractNum><w:abstractNum w:abstractNumId="1">' + lvl('decimal', '%1.') + '</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>';
  const files = {
    '[Content_Types].xml': x + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
    '_rels/.rels': x + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
    'docProps/core.xml': x + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>' + X(title || '') + '</dc:title></cp:coreProperties>',
    'word/_rels/document.xml.rels': x + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>',
    'word/styles.xml': styles, 'word/numbering.xml': numbering,
    'word/document.xml': x + '<w:document ' + W + '><w:body>' + body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>'
  };
  const z = {}; for (const k in files) z[k] = te.encode(files[k]);
  return new Blob([fflate.zipSync(z)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
