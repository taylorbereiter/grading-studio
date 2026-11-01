// A year of papers: over 600 MB of made-up files through Take my work with me and Bring work in. It takes minutes and about 2 GB of disk,
// so it only runs when asked for: GS_BIG=1 node --test test/takehome-big.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const { launch } = require('./helpers/chrome');
const { serve } = require('./helpers/serve');
const { builtHtml, openApp, appReady } = require('./helpers/app');
const { linkFolder } = require('./helpers/carry');

// How much memory the page's process is really using, in MB. Array buffers don't show in the JS heap, so this asks the system.
function rssOf(pid) {
  try {
    if (process.platform === 'win32') return +execFileSync('powershell', ['-NoProfile', '-Command', '(Get-Process -Id ' + pid + ').WorkingSet64'], { encoding: 'utf8' }) / 1e6;
    return +execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' }) / 1e3;
  } catch { return 0; }
}
async function rendererPid(browser) {
  const b = await browser.target().createCDPSession(), { processInfo } = await b.send('SystemInfo.getProcessInfo');
  return processInfo.filter(p => p.type === 'renderer').map(p => p.id);
}
// The page's event loop is checked every 20 ms: the longest gap is how long the tab froze.
// Kept in sessionStorage, since bringing work in ends with a reload.
const watchStart = page => page.evaluate(() => { let gap = 0, last = performance.now(); sessionStorage.setItem('gap', 0); window.__gapT = setInterval(() => { const t = performance.now(); if (t - last > gap) { gap = t - last; sessionStorage.setItem('gap', gap); } last = t; }, 20); });
const watchEnd = page => page.evaluate(() => { clearInterval(window.__gapT); return Math.round(+sessionStorage.getItem('gap')); });
async function measure(browser, page, label, act) {
  const pids = await rendererPid(browser);
  let peak = 0, stop = false;
  const base = Math.max(...pids.map(rssOf));
  const sampler = (async () => { while (!stop) { peak = Math.max(peak, ...pids.map(rssOf)); await new Promise(r => setTimeout(r, 300)); } })();
  await watchStart(page);
  const t0 = Date.now();
  await act();
  const secs = (Date.now() - t0) / 1000;
  const gap = await watchEnd(page);
  stop = true; await sampler;
  const out = { label, secs: Math.round(secs), longestFreezeMs: gap, memoryBeforeMB: Math.round(base), memoryPeakMB: Math.round(peak) };
  console.log(JSON.stringify(out));
  return out;
}

