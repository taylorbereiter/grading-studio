// Where the tracks meet: things that only go wrong, or only have to be right, once they're all in one app. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { launch } = require('./helpers/chrome');
const { openApp, answerDlg, appReady, openZip, waitPaper, score, settle, pickFile } = require('./helpers/app');
const { makePaper, zipOf, standardFiles } = require('./helpers/fixtures');
const { takeHome, openFile, bringIt } = require('./helpers/carry');

const M = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'merge.js'), 'utf8') + ';({ mergeLs, recHash, fileHashes })');
const plain = v => JSON.parse(JSON.stringify(v));

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });
const closeUp = async page => { await page.click('#closeBtn'); await page.waitForFunction(() => document.querySelector('#start').hidden === false); await new Promise(r => setTimeout(r, 200)); };
const openKept = async (page, name) => {
  await page.waitForFunction(n => [...document.querySelectorAll('#kept .krow')].some(r => r.textContent.includes(n)), { timeout: 30000 }, name);
  await page.evaluate(n => [...document.querySelectorAll('#kept .krow')].find(r => r.textContent.includes(n)).querySelector('[data-kopen]').click(), name);
  await page.waitForFunction(n => { const s = window.__gs.state(); return s.batch && s.batch.name === n; }, {}, name);
  await waitPaper(page);
};
const twoPapers = async () => zipOf({ 'Nia Turnwell/Essay.pdf': await makePaper({ title: 'Nia essay' }), 'Oren Turnwell/Essay.pdf': await makePaper({ title: 'Oren essay' }) });
const firstOk = page => page.evaluate(() => { const G = window.__gs, l = G.coverList(); return G.coverOk(l[0].st, l[0].d); });
// Check the covers, through Covers look right on the first paper.
async function checkFirstPaper(page) {
  await page.evaluate(() => window.__gs.openShare());
  await page.waitForSelector('#dlgBox [data-check]');
  await page.click('#dlgBox [data-check]');
  await page.waitForSelector('#ccBody canvas');
  await page.waitForFunction(() => { if (/paper 2 of/.test(document.querySelector('#ccCount').textContent)) return true; document.querySelector('#dlgBox [data-next]').click(); return false; }, { polling: 300 });
  await page.waitForSelector('#ccBody canvas');
}

/* Arrange pages and Rubric setup share one dialog box */
test('Rubric setup saves after Arrange pages was used, and its Save can’t apply an Arrange change she cancelled', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  const layout = () => page.evaluate(() => { const s = window.__gs.state(); return s.batch.students[s.cur].layout || null; });
  await page.evaluate(() => window.__gs.openArrange());
  await page.waitForSelector('#arrBody [data-rm]');
  await page.click('#arrBody [data-rm]');
  await page.click('#dlgBox [data-cancel]');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  assert.equal(await layout(), null);
  await page.evaluate(() => window.__gs.openSetup());
  await page.waitForSelector('#setupBody');
  await page.click('#dlgBox [data-add]');
  await page.click('#dlgBox [data-save]');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  assert.equal((await page.evaluate(() => window.__gs.state().setup.criteria)).length, 4, 'the new row is kept');
  assert.equal(await layout(), null, 'the page she took out and cancelled stays in');
  assert.deepEqual(page.errors, []);
  await close();
});

