// The browser harness the stage 8 E2 checks share (the same as plan.test.js's): the site served from disk, a fresh browser
// context with the made-up grading and planning work at the stopped clock, and opening an address in the new app.
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { plantPlan } = require('./planseed.js');

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
// One browser and one server for a test file: call harness() at the top, then h.fresh() and h.open() in each test.
function harness(before, after) {
  const h = {};
  before(async () => { h.srv = await serveSite(); h.browser = await launch(); });
  after(async () => { await h.browser.close(); await h.srv.close(); });
  // plan: options for plantPlan (other lessons, units, setup); local: localStorage to set before the app opens.
  h.fresh = async (width = 1366, plan = {}, local = {}) => {
    const ctx = await h.browser.createBrowserContext(), p = await ctx.newPage(), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
    await p.evaluateOnNewDocument(STEADY);
    await p.setViewport({ width, height: width < 700 ? 844 : 900 });
    await p.goto(h.srv.url + 'blank');
    await plant(p, gradingSeed()); await plantPlan(p, plan);
    if (Object.keys(local).length) await p.evaluate(o => { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }, local);
    p.errors = errors; p.ctx = ctx; return p;
  };
  h.open = async (p, hash) => {
    await p.goto(h.srv.url + 'next/#/' + hash);
    await p.waitForSelector('[data-shell-nav], nav.tabbar', { timeout: 20000 });
    await p.waitForFunction(() => !document.querySelector('main .loading'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 300));
  };
  h.lessonInDb = (p, id) => p.evaluate(id => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('lessons').objectStore('lessons').get(id); q.onsuccess = () => { r.result.close(); res(q.result || null); }; q.onerror = () => rej(q.error); }; r.onerror = () => rej(r.error); }), id);
  h.kvInDb = (p, k) => p.evaluate(k => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => { r.result.close(); res(q.result === undefined ? null : q.result); }; q.onerror = () => rej(q.error); }; r.onerror = () => rej(r.error); }), k);
  h.local = (p, k) => p.evaluate(k => localStorage.getItem(k), k);
  return h;
}
module.exports = { harness, ROOT };
