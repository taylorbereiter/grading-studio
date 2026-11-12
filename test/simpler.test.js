// A simpler interface (11/12): a class page's tab row holds three tabs and More, with a pin to keep any other page in the row;
// one Class setup button; one ⋯ on a unit and on an assignment; the gradebook's tools in one More menu; Settings in seven pages
// whose old addresses still open. Nothing is removed and nothing new is stored but the pins. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, appReady, goTo, classPage, pick, answerDlg } = require('./helpers/app');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture'];
function seed() {
  const typed = vals => ({ max: null, s: Object.fromEntries(NAMES.map((n, i) => [n, { v: vals[i] }])) });
  const lib = {
    classes: [{ id: 'c1', name: 'Grade 9 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [
      { id: 'i1', name: 'Reading check 1', classId: 'c1', type: 'ic', due: '2026-09-01', typed: typed([90, 95, 70]) },
      { id: 'i2', name: 'Vocabulary quiz', classId: 'c1', type: 'sum', due: '2026-09-30', typed: typed([80, 75, 70]) },
    ] }] }, { id: 'c2', name: 'Grade 10 Literature', names: ['Nia Elsewhere'], units: [] }],
    loose: { id: '', units: [] }, seed2627: true,
    book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2027-07-31' }] },
  };
  return { ls: { 'gs.lib': JSON.stringify(lib) } };
}
const rowTabs = page => page.$$eval('.ctabs > .ctab', xs => xs.map(x => x.textContent));
const moreTabs = page => page.$$eval('.ctabs .ctrow a', xs => xs.map(x => x.textContent));
const lib = page => page.evaluate(() => window.__gs.state().lib);
const shown = (page, sel) => page.$$eval(sel, xs => xs.filter(x => x.checkVisibility()).length);

test('the tab row holds three tabs and More; a page under More opens, and a pin keeps it in the row', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await classPage(page, 'c1');
  assert.deepEqual(await rowTabs(page), ['Assignments', 'Gradebook', 'Students']);
  assert.deepEqual(await moreTabs(page), ['Attendance', 'Seating', 'Missing work', 'Charts', 'Report comments']);
  assert.ok(await page.$eval('#ctMore + .km', m => m.hidden), 'closed until it is asked for');
  await page.click('#ctMore');
  assert.ok(!await page.$eval('#ctMore + .km', m => m.hidden));
  await page.click('.ctrow [data-ctab="charts"]'); await page.waitForSelector('#bkHeat');
  assert.equal(await page.evaluate(() => location.hash), '#/class/c1/charts');
  assert.deepEqual(await rowTabs(page), ['Assignments', 'Gradebook', 'Students', 'Charts'], 'the page on screen shows in the row while it is open');
  assert.equal(await page.$eval('.ctabs > .ctab.on', a => a.textContent), 'Charts');
  await pick(page, '[data-ctab="gradebook"]'); await page.waitForSelector('#bkTab');
  assert.deepEqual(await rowTabs(page), ['Assignments', 'Gradebook', 'Students'], 'and leaves it again');
  // the pin
  await pick(page, '[data-ctpin="missing"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.ctabs > .ctab')].some(a => a.textContent === 'Missing work'));
  assert.deepEqual(await rowTabs(page), ['Assignments', 'Gradebook', 'Students', 'Missing work']);
  assert.deepEqual((await lib(page)).me.tabs, ['missing']);
  assert.equal(await page.$eval('[data-ctpin="missing"]', b => b.getAttribute('aria-pressed')), 'true');
  // it is the teacher's, not the class's: the other class has it too, and it is there after a refresh
  await goTo(page, '#/class/c2');
  assert.deepEqual(await rowTabs(page), ['Assignments', 'Gradebook', 'Students', 'Missing work']);
  await page.reloadHere(); await appReady(page); await page.waitForSelector('.ctabs');
  assert.deepEqual(await rowTabs(page), ['Assignments', 'Gradebook', 'Students', 'Missing work']);
  await pick(page, '[data-ctpin="missing"]');
  await page.waitForFunction(() => document.querySelectorAll('.ctabs > .ctab').length === 3);
  assert.deepEqual((await lib(page)).me.tabs, []);
  // every old address still opens its page
  for (const [k, sel] of [['attendance', '#attList, #attBody, .cpanel'], ['seating', '.cpanel'], ['missing', '#mis'], ['reports', '#rptText']]) {
    await goTo(page, '#/class/c1/' + k); await page.waitForSelector(sel);
    assert.equal(await page.evaluate(() => location.hash), '#/class/c1/' + k);
  }
  assert.deepEqual(page.errors, []);
  await close();
});

