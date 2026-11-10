// The running average and papers left at the top left, and leaving a paper out of the average. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goToStudent, score, settle, appReady, pick, press } = require('./helpers/app');
const { standardFiles, makePaper, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf({ ...(await standardFiles()), 'Cleo Fixture/Essay.pdf': await makePaper({ title: 'Cleo Fixture essay' }) }); });
after(async () => { await browser.close(); });

async function stack() { const app = await openApp(browser); await openZip(app.page, zip, 'River essay.zip'); return app; }
const tiles = page => page.evaluate(() => ({ avg: [...document.querySelectorAll('#pAvg .v, #pAvg .s')].map(e => e.textContent).join(' '), left: document.querySelector('#pLeft .v').textContent, out: document.querySelector('#pOut .v').textContent }));
const noErrors = page => assert.deepEqual(page.errors, []);

test('the average and papers left follow the scores, and a left-out paper stays out of the average and Class overview', async () => {
  const { page, close } = await stack();
  assert.deepEqual(await tiles(page), { avg: '–', left: '4', out: '0' });
  await score(page, [4, 3.5, 3]);   // 10.5 = 93%
  await goToStudent(page, 1); await score(page, [3, 3, 2.5]);   // 8.5 = 84%
  assert.deepEqual(await tiles(page), { avg: '88.50% 9.5 / 12', left: '2', out: '0' });

  // A placeholder 0, left out: the score stays and copies, but the average doesn't move.
  await goToStudent(page, 2); await score(page, [0, 0, 0]);
  assert.deepEqual(await tiles(page), { avg: '75.00% 6.3 / 12', left: '1', out: '0' }, 'a 0 counts until it is left out');
  await pick(page, '#outAvg');
  assert.equal(await page.$eval('#outAvg', b => b.getAttribute('aria-checked')), 'true');
  assert.deepEqual(await tiles(page), { avg: '88.50% 9.5 / 12', left: '1', out: '1' });
  const st = await page.evaluate(() => { const G = window.__gs, s = G.state().batch.students[2]; return { g: G.gradeOf(s), row: G.tableRow(s, 2), head: G.tableHead() }; });
  assert.deepEqual(st.g, { total: 0, pct: 48, done: true, out: true });
  assert.equal(st.row[st.head.indexOf('Total / 12')], '0', 'the score still copies');
  assert.equal(st.row[st.head.indexOf('Status')], 'Left out of the average');
  assert.match(await page.$eval('#stuList .stu[data-i="2"]', e => e.textContent), /left out/);
  const cs = await page.evaluate(() => { const s = window.__gs.classStats(); return { n: s.n, out: s.leftOut.map(x => x.i), row0: s.rows.find(r => r.r === 0).avg }; });
  assert.deepEqual(cs, { n: 2, out: [2], row0: 3.5 }, 'Class overview leaves it out of the spread and the row averages');
  const keys = await page.evaluate(() => [...window.__gs.consData().groups.keys()]);
  assert.ok(!keys.includes(0), 'and the Consistency check leaves it out');

  // The Left out filter lists it (with the paper she is on), and a click opens that student.
  await goToStudent(page, 0);
  await press(page, '#pOut');
  assert.deepEqual(await page.$$eval('#stuList .stu', a => a.map(b => +b.dataset.i)), [0, 2]);
  assert.match(await page.$eval('#stuList .stu[data-i="2"]', e => e.textContent), /Cleo Fixture/);
  await page.click('#stuList .stu[data-i="2"]');
  await page.waitForFunction(() => window.__gs.state().cur === 2);
  assert.deepEqual(await page.$$eval('#stuList .stu', a => a.map(b => +b.dataset.i)), [2]);

  // Switched back on, the 0 counts again.
  await pick(page, '#outAvg');
  assert.deepEqual(await tiles(page), { avg: '75.00% 6.3 / 12', left: '1', out: '0' });
  noErrors(page); await close();
});

test('a left-out paper with no score is still left; missing and excused have no switch; it comes back after a reload', async () => {
  const { page, close } = await stack();
  await goToStudent(page, 3);
  await pick(page, '#outAvg');
  assert.deepEqual(await tiles(page), { avg: '–', left: '4', out: '1' }, 'still to do until it has a score');
  await goToStudent(page, 1);
  await page.click('[data-status="missing"]');
  assert.equal(await page.$('#outAvg'), null, 'no switch on a missing student');
  assert.deepEqual(await tiles(page), { avg: '–', left: '3', out: '1' });
  await settle(page);
  await page.reload(); await appReady(page);
  await openZip(page, zip, 'River essay.zip');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[3].grade.outAvg), true);
  assert.equal((await tiles(page)).out, '1');
  noErrors(page); await close();
});

test('during anonymous grading the Left out filter shows no names', async () => {
  const { page, close } = await stack();
  await goToStudent(page, 2); await score(page, [2, 2, 2]); await pick(page, '#outAvg');
  await page.evaluate(() => window.__gs.setAnon(true));
  await page.waitForFunction(() => window.__gs.anonOn());
  await press(page, '#pOut');
  const t = await page.$eval('#stuList', e => e.textContent);
  assert.match(t, /Paper \d/);
  assert.doesNotMatch(t, /Cleo|Fixture/);
  noErrors(page); await close();
});
