/* ---------------- undo and redo ---------------- */
// Each step remembers one page's marks as they were (and its turn, for a rotation), so undo and redo swap them back.
let redoStack = [];
const stepOf = (file, idx, withRot) => ({ file, idx, before: JSON.stringify(file.marks[idx] || []), rot: withRot ? rotOf(file, idx) : undefined, skew: withRot ? skewOf(file, idx) : 0, cov: withRot ? coverCopy(file, idx) : undefined });
function pushUndo(u) { undoStack.push(u); if (undoStack.length > 200) undoStack.shift(); redoStack = []; renderTools(); }
function snap(pg) { pushUndo(stepOf(pg.file, pg.idx)); }
function changed(pg) { scanned = false; draw(pg); gradeMarksChanged(pg.file); saveSoon(); renderList(); }
function undo() { swapStep(undoStack, redoStack); }
function redo() { swapStep(redoStack, undoStack); }
function swapStep(from, to) {
  commitEditors();
  const u = from.pop(); if (!u) return;
  scanned = false;
  to.push(stepOf(u.file, u.idx, u.rot !== undefined));
  u.file.marks[u.idx] = JSON.parse(u.before);
  selected = null;
  const turned = u.rot !== undefined && (u.rot !== rotOf(u.file, u.idx) || (u.skew || 0) !== skewOf(u.file, u.idx));
  if (turned) { setRot(u.file, u.idx, u.rot); setSkew(u.file, u.idx, u.skew); coverPut(u.file, u.idx, u.cov); thumbCache.clear(); }
  const pg = pages.find(p => p.file === u.file && p.idx === u.idx);
  if (pg) { if (turned) reshape(pg); else draw(pg); }
  else { const si = batch.students.findIndex(s => s.files.includes(u.file)); if (si >= 0 && si !== cur) openStudent(si); }
  if (turned) rescanFile(u.file); else gradeMarksChanged(u.file);
  saveSoon(); renderList(); renderTools();
}

