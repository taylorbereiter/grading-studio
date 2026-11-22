// The new app's addresses. Every destination is a hash route (#/home, #/class/<id>/grades…), so the browser's back and forward
// buttons work and any screen can be bookmarked. Each screen is its own chunk, loaded the first time it is opened (import()).
// A screen thread adds a line to ROUTES and a file under screens/, and nothing else.
//
// A route remembers where the teacher was: how far down the page, and which control had focus. Coming back to it (back button,
// a link, the sidebar) puts both back. A new screen puts focus on its heading, so a screen reader says where she is.
// No saved work is read or written here.

import { addLines } from '../i18n/t.js';

// [pattern, chunk, nav]: pattern pieces starting with ":" are named parts; nav is the sidebar item the route lights up.
export const ROUTES = [
  ['home', 'home', 'home'],
  ['calendar', 'calendar', 'calendar'],
  ['calendar/:view', 'calendar', 'calendar'],
  ['week', 'calendar', 'calendar'],
  ['todo', 'todo', 'todo'],
  ['todo/:view', 'todo', 'todo'],
  ['time', 'time', 'todo'],   // the time tracker, from To do > Time this week
  ['class/:id', 'class', 'class'],
  ['class/:id/:tab', 'class', 'class'],
  ['class/:id/:tab/:sub', 'class', 'class'],
  ['class/:id/:tab/:sub/:more', 'class', 'class'],   // people/attendance/<day> or /all
  ['class-named/:name', 'class', 'class'],   // the Planner's sidebar link to a class by its name
  ['lesson/:id', 'lesson', 'class'],
  ['lesson/:id/:view', 'lesson', 'class'],
  ['lesson/:id/:view/:cls', 'lesson', 'class'],   // lesson/<id>/present/<class>: presents at once (planner.html#present/<id>/<class>)
  ['lesson/:id/present/:cls/:day', 'lesson', 'class'],   // Present from a specific calendar meeting.
  ['plan/:cls/:day', 'calendar', 'calendar'],   // that meeting's lesson, opened or made, with a focus session (planner.html#plan/<class>/<day>)
  ['mark/:id', 'mark', 'class'],
  ['mark/:id/:tab', 'mark', 'class'],
  ['mark/:id/:tab/:sub', 'mark', 'class'],   // grades/sheet, insights/consistency
  ['library', 'library', 'library'],
  ['library/:tab', 'library', 'library'],
  ['library/:tab/:sub', 'library', 'library'],   // Library > Examples > Watch list
  ['library/:tab/:sub/:more', 'library', 'library'],   // Library > Examples > a/<download>: one assignment's examples
  ['school', 'school', 'school'],
  ['settings', 'settings', 'settings'],
  ['settings/:group', 'settings', 'settings'],
  ['help', 'help', 'help'],
  ['help/keys', 'keys', 'help'],
  ['help/:topic', 'help', 'help'],
  ['more', 'more', 'more'],
  ['classes', 'more', 'classes'],
];
// The chunks. Written out one by one so the bundler makes one file for each.
// Parts of the lesson screen loaded only when asked for: the editor (the Edit view), Present, and the lesson's tools (sheets from
// the lesson menu, the Beside drawer). Each is a screen of its own for the size budget (next/budgets.json route).
// The address shown before this one (the lesson page's back link goes there, as the current Planner's ‹ Week / Units / Unit did).
export let from = '';
export const PARTS = {
  edit: () => import('./screens/lesson-edit.jsx'),
  edit2: () => import('./screens/lesson-edit2.jsx'),
  side2: () => import('./screens/lesson-side.jsx'),
  present: () => import('./screens/present.jsx'),
  // the class timer in the corner after Present (plan/ptimer-float.jsx)
  ptimer: () => import('./plan/ptimer-float.jsx'),
  tools: () => import('./screens/lesson-tools.jsx'),
  beside: () => import('./screens/lesson-beside.jsx'),
  beside2: () => import('./screens/lesson-beside2.jsx'),
  besideBooks: () => import('./screens/lesson-books.jsx'),
  box: () => import('./screens/lesson-box.jsx'),
  nb: () => import('./screens/lesson-nb.jsx'),
  docxin: () => import('./plan/docx-in.js'),
  doc: () => import('./screens/lesson-doc.jsx'),
  pdf: () => import('./plan/pdf.js'),
  cal: () => import('./plan/cal-tools.jsx'),
  // a lesson card's menu, the class page link and a unit from the week (plan/card-menu.jsx)
  calx: () => import('./plan/card-menu.jsx'),
  // the Planner's commands in the command bar (plan/find.js)
  planFind: () => import('./plan/find.js'),
  // the Semester view, and the classes coming up without a lesson (plan/semester.jsx)
  sem: () => import('./plan/semester.jsx'),
  // lesson packs, and lesson files dropped anywhere (plan/packs.js)
  packs: () => import('./plan/packs.js'),
  // the Planner's setup file, and the move to a new school year (plan/setupfile.js)
  setupFile: () => import('./plan/setupfile.js'),
  // searching inside lessons, slides, notes, documents and units (plan/search.jsx), Library > Search
  search: () => import('./plan/search.jsx'),
  unit: () => import('./plan/unit-tools.jsx'),
  marking: () => import('./screens/mark-tools.jsx'),
  // Grades, Insights and Return (the screen part), and what they run: the export engine with pdf-lib and fflate, loaded on their
  // own like pdf.js (each library is its own chunk, under the any-chunk budget)
  out: () => import('./screens/mark-out.jsx'),
  outEngine: () => import('./mark/out.js'),
  retcards: () => import('./mark/retcards.jsx'),
  // the Grade sheet on the Grades tab
  sheet: () => import('./mark/sheet.jsx'),
  cons: () => import('./mark/cons.jsx'),
  covers: () => import('./mark/covers.jsx'),
  bringin: () => import('./mark/bringin.jsx'),
  partners: () => import('./mark/partners.jsx'),
  // Quick mark: the cards (mark/quick.jsx) and the boxes (mark/quickboxes.jsx), each with the quiz engine
  quick: () => import('./mark/quick.jsx'),
  quickboxes: () => import('./mark/quickboxes.jsx'),
  // a quiz made here: the maker (from the class page) and reading its scan (on the marking screen)
  quizmaker: () => import('./mark/quizmaker.jsx'),
  quizread: () => import('./mark/quizread.jsx'),
  pdflib: () => import('pdf-lib'),
  zip: () => import('fflate'),
  h2c: () => import('html2canvas'),
  // mammoth: a Word paper the app's own reader can't open still becomes pages (mark/out.js wordTools; H-029)
  mammoth: () => import('mammoth/mammoth.browser.min.js'),
  // the screenshot on the marking screen (S, Alt S)
  snip: () => import('./mark/snip.jsx'),
  // the save layer for marking (students/write.js), loaded with the first save
  write: () => import('../students/write.js'),
  // a class's assignments, and bringing papers in for one (the opening engine loads only when papers come in)
  work: () => import('./screens/class-work.jsx'),
  // an assignment made, changed or deleted there, and its less common tools (no papers, forget, a unit's link)
  asg: () => import('./class/assignment.jsx'),
  // a rubric brought in for an assignment from its card (New and Edit assignment, the Bring in menu)
  rubricin: () => import('./class/rubricin.jsx'),
  // Home's To do card, with the To do engine (app/home/todo-card.jsx)
  hometodo: () => import('./home/todo-card.jsx'),
  oldsample: () => import('./home/old-sample.jsx'),
  homeg: () => import('./home/google.jsx'),
  homedrop: () => import('./home/drop.jsx'),
  // a class's People and Grades tabs (app/class/), each with the gradebook's engine
  people: () => import('./class/people.jsx'),
  clink: () => import('./class/classlink.jsx'),
  setclasses: () => import('./class/setlist.jsx'),
  setterms: () => import('./class/setterms.jsx'),
  grades: () => import('./class/grades.jsx'),
  // a gradebook imported from a spreadsheet, with its reading engine (gbki)
  bki: () => import('./class/bookimport.jsx'),
  // a class brought over from Google Classroom's grades file
  gc: () => import('./class/classroom.jsx'),
  // Pick a name, make groups, from the class header
  picker: () => import('./class/picker.jsx'),
  // a class's To do tab: its to-dos and missing work
  ctodo: () => import('./class/todo.jsx'),
  goals: () => import('./class/goals.jsx'),
  reports: () => import('./class/reports.jsx'),
  sheets: () => import('./class/sheets.jsx'),
  mypCharts: () => import('./class/charts-myp.jsx'),
  examples: () => import('./class/examples.jsx'),
  exsave: () => import('./class/exsave.jsx'),
  linked: () => import('./class/linked.jsx'),
  watch: () => import('./class/watch.jsx'),
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
  // the rest of Settings: the assistant, programme, averages, goals, handing back, text size (screens/settings-more.jsx)
  setmore: () => import('./screens/settings-more.jsx'),
  setsave: () => import('./screens/settings-saving.jsx'),
  // the red bar when work didn't save (saving/bar.jsx)
  savebar: () => import('./saving/bar.jsx'),
  drive: () => import('./drive-button.jsx'),
  // My setup, with the current app's reading and bringing in (app/setup/mysetup.jsx, engines/gstp.js)
  mysetup: () => import('./setup/mysetup.jsx'),
  // Settings > Focus and goals, with the timer's engine (app/focus/settings.jsx)
  setfocus: () => import('./focus/settings.jsx'),
  // the focus timer's runner and panel (app/focus/bus.js loads it)
  focus: () => import('./focus/run.js'),
  bank: () => import('./plan/bank-edit.jsx'),
  // clips to show the class (mark/clips.jsx)
  clips: () => import('./mark/clips.jsx'),
  // the Planner folder: its card in Settings, reading it, and the mark on a lesson that arrived there (plan/pfolder.jsx)
  pfolder: () => import('./plan/pfolder.jsx'),
  // her saved comments (students/comments.js), for the chips under the comment box
  cbank: () => import('../students/comments.js'),
  // the calculator (mark/calc.jsx)
  calc: () => import('./mark/calc.jsx'),
  // the welcome a browser nobody has used yet opens on (screens/welcome.jsx); main.js asks for it here
  welcome: () => import('./screens/welcome.jsx'),
  lang: () => import('./language.js'),
  // Share with your assistant and Bring back (mark/share.jsx), from Insights and the marking screen's Setup menu
  share: () => import('./mark/share.jsx'),
  // the assignments for the command bar (students/find-rows.js), read each time it opens
  asgRows: () => import('../students/find-rows.js'),
};
export const CHUNKS = {
  home: () => import('./screens/home.jsx'),
  settings: () => import('./screens/settings.jsx'),
  keys: () => import('./screens/keys.jsx'),
  more: () => import('./screens/more.jsx'),
  later: () => import('./screens/later.jsx'),
  todo: () => import('./screens/todo.jsx'),
  time: () => import('./screens/time.jsx'),
  school: () => import('./screens/school.jsx'),
  help: () => import('./screens/help.jsx'),
  calendar: () => import('./screens/calendar.jsx'),
  class: () => import('./screens/class.jsx'),
  lesson: () => import('./screens/lesson.jsx'),
  library: () => import('./screens/library.jsx'),
  mark: () => import('./screens/mark.jsx'),
};
// A screen or part is handed over once the chosen language's lines it brought with it have arrived (i18n/t.js addLines).
for (const o of [PARTS, CHUNKS]) for (const k in o) { const f = o[k]; o[k] = () => f().then(m => addLines.ready().then(() => m)); }

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
let main = null, was = null, choice = null, replacing = null, used = null;
const inputEvents = ['pointerdown', 'keydown', 'wheel'];
export const routeInteracted = (path = was) => path != null && used === path;
export function setMain(el) { main = el; }
function focusSelector(el) {
  if (!el) return '';
  const scope = main.contains(el) ? 'main' : el.closest('[data-shell-nav]') ? '[data-shell-nav]' : '';
  if (!scope) return '';
  // Arrow keys have already focused the next button when the outgoing address is saved. Return to this group's selected item.
  if (el.hasAttribute('data-rv')) {
    const group = el.closest('[role="tablist"],[role="radiogroup"]');
    return scope + ' [role="' + group.role + '"][aria-label="' + CSS.escape(group.ariaLabel) + '"] [data-rv][tabindex="0"]';
  }
  if (el.id) return '#' + CSS.escape(el.id);
  const attr = el.hasAttribute('data-focus') ? 'data-focus' : el.hasAttribute('href') ? 'href' : '';
  return attr ? scope + ' [' + attr + '="' + CSS.escape(el.getAttribute(attr)) + '"]' : '';
}
function remember(path = was) {
  if (!path || !main) return;
  kept.set(path, { top: main.scrollTop, focus: focusSelector(document.activeElement) });
}
// A deep link has already scrolled and focused its destination. Keep that position under the address it leaves in history.
export function replaceHere(hash) {
  replacing = parse(hash).path;
  remember(replacing);
  location.replace(hash);
}
// Restore during the route commit. A lazy screen may need to draw its heading, saved control, or full scroll area first.
export function restore(path, fresh) {
  const k = kept.get(path), top = k ? k.top : 0;
  const samePage = replacing === path;
  replacing = null;
  if (!main || (samePage && (document.activeElement !== document.body || !k?.focus))) return;
  const apply = () => {
    if (current().path !== path) return true;
    // Arrow keys focus the next radio or tab before it changes the address. Keep that same control once selected.
    if (choice && choice === document.activeElement && choice.tabIndex === 0) return true;
    const el = k?.focus && document.querySelector(k.focus);
    const heading = main.querySelector('h1'), busy = main.querySelector('[aria-busy="true"]');
    if (busy && (busy.contains(heading) || (!el && (k?.focus || (fresh && !heading))) ||
        top > main.scrollHeight - main.clientHeight)) return false;
    main.scrollTop = top;
    if (el) el.focus({ preventScroll: true });
    else if (!samePage && fresh && heading && !(main.contains(document.activeElement) && document.activeElement.matches('input,textarea,select,[contenteditable]'))) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    return true;
  };
  if (apply()) return;
  const events = new AbortController();
  const stop = () => { observer.disconnect(); events.abort(); };
  const observer = new MutationObserver(() => { if (apply()) stop(); });
  observer.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
  // Moving over the destination or using a control anywhere in the shell takes precedence over the saved position.
  // Replacing a tall screen with a loading placeholder can itself dispatch scroll.
  const options = { capture: true, passive: true, signal: events.signal };
  main.addEventListener('pointermove', stop, options);
  for (const type of [...inputEvents, 'focusin']) document.addEventListener(type, stop, options);
  return stop;
}
let started = false;
export function start() {
  if (started) return; started = true;
  was = current().path;
  for (const type of inputEvents) document.addEventListener(type, () => { used = was; }, { capture: true, passive: true });
  window.addEventListener('hashchange', () => {
    used = null;
    remember();
    const r = current(), previous = parse(was);
    choice = r.chunk === previous.chunk && r.params.id === previous.params.id && main
      ? main.querySelector('[data-rv][tabindex="-1"]:focus') : null;
    from = was; was = r.path; told.forEach(f => f(r));
  });
}
