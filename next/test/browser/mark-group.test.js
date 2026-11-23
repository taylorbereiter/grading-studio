// Group work on the new app (stage 4, part d): Group work… on a made-up student's file gives a made-up partner a copy and makes a group,
// the band above the paper changes how the group is graded (Undo, Redo), Both or Just them, Grade on their own at once with Undo, and
// the current app opens what the new app saved. npm run next:browser. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip } = require('../../../test/helpers/app.js');
const { zipOf, makePaper } = require('../../../test/helpers/fixtures.js');
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
before(async () => { srv = await serveSite(); browser = await launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-group-')); });
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
const groups = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__mark.state().batch.groups || [])));
const pickMode = async (p, v) => { await p.select('[data-grpmode]', v); };

// an item of a menu by its words (ui Menu): the opener pressed, then the item. Typed notes and the Timer open from More for this paper (gaps C-057).
const menuPick = async (p, opener, label) => { await p.waitForSelector(opener, { timeout: 60000 }); await p.click(opener); await p.waitForSelector('.pop [role^="menuitem"]');
  const ok = await p.evaluate(l => { const it = [...document.querySelectorAll('.pop [role^="menuitem"]')].find(e => (e.querySelector('b') || e).textContent.trim() === l); if (it) it.click(); return !!it; }, label);
  if (!ok) throw new Error('no menu item ' + label); };

