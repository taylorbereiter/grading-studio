// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
// The library the year's name is guessed from, handed in by whole/newyear.js (yearUse).
let lib = { classes: [], loose: { id: '', units: [] } };
export const yearUse = l => { lib = l || lib; };


// src/takehome.js
const TAKE_MAGIC = 'GSWORK1\n', TAKE_ITER = 1000000, TAKE_CHUNK = 4 * 1024 * 1024, TAKE_EXT = '.gswork';
// src/newyear.js
const NY_EXT = TAKE_EXT;
// src/newyear.js
const nyClone = o => JSON.parse(JSON.stringify(o));
// src/newyear.js
function nyPad(n) { return String(n).padStart(2, '0'); }
// src/newyear.js
function nyLabel(y) { return y + '–' + nyPad((y + 1) % 100); }   // function declarations: Settings draws the year before this file has run
// src/newyear.js
function nyGuess() {
  if (lib.year && typeof lib.year === 'string') return lib.year;
  const starts = ((lib.book && lib.book.terms) || []).map(t => t.start).filter(s => /^\d{4}-\d\d-\d\d$/.test(s || '')).sort();
  const d = starts.length ? new Date(starts[0] + 'T12:00:00') : new Date();
  return nyLabel(d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1);
}
// src/newyear.js
function nyNext(name) {
  const m = /^(\d{4})\s*[–-]\s*(\d{2}|\d{4})$/.exec(String(name).trim());
  if (m) return nyLabel(+m[1] + 1);
  const y = /^(\d{4})$/.exec(String(name).trim()); return y ? String(+y[1] + 1) : '';
}
// src/newyear.js
function nyDay(s) {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s || ''); if (!m) return s;
  const y = +m[1] + 1, d = m[2] === '02' && m[3] === '29' ? '28' : m[3];
  return y + '-' + m[2] + '-' + d;
}
// src/newyear.js
const nySafeName = s => String(s || '').replace(/[\\/:*?"<>|]+/g, '-').trim();
// src/newyear.js
const nyFileName = year => 'Grading Studio ' + (nySafeName(year) || 'year') + NY_EXT;
// src/newyear.js
function nyNames(l) {
  const s = new Set();
  for (const c of (l && l.classes) || []) {
    for (const n of c.names || []) if (n) s.add(n);
    for (const [n, i] of Object.entries(c.info || {})) { s.add(n); for (const o of (i && i.other) || []) if (o) s.add(o); }
  }
  return s;
}
// src/newyear.js
function nyAbout(v, names, depth = 0) {
  if (v == null || depth > 20 || !names.size) return false;
  if (typeof v === 'string') return names.has(v.trim());
  if (typeof v !== 'object') return false;
  if (Array.isArray(v)) return v.some(x => nyAbout(x, names, depth + 1));
  for (const [k, x] of Object.entries(v)) if (names.has(k) || nyAbout(x, names, depth + 1)) return true;
  return false;
}
// src/newyear.js
const nyStrip = (o, names, keep) => { for (const k of Object.keys(o)) if (!keep.includes(k) && nyAbout(o[k], names)) delete o[k]; return o; };
// src/newyear.js
const NY_YEAR_ONLY = ['att', 'lv', 'pred'];
// src/newyear.js
function nyLib(old, works, o) {
  const L = nyClone(old), names = nyNames(old);
  L.classes ||= []; L.loose ||= { id: '', units: [] };
  const card = it => {
    const w = it.batchId ? works[it.batchId] : null, n = { ...it };
    delete n.batchId; delete n.opened;
    if (n.typed && typeof n.typed === 'object') n.typed = { max: n.typed.max == null ? null : n.typed.max, ...(n.typed.lv ? { lv: true } : {}), s: {} };
    if (!n.setup && w && w.setup) { n.setup = { ...w.setup }; delete n.setup.spot; delete n.setup.rubricPage; }
    if (!n.quiz && w && w.quiz && Array.isArray(w.quiz.qs) && w.quiz.qs.length) { const q = nyClone(w.quiz); delete q.shift; delete q.spot; delete q.look; delete q.lastRead; if (q.made) delete q.made.names; n.quiz = q; }   // a quiz made here prints with the new roster
    if (!n.goal && w && typeof w.goal === 'string' && w.goal) n.goal = w.goal;   // a learning goal for the whole score (goals.js)
    if (o.dates && n.due) n.due = nyDay(n.due);
    return nyStrip(n, names, ['id', 'name', 'setup', 'quiz', 'typed', 'classId', 'goal', 'crit']);
  };
  for (const c of L.classes) {
    if (!o.roster) { c.names = []; delete c.info; }
    for (const k of NY_YEAR_ONLY) delete c[k];
    // The seating chart's room carries, with every desk empty, unless the class keeps its students (seating.js).
    if (!o.roster && c.seats && c.seats.desks && typeof c.seats.desks === 'object') c.seats = { ...c.seats, desks: Object.fromEntries(Object.keys(c.seats.desks).map(k => [k, ''])), pins: [] };
    nyStrip(c, names, ['id', 'name', 'units', 'way', 'ib', ...(o.roster ? ['names', 'info', 'seats'] : [])]);
  }
  for (const h of L.classes.concat([L.loose])) for (const u of h.units || []) { nyStrip(u, names, ['id', 'name', 'items']); u.items = (u.items || []).map(card); }
  if (L.book && typeof L.book === 'object') {
    delete L.book.dl;   // type and date of downloads with no card: those downloads are in the file now
    if (o.dates) L.book.terms = (L.book.terms || []).map(t => ({ ...t, start: nyDay(t.start), end: nyDay(t.end) }));
    nyStrip(L.book, names, ['terms', 'cats', 'w']);   // her terms, her own types and their weights carry, whatever they are called
  }
  // The to-do list (todo.js): what is still to do carries. A line about a student (or that says a student's name) does not, unless the
  // class lists are kept; what was done, and what was said about the app's own lines for this year's work, stays behind in the file.
  if (L.todo && typeof L.todo === 'object') {
    const low = [...names].map(n => n.toLowerCase()), says = i => { const t = (String(i.x || '') + ' ' + String(i.note || '')).toLowerCase(); return low.some(n => t.includes(n)); };
    L.todo = { items: (Array.isArray(L.todo.items) ? L.todo.items : []).filter(i => i && !i.gone && !i.done && (o.roster || !(i.who || says(i)))), off: { ...(L.todo.off || {}) }, offT: L.todo.offT || 0, auto: {},
      // her categories carry, unless one names a student
      ...(Array.isArray(L.todo.cats) ? { cats: L.todo.cats.filter(c => c && c.id && (o.roster || !says({ x: c.name, note: c.w }))) } : {}), ...(L.todo.corder ? { corder: L.todo.corder } : {}) };
  }
  nyStrip(L, names, ['classes', 'loose', 'me', 'book', 'gone', 'years', 'todo']);
  L.year = o.to;
  L.years = [...(Array.isArray(old.years) ? old.years : []), { name: o.from, at: Date.now(), file: o.file }];
  return L;
}
export { nyLib, nyNames, nyAbout, nyStrip, nyDay, nyLabel, nyNext, nyGuess, nyFileName, NY_YEAR_ONLY };