/* ---------------- turning pages ---------------- */
// A turn of 90° clockwise (dir 1) or counterclockwise (dir -1). Marks turn with the page; text stays upright.
function setRot(f, p, r) { r = ((r % 360) + 360) % 360; coverTurn(f, p, r - rotOf(f, p)); f.rot ||= {}; if (r) f.rot[p] = r; else delete f.rot[p]; }
function setSkew(f, p, a) { f.skew ||= {}; if (a) f.skew[p] = a; else delete f.skew[p]; }
function turnMarks(marks, W, H, dir) {
  const pt = ([x, y]) => dir > 0 ? [r1(H - y), r1(x)] : [r1(y), r1(W - x)];
  const box = b => { const [ax, ay] = pt([b.x, b.y]), [bx, by] = pt([b.x + b.w, b.y + b.h]); return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) }; };
  for (const m of marks) {
    if (m.t === 'pen') m.pts = m.pts.map(pt);
    else if (m.t === 'hl' || m.t === 'oval') { Object.assign(m, box(m)); if (m.rects) m.rects = m.rects.map(box); if (m.pts) m.pts = m.pts.map(pt); }
    else if (m.t === 'check' || m.t === 'stamp') [m.x, m.y] = pt([m.x, m.y]);
    else if (m.t === 'note') { [m.ax, m.ay] = pt([m.ax, m.ay]); if (m.hl) m.hl = box(m.hl); if (m.rects) m.rects = m.rects.map(box); }
    else if (m.t === 'text') {
      const L = textLayout(m, W), [cx, cy] = pt([m.x + L.ink / 2, m.y + L.h / 2]);   // turns about the words, not the empty part of a wide box
      const want = m.bwFull || m.bw;
      if (m.bw) m.bw = Math.min(want, H - 12);
      const L2 = textLayout({ ...m, x: 0 }, H);
      m.x = r1(cx - L2.ink / 2); m.y = r1(cy - L2.h / 2);
      if (m.bw) { m.bw = Math.min(m.bw, Math.max(Math.ceil(L2.ink) + 1, 24, H - m.x - 6)); if (m.bw < want) m.bwFull = want; else delete m.bwFull; }   // near the edge a box gives up its empty part, so the words needn't move
      keepOnPage(m, H, W);
    }
  }
}
// Turns pages of one file; with no page list, every page. One undo step per page, undone together.
async function turnPages(f, list, dir) {
  if (!f || !viewable(f)) return;
  commitEditors();
  if (!list) list = [...Array(f.numPages || 0).keys()];
  const steps = [];
  for (const p of list) {
    const pg = pages.find(q => q.file === f && q.idx === p);
    let W = pg && pg.W, H = pg && pg.H;
    if (!pg && docMap.get(f.path)) { try { const vp = vpRot(f, p, await docMap.get(f.path).getPage(p + 1), 1); W = vp.width; H = vp.height; } catch {} }
    steps.push(stepOf(f, p, true));
    if (W && f.marks[p] && f.marks[p].length) turnMarks(f.marks[p], W, H, dir);
    setRot(f, p, rotOf(f, p) + 90 * dir);
    if (pg) reshape(pg);
  }
  if (steps.length === 1) pushUndo(steps[0]);
  else for (const u of steps) pushUndo(u);   // undo turns them back one page at a time
  selected = null; thumbCache.clear();
  rescanFile(f); saveSoon(); renderList();
}
// Re-measures a page after a turn and draws it again.
function reshape(pg) {
  const vp = vpRot(pg.file, pg.idx, pg.page, 1);
  pg.W = vp.width; pg.H = vp.height; pg.side = sideFor(vp.width); pg.covers = null; pg.adj = null; pg.extra = [];
  renderPage(pg); scanNote(pg);
}
// Kami notes and typed grades are found again on the turned page.
async function rescanFile(f) {
  const st = batch && batch.students.find(s => s.files.includes(f)); if (!st || !viewable(f)) return;
  try { f.scan = await scanFile(f, f.hand || setup.spot || null); if (f.hand) f.scan.hand = true; f.kami = f.scan.kami; } catch (e) { console.error(e); return; }
  refound(st); renderList(); gradeShown(st);
  for (const pg of pages) if (pg.file === f) { pg.extra = (f.kami && f.kami[pg.idx] && f.kami[pg.idx].notes) || []; draw(pg); if (pg.impFirst) impNote(pg); }
}
// The panel's total, without touching the comment box she may be typing in.
function gradeShown(st) { const t = $('#grade .total'); if (t && st === batch.students[cur]) t.innerHTML = totalHtml(st); }
// A grade lives in the mark that holds it. "page|words" for each of her marks with a grade in it.
const gradeMarks = f => Object.entries(f.marks || {}).flatMap(([p, a]) => a.filter(m => (m.t === 'text' || m.t === 'note' || (m.t === 'stamp' && m.k === 'score')) && m.text && parseGrade(m.text, false)).map(m => p + '|' + m.text)).sort();
const rereadTimers = new Map();
let rereadQ = Promise.resolve(), rereadsLeft = 0;
// When those marks change, the old reading goes this moment and the file is read again for the new one. Pen strokes and plain comments change nothing here.
function gradeMarksChanged(f) {
  if (!batch || !f || !viewable(f)) return;
  const keys = gradeMarks(f);
  if (keys.join('\0') === ((f.scan && f.scan.marksSig) || '')) return;
  const st = batch.students.find(s => s.files.includes(f));
  if (st && f.scan && f.scan.found) {
    const stale = g => g.mark && !keys.includes(g.page + '|' + g.full);
    if (f.scan.found.some(stale)) { f.scan.found = f.scan.found.filter(g => !stale(g)); f.scan.shots = f.scan.shots.filter(g => !stale(g)); refound(st); gradeShown(st); }
  }
  clearTimeout(rereadTimers.get(f));
  rereadTimers.set(f, setTimeout(() => rereadNow(f), 250));
}
function rereadNow(f) {
  clearTimeout(rereadTimers.get(f)); rereadTimers.delete(f);
  rereadsLeft++;
  rereadQ = rereadQ.then(async () => {
    while (scanP) await scanP;
    const was = f.scan;
    await rescanFile(f);
    if (batch && f.scan && f.scan !== was) gradeMarksChanged(f);   // marks she changed during the read
  }).catch(e => console.error(e)).then(() => { rereadsLeft--; });
  return rereadQ;
}
// Waits until everything she has marked so far has been read.
const rereadsPending = () => rereadsLeft > 0 || rereadTimers.size > 0;
async function rereadsDone() {
  while (rereadsPending()) {
    for (const f of [...rereadTimers.keys()]) rereadNow(f);
    await rereadQ;
  }
}

