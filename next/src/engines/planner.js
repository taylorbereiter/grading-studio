// MADE BY next/build.js FROM src/planner/*.js (next/tools/lift.js). Do not edit: change the source and build again.
// L holds what the Planner keeps in memory: the new app puts the timetable in L.setup (and lessons, units) before calling.
/* eslint-disable */
import * as fflate from 'fflate';
const myActivities = async () => ((L && L.activities) || []).filter(a => a && a.name);

// src/planner/base.js
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// src/planner/base.js
function hash(s) {
  let h1 = 0x811c9dc5, h2 = 0x1234567;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
// src/planner/review.js
const STATUS = { claude: 'With the assistant', review: 'Ready for you' };   // the chip's words are read when it is drawn (statusSay): the assistant's name is the teacher's own
// src/planner/review.js
const MAX_VERSIONS = 30;
// src/planner/review.js
const snap = l => { const c = JSON.parse(JSON.stringify(l)); delete c._file; delete c._mod; delete c.pending; return c; };
// src/planner/review.js
const lessonZipAsk = () => 'When you are done, give me ONE downloadable .zip file. In it:\n' +
  '- lesson.json: { "kind": "grading-studio-lesson-zip", "lesson": { "title": "…", "slides": [ … ] }, "preview": "<the .pptx file name>", "materials": ["<each handout file name>"] }.\n' +
  '  "slides" is every slide of the lesson, in order. My Planner makes the real PowerPoint from these with my school template, so they matter most. Each slide is one of:\n' +
  '  { "layout": "title", "title": "…", "body": "" }   { "layout": "agenda", "title": "…", "body": "1. …\\n2. …" }\n' +
  '  { "layout": "content", "title": "…", "body": "• Point\\n\\t• Smaller point", "notes": "speaker notes" }   { "layout": "text", "title": "…", "body": "plain paragraphs" }\n' +
  '  { "layout": "warmup", "title": "Warm-up", "tag": "Journal", "body": "the prompt" }   { "layout": "objectives", "title": "Today we will", "body": "1. …" }\n' +
  '  { "layout": "steps", "title": "…", "body": "1. …\\n2. …", "foot": "When you’re done: …" }   { "layout": "discuss", "title": "…", "body": "the question", "foot": "Think · Pair · Share" }\n' +
  '  { "layout": "twocol", "title": "…", "h1": "left heading", "body": "left", "h2": "right heading", "body2": "right" }   { "layout": "passage", "title": "…", "body": "“the passage”", "cite": "source", "foot": "the question" }\n' +
  '  { "layout": "vocab", "title": "Word of the day", "word": "…", "pos": "noun", "body": "meaning", "foot": "example" }   { "layout": "video", "title": "…", "video": { "url": "https://…", "start": 30 } }\n' +
  '  { "layout": "exit", "title": "Exit ticket", "tag": "On a sticky note", "body": "the question" }   { "layout": "picture", "title": "…" } (keeps the picture already on that slide)\n' +
  '  Any slide may have "notes" and "size" (' + deckSizeSay() + '). Lines are separated by \\n and show exactly as written. Reply to my comments with "talk": [{ "by": "claude", "text": "…" }] on that slide.\n' +
  '- a preview PowerPoint (.pptx) of the same slides, so I can look before I upload;\n' +
  '- any handouts or other files the lesson needs (.docx, .pdf and so on).\n' +
  'Also give me each piece (the preview PowerPoint and every handout) as its own downloadable file, so I can open or use one without the .zip.\n' +
  'Put nothing about any student in any of them. Then tell me in a few lines what you changed. I will upload the .zip on this lesson in my Planner.';
// src/planner/review.js
async function lessonContext(l) {
  let t = '';
  const when = (l.slots || []).map(sl => { const c = classById(sl.classId); if (!c) return ''; const d = parseYmd(sl.date).getDay(), m = (c.meets || []).find(x => +x.dow === d);
    return '- ' + c.name + (c.course && c.course !== c.name ? ' (' + c.course + ')' : '') + ', ' + longDate(sl.date) + (m && m.start ? ', ' + hm(m.start) + (m.end ? '–' + hm(m.end) + ' (' + (minsOf(m.end) - minsOf(m.start)) + ' minutes)' : '') : ''); }).filter(Boolean);
  if (when.length) t += '## When I teach it\n' + when.join('\n') + '\n\n';
  const hit = lessonUnit(l);
  if (hit) {
    const { u, n } = hit;
    t += '## The unit: ' + u.title + (u.course ? ' (' + u.course + ')' : '') + '\nThis lesson is in week ' + (n + 1) + ' of ' + u.weeks.length + '.' + (u.atlas ? ' Unit plan page: ' + u.atlas : '') + '\n' +
      u.weeks.map((w, i) => '- Week ' + (i + 1) + (i === n ? ' (this week)' : '') + ': ' + (w.focus || '…') + (w.standards ? ' [' + w.standards + ']' : '') + (w.notes ? ' My notes: ' + w.notes : '')).join('\n') + '\n\n';
  }
  const acts = (await myActivities()).slice(0, 25);
  if (acts.length) t += '## Activities I like to use (use one where it fits)\n' + acts.map(a => '- ' + a.name + (a.what ? ': ' + a.what : '')).join('\n') + '\n\n';
  return t;
}
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
function PlAi() { return plWords().ai || 'Your AI assistant'; }
// src/planner/lessons.js
const dayOff = date => ((L.setup && L.setup.daysOff) || []).find(d => d.date === date);
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
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
// src/planner/lessons.js
const mmss = t => Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
// src/planner/lessons.js
function videoLink(v) { const id = ytId(v.url); return id ? 'https://www.youtube.com/watch?v=' + id + (v.start ? '&t=' + v.start + 's' : '') : v.url; }
// src/planner/lessons.js
function videoSource(v) { return (v.title ? v.title + ' · ' : '') + (ytId(v.url) ? 'YouTube' + (v.by ? ', ' + v.by : '') : hostOf(v.url)) + (v.start ? ' · starts at ' + mmss(v.start) : ''); }
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
// src/planner/boxes.js
const boxOver = el => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2;
// src/planner/boxes.js
const FIT_SEL = '.ls-t,.ls-ttl,.ls-sub,.ls-body,.ls-bx';
// src/planner/boxes.js
function slideFit(root, mode) {
  const over = [];
  if (!root) return over;
  for (const el of root.querySelectorAll(FIT_SEL)) {
    if (!el.offsetHeight || !boxOver(el)) continue;
    if (mode === 'edit') { el.classList.add('ls-over'); over.push(el.dataset.k); continue; }
    // First the box takes the empty room under it (down to the next box, or near the slide's bottom edge), then the text gets smaller.
    const top = el.offsetTop, l = el.offsetLeft, r = l + el.offsetWidth;
    let floor = root.querySelector('.lk-wood') ? 640 : 700;
    for (const o of root.querySelectorAll(FIT_SEL + ',.ls-pic,.ls-src,.ls-vid')) if (o !== el && o.offsetTop > top && o.offsetLeft < r && o.offsetLeft + o.offsetWidth > l && (o.textContent.trim() || o.querySelector('img'))) floor = Math.min(floor, o.offsetTop - 8);
    if (floor > top + el.offsetHeight) el.style.height = (floor - top) + 'px';
    if (!boxOver(el)) continue;
    const base = parseFloat(getComputedStyle(el).fontSize) || 16;
    for (let f = 0.95; f >= 0.4 && boxOver(el); f -= 0.05) el.style.fontSize = (base * f).toFixed(1) + 'px';
    el.classList.add('ls-shrunk');
  }
  return over;
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
const A = (id, name, kind, parts, group, what, how, slide, book, tip) => ({ id, name, kind, parts, group, what, how, slide, book: book || 0, tip: tip || '' });
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
const ZIP_SKIP = n => /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$|~\$)/i.test(n) || /(^|\/)\.[^/]/.test(n);
// src/planner/finished.js
const MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', txt: 'text/plain', md: 'text/markdown', html: 'text/html', mp3: 'audio/mpeg', mp4: 'video/mp4' };
// src/planner/finished.js
const mimeOf = n => MIME[((/\.(\w+)$/.exec(n) || [])[1] || '').toLowerCase()] || '';
// src/planner/finished.js
const baseName = n => String(n).split('/').pop();
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
// src/planner/variants.js
const varName = l => l.variant || (l.variantOf ? 'Alternative' : 'Original');
// src/planner/panel.js
const SP = { open: false, tab: 'books', w: 420, view: 'page', book: null, pdf: null, page: 1, outline: null, find: '', hits: null, texts: {}, video: '', box: { text: '', chips: [] } };
// src/planner/panel.js
function lessonUnit(l) {
  for (const t of (l && l.slots) || []) { const c = classById(t.classId), hit = c && c.course && unitAt(c.course, ymd(mondayOf(parseYmd(t.date)))); if (hit) return hit; }
  return null;
}
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
const taughtWhere = t => t.slide >= t.of ? 'finished all ' + t.of + ' slides' : 'got to slide ' + t.slide + ' of ' + t.of;
// src/planner/present.js
function taughtText(l) {
  return (l.taught || []).map(t => 'Taught: ' + (t.classId ? className(t.classId) + ', ' : '') + longDate(t.date) + ': ' + taughtWhere(t) + (t.agenda ? ' (agenda: ' + t.agenda[0] + ' of ' + t.agenda[1] + ' done)' : '') + (t.note ? '. Note: ' + t.note : '') + '\n').join('');
}
// src/planner/units.js
const MAX_FILE = 40 * 1024 * 1024;
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
function uniqueName(u, name) {
  name = String(name || 'file').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'file';
  if (!u.files.some(f => f.name === name)) return name;
  const m = /^(.*?)(\.[^.]*)?$/.exec(name); let i = 2;
  while (u.files.some(f => f.name === m[1] + ' (' + i + ')' + (m[2] || ''))) i++;
  return m[1] + ' (' + i + ')' + (m[2] || '');
}
export { L, plWeekOffs, mondayOf, meetingsOn, partnerSlots, unitAt, unitEnd, lid, LAYOUTS, deckAgenda, deckSizes, deckAdd, deckSizeSay, normSlide, normLesson, deckStart, slideHtml, slideFit, tplPreview, lessonForFile, fileBase, b64ToU8, buildPptx, mimeOf, lessonText, lessonZipAsk, lessonContext, lessonBack, ZIP_SKIP, baseName, MAX_FILE, snap, MAX_VERSIONS, uniqueName, normLinks, lkUrl, lkHost };
