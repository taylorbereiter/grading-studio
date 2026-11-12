// A rubric row's scale: 0 to 4 with half points unless the teacher says otherwise. In the real built app; every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goTo, score, settle, answerDlg } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => {
  browser = await launch();
  const files = {};
  for (const n of ['Ada Zero', 'Ben Sample', 'Cam Madeup']) files[n + '/Essay.pdf'] = await makePaper({ title: n + ' essay' });
  zip = zipOf(files);
});
after(async () => { await browser.close(); });

const openSetup = async page => { await page.evaluate(() => window.__gs.openSetup()); await page.waitForSelector('#setupBody'); await page.waitForFunction(() => !window.__gs.bankBusy()); };
const saveSetup = async page => { await page.click('#dlgBox [data-save]'); await page.waitForFunction(() => document.querySelector('#dlg').hidden); };
const setupOf = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().setup)));
const sticks = (page, r) => page.$$eval('.scores[data-c="' + r + '"] .sticks button', b => b.map(x => +x.dataset.v));
const total = page => page.$eval('#grade .total', e => e.textContent.replace(/\s+/g, ' ').trim());

test('a setup that says nothing is 0 to 4 with half points, exactly as before', async () => {
  const { page, close } = await openApp(browser);
  const r = await page.evaluate(() => {
    const g = window.__gs, su = { mode: 'rubric', criteria: ['A', 'B', 'C'], scale: null };
    return {
      steps: g.rowSteps(su, 0), same: JSON.stringify(g.rowSteps(su, 0)) === JSON.stringify(g.RUBRIC_STEPS), max: g.setupMax(su), top: g.rowTop(su, 2), keys: g.rowScaleOf(su),
      eight: g.rowSteps({ ...su, top: 8, half: false }, 0), eightMax: g.setupMax({ ...su, top: 8 }),
      own: [0, 1, 2].map(i => g.rowTop({ ...su, top: 8, tops: [5, null, 10] }, i)), ownMax: g.setupMax({ ...su, top: 8, tops: [5, null, 10] }),
      bad: [g.rowTop({ ...su, top: 0 }), g.rowTop({ ...su, top: 99 }), g.rowTop({ ...su, top: 'x' })], one: g.rowSteps({ ...su, top: 1 }, 0),
      points: g.setupMax({ mode: 'points', outOf: 20, top: 8 }),
      tidy: g.rowScaleOf({ top: 4, half: true }), tidy8: g.rowScaleOf({ top: '8', half: false, tops: [null, 6] }),
    };
  });
  assert.equal(r.same, true); assert.deepEqual(r.steps, [0, 1, 1.5, 2, 2.5, 3, 3.5, 4]);
  assert.equal(r.max, 12); assert.equal(r.top, 4); assert.deepEqual(r.keys, {}, 'nothing is written for the usual scale');
  assert.deepEqual(r.eight, [0, 1, 2, 3, 4, 5, 6, 7, 8]); assert.equal(r.eightMax, 24);
  assert.deepEqual(r.own, [5, 8, 10], 'a row can have its own top'); assert.equal(r.ownMax, 23);
  assert.deepEqual(r.bad, [4, 4, 4], 'a top that makes no sense reads as 4'); assert.deepEqual(r.one, [0, 1]);
  assert.equal(r.points, 20, 'a points setup ignores the row scale');
  assert.deepEqual(r.tidy, {}); assert.deepEqual(r.tidy8, { top: 8, tops: [null, 6], half: false });
  assert.deepEqual(page.errors, []);
  await close();
});

test('saved work with no row scale stays 0 to 4 whatever the teacher’s usual scale becomes', async () => {
  const { page, close } = await openApp(browser);
  const r = await page.evaluate(() => {
    const g = window.__gs, D = g.DEFAULT_SETUP;
    D.top = 8; D.half = false;   // as if she had just set 0 to 8 as her usual scale
    try {
      const old = { mode: 'rubric', criteria: ['A', 'B', 'C'], scale: null }, grade = { rubric: [4, 3.5, 3], points: '' };
      return { over: g.setupOver(old), fresh: g.setupOver(null), past: g.pastScore(old, grade), new8: g.pastScore({ ...old, top: 8, half: false }, { rubric: [8, 6, 7], points: '' }) };
    } finally { delete D.top; delete D.half; }
  });
  assert.equal('top' in r.over, false); assert.equal('half' in r.over, false);
  assert.equal(r.fresh.top, 8, 'a brand-new assignment starts from her usual scale');
  assert.equal(r.past.total, 10.5); assert.equal(r.past.max, 12); assert.equal(r.past.pct, 88);
  assert.deepEqual(r.past.rows, [['A', 4], ['B', 3.5], ['C', 3]], 'rows on the usual scale carry no top');
  assert.equal(r.new8.max, 24); assert.equal(r.new8.pct, 88); assert.deepEqual(r.new8.rows[0], ['A', 8, 8]);
  await close();
});

