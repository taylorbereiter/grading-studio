// Typing scores straight into the gradebook, as in a spreadsheet: type, Enter for the next student, Tab across, paste a column. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { classPage, openApp } = require('./helpers/app');
const { ibSeed } = require('./helpers/ibseed');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'];
const PTS = { mode: 'points', criteria: [], outOf: 20 };
const day = s => Date.parse(s + 'T12:00:00Z');
// Quiz 3 (typed, out of 10, empty), Paragraph (typed as percents, empty), Story map (formative, typed), Essay (a download out of 20 with no paper for Dov),
// and a card on the class page with nothing in it yet.
function seed() {
  const item = (id, name, more) => ({ id, name, classId: 'c1', ...more });
  const lib = {
    classes: [{ id: 'c1', name: 'Grade 9 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [
      item('i1', 'Quiz 3', { type: 'ic', due: '2026-09-10', typed: { max: 10, s: {} } }),
      item('i2', 'Paragraph', { type: 'ic', due: '2026-09-12', typed: { max: null, s: {} } }),
      item('i3', 'Story map', { type: 'fm', due: '2026-09-14', typed: { max: null, s: {} } }),
      item('i4', 'Essay', { type: 'sum', due: '2026-09-20', batchId: 'gs.b.a4' }),
      item('i5', 'Vocab quiz 4', { type: 'ic', due: '2026-09-25' }),
    ] }] }],
    loose: { id: '', units: [] }, seed2627: true,
    book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2027-01-31' }] },
  };
  const g = points => ({ f: {}, h: {}, g: { rubric: [], points, comment: '' } });
  const work = { 'gs.b.a4': { t: day('2026-09-21'), cls: 'c1', setup: PTS, s: { 'Aria Testwell': g('16'), 'Bram Sample': g('14'), 'Cleo Fixture': g('19') } } };
  const ls = { 'gs.lib': JSON.stringify(lib), 'gs.b.a4': JSON.stringify(work['gs.b.a4']) };
  const meta = [['gs.b.a4', { id: 'gs.b.a4', name: 'A download', n: 3, t: work['gs.b.a4'].t, asg: 'i4' }]];
  return { ls, idb: { 'grading-studio-keep': { version: 2, stores: { papers: [], work: [], edits: [], meta } } } };
}
async function openBook(page, tab = '#bkTab') {
  await classPage(page, 'c1');
  await page.waitForSelector('[data-book="c1"]');
  await page.click('[data-book="c1"]');
  await page.waitForSelector(tab);
}
const typed = (page, id) => page.evaluate(id => { for (const c of window.__gs.state().lib.classes) for (const u of c.units) for (const it of u.items) if (it.id === id) return it.typed; }, id);
const focused = page => page.evaluate(() => { const a = document.activeElement.closest('[data-bked]'); return a ? [a.dataset.bked, a.dataset.bkn, document.activeElement.tagName] : null; });
const cell = (page, key, n) => '#bkBody [data-bked="' + key + '"][data-bkn="' + n + '"]';
const keys = async (page, ...ks) => { for (const k of ks) { if (k.length > 1) await page.keyboard.press(k); else await page.keyboard.type(k); } };

