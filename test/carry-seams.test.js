// Two computers and a take-home file, in the real built app: settings merge part by part, the preview tells the truth, and page fixes and assignment cards travel. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, pickFile, waitPaper, goToStudent, setTool, drag, score, settle, closeBox } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');
const { takeHome, openFile, bringIt, linkFolder, folderWait, folderRead, folderWrite } = require('./helpers/carry');
const { loadLegacy } = require('./helpers/legacy');
const { PAGE_SRC } = require('./helpers/scans');

let browser, zip, cardFiles;
before(async () => {
  browser = await launch();
  cardFiles = { 'Nia Turnwell/Essay.pdf': await makePaper({ title: 'Nia essay' }), 'Oren Turnwell/Essay.pdf': await makePaper({ title: 'Oren essay' }), 'Pia Sample/Essay.pdf': await makePaper({ title: 'Pia essay' }) };
  zip = zipOf(cardFiles);
});
after(async () => { await browser.close(); });

const closeUp = async page => { await page.click('#closeBtn'); await page.waitForFunction(() => document.querySelector('#start').hidden === false); await new Promise(r => setTimeout(r, 300)); };
const openKept = async (page, name) => {
  await page.waitForFunction(n => [...document.querySelectorAll('#vHome .krow')].some(r => r.textContent.includes(n)), { timeout: 30000 }, name);
  await page.evaluate(n => [...document.querySelectorAll('#vHome .krow')].find(r => r.textContent.includes(n)).querySelector('[data-kopen]').click(), name);
  await page.waitForFunction(n => { const s = window.__gs.state(); return s.batch && s.batch.name === n; }, {}, name);
  await waitPaper(page);
};
const addRow = async page => {
  await page.evaluate(() => window.__gs.openSetup()); await page.waitForSelector('#setupBody');
  await page.click('#dlgBox [data-add]'); await page.click('#dlgBox [data-save]');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
};
const rows = page => page.evaluate(() => window.__gs.state().setup.criteria.length);
const gradeOf = (page, key) => page.evaluate(k => { const G = window.__gs, st = G.state().batch.students.find(s => s.key === k); return { rubric: st.grade.rubric, comment: st.grade.comment, ...G.ownGrade(st) }; }, key);
const filesOf = (page, key) => page.evaluate(k => window.__gs.state().batch.students.find(s => s.key === k).files.map(f => ({ path: f.path, marks: Object.values(f.marks).flat().length })), key);
const lightOn = page => page.evaluate(() => { const G = window.__gs; G.state().batch.lightOpt = { ...G.lightOpts(), on: true }; G.saveNow(); });
// A laptop with the download, and a home computer that has brought it in. Both have it open.
async function twoComputers() {
  const lap = await openApp(browser);
  await openZip(lap.page, zip, 'Tide essay.zip');
  await score(lap.page, [3, 3, 3]);
  await settle(lap.page); await closeUp(lap.page);
  const home = await openApp(browser);
  await openFile(home.page, await takeHome(lap.page));
  await bringIt(home.page);
  await openKept(home.page, 'Tide essay');
  await openKept(lap.page, 'Tide essay');
  return { lap, home };
}
// What's been done at home goes back to the laptop.
async function homeToLaptop(lap, home) {
  await settle(home.page); await closeUp(home.page);
  await closeUp(lap.page);
  return openFile(lap.page, await takeHome(home.page));
}

test('a rubric row and a moved, marked file on the laptop survive a change of lighting at home, and the preview says so', async () => {
  const { lap, home } = await twoComputers();
  await addRow(lap.page);
  await goToStudent(lap.page, 1); await score(lap.page, [4, 4, 4, 4]);
  await goToStudent(lap.page, 2);
  await lap.page.evaluate(() => { const b = window.__gs.state().batch; window.__gs.moveFile(b.students[2], 'Pia Sample/Essay.pdf', b.students[0]); });
  await goToStudent(lap.page, 0);
  await setTool(lap.page, 'pen'); await drag(lap.page, 1, [[100, 300], [200, 330]]);
  await settle(lap.page);
  await new Promise(r => setTimeout(r, 50));
  // Later, at home.
  await lightOn(home.page);
  await goToStudent(home.page, 2); await score(home.page, [2, 2, 2]);
  const { preview } = await homeToLaptop(lap, home);
  assert.match(preview, /Pia Sample/);
  assert.match(preview, /Lighting/, 'the setting that comes in is named');
  await bringIt(lap.page);
  await openKept(lap.page, 'Tide essay');
  assert.equal(await rows(lap.page), 4, 'the laptop’s row stays');
  const oren = await gradeOf(lap.page, 'Oren Turnwell');
  assert.deepEqual(oren.rubric, [4, 4, 4, 4]); assert.equal(oren.total, 16);
  assert.deepEqual((await filesOf(lap.page, 'Nia Turnwell')).map(f => f.marks), [0, 1], 'the moved file stays moved, with its mark');
  assert.deepEqual(await filesOf(lap.page, 'Pia Sample'), [], 'and it isn’t back with Pia');
  assert.equal(await lap.page.evaluate(() => window.__gs.lightOpts().on), true, 'and the lighting came in');
  assert.deepEqual(lap.page.errors, []);
  await lap.close(); await home.close();
});

