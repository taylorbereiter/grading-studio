// Marks from other apps: a PDF that comes in with pen, highlights, typed text and comments saved in it
// (from Kami, Acrobat or Preview) can have them made into her own marks, and put back. Made-up papers only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, PDFName, PDFString, PDFHexString } = require('pdf-lib');
const { unzipSync } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, settle, catchDownloads } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser, zip;
// A paper marked in another app: ink, a highlight, a highlight with a comment, typed text, a sticky note with a grade,
// a box, a line and a stamp. Everything but the stamp can become hers.
async function markedPaper() {
  const doc = await PDFDocument.load(await makePaper({ title: 'Rivers', lines: ['A made-up paragraph about a river and a town.', 'Another made-up line of the essay.'] })), ctx = doc.context;
  const red = [0.8, 0.1, 0.1], add = o => ctx.register(ctx.obj({ Type: 'Annot', F: 4, ...o }));
  const annots = [
    add({ Subtype: 'Ink', Rect: [100, 500, 220, 560], C: red, InkList: [[100, 520, 140, 560, 180, 500, 220, 540]], BS: { W: 2 } }),
    add({ Subtype: 'Highlight', Rect: [72, 600, 300, 614], C: [1, 0.9, 0.3], QuadPoints: [72, 614, 300, 614, 72, 600, 300, 600] }),
    add({ Subtype: 'Highlight', Rect: [72, 580, 250, 594], C: [1, 0.9, 0.3], QuadPoints: [72, 594, 250, 594, 72, 580, 250, 580], Contents: PDFHexString.fromText('Which chapter is this from?') }),
    add({ Subtype: 'FreeText', Rect: [320, 400, 520, 430], DA: PDFString.of('/Helv 14 Tf 0.8 0.1 0.1 rg'), Contents: PDFHexString.fromText('Good topic sentence!') }),
    add({ Subtype: 'Text', Rect: [500, 700, 520, 720], C: [0.4, 0.6, 0.9], Contents: PDFHexString.fromText('9.5/12 = 79%') }),
    add({ Subtype: 'Square', Rect: [300, 300, 400, 340], C: red, BS: { W: 1.5 } }),
    add({ Subtype: 'Line', Rect: [80, 200, 300, 260], C: red, L: [80, 260, 300, 200] }),
    add({ Subtype: 'Stamp', Rect: [400, 100, 520, 140], Name: PDFName.of('Approved') }),
  ];
  doc.getPage(0).node.set(PDFName.of('Annots'), ctx.obj(annots));
  return doc.save();
}
before(async () => {
  browser = await launch();
  zip = zipOf({ 'Aria Testwell/Essay.pdf': await markedPaper(), 'Bram Sample/Essay.pdf': await markedPaper(), 'Cleo Madeup/Essay.pdf': await makePaper({ title: 'Plain' }) });
});
after(async () => { await browser.close(); });

const fileOf = (page, i) => page.evaluate(i => { const f = window.__gs.state().batch.students[i].files[0]; return { marks: (f.marks[0] || []).map(m => ({ t: m.t, imp: m.imp, text: m.text, pts: m.pts, hl: !!m.hl })), imp: f.imp, impNo: !!f.impNo, impN: f.scan && f.scan.impN, notes: ((f.kami && f.kami[0] && f.kami[0].notes) || []).length }; }, i);
const viewAnnots = (page, i) => page.evaluate(async i => {
  const f = window.__gs.state().batch.students[i].files[0], b = await window.__gs.viewBytes(f);
  const d = await pdfjsLib.getDocument({ data: b.slice() }).promise, a = await (await d.getPage(1)).getAnnotations();
  d.destroy(); return a.map(x => x.subtype);
}, i);
async function waitNote(page) {
  await page.waitForFunction(() => { const n = document.querySelector('.impnote'); return n && /papers in this download/.test(n.textContent); }, { timeout: 60000 });
  return page.$eval('.impnote', n => n.textContent);
}

