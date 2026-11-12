// Extra credit: points on top of one paper's score, and extra credit entries in the gradebook with no paper behind them (a Kahoot, say).
// Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goToStudent, score, classPage, pick } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });
const noErrors = page => assert.deepEqual(page.errors, []);

test('extra credit on one paper goes on top of the score, read on the scale first, and can take it over 100%', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'River essay.zip');
  await score(page, [4, 3.5, 3]);   // 10.5 of 12 = 93% on the scale
  assert.equal(await page.$('#xcIn'), null, 'nothing shows until it is asked for');
  await pick(page, '[data-gxc]');
  await page.waitForSelector('#xcIn');
  await page.type('#xcIn', '1');
  await page.waitForFunction(() => /11\.5/.test(document.querySelector('#grade .total').textContent));
  assert.match(await page.$eval('#grade .total', e => e.textContent), /11\.5\/ 12101%/);
  assert.match(await page.$eval('#grade .total', e => e.textContent), /10\.5 earned \+ 1 extra credit/);
  const g = await page.evaluate(() => { const G = window.__gs, s = G.state().batch.students[0]; return { g: G.gradeOf(s), xc: s.grade.xc }; });
  assert.equal(g.xc, 1);
  assert.equal(g.g.total, 11.5); assert.equal(g.g.pct, 101, '93% + 1/12 of 100'); assert.equal(g.g.base, 10.5);
  // It stays with the paper: away and back, then Remove takes it off.
  await goToStudent(page, 1); await goToStudent(page, 0);
  assert.equal(await page.$eval('#xcIn', i => i.value), '1');
  await page.click('[data-xcoff]');
  await page.waitForFunction(() => !document.querySelector('#xcIn'));
  const after = await page.evaluate(() => { const G = window.__gs, s = G.state().batch.students[0]; return { g: G.gradeOf(s), xc: s.grade.xc }; });
  assert.equal(after.xc, undefined); assert.equal(after.g.total, 10.5); assert.equal(after.g.pct, 93);
  // As a percent instead: 5 percentage points on the paper's 93%, and the total grows by 5% of 12.
  await pick(page, '[data-gxc]'); await page.waitForSelector('#xcIn');
  await page.click('[data-xcu="pct"]');
  await page.type('#xcIn', '5');
  await page.waitForFunction(() => /98%/.test(document.querySelector('#grade .total').textContent));
  const pc = await page.evaluate(() => { const G = window.__gs, s = G.state().batch.students[0]; return { g: G.gradeOf(s), xc: s.grade.xc, u: s.grade.xcU }; });
  assert.deepEqual([pc.xc, pc.u, pc.g.pct, pc.g.total], [5, 'pct', 98, 11.1]);
  assert.match(await page.$eval('#grade .total', e => e.textContent), /10\.5 earned \+ 5% extra credit/);
  // Back to points: the 5 now means 5 points.
  await page.click('[data-xcu="pts"]');
  assert.equal(await page.evaluate(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).total), 15.5);
  await page.click('[data-xcoff]');
  // Saved work read back (the gradebook, Today, past work) adds it the same way: 18/20 = 90%, plus 3 extra is 105%.
  const past = await page.evaluate(() => window.__gs.pastScore({ mode: 'points', criteria: [], outOf: 20 }, { points: '18', xc: 3 }));
  assert.equal(past.total, 21); assert.equal(past.pct, 105); assert.equal(past.base, 18);
  const pastPct = await page.evaluate(() => window.__gs.pastScore({ mode: 'points', criteria: [], outOf: 20 }, { points: '18', xc: 4, xcU: 'pct' }));
  assert.equal(pastPct.pct, 94); assert.equal(pastPct.total, 18.8);
  noErrors(page); await close();
});

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'];
function seed(book = {}) {
  const lib = {
    classes: [{ id: 'c1', name: 'Grade 9 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [
      { id: 'i1', name: 'Poetry test', classId: 'c1', type: 'sum', due: '2026-10-01', typed: { max: 20, s: { 'Aria Testwell': { v: 16 }, 'Bram Sample': { v: 14 }, 'Cleo Fixture': { v: 20 }, 'Dov Madeup': { v: 12 } } } },
      { id: 'i2', name: 'Reading check', classId: 'c1', type: 'ic', due: '2026-10-02', typed: { max: null, s: { 'Aria Testwell': { v: 80 }, 'Bram Sample': { v: 70 }, 'Cleo Fixture': { v: 100 }, 'Dov Madeup': { v: 60 } } } },
    ] }] }],
    loose: { id: '', units: [] }, seed2627: true,
    book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2026-12-20' }], ...book },
  };
  return { ls: { 'gs.lib': JSON.stringify(lib) } };
}
async function openBook(page) {
  await classPage(page, 'c1');
  await page.waitForSelector('[data-book="c1"]');
  await page.click('[data-book="c1"]');
  await page.waitForSelector('#bkTab');
}
const termCol = page => page.$$eval('#bkTab tbody tr', rs => rs.map(r => r.firstElementChild.textContent + ' ' + r.lastElementChild.textContent.trim()));