/* ---------------- pointer input on a page ---------------- */
function bindPage(pg) {
  const c = pg.canvas;
  const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / pg.s, (e.clientY - r.top) / pg.s]; };
  const onPage = (x, y) => x >= 0 && x <= pg.W && y >= 0 && y <= pg.H;
  let g = null;   // the gesture in progress
  c.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const wasNote = !!(activeEditor && activeEditor.note);   // a comment was open: this click only closes it
    commitEditors();
    // Clicking the paper leaves the score or comment box, so the arrow keys move between students again.
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && !pg.wrap.contains(ae)) ae.blur();
    const [x, y] = pt(e);
    if (scorePlacing) { e.preventDefault(); if (onPage(x, y)) placeScore(pg, x, y); else stopScorePlace(); return; }
    // A comment box in the margin always opens for editing, whatever the tool.
    const box = (pg.boxes || []).find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (box && !box.n.ro && tool !== 'erase') { e.preventDefault(); openNote(pg, box.n); return; }
    if (wasNote) { e.preventDefault(); return; }
    if (tool !== 'erase' && !once) { const cg = cornerAt(pg, x, y); if (cg) { e.preventDefault(); c.setPointerCapture(e.pointerId); g = cg; return; } }
    if (tool !== 'select' && tool !== 'erase' && !onPage(x, y)) return;
    e.preventDefault();
    c.setPointerCapture(e.pointerId);
    const pick = once ? null : clickToPick(pg, x, y); if (pick) { g = pick; return; }   // a one-time circle or highlight draws over marks
    if (tool === 'pen') g = inkBegin({ t: 'pen', color: COLORS[inkColor], w: penW, pts: [[r1(x), r1(y)]] }, x, y, e, pg.s);
    else if (tool === 'hl') g = hlBegin(pg, x, y, e);
    else if (tool === 'oval') g = { x0: x, y0: y, m: { t: 'oval', color: COLORS[inkColor], sw: Math.max(1.2, penW * 0.8), x, y, w: 0, h: 0 } };
    else if (tool === 'erase') { g = { erase: true, snapped: false }; eraseAt(pg, x, y, g); }
    else if (tool === 'check') { snap(pg); pg.marks().push({ t: 'check', color: CHECK_INK, x: r1(x), y: r1(y), size: newCheckSize() }); changed(pg); }
    else if (tool === 'text') {
      const grip = gripAt(pg, x, y); if (grip) { g = gripBegin(pg, grip); return; }
      const hit = hitMark(pg, x, y, 3);
      if (hit && hit.t === 'text') g = pickToGrab(pg, hit, x, y, true);   // drag it to move it, click it to type in it
      else { if (selected) { selected = null; redrawAll(); } g = { text: true, x0: x, y0: y, x1: x }; }   // click for a box, or drag across to set its width
    } else if (tool === 'note') {
      const hit = hitMark(pg, x, y, 3);
      if (hit && hit.t === 'note') g = pickToGrab(pg, hit, x, y, true);
      else { g = { note: true, x0: x, y0: y, m: null }; noteHlBegin(pg, g); }   // click a point, or drag over words to highlight them
    } else if (tool === 'select') {
      const grip = gripAt(pg, x, y); if (grip) { g = gripBegin(pg, grip); return; }
      const hit = hitMark(pg, x, y, 4), again = !!hit && !!selected && !selected.fresh && selected.mark === hit && (hit.t === 'text' || hit.t === 'note');   // clicking what's already picked opens it
      selected = hit ? { page: pg, mark: hit } : null;
      redrawAll();
      if (hit) g = { move: hit, x, y, moved: false, edit: again };
    }
  });
  c.addEventListener('pointermove', e => {
    if (!g) { const [x, y] = pt(e), cu = hoverCursor(pg, x, y); if (cu) c.style.cursor = cu; return; }
    const [x, y] = pt(e);
    if (g.text) {
      g.x1 = clamp(x, 0, pg.W);
      const w = Math.abs(g.x1 - g.x0);
      pg.ghost = w > 8 ? { x: Math.min(g.x0, g.x1), y: g.y0 - disp.tsize * 0.65, w, h: disp.tsize * 1.3 } : null;
      draw(pg);
    } else if (g.note) {
      const x1 = clamp(x, 0, pg.W), y1 = clamp(y, 0, pg.H);
      if (g.snapA != null) { if (Math.hypot(x1 - g.x0, y1 - g.y0) < 5 && !g.dragged) return; g.dragged = true; noteHlMove(pg, g, x1, y1); draw(pg, [g.m]); return; }
      if (!g.m && Math.hypot(x1 - g.x0, y1 - g.y0) < 5) return;
      g.m = { t: 'hl', color: HL[hlColor], x: Math.min(g.x0, x1), y: Math.min(g.y0, y1), w: Math.abs(x1 - g.x0), h: Math.abs(y1 - g.y0) };
      draw(pg, [g.m]);
    } else if (g.scale) {
      if (!g.moved) { snap(pg); g.moved = true; }
      cornerMove(pg, g, x, y);
      draw(pg);
    } else if (g.resize) {
      if (!g.moved) { snap(pg); g.moved = true; }
      gripMove(pg, g, x);
      draw(pg);
    } else if (g.m && g.m.t === 'pen') inkMove(pg, g, e, pt);
    else if (g.m && g.m.t === 'hl') hlMove(pg, g, e, pt);
    else if (g.m && g.m.t === 'oval') {
      const x1 = clamp(x, 0, pg.W), y1 = clamp(y, 0, pg.H);
      Object.assign(g.m, { x: Math.min(g.x0, x1), y: Math.min(g.y0, y1), w: Math.abs(x1 - g.x0), h: Math.abs(y1 - g.y0) });
      draw(pg, [g.m]);
    } else if (g.erase) eraseAt(pg, x, y, g);
    else if (g.move) {
      const dx = x - g.x, dy = y - g.y;
      if (!g.moved) { if (Math.hypot(dx, dy) < 1.5) return; snap(pg); g.moved = true; }
      moveMark(g.move, dx, dy); if (g.move.t === 'text') keepOnPage(g.move, pg.W, pg.H); g.x = x; g.y = y; draw(pg);
    }
  });
  const end = () => {
    if (!g) return;
    if (g.text) {
      pg.ghost = null;
      const w = Math.abs(g.x1 - g.x0), m = { t: 'text', color: COLORS[inkColor], x: r1(w > 24 ? Math.min(g.x0, g.x1) : Math.min(g.x0, pg.W - 106)), y: r1(g.y0 - disp.tsize / 2), size: disp.tsize, text: '' };
      m.bw = w > 24 ? r1(w) : newTextW(pg, m.x);
      keepOnPage(m, pg.W, pg.H);
      g = null; snap(pg); pg.marks().push(m); editText(pg, m, true);
      return;
    }
    if (g.note) {
      let m;
      if (g.dragged) m = noteFromSnap(g, COLORS[inkColor]);
      else if (g.snapA == null && g.m && g.m.w >= 4) {
        const h = Math.max(6, g.m.h), hl = { x: r1(g.m.x), y: r1(g.m.y - (h - g.m.h) / 2), w: r1(g.m.w), h: r1(h) };
        m = { t: 'note', color: COLORS[inkColor], ax: r1(hl.x + hl.w), ay: r1(hl.y + hl.h / 2), hl, hc: HL[hlColor], text: '' };
      } else m = { t: 'note', color: COLORS[inkColor], ax: r1(g.x0), ay: r1(g.y0), text: '' };
      g = null; openNote(pg, m, true);
      return;
    }
    if (g.scale) { const m = g.scale; if (g.moved) { rememberSize(m); changed(pg); } g = null; return; }
    if (g.resize) { const m = g.resize; if (g.moved) { keepOnPage(m, pg.W, pg.H); changed(pg); } g = null; return; }
    if (g.m && g.m.t === 'pen') { inkEnd(pg, g); snap(pg); pg.marks().push(g.m); changed(pg); }
    else if (g.m && g.m.t === 'oval') {
      if (g.m.w >= 6 && g.m.h >= 6) { for (const k of ['x', 'y', 'w', 'h']) g.m[k] = r1(g.m[k]); snap(pg); pg.marks().push(g.m); changed(pg); }
      else draw(pg);
    }
    else if (g.m && g.m.t === 'hl') {
      hlEnd(pg, g);
      snap(pg); pg.marks().push(g.m); changed(pg);
    } else if (g.move && g.moved) changed(pg);
    else if (g.move && g.edit) { const m = g.move; g = null; editMark(pg, m); return; }
    g = null;
    if (once && once.k !== 'pen') endOnce();   // a circle or highlight from the right-click: one, then back to her tool
  };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
  // A right-click on the page: a comment right there, or any other mark or tool, used once.
  c.addEventListener('contextmenu', e => {
    const [x, y] = pt(e);
    if (!onPage(x, y) || pg.editing || activeEditor) return;
    e.preventDefault(); commitEditors();
    if (once) endOnce();   // a right-click ends a one-time tool (the pen's writing, say) and opens the menu
    openStampMenu(pg, x, y, e.clientX, e.clientY);
  });
  c.addEventListener('dblclick', e => {
    if (tool !== 'select' || pg.editing || activeEditor) return;
    const [x, y] = pt(e);
    const hit = hitMark(pg, x, y, 3);
    if (hit && hit.t === 'text') editText(pg, hit);
    if (hit && hit.t === 'note') openNote(pg, hit);
  });
}
const r1 = v => Math.round(v * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function moveMark(m, dx, dy) {
  if (m.t === 'pen') m.pts = m.pts.map(([x, y]) => [r1(x + dx), r1(y + dy)]);
  else if (m.t === 'note') { m.ax = r1(m.ax + dx); m.ay = r1(m.ay + dy); if (m.hl) m.hl = { ...m.hl, x: r1(m.hl.x + dx), y: r1(m.hl.y + dy) }; moveExtras(m, dx, dy); }
  else { m.x = r1(m.x + dx); m.y = r1(m.y + dy); moveExtras(m, dx, dy); }
}
function eraseAt(pg, x, y, g) {
  const hit = hitMark(pg, x, y, 3);
  if (!hit) return;
  if (!g.snapped) { snap(pg); g.snapped = true; }
  const a = pg.marks(); a.splice(a.indexOf(hit), 1);
  changed(pg);
}
// Copy a mark (⌘C) and paste it (⌘V) on the page in view, even on another student's paper; ⌘D duplicates.
let markClip = null;
function copyMark(quiet) {
  if (!selected) return;
  markClip = { m: JSON.parse(JSON.stringify(selected.mark)), file: selected.page.file, idx: selected.page.idx, n: 0 };
  delete markClip.m.ro; delete markClip.m.imp;
  if (!quiet) toast(keyLabel('Copied. ⌘V pastes it on the page you’re looking at.'));
}
function pageInView() {
  if (selected && pages.includes(selected.page)) return selected.page;
  const P = $('#paper').getBoundingClientRect(), mid = P.top + P.height / 3;
  let best = null, bd = 1e9;
  for (const pg of pages) { const r = pg.canvas.getBoundingClientRect(), d = mid < r.top ? r.top - mid : mid > r.bottom ? mid - r.bottom : 0; if (d < bd) { bd = d; best = pg; } }
  return best;
}
function pasteMark() {
  const pg = pageInView(); if (!pg || !markClip) return;
  const m = JSON.parse(JSON.stringify(markClip.m));
  if (pg.file === markClip.file && pg.idx === markClip.idx) { markClip.n++; moveMark(m, 12 * markClip.n, 12 * markClip.n); }
  const bb = bboxOf(m, pg.W);   // keep it on the page
  if (bb) moveMark(m, clamp(bb.x, 0, Math.max(0, pg.W - bb.w)) - bb.x, clamp(bb.y, 0, Math.max(0, pg.H - bb.h)) - bb.y);
  if (m.t === 'text') keepOnPage(m, pg.W, pg.H);
  snap(pg); pg.marks().push(m);
  setTool('select'); selected = { page: pg, mark: m }; changed(pg); redrawAll();
}
function deleteSelected() {
  if (!selected) return;
  const pg = selected.page, a = pg.marks(), i = a.indexOf(selected.mark);
  if (i >= 0) { snap(pg); a.splice(i, 1); }
  selected = null; changed(pg);
}

/* ---------------- text on the page ---------------- */
let activeEditor = null;
function editText(pg, m, isNew) {
  commitEditors();
  pg.editing = m; draw(pg);
  const ta = document.createElement('textarea');
  ta.className = 'ed'; ta.value = m.text;
  const s = pg.s;
  const hd = document.createElement('div'); hd.className = 'edh'; hd.title = 'Drag to set where the text wraps';
  const bar = document.createElement('div'); bar.className = 'edbar';
  const fit = () => {
    const L = textLayout(m, pg.W);
    Object.assign(ta.style, { left: m.x * s + 'px', top: m.y * s + 'px', fontSize: m.size * s + 'px', color: m.color, width: L.maxW * s + 'px' });
    ta.style.height = '0'; ta.style.height = Math.max(m.size * 1.3 * s, ta.scrollHeight) + 'px';
    Object.assign(hd.style, { left: (m.x + L.maxW) * s + 'px', top: m.y * s + Math.min(ta.offsetHeight / 2, 18) + 'px' });
    Object.assign(bar.style, { left: m.x * s + 'px', top: m.y * s + 'px' });
    bar.innerHTML = '<span class="edgrip" data-grip title="Drag to move this box">⠿ Move</span><button data-sz="-1" title="Smaller text">A−</button><b>' + m.size + '</b><button data-sz="1" title="Bigger text">A+</button>' +
      '<span style="width:1px;height:16px;background:rgba(255,255,255,.25);margin:0 3px"></span><button data-full class="' + (m.bw ? '' : 'on') + '" title="Wrap at the edge of the page">Page width</button>';
  };
  pg.wrap.append(ta, hd, bar); fit(); ta.focus();
  if (!isNew) snap(pg);
  ta.addEventListener('input', fit);
  hd.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); hd.setPointerCapture(e.pointerId);
    const r = pg.canvas.getBoundingClientRect();
    const mv = ev => { delete m.bwFull; m.bw = r1(clamp((ev.clientX - r.left) / s - m.x, 24, pg.W - m.x - 6)); fit(); };
    const up = () => { hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up); ta.focus(); };
    hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
  });
  bar.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (e.target.closest('[data-grip]')) gripDrag(e, bar, pg, m, fit, ta); });
  bar.addEventListener('click', e => {
    const z = e.target.closest('[data-sz]');
    if (z) { m.size = clamp(m.size + 2 * z.dataset.sz, 8, 40); disp.tsize = m.size; store.set('gs.disp', disp); }   // the next new box uses this size too
    if (e.target.closest('[data-full]')) delete m.bw;
    fit(); ta.focus();
  });
  ta.addEventListener('keydown', e => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); commitEditors(); }
    e.stopPropagation();
  });
  const me = { commit() {
    m.text = ta.value.replace(/\s+$/, '');
    ta.remove(); hd.remove(); bar.remove(); pg.editing = null;
    keepOnPage(m, pg.W, pg.H);
    if (!m.text) { const a = pg.marks(), i = a.indexOf(m); if (i >= 0) a.splice(i, 1); if (isNew) undoStack.pop(); if (selected && selected.mark === m) selected = null; }
    else if (pages.includes(pg)) selected = { page: pg, mark: m, fresh: true };   // it keeps its handles, but until she clicks it keys and swatches leave it alone, and a click beside its words starts a new box
    changed(pg); renderTools();
  } };
  activeEditor = me;
  ta.addEventListener('blur', () => setTimeout(() => { if (activeEditor === me && document.activeElement !== ta) commitEditors(); }, 0));
}