test('over 600 MB goes out and comes back, with the tab responsive and no spike the size of the papers', { skip: !process.env.GS_BIG, timeout: 3000000 }, async () => {
  const browser = await launch(), server = await serve(builtHtml());
  try {
    const { page } = await openApp(browser, { server, context: browser.defaultBrowserContext() });
    page.setDefaultTimeout(1500000);
    // 25 downloads of 20 MB, and one big one of 120 MB, each paper about 1 MB, as made-up bytes.
    const made = await page.evaluate(async () => {
      const block = new Uint8Array(65536); crypto.getRandomValues(block);
      const paper = (n, seed) => { const u = new Uint8Array(n); for (let i = 0; i < n; i += 65536) u.set(block.subarray(0, Math.min(65536, n - i)), i); u[0] = seed; u[1] = seed >> 8; return u; };
      const db = await new Promise((res, rej) => { const r = indexedDB.open('grading-studio-keep', 2); r.onupgradeneeded = () => { for (const n of ['papers', 'work', 'meta', 'edits']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const put = (store, k, v) => new Promise((res, rej) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
      let total = 0;
      for (let d = 0; d < 26; d++) {
        const id = 'gs.b.big' + d, mb = d === 25 ? 120 : 20, entries = [], s = {};
        for (let i = 0; i < mb; i++) { const key = 'Made Up ' + (i % 30); entries.push({ path: key + '/Paper ' + i + '.pdf', data: paper(1000000, d * 100 + i) }); }
        for (let i = 0; i < 30; i++) s['Made Up ' + i] = { f: {}, g: { rubric: [3, 3, 3], points: '', comment: 'Comment ' + i }, h: {} };
        await put('papers', id, { id, label: 'Big ' + d, entries });
        await put('work', id, { t: 1000 + d, s });
        await put('meta', id, { id, name: 'Big ' + d, n: 30, t: 1000 + d, scored: 30, papers: true, size: mb * 1000000 });
        total += mb * 1000000;
      }
      db.close();
      return total;
    });
    assert.ok(made >= 500e6);
    await page.reload(); await appReady(page);
    await page.waitForFunction(() => window.__gs.kept().size === 26);
    await page.evaluate(async () => { window.__gs.takeUse(await (await navigator.storage.getDirectory()).getFileHandle('big.gswork', { create: true })); });
    await page.click('#takeBtn');
    await page.waitForSelector('#takeP1');
    await page.$eval('#takeP1', e => { e.value = 'correct horse battery'; }); await page.$eval('#takeP2', e => { e.value = 'correct horse battery'; });
    const out = await measure(browser, page, 'Take my work with me', async () => {
      await page.click('#takeGo');
      await page.waitForSelector('#takeDone', { timeout: 1500000 });
    });
    assert.match(await page.$eval('#takeDone', e => e.textContent), /^Done/);
    const size = await page.evaluate(async () => (await (await (await navigator.storage.getDirectory()).getFileHandle('big.gswork')).getFile()).size);
    console.log('file size MB', Math.round(size / 1e6));
    assert.ok(size >= made);
    await page.click('#dlgBox [data-close]');
    // A browser with nothing in it. The file stays, in the private file system.
    await page.goto(server.url + 'blank');
    await page.evaluate(async () => {
      localStorage.clear();
      for (const n of ['grading-studio-keep', 'grading-studio-added', 'grading-studio-safety']) await new Promise(res => { const r = indexedDB.deleteDatabase(n); r.onsuccess = r.onerror = r.onblocked = () => res(); });
    });
    await page.goto(server.url); await appReady(page);
    await page.evaluate(async () => { const f = await (await (await navigator.storage.getDirectory()).getFileHandle('big.gswork')).getFile(); window.__gs.bringFile(new File([f], 'big.gswork')); });
    await page.waitForSelector('#takeP1');
    await page.$eval('#takeP1', e => { e.value = 'correct horse battery'; });
    const check = await measure(browser, page, 'Checking the file', async () => {
      await page.click('#takeGo');
      await page.waitForSelector('#bringGo', { timeout: 1500000 });
    });
    assert.match(await page.$eval('#bringBox', e => e.innerText), /26 new downloads/);
    const bring = await measure(browser, page, 'Bringing it in', async () => {
      const nav = page.waitForNavigation({ timeout: 1500000 });
      await page.click('#bringGo');
      await nav;
    });
    await appReady(page);
    await page.waitForFunction(() => window.__gs.kept().size === 26);
    const got = await page.evaluate(async () => {
      const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
      const rec = await new Promise(res => { const q = db.transaction('papers').objectStore('papers').get('gs.b.big25'); q.onsuccess = () => res(q.result); });
      const part = await new Promise(res => { const q = db.transaction('papers').objectStore('papers').get('gs.b.big25|7|0'); q.onsuccess = () => res(q.result); });   // a download this big is kept in pieces (paperPut)
      const w = await new Promise(res => { const q = db.transaction('work').objectStore('work').get('gs.b.big3'); q.onsuccess = () => res(q.result); });
      db.close();
      return { n: rec.entries.length, first: rec.entries[7].size, piece: part.length, s0: part[0], s1: part[1], c: w.s['Made Up 4'].g.comment };
    });
    assert.deepEqual(got, { n: 120, first: 1000000, piece: 1000000, s0: (2500 + 7) & 255, s1: (2500 + 7) >> 8, c: 'Comment 4' });
    // And the folder: all of it copied there, then back into a browser with nothing in it.
    const link = await measure(browser, page, 'Linking a folder', () => linkFolder(page, 'Big'));
    await page.goto(server.url + 'blank');
    await page.evaluate(async () => {
      localStorage.clear();
      for (const n of ['grading-studio-keep', 'grading-studio-added', 'grading-studio-safety', 'grading-studio-folder']) await new Promise(res => { const r = indexedDB.deleteDatabase(n); r.onsuccess = r.onerror = r.onblocked = () => res(); });
    });
    await page.goto(server.url); await appReady(page);
    assert.equal(await page.evaluate(() => window.__gs.kept().size), 0);
    const back = await measure(browser, page, 'Getting it all back from the folder', () => linkFolder(page, 'Big'));
    assert.equal(await page.evaluate(() => window.__gs.kept().size), 26);
    // Reading records one at a time and writing chunk by chunk, no pass should hold anything near all of it, or freeze the tab.
    for (const m of [out, check, bring, link, back]) {
      assert.ok(m.longestFreezeMs < 3000, m.label + ' froze for ' + m.longestFreezeMs + ' ms');
      if (m.memoryPeakMB) assert.ok(m.memoryPeakMB - m.memoryBeforeMB < 480, m.label + ' grew by ' + (m.memoryPeakMB - m.memoryBeforeMB) + ' MB');
    }
    assert.deepEqual(page.errors, []);
  } finally { await browser.close(); await server.close(); }
});
