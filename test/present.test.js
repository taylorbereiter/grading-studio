// Presenting a lesson from the Planner: the slides on the whole screen, the agenda, the timer, and the note on where
// the class got to. Made-up classes and lessons only.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { serve } = require('./helpers/serve');
const { launch } = require('./helpers/chrome');
const ROOT = path.join(__dirname, '..');
const PAGE = () => fs.readFileSync(path.join(ROOT, 'planner.html'), 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));
// Asked from here, not waited for inside the page: a page going in or out of full screen can leave an in-page wait hanging.
const until = async (page, fn, arg) => { for (let i = 0; i < 160; i++) { if (await page.evaluate(fn, arg)) return; await wait(50); } throw new Error('Waited too long for ' + fn + ' ' + (arg || '')); };

async function open(hash) {
  const server = await serve(PAGE);
  const browser = await launch(), page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.url + (hash || ''), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
  return { server, browser, page, errors, done: async () => { await browser.close(); await server.close(); } };
}
// Two classes that both meet today, the first one right now, and a lesson on both. Returns the lesson's id.
async function seed(page, opts) {
  return page.evaluate(async o => {
    const P = window.__planner, d = new Date(), pad = n => String(n).padStart(2, '0'), today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const h = d.getHours(), every = (start, end) => [0, 1, 2, 3, 4, 5, 6].map(dow => ({ dow, start, end }));
    await P.applySetup({ kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-08-31', semEnd: '2027-01-18', daysOff: [], events: [],
      classes: [{ id: 'A1', name: 'Course A-1', course: 'Course A', color: '#1F6FB2', meets: every(pad(h) + ':00', pad(h) + ':59') }, { id: 'A2', name: 'Course A-2', course: 'Course A', color: '#7B3FC4', meets: every('00:00', '00:01') }] });
    const l = P.normLesson({ title: 'Reading a poem', fmt: 2, look: 'white', slots: o.noSlot ? [] : [{ classId: 'A1', date: today }, { classId: 'A2', date: today }], slides: [
      { layout: 'title', title: 'Reading a poem' },
      { layout: 'agenda', title: 'Agenda', body: '1. Warm-up\n2. Read aloud\n\tTwice\n3. Exit ticket', size: 32 },
      { layout: 'content', title: 'Read aloud', body: '• Listen for the turn\n• Mark one line', size: 36, notes: 'Read it twice.' },
      { layout: 'discuss', title: 'Talk', body: 'Which line stays with you?', foot: 'Think · Pair · Share' },
      { layout: 'exit', title: 'Exit ticket', tag: 'On a sticky note', body: 'What changed at the turn?' }] });
    P.L.lessons.push(l); await P.copyLesson;   // (copyLesson is used further down; here the lesson only has to be saved)
    P.openLessonForTest(l, 0);
    await new Promise(r => setTimeout(r, 0));
    document.querySelector('[data-f="ltitle"]').dispatchEvent(new Event('input', { bubbles: true }));   // a save, as typing makes one
    await new Promise(r => setTimeout(r, 700));
    return { id: l.id, today };
  }, opts || {});
}
const state = page => page.evaluate(() => { const p = window.__present.PR; return { on: p.on, i: p.i, far: p.far, ended: p.ended, blank: p.blank, agenda: p.agenda, notes: p.notes, ticks: [...(p.ticks || [])], slot: p.slot }; });
// Waits until the stage has finished starting (it may still be going full screen), so the keys that follow land on it.
const present = async page => { await page.$eval('[data-pr="present"]', b => b.click()); await until(page, () => { const h = document.querySelector('#present #prHint'); return !!(h && h.textContent); }); };
// Ticks an agenda item and waits until the stage has it ticked; a click lost to a slow runner is made again.
const tick = async (page, i) => {
  for (let n = 0; n < 5; n++) {
    await until(page, k => !!document.querySelector('#prAgenda [data-ag="' + k + '"]'), i);
    if (await page.evaluate(k => window.__present.PR.ticks.has(k), i)) return;
    await page.$eval('#prAgenda [data-ag="' + i + '"]', b => b.click());
    try { await until(page, k => window.__present.PR.ticks.has(k) && document.querySelector('#prAgenda [data-ag="' + k + '"]').getAttribute('aria-pressed') === 'true', i); return; } catch { }
  }
  throw new Error('agenda item ' + i + ' would not tick');
};

