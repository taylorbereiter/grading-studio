// Marking on the new screen: the current app's own marking code (engines/gmark.js, lifted from src/app/paper.js bindPage,
// src/marking.js, src/stamps.js) does the work on page objects of today's shape. This file hands it what belongs to the screen:
// how to show a change (the toolbar, the list), how to say something (a toast), how to type a text box or a comment
// (mark/editors.js), and where a save goes. The lifted saveNow builds the same record the current app builds and hands it to
// writeWork, which saves it through students/write.js saveWork: the only way the new app writes a download's work.
import { saveFailed, saveWorked, addFlush } from '../saving/trouble.js';
import * as K from '../../engines/gmark.js';
import { use, state, COLORS, setCheckInk, rowSteps, rowTop, roundPct, pointsFor, gradeOf, totalInk } from '../../engines/gcore.js';
import { bboxOf, stampBox, drawStamp } from '../../engines/gdraw.js';
import { prefs } from '../../students/prefs.js';
import { PARTS } from '../router.js';
import { editText, openNote } from './editors.js';
import { renderPage } from './paper.js';
import * as undoList from '../../services/undo.js';
import { t } from '../../i18n/t.js';
import './lines.js';
import '../engine-lines.js';   // the engines' own words (feedback page, typed notes' bar, Quick mark) in the language
import { setOpenFlush } from '../openwork.js';

let saveT = null, saveSeq = 0, listeners = new Set(), saveState = 'saved';
const tell = () => listeners.forEach(f => f());
// The screen listens for "something changed": it redraws the toolbar, the list and the save label from state.
export const onMarking = f => { listeners.add(f); return () => listeners.delete(f); };
export const saveLabel = () => saveState;

// The tool, colours and widths she chose last time (the current app's own keys).
export function loadTools() {
  const o = {};
  const ink = prefs.get('gs.ink', null), hl = prefs.get('gs.hl', null), w = prefs.get('gs.penW', null), chk = prefs.get('gs.checkInk', null), disp = prefs.get('gs.disp', null);
  if (ink) o.inkColor = ink; if (hl) o.hlColor = hl; if (w) o.penW = +w; if (chk) o.checkInk = chk;
  const pts = prefs.get('gs.ptsInk', ''); o.ptsInk = pts === 'credit' || COLORS[pts] ? pts : '';   // how points are written (Settings > Marking)
  o.disp = { tsize: 14, ...(state().disp || {}), ...(disp || {}) };
  use(o);
  const { checkInk } = state();
  if (checkInk) setCheckInk(checkInk);
}
export function chooseTool(t) { K.commitEditors(); stampOn = false; const s = state(); if (s.once) use({ once: null }); use({ tool: t }); if (t !== 'select') { use({ selected: null }); K.redrawAll(); } tell(); }
export function chooseInk(k) { use({ inkColor: k }); prefs.set('gs.ink', k); const s = state(); if (s.selected && !s.selected.fresh && s.selected.mark.t !== 'hl' && s.selected.mark.t !== 'check') { K.snap(s.selected.page); s.selected.mark.color = COLORS[k]; K.changed(s.selected.page); } tell(); }
export function chooseHl(k) { use({ hlColor: k }); prefs.set('gs.hl', k); tell(); }
export function chooseWidth(w) { use({ penW: w }); prefs.set('gs.penW', w); tell(); }
export function chooseCheck(k) { setCheckInk(k); prefs.set('gs.checkInk', k); K.redrawAll(); tell(); }
export const commit = () => K.commitEditors();

