// Student history, the consistency check, and the Claude steps with their name-cover check, in the real built app. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { unzipSync } = require('fflate');
const { PDFDocument, PDFName, PDFString, PDFHexString } = require('pdf-lib');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goToStudent, score, settle, catchDownloads, press, closeBox } = require('./helpers/app');
const { makePaper, zipOf, standardFiles } = require('./helpers/fixtures');

let browser, files;
before(async () => {
  browser = await launch(); files = await standardFiles();
  files['Cleo Fixture/Essay.pdf'] = await makePaper({ title: 'Cleo Fixture essay' });   // no grade typed on it, which would count as the only marked paper
});
after(async () => { await browser.close(); });

const CRIT = ['Thesis', 'Evidence', 'Style'], SETUP = { mode: 'rubric', criteria: CRIT, outOf: 10, scale: { 12: 100, 11: 95, 10: 91, 9: 86, 8: 82, 7: 77, 6: 73, 5: 68, 4: 64, 3: 60 } };
const g = (rubric, comment = '', more = {}) => ({ f: {}, h: {}, g: { rubric, points: '', comment, ...more } });
const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'];
// Saved earlier work: the same class, another class, an older copy of something, and nothing to do with her.
function savedWork() {
  const lib = { classes: [{ id: 'c1', name: '12EL-1', names: NAMES, units: [] }, { id: 'c2', name: '11EL-2', names: ['Aria Testwell', 'Nia Elsewhere'], units: [] }], loose: { id: '', name: '', names: [], units: [] }, seed2627: true };
  const past1 = { t: Date.UTC(2026, 8, 20), cls: 'c1', setup: SETUP, s: {
    'Testwell, Aria': g([3.5, 3.5, 3.5], 'PAST-COMMENT strong thesis, Aria Testwell.'),
    'Bram Sampel': g([2, 2, 2], 'TYPO-COMMENT needs evidence'),
    'Cleo Fixture': g([4], '', {}),
    'Dov Madeup': g([], 'Never turned in', { status: 'missing' }),
  } };
  const past2 = { t: Date.UTC(2025, 8, 20), cls: 'c2', setup: SETUP, s: { 'Aria Testwell': g([1, 1, 1], 'OTHER-CLASS-COMMENT') } };
  const old = { t: Date.UTC(2026, 7, 20), cls: 'c1', setup: SETUP, s: { 'Aria Testwell': g([2, 2, 2], 'OLDER-COPY-COMMENT') } };
  const rec = (id, name, more) => [id, { id, name, n: 4, t: Date.UTC(2026, 8, 21), ...more }];
  return {
    ls: { 'gs.lib': JSON.stringify(lib), 'gs.b.past1': JSON.stringify(past1), 'gs.b.past2': JSON.stringify(past2), 'gs.b.old': JSON.stringify(old) },
    idb: { 'grading-studio-keep': { version: 2, stores: { papers: [], work: [], edits: [], meta: [rec('gs.b.past1', 'River essay'), rec('gs.b.past2', 'Last year quiz'), rec('gs.b.old', 'Older copy', { newer: 'gs.b.past1' })] } } },
  };
}
const open = async (more) => { const a = await openApp(browser, { seed: savedWork(), ...more }); await openZip(a.page, zipOf(files), 'Tide essay.zip'); return a; };
const histText = page => page.$eval('#histSlot', e => e.textContent);
const waitHist = page => page.waitForSelector('#histBox');
const noErrors = page => assert.deepEqual(page.errors, []);
// The shuffled first paper can be a Word file, with no pages to wait for.
const waitAnon = page => page.waitForFunction(() => window.__gs.anonOn() && document.querySelector('#paper .who'));
const openHist = page => page.evaluate(() => { const d = document.querySelector('#histBox'); if (d) d.open = true; });

test('names: only what matches for sure counts, and close ones are only close', async () => {
  const { page, close } = await openApp(browser);
  const fit = (a, b) => page.evaluate((a, b) => window.__gs.nameFit(a, b), a, b), near = (a, b) => page.evaluate((a, b) => window.__gs.nameNear(a, b), a, b);
  assert.equal(await fit('Doe, Sam', 'Sam Doe'), 2);
  assert.equal(await fit('José Núñez', 'Jose Nunez'), 2, 'accents don’t matter');
  assert.equal(await fit('Sam Doe', 'Sam Q Doe'), 1);
  assert.equal(await fit('Sam', 'Sam Doe'), 0, 'one word alone is never enough');
  assert.equal(await fit('Sam Doe', 'Samuel Doe'), 0);
  assert.equal(await near('Sam Doe', 'Samuel Doe'), true);
  assert.equal(await near('Jon Smith', 'John Smith'), true);
  assert.equal(await near('Bram Sampel', 'Bram Sample'), true, 'two letters swapped');
  assert.equal(await near('Sam', 'Sam Doe'), true);
  assert.equal(await near('Sam Doe', 'Sam Lee'), false, 'the same first name is not close');
  assert.equal(await near('Mia Chen', 'Lia Chan'), false, 'something has to be exactly the same');
  const pairs = (names, keys) => page.evaluate((n, k) => [...window.__gs.rosterPairs(n, k)], names, keys);
  assert.deepEqual(await pairs(['Sam Doe', 'Mia Lee'], ['Doe, Sam', 'Lee Mia']), [['Sam Doe', 'Doe, Sam'], ['Mia Lee', 'Lee Mia']]);
  assert.deepEqual(await pairs(['Sam Doe', 'Sam Doe'], ['Sam Doe']), [], 'two students with one name: nobody is guessed');
  assert.deepEqual(await pairs(['Sam Doe'], ['Sam Doe', 'Doe, Sam']), [], 'one name, two folders: not guessed either');
  assert.deepEqual(await pairs(['Sam Doe', 'Sam Doe Lee'], ['Sam Doe']), [['Sam Doe', 'Sam Doe']], 'the exact one wins over the longer one');
  await close();
});

test('a past score is worked out by that download’s own rubric and scale', async () => {
  const { page, close } = await openApp(browser);
  const past = (su, gr) => page.evaluate((su, gr) => window.__gs.pastScore(su, { rubric: [], points: '', ...gr }), su, gr);
  const s = await past(SETUP, { rubric: [3.5, 3.5, 3.5] });
  assert.equal(s.total, 10.5); assert.equal(s.pct, 93, '10.5 = 93%'); assert.equal(s.max, 12);
  assert.equal((await past(SETUP, { rubric: [4] })).partial, true);
  const pts = await past({ mode: 'points', outOf: 20, scale: null }, { points: '17' });
  assert.equal(pts.total, 17); assert.equal(pts.pct, 85); assert.equal(pts.max, 20);
  assert.equal((await past(SETUP, { status: 'excused', rubric: [4, 4, 4] })).total, null, 'excused has no score');
  assert.equal((await past(undefined, { rubric: [3, 3, 3] })).pct, 86, 'old work with no rubric saved reads by the default');
  await close();
});

