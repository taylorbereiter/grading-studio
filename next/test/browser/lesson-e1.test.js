// Stage 8 slice E1: the lesson editor and its side panel, every control the audit found missing or different
// (rebuild/audit/gaps.md, E1 rows), pressed in the new app, with what it saves read back by the current Planner.
// Made-up lessons only (planseed.js). npm run next:browser.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { kit, wait, until } = require('./e1kit.js');
const K = kit();
before(K.start); after(K.stop);

test('E1-004 E1-005 E1-006 E1-007 E1-015 E1-016: a Video slide gets its link, where it starts, a Watch link, and can lose it again', async () => {
  const p = await K.fresh();
  await K.edit(p, 'L3', 2);
  await p.select('main [data-focus="layout"]', 'video');
  await p.waitForSelector('main [data-focus="video-link"]');
  assert.equal(await p.$eval('main [data-focus="video-link"]', b => b.textContent), 'Add video link');
  // Cancel leaves it as it was (E1-007)
  await p.click('main [data-focus="video-link"]');
  await K.focusIn(p, '.sheet');
  await p.evaluate(() => [...document.querySelectorAll('.sheet footer button')].find(b => b.textContent === 'Cancel').click());
  await p.waitForFunction(() => !document.querySelector('.sheet[open]'));
  // The link and the start (E1-004, E1-005), then Use this link (E1-007); clicking the video box on the slide opens the same sheet
  await p.click('main .ed-stagewrap .ls-slide [data-k="video"]');
  await K.focusIn(p, '.sheet');
  await p.type('.sheet [data-focus="video-url"]', 'youtube.com/watch?v=abcdefghijk');
  await p.type('.sheet [data-focus="video-start"]', '1:05');
  await p.click('.sheet [data-focus="video-use"]');
  const l = await until(async () => { const x = await K.lessonInDb(p, 'L3'); return x && x.slides[2].video && x; });
  assert.ok(l, 'the link is saved on the slide');
  assert.equal(l.slides[2].layout, 'video');
  assert.equal(l.slides[2].video.url, 'https://youtube.com/watch?v=abcdefghijk');
  assert.equal(l.slides[2].video.start, 65);
  // Change video (E1-015) and Watch (E1-016)
  await p.waitForFunction(() => document.querySelector('main [data-focus="video-link"]').textContent === 'Change video');
  assert.equal(await p.$eval('main [data-focus="video-watch"]', a => a.href), 'https://www.youtube.com/watch?v=abcdefghijk&t=65s');
  // Not a link: says so and keeps the sheet open
  await p.click('main [data-focus="video-link"]'); await K.focusIn(p, '.sheet');
  assert.equal(await p.$eval('.sheet [data-focus="video-start"]', i => i.value), '1:05', 'the start is shown as minutes:seconds');
  await p.focus('.sheet [data-focus="video-url"]'); await p.keyboard.down('Control'); await p.keyboard.press('a'); await p.keyboard.up('Control'); await p.keyboard.type('not a link');
  await p.click('.sheet [data-focus="video-use"]');
  await p.waitForFunction(() => document.body.textContent.includes('That doesn’t look like a link'));
  // Take the video off (E1-006)
  await p.click('.sheet [data-focus="video-off"]');
  const off = await until(async () => { const x = await K.lessonInDb(p, 'L3'); return x && !x.slides[2].video && x; });
  assert.ok(off, 'the video is taken off the slide');
  assert.deepEqual(p.errors, []);
  // The current Planner opens a slide with a link as its own
  await K.edit(p, 'L3', 2);
  await p.click('main [data-focus="video-link"]'); await K.focusIn(p, '.sheet');
  await p.type('.sheet [data-focus="video-url"]', 'https://example.org/film.mp4');
  await p.click('.sheet [data-focus="video-use"]');
  const mine = await until(async () => { const x = await K.lessonInDb(p, 'L3'); return x && x.slides[2].video && x; });
  for (const [k, [a, b]] of Object.entries(await K.sameInPlanner(p, 'L3', mine))) assert.deepEqual(a, b, k + ' reads the same in the current Planner');
  await p.ctx.close();
});

