// The gradebook's types are the teacher's own: their order, their names, and types they add. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { classPage, openApp, pick } = require('./helpers/app');

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
function seed(book = {}, more = []) {
  const item = (id, name, more) => ({ id, name, classId: 'c1', ...more });
  const lib = {
    classes: [{ id: 'c1', name: 'Grade 9 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [
      item('i1', 'Narrative essay', { type: 'sum', due: '2026-10-20', batchId: 'gs.b.a1' }),
      item('i2', 'Poetry test', { type: 'sum', due: '2026-10-29', typed: { max: 30, s: { 'Aria Testwell': { v: 27 }, 'Bram Sample': { v: 21 }, 'Cleo Fixture': { v: 30 }, 'Dov Madeup': { v: 18 } } } }),
      item('i3', 'Reading check', { type: 'ic', due: '2026-09-01', batchId: 'gs.b.a3' }),
      item('i4', 'Paragraph', { type: 'ic', due: '2026-09-12', typed: { max: null, s: { 'Aria Testwell': { v: 80 }, 'Bram Sample': { v: 70 }, 'Cleo Fixture': { v: 90 }, 'Dov Madeup': { v: null, st: 'excused' } } } }),
      item('i5', 'Story map', { type: 'fm', due: '2026-09-05', batchId: 'gs.b.a5' }),
      item('i6', 'Old quiz', { due: '2026-09-20', batchId: 'gs.b.a6' }), ...more.map(m => item(...m)),
    ] }] }, { id: 'c2', name: 'Grade 10 Literature', names: ['Nia Elsewhere'], units: [] }],
    loose: { id: '', units: [] }, seed2627: true,
    book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2026-10-31' }, { id: 't2', name: 'Term 2', start: '2026-11-01', end: '2027-01-31' }], ...book },
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
  await classPage(page, 'c1');
  await page.waitForSelector('[data-book="c1"]');
  await page.click('[data-book="c1"]');
  await page.waitForSelector('[data-bkterm]');
  if (await page.$('[data-bkterm="t1"]')) { await page.click('[data-bkterm="t1"]'); await page.waitForFunction(() => document.querySelector('[data-bkterm="t1"]').getAttribute('aria-selected') === 'true'); }
  await page.waitForSelector('#bkTab');
}
const termCol = page => page.$$eval('#bkTab tbody tr', rs => rs.map(r => r.firstElementChild.textContent + ' ' + r.lastElementChild.textContent.trim()));
const lib = page => page.evaluate(() => window.__gs.state().lib);

const groups = page => page.$$eval('#bkTab tr.bkg th', t => t.map(x => x.textContent).filter(Boolean));
const heads = page => page.$$eval('#bkTab thead tr:last-child th.bksum', t => t.map(x => x.firstChild.textContent));
const setup = async page => { await pick(page, '[data-bksetup]'); await page.waitForSelector('#bkSetup'); };
const save = async page => { await page.click('[data-bksavesetup]'); await page.waitForSelector('#bkTab'); };
const rows = page => page.$$eval('#bkCats .bkcrow', r => r.map(x => x.querySelector('[data-cname]').value));
const type = (page, sel, v) => page.$eval(sel, (i, v) => { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, v);

test('in-class is on the left and summative on the right, and a teacher can put the types in their own order', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openBook(page);
  assert.deepEqual(await groups(page), ['In-class · 50%', 'Summative · 50%', 'Formative · feedback only', 'No type yet', 'Term 1']);
  assert.deepEqual(await heads(page), ['In-class', 'Summative', 'Term grade']);
  const before = await termCol(page);
  await setup(page);
  assert.deepEqual(await rows(page), ['In-class', 'Summative', 'Formative']);
  assert.equal(await page.$eval('#bkCats .bkcrow [data-cup]', b => b.disabled), true, 'the first one can’t go higher');
  await page.click('#bkCats .bkcrow[data-cid="sum"] [data-cup]');
  assert.deepEqual(await rows(page), ['Summative', 'In-class', 'Formative']);
  await save(page);
  assert.deepEqual((await lib(page)).book.cats, [{ id: 'sum' }, { id: 'ic' }, { id: 'fm' }]);
  assert.deepEqual(await groups(page), ['Summative · 50%', 'In-class · 50%', 'Formative · feedback only', 'No type yet', 'Term 1']);
  assert.deepEqual(await heads(page), ['Summative', 'In-class', 'Term grade']);
  assert.deepEqual(await termCol(page), before, 'the order changes no grade');
  // The pickers follow the same order.
  await page.click('[data-bkcol="i4"]');
  assert.deepEqual(await page.$$eval('[data-bksettype]', b => b.map(x => x.textContent)), ['Summative', 'In-class', 'Formative']);
  await page.click('[data-bkpopclose]');
  // Back in the usual order, no list is kept at all.
  await setup(page);
  await page.click('#bkCats .bkcrow[data-cid="sum"] [data-cdn]');
  await save(page);
  assert.equal('cats' in JSON.parse(await page.evaluate(() => localStorage.getItem('gs.lib'))).book, false);
  assert.deepEqual(await heads(page), ['In-class', 'Summative', 'Term grade']);
  noErrors(page); await close();
});

