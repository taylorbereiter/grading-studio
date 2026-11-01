// Rubric library and class overview, in the real built app. Every name here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { strFromU8, unzipSync } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, answerDlg, appReady, openZip, pickFile, goToStudent, score, settle, waitPaper, catchDownloads } = require('./helpers/app');
const { makePaper, zipOf, standardFiles } = require('./helpers/fixtures');
const { loadLegacy } = require('./helpers/legacy');
const { contrastFails } = require('./helpers/contrast');
const { takeHome, openFile, bringIt } = require('./helpers/carry');

let browser, zip, classZip, otherZip;
const NAMES = ['Ada Zero', 'Ben Missing', 'Cam Excused', 'Dee Partial', 'Eli Late', 'Fay Blank', 'Gil Full', 'Hal Paper'];
before(async () => {
  browser = await launch();
  zip = zipOf(await standardFiles());
  const files = {};
  for (const n of NAMES) files[n + '/Essay.pdf'] = await makePaper({ title: n + ' essay' });
  classZip = zipOf(files);
  otherZip = zipOf({ 'Zed Other/Quiz.pdf': await makePaper({ title: 'Zed Other quiz' }) });
});
after(async () => { await browser.close(); });

const LV = { 4: 'Clear thesis, argued all the way through', 3: 'Clear thesis, mostly argued', 2: 'A thesis that wanders', 1: 'Hard to find a thesis', 0: 'No thesis' };
const lvSel = (r, v) => '[data-lvi="' + r + '"][data-lvv="' + v + '"]';
const openSetup = async page => { await page.evaluate(() => window.__gs.openSetup()); await page.waitForSelector('#setupBody'); };
const openDetails = (page, r) => page.$eval('[data-lvrow="' + r + '"]', d => { d.open = true; });
async function typeLevels(page, r, lv) {
  await openDetails(page, r);
  for (const [v, t] of Object.entries(lv)) { await page.click(lvSel(r, v)); await page.keyboard.type(t); }
}
const saveSetup = async page => { await page.click('#dlgBox [data-save]'); await page.waitForFunction(() => document.querySelector('#dlg').hidden); };
const lvText = (page, r) => page.$eval('[data-lvline="' + r + '"] .lvtxt', e => e.textContent);
const hover = async (page, r, v) => { await page.hover('.scores[data-c="' + r + '"] button[data-v="' + v + '"]'); };
const setupOf = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().setup)));

/* ---------------- old setups ---------------- */
test('an old setup looks as it did, and old work opens with the new parts empty', async () => {
  const L = await loadLegacy();
  const { page, close } = await openApp(browser, { seed: L.seed() });
  await page.waitForFunction(() => document.querySelectorAll('#kept .krow').length > 0);
  await page.evaluate(() => document.querySelector('#kept .krow [data-kopen]').click());
  await waitPaper(page);
  assert.equal(await page.$$eval('.lvrow', e => e.length), 0, 'no description lines');
  assert.equal(await page.evaluate(() => window.__gs.state().setup.levels), undefined);
  assert.deepEqual(await page.evaluate(() => window.__gs.savedRubrics()), []);
  await openSetup(page);
  assert.ok(await page.$('#setupBody'));
  await page.click('#dlgBox [data-cancel]');
  await page.evaluate(() => window.__gs.openOverview());
  assert.match(await page.$eval('#ovLeft', e => e.textContent), /^Counted: \d+ of \d+ students?\./);
  assert.deepEqual(page.errors, []);
  await close();
});

test('saving a setup with nothing written adds nothing', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await openSetup(page);
  await saveSetup(page);
  assert.equal(await page.evaluate(() => 'levels' in JSON.parse(localStorage.getItem('gs.setup'))), false);
  await close();
});

