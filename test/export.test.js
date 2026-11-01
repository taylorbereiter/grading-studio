// Export: what comes out must be real PDFs, with her marks in the right places, in the same student folders.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const { unzipSync } = require('fflate');
const { launch } = require('./helpers/chrome');
const { MARK_BOXES, openApp, openZip, waitPaper, goToStudent, markPage, setTool, drag, score, settle, catchDownloads, probePdf, workOf, appReady } = require('./helpers/app');
const { standardFiles, makePaper, makeDocx, zipOf } = require('./helpers/fixtures');

let browser, files, zip;
before(async () => { browser = await launch(); files = await standardFiles(); zip = zipOf(files); });
after(async () => { await browser.close(); });

const text = u => new TextDecoder().decode(u);
const isPdf = u => text(u.subarray(0, 5)) === '%PDF-';
const tailOf = u => text(u.subarray(u.length - 40));
const { PEN, HL, OVAL, CHECK, TEXT, BLANK } = MARK_BOXES;

async function exportZip(page, dl, opts = {}) {
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  if (opts.notEditable) await page.click('#xEdit');
  if (opts.all) { await page.click('#xAll'); await page.waitForFunction(() => document.querySelector('#xAll') && document.querySelector('#xAll').checked); await page.waitForSelector('#dlgBox [data-go="zip"]'); }
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await page.waitForFunction(() => /^Done\./.test(document.querySelector('#xStatus').textContent), { timeout: 60000 });
  assert.match(got.name, /^Marked - /);
  const un = unzipSync(got.bytes);
  await page.click('#dlgBox .bf [data-close]');
  return { un, bytes: got.bytes };
}
async function markedStack(page) {
  await openZip(page, zip, 'River essay.zip');
  await markPage(page, 0);
  await score(page, [3.5, 3.5, 3.5]);
  await page.evaluate(() => [...document.querySelectorAll('[data-rot="1"]')][1].click());   // turn page 2, then mark it
  await page.waitForFunction(() => { const p = window.__gs.state().pages[1]; return p.W > 700 && p.s > 0; });
  await setTool(page, 'pen'); await drag(page, 1, [[500, 120], [560, 150], [620, 120]]);
  await goToStudent(page, 1);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);
  await settle(page);
}

test('Export marked: valid PDFs, the same folders, marks baked in where she drew them', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await markedStack(page);
  const { un } = await exportZip(page, dl);
  assert.deepEqual(Object.keys(un).sort(), ['Aria Testwell/Essay.pdf', 'Bram Sample/Essay.pdf', 'Cleo Fixture/Essay.pdf', 'Grade sheet - River essay.pdf'], 'Dov’s unmarked files stay out; a grade typed on Cleo’s paper counts as marked');
  for (const [name, bytes] of Object.entries(un)) {
    assert.ok(isPdf(bytes), name + ' starts like a PDF');
    assert.ok((await PDFDocument.load(bytes)).getPageCount() >= 1, name + ' opens in a second PDF library');
  }
  const aria = un['Aria Testwell/Essay.pdf'];
  assert.equal((await PDFDocument.load(aria)).getPageCount(), 2, 'a marked file comes back whole');
  const p1 = await probePdf(page, aria, 1, [PEN, HL, OVAL, CHECK, TEXT, BLANK]);
  assert.equal(p1.n, 2);
  assert.equal(p1.H, 792); assert.ok(p1.W > 800, 'a comment adds the margin on the right');
  const [pen, hl, oval, check, txt, blank] = p1.ink;
  assert.ok(pen.red > 50, 'pen'); assert.ok(hl.yellow > hl.n * 0.5, 'highlight'); assert.ok(oval.red > 50, 'circle'); assert.ok(check.red > 15, 'check'); assert.ok(txt.red > 15, 'text');
  assert.equal(blank.red, 0, 'and nothing where she didn’t mark');
  const note = await probePdf(page, aria, 1, [[622, 10, 220, 772]]);
  assert.ok(note.ink[0].dark + note.ink[0].red > 20, 'the comment is in the margin');
  const p2 = await probePdf(page, aria, 2, [[490, 110, 140, 50], [100, 300, 100, 100]]);
  assert.equal(p2.W, 792, 'the turned page comes out turned'); assert.equal(p2.H, 612);
  assert.ok(p2.ink[0].red > 20, 'the mark made on the turned page');
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});

