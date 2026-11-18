// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { store, kdo, kget, idbDo } from './gstore.js';
let batch = null;
let cur = 0;
let setup = null;
let lib = { classes: [], loose: { id: "", units: [] } };
let tool = 'pen';
let selected = null;
let zoom = 1;
let pages = [];
let docs = [];
let docMap = new Map();
let undoStack = [];
let redoStack = [];
let bank = [];
let disp = null;
let inkColor = 'red';
let hlColor = 'yellow';
let penW = 2;
let checkInk = 'green';
let CHECK_INK = '#1E8A4C';
let ptsInk = '';
let once = null;
let onceEl = null;
let LANG_LOCALE = undefined;
let tr = (s) => s;
let libVer = 0;
let keptMeta = new Map();
let gradesOrder = 'roster';
let saveSoon = () => {};
let pdfjsLib = null;
let PDFLib = null;
let fflate = null;
let mammoth = null;
let html2canvas = null;
let workerReady = Promise.resolve();
let heicLoad = () => { throw new Error('no decoder in this copy'); };
let toast = () => {};
let renderList = () => {};
let renderTools = () => {};
let renderGrade = () => {};
let openStudent = () => {};
let renderPage = () => {};
let gradeMarksChanged = () => {};
let gradeShown = () => {};
let openImported = () => {};
let rescanFile = () => {};
let editText = () => {};
let openNote = () => {};
let openStampMenu = () => {};
let placeScore = () => {};
let stopScorePlace = () => {};
let scanNote = () => {};
let refound = () => {};
let endOnce = () => {};
let setTool = () => {};
let lightPagesChanged = () => {};
let groupJust = null;
let scorePlacing = null;
let activeEditor = null;
let writeWork = () => {};
let tabLive = () => true;
let tabForgot = () => false;
let tabLetGo = () => {};
let tabsBehind = () => false;
let saveBehind = () => {};
let stampWork = () => {};
const pickedUpNew = () => false;
const histFill = () => {};
const nameFlagsShow = () => {};
const renderKept = () => {};
const groupNoteRefresh = () => {};
const groupBandRefresh = () => {};
// The open work, handed in by the marking screen: use({ batch, setup, lib, … }). Only the names above.
export function use(o) {
  if ('batch' in o) batch = o.batch;
  if ('cur' in o) cur = o.cur;
  if ('setup' in o) setup = o.setup;
  if ('lib' in o) lib = o.lib;
  if ('tool' in o) tool = o.tool;
  if ('selected' in o) selected = o.selected;
  if ('zoom' in o) zoom = o.zoom;
  if ('pages' in o) pages = o.pages;
  if ('docs' in o) docs = o.docs;
  if ('docMap' in o) docMap = o.docMap;
  if ('undoStack' in o) undoStack = o.undoStack;
  if ('redoStack' in o) redoStack = o.redoStack;
  if ('bank' in o) bank = o.bank;
  if ('disp' in o) disp = o.disp;
  if ('inkColor' in o) inkColor = o.inkColor;
  if ('hlColor' in o) hlColor = o.hlColor;
  if ('penW' in o) penW = o.penW;
  if ('checkInk' in o) checkInk = o.checkInk;
  if ('CHECK_INK' in o) CHECK_INK = o.CHECK_INK;
  if ('ptsInk' in o) ptsInk = o.ptsInk;
  if ('once' in o) once = o.once;
  if ('onceEl' in o) onceEl = o.onceEl;
  if ('LANG_LOCALE' in o) LANG_LOCALE = o.LANG_LOCALE;
  if ('tr' in o) tr = o.tr;
  if ('libVer' in o) libVer = o.libVer;
  if ('keptMeta' in o) keptMeta = o.keptMeta;
  if ('gradesOrder' in o) gradesOrder = o.gradesOrder;
  if ('saveSoon' in o) saveSoon = o.saveSoon;
  if ('pdfjsLib' in o) pdfjsLib = o.pdfjsLib;
  if ('PDFLib' in o) PDFLib = o.PDFLib;
  if ('fflate' in o) fflate = o.fflate;
  if ('mammoth' in o) mammoth = o.mammoth;
  if ('html2canvas' in o) html2canvas = o.html2canvas;
  if ('workerReady' in o) workerReady = o.workerReady;
  if ('heicLoad' in o) heicLoad = o.heicLoad;
  if ('toast' in o) toast = o.toast;
  if ('renderList' in o) renderList = o.renderList;
  if ('renderTools' in o) renderTools = o.renderTools;
  if ('renderGrade' in o) renderGrade = o.renderGrade;
  if ('openStudent' in o) openStudent = o.openStudent;
  if ('renderPage' in o) renderPage = o.renderPage;
  if ('gradeMarksChanged' in o) gradeMarksChanged = o.gradeMarksChanged;
  if ('gradeShown' in o) gradeShown = o.gradeShown;
  if ('openImported' in o) openImported = o.openImported;
  if ('rescanFile' in o) rescanFile = o.rescanFile;
  if ('editText' in o) editText = o.editText;
  if ('openNote' in o) openNote = o.openNote;
  if ('openStampMenu' in o) openStampMenu = o.openStampMenu;
  if ('placeScore' in o) placeScore = o.placeScore;
  if ('stopScorePlace' in o) stopScorePlace = o.stopScorePlace;
  if ('scanNote' in o) scanNote = o.scanNote;
  if ('refound' in o) refound = o.refound;
  if ('endOnce' in o) endOnce = o.endOnce;
  if ('setTool' in o) setTool = o.setTool;
  if ('lightPagesChanged' in o) lightPagesChanged = o.lightPagesChanged;
  if ('groupJust' in o) groupJust = o.groupJust;
  if ('scorePlacing' in o) scorePlacing = o.scorePlacing;
  if ('activeEditor' in o) activeEditor = o.activeEditor;
  if ('writeWork' in o) writeWork = o.writeWork;
  if ('tabLive' in o) tabLive = o.tabLive;
  if ('tabForgot' in o) tabForgot = o.tabForgot;
  if ('tabLetGo' in o) tabLetGo = o.tabLetGo;
  if ('tabsBehind' in o) tabsBehind = o.tabsBehind;
  if ('saveBehind' in o) saveBehind = o.saveBehind;
  if ('stampWork' in o) stampWork = o.stampWork;
}
export const state = () => ({ batch, cur, setup, lib, tool, selected, zoom, pages, docs, docMap, undoStack, redoStack, bank, disp, inkColor, hlColor, penW, checkInk, CHECK_INK, ptsInk, once, onceEl, LANG_LOCALE, tr, libVer, keptMeta, gradesOrder, saveSoon, pdfjsLib, PDFLib, fflate, mammoth, html2canvas, workerReady, heicLoad, toast, renderList, renderTools, renderGrade, openStudent, renderPage, gradeMarksChanged, gradeShown, openImported, rescanFile, editText, openNote, openStampMenu, placeScore, stopScorePlace, scanNote, refound, endOnce, setTool, lightPagesChanged, groupJust, scorePlacing, activeEditor, writeWork, tabLive, tabForgot, tabLetGo, tabsBehind, saveBehind, stampWork });
// A later module that assigns one of these (the marking code clears what is picked) calls its setter instead; see setters() below.
export const set = { batch: v => (batch = v), cur: v => (cur = v), setup: v => (setup = v), lib: v => (lib = v), tool: v => (tool = v), selected: v => (selected = v), zoom: v => (zoom = v), pages: v => (pages = v), docs: v => (docs = v), docMap: v => (docMap = v), undoStack: v => (undoStack = v), redoStack: v => (redoStack = v), bank: v => (bank = v), disp: v => (disp = v), inkColor: v => (inkColor = v), hlColor: v => (hlColor = v), penW: v => (penW = v), checkInk: v => (checkInk = v), CHECK_INK: v => (CHECK_INK = v), ptsInk: v => (ptsInk = v), once: v => (once = v), onceEl: v => (onceEl = v), LANG_LOCALE: v => (LANG_LOCALE = v), tr: v => (tr = v), libVer: v => (libVer = v), keptMeta: v => (keptMeta = v), gradesOrder: v => (gradesOrder = v), saveSoon: v => (saveSoon = v), pdfjsLib: v => (pdfjsLib = v), PDFLib: v => (PDFLib = v), fflate: v => (fflate = v), mammoth: v => (mammoth = v), html2canvas: v => (html2canvas = v), workerReady: v => (workerReady = v), heicLoad: v => (heicLoad = v), toast: v => (toast = v), renderList: v => (renderList = v), renderTools: v => (renderTools = v), renderGrade: v => (renderGrade = v), openStudent: v => (openStudent = v), renderPage: v => (renderPage = v), gradeMarksChanged: v => (gradeMarksChanged = v), gradeShown: v => (gradeShown = v), openImported: v => (openImported = v), rescanFile: v => (rescanFile = v), editText: v => (editText = v), openNote: v => (openNote = v), openStampMenu: v => (openStampMenu = v), placeScore: v => (placeScore = v), stopScorePlace: v => (stopScorePlace = v), scanNote: v => (scanNote = v), refound: v => (refound = v), endOnce: v => (endOnce = v), setTool: v => (setTool = v), lightPagesChanged: v => (lightPagesChanged = v), groupJust: v => (groupJust = v), scorePlacing: v => (scorePlacing = v), activeEditor: v => (activeEditor = v), writeWork: v => (writeWork = v), tabLive: v => (tabLive = v), tabForgot: v => (tabForgot = v), tabLetGo: v => (tabLetGo = v), tabsBehind: v => (tabsBehind = v), saveBehind: v => (saveBehind = v), stampWork: v => (stampWork = v) };
export { batch, cur, setup, lib, tool, selected, zoom, pages, docs, docMap, undoStack, redoStack, bank, disp, inkColor, hlColor, penW, checkInk, CHECK_INK, ptsInk, once, onceEl, LANG_LOCALE, tr, libVer, keptMeta, gradesOrder, saveSoon, pdfjsLib, PDFLib, fflate, mammoth, html2canvas, workerReady, heicLoad, toast, renderList, renderTools, renderGrade, openStudent, renderPage, gradeMarksChanged, gradeShown, openImported, rescanFile, editText, openNote, openStampMenu, placeScore, stopScorePlace, scanNote, refound, endOnce, setTool, lightPagesChanged, groupJust, scorePlacing, activeEditor, writeWork, tabLive, tabForgot, tabLetGo, tabsBehind, saveBehind, stampWork, store, kdo, kget, idbDo, pickedUpNew, histFill, nameFlagsShow, renderKept, groupNoteRefresh, groupBandRefresh };

