// Google Classroom, with no sign-in: the grades file makes a class with its roster and takes the scores through the gradebook's
// import, and a Drive folder of files named "Student name - title" opens with each student's files together. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { builtHtml, openApp, goTo, openZip, pickFile } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { builtHtml(); browser = await launch(); });
after(async () => { await browser.close(); });

// The layout Classroom's "Download all grades as CSV" is understood to have: names in two columns, an email, then a Date row and a Points row.
const CSV = 'Last Name,First Name,Email Address,Narrative essay,Vocab quiz 1,Reading log\r\n' +
  'Date,,,"Oct 20, 2026","Oct 27, 2026",\r\n' +
  'Points,,,40,10,\r\n' +
  'Class Average,,,31,8,\r\n' +
  'Testwell,Aria,aria.testwell@school.example,34,9,Missing\r\n' +
  'Sample,Bram,bram.sample@school.example,28,7,\r\n' +
  'Fixture,Cleo,cleo.fixture@school.example,,8,\r\n';
const lib = page => page.evaluate(() => window.__gs.state().lib);
async function chooseGrades(page, name = 'Grade 9 English.csv') {
  await page.evaluate(() => window.__gs.gcOpen());
  await page.waitForSelector('#gcFile');
  const clean = await pickFile(page, '#gcFile', Buffer.from(CSV), name);
  await page.waitForSelector('#gcFound:not([hidden])');
  clean();
}

test('the grades file makes a class with its roster, and its scores go through the gradebook import', async () => {
  const { page, close } = await openApp(browser);
  await goTo(page, '#/settings/classes');
  await page.waitForSelector('[data-setgc]');
  await page.click('[data-setgc]');
  await page.waitForSelector('.gcdlg #gcFile');
  await page.evaluate(() => document.querySelector('[data-gcclose]').click());
  await chooseGrades(page);
  assert.match(await page.$eval('#gcFound', e => e.textContent), /3 students.*3 assignments/);
  assert.equal(await page.$eval('#gcName', e => e.value), 'Grade 9 English');
  await page.click('[data-gcgo]');
  await page.waitForSelector('#bkImp .bkitab');
  let l = await lib(page), c = l.classes.find(k => k.name === 'Grade 9 English');
  assert.deepEqual(c.names, ['Aria Testwell', 'Bram Sample', 'Cleo Fixture']);
  assert.equal(c.info['Bram Sample'].email, 'bram.sample@school.example');
  assert.equal(c.units.length, 0, 'no score is saved before Import');
  const rows = await page.$$eval('#bkImp .bkitab tbody tr', trs => trs.map(tr => [tr.querySelector('[data-bkiname]') && tr.querySelector('[data-bkiname]').value, (tr.querySelector('[data-bkimax]') || {}).value, (tr.querySelector('[data-bkidue]') || {}).value]).filter(r => r[0]));
  assert.deepEqual(rows.slice(0, 2), [['Narrative essay', '40', '2026-10-20'], ['Vocab quiz 1', '10', '2026-10-27']]);
  await page.click('[data-bkisave]');
  await page.waitForFunction(() => !document.querySelector('#bkImp'));
  l = await lib(page); c = l.classes.find(k => k.name === 'Grade 9 English');
  const items = c.units.flatMap(u => u.items);
  assert.deepEqual(items.map(i => [i.name, i.typed.max]).slice(0, 2), [['Narrative essay', 40], ['Vocab quiz 1', 10]]);
  assert.equal(items[0].typed.s['Aria Testwell'].v, 34);
  assert.equal(items[0].typed.s['Cleo Fixture'], undefined);
  assert.ok(!Object.keys(items[0].typed.s).some(n => /average|points|date/i.test(n)), 'the Date, Points and Class Average rows are not students');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a class already here takes the file: students not on its roster are added, and nobody is doubled', async () => {
  const seed = { ls: { 'gs.lib': JSON.stringify({ classes: [{ id: 'c1', name: 'Grade 9 English', names: ['Bram Sample', 'Testwell, Aria'], units: [] }], loose: { id: '', units: [] }, seed2627: true }) } };
  const { page, close } = await openApp(browser, { seed });
  await chooseGrades(page, 'Grade 9 English - 2026-11-12.csv');
  assert.equal(await page.$eval('#gcTo', e => e.value), 'c1');
  assert.match(await page.$eval('#gcFound', e => e.textContent), /1 student not on its roster yet will be added: Cleo Fixture/);
  await page.click('[data-gcgo]');
  await page.waitForSelector('#bkImp .bkitab');
  const l = await lib(page);
  assert.equal(l.classes.length, 1);
  assert.deepEqual(l.classes[0].names, ['Bram Sample', 'Testwell, Aria', 'Cleo Fixture']);
  assert.equal(l.classes[0].info['Testwell, Aria'].email, 'aria.testwell@school.example');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a Classroom folder from Drive opens with each student’s files together; other loose files stay as they came', async () => {
  const pdf = await makePaper({ title: 'Essay' });
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Aria Testwell - Essay template.pdf': pdf, 'Aria Testwell - Works cited.pdf': pdf, 'Bram Sample - Essay template.pdf': pdf, 'Cleo Fixture - Essay template.pdf': pdf, 'Cleo Fixture - Works cited.pdf': pdf, 'Dov Madeup - Essay template.pdf': pdf, 'IMG_2041.pdf': pdf }), 'Narrative essay.zip');
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.students.map(s => [s.key, s.files.length])), [['Aria Testwell', 2], ['Bram Sample', 1], ['Cleo Fixture', 2], ['Dov Madeup', 1], ['IMG_2041', 1]]);
  // titles with a dash in them that don't repeat across students are not a class: one file each, as before
  await goTo(page, '#/');
  await openZip(page, zipOf({ 'Unit 1 - Notes.pdf': pdf, 'Unit 2 - Slides.pdf': pdf, 'Unit 3 - Reading.pdf': pdf }), 'Handouts.zip');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students.length), 3);
  await goTo(page, '#/');
  await openZip(page, zipOf({ 'Essay - Aria Testwell.pdf': pdf, 'Essay - Bram Sample.pdf': pdf }), 'Other.zip');
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.students.map(s => s.key)), ['Essay - Aria Testwell', 'Essay - Bram Sample']);
  assert.deepEqual(page.errors, []);
  await close();
});
