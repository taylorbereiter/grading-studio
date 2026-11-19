// iPhone photos (HEIC) in the new app (stage 5, row 253): the decoder is a chunk of its own (next/budgets.json heic) that no page
// fetches until an HEIC picture is read. The class page and its Grades tab open without it; a download with an iPhone photo brought
// in for an assignment fetches it once and the photo opens as a page. npm run next:browser. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { standardFiles, zipOf } = require('../../../test/helpers/fixtures.js');
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
before(async () => { srv = await serveSite(); browser = await launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-heic-')); });
after(async () => { await browser.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

// The decoder's chunk, from what next/build.js last built.
const heicChunk = () => { const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'next', 'dist', 'meta.json'), 'utf8')); return path.basename(Object.entries(meta.outputs).find(([, o]) => Object.keys(o.inputs).some(i => /libheif-js\//.test(i)))[0]); };

test('the iPhone photo decoder is fetched only when an HEIC picture arrives, and the photo opens', async () => {
  const ctx = await browser.createBrowserContext(), errors = [], got = [], chunk = heicChunk();
  const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']);
  lib.classes[0].units[0].items.push({ id: 'i9', name: 'Photo homework', classId: 'c1', type: 'ic', due: '2026-11-20' });
  seed.ls['gs.lib'] = JSON.stringify(lib);
  const files = await standardFiles(), first = Object.keys(files)[0], who = first.split('/')[0];
  files[who + '/IMG_0002.HEIC'] = fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'intake', 'photo.heic'));
  const zip = path.join(dir, 'Photo homework.zip'); fs.writeFileSync(zip, zipOf(files));
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  p.on('request', r => got.push(r.url()));
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(srv.url + 'blank'); await plant(p, seed);
  await p.goto(srv.url + 'next/#/class/c1/grades');
  await p.waitForSelector('table.book', { timeout: 60000 });
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  assert.ok(!got.some(u => u.endsWith('/' + chunk)), 'not fetched before a photo arrives');
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  const [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([zip]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready, { timeout: 90000 });
  const f = await p.evaluate(() => { for (const st of window.__mark.state().batch.students) for (const x of st.files) if (/\.heic$/i.test(x.path)) return { kind: x.kind, pdf: !!x.data && x.data[0] === 0x25 && x.data[1] === 0x50 }; return null; });
  assert.deepEqual(f, { kind: 'img', pdf: true }, 'the photo became a page');
  assert.equal(got.filter(u => u.endsWith('/' + chunk)).length, 1, 'fetched once, when the photo arrived');
  assert.deepEqual(errors, []);
  await ctx.close();
});
