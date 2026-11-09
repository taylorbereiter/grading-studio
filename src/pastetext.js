/* ---------------- text a student sent in a message, pasted in as a page ---------------- */
// For the odd time a student emails part or all of an assignment as typed text. The text becomes a PDF added to that student
// like any added file (addFiles), so marking, scores, export, Remove / Replace, saving and syncing all work as they do for a file.
// Text the PDF's built-in font can write becomes real text, so highlights snap to words and Share with Claude can cover names.
// Anything else (Thai, Russian, emoji…) is drawn by the browser into a picture of each page instead, so marks still work.
const PT_W = 595.28, PT_H = 841.89, PT_M = 64, PT_SIZE = 12, PT_LINE = 18;
function pasteClean(s) {
  return String(s || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/[   ]/g, ' ').replace(/[​-‍⁠﻿­]/g, '').replace(/[ \t]+$/gm, '').replace(/^\n+|\s+$/g, '');
}
const pasteName = s => (String(s || '').replace(/[\\/:*?"<>|\u0000-\u001F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Emailed work');
// Lines that fit a width. measure(text) gives a width; words longer than a line are broken by letters.
function pasteWrap(text, width, measure, words) {
  const out = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    let line = '';
    for (const w of words(para)) {
      if (measure(line + w) <= width) { line += w; continue; }
      if (line.trim()) { out.push(line.replace(/\s+$/, '')); line = ''; }
      let piece = w.replace(/^\s+/, '');
      while (measure(piece) > width) {
        let k = 1; while (k < piece.length && measure(piece.slice(0, k + 1)) <= width) k++;
        out.push(piece.slice(0, k)); piece = piece.slice(k);
      }
      line = piece;
    }
    out.push(line.replace(/\s+$/, ''));
  }
  return out;
}
const spaceWords = para => para.match(/\s*\S+/g) || [];
const segWords = para => {   // languages written without spaces (Thai) break between words, where the browser knows how
  try { return [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(para)].map(s => s.segment); } catch { return para.match(/\s*\S+/g) || []; }
};
// Which lines go on which page: the first page starts below the title.
function pastePages(lines, firstTop) {
  const pages = [[]]; let y = firstTop;
  for (const l of lines) {
    if (y - PT_LINE < PT_M) { pages.push([]); y = PT_H - PT_M; }
    pages[pages.length - 1].push(l); y -= PT_LINE;
  }
  return pages;
}
async function pasteTextPdf(title, text, when) {
  text = pasteClean(text); title = pasteName(title);
  const doc = await PDFLib.PDFDocument.create();
  doc.setTitle(title);   // no Creator: 'Grading Studio' there means a flattened export (imported.js)
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica), bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const sub = 'Pasted from a message on ' + new Date(when || Date.now()).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const can = new Set(font.getCharacterSet()), typed = [...(title + sub + text)].every(ch => ch === '\n' || can.has(ch.codePointAt(0)));
  const width = PT_W - 2 * PT_M, gray = PDFLib.rgb(0.45, 0.45, 0.45), ink = PDFLib.rgb(0.1, 0.1, 0.12);
  if (typed) {
    const lines = pasteWrap(text, width, s => font.widthOfTextAtSize(s, PT_SIZE), spaceWords);
    const titleLines = pasteWrap(title, width, s => bold.widthOfTextAtSize(s, 16), spaceWords);
    let top = PT_H - PT_M - 16 - (titleLines.length - 1) * 21 - 44;
    pastePages(lines, top).forEach((pl, i) => {
      const page = doc.addPage([PT_W, PT_H]);
      let y = PT_H - PT_M - PT_SIZE;
      if (i === 0) {
        y = PT_H - PT_M - 16;
        for (const t of titleLines) { page.drawText(t, { x: PT_M, y, size: 16, font: bold, color: ink }); y -= 21; }
        y += 21 - 16; page.drawText(sub, { x: PT_M, y, size: 9.5, font, color: gray }); y = top;
      }
      for (const l of pl) { if (l) page.drawText(l, { x: PT_M, y, size: PT_SIZE, font, color: ink }); y -= PT_LINE; }
    });
    return { bytes: await doc.save(), typed: true };
  }
  // Pictures of the pages, drawn twice the size for sharp marking
  try { await Promise.all([document.fonts.load('400 24px Inter', text), document.fonts.load('700 32px Inter', title)]); } catch {}
  const S = 2, c = document.createElement('canvas'); c.width = Math.round(PT_W * S); c.height = Math.round(PT_H * S);
  const g = c.getContext('2d'), face = '"Inter", system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Thai", Tahoma, sans-serif';
  const setFont = (px, w) => { g.font = (w || 400) + ' ' + (px * S) + 'px ' + face; };
  setFont(PT_SIZE); const lines = pasteWrap(text, width * S, s => g.measureText(s).width, segWords);
  setFont(16, 700); const titleLines = pasteWrap(title, width * S, s => g.measureText(s).width, segWords);
  const top = PT_H - PT_M - 16 - (titleLines.length - 1) * 21 - 44;
  for (const [i, pl] of pastePages(lines, top).entries()) {
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.textBaseline = 'alphabetic';
    let y = PT_M + PT_SIZE;
    if (i === 0) {
      y = PT_M + 16; g.fillStyle = '#1a1a1f'; setFont(16, 700);
      for (const t of titleLines) { g.fillText(t, PT_M * S, y * S); y += 21; }
      y += 16 - 21; g.fillStyle = '#737373'; setFont(9.5); g.fillText(sub, PT_M * S, y * S); y = PT_H - top;
    }
    g.fillStyle = '#1a1a1f'; setFont(PT_SIZE);
    for (const l of pl) { if (l) g.fillText(l, PT_M * S, y * S); y += PT_LINE; }
    const png = await new Promise(r => c.toBlob(r, 'image/png'));
    const img = await doc.embedPng(new Uint8Array(await png.arrayBuffer()));
    doc.addPage([PT_W, PT_H]).drawImage(img, { x: 0, y: 0, width: PT_W, height: PT_H });
  }
  return { bytes: await doc.save(), typed: false };
}
async function pasteTextAdd(st, title, text) {
  if (!pasteClean(text)) return null;
  const name = pasteName(title) + '.pdf', { bytes, typed } = await pasteTextPdf(title, text);
  await addFiles(st, [{ path: name, file: new File([bytes], name, { type: 'application/pdf' }) }]);
  return { name, typed };
}
function openPasteText(st) {
  if (!st) return;
  const who = shownName(st, batch.students.indexOf(st));
  openDlg('<div class="bh"><h2>Paste text for ' + esc(who) + '</h2><button class="icon" data-cancel aria-label="Close" style="margin-left:auto">✕</button></div>' +
    '<div class="bb"><p class="muted" style="margin:0 0 10px;font-size:14px">For work a student sent in an email or a message. It becomes a page you can mark, score and export like any paper, added after their other files. It stays in this browser.</p>' +
    '<label class="muted" for="ptName" style="font-size:13px">Name it</label><input class="btn" id="ptName" value="Emailed work" autocomplete="off" style="width:100%;margin:4px 0 10px;text-align:left">' +
    '<textarea id="ptText" placeholder="Paste what they sent here" style="width:100%;box-sizing:border-box;height:220px;resize:vertical;font:inherit;font-size:14px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--fg)"></textarea>' +
    '<p class="muted" id="ptCount" style="margin:6px 0 0;font-size:13px"></p></div>' +
    '<div class="bf"><button class="btn" data-cancel>Cancel</button><button class="btn primary" id="ptAdd" disabled>Add to ' + esc(who) + '</button></div>');
  const ta = $('#ptText'), add = $('#ptAdd');
  const count = () => {
    const t = pasteClean(ta.value), w = (t.match(/\S+/g) || []).length;
    add.disabled = !t;
    $('#ptCount').textContent = !t ? '' : w + (w === 1 ? ' word' : ' words') + ([...t].some(ch => ch.codePointAt(0) > 0x24F && !/[ -⁯€™]/.test(ch)) ? '. Some letters can’t be typed into the page, so it comes in as a picture of the text. Pen, highlighter and comments still work.' : '');
  };
  ta.oninput = count;
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-cancel]')) return closeDlg();
    if (e.target !== add || add.disabled) return;
    add.disabled = true; add.textContent = 'Adding…';
    const title = $('#ptName').value, text = ta.value;
    closeDlg();
    try { await pasteTextAdd(st, title, text); } catch (err) { toast('That text couldn’t be added: ' + ((err && err.message) || err)); }
  };
  ta.focus();
}
Object.assign(window.__gs, { pasteTextPdf, pasteTextAdd, openPasteText, pasteWrap, pasteClean });
