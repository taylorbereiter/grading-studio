// Gradebook import: past scores from a spreadsheet (CSV, cells pasted, or Excel), matched to the roster, previewed, and never put
// over a score already there unless the teacher says so. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const fflate = require('fflate');
const { launch } = require('./helpers/chrome');
const { classPage, openApp } = require('./helpers/app');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'];
const PTS = { mode: 'points', criteria: [], outOf: 20 };
const g = points => ({ f: {}, h: {}, g: { rubric: [], points, comment: '' } });
const day = s => Date.parse(s + 'T12:00:00Z');
// Poetry test: typed in, out of 30. Narrative essay: a graded download, out of 20.
function seed() {
  const lib = {
    classes: [{ id: 'c1', name: 'Grade 9 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [
      { id: 'i1', name: 'Narrative essay', classId: 'c1', type: 'sum', due: '2026-10-20', batchId: 'gs.b.a1' },
      { id: 'i2', name: 'Poetry test', classId: 'c1', type: 'sum', due: '2026-10-29', typed: { max: 30, s: { 'Aria Testwell': { v: 27 }, 'Bram Sample': { v: 21 } } } },
    ] }] }],
    loose: { id: '', units: [] }, seed2627: true,
    book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2026-10-31' }, { id: 't2', name: 'Term 2', start: '2026-11-01', end: '2027-01-31' }] },
  };
  const work = { 'gs.b.a1': { t: day('2026-10-21'), cls: 'c1', setup: PTS, s: { 'Aria Testwell': g('16'), 'Bram Sample': g('14') } } };
  const ls = { 'gs.lib': JSON.stringify(lib) };
  for (const [k, v] of Object.entries(work)) ls[k] = JSON.stringify(v);
  const meta = [['gs.b.a1', { id: 'gs.b.a1', name: 'A download', n: 4, t: work['gs.b.a1'].t, asg: 'i1' }]];
  return { ls, idb: { 'grading-studio-keep': { version: 2, stores: { papers: [], work: [], edits: [], meta } } } };
}
const noErrors = page => assert.deepEqual(page.errors, []);
const lib = page => page.evaluate(() => window.__gs.state().lib);
const items = async page => (await lib(page)).classes[0].units.flatMap(u => u.items);
async function openImport(page) {
  await classPage(page, 'c1');
  await page.waitForSelector('[data-book="c1"]');
  await page.click('[data-book="c1"]');
  await page.waitForSelector('[data-bkimport]');
  await page.click('[data-bkimport]');
  await page.waitForSelector('#bkImp');
}
const paste = (page, text) => page.evaluate(t => { const el = document.querySelector('#bkiPaste'), dt = new DataTransfer(); dt.setData('text/plain', t); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, text);

test('a CSV is read the way spreadsheets write it: quotes, last-name-first, a points row, statuses, totals and IDs set aside', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  const r = await page.evaluate(() => {
    const { bkiParse, bkiRead } = window.__gs;
    const csv = 'Student ID,Student,"Quiz 1, vocab",Essay (40),Lab,Exit ticket,Total %\r\n' +
      ',Points possible,10,,,,\r\n' +
      '1001,"Testwell, Aria",8,32,17/20,90%,88\r\n' +
      '1002,"Sample, Bram",M,28.5,15/20,ex,70\r\n' +
      '1003,"Nobody, Zed",9,,"12/20 late",,75\r\n' +
      ',Class average,8.5,30,,,78\r\n';
    const d = bkiRead(bkiParse(csv));
    return { students: d.students.map(s => s.name), cols: d.cols.map(c => [c.name, c.max, c.pct, c.on, c.type, c.how]) };
  });
  assert.deepEqual(r.students, ['Aria Testwell', 'Bram Sample', 'Zed Nobody']);
  assert.deepEqual(r.cols, [
    ['Quiz 1, vocab', 10, false, true, 'ic', 'row'],
    ['Essay', 40, false, true, 'sum', 'head'],
    ['Lab', 20, false, true, 'ic', 'cells'],
    ['Exit ticket', null, true, true, 'ic', 'cells'],
    ['Total %', null, true, false, 'ic', 'guess'],
  ]);
  const cells = await page.evaluate(() => ['17/20', '85%', 'missing', 'EX', '12 (late)', 'B+', '', '7,5'].map(window.__gs.bkiCell));
  assert.deepEqual(cells, [{ v: 17, of: 20, st: '' }, { pct: 85, st: '' }, { st: 'missing' }, { st: 'excused' }, { v: 12, st: 'late' }, { bad: true }, null, { v: 7.5, st: '' }]);
  assert.equal(await page.evaluate(() => window.__gs.bkiDate('Quiz 3 (2026-10-02)')), '2026-10-02');
  noErrors(page); await close();
});

