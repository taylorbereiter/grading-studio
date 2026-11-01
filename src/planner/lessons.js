/* ================= Lessons =================
   A slide maker tied to the teacher's timetable, on the Planner page. Kept apart from grading on purpose:
   lessons live in their own IndexedDB ('gs-lessons'), and nothing here reads grading data.
   The Planner folder link writes only planning (lessons, units, the timetable) to a folder the teacher picks,
   so Claude can read and edit planning there and nothing else. */
const L = { db: null, lessons: [], units: [], setup: null, view: 'semester', weekOf: null, open: null, cur: 0, dir: null, dirOk: false, tplImg: null, unit: null };
const LDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LMONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const LAYOUTS = { title: 'Title', agenda: 'Agenda', objectives: 'Objectives', warmup: 'Warm-up', exit: 'Exit ticket', steps: 'Directions with steps', discuss: 'Discussion question', content: 'Bullets', twocol: 'Two columns', text: 'Plain text', passage: 'Passage', vocab: 'Vocabulary', picture: 'Picture', picprompt: 'Picture + questions', video: 'Video' };
const SIZES = [28, 30, 32, 34, 36];   // slide text stays between 28 and 36 pt, big enough to read from the back of the room
const lid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ---------- dates ---------- */
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const parseYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = d => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
const ordinal = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const longDate = s => { const d = parseYmd(s); return LDAYS_LONG[d.getDay()] + ' ' + LMONTHS[d.getMonth()] + ' ' + ordinal(d.getDate()) + ' ' + d.getFullYear(); };
const shortDate = s => { const d = parseYmd(s); return LDAYS[d.getDay()] + ' ' + (d.getMonth() + 1) + '/' + d.getDate(); };
const hm = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return (h % 12 || 12) + ':' + String(m).padStart(2, '0'); };

/* ---------- storage (own database, never the grading one) ---------- */
function lOpenDb() {
  if (L.db) return Promise.resolve(L.db);
  return new Promise((res, rej) => {
    const r = indexedDB.open('gs-lessons', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('lessons', { keyPath: 'id' }); r.result.createObjectStore('kv'); };
    r.onsuccess = () => { L.db = r.result; res(L.db); };
    r.onerror = () => rej(r.error);
  });
}
async function lTx(store, mode, fn) {
  const db = await lOpenDb();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode), s = t.objectStore(store); let out;
    Promise.resolve(fn(s)).then(v => { out = v; });
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error);
  });
}
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const kvGet = k => lTx('kv', 'readonly', s => reqP(s.get(k)));
const kvSet = (k, v) => lTx('kv', 'readwrite', s => { s.put(v, k); });
async function lLoadAll() { L.lessons = (await lTx('lessons', 'readonly', s => reqP(s.getAll()))) || []; }
async function lPut(lesson) {
  lesson.updated = Date.now();
  await lTx('lessons', 'readwrite', s => { s.put(lesson); });
  if (!L.lessons.includes(lesson)) { const i = L.lessons.findIndex(x => x.id === lesson.id); if (i >= 0) L.lessons[i] = lesson; else L.lessons.push(lesson); }
  folderWriteSoon(lesson);
}
async function lDelete(lesson) {
  await lTx('lessons', 'readwrite', s => { s.delete(lesson.id); });
  L.lessons = L.lessons.filter(x => x.id !== lesson.id);
  folderRemove(lesson);
}

/* ---------- lesson shape: anything Claude or an import hands us is cleaned up first ---------- */
function normSlide(s) {
  s = s && typeof s === 'object' ? s : {};
  const layout = LAYOUTS[s.layout] ? s.layout : 'content';
  const size = SIZES.includes(+s.size) ? +s.size : 28;
  const out = { id: typeof s.id === 'string' ? s.id : lid(), layout, title: String(s.title || ''), body: String(s.body || '').replace(/\r/g, ''), size, notes: String(s.notes || ''),
    ask: String(s.ask || ''), talk: (Array.isArray(s.talk) ? s.talk : []).filter(t => t && t.text).map(t => ({ by: t.by === 'claude' ? 'claude' : 'you', text: String(t.text), at: +t.at || 0, ...(t.done ? { done: true } : {}) })) };
  for (const k of EXTRA) if (s[k]) out[k] = String(s[k]).replace(/\r/g, '');
  if (s.img && typeof s.img === 'object' && typeof s.img.src === 'string') out.img = { src: s.img.src, w: +s.img.w || 0, h: +s.img.h || 0, source: String(s.img.source || '') };
  if (s.video && typeof s.video === 'object' && /^https?:\/\//.test(s.video.url)) {
    const v = s.video;
    out.video = { url: String(v.url), title: String(v.title || ''), by: String(v.by || ''), start: Math.max(0, Math.round(+v.start || 0)) };
    if (typeof v.thumb === 'string' && /^data:image\/(png|jpeg);base64,/.test(v.thumb)) out.video.thumb = v.thumb;
  }
  return out;
}
function normLesson(x) {
  x = x && typeof x === 'object' ? x : {};
  const slots = Array.isArray(x.slots) ? x.slots.filter(t => t && typeof t.classId === 'string' && /^\d{4}-\d\d-\d\d$/.test(t.date)).map(t => ({ classId: t.classId, date: t.date })) : [];
  const slides = Array.isArray(x.slides) && x.slides.length ? x.slides.map(normSlide) : [normSlide({ layout: 'title' })];
  const out = { id: typeof x.id === 'string' && x.id ? x.id : lid(), title: String(x.title || 'Untitled lesson'), slots, slides, created: +x.created || Date.now(), updated: +x.updated || Date.now(), note: String(x.note || ''),
    status: STATUS[x.status] ? x.status : '', claudeNote: String(x.claudeNote || '') };
  if (LOOKS[x.look]) out.look = x.look;
  if (x.pending && Array.isArray(x.pending.before)) out.pending = { at: +x.pending.at || Date.now(), before: x.pending.before.map(normSlide), title: String(x.pending.title || '') };
  if (x._file) out._file = x._file; if (x._mod) out._mod = x._mod;
  return out;
}

/* ---------- timetable ---------- */
const classById = id => ((L.setup && L.setup.classes) || []).find(c => c.id === id);
const className = id => { const c = classById(id); return c ? c.name : id; };
const dayOff = date => ((L.setup && L.setup.daysOff) || []).find(d => d.date === date);
const eventsOn = date => ((L.setup && L.setup.events) || []).filter(e => e.date === date || (e.to && e.date <= date && date <= e.to));
function meetingsOn(date) {
  if (!L.setup || dayOff(date)) return [];
  const dow = parseYmd(date).getDay(), out = [];
  for (const c of L.setup.classes || []) for (const m of c.meets || []) if (+m.dow === dow) out.push({ c, m, date });
  return out.sort((a, b) => (a.m.start || '').localeCompare(b.m.start || ''));
}
const lessonsAt = (classId, date) => L.lessons.filter(l => l.slots.some(s => s.classId === classId && s.date === date));
// One deck for both sections of a course (Taylor's rule): a new lesson also goes on the other section's
// matching class that week (same place in its week), when that class has no lesson yet.
function partnerSlots(classId, date) {
  const c = classById(classId); if (!c || !c.course) return [];
  const mon = mondayOf(parseYmd(date)), week = [0, 1, 2, 3, 4, 5, 6].map(i => ymd(addDays(mon, i)));
  const nth = week.flatMap(d => meetingsOn(d).filter(x => x.c.id === classId).map(x => x.date)).indexOf(date);
  const out = [];
  for (const o of L.setup.classes) {
    if (o.id === classId || o.course !== c.course) continue;
    const theirs = week.flatMap(d => meetingsOn(d).filter(x => x.c.id === o.id).map(x => x.date));
    const d = theirs[nth]; if (d && !lessonsAt(o.id, d).length) out.push({ classId: o.id, date: d });
  }
  return out;
}

