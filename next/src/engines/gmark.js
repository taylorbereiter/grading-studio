// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { batch, cur, setup, tool, selected, pages, undoStack, redoStack, disp, inkColor, hlColor, penW, CHECK_INK, once, tr, saveSoon, toast, renderList, renderTools, renderGrade, openStudent, renderPage, gradeMarksChanged, rescanFile, editText, openNote, openStampMenu, placeScore, stopScorePlace, scanNote, refound, endOnce, setTool, scorePlacing, activeEditor, writeWork, tabLive, tabForgot, tabLetGo, tabsBehind, saveBehind, stampWork, store, COLORS, HL, set } from './gcore.js';
import { sideScreen, textLayout, noteRunY, bboxOf, rotOf, vpRot, skewOf, draw, hasPress, PRESS_MAX, textGrips, canResize, cornerPt, STICKERS, isSticker, isScoreStamp, stickerAspect, stampBox, impHas, one, marksMine } from './gdraw.js';

// src/app/keep.js
let saveT, saveDue = false;
// src/app/keep.js
function saveNow(leaving) {
  if (!batch || !tabLive()) return;
  clearTimeout(saveT); saveDue = false;
  if (batch.revs && tabForgot(batch)) return tabLetGo();
  const data = { t: Date.now(), carry: batch.carry, cur, ck: batch.students[cur] && batch.students[cur].key, setup, cls: batch.classId, share: batch.share, drive: batch.drive, light: batch.light, lightOpt: batch.lightOpt, lightPg: batch.lightPg, lightPgL: batch.lightPgL, anon: batch.anon, moved: batch.moved, removed: batch.removed, refSkip: batch.refSkip, quiz: batch.quiz, groups: groupsSave(false), ...(groupsSave(true) ? { groupsOwn: groupsSave(true) } : {}), returned: batch.returned || undefined, read: (batch.read = paperReads()), s: {} };
  if (batch.vrot) data.vrot = batch.vrot;   // videos turned the right way up (video.js); no key at all without one
  if (batch.clips && batch.clips.length) data.clips = batch.clips;   // parts of videos to show the class (video.js); no key at all without one
  if (batch.goal) data.goal = batch.goal;   // a learning goal for the whole score (goals.js); no key at all without one
  for (const st of batch.students) {
    const f = {};
    for (const fl of st.files.concat(st.gone || [])) if (Object.values(fl.marks).some(a => a.length)) f[fl.path] = fl.marks;   // a removed file keeps its marks for Bring back
    const g = st.grade;
    const hb = {};
    for (const fl of st.files) if (fl.hand) hb[fl.path] = fl.hand;
    const inc = st.inc && Object.keys(st.inc).length ? st.inc : undefined;
    const tr = {}; for (const fl of st.files) if (fl.tr) tr[fl.path] = fl.tr;
    const im = {}, imn = []; for (const fl of st.files) { if (impHas(fl)) im[fl.path] = fl.imp; if (fl.impNo) imn.push(fl.path); }
    const rt = scanOwn(st, 'rot', 'didTurn', rotToSave), sk = scanOwn(st, 'skew', 'didSkew');
    if (Object.keys(im).length || imn.length || Object.keys(rt).length || Object.keys(sk).length || Object.keys(tr).length || Object.keys(hb).length || st.layout || st.forder || inc || Object.keys(f).length || g.rubric.some(v => v != null) || g.points !== '' || g.comment || hasSheet(g) || g.status || g.at)
      data.s[st.key] = { f, g, h: hb, L: st.layout || undefined, Lp: st.layout ? 1 : undefined, o: st.forder || undefined, inc, tr: Object.keys(tr).length ? tr : undefined, r: Object.keys(rt).length ? rt : undefined, sk: Object.keys(sk).length ? sk : undefined, im: Object.keys(im).length ? im : undefined, imn: imn.length ? imn : undefined };
  }
  data.scan = scanSave();
  // Someone with work saved who isn't on the list just now (no paper, and not on the roster here) keeps it: they'd only be off the list until the roster comes.
  const listed = new Set(batch.students.map(st => st.key));
  for (const [k, r] of Object.entries(batch.lastS || {})) if (!listed.has(k)) data.s[k] = r;
  batch.lastS = data.s;
  if (!saveBad.has(batch.id)) batch.wasOk = batch.revs;   // a change whose save failed still has to count as this tab's own, until one works
  const was = batch.wasOk;
  stampWork(batch, data);
  if (tabsBehind(batch)) return saveBehind(batch, data, was, leaving);
  return writeWork(batch, data);
}
// src/app/draw.js
function keepOnPage(m, W, H) {
  if (m.bw) {
    const want = m.bwFull || m.bw, one = textLayout({ ...m, x: 0, bw: want }, 1e6), need = one.lines.length === 1 ? Math.min(m.bw, Math.ceil(one.ink) + 1) : m.bw;
    m.x = r1(clamp(m.x, 0, Math.max(0, W - need - 6)));
    m.bw = r1(Math.min(want, W - m.x - 6));
    if (m.bw < want) m.bwFull = want; else delete m.bwFull;
  } else { delete m.bwFull; m.x = r1(clamp(m.x, 0, W - 30)); }
  m.y = r1(clamp(m.y, 0, Math.max(0, H - textLayout(m, W).h - 2)));
}
// src/app/draw.js
function distToSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  let t = L ? ((px - a[0]) * dx + (py - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}
// src/app/draw.js
function hitMark(pg, x, y, slop) {
  const marks = marksMine(pg.marks(), pg.file, batch.students[cur]);
  for (const b of pg.boxes || []) if (!b.n.ro && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.n;
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i];
    const shape = hitShape(m, x, y, slop, pg.W);
    if (shape) return m;
    if (shape === null) {
      const bb = bboxOf(m, pg.W);
      if (bb && x >= bb.x - slop && x <= bb.x + bb.w + slop && y >= bb.y - slop && y <= bb.y + bb.h + slop) return m;
    }
  }
  return null;
}
// src/app/files.js
const thumbCache = new Map();
// src/app/arrange.js
function redrawAll() { for (const pg of pages) draw(pg); }
// src/app/paper.js
const stepOf = (file, idx, withRot) => ({ file, idx, before: JSON.stringify(file.marks[idx] || []), rot: withRot ? rotOf(file, idx) : undefined, skew: withRot ? skewOf(file, idx) : 0, cov: withRot ? coverCopy(file, idx) : undefined });
// src/app/paper.js
function pushUndo(u) { if (stepping) return; undoStack.push(u); if (undoStack.length > 200) undoStack.shift(); set.redoStack([]); renderTools(); }
// src/app/paper.js
let stepping = false;   // while a step is being undone or redone, what it calls doesn't add steps of its own
// src/app/paper.js
const fieldStep = (obj, keys, redraw, what) => ({ obj, keys, redraw, what, before: JSON.stringify(Object.fromEntries(keys.map(k => [k, obj[k]]))), t: Date.now() });
// src/app/paper.js
function fieldSnap(obj, keys, redraw, what, join) {
  const top = undoStack[undoStack.length - 1];
  if (join && !redoStack.length && top && top.join === join && top.obj === obj && Date.now() - top.t < 1500) { top.t = Date.now(); return; }
  const u = fieldStep(obj, keys, redraw, what); u.join = join; pushUndo(u);
}
// src/app/paper.js
function fieldBack(u, to) {
  to.push(fieldStep(u.obj, u.keys, u.redraw, u.what));
  const was = JSON.parse(u.before);
  for (const k of u.keys) if (k in was) u.obj[k] = was[k]; else delete u.obj[k];
  if (u.redraw) u.redraw();
  saveSoon(); renderList();
}
// src/app/paper.js
const actStep = (back, again, what) => ({ act: { back, again }, what });
// src/app/paper.js
const groupStep = (steps, what) => ({ group: steps, what });
// src/app/paper.js
function snap(pg) { pushUndo(stepOf(pg.file, pg.idx)); justSeen(pg); }
// src/app/paper.js
const gradeStep = st => ({ grade: st, before: JSON.stringify(st.grade) });
// src/app/paper.js
function gradeSnap(st) { pushUndo(gradeStep(st)); }
// src/app/paper.js
function gradeBack(u, to) {
  const st = u.grade, si = batch.students.indexOf(st); if (si < 0) return;
  to.push(gradeStep(st));
  const was = st.grade, g = JSON.parse(u.before), t = Date.now();
  // What comes back is a change made now: its times are now, so an older copy of her work (another tab, the folder) can't win over it.
  g.at = t;
  for (let i = 0, n = Math.max((was.rubric || []).length, (g.rubric || []).length); i < n; i++) if ((was.rubric || [])[i] !== (g.rubric || [])[i]) (g.atR ||= {})[i] = t;
  if (was.points !== g.points) (g.atR ||= {}).points = t;
  st.grade = g;
  if (st.found !== undefined) refound(st);
  rowKeyed = -1;
  if (si !== cur) openStudent(si); else renderGrade();
  saveSoon(); renderList(); renderTools();
}
// src/app/paper.js
function changed(pg) { justTag(pg); scanned = false; draw(pg); gradeMarksChanged(pg.file); saveSoon(); renderList(); }
// src/app/paper.js
function undo() { swapStep(undoStack, redoStack, 'Undone'); }
// src/app/paper.js
function redo() { swapStep(redoStack, undoStack, 'Redone'); }
// src/app/paper.js
function swapStep(from, to, said) {
  commitEditors();
  const u = from.pop(); if (!u) return;
  stepping = true;
  try { stepBack(u, to); } finally { stepping = false; }
  renderTools();
  if (u.what) toast(said + ': ' + u.what);   // marks and scores show where they are; a setting may not, so the toast says what came back
}
// src/app/paper.js
function stepBack(u, to) {
  if (u.group) { const back = []; for (const x of u.group.slice().reverse()) stepBack(x, back); to.push(groupStep(back, u.what)); return; }
  if (u.act) { to.push(actStep(u.act.again, u.act.back, u.what)); u.act.back(); return; }
  if (u.keys) return fieldBack(u, to);
  if (u.grade) return gradeBack(u, to);
  scanned = false;
  to.push(stepOf(u.file, u.idx, u.rot !== undefined));
  u.file.marks[u.idx] = JSON.parse(u.before);
  set.selected(null);
  const turned = u.rot !== undefined && (u.rot !== rotOf(u.file, u.idx) || (u.skew || 0) !== skewOf(u.file, u.idx));
  if (turned) { setRot(u.file, u.idx, u.rot); setSkew(u.file, u.idx, u.skew); coverPut(u.file, u.idx, u.cov); thumbCache.clear(); }
  const pg = pages.find(p => p.file === u.file && p.idx === u.idx);
  if (pg) { if (turned) reshape(pg); else draw(pg); }
  else { const si = batch.students.findIndex(s => s.files.includes(u.file)); if (si >= 0 && si !== cur) openStudent(si); }
  if (turned) rescanFile(u.file); else gradeMarksChanged(u.file);
  saveSoon(); renderList(); renderTools();
}
// src/app/paper.js
function setRot(f, p, r) { r = ((r % 360) + 360) % 360; coverTurn(f, p, r - rotOf(f, p)); f.rot ||= {}; if (r) f.rot[p] = r; else delete f.rot[p]; }
// src/app/paper.js
function setSkew(f, p, a) { f.skew ||= {}; if (a) f.skew[p] = a; else delete f.skew[p]; }
// src/app/paper.js
function reshape(pg) {
  const vp = vpRot(pg.file, pg.idx, pg.page, 1);
  pg.W = vp.width; pg.H = vp.height; pg.side = sideScreen(vp.width); pg.covers = null; pg.adj = null; pg.extra = [];
  renderPage(pg); scanNote(pg);
}
// src/app/paper.js
function bindPage(pg) {
  const c = pg.canvas;
  const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / pg.s, (e.clientY - r.top) / pg.s]; };
  const onPage = (x, y) => x >= 0 && x <= pg.W && y >= 0 && y <= pg.H;
  let g = null, gid = -1;   // the gesture in progress, and the pointer it belongs to
  c.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (g && e.pointerId !== gid && ptrLive.has(gid)) return;   // a second finger, or her hand, while a stroke is being drawn: the stroke goes on as it was
    gid = e.pointerId;
    // The open comment's own line can be dragged while its box stays open, even before a word is typed.
    if (activeEditor && activeEditor.note && activeEditor.pg === pg && tool !== 'erase' && !once) {
      const [x, y] = pt(e), own = noteLineAt(pg, x, y);
      if (own === activeEditor.m) { e.preventDefault(); c.setPointerCapture(e.pointerId); g = { line: own, y0: y, ly0: noteRunY(own, pg.H), moved: false, open: activeEditor }; return; }
    }
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
    const pill = tool !== 'erase' && !once ? ansPillAt(pg, x, y) : null;   // an answer note's pill: drag it to point the note elsewhere
    if (pill) { e.preventDefault(); c.setPointerCapture(e.pointerId); g = { move: pill, x, y, moved: false }; return; }
    // A comment's line can be dragged up or down so it runs between lines of writing, not through them.
    const ln = tool !== 'erase' && !once ? noteLineAt(pg, x, y) : null;
    if (ln) { e.preventDefault(); c.setPointerCapture(e.pointerId); g = { line: ln, y0: y, ly0: noteRunY(ln, pg.H), moved: false }; return; }
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
      else { if (selected) { set.selected(null); redrawAll(); } g = { text: true, x0: x, y0: y, x1: x }; }   // click for a box, or drag across to set its width
    } else if (tool === 'note') {
      const hit = hitMark(pg, x, y, 3);
      if (hit && hit.t === 'note') g = pickToGrab(pg, hit, x, y, true);
      else { g = { note: true, x0: x, y0: y, m: null }; noteHlBegin(pg, g); }   // click a point, or drag over words to highlight them
    } else if (tool === 'select') {
      const grip = gripAt(pg, x, y); if (grip) { g = gripBegin(pg, grip); return; }
      const hit = hitMark(pg, x, y, 4), again = !!hit && !!selected && !selected.fresh && selected.mark === hit && (hit.t === 'text' || hit.t === 'note');   // clicking what's already picked opens it
      set.selected(hit ? { page: pg, mark: hit } : null);
      redrawAll();
      if (hit) g = { move: hit, x, y, moved: false, edit: again };
    }
  });
  c.addEventListener('pointermove', e => {
    if (g && e.pointerId !== gid) return;
    if (!g) { const [x, y] = pt(e), cu = hoverCursor(pg, x, y); c.style.cursor = cu || (tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair'); return; }
    const [x, y] = pt(e);
    if (g.line) {
      if (!g.moved) { if (Math.abs(y - g.y0) < 1.5) return; if (!g.open) snap(pg); g.moved = true; }   // an open comment's line is kept with the comment's own step when it's done
      g.line.ly = r1(clamp(g.ly0 + y - g.y0, 2, pg.H - 2));
      pg.lineOn = g.line; draw(pg);
    } else if (g.text) {
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
  const end = e => {
    if (!g || (e && e.pointerId != null && e.pointerId !== gid)) return;
    if (g.line) {
      const m = g.line, moved = g.moved, open = g.open; g = null; pg.lineOn = null;
      if (open) { if (moved && Math.abs(m.ly - m.ay) < 1) delete m.ly; draw(pg); if (activeEditor === open) open.ta.focus({ preventScroll: true }); return; }
      if (moved) { if (Math.abs(m.ly - m.ay) < 1) delete m.ly; changed(pg); } else draw(pg);
      return;
    }
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
  c.addEventListener('pointerleave', () => { if (!g && (pg.lineOn || pg.noteOn)) { pg.lineOn = null; pg.noteOn = null; draw(pg); } });
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
  // A second finger came down (touch.js): a line, a circle or a box only just begun is taken back; anything else ends where it is.
  c.addEventListener('gsdrop', () => { if (!g) return; if (g.m || g.text || g.note) { g = null; pg.ghost = null; draw(pg); } else end(); });
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
// src/app/paper.js
const r1 = v => Math.round(v * 10) / 10;
// src/app/paper.js
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// src/app/paper.js
function moveMark(m, dx, dy) {
  if (m.t === 'pen') m.pts = m.pts.map(q => keepP([r1(q[0] + dx), r1(q[1] + dy)], q));
  else if (m.t === 'note') { m.ax = r1(m.ax + dx); m.ay = r1(m.ay + dy); if (m.ly != null) m.ly = r1(m.ly + dy); if (m.hl) m.hl = { ...m.hl, x: r1(m.hl.x + dx), y: r1(m.hl.y + dy) }; moveExtras(m, dx, dy); }
  else { m.x = r1(m.x + dx); m.y = r1(m.y + dy); moveExtras(m, dx, dy); }
}
// src/app/paper.js
function eraseAt(pg, x, y, g) {
  const hit = hitMark(pg, x, y, 3);
  if (!hit) return;
  if (!g.snapped) { snap(pg); g.snapped = true; }
  const a = pg.marks(); a.splice(a.indexOf(hit), 1);
  changed(pg);
}
// src/app/paper.js
function deleteSelected() {
  if (!selected) return;
  const pg = selected.page, a = pg.marks(), i = a.indexOf(selected.mark);
  if (i >= 0) { snap(pg); a.splice(i, 1); }
  set.selected(null); changed(pg);
}
// src/app/paper.js
function commitEditors() { if (activeEditor) { const a = activeEditor; set.activeEditor(null); a.commit(); } }
// src/app/panels.js
let rowOn = -1, rowOnOf = null, rowKeyed = -1;
// src/app/gradesheet.js
let scanned = false;
// src/app/claude.js
const boxKey = (path, p) => path + '|' + p;
// src/marking.js
const keepP = (n, q) => q.length > 2 ? [n[0], n[1], q[2]] : n;
// src/marking.js
const pressOn = () => store.get('gs.press', true) !== false;
// src/marking.js
const pressOf = e => e.pointerType === 'pen' && e.pressure > 0 ? Math.round(clamp(e.pressure, 0.05, 1) * 100) / 100 : null;
// src/marking.js
const rectBox = rs => { const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y)); return { x, y, w: r1(Math.max(...rs.map(r => r.x + r.w)) - x), h: r1(Math.max(...rs.map(r => r.y + r.h)) - y) }; };
// src/marking.js
function moveExtras(m, dx, dy) {
  if (m.rects) m.rects = m.rects.map(r => ({ ...r, x: r1(r.x + dx), y: r1(r.y + dy) }));
  if (m.pts) m.pts = m.pts.map(([x, y]) => [r1(x + dx), r1(y + dy)]);
}
// src/marking.js
const inRect = (r, x, y, slop) => x >= r.x - slop && x <= r.x + r.w + slop && y >= r.y - slop && y <= r.y + r.h + slop;
// src/marking.js
function strokeHit(p, x, y, reach) {
  for (let j = 0; j < p.length; j++) if (distToSeg(x, y, p[j], p[Math.min(j + 1, p.length - 1)]) <= reach) return true;
  return false;
}
// src/marking.js
function hitShape(m, x, y, slop, W) {
  if (m.t === 'pen') return strokeHit(m.pts, x, y, m.w * (hasPress(m.pts) ? PRESS_MAX : 1) / 2 + slop);
  if (m.pts) return strokeHit(m.pts, x, y, m.sw / 2 + slop);
  if (m.rects) return m.rects.some(r => inRect(r, x, y, slop));
  if (m.t === 'text' && !(selected && selected.mark === m && !selected.fresh)) { const L = textLayout(m, W); return inRect({ x: m.x, y: m.y, w: Math.max(L.ink, 30), h: L.h }, x, y, slop); }   // the words, not the empty part of a wide box
  return null;
}
// src/marking.js
const INK_STRING = 0.8, INK_SLOW_HZ = 6, INK_SPEED = 0.08, INK_DRIFT_HZ = 12;
// src/marking.js
function inkFilter() {
  let sx, sy, x0, y0, t0, vx = 0, vy = 0;
  const pull = (hz, dt) => { const r = 2 * Math.PI * hz * dt; return r / (r + 1); };
  return (x, y, t) => {
    if (x0 == null) { sx = x0 = x; sy = y0 = y; t0 = t; return [x, y]; }
    const d = Math.hypot(x - sx, y - sy);
    if (d > INK_STRING) { sx += (x - sx) * (d - INK_STRING) / d; sy += (y - sy) * (d - INK_STRING) / d; }
    const dt = clamp((t - t0) / 1000, 0.001, 0.05), av = pull(INK_DRIFT_HZ, dt);
    vx += av * ((sx - x0) / dt - vx); vy += av * ((sy - y0) / dt - vy);
    const a = pull(INK_SLOW_HZ + INK_SPEED * Math.hypot(vx, vy), dt);
    x0 += a * (sx - x0); y0 += a * (sy - y0); t0 = t;
    return [x0, y0];
  };
}
// src/marking.js
function thinStroke(p, tol, gap) {
  if (p.length < 3) return p;
  const out = [p[0]];
  let a = 0;
  for (let i = 1; i < p.length - 1; i++) {
    let ok = Math.hypot(p[i + 1][0] - p[a][0], p[i + 1][1] - p[a][1]) <= gap;
    for (let j = a + 1; ok && j <= i; j++) ok = distToSeg(p[j][0], p[j][1], p[a], p[i + 1]) <= tol;
    if (!ok) { out.push(p[i]); a = i; }
  }
  out.push(p[p.length - 1]);
  return out;
}
// src/marking.js
const inkBegin = (m, x, y, e, s) => { const f = inkFilter(); f(x * s, y * s, e.timeStamp); const pr = m.t === 'pen' && pressOn() ? pressOf(e) : null; if (pr != null) m.pts[0].push(pr); return { m, f, raw: null, press: pr != null, pr }; };
// src/marking.js
function inkMove(pg, g, e, at) {
  const p = g.m.pts, s = pg.s, n0 = p.length, was = g.raw, all = e.getCoalescedEvents ? e.getCoalescedEvents() : [], list = all.length ? all : [e];
  const step = Math.min(0.7, 1 / s);
  for (const q of list) {
    const [ax, ay] = at(q), x = clamp(ax, 0, pg.W), y = clamp(ay, 0, pg.H), [fx, fy] = g.f(x * s, y * s, q.timeStamp);
    g.raw = [r1(x), r1(y)];
    if (g.press) { const pr = pressOf(q); if (pr != null) g.pr = pr; g.raw.push(g.pr); }
    if (e.shiftKey) continue;
    const last = p[p.length - 1];
    if (Math.hypot(fx / s - last[0], fy / s - last[1]) > step) p.push(g.press ? [r1(fx / s), r1(fy / s), g.pr] : [r1(fx / s), r1(fy / s)]);
  }
  if (e.shiftKey) {   // Shift: a straight line, level or upright when it's close
    const pt = g.raw, dx = Math.abs(pt[0] - p[0][0]), dy = Math.abs(pt[1] - p[0][1]);
    if (dy < dx * 0.15) pt[1] = p[0][1]; else if (dx < dy * 0.15) pt[0] = p[0][0];
    g.m.pts = [p[0], pt]; g.raw = null; g.straight = true;
    draw(pg, [g.m]);
    return;
  }
  if (g.straight) { g.straight = false; draw(pg, [g.m]); return; }   // Shift let go: the straight line just drawn goes away
  // Only the end of the stroke changes, so only that part of the page is drawn again.
  const pad = (g.m.t === 'pen' ? g.m.w * (g.press ? PRESS_MAX : 1) : g.m.sw) / 2 + 2, near = p.slice(Math.max(0, n0 - 3)).concat(was ? [was] : [], g.raw ? [g.raw] : []);
  const xs = near.map(q => q[0]), ys = near.map(q => q[1]), x1 = Math.min(...xs) - pad, y1 = Math.min(...ys) - pad;
  // The line runs on to the pointer, so it never seems to lag behind the hand.
  if (g.raw) p.push(g.raw);
  draw(pg, [g.m], { x: x1, y: y1, w: Math.max(...xs) + pad - x1, h: Math.max(...ys) + pad - y1 });
  if (g.raw) p.pop();
}
// src/marking.js
function inkEnd(pg, g) {
  const p = g.m.pts;
  if (g.raw && !g.straight) { const l = p[p.length - 1]; if (l[0] !== g.raw[0] || l[1] !== g.raw[1]) p.push(g.raw); }   // ends where she let go
  g.m.pts = thinStroke(p, Math.min(0.12, 0.4 / pg.s), 6);
  if (g.press) {
    // A press that never changed is a pencil that can't tell: the line is kept as an even one. Otherwise the press is evened out a little, so the width doesn't step.
    const q = g.m.pts, v = q.map(a => a[2] == null ? 0.5 : a[2]);
    if (Math.max(...v) - Math.min(...v) < 0.06) g.m.pts = q.map(a => [a[0], a[1]]);
    else g.m.pts = q.map((a, i) => [a[0], a[1], Math.round((v[Math.max(0, i - 1)] + v[i] * 2 + v[Math.min(v.length - 1, i + 1)]) / 4 * 100) / 100]);
  }
}
// src/marking.js
const segFar = (s, x, y) => [y < s.top ? s.top - y : y > s.bot ? y - s.bot : 0, x < s.x0 ? s.x0 - x : x > s.x1 ? x - s.x1 : 0];
// src/marking.js
function nearestSeg(segs, x, y, keep) {
  let best = -1, bd = 1e9;
  segs.forEach((s, i) => { const [dy, dx] = segFar(s, x, y), across = keep == null ? dx * 0.2 : Math.min(dx * 0.2, s.fh * 0.35), d = dy + across - (i === keep ? s.fh * 0.3 : 0); if (d < bd) { bd = d; best = i; } });   // a wobbly drag stays on its line
  return best;
}
// src/marking.js
function lineAt(pg, x, y) {
  if (hlMode === 'free' || !pg.tl || !pg.tl.length) return -1;
  const i = nearestSeg(pg.tl, x, y);
  if (i < 0) return -1;
  const [dy, dx] = segFar(pg.tl[i], x, y);
  return dy <= pg.tl[i].fh * 0.75 && dx <= 24 ? i : -1;
}
// src/marking.js
const wordAt = (s, x) => { let b = s.words[0], bd = 1e9; for (const w of s.words) { const d = x < w[0] ? w[0] - x : x > w[1] ? x - w[1] : 0; if (d < bd) { bd = d; b = w; } } return b; };
// src/marking.js
function snapRects(segs, a, ax, b, bx) {
  if (b < a) { [a, ax, b, bx] = [b, bx, a, ax]; }
  const L = Math.min(segs[a].x0, segs[b].x0), R = Math.max(segs[a].x1, segs[b].x1), out = [];
  for (let i = a; i <= b; i++) {
    const s = segs[i];
    if (i !== a && i !== b && (s.x1 < L || s.x0 > R)) continue;   // another column
    let x0 = i === a ? wordAt(s, ax)[0] : s.x0, x1 = i === b ? wordAt(s, bx)[1] : s.x1;
    if (a === b) { const u = wordAt(s, Math.min(ax, bx)), v = wordAt(s, Math.max(ax, bx)); x0 = u[0]; x1 = v[1]; }
    out.push({ x: r1(x0 - 1), y: r1(s.top), w: r1(x1 - x0 + 2), h: r1(s.bot - s.top) });
  }
  return out;
}
// src/marking.js
function setRects(m, rects) {
  Object.assign(m, rectBox(rects));
  if (rects.length > 1) m.rects = rects; else delete m.rects;
  return m;
}
// src/marking.js
let hlMode = store.get('gs.hlMode', 'auto'), hlW = store.get('gs.hlW', 14);   // 'auto' snaps to typed lines where there are any; 'free' never does
// src/marking.js
function hlBegin(pg, x, y, e) {
  const color = HL[hlColor], a = lineAt(pg, x, y);
  if (a >= 0) return { snapHl: true, a, x0: x, y0: y, m: setRects({ t: 'hl', color }, snapRects(pg.tl, a, x, a, x)) };
  return { ...inkBegin({ t: 'hl', color, sw: hlW, pts: [[r1(x), r1(y)]], x, y, w: 0, h: 0 }, x, y, e, pg.s), x0: x, y0: y };
}
// src/marking.js
function hlMove(pg, g, e, at) {
  if (!g.snapHl) { inkMove(pg, g, e, at); return; }
  const [x, y] = at(e), b = nearestSeg(pg.tl, clamp(x, 0, pg.W), clamp(y, 0, pg.H), g.a);
  setRects(g.m, snapRects(pg.tl, g.a, g.x0, b, x));
  draw(pg, [g.m]);
}
// src/marking.js
function hlEnd(pg, g) {
  if (g.snapHl) return;
  const m = g.m;
  inkEnd(pg, g);
  if (m.pts.length < 2 || Math.max(...m.pts.map(q => Math.hypot(q[0] - g.x0, q[1] - g.y0))) < 3) {   // a click: one line-height strip, as it has always been
    delete m.pts; delete m.sw;
    Object.assign(m, { x: r1(g.x0 - 30), y: r1(g.y0 - 7), w: 60, h: 14 });
    return;
  }
  const xs = m.pts.map(q => q[0]), ys = m.pts.map(q => q[1]), x = r1(Math.min(...xs) - m.sw / 2), y = r1(Math.min(...ys) - m.sw / 2);
  Object.assign(m, { x, y, w: r1(Math.max(...xs) + m.sw / 2 - x), h: r1(Math.max(...ys) + m.sw / 2 - y) });
}
// src/marking.js
function noteHlBegin(pg, g) {
  const a = lineAt(pg, g.x0, g.y0);
  if (a >= 0) { g.snapA = a; g.m = setRects({ t: 'hl', color: HL[hlColor] }, snapRects(pg.tl, a, g.x0, a, g.x0)); }
}
// src/marking.js
function noteHlMove(pg, g, x, y) {
  setRects(g.m, snapRects(pg.tl, g.snapA, g.x0, nearestSeg(pg.tl, x, y, g.snapA), x));
}
// src/marking.js
function noteFromSnap(g, color) {
  const rects = g.m.rects || [{ x: g.m.x, y: g.m.y, w: g.m.w, h: g.m.h }], last = rects[rects.length - 1];
  const m = { t: 'note', color, ax: r1(last.x + last.w), ay: r1(last.y + last.h), hl: rectBox(rects), hc: g.m.color, text: '' };
  if (rects.length > 1) m.rects = rects;
  return m;
}
// src/marking.js
const newTextW = (pg, x) => r1(Math.min(Math.max(200, pg.W * 0.4), pg.W - x - 6));
// src/marking.js
function gripAt(pg, x, y) {
  if (!selected || selected.page !== pg || selected.mark.t !== 'text') return '';
  const h = textGrips(selected.mark, pg.W), near = 8 / pg.s;
  if (y < h.top - near || y > h.bottom + near) return '';
  return Math.abs(x - h.r) < near ? 'r' : Math.abs(x - h.l) < near ? 'l' : '';
}
// src/marking.js
function gripBegin(pg, side) {
  const m = selected.mark, bb = bboxOf(m, pg.W);
  return { resize: m, moved: false, side, right: bb.x + bb.w };
}
// src/marking.js
function gripMove(pg, g, x) {
  const m = g.resize;
  delete m.bwFull;   // she's set the width herself
  if (g.side === 'l') { m.x = r1(clamp(x + 3, 0, g.right - 24)); m.bw = r1(g.right - m.x); }   // the grips sit 3 points outside the box
  else m.bw = r1(clamp(x - 3 - m.x, 24, pg.W - m.x - 6));
}
// src/marking.js
function cornerAt(pg, x, y) {
  if (!selected || selected.page !== pg || !canResize(selected.mark) || pg.editing === selected.mark) return null;
  const m = selected.mark, [cx, cy] = cornerPt(m, pg.W);
  if (Math.hypot(x - cx, y - cy) > 9 / pg.s) return null;
  const mid = [m.x, m.y];   // text grows from its top-left corner, stickers, marks and checks from their middle (circles use the drag itself)
  return { scale: m, moved: false, mid, d0: Math.max(4, Math.hypot(x - mid[0], y - mid[1])), size0: m.size || (m.t === 'check' ? 22 : 16), bw0: m.bw, x0: x, y0: y, w0: m.w, h0: m.h };
}
// src/marking.js
const SIZE_RANGE = m => m.t === 'text' ? [8, 40] : m.t === 'check' ? SIZE_LIMITS.check : SIZE_LIMITS[sizeKind(m.k)];
// src/marking.js
function setMarkSize(m, size, W, H, g) {
  const [a, b] = SIZE_RANGE(m), was = m.size;
  m.size = m.t === 'text' ? Math.round(clamp(size, a, b)) : r1(clamp(size, a, b));
  if (m.t === 'text') { const bw0 = g ? g.bw0 : m.bw, s0 = g ? g.size0 : was; if (bw0) { delete m.bwFull; m.bw = r1(clamp(bw0 * m.size / s0, 24, W - m.x - 6)); } keepOnPage(m, W, H); }
}
// src/marking.js
function cornerMove(pg, g, x, y) {
  const m = g.scale;
  if (m.t === 'oval') { m.w = r1(clamp(g.w0 + x - g.x0, 6, pg.W - m.x)); m.h = r1(clamp(g.h0 + y - g.y0, 6, pg.H - m.y)); return; }
  setMarkSize(m, g.size0 * Math.hypot(x - g.mid[0], y - g.mid[1]) / g.d0, pg.W, pg.H, g);
}
// src/marking.js
function rememberSize(m) {
  if (m.t === 'stamp') rememberStampSize(m);
  else if (m.t === 'text') { disp.tsize = m.size; store.set('gs.disp', disp); }
  else if (m.t === 'check') rememberSizeOf('$check', m.size);
}
// src/marking.js
function stepSize(dir) {
  if (!selected || !canResize(selected.mark)) return false;
  const pg = selected.page, m = selected.mark;
  snap(pg);
  if (m.t === 'oval') { const f = dir > 0 ? 1.15 : 1 / 1.15, cx = m.x + m.w / 2, cy = m.y + m.h / 2; m.w = r1(clamp(m.w * f, 6, pg.W)); m.h = r1(clamp(m.h * f, 6, pg.H)); m.x = r1(clamp(cx - m.w / 2, 0, pg.W - m.w)); m.y = r1(clamp(cy - m.h / 2, 0, pg.H - m.h)); }
  else if (m.t === 'text') setMarkSize(m, m.size + 2 * dir, pg.W, pg.H);
  else setMarkSize(m, m.size * (dir > 0 ? 1.15 : 1 / 1.15), pg.W, pg.H);
  rememberSize(m); changed(pg);
  return true;
}
// src/marking.js
function clickToPick(pg, x, y) {
  if (tool === 'select' || tool === 'erase') return null;
  const hit = hitMark(pg, x, y, 2);
  if (!hit || hit.ro) return null;
  if (hit.t === 'text') return tool === 'text' ? null : (setTool('text'), pickToGrab(pg, hit, x, y, true));
  if (hit.t === 'oval') {   // only its line: drawing inside a circle still draws
    const rx = hit.w / 2, ry = hit.h / 2, d = Math.hypot((x - hit.x - rx) / rx, (y - hit.y - ry) / ry);
    if (Math.abs(d - 1) * Math.min(rx, ry) > 4) return null;
  } else if (hit.t !== 'stamp' && hit.t !== 'check') return null;
  setTool('select');
  return pickToGrab(pg, hit, x, y, false);
}
// src/marking.js
function pickToGrab(pg, hit, x, y, edit) {
  set.selected({ page: pg, mark: hit });
  redrawAll();
  return { move: hit, x, y, moved: false, edit };
}
// src/marking.js
const editMark = (pg, m) => { if (m.t === 'text') editText(pg, m); else if (m.t === 'note') openNote(pg, m); };
// src/marking.js
function noteLineAt(pg, x, y) {
  const tol = Math.max(3, 5 / (pg.s || 1)), W = pg.W;
  for (const b of pg.boxes || []) {
    if (b.n.ro) continue;
    if (x <= W + 4) {
      if ((tool === 'select' || tool === 'note') && x >= b.ax + 8 && Math.abs(y - b.ry) <= tol) return b.n;
      continue;
    }
    const x1 = W + 4, y1 = b.ry, x2 = b.x, y2 = b.y + Math.min(b.h / 2, 12), dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L)) : 0;
    if (Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) <= tol) return b.n;
  }
  return null;
}
// src/marking.js
function ansNoteAt(pg, x, y) {
  for (const b of pg.boxes || []) if (b.n.qza && !b.n.ro && (x >= b.x && x <= b.x + b.w && y >= b.y - 5 && y <= b.y + b.h)) return b.n;
  return ansPillAt(pg, x, y);
}
// src/marking.js
function ansPillAt(pg, x, y) {
  const tol = Math.max(7, 9 / (pg.s || 1));
  for (const b of pg.boxes || []) if (b.n.qza && !b.n.ro && Math.abs(x - b.ax) <= tol + 4 && Math.abs(y - b.ay) <= tol) return b.n;
  return null;
}
// src/marking.js
function hoverCursor(pg, x, y) {
  const hot = ansNoteAt(pg, x, y);
  if ((pg.noteOn || null) !== hot) { pg.noteOn = hot; draw(pg); }   // its question's box and its line light up, to show which answer is whose
  if (tool !== 'erase' && !once && ansPillAt(pg, x, y)) return 'move';
  const ln = tool !== 'erase' && !once ? noteLineAt(pg, x, y) : null;
  if ((pg.lineOn || null) !== ln) { pg.lineOn = ln; draw(pg); }   // the line thickens under the pointer, to show it can be dragged
  if (ln) return 'ns-resize';
  if (tool !== 'erase' && cornerAt(pg, x, y)) return 'nwse-resize';
  const grip = gripAt(pg, x, y);
  if (tool === 'select') return grip ? 'ew-resize' : hitMark(pg, x, y, 4) ? (x > pg.W ? 'pointer' : 'move') : 'default';
  if (tool === 'text') { const h = hitMark(pg, x, y, 3); return grip ? 'ew-resize' : h && h.t === 'text' ? 'move' : h && x > pg.W ? 'pointer' : 'text'; }
  if (tool === 'note') { const h = hitMark(pg, x, y, 3); return h && h.t === 'note' ? (x > pg.W ? 'pointer' : 'move') : 'crosshair'; }
  if (tool === 'hl') return lineAt(pg, x, y) >= 0 ? 'text' : 'crosshair';
  return '';
}
// src/marking.js
function gripDrag(e, bar, pg, m, fit, ta) {
  const r = pg.canvas.getBoundingClientRect(), s = pg.s, ox = (e.clientX - r.left) / s - m.x, oy = (e.clientY - r.top) / s - m.y;
  bar.setPointerCapture(e.pointerId);
  const mv = ev => { m.x = r1((ev.clientX - r.left) / s - ox); m.y = r1((ev.clientY - r.top) / s - oy); keepOnPage(m, pg.W, pg.H); fit(); };
  const up = () => { bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); ta.focus(); };
  bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
}
// src/stamps.js
const PROOF = [
  ['gr', 'Grammar'], ['cap', 'Capitalize'], ['lower', 'Make lowercase'], ['insert', 'Insert'], ['para', 'New paragraph'],
  ['delete', 'Delete'], ['swap', 'Swap order'], ['space', 'Add a space'], ['close', 'Close up'],
  ['sp', 'Spelling'], ['ro', 'Run-on'], ['frag', 'Fragment'],
  ['wc', 'Word choice'], ['awk', 'Awkward'], ['vt', 'Verb tense'], ['unclear', 'Unclear'],
];
// src/stamps.js
const PUNCT = [
  ['period', 'Add a period', 'Period'], ['comma', 'Add a comma', 'Comma'], ['apos', 'Add an apostrophe', 'Apostrophe'], ['quote', 'Add quotation marks', 'Quotes'], ['semi', 'Add a semicolon', 'Semicolon'],
  ['colon', 'Add a colon', 'Colon'], ['qmark', 'Add a question mark', 'Question'], ['excl', 'Add an exclamation mark', 'Exclamation'], ['hyphen', 'Add a hyphen', 'Hyphen'], ['dash', 'Add a dash', 'Dash'],
];
// src/stamps.js
const isProof = k => PROOF.some(p => p[0] === k) || PUNCT.some(p => p[0] === k);
// src/stamps.js
const BRAINROT = new Set(['cat', 'skull', 'frog']);
// src/stamps.js
const stampName = k => k === 'crit' ? 'Criterion score' : isProof(k) ? markLabel(k) : ((STICKERS.find(p => p[0] === k)) || [k, k])[1];
// src/stamps.js
const MARK_KEY = 'gs.markKey';
// src/stamps.js
const keySet = () => { const v = store.get(MARK_KEY, null); return v && typeof v === 'object' ? v : {}; };
// src/stamps.js
const markLabel0 = k => ((PROOF.find(p => p[0] === k) || PUNCT.find(p => p[0] === k)) || [k, k])[1];
// src/stamps.js
const markLabel = k => { const v = (keySet().names || {})[k]; return typeof v === 'string' && v.trim() ? v.trim() : markLabel0(k); };
// src/stamps.js
const MARK_SIZES = 'gs.markSizes', SIZE0 = { proof: 16, sticker: 44, score: 52, crit: 40 };
// src/stamps.js
const sizeKind = k => isSticker(k) ? 'sticker' : k === 'crit' ? 'crit' : isScoreStamp(k) ? 'score' : 'proof';
// src/stamps.js
const SIZE_LIMITS = { proof: [8, 80], sticker: [16, 240], check: [8, 120], score: [20, 160], crit: [16, 160] };
// src/stamps.js
const sizesHere = () => { const all = store.get(MARK_SIZES, {}) || {}; return (batch && all[batch.id]) || {}; };
// src/stamps.js
function lastSize(key, lim, dflt) { const v = +sizesHere()[key]; return v >= lim[0] && v <= lim[1] ? v : dflt; }
// src/stamps.js
const newStampSize = k => lastSize(k, SIZE_LIMITS[sizeKind(k)], SIZE0[sizeKind(k)]);
// src/stamps.js
const newCheckSize = () => lastSize('$check', SIZE_LIMITS.check, 22);
// src/stamps.js
function rememberSizeOf(key, size) {
  if (!batch) return;
  const all = { ...(store.get(MARK_SIZES, {}) || {}) }, mine = { ...(all[batch.id] || {}), [key]: size, at: Date.now() };
  delete all[batch.id];
  const keep = Object.entries(all).filter(([, v]) => v && typeof v === 'object').sort((p, q) => (q[1].at || 0) - (p[1].at || 0)).slice(0, 11);
  store.set(MARK_SIZES, Object.fromEntries([[batch.id, mine], ...keep]));
}
// src/stamps.js
const rememberStampSize = m => rememberSizeOf(m.k, m.size);
// src/stamps.js
const RECENT_STAMPS = 'gs.recentStamps';
// src/stamps.js
function placeStamp(pg, k, x, y) {
  const m = isSticker(k) ? { t: 'stamp', k, x: r1(x), y: r1(y), size: newStampSize(k), rot: Math.round((Math.random() * 10 - 5) * 10) / 10 } : { t: 'stamp', k, x: r1(x), y: r1(y), size: newStampSize(k), color: COLORS[inkColor] };
  const bb = stampBox(m);   // keep it on the page
  m.x = r1(m.x + Math.max(0, -bb.x) - Math.max(0, bb.x + bb.w - pg.W)); m.y = r1(m.y + Math.max(0, -bb.y) - Math.max(0, bb.y + bb.h - pg.H));
  snap(pg); pg.marks().push(m); changed(pg);
  const recent = [k, ...store.get(RECENT_STAMPS, []).filter(r => r !== k && (isSticker(r) || isProof(r)))].slice(0, 6);
  store.set(RECENT_STAMPS, recent);
  return m;
}
// src/stamps.js
function wordUnder(pg, x, y) {
  if (!pg.tl || !pg.tl.length) return null;
  const i = nearestSeg(pg.tl, x, y); if (i < 0) return null;
  const s = pg.tl[i]; if (segFar(s, x, y)[0] > s.fh * 0.5) return null;
  const w = wordAt(s, x); if (!w || x < w[0] - 4 || x > w[1] + 4) return null;
  return { i, s, w };
}
// src/stamps.js
function circleWord(pg, u) {
  const { s, w } = u, px = Math.max(3, s.fh * 0.35), py = s.fh * 0.3;
  const m = { t: 'oval', color: COLORS[inkColor], sw: Math.max(1.2, penW * 0.8), x: r1(w[0] - px), y: r1(s.top - py), w: r1(w[1] - w[0] + px * 2), h: r1(s.bot - s.top + py * 2) };
  snap(pg); pg.marks().push(m); changed(pg); return m;
}
// src/stamps.js
function highlightWord(pg, u, x) {
  const m = setRects({ t: 'hl', color: HL[hlColor] }, snapRects(pg.tl, u.i, x, u.i, x));
  snap(pg); pg.marks().push(m); changed(pg); return m;
}
// src/stamps.js
function textBoxHere(pg, x, y) {
  const m = { t: 'text', color: COLORS[inkColor], x: r1(Math.min(x, pg.W - 106)), y: r1(y - disp.tsize / 2), size: disp.tsize, text: '' };
  m.bw = newTextW(pg, m.x); keepOnPage(m, pg.W, pg.H);
  snap(pg); pg.marks().push(m); editText(pg, m, true);
}
// src/grades.js
const hasSheet = g => g.sheet != null && g.sheet !== '';
// src/saving.js
const saveBad = new Map();   // download id: { b, data, ls }, the latest work that didn't get saved
// src/intake.js
const photoHasWork = f => Object.values(f.marks).some(a => a.length) || !!f.hand || !!batch.share?.boxes?.[boxKey(f.path, 0)]?.length;
// src/intake.js
function rotToSave(f) {
  const r = f.rot && Object.keys(f.rot).length ? f.rot : null;
  if (!f.photoTurn) return r;
  if (!r) return { 0: 0 };   // she turned it back to how the camera left it, or it's old work drawn on it that way
  return r[0] === f.photoTurn && !photoHasWork(f) ? null : r;
}
// src/insight.js
function paperReads() {
  const r = {}, was = batch.read || {};
  for (const st of batch.students) {
    const f = st.found;
    if (f === undefined) { if (was[st.key]) r[st.key] = was[st.key]; }
    else if (f && f.found && (f.score != null || f.pct != null)) r[st.key] = { score: f.score, outOf: f.outOf, pct: f.pct };
  }
  return Object.keys(r).length ? r : undefined;
}
// src/insight.js
function coverTurn(f, p, by) {
  const sh = batch && batch.share, k = boxKey(f.path, p), fx = v => Math.round(v * 10000) / 10000;
  if (!sh || !by) return;
  if (sh.checked) delete sh.checked[k];
  const list = (sh.boxes && sh.boxes[k]) || [];
  const off = (sh.off && sh.off[k]) || [];
  for (let n = (by + 360) % 360; n > 0; n -= 90) for (const b of list.concat(off)) [b[0], b[1], b[2], b[3]] = [fx(1 - b[1] - b[3]), b[0], b[3], b[2]];
}
// src/insight.js
function coverAgain(path, p) { const sh = batch && batch.share; if (sh && sh.checked) delete sh.checked[boxKey(path, p)]; }
// src/insight.js
function coverCopy(f, p) { const sh = batch && batch.share, b = sh && sh.boxes && sh.boxes[boxKey(f.path, p)]; return b ? JSON.stringify(b) : null; }
// src/insight.js
function coverPut(f, p, was) {
  const sh = batch && batch.share; if (!sh || !sh.boxes) return;
  const k = boxKey(f.path, p);
  if ((sh.boxes[k] ? JSON.stringify(sh.boxes[k]) : null) === was) return;
  coverAgain(f.path, p);
  if (was) sh.boxes[k] = JSON.parse(was); else delete sh.boxes[k];
}
// src/scans.js
const scanMine = (f, did, p, v) => { const r = f.sc && f.sc[p]; return !(r && r[did] === v && !(f.marks[p] || []).length); };
// src/scans.js
function scanOwn(st, part, did, pick) {
  const out = {};
  for (const f of st.files) { const all = pick ? pick(f) : f[part]; if (all) { const o = {}; for (const [p, v] of Object.entries(all)) if (scanMine(f, did, p, v)) o[p] = v; if (Object.keys(o).length) out[f.path] = o; } }
  return out;
}
// src/scans.js
function scanSave() {
  const out = {}; let any = false;
  for (const st of batch.students) for (const f of st.files) {
    if (!f.sc) continue;
    const rec = {}, at = {};
    for (const [p, r] of Object.entries(f.sc)) {
      if (r.typed && !r.re && !r.w) continue;
      rec[p] = r;
      const o = {};
      if (r.didTurn && rotOf(f, p) === r.didTurn && !scanMine(f, 'didTurn', p, r.didTurn)) o.r = r.didTurn;
      if (r.didSkew && skewOf(f, p) === r.didSkew && !scanMine(f, 'didSkew', p, r.didSkew)) o.k = r.didSkew;
      if (o.r || o.k) at[p] = o;
    }
    if (Object.keys(rec).length) { out[f.path] = { rec, at }; any = true; }
  }
  return any ? out : undefined;
}
// src/groups.js
function groupOf(st) { return (st && batch && (batch.groups || []).find(g => g.k.includes(st.key))) || null; }
// src/groups.js
function groupFileOf(g, st) { const p = g.p && g.p[st.key]; return p ? st.files.find(f => f.path === p) || null : null; }
// src/groups.js
const groupOwn = g => !!(g && g.own);
// src/groups.js
let groupJust = null;
// src/groups.js
const groupJustOn = st => !!(st && groupJust === st.key && groupOwn(groupOf(st)) && groupFileOf(groupOf(st), st));
// src/groups.js
function justSeen(pg) { pg.seen = groupJustOn(batch.students[cur]) ? new Set(pg.marks()) : null; }
// src/groups.js
function justTag(pg) { if (!pg.seen || !groupJustOn(batch.students[cur])) return; for (const m of pg.marks()) if (!pg.seen.has(m) && !m.o) m.o = groupJust; pg.seen = null; }
// src/groups.js
const groupsSave = own => { const l = (batch.groups || []).filter(g => groupOwn(g) === own); return l.length ? l : undefined; };
// src/touch.js
const ptrLive = new Set();   // every pointer that is down now, for bindPage to know its own gesture is still going
export { bindPage, undo, redo, snap, changed, pushUndo, gradeSnap, fieldSnap, commitEditors, stepSize, saveNow, placeStamp, redrawAll, hitMark, moveMark, keepOnPage, deleteSelected, gripDrag, r1, clamp, circleWord, highlightWord, textBoxHere, stampName, isSticker, isProof, PROOF, PUNCT, BRAINROT, wordUnder, newCheckSize, stickerAspect, RECENT_STAMPS };