/* ---------------- what each score means ---------------- */
test('descriptions show while grading: pointing, picking, half points, and the whole row', async () => {
  const { page, close } = await openApp(browser);
  await page.setViewport({ width: 1280, height: 800 });
  await openZip(page, zip);
  const height0 = await page.$eval('.crit', e => e.getBoundingClientRect().height);
  await openSetup(page);
  await typeLevels(page, 0, LV);
  await page.click('#dlgBox [data-add]');   // re-draws the setup, which keeps what was typed and keeps it open
  assert.equal(await page.$eval(lvSel(0, 4), e => e.value), LV[4]);
  assert.equal(await page.$eval('[data-lvrow="0"]', e => e.open), true);
  await page.click('#dlgBox [data-rm="3"]');
  await saveSetup(page);
  assert.deepEqual((await setupOf(page)).levels[0], LV);

  assert.equal(await page.$$eval('.lvrow', e => e.length), 1, 'only the row with descriptions has a line');
  assert.match(await lvText(page, 0), /Point at a score/);
  // two lines, no more, however long the words are
  const h = await page.$eval('[data-lvline="0"]', e => e.getBoundingClientRect().height);
  assert.ok(h < 40, 'stays small, got ' + h);
  const height1 = await page.$eval('.crit', e => e.getBoundingClientRect().height);
  assert.ok(height1 - height0 < 45, 'the row grows by two lines at most');

  await hover(page, 0, 2);
  assert.equal(await lvText(page, 0), '2 ' + LV[2]);
  const hHover = await page.$eval('.crit', e => e.getBoundingClientRect().height);
  assert.equal(hHover, height1, 'pointing doesn’t move anything');
  await page.click('.scores[data-c="0"] button[data-v="3"]');
  assert.equal(await lvText(page, 0), '3 ' + LV[3]);
  await page.mouse.move(5, 5);
  assert.equal(await lvText(page, 0), '3 ' + LV[3], 'goes back to the score she picked');
  await page.click('.scores[data-c="0"] button[data-v="3.5"]');
  assert.equal(await lvText(page, 0), '4 ' + LV[4] + ' 3 ' + LV[3], 'a half point shows both');
  await page.click('.scores[data-c="0"] button[data-v="0"]');
  assert.equal(await lvText(page, 0), '0 ' + LV[0], '0 has words too');

  await page.click('[data-lvopen="0"]');
  assert.deepEqual(await page.$$eval('.lvall li', e => e.map(x => x.querySelector('b').textContent)), ['4', '3', '2', '1', '0']);
  assert.equal(await page.$eval('.lvall li.on b', e => e.textContent), '0');
  await goToStudent(page, 1);
  assert.equal(await page.$$eval('.lvall li', e => e.length), 5, 'stays open for the next student');
  assert.equal(await page.$$eval('.lvall li.on', e => e.length), 0, 'nothing picked yet');
  await page.click('[data-lvopen="0"]');
  assert.equal(await page.$$eval('.lvall', e => e.length), 0);

  // a row that's in the setup after a reload
  await settle(page);
  await page.reload(); await appReady(page);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.setup')).levels[0]), LV);
  assert.deepEqual(page.errors, []);
  await close();
});

test('descriptions go with their row when a row is removed, and text isn’t run as code', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await openSetup(page);
  await typeLevels(page, 0, { 4: 'First row four' });
  await typeLevels(page, 2, { 4: '<img src=x onerror=window.__bad=1> & third' });
  await page.click('#dlgBox [data-rm="1"]');
  assert.match(await page.$eval('[data-lvrow="1"] summary', e => e.textContent), /1 of 5 written/);
  await saveSetup(page);
  const s = await setupOf(page);
  assert.equal(s.criteria.length, 2);
  assert.equal(s.levels.length, 2);
  assert.equal(s.levels[0][4], 'First row four');
  assert.match(s.levels[1][4], /third$/);
  await hover(page, 1, 4);
  assert.match(await lvText(page, 1), /<img src=x/, 'shown as plain words');
  assert.equal(await page.evaluate(() => window.__bad), undefined);
  assert.equal(await page.$$eval('.lvtxt img', e => e.length), 0);
  await close();
});

test('Cancel in Rubric setup keeps what was there', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await openSetup(page);
  await typeLevels(page, 0, { 4: 'Never saved' });
  await page.click('#dlgBox [data-cancel]');
  assert.equal((await setupOf(page)).levels, undefined);
  assert.equal(await page.$$eval('.lvrow', e => e.length), 0);
  await close();
});

/* ---------------- saved rubrics ---------------- */
async function saveRubricAs(page, name, opts) {
  await page.click('#dlgBox [data-rbsave]');
  await answerDlg(page, { typed: name });
  if (opts && opts.replace != null) await answerDlg(page, { yes: opts.replace });
  await page.waitForFunction(() => !document.querySelector('#askDlg'));
}