test('a whole column is typed in with Enter between students: half points, Missing, and the cell below ready to type', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openBook(page);
  await page.focus(cell(page, 'i1', 'Aria Testwell'));
  await keys(page, '8', 'Enter', '7', '.', '5', 'Enter', 'm', 'Enter', '9', '.', '2', 'Enter');
  assert.deepEqual((await typed(page, 'i1')).s, { 'Aria Testwell': { v: 8, st: '' }, 'Bram Sample': { v: 7.5, st: '' }, 'Cleo Fixture': { v: null, st: 'missing' }, 'Dov Madeup': { v: 9, st: '' } }, '9.2 rounds to the half point');
  assert.deepEqual(await focused(page), ['i1', 'Dov Madeup', 'TD'], 'the last student keeps the keys');
  assert.equal(await page.$eval(cell(page, 'i1', 'Bram Sample'), x => x.textContent), '75%', 'the table shows each new percent');
  // Shift Enter goes back up; Tab goes across; arrows move without typing; Escape leaves a cell as it was
  await keys(page, 'ArrowUp', 'ArrowUp');
  assert.deepEqual(await focused(page), ['i1', 'Bram Sample', 'TD']);
  await keys(page, '6', 'Tab', '8', '5', 'Tab');
  assert.equal((await typed(page, 'i1')).s['Bram Sample'].v, 6);
  assert.equal((await typed(page, 'i2')).s['Bram Sample'].v, 85, 'a percent column takes the percent');
  await keys(page, 'ArrowLeft', '1', '0', 'Escape');
  assert.equal((await typed(page, 'i2')).s['Bram Sample'].v, 85, 'Escape keeps what was there');
  await keys(page, 'Delete');
  assert.equal((await typed(page, 'i2')).s['Bram Sample'], undefined, 'Delete empties the cell');
  await page.keyboard.down('Shift'); await page.keyboard.press('Enter'); await page.keyboard.up('Shift');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a column pasted from a spreadsheet fills down from the cell, a block fills across too, and one Undo takes it all back', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openBook(page);
  await page.focus(cell(page, 'i1', 'Bram Sample'));
  const paste = text => page.evaluate(text => { const dt = new DataTransfer(); dt.setData('text/plain', text); document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, text);
  await paste('7\t70\n8.5\tabc\n10\t95\n6\t50\n');
  const q = (await typed(page, 'i1')).s, p = (await typed(page, 'i2')).s;
  assert.deepEqual([q['Aria Testwell'], q['Bram Sample'].v, q['Cleo Fixture'].v, q['Dov Madeup'].v], [undefined, 7, 8.5, 10]);
  assert.deepEqual([p['Bram Sample'].v, p['Cleo Fixture'], p['Dov Madeup'].v], [70, undefined, 95], 'what isn’t a score is left as it was');
  assert.match(await page.$eval('.toast', x => x.textContent), /5 pasted, 1 left as they were.*more lines than students/);
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  await page.waitForFunction(() => { for (const c of window.__gs.state().lib.classes) for (const u of c.units) for (const it of u.items) if (it.id === 'i1') return !Object.keys(it.typed.s).length; });
  assert.deepEqual((await typed(page, 'i2')).s, {});
  assert.deepEqual(page.errors, []);
  await close();
});

test('a graded download takes a typed score only for a student with no paper; formative cells still switch feedback', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openBook(page);
  assert.equal(await page.$(cell(page, 'i4', 'Aria Testwell')), null, 'a student with a paper is changed in the paper');
  await page.focus(cell(page, 'i4', 'Dov Madeup')); await keys(page, 'Delete');
  assert.equal(await typed(page, 'i4'), undefined, 'emptying an empty cell adds nothing to the download');
  // a block pasted across keeps every column in its place: a paper's cell is passed over, never shifted onto the next column
  await page.click(cell(page, 'i2', 'Cleo Fixture'));
  await page.evaluate(text => { const dt = new DataTransfer(); dt.setData('text/plain', text); document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, '70\t15\n80\t12');
  await page.waitForFunction(() => !document.querySelector('#bkBody .bkcin'));
  assert.deepEqual((await typed(page, 'i2')).s, { 'Cleo Fixture': { v: 70, st: '' }, 'Dov Madeup': { v: 80, st: '' } }, 'pasted with the cell’s box open');
  assert.deepEqual(await typed(page, 'i4'), { max: 20, s: { 'Dov Madeup': { v: 12, st: '' } } });
  await page.focus(cell(page, 'i4', 'Dov Madeup')); await keys(page, 'Delete');
  assert.equal(await typed(page, 'i4'), undefined, 'the last typed score gone, the download has none');
  await page.click(cell(page, 'i4', 'Dov Madeup'));
  await keys(page, '1', '5', 'Enter');
  assert.deepEqual(await typed(page, 'i4'), { max: 20, s: { 'Dov Madeup': { v: 15, st: '' } } }, 'out of the download’s own 20');
  assert.equal(await page.$eval(cell(page, 'i4', 'Dov Madeup'), x => x.textContent), '75%');
  assert.doesNotMatch(await page.$eval('[data-bkcol="i4"]', x => x.textContent), /typed in/);
  await page.focus(cell(page, 'i3', 'Aria Testwell'));
  await keys(page, 'Enter', 'ArrowDown', ' ');
  assert.deepEqual((await typed(page, 'i3')).s, { 'Aria Testwell': { v: null, fb: true }, 'Bram Sample': { v: null, fb: true } });
  assert.deepEqual(page.errors, []);
  await close();
});

