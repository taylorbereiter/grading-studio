// Google Drive's own chooser and Drive's files in the new app (stage 6, item 5): papers picked in Drive come in as files from the
// computer do, Return saves the marked files to Drive, and a video picked in Drive is added to a student, downloaded for offline and
// the download removed. Google is played by this test (its chooser and Drive's answers), so no real account is reached and nothing
// leaves the test. Every student and file here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { makePaper } = require('../../../test/helpers/fixtures.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { plantPlan } = require('./planseed.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/next/') p = '/next/index.html';
    const ok = /^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p);
    const f = path.join(ROOT, p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

// Google, as far as the app uses it: the sign-in script, the chooser (window.__picks: what it hands back next, in order), and Drive's
// answers from D (papers and videos by id; folders it makes; files it is sent).
async function fakeGoogle(page, D) {
  await page.evaluateOnNewDocument(() => {
    window.__picks = []; window.__pickerSeen = [];
    const P = {
      ViewId: { DOCS: 'docs' }, DocsViewMode: { LIST: 'list' }, Feature: { MULTISELECT_ENABLED: 'multi', SUPPORT_DRIVES: 'drives' },
      Action: { PICKED: 'picked', CANCEL: 'cancel' }, Response: { ACTION: 'action', DOCUMENTS: 'docs' },
      DocsView: class { constructor() { this.o = {}; } setIncludeFolders() { return this; } setMode() { return this; } setSelectFolderEnabled(v) { this.o.pickFolder = v; return this; } setMimeTypes(v) { this.o.mimes = v; return this; } setParent(v) { this.o.parent = v; return this; } setLabel(v) { this.o.label = v; return this; } setOwnedByMe() { return this; } setEnableDrives() { return this; } },
      PickerBuilder: class {
        constructor() { this.o = { features: [], views: [] }; }
        setOAuthToken(t) { this.o.token = t; return this; } setAppId() { return this; } setOrigin() { return this; } setTitle(v) { this.o.title = v; return this; }
        addView(v) { this.o.views.push(v.o); return this; } enableFeature(f) { this.o.features.push(f); return this; } setCallback(cb) { this.cb = cb; return this; }
        build() { return { setVisible: () => { window.__pickerSeen.push(this.o); const docs = window.__picks.shift() || []; setTimeout(() => this.cb(docs.length ? { action: 'picked', docs } : { action: 'cancel' }), 20); } }; }
      },
    };
    window.google = { picker: P, accounts: { oauth2: { initTokenClient: o => ({ requestAccessToken: () => setTimeout(() => o.callback({ access_token: 'tok', expires_in: 3600, scope: o.scope }), 10) }), revoke: () => {} } } };
    window.gapi = { load: (n, o) => setTimeout(o.callback, 0) };
  });
  await page.setRequestInterception(true);
  page.on('request', r => {
    const u = r.url();
    if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u) || /^(data|blob|about):/.test(u)) return r.continue();
    D.asked.push(r.method() + ' ' + u);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Expose-Headers': 'Content-Length, Content-Type' };
    const json = (o, status = 200) => r.respond({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(o) });
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: cors, body: '' });
    if (/\/about\?/.test(u)) return json({ user: { emailAddress: 'teacher@example.com' } });
    if (/googleapis\.com\/drive\/v3\/files\?/.test(u) && r.method() === 'POST') {   // a folder: only under one it made, or My Drive (drive.file)
      const pd = r.postData() || '', parent = (/"parents":\["([^"]+)"/.exec(pd) || [])[1], name = (/"name":"([^"]+)"/.exec(pd) || [])[1];
      if (parent && parent !== 'root' && !parent.startsWith('made')) return json({ error: { message: 'File not found' } }, 404);
      const id = 'made' + (D.folders.length + 1); D.folders.push({ id, name, parent }); return json({ id });
    }
    if (/upload\/drive\/v3\/files\?uploadType=multipart/.test(u)) return (async () => { const pd = r.postData() || await r.fetchPostData() || ''; D.sent.push({ name: (/"name":"([^"]+)"/.exec(pd) || [])[1], parent: (/"parents":\["([^"]+)"/.exec(pd) || [])[1] }); return json({ id: 'up' + D.sent.length }); })();
    if (/drive\/v3\/files\/[\w-]+\?fields=parents/.test(u)) return json({ parents: ['1ParentNotOursParentNotOurs000000'] });
    const fm = /drive\/v3\/files\/([\w-]+)\?fields=id/.exec(u);
    if (fm) return D.videos[fm[1]] ? json({ id: fm[1] }) : json({ error: { message: 'File not found' } }, 404);
    const m = /drive\/v3\/files\/([\w-]+)\?alt=media/.exec(u);
    if (m && D.videos[m[1]]) return r.respond({ status: 200, headers: { ...cors, 'Content-Length': String(D.videos[m[1]].length) }, contentType: 'video/webm', body: D.videos[m[1]] });
    if (m && D.papers[m[1]]) return r.respond({ status: 200, headers: cors, contentType: 'application/pdf', body: D.papers[m[1]] });
    if (m) return json({ error: { message: 'File not found' } }, 404);
    if (/appDataFolder/.test(u)) return json({ files: [] });   // the sync's own file: not part of this test
    json({ error: { message: 'not in this test' } }, 404);
  });
}
async function page(ctx, errors, D) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  await p.setBypassServiceWorker(true);
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  await fakeGoogle(p, D);
  return p;
}
const seed = () => { const s = gradingSeed(), lib = JSON.parse(s.ls['gs.lib']); lib.classes[0].units[0].items.push({ id: 'i9', name: 'Speech', classId: 'c1', type: 'sum', due: '2026-11-20' }); s.ls['gs.lib'] = JSON.stringify(lib); s.ls['gs.gEmail'] = JSON.stringify('teacher@example.com'); return s; };
const menuPick = (p, text) => p.waitForFunction(l => { const it = [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => e.textContent.includes(l)); if (it) it.click(); return !!it; }, { timeout: 30000 }, text);
const tap = (p, sel) => p.waitForFunction(s => { const e = document.querySelector(s); if (e && !e.disabled) e.click(); return !!e && !e.disabled; }, { timeout: 30000 }, sel);
const goTo = async (p, key) => {
  const i = await p.evaluate(k => window.__mark.state().batch.students.findIndex(s => s.key === k), key);
  await p.click('[data-st="' + i + '"]');
  await p.waitForFunction(i => window.__mark.state().cur === i && window.__mark.ready, { timeout: 60000 }, i);
};
// A made-up video: two seconds of a moving square, recorded in the page.
const makeVideo = p => p.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 160; c.height = 90; const g = c.getContext('2d');
  const rec = new MediaRecorder(c.captureStream(15), { mimeType: 'video/webm' }), parts = [];
  rec.ondataavailable = e => parts.push(e.data);
  let i = 0; const iv = setInterval(() => { g.fillStyle = '#1F6FB2'; g.fillRect(0, 0, 160, 90); g.fillStyle = '#fff'; g.fillRect((i++ * 4) % 140, 30, 20, 20); }, 60);
  rec.start(); await new Promise(r => setTimeout(r, 2000)); rec.stop(); await new Promise(r => { rec.onstop = r; }); clearInterval(iv);
  const b = new Uint8Array(await new Blob(parts).arrayBuffer()); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s);
});

