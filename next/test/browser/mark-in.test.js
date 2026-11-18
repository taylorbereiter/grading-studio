// Bringing papers in on the new app (stage 4, part d): a ZIP of made-up papers brought in for an assignment from the class page
// opens for marking, and the current app then opens the same download from its own kept list, with the same students, files and
// the comment made in the new app, and the assignment card linked to it. npm run next:browser. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady } = require('../../../test/helpers/app.js');
const { standardFiles, zipOf } = require('../../../test/helpers/fixtures.js');
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
