// IB classes: a class says how it is graded (points and percent, MYP or DP). An MYP class has its criteria and the table that
// turns a total of the levels into 1 to 7; a DP class has the percent each grade starts at. A class that stays on points and
// percent has nothing new stored. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, classPage, goTo } = require('./helpers/app');
const { ibSeed } = require('./helpers/ibseed');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'];
function seed() {
  const lib = { classes: [{ id: 'c1', name: 'MYP 3 Sciences', names: NAMES, units: [] }, { id: 'c2', name: 'Grade 9 English', names: NAMES, units: [] }], loose: { id: '', units: [] }, seed2627: true };
  return { ls: { 'gs.lib': JSON.stringify(lib) } };
}
const libOf = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().lib)));
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));
const shut = page => page.waitForFunction(() => document.querySelector('#dlg').hidden);
const type = (page, sel, v) => page.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v);

test('the sums: boundaries, a term total and grade, and the hint', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  const r = await page.evaluate(() => {
    const g = window.__gs, c = { way: 'myp', ib: { group: 'sci' } }, crit = g.ibCrit(c), b = g.ibBounds(c);
    return {
      crit, b, b24: g.ibBoundsFor(3),
      grades: [0, 1, 5, 6, 9, 10, 14, 15, 18, 19, 23, 24, 27, 28, 32].map(t => g.ibGradeOf(t, b)),
      full: g.ibTerm({ A: 7, B: 6, C: 6, D: 6 }, crit, b), part: g.ibTerm({ A: 7, B: 6, C: 6 }, crit, b), zero: g.ibTerm({ A: 0, B: 0, C: 0, D: 0 }, crit, b),
      half: g.ibTerm({ A: 6.5, B: 6, C: 6, D: 6 }, crit, b),
      ev: g.ibEvidence([{ v: 6, t: 2 }, { v: 7, t: 1 }, { v: 5, t: 3 }]), none: g.ibEvidence([]),
      plain: g.classWay({ way: 'other' }), dp: g.ibBounds({ way: 'dp' }), bad: g.ibBounds({ way: 'myp', ib: { group: 'sci', bounds: [[10, 7], [20, 6]] } }),
    };
  });
  assert.deepEqual(r.crit.map(x => x.k), ['A', 'B', 'C', 'D']);
  assert.equal(r.crit[1].name, 'Inquiring and designing');
  assert.deepEqual(r.b, [[28, 7], [24, 6], [19, 5], [15, 4], [10, 3], [6, 2], [1, 1]]);
  assert.deepEqual(r.grades, [null, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]);
  assert.deepEqual(r.full, { total: 25, grade: 6, need: [], set: 4 });
  assert.deepEqual(r.part, { total: null, grade: null, need: ['D'], set: 3 }, 'a criterion with no level is never counted as 0');
  assert.deepEqual(r.zero, { total: 0, grade: null, need: [], set: 4 });
  assert.deepEqual(r.half.need, ['A'], 'levels are whole numbers');
  assert.deepEqual(r.ev, { n: 3, hint: 5, last: 5, high: 7 });
  assert.equal(r.none.hint, null);
  assert.equal(r.plain, '');
  assert.equal(r.b24.length, 7); assert.equal(r.b24[0][0], 21); assert.equal(r.b24[6][0], 1);
  for (let i = 1; i < r.b24.length; i++) assert.ok(r.b24[i][0] < r.b24[i - 1][0]);
  assert.equal(r.dp[0][1], 7); assert.equal(r.dp[6][0], 0);
  assert.deepEqual(r.bad, r.b, 'a table that does not go down reads as the starting one');
  await close();
});