test('Present shows the lesson on the whole screen, and the keys run it', async () => {
  const a = await open();
  try {
    const { page } = a;
    await seed(page, { noSlot: true });
    // the lesson's top bar: Present is the one blue button, Download is plain
    assert.deepEqual(await page.$$eval('.ls-top .btn.primary', b => b.map(x => x.textContent.trim())), ['Present']);
    const before = await page.evaluate(() => JSON.stringify(window.__planner.L.open.slides));
    await present(page);
    // the slide is the same 1280 x 720 slide, made as big as the window allows, never bigger
    const fit = await page.evaluate(() => { const f = document.querySelector('#prFit').getBoundingClientRect(), s = document.querySelector('#prFit .ls-slide').getBoundingClientRect(); return { w: f.width, h: f.height, sw: s.width, sh: s.height, vw: innerWidth, vh: innerHeight }; });
    assert.ok(Math.abs(fit.w / fit.h - 16 / 9) < 0.01, 'the slide keeps its shape');
    assert.ok(fit.w <= fit.vw + 1 && fit.h <= fit.vh + 1 && (fit.vw - fit.w < 2 || fit.vh - fit.h < 2), 'the slide fills the window one way or the other');
    assert.ok(Math.abs(fit.sw - fit.w) < 1 && Math.abs(fit.sh - fit.h) < 1, 'the slide is drawn at that size');
    assert.equal(await page.$eval('#prCount', e => e.textContent), '1 / 5');
    // nothing on a presented slide can be typed into
    assert.equal(await page.$$eval('#prFit .ls-ed, #prFit [contenteditable]', e => e.length), 0);

    await page.keyboard.press('ArrowRight'); await page.keyboard.press(' '); await page.keyboard.press('PageDown');
    assert.equal((await state(page)).i, 3);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.$eval('#prCount', e => e.textContent), '3 / 5');
    // text on the slide is as big as the lesson says: 36 pt here, on the slide's own 1280-wide scale
    assert.equal(await page.$eval('#prFit .ls-body', e => parseFloat(e.style.fontSize)), 48);
    // a click on the slide goes on; a number and Enter goes to that slide
    await page.$eval('#prFit', e => e.click());
    assert.equal((await state(page)).i, 3);
    await page.keyboard.press('2'); await page.keyboard.press('Enter');
    assert.equal((await state(page)).i, 1);
    assert.equal((await state(page)).far, 3, 'the furthest slide shown is remembered');

    // B blanks the screen and any key brings the slide back, on the same slide
    await page.keyboard.press('b');
    assert.equal(await page.$eval('#prCover', e => !e.hidden && e.textContent === ''), true);
    await page.keyboard.press('ArrowRight');
    assert.deepEqual([(await state(page)).blank, (await state(page)).i], [false, 1]);
    // N shows the speaker notes under the slide, and the slide makes room
    await page.keyboard.press('3'); await page.keyboard.press('Enter'); await page.keyboard.press('n');
    assert.equal(await page.$eval('#prNotes', e => e.hidden ? '' : e.textContent), 'Read it twice.');
    assert.ok(await page.evaluate(() => document.querySelector('#prFit').getBoundingClientRect().bottom <= document.querySelector('#prNotes').getBoundingClientRect().top + 1));
    await page.keyboard.press('n');

    // past the last slide: an end screen, then out. The lesson opens on the slide she stopped at.
    await page.keyboard.press('End'); await page.keyboard.press('ArrowRight');
    assert.match(await page.$eval('#prCover', e => e.textContent), /End of the lesson/);
    await page.keyboard.press('ArrowLeft');
    assert.deepEqual([(await state(page)).ended, (await state(page)).i], [false, 4]);
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('#present'));
    assert.equal(await page.evaluate(() => window.__planner.L.cur), 3);
    // not a key reached the lesson behind, and nothing asks about a lesson that isn't on a class today
    assert.equal(await page.evaluate(() => JSON.stringify(window.__planner.L.open.slides)), before);
    assert.equal(await page.$eval('#dlg', d => d.hidden), true);
    // Present starts from the slide that is open
    await present(page);
    assert.equal((await state(page)).i, 3);
    await page.$eval('[data-p="end"]', b => b.click());
    await until(page, () => !document.querySelector('#present'));
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});

