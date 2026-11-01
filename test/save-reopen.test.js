// Saving and reopening a download, and the places Mac and Windows behave differently.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { launch } = require('./helpers/chrome');
const { serve } = require('./helpers/serve');
const { builtHtml, tmpDir, openApp, openZip, pickFile, waitPaper, appReady, goToStudent, markPage, setTool, drag, score, settle, workOf, probeScreen } = require('./helpers/app');
const { standardFiles, makePaper, zipOf } = require('./helpers/fixtures');
const { zipSync } = require('fflate');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const marksOf = (w, key, file) => w[key].files[file].marks;
async function gradeSomeWork(page) {
  await markPage(page, 0);
  await score(page, [3.5, 3.5, 3.5]);
  await page.type('#cmtIn', 'Strong ideas.');
  await goToStudent(page, 1);
  await score(page, [4]);
  await settle(page);
  await page.evaluate(() => window.__gs.scanAll());
}

test('marks, scores and comments come back after closing the browser for real', async () => {
  const dir = tmpDir('restart'), server = await serve(builtHtml());
  const b1 = await launch({ userDataDir: dir, keepProfile: true });
  let before_;
  try {
    const { page } = await openApp(b1, { server, context: b1.defaultBrowserContext() });
    await openZip(page, zip, 'River essay.zip');
    await gradeSomeWork(page);
    before_ = await workOf(page);
    assert.deepEqual(page.errors, []);
  } finally { await b1.close(); }
  const b2 = await launch({ userDataDir: dir, keepProfile: true });
  try {
    const { page } = await openApp(b2, { server, context: b2.defaultBrowserContext() });
    await page.waitForSelector('#kept [data-kopen]');
    assert.match(await page.$eval('#kept', e => e.textContent), /River essay.*4 students · 1 scored · 1 partial/s);
    await page.click('#kept [data-kopen]');
    await waitPaper(page);
    const w = await workOf(page);
    assert.deepEqual(w['Aria Testwell'].grade, before_['Aria Testwell'].grade);
    assert.deepEqual(w['Aria Testwell'].computed, { total: 10.5, pct: 93, done: true });
    assert.deepEqual(marksOf(w, 'Aria Testwell', 'Aria Testwell/Essay.pdf'), marksOf(before_, 'Aria Testwell', 'Aria Testwell/Essay.pdf'));
    assert.deepEqual(marksOf(w, 'Aria Testwell', 'Aria Testwell/Essay.pdf')[0].map(m => m.t), ['pen', 'hl', 'oval', 'check', 'text', 'note']);
    assert.deepEqual(w['Bram Sample'].grade.rubric, [4]);
    assert.equal(await page.evaluate(() => window.__gs.state().batch.students[window.__gs.state().cur].key), 'Bram Sample', 'back on the student she left off with');
    assert.deepEqual(page.errors, []);
  } finally { await b2.close(); await server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('dropping the same download in again picks up where she left off', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await gradeSomeWork(page);
  const was = await workOf(page), id = await page.evaluate(() => window.__gs.state().batch.id);
  await page.reload(); await appReady(page);
  assert.equal(await page.$eval('#app', e => e.hidden), true);
  await openZip(page, zip);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.id), id);
  await page.evaluate(() => window.__gs.scanAll());
  assert.deepEqual(await workOf(page), was);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the score panel and Grades list show the scale’s percent', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await score(page, [3.5, 3.5, 3.5]);
  const total = await page.$eval('#grade .total', e => e.textContent);
  assert.match(total, /10\.5/); assert.match(total, /93%/);
  await page.click('.scores[data-c="0"] button[data-v="3.5"]');   // clicking a score again clears it
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].grade.rubric[0]), null);
  await page.click('.scores[data-c="0"] button[data-v="3.5"]');
  await page.click('#gradesBtn');
  await page.waitForFunction(() => /Aria Testwell/.test(document.querySelector('#dlgBox').textContent));
  const list = await page.$eval('#dlgBox', e => e.textContent);
  assert.match(list, /10\.5/); assert.match(list, /93%/);
  await close();
});

