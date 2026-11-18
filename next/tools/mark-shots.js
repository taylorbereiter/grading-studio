// Pictures of the marking screen (stage 4): Mark, Grades, Insights and Return on a made-up download, in Graphite and Midnight, at
// computer (1440) and phone (390) width, and the count of things to press on the Mark tab at rest.
// node next/tools/mark-shots.js [--out dir]. Fails on any error on the page. Nothing is compared with a kept picture. Made-up students only.
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('../../test/helpers/chrome.js');
const { plant, appReady, openZip, markPage, settle, goToStudent } = require('../../test/helpers/app.js');
const { zipOf, makePaper } = require('../../test/helpers/fixtures.js');
const { gradingSeed, STEADY } = require('../../test/helpers/steady.js');
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.resolve(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : path.join(ROOT, 'out', 'mark-shots'));
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
// What can be pressed on the Mark tab at rest, as a teacher sees it. A thing to press is one stop in the Tab order that is shown in
// the window at rest: a single control, or one labelled set of choices or sibling actions (the tools, the colours, a page's turn
// buttons; arrow keys inside). The student list counts as one. Disabled controls, menus' contents, the paper itself and the note
// opening shows once are not counted. The raw count of every control shown is given beside it.
const pressable = p => p.evaluate(() => {
  const W = innerWidth, H = innerHeight;
  const seen = e => { const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < H && r.left < W) || e.closest('[hidden],[inert]')) return false;
    for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const s = getComputedStyle(x); if (s.visibility === 'hidden' || +s.opacity === 0 || s.display === 'none') return false; } return true; };
  const raw = [...new Set(document.querySelectorAll('.markscreen button, .markscreen a[href], .markscreen input, .markscreen select, .markscreen textarea'))]
    .filter(e => seen(e) && !e.disabled && !e.closest('.toast, .note, canvas, [role="menu"], [role="status"]'));
  const rows = raw.filter(e => e.closest('[data-st]')), rest = raw.filter(e => !e.closest('[data-st]'));
  const stops = rest.filter(e => e.tabIndex >= 0 && e.getAttribute('tabindex') !== '-1');
  const lab = e => { const g = e.closest('[data-rove],[role="tablist"],[role="radiogroup"]'); const x = g || e; return (x.getAttribute('aria-label') || e.getAttribute('aria-label') || e.title || e.textContent || e.tagName).trim().slice(0, 40) + (g ? ' (set)' : ''); };
  return { stops: stops.length + (rows.length ? 1 : 0), raw: raw.length, students: rows.length, list: stops.map(lab).concat(rows.length ? ['Student list'] : []) };
});

// One browser per width: a computer's mouse hovers and points finely, a phone's finger does neither (headless Chrome says neither
// unless told at its start).
const SIZES = [['1440', 1440, 900, false], ['390', 390, 844, true]];
const FLAGS = ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'];
const MOUSE = '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4';
const FINGER = '--blink-settings=primaryHoverType=1,availableHoverTypes=1,primaryPointerType=2,availablePointerTypes=2';
(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const srv = await serveSite(), errors = [], counts = {};
  const zip = await zipOf({ 'Aria Testwell/Essay.pdf': await makePaper({ title: 'My summer essay', pages: 2 }), 'Bram Sample/Essay.pdf': await makePaper({ title: 'A day at the lake' }), 'Cleo Fixture/Essay.pdf': await makePaper({ title: 'The storm' }) });
  for (const [wn, w, h, phone] of SIZES) {
    const browser = await launch({ args: [...FLAGS, phone ? FINGER : MOUSE] }), ctx = await browser.createBrowserContext();
    const page = async (vw, vh) => {
      const p = await ctx.newPage();
      p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
      await p.evaluateOnNewDocument(STEADY);
      await p.setViewport(phone && vw === w ? { width: vw, height: vh, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: vw, height: vh, deviceScaleFactor: 2 });
      return p;
    };
    // the made-up download, opened in the current app as a teacher would
    const m = await page(1440, 900);
    await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
    await m.goto(srv.url); await appReady(m); await openZip(m, zip);
    // the screen in use: the rubric's rows named with a line for each level, every kind of mark and two stamps on the first paper,
    // two students scored, a comment, and three saved comments (all made up)
    await m.evaluate(() => {
      localStorage.setItem('gs.bank', JSON.stringify(['Explain each quotation', 'Theme as a full sentence', 'Strong ending']));
      const su = window.__gs.state().setup;
      su.criteria = ['Understanding', 'Evidence', 'Language'];
      su.levels = [{ 1: 'Retells the story', 2: 'Names a theme', 3: 'Explains how the author builds a theme', 4: 'Traces the theme across the story' },
        { 1: 'Little evidence', 2: 'Quotations, not explained', 3: 'Quotations, each explained', 4: 'Well-chosen quotations, closely read' },
        { 1: 'Hard to follow', 2: 'Many errors', 3: 'Clear, a few errors', 4: 'Precise and varied' }];
    });
    await markPage(m, 0);
    await m.evaluate(() => {
      const G = window.__gs, s = G.state(), [a, b] = s.batch.students, f = a.files[0], add = m => (f.marks[0] ||= []).push(m);
      add({ t: 'stamp', k: 'score', x: 470, y: 90, size: 44, text: '8/12 = 67%', color: '#D7263D' });
      add({ t: 'stamp', k: 'star', x: 500, y: 640, size: 36 });
      a.grade.rubric = [3, 2, 3]; a.grade.comment = 'Your reading of the ending is the strongest part. Next time, explain every quotation the way you did the first one.';
      b.grade.rubric = [4, 3, 3];
      G.saveNow();
    });
    await goToStudent(m, 1); await goToStudent(m, 0); await settle(m);
    const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();
    for (const look of ['graphite', 'midnight']) {
      const p = await page(w, h);
      await p.goto(srv.url + 'blank'); await p.evaluate(l => localStorage.setItem('gs.look', JSON.stringify(l)), look);
      for (const tab of ['mark', 'grades', 'insights', 'return']) {
        await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id) + (tab === 'mark' ? '' : '/' + tab));
        await p.waitForFunction(t => { const s = document.querySelector('.markscreen'); return s && s.dataset.tab === t && window.__mark && window.__mark.ready; }, { timeout: 60000 }, tab);
        if (tab === 'mark') await p.waitForFunction(() => window.__mark.read && window.__mark.state().pages.every(pg => pg.canvas && pg.bmp), { timeout: 60000 });
        await p.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 400));
        await p.screenshot({ path: path.join(OUT, look + '-' + wn + '-' + tab + '.png') });
        if (tab === 'mark' && look === 'graphite') counts[wn] = await pressable(p);
      }
      await p.close();
    }
    await browser.close();
  }
  await srv.close();
  fs.writeFileSync(path.join(OUT, 'press-count.json'), JSON.stringify(counts, null, 1));
  for (const [k, c] of Object.entries(counts)) console.log(k + ': ' + c.stops + ' things to press at rest (' + c.raw + ' controls shown, ' + c.students + ' of them student rows): ' + c.list.join(' | '));
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('Pictures in ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
