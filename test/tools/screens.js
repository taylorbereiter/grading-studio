// npm run screens: a picture of every screen at three sizes, in light and in dark, and what changed since main.
//
//   node test/tools/screens.js                    pictures of this build, compared with origin/main's pages
//   node test/tools/screens.js --against <commit> compared with that commit's pages instead
//   node test/tools/screens.js --only            pictures of this build and nothing else
//   node test/tools/screens.js mark settings     only the screens whose names contain one of these words
//   node test/tools/screens.js --steady          this build pictured twice and compared with itself: anything that differs is the tool's own unsteadiness
//
// The saved work is made once and each build is pictured from its own copy of it, in the same Chrome, at the same address,
// in the same run, with the clock stopped on one made-up day. So a difference is a difference in the app and never in the
// computer. Nothing is kept in the repo: the pictures go to out/screens/
// (new/, old/ and, for each screen that changed, diff/ with old, new and the changed pixels side by side).
//
// Two pictures count as the same when no more than a dozen pixels differ by more than a shade (3 in 255): that much is
// Chrome, as --steady shows. A colour, a size or a position that changes is far more than that.
//
// A change that means to alter a screen says so in test/screens-changed.txt, in the same pull request. The run fails when
// a screen changed that the file doesn't name. The file only counts when it differs from main's copy, so a list left over
// from an earlier change allows nothing.
//
// Every student, class and lesson here is made up.
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net');
const ROOT = path.join(__dirname, '..', '..');
const { launch } = require('../helpers/chrome');
const { plant, appReady, openZip, goToStudent, score, markPage, settle, builtHtml } = require('../helpers/app');
const { standardFiles, zipOf } = require('../helpers/fixtures');
const { STEADY, serveBuild, gradingSeed, PLAN_SETUP, pagesAt, makeLesson, changedList, matches } = require('../helpers/steady');

// Chrome draws with several threads at once, and the order they finish in can shade the soft edge of a thin icon a little
// differently from one picture to the next (the Help and Settings icons in the dark folded sidebar, 12 pixels). One drawing
// thread, drawn in full each time and without the graphics card, gives the same pixels every time.
const STEADY_DRAWING = ['--num-raster-threads=1', '--disable-partial-raster', '--disable-gpu-rasterization'];
const SIZES = [['small', 1024, 768], ['laptop', 1366, 768], ['desktop', 1920, 1080]];
const THEMES = ['light', 'dark'];
const OUT = path.join(ROOT, 'out', 'screens');