const setupClosed = page => page.waitForFunction(() => document.querySelector('#dlg').hidden);
const clickOutside = page => page.mouse.click(30, 400);
const asked = page => page.waitForSelector('#askDlg [data-ok]');
test('Esc or a click outside Rubric setup asks before throwing away what was written', async () => {
  const { page, close } = await openApp(browser);
  await page.setViewport({ width: 1280, height: 800 });
  await openZip(page, zip);
  await openSetup(page);
  await typeLevels(page, 0, { 4: 'Worth keeping' });

  await page.keyboard.press('Escape');
  await asked(page);
  assert.match(await page.$eval('#askText', e => e.textContent), /won’t be kept/);
  await page.keyboard.press('Escape');   // a second Esc means keep going, not leave
  await page.waitForFunction(() => !document.querySelector('#askDlg'));
  assert.equal(await page.$eval(lvSel(0, 4), e => e.value), 'Worth keeping');
  assert.equal(await page.$eval(lvSel(0, 4), e => e === document.activeElement), true, 'back to the box she was typing in');

  await clickOutside(page);
  await answerDlg(page, { yes: false });
  await page.waitForFunction(() => !document.querySelector('#askDlg'));
  assert.equal(await page.$eval(lvSel(0, 4), e => e.value), 'Worth keeping');

  await saveSetup(page);   // and it can still be saved
  assert.equal((await setupOf(page)).levels[0][4], 'Worth keeping');

  await openSetup(page);
  await page.click(lvSel(0, 3)); await page.keyboard.type('Never saved');
  await clickOutside(page);
  await answerDlg(page, { yes: true });
  await setupClosed(page);
  assert.equal((await setupOf(page)).levels[0][3], undefined, 'Leave leaves it behind');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Rubric setup closes without asking when nothing changed, and asks for any other change', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.rubrics': JSON.stringify([{ id: 'r1', name: 'Another', criteria: ['One', 'Two'], scale: null, at: 1 }]) } } });
  await page.setViewport({ width: 1280, height: 800 });
  await openZip(page, zip);
  const noAsk = async leave => { await leave(); await setupClosed(page); assert.equal(await page.$('#askDlg'), null); };
  await openSetup(page);
  await noAsk(() => page.keyboard.press('Escape'));
  await openSetup(page);
  await noAsk(() => clickOutside(page));

  // Written and rubbed out is no change, and neither is a rubric saved for later.
  await openSetup(page);
  await typeLevels(page, 0, { 4: 'x' });
  await page.keyboard.press('Backspace');
  await saveRubricAs(page, 'For later');
  await noAsk(() => page.keyboard.press('Escape'));

  const asks = async change => {
    await openSetup(page);
    await change();
    await page.keyboard.press('Escape');
    await asked(page);
    await answerDlg(page, { yes: true });
    await setupClosed(page);
  };
  await asks(() => page.$eval('[data-ci="0"]', e => { e.value = 'Thesis'; e.dispatchEvent(new Event('input', { bubbles: true })); }));
  await asks(() => page.click('#dlgBox [data-add]'));
  await asks(() => page.click('[data-m="points"]'));
  await asks(() => page.click('[data-preset="none"]'));
  await asks(() => page.click('[data-rbuse="r1"]'));
  let clean;
  await asks(async () => {   // bringing in a rubric file
    clean = await pickFile(page, '#rpIn', await makePaper({ title: 'My rubric' }), 'My rubric.pdf');
    await page.waitForSelector('[data-rprm]');
  });
  clean();
  assert.equal((await setupOf(page)).criteria[0], 'Criterion 1', 'none of it was kept');
  assert.equal((await setupOf(page)).mode, 'rubric');
  assert.deepEqual(page.errors, []);
  await close();
});
/* A saved setup must not stay tied to the dialog it was saved from. */
const setupState = page => page.evaluate(() => {
  const g = window.__gs, st = g.state().batch.students[g.state().cur];
  return { setup: JSON.parse(JSON.stringify(g.state().setup)), stored: JSON.parse(localStorage.getItem('gs.setup')), total: g.gradeOf(st).total, pct: g.gradeOf(st).pct, rows: document.querySelectorAll('#grade .scores').length, ptsIn: !!document.querySelector('#ptsIn') };
});
const typeIn = (page, sel, v) => page.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
const leaveWith = {
  esc: async page => { await page.keyboard.press('Escape'); await answerDlg(page, { yes: true }); },
  outside: async page => { await clickOutside(page); await answerDlg(page, { yes: true }); },
  cancel: page => page.click('#dlgBox [data-cancel]'),
};
async function savedAndScored(page) {
  await openZip(page, zip);
  await goToStudent(page, 0);
  await page.click('#editRubric'); await page.waitForSelector('#setupBody');
  await typeLevels(page, 0, { 4: 'Row one words' });
  await typeLevels(page, 1, { 4: 'Row two words' });
  await saveSetup(page);
  await score(page, [4, 4, 4]);
}
test('after an earlier Save, leaving Rubric setup keeps none of the changes, even after a reload', async () => {
  const { page, close } = await openApp(browser);
  await page.setViewport({ width: 1280, height: 800 });
  await savedAndScored(page);
  const was = await setupState(page);
  assert.deepEqual(was.setup.levels, [{ 4: 'Row one words' }, { 4: 'Row two words' }, {}]);
  assert.equal(was.rows, 3);
  const changes = {
    'remove a row': () => page.click('[data-rm="0"]'),
    'add a row': () => page.click('#dlgBox [data-add]'),
    'no scale': () => page.click('[data-preset="none"]'),
    'just the total': () => page.click('[data-m="points"]'),
    'rename a row': () => typeIn(page, '[data-ci="0"]', 'Renamed'),
    'change a scale step': () => typeIn(page, '[data-sk="12"]', '50'),
  };
  for (const [what, change] of Object.entries(changes)) for (const [how, leave] of Object.entries(leaveWith)) {
    await page.click('#editRubric'); await page.waitForSelector('#setupBody');
    await change();
    await leave(page);
    await setupClosed(page);
    await goToStudent(page, 1); await goToStudent(page, 0);
    assert.deepEqual(await setupState(page), was, what + ', then ' + how);
  }
  await settle(page);
  await page.reload(); await appReady(page);
  await page.waitForSelector('#kept [data-kopen]');
  await page.click('#kept [data-kopen]');
  await waitPaper(page);
  await goToStudent(page, 0);
  const back = await setupState(page);
  assert.deepEqual(back.setup.criteria, was.setup.criteria);
  assert.deepEqual(back.setup.levels, was.setup.levels);
  assert.deepEqual(back.setup.scale, was.setup.scale);
  assert.equal(back.setup.mode, 'rubric');
  assert.equal(back.pct, was.pct);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a second Save keeps only what that session changed, and a saved setup can still be changed', async () => {
  const { page, close } = await openApp(browser);
  await savedAndScored(page);
  await openSetup(page);
  await page.click('[data-preset="none"]');
  await page.click('#dlgBox [data-cancel]');
  await openSetup(page);
  await page.click('[data-rm="0"]');
  await page.click('#dlgBox [data-save]');
  await answerDlg(page);   // that row had a score on it, so Save asks first
  await setupClosed(page);
  const s = await setupOf(page);
  assert.deepEqual(s.criteria, ['Criterion 2', 'Criterion 3'], 'the row went');
  assert.deepEqual(s.levels, [{ 4: 'Row two words' }, {}], 'its words went with it');
  assert.notEqual(s.scale, null, 'the cancelled No scale stayed cancelled');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Arrange pages can’t touch the rubric, whether its last setup was saved or left', async () => {
  const { page, close } = await openApp(browser);
  await savedAndScored(page);
  const useArrange = async () => {
    await page.evaluate(() => window.__gs.openArrange());
    await page.waitForSelector('#arrBody [data-rm]');
    await page.click('#arrBody [data-rm]');   // its × shares a name with the row remove in Rubric setup
    await page.click('#dlgBox [data-save]');
    await setupClosed(page);
  };
  const was = await setupOf(page);
  await useArrange();
  assert.deepEqual(await setupOf(page), was, 'after a Save');
  await openSetup(page);
  await page.click('#dlgBox [data-add]');
  await page.click('#dlgBox [data-cancel]');
  await useArrange();   // its Save shares a name with Save in Rubric setup
  assert.deepEqual(await setupOf(page), was, 'after a Cancel');
  assert.deepEqual(page.errors, []);
  await close();
});