// Undo: the app has one list (services/undo.js), taken back by Ctrl/Cmd+Z, the toast and the toolbar. The lifted code keeps its
// own steps (which marks, score or setting to put back, as the current app's paper.js does); each step it pushes gets one entry in
// the app's list whose undo and redo run the lifted undo and redo, so the two lists move together.
let stepping = false;
const entries = [];
const LABEL = u => (u.grade ? t('mark.step_score') : u.file || u.group ? t('mark.step_marks') : t('mark.step_change'));
function steps() {
  const a = [];
  const own = (fn) => () => { stepping = true; try { fn(); } finally { stepping = false; } tell(); };
  a.push = function (...us) {
    const n = Array.prototype.push.apply(this, us);
    if (!stepping) for (const u of us) entries.push(undoList.record({ label: LABEL(u), undo: own(K.undo), redo: own(K.redo) }));
    return n;
  };
  a.pop = function () {
    const u = Array.prototype.pop.call(this);
    if (!stepping && u) { const e = entries.pop(); if (e) undoList.drop(e); }   // a text box closed empty takes its step back out
    return u;
  };
  return a;
}
export const undo = () => undoList.undo();
export const redo = () => undoList.redo();
export const deleteSelected = () => { K.deleteSelected(); tell(); };

// The right-click menu (src/stamps.js openStampMenu): which page and spot it is for, while it is open. The menu is drawn by the
// tools part (screens/mark-tools.jsx); what each line does is the current app's own code.
let menu = null;
export const menuAt = () => menu;
export function closeMenu() { if (menu) { menu = null; tell(); } }
function openMenu(pg, x, y, cx, cy) { menu = { pg, x, y, cx, cy, word: K.wordUnder(pg, x, y), on: (h => (h && !h.ro ? h : null))(K.hitMark(pg, x, y, 3)) }; tell(); }
export function menuDo(act, k) {
  const m0 = menu; if (!m0) return; menu = null;
  const { pg, x, y, on, word } = m0, s = state(), pick = m => use({ selected: { page: pg, mark: m, fresh: true } });
  if (act === 'stamp') { pick(K.placeStamp(pg, k, x, y)); K.redrawAll(); }
  else if (act === 'check') { const m = { t: 'check', color: s.CHECK_INK, x: K.r1(x), y: K.r1(y), size: K.newCheckSize() }; K.snap(pg); pg.marks().push(m); pick(m); K.changed(pg); K.redrawAll(); }
  else if (act === 'note') openNote(pg, { t: 'note', color: COLORS[s.inkColor], ax: K.r1(x), ay: K.r1(y), text: '' }, true);
  else if (act === 'del') { const a = pg.marks(), i = a.indexOf(on); if (i >= 0) { K.snap(pg); a.splice(i, 1); if (s.selected && s.selected.mark === on) use({ selected: null }); K.changed(pg); K.redrawAll(); } }
  else if (act === 'edit') { if (on.t === 'text') editText(pg, on); else openNote(pg, on); }
  else if (act === 'circleWord') { pick(K.circleWord(pg, word)); K.redrawAll(); }
  else if (act === 'hlWord') { K.highlightWord(pg, word, x); K.redrawAll(); }
  else if (act === 'text') K.textBoxHere(pg, x, y);
  else if (act === 'oval' || act === 'hl' || act === 'pen') startOnce(act);
  tell();
}
// Scoring, as the current app's score panel does it (src/app/panels.js): each change is one undo step (gradeSnap), stamped with when
// it changed (scoreTouched / touchGrade), and saved. The row the number keys score next starts on the first row with no score.
let rowOn = -1, rowOf = null, rowKeyed = -1, ptsVisit = null;
const open = () => { const s = state(); return s.batch && s.batch.students[s.cur]; };
export function rowInHand() {
  const st = open(), s = state(); if (!st) return -1;
  if (rowOf !== st) { rowOf = st; rowKeyed = -1; rowOn = s.setup.mode === 'rubric' ? s.setup.criteria.findIndex((_, i) => st.grade.rubric[i] == null) : -1; }
  return rowOn;
}
export function pickRow(i) { rowInHand(); rowOn = i; rowKeyed = -1; tell(); }
export function setRow(i, v, { toggle = true } = {}) {
  const st = open(); if (!st) return;
  rowInHand(); K.gradeSnap(st);
  st.grade.rubric[i] = toggle && st.grade.rubric[i] === v ? null : v;
  K.scoreTouched(st, i); rowOn = i; rowKeyed = -1;
  saveSoon(); tell();
}
export function setPoints(raw, box) {
  const st = open(); if (!st) return;
  if (ptsVisit !== box) { K.gradeSnap(st); ptsVisit = box; }   // one step for a visit to the box, not one a keystroke
  const v = String(raw).trim().replace(',', '.'), m = v.match(/^(\d+(?:\.\d+)?)\s*%$/);   // "73%" is a percent that stays the score; a plain number is points
  if (m) { st.grade.pk = roundPct(+m[1]); const pp = pointsFor(st.grade.pk); st.grade.points = pp == null ? '' : String(pp); } else { delete st.grade.pk; st.grade.points = v; }
  K.scoreTouched(st); saveSoon(); tell();
}
export const leftPoints = () => { ptsVisit = null; };
export function setStatus(k) { const st = open(); if (!st) return; K.gradeSnap(st); K.setStatus(st, k); tell(); }
export function setComment(text) { const st = open(); if (!st) return; st.grade.comment = text; K.touchGrade(st); saveSoon(); tell(); }
// The next paper that still needs a score; null when everyone has one.
export function nextUnscored() { const before = state().cur; K.nextUnscored(); return state().cur !== before || null; }
// A number scores the row in hand and moves to the next row; a full stop right after adds or takes off the half (src/app/panels.js
// scoreKey). Returns what happened, for the screen to say: 'scored', 'none' (every row scored), 'over' (the row stops lower), 'nohalf'.
export function scoreKey(key) {
  const st = open(), s = state(); if (!st || s.setup.mode !== 'rubric') return null;
  const n = s.setup.criteria.length; if (!n) return null;
  const i = rowInHand();
  if (/^[0-9]$/.test(key)) {
    if (+key > Math.max(...s.setup.criteria.map((_, k) => rowTop(s.setup, k)))) return null;
    if (i < 0) return 'none';
    if (+key > rowTop(s.setup, i)) return 'over';
    K.gradeSnap(st); st.grade.rubric[i] = +key; K.scoreTouched(st, i);
    rowKeyed = i; rowOn = Math.min(i + 1, n - 1); rowOf = st;
    saveSoon(); tell(); return 'scored';
  }
  if (key === '.' && rowKeyed >= 0) {
    const v = st.grade.rubric[rowKeyed]; if (v == null) return null;
    const to = v % 1 ? Math.floor(v) : v + 0.5;
    if (!rowSteps(s.setup, rowKeyed).includes(to)) return 'nohalf';
    K.gradeSnap(st); st.grade.rubric[rowKeyed] = to; K.scoreTouched(st, rowKeyed);
    saveSoon(); tell(); return 'scored';
  }
  return null;
}