// src/app/start.js
const SCALE12 = { 12: 100, 11: 95, 10: 91, 9: 86, 8: 82, 7: 77, 6: 73, 5: 68, 4: 64, 3: 60 };
// src/app/start.js
const RUBRIC_STEPS = [0, 1, 1.5, 2, 2.5, 3, 3.5, 4];   // the steps of a row scored 0 to 4 with half points: what every setup had before the row's scale was a choice
// src/app/start.js
const ROW_TOP = 4, ROW_TOP_MAX = 10;
// src/app/start.js
const topOk = v => { v = Math.round(+v); return v >= 1 && v <= ROW_TOP_MAX ? v : 0; };
// src/app/start.js
function rowTop(su, i) { su = su || setup; return (i != null && Array.isArray(su.tops) && topOk(su.tops[i])) || topOk(su.top) || ROW_TOP; }
// src/app/start.js
const rowHalf = su => (su || setup).half !== false;
// src/app/start.js
function rowSteps(su, i) { const top = rowTop(su, i), half = rowHalf(su), out = [0, 1]; for (let k = 1; k < top; k++) { if (half) out.push(k + .5); out.push(k + 1); } return out; }
// src/app/start.js
function rowsMax(su) { su = su || setup; return (su.criteria || []).reduce((a, _, i) => a + rowTop(su, i), 0); }
// src/app/start.js
function setupMax(su) { su = su || setup; return su.mode === 'rubric' ? rowsMax(su) : +su.outOf || 0; }
// src/app/start.js
const rowLevels = (su, i) => { const out = []; for (let v = rowTop(su, i); v >= 0; v--) out.push(v); return out; };
// src/app/start.js
function rowsTop(su) { su = su || setup; const n = (su.criteria || []).length, t = rowTop(su, 0); for (let i = 1; i < n; i++) if (rowTop(su, i) !== t) return null; return t; }
// src/app/start.js
const rowsSay = su => { const t = rowsTop(su); return (t ? '0 to ' + t : 'each row on its own scale') + (rowHalf(su) ? ', half points too' : ''); };
// src/app/start.js
function rowScaleOf(su) { const o = {}; if (su && topOk(su.top) && topOk(su.top) !== ROW_TOP) o.top = topOk(su.top); if (su && Array.isArray(su.tops) && su.tops.some(topOk)) o.tops = su.tops.map(v => topOk(v) || null); if (su && su.half === false) o.half = false; return o; }
// src/app/start.js
const SCALE_FIVES = { 12: 100, 11: 95, 10: 90, 9: 85, 8: 80, 7: 75, 6: 70, 5: 65, 4: 60, 3: 55, 2: 50, 1: 45, 0: 40 };
// src/app/start.js
const DEFAULT_SETUP = { mode: 'rubric', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 10, scale: SCALE12 };
// src/app/start.js
function setupOver(su) { const out = { ...DEFAULT_SETUP, ...(su || {}) }; if (su && (su.criteria || su.mode)) for (const k of ['top', 'tops', 'half']) if (!(k in su)) delete out[k]; return out; }
// src/app/start.js
function maxPoints() { return setupMax(setup); }
// src/app/start.js
const roundPct = v => Math.max(0, Math.round(v + 1e-9));
// src/app/start.js
function pointsWith(pct, max, sc) {
  if (pct == null || pct === '' || isNaN(pct) || !max) return null;
  pct = +pct; if (pct >= (percentWith(max, max, sc) || 100)) return Math.round(pct * max / 50) / 2;
  let best = 0; for (let t = 0.5; t <= max; t += 0.5) if (Math.abs(percentWith(t, max, sc) - pct) < Math.abs(percentWith(best, max, sc) - pct)) best = t;
  return best;
}
// src/app/start.js
const pointsFor = pct => pointsWith(pct, maxPoints(), setup.scale);
// src/app/start.js
function percentFor(total) { return ibSetup() ? null : percentWith(total, maxPoints(), setup.scale); }   // levels on MYP criteria are never a percent (ib.js)
// src/app/start.js
function percentWith(total, max, sc) {
  if (total == null || total === '' || isNaN(total)) return null;
  if (!max) return null;
  const keys = sc ? Object.keys(sc).map(Number).filter(k => sc[k] !== '' && sc[k] != null && !isNaN(+sc[k])).sort((a, b) => a - b) : [];
  if (keys.length >= 2 && keys[keys.length - 1] === max) {
    const val = k => +sc[k];
    if (total >= max) return val(max);
    let v;
    if (total <= keys[0]) v = val(keys[0]) - (keys[0] - total) * (val(keys[1]) - val(keys[0])) / (keys[1] - keys[0]);
    else {
      let i = 0; while (keys[i + 1] < total) i++;
      const lo = keys[i], hi = keys[i + 1];
      v = total === lo ? val(lo) : val(lo) + (val(hi) - val(lo)) * (total - lo) / (hi - lo);
    }
    return roundPct(v);
  }
  return roundPct(total / max * 100);
}
// src/app/start.js
function gradeOf(st) {
  if (noScore(st)) return { total: null, pct: null, done: true, status: st.grade.status };   // missing or excused: settled, with no number
  const g0 = tryGrade(st), g = withTries(g0, st.grade.tries, g0.outOf != null ? g0.outOf : maxPoints(), !!g0.done && !g0.partial && g0.total != null), r = st.grade.status === 'late' ? { ...g, status: 'late' } : g;
  return st.grade.outAvg ? { ...r, out: true } : r;   // left out of the average: the score stays and copies, it just isn't counted
}
// src/app/start.js
function tryGrade(st) { const g0 = scoreOf(st); return addXc(g0, st.grade.xc, g0.outOf != null ? g0.outOf : maxPoints(), st.grade.xcU); }
// src/app/start.js
const RETAKE_RULES = [['high', 'Highest', 'The best try counts'], ['last', 'Latest', 'The newest try counts, even if it is lower'], ['avg', 'Average', 'The average of the tries counts']];
// src/app/start.js
function retakeRule() { const r = typeof lib !== 'undefined' && lib && lib.book && lib.book.retake; return r === 'last' || r === 'avg' ? r : 'high'; }
// src/app/start.js
function withTries(r, tries, max, full) {
  const was = (tries || []).filter(t => t && t.pct != null);
  if (!was.length) return r;
  const now = full ? { total: r.total, max, pct: r.pct, now: true } : null, all = now ? was.concat(now) : was, rule = retakeRule();
  let c;
  if (rule === 'last') c = all[all.length - 1];
  else if (rule === 'avg' && all.length > 1) {
    const same = all.every(t => t.total != null && t.max === all[0].max);
    c = { pct: roundPct(all.reduce((a, t) => a + t.pct, 0) / all.length), max: same ? all[0].max : max, total: same ? Math.round(all.reduce((a, t) => a + t.total, 0) / all.length * 100) / 100 : null };
    if (c.total == null && max) c.total = Math.round(c.pct * max) / 100;
  } else c = all.reduce((a, t) => t.pct >= a.pct ? t : a);
  const out = { ...r, total: c.total, pct: c.pct, tries: was, tryNow: now, tryRule: rule, tryOwn: { total: r.total, pct: r.pct } };
  if (c !== now) { for (const k of ['xc', 'xcU', 'base', 'bpct', 'paper', 'outOf']) delete out[k]; if (c.max != null && c.max !== max) out.outOf = c.max; }
  if (!now) { out.done = false; out.wait = true; delete out.partial; }   // the retake has no full score yet: the earlier tries stand
  return out;
}
// src/app/start.js
function addXc(r, xc, max, unit) {
  xc = +xc; if (!xc || isNaN(xc) || r.total == null) return r;
  if (unit === 'pct') return { ...r, total: max ? r.total + Math.round(xc * max) / 100 : r.total, base: r.total, bpct: r.pct, xc, xcU: 'pct', pct: r.pct == null ? r.pct : roundPct(r.pct + xc) };
  return { ...r, total: r.total + xc, base: r.total, bpct: r.pct, xc, pct: r.pct == null || !max ? r.pct : roundPct(r.pct + xc / max * 100) };
}
// src/app/start.js
const xcSay = g => g.bpct != null && g.pct != null && g.pct - g.bpct > 0 ? fmtNum(g.pct - g.bpct) + '%' : fmtNum(g.xc) + (g.xcU === 'pct' ? '%' : '');
// src/app/start.js
function scoreOf(st) {
  const own = ownGrade(st);
  if (own.total != null) return own;
  const ty = st.grade.sheet;   // typed on the Grade sheet from the picture, for handwritten grades
  if (ty !== '' && ty != null && !isNaN(+ty)) return { total: +ty, pct: percentFor(+ty), done: true, paper: true };
  if (!st.found || !st.found.found) return own;
  const fd = st.found;   // a grade typed on the paper (Grade sheet), used until she scores it here
  const off = fd.outOf != null && fd.outOf !== maxPoints();   // a confirmed 10/15 is out of 15, and says so wherever it shows
  const pct = fd.pct != null ? fd.pct : off ? percentWith(fd.score, fd.outOf, setup.scale) : percentFor(fd.score);
  return off ? { total: fd.score, pct, done: true, paper: true, outOf: fd.outOf } : { total: fd.score, pct, done: true, paper: true };
}
// src/app/start.js
function ownGrade(st) {
  const g = st.grade;
  if (g.pk != null && g.pk !== '' && !ibSetup()) return { total: pointsFor(g.pk), pct: +g.pk, done: true, pk: true };   // a percent she typed: it stays the score, whatever the rows say
  if (setup.mode === 'rubric') {
    const sc = setup.criteria.map((_, i) => g.rubric[i]);
    if (sc.every(v => v == null)) return { total: null, pct: null, done: false };
    const total = sc.reduce((a, v) => a + (v || 0), 0);
    return sc.every(v => v != null) ? { total, pct: percentFor(total), done: true } : { total, pct: percentFor(total), done: false, partial: true };
  }
  const t = g.points === '' || g.points == null ? null : +g.points;
  if (t != null && !isNaN(t) && wordPart(st, t)) return { total: t, pct: percentFor(t), done: false, partial: true };
  if (t != null && !isNaN(t) && quizPart(st)) return { total: t, pct: percentFor(t), done: false, partial: true };   // Quick mark with questions still to mark   // from a Word rubric that isn't fully highlighted
  return { total: t, pct: t == null || isNaN(t) ? null : percentFor(t), done: t != null && !isNaN(t) };
}
// src/app/start.js
const fmtNum = n => n == null ? '' : (Math.round(n * 100) / 100).toString();
// src/app/start.js
const fmtPct = p => p == null ? '' : fmtNum(p) + '%';
// src/app/start.js
const COLORS = { red: '#D7263D', blue: '#1F5FD1', green: '#1E8A4C', purple: '#7B3FC4', black: '#1B1F27' };
// src/app/start.js
function setCheckInk(k) { if (!COLORS[k]) return; checkInk = k; CHECK_INK = COLORS[k]; store.set('gs.checkInk', k); }
// src/app/start.js
const PTS_AMBER = '#A86400';
// src/app/start.js
const QZ_GOLD = '#C08C00';
// src/app/start.js
const NOTE_COLORS = { red: COLORS.red, yellow: '#D08A00', blue: COLORS.blue, green: COLORS.green, purple: COLORS.purple, black: COLORS.black };
// src/app/start.js
const TEXT_COLORS = { ...NOTE_COLORS, yellow: PTS_AMBER };
// src/app/start.js
function ptsColor(v, top) {
  if (ptsInk === 'credit' && v != null && top != null) return +v <= 0 ? COLORS[inkColor] || COLORS.red : +v >= +top ? CHECK_INK : PTS_AMBER;
  return COLORS[ptsInk] || COLORS[inkColor] || COLORS.red;
}
// src/app/start.js
const totalInk = () => COLORS[ptsInk] || COLORS.red;
// src/app/start.js
const HL = { yellow: '#FFE45C', green: '#B4F0A8', pink: '#FFB8D6', blue: '#B0E0FF' };
// src/grades.js
function noScore(st) { const s = st.grade.status; return s === 'missing' || s === 'excused'; }
// src/grades.js
function wordPart(st, total) {
  return (st.files || []).map(f => f.kind === 'docx' && f.wsOf === f.data ? f.wscore : null).find(w => w && !w.done && w.total === total) || null;
}
// src/quiz.js
const quizOn = () => !!(batch && batch.quiz && batch.quiz.qs && batch.quiz.qs.length);
// src/quiz.js
const quizMarks = st => (st.grade && st.grade.q) || {};
// src/quiz.js
function quizCount(st) { const m = quizMarks(st); return quizOn() ? batch.quiz.qs.filter(q => m[q.id] != null).length : 0; }
// src/quiz.js
function quizPart(st) { const n = quizCount(st); return quizOn() && n > 0 && n < batch.quiz.qs.length; }
// src/ib.js
function ibSetup(su) { su = su || setup; return su.mode === 'rubric' && Array.isArray(su.ib) && su.ib.some(Boolean); }
export { setupOver, DEFAULT_SETUP, setupMax, rowsMax, rowTop, rowHalf, rowSteps, rowLevels, rowsTop, rowsSay, rowScaleOf, SCALE12, SCALE_FIVES, RUBRIC_STEPS, maxPoints, roundPct, pointsWith, pointsFor, percentFor, percentWith, gradeOf, tryGrade, scoreOf, ownGrade, withTries, retakeRule, RETAKE_RULES, addXc, xcSay, fmtNum, fmtPct, noScore, COLORS, HL, NOTE_COLORS, TEXT_COLORS, PTS_AMBER, QZ_GOLD, ptsColor, totalInk, setCheckInk };
export { ibSetup, ROW_TOP, wordPart, quizCount, quizPart, topOk, quizOn, quizMarks };