test('a class is set to MYP, a criterion renamed and one boundary changed; the other class is untouched', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await classPage(page, 'c1');
  assert.equal(await page.$('.clshead .ibpill'), null);
  await page.click('[data-ib-class="0"]'); await page.waitForSelector('#ibBody');
  assert.equal(await page.$('#ibGroup'), null, 'points and percent shows no IB fields');
  await page.click('[data-ibway="myp"]'); await page.waitForSelector('#ibGroup');
  await page.select('#ibGroup', 'langacq');
  assert.deepEqual(await page.$$eval('[data-ibcrit]', xs => xs.map(x => x.value)), ['Listening', 'Reading', 'Speaking', 'Writing']);
  await type(page, '[data-ibcrit="0"]', 'Listening and viewing');
  await type(page, '[data-ibb="0"]', '29');
  await page.click('#dlgBox [data-ok]'); await shut(page);
  const lib = await stored(page), c = lib.classes[0];
  assert.equal(c.way, 'myp'); assert.equal(c.ib.group, 'langacq');
  assert.deepEqual(c.ib.crit[0], { k: 'A', name: 'Listening and viewing' });
  assert.deepEqual(c.ib.bounds[0], [29, 7]);
  assert.equal(lib.classes[1].way, undefined); assert.equal(lib.classes[1].ib, undefined);
  assert.equal(await page.$eval('.clshead .ibpill', e => e.textContent), 'MYP');
  await close();
});

test('three criteria get a scaled table, a boundary out of order is refused, and DP keeps its own percents', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await classPage(page, 'c1');
  await page.click('[data-ib-class="0"]'); await page.waitForSelector('#ibBody');
  await page.click('[data-ibway="myp"]'); await page.waitForSelector('#ibGroup');
  await page.select('#ibGroup', 'pp');
  assert.equal((await page.$$('[data-ibcrit]')).length, 3);
  assert.equal(await page.$eval('[data-ibb="0"]', e => e.value), '21');
  await type(page, '[data-ibb="1"]', '22');
  await page.click('#dlgBox [data-ok]');
  await page.waitForFunction(() => /higher than the one below/.test(document.body.innerText));
  assert.equal(await page.$eval('#dlg', e => e.hidden), false);
  assert.equal((await libOf(page)).classes[0].way, undefined);
  await page.click('[data-ibway="dp"]'); await page.waitForFunction(() => !document.querySelector('#ibGroup'));
  await type(page, '[data-ibb="0"]', '77');
  await page.click('#dlgBox [data-ok]'); await shut(page);
  let c = (await stored(page)).classes[0];
  assert.equal(c.way, 'dp'); assert.deepEqual(c.ib.bounds[0], [77, 7]);
  assert.equal(await page.$eval('.clshead .ibpill', e => e.textContent), 'DP');
  // back to points and percent: the pill goes, and what was typed is still there if the class comes back to IB
  await page.click('[data-ib-class="0"]'); await page.waitForSelector('#ibBody');
  await page.click('[data-ibway=""]'); await page.click('#dlgBox [data-ok]'); await shut(page);
  c = (await stored(page)).classes[0];
  assert.equal(c.way, undefined); assert.deepEqual(c.ib.bounds[0], [77, 7]);
  assert.equal(await page.$('.clshead .ibpill'), null);
  await close();
});

const book = async page => { await goTo(page, '#/class/c1/gradebook'); await page.waitForSelector('#ibTab'); };
const row = (page, i) => page.$$eval('#ibTab tbody tr', (rs, i) => [...rs[i].children].map(td => td.textContent.trim()), i);

