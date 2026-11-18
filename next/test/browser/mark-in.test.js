// Bringing papers in on the new app (stage 4, part d): a ZIP of made-up papers brought in for an assignment from the class page
// opens for marking, and the current app then opens the same download from its own kept list, with the same students, files and
// the comment made in the new app, and the assignment card linked to it. npm run next:browser. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady } = require('../../../test/helpers/app.js');
const { standardFiles, zipOf, makePaper } = require('../../../test/helpers/fixtures.js');
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
before(async () => { srv = await serveSite(); browser = await launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-in-')); });
after(async () => { await browser.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
const shape = `b => b.students.map(st => ({ key: st.key, files: st.files.map(f => ({ path: f.path, kind: f.kind })), comment: st.grade.comment || '' }))`;

test('papers brought in from the class page open for marking, and the current app opens the same download with the same work', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']);
  lib.classes[0].units[0].items.push({ id: 'i9', name: 'Book review', classId: 'c1', type: 'sum', due: '2026-11-20' });
  seed.ls['gs.lib'] = JSON.stringify(lib);
  const zip = path.join(dir, 'Book review.zip'); fs.writeFileSync(zip, zipOf(await standardFiles()));
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, seed);
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([zip]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready, { timeout: 60000 });
  const now = await p.evaluate(shape => { const b = window.__mark.state().batch; return { id: b.id, shape: eval(shape)(b) }; }, shape);
  assert.equal(now.shape.filter(s => s.files.length).length, 4, 'one student a folder, roster names beside them');
  // a comment, saved through the save layer as the download's first work
  await p.waitForSelector('.mk-cmt:not([disabled])', { timeout: 60000 });
  await p.click('.mk-cmt'); await p.keyboard.type('Good start.');
  await p.evaluate(() => window.__mark.saved());
  now.shape[0].comment = 'Good start.';
  await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  const card = await m.evaluate(() => { const l = JSON.parse(localStorage.getItem('gs.lib')); return l.classes[0].units[0].items.find(x => x.id === 'i9'); });
  assert.equal(card.batchId, now.id, 'the card is linked to the papers');
  await m.evaluate(id => window.__gs.reopenKept(id), now.id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, now.id);
  const was = await m.evaluate(shape => eval(shape)(window.__gs.state().batch), shape);
  assert.deepEqual(was, now.shape, 'the same students, files and comment in the current app');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a newer copy of the same papers brought in brings the work over, flags what changed, and the current app opens it the same', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']);
  lib.classes[0].units[0].items.push({ id: 'i9', name: 'Book review', classId: 'c1', type: 'sum', due: '2026-11-20' });
  seed.ls['gs.lib'] = JSON.stringify(lib);
  const files = await standardFiles();
  const a = path.join(dir, 'Book review A.zip'); fs.writeFileSync(a, zipOf(files));
  const CHANGED = 'Bram Sample/Essay.pdf', NEW = 'Cleo Fixture/Extra.pdf';
  const b = path.join(dir, 'Book review B.zip'); fs.writeFileSync(b, zipOf({ ...files, [CHANGED]: await makePaper({ title: 'Bram Sample essay, sent again', pages: 2 }), [NEW]: await makePaper({ title: 'Cleo Fixture extra page' }) }));
  const bringFor = async (p, zip, sel = '[data-bring-for="i9"]') => {
    await p.goto(srv.url + 'next/#/class/c1/work');
    await p.waitForSelector(sel, { timeout: 60000 });
    await p.click(sel);
    await p.waitForSelector('.pop [role="menuitem"]');
    const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
    await chooser.accept([zip]);
    await p.waitForFunction(was => { const b = /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.state().batch; return b && b.id !== was; }, { timeout: 60000 }, sel === '[data-bring-for="i9"]' ? null : p.idA);
    return p.evaluate(() => window.__mark.state().batch.id);
  };
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, seed);
  const idA = await bringFor(p, a); p.idA = idA;
  const who = await p.evaluate(() => { const b = window.__mark.state(); return b.batch.students[b.cur].key; });
  await p.waitForSelector('.mk-cmt:not([disabled])', { timeout: 60000 });
  await p.click('.mk-cmt'); await p.keyboard.type('Carried over.');
  await p.evaluate(() => window.__mark.saved());
  // the newer copy: one paper sent again, one new
  const idB = await bringFor(p, b, '[data-again-for="i9"]');
  assert.notEqual(idB, idA, 'a different download');
  await p.waitForSelector('#carryBox', { timeout: 30000 });
  assert.match(await p.$eval('#carryBox', e => e.textContent), /Changed, so check your marks/);
  const now = await p.evaluate(k => { const b = window.__mark.state().batch; return { flags: b.carry.flags, from: b.carry.from, comment: b.students.find(s => s.key === k).grade.comment }; }, who);
  assert.deepEqual(now.flags, { [CHANGED]: 'changed', [NEW]: 'new' });
  assert.equal(now.from, idA);
  assert.equal(now.comment, 'Carried over.', 'the comment came over');
  await p.click('.dlg [data-ok]');
  assert.ok(await p.$('.mk-row .bang'), 'the list says which students have something new');
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), idB);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, idB);
  const was = await m.evaluate(k => { const b = window.__gs.state().batch; return { flags: b.carry && b.carry.flags, from: b.carry && b.carry.from, comment: b.students.find(s => s.key === k).grade.comment }; }, who);
  assert.deepEqual(was, now, 'the current app opens the same work and flags');
  const older = await m.evaluate(id => new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => { const g = r.result.transaction('meta').objectStore('meta').get(id); g.onsuccess = () => res(g.result || null); g.onerror = () => res(null); }; r.onerror = () => res(null); }), idA);
  assert.equal(older && older.newer, idB, 'and the older copy knows which is newer');
  assert.deepEqual(errors, []);
  await ctx.close();
});
