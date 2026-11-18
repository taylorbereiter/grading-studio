// Marking on the new screen: the current app's own marking code (engines/gmark.js, lifted from src/app/paper.js bindPage,
// src/marking.js, src/stamps.js) does the work on page objects of today's shape. This file hands it what belongs to the screen:
// how to show a change (the toolbar, the list), how to say something (a toast), how to type a text box or a comment
// (mark/editors.js), and where a save goes. The lifted saveNow builds the same record the current app builds and hands it to
// writeWork, which saves it through students/write.js saveWork: the only way the new app writes a download's work.
import * as K from '../../engines/gmark.js';
import { use, state, COLORS, setCheckInk } from '../../engines/gcore.js';
import { prefs } from '../../students/prefs.js';
import { saveWork, CannotSave } from '../../students/write.js';
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
// One go with a tool from the menu (src/stamps.js startOnce): a circle or highlight once, the pen until Done or Esc.
function startOnce(k) {
  const s = state(), prev = s.once ? s.once.prev : s.tool;
  if (prev === k) { chooseTool(k); return; }
  chooseTool(k); use({ once: { k, prev } }); tell();
}
export function endOnce() { const o = state().once; if (!o) return; use({ once: null }); chooseTool(o.prev); }

// Saving: the same half-second wait as the current app, then the record saveNow builds goes to saveWork in place of the saved one.
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(() => K.saveNow(), 500); saveState = 'saving'; tell(); }
async function writeWork(b, data) {
  const seq = ++saveSeq;
  try {
    const r = await saveWork(b.id, d => { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, JSON.parse(JSON.stringify(data))); });
    if (seq === saveSeq) saveState = r.full ? 'saved' : r.quick ? 'partly' : 'not';
  } catch (e) {
    console.error(e);
    if (seq === saveSeq) saveState = e instanceof CannotSave ? 'cannot:' + e.why : 'not';
  }
  tell();
}
// Waits for a save that is due and any under way (for leaving the screen, and for the checks).
export async function saveNowDone() { if (saveT) { clearTimeout(saveT); saveT = null; K.saveNow(); } while (saveState === 'saving') await new Promise(r => setTimeout(r, 30)); }

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
    toast: (text, ms) => { if (!stepping && toast) toast(text, ms); },   // the app's own undo says what it took back
    openStudent: i => openStudent && openStudent(i),
    renderPage: pg => renderPage(pg, pg.s),
    editText, openNote,
    setTool: chooseTool, openStampMenu: openMenu, endOnce,
  });
}
