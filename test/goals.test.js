// Learning goals: the teacher's own list, tags on rubric rows, quiz questions and a whole score, and a class and a student seen
// by goal. Optional: with no goals there is nothing extra on any screen. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goTo, classPage, settle } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => {
  browser = await launch();
  zip = zipOf({
    'Ann Example/Quiz scan.pdf': await makePaper({ title: 'Ann Example quiz', pages: 1 }),
    'Ben Specimen/Quiz scan.pdf': await makePaper({ title: 'Ben Specimen quiz', pages: 1 }),
  });
});
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'];
const GOALS = [{ id: 'g1', name: 'Makes a clear claim', at: 1 }, { id: 'g2', name: 'Uses evidence', at: 1 }, { id: 'g3', name: 'Explains reasoning', at: 1 }, { id: 'g4', name: 'Not used yet', at: 1 }];
const day = s => Date.parse(s + 'T12:00:00Z');
// An essay scored on three rubric rows (two tagged), a quiz of three questions (two tagged) and an exit ticket whose whole score
// is one goal. No grading scale, so a row at 3 of 4 is 75%. Cleo's quiz is missing, Dov's essay is left out of the average.
function seed(goals = GOALS) {
  const item = (id, name, more) => ({ id, name, classId: 'c1', ...more });
  const work = (t, setup, more, rows) => ({ t: day(t), cls: 'c1', setup, ...more, s: Object.fromEntries(NAMES.map((n, i) => [n, { f: {}, h: {}, g: { rubric: [], points: '', comment: '', ...rows[i] } }]).filter(x => x[1].g.skip !== true)) });
  const lib = {
    classes: [{ id: 'c1', name: 'Grade 9 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [
      item('i1', 'Argument essay', { type: 'sum', due: '2026-09-19', batchId: 'gs.b.n1' }),
      item('i2', 'Evidence quiz', { type: 'ic', due: '2026-09-30', batchId: 'gs.b.n2' }),
      item('i3', 'Exit ticket', { type: 'ic', due: '2026-10-05', batchId: 'gs.b.n3' }),
    ] }] }],
    loose: { id: '', units: [] }, seed2627: true,
    book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2027-07-31' }] },
  };
  if (goals) lib.goals = goals;
  const q = (id, pts, goal) => ({ id, lab: '', n: 0, x: .1, y: .1, w: .5, h: .1, pts, how: 'x', ...(goal ? { goal } : {}) });
  const all = {
    'gs.b.n1': work('2026-09-20', { mode: 'rubric', criteria: ['Claim', 'Evidence', 'Writing'], goals: ['g1', 'g2', null], scale: null }, {},
      [{ rubric: [4, 2, 3] }, { rubric: [2, 2, 2] }, { rubric: [3, 4, 4] }, { rubric: [1, 1, 1], outAvg: true }]),
    'gs.b.n2': work('2026-10-01', { mode: 'points', criteria: ['Criterion 1'], outOf: 6, scale: null }, { quiz: { qs: [q('q1', 2, 'g1'), q('q2', 1, 'g2'), q('q3', 3)], how: 'x', side: 'left', total: null, shift: {} } },
      [{ points: 6, q: { q1: 2, q2: 1, q3: 3 } }, { points: 3, q: { q1: 1, q2: 0, q3: 2 } }, { status: 'missing' }, { points: 4, q: { q1: 2, q2: 1, q3: 1 } }]),
    'gs.b.n3': work('2026-10-06', { mode: 'points', criteria: ['Criterion 1'], outOf: 10, scale: null }, { goal: 'g3' },
      [{ points: 9 }, { points: 5 }, { points: 8 }, { skip: true }]),
  };
  const ls = { 'gs.lib': JSON.stringify(lib) };
  for (const [k, v] of Object.entries(all)) ls[k] = JSON.stringify(v);
  const asg = { 'gs.b.n1': 'i1', 'gs.b.n2': 'i2', 'gs.b.n3': 'i3' };
  const meta = Object.keys(all).map(id => [id, { id, name: 'A download', n: 4, t: all[id].t, asg: asg[id] }]);
  return { ls, idb: { 'grading-studio-keep': { version: 2, stores: { papers: [], work: [], edits: [], meta } } } };
}
const tabs = page => page.$$eval('.ctabs .ctab', xs => xs.map(x => x.textContent));
const libOf = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().lib)));
const openSetup = async page => { await page.evaluate(() => window.__gs.openSetup()); await page.waitForSelector('#setupBody'); await page.waitForFunction(() => !window.__gs.bankBusy()); };
const saveSetup = async page => { await page.click('#dlgBox [data-save]'); await page.waitForFunction(() => document.querySelector('#dlg').hidden); };
const pickGoal = (page, sel, v) => page.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
// Her list's box: type each name on its own line, then Done.
async function typeGoals(page, names) {
  await page.waitForSelector('#askDlg #goalRows');
  for (const [i, n] of names.entries()) { await page.keyboard.type(n); if (i < names.length - 1) await page.keyboard.press('Enter'); }
  await page.click('#askDlg [data-ok]');
  await page.waitForFunction(() => !document.querySelector('#askDlg'));
}

