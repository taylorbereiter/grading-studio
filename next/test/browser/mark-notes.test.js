// Typed notes and the Timer on the new app (stage 4, part d): made-up notes typed under the comment for a made-up student (a heading, a
// paragraph, a list, bold, a paste and a strength), the same keys in the current app making the same notes, Undo and Redo, headings for
// every student, given back or not, cleared with Undo, the Timer with + Time to comment and the asked-for length, and the current app
// opening what the new app saved. npm run next:browser. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip } = require('../../../test/helpers/app.js');
const { zipOf, makePaper } = require('../../../test/helpers/fixtures.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');

const ROOT = path.join(__dirname, '..', '..', '..');
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


let browser, srv, dir;
before(async () => { srv = await serveSite(); browser = await launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-notes-')); });
after(async () => { await browser.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
const withCard = () => { const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']); lib.classes[0].units[0].items.push({ id: 'i9', name: 'Speech', classId: 'c1', type: 'sum', due: '2026-11-20' }); seed.ls['gs.lib'] = JSON.stringify(lib); return seed; };
const twoZip = async () => zipOf({ 'Aria Testwell/Outline.pdf': await makePaper({ title: 'An outline' }), 'Bram Sample/Outline.pdf': await makePaper({ title: 'Another outline' }) });
const calm = p => p.evaluate(() => new Promise(r => setTimeout(r, 350)));
// an item of a menu by its words (ui Menu): the opener pressed, then the item. Typed notes and the Timer open from More for this paper (gaps C-057).
const menuPick = async (p, opener, label) => { await p.waitForSelector(opener, { timeout: 60000 }); await p.click(opener); await p.waitForSelector('.pop [role^="menuitem"]');
  const ok = await p.evaluate(l => { const it = [...document.querySelectorAll('.pop [role^="menuitem"]')].find(e => (e.querySelector('b') || e).textContent.trim() === l); if (it) it.click(); return !!it; }, label);
  if (!ok) throw new Error('no menu item ' + label); };
const keys = async (p, mods, key) => { for (const m of mods) await p.keyboard.down(m); await p.keyboard.press(key); for (const m of mods.slice().reverse()) await p.keyboard.up(m); };
const paste = (p, data) => p.evaluate(data => { const d = new DataTransfer(); for (const [k, v] of Object.entries(data)) d.setData(k, v); document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: d, bubbles: true, cancelable: true })); }, data);
// A menu item on the notes' bar: from its own menu where the bar shows it, else from the ⋯.
const fromMenu = async (p, at, own, item) => {
  const btn = await p.evaluate((at, own) => { const b = document.querySelector(at + ' ' + own); return b && b.checkVisibility() ? at + ' ' + own : at + ' .kdots'; }, at, own);
  for (let i = 0; i < 5; i++) {
    await p.click(btn);
    if (await p.waitForFunction((at, item) => [...document.querySelectorAll(at + ' ' + item)].some(e => e.checkVisibility()), { timeout: 2000 }, at, item).then(() => true, () => false)) break;
  }
  await p.evaluate((at, item) => [...document.querySelectorAll(at + ' ' + item)].find(e => e.checkVisibility()).click(), at, item);
};
// The same notes typed in either app, at = where its notes are: a heading, a paragraph, a list, bold, a paste, a strength.
async function typeNotes(p, at) {
  await p.click(at + ' .tned');
  await p.keyboard.type('Clear thesis'); await keys(p, ['Control', 'Alt'], 'Digit1'); await calm(p);
  await p.keyboard.press('End'); await p.keyboard.press('Enter');
  await p.keyboard.type('Strong opening'); await p.keyboard.press('Enter');
  await p.keyboard.type('- one point'); await p.keyboard.press('Enter');
  await p.keyboard.type('two'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
  await keys(p, ['Control'], 'b'); await p.keyboard.type('Bold'); await keys(p, ['Control'], 'b'); await p.keyboard.type(' then plain'); await calm(p);
  await p.keyboard.press('Enter');
  await paste(p, { 'text/html': '<p>Pasted <i>words</i></p><ul><li>and a list</li></ul>', 'text/plain': 'Pasted words\nand a list' }); await calm(p);
  await p.click(at + ' .tned > .tnp:nth-child(2)'); await p.keyboard.press('End');
  await fromMenu(p, at, '.tnmk', '[data-tnmk="p"]'); await calm(p);
}
const tnOf = (p, app, i) => p.evaluate((app, i) => { const s = app === 'next' ? window.__mark.state() : window.__gs.state(), tn = s.batch.students[i].grade.tn; return tn ? JSON.parse(JSON.stringify(tn)) : null; }, app, i);

test('typed notes: the same keys make the same notes as the current app, each change one undo step, headings for everyone, given back or not, cleared with Undo, and the Timer; the current app opens them', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  const z = path.join(dir, 'Speech.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  await p.waitForSelector('[data-pmore]', { timeout: 60000 });
  assert.equal(await p.$('[data-tnopen]'), null, 'closed until she opens it');
  await menuPick(p, '[data-pmore]', 'Typed notes');
  await p.waitForSelector('.mk-tn .tn .tned');
  assert.equal(await p.$eval('[data-tnopen]', e => e.getAttribute('aria-expanded')), 'true');
  await calm(p);
  await typeNotes(p, '.mk-tn');
  if (process.env.GS_SHOTS) await p.screenshot({ path: path.join(process.env.GS_SHOTS, 'mark-notes.png') });
  const mine = await tnOf(p, 'next', 0);
  assert.ok(mine && mine.l.length >= 6, 'notes kept on her grade');

  // Ctrl Z in the notes takes back the strength; Ctrl Y puts it back
  await keys(p, ['Control'], 'z'); await calm(p);
  assert.equal((await tnOf(p, 'next', 0)).l[1].k, undefined, 'Undo took the strength back');
  await keys(p, ['Control'], 'y'); await calm(p);
  assert.deepEqual(await tnOf(p, 'next', 0), mine, 'and Redo put it back');

  // the current app, the same keys on its own download: the same notes
  const ctx2 = await browser.createBrowserContext(), c = await page(ctx2, errors);   // its own browser: the new app holds this one's work
  await c.goto(srv.url + 'blank'); await plant(c, withCard());
  await c.goto(srv.url); await appReady(c);
  await openZip(c, await twoZip(), 'Speech.zip');
  await c.evaluate(() => window.__gs.spOpen('typed'));
  await c.waitForSelector('#spBody .tn .tned'); await calm(c);
  await typeNotes(c, '#spBody');
  assert.deepEqual(await tnOf(c, 'gs', 0), mine, 'the same notes from the same keys in both apps');
  await ctx2.close();

  // Copy text in the notes' bar: the notes on the clipboard in one press
  await p.evaluate(() => { window.__copied = []; navigator.clipboard.writeText = async s => { window.__copied.push(s); }; });
  await p.click('.mk-tn [data-tncopy]');
  await p.waitForFunction(() => window.__copied.length === 1);
  assert.match(await p.evaluate(() => window.__copied[0]), /Clear thesis/, 'the notes copied');
  // Use these headings for every student: Bram, with no notes, starts with them
  await fromMenu(p, '.mk-tn', '.nothere', '[data-tnm="head"]');
  await p.waitForFunction(() => JSON.stringify(window.__mark.state().setup.tnHead) === '["Clear thesis"]');
  // Give these notes back with the paper: off, then on again
  await p.click('.mk-tn [data-tnback]');
  await p.waitForFunction(() => window.__mark.state().setup.tnBack === false);
  await p.click('.mk-tn [data-tnback]');
  await p.waitForFunction(() => !('tnBack' in window.__mark.state().setup));
  await p.click('[data-st="1"]');
  await p.waitForFunction(() => window.__mark.state().cur === 1 && window.__mark.ready, { timeout: 60000 });
  await p.waitForFunction(() => { const e = document.querySelector('.mk-tn .tned'); return e && e.firstChild && e.firstChild.textContent === 'Clear thesis' && e.firstChild.dataset.k === 'h'; }, { timeout: 30000 });
  assert.equal(await tnOf(p, 'next', 1), null, 'nothing kept for Bram until he has words');
  // the Timer: started, + Time to comment, and the asked-for length
  await p.evaluate(() => { const t0 = Date.now(), p0 = performance.now(); Date.now = () => t0 + Math.round(performance.now() - p0); });   // the clock runs again for the Timer
  await menuPick(p, '[data-pmore]', 'Timer'); await p.waitForSelector('[data-tmgo]');
  await p.click('[data-tmgo]');
  await p.waitForFunction(() => /^0:0[1-9]$/.test(document.querySelector('[data-tmclock]').textContent), { timeout: 10000 });
  await p.click('[data-tmgo]');
  await p.click('[data-tmstamp]');
  await p.waitForFunction(() => /^\[0:0[1-9]\] $/.test(window.__mark.state().batch.students[1].grade.comment || ''));
  await p.click('[data-tmtalk="0"]'); await p.keyboard.type('3'); await p.keyboard.press('Tab');
  await p.waitForFunction(() => JSON.stringify(window.__mark.state().setup.talk) === '[3,null]' && document.querySelector('[data-tmhow="under"]'));

  // back to Aria: Clear this student's notes goes at once, and Undo brings them back
  await p.click('[data-st="0"]');
  await p.waitForFunction(() => window.__mark.state().cur === 0 && window.__mark.ready && document.querySelector('.mk-tn .tned'), { timeout: 60000 });
  await fromMenu(p, '.mk-tn', '.nothere', '[data-tnm="clear"]');
  await p.waitForFunction(() => !window.__mark.state().batch.students[0].grade.tn);
  await p.waitForSelector('[data-undo]');
  await p.click('[data-undo]');
  await p.waitForFunction(() => !!window.__mark.state().batch.students[0].grade.tn);
  assert.deepEqual(await tnOf(p, 'next', 0), mine, 'Undo brought them back');

  await p.evaluate(() => window.__mark.saved());
  const setup = await p.evaluate(() => { const s = window.__mark.state().setup; return { tnHead: s.tnHead, talk: s.talk }; });
  await p.close();
  // the current app opens the same notes, comment and setup
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  assert.deepEqual(await tnOf(m, 'gs', 0), mine, 'the current app opens the same notes');
  assert.match(await m.evaluate(() => window.__gs.state().batch.students[1].grade.comment), /^\[0:0[1-9]\] $/);
  assert.deepEqual(await m.evaluate(() => { const s = window.__gs.state().setup; return { tnHead: s.tnHead, talk: s.talk }; }), setup, 'and the same headings and asked-for length');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('typed notes: a saved comment goes in where the caret was', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.evaluate(() => localStorage.setItem('gs.bank', JSON.stringify(['Speak a little slower.', 'Good eye contact.'])));
  const z = path.join(dir, 'Speech.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  await menuPick(p, '[data-pmore]', 'Typed notes'); await p.waitForSelector('.mk-tn .tn .tned');
  await p.click('.mk-tn .tned'); await p.keyboard.type('Opening: '); await calm(p);
  await p.click('[data-tnbank]'); await p.waitForSelector('.pop [role="menuitem"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(b => /Good eye/.test(b.textContent)).click());
  await calm(p);
  assert.equal((await tnOf(p, 'next', 0)).l[0].s, 'Opening: Good eye contact.');
  assert.deepEqual(errors, []);
  await ctx.close();
});
