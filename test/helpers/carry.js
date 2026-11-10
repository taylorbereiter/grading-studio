// Linking a folder and making take-home files without the browser's own pickers, which can't be driven in a test.
// The folder is one from the browser's private file system, and the app can't tell the difference.
const { pickFile, appReady, goTo, closeBox } = require('./app');

// Links the folder called name, made if needed.
const linkFolder = (page, name = 'Linked') => page.evaluate(async name => {
  const h = await (await navigator.storage.getDirectory()).getDirectoryHandle(name, { create: true });
  await window.__gs.folderUse(h);
  return window.__gs.folderWait();
}, name);
const folderWait = page => page.evaluate(() => window.__gs.folderWait());
const folderInfo = page => page.evaluate(() => { const f = window.__gs.folderState(); return { state: f.state, name: f.name, asks: f.asks.length }; });
// Reads a JSON file from the linked folder's data: read(page, 'downloads', id, 'work.json').
const folderRead = (page, ...parts) => page.evaluate(async parts => {
  let d = window.__gs.folderState().root;
  for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(encodeURIComponent(p));
  const f = await d.getFileHandle(parts[parts.length - 1]);
  return JSON.parse(await (await f.getFile()).text());
}, parts);
const folderWrite = (page, parts, obj) => page.evaluate(async (parts, obj) => {
  let d = window.__gs.folderState().root;
  for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(encodeURIComponent(p), { create: true });
  const w = await (await d.getFileHandle(parts[parts.length - 1], { create: true })).createWritable();
  await w.write(typeof obj === 'string' ? obj : JSON.stringify(obj)); await w.close();
}, parts, obj);
const folderList = (page, ...parts) => page.evaluate(async parts => {
  let d = window.__gs.folderState().root;
  for (const p of parts) d = await d.getDirectoryHandle(encodeURIComponent(p));
  const out = []; for await (const [n] of d.entries()) out.push(n);
  return out.sort();
}, parts);
// Go back in time (Settings): opens the dated copy called name and presses "Restore everything from this copy". The app then asks, and reloads.
async function goBackAll(page, name) {
  await goTo(page, '#/settings/history');
  const sel = '[data-hlook="f:' + name + '"]';
  await page.waitForSelector(sel, { timeout: 30000 });
  await page.$eval(sel, b => b.click());
  await page.waitForSelector('#setHistory [data-hall]', { timeout: 30000 });
  await page.$eval('#setHistory [data-hall]', b => b.click());
}
// Empties the browser's own storage, and leaves the private file system (the folder) alone.
async function wipeBrowser(page, srv) {
  await page.goto(srv.url + 'blank');
  await page.evaluate(async () => {
    localStorage.clear();
    for (const d of await indexedDB.databases()) await new Promise(res => { const r = indexedDB.deleteDatabase(d.name); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  });
  await page.goto(srv.url);
  await appReady(page);
}
// Makes a take-home file through the dialog, and returns its bytes. The save dialog is replaced with a file in the private file system.
async function takeHome(page, pass = 'correct horse battery') {
  await page.evaluate(async () => {
    const h = await (await navigator.storage.getDirectory()).getFileHandle('take-home-test.gswork', { create: true });
    window.__gs.takeUse(h);
  });
  await goTo(page, '#/settings'); await page.click('#takeBtn');
  await page.waitForSelector('#takeP1');
  await page.$eval('#takeP1', (e, p) => { e.value = p; }, pass);
  await page.$eval('#takeP2', (e, p) => { e.value = p; }, pass);
  await page.click('#takeGo');
  await page.waitForSelector('#takeDone', { timeout: 120000 });
  const text = await page.$eval('#takeDone', e => e.textContent);
  if (!/^Done/.test(text)) throw new Error('Take-home failed: ' + text);
  const b64 = await page.evaluate(async () => {
    const f = await (await (await navigator.storage.getDirectory()).getFileHandle('take-home-test.gswork')).getFile();
    const u = new Uint8Array(await f.arrayBuffer()); let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  });
  await closeBox(page);
  return new Uint8Array(Buffer.from(b64, 'base64'));
}
// Picks the file and types the passphrase. Resolves when the preview is up, or to what went wrong: { error }.
async function openFile(page, bytes, pass = 'correct horse battery', name = 'Grading Studio work.gswork') {
  const clean = await pickFile(page, '#restoreIn', bytes, name);
  await page.waitForSelector('#takeP1');
  await page.$eval('#takeP1', (e, p) => { e.value = p; }, pass);
  await page.click('#takeGo');
  await page.waitForFunction(() => document.querySelector('#bringBox') || document.querySelector('#askDlg') || (document.querySelector('#takeErr') && !document.querySelector('#takeErr').hidden), { timeout: 120000 });
  clean();
  const err = await page.evaluate(() => { const a = document.querySelector('#askText'), e = document.querySelector('#takeErr'); return a ? a.textContent : e && !e.hidden ? e.textContent : ''; });
  return err ? { error: err } : { preview: await page.$eval('#bringBox', e => e.innerText) };
}
// Presses Bring it in, and waits for the page to come back.
async function bringIt(page) {
  const nav = page.waitForNavigation({ timeout: 120000 });
  await page.click('#bringGo');
  await nav;
  await appReady(page);
}
// The same for an old backup ZIP.
async function openZipBackup(page, bytes) {
  const clean = await pickFile(page, '#restoreIn', bytes, 'Grading Studio backup 2026-10-31.zip');
  await page.waitForSelector('#bringBox', { timeout: 60000 });
  clean();
  return page.$eval('#bringBox', e => e.innerText);
}
module.exports = { goBackAll, linkFolder, folderWait, folderInfo, folderRead, folderWrite, folderList, wipeBrowser, takeHome, openFile, bringIt, openZipBackup };