// The same name twice, in the two spellings: what one student uploading from Windows and again from a Mac leaves in a download.
test('two files whose names differ only in accent spelling stay two files: marks stay put, and Export has both', async () => {
  const CAFE = 'Mina Fixture/Café.pdf', C1 = CAFE.normalize('NFC'), C2 = CAFE.normalize('NFD');
  assert.notEqual(C1, C2);
  const stack = zipOf({ 'Aaa Kid/Essay.pdf': await makePaper({ title: 'Aaa Kid essay' }), [C1]: await makePaper({ title: 'One page' }), [C2]: await makePaper({ title: 'Two pages', pages: 2 }) });
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await openZip(page, stack, 'Cafe.zip');
  const counts = () => workOf(page).then(w => Object.fromEntries(Object.entries(w['Mina Fixture'].files).map(([p, f]) => [p, Object.values(f.marks).flat().length])));
  const pagesOf = () => page.evaluate(() => window.__gs.state().batch.students[1].files.map(f => f.path));
  await goToStudent(page, 1);
  assert.deepEqual((await pagesOf()).sort(), [C1, C2].sort(), 'both spellings are kept as they came');
  const first = (await pagesOf())[0], second = (await pagesOf())[1];
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);
  await settle(page);
  assert.deepEqual(await counts(), { [first]: 1, [second]: 0 });
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await page.reload(); await appReady(page);
  await page.waitForSelector('#kept [data-kopen]');
  await page.click('#kept [data-kopen]');
  await waitPaper(page);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.id), id, 'the same download');
  assert.deepEqual(await counts(), { [first]: 1, [second]: 0 }, 'the stroke hasn’t spread to a paper she never marked');
  await goToStudent(page, 1);
  const k = await page.evaluate(() => window.__gs.state().pages.length);
  assert.equal(k, 3, 'one page and two pages');
  await setTool(page, 'pen'); await drag(page, k - 1, [[100, 300], [200, 330]]);
  await settle(page);
  const { un } = await exportZip(page, dl);
  assert.ok(un[C1] && un[C2], 'both are in the ZIP');
  assert.equal((await PDFDocument.load(un[C1])).getPageCount(), 1);
  assert.equal((await PDFDocument.load(un[C2])).getPageCount(), 2);
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});

test('two student folders whose names differ only in accent spelling stay two students', async () => {
  const JOSE = 'José Kid', J1 = JOSE.normalize('NFC'), J2 = JOSE.normalize('NFD');
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ [J1 + '/A.pdf']: await makePaper({ title: 'First' }), [J2 + '/B.pdf']: await makePaper({ title: 'Second' }) }), 'Two.zip');
  assert.deepEqual((await page.evaluate(() => window.__gs.state().batch.students.map(s => s.key))).sort(), [J1, J2].sort());
  await close();
  const loose = await openApp(browser);
  await openZip(loose.page, zipOf({ [J1 + '.pdf']: await makePaper({ title: 'First' }), [J2 + '.docx']: makeDocx('Second') }), 'Loose.zip');
  assert.equal(await loose.page.evaluate(() => window.__gs.state().batch.students.length), 2, 'and so do loose files');
  await loose.close();
});

test('a turned page with no marks on it comes out turned too', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await openZip(page, zip);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);   // page 1 is marked, so the file goes out
  await page.evaluate(() => [...document.querySelectorAll('[data-rot="1"]')][1].click());   // page 2 is only turned
  await page.waitForFunction(() => { const p = window.__gs.state().pages[1]; return p.W > 700 && p.s > 0; });
  await settle(page);
  const { un } = await exportZip(page, dl);
  const aria = un['Aria Testwell/Essay.pdf'], lib = await PDFDocument.load(aria);
  assert.equal(lib.getPageCount(), 2);
  assert.equal(lib.getPage(1).getRotation().angle, 90, 'the turn is on the page');
  const p2 = await probePdf(page, aria, 2, [[0, 0, 10, 10]]);
  assert.equal(p2.W, 792); assert.equal(p2.H, 612);
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});