test('save a rubric, use it on another download, replace it and delete it', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await openSetup(page);
  await page.$$eval('[data-ci]', (a) => { const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }; set(a[0], 'Thesis'); set(a[1], 'Evidence'); set(a[2], 'Style'); });
  await typeLevels(page, 1, { 4: 'Well chosen quotes' });
  await saveRubricAs(page, 'Essay rubric');
  const lib = await page.evaluate(() => JSON.parse(localStorage.getItem('gs.rubrics')));
  assert.equal(lib.length, 1);
  assert.deepEqual(lib[0].criteria, ['Thesis', 'Evidence', 'Style']);
  assert.equal(lib[0].levels[1][4], 'Well chosen quotes');
  assert.equal(lib[0].scale[12], 100, 'the grading scale goes with it');
  assert.ok(await page.$('[data-rbuse]'), 'listed right away');
  assert.equal(await page.$eval(lvSel(1, 4), e => e.value), 'Well chosen quotes', 'saving it doesn’t lose what’s in the dialog');
  await page.click('#dlgBox [data-cancel]');
  assert.equal((await setupOf(page)).levels, undefined, 'saving a rubric isn’t saving the setup');

  // A different download, starting plain, in plain points.
  await page.reload(); await appReady(page);
  await openZip(page, otherZip, 'Other.zip');
  await openSetup(page);
  await page.click('[data-m="points"]');
  await page.$eval('#outOf', e => { e.value = '20'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('[data-preset="none"]');
  await saveSetup(page);
  await page.type('#ptsIn', '17');
  await openSetup(page);
  assert.equal(await page.$eval('#setupBody', e => e.textContent.includes('Essay rubric')), true, 'a saved rubric is offered in points mode too');
  await page.click('[data-rbuse]');
  await answerDlg(page, { yes: false });
  assert.equal(await page.$$eval('[data-ci]', e => e.length), 0, 'Keep what I have changes nothing');
  await page.click('[data-rbuse]');
  await answerDlg(page, { yes: true });
  assert.match(page.lastDialog, /1 student has a total typed in/);
  assert.match(page.lastDialog, /grading scale/);
  await page.waitForSelector('[data-ci]');
  assert.deepEqual(await page.$$eval('[data-ci]', e => e.map(x => x.value)), ['Thesis', 'Evidence', 'Style']);
  await saveSetup(page);
  const s = await setupOf(page);
  assert.equal(s.mode, 'rubric'); assert.equal(s.levels[1][4], 'Well chosen quotes'); assert.equal(s.scale[12], 100);
  assert.equal(await page.evaluate(() => window.__gs.percentFor(10.5)), 93, 'the scale still says 10.5 = 93%');
  await hover(page, 1, 4);
  assert.equal(await lvText(page, 1), '4 Well chosen quotes');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].grade.points), '17', 'the typed total stays saved');

  // Same name again: asks, and replaces.
  await openSetup(page);
  await page.click('#dlgBox [data-rm="2"]');
  await page.click('#dlgBox [data-rbsave]');
  await answerDlg(page, { typed: 'essay RUBRIC' });
  await answerDlg(page, { yes: false });
  await page.waitForFunction(() => !document.querySelector('#askDlg'));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.rubrics'))[0].criteria.length), 3, 'Keep the old one');
  await saveRubricAs(page, 'Essay Rubric', { replace: true });
  const lib2 = await page.evaluate(() => JSON.parse(localStorage.getItem('gs.rubrics')));
  assert.equal(lib2.length, 1); assert.equal(lib2[0].criteria.length, 2); assert.equal(lib2[0].id, lib[0].id);

  await page.click('[data-rbdel]');
  await answerDlg(page, { yes: false });
  assert.equal(await page.evaluate(() => window.__gs.savedRubrics().length), 1);
  await page.click('[data-rbdel]');
  await answerDlg(page, { yes: true });
  await page.waitForFunction(() => !document.querySelector('[data-rbdel]'));
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.rubrics'))), []);
  assert.deepEqual(page.errors, []);
  await close();
});

