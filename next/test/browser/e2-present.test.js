// Stage 8, slice E2: Present's bar, class timer, agenda, class links, the class screen window and the timer in the corner
// (rows E2-030 to E2-044, E2-076, E2-079 of rebuild/audit/gaps.md). Made-up lessons at the stopped clock (planseed.js); the clock
// stands still, so a timer keeps the time it was given and each check reads exact times.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./e2harness.js');
const h = harness(before, after);

async function present(p, id = 'L3') {
  await h.open(p, 'lesson/' + id + '/slides');
  await p.keyboard.press('F5');
  await p.waitForSelector('.present');
  await p.waitForFunction(() => document.activeElement && document.activeElement.matches('.present'), { timeout: 5000 });
}
const txt = (p, sel) => p.$eval(sel, x => x.textContent.trim());
const until = (p, fn, ...a) => p.waitForFunction(fn, { timeout: 8000 }, ...a);
const timerKey = p => p.evaluate(() => JSON.parse(localStorage.getItem('gsp.presentTimer') || 'null'));

test('E2-031 E2-037 E2-039 E2-040 E2-041 E2-042 E2-043 E2-044: the class timer by its buttons, kept where the current Planner reads it', async () => {
  const p = await h.fresh();
  await present(p);
  assert.match(await txt(p, '.prbar .prtime'), /^\d{1,2}:\d\d/, 'E2-037 the bar shows the time of day');
  await p.click('[data-pb="timer"]');
  await p.waitForSelector('.prpanel.pr-timer');
  assert.equal(await txt(p, '.prtimer h3'), 'Start a timer the class can see');
  // E2-041 presets 0:30, 1, 2, 3, 5, 10, 15
  assert.deepEqual(await p.$$eval('.prtimer [data-ts], .prtimer [data-tm]', b => b.map(x => x.textContent.trim())), ['0:30', '1', '2', '3', '5', '10', '15']);
  await p.click('[data-tm="5"]');
  await until(p, () => document.querySelector('.prtimer b') && document.querySelector('.prtimer b').textContent === '5:00');
  assert.equal((await timerKey(p)).total, 300, 'the timer is kept in gsp.presentTimer, as the current Planner keeps it');
  // E2-039 more and less time
  await p.click('[data-ta="10"]'); await until(p, () => document.querySelector('.prtimer b').textContent === '5:10');
  await p.click('[data-ta="60"]'); await until(p, () => document.querySelector('.prtimer b').textContent === '6:10');
  await p.click('[data-ta="-10"]'); await until(p, () => document.querySelector('.prtimer b').textContent === '6:00');
  await p.click('[data-ta="-60"]'); await until(p, () => document.querySelector('.prtimer b').textContent === '5:00');
  // E2-040 pause, go on, restart, stop
  await p.click('[data-tp="pause"]'); await until(p, () => document.querySelector('[data-tp="pause"]').textContent === 'Go on');
  assert.equal((await timerKey(p)).paused, true);
  await p.click('[data-tp="pause"]'); await until(p, () => document.querySelector('[data-tp="pause"]').textContent === 'Pause');
  await p.click('[data-ta="60"]'); await until(p, () => document.querySelector('.prtimer b').textContent === '6:00');
  await p.click('[data-tp="restart"]'); await until(p, () => document.querySelector('.prtimer b').textContent === '5:00');
  await p.click('[data-tp="stop"]'); await until(p, () => !document.querySelector('.prtimer b') && document.querySelector('[data-tm="1"]'));
  assert.equal(await timerKey(p), null, 'Stop clears it');
  // E2-042 own minutes and seconds, Enter starts
  await p.click('[data-own="m"]'); await until(p, () => document.activeElement && document.activeElement.matches('[data-own="m"]'));
  await p.keyboard.type('1');
  await p.click('[data-own="s"]'); await until(p, () => document.activeElement && document.activeElement.matches('[data-own="s"]'));
  await p.keyboard.type('30'); await p.keyboard.press('Enter');
  await until(p, () => document.querySelector('.prtimer b') && document.querySelector('.prtimer b').textContent === '1:30');
  assert.equal(await h.local(p, 'gsp.presentOwn'), '90', 'the own time is kept for next time');
  // taking more away than is left: time's up
  await p.click('[data-ta="-60"]'); await p.click('[data-ta="-60"]');
  await until(p, () => /Time’s up/.test(document.querySelector('.prtimer').textContent));
  // E2-043 big, E2-044 sound: switches kept as the current Planner keeps them
  await p.click('[data-ts="30"]');
  const sw = async name => p.evaluate(n => [...document.querySelectorAll('.prtimer .sw')].find(x => x.textContent.includes(n)).click(), name);
  await sw('big'); await until(p, () => localStorage.getItem('gsp.presentBig') === '1');
  await sw('sound'); await until(p, () => localStorage.getItem('gsp.presentSound') === '0');
  await p.click('[data-pb="timer"]');
  await until(p, () => !document.querySelector('.prpanel') && document.querySelector('button.prclock.big'));
  // E2-031 the chip pauses, goes on
  assert.equal(await txt(p, 'button.prclock'), '0:30');
  await p.click('button.prclock'); await until(p, () => document.querySelector('button.prclock').classList.contains('paused'));
  await p.click('button.prclock'); await until(p, () => !document.querySelector('button.prclock').classList.contains('paused'));
  // The current Planner picks up the same running timer: its corner box shows the time.
  await p.keyboard.press('Escape');
  await p.goto(h.srv.url + 'planner.html');
  await p.waitForSelector('#prFloat .prf-t', { timeout: 20000 });
  assert.match(await txt(p, '#prFloat .prf-t'), /^0:30/);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-032 E2-033 E2-035 E2-036 E2-038: the bar has Agenda, Groups, Blank and Full screen; agenda items tick off', async () => {
  const p = await h.fresh();
  await present(p);
  const labels = await p.$$eval('.prbar [aria-label]', b => b.map(x => x.getAttribute('aria-label')));
  for (const l of ['Agenda', 'Groups', 'Blank screen', 'Class timer', 'Pick a name', 'Speaker notes']) assert.ok(labels.includes(l), l + ' is on the bar');
  assert.ok(labels.includes('Full screen') || labels.includes('Leave full screen'), 'Full screen is on the bar');
  await p.click('[data-pb="agenda"]');
  await p.waitForSelector('.prpanel.pr-agenda [data-ag]');
  assert.deepEqual(await p.$$eval('[data-ag]', b => b.map(x => x.textContent.trim())), ['Warm-up', 'Read in pairs', 'Exit ticket']);
  assert.ok(await p.$('[data-ag="0"].now'), 'the first item not yet done is the one under way');
  await p.click('[data-ag="0"]');
  await until(p, () => document.querySelector('[data-ag="0"]').getAttribute('aria-pressed') === 'true' && document.querySelector('[data-ag="1"]').classList.contains('now'));
  await p.click('[data-ag="0"]');
  await until(p, () => document.querySelector('[data-ag="0"]').getAttribute('aria-pressed') === 'false');
  await p.click('[data-pb="groups"]'); await p.waitForSelector('.prpanel.pr-groups');
  await p.click('[data-pb="blank"]'); await p.waitForSelector('.present.blank');
  await p.click('[data-pb="blank"]'); await until(p, () => !document.querySelector('.present.blank'));
  // Full screen: the button asks the browser for it (a check page may be refused, so the ask is what is seen)
  await p.evaluate(() => { window.__fs = 0; Element.prototype.requestFullscreen = function () { window.__fs++; return Promise.resolve(); }; document.exitFullscreen = () => { window.__fs++; return Promise.resolve(); }; });
  await p.click('[data-pb="full"]');
  assert.equal(await p.evaluate(() => window.__fs), 1, 'E2-036 the Full screen button goes into (or out of) full screen');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-038 a lesson with no agenda lists its slides to jump to', async () => {
  const { LESSONS, lesson } = require('./planseed.js');
  const bare = lesson('N1', 'No agenda here', [{ classId: 'A1', date: '2026-10-29' }], {});
  bare.slides = bare.slides.filter(s => s.layout !== 'agenda');
  const p = await h.fresh(1366, { lessons: [...LESSONS, bare] });
  await present(p, 'N1');
  await p.click('[data-pb="agenda"]');
  await p.waitForSelector('[data-goto]');
  await p.click('[data-goto="2"]');
  await until(p, () => document.querySelector('.prbar .num').textContent === 'Slide 3 of 4');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-030 E2-034: Links shows the lesson’s links and the class’s School links, numbered', async () => {
  const { LESSONS } = require('./planseed.js');
  const ls = LESSONS.map(l => l.id === 'L3' ? { ...l, links: [{ id: 'k1', name: 'Sonnet reading', url: 'https://example.com/sonnet' }] } : l);
  const school = { items: [{ id: 's1', kind: 'link', name: 'Class site', url: 'https://example.org/grade9', cls: ['Grade 9'] }, { id: 's2', kind: 'link', name: 'Other class', url: 'https://example.org/g10', cls: ['Grade 10'] }], order: [], ot: 0 };
  const p = await h.fresh(1366, { lessons: ls }, { 'gs.school': school });
  await present(p);
  await p.click('[data-pb="links"]');
  await p.waitForSelector('.prpanel.pr-links [data-link]');
  assert.deepEqual(await p.$$eval('.pr-links h3', x => x.map(e => e.textContent)), ['This lesson', 'Grade 9']);
  assert.deepEqual(await p.$$eval('[data-link]', x => x.map(e => e.textContent)), ['1Sonnet reading', '2Class site'], 'the class’s own School link, not another class’s');
  const got = p.ctx.waitForTarget(x => x.url().startsWith('https://example.org/grade9'), { timeout: 8000 });
  await p.keyboard.press('2');
  assert.ok(await got, 'a number opens that link');
  assert.deepEqual(p.errors.filter(e => !/net::|ERR_/.test(e)), []); await p.ctx.close();
});