// Returned (src/tabs.js markReturned, setReturned): she says the work went back, one undo step; an export is kept as exported, with
// when and how many files, and is never "returned" on its own. A student's paper sent on its own keeps when (grade.sent).
export function markReturned(on) {
  const b = state().batch; if (!b) return;
  K.fieldSnap(b, ['returned'], tell, on ? 'marked as returned' : 'marked as not returned');
  const r = { ...(b.returned || {}) };
  if (on) r.ok = Date.now(); else delete r.ok;
  if (Object.keys(r).length) b.returned = r; else delete b.returned;
  saveSoon(); tell();
}
export function setReturned(n) { const b = state().batch; if (!b) return; b.returned = { ...(b.returned || {}), t: Date.now(), n }; saveSoon(); tell(); }
export function markSent(st) { st.grade.sent = Date.now(); saveSoon(); tell(); }

// One go with a tool from the menu (src/stamps.js startOnce): a circle or highlight once, the pen until Done or Esc.
function startOnce(k) {
  const s = state(), prev = s.once ? s.once.prev : s.tool;
  if (prev === k) { chooseTool(k); return; }
  chooseTool(k); use({ once: { k, prev } }); tell();
}
export function endOnce() { const o = state().once; if (!o) return; use({ once: null }); chooseTool(o.prev); }

