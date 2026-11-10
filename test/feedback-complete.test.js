// Feedback complete: grading a formative activity has one switch per student in place of a score, and the Gradebook's ✓ follows it. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { classPage, openApp, pickFile, waitPaper, press } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'];
function seed(type) {
  const lib = { classes: [{ id: 'c1', name: 'Grade 9 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [{ id: 'i1', name: 'Story map', classId: 'c1', type, due: '2026-09-05' }] }] }], loose: { id: '', units: [] }, seed2627: true };
  return { ls: { 'gs.lib': JSON.stringify(lib) } };
}
async function openCard(page) {
  await classPage(page, 'i1');
  await page.waitForSelector('[data-open-asg="i1"]');
  await page.click('[data-open-asg="i1"]');
  await page.waitForSelector('#dlgBox [data-cancel]'); await page.click('#dlgBox [data-cancel]');
  const clean = await pickFile(page, '#asgIn', zip, 'Story map.zip');
  await waitPaper(page); clean();
}
const ticks = page => page.$$eval('#stuList .stu', s => s.map(x => (x.querySelector('.fbck') ? '✓' : x.querySelector('.dot') ? '·' : '') + x.querySelector('.nm').textContent));
const noErrors = page => assert.deepEqual(page.errors, []);

test('a formative activity shows Feedback complete in place of the score, with F, Shift F and N', async () => {
  const { page, close } = await openApp(browser, { seed: seed('fm') });
  await openCard(page);
  await page.waitForSelector('#fbTog');
  assert.equal(await page.$('#ptsIn'), null); assert.equal(await page.$('.crit'), null);
  assert.equal(await page.$('#outAvg'), null, 'nothing to leave out of an average');
  assert.match(await page.$eval('#progS .ph', e => e.textContent), /^0 of 4 feedback complete/);
  // A click switches it on.
  await page.click('#fbTog');
  await page.waitForFunction(() => document.querySelector('#fbTog').getAttribute('aria-checked') === 'true');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].grade.fb), true);
  // Shift F on the next one: complete and next.
  await page.click('#nextBtn');
  await page.waitForFunction(() => window.__gs.state().cur === 1);
  await page.keyboard.down('Shift'); await page.keyboard.press('KeyF'); await page.keyboard.up('Shift');
  await page.waitForFunction(() => window.__gs.state().cur === 2);
  assert.match(await page.$eval('#progS .ph', e => e.textContent), /^2 of 4 feedback complete/);
  // F alone switches it on and stays; again switches it off.
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.__gs.state().batch.students[2].grade.fb === true);
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => !window.__gs.state().batch.students[2].grade.fb);
  // A comment with no switch is "started", a dot in the list.
  await page.type('#cmtIn', 'Add the setting.');
  await page.$eval('#cmtIn', e => e.blur());
  await page.waitForFunction(() => document.querySelectorAll('#stuList .dot').length === 1);
  assert.deepEqual(await ticks(page), ['✓Aria Testwell', '✓Bram Sample', '·Cleo Fixture', 'Dov Madeup']);
  // N goes to the next one without feedback.
  await page.evaluate(() => window.__gs.openStudent(0));
  await page.keyboard.press('KeyN');
  await page.waitForFunction(() => window.__gs.state().cur === 2);
  // Missing takes a student out of the count.
  await page.evaluate(() => window.__gs.openStudent(3));
  await page.click('[data-status="missing"]');
  await page.waitForFunction(() => /2 of 3 feedback complete/.test(document.querySelector('#progS .ph').textContent));
  assert.equal(await page.$('#fbTog'), null);
  // The gradebook's ✓ follows the switch.
  await press(page, '#bookBtn');
  await page.waitForSelector('#bkTab');
  const cells = await page.$$eval('#bkTab tbody tr', r => r.map(x => x.children[1].textContent.trim()));
  assert.deepEqual(cells, ['✓', '✓', 'started', 'missing', '2/4']);
  noErrors(page); await close();
});

test('the score panel stays as it was for other types, and changing the type switches it', async () => {
  const { page, close } = await openApp(browser, { seed: seed('ic') });
  await openCard(page);
  assert.equal(await page.$('#fbTog'), null);
  assert.match(await page.$eval('#progS .ph', e => e.textContent), /scored/);
  await page.keyboard.press('KeyF');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].grade.fb), undefined, 'F does nothing on a scored assignment');
  await page.evaluate(() => { window.__gs.state().lib.classes[0].units[0].items[0].type = 'fm'; window.__gs.openStudent(0); });
  await page.waitForSelector('#fbTog');
  noErrors(page); await close();
});

test('Add scores for a formative activity ticks Feedback complete per student', async () => {
  const { page, close } = await openApp(browser, { seed: seed('fm') });
  await classPage(page, 'c1');
  await page.waitForSelector('[data-book="c1"]'); await page.click('[data-book="c1"]');
  await page.waitForSelector('[data-bkadd]'); await page.click('[data-bkadd]');
  await page.waitForSelector('#bkaName');
  await page.type('#bkaName', 'Peer review');
  await page.click('[data-bkatype="fm"]');
  await page.waitForSelector('[data-bkafb]');
  assert.ok(await page.$eval('#bkaPaste', e => e.hidden));
  await page.click('[data-bkafb="0"]'); await page.click('[data-bkafb="2"]');
  assert.equal(await page.$eval('#bkaCount', e => e.textContent), '2 of 4 complete');
  await page.click('[data-bkasave]');
  await page.waitForFunction(() => /Peer review/.test(document.querySelector('#bkTab thead').textContent));
  const it = (await page.evaluate(() => window.__gs.state().lib)).classes[0].units.flatMap(u => u.items).find(x => x.name === 'Peer review');
  assert.equal(it.type, 'fm');
  assert.deepEqual(it.typed.s, { 'Aria Testwell': { v: null, st: '', fb: true }, 'Cleo Fixture': { v: null, st: '', fb: true } });
  // A click in the table switches one.
  const cell = '[data-bked="' + it.id + '"][data-bkn="Bram Sample"]';
  await page.click(cell);
  await page.waitForFunction(c => document.querySelector(c).textContent.includes('✓'), {}, cell);
  noErrors(page); await close();
});
