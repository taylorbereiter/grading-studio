// Marking on the new screen: the current app's own marking code (engines/gmark.js, lifted from src/app/paper.js bindPage,
// src/marking.js, src/stamps.js) does the work on page objects of today's shape. This file hands it what belongs to the screen:
// how to show a change (the toolbar, the list), how to say something (a toast), how to type a text box or a comment
// (mark/editors.js), and where a save goes. The lifted saveNow builds the same record the current app builds and hands it to
// writeWork, which saves it through students/write.js saveWork: the only way the new app writes a download's work.
import * as K from '../../engines/gmark.js';
import { use, state, COLORS, setCheckInk, rowSteps, rowTop, roundPct, pointsFor } from '../../engines/gcore.js';
import { prefs } from '../../students/prefs.js';
import { PARTS } from '../router.js';
import { editText, openNote } from './editors.js';
import { renderPage } from './paper.js';
import * as undoList from '../../services/undo.js';
import { t } from '../../i18n/t.js';
import './lines.js';

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
export function chooseTool(t) { K.commitEditors(); const s = state(); if (s.once) use({ once: null }); use({ tool: t }); if (t !== 'select') { use({ selected: null }); K.redrawAll(); } tell(); }
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
async function writeWork(b, data) {
  const seq = ++saveSeq;
  try {
    // the save layer (students/write.js) loads with the first save, so it isn't part of the tools' first load
    const W = await PARTS.write();
    const r = await W.saveWork(b.id, d => { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, JSON.parse(JSON.stringify(data))); }, { fresh: !!b.fresh });
    if (r.full || r.quick) delete b.fresh;
    if (seq === saveSeq) saveState = r.full ? 'saved' : r.quick ? 'partly' : 'not';
  } catch (e) {
    console.error(e);
    if (seq === saveSeq) saveState = e && e.name === 'CannotSave' ? 'cannot:' + e.why : 'not';
  }
  tell();
}
// Waits for a save that is due and any under way (for leaving the screen, and for the checks).
// Word edits waiting out their pause (mark/word.js) are written first.
export const flushers = new Set();
export async function saveNowDone() { await Promise.all([...flushers].map(f => f())); if (saveT) { clearTimeout(saveT); saveT = null; K.saveNow(); } while (saveState === 'saving') await new Promise(r => setTimeout(r, 30)); }

// Every page on screen gets the current app's pointer handling once its canvas is there.
export function bind(pg, wrap) { pg.wrap = wrap; if (pg.bound) return; pg.bound = true; K.bindPage(pg); }

// The hooks: called by the lifted code when it would, in the current app, redraw a panel, open an editor or say something.
export function startMarking({ toast, openStudent }) {
  loadTools();
  entries.length = 0; undoList.forget();
  use({
    undoStack: steps(), redoStack: [],
    saveSoon, writeWork,
    renderTools: tell, renderList: tell, renderGrade: tell,
    toast: () => {},   // the lifted code's own words are the current app's; the screen says what it needs in its own lines
    openStudent: i => openStudent && openStudent(i),
    renderPage: pg => pg.canvas && renderPage(pg, pg.s),
    editText, openNote,
    setTool: chooseTool, openStampMenu: openMenu, endOnce,
  });
}

// The class's setup changed from the marking screen (a Word rubric's Out of or grading scale, src/app/wordrubric.js setClassOutOf and
// setClassScale): kept as her last setup (gs.setup) and on the assignment's card, through students/write.js, as the current app does.
export async function keepSetup() {
  const s = state(), su = { ...s.setup, spot: undefined, rubricPage: undefined }, b = s.batch;
  const W = await PARTS.write();
  await W.saveSetting('gs.setup', su);
  if (b && b.assignment) { const { findIn } = await PARTS.bring(); const id = b.assignment.id; await W.saveLibrary(l => { const f = findIn(l, id); if (f) f.setup = { ...s.setup, spot: undefined }; }); b.assignment.setup = { ...s.setup, spot: undefined }; }
  tell();
}
// A score the Word rubric gave (the lifted rubricToGrade / wordScoreGone), as one undo step, saved and shown.
export function wordGrade(st, fn) { K.gradeSnap(st); fn(); saveSoon(); tell(); }
export const changedNow = () => { saveSoon(); tell(); };
