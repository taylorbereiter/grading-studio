// MADE BY next/build.js FROM src/planner/*.js (next/tools/lift.js). Do not edit: change the source and build again.
// L holds what the Planner keeps in memory: the new app puts the timetable in L.setup (and lessons, units) before calling.
/* eslint-disable */
import * as fflate from 'fflate';

// src/planner/base.js
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// src/planner/base.js
function hash(s) {
  let h1 = 0x811c9dc5, h2 = 0x1234567;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
// src/planner/bank.js
const B_TOP = 4, B_TOP_MAX = 10;
// src/planner/bank.js
const bTopOk = v => { v = Math.round(+v); return v >= 1 && v <= B_TOP_MAX ? v : 0; };
// src/planner/bank.js
const bTop = (x, i) => (i != null && Array.isArray(x.tops) && bTopOk(x.tops[i])) || bTopOk(x.top) || B_TOP;
// src/planner/bank.js
const bLevels = (x, i) => { const out = []; for (let v = bTop(x, i); v >= 0; v--) out.push(v); return out; };
// src/planner/bank.js
const tidyBank = b => ({ rubrics: Array.isArray(b && b.rubrics) ? b.rubrics : [], scales: Array.isArray(b && b.scales) ? b.scales : [], gone: (b && b.gone && typeof b.gone === 'object') ? b.gone : {} });
// src/planner/bank.js
function normScale(s) {
  if (!s || typeof s !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(s)) { const n = +k, p = +v; if (Number.isInteger(n) && n >= 0 && n <= 40 && v !== '' && v != null && isFinite(p) && p >= 0 && p <= 200) out[n] = p; }
  return Object.keys(out).length ? out : null;
}
// src/planner/bank.js
function normRef(u) {
  if (!u || typeof u !== 'object' || !(u.title || u.id)) return null;
  return { id: String(u.id || ''), course: String(u.course || ''), title: String(u.title || '') };
}
// src/planner/bank.js
function normRubric(x) {
  x = x && typeof x === 'object' ? x : {};
  const criteria = (Array.isArray(x.criteria) ? x.criteria : []).map(c => String(c == null ? '' : c).trim()).slice(0, 12).map((c, i) => c || 'Criterion ' + (i + 1));
  let levels;
  if (Array.isArray(x.levels)) {
    levels = criteria.map((_, i) => { const r = x.levels[i] || {}, o = {}; for (const v of bLevels({ ...x, criteria }, i)) { const t = String(r[v] == null ? '' : r[v]).trim(); if (t) o[v] = t; } return o; });
    if (!levels.some(r => Object.keys(r).length)) levels = undefined;
  }
  const r = { id: typeof x.id === 'string' && x.id ? x.id : lid(), name: String(x.name || '').trim() || 'Rubric', criteria: criteria.length ? criteria : ['Criterion 1'], levels, scale: normScale(x.scale), ...bRowScale(x), at: +x.at || Date.now() };
  if (r.tops) r.tops = r.criteria.map((_, i) => r.tops[i] || null);
  const u = normRef(x.unit); if (u) r.unit = u;
  return r;
}
// src/planner/bank.js
function normBankScale(x) {
  x = x && typeof x === 'object' ? x : {};
  const s = { id: typeof x.id === 'string' && x.id ? x.id : lid(), name: String(x.name || '').trim() || 'Grading scale', scale: normScale(x.scale) || { 0: 0 }, at: +x.at || Date.now() };
  const u = normRef(x.unit); if (u) s.unit = u;
  return s;
}
// src/planner/bank.js
const bankRubrics = () => ((L.bank && L.bank.rubrics) || []).filter(r => r && r.id && r.name && Array.isArray(r.criteria) && r.criteria.length);
// src/planner/bank.js
const bankScales = () => ((L.bank && L.bank.scales) || []).filter(s => s && s.id && s.name && s.scale && typeof s.scale === 'object');
// src/planner/bank.js
const bankList = kind => kind === 'scales' ? bankScales() : bankRubrics();
// src/planner/bank.js
const unitRef = u => u ? { id: u.id, course: u.course, title: u.title } : null;
// src/planner/bank.js
function refUnit(ref) {
  if (!ref) return null;
  return L.units.find(u => u.id === ref.id) || L.units.find(u => u.course === ref.course && u.title.trim().toLowerCase() === ref.title.trim().toLowerCase()) || null;
}
// src/planner/bank.js
const refKey = ref => { if (!ref) return ''; const u = refUnit(ref); return u ? u.id : 'ref:' + ref.course + '|' + ref.title; };
// src/planner/bank.js
const refLabel = ref => { if (!ref) return 'Not in a unit'; const u = refUnit(ref) || ref; return (u.course ? u.course + ' · ' : '') + (u.title || 'Unit'); };
// src/planner/bank.js
const bankBase = (kind, x) => x.name.replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 90) + (kind === 'scales' ? '.scale.json' : '.rubric.json');
// src/planner/bank.js
function bankForFile(kind, x) {
  const o = { id: x.id, name: x.name };
  if (x.unit) o.unit = { course: x.unit.course, title: x.unit.title };
  if (kind === 'rubrics') { o.criteria = x.criteria; if (x.levels) o.levels = x.levels; o.scale = x.scale || null; } else o.scale = x.scale;
  return o;
}
// src/planner/bank.js
const BANK_README = `
## Rubrics and grading scales
\`Rubrics/*.rubric.json\` and \`Rubrics/*.scale.json\` are the teacher's bank of rubrics and grading scales,
sorted by unit. Only the wording and percents are here: never scores or anything about a student.
Edit one in place (keep its "id"), or write a new file to add one (leave "id" out). Don't delete files;
the teacher deletes in the app.

Rubric: {
  "id": "…", "name": "Book cover formative",
  "unit": { "course": "<course from timetable.json>", "title": "<a unit's title from Units/>" },   // optional
  "criteria": ["Row 1 name", "Row 2 name", "Row 3 name"],        // each row is scored 4 to 1 (0 if needed), so 3 rows = out of 12
  "top": 8, "half": false,                                       // optional: a row's highest score when it isn't 4 (1 to 10), and false for whole numbers only
  "levels": [ { "4": "What a 4 looks like on row 1", "3": "…", "2": "…", "1": "…" }, { … }, { … } ],   // optional; "0" too if wanted
  "scale": { "12": 100, "11": 95, "10": 90, … }                  // optional: total points -> percent; null = plain share of points
}
Grading scale: { "id": "…", "name": "Out of 12, steps of 5", "unit": { … }, "scale": { "12": 100, "11": 95, … , "0": 40 } }
`;
// src/planner/review.js
const STATUS = { claude: 'With the assistant', review: 'Ready for you' };   // the chip's words are read when it is drawn (statusSay): the assistant's name is the teacher's own
// src/planner/review.js
const statusSay = k => k === 'claude' ? 'With ' + plAi() : STATUS[k];
// src/planner/review.js
const minsOf = s => { const m = /^(\d+):(\d\d)/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : 0; };
// src/planner/lessons.js
const L = { db: null, lessons: [], units: [], setup: null, view: 'week', weekOf: null, open: null, cur: 0, dir: null, dirOk: false, tplImg: null, unit: null };
// src/planner/lessons.js
const LDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// src/planner/lessons.js
const LDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// src/planner/lessons.js
const LMONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// src/planner/lessons.js
const LAYOUTS = { title: 'Title', agenda: 'Agenda', objectives: 'Objectives', warmup: 'Warm-up', exit: 'Exit ticket', steps: 'Directions with steps', discuss: 'Discussion question', content: 'Title and text', twocol: 'Two columns', text: 'Plain text', passage: 'Passage', vocab: 'Vocabulary', picture: 'Picture', fullpic: 'Full picture', textpic: 'Text + picture', picprompt: 'Picture + questions', video: 'Video' };
// src/planner/lessons.js
const SIZES = [28, 30, 32, 34, 36];   // slide text stays between 28 and 36 pt, big enough to read from the back of the room
// src/planner/lessons.js
const SIZES_ANY = [18, 20, 24, 28, 30, 32, 34, 36, 40, 44];
// src/planner/lessons.js
const deckRule = () => (L.setup && L.setup.deck) || {};
// src/planner/lessons.js
const deckAgenda = () => deckRule().agenda !== false;
// src/planner/lessons.js
const deckSizes = () => deckRule().sizes === 'any' ? SIZES_ANY : SIZES;
// src/planner/lessons.js
const deckAdd = () => LAYOUTS[deckRule().add] && deckRule().add !== 'title' ? deckRule().add : 'content';   // what + Add slide adds
// src/planner/lessons.js
const deckSizeSay = () => { const z = deckSizes(); return z[0] + ' to ' + z[z.length - 1]; };
// src/planner/lessons.js
function deckClean(d) { const o = {}; if (d && d.agenda === false) o.agenda = false; if (d && d.sizes === 'any') o.sizes = 'any'; if (d && LAYOUTS[d.add] && d.add !== 'content' && d.add !== 'title') o.add = d.add; return Object.keys(o).length ? o : null; }
// src/planner/lessons.js
const meetsOn = (dow, cs) => (cs || (L.setup && L.setup.classes) || []).some(c => (c.meets || []).some(m => +m.dow === dow));
// src/planner/lessons.js
const plWeekOffs = () => [...(meetsOn(0) ? [-1] : []), 0, 1, 2, 3, 4, ...(meetsOn(6) ? [5] : [])];
// src/planner/lessons.js
const plMd = d => { d = typeof d === 'string' ? parseYmd(d) : d; try { return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }); } catch { return (d.getMonth() + 1) + '/' + d.getDate(); } };
// src/planner/lessons.js
const lid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
// src/planner/lessons.js
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
// src/planner/lessons.js
const parseYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
// src/planner/lessons.js
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
// src/planner/lessons.js
const mondayOf = (d, sun = meetsOn(0)) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), sun && d.getDay() === 0 ? 1 : -((d.getDay() + 6) % 7));
// src/planner/lessons.js
const ordinal = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
// src/planner/lessons.js
const longDate = s => { const d = parseYmd(s); return LDAYS_LONG[d.getDay()] + ' ' + LMONTHS[d.getMonth()] + ' ' + ordinal(d.getDate()) + ' ' + d.getFullYear(); };
// src/planner/lessons.js
const shortDate = s => { const d = parseYmd(s); return LDAYS[d.getDay()] + ' ' + plMd(d); };
// src/planner/lessons.js
const hm = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return (h % 12 || 12) + ':' + String(m).padStart(2, '0'); };
// src/planner/lessons.js
function normSlide(s) {
  s = s && typeof s === 'object' ? s : {};
  const layout = LAYOUTS[s.layout] ? s.layout : 'content';
  const size = deckSizes().includes(+s.size) ? +s.size : 28;
  const out = { id: typeof s.id === 'string' ? s.id : lid(), layout, title: String(s.title || ''), body: String(s.body || '').replace(/\r/g, ''), size, notes: String(s.notes || ''),
    ask: String(s.ask || ''), talk: (Array.isArray(s.talk) ? s.talk : []).filter(t => t && t.text).map(t => ({ by: t.by === 'claude' ? 'claude' : 'you', text: String(t.text), at: +t.at || 0, ...(t.done ? { done: true } : {}) })) };
  for (const k of EXTRA) if (s[k]) out[k] = String(s[k]).replace(/\r/g, '');
  if (s.img && typeof s.img === 'object' && typeof s.img.src === 'string') out.img = { src: s.img.src, w: +s.img.w || 0, h: +s.img.h || 0, source: String(s.img.source || '') };
  const ctx = (Array.isArray(s.ctx) ? s.ctx : []).filter(c => c && typeof c.src === 'string').map(c => ({ id: typeof c.id === 'string' && c.id ? c.id : lid(), src: c.src, w: +c.w || 0, h: +c.h || 0, note: String(c.note || '') }));
  if (ctx.length) out.ctx = ctx;
  if (s.video && typeof s.video === 'object' && /^https?:\/\//.test(s.video.url)) {
    const v = s.video;
    out.video = { url: String(v.url), title: String(v.title || ''), by: String(v.by || ''), start: Math.max(0, Math.round(+v.start || 0)) };
    if (typeof v.thumb === 'string' && /^data:image\/(png|jpeg);base64,/.test(v.thumb)) out.video.thumb = v.thumb;
  }
  if (+s.fmt !== 2) rtMigrate(out);
  out.fmt = 2;
  return normBoxes(s, out);   // the teacher's own text sizes and box places (boxes.js)
}
// src/planner/lessons.js
function normLesson(x) {
  x = x && typeof x === 'object' ? x : {};
  const slots = Array.isArray(x.slots) ? x.slots.filter(t => t && typeof t.classId === 'string' && /^\d{4}-\d\d-\d\d$/.test(t.date)).map(t => ({ classId: t.classId, date: t.date })) : [];
  // fmt: 2 on the lesson means every slide's text is written out as it shows (bullets and numbers are in the text).
  const fmt = +x.fmt === 2, ns = s => normSlide(fmt && s && typeof s === 'object' ? { ...s, fmt: 2 } : s);
  const slides = Array.isArray(x.slides) && x.slides.length ? x.slides.map(ns) : [normSlide({ layout: 'title', fmt: 2 })];
  const out = { id: typeof x.id === 'string' && x.id ? x.id : lid(), title: String(x.title || 'Untitled lesson'), slots, slides, created: +x.created || Date.now(), updated: +x.updated || Date.now(), note: String(x.note || ''),
    status: STATUS[x.status] ? x.status : '', claudeNote: String(x.claudeNote || ''), fmt: 2 };
  // Comments on the whole lesson, both ways, the same shape as a slide's "talk".
  const talk = (Array.isArray(x.talk) ? x.talk : []).filter(t => t && t.text).map(t => ({ by: t.by === 'claude' ? 'claude' : 'you', text: String(t.text), at: +t.at || 0, ...(t.done ? { done: true } : {}) }));
  if (talk.length) out.talk = talk;
  if (x.titleApart) out.titleApart = true;
  const taught = normTaught(x.taught); if (taught.length) out.taught = taught;   // where each class got to (present.js)
  if (LOOKS[x.look]) out.look = x.look;
  if (/^https?:\/\//.test(x.atlas || '')) out.atlas = String(x.atlas);
  if (x.library) out.library = String(x.library).slice(0, 120);
  if (x.unit) out.unit = String(x.unit);
  if (typeof x.variantOf === 'string' && x.variantOf && x.variantOf !== out.id) out.variantOf = x.variantOf;
  if (x.variant) out.variant = String(x.variant).slice(0, 60);
  if (typeof x.notebook === 'string' && x.notebook.trim()) out.notebook = nbClean(x.notebook);
  const files = (Array.isArray(x.files) ? x.files : []).filter(f => f && typeof f.id === 'string' && typeof f.name === 'string').map(f => ({ id: f.id, name: f.name, kind: f.kind === 'doc' ? 'doc' : 'other', type: String(f.type || ''), size: +f.size || 0, added: +f.added || 0 }));
  if (files.length) out.files = files;
  const links = normLinks(x.links); if (links.length) out.links = links;   // web pages for this lesson (links.js)
  const fin = f => f && typeof f.id === 'string' && typeof f.name === 'string' ? { id: f.id, name: f.name, size: +f.size || 0, at: +f.at || 0, sig: String(f.sig || '') } : null;
  if (fin(x.final)) out.final = fin(x.final);
  if (x.ready && typeof x.ready === 'object' && +x.ready.at > 0) out.ready = { at: +x.ready.at };   // she said it is ready to teach (plfocus.js)
  const finals = (Array.isArray(x.finals) ? x.finals : []).map(fin).filter(Boolean);
  if (finals.length) out.finals = finals;
  if (x.pending && Array.isArray(x.pending.before)) out.pending = { at: +x.pending.at || Date.now(), before: x.pending.before.map(ns), title: String(x.pending.title || '') };
  if (x._file) out._file = x._file; if (x._mod) out._mod = x._mod;
  return out;
}
// src/planner/lessons.js
function deckStart(l) {
  const sl = l.slides, first = (l.slots.map(s => s.date).sort()[0]) || '';
  let t = sl.findIndex(s => s.layout === 'title');
  if (t < 0) sl.unshift(normSlide({ layout: 'title', title: l.title, fmt: 2 }));
  else if (t > 0) sl.unshift(sl.splice(t, 1)[0]);
  if (!deckAgenda()) return l;   // this teacher's decks don't open with an agenda
  const a = sl.findIndex((s, i) => i > 0 && s.layout === 'agenda');
  if (a < 0) sl.splice(1, 0, normSlide({ layout: 'agenda', title: (first ? plMd(first) + ' ' : '') + 'Agenda', fmt: 2 }));
  else if (a > 1) sl.splice(1, 0, sl.splice(a, 1)[0]);
  return l;
}
// src/planner/lessons.js
const titleSlideOf = l => l.slides.find(s => s.layout === 'title');
// src/planner/lessons.js
const titlesLinked = l => !l.titleApart;
// src/planner/lessons.js
const classById = id => ((L.setup && L.setup.classes) || []).find(c => c.id === id);
// src/planner/lessons.js
const className = id => { const c = classById(id); return c ? c.name : id; };
// src/planner/lessons.js
function plWords() {
  let w = null; try { w = JSON.parse(localStorage.getItem('gs.words') || 'null'); } catch { }
  w = (w && typeof w === 'object' ? w : null) || L.words || (L.setup ? { sys: 'ManageBac', unit: 'Atlas', scale12: true, ai: 'Claude' } : { sys: '', unit: '', ai: '' });
  // ai: the teacher's AI assistant by name. Words kept before it was asked say nothing about it, and that teacher had Claude's words.
  return { sys: String(w.sys || '').trim().slice(0, 40), unit: String(w.unit || '').trim().slice(0, 40), scale12: !!w.scale12, ai: String(w.ai == null ? (w.scale12 ? 'Claude' : '') : w.ai).trim().slice(0, 30) };   // scale12: the rubric bank offers the 12-point scale as a preset
}
// src/planner/lessons.js
function plAi() { return plWords().ai || 'your AI assistant'; }
// src/planner/lessons.js
function PlAi() { return plWords().ai || 'Your AI assistant'; }
// src/planner/lessons.js
const dayOff = date => ((L.setup && L.setup.daysOff) || []).find(d => d.date === date);
// src/planner/lessons.js
const eventsOn = date => ((L.setup && L.setup.events) || []).filter(e => e.date === date || (e.to && e.date <= date && date <= e.to));
// src/planner/lessons.js
function meetingsOn(date) {
  if (!L.setup || dayOff(date)) return [];
  const dow = parseYmd(date).getDay(), out = [];
  for (const c of L.setup.classes || []) for (const m of c.meets || []) if (+m.dow === dow) out.push({ c, m, date });
  return out.sort((a, b) => (a.m.start || '').localeCompare(b.m.start || ''));
}
// src/planner/lessons.js
const lessonsAt = (classId, date) => L.lessons.filter(l => l.slots.some(s => s.classId === classId && s.date === date));
// src/planner/lessons.js
function partnerSlots(classId, date) {
  const c = classById(classId); if (!c || !c.course) return [];
  const mon = mondayOf(parseYmd(date)), week = [-1, 0, 1, 2, 3, 4, 5].map(i => ymd(addDays(mon, i))).filter(d => +mondayOf(parseYmd(d)) === +mon);
  const nth = week.flatMap(d => meetingsOn(d).filter(x => x.c.id === classId).map(x => x.date)).indexOf(date);
  const out = [];
  for (const o of L.setup.classes) {
    if (o.id === classId || o.course !== c.course) continue;
    const theirs = week.flatMap(d => meetingsOn(d).filter(x => x.c.id === o.id).map(x => x.date));
    const d = theirs[nth]; if (d && !lessonsAt(o.id, d).length) out.push({ classId: o.id, date: d });
  }
  return out;
}
// src/planner/lessons.js
const PT = 4 / 3;
// src/planner/lessons.js
function bodyLines(body) { return String(body || '').split('\n').map(t => { const m = /^(\t| {2,})/.exec(t); return { lvl: m ? 1 : 0, text: t.replace(/^\s+/, '') }; }).filter((x, i, a) => x.text || i < a.length - 1); }
// src/planner/lessons.js
function slideHtml(s, lesson, edit) {
  const look = lookOf(lesson), titleSlide = s.layout === 'title';
  return '<div class="ls-lk lk-' + look + (titleSlide ? ' ls-tslide' : '') + '" style="' + lookVars(look) + '">' +
    lookShapes(look, titleSlide).map(([x, y, w, h, f, ln]) => '<div class="ls-shape" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;' + (f ? 'background:' + f : '') + (ln ? ';border:' + ln[1] + 'px solid ' + ln[0] + ';border-radius:6px;box-sizing:border-box' : '') + '"></div>').join('') +
    slideInner(s, lesson, edit, look) + '</div>';
}
// src/planner/lessons.js
function slideInner(s, lesson, edit, look) {
  const sz = s.size * PT, cap = t => esc(t);
  let h = '<div class="ls-bg"></div><div class="ls-fade"></div><div class="ls-wood"' + (L.tplImg ? ' style="background-image:url(' + L.tplImg + ')"' : '') + '></div>';
  const ed = (k, cls, text, ph) => '<div class="' + cls + (edit ? ' ls-ed' : '') + '" data-k="' + k + '"' + (boxStyle(s, k) ? ' style="' + boxStyle(s, k) + '"' : '') + (edit ? ' tabindex="0"' : '') + '>' + (text ? cap(text) : edit ? '<span class="ls-ph">' + ph + '</span>' : '') + '</div>';
  if (s.layout === 'title') {
    h += ed('title', 'ls-ttl', s.title, 'Click to add a title');
    h += '<div class="ls-trule"></div>';
    const sub = s.body ? s.body : titleSubtitle(lesson);
    h += '<div class="ls-sub' + (edit ? ' ls-ed' : '') + '" data-k="sub"' + (boxStyle(s, 'sub') ? ' style="' + boxStyle(s, 'sub') + '"' : '') + (edit ? ' tabindex="0"' : '') + '>' + sub.split('\n').map(esc).join('<br>') + '</div>';
    return h;
  }
  if (s.layout === 'fullpic') {   // the picture is the whole slide; the slide's name is kept for the list of slides, not shown
    const F = FULLPIC;
    h += '<div class="ls-pic ls-full' + (edit ? ' ls-ed' : '') + '" data-k="img" style="left:' + F.x + 'px;top:' + F.y + 'px;width:' + F.w + 'px;height:' + F.h + 'px">' + (s.img ? '<img src="' + esc(imgSrc(s.img.src)) + '" alt="">' : edit ? '<span class="ls-ph">Click to add a picture, or drag one in</span>' : '') + '</div>';
    h += '<div class="ls-src ls-fullsrc' + (edit ? ' ls-ed' : '') + '" data-k="source"' + (edit ? ' tabindex="0"' : '') + '>' + (s.img && s.img.source ? esc(s.img.source) : edit && s.img ? '<span class="ls-ph">Add the source line for this picture</span>' : '') + '</div>';
    return h;
  }
  h += ed('title', 'ls-t', s.title, TITLE_PH[s.layout] || 'Click to add a title') + '<div class="ls-rule"></div>';
  if (isTeach(s)) return h + teachHtml(s, edit, look);
  if (s.layout === 'video') {
    const v = s.video, yt = v && ytId(v.url), th = v && (v.thumb || (yt ? 'https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg' : ''));
    h += '<div class="ls-vid' + (edit ? ' ls-ed' : '') + '" data-k="video">' + (v ? (th ? '<img src="' + esc(th) + '" alt="">' : '<div class="ls-vlink">' + esc(v.url) + '</div>') + (th ? '<span class="ls-play" aria-hidden="true"></span>' : '') : edit ? '<span class="ls-ph">Click to add a video link (YouTube or any web link)</span>' : '') + '</div>';
    h += '<div class="ls-src">' + (v ? esc(videoSource(v)) : '') + '</div>';
    return h;
  }
  if (s.layout === 'picture') {
    h += '<div class="ls-pic' + (edit ? ' ls-ed' : '') + '" data-k="img">' + (s.img ? '<img src="' + esc(imgSrc(s.img.src)) + '" alt="">' : edit ? '<span class="ls-ph">Click to add a picture</span>' : '') + '</div>';
    h += '<div class="ls-src' + (edit ? ' ls-ed' : '') + '" data-k="source"' + (edit ? ' tabindex="0"' : '') + '>' + (s.img && s.img.source ? esc(s.img.source) : edit && s.img ? '<span class="ls-ph">Add the source line for this picture</span>' : '') + '</div>';
    return h;
  }
  const inner = s.body.trim() ? rtHtml(s.body) : edit ? '<span class="ls-ph">' + (BODY_PH[s.layout] || 'Click to add text') + '</span>' : '';
  h += '<div class="ls-body ls-' + (s.layout === 'objectives' ? 'agenda' : s.layout) + (edit ? ' ls-ed' : '') + '" data-k="body" style="' + boxStyle(s, 'body') + 'font-size:' + sz + 'px"' + (edit ? ' tabindex="0"' : '') + '>' + inner + '</div>';
  return h;
}
// src/planner/lessons.js
function titleSubtitle(lesson) {
  const courses = [...new Set(lesson.slots.map(s => (classById(s.classId) || {}).course || className(s.classId)))];
  const dates = [...new Set(lesson.slots.map(s => s.date))].sort();
  return [courses.join(' / '), ...dates.map(longDate)].filter(Boolean).join('\n');
}
// src/planner/lessons.js
const imgSrc = src => /^(data:image\/|blob:)/.test(src) ? src : '';
// src/planner/lessons.js
function ytId(u) {
  try {
    const x = new URL(u), h = x.hostname.replace(/^(www|m|music)\./, '');
    if (h === 'youtu.be') return /^[\w-]{11}$/.test(x.pathname.slice(1, 12)) ? x.pathname.slice(1, 12) : '';
    if (h === 'youtube.com' || h === 'youtube-nocookie.com') { const v = x.searchParams.get('v') || (/^\/(shorts|embed|live)\/([\w-]{11})/.exec(x.pathname) || [])[2]; return /^[\w-]{11}$/.test(v || '') ? v : ''; }
  } catch { }
  return '';
}
// src/planner/lessons.js
function ytStart(u) { try { const t = new URL(u).searchParams.get('t') || ''; const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; } catch { return 0; } }
// src/planner/lessons.js
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
// src/planner/lessons.js
const mmss = t => Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
// src/planner/lessons.js
function videoLink(v) { const id = ytId(v.url); return id ? 'https://www.youtube.com/watch?v=' + id + (v.start ? '&t=' + v.start + 's' : '') : v.url; }
// src/planner/lessons.js
function videoSource(v) { return (v.title ? v.title + ' · ' : '') + (ytId(v.url) ? 'YouTube' + (v.by ? ', ' + v.by : '') : hostOf(v.url)) + (v.start ? ' · starts at ' + mmss(v.start) : ''); }
// src/planner/lessons.js
async function shrinkPic(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const x = new Image(); x.onload = () => res(x); x.onerror = rej; x.src = url; });
    const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
    const png = /png|gif|webp/.test(file.type) && c.width * c.height < 1.2e6;
    return { src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86), w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}