// Saving: partners kept in step first (src/app/keep.js saveSoon), the same half-second wait as the current app, then the record saveNow builds goes to saveWork in place of the saved one.
// groupSync comes with the group engine (mark/group.jsx), loaded with the file tools; until then there are no group changes to share
let groupSync = () => {};
export const useGroupSync = f => { groupSync = f; };
function saveSoon() { groupSync(); clearTimeout(saveT); saveT = setTimeout(() => K.saveNow(), 500); saveState = 'saving'; tell(); }
let W0 = null, leaving = false;
// What goes on each save before it is stamped (src/folder.js stampWork): a Word paper edited in the app, and what was taken off, so a
// copy elsewhere doesn't bring it back. The stamps themselves, and the merge with another window's save, are students/write.js saveWork's.
function stampWork(b, data) {
  for (const st of b.students) for (const f of st.files) if (f.edited) ((data.s[st.key] ||= { f: {}, g: st.grade, h: {} }).e ||= {})[f.path] = f.edited;
  if (b.goneNow) data.gone = b.goneNow;
}
async function writeWork(b, data) {
  const seq = ++saveSeq;
  if (leaving && W0) { try { W0.saveWorkLeaving(b.id, d => Object.assign(d, JSON.parse(JSON.stringify(data))), { hold: b }); } catch (e) { console.error(e); } return; }
  try {
    // the save layer (students/write.js) loads with the first save, so it isn't part of the tools' first load
    const W = W0 = await PARTS.write();
    const r = await W.saveWork(b.id, d => Object.assign(d, JSON.parse(JSON.stringify(data))), { fresh: !!b.fresh, hold: b });
    if (r.full || r.quick) delete b.fresh;
    if (seq === saveSeq) saveState = r.full ? 'saved' : r.quick ? 'partly' : 'not';
    if (r.full) saveWorked(b.id); else if (seq === saveSeq || b !== state().batch) saveFailed(b.id, again(b, data), r.quick);   // the red bar (saving/trouble.js)
  } catch (e) {
    console.error(e);
    if (seq === saveSeq) saveState = e && e.name === 'CannotSave' ? 'cannot:' + e.why : 'not';
    if (!(e && e.name === 'CannotSave')) saveFailed(b.id, again(b, data), false);
  }
  tell();
}
// Tried again (src/saving.js saveRetry): a download still open is saved as it is now; one she has closed, as she left it.
const again = (b, data) => async () => {
  if (state().batch !== b) return writeWork(b, data);
  clearTimeout(saveT); saveT = null; saveState = 'saving'; K.saveNow();
  while (saveState === 'saving') await new Promise(r => setTimeout(r, 30));
};
// Waits for a save that is due and any under way (for leaving the screen, and for the checks).
// Word edits waiting out their pause (mark/word.js) are written first.
export const flushers = new Set();
export async function saveNowDone() { await Promise.all([...flushers].map(f => f())); if (saveT) { clearTimeout(saveT); saveT = null; K.saveNow(); } while (saveState === 'saving') await new Promise(r => setTimeout(r, 30)); }
setOpenFlush(saveNowDone);

