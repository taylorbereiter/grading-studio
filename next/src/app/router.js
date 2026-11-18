// The new app's addresses. Every destination is a hash route (#/home, #/class/<id>/grades…), so the browser's back and forward
// buttons work and any screen can be bookmarked. Each screen is its own chunk, loaded the first time it is opened (import()).
// A screen thread adds a line to ROUTES and a file under screens/, and nothing else.
//
// A route remembers where the teacher was: how far down the page, and which control had focus. Coming back to it (back button,
// a link, the sidebar) puts both back. A new screen puts focus on its heading, so a screen reader says where she is.
// No saved work is read or written here.

// [pattern, chunk, nav]: pattern pieces starting with ":" are named parts; nav is the sidebar item the route lights up.
export const ROUTES = [
  ['home', 'home', 'home'],
  ['calendar', 'calendar', 'calendar'],
  ['calendar/:view', 'calendar', 'calendar'],
  ['week', 'calendar', 'calendar'],
  ['todo', 'later', 'todo'],
  ['class/:id', 'class', 'class'],
  ['class/:id/:tab', 'class', 'class'],
  ['class/:id/:tab/:sub', 'later', 'class'],
  ['lesson/:id', 'lesson', 'class'],
  ['lesson/:id/:view', 'lesson', 'class'],
  ['mark/:id', 'mark', 'class'],
  ['mark/:id/:tab', 'mark', 'class'],
  ['library', 'library', 'library'],
  ['library/:tab', 'library', 'library'],
  ['school', 'later', 'school'],
  ['settings', 'settings', 'settings'],
  ['settings/:group', 'settings', 'settings'],
  ['help', 'later', 'help'],
  ['help/keys', 'keys', 'help'],
  ['more', 'more', 'more'],
  ['classes', 'more', 'classes'],
];
// The chunks. Written out one by one so the bundler makes one file for each.
// Parts of the lesson screen loaded only when asked for: the editor (the Edit view), Present, and the lesson's tools (sheets from
// the lesson menu, the Beside drawer). Each is a screen of its own for the size budget (next/budgets.json route).
export const PARTS = {
  edit: () => import('./screens/lesson-edit.jsx'),
  present: () => import('./screens/present.jsx'),
  tools: () => import('./screens/lesson-tools.jsx'),
  beside: () => import('./screens/lesson-beside.jsx'),
  doc: () => import('./screens/lesson-doc.jsx'),
  pdf: () => import('./plan/pdf.js'),
  cal: () => import('./plan/cal-tools.jsx'),
  unit: () => import('./plan/unit-tools.jsx'),
  marking: () => import('./screens/mark-tools.jsx'),
  // Grades, Insights and Return (the screen part), and what they run: the export engine with pdf-lib and fflate, loaded on their
  // own like pdf.js (each library is its own chunk, under the any-chunk budget)
  out: () => import('./screens/mark-out.jsx'),
  outEngine: () => import('./mark/out.js'),
  pdflib: () => import('pdf-lib'),
  zip: () => import('fflate'),
  h2c: () => import('html2canvas'),
  // the save layer for marking (students/write.js), loaded with the first save
  write: () => import('../students/write.js'),
  // a class's assignments, and bringing papers in for one (the opening engine loads only when papers come in)
  work: () => import('./screens/class-work.jsx'),
  bring: () => import('./mark/open.js'),
  word: () => import('./mark/word.js'),
  report: () => import('./mark/report.jsx'),
  files: () => import('./mark/files.jsx'),
  fileui: () => import('./mark/fileui.jsx'),
  // splitting a scan onto names (mark/split.jsx), from the class page or into an open download
  split: () => import('./mark/split.jsx'),
  // video and audio papers, their transcripts, and notes pages (mark/media.jsx)
  media: () => import('./mark/media.jsx'),
  // typed notes and the Timer under the comment (mark/typed.jsx)
  typed: () => import('./mark/typed.jsx'),
  setup: () => import('./mark/setup.jsx'),
  setgrade: () => import('./screens/settings-grading.jsx'),
  bank: () => import('./plan/bank-edit.jsx'),
  // her saved comments (students/comments.js), for the chips under the comment box
  cbank: () => import('../students/comments.js'),
};
export const CHUNKS = {
  home: () => import('./screens/home.jsx'),
  settings: () => import('./screens/settings.jsx'),
  keys: () => import('./screens/keys.jsx'),
  more: () => import('./screens/more.jsx'),
  later: () => import('./screens/later.jsx'),
  calendar: () => import('./screens/calendar.jsx'),
  class: () => import('./screens/class.jsx'),
  lesson: () => import('./screens/lesson.jsx'),
  library: () => import('./screens/library.jsx'),
  mark: () => import('./screens/mark.jsx'),
};

export function parse(hash) {
  const path = String(hash || '').replace(/^#\/?/, '').replace(/\/+$/, '').split('?')[0];
  const parts = path ? path.split('/').map(p => { try { return decodeURIComponent(p); } catch { return p; } }) : [];
  if (!parts.length) return { path: 'home', chunk: 'home', nav: 'home', params: {}, known: true };
  for (const [pat, chunk, nav] of ROUTES) {
    const ps = pat.split('/'); if (ps.length !== parts.length) continue;
    const params = {}; let ok = true;
    ps.forEach((p, i) => { if (p[0] === ':') params[p.slice(1)] = parts[i]; else if (p !== parts[i]) ok = false; });
    if (ok) return { path: parts.join('/'), pattern: pat, chunk, nav, params, known: true };
  }
  return { path: parts.join('/'), chunk: 'later', nav: '', params: {}, known: false };
}
export const href = (...parts) => '#/' + parts.filter(p => p != null && p !== '').map(p => encodeURIComponent(String(p))).join('/');
export const go = (...parts) => { const h = href(...parts); if (location.hash !== h) location.hash = h; };
export const current = () => parse(location.hash);

const told = new Set();
export function onRoute(f) { told.add(f); return () => told.delete(f); }

/* where she was on each route */
const kept = new Map();   // path -> { top, focus }
let main = null, was = null;
export function setMain(el) { main = el; }
const focusKey = el => el && el !== document.body && (el.id || el.dataset.focus || (el.getAttribute && el.getAttribute('href')) || '');
function remember() {
  if (!was || !main) return;
  const a = document.activeElement, inMain = a && main.contains(a) || a && a.closest && a.closest('[data-shell-nav]');
  kept.set(was, { top: main.scrollTop, focus: inMain ? focusKey(a) : '' });
}
// Called by the shell once the new screen is drawn.
export function restore(path, fresh) {
  const k = kept.get(path);
  if (!main) return;
  main.scrollTop = k ? k.top : 0;
  const find = key => key && (document.getElementById(key) || main.querySelector('[data-focus="' + CSS.escape(key) + '"]') || document.querySelector('[data-shell-nav] [href="' + CSS.escape(key) + '"]'));
  const el = k && find(k.focus);
  if (el) el.focus({ preventScroll: true });
  else if (fresh) { const h = main.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
}
let started = false;
export function start() {
  if (started) return; started = true;
  was = current().path;
  window.addEventListener('hashchange', () => { remember(); const r = current(); was = r.path; told.forEach(f => f(r)); });
}
