// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
// What My setup reads, handed in by app/setup/stp.js (stpUse): the library, the students' store, her saved comments, the School
// page's people and spots, and how points are coloured and the student list shown.
let lib = { classes: [], loose: { id: '', units: [] } }, bank = [], ptsInk = '', listPts = false, people = [], roles = null, setup = null;
let store = { get: (k, d) => d, set: () => {}, del: () => {} };
export function stpUse(o) { if ('lib' in o) lib = o.lib; if ('bank' in o) bank = o.bank || []; if ('store' in o) store = o.store; if ('ptsInk' in o) ptsInk = o.ptsInk || ''; if ('listPts' in o) listPts = !!o.listPts; if ('people' in o) people = o.people || []; if ('roles' in o) roles = o.roles || null; }
const schPeople = () => people, schNow = () => ({ roles }), go = () => {}, saveLib = () => {};
// What bringing a setup in does that is the page's: the School page's people (H.school(fn) changes them), the Planner's timetable
// (H.planPut), and what the page says (H.said). Quiet until the page hands its own in.
const H = { school() {}, async planPut() {}, said() {} };
export const stpHooks = o => Object.assign(H, o);
// what the engine was handed, for the preview
export const libNow = () => lib, bankNow = () => bank;
const schChange = f => H.school(f), stpPlanPut = s => H.planPut(s), stpAfter = () => {}, toast = s => H.said(s), bankJob = () => Promise.resolve(), bankRead = () => {}, batch = null, fcCardRender = () => {}, fcRender = () => {}, listDraw = () => {}, renderPage = () => {}, once = () => {};
// only words in the lifted text ("a few pages", a local cur), never the marking screen's
const cur = 0, pages = [];


