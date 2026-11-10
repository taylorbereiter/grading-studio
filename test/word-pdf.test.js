// Convert to PDF on a student's Word paper: the pages, where the Word file goes, Undo, a whole assignment at once, and the setting. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { unzipSync, zipSync, strToU8 } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, waitPaper, goTo, goToStudent, markPage, settle, catchDownloads, idbRead } = require('./helpers/app');
const { makePaper, makeDocx, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
// A Word file of plain paragraphs. size: [w, h] of the page in twentieths of a point, when the file says.
const docx = (paras, size) => zipSync({ ...unzipSync(makeDocx('x')), 'word/document.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + W + '><w:body>' +
  paras.map(t => '<w:p><w:r><w:t xml:space="preserve">' + t + '</w:t></w:r></w:p>').join('') +
  (size ? '<w:sectPr><w:pgSz w:w="' + size[0] + '" w:h="' + size[1] + '"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>' : '') + '</w:body></w:document>') });
const SENT = 'The river carries silt from the hills down to the delta, where the farms depend on it every season. ';
const essay = (name, n, size) => docx([name, 'Why the river matters'].concat(Array.from({ length: n }, (_, i) => 'Paragraph ' + (i + 1) + '. ' + SENT.repeat(4))), size);
const files = async more => ({ 'Aaron Aardvark/Essay.pdf': await makePaper({ title: 'Aaron Aardvark' }), ...more });

const who = (page, key) => page.evaluate(key => { const b = window.__gs.state().batch, st = b.students.find(s => s.key === key); return { files: st.files.map(f => f.path), kinds: st.files.map(f => f.kind), gone: (st.gone || []).map(f => f.path), removed: Object.fromEntries(Object.entries(b.removed || {}).filter(([p]) => p.startsWith(key + '/')).map(([p, r]) => [p, Object.keys(r).sort().join()])) }; }, key);
const toastSays = (page, rx) => page.waitForFunction(src => { const t = document.querySelector('.toast'); return t && new RegExp(src).test(t.textContent); }, { timeout: 60000, polling: 100 }, rx.source);
// What a PDF file of this student's holds: its pages' sizes and words.
const pdfOf = (page, key, path) => page.evaluate(async (key, path) => {
  const st = window.__gs.state().batch.students.find(s => s.key === key), f = st.files.find(x => x.path === path);
  const d = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise, pages = [];
  for (let i = 1; i <= d.numPages; i++) { const p = await d.getPage(i), vp = p.getViewport({ scale: 1 }), tc = await p.getTextContent(); pages.push({ W: Math.round(vp.width), H: Math.round(vp.height), text: tc.items.map(x => x.str).join(' ').replace(/\s+/g, ' ') }); }
  const info = (await d.getMetadata()).info || {};
  d.destroy(); return { pages, creator: info.Creator || '', bytes: f.data.length };
}, key, path);
const convert = async (page, { all, always, undo } = {}) => {
  await page.waitForSelector('[data-wpdf]');
  await page.click('[data-wpdf]');
  await page.waitForSelector('#wpAlways');
  if (all) await page.click('input[name="wpWhich"][value="all"]');
  if (always) await page.click('#wpAlways');
  await page.click('#dlgBox [data-ok]');
  await toastSays(page, /now PDF pages/);
  // the note with Undo sits over the foot of the page for a few seconds; out of the way unless the test is about Undo
  if (!undo) await page.evaluate(() => { const t = document.querySelector('.toast'); t.hidden = true; t.textContent = ''; });
};
const WORD = 'Bram Sample/Essay.docx', PDF = 'Bram Sample/Essay.pdf';