// Every page on screen gets the current app's pointer handling once its canvas is there.
export function bind(pg, wrap) { pg.wrap = wrap; if (pg.bound) return; pg.bound = true; K.bindPage(pg); reach(pg); }
// The marks a tablet can't right-click for (inventory 294): a finger or a pencil held still for half a second opens the same menu as a
// right-click, and the Stamp tool in the strip opens it wherever she taps. A right-click still works.
let stampOn = false;
export const stampTool = () => stampOn;
export function setStampTool(on) { K.commitEditors(); stampOn = !!on; if (on && state().once) endOnce(); tell(); }
function menuHere(pg, cx, cy) {
  const r = pg.canvas.getBoundingClientRect(), x = (cx - r.left) / pg.s, y = (cy - r.top) / pg.s;
  if (x < 0 || y < 0 || x > pg.W || y > pg.H || pg.editing || state().activeEditor) return false;
  K.commitEditors(); if (state().once) endOnce(); openMenu(pg, x, y, cx, cy); return true;
}
function reach(pg) {
  const c = pg.canvas; let tm = 0, at = null;
  const stop = () => { clearTimeout(tm); tm = 0; at = null; };
  // the Stamp tool: before the current app's own handling, so no mark is started
  pg.wrap.addEventListener('pointerdown', e => { if (!stampOn || e.target !== pg.canvas || e.button !== 0) return; e.preventDefault(); e.stopPropagation(); menuHere(pg, e.clientX, e.clientY); }, true);
  c.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || e.button !== 0) return; stop();
    at = { x: e.clientX, y: e.clientY, id: e.pointerId };
    tm = setTimeout(() => { const a = at; stop(); if (!a) return; c.dispatchEvent(new Event('gsdrop')); menuHere(pg, a.x, a.y); }, 550);
  });
  c.addEventListener('pointermove', e => { if (at && e.pointerId === at.id && Math.hypot(e.clientX - at.x, e.clientY - at.y) > 8) stop(); });
  for (const k of ['pointerup', 'pointercancel']) c.addEventListener(k, stop);
}

// The hooks: called by the lifted code when it would, in the current app, redraw a panel, open an editor or say something.
// The page closing or reloading with a save still waiting (or a box still being typed in): saved at once, as the current app does.
function onLeave() { if (!saveT && !state().activeEditor) return; leaving = true; try { K.commitEditors(); clearTimeout(saveT); saveT = null; K.saveNow(true); } finally { leaving = false; } }
let leaveOn = false;
export function startMarking({ toast, openStudent }) {
  if (!leaveOn) { leaveOn = true; addEventListener('pagehide', onLeave); addFlush(saveNowDone); }   // and saved before an update reloads the window
  // the save layer and its merge engine, ready before anything needs saving on the way out
  PARTS.write().then(w => { W0 = w; return w.leavingReady(); }).catch(e => console.error(e));
  loadTools();
  entries.length = 0; undoList.forget();
  use({
    undoStack: steps(), redoStack: [],
    saveSoon, writeWork, stampWork,
    renderTools: tell, renderList: tell, renderGrade: tell,
    toast: () => {},   // the lifted code's own words are the current app's; the screen says what it needs in its own lines
    openStudent: i => openStudent && openStudent(i),
    renderPage: pg => pg.canvas && renderPage(pg, pg.s),
    editText, openNote,
    setTool: chooseTool, openStampMenu: openMenu, endOnce,
    placeScore, stopScorePlace: stopPlace,
  });
}

// The class's setup changed from the marking screen (a Word rubric's Out of or grading scale, src/app/wordrubric.js setClassOutOf and
// setClassScale): kept as her last setup (gs.setup) and on the assignment's card, through students/write.js, as the current app does.
// share: the first rubric set up for an assignment added to several linked classes goes to the copies with none yet (src/app/screens.js shareRubric).
export async function keepSetup(share) {
  const s = state(), su = { ...s.setup, spot: undefined, rubricPage: undefined }, b = s.batch;
  const W = await PARTS.write();
  await W.saveSetting('gs.setup', su);
  if (b && b.assignment) { const { findIn } = await PARTS.bring(); const id = b.assignment.id; await W.saveLibrary(l => { const f = findIn(l, id); if (f) f.setup = { ...s.setup, spot: undefined };
    if (f && share && f.group) for (const c of (l.classes || []).concat([l.loose]).filter(Boolean)) for (const u of c.units || []) for (const x of u.items) if (x !== f && x.group === f.group && !x.setup) x.setup = JSON.parse(JSON.stringify(f.setup)); }); b.assignment.setup = { ...s.setup, spot: undefined }; }
  tell();
}
// A score the Word rubric gave (the lifted rubricToGrade / wordScoreGone), as one undo step, saved and shown.
export function wordGrade(st, fn) { K.gradeSnap(st); fn(); saveSoon(); tell(); }
export const changedNow = () => { saveSoon(); tell(); };

