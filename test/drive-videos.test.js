// Videos from the teacher's own Google Drive: Google's chooser opens in her videos folder, and the app can open only the videos she picks
// (drive.file, never the whole Drive). Google is played by this test: the chooser and Drive are answered here, and the "video" is a few
// seconds of a moving square made in the page. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { ROOT, openApp, openOwn, closeOwn, openZip } = require('./helpers/app');
const fs = require('fs'), path = require('path'), http = require('http');
const { makePaper, zipOf } = require('./helpers/fixtures');
const BASE = require('./helpers/base');   // the current app's pages: classic/ since the switch

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); await closeOwn(); });

const GCID = '1234-test.apps.googleusercontent.com';
const seed = extra => ({ ls: { 'gs.gcid': JSON.stringify(GCID), ...extra } });
const threeZip = async () => zipOf({
  'Aria Testwell/Outline.pdf': await makePaper({ title: 'Aria outline' }),
  'Bram Sample/Outline.pdf': await makePaper({ title: 'Bram outline' }),
  'Cleo Fixture/Outline.pdf': await makePaper({ title: 'Cleo outline' }),
});
// D.pick: what the chooser hands back next. D.asked: what the app asked Google for.
async function fakeGoogle(page, D) {
  await page.evaluateOnNewDocument(() => {
    window.__picks = []; window.__pickerSeen = [];
    const P = {
      ViewId: { DOCS: 'docs' }, DocsViewMode: { LIST: 'list' }, Feature: { MULTISELECT_ENABLED: 'multi', SUPPORT_DRIVES: 'drives' },
      Action: { PICKED: 'picked', CANCEL: 'cancel' }, Response: { ACTION: 'action', DOCUMENTS: 'docs' },
      DocsView: class { constructor() { this.o = {}; } setIncludeFolders(v) { this.o.folders = v; return this; } setMode() { return this; } setSelectFolderEnabled(v) { this.o.pickFolder = v; return this; } setMimeTypes(v) { this.o.mimes = v; return this; } setParent(v) { this.o.parent = v; return this; } setLabel(v) { this.o.label = v; return this; } setOwnedByMe(v) { this.o.mine = v; return this; } setEnableDrives(v) { this.o.drives = v; return this; } },
      PickerBuilder: class {
        constructor() { this.o = { features: [] }; }
        setOAuthToken(t) { this.o.token = t; return this; } setAppId(v) { this.o.app = v; return this; } setOrigin() { return this; } setTitle() { return this; } setDeveloperKey(k) { this.o.key = k; return this; }
        addView(v) { (this.o.views = this.o.views || []).push(v.o); this.o.view = this.o.views[0]; return this; } enableFeature(f) { this.o.features.push(f); return this; } setCallback(cb) { this.cb = cb; return this; }
        build() { return { setVisible: () => { window.__pickerSeen.push(this.o); const docs = window.__picks.shift() || []; setTimeout(() => this.cb(docs.length ? { action: 'picked', docs } : { action: 'cancel' }), 20); } }; }
      },
    };
    window.google = { picker: P, accounts: { oauth2: {
      initTokenClient: o => ({ requestAccessToken: () => setTimeout(() => o.callback({ access_token: 'tok', expires_in: 3600, scope: o.scope }), 10) }),
      revoke: () => {},
    } } };
  });
  await page.setRequestInterception(true);
  page.on('request', r => {
    const u = r.url();
    if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u) || /^(data|blob|about):/.test(u)) return r.continue();
    D.asked.push(u);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Expose-Headers': 'Content-Length, Content-Type' };
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: cors, body: '' });
    if (/\/about\?/.test(u)) return r.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ user: { emailAddress: 'teacher@example.com' } }) });
    if (/googleapis\.com\/drive\/v3\/files\?/.test(u) && r.method() === 'POST') { D.made = (D.made || 0) + 1; const pd = r.postData() || ''; const parent = (/"parents":\["([^"]+)"/.exec(pd) || [])[1]; if (parent && parent !== 'root' && !String(parent).startsWith('made')) return r.respond({ status: 404, headers: cors, contentType: 'application/json', body: '{"error":{"message":"File not found"}}' }); return r.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ id: 'made' + D.made }) }); }
    if (/upload\/drive\/v3\/files\?uploadType=multipart/.test(u)) { D.uploads = (D.uploads || 0) + 1; return r.respond({ status: 200, headers: cors, contentType: 'application/json', body: '{"id":"up"}' }); }
    if (/drive\/v3\/files\/[\w-]+\?fields=parents/.test(u)) return r.respond({ status: 200, headers: cors, contentType: 'application/json', body: '{"parents":["1ParentNotOursParentNotOurs000000"]}' });
    const fm = /drive\/v3\/files\/([\w-]+)\?fields=id/.exec(u);
    if (fm) return D.videos[fm[1]] ? r.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ id: fm[1] }) }) : r.respond({ status: 404, headers: cors, contentType: 'application/json', body: '{"error":{"message":"File not found"}}' });
    const m = /drive\/v3\/files\/([\w-]+)\?alt=media/.exec(u);
    if (m && D.videos[m[1]]) return r.respond({ status: 200, headers: { ...cors, 'Content-Length': String(D.videos[m[1]].length) }, contentType: 'video/webm', body: D.videos[m[1]] });
    if (m && D.papers && D.papers[m[1]]) return r.respond({ status: 200, headers: cors, contentType: 'application/pdf', body: D.papers[m[1]] });
    if (m) return r.respond({ status: 404, headers: cors, contentType: 'application/json', body: '{"error":{"message":"File not found"}}' });
    r.respond({ status: 200, headers: cors, body: '' });   // anything else (sync, the chooser's own script) is not part of this test
  });
}
const makeVideo = page => page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 160; c.height = 90; const g = c.getContext('2d');
  const rec = new MediaRecorder(c.captureStream(15), { mimeType: 'video/webm' }), parts = [];
  rec.ondataavailable = e => parts.push(e.data);
  let i = 0; const t = setInterval(() => { g.fillStyle = '#1F6FB2'; g.fillRect(0, 0, 160, 90); g.fillStyle = '#fff'; g.fillRect((i++ * 4) % 140, 30, 20, 20); }, 60);
  rec.start(); await new Promise(r => setTimeout(r, 2000)); rec.stop(); await new Promise(r => { rec.onstop = r; }); clearInterval(t);
  const b = new Uint8Array(await new Blob(parts).arrayBuffer()); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s);
});
const files = page => page.evaluate(() => Object.fromEntries(window.__gs.state().batch.students.map(s => [s.key, s.files.map(f => f.name + ' [' + f.kind + ']' + (f.from ? ' from ' + f.from : ''))])));

