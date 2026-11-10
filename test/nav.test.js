// The frame around every screen: the sidebar, Home, a page per class, Settings, Find anything, and an address for each screen
// so Refresh, Back and Forward go where she expects. None of it stores anything new: the address is only in the address bar.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, appReady, openZip, waitPaper, goToStudent, goTo, openClass, setTool, drag, score, settle, workOf, idbRead } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const hash = page => page.evaluate(() => location.hash);
const showing = page => page.evaluate(() => ['vHome', 'vClass', 'vSettings', 'vOpening'].filter(id => document.querySelector('#' + id).checkVisibility()).concat(document.querySelector('#app').checkVisibility() ? ['app'] : []).join(','));
const until = (page, h) => page.waitForFunction(h => location.hash === h, {}, h);
// Two made-up classes, the first with one unit and two assignments.
const LIB = JSON.stringify({ seed2627: true, classes: [
  { id: 'c1', name: 'Test English', names: ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup', 'Esme Placeholder', 'Finn Example'], units: [{ id: 'u1', name: 'Unit 1: Narrative', items: [{ id: 'i1', name: 'Narrative essay', classId: 'c1' }, { id: 'i2', name: 'Reading check', classId: 'c1' }] }] },
  { id: 'c2', name: 'Test Literature', names: ['Gus Pretend'], units: [] },
] });
async function gradeABit(page) {
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);
  await score(page, [3.5, 3.5, 3.5]);
  await goToStudent(page, 1); await score(page, [2]);
  await settle(page);
}

test('the sidebar goes to Home, each class and Settings, and Back and Forward follow', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': LIB } } });
  assert.equal(await showing(page), 'vHome'); assert.equal(await hash(page), '');
  assert.deepEqual(await page.$$eval('#railClasses .rname', xs => xs.map(x => x.textContent)), ['Test English', 'Test Literature']);
  assert.equal(await page.$eval('#rail [data-nav="home"]', a => a.getAttribute('aria-current')), 'page');
  await openClass(page, 'Test English');
  assert.equal(await hash(page), '#/class/c1'); assert.equal(await showing(page), 'vClass');
  assert.equal(await page.$eval('#classes .clshead h1', e => e.textContent), 'Test English');
  assert.deepEqual(await page.$$eval('#classes .card .t', xs => xs.map(x => x.textContent.trim())), ['Narrative essay', 'Reading check']);
  assert.equal(await page.$$eval('#classes .cls', xs => xs.length), 1, 'only this class is on its page');
  assert.equal(await page.$eval('#railClasses [data-railcls="c1"]', a => a.getAttribute('aria-current')), 'page');
  assert.equal(await page.title(), 'Test English · Grading Studio');
  await openClass(page, 'Test Literature');
  assert.equal(await hash(page), '#/class/c2');
  assert.equal(await page.$eval('#classes .clshead h1', e => e.textContent), 'Test Literature');
  await page.click('#rail [data-nav="settings"]');
  assert.equal(await hash(page), '#/settings'); assert.equal(await showing(page), 'vSettings');
  for (const id of ['takeBtn', 'restoreBtn', 'removeBtn']) assert.ok(await page.$eval('#' + id, e => e.checkVisibility()), id + ' is in Settings');
  await page.goBack(); await until(page, '#/class/c2'); assert.equal(await showing(page), 'vClass');
  await page.goBack(); await until(page, '#/class/c1'); assert.equal(await page.$eval('#classes .clshead h1', e => e.textContent), 'Test English');
  await page.goForward(); await until(page, '#/class/c2');
  await page.click('#rail [data-nav="home"]');
  assert.equal(await hash(page), '#/'); assert.equal(await showing(page), 'vHome');
  // an address that no longer leads anywhere lands on Home
  await goTo(page, '#/class/gone'); assert.equal(await showing(page), 'vHome');
  await goTo(page, '#/nowhere'); assert.equal(await showing(page), 'vHome');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a refresh comes back to the same paper, and Back closes it with the work kept', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': LIB } } });
  await openClass(page, 'Test English');
  await openZip(page, zip, 'Narrative essay.zip');
  const at = await hash(page);
  assert.match(at, /^#\/a\/[a-z0-9]+$/); assert.equal(await showing(page), 'app');
  assert.equal(await page.title(), 'Grading Studio', 'a download’s own name stays out of the tab’s name, and so out of the browser’s history');
  assert.ok(await page.$eval('#shell', e => e.classList.contains('grading')), 'the sidebar folds while a paper is open');
  await gradeABit(page);
  const before_ = await workOf(page);
  await page.reloadHere(); await appReady(page);
  await waitPaper(page);                                   // no click: the address reopened it
  assert.equal(await hash(page), at);
  assert.equal(await page.evaluate(() => window.__gs.state().cur), 1, 'on the student she was on');
  assert.deepEqual(await workOf(page), before_);
  // Back: the paper closes, the work is on Home, nothing is lost
  await page.goBack(); await until(page, '#/class/c1');
  await page.waitForFunction(() => !window.__gs.state().batch);
  assert.equal(await showing(page), 'vClass');
  await page.goForward(); await until(page, at); await waitPaper(page);
  assert.deepEqual(await workOf(page), before_);
  // the X goes Home, and Continue there opens it again
  await page.click('#closeBtn'); await until(page, '#/');
  assert.equal(await showing(page), 'vHome');
  await page.waitForSelector('#kept [data-kopen]');
  await page.click('#kept [data-kopen]'); await waitPaper(page);
  assert.equal(await hash(page), at);
  assert.deepEqual(await workOf(page), before_);
  assert.deepEqual(page.errors, []);
  await close();
});