test('a file moved and marked at home comes back, when the laptop only changed its lighting later', async () => {
  const { lap, home } = await twoComputers();
  await goToStudent(home.page, 2);
  await home.page.evaluate(() => { const b = window.__gs.state().batch; window.__gs.moveFile(b.students[2], 'Pia Sample/Essay.pdf', b.students[1]); });
  await goToStudent(home.page, 1);
  await setTool(home.page, 'pen'); await drag(home.page, 1, [[100, 300], [200, 330]]);
  await settle(home.page);
  await new Promise(r => setTimeout(r, 50));
  await lightOn(lap.page);
  await homeToLaptop(lap, home);
  await bringIt(lap.page);
  await openKept(lap.page, 'Tide essay');
  assert.deepEqual((await filesOf(lap.page, 'Oren Turnwell')).map(f => f.marks), [0, 1]);
  assert.equal(await lap.page.evaluate(() => window.__gs.lightOpts().on), true);
  assert.deepEqual(lap.page.errors, []);
  await lap.close(); await home.close();
});

test('the same setting changed differently on both computers is shown to her, and her choice is what stays', async () => {
  const { lap, home } = await twoComputers();
  await addRow(lap.page); await settle(lap.page);
  await addRow(home.page); await addRow(home.page);
  const { preview } = await homeToLaptop(lap, home);
  assert.match(preview, /Rubric setup/);
  assert.match(preview, /4 rows/); assert.match(preview, /5 rows/);
  await lap.page.click('#bringGo');
  assert.ok(await lap.page.$('#bringBox'), 'nothing happens until she has picked');
  const pick = await lap.page.$eval('.cfrow input[value="a"]', e => e.name);
  await lap.page.click('input[name="' + pick + '"][value="a"]');
  await bringIt(lap.page);
  await openKept(lap.page, 'Tide essay');
  assert.equal(await rows(lap.page), 4, 'the one she picked');
  assert.deepEqual(lap.page.errors, []);
  await lap.close(); await home.close();
});

test('settings changed at home with no student changed can be brought in', async () => {
  const { lap, home } = await twoComputers();
  await lap.page.evaluate(() => localStorage.setItem('gs.setup', JSON.stringify(window.__gs.state().setup)));   // so the laptop has a saved rubric setup, and it isn't new to it
  await addRow(home.page);
  const { preview } = await homeToLaptop(lap, home);
  assert.doesNotMatch(preview, /Nothing to bring in/);
  assert.match(preview, /Rubric setup/);
  await bringIt(lap.page);
  await openKept(lap.page, 'Tide essay');
  assert.equal(await rows(lap.page), 4);
  await lap.close(); await home.close();
});

test('nothing changed anywhere still says there’s nothing to bring in', async () => {
  const { lap, home } = await twoComputers();
  const { preview } = await homeToLaptop(lap, home);
  assert.match(preview, /Nothing to bring in/);
  assert.equal(await lap.page.$('#bringGo'), null);
  await lap.close(); await home.close();
});

test('Put back at home on a page the laptop turned stays put back, and marks made at home stay on their words', async () => {
  const lap = await openApp(browser);
  await lap.page.evaluate(PAGE_SRC);
  const bytes = Buffer.from(await lap.page.evaluate(sp => window.gsScan.pdf(sp), [{ o: 180, skew: 0, box: true }]), 'base64');
  const typed = await makePaper({ title: 'Typed essay' });
  await openZip(lap.page, zipOf({ 'Aria Testwell/Scan.pdf': bytes, 'Bram Sample/Essay.pdf': typed, 'Cleo Fixture/Scan.pdf': bytes }), 'Scans.zip');
  await lap.page.waitForFunction(() => { const f = window.__gs.state().batch.students[0].files[0]; return f.rot && f.rot[0] === 180; });
  await goToStudent(lap.page, 2);
  await lap.page.waitForFunction(() => { const f = window.__gs.state().batch.students[2].files[0]; return f.rot && f.rot[0] === 180; });
  await settle(lap.page); await closeUp(lap.page);
  const home = await openApp(browser);
  await openFile(home.page, await takeHome(lap.page));
  await bringIt(home.page);
  await openKept(home.page, 'Scans');
  await goToStudent(home.page, 0);
  await home.page.waitForFunction(() => window.__gs.state().pages[0].snote);
  await home.page.evaluate(() => window.__gs.state().pages[0].snote.querySelector('[data-sc="back"]').click());
  await home.page.waitForFunction(() => !(window.__gs.state().batch.students[0].files[0].rot || {})[0]);
  await waitPaper(home.page);
  await setTool(home.page, 'pen'); await drag(home.page, 0, [[100, 300], [300, 300]]);
  await score(home.page, [2, 2, 2]);
  const was = await home.page.evaluate(() => window.__gs.state().batch.students[0].files[0].marks[0][0].pts);
  await goToStudent(home.page, 2);   // and on another paper, Put back and no marks at all: only what she decided about the page has changed
  await home.page.waitForFunction(() => window.__gs.state().pages[0].snote);
  await home.page.evaluate(() => window.__gs.state().pages[0].snote.querySelector('[data-sc="back"]').click());
  await home.page.waitForFunction(() => !(window.__gs.state().batch.students[2].files[0].rot || {})[0]);
  await settle(home.page); await closeUp(home.page);
  const { preview } = await openFile(lap.page, await takeHome(home.page));
  assert.match(preview, /Aria Testwell/);
  await bringIt(lap.page);
  await openKept(lap.page, 'Scans');
  await goToStudent(lap.page, 0);
  const f = await lap.page.evaluate(() => { const f = window.__gs.state().batch.students[0].files[0]; return { rot: f.rot || {}, pts: f.marks[0][0].pts }; });
  assert.deepEqual(f.rot, {}, 'the page stays as scanned');
  assert.deepEqual(f.pts, was, 'and the marks are where she put them');
  assert.deepEqual(await lap.page.evaluate(() => window.__gs.state().batch.students[2].files[0].rot || {}), {}, 'a Put back with no marks travels too');
  assert.deepEqual(lap.page.errors, []);
  await lap.close(); await home.close();
});