test('history beside the paper: the sure ones show, close and other-class names are flagged and hidden until she says', async () => {
  const { page, close } = await open();
  await waitHist(page); await openHist(page);
  const a = await histText(page);
  assert.match(a, /River essay/);
  assert.match(a, /10\.5 \/ 12 · 93%/);
  assert.match(a, /Thesis 3\.5 · Evidence 3\.5 · Style 3\.5/);
  assert.match(a, /PAST-COMMENT/);
  assert.match(a, /Aria Testwell.*11EL-2/s, 'the same name in another class is flagged');
  assert.doesNotMatch(a, /OTHER-CLASS-COMMENT/, 'and not shown');
  assert.doesNotMatch(a, /OLDER-COPY-COMMENT/, 'an older copy isn’t past work');
  assert.match(await page.$eval('#histBox summary', e => e.textContent), /1 earlier · last 93%.*1 to check/);

  // A misspelled name in the same class: flagged, no score, until she says.
  await goToStudent(page, 1); await waitHist(page);
  let b = await histText(page);
  assert.match(b, /Bram Sampel/); assert.match(b, /isn’t a sure match/); assert.doesNotMatch(b, /TYPO-COMMENT/);
  await page.click('#histBox [data-hist="1"]');
  await page.waitForFunction(() => /TYPO-COMMENT/.test(document.querySelector('#histSlot').textContent));
  b = await histText(page);
  assert.match(b, /6 \/ 12/); assert.match(b, /You said “Bram Sampel” is this student/);
  assert.equal(await page.$('#histBox [data-hist="1"]'), null, 'it stops asking');
  await page.click('#histBox [data-hist=""]');   // Undo
  await page.waitForFunction(() => !/TYPO-COMMENT/.test(document.querySelector('#histSlot').textContent));
  await page.click('#histBox [data-hist="0"]');   // Not them
  await page.waitForFunction(() => /isn’t this student/.test(document.querySelector('#histSlot').textContent));
  assert.doesNotMatch(await histText(page), /TYPO-COMMENT/);
  await page.click('#histBox [data-hist=""]');   // Ask again
  await page.waitForFunction(() => /Same student/.test(document.querySelector('#histSlot').textContent));

  // An answer is kept, and other students' history isn't mixed in. Missing shows as missing.
  await goToStudent(page, 2); await waitHist(page);
  const c = await histText(page);
  assert.match(c, /4 \/ 12/); assert.match(c, /partial/); assert.doesNotMatch(c, /PAST-COMMENT|TYPO-COMMENT/);
  await goToStudent(page, 3); await waitHist(page);
  assert.match(await histText(page), /missing/);
  noErrors(page); await close();
});

test('history is gone during anonymous grading, even when it was open, and comes back after', async () => {
  const { page, close } = await open();
  await waitHist(page); await openHist(page);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('gs.histOpen')) === true);
  await page.evaluate(() => window.__gs.setAnon(true));
  await waitAnon(page);
  const inPanel = async () => page.$eval('#grade', e => e.textContent);
  for (let i = 0; i < 4; i++) {
    await goToStudent(page, i);
    assert.equal(await page.$('#histBox'), null);
    assert.doesNotMatch(await inPanel(), /Past work|PAST-COMMENT|River essay|Sampel/);
  }
  assert.doesNotMatch(await page.evaluate(() => document.body.innerHTML), /PAST-COMMENT|TYPO-COMMENT/, 'not hidden on the page: not on the page at all');
  // Even a late answer from the saved work can't fill it in.
  await page.evaluate(() => window.__gs.histFill());
  assert.equal(await page.$('#histBox'), null);
  // Reopened still anonymous: still nothing.
  await settle(page);
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await page.reload(); await page.waitForFunction(() => window.__gs && window.__gs.state);
  await page.waitForFunction(() => window.__gs.kept().size > 0);
  await page.evaluate(id => window.__gs.reopenKept(id), id);
  await waitAnon(page);
  await new Promise(r => setTimeout(r, 300));
  assert.equal(await page.$('#histBox'), null, 'after reopening too');
  await page.evaluate(() => window.__gs.setAnon(false));
  await waitHist(page);
  noErrors(page); await close();
});

test('the Claude package has no past work and no names in it, with history open', async () => {
  const { page, close } = await open();
  await waitHist(page); await openHist(page);
  await score(page, [3, 3, 3]);
  const dl = await catchDownloads(page);
  await page.evaluate(() => window.__gs.openShare());
  await page.waitForSelector('#dlgBox [data-make]');
  const got = await dl.next(() => page.click('#dlgBox [data-make]'));
  const un = unzipSync(got.bytes);
  for (const [name, bytes] of Object.entries(un)) {
    const t = Buffer.from(bytes).toString('latin1');
    assert.doesNotMatch(t, /PAST-COMMENT|TYPO-COMMENT|OTHER-CLASS|River essay|Last year quiz|Sampel|Testwell|Bram Sample|Cleo Fixture|Dov Madeup/, name);
  }
  assert.ok(Object.keys(un).some(n => n.startsWith('papers/S-')));
  await dl.close();
  noErrors(page); await close();
});

test('drift is read cautiously: too few says nothing, small classes get a maybe, and nothing falsely precise', async () => {
  const { page, close } = await openApp(browser);
  const read = (v, max = 12) => page.evaluate((v, max) => window.__gs.driftRead(v, max), v, max);
  const say = (v, max = 12) => page.evaluate((v, max) => window.__gs.driftSay(window.__gs.driftRead(v, max), max), v, max);
  const falling = n => Array.from({ length: n }, (_, i) => 11.5 - Math.floor(i * 6 / n) * 1);   // a clean, big slide
  assert.equal((await read(falling(8))).level, 'few');
  assert.doesNotMatch(await say(falling(8)), /Later papers|you got harder|averages?/, 'with 8 papers it doesn’t name a direction');
  assert.match(await say(falling(8)), /Too few papers to say/);
  const mid = await read(falling(12));
  assert.equal(mid.level, 'hint'); assert.equal(mid.dir, 'harder');
  assert.match(await say(falling(12)), /Maybe, but it’s too soon to be sure.*could easily be chance/s);
  const big = await read(falling(24));
  assert.equal(big.level, 'likely');
  assert.match(await say(falling(24)), /Worth a look.*Later papers scored lower.*or just that those papers were weaker/s);
  assert.equal((await read(falling(24).reverse())).dir, 'softer');
  // Scores that bounce around with no pattern, and a real but tiny slide.
  const bounce = Array.from({ length: 24 }, (_, i) => [9, 11, 8, 10, 9.5, 11.5, 7.5, 10.5][i % 8]);
  assert.equal((await read(bounce)).level, 'none');
  assert.match(await say(bounce), /No clear change/);
  assert.equal((await read(Array.from({ length: 30 }, (_, i) => i < 15 ? 10 : 9.75))).level, 'none', 'too small to matter');
  assert.equal((await read(Array(24).fill(9))).level, 'none');
  assert.equal(JSON.stringify(await read(bounce)), JSON.stringify(await read(bounce)), 'the same scores always read the same');
  // Numbers come out rounded to the half point, and no chance figure is ever shown.
  const noisy = Array.from({ length: 24 }, (_, i) => (i < 8 ? 10.37 : i < 16 ? 9.1 : 8.23) + (i % 2 ? 0.11 : 0));
  const said = await say(noisy);
  assert.doesNotMatch(said, /\d\.\d\d|%|\bp\b|percent|significan/i, said);
  assert.match(said, /by about 2 points.*about 10\.5 .*about 8\.5/s, 'and the gap adds up with the numbers beside it');
  // Bring back from Claude touches everyone within a second: their order says nothing.
  const pts = [100, 200, 300, 5000, 9000].map(t => ({ t }));
  assert.deepEqual(await page.evaluate(p => { const r = window.__gs.dropBatched(p); return [r.out.length, r.off.length]; }, pts), [2, 3]);
  await close();
});

