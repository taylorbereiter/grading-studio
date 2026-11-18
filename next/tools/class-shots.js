// Pictures of the class page's tabs (stage 5) on a made-up class with marked work, typed scores, a note and attendance: Grades, its
// charts, goals, report comments and progress sheets, People, Assignments, To do, and Library > Examples with the watch list, in Graphite and Midnight, at computer (1440) and phone (390) width, and the count of things
// to press at rest on each. node next/tools/class-shots.js [--out dir] [--only grades,people]. Fails on any error on the page.
// Made-up students only.
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('../../test/helpers/chrome.js');
const { plant } = require('../../test/helpers/app.js');
const { STEADY } = require('../../test/helpers/steady.js');
const { bookSeed } = require('../test/browser/classseed.js');
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.resolve(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : path.join(ROOT, 'out', 'class-shots'));
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p);
    const f = path.join(ROOT, p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
// What can be pressed at rest, as a teacher sees it (counted the stage 4 way, next/tools/mark-shots.js): one stop in the Tab order
// shown in the window at rest, a single control or one labelled set of choices; a list of students (the roster, the gradebook's
// names) counts as one. The raw count of every control shown is given beside it.
const pressable = p => p.evaluate(() => {
  const W = innerWidth, H = innerHeight;
  const seen = e => { const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < H && r.left < W) || e.closest('[hidden],[inert]')) return false;
    for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const s = getComputedStyle(x); if (s.visibility === 'hidden' || +s.opacity === 0 || s.display === 'none') return false; } return true; };
  const root = document.querySelector('main') || document.body;
  const raw = [...new Set(root.querySelectorAll('button, a[href], input, select, textarea'))].filter(e => seen(e) && !e.disabled && !e.closest('.toast, [role="menu"], [role="status"]'));
  const LIST = '.stus, table.book tbody, ul.wlist';   // a list of students or of assignments counts as one
  const rows = raw.filter(e => e.closest(LIST)), rest = raw.filter(e => !e.closest(LIST));
  const groups = new Set(), stops = [];
  for (const e of rest) { if (e.tabIndex < 0 || e.getAttribute('tabindex') === '-1') continue; const g = e.closest('[role="tablist"],[role="radiogroup"],[data-rove]'); if (g) { if (groups.has(g)) continue; groups.add(g); } stops.push(g || e); }
  const lab = e => (e.getAttribute('aria-label') || e.title || e.textContent || e.placeholder || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
  return { stops: stops.length + (rows.length ? 1 : 0), raw: raw.length, students: rows.length, list: stops.map(lab).concat(rows.length ? ['The list'] : []) };
});

// One browser per width: a computer's mouse hovers and points finely, a phone's finger does neither (headless Chrome says neither
// unless told at its start).
const SIZES = [['1440', 1440, 900, false], ['390', 390, 844, true]];
const FLAGS = ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'];
const MOUSE = '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4';
const FINGER = '--blink-settings=primaryHoverType=1,availableHoverTypes=1,primaryPointerType=2,availablePointerTypes=2';
// [name, address, ready, what to press first]: a sheet is pictured open over its tab, and not counted (it is not the screen at rest)
const TABS = [['grades', 'class/c1/grades', 'table.book, [data-phone-scores]'], ['charts', 'class/c1/grades', 'table.book, [data-phone-scores]', '[data-open-charts]'], ['goals', 'class/c1/grades', 'table.book, [data-phone-scores]', '[data-open-goals]'],
  ['reports', 'class/c1/grades', 'table.book, [data-phone-scores]', '[data-open-reports]'], ['sheets', 'class/c1/grades', 'table.book, [data-phone-scores]', '[data-open-sheets]'], ['people', 'class/c1/people/2', '[data-student]'],
  ['assignments', 'class/c1/work', '[data-lkhead]'], ['todo', 'class/c1/todo', '[data-ctd]'], ['examples', 'library/examples', '[data-exid]'], ['watch', 'library/examples/watch', '[data-exid]']];
