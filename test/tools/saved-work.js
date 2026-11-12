// npm run saved-work: work made with main's pages still opens, unchanged, in this build's pages at the same address.
//
//   node test/tools/saved-work.js                    against origin/main's pages
//   node test/tools/saved-work.js --against <commit> against that commit's pages
//
// Browsers keep saved work by address, so what matters is one address whose pages change underneath the work.
// The check, with the clock stopped:
//
//   1. main's pages make work once: a class with a term of scores, an assignment opened from a ZIP, marks, scores, a comment,
//      a late file, a timetable and a lesson in the Planner. Chrome is closed and its profile copied twice.
//   2. From each copy every screen is opened and nothing is changed: once with main's pages again, once with this build's.
//   3. Everything the browser keeps (every localStorage entry, every IndexedDB record, bytes compared by their SHA-256)
//      is read after each, and so is what the app shows for the assignment and the lesson.
//
// The two have to match exactly. Opening a screen can rewrite a record (a "last opened" time, say), which is why this
// build is held against main doing the same steps and not against the work as it was first made.
// Last, main's pages open the work once more after this build has had it, in case a change has to be taken back.
// The same is done for the copy that is double-clicked from a folder (a file:// address).
//
// A change that means to alter what is stored says which records in test/saved-work-changed.txt, in the same pull request
// (one per line: localStorage:<key> or <database>/<store>/<key>, * for any run of letters). The file only counts when
// it differs from main's copy. Nothing listed there may be work that is lost: the report shows before and after.
//
// Every student, class and lesson here is made up.
const fs = require('fs'), os = require('os'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { launch } = require('../helpers/chrome');
const { plant, appReady, openZip, goToStudent, score, markPage, settle, goTo, builtHtml } = require('../helpers/app');
const { standardFiles, zipOf } = require('../helpers/fixtures');
const { STEADY, serveBuild, gradingSeed, PLAN_SETUP, makeLesson, pagesAt, changedList, matches } = require('../helpers/steady');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const plannerReady = page => page.waitForFunction(() => window.__planner && document.querySelector('#lessons'), { timeout: 60000 });
// Every save the app has started has landed in both of its places.
const savedAll = page => page.waitForFunction(async () => {
  const ids = Object.keys(JSON.parse(localStorage.getItem('gs.batches') || '{}')).filter(id => localStorage.getItem(id)); if (!ids.length) return true;
  const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); if (!db) return false;
  const ws = await Promise.all(ids.map(id => new Promise(res => { const q = db.transaction('work').objectStore('work').get(id); q.onsuccess = () => res(q.result); q.onerror = () => res(null); })));
  db.close(); return ids.every((id, i) => ws[i] && ws[i].t === JSON.parse(localStorage.getItem(id)).t);
}, { timeout: 20000, polling: 100 });