test('an MYP gradebook shows each task’s levels, the term levels the teacher set, and a grade only when all are set', async () => {
  const { page, close } = await openApp(browser, { seed: ibSeed() });
  await book(page);
  assert.deepEqual(await row(page, 1), ['Bram Sample', 'A4D3', 'B4C4', 'A4', 'B3C5D4', '4', '4', '5', '4', '17', '4']);
  assert.deepEqual(await row(page, 2), ['Cleo Fixture', 'A8D7', 'B7C8', 'A8', 'B8C7D7', '8', '8', '7', '7', '30', '7']);
  assert.deepEqual((await row(page, 0)).slice(5), ['7', '6', '6', 'set', '–', '–'], 'three of four set: no total, no grade');
  assert.deepEqual((await row(page, 4)).slice(5), ['set', 'set', 'set', 'set', '–', '–'], 'nothing is filled in from the evidence');
  assert.equal(await page.$('#bkTab'), null, 'no percent table for an MYP class');
  assert.ok(!/%/.test(await page.$eval('#bkBody', e => e.innerText)), 'no percent anywhere');
  // the other term has no evidence and its own, empty, levels
  await page.click('[data-bkterm="t2"]'); await page.waitForFunction(() => /No levels for/.test(document.querySelector('#bkBody').innerText));
  // the whole year keeps levels of its own
  await page.click('[data-bkterm="*"]'); await page.waitForSelector('#ibTab');
  assert.deepEqual((await row(page, 1)).slice(5), ['set', 'set', 'set', 'set', '–', '–']);
  // a points-and-percent class is as it was
  await goTo(page, '#/class/c2/gradebook'); await page.waitForSelector('#bkBody .bkbar');
  assert.equal(await page.$('#ibTab'), null); assert.ok(await page.$('[data-bkadd]'));
  await close();
});

test('the best-fit screen: evidence by criterion, a hint that sets nothing, a click that sets and a second click that clears', async () => {
  const { page, close } = await openApp(browser, { seed: ibSeed() });
  await book(page);
  await page.click('#ibTab tbody tr:nth-child(1) [data-ibfit]'); await page.waitForSelector('#ibFit');
  assert.deepEqual(await page.$$eval('#ibFit .ibrow', rs => rs.map(r => [...r.querySelectorAll('.ibchip')].map(c => c.textContent.trim()))),
    [['Cells lab report 6', 'Unit test 7'], ['Density inquiry 5', 'Energy investigation 6'], ['Density inquiry 6', 'Energy investigation 6'], ['Cells lab report 5', 'Energy investigation 6']]);
  assert.equal(await page.$eval('#ibFit .iblvl .hint', e => e.dataset.iblv), 'D:6', 'the most recent level is outlined');
  assert.equal((await stored(page)).classes[0].lv.t1['Aria Testwell'].D, undefined, 'and not saved');
  await page.click('[data-iblv="D:6"]'); await page.waitForFunction(() => /4 of 4 set/.test(document.querySelector('#ibFit').innerText));
  assert.equal((await stored(page)).classes[0].lv.t1['Aria Testwell'].D, 6);
  assert.match(await page.$eval('#ibFit .ibsum', e => e.innerText.replace(/\s+/g, ' ')), /Total 25 of 32 Grade 6/i);
  await page.click('[data-iblv="D:6"]'); await page.waitForFunction(() => /3 of 4 set/.test(document.querySelector('#ibFit').innerText));
  assert.equal((await stored(page)).classes[0].lv.t1['Aria Testwell'].D, undefined);
  // next student, and a criterion with nothing behind it in this student's work
  await page.click('[data-ibstep="1"]'); await page.waitForFunction(() => /Bram Sample/.test(document.querySelector('#ibFit h3').textContent));
  await page.click('[data-ibback]'); await page.waitForSelector('#ibTab');
  await close();
});

