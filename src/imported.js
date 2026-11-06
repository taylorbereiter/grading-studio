/* ---------------- marks from other apps: Kami, Acrobat or Preview marks made into her own ---------------- */
// A PDF can come in already marked: pen, highlights, typed text and comments saved in the file as annotations.
// They show on the page, and comments sit read-only in the margin. "Make them editable" turns each one into the
// mark here that matches it, so she can move, change or erase it like anything she drew.
//   f.imp[page]  the ids ('12R') of the annotations that became her marks; each of those marks carries m.imp = that id
//   f.impNo      she said Not now, or put them back: don't offer again for this file
// The annotations that became marks are left out of the copy of the file that's drawn (viewBytes), so nothing shows
// twice. f.data, her original file, is never changed, and Put back brings them back exactly as they were.
const IMP_ID = /^\d+R\d*$/;
const IMP_LINES = new Set(['Ink', 'Line', 'PolyLine', 'Polygon', 'Underline', 'StrikeOut', 'Squiggly']);
function impHas(f) { return !!(f && f.imp && Object.values(f.imp).some(a => a.length)); }
function impVisible(a) { return !IMP_SKIP.has(a.subtype) && !(a.annotationFlags & 2) && !(a.annotationFlags & 32); }
const IMP_SKIP = new Set(['Link', 'Popup', 'Widget']);
// What kind of mark an annotation becomes, or null when it stays on the page as it is (a stamp, a picture, an attached file).
function impKind(a) {
  if (!IMP_ID.test(String(a.id || ''))) return null;
  if (IMP_LINES.has(a.subtype)) return 'pen';
  if (a.subtype === 'Highlight') return 'hl';
  if (a.subtype === 'Square' || a.subtype === 'Circle') return 'oval';
  if (a.subtype === 'FreeText') return commentText(a) ? 'text' : null;
  if (a.subtype === 'Text') return commentText(a) ? 'note' : null;
  return null;
}
// The bytes to draw a file from: the original, less the annotations that are her marks now.
async function viewBytes(f) {
  if (!impHas(f) || f.kind !== 'pdf') return f.data;
  const key = JSON.stringify(f.imp);
  if (f.view && f.viewOf === f.data && f.viewKey === key) return f.view;
  try { f.view = await impStrip(f.data, f.imp); } catch (e) { console.error(e); return f.data; }
  f.viewOf = f.data; f.viewKey = key;
  return f.view;
}
function impRefId(r) { return r instanceof PDFLib.PDFRef ? r.objectNumber + 'R' + (r.generationNumber ? r.generationNumber : '') : ''; }
async function impStrip(data, imp) {
  const doc = await PDFLib.PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
  const list = doc.getPages();
  for (const [p, ids] of Object.entries(imp)) {
    const page = list[+p]; if (!page || !ids.length) continue;
    const arr = page.node.lookupMaybe(PDFLib.PDFName.of('Annots'), PDFLib.PDFArray); if (!arr) continue;
    const gone = new Set(ids), keep = [];
    for (let i = 0; i < arr.size(); i++) {
      const r = arr.get(i);
      if (gone.has(impRefId(r))) continue;
      // a comment's pop-up goes with it
      const d = doc.context.lookup(r);
      if (d instanceof PDFLib.PDFDict && gone.has(impRefId(d.get(PDFLib.PDFName.of('Parent'))))) continue;
      keep.push(r);
    }
    page.node.set(PDFLib.PDFName.of('Annots'), doc.context.obj(keep));
  }
  return doc.save();
}
function impHex(c, dflt) { return c && c.length >= 3 ? '#' + [0, 1, 2].map(i => Math.round(c[i]).toString(16).padStart(2, '0')).join('') : dflt; }
// One annotation as her marks, in the page's points as she sees it (turned and straightened).
// line: a Line annotation's own [x1, y1, x2, y2], which pdf.js gives back sorted, so its direction would be lost.
function impMarks(a, vp, xf, line) {
  const P = (x, y) => {
    let [X, Y] = vp.convertToViewportPoint(x, y);
    if (xf) [X, Y] = [xf[0] * X + xf[2] * Y + xf[4], xf[1] * X + xf[3] * Y + xf[5]];
    return [r1(X), r1(Y)];
  };
  const box = pts => { const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), x = Math.min(...xs), y = Math.min(...ys); return { x: r1(x), y: r1(y), w: r1(Math.max(...xs) - x), h: r1(Math.max(...ys) - y) }; };
  const rectBoxOf = rc => box([P(rc[0], rc[1]), P(rc[2], rc[3]), P(rc[0], rc[3]), P(rc[2], rc[1])]);
  const quads = () => (a.quadPoints || []).map(q => box(q.map(o => P(o.x, o.y)))).filter(r => r.w > 0 && r.h > 0);
  const col = impHex(a.color, COLORS.red), w = r1(Math.max(0.6, (a.borderStyle && a.borderStyle.width) || 1)), text = commentText(a);
  const out = [], rb = rectBoxOf(a.rect);
  // a pen mark, shape or highlight can have a comment too: it goes in the margin, pointing at the mark's top right
  const withNote = () => { if (text) out.push({ t: 'note', color: col, ax: r1(Math.min(rb.x + rb.w, vp.width - 2)), ay: r1(rb.y + Math.min(8, rb.h / 2)), text }); };
  switch (a.subtype) {
    case 'Ink':
      for (const L of a.inkLists || []) if (L.length) out.push({ t: 'pen', color: col, w, pts: L.map(o => P(o.x, o.y)) });
      withNote(); break;
    case 'Line': {
      const c = line && line.length === 4 ? line : a.lineCoordinates;
      if (c) out.push({ t: 'pen', color: col, w, pts: [P(c[0], c[1]), P(c[2], c[3])] });
      withNote(); break;
    }
    case 'PolyLine': case 'Polygon': {
      const v = (a.vertices || []).map(o => P(o.x, o.y));
      if (v.length) out.push({ t: 'pen', color: col, w, pts: a.subtype === 'Polygon' ? v.concat([v[0]]) : v });
      withNote(); break;
    }
    case 'Underline': case 'StrikeOut': case 'Squiggly':
      for (const r of quads()) {
        const y = r1(a.subtype === 'StrikeOut' ? r.y + r.h / 2 : r.y + r.h - 0.6), lw = r1(Math.max(1, r.h / 14));
        if (a.subtype !== 'Squiggly') { out.push({ t: 'pen', color: col, w: lw, pts: [[r.x, y], [r1(r.x + r.w), y]] }); continue; }
        const pts = [], step = Math.max(2, r.h / 5);
        for (let x = r.x, k = 0; x <= r.x + r.w; x += step, k++) pts.push([r1(x), r1(y - (k % 2 ? step * 0.6 : 0))]);
        if (pts.length > 1) out.push({ t: 'pen', color: col, w: lw, pts });
      }
      withNote(); break;
    case 'Highlight': {
      const rs = quads(); if (!rs.length) rs.push(rb);
      const hc = impHex(a.color, HL.yellow);
      if (text) {
        const last = rs[rs.length - 1], m = { t: 'note', color: hc, ax: r1(last.x + last.w), ay: r1(last.y + last.h / 2), hl: rectBox(rs), hc, text };
        if (rs.length > 1) m.rects = rs;
        out.push(m);
      } else out.push(setRects({ t: 'hl', color: hc }, rs));
      break;
    }
    case 'Square': case 'Circle':
      out.push({ t: 'oval', color: col, sw: w, x: r1(rb.x + w / 2), y: r1(rb.y + w / 2), w: r1(Math.max(2, rb.w - w)), h: r1(Math.max(2, rb.h - w)) });
      withNote(); break;
    case 'FreeText': {
      const da = a.defaultAppearanceData || {}, size = r1(Math.min(48, Math.max(6, da.fontSize || 12)));
      out.push({ t: 'text', color: impHex(da.fontColor, COLORS.black), x: r1(rb.x + 2), y: r1(rb.y + 2), size, text, bw: r1(Math.max(24, rb.w - 4)) });
      break;
    }
    case 'Text':
      out.push({ t: 'note', color: col, ax: r1(Math.min(rb.x + rb.w / 2, vp.width - 2)), ay: r1(rb.y + rb.h / 2), text });
      break;
  }
  for (const m of out) m.imp = a.id;
  return out;
}
// Reads a file for marks from other apps that aren't hers yet. Nothing changes here.
// { pages: { page: [{ id, kind, marks }] }, n, keep, kinds: { pen, hl, ... }, locked }
async function impRead(f) {
  const res = { pages: {}, n: 0, keep: 0, kinds: {}, locked: false };
  if (f.kind !== 'pdf' || !f.data || f.virtual) return res;
  await workerReady;
  const js = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
  let lib = null;
  try {
    for (let p = 0; p < js.numPages; p++) {
      const page = await js.getPage(p + 1);
      const done = new Set((f.imp && f.imp[p]) || []);
      const annots = (await page.getAnnotations({ intent: 'display' })).filter(a => impVisible(a) && !done.has(a.id));
      if (!annots.length) { page.cleanup(); continue; }
      if (!lib) {
        lib = await PDFLib.PDFDocument.load(f.data, { ignoreEncryption: true, updateMetadata: false });
        // a locked file can't be saved again without its marks, so they stay as they are
        if (lib.isEncrypted) { res.locked = true; }
      }
      const vp = vpRot(f, p, page, 1), xf = skewXf(f, p, vp), list = [];
      for (const a of annots) {
        const kind = res.locked ? null : impKind(a);
        if (!kind) { res.keep++; continue; }
        let line = null;
        if (a.subtype === 'Line') { try { const [num, gen] = a.id.split('R'); const d = lib.context.lookup(PDFLib.PDFRef.of(+num, +(gen || 0))); const L = d && d.lookupMaybe(PDFLib.PDFName.of('L'), PDFLib.PDFArray); if (L) line = L.asArray().map(v => v.asNumber()); } catch {} }
        const marks = impMarks(a, vp, xf, line);
        if (!marks.length) { res.keep++; continue; }
        list.push({ id: a.id, kind, marks });
        res.kinds[kind] = (res.kinds[kind] || 0) + 1; res.n++;
      }
      if (list.length) res.pages[p] = list;
      page.cleanup();
    }
  } finally { js.destroy(); }
  return res;
}
// How many marks a file has that could be made editable, from the reading of the file (scanFile).
function impCount(f) { return (f && !f.impNo && f.scan && f.scan.impN) || 0; }
// Makes a file's marks from other apps her own. Returns how many it changed.
async function impConvert(f, read) {
  const r = read || await impRead(f);
  if (!r.n) return { n: 0, keep: r.keep, locked: r.locked };
  f.imp ||= {};
  for (const [p, list] of Object.entries(r.pages)) {
    const marks = (f.marks[p] ||= []);
    for (const it of list) { marks.push(...it.marks); (f.imp[p] ||= []).push(it.id); }
  }
  delete f.impNo;
  f.impNew = { n: r.n, keep: r.keep };
  impForgetUndo(f);
  return { n: r.n, keep: r.keep };
}
// Takes back every mark that came from another app, and shows the file's own annotations again.
function impPutBack(f) {
  for (const p of Object.keys(f.marks)) f.marks[p] = f.marks[p].filter(m => !m.imp);
  delete f.imp; delete f.view; delete f.viewOf; delete f.viewKey; delete f.impNew;
  f.impNo = 1;
  impForgetUndo(f);
}
// Undo steps from before the change would bring back marks that no longer match what's drawn, so this file's go.
function impForgetUndo(f) {
  undoStack = undoStack.filter(u => u.file !== f); redoStack = redoStack.filter(u => u.file !== f);
  if (selected && selected.page && selected.page.file === f) selected = null;
  renderTools();
}
// After a change: read the file again (the grade in a comment is hers now) and draw it again.
async function impAfter(f) {
  thumbCache.clear(); scanned = false;
  await rescanFile(f);
  gradeMarksChanged(f);
  saveSoon(); renderList();
  const st = batch && batch.students[cur];
  if (st && st.files.includes(f)) await openStudent(cur, f.path);
}
const impPlural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
// The note above the first page of a file on screen.
function impNote(pg) {
  if (pg.inote) { pg.inote.remove(); pg.inote = null; }
  const f = pg.file;
  if (f.virtual || f.kind !== 'pdf') return;
  const lines = [];
  if (f.impNew) {
    lines.push(impPlural(f.impNew.n, 'mark is', 'marks are') + ' now yours to change.<button class="link" data-imp="back">Put back</button>');
    if (f.impNew.keep) lines.push('<span class="muted" style="font-size:12px">' + impPlural(f.impNew.keep, 'mark', 'marks') + ' (like a stamp or a picture) couldn’t be changed and ' + (f.impNew.keep === 1 ? 'stays' : 'stay') + ' on the page as ' + (f.impNew.keep === 1 ? 'it was' : 'they were') + '.</span>');
  } else if (f.gsFlat) {
    lines.push('This file was exported from Grading Studio with its marks drawn into the page, so they can’t be changed here.');
    lines.push('<span class="muted" style="font-size:12px">To change them, open the download you marked them in: your marks are kept there. Files exported with Keep marks editable on come back with their marks.</span>');
  } else {
    const n = impCount(f);
    if (!n) return;
    lines.push('This paper has ' + impPlural(n, 'mark', 'marks') + ' from another app. You can see ' + (n === 1 ? 'it' : 'them') + ' but not change ' + (n === 1 ? 'it' : 'them') + '.<button class="link" data-imp="make">Make ' + (n === 1 ? 'it' : 'them') + ' editable</button><button class="link" data-imp="no">Not now</button>');
    const others = batch.students.flatMap(st => st.files).filter(x => x !== f && impCount(x)).length;
    if (others) lines.push('<span class="muted" style="font-size:12px">' + impPlural(others + 1, 'paper', 'papers') + ' in this download have marks like these.<button class="link" data-imp="all" style="font-size:12px">Make all of them editable</button></span>');
  }
  const el = document.createElement('div'); el.className = 'scnote impnote';
  el.innerHTML = lines.map(t => '<div>' + t + '</div>').join('');
  el.onclick = e => {
    const b = e.target.closest('[data-imp]'); if (!b) return;
    const a = b.dataset.imp;
    if (a === 'all') return openImported();
    if (a === 'no') { f.impNo = 1; saveSoon(); el.remove(); pg.inote = null; return; }
    b.disabled = true;
    (async () => {
      if (a === 'make') {
        const r = await impConvert(f);
        if (!r.n) { f.impNo = 1; toast(r.locked ? 'This file is locked, so its marks stay as they are.' : 'None of these marks could be made editable, so they stay as they are.'); }
      }
      else impPutBack(f);
      await impAfter(f);
    })().catch(err => { console.error(err); toast('That didn’t work on this file. Its marks are as they were.'); b.disabled = false; });
  };
  pg.wrap.before(el); pg.inote = el;
}
// A file exported from here without its marks kept (Keep marks editable off) has them drawn into the page, which nothing can
// lift back out. Exports say Grading Studio as the app that made them; one that unpacked its marks came back with noauto.
async function gsFlatCheck(f, doc) {
  if (f.gsFlat !== undefined) return f.gsFlat;
  f.gsFlat = false;
  if (f.kind !== 'pdf' || f.virtual || f.noauto) return false;
  try { const { info } = await doc.getMetadata(); f.gsFlat = !!info && info.Creator === 'Grading Studio'; } catch {}
  return f.gsFlat;
}
// When she has asked for it, a paper's marks from other apps are made hers as it opens.
async function impAuto(f) {
  if (!store.get('gs.impAuto', false) || f.impNo || f.virtual || f.kind !== 'pdf') return false;
  if (!impCount(f)) return false;
  const r = await impConvert(f);
  if (!r.n) return false;
  thumbCache.clear(); scanned = false;
  await rescanFile(f); saveSoon(); renderList();
  return true;
}
// More → Marks from other apps: what every paper has, and all of it made editable at once.
function openImported() {
  const ROWS = [['pen', 'Pen and lines', 'your pen'], ['note', 'Comments', 'your margin comments'], ['hl', 'Highlights', 'your highlighter'], ['text', 'Typed text on the page', 'your text'], ['oval', 'Circles and boxes', 'your oval']];
  openDlg('<div class="bh"><h2>Marks from other apps</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb imp"><p id="impSum">Looking through the papers…</p><div id="impTbl"></div>' +
    '<label class="chk"><input type="checkbox" id="impAuto"' + (store.get('gs.impAuto', false) ? ' checked' : '') + '> Do this by itself for papers I open from now on</label>' +
    '<p class="mkhint">Your original files aren’t changed, and Put back above each paper undoes it. A grade written in one of these comments still counts.</p></div>' +
    '<div class="bf"><button class="btn" data-close>Cancel</button><button class="btn primary" id="impGo" disabled>Make them editable</button></div>', true);
  const box = $('#dlgBox'), b0 = batch;
  const files = batch.students.flatMap(st => st.files.filter(f => f.kind === 'pdf' && !f.virtual && !f.bad && !f.impNo));
  const reads = new Map();
  let total = 0, keep = 0, stop = false;
  const kinds = {};
  (async () => {
    for (let i = 0; i < files.length; i++) {
      if (stop || batch !== b0) return;
      $('#impSum') && ($('#impSum').textContent = 'Looking through the papers… ' + (i + 1) + ' of ' + files.length);
      let r; try { r = await impRead(files[i]); } catch (e) { console.error(e); continue; }
      if (!r.n) continue;
      reads.set(files[i], r); total += r.n; keep += r.keep;
      for (const [k, v] of Object.entries(r.kinds)) kinds[k] = (kinds[k] || 0) + v;
    }
    if (stop || !$('#impSum')) return;
    $('#impSum').textContent = total ? impPlural(reads.size, 'paper has ', 'papers have ') + impPlural(total, 'mark', 'marks') + ' made in another app.' : 'No paper in this download has marks from another app that could be made editable.';
    $('#impTbl').innerHTML = total ? '<table class="imptbl">' + ROWS.filter(r => kinds[r[0]]).map(r => '<tr><td>' + r[1] + '</td><td>' + kinds[r[0]] + ' → ' + r[2] + '</td></tr>').join('') +
      (keep ? '<tr><td>Stamps, pictures and other marks</td><td>' + keep + ' stay as they are</td></tr>' : '') + '</table>' : '';
    const go = $('#impGo');
    if (total) { go.disabled = false; go.textContent = 'Make ' + impPlural(total, 'mark', 'marks') + ' editable'; }
  })();
  box.onchange = e => { if (e.target.id === 'impAuto') store.set('gs.impAuto', e.target.checked); };
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) { stop = true; return closeDlg(); }
    if (!e.target.closest('#impGo')) return;
    const go = $('#impGo'); go.disabled = true;
    let n = 0, i = 0, bad = 0;
    for (const [f, r] of reads) {
      go.textContent = 'Working… ' + (++i) + ' of ' + reads.size;
      try { n += (await impConvert(f, r)).n; thumbCache.clear(); await rescanFile(f); } catch (err) { console.error(err); bad++; }
    }
    scanned = false; saveSoon(); renderList(); closeDlg();
    toast(impPlural(n, 'mark is', 'marks are') + ' now yours to change' + (bad ? '. ' + impPlural(bad, 'file', 'files') + ' couldn’t be changed.' : '.'));
    if (batch && batch.students[cur]) openStudent(cur);
  };
}
Object.assign(window.__gs, { impRead, impConvert, impPutBack, impMarks, impKind, viewBytes, openImported, impStrip });
