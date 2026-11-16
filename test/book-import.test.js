// Gradebook import: past scores from a spreadsheet (CSV, cells pasted, or Excel), matched to the roster, previewed, and never put
// over a score already there unless the teacher says so. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const fflate = require('fflate');
const { launch } = require('./helpers/chrome');
const { noStamps, classPage, openApp, pick } = require('./helpers/app');

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
const lib = async page => noStamps(await page.evaluate(() => window.__gs.state().lib));
const items = async page => (await lib(page)).classes[0].units.flatMap(u => u.items);
async function openImport(page) {
  await classPage(page, 'c1');
  await page.waitForSelector('[data-book="c1"]');
  await page.click('[data-book="c1"]');
  await page.waitForSelector('[data-bkimport]');
  await pick(page, '[data-bkimport]');
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
  assert.match(await page.$eval('.bkiclt', e => e.textContent), /Poetry test.*Aria Testwell.*Mine: 27\/30.*File: 24\/30/);
  assert.match(await page.$eval('#bkiOut', e => e.textContent), /2 scores already come from graded papers/);
  assert.deepEqual(await page.$$eval('[data-bkigo]', s => s.map(x => x.value)), ['i2', 'i1'], 'the same names go to the assignments already there');
  await page.click('[data-bkisave]');
  await page.waitForSelector('#bkTab');
  let its = await items(page);
  assert.equal(its.length, 2, 'no new cards');
  // Kept: Aria's 27. Same: Bram's 21. New: Cleo's 30. The essay's graded papers stay; Cleo, with no paper, gets the typed 12.
  assert.deepEqual(its.find(x => x.id === 'i2').typed.s, { 'Aria Testwell': { v: 27 }, 'Bram Sample': { v: 21, st: '' }, 'Cleo Fixture': { v: 30, st: '' } });
  assert.deepEqual(its.find(x => x.id === 'i1').typed, { max: 20, s: { 'Cleo Fixture': { v: 12, st: '' } } });
  assert.match(await page.$eval('[data-bkn="Aria Testwell"][data-bked="i2"]', e => e.textContent), /90%/);
  // Again, this time using the file's scores.
  await pick(page, '[data-bkimport]'); await page.waitForSelector('#bkImp');
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

test('the type of each column is one of the teacher’s own gradebook types', async () => {
  const s = seed(), lib0 = JSON.parse(s.ls['gs.lib']);
  lib0.book.cats = [{ id: 'sum' }, { id: 'hw', name: 'Homework', k: 2 }, { id: 'fm' }];
  lib0.book.w = { sum: 60, hw: 40, fm: 0 };
  s.ls['gs.lib'] = JSON.stringify(lib0);
  const { page, close } = await openApp(browser, { seed: s });
  await openImport(page);
  await paste(page, 'Name\tHomework 3\tQuiz 2\tUnit test\nAria Testwell\t8\t17\t30\n');
  await page.waitForSelector('.bkitab');
  assert.deepEqual(await page.$$eval('[data-bkitype="1"] option', o => o.map(x => x.value + ':' + x.textContent)), ['sum:Summative', 'hw:Homework', 'fm:Formative']);
  assert.deepEqual(await page.$$eval('[data-bkitype]', s => s.map(x => x.value)), ['hw', 'sum', 'sum'], 'named after a type, else the first one that takes a score');
  await page.select('[data-bkitype="2"]', 'hw');
  await page.click('[data-bkisave]');
  await page.waitForSelector('#bkTab');
  const its = await items(page);
  assert.equal(its.find(x => x.name === 'Quiz 2').type, 'hw');
  assert.equal(its.find(x => x.name === 'Homework 3').type, 'hw');
  noErrors(page); await close();
});

test('names a little different are matched, but "Quiz 1" is never "Quiz 2" and a shared word alone is not enough', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  const f = await page.evaluate(() => { const { bkiFit } = window.__gs; return [bkiFit('Quiz 1', 'Quiz 2'), bkiFit('Map test', 'Poetry test'), bkiFit('Poetry Test (Unit 1)', 'Poetry test'), bkiFit('Narative Essay', 'Narrative essay'), bkiFit('Poetry analysis', 'Poetry test'), bkiFit('poetry test', 'Poetry test'), bkiFit('Test (Unit 2)', 'Test (Unit 1)')]; });
  assert.deepEqual(f.map(x => Math.round(x * 100) / 100), [0, 0, 0.95, 0.94, 0.5, 1, 0]);
  await openImport(page);
  await paste(page, 'Name\tPoetry Test (Unit 1)\tNarative Essay\tNarrative essay 2\tMap test\nCleo Fixture\t25\t15\t16\t9\n');
  await page.waitForSelector('.bkitab');
  const go = () => page.$$eval('[data-bkigo]', s => Object.fromEntries(s.map(x => [x.closest('tr').querySelector('[data-bkiname]').value, x.value])));
  assert.deepEqual(await go(), { 'Poetry Test (Unit 1)': 'i2', 'Narative Essay': 'i1', 'Narrative essay 2': 'new', 'Map test': 'new' });
  assert.equal(await page.$$eval('.bkigo + .stag', t => t.length), 2, 'close matches are flagged to check');
  // One assignment can't take two columns: Poetry test is already taken, so it can't be picked for Map test.
  assert.equal(await page.$eval('[data-bkigo="4"] option[value="i2"]', o => o.disabled), true);
  await page.click('[data-bkisave]');
  await page.waitForSelector('#bkTab');
  const its = await items(page);
  assert.equal(its.length, 4, 'two new, two added to');
  assert.deepEqual(its.find(x => x.id === 'i2').typed.s['Cleo Fixture'], { v: 25, st: '' });
  noErrors(page); await close();
});

