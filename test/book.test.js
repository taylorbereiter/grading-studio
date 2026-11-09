// The Gradebook: every assignment for a class by term, a term grade from the teacher's own weights, typed-in scores, and charts. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp } = require('./helpers/app');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'];
const PTS = { mode: 'points', criteria: [], outOf: 20 };
const g = (points, more = {}) => ({ f: {}, h: {}, g: { rubric: [], points, comment: '', ...more } });
const day = s => Date.parse(s + 'T12:00:00Z');
// Term 1: Narrative essay (summative, a download) 80 70 95 missing; Poetry test (summative, typed out of 30) 90 70 100 60;
// Reading check (in-class, a download) 90 75 100 60; Paragraph (in-class, typed as percents) 80 70 90 excused; Story map (formative) with feedback for Aria and Cleo;
// Old quiz (a download with no type yet). Term 2: a download with no card, for this class.
function seed() {
  const item = (id, name, more) => ({ id, name, classId: 'c1', ...more });
  const lib = {
    classes: [{ id: 'c1', name: 'Grade 9 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [
      item('i1', 'Narrative essay', { type: 'sum', due: '2026-10-20', batchId: 'gs.b.a1' }),
      item('i2', 'Poetry test', { type: 'sum', due: '2026-10-29', typed: { max: 30, s: { 'Aria Testwell': { v: 27 }, 'Bram Sample': { v: 21 }, 'Cleo Fixture': { v: 30 }, 'Dov Madeup': { v: 18 } } } }),
      item('i3', 'Reading check', { type: 'ic', due: '2026-09-01', batchId: 'gs.b.a3' }),
      item('i4', 'Paragraph', { type: 'ic', due: '2026-09-12', typed: { max: null, s: { 'Aria Testwell': { v: 80 }, 'Bram Sample': { v: 70 }, 'Cleo Fixture': { v: 90 }, 'Dov Madeup': { v: null, st: 'excused' } } } }),
      item('i5', 'Story map', { type: 'fm', due: '2026-09-05', batchId: 'gs.b.a5' }),
      item('i6', 'Old quiz', { due: '2026-09-20', batchId: 'gs.b.a6' }),
    ] }] }, { id: 'c2', name: 'Grade 10 Literature', names: ['Nia Elsewhere'], units: [] }],
    loose: { id: '', units: [] }, seed2627: true,
    book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2026-10-31' }, { id: 't2', name: 'Term 2', start: '2026-11-01', end: '2027-01-31' }] },
  };
  const work = {
    'gs.b.a1': { t: day('2026-10-21'), cls: 'c1', setup: PTS, s: { 'Aria Testwell': g('16'), 'Bram Sample': g('14'), 'Cleo Fixture': g('19'), 'Dov Madeup': g('', { status: 'missing' }) } },
    'gs.b.a3': { t: day('2026-09-02'), cls: 'c1', setup: PTS, s: { 'Aria Testwell': g('18'), 'Bram Sample': g('15'), 'Cleo Fixture': g('20'), 'Dov Madeup': g('12') } },
    'gs.b.a5': { t: day('2026-09-06'), cls: 'c1', setup: PTS, s: { 'Aria Testwell': g('', { comment: 'Clear map.' }), 'Cleo Fixture': g('', { comment: 'Add the setting.' }) } },
    'gs.b.a6': { t: day('2026-09-21'), cls: 'c1', setup: PTS, s: { 'Aria Testwell': g('10'), 'Bram Sample': g('20') } },
    'gs.b.a7': { t: day('2026-11-05'), cls: 'c1', setup: PTS, s: { 'Aria Testwell': g('20') } },
  };
  const ls = { 'gs.lib': JSON.stringify(lib) };
  for (const [k, v] of Object.entries(work)) ls[k] = JSON.stringify(v);
  const meta = Object.keys(work).map(id => [id, { id, name: id === 'gs.b.a7' ? 'Week 10 quiz' : 'A download', n: 4, t: work[id].t, asg: { 'gs.b.a1': 'i1', 'gs.b.a3': 'i3', 'gs.b.a5': 'i5', 'gs.b.a6': 'i6' }[id] }]);
  return { ls, idb: { 'grading-studio-keep': { version: 2, stores: { papers: [], work: [], edits: [], meta } } } };
}
const noErrors = page => assert.deepEqual(page.errors, []);
async function openBook(page) {
  await page.waitForSelector('[data-book="c1"]');
  await page.click('[data-book="c1"]');
  await page.waitForSelector('[data-bkterm]');
  if (await page.$('[data-bkterm="t1"]')) { await page.click('[data-bkterm="t1"]'); await page.waitForFunction(() => document.querySelector('[data-bkterm="t1"]').getAttribute('aria-selected') === 'true'); }
  await page.waitForSelector('#bkTab');
}
const termCol = page => page.$$eval('#bkTab tbody tr', rs => rs.map(r => r.firstElementChild.textContent + ' ' + r.lastElementChild.textContent.trim()));
const lib = page => page.evaluate(() => window.__gs.state().lib);

