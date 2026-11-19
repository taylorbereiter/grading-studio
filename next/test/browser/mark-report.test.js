// What opened, on the new marking screen (stage 4, part d): after papers open, the same line the current app shows about what opened,
// what didn't and who has nothing, and the whole list with each name a way to that student. npm run next:browser. Made-up students.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip, goToStudent } = require('../../../test/helpers/app.js');
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

let browser, srv, zip;
before(async () => { srv = await serveSite(); browser = await launch(); zip = zipOf({ ...await standardFiles(), 'Eve Pretend/Broken.pdf': Buffer.from('this is not a PDF at all'), 'Eve Pretend/Notes.txt': Buffer.from('My notes on the essay.\nSecond line.'), 'Eve Pretend/Poster.pages': Buffer.from('PK not really pages') }); });
after(async () => { await browser.close(); await srv.close(); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon|Invalid PDF|InvalidPDFException/.test((m.location().url || '') + m.text())) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}

test('D-017: What opened says what the current app says, and its list goes to the student', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, zip);
  await m.waitForFunction(() => { const b = document.querySelector('#openRep'); return b && !b.hidden && b.textContent.trim(); }, { timeout: 60000 });
  const was = await m.$eval('#openRep span', e => e.textContent);
  const id = await m.evaluate(() => window.__gs.state().batch.id);
  await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForSelector('.mk-opened', { timeout: 60000 });
  assert.equal(await p.$eval('.mk-opened .grow', e => e.textContent), was, 'the same line');
  assert.match(was, /couldn’t/, 'the broken file is counted');
  await p.click('[data-rep]');
  await p.waitForSelector('#openRepBox [data-group="cant"] [data-repgo]');
  // D-017: those with nothing turned in, and where their work goes when it comes (the current app's hint, in this app's words)
  await p.waitForSelector('#openRepBox [data-group="nothing"] [data-oplater]');
  assert.equal(await p.$eval('[data-oplater]', e => e.textContent), 'When their work comes in, use Bring in files under Setup, or + Add on their paper.');
  const i = await p.$eval('#openRepBox [data-group="cant"] [data-repgo]', b => +b.dataset.repgo);
  assert.equal(await p.evaluate(i => window.__mark.state().batch.students[i].key, i), 'Eve Pretend');
  await p.click('#openRepBox [data-group="cant"] [data-repgo]');
  await p.waitForFunction(i => window.__mark.state().cur === i, {}, i);
  assert.equal(await p.$('.mk-opened'), null, 'seen, so the line has gone');
  // her text file shows its words; the Pages file says why it can't be shown, in the current app's words
  await p.waitForSelector('.dpage.ftext', { timeout: 30000 });
  assert.equal(await p.$eval('.dpage.ftext', e => e.textContent), 'My notes on the essay.\nSecond line.');
  await p.waitForFunction(() => [...document.querySelectorAll('.fcard.other')].some(e => /A Pages file from a Mac or iPad/.test(e.textContent)), { timeout: 30000 });
  // seen in this browser: opening again says nothing new
  await p.reload();
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  await new Promise(r => setTimeout(r, 1500));
  assert.equal(await p.$('.mk-opened'), null, 'nothing new to say');
  assert.deepEqual(errors, []);
  await ctx.close();
});