test('one Word paper becomes pages with its own words, on the page size the file names; the Word file waits unchanged; Undo throws the pages away', async () => {
  const { page, close } = await openApp(browser);
  const bytes = essay('Bram Sample', 9, [12240, 15840]);
  await openZip(page, zipOf(await files({ [WORD]: bytes })), 'River essay.zip');
  await goToStudent(page, 1);
  assert.deepEqual(await who(page, 'Bram Sample'), { files: [WORD], kinds: ['docx'], gone: [], removed: {} });
  await convert(page, { undo: true });
  await waitPaper(page);
  assert.deepEqual(await who(page, 'Bram Sample'), { files: [PDF], kinds: ['pdf'], gone: [WORD], removed: { [WORD]: 'by,t' } });
  const addedPdfs = async () => (await idbRead(page, 'grading-studio-added', 'files')).k.filter(k => String(k).includes(PDF)).length;
  assert.equal(await addedPdfs(), 1, 'the pages are saved with the files she added');
  // Undo, while the note is up
  await page.click('.toast .tact');
  await page.waitForFunction(() => (window.__gs.state().batch.students[1].files[0] || {}).kind === 'docx');
  await page.waitForSelector('#paper .docx [data-ri]');
  assert.deepEqual(await who(page, 'Bram Sample'), { files: [WORD], kinds: ['docx'], gone: [], removed: { [WORD]: 'back' } });
  await settle(page);
  assert.equal(await addedPdfs(), 0, 'Undo leaves nothing behind');

  // again, to look at the pages
  await convert(page);
  await waitPaper(page);
  assert.deepEqual(await who(page, 'Bram Sample'), { files: [PDF], kinds: ['pdf'], gone: [WORD], removed: { [WORD]: 'by,t' } });
  const got = await pdfOf(page, 'Bram Sample', PDF);
  assert.ok(got.pages.length >= 2, 'nine long paragraphs take more than one page');
  for (const p of got.pages) assert.deepEqual([p.W, p.H], [612, 792], 'letter, as the file says');
  const text = got.pages.map(p => p.text).join(' ');
  assert.match(got.pages[0].text, /^Bram Sample Why the river matters Paragraph 1\. The river carries silt/);
  for (let i = 1; i <= 9; i++) assert.ok(text.includes('Paragraph ' + i + '. The river'), 'paragraph ' + i + ' is there');
  assert.equal(text.split('farms depend on it every season.').length - 1, 36, 'every sentence once: no line is lost or doubled at a page break');
  assert.notEqual(got.creator, 'Grading Studio', 'not taken for one of her own exports');
  assert.ok(got.bytes < 200000, 'words, not pictures of words: ' + got.bytes + ' bytes');
  // on the paper and in the list it reads as the student's paper, not a file she added
  assert.equal(await page.$eval('#paper .addtag', e => e.textContent), 'From Word');
  assert.match(await page.$eval('#paper .addtag', e => e.title), /^Converted from Essay\.docx on /);
  assert.equal(await page.evaluate(() => document.querySelector('#list .add')), null, 'no "added by you" badge');
  assert.match(await page.$eval('.gonelist', e => e.textContent), /Essay\.docx.*now PDF pages/s);
  // the Word file is byte for byte what came in
  assert.equal(await page.evaluate(b => { const st = window.__gs.state().batch.students[1], d = st.gone[0].data; return d.length === b.length && b.every((v, i) => d[i] === v); }, Array.from(bytes)), true);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a converted paper is marked like any PDF, kept after reopening, and exported only once it has a mark; Bring back returns the Word file', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await openZip(page, zipOf(await files({ [WORD]: essay('Bram Sample', 2) })), 'River essay.zip');
  await goToStudent(page, 1);
  await convert(page);
  await waitPaper(page);
  const a4 = await pdfOf(page, 'Bram Sample', PDF);
  assert.deepEqual([a4.pages.length, a4.pages[0].W, a4.pages[0].H], [1, 595, 842], 'A4 when the file names no size');
  const exported = async () => {
    await page.click('#exportBtn');
    await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
    const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
    await page.waitForFunction(() => /^Done\./.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
    await page.evaluate(() => { const c = document.querySelector('#dlgBox [data-cancel], #dlgBox [data-close], #dlgBox [data-done]'); if (c) c.click(); });
    return Object.keys(unzipSync(got.bytes)).filter(n => n.startsWith('Bram Sample/'));
  };
  await goToStudent(page, 0);
  await markPage(page, 0);
  await settle(page);
  assert.deepEqual(await exported(), [], 'unmarked, it isn’t sent back');
  await goToStudent(page, 1);
  await markPage(page, 0);
  await settle(page);
  const marks = await page.evaluate(() => window.__gs.state().batch.students[1].files[0].marks[0].length);
  assert.ok(marks > 0);
  assert.deepEqual(await exported(), [PDF]);

  await page.reload();
  await page.waitForSelector('#kept [data-kopen]');
  await page.click('#kept [data-kopen]');
  await waitPaper(page);
  await goToStudent(page, 1);
  assert.deepEqual(await who(page, 'Bram Sample'), { files: [PDF], kinds: ['pdf'], gone: [WORD], removed: { [WORD]: 'by,t' } });
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[1].files[0].marks[0].length), marks, 'her marks are on the pages');
  assert.equal(await page.$eval('#paper .addtag', e => e.textContent), 'From Word');

  await page.waitForSelector('[data-backfile="' + WORD + '"]');
  await page.click('[data-backfile="' + WORD + '"]');
  await page.waitForFunction(() => window.__gs.state().batch.students[1].files.length === 2);
  const b = await who(page, 'Bram Sample');
  assert.deepEqual([b.files.slice().sort(), b.gone, b.removed], [[WORD, PDF], [], { [WORD]: 'back' }]);
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});