// src/beside.js
function aiUrlClean(v) {
  const s = String(v == null ? '' : v).trim().slice(0, 400); if (!s) return '';
  try { const u = new URL(s); return u.protocol === 'https:' && u.hostname.includes('.') ? u.href : ''; } catch { return ''; }
}
// src/app/start.js
const BK_TYPES = [['ic', 'In-class assessment', 'In-class'], ['sum', 'Summative assessment', 'Summative'], ['fm', 'Formative activity', 'Formative']];
// src/app/start.js
const BK_DEF = BK_TYPES.map(x => x.slice());
// src/app/start.js
let bkCatsSeen;
// src/app/start.js
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
// src/app/start.js
const SCALE12 = { 12: 100, 11: 95, 10: 91, 9: 86, 8: 82, 7: 77, 6: 73, 5: 68, 4: 64, 3: 60 };
// src/app/start.js
const ROW_TOP = 4, ROW_TOP_MAX = 10;
// src/app/start.js
const topOk = v => { v = Math.round(+v); return v >= 1 && v <= ROW_TOP_MAX ? v : 0; };
// src/app/start.js
function rowTop(su, i) { su = su || setup; return (i != null && Array.isArray(su.tops) && topOk(su.tops[i])) || topOk(su.top) || ROW_TOP; }
// src/app/start.js
function rowScaleOf(su) { const o = {}; if (su && topOk(su.top) && topOk(su.top) !== ROW_TOP) o.top = topOk(su.top); if (su && Array.isArray(su.tops) && su.tops.some(topOk)) o.tops = su.tops.map(v => topOk(v) || null); if (su && su.half === false) o.half = false; return o; }
// src/app/start.js
const DEFAULT_SETUP = { mode: 'rubric', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 10, scale: SCALE12 };
// src/app/start.js
function retakeRule() { const r = typeof lib !== 'undefined' && lib && lib.book && lib.book.retake; return r === 'last' || r === 'avg' ? r : 'high'; }
// src/app/start.js
const COLORS = { red: '#D7263D', blue: '#1F5FD1', green: '#1E8A4C', purple: '#7B3FC4', black: '#1B1F27' };
// src/app/start.js
function setPtsInk(k) { ptsInk = k === 'credit' || COLORS[k] ? k : ''; if (ptsInk) store.set('gs.ptsInk', ptsInk); else store.del('gs.ptsInk'); }
// src/app/arrange.js
let resizeT;
// src/app/panels.js
function setListPts(on) { listPts = !!on; if (listPts) store.set('gs.listPts', true); else store.del('gs.listPts'); }
// src/app/export.js
const xOne = () => store.get('gs.xone', true) !== false;
// src/app/export.js
const xNames = () => store.get('gs.xnames', true) !== false;
// src/app/gradesheet.js
let sheetFound = !!store.get('gs.sheetfound', false);
// src/app/library.js
const uid = () => Math.random().toString(36).slice(2, 10);
// src/app/library.js
const ME_OLD = { sys: 'ManageBac', unit: 'Atlas', scale12: true, ai: 'Claude' };   // scale12: Rubric setup offers the 12-point scale (12 = 100, 11 = 95…) as a preset
// src/app/library.js
const me = () => lib.me || ME_OLD;
// src/app/library.js
const attOn = () => me().att !== false;
// src/app/library.js
const attDayOk = d => { if (!/^\d{4}-\d\d-\d\d$/.test(d || '')) return false; const t = new Date(d + 'T12:00:00'); return !isNaN(t) && t.getMonth() + 1 === +d.slice(5, 7) && t.getDate() === +d.slice(8); };
// src/app/library.js
function meSet(part) { lib.me = { ...me(), ...part }; saveLib(); gradeDefaultApply(); }
// src/app/library.js
const sysName = () => String(me().sys || '').trim();
// src/app/library.js
const unitLinkName = () => String(me().unit || '').trim();
// src/app/library.js
const GRADE_WAYS = [
  ['rubric', 'Rubric rows', 'Score each row 0 to 4, half points too. The total and percent add up by themselves.', { mode: 'rubric', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 10, scale: null }, null],
  ['points', 'Points', 'Type a total, like 17 out of 20. Each assignment has its own “out of”.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 20, scale: null }, null],
  ['percent', 'Percent', 'Type a percent for each paper.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 100, scale: null }, null],
  ['letters', 'Letter grades', 'A to F, worked out from the percent. You set where each letter starts.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 100, scale: null }, [[90, 'A'], [80, 'B'], [70, 'C'], [60, 'D'], [0, 'F']]],
  ['myp', 'IB MYP criteria', 'Each criterion is marked 0 to 8. You choose the level that fits best, and the total becomes a final grade of 1 to 7.', { mode: 'rubric', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 10, scale: null }, null],   // new classes start as MYP classes (classNewWay, ib.js)
  ['ib7', 'IB DP 1 to 7', 'A final grade of 1 to 7, worked out from the percent, as in the Diploma. You set the boundaries for your subject.', { mode: 'points', criteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'], outOf: 100, scale: null }, [[85, '7'], [70, '6'], [55, '5'], [40, '4'], [25, '3'], [10, '2'], [0, '1']]],
];
// src/app/library.js
const gradeWay = k => GRADE_WAYS.find(w => w[0] === k) || null;
// src/app/library.js
function meGrade() {
  const g = me().grade; if (!g || typeof g !== 'object') return null;
  const w = gradeWay(g.way) || GRADE_WAYS[0], su = g.setup && typeof g.setup === 'object' ? g.setup : w[3];
  const bands = Array.isArray(g.bands) ? g.bands.filter(b => Array.isArray(b) && isFinite(+b[0]) && String(b[1] || '').trim()).map(b => [+b[0], String(b[1]).trim().slice(0, 12)]).sort((a, b) => b[0] - a[0]) : null;
  return { way: w[0], setup: { mode: su.mode === 'points' ? 'points' : 'rubric', criteria: Array.isArray(su.criteria) && su.criteria.length ? su.criteria.map(String) : w[3].criteria.slice(), outOf: +su.outOf || w[3].outOf, scale: su.scale && typeof su.scale === 'object' ? su.scale : null, ...rowScaleOf(su) }, bands: bands && bands.length ? bands : null };
}
// src/app/library.js
const DEFAULT_SETUP_OLD = { ...DEFAULT_SETUP };
// src/app/library.js
function gradeDefaultApply() {
  const g = meGrade(), d = g ? g.setup : DEFAULT_SETUP_OLD, hadOwn = store.get('gs.setup', null) != null;
  for (const k of Object.keys(DEFAULT_SETUP)) delete DEFAULT_SETUP[k];
  Object.assign(DEFAULT_SETUP, JSON.parse(JSON.stringify(d)));
  if (!batch && !hadOwn) setup = { ...DEFAULT_SETUP };
}
// src/app/library.js
const classById = id => lib.classes.find(c => c.id === id);
// src/app/screens.js
const CLASS_TABS = [['', 'Assignments'], ['gradebook', 'Gradebook'], ['students', 'Students'], ['attendance', 'Attendance'], ['seating', 'Seating'], ['missing', 'Missing work'], ['charts', 'Charts'], ['goals', 'Goals'], ['reports', 'Report comments']];
// src/app/screens.js
const TABS_FIRST = ['', 'gradebook', 'students'];
// src/app/screens.js
const tabsKept = () => (Array.isArray(me().tabs) ? me().tabs : []).filter(k => CLASS_TABS.some(t => t[0] === k) && !TABS_FIRST.includes(k));
// src/app/screens.js
const classTabs = () => CLASS_TABS.filter(t => t[0] !== 'attendance' || attOn());
// src/app/screens.js
function mbUrl(v) { v = String(v || '').trim(); if (/^[\w.-]+\.[a-z]{2,}\//i.test(v)) v = 'https://' + v; return /^https?:\/\/[^\s"<>]+$/i.test(v) ? v : ''; }
// src/app/screens.js
const MB_KEY = 'gs.mblinks', mbNorm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// src/app/screens.js
function mbMap() { try { return JSON.parse(localStorage.getItem(MB_KEY) || '{}') || {}; } catch { return {}; } }
// src/app/screens.js
function mbRemember(name, url) { try { const m = mbMap(), k = mbNorm(name); if (!k) return; if (url) m[k] = url; else delete m[k]; localStorage.setItem(MB_KEY, JSON.stringify(m)); } catch { } }
// src/app/screens.js
const mbOf = c => (c && (mbUrl(c.mb) || mbUrl(mbMap()[mbNorm(c.name)]))) || '';
// src/app/wiring.js
const FS_SIDES = ['hide', 'all', 'show'];
// src/app/wiring.js
const fsSide = () => { const v = store.get('gs.fullSide', 'hide'); return FS_SIDES.includes(v) ? v : 'hide'; };
// src/app/wiring.js
function fullSideSet(v) {
  if (!FS_SIDES.includes(v)) return;
  if (v === 'hide') store.del('gs.fullSide'); else store.set('gs.fullSide', v);
  fullSideShow(); listDraw();
  clearTimeout(resizeT); resizeT = setTimeout(() => pages.forEach(renderPage), 60);
}
// src/app/wiring.js
function fullSideShow() { const v = fsSide(); for (const b of document.querySelectorAll('#setFullSide button')) b.setAttribute('aria-pressed', String(b.dataset.v === v)); }
// src/names.js
const nameFindOn = () => !!store.get('gs.nameFind', false);
// src/rubrics.js
const savedRubrics = () => { const a = store.get('gs.rubrics', []); return Array.isArray(a) ? a.filter(r => r && r.id && r.name && Array.isArray(r.criteria) && r.criteria.length) : []; };
// src/rubrics.js
let gBank = null;   // { rubrics, scales, gone, units } while Rubric setup is open
// src/rubrics.js
let bankChan = null; try { bankChan = new BroadcastChannel('gs-bank'); } catch {}
// src/rubrics.js
const tidyBank = b => ({ rubrics: Array.isArray(b && b.rubrics) ? b.rubrics : [], scales: Array.isArray(b && b.scales) ? b.scales : [], gone: (b && b.gone && typeof b.gone === 'object') ? b.gone : {} });
// src/rubrics.js
function planDb(make) {
  return new Promise(res => {
    let r; try { r = indexedDB.open('gs-lessons'); } catch { return res(null); }
    r.onupgradeneeded = () => {
      if (!make) { try { r.transaction.abort(); } catch {} return; }
      r.result.createObjectStore('lessons', { keyPath: 'id' }); r.result.createObjectStore('kv');
    };
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => db.close(); res(db.objectStoreNames.contains('kv') ? db : (db.close(), null)); };
    r.onerror = r.onblocked = () => res(null);
  });
}
// src/rubrics.js
const idbP = q => new Promise((res, rej) => { q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
// src/rubrics.js
async function bankWrite(fn) {
  const db = await planDb(true); if (!db) throw new Error('no bank');
  let out;
  try {
    await new Promise((res, rej) => {
      const t = db.transaction('kv', 'readwrite'), kv = t.objectStore('kv');
      idbP(kv.get('bank')).then(b => { out = tidyBank(b); fn(out); out.rubrics.sort((x, y) => natural(x.name, y.name)); out.scales.sort((x, y) => natural(x.name, y.name)); kv.put(out, 'bank'); });
      t.oncomplete = res; t.onerror = t.onabort = () => rej(t.error);
    });
  } finally { db.close(); }
  gBank = { ...out, units: gBank ? gBank.units : [] };
  try { bankChan && bankChan.postMessage('changed'); } catch {}
  return gBank;
}
// src/book.js
function bkCats() {
  let cats; try { cats = (lib.book || {}).cats; } catch (e) { return BK_TYPES; }
  if (cats === bkCatsSeen) return BK_TYPES;
  bkCatsSeen = cats;
  const seen = new Set(), out = [];
  for (const c of Array.isArray(cats) ? cats : BK_DEF.map(([id]) => ({ id }))) {
    if (!c || !c.id || c.id === 'xc' || seen.has(c.id)) continue;
    const d = BK_DEF.find(x => x[0] === c.id), nm = String(c.name || '').trim();
    if (!d && !nm) continue;
    seen.add(c.id); out.push(nm ? [c.id, nm, nm, d ? 0 : +c.k || 1] : d.slice());
  }
  BK_TYPES.splice(0, BK_TYPES.length, ...(out.length ? out : BK_DEF.map(x => x.slice())));
  return BK_TYPES;
}
// src/book.js
function bkIsType(t) { return bkCats().some(x => x[0] === t); }
// src/book.js
const BK_W0 = { sum: 50, ic: 50, fm: 0 };
// src/book.js
function bkConf() {
  const b = lib.book || {};
  return { terms: (b.terms || []).filter(t => t && t.id), w: { ...BK_W0, ...(b.w || {}) }, empty: b.empty === 'zero' ? 'zero' : 'other', dl: b.dl || {}, xcTo: b.xcTo === 'ic' && bkIsType('ic') ? 'ic' : 'term', xcCap: b.xcCap !== false };
}
// src/book.js
const isoDay = t => { if (!t) return ''; const d = new Date(t); return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// src/marksout.js
const one = t => String(t || '').replace(/\s*\n\s*/g, ' ').trim();
// src/anchors.js
const anchorCoverOn = () => store.get('gs.anchorCover', true) !== false;
// src/goals.js
function goalList() { return Array.isArray(lib.goals) ? lib.goals.filter(g => g && g.id && String(g.name || '').trim()) : []; }
// src/mbentry.js
const mbOrder = () => ['last', 'first'].includes(me().mbOrder) ? me().mbOrder : '';
// src/linked.js
function lkKey(s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); }
// src/todo.js
const tdData = () => { const t = lib.todo || {}; return { items: Array.isArray(t.items) ? t.items : [], off: t.off || {}, offT: t.offT || 0, auto: t.auto || {}, cats: Array.isArray(t.cats) ? t.cats : [], corder: t.corder && Array.isArray(t.corder.ids) ? t.corder : null }; };
// src/todo.js
const TD_CAT0 = [['grade', 'Grading and feedback'], ['plan', 'Lesson planning'], ['admin', 'Administrative'], ['role', 'Leadership role']];
// src/todo.js
function tdCats() {
  const d = tdData(), by = new Map(d.cats.map(c => [c.id, c])), ids = d.corder ? d.corder.ids.filter(x => typeof x === 'string') : [];
  for (const [id] of TD_CAT0) if (!ids.includes(id)) ids.push(id);
  for (const c of d.cats) if (c && c.id && !ids.includes(c.id)) ids.push(c.id);
  return [...new Set(ids)].map(id => {
    const c = by.get(id), b = TD_CAT0.find(x => x[0] === id);
    if ((c && c.gone) || (!c && !b)) return null;
    return { id, name: (c && c.name) || (b ? b[1] : ''), own: !!(c && c.name), w: (c && c.w) || '', base: !!b };
  }).filter(Boolean);
}
// src/lofi.js
const LOFI_STYLES = [
  { id: 'rain', name: 'Rainy window', bpm: [66, 74], modes: ['min', 'dor', 'maj', 'min'], keys: ['rhodes'], mel: ['bell', 'vibes'], kit: ['brush', 'rim'], amb: 'rain', swing: [.56, .6], cut: 2700, wow: 1, comp: ['hold', 'push', 'lazy'], pad: .5, dens: .8 },
  { id: 'library', name: 'Late library', bpm: [74, 82], modes: ['maj', 'min', 'dor'], keys: ['piano'], mel: ['lead', 'vibes', 'bell'], kit: ['rim', 'snare'], amb: 'vinyl', swing: [.55, .6], cut: 3000, wow: 1, comp: ['push', 'lazy', 'two'], pad: 0, dens: .9 },
  { id: 'coffee', name: 'Morning coffee', bpm: [82, 92], modes: ['maj', 'maj', 'dor'], keys: ['guitar', 'rhodes'], mel: ['bell', 'pluck', 'vibes'], kit: ['snare', 'rim'], amb: 'vinyl', swing: [.54, .58], cut: 3900, wow: .7, comp: ['push', 'two', 'arp'], pad: 0, dens: 1 },
  { id: 'night', name: 'Night bus', bpm: [68, 76], modes: ['min', 'min', 'dor'], keys: ['rhodes'], mel: ['lead', 'bell'], kit: ['clap', 'snare'], amb: 'vinyl', swing: [.56, .62], cut: 2300, wow: 1.2, comp: ['hold', 'lazy'], pad: 1, dens: .7, half: 1 },
  { id: 'tape', name: 'Sunday tape', bpm: [76, 84], modes: ['maj', 'min', 'dor', 'maj'], keys: ['piano', 'rhodes'], mel: ['bell', 'pluck'], kit: ['brush', 'snare'], amb: 'vinyl2', swing: [.56, .6], cut: 2400, wow: 2.2, comp: ['push', 'lazy', 'arp'], pad: .4, dens: .9 },
  { id: 'garden', name: 'Garden', bpm: [86, 96], modes: ['maj', 'dor', 'maj'], keys: ['guitar'], mel: ['vibes', 'lead', 'bell'], kit: ['rim'], amb: 'none', swing: [.5, .52], cut: 4300, wow: .6, comp: ['bossa', 'arp'], pad: 0, dens: 1, bossa: 1 },
  { id: 'blue', name: 'Blue hour', bpm: [80, 88], modes: ['dor', 'min', 'dor'], keys: ['rhodes', 'piano'], mel: ['vibes', 'lead'], kit: ['snare', 'brush'], amb: 'vinyl', swing: [.6, .64], cut: 3400, wow: 1, comp: ['push', 'two'], pad: 0, dens: 1, walk: 1 },
  { id: 'quiet', name: 'Quiet desk', bpm: [60, 70], modes: ['maj', 'min', 'dor', 'maj'], keys: ['piano', 'rhodes', 'guitar'], mel: ['bell', 'vibes'], kit: [], amb: 'rain', swing: [.5, .5], cut: 2600, wow: 1.2, comp: ['arp', 'hold'], pad: 1, dens: .6, nodrums: 1 }
];
// src/focus.js
const FC_LENS = [5, 10, 15, 20, 25, 30, 45, 60], FC_BRKS = [3, 5, 10, 15], FC_AWAY = 180e3, FC_DAY = 864e5, FC_KEEP = 400, TK_IDLES = [2, 5, 10, 15], TK_PES = [0, 2, 3, 5, 10];
// src/focus.js
const FC_DOWS = [1, 2, 3, 4, 5, 6, 0];
// src/focus.js
const fcGoalMax = (k, per) => (k === 'min' ? 600 : 500) * (per === 'week' ? 7 : 1);
// src/focus.js
function fcConf() {
  const f = me().focus || {}, g = f.goal || null;
  return { len: FC_LENS.includes(+f.len) ? +f.len : 10, llen: FC_LENS.includes(+f.llen) ? +f.llen : 45, brk: FC_BRKS.includes(+f.brk) ? +f.brk : 5, sound: f.sound !== false, title: f.title !== false,
    track: f.track !== false, idle: TK_IDLES.includes(+f.idle) ? +f.idle : 5, pe: TK_PES.includes(+f.pe) ? +f.pe : 3,   // pe: minutes of steady work in the Planner before it counts as planning; 0 never
    free: f.free !== false, wk: f.wk === false ? false : [0, 1, 2, 3, 4, 5, 6].includes(f.wk) ? f.wk : 5, quiet: f.quiet === true, short: f.short === true,   // src/gradeplan.js
    sg: f.sg !== false,   // a goal suggested for each session
    music: f.music === true, mood: LOFI_STYLES.some(x => x.id === f.mood) ? f.mood : 'mix', mvol: +f.mvol >= .05 && +f.mvol <= 1 ? +f.mvol : .5, mamb: f.mamb === true,   // lo-fi music while a session runs (src/lofi.js)
    goal: g && (g.k === 'papers' || g.k === 'min') && +g.n > 0 ? { k: g.k, n: Math.min(fcGoalMax(g.k, g.per), Math.round(+g.n)), per: g.per === 'week' ? 'week' : 'day',
      days: g.per !== 'week' && Array.isArray(g.days) && g.days.some(d => FC_DOWS.includes(d)) ? FC_DOWS.filter(d => g.days.includes(d)) : null } : null };
}
// src/focus.js
function fcConfSet(part) {
  const c = { ...fcConf(), ...part }, o = {};
  if (c.len !== 10) o.len = c.len;
  if (c.llen !== 45) o.llen = c.llen;   // a session on planning a lesson
  if (c.brk !== 5) o.brk = c.brk;
  if (c.goal) o.goal = { k: c.goal.k, n: c.goal.n, ...(c.goal.per === 'week' ? { per: 'week' } : {}), ...(c.goal.days && c.goal.days.length < 7 ? { days: c.goal.days } : {}) };
  if (!c.sg) o.sg = false;
  if (!c.sound) o.sound = false;
  if (c.music) o.music = true;
  if (c.mood !== 'mix') o.mood = c.mood;
  if (c.mvol !== .5) o.mvol = c.mvol;
  if (c.mamb) o.mamb = true;
  if (!c.title) o.title = false;
  if (!c.track) o.track = false;
  if (c.idle !== 5) o.idle = c.idle;
  if (c.pe !== 3) o.pe = c.pe;
  if (!c.free) o.free = false;
  if (c.wk !== 5) o.wk = c.wk;
  if (c.quiet) o.quiet = true;
  if (c.short) o.short = true;
  meDrop('focus', Object.keys(o).length ? o : null);
  if (typeof tkShare === 'function') tkShare();
  fcRender();
}
// src/tracker.js
function tkShare() {
  const c = fcConf(), v = JSON.stringify({ on: !!c.track, idle: c.idle, pe: c.pe, len: c.len, llen: c.llen, brk: c.brk, sound: c.sound, title: c.title, music: c.music, mood: c.mood, mvol: c.mvol, mamb: c.mamb });
  try { if (localStorage.getItem('gsp.timeCount') !== v) localStorage.setItem('gsp.timeCount', v); } catch { }
}
// src/gradeplan.js
const GP_FREE = 20, GP_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// src/welcome.js
const asked = () => !lib.me || !!lib.me.hi;   // the three questions were answered here, or this browser's work is from before they existed
// src/welcome.js
function meDrop(k, v) { const m = { ...me() }; if (v) m[k] = v; else delete m[k]; lib.me = m; saveLib(); gradeDefaultApply(); }
// src/setupin.js
const STP_V = 1, STP_MAX = 400000;
// src/setupin.js
const stpStr = (v, max) => typeof v === 'string' || typeof v === 'number' ? String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 80) : '';
// src/setupin.js
const stpText = (v, max) => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, max || 600) : '';
// src/setupin.js
const stpObj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : null;
// src/setupin.js
const stpArr = (v, max) => Array.isArray(v) ? v.slice(0, max || 60) : [];
// src/setupin.js
const stpKey = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
// src/setupin.js
const stpDate = v => { const s = stpStr(v, 10); return attDayOk(s) ? s : ''; };
// src/setupin.js
const stpNum = (v, lo, hi) => { const n = typeof v === 'string' && v.trim() !== '' ? +v : v; return typeof n === 'number' && isFinite(n) && n >= lo && n <= hi ? n : null; };
// src/setupin.js
const STP_STUDENT = /^(students?|student_?(names|list|data|info)|rosters?|class_?lists?|pupils?|learners?|names|scores?|marks|results|gradebook_?(scores|entries)|seating|seats|attendance_?(records?|days|log)|absences|report_?comments|emails?)$/i;
// src/setupin.js
const stpCount = v => Array.isArray(v) ? v.length : stpObj(v) ? Object.keys(v).length : v == null || v === '' ? 0 : 1;
// src/setupin.js
function stpParse(text) {
  text = String(text || '');
  if (!text.trim()) return { err: 'Nothing to read yet. Paste the setup text first.' };
  if (text.length > STP_MAX) return { err: 'That is too long to be a setup. A setup is a few pages of text at most.' };
  const tries = [];
  for (const m of text.matchAll(/```[a-zA-Z0-9]*\s*\n?([\s\S]*?)```/g)) tries.push(m[1]);
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a >= 0 && b > a) tries.push(text.slice(a, b + 1));
  const loose = s => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/,(\s*[}\]])/g, '$1');
  let seen = false;
  for (const t of tries) for (const s of [t, loose(t)]) {
    let j; try { j = JSON.parse(s.slice(s.indexOf('{'))); } catch { continue; }
    if (!stpObj(j)) continue;
    seen = true;
    if (j.gradingStudioSetup != null) return { j };
  }
  return { err: seen ? 'That text isn’t a Grading Studio setup: it has no "gradingStudioSetup" line. Ask your assistant for the setup block again, using the prompt above.' : 'No setup found in that text. A setup starts with { and ends with }. If your assistant cut it short, ask it for the whole block again.' };
}
// src/setupin.js
const STP_DAYS = { mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6, sun: 0, sunday: 0 };
// src/setupin.js
const stpDow = v => { if (typeof v === 'number') return v >= 0 && v <= 7 && Number.isInteger(v) ? v % 7 : null; const k = stpKey(v); return k in STP_DAYS ? STP_DAYS[k] : /^[0-7]$/.test(k) ? +k % 7 : null; };
// src/setupin.js
function stpTime(v) {
  const m = /^(\d{1,2})[:.h](\d{2})\s*(am|pm|a\.m\.|p\.m\.)?$/i.exec(stpStr(v, 12)); if (!m) return '';
  let h = +m[1]; const mi = +m[2], ap = (m[3] || '').toLowerCase()[0];
  if (ap === 'p' && h < 12) h += 12; if (ap === 'a' && h === 12) h = 0;
  return h < 24 && mi < 60 ? String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0') : '';
}
// src/setupin.js
const stpScale = v => { const o = stpObj(v); if (!o) return null; const out = {}; for (const k of Object.keys(o).slice(0, 120)) { const s = stpNum(k, 0, 1000), p = stpNum(o[k], 0, 100); if (s != null && p != null) out[s] = Math.round(p * 10) / 10; } return Object.keys(out).length >= 2 ? out : null; };
// src/setupin.js
const stpRowScale = (top, half) => { const o = { ...(top != null ? { top: Math.round(top) } : {}), ...(half === false ? { half: false } : {}) }; return typeof rowScaleOf === 'function' ? rowScaleOf(o) : { ...(o.top && o.top !== 4 ? { top: o.top } : {}), ...(o.half === false ? { half: false } : {}) }; };
// src/setupin.js
const STP_GROUPS = ['langlit', 'langacq', 'indsoc', 'sci', 'math', 'arts', 'phe', 'design', 'idu', 'pp', 'own'];
// src/setupin.js
function stpIb(o) {
  const way = { myp: 'myp', dp: 'dp' }[stpKey(o.programme != null ? o.programme : o.program)]; if (!way) return null;
  const out = { way }, group = stpKey(o.subjectGroup); if (way === 'myp' && STP_GROUPS.includes(group)) out.group = group;
  if (way === 'myp') {
    const crit = [];
    for (const c of stpArr(o.criteria, 6)) {
      const co = stpObj(c), m = co ? null : /^([A-Za-z])\s*[:.)-]\s*(.+)$/.exec(stpStr(c, 90));
      const k = stpStr(co ? co.letter != null ? co.letter : co.k : m ? m[1] : '', 1).toUpperCase(), name = stpStr(co ? co.name : m ? m[2] : '', 80);
      if (/^[A-Z]$/.test(k) && name && !crit.some(x => x.k === k)) crit.push({ k, name });
    }
    if (crit.length) out.crit = crit;
  }
  const b = stpObj(o.boundaries), of = b ? stpNum(b.outOf, 1, 1000) : null;
  let bounds = stpArr(b ? b.grades : null, 10).map(x => Array.isArray(x) ? [stpNum(x[1], 0, 1000), stpNum(x[0], 1, 7)] : stpObj(x) ? [stpNum(x.from, 0, 1000), stpNum(x.grade, 1, 7)] : [null, null]).filter(x => x[0] != null && x[1] != null && Number.isInteger(x[1]));
  if (way === 'dp' && of && of !== 100) bounds = bounds.map(x => [Math.round(x[0] / of * 100), x[1]]);
  bounds = [...new Map(bounds.map(x => [x[1], x])).values()].sort((x, y) => y[1] - x[1]);
  if (bounds.length >= 2 && bounds.every((x, i) => !i || x[0] < bounds[i - 1][0])) out.bounds = bounds;
  // a DP class's own component weights, by the names of the gradebook's types
  const wn = way === 'dp' ? stpArr(o.weights, 8).map(stpObj).filter(Boolean).map(t => ({ name: stpStr(t.name, 40), weight: stpNum(t.weight, 0, 100) })).filter(t => t.name && t.weight != null) : [];
  if (wn.length) out.wn = wn;
  return out;
}
// src/setupin.js
const STP_WAYS = { rubric: 'rubric', rubricrows: 'rubric', rows: 'rubric', points: 'points', percent: 'percent', percentage: 'percent', letters: 'letters', lettergrades: 'letters', letter: 'letters', ib7: 'ib7', ib: 'ib7', ib1to7: 'ib7', myp: 'myp', mypcriteria: 'myp', ibmyp: 'myp', dp: 'ib7' };
// src/setupin.js
const STP_LAYOUTS = { agenda: 'Agenda', objectives: 'Objectives', warmup: 'Warm-up', exit: 'Exit ticket', steps: 'Directions with steps', discuss: 'Discussion question', content: 'Title and text', twocol: 'Two columns', text: 'Plain text', passage: 'Passage', vocab: 'Vocabulary', picture: 'Picture', fullpic: 'Full picture', textpic: 'Text + picture', picprompt: 'Picture + questions', video: 'Video' };
// src/setupin.js
function stpRead(j) {
  const S = { left: [], unknown: [], notes: [] }, known = new Set(['gradingStudioSetup', 'teacher', 'about', 'school', 'programme', 'program', 'grading', 'classes', 'calendar', 'terms', 'gradebook', 'rubrics', 'comments', 'goals', 'attendance', 'classTabs', 'slides', 'marking', 'focus', 'todo']);
  for (const k of Object.keys(j)) {
    if (STP_STUDENT.test(k)) { if (stpCount(j[k])) S.left.push('Something about students (“' + stpStr(k, 30) + '”).'); }
    else if (!known.has(k)) S.unknown.push(stpStr(k, 30));
  }
  if (stpNum(j.gradingStudioSetup, 0, 1e6) > STP_V) S.notes.push('This setup was written for a newer version of Grading Studio. What this version understands is listed below.');
  S.about = stpStr(stpObj(j.teacher) ? j.teacher.label : j.about || j.teacher, 80);
  const prog = stpStr(j.programme != null ? j.programme : j.program, 24); if (prog) S.prog = prog;
  // the school's own words
  const sc = stpObj(j.school);
  if (sc) { const o = {}; for (const [k, to] of [['system', 'sys'], ['unitPlans', 'unit'], ['assistant', 'ai']]) if (typeof sc[k] === 'string') o[to] = stpStr(sc[k], 40);
    // where the assistant opens and how (src/beside.js): an https link, and "tab" or "window"
    if (typeof sc.assistantLink === 'string') o.aiUrl = aiUrlClean(sc.assistantLink);
    if (typeof sc.assistantOpens === 'string') o.aiOpen = /^tab$/i.test(sc.assistantOpens.trim()) ? 'tab' : '';
    // the other assistants in the sidebar's list: a link of her own for some, and the known ones she doesn't want listed
    if (Array.isArray(sc.otherAssistants)) { o.aiUrls = {}; for (const x of sc.otherAssistants.slice(0, 12)) { const n = stpStr(stpObj(x) ? x.name : '', 30), u = stpObj(x) ? aiUrlClean(x.link) : ''; if (n && u) o.aiUrls[n] = u; } }
    // the order the school's own gradebook lists students in, for the entry list (src/mbentry.js): roster, last or first
    if (typeof sc.entryOrder === 'string') { const v = sc.entryOrder.trim().toLowerCase(); o.mbOrder = /^last/.test(v) ? 'last' : /^first/.test(v) ? 'first' : ''; }
    if (Array.isArray(sc.assistantsNotListed)) o.aiOff = [...new Set(sc.assistantsNotListed.filter(x => typeof x === 'string').map(x => stpStr(x, 30)).filter(Boolean))].slice(0, 12);
    if (Object.keys(o).length) S.school = o;
    // the people at the school a teacher works with (the School page's spots, school.js), and the spots themselves
    if (Array.isArray(sc.staff)) S.staff = sc.staff.slice(0, 40).map(stpObj).filter(Boolean).map(x => ({ role: stpStr(x.role, 80), name: stpStr(x.name, 80), email: typeof schMail === 'function' ? schMail(x.email) : '', note: stpStr(x.note, 200) })).filter(x => x.name);
    if (Array.isArray(sc.staffRoles)) S.staffRoles = [...new Set(sc.staffRoles.filter(x => typeof x === 'string').map(x => stpStr(x, 80)).filter(Boolean))].slice(0, 30); }
  // how a new assignment is graded
  const g = stpObj(j.grading);
  if (g) {
    let way = STP_WAYS[stpKey(g.way)] || (stpArr(g.criteria).length ? 'rubric' : '');
    // an MYP teacher's criteria rows: "ib7" with rows is how an older prompt asked for it
    if (way === 'ib7' && /^\s*(ib\s*)?myp\b/i.test(prog) && /^(rows?|rubric|criteria)$/i.test(stpStr(g.score, 12))) way = 'myp';
    if (way) {
      const base = gradeWay(way)[3], crit = stpArr(g.criteria, 12).map(c => stpStr(stpObj(c) ? c.name : c, 80)).filter(Boolean);
      const rows = /^(rows?|rubric|criteria)$/i.test(stpStr(g.score, 12)) ? true : /^(total|points?|percent)$/i.test(stpStr(g.score, 12)) ? false : way === 'rubric' || way === 'myp';
      const outOf = stpNum(g.outOf, 1, 1000), top = stpNum(g.rowTop, 1, 10), scale = stpScale(g.scale);
      let bands = stpArr(g.bands, 20).map(b => Array.isArray(b) ? [stpNum(b[0], 0, 1000), stpStr(b[1], 12)] : stpObj(b) ? [stpNum(b.from, 0, 1000), stpStr(b.grade != null ? b.grade : b.label, 12)] : [null, '']).filter(b => b[0] != null && b[1]);
      const of = stpNum(g.bandsOutOf, 1, 1000);
      if (of && of !== 100) bands = bands.map(b => [Math.round(b[0] / of * 1000) / 10, b[1]]);
      bands = bands.filter(b => b[0] <= 100).sort((x, y) => y[0] - x[0]);
      if (bands.length) bands[bands.length - 1][0] = 0;   // the lowest grade starts at nothing, as in Settings
      if (!bands.length && gradeWay(way)[4]) bands = gradeWay(way)[4].map(b => b.slice());
      // MYP boundaries are in points and belong to each class (ib.js), so none are kept here
      if (way === 'myp') bands = [];
      S.grading = { way, setup: { mode: rows ? 'rubric' : 'points', criteria: crit.length ? crit : base.criteria.slice(), outOf: outOf != null ? outOf : base.outOf, scale: scale || null, ...stpRowScale(top, g.halfPoints) }, ...(bands.length ? { bands } : {}) };
    } else if (Object.keys(g).length) S.notes.push('“grading” has no “way” this version knows (rubric, points, percent, letters, myp or ib7), so it is left as it is.');
  }
  // classes: a name, a link, when it meets, unit names. Never who is in it.
  const seen = new Set(); S.classes = [];
  for (const c of stpArr(j.classes, 40)) {
    const o = stpObj(c) || (typeof c === 'string' ? { name: c } : null); if (!o) continue;
    const name = stpStr(o.name, 60), k = stpKey(name); if (!k || seen.has(k)) continue; seen.add(k);
    for (const key of Object.keys(o)) if (STP_STUDENT.test(key) && stpCount(o[key])) { const n = stpCount(o[key]); S.left.push((Array.isArray(o[key]) && n > 1 ? 'A list of ' + n + ' under “' + stpStr(key, 30) + '”' : '“' + stpStr(key, 30) + '”') + ' for ' + name + '.'); }
    const meets = [];
    for (const m of stpArr(o.meets, 30)) {
      const mo = stpObj(m); if (!mo) continue;
      const dow = stpDow(mo.day != null ? mo.day : mo.dow), start = stpTime(mo.start), end = stpTime(mo.end);
      if (dow == null || !start || !end || end <= start) continue;
      if (!meets.some(x => x.dow === dow && x.start === start)) meets.push({ dow, start, end, label: stpStr(mo.label, 24) });
    }
    meets.sort((x, y) => x.dow - y.dow || x.start.localeCompare(y.start));
    const link = mbUrl(stpStr(o.link, 500)), color = /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : '';
    const ib = stpIb(o);
    S.classes.push({ name, course: stpStr(o.course, 60), ...(ib ? { ib } : {}), ...(link ? { link } : {}), ...(color ? { color } : {}), ...(Array.isArray(o.meets) ? { meets } : {}), units: [...new Map(stpArr(o.units, 40).map(u => stpStr(stpObj(u) ? u.name : u, 80)).filter(Boolean).map(u => [stpKey(u), u])).values()] });
  }
  // the semester, days off and dates worth seeing on the calendar
  const cal = stpObj(j.calendar);
  if (cal) {
    const start = stpDate(cal.start), end = stpDate(cal.end);
    const days = (a, label) => [...new Map(stpArr(a, 200).map(d => stpObj(d) || { date: d }).map(d => ({ date: stpDate(d.date), to: stpDate(d.to), label: stpStr(d.label, 60) || label })).filter(d => d.date).map(d => [d.date, d])).values()].sort((x, y) => x.date.localeCompare(y.date));
    // a break given as a first and last day is each of its days, as the timetable keeps them
    const off = []; for (const d of days(cal.daysOff, 'No school')) { let t = new Date(d.date + 'T12:00:00'); const last = d.to && d.to > d.date ? new Date(d.to + 'T12:00:00') : t; for (let n = 0; t <= last && n < 120; n++, t = new Date(t.getTime() + 864e5)) { const ds = isoDay(t); if (!off.some(x => x.date === ds)) off.push({ date: ds, label: d.label }); } }
    const c2 = { ...(start && end && end > start ? { start, end } : {}), daysOff: off.slice(0, 400), events: days(cal.events, '').filter(e => e.label).map(e => ({ date: e.date, to: e.to && e.to > e.date ? e.to : '', label: e.label })) };
    if (c2.start || c2.daysOff.length || c2.events.length) S.calendar = c2;
  }
  // terms, and what a term grade is made of
  S.terms = [...new Map(stpArr(j.terms, 12).map(stpObj).filter(Boolean).map(t => ({ name: stpStr(t.name, 40), start: stpDate(t.start), end: stpDate(t.end) })).filter(t => t.name && t.start && t.end && t.end > t.start).map(t => [stpKey(t.name), t])).values()];
  const gb = stpObj(j.gradebook);
  if (gb) {
    const o = {}, w = stpObj(gb.weights);
    if (w) { const ws = {}; for (const [k, id] of [['summative', 'sum'], ['inClass', 'ic'], ['formative', 'fm']]) { const n = stpNum(w[k], 0, 100); if (n != null && id !== 'fm') ws[id] = Math.round(n); } if (Object.keys(ws).length) o.w = ws; }
    if (/^(zero|0)$/i.test(stpStr(gb.emptyType, 10))) o.empty = 'zero'; else if (/^other/i.test(stpStr(gb.emptyType, 10))) o.empty = 'other';
    const xc = stpObj(gb.extraCredit);
    if (xc) { if (/^in-?class$/i.test(stpStr(xc.addsTo, 12))) o.xcTo = 'ic'; else if (/^term/i.test(stpStr(xc.addsTo, 12))) o.xcTo = 'term'; if (typeof xc.cap === 'boolean') o.xcCap = xc.cap; }
    const rt = { highest: 'high', high: 'high', latest: 'last', last: 'last', average: 'avg', avg: 'avg' }[stpKey(gb.retakes)]; if (rt) o.retake = rt;
    const types = stpArr(gb.types, 8).map(stpObj).filter(Boolean).map(t => ({ name: stpStr(t.name, 40), weight: stpNum(t.weight, 0, 100) })).filter(t => t.name);
    if (types.length) o.types = types;
    if (Object.keys(o).length) S.book = o;
  }
  // saved rubrics: names of rows and, when given, what each level looks like
  S.rubrics = [];
  for (const r of stpArr(j.rubrics, 40)) {
    const o = stpObj(r); if (!o) continue;
    const name = stpStr(o.name, 80), rows = stpArr(o.criteria, 12).map(c => stpObj(c) || { name: c }).map(c => ({ name: stpStr(c.name, 80), levels: stpObj(c.levels) })).filter(c => c.name);
    if (!name || !rows.length || S.rubrics.some(x => stpKey(x.name) === stpKey(name))) continue;
    const rs = stpRowScale(stpNum(o.rowTop, 1, 10), o.halfPoints), levels = rows.map(c => { const out = {}; if (c.levels) for (let v = rs.top || 4; v >= 0; v--) { const t = stpText(c.levels[v], 400); if (t) out[v] = t; } return out; });
    const scale = stpScale(o.scale);
    S.rubrics.push({ name, criteria: rows.map(c => c.name), ...(levels.some(l => Object.keys(l).length) ? { levels } : {}), ...(scale ? { scale } : {}), ...rs });
  }
  S.comments = [...new Set(stpArr(j.comments, 200).map(c => stpText(c, 600)).filter(Boolean))];
  S.goals = [...new Map(stpArr(j.goals, 100).map(x => stpStr(stpObj(x) ? x.name : x, 80)).filter(Boolean).map(x => [stpKey(x), x])).values()];
  // the Planner's rules for a deck: an agenda on slide 2, and text kept between 28 and 36 pt, each on unless turned off;
  // and the layout + Add slide adds (Title and text unless the teacher picks another)
  const sl = stpObj(j.slides);
  if (sl) { const d = {}; if (sl.newSlide != null) { const k = stpKey(sl.newSlide).replace(/[^a-z0-9]/g, ''), hit = Object.entries(STP_LAYOUTS).find(([id, n]) => id === k || n.toLowerCase().replace(/[^a-z0-9]/g, '') === k); if (hit) d.add = hit[0]; } if (typeof sl.agenda === 'boolean') d.agenda = sl.agenda; if (/^any$/i.test(stpStr(sl.textSizes, 8))) d.sizes = 'any'; else if (/^(usual|28|28-36)/i.test(stpStr(sl.textSizes, 8))) d.sizes = ''; if (Object.keys(d).length) S.deck = d; }
  // choices about marking and handing back, each kept in this browser's own settings
  const mk = stpObj(j.marking);
  if (mk) {
    const m = {}; for (const [k, to] of [['studentFileNames', 'xnames'], ['onePdfPerStudent', 'xone'], ['coverNamesOnAnchors', 'anchorCover'], ['findTypedNames', 'nameFind'], ['gradeSheetFromPapers', 'sheetfound']]) if (typeof mk[k] === 'boolean') m[to] = mk[k];
    const pc = stpKey(mk.pointsColor); if (pc === 'pen') m.ptsInk = ''; else if (pc === 'credit' || COLORS[pc]) m.ptsInk = pc;
    const fs = stpKey(mk.fullScreenSide); if (FS_SIDES.includes(fs)) m.fside = fs;
    const ls = stpKey(mk.listScores); if (ls === 'percent' || ls === 'points') m.listPts = ls === 'points';
    const ma = stpKey(mk.emailsOpenIn); if (/^(gmail|outlook)/.test(ma)) m.mail = ma.slice(0, ma[0] === 'g' ? 5 : 7); else if (/^(app|mail|computer|default)/.test(ma)) m.mail = 'app';
    if (Object.keys(m).length) S.mark = m;
  }
  // the focus timer and the daily goal (src/focus.js): lengths from the lists the app offers, a goal in papers or in minutes
  const fo = stpObj(j.focus);
  if (fo) {
    const f = {}, n = v => Math.round(+v);
    if (FC_LENS.includes(n(fo.sessionMinutes))) f.len = n(fo.sessionMinutes);
    if (FC_BRKS.includes(n(fo.breakMinutes))) f.brk = n(fo.breakMinutes);
    if (FC_LENS.includes(n(fo.lessonMinutes))) f.llen = n(fo.lessonMinutes);   // a focus session on planning a lesson
    if (fo.dailyGoal === null || fo.dailyGoal === false) f.goal = null;
    else {
      const g = stpObj(fo.dailyGoal), wk = g && stpKey(g.per) === 'week', m = wk ? 7 : 1;
      if (g && n(g.papers) > 0) f.goal = { k: 'papers', n: Math.min(500 * m, n(g.papers)) }; else if (g && n(g.minutes) > 0) f.goal = { k: 'min', n: Math.min(600 * m, n(g.minutes)) };
      if (f.goal && wk) f.goal.per = 'week';
      else if (f.goal) { const ds = stpArr(g.days, 7).map(x => GP_DAYS.findIndex(d => stpKey(d) === stpKey(x))).filter(i => i >= 0); if (ds.length && ds.length < 7) f.goal.days = FC_DOWS.filter(d => ds.includes(d)); }
    }
    if (typeof fo.sessionGoals === 'boolean') f.sg = fo.sessionGoals;
    if (typeof fo.chime === 'boolean') f.sound = fo.chime;
    if (typeof fo.timeInTab === 'boolean') f.title = fo.timeInTab;
    if (typeof fo.countTime === 'boolean') f.track = fo.countTime;
    if (TK_IDLES.includes(n(fo.stopCountingAfterMinutes))) f.idle = n(fo.stopCountingAfterMinutes);
    if (fo.planningAfterMinutes === false || fo.planningAfterMinutes === null) f.pe = 0; else if (TK_PES.includes(n(fo.planningAfterMinutes))) f.pe = n(fo.planningAfterMinutes);   // steady work in the Planner
    if (typeof fo.freePeriods === 'boolean') f.free = fo.freePeriods;
    if (fo.weeklyLookBack === false || fo.weeklyLookBack === null) f.wk = false;
    else if (typeof fo.weeklyLookBack === 'string' && GP_DAYS.some(d => d.toLowerCase() === fo.weeklyLookBack.trim().toLowerCase())) f.wk = GP_DAYS.findIndex(d => d.toLowerCase() === fo.weeklyLookBack.trim().toLowerCase());
    if (typeof fo.quietWhileFocusing === 'boolean') f.quiet = fo.quietWhileFocusing;
    if (typeof fo.shortestFirst === 'boolean') f.short = fo.shortestFirst;
    // lo-fi music while a session runs (src/lofi.js): on or off, a mood from the app's list, a volume, the crackle and rain behind it
    if (typeof fo.music === 'boolean') f.music = fo.music;
    if (fo.musicMood === 'mix' || LOFI_STYLES.some(x => x.id === fo.musicMood)) f.mood = fo.musicMood;
    if (stpNum(fo.musicVolume, 5, 100) != null) f.mvol = Math.round(stpNum(fo.musicVolume, 5, 100) / 5) / 20;
    if (typeof fo.musicBackground === 'boolean') f.mamb = fo.musicBackground;
    if (Object.keys(f).length) S.focus = f;
  }
  // to-do categories (src/todo.js): names in her order, the words that bring a line to each, and which is the role she holds beside teaching
  const td = stpObj(j.todo);
  if (td && Array.isArray(td.categories)) {
    const seen = new Set(), words = v => Array.isArray(v) ? v.filter(w => typeof w === 'string').map(w => stpStr(w, 40)).filter(Boolean).join(', ') : stpStr(v, 300);
    const list = td.categories.slice(0, 20).map(x => typeof x === 'string' ? { name: x } : stpObj(x)).filter(Boolean).map(x => ({ name: stpStr(x.name, 40), w: words(x.words).slice(0, 300), role: x.role === true }));
    S.todo = list.filter(x => x.name && !seen.has(stpKey(x.name)) && seen.add(stpKey(x.name)));
    if (!S.todo.length) delete S.todo;
  }
  if (typeof j.attendance === 'boolean') S.att = j.attendance; else if (j.attendance != null && stpCount(j.attendance)) S.left.push('Attendance records.');
  // the class pages kept in the tab row, by name: ["Attendance", "Charts"]. The others stay under More.
  if (Array.isArray(j.classTabs)) S.tabs = [...new Set(j.classTabs.map(x => (CLASS_TABS.find(t => stpKey(t[1]) === stpKey(x) && !TABS_FIRST.includes(t[0])) || [])[0]).filter(Boolean))];
  return S;
}
// src/setupin.js
async function stpPlanGet() {
  const db = await planDb(false); let s = null;
  if (db) { try { s = await idbP(db.transaction('kv').objectStore('kv').get('setup')); } catch {} db.close(); }
  return stpObj(s);
}
// src/setupin.js
const stpMonday = s => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoDay(d); };
// src/setupin.js
const STP_COLORS = ['#1F6FB2', '#7B3FC4', '#0E7C86', '#A8327E', '#3D4CB8', '#9A5B13', '#0B6E99', '#5B6472'];
// src/setupin.js
function stpPlanNext(old, S, pick) {
  const cur = old || { classes: [], daysOff: [], events: [], template: '' }, next = JSON.parse(JSON.stringify(cur));
  next.classes = Array.isArray(next.classes) ? next.classes : []; next.daysOff = Array.isArray(next.daysOff) ? next.daysOff : []; next.events = Array.isArray(next.events) ? next.events : [];
  if (pick.classes) for (const c of S.classes) {
    if (!c.meets) continue;   // a class with no times given stays out of the timetable, as when it is typed in
    let p = next.classes.find(x => x && stpKey(x.name) === stpKey(c.name));
    if (!p) { let id = stpKey(c.name).slice(0, 24) || 'class'; while (next.classes.some(x => String(x.id) === id)) id += '2'; next.classes.push(p = { id, name: c.name, course: c.course || '', color: c.color || STP_COLORS[next.classes.length % STP_COLORS.length], meets: [] }); }
    if (c.course) p.course = c.course; if (c.color) p.color = c.color; if (c.link) p.mb = c.link;
    p.meets = c.meets.map(m => ({ ...m }));
  }
  if (pick.calendar && S.calendar) {
    const k = S.calendar;
    if (k.start) { next.semStart = stpMonday(k.start); next.semEnd = stpMonday(k.end); }
    for (const d of k.daysOff) { const had = next.daysOff.find(x => x && x.date === d.date); if (had) had.label = d.label; else next.daysOff.push({ ...d }); }
    for (const e of k.events) if (!next.events.some(x => x && x.date === e.date && x.label === e.label)) next.events.push({ ...e });
    next.daysOff.sort((a, b) => String(a.date).localeCompare(String(b.date))); next.events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }
  if (pick.deck && S.deck) {   // kept only where it differs from the usual, as the Planner keeps it
    const d = { ...(stpObj(next.deck) || {}) };
    if (S.deck.agenda === false) d.agenda = false; else if (S.deck.agenda === true) delete d.agenda;
    if (S.deck.sizes === 'any') d.sizes = 'any'; else if (S.deck.sizes === '') delete d.sizes;
    if (S.deck.add === 'content') delete d.add; else if (S.deck.add) d.add = S.deck.add;
    if (Object.keys(d).length) next.deck = d; else delete next.deck;
  }
  return JSON.stringify(next) === JSON.stringify(cur) ? null : next;
}
// src/setupin.js
const stpList = (a, n) => a.slice(0, n || 6).join(', ') + (a.length > (n || 6) ? ' and ' + (a.length - (n || 6)) + ' more' : '');
// src/setupin.js
const stpTypeName = id => { const t = BK_TYPES.find(x => x[0] === id); return t ? t[2] : id; };
// src/setupin.js
const stpMarkNow = () => ({ xnames: xNames(), xone: xOne(), anchorCover: anchorCoverOn(), nameFind: nameFindOn(), ptsInk, sheetfound: !!store.get('gs.sheetfound', false), fside: fsSide(), listPts, mail: mailApp() });
// src/setupin.js
function stpMarkSet(m) {
  if (m.fside != null) fullSideSet(m.fside);
  if (m.mail != null) mailAppSet(m.mail);
  if (m.xnames != null) store.set('gs.xnames', m.xnames);
  if (m.xone != null) store.set('gs.xone', m.xone);
  if (m.anchorCover != null) store.set('gs.anchorCover', m.anchorCover);
  if (m.nameFind != null) { if (m.nameFind) store.set('gs.nameFind', true); else store.del('gs.nameFind'); }
  if (m.ptsInk != null) setPtsInk(m.ptsInk);
  if (m.listPts != null) setListPts(m.listPts);
  if (m.sheetfound != null) { sheetFound = m.sheetfound; store.set('gs.sheetfound', sheetFound); }
}
// src/setupin.js
const stpIbNext = (c, ib) => ({ way: ib.way, ib: { ...(stpObj(c.ib) || {}), ...(ib.group ? { group: ib.group } : {}), ...(ib.crit ? { crit: ib.crit } : {}), ...(ib.bounds ? { bounds: ib.bounds } : {}) } });
// src/setupin.js
function stpIbW(wn) {
  const T = typeof bkCats === 'function' ? bkCats() : BK_TYPES, w = {};
  for (const t of wn || []) { const x = T.find(x => stpKey(x[1]) === stpKey(t.name) || stpKey(x[2]) === stpKey(t.name)); if (x && x[0] !== 'fm') w[x[0]] = Math.round(t.weight); }
  return Object.keys(w).length ? w : null;
}
// src/setupin.js
const stpIbChanges = (c, ib) => { const n = stpIbNext(c, ib); return c.way !== n.way || JSON.stringify(c.ib || {}) !== JSON.stringify(n.ib) || (!!ib.wn && JSON.stringify(stpIbW(ib.wn)) !== JSON.stringify((c.ib || {}).w || null)); };
// src/setupin.js
const stpOwnTypes = () => typeof bkCats === 'function';
// src/setupin.js
function stpTodoNext(list) {
  const now = Date.now(), cur = tdCats(), by = new Map(tdData().cats.map(c => [c.id, c])), ids = [];
  for (const x of list) {
    let id = (cur.find(c => stpKey(c.name) === stpKey(x.name) && !ids.includes(c.id)) || {}).id;
    if (!id) id = (TD_CAT0.find(b => stpKey(b[1]) === stpKey(x.name) && !ids.includes(b[0])) || [])[0];
    if (!id && x.role && !ids.includes('role')) id = 'role';
    if (!id) id = 'tc' + uid();
    const b = TD_CAT0.find(b => b[0] === id), w = x.w || (by.get(id) || {}).w || '';
    by.set(id, { id, t: now, ...(b && stpKey(b[1]) === stpKey(x.name) ? {} : { name: x.name }), ...(w ? { w } : {}) });
    ids.push(id);
  }
  for (const c of cur) if (!ids.includes(c.id)) by.set(c.id, { ...(by.get(c.id) || { id: c.id }), gone: 1, t: now });
  return { cats: [...by.values()], corder: { ids, t: now } };
}
// src/setupin.js
const stpPersonHere = x => schPeople().find(p => stpKey(p.name) === stpKey(x.name)) || null;
// src/setupin.js
const stpClone = v => v == null ? v : JSON.parse(JSON.stringify(v));
// src/setupin.js
async function stpApply(S, pick) {
  const U = { t: Date.now(), parts: Object.keys(pick).filter(k => pick[k]) }, now = Date.now();
  if (pick.school || pick.grading || pick.att || pick.tabs || pick.focus) { U.hadMe = !!lib.me; U.me = stpClone(lib.me || null); }
  if (pick.school) {
    const sc = { ...(S.school || {}) };
    if (sc.ai != null && sc.ai !== (me().ai || '') && sc.aiUrl == null) sc.aiUrl = '';   // another assistant: the last one's own link doesn't go with it
    meSet({ ...sc, ...(S.prog ? { prog: S.prog } : {}) });
    for (const k of ['aiUrl', 'aiOpen', 'mbOrder']) if (lib.me[k] === '') delete lib.me[k];   // kept only while they say something
    if (lib.me.aiUrls) { delete lib.me.aiUrls[lib.me.ai || '']; if (!Object.keys(lib.me.aiUrls).length) delete lib.me.aiUrls; }
    if (lib.me.aiOff && !lib.me.aiOff.length) delete lib.me.aiOff;
    saveLib();
    // people: someone new is added, someone already there gets the role, email and note that were given; nobody is taken away
    if (S.staff || S.staffRoles) {
      U.ppl = { added: [], was: [], roles: schNow().roles || null };
      schChange(sc => {
        sc.people = sc.people || [];
        if (S.staffRoles) sc.roles = { list: S.staffRoles.length ? S.staffRoles.slice() : SCH_ROLES.slice(), at: now };
        for (const x of S.staff || []) {
          const had = sc.people.find(p => !p.gone && stpKey(p.name) === stpKey(x.name)), got = Object.fromEntries(Object.entries(x).filter(([, v]) => v));
          if (had) { const nx = { ...had, ...got }; if (JSON.stringify(nx) !== JSON.stringify(had)) { U.ppl.was.push(stpClone(had)); Object.assign(had, got, { at: now }); } }
          else { const id = 'sp' + uid(); sc.people.push({ id, at: now, ...got }); U.ppl.added.push(id); }
        }
      });
    }
  }
  if (pick.grading) {
    U.setupLs = localStorage.getItem('gs.setup');
    store.set('gs.setup', stpClone(S.grading.setup));   // the next new assignment starts from this, as when it is chosen in Settings
    meSet({ grade: stpClone(S.grading) });
    if (!batch) setup = { ...DEFAULT_SETUP };
  }
  if (pick.att) meSet({ att: S.att });
  if (pick.focus) fcConfSet(S.focus);
  if (pick.todo) { const t = lib.todo || {}; U.todo = { cats: stpClone(t.cats || null), corder: stpClone(t.corder || null) }; lib.todo = { ...t, ...stpTodoNext(S.todo) }; }
  if (pick.tabs) meSet({ tabs: S.tabs });
  if (pick.classes) {
    U.classes = []; U.links = []; U.units = []; U.ib = []; U.course = []; U.mbWas = localStorage.getItem(MB_KEY);
    for (const c of S.classes) {
      let had = lib.classes.find(x => stpKey(x.name) === stpKey(c.name));
      if (!had) { lib.classes.push(had = { id: uid(), name: c.name, names: [], units: [] }); U.classes.push(had.id); }
      if (c.course && lkKey(had.course) !== lkKey(c.course)) { U.course.push([had.id, had.course == null ? null : had.course]); had.course = c.course; }
      if (c.link && c.link !== mbOf(had)) { U.links.push([had.id, had.mb || '']); had.mb = c.link; mbRemember(had.name, c.link); }
      if (c.ib && stpIbChanges(had, c.ib)) { U.ib.push([had.id, had.way || '', stpClone(had.ib || null)]); const n = stpIbNext(had, c.ib); had.way = n.way; had.ib = n.ib; }
      for (const u of c.units) if (!had.units.some(x => stpKey(x.name) === stpKey(u))) { const nu = { id: uid(), name: u, items: [] }; had.units.push(nu); U.units.push([had.id, nu.id]); }
    }
  }
  if (pick.terms || pick.book) U.book = stpClone(lib.book || null);
  if (pick.terms) {
    const terms = bkConf().terms.map(t => ({ ...t }));
    for (const t of S.terms) { const had = terms.find(x => stpKey(x.name) === stpKey(t.name)); if (had) { had.start = t.start; had.end = t.end; } else terms.push({ id: uid(), ...t }); }
    terms.sort((a, b) => String(a.start).localeCompare(String(b.start)));
    lib.book = { ...(lib.book || {}), terms };
  }
  if (pick.book) {
    const b = S.book, nb = { ...(lib.book || {}) };
    if (b.w) nb.w = { ...bkConf().w, ...b.w };
    for (const k of ['empty', 'xcTo', 'xcCap', 'retake']) if (b[k] != null) nb[k] = b[k];
    if (b.types && stpOwnTypes()) {   // the teacher's own types, where the gradebook has them: added after the ones there, each with its weight
      const cats = (Array.isArray(nb.cats) && nb.cats.length ? nb.cats : BK_TYPES.map(t => ({ id: t[0] }))).map(x => ({ ...x }));
      for (const t of b.types) {
        const std = BK_TYPES.find(x => stpKey(x[1]) === stpKey(t.name) || stpKey(x[2]) === stpKey(t.name)), own = cats.find(x => x.name && stpKey(x.name) === stpKey(t.name));
        let id = std ? std[0] : own ? own.id : '';
        if (!id && cats.length < 8) { id = 'c' + uid(); cats.push({ id, name: t.name, k: (cats.filter(x => x.k).length % 5) + 1 }); nb.cats = cats; }
        if (id && id !== 'fm' && t.weight != null) nb.w = { ...(nb.w || bkConf().w), [id]: Math.round(t.weight) };
      }
    }
    lib.book = nb;
  }
  // a DP class's own component weights, once the gradebook has the types they name (it may just have been given them)
  if (pick.classes) for (const c of S.classes) if (c.ib && c.ib.wn) {
    const had = lib.classes.find(x => stpKey(x.name) === stpKey(c.name)), w = stpIbW(c.ib.wn);
    if (!had || !w || had.way !== 'dp' || JSON.stringify(w) === JSON.stringify((had.ib || {}).w || null)) continue;
    if (!U.ib.some(x => x[0] === had.id)) U.ib.push([had.id, had.way || '', stpClone(had.ib || null)]);
    had.ib = { ...(had.ib || {}), w };
  }
  if (pick.goals) {
    U.goals = []; lib.goals = Array.isArray(lib.goals) ? lib.goals : [];
    for (const name of S.goals) if (!goalList().some(g => stpKey(g.name) === stpKey(name))) { const g = { id: uid(), name, at: now }; lib.goals.push(g); U.goals.push(g.id); }
  }
  if (pick.rubrics) {
    U.rubAdded = []; U.rubWas = [];
    const all = savedRubrics();
    for (const r of S.rubrics) {
      const i = all.findIndex(x => stpKey(x.name) === stpKey(r.name)), rec = { id: i >= 0 ? all[i].id : uid(), name: i >= 0 ? all[i].name : r.name, criteria: r.criteria, ...(r.levels ? { levels: r.levels } : {}), ...(r.scale ? { scale: r.scale } : i >= 0 && all[i].scale ? { scale: all[i].scale } : {}), ...(r.top ? { top: r.top } : {}), ...(r.half === false ? { half: false } : {}), at: now };
      if (i >= 0) { if (JSON.stringify([all[i].criteria, all[i].levels || null, all[i].scale || null, all[i].top || 4, all[i].half !== false]) === JSON.stringify([rec.criteria, rec.levels || null, rec.scale || null, rec.top || 4, rec.half !== false])) continue; U.rubWas.push(all[i]); all[i] = rec; } else { all.push(rec); U.rubAdded.push(rec.id); }
    }
    all.sort((a, b) => natural(a.name, b.name)); store.set('gs.rubrics', all);
    bankJob(() => bankRead(true)).catch(() => {});   // the bank takes in what it hasn't got, as it does for a rubric saved in Rubric setup
  }
  if (pick.mark) { const now = stpMarkNow(); U.mark = {}; for (const k of Object.keys(S.mark)) U.mark[k] = now[k]; stpMarkSet(S.mark); }
  if (pick.comments) { U.comments = S.comments.filter(c => !bank.includes(c)); bank = bank.concat(U.comments); store.set('gs.bank', bank); }
  saveLib();
  if (pick.classes || pick.calendar || pick.deck) {
    try { const old = await stpPlanGet(), next = stpPlanNext(old, S, pick); if (next) { await stpPlanPut(next); U.plan = { was: old, wrote: next }; } }
    catch { U.planFail = true; }
  }
  try { localStorage.setItem('gs.setupUndo', JSON.stringify(U)); } catch {}
  stpAfter();
  return U;
}
// src/setupin.js
const stpUndoRec = () => { const u = store.get('gs.setupUndo', null); return stpObj(u) && u.t ? u : null; };
// src/setupin.js
async function stpUndo() {
  const U = stpUndoRec(); if (!U) return;
  const kept = [];
  if ('me' in U) { if (U.hadMe) lib.me = U.me; else delete lib.me; }
  if ('setupLs' in U) { if (U.setupLs == null) store.del('gs.setup'); else try { localStorage.setItem('gs.setup', U.setupLs); } catch {} }
  if ('book' in U) { if (U.book) lib.book = U.book; else delete lib.book; }
  for (const [cid, uidd] of U.units || []) { const c = classById(cid), i = c ? c.units.findIndex(u => u.id === uidd) : -1; if (i >= 0) { if (c.units[i].items.length) kept.push('the unit ' + c.units[i].name); else c.units.splice(i, 1); } }
  for (const [cid, way, ib] of U.ib || []) { const c = classById(cid); if (c && !(U.classes || []).includes(cid)) {   // a class the import made goes whole, or stays whole
    if (way) c.way = way; else delete c.way; if (ib) c.ib = ib; else delete c.ib; } }
  for (const [cid, was] of U.course || []) { const c = classById(cid); if (c) { if (was == null) delete c.course; else c.course = was; } }
  for (const [cid, was] of U.links || []) { const c = classById(cid); if (c) { if (was) c.mb = was; else delete c.mb; } }
  if ('mbWas' in U) try { if (U.mbWas == null) localStorage.removeItem(MB_KEY); else localStorage.setItem(MB_KEY, U.mbWas); } catch {}
  for (const id of U.classes || []) { const i = lib.classes.findIndex(c => c.id === id); if (i >= 0) { const c = lib.classes[i]; if (c.names.length || c.units.some(u => u.items.length)) kept.push('the class ' + c.name); else lib.classes.splice(i, 1); } }
  if (U.goals && Array.isArray(lib.goals)) lib.goals = lib.goals.filter(g => !U.goals.includes(g.id));
  if (U.rubAdded || U.rubWas) { let all = savedRubrics().filter(r => !(U.rubAdded || []).includes(r.id)); for (const w of U.rubWas || []) { const i = all.findIndex(r => r.id === w.id); if (i >= 0) all[i] = { ...w, at: Date.now() }; } store.set('gs.rubrics', all); if ((U.rubAdded || []).length) { store.set('gs.rubricsGone', { ...store.get('gs.rubricsGone', {}), ...Object.fromEntries(U.rubAdded.map(id => [id, Date.now()])) }); bankJob(() => bankWrite(b => { b.rubrics = b.rubrics.filter(r => !U.rubAdded.includes(r.id)); for (const id of U.rubAdded) b.gone[id] = Date.now(); for (const w of U.rubWas || []) { const i = b.rubrics.findIndex(r => r.id === w.id); if (i >= 0) b.rubrics[i] = { ...w, at: Date.now() }; } })).catch(() => {}); } }
  if (U.mark) stpMarkSet(U.mark);
  if (U.todo && lib.todo) { for (const k of ['cats', 'corder']) { if (U.todo[k]) lib.todo[k] = U.todo[k]; else delete lib.todo[k]; } }
  if (U.ppl) schChange(sc => {   // people the setup added go, unless changed since; ones it changed get their old details back
    const t = Date.now(); sc.people = sc.people || [];
    for (const id of U.ppl.added) { const i = sc.people.findIndex(p => p.id === id); if (i >= 0) { if ((sc.people[i].at || 0) <= U.t + 1000) sc.people[i] = { id, at: t, gone: 1 }; else kept.push('the person ' + sc.people[i].name); } }
    for (const w of U.ppl.was) { const i = sc.people.findIndex(p => p.id === w.id); if (i >= 0) sc.people[i] = { ...w, at: t }; }
    if (U.ppl.roles) sc.roles = { ...U.ppl.roles, at: t }; else if (sc.roles) sc.roles = { list: SCH_ROLES.slice(), at: t };
  });
  if (U.comments) { bank = bank.filter(c => !U.comments.includes(c)); store.set('gs.bank', bank); }
  saveLib();
  if (U.plan) {
    try { const cur = await stpPlanGet(); if (JSON.stringify(cur) === JSON.stringify(U.plan.wrote)) await stpPlanPut(U.plan.was); else kept.push('the timetable, which has changed since'); }
    catch { kept.push('the timetable'); }
  }
  store.del('gs.setupUndo');
  stpAfter();
  toast(kept.length ? 'Put back, except ' + stpList(kept, 4) + (kept.length === 1 && /timetable/.test(kept[0]) ? '.' : ', which you have used since.') : 'Put back as it was before the setup came in.', 6000);
}
// src/setupin.js
async function stpExport() {
  const p = await stpPlanGet(), g = meGrade(), conf = bkConf(), day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const out = { gradingStudioSetup: STP_V };
  if (me().prog) out.programme = me().prog;
  if (sysName() || unitLinkName() || me().ai || mbOrder()) out.school = { ...(sysName() ? { system: sysName() } : {}), ...(mbOrder() ? { entryOrder: mbOrder() } : {}), ...(unitLinkName() ? { unitPlans: unitLinkName() } : {}), ...(me().ai ? { assistant: String(me().ai) } : {}), ...(me().ai && aiUrlClean(me().aiUrl) ? { assistantLink: aiUrlClean(me().aiUrl) } : {}), ...(me().ai && me().aiOpen === 'tab' ? { assistantOpens: 'tab' } : {}), ...(me().ai && me().aiUrls && Object.keys(me().aiUrls).length ? { otherAssistants: Object.entries(me().aiUrls).map(([name, link]) => ({ name, link })) } : {}), ...(me().ai && Array.isArray(me().aiOff) && me().aiOff.length ? { assistantsNotListed: me().aiOff.slice() } : {}) };
  const ppl = schPeople(), sr = schNow().roles;
  if (ppl.length || sr) { out.school = out.school || {}; if (sr) out.school.staffRoles = sr.list.slice(); if (ppl.length) out.school.staff = ppl.map(p => ({ ...(p.role ? { role: p.role } : {}), name: p.name, ...(p.email ? { email: p.email } : {}), ...(p.note ? { note: p.note } : {}) })); }
  if (g) { const raw = (me().grade && me().grade.setup) || {}; out.grading = { way: g.way, score: g.setup.mode === 'rubric' ? 'rows' : 'total', ...(g.setup.mode === 'rubric' ? { criteria: g.setup.criteria } : { outOf: g.setup.outOf }), ...(raw.top ? { rowTop: raw.top } : {}), ...(typeof raw.half === 'boolean' ? { halfPoints: raw.half } : {}), ...(g.setup.scale ? { scale: g.setup.scale } : {}), ...(g.bands ? { bands: g.bands.map(b => ({ grade: b[1], from: b[0] })) } : {}) }; }
  const pc = p && Array.isArray(p.classes) ? p.classes.filter(c => c && c.name) : [], names = lib.classes.filter(c => !c.sample).map(c => c.name);
  for (const c of pc) if (!names.some(n => stpKey(n) === stpKey(c.name))) names.push(String(c.name));
  if (names.length) out.classes = names.map(n => {
    const c = lib.classes.find(x => stpKey(x.name) === stpKey(n)), q = pc.find(x => stpKey(x.name) === stpKey(n)), link = (c && mbOf(c)) || (q && mbUrl(q.mb)) || '';
    const ib = c && (c.way === 'myp' || c.way === 'dp') ? { programme: c.way.toUpperCase(), ...(c.way === 'dp' && c.ib && c.ib.w && typeof c.ib.w === 'object' ? { weights: Object.entries(c.ib.w).filter(([id]) => BK_TYPES.some(t => t[0] === id)).map(([id, w]) => ({ name: BK_TYPES.find(t => t[0] === id)[1], weight: +w || 0 })) } : {}), ...(c.ib && c.ib.group ? { subjectGroup: c.ib.group } : {}), ...(c.ib && Array.isArray(c.ib.crit) && c.ib.crit.length ? { criteria: c.ib.crit.map(x => ({ letter: x.k, name: x.name })) } : {}), ...(c.ib && Array.isArray(c.ib.bounds) && c.ib.bounds.length ? { boundaries: { outOf: c.way === 'dp' ? 100 : ((c.ib.crit || []).length || 4) * 8, grades: c.ib.bounds.map(b => ({ grade: b[1], from: b[0] })) } } : {}) } : {};
    return { name: n, ...(c && c.course ? { course: c.course } : q && q.course ? { course: String(q.course) } : {}), ...ib, ...(link ? { link } : {}), ...(q && Array.isArray(q.meets) && q.meets.length ? { meets: q.meets.filter(m => day[+m.dow]).map(m => ({ day: day[+m.dow], start: String(m.start), end: String(m.end), ...(m.label ? { label: String(m.label) } : {}) })) } : {}), ...(c && c.units.length ? { units: c.units.map(u => u.name) } : {}) };
  });
  if (p && (p.semStart || (p.daysOff || []).length || (p.events || []).length)) out.calendar = { ...(p.semStart && p.semEnd ? { start: p.semStart, end: p.semEnd } : {}), ...((p.daysOff || []).length ? { daysOff: p.daysOff.map(d => ({ date: d.date, label: d.label })) } : {}), ...((p.events || []).length ? { events: p.events.map(e => ({ date: e.date, ...(e.to ? { to: e.to } : {}), label: e.label })) } : {}) };
  if (p && stpObj(p.deck) && (p.deck.agenda === false || p.deck.sizes === 'any' || STP_LAYOUTS[p.deck.add])) out.slides = { ...(p.deck.agenda === false ? { agenda: false } : {}), ...(p.deck.sizes === 'any' ? { textSizes: 'any' } : {}), ...(STP_LAYOUTS[p.deck.add] && p.deck.add !== 'content' ? { newSlide: STP_LAYOUTS[p.deck.add] } : {}) };
  if (conf.terms.length) out.terms = conf.terms.map(t => ({ name: t.name || 'Term', start: t.start, end: t.end }));
  if (lib.book) out.gradebook = { weights: { summative: +conf.w.sum || 0, inClass: +conf.w.ic || 0 }, emptyType: conf.empty, extraCredit: { addsTo: conf.xcTo === 'ic' ? 'inClass' : 'term', cap: conf.xcCap }, retakes: { high: 'highest', last: 'latest', avg: 'average' }[retakeRule()],
    ...(Array.isArray(lib.book.cats) && lib.book.cats.some(x => x.name) ? { types: lib.book.cats.map(x => ({ name: x.name || stpTypeName(x.id), ...(x.id !== 'fm' ? { weight: +conf.w[x.id] || 0 } : {}) })) } : {}) };
  const rs = savedRubrics(); if (rs.length) out.rubrics = rs.map(r => ({ name: r.name, criteria: r.criteria.map((c, i) => { const l = r.levels && r.levels[i]; return l && Object.keys(l).length ? { name: c, levels: l } : c; }), ...(r.scale ? { scale: r.scale } : {}), ...(r.top ? { rowTop: r.top } : {}), ...(r.half === false ? { halfPoints: false } : {}) }));
  if (bank.length) out.comments = bank.slice(0, 200);
  if (goalList().length) out.goals = goalList().map(x => x.name);
  if (lib.me && typeof lib.me.att === 'boolean') out.attendance = lib.me.att;
  if (lib.me && lib.me.focus) { const c = fcConf(); out.focus = { sessionMinutes: c.len, lessonMinutes: c.llen, breakMinutes: c.brk, dailyGoal: c.goal ? { [c.goal.k === 'min' ? 'minutes' : 'papers']: c.goal.n, ...(c.goal.per === 'week' ? { per: 'week' } : {}), ...(c.goal.days ? { days: c.goal.days.map(d => GP_DAYS[d].toLowerCase()) } : {}) } : null, sessionGoals: c.sg, chime: c.sound, timeInTab: c.title, countTime: c.track, stopCountingAfterMinutes: c.idle, planningAfterMinutes: c.pe, freePeriods: c.free, weeklyLookBack: c.wk === false ? false : GP_DAYS[c.wk].toLowerCase(), quietWhileFocusing: c.quiet, shortestFirst: c.short, music: c.music, musicMood: c.mood, musicVolume: Math.round(c.mvol * 100), musicBackground: c.mamb }; }
  if (lib.todo && (lib.todo.cats || lib.todo.corder)) out.todo = { categories: tdCats().map(c => ({ name: c.name, ...(c.w ? { words: c.w.split(/\s*,\s*/).filter(Boolean) } : {}), ...(c.id === 'role' ? { role: true } : {}) })) };
  if (tabsKept().length) out.classTabs = tabsKept().map(k => CLASS_TABS.find(t => t[0] === k)[1]);
  { const m = stpMarkNow(), o = { ...(m.xnames ? {} : { studentFileNames: false }), ...(m.xone ? {} : { onePdfPerStudent: false }), ...(m.anchorCover ? {} : { coverNamesOnAnchors: false }), ...(m.nameFind ? { findTypedNames: true } : {}), ...(m.ptsInk ? { pointsColor: m.ptsInk } : {}), ...(m.sheetfound ? { gradeSheetFromPapers: true } : {}), ...(m.fside !== 'hide' ? { fullScreenSide: m.fside } : {}), ...(m.listPts ? { listScores: 'points' } : {}), ...(m.mail !== 'gmail' ? { emailsOpenIn: m.mail } : {}) }; if (Object.keys(o).length) out.marking = o; }
  return JSON.stringify(out, null, 1);
}
// src/setupin.js
const stpPrompt = () => `I use Grading Studio, an app that runs in my browser for marking papers, keeping a gradebook and planning lessons. Help me set it up. Your job is to produce one block of setup text that I will paste into the app (Settings, My setup). The app shows me what the block would change before anything changes.

RULES
1. Nothing about students. Never put student names, class lists, ID numbers, emails, scores, grades, attendance records, seating, or comments about any student into the block, even if you know them or I give them to you. The app refuses them.
2. Start from what you already know about me: this conversation, your memory of earlier ones, and any files or notes I have shared. Do not ask me for something you already know.
3. Then ask me only for what is missing, two or three questions at a time, in plain words. If I say "skip" or don't know, leave that part out. Every part is optional.
4. Never invent or guess a date, a time, a weight or a boundary. Leave out what you don't know: the app keeps its own setting for anything missing.
5. When you have what you need, tell me in a few plain sentences what the setup says and ask if it is right. After I agree, reply with the setup as ONE code block of JSON, with nothing after it.

WHAT TO FIND OUT
- My classes: each one's name as I want to see it, the days and times it meets, and its page in my school's system if I have the link. Give two sections of the same course the same "course" (like "English 12"): they share a lesson deck and are linked, so an assignment and its strong examples can be shared between them.
- My school: the system students hand work in on (ManageBac, Google Classroom, Canvas and so on), and where unit plans are kept, if anywhere, and whether that system lists students by last name or first name ("entryOrder": "last" or "first"; leave it out for my roster's order).
- The calendar: the first and last day of this semester, days with no school, and dates I want to see (exams, reports due).
- Terms: each term's name with its first and last day.
- How I grade a new assignment: rubric rows, points, percent, letter grades, or IB 1 to 7. For rubric rows, the names of the rows I usually use.
- What a term grade is made of: how much summative work and in-class work each count (formative work never counts in this app), and my rules for extra credit and retakes if I have any.
- Rubrics I reuse, with the name of each row and, if I have it, what each level looks like.
- Comments I write again and again on papers, as general sentences with no student in them.
- Learning goals, skills or standards I assess, as short names.

IB TEACHERS
IB grading belongs to each class, so put it on the class:
- MYP class: "programme": "MYP", "subjectGroup" (one of langlit, langacq, indsoc, sci, math, arts, phe, design, idu, pp, or own for my own criteria), "criteria" with each letter and its name, and "boundaries" on the total of the levels. Unless I tell you my school uses others, the boundaries out of 32 are 7 from 28, 6 from 24, 5 from 19, 4 from 15, 3 from 10, 2 from 6, 1 from 1.
- DP class: "programme": "DP" and "boundaries" with "outOf": 100 and my subject's own grade boundaries in percent. These differ by subject, level and session, so ask me for them and do not guess. If the components of this class (such as Paper 1, Paper 2 and the internal assessment) count differently from my other classes, add "weights": [{ "name": "Paper 1", "weight": 20 }] to the class, with the same names as the "types" in "gradebook".
- Give the names of the criteria only. Never include the IB's level descriptors or any other text copied from IB documents.
- If most of my classes are MYP, also set the top-level "programme" and the "grading" part as in the example, so a new assignment starts with my four criteria scored 0 to 8.

THE FORMAT
Every part except the first line is optional. Leave a part out rather than leaving it empty.

{
  "gradingStudioSetup": 1,
  "programme": "MYP",
  "school": { "system": "ManageBac", "unitPlans": "Atlas", "assistant": "Claude" },
  "grading": {
    "way": "myp",
    "score": "rows",
    "criteria": ["A: Knowing and understanding", "B: Inquiring and designing", "C: Processing and evaluating", "D: Reflecting on the impacts of science"],
    "rowTop": 8,
    "halfPoints": false
  },
  "classes": [
    { "name": "MYP 4 Sciences A", "course": "MYP 4 Sciences", "link": "https://example.org/classes/123",
      "programme": "MYP", "subjectGroup": "sci",
      "criteria": [{ "letter": "A", "name": "Knowing and understanding" }, { "letter": "B", "name": "Inquiring and designing" }, { "letter": "C", "name": "Processing and evaluating" }, { "letter": "D", "name": "Reflecting on the impacts of science" }],
      "boundaries": { "outOf": 32, "grades": [{ "grade": 7, "from": 28 }, { "grade": 6, "from": 24 }, { "grade": 5, "from": 19 }, { "grade": 4, "from": 15 }, { "grade": 3, "from": 10 }, { "grade": 2, "from": 6 }, { "grade": 1, "from": 1 }] },
      "meets": [{ "day": "Mon", "start": "08:30", "end": "09:50", "label": "Periods 1-2" }, { "day": "Thu", "start": "13:00", "end": "13:40" }],
      "units": ["Unit 1: Cells", "Unit 2: Forces"] }
  ],
  "calendar": {
    "start": "2026-08-17", "end": "2027-01-15",
    "daysOff": [{ "date": "2026-10-12", "to": "2026-10-16", "label": "Autumn break" }],
    "events": [{ "date": "2026-12-07", "to": "2026-12-11", "label": "Exams" }]
  },
  "terms": [{ "name": "Term 1", "start": "2026-08-17", "end": "2026-10-30" }],
  "gradebook": {
    "weights": { "summative": 50, "inClass": 50 },
    "emptyType": "other",
    "extraCredit": { "addsTo": "term", "cap": true },
    "retakes": "highest"
  },
  "rubrics": [
    { "name": "Lab report", "criteria": [
      { "name": "Analysis", "levels": { "4": "Explains the pattern with evidence", "3": "Describes the pattern", "2": "States a result", "1": "Result is unclear" } },
      "Conclusion"
    ] }
  ],
  "comments": ["Explain how your evidence supports your claim."],
  "goals": ["Uses evidence", "Designs a fair test"],
  "attendance": true,
  "focus": { "sessionMinutes": 10, "lessonMinutes": 45, "breakMinutes": 5, "dailyGoal": { "papers": 10 }, "sessionGoals": true, "chime": true, "timeInTab": true, "countTime": true, "stopCountingAfterMinutes": 5, "planningAfterMinutes": 3, "freePeriods": true, "weeklyLookBack": "friday", "quietWhileFocusing": false, "shortestFirst": false, "music": false, "musicMood": "mix", "musicVolume": 50, "musicBackground": false },
  "classTabs": ["Missing work"],
  "todo": { "categories": [{ "name": "Grading and feedback" }, { "name": "Lesson planning", "words": ["labs"] }, { "name": "Administrative" }, { "name": "Grade-level lead", "role": true, "words": ["team meeting"] }] },
  "slides": { "agenda": true, "textSizes": "usual", "newSlide": "Title and text" },
  "marking": { "pointsColor": "credit", "studentFileNames": true, "onePdfPerStudent": true, "coverNamesOnAnchors": true, "findTypedNames": false, "gradeSheetFromPapers": false, "fullScreenSide": "hide", "listScores": "percent", "emailsOpenIn": "gmail" }
}

FIELD NOTES
- "way" is one of "rubric", "points", "percent", "letters", "myp", "ib7". "myp" is IB MYP criteria, each marked 0 to 8, with the 1 to 7 boundaries given on each class. "ib7" is the IB Diploma's 1 to 7 from a percent. "score" is "rows" (a rubric, each row scored) or "total" (one number, out of "outOf").
- "bands" are the grades a percent earns, highest first, each with the lowest percent that earns it. If my boundaries are in points, give them in points and add "bandsOutOf" with the total.
- "scale" (optional, inside "grading" or a rubric) turns a score into a percent, like { "12": 100, "11": 95, "10": 91 }.
- "assistant" (inside "school") is the AI assistant I use, by name. "assistantLink" is an https address of my own for it to open at (my school account, a Gem, a project or a custom GPT) and "assistantOpens" is "window" (beside the app) or "tab". Leave both out unless I ask. "otherAssistants" is a list of { "name", "link" } for other assistants I switch to that should open at an https address of my own, and "assistantsNotListed" is a list of names (of Gemini, Claude, ChatGPT, Copilot) I don't want offered in the sidebar. Leave these out too unless I ask.
- "staff" (inside "school") is a list of { "role", "name", "email", "note" } for the people at my school I work with, like my principal, vice principal, department head or MYP coordinator. Only "name" is needed. "staffRoles" is the list of roles my school has, in order, for the spots on the app's School page, using my school's own words. Leave both out unless I give them. Never put students or parents here.
- Days are "Sun" to "Sat". Times are 24-hour, like "13:05". Dates are YYYY-MM-DD.
- "daysOff" and "events" take one day, or a first and last day with "to".
- "emptyType" is "other" (when a type has nothing in it yet, the others are used) or "zero". "extraCredit.addsTo" is "term" or "inClass"; "cap" true keeps grades at 100% at most. "retakes" is "highest", "latest" or "average".
- "classTabs" are the class pages I want kept in the tab row beside Assignments, Gradebook and Students: any of "Attendance", "Seating", "Missing work", "Charts", "Goals", "Report comments". Leave it out unless I ask.
- "slides" is for the lesson planner: "agenda" false stops an agenda being added as slide 2, "textSizes" is "usual" (28 to 36 pt) or "any" (18 to 44 pt), and "newSlide" is the layout the Add slide button adds: "Title and text", "Plain text", "Two columns", "Text + picture", "Picture" or another layout the planner has. Leave it out unless I ask.
- "focus" is the work timer for grading and for planning lessons: "sessionMinutes" (a grading session) and "lessonMinutes" (a session planning one lesson) are each one of 5, 10, 15, 20, 25, 30, 45, 60, and "breakMinutes" one of 3, 5, 10, 15. "dailyGoal" is how much I want to grade in a day, as { "papers": 10 } or { "minutes": 60 }, or null for none; add "per": "week" for a goal for the whole week, or "days": ["monday", "wednesday"] for a daily goal on some days only. "sessionGoals" false stops the app suggesting a goal for each session. "chime" false turns off the sound at the end of a session, and "timeInTab" false keeps the time left out of the browser tab's name. "countTime" false stops the app counting how long I spend grading and planning, and "stopCountingAfterMinutes" (2, 5, 10 or 15) is how long with nothing pressed or typed before it stops counting. "planningAfterMinutes" (2, 3, 5 or 10, or 0 for never) is how many minutes of steady work in the Planner, outside a focus session, before it counts as planning; time during my classes never counts. "freePeriods" false stops the app offering the gaps between my classes for grading. "weeklyLookBack" is the day a look back at my week shows on Today ("friday" and so on), or false for none. "quietWhileFocusing" true hides counts during a focus session, and "shortestFirst" true takes the shortest papers first. "music" true plays lo-fi music while a session runs; "musicMood" is "mix" or one of "rain", "library", "coffee", "night", "tape", "garden", "blue", "quiet" (quiet has no drums), "musicVolume" is 5 to 100, and "musicBackground" true adds a soft record crackle or rain behind it. Leave it out if I have not said.
- "todo" is how my to-do list is sorted. "categories" are its groups in my order (the app starts with "Grading and feedback", "Lesson planning", "Administrative" and "Leadership role"). Mark the one for a role I hold beside teaching (a coach, a coordinator, a head of department) with "role": true and name it with my role's title. "words" are words that put a to-do in that category. A category I don't list is deleted. Leave it out unless I ask.
- "marking" holds small choices; leave out any I have not asked for. "pointsColor" is "pen", "credit" (full points green, part amber, none red) or one of red, blue, green, purple, black. "studentFileNames" names each file I hand back for the student and assignment. "onePdfPerStudent" puts all of a student's papers in one PDF (false sends each paper as its own file). "coverNamesOnAnchors" covers names on example papers I export. "findTypedNames" lets the app look for typed names to cover. "gradeSheetFromPapers" also shows grades the app finds written on papers. "fullScreenSide" is what happens beside the paper while I mark in full screen: "hide" hides the student list until I point at the left edge, "all" hides the tools as well, "show" keeps both. "listScores" is how scores show in the student list while I mark: "percent" or "points" (out of the total). "emailsOpenIn" is where Email buttons start a message: "gmail", "outlook" (Outlook on the web) or "app" (the computer's own mail app).
- A rubric row is a name, or a name with "levels" keyed "4" down to "0". A rubric whose rows go higher takes "rowTop" (up to 10), and "halfPoints": false when only whole points are given.
- Use straight quotes and no comments inside the block.`;
// src/school.js
const SCH_ROLES = ['Principal', 'Vice principal', 'Subject group coordinator / department head', 'Curriculum coordinator', 'Dean of academic affairs'];
// src/school.js
const schMail = t => { t = String(t || '').trim().replace(/^mailto:/i, ''); return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(t) && t.length <= 120 ? t : ''; };
// src/mail.js
const MAIL_APPS = ['gmail', 'outlook', 'app'];
// src/mail.js
const mailGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
// src/mail.js
const mailApp = () => { const v = mailGet('gs.mailApp'); return MAIL_APPS.includes(v) ? v : 'gmail'; };
// src/mail.js
function mailAppSet(v) {
  if (!MAIL_APPS.includes(v)) return;
  try { if (v === 'gmail') localStorage.removeItem('gs.mailApp'); else localStorage.setItem('gs.mailApp', JSON.stringify(v)); } catch { }
  mailAppShow();
}
// src/mail.js
function mailAppShow() { const v = mailApp(); for (const b of document.querySelectorAll('#setMailApp button')) b.setAttribute('aria-pressed', String(b.dataset.v === v)); }
export { stpParse, stpRead, stpPlanNext, stpExport, stpPrompt, stpKey, STP_V, stpApply, stpUndo, stpUndoRec, stpMarkNow, stpTodoNext, stpIbChanges, stpOwnTypes, stpPersonHere, me, meGrade, bkConf, retakeRule, savedRubrics, goalList, fcConf, tdCats, TD_CAT0, tabsKept, attOn, stpPlanGet, sysName, unitLinkName, mbOrder, mbOf, BK_TYPES, CLASS_TABS, STP_LAYOUTS, lkKey, stpMonday, aiUrlClean, GP_DAYS, gradeWay };