test('an extra credit entry gives points to some or all students, adds them to the term grade, and keeps it at 100% by default', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openBook(page);
  // Before: (80+80)/2, (70+70)/2, (100+100)/2, (60+60)/2.
  assert.deepEqual(await termCol(page), ['Aria Testwell 80.00%', 'Bram Sample 70.00%', 'Cleo Fixture 100.00%', 'Dov Madeup 60.00%', 'Class average 77.50%']);
  await page.click('[data-bkaddxc]');
  await page.waitForSelector('#bkAdd');
  assert.equal(await page.$eval('[data-bkatype="xc"]', b => b.getAttribute('aria-pressed')), 'true');
  assert.equal(await page.$eval('.bkso', e => e.closest('.bkpf').hidden), true, 'no "out of" for extra credit');
  await page.type('#bkaName', 'Kahoot review');
  // Two points for everyone, then three for one student typed by hand.
  await page.$eval('#bkaXcV', i => { i.value = '2'; });
  await page.click('[data-bkaxcall="all"]');
  await page.$eval('#bkaRows input[data-bkai="1"]', i => { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#bkaRows input[data-bkai="3"]', i => { i.value = '3'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.match(await page.$eval('#bkaCount', e => e.textContent), /3 of 4 given extra credit/);
  assert.match(await page.$eval('#bkaRows tr:nth-child(4)', e => e.textContent), /\+3% on the term grade/);
  await page.click('[data-bkasave]');
  await page.waitForSelector('#bkTab');
  assert.deepEqual(await page.$$eval('#bkTab tr.bkg th', t => t.map(x => x.textContent).filter(Boolean)), ['In-class · 50%', 'Summative · 50%', 'Extra credit · points on top', 'Term 1']);
  // Cleo stays at 100% (kept there by default); Bram had none.
  const col = await termCol(page);
  assert.match(col[0], /^Aria Testwell 82\.00%/); assert.match(col[1], /^Bram Sample 70\.00%$/); assert.match(col[2], /^Cleo Fixture 100\.00%/); assert.match(col[3], /^Dov Madeup 63\.00%/);
  assert.match(await page.$eval('#bkTab tbody tr:nth-child(3) td.bkterm', t => t.dataset.tn), /Extra credit \+2 on the grade · kept at 100%/);
  // The assignments' own percents and averages don't move.
  assert.deepEqual(await page.$$eval('#bkTab tbody tr:first-child td', t => t.map(x => x.textContent.trim()).slice(1, 6)), ['80%', '80%', '+2', '80.00%', '80.00%']);
  const stored = await page.evaluate(() => window.__gs.state().lib.classes[0].units[0].items.find(x => x.type === 'xc'));
  assert.deepEqual(stored.typed, { max: null, s: { 'Aria Testwell': { v: 2 }, 'Cleo Fixture': { v: 2 }, 'Dov Madeup': { v: 3 } } });
  assert.equal(stored.xcTo, 'term');
  // A cell changes in place, like any typed-in score.
  await page.click('#bkTab tbody tr:nth-child(2) td[data-bked="' + stored.id + '"]');
  await page.waitForSelector('#bkTab .bkcin');
  await page.keyboard.type('1.5'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => /71\.50%/.test(document.querySelector('#bkTab tbody tr:nth-child(2)').textContent));
  noErrors(page); await close();
});

test('extra credit can go on the in-class average instead, and a teacher can let grades go over 100%', async () => {
  const { page, close } = await openApp(browser, { seed: seed({ xcTo: 'ic', xcCap: false }) });
  await openBook(page);
  await page.click('[data-bkaddxc]');
  await page.waitForSelector('#bkAdd');
  assert.equal(await page.$eval('[data-bkaxcto="ic"]', b => b.getAttribute('aria-pressed')), 'true', 'the teacher’s own default');
  await page.type('#bkaName', 'Quiz game');
  await page.$eval('#bkaXcV', i => { i.value = '4'; });
  await page.click('[data-bkaxcall="all"]');
  await page.click('[data-bkasave]');
  await page.waitForSelector('#bkTab');
  // In-class 80 + 4 = 84, counted at 50%: Aria (80 + 84) / 2 = 82. Cleo (100 + 104) / 2 = 102, allowed over 100.
  const col = await termCol(page);
  assert.match(col[0], /^Aria Testwell 82\.00%/); assert.match(col[2], /^Cleo Fixture 102\.00%/);
  assert.match(await page.$eval('#bkTab tbody tr:first-child td.bkterm', t => t.dataset.tn), /In-class 50%: 84\.00% · .*Extra credit \+4 on the in-class average/);
  // Term setup shows and saves the choices.
  await page.click('[data-bksetup]');
  await page.waitForSelector('#bkSetup');
  assert.equal(await page.$eval('[data-bkxccap="over"]', b => b.getAttribute('aria-pressed')), 'true');
  await page.click('[data-bkxccap="cap"]'); await page.click('[data-bkxcto="term"]');
  await page.click('[data-bksavesetup]');
  await page.waitForSelector('#bkTab');
  const book = await page.evaluate(() => window.__gs.state().lib.book);
  assert.equal(book.xcTo, 'term'); assert.equal(book.xcCap, true);
  // This entry keeps what it was made with (the in-class average); only the cap changed.
  assert.match((await termCol(page))[2], /^Cleo Fixture 100\.00%/);
  noErrors(page); await close();
});