test('with no goals nothing extra shows: no Goals tab, no pickers, nothing stored', async () => {
  const { page, close } = await openApp(browser, { seed: seed(null) });
  await classPage(page, 'c1');
  assert.deepEqual(await tabs(page), ['Assignments', 'Gradebook', 'Students', 'Attendance', 'Missing work', 'Charts', 'Report comments']);
  await page.click('[data-ctab="students"]'); await page.waitForSelector('#peopleTbl table');
  await goTo(page, '#/class/c1/students/1'); await page.waitForSelector('#bkStuTiles');
  assert.equal(await page.$('#glStu'), null, 'a student’s page has no goals part');
  const lib = await libOf(page);
  assert.equal(lib.goals, undefined); assert.equal(lib.goalsGone, undefined);
  await goTo(page, '#/settings/grading'); await page.waitForSelector('.goalset');
  assert.equal(await page.$eval('.goalset [data-goalsedit]', b => b.textContent), 'Add goals');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the Goals tab: what to reteach lowest first, every student by every goal, and where the scores came from', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await classPage(page, 'c1');
  assert.deepEqual(await tabs(page), ['Assignments', 'Gradebook', 'Students', 'Attendance', 'Missing work', 'Charts', 'Goals', 'Report comments']);
  await page.click('[data-ctab="goals"]'); await page.waitForSelector('#glBars');
  assert.equal(await page.evaluate(() => location.hash), '#/class/c1/goals');
  // Claim: Aria 100 and 100, Bram 50 and 50, Cleo 75 (her quiz is missing), Dov 100 from the quiz alone (his essay is left out).
  // Evidence: Aria 50 and 100, Bram 50 and 0, Cleo 100, Dov 100. Reasoning is the exit ticket: 90, 50, 80.
  const bars = await page.$$eval('#glBars .glbar', xs => xs.map(x => ({ name: x.querySelector('.gln span').textContent, pct: x.querySelector('b').textContent, sub: x.querySelector('small').textContent, lo: x.classList.contains('lo') })));
  assert.deepEqual(bars.map(b => b.name), ['Explains reasoning', 'Uses evidence', 'Makes a clear claim'], 'lowest first, and a goal with no scores is not listed');
  assert.deepEqual(bars.map(b => parseFloat(b.pct)), [73.33, 75, 81.25]);
  assert.deepEqual(bars.map(b => b.lo), [true, false, false]);
  assert.equal(bars[0].sub, '3 students · 1 under 70%');
  assert.equal(bars[2].sub, '4 students · 1 under 70%');
  const heat = await page.$$eval('#glHeat tbody tr', rs => rs.map(r => [...r.children].map(c => c.textContent)));
  assert.deepEqual(heat, [['Aria Testwell', '100', '75', '90'], ['Bram Sample', '50', '25', '50'], ['Cleo Fixture', '75', '100', '80'], ['Dov Madeup', '100', '100', ''], ['Class average', '81%', '75%', '73%']]);
  assert.match(await page.$eval('#glHeat tbody tr:nth-child(1) td:nth-child(2) .chc', c => c.dataset.tn), /Argument essay 100% \(4 of 4\) · Evidence quiz 100% \(2 of 2\)/);
  // sorting by a goal puts the highest first, then the lowest
  await page.click('#glHeat [data-glsort="g2"]');
  assert.deepEqual(await page.$$eval('#glHeat tbody tr:not(.chfoot) .chn', xs => xs.map(x => x.textContent)), ['Cleo Fixture', 'Dov Madeup', 'Aria Testwell', 'Bram Sample']);
  await page.click('#glHeat [data-glsort="g2"]');
  assert.equal(await page.$eval('#glHeat tbody tr .chn', x => x.textContent), 'Bram Sample');
  const from = await page.$$eval('#glFrom tbody tr', rs => rs.map(r => [...r.children].map(c => c.textContent.trim())));
  assert.deepEqual(from.map(r => r[0] + '|' + r[2] + '|' + r[3]), ['Makes a clear claim|Claim|3', '|Question 1|3', 'Uses evidence|Evidence|3', '|Question 2|3', 'Explains reasoning|The whole score|3']);
  assert.match(await page.$eval('#glFrom', d => d.textContent), /No scores here yet: Not used yet\./);
  // a student's own page
  await page.click('#glHeat tbody tr .chn a'); await page.waitForSelector('#glStu');
  const mine = await page.$$eval('#glStu .glstu', xs => xs.map(x => x.querySelector('span').textContent + ' ' + x.querySelector('b').textContent + ' ' + x.querySelector('small').textContent));
  assert.deepEqual(mine, ['Makes a clear claim 50% class 81.25%', 'Uses evidence 25% class 75.00%', 'Explains reasoning 50% class 73.33%']);
  // nothing here wrote anything
  const lib = await libOf(page);
  assert.deepEqual(lib.goals, GOALS);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a paper’s percent on a goal goes through the assignment’s own grading scale', async () => {
  const s = seed(), d = JSON.parse(s.ls['gs.b.n1']);
  d.setup.scale = { 12: 100, 9: 85, 6: 70, 3: 55, 0: 40 };
  s.ls['gs.b.n1'] = JSON.stringify(d);
  const { page, close } = await openApp(browser, { seed: s });
  await goTo(page, '#/class/c1/goals'); await page.waitForSelector('#glHeat');
  // Cleo has only the essay on Claim: a 3 on that row reads as 9 of 12 does, 85%.
  assert.equal(await page.$eval('#glHeat tbody tr:nth-child(3) td:nth-child(2)', c => c.textContent), '85');
  await close();
});