// src/planner/lessons.js
const boxLessonNotes = l => ((SP.box && SP.box.chips) || []).filter(c => c && c.kind === 'note' && c.about && c.about.kind === 'lesson' && c.about.lesson === l.id && String(c.text || '').trim());
// src/planner/lessons.js
const lessonNotes = l => { const mine = (l.talk || []).filter(t => t.by === 'you' && !t.done).map(t => t.text.trim()), all = (l.talk || []).map(t => t.text.trim()); return [...mine, ...boxLessonNotes(l).map(c => String(c.text).trim()).filter(t => !all.includes(t))]; };
// src/planner/lessons.js
function boxNotesToSlides(l) {
  let n = 0;
  for (const c of boxLessonNotes(l)) { const t = String(c.text).trim(); if ((l.talk || []).some(m => m.text === t)) continue; (l.talk = l.talk || []).push({ by: 'you', text: t, at: +c.at || Date.now() }); n++; }
  for (const c of (SP.box && SP.box.chips) || []) {
    const a = c && c.kind === 'note' && c.about; if (!a || a.kind !== 'slide' || a.lesson !== l.id) continue;
    const s = l.slides[a.i], t = String(c.text || '').trim(); if (!s || !t || s.talk.some(m => m.text === t)) continue;
    s.talk.push({ by: 'you', text: t, at: +c.at || Date.now() }); n++;
  }
  return n;
}
// src/planner/lessons.js
function lessonText(l) {
  boxNotesToSlides(l);
  let t = '# ' + l.title + (l.variantOf || l.variant ? ' (version: ' + varName(l) + ')' : '') + '\n' + (l.slots.length ? l.slots.map(s => className(s.classId) + ', ' + longDate(s.date)).join('; ') + '\n' : '');
  // Right-click comments on the whole lesson live in the Claude box; Claude needs them with the lesson too.
  for (const x of lessonNotes(l)) t += 'My comment on the whole lesson: ' + x + '\n';
  t += taughtText(l);
  l.slides.forEach((s, i) => {
    t += '\n## Slide ' + (i + 1) + ' (' + LAYOUTS[s.layout] + (s.layout !== 'title' && s.layout !== 'picture' && s.layout !== 'fullpic' ? ', ' + s.size + ' pt' : '') + ')\n' + (s.title ? 'Title: ' + s.title + '\n' : '');
    for (const k of EXTRA) if (s[k] && k !== 'body2') t += k + ': ' + s[k] + '\n';
    if (s.body2) t += 'body2:\n' + s.body2 + '\n';
    if (s.body) t += s.body + '\n';
    if (s.img) t += '[Picture' + (s.img.source ? ': ' + s.img.source : '') + ']\n';
    if (s.video) t += '[Video: ' + s.video.url + (s.video.title ? ' (' + videoSource(s.video) + ')' : '') + ']\n';
    if (s.notes) t += 'Notes: ' + s.notes + '\n';
    if (s.ask) t += 'What I want on this slide: ' + s.ask + '\n';
    for (const c of s.ctx || []) t += '[Screenshot for context, not on the slide' + (c.note ? ': ' + c.note : '') + ']\n';
    for (const m of s.talk) if (!m.done) t += (m.by === 'claude' ? PlAi() + ': ' : 'My comment: ') + m.text + '\n';
  });
  if (l.notebook) t += '\n## My notebook for this lesson\n' + nbText(l.notebook) + '\n';
  return t;
}
// src/planner/lessons.js
const b64ToU8 = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
// src/planner/lessons.js
const xe = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
// src/planner/lessons.js
async function tplPreview() {
  L.tplImg = null;
  if (!L.setup || !L.setup.template) return;
  try {
    const z = fflate.unzipSync(b64ToU8(L.setup.template));
    const rels = new TextDecoder().decode(z['ppt/slideMasters/_rels/slideMaster1.xml.rels'] || new Uint8Array());
    const m = /Target="\.\.\/media\/([^"]+\.(?:jpe?g|png))"/i.exec(rels);
    if (m && z['ppt/media/' + m[1]]) L.tplImg = URL.createObjectURL(new Blob([z['ppt/media/' + m[1]]], { type: /png$/i.test(m[1]) ? 'image/png' : 'image/jpeg' }));
  } catch { }
}
// src/planner/lessons.js
function tplLayouts(z) {   // which layout file is Title Slide / Title and Content / Title Only in this template
  const out = {}, td = new TextDecoder();
  for (const k of Object.keys(z)) {
    const m = /^ppt\/slideLayouts\/(slideLayout\d+\.xml)$/.exec(k); if (!m) continue;
    const n = (/<p:cSld name="([^"]*)"/.exec(td.decode(z[k])) || [])[1];
    if (n) out[n] = m[1];
  }
  return { title: out['Title Slide'], content: out['Title and Content'], only: out['Title Only'] || out['Title and Content'] };
}
// src/planner/lessons.js
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
// src/planner/lessons.js
const xfrm = b => b ? '<p:spPr><a:xfrm><a:off x="' + Math.round(b.x * EX) + '" y="' + Math.round(b.y * EY) + '"/><a:ext cx="' + Math.round(b.w * EX) + '" cy="' + Math.round(b.h * EY) + '"/></a:xfrm></p:spPr>' : '<p:spPr/>';
// src/planner/lessons.js
const spPh = (id, name, ph, body, bodyPr, xf) => '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="' + name + '"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>' + ph + '</p:nvPr></p:nvSpPr>' + xfrm(xf) + '<p:txBody>' + (bodyPr || '<a:bodyPr/>') + '<a:lstStyle/>' + body + '</p:txBody></p:sp>';
// src/planner/lessons.js
let pxLook = 'wood';
// src/planner/lessons.js
const run = (t, sz, o) => pxLook !== 'wood' ? lookRun(t, sz, o || {}, pxLook) : '<a:r><a:rPr lang="en-US"' + (sz ? ' sz="' + sz * 100 + '"' : '') + (o && o.b ? ' b="1"' : '') + (o && o.i ? ' i="1"' : '') + (o && o.u ? ' u="sng"' : '') + ' dirty="0"' + (o && RT_COLORS[o.c] ? '><a:solidFill><a:srgbClr val="' + RT_COLORS[o.c].slice(1) + '"/></a:solidFill></a:rPr>' : '/>') + '<a:t>' + xe(t) + '</a:t></a:r>';
// src/planner/lessons.js
const buClr = () => pxLook !== 'wood' ? '<a:buClr><a:srgbClr val="' + hex(LOOKS[pxLook].accent) + '"/></a:buClr>' : '';
// src/planner/lessons.js
function slideXml(s, lesson, media) {
  pxLook = lookOf(lesson);
  const xml = slideXmlIn(s, lesson, media), look = pxLook; pxLook = 'wood';
  if (look === 'wood') return xml;
  // Another look: its own background, the template's background pictures hidden, its shapes behind the text.
  return xml.replace('<p:sld ' + NS + '><p:cSld>', '<p:sld ' + NS + ' showMasterSp="0"><p:cSld>' + lookBgXml(look))
    .replace('<p:grpSpPr/>', '<p:grpSpPr/>' + lookShapesXml(look, s.layout === 'title'));
}
// src/planner/lessons.js
function slideXmlIn(s, lesson, media) {
  let tree = '';
  const bx = k => s.box && s.box[k], fz = k => (s.fs && s.fs[k]) || 0;
  if (s.layout === 'title') {
    tree += spPh(2, 'Title 1', '<p:ph type="ctrTitle"/>', '<a:p>' + run(s.title || lesson.title, fz('title'), { title: 1 }) + '</a:p>', null, bx('title'));
    const sub = (s.body || titleSubtitle(lesson)).split('\n');
    tree += spPh(3, 'Subtitle 2', '<p:ph type="subTitle" idx="1"/>', sub.map(x => '<a:p>' + (x ? run(x, fz('sub'), { sub: 1 }) : '<a:endParaRPr lang="en-US"/>') + '</a:p>').join(''), null, bx('sub'));
  } else {
    tree += spPh(2, 'Title 1', '<p:ph type="title"/>', '<a:p>' + (s.title ? run(s.title, fz('title'), { title: 1 }) : '<a:endParaRPr lang="en-US"/>') + '</a:p>', null, bx('title'));
    if (isTeach(s)) tree += teachXml(s, pxLook, media);
    else if (s.layout === 'video') {
      if (s.video) {
        // The video's picture, which opens the video when clicked in the show, and its title as a link under it.
        const X = 1453896, Y = 2015732, W = 9607522, H = 3900000, tw = 480, th = 360, r = Math.min(W / tw, H / th);
        const w = Math.round(tw * r), h = Math.round(th * r), x = X + Math.round((W - w) / 2), link = '<a:hlinkClick r:id="rIdLink"/>';
        if (media) tree += '<p:pic><p:nvPicPr><p:cNvPr id="4" name="Video 3" descr="' + xe(videoSource(s.video)) + '">' + link + '</p:cNvPr><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rIdImg"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="' + x + '" y="' + Y + '"/><a:ext cx="' + w + '" cy="' + h + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
        const cy = media ? Y + h + 30000 : Y, txt = media ? videoSource(s.video) : (s.video.title ? videoSource(s.video) + ': ' : '') + s.video.url, sz = media ? 1000 : 2800;
        tree += '<p:sp><p:nvSpPr><p:cNvPr id="5" name="Video link 4"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + X + '" y="' + cy + '"/><a:ext cx="' + W + '" cy="' + (media ? 260000 : 900000) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="' + sz + '" dirty="0">' + link + '</a:rPr><a:t>' + xe(txt) + '</a:t></a:r></a:p></p:txBody></p:sp>';
      }
    } else if (s.layout === 'fullpic') {
      // The picture over the whole slide, on the look's background, which also covers the title kept for the outline.
      const F = FULLPIC, look = pxLook;
      tree += shapeXml(8, [0, 0, 1280, 720, LOOKS[look].bg]);
      if (s.img && media) {
        tree += picXml(4, picFit(s.img, F));
        if (s.img.source) tree += teachBoxXml(9, { k: '_src', x: 0, y: 696, w: 1280, h: 20, sz: 10, col: 'text', algn: 'ctr' }, { _src: s.img.source }, look);
      }
    } else if (s.layout === 'picture') {
      if (s.img && media) {
        // Fit the picture under the title rule, centered, with the source line under it.
        const X = 1453896, Y = 2015732, W = 9607522, H = 3900000, r = Math.min(W / s.img.w, H / s.img.h);
        const w = Math.round(s.img.w * r), h = Math.round(s.img.h * r), x = X + Math.round((W - w) / 2);
        tree += '<p:pic><p:nvPicPr><p:cNvPr id="4" name="Picture 3"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rIdImg"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="' + x + '" y="' + Y + '"/><a:ext cx="' + w + '" cy="' + h + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
        if (s.img.source) tree += '<p:sp><p:nvSpPr><p:cNvPr id="5" name="Source 4"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + X + '" y="' + (Y + h + 30000) + '"/><a:ext cx="' + W + '" cy="260000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"/>' + run(s.img.source, 10) + '</a:p></p:txBody></p:sp>';
      }
    } else {
      const ps = s.body.trim() ? rtParasXml(s.body, { sz: s.size, lvlMar: 457200, bulMar: Math.round(.86 * s.size * 12700), numMar: Math.round(1.45 * s.size * 12700), gap: 10, buClr: buClr(), runFn: (t, f) => run(t, s.size, f) }) : '';
      tree += spPh(3, 'Content Placeholder 2', '<p:ph idx="1"/>', ps || '<a:p><a:endParaRPr lang="en-US"/></a:p>', '<a:bodyPr><a:noAutofit/></a:bodyPr>', bx('body'));
    }
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld ' + NS + '><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' + tree + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
}
// src/planner/lessons.js
const notesXml = t => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:notes ' + NS + '><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="3" sz="quarter"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>' + t.split('\n').map(x => '<a:p>' + (x ? run(x) : '') + '</a:p>').join('') + '</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>';
// src/planner/lessons.js
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
// src/planner/lessons.js
function buildPptx(lesson) {
  const z = fflate.unzipSync(tplBytes()), td = new TextDecoder(), te = new TextEncoder();
  const str = k => td.decode(z[k]), put = (k, s) => { z[k] = te.encode(s); };
  { const m = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(str('ppt/presentation.xml')); EX = m ? +m[1] / 1280 : 9525; EY = m ? +m[2] / 720 : 9525; }
  const lay = tplLayouts(z), hasNotes = Object.keys(z).some(k => /^ppt\/notesMasters\/notesMaster\d+\.xml$/.test(k));
  const nm = hasNotes ? Object.keys(z).find(k => /^ppt\/notesMasters\/notesMaster\d+\.xml$/.test(k)).split('/').pop() : '';
  let ct = str('[Content_Types].xml'), prel = str('ppt/_rels/presentation.xml.rels'), pres = str('ppt/presentation.xml'), ids = '';
  const exts = new Set();
  lesson.slides.forEach((s, i) => {
    const n = i + 1, layout = s.layout === 'title' ? lay.title : s.layout === 'picture' || s.layout === 'fullpic' || s.layout === 'video' || isTeach(s) ? lay.only : lay.content;
    let rels = '<Relationship Id="rId1" Type="' + REL + 'slideLayout" Target="../slideLayouts/' + layout + '"/>';
    let media = null;
    if (hasPic(s) && s.img && imgSrc(s.img.src)) {
      const m = /^data:image\/(png|jpeg);base64,(.*)$/.exec(s.img.src);
      if (m) { const ext = m[1] === 'png' ? 'png' : 'jpeg'; exts.add(ext); media = 'lesson' + n + '.' + ext; z['ppt/media/' + media] = b64ToU8(m[2]); rels += '<Relationship Id="rIdImg" Type="' + REL + 'image" Target="../media/' + media + '"/>'; }
    }
    if (s.layout === 'video' && s.video) {
      rels += '<Relationship Id="rIdLink" Type="' + REL + 'hyperlink" Target="' + xe(videoLink(s.video)) + '" TargetMode="External"/>';
      const m = /^data:image\/(png|jpeg);base64,(.*)$/.exec(s.video.thumb || '');
      if (m) { const ext = m[1] === 'png' ? 'png' : 'jpeg'; exts.add(ext); media = 'video' + n + '.' + ext; z['ppt/media/' + media] = b64ToU8(m[2]); rels += '<Relationship Id="rIdImg" Type="' + REL + 'image" Target="../media/' + media + '"/>'; }
    }
    if (hasNotes && s.notes) rels += '<Relationship Id="rIdN" Type="' + REL + 'notesSlide" Target="../notesSlides/notesSlide' + n + '.xml"/>';
    put('ppt/slides/slide' + n + '.xml', slideXml(s, lesson, media));
    put('ppt/slides/_rels/slide' + n + '.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '</Relationships>');
    ct = ct.replace('</Types>', '<Override PartName="/ppt/slides/slide' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>');
    if (hasNotes && s.notes) {
      put('ppt/notesSlides/notesSlide' + n + '.xml', notesXml(s.notes));
      put('ppt/notesSlides/_rels/notesSlide' + n + '.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + REL + 'notesMaster" Target="../notesMasters/' + nm + '"/><Relationship Id="rId2" Type="' + REL + 'slide" Target="../slides/slide' + n + '.xml"/></Relationships>');
      ct = ct.replace('</Types>', '<Override PartName="/ppt/notesSlides/notesSlide' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/></Types>');
    }
    prel = prel.replace('</Relationships>', '<Relationship Id="rIdS' + n + '" Type="' + REL + 'slide" Target="slides/slide' + n + '.xml"/></Relationships>');
    ids += '<p:sldId id="' + (255 + n) + '" r:id="rIdS' + n + '"/>';
  });
  for (const e of exts) if (!new RegExp('Extension="' + e + '"', 'i').test(ct)) ct = ct.replace('<Default ', '<Default Extension="' + e + '" ContentType="image/' + e + '"/><Default ');
  pres = pres.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>|<p:sldIdLst\/>/, '').replace('<p:sldSz', '<p:sldIdLst>' + ids + '</p:sldIdLst><p:sldSz');
  put('[Content_Types].xml', ct); put('ppt/_rels/presentation.xml.rels', prel); put('ppt/presentation.xml', pres);
  put('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office PowerPoint</Application><Slides>' + lesson.slides.length + '</Slides></Properties>');
  return fflate.zipSync(z);
}
// src/planner/lessons.js
function fileBase(l) {
  const d = l.slots.length ? [...new Set(l.slots.map(s => s.date))].sort()[0] : '';
  const md = d ? (parseYmd(d).getMonth() + 1) + '-' + String(parseYmd(d).getDate()).padStart(2, '0') + ' ' + LDAYS[parseYmd(d).getDay()] + ' - ' : '';
  return (md + (l.title || 'Lesson')).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 90);
}
// src/planner/lessons.js
const FOLDER_MARK = 'planner-folder.json';
// src/planner/lessons.js
const folderReadme = () => FOLDER_README.replace('@@SIZES@@', deckSizeSay()).replace('@@AGENDA@@', deckAgenda()
  ? 'Slide 1 is always the title slide and slide 2 always the agenda ("layout": "agenda"): the parts of the lesson in order,\none line each. Keep them there; the app puts them there in a new lesson.'
  : 'Slide 1 is always the title slide. Keep it there; the app puts it there in a new lesson.');
// src/planner/lessons.js
const FOLDER_README = `# Planner folder

The Planner (part of Grading Studio) keeps planning here so the teacher's AI assistant can read and edit it. Only planning is in
this folder: lessons, units, the timetable, files the teacher added to a unit, and rubrics and grading scales. Student work and grades
never are, and nothing here should point to a student.

## Files
- \`profile.json\` (if there): the teacher's profile; the app loads it when it changes. Don't edit it.
- \`timetable.json\`: classes (id, name, course, meets: dow 0=Sun, 1=Mon .. 6=Sat, start, end, label), days off,
  dates to show, and the semester's first and last Monday. Read it; the teacher changes it in the app.
- \`*.lesson.json\`: one lesson each. Edit in place and keep the "id". To add a lesson, write a new file
  ending in .lesson.json (leave "id" out). \`images/\` holds slide pictures ("img.src": "images/abc.jpg").
- \`Units/*.unit.json\`: one unit each (see below). Its files (screenshots of the unit plan, summative task sheets)
  are in the folder next to it with the same name plus " files".
- \`activities.json\`: the teacher's own activities, a list of { "name", "what", "kind" (talk, read, write,
  words, move, check), "parts" (warmup, activity, review), "group", "how": [steps for the teacher],
  "slide": [steps for students], "video" (optional: a web address of a video showing it in a classroom) }.
  Add or edit entries here; the built-in bank isn't in this file.

## Lesson shape
{
  "id": "…", "title": "Lesson name", "fmt": 2,
  "slots": [{ "classId": "<id from timetable.json>", "date": "2026-11-03" }],
  "slides": [
    { "layout": "title", "title": "Lesson name", "body": "" },
    { "layout": "agenda", "title": "11/3 Agenda", "body": "1. Warm-up\\n2. Activity\\n3. Review", "size": 28 },
    { "layout": "content", "title": "Slide title", "body": "• Point one\\n\\t• Smaller point under it", "size": 28, "notes": "Speaker notes" },
    { "layout": "text", "title": "The passage", "body": "Plain paragraphs, no bullets", "size": 28 },
    { "layout": "picture", "title": "Title", "img": { "src": "images/x.jpg", "w": 1600, "h": 900, "source": "Source line" } },
    { "layout": "video", "title": "Watch for the appeals", "video": { "url": "https://www.youtube.com/watch?v=…", "start": 30 } },
    { "layout": "warmup", "title": "Warm-up", "tag": "Journal", "body": "The prompt", "size": 36 },
    { "layout": "objectives", "title": "Today we will", "body": "1. First objective\\n2. Second objective" },
    { "layout": "steps", "title": "Gallery walk", "body": "1. Step one\\n2. Step two\\n3. Step three", "foot": "When you’re done: …" },
    { "layout": "discuss", "title": "Let’s talk", "body": "The question", "foot": "Think · Pair · Share" },
    { "layout": "twocol", "title": "…", "h1": "Left heading", "body": "Left points", "h2": "Right heading", "body2": "Right points" },
    { "layout": "passage", "title": "Close read", "body": "“The passage”", "cite": "Author, title, page", "foot": "The question" },
    { "layout": "fullpic", "title": "Name for the list of slides (not shown)", "img": { … } },
    { "layout": "textpic", "title": "Title", "body": "Text on the left", "img": { … } },
    { "layout": "picprompt", "title": "See · Think · Wonder", "img": { … }, "body": "Question one\\nQuestion two" },
    { "layout": "vocab", "title": "Word of the day", "word": "ethos", "pos": "noun", "body": "Meaning", "foot": "Example sentence" },
    { "layout": "exit", "title": "Exit ticket", "tag": "On a sticky note", "body": "The question" }
  ],
  "look": "wood",
  "atlas": "https://…",             // optional: this lesson's page in the school's curriculum tool (otherwise its unit's link is used)
  "links": [ { "name": "Article to read", "url": "https://…" } ]   // optional: web pages the teacher opens while teaching this lesson
}
"look" is the lesson's colors: wood (the teacher's template), white, cream, sage, sky, blush, charcoal, navy,
stripe, band, bigtype, framed, notebook, chalk. Leave it out to use the teacher's default; change it only when asked.
"ask", "talk", "status" and "claudeNote" are for working together, and are all optional:
- A lesson .zip (the teacher uploads it on a lesson): the finished .pptx plus handouts and files, flat or in folders.
  The .pptx becomes the finished PowerPoint; every other file goes into the lesson's materials. An optional lesson.json
  { "kind": "grading-studio-lesson-zip", "finished": "Deck.pptx", "materials": ["Handout.docx"] } picks the deck and the files.
- "variantOf" and "variant" (on a lesson) mark an alternative version of another lesson ("variantOf" is that lesson's id,
  "variant" its name, like "Shorter Friday"). It is a full lesson of its own; edit only the one you were asked about.
- "final" and "finals" (on a lesson) are the teacher's finished PowerPoint and older ones (the files stay in the app). Leave them as they are.
- "ready" (on a lesson) is { "at" }, set when the teacher said the lesson is ready to teach. Leave it as it is.
- "notebook" (on a lesson or unit) is the teacher's own jotted thoughts, as simple HTML. Read it for ideas; don't edit it.
- "taught" (on a lesson) is where each class got to when the lesson was taught: [{ "classId", "date", "slide" (the slide
  they reached, counting from 1), "of" (how many slides there were), "note" (the teacher's line for next time) }].
  Read it to plan what comes next; leave it as it is.
- A slide's "ask" is what the teacher wants on that slide. Use it, and leave it as it is.
- A slide's "ctx" is screenshots the teacher added for context (like assignment instructions), not shown on the slide:
  [{ "id", "src": "images/ctx-….png", "w", "h", "note": "what it is" }]. Open the image files and use them; leave "ctx" as it is.
  To put one on a slide, use its "src" as a picture slide's "img.src".
- A slide's "talk" is comments: { "by": "you" | "claude", "text": "…" }. Reply by adding one with "by": "claude".
  Don't edit or remove the teacher's comments.
- The lesson's own "talk" (same shape) is comments on the whole lesson: how it should go overall. Apply them across the
  slides, and reply there the same way.
- "status": "claude" means the teacher sent it to you; set it to "review" when you're done.
  "claudeNote" is your short summary of what you did.
The teacher sees your changes slide by slide and keeps theirs or yours for each, so change what the lesson needs and leave the rest.
For a video, give just "url" (and "start" in seconds, if it should start partway); the app adds the title, channel and picture.
Rules: "size" is @@SIZES@@ (pt). Text lines ("body", "body2", "foot") are separated by \\n and show exactly as written:
a line starting with "• " is a bullet, "1. " (any number) is a numbered line, anything else is plain. One or two
leading tabs indent the line. **bold**, *italic*, __underline__ and {red}colored words{/} (red, orange, green, blue,
purple, gray) work inside a line (a backslash shows a *, _ or { as is).
No layout adds bullets or numbers by itself, so add them only where the teacher would. Keep "fmt": 2 on the lesson.
A slide may have "fs" (the teacher's own text sizes for other boxes, like { "title": 34, "foot": 30 }) and "box" (boxes the
teacher moved or resized, like { "body": { "x": 152, "y": 211, "w": 1008, "h": 420 } } on a 1280 x 720 slide). Keep both as they are.
The lesson's "title" and the title slide's title are the same: change both together (unless the lesson has
"titleApart": true). @@AGENDA@@ An empty title-slide body means the app fills in the course and dates. Bump "updated" (milliseconds) when you change a lesson.

## Unit shape
{
  "id": "…", "course": "<course from timetable.json, like English 10>", "title": "Unit 2: Argument",
  "start": "2026-10-05",            // the Monday of the unit's first week
  "atlas": "https://…",             // the unit's page in the school's curriculum tool, if the teacher added it
  "weeks": [ { "focus": "What this week is about (from the unit plan)", "notes": "Teacher's own notes", "standards": "RL.1, RL.2" } ],
  "files": [ { "name": "Unit plan week 1-3.png", "kind": "atlas" }, { "name": "Summative task sheet.docx", "kind": "summative" } ]
}
To fill a unit's weeks from its unit plan screenshots: read the "atlas" files in its files folder and write each
week's focus (and standards, if shown) into "weeks", in order, one entry per week. Keep the teacher's "notes".
Don't add, rename or remove files in the files folder; the teacher adds those in the app.
` + BANK_README;
// src/planner/lessons.js
const ctxFile = (s, x) => { const m = /^data:image\/(png|jpeg);base64,/.exec(x.src); return m ? 'images/ctx-' + s.id + '-' + hash(x.src).slice(0, 8) + (m[1] === 'png' ? '.png' : '.jpg') : /^images\//.test(x.src) ? x.src : ''; };
// src/planner/lessons.js
function lessonForFile(l, imgs) {   // imgs: Map to collect pictures as separate files; null = keep them inline
  const c = JSON.parse(JSON.stringify(l));
  for (const s of c.slides) if (s.img && imgs) {
    const m = /^data:image\/(png|jpeg);base64,/.exec(s.img.src); if (!m) continue;
    const name = 'images/' + s.id + '-' + hash(s.img.src).slice(0, 8) + (m[1] === 'png' ? '.png' : '.jpg');
    imgs.set(name, s.img.src); s.img.src = name;
  }
  for (const s of c.slides) for (const x of s.ctx || []) if (imgs) {
    const m = /^data:image\/(png|jpeg);base64,/.exec(x.src); if (!m) continue;
    const name = ctxFile(s, x); imgs.set(name, x.src); x.src = name;
  }
  delete c._file; delete c._mod; delete c._sync; delete c.pending;
  return c;
}
// src/planner/plain.js
const PT_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
// src/planner/plain.js
const PT_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
// src/planner/plain.js
const PT_U = 9525;   // one slide unit (1280 x 720) in PowerPoint's own units
// src/planner/plain.js
const ptXfrm = (x, y, w, h) => '<a:xfrm><a:off x="' + x * PT_U + '" y="' + y * PT_U + '"/><a:ext cx="' + w * PT_U + '" cy="' + h * PT_U + '"/></a:xfrm>';
// src/planner/plain.js
const ptSp = (id, name, ph, box, body, anchor) => '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="' + name + '"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>' + ph + '</p:nvPr></p:nvSpPr><p:spPr>' + (box ? ptXfrm(...box) : '') + '</p:spPr><p:txBody><a:bodyPr' + (anchor ? ' anchor="' + anchor + '"' : '') + '><a:normAutofit/></a:bodyPr><a:lstStyle/>' + body + '</p:txBody></p:sp>';
// src/planner/plain.js
const ptTree = shapes => '<p:cSld{NAME}><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' + shapes + '</p:spTree></p:cSld>';
// src/planner/plain.js
const ptP = t => '<a:p><a:r><a:rPr lang="en-US"/><a:t>' + t + '</a:t></a:r></a:p>';
// src/planner/plain.js
const PT_TITLE = [153, 56, 1009, 124], PT_BODY = [153, 214, 1009, 446];
// src/planner/plain.js
function plainTplFiles() {
  const lvl = (n, mar, sz) => '<a:lvl' + n + 'pPr marL="' + mar + '" indent="' + (n === 1 ? -342900 : -285750) + '" algn="l" rtl="0"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc><a:spcBef><a:spcPts val="1000"/></a:spcBef><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/><a:defRPr sz="' + sz + '" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl' + n + 'pPr>';
  const master = PT_HEAD + '<p:sldMaster ' + PT_NS + '>' + ptTree(
    ptSp(2, 'Title Placeholder 1', '<p:ph type="title"/>', PT_TITLE, ptP('Click to edit the title'), 'b') +
    ptSp(3, 'Text Placeholder 2', '<p:ph type="body" idx="1"/>', PT_BODY, ptP('Click to edit the text'))).replace('{NAME}', '').replace('<p:spTree>', '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>') +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/><p:sldLayoutId id="2147483650" r:id="rId2"/><p:sldLayoutId id="2147483651" r:id="rId3"/></p:sldLayoutIdLst>' +
    '<p:txStyles><p:titleStyle><a:lvl1pPr algn="l" rtl="0"><a:lnSpc><a:spcPct val="90000"/></a:lnSpc><a:spcBef><a:spcPct val="0"/></a:spcBef><a:buNone/><a:defRPr sz="4000" b="1" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/><a:ea typeface="+mj-ea"/><a:cs typeface="+mj-cs"/></a:defRPr></a:lvl1pPr></p:titleStyle>' +
    '<p:bodyStyle>' + lvl(1, 342900, 3200) + lvl(2, 800100, 2800) + lvl(3, 1257300, 2800) + '</p:bodyStyle>' +
    '<p:otherStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:otherStyle></p:txStyles></p:sldMaster>';
  const layout = (name, type, shapes) => PT_HEAD + '<p:sldLayout ' + PT_NS + (type ? ' type="' + type + '"' : '') + ' preserve="1">' + ptTree(shapes).replace('{NAME}', ' name="' + name + '"') + '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';
  const center = '<a:lstStyle><a:lvl1pPr marL="0" indent="0" algn="ctr"><a:buNone/></a:lvl1pPr></a:lstStyle>';
  const layTitle = layout('Title Slide', 'title',
    ptSp(2, 'Title 1', '<p:ph type="ctrTitle"/>', [254, 150, 907, 206], ptP('Click to edit the title'), 'b').replace('<a:lstStyle/>', '<a:lstStyle><a:lvl1pPr algn="ctr"><a:defRPr sz="5400"/></a:lvl1pPr></a:lstStyle>') +
    ptSp(3, 'Subtitle 2', '<p:ph type="subTitle" idx="1"/>', [254, 388, 907, 170], ptP('Click to edit the subtitle')).replace('<a:lstStyle/>', center));
  const layContent = layout('Title and Content', 'obj', ptSp(2, 'Title 1', '<p:ph type="title"/>', null, ptP('Click to edit the title')) + ptSp(3, 'Content Placeholder 2', '<p:ph idx="1"/>', null, ptP('Click to edit the text')));
  const layOnly = layout('Title Only', 'titleOnly', ptSp(2, 'Title 1', '<p:ph type="title"/>', null, ptP('Click to edit the title')));
  const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>', line = w => '<a:ln w="' + w + '" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>';
  const clr = (n, v) => '<a:' + n + '><a:srgbClr val="' + v + '"/></a:' + n + '>', font = n => '<a:' + n + 'Font><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:' + n + 'Font>';
  const theme = PT_HEAD + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Plain"><a:themeElements><a:clrScheme name="Plain">' +
    clr('dk1', '000000') + clr('lt1', 'FFFFFF') + clr('dk2', '1F3A5F') + clr('lt2', 'EEF0F3') + clr('accent1', '1F6FB2') + clr('accent2', '7B3FC4') + clr('accent3', '0E7C86') + clr('accent4', 'A8327E') + clr('accent5', '3D4CB8') + clr('accent6', '9A5B13') + clr('hlink', '1F6FB2') + clr('folHlink', '7B3FC4') +
    '</a:clrScheme><a:fontScheme name="Plain">' + font('major') + font('minor') + '</a:fontScheme><a:fmtScheme name="Plain"><a:fillStyleLst>' + fill + fill + fill + '</a:fillStyleLst><a:lnStyleLst>' + line(6350) + line(12700) + line(19050) + '</a:lnStyleLst>' +
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>' + fill + fill + fill + '</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>';
  const rels = list => PT_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + list.map(([id, type, target]) => '<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/' + type + '" Target="' + target + '"/>').join('') + '</Relationships>';
  const CT = 'application/vnd.openxmlformats-officedocument.';
  return {
    '[Content_Types].xml': PT_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/ppt/presentation.xml" ContentType="' + CT + 'presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="' + CT + 'presentationml.slideMaster+xml"/>' +
      [1, 2, 3].map(n => '<Override PartName="/ppt/slideLayouts/slideLayout' + n + '.xml" ContentType="' + CT + 'presentationml.slideLayout+xml"/>').join('') +
      '<Override PartName="/ppt/theme/theme1.xml" ContentType="' + CT + 'theme+xml"/><Override PartName="/docProps/app.xml" ContentType="' + CT + 'extended-properties+xml"/></Types>',
    '_rels/.rels': rels([['rId1', 'officeDocument', 'ppt/presentation.xml'], ['rId2', 'extended-properties', 'docProps/app.xml']]),
    'docProps/app.xml': PT_HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office PowerPoint</Application><Slides>0</Slides></Properties>',
    'ppt/presentation.xml': PT_HEAD + '<p:presentation ' + PT_NS + '><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>',
    'ppt/_rels/presentation.xml.rels': rels([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rId2', 'theme', 'theme/theme1.xml']]),
    'ppt/slideMasters/slideMaster1.xml': master,
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'slideLayout', '../slideLayouts/slideLayout2.xml'], ['rId3', 'slideLayout', '../slideLayouts/slideLayout3.xml'], ['rId4', 'theme', '../theme/theme1.xml']]),
    'ppt/slideLayouts/slideLayout1.xml': layTitle, 'ppt/slideLayouts/slideLayout2.xml': layContent, 'ppt/slideLayouts/slideLayout3.xml': layOnly,
    ...Object.fromEntries([1, 2, 3].map(n => ['ppt/slideLayouts/_rels/slideLayout' + n + '.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']])])),
    'ppt/theme/theme1.xml': theme,
  };
}
// src/planner/plain.js
let plainTplBytes = null;
// src/planner/plain.js
function tplBytes() {
  if (L.setup && L.setup.template) return b64ToU8(L.setup.template);
  if (!plainTplBytes) { const te = new TextEncoder(), z = {}; for (const [k, v] of Object.entries(plainTplFiles())) z[k] = te.encode(v); plainTplBytes = fflate.zipSync(z); }
  return plainTplBytes;
}
// src/planner/plain.js
const ownTpl = () => !!(L.setup && L.setup.template);
// src/planner/looks.js
const LOOKS = {
  wood: { name: 'Gray + wood', bg: '#DFDBD5', text: '#000000', accent: '#B71E42', rule: 1, caps: 1 },
  white: { name: 'Plain White', bg: '#FFFFFF', text: '#000000', accent: '#1F3A5F', rule: 1 },
  cream: { name: 'Soft Cream', bg: '#FBF6EC', text: '#3A2E22', accent: '#A0522D', rule: 1, serif: 1 },
  sage: { name: 'Sage', bg: '#EEF3EC', text: '#1F2D24', accent: '#3E7A55', rule: 1 },
  sky: { name: 'Sky', bg: '#EAF3FB', text: '#14283D', accent: '#2B6CB0', rule: 1 },
  blush: { name: 'Blush', bg: '#FBEFF1', text: '#3A1F2A', accent: '#8E3B5E', rule: 1 },
  charcoal: { name: 'Charcoal', bg: '#2B2D30', text: '#F2F2F2', accent: '#F2C14E', rule: 1, dark: 1 },
  navy: { name: 'Navy Night', bg: '#152238', text: '#F4F1EA', accent: '#F08A6C', rule: 1, dark: 1 },
  stripe: { name: 'Side Stripe', bg: '#FFFFFF', text: '#000000', accent: '#2F7D6D', deco: 'stripe' },
  band: { name: 'Top Band', bg: '#FFFFFF', text: '#000000', accent: '#3B5BA9', title: '#FFFFFF', deco: 'band' },
  bigtype: { name: 'Big Type', bg: '#FFFFFF', text: '#111111', accent: '#111111', heavy: 1 },
  framed: { name: 'Framed Paper', bg: '#F3F3F1', text: '#000000', accent: '#5A5A5A', rule: 1, deco: 'frame' },
  notebook: { name: 'Notebook', bg: '#FDFCF7', text: '#1B2430', accent: '#2D5F8B', serif: 1, deco: 'notebook' },
  chalk: { name: 'Chalkboard', bg: '#2F3B33', text: '#F3F1E8', accent: '#E9D78A', rule: 1, dark: 1, deco: 'chalk' }
};
// src/planner/looks.js
const lookOf = l => { const k = LOOKS[l && l.look] ? l.look : (LOOKS[L.defLook] ? L.defLook : 'wood'); return k === 'wood' && !ownTpl() ? 'white' : k; };
// src/planner/looks.js
const lookVars = k => { const o = LOOKS[k]; return '--lbg:' + o.bg + ';--lt:' + o.text + ';--la:' + o.accent + ';--ltt:' + (o.title || o.text); };
// src/planner/looks.js
function lookShapes(k, titleSlide) {
  const o = LOOKS[k], out = [];
  if (o.deco === 'stripe') out.push([0, 0, 60, 720, o.accent]);
  if (o.deco === 'band' && !titleSlide) out.push([0, 0, 1280, 205, o.accent]);
  if (o.deco === 'band' && titleSlide) out.push([0, 0, 1280, 360, o.accent]);
  if (o.deco === 'frame') out.push([26, 26, 1228, 668, null, ['#9A9A96', 3]]);
  if (o.deco === 'notebook') { for (let y = 96; y < 720; y += 48) out.push([0, y, 1280, 2, '#B9D3EA']); out.push([120, 0, 3, 720, '#E8A0A0']); }
  if (o.deco === 'chalk') out.push([0, 0, 1280, 22, '#6B4A2E'], [0, 698, 1280, 22, '#6B4A2E'], [0, 0, 22, 720, '#6B4A2E'], [1258, 0, 22, 720, '#6B4A2E']);
  if (o.rule && k !== 'wood') out.push(titleSlide ? [254, 369, 907, 4, o.accent] : [153, 192, 1009, 4, o.accent]);
  return out;
}
// src/planner/looks.js
const EXTRA = ['tag', 'foot', 'h1', 'h2', 'body2', 'cite', 'word', 'pos'];
// src/planner/looks.js
const TEACH = {
  warmup: { size: 36 }, objectives: { size: 32 }, steps: { size: 32 }, discuss: { size: 36 }, twocol: { size: 28 },
  passage: { size: 30 }, picprompt: { size: 28 }, textpic: { size: 28 }, vocab: { size: 32 }, exit: { size: 36 }
};
// src/planner/looks.js
const TITLE_PH = { agenda: 'Agenda', objectives: 'Today we will', warmup: 'Warm-up', steps: 'Directions', discuss: 'Let’s talk', passage: 'Close read', picprompt: 'See · Think · Wonder', vocab: 'Word of the day', exit: 'Exit ticket' };
// src/planner/looks.js
const BODY_PH = { agenda: 'What you’ll do today, one line each', objectives: 'Your objectives, one line each', content: 'Click to add text', text: 'Click to add text' };
// src/planner/looks.js
const isTeach = s => !!TEACH[s.layout] && s.layout !== 'objectives';
// src/planner/looks.js
function teachBoxes(s) {
  return teachBoxesAt(s).map(b => ({ ...b, ...(s.box && s.box[b.k]), ...(b.k !== 'body' && s.fs && s.fs[b.k] ? { sz: s.fs[b.k] } : {}) }));
}
// src/planner/looks.js
function teachBoxesAt(s) {
  const z = s.size, B = (k, x, y, w, h, o) => ({ k, x, y, w, h, sz: z, col: 'text', ...o });
  switch (s.layout) {
    case 'warmup': case 'exit': return [
      B('tag', 152, 214, 1008, 48, { sz: 28, b: 1, caps: 1, col: 'accent', ph: s.layout === 'exit' ? 'Where they answer' : 'Kind of warm-up' }),
      B('body', 152, 276, 1008, 350, { ph: s.layout === 'exit' ? 'The exit question' : 'The warm-up prompt' })];
    case 'steps': return [
      B('body', 152, 214, 1008, 330, { list: 'num', gap: 10, ph: 'One step per line' }),
      B('foot', 152, 560, 1008, 76, { sz: 28, col: 'muted', ph: 'What to do when they’re done' })];
    case 'discuss': return [
      B('body', 192, 236, 928, 270, { algn: 'ctr', anchor: 'ctr', b: 1, ph: 'The question' }),
      B('foot', 152, 530, 1008, 96, { sz: 28, algn: 'ctr', col: 'muted', ph: 'How they talk about it' })];
    case 'twocol': return [
      B('h1', 152, 214, 484, 48, { sz: 28, b: 1, ph: 'Left heading' }), B('h2', 676, 214, 484, 48, { sz: 28, b: 1, ph: 'Right heading' }),
      B('body', 152, 280, 484, 350, { list: 'bullet', gap: 8, ph: 'Left side, one point per line' }),
      B('body2', 676, 280, 484, 350, { list: 'bullet', gap: 8, ph: 'Right side, one point per line' })];
    case 'passage': return [
      B('body', 186, 214, 974, 262, { serif: 1, gap: 8, ph: 'Paste the passage' }),
      B('cite', 186, 482, 974, 46, { sz: 28, col: 'muted', ph: 'Author, title, page' }),
      B('foot', 152, 540, 1008, 90, { sz: 28, ph: 'The question to read for' })];
    case 'picprompt': return [
      B('body', 712, 214, 448, 410, { list: 'bullet', gap: 10, ph: 'Questions, one per line' })];
    case 'textpic': return [
      B('body', 152, 214, 448, 410, { gap: 10, ph: 'Click to add text' })];
    case 'vocab': return [
      B('word', 152, 214, 1008, 62, { sz: 36, b: 1, ph: 'The word' }),
      B('pos', 152, 282, 1008, 46, { sz: 28, i: 1, col: 'accent', ph: 'Part of speech' }),
      B('body', 152, 344, 1008, 150, { ph: 'What it means' }),
      B('foot', 152, 506, 1008, 120, { sz: 28, i: 1, col: 'muted', ph: 'An example sentence' })];
  }
  return [];
}
// src/planner/looks.js
function teachShapes(s, look) {
  const a = LOOKS[look].accent;
  if (s.layout === 'twocol') return [[152, 266, 484, 3, a], [676, 266, 484, 3, a]];
  if (s.layout === 'passage') return [[152, 214, 8, 262, a]];
  return [];
}
// src/planner/looks.js
const PICBOX = { x: 152, y: 214, w: 520, h: 384 }, PICBOX_R = { x: 640, y: 214, w: 520, h: 384 };
// src/planner/looks.js
const picBox = s => s.layout === 'picprompt' ? PICBOX : s.layout === 'textpic' ? PICBOX_R : null;
// src/planner/looks.js
const hasPic = s => s.layout === 'picture' || s.layout === 'fullpic' || !!picBox(s);
// src/planner/looks.js
const FULLPIC = { x: 0, y: 0, w: 1280, h: 692 };
// src/planner/looks.js
const fieldOf = (s, k) => k === 'title' ? s.title : String(s[k] || '');
// src/planner/looks.js
function teachHtml(s, edit, look) {
  let h = '';
  for (const [x, y, w, hh, fill] of teachShapes(s, look)) h += '<div class="ls-shape" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + hh + 'px;background:' + fill + '"></div>';
  const P = picBox(s);
  if (P) {
    h += '<div class="ls-pic' + (edit ? ' ls-ed' : '') + '" data-k="img" style="left:' + P.x + 'px;top:' + P.y + 'px;width:' + P.w + 'px;height:' + P.h + 'px">' + (s.img ? '<img src="' + esc(imgSrc(s.img.src)) + '" alt="">' : edit ? '<span class="ls-ph">Click to add a picture</span>' : '') + '</div>';
    h += '<div class="ls-src' + (edit ? ' ls-ed' : '') + '" data-k="source" style="left:' + P.x + 'px;top:' + (P.y + P.h + 6) + 'px;width:' + P.w + 'px"' + (edit ? ' tabindex="0"' : '') + '>' + (s.img && s.img.source ? esc(s.img.source) : edit && s.img ? '<span class="ls-ph">Add the source line</span>' : '') + '</div>';
  }
  for (const b of teachBoxes(s)) {
    const v = fieldOf(s, b.k), lines = v.split('\n');
    const st = 'left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px;font-size:' + (b.sz * PT).toFixed(1) + 'px;text-align:' + (b.algn === 'ctr' ? 'center' : 'left') + ';justify-content:' + (b.anchor === 'ctr' ? 'center' : 'flex-start') +
      (b.b ? ';font-weight:700' : '') + (b.i ? ';font-style:italic' : '') + (b.caps ? ';text-transform:uppercase' : '') + (b.serif ? ';font-family:Georgia,serif' : '') + ';color:var(--' + (b.col === 'accent' ? 'la' : 'lt') + ')' + (b.col === 'muted' ? ';opacity:.78' : '') + ';--gap:' + ((b.gap || 0) * PT).toFixed(1) + 'px';
    let inner = '';
    if (!v.trim()) inner = edit ? '<span class="ls-ph">' + esc(b.ph || 'Click to add text') + '</span>' : '';
    else if (RT_KEYS.includes(b.k)) inner = rtHtml(v);
    else inner = lines.map(x => '<p>' + (esc(x) || '&nbsp;') + '</p>').join('');
    h += '<div class="ls-bx' + (edit ? ' ls-ed' : '') + '" data-k="' + b.k + '" style="' + st + '"' + (edit ? ' tabindex="0"' : '') + '>' + inner + '</div>';
  }
  return h;
}
// src/planner/looks.js
let EX = 9525, EY = 9525;
// src/planner/looks.js
const hex = c => String(c).replace('#', '').toUpperCase();
// src/planner/looks.js
const fillX = c => '<a:solidFill><a:srgbClr val="' + hex(c) + '"/></a:solidFill>';
// src/planner/looks.js
function shapeXml(id, [x, y, w, h, fill, line]) {
  return '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="Shape ' + id + '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + Math.round(x * EX) + '" y="' + Math.round(y * EY) + '"/><a:ext cx="' + Math.round(w * EX) + '" cy="' + Math.round(h * EY) + '"/></a:xfrm><a:prstGeom prst="' + (line ? 'roundRect' : 'rect') + '"><a:avLst>' + (line ? '<a:gd name="adj" fmla="val 1200"/>' : '') + '</a:avLst></a:prstGeom>' +
    (fill ? fillX(fill) : '<a:noFill/>') + (line ? '<a:ln w="' + Math.round(line[1] * EX) + '">' + fillX(line[0]) + '</a:ln>' : '<a:ln><a:noFill/></a:ln>') + '</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>';
}
// src/planner/looks.js
function lookRun(t, sz, o, look) {
  const L0 = LOOKS[look], c = RT_COLORS[o.c] ? RT_COLORS[o.c] : o.title ? (L0.title || L0.text) : o.col === 'accent' ? L0.accent : o.col === 'muted' ? mix(L0.text, L0.bg, .78) : L0.text;
  const font = o.serif || (o.title && L0.serif) ? '<a:latin typeface="Georgia"/>' : '';
  return '<a:r><a:rPr lang="en-US"' + (sz ? ' sz="' + Math.round(sz * 100) + '"' : '') + (o.b || (o.title && !L0.serif && !L0.caps) ? ' b="1"' : '') + (o.i ? ' i="1"' : '') + (o.u ? ' u="sng"' : '') + (o.caps ? ' cap="all"' : (o.title || o.sub) && !L0.caps ? ' cap="none"' : '') + ' dirty="0">' + fillX(c) + font + '</a:rPr><a:t>' + xe(t) + '</a:t></a:r>';
}
// src/planner/looks.js
function mix(a, b, k) { const p = c => [1, 3, 5].map(i => parseInt(hex(c).slice(i - 1, i + 1), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v * k + y[i] * (1 - k)).toString(16).padStart(2, '0')).join(''); }
// src/planner/looks.js
function teachBoxXml(id, b, s, look) {
  const v = fieldOf(s, b.k), lines = v.split('\n'), acc = hex(LOOKS[look].accent);
  const mar = Math.round((b.list === 'num' ? 1.45 : .86) * b.sz * 12700);
  const ps = RT_KEYS.includes(b.k) && v.trim() ? rtParasXml(v, { sz: b.sz, algn: b.algn === 'ctr' ? 'ctr' : '', lvlMar: Math.round(1.6 * b.sz * 12700), bulMar: Math.round(.86 * b.sz * 12700), numMar: Math.round(1.45 * b.sz * 12700), gap: b.gap || 0, buClr: '<a:buClr><a:srgbClr val="' + acc + '"/></a:buClr>', runFn: (t, f) => lookRun(t, b.sz, { ...b, b: b.b || f.b, i: b.i || f.i, u: f.u, c: f.c }, look) }) : (v.trim() ? lines : ['']).map((x, i) => {
    let pPr = '<a:pPr' + (b.algn === 'ctr' ? ' algn="ctr"' : '') + (b.list ? ' marL="' + mar + '" indent="-' + mar + '"' : ' marL="0" indent="0"') + '>' + (i && b.gap ? '<a:spcBef><a:spcPts val="' + Math.round(b.gap * 100) + '"/></a:spcBef>' : '<a:spcBef><a:spcPts val="0"/></a:spcBef>');
    pPr += b.list ? '<a:buClr><a:srgbClr val="' + acc + '"/></a:buClr>' + (b.list === 'num' ? '<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/>' : '<a:buFont typeface="Arial"/><a:buChar char="•"/>') : '<a:buNone/>';
    return '<a:p>' + pPr + '</a:pPr>' + (x ? lookRun(x, b.sz, b, look) : '<a:endParaRPr lang="en-US" sz="' + b.sz * 100 + '"/>') + '</a:p>';
  }).join('');
  return '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="Text ' + id + '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + Math.round(b.x * EX) + '" y="' + Math.round(b.y * EY) + '"/><a:ext cx="' + Math.round(b.w * EX) + '" cy="' + Math.round(b.h * EY) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' +
    '<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="' + (b.anchor === 'ctr' ? 'ctr' : 't') + '"><a:noAutofit/></a:bodyPr><a:lstStyle/>' + ps + '</p:txBody></p:sp>';
}
// src/planner/looks.js
function picFit(img, B, valign) {
  const r = Math.min(B.w * EX / img.w, B.h * EY / img.h), w = img.w * r / EX, h = img.h * r / EY;
  return { x: B.x + (B.w - w) / 2, y: valign === 'top' ? B.y : B.y + (B.h - h) / 2, w, h };
}
// src/planner/looks.js
function picXml(id, f) {
  return '<p:pic><p:nvPicPr><p:cNvPr id="' + id + '" name="Picture"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rIdImg"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="' + Math.round(f.x * EX) + '" y="' + Math.round(f.y * EY) + '"/><a:ext cx="' + Math.round(f.w * EX) + '" cy="' + Math.round(f.h * EY) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
}
// src/planner/looks.js
function teachXml(s, look, media) {
  let t = '', id = 10;
  for (const sh of teachShapes(s, look)) t += shapeXml(id++, sh);
  const P = picBox(s);
  if (P && s.img && media) {
    const f = picFit(s.img, P, 'top');
    t += picXml(id++, f);
    if (s.img.source) t += teachBoxXml(id++, { k: '_src', x: P.x, y: f.y + f.h + 6, w: P.w, h: 22, sz: 10, col: 'text', algn: 'ctr' }, { _src: s.img.source }, look);
  }
  for (const b of teachBoxes(s)) t += teachBoxXml(id++, b, s, look);
  return t;
}
// src/planner/looks.js
function lookBgXml(look) { return '<p:bg><p:bgPr>' + fillX(LOOKS[look].bg) + '<a:effectLst/></p:bgPr></p:bg>'; }
// src/planner/looks.js
function lookShapesXml(look, titleSlide) { return lookShapes(look, titleSlide).map((sh, i) => shapeXml(40 + i, sh)).join(''); }
// src/planner/boxes.js
const BOX_KEYS = ['title', 'body', 'body2', 'sub', 'tag', 'foot', 'h1', 'h2', 'cite', 'word', 'pos'];
// src/planner/boxes.js
const BOX_MIN_W = 80, BOX_MIN_H = 36;
// src/planner/boxes.js
function normBoxes(s, out) {
  if (s.fs && typeof s.fs === 'object') {
    const fs = {}; for (const k of BOX_KEYS) if (k !== 'body' && +s.fs[k] >= 10 && +s.fs[k] <= 96) fs[k] = Math.round(+s.fs[k] * 2) / 2;
    if (Object.keys(fs).length) out.fs = fs;
  }
  if (s.box && typeof s.box === 'object') {
    const bx = {};
    for (const k of BOX_KEYS) {
      const b = s.box[k]; if (!b || typeof b !== 'object' || ![b.x, b.y, b.w, b.h].every(v => Number.isFinite(+v))) continue;
      const w = Math.max(BOX_MIN_W, Math.min(1280, Math.round(+b.w))), h = Math.max(BOX_MIN_H, Math.min(720, Math.round(+b.h)));
      bx[k] = { x: Math.max(0, Math.min(1280 - w, Math.round(+b.x))), y: Math.max(0, Math.min(720 - h, Math.round(+b.y))), w, h };
    }
    if (Object.keys(bx).length) out.box = bx;
  }
  return out;
}
// src/planner/boxes.js
function boxStyle(s, k) {
  const b = s.box && s.box[k], z = k !== 'body' && s.fs && s.fs[k];
  return (b ? 'left:' + b.x + 'px;top:' + b.y + 'px;width:' + b.w + 'px;height:' + b.h + 'px;' : '') + (z ? 'font-size:' + (z * PT).toFixed(1) + 'px;' : '');
}
// src/planner/rich.js
const RT_LVL = 2, RT_KEYS = ['body', 'body2', 'foot'];
// src/planner/rich.js
const rtEsc = t => String(t).replace(/\\/g, '\\\\').replace(/\*/g, '\\*').replace(/_/g, '\\_').replace(/\{/g, '\\{');
// src/planner/rich.js
const RT_COLORS = { red: '#C00000', orange: '#D9480F', green: '#2B8A3E', blue: '#1C5DB8', purple: '#7B2CBF', gray: '#6B6B6B' };
// src/planner/rich.js
const RT_TOK = new RegExp('(\\\\.|\\*\\*|__|\\*|\\{(?:' + Object.keys(RT_COLORS).join('|') + '|/)\\})');
// src/planner/rich.js
function rtParse(text) {
  const out = String(text || '').replace(/\r/g, '').split('\n').map(raw => {
    const tabs = /^\t*/.exec(raw)[0].length; let t = raw.slice(tabs), kind = 'p';
    if (/^•\s?/.test(t)) { kind = 'b'; t = t.replace(/^•\s?/, ''); }
    else if (/^\d{1,3}[.)] /.test(t)) { kind = 'n'; t = t.replace(/^\d{1,3}[.)] /, ''); }
    return { lvl: Math.min(RT_LVL, tabs), kind, text: t };
  });
  return rtNumber(out);
}
// src/planner/rich.js
function rtNumber(lines) {
  const cnt = [0, 0, 0];
  for (const x of lines) {
    if (x.kind === 'n') { x.n = ++cnt[x.lvl]; for (let k = x.lvl + 1; k <= RT_LVL; k++) cnt[k] = 0; }
    else for (let k = x.lvl; k <= RT_LVL; k++) cnt[k] = 0;
  }
  return lines;
}
// src/planner/rich.js
function rtSegs(text) {
  const out = [], f = { b: 0, i: 0, u: 0, c: '' };
  for (const tok of String(text).split(RT_TOK)) {
    if (!tok) continue;
    if (tok === '**') f.b ^= 1; else if (tok === '*') f.i ^= 1; else if (tok === '__') f.u ^= 1;
    else if (tok[0] === '{' && tok.length > 2) f.c = tok === '{/}' ? '' : tok.slice(1, -1);
    else { const t = tok[0] === '\\' && tok.length === 2 ? tok[1] : tok; const p = out[out.length - 1]; if (p && p.b === f.b && p.i === f.i && p.u === f.u && p.c === f.c) p.t += t; else out.push({ t, ...f }); }
  }
  return out;
}
// src/planner/rich.js
function rtInlineHtml(text) { return rtSegs(text).map(s => { let h = esc(s.t); if (s.u) h = '<u>' + h + '</u>'; if (s.i) h = '<i>' + h + '</i>'; if (s.b) h = '<b>' + h + '</b>'; if (s.c) h = '<span class="rt-c" data-c="' + s.c + '" style="color:' + RT_COLORS[s.c] + '">' + h + '</span>'; return h; }).join(''); }
// src/planner/rich.js
function rtLineHtml(x, edit) { return '<div class="rt rt-' + x.kind + ' l' + x.lvl + '"' + (x.kind === 'n' ? ' data-n="' + x.n + '"' : '') + '>' + (rtInlineHtml(x.text) || (edit ? '<br>' : '&nbsp;')) + '</div>'; }
// src/planner/rich.js
function rtHtml(text, edit) { const ls = rtParse(text); while (!edit && ls.length > 1 && !ls[ls.length - 1].text && ls[ls.length - 1].kind === 'p') ls.pop(); return ls.map(x => rtLineHtml(x, edit)).join(''); }
// src/planner/rich.js
function rtMigrate(s) {
  const list = {};
  if (s.layout === 'content') list.body = 'b';
  if (s.layout === 'agenda' || s.layout === 'objectives') list.body = 'n';
  if (TEACH[s.layout] && s.layout !== 'objectives') for (const b of teachBoxes({ ...s, size: s.size || 28 })) if (b.list && RT_KEYS.includes(b.k)) list[b.k] = b.list === 'num' ? 'n' : 'b';
  for (const k of RT_KEYS) {
    if (typeof s[k] !== 'string' || !s[k]) continue;
    if (s.layout === 'title' && k === 'body') continue;
    let n = 0;
    s[k] = s[k].replace(/\r/g, '').split('\n').filter(t => !(list[k] === 'n' && !t.trim())).map(t => {
      const m = /^(\t| {2,})/.exec(t), lvl = m ? 1 : 0, w = t.replace(/^\s+/, '');
      if (!w) return '';
      return '\t'.repeat(lvl) + (list[k] === 'b' ? '• ' : list[k] === 'n' ? (++n) + '. ' : '') + rtEsc(w);
    }).join('\n');
  }
}
// src/planner/rich.js
function rtParasXml(text, o) {
  const ls = rtParse(text);
  while (ls.length > 1 && !ls[ls.length - 1].text && ls[ls.length - 1].kind === 'p') ls.pop();
  return ls.map((x, i) => {
    const base = x.lvl * o.lvlMar, mar = x.kind === 'n' ? o.numMar : o.bulMar;
    let p = '<a:pPr' + (o.algn ? ' algn="' + o.algn + '"' : '') + (x.kind === 'p' ? ' marL="' + base + '" indent="0"' : ' marL="' + (base + mar) + '" indent="-' + mar + '"') + '>';
    p += i && o.gap ? '<a:spcBef><a:spcPts val="' + Math.round(o.gap * 100) + '"/></a:spcBef>' : o.gap != null ? '<a:spcBef><a:spcPts val="0"/></a:spcBef>' : '';
    p += x.kind === 'p' ? '<a:buNone/>' : o.buClr + (x.kind === 'n' ? '<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"' + (x.n > 1 ? ' startAt="' + x.n + '"' : '') + '/>' : '<a:buFont typeface="Arial"/><a:buChar char="•"/>');
    const segs = rtSegs(x.text);
    return '<a:p>' + p + '</a:pPr>' + (segs.length ? segs.map(sg => o.runFn(sg.t, sg)).join('') : '<a:endParaRPr lang="en-US" sz="' + Math.round(o.sz * 100) + '"/>') + '</a:p>';
  }).join('');
}
// src/planner/activities.js
const PARTS = { warmup: 'Warm-up', activity: 'Activity', review: 'Review' };
// src/planner/activities.js
const KINDS = { talk: 'Discussion', read: 'Reading', write: 'Writing', words: 'Vocabulary', move: 'Movement and games', check: 'Checking understanding' };
// src/planner/activities.js
const BOOK = '50 Instructional Routines (Fisher, Brozo, Frey & Ivey, 2015)';
// src/planner/activities.js
const A = (id, name, kind, parts, group, what, how, slide, book, tip) => ({ id, name, kind, parts, group, what, how, slide, book: book || 0, tip: tip || '' });
// src/planner/activities.js
const ACTIVITIES = [
  A('journal', 'Journal entry', 'write', ['warmup'], 'On their own', 'A short written response to one open question, in a notebook students keep all term.',
    ['Put one open question on the board that links to today’s text or idea.', 'Students write without stopping until you call time. Spelling doesn’t count here.', 'Ask two or three students to read a line aloud, or have partners swap and read.', 'Come back to the question at the end of class so the entry feeds the lesson.'],
    ['Open your journal to a new page', 'Write today’s date and the question', 'Write the whole time, without stopping', 'Be ready to share one line'], 31, 'Response Writing is routine 31.'),
  A('quickwrite-pair', 'Read, write, pair, share', 'write', ['warmup', 'activity'], 'Pairs', 'Students read a short piece, write about it on their own, then compare with a partner before the class talks.',
    ['Give a short passage and one question about it.', 'Students read and write an answer on their own first.', 'Partners read each other’s answer and agree or push back.', 'Call on pairs to share what changed when they talked.'],
    ['Read the passage', 'Write your answer on your own', 'Swap with your partner and compare', 'Get ready to share what you agreed on'], 28),
  A('think-pair-share', 'Think, pair, share', 'talk', ['warmup', 'activity', 'review'], 'Pairs', 'Quiet thinking, then a partner talk, then a few pairs share. A low-stakes way to get everyone talking.',
    ['Ask one question with more than one good answer.', 'Give quiet thinking time first.', 'Partners take turns: one talks, one listens, then switch.', 'Call on a few pairs. Ask what their partner said.'],
    ['Think on your own first', 'Talk with your partner: take turns', 'Be ready to share your partner’s idea'], 0),
  A('roundtable', 'Conversation roundtable', 'talk', ['activity'], 'Groups of 4', 'Each student folds a paper into four boxes: their own notes, then one box for each groupmate’s ideas as they speak.',
    ['Students fold a sheet into four boxes and write their name in one.', 'Everyone reads or thinks about the same question and writes their own notes in their box.', 'Each person shares in turn. The others write that person’s main idea in a box with their name on it.', 'Each student writes a short summary that pulls the four ideas together.'],
    ['Fold your paper into four boxes', 'Write your own ideas in your box', 'As each person shares, note their idea in a box', 'Write a summary that uses all four ideas'], 6),
  A('fishbowl', 'Fishbowl discussion', 'talk', ['activity'], 'Whole class', 'A small inner circle talks about a question while the outer circle listens and takes notes, then the circles switch or the outside joins in.',
    ['Pick a question people can disagree about.', 'Partners talk first so everyone has something to say.', 'Five or six students sit in the middle and talk; everyone else sits around them and tracks ideas or evidence.', 'Switch circles, or leave one empty chair for someone from outside to step in.', 'End by asking the outer circle what they noticed.'],
    ['Inner circle: talk about the question, using the text', 'Outer circle: note the best point and one question', 'Want to join? Take the empty chair'], 10),
  A('socratic', 'Socratic seminar', 'talk', ['activity'], 'Whole class', 'A student-led discussion of a text, with open questions and evidence. The teacher mostly listens.',
    ['Students read and annotate the text ahead of time and write two open questions.', 'Seat everyone in a circle. Share a few norms, like building on what the last person said.', 'Open with one question, then step back. Students call on each other.', 'Close with each student naming one idea that changed their thinking.'],
    ['Bring your marked-up text and two questions', 'Point to the text when you make a claim', 'Build on what the last person said', 'Invite someone who hasn’t spoken yet'], 34),
  A('debate', 'Four-corners debate', 'move', ['warmup', 'activity'], 'Whole class', 'Students move to a corner (strongly agree to strongly disagree) and defend their spot. People can change corners when they hear a good point.',
    ['Post four signs: strongly agree, agree, disagree, strongly disagree.', 'Read one statement. Students move to a corner.', 'Each corner talks briefly, then sends one speaker.', 'Let anyone move when an argument convinces them, and ask what changed their mind.'],
    ['Listen to the statement', 'Walk to the corner that fits what you think', 'Talk with your corner: why are you here?', 'Changed your mind? Move, and tell us why'], 7, 'Debate is routine 7; the corners make it quick to run.'),
  A('opinionnaire', 'Opinionnaire', 'talk', ['warmup'], 'On their own, then pairs', 'Students mark agree or disagree on a few bold statements before reading, then come back to them after.',
    ['Write four or five strong statements tied to the text’s big ideas.', 'Students mark agree or disagree and add a reason.', 'Partners compare. Take a quick poll on the most split statement.', 'After reading, students look again: would they change any answers?'],
    ['Agree or disagree with each statement', 'Write one reason for each', 'Compare with a partner', 'We’ll come back to these after reading'], 21),
  A('anticipation', 'Anticipation guide', 'read', ['warmup'], 'On their own', 'True or false guesses about what a text will say, checked against the text afterward.',
    ['Write several statements about the text, some true, some not.', 'Students guess true or false before reading.', 'As they read, they look for the line that settles each one.', 'They correct their guesses and quote the line that proves it.'],
    ['Guess: true or false?', 'Read and look for the answers', 'Fix your guesses and quote the line'], 3),
  A('close-read', 'Close reading', 'read', ['activity'], 'On their own, then whole class', 'A short, rich passage read more than once, with a different question each time.',
    ['Choose a short passage worth slowing down for.', 'First read: what is it saying? Students annotate.', 'Second read: how is it written? Word choice, structure, tone.', 'Third read: what does it mean, and why does it matter? Discuss using the text.'],
    ['Read once: what is it saying?', 'Read again: mark words and choices that stand out', 'Read a third time: what does it mean?', 'Use the text when you share'], 4),
  A('annotation', 'Annotation with a code', 'read', ['activity'], 'On their own', 'Students mark the text with a small set of symbols as they read, so their thinking is on the page.',
    ['Give three or four symbols, like ! for a surprise, ? for a question, * for something important.', 'Model one paragraph out loud.', 'Students annotate the rest on their own.', 'Partners compare one mark each and explain it.'],
    ['! something that surprised you', '? something you’d ask the author', '* something important', 'Explain one mark to your partner'], 2),
  A('jigsaw', 'Jigsaw', 'read', ['activity'], 'Groups', 'Each member of a home group becomes the expert on one part, meets other experts on it, then teaches it back home.',
    ['Split the material into parts, one per group member.', 'Expert groups meet: same part, read it and agree on what matters.', 'Students return home and teach their part in turn.', 'Finish with a task that needs every part.'],
    ['Read your part with your expert group', 'Agree on the three most important points', 'Go home and teach your part', 'Answer the group question together'], 16),
  A('reciprocal', 'Reciprocal teaching', 'read', ['activity'], 'Groups of 4', 'Small groups read together, with four jobs: predict, question, clear up, summarize.',
    ['Hand out four role cards: predictor, questioner, clarifier, summarizer.', 'Groups read a chunk, then each role does its job.', 'Rotate roles every chunk.', 'Check in with each group and listen to one role.'],
    ['Predictor: what will happen next?', 'Questioner: ask the group a question', 'Clarifier: clear up a confusing part', 'Summarizer: sum it up in a sentence'], 29),
  A('qar', 'Question-answer types', 'read', ['activity'], 'Pairs', 'Students sort questions by where the answer comes from: right there, think and search, the author and me, on my own.',
    ['Teach the four types with one easy example each.', 'Give a set of questions on the text.', 'Pairs label each question’s type, then answer it.', 'Talk about which types were hardest and why.'],
    ['Right there: in one place', 'Think and search: put parts together', 'Author and me: the text plus what you know', 'On my own: from your own life'], 23),
  A('qta', 'Questioning the author', 'read', ['activity'], 'Whole class', 'Stop during a read to ask what the author is trying to say and why they said it that way.',
    ['Pick stopping points ahead of time.', 'At each stop ask: What is the author trying to tell us? Why put it this way?', 'Push for evidence: Where does it say that?', 'Connect stops: How does this fit with what the author said before?'],
    ['What is the author trying to say?', 'Why did they say it this way?', 'Does it make sense with what came before?'], 24),
  A('dr-ta', 'Predict, read, check', 'read', ['activity'], 'Whole class', 'Students predict, read to a stopping point, check their prediction against the text, then predict again.',
    ['Start from the title, a picture or the first lines and ask for predictions.', 'Read to the first stop.', 'Ask: Were you right? What in the text tells you?', 'Repeat at each stop, then talk about how the predictions changed.'],
    ['Predict what happens', 'Read to the stop', 'Check: right or not? Show the line', 'Predict again'], 8),
  A('text-impressions', 'Text impressions', 'write', ['warmup'], 'Pairs', 'From a short list of key words in order, students write their own short version of the text before reading it.',
    ['Pull eight to twelve key words from the text, in order.', 'Pairs write a short paragraph using the words in that order.', 'Read the real text.', 'Compare: what did you guess well, and what surprised you?'],
    ['Use these words, in order', 'Write what you think the text is about', 'Read it, then compare'], 40),
  A('found-poem', 'Found poem', 'write', ['activity', 'review'], 'On their own or pairs', 'Students build a poem only from words and lines they find in a text.',
    ['Students skim the text and copy lines and phrases that stand out.', 'They arrange the pieces into a short poem, adding nothing new.', 'Share a few aloud.', 'Ask what the poem shows about the text’s big idea.'],
    ['Copy words and lines that stand out', 'Arrange them into a poem', 'Only words from the text', 'Give it a title'], 11),
  A('raft', 'RAFT writing', 'write', ['activity'], 'On their own', 'Students write as a Role, to an Audience, in a Format, about a Topic, which makes them think about voice and purpose.',
    ['Give a RAFT, like a character writing a letter to another character about a choice.', 'Brainstorm what that role would know and care about.', 'Students write.', 'Share a few and ask how the role changed the writing.'],
    ['Role: who you are', 'Audience: who you’re writing to', 'Format: what kind of writing', 'Topic: what it’s about'], 25),
  A('split-notes', 'Two-column notes', 'write', ['activity'], 'On their own', 'Main ideas on the left, details and examples on the right, so notes can be used to study later.',
    ['Students draw a line down the page, about a third from the left.', 'Big ideas or questions go on the left, details on the right.', 'Afterward, they cover the right side and quiz themselves from the left.'],
    ['Big ideas on the left', 'Details and examples on the right', 'Cover the right side and quiz yourself'], 35),
  A('writing-frame', 'Sentence frames', 'write', ['activity'], 'On their own', 'Starter sentences that show the shape of a good answer, used as a scaffold and then dropped.',
    ['Give two or three frames, like “At first ___, but ___ because ___.”', 'Model one with a sample answer.', 'Students write using the frames.', 'Next time, give fewer frames.'],
    ['Use the frames to start your sentences', 'Fill in your own ideas and evidence'], 50),
  A('exit-slip', 'Exit ticket', 'check', ['review'], 'On their own', 'One or two quick questions at the end of class to see what stuck.',
    ['Ask one question that shows whether today’s goal was met.', 'Students answer on a slip or a sticky note.', 'Sort the slips into got it, almost, not yet, and start tomorrow from there.'],
    ['Answer the question on your sticky note', 'Put your name on it', 'Hand it in on your way out'], 9),
  A('popcorn', 'Popcorn review', 'check', ['review'], 'Whole class', 'Students stand and share one thing they learned; each person adds something new until everyone has spoken.',
    ['Everyone stands.', 'One student shares a fact or idea from the lesson and sits.', 'The next person adds something that hasn’t been said yet.', 'Keep going until everyone has shared.'],
    ['Stand up', 'Share one thing you learned, then sit', 'No repeats: add something new'], 22),
  A('take6', 'Take 6', 'check', ['review'], 'Pairs', 'Six quick prompts that pull a lesson together: two to recall, two to connect, two to use.',
    ['Write six short prompts about the lesson.', 'Partners take turns answering them.', 'Go over the two hardest as a class.'],
    ['Answer the six questions with your partner', 'Take turns: one answers, one checks'], 38),
  A('trashketball', 'Trashketball', 'move', ['review'], 'Teams', 'Teams answer review questions; a right answer earns a shot at a trash can for bonus points.',
    ['Make teams and a set of review questions.', 'Ask a question. Every team writes an answer.', 'Teams that got it right earn a shot from a line (closer line, fewer points).', 'Keep score on the board and go over any question most teams missed.'],
    ['Answer with your team', 'Right answer: one shot at the basket', 'Close line 1 point, far line 2 points'], 0, 'A classroom favorite; not in the book.'),
  A('gallery-walk', 'Gallery walk', 'move', ['activity', 'review'], 'Groups', 'Work or prompts are posted around the room; groups rotate and leave notes on each.',
    ['Post work, quotes or questions around the room.', 'Groups visit each station and leave a sticky note.', 'Rotate on a signal.', 'Back at their seats, groups talk about what they saw most.'],
    ['Visit each poster with your group', 'Leave one sticky note at each', 'Move on when you hear the signal', 'Back at your seat: what stood out?'], 0),
  A('stations', 'Stations', 'move', ['activity'], 'Groups', 'Different short tasks at different tables; groups rotate through them.',
    ['Set up three to five stations, each with clear written steps.', 'Groups start at different stations.', 'Rotate on a signal.', 'End with one question that pulls the stations together.'],
    ['Read the steps at your station', 'Do the task with your group', 'Move when you hear the signal'], 0),
  A('readers-theatre', 'Readers’ theatre', 'read', ['activity'], 'Groups', 'Students turn a scene or passage into a short script and read it aloud with expression, no props needed.',
    ['Choose a scene with several voices.', 'Groups split the lines and mark how to say them.', 'Practice once, then perform.', 'Ask what the performance showed about the characters.'],
    ['Split the lines in your group', 'Mark how each line should sound', 'Practice once, then perform'], 27),
  A('charades', 'Charades', 'move', ['warmup', 'review'], 'Teams', 'A student acts out a word, idea or moment from the text; their team guesses.',
    ['Write words or moments on cards.', 'One student acts it out without talking.', 'Their team guesses.', 'Ask what in the acting gave it away.'],
    ['Act it out: no words', 'Your team guesses', 'Then: what gave it away?'], 0),
  A('see-think-wonder', 'See, think, wonder', 'talk', ['warmup', 'activity'], 'Pairs', 'Students look closely at an image, then say what they see, what they think about it and what they wonder.',
    ['Show one rich image.', 'Students list what they see, only what is visible.', 'Then what they think is going on, with reasons from the image.', 'Then what they wonder. Keep the questions for later.'],
    ['What do you see?', 'What do you think is going on?', 'What do you wonder?'], 0, 'A thinking routine from Project Zero at the Harvard Graduate School of Education.'),
  A('kwl', 'Know, want to know, learned', 'check', ['warmup', 'review'], 'Whole class', 'A three-column chart: what we already know, what we want to find out, and what we learned.',
    ['Students list what they already know about the topic.', 'Then what they want to know.', 'At the end of the lesson or unit, fill in what they learned.', 'Check the middle column: what’s still open?'],
    ['Know: what do you already know?', 'Want: what do you want to find out?', 'Learned: fill this in at the end'], 17),
  A('word-sort', 'Word sort', 'words', ['warmup', 'activity'], 'Pairs', 'Students sort word cards into groups, either into given categories or groups they invent and name.',
    ['Make a set of word cards from the text or unit.', 'Pairs sort them into groups.', 'Each pair explains one group.', 'Talk about words that could go in more than one group.'],
    ['Sort the words into groups', 'Name each group', 'Explain one group to the class'], 48),
  A('shades', 'Shades of meaning', 'words', ['warmup', 'activity'], 'Pairs', 'Students line up related words from mild to strong, like annoyed, angry, furious.',
    ['Give a set of related words.', 'Pairs put them in order from weakest to strongest.', 'Compare orders across pairs and argue the close calls.', 'Use one word in a sentence that shows its strength.'],
    ['Put the words in order, weakest to strongest', 'Compare with another pair', 'Write a sentence with one word'], 32),
  A('vocab-cards', 'Vocabulary cards', 'words', ['activity'], 'On their own', 'Each card has a word, its meaning in the student’s own words, an example, and a picture or a non-example.',
    ['Give the words for the unit.', 'Students make a card for each: word, own meaning, example, picture.', 'Partners quiz each other with the cards.'],
    ['Word on the front', 'Your own meaning and an example on the back', 'Add a picture', 'Quiz a partner'], 44),
  A('tossed-terms', 'Tossed terms', 'words', ['warmup'], 'Groups', 'Groups get a handful of key terms from a text and predict how they connect before reading.',
    ['Give each group eight to ten terms.', 'Groups sort them and predict how they relate.', 'Read the text and check the predictions.'],
    ['Sort the terms with your group', 'Predict how they connect', 'Read and check'], 43),
  A('word-scavenger', 'Word scavenger hunt', 'words', ['activity'], 'Pairs', 'Students hunt through a text for words that fit a category, like strong verbs or words that show mood.',
    ['Name the categories to hunt for.', 'Pairs search the text and list what they find with page numbers.', 'Share the best find in each category.'],
    ['Hunt for words that fit each category', 'Write the page number for each', 'Share your best find'], 47),
  A('think-aloud', 'Think aloud', 'read', ['activity'], 'Whole class', 'The teacher or a student reads and says their thinking out loud, so the class hears how a reader works through a hard part.',
    ['Pick a short, tricky passage.', 'Read and say your thinking: questions, guesses, fix-ups.', 'Ask students what they heard you do.', 'Students try it with a partner on the next paragraph.'],
    ['Listen to how a reader thinks', 'Name one thing the reader did', 'Try it on the next part with your partner'], 42),
  A('student-questions', 'Student questions', 'talk', ['warmup', 'activity'], 'Groups', 'Students write their own questions about a topic and use them to drive the reading or discussion.',
    ['Show a prompt: an image, a quote, a short clip.', 'Groups write as many questions as they can without answering them.', 'They pick their three best and say why.', 'Use those questions for the reading or discussion.'],
    ['Write as many questions as you can', 'Don’t answer them yet', 'Pick your three best'], 37),
  A('booktalk', 'Student booktalks', 'talk', ['activity'], 'On their own', 'A short talk where a student sells a book they read to the class.',
    ['Show a sample booktalk: hook, a little plot, no ending, why read it.', 'Students plan a short talk.', 'Run a few each day.'],
    ['Hook us in', 'Tell a little, not the ending', 'Say who would like it'], 36)
];
// src/planner/activities.js
const VIDEOS = {
  'journal': ['ZeaO-0_Kc3g', 'Edutopia', '1 min'], 'quickwrite-pair': ['H5BWms1KAKk', 'Edutopia', '3 min'],
  'think-pair-share': ['P4xUbicJTA4', 'EL Education', '3 min'], 'fishbowl': ['JVCFGLVZA3w', 'Edutopia', '1 min'],
  'socratic': ['e3IBLKYaK1E', 'Edutopia', '4 min'], 'debate': ['M2XmJQ9FL5A', 'ESC Region 13', '2 min'],
  'anticipation': ['jQCKXQUquTc', 'Reading Rockets', '8 min'], 'close-read': ['84VyogMSuv0', 'EL Education', '8 min'],
  'jigsaw': ['VsI9EpSSavo', 'Edutopia', '3 min'], 'reciprocal': ['My68SDGeTHI', 'Reading Rockets', '2 min'],
  'qta': ['tAIj2MqEz9s', 'Literacy How', '3 min'], 'dr-ta': ['ya6c1Im3-NU', 'Willans Hill', '3 min'],
  'split-notes': ['nX-xshA_0m8', 'Cornell Learning Strategies Center', '4 min'], 'writing-frame': ['f3rXwstobh8', 'Colorín Colorado', '1 min'],
  'exit-slip': ['PWUxFSXEsC8', 'Edutopia', '5 min'], 'trashketball': ['rOZlSwLUQGw', 'Ole Miss News', '3 min'],
  'gallery-walk': ['ElVO7RWAxa4', 'ESC Region 13', '2 min'], 'stations': ['Kg38A1ggYiE', 'Edutopia', '5 min'],
  'readers-theatre': ['4L5q0Y8hukU', 'Chase Young', '6 min'], 'see-think-wonder': ['oKV_S5NpDdc', 'Project Zero', '5 min'],
  'kwl': ['5JYkfJnqAbk', 'Educational Partners International', '4 min'], 'word-sort': ['d_R5wfmWIlQ', 'Reading Rockets', '6 min'],
  'vocab-cards': ['x83RVBIAnYQ', 'ESC Region 13', '2 min'], 'think-aloud': ['UmhLgsBD1-I', 'Smekens Education', '2 min'],
  'student-questions': ['JJJ6V4p1nfs', 'Right Question Institute', '1 min'], 'booktalk': ['lH5LghhwQDQ', 'We Are Teachers', '2 min']
};
// src/planner/activities.js
const vidOk = u => /^https?:\/\/\S+$/i.test(String(u || '').trim());
// src/planner/activities.js
function actVideo(a) {
  if (a.mine && vidOk(a.video)) return { url: a.video.trim(), note: 'Your video link', found: true };
  const v = !a.mine && VIDEOS[a.id];
  if (v) return { url: 'https://www.youtube.com/watch?v=' + v[0], note: v[1] + ', ' + v[2], found: true };
  return { url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(a.name + ' classroom strategy'), note: 'Search YouTube for classroom videos', found: false };
}
// src/planner/activities.js
const actSlide = a => normSlide({ layout: 'steps', title: a.name, body: a.slide.map((x, i) => (i + 1) + '. ' + x).join('\n'), size: 32, fmt: 2, notes: 'How to run it:\n' + a.how.map((x, i) => (i + 1) + '. ' + x).join('\n') + (a.book ? '\n(' + BOOK + ', routine ' + a.book + ')' : '') + (actVideo(a).found ? '\nSee it in action: ' + actVideo(a).url : '') });
// src/planner/activities.js
function normActivity(x) {
  if (!x || typeof x.name !== 'string' || !x.name.trim()) return null;
  const arr = v => (Array.isArray(v) ? v : []).map(String).filter(Boolean);
  return { id: typeof x.id === 'string' && x.id ? x.id : 'my-' + lid(), name: x.name.trim(), what: String(x.what || ''), kind: KINDS[x.kind] ? x.kind : 'talk', parts: arr(x.parts).filter(p => PARTS[p]).length ? arr(x.parts).filter(p => PARTS[p]) : ['activity'], group: String(x.group || ''), how: arr(x.how), slide: arr(x.slide), book: 0, tip: String(x.tip || ''), ...(vidOk(x.video) ? { video: String(x.video).trim() } : {}) };
}
// src/planner/links.js
const LK_MAX = 40;
// src/planner/links.js
function lkUrl(t) {
  let s = String(t || '').trim(); if (!s || /\s/.test(s)) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) { if (!/\.[a-z]{2,}/i.test(s)) return ''; s = 'https://' + s; }
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) && u.hostname ? u.href : ''; } catch { return ''; }
}
// src/planner/links.js
const lkHost = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
// src/planner/links.js
function normLinks(v) {
  const seen = new Set(), out = [];
  for (const x of Array.isArray(v) ? v : []) {
    const url = x && typeof x === 'object' ? lkUrl(x.url) : ''; if (!url || seen.has(url) || out.length >= LK_MAX) continue;
    seen.add(url); out.push({ id: typeof x.id === 'string' && x.id ? x.id : lid(), name: String(x.name || '').trim().slice(0, 120) || lkHost(url), url });
  }
  return out;
}
// src/planner/finished.js
const MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', txt: 'text/plain', md: 'text/markdown', html: 'text/html', mp3: 'audio/mpeg', mp4: 'video/mp4' };
// src/planner/finished.js
const mimeOf = n => MIME[((/\.(\w+)$/.exec(n) || [])[1] || '').toLowerCase()] || '';
// src/planner/finished.js
function lessonBack(l, back) {
  const was = l.slides, old = JSON.parse(JSON.stringify(was));
  const slides = back.slides.slice(0, 80).map((x, i) => {
    const o = was[i], y = x && typeof x === 'object' ? { ...x } : {};
    delete y.id; delete y.img; delete y.ctx; delete y.box; delete y.fs;
    const s = normSlide({ ...y, fmt: 2 });
    if (o) {
      s.id = o.id; s.ask = o.ask; if (o.ctx) s.ctx = o.ctx; if (o.box) s.box = o.box; if (o.fs) s.fs = o.fs;
      if (o.img && (s.layout === 'picture' || s.layout === 'fullpic' || s.layout === 'textpic' || s.layout === 'picprompt')) s.img = o.img;
      if (o.video && s.layout === 'video' && (!s.video || s.video.url === o.video.url)) s.video = o.video;
      if (!(x && x.size)) s.size = o.size;
      s.talk = [...o.talk, ...s.talk.filter(t => t.by === 'claude')];
    }
    return s;
  });
  if (!l.pending) l.pending = { at: Date.now(), before: old, title: l.title };
  l.slides = slides; l.status = 'review';
  if (typeof back.title === 'string' && back.title.trim() && !l.titleApart) l.title = back.title.trim().slice(0, 200);
  if (typeof back.claudeNote === 'string') l.claudeNote = back.claudeNote.slice(0, 2000);
}
// src/planner/finished.js
const PX = { a: 'http://schemas.openxmlformats.org/drawingml/2006/main', p: 'http://schemas.openxmlformats.org/presentationml/2006/main', r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships' };
// src/planner/finished.js
const xmlOf = (z, p) => z[p] ? new DOMParser().parseFromString(new TextDecoder().decode(z[p]), 'application/xml') : null;
// src/planner/finished.js
const kids = (el, ns, name) => el ? [...el.getElementsByTagNameNS(ns, name)] : [];
// src/planner/finished.js
const kid = (el, ns, name) => kids(el, ns, name)[0] || null;
// src/planner/finished.js
function relsOf(z, part) {
  const i = part.lastIndexOf('/'), x = xmlOf(z, part.slice(0, i) + '/_rels/' + part.slice(i + 1) + '.rels'), m = {};
  if (x) for (const r of x.getElementsByTagName('Relationship')) {
    const t = r.getAttribute('Target'); if (r.getAttribute('TargetMode') === 'External') continue;
    m[r.getAttribute('Id')] = { type: r.getAttribute('Type') || '', path: pathJoin(part.slice(0, i), t) };
  }
  return m;
}
// src/planner/finished.js
function pathJoin(dir, t) {
  if (t.startsWith('/')) return t.slice(1);
  const out = dir.split('/');
  for (const s of t.split('/')) { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); }
  return out.join('/');
}
// src/planner/finished.js
const RT_HEX = () => ({ FF0000: 'red', C00000: 'red', FFC000: 'orange', ED7D31: 'orange', '00B050': 'green', '70AD47': 'green', '0070C0': 'blue', '0000FF': 'blue', '00B0F0': 'blue', '4472C4': 'blue', '7030A0': 'purple', '808080': 'gray', '7F7F7F': 'gray',
  ...Object.fromEntries(Object.entries(RT_COLORS).map(([k, v]) => [v.replace('#', '').toUpperCase(), k])) });
