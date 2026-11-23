// Pictures of the stage 6 screens on the sample (made-up classes with marked work, lessons, to-dos and school links, built by the new
// app as the sample test builds it): Home, To do, the time tracker, School, Help, each Settings group and the phone's More, in Graphite
// and Midnight, at computer (1440) and phone (390) width, and the count of things to press at rest on each.
// node next/tools/app-shots.js [--out dir] [--only home,todo] [--lang de] (a language: Graphite only, its code in the file names,
// and a list of screens that scroll sideways or cut a line off). Fails on any error on the page. Made-up students only.
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('../../test/helpers/chrome.js');
const { STEADY } = require('../../test/helpers/steady.js');
const ROOT = path.join(__dirname, '..', '..');
const onDisk = require('../test/browser/site-path');
const OUT = path.resolve(process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : path.join(ROOT, 'out', 'app-shots'));
const LANG = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : null, CUT = [];
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|sample\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p) || onDisk.extra(p);
    const f = onDisk(p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
const pressable = p => p.evaluate(() => {
  const W = innerWidth, H = innerHeight;
  const seen = e => { const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < H && r.left < W) || e.closest('[hidden],[inert]')) return false;
    for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const s = getComputedStyle(x); if (s.visibility === 'hidden' || +s.opacity === 0 || s.display === 'none') return false; } return true; };
  const root = document.querySelector('main') || document.body;
  const raw = [...new Set(root.querySelectorAll('button, a[href], input, select, textarea'))].filter(e => seen(e) && !e.disabled && !e.closest('.toast, [role="menu"], [role="status"]'));
  const LIST = '.stus, table.book tbody, ul.wlist, ul.tdul, .tdwk, .schgrid, .ttclasses';   // a list (students, assignments, to-dos, the week's days, School's groups, the timetable's classes) counts as one
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
// [name, address, ready, only at this width]
const SCREENS = [['home', 'home', '[data-home="needs"]'], ['todo', 'todo', '[data-td-adder]'], ['todo-week', 'todo/week', '[data-td-view]'], ['time', 'time', '[data-tk-page]'],
  ['school', 'school', '[data-school-page]'], ['help', 'help', '[data-hlpq]'],
  ...['classes', 'timetable', 'grading', 'marking', 'focus', 'ai', 'saving', 'display', 'about'].map(g => ['settings-' + g, 'settings/' + g, '.setnav, [data-settings], main h1']),
  ['more', 'more', 'main', '390']];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serveSite(), errors = [], counts = {};
  for (const [wn, w, h, phone] of SIZES) {
    const browser = await launch({ args: [...FLAGS, phone ? FINGER : MOUSE] }), ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
    await p.evaluateOnNewDocument(STEADY);
    await p.setViewport(phone ? { width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: w, height: h, deviceScaleFactor: 2 });
    await p.goto(srv.url + 'blank'); await p.evaluate(() => localStorage.setItem('gs.sampleOn', '1'));
    await p.goto(srv.url + 'next/#/home');
    await p.waitForFunction(() => localStorage.getItem('gs.sampleBuilt'), { timeout: 180000, polling: 300 });
    await p.waitForSelector('[data-shell-nav], nav.tabbar', { timeout: 60000 });
    if (LANG) await p.evaluate(c => { localStorage.setItem('gs.lang', JSON.stringify(c)); localStorage.setItem('sample:gs.lang', JSON.stringify(c)); }, LANG);
    for (const look of LANG ? ['graphite'] : ['graphite', 'midnight']) {
      await p.evaluate(l => { localStorage.setItem('gs.look', JSON.stringify(l)); localStorage.setItem('sample:gs.look', JSON.stringify(l)); }, look);
      for (const [name, at, ready, only] of SCREENS) {
        if ((ONLY && !ONLY.includes(name)) || (only && only !== wn)) continue;
        await p.goto(srv.url + 'blank'); await p.goto(srv.url + 'next/#/' + at);
        await p.waitForSelector(ready, { timeout: 60000 }).catch(async e => { await p.screenshot({ path: path.join(OUT, 'failed-' + look + '-' + wn + '-' + name + '.png') }); throw new Error(name + ': ' + e.message); });
        await p.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 600));
        await p.screenshot({ path: path.join(OUT, (LANG ? LANG + '-' : '') + look + '-' + wn + '-' + name + '.png') });
        if (LANG) { const cut = await p.evaluate(() => { const out = []; if (document.documentElement.scrollWidth > innerWidth + 1) out.push('page scrolls sideways');
          for (const e of document.querySelectorAll('button, a, label, th, h1, h2, h3, .chip, [role=tab]')) { const s = getComputedStyle(e); if (e.offsetParent && e.scrollWidth > e.clientWidth + 2 && (s.overflow === 'hidden' || s.textOverflow === 'ellipsis' || s.whiteSpace === 'nowrap')) out.push((e.textContent || '').trim().slice(0, 50)); }
          for (const e of document.querySelectorAll('main button, main a, main label, main span, main p, main h1, main h2, main h3')) { const r = e.getBoundingClientRect(); if (r.width && r.right > innerWidth + 1 && !e.closest('[aria-hidden=true], .hscroll, [data-scroll]') && e.children.length === 0) out.push('off the edge: ' + (e.textContent || '').trim().slice(0, 50)); }
          return out.slice(0, 12); }); if (cut.length) CUT.push(wn + ' ' + name + ': ' + cut.join(' | ')); }
        if (look === 'graphite') (counts[name] ||= {})[wn] = await pressable(p);
      }
    }
    await browser.close();
  }
  await srv.close();
  if (LANG) fs.writeFileSync(path.join(OUT, LANG + '-cut.txt'), CUT.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'press-count.json'), JSON.stringify(counts, null, 1));
  for (const [k, by] of Object.entries(counts)) for (const [wn, c] of Object.entries(by)) console.log(k + ' ' + wn + ': ' + c.stops + ' things to press at rest (' + c.raw + ' controls shown): ' + c.list.join(' | '));
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('Pictures in ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