test('a teacher adds a type of their own with its own weight, renames one, and the grade follows', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openBook(page);
  await setup(page);
  await page.click('[data-cadd]');
  assert.equal(await page.evaluate(() => document.activeElement.matches('#bkCats .bkcrow:last-child [data-cname]')), true);
  // No name yet: it isn't saved, and she is told why.
  await page.click('[data-bksavesetup]');
  await page.waitForFunction(() => /Give every type a name/.test(document.body.textContent));
  await type(page, '#bkCats .bkcrow:last-child [data-cname]', 'In-class');
  await page.click('[data-bksavesetup]');
  await page.waitForFunction(() => /Two types are called/.test(document.body.textContent));
  await type(page, '#bkCats .bkcrow:last-child [data-cname]', 'Homework');
  await type(page, '#bkCats .bkcrow:last-child [data-wt]', '20');
  await type(page, '[data-wt="ic"]', '30');
  await type(page, '#bkCats .bkcrow[data-cid="ic"] [data-cname]', 'Classwork');
  assert.equal(await page.$eval('#bkWsum', e => e.textContent), 'These add up to 100%.');
  await save(page);
  const book = (await lib(page)).book, hw = book.cats[3].id;
  assert.deepEqual(book.cats, [{ id: 'ic', name: 'Classwork' }, { id: 'sum' }, { id: 'fm' }, { id: hw, name: 'Homework', k: 1 }]);
  assert.deepEqual(book.w, { ic: 30, sum: 50, fm: 0, [hw]: 20 });
  assert.deepEqual(await groups(page), ['Classwork · 30%', 'Summative · 50%', 'Formative · feedback only', 'No type yet', 'Term 1']);
  assert.equal((await termCol(page))[0], 'Aria Testwell 85.00%', 'Homework has nothing in it yet, so the other two are used');
  // Old quiz becomes Homework: Aria 10 of 20.
  await page.click('[data-bkcol="i6"]');
  assert.deepEqual(await page.$$eval('[data-bksettype]', b => b.map(x => x.textContent)), ['Classwork', 'Summative', 'Formative', 'Homework']);
  await page.click('[data-bksettype="' + hw + '"]'); await page.click('[data-bkpopclose]');
  await page.waitForFunction(() => /Homework · 20%/.test(document.querySelector('#bkTab tr.bkg').textContent));
  assert.deepEqual(await groups(page), ['Classwork · 30%', 'Summative · 50%', 'Formative · feedback only', 'Homework · 20%', 'Term 1']);
  assert.deepEqual(await heads(page), ['Classwork', 'Summative', 'Homework', 'Term grade']);
  assert.equal((await termCol(page))[0], 'Aria Testwell 78.00%', '85 × 30% + 85 × 50% + 50 × 20%');
  assert.match(await page.$eval('#bkTab tbody tr td.bkterm', t => t.dataset.tn), /Classwork 30%: 85.00% · Summative 50%: 85.00% · Homework 20%: 50.00%/);
  assert.equal((await lib(page)).classes[0].units[0].items.find(x => x.id === 'i6').type, hw);
  assert.equal((await lib(page)).classes[0].units[0].items.find(x => x.id === 'i3').type, 'ic', 'a renamed type keeps its assignments');
  // A type with an assignment in it can't be removed; one with none can.
  await setup(page);
  assert.equal(await page.$eval('#bkCats .bkcrow:last-child [data-cdel]', b => b.disabled), true);
  assert.match(await page.$eval('#bkCats .bkcrow:last-child [data-cdel]', b => b.title), /1 assignment is in this type/);
  await page.click('[data-cadd]');
  await type(page, '#bkCats .bkcrow:last-child [data-cname]', 'Projects');
  assert.equal(await page.$eval('#bkCats .bkcrow:last-child', r => r.dataset.ck), '2', 'the next colour');
  await page.click('#bkCats .bkcrow:last-child [data-cdel]');
  assert.deepEqual(await rows(page), ['Classwork', 'Summative', 'Formative', 'Homework']);
  await page.click('[data-bkback]'); await page.waitForSelector('#bkTab');
  // It is there after a reload, on the card and in the New assignment box.
  await page.reloadHere();
  await page.waitForSelector('#bkTab');
  assert.deepEqual(await heads(page), ['Classwork', 'Summative', 'Homework', 'Term grade']);
  await page.click('[data-ctab=""]');
  await page.waitForSelector('[data-card="i6"]');
  assert.match(await page.$eval('[data-card="i6"]', c => c.textContent), /Homework/);
  assert.match(await page.$eval('[data-card="i6"] .bkpill', c => c.className), /kc k1/);
  assert.match(await page.$eval('[data-card="i3"]', c => c.textContent), /Classwork/);
  noErrors(page); await close();
});

