// Group work: one paper for several students, marked and graded once. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, pickFile, appReady, waitPaper, goToStudent, score, settle, setTool, drag, answerDlg, pick } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const who = page => page.evaluate(() => Object.fromEntries(window.__gs.state().batch.students.map(s => [s.key, {
  total: window.__gs.gradeOf(s).total, comment: s.grade.comment || '',
  marks: s.files.map(f => Object.values(f.marks).reduce((n, a) => n + a.length, 0)),
}])));
const idx = (page, key) => page.evaluate(k => window.__gs.state().batch.students.findIndex(s => s.key === k), key);
const shareTo = async (page, key) => {
  const i = await idx(page, key);
  await page.click('#dlgBox [data-shto="' + i + '"]');
  await page.waitForFunction(i => { const b = document.querySelector('#dlgBox [data-shto="' + i + '"]'); return b && /In the group/.test(b.textContent); }, {}, i);
};

test('Group work…: partners get the paper, one set of marks and one grade; Grade on their own splits one off; kept after reopening', async () => {
  const { page, close } = await openApp(browser);
  const zip = zipOf({
    'Aria Testwell/Poster.pdf': await makePaper({ title: 'Our volcano poster' }),
    'Bram Sample/Other.pdf': await makePaper({ title: 'Something else' }),
    'Cleo Fixture/Notes.pdf': await makePaper({ title: 'Cleo notes' }),
  });
  await openZip(page, zip);
  await waitPaper(page);
  await pick(page, '#paper [data-shfile]');
  await page.waitForSelector('#grpOnce');
  assert.equal(await page.$eval('#grpOnce', e => e.getAttribute('aria-checked')), 'true', 'on by default');
  await shareTo(page, 'Bram Sample');
  await shareTo(page, 'Cleo Fixture');
  await page.click('#dlgBox .bf [data-cancel]');
  await waitPaper(page);
  await page.waitForSelector('#grpBand');
  assert.match(await page.$eval('#grpBand', e => e.textContent), /with Bram Sample and Cleo Fixture · marks and grade shared/);

  // A mark on Aria's paper is on both copies; a score given on Bram's paper is everyone's.
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [160, 330], [220, 300]]); await setTool(page, 'select');
  await goToStudent(page, await idx(page, 'Bram Sample'));
  await page.waitForSelector('#grpBand');
  await score(page, [4, 3.5, 3]);
  let w = await who(page);
  assert.deepEqual(w['Bram Sample'].marks, [0, 1], 'Bram’s own file stays unmarked, the poster copy has the mark');
  assert.deepEqual(w['Cleo Fixture'].marks, [0, 1]);
  assert.equal(w['Aria Testwell'].total, 10.5); assert.equal(w['Cleo Fixture'].total, 10.5); assert.equal(w['Bram Sample'].total, 10.5);
  const chips = await page.$$eval('#stuList .stu', b => b.map(x => [x.querySelector('.nm').textContent, [...x.querySelectorAll('.add')].map(a => a.textContent).join()]));
  assert.deepEqual(chips.map(c => c[1]), ['group', 'group', 'group']);

  // Still together after reopening.
  await settle(page);
  await page.reload(); await appReady(page);
  await openZip(page, zip);
  await waitPaper(page);
  await page.waitForFunction(() => window.__gs.state().batch.students.every(s => s.files.length >= (s.key === 'Aria Testwell' ? 1 : 2)));
  await goToStudent(page, await idx(page, 'Cleo Fixture'));
  await page.waitForSelector('#grpBand');
  await page.waitForFunction(() => window.__gs.state().batch.students.find(s => s.key === 'Cleo Fixture').files[1].marks === window.__gs.state().batch.students.find(s => s.key === 'Aria Testwell').files[0].marks);
  await page.click('#cmtIn'); await page.keyboard.type('Clear labels');
  await page.waitForFunction(() => window.__gs.state().batch.students.every(s => s.grade.comment === 'Clear labels'));

  // Cleo is graded on her own from here: her score changes, the others keep theirs, and a new mark on the poster isn't on her copy.
  await page.click('#grpBand [data-grpout]');
  await answerDlg(page);
  await page.waitForFunction(() => !document.querySelector('#grpBand [data-grpout]'));
  await score(page, [2, 2, 2]);
  w = await who(page);
  assert.equal(w['Cleo Fixture'].total, 6); assert.equal(w['Aria Testwell'].total, 10.5); assert.equal(w['Bram Sample'].total, 10.5);
  assert.equal(w['Cleo Fixture'].comment, 'Clear labels', 'she keeps what she had');
  await goToStudent(page, await idx(page, 'Aria Testwell'));
  await page.waitForSelector('#grpBand');
  assert.match(await page.$eval('#grpBand', e => e.textContent), /with Bram Sample ·/);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 500], [160, 530], [220, 500]]); await setTool(page, 'select');
  w = await who(page);
  assert.deepEqual([w['Aria Testwell'].marks, w['Bram Sample'].marks, w['Cleo Fixture'].marks], [[2], [0, 2], [0, 1]]);
  assert.deepEqual(page.errors, []);
  await close();
});

test('pages given to several in a scan split: Mark and grade once for the group joins them', async () => {
  const { page, close } = await openApp(browser);
  await pickFile(page, '#scanIn', await makePaper({ title: 'Posters', pages: 2 }), 'Posters.pdf');
  await page.waitForSelector('#spPages');
  await page.waitForFunction(() => window.__gs.sp().thumbs.filter(Boolean).length === 2, { timeout: 60000 });
  for (const nm of ['Aria Testwell', 'Bram Sample']) {
    await page.click('#spAdd'); await answerDlg(page, { typed: nm });
    await page.waitForFunction(nm => [...document.querySelectorAll('#spNames b')].some(b => b.textContent === nm), {}, nm);
  }
  const nameAt = nm => page.evaluate(nm => window.__gs.sp().names.indexOf(nm), nm);
  await page.click('#spSev');
  await page.click('#spPages [data-spg="0"] .spf');
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.down(mod); await page.click('#spPages [data-spg="1"] .spf'); await page.keyboard.up(mod);
  await page.click('#spNames [data-spn="' + await nameAt('Aria Testwell') + '"]');
  await page.click('#spNames [data-spn="' + await nameAt('Bram Sample') + '"]');
  await page.click('#spGo');
  await waitPaper(page);
  await page.waitForFunction(() => window.__gs.state().batch.students.length === 2);
  await page.waitForSelector('#grpBand [data-grpjoin]');
  await page.click('#grpBand [data-grpjoin]');
  await page.waitForSelector('#grpBand [data-grpout]');
  await page.waitForFunction(() => window.__gs.state().pages[0] && window.__gs.state().pages[0].canvas);
  assert.match(await page.$eval('#grpBand', e => e.textContent), /marks and grade shared/);
  await score(page, [4, 4, 4]);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [160, 330]]); await setTool(page, 'select');
  const w = await who(page);
  assert.equal(w['Aria Testwell'].total, 12); assert.equal(w['Bram Sample'].total, 12);
  assert.deepEqual(w['Bram Sample'].marks, w['Aria Testwell'].marks);
  assert.deepEqual(w['Bram Sample'].marks, [1]);
  assert.deepEqual(page.errors, []);
  await close();
});