// Everything this address keeps, as { 'localStorage:key': text, 'db/store/key': json }. Bytes are shown as their length and SHA-256.
const snapshot = page => page.evaluate(async () => {
  const out = {}, hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out['localStorage:' + k] = localStorage.getItem(k); }
  const flat = async v => {
    if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) { const u = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength); return { bytes: u.length, sha256: hex(await crypto.subtle.digest('SHA-256', u)) }; }
    if (v instanceof Blob) { const u = await v.arrayBuffer(); return { blob: v.type, bytes: u.byteLength, sha256: hex(await crypto.subtle.digest('SHA-256', u)) }; }
    if (v instanceof Date) return { date: v.getTime() };
    if (v instanceof Map) return { map: await flat([...v.entries()]) };
    if (v instanceof Set) return { set: await flat([...v.values()]) };
    if (Array.isArray(v)) return Promise.all(v.map(flat));
    if (v && typeof v === 'object') { if (typeof FileSystemHandle !== 'undefined' && v instanceof FileSystemHandle) return { handle: v.kind + ':' + v.name }; const o = {}; for (const k of Object.keys(v).sort()) o[k] = await flat(v[k]); return o; }
    return v === undefined ? { undefined: true } : v;
  };
  for (const d of await indexedDB.databases()) {
    const db = await new Promise((res, rej) => { const r = indexedDB.open(d.name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    out['(database) ' + d.name] = 'version ' + db.version + ', stores ' + [...db.objectStoreNames].sort().join(' ');
    for (const s of db.objectStoreNames) {
      const got = await new Promise((res, rej) => { const tx = db.transaction(s), o = tx.objectStore(s), a = o.getAll(), b = o.getAllKeys(); tx.oncomplete = () => res({ k: b.result, v: a.result }); tx.onerror = () => rej(tx.error); });
      for (let i = 0; i < got.k.length; i++) out[d.name + '/' + s + '/' + (typeof got.k[i] === 'string' ? got.k[i] : JSON.stringify(got.k[i]))] = JSON.stringify(await flat(got.v[i]));
    }
    db.close();
  }
  return out;
});

// One place the two pages live: a web address, or a folder they are double-clicked from.
async function placeFor(kind, pages) {
  if (kind === 'web') { const srv = await serveBuild(pages); return { url: n => srv.url + (n === 'index' ? '' : n === 'planner' ? 'planner.html' : 'blank'), show: () => {}, close: () => srv.close() }; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-test-copy-')), u = f => 'file://' + path.join(dir, f).split(path.sep).map(encodeURIComponent).join('/').replace(/%3A/g, ':');
  const show = () => { fs.writeFileSync(path.join(dir, 'Grading Studio.html'), pages.index); fs.writeFileSync(path.join(dir, 'Planner.html'), pages.planner); fs.writeFileSync(path.join(dir, 'blank.html'), '<!doctype html><title>blank</title>'); };
  show();
  return { url: n => u(n === 'index' ? 'Grading Studio.html' : n === 'planner' ? 'Planner.html' : 'blank.html'), show, close: async () => fs.rmSync(dir, { recursive: true, force: true }) };
}
async function newPage(ctx) {
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', e => page.errors.push(String(e).split('\n')[0].slice(0, 300)));
  page.on('dialog', d => d.accept());
  await page.emulateTimezone('UTC');
  await page.evaluateOnNewDocument(STEADY);
  await page.setViewport({ width: 1366, height: 768 });
  return page;
}

// Step 1: the work, made through the app. Returns the ids the later steps open.
async function makeWork(ctx, place) {
  const page = await newPage(ctx);
  await page.goto(place.url('blank')); await plant(page, gradingSeed());
  await page.goto(place.url('index')); await appReady(page);
  await openZip(page, zipOf(await standardFiles()), 'River essay.zip');
  await markPage(page, 0); await score(page, [3.5, 3, 4]);
  await page.type('#comment', 'A clear opening. Next time, link each paragraph back to the question.').catch(() => {});
  await goToStudent(page, 1); await score(page, [3, 2.5, null]);
  await page.evaluate(async () => { await window.__gs.addFiles(window.__gs.state().batch.students[1], [{ path: 'Late page.txt', file: new File(['handed in late'], 'Late page.txt') }], true); await window.__gs.saveNow(); });
  await goToStudent(page, 0);
  await settle(page);
  const A = await page.evaluate(() => window.__gs.state().batch.id.replace(/^gs\.b\./, ''));
  await goTo(page, '#/'); await savedAll(page);
  await page.goto(place.url('planner')); await plannerReady(page);
  await page.evaluate(async s => { await window.__planner.applySetup(s); }, PLAN_SETUP);
  const L = await makeLesson(page);
  await sleep(400);
  const errors = page.errors.slice();
  await page.close();
  return { A, L, errors };
}
// Step 2: every screen opened, nothing changed. Returns what the app shows, and any error the pages reported.
async function walk(ctx, place, { A, L }) {
  const page = await newPage(ctx), seen = {};
  const at = async (hash, ready) => { await goTo(page, hash); if (ready) await page.waitForSelector(ready, { timeout: 20000 }); await sleep(150); };
  await page.goto(place.url('index')); await appReady(page);
  await at('#/', '#railClasses a');
  seen.sidebar = await page.$$eval('#railClasses a', xs => xs.map(a => a.textContent.replace(/\s+/g, ' ').trim()));
  await at('#/class/c1', '#vClass:not([hidden]) .cls');
  await at('#/class/c1/gradebook', '#bkTab');
  // Each student's row: their name, then every figure in the row in sorted order, so the gradebook's columns can move
  // between builds while the scores it shows for each student still have to match exactly.
  seen.gradebook = await page.$$eval('#bkTab tbody tr', rs => rs.map(r => { const t = [...r.children].map(c => c.innerText.replace(/\s+/g, ' ').trim()); return t[0] + ': ' + t.slice(1).sort().join(' | '); }));
  await at('#/class/c1/students', '#peopleTbl table');
  await at('#/class/c1/students/2');
  await at('#/class/c1/charts');
  await at('#/a/' + A);
  await page.waitForFunction(() => !!window.__gs.state().batch, { timeout: 30000 });
  await goToStudent(page, 0);
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.pages.length > 0 && s.pages[0].s > 0 && !!s.pages[0].bmp; }, { timeout: 30000 });
  await goToStudent(page, 1); await goToStudent(page, 3); await goToStudent(page, 0);
  seen.assignment = await page.evaluate(() => {
    const b = window.__gs.state().batch;
    return { name: b.name, students: b.students.map(s => ({ key: s.key, grade: s.grade, status: s.status || '', files: s.files.map(f => ({ path: f.path, bytes: f.data ? f.data.byteLength || f.data.length : 0, marks: f.marks, rot: f.rot, added: !!f.added })) })) };
  });
  for (const t of ['/grades', '/grades/sheet', '/insights', '/insights/consistency', '/return']) await at('#/a/' + A + t, '#dlg.aspage');
  seen.grades = await (async () => { await at('#/a/' + A + '/grades', '#dlg.aspage'); return page.$eval('#dlg', e => e.innerText.replace(/\s+/g, ' ').trim()); })();   // every word and number in order; where a line breaks is the layout's (a row to check became a table row again, 1.27.34)
  for (const k of ['saving', 'classes', 'terms', 'grading', 'marking', 'timetable', 'display', 'claude', 'keys']) await at('#/settings/' + k);
  await at('#/', '#railClasses a');
  await savedAll(page); await sleep(500);
  const errors = page.errors.slice();
  await page.goto(place.url('planner') + '#week'); await plannerReady(page);
  await page.goto(place.url('blank'));
  await page.goto(place.url('planner') + '#lesson/' + L); await plannerReady(page);
  await page.waitForFunction(() => !!window.__planner.L.open, { timeout: 20000 }).catch(() => {});   // the lesson opens last, once the classes and everything else have been read
  seen.planner = await page.evaluate(() => { const P = window.__planner.L; return { classes: (P.setup && P.setup.classes || []).map(c => c.name), lessons: P.lessons.map(l => ({ id: l.id, title: l.title, slots: l.slots, slides: l.slides.map(s => [s.layout, s.title, s.body]) })), open: P.open && P.open.title }; });
  await sleep(500);
  errors.push(...page.errors);
  await page.goto(place.url('blank'));
  const kept = await snapshot(page);
  await page.close();
  return { seen, kept, errors };
}
// The work is made once, by main's pages, in a Chrome profile that is then closed. Each run starts from its own copy of
// that profile, so both start from the very same bytes; then the pages named in then walk through it in turn.
async function runs(kind, old, thens) {
  const pages = { ...old }, place = await placeFor(kind, pages), workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-saved-work-'));
  try {
    let browser = await launch({ userDataDir: workDir, keepProfile: true }), ids, made;
    try {
      ids = await makeWork(browser.defaultBrowserContext(), place);
      const p = await newPage(browser.defaultBrowserContext()); await p.goto(place.url('blank')); made = await snapshot(p); await p.close();
    } finally { await browser.close(); }
    const out = [];
    for (const then of thens) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-saved-work-'));
      fs.cpSync(workDir, dir, { recursive: true, filter: f => !/Singleton/.test(path.basename(f)) });
      browser = await launch({ userDataDir: dir });
      try {
        const ctx = browser.defaultBrowserContext(), walks = [];
        Object.assign(pages, old); place.show();
        const p = await newPage(ctx); await p.goto(place.url('blank')); const start = await snapshot(p); await p.close();
        for (const b of then) { Object.assign(pages, b); place.show(); walks.push(await walk(ctx, place, ids)); }
        out.push({ made, start, makeErrors: ids.errors, walks });
      } finally { await browser.close(); }
    }
    return out;
  } finally { await place.close(); fs.rmSync(workDir, { recursive: true, force: true }); }
}
const short = v => v == null ? '(nothing)' : v.length > 300 ? v.slice(0, 300) + '… (' + v.length + ' characters)' : v;
// The records that differ between two readings.
function differ(a, b) {
  const out = [];
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) if (a[k] !== b[k]) out.push({ key: k, was: a[k], now: b[k] });
  return out;
}