test('E1-009 E1-010 E1-029 E1-030 E1-031 E1-032: a lesson goes on another class and day, warns when that class does not meet, and comes off one', async () => {
  const p = await K.fresh();
  await K.open(p, 'lesson/L3');
  await p.waitForSelector('main .slotchip');
  assert.deepEqual(await p.$$eval('main .slotchip', x => x.map(e => e.dataset.slot)), ['A1|2026-10-29']);
  const menu = async name => { await p.click('main [data-focus="lesson-menu"]'); await p.waitForSelector('[role^="menuitem"]'); await K.item(p, name); };
  // Put it on another class or day (E1-010), then Cancel (E1-032)
  await menu('Put it on another class or day'); await p.waitForSelector('.sheet [data-focus="slot-class"]'); await K.focusIn(p, '.sheet');
  await p.evaluate(() => [...document.querySelectorAll('.sheet footer button')].find(b => b.textContent === 'Cancel').click());
  await p.waitForFunction(() => !document.querySelector('.sheet [data-focus="slot-class"]'));
  // A class and a day it doesn't meet: the warning (E1-029, E1-030, E1-031); a day it does: no warning
  await menu('Put it on another class or day'); await p.waitForSelector('.sheet [data-focus="slot-class"]'); await K.focusIn(p, '.sheet');
  await p.select('.sheet [data-focus="slot-class"]', 'A2');
  const day = async v => { await p.$eval('.sheet [data-focus="slot-date"]', (el, v) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }, v); await wait(150); };
  await day('2026-10-31');
  assert.match(await p.$eval('.sheet [data-focus="slot-warn"]', x => x.textContent), /doesn’t meet that day/);
  await day('2026-10-29');
  assert.equal(await p.$('.sheet [data-focus="slot-warn"]'), null, 'Grade 9 English B meets on Thursdays');
  await p.click('.sheet [data-focus="slot-add"]');
  const two = await until(async () => { const x = await K.lessonInDb(p, 'L3'); return x && x.slots.length === 2 && x; });
  assert.deepEqual(two.slots, [{ classId: 'A1', date: '2026-10-29' }, { classId: 'A2', date: '2026-10-29' }]);
  await p.waitForFunction(() => document.querySelectorAll('main .slotchip').length === 2);
  // Take it off one (E1-009)
  await menu('Take it off Grade 9 English, Thu');
  const one = await until(async () => { const x = await K.lessonInDb(p, 'L3'); return x && x.slots.length === 1 && x; });
  assert.deepEqual(one.slots, [{ classId: 'A2', date: '2026-10-29' }]);
  assert.deepEqual(p.errors, []);
  for (const [k, [a, b]] of Object.entries(await K.sameInPlanner(p, 'L3', one))) assert.deepEqual(a, b, k + ' reads the same in the current Planner');
  await p.ctx.close();
});

test('E1-008 E1-011 E1-012 E1-035 E1-040: back to the page it was opened from, saved state, planning time, name and title slide kept the same, Present from the slide being edited', async () => {
  const p = await K.fresh();
  await p.evaluate(() => localStorage.setItem('gsp.planTime', JSON.stringify({ days: { '2026-10-26': { a: { L3: 3900 } } }, names: { L3: 'Sonnets: the turn' } })));
  // Back goes to the page she came from (E1-008)
  await K.open(p, 'library');
  await p.evaluate(() => { location.hash = '#/lesson/L3'; });
  await p.waitForSelector('main [data-focus="lesson-back"]');
  assert.equal(await p.$eval('main [data-focus="lesson-back"]', a => a.getAttribute('href')), '#/library');
  await p.evaluate(() => { location.hash = '#/lesson/L3/edit'; });
  await p.waitForSelector('main [data-focus="save-state"]', { timeout: 10000 });
  // The stopped clock gives every save the same time; another window's save is told apart by its time, so let it move here.
  await p.evaluate(() => { const was = Date.now; let k = 0; Date.now = () => was() + (++k) * 1000; });
  // Planning time (E1-040) and Saved (E1-011)
  assert.equal(await p.$eval('main [data-focus="plan-time"]', x => x.textContent), '1 hr 5 min planning');
  assert.equal(await p.$eval('main [data-focus="save-state"]', x => x.textContent), 'Saved');
  // Name and title slide together (E1-035): typing the name changes the title slide
  const name = 'main .ed-top input';
  await p.click(name, { clickCount: 1 }); await p.keyboard.press('End'); await p.keyboard.type(' again');
  assert.equal(await p.$eval('main [data-focus="save-state"]', x => x.textContent), 'Saving…');
  await p.waitForFunction(() => document.querySelector('main [data-focus="save-state"]').textContent === 'Saved', { timeout: 5000 });
  let l = await until(async () => { const x = await K.lessonInDb(p, 'L3'); return x && x.title === 'Sonnets: the turn again' && x; });
  assert.equal(l.slides[0].title, 'Sonnets: the turn again', 'the title slide follows the name');
  await p.click('main [data-focus="lesson-menu"]'); await p.waitForSelector('[role^="menuitem"]');
  assert.equal(await p.evaluate(() => [...document.querySelectorAll('[role^="menuitem"]')].find(b => b.textContent.includes('Name matches the title slide')).getAttribute('aria-checked')), 'true');
  await K.item(p, 'Name matches the title slide');
  l = await until(async () => { const x = await K.lessonInDb(p, 'L3'); return x && x.titleApart && x; });
  assert.ok(l, 'unticked: kept apart, as the current Planner keeps it (titleApart)');
  await wait(400);
  await p.click(name); await p.keyboard.press('End'); await p.keyboard.type('!');
  l = await until(async () => { const x = await K.lessonInDb(p, 'L3'); return x && x.title.endsWith('!') && x; });
  assert.equal(l.slides[0].title, 'Sonnets: the turn again', 'the title slide stays as it was');
  // Present starts on the slide being edited (E1-012)
  await p.click('main .ed-list [data-slide-i="3"]'); await wait(200);
  await p.click('main [data-focus="present"]');
  await p.waitForSelector('.present .num');
  assert.equal(await p.$eval('.present .num', x => x.textContent), 'Slide 4 of 5');
  await p.keyboard.press('Escape');
  assert.deepEqual(p.errors, []);
  for (const [k, [a, b]] of Object.entries(await K.sameInPlanner(p, 'L3', l, ['title', 'slides', 'titleApart']))) assert.deepEqual(a, b, k + ' reads the same in the current Planner');
  await p.ctx.close();
});
