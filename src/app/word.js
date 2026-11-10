/* ---------------- Word files (.docx, .docm with macros, .dotx): shown as pages, and edited in place ---------------- */
// Edits go straight into the file's own document.xml; every other part of the file (styles, pictures, the macro
// project in a .docm) is kept byte for byte, so the file still opens in Word with its formatting and macros.
// Macros can't run in a browser.
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const W14_NS = 'http://schemas.microsoft.com/office/word/2010/wordml';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const WORD_RX = /\.(docx|docm|dotx|dotm)$/i;
const wkids = (el, name) => el ? [...el.children].filter(c => c.localName === name) : [];
const wkid = (el, name) => wkids(el, name)[0] || null;
const wval = el => el ? (el.getAttributeNS(W_NS, 'val') ?? el.getAttribute('w:val')) : null;
const won = el => !!el && !/^(0|false|off|none)$/i.test(wval(el) || '');
const HLC = { yellow: '#FFFF00', green: '#00FF00', cyan: '#00FFFF', magenta: '#FF00FF', blue: '#0000FF', red: '#FF0000', darkBlue: '#00008B', darkCyan: '#008B8B', darkGreen: '#006400', darkMagenta: '#800080', darkRed: '#8B0000', darkYellow: '#808000', darkGray: '#A9A9A9', lightGray: '#D3D3D3', black: '#000000', white: '#FFFFFF' };
function openWord(bytes) {
  const files = fflate.unzipSync(bytes);
  const xml = files['word/document.xml']; if (!xml) throw new Error('no document.xml');
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(xml), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('bad xml');
  const rels = {}, rx = files['word/_rels/document.xml.rels'];
  if (rx) for (const r of new DOMParser().parseFromString(new TextDecoder().decode(rx), 'application/xml').getElementsByTagName('Relationship')) rels[r.getAttribute('Id')] = r.getAttribute('Target');
  return { files, doc, rels, paras: [], runs: [], cells: [], boxes: [], urls: [], macros: !!files['word/vbaProject.bin'] };
}
function wordBytes(w) {
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + new XMLSerializer().serializeToString(w.doc.documentElement);
  return fflate.zipSync({ ...w.files, 'word/document.xml': new TextEncoder().encode(xml) });
}
function renderWord(w, host) {
  for (const u of w.urls) URL.revokeObjectURL(u);
  w.paras = []; w.runs = []; w.cells = []; w.boxes = []; w.urls = [];
  host.innerHTML = '';
  const body = wkid(w.doc.documentElement, 'body');
  wBlocks(w, body, host);
}
function wBlocks(w, node, out) {
  for (const c of node ? node.children : []) {
    if (c.localName === 'p') out.appendChild(wPara(w, c));
    else if (c.localName === 'tbl') out.appendChild(wTable(w, c));
    else if (c.localName === 'sdt') wBlocks(w, wkid(c, 'sdtContent'), out);
    else if (c.localName === 'customXml' || c.localName === 'ins') wBlocks(w, c, out);
  }
}
function wPara(w, p) {
  const el = document.createElement('p'); el.className = 'wp';
  el.dataset.pi = w.paras.push(p) - 1;
  const pPr = wkid(p, 'pPr');
  const jc = wval(wkid(pPr, 'jc')); if (jc) el.style.textAlign = jc === 'both' ? 'justify' : jc === 'end' ? 'right' : jc === 'start' ? 'left' : jc;
  const st = wval(wkid(pPr, 'pStyle')) || '', hm = /heading\s*(\d)|^title$/i.exec(st);
  if (hm) { el.style.fontWeight = '700'; el.style.fontSize = (hm[1] ? Math.max(1.05, 1.6 - hm[1] * 0.15) : 1.9) + 'em'; }
  const ind = wkid(pPr, 'ind'); if (ind) { const l = +(ind.getAttributeNS(W_NS, 'left') || ind.getAttributeNS(W_NS, 'start') || 0); if (l) el.style.paddingLeft = Math.round(l / 15) + 'px'; }
  const shd = wkid(pPr, 'shd'), fill = shd && shd.getAttributeNS(W_NS, 'fill'); if (fill && /^[0-9a-f]{6}$/i.test(fill)) el.style.background = '#' + fill;
  if (wkid(pPr, 'numPr')) { const b = document.createElement('span'); b.className = 'wbul'; b.contentEditable = 'false'; b.textContent = '•\t'; el.appendChild(b); }
  wInline(w, p, el);
  return el;
}
function wInline(w, node, el) {
  for (const c of node.children) {
    const n = c.localName;
    if (n === 'r') wRun(w, c, el);
    else if (n === 'sdt') {
      const pr = wkid(c, 'sdtPr'), cb = pr && [...pr.children].find(x => x.localName === 'checkbox' && x.namespaceURI === W14_NS);
      if (cb) el.appendChild(wCheck(w, { kind: 'sdt', sdt: c, cb }));
      else wInline(w, wkid(c, 'sdtContent') || c, el);
    } else if (['hyperlink', 'ins', 'smartTag', 'fldSimple', 'customXml', 'sdtContent'].includes(n)) wInline(w, c, el);
  }
}
function wRun(w, r, el) {
  const rPr = wkid(r, 'rPr');
  // an old-style form checkbox: its field starts in this run
  const fc = wkid(r, 'fldChar'), cbx = fc && wkid(wkid(fc, 'ffData'), 'checkBox');
  if (cbx) { el.appendChild(wCheck(w, { kind: 'ff', cbx })); return; }
  for (const d of [...wkids(r, 'drawing'), ...wkids(r, 'pict')]) {
    const blip = d.getElementsByTagNameNS('*', 'blip')[0] || d.getElementsByTagNameNS('*', 'imagedata')[0];
    const id = blip && (blip.getAttributeNS(R_NS, 'embed') || blip.getAttributeNS(R_NS, 'id'));
    const tgt = id && w.rels[id], data = tgt && w.files['word/' + tgt.replace(/^\/?word\//, '').replace(/^\.\//, '')];
    if (data) {
      const ext = /\.(\w+)$/.exec(tgt), u = URL.createObjectURL(new Blob([data], { type: 'image/' + (ext ? ext[1].toLowerCase().replace('jpg', 'jpeg') : 'png') }));
      w.urls.push(u);
      const img = document.createElement('img'); img.src = u; img.alt = ''; img.contentEditable = 'false';
      const ext2 = d.getElementsByTagNameNS('*', 'extent')[0];
      if (ext2) img.style.width = Math.round(+ext2.getAttribute('cx') / 9525) + 'px';
      el.appendChild(img);
    }
  }
  let text = '', hasText = false;
  for (const c of r.children) {
    const n = c.localName;
    if (n === 't') { text += c.textContent; hasText = true; }
    else if (n === 'tab') { text += '\t'; hasText = true; }
    else if (n === 'br' || n === 'cr') { text += '\n'; hasText = true; }
    else if (n === 'noBreakHyphen') { text += '‑'; hasText = true; }
  }
  if (!hasText) return;
  const s = document.createElement('span');
  s.dataset.ri = w.runs.push(r) - 1;
  s.textContent = text;
  if (rPr) {
    if (won(wkid(rPr, 'b'))) s.style.fontWeight = '700';
    if (won(wkid(rPr, 'i'))) s.style.fontStyle = 'italic';
    const u = wkid(rPr, 'u'), deco = [];
    if (u && wval(u) !== 'none') deco.push('underline');
    if (won(wkid(rPr, 'strike')) || won(wkid(rPr, 'dstrike'))) deco.push('line-through');
    if (deco.length) s.style.textDecoration = deco.join(' ');
    const col = wval(wkid(rPr, 'color')); if (col && /^[0-9a-f]{6}$/i.test(col)) s.style.color = '#' + col;
    const hl = wval(wkid(rPr, 'highlight')); if (hl && HLC[hl]) s.style.background = HLC[hl];
    const sh = wkid(rPr, 'shd'), sf = sh && sh.getAttributeNS(W_NS, 'fill'); if (sf && /^[0-9a-f]{6}$/i.test(sf)) s.style.background = '#' + sf;
    const sz = +wval(wkid(rPr, 'sz')); if (sz) s.style.fontSize = (sz / 22).toFixed(2) + 'em';
    const va = wval(wkid(rPr, 'vertAlign')); if (va === 'superscript' || va === 'subscript') { s.style.verticalAlign = va === 'superscript' ? 'super' : 'sub'; s.style.fontSize = '0.75em'; }
  }
  el.appendChild(s);
}
function wCheck(w, box) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'wchk'; b.contentEditable = 'false';
  b.dataset.ki = w.boxes.push(box) - 1;
  b.textContent = wChecked(box) ? '☒' : '☐';
  b.setAttribute('aria-pressed', wChecked(box));
  return b;
}
function wChecked(box) {
  if (box.kind === 'sdt') { const c = [...box.cb.children].find(x => x.localName === 'checked'); return !!c && /^(1|true)$/i.test(c.getAttributeNS(W14_NS, 'val') || ''); }
  const ch = wkid(box.cbx, 'checked'); if (ch) return wval(ch) == null || won(ch);
  return won(wkid(box.cbx, 'default'));
}
function wToggle(w, box) {
  const on = !wChecked(box);
  if (box.kind === 'sdt') {
    let c = [...box.cb.children].find(x => x.localName === 'checked');
    if (!c) { c = w.doc.createElementNS(W14_NS, 'w14:checked'); box.cb.insertBefore(c, box.cb.firstChild); }
    c.setAttributeNS(W14_NS, 'w14:val', on ? '1' : '0');
    const st = [...box.cb.children].find(x => x.localName === (on ? 'checkedState' : 'uncheckedState'));
    const glyph = st && st.getAttributeNS(W14_NS, 'val') ? String.fromCharCode(parseInt(st.getAttributeNS(W14_NS, 'val'), 16)) : on ? '☒' : '☐';
    const t = box.sdt.getElementsByTagNameNS(W_NS, 't')[0]; if (t) t.textContent = glyph;
  } else {
    let ch = wkid(box.cbx, 'checked');
    if (!ch) { ch = w.doc.createElementNS(W_NS, 'w:checked'); box.cbx.appendChild(ch); }
    ch.setAttributeNS(W_NS, 'w:val', on ? '1' : '0');
  }
  return on;
}
function wTable(w, tbl) {
  const t = document.createElement('table'); t.className = 'wt';
  const grid = wkids(wkid(tbl, 'tblGrid'), 'gridCol').map(g => +(g.getAttributeNS(W_NS, 'w') || 0));
  if (grid.length && grid.every(Boolean)) { const cg = document.createElement('colgroup'); for (const g of grid) { const c = document.createElement('col'); c.style.width = Math.round(g / 15) + 'px'; cg.appendChild(c); } t.appendChild(cg); }
  const tb = document.createElement('tbody'); t.appendChild(tb);
  const above = [];   // per grid column: the cell a vertical merge continues
  for (const tr of wkids(tbl, 'tr')) {
    const row = document.createElement('tr'); tb.appendChild(row);
    let col = 0;
    for (const tc of wkids(tr, 'tc')) {
      const pr = wkid(tc, 'tcPr'), span = +(wval(wkid(pr, 'gridSpan')) || 1), vm = wkid(pr, 'vMerge');
      if (vm && wval(vm) !== 'restart' && above[col]) { above[col].rowSpan++; col += span; continue; }
      const td = document.createElement('td'); if (span > 1) td.colSpan = span;
      td.dataset.ci = w.cells.push(tc) - 1;
      const sh = wkid(pr, 'shd'), fill = sh && sh.getAttributeNS(W_NS, 'fill'); if (fill && /^[0-9a-f]{6}$/i.test(fill)) td.style.background = '#' + fill;
      wBlocks(w, tc, td);
      row.appendChild(td);
      for (let k = 0; k < span; k++) above[col + k] = vm ? td : null;
      col += span;
    }
  }
  return t;
}
// Puts what is on screen in one paragraph back into its runs (each run keeps its own formatting).
function wApplyPara(w, el) {
  const p = w.paras[+el.dataset.pi]; if (!p) return;
  const mine = [...el.querySelectorAll('[data-ri]')].map(s => w.runs[+s.dataset.ri]);
  let last = null;
  const place = r => { if (last && last.parentNode) last.parentNode.insertBefore(r, last.nextSibling); else { const pPr = wkid(p, 'pPr'); p.insertBefore(r, pPr ? pPr.nextSibling : p.firstChild); } last = r; };
  const loose = text => {
    if (!text) return;
    if (last) { wSetText(w, last, wRunText(last) + text); return; }
    const r = w.doc.createElementNS(W_NS, 'w:r');
    const like = mine[0] || p.getElementsByTagNameNS(W_NS, 'r')[0], rPr = like && wkid(like, 'rPr');
    if (rPr) r.appendChild(rPr.cloneNode(true));
    place(r); wSetText(w, r, text);
  };
  const walk = node => {
    for (const c of [...node.childNodes]) {
      if (c.nodeType === 3) { loose(c.textContent); continue; }
      if (c.nodeType !== 1 || c.contentEditable === 'false' || c.tagName === 'BR') continue;
      if (c.dataset.ri != null) { const r = w.runs[+c.dataset.ri]; if (r.parentNode !== p && !p.contains(r)) place(r); wSetText(w, r, c.textContent); last = r; continue; }
      walk(c);   // something the browser wrapped text in
    }
  };
  walk(el);
  const keep = new Set(mine);
  for (const r of w.pRuns[+el.dataset.pi] || []) if (!keep.has(r) && r.parentNode) r.parentNode.removeChild(r);
  w.pRuns[+el.dataset.pi] = [...el.querySelectorAll('[data-ri]')].map(s => w.runs[+s.dataset.ri]);
}
const wRunText = r => [...r.children].map(c => c.localName === 't' ? c.textContent : c.localName === 'tab' ? '\t' : c.localName === 'br' || c.localName === 'cr' ? '\n' : '').join('');
function wSetText(w, r, text) {
  for (const c of [...r.children]) if (['t', 'tab', 'br', 'cr', 'noBreakHyphen'].includes(c.localName)) r.removeChild(c);
  text.split(/(\t|\n)/).forEach(part => {
    if (!part) return;
    if (part === '\t') r.appendChild(w.doc.createElementNS(W_NS, 'w:tab'));
    else if (part === '\n') r.appendChild(w.doc.createElementNS(W_NS, 'w:br'));
    else { const t = w.doc.createElementNS(W_NS, 'w:t'); t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve'); t.textContent = part; r.appendChild(t); }
  });
}
function wShadeCell(w, tc, hex) {
  let pr = wkid(tc, 'tcPr');
  if (!pr) { pr = w.doc.createElementNS(W_NS, 'w:tcPr'); tc.insertBefore(pr, tc.firstChild); }
  let sh = wkid(pr, 'shd');
  if (!hex) { if (sh) pr.removeChild(sh); return; }
  if (!sh) {
    sh = w.doc.createElementNS(W_NS, 'w:shd');
    // shd sits after the other cell settings Word expects before it
    const after = [...pr.children].find(c => ['noWrap', 'tcMar', 'textDirection', 'tcFitText', 'vAlign', 'hideMark', 'headers', 'cellIns', 'cellDel', 'cellMerge', 'tcPrChange'].includes(c.localName));
    pr.insertBefore(sh, after || null);
  }
  sh.setAttributeNS(W_NS, 'w:val', 'clear'); sh.setAttributeNS(W_NS, 'w:color', 'auto'); sh.setAttributeNS(W_NS, 'w:fill', hex.replace('#', '').toUpperCase());
}
const CELL_COLORS = [['#FFF59D', 'Yellow'], ['#C8E6C9', 'Green'], ['#BBDEFB', 'Blue'], ['#F8BBD0', 'Pink'], ['', 'No color']];
const wordSaves = new Set();   // Word edits waiting out their short pause before they're saved
// One Word file on screen. Editing: click any text and type; click a table cell then a color to shade it.
async function wordCard(st, f, opts) {
  opts = opts || {};
  const el = document.createElement('div'); el.className = 'docx'; el.wordF = f;
  el.innerHTML = '<div class="fhead"><span style="color:var(--fg)">' + esc(opts.title || f.name) + '</span><span>' + (/\.docm$|\.dotm$/i.test(f.name) ? 'Word file with macros' : 'Word file') + '</span>' +
    (f.rubric ? '<span class="addtag" style="background:var(--accent-soft);color:var(--accent)">Your rubric</span>' : '') + (f.edited ? '<span class="addtag" style="background:var(--accent-soft);color:var(--accent)">Edited by you</span>' : '') + (f.added ? addTag(f) : '') + '<span style="flex:1"></span>' +
    (opts.readOnly ? '' : '<button class="btn sm" data-wnote title="Select words, then press this to comment on them. Or pick the Comment tool and click a word.">Comment</button><button class="btn sm" data-wedit>Edit</button>' + (wordCanPdf(f) ? '<button class="btn sm" data-wpdf title="Turn this file into pages you can mark and comment on anywhere, like a PDF. The Word file is kept.">Convert to PDF</button>' : '')) + '<button class="btn sm ghost" data-wdl>Download</button></div>' +
    '<div class="wbar" hidden></div><div class="wdoc"><div class="dpage"><p class="muted">Opening…</p></div><aside class="wnotes" hidden></aside></div>';
  const page = el.querySelector('.dpage'), bar = el.querySelector('.wbar');
  let w;
  try { w = openWord(f.data); w.pRuns = []; renderWord(w, page); }
  catch (e) {
    console.error(e);
    try { page.innerHTML = await docxHtml(f.data); } catch { page.innerHTML = '<p>' + (troubleText(troubleOf(f)) || 'This Word file couldn’t be opened here. Download it to open it in Word.') + '</p>'; }
    for (const b of el.querySelectorAll('[data-wedit], [data-wnote]')) b.remove();
  }
  // Her own rubric scores by its boxes. A table in a student's file does only when it reads as a rubric, or she says to score with it: a numbered table in
  // an essay isn't one, and a click in it mustn't shade a box and set a score.
  if (w && !opts.readOnly) setTimeout(() => {
    const wire = () => wireRubric(st, f, w, page, el, () => soon());
    wordScore(f);
    if (f.wscore || !f.wtab) return wire();
    const off = document.createElement('div'); off.className = 'rinfo roff';
    off.innerHTML = '<span class="muted">A table in this file could be a score rubric.</span><button class="link" data-wtabon style="font-size:12.5px">Score with it</button>';
    el.insertBefore(off, page.closest('.wdoc') || page);
    // for this assignment, until the page is closed: every student's table is read again as a rubric
    off.querySelector('button').onclick = () => { wordTabOn.add(batch.id); for (const x of batch.students) for (const g of x.files) if (g.kind === 'docx') g.wsOf = null; off.remove(); wordScoresAll(); wire(); };
  }, 0);
  if (w) w.pRuns = w.paras.map((_, i) => [...page.querySelectorAll('p[data-pi="' + i + '"] > [data-ri], p[data-pi="' + i + '"] [data-ri]')].map(s => w.runs[+s.dataset.ri]));
  for (const a of page.querySelectorAll('a')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  let editing = false, cell = null, saveT = null;
  const dirty = new Set();
  const saveNowW = async () => {
    clearTimeout(saveT); saveT = null; wordSaves.delete(saveNowW);
    if (!w) return;
    for (const p of dirty) if (p.isConnected) wApplyPara(w, p);
    dirty.clear();
    if (!f.orig) f.orig = f.data;
    f.data = wordBytes(w); f.edited = Date.now(); f.size2 = f.data.length;
    wordScore(f);
    await keepEdit(st, f);
    refound(st); gradeShown(st);
    renderList();
  };
  const soon = () => { clearTimeout(saveT); saveT = setTimeout(saveNowW, 700); wordSaves.add(saveNowW); };
  const setEditing = on => {
    editing = on;
    page.classList.toggle('editing', on);
    for (const p of page.querySelectorAll('p.wp')) p.contentEditable = on ? 'true' : 'false';
    el.querySelector('[data-wedit]').textContent = on ? 'Done editing' : 'Edit';
    bar.hidden = !on;
    bar.innerHTML = '<span>Click any text to type. Click a table cell, then a color to shade it:</span>' + CELL_COLORS.map(([c, l]) => '<button class="sw" data-cell="' + c + '" title="' + l + '" style="background:' + (c || '#fff') + '">' + (c ? '' : '⦸') + '</button>').join('') +
      (f.orig || f.edited ? '<span style="flex:1"></span><button class="link" data-wreset>Back to the original</button>' : '') +
      (w && w.macros ? '<div class="muted" style="width:100%;font-size:12.5px">Macros can’t run in a browser, but they stay in the file, so they work again when you open it in Word.</div>' : '');
    if (!on) saveNowW();
  };
  el.addEventListener('click', async e => {
    if (e.target.closest('[data-wdl]')) { await saveNowW(); return saveBlob(f.name, new Blob([f.data])); }
    if (e.target.closest('[data-wedit]')) return setEditing(!editing);
    if (e.target.closest('[data-wpdf]')) { if (editing) setEditing(false); return openWordPdf(st, f); }
    if (e.target.closest('[data-wreset]')) {
      if (saveT) await saveNowW();
      const orig = f.orig || await origBytes(st, f); if (!orig) return toast('The original isn’t kept in this browser');
      const was = wordScore(f);
      f.data = orig; f.orig = null; f.edited = 0; await dropEdit(st, f); toast('Back to the original');
      wordScoreGone(st, was); wordScore(f); refound(st); renderList();   // if the original has boxes highlighted, its score comes in as the card opens
      return openStudent(cur, f.path);
    }
    const k = e.target.closest('.wchk');
    if (k && w) { if (!editing) return toast('Click Edit first to change the file'); const on = wToggle(w, w.boxes[+k.dataset.ki]); k.textContent = on ? '☒' : '☐'; k.setAttribute('aria-pressed', on); soon(); return; }
    const sw = e.target.closest('[data-cell]');
    if (sw && w) { if (!cell) return toast('Click a table cell first'); wShadeCell(w, w.cells[+cell.dataset.ci], sw.dataset.cell); cell.style.background = sw.dataset.cell || ''; if (el.wordPush) el.wordPush(); soon(); return; }
    const td = e.target.closest('td[data-ci]');
    if (td && editing) { if (cell) cell.classList.remove('wsel'); cell = td; td.classList.add('wsel'); }
  });
  page.addEventListener('input', e => { const p = e.target.closest('p.wp'); if (p) { dirty.add(p); soon(); } });
  page.addEventListener('keydown', e => {
    if (!editing) return;
    e.stopPropagation();   // typing here never triggers the app's shortcut keys
    if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertText', false, '\n'); }
    if ((e.metaKey || e.ctrlKey) && /^[biu]$/i.test(e.key)) e.preventDefault();   // formatting stays as it is in the file
  });
  page.addEventListener('paste', e => { if (!editing) return; e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\r\n?/g, '\n')); });
  page.addEventListener('focusout', () => { if (dirty.size) saveNowW(); });
  if (w && !opts.readOnly) wireWordNotes(w, el, page, el.querySelector('.wnotes'), () => editing, () => { for (const p of dirty) if (p.isConnected) wApplyPara(w, p); dirty.clear(); }, () => saveNowW());
  return el;
}
// Edited Word files are kept in this browser (per download), so the edits come back next time.
async function keepEdit(st, f) {
  try { await kdo('edits', 'readwrite', o => o.put({ data: f.data, orig: f.orig || null, t: f.edited }, batch.id + '|' + f.path)); saveSoon(); return true; }
  catch { toast('This browser couldn’t keep your edit. Download the file to keep it.'); }
}
async function dropEdit(st, f) { try { await kdo('edits', 'readwrite', o => o.delete(batch.id + '|' + f.path)); noteGone(batch, EDIT_OFF + f.path); saveSoon(); } catch {} }
async function origBytes(st, f) { const r = await kget('edits', batch.id + '|' + f.path); return r && r.orig; }
async function loadEdits() {
  let recs = [], keys = [];
  try {
    const range = IDBKeyRange.bound(batch.id + '|', batch.id + '|￿');
    recs = await kdo('edits', 'readonly', o => o.getAll(range)) || [];
    keys = await kdo('edits', 'readonly', o => o.getAllKeys(range)) || [];
  } catch { return; }
  keys.forEach((k, i) => {
    const path = k.slice(batch.id.length + 1);
    for (const st of batch.students) { const f = st.files.find(x => x.path === path); if (f && recs[i]) { f.orig = recs[i].orig || f.data; f.data = recs[i].data; f.edited = recs[i].t || 1; } }
  });
  // Highlights on a rubric that was replaced under a new name on the other computer: kept, but no file here shows them, so she's told. Their scores stay.
  const b0 = batch, lost = new Set();
  for (const k of keys) {
    const path = k.slice(b0.id.length + 1);
    if (b0.students.some(st => st.files.some(x => x.path === path))) continue;
    const st = b0.students.find(st => path.startsWith(st.key + '/'));
    if (st && st.files.some(f => f.virtual && f.kind === 'docx')) lost.add(st.key);
  }
  if (lost.size) setTimeout(() => { if (batch === b0) toast('A highlighted copy of an older rubric is kept for ' + lost.size + (lost.size === 1 ? ' student' : ' students') + ', but this rubric doesn’t show it. Their scores stay, so check them against this rubric.', 12000); }, 1200);
}