test('Rubric setup changes the scale, and scoring, keys and the total follow it', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  assert.deepEqual(await sticks(page, 0), [0, 1, 1.5, 2, 2.5, 3, 3.5, 4]);
  await score(page, [3.5, 3, 4]);
  await openSetup(page);
  assert.equal(await page.$eval('#rowTopSel', e => e.value), '4'); assert.equal(await page.$eval('#rowHalfIn', e => e.checked), true);
  await page.click('#dlgBox [data-preset="none"]');
  await page.select('#rowTopSel', '8');
  await page.waitForFunction(() => /Out of 24 in all/.test(document.querySelector('.rowscale').textContent));
  await page.click('#rowHalfIn');
  await page.click('#dlgBox [data-save]');
  await answerDlg(page);   // one student has a half point, which this scale doesn't have
  assert.match(page.lastDialog, /1 student has a score that this scale doesn’t have/);
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  const su = await setupOf(page);
  assert.equal(su.top, 8); assert.equal(su.half, false);
  assert.deepEqual(await sticks(page, 0), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.match(await total(page), /10\.5/, 'the scores she gave stay as given');
  assert.match(await page.$eval('.crit[data-row="1"] .cn em', e => e.textContent), /3\s*\/ 8/);
  await page.evaluate(() => window.__gs.openStudent(1));
  await score(page, [5, null, null]);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  for (const k of ['8', '6', '7']) await page.keyboard.press(k);   // the row just clicked is the one in hand; each number scores a row and moves on
  await page.waitForFunction(() => window.__gs.state().batch.students[1].grade.rubric[2] === 7);
  assert.match(await total(page), /21/); assert.match(await total(page), /88%/);
  await page.keyboard.press('9');
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.students[1].grade.rubric), [8, 6, 7], 'a number above the top is not a score');
  // back to the usual scale: the keys go, so the setup is stored as it always was
  await openSetup(page);
  await page.select('#rowTopSel', '4'); await page.waitForFunction(() => /Out of 12 in all/.test(document.querySelector('.rowscale').textContent));
  await page.click('#rowHalfIn');
  await page.click('#dlgBox [data-save]'); await answerDlg(page);
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  const back = await setupOf(page);
  assert.equal('top' in back, false); assert.equal('half' in back, false);
  await settle(page);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a teacher’s usual row scale is in Settings, only once they have said how they grade', async () => {
  const old = await openApp(browser);
  await goTo(old.page, '#/settings/grading');
  assert.equal(await old.page.$('#meRowTop'), null, 'a browser from before is asked nothing new');
  await old.close();
  const { page, close } = await openApp(browser, { newTeacher: true });
  await page.evaluate(() => { for (let i = 0; i < 3; i++) document.querySelector('#welcome [data-wlnext]').click(); });
  await goTo(page, '#/settings/grading');
  await page.waitForSelector('#meRowTop');
  assert.equal(await page.$eval('#meRowTop', e => e.value), '4');
  await page.select('#meRowTop', '8');
  await page.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('gs.lib') || '{}'); return l.me && l.me.grade && l.me.grade.setup.top === 8; });
  await page.click('#meRowHalf');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('gs.lib')).me.grade.setup.half === false);
  const s = await setupOf(page);
  assert.equal(s.top, 8); assert.equal(s.half, false);
  assert.equal(await page.evaluate(() => window.__gs.setupMax(window.__gs.state().setup)), 24);
  await page.select('#meRowTop', '4'); await page.click('#meRowHalf');
  await page.waitForFunction(() => { const su = JSON.parse(localStorage.getItem('gs.lib')).me.grade.setup; return !('top' in su) && !('half' in su); });
  assert.deepEqual(page.errors, []);
  await close();
});