test('Forget removes a download and its work from this browser', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await score(page, [3, 3, 3]); await settle(page);
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await page.click('#closeBtn');
  await page.waitForSelector('#kept [data-kforget]');
  await page.evaluate(id => window.__gs.forgetKept(id), id);
  assert.equal(await page.evaluate(id => localStorage.getItem(id), id), null);
  assert.equal(await page.evaluate(() => window.__gs.kept().size), 0);
  await close();
});

/* ---------------- where Mac and Windows differ ---------------- */
for (const [platform, mod] of [['mac', 'Meta'], ['win', 'Control']]) {
  test('keys on ' + platform + ': ' + mod + ' does undo, redo and zoom', async () => {
    const { page, close } = await openApp(browser, { platform });
    assert.equal(await page.evaluate(() => navigator.platform), platform === 'mac' ? 'MacIntel' : 'Win32');
    await openZip(page, zip);
    await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);
    const count = () => page.evaluate(() => (window.__gs.state().batch.students[0].files[0].marks[0] || []).length);
    const press = async k => { await page.keyboard.down(mod); await page.keyboard.press(k); await page.keyboard.up(mod); };
    assert.equal(await count(), 1);
    await press('z'); assert.equal(await count(), 0, 'undo');
    await page.keyboard.down(mod); await page.keyboard.down('Shift'); await page.keyboard.press('z'); await page.keyboard.up('Shift'); await page.keyboard.up(mod);
    assert.equal(await count(), 1, 'redo with Shift');
    await press('z'); await press('y'); assert.equal(await count(), 1, 'redo with Y');
    const zoom = () => page.evaluate(() => window.__gs.state().zoom);
    const z0 = await zoom();
    await press('='); assert.ok(await zoom() > z0, 'zoom in');
    await press('0'); assert.equal(await zoom(), 1, 'back to 100%');
    assert.deepEqual(page.errors, []);
    await close();
  });
}

test('a Mac ZIP: its hidden __MACOSX and .DS_Store files aren’t students or papers', async () => {
  const { page, close } = await openApp(browser, { platform: 'mac' });
  const paper = await makePaper();
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Aria Testwell/.DS_Store': new Uint8Array(8), '__MACOSX/Aria Testwell/._Essay.pdf': new Uint8Array(8), 'Bram Sample/Essay.pdf': paper, '.DS_Store': new Uint8Array(8) }));
  const got = await page.evaluate(() => window.__gs.state().batch.students.map(s => [s.key, s.files.map(f => f.name)]));
  assert.deepEqual(got, [['Aria Testwell', ['Essay.pdf']], ['Bram Sample', ['Essay.pdf']]]);
  await close();
});

test('a ZIP without the UTF-8 flag (Mac and Windows often skip it): accented names read correctly', async () => {
  const { page, close } = await openApp(browser);
  const z = zipSync({ 'José Ejemplo/Ensayo.pdf': await makePaper(), 'Zoë Prueba/Ensayo.pdf': await makePaper() });
  // Take the flag off every entry, as those tools leave it.
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength);
  for (let i = 0; i < z.length - 8; i++) { const s = v.getUint32(i, true); if (s === 0x04034b50) v.setUint16(i + 6, v.getUint16(i + 6, true) & ~0x800, true); else if (s === 0x02014b50) v.setUint16(i + 8, v.getUint16(i + 8, true) & ~0x800, true); }
  await openZip(page, z);
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.students.map(s => s.key)), ['José Ejemplo', 'Zoë Prueba']);
  await close();
});

// The same accented name, in the two spellings a computer can hand over: Windows's "é", and the "e" plus accent often seen on a Mac.
const spelled = async form => { const p = await makePaper(); return zipOf({ ['José Núñez/Essay.pdf'.normalize(form)]: p, ['Zoë Prueba/Essay.pdf'.normalize(form)]: p }); };
const student1 = page => page.evaluate(() => { const s = window.__gs.state(); return { id: s.batch.id, key: s.batch.students[0].key, n: s.batch.students.length, grade: s.batch.students[0].grade.rubric }; });
for (const [first, second] of [['NFC', 'NFD'], ['NFD', 'NFC']]) test('accented names spelled ' + first + ' on one computer and ' + second + ' on the other: the same download, with its work', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, await spelled(first));
  await score(page, [3.5, 3.5, 3.5]); await settle(page);
  const was = await student1(page);
  assert.equal(was.key, 'José Núñez'.normalize('NFC'), 'new work takes one spelling, so both computers agree');
  await page.reload(); await appReady(page);
  await openZip(page, await spelled(second));
  const now = await student1(page);
  assert.equal(now.id, was.id); assert.equal(now.key, was.key); assert.equal(now.n, 2);
  assert.deepEqual(now.grade, [3.5, 3.5, 3.5]);
  assert.deepEqual(page.errors, []);
  await close();
});