/* ---------------- margin comments ---------------- */
function openNote(pg, m, isNew) {
  commitEditors();
  const pop = document.createElement('div'); pop.className = 'pop';
  const s = pg.s;
  pop.innerHTML =
    '<div class="lbl">' + (isNew ? 'New comment' : 'Comment') + '</div>' +
    '<textarea placeholder="Type a comment…"></textarea>' +
    '<div class="lbl" data-bank>My saved comments</div><div class="chips"></div>' +
    '<div class="row"><button class="btn sm" data-a="star" title="Keep this comment so you can reuse it">☆ Save for reuse</button><span class="sp"></span>' +
    (isNew ? '' : '<button class="btn sm" data-a="del">Delete</button>') +
    '<button class="btn sm primary" data-a="ok">Done</button></div>';
  const ta = pop.querySelector('textarea'); ta.value = m.text;
  const chips = () => {
    pop.querySelector('.chips').innerHTML = bank.map((t, i) => '<span class="chip" data-i="' + i + '"><span title="' + esc(t) + '">' + esc(t) + '</span><button data-x="' + i + '" title="Remove from saved comments" aria-label="Remove">×</button></span>').join('');
    pop.querySelector('[data-bank]').hidden = !bank.length;
  };
  chips();
  // Next to the spot (below a highlight), kept inside the part of the paper on screen, so it's right there when zoomed in.
  pg.wrap.appendChild(pop);
  const P = $('#paper').getBoundingClientRect(), R = pg.wrap.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
  const sx = (m.hl ? m.hl.x : m.ax) * s, sy = (m.hl ? m.hl.y + m.hl.h : m.ay) * s, top0 = (m.hl ? m.hl.y : m.ay) * s;
  const x0 = Math.max(0, P.left - R.left) + 8, x1 = Math.min(R.width, P.right - R.left) - pw - 8;
  const y0 = Math.max(0, P.top - R.top) + 8, y1 = P.bottom - R.top - ph - 8;
  let y = sy + 12; if (y > y1 && top0 - ph - 12 >= y0) y = top0 - ph - 12;   // above the spot when there's no room below
  pop.style.left = clamp(sx + 12, x0, Math.max(x0, x1)) + 'px'; pop.style.top = clamp(y, y0, Math.max(y0, y1)) + 'px';
  ta.focus({ preventScroll: true });
  if (isNew) { pg.pending = m; draw(pg); }
  const close = save => {
    pop.remove(); activeEditor = null;
    if (pg.pending === m) pg.pending = null;
    const text = ta.value.trim();
    if (!save) { draw(pg); return; }
    const a = pg.marks(), i = a.indexOf(m);
    if (!text) { if (selected && selected.mark === m) selected = null; if (i >= 0) { snap(pg); a.splice(i, 1); changed(pg); } else draw(pg); return; }
    if (text === m.text && i >= 0) return;
    snap(pg); m.text = text; if (i < 0) a.push(m); changed(pg);
  };
  activeEditor = { commit: () => close(true), note: true };
  pop.addEventListener('pointerdown', e => e.stopPropagation());
  pop.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(false); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); close(true); }
  });
  pop.addEventListener('click', e => {
    const x = e.target.closest('[data-x]');
    if (x) { bank.splice(+x.dataset.x, 1); store.set('gs.bank', bank); chips(); return; }
    const ch = e.target.closest('.chip');
    if (ch) { const t = bank[+ch.dataset.i]; ta.value = ta.value.trim() ? ta.value.trim() + ' ' + t : t; ta.focus(); return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'star') {
      const t = ta.value.trim(); if (!t) return;
      if (!bank.includes(t)) { bank.unshift(t); store.set('gs.bank', bank); chips(); toast('Saved. It’ll show up under every new comment.'); }
    }
    if (b.dataset.a === 'ok') close(true);
    if (b.dataset.a === 'del') { ta.value = ''; close(true); }
  });
}
function commitEditors() { if (activeEditor) { const a = activeEditor; activeEditor = null; a.commit(); } }