/* ---------- slide drawing (1280 x 720 design units; 1 pt = 4/3 units) ---------- */
const PT = 4 / 3;
function bodyLines(body) { return String(body || '').split('\n').map(t => { const m = /^(\t| {2,})/.exec(t); return { lvl: m ? 1 : 0, text: t.replace(/^\s+/, '') }; }).filter((x, i, a) => x.text || i < a.length - 1); }
function slideHtml(s, lesson, edit) {
  const look = lookOf(lesson), titleSlide = s.layout === 'title';
  return '<div class="ls-lk lk-' + look + (titleSlide ? ' ls-tslide' : '') + '" style="' + lookVars(look) + '">' +
    lookShapes(look, titleSlide).map(([x, y, w, h, f, ln]) => '<div class="ls-shape" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;' + (f ? 'background:' + f : '') + (ln ? ';border:' + ln[1] + 'px solid ' + ln[0] + ';border-radius:6px;box-sizing:border-box' : '') + '"></div>').join('') +
    slideInner(s, lesson, edit, look) + '</div>';
}
function slideInner(s, lesson, edit, look) {
  const sz = s.size * PT, cap = t => esc(t);
  let h = '<div class="ls-bg"></div><div class="ls-fade"></div><div class="ls-wood"' + (L.tplImg ? ' style="background-image:url(' + L.tplImg + ')"' : '') + '></div>';
  const ed = (k, cls, text, ph) => '<div class="' + cls + (edit ? ' ls-ed' : '') + '" data-k="' + k + '"' + (edit ? ' tabindex="0"' : '') + '>' + (text ? cap(text) : edit ? '<span class="ls-ph">' + ph + '</span>' : '') + '</div>';
  if (s.layout === 'title') {
    h += ed('title', 'ls-ttl', s.title, 'Click to add a title');
    h += '<div class="ls-trule"></div>';
    const sub = s.body ? s.body : titleSubtitle(lesson);
    h += '<div class="ls-sub' + (edit ? ' ls-ed' : '') + '" data-k="body"' + (edit ? ' tabindex="0"' : '') + '>' + sub.split('\n').map(esc).join('<br>') + '</div>';
    return h;
  }
  h += ed('title', 'ls-t', s.title, 'Click to add a title') + '<div class="ls-rule"></div>';
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
  const lines = bodyLines(s.body);
  let inner = '';
  if (!lines.length) inner = edit ? '<span class="ls-ph">Click to add text</span>' : '';
  else if (s.layout === 'agenda' || s.layout === 'objectives') inner = '<ol>' + lines.filter(x => x.text).map(x => '<li>' + esc(x.text) + '</li>').join('') + '</ol>';
  else if (s.layout === 'text') inner = lines.map(x => '<p>' + (esc(x.text) || '&nbsp;') + '</p>').join('');
  else inner = '<ul>' + lines.map(x => '<li class="l' + x.lvl + '">' + (esc(x.text) || '&nbsp;') + '</li>').join('') + '</ul>';
  h += '<div class="ls-body ls-' + (s.layout === 'objectives' ? 'agenda' : s.layout) + (edit ? ' ls-ed' : '') + '" data-k="body" style="font-size:' + sz + 'px"' + (edit ? ' tabindex="0"' : '') + '>' + inner + '</div>';
  return h;
}
function titleSubtitle(lesson) {
  const courses = [...new Set(lesson.slots.map(s => (classById(s.classId) || {}).course || className(s.classId)))];
  const dates = [...new Set(lesson.slots.map(s => s.date))].sort();
  return [courses.join(' / '), ...dates.map(longDate)].filter(Boolean).join('\n');
}
const imgSrc = src => /^(data:image\/|blob:)/.test(src) ? src : '';
// YouTube: watch, youtu.be, shorts, embed and live links all give the 11-character id.
function ytId(u) {
  try {
    const x = new URL(u), h = x.hostname.replace(/^(www|m|music)\./, '');
    if (h === 'youtu.be') return /^[\w-]{11}$/.test(x.pathname.slice(1, 12)) ? x.pathname.slice(1, 12) : '';
    if (h === 'youtube.com' || h === 'youtube-nocookie.com') { const v = x.searchParams.get('v') || (/^\/(shorts|embed|live)\/([\w-]{11})/.exec(x.pathname) || [])[2]; return /^[\w-]{11}$/.test(v || '') ? v : ''; }
  } catch { }
  return '';
}
function ytStart(u) { try { const t = new URL(u).searchParams.get('t') || ''; const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; } catch { return 0; } }
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const mmss = t => Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
// The link to open: a YouTube video starts where the slide says.
function videoLink(v) { const id = ytId(v.url); return id ? 'https://www.youtube.com/watch?v=' + id + (v.start ? '&t=' + v.start + 's' : '') : v.url; }
function videoSource(v) { return (v.title ? v.title + ' · ' : '') + (ytId(v.url) ? 'YouTube' + (v.by ? ', ' + v.by : '') : hostOf(v.url)) + (v.start ? ' · starts at ' + mmss(v.start) : ''); }
async function videoFrom(url) {
  const v = { url, title: '', by: '', start: ytStart(url) }, id = ytId(url);
  if (!id) return v;
  try { const j = await (await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id))).json(); v.title = String(j.title || ''); v.by = String(j.author_name || ''); } catch { }
  try {
    const b = await (await fetch('https://i.ytimg.com/vi/' + id + '/hqdefault.jpg')).blob();
    v.thumb = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
    if (!/^data:image\/jpeg;base64,/.test(v.thumb)) delete v.thumb;
  } catch { }
  return v;
}
function videoDlg() {
  const s = L.open.slides[L.cur], v = s.video || {};
  openDlg('<div class="bh"><h2>Video</h2></div><div class="bb"><label class="ls-f">Link<input id="vdU" class="btn" style="justify-content:flex-start" placeholder="Paste a YouTube link (or any video link)" value="' + esc(v.url || '') + '"></label>' +
    '<label class="ls-f">Start at (minutes:seconds)<input id="vdS" class="btn sm" style="width:110px" placeholder="0:00" value="' + (v.start ? mmss(v.start) : '') + '"></label>' +
    '<p class="muted" style="font-size:13px;margin:0">The slide shows the video’s picture with a play button and the title and channel as the source line. Clicking it in the .pptx opens the video.</p></div>' +
    '<div class="bf">' + (s.video ? '<button class="btn" data-rm>Take the video off</button><span class="sp" style="flex:1"></span>' : '') + '<button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Use this link</button></div>', true);
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    if (e.target.closest('[data-rm]')) { delete s.video; closeDlg(); lessonChanged(); return renderEditor(); }
    if (!e.target.closest('[data-ok]')) return;
    let u = $('#vdU').value.trim(); if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
    if (!/^https?:\/\/[^\s]+\.[^\s]+/.test(u)) return toast('That doesn’t look like a link');
    const st = /^\s*(?:(\d+):)?(\d+)\s*$/.exec($('#vdS').value), start = st ? (+st[1] || 0) * 60 + +st[2] : 0;
    closeDlg(); await setVideo(u, s, start);
  };
}
async function setVideo(url, slide, start) {
  const s = slide || L.open.slides[L.cur];
  const same = s.video && s.video.url === url;
  const v = same ? s.video : await videoFrom(url);
  if (start != null) v.start = start;
  s.video = v; s.layout = 'video';
  if (!s.title && v.title) s.title = v.title.length > 48 ? v.title.slice(0, 46).trim() + '…' : v.title;
  lessonChanged(); renderEditor();
}

/* ---------- screen ---------- */
function lessonsShell() {
  const d = $('#lessons');
  // Keep drops and keys in here away from the grading screen's handlers.
  for (const ev of ['dragover', 'drop']) d.addEventListener(ev, e => { e.stopPropagation(); if (ev === 'dragover') e.preventDefault(); });
  d.addEventListener('drop', e => { e.preventDefault(); onLessonDrop(e); });
  d.addEventListener('click', onLessonsClick);
  d.addEventListener('input', onLessonsInput);
  d.addEventListener('change', onLessonsChange);
  d.addEventListener('keydown', onLessonsKey);
}
async function openLessons() {
  lessonsShell();
  await lOpenDb(); await lLoadAll(); await unitsLoad(); await bankLoad();
  L.setup = (await kvGet('setup')) || null;
  L.defLook = (await kvGet('deflook')) || '';
  await tplPreview();
  if (!L.weekOf) L.weekOf = ymd(mondayOf(new Date()));
  try { const v = localStorage.getItem('gsp.view'); if (v === 'week' || v === 'semester' || v === 'units' || v === 'activities' || v === 'bank') L.view = v; } catch { }
  renderLessons();
  await folderReconnect(false);
}
// Grading Studio sits next to this page: index.html online, "Grading Studio.html" for the double-click copy.
function closeLessons() { editorCommit(); location.href = /Planner\.html$/i.test(decodeURIComponent(location.pathname)) ? 'Grading Studio.html' : './'; }
function renderLessons() {
  if (L.view === 'edit' && L.open) return renderEditor();
  if (L.view === 'unit' && L.unit) return renderUnit();
  if (!['semester', 'units', 'activities', 'bank'].includes(L.view)) L.view = 'week';
  try { localStorage.setItem('gsp.view', L.view); } catch { }
  if (L.view === 'semester') return renderSemester();
  if (L.view === 'units') return renderUnits();
  if (L.view === 'activities') return renderActivities();
  if (L.view === 'bank') return renderBank();
  renderWeek();
}

function folderChip() {
  if (!('showDirectoryPicker' in window)) return '<span class="muted ls-fold">The Planner folder needs Chrome</span>';
  if (L.dir && L.dirOk) return '<button class="btn sm ghost" data-a="sync" title="Look for lessons Claude added or changed in your Planner folder">⟳ Planner folder: ' + esc(L.dir.name) + '</button>';
  if (L.dir) return '<button class="btn sm" data-a="reconnect">Reconnect Planner folder</button>';
  return '<button class="btn sm" data-a="link">Link the Planner folder…</button>';
}
function renderWeek() {
  const el = $('#lessons'), mon = parseYmd(L.weekOf);
  const days = [0, 1, 2, 3, 4].map(i => ymd(addDays(mon, i)));
  const fri = addDays(mon, 4);
  let h = topBar('week', '<button class="btn sm ghost" data-a="wk" data-n="-7" aria-label="Previous week">‹</button>' +
    '<span class="ls-wk">' + LMONTHS[mon.getMonth()].slice(0, 3) + ' ' + mon.getDate() + ' – ' + (fri.getMonth() !== mon.getMonth() ? LMONTHS[fri.getMonth()].slice(0, 3) + ' ' : '') + fri.getDate() + '</span>' +
    '<button class="btn sm ghost" data-a="wk" data-n="7" aria-label="Next week">›</button><button class="btn sm ghost" data-a="today">This week</button>' +
    '<input type="date" class="btn sm" data-a="jump" value="' + L.weekOf + '" aria-label="Go to a date">');
  if (!L.setup) {
    h += '<div class="ls-empty"><h2>Load your timetable</h2><p>Lessons line up with your classes once the app knows when they meet. Load the setup file (it has your timetable, days off and slide template), or type your classes in.</p>' +
      '<div class="row"><button class="btn primary" data-a="loadsetup">Load setup file…</button><button class="btn" data-a="setup">Type in my classes</button><button class="btn" data-a="newfree">Make a lesson without a class</button></div></div>';
  } else {
    h += weekUnitsBar(L.weekOf) + '<div class="ls-grid">';
    for (const d of days) {
      const off = dayOff(d), ev = eventsOn(d), today = d === ymd(new Date());
      h += '<div class="ls-day' + (off ? ' off' : '') + (today ? ' today' : '') + '"><div class="ls-dh"><b>' + LDAYS[parseYmd(d).getDay()] + '</b> ' + (parseYmd(d).getMonth() + 1) + '/' + parseYmd(d).getDate() + '</div>';
      if (off) h += '<div class="ls-off">' + esc(off.label || 'No school') + '</div>';
      for (const e of ev) h += '<div class="ls-ev">' + esc(e.label) + '</div>';
      const ms = meetingsOn(d);
      if (!ms.length && !off) h += '<div class="ls-none">No classes</div>';
      for (const { c, m } of ms) {
        const ls = lessonsAt(c.id, d);
        h += '<div class="ls-slot" style="--cc:' + esc(c.color || '#1F6FB2') + '"><div class="ls-sh"><b>' + esc(c.name) + '</b><span>' + hm(m.start) + '–' + hm(m.end) + (m.label ? ' · ' + esc(m.label) : '') + '</span></div>';
        for (const l of ls) h += '<button class="ls-card" data-open="' + l.id + '"><b>' + esc(l.title) + '</b>' + statusChip(l) + '<span>' + l.slides.length + ' slide' + (l.slides.length === 1 ? '' : 's') + (l.slots.length > 1 ? ' · also ' + esc(l.slots.filter(s => !(s.classId === c.id && s.date === d)).map(s => className(s.classId) + ' ' + shortDate(s.date)).join(', ')) : '') + '</span></button>';
        h += '<div class="ls-add"><button class="btn sm ghost" data-new="' + esc(c.id) + '|' + d + '">+ New lesson</button>' + (L.lessons.length ? '<button class="btn sm ghost" data-attach="' + esc(c.id) + '|' + d + '">Use a lesson…</button>' : '') + '</div></div>';
      }
      h += '</div>';
    }
    h += '</div>';
    const loose = L.lessons.filter(l => !l.slots.length).sort((a, b) => b.updated - a.updated);
    h += '<div class="ls-loose"><div class="lhead"><h2>Not on the timetable</h2><span class="sp"></span><button class="btn sm" data-a="newfree">+ New lesson</button><button class="btn sm ghost" data-a="all">All lessons</button></div>' +
      (loose.length ? '<div class="ls-cards">' + loose.map(l => '<button class="ls-card" data-open="' + l.id + '"><b>' + esc(l.title) + '</b><span>' + l.slides.length + ' slides</span></button>').join('') + '</div>' : '<p class="muted" style="margin:0;font-size:13.5px">Lessons you haven’t put on a class show up here.</p>') + '</div>';
  }
  el.innerHTML = h;
}