test('a loosely close name waits for the teacher: Same, New or Skip, and nothing is saved before that', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openImport(page);
  await paste(page, 'Name\tPoetry analysis\nAria Testwell\t20\n');
  await page.waitForSelector('.bkitab');
  assert.equal(await page.$eval('[data-bkigo]', s => s.value), '');
  assert.equal(await page.$eval('[data-bkisave]', b => b.disabled), true);
  assert.match(await page.$eval('#bkiCount', e => e.textContent), /Choose where one assignment goes first/);
  await page.select('[data-bkigo]', 'skip');
  assert.equal(await page.$eval('[data-bkisave]', b => b.disabled), true, 'nothing left to import');
  await page.select('[data-bkigo]', 'i2');
  assert.equal(await page.$eval('[data-bkisave]', b => b.disabled), false);
  assert.match(await page.$eval('.bkiclt', e => e.textContent), /Mine: 27\/30.*File: 20\/30/);
  noErrors(page); await close();
});

test('each differing score can be kept or replaced on its own, and one Undo takes the whole import back', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  const before = (await items(page)).find(x => x.id === 'i2').typed;
  await openImport(page);
  await paste(page, 'Student,Poetry test,Spelling bee\nAria Testwell,24,8\nBram Sample,18,9\nZed Nobody,30,10\n');
  await page.waitForSelector('#bkiClash');
  assert.match(await page.$eval('#bkiClash', e => e.textContent), /2 scores are already/);
  await page.click('[data-bkiover="1|Bram Sample"][data-v="file"]');
  await page.waitForSelector('[data-bkiover="1|Bram Sample"][data-v="file"][aria-pressed="true"]');
  assert.equal(await page.$eval('[data-bkiover="1|Aria Testwell"][data-v="keep"]', b => b.getAttribute('aria-pressed')), 'true');
  // The row nobody matches is left out unless the teacher adds it.
  assert.equal(await page.$eval('[data-bkipick]', s => s.value), '');
  await page.click('[data-bkisave]');
  await page.waitForSelector('#bkTab');
  let l = await lib(page), its = l.classes[0].units.flatMap(u => u.items);
  assert.deepEqual(its.find(x => x.id === 'i2').typed.s, { 'Aria Testwell': { v: 27 }, 'Bram Sample': { v: 18, st: '' } });
  assert.deepEqual(l.classes[0].names, NAMES, 'no student added, and the ones missing from the file are still there');
  await page.waitForSelector('.toast .tact');
  await page.click('.toast .tact');
  await page.waitForFunction(() => !window.__gs.state().lib.classes[0].units.some(u => u.items.some(i => i.name === 'Spelling bee')));
  its = await items(page);
  assert.deepEqual(its.find(x => x.id === 'i2').typed, before);
  noErrors(page); await close();
});

test('the file’s categories go into the teacher’s own types once each, or make a new type', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openImport(page);
  await paste(page, 'Name,Lab 1,Lab 2,Unit test,Reading log [In-class]\nCategory,Practical,Practical,Summative,\nAria Testwell,8,9,30,5\n');
  await page.waitForSelector('.bkicats');
  assert.deepEqual(await page.$$eval('[data-bkicat]', s => s.map(x => x.dataset.bkicat + '=' + x.value)), ['Practical=+:Practical', 'Summative=sum', 'In-class=ic']);
  assert.match(await page.$eval('#bkiOut', e => e.textContent), /counts for nothing in the term grade until you give it a weight/);
  await page.click('[data-bkisave]');
  await page.waitForSelector('#bkTab');
  const l = await lib(page), its = l.classes[0].units.flatMap(u => u.items), made = l.book.cats.find(x => x.name === 'Practical');
  assert.deepEqual(l.book.cats.map(x => x.id).slice(0, 3), ['ic', 'sum', 'fm']);
  assert.equal(l.book.cats.length, 4); assert.ok(made.k >= 1 && made.k <= 5);
  assert.deepEqual(['Lab 1', 'Lab 2', 'Unit test', 'Reading log'].map(n => its.find(x => x.name === n).type), [made.id, made.id, 'sum', 'ic']);
  noErrors(page); await close();
});