test('the table groups a term’s assignments by type, averages each type, and weights them into a term grade', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openBook(page);
  assert.deepEqual(await page.$$eval('#bkTab tr.bkg th', t => t.map(x => x.textContent).filter(Boolean)), ['Summative · 50%', 'In-class · 50%', 'Formative · feedback only', 'No type yet']);
  // (80+90)/2 and (90+80)/2; (70+70)/2 and (75+70)/2; (95+100)/2 and (100+90)/2; Dov: missing and excused leave 60 and 60.
  assert.deepEqual(await termCol(page), ['Aria Testwell 85.00%', 'Bram Sample 71.25%', 'Cleo Fixture 96.25%', 'Dov Madeup 60.00%', 'Class average 78.13%']);
  const row = await page.$$eval('#bkTab tbody tr:nth-child(4) td', t => t.map(x => x.textContent.trim()));
  assert.ok(row.includes('missing') && row.includes('excused'), row.join('|'));
  // Formative: never a score. Comments with Feedback complete not switched on yet are "started".
  assert.equal(await page.$$eval('#bkTab tbody .bkfb', f => f.length), 0);
  assert.equal(await page.$$eval('#bkTab tbody .bkstart', f => f.length), 2);
  assert.match(await page.$eval('#bkTab tbody tr td.bkterm', t => t.dataset.tn), /Summative 50%: 85.00% · In-class 50%: 85.00%/);
  // Term 2 has the download with no card, and it has no type yet.
  await page.click('[data-bkterm="t2"]');
  await page.waitForFunction(() => /Week 10 quiz/.test(document.querySelector('#bkTab').textContent));
  assert.match(await page.$eval('.bknote', n => n.textContent), /no type yet/);
  await page.click('[data-bkterm="*"]');
  await page.waitForFunction(() => /Year/.test(document.querySelector('#bkTab thead').textContent));
  assert.deepEqual(await termCol(page), ['Aria Testwell 85.00%', 'Bram Sample 71.25%', 'Cleo Fixture 96.25%', 'Dov Madeup 60.00%', 'Class average 78.13%']);
  noErrors(page); await close();
});