/* ---------- editor ---------- */
function renderEditor() {
  const l = L.open; if (!l) return renderWeek();
  L.cur = Math.max(0, Math.min(L.cur, l.slides.length - 1));
  const s = l.slides[L.cur];
  let h = '<div class="ls-top"><button class="btn sm ghost" data-a="back">‹ ' + ({ semester: 'Semester', units: 'Units', unit: 'Unit', activities: 'Activities' }[L.backTo] || 'Week') + '</button>' +
    '<input class="ls-title-in" data-f="ltitle" value="' + esc(l.title) + '" aria-label="Lesson name">' +
    '<span class="ls-slots">' + l.slots.map((t, i) => '<span class="ls-chip" style="--cc:' + esc((classById(t.classId) || {}).color || '#1F6FB2') + '">' + esc(className(t.classId)) + ' · ' + shortDate(t.date) + '<button data-unslot="' + i + '" title="Take it off this class" aria-label="Remove">×</button></span>').join('') + '<button class="btn sm ghost" data-a="addslot">+ Class</button></span>' +
    '<span class="sp"></span>' + statusChip(l) + '<span class="savest" id="lsSaved">Saved</span>' +
    '<button class="btn sm" data-a="send" title="Copy a message for Claude about this lesson and open Claude">Send to Claude</button>' +
    '<button class="btn sm ghost" data-a="versions">Versions</button>' +
    '<button class="btn sm ghost" data-a="approve" title="Only a marker: you can still change it">' + (l.status === 'approved' ? '✓ Approved' : 'Approve') + '</button>' +
    '<button class="btn sm ghost" data-a="more">More ▾</button>' +
    '<button class="btn sm primary" data-a="pptx">Download .pptx</button></div>' + pendingBar(l);
  h += '<div class="ls-ed-cols"><nav class="ls-thumbs" id="lsThumbs">' + l.slides.map((x, i) => thumbHtml(x, l, i)).join('') +
    '<div class="ls-addslide"><button class="btn sm" data-a="addslide">+ Add slide</button></div></nav>';
  h += '<section class="ls-main"><div class="ls-tools">' +
    '<label>Layout <select data-f="layout" class="btn sm">' + Object.entries(LAYOUTS).map(([k, v]) => '<option value="' + k + '"' + (k === s.layout ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' +
    '<button class="btn sm" data-a="look" title="Colors and background for this lesson">Look: ' + esc(LOOKS[lookOf(l)].name) + '</button>' +
    (s.layout !== 'title' && s.layout !== 'picture' && s.layout !== 'video' ? '<label>Text <select data-f="size" class="btn sm">' + SIZES.map(z => '<option value="' + z + '"' + (z === s.size ? ' selected' : '') + '>' + z + ' pt</option>').join('') + '</select></label>' : '') +
    (s.layout === 'picture' || s.layout === 'picprompt' ? '<button class="btn sm" data-a="pic">' + (s.img ? 'Change picture' : 'Add picture') + '</button>' : '') +
    (s.layout === 'video' ? '<button class="btn sm" data-a="vid">' + (s.video ? 'Change video' : 'Add video link') + '</button>' + (s.video ? '<a class="btn sm ghost" href="' + esc(videoLink(s.video)) + '" target="_blank" rel="noopener">Watch</a>' : '') : '') +
    '<span class="sp"></span><button class="btn sm ghost" data-a="up" title="Move earlier">↑</button><button class="btn sm ghost" data-a="down" title="Move later">↓</button><button class="btn sm ghost" data-a="dup">Duplicate</button><button class="btn sm ghost" data-a="del">Delete slide</button></div>' +
    '<div class="ls-stagewrap" id="lsWrap"><div class="ls-stage" id="lsStage"><div class="ls-slide">' + slideHtml(s, l, true) + '</div></div></div>' +
    '<div class="ls-warn" id="lsWarn" hidden></div>' +
    '<label class="ls-notes">Speaker notes<textarea data-f="notes" rows="3" placeholder="Notes for you, not shown on the slide">' + esc(s.notes) + '</textarea></label>' +
    slideTalkHtml(s) +
    '<p class="muted ls-hint">Click any text on the slide to edit it. In bullets, start a line with Tab for a smaller point under the one above. Arrow keys move between slides when you’re not typing. Drag a picture in from another tab, or paste a picture or a YouTube link.</p>' +
    '</section></div><input type="file" id="lsPicIn" accept="image/*" hidden>';
  $('#lessons').innerHTML = h;
  fitStage(); checkFit();
  const th = $('#lsThumbs .ls-th.on'); if (th) th.scrollIntoView({ block: 'nearest' });
}
function thumbHtml(x, l, i) {
  return '<div class="ls-th' + (i === L.cur ? ' on' : '') + '" data-go="' + i + '" draggable="true"><span class="n">' + (i + 1) + '</span><div class="ls-mini"><div class="ls-slide">' + slideHtml(x, l, false) + '</div></div></div>';
}
function fitStage() {
  const w = $('#lsWrap'), st = $('#lsStage'); if (!w || !st) return;
  const k = Math.min(w.clientWidth / 1280, (window.innerHeight - 330) / 720, 1.2);
  st.style.setProperty('--k', Math.max(0.3, k)); st.style.width = 1280 * Math.max(0.3, k) + 'px'; st.style.height = 720 * Math.max(0.3, k) + 'px';
}
window.addEventListener('resize', () => { if ($('#lessons') && !$('#lessons').hidden && L.view === 'edit') fitStage(); });
// Text that runs past the slide gets a warning and a Split button, never a smaller font.
function checkFit() {
  const b = $('#lsStage .ls-body'), w = $('#lsWarn'); if (!w) return;
  const over = b && b.scrollHeight > b.clientHeight + 2;
  const bx = [...document.querySelectorAll('#lsStage .ls-bx')].some(x => x.scrollHeight > x.clientHeight + 2);
  w.hidden = !over && !bx;
  if (!over && bx) w.innerHTML = 'Some text runs past its box at this size. Shorten it, or pick a smaller text size (28 pt is the smallest).';
  if (over) w.innerHTML = 'This is more than fits at ' + L.open.slides[L.cur].size + ' pt. <button class="btn sm" data-a="split">Move the extra lines to a new slide</button>';
}
function refreshThumb(i) {
  const t = document.querySelector('#lsThumbs [data-go="' + i + '"]'); if (!t) return;
  t.outerHTML = thumbHtml(L.open.slides[i], L.open, i);
}
let lSaveT;
function lessonChanged(rethumb) {
  const el = $('#lsSaved'); if (el) el.textContent = 'Saving…';
  if (rethumb !== false) refreshThumb(L.cur);
  clearTimeout(lSaveT); lSaveT = setTimeout(async () => { await lPut(L.open); const e = $('#lsSaved'); if (e) e.textContent = '✓ Saved'; }, 400);
}

// In-place editing: a text box laid exactly over the slide text.
let lEditing = null;
function startEdit(box) {
  editorCommit();
  const s = L.open.slides[L.cur], k = box.dataset.k;
  if (k === 'img') return pickPicture();
  if (k === 'video') return videoDlg();
  const ta = document.createElement('textarea'); ta.className = 'ls-ta ' + box.className.replace('ls-ed', '');
  ta.style.cssText = box.getAttribute('style') || '';
  ta.value = k === 'title' ? s.title : k === 'source' ? (s.img ? s.img.source : '') : EXTRA.includes(k) ? (s[k] || '') : (s.layout === 'title' && !s.body ? titleSubtitle(L.open) : s.body);
  if ((s.layout === 'agenda' || s.layout === 'objectives') && k === 'body') ta.classList.add('ls-ta-ag');
  box.replaceWith(ta); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  lEditing = { ta, k };
  ta.addEventListener('blur', () => setTimeout(() => { if (lEditing && lEditing.ta === ta) editorCommit(); }, 0));
}
function editorCommit() {
  if (!lEditing || !L.open) return;
  const { ta, k } = lEditing; lEditing = null;
  const s = L.open.slides[L.cur], v = ta.value;
  if (k === 'title') s.title = v.replace(/\n+/g, ' ');
  else if (k === 'source') { if (s.img) s.img.source = v.replace(/\n+/g, ' '); }
  else if (EXTRA.includes(k)) { const t = k === 'body2' ? v : v.replace(/\n+/g, ' '); if (t) s[k] = t; else delete s[k]; }
  else s.body = (s.layout === 'title' && v === titleSubtitle(L.open)) ? '' : v;
  lessonChanged(); renderStage();
}
function renderStage() {   // redraw just the slide, so a click into the notes box keeps its focus
  const st = $('#lsStage .ls-slide'); if (!st) return renderEditor();
  st.innerHTML = slideHtml(L.open.slides[L.cur], L.open, true); checkFit();
}
function onLessonsKey(e) {
  if (lEditing && e.target === lEditing.ta) {
    if (e.key === 'Escape') { e.preventDefault(); lEditing.ta.blur(); return; }
    if (e.key === 'Tab' && lEditing.k === 'body' && !isTeach(L.open.slides[L.cur])) {   // Tab / Shift-Tab indent the current line
      e.preventDefault(); const ta = e.target, a = ta.selectionStart, v = ta.value, st = v.lastIndexOf('\n', a - 1) + 1;
      if (e.shiftKey) { if (v[st] === '\t') { ta.value = v.slice(0, st) + v.slice(st + 1); ta.setSelectionRange(a - 1, a - 1); } }
      else { ta.value = v.slice(0, st) + '\t' + v.slice(st); ta.setSelectionRange(a + 1, a + 1); }
      return;
    }
    if (lEditing.k !== 'body' && lEditing.k !== 'body2' && e.key === 'Enter') { e.preventDefault(); lEditing.ta.blur(); }
    return;
  }
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.f === 'say') { e.preventDefault(); return addComment(); }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (L.view === 'edit' && !typing && !e.metaKey && !e.ctrlKey) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goSlide(L.cur + 1); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goSlide(L.cur - 1); }
    else if (e.key === 'Enter' && e.target.classList.contains('ls-ed')) { e.preventDefault(); startEdit(e.target); }
  }
}
function goSlide(i) { editorCommit(); if (!L.open) return; L.cur = Math.max(0, Math.min(L.open.slides.length - 1, i)); renderEditor(); }
function newSlide(layout) {
  const first = (L.open.slots[0] || {}).date, d = first ? (parseYmd(first).getMonth() + 1) + '/' + parseYmd(first).getDate() + ' ' : '';
  const s = normSlide({ layout, ...(TEACH[layout] || {}), ...(layout === 'agenda' ? { title: d + 'Agenda' } : {}) });
  L.open.slides.splice(L.cur + 1, 0, s); L.cur++; lessonChanged(false); renderEditor();
}

