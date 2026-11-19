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