test('Rubric setup: one quiet link until there is a goal, then a picker on each row that is saved with the rubric', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'Essays.zip');
  await openSetup(page);
  assert.equal(await page.$('#setupBody .goalsel'), null, 'no pickers before there is a goal');
  await page.click('#setupBody [data-goalsedit]');
  await typeGoals(page, ['Makes a clear claim', 'Uses evidence']);
  assert.equal(await page.$$eval('#setupBody .critrow .goalsel', xs => xs.length), 3, 'each row has a picker now');
  const ids = (await libOf(page)).goals.map(g => g.id);
  assert.equal(ids.length, 2);
  await pickGoal(page, '.critrow .goalsel[data-gi="0"]', ids[0]);
  await pickGoal(page, '.critrow .goalsel[data-gi="2"]', ids[1]);
  // taking out the first row moves the other tag up with its row
  await page.click('#setupBody [data-rm="0"]');
  assert.deepEqual(await page.$$eval('#setupBody .critrow .goalsel', xs => xs.map(x => x.value)), ['', ids[1]]);
  await pickGoal(page, '.critrow .goalsel[data-gi="0"]', ids[0]);
  await saveSetup(page);
  await settle(page);
  assert.deepEqual(await page.evaluate(() => window.__gs.state().setup.goals), ids);
  // "New goal…" in a picker makes one and picks it
  await openSetup(page);
  await pickGoal(page, '.critrow .goalsel[data-gi="1"]', '+');
  await typeGoals(page, ['Explains reasoning']);
  const three = (await libOf(page)).goals;
  assert.deepEqual(three.map(g => g.name), ['Makes a clear claim', 'Uses evidence', 'Explains reasoning']);
  assert.equal(await page.$eval('.critrow .goalsel[data-gi="1"]', e => e.value), three[2].id);
  // leaving without saving asks, since a tag changed
  await page.keyboard.press('Escape');
  await page.waitForSelector('#askDlg #askText');
  await page.click('#askDlg [data-ok]');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  assert.deepEqual(await page.evaluate(() => window.__gs.state().setup.goals), ids, 'Cancel kept the saved tags');
  // an assignment scored with just a total carries one goal for the whole score, kept with this download only
  await openSetup(page);
  await page.click('#setupBody [data-m="points"]');
  await pickGoal(page, '#setupBody .goalsel[data-gall]', three[2].id);
  await saveSetup(page);
  await settle(page);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.goal), three[2].id);
  assert.equal(await page.evaluate(() => window.__gs.state().setup.goalAll), undefined, 'not part of the rubric, so the next assignment does not inherit it');
  // removing a goal: it leaves the list, is remembered as removed, and the picker says so
  await openSetup(page);
  await page.click('#setupBody [data-goalsedit]');
  await page.waitForSelector('#askDlg #goalRows');
  await page.click('#askDlg [data-gx="2"]');
  assert.equal(await page.$eval('#goalGoneSay', p => p.hidden), false);
  await page.click('#askDlg [data-ok]');
  await page.waitForFunction(() => !document.querySelector('#askDlg'));
  const lib = await libOf(page);
  assert.equal(lib.goals.length, 2); assert.ok(lib.goalsGone[three[2].id] > 0);
  assert.equal(await page.$eval('#setupBody .goalsel[data-gall] option:checked', o => o.textContent), 'A goal you removed');
  assert.deepEqual(page.errors, []);
  await close();
});

