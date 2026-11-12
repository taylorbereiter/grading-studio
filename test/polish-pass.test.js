// The first polish fixes: notes that don't land on each other or turn up where they mean nothing, a Next button that
// stays where it is, and Find anything answering to the plain words a teacher types. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, appReady, openZip, goToStudent, score, settle, waitPaper, markPage, goTo, workOf, answerDlg } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');
const { gradingSeed } = require('./helpers/steady');

let browser, files;
before(async () => { browser = await launch(); files = await standardFiles(); });
after(async () => { await browser.close(); });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const toast = page => page.$eval('.toast', t => t.hidden ? '' : t.textContent);
const barUp = page => page.$eval('#openRep', b => !b.hidden);

test('Next stays where it is from a student with a paper to one with nothing turned in', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  await openZip(page, zipOf(files), 'River essay.zip');
  const kinds = await page.evaluate(() => window.__gs.state().batch.students.map(s => s.files.length > 0));
  const withPaper = kinds.indexOf(true), without = kinds.indexOf(false);
  assert.ok(withPaper >= 0 && without >= 0, 'the made-up class has both kinds of student');
  const top = () => page.$eval('#nextUn, #nextBtn', b => Math.round(b.getBoundingClientRect().top));
  await goToStudent(page, withPaper); const a = await top();
  assert.ok(await page.$('#oneOutBtn'), 'a student with a paper has the export link');
  await goToStudent(page, without); const b = await top();
  assert.equal(await page.$('#oneOutBtn'), null, 'a student with nothing has no export link');
  assert.equal(b, a, 'the Next button did not move');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the note on what opened leaves once she moves to another student, when every file opened', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  await openZip(page, zipOf(files), 'River essay.zip');
  await page.waitForFunction(() => !document.querySelector('#openRep').hidden, { timeout: 30000 });
  assert.match(await page.$eval('#openRep', b => b.textContent), /6 of 6 files opened/);
  await goToStudent(page, 0);
  assert.equal(await barUp(page), true, 'opening the same student again leaves it up');
  await goToStudent(page, 1);
  assert.equal(await barUp(page), false, 'it has gone with the move to the next student');
  await page.reloadHere(); await appReady(page); await waitPaper(page); await settle(page); await sleep(600);
  assert.equal(await barUp(page), false, 'and it counts as seen: it does not come back');
  await close();
});

test('“Picked up where you left off” is said on the assignment’s own screen, once, and nowhere else', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'River essay.zip');
  await score(page, [3, 3, 3]); await settle(page);
  const id = await page.evaluate(() => window.__gs.state().batch.id.replace(/^gs\.b\./, ''));
  await page.evaluate(() => window.__gs.go('#/')); await page.waitForFunction(() => location.hash === '#/' && !document.querySelector('#vHome, #home, [data-view="home"]')?.hidden); await sleep(300);
  await page.reloadHere(); await appReady(page); await sleep(1200);
  assert.equal(await toast(page), '', 'nothing is said on Today, where the assignment is at most open behind the page');
  await page.evaluate(id => window.__gs.go('#/a/' + id), id); await waitPaper(page);
  await page.waitForFunction(() => /Picked up where you left off \(1 student started\)/.test(document.querySelector('.toast').textContent), { timeout: 5000 });
  await page.reloadHere(); await appReady(page); await waitPaper(page); await sleep(900);
  assert.equal(await toast(page), '', 'and not a second time in the same visit');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Find anything answers to the plain word for a thing, not only its name', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'River essay.zip');
  const first = q => page.evaluate(q => { const G = window.__gs; return G.findMatch(G.findRows(), q).filter(r => r.group !== 'Help').map(r => r.label)[0]; }, q);
  assert.equal(await first('export'), 'Return marked files');
  assert.equal(await first('hand back'), 'Return marked files');
  assert.equal(await first('backup'), 'Where my work is saved');
  assert.equal(await first('shortcuts'), 'All keys');
  assert.equal(await first('csv'), 'Grades');
  assert.equal(await first('undo'), 'Go back in time');
  const top = await page.evaluate(() => { const G = window.__gs; return G.findMatch(G.findRows(), 'export')[0].label; });
  assert.equal(top, 'Return marked files', 'the thing itself comes before the Help answers about it');
  await close();
});

const rubricNow = page => page.evaluate(() => { const s = window.__gs.state(), g = s.batch.students[s.cur].grade; return { cur: s.cur, rubric: g.rubric.slice(), status: g.status || '' }; });
const body = page => page.evaluate(() => document.activeElement && document.activeElement.blur());

