// npm run screens: a picture of every screen at three sizes, in light and in dark, and what changed since main.
//
//   node test/tools/screens.js                    pictures of this build, compared with origin/main's pages
//   node test/tools/screens.js --against <commit> compared with that commit's pages instead
//   node test/tools/screens.js --only            pictures of this build and nothing else
//   node test/tools/screens.js mark settings     only the screens whose names contain one of these words
//
// Both builds are pictured in the same Chrome in the same run, with the clock stopped on one made-up day, so a difference
// is a difference in the app and never in the computer. Nothing is kept in the repo: the pictures go to out/screens/
// (new/, old/ and, for each screen that changed, diff/ with old, new and the changed pixels side by side).
//
// A change that means to alter a screen says so in test/screens-changed.txt, in the same pull request. The run fails when
// a screen changed that the file doesn't name. The file only counts when it differs from main's copy, so a list left over
// from an earlier change allows nothing.
//
// Every student, class and lesson here is made up.
const fs = require('fs'), path = require('path'), http = require('http'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const { launch } = require('../helpers/chrome');
const { plant, appReady, openZip, goToStudent, score, markPage, settle, builtHtml } = require('../helpers/app');
const { standardFiles, zipOf } = require('../helpers/fixtures');

const SIZES = [['small', 1024, 768], ['laptop', 1366, 768], ['desktop', 1920, 1080]];
const THEMES = ['light', 'dark'];
const OUT = path.join(ROOT, 'out', 'screens');
const NOW = '2026-10-27T10:20:00';   // a Tuesday, mid-term, in the browser's own time zone (set to UTC below)

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

/* ---------------- the screens ---------------- */
// where: 'g' the grading page, 'p' the Planner. hash: the address. then: anything to open on top. ready: what to wait for.
// {A} in an address is the open assignment made below.
const tabNamed = t => page => page.evaluate(t => [...document.querySelectorAll('.ls-top nav .pl-tab')].find(b => b.textContent.trim() === t).click(), t);
const SCREENS = [
  { name: 'home', where: 'g', hash: '#/', ready: '#railClasses a' },
  { name: 'home-find', where: 'g', hash: '#/', ready: '#railClasses a', then: page => page.evaluate(() => window.__gs.openFind()) },
  { name: 'class-assignments', where: 'g', hash: '#/class/c1', ready: '#vClass:not([hidden]) .cls' },
  { name: 'class-gradebook', where: 'g', hash: '#/class/c1/gradebook', ready: '#bkTab' },
  { name: 'class-students', where: 'g', hash: '#/class/c1/students', ready: '#peopleTbl table' },
  { name: 'class-one-student', where: 'g', hash: '#/class/c1/students/2', ready: '#vClass:not([hidden])' },
  { name: 'class-charts', where: 'g', hash: '#/class/c1/charts', ready: '#vClass:not([hidden])' },
  { name: 'mark', where: 'g', hash: '#/a/{A}', paper: true },
  { name: 'mark-add-menu', where: 'g', hash: '#/a/{A}', paper: true, then: page => page.evaluate(() => { const b = [...document.querySelectorAll('[data-km]')].find(b => /Add/.test(b.textContent)); if (b) b.click(); }) },
  { name: 'mark-setup-menu', where: 'g', hash: '#/a/{A}', paper: true, then: page => page.evaluate(() => document.querySelector('#moreBtn').click()) },
  { name: 'mark-keys', where: 'g', hash: '#/a/{A}', paper: true, then: async page => { await page.keyboard.press('?'); await page.waitForSelector('.keys'); } },
  { name: 'mark-word-paper', where: 'g', hash: '#/a/{A}', paper: true, then: page => goToStudent(page, 3) },
  { name: 'grades', where: 'g', hash: '#/a/{A}/grades', ready: '#dlg.aspage' },
  { name: 'grades-sheet', where: 'g', hash: '#/a/{A}/grades/sheet', ready: '#dlg.aspage' },
  { name: 'insights', where: 'g', hash: '#/a/{A}/insights', ready: '#dlg.aspage' },
  { name: 'insights-consistency', where: 'g', hash: '#/a/{A}/insights/consistency', ready: '#dlg.aspage' },
  { name: 'return', where: 'g', hash: '#/a/{A}/return', ready: '#dlg.aspage' },
  ...['saving', 'classes', 'terms', 'grading', 'marking', 'timetable', 'display', 'claude', 'keys'].map(k => ({ name: 'settings-' + k, where: 'g', hash: '#/settings/' + k, ready: '#vSettings:not([hidden]), [data-sec]' })),
  { name: 'planner-week', where: 'p', hash: '#week' },
  { name: 'planner-semester', where: 'p', hash: '' },
  { name: 'planner-units', where: 'p', hash: '', then: tabNamed('Units') },
  { name: 'planner-past-lessons', where: 'p', hash: '', then: tabNamed('Past lessons') },
  { name: 'planner-activities', where: 'p', hash: '', then: tabNamed('Activities') },
  { name: 'planner-timetable', where: 'p', hash: '#timetable' },
  { name: 'planner-rubrics', where: 'p', hash: '#rubrics' },
  { name: 'planner-lesson', where: 'p', hash: '#lesson/{L}' },
  { name: 'planner-find', where: 'p', hash: '#week', then: page => page.evaluate(() => document.querySelector('#railFind, .rfind').click()) },
  { name: 'first-visit', where: 'g', hash: '#/', ready: '#railClasses a, #rail', fresh: true },
  { name: 'first-visit-planner', where: 'p', hash: '', fresh: true },
];

/* ---------------- a stopped clock, and nothing left to chance ---------------- */
// Runs before any of the page's own code. The clock stands still at NOW, so "today", "this week" and every date drawn are
// the same on every run; timers still run. Random numbers come from a fixed list, so ids and anonymous codes repeat too.
const STEADY = `(() => {
  const T = new Date(${JSON.stringify(NOW)} + 'Z').getTime(), D = Date;
  class Steady extends D { constructor(...a) { if (a.length) super(...a); else super(T); } static now() { return T; } }
  window.Date = Steady;
  let s = 0x2F6E2B1;
  const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  Math.random = rnd;
  const still = () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}'; (document.head || document.documentElement).appendChild(st); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', still); else still();
})();`;

function serveBuild(pages) {
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0], body = p === '/' || p === '/index.html' ? pages.index : p === '/planner.html' ? pages.planner : p === '/blank' ? '<!doctype html><title>blank</title>' : null;
    if (body == null) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
// A picture once the screen has stopped changing: the same picture twice in a row.
async function still(page) {
  let last = null;
  for (let i = 0; i < 12; i++) {
    await sleep(i ? 120 : 60);
    const shot = Buffer.from(await page.screenshot({ type: 'png' }));
    if (last && shot.equals(last)) return shot;
    last = shot;
  }
  return last;
}
async function newPage(ctx) {
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', e => page.errors.push(String(e)));
  page.on('dialog', d => d.accept());
  await page.emulateTimezone('UTC');
  await page.evaluateOnNewDocument(STEADY);
  return page;
}
const plannerReady = page => page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top, #lessons'), { timeout: 60000 });

// Pictures of one build: { 'home.laptop.light': Buffer, … }. Screens this build can't show are left out and listed in missed.
async function capture(browser, pages, label, want) {
  const srv = await serveBuild(pages), shots = {}, missed = {};
  const ctx = await browser.createBrowserContext(), fresh = await browser.createBrowserContext();
  try {
    // the saved work, made once through the app itself
    let page = await newPage(ctx);
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(srv.url + 'blank'); await plant(page, gradingSeed());
    await page.goto(srv.url); await appReady(page);
    await openZip(page, zipOf(await standardFiles()), 'River essay.zip');
    await markPage(page, 0); await score(page, [3.5, 3, 4]);
    await page.type('#comment', 'A clear opening. Next time, link each paragraph back to the question.').catch(() => {});
    await goToStudent(page, 1); await score(page, [3, 2.5, null]);
    await goToStudent(page, 0);
    await settle(page);
    const A = await page.evaluate(() => window.__gs.state().batch.id.replace(/^gs\.b\./, ''));
    await page.goto(srv.url + 'planner.html'); await plannerReady(page);
    await page.evaluate(async s => { await window.__planner.applySetup(s); }, PLAN_SETUP);
    // one lesson on today's date, saved the way the Planner saves its own
    const L = await page.evaluate(async () => {
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
    await page.close();

    for (const theme of THEMES) for (const [size, w, h] of SIZES) {
      for (const c of [ctx, fresh]) { const p = await c.newPage(); await p.goto(srv.url + 'blank'); await p.evaluate(t => localStorage.setItem('gs.theme', JSON.stringify(t)), theme); await p.close(); }
      for (const sc of SCREENS) {
        if (want.length && !want.some(x => sc.name.includes(x))) continue;
        const key = sc.name + '.' + size + '.' + theme;
        page = await newPage(sc.fresh ? fresh : ctx);
        try {
          await page.setViewport({ width: w, height: h });
          await page.goto(srv.url + (sc.where === 'p' ? 'planner.html' : '') + sc.hash.replace('{A}', A).replace('{L}', L));
          if (sc.where === 'p') await plannerReady(page); else await appReady(page);
          if (sc.paper) await page.waitForFunction(() => { const s = window.__gs.state(); return s.batch && s.pages && s.pages.length > 0 && s.pages[0].s > 0 && !!s.pages[0].bmp; }, { timeout: 30000 });
          if (sc.ready) await page.waitForSelector(sc.ready, { timeout: 15000 });
          if (sc.then) await sc.then(page);
          shots[key] = await still(page);
          if (page.errors.length) missed[key] = 'the page reported: ' + page.errors[0].slice(0, 200);
        } catch (e) { missed[key] = String(e.message || e).split('\n')[0].slice(0, 200); }
        await page.close().catch(() => {});
      }
      process.stdout.write('  ' + label + ' ' + theme + ' ' + size + '\n');
    }
  } finally { await ctx.close().catch(() => {}); await fresh.close().catch(() => {}); await srv.close(); }
  return { shots, missed };
}

// Counts the pixels that differ and draws old, new and the difference side by side. Done in the browser, which already reads PNG.
async function compare(page, a, b) {
  return page.evaluate(async (a, b) => {
    const load = s => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + s; });
    const [A, B] = await Promise.all([load(a), load(b)]), w = Math.max(A.width, B.width), h = Math.max(A.height, B.height);
    const px = im => { const c = new OffscreenCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); return x.getImageData(0, 0, w, h); };
    const da = px(A), db = px(B), out = new ImageData(w, h);
    let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let i = 0; i < da.data.length; i += 4) {
      const same = da.data[i] === db.data[i] && da.data[i + 1] === db.data[i + 1] && da.data[i + 2] === db.data[i + 2];
      if (same) { const g = 255 - (255 - (da.data[i] * 0.3 + da.data[i + 1] * 0.6 + da.data[i + 2] * 0.1)) * 0.25; out.data[i] = out.data[i + 1] = out.data[i + 2] = g; }
      else { n++; out.data[i] = 220; out.data[i + 1] = 30; out.data[i + 2] = 60; const p = i / 4, x = p % w, y = (p - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      out.data[i + 3] = 255;
    }
    if (!n) return { n: 0 };
    const c = new OffscreenCanvas(w * 3 + 40, h), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(A, 0, 0); x.drawImage(B, w + 20, 0); x.putImageData(out, 2 * w + 40, 0);
    const blob = await c.convertToBlob({ type: 'image/png' }), buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { n, box: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], png: btoa(s) };
  }, a.toString('base64'), b.toString('base64'));
}

