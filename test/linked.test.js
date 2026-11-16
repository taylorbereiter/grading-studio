// Linked classes: sections of one course on the same schedule. Linking offers a new assignment to all of them, lets an assignment be
// added to another later or joined to one made twice, sends a change to the copies when asked, and keeps rosters, papers and scores apart.
// Every class and student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, classPage, pick } = require('./helpers/app');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const lib = () => ({ classes: [
  { id: 'a', name: 'Test 12 A', names: ['Ada Moss', 'Ben Fry'], units: [{ id: 'ua', name: 'Unit 1', items: [{ id: 'a1', name: 'Essay', classId: 'a', type: 'sum', due: '2026-11-20' }, { id: 'a2', name: 'Quiz', classId: 'a', type: 'ic' }] }] },
  { id: 'b', name: 'Test 12 B', names: ['Cal Nye'], units: [{ id: 'ub', name: 'Unit 1', items: [{ id: 'b1', name: 'essay', classId: 'b', type: 'sum', due: '2026-11-21' }] }] },
  { id: 'c', name: 'Test 10', names: ['Dee Rao'], units: [] }], loose: { id: '', units: [] }, me: { sys: '', unit: '', ai: '', grade: { way: 'points' } } });
const seed = l => ({ ls: { 'gs.lib': JSON.stringify(l) } });
const L = page => page.evaluate(() => window.__gs.state().lib);
const shut = page => page.waitForFunction(() => document.querySelector('#dlg').hidden);

test('the Planner’s course is offered once; linking pre-ticks the other class and shows on the class page', async () => {
  const { page, close } = await openApp(browser, { seed: seed(lib()) });
  await classPage(page, 'a');
  assert.equal(await page.$('.lkoffer'), null, 'nothing is offered without a timetable');
  await page.evaluate(() => window.__gs.lkPlanSet([{ name: 'Test 12 A', course: 'English 12' }, { name: 'Test 12-B', course: 'english 12' }, { name: 'Test 10', course: 'English 10' }]));
  await page.waitForSelector('.lkoffer');
  assert.match(await page.$eval('.lkoffer', e => e.textContent), /Test 12 A, Test 12 B\./);
  await page.click('[data-lkno]');
  assert.equal((await L(page)).classes[0].course, '', 'No thanks is remembered');
  assert.equal(await page.$('.lkoffer'), null);
  await classPage(page, 'b');
  assert.equal(await page.$('.lkoffer'), null, 'the only other section said no, so B is not asked');
  // linked by hand from B's Class setup: the course comes from the Planner
  await pick(page, '[data-lkedit]'); await page.waitForSelector('#lkPick');
  assert.equal(await page.$eval('#lkCourse', e => e.value), 'english 12');
  await page.$eval('#lkCourse', e => { e.value = 'English 12'; });
  await page.click('#lkPick input[value="a"]'); await page.click('#dlgBox [data-ok]'); await shut(page);
  await page.waitForSelector('.lkchip');
  assert.deepEqual((await L(page)).classes.map(c => c.course), ['English 12', 'English 12', undefined]);
  assert.match(await page.$eval('.lkchip', e => e.textContent), /Linked with Test 12 A/);
  // a new assignment from B ticks A too; untick keeps it to B
  await page.click('[data-newasg="b"]'); await page.waitForSelector('#aClasses');
  assert.deepEqual(await page.$$eval('#aClasses input:checked', xs => xs.map(x => x.value)), ['a', 'b']);
  assert.ok(await page.$('.lkhint'));
  await page.type('#aName', 'Poem');
  await page.click('#dlgBox [data-ok]'); await shut(page);
  const made = (await L(page)).classes.flatMap(c => c.units.flatMap(u => u.items.filter(i => i.name === 'Poem').map(i => [c.id, i.group])));
  assert.equal(made.length, 2); assert.ok(made[0][1] && made[0][1] === made[1][1]);
  // Class setup, Linked classes: untick A
  await pick(page, '[data-lkedit]'); await page.waitForSelector('#lkPick');
  assert.equal(await page.$eval('#lkCourse', e => e.value), 'English 12');
  await page.click('#lkPick input[value="a"]'); await page.click('#dlgBox [data-ok]'); await shut(page);
  assert.deepEqual((await L(page)).classes.map(c => c.course), ['', '', undefined]);
  assert.equal(await page.$('.lkchip'), null);
  await close();
});

