// IB classes: a class says how it is graded (points and percent, MYP or DP). An MYP class has its criteria and the table that
// turns a total of the levels into 1 to 7; a DP class has the percent each grade starts at. A class that stays on points and
// percent has nothing new stored. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, classPage, goTo, openZip, score, settle, answerDlg, closeBox } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');
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

test('an MYP class’s Charts tab counts students by band and names the middle level, with no percent anywhere', async () => {
  const { page, close } = await openApp(browser, { seed: ibSeed() });
  await goTo(page, '#/class/c1/charts'); await page.waitForSelector('#ibTiles');
  const tiles = await page.$$eval('#ibTiles .ovt', xs => xs.map(x => [x.querySelector('.ovl').textContent, x.querySelector('.ovv').textContent]));
  assert.deepEqual(tiles.slice(0, 3), [['Grades set', '3 of 6'], ['Middle grade', '5'], ['A middle level', '6']]);
  const segs = id => page.$$eval('#' + id + ' .ibstack:first-child .ibseg', xs => xs.map(x => x.className.replace('ibseg ', '') + ':' + x.textContent));
  assert.deepEqual(await segs('ibSet'), ['s2:1', 's3:2', 's4:2', 'sn:1'], 'criterion A as set: Bram 4, Dov 5 and Finn 6, Aria 7 and Cleo 8, Edda not set');
  assert.deepEqual(await segs('ibLast'), ['s2:1', 's3:3', 's4:2'], 'criterion A on the latest task');
  assert.deepEqual(await page.$$eval('#ibGrades .pbn b', xs => xs.map(x => x.textContent)), ['1', '0', '1', '1', '0', '0', '0']);
  assert.equal(await page.$eval('#ibTasks tbody tr:first-child td:nth-child(2)', e => e.textContent.trim()), '5 to 6 3–8', 'Cells lab report, criterion A: 3 4 5 6 6 8');
  assert.equal(await page.$eval('#ibOften', e => e.textContent.includes('fewer than two')), false);
  assert.equal(await page.$eval('#bkBody', e => e.textContent.includes('%')), false);
  assert.equal(await page.evaluate(() => window.__gs.ibMid([3, 3, 4])), '3');
  await goTo(page, '#/class/c2/charts'); await page.waitForSelector('#bkTiles');
  assert.equal(await page.$('#ibTiles'), null, 'a points and percent class keeps its own charts');
  await close();
});

test('a student’s page in an MYP class sets levels in place, and the Students list shows the grade', async () => {
  const { page, close } = await openApp(browser, { seed: ibSeed() });
  await goTo(page, '#/class/c1/students/1'); await page.waitForSelector('#bkStuTiles');
  const tile = () => page.$eval('#bkStuTiles .ovt.main', x => x.querySelector('.ovv').textContent + ' | ' + x.querySelector('.ovs').textContent);
  assert.equal(await page.$eval('#bkStuName', e => e.textContent), 'Aria Testwell');
  assert.equal(await tile(), '– | still to set: D');
  await page.click('#ibFit [data-iblv="D:6"]');
  await page.waitForFunction(() => document.querySelector('#bkStuTiles .ovt.main .ovv').textContent === '6');   // 7 + 6 + 6 + 6 = 25
  assert.equal(stored && (await stored(page)).classes[0].lv.t1['Aria Testwell'].D, 6);
  assert.equal((await stored(page)).classes[0].lv.t1['Bram Sample'].D, 4, 'no other student is touched');
  await page.click('#bkBody [data-bkstu="1"]'); await page.waitForFunction(() => document.querySelector('#bkStuName').textContent === 'Bram Sample');
  assert.equal(await tile(), '4 | 1 to 7');
  await goTo(page, '#/class/c1/students'); await page.waitForSelector('#peopleTbl td[data-pg]');
  await page.waitForFunction(() => document.querySelector('#peopleTbl td[data-pg]').textContent === '6');
  assert.deepEqual(await page.$$eval('#peopleTbl td[data-pg]', xs => xs.map(x => x.textContent)), ['6', '4', '7', '3 of 4 set', '–', '5']);
  await close();
});

