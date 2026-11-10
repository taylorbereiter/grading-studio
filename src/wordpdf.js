/* ---------------- a Word paper as PDF pages (11/10) ---------------- */
// For a student's Word file she'd rather mark like any other paper. The file is drawn as pages the way it looks here, with its words laid
// over the pictures unseen, so a highlight snaps to a line and a name can be covered. The PDF takes the Word file's place the way Replace
// does: it's added to the student (addFiles) and the Word file waits under Removed files with Bring back. The Word file itself never changes.
// Nothing new is stored but one setting, gs.wordPdf, for doing this as Word papers come in.
const WP_MAX = 60, WP_PX = 96 / 72, WP_FONT = 14.67;   // pages at most; screen dots to a point; 11 pt in screen dots
const wordPdfAlways = () => !!store.get('gs.wordPdf', false);
// A student's own Word file. Her rubric copy stays a Word file: its boxes are how she scores. A group-work copy follows the paper it was shared from.
function wordCanPdf(f) { return !!f && f.kind === 'docx' && !f.virtual && !f.rubric && !f.from && !!f.data; }
// A grade she took from what's typed in the Word file lives with that file, so it isn't converted without her saying so.
const wordReadUsed = (st, f) => wordFound(f, st).some(g => (st.grade.reads || {})[readKey(g)] === 1);
const wordPdfList = () => !batch ? [] : batch.students.flatMap(st => st.files.filter(wordCanPdf).map(f => ({ st, f })));
// The ones that can go without asking: nothing of hers is on the Word file yet, and she hasn't brought it back from a conversion.
// A paper shared with partners (group work) is hers to convert by hand, since their copies are the Word file.
const wordPdfFree = ({ st, f }) => !f.edited && !f.hand && !wordReadUsed(st, f) && !((batch.removed || {})[f.path] || {}).back && !shareCopies(st, f).length;