test('group work: Group work… gives a partner a copy and makes a group, the band changes how it is graded with Undo and Redo, Just them, Grade on their own with Undo; the current app opens the same group', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  // the current app's store for added files, as a browser that has run it has
  await p.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-added', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => { r.result.close(); res(); }; }));
  const z = path.join(dir, 'Speech.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  const aria = await p.evaluate(() => window.__mark.state().batch.students[0].key);
  const fpath = await p.evaluate(() => window.__mark.state().batch.students[0].files[0].path);
  assert.equal(await p.$('[data-grpband]'), null, 'no band before a group');

  // Group work… on Aria's file: Bram gets a copy and joins her group
  await p.waitForSelector(`[data-fmenu="${fpath}"]`, { timeout: 60000 });
  await p.click(`[data-fmenu="${fpath}"]`);
  await p.waitForFunction(() => [...document.querySelectorAll('.pop [role="menuitem"]')].some(e => /Group work/.test(e.textContent)));
  await p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => /Group work/.test(e.textContent)).click());
  await p.waitForSelector('dialog[open] input[data-grpfind]');
  const bram = await p.evaluate(() => window.__mark.state().batch.students.find(s => /Bram/.test(s.key)).key);
  await p.type('dialog[open] input[data-grpfind]', 'bra');
  await p.waitForSelector(`dialog[open] [data-grpto="${bram}"]`);
  await p.click(`dialog[open] [data-grpto="${bram}"]`);
  await p.waitForFunction((a, b) => { const g = window.__mark.state().batch.groups || []; return g.length === 1 && g[0].k.includes(a) && g[0].k.includes(b); }, { timeout: 30000 }, aria, bram);
  await p.waitForFunction(b => window.__mark.state().batch.students.find(s => s.key === b).files.some(f => f.from), {}, bram);
  await p.click('dialog[open] [data-grpdone]');
  await p.waitForSelector('[data-grpband]', { timeout: 30000 });
  assert.match(await p.$eval('[data-grpband]', e => e.textContent), /Bram/, 'the band names who she works with');

  // a score given on Aria's paper is the group's
  const g1 = await groups(p);
  await pickMode(p, '1');
  await p.waitForFunction(() => window.__mark.state().batch.groups[0].own === true || window.__mark.state().batch.groups[0].own === 1);
  await p.waitForSelector('[data-undo]');
  await p.click('[data-undo]');
  await p.waitForFunction(() => !window.__mark.state().batch.groups[0].own);
  assert.deepEqual(await groups(p), g1, 'Undo put the group back as it was');
  await p.keyboard.down('Control'); await p.keyboard.press('y'); await p.keyboard.up('Control');
  await p.waitForFunction(() => !!window.__mark.state().batch.groups[0].own);
  // Own scores: what's done now goes to Both or Just Aria
  await p.waitForFunction(() => [...document.querySelectorAll('[data-grpband] button, [data-grpband] [role="radio"]')].some(e => /^Just /.test(e.textContent.trim())));
  await p.evaluate(() => [...document.querySelectorAll('[data-grpband] button, [data-grpband] [role="radio"]')].find(e => /^Just /.test(e.textContent.trim())).click());
  await p.waitForFunction(() => [...document.querySelectorAll('[data-grpband] [aria-checked="true"], [data-grpband] [aria-pressed="true"]')].some(e => /^Just /.test(e.textContent.trim())));
  // a typed paragraph written now is just for Aria
  await menuPick(p, '[data-pmore]', 'Typed notes'); await p.waitForSelector('.mk-tn .tn .tned');
  await p.evaluate(() => new Promise(r => setTimeout(r, 350)));
  await p.click('.mk-tn .tned'); await p.keyboard.type('Only for her');
  await p.waitForFunction(a => { const tn = window.__mark.state().batch.students[0].grade.tn; return tn && tn.l.some(x => x.s === 'Only for her' && x.o === a); }, { timeout: 10000 }, aria);
  const bare = gs => gs.map(({ k, p, own }) => ({ k, p, own })), own = bare(await groups(p));

  // Grade on their own: at once, with Undo, and the toast says so (H-041, src/groups.js groupLeave)
  await p.click('[data-grpout]');
  await p.waitForFunction(() => !(window.__mark.state().batch.groups || []).length);
  await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(e => / is graded on their own now/.test(e.textContent)), { timeout: 10000 });
  await p.waitForFunction(() => !document.querySelector('[data-grpband]'));
  await p.waitForSelector('[data-undo]');
  await p.click('[data-undo]');
  await p.waitForFunction(() => (window.__mark.state().batch.groups || []).length === 1);
  assert.deepEqual(bare(await groups(p)), own, 'Undo put her back in the group');
  await p.waitForSelector('[data-grpband]');

  await p.evaluate(() => window.__mark.saved());
  const last = await groups(p);
  const kept = await p.evaluate(b => { const s = window.__mark.state().batch.students.find(x => x.key === b); return s.files.map(f => ({ name: f.name, from: f.from || null })); }, bram);
  await p.close();
  // the current app opens the same group and Bram's copy
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  assert.deepEqual(await m.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().batch.groups || []))), last, 'the current app opens the same group');
  assert.deepEqual(await m.evaluate(b => window.__gs.state().batch.students.find(x => x.key === b).files.map(f => ({ name: f.name, from: f.from || null })), bram), kept, 'and the same copy for Bram');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Setup > Partners and videos: a link pasted for one student, a partner picked, their own scores; Save makes the group as one step, Undo takes it off, and the current app opens the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-added', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => { r.result.close(); res(); }; }));
  const z = path.join(dir, 'Talk.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  const [aria, bram] = await p.evaluate(() => window.__mark.state().batch.students.map(s => s.key));
  await p.waitForSelector('[data-setupopen]:not([disabled])');
  await p.click('[data-setupopen]');
  await p.waitForFunction(() => [...document.querySelectorAll('.pop [role="menuitem"]')].some(e => /Partners and videos/.test(e.textContent)));
  await p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => /Partners and videos/.test(e.textContent)).click());
  await p.waitForSelector('dialog[open] [data-pv]');
  assert.equal(await p.$eval('[data-pvgo]', e => e.disabled), true, 'nothing to save yet');
  await p.type('[data-pvlink="0"]', 'https://www.youtube.com/watch?v=abcdefghijk');
  await p.click('[data-pvp="0"]');
  await p.waitForSelector(`[data-pvto="${bram}"]`);
  await p.click(`[data-pvto="${bram}"]`);
  await p.click('[data-pvdone]');
  assert.match(await p.$eval(`[data-pvrow="${bram}"]`, e => e.textContent), new RegExp('Same video as: ' + aria));
  assert.match(await p.$eval(`[data-pvrow="${aria}"] [data-pvp]`, e => e.textContent), new RegExp('With: ' + bram));
  await p.evaluate(() => [...document.querySelectorAll('dialog[open] [data-pv] .seg button, dialog[open] [data-pv] [role="radio"]')].find(b => /Their own scores/.test(b.textContent)).click());
  await p.click('[data-pvgo]');
  await p.waitForFunction((a, b) => { const g = window.__mark.state().batch.groups || []; return g.length === 1 && g[0].k[0] === a && g[0].k.includes(b) && g[0].own; }, { timeout: 30000 }, aria, bram);
  const files = await p.evaluate(() => window.__mark.state().batch.students.slice(0, 2).map(s => s.files.filter(f => f.kind === 'link').map(f => ({ name: f.name, from: f.from || '' }))));
  assert.deepEqual(files, [[{ name: 'Presentation video.url', from: '' }], [{ name: 'Presentation video.url', from: aria }]], 'the partner gets a copy of the link');
  await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(e => /Saved 1 group or video/.test(e.textContent)));
  const made = await groups(p);
  // one step: Undo takes the group off (the files stay, as added files do)
  await p.click('[data-undo]');
  await p.waitForFunction(() => !(window.__mark.state().batch.groups || []).length);
  await p.click('[data-redo]');
  await p.waitForFunction(() => (window.__mark.state().batch.groups || []).length === 1);
  assert.deepEqual(await groups(p), made);
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  assert.deepEqual(await m.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().batch.groups || []))), made);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// D-037: Add, A video… has Partners: a find box and everyone else in the video ticked. They get the video and the notes page, and one
// set of marks and one grade covers the group, as the current app makes it.
test('D-037: Add, A video with a partner ticked: the partner gets the video and the notes page, one group; the current app opens the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-added', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => { r.result.close(); res(); }; }));
  const z = path.join(dir, 'Talk2.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  const [aria, bram] = await p.evaluate(() => window.__mark.state().batch.students.map(s => s.key));
  await p.click('[data-st="0"]');
  await p.waitForFunction(() => window.__mark.state().cur === 0 && window.__mark.ready, { timeout: 60000 });
  await p.waitForFunction(() => { const it = [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => /video or recording/.test(e.textContent)); if (it) { it.click(); return true; } const b = document.querySelector('[data-addmenu]'); if (b && !document.querySelector('.pop')) b.click(); return false; }, { timeout: 30000, polling: 500 });
  await p.waitForSelector('dialog[open] [data-vdadd]');
  await p.waitForFunction(() => { const e = document.querySelector('input[data-vdlink]'); if (e) e.focus(); return e && document.activeElement === e; });
  await p.keyboard.type('https://www.youtube.com/watch?v=abcdefghijk');
  await p.waitForFunction(() => !document.querySelector('[data-vdadd]').disabled);
  // the find box narrows the list by the start of a word
  await p.focus('input[data-vdfind]'); await p.keyboard.type(bram.split(' ')[0].slice(0, 3).toLowerCase());
  await p.waitForFunction(b => [...document.querySelectorAll('[data-vdto]')].some(e => e.dataset.vdto === b), {}, bram);
  await p.click(`[data-vdto="${bram}"]`);
  assert.equal(await p.$eval(`[data-vdto="${bram}"]`, e => e.getAttribute('aria-checked')), 'true');
  assert.equal(await p.$eval('[data-vdadd]', e => e.textContent), 'Add to ' + aria + ' and 1 partner');
  await p.click('dialog[open] [data-np="lined"]');
  await p.click('[data-vdadd]');
  await p.waitForFunction((a, b) => { const g = window.__mark.state().batch.groups || []; return g.length === 1 && g[0].k[0] === a && g[0].k.includes(b); }, { timeout: 60000 }, aria, bram);
  const theirs = await p.evaluate(b => window.__mark.state().batch.students.find(s => s.key === b).files.filter(f => f.from).map(f => f.name).sort(), bram);
  assert.equal(theirs.length, 2, 'the partner got the video and the notes page: ' + theirs.join());
  assert.ok(theirs.includes('Presentation video.url'));
  const made = await groups(p);
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  assert.deepEqual(await m.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().batch.groups || []))), made);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// src/groups.js groupFromSplit: two partners split by a rescan that found each other's names, put back as one group from the band;
// the toast names who they are graded with, and one Undo takes it back (audit H-041).
test('H-041: Mark and grade together again: one group from a split, the toast names the partner, Undo takes it back', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-added', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => { r.result.close(); res(); }; }));
  const z = path.join(dir, 'Speech2.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  // each paper's rescan found the other's name (f.sc[page].w), as a split group's papers carry
  await p.evaluate(() => { const [a, b] = window.__mark.state().batch.students; a.files[0].sc = { 0: { w: [b.key] } }; b.files[0].sc = { 0: { w: [a.key] } }; });
  await p.click('.mk-row[data-st="1"]'); await p.waitForFunction(() => window.__mark.state().cur === 1 && window.__mark.ready, { timeout: 30000 });
  await p.click('.mk-row[data-st="0"]'); await p.waitForFunction(() => window.__mark.state().cur === 0 && window.__mark.ready, { timeout: 30000 });
  await p.waitForSelector('[data-grpjoin]', { timeout: 30000 });
  await p.click('[data-grpjoin]');
  await p.waitForFunction(() => (window.__mark.state().batch.groups || []).length === 1, { timeout: 10000 });
  const bram = await p.evaluate(() => window.__mark.state().batch.students[1].key);
  await p.waitForFunction(b => [...document.querySelectorAll('.toast')].some(e => e.textContent.includes('Marked and graded once with ' + b)), { timeout: 10000 }, bram);
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  await p.waitForFunction(() => !(window.__mark.state().batch.groups || []).length, { timeout: 10000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

// B-047: with a group score, a score changed for one partner alone is listed on the band with Use group score (src/groups.js
// groupScoreNote, adjReset), which gives them the group's again as one undo step; the current app does the same to the same work.
test('B-047: Use group score gives a partner the group\'s score again for that one field, with Undo; the current app does the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-added', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => { r.result.close(); res(); }; }));
  const z = path.join(dir, 'Speech2.zip'); fs.writeFileSync(z, await twoZip());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  const fpath = await p.evaluate(() => window.__mark.state().batch.students[0].files[0].path);
  await p.waitForSelector(`[data-fmenu="${fpath}"]`, { timeout: 60000 });
  await p.click(`[data-fmenu="${fpath}"]`);
  await p.waitForFunction(() => [...document.querySelectorAll('.pop [role="menuitem"]')].some(e => /Group work/.test(e.textContent)));
  await p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => /Group work/.test(e.textContent)).click());
  await p.waitForSelector('dialog[open] input[data-grpfind]');
  const bram = await p.evaluate(() => window.__mark.state().batch.students.find(s => /Bram/.test(s.key)).key);
  await p.type('dialog[open] input[data-grpfind]', 'bra');
  await p.waitForSelector(`dialog[open] [data-grpto="${bram}"]`);
  await p.click(`dialog[open] [data-grpto="${bram}"]`);
  await p.waitForFunction(() => (window.__mark.state().batch.groups || []).length === 1, { timeout: 30000 });
  await p.click('dialog[open] [data-grpdone]');
  await p.waitForSelector('[data-grpband]', { timeout: 30000 });
  await pickMode(p, '2');
  await p.waitForFunction(() => window.__mark.state().batch.groups[0].own === 2);
  assert.equal(await p.$('[data-grpadj]'), null, 'nothing changed for one partner yet');
  // the group's points are 9, and Aria's alone were changed to 7 (as Just Aria does)
  await p.evaluate(b => { const s = window.__mark.state(), a = s.batch.students[0], m = s.batch.students.find(x => x.key === b);
    m.grade.points = '9'; a.grade.points = '7'; a.grade.adj = { points: 1 }; }, bram);
  await p.evaluate(() => [...document.querySelectorAll('[data-grpband] button, [data-grpband] [role="radio"]')].find(e => /^Just /.test(e.textContent.trim())).click());
  await p.waitForSelector('[data-grpadj] [data-grpreset="points"]', { timeout: 15000 });
  assert.match(await p.$eval('[data-grpadj]', e => e.textContent), /Points.*group 9 → 7.*Use group score/);
  await p.evaluate(() => window.__mark.saved());
  // the current app, from the same saved work, gives Aria the group's points
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  await m.waitForSelector('[data-grpreset="points"]', { timeout: 30000 });
  await m.click('[data-grpreset="points"]');
  const was = await m.evaluate(() => { const g = window.__gs.state().batch.students[0].grade; return { points: g.points, adj: g.adj || null }; });
  await m.close();
  await p.bringToFront();
  await p.click('[data-grpadj] [data-grpreset="points"]');
  await p.waitForFunction(() => !document.querySelector('[data-grpadj]'));
  assert.deepEqual(await p.evaluate(() => { const g = window.__mark.state().batch.students[0].grade; return { points: g.points, adj: g.adj || null }; }), was);
  assert.equal(was.points, '9');
  await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(e => /Points is the group’s score again/.test(e.textContent)), { timeout: 10000 });
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  await p.waitForSelector('[data-grpadj] [data-grpreset="points"]', { timeout: 15000 });
  assert.equal(await p.evaluate(() => window.__mark.state().batch.students[0].grade.points), '7');
  assert.deepEqual(errors, []);
  await ctx.close();
});
