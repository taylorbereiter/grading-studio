// IB classes: a class says how it is graded (points and percent, MYP or DP). An MYP class has its criteria and the table that
// turns a total of the levels into 1 to 7; a DP class has the percent each grade starts at. A class that stays on points and
// percent has nothing new stored. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, classPage } = require('./helpers/app');

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
