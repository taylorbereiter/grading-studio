// The scan split for group work, hard-to-read pages and rescans: pages given to several students, lighting set in the split, and pages flagged for a rescan. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, appReady, answerDlg, pickFile, waitPaper, goToStudent, settle, press, pick: pickIn } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const studentNamed = (page, key) => page.evaluate(key => { const st = window.__gs.state().batch.students.find(s => s.key === key); return st && { files: st.files.map(f => ({ name: f.name, from: f.from || null, pages: f.numPages, sc: f.sc || {} })) }; }, key);
const pick = async (page, list) => {
  await page.click('#spPages [data-spg="' + list[0] + '"] .spf');
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.down(mod);
  for (const i of list.slice(1)) await page.click('#spPages [data-spg="' + i + '"] .spf');
  await page.keyboard.up(mod);
};
const nameAt = (page, nm) => page.evaluate(nm => window.__gs.sp().names.indexOf(nm), nm);
const listChips = page => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#stuList .stu')].map(b => [b.querySelector('.nm').textContent, [...b.querySelectorAll('.add')].map(a => a.textContent)])));

test('in the split: pages go to several students, a page can be flagged for a rescan and still given, and lighting carries over', async () => {
  const { page, close } = await openApp(browser);
  const clean = await pickFile(page, '#scanIn', await makePaper({ title: 'Poster group', pages: 4 }), 'Unit quiz.pdf');
  await page.waitForSelector('#spPages');
  await page.waitForFunction(() => window.__gs.sp().thumbs.filter(Boolean).length === 4, { timeout: 60000 });
  for (const nm of ['Aria Testwell', 'Bram Sample', 'Cleo Fixture']) {
    await page.click('#spAdd'); await answerDlg(page, { typed: nm });
    await page.waitForFunction(nm => [...document.querySelectorAll('#spNames b')].some(b => b.textContent === nm), {}, nm);
  }
  await pick(page, [0, 1]); await page.click('#spNames [data-spn="' + await nameAt(page, 'Aria Testwell') + '"]');
  // Group work: the same two pages to Bram and Cleo.
  await page.click('#spSev');
  await pick(page, [2, 3]);
  await page.click('#spNames [data-spn="' + await nameAt(page, 'Bram Sample') + '"]');
  await page.click('#spNames [data-spn="' + await nameAt(page, 'Cleo Fixture') + '"]');
  assert.deepEqual(await page.evaluate(() => window.__gs.sp().more), { 2: ['Cleo Fixture'], 3: ['Cleo Fixture'] });
  assert.deepEqual(await page.$eval('#spPages [data-spg="3"] .spown', e => [e.textContent, e.title]), ['Bram Sample +1', 'Bram Sample, Cleo Fixture']);
  // Page 4 needs a rescan, and stays given.
  await pick(page, [3]); await page.click('#spRe');
  assert.match(await page.$eval('#spPages [data-fl="3"]', e => e.textContent), /Needs rescan/);
  assert.match(await page.$eval('#spFoot', e => e.textContent), /3 students · 4 of 4 pages given · 2 pages shared · 1 page needs a rescan/);
  // Lighting for the whole scan: the thumbnails change, the scan doesn't.
  const before = await page.evaluate(() => window.__gs.sp().thumbs[0]);
  await page.click('#spLight');
  await page.click('#spLightP [data-spls="all"]');
  await page.$eval('#spLightP [data-spl="c"]', e => { e.value = 150; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#spLightP [data-splg]', e => { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(b => window.__gs.sp().thumbs[0] !== b, {}, before);
  assert.match(await page.$eval('#spPages [data-fl="0"]', e => e.textContent), /Lighting/);
  await page.keyboard.press('Escape');
  assert.equal(await page.$('#spLightP'), null, 'Escape closes the lighting first');
  assert.ok(await page.$('#spPages'), 'and not the split');
  await page.click('#spGo');
  await waitPaper(page);
  await page.waitForFunction(() => window.__gs.state().batch.students.length === 3);
  const b = await studentNamed(page, 'Bram Sample'), c = await studentNamed(page, 'Cleo Fixture'), a = await studentNamed(page, 'Aria Testwell');
  assert.equal(b.files.length, 1); assert.equal(c.files.length, 1);
  assert.deepEqual(b.files[0].sc[0].w, ['Cleo Fixture']); assert.deepEqual(c.files[0].sc[0].w, ['Bram Sample']);
  assert.equal(b.files[0].sc[1].re, 1); assert.equal(c.files[0].sc[1].re, 1); assert.ok(!Object.values(a.files[0].sc).some(r => r.re || r.w));
  assert.deepEqual(await page.evaluate(() => { const L = window.__gs.state().batch.light['*']; return [L.c, L.g]; }), [150, 1], 'the lighting is the download’s');
  const chips = await listChips(page);
  assert.deepEqual(chips['Bram Sample'], ['⚑', 'shared']); assert.deepEqual(chips['Aria Testwell'], []);
  // On Bram's paper the strips say so; It’s fine now takes the flag off.
  await goToStudent(page, await page.evaluate(() => window.__gs.state().batch.students.findIndex(s => s.key === 'Bram Sample')));
  await page.waitForFunction(() => window.__gs.state().pages.length === 2 && window.__gs.state().pages[1].snote);
  const notes = await page.evaluate(() => window.__gs.state().pages.map(p => p.snote ? p.snote.textContent : ''));
  assert.match(notes[0], /also went to Cleo Fixture/); assert.match(notes[1], /needs a rescan/);
  // Rescans lists both, and survives a reload.
  await settle(page);
  await page.reload(); await appReady(page);
  await page.click('#vHome [data-kopen]');
  await waitPaper(page);
  await page.waitForFunction(() => window.__gs.scanRescans().length === 2);
  await press(page, '#rescanBtn');
  assert.deepEqual(await page.$$eval('#dlgBox [data-rsgo]', e => e.map(x => x.textContent)), ['Bram Samplep. 2', 'Cleo Fixturep. 2']);
  await page.click('#dlgBox [data-rsgo]');
  await page.waitForFunction(() => window.__gs.state().pages[1] && window.__gs.state().pages[1].snote);
  await page.evaluate(() => window.__gs.state().pages[1].snote.querySelector('[data-sc="unre"]').click());
  assert.equal(await page.evaluate(() => window.__gs.scanRescans().length), 1);
  clean();
  assert.deepEqual(page.errors, []);
  await close();
});

test('a makeup scan split into a download: lighting set on picked pages goes to just those pages of that student', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': await makePaper({ title: 'An essay' }), 'Bram Sample/Essay.pdf': await makePaper({ title: 'Another essay' }) }));
  await waitPaper(page);
  const scan = await makePaper({ title: 'Makeup', pages: 2 });
  await page.evaluate(async b64 => { const b = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); await window.__gs.openSplit(new File([b], 'Makeup.pdf'), null, true); }, Buffer.from(scan).toString('base64'));
  await page.waitForSelector('#spPages');
  await page.waitForFunction(() => window.__gs.sp().thumbs.filter(Boolean).length === 2, { timeout: 60000 });
  await pick(page, [1]);
  await page.click('#spLight');
  await page.click('#spLightP [data-spls="sel"]');
  await page.$eval('#spLightP [data-spl="d"]', e => { e.value = 60; e.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.deepEqual(await page.evaluate(() => [!!window.__gs.spLight(window.__gs.sp(), 0), !!window.__gs.spLight(window.__gs.sp(), 1)]), [false, true]);
  await page.click('#spLightP [data-splx]');
  await pick(page, [0, 1]); await page.click('#spNames [data-spn="' + await nameAt(page, 'Bram Sample') + '"]');
  await page.click('#spGo');
  await page.waitForFunction(() => window.__gs.state().batch.students.find(s => s.key === 'Bram Sample').files.length === 2);
  const r = await page.evaluate(() => {
    const g = window.__gs, st = g.state().batch.students.find(s => s.key === 'Bram Sample'), f = st.files[1], L = g.state().batch.light;
    return { d: L['Bram Sample'] && L['Bram Sample'].d, aria: !!L['Aria Testwell'], p0: g.pageLit(st, f, 0), p1: g.pageLit(st, f, 1) };
  });
  assert.deepEqual(r, { d: 60, aria: false, p0: false, p1: true });
  assert.deepEqual(page.errors, []);
  await close();
});

test('⚑ in a page’s corner flags it for a rescan while grading', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': await makePaper({ title: 'An essay' }), 'Bram Sample/Essay.pdf': await makePaper({ title: 'Another essay' }) }));
  await waitPaper(page);
  await page.waitForFunction(() => window.__gs.state().pages[0] && window.__gs.state().pages[0].rchip);
  await page.evaluate(() => window.__gs.state().pages[0].rchip.querySelector('[data-reflag]').click());
  assert.match(await page.evaluate(() => window.__gs.state().pages[0].snote.textContent), /needs a rescan/);
  assert.deepEqual((await listChips(page))['Aria Testwell'], ['⚑']);
  await page.evaluate(() => window.__gs.state().pages[0].rchip.querySelector('[data-reflag]').click());
  assert.equal(await page.evaluate(() => window.__gs.scanRescans().length), 0);
  assert.deepEqual(page.errors, []);
  await close();
});

test('group work in a download: Group work… gives another student their own copy, kept after reopening', async () => {
  const { page, close } = await openApp(browser);
  const zip = zipOf({ 'Aria Testwell/Poster.pdf': await makePaper({ title: 'Our poster' }), 'Bram Sample/Other.pdf': await makePaper({ title: 'Something else' }) });
  await openZip(page, zip);
  await waitPaper(page);
  await page.waitForSelector('#paper [data-shfile]');
  await pickIn(page, '#paper [data-shfile]');
  await page.waitForSelector('#dlgBox [data-shto]');
  await page.click('#dlgBox [data-shto]');
  await page.waitForFunction(() => window.__gs.state().batch.students[1].files.length === 2);
  assert.match(await page.$eval('#dlgBox [data-shto]', e => e.textContent), /In the group/);
  await page.click('#dlgBox .bf [data-cancel]');
  const bram = await studentNamed(page, 'Bram Sample');
  assert.deepEqual(bram.files.map(f => [f.name, f.from]), [['Other.pdf', null], ['Poster.pdf', 'Aria Testwell']]);
  await page.waitForFunction(() => /Group work… \(1\)/.test((document.querySelector('#paper [data-shfile]') || {}).textContent || ''));
  assert.deepEqual((await listChips(page))['Bram Sample'], ['group']);
  await settle(page);
  await page.reload(); await appReady(page);
  await openZip(page, zip);
  await waitPaper(page);
  await page.waitForFunction(() => window.__gs.state().batch.students[1].files.length === 2);
  assert.equal((await studentNamed(page, 'Bram Sample')).files[1].from, 'Aria Testwell');
  assert.deepEqual(page.errors, []);
  await close();
});

test('black and white takes the color out and keeps the lighting', async () => {
  const { page, close } = await openApp(browser);
  const px = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.fillStyle = 'rgb(230,200,120)'; x.fillRect(0, 0, 4, 4);
    window.__gs.lightCanvas(x, 4, 4, { b: 0, c: 0, d: 0, s: 0, g: 1 }); return [...x.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  });
  assert.equal(px[0], px[1]); assert.equal(px[1], px[2]);
  assert.deepEqual(page.errors, []);
  await close();
});
