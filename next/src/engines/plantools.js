// MADE BY next/build.js FROM src/planner/*.js (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import * as fflate from 'fflate';
import { hash, deckSizes, RT_COLORS } from './planner.js';

// src/planner/review.js
const slideKey = s => JSON.stringify({ l: s.layout, t: s.title, b: s.body, z: s.size, n: s.notes, i: s.img && s.img.src.length + ':' + s.img.source, v: s.video && s.video.url + s.video.start });
// src/planner/lessons.js
async function shrinkPic(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const x = new Image(); x.onload = () => res(x); x.onerror = rej; x.src = url; });
    const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
    const png = /png|gif|webp/.test(file.type) && c.width * c.height < 1.2e6;
    return { src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86), w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}
// src/planner/materials.js
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
// src/planner/materials.js
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
// src/planner/finished.js
const finSig = l => hash(JSON.stringify(l.slides.map(slideKey)));
// src/planner/finished.js
const PX = { a: 'http://schemas.openxmlformats.org/drawingml/2006/main', p: 'http://schemas.openxmlformats.org/presentationml/2006/main', r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships' };
// src/planner/finished.js
const xmlOf = (z, p) => z[p] ? new DOMParser().parseFromString(new TextDecoder().decode(z[p]), 'application/xml') : null;
// src/planner/finished.js
const kids = (el, ns, name) => el ? [...el.getElementsByTagNameNS(ns, name)] : [];
// src/planner/finished.js
const kid = (el, ns, name) => kids(el, ns, name)[0] || null;
// src/planner/finished.js
function relsOf(z, part) {
  const i = part.lastIndexOf('/'), x = xmlOf(z, part.slice(0, i) + '/_rels/' + part.slice(i + 1) + '.rels'), m = {};
  if (x) for (const r of x.getElementsByTagName('Relationship')) {
    const t = r.getAttribute('Target'); if (r.getAttribute('TargetMode') === 'External') continue;
    m[r.getAttribute('Id')] = { type: r.getAttribute('Type') || '', path: pathJoin(part.slice(0, i), t) };
  }
  return m;
}
// src/planner/finished.js
function pathJoin(dir, t) {
  if (t.startsWith('/')) return t.slice(1);
  const out = dir.split('/');
  for (const s of t.split('/')) { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); }
  return out.join('/');
}
// src/planner/finished.js
const RT_HEX = () => ({ FF0000: 'red', C00000: 'red', FFC000: 'orange', ED7D31: 'orange', '00B050': 'green', '70AD47': 'green', '0070C0': 'blue', '0000FF': 'blue', '00B0F0': 'blue', '4472C4': 'blue', '7030A0': 'purple', '808080': 'gray', '7F7F7F': 'gray',
  ...Object.fromEntries(Object.entries(RT_COLORS).map(([k, v]) => [v.replace('#', '').toUpperCase(), k])) });