const roster24 = Array.from({ length: 24 }, (_, i) => 'Pupil' + String.fromCharCode(65 + i) + ' Madeup');
// A class she got steadily harder on, using each student's real score and time fields, as the app writes them.
const fill = (page, opts = {}) => page.evaluate(opts => {
  const b = window.__gs.state().batch, t0 = 1790000000000;
  b.students.forEach((st, i) => {
    const v = opts.same != null && i < opts.nSame ? opts.same : Math.max(1, 4 - Math.floor(i * 3 / b.students.length));
    st.grade.rubric = [v, v, v];
    st.grade.atR = { 0: t0 + i * 60000, 1: t0 + i * 60000 + 2000, 2: t0 + i * 60000 + 4000 };
    st.grade.at = opts.batched ? t0 + 9e6 + i : st.grade.atR[2];
    if (opts.noTimes && i < opts.noTimes) { delete st.grade.atR; delete st.grade.at; }
  });
}, opts);

test('the check on a full class: the reading, one dot per paper, a list, and rows read with a higher bar', async () => {
  const f = {}; for (const n of roster24) f[n + '/Essay.pdf'] = await makePaper({ title: n + ' essay' });
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(f), 'Big class.zip');
  await fill(page, { noTimes: 0 });
  await press(page, '#consBtn');
  await page.waitForSelector('#consBox');
  assert.match(await page.$eval('#consSay', e => e.textContent), /Worth a look.*Later papers scored lower/s);
  assert.equal((await page.$$('#consBox .ddot')).length, 24);
  assert.equal((await page.$$('#consBox .dmean')).length, 2, 'the first and last third’s averages');
  assert.equal((await page.$$('#consBox .clist tbody tr')).length, 24, 'the same data as a list');
  assert.equal((await page.$$('#consBox .crows li')).length, 3, 'each rubric row, read on its own');
  // Pointing at a dot says which paper; the hit area is bigger than the dot.
  const hit = await page.$('#consBox .dhit');
  const box = await hit.boundingBox();
  assert.ok(box.width >= 18, 'a dot is easy to hit: ' + box.width);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForSelector('#consTip:not([hidden])');
  assert.match(await page.$eval('#consTip', e => e.textContent), /4 ?\/ ?12|12 ?\/ ?12/);
  assert.match(await page.$eval('#consTip', e => e.textContent), /Scored 1st/);
  const size = await page.$eval('#consBox .dchart', e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; });
  assert.ok(size[0] > 300 && size[1] > 90, 'the chart has room: ' + size);
  // Times that came from one bulk change aren't used, and she's told.
  await closeBox(page);
  await page.evaluate(() => { const s = window.__gs.state(); for (const st of s.batch.students) delete st.grade.atR; });
  await fill(page, { batched: true });
  await page.evaluate(() => { for (const st of window.__gs.state().batch.students) delete st.grade.atR; });
  await press(page, '#consBtn');
  await page.waitForSelector('#consBox');
  assert.match(await page.$eval('#consBox', e => e.textContent), /24 changed all at once/);
  assert.match(await page.$eval('#consSay', e => e.textContent), /Too few papers to say/);
  assert.equal(await page.$('#consBox .dchart'), null);
  noErrors(page); await close();
});

test('a small class: no direction claimed, and same scores side by side with the paper, the rows and the comment', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'Small.zip');
  await page.evaluate(() => { window.__gs.state().batch.students[0].grade.comment = 'Clear thesis, Aria Testwell.'; });
  await fill(page, { same: 3, nSame: 3 });
  await press(page, '#consBtn');
  await page.waitForSelector('#consBox');
  const say = await page.$eval('#consSay', e => e.textContent);
  assert.match(say, /Too few papers to say/); assert.doesNotMatch(say, /Later papers|you got harder/);
  assert.match(await page.$eval('#consBox', e => e.textContent), /aren’t read one by one/);
  assert.equal(await page.$('#consBox .dmean'), null, 'no averages to read a trend into');
  assert.equal(await page.$('#consBox .crows'), null);
  const chips = await page.$$eval('#consBox [data-same]', l => l.map(b => b.textContent));
  assert.deepEqual(chips, ['9 3 papers']);
  await page.click('#consBox [data-same]');
  await page.waitForSelector('#sbsBody');
  await page.waitForFunction(() => document.querySelectorAll('#sbsBody .sbsp canvas').length === 3, { timeout: 30000 });
  const cols = await page.$$eval('#sbsBody .sbsc', l => l.map(c => c.textContent));
  assert.equal(cols.length, 3);
  assert.match(cols[0], /Aria Testwell/); assert.match(cols[0], /Criterion 1 3 · Criterion 2 3 · Criterion 3 3/); assert.match(cols[0], /Clear thesis/); assert.match(cols[0], /Page 1 of 2/);
  // Each column turns its own pages, and they line up next to each other.
  await page.click('#sbsBody .sbsc [data-pg="1"]');
  await page.waitForFunction(() => /Page 2 of 2/.test(document.querySelector('#sbsBody .sbsc').textContent));
  const xs = await page.$$eval('#sbsBody .sbsc', l => l.map(c => c.getBoundingClientRect().left));
  assert.ok(xs[1] > xs[0] && xs[2] > xs[1], 'side by side');
  await page.click('#dlgBox [data-back]');
  await page.waitForSelector('#consBox');
  await page.click('#consBox [data-same]');
  await page.waitForSelector('#sbsBody .sbsc [data-open]');
  await page.click('#sbsBody .sbsc [data-open]');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  noErrors(page); await close();
});

test('plain points: scored by the last change, with no rubric rows to read, and missing and partial papers stay out', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'Points.zip');
  await page.evaluate(() => {
    const G = window.__gs, S = G.state(), t0 = 1790000000000;
    S.setup.mode = 'points'; S.setup.outOf = 20; S.setup.scale = null;
    S.batch.students.forEach((st, i) => { st.grade.points = String(15 + i); st.grade.at = t0 + i * 60000; });
    S.batch.students[3].grade.status = 'missing';
    G.openCons();
  });
  await page.waitForSelector('#consBox');
  assert.equal((await page.$$('#consBox .ddot')).length, 3, 'missing has no score to read');
  assert.equal(await page.$('#consBox .crows'), null);
  assert.doesNotMatch(await page.$eval('#consBox', e => e.textContent), /read one by one/);
  assert.match(await page.$eval('#consBox .dhit', e => e.dataset.v), /^15 \/ 20$/);
  noErrors(page); await close();
});