// The page the file was written for, in points. A4 with one-inch margins when the file doesn't say.
function wordPageBox(w) {
  const tw = (el, k) => { const v = el ? +(el.getAttributeNS(W_NS, k) || el.getAttribute('w:' + k)) : 0; return v > 0 ? v / 20 : null; };
  let sect = null, sz = null, mar = null;
  try { sect = w && wkid(wkid(w.doc.documentElement, 'body'), 'sectPr'); sz = sect && wkid(sect, 'pgSz'); mar = sect && wkid(sect, 'pgMar'); } catch {}
  const W = clamp(tw(sz, 'w') || 595.28, 360, 1224), H = clamp(tw(sz, 'h') || 841.89, 360, 1224);
  const m = k => clamp(tw(mar, k) || 72, 28, Math.min(W, H) / 4);
  return { W, H, t: m('top'), r: m('right'), b: m('bottom'), l: m('left') };
}
// Comments already in the file (hers or anyone's) can't be cards beside a picture, so their words are lit and numbered and the comments are listed at the end.
function wordPdfNotes(w, page) {
  let els = [];
  try { els = wCommentEls(w); } catch {}
  if (!els.length) return;
  try {
    wNotesPaint(w, page, document.createElement('aside'));
    const by = new Map(els.map(c => [wId(c), c])), order = wCommentMap(w).order;
    const box = document.createElement('div'); box.style.cssText = 'margin-top:28px;padding-top:10px;border-top:1px solid #9aa0ad;font-size:.92em';
    box.innerHTML = '<p class="wp" style="font-weight:700">Comments</p>' + order.map((id, i) => '<p class="wp"><span style="color:#D7263D;font-weight:700">' + (i + 1) + '</span>  ' + esc(wCommentText(by.get(id)) || '') + '</p>').join('');
    page.appendChild(box);
  } catch (e) { console.error(e); }
}
// What the drawn page is made of, in screen dots from the page's top left: filled boxes, edges, pictures, check boxes and words.
function wordPdfParts(page) {
  const o = page.getBoundingClientRect(), P = { fills: [], lines: [], imgs: [], checks: [], words: [] };
  const rel = b => ({ x: b.left - o.left, y: b.top - o.top, w: b.width, h: b.height });
  const col = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const v = m[1].split(/[,\s/]+/).filter(Boolean).map(Number), a = v.length > 3 ? v[3] : 1; return a > 0 ? { r: v[0] / 255, g: v[1] / 255, b: v[2] / 255, a } : null; };
  for (const el of page.querySelectorAll('*')) {
    if (el.closest('button')) { if (el.matches('.wchk')) P.checks.push({ ...rel(el.getBoundingClientRect()), on: el.getAttribute('aria-pressed') === 'true' }); continue; }
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.tagName === 'IMG') { const b = rel(el.getBoundingClientRect()); if (b.w > 1 && b.h > 1) P.imgs.push({ el, ...b }); continue; }
    const whole = rel(el.getBoundingClientRect()), bg = col(cs.backgroundColor);
    if (bg) for (const b of cs.display === 'inline' ? [...el.getClientRects()].map(rel) : [whole]) if (b.w > .5 && b.h > .5) P.fills.push({ ...b, c: bg });
    // a table's shared edges sit on the cell's own edge; any other edge is just inside the box
    const cell = /^T[DH]$/.test(el.tagName) && cs.borderCollapse === 'collapse';
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const wd = parseFloat(cs['border' + side + 'Width']) || 0, c = wd && !/none|hidden/.test(cs['border' + side + 'Style']) ? col(cs['border' + side + 'Color']) : null;
      if (!c) continue;
      const k = cell ? 0 : wd / 2, x1 = whole.x + k, y1 = whole.y + k, x2 = whole.x + whole.w - k, y2 = whole.y + whole.h - k;
      P.lines.push({ wd, c, ...(side === 'Top' ? { x1, y1, x2, y2: y1 } : side === 'Bottom' ? { x1, y1: y2, x2, y2 } : side === 'Left' ? { x1, y1, x2: x1, y2 } : { x1: x2, y1, x2, y2 }) });
    }
  }
  const tw = document.createTreeWalker(page, NodeFilter.SHOW_TEXT), r = document.createRange(), looks = new Map(), g = document.createElement('canvas').getContext('2d');
  const lookOf = el => {
    if (looks.has(el)) return looks.get(el);
    const cs = getComputedStyle(el); let deco = '';
    for (let e = el; e; e = e.parentElement) { deco += ' ' + getComputedStyle(e).textDecorationLine; if (e === page) break; }   // an underline belongs to the words inside it too
    const font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    g.font = font; const m = g.measureText('Hg');
    const L = { size: parseFloat(cs.fontSize) || WP_FONT, bold: (+cs.fontWeight || 400) >= 600, ital: /italic|oblique/.test(cs.fontStyle), c: col(cs.color) || { r: 0, g: 0, b: 0, a: 1 }, under: /underline/.test(deco), strike: /line-through/.test(deco), font,
      asc: m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * .9, desc: m.fontBoundingBoxDescent || parseFloat(cs.fontSize) * .22, show: cs.visibility !== 'hidden' && cs.display !== 'none' };
    looks.set(el, L); return L;
  };
  for (let n; (n = tw.nextNode());) {
    const el = n.parentElement; if (!el || !/\S/.test(n.data) || el.closest('button')) continue;
    const L = lookOf(el); if (!L.show) continue;
    for (const m of n.data.matchAll(/\S+/g)) {
      r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      const b = r.getClientRects()[0];   // a word broken over two lines keeps its first piece
      if (!b || b.width < .5 || b.height < 2) continue;
      const q = rel(b);
      P.words.push({ s: m[0], ...q, base: q.y + (q.h - L.asc - L.desc) / 2 + L.asc, L });
    }
  }
  // bullets and numbers of a plain list (a file the simple reader opened): the browser draws them, so they aren't text to find
  for (const li of page.querySelectorAll('li')) {
    const b = rel(li.getBoundingClientRect()), L = lookOf(li), ol = li.parentElement && li.parentElement.tagName === 'OL';
    const s = ol ? ([...li.parentElement.children].indexOf(li) + 1) + '.' : '•';
    P.words.push({ s, x: b.x - L.size * (ol ? 1.5 : 1.1), y: b.y, w: L.size * (ol ? .9 : .35), h: L.asc + L.desc, base: b.y + (parseFloat(getComputedStyle(li).lineHeight) || L.size * 1.4) / 2 + (L.asc - L.desc) / 2, L, mark: true });
  }
  return P;
}
// Where one page ends and the next begins: never through a line of words or a picture, unless the thing is most of a page tall.
function wordPdfCuts(total, pageH, atoms) {
  const cuts = [0];
  while (total - cuts[cuts.length - 1] > pageH + 1) {
    if (cuts.length >= WP_MAX) throw new Error('too long');
    const start = cuts[cuts.length - 1];
    let y = start + pageH;
    for (let moved = true; moved;) {
      moved = false;
      for (const [a, b] of atoms) if (a < y - .5 && b > y + .5 && a - 2 > start + pageH * .35) { y = a - 2; moved = true; }
    }
    cuts.push(y);
  }
  cuts.push(total);
  return cuts;
}
// The file drawn off screen at its page's width, in a face the PDF's built-in font matches letter for letter. done() takes it away.
async function wordPdfStage(f) {
  let w = null;
  try { w = openWord(f.data); w.pRuns = []; } catch (e) { console.error(e); }
  const box = wordPageBox(w), Wpx = Math.round(box.W * WP_PX);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + Wpx + 'px;pointer-events:none;--dfs:' + WP_FONT + 'px;--dlh:1.4';
  const page = document.createElement('div'); page.className = 'dpage';
  page.style.cssText = 'max-width:none;width:' + Wpx + 'px;box-sizing:border-box;margin:0;box-shadow:none;overflow:visible;border-radius:0;padding:0 ' + (box.r * WP_PX).toFixed(1) + 'px 0 ' + (box.l * WP_PX).toFixed(1) + 'px;' +
    'font-family:Arial,Helvetica,"Liberation Sans",Arimo,"Nimbus Sans",sans-serif;font-kerning:none;font-variant-ligatures:none';
  host.appendChild(page); document.body.appendChild(host);
  const done = () => { host.remove(); if (w) for (const u of w.urls) URL.revokeObjectURL(u); };
  try {
    if (w) { renderWord(w, page); wordPdfNotes(w, page); }
    else page.innerHTML = await docxHtml(f.data);
    await Promise.all([...page.querySelectorAll('img')].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
    const P = wordPdfParts(page), total = Math.max(1, Math.ceil(page.getBoundingClientRect().height)), pageH = (box.H - box.t - box.b) * WP_PX;
    const cuts = wordPdfCuts(total, pageH, P.words.filter(q => !q.mark).map(q => [q.y, q.y + q.h]).concat(P.imgs.map(q => [q.y, q.y + q.h]), P.checks.map(q => [q.y, q.y + q.h])));
    return { w, box, Wpx, host, page, P, cuts, done };
  } catch (e) { done(); throw e; }
}
// The PDF, written rather than photographed: the words are real text in the PDF's own font where it has the letters, so the file is small, stays sharp
// at any zoom, and a highlight snaps to a line and a name can be covered. A word in another alphabet is a small picture of itself, like a scan:
// a name written that way is covered by hand in Check the covers.
async function wordPagesPdf(f) {
  const S = await wordPdfStage(f);
  try {
    try { return await wordPdfWrite(f, S); }
    catch (e) { if (/too long/.test(String(e && e.message))) throw e; console.error(e); return await wordPdfPictures(f, S); }
  } finally { S.done(); }
}
// A word the built-in font can't write (Thai, Chinese, a symbol) is drawn as a small picture. So it can still be read off the page (a name to cover,
// a line for a highlight to snap to), its letters are also written unseen, in a font whose one glyph is blank. The font is 624 bytes: two empty
// glyphs, each half as wide as the type is tall.
const WP_BLANK = 'AAEAAAAKAIAAAwAgT1MvMkT/RUAAAAEoAAAAYGNtYXAADABzAAABkAAAADRnbHlmAAAAAAAAAcwAAAABaGVhZC1GmP4AAACsAAAANmhoZWED6QH2AAAA5AAAACRobXR4AfQAAAAAAYgAAAAGbG9jYQAAAAAAAAHEAAAABm1heHAAAwACAAABCAAAACBuYW1lGZ8ZNAAAAdAAAABycG9zdG1nc80AAAJEAAAALAABAAAAAQAApyfBol8PPPUAAwPoAAAAAOcYLA8AAAAA5xgsDwAAAAAAAAAAAAAAAwACAAAAAAAAAAEAAAPoAAAAAAH0AAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAEAAAACAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAwH0AZAABQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAPz8/PwAAACAAIAPoAAAAAAPoAAAAAAAAAAAAAAAAAAAAAAAgAAAB9AAAAAAAAAAAAAIAAAADAAAAFAADAAEAAAAUAAQAIAAAAAQABAABAAAAIP//AAAAIP///+EAAQAAAAAAAAAAAAAAAAAAAAAAAAAEADYAAQAAAAAAAQANAAAAAQAAAAAAAgAHAA0AAwABBAkAAQAaABQAAwABBAkAAgAOAC5HbHlwaExlc3NGb250UmVndWxhcgBHAGwAeQBwAGgATABlAHMAcwBGAG8AbgB0AFIAZQBnAHUAbABhAHIAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAECBWJsYW5r';
function wordPdfUnseen(pdf) {
  let ref = null;
  const make = () => {
    const ctx = pdf.context, S = PDFLib.PDFString.of, ttf = Uint8Array.from(atob(WP_BLANK), c => c.charCodeAt(0));
    const map = new Uint8Array(131072); for (let i = 1; i < map.length; i += 2) map[i] = 1;   // every letter is the blank glyph
    const cmap = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n1 beginbfrange\n<0000> <FFFF> <0000>\nendbfrange\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n';
    const desc = ctx.register(ctx.obj({ Type: 'FontDescriptor', FontName: 'GlyphLessFont', Flags: 5, FontBBox: [0, 0, 500, 1000], ItalicAngle: 0, Ascent: 1000, Descent: -1, CapHeight: 1000, StemV: 80, FontFile2: ctx.register(ctx.flateStream(ttf, { Length1: ttf.length })) }));
    const cid = ctx.register(ctx.obj({ Type: 'Font', Subtype: 'CIDFontType2', BaseFont: 'GlyphLessFont', CIDSystemInfo: { Registry: S('Adobe'), Ordering: S('Identity'), Supplement: 0 }, FontDescriptor: desc, DW: 500, CIDToGIDMap: ctx.register(ctx.flateStream(map)) }));
    return ctx.register(ctx.obj({ Type: 'Font', Subtype: 'Type0', BaseFont: 'GlyphLessFont', Encoding: 'Identity-H', DescendantFonts: [cid], ToUnicode: ctx.register(ctx.flateStream(cmap)) }));
  };
  // what writes s from x, y, as wide as w (in points); the caller says the writing is unseen
  return (pg, keys, s, size, x, y, w) => {
    ref ||= make();
    if (!keys.has('unseen')) keys.set('unseen', pg.node.newFontDictionary('GlyphLess', ref));
    let hex = ''; for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0');
    return [PDFLib.setFontAndSize(keys.get('unseen'), size), PDFLib.setWordSpacing(0), PDFLib.setTextMatrix(Math.max(.01, w / (s.length * size / 2)), 0, 0, 1, x, y), PDFLib.showText(PDFLib.PDFHexString.of(hex.toUpperCase()))];
  };
}
async function wordPdfWrite(f, { box, P, cuts }) {
  const pdf = await PDFLib.PDFDocument.create(), SF = PDFLib.StandardFonts, rgb = c => PDFLib.rgb(c.r, c.g, c.b);
  pdf.setTitle(f.name.replace(WORD_RX, ''));   // no Creator: 'Grading Studio' there means a flattened export (imported.js)
  const fonts = {}, fontOf = async L => { const k = (L.bold ? 'b' : '') + (L.ital ? 'i' : ''); return fonts[k] ||= { font: await pdf.embedFont(L.bold ? (L.ital ? SF.HelveticaBoldOblique : SF.HelveticaBold) : L.ital ? SF.HelveticaOblique : SF.Helvetica), wd: new Map() }; };
  for (const q of P.words) q.F = await fontOf(q.L);
  const can = new Set((await fontOf({})).font.getCharacterSet());
  // how wide the built-in font writes this, letter by letter (it doesn't tuck letters together, and neither did the page)
  const wide = (F, s, size) => { let n = 0; for (const ch of s) { let v = F.wd.get(ch); if (v == null) F.wd.set(ch, v = F.font.widthOfTextAtSize(ch, 1000)); n += v; } return n * size / 1000; };
  const pics = new Map(), unseen = wordPdfUnseen(pdf), TR = PDFLib.setTextRenderingMode, TM = PDFLib.TextRenderingMode;
  for (const im of P.imgs) {
    try {
      const el = im.el, k = Math.min(1, 2400 / Math.max(el.naturalWidth, el.naturalHeight, 1), 2.5 * im.w / Math.max(el.naturalWidth, 1)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(el.naturalWidth * k)); c.height = Math.max(1, Math.round(el.naturalHeight * k));
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(el, 0, 0, c.width, c.height);
      pics.set(im, await pdf.embedJpg(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86))).arrayBuffer()));
      c.width = c.height = 0;
    } catch (e) { console.error(e); }
  }
  // a word the font can't write, drawn by the browser
  const wordPic = async q => {
    const K = 3, pad = 2, c = document.createElement('canvas'); c.width = Math.ceil((q.w + pad * 2) * K); c.height = Math.ceil((q.h + pad * 2) * K);
    const x = c.getContext('2d'); x.scale(K, K); x.font = q.L.font; x.fillStyle = 'rgb(' + [q.L.c.r, q.L.c.g, q.L.c.b].map(v => Math.round(v * 255)).join(',') + ')'; x.textBaseline = 'alphabetic';
    x.fillText(q.s, pad, pad + (q.base - q.y));
    const png = await pdf.embedPng(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer()); c.width = c.height = 0;
    return { png, pad };
  };
  for (let k = 0; k + 1 < cuts.length; k++) {
    const y0 = cuts[k], y1 = cuts[k + 1], pg = pdf.addPage([box.W, box.H]), X = x => x / WP_PX, Y = y => box.H - box.t - (y - y0) / WP_PX, inY = (a, b) => b > y0 && a < y1;
    pg.pushOperators(PDFLib.pushGraphicsState(), PDFLib.rectangle(0, Y(y1), box.W, (y1 - y0) / WP_PX), PDFLib.clip(), PDFLib.endPath());
    for (const q of P.fills) if (inY(q.y, q.y + q.h)) pg.drawRectangle({ x: X(q.x), y: Y(q.y + q.h), width: q.w / WP_PX, height: q.h / WP_PX, color: rgb(q.c), opacity: q.c.a });
    for (const im of P.imgs) if (pics.get(im) && inY(im.y, im.y + im.h)) pg.drawImage(pics.get(im), { x: X(im.x), y: Y(im.y + im.h), width: im.w / WP_PX, height: im.h / WP_PX });
    for (const q of P.lines) if (inY(Math.min(q.y1, q.y2) - 1, Math.max(q.y1, q.y2) + 1)) pg.drawLine({ start: { x: X(q.x1), y: Y(q.y1) }, end: { x: X(q.x2), y: Y(q.y2) }, thickness: q.wd / WP_PX, color: rgb(q.c), opacity: q.c.a });
    for (const q of P.checks) if (inY(q.y, q.y + q.h)) {
      const s = Math.min(q.w, q.h) * .7 / WP_PX, x = X(q.x + q.w / 2) - s / 2, y = Y(q.y + q.h / 2) - s / 2, ink = PDFLib.rgb(.08, .1, .13);
      pg.drawRectangle({ x, y, width: s, height: s, borderColor: ink, borderWidth: .8 });
      if (q.on) { pg.drawLine({ start: { x, y }, end: { x: x + s, y: y + s }, thickness: .8, color: ink }); pg.drawLine({ start: { x, y: y + s }, end: { x: x + s, y }, thickness: .8, color: ink }); }
    }
    const mine = P.words.filter(q => q.y + q.h / 2 >= y0 && q.y + q.h / 2 < y1), keys = new Map(), ops = [PDFLib.beginText()], after = [];
    for (const [i, q] of mine.entries()) {
      const size = q.L.size / WP_PX, x = X(q.x), y = Y(q.base);
      // as far as the next word on its line, so words that sit together read together
      const nx = mine[i + 1], joined = !q.mark && nx && !nx.mark && Math.abs(nx.base - q.base) < 1 && nx.x > q.x + q.w - 1 && nx.x - (q.x + q.w) < q.L.size * 1.2 && nx.L.size === q.L.size;
      const to = joined ? nx.x : q.x + q.w;
      if (q.L.under) after.push({ x1: q.x, x2: to, y: q.base + q.L.size * .12, wd: Math.max(.6, q.L.size / 16), c: q.L.c });
      if (q.L.strike) after.push({ x1: q.x, x2: to, y: q.base - q.L.size * .3, wd: Math.max(.6, q.L.size / 16), c: q.L.c });
      if (![...q.s].every(ch => can.has(ch.codePointAt(0)))) {
        const pic = await wordPic(q); pg.drawImage(pic.png, { x: X(q.x - pic.pad), y: Y(q.y + q.h + pic.pad), width: (q.w + pic.pad * 2) / WP_PX, height: (q.h + pic.pad * 2) / WP_PX });
        ops.push(TR(TM.Invisible), ...unseen(pg, keys, joined ? q.s + ' ' : q.s, size, x, y, (to - q.x) / WP_PX), TR(TM.Fill));
        continue;
      }
      const F = q.F, has = wide(F, q.s, size); if (!(has > 0)) continue;
      if (!keys.has(F)) keys.set(F, pg.node.newFontDictionary(F.font.name, F.font.ref));
      const sx = q.mark ? 1 : (q.w / WP_PX) / has;
      ops.push(PDFLib.setFillingColor(rgb(q.L.c)), PDFLib.setFontAndSize(keys.get(F), size), PDFLib.setWordSpacing(joined ? (nx.x - q.x) / WP_PX / sx - wide(F, q.s + ' ', size) : 0), PDFLib.setTextMatrix(sx, 0, 0, 1, x, y), PDFLib.showText(F.font.encodeText(joined ? q.s + ' ' : q.s)));
    }
    ops.push(PDFLib.endText());
    pg.pushOperators(...ops);
    for (const u of after) pg.drawLine({ start: { x: X(u.x1), y: Y(u.y) }, end: { x: X(u.x2), y: Y(u.y) }, thickness: u.wd / WP_PX, color: rgb(u.c) });
    pg.pushOperators(PDFLib.popGraphicsState());
  }
  return await pdf.save();
}
// If writing it fails for a file, pictures of the pages instead, with the words laid over them unseen.
async function wordPdfPictures(f, { box, Wpx, host, page, P, cuts }) {
  const pdf = await PDFLib.PDFDocument.create(), font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica), can = new Set(font.getCharacterSet()), unseen = wordPdfUnseen(pdf);
  pdf.setTitle(f.name.replace(WORD_RX, ''));
  const skip = el => el.parentNode === document.body && el !== host && !/^(STYLE|LINK)$/.test(el.tagName);   // only this page is copied to be drawn
  for (let k = 0; k + 1 < cuts.length; k++) {
    const y0 = cuts[k], y1 = cuts[k + 1], hpx = Math.max(1, Math.ceil(y1 - y0));
    const c = await html2canvas(page, { scale: 1.5, backgroundColor: '#ffffff', logging: false, useCORS: true, x: 0, y: y0, width: Wpx, height: hpx, ignoreElements: skip });
    const jpg = await pdf.embedJpg(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82))).arrayBuffer());
    c.width = c.height = 0;
    const pg = pdf.addPage([box.W, box.H]);
    pg.drawImage(jpg, { x: 0, y: box.H - box.t - hpx / WP_PX, width: box.W, height: hpx / WP_PX });
    const key = pg.node.newFontDictionary(font.name, font.ref), keys = new Map(), ops = [PDFLib.beginText(), PDFLib.setTextRenderingMode(PDFLib.TextRenderingMode.Invisible)];
    for (const q of P.words) {
      if (q.mark || q.y + q.h / 2 < y0 || q.y + q.h / 2 >= y1) continue;
      const size = q.L.size / WP_PX;
      if (![...q.s].every(ch => can.has(ch.codePointAt(0)))) { ops.push(...unseen(pg, keys, q.s, size, q.x / WP_PX, box.H - box.t - (q.base - y0) / WP_PX, q.w / WP_PX)); continue; }
      const has = font.widthOfTextAtSize(q.s, size); if (!(has > 0)) continue;
      ops.push(PDFLib.setFontAndSize(key, size), PDFLib.setTextMatrix((q.w / WP_PX) / has, 0, 0, 1, q.x / WP_PX, box.H - box.t - (q.base - y0) / WP_PX), PDFLib.showText(font.encodeText(q.s)));
    }
    ops.push(PDFLib.endText());
    pg.pushOperators(...ops);
  }
  return await pdf.save();
}
// One Word file becomes its PDF, in the Word file's place. Returns what undoing needs, or null when it couldn't be drawn.
async function wordToPdf(st, f) {
  await Promise.all([...wordSaves].map(s => s()));   // what she typed a moment ago is in the file first
  const L = st.layout && JSON.parse(JSON.stringify(st.layout)), o = st.forder && st.forder.slice(), word = f.path;
  const bytes = await wordPagesPdf(f);
  const nf = await replaceFile(st, word, new File([bytes], f.name.replace(WORD_RX, '') + '.pdf', { type: 'application/pdf' }), true);
  return nf ? { st, word, pdf: nf.path, L, o } : null;
}
// Undo: the Word file comes back where it was, and the PDF made from it is thrown away (it has no marks of hers worth keeping this soon).
async function wordPdfBack(done) {
  if (!batch) return;
  const b = batch, drop = [];
  for (const { st, word, pdf, L, o } of done) {
    if (!batch.students.includes(st)) continue;
    const nf = fileByPath(st, pdf), g = (st.gone || []).find(x => x.path === word);
    if (!g) continue;
    if (nf) {
      st.files.splice(st.files.indexOf(nf), 1);
      if (st.inc) delete st.inc[pdf];
      drop.push((nf.akey || st.key) + '|' + pdf);
      noteGone(batch, (nf.akey || st.key) + '|' + pdf);
    }
    st.gone.splice(st.gone.indexOf(g), 1); st.files.push(g);
    st.layout = L; st.forder = o;
    if (batch.removed && batch.removed[word]) batch.removed[word] = { back: Date.now() };
    refound(st);
  }
  wordScoresAll(); saveNow(); renderList(); openStudent(cur);
  toast(done.length === 1 ? 'Back to the Word file' : 'Back to the Word files');
  for (const k of drop) { try { await idbDo('readwrite', os => os.delete(b.id + '|' + k)); } catch {} }
}
let wordPdfBusy = false;
// Converts these, one after another, saying how far it is. She can keep working meanwhile; the paper on screen is drawn again at the end.
async function wordPdfRun(list, quietIfNone) {
  if (wordPdfBusy || !batch) return;
  const b = batch, done = []; let bad = 0, long = 0;
  if (!list.length) { if (!quietIfNone) toast('No Word papers to convert'); return; }
  wordPdfBusy = true;
  try {
    for (const [i, { st, f }] of list.entries()) {
      if (batch !== b) break;
      if (!st.files.includes(f)) continue;
      toast(list.length === 1 ? 'Making PDF pages…' : 'Making PDF pages… ' + (i + 1) + ' of ' + list.length, 600000);
      try { const d = await wordToPdf(st, f); if (d) done.push(d); else bad++; }
      catch (e) { if (/too long/.test(String(e && e.message))) long++; else { console.error(e); bad++; } }
    }
  } finally { wordPdfBusy = false; }
  if (batch !== b) return;
  const cst = batch.students[cur], here = done.find(d => d.st === cst);
  openStudent(cur, here ? here.pdf : undefined);
  const not = [long ? long + (long === 1 ? ' is' : ' are') + ' longer than ' + WP_MAX + ' pages' : '', bad ? bad + ' couldn’t be drawn' : ''].filter(Boolean).join(' and ');
  const said = (done.length === 1 ? 'This Word paper is now PDF pages' : done.length + ' Word papers are now PDF pages') + (not ? '. ' + not + ', so ' + (long + bad === 1 ? 'it stays a Word file' : 'they stay Word files') : '');
  if (done.length) toastDo(said, 'Undo', () => wordPdfBack(done));
  else toast(not ? not[0].toUpperCase() + not.slice(1) + ', so ' + (long + bad === 1 ? 'it stays a Word file' : 'they stay Word files') : 'Nothing to convert', 6000);
  return done;
}
// As an assignment opens, when she's chosen that in Settings.
function wordPdfAuto() {
  if (!batch || !wordPdfAlways() || wordPdfBusy) return;
  return wordPdfRun(wordPdfList().filter(wordPdfFree), true);
}
// The Convert to PDF button on a Word paper.
function openWordPdf(st, f) {
  if (wordPdfBusy) return toast('Still making PDF pages…');
  const all = wordPdfList(), free = all.filter(wordPdfFree), others = free.filter(x => x.f !== f).length, kept = all.length - free.length - (wordPdfFree({ st, f }) ? 0 : 1);
  const used = wordReadUsed(st, f);
  openDlg('<div class="bh"><h2>Convert to PDF pages</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb"><p style="margin:0 0 10px">The Word file becomes pages you can mark, comment on and stamp anywhere, like any PDF. The Word file isn’t changed. It waits under Removed files at the bottom of the paper, with Bring back.</p>' +
    (f.edited ? '<p class="muted" style="margin:0 0 10px;font-size:13.5px">What you typed or shaded in this file shows on the pages. Comments are numbered, and listed after the last page.</p>' : '') +
    (used ? '<p class="sc-warn" style="margin:0 0 10px">You took this student’s grade from what’s typed in this Word file. That stays with the Word file, so give the score in the score panel after converting.</p>' : '') +
    (others ? '<div class="wpwhich" role="radiogroup" aria-label="Which papers" style="display:grid;gap:6px;margin:0 0 12px"><label><input type="radio" name="wpWhich" value="one" checked> Just this file</label>' +
      '<label><input type="radio" name="wpWhich" value="all"> All ' + (others + 1) + ' Word papers in this assignment' + (kept > 0 ? ' <span class="muted" style="font-size:13px">(' + kept + ' you’ve typed in, commented on or scored from ' + (kept === 1 ? 'stays a Word file' : 'stay Word files') + ')</span>' : '') + '</label></div>' : '') +
    '<label style="display:flex;gap:8px;align-items:baseline"><input type="checkbox" id="wpAlways"' + (wordPdfAlways() ? ' checked' : '') + '> <span>From now on, convert Word papers as each assignment opens <span class="muted" style="font-size:13px">(you can change this in Settings)</span></span></label></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Convert</button></div>', true);
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (!e.target.closest('[data-ok]')) return;
    const which = ($('#dlgBox input[name="wpWhich"]:checked') || {}).value || 'one';
    wordPdfSet($('#wpAlways').checked);
    closeDlg();
    wordPdfRun(which === 'all' ? [{ st, f }].concat(free.filter(x => x.f !== f)) : [{ st, f }]);
  };
}
// The setting, here and on the Settings page.
function wordPdfSet(on) {
  if (on !== wordPdfAlways()) { if (on) store.set('gs.wordPdf', true); else store.del('gs.wordPdf'); }
  wordPdfShow();
}
function wordPdfShow() { for (const b of document.querySelectorAll('#setWordPdf button')) b.setAttribute('aria-pressed', String((b.dataset.v === '1') === wordPdfAlways())); }
$('#setWordPdf').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) wordPdfSet(b.dataset.v === '1'); });
wordPdfShow();
Object.assign(window.__gs, { wordPagesPdf, wordToPdf, wordPdfRun, wordPdfAuto, wordPdfList, wordCanPdf });
