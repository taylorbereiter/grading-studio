// The average percent up front, the percent charts in Class overview, and its Percents tab. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goToStudent, score } = require('./helpers/app');
const { standardFiles, makePaper, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf({ ...(await standardFiles()), 'Cleo Fixture/Essay.pdf': await makePaper({ title: 'Cleo Fixture essay' }) }); });
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'];
const SETUP = { mode: 'rubric', criteria: ['Thesis', 'Evidence', 'Style'], outOf: 10, scale: { 12: 100, 11: 95, 10: 91, 9: 86, 8: 82, 7: 77, 6: 73, 5: 68, 4: 64, 3: 60 } };
const g = (rubric, more = {}) => ({ f: {}, h: {}, g: { rubric, points: '', comment: '', ...more } });
// An earlier assignment for the same class (its average is 93% and 73%, so 83%), and one for another class.
function seed() {
  const lib = { classes: [{ id: 'c1', name: '12EL-1', names: NAMES, units: [] }, { id: 'c2', name: '11EL-2', names: ['Nia Elsewhere'], units: [] }], loose: { id: '', name: '', names: [], units: [] }, seed2627: true };
  const past1 = { t: Date.UTC(2026, 8, 20), cls: 'c1', setup: SETUP, s: { 'Aria Testwell': g([4, 3.5, 3]), 'Bram Sample': g([2, 2, 2]), 'Cleo Fixture': g([4]), 'Dov Madeup': g([], { status: 'missing' }) } };
  const past2 = { t: Date.UTC(2026, 8, 22), cls: 'c2', setup: SETUP, s: { 'Nia Elsewhere': g([1, 1, 1]) } };
  const rec = (id, name) => [id, { id, name, n: 4, t: Date.UTC(2026, 8, 21) }];
  return {
    ls: { 'gs.lib': JSON.stringify(lib), 'gs.b.past1': JSON.stringify(past1), 'gs.b.past2': JSON.stringify(past2) },
    idb: { 'grading-studio-keep': { version: 2, stores: { papers: [], work: [], edits: [], meta: [rec('gs.b.past1', 'River essay'), rec('gs.b.past2', 'Other class quiz')] } } },
  };
}
// 10.5 is 93%, 8.5 is 84%, 6 is 73%: an average of 83%, and 8.3 points. Dov has one row scored, so is partial at 4 (64%).
async function scored() {
  const app = await openApp(browser, { seed: seed() }); const { page } = app;
  await openZip(page, zip, 'Tide essay.zip');
  await page.evaluate(s => { Object.assign(window.__gs.state().setup, s); window.__gs.openStudent(0); }, SETUP);
  await score(page, [4, 3.5, 3]);
  await goToStudent(page, 1); await score(page, [3, 3, 2.5]);
  await goToStudent(page, 2); await score(page, [2, 2, 2]);
  await goToStudent(page, 3); await score(page, [4]);
  return app;
}
const noErrors = page => assert.deepEqual(page.errors, []);
const text = (page, sel) => page.$eval(sel, e => e.textContent);
const pctTab = async page => { await page.click('[data-ovtab="pct"]'); await page.waitForSelector('#pTiles'); };

test('the Average tile leads with the percent and opens Class overview, which leads with percents and shows bands, dots and the class over time', async () => {
  const { page, close } = await scored();
  assert.equal(await text(page, '#pAvg .v'), '83.33%', 'to the hundredth by default');
  assert.equal(await text(page, '#pAvg .s'), '8.3 / 12');
  await page.click('#pAvg');
  await page.waitForSelector('#ovTiles');
  assert.equal(await page.$$eval('#ovTiles .ovt', t => t.map(x => x.textContent).join(' | ')), 'Average83.33%8.3 / 12 | Middle score84%8.5 / 12 | Lowest73%6 / 12 | Highest93%10.5 / 12');
  assert.deepEqual(await page.$$eval('#ovBands .pband', b => b.map(x => x.querySelector('span').textContent + ':' + x.querySelector('.pbn b').textContent)), ['90 to 100:1', '80 to 89:1', '70 to 79:1', '60 to 69:0', 'Below 60:0']);
  assert.equal((await page.$$('#ovStrip .pdot')).length, 3);
  assert.match(await text(page, '#ovStrip .pln'), /Average 83.33%/);
  // Only the earlier assignment for this class, oldest first, then this one.
  await page.waitForFunction(() => /River essay/.test(document.querySelector('#ovTrend').textContent));
  assert.deepEqual(await page.$$eval('#ovTrend .tdot', d => d.map(x => x.dataset.tl + ' ' + x.dataset.tv)), ['River essay 83.00%', 'This one 83.33%']);
  assert.doesNotMatch(await text(page, '#ovTrend'), /Other class/);
  // A dot opens that student.
  await page.click('#ovStrip .pdot');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  noErrors(page); await close();
});