test('a task of an MYP class is marked on the paper against the criteria it assesses, 0 to 8, with no total or percent', async () => {
  const zip = zipOf({ 'Aria Testwell/Lab.pdf': await makePaper({ title: 'Aria Testwell lab', pages: 1 }), 'Bram Sample/Lab.pdf': await makePaper({ title: 'Bram Sample lab', pages: 1 }), 'Cleo Fixture/Lab.pdf': await makePaper({ title: 'Cleo Fixture lab', pages: 1 }) });
  const { page, close } = await openApp(browser, { seed: ibSeed() });
  await openZip(page, zip, 'Forces lab.zip');
  const st = () => page.evaluate(() => { const s = window.__gs.state(); return JSON.parse(JSON.stringify({ setup: s.setup, rubric: s.batch.students.map(x => x.grade.rubric), cls: s.batch.classId })); });
  assert.equal((await st()).cls, 'c1', 'the papers are the MYP class’s');
  await page.waitForSelector('#ibAsk');
  await page.click('#ibTaskSet'); await page.waitForSelector('#ibTaskBody');
  await page.click('#ibTaskBody [data-ibtk="B"]'); await page.click('#ibTaskBody [data-ibtk="C"]'); await page.click('#dlgBox [data-ok]'); await shut(page);
  let s = await st();
  assert.deepEqual([s.setup.ib, s.setup.criteria, s.setup.top, s.setup.half, s.setup.mode], [['B', 'C'], ['B Inquiring and designing', 'C Processing and evaluating'], 8, false, 'rubric']);
  assert.equal(await page.$('#ibAsk'), null);
  assert.deepEqual(await page.$$eval('.scores[data-c="0"] .sticks button', xs => xs.map(x => x.textContent)), ['0', '1', '2', '3', '4', '5', '6', '7', '8']);
  await score(page, [6, null]);
  assert.match(await page.$eval('#grade .total', e => e.textContent), /B6.*1 of 2 criteria marked/);
  await score(page, [null, 7]);
  const total = await page.$eval('#grade .total', e => e.textContent);
  assert.match(total, /B6C7/); assert.equal(/%|\//.test(total), false, 'no percent and no total: ' + total);
  assert.equal(await page.$eval('#stampScore', e => e.title), 'Put the levels on the paper: B 6   C 7');
  assert.equal(await page.evaluate(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).pct), null);
  // the Grades tab and Insights show the levels, with no total or percent
  await page.evaluate(() => window.__gs.openGrades()); await page.waitForSelector('#glTable');
  assert.deepEqual(await page.$$eval('#glTable th', xs => xs.map(x => x.textContent)), ['#', 'Student', 'B Inquiring and designing', 'C Processing and evaluating', 'Status', 'On the paper', 'Comment']);
  assert.match(await page.$eval('#dlgBox .bf', e => e.textContent), /Copy all levels/);
  assert.equal(await page.$eval('#glTable', e => e.textContent.includes('%')), false);
  await page.evaluate(() => window.__gs.openOverview()); await page.waitForSelector('#ovRows');
  assert.deepEqual([await page.$('#ovTiles'), await page.$('#ovSpread'), await page.$('[data-ovtab="pct"]')], [null, null, null]);
  await closeBox(page); await shut(page);
  // the task changes to C and D: C keeps its levels, B's go after a warning
  await page.click('#ibTaskSet'); await page.waitForSelector('#ibTaskBody');
  await page.click('#ibTaskBody [data-ibtk="B"]'); await page.click('#ibTaskBody [data-ibtk="D"]'); await page.click('#dlgBox [data-ok]');
  await answerDlg(page); await shut(page);
  assert.match(page.lastDialog, /clears the levels given for it on 1 paper/);
  s = await st();
  assert.deepEqual([s.setup.ib, s.rubric[0]], [['C', 'D'], [7, null]]);
  await score(page, [null, 5]);
  await settle(page);
  // the gradebook reads the levels by their letters
  await goTo(page, '#/class/c1/gradebook'); await page.waitForSelector('#ibTab');
  const cols = await page.evaluate(() => { const g = window.__gs, c = g.state().lib.classes[0]; return g.ibCols(c, g.bkClassCols(c, g.bk().cols)).map(x => [x.name, x.crit, x.cells.has('Aria Testwell') ? x.cells.get('Aria Testwell').lv : null]); });
  assert.deepEqual(cols.find(x => /Forces/.test(x[0])).slice(1), [['C', 'D'], { C: 7, D: 5 }]);
  await close();
});

