// The Planner's deck rules and school week are the teacher's own: an agenda on slide 2 and 28 to 36 pt text unless the
// timetable says otherwise; Monday to Friday, with Saturday or Sunday shown when a class meets then. Every name is made up.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { launch } = require('./helpers/chrome');
const { serve } = require('./helpers/serve');
const PAGE = () => require('fs').readFileSync(path.join(__dirname, '..', 'planner.html'), 'utf8');

const SETUP = { kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-08-31', semEnd: '2027-01-18',
  classes: [{ id: 'A1', name: 'Course A-1', course: 'Course A', color: '#1F6FB2', meets: [{ dow: 2, start: '09:00', end: '10:30' }, { dow: 4, start: '09:00', end: '10:30' }] }], daysOff: [], events: [] };
async function open() {
  const server = await serve(PAGE);
  const browser = await launch(), page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
  return { page, errors, done: async () => { await browser.close(); await server.close(); } };
}
const week = async (page, monday) => { await page.evaluate(m => { const P = window.__planner; P.L.view = 'week'; P.L.weekOf = m; P.renderLessons(); }, monday); return page.$$eval('.ls-grid .ls-dh', ds => ds.map(d => d.textContent)); };

test('with nothing said the rules are as before: agenda on slide 2, 28 to 36 pt, Monday to Friday, and nothing new is stored', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(s => window.__planner.applySetup(s), SETUP);
    assert.equal(await page.evaluate(() => 'deck' in window.__planner.L.setup), false);
    assert.deepEqual(await week(page, '2026-11-09'), ['Mon 11/9', 'Tue 11/10', 'Wed 11/11', 'Thu 11/12', 'Fri 11/13']);
    assert.match(await page.$eval('.ls-wk', e => e.textContent), /Nov 9 – 13/);
    const l = await page.evaluate(() => { const P = window.__planner; const l = P.deckStart(P.normLesson({ title: 'Made up', slots: [], slides: [{ layout: 'content', title: 'One', size: 20 }, { layout: 'content', title: 'Two', size: 34 }] })); return l.slides.map(s => [s.layout, s.size]); });
    assert.deepEqual(l, [['title', 28], ['agenda', 28], ['content', 28], ['content', 34]]);
    // Timetable shows both rules on, and saving it as it is still stores nothing
    await page.evaluate(() => window.__planner.openTimetable());
    await page.waitForSelector('#ttAgenda');
    assert.deepEqual(await page.evaluate(() => [document.querySelector('#ttAgenda').checked, document.querySelector('#ttSizes').checked]), [true, true]);
    await page.click('#dlgBox [data-ok]');
    await page.waitForFunction(() => document.querySelector('#dlg').hidden);
    assert.equal(await page.evaluate(() => 'deck' in window.__planner.L.setup), false);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('a teacher turns the agenda and the text size range off in Timetable, and a setup file can carry both', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(s => window.__planner.applySetup(s), SETUP);
    await page.evaluate(() => window.__planner.openTimetable());
    await page.waitForSelector('#ttAgenda');
    await page.click('#ttAgenda'); await page.click('#ttSizes');
    await page.click('#dlgBox [data-ok]');
    await page.waitForFunction(() => window.__planner.L.setup.deck);
    assert.deepEqual(await page.evaluate(() => window.__planner.L.setup.deck), { agenda: false, sizes: 'any' });
    const l = await page.evaluate(() => { const P = window.__planner; const l = P.deckStart(P.normLesson({ title: 'Made up', slots: [], slides: [{ layout: 'content', title: 'One', size: 20 }, { layout: 'content', title: 'Two', size: 44 }, { layout: 'content', title: 'Three', size: 90 }] })); return l.slides.map(s => [s.layout, s.size]); });
    assert.deepEqual(l, [['title', 28], ['content', 20], ['content', 44], ['content', 28]]);
    assert.match(await page.evaluate(() => window.__planner.folderReadme()), /"size" is 18 to 44 \(pt\)[\s\S]*Slide 1 is always the title slide\. Keep it there/);
    // only the agenda rule off, from a file; anything else in "deck" is dropped
    await page.evaluate(s => window.__planner.applySetup({ ...s, deck: { agenda: false, sizes: 'huge', other: 1 } }), SETUP);
    assert.deepEqual(await page.evaluate(() => window.__planner.L.setup.deck), { agenda: false });
    assert.match(await page.evaluate(() => window.__planner.folderReadme()), /"size" is 28 to 36 \(pt\)/);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('a class that meets on Saturday or Sunday puts that day in the week, Sunday in front', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    const sun = { ...SETUP, semStart: '2026-11-08', classes: [{ ...SETUP.classes[0], meets: [{ dow: 0, start: '08:00', end: '09:00' }, { dow: 4, start: '08:00', end: '09:00' }] }] };
    await page.evaluate(s => window.__planner.applySetup(s), sun);
    assert.equal(await page.evaluate(() => window.__planner.L.setup.semStart), '2026-11-09', 'a first week picked by its Sunday is that school week');
    assert.deepEqual(await week(page, '2026-11-09'), ['Sun 11/8', 'Mon 11/9', 'Tue 11/10', 'Wed 11/11', 'Thu 11/12', 'Fri 11/13']);
    assert.match(await page.$eval('.ls-wk', e => e.textContent), /Nov 8 – 13/);
    assert.equal(await page.$eval('.ls-grid', g => getComputedStyle(g).gridTemplateColumns.split(' ').length), 6);
    assert.equal(await page.$$eval('.ls-grid .ls-day', ds => ds[0].querySelectorAll('[data-class], .ls-slot, .ls-cls').length > 0 || /8:00/.test(ds[0].textContent)), true, 'the Sunday meeting shows');
    // Timetable offers Sunday
    await page.evaluate(() => window.__planner.openTimetable());
    await page.waitForSelector('#ttBody select[data-m="dow"]');
    assert.deepEqual(await page.$eval('#ttBody select[data-m="dow"]', s => [s.value, [...s.options].map(o => o.textContent).join(' ')]), ['0', 'Monday Tuesday Wednesday Thursday Friday Saturday Sunday']);
    await page.click('#dlgBox [data-x]');
    const sat = { ...SETUP, classes: [{ ...SETUP.classes[0], meets: [{ dow: 6, start: '08:00', end: '09:00' }] }] };
    await page.evaluate(s => window.__planner.applySetup(s), sat);
    assert.deepEqual(await week(page, '2026-11-09'), ['Mon 11/9', 'Tue 11/10', 'Wed 11/11', 'Thu 11/12', 'Fri 11/13', 'Sat 11/14']);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});
