// Replace… on a student's paper keeps the score and has Undo, and a video link can be replaced by a new link for the student and partners.
// Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, waitPaper, goToStudent, markPage, settle, noStamps } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });
async function noWeb(page) {
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url(); if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u) || /^(data|blob|about):/.test(u)) return r.continue(); r.abort(); });
}
const files = (page, i) => page.evaluate(i => { const st = window.__gs.state().batch.students[i]; return { files: st.files.map(f => f.path), gone: (st.gone || []).map(f => f.path) }; }, i);

test('a replaced paper keeps the score, the old file keeps its marks, and Undo and Redo swap them back and forth', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': await makePaper({ title: 'Aria essay' }), 'Bram Sample/Essay.pdf': await makePaper({ title: 'Bram essay', pages: 2 }) }), 'Essays.zip');
  await goToStudent(page, 1);
  await markPage(page, 0); await settle(page);
  await page.evaluate(() => { const st = window.__gs.state().batch.students[1]; st.grade.score = 17; st.grade.max = 20; window.__gs.saveNow(); });
  const grade0 = await page.evaluate(() => JSON.stringify(window.__gs.state().batch.students[1].grade));
  const scan = Array.from(await makePaper({ title: 'Bram rescan', pages: 2 }));
  await page.evaluate(b => { const st = window.__gs.state().batch.students[1]; window.__gs.askReplace(st, 'Bram Sample/Essay.pdf', new File([new Uint8Array(b)], 'Rescan.pdf', { type: 'application/pdf' })); }, scan);
  await page.waitForSelector('#dlgBox [data-ok]');
  const said = await page.$eval('#dlgBox', d => d.textContent);
  assert.match(said, /Essay\.pdf.*2 pages · \d+ marks.*Rescan\.pdf.*2 pages · new/s);
  assert.match(said, /The score stays as it is/);
  await page.click('#dlgBox [data-ok]');
  await page.waitForFunction(() => window.__gs.state().batch.students[1].files.some(f => f.name === 'Rescan.pdf'));
  await waitPaper(page);
  assert.deepEqual(await files(page, 1), { files: ['Bram Sample/Rescan.pdf'], gone: ['Bram Sample/Essay.pdf'] });
  assert.equal(await page.evaluate(() => JSON.stringify(window.__gs.state().batch.students[1].grade)), grade0, 'the score is the same');
  assert.ok(await page.evaluate(() => Object.values(window.__gs.state().batch.students[1].gone[0].marks).flat().length > 0), 'the old file keeps its marks');

  // Undo from the note: the essay is back on the paper and the rescan waits under Removed files (it doesn't come back by itself)
  await page.click('.toast .tact');
  await page.waitForFunction(() => window.__gs.state().batch.students[1].files[0].name === 'Essay.pdf');
  assert.deepEqual(await files(page, 1), { files: ['Bram Sample/Essay.pdf'], gone: ['Bram Sample/Rescan.pdf'] });
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.removed), { 'Bram Sample/Rescan.pdf': await page.evaluate(() => window.__gs.state().batch.removed['Bram Sample/Rescan.pdf']) });
  assert.ok(!(await page.evaluate(() => window.__gs.state().batch.removed['Bram Sample/Essay.pdf'])));

  // Replace again, then Undo and Redo with the keys
  await page.evaluate(b => { const st = window.__gs.state().batch.students[1]; return window.__gs.replaceDo(st, 'Bram Sample/Essay.pdf', new File([new Uint8Array(b)], 'Rescan two.pdf', { type: 'application/pdf' })); }, scan);
  await waitPaper(page);
  assert.equal((await files(page, 1)).files[0], 'Bram Sample/Rescan two.pdf');
  await page.evaluate(() => window.__gs.undo());
  await page.waitForFunction(() => window.__gs.state().batch.students[1].files[0].name === 'Essay.pdf');
  await page.evaluate(() => window.__gs.redo());
  await page.waitForFunction(() => window.__gs.state().batch.students[1].files[0].name === 'Rescan two.pdf');
  assert.deepEqual((await files(page, 1)).gone.sort(), ['Bram Sample/Essay.pdf', 'Bram Sample/Rescan.pdf']);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.removed['Bram Sample/Essay.pdf'].by), 'Bram Sample/Rescan two.pdf');
  assert.equal(await page.evaluate(() => JSON.stringify(window.__gs.state().batch.students[1].grade)), grade0);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a video link: Replace… takes a new link, partners get it too, and clips follow it; with a notes page, she can keep it to one student', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, zipOf({ 'Aria Testwell/Outline.pdf': await makePaper({ title: 'Aria outline' }), 'Bram Sample/Outline.pdf': await makePaper({ title: 'Bram outline' }), 'Cai Example/Outline.pdf': await makePaper({ title: 'Cai outline' }) }), 'Talks.zip');
  await waitPaper(page);
  await page.evaluate(() => { const G = window.__gs, S = G.state().batch.students; return G.videoAdd(S[0], { url: 'https://youtu.be/abcDEF12345', name: 'Presentation video', kind: '', partners: [S[1]] }); });
  await page.evaluate(() => { const b = window.__gs.state().batch; b.clips = [{ id: 'c1', u: 'https://youtu.be/abcDEF12345', a: 5, t: 'Opening' }]; });
  await page.waitForSelector('#paper [data-rplfile$=".url"]');
  await page.$eval('#paper [data-rplfile$=".url"]', b => b.click());
  await page.waitForSelector('#rpLink');
  assert.ok(await page.$eval('#rpLinkGo', b => b.disabled));
  await page.type('#rpLink', 'https://youtu.be/xyzXYZ98765');
  await page.click('#rpLinkGo');
  await page.waitForSelector('#dlgBox [data-ok]');
  // the video is what the two share (no notes page), so it changes for both without asking
  assert.match(await page.$eval('#dlgBox', d => d.textContent), /Presentation video.*youtu\.be.*Bram Sample shares this/s);
  await page.click('#dlgBox [data-ok]');
  await page.waitForFunction(() => window.__gs.state().batch.students.slice(0, 2).every(s => s.files.some(f => f.kind === 'link' && window.__gs.linkKey(f) === 'https://youtu.be/xyzXYZ98765')));
  const keys = await page.evaluate(() => window.__gs.state().batch.students.map(s => s.files.filter(f => f.kind === 'link').map(f => window.__gs.linkKey(f))));
  assert.deepEqual(keys, [['https://youtu.be/xyzXYZ98765'], ['https://youtu.be/xyzXYZ98765'], []]);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.clips[0].u), 'https://youtu.be/xyzXYZ98765', 'the clip follows the new link');
  assert.match(await page.$eval('.toast', t => t.textContent), /Replaced Presentation video for Aria Testwell and Bram Sample/);

  // Undo: both partners have the old link again, and the clip goes back to it
  await page.click('.toast .tact');
  await page.waitForFunction(() => window.__gs.state().batch.clips[0].u === 'https://youtu.be/abcDEF12345');
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.students.map(s => s.files.filter(f => f.kind === 'link').map(f => window.__gs.linkKey(f)))), [['https://youtu.be/abcDEF12345'], ['https://youtu.be/abcDEF12345'], []]);

  // With a notes page the partners share the page, and the video can change for just one of them
  await page.evaluate(() => { const G = window.__gs, S = G.state().batch.students; return G.videoAdd(S[2], { url: 'https://youtu.be/cccCCC12345', name: 'Talk', kind: 'lined', partners: [S[1]] }); });
  await page.waitForFunction(() => window.__gs.state().batch.students[1].files.some(f => f.kind === 'link' && window.__gs.linkKey(f) === 'https://youtu.be/cccCCC12345'));
  await page.evaluate(() => { const S = window.__gs.state().batch.students, f = S[2].files.find(x => x.kind === 'link'); window.__gs.openReplace(S[2], f.path); });
  await page.waitForSelector('#rpLink');
  await page.type('#rpLink', 'https://youtu.be/dddDDD12345');
  await page.click('#rpLinkGo');
  await page.waitForSelector('#rpAlso');
  assert.match(await page.$eval('#dlgBox', d => d.textContent), /Also for Bram Sample/);
  await page.click('#rpAlso');
  await page.click('#dlgBox [data-ok]');
  await page.waitForFunction(() => window.__gs.state().batch.students[2].files.some(f => f.kind === 'link' && window.__gs.linkKey(f) === 'https://youtu.be/dddDDD12345'));
  assert.ok(await page.evaluate(() => window.__gs.state().batch.students[1].files.some(f => f.kind === 'link' && window.__gs.linkKey(f) === 'https://youtu.be/cccCCC12345')), 'Bram keeps the old link');
  assert.deepEqual(page.errors, []);
  await close();
});