test('levels are typed in for a task, changed, and refused when they are not whole numbers from 0 to 8', async () => {
  const { page, close } = await openApp(browser, { seed: ibSeed({ lv: false }) });
  await book(page);
  await page.click('[data-ibadd-lv]'); await page.waitForSelector('#ibAdd');
  await type(page, '#ibaName', 'Forces poster');
  await page.$eval('#ibaDue', e => { e.value = '2026-11-20'; });
  await page.click('[data-ibacrit="B"]'); await page.waitForFunction(() => document.querySelectorAll('#ibAdd thead th').length === 2);
  await page.click('[data-ibacrit="D"]'); await page.waitForFunction(() => document.querySelectorAll('#ibAdd thead th').length === 3);
  const put = (n, k, v) => page.$eval('#ibAdd [data-iban="' + n + '"][data-ibak="' + k + '"]', (e, v) => { e.value = v; }, v);
  await put('Aria Testwell', 'A', '7'); await put('Aria Testwell', 'D', '6'); await put('Bram Sample', 'A', '9');
  await page.click('[data-ibasave]');
  await page.waitForFunction(() => /whole number from 0 to 8/.test(document.body.innerText));
  await put('Bram Sample', 'A', '4');
  await page.click('[data-ibasave]'); await page.waitForSelector('#ibTab');
  const it = (await stored(page)).classes[0].units[0].items.find(x => x.name === 'Forces poster');
  assert.deepEqual(it.crit, ['A', 'D']); assert.equal(it.due, '2026-11-20'); assert.equal(it.type, 'sum');
  assert.deepEqual(it.typed, { lv: true, s: { 'Aria Testwell': { l: { A: 7, D: 6 } }, 'Bram Sample': { l: { A: 4 } } } });
  assert.equal((await row(page, 0))[5], 'A7D6');
  // change it: the same box, with what was typed
  await page.click('[data-ibedit="' + it.id + '"]'); await page.waitForSelector('#ibAdd');
  assert.equal(await page.$eval('#ibAdd [data-iban="Aria Testwell"][data-ibak="D"]', e => e.value), '6');
  await put('Aria Testwell', 'D', '5'); await page.click('[data-ibasave]'); await page.waitForSelector('#ibTab');
  assert.equal((await row(page, 0))[5], 'A7D5');
  // with every criterion assessed twice by now except none: D has three tasks, so no warning about D
  assert.equal(await page.$('.ibfew'), null);
  await close();
});

test('a criterion assessed fewer than twice this year is named', async () => {
  const s = ibSeed({ lv: false }), lib = JSON.parse(s.ls['gs.lib']);
  lib.classes[0].units[0].items = lib.classes[0].units[0].items.slice(0, 2);   // A D, then B C: each once
  lib.classes[0].ib = { group: 'sci' };
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(lib) } } });
  await book(page);
  assert.match(await page.$eval('.ibfew', e => e.textContent), /Criterion A has been assessed once this year\. Criterion B has been assessed once/);
  await close();
});

test('a DP class’s term grade carries the 1 to 7 its percent earns on the class’s own boundaries', async () => {
  const names = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture'];
  const lib = { classes: [
    { id: 'c1', name: 'DP1 History HL', names, way: 'dp', ib: { bounds: [[80, 7], [68, 6], [56, 5], [44, 4], [32, 3], [18, 2], [0, 1]] }, units: [{ id: 'u1', name: 'Unit 1', items: [
      { id: 'i1', name: 'Source paper', classId: 'c1', type: 'sum', due: '2026-09-20', typed: { max: 24, s: { 'Aria Testwell': { v: 20, st: '' }, 'Bram Sample': { v: 12, st: '' }, 'Cleo Fixture': { v: 3, st: '' } } } }] }] },
    { id: 'c2', name: 'Grade 9 English', names, units: [{ id: 'u2', name: 'Unit 1', items: [
      { id: 'i2', name: 'Essay', classId: 'c2', type: 'sum', due: '2026-09-20', typed: { max: 24, s: { 'Aria Testwell': { v: 20, st: '' } } } }] }] }],
    loose: { id: '', units: [] }, seed2627: true, book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2027-07-31' }] } };
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(lib) } } });
  await goTo(page, '#/class/c1/gradebook'); await page.waitForSelector('#bkTab');
  assert.deepEqual(await page.$$eval('#bkTab tbody tr:not(.bkfoot) td.bkterm', xs => xs.map(x => (x.querySelector('.ibg7') || {}).textContent)), ['7', '4', '1']);   // 83%, 50%, 13%
  await goTo(page, '#/class/c2/gradebook'); await page.waitForSelector('#bkTab');
  assert.equal(await page.$('#bkTab .ibg7'), null, 'a points and percent class shows the percent alone');
  await close();
});
