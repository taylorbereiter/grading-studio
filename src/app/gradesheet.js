/* ---------------- grade sheet: find the grade typed on each paper and crop it ---------------- */
// Looks for what Taylor types on a paper, like "9.5 = 88%", "9.5/12 = 88%", "10/12" or "88%".
// Typed comments (Kami text boxes, sticky notes) are checked first, then the page's own text.
const NUM = '(\\d{1,3}(?:[.,]\\d{1,2})?)';
const NOT_MID = '(?<![\\d.,/])';   // not the tail of a longer number or date
const RX_FULL = new RegExp(NOT_MID + NUM + '\\s*(?:(?:\\/|out of|of)\\s*' + NUM + ')?\\s*(?:=|:|→|->|–|—|-|\\(|,)\\s*' + NUM + '\\s*%');
const RX_OUTOF = new RegExp(NOT_MID + NUM + '\\s*(?:\\/|out of)\\s*' + NUM + '(?![\\d/])', 'i');
const RX_PCT_ANY = new RegExp(NUM + '\\s*%');
const RX_OUT = new RegExp(NUM + '\\s*\\/\\s*' + NUM + '(?![\\d/])');
const RX_PCT = new RegExp('^\\s*' + NUM + '\\s*%\\s*$');
const RX_NAMED = new RegExp(NOT_MID + NUM + '(?:\\s+of\\s+' + NUM + ')?(?![\\d/%]|[.,]\\d|[ \\t]*(?:[/%:=]|[-–—][ \\t]*\\d))', 'i');
const num = v => v == null ? null : +String(v).replace(',', '.');
function parseGrade(str, strict) {
  // Each form takes its best match in the text: "Due 10/12" and the like are skipped, and a labelled grade beats one inside a sentence.
  const sure = [], maybe = [], used = [];
  const all = (rx, keep, read) => {
    const out = [];
    for (const m of str.matchAll(new RegExp(rx.source, rx.flags.replace('g', '') + 'g'))) {
      const end = m.index + m[0].length, c = gradeContext(str.slice(0, m.index), str.slice(end), m[0]);
      if (c.no || !keep(m) || used.some(u => m.index < u[1] && end > u[0])) continue;   // the 10/12 inside "10/12 = 91%" isn't another grade
      const g = { ...read(m, c), at: m.index, len: m[0].length, loose: c.loose };
      out.push(g); used.push([m.index, end]);
      if (!c.loose || c.eq || REDONE_BEFORE.test(str.slice(0, m.index))) sure.push(g); else if (!COUNTS_AFTER.test(str.slice(end))) maybe.push(g); else g.counts = true;
    }
    return out;
  };
  const forms = [all(RX_FULL, () => true, (m, c) => ({ rank: 3, score: num(m[1]), outOf: num(m[2]), pct: num(m[3]), eq: c.eq }))];
  if (!strict) forms.push(all(RX_OUTOF, m => num(m[1]) <= num(m[2]) && num(m[2]) <= 200, m => ({ rank: 2, score: num(m[1]), outOf: num(m[2]), pct: null })), all(RX_PCT_ANY, m => num(m[1]) <= 110, m => ({ rank: 1, score: null, outOf: null, pct: num(m[1]) })));
  // A labelled number with no slash or percent ("Revised: 10", "10 points", "Revised: 10 of 12", or "10 of 12" alone). It can be the class ("Grade 10"), so it never stands by itself: she's always asked.
  if (!strict) forms.push(all(RX_NAMED, m => (m[2] == null ? num(m[1]) <= 200 : num(m[1]) <= num(m[2]) && num(m[2]) <= 200) && (labelledNumber(str.slice(0, m.index), str.slice(m.index + m[0].length)) || (m[2] != null && m[0] === str.trim())), m => ({ rank: 0.5, score: num(m[1]), outOf: num(m[2]), pct: null })).map(g => Object.assign(g, { loose: true })));
  // Two grades that differ ("First draft: 8/12. Revised: 10/12", "Grade: 8/12, now 10/12", "Total: 10/12. Grade: 95%"): she has to say. The one offered is the last one on this assignment's total, or else the last one.
  // An unlabelled number out of something else is a part of the grade ("Thesis 3/4. Total 10/12"). A percent agrees with a score if it's that score on the scale or plainly worked out.
  const pctOff = (p, s, of = s.outOf == null ? maxPoints() : s.outOf) => p.score == null && s.score != null && s.pct == null && Math.abs(p.pct - s.score / of * 100) > 1 && Math.abs(p.pct - percentWith(s.score, of, setup.scale)) > 1;
  const differ = (a, b) => (a.score != null && b.score != null && (a.score !== b.score || (a.outOf != null && b.outOf != null && a.outOf !== b.outOf))) || (a.pct != null && b.pct != null && a.pct !== b.pct) || pctOff(a, b) || pctOff(b, a);
  const reads = sure.concat(maybe.filter(g => g.outOf == null || g.outOf === maxPoints() || sure.some(s => s.outOf === g.outOf)));
  if (reads.some(a => reads.some(b => differ(a, b)))) {
    const late = reads.sort((a, b) => b.at - a.at);
    return { ...(late.find(g => g.outOf === maxPoints() || (g.rank === 0.5 && g.outOf == null)) || late[0]), several: true };
  }
  // A labelled grade first, then one that may be a grade, so a count or a part earlier in the comment ("Only 3/12 sources cited. Good rewrite, 10/12") doesn't hide it.
  const any = forms.flat(), best = any.find(g => !g.loose) || any.find(g => reads.includes(g)) || any[0];
  if (best) return best;
  if (strict) return null;
  let m;
  m = /^\s*(\d{1,2}(?:[.,]\d)?)\s*$/.exec(str);   // a text box with only a number, like "9.5"
  if (m) return { rank: 0.5, score: num(m[1]), outOf: null, pct: null, at: m.index, len: m[0].length };
  return null;
}
const annText = (a, lines) => {   // lines: keep its line breaks, for reading a grade
  const sq = t => lines ? String(t || '').replace(/\r\n?/g, '\n').trim() : String(t || '').replace(/\s+/g, ' ').trim();
  const c = sq((a.contentsObj && a.contentsObj.str) || a.contents) || sq(a.richText && a.richText.str), t = sq(Array.isArray(a.textContent) ? a.textContent.join(' ') : '');
  return !t || t === c ? c : !c ? t : c + ' ' + t;
};
const inside = (r, s) => !s || (r[0] < s.x + s.w && r[2] > s.x && r[1] < s.y + s.h && r[3] > s.y);
// Reads one file: Kami (or other) marks already on it, and every grade typed on it, each with a cropped picture.
// Never changes the file itself.
// A Word file drawn as letter-size page pictures (a PDF kept in memory), for boxing its grade like a paper's.
async function wordPdf(f) {
  if (f.wpdfOf === f.data && f.wpdf) return f.wpdf;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:816px;pointer-events:none';
  const page = document.createElement('div'); page.className = 'dpage';
  page.style.cssText = 'max-width:none;width:816px;margin:0;box-shadow:none;overflow:visible;border-radius:0';
  host.appendChild(page); document.body.appendChild(host);
  try {
    try { const w = openWord(f.data); w.pRuns = []; renderWord(w, page); } catch { page.innerHTML = await docxHtml(f.data); }
    await Promise.all([...page.querySelectorAll('img')].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
    const c = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
    const pdf = await PDFLib.PDFDocument.create(), sh = Math.round(c.width * 11 / 8.5);
    for (let y = 0, n = 0; y < c.height && n < 30; y += sh, n++) {
      const s = document.createElement('canvas'); s.width = c.width; s.height = sh;
      const x = s.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, s.width, s.height);
      x.drawImage(c, 0, y, c.width, Math.min(sh, c.height - y), 0, 0, c.width, Math.min(sh, c.height - y));
      const jpg = await pdf.embedJpg(await (await new Promise(r => s.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());
      pdf.addPage([612, 792]).drawImage(jpg, { x: 0, y: 0, width: 612, height: 792 });
      s.width = s.height = 0;
    }
    c.width = c.height = 0;
    f.wpdf = await pdf.save(); f.wpdfOf = f.data;
    return f.wpdf;
  } finally { host.remove(); }
}
// The pages to look at for a grade: the PDF itself, or a Word file drawn as pages.
const paperBytes = async f => f.kind === 'docx' ? wordPdf(f) : viewBytes(f);
async function scanFile(f, spot) {
  const doc = await pdfjsLib.getDocument({ data: (await paperBytes(f)).slice(), isEvalSupported: false }).promise;
  const found = [], kami = {}, seen = [], marksSig = gradeMarks(f).join('\0');
  let impN = 0;
  try {
    if (f.kind !== 'docx') f.numPages = doc.numPages;
    const pick = spot ? [typeof spot.page === 'number' ? Math.min(spot.page, doc.numPages - 1) : spot.page === 'last' ? doc.numPages - 1 : 0] : [...Array(doc.numPages).keys()];
    for (let p = 0; p < doc.numPages; p++) {
      const page = await doc.getPage(p + 1);
      const vp = vpRot(f, p, page, 1);
      const annots = (await page.getAnnotations({ intent: 'display' })).filter(a => !SKIP_TYPES.has(a.subtype) && !(a.annotationFlags & 2) && !(a.annotationFlags & 32));
      // Marks inside her own rubric page came with the template, not from marking this student, so they don't count as marks here.
      if (annots.length && !f.virtual) kami[p] = { notes: annots.filter(isPopupComment).map(a => kamiNote(a, vp)) };
      if (f.kind === 'pdf') impN += annots.filter(impKind).length;
      if (!pick.includes(p)) { page.cleanup(); continue; }
      const area = spot ? { x: spot.x * vp.width, y: spot.y * vp.height, w: spot.w * vp.width, h: spot.h * vp.height } : null;
      const ofMark = t => { const g = parseGrade(t, false); return g && { ...g, mark: true }; };
      const add = (g, rect, from, text, hover) => {
        if (!g) return;
        const r = [Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3])];
        if (!inside(r, area)) return;
        // the same grade at the same place counts once
        if (found.some(o => o.page === p && o.score === g.score && o.pct === g.pct && Math.abs(o.rect[0] - r[0]) < 20 && Math.abs(o.rect[1] - r[1]) < 20)) return;
        found.push({ ...g, boxed: !!spot, page: p, rect: r, from, hover: !!hover, full: text, text: text.length > 140 ? text.slice(0, 140) + '…' : text });
      };
      for (const a of annots) { const t = annText(a); if (t && seen.length < 4) seen.push(t.length > 60 ? t.slice(0, 60) + '…' : t); if (t && !f.virtual) add(parseGrade(annText(a, true), false), vp.convertToViewportRectangle(a.rect), 'note', t, isPopupComment(a)); }
      for (const m of (f.marks || {})[p] || []) {
        if (m.t === 'text') { const L = textLayout(m, vp.width); add(ofMark(m.text), [m.x, m.y, m.x + L.ink, m.y + L.h], 'note', m.text); }
        if (m.t === 'note' && !m.qza) add(ofMark(m.text), [m.ax - 4, m.ay - 4, m.ax + 4, m.ay + 4], 'note', m.text, true);
        if (m.t === 'stamp' && m.k === 'score') { const b = stampBox(m); add(ofMark(m.text), [b.x, b.y, b.x + b.w, b.y + b.h], 'note', m.text); }   // her score sticker
      }
      // text in the page itself (already flattened files): strict "9.5 = 88%" form only, so essay numbers don't count.
      // A student could type this, so it's only offered, unless she boxed this very paper by hand. A rubric page's own printing isn't anyone's grade.
      const tc = await page.getTextContent();
      let str = '';
      const spans = [];
      for (const it of tc.items) {
        if (!it.str) { if (it.hasEOL) str += '\n'; continue; }
        const [, , , d, e, fy] = it.transform;
        spans.push({ a: str.length, b: str.length + it.str.length, r: vp.convertToViewportRectangle([e, fy, e + it.width, fy + (it.height || Math.abs(d))]) });
        str += it.str + (it.hasEOL ? '\n' : '');
      }
      const re = new RegExp(RX_FULL.source, 'g');
      let m;
      while (!f.virtual && (m = re.exec(str))) {
        const g = parseGrade(m[0], true); if (!g) continue;
        const cx = gradeContext(str.slice(0, m.index), str.slice(m.index + m[0].length), m[0]);
        if (cx.no || (cx.loose && !cx.eq && g.outOf == null)) continue;   // "Of 200, 50% agreed" is the essay talking
        g.loose = cx.loose; g.eq = cx.eq; g.theirs = !(spot && spot === f.hand);
        const hit = spans.filter(s => s.b > m.index && s.a < m.index + m[0].length);
        if (!hit.length) continue;
        const xs = hit.flatMap(s => [s.r[0], s.r[2]]), ys = hit.flatMap(s => [s.r[1], s.r[3]]);
        add(g, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], 'text', m[0]);
      }
      page.cleanup();
    }
    // pictures: one per grade found, or just the picked spot when nothing was read there
    const shots = found.length ? found : spot ? [{ page: pick[0], rect: null, none: true }] : [];
    for (const g of shots) {
      const page = await doc.getPage(g.page + 1), vp1 = vpRot(f, g.page, page, 1);
      let x, y, w, h;
      if (spot) { x = spot.x * vp1.width; y = spot.y * vp1.height; w = spot.w * vp1.width; h = spot.h * vp1.height; }
      else {
        const [x1, y1, x2, y2] = g.rect, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
        w = Math.max(x2 - x1 + 60, 240); h = Math.max(y2 - y1 + 36, 72); x = cx - w / 2; y = cy - h / 2;
      }
      x = clamp(x, 0, vp1.width - 20); y = clamp(y, 0, vp1.height - 20);
      w = Math.min(w, vp1.width - x); h = Math.min(h, vp1.height - y);
      const k = 2.5, c = document.createElement('canvas');
      c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.translate(-x * k, -y * k);
      await page.render({ canvasContext: ctx, ...vpDraw(f, g.page, page, k), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
      ctx.setTransform(k, 0, 0, k, -x * k, -y * k);
      const mk = ((f.marks || {})[g.page] || []).filter(m => m.t !== 'note');
      if (mk.length) drawMarks(ctx, mk, vp1.width, vp1.height, 0, null);
      if (g.hover) {   // a comment that only shows on hover: print its words next to the spot so the picture shows them
        ctx.font = '11px ' + FONT;
        const bw = Math.min(220, w - 8), lines = wrapText(ctx, g.full, bw - 12).slice(0, 4), bh = lines.length * 14 + 10;
        const bx = clamp(g.rect[2] + 6, x + 4, x + w - bw - 4), by = clamp(g.rect[1] - 4, y + 4, y + h - bh - 4);
        ctx.fillStyle = '#FFF6D6'; ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = '#C99A00'; ctx.lineWidth = 0.8; ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = '#1B1F27'; lines.forEach((ln, i) => ctx.fillText(ln, bx + 6, by + 15 + i * 14));
      }
      const t = spot && disp.trim && f.kind !== 'docx' ? trimToInk(c, k) : null;   // a loose spot box shrinks to the marks inside it
      g.img = (t || c).toDataURL('image/jpeg', 0.85);
      if (t) t.width = t.height = 0;
      c.width = c.height = 0;
    }
    return { found, shots, kami, seen, marksSig, nAnnots: Object.keys(kami).length, hasText: seen.length > 0, impN };
  } finally { doc.destroy(); }
}
// Finds the marks inside a picked spot: her colored ink first (red pen, highlights), or dark ink when nothing is colored.
// Returns a tighter copy with a little room around them, or null to keep the whole spot.
function trimToInk(c, k) {
  const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
  const box = () => ({ x1: W, y1: H, x2: -1, y2: -1, n: 0 }), col = box(), dark = box();
  const grow = (b, x, y) => { if (x < b.x1) b.x1 = x; if (x > b.x2) b.x2 = x; if (y < b.y1) b.y1 = y; if (y > b.y2) b.y2 = y; b.n++; };
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const i = (y * W + x) * 4, hi = Math.max(d[i], d[i + 1], d[i + 2]), lo = Math.min(d[i], d[i + 1], d[i + 2]);
    if (hi - lo > 70) grow(col, x, y); else if (hi < 140) grow(dark, x, y);
  }
  const b = col.n > 8 ? col : dark.n > 8 ? dark : null;
  if (!b) return null;
  const pad = 12 * k, x1 = Math.max(0, b.x1 - pad), y1 = Math.max(0, b.y1 - pad), x2 = Math.min(W, b.x2 + pad), y2 = Math.min(H, b.y2 + pad);
  if ((x2 - x1) * (y2 - y1) > W * H * 0.8) return null;
  const o = document.createElement('canvas'); o.width = Math.ceil(x2 - x1); o.height = Math.ceil(y2 - y1);
  o.getContext('2d').drawImage(c, x1, y1, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}
function kamiNote(a, vp) {
  const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect);
  const l = Math.min(x1, x2), r = Math.max(x1, x2), t = Math.min(y1, y2), b = Math.max(y1, y2);
  const k = a.color && a.color.length >= 3 ? a.color : [244, 180, 0];
  const hex = '#' + [k[0], k[1], k[2]].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  return { t: 'note', ro: true, color: hex, text: commentText(a), ax: Math.min(a.subtype === 'Text' ? (l + r) / 2 : r, vp.width - 2), ay: a.subtype === 'Text' ? (t + b) / 2 : t + Math.min(8, (b - t) / 2) };
}
const SKIP_TYPES = new Set(['Link', 'Popup', 'Widget']);
const commentText = a => ((a.contentsObj && a.contentsObj.str) || a.contents || '').replace(/\r\n?/g, '\n').trim();
// Hover-only comments (sticky notes, highlight comments) go in the margin; text boxes already show on the page.
const isPopupComment = a => !!commentText(a) && a.subtype !== 'FreeText';