test('a turn by hand and a straightening put back at home aren’t overwritten by what the laptop’s app did', async () => {
  const lap = await openApp(browser);
  await lap.page.evaluate(PAGE_SRC);
  const up = Buffer.from(await lap.page.evaluate(sp => window.gsScan.pdf(sp), [{ o: 180, skew: 0, box: true }]), 'base64');
  const crooked = Buffer.from(await lap.page.evaluate(sp => window.gsScan.pdf(sp), [{ o: 0, skew: 2.5, box: true }]), 'base64');
  await openZip(lap.page, zipOf({ 'Aria Testwell/Scan.pdf': up, 'Bram Sample/Scan.pdf': crooked, 'Cleo Fixture/Scan.pdf': up }), 'Hands.zip');
  const f = (page, i) => page.evaluate(i => { const x = window.__gs.state().batch.students[i].files[0]; return { rot: x.rot || {}, skew: x.skew || {} }; }, i);
  await lap.page.waitForFunction(() => (window.__gs.state().batch.students[0].files[0].rot || {})[0] === 180);
  await goToStudent(lap.page, 1);
  await lap.page.waitForFunction(() => (window.__gs.state().batch.students[1].files[0].skew || {})[0]);
  await goToStudent(lap.page, 2);
  await lap.page.waitForFunction(() => (window.__gs.state().batch.students[2].files[0].rot || {})[0] === 180);
  await settle(lap.page); await closeUp(lap.page);
  const home = await openApp(browser);
  await openFile(home.page, await takeHome(lap.page));
  await bringIt(home.page);
  await openKept(home.page, 'Hands');
  await goToStudent(home.page, 0);
  await home.page.evaluate(() => window.__gs.scanTurn(window.__gs.state().pages[0], 90));   // on its side now: her own turn
  await goToStudent(home.page, 1);
  await home.page.evaluate(() => window.__gs.state().pages[0].rchip.querySelector('[data-scun]').click());
  await home.page.waitForFunction(() => !(window.__gs.state().batch.students[1].files[0].skew || {})[0]);
  await goToStudent(home.page, 2);
  await home.page.evaluate(() => window.__gs.scanTurn(window.__gs.state().pages[0], 180));   // all the way back by hand, with no marks to show for it
  await settle(home.page); await closeUp(home.page);
  await openFile(lap.page, await takeHome(home.page));
  await bringIt(lap.page);
  await openKept(lap.page, 'Hands');
  assert.equal((await f(lap.page, 0)).rot[0], 270, 'her turn');
  assert.deepEqual((await f(lap.page, 1)).skew, {}, 'put back');
  assert.deepEqual((await f(lap.page, 2)).rot, {}, 'turned back by hand');
  assert.deepEqual(lap.page.errors, []);
  await lap.close(); await home.close();
});

// An assignment card, on both computers, opened and scored on the first.
const CARD = () => ({ id: 'asg1', name: 'River card', classId: 'c1', setup: { mode: 'rubric', criteria: ['Thesis', 'Evidence', 'Style'] } });
const cardLib = () => JSON.stringify({ classes: [{ id: 'c1', name: '9A', names: [], units: [{ id: 'u1', name: 'Rivers', items: [CARD()] }] }], loose: { id: '', units: [] }, units: [] });
const openCard = async page => {
  await page.evaluate(() => { const l = window.__gs.state().lib, it = [...l.classes, l.loose].flatMap(c => c.units).flatMap(u => u.items).find(i => i.id === 'asg1'); return window.__gs.reopenKept(it.batchId, it); });
  await waitPaper(page);
};
async function cardOnBoth() {
  const lap = await openApp(browser, { seed: { ls: { 'gs.lib': cardLib() } } });
  const files = Object.entries(cardFiles).map(([path, u]) => ({ path, data: [...u] }));
  await lap.page.evaluate(list => { const l = window.__gs.state().lib, it = [...l.classes, l.loose].flatMap(c => c.units).flatMap(u => u.items).find(i => i.id === 'asg1'); return window.__gs.intake(list.map(e => ({ path: e.path, data: new Uint8Array(e.data) })), 'River', it); }, files);
  await waitPaper(lap.page);
  await score(lap.page, [3, 3, 3]);
  await settle(lap.page); await closeUp(lap.page);
  const home = await openApp(browser);
  await openFile(home.page, await takeHome(lap.page));
  await bringIt(home.page);
  return { lap, home };
}

