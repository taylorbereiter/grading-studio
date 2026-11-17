// One writer between the current app and the new one (src/lock.js, next/src/shared/lock.js). Any number of the current app's
// windows still work side by side, as they always have. A window of the new app is the only writer: opened beside the current
// app it only shows work, and a page of the current app opened beside it is covered and takes no input. Whoever waited takes over
// when the other closes, the current app's page by reloading, so it starts again from what is saved.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { launch } = require('./helpers/chrome');
const { builtHtml } = require('./helpers/app');
const { serveBuild } = require('./helpers/steady');
const ROOT = path.join(__dirname, '..');

let browser, srv;
before(async () => {
  builtHtml();
  srv = await serveBuild({ index: fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), planner: fs.readFileSync(path.join(ROOT, 'planner.html'), 'utf8') });
  browser = await launch();
});
after(async () => { await browser.close(); await srv.close(); });

const open = async (ctx, where) => { const p = await ctx.newPage(); p.on('dialog', d => d.accept()); await p.goto(srv.url + where); return p; };
const oldState = p => p.waitForFunction(() => window.__gsWriter && window.__gsWriter.state !== 'asking' && window.__gsWriter.state, { timeout: 20000 }).then(h => h.jsonValue());
const newState = p => p.waitForFunction(() => { const e = document.querySelector('[data-lock]'); return e && e.dataset.lock !== 'asking' && e.dataset.lock !== 'not-asked' && e.dataset.lock; }, { timeout: 20000 }).then(h => h.jsonValue());
const covered = p => p.evaluate(() => !!document.getElementById('gsWriterBlock'));

test('windows of the current app, grading and Planner, all keep working together', async () => {
  const ctx = await browser.createBrowserContext();
  const a = await open(ctx, ''), b = await open(ctx, ''), c = await open(ctx, 'planner.html');
  for (const p of [a, b, c]) { assert.equal(await oldState(p), 'writer'); assert.equal(await covered(p), false); }
  await ctx.close();
});

test('the new app opened beside the current one only shows work, and becomes the writer once the other window closes', async () => {
  const ctx = await browser.createBrowserContext();
  const old = await open(ctx, ''); assert.equal(await oldState(old), 'writer');
  const nx = await open(ctx, 'next/');
  assert.equal(await newState(nx), 'read-only');
  assert.match(await nx.$eval('[data-lock]', e => e.textContent), /open in another window/);
  // the layer refuses to write while it is read-only
  const pr = await open(ctx, 'next/proof.html'); await pr.waitForFunction(() => !!window.__next);
  assert.equal(await pr.evaluate(async () => { await window.__next.start(); try { window.__next.students.library.setText('{}'); return 'wrote'; } catch (e) { return e.name; } }), 'ReadOnly');
  await pr.close();
  assert.equal(await covered(old), false, 'the current app is not covered by a window that only reads');
  await old.close();
  await nx.waitForFunction(() => document.querySelector('[data-lock]').dataset.lock === 'writer', { timeout: 20000 });
  await ctx.close();
});

test('the current app opened beside the new one is covered and takes no input, and reloads to work once the new one closes', async () => {
  const ctx = await browser.createBrowserContext();
  const nx = await open(ctx, 'next/'); assert.equal(await newState(nx), 'writer');
  const old = await open(ctx, '');
  assert.equal(await oldState(old), 'blocked');
  await old.waitForSelector('#gsWriterBlock');
  assert.match(await old.$eval('#gsWriterBlock', e => e.textContent), /open in the new version in another window/);
  // a key press and a click don't reach the page underneath
  const reached = await old.evaluate(() => { let n = 0; const f = () => n++; document.addEventListener('keydown', f); document.addEventListener('click', f); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })); document.body.click(); return n; });
  assert.equal(reached, 0);
  const planner = await open(ctx, 'planner.html'); assert.equal(await oldState(planner), 'blocked');
  await nx.close();
  // both reload and work again, uncovered
  for (const p of [old, planner]) {
    await p.waitForFunction(() => window.__gsWriter && window.__gsWriter.state === 'writer' && !document.getElementById('gsWriterBlock'), { timeout: 30000 });
  }
  await ctx.close();
});

test('the new app can take over: the current app’s windows are covered at once', async () => {
  const ctx = await browser.createBrowserContext();
  const old = await open(ctx, ''); assert.equal(await oldState(old), 'writer');
  const pr = await open(ctx, 'next/proof.html'); await pr.waitForFunction(() => !!window.__next);
  assert.equal(await pr.evaluate(() => window.__next.start()), 'read-only');
  assert.equal(await pr.evaluate(() => window.__next.takeOver()), 'writer');
  await old.waitForSelector('#gsWriterBlock', { timeout: 20000 });
  await ctx.close();
});

test('in the sample the lock has the sample’s own name, so real work and the sample never block each other', async () => {
  const ctx = await browser.createBrowserContext();
  const nx = await open(ctx, 'next/'); assert.equal(await newState(nx), 'writer');
  assert.deepEqual(await nx.evaluate(async () => (await navigator.locks.query()).held.map(l => l.name)), ['gs-writer']);
  await nx.close();
  const b = await open(ctx, 'blank'); await b.evaluate(() => { localStorage.setItem('sample:gs.sampleBuilt', '1'); localStorage.setItem('gs.sampleOn', '1'); });
  const sx = await open(ctx, 'next/'); assert.equal(await newState(sx), 'writer');
  assert.deepEqual(await sx.evaluate(async () => (await navigator.locks.query()).held.map(l => l.name)), ['sample:gs-writer']);
  await ctx.close();
});