// src/planner/finished.js
function paraLine(p, bulleted, hexes) {
  const pPr = kid(p, PX.a, 'pPr');
  // Level: PowerPoint's own "lvl", or (as the Planner writes it) the left margin less the hanging indent, half an inch a level.
  const marL = pPr && pPr.getAttribute('marL'), base = marL != null ? +marL + Math.min(0, +pPr.getAttribute('indent') || 0) : 0;
  const lvl = Math.min(2, +(pPr && pPr.getAttribute('lvl')) || Math.round(base / 457200));
  let t = '';
  for (const n of p.childNodes) {
    if (n.localName === 'br') { t += ' '; continue; }
    if (n.localName !== 'r' && n.localName !== 'fld') continue;
    let x = (kid(n, PX.a, 't') || {}).textContent || ''; if (!x) continue;
    x = x.replace(/([*_{\\])/g, '\\$1');
    const rPr = kid(n, PX.a, 'rPr');
    if (rPr && x.trim()) {
      const clr = kid(kid(rPr, PX.a, 'solidFill'), PX.a, 'srgbClr'), c = clr && hexes[(clr.getAttribute('val') || '').toUpperCase()];
      if (rPr.getAttribute('u') && rPr.getAttribute('u') !== 'none') x = '__' + x + '__';
      if (rPr.getAttribute('i') === '1') x = '*' + x + '*';
      if (rPr.getAttribute('b') === '1') x = '**' + x + '**';
      if (c) x = '{' + c + '}' + x + '{/}';
    }
    t += x;
  }
  t = t.replace(/(?<!\\)\*\*\*\*/g, '');
  if (!t.trim()) return null;
  const none = pPr && kid(pPr, PX.a, 'buNone'), num = pPr && kid(pPr, PX.a, 'buAutoNum'), ch = pPr && kid(pPr, PX.a, 'buChar');
  const mark = none ? '' : num ? (+num.getAttribute('startAt') || 1) + '. ' : (ch || bulleted) ? '• ' : '';
  return '\t'.repeat(lvl) + mark + t.trim();
}
// src/planner/finished.js
function shapeText(sp, bulleted, hexes) {
  const tb = kid(sp, PX.p, 'txBody'); if (!tb) return [];
  return kids(tb, PX.a, 'p').map(p => paraLine(p, bulleted, hexes)).filter(x => x != null);
}
// src/planner/finished.js
function numberLines(lines) {
  const n = [0, 0, 0];
  return lines.map(x => {
    const d = /^\t*/.exec(x)[0].length, m = /^(\t*)(\d+)\. /.exec(x);
    for (let k = d + 1; k < 3; k++) n[k] = 0;
    if (!m) { n[d] = 0; return x; }
    n[d] = +m[2] > 1 ? +m[2] : n[d] + 1;
    return m[1] + n[d] + '. ' + x.slice(m[0].length);
  });
}
// src/planner/finished.js
async function mediaPic(z, path) {
  const u8 = z[path]; if (!u8) return null;
  const type = /\.png$/i.test(path) ? 'image/png' : /\.jpe?g$/i.test(path) ? 'image/jpeg' : /\.gif$/i.test(path) ? 'image/gif' : '';
  if (!type) return null;   // emf/wmf and the like can't be shown in a browser
  try { return await shrinkPic(new Blob([u8], { type })); } catch { return null; }
}
// src/planner/finished.js
async function pptxToSlides(u8) {
  const z = fflate.unzipSync(u8), hexes = RT_HEX();
  const pres = xmlOf(z, 'ppt/presentation.xml'); if (!pres) throw new Error('not a pptx');
  const prels = relsOf(z, 'ppt/presentation.xml');
  const order = kids(pres, PX.p, 'sldId').map(s => prels[s.getAttributeNS(PX.r, 'id')]).filter(Boolean).map(r => r.path);
  const out = [];
  for (const [i, part] of order.entries()) {
    const x = xmlOf(z, part); if (!x) continue;
    const rels = relsOf(z, part);
    let title = '', body = [], sizes = [], ctr = false, pic = null;
    for (const sp of kids(x, PX.p, 'sp')) {
      const ph = kid(kid(sp, PX.p, 'nvPr'), PX.p, 'ph'), type = ph ? ph.getAttribute('type') || 'body' : '';
      if (/^(sldNum|dt|ftr)$/.test(type)) continue;
      for (const r of kids(sp, PX.a, 'rPr')) if (+r.getAttribute('sz')) sizes.push(+r.getAttribute('sz') / 100);
      if (type === 'title' || type === 'ctrTitle') { ctr = ctr || type === 'ctrTitle'; title = title || shapeText(sp, false, hexes).map(t => t.replace(/^[•\t ]+|^\d+\. /g, '')).join(' '); continue; }
      body.push(...shapeText(sp, type === 'body' || type === 'obj' || (ph && !type), hexes));
    }
    for (const p of kids(x, PX.p, 'pic')) {
      if (pic) break;
      const bl = kid(p, PX.a, 'blip'), rid = bl && bl.getAttributeNS(PX.r, 'embed');
      if (rid && rels[rid]) pic = await mediaPic(z, rels[rid].path);
    }
    let notes = '';
    const nr = Object.values(rels).find(r => /notesSlide$/.test(r.type));
    const nx = nr && xmlOf(z, nr.path);
    if (nx) for (const sp of kids(nx, PX.p, 'sp')) {
      const ph = kid(kid(sp, PX.p, 'nvPr'), PX.p, 'ph'); if (!ph || (ph.getAttribute('type') && ph.getAttribute('type') !== 'body')) continue;
      notes = kids(sp, PX.a, 'p').map(p => kids(p, PX.a, 't').map(t => t.textContent).join('')).join('\n').trim();
    }
    const big = sizes.filter(s => s >= 20), size = big.length ? deckSizes().reduce((a, b) => Math.abs(b - Math.min(...big)) < Math.abs(a - Math.min(...big)) ? b : a) : 28;
    title = title.replace(/[\u200b\ufeff]/g, '').trim();
    const s = { title, body: numberLines(body).join('\n'), notes, size };
    if (ctr || (i === 0 && !pic && body.length <= 2)) { s.layout = 'title'; s.body = body.join('\n').replace(/^[•\t ]+|^\d+\. /gm, ''); }
    else if (pic && body.length) { s.layout = 'picprompt'; s.img = { ...pic, source: '' }; }
    else if (pic) { s.layout = 'picture'; s.img = { ...pic, source: '' }; }
    else s.layout = /\bagenda\b/i.test(title) ? 'agenda' : 'content';
    out.push(s);
  }
  return out;
}
// src/planner/variants.js
const varName = l => l.variant || (l.variantOf ? 'Alternative' : 'Original');
// src/planner/panel.js
const SP = { open: false, tab: 'books', w: 420, view: 'page', book: null, pdf: null, page: 1, outline: null, find: '', hits: null, texts: {}, video: '', box: { text: '', chips: [] } };
// src/planner/notebook.js
const NB_OK = /^(P|BR|B|STRONG|I|EM|U|UL|OL|LI|DIV|H3|A|IMG|BLOCKQUOTE)$/;
// src/planner/notebook.js
function nbClean(html) {
  const tp = document.createElement('template'); tp.innerHTML = String(html || '').replace(/<(script|style|object|embed)[\s\S]*?<\/\1>/gi, '');
  (function walk(n) {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 3) continue;
      if (c.nodeType !== 1) { c.remove(); continue; }
      if (c.tagName === 'DIV' && c.classList.contains('nb-vid')) {
        const id = String(c.dataset.yt || ''), t = Math.max(0, Math.round(+c.dataset.t || 0));
        if (!/^[\w-]{11}$/.test(id)) { c.remove(); continue; }
        const v = document.createElement('div'); v.className = 'nb-vid'; v.dataset.yt = id; if (t) v.dataset.t = t; c.replaceWith(v); continue;
      }
      if (!NB_OK.test(c.tagName)) { walk(c); c.replaceWith(...c.childNodes); continue; }
      const keep = {};
      if (c.tagName === 'A' && /^(https?:|mailto:)/i.test(c.getAttribute('href') || '')) keep.href = c.getAttribute('href');
      if (c.tagName === 'IMG') { const s = c.getAttribute('src') || ''; if (/^data:image\/(png|jpeg|gif|webp);base64,[\w+/=]+$/.test(s) || /^https:\/\//.test(s)) keep.src = s; else { c.remove(); continue; } }
      for (const at of [...c.attributes]) c.removeAttribute(at.name);
      for (const [k, v] of Object.entries(keep)) c.setAttribute(k, v);
      if (c.tagName === 'A') { if (!keep.href) { walk(c); c.replaceWith(...c.childNodes); continue; } c.target = '_blank'; c.rel = 'noopener'; }
      walk(c);
    }
  })(tp.content);
  return tp.innerHTML;
}
// src/planner/notebook.js
function nbText(html) {
  const d = document.createElement('div'); d.innerHTML = nbClean(html);
  for (const a of d.querySelectorAll('a')) if (a.textContent.trim() !== a.href && a.href) a.append(' (' + a.getAttribute('href') + ')');
  for (const v of d.querySelectorAll('.nb-vid')) v.textContent = '[Video: https://www.youtube.com/watch?v=' + v.dataset.yt + (v.dataset.t ? '&t=' + v.dataset.t + 's' : '') + ']';
  for (const i of d.querySelectorAll('img')) i.replaceWith('[Picture]');
  for (const li of d.querySelectorAll('li')) li.prepend('• ');
  for (const el of d.querySelectorAll('p,div,ul,ol,h3,blockquote')) el.before('\n');
  for (const el of d.querySelectorAll('p,div,li,h3,br,blockquote')) el.append('\n');
  return d.textContent.replace(/[ \t\u00a0]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
}
// src/planner/present.js
function normTaught(a) {
  const seen = new Map();
  for (const t of Array.isArray(a) ? a : []) {
    if (!t || typeof t !== 'object' || !/^\d{4}-\d\d-\d\d$/.test(t.date)) continue;
    const of = Math.max(1, Math.round(+t.of) || Math.round(+t.slide) || 1), slide = Math.max(1, Math.min(of, Math.round(+t.slide) || 1));
    const o = { classId: typeof t.classId === 'string' ? t.classId : '', date: t.date, slide, of, note: String(t.note || '').replace(/\s+/g, ' ').trim().slice(0, 300), at: +t.at || 0 };
    if (Array.isArray(t.agenda) && Math.round(+t.agenda[1]) > 0) { const n = Math.round(+t.agenda[1]); o.agenda = [Math.max(0, Math.min(n, Math.round(+t.agenda[0]) || 0)), n]; }
    seen.set(o.classId + '|' + o.date, o);
  }
  return [...seen.values()].sort((x, y) => x.date.localeCompare(y.date) || x.at - y.at);
}
// src/planner/present.js
const taughtAt = (l, classId, date) => (l.taught || []).find(t => t.classId === classId && t.date === date);
// src/planner/present.js
const taughtWhere = t => t.slide >= t.of ? 'finished all ' + t.of + ' slides' : 'got to slide ' + t.slide + ' of ' + t.of;
// src/planner/present.js
function taughtText(l) {
  return (l.taught || []).map(t => 'Taught: ' + (t.classId ? className(t.classId) + ', ' : '') + longDate(t.date) + ': ' + taughtWhere(t) + (t.agenda ? ' (agenda: ' + t.agenda[0] + ' of ' + t.agenda[1] + ' done)' : '') + (t.note ? '. Note: ' + t.note : '') + '\n').join('');
}
// src/planner/units.js
const UNIT_COLORS = ['#1F6FB2', '#7B3FC4', '#B71E42', '#0E7C66', '#B35C00', '#3D5A80', '#8E3B8A', '#2F6B2F'];
// src/planner/units.js
function normUnit(x) {
  x = x && typeof x === 'object' ? x : {};
  const weeks = (Array.isArray(x.weeks) ? x.weeks : []).map(w => ({ focus: String((w && w.focus) || ''), notes: String((w && w.notes) || ''), standards: String((w && w.standards) || '') }));
  const files = (Array.isArray(x.files) ? x.files : []).filter(f => f && typeof f.name === 'string').map(f => ({ id: typeof f.id === 'string' ? f.id : '', name: f.name, kind: ['atlas', 'summative', 'other', 'doc'].includes(f.kind) ? f.kind : 'other', type: String(f.type || ''), size: +f.size || 0, added: +f.added || 0 }));
  const start = /^\d{4}-\d\d-\d\d$/.test(x.start) ? ymd(mondayOf(parseYmd(x.start))) : ymd(mondayOf(new Date()));
  const u = { id: typeof x.id === 'string' && x.id ? x.id : lid(), course: String(x.course || ''), title: String(x.title || 'New unit'), start, weeks: weeks.length ? weeks : [{ focus: '', notes: '', standards: '' }],
    atlas: /^https?:\/\//.test(x.atlas) ? String(x.atlas) : '', color: /^#[0-9a-f]{6}$/i.test(x.color) ? x.color : '', files, updated: +x.updated || Date.now() };
  if (typeof x.notebook === 'string' && x.notebook.trim()) u.notebook = nbClean(x.notebook);
  if (x._file) u._file = x._file; if (x._mod) u._mod = x._mod;
  return u;
}
// src/planner/units.js
function courses() {
  const out = [];
  for (const c of (L.setup && L.setup.classes) || []) {
    const k = c.course || c.name; let o = out.find(x => x.course === k);
    if (!o) out.push(o = { course: k, classes: [], color: c.color });
    o.classes.push(c);
  }
  for (const u of L.units) if (u.course && !out.some(x => x.course === u.course)) out.push({ course: u.course, classes: [], color: '#5C616A' });
  return out;
}
// src/planner/units.js
const unitColor = u => u.color || UNIT_COLORS[Math.max(0, L.units.filter(x => x.course === u.course).sort((a, b) => a.start.localeCompare(b.start)).indexOf(u)) % UNIT_COLORS.length];
// src/planner/units.js
const unitEnd = u => ymd(addDays(parseYmd(u.start), 7 * (u.weeks.length - 1)));
// src/planner/units.js
function unitAt(course, monday) {
  for (const u of L.units) {
    if (u.course !== course) continue;
    const n = Math.round((parseYmd(monday) - parseYmd(u.start)) / 864e5 / 7);
    if (n >= 0 && n < u.weeks.length) return { u, n };
  }
  return null;
}
// src/planner/units.js
function semesterMondays() {
  const s = L.setup || {}, today = mondayOf(new Date());
  let a = s.semStart ? parseYmd(s.semStart) : null, b = s.semEnd ? parseYmd(s.semEnd) : null;
  if (!a) { const starts = L.units.map(u => u.start).sort(); a = starts.length ? parseYmd(starts[0]) : addDays(today, -28); }
  if (!b) { const ends = L.units.map(unitEnd).sort(); b = addDays(today, 7 * 12); if (ends.length && parseYmd(ends[ends.length - 1]) > b) b = parseYmd(ends[ends.length - 1]); }
  if (b < a) b = addDays(a, 7 * 18);
  const out = []; for (let d = mondayOf(a); d <= b && out.length < 60; d = addDays(d, 7)) out.push(ymd(d));
  return out;
}
// src/planner/units.js
const schoolWeek = monday => { const s = L.setup && L.setup.semStart; if (!s) return 0; const n = Math.round((parseYmd(monday) - parseYmd(s)) / 864e5 / 7) + 1; return n >= 1 ? n : 0; };
// src/planner/units.js
const weekDays = monday => plWeekOffs().map(i => ymd(addDays(parseYmd(monday), i)));
// src/planner/units.js
function weekMeetings(course, monday) {
  const ids = new Set(((courses().find(c => c.course === course) || {}).classes || []).map(c => c.id));
  return weekDays(monday).flatMap(d => meetingsOn(d).filter(m => ids.has(m.c.id)));
}
// src/planner/units.js
const rangeLabel = monday => { const o = plWeekOffs(), a = addDays(parseYmd(monday), o[0]), b = addDays(parseYmd(monday), o[o.length - 1]); return a.getMonth() !== b.getMonth() || plMd(a) !== (a.getMonth() + 1) + '/' + a.getDate() ? plMd(a) + '–' + plMd(b) : plMd(a) + '–' + b.getDate(); };
// src/planner/units.js
const unitBase = u => ((u.course ? u.course + ' - ' : '') + (u.title || 'Unit')).replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 90);
// src/planner/units.js
function unitForFile(u) { const { _file, _mod, ...c } = u; c.files = u.files.map(({ name, kind, type, size }) => ({ name, kind, type, size })); return c; }
// src/planner/plannext.js
const PN_DAYS = 14, PN_SHOW = 4, PN_RECENT = 3 * 864e5;
// src/planner/plannext.js
function planGaps(now = new Date()) {
  const out = [], today = ymd(now), hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  for (let i = 0; i < PN_DAYS; i++) {
    const d = ymd(addDays(now, i)); if (dayOff(d)) continue;
    for (const { c, m } of meetingsOn(d)) {
      if (d === today && m.end && m.end <= hhmm) continue;
      if (!lessonsAt(c.id, d).length) out.push({ c, m, d });
    }
  }
  return out;
}
// src/planner/plannext.js
function planNextWeek(now = new Date()) {
  const mon = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 7 - (now.getDay() + 6) % 7), m = ymd(mon), s = L.setup || {}, out = { of: 0, planned: 0, ready: 0, dots: [] };
  const lastMon = s.semEnd ? ymd(addDays(parseYmd(s.semEnd), -((parseYmd(s.semEnd).getDay() + 6) % 7))) : '';
  if (lastMon && m > lastMon) return out;
  for (let i = 0; i < 7; i++) {
    const d = ymd(addDays(mon, i)); if (s.semStart && d < s.semStart) continue;
    for (const { c } of meetingsOn(d)) {
      const ls = lessonsAt(c.id, d), ok = ls.some(l => l.ready || l.final);
      out.of++; if (ls.length) out.planned++; if (ok) out.ready++;
      out.dots.push(ok ? 2 : ls.length ? 1 : 0);
    }
  }
  return out;
}
// src/planner/plannext.js
const planRecent = () => L.lessons.filter(l => !l.library && Date.now() - l.updated < PN_RECENT).sort((a, b) => b.updated - a.updated)[0] || null;
// src/planner/plantime.js
var ptReady = false;
// src/planner/plantime.js
let ptLast = 0, ptRun = { s: 0, a: {}, n: {}, live: false }, ptPend = { l: 0, a: {}, n: {} }, ptFlushed = Date.now();
// src/planner/plantime.js
function ptPlan() { try { const P = JSON.parse(localStorage.getItem('gsp.planTime') || 'null'); return P && typeof P === 'object' ? P : {}; } catch { return {}; } }
// src/planner/plantime.js
function ptLessonSecs(id) {
  if (!ptReady || !id) return 0;
  let s = ptPend.a[id] || 0;
  for (const d of Object.values(ptPlan().days || {})) if (d && d.a && d.a[id]) s += d.a[id];
  const r = pfReady ? pfRun() : null;   // src/planner/plfocus.js, which runs after this file
  if (r && r.k === 'l' && r.l === id && (r.st === 'run' || r.st === 'paused')) s += pfLesSecs(r);
  return s;
}
// src/planner/plantime.js
function ptPace() {
  const days = Object.values(ptPlan().days || {});
  const tot = id => { let s = ptPend.a[id] || 0; for (const d of days) if (d && d.a && d.a[id]) s += d.a[id]; return s; };
  const xs = L.lessons.filter(l => l.ready && l.ready.at).sort((a, b) => b.ready.at - a.ready.at).map(l => tot(l.id)).filter(s => s >= 60).slice(0, 10);
  if (xs.length < 3) return null;
  const o = xs.slice().sort((a, b) => a - b), h = o.length >> 1;
  return { s: o.length % 2 ? o[h] : (o[h - 1] + o[h]) / 2, n: xs.length };
}
// src/planner/plfocus.js
var pfReady = false;   // src/planner/plantime.js and the lesson editor can ask before this file has run
// src/planner/plfocus.js
const PF_KEY = 'gsp.focusRun', PF_Q = 'gsp.focusQ', PF_P0 = 1e9;
// src/planner/plfocus.js
const pfGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
// src/planner/plfocus.js
const pfRun = () => { const r = pfGet(PF_KEY, null); return r && r.st ? r : null; };
// src/planner/plfocus.js
const pfElapsed = r => Math.max(0, Math.round(((r.st === 'paused' ? r.pz : Date.now()) - r.at) / 1000));
// src/planner/plfocus.js
const pfIdle = r => (r.idl || 0) + (r.ii ? Math.max(0, Math.round(((r.st === 'paused' ? r.pz : Date.now()) - r.ii) / 1000)) : 0);
// src/planner/plfocus.js
function pfLesSecs(r) {
  const last = Math.max(r.at, r.seen || 0), cap = r.st === 'paused' ? Infinity : Math.round((last + 20 * 60e3 - r.at) / 1000);
  return Math.max(0, Math.min(r.len, pfElapsed(r) - pfIdle(r), cap));
}
export { L, meetsOn, plWeekOffs, ymd, parseYmd, addDays, mondayOf, longDate, shortDate, hm, classById, className, dayOff, eventsOn, meetingsOn, lessonsAt, partnerSlots, semesterMondays, schoolWeek, weekDays, weekMeetings, rangeLabel, courses, lid, LAYOUTS, SIZES, SIZES_ANY, deckRule, deckAgenda, deckSizes, deckAdd, deckSizeSay, deckClean, normSlide, normLesson, deckStart, titleSlideOf, titlesLinked, bodyLines, slideHtml, titleSubtitle, imgSrc, ytId, ytStart, videoLink, videoSource, STATUS, statusSay, LOOKS, lookOf, normLinks, normBoxes, normTaught, taughtAt, taughtWhere, taughtText, minsOf, varName, normUnit, unitColor, unitEnd, unitAt, unitBase, unitForFile, tidyBank, normScale, normRef, normRubric, normBankScale, bankRubrics, bankScales, bankList, refKey, refLabel, refUnit, unitRef, bankForFile, bankBase, ACTIVITIES, normActivity, actSlide, planGaps, planNextWeek, planRecent, ptPace, ptLessonSecs, lessonText, lessonForFile, ctxFile, fileBase, folderReadme, FOLDER_MARK, b64ToU8, buildPptx, tplPreview, lessonBack, pptxToSlides, mimeOf, hash, esc };