test('the agenda can be pulled up on any slide and ticked off; a lesson with none lists its slides', async () => {
  const a = await open();
  try {
    const { page } = a;
    await seed(page);
    await present(page);
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('a');
    assert.equal(await page.$eval('#prAgenda h2', e => e.textContent), 'Agenda');
    assert.deepEqual(await page.$$eval('#prAgenda .pr-ai .tx', e => e.map(x => x.textContent)), ['Warm-up', 'Read aloud', 'Exit ticket']);
    assert.equal(await page.$eval('#prAgenda .pr-asub', e => e.textContent), 'Twice', 'a smaller point sits under its item');
    assert.equal(await page.$eval('#prAgenda .pr-ai.now .tx', e => e.textContent), 'Warm-up');
    await page.$eval('#prAgenda [data-ag="0"]', b => b.click());
    assert.equal(await page.$eval('#prAgenda .pr-ai.done .tx', e => e.textContent), 'Warm-up');
    assert.equal(await page.$eval('#prAgenda .pr-ai.now .tx', e => e.textContent), 'Read aloud');
    // what the class reads off the agenda is as big as slide text: at least 28 pt on a 720-high slide
    const size = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#prAgenda .pr-ai')).fontSize) / innerHeight * 720 * 0.75);
    assert.ok(size >= 28, 'agenda items are ' + size.toFixed(1) + ' pt');
    // the class's time, from the timetable
    assert.match(await page.$eval('#prAClock', e => e.textContent), /^\d{1,2}:\d\d · (\d+ min left|class ended at )/);
    assert.equal((await state(page)).slot.classId, 'A1', 'the class meeting now is the one being taught');
    // the slide under the agenda is the same slide, and the ticks stay while she moves on
    await page.keyboard.press('a'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('a');
    assert.deepEqual([(await state(page)).i, (await state(page)).ticks], [3, [0]]);
    await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('#present'));

    // no agenda slide: the same key lists the slides, and a click goes to one
    await page.evaluate(() => { const P = window.__planner, l = P.L.open; l.slides = l.slides.filter(s => s.layout !== 'agenda'); P.openLessonForTest(l, 0); });
    await present(page);
    await page.keyboard.press('a');
    assert.deepEqual(await page.$$eval('#prAgenda .pr-ai .tx', e => e.map(x => x.textContent)), ['1. Reading a poem', '2. Read aloud', '3. Talk', '4. Exit ticket']);
    await page.$eval('#prAgenda [data-goto="2"]', b => b.click());
    assert.equal((await state(page)).i, 2);
    await page.keyboard.press('Escape');
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});

test('a timer the class can see counts down, pauses, and says when the time is up', async () => {
  const a = await open();
  try {
    const { page } = a;
    await seed(page, { noSlot: true });
    await present(page);
    // T, then a number: that many minutes
    await page.keyboard.press('t');
    assert.deepEqual(await page.$$eval('#prMenu [data-tm]', b => b.map(x => x.textContent)), ['1', '2', '3', '5', '10', '15']);
    await page.keyboard.press('5');
    assert.equal(await page.$eval('#prMenu', m => m.hidden), true);
    assert.match(await page.$eval('#prChip', c => c.hidden ? '' : c.textContent), /^(5:00|4:59)$/);
    assert.equal((await state(page)).i, 0, 'the number started the timer and did not move the slide');
    // a click on it pauses; the slides still move
    await page.$eval('#prChip', c => c.click());
    const held = await page.$eval('#prChip', c => c.textContent);
    assert.match(held, /Paused/);
    await page.keyboard.press('ArrowRight'); await wait(1300);
    assert.equal(await page.$eval('#prChip', c => c.textContent), held);
    assert.equal((await state(page)).i, 1);
    // the menu now runs the timer: one more minute, ten seconds less, + and − by the minute, back to the start, then stop
    await page.keyboard.press('t');
    assert.match(await page.$eval('#prMenu h3', h => h.textContent), /started at 5:00/);
    await page.$eval('#prMenu [data-ta="60"]', b => b.click());
    const sec = () => page.$eval('#prChip', c => { const m = c.textContent.match(/^(\d+):(\d\d)/); return +m[1] * 60 + +m[2]; });
    const t0 = await sec();
    assert.ok(t0 >= 358 && t0 <= 360, 'one minute more: ' + t0);
    await page.$eval('#prMenu [data-ta="-10"]', b => b.click());
    assert.equal(await sec(), t0 - 10);
    await page.keyboard.press('-');
    assert.equal(await sec(), t0 - 70);
    await page.keyboard.press('+');
    assert.equal(await sec(), t0 - 10);
    assert.match(await page.$eval('#prChip', c => c.textContent), /Paused$/, 'still paused after the changes');
    await page.$eval('#prMenu [data-p="trestart"]', b => b.click());
    assert.match(await page.$eval('#prChip', c => c.textContent), /^(5:00|4:59)$/, 'restart goes back to 5:00, running');
    // big in the middle of the screen, and the choice is kept
    await page.$eval('#prBigC', c => c.click());
    assert.equal(await page.$eval('#prChip', c => c.classList.contains('big')), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('gsp.presentBig')), '1');
    await page.$eval('#prBigC', c => c.click());
    assert.equal(await page.$eval('#prChip', c => c.classList.contains('big')), false);
    await page.$eval('#prMenu [data-p="tstop"]', b => b.click());
    // minutes and seconds typed in: 1 min 45 sec, and the menu remembers it next time
    assert.equal(await page.$eval('#prMenu [data-ts]', b => b.textContent), '0:30');
    await page.$eval('#prOwn', i => { i.value = '1'; }); await page.$eval('#prOwnS', i => { i.value = '45'; });
    await page.$eval('#prMenu [data-p="town"]', b => b.click());
    assert.match(await page.$eval('#prChip', c => c.textContent), /^(1:45|1:44)$/);
    assert.equal(await page.evaluate(() => localStorage.getItem('gsp.presentOwn')), '105');
    await page.keyboard.press('t');
    await page.$eval('#prMenu [data-p="tstop"]', b => b.click());
    assert.deepEqual(await page.$eval('#prOwn', i => i.value), '1');
    assert.deepEqual(await page.$eval('#prOwnS', i => i.value), '45');
    // taking away more than is left ends it
    await page.$eval('#prMenu [data-ts]', b => b.click());
    await page.keyboard.press('-');
    await until(page, () => /Time’s up/.test(document.querySelector('#prChip').textContent));
    await page.$eval('#prChip', c => c.click());
    await page.keyboard.press('t');
    assert.equal(await page.$eval('#prChip', c => c.hidden), true);
    await page.keyboard.press('Escape');   // closes the menu, not the lesson
    assert.equal((await state(page)).on, true);
    // a short one runs out
    await page.evaluate(() => window.__present.timer(1));
    await until(page, () => /Time’s up/.test(document.querySelector('#prChip').textContent));
    assert.equal(await page.$eval('#prChip', c => c.classList.contains('done')), true);
    await page.$eval('#prChip', c => c.click());
    assert.equal(await page.$eval('#prChip', c => c.hidden), true);
    // the sound can be turned off, and the choice is the Planner's own
    await page.keyboard.press('t');
    await page.$eval('#prSnd', c => c.click());
    assert.equal(await page.evaluate(() => localStorage.getItem('gsp.presentSound')), '0');
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('#present'));
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});