// A picked mark from the keyboard (src/app/wiring.js keydown, src/app/paper.js copyMark, pasteMark): the arrow keys move it (Shift for
// bigger steps, one undo step for a key held down), + and − make it bigger or smaller, Ctrl C and Ctrl V copy it and put it on the page
// in view (another student's too), Ctrl D makes a copy beside it, Esc lets go.
let clip = null, nudging = false;
const picked = () => { const s = state(); return s.selected && s.selected.page && s.selected.mark ? s.selected : null; };
export const pickedNow = () => !!picked() && state().tool === 'select';
export function nudge(dx, dy, repeat) {
  const sel = picked(); if (!sel) return;
  const pg = sel.page;
  if (!repeat || !nudging) { K.snap(pg); nudging = true; }
  K.moveMark(sel.mark, dx, dy); if (sel.mark.t === 'text') K.keepOnPage(sel.mark, pg.W, pg.H);
  K.changed(pg); tell();
}
export const nudgeDone = () => { nudging = false; };
export const resizable = () => { const sel = picked(); return !!sel && !(sel.fresh && sel.mark.t === 'text') && K.canResize(sel.mark); };
export function resize(dir) { if (!resizable()) return; K.stepSize(dir); tell(); }
export function copyMark() {
  const sel = picked(); if (!sel) return false;
  clip = { m: JSON.parse(JSON.stringify(sel.mark)), file: sel.page.file, idx: sel.page.idx, n: 0 };
  delete clip.m.ro; delete clip.m.imp; return true;
}
export const hasClip = () => !!clip;
// The page in view: the picked mark's, else the one nearest the top third of the paper area.
function pageInView() {
  const s = state(), sel = picked(); if (sel && s.pages.includes(sel.page)) return sel.page;
  const area = document.querySelector('.mk-paper'); if (!area) return s.pages[0] || null;
  const P = area.getBoundingClientRect(), mid = P.top + P.height / 3;
  let best = null, bd = 1e9;
  for (const pg of s.pages) { if (!pg.canvas) continue; const r = pg.canvas.getBoundingClientRect(), d = mid < r.top ? r.top - mid : mid > r.bottom ? mid - r.bottom : 0; if (d < bd) { bd = d; best = pg; } }
  return best;
}
export function pasteMark() {
  const pg = pageInView(); if (!pg || !clip) return false;
  const m = JSON.parse(JSON.stringify(clip.m));
  if (pg.file === clip.file && pg.idx === clip.idx) { clip.n++; K.moveMark(m, 12 * clip.n, 12 * clip.n); }
  const bb = bboxOf(m, pg.W);
  if (bb) K.moveMark(m, K.clamp(bb.x, 0, Math.max(0, pg.W - bb.w)) - bb.x, K.clamp(bb.y, 0, Math.max(0, pg.H - bb.h)) - bb.y);
  if (m.t === 'text') K.keepOnPage(m, pg.W, pg.H);
  K.snap(pg); pg.marks().push(m);
  chooseTool('select'); use({ selected: { page: pg, mark: m } }); K.changed(pg); K.redrawAll(); tell();
  return true;
}
export function letGo() { if (!state().selected) return false; use({ selected: null }); K.redrawAll(); tell(); return true; }