test('a class with no students yet gets its roster, IDs and emails from the file, read the long way round too', async () => {
  const s = seed(), l0 = JSON.parse(s.ls['gs.lib']);
  l0.classes.push({ id: 'c2', name: 'Grade 10 History', names: [], units: [{ id: 'u2', name: 'Unit A', items: [] }] });
  s.ls['gs.lib'] = JSON.stringify(l0);
  const { page, close } = await openApp(browser, { seed: s });
  const long = 'Student,Student ID,Email,Assignment,Score,Out of,Category\n' +
    'Ezra Placeholder,200101,ezra@example.org,Map quiz,8,10,Formative\nEzra Placeholder,200101,ezra@example.org,Essay,30,40,Summative\n' +
    'Faye Invented,200102,faye@example.org,Map quiz,9,10,Formative\nFaye Invented,200102,faye@example.org,Essay,35,40,Summative\n';
  const w = await page.evaluate(t => { const { bkiParse, bkiWide } = window.__gs; return bkiWide(bkiParse(t)); }, long);
  assert.deepEqual(w[0], ['Student', 'Student ID', 'Email', 'Map quiz', 'Essay']);
  await classPage(page, 'c2');
  await pick(page, '[data-bkfirst]');
  await page.waitForSelector('#bkBody [data-bkimport]');
  await page.$eval('#bkBody [data-bkimport]', b => b.click());
  await page.waitForSelector('#bkImp');
  await paste(page, long);
  await page.waitForSelector('.bkitab');
  assert.match(await page.$eval('.bkisum', e => e.textContent), /no students yet, so they become its roster/);
  assert.deepEqual(await page.$$eval('[data-bkipick]', s => s.map(x => x.value)), ['+', '+']);
  assert.match(await page.$eval('.bkiinfo', e => e.textContent), /Fill in 2 student IDs and 2 emails/);
  await page.click('[data-bkisave]');
  await page.waitForSelector('#bkTab');
  const c = (await lib(page)).classes.find(x => x.id === 'c2');
  assert.deepEqual(c.names, ['Ezra Placeholder', 'Faye Invented']);
  assert.deepEqual(c.info['Faye Invented'], { id: '200102', email: 'faye@example.org' });
  const it = c.units.flatMap(u => u.items).find(x => x.name === 'Essay');
  assert.deepEqual(it.typed, { max: 40, s: { 'Ezra Placeholder': { v: 30, st: '' }, 'Faye Invented': { v: 35, st: '' } } });
  assert.equal(it.type, 'sum');
  noErrors(page); await close();
});

test('a class with a roster adds a student only when asked, and fills in only the details it has none of', async () => {
  const s = seed(), l0 = JSON.parse(s.ls['gs.lib']);
  l0.classes[0].info = { 'Aria Testwell': { email: 'aria@school.example' } };
  s.ls['gs.lib'] = JSON.stringify(l0);
  const { page, close } = await openApp(browser, { seed: s });
  await openImport(page);
  await paste(page, 'Name,Email,Pop quiz\nAria Testwell,aria.other@example.org,5\nBram Sample,bram@example.org,6\nGus Newcomer,gus@example.org,7\n');
  await page.waitForSelector('.bkiinfo');
  assert.match(await page.$eval('.bkiinfo', e => e.textContent), /Fill in 1 email where you have none.*1 student already has a different one/);
  await page.select('[data-bkipick]', '+');
  await page.waitForFunction(() => /1 new student/.test(document.querySelector('#bkiCount').textContent));
  await page.click('[data-bkisave]');
  await page.waitForSelector('#bkTab');
  const c = (await lib(page)).classes[0];
  assert.deepEqual(c.names, [...NAMES, 'Gus Newcomer']);
  assert.deepEqual(c.info, { 'Aria Testwell': { email: 'aria@school.example' }, 'Bram Sample': { email: 'bram@example.org' }, 'Gus Newcomer': { email: 'gus@example.org' } });
  noErrors(page); await close();
});

test('a score is put on the scale of the assignment it goes to, and a name already on the roster can’t be added again', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openImport(page);
  await paste(page, 'Name,Poetry test (50)\nCleo Fixture,45\nAria Testwell,40\nAria Testwell,41\n');
  await page.waitForSelector('.bkitab');
  assert.match(await page.$eval('.bkiscale', e => e.textContent), /Out of 30, as it is now \(the file’s out of 50 is scaled to it\)/);
  // The two Aria rows can't both be her, so neither is matched, and neither can be added as a second Aria.
  assert.deepEqual(await page.$$eval('[data-bkipick] option[value="+"]', o => o.map(x => x.disabled)), [true, true]);
  await page.click('[data-bkisave]');
  await page.waitForSelector('#bkTab');
  const l = await lib(page);
  assert.deepEqual(l.classes[0].units.flatMap(u => u.items).find(x => x.id === 'i2').typed.s['Cleo Fixture'], { v: 27, st: '' });
  assert.deepEqual(l.classes[0].names, NAMES);
  noErrors(page); await close();
});