test('pasted cells show a preview, an unmatched row can be given to a student, and Import makes typed-in assignments', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openImport(page);
  assert.equal(await page.$eval('[data-bkisave]', b => b.disabled), true);
  await paste(page, 'Name\tVocab quiz /20\tBook talk\nAria Testwell\t17\t88\nBram Sample\t15.5\t72%\nCleo F.\tmissing\t95\nDov Madeup\t20\texcused\n');
  await page.waitForSelector('.bkitab');
  assert.match(await page.$eval('.bkisum', e => e.textContent), /2 assignments.*4 students\. 3 of them match/);
  // Nothing saved yet.
  assert.equal((await items(page)).length, 2);
  // Cleo F. didn't match on its own; the teacher picks her.
  await page.select('[data-bkipick]', 'Cleo Fixture');
  await page.waitForFunction(() => !document.querySelector('[data-bkipick]'));
  await page.$eval('[data-bkidue="1"]', e => { e.value = '2026-09-26'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.$eval('#bkiAll', e => { e.value = '2026-09-30'; });
  await page.click('[data-bkiall]');
  assert.equal(await page.$eval('[data-bkidue="2"]', e => e.value), '2026-09-30');
  assert.equal(await page.$eval('[data-bkisave]', b => b.textContent), 'Import 2 assignments');
  await page.click('[data-bkisave]');
  await page.waitForFunction(() => /Vocab quiz/.test((document.querySelector('#bkTab thead') || {}).textContent || ''));
  const its = await items(page), vq = its.find(x => x.name === 'Vocab quiz'), bt = its.find(x => x.name === 'Book talk');
  assert.deepEqual(vq.typed, { max: 20, s: { 'Aria Testwell': { v: 17, st: '' }, 'Bram Sample': { v: 15.5, st: '' }, 'Cleo Fixture': { v: null, st: 'missing' }, 'Dov Madeup': { v: 20, st: '' } } });
  assert.equal(vq.due, '2026-09-26'); assert.equal(vq.type, 'ic');
  assert.deepEqual(bt.typed, { max: null, s: { 'Aria Testwell': { v: 88, st: '' }, 'Bram Sample': { v: 72, st: '' }, 'Cleo Fixture': { v: 95, st: '' }, 'Dov Madeup': { v: null, st: 'excused' } } });
  const u = (await lib(page)).classes[0].units.find(x => x.items.includes ? x.items.some(i => i.name === 'Vocab quiz') : false);
  assert.equal(u.name, 'Imported');
  noErrors(page); await close();
});

test('a column named like an assignment already there adds to it, keeps what’s there unless told, and never touches a graded paper', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openImport(page);
  await paste(page, 'Student,Poetry test,Narrative essay\nAria Testwell,24,10\nBram Sample,21,11\nCleo Fixture,30,12\n');
  await page.waitForSelector('#bkiClash');
  assert.match(await page.$eval('#bkiClash', e => e.textContent), /1 score is already in the gradebook/);
  assert.match(await page.$eval('#bkiClash details', e => e.textContent), /Poetry test, Aria Testwell: 27\/30 now, 24\/30 in the file/);
  assert.match(await page.$eval('#bkiOut', e => e.textContent), /2 scores already come from graded papers/);
  assert.match(await page.$eval('#bkiOut', e => e.textContent), /Adds to “Poetry test”/);
  await page.click('[data-bkisave]');
  await page.waitForSelector('#bkTab');
  let its = await items(page);
  assert.equal(its.length, 2, 'no new cards');
  // Kept: Aria's 27. Same: Bram's 21. New: Cleo's 30. The essay's graded papers stay; Cleo, with no paper, gets the typed 12.
  assert.deepEqual(its.find(x => x.id === 'i2').typed.s, { 'Aria Testwell': { v: 27 }, 'Bram Sample': { v: 21, st: '' }, 'Cleo Fixture': { v: 30, st: '' } });
  assert.deepEqual(its.find(x => x.id === 'i1').typed, { max: 20, s: { 'Cleo Fixture': { v: 12, st: '' } } });
  assert.match(await page.$eval('[data-bkn="Aria Testwell"][data-bked="i2"]', e => e.textContent), /90%/);
  // Again, this time using the file's scores.
  await page.click('[data-bkimport]'); await page.waitForSelector('#bkImp');
  await paste(page, 'Student,Poetry test\nAria Testwell,24\n');
  await page.waitForSelector('#bkiClash');
  await page.click('[data-bkikeep="file"]');
  await page.click('[data-bkisave]');
  await page.waitForSelector('#bkTab');
  its = await items(page);
  assert.deepEqual(its.find(x => x.id === 'i2').typed.s['Aria Testwell'], { v: 24, st: '' });
  noErrors(page); await close();
});

test('an Excel file is read from its first sheet', async () => {
  const sheet = '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
    '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>18</v></c></row>' +
    '<row r="3"><c r="A3" t="inlineStr"><is><t>Dov Madeup</t></is></c><c r="B3"><v>14.5</v></c></row></sheetData></worksheet>';
  const strings = '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Name</t></si><si><t>Map test (20)</t></si><si><t>Bram Sample</t></si></sst>';
  const te = new TextEncoder(), file = path.join(os.tmpdir(), 'gs-import-' + process.pid + '.xlsx');
  fs.writeFileSync(file, fflate.zipSync({ 'xl/worksheets/sheet1.xml': te.encode(sheet), 'xl/sharedStrings.xml': te.encode(strings) }));
  const { page, close } = await openApp(browser, { seed: seed() });
  try {
    await openImport(page);
    const input = await page.$('#bkiFile');
    await input.uploadFile(file);
    await page.waitForSelector('.bkitab');
    await page.click('[data-bkisave]');
    await page.waitForSelector('#bkTab');
    const it = (await items(page)).find(x => x.name === 'Map test');
    assert.deepEqual(it.typed, { max: 20, s: { 'Bram Sample': { v: 18, st: '' }, 'Dov Madeup': { v: 14.5, st: '' } } });
    assert.equal(it.type, 'sum');
    noErrors(page);
  } finally { fs.rmSync(file, { force: true }); await close(); }
});

test('a file with no names says so, and Cancel saves nothing', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openImport(page);
  await paste(page, '12\n15\n18\n');
  await page.waitForFunction(() => !document.querySelector('#bkiErr').hidden);
  assert.match(await page.$eval('#bkiErr', e => e.textContent), /no column of student names/);
  await paste(page, 'Name,Quiz\nAria Testwell,5\n');
  await page.waitForSelector('.bkitab');
  await page.click('[data-bkback]');
  await page.waitForFunction(() => !document.querySelector('#bkImp') && document.querySelector('[data-bkimport]'));
  assert.equal((await items(page)).length, 2);
  noErrors(page); await close();
});