test('during anonymous grading the check shows no names: not in the words, the list, the dots or the comments', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'Small.zip');
  await page.evaluate(() => { window.__gs.state().batch.students[0].grade.comment = 'Clear thesis, Aria.'; });
  await fill(page, { same: 3, nSame: 4 });
  await page.evaluate(() => window.__gs.setAnon(true));
  await waitAnon(page);
  await page.evaluate(() => window.__gs.openCons());
  await page.waitForSelector('#consBox');
  const nameRx = /Aria|Testwell|Bram|Sample|Cleo|Fixture|Dov|Madeup/;
  const all = () => page.$eval('#dlgBox', e => e.innerHTML);
  assert.doesNotMatch(await all(), nameRx);
  assert.match(await all(), /Paper \d/);
  await page.click('#consBox [data-same]');
  await page.waitForFunction(() => document.querySelectorAll('#sbsBody .sbsp canvas').length >= 2, { timeout: 30000 });
  assert.doesNotMatch(await all(), nameRx);
  assert.match(await page.$eval('#sbsBody', e => e.textContent), /Clear thesis, \[name\]/);
  noErrors(page); await close();
});

test('covers: each paper is checked only when she says so, the list shows who, and the check picks up where she left off', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'Tide essay.zip');
  await page.evaluate(() => window.__gs.openShare());
  await page.waitForSelector('#ccTodo');
  const count = () => page.$eval('#shCount', e => e.textContent);
  await page.waitForFunction(() => /^0 of [34] papers checked/.test(document.querySelector('#shCount').textContent));
  assert.equal(await page.$eval('#shCount', e => e.className), 'stag', 'it stands out until it’s all done');
  const total = +(await count()).match(/of (\d+)/)[1];
  assert.equal(await page.$eval('#dlgBox [data-make]', e => e.textContent), 'Download ZIP anyway', 'the ZIP says what it’s skipping');
  assert.match(await page.$eval('#dlgBox [data-check]', e => e.className), /primary/);
  await page.click('#dlgBox [data-check]');
  await page.waitForSelector('#ccBody canvas');
  assert.equal(await page.$eval('#ccState', e => e.textContent), 'Not checked yet');
  // Looking and leaving isn't checking.
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => /paper 2 of/.test(document.querySelector('#ccCount').textContent));
  await page.keyboard.press('Escape');
  await page.waitForSelector('#ccTodo');
  assert.match(await count(), /^0 of /);
  // Saying so is, after the paper has been drawn.
  await page.click('#dlgBox [data-check]');
  await page.waitForFunction(() => /paper 1 of/.test(document.querySelector('#ccCount').textContent) && document.querySelector('#ccBody canvas'));
  await page.waitForFunction(() => document.querySelectorAll('#ccBody canvas').length === 2);   // Aria's two pages
  await page.click('#dlgBox [data-next]');
  await page.waitForFunction(() => /paper 2 of/.test(document.querySelector('#ccCount').textContent));
  await page.keyboard.press('Escape');
  await page.waitForSelector('#ccDone');
  assert.match(await count(), new RegExp('^1 of ' + total));
  assert.match(await page.$eval('#ccDone', e => e.textContent), /Checked \(1\).*Aria Testwell/s);
  assert.doesNotMatch(await page.$eval('#ccTodo', e => e.textContent), /Aria Testwell/);
  // It's kept with the work.
  await closeBox(page);
  await settle(page);
  assert.equal(await page.evaluate(() => { const s = JSON.parse(localStorage.getItem(window.__gs.state().batch.id)); return Object.keys(s.share.checked).length; }), 2, 'both of her pages');
  // Back to the check: it starts at the first one not done, and her clicks on the rest finish it.
  await press(page, '#shareBtn');
  await page.waitForSelector('#dlgBox [data-check]');
  await page.click('#dlgBox [data-check]');
  await page.waitForFunction(() => /paper 2 of/.test(document.querySelector('#ccCount').textContent));
  for (let i = 1; i < total; i++) {
    await page.waitForFunction(i => new RegExp('paper ' + (i + 1) + ' of').test(document.querySelector('#ccCount').textContent) && document.querySelector('#ccBody canvas') && document.querySelector('#ccState').textContent === 'Not checked yet', {}, i);
    await new Promise(r => setTimeout(r, 400));
    await page.click('#dlgBox [data-next]');
    if (i < total - 1) await page.waitForFunction(i => new RegExp('paper ' + (i + 2) + ' of').test(document.querySelector('#ccCount').textContent), {}, i);
  }
  await page.waitForSelector('#ccDone');
  assert.match(await count(), new RegExp('✓ ' + total + ' of ' + total));
  assert.equal(await page.$('#ccTodo'), null);
  assert.equal(await page.$eval('#dlgBox [data-make]', e => e.textContent), 'Download ZIP for Claude');
  assert.match(await page.$eval('#dlgBox [data-make]', e => e.className), /primary/);
  // A cover she changes means that paper needs another look.
  await page.click('#ccDone [data-cc="0"]');
  await page.waitForSelector('#ccBody canvas');
  await page.waitForFunction(() => document.querySelector('#ccState').textContent === '✓ Checked');
  const c = await page.$('#ccBody canvas'), b = await c.boundingBox();
  await page.mouse.move(b.x + 30, b.y + 30); await page.mouse.down(); await page.mouse.move(b.x + 120, b.y + 70, { steps: 3 }); await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('#ccState').textContent === 'Not checked yet');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#ccTodo');
  assert.match(await page.$eval('#ccTodo', e => e.textContent), /Aria Testwell/);
  noErrors(page); await close();
});

