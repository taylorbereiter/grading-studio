// A photo of a paper (a .jpg) in the new app opens as a page, not as "other": pdf-lib is loaded before the photo is made into a PDF page,
// on opening a download and on adding a file. npm run next:browser. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady } = require('../../../test/helpers/app.js');
const { standardFiles, zipOf, makePaper } = require('../../../test/helpers/fixtures.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');

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

let browser, srv, dir;
before(async () => { srv = await serveSite(); browser = await launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-photo-')); });
after(async () => { await browser.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}

const PHOTO = fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'intake', 'photo.jpg'));
const kindOf = (p, k, file) => p.evaluate((k, file) => { const st = window.__mark.state().batch.students.find(s => s.key === k); const f = st && st.files.find(x => x.path === file); return f ? { kind: f.kind, pdf: !!f.data && String.fromCharCode(...f.data.slice(0, 4)) === '%PDF' } : null; }, k, file);

test('a photo of a paper opens as a page, both in a download brought in and as a file added later', async () => {
  const ctx = await browser.createBrowserContext(), errors = [];
  const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']);
  lib.classes[0].units[0].items.push({ id: 'i9', name: 'Book review', classId: 'c1', type: 'sum', due: '2026-11-20' });
  seed.ls['gs.lib'] = JSON.stringify(lib);
  const files = await standardFiles(); files['Aria Testwell/Page 3.jpg'] = new Uint8Array(PHOTO);
  const zip = path.join(dir, 'Book review.zip'); fs.writeFileSync(zip, zipOf(files));
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, seed);
  // the store added files are kept in, made as the current app makes it (src/app/kept.js addDb), as for a teacher who has used it
  await p.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('grading-studio-added', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => { r.result.close(); res(); }; r.onerror = () => rej(r.error); }));
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([zip]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready, { timeout: 60000 });
  assert.deepEqual(await kindOf(p, 'Aria Testwell', 'Aria Testwell/Page 3.jpg'), { kind: 'img', pdf: true }, 'the photo in the download is a page');
  // a photo added to another student on the marking screen
  const KEY = 'Bram Sample', i = await p.evaluate(k => window.__mark.state().batch.students.findIndex(s => s.key === k), KEY);
  await p.click('[data-st="' + i + '"]');
  await p.waitForFunction(i => window.__mark.state().cur === i && window.__mark.ready && window.__mark.read, { timeout: 60000 }, i);
  await p.waitForSelector('[data-addmenu]', { timeout: 60000 });
  const shot = path.join(dir, 'Photo page.jpg'); fs.writeFileSync(shot, PHOTO);
  const addDo = async label => { await p.waitForFunction(() => { if (document.querySelector('.pop [role="menuitem"]')) return true; const b = document.querySelector('[data-addmenu]'); if (b) b.click(); return false; }, { timeout: 30000, polling: 400 }); const ok = await p.evaluate(l => { const it = [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => e.textContent.includes(l)); if (it) it.click(); return !!it; }, label); if (!ok) throw new Error('no ' + label); };
  const [c1] = await Promise.all([p.waitForFileChooser(), addDo('Add a file')]);
  await c1.accept([shot]);
  await p.waitForFunction(k => window.__mark.state().batch.students.find(s => s.key === k).files.some(f => /Photo page\.jpg$/.test(f.path)), { timeout: 30000 }, KEY);
  const added = await p.evaluate(k => window.__mark.state().batch.students.find(s => s.key === k).files.find(f => /Photo page\.jpg$/.test(f.path)).path, KEY);
  assert.deepEqual(await kindOf(p, KEY, added), { kind: 'img', pdf: true }, 'the photo added is a page');
  assert.deepEqual(errors, []);
  await ctx.close();
});