test('add to the other class, join a copy made twice, change both, unlink', async () => {
  const l = lib(); l.classes[0].course = l.classes[1].course = 'English 12';
  l.classes[0].units[0].items[1].setup = { mode: 'points', outOf: 10, criteria: ['Score'] };
  const { page, close } = await openApp(browser, { seed: seed(l) });
  await classPage(page, 'a');
  // the essay has a same-name card in B (different case): join it
  await pick(page, '[data-card="a1"] [data-lkjoin]');
  assert.deepEqual(await page.evaluate(() => window.__gs.lkTwins('a1')), ['b1']);
  await page.waitForSelector('[data-card="a1"] .lktw');
  // the quiz is only in A: add it to B, with its rubric, in B's unit of the same name
  await pick(page, '[data-card="a2"] [data-lkadd]');
  let s = await L(page);
  const q = s.classes[1].units[0].items.find(i => i.name === 'Quiz');
  assert.ok(q && q.classId === 'b' && q.type === 'ic' && q.setup.outOf === 10 && q.group === s.classes[0].units[0].items[1].group);
  assert.equal(q.batchId, undefined, 'no papers come with it');
  // edit the essay: only what changed goes to the copy, so B keeps its own due date
  await pick(page, '[data-card="a1"] [data-edit-asg]'); await page.waitForSelector('#aAlso');
  assert.ok(await page.$eval('#aAlso', e => e.checked), 'ticked to start with');
  await page.$eval('#aName', e => { e.value = ''; }); await page.type('#aName', 'Argument essay');
  await page.click('#dlgBox [data-ok]'); await shut(page);
  s = await L(page);
  const b1 = s.classes[1].units[0].items.find(i => i.id === 'b1');
  assert.deepEqual([b1.name, b1.due], ['Argument essay', '2026-11-21']);
  // unticked: only this class changes
  await pick(page, '[data-card="a1"] [data-edit-asg]'); await page.waitForSelector('#aAlso');
  await page.click('#aAlso'); await page.$eval('#aDue', e => { e.value = '2026-12-01'; });
  await page.click('#dlgBox [data-ok]'); await shut(page);
  s = await L(page);
  assert.deepEqual([s.classes[0].units[0].items[0].due, s.classes[1].units[0].items.find(i => i.id === 'b1').due], ['2026-12-01', '2026-11-21']);
  // unlink: with one copy left, neither keeps the group
  await pick(page, '[data-card="a1"] [data-lkoff]');
  s = await L(page);
  assert.equal(s.classes[0].units[0].items[0].group, undefined); assert.equal(s.classes[1].units[0].items.find(i => i.id === 'b1').group, undefined);
  assert.deepEqual(s.classes[1].names, ['Cal Nye'], 'rosters are never touched');
  await close();
});

test('a setup file’s course links classes, and goes back out', async () => {
  const { page, close } = await openApp(browser, { seed: seed(lib()) });
  await page.evaluate(async () => { const G = window.__gs; await G.stpApply(G.stpRead({ gradingStudioSetup: 1, classes: [{ name: 'Test 12 A', course: 'English 12' }, { name: 'Test 12 B', course: 'English 12' }] }), { classes: true }); });
  assert.deepEqual(await page.evaluate(() => window.__gs.lkSibs('a')), ['b']);
  const out = JSON.parse(await page.evaluate(async () => { const x = await window.__gs.stpExport(); return typeof x === 'string' ? x : JSON.stringify(x); }));
  assert.equal(out.classes.find(c => c.name === 'Test 12 A').course, 'English 12');
  await page.evaluate(() => window.__gs.stpUndo());
  assert.deepEqual(await page.evaluate(() => window.__gs.lkSibs('a')), []);
  await close();
});

test('Link them on the Planner’s offer links every section of the course, and Undo takes it back', async () => {
  const { page, close } = await openApp(browser, { seed: seed(lib()) });
  await classPage(page, 'a');
  await page.evaluate(() => window.__gs.lkPlanSet([{ name: 'Test 12 A', course: 'English 12' }, { name: 'Test 12 B', course: 'English 12' }]));
  await page.waitForSelector('.lkoffer'); await page.click('[data-lkyes]'); await page.waitForSelector('.lkchip');
  assert.deepEqual((await L(page)).classes.map(c => c.course), ['English 12', 'English 12', undefined]);
  await page.evaluate(() => [...document.querySelectorAll('.toast button, #toast button')].find(b => /Undo/.test(b.textContent)).click());
  await new Promise(r => setTimeout(r, 500));
  assert.deepEqual((await L(page)).classes.map(c => c.course), [undefined, undefined, undefined]);
  await page.waitForSelector('.lkoffer');
  await close();
});
