// New assignment can go to several classes at once: one card per class, in each class's unit of that name,
// and the first rubric set up in one class goes to the copies that have none yet.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { classPage, openApp, answerDlg, pickFile } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

async function addClass(page, name, who) {
  await page.click('#addClass'); await page.waitForSelector('#cName');
  await page.type('#cName', name); await page.type('#cNames', who); await page.click('#dlgBox [data-ok]');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
}
const where = page => page.evaluate(() => window.__gs.state().lib.classes.filter(c => /^Test /.test(c.name)).map(c => c.name + ':' + c.units.map(u => u.name + '=' + u.items.map(i => i.name).join('+')).join('|')));

test('a new assignment goes to every ticked class, each in its unit of that name', async () => {
  const { page, close } = await openApp(browser);
  await addClass(page, 'Test A', 'Ada Moss\nBen Fry');
  await addClass(page, 'Test B', 'Cal Nye\nDee Rao');
  await addClass(page, 'Test C', 'Eve Lin');
  const ids = await page.evaluate(() => Object.fromEntries(window.__gs.state().lib.classes.map(c => [c.name, c.id])));
  await classPage(page, ids['Test A']);
  await page.click('[data-addunit="' + ids['Test A'] + '"]'); await answerDlg(page, { typed: 'Poems' });
  await page.click('[data-cls="' + ids['Test A'] + '"] [data-additem]');
  await page.waitForSelector('#aClasses');
  // the class it was started from is ticked; Save says how many classes
  assert.deepEqual(await page.$$eval('#aClasses input:checked', xs => xs.map(x => x.value)), [ids['Test A']]);
  assert.equal(await page.$eval('#dlgBox [data-ok]', b => b.textContent), 'Save');
  await page.type('#aName', 'River essay');
  await page.click('#aClasses input[value="' + ids['Test B'] + '"]');
  assert.equal(await page.$eval('#dlgBox [data-ok]', b => b.textContent), 'Add to 2 classes');
  assert.match(await page.$eval('#aUnitNote', e => e.hidden ? '' : e.textContent), /Test B has no unit called “Poems”/);
  await page.click('#dlgBox [data-ok]');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  assert.deepEqual(await where(page), ['Test A:Poems=River essay', 'Test B:Poems=River essay', 'Test C:']);
  const cards = await page.evaluate(() => window.__gs.state().lib.classes.flatMap(c => c.units.flatMap(u => u.items.map(i => ({ cls: c.name, classId: i.classId, own: c.id, group: i.group, id: i.id })))));
  assert.equal(cards.length, 2); assert.ok(cards[0].group && cards[0].group === cards[1].group, 'the copies are grouped');
  assert.notEqual(cards[0].id, cards[1].id); for (const c of cards) assert.equal(c.classId, c.own, c.cls + ' card uses its own class');
  // none ticked: Save can't be pressed
  await classPage(page, ids['Test C']);
  await page.click('[data-cls="' + ids['Test C'] + '"] [data-addunit]'); await answerDlg(page, { typed: 'Plays' });
  await page.click('[data-cls="' + ids['Test C'] + '"] [data-additem]'); await page.waitForSelector('#aClasses');
  await page.click('#aClasses input[value="' + ids['Test C'] + '"]');
  assert.ok(await page.$eval('#dlgBox [data-ok]', b => b.disabled));
  await page.click('#dlgBox [data-cancel]');
  // Edit stays one class
  await classPage(page, cards[1].id);
  await page.click('[data-edit-asg="' + cards[1].id + '"]'); await page.waitForSelector('#aClass');
  assert.equal(await page.$('#aClasses'), null);
  await page.click('#dlgBox [data-cancel]');
  // opening one copy sets its rubric, and the other copy takes it
  await classPage(page, cards[0].id);
  await page.click('[data-open-asg="' + cards[0].id + '"]');
  await page.waitForSelector('#dlgBox [data-pc]'); await page.click('#dlgBox [data-cancel]');
  const clean = await pickFile(page, '#asgIn', zip, 'River.zip');
  await page.waitForFunction(() => window.__gs.state().batch);
  await page.waitForFunction(() => window.__gs.state().lib.classes.some(c => c.units.some(u => u.items.some(i => i.group && i.setup))));
  clean();
  const sets = await page.evaluate(() => window.__gs.state().lib.classes.flatMap(c => c.units.flatMap(u => u.items.filter(i => i.group).map(i => JSON.stringify(i.setup && i.setup.criteria)))));
  assert.equal(sets.length, 2); assert.ok(sets[0] && sets[0] !== 'undefined'); assert.equal(sets[0], sets[1]);
  assert.deepEqual(page.errors, []);
  await close();
});