test('all the Word papers at once: one she took a grade from stays a Word file, and Undo brings every one back', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(await files({ [WORD]: essay('Bram Sample', 2), 'Cleo Fixture/Essay.docx': essay('Cleo Fixture', 3), 'Dov Madeup/Essay.docx': docx(['Dov Madeup', 'A short answer.', '10/12 = 83%']) })), 'River essay.zip');
  await page.evaluate(() => window.__gs.scanAll());
  // she takes Dov's typed grade
  await page.evaluate(() => window.__gs.openSheet());
  await page.waitForSelector('.rd-ask [data-rd="1"]', { timeout: 60000 });
  await page.click('.rd-ask [data-rd="1"]');
  await page.waitForFunction(() => !document.querySelector('.rd-ask'));
  await page.evaluate(() => { const c = document.querySelector('#dlgBox [data-cancel], #dlgBox [data-close], #dlgBox [data-done]'); if (c) c.click(); });
  assert.equal(await page.evaluate(() => window.__gs.gradeOf(window.__gs.state().batch.students[3]).total), 10);

  await goToStudent(page, 1);
  await page.waitForSelector('[data-wpdf]');
  // Find anything reaches the same box
  assert.equal(await page.evaluate(() => { const r = window.__gs.findRows().find(r => r.label === 'Convert Word papers to PDF pages'); return r && r.group + ': ' + r.sub; }), 'This assignment: 3 Word papers here. The Word files are kept');
  await page.evaluate(() => window.__gs.findRows().find(r => r.label === 'Convert Word papers to PDF pages').run());
  await page.waitForSelector('#wpAlways');
  assert.match(await page.$eval('.wpwhich', e => e.textContent.replace(/\s+/g, ' ')), /All 2 Word papers in this assignment \(1 you’ve typed in, commented on or scored from stays a Word file\)/);
  await page.click('input[name="wpWhich"][value="all"]');
  await page.click('#dlgBox [data-ok]');
  await toastSays(page, /^2 Word papers are now PDF pages/);
  assert.deepEqual((await who(page, 'Bram Sample')).kinds, ['pdf']);
  assert.deepEqual((await who(page, 'Cleo Fixture')).kinds, ['pdf']);
  assert.deepEqual(await who(page, 'Dov Madeup'), { files: ['Dov Madeup/Essay.docx'], kinds: ['docx'], gone: [], removed: {} });
  assert.equal(await page.evaluate(() => window.__gs.gradeOf(window.__gs.state().batch.students[3]).total), 10, 'Dov’s grade is where it was');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.wordPdf')), null, 'the setting is only on when she ticks it');

  // on Dov's own file she is told what converting does to the grade she took
  await goToStudent(page, 3);
  await page.waitForSelector('[data-wpdf]');
  await page.click('[data-wpdf]');
  await page.waitForSelector('#wpAlways');
  assert.match(await page.$eval('#dlgBox .sc-warn', e => e.textContent), /You took this student’s grade from what’s typed in this Word file/);
  assert.equal(await page.$('.wpwhich'), null, 'no other Word paper is left');
  await page.click('#dlgBox [data-cancel]');

  // Undo is still on the note from converting
  await page.click('.toast .tact');
  await page.waitForFunction(() => window.__gs.state().batch.students.every(st => !(st.gone || []).length));
  for (const k of ['Bram Sample', 'Cleo Fixture']) assert.deepEqual(await who(page, k), { files: [k + '/Essay.docx'], kinds: ['docx'], gone: [], removed: { [k + '/Essay.docx']: 'back' } });
  assert.deepEqual(page.errors, []);
  await close();
});