/* ---------------- the screens ---------------- */
// where: 'g' the grading page, 'p' the Planner. hash: the address. then: anything to open on top. ready: what to wait for.
// {A} in an address is the open assignment made below.
const tabNamed = t => async page => { await page.waitForFunction(t => [...document.querySelectorAll('#rail [data-v]')].some(b => b.textContent.trim() === t), {}, t); await page.evaluate(t => [...document.querySelectorAll('#rail [data-v]')].find(b => b.textContent.trim() === t).click(), t); };
const SCREENS = [
  { name: 'home', where: 'g', hash: '#/', ready: '#railClasses a' },
  { name: 'home-find', where: 'g', hash: '#/', ready: '#railClasses a', then: page => page.evaluate(() => window.__gs.openFind()) },
  { name: 'help', where: 'g', hash: '#/help/return', ready: '#hlp-return.on' },
  { name: 'home-spanish', where: 'g', hash: '#/', ready: '#railClasses a', then: async page => { await page.evaluate(() => { localStorage.setItem('gs.lang', '"es"'); }); await page.reload(); await page.waitForSelector('#railClasses a'); await page.evaluate(() => { localStorage.removeItem('gs.lang'); }); } },
  { name: 'home-chinese', where: 'g', hash: '#/', ready: '#railClasses a', then: async page => { await page.evaluate(() => { localStorage.setItem('gs.lang', '"zh-Hant"'); }); await page.reload(); await page.waitForSelector('#railClasses a'); await page.evaluate(() => { localStorage.removeItem('gs.lang'); }); } },
  { name: 'class-assignments', where: 'g', hash: '#/class/c1', ready: '#vClass:not([hidden]) .cls' },
  { name: 'class-gradebook', where: 'g', hash: '#/class/c1/gradebook', ready: '#bkTab' },
  { name: 'class-students', where: 'g', hash: '#/class/c1/students', ready: '#peopleTbl table' },
  { name: 'class-one-student', where: 'g', hash: '#/class/c1/students/2', ready: '#vClass:not([hidden])' },
  { name: 'class-charts', where: 'g', hash: '#/class/c1/charts', ready: '#vClass:not([hidden])' },
  { name: 'class-missing', where: 'g', hash: '#/class/c1/missing', ready: '#mis' },
  { name: 'class-reports', where: 'g', hash: '#/class/c1/reports', ready: '#rptText' },
  { name: 'mark', where: 'g', hash: '#/a/{A}', paper: true },
  { name: 'mark-add-menu', where: 'g', hash: '#/a/{A}', paper: true, then: page => page.evaluate(() => { const b = [...document.querySelectorAll('[data-km]')].find(b => /Add/.test(b.textContent)); if (b) b.click(); }) },
  { name: 'mark-setup-menu', where: 'g', hash: '#/a/{A}', paper: true, then: page => page.evaluate(() => document.querySelector('#moreBtn').click()) },
  { name: 'mark-keys', where: 'g', hash: '#/a/{A}', paper: true, then: async page => { await page.keyboard.press('?'); await page.waitForSelector('.keys'); } },
  { name: 'mark-word-paper', where: 'g', hash: '#/a/{A}', paper: true, student: 3 },
  { name: 'grades', where: 'g', hash: '#/a/{A}/grades', ready: '#dlg.aspage' },
  { name: 'grades-sheet', where: 'g', hash: '#/a/{A}/grades/sheet', ready: '#dlg.aspage' },
  { name: 'insights', where: 'g', hash: '#/a/{A}/insights', ready: '#dlg.aspage' },
  { name: 'insights-consistency', where: 'g', hash: '#/a/{A}/insights/consistency', ready: '#dlg.aspage' },
  { name: 'return', where: 'g', hash: '#/a/{A}/return', ready: '#dlg.aspage' },
  ...['saving', 'history', 'classes', 'terms', 'grading', 'marking', 'timetable', 'display', 'claude', 'keys', 'about'].map(k => ({ name: 'settings-' + k, where: 'g', hash: '#/settings/' + k, ready: '#vSettings:not([hidden]), [data-sec]' })),
  { name: 'planner-week', where: 'p', hash: '#week' },
  { name: 'planner-semester', where: 'p', hash: '' },
  { name: 'planner-units', where: 'p', hash: '', then: tabNamed('Units') },
  { name: 'planner-past-lessons', where: 'p', hash: '', then: tabNamed('Past lessons') },
  { name: 'planner-activities', where: 'p', hash: '', then: tabNamed('Activities') },
  { name: 'planner-timetable', where: 'p', hash: '#timetable' },
  { name: 'planner-rubrics', where: 'p', hash: '#rubrics' },
  { name: 'planner-lesson', where: 'p', hash: '#lesson/{L}' },
  // presenting: the agenda open over a slide. The bar stays up while one of its buttons has the keys, and the hint has gone by the time of the picture.
  { name: 'planner-present', where: 'p', hash: '#present/{L}', ready: '#present', then: async page => { await page.evaluate(() => { const b = document.querySelector('#present [data-p="agenda"]'); b.focus(); b.click(); }); await sleep(5200); } },
  { name: 'planner-find', where: 'p', hash: '#week', then: page => page.evaluate(() => document.querySelector('#railFind, .rfind').click()) },
  { name: 'first-visit', where: 'g', hash: '#/', ready: '#railClasses a, #rail', fresh: true },
  { name: 'first-visit-planner', where: 'p', hash: '', fresh: true },
];

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