test('Class setup holds the roster, grading, the school link and the class’s place; a unit and an assignment each have one menu', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await classPage(page, 'c1');
  assert.equal(await shown(page, '.clshead button'), 1, 'one button in the class’s heading');
  assert.equal(await page.$eval('#clsSetup', b => b.textContent), 'Class setup');
  assert.deepEqual(await page.$$eval('#clsSetup + .km .mitem', xs => xs.map(x => x.firstChild.textContent)), ['Edit roster', 'Grading', 'Add the Class page link…', 'Move up in the sidebar', 'Move down in the sidebar']);
  assert.ok(await page.$eval('#clsSetup + .km [data-cmove="0:-1"]', b => b.disabled), 'the first class can’t go up');
  await pick(page, '[data-cmove="0:1"]');
  assert.deepEqual((await lib(page)).classes.map(c => c.id), ['c2', 'c1']);
  await pick(page, '[data-cls="c1"] [data-edit-class]'); await page.waitForSelector('#cNames');
  await page.keyboard.press('Escape');
  // a unit: its name and one ⋯
  assert.equal(await shown(page, '.uhead button'), 1);
  await pick(page, '[data-urename="u1"]'); await answerDlg(page, { typed: 'Stories' });
  await page.waitForFunction(() => document.querySelector('.uhead .nm').textContent === 'Stories');
  // an assignment: at most one button, and one ⋯ that holds Edit
  assert.equal(await shown(page, '[data-card="i1"] .row button'), 1);
  await pick(page, '[data-edit-asg="i1"]'); await page.waitForSelector('#aClass');
  await page.keyboard.press('Escape');
  // + Unit sits under the units
  await page.click('.board > [data-addunit]'); await answerDlg(page, { typed: 'Poems' });
  await page.waitForFunction(() => document.querySelectorAll('.unit').length === 2);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the gradebook has one blue button and one More menu', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await goTo(page, '#/class/c1/gradebook'); await page.waitForSelector('#bkTab');
  assert.deepEqual(await page.$$eval('.bkbar > button, .bkbar > .kmw > button', xs => xs.filter(x => x.checkVisibility()).map(x => x.textContent.trim())), ['+ Add scores', 'More ▾']);
  assert.deepEqual(await page.$$eval('#bkMore + .km .mitem', xs => xs.map(x => x.firstChild.textContent)), ['Show points', 'Term setup', 'Add extra credit…', 'Import scores…', 'Copy the table', 'Leave students out…']);
  await pick(page, '[data-bkshow="pts"]');
  await page.waitForFunction(() => document.querySelector('#bkMore + .km [data-bkshow]').dataset.bkshow === 'pct');
  assert.equal(await page.$eval('#bkMore + .km [data-bkshow]', b => b.firstChild.textContent), 'Show percent');
  // leaving students out: Done stays in sight while it is on
  await pick(page, '[data-bkpickon]');
  await page.waitForSelector('.bkbar > [data-bkpickon]');
  assert.equal(await page.$eval('.bkbar > [data-bkpickon]', b => b.textContent), 'Done');
  await page.click('.bkbar > [data-bkpickon]');
  await page.waitForFunction(() => !document.querySelector('.bkbar > [data-bkpickon]'));
  // how it is worked out is folded away, and still there
  assert.ok(!await page.$eval('.bkhow', d => d.open));
  assert.match(await page.$eval('.bkhow .bkcap', p => p.textContent), /roster order/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Settings has seven pages, and every older address opens the page its cards moved to', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await goTo(page, '#/settings');
  assert.deepEqual(await page.$$eval('#setNav .setlink b', b => b.map(x => x.textContent)), ['Saving and carrying', 'Classes and timetable', 'Grades', 'Marking', 'Working with AI', 'Display and keys', 'About and updates']);
  const cards = () => page.$$eval('#setPane [data-sec]', xs => [...new Set(xs.filter(x => !x.hidden).map(x => x.dataset.sec))]);
  assert.deepEqual(await cards(), ['saving', 'history']);
  for (const [k, on, secs] of [['history', 'Saving and carrying', ['saving', 'history']], ['classes', 'Classes and timetable', ['classes', 'timetable']], ['timetable', 'Classes and timetable', ['classes', 'timetable']],
    ['terms', 'Grades', ['terms', 'grading']], ['grading', 'Grades', ['terms', 'grading']], ['marking', 'Marking', ['marking']], ['setup', 'Working with AI', ['setup', 'claude']], ['claude', 'Working with AI', ['setup', 'claude']],
    ['display', 'Display and keys', ['display', 'keys']], ['keys', 'Display and keys', ['display', 'keys']], ['about', 'About and updates', ['about']]]) {
    await goTo(page, '#/settings/' + k);
    await page.waitForFunction(on => (document.querySelector('#setNav .setlink.on b') || {}).textContent === on, {}, on);
    assert.deepEqual((await cards()).sort(), [...secs].sort(), k);
    assert.equal(await page.evaluate(() => location.hash), '#/settings/' + k, 'the address is kept');
  }
  assert.equal(await page.title(), 'About and updates · Settings · Grading Studio');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the kept tabs travel in My setup, out and in', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await classPage(page, 'c1');
  await pick(page, '[data-ctpin="charts"]');
  await page.waitForFunction(() => document.querySelectorAll('.ctabs > .ctab').length === 4);
  const out = JSON.parse(await page.evaluate(() => window.__gs.stpExport()));
  assert.deepEqual(out.classTabs, ['Charts']);
  const parts = await page.evaluate(async () => { const G = window.__gs, r = G.stpParse(JSON.stringify({ gradingStudioSetup: 1, classTabs: ['Attendance', 'report comments', 'Gradebook', 'Nonsense'] })), S = G.stpRead(r.j); return { err: r.err || '', tabs: S.tabs, parts: (await G.stpDiff(S)).map(p => p.key) }; });
  assert.equal(parts.err, '');
  assert.deepEqual(parts.tabs, ['attendance', 'reports'], 'only pages that can be pinned, by name');
  assert.ok(parts.parts.includes('tabs'));
  await close();
});