// Scans every file. A student's grade only counts as read when exactly one grade was found across their files.
let scanP = null;
async function scanAll(onStep) {
  while (scanP) await scanP;
  const b0 = batch;
  scanP = scanRun(onStep).finally(() => { scanP = null; });
  await scanP;
  if (b0 !== batch) return;
}
async function scanRun(onStep) {
  if (!batch) return;   // closed while an earlier scan was finishing
  const b0 = batch;
  const spot = setup.spot || null;
  const files = batch.students.flatMap(st => st.files.filter(f => viewable(f)));
  let n = 0;
  for (const st of batch.students) {
    for (const f of st.files.filter(f => viewable(f))) {
      if (batch !== b0) return;
      try { f.scan = await scanFile(f, f.hand || spot); if (f.hand) f.scan.hand = true; }
      catch (e) { console.error(e); f.scan = { found: [], shots: [], kami: {}, err: true }; }
      f.kami = f.scan.kami;
      onStep && onStep(++n, files.length);
    }
    for (const f of st.files.filter(f => f.kind === 'docx' && f.hand)) {
      if (batch !== b0) return;
      try { f.scan = await scanFile(f, f.hand); f.scan.hand = true; } catch (e) { console.error(e); f.scan = { found: [], shots: [], kami: {}, err: true }; }
    }
    wordScoresOf(st); refound(st);
  }
  if (batch !== b0) return;   // she closed it during the last file
  scanned = true;
  if (JSON.stringify(paperReads()) !== JSON.stringify(batch.read)) saveSoon();
  renderList();
  for (const pg of pages) { pg.extra = (pg.file.kami && pg.file.kami[pg.idx] && pg.file.kami[pg.idx].notes) || []; draw(pg); if (pg.impFirst) impNote(pg); }
}
let scanned = false;
function foundLabel(fd) {
  if (!fd) return '';
  return (fd.score != null ? fmtNum(fd.score) + (fd.outOf ? '/' + fmtNum(fd.outOf) : '') : '') + (fd.pct != null ? (fd.score != null ? ' = ' : '') + fmtNum(fd.pct) + '%' : '');
}
// One row per file (and one for each empty folder), in the order of the student list.
let sheetShowOut = false;
// The sheet lists only files with a grade on them (read, boxed or highlighted); "Show files with no grade" lists every file.
let sheetAll = !!store.get('gs.sheetall', false);
const rowGraded = r => r.word ? !!((r.f.wscore && r.f.wscore.total != null) || wordFound(r.f, r.st).length || (r.f.hand && r.f.scan && r.f.scan.shots.length))
  : !!(r.f.scan && (r.f.scan.found.length || r.f.scan.shots.length));