async function onLessonsClick(e) {
  if (await bankClick(e)) return;
  if (await unitsClick(e)) return;
  const t = e.target.closest('[data-a],[data-open],[data-new],[data-attach],[data-go],[data-addslide],[data-unslot],[data-talkdone],.ls-ed');
  if (!t) return;
  if (L.view === 'edit' && await reviewClick(t)) return;
  if (L.view === 'activities' && t.dataset.a && await activitiesClick(t)) return;
  if (t.classList.contains('ls-ed') && !t.dataset.a) return startEdit(t);
  if (t.dataset.open) return openLesson(L.lessons.find(l => l.id === t.dataset.open));
  if (t.dataset.new) { const [c, d] = t.dataset.new.split('|'); return createLesson([{ classId: c, date: d }, ...partnerSlots(c, d)]); }
  if (t.dataset.attach) { const [c, d] = t.dataset.attach.split('|'); return pickLessonFor(c, d); }
  if (t.dataset.go != null) return goSlide(+t.dataset.go);
  if (t.dataset.addslide) return newSlide(t.dataset.addslide);
  if (t.dataset.unslot != null) { L.open.slots.splice(+t.dataset.unslot, 1); lessonChanged(false); return renderEditor(); }
  const a = t.dataset.a, l = L.open;
  if (a === 'close') return closeLessons();
  if (a === 'wk') { L.weekOf = ymd(addDays(parseYmd(L.weekOf), +t.dataset.n)); return renderWeek(); }
  if (a === 'today') { L.weekOf = ymd(mondayOf(new Date())); return renderWeek(); }
  if (a === 'back') { editorCommit(); clearTimeout(lSaveT); if (L.open) await lPut(L.open); L.open = null; L.view = L.backTo || 'week'; L.backTo = null; return renderLessons(); }
  if (a === 'newfree') return createLesson([]);
  if (a === 'all') return showAllLessons();
  if (a === 'setup') return openTimetable();
  if (a === 'loadsetup') return loadSetupFile();
  if (a === 'import') return importLesson();
  if (a === 'link') return folderLink();
  if (a === 'reconnect') return folderReconnect(true);
  if (a === 'sync') { await folderRead(true); return; }
  if (!l) return;
  if (a === 'pptx') { editorCommit(); return downloadPptx(l); }
  if (a === 'ask') { editorCommit(); return askClaude(l); }
  if (a === 'more') return moreMenu(t);
  if (a === 'addslot') return addSlotDlg();
  if (a === 'pic') return pickPicture();
  if (a === 'addslide') return addSlideDlg();
  if (a === 'look') return lookDlg();
  if (a === 'vid') return videoDlg();
  if (a === 'split') return splitOverflow();
  if (a === 'dup') { const c = normSlide(JSON.parse(JSON.stringify(l.slides[L.cur]))); c.id = lid(); l.slides.splice(L.cur + 1, 0, c); L.cur++; lessonChanged(false); return renderEditor(); }
  if (a === 'del') {
    if (l.slides.length === 1) return toast('A lesson needs at least one slide');
    const gone = l.slides.splice(L.cur, 1)[0], at = L.cur; L.cur = Math.min(L.cur, l.slides.length - 1);
    lessonChanged(false); renderEditor();
    return undoToast('Slide deleted', () => { l.slides.splice(at, 0, gone); L.cur = at; lessonChanged(false); renderEditor(); });
  }
  if (a === 'up' || a === 'down') {
    const j = L.cur + (a === 'up' ? -1 : 1); if (j < 0 || j >= l.slides.length) return;
    [l.slides[L.cur], l.slides[j]] = [l.slides[j], l.slides[L.cur]]; L.cur = j; lessonChanged(false); return renderEditor();
  }
}
function onLessonsInput(e) {
  if (unitsInput(e) || activitiesInput(e)) return;
  const f = e.target.dataset.f; if (!f || !L.open) return;
  if (f === 'ltitle') { L.open.title = e.target.value; lessonChanged(false); }
  if (f === 'notes') { L.open.slides[L.cur].notes = e.target.value; lessonChanged(false); }
  if (f === 'ask') { L.open.slides[L.cur].ask = e.target.value; lessonChanged(false); }
}
function onLessonsChange(e) {
  if (unitsChange(e)) return;
  const f = e.target.dataset.f, a = e.target.dataset.a;
  if (a === 'jump' && e.target.value) { L.weekOf = ymd(mondayOf(parseYmd(e.target.value))); return renderWeek(); }
  if (!f || !L.open) return;
  const s = L.open.slides[L.cur];
  if (f === 'layout') { s.layout = e.target.value; lessonChanged(); renderEditor(); }
  if (f === 'size') { s.size = +e.target.value; lessonChanged(); renderEditor(); }
}
function undoToast(msg, fn) {
  toast(msg, 6000);
  const t = $('.toast'); if (!t) return;
  const b = document.createElement('button'); b.className = 'link'; b.style.cssText = 'color:inherit;margin-left:12px'; b.textContent = 'Undo';
  b.onclick = () => { t.hidden = true; fn(); }; t.appendChild(b);
}
// Thumbnails drag to reorder.
document.addEventListener('dragstart', e => { const th = e.target.closest && e.target.closest('#lsThumbs .ls-th'); if (!th) return; e.dataTransfer.setData('text/x-slide', th.dataset.go); e.dataTransfer.effectAllowed = 'move'; });
async function onLessonDrop(e) {
  if (await bankDrop(e)) return;
  if (await unitsDrop(e)) return;
  const from = e.dataTransfer.getData('text/x-slide');
  if (from !== '' && L.open) {
    const th = e.target.closest('.ls-th'); if (!th) return;
    const i = +from, j = +th.dataset.go; if (i === j) return;
    const [s] = L.open.slides.splice(i, 1); L.open.slides.splice(j, 0, s); L.cur = j; lessonChanged(false); return renderEditor();
  }
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!f) { if (L.open) return dropFromWeb(e.dataTransfer); return; }
  if (/\.json$/i.test(f.name)) return importLessonText(await f.text(), f.name);
  if (/^image\//.test(f.type) && L.open) { const s = pictureSlide(); return setPicture(f, webSource(e.dataTransfer)); }
}
// A picture or link dragged in from another tab. Chrome usually hands over the picture itself; when it only
// hands over the address, the picture is fetched, which some sites don't allow.
function webSource(dt) {
  const html = dt.getData('text/html') || '', src = (/<img[^>]+src="([^"]+)"/i.exec(html) || [])[1] || dt.getData('text/uri-list') || '';
  return hostOf(src.replace(/&amp;/g, '&'));
}
function pictureSlide() {   // the current slide if it can take a picture, or a new picture slide after it
  const s = L.open.slides[L.cur];
  if (s.layout === 'picture' || s.layout === 'picprompt' || ((s.layout === 'content' || s.layout === 'text') && !s.body.trim() && !s.img)) { s.layout = 'picture'; return s; }
  const n = normSlide({ layout: 'picture' }); L.open.slides.splice(L.cur + 1, 0, n); L.cur++; return n;
}
async function dropFromWeb(dt) {
  const html = dt.getData('text/html') || '', uri = (dt.getData('text/uri-list') || '').split('\n').find(x => x && !x.startsWith('#')) || dt.getData('text/plain') || '';
  const img = ((/<img[^>]+src="([^"]+)"/i.exec(html) || [])[1] || '').replace(/&amp;/g, '&');
  const link = (/<a[^>]+href="([^"]+)"/i.exec(html) || [])[1] || uri;
  if (ytId(link) || ytId(uri)) return addVideoLink(ytId(link) ? link : uri);
  const src = img || (/\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(uri) ? uri : '');
  if (!src) { if (/^https?:\/\//.test(uri)) return addVideoLink(uri.trim(), true); return; }
  if (/^data:image\//.test(src)) { const b = await (await fetch(src)).blob(); pictureSlide(); return setPicture(b, ''); }
  try {
    const r = await fetch(src, { mode: 'cors' }); if (!r.ok) throw 0;
    const b = await r.blob(); if (!/^image\//.test(b.type)) throw 0;
    pictureSlide(); return setPicture(b, hostOf(link && !ytId(link) ? link : src));
  } catch { toast('That site doesn’t let its pictures be copied this way. Right-click the picture, choose Copy image, then paste it here.', 8000); }
}
async function addVideoLink(url, askFirst) {
  if (askFirst && !ytId(url)) {   // a plain web link: only a video slide if that's what this slide is for
    const s = L.open.slides[L.cur]; if (s.layout !== 'video') return toast('Links go on a Video slide: add one with + Video, then drop the link on it');
    return setVideo(url, s);
  }
  const s = L.open.slides[L.cur];
  const target = s.layout === 'video' && !s.video ? s : ((s.layout === 'content' || s.layout === 'text') && !s.body.trim() && !s.title.trim()) ? s : null;
  if (target) return setVideo(url, target);
  const n = normSlide({ layout: 'video' }); L.open.slides.splice(L.cur + 1, 0, n); L.cur++;
  return setVideo(url, n);
}
// Paste on the editor: a picture goes on a slide, a YouTube link makes a video slide.
document.addEventListener('paste', e => {
  if (L.view !== 'edit' || !L.open || lEditing || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || !$('#dlg').hidden) return;
  const cd = e.clipboardData; if (!cd) return;
  const f = [...cd.files].find(x => /^image\//.test(x.type));
  if (f) { e.preventDefault(); pictureSlide(); return setPicture(f, ''); }
  const t = (cd.getData('text/plain') || '').trim();
  if (ytId(t)) { e.preventDefault(); addVideoLink(t); }
});
function splitOverflow() {
  const s = L.open.slides[L.cur], b = $('#lsStage .ls-body'); if (!b) return;
  const items = [...b.querySelectorAll('li,p')], lim = b.getBoundingClientRect().bottom;
  let k = items.findIndex(it => it.getBoundingClientRect().bottom > lim + 1);
  if (k <= 0) k = Math.max(1, Math.ceil(items.length / 2));
  const lines = s.body.split('\n'); let seen = -1, cut = lines.length;
  for (let i = 0; i < lines.length; i++) { if (s.layout === 'agenda' && !lines[i].trim()) continue; seen++; if (seen === k) { cut = i; break; } }
  const rest = lines.slice(cut).join('\n'); s.body = lines.slice(0, cut).join('\n').replace(/\n+$/, '');
  const n = normSlide({ layout: s.layout, title: s.title + (/(continued)/i.test(s.title) ? '' : ' (continued)'), body: rest, size: s.size });
  L.open.slides.splice(L.cur + 1, 0, n); lessonChanged(false); renderEditor();
}

/* ---------- pictures ---------- */
function pickPicture() { const i = $('#lsPicIn'); if (!i) return; i.onchange = () => { const f = i.files[0]; i.value = ''; if (f) setPicture(f); }; i.click(); }
async function setPicture(file, source) {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const x = new Image(); x.onload = () => res(x); x.onerror = rej; x.src = url; });
    const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));   // keep lessons light: 1600 px is plenty for a slide
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
    const png = /png|gif|webp/.test(file.type) && c.width * c.height < 1.2e6;
    const s = L.open.slides[L.cur];
    s.img = { src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86), w: c.width, h: c.height, source: source || (s.img ? s.img.source : '') };
    lessonChanged(); renderEditor();
  } catch { toast('That picture couldn’t be opened'); }
  finally { URL.revokeObjectURL(url); }
}