/* name covers, with scans and the covers check */
test('a straightened page needs another look, and Undo puts her cover back where it was', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, await twoPapers());
  await checkFirstPaper(page);
  await page.keyboard.press('Escape');
  await page.waitForSelector('#ccDone');
  await page.click('#dlgBox [data-close]');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  await page.evaluate(() => window.__gs.openStudent(0));
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.cur === 0 && s.pages.length && s.pages[0].s > 0; });
  const r = await page.evaluate(() => {
    const G = window.__gs, s = G.state(), sh = s.batch.share, pg = s.pages[0], { st, d } = G.coverList()[0], k = pg.file.path + '#' + pg.idx;
    const key = Object.keys(sh.checked).find(x => x.startsWith(pg.file.path)) || k;
    sh.boxes[key] = [[0.1, 0.05, 0.3, 0.05]];
    const was = JSON.stringify(sh.boxes[key]), ok0 = G.coverOk(st, d);
    G.scanStraighten(pg, 3);
    const moved = JSON.stringify(sh.boxes[key]), ok1 = G.coverOk(st, d);
    G.undo();
    return { was, moved, back: JSON.stringify(sh.boxes[key]), ok0, ok1, skew: G.skewOf(pg.file, pg.idx) };
  });
  assert.equal(r.ok0, true);
  assert.notEqual(r.moved, r.was, 'the cover moves with the page');
  assert.equal(r.ok1, false, 'straightening means another look');
  assert.equal(r.back, r.was, 'Undo puts it back');
  assert.equal(r.skew, 0);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Use my last box on every paper means another look at those papers', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, await twoPapers());
  await checkFirstPaper(page);
  assert.equal(await firstOk(page), true, 'the first paper is checked');
  const b = await (await page.$('#ccBody canvas')).boundingBox();
  await page.mouse.move(b.x + 20, b.y + 20); await page.mouse.down(); await page.mouse.move(b.x + 200, b.y + 50, { steps: 3 }); await page.mouse.up();
  await page.waitForFunction(() => { const e = document.querySelector('#dlgBox [data-every]'); return e && !e.hidden; });
  await page.click('#dlgBox [data-every]');
  assert.equal(await firstOk(page), false, 'the first paper got a new cover she hasn’t seen');
  await close();
});

/* what travels */
test('saved rubrics and her same-student answers from both computers are kept', () => {
  const rub = (id, name, at) => ({ id, name, at, criteria: ['Thesis'] });
  const a = { 'gs.rubrics': JSON.stringify([rub('r1', 'Essay', 100), rub('r2', 'Lab', 100)]), 'gs.histSame': JSON.stringify({ x: 1 }) };
  const b = { 'gs.rubrics': JSON.stringify([rub('r2', 'Lab, newer', 200), rub('r3', 'Poem', 100)]), 'gs.histSame': JSON.stringify({ x: 0, y: 1 }) };
  const set = plain(M.mergeLs(a, b));
  assert.deepEqual(JSON.parse(set['gs.rubrics']).map(r => r.name).sort(), ['Essay', 'Lab, newer', 'Poem']);
  assert.deepEqual(JSON.parse(set['gs.histSame']), { x: 1, y: 1 }, 'her answer here stays, and the other one comes in');
  assert.deepEqual(plain(M.mergeLs(a, a)), {}, 'nothing new, nothing to write');
  assert.deepEqual(plain(M.mergeLs({}, b)), { 'gs.rubrics': b['gs.rubrics'], 'gs.histSame': b['gs.histSame'] });
});

test('saving an old page order again isn’t a change, and a straightened page counts as a change to its file', () => {
  const rec = { f: {}, g: { rubric: [3], points: '', comment: '' }, h: {}, L: [{ name: 'a', pages: [['a.pdf', 0]] }] };
  assert.equal(M.recHash(rec), M.recHash({ ...rec, Lp: 1 }));
  assert.deepEqual(Object.keys(plain(M.fileHashes({ ...rec, sk: { 'a.pdf': { 0: 2 } } }))), ['a.pdf']);
});

test('rubrics saved on each computer both come through a take-home file', async () => {
  const rub = (id, name) => ({ id, name, at: 1, criteria: ['Thesis', 'Style'], levels: null, scale: null });
  const a = await openApp(browser);
  await a.page.evaluate(r => localStorage.setItem('gs.rubrics', JSON.stringify([r])), rub('lap', 'From the laptop'));
  await openZip(a.page, zip, 'River essay.zip');
  await settle(a.page);
  await closeUp(a.page);
  const b = await openApp(browser);
  await b.page.evaluate(r => localStorage.setItem('gs.rubrics', JSON.stringify([r])), rub('home', 'From home'));
  const { preview } = await openFile(b.page, await takeHome(a.page));
  assert.match(preview, /Rubrics or settings/);
  await bringIt(b.page);
  await appReady(b.page);
  assert.deepEqual(await b.page.evaluate(() => window.__gs.savedRubrics().map(r => r.name).sort()), ['From home', 'From the laptop']);
  await a.close(); await b.close();
});