test('D-004: papers picked in Drive come in for an assignment; Return saves the marked files to Drive, in My Drive when the folder beside them is not the app’s', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const D = { asked: [], folders: [], sent: [], videos: {}, papers: { '1PaperAriaPaperAriaPaperAria00001': await makePaper({ title: 'Aria outline' }), '1PaperBramPaperBramPaperBram00002': await makePaper({ title: 'Bram outline' }) } };
  const p = await page(ctx, errors, D);
  await p.goto(srv.url + 'blank'); await plant(p, seed());
  // the stores the current app makes the first time a download opens
  await p.evaluate(() => Promise.all([['grading-studio-added', 'files'], ['grading-studio-videos', 'v']].map(([n, s]) => new Promise(res => { const r = indexedDB.open(n, 1); r.onupgradeneeded = () => r.result.createObjectStore(s); r.onsuccess = () => { r.result.close(); res(); }; }))));
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.evaluate(() => { window.__picks.push([
    { id: '1PaperAriaPaperAriaPaperAria00001', name: 'Aria Testwell.pdf', mimeType: 'application/pdf', sizeBytes: '900', parentId: '1ParentNotOursParentNotOurs000000' },
    { id: '1PaperBramPaperBramPaperBram00002', name: 'Bram Sample.pdf', mimeType: 'application/pdf', sizeBytes: '900', parentId: '1ParentNotOursParentNotOurs000000' }]); });
  await p.click('[data-bring-for="i9"]');
  await menuPick(p, 'Google Drive');
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  const seen = await p.evaluate(() => window.__pickerSeen[0]);
  assert.ok(seen.features.includes('multi'), 'many papers at once');
  // D-004: the chooser's tabs as the current app names them, and the folder the papers came from remembered for next time
  assert.deepEqual(seen.views.map(v => v.label), ['My Drive', 'Shared with me', 'Shared drives']);
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('gs.gPaperDir'))), '1ParentNotOursParentNotOurs000000', 'kept where the current app keeps it');
  assert.deepEqual(await p.evaluate(() => window.__mark.state().batch.students.filter(s => s.files.length).map(s => s.key).sort()), ['Aria Testwell', 'Bram Sample']);
  assert.deepEqual(await p.evaluate(() => window.__mark.state().batch.drive), { id: '1PaperAriaPaperAriaPaperAria00001', name: 'Aria Testwell.pdf', kind: 'files' }, 'the download remembers it came from Drive');
  assert.ok(!D.asked.some(u => /files\?q=|files\?spaces=drive/.test(u)), 'the app never lists her Drive');

  // Return: Save to Google Drive, into a new folder (My Drive, since the folder beside the papers isn't one the app may write in)
  await p.evaluate(() => { location.hash = '#/mark/' + encodeURIComponent(window.__mark.state().batch.id) + '/return'; });
  // nothing is marked here: Also send back files with no marks
  await p.waitForFunction(() => { const l = [...document.querySelectorAll('.mk-ret label')].find(x => /files with no marks/.test(x.textContent)); if (l) l.click(); return !!l; }, { timeout: 30000 });
  await tap(p, '[data-go="drive"]').catch(async e => { throw new Error(e.message + ': ' + await p.evaluate(() => location.hash + ' ' + (document.querySelector('.mk-ret') || document.body).textContent.slice(0, 600))); });
  await p.waitForFunction(() => /My Drive/.test((document.querySelector('#xStatus') || {}).textContent || ''), { timeout: 60000 });
  const top = D.folders.find(f => f.parent === 'root');
  assert.ok(top && /^Marked - /.test(top.name), 'a new folder in My Drive: ' + JSON.stringify(D.folders));
  const out = D.sent.filter(s => s.parent !== 'appDataFolder');   // (the sync and the papers going to the app's own folder are the sync's)
  assert.ok(out.length >= 3 && out.every(s => s.parent && s.parent.startsWith('made')), 'every file goes into the new folder: ' + JSON.stringify(out));
  assert.ok(out.some(s => /^Grade sheet - /.test(s.name)) && out.some(s => /^Aria Testwell/.test(s.name)) && out.some(s => /^Bram Sample/.test(s.name)), 'the grade sheet and each student\u2019s file');
  assert.ok(await p.evaluate(() => !!(window.__mark.state().batch.returned || {}).t), 'the papers count as exported');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a video picked in Drive: added to a student, downloaded for offline, played from the download, and the download removed', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const D = { asked: [], folders: [], sent: [], videos: {}, papers: { '1PaperAriaPaperAriaPaperAria00001': await makePaper({ title: 'Aria outline' }) } };
  const p = await page(ctx, errors, D);
  await p.goto(srv.url + 'blank'); await plant(p, seed());
  await p.evaluate(() => Promise.all([['grading-studio-added', 'files'], ['grading-studio-videos', 'v']].map(([n, s]) => new Promise(res => { const r = indexedDB.open(n, 1); r.onupgradeneeded = () => r.result.createObjectStore(s); r.onsuccess = () => { r.result.close(); res(); }; }))));
  D.videos['1VideoAriaVideoAriaVideoAria00009'] = Buffer.from(await makeVideo(p), 'base64');
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.evaluate(() => { window.__picks.push([{ id: '1PaperAriaPaperAriaPaperAria00001', name: 'Aria Testwell.pdf', mimeType: 'application/pdf', sizeBytes: '900' }]); });
  await p.click('[data-bring-for="i9"]');
  await menuPick(p, 'Google Drive');
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  await goTo(p, 'Aria Testwell');

  // Add, A video…, From Google Drive: the videos folder first (once), then the video, opening in that folder
  const size = D.videos['1VideoAriaVideoAriaVideoAria00009'].length;
  await p.evaluate(n => { window.__picks.length = 0; window.__picks.push([{ id: '1FolderVideosFolderVideos0000007', name: 'Class videos', mimeType: 'application/vnd.google-apps.folder' }], [{ id: '1VideoAriaVideoAriaVideoAria00009', name: 'Aria speech.webm', mimeType: 'video/webm', sizeBytes: String(n) }]); }, size);
  await p.waitForFunction(() => { const it = [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => /video or recording/.test(e.textContent)); if (it) { it.click(); return true; } const b = document.querySelector('[data-addmenu]'); if (b && !document.querySelector('.pop')) b.click(); return false; }, { timeout: 30000, polling: 500 });
  await p.waitForSelector('dialog[open] [data-vdadd]');
  await p.click('dialog[open] [data-v="drive"]');
  await p.waitForFunction(() => /Aria speech\.webm/.test((document.querySelector('.vdfile') || {}).textContent || ''), { timeout: 30000 });
  const views = await p.evaluate(() => window.__pickerSeen.slice(-2));
  assert.equal(views[0].views[0].pickFolder, true, 'the videos folder is asked for first');
  assert.equal(views[1].views[0].parent, '1FolderVideosFolderVideos0000007', 'the video chooser opens in that folder');
  await tap(p, '[data-np="none"]');
  await tap(p, '[data-vdadd]');
  await p.waitForFunction(() => window.__mark.state().batch.students.find(s => s.key === 'Aria Testwell').files.length === 2 && window.__mark.ready, { timeout: 60000 });
  const link = await p.evaluate(() => { const f = window.__mark.state().batch.students.find(s => s.key === 'Aria Testwell').files.find(f => f.kind === 'link'); return new TextDecoder().decode(f.data); });
  assert.match(link, /GsDrive=1VideoAriaVideoAriaVideoAria00009/, 'only the link is kept in the work, as the current app writes it');
  assert.match(link, /Name=Aria speech\.webm/);

  // no service worker in this test, so it isn't played from Drive: Download for offline, then it plays from the download
  await p.waitForSelector('.vdrv [data-drvget]', { timeout: 60000 });
  assert.ok(await p.$('.vdrv [data-drvweb]'), 'Watch in Drive’s player is offered');
  await p.click('.vdrv [data-drvget]');
  await p.waitForSelector('[data-drvdrop]', { timeout: 60000 }).catch(async e => { throw new Error(e.message + ': ' + await p.evaluate(() => document.querySelector('.vdrv').textContent) + ' ' + JSON.stringify(D.asked.slice(-5)) + JSON.stringify(errors)); });
  await p.waitForFunction(() => { const v = document.querySelector('.media video'); return v && v.readyState >= 1; }, { timeout: 60000 });
  const kept = await p.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-videos'); r.onsuccess = () => { const q = r.result.transaction('v').objectStore('v').get('d-1VideoAriaVideoAriaVideoAria00009'); q.onsuccess = () => { res(q.result ? { name: q.result.name, size: q.result.size } : null); r.result.close(); }; }; }));
  assert.deepEqual(kept, { name: 'Aria speech.webm', size }, 'the download is kept where the current app keeps it');

  // Remove download: gone from this browser, the choices again
  await p.click('[data-drvdrop]');
  await p.waitForSelector('.vdrv [data-drvget]', { timeout: 30000 });
  const left = await p.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-videos'); r.onsuccess = () => { const q = r.result.transaction('v').objectStore('v').count(); q.onsuccess = () => { res(q.result); r.result.close(); }; }; }));
  assert.equal(left, 0, 'the download is gone');
  // Watch in Drive's player: the link card
  await p.click('.vdrv [data-drvweb]');
  await p.waitForSelector('.vlink [data-vopen]', { timeout: 30000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

// D-042 (and C-055): + Add on one student's paper has From Google Drive, which adds the file picked there to her, kept where the
// current app keeps added files.
test('D-042: + Add > From Google Drive adds the file picked in Drive to that student, kept where the current app keeps added files', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const D = { asked: [], folders: [], sent: [], videos: {}, papers: { '1PaperAriaPaperAriaPaperAria00001': await makePaper({ title: 'Aria outline' }), '1PaperLateLatePaperLatePaper00003': await makePaper({ title: 'Aria late page' }) } };
  const p = await page(ctx, errors, D);
  await p.goto(srv.url + 'blank'); await plant(p, seed());
  await p.evaluate(() => Promise.all([['grading-studio-added', 'files'], ['grading-studio-videos', 'v']].map(([n, s]) => new Promise(res => { const r = indexedDB.open(n, 1); r.onupgradeneeded = () => r.result.createObjectStore(s); r.onsuccess = () => { r.result.close(); res(); }; }))));
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.evaluate(() => { window.__picks.push([{ id: '1PaperAriaPaperAriaPaperAria00001', name: 'Aria Testwell.pdf', mimeType: 'application/pdf', sizeBytes: '900' }]); });
  await p.evaluate(() => localStorage.setItem('gs.gPaperDir', JSON.stringify('1FolderPapersFolderPapers0000001')));
  await p.click('[data-bring-for="i9"]');
  await menuPick(p, 'Google Drive');
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  // D-004: papers open first in the folder she last took papers from
  assert.deepEqual(await p.evaluate(() => { const v = window.__pickerSeen[0].views[0]; return [v.label, v.parent]; }), ['Last folder', '1FolderPapersFolderPapers0000001']);
  await goTo(p, 'Aria Testwell');
  await p.evaluate(() => { window.__picks.length = 0; window.__picks.push([{ id: '1PaperLateLatePaperLatePaper00003', name: 'Late page.pdf', mimeType: 'application/pdf', sizeBytes: '900' }]); });
  await p.waitForFunction(() => { const it = [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => e.textContent.trim() === 'From Google Drive'); if (it) { it.click(); return true; } const b = document.querySelector('[data-addmenu]'); if (b && !document.querySelector('.pop')) b.click(); return false; }, { timeout: 30000, polling: 500 });
  await p.waitForFunction(() => window.__mark.state().batch.students.find(s => s.key === 'Aria Testwell').files.some(f => f.name === 'Late page.pdf' && f.added), { timeout: 60000 });
  assert.equal(await p.evaluate(() => window.__pickerSeen.slice(-1)[0].features.includes('multi')), true, 'more than one file can be picked');
  // the paper shows it at once, with its Added tag
  await p.waitForSelector('[data-fmenu="Aria Testwell/Late page.pdf"]', { timeout: 30000 });
  await p.evaluate(() => window.__mark.saved());
  const kept = await p.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-added'); r.onsuccess = () => { const q = r.result.transaction('files').objectStore('files').getAll(); q.onsuccess = () => { res(q.result.map(x => [x.key, x.path, x.name])); r.result.close(); }; }; }));
  assert.ok(kept.some(([k, pth, n]) => k === 'Aria Testwell' && pth === 'Aria Testwell/Late page.pdf' && n === 'Late page.pdf'), JSON.stringify(kept));
  assert.deepEqual(errors, []);
  await ctx.close();
});

// D-006 D-007 D-036: Partners and videos with Drive. Choose from Drive… above the list picks many videos, each going to the student
// named in its file name; the folder line says where the chooser opens and Change folder changes it; Drive… on a row picks that
// student's video; Save adds each as the shortcut the current app writes. Add, A video shows the same folder line.
test('D-006 D-007 D-036: Choose from Drive… matched by name, Change folder, Drive… on a row, and the folder line in Add a video', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const D = { asked: [], folders: [], sent: [], videos: {}, papers: { '1PaperAriaPaperAriaPaperAria00001': await makePaper({ title: 'Aria outline' }), '1PaperBramPaperBramPaperBram00002': await makePaper({ title: 'Bram outline' }) } };
  const p = await page(ctx, errors, D);
  await p.goto(srv.url + 'blank'); await plant(p, seed());
  await p.evaluate(() => Promise.all([['grading-studio-added', 'files'], ['grading-studio-videos', 'v']].map(([n, s]) => new Promise(res => { const r = indexedDB.open(n, 1); r.onupgradeneeded = () => r.result.createObjectStore(s); r.onsuccess = () => { r.result.close(); res(); }; }))));
  await p.goto(srv.url + 'next/#/class/c1/work');
  await p.waitForSelector('[data-bring-for="i9"]', { timeout: 60000 });
  await p.evaluate(() => { window.__picks.push([
    { id: '1PaperAriaPaperAriaPaperAria00001', name: 'Aria Testwell.pdf', mimeType: 'application/pdf', sizeBytes: '900' },
    { id: '1PaperBramPaperBramPaperBram00002', name: 'Bram Sample.pdf', mimeType: 'application/pdf', sizeBytes: '900' }]); });
  await p.click('[data-bring-for="i9"]');
  await menuPick(p, 'Google Drive');
  await p.waitForFunction(() => /^#\/mark\//.test(location.hash) && window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  await tap(p, '[data-setupopen]');
  await menuPick(p, 'Partners and videos');
  await p.waitForSelector('dialog[open] [data-pvmany]');
  // the videos folder first (once), then two videos, each named for a student
  await p.evaluate(() => { window.__picks.length = 0; window.__picks.push([{ id: '1FolderVideosFolderVideos0000007', name: 'Class videos', mimeType: 'application/vnd.google-apps.folder' }],
    [{ id: '1VideoAriaVideoAriaVideoAria00009', name: 'Aria Testwell speech.webm', mimeType: 'video/webm', sizeBytes: '2000' }, { id: '1VideoBramVideoBramVideoBram00010', name: 'Bram Sample talk.webm', mimeType: 'video/webm', sizeBytes: '3000' }]); });
  await p.click('dialog[open] [data-pvmany]');
  await p.waitForFunction(() => /Aria Testwell speech\.webm/.test(document.querySelector('[data-pvrow="Aria Testwell"]').textContent) && /Bram Sample talk\.webm/.test(document.querySelector('[data-pvrow="Bram Sample"]').textContent), { timeout: 30000 });
  assert.match(await p.$eval('[data-pvrow="Aria Testwell"]', e => e.textContent), /Google Drive/, 'marked as from Drive');
  assert.equal(await p.evaluate(() => window.__pickerSeen.slice(-1)[0].features.includes('multi')), true, 'many at once');
  // the line is asked of the video part, so it shows a moment after the box opens
  await p.waitForFunction(() => /Class videos.*Change folder/.test((document.querySelector('dialog[open] .vddir') || {}).textContent || ''), { timeout: 30000 });
  // Change folder
  await p.evaluate(() => { window.__picks.push([{ id: '1FolderOtherFolderOtherFolder00008', name: 'Speeches 2026', mimeType: 'application/vnd.google-apps.folder' }]); });
  await p.click('dialog[open] [data-vddir]');
  await p.waitForFunction(() => /Speeches 2026/.test((document.querySelector('dialog[open] .vddir') || {}).textContent || ''), { timeout: 30000 });
  // Drive… on Bram's row, once his matched video is taken off: the chooser opens in the new folder
  await p.click('[data-pvrow="Bram Sample"] [data-pvunfile]');
  await p.waitForSelector('[data-pvrow="Bram Sample"] [data-pvdrive]');
  await p.evaluate(() => { window.__picks.push([{ id: '1VideoBramRedoVideoBramRedo00011', name: 'Bram retake.webm', mimeType: 'video/webm', sizeBytes: '4000' }]); });
  await p.click('[data-pvrow="Bram Sample"] [data-pvdrive]');
  await p.waitForFunction(() => /Bram retake\.webm/.test(document.querySelector('[data-pvrow="Bram Sample"]').textContent), { timeout: 30000 });
  assert.equal(await p.evaluate(() => window.__pickerSeen.slice(-1)[0].views[0].parent), '1FolderOtherFolderOtherFolder00008');
  await tap(p, '[data-pvgo]');
  await p.waitForFunction(() => ['Aria Testwell', 'Bram Sample'].every(k => window.__mark.state().batch.students.find(s => s.key === k).files.some(f => f.kind === 'link')), { timeout: 60000 });
  const links = await p.evaluate(() => ['Aria Testwell', 'Bram Sample'].map(k => new TextDecoder().decode(window.__mark.state().batch.students.find(s => s.key === k).files.find(f => f.kind === 'link').data)));
  assert.match(links[0], /GsDrive=1VideoAriaVideoAriaVideoAria00009/); assert.match(links[0], /Name=Aria Testwell speech\.webm/);
  assert.match(links[1], /GsDrive=1VideoBramRedoVideoBramRedo00011/);
  assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('gs.gVidDir'))), { id: '1FolderOtherFolderOtherFolder00008', name: 'Speeches 2026' }, 'kept where the current app keeps it');
  // D-036: Add, A video, From Google Drive shows where the chooser opens, with Change folder
  await goTo(p, 'Aria Testwell');
  await p.waitForFunction(() => { const it = [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => /video or recording/.test(e.textContent)); if (it) { it.click(); return true; } const b = document.querySelector('[data-addmenu]'); if (b && !document.querySelector('.pop')) b.click(); return false; }, { timeout: 30000, polling: 500 });
  await p.waitForSelector('dialog[open] [data-vdadd]');
  await p.evaluate(() => { window.__picks.push([]); });
  await p.click('dialog[open] [data-v="drive"]');
  await p.waitForFunction(() => /Speeches 2026.*Change folder/.test((document.querySelector('dialog[open] .vddir') || {}).textContent || ''), { timeout: 30000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

// D-021: with Google usable here, a unit's Add files has Drive's mark beside it and Add a screenshot is a menu of this computer or
// Drive; the file picked in Drive goes on the unit as one from the computer's chooser does.
test('D-021: Drive\'s mark beside a unit\'s Add files adds the file picked in Drive to the unit; Add a screenshot offers both ways', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const D = { asked: [], folders: [], sent: [], videos: {}, papers: { '1UnitTaskUnitTaskUnitTaskUnit00001': await makePaper({ title: 'Poem task' }) } };
  const p = await page(ctx, errors, D);
  await p.goto(srv.url + 'blank'); await plant(p, seed()); await plantPlan(p);
  const kv = key => p.evaluate(key => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => { r.result.close(); res(q.result === undefined ? null : JSON.parse(JSON.stringify(q.result))); }; }; }), key);
  const nFiles = async () => ((await kv('units')) || []).reduce((n, u) => n + (u.files || []).length, 0);
  await p.goto(srv.url + 'next/#/class/c1');
  await p.waitForSelector('[data-focus="unit-add-file"]', { timeout: 60000 });
  const before = await nFiles();
  await p.click('[data-focus="unit-add-shot"]');
  await p.waitForFunction(() => { const l = [...document.querySelectorAll('.pop [role="menuitem"]')].map(e => e.textContent.trim()); return l.includes('From this computer') && l.includes('From Google Drive'); }, { timeout: 15000 });
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('.pop [role="menuitem"]'));
  await p.evaluate(() => { window.__picks.push([{ id: '1UnitTaskUnitTaskUnitTaskUnit00001', name: 'Poem task.pdf', mimeType: 'application/pdf', sizeBytes: '900' }]); });
  await p.click('.ufiles .row [data-drive]');
  for (let k = 0; k < 100 && (await nFiles()) === before; k++) await new Promise(r => setTimeout(r, 150));
  const files = ((await kv('units')) || []).flatMap(u => u.files || []);
  assert.ok(files.some(f => f.name === 'Poem task.pdf'), 'the file picked in Drive is on the unit: ' + JSON.stringify(files.map(f => f.name)));
  assert.deepEqual(errors, []);
  await ctx.close();
});