test('after a lesson is taught, one line says where the class got to, and it stays with the lesson', async () => {
  const a = await open();
  try {
    const { page } = a;
    const { id, today } = await seed(page);
    assert.match(await page.$eval('#plTaught', e => e.textContent), /Nothing noted yet/);
    await present(page);
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('a');
    await page.$eval('#prAgenda [data-ag="0"]', b => b.click()); await page.$eval('#prAgenda [data-ag="1"]', b => b.click());
    await page.keyboard.press('a'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft');
    // a look of a few seconds asks nothing
    await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('#present') && !document.fullscreenElement && !window.__present.PR.on);
    assert.equal(await page.$eval('#dlg', d => d.hidden), true);
    // a lesson that ran: the question comes with the furthest slide already picked
    await page.evaluate(() => window.__planner.openLessonForTest(window.__planner.L.open, 0));
    await present(page);
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await until(page, () => window.__present.PR.i === 2 && window.__present.PR.far === 3);
    await page.keyboard.press('a');
    await until(page, () => window.__present.PR.agenda);
    await tick(page, 0); await tick(page, 1);
    assert.deepEqual(await page.evaluate(() => [...window.__present.PR.ticks].sort()), [0, 1], 'two agenda items ticked before finishing');
    await page.evaluate(() => { window.__present.PR.began -= 10 * 60 * 1000; });
    await page.keyboard.press('Escape');
    await until(page, s => !!document.querySelector(s), '#tgN');
    assert.equal(await page.$eval('#dlgBox h2', h => h.textContent), 'Where did the class get to?');
    assert.equal(await page.$eval('#tgS', s => s.selectedOptions[0].textContent), 'Slide 4 · Talk');
    assert.equal(await page.$eval('#tgC', s => s.selectedOptions[0].textContent.split(' · ')[0]), 'Course A-1');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'tgN');
    await page.type('#tgN', 'Start with the exit ticket');
    await page.keyboard.press('Enter');
    await until(page, () => document.querySelector('#dlg').hidden && /Start with the exit ticket/.test(document.querySelector('#plTaught').textContent));
    const row = await page.$eval('#plTaught .pl-tg', e => e.textContent);
    assert.match(row, /Course A-1 · \w{3} \d+\/\d+got to slide 4 of 5 · agenda 2 of 3Start with the exit ticket/);

    // kept in the Planner's own database, in the lesson's file for the Planner folder, and in the text for Claude
    const kept = await page.evaluate(id => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('lessons').objectStore('lessons').get(id); q.onsuccess = () => res(q.result.taught); }; }), id);
    assert.equal(kept.length, 1);
    assert.deepEqual({ ...kept[0], at: 0 }, { classId: 'A1', date: today, slide: 4, of: 5, note: 'Start with the exit ticket', at: 0, agenda: [2, 3] });
    const out = await page.evaluate(() => { const P = window.__planner, l = P.L.open; return { file: P.lessonForFile(l, null).taught.length, text: P.lessonText(l), again: P.normLesson(JSON.parse(JSON.stringify(l))).taught.length }; });
    assert.equal(out.file, 1); assert.equal(out.again, 1);
    assert.match(out.text, /Taught: Course A-1, \w+ \w+ \d+\w\w \d{4}: got to slide 4 of 5 \(agenda: 2 of 3 done\)\. Note: Start with the exit ticket/);

    // the other section, noted by hand: finished
    await page.$eval('[data-pr="note"]', b => b.click());
    await until(page, s => !!document.querySelector(s), '#tgC');
    await page.select('#tgC', '1'); await page.select('#tgS', '5');
    await page.$eval('#dlgBox [data-ok]', b => b.click());
    await until(page, () => document.querySelectorAll('#plTaught .pl-tg').length === 2);
    assert.match(await page.$$eval('#plTaught .pl-tg', r => r[1].textContent), /Course A-2 · .*finished all 5 slides/);

    // on the week: each class's card says where it got to, and today's card can be presented from there
    await page.evaluate(() => { window.__planner.L.backTo = 'week'; document.querySelector('[data-a="back"]').click(); });
    await until(page, s => !!document.querySelector(s), '.ls-grid .pl-taught');
    assert.deepEqual((await page.$$eval('.ls-grid .pl-taught', c => c.map(x => x.textContent))).sort(), ['Taught · finished', 'Taught · to slide 4 of 5']);
    assert.equal(await page.$$eval('.ls-grid .ls-go', b => b.length), 2);
    // presenting it again for the class that stopped partway picks up on that slide, and says so
    await page.$eval('.ls-go[data-c="A1"]', b => b.click());
    await until(page, s => !!document.querySelector(s), '#present');
    assert.equal((await state(page)).i, 3);
    assert.match(await page.$eval('#prHint', h => h.textContent), /Picking up at slide 4, where Course A-1 stopped/);
    await page.keyboard.press('Home');
    assert.equal((await state(page)).i, 0);
    await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('#present'));
    // the class that finished starts at the beginning
    await page.$eval('.ls-go[data-c="A2"]', b => b.click());
    await until(page, s => !!document.querySelector(s), '#present');
    assert.equal((await state(page)).i, 0);
    await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('#present'));

    // a note can be changed or taken away (with Undo), a copy for another class starts with none, and going back to
    // an older version of the slides leaves the notes as they are
    await page.evaluate(id => { const P = window.__planner; P.openLessonForTest(P.L.lessons.find(l => l.id === id), 0); }, id);
    await page.$eval('#plTaught [data-pr="tedit"]', b => b.click());
    await until(page, s => !!document.querySelector(s), '#tgN');
    assert.equal(await page.$eval('#tgN', i => i.value), 'Start with the exit ticket');
    await page.$eval('#tgN', i => { i.value = 'Exit ticket first'; });
    await page.$eval('#dlgBox [data-ok]', b => b.click());
    await until(page, () => /Exit ticket first/.test(document.querySelector('#plTaught').textContent));
    assert.equal(await page.$$eval('#plTaught .pl-tg', r => r.length), 2);
    await page.$$eval('#plTaught [data-pr="tdel"]', b => b[1].click());
    await until(page, () => document.querySelectorAll('#plTaught .pl-tg').length === 1);
    await page.$eval('.toast .link', b => b.click());
    await until(page, () => document.querySelectorAll('#plTaught .pl-tg').length === 2);
    const copy = await page.evaluate(async () => { const P = window.__planner, c = await P.copyLesson(P.L.open, null, 'A copy'); return 'taught' in c; });
    assert.equal(copy, false);
    // what comes in from a file is cleaned up: one note for each class and day, the slide within the deck
    const norm = await page.evaluate(() => window.__present.normTaught([{ classId: 'A1', date: '2026-11-03', slide: 9, of: 6, note: ' a\n b ' }, { classId: 'A1', date: '2026-11-03', slide: 2, of: 6 }, { date: 'soon' }, null, { classId: 'A2', date: '2026-11-02', slide: 0 }]));
    assert.deepEqual(norm.map(t => [t.classId, t.date, t.slide, t.of, t.note]), [['A2', '2026-11-02', 1, 1, ''], ['A1', '2026-11-03', 2, 6, '']]);
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});