test('using a saved rubric warns about scores on rows it doesn’t have, and keeps them', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.rubrics': JSON.stringify([{ id: 'r1', name: 'Short one', criteria: ['Only row', 'Second'], scale: null, at: 1 }, { id: 'r2', name: 'Big one', criteria: ['A', 'B', 'C', 'D'], scale: null, at: 2 }]) } } });
  await openZip(page, zip);
  await score(page, [3, 2, 4]);
  await openSetup(page);
  await page.click('[data-rbuse="r1"]');
  await answerDlg(page, { yes: true });
  assert.match(page.lastDialog, /1 student has a score on rows this rubric doesn’t have/);
  await page.waitForFunction(() => document.querySelectorAll('[data-ci]').length === 2);
  await saveSetup(page);
  const g = () => page.evaluate(() => { const G = window.__gs, st = G.state().batch.students[0]; return { rubric: st.grade.rubric, of: G.gradeOf(st) }; });
  assert.deepEqual((await g()).rubric, [3, 2, 4], 'the third score isn’t thrown away');
  assert.equal((await g()).of.total, 5);
  assert.equal((await g()).of.pct, 63, 'plain share with no scale');
  await openSetup(page);
  await page.click('[data-rbuse="r2"]');
  await answerDlg(page, { yes: true });
  assert.match(page.lastDialog, /partial until the new rows are scored/);
  await page.waitForFunction(() => document.querySelectorAll('[data-ci]').length === 4);
  await saveSetup(page);
  const after = await g();
  assert.equal(after.of.total, 9); assert.equal(after.of.partial, true);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a saved rubric with the wrong shape in storage is skipped, not a crash', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.rubrics': JSON.stringify([null, { id: 'x' }, { id: 'y', name: 'Fine', criteria: ['One'] }]) } } });
  await openZip(page, zip);
  await openSetup(page);
  assert.deepEqual(await page.$$eval('[data-rbuse]', e => e.map(x => x.dataset.rbuse)), ['y']);
  await page.click('#dlgBox [data-cancel]');
  await page.evaluate(() => localStorage.setItem('gs.rubrics', '"nonsense"'));
  assert.deepEqual(await page.evaluate(() => window.__gs.savedRubrics()), []);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a take-home file carries saved rubrics and descriptions', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await openSetup(page);
  await typeLevels(page, 0, LV);
  await saveRubricAs(page, 'Carried');
  await saveSetup(page);
  await settle(page);
  await page.click('#closeBtn');
  await page.waitForFunction(() => document.querySelector('#start').hidden === false);
  const out = await takeHome(page);
  await close();
  const b = await openApp(browser);
  await openFile(b.page, out); await bringIt(b.page);
  assert.deepEqual(await b.page.evaluate(() => window.__gs.savedRubrics().map(r => r.name)), ['Carried']);
  assert.deepEqual(await b.page.evaluate(() => JSON.parse(localStorage.getItem('gs.setup')).levels[0]), LV);
  await b.close();
});

/* ---------------- class overview ---------------- */
// 0, missing with a leftover score, excused, partial, late, nothing yet, a full score, and a confirmed 10/15 from the paper.
async function classOpen(page) {
  await page.setViewport({ width: 1280, height: 860 });
  await openZip(page, classZip, 'Class.zip');
  await page.evaluate(() => window.__gs.scanAll());
  await page.evaluate(() => {
    const G = window.__gs, S = G.state().batch.students, set = (i, r, status) => { S[i].grade.rubric = r; if (status) S[i].grade.status = status; };
    set(0, [0, 0, 0]);
    set(1, [4, 4, 4], 'missing');
    set(2, [4, 4, 4], 'excused');
    set(3, [1, null, null]);
    set(4, [3, 3, 3.5], 'late');
    set(6, [4, 2, 4]);
    S[7].found = { found: true, score: 10, outOf: 15, pct: 67 };
  });
}
const ovStats = page => page.evaluate(() => {
  const s = window.__gs.classStats();
  return { ...s, bins: s.bins.map(b => ({ lo: b.lo, n: b.who.length, who: b.who })) };
});

