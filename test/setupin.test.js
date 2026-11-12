// My setup: a teacher's setup comes in as one block of text an AI assistant wrote, is shown before anything changes, and can be
// undone. Nothing about a student ever comes in this way. Every teacher, class and student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, goTo } = require('./helpers/app');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

// A made-up MYP sciences teacher, as an assistant would hand the setup back.
const MYP = {
  gradingStudioSetup: 1, teacher: { label: 'Ms Example, MYP Sciences' }, programme: 'MYP',
  school: { system: 'ManageBac', unitPlans: 'Atlas' },
  grading: { way: 'ib7', score: 'rows', criteria: ['A: Knowing and understanding', 'B: Inquiring and designing', 'C: Processing and evaluating', 'D: Reflecting on the impacts of science'], rowTop: 8, halfPoints: false, bandsOutOf: 32,
    bands: [{ grade: '7', from: 28 }, { grade: '6', from: 24 }, { grade: '5', from: 19 }, { grade: '4', from: 15 }, { grade: '3', from: 10 }, { grade: '2', from: 6 }, { grade: '1', from: 0 }] },
  classes: [
    { name: 'MYP 4 Sciences A', course: 'MYP 4 Sciences', link: 'https://school.example/classes/41', meets: [{ day: 'Mon', start: '08:30', end: '09:50', label: 'P1-2' }, { day: 'Thursday', start: '1:00 pm', end: '1:40 pm' }], units: ['Unit 1: Cells', 'Unit 2: Forces'] },
    { name: 'MYP 5 Sciences B', meets: [{ day: 2, start: '10:10', end: '11:30' }], programme: 'MYP', subjectGroup: 'sci', criteria: [{ letter: 'A', name: 'Knowing and understanding' }, 'B: Inquiring and designing', { letter: 'C', name: 'Processing and evaluating' }, { letter: 'D', name: 'Reflecting on the impacts of science' }],
      boundaries: { outOf: 32, grades: [{ grade: 7, from: 28 }, { grade: 6, from: 24 }, { grade: 5, from: 19 }, { grade: 4, from: 15 }, { grade: 3, from: 10 }, { grade: 2, from: 6 }, { grade: 1, from: 1 }] } },
    { name: 'DP Biology SL', programme: 'DP', boundaries: { outOf: 100, grades: [[7, 80], [6, 68], [5, 56], [4, 44], [3, 30], [2, 15], [1, 0]] } },
    { name: 'Homeroom 9C' },
  ],
  calendar: { start: '2026-08-17', end: '2027-01-15', daysOff: [{ date: '2026-10-12', to: '2026-10-14', label: 'Autumn break' }, '2026-11-20'], events: [{ date: '2026-12-07', to: '2026-12-11', label: 'Exams' }] },
  terms: [{ name: 'Term 1', start: '2026-08-17', end: '2026-10-30' }, { name: 'Term 2', start: '2026-11-02', end: '2027-01-15' }],
  gradebook: { weights: { summative: 70, inClass: 30 }, emptyType: 'zero', extraCredit: { addsTo: 'inClass', cap: false }, retakes: 'latest' },
  rubrics: [{ name: 'Lab report', criteria: [{ name: 'Analysis', levels: { 4: 'Explains the pattern with evidence', 3: 'Describes the pattern' } }, 'Conclusion'] }],
  comments: ['Explain how your evidence supports your claim.', 'Label the axes and give units.'],
  goals: ['Uses evidence', 'Designs a fair test'],
  attendance: false,
  slides: { agenda: false, textSizes: 'any' },
  marking: { pointsColor: 'credit', studentFileNames: false, coverNamesOnAnchors: false, findTypedNames: true, gradeSheetFromPapers: true },
};
const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture'];
// A browser with work in it already: one class with students, a unit with an assignment, a term, a saved comment.
function used() {
  const lib = { classes: [{ id: 'c1', name: 'MYP 4 Sciences A', names: NAMES, units: [{ id: 'u1', name: 'Unit 1: Cells', items: [{ id: 'i1', name: 'Cell quiz', type: 'ic', classId: 'c1' }] }], mb: 'https://old.example/41' }],
    loose: { id: '', units: [] }, me: { sys: 'Canvas', unit: '', grade: { way: 'points', setup: { mode: 'points', criteria: ['Criterion 1'], outOf: 20, scale: null } } },
    book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2026-10-23' }], w: { sum: 50, ic: 50 } } };
  return { ls: { 'gs.lib': JSON.stringify(lib), 'gs.bank': JSON.stringify(['Label the axes and give units.']) } };
}
const lib = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().lib)));
const kept = page => page.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));
const ls = (page, k) => page.evaluate(k => { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); }, k);
const plan = page => page.evaluate(() => window.__gs.stpPlanGet());
const text = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
const open = async page => { await goTo(page, '#/settings/setup'); await page.waitForSelector('#stpText'); };
// Pastes a setup and presses Check it; the preview is up when this returns.
async function check(page, setup) {
  await open(page);
  await page.$eval('#stpText', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, typeof setup === 'string' ? setup : JSON.stringify(setup));
  await page.click('[data-stpcheck]');
}
async function bringIn(page, setup) {
  await check(page, setup); await page.waitForSelector('#stpGo');
  await page.click('#stpGo');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden && localStorage.getItem('gs.setupUndo'));
}
const copies = page => page.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });

