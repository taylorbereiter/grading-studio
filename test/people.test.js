// Student details on the roster: ID, email, other spellings and a note. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, score, settle } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const libOf = (names, info) => ({ classes: [{ id: 'c1', name: 'Period 1', names, units: [], ...(info ? { info } : {}) }] });
const seeded = (names, info) => openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(libOf(names, info)) } } });
const papers = async (...paths) => { const o = {}; for (const p of paths) o[p] = await makePaper({ title: p }); return zipOf(o); };
const keys = page => page.evaluate(() => window.__gs.state().batch.students.map(s => s.key));
const libNow = page => page.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));
const noErrors = page => assert.deepEqual(page.errors, []);

test('a folder with a saved spelling or the student ID goes to that roster student', async () => {
  const { page, close } = await seeded(['Ann Alpha', 'Ben Beta', 'Cy Gamma'], { 'Ben Beta': { id: '20481' }, 'Cy Gamma': { other: ['Gamma_Cyrus'] } });
  await openZip(page, await papers('Ann Alpha/Essay.pdf', 'Beta_Benjamin_20481/Essay.pdf', 'Gamma_Cyrus/Essay.pdf'));
  assert.deepEqual(await keys(page), ['Ann Alpha', 'Beta_Benjamin_20481', 'Gamma_Cyrus'], 'in roster order, with no one left over');
  noErrors(page); await close();
});

test('the ⓘ opens a card; details typed there are kept on the class', async () => {
  const { page, close } = await seeded(['Ann Alpha', 'Ben Beta']);
  await openZip(page, await papers('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf'));
  await score(page, [4, 3, 3]);
  await page.click('#stuList .stu[data-i="0"] .whob');
  await page.waitForSelector('#pcard .pc');
  assert.equal(await page.$eval('#pcard h2', e => e.textContent), 'Ann Alpha');
  await page.$eval('#pcard [data-pf="id"]', e => { e.value = ' 30 117 '; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.$eval('#pcard [data-pf="email"]', e => { e.value = 'ann@example.org'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.$eval('#pcard [data-pf="prev"]', e => { e.value = 'Standard'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => /Essay|download/i.test(document.querySelector('#pcWork').textContent) || /\d+ \/ \d+/.test(document.querySelector('#pcWork').textContent), { timeout: 20000 });
  assert.match(await page.$eval('#pcWork', e => e.textContent), /10 \/ 12/, 'this download’s score is on the card');
  const l = await libNow(page);
  assert.deepEqual(l.classes[0].info, { 'Ann Alpha': { id: '30117', email: 'ann@example.org', prev: 'Standard' } });
  await page.keyboard.press('Escape');
  assert.equal(await page.$('#pcard'), null);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students.length), 2, 'Escape only closed the card');
  await page.click('#pAvg');
  await page.waitForSelector('#ovLevels');
  assert.match(await page.$eval('#ovLevels', e => e.textContent), /Standard1/, 'Class overview has the average by last year’s level');
  noErrors(page); await close();
});

test('linking a folder the roster does not know saves its name as a spelling', async () => {
  const { page, close } = await seeded(['Ann Alpha', 'Ben Beta', 'Cy Gamma', 'Dee Delta']);
  await openZip(page, await papers('Ann Alpha/Essay.pdf', 'Cy Gamma/Essay.pdf', 'Dee Delta/Essay.pdf', 'Zz Unknown/Essay.pdf'));
  assert.deepEqual(await keys(page), ['Ann Alpha', 'Ben Beta', 'Cy Gamma', 'Dee Delta', 'Zz Unknown']);
  const i = await page.evaluate(() => window.__gs.state().batch.students.findIndex(s => s.key === 'Zz Unknown'));
  await page.click('#stuList .stu[data-i="' + i + '"] .whob');
  await page.waitForSelector('#pcard #pcLink');
  await page.select('#pcard #pcLink', 'Ben Beta');
  await page.click('#pcard [data-plink]');
  await page.waitForFunction(() => document.querySelector('#pcard h2').textContent === 'Ben Beta');
  assert.deepEqual(await keys(page), ['Ann Alpha', 'Zz Unknown', 'Cy Gamma', 'Dee Delta'], 'the folder takes Ben’s place, and his empty spot goes');
  assert.deepEqual((await libNow(page)).classes[0].info, { 'Ben Beta': { other: ['Zz Unknown'] } });
  noErrors(page); await close();
});

test('a pasted roster with ID and email columns keeps them as details, not in the name; a rename keeps them by ID', async () => {
  const { page, close } = await seeded([]);
  const out = await page.evaluate(() => {
    const G = window.__gs; return G.parseRosterRows ? G.parseRosterRows('Name\tStudent ID\tEmail\nAlpha, Ann\t20477\tann@example.org\nBen Beta\t20481\tben@example.org') : null;
  });
  if (out) assert.deepEqual(out, [{ name: 'Alpha Ann', id: '20477', email: 'ann@example.org' }, { name: 'Ben Beta', id: '20481', email: 'ben@example.org' }]);
  await page.click('[data-edit-class="0"]');
  await page.$eval('#cNames', e => { e.value = 'Alpha, Ann\t20477\tann@example.org\nBen Beta\t20481\tben@example.org'; });
  await page.click('#dlgBox [data-ok]');
  let l = await libNow(page);
  assert.deepEqual(l.classes[0].names, ['Alpha Ann', 'Ben Beta']);
  assert.deepEqual(l.classes[0].info['Ben Beta'], { id: '20481', email: 'ben@example.org' });
  await page.click('[data-edit-class="0"]');
  await page.$eval('#cNames', e => { e.value = 'Alpha, Ann\nBenjamin Beta\t20481'; });
  await page.click('#dlgBox [data-ok]');
  l = await libNow(page);
  assert.deepEqual(l.classes[0].info['Benjamin Beta'], { id: '20481', email: 'ben@example.org', other: ['Ben Beta'] });
  assert.equal(l.classes[0].info['Ben Beta'], undefined);
  await page.click('[data-people="0"]');
  await page.waitForSelector('#peopleTbl input[data-pp="email"]');
  assert.equal(await page.$eval('#peopleTbl input[data-pp="email"][data-pi="1"]', e => e.value), 'ben@example.org');
  noErrors(page); await close();
});
