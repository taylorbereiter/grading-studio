// The new marking screen's top bar and full screen (slice C PR 5), in a real browser: marked so far with the missing and excused, and
// the class average Insights gives, as one button to Insights; the Setup menu's Gradebook, unit plan link, class page link and Bring
// back; Find's Grade sheet, Consistency check, Examples, Add late work and Bring back; full screen from the View toolbar and F, with
// the student list stepping aside as Settings says and coming back at the left edge, from the tab, with [ and with /.
// npm run next:browser. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip, settle } = require('../../../test/helpers/app.js');
const { standardFiles, zipOf } = require('../../../test/helpers/fixtures.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const onDisk = require('./site-path');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p) || onDisk.extra(p);
    const f = onDisk(p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}

let browser, srv, dir;
before(async () => { srv = await serveSite(); browser = await launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-top-')); });
after(async () => { await browser.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  // GS_THROTTLE=6 runs the page that many times slower (CDP), to find what depends on timing before CI does
  if (+process.env.GS_THROTTLE > 1) await (await p.target().createCDPSession()).send('Emulation.setCPUThrottlingRate', { rate: +process.env.GS_THROTTLE });
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
const menuPick = async (p, opener, label) => { await p.waitForSelector(opener, { timeout: 60000 }); await p.click(opener); await p.waitForSelector('.pop [role^="menuitem"]');
  const ok = await p.evaluate(l => { const it = [...document.querySelectorAll('.pop [role^="menuitem"]')].find(e => (e.querySelector('b') || e).textContent.trim() === l); if (it) it.click(); return !!it; }, label);
  if (!ok) throw new Error('no menu item ' + label); };
const menuText = async (p, opener) => { await p.click(opener); await p.waitForSelector('.pop [role^="menuitem"]');
  const all = await p.evaluate(() => [...document.querySelectorAll('.pop [role^="menuitem"]')].map(e => (e.querySelector('b') || e).textContent.trim()));
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('.pop')); return all; };
const findOpen = async (p, say) => {
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control');
  await p.waitForSelector('dialog.cmd[open]');
  await p.keyboard.type(say);
  // every key reached the Find box: the list shows every command before anything is typed, so it alone proves nothing
  assert.equal(await p.$eval('dialog.cmd[open] input', e => e.value), say, 'what was typed is in the Find box');
  return p.waitForFunction(s => [...document.querySelectorAll('dialog.cmd[open] [role="option"]')].some(o => o.textContent.includes(s)), { timeout: 10000 }, say).then(() => true, () => false);
};
const findHas = async (p, say) => {
  const ok = await findOpen(p, say);
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog.cmd[open]'));
  return ok;
};
// the download opened in the current app first (made-up papers), with what before() does there; then the new marking screen on it
async function both(ctx, errors, files, before) {
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, zipOf(files));
  if (before) await before(m);
  await m.evaluate(() => window.__gs.saveNow()); await settle(m);
  const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();
  const p = await page(ctx, errors);
  await opened(p, id);
  return { p, id };
}
async function opened(p, id) {
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  await p.waitForSelector('[data-pmore]', { timeout: 60000 });
  if (await p.$('[data-repx]')) await p.click('[data-repx]');
}
// the download belongs to Grade 9 English and its Narrative essay (in Unit 1: Stories) for these checks, as one opened from the card
const asCard = p => p.evaluate(() => { const b = window.__mark.state().batch; b.classId = 'c1'; b.assignment = { id: 'i3', name: 'Narrative essay' }; });
const redraw = async p => { await p.click('[data-st="1"]'); await p.click('[data-st="0"]'); await p.waitForFunction(() => window.__mark.state().cur === 0); };
const listShown = p => p.$eval('.mk-list', e => getComputedStyle(e).visibility === 'visible' && e.getBoundingClientRect().right > 20);
const peeking = p => p.evaluate(() => 'mkpeek' in document.documentElement.dataset);

test('C-037 C-038 B-052 B-053 B-054 A-124 C-073 A-001 A-004 C-062: n of N marked, missing or excused, and the average are one button to Insights with the same average; Setup has the Gradebook, the unit plan and class page links and Bring back once something went out; Find has the rest', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const { p, id } = await both(ctx, errors, await standardFiles(), async m => {
    // two finished scores and one excused paper in the current app
    await m.evaluate(() => { const s = window.__gs.state(), n = (s.setup.criteria || []).length;
      s.batch.students.forEach((st, i) => { if (i < 2) st.grade.rubric = Array.from({ length: n }, (_, k) => (i === 0 ? 4 : 3) - (k % 2)); if (i === 3) st.grade.status = 'excused'; }); });
  });
  await asCard(p); await redraw(p);
  await p.waitForSelector('[data-prog] [data-avg]:not(.none)', { timeout: 30000 });
  const say = await p.$eval('[data-prog]', e => e.textContent);
  assert.match(say, /^2 of 3 marked1 missing or excusedAvg /, say);
  // C-037: the same average Insights gives, and the button opens it
  const avg = await p.$eval('[data-avg]', e => e.textContent.replace(/^Avg /, ''));
  await p.click('[data-prog]');
  await p.waitForFunction(id => location.hash === '#/mark/' + encodeURIComponent(id) + '/insights', { timeout: 10000 }, id);
  await p.waitForSelector('.mk-ins .tile', { timeout: 60000 });
  assert.ok(await p.$$eval('.mk-ins .tile', (l, a) => l.some(e => e.textContent.includes(a)), avg), 'Insights shows ' + avg);
  // A-004: Grade sheet and Consistency check from Find open their views
  assert.ok(await findOpen(p, 'Grade sheet')); await p.keyboard.press('Enter');
  // at the Grade sheet's own address (grades/sheet), and Consistency at insights/consistency
  await p.waitForFunction(id => location.hash === '#/mark/' + encodeURIComponent(id) + '/grades/sheet' && document.querySelector('[data-sheetpdf]'), { timeout: 30000 }, id);
  assert.ok(await findOpen(p, 'Consistency check')); await p.keyboard.press('Enter');
  await p.waitForFunction(() => /\/insights\/consistency$/.test(location.hash) && /Consistency/.test((document.querySelector('#mk-i-h') || {}).textContent || ''), { timeout: 30000 });
  // A-001, C-062 and Examples are in Find too
  for (const s of ['Bring back from your assistant', 'Add late work', 'Examples']) assert.ok(await findHas(p, s), s);
  await opened(p, id); await asCard(p); await redraw(p);
  // B-052, B-053, A-124, B-054: the Gradebook, and a way to link the unit plan and the class page; no Bring back yet
  let items = await menuText(p, '[data-setupopen]');
  for (const s of ['Gradebook', 'Link to a unit plan…', 'Link to the class page…']) assert.ok(items.includes(s), s + ' in ' + items.join(' | '));
  assert.ok(!items.some(x => /Bring back/.test(x)), 'no Bring back before anything went out');
  await menuPick(p, '[data-setupopen]', 'Link to a unit plan…');
  await p.waitForSelector('dialog[open] [data-ulok]', { timeout: 15000 });
  await p.type('dialog[open] input', 'planner.example.org/units/stories');
  await p.click('dialog[open] [data-ulok]'); await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  await menuPick(p, '[data-setupopen]', 'Link to the class page…');
  await p.waitForSelector('dialog[open] [data-clink-save]', { timeout: 15000 });
  await p.type('dialog[open] input', 'https://school.example.org/classes/g9');
  await p.click('dialog[open] [data-clink-save]'); await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  await p.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('gs.lib')); return l.classes[0].units[0].atlas && l.classes[0].mb; }, { timeout: 10000 });
  const lib = await p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));
  assert.equal(lib.classes[0].units[0].atlas, 'https://planner.example.org/units/stories');
  assert.equal(lib.classes[0].mb, 'https://school.example.org/classes/g9');
  // C-073: once papers went to her assistant, Bring back is in Setup and opens its box; the links are now the links
  await p.evaluate(() => { const b = window.__mark.state().batch; b.share = { ...(b.share || { codes: {}, boxes: {} }), made: Date.now() }; });
  await redraw(p);
  items = await menuText(p, '[data-setupopen]');
  for (const s of ['Unit plan', 'Class page', 'Bring back from your assistant']) assert.ok(items.includes(s), s + ' in ' + items.join(' | '));
  await menuPick(p, '[data-setupopen]', 'Bring back from your assistant');
  await p.waitForSelector('[data-bring] [data-bbtext]', { timeout: 30000 });
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  // B-052: Gradebook goes to the class gradebook
  await menuPick(p, '[data-setupopen]', 'Gradebook');
  await p.waitForFunction(() => location.hash === '#/class/c1/grades', { timeout: 10000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('A-125 A-094 A-102 A-115: full screen from the View toolbar and F; the student list steps aside as Settings says, comes back at the left edge, from the tab, with / and with [ until full screen ends', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const { p } = await both(ctx, errors, await standardFiles());
  assert.ok(await p.$('.mk-zoom [data-full]'), 'Full screen is in the View toolbar');
  await p.click('[data-full]');
  await p.waitForFunction(() => document.fullscreenElement === document.documentElement, { timeout: 10000 });
  await p.waitForFunction(() => document.documentElement.dataset.mkfs === 'hide');
  assert.equal(await p.$eval('[data-full]', b => b.getAttribute('aria-label')), 'Leave full screen');
  await p.waitForFunction(() => getComputedStyle(document.querySelector('.mk-list')).visibility === 'hidden');
  // A-102: the pointer resting at the left edge brings the list out over the paper; moving off it puts it away
  await p.mouse.move(700, 400); await p.mouse.move(3, 400);
  await p.waitForFunction(() => 'mkpeek' in document.documentElement.dataset, { timeout: 5000 });
  await p.waitForFunction(() => getComputedStyle(document.querySelector('.mk-list')).visibility === 'visible');
  await p.mouse.move(150, 400); await p.mouse.move(700, 400); await p.mouse.move(720, 420);
  await p.waitForFunction(() => !('mkpeek' in document.documentElement.dataset), { timeout: 5000 });
  // A-094: the tab at the left edge
  await p.$eval('[data-fstab]', b => b.click());
  assert.ok(await peeking(p));
  await p.mouse.move(700, 400); await p.mouse.move(720, 420);
  await p.waitForFunction(() => !('mkpeek' in document.documentElement.dataset), { timeout: 5000 });
  // A-115: a finger on the paper folds the list that came out over it (src/touch.js); a mouse press there does not
  await p.$eval('[data-fstab]', b => b.click());
  assert.ok(await peeking(p));
  await p.$eval('.mk-paper', e => e.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true })));
  await new Promise(r => setTimeout(r, 200)); assert.ok(await peeking(p), 'not by a mouse press');
  await p.$eval('.mk-paper', e => e.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true })));
  await p.waitForFunction(() => !('mkpeek' in document.documentElement.dataset), { timeout: 5000 });
  // / to find someone: the list comes out and its find box has the keyboard; leaving the box puts it away (Esc in full screen is the
  // browser's own, to leave full screen)
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('/');
  await p.waitForFunction(() => 'mkpeek' in document.documentElement.dataset && document.activeElement && document.activeElement.closest('.mk-find'), { timeout: 5000 });
  await p.evaluate(() => document.activeElement.blur());
  await p.waitForFunction(() => !('mkpeek' in document.documentElement.dataset), { timeout: 5000 });
  // [ keeps it beside the paper until full screen ends, and nothing is kept
  const kept = await p.evaluate(() => localStorage.getItem('gs.listOpen'));
  await p.keyboard.press('[');
  await p.waitForFunction(() => !document.documentElement.dataset.mkfs);
  assert.ok(await listShown(p));
  assert.equal(await p.evaluate(() => localStorage.getItem('gs.listOpen')), kept, '[ in full screen keeps nothing');
  await p.keyboard.press('[');
  await p.waitForFunction(() => document.documentElement.dataset.mkfs === 'hide');
  // F leaves full screen, and the list is where it was
  await p.keyboard.press('f');
  await p.waitForFunction(() => !document.fullscreenElement, { timeout: 10000 });
  await p.waitForFunction(() => !document.documentElement.dataset.mkfs);
  assert.ok(await listShown(p));
  // 'all' (Settings): the tool dock goes too, and shows while the pointer is near it
  await p.evaluate(() => localStorage.setItem('gs.fullSide', JSON.stringify('all')));
  await p.keyboard.press('f');
  await p.waitForFunction(() => document.documentElement.dataset.mkfs === 'all', { timeout: 10000 });
  assert.equal(await p.$eval('.mk-tools', e => getComputedStyle(e).opacity), '0');
  const mid = await p.$eval('.mk-mid', e => e.getBoundingClientRect().left);
  await p.mouse.move(mid + 300, 400); await p.mouse.move(mid + 30, 400);
  await p.waitForFunction(() => 'mktools' in document.documentElement.dataset, { timeout: 5000 });
  await p.keyboard.press('f');
  await p.waitForFunction(() => !document.fullscreenElement && !document.documentElement.dataset.mkfs, { timeout: 10000 });
  // 'show': both stay as they are
  await p.evaluate(() => localStorage.setItem('gs.fullSide', JSON.stringify('show')));
  await p.click('[data-full]');
  await p.waitForFunction(() => document.fullscreenElement === document.documentElement, { timeout: 10000 });
  assert.equal(await p.evaluate(() => document.documentElement.dataset.mkfs), undefined);
  assert.ok(await listShown(p));
  await p.keyboard.press('f');
  await p.waitForFunction(() => !document.fullscreenElement, { timeout: 10000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The current app's top bar and More menu, where the new app keeps them (A-116 A-118 A-121 A-126): What opened is in Setup (and the
// list's menu); where her work is saved and Reconnect are Find's Where your work is saved, in Settings > Saving; the × goes back to
// the class page
test('A-116 A-118 A-121 A-126: Setup has What opened; Find has Where your work is saved; the close button goes back to the class', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const { p, id } = await both(ctx, errors, await standardFiles());
  await menuPick(p, '[data-setupopen]', 'What opened');
  await p.waitForFunction(() => { const d = document.querySelector('dialog[open]'); return d && /What opened/.test(d.textContent); }, { timeout: 30000 });
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  assert.ok(await findOpen(p, 'Where your work is saved')); await p.keyboard.press('Enter');
  await p.waitForSelector('[data-svwhere]', { timeout: 30000 });
  assert.equal(await p.evaluate(() => location.hash), '#/settings/saving');
  await opened(p, id); await asCard(p); await redraw(p);
  await p.click('.mk-top [aria-label="Close marking"]');
  await p.waitForFunction(() => location.hash === '#/class/c1', { timeout: 30000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Find opened with Ctrl+K on the marking screen has the focus before the next key can arrive: a key pressed in the very next task
// goes into its box, not to the marking screen behind it.
test('Find takes the keys pressed the moment it opens', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const { p } = await both(ctx, errors, await standardFiles());
  await p.waitForSelector('.mk-top', { timeout: 60000 });
  const ready = await p.evaluate(() => new Promise(res => {
    document.activeElement && document.activeElement.blur();
    const at = document.activeElement || document.body;
    at.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true, cancelable: true }));
    // the next task: where a key pressed straight after Ctrl+K would go
    setTimeout(() => { const a = document.activeElement; res(!!a && a.matches('dialog.cmd[open] input')); }, 0);
  }));
  assert.ok(ready, 'the Find box has the focus by the next task');
  await p.keyboard.type('Where');
  assert.equal(await p.$eval('dialog.cmd[open] input', e => e.value), 'Where');
  await p.keyboard.press('Escape');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('H-061: a comment saved in another window shows in the comment box\'s saved comments at once', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const { p } = await both(ctx, errors, await standardFiles());
  await p.waitForSelector('.mk-cbank', { timeout: 30000 });
  assert.ok(!(await p.$$eval('[data-cbank]', l => l.map(e => e.title))).includes('Strong opening line.'));
  // another window of the app (the current app or the new one) saves a comment: this window hears it through the storage event
  const o = await ctx.newPage();
  await o.goto(srv.url + 'blank');
  await o.evaluate(() => { const b = JSON.parse(localStorage.getItem('gs.bank') || '[]'); localStorage.setItem('gs.bank', JSON.stringify(['Strong opening line.', ...b])); });
  // this window is behind the other one now, where requestAnimationFrame doesn't run: look on a timer, not on frames
  await p.waitForFunction(() => [...document.querySelectorAll('[data-cbank]')].some(e => e.title === 'Strong opening line.'), { timeout: 10000, polling: 250 });
  await o.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});