/* ---------- lessons: create, attach, list ---------- */
async function createLesson(slots) {
  const first = slots[0];
  const l = normLesson({ title: 'New lesson', slots, slides: [
    { layout: 'title', title: 'New lesson' },
    { layout: 'agenda', title: (first ? (parseYmd(first.date).getMonth() + 1) + '/' + parseYmd(first.date).getDate() + ' ' : '') + 'Agenda', body: '' },
    { layout: 'content', title: '', body: '' }
  ] });
  await lPut(l); openLesson(l);
  if (slots.length > 1) toast('Also on ' + slots.slice(1).map(s => className(s.classId) + ' ' + shortDate(s.date)).join(', ') + ' (one deck for both)', 4500);
}
function openLesson(l) { if (!l) return; if (L.view !== 'edit') L.backTo = L.view; L.open = l; L.cur = 0; L.view = 'edit'; renderEditor(); }
function pickLessonFor(classId, date) {
  const ls = [...L.lessons].sort((a, b) => b.updated - a.updated);
  openDlg('<div class="bh"><h2>Use a lesson on ' + esc(className(classId)) + ' · ' + shortDate(date) + '</h2></div><div class="bb"><div class="ls-pick">' +
    ls.map(l => '<button class="ls-card" data-pk="' + l.id + '"><b>' + esc(l.title) + '</b><span>' + (l.slots.length ? esc(l.slots.map(s => className(s.classId) + ' ' + shortDate(s.date)).join(', ')) : 'Not on a class') + '</span></button>').join('') +
    '</div></div><div class="bf"><button class="btn" data-x>Cancel</button></div>', true);
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    const b = e.target.closest('[data-pk]'); if (!b) return;
    const l = L.lessons.find(x => x.id === b.dataset.pk); closeDlg();
    l.slots.push({ classId, date }); await lPut(l); renderLessons();
  };
}
function addSlotDlg() {
  const l = L.open, cls = (L.setup && L.setup.classes) || [];
  if (!cls.length) return toast('Add your classes under Timetable first');
  const today = ymd(new Date());
  openDlg('<div class="bh"><h2>Put this lesson on a class</h2></div><div class="bb"><label class="ls-f">Class <select id="asC" class="btn">' + cls.map(c => '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>').join('') + '</select></label>' +
    '<label class="ls-f">Date <input type="date" id="asD" class="btn" value="' + (l.slots[0] ? l.slots[0].date : today) + '"></label><p class="muted" id="asNote" style="font-size:13px"></p></div>' +
    '<div class="bf"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Add</button></div>', true);
  const note = () => { const c = $('#asC').value, d = $('#asD').value; $('#asNote').textContent = d && !meetingsOn(d).some(m => m.c.id === c) ? 'That class doesn’t meet that day on your timetable. You can still add it.' : ''; };
  $('#asC').onchange = note; $('#asD').onchange = note; note();
  $('#dlgBox').onclick = e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    if (!e.target.closest('[data-ok]')) return;
    const c = $('#asC').value, d = $('#asD').value; if (!d) return;
    if (!l.slots.some(s => s.classId === c && s.date === d)) l.slots.push({ classId: c, date: d });
    l.slots.sort((a, b) => a.date.localeCompare(b.date)); closeDlg(); lessonChanged(); renderEditor();
  };
}
function showAllLessons() {
  const ls = [...L.lessons].sort((a, b) => ((b.slots[0] || {}).date || '').localeCompare((a.slots[0] || {}).date || '') || b.updated - a.updated);
  openDlg('<div class="bh"><h2>All lessons</h2><input type="search" id="alF" class="btn sm" placeholder="Find"></div><div class="bb"><div class="ls-pick" id="alL">' +
    ls.map(l => '<div class="ls-row" data-t="' + esc(l.title.toLowerCase()) + '"><button class="ls-card" data-pk="' + l.id + '"><b>' + esc(l.title) + '</b><span>' + (l.slots.length ? esc(l.slots.map(s => className(s.classId) + ' ' + shortDate(s.date)).join(', ')) : 'Not on a class') + ' · ' + l.slides.length + ' slides</span></button><button class="btn sm ghost" data-del="' + l.id + '">Delete</button></div>').join('') +
    (ls.length ? '' : '<p class="muted">No lessons yet.</p>') + '</div></div><div class="bf"><button class="btn" data-x>Close</button></div>');
  $('#alF').oninput = () => { const q = $('#alF').value.toLowerCase(); for (const r of document.querySelectorAll('#alL .ls-row')) r.hidden = !r.dataset.t.includes(q); };
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    const d = e.target.closest('[data-del]');
    if (d) {
      if (d.dataset.sure !== '1') { d.dataset.sure = '1'; d.textContent = 'Click again to delete'; return; }
      const l = L.lessons.find(x => x.id === d.dataset.del); await lDelete(l); d.closest('.ls-row').remove(); renderLessons(); return;
    }
    const b = e.target.closest('[data-pk]'); if (!b) return;
    closeDlg(); openLesson(L.lessons.find(x => x.id === b.dataset.pk));
  };
}
function moreMenu() {
  const l = L.open;
  openDlg('<div class="bh"><h2>' + esc(l.title) + '</h2></div><div class="bb ls-more">' +
    '<button class="btn" data-m="export">Save lesson file (for Claude)…</button><p class="muted">A .lesson.json file with just this lesson. Give it to Claude, then bring Claude’s version back with Import.</p>' +
    '<button class="btn" data-m="copy">Copy lesson as text</button><p class="muted">The slides and notes as plain text, to paste anywhere.</p>' +
    '<button class="btn" data-m="delete">Delete this lesson</button></div><div class="bf"><button class="btn" data-x>Close</button></div>', true);
  $('#dlgBox').onclick = async e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    const m = e.target.closest('[data-m]'); if (!m) return;
    if (m.dataset.m === 'export') { closeDlg(); return saveBlob(fileBase(l) + '.lesson.json', new Blob([JSON.stringify(lessonForFile(l, null), null, 2)], { type: 'application/json' })); }
    if (m.dataset.m === 'copy') { await copyText(lessonText(l)); closeDlg(); return toast('Copied'); }
    if (m.dataset.m === 'delete') {
      if (m.dataset.sure !== '1') { m.dataset.sure = '1'; m.textContent = 'Click again to delete it for good'; return; }
      await lDelete(l); closeDlg(); L.open = null; L.view = L.backTo || 'week'; renderLessons(); toast('Lesson deleted');
    }
  };
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); } }
function lessonText(l) {
  let t = '# ' + l.title + '\n' + (l.slots.length ? l.slots.map(s => className(s.classId) + ', ' + longDate(s.date)).join('; ') + '\n' : '');
  l.slides.forEach((s, i) => {
    t += '\n## Slide ' + (i + 1) + ' (' + LAYOUTS[s.layout] + (s.layout !== 'title' && s.layout !== 'picture' ? ', ' + s.size + ' pt' : '') + ')\n' + (s.title ? 'Title: ' + s.title + '\n' : '');
    for (const k of EXTRA) if (s[k] && k !== 'body2') t += k + ': ' + s[k] + '\n';
    if (s.body2) t += 'body2:\n' + s.body2 + '\n';
    if (s.body) t += s.body.split('\n').map(x => (s.layout === 'content' ? (x.startsWith('\t') ? '    - ' : '- ') : '') + x.replace(/^\t/, '')).join('\n') + '\n';
    if (s.img) t += '[Picture' + (s.img.source ? ': ' + s.img.source : '') + ']\n';
    if (s.video) t += '[Video: ' + s.video.url + (s.video.title ? ' (' + videoSource(s.video) + ')' : '') + ']\n';
    if (s.notes) t += 'Notes: ' + s.notes + '\n';
    if (s.ask) t += 'What I want on this slide: ' + s.ask + '\n';
    for (const m of s.talk) if (!m.done) t += (m.by === 'claude' ? 'Claude: ' : 'My comment: ') + m.text + '\n';
  });
  return t;
}
// Ask Claude: copies this lesson only (nothing from grading) and opens Claude in a new tab.
async function askClaude(l) {
  const where = L.dir && L.dirOk ? 'It is saved in my Planner folder as "' + fileBase(l) + '.lesson.json". Edit that file directly (keep the same id), and I will pick up your changes in the Planner.\n\n' : '';
  await copyText('Here is a lesson from my Planner. ' + where + 'Slide text stays 28 to 36 pt; keep my simple bullet style.\n\n' + lessonText(l));
  window.open(claudeLink(), '_blank', 'noopener');
  toast('Lesson copied. Paste it into Claude and say what you want.', 5000);
}