test('E2-079: the class screen window has its own full screen, by F and by a button', async () => {
  const p = await h.fresh();
  await present(p);
  const got = p.ctx.waitForTarget(x => x.type() === 'page' && x !== p.target(), { timeout: 10000 });
  await p.keyboard.press('w');
  const w = await (await got).page();
  await w.waitForSelector('#fit .ls-slide');
  await w.evaluate(() => { window.__fs = 0; document.documentElement.requestFullscreen = () => { window.__fs++; return Promise.resolve(); }; });
  assert.equal(await w.$eval('#fs', b => b.textContent), 'Full screen');
  await w.click('#fs');
  assert.equal(await w.evaluate(() => window.__fs), 1, 'the button puts the class screen on its whole screen');
  await w.keyboard.press('f');
  assert.equal(await w.evaluate(() => window.__fs), 2, 'F in that window does the same');
  assert.equal(await p.$eval('.prbar .num', x => x.textContent), 'Slide 1 of 5', 'the button did not move the slide on');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-076: a timer still running after Present sits in the corner; press pauses, × stops; it comes back after a refresh', async () => {
  const p = await h.fresh();
  await present(p);
  await p.keyboard.press('t'); await p.waitForSelector('.prpanel.pr-timer');
  await p.keyboard.press('2');
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
  await until(p, () => !document.querySelector('.present'));
  await p.waitForSelector('#prFloat .prf-t');
  assert.equal(await txt(p, '#prFloat .prf-t'), '2:00');
  await p.click('#prFloat [data-prf="go"]');
  await until(p, () => document.querySelector('#prFloat .prf').classList.contains('paused'));
  await p.reload();
  await p.waitForSelector('#prFloat .prf.paused', { timeout: 20000 });
  await p.click('#prFloat [data-prf="x"]');
  await until(p, () => !document.querySelector('#prFloat'));
  assert.equal(await timerKey(p), null);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

async function endPresentation(p, ms) {
  await p.evaluate(ms => { const end = Date.now() + ms; Date.now = () => end; }, ms);
  await p.keyboard.press('Escape');
  await until(p, () => !document.querySelector('.present'));
}

async function taughtInClassicPlanner(p, id) {
  await p.goto(h.srv.url + 'planner.html');
  await p.waitForFunction(id => window.__planner?.L.lessons?.some(l => l.id === id), { timeout: 20000 }, id);
  return p.evaluate(id => window.__planner.L.lessons.find(l => l.id === id).taught || [], id);
}

test('E2-092 E2-093: one class can decline at two minutes or save without erasing its previous agenda count', async () => {
  const { LESSONS } = require('./planseed.js');
  const prior = { classId: 'A1', date: '2026-10-27', slide: 4, of: 5, note: 'Last time', agenda: [1, 3], at: 1792000000000 };
  const p = await h.fresh(1366, { lessons: LESSONS.map(l => l.id === 'L2' ? { ...l, taught: [prior] } : l) });

  await present(p, 'L2');
  await endPresentation(p, 119999);
  assert.equal(await p.$('[data-gt="slide"]'), null, 'just under two minutes does not prompt');
  assert.deepEqual((await h.lessonInDb(p, 'L2')).taught, [prior]);

  await present(p, 'L2');
  await endPresentation(p, 120000);
  await p.waitForSelector('dialog[open] [data-gt="slide"]', { timeout: 8000 });
  assert.equal(await p.$('[data-gt="class"]'), null, 'one class needs no chooser');
  assert.match(await txt(p, 'dialog.sheet[open]'), /Grade 9 English.*(?:Oct.*27|27.*Oct)/, 'the single class and date are visible');
  assert.equal(await p.$eval('[data-gt="slide"]', s => s.value), '1', 'defaults to the farthest slide this time');
  assert.equal(await p.$eval('[data-gt="note"]', s => s.value), prior.note);
  assert.deepEqual((await h.lessonInDb(p, 'L2')).taught, [prior], 'opening the question saves nothing');
  await p.click('[data-gt="later"]');
  await until(p, () => !document.querySelector('dialog[open]'));
  assert.deepEqual(await taughtInClassicPlanner(p, 'L2'), [prior], 'Not now leaves the current Planner intact');

  await present(p, 'L2');
  await endPresentation(p, 120000);
  await p.waitForSelector('dialog[open] [data-gt="slide"]');
  await p.select('[data-gt="slide"]', '2');
  await p.click('[data-gt="save"]');
  await until(p, () => !document.querySelector('dialog[open]'));
  const expected = [{ ...prior, slide: 2, at: await p.evaluate(() => Date.now()) }];
  assert.deepEqual((await h.lessonInDb(p, 'L2')).taught, expected, 'no new ticks preserves the existing agenda');
  assert.deepEqual(await taughtInClassicPlanner(p, 'L2'), expected);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-092 E2-093: Escape records nothing; Save records the chosen class, slide, note and top-level agenda only', async () => {
  const { LESSONS, SETUP, lesson } = require('./planseed.js');
  const old = { classId: 'A1', date: '2026-10-26', slide: 2, of: 5, note: 'Yesterday', agenda: [1, 3], at: 1792000000000 };
  const slots = [{ classId: 'B1', date: '2026-10-27' }, { classId: 'A1', date: '2026-10-27' }];
  const two = lesson('T2', 'Two classes today', slots, { taught: [old] });
  two.slides[1].body += '\n\tDiscuss the last question';
  const setup = { ...SETUP, classes: SETUP.classes.map(c => c.id === 'A1'
    ? { ...c, meets: [{ dow: 2, start: '10:00', end: '11:00' }] } : c) };
  const p = await h.fresh(1366, { setup, lessons: [...LESSONS.filter(l => !['L2', 'L4'].includes(l.id)), two] });
  await p.emulateTimezone('UTC'); // Tuesday at 10:20, A1 is in class and B1 starts at 10:45.
  await present(p, 'T2');
  await endPresentation(p, 180000);
  await p.waitForSelector('dialog[open] [data-gt="class"]', { timeout: 8000 });
  assert.match(await p.$eval('[data-gt="class"]', s => s.selectedOptions[0].textContent), /Grade 9 English/,
    'F5 suggests the current class on the timetable even when it is the second lesson slot');
  await p.keyboard.press('Escape');
  await until(p, () => !document.querySelector('dialog[open]'));
  assert.deepEqual((await h.lessonInDb(p, 'T2')).taught, [old]);
  assert.deepEqual(await taughtInClassicPlanner(p, 'T2'), [old]);

  await h.open(p, 'lesson/T2/present/A1');
  await until(p, () => document.activeElement?.matches('.present'));
  await p.keyboard.press('a'); await p.waitForSelector('[data-ag="0"]');
  await p.click('[data-ag="0"]'); await p.click('[data-ag="1"]');
  await until(p, () => document.querySelectorAll('[data-ag][aria-pressed="true"]').length === 2);
  await p.focus('.present'); await p.keyboard.press('Escape');
  await until(p, () => !document.querySelector('.prpanel'));
  await p.keyboard.press('3'); await p.keyboard.press('Enter');
  await until(p, () => document.querySelector('.prbar .num').textContent === 'Slide 3 of 5');
  await p.keyboard.press('ArrowLeft');
  await until(p, () => document.querySelector('.prbar .num').textContent === 'Slide 2 of 5');
  await endPresentation(p, 180000);
  await p.waitForSelector('dialog[open] [data-gt="class"]');
  assert.equal(await txt(p, 'dialog.sheet h2'), 'Where did the class get to?');
  assert.equal(await p.$eval('[data-gt="slide"]', s => s.value), '3', 'farthest slide, even after going back');
  assert.match(await p.$eval('[data-gt="class"]', s => s.selectedOptions[0].textContent), /Grade 9 English/,
    'the direct link selected A1');
  await p.select('[data-gt="class"]', '0'); // change to B1
  await p.select('[data-gt="slide"]', '4');
  await p.click('[data-gt="note"]'); await p.keyboard.type('Start with the exit ticket');
  assert.deepEqual((await h.lessonInDb(p, 'T2')).taught, [old], 'selecting a class and typing does not save');
  await p.click('[data-gt="save"]');
  await until(p, () => !document.querySelector('dialog[open]'));
  const expected = [old, { classId: 'B1', date: '2026-10-27', slide: 4, of: 5, note: 'Start with the exit ticket', agenda: [2, 3], at: await p.evaluate(() => Date.now()) }];
  assert.deepEqual((await h.lessonInDb(p, 'T2')).taught, expected, 'only the chosen class gets a record for today');
  await until(p, () => document.querySelector('[data-taught]')?.textContent.includes('Start with the exit ticket'));
  const rows = await p.$$eval('[data-taught] li', nodes => nodes.map(x => x.textContent));
  assert.equal(rows.length, 2);
  assert.match(rows[1], /Grade 10 Literature.*Got to slide 4 of 5.*agenda 2 of 3.*Start with the exit ticket/);
  assert.deepEqual(await taughtInClassicPlanner(p, 'T2'), expected);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-092: a presentation link cannot mark a class absent from the lesson schedule', async () => {
  const p = await h.fresh();
  await h.open(p, 'lesson/L3/present/B1'); // L3 is scheduled only for A1, two days later.
  await until(p, () => document.activeElement?.matches('.present'));
  await endPresentation(p, 180000);
  assert.equal(await p.$('dialog[open] [data-gt]'), null);
  assert.deepEqual(await taughtInClassicPlanner(p, 'L3'), []);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-078: lesson/<id>/present/<class> (the old planner.html#present address) presents at once', async () => {
  const p = await h.fresh();
  await p.goto(h.srv.url + 'next/#/lesson/L2/present/A1');
  await p.waitForSelector('.present', { timeout: 20000 });
  assert.equal(await p.$eval('.prbar .num', x => x.textContent), 'Slide 1 of 5');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-077: plan/<class>/<day> (the old planner.html#plan address) opens that meeting’s lesson, or makes it, with a focus session on it', async () => {
  let p = await h.fresh();
  await p.goto(h.srv.url + 'next/#/plan/A1/2026-10-29');
  await p.waitForFunction(() => location.hash === '#/lesson/L3', { timeout: 20000 });
  await p.waitForFunction(() => (JSON.parse(localStorage.getItem('gsp.focusRun')) || {}).w === 'les:L3', { timeout: 20000 });
  assert.deepEqual(p.errors, []); await p.ctx.close();
  p = await h.fresh();
  await p.goto(h.srv.url + 'next/#/plan/B1/2026-10-30');
  await p.waitForFunction(() => /^#\/lesson\/[^/]+$/.test(location.hash) && location.hash !== '#/lesson/L3', { timeout: 20000 });
  const id = await p.evaluate(() => location.hash.split('/')[2]);
  const l = await h.lessonInDb(p, id);
  assert.deepEqual(l.slots.map(s => s.classId + ' ' + s.date), ['B1 2026-10-30'], 'a lesson is made for that meeting');
  await p.waitForFunction(id => (JSON.parse(localStorage.getItem('gsp.focusRun')) || {}).w === 'les:' + id, { timeout: 20000 }, id);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});