test('the setting converts Word papers as an assignment opens, leaves a brought-back file alone, and turns off in Settings', async () => {
  const { page, close } = await openApp(browser);
  await goTo(page, '#/settings/marking');
  await page.waitForSelector('#setWordPdf');
  assert.equal(await page.$eval('#setWordPdf [data-v="0"]', b => b.getAttribute('aria-pressed')), 'true', 'Word papers stay Word files until she says');
  const found = label => page.evaluate(label => { const r = window.__gs.findRows().find(r => r.label === label); return r ? r.group + ': ' + r.sub : null; }, label);
  assert.equal(await found('Word papers'), 'Settings: Kept as Word files. They can be converted to PDF pages');
  await page.click('#setWordPdf [data-v="1"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.wordPdf')), 'true');
  assert.equal(await found('Word papers'), 'Settings: Converted to PDF pages as each assignment opens');
  await goTo(page, '#/');
  await openZip(page, zipOf(await files({ [WORD]: essay('Bram Sample', 2), 'Cleo Fixture/Essay.docx': essay('Cleo Fixture', 2) })), 'River essay.zip');
  await toastSays(page, /^2 Word papers are now PDF pages/);
  assert.deepEqual((await who(page, 'Bram Sample')).kinds, ['pdf']);
  assert.deepEqual((await who(page, 'Cleo Fixture')).kinds, ['pdf']);
  // she brings one back: it stays a Word file from then on
  await goToStudent(page, 1);
  await page.waitForSelector('[data-backfile="' + WORD + '"]');
  await page.click('[data-backfile="' + WORD + '"]');
  await page.waitForFunction(() => window.__gs.state().batch.students[1].files.length === 2);
  await settle(page);
  await page.reload();
  await page.waitForSelector('#kept [data-kopen]');
  await page.click('#kept [data-kopen]');
  await waitPaper(page);
  await new Promise(r => setTimeout(r, 1500));
  assert.deepEqual((await who(page, 'Bram Sample')).files.slice().sort(), [WORD, PDF]);
  assert.deepEqual(await page.evaluate(() => window.__gs.wordPdfList().map(x => x.f.path)), [WORD]);
  assert.equal(await page.evaluate(async () => (await window.__gs.wordPdfAuto()) || 0), 0, 'nothing left for it to do');
  // and off again
  await page.click('#closeBtn');
  await page.waitForFunction(() => !window.__gs.state().batch);
  await goTo(page, '#/settings/marking');
  await page.click('#setWordPdf [data-v="0"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.wordPdf')), null);
  assert.equal(await page.$eval('#setWordPdf [data-v="0"]', b => b.getAttribute('aria-pressed')), 'true');
  assert.deepEqual(page.errors, []);
  await close();
});

test('words the built-in font can’t write are drawn, and still read off the page: a name typed in Thai is covered in anonymous grading', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(await files({ 'สมชาย ใจดี/Essay.docx': docx(['Name: สมชาย ใจดี', 'แม่น้ำ means river, and π is about 3.14.', SENT]), [WORD]: docx(['Bram Sample', SENT]) })), 'River essay.zip');
  const at = key => page.evaluate(key => window.__gs.state().batch.students.findIndex(s => s.key === key), key);
  await goToStudent(page, await at('สมชาย ใจดี'));
  await convert(page, { all: true });
  await waitPaper(page);
  const got = await pdfOf(page, 'สมชาย ใจดี', 'สมชาย ใจดี/Essay.pdf');
  assert.match(got.pages[0].text, /^Name: สมชาย ใจดี แม่น้ำ means river, and π is about 3\.14\. The river carries silt/);
  await page.click('#anonSw'); await page.waitForSelector('[data-go]'); await page.click('[data-go]');
  await page.waitForFunction(() => window.__gs.anonOn() && document.querySelector('#paper .who'));
  const covers = async key => {
    await page.evaluate(i => window.__gs.openStudent(i), await at(key));
    await page.waitForFunction(key => { const S = window.__gs.state(), pg = S.pages[0]; return S.batch.students[S.cur].key === key && pg && pg.covers && pg.covers.length; }, { timeout: 30000 }, key);
    return page.evaluate(() => window.__gs.state().pages[0].covers.map(c => [c.x, c.y, c.w, c.h].map(Math.round)));
  };
  const thai = await covers('สมชาย ใจดี');
  assert.ok(thai.length >= 1 && thai.every(c => c[0] > 90 && c[1] < 90), 'on the name, after its label: ' + JSON.stringify(thai));
  assert.ok(Math.max(...thai.map(c => c[0] + c[2])) > 155, 'as far as the end of the name: ' + JSON.stringify(thai));
  const bram = await covers('Bram Sample');
  assert.ok(bram.length >= 1 && bram[0][0] < 80 && bram[0][1] < 90, 'a name in plain letters too: ' + JSON.stringify(bram));
  assert.deepEqual(page.errors, []);
  await close();
});