// The highlighter snaps to typed lines (where a page has them) or goes freehand; H with the highlighter in hand switches.
export const hlFree = () => K.hlMode === 'free';
export function setHlFree(free) { K.setHlMode(free ? 'free' : 'auto'); tell(); }

// The score, or one rubric row's score, put on the paper where she clicks next (src/app/calc.js startScorePlace, placeScore): a picture
// of it follows the pointer, Esc or a click off the paper stops. It is the same stamp the current app places, and it keeps up with the score.
let placing = null;
export const placingNow = () => !!placing;
export function scoreStamp(row) {
  const st = open(); if (!st) return false;
  if (row != null) { const c = K.critStampOf(st, row); if (!c) return false; startPlace(c.text, { k: 'crit', of: c.of, name: c.name }); return true; }
  const g = gradeOf(st); if (g.total == null) return false;
  startPlace(K.scoreStampText(g, st)); return true;
}
// any words as a score sticker (the calculator's Score sticker)
export function stampText(text) { if (!state().pages.length) return false; startPlace(text); return true; }
function startPlace(text, extra = {}) {
  stopPlace();
  const gh = document.createElement('canvas'); gh.className = 'mk-ghost'; gh.hidden = true; document.body.append(gh);
  const move = e => {
    const pg = state().pages.find(q => q.canvas === e.target);
    if (!pg || !pg.s) { gh.hidden = true; return; }
    const m = { t: 'stamp', k: 'score', x: 0, y: 0, color: totalInk(), text, ...extra }; m.size = K.newStampSize(m.k);
    const b = stampBox(m), dpr = window.devicePixelRatio || 1, k = pg.s;
    gh.width = Math.ceil(b.w * k * dpr) + 2; gh.height = Math.ceil(b.h * k * dpr) + 2;
    gh.style.width = gh.width / dpr + 'px'; gh.style.height = gh.height / dpr + 'px';
    gh.style.left = (e.clientX - gh.width / dpr / 2) + 'px'; gh.style.top = (e.clientY - gh.height / dpr / 2) + 'px';
    const ctx = gh.getContext('2d'); ctx.setTransform(k * dpr, 0, 0, k * dpr, gh.width / 2, gh.height / 2); drawStamp(ctx, m);
    gh.hidden = false;
  };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stopPlace(); } };
  const away = e => { if (!state().pages.some(q => q.canvas === e.target)) stopPlace(); };
  document.addEventListener('pointermove', move, true); document.addEventListener('keydown', key, true); document.addEventListener('pointerdown', away, true);
  placing = { text, extra, stop: () => { document.removeEventListener('pointermove', move, true); document.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', away, true); gh.remove(); } };
  use({ scorePlacing: placing }); tell();
}
function stopPlace() { if (placing) { placing.stop(); placing = null; use({ scorePlacing: null }); tell(); } }
function placeScore(pg, x, y) {
  const { text, extra } = placing; stopPlace();
  const st = open(), m = K.stampOwner({ t: 'stamp', k: 'score', x: K.r1(x), y: K.r1(y), color: totalInk(), text, ...extra }, st); m.size = K.newStampSize(m.k);
  const bb = stampBox(m);   // kept on the page
  m.x = K.r1(m.x + Math.max(0, -bb.x) - Math.max(0, bb.x + bb.w - pg.W)); m.y = K.r1(m.y + Math.max(0, -bb.y) - Math.max(0, bb.y + bb.h - pg.H));
  K.snap(pg); pg.marks().push(m); use({ selected: { page: pg, mark: m, fresh: true } }); K.changed(pg); K.redrawAll(); tell();
  return m;
}

// Formative work is feedback only (src/app/panels.js fmNow, setFb, fbToggle): Feedback complete for each student, no score.
export const fmNow = () => K.fmNow();
export function setFb(on) {
  const st = open(); if (!st) return;
  K.gradeSnap(st); if (on) st.grade.fb = true; else delete st.grade.fb; K.touchGrade(st); saveSoon(); tell();
}