test('an exported ZIP opens again with the marks as marks, and exports again', async () => {
  const a = await openApp(browser), dl = await catchDownloads(a.page);
  await markedStack(a.page);
  const was = await workOf(a.page);
  const { bytes } = await exportZip(a.page, dl);
  await dl.close(); await a.close();

  const aria = unzipSync(bytes)['Aria Testwell/Essay.pdf'];
  assert.match(tailOf(aria), /%GradingStudio-editable/, 'editable by default');

  const b = await openApp(browser), dl2 = await catchDownloads(b.page);
  await openZip(b.page, bytes, 'Marked - River essay.zip');
  const w = await workOf(b.page);
  assert.deepEqual(Object.keys(w), ['Aria Testwell', 'Bram Sample', 'Cleo Fixture'], 'the grade sheet in the ZIP isn’t a student');
  const f = w['Aria Testwell'].files['Aria Testwell/Essay.pdf'], fw = was['Aria Testwell'].files['Aria Testwell/Essay.pdf'];
  assert.deepEqual(f.marks, fw.marks); assert.deepEqual(f.rot, fw.rot);
  const size = await b.page.evaluate(() => window.__gs.state().batch.students[0].files[0].data.length);
  assert.equal(size, files['Aria Testwell/Essay.pdf'].length, 'back to the exact original pages');
  await b.page.evaluate(() => window.__gs.state().batch.students[0].files[0].marks[0].pop());   // she takes a comment off
  const again = await exportZip(b.page, dl2);
  assert.ok(isPdf(again.un['Aria Testwell/Essay.pdf']));
  assert.equal((await PDFDocument.load(again.un['Aria Testwell/Essay.pdf'])).getPageCount(), 2);
  assert.deepEqual(b.page.errors, []);
  await dl2.close(); await b.close();
});

test('with Keep marks editable off, the PDF is plain', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await openZip(page, zip);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);
  await settle(page);
  const { un } = await exportZip(page, dl, { notEditable: true });
  const aria = un['Aria Testwell/Essay.pdf'];
  assert.ok(isPdf(aria)); assert.doesNotMatch(tailOf(aria), /GradingStudio/);
  assert.ok(!text(aria).includes('grading-studio.json'), 'nothing extra is attached');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.xedit'))), false, 'the choice is remembered');
  await dl.close(); await close();
});

test('Also include files with no marks: Word and text files come back unchanged', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  await openZip(page, zip);
  const { un } = await exportZip(page, dl, { all: true });
  assert.deepEqual(un['Dov Madeup/Essay.docx'], files['Dov Madeup/Essay.docx']);
  assert.deepEqual(un['Dov Madeup/notes.txt'], files['Dov Madeup/notes.txt']);
  assert.ok(isPdf(un['Cleo Fixture/Essay.pdf']));
  await dl.close(); await close();
});

test('file names that Windows can’t save are made safe', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Aria: "the?" Testwell/Essay*1.pdf': await makePaper() }));
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);
  const paths = await page.evaluate(() => window.__gs.exportPlan(true).map(o => o.path));
  assert.equal(paths.length, 1);
  assert.doesNotMatch(paths[0], /[\\:*?"<>|]/);
  await close();
});

test('the grade sheet finds a grade printed on the paper, and offers it', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await page.evaluate(() => window.__gs.scanAll());
  const cleo = await page.evaluate(() => { const st = window.__gs.state().batch.students.find(s => s.key === 'Cleo Fixture'); return [window.__gs.gradeOf(st), st.doubts.map(d => d.text)]; });
  assert.deepEqual(cleo, [{ total: null, pct: null, done: false }, ['9.5/12 = 88%']]);
  const used = await page.evaluate(() => { const G = window.__gs, st = G.state().batch.students.find(s => s.key === 'Cleo Fixture'); G.setReading(st, G.readKey(st.doubts[0]), '1'); return G.gradeOf(st); });
  assert.deepEqual(used, { total: 9.5, pct: 88, done: true, paper: true });
  await close();
});

test('nothing leaves this computer while opening, marking and exporting', async () => {
  const { page, close, srv } = await openApp(browser, { noWait: true });
  const seen = [];
  page.on('request', r => { const u = r.url(); if (/^https?:/.test(u) && !u.startsWith(srv.url)) seen.push(u); });
  await page.reload(); await appReady(page);
  const dl = await catchDownloads(page);
  await markedStack(page);
  await exportZip(page, dl);
  await dl.close();
  // Only the font request is allowed for now: Phase 3 builds the font in. The test browser blocks it anyway.
  assert.deepEqual(seen.filter(u => !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u)), []);
  await close();
});
