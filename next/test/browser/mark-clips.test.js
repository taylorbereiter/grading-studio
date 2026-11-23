// Clips to show the class in the new app (stage 6: inventory rows 361 and 521): a made-up recording added to a made-up student, a part
// of it kept as a clip (its two times and a label, nothing cut), played from its start, changed with Edit, shown to the class with
// the label and no student's name, left and right between clips and Esc to close, Setup > Clips to show the class playing them all,
// a clip deleted and brought back with Undo, and the current app opening the same clips. npm run next:browser.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady } = require('../../../test/helpers/app.js');
const { zipOf, makePaper } = require('../../../test/helpers/fixtures.js');
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
before(async () => { srv = await serveSite(); browser = await launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-media-')); });
after(async () => { await browser.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

// Nothing leaves this computer: a link's site is never asked (the player isn't opened here).
async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '') && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await p.setRequestInterception(true);
  p.on('request', r => { const u = r.url(); if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u) || /^(data|blob|about):/.test(u)) return r.continue(); r.abort(); });
  await p.evaluateOnNewDocument(STEADY);
  // GS_THROTTLE=6 runs the page that many times slower (CDP), to find what depends on timing before CI does
  if (+process.env.GS_THROTTLE > 1) await (await p.target().createCDPSession()).send('Emulation.setCPUThrottlingRate', { rate: +process.env.GS_THROTTLE });
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
const withCard = () => { const seed = gradingSeed(), lib = JSON.parse(seed.ls['gs.lib']); lib.classes[0].units[0].items.push({ id: 'i9', name: 'Speech', classId: 'c1', type: 'sum', due: '2026-11-20' }); seed.ls['gs.lib'] = JSON.stringify(lib); return seed; };
// A made-up recording: three seconds of a low tone.
function wav(secs = 3, rate = 8000) {
  const n = secs * rate, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / rate * 2 * Math.PI * 220) * 6000), 44 + i * 2);
  return b;
}
// What the work holds for each student: their files (name, kind, transcript), comment; and the download's turned videos.
const addPick = async (p, label) => {
  await p.waitForFunction(l => { const it = [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => e.textContent.includes(l)); if (it) { it.click(); return true; } const b = document.querySelector('[data-addmenu]'); if (b && !document.querySelector('.pop')) b.click(); return false; }, { timeout: 30000, polling: 500 }, label);
};
const tap = (p, sel) => p.waitForFunction(s => { const e = document.querySelector(s); if (e && !e.disabled) e.click(); return !!e && !e.disabled; }, { timeout: 30000 }, sel);
// typed into the link box until it holds it (a redraw behind the dialog can take a key)
const typeLink = async (p, url) => {
  for (let i = 0; i < 5; i++) {
    const there = await p.evaluate(() => { const e = document.querySelector('input[data-vdlink], [data-vdlink] input'); if (e) { e.focus(); e.select(); } return !!e; });
    if (!there) throw new Error('no link box: ' + await p.evaluate(() => [...document.querySelectorAll('dialog[open]')].map(d => d.outerHTML.slice(0, 1500)).join('\n---\n')));
    await p.keyboard.type(url);
    if (await p.waitForFunction(() => { const b = document.querySelector('[data-vdadd]'); return b && !b.disabled; }, { timeout: 3000 }).then(() => true, () => false)) return;
  }
  throw new Error('the link box: ' + await p.evaluate(() => document.querySelector('input[data-vdlink], [data-vdlink] input').value));
};
const student = (p, key) => p.evaluate(k => window.__mark.state().batch.students.find(s => s.key === k), key);
const goTo = async (p, key) => {
  const i = await p.evaluate(k => window.__mark.state().batch.students.findIndex(s => s.key === k), key);
  await p.click('[data-st="' + i + '"]');
  await p.waitForFunction(i => window.__mark.state().cur === i && window.__mark.ready, { timeout: 60000 }, i);
};

const clips = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__mark.state().batch.clips || [])));
const media = 'document.querySelector(".media audio, .media video")';