test('marks from another app can be made hers, changed, kept, exported and put back', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await openZip(page, zip, 'Imported.zip');
  const sorted = await page.evaluate(() => window.__gs.state().batch.students.map(s => s.files[0].path));
  const ai = sorted.findIndex(p => /Aria/.test(p)), ci = sorted.findIndex(p => /Cleo/.test(p));
  await page.evaluate(i => window.__gs.openStudent(i), ai);

  // The note: 7 marks (not the stamp), and the other paper like it.
  const note = await waitNote(page);
  assert.match(note, /This paper has 7 marks from another app/);
  assert.match(note, /2 papers in this download have marks like these/);
  let a = await fileOf(page, ai);
  assert.equal(a.impN, 7); assert.equal(a.marks.length, 0);
  assert.equal(a.notes, 2, 'today the two comments sit read-only in the margin');

  // Make them editable.
  await page.evaluate(() => document.querySelector('.impnote [data-imp="make"]').click());
  await page.waitForFunction(() => { const n = document.querySelector('.impnote'); return n && /now yours to change/.test(n.textContent); }, { timeout: 30000 });
  assert.match(await page.$eval('.impnote', n => n.textContent), /7 marks are now yours to change.*1 mark .*couldn’t be changed/);
  a = await fileOf(page, ai);
  assert.deepEqual(a.marks.map(m => m.t).sort(), ['hl', 'note', 'note', 'oval', 'pen', 'pen', 'text']);
  assert.ok(a.marks.every(m => /^\d+R$/.test(m.imp)));
  assert.equal(a.imp[0].length, 7);
  assert.equal(a.notes, 0, 'no read-only copies left in the margin');
  assert.ok(a.marks.find(m => m.t === 'note' && m.hl && m.text === 'Which chapter is this from?'), 'a highlight comment is her highlight comment');
  assert.ok(a.marks.find(m => m.t === 'text' && m.text === 'Good topic sentence!'));
  const line = a.marks.find(m => m.t === 'pen' && m.pts.length === 2).pts;
  assert.ok(line[0][1] < line[1][1], 'the line keeps its direction: its first end is the higher one');
  assert.deepEqual(await viewAnnots(page, ai), ['Stamp'], 'only the stamp is still drawn from the file');
  const orig = await page.evaluate(async i => { const f = window.__gs.state().batch.students[i].files[0]; const d = await pdfjsLib.getDocument({ data: f.data.slice() }).promise; const n = (await (await d.getPage(1)).getAnnotations()).length; d.destroy(); return n; }, ai);
  assert.equal(orig, 8, 'the original file is unchanged');

  // The grade in the sticky note is hers now, and still counts.
  await page.waitForFunction(i => { const s = window.__gs.state().batch.students[i]; const g = window.__gs.gradeOf ? window.__gs.gradeOf(s) : null; return !g || g.pct === 79 || g.paper; }, { timeout: 30000 }, ai);
  const found = await page.evaluate(i => window.__gs.state().batch.students[i].files[0].scan.found.map(g => ({ pct: g.pct, mark: !!g.mark })), ai);
  assert.deepEqual(found, [{ pct: 79, mark: true }]);

  // She can erase one like her own.
  await page.evaluate(i => { const f = window.__gs.state().batch.students[i].files[0]; f.marks[0] = f.marks[0].filter(m => m.t !== 'oval'); }, ai);

  // Saved and read back after a reload.
  await page.evaluate(() => window.__gs.saveNow()); await settle(page);
  await page.reload(); await page.waitForFunction(() => window.__gs && window.__gs.state().batch, { timeout: 60000 }).catch(() => {});
  const back = await page.evaluate(i => { const s = window.__gs.state(); if (!s.batch) return null; const f = s.batch.students[i].files[0]; return { imp: f.imp, n: (f.marks[0] || []).length }; }, ai);
  if (back) { assert.equal(back.imp[0].length, 7); assert.equal(back.n, 6); }
  else {   // the start screen: open the same download again and the work comes back
    await openZip(page, zip, 'Imported.zip');
    const again = await page.evaluate(i => { const f = window.__gs.state().batch.students[i].files[0]; return { imp: f.imp, n: (f.marks[0] || []).length }; }, ai);
    assert.equal(again.imp[0].length, 7); assert.equal(again.n, 6);
  }
  await page.evaluate(i => window.__gs.openStudent(i), ai);
  await page.waitForFunction(() => window.__gs.state().pages[0] && window.__gs.state().pages[0].bmp, { timeout: 30000 });
  assert.deepEqual(await viewAnnots(page, ai), ['Stamp'], 'still drawn without them after the reload');

  // Put back: her copies go, the file's own marks show again, and it isn't offered again.
  await page.evaluate(i => { const f = window.__gs.state().batch.students[i].files[0]; window.__gs.impPutBack(f); }, ai);
  a = await fileOf(page, ai);
  assert.equal(a.marks.length, 0); assert.equal(a.imp, undefined); assert.equal(a.impNo, true);
  assert.equal((await viewAnnots(page, ai)).length, 8);

  // The whole download at once: Bram's paper is found, Aria's isn't offered again, Cleo has nothing.
  await page.evaluate(() => window.__gs.openImported());
  await page.waitForFunction(() => /made in another app/.test(document.querySelector('#impSum').textContent) || /No paper/.test(document.querySelector('#impSum').textContent), { timeout: 60000 });
  assert.match(await page.$eval('#impSum', e => e.textContent), /1 paper has 7 marks made in another app\./);
  assert.match(await page.$eval('#impTbl', e => e.textContent), /Stamps, pictures and other marks1 stay as they are/);
  await page.click('#impGo');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden, { timeout: 60000 });
  const bi = sorted.findIndex(p => /Bram/.test(p));
  assert.equal((await fileOf(page, bi)).marks.length, 7);
  assert.equal((await fileOf(page, ci)).marks.length, 0);

  // Export: Bram's paper comes back flattened, once, with no annotations left to show twice.
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await page.waitForFunction(() => /^Done\./.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
  const un = unzipSync(got.bytes), name = Object.keys(un).find(k => /Bram.*Essay\.pdf$/.test(k));
  assert.ok(name, 'Bram’s paper is exported: ' + Object.keys(un).join(', '));
  const out = await PDFDocument.load(un[name]);
  const ann = out.getPage(0).node.lookupMaybe(PDFName.of('Annots'), require('pdf-lib').PDFArray);
  assert.ok(!ann || ann.size() === 0, 'the page is flattened');
  assert.deepEqual(page.errors, []);
  await close();
});