test('the overview counts 0, leaves out missing, excused and partial, and says so', async () => {
  const { page, close } = await openApp(browser);
  await classOpen(page);
  const s = await ovStats(page);
  assert.deepEqual(s.counted.map(x => x.name), ['Ada Zero', 'Eli Late', 'Gil Full'], 'a 0 counts, late counts');
  assert.deepEqual(s.counted.map(x => x.total), [0, 9.5, 10]);
  assert.deepEqual(s.missing.map(x => x.name), ['Ben Missing']);
  assert.deepEqual(s.excused.map(x => x.name), ['Cam Excused']);
  assert.deepEqual(s.partial.map(x => [x.name, x.note]), [['Dee Partial', '1 of 3 rows scored']]);
  assert.deepEqual(s.notScored.map(x => x.name), ['Fay Blank']);
  assert.deepEqual(s.offScale.map(x => x.name), ['Hal Paper'], 'a 10 out of 15 isn’t a 10 out of 12');
  assert.equal(s.n, 3); assert.equal(s.everyone, 8);
  assert.equal(s.low, 0, 'the lowest is a real 0');
  assert.equal(s.high, 10);
  assert.equal(s.median, 9.5);
  assert.ok(Math.abs(s.mean - 19.5 / 3) < 1e-9);
  // Each student's own percent, averaged: 0 is 48%, 9.5 is 89%, 10 is 91%.
  const pcts = await page.evaluate(() => [0, 9.5, 10].map(t => window.__gs.percentFor(t)));
  assert.equal(s.meanPct, Math.round((pcts[0] + pcts[1] + pcts[2]) / 3));
  assert.equal(s.bins.length, 13);
  assert.deepEqual(s.bins.filter(b => b.n).map(b => [b.lo, b.n]), [[0, 1], [9, 1], [10, 1]], 'a half point counts with the whole number below it');

  await page.click('#moreBtn');
  await page.click('#overviewBtn');
  await page.waitForSelector('#ovBody');
  const left = await page.$eval('#ovLeft', e => e.textContent);
  assert.equal(left, 'Counted: 3 of 8 students. Left out: 1 marked missing, 1 excused, 1 partial, 1 not scored yet, 1 from the paper, not on this scale. Missing and excused don’t count as 0. A score of 0 is counted. 1 late score is counted.');
  assert.match(await page.$eval('#ovTiles', e => e.textContent), /Lowest0/);
  const who = await page.$$eval('#ovWho details', d => Object.fromEntries(d.map(x => [x.dataset.group, x.querySelectorAll('li').length])));
  assert.deepEqual(who, { 'Not scored yet': 1, 'Partial: some rows scored': 1, 'Marked missing': 1, 'Excused': 1, 'Read from the paper, not on this scale': 1, 'Late, and counted': 1 });
  assert.equal((await page.$$('#ovSpread .ovb')).length, 3);
  assert.deepEqual(page.errors, []);
  await close();
});

test('grades from the paper: on this scale they count, a bare percent is left out and named', async () => {
  const { page, close } = await openApp(browser);
  await classOpen(page);
  await page.evaluate(() => { const S = window.__gs.state().batch.students; S[7].found = { found: true, score: 10, outOf: 12, pct: 91 }; S[5].found = { found: true, score: null, outOf: null, pct: 88 }; });
  let s = await ovStats(page);
  assert.equal(s.counted.find(x => x.name === 'Hal Paper').paper, true);
  assert.equal(s.nRowless, 1);
  assert.deepEqual(s.offScale.map(x => [x.name, x.note]), [['Fay Blank', 'The paper says 88%']]);
  await page.evaluate(() => { const S = window.__gs.state().batch.students; S[7].found = { found: true, score: 10, outOf: 15, pct: 67 }; S[7].grade.sheet = '11'; });
  s = await ovStats(page);
  assert.equal(s.counted.find(x => x.name === 'Hal Paper').total, 11, 'what she typed on the Grade sheet is on this scale');
  await page.evaluate(() => window.__gs.openOverview());
  assert.match(await page.$eval('#ovRows .ovcap2', e => e.textContent), /1 score read from the paper has no rows/);
  await close();
});