test('a teacher with only their own types gets a grade, and a type that was removed reads as no type yet', async () => {
  const cats = [{ id: 'cq', name: 'Quizzes', k: 1 }, { id: 'ct', name: 'Tests', k: 2 }];
  const more = [['i7', 'Quiz 1', { type: 'cq', due: '2026-09-08', typed: { max: 10, s: { 'Aria Testwell': { v: 8 }, 'Bram Sample': { v: 6 } } } }],
    ['i8', 'Unit test', { type: 'ct', due: '2026-10-01', typed: { max: null, s: { 'Aria Testwell': { v: 90 }, 'Bram Sample': { v: 70 } } } }],
    ['i9', 'Bonus round', { type: 'xc', xcTo: 'ic', due: '2026-10-02', typed: { max: null, s: { 'Aria Testwell': { v: 2 } } } }]];
  const s = seed({ cats, w: { cq: 25, ct: 75 } }, more), was = JSON.parse(s.ls['gs.lib']);
  const { page, close } = await openApp(browser, { seed: s });
  await openBook(page);
  assert.deepEqual(await groups(page), ['Quizzes · 25%', 'Tests · 75%', 'Extra credit · points on top', 'No type yet', 'Term 1']);
  assert.deepEqual(await heads(page), ['Quizzes', 'Tests', 'Term grade']);
  // Aria: 80 × 25% + 90 × 75% = 87.5, and 2 extra credit points go on the grade because there is no in-class type to add them to.
  assert.equal((await termCol(page))[0], 'Aria Testwell 89.50% +xc');
  assert.equal((await termCol(page))[1], 'Bram Sample 67.50%');
  assert.equal(await page.$$eval('#bkTab thead tr:last-child th.bkch', t => t.length), 9, 'the assignments of the types that are gone are still listed');
  // The charts and one student draw without the usual types.
  await pick(page, '[data-ctab="charts"]'); await page.waitForSelector('#bkHeat');
  assert.equal(await page.$('#bkScatter'), null, 'summatives against in-class has nothing to compare');
  assert.match(await page.$eval('#bkTiles', e => e.textContent), /Quizzes average.*Tests average/);
  await page.click('[data-ctab="students"]'); await page.waitForSelector('#peopleTbl table');
  await page.click('#peopleTbl td.nm a'); await page.waitForSelector('#bkStuName');
  assert.match(await page.$eval('#bkStuTiles', e => e.textContent), /Quizzes average80\.00%.*Tests average90\.00%/);
  // Term setup offers the usual three back, and extra credit has only the grade to add to.
  await page.click('[data-ctab="gradebook"]'); await page.waitForSelector('#bkTab');
  await setup(page);
  assert.deepEqual(await rows(page), ['Quizzes', 'Tests']);
  assert.deepEqual(await page.$$eval('[data-cback]', b => b.map(x => x.textContent)), ['In-class', 'Summative', 'Formative']);
  assert.deepEqual(await page.$$eval('[data-bkxcto]', b => b.map(x => x.textContent)), ['The term grade']);
  await page.click('[data-cback="sum"]');
  assert.deepEqual(await rows(page), ['Quizzes', 'Tests', 'Summative']);
  assert.equal(await page.$eval('#bkCats .bkcrow[data-cid="sum"] [data-cdel]', b => b.disabled), true, 'two assignments are still summatives');
  await page.click('[data-bkback]'); await page.waitForSelector('#bkTab');
  // Nothing on any assignment was changed by reading it this way.
  assert.deepEqual((await lib(page)).classes[0].units, was.classes[0].units);
  noErrors(page); await close();
});

test('the New assignment box and Add scores offer the teacher’s own types', async () => {
  const cats = [{ id: 'sum', name: 'Exams' }, { id: 'ic' }, { id: 'cp', name: 'Projects', k: 3 }];
  const { page, close } = await openApp(browser, { seed: seed({ cats, w: { sum: 40, ic: 40, cp: 20 } }) });
  await openBook(page);
  await page.click('[data-bkadd]'); await page.waitForSelector('#bkAdd');
  assert.deepEqual(await page.$$eval('[data-bkatype]', b => b.map(x => x.textContent)), ['Exams', 'In-class', 'Projects', 'Extra credit']);
  await page.click('[data-bkatype="cp"]');
  await type(page, '#bkaName', 'Poster');
  await page.$eval('#bkaDue', i => { i.value = '2026-10-05'; });
  await type(page, '[data-bkai="0"]', '15');
  await page.click('[data-bkasave]'); await page.waitForSelector('#bkTab');
  assert.deepEqual(await groups(page), ['Exams · 40%', 'In-class · 40%', 'Projects · 20%', 'No type yet', 'Term 1']);
  assert.equal((await termCol(page))[0], 'Aria Testwell 83.00%', '85 × 40% + 85 × 40% + 75 × 20%');
  const it = (await lib(page)).classes[0].units[0].items.find(x => x.name === 'Poster');
  assert.equal(it.type, 'cp');
  noErrors(page); await close();
});