test('covers: the list on the side ticks papers off, jumps to one, filters, and can untick one', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'Tide essay.zip');
  await page.evaluate(() => window.__gs.openShare());
  await page.waitForSelector('#dlgBox [data-check]');
  await page.waitForFunction(() => /^0 of [34] papers checked/.test(document.querySelector('#shCount').textContent));
  await page.click('#dlgBox [data-check]');
  await page.waitForSelector('#ccRows [data-ccgo]');
  const total = await page.evaluate(() => window.__gs.coverList().length);
  const rowsText = () => page.$$eval('#ccRows li', l => l.map(x => x.textContent));
  assert.equal((await rowsText()).length, total, 'every paper is listed');
  assert.equal(await page.$eval('#ccProg', e => e.textContent), '0 of ' + total + ' checked');
  assert.equal(await page.$eval('#ccRows [aria-current="true"]', e => e.dataset.ccgo), '0');
  // A click on a name opens that paper.
  await page.click('#ccRows [data-ccgo="2"]');
  await page.waitForFunction(() => /paper 3 of/.test(document.querySelector('#ccCount').textContent) && document.querySelector('#ccRows [aria-current="true"]').dataset.ccgo === '2');
  // Down and up go through the list.
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => /paper 2 of/.test(document.querySelector('#ccCount').textContent));
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => /paper 3 of/.test(document.querySelector('#ccCount').textContent));
  // Covers look right ticks it off in the list.
  await page.waitForFunction(() => document.querySelector('#ccBody canvas'));
  await new Promise(r => setTimeout(r, 400));
  await page.click('#dlgBox [data-next]');
  await page.waitForFunction(() => document.querySelector('#ccRows [data-ccgo="2"] .ccic').classList.contains('done'));
  assert.equal(await page.$eval('#ccProg', e => e.textContent), '1 of ' + total + ' checked');
  assert.match(await page.$eval('#ccRows [data-ccgo="2"]', e => e.textContent), /, checked/);
  // Not checked hides it; All brings it back.
  await page.click('#dlgBox [data-ccf="todo"]');
  assert.equal((await rowsText()).length, total - 1);
  assert.equal(await page.$('#ccRows [data-ccgo="2"]'), null);
  await page.click('#dlgBox [data-ccf="all"]');
  assert.equal((await rowsText()).length, total);
  // Typing a name narrows the list; Enter opens the first match; arrows in the box don't turn the paper.
  const who = await page.evaluate(() => window.__gs.state().batch.students.find(s => s.key.startsWith('Bram')).key);
  await page.click('#ccFind'); await page.keyboard.type('bram');
  const hits = await rowsText();
  assert.ok(hits.length >= 1 && hits.length < total && hits.every(t => /Bram/.test(t)), hits.join(' | '));
  const at = await page.$eval('#ccCount', e => e.textContent);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.$eval('#ccCount', e => e.textContent), at);
  await page.keyboard.press('Enter');
  await page.waitForFunction(w => document.querySelector('#ccTitle').textContent.startsWith(w), {}, who);
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#ccFind', e => e.value), '', 'Escape in the box clears it first');
  assert.equal((await rowsText()).length, total);
  // Mark not checked unticks a checked paper.
  await page.click('#ccRows [data-ccgo="2"]');
  await page.waitForFunction(() => document.querySelector('#ccState').textContent === '✓ Checked');
  await page.click('#ccUndo');
  await page.waitForFunction(() => document.querySelector('#ccState').textContent === 'Not checked yet');
  assert.equal(await page.$eval('#ccProg', e => e.textContent), '0 of ' + total + ' checked');
  assert.equal(await page.$eval('#ccUndo', e => e.hidden), true);
  // A box she draws shows as a count on that paper's row.
  await page.waitForFunction(() => document.querySelector('#ccBody canvas'));
  const c = await page.$('#ccBody canvas'), b = await c.boundingBox();
  await page.mouse.move(b.x + 30, b.y + 30); await page.mouse.down(); await page.mouse.move(b.x + 120, b.y + 70, { steps: 3 }); await page.mouse.up();
  await page.waitForFunction(() => /1 box/.test(document.querySelector('#ccRows [data-ccgo="2"]').textContent));
  // Ctrl+Z takes it back.
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  await page.waitForFunction(() => !/box/.test(document.querySelector('#ccRows [data-ccgo="2"]').textContent));
  assert.equal(await page.evaluate(() => Object.values(window.__gs.state().batch.share.boxes).flat().length), 0);
  noErrors(page); await close();
});

test('covers: a click takes off a cover the name search got wrong, a click on its outline or Ctrl+Z puts it back, and the ZIP leaves it off', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'Tide essay.zip');
  await page.evaluate(() => window.__gs.openShare());
  await page.waitForSelector('#dlgBox [data-check]');
  await page.click('#dlgBox [data-check]');
  await page.waitForFunction(() => { const c = document.querySelector('#ccBody canvas'); return c && c._cover && c._cover.covers.some(q => !q.own); });
  const first = () => page.$eval('#ccBody canvas', c => { const q = c._cover.covers.find(q => !q.own), g = c._cover.gone[0], b = c.getBoundingClientRect(), k = c._cover.kk; return { auto: c._cover.covers.filter(q => !q.own).length, gone: c._cover.gone.length, at: q && [b.left + (q.x + q.w / 2) * k, b.top + (q.y + q.h / 2) * k], back: g && [b.left + (g.x + g.w / 2) * k, b.top + (g.y + g.h / 2) * k] }; });
  const was = await first();
  const offCount = () => page.evaluate(() => Object.values(window.__gs.state().batch.share.off || {}).flat().length);
  const redrawn = (auto, gone) => page.waitForFunction((a, g) => { const c = document.querySelector('#ccBody canvas'); return c && c._cover && c._cover.covers.filter(q => !q.own).length === a && c._cover.gone.length === g; }, {}, auto, gone);
  // A click on a black box that isn't a name takes it off, and no box of her own is drawn.
  await page.mouse.click(...was.at);
  await redrawn(was.auto - 1, 1);
  assert.equal(await offCount(), 1);
  assert.equal(await page.evaluate(() => Object.values(window.__gs.state().batch.share.boxes).flat().length), 0);
  assert.equal(await page.$eval('#ccState', e => e.textContent), 'Not checked yet');
  // Ctrl+Z puts it back.
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  await redrawn(was.auto, 0);
  assert.equal(await offCount(), 0);
  // Off again, then a click on its dashed outline puts it back.
  await page.mouse.click(...was.at);
  await redrawn(was.auto - 1, 1);
  const now = await first();
  await page.mouse.click(...now.back);
  await redrawn(was.auto, 0);
  assert.equal(await offCount(), 0);
  // Taken off, it stays off in the picture Claude gets.
  await page.mouse.click(...was.at);
  await redrawn(was.auto - 1, 1);
  const zipCovers = await page.evaluate(async () => {
    const G = window.__gs, { st, d } = G.coverList()[0], [path, p] = d.pages[0], f = st.files.find(x => x.path === path);
    const js = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise;
    const r = await G.sharePage(st, f, js, p, 1, G.coverRx(st)); js.destroy();
    return r.covers.filter(q => !q.own).length;
  });
  assert.equal(zipCovers, was.auto - 1);
  noErrors(page); await close();
});

test('a checked paper whose file changes is no longer checked, and old work with no checks opens fine', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'Tide essay.zip');
  const r = await page.evaluate(async () => {
    const G = window.__gs, l = G.coverList(), { st, d } = l[0];
    const before = G.coverOk(st, d);
    G.state().batch.share.checked = {};
    for (const [path, p] of d.pages) G.state().batch.share.checked[path + '|' + p] = st.files.find(f => f.path === path).data.length;
    const yes = G.coverOk(st, d);
    for (const [path, p] of d.pages) G.state().batch.share.checked[path + '|' + p] = 1;
    const changed = G.coverOk(st, d);
    delete G.state().batch.share.checked;
    return [before, yes, changed, G.coverOk(st, d)];
  });
  assert.deepEqual(r, [false, true, false, false]);
  noErrors(page); await close();
});

