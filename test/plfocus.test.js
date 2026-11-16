// A focus session goes on in the Planner (src/planner/plfocus.js): the panel shows there, the clock keeps running, and what a session
// that ends there came to is written into the grading log when the grading page opens again. Nothing about students is involved.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('./helpers/chrome');
const { builtHtml, ROOT } = require('./helpers/app');

let browser, srv;
before(async () => {
  builtHtml(); browser = await launch();
  const s = http.createServer((req, res) => {
    const p = req.url.split('?')[0], file = p === '/' || p === '/index.html' ? 'index.html' : p === '/planner.html' ? 'planner.html' : null;
    if (!file) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  });
  await new Promise(r => s.listen(0, '127.0.0.1', r)); s.unref();
  srv = { url: 'http://localhost:' + s.address().port + '/', close: () => new Promise(d => { s.closeAllConnections(); s.close(d); }) };
});
after(async () => { await browser.close(); await srv.close(); });

const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const run = page => page.evaluate(() => JSON.parse(localStorage.getItem('gsp.focusRun') || 'null'));
const gradingReady = page => page.waitForFunction(() => window.__gs && window.__gs.fcStart && document.querySelector('#fcCard'));
const plannerReady = page => page.waitForFunction(() => window.__planner && window.__plfocus && document.querySelector('#lessons .ls-top'));

test('a session started on the grading page keeps going in the Planner, and its minutes reach the grading log', async () => {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  try {
    await page.goto(srv.url, { waitUntil: 'load' }); await gradingReady(page);
    await page.evaluate(() => window.__gs.fcStart(25, '', false));
    assert.equal((await run(page)).st, 'run');
    await page.goto(srv.url + 'planner.html', { waitUntil: 'load' }); await plannerReady(page);
    // the panel shows, with the clock going down
    await page.waitForFunction(() => { const p = document.querySelector('#fcPanel'); return p && !p.hidden && /^2[45]:\d\d$/.test(p.querySelector('.fct').textContent); });
    assert.equal(await page.$eval('#fcPanel .tcap', e => e.textContent), 'Focusing');
    await page.waitForFunction(() => /^2[45]:\d\d · /.test(document.title));   // the time left is in the tab’s name
    // pause and carry on
    await page.click('#fcPanel [data-pf="pause"]');
    assert.equal((await run(page)).st, 'paused');
    await page.click('#fcPanel [data-pf="resume"]');
    assert.equal((await run(page)).st, 'run');
    await page.click('#fcPanel [data-pf="more"]');
    assert.equal((await run(page)).len, 30 * 60, '+5 minutes');
    // the time runs out here: it is written down to wait for the grading page, once
    await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('gsp.focusRun')); r.at -= r.len * 1000 + 1000; localStorage.setItem('gsp.focusRun', JSON.stringify(r)); window.__plfocus.tick(); window.__plfocus.tick(); });
    assert.equal((await run(page)).st, 'up');
    const q = await page.evaluate(() => JSON.parse(localStorage.getItem('gsp.focusQ')));
    assert.equal(q.length, 1); assert.equal(q[0].s, 1800); assert.equal(q[0].m, 0); assert.equal(q[0].d, iso(new Date()));
    await page.click('#fcPanel [data-pf="break"]');
    assert.equal((await run(page)).st, 'brk');
    await page.click('#fcPanel [data-pf="stop"]');
    assert.equal((await run(page)).st, 'done');
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('gsp.focusQ')))).length, 1, 'ending the break adds nothing');
    await page.click('#fcPanel [data-pf="close"]');
    assert.equal(await run(page), null);
    assert.equal(await page.$eval('#fcPanel', e => e.hidden), true);
    // back on the grading page, the session is in today's log
    await page.goto(srv.url, { waitUntil: 'load' }); await gradingReady(page);
    const L = await page.evaluate(() => JSON.parse(localStorage.getItem('gs.focus')));
    assert.equal(L.days[iso(new Date())].s, 1800); assert.equal(L.days[iso(new Date())].n, 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('gsp.focusQ')), null);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('a session kept under the old name carries on; the Planner shows nothing when no session is on', async () => {
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  try {
    await page.goto(srv.url + 'planner.html', { waitUntil: 'load' }); await plannerReady(page);
    assert.equal(await page.$eval('#fcPanel', e => e.hidden), true);
    await page.evaluate(() => localStorage.setItem('gs.focusRun', JSON.stringify({ st: 'run', len: 600, at: Date.now(), w: '', one: 0, p0: 1e9, pg: 0, fold: false, no: 1 })));
    // an entry two tabs both read is written in once
    await page.evaluate(d => localStorage.setItem('gsp.focusQ', JSON.stringify([{ id: 'a1', d, s: 300, m: 0, x: 0, got: 0 }, { id: 'a1', d, s: 300, m: 0, x: 0, got: 0 }])), iso(new Date()));
    await page.goto(srv.url, { waitUntil: 'load' }); await gradingReady(page);
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('gs.focus')))).days[iso(new Date())].s, 300);
    assert.equal((await run(page)).len, 600);
    assert.equal(await page.evaluate(() => localStorage.getItem('gs.focusRun')), null);
    await page.goto(srv.url + 'planner.html', { waitUntil: 'load' }); await plannerReady(page);
    await page.waitForFunction(() => !document.querySelector('#fcPanel').hidden);
    // folded to a pill and back
    await page.click('#fcPanel [data-pf="fold"]');
    await page.waitForSelector('#fcPanel .fcpill');
    await page.click('#fcPanel [data-pf="unfold"]');
    await page.waitForSelector('#fcPanel .fcclock');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
