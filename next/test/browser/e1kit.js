// What the stage 8 lesson editor checks (lesson-e1.test.js) share: the site served from the repo, a fresh browser context with the
// made-up planning work (planseed.js) at the stopped clock, and the current Planner reading what the new app saved.
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { plantPlan, LESSONS } = require('./planseed.js');

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
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 6000) => { for (let k = 0; k < ms / 150; k++) { const v = await fn(); if (v) return v; await wait(150); } return null; };

function kit() {
  const K = {};
  K.start = async () => { K.srv = await serveSite(); K.browser = await launch(); };
  K.stop = async () => { await K.browser.close(); await K.srv.close(); };
  K.fresh = async (width = 1366, lessons = LESSONS) => {
    const ctx = await K.browser.createBrowserContext(), p = await ctx.newPage(), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '') && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await p.evaluateOnNewDocument(STEADY);
    await p.setViewport({ width, height: width < 700 ? 844 : 900 });
    await p.goto(K.srv.url + 'blank');
    await plant(p, gradingSeed()); await plantPlan(p, { lessons });
    p.errors = errors; p.ctx = ctx; return p;
  };
  K.open = async (p, hash) => {
    await p.goto(K.srv.url + 'next/#/' + hash);
    await p.waitForSelector('[data-shell-nav], nav.tabbar', { timeout: 20000 });
    await p.waitForFunction(() => !document.querySelector('main .loading'), { timeout: 10000 });
    await wait(300);
  };
  // The editor and its second part both in.
  K.edit = async (p, id, slide = 0) => {
    await K.open(p, 'lesson/' + id + '/edit');
    await p.waitForSelector('main .editor .ed-form', { timeout: 10000 });
    if (slide) { await p.click('main .ed-list [data-slide-i="' + slide + '"]'); await wait(150); }
    await p.waitForFunction(() => document.querySelector('main .ed-form .picfield, main .ed-form [data-focus="layout"]'), { timeout: 8000 });
  };
  K.lessonInDb = (p, id) => p.evaluate(id => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('lessons').objectStore('lessons').get(id); q.onsuccess = () => { r.result.close(); res(q.result || null); }; q.onerror = () => rej(q.error); }; r.onerror = () => rej(r.error); }), id);
  // The current Planner, opened on the same saved work, reads the lesson; the fields named read the same there.
  K.sameInPlanner = async (p, id, mine, keys = ['title', 'slots', 'slides', 'fmt']) => {
    await p.goto(K.srv.url + 'planner.html');
    await p.waitForFunction(id => { const P = window.__planner; return P && Array.isArray(P.L.lessons) && P.L.lessons.some(l => l.id === id); }, { timeout: 20000 }, id);
    const theirs = await p.evaluate(id => JSON.parse(JSON.stringify(window.__planner.L.lessons.find(l => l.id === id))), id);
    const out = {}; for (const k of keys) out[k] = [theirs[k], mine[k]]; return out;
  };
  K.item = (p, text) => p.evaluate(t => { const b = [...document.querySelectorAll('[role^="menuitem"]')].find(x => x.textContent.includes(t)); if (!b) throw new Error('no menu item ' + t); b.click(); }, text);
  K.focusIn = (p, sel) => p.waitForFunction(s => document.activeElement && document.activeElement.closest(s), { timeout: 5000 }, sel);
  return K;
}
module.exports = { kit, wait, until };
