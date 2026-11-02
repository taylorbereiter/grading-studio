// One student's file, picked or dropped later, goes into the download she already has, onto a student already in the list. Nobody new is ever made from a file name. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, pickFile, settle, waitPaper } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

const NAMES = ['Ann Alpha', 'Ben Beta', 'Cara Cole', 'Dev Dunn', 'Eli Eck'];
let browser, paper;
before(async () => { browser = await launch(); paper = await makePaper({ title: 'A paper' }); });
after(async () => { await browser.close(); });

const lib = JSON.stringify({ classes: [{ id: 'c1', name: '9A', names: NAMES, units: [{ id: 'u1', name: 'Rivers', items: [{ id: 'asg1', classId: 'c1', name: 'River card' }] }] }], loose: { id: '', units: [] } });
// The whole class's download, opened from the card, minus Ben, who turned his in late.
async function openCard() {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': lib } } });
  await page.evaluate(() => [...document.querySelectorAll('.card')].find(x => x.textContent.includes('River card')).querySelector('[data-open-asg]').click());
  await page.waitForSelector('#dlgBox [data-cancel]'); await page.click('#dlgBox [data-cancel]');
  const files = {}; for (const n of NAMES) if (n !== 'Ben Beta') files[n + '/Essay.pdf'] = paper;
  const clean = await pickFile(page, '#asgIn', zipOf(files), 'River.zip');
  await waitPaper(page); clean();
  await page.waitForFunction(() => { const m = [...window.__gs.kept().values()][0]; return m && m.papers; }, { timeout: 30000 });
  await settle(page);
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await page.click('#closeBtn'); await page.waitForFunction(() => !document.querySelector('#start').hidden);
  return { page, close, id };
}
const keys = page => page.evaluate(() => window.__gs.state().batch.students.map(s => s.key));
const options = page => page.$$eval('#dlgBox select[data-row="0"] option', o => o.map(x => x.value + ':' + x.textContent));

test('one file picked for an assignment that has its download goes onto a roster student, never a new one', async () => {
  const { page, close, id } = await openCard();
  await page.evaluate(() => [...document.querySelectorAll('.card')].find(x => x.textContent.includes('River card')).querySelector('[data-open-asg]').click());
  await page.waitForSelector('#dlgBox [data-cancel]'); await page.click('#dlgBox [data-cancel]');
  const clean = await pickFile(page, '#asgIn', await makePaper({ title: 'Late one' }), 'scan_0042.pdf');
  await page.waitForSelector('#dlgBox [data-go]', { timeout: 30000 });
  assert.equal(await page.evaluate(() => window.__gs.state().batch.id), id, 'it opened the download she already has');
  const opts = await options(page);
  assert.ok(!opts.some(o => /New student/.test(o)), 'no way to make a new student: ' + opts.join(' | '));
  for (const n of NAMES) assert.ok(opts.some(o => o.includes(n)), n + ' is offered');
  assert.match(await page.$eval('#dlgBox', e => e.textContent), /nobody new is added/);
  const ben = await page.evaluate(() => window.__gs.state().batch.students.findIndex(s => s.key === 'Ben Beta'));
  await page.select('#dlgBox select[data-row="0"]', String(ben));
  await page.click('#dlgBox [data-go]');
  await page.waitForFunction(() => window.__gs.state().batch.students.find(s => s.key === 'Ben Beta').files.length === 1, { timeout: 30000 });
  assert.deepEqual((await keys(page)).sort(), [...NAMES].sort(), 'still just the roster');
  assert.equal(await page.evaluate(() => window.__gs.state().lib.classes[0].units[0].items[0].batchId), id, 'the card keeps its download');
  assert.deepEqual(page.errors, []);
  clean(); await close();
});

test('a file dropped on the start screen asks which assignment, then matches the name to the roster', async () => {
  const { page, close, id } = await openCard();
  const clean = await pickFile(page, '#fileIn', paper, 'Ben Beta - late essay.pdf');
  await page.waitForSelector('#dlgBox [data-into]', { timeout: 30000 });
  assert.match(await page.$eval('#dlgBox', e => e.textContent), /River card/);
  await page.click('#dlgBox [data-into]');
  await page.waitForSelector('#dlgBox [data-go]', { timeout: 30000 });
  assert.equal(await page.evaluate(() => window.__gs.state().batch.id), id);
  assert.match(await page.$eval('#dlgBox [data-tag="0"]', e => e.textContent), /Matched by name/);
  await page.click('#dlgBox [data-go]');
  await page.waitForFunction(() => window.__gs.state().batch.students.find(s => s.key === 'Ben Beta').files.length === 1, { timeout: 30000 });
  assert.deepEqual((await keys(page)).sort(), [...NAMES].sort());
  assert.deepEqual(page.errors, []);
  clean(); await close();
});

test('Open it on its own still opens a single file the old way', async () => {
  const { page, close, id } = await openCard();
  const clean = await pickFile(page, '#fileIn', paper, 'Something else.pdf');
  await page.waitForSelector('#dlgBox [data-own]', { timeout: 30000 });
  await page.click('#dlgBox [data-own]');
  await waitPaper(page); clean();
  assert.notEqual(await page.evaluate(() => window.__gs.state().batch.id), id);
  await close();
});

test('the name in the top corner goes back to the start screen', async () => {
  const { page, close } = await openApp(browser);
  const clean = await pickFile(page, '#fileIn', zipOf({ 'Ann Alpha/Essay.pdf': paper, 'Ben Beta/Essay.pdf': paper }), 'Corner.zip');
  await waitPaper(page); clean();
  await page.click('#homeBtn');
  await page.waitForFunction(() => !document.querySelector('#start').hidden && !window.__gs.state().batch);
  assert.deepEqual(page.errors, []);
  await close();
});