test('the Percents tab: who counts, average or middle, a target, bands, What if, and a table to sort and copy', async () => {
  const { page, close } = await scored();
  await page.evaluate(() => window.__gs.openOverview());
  await pctTab(page);
  const tiles = () => page.$$eval('#pTiles .ovt', t => t.map(x => x.querySelector('.ovl').textContent + ' ' + x.querySelector('.ovv').textContent));
  assert.deepEqual(await tiles(), ['Average 83.33%', 'Middle score 84%', 'Range 73–93%', 'Typical gap ±8', 'Below 70% 0']);
  assert.match(await text(page, '#pWho'), /Partial papers, as they stand1 paper/);

  // Partial papers counted as they stand: Dov's 4 is 64%.
  await page.click('[data-pck="part"]');
  assert.deepEqual((await tiles()).slice(0, 2), ['Average 78.50%', 'Middle score 79%']);
  assert.match(await text(page, '.ptab'), /Dov Madeup partial/);
  await page.click('[data-pck="part"]');

  await page.click('[data-pseg="mid"][data-v="median"]');
  assert.deepEqual((await tiles()).slice(0, 2), ['Middle score 84%', 'Average 83.33%']);
  await page.click('[data-pseg="mid"][data-v="mean"]');

  // A target of 85: two papers below it, flagged in the table and hollow on the line.
  await page.$eval('#pTarget', e => { e.value = ''; }); await page.type('#pTarget', '85');
  assert.equal((await tiles())[4], 'Below 85% 2');
  assert.equal((await page.$$('.ptab tr.lo')).length, 2);
  assert.equal((await page.$$('#pMain .pdot.lo')).length, 2);

  // Fives, then her own cut-offs.
  await page.click('[data-pseg="band"][data-v="5"]');
  assert.equal((await page.$$('#pMain .pband')).length, 9);
  await page.click('[data-pseg="band"][data-v="own"]');
  await page.$$eval('[data-pcut]', (e, v) => e.forEach((x, i) => { x.value = v[i] || ''; }), ['85', '75']);
  await page.$eval('[data-pcut]', e => e.dispatchEvent(new Event('input', { bubbles: true })));
  assert.deepEqual(await page.$$eval('#pMain .pband', b => b.map(x => x.querySelector('span').textContent + ':' + x.querySelector('.pbn b').textContent)), ['85 to 100:1', '75 to 84:1', 'Below 75:1']);

  // What if: one point more for everyone is 98%, 89% and 77%. Nothing is saved.
  await page.$eval('#pAdd', e => { e.value = ''; }); await page.type('#pAdd', '1');
  assert.deepEqual((await tiles())[0], 'Average 88.00%');
  assert.match(await page.$eval('#pTiles .ovt .ovs', e => e.textContent), /now 83.33%, with \+1/);
  assert.equal(await page.evaluate(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).total), 10.5);
  await page.$eval('#pAdd', e => { e.value = ''; }); await page.type('#pAdd', '0');

  // Sorted by percent, highest first; then by name; and copied in the order shown.
  const names = () => page.$$eval('.ptab tbody tr', r => r.map(x => x.querySelector('td').textContent));
  assert.deepEqual(await names(), ['Aria Testwell', 'Bram Sample', 'Cleo Fixture']);
  await page.click('[data-psort="pct"]');
  assert.deepEqual(await names(), ['Cleo Fixture', 'Bram Sample', 'Aria Testwell']);
  await page.click('[data-psort="name"]');
  assert.deepEqual(await names(), ['Aria Testwell', 'Bram Sample', 'Cleo Fixture']);
  await page.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  await page.click('[data-pcopy]');
  await page.waitForFunction(() => window.__copied != null);
  assert.equal(await page.evaluate(() => window.__copied), 'Aria Testwell\t93%\nBram Sample\t84%\nCleo Fixture\t73%');

  // The average can show whole, to one place or two, everywhere at once. Two is the start.
  await page.click('[data-avgdp="1"]');
  assert.equal((await tiles())[0], 'Average 83.3%');
  assert.equal(await text(page, '#pAvg .v'), '83.3%');
  await page.click('[data-avgdp="0"]');
  assert.equal((await tiles())[0], 'Average 83%');
  assert.equal(await text(page, '#pAvg .v'), '83%');
  await page.click('[data-avgdp="2"]');
  assert.equal(await text(page, '#pAvg .v'), '83.33%');

  // The target and bands are kept for this class; What if isn't.
  await page.click('[data-close]');
  await page.evaluate(() => window.__gs.openOverview());
  await pctTab(page);
  assert.equal(await page.$eval('#pTarget', e => e.value), '85');
  assert.equal(await page.$eval('[data-pseg="band"][aria-pressed="true"]', e => e.dataset.v), 'own');
  assert.equal(await page.$eval('#pAdd', e => e.value), '0');
  noErrors(page); await close();
});

test('during anonymous grading the Percents tab and the dots show no names', async () => {
  const { page, close } = await scored();
  await page.evaluate(() => window.__gs.setAnon(true));
  await page.waitForFunction(() => window.__gs.anonOn());
  await page.evaluate(() => window.__gs.openOverview());
  await page.waitForSelector('#ovStrip');
  const sum = await page.$$eval('#ovStrip .pdot', d => d.map(x => x.dataset.tl + x.getAttribute('aria-label')).join(' '));
  assert.doesNotMatch(sum, /Aria|Bram|Cleo|Dov/);
  await pctTab(page);
  const t = await text(page, '.ptab');
  assert.match(t, /Paper \d/);
  assert.doesNotMatch(t, /Aria|Bram|Cleo|Dov/);
  noErrors(page); await close();
});