test('just opening an assignment card on the other computer doesn’t undo a real change to it', async () => {
  const { lap, home } = await cardOnBoth();
  await openCard(lap.page);
  await addRow(lap.page);
  await goToStudent(lap.page, 0); await score(lap.page, [null, null, null, 4]);
  await settle(lap.page); await closeUp(lap.page);
  await new Promise(r => setTimeout(r, 50));
  await openCard(home.page);   // later, and all she does with the card is open it
  await goToStudent(home.page, 1); await home.page.type('#cmtIn', 'Good start'); await home.page.keyboard.press('Tab');
  await settle(home.page); await closeUp(home.page);
  await openFile(lap.page, await takeHome(home.page));
  await bringIt(lap.page);
  await openCard(lap.page);
  assert.equal(await rows(lap.page), 4, 'the card keeps its 4th row');
  assert.equal((await gradeOf(lap.page, 'Nia Turnwell')).total, 13);
  assert.equal((await gradeOf(lap.page, 'Oren Turnwell')).comment, 'Good start');
  assert.deepEqual(lap.page.errors, []);
  await lap.close(); await home.close();
});

// Both computers change the card's rubric: a row here, and a name at home.
async function cardRubricBoth() {
  const { lap, home } = await cardOnBoth();
  await openCard(lap.page);
  await addRow(lap.page);
  await goToStudent(lap.page, 0); await score(lap.page, [null, null, null, 4]);
  await settle(lap.page); await closeUp(lap.page);
  await new Promise(r => setTimeout(r, 50));
  await openCard(home.page);
  await home.page.evaluate(() => window.__gs.openSetup()); await home.page.waitForSelector('#setupBody');
  await home.page.$eval('#setupBody input', e => { e.value = 'Thesis statement'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  await home.page.click('#dlgBox [data-save]'); await home.page.waitForFunction(() => document.querySelector('#dlg').hidden);
  await goToStudent(home.page, 1); await home.page.type('#cmtIn', 'Home note'); await home.page.keyboard.press('Tab');
  await settle(home.page); await closeUp(home.page);
  await openFile(lap.page, await takeHome(home.page));
  return { lap, home };
}

for (const [side, nRows, total] of [['a', 4, 13], ['b', 3, 9]]) test('an assignment card’s rubric changed in both places: she’s asked, and the card, its download and the grade follow her answer: ' + side, async () => {
  const { lap, home } = await cardRubricBoth();
  const text = await lap.page.$eval('#bringBox', e => e.innerText);
  assert.equal((await lap.page.$$('.cfrow')).length, 1, 'one question');
  assert.match(text, /Rubric setup/); assert.match(text, /River card/); assert.match(text, /4 rows/); assert.match(text, /Thesis statement/);
  assert.doesNotMatch(text, /later one is kept/, 'nothing is chosen for her');
  assert.doesNotMatch(text, /Comes in from this file: [^\n]*Rubric setup/);
  assert.equal(await lap.page.$('#bringGo') != null, true);
  await lap.page.click('#bringGo');
  await lap.page.waitForFunction(() => document.querySelector('#bringBox'));
  assert.equal(await lap.page.evaluate(() => !!document.querySelector('#bringBox') && !document.querySelector('#takeMsg')), true, 'it waits for her answer');
  await lap.page.click('#bringBox input[value="' + side + '"]');
  await bringIt(lap.page);
  await openCard(lap.page);
  assert.equal(await rows(lap.page), nRows);
  assert.equal((await gradeOf(lap.page, 'Nia Turnwell')).total, total);
  assert.equal((await gradeOf(lap.page, 'Oren Turnwell')).comment, 'Home note');
  assert.equal(await lap.page.evaluate(() => window.__gs.state().setup.criteria[0]), side === 'a' ? 'Thesis' : 'Thesis statement');
  assert.deepEqual(lap.page.errors, []);
  // It's settled: the other computer gets the same rubric, and neither is asked again.
  await settle(lap.page); await closeUp(lap.page);
  await openFile(home.page, await takeHome(lap.page));
  assert.equal((await home.page.$$('.cfrow')).length, 0);
  await bringIt(home.page);
  await openCard(home.page);
  assert.equal(await rows(home.page), nRows);
  assert.equal((await gradeOf(home.page, 'Nia Turnwell')).total, total);
  assert.deepEqual(home.page.errors, []);
  await lap.close(); await home.close();
});

const isCard = page => page.evaluate(() => { const b = window.__gs.state().batch; return { name: b.name, card: b.assignment && b.assignment.id }; });

test('a card’s download dropped in again opens on its card, so a new rubric row stays whichever way she comes back', async () => {
  const { lap, home } = await cardOnBoth();
  await home.close();
  await openZip(lap.page, zip, 'River.zip');
  assert.deepEqual(await isCard(lap.page), { name: 'River card', card: 'asg1' });
  await addRow(lap.page);
  await score(lap.page, [null, null, null, 4]);
  await settle(lap.page); await closeUp(lap.page);
  await openKept(lap.page, 'River card');   // Continue, on the start screen
  assert.equal(await rows(lap.page), 4);
  assert.equal((await gradeOf(lap.page, 'Nia Turnwell')).total, 13);
  await settle(lap.page); await closeUp(lap.page);
  await openZip(lap.page, zip, 'River.zip');
  assert.equal(await rows(lap.page), 4);
  assert.equal((await gradeOf(lap.page, 'Nia Turnwell')).total, 13);
  await settle(lap.page); await closeUp(lap.page);
  // With the card deleted, the download goes on with the rubric saved with it.
  await lap.page.evaluate(() => { window.__gs.state().lib.classes[0].units[0].items.length = 0; });
  await openZip(lap.page, zip, 'River.zip');
  assert.equal((await isCard(lap.page)).card, null);
  assert.equal(await rows(lap.page), 4);
  assert.deepEqual(lap.page.errors, []);
  await lap.close();
});

test('a download whose row never reached its card, from before this was fixed: the score stays, and comes back with the row', async () => {
  const { lap, home } = await cardOnBoth();
  await home.close();
  await openCard(lap.page);
  await addRow(lap.page);
  await score(lap.page, [null, null, null, 4]);
  await settle(lap.page); await closeUp(lap.page);
  await lap.page.evaluate(() => { const l = window.__gs.state().lib; l.classes[0].units[0].items[0].setup.criteria.pop(); });   // the row is saved with the download, not on the card
  const clean = await pickFile(lap.page, '#fileIn', zip, 'River.zip');
  await lap.page.waitForSelector('#cfBox');   // the card would change her total, so that's her choice now
  await lap.page.click('#cfBox input[value="a"]'); await lap.page.click('[data-cfok]');
  await waitPaper(lap.page); clean();
  assert.equal(await rows(lap.page), 3);
  assert.deepEqual((await gradeOf(lap.page, 'Nia Turnwell')).rubric, [3, 3, 3, 4]);
  await addRow(lap.page);
  assert.equal((await gradeOf(lap.page, 'Nia Turnwell')).total, 13);
  assert.deepEqual(lap.page.errors, []);
  await lap.close();
});

test('the ZIP dropped in again on both computers and the rubric changed on both: she’s asked', async () => {
  const { lap, home } = await cardOnBoth();
  await openZip(lap.page, zip, 'River.zip');
  await addRow(lap.page);
  await settle(lap.page); await closeUp(lap.page);
  await new Promise(r => setTimeout(r, 50));
  await openZip(home.page, zip, 'River.zip');
  await home.page.evaluate(() => window.__gs.openSetup()); await home.page.waitForSelector('#setupBody');
  await home.page.$eval('#setupBody input', e => { e.value = 'Thesis statement'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  await home.page.click('#dlgBox [data-save]'); await home.page.waitForFunction(() => document.querySelector('#dlg').hidden);
  await settle(home.page); await closeUp(home.page);
  await openFile(lap.page, await takeHome(home.page));
  assert.equal((await lap.page.$$('.cfrow')).length, 1);
  assert.doesNotMatch(await lap.page.$eval('#bringBox', e => e.innerText), /later one is kept/);
  await lap.page.click('#bringBox input[value="a"]');
  await bringIt(lap.page);
  await openZip(lap.page, zip, 'River.zip');
  assert.deepEqual(await isCard(lap.page), { name: 'River card', card: 'asg1' });
  assert.equal(await rows(lap.page), 4);
  assert.deepEqual(lap.page.errors.concat(home.page.errors), []);
  await lap.close(); await home.close();
});

test('a ZIP first dropped in on one computer finds its card once the card comes from the other', async () => {
  const home = await openApp(browser);
  await openZip(home.page, zip, 'River.zip');
  assert.equal((await isCard(home.page)).card, null, 'no card here yet');
  await settle(home.page); await closeUp(home.page);
  const lap = await openApp(browser, { seed: { ls: { 'gs.lib': cardLib() } } });
  const files = Object.entries(cardFiles).map(([path, u]) => ({ path, data: [...u] }));
  await lap.page.evaluate(list => { const l = window.__gs.state().lib, it = [...l.classes, l.loose].flatMap(c => c.units).flatMap(u => u.items).find(i => i.id === 'asg1'); return window.__gs.intake(list.map(e => ({ path: e.path, data: new Uint8Array(e.data) })), 'River', it); }, files);
  await waitPaper(lap.page);
  await addRow(lap.page);
  await settle(lap.page); await closeUp(lap.page);
  await openFile(home.page, await takeHome(lap.page));
  await bringIt(home.page);
  await openZip(home.page, zip, 'River.zip');
  assert.deepEqual(await isCard(home.page), { name: 'River card', card: 'asg1' });
  assert.equal(await rows(home.page), 4);
  assert.deepEqual(home.page.errors, []);
  await lap.close(); await home.close();
});

test('a linked folder: a card’s rubric changed in both places waits for her, stays as the folder has it, and her choice reaches both', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': cardLib() } } });
  const files = Object.entries(cardFiles).map(([path, u]) => ({ path, data: [...u] }));
  await page.evaluate(list => { const l = window.__gs.state().lib, it = [...l.classes, l.loose].flatMap(c => c.units).flatMap(u => u.items).find(i => i.id === 'asg1'); return window.__gs.intake(list.map(e => ({ path: e.path, data: new Uint8Array(e.data) })), 'River', it); }, files);
  await waitPaper(page);
  await linkFolder(page, 'SeamsCard');
  await score(page, [3, 3, 3]); await settle(page); await folderWait(page);
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  const itemIn = l => l.classes[0].units[0].items.find(i => i.id === 'asg1');
  const FIVE = ['One', 'Two', 'Three', 'Four', 'Five'];
  // This computer adds a row, and another on the same folder has made it five rows of its own.
  const lib0 = await folderRead(page, 'library.json'), l0 = JSON.parse(lib0.ls['gs.lib']), it0 = itemIn(l0), there = await folderRead(page, 'downloads', id, 'work.json');
  await addRow(page);
  await settle(page); await folderWait(page);
  const when = Date.now();
  it0.setup = { ...it0.setup, criteria: FIVE };
  it0.fv = { ...it0.fv, setup: { ...(it0.fv || {}).setup, other: when } }; it0.v = { ...it0.v, other: when }; it0.at = when;
  await folderWrite(page, ['library.json'], { ...lib0, ls: { ...lib0.ls, 'gs.lib': JSON.stringify(l0) } });
  there.setup = { ...there.setup, criteria: FIVE };
  there.pv = { ...there.pv, setup: { ...(there.pv || {}).setup, other: when } };
  await folderWrite(page, ['downloads', id, 'work.json'], there);
  await page.evaluate(() => window.__gs.folderReconcile());
  await page.waitForSelector('#cfBox', { timeout: 30000 });
  const text = await page.$eval('#cfBox', e => e.innerText);
  assert.match(text, /Rubric setup/); assert.match(text, /River card/); assert.match(text, /4 rows/); assert.match(text, /5 rows/);
  assert.equal((await page.$$('#cfBox .cfrow')).length, 1, 'one question, about the card');
  await page.click('[data-cflater]');
  await folderWait(page);
  const held = async () => itemIn(JSON.parse((await folderRead(page, 'library.json')).ls['gs.lib']));
  assert.deepEqual((await held()).setup.criteria, FIVE, 'the folder keeps its own until she decides');
  assert.deepEqual((await folderRead(page, 'downloads', id, 'work.json')).setup.criteria, FIVE, 'and so does its download');
  assert.equal(await page.evaluate(() => window.__gs.state().setup.criteria.length), 4, 'and so does this browser');
  // More work here doesn't settle it for her, even another change to the same rubric.
  await addRow(page);
  await goToStudent(page, 1); await score(page, [2, 2, 2]); await settle(page); await folderWait(page);
  assert.deepEqual((await held()).setup.criteria, FIVE);
  await page.evaluate(() => window.__gs.folderReconcile()); await folderWait(page);
  assert.deepEqual((await held()).setup.criteria, FIVE);
  assert.equal(await page.evaluate(() => window.__gs.folderState().asks.length), 1, 'still a question');
  if (await page.$('#cfBox')) await page.click('[data-cflater]');
  await page.click('#saveWhere');
  await page.waitForSelector('#cfBox');
  await page.click('#cfBox input[value="b"]');
  await page.click('[data-cfok]');
  await page.waitForFunction(() => window.__gs.state().setup.criteria[0] === 'One', { timeout: 30000 });
  await folderWait(page);
  assert.deepEqual((await held()).setup.criteria, FIVE);
  assert.deepEqual((await folderRead(page, 'downloads', id, 'work.json')).setup.criteria, FIVE);
  assert.equal(await page.evaluate(() => window.__gs.folderState().asks.length), 0, 'nothing left to decide');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Claude codes made on both computers: a reply matches with either one, and the preview is true', async () => {
  const { lap, home } = await twoComputers();
  const codes = page => page.evaluate(() => window.__gs.state().batch.share.codes);
  await lap.page.evaluate(() => window.__gs.openShare()); await new Promise(r => setTimeout(r, 200)); await closeBox(lap.page);
  const L = await codes(lap.page);
  await new Promise(r => setTimeout(r, 50));
  await home.page.evaluate(() => window.__gs.openShare()); await new Promise(r => setTimeout(r, 200)); await closeBox(home.page);
  const H = await codes(home.page);
  assert.notDeepEqual(L, H);
  await homeToLaptop(lap, home);
  assert.match(await lap.page.$eval('#bringBox', e => e.innerText), /both are kept: [^\n]*Claude codes/);
  await bringIt(lap.page);
  await openKept(lap.page, 'Tide essay');
  const reply = async (text, match) => {
    await lap.page.evaluate(() => window.__gs.openBringBack()); await lap.page.waitForSelector('#bbText');
    await lap.page.$eval('#bbText', (e, t) => { e.value = t; e.dispatchEvent(new Event('input', { bubbles: true })); }, text);
    await lap.page.click('#dlgBox [data-read]');
    await lap.page.waitForFunction(() => document.querySelector('#bbOut').innerText.length > 0);
    const out = await lap.page.$eval('#bbOut', e => e.innerText), off = await lap.page.$eval('#dlgBox [data-apply]', e => e.disabled);
    assert.match(out, match);
    return { out, off };
  };
  // The ZIP Claude got could have been made on either computer.
  const fromLap = await reply(L['Nia Turnwell'] + '\nGood work, from the laptop ZIP.\n\n' + L['Oren Turnwell'] + '\nA fair start.', /2 of 3/);
  assert.equal(fromLap.off, false); assert.match(fromLap.out, /Nia Turnwell/); assert.doesNotMatch(fromLap.out, /belong/);
  await lap.page.click('#dlgBox [data-apply]');
  await lap.page.waitForFunction(() => document.querySelector('#dlg').hidden);
  assert.equal((await gradeOf(lap.page, 'Nia Turnwell')).comment, 'Good work, from the laptop ZIP.');
  assert.equal((await gradeOf(lap.page, 'Oren Turnwell')).comment, 'A fair start.');
  const fromHome = await reply(H['Pia Sample'] + '\nFrom the home ZIP.', /1 of 3/);
  assert.equal(fromHome.off, false); assert.match(fromHome.out, /Pia Sample/);
  await closeBox(lap.page);
  // Anything else still isn't a match.
  const none = await reply('S-ZZZZ\nWhose is this?', /doesn’t belong/);
  assert.equal(none.off, true);
  await closeBox(lap.page);
  assert.deepEqual(lap.page.errors, []);
  await lap.close(); await home.close();
});

test('opening old work and closing it stamps nothing, so nobody is asked about it later', async () => {
  const L = await loadLegacy();
  const { page, close } = await openApp(browser, { seed: L.seed() });
  await page.waitForFunction(() => window.__gs.kept().size === 2);
  await openKept(page, 'River essay');
  await page.evaluate(() => window.__gs.saveNow());
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await closeUp(page);
  const w = await page.evaluate(id => JSON.parse(localStorage.getItem(id)), id);
  assert.ok(w.s['Dov Madeup'].e, 'the Word edit is listed');
  assert.deepEqual(Object.values(w.s).filter(r => r.v), [], 'and no student counts as changed');
  assert.equal(w.pv, undefined, 'nor does any setting');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Put back and It’s fine hold on the same page in a newer copy of the download, with or without marks to bring over', async () => {
  const { page, close } = await openApp(browser);
  await page.evaluate(PAGE_SRC);
  const scan = Buffer.from(await page.evaluate(sp => window.gsScan.pdf(sp), [{ o: 180, skew: 0, box: true }]), 'base64');
  const other = await makePaper({ title: 'Typed essay' });
  const put = async () => {
    await page.waitForFunction(() => window.__gs.state().pages[0] && window.__gs.state().pages[0].snote);
    await page.evaluate(() => window.__gs.state().pages[0].snote.querySelector('[data-sc="back"]').click());
    await page.waitForFunction(() => !(window.__gs.state().batch.students[0].files[0].rot || {})[0]);
    await settle(page); await closeUp(page);
  };
  const rot = () => page.evaluate(() => window.__gs.state().batch.students[0].files[0].rot || {});
  await openZip(page, zipOf({ 'Aria Testwell/Scan.pdf': scan }), 'First.zip');
  await put();
  await openZip(page, zipOf({ 'Aria Testwell/Scan.pdf': scan, 'Bram Sample/Essay.pdf': other }), 'Second.zip');
  assert.deepEqual(await rot(), {}, 'no marks anywhere, and it stays as she left it');
  await closeUp(page);
  // With marks on another student, so the work comes over with the box saying so.
  await openZip(page, zipOf({ 'Cleo Fixture/Scan.pdf': scan, 'Dov Madeup/Essay.pdf': other }), 'Third.zip');
  await put();
  await openKept(page, 'Third');
  await goToStudent(page, 1); await score(page, [3, 3, 3]); await settle(page); await closeUp(page);
  const late = await makePaper({ title: 'Late essay' });
  const clean = zipOf({ 'Cleo Fixture/Scan.pdf': scan, 'Dov Madeup/Essay.pdf': other, 'Eve Newcomer/Essay.pdf': late });
  await openZip(page, clean, 'Fourth.zip');
  await page.waitForSelector('#carryBox', { timeout: 20000 });
  await closeBox(page, '#dlgBox .bf [data-close]');
  assert.deepEqual(await rot(), {}, 'and the same with marks to bring over');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a newer download says who’s marked missing or excused and now has a paper, and doesn’t offer to make an excused student late', async () => {
  const { page, close } = await openApp(browser);
  const q = await makePaper({ title: 'Quin essay' }), r = await makePaper({ title: 'Rae essay' }), n = await makePaper({ title: 'Nia essay' });
  await openZip(page, zipOf({ 'Nia Turnwell/Essay.pdf': n, 'Quin Sample/Notes.pdf': q, 'Rae Sample/Notes.pdf': r }), 'Mixed.zip');
  await score(page, [3, 3, 3]);
  await page.evaluate(() => { const b = window.__gs.state().batch; b.students[1].grade.status = 'missing'; b.students[2].grade.status = 'excused'; window.__gs.saveNow(); });
  await settle(page); await closeUp(page);
  const q2 = await makePaper({ title: 'Quin late essay' }), r2 = await makePaper({ title: 'Rae late essay' });
  await openZip(page, zipOf({ 'Nia Turnwell/Essay.pdf': n, 'Quin Sample/Notes.pdf': q, 'Quin Sample/Essay.pdf': q2, 'Rae Sample/Notes.pdf': r, 'Rae Sample/Essay.pdf': r2 }), 'Mixed (2).zip');
  await page.waitForSelector('#carryBox', { timeout: 20000 });
  const said = await page.$eval('#carryBox', e => e.textContent);
  assert.match(said, /Marked missing or excused/);
  assert.match(said, /Quin Sample \(marked missing\)/); assert.match(said, /Rae Sample \(marked excused\)/);
  assert.match(await page.$eval('[data-carrylate]', e => e.textContent), /Mark 1 student/, 'Quin, and not Rae');
  await page.click('[data-carrylate]');
  await page.waitForFunction(() => window.__gs.state().batch.students.find(s => s.key === 'Quin Sample').grade.status === 'late');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students.find(s => s.key === 'Rae Sample').grade.status), 'excused');
  await close();
});

test('a linked folder: a setting changed in both places waits for her, the folder keeps its own until then, and her choice reaches both', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'Tide essay.zip');
  await linkFolder(page, 'Seams');
  await score(page, [3, 3, 3]); await settle(page); await folderWait(page);
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  // Another computer on the same folder adds two rows, and this one adds one.
  const there = await folderRead(page, 'downloads', id, 'work.json');
  there.setup = { ...there.setup, criteria: ['One', 'Two', 'Three', 'Four', 'Five'] };
  there.pv = { ...there.pv, setup: { ...(there.pv || {}).setup, other: Date.now() } };
  await folderWrite(page, ['downloads', id, 'work.json'], there);
  await addRow(page);
  await page.waitForSelector('#cfBox', { timeout: 30000 });
  const text = await page.$eval('#cfBox', e => e.innerText);
  assert.match(text, /Rubric setup/); assert.match(text, /4 rows/); assert.match(text, /5 rows/);
  await page.click('[data-cflater]');
  assert.equal((await folderRead(page, 'downloads', id, 'work.json')).setup.criteria.length, 5, 'the folder keeps its own until she decides');
  await page.click('#saveWhere');
  await page.waitForSelector('#cfBox');
  await page.click('#cfBox input[value="b"]');
  await page.click('[data-cfok]');
  await page.waitForFunction(() => window.__gs.state().setup.criteria.length === 5, { timeout: 30000 });
  await folderWait(page);
  assert.equal((await folderRead(page, 'downloads', id, 'work.json')).setup.criteria.length, 5);
  assert.equal(await page.evaluate(() => window.__gs.folderState().asks.length), 0, 'nothing left to decide');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a linked folder: a newer setting there comes straight in, with the download open', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'Tide essay.zip');
  await linkFolder(page, 'Seams2');
  await score(page, [3, 3, 3]); await settle(page); await folderWait(page);
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  const there = await folderRead(page, 'downloads', id, 'work.json');
  there.setup = { ...there.setup, criteria: ['One', 'Two', 'Three', 'Four'] };
  there.pv = { ...there.pv, setup: { ...(there.pv || {}).setup, other: Date.now() } };
  await folderWrite(page, ['downloads', id, 'work.json'], there);
  await page.evaluate(() => window.__gs.folderReconcile());
  await page.waitForFunction(() => window.__gs.state().setup.criteria.length === 4, { timeout: 30000 });
  assert.deepEqual(page.errors, []);
  await close();
});

test('a saved rubric deleted here doesn’t come back from an older take-home file', async () => {
  const rub = { id: 'r1', name: 'Old rubric', at: 1, criteria: ['One', 'Two'], levels: null, scale: null };
  const lap = await openApp(browser, { seed: { ls: { 'gs.rubrics': JSON.stringify([rub]) } } });
  await openZip(lap.page, zip, 'Tide essay.zip');
  await settle(lap.page).catch(() => {}); await closeUp(lap.page);
  const older = await takeHome(lap.page);
  await lap.page.evaluate(() => { localStorage.setItem('gs.rubricsGone', JSON.stringify({ r1: Date.now() })); localStorage.setItem('gs.rubrics', '[]'); });
  await lap.page.reload();
  await lap.page.waitForFunction(() => window.__gs && window.__gs.state);
  await openFile(lap.page, older);
  assert.deepEqual(await lap.page.evaluate(() => JSON.parse(localStorage.getItem('gs.rubrics'))), [], 'nothing has changed yet');
  assert.equal((await lap.page.$eval('#bringBox', e => e.innerText)).includes('Rubrics or settings'), false, 'and the preview doesn’t offer it');
  await lap.close();
});