// Strong examples and one watch-list item in the current app's own database, with plain made-up pictures (no student work).
const exSeed = async names => {
  const pic = async (shade, lines) => { const c = document.createElement('canvas'); c.width = 600; c.height = 420; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 420); x.fillStyle = shade; x.fillRect(0, 0, 600, 56); x.fillStyle = '#9aa3ad'; for (let i = 0; i < lines; i++) x.fillRect(40, 90 + i * 30, 520 - (i % 3) * 60, 10); return new Promise(r => c.toBlob(r, 'image/jpeg', 0.85)); };
  const now = Date.now(), base = { work: null, asg: 'i3', cls: 'c1', title: 'Narrative essay', q: null, row: null, marks: true, score: false, from: null, pages: [{ w: 600, h: 420 }] };
  const recs = [
    { ...base, id: 'exa', t: now - 4000, kind: 'paper', letter: 'A', why: 'Every claim is tied to a moment in the story', tags: ['evidence', 'Unit 1'], who: { c: 'c1', n: names[0] } },
    { ...base, id: 'exb', t: now - 3000, kind: 'part', letter: null, why: 'A clear turning point', tags: ['structure'], who: { c: 'c1', n: names[2] } },
    { ...base, id: 'exc', t: now - 2000, asg: 'i5', title: 'Poetry analysis', kind: 'shot', letter: '1', why: '', tags: ['imagery'], who: { c: 'c1', n: names[1] } },
    { ...base, id: 'wla', t: now - 1000, kind: 'shot', letter: '1', why: 'Mixes up theme and plot', tags: [], who: { c: 'c1', n: names[1] }, watch: 1 },
  ];
  const blobs = await Promise.all(recs.map((r, i) => pic(['#cfe0f1', '#e4e6ea', '#dfe9d8', '#f1e3cf'][i], 6 + i)));
  const db = await new Promise((res, rej) => { const r = indexedDB.open('grading-studio-examples', 1); r.onupgradeneeded = () => { r.result.createObjectStore('ex'); r.result.createObjectStore('pix'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  await new Promise((res, rej) => { const tx = db.transaction(['ex', 'pix'], 'readwrite'); recs.forEach((r, i) => { tx.objectStore('ex').put(r, r.id); tx.objectStore('pix').put(blobs[i], r.id + '|0'); }); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  db.close();
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serveSite(), errors = [], counts = {};
  for (const [wn, w, h, phone] of SIZES) {
    const browser = await launch({ args: [...FLAGS, phone ? FINGER : MOUSE] }), ctx = await browser.createBrowserContext();
    for (const look of ['graphite', 'midnight']) {
      const p = await ctx.newPage();
      p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
      await p.evaluateOnNewDocument(STEADY);
      await p.setViewport(phone ? { width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: w, height: h, deviceScaleFactor: 2 });
      await p.goto(srv.url + 'blank'); await plant(p, bookSeed()); await p.evaluate(l => localStorage.setItem('gs.look', JSON.stringify(l)), look);
      await p.evaluate(exSeed, JSON.parse(bookSeed().ls['gs.lib']).classes[0].names);
      for (const [name, at, ready, open] of TABS) {
        if (ONLY && !ONLY.includes(name)) continue;
        await p.goto(srv.url + 'blank'); await p.goto(srv.url + 'next/#/' + at);   // a fresh page, so a sheet left open doesn't cover the next
        await p.waitForSelector(ready, { timeout: 60000 }).catch(async e => { await p.screenshot({ path: path.join(OUT, 'failed-' + look + '-' + wn + '-' + name + '.png') }); throw e; });
        if (open && !(await p.$(open))) continue;   // at phone width the Grades tab is the phone's scores, with no cards under a gradebook
        if (open) { await p.click(open); await p.waitForSelector('dialog[open]'); }
        await p.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 400));
        await p.screenshot({ path: path.join(OUT, look + '-' + wn + '-' + name + '.png') });
        if (look === 'graphite' && !open) (counts[name] ||= {})[wn] = await pressable(p);
      }
      await p.close();
    }
    await browser.close();
  }
  await srv.close();
  fs.writeFileSync(path.join(OUT, 'press-count.json'), JSON.stringify(counts, null, 1));
  for (const [k, by] of Object.entries(counts)) for (const [wn, c] of Object.entries(by)) console.log(k + ' ' + wn + ': ' + c.stops + ' things to press at rest (' + c.raw + ' controls shown, ' + c.students + ' of them in the list of students or assignments): ' + c.list.join(' | '));
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('Pictures in ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