const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
const tryGit = (...a) => { try { return git(...a); } catch { return null; } };
// The names in test/screens-changed.txt, when the file isn't the same as the earlier commit's.
function allowed(ref) {
  const f = path.join(ROOT, 'test', 'screens-changed.txt'), now = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const was = ref ? String(tryGit('show', ref + ':test/screens-changed.txt') || '') : '';
  if (now === was) return [];
  return now.split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean);
}
const matches = (pat, name) => new RegExp('^' + pat.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(name);

(async () => {
  const args = process.argv.slice(2), only = args.includes('--only'), ai = args.indexOf('--against');
  const want = args.filter((a, i) => !a.startsWith('--') && i !== ai + 1 || (ai < 0 && !a.startsWith('--')));
  let ref = only ? null : ai >= 0 ? args[ai + 1] : 'origin/main';
  let old = null;
  if (ref) {
    const index = tryGit('show', ref + ':index.html'), planner = tryGit('show', ref + ':planner.html');
    if (index && planner) old = { index: String(index), planner: String(planner) };
    else { console.log('Can’t read the pages of ' + ref + ' (try: git fetch origin main). Taking pictures of this build only.'); ref = null; }
  }
  builtHtml();
  const cur = { index: fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), planner: fs.readFileSync(path.join(ROOT, 'planner.html'), 'utf8') };
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const d of ['new', 'old', 'diff']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
  const browser = await launch(), t0 = Date.now();
  let failed = false, report = '';
  try {
    const same = old && old.index === cur.index && old.planner === cur.planner;
    const now = await capture(browser, cur, 'this build', want);
    for (const [k, b] of Object.entries(now.shots)) fs.writeFileSync(path.join(OUT, 'new', k + '.png'), b);
    const n = Object.keys(now.shots).length;
    report += n + ' pictures of this build (' + (n / (SIZES.length * THEMES.length)).toFixed(0) + ' screens, ' + SIZES.length + ' sizes, light and dark).\n';
    const bad = Object.entries(now.missed);
    if (bad.length) { failed = true; report += '\nScreens that did not open in this build:\n' + bad.map(([k, w]) => '  ' + k + ': ' + w).join('\n') + '\n'; }
    if (old && same) report += 'The pages are the same as ' + ref + '’s, byte for byte, so nothing can look different.\n';
    else if (old) {
      const was = await capture(browser, old, ref, want);
      for (const [k, b] of Object.entries(was.shots)) fs.writeFileSync(path.join(OUT, 'old', k + '.png'), b);
      const page = await browser.newPage(), changed = {}, added = [];
      for (const [k, b] of Object.entries(now.shots)) {
        const a = was.shots[k];
        if (!a) { added.push(k); continue; }
        if (a.equals(b)) continue;
        const d = await compare(page, a, b);
        if (!d.n) continue;
        fs.writeFileSync(path.join(OUT, 'diff', k + '.png'), Buffer.from(d.png, 'base64'));
        changed[k] = d;
      }
      await page.close();
      const ok = allowed(ref), nameOf = k => k.split('.')[0], isOk = k => ok.some(p => matches(p, nameOf(k)));
      const names = ks => [...new Set(ks.map(nameOf))];
      const cNames = names(Object.keys(changed)), aNames = names(added);
      const surprise = cNames.filter(nm => !ok.some(p => matches(p, nm)));
      if (!cNames.length && !aNames.length) report += 'Every screen looks exactly as it does on ' + ref + '.\n';
      if (aNames.length) report += '\nNew screens (no earlier picture): ' + aNames.join(', ') + '\n';
      if (cNames.length) {
        report += '\nScreens that look different from ' + ref + ':\n';
        for (const nm of cNames) {
          const ks = Object.keys(changed).filter(k => nameOf(k) === nm);
          report += '  ' + nm + (isOk(ks[0]) ? '  (listed in test/screens-changed.txt)' : '  NOT LISTED') + '\n' + ks.map(k => '    ' + k.split('.').slice(1).join(' ') + ': ' + changed[k].n + ' pixels, inside ' + changed[k].box.join(' ')).join('\n') + '\n';
        }
        report += '  Side by side: out/screens/diff/\n';
      }
      if (surprise.length) { failed = true; report += '\nIf these were meant to change, name them in test/screens-changed.txt (one per line, * for any run of letters):\n' + surprise.map(s => '  ' + s).join('\n') + '\n'; }
      const unused = ok.filter(p => !cNames.some(nm => matches(p, nm)) && !aNames.some(nm => matches(p, nm)));
      if (unused.length) report += '\nListed in test/screens-changed.txt but unchanged: ' + unused.join(', ') + '\n';
    }
  } finally { await browser.close(); }
  report += '\n' + ((Date.now() - t0) / 1000).toFixed(0) + ' s.';
  console.log('\n' + report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Screens\n```\n' + report.trim() + '\n```\n');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
