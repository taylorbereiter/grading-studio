// The rubric bank in the new app (stage 4, part c): Library > Rubrics and a unit's own section on the Course line. A rubric made with
// rows, how they are scored, what a score means and a scale; a grading scale; Duplicate, Move to…, Delete with Undo; Ctrl+Z. The bank
// keeps only wording and percents. Every class, unit and rubric here is made up. npm run next:browser.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { plantPlan, LESSONS, lesson } = require('./planseed.js');

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

let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

async function fresh(width = 1366, lessons = LESSONS) {
  const ctx = await browser.createBrowserContext(), p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width, height: width < 700 ? 844 : 900 });
  await p.goto(srv.url + 'blank');
  await plant(p, gradingSeed()); await plantPlan(p, { lessons });
  p.errors = errors; p.ctx = ctx; return p;
}
const open = async (p, hash, keys) => {
  await p.goto(srv.url + 'next/' + (keys ? '?keys=1' : '') + '#/' + hash);
  await p.waitForSelector('[data-shell-nav], nav.tabbar', { timeout: 20000 });
  await p.waitForFunction(() => !document.querySelector('main .loading'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 300));
};
const lessonInDb = (p, id) => p.evaluate(id => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('lessons').objectStore('lessons').get(id); q.onsuccess = () => { r.result.close(); res(q.result || null); }; q.onerror = () => rej(q.error); }; r.onerror = () => rej(r.error); }), id);
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 6000) => { for (let k = 0; k < ms / 150; k++) { const v = await fn(); if (v) return v; await wait(150); } return null; };
const kvGet = (p, key) => p.evaluate(key => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => { r.result.close(); res(q.result === undefined ? null : JSON.parse(JSON.stringify(q.result instanceof Blob ? { blob: q.result.size } : q.result))); }; }; }), key);
const allLessons = p => p.evaluate(() => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('lessons').objectStore('lessons').getAll(); q.onsuccess = () => { r.result.close(); res(q.result); }; }; }));
const item = (p, text) => p.evaluate(t => { const b = [...document.querySelectorAll('[role^="menuitem"]')].find(x => x.textContent.includes(t)); if (!b) throw new Error('no menu item ' + t); b.click(); }, text);

const bank = async p => (await kvGet(p, 'bank')) || { rubrics: [], scales: [] };
const byName = (b, n) => [...b.rubrics, ...b.scales].find(x => x.name === n);
const tap = (p, sel) => p.$eval(sel, e => { e.scrollIntoView({ block: 'center' }); e.click(); });
const typeIn = async (p, sel, text) => { await p.$eval(sel, e => { e.focus(); e.select && e.select(); }); await p.keyboard.press('Backspace'); await p.type(sel, text); };
const undoToast = p => p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => b.textContent.trim() === 'Undo').click());

test('the bank: a new rubric (rows, 0 to 6, what a score means, steps of 5, a unit), a new scale, Duplicate, Move to…, Delete with Undo, and Ctrl+Z', async () => {
  const p = await fresh();
  await open(p, 'library/rubrics');
  await p.waitForSelector('[data-bkitem="R1"]', { timeout: 8000 });
  assert.match(await p.$eval('[data-bkitem="R1"]', e => e.textContent), /Story analysis.*3 rows/);
  // a new rubric
  await p.click('[data-bknew="rubrics"]');
  await p.waitForSelector('dialog[open] [data-bkname]');
  await p.type('dialog[open] [data-bkname]', 'Book cover');
  await p.select('dialog[open] [data-bkunit]', 'U2');
  await p.select('dialog[open] [data-bktop]', '6');
  await tap(p, 'dialog[open] [data-bkrowadd]');
  await typeIn(p, 'dialog[open] [data-bkrow="3"]', 'Design');
  await tap(p, 'dialog[open] [data-bklv="0"]');
  await p.type('dialog[open] [data-bklvi="0:6"]', 'A striking cover');
  await tap(p, 'dialog[open] [data-bkpre="fives"]');
  await tap(p, 'dialog[open] [data-bksave]');
  let b = await until(async () => { const x = await bank(p); return byName(x, 'Book cover') ? x : null; });
  const r = byName(b, 'Book cover');
  assert.deepEqual(r.criteria, ['Criterion 1', 'Criterion 2', 'Criterion 3', 'Design']);
  assert.equal(r.top, 6); assert.deepEqual(r.levels[0], { 6: 'A striking cover' });
  assert.equal(r.scale[24], 100); assert.equal(r.scale[23], 95);
  assert.deepEqual(r.unit, { id: 'U2', course: 'Grade 9', title: 'Unit 2: Poetry' });
  // Ctrl+Z takes the save back, Ctrl+Y does it again
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  assert.ok(await until(async () => !byName(await bank(p), 'Book cover')), 'Ctrl+Z');
  await p.keyboard.down('Control'); await p.keyboard.press('y'); await p.keyboard.up('Control');
  assert.ok(await until(async () => byName(await bank(p), 'Book cover')), 'Ctrl+Y');
  // a new scale: top score 10, plain percent
  await p.waitForSelector('[data-bknew="scales"]'); await p.click('[data-bknew="scales"]');
  await p.waitForSelector('dialog[open] [data-bkname]');
  await p.type('dialog[open] [data-bkname]', 'Out of 10');
  await typeIn(p, 'dialog[open] [data-bkstop]', '10'); await p.keyboard.press('Enter');
  await tap(p, 'dialog[open] [data-bkpre="plain"]');
  await tap(p, 'dialog[open] [data-bksave]');
  b = await until(async () => { const x = await bank(p); return byName(x, 'Out of 10') ? x : null; });
  assert.deepEqual(byName(b, 'Out of 10').scale, { 0: 0, 1: 10, 2: 20, 3: 30, 4: 40, 5: 50, 6: 60, 7: 70, 8: 80, 9: 90, 10: 100 });
  // Duplicate, then Move to… and Delete with Undo
  await p.waitForSelector('[data-bkmenu="R1"]'); await p.click('[data-bkmenu="R1"]'); await item(p, 'Duplicate');
  await p.waitForSelector('dialog[open] [data-bksave]'); await tap(p, 'dialog[open] [data-bksave]');
  b = await until(async () => { const x = await bank(p); return byName(x, 'Story analysis (copy)') ? x : null; });
  assert.deepEqual(byName(b, 'Story analysis (copy)').criteria, ['Understanding', 'Evidence', 'Language']);
  await p.waitForSelector('[data-bkmenu="R1"]'); await p.click('[data-bkmenu="R1"]'); await item(p, 'Move to');
  await p.waitForSelector('dialog[open] [data-bkmoveto]'); await p.select('dialog[open] [data-bkmoveto]', 'U3'); await tap(p, 'dialog[open] [data-bkmoveok]');
  assert.ok(await until(async () => (byName(await bank(p), 'Story analysis').unit || {}).id === 'U3'), 'moved');
  await p.waitForSelector('[data-bkmenu="S1"]'); await p.click('[data-bkmenu="S1"]'); await item(p, 'Delete');
  b = await until(async () => { const x = await bank(p); return !byName(x, 'School percent scale') ? x : null; });
  assert.ok(b.gone.S1, 'a deleted one is remembered as gone');
  await p.waitForSelector('.toast button'); await undoToast(p);
  assert.ok(await until(async () => byName(await bank(p), 'School percent scale')), 'Undo brings it back');
  // the unit's own section on the Course line shows what is saved for it
  await open(p, 'class/c1');
  await p.waitForSelector('.ubank', { timeout: 8000 });
  assert.match(await p.$eval('.ubank', e => e.textContent), /Book cover/);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});
