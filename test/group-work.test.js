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
  assert.match(await page.$eval('#grpBand', e => e.textContent), /with Bram Sample and Cleo Fixture ·/);
  assert.equal(await page.$eval('#grpBand [data-grpmode]', e => e.value), 'all', 'one grade by default');

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
  assert.deepEqual(chips.map(c => c[1]), ['', '', '']); assert.equal(await page.$$eval('#stuList .stugrp .stu', l => l.length), 3, 'the three sit together in one box');

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

test('Shared notes, own scores: one notes page and typed notes, each partner’s own score and comment, marks just for one; kept after reopening; back to one grade, and undo', async () => {
  const { page, close } = await openApp(browser);
  const zip = zipOf({
    'Aria Testwell/Talk.pdf': await makePaper({ title: 'Our talk' }),
    'Bram Sample/Other.pdf': await makePaper({ title: 'Something else' }),
  });
  await openZip(page, zip);
  await waitPaper(page);
  await pick(page, '#paper [data-shfile]');
  await page.waitForSelector('#grpOwn');
  await page.click('#grpOwn');
  assert.equal(await page.$eval('#grpOwn', e => e.getAttribute('aria-checked')), 'true');
  await shareTo(page, 'Bram Sample');
  await page.click('#dlgBox .bf [data-cancel]');
  await waitPaper(page);
  await page.waitForSelector('#grpBand [data-grpmode]');
  assert.equal(await page.$eval('#grpBand [data-grpmode]', e => e.value), 'own');

  // A mark on Aria's paper is on both; scores and comments are each their own; typed notes go to both.
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [160, 330], [220, 300]]); await setTool(page, 'select');
  await score(page, [4, 4, 4]);
  await page.click('#cmtIn'); await page.keyboard.type('Aria: clear voice');
  await page.evaluate(() => { const s = window.__gs.state().batch.students.find(x => x.key === 'Aria Testwell'); s.grade.tn = { l: [{ s: 'Good hook for both', k: 'p' }] }; window.__gs.saveSoon(); });
  await goToStudent(page, await idx(page, 'Bram Sample'));
  await page.waitForSelector('#grpBand [data-grpjust]');
  await score(page, [2, 2.5, 3]);
  await page.click('#cmtIn'); await page.keyboard.type('Bram: speak up');
  let w = await who(page);
  assert.equal(w['Aria Testwell'].total, 12); assert.equal(w['Bram Sample'].total, 7.5);
  assert.equal(w['Aria Testwell'].comment, 'Aria: clear voice'); assert.equal(w['Bram Sample'].comment, 'Bram: speak up');
  assert.deepEqual(w['Bram Sample'].marks, [0, 1]);
  // partners count once, and sit together in the list
  assert.match(await page.$eval('#progS .ph', e => e.textContent), /^1 of 1 scored/);
  assert.equal(await page.$$eval('#stuList .stugrp .stu', l => l.length), 2);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__gs.state().batch.students.find(x => x.key === 'Bram Sample').grade.tn)), JSON.stringify({ l: [{ s: 'Good hook for both', k: 'p' }] }));

  // Just Bram: a mark only on his paper.
  await page.click('#grpBand [data-grpjust="1"]');
  await page.waitForFunction(() => document.querySelector('#grpBand [data-grpjust="1"]').getAttribute('aria-pressed') === 'true');
  const talk = await page.evaluate(() => window.__gs.state().pages.findIndex(g => g.file.name === 'Talk.pdf'));
  await setTool(page, 'pen'); await drag(page, talk, [[100, 500], [160, 530], [220, 500]]); await setTool(page, 'select');
  const seen = () => page.evaluate(() => { const b = window.__gs.state().batch; return b.students.map(s => { const f = s.files.find(x => x.name === 'Talk.pdf'); return f ? window.__gs.marksMine(f.marks[0] || [], f, s).length : -1; }); });
  assert.deepEqual(await seen(), [1, 2], 'Aria sees the shared mark, Bram sees it and his own');

  await settle(page);
  assert.deepEqual(await page.evaluate(() => [...window.__gs.kept().values()].map(m => [m.n, m.scored])), [[1, 1]], 'the download counts one paper, scored');

  // Kept after reopening: still own scores, saved apart from the shared groups.
  await settle(page);
  await page.reload(); await appReady(page);
  await openZip(page, zip);
  await waitPaper(page);
  await page.waitForFunction(() => window.__gs.state().batch.students.every(s => s.files.length >= 1) && (window.__gs.state().batch.groups || []).length === 1);
  w = await who(page);
  assert.equal(w['Aria Testwell'].total, 12); assert.equal(w['Bram Sample'].total, 7.5);
  assert.deepEqual(await seen(), [1, 2]);
  await goToStudent(page, await idx(page, 'Aria Testwell'));
  await page.waitForSelector('#grpBand [data-grpmode]');
  assert.equal(await page.$eval('#grpBand [data-grpmode]', e => e.value), 'own');

  // Back to one grade from Aria's paper: her score and comment go to Bram, and his own mark goes. Undo puts his back.
  await page.select('#grpBand [data-grpmode]', 'all');
  await answerDlg(page);
  await page.waitForFunction(() => window.__gs.state().batch.students.every(s => s.grade.comment === 'Aria: clear voice'));
  w = await who(page);
  assert.equal(w['Bram Sample'].total, 12);
  assert.deepEqual(await seen(), [1, 1]);
  await page.evaluate(() => window.__gs.undo());
  await page.waitForFunction(() => window.__gs.state().batch.students.find(s => s.key === 'Bram Sample').grade.comment === 'Bram: speak up');
  w = await who(page);
  assert.equal(w['Bram Sample'].total, 7.5); assert.equal(w['Aria Testwell'].total, 12);
  assert.deepEqual(await seen(), [1, 2]);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Group score, adjust a partner: one score for the group, a row changed just for one partner stays theirs; counts once; kept after reopening; Use group score, and undo', async () => {
  const { page, close } = await openApp(browser);
  const zip = zipOf({
    'Aria Testwell/Talk.pdf': await makePaper({ title: 'Our talk' }),
    'Bram Sample/Other.pdf': await makePaper({ title: 'Something else' }),
  });
  await openZip(page, zip);
  await waitPaper(page);
  await pick(page, '#paper [data-shfile]');
  await page.waitForSelector('#dlgBox [data-shto]');
  await shareTo(page, 'Bram Sample');
  await page.click('#dlgBox .bf [data-cancel]');
  await waitPaper(page);
  await page.waitForSelector('#grpBand [data-grpmode]');
  await page.select('#grpBand [data-grpmode]', 'adj');
  await page.waitForFunction(() => { const s = document.querySelector('#grpBand [data-grpmode]'); return s && s.value === 'adj'; });
  await page.waitForSelector('#grpNote');

  // Scored on Aria's paper: the group score goes to Bram too. Comments stay each their own.
  await score(page, [4, 4, 4]);
  await page.click('#cmtIn'); await page.keyboard.type('Aria: clear voice');
  await goToStudent(page, await idx(page, 'Bram Sample'));
  await page.waitForSelector('#grpNote');
  let w = await who(page);
  assert.equal(w['Bram Sample'].total, 12, 'the group score is Bram’s too');
  assert.equal(w['Bram Sample'].comment, '');

  // Just Bram: one row changed is his alone, and the note says so.
  await page.click('#grpBand [data-grpjust="1"]');
  await page.waitForSelector('#grpNote.just');
  await score(page, [null, null, 3]);
  await page.waitForFunction(() => window.__gs.state().batch.students.find(s => s.key === 'Bram Sample').grade.adj);
  w = await who(page);
  assert.equal(w['Bram Sample'].total, 11); assert.equal(w['Aria Testwell'].total, 12);
  await page.waitForSelector('#grpNote [data-grpreset="2"]');

  // Back on Both, a change on Aria's paper goes to Bram, and his own row stays his.
  await page.click('#grpBand [data-grpjust="0"]');
  await goToStudent(page, await idx(page, 'Aria Testwell'));
  await page.waitForSelector('#grpNote');
  await score(page, [3]);
  await page.waitForFunction(() => window.__gs.gradeOf(window.__gs.state().batch.students.find(s => s.key === 'Bram Sample')).total === 10);
  w = await who(page);
  assert.equal(w['Aria Testwell'].total, 11);
  assert.match(await page.$eval('#progS .ph', e => e.textContent), /^1 of 1 scored/, 'partners count once');

  // Kept after reopening.
  await settle(page);
  await page.reload(); await appReady(page);
  await openZip(page, zip);
  await waitPaper(page);
  await page.waitForFunction(() => window.__gs.state().batch.students.every(s => s.files.length >= 1) && (window.__gs.state().batch.groups || []).length === 1);
  w = await who(page);
  assert.equal(w['Aria Testwell'].total, 11); assert.equal(w['Bram Sample'].total, 10);
  await goToStudent(page, await idx(page, 'Bram Sample'));
  await page.waitForSelector('#grpBand [data-grpmode]');
  assert.equal(await page.$eval('#grpBand [data-grpmode]', e => e.value), 'adj');

  // Use group score puts the group's row back on Bram. Undo puts his own back.
  await page.click('#grpNote [data-grpreset="2"]');
  await page.waitForFunction(() => window.__gs.gradeOf(window.__gs.state().batch.students.find(s => s.key === 'Bram Sample')).total === 11);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students.find(s => s.key === 'Bram Sample').grade.adj), undefined);
  await page.evaluate(() => window.__gs.undo());
  await page.waitForFunction(() => window.__gs.gradeOf(window.__gs.state().batch.students.find(s => s.key === 'Bram Sample')).total === 10);
  await settle(page);
  w = await who(page);
  assert.equal(w['Aria Testwell'].total, 11, 'undo on Bram leaves Aria as she was');
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
  assert.equal(await page.$eval('#grpBand [data-grpmode]', e => e.selectedOptions[0].textContent), 'Marks and grade shared');
  await score(page, [4, 4, 4]);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [160, 330]]); await setTool(page, 'select');
  const w = await who(page);
  assert.equal(w['Aria Testwell'].total, 12); assert.equal(w['Bram Sample'].total, 12);
  assert.deepEqual(w['Bram Sample'].marks, w['Aria Testwell'].marks);
  assert.deepEqual(w['Bram Sample'].marks, [1]);
  assert.deepEqual(page.errors, []);
  await close();
});