test('going around the new screens changes nothing that is saved', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': LIB } } });
  await openZip(page, zip, 'Narrative essay.zip');
  await gradeABit(page);
  await page.click('#closeBtn'); await until(page, '#/');
  await page.waitForSelector('#kept [data-kopen]');
  const snap = async () => ({
    ls: await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('gs.')).sort().map(k => [k, localStorage.getItem(k)]))),
    work: await idbRead(page, 'grading-studio-keep', 'work'), papers: await idbRead(page, 'grading-studio-keep', 'papers'), meta: await idbRead(page, 'grading-studio-keep', 'meta'),
  });
  const a = await snap();
  assert.ok(a.work.k.length === 1 && a.papers.k.length === 1, 'the download is kept');
  await openClass(page, 'Test English'); await openClass(page, 'Test Literature');
  await page.click('#rail [data-nav="settings"]'); await page.click('#rail [data-nav="home"]');
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForSelector('#findDlg'); await page.keyboard.type('test'); await page.keyboard.press('Escape');
  await page.goBack(); await page.goForward();
  await page.reload(); await appReady(page); await page.waitForSelector('#kept [data-kopen]');
  assert.deepEqual(await snap(), a);
  assert.deepEqual(page.errors, []);
  await close();
});

test('an address for papers this browser no longer has lands on Home and says so', async () => {
  const { page, close } = await openApp(browser);
  await goTo(page, '#/a/nothinghere');
  await page.waitForFunction(() => location.hash === '#/' && document.querySelector('#vHome').checkVisibility());
  assert.equal(await page.evaluate(() => !!window.__gs.state().batch), false);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Find anything reaches classes and assignments from Home, and students while grading', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': LIB } } });
  const find = async text => { await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control'); await page.waitForSelector('#findIn'); await page.keyboard.type(text); };
  const rows = () => page.$$eval('#findList .frow', xs => xs.map(x => x.textContent));
  await find('literature');
  assert.ok((await rows()).some(t => /Test Literature/.test(t)));
  await page.keyboard.press('Enter');
  await until(page, '#/class/c2'); assert.equal(await page.$('#findDlg'), null);
  // the button in the sidebar opens it too, and Esc closes it without going anywhere
  await page.click('#findBtn'); await page.waitForSelector('#findIn'); await page.keyboard.type('reading');
  assert.ok((await rows()).some(t => /Reading check/.test(t)));
  await page.keyboard.press('Escape'); assert.equal(await page.$('#findDlg'), null); assert.equal(await hash(page), '#/class/c2');
  await find('zzzz no such thing'); assert.deepEqual(await rows(), []); await page.keyboard.press('Escape');
  // while grading: a student by name
  await goTo(page, '#/'); await openZip(page, zip, 'Narrative essay.zip');
  await find('cleo'); assert.ok((await rows())[0].includes('Cleo Fixture'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__gs.state().cur === 2);
  // a tool
  await find('highlight'); await page.keyboard.press('Enter');
  assert.ok(await page.$eval('#tools .tool[data-tool="hl"]', b => b.getAttribute('aria-pressed') === 'true'));
  assert.deepEqual(page.errors, []);
  await close();
});

test('Home lists a partly scored paper under Needs a look, and opens it from there', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': LIB } } });
  assert.ok(await page.$eval('#needs', e => e.hidden), 'nothing to look at on a fresh start');
  await openZip(page, zip, 'Narrative essay.zip');
  await gradeABit(page);                                  // the second student has one row of three
  await page.click('#closeBtn'); await until(page, '#/');
  await page.waitForSelector('#needs [data-nopen]');
  assert.match(await page.$eval('#needs [data-nopen]', e => e.textContent), /1 paper is partly scored/);
  assert.equal(await page.$eval('#kept .schip', e => e.textContent), 'Scoring');
  await page.click('#needs [data-nopen]'); await waitPaper(page);
  assert.match(await hash(page), /^#\/a\//);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the sidebar says where the work is saved, and folds to icons on a narrow window', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': LIB } } });
  assert.match(await page.$eval('#railSaved', e => e.textContent), /^Not backed upOnly in this browser/, 'no folder yet, so it does not say Saved');
  await page.setViewport({ width: 1000, height: 800 });
  assert.ok(await page.$eval('#rail', e => e.getBoundingClientRect().width < 80));
  assert.ok(await page.$eval('#railClasses [data-railcls="c1"]', a => a.title.includes('Test English')), 'a folded link still says its class');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scrolling');
  await page.setViewport({ width: 1440, height: 900 });
  assert.ok(await page.$eval('#rail', e => e.getBoundingClientRect().width > 200));
  assert.deepEqual(page.errors, []);
  await close();
});