// src/planner/finished.js
function paraLine(p, bulleted, hexes) {
  const pPr = kid(p, PX.a, 'pPr');
  // Level: PowerPoint's own "lvl", or (as the Planner writes it) the left margin less the hanging indent, half an inch a level.
  const marL = pPr && pPr.getAttribute('marL'), base = marL != null ? +marL + Math.min(0, +pPr.getAttribute('indent') || 0) : 0;
  const lvl = Math.min(2, +(pPr && pPr.getAttribute('lvl')) || Math.round(base / 457200));
  let t = '';
  for (const n of p.childNodes) {
    if (n.localName === 'br') { t += ' '; continue; }
    if (n.localName !== 'r' && n.localName !== 'fld') continue;
    let x = (kid(n, PX.a, 't') || {}).textContent || ''; if (!x) continue;
    x = x.replace(/([*_{\\])/g, '\\$1');
    const rPr = kid(n, PX.a, 'rPr');
    if (rPr && x.trim()) {
      const clr = kid(kid(rPr, PX.a, 'solidFill'), PX.a, 'srgbClr'), c = clr && hexes[(clr.getAttribute('val') || '').toUpperCase()];
      if (rPr.getAttribute('u') && rPr.getAttribute('u') !== 'none') x = '__' + x + '__';
      if (rPr.getAttribute('i') === '1') x = '*' + x + '*';
      if (rPr.getAttribute('b') === '1') x = '**' + x + '**';
      if (c) x = '{' + c + '}' + x + '{/}';
    }
    t += x;
  }
  t = t.replace(/(?<!\\)\*\*\*\*/g, '');
  if (!t.trim()) return null;
  const none = pPr && kid(pPr, PX.a, 'buNone'), num = pPr && kid(pPr, PX.a, 'buAutoNum'), ch = pPr && kid(pPr, PX.a, 'buChar');
  const mark = none ? '' : num ? (+num.getAttribute('startAt') || 1) + '. ' : (ch || bulleted) ? '• ' : '';
  return '\t'.repeat(lvl) + mark + t.trim();
}
// src/planner/finished.js
function shapeText(sp, bulleted, hexes) {
  const tb = kid(sp, PX.p, 'txBody'); if (!tb) return [];
  return kids(tb, PX.a, 'p').map(p => paraLine(p, bulleted, hexes)).filter(x => x != null);
}
// src/planner/finished.js
function numberLines(lines) {
  const n = [0, 0, 0];
  return lines.map(x => {
    const d = /^\t*/.exec(x)[0].length, m = /^(\t*)(\d+)\. /.exec(x);
    for (let k = d + 1; k < 3; k++) n[k] = 0;
    if (!m) { n[d] = 0; return x; }
    n[d] = +m[2] > 1 ? +m[2] : n[d] + 1;
    return m[1] + n[d] + '. ' + x.slice(m[0].length);
  });
}
// src/planner/finished.js
async function mediaPic(z, path) {
  const u8 = z[path]; if (!u8) return null;
  const type = /\.png$/i.test(path) ? 'image/png' : /\.jpe?g$/i.test(path) ? 'image/jpeg' : /\.gif$/i.test(path) ? 'image/gif' : '';
  if (!type) return null;   // emf/wmf and the like can't be shown in a browser
  try { return await shrinkPic(new Blob([u8], { type })); } catch { return null; }
}
// src/planner/finished.js
async function pptxToSlides(u8) {
  const z = fflate.unzipSync(u8), hexes = RT_HEX();
  const pres = xmlOf(z, 'ppt/presentation.xml'); if (!pres) throw new Error('not a pptx');
  const prels = relsOf(z, 'ppt/presentation.xml');
  const order = kids(pres, PX.p, 'sldId').map(s => prels[s.getAttributeNS(PX.r, 'id')]).filter(Boolean).map(r => r.path);
  const out = [];
  for (const [i, part] of order.entries()) {
    const x = xmlOf(z, part); if (!x) continue;
    const rels = relsOf(z, part);
    let title = '', body = [], sizes = [], ctr = false, pic = null;
    for (const sp of kids(x, PX.p, 'sp')) {
      const ph = kid(kid(sp, PX.p, 'nvPr'), PX.p, 'ph'), type = ph ? ph.getAttribute('type') || 'body' : '';
      if (/^(sldNum|dt|ftr)$/.test(type)) continue;
      for (const r of kids(sp, PX.a, 'rPr')) if (+r.getAttribute('sz')) sizes.push(+r.getAttribute('sz') / 100);
      if (type === 'title' || type === 'ctrTitle') { ctr = ctr || type === 'ctrTitle'; title = title || shapeText(sp, false, hexes).map(t => t.replace(/^[•\t ]+|^\d+\. /g, '')).join(' '); continue; }
      body.push(...shapeText(sp, type === 'body' || type === 'obj' || (ph && !type), hexes));
    }
    for (const p of kids(x, PX.p, 'pic')) {
      if (pic) break;
      const bl = kid(p, PX.a, 'blip'), rid = bl && bl.getAttributeNS(PX.r, 'embed');
      if (rid && rels[rid]) pic = await mediaPic(z, rels[rid].path);
    }
    let notes = '';
    const nr = Object.values(rels).find(r => /notesSlide$/.test(r.type));
    const nx = nr && xmlOf(z, nr.path);
    if (nx) for (const sp of kids(nx, PX.p, 'sp')) {
      const ph = kid(kid(sp, PX.p, 'nvPr'), PX.p, 'ph'); if (!ph || (ph.getAttribute('type') && ph.getAttribute('type') !== 'body')) continue;
      notes = kids(sp, PX.a, 'p').map(p => kids(p, PX.a, 't').map(t => t.textContent).join('')).join('\n').trim();
    }
    const big = sizes.filter(s => s >= 20), size = big.length ? deckSizes().reduce((a, b) => Math.abs(b - Math.min(...big)) < Math.abs(a - Math.min(...big)) ? b : a) : 28;
    title = title.replace(/[\u200b\ufeff]/g, '').trim();
    const s = { title, body: numberLines(body).join('\n'), notes, size };
    if (ctr || (i === 0 && !pic && body.length <= 2)) { s.layout = 'title'; s.body = body.join('\n').replace(/^[•\t ]+|^\d+\. /gm, ''); }
    else if (pic && body.length) { s.layout = 'picprompt'; s.img = { ...pic, source: '' }; }
    else if (pic) { s.layout = 'picture'; s.img = { ...pic, source: '' }; }
    else s.layout = /\bagenda\b/i.test(title) ? 'agenda' : 'content';
    out.push(s);
  }
  return out;
}
// src/planner/share.js
function shareLesson(l) {
  const c = JSON.parse(JSON.stringify(l));
  for (const k of ['_file', '_mod', 'pending', 'slots', 'taught', 'talk', 'claudeNote', 'status', 'unit', 'library', 'variantOf', 'variant', 'files', 'final', 'finals', 'ready']) delete c[k];
  c.slides = c.slides.map(s => { const { ask, talk, ctx, ...keep } = s; return keep; });
  return c;
}
export { pptxToSlides, docxOf, shareLesson, finSig };
