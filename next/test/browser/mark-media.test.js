// Video and audio papers on the new app (stage 4, part d): a made-up recording kept in this browser and a made-up link added to two
// made-up students through Add, A video or recording…, with notes pages; the recording plays, + Time to comment puts the time in the
// comment, a transcript is pasted and a line plays from its time, taken off and made in this browser (the speech engine stood in for),
// the same link isn't added twice, the link turned a quarter with Undo, and the current app opens the same. npm run next:browser.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady } = require('../../../test/helpers/app.js');
const { zipOf, makePaper } = require('../../../test/helpers/fixtures.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');

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
const OUT = `b => JSON.parse(JSON.stringify({ students: b.students.filter(s => s.files.length).map(s => ({ key: s.key, comment: (s.grade && s.grade.comment) || '', files: s.files.map(f => ({ path: f.path, tr: f.tr || null })).sort((a, z) => a.path < z.path ? -1 : 1) })).sort((a, z) => a.key < z.key ? -1 : 1), vrot: b.vrot || null }))`;
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

test('a recording and a link added to students: played, the time put in the comment, a transcript pasted and made, a video turned, notes pages, and the current app opens the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, withCard());
  // the stores the current app makes the first time a download opens and a video is kept there (the new app never makes them)
  await p.evaluate(() => Promise.all([['grading-studio-added', 'files'], ['grading-studio-videos', 'v']].map(([n, s]) => new Promise(res => { const r = indexedDB.open(n, 1); r.onupgradeneeded = () => r.result.createObjectStore(s); r.onsuccess = () => { r.result.close(); res(); }; }))));
  const z = path.join(dir, 'Speech.zip'); fs.writeFileSync(z, zipOf({ 'Aria Testwell/Outline.pdf': await makePaper({ title: 'An outline' }), 'Bram Sample/Outline.pdf': await makePaper({ title: 'Another outline' }) }));
  const rec = path.join(dir, 'Speech take.wav'); fs.writeFileSync(rec, wav());
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.click('[data-bring-for="i9"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  let [chooser] = await Promise.all([p.waitForFileChooser(), p.click('.pop [role="menuitem"]')]);
  await chooser.accept([z]);
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const id = await p.evaluate(() => window.__mark.state().batch.id);

  // Aria: Add, A video or recording…, a video file, with a lined notes page
  await goTo(p, 'Aria Testwell');
  await addPick(p, 'video or recording');
  await p.waitForSelector('dialog[open] [data-vdadd]');
  [chooser] = await Promise.all([p.waitForFileChooser(), p.click('dialog[open] [data-v="file"]')]);
  await chooser.accept([rec]);
  await p.waitForFunction(() => /Speech take\.wav/.test(document.querySelector('.vdfile').textContent));
  await tap(p, '[data-np="lined"]');
  await tap(p, '[data-vdadd]');
  await p.waitForFunction(() => window.__mark.state().batch.students.find(s => s.key === 'Aria Testwell').files.length === 3 && window.__mark.ready, { timeout: 60000 });
  const aria = await student(p, 'Aria Testwell');
  assert.deepEqual(aria.files.map(f => f.name), ['Outline.pdf', 'Presentation video.url', 'Presentation notes.pdf'], 'the recording kept in this browser, and its notes page');
  // it plays from where it is kept; + Time to comment puts the time in her comment
  await p.waitForFunction(() => { const a = document.querySelector('.media audio, .media video'); return a && a.readyState >= 1 && a.duration > 2; }, { timeout: 60000 });
  await p.evaluate(() => { document.querySelector('.media audio, .media video').currentTime = 1.6; });
  await p.waitForFunction(() => document.querySelector('.media audio, .media video').currentTime > 1.5);
  await p.click('.media [data-stamp]');
  await p.waitForFunction(() => /\[0:01\]/.test(window.__mark.state().batch.students.find(s => s.key === 'Aria Testwell').grade.comment || ''));
  // J goes back 5 seconds (not before the start), Space plays and pauses
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('j');
  await p.waitForFunction(() => document.querySelector('.media audio, .media video').currentTime === 0);
  await p.keyboard.press(' ');
  await p.waitForFunction(() => !document.querySelector('.media audio, .media video').paused);
  await p.keyboard.press(' ');
  await p.waitForFunction(() => document.querySelector('.media audio, .media video').paused);
  // a transcript pasted; a line plays from its time
  await p.click('.media [data-trpaste]');
  await p.type('.media [data-trta]', '[0:00] Good morning, everyone.\n[0:02] Today, the tides.');
  await p.click('.media [data-trsave]');
  await p.waitForFunction(() => document.querySelectorAll('.media .trl').length === 2);
  // Copy text: the whole transcript, with its times, on the clipboard in one press
  await p.evaluate(() => { window.__copied = []; navigator.clipboard.writeText = async s => { window.__copied.push(s); }; });
  await p.click('.media [data-trcopy]');
  await p.waitForFunction(() => window.__copied.length === 1);
  assert.match(await p.evaluate(() => window.__copied[0]), /0:00\]? ?Good morning, everyone\.[\s\S]*0:02\]? ?Today, the tides\./, 'the transcript copied');
  await p.click('.media .trl[data-t="2"]');
  await p.waitForFunction(() => Math.abs(document.querySelector('.media audio, .media video').currentTime - 2) < 0.3, { timeout: 10000 });
  // taken off, with an Undo; then made in this browser, the speech engine stood in for
  await p.click('.media [data-trdel]');
  await p.waitForFunction(() => !document.querySelector('.media .trl'));
  await p.evaluate(() => {
    window.__media.asrStandIn.decode = async () => new Float32Array(16000 * 3).fill(0.1);
    window.__media.asrStandIn.call = async m => m.type === 'load' ? { type: 'ready' } : { type: 'result', words: [[' Hello', 0.2], [' class.', 0.9], [' Tides', 1.6], [' rise.', 2.2]] };
  });
  await p.click('.media [data-trmake]');
  await p.waitForSelector('.media [data-trgo]');
  await p.click('.media [data-trgo]');
  await p.waitForFunction(() => /Hello class\./.test((document.querySelector('.media .trans') || {}).textContent || ''), { timeout: 60000 });

  // Bram: a link, and a notes page with two columns
  await goTo(p, 'Bram Sample');
  await addPick(p, 'video or recording');
  await p.waitForSelector('dialog[open] [data-vdlink]');
  await typeLink(p, 'https://www.youtube.com/watch?v=abcDEF12345');
  await tap(p, '[data-np="none"]');
  await tap(p, '[data-vdadd]');
  await p.waitForFunction(() => window.__mark.state().batch.students.find(s => s.key === 'Bram Sample').files.length === 2 && document.querySelector('.media.vlink') && !document.querySelector('[data-vdadd]'), { timeout: 60000 });
  // the same link again isn't added twice
  await addPick(p, 'video or recording');
  await p.waitForSelector('dialog[open] [data-vdlink]');
  await typeLink(p, 'https://youtu.be/abcDEF12345');
  await tap(p, '[data-np="none"]');
  await tap(p, '[data-vdadd]');
  await p.waitForFunction(() => !document.querySelector('[data-vdadd]'));
  assert.equal((await student(p, 'Bram Sample')).files.length, 2, 'the same video isn’t added twice');
  // turned a quarter, and back with Undo, then turned again
  await tap(p, '.media.vlink [data-vrot]');
  await p.waitForFunction(() => { const v = window.__mark.state().batch.vrot; return v && Object.values(v)[0] === 90; });
  await tap(p, '[data-undo]');
  await p.waitForFunction(() => !window.__mark.state().batch.vrot);
  await tap(p, '.media.vlink [data-vrot]');
  await p.waitForFunction(() => { const v = window.__mark.state().batch.vrot; return v && Object.values(v)[0] === 90; });
  await addPick(p, 'notes page');
  await p.waitForSelector('dialog[open] [data-npadd]');
  await tap(p, '[data-np="cols"]');
  await tap(p, '[data-npadd]');
  await p.waitForFunction(() => window.__mark.state().batch.students.find(s => s.key === 'Bram Sample').files.length === 3, { timeout: 60000 });

  await p.evaluate(() => window.__mark.saved());
  const now = await p.evaluate(o => eval(o)(window.__mark.state().batch), OUT);
  assert.ok(now.students.find(s => s.key === 'Aria Testwell').files.find(f => /video/.test(f.path)).tr.w, 'the transcript made in this browser');
  await p.close();
  // the current app opens the same: files, transcript, comment, the turned video, and plays the kept recording
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  const was = await m.evaluate(o => eval(o)(window.__gs.state().batch), OUT);
  assert.deepEqual(was, now, 'the current app opens the same files, transcripts, comments and turned video');
  assert.deepEqual(await m.evaluate(() => window.__gs.state().batch.students.filter(s => s.files.length).map(s => s.files.filter(f => window.__gs.isNotes ? window.__gs.isNotes(f.data) : /notes/.test(f.path)).length)), [1, 1], 'a notes page each');
  assert.deepEqual(errors, []);
  await ctx.close();
});
