// What the screenshot check and the saved-work check share: a stopped clock, made-up saved work, and a server that
// can show one build's two pages at one address. Every student, class and lesson here is made up.
const fs = require('fs'), path = require('path'), http = require('http'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const NOW = '2026-10-27T10:20:00';   // a Tuesday, mid-term (the pages are set to UTC)

/* ---------------- made-up saved work: one class with a term of scores, a second class, and a timetable ---------------- */
const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup', 'Esme Placeholder', 'Finn Example'];
const RUB = { mode: 'rubric', criteria: ['Ideas', 'Organization', 'Language'] };
const day = s => Date.parse(s + 'T12:00:00Z');
function gradingSeed() {
  const item = (id, name, more) => ({ id, name, classId: 'c1', ...more });
  const typed = (max, vals) => ({ max, s: Object.fromEntries(NAMES.map((n, i) => [n, vals[i] === 'm' ? { v: null, st: 'missing' } : { v: vals[i] }])) });
  const rub = (t, rows) => ({ t: day(t), cls: 'c1', setup: RUB, s: Object.fromEntries(NAMES.map((n, i) => [n, { f: {}, h: {}, g: { rubric: rows[i], points: '', comment: '' } }])) });
  const lib = {
    classes: [{ id: 'c1', name: 'Grade 9 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1: Stories', items: [
      item('i1', 'Reading check 1', { type: 'ic', due: '2026-09-01', typed: typed(null, [90, 95, 70, 60, 40, 85]) }),
      item('i2', 'Story map', { type: 'fm', due: '2026-09-05', typed: { max: null, s: Object.fromEntries(NAMES.slice(0, 3).map(n => [n, { v: null, st: '', fb: true }])) } }),
      item('i3', 'Narrative essay', { type: 'sum', due: '2026-09-19', batchId: 'gs.b.n1' }),
      item('i4', 'Vocabulary quiz', { type: 'ic', due: '2026-09-30', typed: typed(20, [18, 15, 14, 12, 14, 17]) }),
    ] }, { id: 'u2', name: 'Unit 2: Poetry', items: [
      item('i5', 'Poetry analysis', { type: 'sum', due: '2026-10-20', batchId: 'gs.b.n2' }),
      item('i6', 'Timed paragraph', { type: 'ic', due: '2026-10-29', typed: typed(null, [92, 60, 72, 'm', 80, 88]) }),
    ] }] }, { id: 'c2', name: 'Grade 10 Literature', names: ['Nia Elsewhere', 'Omar Stand-in'], units: [] }],
    loose: { id: '', units: [] }, seed2627: true,
    book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2026-12-18' }] },
  };
  const work = {
    'gs.b.n1': rub('2026-09-20', [[4, 4, 3], [4, 3, 3], [3, 3, 2], [2, 3, 2], [2, 2, 1], [4, 3, 3]]),
    'gs.b.n2': rub('2026-10-21', [[4, 3, 3], [3, 2, 2], [3, 2, 2], [3, 3, 2], [3, 3, 2], [4, 4, 3]]),
  };
  const ls = { 'gs.lib': JSON.stringify(lib) };
  for (const [k, v] of Object.entries(work)) ls[k] = JSON.stringify(v);
  const meta = Object.keys(work).map(id => [id, { id, name: { 'gs.b.n1': 'Narrative essay', 'gs.b.n2': 'Poetry analysis' }[id], n: 6, scored: 6, t: work[id].t, asg: { 'gs.b.n1': 'i3', 'gs.b.n2': 'i5' }[id] }]);
  return { ls, idb: { 'grading-studio-keep': { version: 2, stores: { papers: [], work: [], edits: [], meta } } } };
}
const PLAN_SETUP = {
  kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-08-31', semEnd: '2027-01-18',
  classes: [
    { id: 'A1', name: 'Grade 9 English', course: 'Grade 9', color: '#1F6FB2', meets: [{ dow: 1, start: '09:00', end: '10:30' }, { dow: 2, start: '13:30', end: '15:00' }, { dow: 4, start: '09:00', end: '10:30' }] },
    { id: 'B1', name: 'Grade 10 Literature', course: 'Grade 10', color: '#0E7C86', meets: [{ dow: 2, start: '10:45', end: '12:15' }, { dow: 3, start: '10:45', end: '12:15' }, { dow: 5, start: '13:30', end: '15:00' }] },
  ],
  daysOff: [], events: [],
};