test('+ Add scores: a name and Enter makes the column and puts the keys on its first student; a card already on the class page takes the scores', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openBook(page);
  await page.click('[data-bkadd]');
  await page.waitForSelector('#bkaName');
  assert.deepEqual(await page.$$eval('#bkaCards option', o => o.map(x => x.value)), ['Vocab quiz 4']);
  await page.type('#bkaName', 'vocab quiz 4'); await page.keyboard.press('Enter');
  await page.waitForSelector(cell(page, 'i5', 'Aria Testwell'));
  assert.deepEqual(await focused(page), ['i5', 'Aria Testwell', 'TD']);
  await keys(page, '1', '8', 'Enter', '2', '0', 'Enter');
  assert.deepEqual(await typed(page, 'i5'), { max: 20, s: { 'Aria Testwell': { v: 18, st: '' }, 'Bram Sample': { v: 20, st: '' } } });
  assert.equal(await page.evaluate(() => window.__gs.state().lib.classes[0].units.flatMap(u => u.items).length), 5, 'no second card');
  assert.deepEqual(await page.evaluate(() => { const it = window.__gs.state().lib.classes[0].units[0].items[4]; return [it.name, it.due, it.type]; }), ['Vocab quiz 4', '2026-09-25', 'ic'], 'the card keeps its own name and date');
  assert.deepEqual(page.errors, []);
  await close();
});

test('an MYP task takes its levels typed in the table, one for each criterion in order; levels are never averaged or filled in', async () => {
  const { page, close } = await openApp(browser, { seed: ibSeed() });
  await openBook(page, '#ibTab');
  const judged = () => page.evaluate(() => JSON.stringify(window.__gs.state().lib.classes[0].lv));
  const before = await judged();
  await page.click(cell(page, 'i1', 'Bram Sample'));
  assert.equal(await page.$eval(cell(page, 'i1', 'Bram Sample') + ' input', x => x.value), '4 3');
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.keyboard.type('5 -'); await page.keyboard.press('Enter');
  assert.deepEqual((await typed(page, 'i1')).s['Bram Sample'], { l: { A: 5 }, st: '' });
  assert.deepEqual(await focused(page), ['i1', 'Cleo Fixture', 'TD']);
  await keys(page, '9', 'Enter');
  assert.deepEqual((await typed(page, 'i1')).s['Cleo Fixture'], { l: { A: 8, D: 7 } }, 'a level above 8 is refused');
  assert.match(await page.$eval('.toast', x => x.textContent), /from 0 to 8/);
  assert.equal(await judged(), before, 'the levels you judge stay yours');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a percent typed in a points column stays the percent, the points follow it, and "+ 1" is extra credit on top', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openBook(page);
  await page.focus(cell(page, 'i1', 'Aria Testwell'));
  await keys(page, '7', '3', '%', 'Enter', '8', ' ', '+', ' ', '1', 'Enter');
  assert.deepEqual((await typed(page, 'i1')).s, { 'Aria Testwell': { v: 7.3, p: 73, st: '' }, 'Bram Sample': { v: 8, st: '', xc: 1 } });
  assert.equal(await page.$eval(cell(page, 'i1', 'Aria Testwell'), x => x.textContent), '73%');
  assert.equal(await page.$eval(cell(page, 'i1', 'Bram Sample'), x => x.textContent), '90%');
  await page.click(cell(page, 'i1', 'Aria Testwell'));
  assert.equal(await page.$eval(cell(page, 'i1', 'Aria Testwell') + ' input', x => x.value), '73%');
  await keys(page, 'Escape');
  await page.$eval('[data-bkshow="pts"]', b => b.click());
  assert.equal(await page.$eval(cell(page, 'i1', 'Aria Testwell'), x => x.textContent), '7.5/10', 'shown as the half point nearest 73%');
  assert.deepEqual(page.errors, []);
  await close();
});