test('clips: kept, played, changed, shown to the class, played in turn from Setup, deleted with Undo, and the current app has the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  await p.evaluate(() => Promise.all([['grading-studio-added', 'files'], ['grading-studio-videos', 'v']].map(([n, s]) => new Promise(res => { const r = indexedDB.open(n, 1); r.onupgradeneeded = () => r.result.createObjectStore(s); r.onsuccess = () => { r.result.close(); res(); }; }))));
  const z = path.join(dir, 'Speech.zip'); fs.writeFileSync(z, zipOf({ 'Aria Testwell/Outline.pdf': await makePaper({ title: 'An outline' }) }));
  const rec = path.join(dir, 'Speech take.wav'); fs.writeFileSync(rec, wav(6));
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  let [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);
  await goTo(p, 'Aria Testwell');
  await addPick(p, 'video or recording');
  await p.waitForSelector('dialog[open] [data-vdadd]');
  [chooser] = await Promise.all([p.waitForFileChooser(), p.click('dialog[open] [data-v="file"]')]);
  await chooser.accept([rec]);
  await p.waitForFunction(() => /Speech take\.wav/.test(document.querySelector('.vdfile').textContent));
  await tap(p, '[data-vdadd]');
  await p.waitForFunction(m => { const a = eval(m); return a && a.readyState >= 1 && a.duration > 5; }, { timeout: 60000 }, media);

  // Clip starts where the video is; the end typed; a label
  await p.evaluate(m => { eval(m).currentTime = 1; }, media);
  await p.waitForFunction(m => eval(m).currentTime >= 1, {}, media);
  await tap(p, '.media [data-clipnew]');
  await p.waitForFunction(() => document.querySelector('[data-ca]').value === '0:01' && document.activeElement === document.querySelector('[data-ct]'));
  await p.type('[data-cb]', '0:03');
  await p.type('[data-ct]', 'Strong opening');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => (window.__mark.state().batch.clips || []).length === 1);
  const one = (await clips(p))[0];
  assert.deepEqual({ a: one.a, b: one.b, t: one.t, u: /^gs-video:/.test(one.u) }, { a: 1, b: 3, t: 'Strong opening', u: true }, 'two times and a label, on the recording kept in this browser');
  // a second one, its times typed; then the end before the start is refused
  await tap(p, '.media [data-clipnew]');
  await p.waitForFunction(() => document.activeElement === document.querySelector('[data-ct]'));
  await p.evaluate(() => { const a = document.querySelector('[data-ca]'); a.value = ''; a.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.type('[data-ca]', '0:04'); await p.type('[data-cb]', '0:02'); await p.click('[data-clipsave]');
  await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(e => /after the start/.test(e.textContent)));
  await p.evaluate(() => { const b = document.querySelector('[data-cb]'); b.value = ''; b.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.type('[data-cb]', '0:05'); await p.click('[data-clipsave]');
  await p.waitForFunction(() => (window.__mark.state().batch.clips || []).length === 2);
  assert.equal((await clips(p))[1].t, 'Clip 2', 'a clip with no label is numbered');
  // played from its start, and stopped at its end
  await p.click('[data-clip="' + one.id + '"] [data-clipplay]');
  await p.waitForFunction(m => { const a = eval(m); return !a.paused && a.currentTime >= 1; }, { timeout: 10000 }, media);
  await p.waitForFunction(m => { const a = eval(m); return a.paused && a.currentTime >= 3; }, { timeout: 15000 }, media);
  // Edit: its label changed, one undo step
  await p.click('[data-clip="' + one.id + '"] [data-clipedit]');
  await p.waitForFunction(() => document.activeElement === document.querySelector('[data-ct]'));
  await p.evaluate(() => { const t = document.querySelector('[data-ct]'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.type('[data-ct]', 'The opening'); await p.click('[data-clipsave]');
  await p.waitForFunction(() => window.__mark.state().batch.clips[0].t === 'The opening');
  // shown to the class: the label, no student's name; right and left between clips, Esc closes
  await p.click('[data-clip="' + one.id + '"] [data-clipshow]');
  await p.waitForSelector('[data-clipstage]');
  const stage = await p.$eval('[data-clipstage]', e => e.textContent);
  assert.match(stage, /The opening/); assert.ok(!/Aria|Testwell/.test(stage), 'no student\'s name on the class\'s screen');
  assert.equal(await p.$eval('[data-csat]', e => e.textContent), '1 of 2');
  await p.keyboard.press('ArrowRight');
  await p.waitForFunction(() => document.querySelector('[data-csat]').textContent === '2 of 2' && /Clip 2/.test(document.querySelector('[data-clipstage]').textContent));
  await p.keyboard.press('ArrowLeft');
  await p.waitForFunction(() => document.querySelector('[data-csat]').textContent === '1 of 2');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('[data-clipstage]'));
  // Setup > Clips to show the class: all of them, from the first
  await p.click('[data-setupopen]').catch(() => {});
  await p.waitForFunction(() => { const it = [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => /Clips to show the class/.test(e.textContent)); if (it) it.click(); return !!it; }, { timeout: 10000 });
  await p.waitForSelector('[data-clipstage]');
  assert.equal(await p.$eval('[data-csat]', e => e.textContent), '1 of 2');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('[data-clipstage]'));
  // deleted, and brought back with Undo
  await p.click('[data-clip="' + (await clips(p))[1].id + '"] [data-clipdel]');
  await p.waitForFunction(() => window.__mark.state().batch.clips.length === 1);
  await p.waitForFunction(() => { const b = [...document.querySelectorAll('.toast button')].find(e => /Undo/.test(e.textContent)); if (b) b.click(); return !!b; });
  await p.waitForFunction(() => window.__mark.state().batch.clips.length === 2);

  await p.evaluate(() => window.__mark.saved());
  const now = await clips(p);
  await p.close();
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  assert.deepEqual(await m.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().batch.clips))), now, 'the current app has the same clips');
  assert.deepEqual(errors, []);
  await ctx.close();
});