test('the check says Paper N during anonymous grading, and so does Bring back', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'Tide essay.zip');
  await page.evaluate(() => window.__gs.openShare());
  await page.waitForSelector('#dlgBox [data-close]');
  const codes = await page.evaluate(() => window.__gs.state().batch.share.codes);
  await closeBox(page);
  await page.evaluate(() => window.__gs.setAnon(true));
  await waitAnon(page);
  await page.evaluate(() => window.__gs.openShare());
  await page.waitForSelector('#ccTodo');
  const nameRx = /Aria|Testwell|Bram|Cleo|Fixture|Madeup/;
  assert.doesNotMatch(await page.$eval('#ccTodo', e => e.textContent), nameRx);
  await page.click('#dlgBox [data-check]');
  await page.waitForSelector('#ccBody canvas');
  assert.match(await page.$eval('#ccTitle', e => e.textContent), /^Paper \d → S-/);
  assert.doesNotMatch(await page.$eval('#ccRows', e => e.textContent), nameRx, 'the list on the side shows stand-ins too');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#dlgBox [data-shback]');
  await page.click('#dlgBox [data-shback]');
  await page.waitForSelector('#bbText');
  await page.type('#bbText', codes['Aria Testwell'] + '\nClear thesis.');
  await page.click('[data-read]');
  await page.waitForFunction(() => !document.querySelector('[data-apply]').disabled);
  assert.doesNotMatch(await page.$eval('#bbOut', e => e.textContent), nameRx);
  noErrors(page); await close();
});