// box: every file to look through for "Box each grade by hand", graded or not.
function sheetRows(box) {
  const rows = [];
  batch.students.forEach((st, i) => {
    const fs = st.files.filter(viewable), words = st.files.filter(f => f.kind === 'docx');
    const inc = fs.filter(f => fileIn(st, f)), out = fs.filter(f => !fileIn(st, f));
    const cand = words.map(f => ({ st, i, f, word: true })).concat(inc.map(f => ({ st, i, f })));
    const shown = box || sheetAll ? cand : cand.filter(rowGraded);
    if (!shown.length && (!out.length || !sheetShowOut)) rows.push({ st, i, f: null, none: !fs.length && !st.files.length, nograde: cand.length > 0, first: cand[0] && cand[0].f });
    rows.push(...shown);
    if (sheetShowOut) for (const f of out) rows.push({ st, i, f, out: true });
  });
  return rows;
}
async function openSheet(rescan) {
  tabNext('grades/sheet');
  openDlg('<div class="bh"><h2>Grade sheet</h2><span class="muted" id="shSub"></span><span class="sp"></span>' + tabSeg('grades', 'sheet', GRADE_VIEWS) + '<button class="icon" data-close aria-label="Close">✕</button></div>' +
    '<div class="bb" id="shBody"><p class="muted">Looking for the grade on each paper…</p><div class="prog"><i></i></div></div>' +
    '<div class="bf"><button class="btn" data-each>Box each grade by hand</button><button class="btn" data-spot>' + (setup.spot ? 'Change the shared spot' : 'Same spot on every paper') + '</button>' + (setup.spot ? '<button class="btn" data-auto>Stop using the shared spot</button>' : '') +
    '<button class="btn" data-cp>Copy all scores</button><button class="btn primary" data-pdf>Download grade sheet (PDF)</button></div>');
  const box = $('#dlgBox');
  box.onclick = async e => {
    if (e.target.closest('[data-close]')) return closeDlg();
    if (e.target.closest('[data-spot]')) return pickSpot();
    if (e.target.closest('[data-each]')) return pickEach();
    const rb = e.target.closest('[data-rebox]'); if (rb) return pickEach(rb.dataset.rebox);
    if (e.target.matches('[data-sheetall]')) { sheetAll = e.target.checked; store.set('gs.sheetall', sheetAll); return renderSheet(); }
    if (e.target.closest('[data-showout]')) { sheetShowOut = !sheetShowOut; return renderSheet(); }
    const io = e.target.closest('[data-bring],[data-leave]');
    if (io) {
      const v = io.dataset.bring || io.dataset.leave, bar = v.indexOf('|'), st = batch.students[+v.slice(0, bar)], path = v.slice(bar + 1);
      for (const d of layoutOf(st)) if (d.pages.some(([q]) => q === path)) setDocIn(st, d, !!io.dataset.bring);
      refound(st);
      renderList(); return renderSheet();
    }
    if (e.target.closest('[data-auto]')) { delete setup.spot; store.set('gs.setup', { ...setup, spot: undefined }); saveSoon(); return openSheet(true); }
    const c = e.target.closest('[data-copy]'); if (c) return copy(c.dataset.copy, c.dataset.copy ? 'Copied ' + c.dataset.copy : 'Nothing to copy');
    const go = e.target.closest('[data-open]'); if (go) { return toPaper(+go.dataset.open, go.dataset.file); }
    const rd = e.target.closest('[data-rd]'); if (rd) { setReading(batch.students[+rd.dataset.rdi], rd.dataset.rdk, rd.dataset.rd); return renderSheet(); }
    if (e.target.closest('[data-cp]') && !await okPartial(batch.students)) return;
    if (e.target.closest('[data-cp]')) return copy(batch.students.map(st => scoreText(gradeOf(st), 'any')).join('\n'), 'Copied ' + batch.students.length + ' scores in ' + listOrder() + ' (blank where unsure)');
    if (e.target.closest('[data-pdf]')) return saveBlob('Grade sheet - ' + batch.name + '.pdf', new Blob([await buildSheetPdf()], { type: 'application/pdf' }));
  };
  box.oninput = e => {
    const t = e.target.closest('[data-typed]'); if (!t) return;
    const st = batch.students[+t.dataset.typed];
    st.grade.sheet = t.value.trim().replace(',', '.'); scoreTouched(st); saveSoon(); renderList(); if (st === batch.students[cur]) renderGrade();
  };
  box.onchange = e => { if (e.target.matches('[data-trim]')) { disp.trim = e.target.checked; store.set('gs.disp', disp); openSheet(true); } };
  const bar = box.querySelector('.prog i');
  await scanAll((n, t) => { if (bar) bar.style.width = (100 * n / t) + '%'; });
  wordScoresAll();
  if ($('#dlg').hidden || !$('#shBody')) return;
  renderSheet();
}
function renderSheet() {
  const rows = sheetRows();
  const nOut = batch.students.reduce((a, st) => a + st.files.filter(f => viewable(f) && !fileIn(st, f)).length, 0);
  const nOne = batch.students.filter(st => st.found).length, nMany = batch.students.filter(manyReads).length, nAsk = batch.students.reduce((a, st) => a + (st.doubts && !manyReads(st) ? st.doubts.length : 0), 0);
  $('#shSub').textContent = (setup.spot ? 'Same spot on every paper · ' : '') + nOne + ' of ' + batch.students.length + ' read' + (nMany ? ' · ' + nMany + ' to check' : '') + (nAsk ? ' · ' + nAsk + ' to confirm' : '');
  const spotted = !!setup.spot || batch.students.some(st => st.files.some(f => f.hand));
  const nHidden = sheetAll ? 0 : batch.students.reduce((a, st) => a + st.files.filter(f => f.kind === 'docx').map(f => ({ f, st, word: true })).concat(st.files.filter(f => viewable(f) && fileIn(st, f)).map(f => ({ f }))).filter(r => !rowGraded(r)).length, 0);
  $('#shBody').innerHTML = '<p class="muted" style="margin:0 0 10px;font-size:14px">Every row is made from the file named on it, inside that student’s folder. Click a picture to open that exact file. Click a score to copy it.</p>' +
    '<label class="chk" style="margin:0 0 10px;font-size:14px"><input type="checkbox" data-sheetall' + (sheetAll ? ' checked' : '') + '> Show files with no grade' + (sheetAll ? '' : nHidden ? ' (' + nHidden + ' hidden)' : '') + '<span class="muted" style="font-weight:400">&nbsp;· the downloaded sheet shows the same rows</span></label>' +
    (spotted ? '<label class="chk" style="margin:0 0 10px;font-size:14px"><input type="checkbox" data-trim' + (disp.trim ? ' checked' : '') + '> Trim each spot down to your marks</label>' : '') +
    (nOut ? '<p style="margin:0 0 10px;font-size:14px;background:var(--warn-soft);padding:8px 10px;border-radius:8px">' + nOut + (nOut === 1 ? ' file has' : ' files have') + ' no marks, so ' + (nOut === 1 ? 'it’s' : 'they’re') + ' left out as extra papers. <button class="link" data-showout>' + (sheetShowOut ? 'Hide them' : 'Show them') + '</button></p>' : '') +
    '<table class="gl"><thead><tr><th>#</th><th>Folder and file</th><th>On the paper</th><th>Read as</th></tr></thead><tbody>' +
    rows.map(({ st, i, f, out, none, word, nograde, first }) => {
      const where = '<div style="font-weight:600">' + esc(st.key) + '</div>' + (f ? '<div class="muted" style="font-size:13px;overflow-wrap:anywhere">' + esc(f.path) + '</div>' : '');
      if (word) {   // her Word rubric: the highlighted boxes, read straight from the file
        const w = f.wscore, tyAll = wordFound(f, st), rdw = splitReads(st, tyAll), ty = rdw.ok, hs = (f.hand && f.scan && f.scan.shots) || [], ri = rows.findIndex(r => r.f === f);
        const info = w ? w.crits.map((c, k) => esc(c.length > 28 ? c.slice(0, 28) + '…' : c) + ' <b>' + (w.per[k] == null ? '–' : fmtNum(w.per[k])) + '</b>').join(' · ') + (w.total != null && !w.done ? '<div class="muted" style="font-size:12px">Not every criterion is highlighted yet</div>' : '') : '';
        const pics = hs.map(g => '<div style="margin-bottom:6px"><img src="' + g.img + '" alt="" data-open="' + i + '" data-file="' + esc(f.path) + '" title="Open this file" style="display:block;max-width:360px;max-height:150px;border:1px solid var(--line);border-radius:4px;cursor:pointer;background:#fff"><div class="muted" style="font-size:12px">Page ' + (g.page + 1) + '</div></div>').join('');
        const big = (v, of, pct) => '<div class="big-sc" data-copy="' + esc(fmtNum(v)) + '" title="Click to copy">' + fmtNum(v) + (of ? '<small>/ ' + fmtNum(of) + '</small>' : '') + '</div>' + (pct != null ? '<div class="muted" style="font-size:13px;margin-top:4px;font-weight:500">= ' + fmtNum(pct) + '%</div>' : '');
        const hf = (f.hand && f.scan && f.scan.found) || [];
        const reads = w && w.total != null && (f.virtual || ty.length) ? big(w.total, w.max, w.pct)
          : ty.length ? (manyReads(st) ? '<span class="pill warn" style="display:inline-block;font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--warn-soft);color:var(--warn);margin-bottom:6px">' + readsCount(st) + ' grades found, check</span>' : ty.map(g => '<div class="big-sc" data-copy="' + esc(fmtNum(g.score != null ? g.score : g.pct)) + '" title="Click to copy">' + esc(foundLabel(g)) + '</div>').join(''))
          : hf.length === 1 ? big(hf[0].score != null ? hf[0].score : hf[0].pct, hf[0].outOf, hf[0].score != null ? hf[0].pct : null)
          : hs.length ? '<input class="sc-in" type="text" inputmode="decimal" data-typed="' + i + '" value="' + esc(st.grade.sheet ?? '') + '" placeholder="Score" aria-label="Type the score you see in the picture"><div class="muted" style="font-size:12px;margin-top:4px;font-weight:400">Type what you see</div>'
          : rdw.ask.length ? '' : '<span class="muted" style="font-weight:400">No grade found yet</span>';
        return '<tr><td class="n">' + (i + 1) + '</td><td>' + where + '</td><td>' + pics + '<button class="link" data-open="' + i + '" data-file="' + esc(f.path) + '" style="text-align:left">' + (w ? 'Word rubric' : 'Word file') + '</button>' +
          (info ? '<div class="muted" style="font-size:13px">' + info + '</div>' : '') + tyAll.filter(g => !g.table).map(g => '<div class="muted" style="font-size:13px;max-width:360px">Typed: “' + esc(g.text) + '”</div>').join('') +
          '<div style="margin-top:4px"><button class="link" style="font-size:12px" data-rebox="' + i + '|' + esc(f.path) + '">' + (f.hand ? 'Boxed by hand · redo' : 'Box it by hand') + '</button></div></td><td style="font-weight:700">' + reads + readsHtml(i, rdw) + '</td></tr>';
      }
      if (!f) return '<tr><td class="n">' + (i + 1) + '</td><td>' + where + '</td><td class="muted">' + (none ? 'Nothing turned in' : nograde ? 'No grade yet. <button class="link" style="font-size:13px" data-rebox="' + i + '|' + esc(first.path) + '">Box it by hand</button>' : 'Only unmarked files, left out') + '</td><td></td></tr>';
      if (out) return '<tr style="opacity:.7"><td class="n">' + (i + 1) + '</td><td>' + where + '</td><td class="muted">Left out (no marks). <button class="link" data-bring="' + i + '|' + esc(f.path) + '">Bring back</button></td><td></td></tr>';
      const sc = f.scan || { found: [], shots: [] };
      const rdf = splitReads(st, sc.found), okF = rdf.ok, many = manyReads(st);
      const pics = sc.shots.map(g => '<div style="margin-bottom:6px"><img src="' + g.img + '" alt="" data-open="' + i + '" data-file="' + esc(f.path) + '" title="Open this file" style="display:block;max-width:360px;max-height:150px;border:1px solid ' + (many ? 'var(--warn)' : 'var(--line)') + ';border-radius:4px;cursor:pointer;background:#fff">' +
        (g.text && g.from === 'note' ? '<div class="muted" style="font-size:12px;max-width:360px">Typed: “' + esc(g.text) + '” · page ' + (g.page + 1) + '</div>' : '<div class="muted" style="font-size:12px">Page ' + (g.page + 1) + '</div>') + '</div>').join('') ||
        '<span class="muted">' + (f.hand ? 'Boxed by hand' : sc.err ? 'Couldn’t read this file' : sc.seen && sc.seen.length ? 'No grade in the typed text I found: “' + esc(sc.seen.join('” · “')) + '”' : sc.nAnnots ? 'There are marks here but no typed text, so the grade may be handwritten or flattened. Try Box it by hand.' : 'No marks or typed text in this file. If you marked it in Kami, the marks may not have been saved into the file. Try Box it by hand.') + '</span>';
      const ri = rows.findIndex(r => r.f === f);
      const handNote = '<div style="margin-top:4px;display:flex;gap:14px"><button class="link" style="font-size:12px" data-rebox="' + i + '|' + esc(f.path) + '">' + (f.hand ? 'Boxed by hand · redo' : 'Box it by hand') + '</button><button class="link" style="font-size:12px;color:var(--muted)" data-leave="' + i + '|' + esc(f.path) + '">Leave out</button></div>';
      let reads;
      if (okF.length === 1 && !many) {   // clearly one score: show it big beside the picture
        const g0 = okF[0];
        reads = '<div class="big-sc" data-copy="' + esc(fmtNum(g0.score != null ? g0.score : g0.pct)) + '" title="Click to copy">' + (g0.score != null ? fmtNum(g0.score) + (g0.outOf ? '<small>/ ' + fmtNum(g0.outOf) + '</small>' : '') : fmtNum(g0.pct) + '<small>%</small>') + '</div>' +
          (g0.score != null && g0.pct != null ? '<div class="muted" style="font-size:13px;margin-top:4px;font-weight:500">= ' + fmtNum(g0.pct) + '%</div>' : '');
      } else if (okF.length && !many) reads = okF.map(g => '<div class="c" data-copy="' + esc(fmtNum(g.score != null ? g.score : g.pct)) + '" style="cursor:copy">' + esc(foundLabel(g)) + '</div>').join('');
      else if (!okF.length && sc.shots.length && !rdf.ask.length) reads = '<input class="sc-in" type="text" inputmode="decimal" data-typed="' + i + '" value="' + esc(st.grade.sheet ?? '') + '" placeholder="Score" aria-label="Type the score you see in the picture"><div class="muted" style="font-size:12px;margin-top:4px;font-weight:400">Type what you see</div>';
      else reads = '';
      const own = ownGrade(st), ps = okF.length === 1 ? okF[0].score : okF.length ? null : paperScore(st);
      if (own.total != null && ps != null && Math.abs(own.total - ps) > 0.001) reads += '<span class="sc-warn">Your score in Grading Studio is ' + fmtNum(own.total) + (own.partial ? ' (partial)' : '') + '</span>';
      return '<tr><td class="n">' + (i + 1) + '</td><td>' + where + '</td><td>' + pics + handNote + '</td><td style="font-weight:700">' +
        (many ? '<span class="pill warn" style="display:inline-block;font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--warn-soft);color:var(--warn);margin-bottom:6px">' + readsCount(st) + ' grades found, check</span>' : '') + reads + readsHtml(i, rdf) + '</td></tr>';
    }).join('') + '</tbody></table>';
}
// Box each grade by hand: one paper at a time, drag a box around the grade, and it moves to the next paper.
let eachKeys = null;
async function pickEach(start) {
  const rows = sheetRows(true);
  const fileRows = rows.map((r, k) => ({ ...r, k })).filter(r => r.f && (viewable(r.f) || r.f.kind === 'docx'));
  if (!fileRows.length) return toast('No papers to box');
  let pos = start != null ? Math.max(0, fileRows.findIndex(r => r.i + '|' + r.f.path === start)) : Math.max(0, fileRows.findIndex(r => !r.f.hand));
  let token = 0;
  openDlg('<div class="bh"><h2 id="peTitle">Box the grade</h2><span class="muted" id="peCount"></span><button class="icon" data-done aria-label="Done">✕</button></div>' +
    '<div class="bb" id="peBody" style="background:var(--surface-2)"></div>' +
    '<div class="bf" style="justify-content:space-between"><span class="muted" style="font-size:13px;align-self:center">Drag a box around the grade. It saves and goes to the next paper.</span><span style="display:flex;gap:8px"><button class="btn" data-back>◀ Back</button><button class="btn" data-skip>Skip (no grade)</button><button class="btn primary" data-done>Done</button></span></div>');
  const box = $('#dlgBox');
  const finish = () => { if (eachKeys) document.removeEventListener('keydown', eachKeys, true); eachKeys = null; saveSoon(); openSheet(true); };
  const go = d => { pos += d; if (pos >= fileRows.length) { toast('That was the last paper'); return finish(); } pos = Math.max(0, pos); show(); };
  async function show() {
    const my = ++token, { st, i, f } = fileRows[pos];
    $('#peTitle').textContent = st.key;
    $('#peCount').textContent = 'Student ' + (i + 1) + ' of ' + batch.students.length + ' · paper ' + (pos + 1) + ' of ' + fileRows.length;
    const body = $('#peBody');
    body.innerHTML = '<div class="muted" style="font-size:13px;margin-bottom:8px;overflow-wrap:anywhere">File: ' + esc(f.path) + (f.hand ? ' · already boxed (drag again to change it)' : '') + '</div>';
    body.scrollTop = 0;
    box.querySelector('[data-back]').disabled = pos === 0;
    let doc;
    if (f.kind === 'docx' && f.wpdfOf !== f.data) body.insertAdjacentHTML('beforeend', '<p class="muted" data-wwait>Getting the Word file ready…</p>');
    try { doc = await pdfjsLib.getDocument({ data: (await paperBytes(f)).slice(), isEvalSupported: false }).promise; }
    catch (e) { console.error(e); if (my === token) body.insertAdjacentHTML('beforeend', '<p>This file couldn’t be opened. Click Skip.</p>'); return; }
    if (my !== token) { doc.destroy(); return; }
    const ww = body.querySelector('[data-wwait]'); if (ww) ww.remove();
    const avail = body.clientWidth - 40;
    for (let p = 0; p < doc.numPages; p++) {
      if (my !== token) break;
      const page = await doc.getPage(p + 1);
      const v1 = vpRot(f, p, page, 1), k = f.kind === 'docx' ? Math.min(1.5, avail / v1.width) : Math.min(1.8, avail / v1.width, Math.max(body.clientHeight - 50, 480) / v1.height), dpr = window.devicePixelRatio || 1;
      const vp = vpRot(f, p, page, k * dpr);
      const c = document.createElement('canvas');
      c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      Object.assign(c.style, { width: v1.width * k + 'px', height: v1.height * k + 'px', display: 'block', margin: '0 auto 14px', background: '#fff', boxShadow: 'var(--shadow)', cursor: 'crosshair', touchAction: 'none' });
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp, transform: skewXf(f, p, vp), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
      if (my !== token) break;
      const mk = ((f.marks || {})[p] || []).filter(m => m.t !== 'note');
      if (mk.length) { ctx.save(); ctx.scale(k * dpr, k * dpr); drawMarks(ctx, mk, v1.width, v1.height, 0, null); ctx.restore(); }
      const base = ctx.getImageData(0, 0, c.width, c.height);
      const paint = sel => {
        ctx.putImageData(base, 0, 0);
        if (!sel) return;
        ctx.fillStyle = 'rgba(31,111,178,.14)'; ctx.fillRect(sel.x * c.width, sel.y * c.height, sel.w * c.width, sel.h * c.height);
        ctx.strokeStyle = '#1F6FB2'; ctx.lineWidth = 2 * dpr; ctx.strokeRect(sel.x * c.width, sel.y * c.height, sel.w * c.width, sel.h * c.height);
      };
      if (f.hand && f.hand.page === p) paint(f.hand);
      let d0 = null, sel = null;
      const rel = e => { const r = c.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
      c.onpointerdown = e => { e.preventDefault(); c.setPointerCapture(e.pointerId); d0 = rel(e); sel = null; };
      c.onpointermove = e => { if (!d0) return; const [x, y] = rel(e); sel = { x: Math.min(x, d0[0]), y: Math.min(y, d0[1]), w: Math.abs(x - d0[0]), h: Math.abs(y - d0[1]) }; paint(sel); };
      c.onpointerup = () => {
        if (!d0) return; d0 = null;
        if (!sel || sel.w < 0.015 || sel.h < 0.008) { paint(f.hand && f.hand.page === p ? f.hand : null); return; }
        f.hand = { page: p, x: r4(sel.x), y: r4(sel.y), w: r4(sel.w), h: r4(sel.h) };
        f.scan = undefined; saveSoon();
        paint(sel);
        setTimeout(() => { if (my === token) go(1); }, 250);
      };
      body.appendChild(c);
      page.cleanup();
    }
    doc.destroy();
  }
  const r4 = v => Math.round(v * 10000) / 10000;
  box.onclick = e => {
    if (e.target.closest('[data-done]')) return finish();
    if (e.target.closest('[data-back]')) return go(-1);
    if (e.target.closest('[data-skip]')) return go(1);
  };
  if (eachKeys) document.removeEventListener('keydown', eachKeys, true);
  eachKeys = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(1); }
  };
  document.addEventListener('keydown', eachKeys, true);
  show();
}
function pickSpot() {
  const st = batch.students.find(s => s.files.some(f => viewable(f)));
  if (!st) return toast('No papers to pick from');
  const f = st.files.find(f => viewable(f));
  let which = (setup.spot && setup.spot.page) || 'first';
  openDlg('<div class="bh"><h2>Pick the grade spot</h2><button class="icon" data-close aria-label="Close">✕</button></div><div class="bb">' +
    '<p style="margin-top:0">Drag a box around where you put the grade. The same spot gets cropped on every paper, which also catches handwritten grades.</p>' +
    '<div class="chk" style="cursor:default">Page <span class="seg" id="spPage"><button data-pg="first" aria-pressed="' + (which === 'first') + '">First page</button><button data-pg="last" aria-pressed="' + (which === 'last') + '">Last page</button></span></div>' +
    '<div style="position:relative;display:inline-block;margin-top:6px"><canvas id="spC" style="display:block;border:1px solid var(--line);cursor:crosshair;touch-action:none;max-width:100%"></canvas></div></div>' +
    '<div class="bf"><button class="btn" data-close>Cancel</button><button class="btn primary" data-use disabled>Use this spot</button></div>');
  const box = $('#dlgBox'), c = $('#spC');
  let bmp = null, sel = null, W = 0, H = 0;
  const paint = () => {
    const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0);
    if (sel) { ctx.fillStyle = 'rgba(31,111,178,.12)'; ctx.fillRect(sel.x * c.width, sel.y * c.height, sel.w * c.width, sel.h * c.height); ctx.strokeStyle = '#1F6FB2'; ctx.lineWidth = 2; ctx.strokeRect(sel.x * c.width, sel.y * c.height, sel.w * c.width, sel.h * c.height); }
  };
  const load = async () => {
    const doc = await pdfjsLib.getDocument({ data: (await viewBytes(f)).slice(), isEvalSupported: false }).promise;
    const pn = which === 'last' ? doc.numPages - 1 : 0, page = await doc.getPage(pn + 1);
    const v1 = vpRot(f, pn, page, 1); const k = Math.min(1.4, 640 / v1.width);
    const vp = vpRot(f, pn, page, k); W = vp.width; H = vp.height;
    bmp = document.createElement('canvas'); bmp.width = W; bmp.height = H;
    const bc = bmp.getContext('2d'); bc.fillStyle = '#fff'; bc.fillRect(0, 0, W, H);
    await page.render({ canvasContext: bc, viewport: vp, transform: skewXf(f, pn, vp), annotationMode: pdfjsLib.AnnotationMode.ENABLE }).promise;
    doc.destroy();
    c.width = W; c.height = H; paint();
  };
  load();
  let d0 = null;
  const rel = e => { const r = c.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
  c.onpointerdown = e => { c.setPointerCapture(e.pointerId); d0 = rel(e); sel = null; };
  c.onpointermove = e => { if (!d0) return; const [x, y] = rel(e); sel = { x: Math.min(x, d0[0]), y: Math.min(y, d0[1]), w: Math.abs(x - d0[0]), h: Math.abs(y - d0[1]) }; paint(); };
  c.onpointerup = () => { d0 = null; if (sel && (sel.w < 0.02 || sel.h < 0.01)) sel = null; paint(); box.querySelector('[data-use]').disabled = !sel; };
  box.onclick = e => {
    if (e.target.closest('[data-close]')) return openSheet(false);
    const pg = e.target.closest('[data-pg]');
    if (pg) { which = pg.dataset.pg; for (const x of $('#spPage').children) x.setAttribute('aria-pressed', x === pg); sel = null; box.querySelector('[data-use]').disabled = true; load(); return; }
    if (e.target.closest('[data-use]') && sel) { setup.spot = { page: which, ...sel }; store.set('gs.setup', { ...setup, spot: undefined }); saveSoon(); openSheet(true); }
  };
}
// What she's said about a student, for the printed sheet: her score, or missing or excused, and where her score and the paper differ. [text, warn]
function sheetOwnLines(st, said) {
  if (said.has(st)) return [];
  if (noScore(st)) return [[STATUS_LABEL[st.grade.status], false]];
  const own = ownGrade(st), out = [];
  if (own.total != null) out.push(['Your score: ' + fmtNum(own.total) + ' / ' + maxPoints() + (own.pct != null ? ' = ' + fmtPct(own.pct) : '') + (own.partial ? ' (partial)' : ''), false]);
  const d = disagreeNote(st); if (d) out.push([d.replace(/^.*, t/, 'T'), true]);   // "The paper says 10", which fits the column
  return out;
}
// One PDF with every row of the grade sheet, in the order of the student list, drawn on a canvas so any name prints correctly.
async function buildSheetPdf() {
  if (!scanned) await scanAll();
  const doc = await PDFLib.PDFDocument.create();
  const PW = 612, PH = 792, M = 36, k = 2, X = M + 200, maxW = PW - M - X;
  const rows = sheetRows().filter(r => !r.out);
  const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  let ri = 0, pageNo = 0;
  const sheetSaid = new Set();   // her own score prints once per student, on their first row
  while (ri < rows.length) {
    const c = document.createElement('canvas'); c.width = PW * k; c.height = PH * k;
    const ctx = c.getContext('2d'); ctx.scale(k, k); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PW, PH);
    ctx.fillStyle = '#151922'; ctx.font = 'bold 13px ' + FONT; ctx.fillText(batch.name + ' · grade sheet' + (pageNo ? ' (continued)' : ''), M, M - 8);
    let y = M + 6;
    while (ri < rows.length) {
      const { st, i, f, word } = rows[ri], wty = word ? wordFound(f, st).filter(g => !g.table) : [], sc = word ? { found: f.virtual && f.wscore && f.wscore.total != null ? [{ score: f.wscore.total, outOf: f.wscore.max, pct: f.wscore.pct }] : wordFound(f, st).length ? wordFound(f, st) : (f.hand && f.scan && f.scan.found) || [], shots: (f.hand && f.scan && f.scan.shots) || [] } : f && f.scan ? f.scan : { found: [], shots: [] };
      const rd = splitReads(st, sc.found), okF = rd.ok;
      const imgs = [];
      for (const g of sc.shots) { const im = await loadImg(g.img); if (im) imgs.push({ im, h: Math.min(90, maxW * im.height / im.width) }); }
      const mine = sheetOwnLines(st, sheetSaid);
      const rh = Math.max(64 + mine.length * 15, imgs.reduce((a, o) => a + o.h + 6, 0) + (word && imgs.length && f.wscore ? 44 : 0)) + 10;
      if (y + rh > PH - M && y > M + 6) break;
      ctx.fillStyle = '#8A90A0'; ctx.font = '11px ' + FONT; ctx.fillText(String(i + 1), M, y + 13);
      ctx.fillStyle = '#151922'; ctx.font = 'bold 12px ' + FONT;
      let ly = y + 13;
      for (const ln of wrapText(ctx, st.key, 170).slice(0, 2)) { ctx.fillText(ln, M + 20, ly); ly += 14; }
      ctx.fillStyle = '#5D6475'; ctx.font = '9.5px ' + FONT;
      if (f) for (const ln of wrapText(ctx, f.path, 170).slice(0, 2)) { ctx.fillText(ln, M + 20, ly); ly += 12; }
      ctx.font = 'bold 12px ' + FONT;
      for (const [ln, warn] of mine) { sheetSaid.add(st); ctx.fillStyle = warn ? '#9A6411' : '#151922'; ctx.fillText(ln, M + 20, ly + 4); ly += 15; }
      if (manyReads(st)) { ctx.fillStyle = '#9A6411'; ctx.fillText(readsCount(st) + ' grades found, check', M + 20, ly + 4); ly += 16; }
      if (rd.ask.length) { ctx.fillStyle = '#9A6411'; ctx.fillText('To confirm: ' + rd.ask.map(foundLabel).join(', '), M + 20, ly + 4); ly += 16; }
      ctx.fillStyle = '#1C7F54';
      if (okF.length === 1 && !manyReads(st)) { ctx.font = 'bold 18px ' + FONT; ctx.fillText(foundLabel(okF[0]), M + 20, ly + 12); ly += 22; }
      else for (const g of okF) { ctx.fillText(foundLabel(g), M + 20, ly + 4); ly += 15; }
      if (f && !okF.length && hasSheet(st.grade)) { ctx.font = 'bold 18px ' + FONT; ctx.fillText(String(st.grade.sheet), M + 20, ly + 12); ctx.font = '9.5px ' + FONT; ctx.fillStyle = '#5D6475'; ctx.fillText('typed from the picture', M + 20, ly + 24); }
      let iy = y;
      for (const { im, h } of imgs) { const w = h * im.width / im.height; ctx.drawImage(im, X, iy, w, h); ctx.strokeStyle = manyReads(st) ? '#E8B451' : '#DADDE6'; ctx.strokeRect(X, iy, w, h); iy += h + 6; }
      if (word) { ctx.fillStyle = '#151922'; ctx.font = '11px ' + FONT; let wy = (imgs.length ? iy : y) + 13; for (const ln of wrapText(ctx, !f.wscore || wty.length ? (wty.length ? 'Word file, typed: ' + wty.map(g => '“' + g.text + '”').join(' · ') : imgs.length ? '' : 'Word file') : 'Word rubric: ' + f.wscore.crits.map((c, k) => c + ' ' + (f.wscore.per[k] == null ? '–' : fmtNum(f.wscore.per[k]))).join(' · '), maxW).slice(0, 4)) { ctx.fillText(ln, X, wy); wy += 14; } }
      else if (!imgs.length) { ctx.fillStyle = '#8A90A0'; ctx.font = 'italic 11px ' + FONT; ctx.fillText(f ? 'No typed grade found' : rows[ri].nograde ? 'No grade yet' : 'Nothing turned in', X, y + 13); }
      y += rh; ctx.strokeStyle = '#ECEEF3'; ctx.beginPath(); ctx.moveTo(M, y - 5); ctx.lineTo(PW - M, y - 5); ctx.stroke();
      ri++;
    }
    const jpg = await canvasJpg(c, 0.9);
    doc.addPage([PW, PH]).drawImage(await doc.embedJpg(jpg), { x: 0, y: 0, width: PW, height: PH });
    c.width = c.height = 0; pageNo++;
  }
  return await doc.save();
}