test('a type can be set on assignments that already exist, from the one-time list, a column, or Edit assignment', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openBook(page);
  await page.click('[data-bktypes]');
  await page.waitForSelector('[data-bkqtype]');
  assert.deepEqual(await page.$$eval('.bktyrow b', b => b.map(x => x.textContent)), ['Old quiz', 'Week 10 quiz']);
  await page.click('[data-key="i6"][data-bkqtype="ic"]');
  await page.click('[data-key^="dl:"][data-bkqtype="sum"]');
  await page.click('[data-bkback]');
  await page.waitForSelector('#bkTab');
  assert.equal(await page.$('.bknote'), null);
  // Aria's in-class: (90 + 80 + 50) / 3 = 73.33, so (85 + 73.33) / 2.
  assert.equal((await termCol(page))[0], 'Aria Testwell 79.17%');
  let l = await lib(page);
  assert.equal(l.classes[0].units[0].items.find(x => x.id === 'i6').type, 'ic');
  assert.equal(l.book.dl['gs.b.a7'].type, 'sum', 'a download with no card keeps its type in the gradebook’s own list');
  // From a column: Paragraph becomes formative, so it stops counting.
  await page.click('[data-bkcol="i4"]');
  await page.waitForSelector('#bkPop');
  await page.click('[data-bksettype="fm"]');
  await page.click('[data-bkpopclose]');
  await page.waitForFunction(() => !document.querySelector('#bkPop'));
  assert.equal((await termCol(page))[0], 'Aria Testwell 77.50%', '(85 + (90 + 50) / 2) / 2');
  // Moved to Term 2 by hand, it leaves Term 1.
  await page.click('[data-bkcol="i1"]');
  await page.waitForSelector('#bkTerm');
  await page.select('#bkTerm', 't2');
  await page.click('[data-bkpopclose]');
  await page.waitForFunction(() => !/Narrative essay/.test(document.querySelector('#bkTab thead').textContent));
  await page.click('[data-close]');
  // Edit assignment on the start screen.
  await page.click('[data-edit-asg="i3"]');
  await page.waitForSelector('[data-atype="sum"]');
  assert.equal(await page.$eval('[data-atype="ic"]', b => b.getAttribute('aria-pressed')), 'true');
  await page.click('[data-atype="sum"]');
  await page.$eval('#aDue', e => { e.value = '2026-09-03'; });
  await page.click('[data-ok]');
  l = await lib(page);
  const it = l.classes[0].units[0].items.find(x => x.id === 'i3');
  assert.equal(it.type, 'sum'); assert.equal(it.due, '2026-09-03');
  assert.match(await page.$eval('[data-card="i3"]', c => c.textContent), /Summative/);
  // A new assignment for two classes at once: both copies get the type and date.
  await page.click('[data-additem="u1"]');
  await page.waitForSelector('#aClasses');
  await page.type('#aName', 'Shared essay');
  await page.click('#aClasses input[value="c2"]');
  await page.click('[data-atype="sum"]');
  await page.$eval('#aDue', e => { e.value = '2026-10-15'; });
  await page.click('[data-ok]');
  const copies = [];
  for (const c of (await lib(page)).classes) for (const u of c.units) for (const x of u.items) if (x.name === 'Shared essay') copies.push(c.id + ':' + x.type + ':' + x.due);
  assert.deepEqual(copies.sort(), ['c1:sum:2026-10-15', 'c2:sum:2026-10-15']);
  noErrors(page); await close();
});