test('during anonymous grading the conflict box doesn’t show a file name, which can hold the student’s name', async () => {
  const name = 'Aria Testwell';
  const z = zipOf({ [name + '/' + name + ' final essay.pdf']: await makePaper({ title: 'Essay' }), 'Bram Sample/Bram Sample essay.pdf': await makePaper({ title: 'Essay' }) });
  const a = await openApp(browser);
  await openZip(a.page, z, 'River essay.zip');
  await a.page.evaluate(() => { const s = window.__gs.state(), f = s.pages[0].file; (f.marks[0] ||= []).push({ t: 'check', x: 100, y: 100 }); });
  await score(a.page, [3, 3, 3]);
  await settle(a.page);
  await closeUp(a.page);
  const b = await openApp(browser);
  await openFile(b.page, await takeHome(a.page)); await bringIt(b.page);
  await openKept(b.page, 'River essay');
  await score(b.page, [4, 4, 4]);
  await settle(b.page);
  await closeUp(b.page);
  await openKept(a.page, 'River essay');
  await score(a.page, [2, 2, 2]);
  await a.page.evaluate(() => window.__gs.setAnon(true));
  await settle(a.page);
  await closeUp(a.page);
  await openFile(a.page, await takeHome(b.page));
  const text = await a.page.$eval('#bringBox', e => e.innerText);
  assert.match(text, /A student \(anonymous grading is on\)/);
  assert.ok(!text.includes('Aria') && !text.includes('Testwell'), text);
  assert.match(text, /1 mark/);
  await a.close(); await b.close();
});

test('a take-home file put in the papers box says where it goes, and opens nothing', async () => {
  const { page, close } = await openApp(browser);
  const clean = await pickFile(page, '#fileIn', new Uint8Array(4096).fill(7), 'My work.gswork');
  await page.waitForSelector('#askDlg [data-ok]');
  assert.match(await page.$eval('#askText', e => e.textContent), /Bring work in/);
  await answerDlg(page);
  clean();
  assert.equal(await page.evaluate(() => window.__gs.state().batch), null);
  await close();
});

test('Class overview opens with a blank Out of and a typed 0, and its tip goes when the dialog does', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await page.evaluate(() => { const G = window.__gs, s = G.state(); s.setup.mode = 'points'; s.setup.outOf = ''; s.batch.students[s.cur].grade.points = '0'; G.openOverview(); });
  await page.waitForSelector('#ovBody');
  assert.deepEqual(page.errors, []);
  await page.evaluate(() => { const t = document.createElement('i'); t.dataset.tv = '1 student'; t.dataset.tl = 'x'; t.dataset.tn = 'Someone'; document.querySelector('#ovBody').appendChild(t); t.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
  assert.equal(await page.$eval('#ovTip', e => e.hidden), false);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  assert.equal(await page.$eval('#ovTip', e => e.hidden), true);
  await close();
});

/* late work, with a scanned page's look in between */
test('after + Add file, the new file’s bar is in view, with Mark late on it', async () => {
  const { page, close } = await openApp(browser);
  const paper = await makePaper({ title: 'A paper' });
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Bram Sample/Essay.pdf': paper }));
  await page.evaluate(() => { const was = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === 'file') { this.id = 'pickHere'; document.body.appendChild(this); return; } return was.call(this); }; });
  await page.click('#addFileBtn');
  await page.waitForSelector('#pickHere');
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gs-test-late-')), f = path.join(dir, 'late page.pdf');
  fs.writeFileSync(f, await makePaper({ title: 'Late page' }));
  await (await page.$('#pickHere')).uploadFile(f);
  await page.waitForSelector('#paper [data-marklate]', { timeout: 20000 });
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.pages.length > 1 && s.pages[s.pages.length - 1].s > 0; });
  await page.waitForFunction(() => { const b = document.querySelector('#paper [data-marklate]'), r = b.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === b; }, { timeout: 5000 });
  fs.rmSync(dir, { recursive: true, force: true });
  await close();
});
