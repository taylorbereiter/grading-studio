// The keyboard run on the new marking screen (stage 4 proof): opening the papers, the tools as one Tab stop with the arrow keys inside,
// a comment, the number keys for the scores and Enter to the next student, with no mouse; the current app opens the same. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip } = require('../../../test/helpers/app.js');
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


let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });
async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
// What has the keyboard: its name, and the set it belongs to
const focused = p => p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return { name: '' }; const g = e.closest('[data-rove]'); return { name: (e.getAttribute('aria-label') || e.title || e.textContent || '').trim(), set: g ? g.getAttribute('aria-label') : null, tag: e.tagName, cls: e.className || '' }; });
const tabTo = async (p, ok, most) => { for (let n = 1; n <= most; n++) { await p.keyboard.press('Tab'); const f = await focused(p); if (ok(f)) return n; } return 0; };

test('a keyboard run: from opening the papers to the next student with the keyboard alone, through the tools (one stop, arrows inside), a comment, the scores and Enter; the current app opens the same scores and comment', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, await zipOf({ 'Aria Testwell/Essay.pdf': await makePaper({ title: 'My summer essay' }), 'Bram Sample/Essay.pdf': await makePaper({ title: 'A day at the lake' }) }));
  const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready && window.__mark.read && window.__mark.state().cur === 0, { timeout: 60000 });
  const key0 = await p.evaluate(() => window.__mark.state().batch.students[0].key);

  // Tab reaches the tools as one stop; the arrow keys move inside them without leaving for the next student, and Enter picks
  const toTools = await tabTo(p, f => f.set === 'Marking tools', 25);
  assert.ok(toTools > 0, 'the tools are reached with Tab');
  const t0 = await focused(p);
  await p.keyboard.press('ArrowDown');
  const t1 = await focused(p);
  assert.notEqual(t1.name, t0.name, 'the arrow moved to the next tool');
  assert.equal(await p.evaluate(() => window.__mark.state().cur), 0, 'and stayed on this student');
  await p.keyboard.press('Enter');
  assert.equal(await p.evaluate(n => document.activeElement.getAttribute('aria-pressed'), t1.name), 'true', 'Enter picked it');
  // one more Tab leaves the tools for the colours, a set of its own
  await p.keyboard.press('Tab');
  const after = await focused(p);
  assert.notEqual(after.set, 'Marking tools', 'one Tab leaves the tools');

  // the comment, typed in, and Escape gives the keyboard back to the page
  assert.ok(await tabTo(p, f => f.tag === 'TEXTAREA', 30), 'the comment box is reached with Tab');
  await p.keyboard.type('A clear opening paragraph.');
  await p.keyboard.press('Escape');
  assert.equal((await focused(p)).name, '');
  // the number keys score the rows in turn, and Enter goes to the next student to score
  for (const k of ['3', '4', '2']) await p.keyboard.press(k);
  await p.waitForFunction(() => { const g = window.__mark.state().batch.students[0].grade; return (g.rubric || []).filter(v => v != null).length === 3; });
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__mark.state().cur === 1 && window.__mark.ready, { timeout: 30000 });
  const g = await p.evaluate(() => { const x = window.__mark.state().batch.students[0].grade; return { rubric: x.rubric, comment: x.comment }; });
  assert.deepEqual(g, { rubric: [3, 4, 2], comment: 'A clear opening paragraph.' });
  await p.evaluate(() => window.__mark.saved());
  await p.close();

  const c = await page(ctx, errors);
  await c.goto(srv.url); await appReady(c);
  await c.evaluate(id => window.__gs.reopenKept(id), id);
  await c.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  const was = await c.evaluate(k => { const x = window.__gs.state().batch.students.find(s => s.key === k).grade; return { rubric: x.rubric, comment: x.comment }; }, key0);
  assert.deepEqual(was, g, 'the current app opens the same scores and comment');
  assert.deepEqual(errors, []);
  await ctx.close();
});