test('Partners and videos: videos picked from Drive in the videos folder go to the students named in them, and play here with only the picked files asked for', async () => {
  const D = { asked: [], videos: {} };
  const { page, close } = await openApp(browser, { seed: seed(), beforeLoad: p => fakeGoogle(p, D) });
  try {
    D.videos['1AbCdEfGhIjKlMnOpQrStUvWxYz012345'] = Buffer.from(await makeVideo(page), 'base64');
    await openZip(page, await threeZip(), 'Speeches.zip');
    await page.click('#moreBtn'); await page.click('#partnersBtn');
    await page.waitForSelector('#pvList .pvrow');
    assert.ok(!(await page.$('.pvdrvrow .vddir')), 'no folder yet: the chooser asks for it first');
    assert.equal(await page.$$eval('#pvList [data-pvdrive]', b => b.length), 3, 'Drive… on each row');
    // first the folder, then two videos in it; one name matches nobody
    await page.evaluate(() => { window.__picks.push([{ id: '1FoldFoldFoldFoldFoldFoldFold11111', name: 'Speech videos', mimeType: 'application/vnd.google-apps.folder' }]);
      window.__picks.push([{ id: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345', name: 'Aria Testwell speech.webm', sizeBytes: '4000', mimeType: 'video/webm' }, { id: '1ZyXwVuTsRqPoNmLkJiHgFeDcBa987654', name: 'Unknown person.mp4', sizeBytes: '9000', mimeType: 'video/mp4' }]); });
    await page.click('[data-pvmany]');
    await page.waitForFunction(() => /Speech videos\s*Change folder/.test((document.querySelector('.pvdrvrow') || {}).textContent || ''));
    assert.match(await page.$eval('#pvList .pvrow:nth-child(1) .pvvid', e => e.textContent), /Drive\s*Aria Testwell speech\.webm/);
    const seen = await page.evaluate(() => window.__pickerSeen);
    assert.equal(seen.length, 2);
    assert.equal(seen[0].view.pickFolder, true, 'the folder is picked in Google’s chooser');
    assert.equal(seen[0].view.parent, 'root', 'choosing the folder starts at the top of My Drive, not a pile of every folder');
    assert.deepEqual(seen[0].views.map(v => v.label), ['My Drive', 'Shared with me', 'Shared drives'], 'with tabs for shared folders too');
    assert.match(seen[0].view.mimes, /video\/webm/, 'the videos inside still show, so a folder of videos isn’t empty');
    assert.equal(seen[1].views[1].parent, 'root', 'videos can still be found outside the folder');
    assert.equal(seen[1].view.parent, '1FoldFoldFoldFoldFoldFoldFold11111', 'the videos open in that folder');
    assert.ok(seen[1].features.includes('multi') && seen[1].view.folders, 'many at once, and subfolders can be opened');
    assert.match(seen[1].app, /^\d+$/, 'the project number comes from the Client ID');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.gVidDir'))), { id: '1FoldFoldFoldFoldFoldFoldFold11111', name: 'Speech videos' });
    // Bram works with Aria
    await page.click('#pvList [data-pvp="0"]'); await page.click('#pvList [data-pvto="1"]'); await page.click('#pvList [data-pvdone]');
    await page.click('#pvGo');
    await page.waitForFunction(() => document.querySelector('#dlg').hidden);
    assert.deepEqual(await files(page), {
      'Aria Testwell': ['Outline.pdf [pdf]', 'Presentation video.url [link]'],
      'Bram Sample': ['Outline.pdf [pdf]', 'Presentation video.url [link] from Aria Testwell'],
      'Cleo Fixture': ['Outline.pdf [pdf]'],
    });
    // only the link (with the file's id) is in her work
    const link = await page.evaluate(() => new TextDecoder().decode(window.__gs.state().batch.students[0].files.find(f => f.kind === 'link').data));
    assert.match(link, /URL=https:\/\/drive\.google\.com\/file\/d\/1AbCdEfGhIjKlMnOpQrStUvWxYz012345\/view/); assert.match(link, /GsDrive=1AbCdEfGhIjKlMnOpQrStUvWxYz012345/);
    // no service worker here (the double-click copy is like this), so it can't play straight from Drive: Download for offline plays it in the page's own player
    await page.evaluate(() => window.__gs.openStudent && window.__gs.openStudent(0));
    await page.waitForSelector('#paper .vdrv [data-drvget]', { timeout: 15000 });
    assert.ok(!(await page.$('#paper .vdrv [data-drvplay]')), 'no Play from Drive where it can’t work');
    await page.click('#paper .vdrv [data-drvget]');
    await page.waitForSelector('#paper .media video', { timeout: 15000 });
    assert.match(await page.$eval('#paper .media video', v => v.src), /^blob:/);
    assert.ok(await page.$('#paper .media .trbox'), 'the transcript panel is there, so it can follow the video');
    const keptKeys = () => page.evaluate(() => new Promise(res => { const q = indexedDB.open('grading-studio-videos'); q.onsuccess = () => { const db = q.result, r = db.transaction('v').objectStore('v').getAllKeys(); r.onsuccess = () => { res(r.result); db.close(); }; }; }));
    assert.deepEqual(await keptKeys(), ['d-1AbCdEfGhIjKlMnOpQrStUvWxYz012345']);
    // Remove download frees the browser and touches nothing in Drive
    const before = D.asked.length;
    await page.click('#paper [data-drvdrop]');
    await page.waitForSelector('#paper .vdrv [data-drvget]', { timeout: 15000 });
    assert.deepEqual(await keptKeys(), [], 'the download is gone from this browser');
    assert.ok(!D.asked.slice(before).some(u => /upload|DELETE|trash/i.test(u)), 'nothing was sent to Drive');
    assert.equal(D.uploads || 0, 0);
    // Google was asked only for the picked video, with the small permission
    assert.ok(D.asked.some(u => /files\/1AbCdEfGhIjKlMnOpQrStUvWxYz012345\?alt=media/.test(u)));
    assert.deepEqual(D.asked.filter(u => /drive\/v3\/files\?/.test(u) && !/spaces=appDataFolder/.test(u)), [], 'no list of her files was asked for (only the app’s own hidden folder, for keeping devices the same)');
    assert.ok(!D.asked.some(u => u.includes('1FoldFoldFoldFoldFoldFoldFold11111')), 'nothing in the folder was read: the chooser only opened there');
    const scopes = await page.evaluate(() => window.__gs.gScope && window.__gs.gScope());
    if (scopes != null) assert.ok(!/auth\/drive( |$)|drive\.readonly/.test(scopes), 'never the whole Drive: ' + scopes);
    assert.deepEqual(page.errors, []);
    // picking a video while choosing the folder chooses the folder it sits in
    await page.evaluate(() => window.__picks.push([{ id: '1StudStudStudStudStudStudStud22222', name: 'Ben talk.mp4', mimeType: 'video/mp4', parentId: '1OtherOtherOtherOtherOtherOth3333' }]));
    assert.deepEqual(await page.evaluate(() => window.__gs.pickVidDir()), { id: '1OtherOtherOtherOtherOtherOth3333', name: 'Folder with Ben talk.mp4', size: 0, mime: 'application/vnd.google-apps.folder' });
  } finally { await close(); }
});

test('one student: + Add > A video… > From Google Drive, and a video Drive no longer has says so in plain words', async () => {
  const D = { asked: [], videos: {} };
  const { page, close } = await openApp(browser, { seed: seed({ 'gs.gVidDir': JSON.stringify({ id: '1FoldFoldFoldFoldFoldFoldFold11111', name: 'Speech videos' }) }), beforeLoad: p => fakeGoogle(p, D) });
  try {
    await openZip(page, await threeZip(), 'Speeches.zip');
    await page.evaluate(() => window.__gs.openAddVideo(window.__gs.state().batch.students[2]));
    await page.waitForSelector('[data-vdby="drive"]');
    await page.evaluate(() => window.__picks.push([{ id: '1GoneGoneGoneGoneGoneGoneGone00000', name: 'Cleo talk.mp4', sizeBytes: '2048', mimeType: 'video/mp4' }]));
    await page.click('[data-vdby="drive"]');
    await page.waitForFunction(() => /Cleo talk\.mp4/.test(document.querySelector('#vdDriveName').textContent));
    assert.match(await page.$eval('#vdDriveBox', e => e.textContent), /Speech videos/);
    assert.equal(await page.$eval('#vdAdd', b => b.disabled), false);
    assert.equal((await page.evaluate(() => window.__pickerSeen))[0].view.parent, '1FoldFoldFoldFoldFoldFoldFold11111');
    await page.click('#vdAdd');
    await page.waitForFunction(() => document.querySelector('#dlg').hidden);
    await page.waitForFunction(() => /isn’t there for you now/.test((document.querySelector('#paper .vdrv') || {}).textContent || ''), { timeout: 15000 });
    assert.ok(await page.$('#paper .vdrv [data-drvweb]'), 'it can still be watched through Drive’s own player');
    await page.click('#paper .vdrv [data-drvweb]');
    await page.waitForSelector('#paper .vlink [data-vplay]');
    assert.deepEqual(page.errors, []);
  } finally { await close(); }
});

test('Open from Google Drive uses the same chooser: only the picked papers are fetched, and saving back makes its own folder (My Drive when the one beside them isn’t the app’s)', async () => {
  const D = { asked: [], videos: {}, papers: {} };
  const { page, close } = await openApp(browser, { seed: seed(), beforeLoad: p => fakeGoogle(p, D) });
  try {
    D.papers['1PaperAriaPaperAriaPaperAria000000'] = Buffer.from(await makePaper({ title: 'Aria essay' }));
    D.papers['1PaperBramPaperBramPaperBram000000'] = Buffer.from(await makePaper({ title: 'Bram essay' }));
    await page.evaluate(() => window.__picks.push([{ id: '1PaperAriaPaperAriaPaperAria000000', name: 'Aria Testwell - Essay.pdf', mimeType: 'application/pdf' }, { id: '1PaperBramPaperBramPaperBram000000', name: 'Bram Sample - Essay.pdf', mimeType: 'application/pdf' }]));
    await page.evaluate(() => window.__gs.openFromDrive(null));
    await page.waitForFunction(() => { const b = window.__gs.state().batch; return b && b.students.length >= 2; }, { timeout: 20000 });
    const seen = await page.evaluate(() => window.__pickerSeen);
    assert.ok(seen[0].features.includes('multi') && /application\/pdf/.test(seen[0].view.mimes), 'papers, many at once');
    assert.deepEqual(D.asked.filter(u => /drive\/v3\/files\?/.test(u) && !/spaces=appDataFolder/.test(u)), [], 'no list of her files');
    const scopes = await page.evaluate(() => window.__gs.gScope());
    assert.ok(!/auth\/drive( |$)/.test(scopes), 'never the whole Drive: ' + scopes);
    // saving back: the folder beside the papers isn't the app's, so it goes to My Drive
    const where = await page.evaluate(async () => { await window.__gs.saveToDrive('Marked - test', { 'Aria Testwell/Essay.pdf': new Uint8Array([1, 2, 3]) }); return window.__gs.saveToDrive.where; });
    assert.equal(where, 'root'); assert.equal(D.uploads, 1);
    assert.deepEqual(page.errors, []);
  } finally { await close(); }
});

// The built site served the way the web address serves it, so the offline copy's service worker runs (it is what plays Drive videos straight from Drive).
async function swSite() {
  const types = { html: 'text/html; charset=utf-8', js: 'text/javascript', json: 'application/json', webmanifest: 'application/manifest+json', png: 'image/png' };
  const srv = http.createServer((req, res) => {
    const [p0, q = ''] = req.url.split('?'); let p = p0 === '/' ? '/index.html' : p0;
    if (/blank/.test(q) || p === '/blank') { res.writeHead(200, { 'Content-Type': types.html }); return res.end('<!doctype html><title>blank</title>'); }
    const file = path.join(BASE, p);   // the current app's pages and worker: classic/ since the switch
    if (!file.startsWith(BASE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[p.split('.').pop()] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); srv.unref();
  return { url: 'http://localhost:' + srv.address().port + '/?sw=1', close: () => new Promise(r => { srv.closeAllConnections(); srv.close(r); }) };
}

test('played straight from Drive: nothing is kept in the browser, Drive is asked for parts with her token, and a seek after the worker rests still plays', async () => {
  const D = { asked: [], videos: {} }, S = { got: [] }, site = await swSite();
  const id = '1StrmStrmStrmStrmStrmStrmStrm44444';
  const { page, close } = await openOwn({ server: site, seed: seed({ 'gs.gVidDir': JSON.stringify({ id: '1FoldFoldFoldFoldFoldFoldFold11111', name: 'Speech videos' }) }), beforeLoad: p => fakeGoogle(p, D) });
  let bytes;
  try {
    bytes = Buffer.from(await makeVideo(page), 'base64'); D.videos[id] = bytes;
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 30000 });
    // Drive, as the service worker sees it: answers by Range, and remembers the token and Range it was asked with
    const sw = await page.browser().waitForTarget(t => t.type() === 'service_worker');
    const cdp = await sw.createCDPSession();
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*googleapis.com*' }] });
    cdp.on('Fetch.requestPaused', async ev => {
      const h = ev.request.headers, auth = h.Authorization || h.authorization || '', rg = h.Range || h.range || '';
      S.got.push({ url: ev.request.url, auth, rg });
      const cors = [{ name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization, Range' }, { name: 'Access-Control-Expose-Headers', value: 'Content-Range, Content-Length, Accept-Ranges' }];
      if (ev.request.method === 'OPTIONS') return cdp.send('Fetch.fulfillRequest', { requestId: ev.requestId, responseCode: 204, responseHeaders: cors, body: '' }).catch(() => {});
      if (S.deny) { S.deny--; return cdp.send('Fetch.fulfillRequest', { requestId: ev.requestId, responseCode: 401, responseHeaders: cors, body: '' }).catch(() => {}); }
      const m = /bytes=(\d+)-(\d*)/.exec(rg), a = m ? +m[1] : 0, b = m && m[2] ? Math.min(+m[2], bytes.length - 1) : bytes.length - 1, part = bytes.subarray(a, b + 1);
      cdp.send('Fetch.fulfillRequest', { requestId: ev.requestId, responseCode: m ? 206 : 200, body: part.toString('base64'), responseHeaders: [...cors, { name: 'Content-Type', value: 'video/webm' }, { name: 'Accept-Ranges', value: 'bytes' }, { name: 'Content-Length', value: String(part.length) }, ...(m ? [{ name: 'Content-Range', value: 'bytes ' + a + '-' + b + '/' + bytes.length }] : [])] }).catch(() => {});
    });
    await openZip(page, await threeZip(), 'Speeches.zip');
    await page.evaluate(() => window.__gs.openAddVideo(window.__gs.state().batch.students[0]));
    await page.waitForSelector('[data-vdby="drive"]');
    await page.evaluate(id => window.__picks.push([{ id, name: 'Aria talk.webm', sizeBytes: '4000', mimeType: 'video/webm' }]), id);
    await page.click('[data-vdby="drive"]');
    await page.waitForFunction(() => /Aria talk/.test((document.querySelector('#vdDriveName') || {}).textContent || ''));
    await page.click('#vdAdd');
    await page.waitForFunction(() => document.querySelector('#dlg').hidden);
    await page.evaluate(() => window.__gs.openStudent(0));
    await page.waitForSelector('#paper .media video', { timeout: 15000 });
    assert.match(await page.$eval('#paper .media video', v => v.getAttribute('src')), /^gs-drive\/1StrmStrm/, 'the player asks this site, not a copy');
    await page.waitForFunction(() => { const v = document.querySelector('#paper .media video'); return v && v.readyState >= 1; }, { timeout: 15000 });
    assert.ok(await page.$('#paper .media .trbox'), 'the transcript panel follows it as it would a file');
    assert.ok(await page.$('#paper .vdrv [data-drvget]'), 'Download for offline is offered');
    assert.ok(S.got.some(g => g.url.includes(id + '?alt=media') && g.auth === 'Bearer tok'), 'Drive was asked with her token');
    assert.ok(S.got.some(g => /^bytes=\d+-/.test(g.rg)), 'and for a part at a time');
    const kept = await page.evaluate(() => new Promise(res => { const q = indexedDB.open('grading-studio-videos'); q.onsuccess = () => { const db = q.result; if (!db.objectStoreNames.contains('v')) { db.close(); return res([]); } const r = db.transaction('v').objectStore('v').getAllKeys(); r.onsuccess = () => { res(r.result); db.close(); }; }; }));
    assert.deepEqual(kept, [], 'nothing is kept in the browser');
    // the browser rests the worker, which forgets the token: the next part asks the page for it again
    await cdp.send('Runtime.evaluate', { expression: 'dTok = null' });
    let n = S.got.length;
    const part = () => page.evaluate(id => fetch('gs-drive/' + id, { headers: { Range: 'bytes=0-99' } }).then(async r => [r.status, (await r.arrayBuffer()).byteLength]), id);
    assert.deepEqual(await part(), [206, 100]);
    assert.equal(S.got.slice(n).filter(g => g.auth === 'Bearer tok').length, 1);
    // a token Drive refuses is asked for fresh, once
    S.deny = 1; n = S.got.length;
    assert.deepEqual(await part(), [206, 100]);
    assert.equal(S.got.slice(n).length, 2, 'refused once, then answered');
    assert.deepEqual(page.errors, []);
  } finally { await close(); await site.close(); }
});
