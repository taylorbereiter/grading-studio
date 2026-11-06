// Marks only, in Share with Claude: one Markdown file of scores, comments and marks, by code, with no names in it. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, catchDownloads } = require('./helpers/app');
const { makePaper, zipOf, standardFiles } = require('./helpers/fixtures');

let browser, files;
before(async () => {
  browser = await launch(); files = await standardFiles();
  files['Aria Testwell/Essay.pdf'] = await makePaper({ title: 'Essay', pages: 2, lines: ['My name is Aria Testwell, email aria.t@school.example'] });
  files['Eli Nobody/Essay.pdf'] = await makePaper({ title: 'Untouched essay' });
});
after(async () => { await browser.close(); });

const NAMES = /Aria|Testwell|Bram|Sample|Cleo|Fixture|Dov|Madeup|Eli|Nobody|school\.example/;

// Marks put straight into the saved work, in page points. The first typed line of filler sits about 110 to 124 down the page.
const plant = page => page.evaluate(() => {
  const s = window.__gs.state(), b = s.batch, by = k => b.students.find(st => st.key === k);
  const aria = by('Aria Testwell'), f = aria.files.find(x => x.name === 'Essay.pdf');
  f.marks[0] = [
    { t: 'hl', color: '#ff0', x: 55, y: 108, w: 120, h: 18 },
    { t: 'stamp', k: 'sp', x: 200, y: 117, size: 30 },
    { t: 'stamp', k: 'sp', x: 260, y: 141, size: 30 },
    { t: 'stamp', k: 'star', x: 400, y: 300, size: 40 },
    { t: 'note', color: '#d00', ax: 100, ay: 117, text: 'Aria, is this your claim?' },
    { t: 'text', color: '#d00', x: 100, y: 400, size: 14, text: 'Good, Aria Testwell' },
    { t: 'pen', color: '#d00', w: 2, pts: [[10, 10], [20, 20]] },
    { t: 'check', color: '#d00', x: 50, y: 50, size: 20 },
  ];
  f.marks[1] = [{ t: 'hl', color: '#ff0', x: 55, y: 700, w: 500, h: 18 }];   // over the line with her name and email
  aria.grade.rubric = setupRows().map((_, i) => i ? 3 : 3.5);
  aria.grade.comment = 'Strong claim, Aria. Bram did this too.';
  by('Bram Sample').grade.status = 'missing';
  by('Dov Madeup').grade.comment = 'Dov, save it as a PDF next time.';
  function setupRows() { return s.setup.criteria; }
});

test('Marks only: one file by code, with scores, comments, marks and the words under them, and no names', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'Tide essay.zip');
  await page.evaluate(() => window.__gs.state().setup.mode === 'rubric' || (window.__gs.state().setup.mode = 'rubric'));
  await plant(page);
  const dl = await catchDownloads(page);
  await page.click('#moreBtn'); await page.click('#shareBtn');
  await page.waitForSelector('[data-kind="marks"]');
  await page.click('[data-kind="marks"]');
  await page.waitForSelector('#mkAsk');
  assert.equal(await page.$eval('#shPapers', e => e.hidden), true);
  assert.equal(await page.$eval('[data-make]', e => e.hidden), true);
  assert.equal(await page.$eval('#mkAsk', e => e.value), await page.evaluate(() => window.__gs.MARKS_ASK));
  assert.match(await page.$eval('#mkOut', e => e.textContent), /students? with no marks/, 'Eli has nothing yet');
  const got = await dl.next(() => page.click('[data-marksdl]'));
  await dl.close();
  assert.match(got.name, /^Marks for Claude - Tide essay\.md$/);
  const md = new TextDecoder().decode(got.bytes);
  const { codes, sent } = await page.evaluate(() => window.__gs.state().batch.share);
  const a = codes['Aria Testwell'];
  assert.doesNotMatch(md, NAMES, md);
  assert.match(md, new RegExp('## ' + a));
  const part = md.slice(md.indexOf('## ' + a), md.indexOf('\n## ', md.indexOf('## ' + a) + 3) >>> 0);
  assert.match(part, /Total 9\.5 \/ 12/);
  assert.match(part, /Comment: Strong claim, \[name\]\. \[name\] did this too\./);
  assert.match(part, /margin comment: "\[name\], is this your claim\?" on: "The river/);
  assert.match(part, /text on page: "Good, \[name\] \[name\]"/);
  assert.match(part, /highlighted: "The river in this story"/);
  assert.match(part, /Spelling on: "/);
  assert.match(part, /sticker: Star\n/, 'a sticker quotes nothing');
  assert.match(part, /1 pen mark, 1 check/);
  assert.match(part, /Page 2\n- highlighted: "My name is \[name\]/);
  assert.match(part, /Marks: Spelling 2/);
  assert.match(md, new RegExp('## ' + codes['Bram Sample'] + '\\nMissing\\n\\n'), 'missing says so, and nothing more');
  assert.match(md, new RegExp('## ' + codes['Dov Madeup'] + '[\\s\\S]*Comment: \\[name\\], save it as a PDF'));
  assert.doesNotMatch(md, new RegExp(codes['Eli Nobody']), 'nothing about a student with nothing');
  assert.match(md, /Not in this file: 2 students/);
  assert.match(md, /\| code \|/);
  assert.ok(sent.includes(a), 'Bring back knows who went');
  // Unticking a kind of mark leaves it out, and the choice is remembered.
  await page.click('[data-mkopt="words"]');
  const md2 = await page.evaluate(async () => (await window.__gs.marksFileText()).text);
  assert.doesNotMatch(md2, /highlighted:|on: "/);
  assert.match(md2, /1 pen mark, 1 check, 1 highlight\nPage 2\n- 1 highlight/);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.share.kind), 'marks');
  assert.deepEqual(page.errors, []);
  await close();
});