/* ---------- import ---------- */
function importLesson() {
  openDlg('<div class="bh"><h2>Import a lesson</h2></div><div class="bb"><p class="muted" style="margin-top:0">Choose a .lesson.json file (from Claude or another computer), or paste one below. A lesson with the same id replaces the one here.</p>' +
    '<button class="btn" id="imF">Choose a file…</button><input type="file" id="imIn" accept=".json,application/json" hidden><textarea id="imT" rows="8" style="width:100%;margin-top:10px" placeholder="Or paste the lesson here"></textarea></div>' +
    '<div class="bf"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Import pasted text</button></div>', true);
  $('#imF').onclick = () => $('#imIn').click();
  $('#imIn').onchange = async () => { const f = $('#imIn').files[0]; if (f) { closeDlg(); importLessonText(await f.text(), f.name); } };
  $('#dlgBox').onclick = e => { if (e.target.closest('[data-x]')) return closeDlg(); if (e.target.closest('[data-ok]')) { const v = $('#imT').value; closeDlg(); importLessonText(v, ''); } };
}
async function importLessonText(text, name) {
  let j; try { j = JSON.parse(String(text).replace(/^\s*```(json)?|```\s*$/g, '')); } catch { return toast('That isn’t a lesson file'); }
  if (j && j.kind === 'grading-studio-lessons-setup') return applySetup(j);
  const arr = Array.isArray(j) ? j : [j], done = [];
  for (const x of arr) {
    if (!x || !Array.isArray(x.slides)) continue;
    const l = normLesson(x); l.slides.forEach(s => { if (s.img && !imgSrc(s.img.src)) delete s.img; });
    const old = L.lessons.find(o => o.id === l.id); if (old) l.created = old.created;
    await lPut(l); done.push(l);
  }
  if (!done.length) return toast('No lesson found in ' + (name || 'that text'));
  toast(done.length === 1 ? 'Imported “' + done[0].title + '”' : 'Imported ' + done.length + ' lessons');
  if (done.length === 1) openLesson(done[0]); else renderLessons();
}