test('the welcome names MYP criteria (0 to 8) apart from the DP 1 to 7, and an MYP teacher’s new classes are MYP classes', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  const ways = await page.evaluate(() => window.__gs.GRADE_WAYS.map(w => [w[0], w[1], w[2]]));
  const myp = ways.find(w => w[0] === 'myp'), dp = ways.find(w => w[0] === 'ib7');
  assert.equal(myp[1], 'IB MYP criteria'); assert.match(myp[2], /0 to 8.*1 to 7/);
  assert.equal(dp[1], 'IB DP 1 to 7');
  assert.equal(ways.some(w => w[1] === 'IB 1 to 7'), false);
  assert.deepEqual(await page.evaluate(() => { const g = window.__gs, l = g.state().lib; l.me = { ...(l.me || {}), grade: { way: 'myp' } }; return g.classNewWay(); }), { way: 'myp' });
  assert.deepEqual(await page.evaluate(() => { const g = window.__gs, l = g.state().lib; l.me.grade = { way: 'rubric' }; return g.classNewWay(); }), {});
  await close();
});

// Bram has one task marked Missing, on top of the usual made-up class.
function seedMissing() {
  const s = ibSeed(), lib = JSON.parse(s.ls['gs.lib']);
  lib.classes[0].units[0].items[2].typed.s['Bram Sample'] = { st: 'missing' };
  return { ls: { 'gs.lib': JSON.stringify(lib) } };
}
test('report comments for an MYP class are drafted from the levels and the 1 to 7, with no percent', async () => {
  const { page, close } = await openApp(browser, { seed: seedMissing() });
  await goTo(page, '#/class/c1/reports'); await page.waitForSelector('#rptText');
  const chips = () => page.$$eval('#rptFacts .schip', xs => xs.map(x => x.textContent)), text = () => page.$eval('#rptText', e => e.value);
  // Aria: D is not set, so there is no grade yet; the criterion with no level is judged by its most recent task
  assert.deepEqual(await chips(), ['3 of 4 criteria set', 'Strongest: Knowing and understanding 7', 'To work on: Reflecting on the impacts of science 6']);
  assert.match(await text(), /not yet finished enough work/); assert.match(await text(), /Knowing and understanding/);
  await page.click('#rpt [data-rptstu="2"]'); await page.waitForFunction(() => document.querySelector('#rptName').textContent === 'Cleo Fixture');
  assert.deepEqual(await chips(), ['Grade 7 · total 30 of 32', 'Strongest: Knowing and understanding 8', 'To work on: Reflecting on the impacts of science 7']);
  await page.click('#rptGrade'); await page.waitForFunction(() => /term grade is 7 out of 7/.test(document.querySelector('#rptText').value));
  await page.click('#rpt [data-rptstu="1"]'); await page.waitForFunction(() => document.querySelector('#rptName').textContent === 'Bram Sample');
  assert.deepEqual(await chips(), ['Grade 4 · total 17 of 32', 'Strongest: Processing and evaluating 5', 'To work on: Reflecting on the impacts of science 4', 'Missing 1']);
  assert.match(await text(), /one piece of work to hand in: Unit test/);
  for (const i of [0, 1, 2, 3, 4, 5]) { await page.click('#rpt [data-rptstu="' + i + '"]'); await page.waitForFunction(i => document.querySelector('#rpt .rptrow.on').dataset.rptstu === String(i), {}, i); assert.doesNotMatch(await text() + (await chips()).join(' '), /%|NaN|undefined|null/); }
  // the Missing work tab lists the same paper
  await goTo(page, '#/class/c1/missing'); await page.waitForFunction(() => /Unit test/.test(document.querySelector('#bkBody').textContent));
  assert.match(await page.$eval('#bkBody', e => e.textContent), /Bram Sample/);
  await close();
});