test('the Claude steps: the message has no names, the ZIP is remembered, and a reply that leaves someone out says who', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'Tide essay.zip');
  await page.evaluate(() => { navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  const dl = await catchDownloads(page);
  await press(page, '#shareBtn');
  await page.waitForSelector('#shAsk');
  assert.equal(await page.$eval('#shAsk', e => e.value), await page.evaluate(() => window.__gs.SHARE_ASK));
  // She can change it. If a name slips in, what she copies has [name] in its place.
  await page.$eval('#shAsk', e => { e.value = 'Look closely at what Aria Testwell does with evidence.'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('[data-shcopy]');
  await page.waitForFunction(() => window.__copied);
  assert.equal(await page.evaluate(() => window.__copied), 'Look closely at what [name] [name] does with evidence.');
  assert.match(await page.evaluate(() => window.__gs.state().batch.share.ask), /Aria Testwell/, 'what she typed stays as she typed it, in her browser');
  // Opening Claude only opens a page: nothing goes with it.
  const opened = await page.evaluate(() => { const was = window.open, got = []; window.open = (...a) => { got.push(a); return null; }; document.querySelector('[data-shopen]').click(); window.open = was; return got; });
  assert.deepEqual(opened, [['https://claude.ai/new', '_blank', 'noopener']]);
  const got = await dl.next(() => page.click('#dlgBox [data-make]'));
  assert.ok(unzipSync(got.bytes)['README.txt']);
  await page.waitForFunction(() => /^Made .*not checked/.test(document.querySelector('#shMade').textContent));
  await dl.close();
  const { sent, codes } = await page.evaluate(() => window.__gs.state().batch.share);
  assert.ok(sent.length >= 3, 'it knows who went: ' + sent.length);
  await page.click('#dlgBox [data-shback]');
  await page.waitForSelector('#bbText');
  await page.type('#bbText', codes['Aria Testwell'] + '\n[name], your thesis is clear.');
  await page.click('[data-read]');
  await page.waitForSelector('#bbMiss');
  const miss = await page.$eval('#bbMiss', e => e.textContent);
  assert.match(miss, new RegExp('No feedback yet for ' + (sent.length - 1) + ' papers'));
  assert.match(miss, /Bram Sample/); assert.doesNotMatch(miss, /Aria/);
  assert.match(await page.$eval('#bbOut', e => e.textContent), new RegExp('1 of ' + sent.length + ' students matched'));
  assert.match(await page.$eval('#bbNm', e => e.textContent), /1 reply still says \[name\]/);
  await page.click('[data-bbmore]');
  await page.waitForFunction(() => /^Please continue/.test(window.__copied));
  const asked = await page.evaluate(() => window.__copied);
  assert.doesNotMatch(asked, /Bram|Cleo/); assert.match(asked, /S-[A-Z0-9]{4}/);
  await page.waitForFunction(() => !document.querySelector('[data-apply]').disabled);
  await page.click('[data-apply]');
  const comment = () => page.evaluate(() => window.__gs.state().batch.students[0].grade.comment);
  assert.match(await comment(), /your thesis is clear/);
  // The same reply twice doesn't double it.
  await page.evaluate(() => window.__gs.openBringBack());
  await page.waitForSelector('#bbText');
  await page.type('#bbText', codes['Aria Testwell'] + '\n[name], your thesis is clear.');
  await page.click('[data-read]');
  await page.waitForFunction(() => !document.querySelector('[data-apply]').disabled);
  await page.click('[data-apply]');
  assert.equal(((await comment()).match(/your thesis is clear/g) || []).length, 1);
  noErrors(page); await close();
});

test('a page turned after its covers were checked needs another look, and her box turns with the page in what Claude would get', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Nia Turnwell/Essay.pdf': await makePaper({ title: 'WRITTEN BY HAND HERE' }), 'Oren Turnwell/Essay.pdf': await makePaper({ title: 'Another essay' }) }), 'Turn.zip');
  await page.evaluate(() => window.__gs.openShare());
  await page.waitForSelector('#dlgBox [data-check]');
  await page.click('#dlgBox [data-check]');
  await page.waitForSelector('#ccBody canvas');
  const b = await (await page.$('#ccBody canvas')).boundingBox(), k = b.width / 612;
  await page.mouse.move(b.x + 50 * k, b.y + 50 * k); await page.mouse.down(); await page.mouse.move(b.x + 350 * k, b.y + 80 * k, { steps: 3 }); await page.mouse.up();
  const boxOf = () => page.evaluate(() => Object.values(window.__gs.state().batch.share.boxes).flat()[0]);
  await page.waitForFunction(() => Object.values(window.__gs.state().batch.share.boxes).flat().length === 1);
  // Covers look right, as soon as the redrawn paper lets her say so.
  await page.waitForFunction(() => { if (/paper 2 of/.test(document.querySelector('#ccCount').textContent)) return true; document.querySelector('#dlgBox [data-next]').click(); return false; }, { polling: 300 });
  await page.keyboard.press('Escape');
  await page.waitForSelector('#ccDone');
  const count = () => page.$eval('#shCount', e => e.textContent);
  assert.match(await count(), /^1 of 2/);
  const was = await boxOf();
  await closeBox(page);
  await page.evaluate(() => document.querySelector('[data-rotdoc]').click());
  await page.waitForFunction(() => window.__gs.state().batch.students[0].files[0].rot[0] === 90);
  await page.evaluate(() => window.__gs.openShare());
  await page.waitForSelector('#ccTodo');
  assert.match(await count(), /^0 of 2/);
  assert.equal(await page.$('#ccDone'), null);
  const near = (a, e) => a.forEach((v, i) => assert.ok(Math.abs(v - e[i]) < 0.0003, a + ' against ' + e));
  near(await boxOf(), [1 - was[1] - was[3], was[0], was[3], was[2]]);
  // The check draws with the same sharePage the ZIP does: black where the words are now, nothing left at the old spot.
  await page.click('#dlgBox [data-check]');
  await page.waitForFunction(() => { const c = document.querySelector('#ccBody canvas'); return c && c.width > c.height; });
  const px = (x, y) => page.$eval('#ccBody canvas', (c, x, y) => { const s = c.width / 792; return [...c.getContext('2d').getImageData(x * s, y * s, 1, 1).data].slice(0, 3); }, x, y);
  assert.ok((await px(792 - 65, 200)).every(v => v < 40), 'the box is over the words');
  assert.ok((await px(200, 65)).every(v => v > 200), 'and gone from where they were');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#ccTodo');
  await closeBox(page);
  // Undo turns the box back too. She still looks again.
  await page.evaluate(() => window.__gs.undo());
  await page.waitForFunction(() => !window.__gs.state().batch.students[0].files[0].rot[0]);
  near(await boxOf(), was);
  await page.evaluate(() => window.__gs.openShare());
  await page.waitForSelector('#ccTodo');
  assert.match(await count(), /^0 of 2/);
  noErrors(page); await close();
});

test('a score read off the paper counts as past work, after her own score and the Grade sheet', async () => {
  const { page, close } = await openApp(browser);
  const past = gr => page.evaluate((su, gr) => window.__gs.pastScore(su, { rubric: [], points: '', ...gr }), SETUP, gr);
  const read = { score: 9.5, outOf: 12, pct: 88 };
  let s = await past({ read });
  assert.deepEqual([s.total, s.max, s.pct, s.paper], [9.5, 12, 88, true], 'the percent typed on the paper stands');
  s = await past({ read: { score: 9, outOf: null, pct: null } });
  assert.deepEqual([s.total, s.max, s.pct], [9, 12, 86], 'no out-of or percent: by that download’s rubric and scale');
  s = await past({ read: { score: 10, outOf: 15, pct: null } });
  assert.deepEqual([s.total, s.max, s.pct], [10, 15, 67], 'a 10/15 is out of 15');
  s = await past({ read: { score: null, outOf: null, pct: 90 } });
  assert.deepEqual([s.total, s.pct], [null, 90], 'only a percent on the paper');
  s = await past({ read, rubric: [3, 3, 3] });
  assert.deepEqual([s.total, s.pct, s.paper], [9, 86, false], 'her own score wins');
  assert.equal((await past({ read, sheet: '11' })).total, 11, 'then the Grade sheet');
  assert.equal((await past({ read, status: 'missing' })).total, null, 'missing has no score');
  s = await past({ comment: 'From before this was kept' });
  assert.deepEqual([s.total, s.pct, s.paper], [null, null, false], 'old work simply doesn’t have one');
  await close();
});

// Her grade as a Kami text box on the paper.
const withNote = async (word, text) => {
  const doc = await PDFDocument.load(await makePaper({ title: 'Essay ' + word })), ctx = doc.context;
  if (text) doc.getPage(0).node.set(PDFName.of('Annots'), ctx.obj([ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'FreeText', Rect: [60, 300, 300, 360], DA: PDFString.of('/Helv 12 Tf 0 g'), F: 4, Contents: PDFHexString.fromText(text) }))]));
  return doc.save();
};
test('a class graded on the paper: its scores are saved with nothing else done, and show in Past work', async () => {
  const lib = { classes: [{ id: 'c1', name: '12EL-1', names: NAMES, units: [] }], loose: { id: '', name: '', names: [], units: [] }, seed2627: true };
  const old = { t: Date.UTC(2026, 7, 20), cls: 'c1', setup: SETUP, s: { 'Dov Madeup': g([], 'ONLY-A-COMMENT') } };
  const seed = { ls: { 'gs.lib': JSON.stringify(lib), 'gs.b.old1': JSON.stringify(old) }, idb: { 'grading-studio-keep': { version: 2, stores: { papers: [], work: [], edits: [], meta: [['gs.b.old1', { id: 'gs.b.old1', name: 'Old quiz', n: 4, t: old.t }]] } } } };
  const { page, close } = await openApp(browser, { seed });
  const zipWith = async (word, notes = {}) => { const o = {}; for (const n of NAMES) o[n + '/Essay.pdf'] = await withNote(word, notes[n]); return zipOf(o); };
  const closeIt = async () => { await page.evaluate(() => document.querySelector('#closeBtn').click()); await page.waitForFunction(() => !document.querySelector('#start').hidden); };
  await openZip(page, await zipWith('one', { 'Aria Testwell': '9.5/12 = 88%', 'Bram Sample': '9/12 = 86%' }), 'River essay.zip');
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await page.waitForFunction(id => { const d = JSON.parse(localStorage.getItem(id) || 'null'); return d && d.read && d.read['Bram Sample']; }, { timeout: 30000 }, id);
  const saved = await page.evaluate(id => JSON.parse(localStorage.getItem(id)), id);
  assert.deepEqual(saved.read['Aria Testwell'], { score: 9.5, outOf: 12, pct: 88 });
  assert.deepEqual(Object.keys(saved.read).sort(), ['Aria Testwell', 'Bram Sample'], 'only papers with a grade on them');
  assert.deepEqual(saved.s, {}, 'and no student looks started because of it');
  // A student the scan hasn't reached keeps what was saved. Once read and found to have none, it goes.
  const reads = await page.evaluate(() => { const G = window.__gs, st = G.state().batch.students[0], was = st.found; delete st.found; const a = G.paperReads(); st.found = null; const b = G.paperReads(); st.found = was; return [!!a['Aria Testwell'], !!(b && b['Aria Testwell'])]; });
  assert.deepEqual(reads, [true, false]);
  await closeIt();
  await openZip(page, await zipWith('two'), 'Tide essay.zip');
  await waitHist(page); await openHist(page);
  const a = await histText(page);
  assert.match(a, /River essay/); assert.match(a, /9\.5 \/ 12 · 88%/); assert.match(a, /on the paper/);
  assert.match(await page.$eval('#histBox summary', e => e.textContent), /1 earlier · last 88%/);
  await goToStudent(page, 1); await waitHist(page);
  assert.match(await histText(page), /9 \/ 12 · 86%/);
  // Older work with only a comment doesn't claim the paper had no grade.
  await goToStudent(page, 3); await waitHist(page);
  const d = await histText(page);
  assert.match(d, /ONLY-A-COMMENT/); assert.match(d, /No score in the app\. The paper may have one\./);
  noErrors(page);
  await closeIt();
  await page.evaluate(id => window.__gs.reopenKept(id), id);
  await page.waitForFunction(id => { const b = window.__gs.state().batch; return b && b.id === id; }, {}, id);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.read['Aria Testwell'].score), 9.5, 'it comes back on reopening');
  await close();
});