/* ---------- timetable + setup file ---------- */
function loadSetupFile() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
  i.onchange = async () => { const f = i.files[0]; if (!f) return; try { applySetup(JSON.parse(await f.text())); } catch { toast('That isn’t a setup file'); } };
  i.click();
}
async function applySetup(j) {
  if (!j || !Array.isArray(j.classes)) return toast('That isn’t a setup file');
  const setup = { classes: j.classes.map(c => ({ id: String(c.id), name: String(c.name || c.id), course: String(c.course || ''), color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#1F6FB2', meets: (c.meets || []).map(m => ({ dow: +m.dow, start: String(m.start || ''), end: String(m.end || ''), label: String(m.label || '') })) })),
    daysOff: (j.daysOff || []).map(d => ({ date: String(d.date), label: String(d.label || 'No school') })), events: (j.events || []).map(e => ({ date: String(e.date), to: e.to ? String(e.to) : '', label: String(e.label || '') })),
    template: typeof j.template === 'string' ? j.template : (L.setup && L.setup.template) || '',
    semStart: /^\d{4}-\d\d-\d\d$/.test(j.semStart) ? ymd(mondayOf(parseYmd(j.semStart))) : '', semEnd: /^\d{4}-\d\d-\d\d$/.test(j.semEnd) ? ymd(mondayOf(parseYmd(j.semEnd))) : '',
    claudeUrl: /^https:\/\/claude\.ai\//.test(j.claudeUrl) ? String(j.claudeUrl) : '' };
  L.setup = setup; await kvSet('setup', setup); await tplPreview();
  folderWriteSchedule();
  toast('Timetable loaded: ' + setup.classes.length + ' classes' + (setup.template ? ', with your slide template' : ''));
  renderLessons();
}
function openTimetable() {
  const s = L.setup || { classes: [], daysOff: [], events: [], template: '' };
  const draft = JSON.parse(JSON.stringify({ classes: s.classes, daysOff: s.daysOff, events: s.events, semStart: s.semStart || '', semEnd: s.semEnd || '', claudeUrl: s.claudeUrl || '' }));
  const meetRow = (ci, mi, m) => '<div class="ls-mrow"><select data-m="dow" data-ci="' + ci + '" data-mi="' + mi + '" class="btn sm">' + [1, 2, 3, 4, 5, 6].map(d => '<option value="' + d + '"' + (+m.dow === d ? ' selected' : '') + '>' + LDAYS_LONG[d] + '</option>').join('') + '</select><input type="time" data-m="start" data-ci="' + ci + '" data-mi="' + mi + '" value="' + esc(m.start) + '" class="btn sm"> to <input type="time" data-m="end" data-ci="' + ci + '" data-mi="' + mi + '" value="' + esc(m.end) + '" class="btn sm"><input data-m="label" data-ci="' + ci + '" data-mi="' + mi + '" value="' + esc(m.label) + '" placeholder="Periods" class="btn sm" style="width:90px"><button class="btn sm ghost" data-delm="' + ci + '|' + mi + '">×</button></div>';
  const draw = () => {
    $('#ttBody').innerHTML = draft.classes.map((c, ci) => '<div class="ls-tc"><div class="ls-mrow"><input data-c="name" data-ci="' + ci + '" value="' + esc(c.name) + '" placeholder="Class name, like 12 EL-1" class="btn sm" style="width:170px"><input data-c="course" data-ci="' + ci + '" value="' + esc(c.course) + '" placeholder="Course, like 12 EL" class="btn sm" style="width:130px" title="Classes with the same course share one deck"><input type="color" data-c="color" data-ci="' + ci + '" value="' + esc(c.color || '#1F6FB2') + '" aria-label="Color"><span class="sp"></span><button class="btn sm ghost" data-delc="' + ci + '">Remove class</button></div>' +
      c.meets.map((m, mi) => meetRow(ci, mi, m)).join('') + '<button class="btn sm ghost" data-addm="' + ci + '">+ Meeting</button></div>').join('') +
      '<button class="btn sm" data-addc>+ Class</button><h3 style="margin:18px 0 6px;font-size:15px">Semester</h3><div class="ls-mrow"><label>First week <input type="date" id="ttS" class="btn sm" value="' + esc(draft.semStart) + '"></label><label>Last week <input type="date" id="ttE" class="btn sm" value="' + esc(draft.semEnd) + '"></label></div>' +
      '<h3 style="margin:18px 0 6px;font-size:15px">Days off</h3><textarea id="ttOff" rows="4" style="width:100%" placeholder="One per line: 2026-12-25 Christmas">' + esc(draft.daysOff.map(d => d.date + ' ' + d.label).join('\n')) + '</textarea>' +
      '<h3 style="margin:14px 0 6px;font-size:15px">Dates to show (not days off)</h3><textarea id="ttEv" rows="4" style="width:100%" placeholder="One per line: 2026-11-09 to 2026-11-13 Midterms">' + esc(draft.events.map(e => e.date + (e.to ? ' to ' + e.to : '') + ' ' + e.label).join('\n')) + '</textarea>' +
      '<h3 style="margin:14px 0 6px;font-size:15px">Where Send to Claude opens</h3><input id="ttC" class="btn sm" style="width:100%" placeholder="https://claude.ai/new" value="' + esc(draft.claudeUrl) + '"><p class="muted" style="font-size:12.5px;margin:4px 0 0">Paste the link to the Claude project or chat you plan in. Left empty, it opens a new chat.</p>';
  };
  openDlg('<div class="bh"><h2>Timetable</h2><button class="btn sm" data-load>Load setup file…</button></div><div class="bb" id="ttBody"></div><div class="bf"><button class="btn" data-x>Cancel</button><button class="btn primary" data-ok>Save</button></div>');
  draw();
  const box = $('#dlgBox');
  box.oninput = e => { const t = e.target, ci = +t.dataset.ci; if (t.dataset.c) draft.classes[ci][t.dataset.c] = t.value; if (t.dataset.m) draft.classes[ci].meets[+t.dataset.mi][t.dataset.m] = t.dataset.m === 'dow' ? +t.value : t.value; };
  box.onchange = box.oninput;
  box.onclick = async e => {
    if (e.target.closest('[data-x]')) return closeDlg();
    if (e.target.closest('[data-load]')) { closeDlg(); return loadSetupFile(); }
    if (e.target.closest('[data-addc]')) { draft.classes.push({ id: lid(), name: '', course: '', color: '#1F6FB2', meets: [] }); return draw(); }
    const am = e.target.closest('[data-addm]'); if (am) { draft.classes[+am.dataset.addm].meets.push({ dow: 2, start: '08:30', end: '10:05', label: '' }); return draw(); }
    const dm = e.target.closest('[data-delm]'); if (dm) { const [ci, mi] = dm.dataset.delm.split('|').map(Number); draft.classes[ci].meets.splice(mi, 1); return draw(); }
    const dc = e.target.closest('[data-delc]'); if (dc) { draft.classes.splice(+dc.dataset.delc, 1); return draw(); }
    if (!e.target.closest('[data-ok]')) return;
    const lines = id => $(id).value.split('\n').map(x => x.trim()).filter(Boolean);
    draft.daysOff = lines('#ttOff').map(x => { const m = /^(\d{4}-\d\d-\d\d)\s*(.*)$/.exec(x); return m && { date: m[1], label: m[2] || 'No school' }; }).filter(Boolean);
    draft.events = lines('#ttEv').map(x => { const m = /^(\d{4}-\d\d-\d\d)(?:\s+to\s+(\d{4}-\d\d-\d\d))?\s*(.*)$/.exec(x); return m && { date: m[1], to: m[2] || '', label: m[3] }; }).filter(Boolean);
    draft.classes = draft.classes.filter(c => c.name.trim()).map(c => ({ ...c, id: c.id || lid() }));
    draft.semStart = $('#ttS').value; draft.semEnd = $('#ttE').value; draft.claudeUrl = $('#ttC').value.trim();
    closeDlg(); await applySetup({ ...draft, template: s.template });
  };
}

/* ---------- .pptx from Taylor's own template ---------- */
const b64ToU8 = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
const xe = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
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
function tplLayouts(z) {   // which layout file is Title Slide / Title and Content / Title Only in this template
  const out = {}, td = new TextDecoder();
  for (const k of Object.keys(z)) {
    const m = /^ppt\/slideLayouts\/(slideLayout\d+\.xml)$/.exec(k); if (!m) continue;
    const n = (/<p:cSld name="([^"]*)"/.exec(td.decode(z[k])) || [])[1];
    if (n) out[n] = m[1];
  }
  return { title: out['Title Slide'], content: out['Title and Content'], only: out['Title Only'] || out['Title and Content'] };
}
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const spPh = (id, name, ph, body, bodyPr) => '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="' + name + '"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>' + ph + '</p:nvPr></p:nvSpPr><p:spPr/><p:txBody>' + (bodyPr || '<a:bodyPr/>') + '<a:lstStyle/>' + body + '</p:txBody></p:sp>';
// Text in the template's own colors, or in the lesson's look when it has another one.
let pxLook = 'wood';
const run = (t, sz, o) => pxLook !== 'wood' ? lookRun(t, sz, o || {}, pxLook) : '<a:r><a:rPr lang="en-US"' + (sz ? ' sz="' + sz * 100 + '"' : '') + ' dirty="0"/><a:t>' + xe(t) + '</a:t></a:r>';
const buClr = () => pxLook !== 'wood' ? '<a:buClr><a:srgbClr val="' + hex(LOOKS[pxLook].accent) + '"/></a:buClr>' : '';
function slideXml(s, lesson, media) {
  pxLook = lookOf(lesson);
  const xml = slideXmlIn(s, lesson, media), look = pxLook; pxLook = 'wood';
  if (look === 'wood') return xml;
  // Another look: its own background, the template's background pictures hidden, its shapes behind the text.
  return xml.replace('<p:sld ' + NS + '><p:cSld>', '<p:sld ' + NS + ' showMasterSp="0"><p:cSld>' + lookBgXml(look))
    .replace('<p:grpSpPr/>', '<p:grpSpPr/>' + lookShapesXml(look, s.layout === 'title'));
}
function slideXmlIn(s, lesson, media) {
  let tree = '';
  if (s.layout === 'title') {
    tree += spPh(2, 'Title 1', '<p:ph type="ctrTitle"/>', '<a:p>' + run(s.title || lesson.title, 0, { title: 1 }) + '</a:p>');
    const sub = (s.body || titleSubtitle(lesson)).split('\n');
    tree += spPh(3, 'Subtitle 2', '<p:ph type="subTitle" idx="1"/>', sub.map(x => '<a:p>' + (x ? run(x, 0, { sub: 1 }) : '<a:endParaRPr lang="en-US"/>') + '</a:p>').join(''));
  } else {
    tree += spPh(2, 'Title 1', '<p:ph type="title"/>', '<a:p>' + (s.title ? run(s.title, 0, { title: 1 }) : '<a:endParaRPr lang="en-US"/>') + '</a:p>');
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
    } else if (s.layout === 'picture') {
      if (s.img && media) {
        // Fit the picture under the title rule, centered, with the source line under it.
        const X = 1453896, Y = 2015732, W = 9607522, H = 3900000, r = Math.min(W / s.img.w, H / s.img.h);
        const w = Math.round(s.img.w * r), h = Math.round(s.img.h * r), x = X + Math.round((W - w) / 2);
        tree += '<p:pic><p:nvPicPr><p:cNvPr id="4" name="Picture 3"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rIdImg"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="' + x + '" y="' + Y + '"/><a:ext cx="' + w + '" cy="' + h + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
        if (s.img.source) tree += '<p:sp><p:nvSpPr><p:cNvPr id="5" name="Source 4"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + X + '" y="' + (Y + h + 30000) + '"/><a:ext cx="' + W + '" cy="260000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"/>' + run(s.img.source, 10) + '</a:p></p:txBody></p:sp>';
      }
    } else {
      const ag = s.layout === 'agenda' || s.layout === 'objectives', lines = bodyLines(s.body).filter(x => !ag || x.text);
      let ps = '';
      for (const x of lines) {
        const pPr = ag ? '<a:pPr marL="514350" indent="-514350">' + buClr() + '<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/></a:pPr>'
          : s.layout === 'text' ? '<a:pPr marL="0" indent="0"><a:buNone/></a:pPr>' : '<a:pPr' + (x.lvl ? ' lvl="1"' : '') + '>' + buClr() + '</a:pPr>';
        ps += '<a:p>' + pPr + (x.text ? run(x.text, s.size) : '<a:endParaRPr lang="en-US" sz="' + s.size * 100 + '"/>') + '</a:p>';
      }
      tree += spPh(3, 'Content Placeholder 2', '<p:ph idx="1"/>', ps || '<a:p><a:endParaRPr lang="en-US"/></a:p>', '<a:bodyPr><a:noAutofit/></a:bodyPr>');
    }
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld ' + NS + '><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' + tree + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
}
const notesXml = t => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:notes ' + NS + '><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="3" sz="quarter"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>' + t.split('\n').map(x => '<a:p>' + (x ? run(x) : '') + '</a:p>').join('') + '</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
function buildPptx(lesson) {
  const z = fflate.unzipSync(b64ToU8(L.setup.template)), td = new TextDecoder(), te = new TextEncoder();
  const str = k => td.decode(z[k]), put = (k, s) => { z[k] = te.encode(s); };
  { const m = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(str('ppt/presentation.xml')); EX = m ? +m[1] / 1280 : 9525; EY = m ? +m[2] / 720 : 9525; }
  const lay = tplLayouts(z), hasNotes = Object.keys(z).some(k => /^ppt\/notesMasters\/notesMaster\d+\.xml$/.test(k));
  const nm = hasNotes ? Object.keys(z).find(k => /^ppt\/notesMasters\/notesMaster\d+\.xml$/.test(k)).split('/').pop() : '';
  let ct = str('[Content_Types].xml'), prel = str('ppt/_rels/presentation.xml.rels'), pres = str('ppt/presentation.xml'), ids = '';
  const exts = new Set();
  lesson.slides.forEach((s, i) => {
    const n = i + 1, layout = s.layout === 'title' ? lay.title : s.layout === 'picture' || s.layout === 'video' || isTeach(s) ? lay.only : lay.content;
    let rels = '<Relationship Id="rId1" Type="' + REL + 'slideLayout" Target="../slideLayouts/' + layout + '"/>';
    let media = null;
    if ((s.layout === 'picture' || s.layout === 'picprompt') && s.img && imgSrc(s.img.src)) {
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
function fileBase(l) {
  const d = l.slots.length ? [...new Set(l.slots.map(s => s.date))].sort()[0] : '';
  const md = d ? (parseYmd(d).getMonth() + 1) + '-' + String(parseYmd(d).getDate()).padStart(2, '0') + ' ' + LDAYS[parseYmd(d).getDay()] + ' - ' : '';
  return (md + (l.title || 'Lesson')).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 90);
}
function downloadPptx(l) {
  if (!L.setup || !L.setup.template) return toast('Load your setup file first: it has your slide template');
  try { saveBlob(fileBase(l) + '.pptx', new Blob([buildPptx(l)], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })); }
  catch (e) { console.error(e); toast('The .pptx couldn’t be made'); }
}

/* ---------- Planner folder (Chrome): the only place Claude reads ---------- */
const FOLDER_MARK = 'planner-folder.json';
const FOLDER_README = `# Planner folder

The Planner (part of Grading Studio) keeps planning here so Claude can read and edit it. Only planning is in
this folder: lessons, units, the timetable, files the teacher added to a unit, and rubrics and grading scales. Student work and grades
never are, and nothing here should point to a student.

## Files
- \`timetable.json\`: classes (id, name, course, meets: dow 1=Mon..5=Fri, start, end, label), days off,
  dates to show, and the semester's first and last Monday. Read it; the teacher changes it in the app.
- \`*.lesson.json\`: one lesson each. Edit in place and keep the "id". To add a lesson, write a new file
  ending in .lesson.json (leave "id" out). \`images/\` holds slide pictures ("img.src": "images/abc.jpg").
- \`Units/*.unit.json\`: one unit each (see below). Its files (Atlas screenshots, summative task sheets)
  are in the folder next to it with the same name plus " files".
- \`activities.json\`: the teacher's own activities, a list of { "name", "what", "kind" (talk, read, write,
  words, move, check), "parts" (warmup, activity, review), "group", "how": [steps for the teacher],
  "slide": [steps for students] }. Add or edit entries here; the built-in bank isn't in this file.

## Lesson shape
{
  "id": "…", "title": "Lesson name",
  "slots": [{ "classId": "<id from timetable.json>", "date": "2026-11-03" }],
  "slides": [
    { "layout": "title", "title": "Lesson name", "body": "" },
    { "layout": "agenda", "title": "11/3 Agenda", "body": "Warm-up\\nActivity\\nReview", "size": 28 },
    { "layout": "content", "title": "Slide title", "body": "Point one\\n\\tSmaller point under it", "size": 28, "notes": "Speaker notes" },
    { "layout": "text", "title": "The passage", "body": "Plain paragraphs, no bullets", "size": 28 },
    { "layout": "picture", "title": "Title", "img": { "src": "images/x.jpg", "w": 1600, "h": 900, "source": "Source line" } },
    { "layout": "video", "title": "Watch for the appeals", "video": { "url": "https://www.youtube.com/watch?v=…", "start": 30 } },
    { "layout": "warmup", "title": "Warm-up", "tag": "Journal", "body": "The prompt", "size": 36 },
    { "layout": "objectives", "title": "Today we will", "body": "First objective\\nSecond objective" },
    { "layout": "steps", "title": "Gallery walk", "body": "Step one\\nStep two\\nStep three", "foot": "When you’re done: …" },
    { "layout": "discuss", "title": "Let’s talk", "body": "The question", "foot": "Think · Pair · Share" },
    { "layout": "twocol", "title": "…", "h1": "Left heading", "body": "Left points", "h2": "Right heading", "body2": "Right points" },
    { "layout": "passage", "title": "Close read", "body": "“The passage”", "cite": "Author, title, page", "foot": "The question" },
    { "layout": "picprompt", "title": "See · Think · Wonder", "img": { … }, "body": "Question one\\nQuestion two" },
    { "layout": "vocab", "title": "Word of the day", "word": "ethos", "pos": "noun", "body": "Meaning", "foot": "Example sentence" },
    { "layout": "exit", "title": "Exit ticket", "tag": "On a sticky note", "body": "The question" }
  ],
  "look": "wood"
}
"look" is the lesson's colors: wood (the teacher's template), white, cream, sage, sky, blush, charcoal, navy,
stripe, band, bigtype, framed, notebook, chalk. Leave it out to use the teacher's default; change it only when asked.
"ask", "talk", "status" and "claudeNote" are for working together, and are all optional:
- A slide's "ask" is what the teacher wants on that slide. Use it, and leave it as it is.
- A slide's "talk" is comments: { "by": "you" | "claude", "text": "…" }. Reply by adding one with "by": "claude".
  Don't edit or remove the teacher's comments.
- "status": "claude" means the teacher sent it to you; set it to "review" when you're done. Never set "approved";
  only the teacher approves. "claudeNote" is your short summary of what you did.
The teacher sees your changes slide by slide and keeps theirs or yours for each, so change what the lesson needs and leave the rest.
For a video, give just "url" (and "start" in seconds, if it should start partway); the app adds the title, channel and picture.
Rules: "size" is 28 to 36 (pt). Body lines are separated by \\n; a line starting with a tab is a sub-point.
An empty title-slide body means the app fills in the course and dates. Bump "updated" (milliseconds) when you change a lesson.

## Unit shape
{
  "id": "…", "course": "<course from timetable.json, like English 10>", "title": "Unit 2: Argument",
  "start": "2026-10-05",            // the Monday of the unit's first week
  "atlas": "https://…",             // the unit's Atlas page, if the teacher added it
  "weeks": [ { "focus": "What this week is about (from Atlas)", "notes": "Teacher's own notes", "standards": "RL.1, RL.2" } ],
  "files": [ { "name": "Atlas week 1-3.png", "kind": "atlas" }, { "name": "Summative task sheet.docx", "kind": "summative" } ]
}
To fill a unit's weeks from its Atlas screenshots: read the "atlas" files in its files folder and write each
week's focus (and standards, if shown) into "weeks", in order, one entry per week. Keep the teacher's "notes".
Don't add, rename or remove files in the files folder; the teacher adds those in the app.
` + BANK_README;
async function folderLink() {
  try {
    const h = await window.showDirectoryPicker({ id: 'gs-lessons', mode: 'readwrite', startIn: 'documents' });
    const why = await notGradingFolder(h);
    if (why) return toast(why, 8000);
    L.dir = h; L.dirOk = true; await kvSet('dir', h);
    await folderWriteAll(); await folderRead(false);
    toast('Planner folder linked: ' + h.name); renderLessons();
  } catch (e) { if (e && e.name !== 'AbortError') toast('That folder couldn’t be used'); }
}
async function folderReconnect(ask) {
  if (!('showDirectoryPicker' in window)) return;
  if (!L.dir) L.dir = (await kvGet('dir')) || null;
  if (!L.dir) return;
  try {
    let p = await L.dir.queryPermission({ mode: 'readwrite' });
    if (p !== 'granted' && ask) p = await L.dir.requestPermission({ mode: 'readwrite' });
    L.dirOk = p === 'granted';
  } catch { L.dirOk = false; }
  if (L.dirOk) { await folderRead(false); if (ask) await folderWriteAll(); }
  if (L.view === 'week') renderWeek(); else { const c = document.querySelector('#lessons [data-a="reconnect"],#lessons [data-a="sync"],#lessons [data-a="link"]'); if (c) c.outerHTML = folderChip(); }
}
async function writeFile(dir, name, data) { const fh = await dir.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(data); await w.close(); return (await fh.getFile()).lastModified; }
function lessonForFile(l, imgs) {   // imgs: Map to collect pictures as separate files; null = keep them inline
  const c = JSON.parse(JSON.stringify(l));
  for (const s of c.slides) if (s.img && imgs) {
    const m = /^data:image\/(png|jpeg);base64,/.exec(s.img.src); if (!m) continue;
    const name = 'images/' + s.id + '-' + hash(s.img.src).slice(0, 8) + (m[1] === 'png' ? '.png' : '.jpg');
    imgs.set(name, s.img.src); s.img.src = name;
  }
  delete c._file; delete c._mod; delete c.pending;
  return c;
}
const wTimers = new Map();
function folderWriteSoon(l) { if (!L.dir || !L.dirOk) return; clearTimeout(wTimers.get(l.id)); wTimers.set(l.id, setTimeout(() => folderWrite(l).catch(e => console.warn(e)), 800)); }
async function folderWrite(l) {
  if (!L.dir || !L.dirOk) return;
  const imgs = new Map(), data = lessonForFile(l, imgs), name = fileBase(l) + '.lesson.json';
  if (imgs.size) { const idir = await L.dir.getDirectoryHandle('images', { create: true }); for (const [p, src] of imgs) { try { await idir.getFileHandle(p.slice(7)); } catch { await writeFile(idir, p.slice(7), b64ToU8(src.split(',')[1])); } } }
  if (l._file && l._file !== name) { try { await L.dir.removeEntry(l._file); } catch { } }
  l._mod = await writeFile(L.dir, name, JSON.stringify(data, null, 2)); l._file = name;
  await lTx('lessons', 'readwrite', s => { s.put(l); });
}
async function folderRemove(l) { if (L.dir && L.dirOk && l._file) { try { await L.dir.removeEntry(l._file); } catch { } } }
async function folderWriteSchedule() {
  if (!L.dir || !L.dirOk || !L.setup) return;
  const { template, ...tt } = L.setup;
  await writeFile(L.dir, 'timetable.json', JSON.stringify(tt, null, 2));
}
async function folderWriteAll() {
  if (!L.dir || !L.dirOk) return;
  await writeFile(L.dir, 'README - for Claude.md', FOLDER_README);
  await writeFile(L.dir, FOLDER_MARK, JSON.stringify({ kind: 'grading-studio-planner-folder', note: 'Planning only: lessons, units, the timetable, files added to units, rubrics and grading scales. Never student work or grades.' }, null, 2));
  await folderWriteSchedule();
  for (const l of L.lessons) await folderWrite(l);
  for (const u of L.units) await unitFolderWrite(u);
  await actFolderWrite();
  await bankWriteAll();
}
// Picks up lessons Claude added or changed in the folder. A file changed since the app last wrote it wins.
async function folderRead(say) {
  if (!L.dir || !L.dirOk) return;
  let added = 0, changed = 0;
  try {
    for await (const [name, h] of L.dir.entries()) {
      if (h.kind !== 'file' || !/\.lesson\.json$/i.test(name)) continue;
      const f = await h.getFile();
      const mine = L.lessons.find(l => l._file === name);
      if (mine && mine._mod && f.lastModified <= mine._mod + 1500) continue;
      let j; try { j = JSON.parse(await f.text()); } catch { continue; }
      const l = normLesson(j), old = L.lessons.find(x => x.id === l.id);
      if (old && old._file && old._file !== name) { continue; }   // a stale copy under an old name
      for (const s of l.slides) if (s.img && /^images\//.test(s.img.src)) {
        try { const idir = await L.dir.getDirectoryHandle('images'); const b = await (await idir.getFileHandle(s.img.src.slice(7))).getFile(); s.img.src = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); if (!s.img.w) { const im = new Image(); im.src = s.img.src; await im.decode(); s.img.w = im.naturalWidth; s.img.h = im.naturalHeight; } }
        catch { delete s.img; }
      }
      l.slides.forEach(s => { if (s.img && !imgSrc(s.img.src)) delete s.img; });
      for (const s of l.slides) if (s.video && ytId(s.video.url) && !s.video.thumb) { const v = await videoFrom(s.video.url); s.video = { ...v, start: s.video.start || v.start, title: s.video.title || v.title }; }   // Claude gives just the link
      l._file = name; l._mod = f.lastModified; l.updated = Date.now(); if (old) l.created = old.created;
      await claudeChanged(old, l);
      await lTx('lessons', 'readwrite', s => { s.put(l); });
      const i = L.lessons.findIndex(x => x.id === l.id); if (i >= 0) L.lessons[i] = l; else L.lessons.push(l);
      if (L.open && L.open.id === l.id) L.open = l;
      old ? changed++ : added++;
      if (!j.id) await folderWrite(l);   // give a new file its id
    }
  } catch (e) { console.warn(e); if (say) toast('Couldn’t read the Planner folder'); return; }
  try { const u = await unitsFolderRead(); added += u.added; changed += u.changed; } catch (e) { console.warn(e); }
  try { changed += await actFolderRead(); } catch (e) { console.warn(e); }
  try { const r = await bankFolderRead(); added += r.added; changed += r.changed; } catch (e) { console.warn(e); }
  if (added || changed) { toast((added ? added + ' new' : '') + (added && changed ? ', ' : '') + (changed ? changed + ' updated' : '') + ' from the Planner folder'); renderLessons(); }
  else if (say) toast('No changes in the Planner folder');
}
window.addEventListener('focus', () => { if (L.dirOk && !lEditing) folderRead(false); });