test('Ctrl Z takes back a score as it takes back a mark: number keys, the half, a status, and Redo', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'River essay.zip');
  await body(page);
  await page.keyboard.press('3'); await page.keyboard.press('.'); await page.keyboard.press('2');
  assert.deepEqual((await rubricNow(page)).rubric, [3.5, 2]);
  const z = async (redo) => { await page.keyboard.down('Control'); if (redo) await page.keyboard.down('Shift'); await page.keyboard.press('z'); if (redo) await page.keyboard.up('Shift'); await page.keyboard.up('Control'); await sleep(80); };
  await z(); assert.deepEqual((await rubricNow(page)).rubric, [3.5], 'the second row’s score is gone');
  await z(); assert.deepEqual((await rubricNow(page)).rubric, [3], 'then the half');
  await z(); assert.deepEqual((await rubricNow(page)).rubric, [], 'then the first row');
  assert.match(await page.$eval('#grade .total', e => e.textContent), /–|—/, 'and the panel shows no score');
  await z(true); assert.deepEqual((await rubricNow(page)).rubric, [3], 'Redo puts it back');
  await page.click('[data-status="late"]'); assert.equal((await rubricNow(page)).status, 'late');
  await body(page); await z(); assert.equal((await rubricNow(page)).status, '', 'a status is a step too');
  assert.equal(await page.$eval('#undoBtn', b => b.disabled), false, 'the Undo button is lit while a score can be taken back');
  // what is saved is what she sees
  await settle(page);
  const kept = await workOf(page);
  assert.deepEqual(Object.values(kept).map(s => s.grade.rubric).find(r => r && r.length), [3]);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a drag along a slider is one step, and undo goes back to the student whose score it was', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'River essay.zip');
  const box = await (await page.$('.scores[data-c="1"] .srange')).boundingBox(), y = box.y + box.height / 2;
  await page.mouse.move(box.x + 4, y); await page.mouse.down();
  for (let x = 10; x < box.width - 4; x += 20) await page.mouse.move(box.x + x, y);
  await page.mouse.up(); await sleep(200);
  assert.equal((await rubricNow(page)).rubric[1], 4, 'dragged to the top');
  await goToStudent(page, 1); await body(page);
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  await page.waitForFunction(() => window.__gs.state().cur === 0);
  assert.equal((await rubricNow(page)).rubric[1] == null, true, 'the whole drag came off in one step, on the student it belonged to');
  await close();
});

test('a mark and a score undo in the order they were made', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'River essay.zip');
  await markPage(page, 0);
  const marks = () => page.evaluate(() => { const s = window.__gs.state(); return s.batch.students[0].files.reduce((n, f) => n + Object.values(f.marks || {}).reduce((m, a) => m + a.length, 0), 0); });
  const n = await marks(); assert.ok(n > 0);
  await page.evaluate(() => window.__gs.setTool('select')); await body(page);
  await page.keyboard.press('4');
  assert.deepEqual((await rubricNow(page)).rubric, [4]);
  const z = async () => { await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await sleep(80); };
  await z(); assert.deepEqual((await rubricNow(page)).rubric, [], 'the score first');
  assert.equal(await marks(), n, 'the marks are untouched');
  await z(); assert.ok(await marks() < n, 'then the last mark');
  await close();
});

test('deleting a unit, an assignment or a class shows Undo, and Undo puts it back where it was', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  await goTo(page, '#/class/c1');
  const lib = () => page.evaluate(() => { const l = window.__gs.state().lib; return { classes: l.classes.map(c => c.name), units: l.classes.map(c => c.units.map(u => u.name + ':' + u.items.length)), loose: l.loose.units.length }; });
  const was = await lib();
  await page.waitForSelector('[data-udel]');
  await page.$eval('[data-udel]', b => b.click());
  assert.notEqual(was.units[0][0].split(':')[1], '0', 'the first unit has assignments, so the delete asks first');
  await answerDlg(page);
  await page.waitForFunction(() => /^Deleted “/.test(document.querySelector('.toast').textContent));
  assert.equal((await lib()).units[0].length, was.units[0].length - 1, 'the unit has gone');
  await page.$eval('.toast .tact', b => b.click());
  assert.deepEqual(await lib(), was, 'and is back, first in the class as before, with its assignments');
  // a class: its units go to No class, and come back out of it
  await page.$eval('[data-edit-class]', b => b.click());
  await page.waitForSelector('#dlgBox [data-del]'); await page.$eval('#dlgBox [data-del]', b => b.click());
  await answerDlg(page);
  await page.waitForFunction(() => /^Deleted the /.test(document.querySelector('.toast').textContent));
  const gone = await lib();
  assert.equal(gone.classes.length, was.classes.length - 1); assert.ok(gone.loose > was.loose, 'its units wait under No class');
  await page.$eval('.toast .tact', b => b.click());
  assert.deepEqual(await lib(), was, 'the class is back in its place and No class is as it was');
  assert.deepEqual(page.errors, []);
  await close();
});
