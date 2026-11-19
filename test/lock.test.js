// Windows side by side (src/lock.js, next/src/shared/lock.js). Since stage 6 the new app speaks the current app's own multi-window
// protocol (src/saving.js; next/src/shared/tabs.js), so it takes the lock "gs-writer" in shared mode like every page of the current
// app: any number of windows of either version are open and write together, and none is covered. (Until stage 6 the new app held
// the lock alone; this file tested that interim rule and was rewritten with it. The merging itself is proved in
// next/test/browser/two-windows.test.js.) src/lock.js still covers a page whose share is refused, which only a window holding the
// lock alone can do.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { launch } = require('./helpers/chrome');
const { builtHtml } = require('./helpers/app');
const { serveBuild } = require('./helpers/steady');
const BASE = require('./helpers/base');   // the current app's pages: classic/ since the switch
const ROOT = path.join(__dirname, '..');

let browser, srv;
before(async () => {
  builtHtml();
  srv = await serveBuild({ index: fs.readFileSync(path.join(BASE, 'index.html'), 'utf8'), planner: fs.readFileSync(path.join(BASE, 'planner.html'), 'utf8') });
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

test('the new app opened beside the current one writes too, and neither is covered', async () => {
  const ctx = await browser.createBrowserContext();
  const old = await open(ctx, ''); assert.equal(await oldState(old), 'writer');
  const nx = await open(ctx, 'next/');
  assert.equal(await newState(nx), 'writer');
  const pr = await open(ctx, 'next/proof.html'); await pr.waitForFunction(() => !!window.__next);
  assert.equal(await pr.evaluate(async () => { await window.__next.start(); try { window.__next.students.library.setText(localStorage.getItem('gs.lib') || '{"classes":[]}'); return 'wrote'; } catch (e) { return e.name; } }), 'wrote');
  assert.equal(await covered(old), false);
  const planner = await open(ctx, 'planner.html'); assert.equal(await oldState(planner), 'writer'); assert.equal(await covered(planner), false);
  await ctx.close();
});

test('the current app opened beside the new one is not covered, and two windows of the new app both write', async () => {
  const ctx = await browser.createBrowserContext();
  const nx = await open(ctx, 'next/'); assert.equal(await newState(nx), 'writer');
  const old = await open(ctx, ''); assert.equal(await oldState(old), 'writer'); assert.equal(await covered(old), false);
  const nx2 = await open(ctx, 'next/'); assert.equal(await newState(nx2), 'writer');
  assert.deepEqual(await nx.evaluate(async () => (await navigator.locks.query()).held.map(l => l.mode)), ['shared', 'shared', 'shared']);
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

test('a browser with no Locks API: both versions work as before', async () => {
  const ctx = await browser.createBrowserContext();
  const bare = async where => { const p = await ctx.newPage(); await p.evaluateOnNewDocument(() => { Object.defineProperty(Navigator.prototype, 'locks', { get: () => undefined }); }); await p.goto(srv.url + where); return p; };
  const old = await bare(''); assert.equal(await oldState(old), 'no-locks'); assert.equal(await covered(old), false);
  const nx = await bare('next/'); assert.equal(await newState(nx), 'writer-no-locks');
  await ctx.close();
});