test('a progress sheet for an MYP class shows levels, the total and the 1 to 7, each term’s levels, and no percent', async () => {
  const { page, close } = await openApp(browser, { seed: seedMissing() });
  await goTo(page, '#/class/c1/students/3'); await page.waitForSelector('#bkBody [data-pssone]');
  await page.click('#bkBody [data-pssone]'); await page.waitForSelector('#pssPages .pss');
  const sheet = () => page.$eval('#pssPages .pss', a => ({
    who: a.querySelector('h3').textContent, tiles: [...a.querySelectorAll('.psst')].map(t => [...t.children].map(x => x.textContent.replace(/\s+/g, ' ').trim()).join(' | ')),
    tasks: [...a.querySelectorAll('.pssgrid > section tbody tr')].map(r => [...r.cells].map(x => x.textContent).join(' | ')),
    terms: [...a.querySelectorAll('aside table tr')].map(r => [...r.cells].map(x => x.textContent).join(' ')), all: a.textContent }));
  let s = await sheet();
  assert.equal(s.who, 'Cleo Fixture');
  assert.deepEqual(s.tiles, ['Term grade | 7 out of 7 | total 30 of 32 · class middle 5', 'A Knowing and understanding | 8 of 8 | excellent · class middle 6', 'B Inquiring and designing | 8 of 8 | excellent · class middle 5',
    'C Processing and evaluating | 7 of 8 | excellent · class middle 6', 'D Reflecting on the impacts of science | 7 of 8 | excellent · class middle 6', 'Missing | 0 | nothing outstanding']);
  assert.deepEqual(s.tasks, ['Cells lab report | A D | Sep 12 | A 8 · D 7', 'Density inquiry | B C | Sep 30 | B 7 · C 8', 'Unit test | A | Oct 14 | A 8', 'Energy investigation | B C D | Nov 3 | B 8 · C 7 · D 7']);
  assert.deepEqual(s.terms, [' A B C D Total Grade', 'Term 1 8 8 7 7 30 7', 'Term 2 – – – – – –']);
  assert.doesNotMatch(s.all, /%|NaN|undefined|null|Scores over time/);
  assert.match(await page.$eval('#pssBody .pssbar', e => e.textContent), /Class middle level/);
  // without the class beside it
  await page.click('#pssBody [data-pssopt="cls"]'); await page.waitForFunction(() => !/class middle/.test(document.querySelector('#pssPages').textContent));
  assert.equal((await sheet()).tiles[0], 'Term grade | 7 out of 7 | total 30 of 32');
  await closeBox(page);
  // every student, from the Report comments tab: a grade that is not set says what is still to set, and Missing is named
  await goTo(page, '#/class/c1/reports'); await page.waitForSelector('#bkBody [data-pssall]');
  await page.click('#bkBody [data-pssall]'); await page.waitForFunction(() => document.querySelectorAll('#pssPages .pss').length === 6);
  const pages = await page.$$eval('#pssPages .pss', xs => xs.map(a => a.querySelector('.psst.main').textContent.replace(/\s+/g, ' ') + ' / ' + a.querySelector('aside').textContent));
  assert.match(pages[0], /–still to set: D/); assert.match(pages[1], /Missing workUnit test/); assert.match(pages[4], /still to set: A, B, C, D/);
  await close();
});

test('a new year keeps how an MYP class is graded, its criteria and its tasks’ criteria, and none of the levels', async () => {
  const { page, close } = await openApp(browser, { seed: ibSeed() });
  const r = await page.evaluate(() => {
    const G = window.__gs, old = JSON.parse(localStorage.getItem('gs.lib')); old.classes[0].ib.crit = [{ k: 'A', name: 'Knowing' }, { k: 'B', name: 'Inquiring' }, { k: 'C', name: 'Processing' }, { k: 'D', name: 'Reflecting' }];
    const o = { from: '2026–27', to: '2027–28', dates: false, file: 'f.gswork' };
    return [true, false].map(roster => { const c = G.nyLib(old, {}, { ...o, roster }).classes[0]; return { way: c.way, ib: c.ib, lv: 'lv' in c, names: c.names.length, items: c.units[0].items.map(i => [i.name, i.crit, i.typed]) }; });
  });
  for (const c of r) {
    assert.equal(c.way, 'myp'); assert.equal(c.lv, false, 'no student’s levels carry');
    assert.deepEqual(c.ib, { group: 'sci', crit: [{ k: 'A', name: 'Knowing' }, { k: 'B', name: 'Inquiring' }, { k: 'C', name: 'Processing' }, { k: 'D', name: 'Reflecting' }] });
    assert.deepEqual(c.items[0], ['Cells lab report', ['A', 'D'], { max: null, lv: true, s: {} }]);
  }
  assert.deepEqual(r.map(c => c.names), [6, 0]);
  await close();
});

