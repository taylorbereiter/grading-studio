// Splitting a scan on the new app (stage 4, part d): a made-up scan split onto names from the class page, its pages read, turned,
// straightened and flagged as they come, Put back kept, blank pages left out after she sees them, a page flagged for a rescan and the
// whole scan's lighting, the same students, turns, straightening and lighting as the current app makes from the same scan and picks;
// the strip above a turned page with Put back and Undo; a makeup scan split into an open download; the flag in a page's corner and
// Rescans; and the current app opens what the new app saved. npm run next:browser. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, pickFile } = require('../../../test/helpers/app.js');
const { zipOf, makePaper } = require('../../../test/helpers/fixtures.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { PAGE_SRC } = require('../../../test/helpers/scans.js');

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

let browser, srv, dir, SCAN;
// the made-up scan, drawn in the current app's page (its PDF library is there)
before(async () => {
  srv = await serveSite(); browser = await launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-scan-'));
  const c = await browser.createBrowserContext(), q = await c.newPage(); await q.evaluateOnNewDocument(STEADY);
  await q.goto(srv.url); await appReady(q); SCAN = await scanPdf(q, SPECS); await c.close();
});
after(async () => { await browser.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
const scanPdf = async (p, specs) => { await p.evaluate(PAGE_SRC); return Buffer.from(await p.evaluate(sp => window.gsScan.pdf(sp), specs), 'base64'); };
const withCard = () => { const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']); lib.classes[0].units[0].items.push({ id: 'i9', name: 'Book review', classId: 'c1', type: 'sum', due: '2026-11-20' }); seed.ls['gs.lib'] = JSON.stringify(lib); return seed; };
// What came out for each student: their files' turns, straightening and what was read (a typed page's reading isn't saved, as in the
// current app: it is read again), the download's lighting and class.
const OUT = `b => JSON.parse(JSON.stringify({ students: b.students.filter(s => s.files.length).map(s => ({ key: s.key, files: s.files.map(f => ({ rot: f.rot || {}, skew: f.skew || {}, sc: Object.fromEntries(Object.entries(f.sc || {}).filter(([, r]) => !(r.typed && !r.re && !r.w))) })) })).sort((a, z) => a.key < z.key ? -1 : 1),
  light: b.light || null, lightPg: b.lightPg || null, on: !!(b.lightOpt && b.lightOpt.on), cls: b.classId == null ? null : b.classId }))`;
const SPECS = [{ seed: 21 }, { o: 180, seed: 22, box: true }, { blank: 'speckled', seed: 23 }, { wear: 'faint', seed: 24 }, { skew: 3, seed: 25 }, { o: 180, seed: 26 }];

test('D-014 D-015: a scan split from the class page: pages read and fixed as they come, picks given to names, and the same papers as the current app makes', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  const bytes = SCAN, file = path.join(dir, 'Everyone.pdf'); fs.writeFileSync(file, bytes);
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(b => /scan to split/.test(b.textContent)).click())]);
  await chooser.accept([file]);
  await p.waitForSelector('.mk-split');
  await p.waitForFunction(() => window.__split && Object.keys(window.__split().sc).length === 6 && window.__split().thumbs.filter(Boolean).length === 6, { timeout: 90000 });
  const tag = i => p.$eval('.mk-split [data-fl="' + i + '"]', e => e.textContent);
  assert.match(await tag(1), /Turned/); assert.match(await tag(2), /Looks blank/); assert.match(await tag(3), /Faint/); assert.match(await tag(4), /Straightened/);
  assert.equal(await tag(0), '');
  assert.match(await p.$eval('[data-spstat]', e => e.textContent), /2 pages turned, 1 straightened, 1 looks blank, 1 looks faint/);
  // she puts the last page back, and leaves out the blank page once she has seen it
  await p.click('.mk-split [data-fl="5"] [data-spfix="back"]');
  await p.waitForFunction(() => !window.__split().rot[5] && window.__split().thumbs[5]);
  // D-015: Escape closes only the blank pages view, and the split stays open
  await p.click('[data-spblank]');
  await p.waitForSelector('[data-spblankview]', { timeout: 60000 });
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('[data-spblankview]'));
  assert.ok(await p.$('.mk-split'), 'D-015: Escape closes the blank pages view, not the split');
  await p.click('[data-spblank]');
  await p.waitForFunction(() => /^Leave out 1 page$/.test((document.querySelector('[data-bkgo]') || {}).textContent || ''), { timeout: 60000 });
  assert.deepEqual(await p.$$eval('[data-bk]', es => es.map(e => +e.dataset.bk)), [2]);
  await p.click('[data-bkgo]');
  await p.waitForFunction(() => !document.querySelector('[data-spblankview]') && window.__split().skip.has(2));
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  const pick = async list => { await p.click('[data-spg="' + list[0] + '"] .spf'); await p.keyboard.down(mod); for (const i of list.slice(1)) await p.click('[data-spg="' + i + '"] .spf'); await p.keyboard.up(mod); };
  const nameAt = nm => p.evaluate(nm => window.__split().names.indexOf(nm), nm);
  // pages 1 and 2 to Aria, by clicking her name; page 5 flagged for a rescan; 4 to 6 to Bram, by typing his name
  await pick([0, 1]); await p.click('[data-spn="' + await nameAt('Aria Testwell') + '"]');
  await pick([4]); await p.click('[data-spre]');
  assert.match(await tag(4), /Needs rescan/);
  await pick([3, 4, 5]); await p.type('[data-spfind]', 'bra'); await p.keyboard.press('Enter');
  assert.match(await p.$eval('[data-spfoot]', e => e.textContent), /^2 students · 5 of 6 pages given · 1 page needs a rescan/);
  // the whole scan's lighting, kept for grading
  const was = await p.evaluate(() => window.__split().thumbs[0]);
  await p.click('[data-splight]');
  await p.waitForSelector('[data-splightp]');
  await p.$eval('[data-splightp] [data-spl="c"]', e => { e.value = 150; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForFunction(b => window.__split().thumbs[0] !== b, { timeout: 30000 }, was);
  assert.match(await tag(0), /Lighting/);
  if (process.env.GS_SHOTS) await p.screenshot({ path: path.join(process.env.GS_SHOTS, 'split.png') });
  await p.keyboard.press('Escape');
  assert.equal(await p.$('[data-splightp]'), null, 'D-014: Escape closes the lighting first');
  assert.ok(await p.$('.mk-split'), 'and not the split');
  await p.click('[data-spgo]');
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 90000 });
  await p.waitForFunction(() => { const b = window.__mark.state().batch; return b.light && b.light['*']; }, { timeout: 30000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id), now = await p.evaluate(o => eval(o)(window.__mark.state().batch), OUT);
  assert.equal(now.students.length, 2);
  assert.deepEqual(now.students[0].files[0].rot, { 1: 180 }, 'the second page of Aria’s file is turned');
  assert.equal(now.students[1].files[0].sc[1].re, 1, 'Bram’s second page waits on a rescan');
  assert.equal(now.light['*'].c, 150, 'the lighting is the download’s');
  // the strip above Aria's turned page: Put back turns it back, Undo turns it again
  const ai = await p.evaluate(() => window.__mark.state().batch.students.findIndex(s => s.key === 'Aria Testwell'));
  await p.click('[data-st="' + ai + '"]');
  await p.waitForFunction(() => { const n = window.__mark.ready && document.querySelectorAll('.mk-scnote'); return n && [...n].some(x => /Turned this page/.test(x.textContent)); }, { timeout: 60000 });
  await p.evaluate(() => [...document.querySelectorAll('.mk-scnote')].find(x => /Turned this page/.test(x.textContent)).querySelector('[data-sc="back"]').click());
  await p.waitForFunction(i => !(window.__mark.state().batch.students[i].files[0].rot || {})[1], {}, ai);
  await p.evaluate(() => document.querySelector('.mk-paper').focus());
  await p.keyboard.down(mod); await p.keyboard.press('z'); await p.keyboard.up(mod);
  await p.waitForFunction(i => (window.__mark.state().batch.students[i].files[0].rot || {})[1] === 180, {}, ai);
  await p.evaluate(() => window.__mark.saved());
  const left = await p.evaluate(o => eval(o)(window.__mark.state().batch), OUT);
  assert.deepEqual(left.students[0].files[0].sc[1].off, { turn: 1 }, 'Put back is kept, as the current app keeps it');
  await p.close();
  // the current app opens what the new app saved
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  const kept = await m.evaluate(o => eval(o)(window.__gs.state().batch), OUT);
  await m.close();
  // the current app's own split of the same scan, with the same picks, makes the same papers
  const ctx2 = await browser.createBrowserContext();
  const c = await page(ctx2, errors);
  await c.goto(srv.url + 'blank'); await plant(c, withCard());
  await c.goto(srv.url); await appReady(c);
  const done = await pickFile(c, '#scanIn', bytes, 'Everyone.pdf');
  await c.waitForSelector('#spPages');
  await c.waitForFunction(() => Object.keys(window.__gs.sp().sc).length === 6 && window.__gs.sp().thumbs.filter(Boolean).length === 6, { timeout: 90000 });
  await c.click('#spPages [data-fl="5"] [data-spfix="back"]');
  await c.click('#spBlank'); await c.waitForSelector('#spBlankView');
  await c.waitForFunction(() => /^Leave out \d+ page/.test(document.querySelector('#spBlankGo').textContent), { timeout: 60000 });
  await c.click('#spBlankGo');
  const pickC = async list => { await c.click('#spPages [data-spg="' + list[0] + '"] .spf'); await c.keyboard.down(mod); for (const i of list.slice(1)) await c.click('#spPages [data-spg="' + i + '"] .spf'); await c.keyboard.up(mod); };
  const nameC = nm => c.evaluate(nm => window.__gs.sp().names.indexOf(nm), nm);
  await pickC([0, 1]); await c.click('#spNames [data-spn="' + await nameC('Aria Testwell') + '"]');
  await pickC([4]); await c.click('#spRe');
  await pickC([3, 4, 5]); await c.click('#spNames [data-spn="' + await nameC('Bram Sample') + '"]');
  await c.click('#spLight');
  await c.click('#spLightP [data-spls="all"]');
  await c.$eval('#spLightP [data-spl="c"]', e => { e.value = 150; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await c.keyboard.press('Escape');
  await c.click('#spGo');
  await c.waitForFunction(() => { const s = window.__gs.state(); return s.batch && s.batch.students.filter(x => x.files.length).length === 2 && s.batch.light && s.batch.light['*']; }, { timeout: 90000 });
  const theirs = await c.evaluate(o => eval(o)(window.__gs.state().batch), OUT);
  done();
  assert.deepEqual(now, theirs, 'the same papers, turns, straightening, flags and lighting as the current app makes');
  assert.deepEqual(kept, left, 'and the current app opens them as the new app left them');
  assert.deepEqual(errors, []);
  await ctx.close(); await ctx2.close();
});

test('a makeup scan split into an open download, the flag in a page’s corner and Rescans, and the current app opens the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  // the store for files added to a student, as the current app makes it the first time a download opens there (the new app never
  // makes the current app's databases: shared/idb.js)
  await p.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-added', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => { r.result.close(); res(); }; }));
  const z = path.join(dir, 'Book review.zip'); fs.writeFileSync(z, zipOf({ 'Aria Testwell/Essay.pdf': await makePaper({ title: 'An essay' }), 'Bram Sample/Essay.pdf': await makePaper({ title: 'Another essay' }) }));
  const scan = path.join(dir, 'Makeup.pdf'); fs.writeFileSync(scan, await makePaper({ title: 'Makeup day', pages: 2 }));
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  let [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  // Add, A scan to split…: page 1 to Cleo, who missed the day and isn't in the download yet; page 2 to Aria, with its own lighting
  await p.waitForSelector('[data-addmenu]', { timeout: 60000 });
  await p.waitForFunction(() => { if (document.querySelector('.pop [role="menuitem"]')) return true; const b = document.querySelector('[data-addmenu]'); if (b) b.click(); return false; }, { timeout: 30000, polling: 500 });
  [chooser] = await Promise.all([p.waitForFileChooser(), p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(b => /scan to split/.test(b.textContent)).click())]);
  await chooser.accept([scan]);
  await p.waitForSelector('.mk-split');
  await p.waitForFunction(() => window.__split && window.__split().thumbs.filter(Boolean).length === 2, { timeout: 60000 });
  assert.match(await p.$eval('[data-spgo]', e => e.textContent), /Add to this download/);
  const nameAt = nm => p.evaluate(nm => window.__split().names.indexOf(nm), nm);
  await p.click('[data-spg="0"] .spf'); await p.click('[data-spn="' + await nameAt('Cleo Fixture') + '"]');
  await p.click('[data-spg="1"] .spf');
  await p.click('[data-splight]'); await p.waitForSelector('[data-splightp]');
  await p.click('[data-splightp] [data-v="sel"]');
  await p.$eval('[data-splightp] [data-spl="d"]', e => { e.value = 30; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.keyboard.press('Escape');
  await p.click('[data-spn="' + await nameAt('Aria Testwell') + '"]');
  await p.click('[data-spgo]');
  await p.waitForFunction(() => !document.querySelector('.mk-split') && window.__mark.state().batch.students.some(s => s.key === 'Cleo Fixture' && s.files.length) && window.__mark.ready, { timeout: 60000 });
  const aria = await p.evaluate(() => window.__mark.state().batch.students.find(s => s.key === 'Aria Testwell').files.length);
  assert.equal(aria, 2, 'Aria’s page added to her as a file of its own');
  // the ⚑ in a page's corner flags it; the strip says so, and Rescans lists her
  const ci = await p.evaluate(() => window.__mark.state().batch.students.findIndex(s => s.key === 'Cleo Fixture'));
  await p.click('[data-st="' + ci + '"]');
  await p.waitForFunction(i => window.__mark.state().cur === i && window.__mark.ready && document.querySelector('canvas[data-page]'), { timeout: 60000 }, ci);
  await p.evaluate(() => document.querySelector('[data-pgre]').click());
  await p.waitForFunction(() => { const n = document.querySelector('.mk-scnote.re'); return n && /needs a rescan/.test(n.textContent); }, { timeout: 30000 });
  await p.evaluate(() => document.querySelector('[data-rescans]').click());
  await p.waitForSelector('[data-rsgo]');
  assert.deepEqual(await p.$$eval('[data-rsgo]', e => e.map(x => x.textContent)), ['Cleo Fixturep. 1']);
  await p.keyboard.press('Escape');
  await p.evaluate(() => window.__mark.saved());
  const now = await p.evaluate(o => eval(o)(window.__mark.state().batch), OUT);
  await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id && s.batch.students.some(x => x.key === 'Cleo Fixture'); }, { timeout: 60000 }, id);
  const was = await m.evaluate(o => eval(o)(window.__gs.state().batch), OUT);
  assert.deepEqual(was, now, 'the current app opens the same students, files, flag and lighting');
  assert.equal(await m.evaluate(() => window.__gs.scanRescans().length), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});