test('a new teacher’s whole setup comes in from one pasted block, after a preview', async () => {
  const { page, close } = await openApp(browser, { newTeacher: true });
  await page.waitForSelector('#welcome [data-wlai]'); await page.click('#welcome [data-wlai]');   // the welcome has a way straight here
  await page.waitForSelector('#stpText');
  // the assistant's whole reply, with words around the block, a code fence, curly quotes and a trailing comma
  const reply = 'Here is your setup, Ms Example.\n\n```json\n' + JSON.stringify(MYP, null, 1).replace('"Homeroom 9C"', '“Homeroom 9C”').replace(/\n}$/, ',\n}') + '\n```\nPaste it into Settings, My setup.';
  await check(page, reply); await page.waitForSelector('#stpGo');
  // nothing has changed yet
  assert.deepEqual((await lib(page)).classes, []);
  assert.equal(await plan(page), null);
  const titles = await page.$$eval('.stppart > span > b', xs => xs.map(x => x.textContent));
  assert.deepEqual(titles, ['Your school', 'How you grade', 'Classes and timetable', 'Semester and days off', 'Terms', 'What a grade is made of', 'Saved rubrics', 'Saved comments', 'Learning goals', 'Lesson slides', 'Marking and handing back', 'Attendance']);
  const prev = await text(page, '.stpprev');
  assert.match(prev, /Setup for Ms Example, MYP Sciences/);
  assert.match(prev, /4 new classes: MYP 4 Sciences A, MYP 5 Sciences B, DP Biology SL, Homeroom 9C/);
  assert.match(prev, /Grades: 7 from 87\.5% · 6 from 75% · 5 from 59\.4% · 4 from 46\.9% · 3 from 31\.3% · 2 from 18\.8% · 1 from 0%/);
  assert.match(prev, /Each row is scored 0 to 8/); assert.doesNotMatch(prev, /0 to 4/);
  assert.match(prev, /4 days off: Autumn break, No school/);
  assert.equal(await page.$('#stpLeft'), null, 'nothing about students was in it');
  await page.click('#stpGo');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden && localStorage.getItem('gs.setupUndo'));
  assert.match(await text(page, '.toast'), /Your setup is in\./);

  const l = await lib(page);
  assert.deepEqual(l.classes.map(c => [c.name, c.names, c.units.map(u => u.name), c.mb || '']), [['MYP 4 Sciences A', [], ['Unit 1: Cells', 'Unit 2: Forces'], 'https://school.example/classes/41'], ['MYP 5 Sciences B', [], [], ''], ['DP Biology SL', [], [], ''], ['Homeroom 9C', [], [], '']]);
  // IB is each class's own: MYP boundaries stay in points, DP in percent
  assert.deepEqual([l.classes[0].way, l.classes[1].way, l.classes[2].way, l.classes[3].way], [undefined, 'myp', 'dp', undefined]);
  assert.deepEqual(l.classes[1].ib, { group: 'sci', crit: [{ k: 'A', name: 'Knowing and understanding' }, { k: 'B', name: 'Inquiring and designing' }, { k: 'C', name: 'Processing and evaluating' }, { k: 'D', name: 'Reflecting on the impacts of science' }], bounds: [[28, 7], [24, 6], [19, 5], [15, 4], [10, 3], [6, 2], [1, 1]] });
  assert.deepEqual(l.classes[2].ib, { bounds: [[80, 7], [68, 6], [56, 5], [44, 4], [30, 3], [15, 2], [0, 1]] });
  assert.match(prev, /IB programme, criteria and grade boundaries for MYP 5 Sciences B \(MYP\), DP Biology SL \(DP\)/);
  assert.equal(l.me.sys, 'ManageBac'); assert.equal(l.me.unit, 'Atlas'); assert.equal(l.me.prog, 'MYP'); assert.equal(l.me.att, false);
  assert.equal(l.me.grade.way, 'ib7');
  assert.deepEqual(l.me.grade.setup, { mode: 'rubric', criteria: MYP.grading.criteria, outOf: 100, scale: null, top: 8, half: false });
  assert.deepEqual(l.me.grade.bands, [[87.5, '7'], [75, '6'], [59.4, '5'], [46.9, '4'], [31.3, '3'], [18.8, '2'], [0, '1']]);
  assert.deepEqual(l.book.terms.map(t => [t.name, t.start, t.end]), [['Term 1', '2026-08-17', '2026-10-30'], ['Term 2', '2026-11-02', '2027-01-15']]);
  assert.deepEqual([l.book.w.sum, l.book.w.ic, l.book.empty, l.book.xcTo, l.book.xcCap, l.book.retake], [70, 30, 'zero', 'ic', false, 'last']);
  assert.deepEqual(l.goals.map(g => g.name), ['Uses evidence', 'Designs a fair test']);
  assert.deepEqual(await kept(page), l, 'and it is saved');
  const rub = await ls(page, 'gs.rubrics');
  assert.deepEqual(rub.map(r => [r.name, r.criteria, r.levels]), [['Lab report', ['Analysis', 'Conclusion'], [{ 4: 'Explains the pattern with evidence', 3: 'Describes the pattern' }, {}]]]);
  assert.deepEqual(await ls(page, 'gs.bank'), MYP.comments);
  assert.equal((await ls(page, 'gs.setup')).mode, 'rubric', 'the next new assignment starts from it');
  assert.deepEqual([await ls(page, 'gs.xnames'), await ls(page, 'gs.anchorCover'), await ls(page, 'gs.nameFind'), await ls(page, 'gs.ptsInk'), await ls(page, 'gs.sheetfound')], [false, false, true, 'credit', true]);
  assert.equal(await page.evaluate(() => window.__gs.bandOf(76)), '6');
  // the timetable and calendar are the Planner's
  const p = await plan(page);
  assert.deepEqual(p.classes.map(c => [c.name, c.course, c.meets.map(m => m.dow + ' ' + m.start + '-' + m.end + ' ' + m.label)]), [['MYP 4 Sciences A', 'MYP 4 Sciences', ['1 08:30-09:50 P1-2', '4 13:00-13:40 ']], ['MYP 5 Sciences B', '', ['2 10:10-11:30 ']]]);
  assert.equal(p.classes[0].mb, 'https://school.example/classes/41');
  assert.deepEqual([p.semStart, p.semEnd], ['2026-08-17', '2027-01-11'], 'each is the Monday of its week, as the timetable keeps them');
  assert.deepEqual(p.daysOff.map(d => d.date + ' ' + d.label), ['2026-10-12 Autumn break', '2026-10-13 Autumn break', '2026-10-14 Autumn break', '2026-11-20 No school']);
  assert.deepEqual(p.events, [{ date: '2026-12-07', to: '2026-12-11', label: 'Exams' }]);
  assert.deepEqual(p.deck, { agenda: false, sizes: 'any' });
  // Settings says so
  await goTo(page, '#/settings/timetable'); await page.waitForFunction(() => /MYP 5 Sciences B/.test(document.querySelector('#setTimetable').textContent));
  assert.deepEqual(page.errors, []);

  // pasting the same setup again has nothing left to do
  await check(page, MYP); await page.waitForSelector('.stpprev');
  assert.equal(await text(page, '#dlgBox h2'), 'Nothing to bring in');
  assert.equal(await page.$('#stpGo'), null);
  await page.click('#dlgBox [data-cancel]');

  // Undo puts back everything it did
  await open(page); await page.click('[data-stpundo]');
  await page.waitForFunction(() => !localStorage.getItem('gs.setupUndo'));
  const b = await lib(page);
  assert.deepEqual(b.classes, []); assert.equal(b.book, undefined); assert.deepEqual(b.goals, []);
  assert.deepEqual([b.me.sys, b.me.unit, b.me.grade.way, b.me.prog, b.me.att], ['', '', 'rubric', undefined, undefined]);
  assert.deepEqual(await ls(page, 'gs.rubrics'), []); assert.deepEqual(await ls(page, 'gs.bank'), []); assert.equal(await ls(page, 'gs.setup'), null);
  assert.equal(await plan(page), null);
  assert.deepEqual([await ls(page, 'gs.xnames'), await ls(page, 'gs.anchorCover'), await ls(page, 'gs.nameFind'), await ls(page, 'gs.ptsInk'), await ls(page, 'gs.sheetfound')], [true, true, null, null, false], 'the marking choices are as they were');
  assert.equal(await page.$('[data-stpundo]'), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('anything about students is left out, said so, and never stored', async () => {
  const { page, close } = await openApp(browser, { seed: used() });
  const bad = { gradingStudioSetup: 1, roster: ['Zed Shouldnotbe'], scores: { 'Zed Shouldnotbe': 17 },
    classes: [{ name: 'MYP 4 Sciences A', students: ['Zed Shouldnotbe', 'Yan Neverstored'], names: ['Zed Shouldnotbe'], seating: { a1: 'Zed Shouldnotbe' }, grades: [{ student: 'Zed Shouldnotbe', score: 3 }] },
      { name: 'New Class', roster: 'Zed Shouldnotbe\nYan Neverstored', units: ['Unit 1'] }],
    attendance: { '2026-09-01': { 'Zed Shouldnotbe': 'a' } } };
  await check(page, bad); await page.waitForSelector('#stpLeft');
  const left = await text(page, '#stpLeft');
  assert.match(left, /Left out, because it is about students/);
  assert.match(left, /A list of 2 under “students” for MYP 4 Sciences A\./);
  assert.match(left, /“roster” for New Class\./);
  assert.match(left, /Attendance records\./);
  assert.doesNotMatch(await text(page, '#dlgBox'), /Shouldnotbe|Neverstored/, 'a name in it is not even shown');
  await page.click('#stpGo');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden && localStorage.getItem('gs.setupUndo'));
  const l = await lib(page);
  assert.deepEqual(l.classes.map(c => [c.name, c.names]), [['MYP 4 Sciences A', NAMES], ['New Class', []]]);
  const all = await page.evaluate(async () => { let s = ''; for (let i = 0; i < localStorage.length; i++) s += localStorage.getItem(localStorage.key(i)); return s + JSON.stringify(await window.__gs.stpPlanGet()); });
  assert.doesNotMatch(all, /Shouldnotbe|Neverstored/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a browser with work in it keeps its students and its work; one part can be left out; undo spares what was used since', async () => {
  const { page, close } = await openApp(browser, { seed: used() });
  await check(page, MYP); await page.waitForSelector('#stpGo');
  const prev = await text(page, '.stpprev');
  assert.match(prev, /3 new classes: MYP 5 Sciences B, DP Biology SL, Homeroom 9C/);
  assert.match(prev, /Students hand work in on ManageBac \(now Canvas\)/);
  assert.match(prev, /A new assignment starts with IB 1 to 7 \(now points\)/);
  assert.match(prev, /Term 1 moves to Aug 17, 2026 to Oct 30, 2026/);
  assert.match(prev, /1 comment to pick while marking/);
  assert.match(prev, /New units in MYP 4 Sciences A \(1\)/);
  // leave the grading part out
  await page.click('[data-stppart="grading"]');
  assert.equal(await text(page, '#stpGo'), 'Bring in 11 of 12');
  await page.click('#stpGo');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden && localStorage.getItem('gs.setupUndo'));
  let l = await lib(page);
  const c = l.classes[0];
  assert.deepEqual([c.id, c.names, c.units[0].items.length, c.units.map(u => u.name), c.mb], ['c1', NAMES, 1, ['Unit 1: Cells', 'Unit 2: Forces'], 'https://school.example/classes/41']);
  assert.equal(l.me.grade.way, 'points', 'the part that was unticked is as it was');
  assert.deepEqual(l.book.terms.map(t => [t.id, t.start]), [['t1', '2026-08-17'], [l.book.terms[1].id, '2026-11-02']], 'a term she has keeps its id, so assignments moved to it stay');
  assert.deepEqual(await ls(page, 'gs.bank'), ['Label the axes and give units.', 'Explain how your evidence supports your claim.']);
  // she adds a student to a class the import made, then undoes
  await page.evaluate(() => { const G = window.__gs, c = G.state().lib.classes.find(c => c.name === 'MYP 5 Sciences B'); c.names.push('Dov Madeup'); G.saveLib(); });
  await open(page); await page.click('[data-stpundo]');
  await page.waitForFunction(() => !localStorage.getItem('gs.setupUndo'));
  assert.match(await text(page, '.toast'), /Put back, except the class MYP 5 Sciences B, which you have used since\./);
  l = await lib(page);
  assert.deepEqual(l.classes.map(c => [c.name, c.way]), [['MYP 4 Sciences A', undefined], ['MYP 5 Sciences B', 'myp']]);
  assert.deepEqual([l.classes[0].units.map(u => u.name), l.classes[0].mb, l.classes[0].names], [['Unit 1: Cells'], 'https://old.example/41', NAMES]);
  assert.deepEqual([l.me.sys, l.book.terms.length, l.book.terms[0].start, l.book.w.sum], ['Canvas', 1, '2026-08-10', 50]);
  assert.deepEqual(await ls(page, 'gs.bank'), ['Label the axes and give units.']);
  assert.equal(await plan(page), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a setup is only ever read as text: nothing in it runs, shows as a page, or goes where it shouldn’t', async () => {
  const { page, close } = await openApp(browser, { seed: used() });
  const evil = '{"gradingStudioSetup":1,"__proto__":{"polluted":1},"teacher":"<img src=x onerror=\\"window.__hit=1\\">",' +
    '"school":{"system":"<script>window.__hit=1</script>","unitPlans":"' + 'x'.repeat(500) + '"},' +
    '"classes":[{"name":"<b onmouseover=window.__hit=1>Bold</b>","link":"javascript:window.__hit=1","__proto__":{"polluted":1},"meets":[{"day":"Mon","start":"25:00","end":"26:00"},{"day":"Funday","start":"08:00","end":"09:00"},{"day":"Sun","start":"08:00","end":"09:00"}],"color":"red;background:url(x)"}],' +
    '"terms":[{"name":"T","start":"2026-02-31","end":"2026-03-01"}],"gradebook":{"weights":{"summative":1e9,"inClass":"abc"}},"constructor":{"prototype":{"polluted":1}},"wizard":true}';
  await check(page, evil); await page.waitForSelector('#stpGo');
  assert.equal(await page.$('#dlgBox img, #dlgBox script, #dlgBox b[onmouseover]'), null, 'it is shown as words');
  assert.match(await text(page, '.stpprev'), /A new class: <b onmouseover=window\.__hit=1>Bold<\/b>/);
  assert.match(await text(page, '.stpunk'), /Not used by this version: __proto__, constructor, wizard\./);
  await page.click('#stpGo');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden && localStorage.getItem('gs.setupUndo'));
  const l = await lib(page), c = l.classes[1];
  assert.equal(c.mb, undefined, 'a link that is not a web address is dropped');
  assert.equal(l.me.unit.length, 40);
  assert.equal(l.book.terms.length, 1, 'a date that does not exist is no term');
  assert.deepEqual(l.book.w, { sum: 50, ic: 50 });
  assert.deepEqual((await plan(page)).classes.map(k => [k.meets, /^#[0-9a-f]{6}$/i.test(k.color)]), [[[{ dow: 0, start: '08:00', end: '09:00', label: '' }], true]]);
  await goTo(page, '#/'); await goTo(page, '#/settings/classes');
  assert.equal(await page.evaluate(() => window.__hit || ({}).polluted || null), null);
  // text that is not a setup says so and changes nothing
  for (const [t, re] of [['', /Nothing to read yet/], ['Sure! I can help with that.', /No setup found/], ['{"classes":["A"]}', /no "gradingStudioSetup" line/], ['{"gradingStudioSetup":1,' + '"x":"' + 'y'.repeat(400001) + '"}', /too long/]]) {
    await open(page);
    await page.$eval('#stpText', (el, v) => { el.value = v; }, t); await page.click('[data-stpcheck]');
    await page.waitForFunction(() => document.querySelector('#stpErr').textContent);
    assert.match(await text(page, '#stpErr'), re);
    assert.equal(await page.$eval('#dlg', d => d.hidden), true);
  }
  assert.deepEqual(page.errors, []);
  await close();
});

test('Copy my setup gives the same block back, with no student in it, and it sets up another browser', async () => {
  const a = await openApp(browser, { seed: used() });
  await bringIn(a.page, MYP);
  await open(a.page); await copies(a.page);
  await a.page.click('[data-stpcopy]');
  await a.page.waitForFunction(() => window.__copied);
  const out = await a.page.evaluate(() => window.__copied), j = JSON.parse(out);
  for (const n of NAMES) assert.ok(!out.includes(n), 'no student name');
  assert.ok(!/Cell quiz/.test(out), 'no assignment');
  assert.equal(j.gradingStudioSetup, 1);
  assert.deepEqual(j.classes[0], { name: 'MYP 4 Sciences A', course: 'MYP 4 Sciences', link: 'https://school.example/classes/41', meets: [{ day: 'Mon', start: '08:30', end: '09:50', label: 'P1-2' }, { day: 'Thu', start: '13:00', end: '13:40' }], units: ['Unit 1: Cells', 'Unit 2: Forces'] });
  assert.deepEqual(j.grading.bands[1], { grade: '6', from: 75 });
  assert.equal(j.grading.rowTop, 8); assert.equal(j.programme, 'MYP');
  assert.deepEqual([j.classes[1].programme, j.classes[1].subjectGroup, j.classes[1].criteria[1], j.classes[1].boundaries.outOf, j.classes[1].boundaries.grades[0], j.classes[2].programme, j.classes[2].boundaries.grades[1]], ['MYP', 'sci', { letter: 'B', name: 'Inquiring and designing' }, 32, { grade: 7, from: 28 }, 'DP', { grade: 6, from: 68 }]);
  assert.deepEqual(j.slides, { agenda: false, textSizes: 'any' });
  assert.deepEqual(j.marking, { studentFileNames: false, coverNamesOnAnchors: false, findTypedNames: true, pointsColor: 'credit', gradeSheetFromPapers: true });
  assert.deepEqual(j.gradebook, { weights: { summative: 70, inClass: 30 }, emptyType: 'zero', extraCredit: { addsTo: 'inClass', cap: false }, retakes: 'latest' });
  const la = await lib(a.page), pa = await plan(a.page);
  await a.close();

  const b = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify({ classes: [], loose: { id: '', units: [] } }) } } });
  await bringIn(b.page, out);
  const lb = await lib(b.page), pb = await plan(b.page);
  assert.deepEqual(lb.classes.map(c => [c.name, c.names, c.way, c.ib, c.units.map(u => [u.name, u.items])]), la.classes.map(c => [c.name, [], c.way, c.ib, c.units.map(u => [u.name, []])]));
  delete lb.me.scale12; delete lb.me.ai;   // a browser from before the welcome keeps the scale and the assistant it always had
  assert.deepEqual(lb.me, la.me);
  assert.deepEqual([lb.book.terms.map(t => [t.name, t.start, t.end]), lb.book.w, lb.book.retake], [la.book.terms.map(t => [t.name, t.start, t.end]), la.book.w, la.book.retake]);
  assert.deepEqual(pb.classes.map(c => [c.name, c.meets]), pa.classes.map(c => [c.name, c.meets]));
  assert.deepEqual([pb.semStart, pb.semEnd, pb.daysOff, pb.events, pb.deck], [pa.semStart, pa.semEnd, pa.daysOff, pa.events, pa.deck]);
  assert.deepEqual(b.page.errors, []);
  await b.close();
});