test('work an earlier copy of the app saved under the Mac spelling keeps its id and opens from either spelling', async () => {
  const { page, close } = await openApp(browser);
  const paper = await makePaper(), key = 'José Núñez'.normalize('NFD'), path_ = key + '/Essay.pdf', other = 'Zoë Prueba/Essay.pdf'.normalize('NFD');
  const id = await page.evaluate((a, b, n) => window.__gs.batchIdOf([{ path: a, data: { length: n } }, { path: b, data: { length: n } }]), path_, other, paper.length);
  const mark = { t: 'check', color: '#D7263D', x: 100, y: 100 };
  await page.evaluate((id, key, path_, mark) => localStorage.setItem(id, JSON.stringify({ t: 5, cur: 0, s: { [key]: { f: { [path_]: { 0: [mark] } }, g: { rubric: [3, 3, 3], points: '', comment: '' }, h: {} } } })), id, key, path_, mark);
  for (const form of ['NFD', 'NFC']) {
    await page.reload(); await appReady(page);
    await openZip(page, await spelled(form));
    const s = await student1(page);
    assert.equal(s.id, id, form); assert.equal(s.key, key, form); assert.deepEqual(s.grade, [3, 3, 3], form);
    assert.deepEqual((await workOf(page))[key].files[path_].marks, { 0: [mark] }, form);
  }
  assert.deepEqual(page.errors, []);
  await close();
});

test('a ZIP with one top folder, and one with a ZIP per student', async () => {
  const { page, close } = await openApp(browser);
  const paper = await makePaper();
  await openZip(page, zipOf({ 'Download/Aria Testwell/Essay.pdf': paper, 'Download/Bram Sample/Essay.pdf': paper }));
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.students.map(s => s.key)), ['Aria Testwell', 'Bram Sample']);
  await close();
  const b = await openApp(browser);
  await openZip(b.page, zipOf({ 'Aria Testwell.zip': zipOf({ 'Essay.pdf': paper }), 'Bram Sample.zip': zipOf({ 'Essay.pdf': paper }) }));
  assert.deepEqual(await b.page.evaluate(() => window.__gs.state().batch.students.map(s => s.key)), ['Aria Testwell', 'Bram Sample']);
  await b.close();
});

test('choosing a folder works the same as a ZIP', async () => {
  const { page, close } = await openApp(browser);
  const dir = tmpDir('folder'), top = path.join(dir, 'Download');
  for (const [p, data] of Object.entries(await standardFiles())) { const f = path.join(top, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); }
  await (await page.$('#dirIn')).uploadFile(top);
  await waitPaper(page);
  const keys = await page.evaluate(() => window.__gs.state().batch.students.map(s => s.key));
  assert.deepEqual(keys, ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup']);
  await close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('marks drawn with the mouse show on the page', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  const box = [[90, 290, 200, 50]];
  assert.equal((await probeScreen(page, 0, box))[0].red, 0, 'nothing red before');
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [160, 330], [220, 300], [280, 330]]);
  assert.ok((await probeScreen(page, 0, box))[0].red > 20, 'the pen line is there');
  await close();
});

test('a picked file that isn’t a paper still opens without breaking', async () => {
  const { page, close } = await openApp(browser);
  const clean = await pickFile(page, '#fileIn', new TextEncoder().encode('Just some words.'), 'Notes for Bram Sample.txt');
  await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && !a.hidden; });
  clean();
  assert.deepEqual(page.errors, []);
  await close();
});
