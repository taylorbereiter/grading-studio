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
  await p.click('[data-tnopen]'); await p.waitForSelector('.mk-tn .tn .tned');
  await p.evaluate(() => new Promise(r => setTimeout(r, 350)));
  await p.click('.mk-tn .tned'); await p.keyboard.type('Only for her');
  await p.waitForFunction(a => { const tn = window.__mark.state().batch.students[0].grade.tn; return tn && tn.l.some(x => x.s === 'Only for her' && x.o === a); }, { timeout: 10000 }, aria);
  const bare = gs => gs.map(({ k, p, own }) => ({ k, p, own })), own = bare(await groups(p));

  // Grade on their own: at once, with Undo
  await p.click('[data-grpout]');
  await p.waitForFunction(() => !(window.__mark.state().batch.groups || []).length);
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
