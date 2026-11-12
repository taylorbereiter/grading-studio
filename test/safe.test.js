// Stage 2, safe by default: "Not backed up" until a folder holds a second copy, the ask on Home, going back in time for one
// assignment, and the service worker that keeps the pages on the computer and holds an update until she says so.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
const { launch } = require('./helpers/chrome');
const { ROOT, builtHtml, openApp, openOwn, closeOwn, goTo, openZip, waitPaper, appReady, goToStudent, score, settle, idbRead } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');
const { linkFolder, folderWait, folderRead, wipeBrowser } = require('./helpers/carry');

let zip, browser;
before(async () => { builtHtml(); zip = zipOf(await standardFiles()); browser = await launch(); });
after(async () => { await closeOwn(); await browser.close(); });

const rail = page => page.$eval('#railSaved', e => ({ text: [...e.querySelector('.rl').childNodes].map(n => n.textContent).join(' '), cls: e.className }));   // read from the page itself: the sidebar folds to a dot while a paper is open
const shown = (page, sel) => page.$eval(sel, e => !e.hidden);
const idOf = page => page.evaluate(() => window.__gs.state().batch.id);
const rubricOf = (page, key) => page.evaluate(k => window.__gs.state().batch.students.find(s => s.key === k).grade.rubric, key);
async function openKept(page, name) {
  await goTo(page, '#/');
  await page.waitForFunction(n => [...document.querySelectorAll('#vHome .krow')].some(r => r.textContent.includes(n)), { timeout: 30000 }, name);
  await page.evaluate(n => [...document.querySelectorAll('#vHome .krow')].find(r => r.textContent.includes(n)).querySelector('[data-kopen]').click(), name);
  await page.waitForFunction(n => { const s = window.__gs.state(); return s.batch && s.batch.name === n; }, {}, name);
  await waitPaper(page);
}

test('a new browser says “Not backed up” in amber and asks for a folder; once one is chosen it says Saved', async () => {
  const { page, close } = await openOwn();
  await page.waitForFunction(() => window.__gs.safeAskShown());
  assert.deepEqual(await rail(page), { text: 'Not backed up Only in this browser', cls: 'rsaved warn' }, 'never “Saved” in green while the work is only in the browser');
  assert.equal(await shown(page, '#safeAsk'), true);
  assert.match(await page.$eval('#safeAsk', e => e.innerText), /Choose where your work is kept[\s\S]*Nothing is uploaded/);
  assert.equal(await page.$eval('#safeAsk [data-wlink]', b => b.textContent), 'Choose a folder…');
  assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('gsc.folder')).length), 0, 'asking stores nothing');
  await openZip(page, zip, 'River essay.zip');
  assert.equal(await page.$eval('#saveWhere', e => e.textContent), 'Not backed up. Only in this browser');
  assert.match(await page.$eval('#saveWhere', e => e.className), /warn/);
  await linkFolder(page, 'Chosen'); await folderWait(page);
  assert.deepEqual(await rail(page), { text: 'Saved In this browser and your “Chosen” folder', cls: 'rsaved' });
  await goTo(page, '#/');
  assert.equal(await shown(page, '#safeAsk'), false, 'nothing left to ask');
  // and after a reload the folder is still there, so it never flashes the ask
  await page.reload(); await appReady(page);
  await page.waitForFunction(() => window.__gs.folderState().state === 'ok', { timeout: 30000 });
  assert.equal(await shown(page, '#safeAsk'), false);
  assert.deepEqual(page.errors, []);
  await close();
});