/* ---------------- a stopped clock, and nothing left to chance ---------------- */
// Runs before any of the page's own code. The clock stands still at NOW, so "today", "this week" and every date drawn are
// the same on every run; timers still run. Nothing moves, and the short notices that come and go by the clock are not drawn. Random numbers come from a fixed list, the browser's stronger ones too, so ids and anonymous codes repeat.
// Only ever for these checks: nothing made here is kept or sent.
const STEADY = `(() => {
  const T = new Date(${JSON.stringify(NOW)} + 'Z').getTime(), D = Date;
  class Steady extends D { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } }
  window.Date = Steady;
  let s = 0x2F6E2B1;
  const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  Math.random = rnd;
  Crypto.prototype.getRandomValues = function (a) { const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < b.length; i++) b[i] = Math.floor(rnd() * 256); return a; };
  const still = () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}.toast{display:none!important}'; (document.head || document.documentElement).appendChild(st); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', still); else still();
})();`;

// pages is { index, planner }: the two built pages as text. Swap its fields and the same address shows another build.
// port: ask for the same one again and a second build is at the very address the first was, so it reads the same saved work.
function serveBuild(pages, port) {
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0], body = p === '/' || p === '/index.html' ? pages.index : p === '/planner.html' ? pages.planner : p === '/blank' ? '<!doctype html><title>blank</title>' : null;
    // A page set to another language asks for that language's file (lang/<code>.js): the one of the same build as the page.
    if (body == null && /^\/lang\/[A-Za-z-]+\.js$/.test(p)) {
      const js = pages.lang ? pages.lang(p.slice(1)) : fs.existsSync(path.join(ROOT, p)) ? fs.readFileSync(path.join(ROOT, p), 'utf8') : null;
      if (js != null) { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(js); }
    }
    if (body == null) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  });
  return new Promise(r => srv.listen(port || 0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}

// One lesson on the made-up day, saved the way the Planner saves its own. Returns its id.
const makeLesson = page => page.evaluate(async () => {
  const P = window.__planner;
  await P.createLesson([{ classId: 'A1', date: '2026-10-27' }]);
  const l = P.L.lessons[P.L.lessons.length - 1];
  Object.assign(l, P.normLesson({ ...l, title: 'Reading a poem aloud', slides: [
    { layout: 'title', title: 'Reading a poem aloud', fmt: 2 },
    { layout: 'content', title: 'Warm-up', body: '• Read the poem once in your head\n• Mark two words you would stress', fmt: 2 },
    { layout: 'content', title: 'In pairs', body: '• Read it to your partner\n• Swap, and say one thing you heard', fmt: 2 }] }));
  const db = await new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise((res, rej) => { const tx = db.transaction('lessons', 'readwrite'); tx.objectStore('lessons').put(JSON.parse(JSON.stringify(l))); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  db.close();
  return l.id;
});

const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
const tryGit = (...a) => { try { return git(...a); } catch { return null; } };
// The two built pages as a commit has them, or null when that commit can't be read.
function pagesAt(ref) {
  const index = tryGit('show', ref + ':index.html'), planner = tryGit('show', ref + ':planner.html');
  return index && planner ? { index: String(index), planner: String(planner), lang: f => { const js = tryGit('show', ref + ':' + f); return js == null ? null : String(js); } } : null;
}
// The names a change lists in a file like test/screens-changed.txt. The list only counts when the file isn't the same as the
// earlier commit's, so one left over from an earlier change allows nothing.
function changedList(file, ref) {
  const f = path.join(ROOT, file), now = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const was = ref ? String(tryGit('show', ref + ':' + file) || '') : '';
  if (now === was) return [];
  return now.split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean);
}
// A listed name matches with * for any run of letters.
const matches = (pat, name) => new RegExp('^' + pat.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(name);

module.exports = { NOW, STEADY, serveBuild, gradingSeed, PLAN_SETUP, makeLesson, pagesAt, changedList, matches };