test('rubric rows: a 0 counts, partial rows count, missing and excused don’t', async () => {
  const { page, close } = await openApp(browser);
  await classOpen(page);
  const s = await ovStats(page);
  const row = n => s.rows.find(x => x.r === n);
  // Row 0: 0, 1 (partial), 3, 4. Row 1: 0, 3, 2. Row 2: 0, 3.5, 4. Ben's and Cam's 4s are all left out.
  assert.equal(row(0).n, 4); assert.equal(row(0).avg, 2); assert.equal(row(0).low, 2);
  assert.equal(row(1).n, 3); assert.ok(Math.abs(row(1).avg - 5 / 3) < 1e-9); assert.equal(row(1).low, 2);
  assert.equal(row(2).n, 3); assert.equal(row(2).avg, 2.5);
  assert.deepEqual(s.rows.map(x => x.r), [1, 0, 2], 'lowest first');
  assert.deepEqual(s.rows.map(x => x.lowest), [true, false, false]);
  await page.evaluate(() => window.__gs.openOverview());
  assert.deepEqual(await page.$$eval('#ovRows .ovr', e => e.map(x => x.querySelector('.ovrn').textContent)), ['Criterion 2 lowest', 'Criterion 1', 'Criterion 3']);
  assert.deepEqual(await page.$$eval('#ovRows .ovrv', e => e.map(x => x.textContent)), ['1.7', '2', '2.5']);
  assert.equal(await page.$eval('#ovRows .ovrb.on', e => e.parentElement.previousElementSibling.textContent.includes('Criterion 2')), true);
  const note = await page.$eval('#ovRows .ovcap2', e => e.textContent);
  assert.match(note, /including the scored rows on 1 partial paper/);
  assert.match(note, /Missing and excused students aren’t in it/);
  await close();
});

test('rows tied or barely scored aren’t called lowest; nothing scored says so', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, otherZip);   // no grade on the paper: the overview waits for papers to be read, and would count one
  let s = await ovStats(page);
  assert.equal(s.n, 0); assert.equal(s.mean, undefined);
  assert.deepEqual(s.rows.map(x => x.avg), [null, null, null]);
  assert.deepEqual(s.rows.map(x => x.lowest), [false, false, false]);
  await page.evaluate(() => window.__gs.openOverview());
  assert.match(await page.$eval('#ovSpread', e => e.textContent), /No finished scores yet/);
  assert.match(await page.$eval('#ovRows', e => e.textContent), /No rubric rows scored yet/);
  assert.equal(await page.$('#ovTiles'), null);
  await page.click('#dlgBox [data-close]');
  await score(page, [2, 2, 2]);
  s = await ovStats(page);
  assert.deepEqual(s.rows.map(x => x.lowest), [false, false, false], 'all equal: no row is lowest');
  assert.deepEqual(page.errors, []);
  await close();
});