test('“Not now” puts the ask away for a week, and the sidebar goes on saying “Not backed up”', async () => {
  const { page, close } = await openApp(browser);
  await page.waitForFunction(() => window.__gs.safeAskShown());
  await page.click('#safeAsk [data-asklater]');
  assert.equal(await shown(page, '#safeAsk'), false);
  assert.equal((await rail(page)).cls, 'rsaved warn');
  await page.reload(); await appReady(page);
  await page.waitForFunction(() => /Not backed up/.test(document.querySelector('#railSaved').textContent));
  assert.equal(await shown(page, '#safeAsk'), false, 'still put away');
  await page.evaluate(() => localStorage.setItem('gsc.folderLater', String(Date.now() - 8 * 864e5)));
  await page.reload(); await appReady(page);
  await page.waitForFunction(() => window.__gs.safeAskShown());
  assert.equal(await shown(page, '#safeAsk'), true, 'a week on, it asks again');
  // the sidebar opens the same choice
  await page.click('#railSaved');
  await page.waitForSelector('#whereBox [data-wlink]');
  assert.match(await page.$eval('#whereBox', e => e.innerText), /Not backed up\. Only in this browser/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a browser that cannot save to a folder is told so, and offered the take-home file once there is work', async () => {
  const { page, close } = await openApp(browser, { beforeLoad: p => p.evaluateOnNewDocument(() => { delete window.showDirectoryPicker; delete Window.prototype.showDirectoryPicker; }) });
  await page.waitForFunction(() => /Not backed up/.test(document.querySelector('#railSaved').textContent));
  assert.equal(await shown(page, '#safeAsk'), false, 'nothing to lose yet');
  await openZip(page, zip, 'River essay.zip'); await score(page, [3, 3, 3]); await settle(page);
  await goTo(page, '#/');
  await page.waitForFunction(() => !document.querySelector('#safeAsk').hidden);
  assert.match(await page.$eval('#safeAsk', e => e.innerText), /Your work is not backed up[\s\S]*Make a take-home file/);
  assert.equal(await page.$('#safeAsk [data-wlink]'), null);
  await page.click('#safeAsk [data-asktake]');
  await page.waitForSelector('#takeP1');
  assert.deepEqual(page.errors, []);
  await close();
});

test('go back in time: one assignment goes back to an earlier day, the folder follows, and Undo brings today back', async () => {
  const { page, close } = await openOwn();
  await linkFolder(page, 'Days');
  await openZip(page, zip, 'River essay.zip');
  const id = await idOf(page);
  await score(page, [4, 4, 4]); await settle(page); await folderWait(page);
  // "yesterday": a dated copy of how things stand now
  await page.evaluate(() => window.__gs.folderSnapshot('daily'));
  const snap = (await page.evaluate(() => window.__gs.snapList()))[0];
  // today she scores it again, by mistake, and another student too
  await score(page, [1, 1, 1]);
  await goToStudent(page, 1);
  await score(page, [2, 2, 2]); await settle(page); await folderWait(page);
  const stale = await folderRead(page, 'downloads', id, 'work.json');
  assert.deepEqual(stale.s['Aria Testwell'].g.rubric, [1, 1, 1]);
  const libBefore = await page.evaluate(() => localStorage.getItem('gs.lib'));

  await goTo(page, '#/settings/history');
  const look = '[data-hlook="f:' + snap.name + '"]';
  await page.waitForSelector(look); await page.$eval(look, b => b.click());
  await page.waitForSelector('#setHistory [data-hone]');
  assert.match(await page.$eval('#setHistory .gbdetail', e => e.innerText), /River essay\s*Then 1 of 4 scored, now 2 of 4 scored · 2 students’ work differs/);
  await page.$eval('#setHistory [data-hone]', b => b.click());
  await page.waitForFunction(() => /is back to how it was/.test(document.querySelector('.toast').textContent), { timeout: 30000 });
  await folderWait(page);
  assert.match(await page.$eval('#setHistory .gbdetail', e => e.innerText), /The same then as now/);
  const w = await folderRead(page, 'downloads', id, 'work.json');
  assert.deepEqual(w.s['Aria Testwell'].g.rubric, [4, 4, 4], 'the folder has the earlier scores');
  assert.deepEqual((w.s['Bram Sample'].g.rubric || []).filter(v => v != null), [], 'and the student scored since is unscored again');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.lib')), libBefore, 'rosters and units are not touched');
  assert.ok((await page.evaluate(() => window.__gs.snapList())).some(s => s.why === 'Before restoring an assignment'), 'how things were is kept first');
  // the restore is a change made now: it comes after everything the folder had seen, so no merge can undo it
  const pick = await page.evaluate((now, old) => { const r = window.__gs.carryParts.mergeWork(now, old).rows.find(r => r.key === 'Aria Testwell'); return r.pick + ' by ' + r.by; }, w, stale);
  assert.equal(pick, 'a by order', 'a computer still holding today’s scores takes the restored ones');

  // Undo
  await page.$eval('.toast .tact', b => b.click());
  await page.waitForFunction(() => /^Undone/.test(document.querySelector('.toast').textContent), { timeout: 30000 });
  await folderWait(page);
  const w2 = await folderRead(page, 'downloads', id, 'work.json');
  assert.deepEqual(w2.s['Aria Testwell'].g.rubric, [1, 1, 1]);
  assert.deepEqual(w2.s['Bram Sample'].g.rubric, [2, 2, 2]);
  await openKept(page, 'River essay');
  assert.deepEqual(await rubricOf(page, 'Aria Testwell'), [1, 1, 1], 'and the paper opens with today’s scores');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a restored assignment opens with the earlier scores and marks, and survives a cleared browser', async () => {
  const { page, srv, close } = await openOwn();
  await linkFolder(page, 'Kept');
  await openZip(page, zip, 'River essay.zip');
  await score(page, [3, 3.5, 4]); await settle(page); await folderWait(page);
  await page.evaluate(() => window.__gs.folderSnapshot('daily'));
  const snap = (await page.evaluate(() => window.__gs.snapList()))[0];
  await score(page, [0, 0, 0]); await settle(page); await folderWait(page);
  await goTo(page, '#/settings/history');
  const look = '[data-hlook="f:' + snap.name + '"]';
  await page.waitForSelector(look); await page.$eval(look, b => b.click());
  await page.waitForSelector('#setHistory [data-hone]'); await page.$eval('#setHistory [data-hone]', b => b.click());
  await page.waitForFunction(() => /is back to how it was/.test(document.querySelector('.toast').textContent), { timeout: 30000 });
  await folderWait(page);
  await openKept(page, 'River essay');
  assert.deepEqual(await rubricOf(page, 'Aria Testwell'), [3, 3.5, 4]);
  // the browser is cleared: the ask is back, and choosing the same folder brings everything home
  await wipeBrowser(page, srv);
  await page.waitForFunction(() => window.__gs.safeAskShown());
  assert.match((await rail(page)).text, /^Not backed up/);
  await linkFolder(page, 'Kept'); await folderWait(page);
  await openKept(page, 'River essay');
  assert.deepEqual(await rubricOf(page, 'Aria Testwell'), [3, 3.5, 4], 'a cleared browser lost nothing');
  assert.deepEqual(page.errors, []);
  await close();
});

test('with no folder, Go back in time says why there are no days yet and offers the folder', async () => {
  const { page, close } = await openApp(browser);
  await goTo(page, '#/settings/history');
  await page.waitForFunction(() => /No folder is chosen yet/.test(document.querySelector('#setHistory').innerText));
  assert.ok(await page.$('#setHistory [data-wlink]'));
  assert.equal(await page.evaluate(() => document.title), 'Go back in time · Settings · Grading Studio');
  assert.deepEqual(page.errors, []);
  await close();
});

/* ---- the pages kept on the computer, and updates she controls ---- */
// A folder served the way the web address serves the repo. put() swaps in a new version of the pages; down stops answering, like no internet.
async function site() {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gs-test-site-'));
  for (const f of ['index.html', 'planner.html', 'sw.js', 'manifest.webmanifest', 'version.json']) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  fs.mkdirSync(path.join(dir, 'lang')); for (const f of fs.readdirSync(path.join(ROOT, 'lang'))) fs.copyFileSync(path.join(ROOT, 'lang', f), path.join(dir, 'lang', f));
  fs.mkdirSync(path.join(dir, 'icons')); for (const f of fs.readdirSync(path.join(ROOT, 'icons'))) fs.copyFileSync(path.join(ROOT, 'icons', f), path.join(dir, 'icons', f));
  const s = { dir, down: false, hits: [] };
  const types = { html: 'text/html; charset=utf-8', js: 'text/javascript', json: 'application/json', webmanifest: 'application/manifest+json', png: 'image/png' };
  const srv = http.createServer((req, res) => {
    if (s.down) return req.socket.destroy();
    let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
    s.hits.push(p);
    const file = path.join(dir, p);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': types.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[p.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'max-age=600' });
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); srv.unref();
  const sha = b => crypto.createHash('sha256').update(b).digest('hex');
  // A new version: the same pages with a mark in them, and a version.json that describes them. half: version.json runs ahead of the pages, as in the middle of an upload.
  s.put = (version, mark, { half, langMark } = {}) => {
    let index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace('</body>', '<i id="buildMark" hidden>' + mark + '</i></body>'), planner = fs.readFileSync(path.join(ROOT, 'planner.html'));
    const files = { 'index.html': sha(Buffer.from(index)), 'planner.html': sha(planner) };
    // A new version can bring a changed language file too (langMark): the offline copy takes it with the pages.
    const langs = {};
    for (const f of fs.readdirSync(path.join(dir, 'lang'))) {
      const was = sha(fs.readFileSync(path.join(dir, 'lang', f)));
      if (langMark) fs.appendFileSync(path.join(dir, 'lang', f), '\nwindow.__langMark = ' + JSON.stringify(langMark) + ';\n');
      langs['lang/' + f] = sha(fs.readFileSync(path.join(dir, 'lang', f)));
      index = index.split('"' + was.slice(0, 8) + '"').join('"' + langs['lang/' + f].slice(0, 8) + '"');   // the page asks for each language by a stamp of its contents
    }
    if (!half) fs.writeFileSync(path.join(dir, 'index.html'), index);
    files['index.html'] = sha(Buffer.from(index));
    fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify({ version, build: sha(files['index.html'] + files['planner.html'] + Object.values(langs).join('')).slice(0, 12), notes: ['A note about ' + mark], files, langs }));
  };
  s.url = 'http://localhost:' + srv.address().port + '/?sw=1';
  s.close = () => new Promise(r => { srv.closeAllConnections(); srv.close(r); });
  return s;
}
const updState = page => page.evaluate(() => { const u = window.__gs.updState(); return { on: u.on, cur: u.st && u.st.current && u.st.current.version, next: u.st && u.st.next && u.st.next.version, mode: u.st && u.st.mode }; });
const kept = page => page.waitForFunction(() => { const u = window.__gs.updState(); return u.on && u.st && u.st.current; }, { timeout: 60000, polling: 200 });
const markOf = page => page.evaluate(() => (document.querySelector('#buildMark') || {}).textContent || '');
const reloadApp = async page => { await page.reloadHere(); await appReady(page); };

test('the app is kept on the computer: it opens with no internet, and nothing of her work is in the cache', async () => {
  const s = await site(), { page, close } = await openOwn({ server: s });
  await kept(page);
  assert.equal((await updState(page)).cur, require('../package.json').version);
  await openZip(page, zip, 'River essay.zip'); await score(page, [3, 3, 3]); await settle(page);
  const cached = await page.evaluate(async () => { const out = {}; for (const n of await caches.keys()) out[n] = (await (await caches.open(n)).keys()).map(r => new URL(r.url).pathname).sort(); return out; });
  assert.deepEqual(cached, { 'gs-app-1': ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/index.html', '/manifest.webmanifest', '/planner.html', '/version.json'] }, 'the pages, their icons and nothing else');
  s.down = true;
  await reloadApp(page);
  assert.equal(await page.evaluate(() => window.__gs.kept().size), 1, 'with no internet the app opens, with her work');
  await page.goto(s.url.replace('?sw=1', 'planner.html'));
  await page.waitForSelector('#railSaved', { timeout: 30000 });
  s.down = false;
  assert.deepEqual(page.errors, []);
  await close(); await s.close();
});

test('a newer version waits until she says so: the page stays as it is, the sidebar says “Update ready”, and Update now takes it', async () => {
  const s = await site(), { page, close } = await openOwn({ server: s });
  await kept(page);
  await openZip(page, zip, 'River essay.zip'); await score(page, [3.5, 3, 3]); await settle(page);
  const id = await idOf(page), before = (await idbRead(page, 'grading-studio-keep', 'work'))[id];
  s.put('9.9.9', 'B');
  await reloadApp(page);   // a reload in the middle of marking
  assert.equal(await markOf(page), '', 'still the version she had');
  await page.waitForFunction(() => !document.querySelector('#railUpdate').hidden, { timeout: 60000, polling: 200 });
  assert.equal(await page.$eval('#railUpdate', e => e.textContent.trim()), 'Update ready');
  await reloadApp(page);
  assert.equal(await markOf(page), '', 'and still, however often the page is loaded');
  // The reload puts her back on the paper she was marking. Going to Settings before that has finished would be undone by it.
  await page.waitForFunction(() => { const st = window.__gs.state(); return st.batch && st.pages && st.pages.length > 0 && !!st.pages[0].bmp; }, { timeout: 60000 });
  await goTo(page, '#/settings/about');
  await page.waitForSelector('#setAbout [data-updnow]');
  assert.match(await page.$eval('#setAbout', e => e.innerText), /Version 9\.9\.9 is ready\.[\s\S]*A note about B/);
  const nav = page.waitForNavigation({ timeout: 60000 });
  await page.click('#setAbout [data-updnow]');
  await nav; await appReady(page);
  assert.equal(await markOf(page), 'B', 'the new version, once she asked for it');
  await kept(page);
  assert.equal(await page.$eval('#railUpdate', e => e.hidden), true);
  assert.deepEqual((await idbRead(page, 'grading-studio-keep', 'work'))[id], before, 'her work is exactly as it was');
  assert.deepEqual(page.errors, []);
  await close(); await s.close();
});

test('the language she chose is kept with the app: it opens in it with no internet, and a new version brings its language along', async () => {
  const s = await site(), { page, close } = await openOwn({ server: s });
  await kept(page);
  const langsKept = () => page.evaluate(async () => (await (await caches.open('gs-app-1')).keys()).map(r => new URL(r.url).pathname).filter(p => p.startsWith('/lang/')).sort());
  assert.deepEqual(await langsKept(), [], 'in English no language is kept');
  await page.evaluate(() => localStorage.setItem('gs.lang', '"es"'));
  await reloadApp(page);
  await page.waitForFunction(() => window.__gsLang.lang === 'es' && document.querySelector('#rail [data-nav="home"]').textContent.trim() === 'Hoy');
  await page.waitForFunction(async () => !!(await (await caches.open('gs-app-1')).match('lang/es.js')), { timeout: 30000, polling: 200 });
  assert.deepEqual(await langsKept(), ['/lang/es.js'], 'the one she chose, and no other');
  s.down = true;
  await reloadApp(page);
  assert.equal(await page.evaluate(() => window.__gsLang.lang), 'es', 'with no internet the app still opens in Spanish');
  s.down = false;
  // A new version whose Spanish file changed: nothing changes until she says so, then the page and its language arrive together.
  s.put('9.9.9', 'B', { langMark: 'B' });
  await reloadApp(page);
  await page.waitForFunction(() => !document.querySelector('#railUpdate').hidden, { timeout: 60000, polling: 200 });
  assert.equal(await page.evaluate(() => window.__langMark || ''), '', 'still the Spanish of the version she had');
  await page.evaluate(() => navigator.serviceWorker.ready.then(r => r.active.postMessage({ type: 'gs-apply' })));
  await page.waitForFunction(() => { const u = window.__gs.updState(); return u.st && u.st.current && u.st.current.version === '9.9.9'; }, { timeout: 60000, polling: 200 });
  s.down = true;
  await reloadApp(page);
  assert.equal(await markOf(page), 'B');
  assert.equal(await page.evaluate(() => window.__gsLang.lang), 'es', 'the new version opens in Spanish with no internet');
  assert.equal(await page.evaluate(() => window.__langMark), 'B', 'with the Spanish that came with it');
  s.down = false;
  assert.deepEqual(page.errors, []);
  await close(); await s.close();
});

test('a version caught half uploaded is not taken, and “update by itself” takes one only when the app is next opened', async () => {
  const s = await site(), { page, close } = await openOwn({ server: s });
  await kept(page);
  s.put('9.9.8', 'half', { half: true });
  await goTo(page, '#/settings/about');
  await page.click('#setAbout [data-updcheck]');
  await page.waitForFunction(() => !window.__gs.updState().checking, { timeout: 60000, polling: 200 });
  assert.ok(!(await updState(page)).next, 'the pages did not match what version.json said, so nothing was kept');
  assert.equal(await page.$eval('#railUpdate', e => e.hidden), true);
  // she chooses to have updates arrive by themselves
  await page.click('#setAbout input[value="auto"]');
  await page.waitForFunction(() => { const u = window.__gs.updState(); return u.st && u.st.mode === 'auto'; }, { polling: 200 });
  s.put('9.9.9', 'C');
  await page.click('#setAbout [data-updcheck]');
  await page.waitForFunction(() => { const u = window.__gs.updState(); return u.st && u.st.next && u.st.next.version === '9.9.9'; }, { timeout: 60000, polling: 200 });
  assert.equal(await markOf(page), '', 'not while the app is open');
  await reloadApp(page);
  assert.equal(await markOf(page), 'C', 'the next time it is opened');
  assert.deepEqual(page.errors, []);
  await close(); await s.close();
});

test('the localhost preview and the double-click copy have no service worker', async () => {
  const { page, close } = await openApp(browser);
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
  await goTo(page, '#/settings/about');
  assert.match(await page.$eval('#setAbout', e => e.innerText), /Grading Studio \d+\.\d+\.\d+[\s\S]*New in this version/);
  assert.equal(await page.$eval('#railUpdate', e => e.hidden), true);
  assert.deepEqual(page.errors, []);
  await close();
});