test('the prompt tells an assistant to leave students out, and is one press to copy', async () => {
  const { page, close } = await openApp(browser, { seed: used() });
  await open(page); await copies(page);
  await page.click('[data-stpprompt]');
  await page.waitForFunction(() => window.__copied);
  const p = await page.evaluate(() => window.__copied);
  assert.match(p, /Nothing about students\. Never put student names, class lists, ID numbers, emails, scores, grades, attendance records/);
  assert.match(p, /"gradingStudioSetup": 1/);
  assert.match(p, /MYP class: "programme": "MYP"/); assert.match(p, /DP class: "programme": "DP"/); assert.match(p, /Never include the IB’s level descriptors|Never include the IB's level descriptors/);
  assert.match(p, /Never invent or guess/);
  // the example in the prompt is itself a setup the app reads, with every part understood
  const ex = p.slice(p.indexOf('{\n  "gradingStudioSetup"'), p.indexOf('\n\nFIELD NOTES'));
  const S = await page.evaluate(t => { const r = window.__gs.stpParse(t); return r.err ? r : window.__gs.stpRead(r.j); }, ex);
  assert.equal(S.err, undefined);
  assert.deepEqual([S.unknown, S.left, S.notes], [[], [], []]);
  assert.deepEqual([S.classes.length, S.classes[0].meets.length, S.terms.length, S.rubrics.length, S.comments.length, S.goals.length, S.calendar.daysOff.length, S.grading.bands.length, S.book.retake], [1, 2, 1, 1, 1, 2, 5, 7, 'high']);
  // "Read it first" shows the same words
  await page.click('[data-stpsee]'); await page.waitForSelector('.stppre');
  assert.equal(await page.$eval('.stppre', e => e.textContent), p);
  // Find anything knows the page
  assert.deepEqual(page.errors, []);
  await close();
});