// Waits until the app has gone quiet: nothing being saved, and its words and pictures unchanged for a while. The app
// reads papers in the background after one opens (names to cover, grades written on the paper), and a picture taken
// part-way through that would differ from the next for no reason of the build's.
const quiet = (page, ms) => page.evaluate(ms => new Promise(res => {
  const sig = () => document.body.innerText.length + '|' + document.querySelectorAll('canvas').length + '|' + [...document.querySelectorAll('canvas')].reduce((n, c) => n + c.width, 0);
  let last = sig(), since = performance.now(); const t0 = since;
  const look = () => {
    const now = sig(), t = performance.now(), ss = document.querySelector('#saveState');
    if (now !== last || (ss && /Saving/.test(ss.textContent)) || /Reading the files first/.test(document.body.innerText)) { last = now; since = t; }
    if (t - since >= ms || t - t0 > 20000) res(); else setTimeout(look, 100);
  };
  look();
}), ms);

// The saved work every picture is taken of, made once through the app itself and left in a closed Chrome profile.
// Each build is then pictured from its own copy of that profile, so both start from the same bytes.
async function makeWork(pages, port, dir, want) {
  const browser = await launch({ userDataDir: dir, keepProfile: true, args: STEADY_DRAWING }), srv = await serveBuild(pages, port);
  try {
    const page = await newPage(browser.defaultBrowserContext());
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(srv.url + 'blank'); await plant(page, gradingSeed());
    await page.goto(srv.url); await appReady(page);
    await openZip(page, zipOf(await standardFiles()), 'River essay.zip');
    await markPage(page, 0); await score(page, [3.5, 3, 4]);
    await goToStudent(page, 1); await score(page, [3, 2.5, null]);
    await goToStudent(page, 0);
    await settle(page); await quiet(page, 4000); await settle(page);
    const A = await page.evaluate(() => window.__gs.state().batch.id.replace(/^gs\.b\./, ''));
    await page.goto(srv.url + 'planner.html'); await plannerReady(page);
    await page.evaluate(async s => { await window.__planner.applySetup(s); }, PLAN_SETUP);
    const L = await makeLesson(page);
    await sleep(500);
    await page.close();
    return { A, L };
  } finally { await browser.close(); await srv.close(); }
}

// Pictures of one build: { 'home.laptop.light': Buffer, … }. Screens this build can't show are left out and listed in missed.
async function capture(pages, label, want, work, port) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-screens-'));
  fs.cpSync(work.dir, dir, { recursive: true, filter: f => !/Singleton/.test(path.basename(f)) });
  const browser = await launch({ userDataDir: dir, args: STEADY_DRAWING }), srv = await serveBuild(pages, port), shots = {}, missed = {};
  const ctx = browser.defaultBrowserContext(), fresh = await browser.createBrowserContext(), { A, L } = work;
  try {
    let page;
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
          if (sc.paper) {   // the app comes back to the student it was last on, so each picture says which one it means
            await page.waitForFunction(() => !!window.__gs.state().batch, { timeout: 30000 });
            await quiet(page, 500);   // it first reopens where it was; asking for another student before that is done can be undone by it
            for (let go = 0; go < 3; go++) {
              await goToStudent(page, sc.student || 0); await quiet(page, 300);
              if (await page.evaluate(i => window.__gs.state().cur === i, sc.student || 0)) break;
            }
            if (!sc.student) await page.waitForFunction(() => { const s = window.__gs.state(); return s.pages.length > 0 && s.pages[0].s > 0 && !!s.pages[0].bmp; }, { timeout: 30000 });
          }
          if (sc.ready) await page.waitForSelector(sc.ready, { timeout: 15000 });
          if (sc.then) await sc.then(page);
          await quiet(page, sc.hash.includes('{A}') ? 700 : 250);
          shots[key] = await still(page);
          if (page.errors.length) missed[key] = 'the page reported: ' + page.errors[0].slice(0, 200);
        } catch (e) { missed[key] = String(e.message || e).split('\n')[0].slice(0, 200); }
        await page.close().catch(() => {});
      }
      process.stdout.write('  ' + label + ' ' + theme + ' ' + size + '\n');
    }
  } finally { await fresh.close().catch(() => {}); await browser.close(); await srv.close(); }
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
      const same = Math.abs(da.data[i] - db.data[i]) <= 3 && Math.abs(da.data[i + 1] - db.data[i + 1]) <= 3 && Math.abs(da.data[i + 2] - db.data[i + 2]) <= 3;   // Chrome draws the soft edge of a round corner a shade differently from one time to the next
      if (same) { const g = 255 - (255 - (da.data[i] * 0.3 + da.data[i + 1] * 0.6 + da.data[i + 2] * 0.1)) * 0.25; out.data[i] = out.data[i + 1] = out.data[i + 2] = g; }
      else { n++; out.data[i] = 220; out.data[i + 1] = 30; out.data[i + 2] = 60; const p = i / 4, x = p % w, y = (p - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      out.data[i + 3] = 255;
    }
    if (n < 12) return { n: 0 };   // and now and then a few pixels of an icon's edge
    const c = new OffscreenCanvas(w * 3 + 40, h), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(A, 0, 0); x.drawImage(B, w + 20, 0); x.putImageData(out, 2 * w + 40, 0);
    const blob = await c.convertToBlob({ type: 'image/png' }), buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { n, box: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], png: btoa(s) };
  }, a.toString('base64'), b.toString('base64'));
}

