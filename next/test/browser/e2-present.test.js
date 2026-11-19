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

test('E2-093 E2-092: after presenting today, where the class got to and the agenda ticked are kept; Change asks which class, which slide and a line for next time', async () => {
  const { LESSONS, lesson } = require('./planseed.js');
  const two = lesson('T2', 'Two classes today', [{ classId: 'A1', date: '2026-10-27' }, { classId: 'B1', date: '2026-10-27' }], {});
  const p = await h.fresh(1366, { lessons: [...LESSONS.filter(l => l.id !== 'L2'), two] });
  await present(p, 'T2');
  await p.click('[data-pb="agenda"]'); await p.waitForSelector('[data-ag="0"]');
  await p.click('[data-ag="0"]'); await p.click('[data-ag="1"]');
  await p.focus('.present'); await p.keyboard.press('3'); await p.keyboard.press('Enter');
  await until(p, () => document.querySelector('.prbar .num').textContent === 'Slide 3 of 5');
  await p.evaluate(() => { const n = Date.now() + 3 * 60000; Date.now = () => n; });   // three minutes presenting
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
  await until(p, () => !document.querySelector('.present'));
  await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(x => /slide 3 of 5/.test(x.textContent)), { timeout: 8000 });
  let l = await h.lessonInDb(p, 'T2');
  const t0 = l.taught.find(x => x.classId === 'A1');
  assert.equal(t0.slide, 3); assert.deepEqual(t0.agenda, [2, 3], 'the agenda items ticked are kept, as the current Planner keeps them');
  await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => b.textContent === 'Change').click());
  await p.waitForSelector('dialog.sheet [data-gt="slide"]');
  assert.equal(await p.$eval('dialog.sheet h2', x => x.textContent), 'Where did the class get to?');
  await p.select('[data-gt="class"]', '1');   // the other class taught today
  await p.select('[data-gt="slide"]', '4');
  await p.click('[data-gt="note"]'); await p.keyboard.type('Start with the exit ticket');
  await p.click('[data-gt="save"]');
  await until(p, () => !document.querySelector('dialog.sheet[open]'));
  for (let k = 0; k < 40; k++) { l = await h.lessonInDb(p, 'T2'); if ((l.taught || []).some(x => x.classId === 'B1')) break; await new Promise(r => setTimeout(r, 100)); }
  const b1 = l.taught.find(x => x.classId === 'B1');
  assert.equal(b1.slide, 4); assert.equal(b1.note, 'Start with the exit ticket');
  // the current Planner reads the same "taught" without changing it
  await p.goto(h.srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && Array.isArray(P.L.lessons) && P.L.lessons.some(l => l.id === 'T2'); }, { timeout: 20000 });
  const theirs = await p.evaluate(() => JSON.parse(JSON.stringify(window.__planner.L.lessons.find(l => l.id === 'T2').taught)));
  assert.deepEqual(theirs.map(x => [x.classId, x.slide, x.agenda || null, x.note]).sort(), [['A1', 3, [2, 3], ''], ['B1', 4, null, 'Start with the exit ticket']]);
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