/* ---------------- fixes from the review of the merged app ---------------- */
const seedPast = (past, meta) => ({
  ls: { 'gs.lib': JSON.stringify({ classes: [{ id: 'c1', name: '12EL-1', names: NAMES, units: [] }], loose: { id: '', name: '', names: [], units: [] }, seed2627: true }), ...Object.fromEntries(Object.entries(past).map(([k, v]) => [k, JSON.stringify(v)])) },
  idb: { 'grading-studio-keep': { version: 2, stores: { papers: [], work: [], edits: [], meta } } },
});
const metaRec = (id, name) => [id, { id, name, n: 4, t: Date.UTC(2026, 8, 21) }];

test('Past work goes by when the work was done: just opening an old download doesn’t make it the last one, and dates show the year', async () => {
  const T1 = Date.UTC(2026, 7, 1), T2 = Date.UTC(2026, 8, 1), NOW = Date.UTC(2026, 9, 20);
  const seed = seedPast({
    'gs.b.river': { t: NOW, cls: 'c1', setup: SETUP, s: { 'Aria Testwell': g([1, 1, 1], '', { at: T1 }) } },   // scored first, then opened again just to look
    'gs.b.lake': { t: T2, cls: 'c1', setup: SETUP, s: { 'Aria Testwell': g([4, 4, 4], '', { at: T2 }) } },
  }, [metaRec('gs.b.river', 'River'), metaRec('gs.b.lake', 'Lake')]);
  const { page, close } = await openApp(browser, { seed });
  await openZip(page, zipOf(files), 'Tide essay.zip');
  await waitHist(page); await openHist(page);
  assert.match(await page.$eval('#histBox summary', e => e.textContent), /2 earlier · last 100%/);
  const t = await histText(page);
  assert.ok(t.indexOf('Lake') < t.indexOf('River'), 'Lake, done later, comes first: ' + t);
  assert.match(t, /2026/, 'the row has its year');
  noErrors(page);
  await close();
});

test('a download she forgets is gone from Past work the next time she opens something', async () => {
  const seed = seedPast({ 'gs.b.river': { t: Date.UTC(2026, 8, 1), cls: 'c1', setup: SETUP, s: { 'Aria Testwell': g([1, 1, 1], 'RIVERCOMMENT') } } }, [metaRec('gs.b.river', 'River')]);
  const { page, close } = await openApp(browser, { seed });
  const z = zipOf(files);
  await openZip(page, z, 'Tide essay.zip');
  await waitHist(page); await openHist(page);
  assert.match(await histText(page), /RIVERCOMMENT/);
  await settle(page);
  await page.evaluate(() => document.querySelector('#closeBtn').click());
  await page.waitForFunction(() => !document.querySelector('#start').hidden);
  await page.evaluate(() => window.__gs.forgetKept('gs.b.river'));
  await page.waitForFunction(() => !localStorage.getItem('gs.b.river'));
  await openZip(page, z, 'Tide essay.zip');
  await new Promise(r => setTimeout(r, 400));
  assert.doesNotMatch(await histText(page), /RIVERCOMMENT|River/);
  noErrors(page);
  await close();
});

test('a copy of this same assignment with only the paper’s grades on it isn’t past work', async () => {
  const lib = { classes: [{ id: 'c1', name: '12EL-1', names: NAMES, units: [] }], loose: { id: '', name: '', names: [], units: [] }, seed2627: true };
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(lib) } } });
  const zipWith = async (word, notes = {}) => { const o = {}; for (const n of NAMES) o[n + '/Essay.pdf'] = await withNote(word, notes[n]); return zipOf(o); };
  await openZip(page, await zipWith('one', { 'Aria Testwell': '9.5/12 = 88%' }), 'River essay.zip');
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await page.waitForFunction(id => { const d = JSON.parse(localStorage.getItem(id) || 'null'); return d && d.read && d.read['Aria Testwell']; }, { timeout: 30000 }, id);
  await page.evaluate(() => document.querySelector('#closeBtn').click());
  await page.waitForFunction(() => !document.querySelector('#start').hidden);
  await openZip(page, await zipWith('two', { 'Aria Testwell': '9.5/12 = 88%', 'Bram Sample': '8/12 = 82%' }), 'River essay.zip');
  await new Promise(r => setTimeout(r, 500));
  assert.doesNotMatch(await histText(page), /River essay|on the paper/, 'not listed');
  noErrors(page);
  await close();
});

test('the consistency check: a comment doesn’t move a points score, the gap isn’t overstated, and a quick run says why it has no times', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'Tide essay.zip');
  // Points: type in the real comment box. The score keeps the time it had, even one saved before scores had their own time.
  const T = Date.now() - 3600000;
  await page.evaluate(T => {
    const s = window.__gs.state(); s.setup.mode = 'points'; s.setup.outOf = 100;
    s.batch.students.forEach((st, i) => { st.grade.points = String(50 + i); st.grade.at = T + i * 60000; });
    window.__gs.openStudent(0);
  }, T);
  await page.waitForSelector('#cmtIn');
  await page.focus('#cmtIn'); await page.keyboard.type('x');
  const times = await page.evaluate(() => window.__gs.consData().pts.map(p => [p.i, p.t]));
  assert.deepEqual(times.find(x => x[0] === 0), [0, T], 'her comment left the score’s time alone');
  assert.equal(times[0][0], 0, 'and the paper is still first');
  // The gap in words is near the true gap.
  const say = (v, max) => page.evaluate((v, max) => { const G = window.__gs; return G.driftSay(G.driftRead(v, max), max); }, v, max);
  const s = await say([...Array(12).fill(78), ...Array(12).fill(72)], 100);
  assert.match(s, /by about 6 points/, s);
  // Nothing with a usable time: it doesn't claim the papers have no time at all.
  assert.match(await say([], 12), /No papers have a time to go by so far/);
  noErrors(page);
  await close();
});

test('the same score means out of the same total, and papers with no rubric rows show none', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'Tide essay.zip');
  await page.evaluate(() => {
    const [a, b, c] = window.__gs.state().batch.students;
    for (const st of [a, c]) st.found = { found: true, score: 10, outOf: 15, pct: 67 };
    b.grade.rubric = [3.5, 3.5, 3];
  });
  const keys = await page.evaluate(() => [...window.__gs.consData().groups].map(([k, l]) => [k, l.length]));
  assert.deepEqual(keys.sort((x, y) => String(x[0]).localeCompare(String(y[0]))), [[10, 1], ['10/15', 2]]);
  await page.evaluate(() => window.__gs.openCons());
  await page.waitForSelector('#consBox [data-same]');
  assert.match(await page.$eval('#consBox [data-same]', e => e.textContent), /10 \/ 15.*2 papers/);
  await page.click('#consBox [data-same]');
  await page.waitForSelector('#sbsBody');
  assert.match(await page.$eval('#dlgBox h2', e => e.textContent), /Papers scored 10 \/ 15/);
  assert.equal(await page.$$eval('#sbsBody .sbsh .hsm', l => l.filter(e => /Criterion/.test(e.textContent)).length), 0, 'no empty rubric rows');
  noErrors(page);
  await close();
});