(async () => {
  const args = process.argv.slice(2), ai = args.indexOf('--against'), ref = ai >= 0 ? args[ai + 1] : 'origin/main';
  const old = pagesAt(ref);
  if (!old) { console.error('Can’t read the pages of ' + ref + '. Try: git fetch origin main'); process.exit(1); }
  builtHtml();
  const cur = { index: fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), planner: fs.readFileSync(path.join(ROOT, 'planner.html'), 'utf8') };
  const t0 = Date.now(), ok = changedList('test/saved-work-changed.txt', ref);
  let failed = false, report = '';
  if (old.index === cur.index && old.planner === cur.planner) report += 'The pages are the same as ' + ref + '’s, byte for byte, so saved work is read by the same code.\n';
  else for (const kind of ['web', 'copy']) {
    const where = kind === 'web' ? 'On the web address' : 'In the double-clicked copy';
    const [base, next] = await runs(kind, old, [[old], [cur, old]]);
    const n = Object.keys(base.made).length;
    const errs = [['while main’s pages made the work', base.makeErrors], ['with main’s pages', base.walks[0].errors], ['with this build’s pages', next.walks[0].errors], ['with main’s pages after this build’s', next.walks[1].errors]].filter(e => e[1].length);
    const unsteady = differ(base.made, base.start).concat(differ(base.made, next.start));
    if (unsteady.length) { failed = true; report += where + ': the two runs did not start from the same work, so the check can’t compare them. Differing records:\n' + unsteady.slice(0, 10).map(d => '  ' + d.key).join('\n') + '\n'; continue; }
    const stored = differ(base.walks[0].kept, next.walks[0].kept), shown = JSON.stringify(base.walks[0].seen) === JSON.stringify(next.walks[0].seen);
    const back = differ(next.walks[0].kept, next.walks[1].kept).filter(d => base.walks[0].kept[d.key] !== d.now), backShown = JSON.stringify(base.walks[0].seen) === JSON.stringify(next.walks[1].seen);
    const listed = d => ok.some(p => matches(p, d.key)), surprise = stored.filter(d => !listed(d));
    report += where + ': ' + n + ' saved records made with ' + ref + '’s pages.\n';
    if (!stored.length && shown) report += '  Opened in this build: every record is the same, and the app shows the same scores, marks, comments, files and lesson.\n';
    if (stored.length) report += '  Opened in this build, these records differ from what ' + ref + '’s pages leave:\n' + stored.map(d => '    ' + d.key + (listed(d) ? '  (listed in test/saved-work-changed.txt)' : '  NOT LISTED') + '\n      main: ' + short(d.was) + '\n      this: ' + short(d.now)).join('\n') + '\n';
    if (!shown) { failed = true; report += '  THE APP SHOWS DIFFERENT WORK in this build:\n' + Object.keys(base.walks[0].seen).filter(k => JSON.stringify(base.walks[0].seen[k]) !== JSON.stringify(next.walks[0].seen[k])).map(k => '    ' + k + '\n      main: ' + short(JSON.stringify(base.walks[0].seen[k])) + '\n      this: ' + short(JSON.stringify(next.walks[0].seen[k]))).join('\n') + '\n'; }
    if (surprise.length) failed = true;
    if (!back.length && backShown) report += '  Opened in ' + ref + '’s pages again afterwards: still the same, so the change can be taken back.\n';
    else { if (!backShown || back.some(d => !listed(d))) failed = true; report += '  Opened in ' + ref + '’s pages again afterwards, ' + (backShown ? '' : 'THE APP SHOWS DIFFERENT WORK and ') + back.length + ' record' + (back.length === 1 ? ' differs' : 's differ') + ':\n' + back.map(d => '    ' + d.key + (listed(d) ? '  (listed)' : '  NOT LISTED')).join('\n') + '\n'; }
    if (errs.length) { failed = true; report += '  The pages reported errors ' + errs.map(e => e[0] + ':\n' + e[1].map(x => '    ' + x).join('\n')).join('\n  and ') + '\n'; }
  }
  report += '\n' + (failed ? 'FAILED: saved work would not survive this change as it stands.' : 'Saved work survives this change.') + ' ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s.';
  console.log('\n' + report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Saved work\n```\n' + report.trim() + '\n```\n');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