test('planner.html#present/<lesson>/<class> opens the lesson presenting, for the class named', async () => {
  const a = await open();
  try {
    const { page, server } = a;
    const { id } = await seed(page);
    await page.goto(server.url + 'index.html?again#present/' + id + '/A2', { waitUntil: 'load' });
    await until(page, s => !!document.querySelector(s), '#present');
    const s = await state(page);
    assert.deepEqual([s.on, s.i, s.slot.classId], [true, 0, 'A2']);
    assert.match(await page.$eval('#prHint', h => h.textContent), /F for full screen/);
    assert.equal(await page.evaluate(() => location.hash), '', 'the address is tidied, so a refresh does not present again');
    await page.keyboard.press('Escape');
    await until(page, () => !document.querySelector('#present'));
    assert.equal(await page.evaluate(id => window.__planner.L.open && window.__planner.L.open.id === id, id), true, 'finishing lands in the lesson');
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});

test('while presenting, P picks a student from the class being taught and G deals groups; the names are shown and never kept', async () => {
  const a = await open();
  try {
    const { page } = a, A1 = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'], A2 = ['Nia Elsewhere', 'Omar Stand-in'];
    const { id } = await seed(page);
    // no rosters yet (the grading page has no class with students): P says so and the slides stay
    await page.$eval('.ls-go[data-id="' + id + '"], [data-pr="present"]', b => b.click());
    await until(page, s => !!document.querySelector(s), '#present');
    assert.ok(await page.$('#present [data-p="pick"]') && await page.$('#present [data-p="groups"]'), 'the bar has Pick a name and Groups');
    await page.keyboard.press('p');
    assert.match(await page.$eval('#prHint', h => h.textContent), /No rosters yet/);
    assert.equal(await page.$('#pkStage'), null);
    // the grading page's copy of the rosters. Its class is "Course A1"; the timetable's is "Course A-1": the same class.
    await page.evaluate((A1, A2) => { localStorage.setItem('gs.rolls', JSON.stringify([['Course A2', A2], ['Course A1', A1]])); window.__pick.PK.fast = true; }, A1, A2);
    await page.keyboard.press('p'); await until(page, s => !!document.querySelector(s), '#pkName.done');
    assert.equal((await state(page)).slot.classId, 'A1');
    assert.equal(await page.$eval('#pkClass', s => s.options[s.selectedIndex].textContent), 'Course A1');
    const got = [await page.$eval('#pkName', e => e.textContent)];
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Space'); got.push(await page.$eval('#pkName', e => e.textContent)); }
    assert.deepEqual(got.slice().sort(), A1.slice().sort(), 'four picks, the four students of the class being taught');
    assert.equal((await state(page)).i, 0, 'Space picked again; the slide did not move');
    // groups, in pairs
    await page.keyboard.press('g'); await until(page, s => !!document.querySelector(s), '#pkGroups');
    await page.keyboard.press('2');
    const groups = await page.$$eval('.pk-g', g => g.map(x => [...x.querySelectorAll('div')].map(d => d.textContent)));
    assert.deepEqual(groups.map(g => g.length), [2, 2]); assert.deepEqual(groups.flat().sort(), A1.slice().sort());
    // a click on it is not a click on the slide
    await page.$eval('.pk-g', g => g.click());
    assert.equal((await state(page)).i, 0);
    // the other class can be chosen
    await page.select('#pkClass', '0');
    assert.deepEqual((await page.$$eval('.pk-g div', d => d.map(x => x.textContent))).sort(), A2.slice().sort());
    // Escape closes it and the lesson is still on; the keys are the slides' again
    await page.keyboard.press('Escape');
    assert.equal(await page.$('#pkStage'), null);
    assert.equal((await state(page)).on, true);
    await page.keyboard.press('ArrowRight');
    assert.equal((await state(page)).i, 1);
    // opened from the bar, and finishing the lesson closes it too
    await page.$eval('#present [data-p="groups"]', b => b.click()); await until(page, s => !!document.querySelector(s), '#pkGroups');
    await page.evaluate(() => window.__present.end());
    await until(page, () => !document.querySelector('#present'));
    assert.equal(await page.$('#pkStage'), null);
    // no student's name is in the lesson, or anywhere in the Planner's own storage
    const kept = await page.evaluate(async () => {
      const P = window.__planner, db = await new Promise((ok, no) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
      let all = JSON.stringify(P.L.lessons);
      for (const s of [...db.objectStoreNames]) all += JSON.stringify(await new Promise((ok, no) => { const r = db.transaction(s).objectStore(s).getAll(); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }));
      db.close();
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k !== 'gs.rolls') all += localStorage.getItem(k); }
      return all;
    });
    for (const n of [...A1, ...A2]) assert.ok(!kept.includes(n) && !kept.includes(n.split(' ')[1]), n + ' is not kept by the Planner');
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});