const allowed = ref => ref === 'itself' ? [] : changedList('test/screens-changed.txt', ref);

(async () => {
  const args = process.argv.slice(2), steady = args.includes('--steady'), only = args.includes('--only'), ai = args.indexOf('--against');
  const want = args.filter((a, i) => !a.startsWith('--') && i !== ai + 1 || (ai < 0 && !a.startsWith('--')));
  let ref = only ? null : ai >= 0 ? args[ai + 1] : 'origin/main';
  let old = null;
  if (ref) {
    old = pagesAt(ref);
    if (!old) { console.log('Can’t read the pages of ' + ref + ' (try: git fetch origin main). Taking pictures of this build only.'); ref = null; }
  }
  builtHtml();
  const cur = { index: fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), planner: fs.readFileSync(path.join(ROOT, 'planner.html'), 'utf8') };
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const d of ['new', 'old', 'diff']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
  if (steady) { old = cur; ref = 'itself'; }
  const t0 = Date.now(), port = await new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-screens-work-'));
  let browser = null;
  let failed = false, report = '';
  try {
    const same = old && !steady && old.index === cur.index && old.planner === cur.planner;
    // the work is made with the older build when there is one: what a teacher has saved is what the new build must show
    const work = { dir: workDir, ...await makeWork(old || cur, port, workDir, want) };
    const now = await capture(cur, 'this build', want, work, port);
    for (const [k, b] of Object.entries(now.shots)) fs.writeFileSync(path.join(OUT, 'new', k + '.png'), b);
    const n = Object.keys(now.shots).length;
    report += n + ' pictures of this build (' + (n / (SIZES.length * THEMES.length)).toFixed(0) + ' screens, ' + SIZES.length + ' sizes, light and dark).\n';
    const bad = Object.entries(now.missed);
    if (bad.length) { failed = true; report += '\nScreens that did not open in this build:\n' + bad.map(([k, w]) => '  ' + k + ': ' + w).join('\n') + '\n'; }
    if (old && same) report += 'The pages are the same as ' + ref + '’s, byte for byte, so nothing can look different.\n';
    else if (old) {
      const was = await capture(old, ref, want, work, port);
      browser = await launch();
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
  } finally { if (browser) await browser.close(); fs.rmSync(workDir, { recursive: true, force: true }); }
  report += '\n' + ((Date.now() - t0) / 1000).toFixed(0) + ' s.';
  console.log('\n' + report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Screens\n```\n' + report.trim() + '\n```\n');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