test('scores for past work go in by typing or pasting, become a card, and can be changed in the table', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openBook(page);
  await page.click('[data-bkadd]');
  await page.waitForSelector('#bkaName');
  await page.type('#bkaName', 'Vocab quiz');
  await page.$eval('#bkaDue', e => { e.value = '2026-09-26'; });
  await page.evaluate(() => { const t = document.querySelector('#bkaPaste'), dt = new DataTransfer(); dt.setData('text/plain', '17\n15.5\nmissing\n20\n'); t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  assert.deepEqual(await page.$$eval('#bkaRows tr', r => r.map(x => x.children[2].textContent)), ['85%', '78%', '', '100%'], 'out of 20, halves rounding up');
  assert.equal(await page.$eval('#bkaCount', e => e.textContent), '4 of 4 entered');
  await page.click('[data-bkasave]');
  await page.waitForFunction(() => /Vocab quiz/.test(document.querySelector('#bkTab thead').textContent));
  const l = await lib(page), it = l.classes[0].units[0].items.find(x => x.name === 'Vocab quiz');
  assert.equal(it.type, 'ic'); assert.equal(it.due, '2026-09-26');
  assert.deepEqual(it.typed, { max: 20, s: { 'Aria Testwell': { v: 17, st: '' }, 'Bram Sample': { v: 15.5, st: '' }, 'Cleo Fixture': { v: null, st: 'missing' }, 'Dov Madeup': { v: 20, st: '' } } });
  // Aria's in-class is now (90 + 80 + 85) / 3 = 85, so still 85.
  assert.equal((await termCol(page))[0], 'Aria Testwell 85.00%');
  // Names with scores, matched by the roster.
  await page.click('[data-bkadd]');
  await page.waitForSelector('#bkaName');
  await page.type('#bkaName', 'Exit ticket');
  await page.evaluate(() => { const t = document.querySelector('#bkaPaste'), dt = new DataTransfer(); dt.setData('text/plain', 'Cleo Fixture\t12\nAria Testwell\t9\nZed Nobody\t4'); t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  assert.match(await page.$eval('#bkaPasteNote', e => e.textContent), /Zed Nobody/);
  assert.deepEqual(await page.$$eval('#bkaRows .bksc', i => i.map(x => x.value)), ['9', '', '12', '']);
  await page.click('[data-bkback]');
  // A typed-in cell changes right in the table.
  const cell = '[data-bked="i2"][data-bkn="Bram Sample"]';
  await page.click(cell);
  await page.waitForSelector(cell + ' input');
  await page.$eval(cell + ' input', i => { i.value = ''; });
  await page.type(cell + ' input', '24');
  await page.keyboard.press('Enter');
  await page.waitForFunction(c => /80%/.test(document.querySelector(c).textContent), {}, cell);
  assert.equal((await lib(page)).classes[0].units[0].items.find(x => x.id === 'i2').typed.s['Bram Sample'].v, 24);
  // The card shows on the start screen as typed in.
  await page.click('[data-close]');
  assert.match(await page.$eval('[data-card="' + it.id + '"]', c => c.textContent), /In-class.*Typed in/);
  noErrors(page); await close();
});

test('term setup comes from the teacher’s own settings, and the charts and one-student view draw from the same numbers', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openBook(page);
  await page.click('[data-bksetup]');
  await page.waitForSelector('#bkSetup');
  assert.equal(await page.$$eval('#bkTerms .bktrow', r => r.length), 2);
  await page.$eval('[data-wt="sum"]', i => { i.value = '60'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('[data-wt="ic"]', i => { i.value = '40'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(await page.$eval('#bkWsum', e => e.textContent), 'These add up to 100%.');
  await page.click('[data-bksavesetup]');
  await page.waitForSelector('#bkTab');
  assert.deepEqual((await lib(page)).book.w, { sum: 60, ic: 40, fm: 0 });
  assert.equal((await termCol(page))[0], 'Aria Testwell 85.00%');
  assert.equal((await termCol(page))[1], 'Bram Sample 71.00%', '70 × 60% + 72.5 × 40%');
  // A term with no end date isn't saved.
  await page.click('[data-bksetup]');
  await page.waitForSelector('#bkSetup');
  await page.click('[data-taddt]');
  await page.click('[data-bksavesetup]');
  assert.ok(await page.$('#bkSetup'), 'stays open to fix it');
  await page.click('[data-bkback]');
  await page.waitForSelector('#bkTab');
  // Class charts.
  await page.click('[data-bktab="class"]');
  await page.waitForSelector('#bkTiles');
  assert.match(await page.$eval('#bkTiles', t => t.textContent), /Term average/);
  assert.deepEqual(await page.$$eval('#bkBands .pband', b => b.map(x => x.querySelector('span').textContent + ':' + x.querySelector('.pbn b').textContent)), ['90 to 100:1', '80 to 89:1', '70 to 79:1', '60 to 69:1', 'Below 60:0']);
  assert.deepEqual(await page.$$eval('#bkTrend .bkdot', d => d.map(x => x.dataset.tl)), ['Reading check', 'Paragraph', 'Narrative essay', 'Poetry test'], 'in date order, scored types only');
  assert.equal(await page.$$eval('#bkSpread .bkiqr', r => r.length), 4);
  assert.match(await page.$eval('#bkCmp', t => t.textContent), /Grade 9 English/);
  // One student, with the arrow keys.
  await page.click('[data-bktab="one"]');
  await page.waitForSelector('#bkStuTiles');
  assert.equal(await page.$eval('#bkStuName', e => e.textContent), 'Aria Testwell');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('#bkStuName').textContent === 'Bram Sample');
  assert.match(await page.$eval('#bkStuTiles', t => t.textContent), /71.00%/);
  noErrors(page); await close();
});

test('with no terms set up everything is one year', async () => {
  const s = seed(), l = JSON.parse(s.ls['gs.lib']); delete l.book; s.ls['gs.lib'] = JSON.stringify(l);
  const { page, close } = await openApp(browser, { seed: s });
  await openBook(page);
  assert.deepEqual(await page.$$eval('[data-bkterm]', b => b.map(x => x.textContent)), ['This year']);
  assert.match(await page.$eval('#bkTab thead', t => t.textContent), /Week 10 quiz/);
  noErrors(page); await close();
});
