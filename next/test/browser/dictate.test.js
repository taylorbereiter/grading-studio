// Dictation in the new app (stage 6, new in the design): a stand-in for the browser's speech recogniser hears "words said aloud", and
// the mic beside each long box puts them where the cursor is and the box saves them as typed words: the comment for the student on the
// marking screen, a to-do and a student's notes. npm run next:browser. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip } = require('../../../test/helpers/app.js');
const { zipOf, makePaper } = require('../../../test/helpers/fixtures.js');
const { gradingSeed, PLAN_SETUP, STEADY } = require('../../../test/helpers/steady.js');

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

async function page(ctx, errors, width = 1440) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width, height: 900 });
  return p;
}
// The stand-in: each start() hears one phrase, then stops, as the browser's own does when the teacher stops talking.
const FAKE_SPEECH = `window.webkitSpeechRecognition = window.SpeechRecognition = class { start() { setTimeout(() => { const r = [{ 0: { transcript: 'words said aloud' }, isFinal: true, length: 1 }]; this.onresult && this.onresult({ resultIndex: 0, results: r }); setTimeout(() => this.onend && this.onend(), 30); }, 60); } stop() { this.onend && this.onend(); } abort() { this.stop(); } };`;
const ls = (p, k) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);

test('dictation: the comment for the student, a to-do and a student\'s notes each take words said aloud, saved as typed words', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, await zipOf({ 'Aria Testwell/Essay.pdf': await makePaper({ title: 'My summer essay' }), 'Bram Sample/Essay.pdf': await makePaper({ title: 'A day at the lake' }) }));
  const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();

  const p = await page(ctx, errors); await p.evaluateOnNewDocument(FAKE_SPEECH);
  await p.goto(srv.url + 'next/#/mark/' + id);
  await p.waitForSelector('.mk-cbox .mic', { timeout: 60000 });
  await p.click('.mk-cmt'); await p.keyboard.type('Good start.');
  await p.click('.mk-cbox .mic');
  await p.waitForFunction(() => document.querySelector('.mk-cmt').value === 'Good start. words said aloud', { timeout: 10000 });
  await p.waitForFunction(() => window.__mark.state().batch.students.some(s => (s.grade.comment || '') === 'Good start. words said aloud'), { timeout: 10000, polling: 100 });

  await p.goto(srv.url + 'next/#/todo');
  await p.waitForSelector('[data-td-adder] .mic', { timeout: 30000 });
  await p.click('[data-td-adder] .mic');
  await p.waitForFunction(() => [...document.querySelectorAll('[data-td-adder] input, [data-td-adder] textarea')].some(e => e.value.includes('words said aloud')), { timeout: 10000 });

  await p.goto(srv.url + 'next/#/class/c1/people/1');
  await p.waitForSelector('[data-stu-note]', { timeout: 30000 });
  await p.click('.sp-sec .sp-h .mic');
  await p.waitForFunction(() => document.querySelector('[data-stu-note]').value === 'words said aloud', { timeout: 10000 });
  await p.waitForFunction(() => { const c = JSON.parse(localStorage.getItem('gs.lib')).classes[0]; return Object.values(c.info || {}).some(i => i && i.note === 'words said aloud'); }, { timeout: 10000, polling: 100 });
  assert.deepEqual(errors, []);
  await ctx.close();
});