const pageBox = (page, n) => page.$eval('.qbpg[data-n="' + n + '"] canvas', c => { c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
async function dragOn(page, n, a, b) {
  await page.waitForSelector('.qbpg[data-n="' + n + '"] canvas');
  const r = await pageBox(page, n);
  await page.mouse.move(r.x + a[0] * r.w, r.y + a[1] * r.h); await page.mouse.down();
  await page.mouse.move(r.x + b[0] * r.w, r.y + b[1] * r.h, { steps: 6 }); await page.mouse.up();
}
test('Quiz boxes: each question can carry a goal, and marking it scores the goal', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'Quiz.zip');
  await page.evaluate(() => window.__gs.openQuizBoxes());
  await dragOn(page, 0, [0.1, 0.1], [0.6, 0.2]);
  await dragOn(page, 0, [0.1, 0.3], [0.6, 0.4]);
  assert.equal(await page.$('.qbt .goalsel'), null, 'no goal pickers before there is a goal');
  await page.click('#qbList [data-qgoals]');
  await typeGoals(page, ['Uses evidence']);
  await page.waitForSelector('.qbt .goalsel');
  const id = (await libOf(page)).goals[0].id;
  await pickGoal(page, '.qbt tbody tr.qgrow:nth-of-type(4) .goalsel', id);
  await page.click('#dlgBox [data-save]');
  await page.waitForSelector('#qmBody, .qmwrap, #dlgBox .qm', { timeout: 5000 }).catch(() => {});
  const quiz = await page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().batch.quiz)));
  assert.deepEqual(quiz.qs.map(q => q.goal), [undefined, id]);
  // Ann gets the second question right, Ben gets it wrong: 100% and 0% on the goal
  const cells = await page.evaluate(async () => {
    const g = window.__gs, b = g.state().batch, q = b.quiz.qs;
    await g.quizSet(b.students[0], q[0], 0); await g.quizSet(b.students[0], q[1], 1);
    await g.quizSet(b.students[1], q[0], 1); await g.quizSet(b.students[1], q[1], 0);
    const d = { setup: g.state().setup, quiz: b.quiz };
    return b.students.map(st => g.goalCell(d, st.grade, { status: '', pct: 50, total: 1, max: 2 }));
  });
  assert.equal(cells[0][id].pct, 100); assert.equal(cells[1][id].pct, 0);
  assert.deepEqual(cells[0][id].parts, ['Question 2']);
  assert.deepEqual(page.errors, []);
  await close();
});

test('two copies of her work: goals from both are kept, the later name wins, a removed one stays removed', () => {
  const M = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'merge.js'), 'utf8') + ';({ mergeLib })');
  const plain = v => JSON.parse(JSON.stringify(v));
  const a = { classes: [], goals: [{ id: 'g1', name: 'Claim', at: 5 }, { id: 'g2', name: 'Evidence', at: 5 }] };
  const b = { classes: [], goals: [{ id: 'g1', name: 'Makes a claim', at: 9 }, { id: 'g2', name: 'Evidence', at: 5 }, { id: 'g5', name: 'Cites sources', at: 2 }], goalsGone: { g2: 7 } };
  const m = M.mergeLib(a, b, { dev: 't', now: 20 });
  assert.deepEqual(plain(m.lib.goals), [{ id: 'g1', name: 'Makes a claim', at: 9 }, { id: 'g5', name: 'Cites sources', at: 2 }]);
  assert.deepEqual(plain(m.lib.goalsGone), { g2: 7 });
  assert.equal(m.toA, true, 'this copy takes the other’s changes in');
  const none = M.mergeLib({ classes: [] }, { classes: [] }, { dev: 't', now: 20 });
  assert.equal('goals' in none.lib || 'goalsGone' in none.lib, false, 'work with no goals gains nothing');
});

test('Settings lists the goals, and a renamed goal keeps its tags', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await goTo(page, '#/settings/grading'); await page.waitForSelector('#setGoals');
  assert.deepEqual(await page.$$eval('#setGoals .setrow b', xs => xs.map(x => x.textContent)), GOALS.map(g => g.name));
  await page.click('.goalset [data-goalsedit]');
  await page.waitForSelector('#askDlg #goalRows');
  await page.$eval('#askDlg [data-gn="3"]', (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, 'Writes with control');
  await page.click('#askDlg [data-ok]');
  await page.waitForFunction(() => !document.querySelector('#askDlg'));
  assert.equal(await page.$eval('#setGoals .setrow:nth-child(4) b', x => x.textContent), 'Writes with control');
  const g = (await libOf(page)).goals[3];
  assert.equal(g.id, 'g4', 'a renamed goal keeps its id, so its tags follow'); assert.ok(g.at > 1);
  assert.deepEqual(page.errors, []);
  await close();
});