// A made-up DP class with one summative and one in-class score for two students, and a points class with the same scores.
function dpSeed() {
  const names = ['Aria Testwell', 'Bram Sample'], items = c => [
    { id: c + 'a', name: 'Source paper', classId: c, type: 'sum', due: '2026-09-20', typed: { max: 24, s: { 'Aria Testwell': { v: 20, st: '' }, 'Bram Sample': { v: 12, st: '' } } } },
    { id: c + 'b', name: 'IA draft', classId: c, type: 'ic', due: '2026-10-02', typed: { max: 25, s: { 'Aria Testwell': { v: 10, st: '' }, 'Bram Sample': { v: 25, st: '' } } } }];
  const lib = { classes: [
    { id: 'c1', name: 'DP1 History HL', names, way: 'dp', ib: { bounds: [[80, 7], [68, 6], [56, 5], [44, 4], [32, 3], [18, 2], [0, 1]] }, units: [{ id: 'u1', name: 'Unit 1', items: items('c1') }] },
    { id: 'c2', name: 'Grade 9 English', names, units: [{ id: 'u2', name: 'Unit 1', items: items('c2') }] }],
    loose: { id: '', units: [] }, seed2627: true, book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2027-07-31' }] } };
  return { ls: { 'gs.lib': JSON.stringify(lib) } };
}
const grades = page => page.$$eval('#bkTab tbody tr:not(.bkfoot) td.bkterm', xs => xs.map(x => x.textContent.replace(/\s+/g, ' ').trim()));

test('a DP class weighs its components its own way, and no other class changes', async () => {
  const { page, close } = await openApp(browser, { seed: dpSeed() });
  await goTo(page, '#/class/c1/gradebook'); await page.waitForSelector('#bkTab');
  assert.deepEqual(await grades(page), ['61.50% 5', '75.00% 6']);   // the usual weights: 83% and 40%, 50% and 100%, each type half
  await page.click('#vClass [data-ib-class]'); await page.waitForSelector('#ibComps [data-ibw]');
  assert.deepEqual(await page.$$eval('#ibComps [data-ibw]', xs => xs.map(x => x.dataset.ibw + ' ' + x.value)), ['ic 50', 'sum 50']);
  await type(page, '#ibComps [data-ibw="sum"]', '80'); await type(page, '#ibComps [data-ibw="ic"]', '20');
  await page.click('#dlgBox [data-ok]'); await shut(page);
  assert.deepEqual((await stored(page)).classes[0].ib.w, { ic: 20, sum: 80 });
  await page.waitForFunction(() => /74\.40%/.test(document.querySelector('#bkTab tbody td.bkterm').textContent));
  assert.deepEqual(await grades(page), ['74.40% 6', '60.00% 5']);   // 0.8 × 83 + 0.2 × 40, 0.8 × 50 + 0.2 × 100
  await goTo(page, '#/class/c1/students'); await page.waitForFunction(() => /74\.40%/.test((document.querySelector('#peopleTbl td[data-pg]') || {}).textContent || ''));
  assert.deepEqual(await page.$$eval('#peopleTbl td[data-pg]', xs => xs.map(x => x.textContent)), ['74.40% · 6', '60.00% · 5']);
  await goTo(page, '#/class/c2/gradebook'); await page.waitForFunction(() => /61\.50%/.test((document.querySelector('#bkTab tbody td.bkterm') || {}).textContent || ''));
  assert.deepEqual(await grades(page), ['61.50%', '75.00%'], 'the points class keeps the usual weights');
  // every component at nothing is refused; the usual weights again leave nothing stored
  await goTo(page, '#/class/c1/gradebook'); await page.waitForSelector('#bkTab');
  await page.click('#vClass [data-ib-class]'); await page.waitForSelector('#ibComps [data-ibw]');
  await type(page, '#ibComps [data-ibw="sum"]', '0'); await type(page, '#ibComps [data-ibw="ic"]', '0');
  await page.click('#dlgBox [data-ok]'); await page.waitForFunction(() => /At least one component/.test(document.body.textContent));
  await type(page, '#ibComps [data-ibw="sum"]', '50'); await type(page, '#ibComps [data-ibw="ic"]', '50');
  await page.click('#dlgBox [data-ok]'); await shut(page);
  assert.equal('w' in (await stored(page)).classes[0].ib, false);
  await close();
});

test('predicted grades for a DP class: the worked-out grade is a hint, a click sets one and a second click clears it', async () => {
  const { page, close } = await openApp(browser, { seed: dpSeed() });
  await goTo(page, '#/class/c1/gradebook'); await page.waitForSelector('#bkBody [data-ibpredopen]');
  await page.click('#bkBody [data-ibpredopen]'); await page.waitForSelector('#ibPred');
  const rows = () => page.$$eval('#ibPred tbody tr', xs => xs.map(r => [r.cells[1].textContent, r.cells[2].textContent, (r.querySelector('.iblvl .hint') || {}).textContent || '', (r.querySelector('.iblvl .on') || {}).textContent || ''].join(' | ')));
  assert.deepEqual(await rows(), ['61.50% | 5 | 5 | ', '75.00% | 6 | 6 | ']);
  assert.equal((await stored(page)).classes[0].pred, undefined, 'the hint sets nothing');
  await page.click('#ibPred [data-ibpred="1:7"]'); await page.waitForFunction(() => document.querySelector('#ibPred [data-ibpred="1:7"]').classList.contains('on'));
  assert.deepEqual(await rows(), ['61.50% | 5 | 5 | ', '75.00% | 6 |  | 7']);
  assert.equal((await stored(page)).classes[0].pred.t1['Bram Sample'].g, 7);
  await page.click('#bkBody [data-ibback]'); await page.waitForSelector('#bkTab');
  assert.deepEqual(await grades(page), ['61.50% 5', '75.00% 6 predicted 7']);
  // the progress sheet says both
  await goTo(page, '#/class/c1/students/2'); await page.waitForSelector('#bkBody [data-pssone]');
  await page.click('#bkBody [data-pssone]'); await page.waitForSelector('#pssPages .pss');
  assert.match(await page.$eval('#pssPages .psst.main', e => e.textContent), /75\.00%.*IB grade 6 · predicted 7/);
  await closeBox(page);
  // a new year keeps the class's weights and boundaries, and no predicted grade
  const ny = await page.evaluate(() => { const G = window.__gs, old = JSON.parse(localStorage.getItem('gs.lib')); old.classes[0].ib.w = { sum: 80, ic: 20 };
    const c = G.nyLib(old, {}, { from: '2026–27', to: '2027–28', dates: false, roster: true, file: 'f.gswork' }).classes[0]; return [c.way, c.ib.w, 'pred' in c]; });
  assert.deepEqual(ny, ['dp', { sum: 80, ic: 20 }, false]);
  await goTo(page, '#/class/c1/gradebook'); await page.waitForSelector('#bkBody [data-ibpredopen]');
  await page.click('#bkBody [data-ibpredopen]'); await page.waitForSelector('#ibPred');
  await page.click('#ibPred [data-ibpred="1:7"]'); await page.waitForFunction(() => !document.querySelector('#ibPred .iblvl .on'));
  assert.equal((await stored(page)).classes[0].pred.t1['Bram Sample'].g, undefined);
  assert.equal(await page.evaluate(() => window.__gs.ibPredOf(window.__gs.state().lib.classes[0], 'Bram Sample', 't1')), null);
  await close();
});