test('points mode: bins fit the total, no rows, and a score over the top is said out loud', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await openSetup(page);
  await page.click('[data-m="points"]');
  await page.$eval('#outOf', e => { e.value = '50'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await saveSetup(page);
  await page.evaluate(() => { const S = window.__gs.state().batch.students; S[0].grade.points = '50'; S[1].grade.points = '0'; S[2].grade.points = '60'; });
  const s = await ovStats(page);
  assert.equal(s.bins.length, 10);
  assert.deepEqual(s.bins.filter(b => b.n).map(b => [b.lo, b.n]), [[0, 1], [45, 1]], '50 of 50 is in the top bin, 0 in the bottom');
  assert.deepEqual(s.ownOff.map(x => x.i), [2], 'her own score, so not said to be from the paper');
  assert.deepEqual(s.offScale, []);
  await page.evaluate(() => window.__gs.openOverview());
  assert.match(await page.$eval('#ovRows', e => e.textContent), /just a total/);
  const lbl = await page.$$eval('#ovSpread .ovc[tabindex]', e => e.map(x => x.dataset.tl));
  assert.deepEqual(lbl, ['Score 0 to under 5', 'Score 45 to 50']);
  assert.deepEqual(page.errors, []);
  await close();
});

test('roster students with nothing here are counted as left out, and hidden while anonymous', async () => {
  const lib = { classes: [{ id: 'cls1', name: '9A', names: ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup', 'Ivy Nofolder'] }], units: [] };
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(lib) } } });
  await openZip(page, zip);
  await page.evaluate(() => { window.__gs.state().batch.classId = 'cls1'; });
  const rosterOnly = await ovStats(page);
  // A roster student not in the download may join the list as "no paper"; either way she's accounted for.
  const named = rosterOnly.rosterOnly.includes('Ivy Nofolder') || rosterOnly.notScored.some(x => x.name === 'Ivy Nofolder');
  assert.ok(named, 'Ivy shows up somewhere');
  await page.evaluate(() => { const b = window.__gs.state().batch; b.students = b.students.filter(s => s.key !== 'Ivy Nofolder'); });
  const s = await ovStats(page);
  assert.deepEqual(s.rosterOnly, ['Ivy Nofolder']);
  await page.evaluate(() => window.__gs.openOverview());
  assert.match(await page.$eval('#ovLeft', e => e.textContent), /1 on the roster with nothing here/);
  assert.match(await page.$eval('#ovWho', e => e.textContent), /Ivy Nofolder/);
  await page.click('#dlgBox [data-close]');
  await page.evaluate(() => window.__gs.setAnon(true));
  await page.evaluate(() => window.__gs.openOverview());
  const body = await page.$eval('#ovBody', e => e.innerHTML);
  for (const n of ['Ivy Nofolder', 'Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup']) assert.ok(!body.includes(n), n + ' stays hidden');
  assert.match(body, /Paper 1/);
  assert.match(body, /Names stay hidden/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the overview: a name goes to that paper, Grades list goes both ways, tooltips work by pointing and by keyboard', async () => {
  const { page, close } = await openApp(browser);
  await classOpen(page);
  await page.click('#gradesBtn');
  await page.waitForSelector('[data-ovopen]');
  await page.click('[data-ovopen]');
  await page.waitForSelector('#ovBody');
  await page.click('[data-ovgrades]');
  await page.waitForSelector('[data-ovopen]');
  await page.click('[data-ovopen]');
  await page.waitForSelector('#ovBody');

  const bar = await page.$('#ovSpread .ovc[tabindex]');
  await bar.hover();
  const tip = () => page.$eval('#ovTip', t => ({ hidden: t.hidden, b: t.querySelector('b').textContent, l: t.querySelector('span').textContent, n: t.querySelector('em').textContent, r: t.getBoundingClientRect().toJSON() }));
  let t = await tip();
  assert.equal(t.hidden, false); assert.equal(t.b, '1 student'); assert.equal(t.l, 'Score 0 to under 1'); assert.equal(t.n, 'Ada Zero');
  assert.ok(t.r.left >= 0 && t.r.right <= 1280 && t.r.top >= 0, 'on screen');
  await page.mouse.move(2, 2);
  assert.equal((await tip()).hidden, true);
  await page.focus('#ovRows .ovr');
  t = await tip();
  assert.equal(t.hidden, false); assert.equal(t.b, '1.7 average'); assert.equal(t.l, 'Criterion 2');
  assert.equal(await page.$eval('#ovRows .ovr', e => e.getAttribute('aria-label')), 'Criterion 2: 1.7 average. 3 scores, 2 at 2 or less');

  await page.click('#ovSpread details summary');
  assert.deepEqual(await page.$$eval('#ovSpread .ovtab tbody tr', r => r.map(x => x.textContent)), ['10 to under 111Gil Full', '9 to under 101Eli Late', '0 to under 11Ada Zero']);

  await page.evaluate(() => [...document.querySelectorAll('#ovWho [data-ovgo]')].find(b => b.textContent === 'Fay Blank').click());
  await page.waitForFunction(() => document.querySelector('#dlg').hidden && window.__gs.state().cur === 5);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the overview fits at laptop size and stays readable in dark mode', async () => {
  const { page, close } = await openApp(browser);
  await classOpen(page);
  await page.evaluate(() => window.__gs.openOverview());
  const fits = () => page.$eval('#dlgBox', b => { const r = b.getBoundingClientRect(); return r.right <= innerWidth && r.bottom <= innerHeight && b.querySelector('#ovBody').scrollWidth <= b.querySelector('#ovBody').clientWidth + 1; });
  assert.ok(await fits());
  await page.setViewport({ width: 900, height: 700 });
  assert.ok(await fits(), 'and at a narrow window');
  await page.$eval('#dlgBox [data-close]', b => b.click());
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; window.__gs.openOverview(); });
  const css = await page.evaluate(() => { const g = getComputedStyle(document.querySelector('.ovb')); return { bar: g.backgroundColor }; });
  assert.equal(css.bar, 'rgb(71, 147, 212)', 'dark mode has its own bar color');
  await page.$eval('#dlgBox [data-close]', b => b.click());
  await page.evaluate(() => { window.__gs.state().setup.levels = [{ 4: 'Words for four', 3: 'Words for three' }]; window.__gs.openStudent(0); });
  await page.waitForSelector('.lvrow');
  await page.click('[data-lvopen="0"]');
  await page.click('.scores[data-c="0"] button[data-v="4"]');
  for (const theme of ['dark', 'light']) {
    await page.evaluate(th => { document.documentElement.dataset.theme = th; }, theme);
    await page.waitForFunction(() => document.querySelector('#dlg').hidden);
    assert.deepEqual(await page.evaluate(contrastFails), [], theme + ': the score panel');
    await page.evaluate(() => window.__gs.openOverview());
    await page.$$eval('#ovBody details', d => d.forEach(x => { x.open = true; }));
    assert.deepEqual(await page.evaluate(contrastFails), [], theme + ': the overview');
    await page.$eval('#dlgBox [data-close]', b => b.click());
    await page.evaluate(() => window.__gs.openSetup());
    await page.$eval('[data-lvrow="0"]', d => { d.open = true; });
    assert.deepEqual(await page.evaluate(contrastFails), [], theme + ': Rubric setup');
    await page.click('#dlgBox [data-cancel]');
  }
  assert.deepEqual(page.errors, []);
  await close();
});
