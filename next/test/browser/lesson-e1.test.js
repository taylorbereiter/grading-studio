// Stage 8 slice E1: the lesson editor and its side panel, every control the audit found missing or different
// (rebuild/audit/gaps.md, E1 rows), pressed in the new app, with what it saves read back by the current Planner.
// Made-up lessons only (planseed.js). npm run next:browser.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { kit, wait, until } = require('./e1kit.js');
const path = require('path');
const K = kit();
before(K.start); after(K.stop);
// Typing into a box in a sheet that is still opening can lose the first key to the sheet taking focus: the box is clicked, filled and
// read back, and filled again if a key went missing.
const typeIn = async (p, sel, text) => { for (let k = 0; k < 3; k++) { await p.click(sel); await p.$eval(sel, i => { i.select(); }); await p.keyboard.type(text); if (await p.$eval(sel, i => i.value) === text) return; } throw new Error('could not type in ' + sel); };

test('E1-004 E1-005 E1-006 E1-007 E1-015 E1-016: a Video slide gets its link, where it starts, a Watch link, and can lose it again', async () => {
  const p = await K.fresh();
  await K.edit(p, 'L3', 2);
  await p.click('main [data-focus="layout"]'); await pickLayout(p, 'video');
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
  await typeIn(p, '.sheet [data-focus="video-url"]', 'youtube.com/watch?v=abcdefghijk');
  await typeIn(p, '.sheet [data-focus="video-start"]', '1:05');
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
  // emptied first (a select-all by keys can miss under load, leaving the old link in front of the words)
  await p.$eval('.sheet [data-focus="video-url"]', i => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); });
  await typeIn(p, '.sheet [data-focus="video-url"]', 'not a link');
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
  await typeIn(p, '.sheet [data-focus="video-url"]', 'https://example.org/film.mp4');
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

// A drag in the page: what is dragged (files made in the page, and text by type) let go on an element.
const dragTo = (p, sel, { files = [], data = {}, from } = {}) => p.evaluate(async (sel, files, data, from) => {
  const dt = new DataTransfer();
  for (const f of files) { const b = f.b64 ? Uint8Array.from(atob(f.b64), c => c.charCodeAt(0)) : await new Promise(r => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; const g = c.getContext('2d'); g.fillStyle = f.color || '#36c'; g.fillRect(0, 0, 40, 30); c.toBlob(r, 'image/png'); }); dt.items.add(new File([b], f.name, { type: f.type || 'image/png' })); }
  for (const [k, v] of Object.entries(data)) dt.setData(k, v);
  if (from) document.querySelector(from).dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  const el = document.querySelector(sel);
  el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
  el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
}, sel, files, data, from);

test('E1-020 E1-025 E1-026 E1-027: thumbnails drag to reorder; pictures and links dropped on the editor', async () => {
  const p = await K.fresh();
  await K.edit(p, 'L3');
  const slides = async () => (await K.lessonInDb(p, 'L3')).slides;
  const ids = (await slides()).map(s => s.id);
  // A thumbnail dropped on another moves there (E1-020, E1-025)
  assert.equal(await p.$eval('main .ed-list [data-slide-i="3"]', b => b.draggable), true);
  await dragTo(p, 'main .ed-list [data-slide-i="1"]', { from: 'main .ed-list [data-slide-i="3"]' });
  let s = await until(async () => { const x = await slides(); return x[1].id === ids[3] && x; });
  assert.deepEqual(s.map(x => x.id), [ids[0], ids[3], ids[1], ids[2], ids[4]]);
  // Two pictures dropped on the Warm-up thumbnail: text + picture there, and a picture slide after it (E1-026)
  const warm = s.findIndex(x => x.title === 'Warm-up');
  await dragTo(p, 'main .ed-list [data-slide-i="' + warm + '"]', { files: [{ name: 'a.png' }, { name: 'b.png', color: '#c63' }] });
  s = await until(async () => { const x = await slides(); return x.length === 6 && x; });
  assert.equal(s[warm].layout, 'textpic', 'text already on the slide stays, with the picture beside it');
  assert.match(s[warm].img.src, /^data:image\/jpeg;base64,/);
  assert.equal(s[warm + 1].layout, 'picture'); assert.ok(s[warm + 1].img);
  await p.waitForFunction(() => document.body.textContent.includes('2 pictures, one on each slide'));
  // From another tab: a YouTube link makes a video slide after the one in view; a picture comes in by its address (E1-027)
  await p.click('main .ed-list [data-slide-i="0"]'); await wait(150);
  await dragTo(p, 'main .ed-stagewrap', { data: { 'text/uri-list': 'https://www.youtube.com/watch?v=abcdefghijk' } });
  s = await until(async () => { const x = await slides(); return x.length === 7 && x; });
  assert.equal(s[1].layout, 'video'); assert.equal(s[1].video.url, 'https://www.youtube.com/watch?v=abcdefghijk');
  const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 20; c.height = 20; return c.toDataURL('image/png'); });
  await dragTo(p, 'main .ed-stagewrap', { data: { 'text/html': '<img src="' + png + '">' } });
  s = await until(async () => { const x = await slides(); return x.length === 8 && x; });
  assert.equal(s[2].layout, 'picture'); assert.ok(s[2].img, 'a picture slide after the video slide');
  // A plain web link where there is no video slide: says where links go
  await p.click('main .ed-list [data-slide-i="0"]'); await wait(150);
  await dragTo(p, 'main .ed-stagewrap', { data: { 'text/uri-list': 'https://example.org/page' } });
  await p.waitForFunction(() => document.body.textContent.includes('Links go on a Video slide'));
  assert.deepEqual(p.errors, []);
  const mine = await K.lessonInDb(p, 'L3');
  for (const [k, [a, b]] of Object.entries(await K.sameInPlanner(p, 'L3', mine))) assert.deepEqual(a, b, k + ' reads the same in the current Planner');
  await p.ctx.close();
});

test('E1-028 E1-038: a picture or a YouTube link pasted into the editor, and the picture box on the slide chooses a picture', async () => {
  const p = await K.fresh();
  await K.edit(p, 'L3', 4);
  const slides = async () => (await K.lessonInDb(p, 'L3')).slides;
  const paste = (data, pic) => p.evaluate(async (data, pic) => {
    const dt = new DataTransfer(); for (const [k, v] of Object.entries(data)) dt.setData(k, v);
    if (pic) { const b = await new Promise(r => { const c = document.createElement('canvas'); c.width = 30; c.height = 20; c.toBlob(r, 'image/png'); }); dt.items.add(new File([b], 'clip.png', { type: 'image/png' })); }
    document.body.focus(); document.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
  }, data, pic);
  // A picture pasted on the exit ticket (which can't hold one): a picture slide after it (E1-028)
  await paste({}, true);
  let s = await until(async () => { const x = await slides(); return x.length === 6 && x; });
  assert.equal(s[5].layout, 'picture'); assert.ok(s[5].img);
  // A YouTube link pasted: a video slide
  await paste({ 'text/plain': 'https://youtu.be/abcdefghijk' });
  s = await until(async () => { const x = await slides(); return x.length === 7 && x; });
  assert.equal(s[6].layout, 'video');
  // Clicking the empty picture box on a picture slide chooses a picture (E1-038)
  await p.click('main .ed-list [data-slide-i="1"]'); await wait(150);
  await p.click('main [data-focus="layout"]'); await pickLayout(p, 'picture'); await wait(300);
  const [chooser] = await Promise.all([p.waitForFileChooser({ timeout: 5000 }), p.click('main .ed-stagewrap .ls-slide [data-k="img"]')]);
  const f = require('path').join(require('os').tmpdir(), 'gs-e1-pic-' + process.pid + '.png');
  require('fs').writeFileSync(f, Buffer.from(await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 24; c.height = 24; return c.toDataURL('image/png').split(',')[1]; }), 'base64'));
  await chooser.accept([f]);
  s = await until(async () => { const x = await slides(); return x[1].img && x; });
  require('fs').unlinkSync(f);
  assert.equal(s[1].layout, 'picture'); assert.match(s[1].img.src, /^data:image\/jpeg/);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E1-053: a finished .pptx dropped on the lesson page becomes its Finished PowerPoint', async () => {
  const { SETUP, LESSONS } = require('./planseed.js');
  const E = await import('../../src/engines/planner.js');
  E.L.setup = SETUP; E.L.lessons = LESSONS; E.L.units = [];
  const deck = JSON.parse(JSON.stringify(LESSONS[2])); deck.slides = deck.slides.slice(0, 3); deck.slides[1].title = 'From the finished deck';
  const b64 = Buffer.from(E.buildPptx(deck)).toString('base64');
  const p = await K.fresh();
  await K.open(p, 'lesson/L3');
  await p.waitForSelector('main .lside');
  await dragTo(p, 'main .lv', { files: [{ name: 'Sonnets final.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', b64 }] });
  const l = await until(async () => { const x = await K.lessonInDb(p, 'L3'); return x && x.final && x; }, 10000);
  assert.ok(l, 'the finished deck is kept');
  assert.equal(l.final.name, 'Sonnets final.pptx');
  assert.equal(l.slides.length, 3); assert.match(l.slides[1].title, /From the finished deck/);
  assert.deepEqual(p.errors, []);
  for (const [k, [a, b2]] of Object.entries(await K.sameInPlanner(p, 'L3', l, ['slides', 'final']))) assert.deepEqual(a, b2, k + ' reads the same in the current Planner');
  await p.ctx.close();
});

// Stage 8 E1 (4): the layout gallery, moving between slides, comments, the overflow warning, strong examples onto slides.
const pickLayout = async (p, k) => { await p.waitForSelector('.sheet [data-layout="' + k + '"]'); await p.click('.sheet [data-layout="' + k + '"]'); await p.waitForFunction(() => !document.querySelector('.sheet[open]')); };

test('E1-013 E1-014 E1-039: the layout gallery, grouped with small slides, changes this slide or adds one after it', async () => {
  const p = await K.fresh();
  await K.edit(p, 'L3', 2);
  assert.equal(await p.$eval('main [data-focus="layout"]', b => b.textContent), 'Layout: Title and text');
  await p.click('main [data-focus="layout"]');
  await p.waitForSelector('.sheet [data-layout]');
  assert.deepEqual(await p.$$eval('.sheet h3.sub', h => h.map(x => x.textContent)), ['Start and end', 'Teach and practice', 'Pictures and video']);
  assert.equal(await p.$$eval('.sheet [data-layout] .slidebox', s => s.length), 17, 'every layout drawn as a small slide');
  assert.equal(await p.$eval('.sheet [data-layout][aria-pressed="true"]', b => b.dataset.layout), 'content');
  await pickLayout(p, 'twocol');
  let l = await until(async () => { const x = await K.lessonInDb(p, 'L3'); return x && x.slides[2].layout === 'twocol' && x; });
  assert.ok(l, 'the slide is Two columns now'); assert.equal(l.slides[2].title, 'Warm-up', 'its words stay');
  // Add a slide with another layout (the current Planner's ▾ beside Add slide), from the slide's actions
  await p.click('main .ed-bar [aria-label="Slide actions"]'); await K.item(p, 'Add a slide with another layout');
  await pickLayout(p, 'exit');
  l = await until(async () => { const x = await K.lessonInDb(p, 'L3'); return x && x.slides.length === 6 && x; });
  assert.equal(l.slides[3].layout, 'exit', 'the new slide comes right after this one');
  assert.equal(await p.$eval('main .ed-list .th.on', b => b.dataset.slideI), '3');
  assert.deepEqual(p.errors, []);
  for (const [k, [a, b]] of Object.entries(await K.sameInPlanner(p, 'L3', l))) assert.deepEqual(a, b, k + ' reads the same in the current Planner');
  await p.ctx.close();
});

test('E1-017 E1-021 E1-023 E1-024: a box on the slide leads to its field, open comments are counted, Enter adds a comment, arrows move between slides', async () => {
  const L = JSON.parse(JSON.stringify(require('./planseed.js').LESSONS));
  L.find(x => x.id === 'L3').slides[1].talk = [{ by: 'you', text: 'Shorter?', at: 1792000000000 }, { by: 'claude', text: 'Maybe three items', at: 1792000000000 }, { by: 'you', text: 'Done', at: 1792000000000, done: true }];
  const p = await K.fresh(1366, L);
  await K.edit(p, 'L3', 0);
  // E1-021: the thumbnail says how many comments are open
  assert.equal(await p.$eval('main .ed-list [data-slide-i="1"] .thc', s => s.textContent.trim()), '2');
  assert.equal(await p.$eval('main .ed-list [data-slide-i="1"] .thc', s => s.title), '2 open comments');
  // E1-024: arrow keys and Page Down / Page Up when no box has the cursor
  await p.click('main .ed-list [data-slide-i="0"]');
  await p.keyboard.press('ArrowDown'); await p.waitForFunction(() => document.querySelector('main .ed-list .th.on').dataset.slideI === '1');
  await p.keyboard.press('PageDown'); await p.waitForFunction(() => document.querySelector('main .ed-list .th.on').dataset.slideI === '2');
  await p.keyboard.press('ArrowLeft'); await p.waitForFunction(() => document.querySelector('main .ed-list .th.on').dataset.slideI === '1');
  // E1-017: clicking the title on the slide puts the cursor in the title's field
  await p.click('main .ed-stagewrap .ls-slide [data-k="title"]');
  await p.waitForFunction(() => document.activeElement && document.activeElement.dataset.box === 'title');
  await p.keyboard.press('ArrowDown'); await wait(200);
  assert.equal(await p.$eval('main .ed-list .th.on', b => b.dataset.slideI), '1', 'arrows in a field stay in the field');
  // E1-023: Enter adds the comment, Shift+Enter is a new line in it
  await p.evaluate(() => [...document.querySelectorAll('main .talk button')].find(b => b.textContent === 'Add a comment').click());
  await p.waitForSelector('main .talk textarea'); await p.click('main .talk textarea');
  await p.keyboard.type('First line'); await p.keyboard.down('Shift'); await p.keyboard.press('Enter'); await p.keyboard.up('Shift'); await p.keyboard.type('second line'); await p.keyboard.press('Enter');
  const l = await until(async () => { const x = await K.lessonInDb(p, 'L3'); return x && x.slides[1].talk.length === 4 && x; });
  assert.ok(l, 'Enter added the comment'); assert.equal(l.slides[1].talk[3].text, 'First line\nsecond line');
  assert.deepEqual(p.errors, []);
  for (const [k, [a, b]] of Object.entries(await K.sameInPlanner(p, 'L3', l))) assert.deepEqual(a, b, k + ' reads the same in the current Planner');
  await p.ctx.close();
});

test('E1-022: the overflow warning offers the biggest size that fits', async () => {
  const L = JSON.parse(JSON.stringify(require('./planseed.js').LESSONS));
  Object.assign(L.find(x => x.id === 'L3').slides[2], { size: 36, body: Array.from({ length: 6 }, (_, i) => 'Line ' + (i + 1) + ' of the warm-up').join('\n') });
  const p = await K.fresh(1366, L);
  await K.edit(p, 'L3', 2);
  await p.waitForSelector('main .ed-warn [data-focus="fit"]');
  assert.equal(await p.$eval('main .ed-warn [data-focus="fit"]', b => b.textContent), 'Biggest that fits');
  await p.click('main .ed-warn [data-focus="fit"]');
  const l = await until(async () => { const x = await K.lessonInDb(p, 'L3'); return x && x.slides[2].size < 36 && x; });
  assert.ok(l, 'a smaller size is saved'); await wait(300);
  assert.equal(await p.$('main .ed-warn'), null, 'and the words fit');
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

// A made-up strong example of two pages, in the grading side's examples database, with plain pictures (no student work).
const twoPages = () => p => (async () => {
  const pic = async shade => { const c = document.createElement('canvas'); c.width = 600; c.height = 420; const x = c.getContext('2d'); x.fillStyle = shade; x.fillRect(0, 0, 600, 420); return new Promise(r => c.toBlob(r, 'image/jpeg', 0.8)); };
  const rec = { id: 'ex2', t: Date.now(), kind: 'paper', letter: 'B', why: 'Clear turn', tags: [], title: 'Sonnet response', cls: 'A1', asg: 'i1', marks: true, score: false, pages: [{ w: 600, h: 420 }, { w: 600, h: 420 }] };
  const db = await new Promise((res, rej) => { const r = indexedDB.open('grading-studio-examples', 1); r.onupgradeneeded = () => { r.result.createObjectStore('ex'); r.result.createObjectStore('pix'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const blobs = [await pic('#cfe0f1'), await pic('#dfe9d8')];
  await new Promise((res, rej) => { const tx = db.transaction(['ex', 'pix'], 'readwrite'); tx.objectStore('ex').put(rec, rec.id); blobs.forEach((b, i) => tx.objectStore('pix').put(b, rec.id + '|' + i)); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  db.close();
})();

test('E1-041 E1-042: a strong example’s pages onto slides, one page each, after this one', async () => {
  const p = await K.fresh();
  await p.evaluate(twoPages());
  await K.edit(p, 'L3', 1);
  await p.click('main .ed-bar [aria-label="Slide actions"]'); await K.item(p, 'Add a slide with another layout');
  await p.waitForSelector('.sheet [data-focus="ex-slides"]'); await p.click('.sheet [data-focus="ex-slides"]');
  await p.waitForSelector('.sheet .excard'); await p.click('.sheet .excard');
  await p.waitForSelector('.sheet .expages [data-page="1"]');
  assert.deepEqual(await p.$$eval('.sheet .expages button', b => b.map(x => x.getAttribute('aria-pressed'))), ['true', 'true'], 'every page is chosen to start');
  assert.equal(await p.$eval('.sheet [data-focus="use-example"]', b => b.textContent), 'Put on slides');
  await p.click('.sheet [data-focus="use-example"]');
  const l = await until(async () => { const x = await K.lessonInDb(p, 'L3'); return x && x.slides.length === 7 && x; });
  assert.ok(l, 'two slides added');
  assert.deepEqual(l.slides.slice(2, 4).map(s => [s.layout, s.img && s.img.src]), [['fullpic', 'gsex:ex2|0'], ['fullpic', 'gsex:ex2|1']]);
  assert.match(l.slides[2].title, /^Strong example: Example B$/);
  assert.match(l.slides[3].img.source, /Sonnet response · Example B, Page 2/);
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

test('H-005 H-016: the notebook keeps her words with the lesson she typed them in, even when she moves on at once', async () => {
  const p = await K.fresh();
  await K.open(p, 'lesson/L2');
  await p.click('main [data-focus="beside"]'); await p.waitForSelector('aside.beside [role=tab]');
  await p.evaluate(() => [...document.querySelectorAll('aside.beside [role=tab]')].find(x => x.textContent === 'Notebook').click());
  await p.waitForSelector('[data-nbpage][contenteditable="true"]');
  await p.click('[data-nbpage]'); await p.keyboard.type('Only for reading aloud');
  await p.evaluate(() => { location.hash = '#/lesson/L3'; });   // within half a second of the last key
  await p.waitForFunction(() => location.hash === '#/lesson/L3' && document.querySelector('[data-nbpage][contenteditable="true"]'), { timeout: 8000 }).catch(() => {});
  const two = await until(async () => { const x = await K.lessonInDb(p, 'L2'); return x && /Only for reading aloud/.test(x.notebook || '') && x; });
  assert.ok(two, 'the words are kept with the lesson they were typed in');
  await wait(800);
  const three = await K.lessonInDb(p, 'L3');
  assert.ok(!/Only for reading aloud/.test(three.notebook || ''), 'and never land in the next lesson');
  assert.ok(!/Only for reading aloud/.test(await p.$eval('[data-nbpage]', e => e.textContent)), 'the next lesson shows its own page');
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

// Stage 8 E1 (5): the Beside drawer's Activities, its width, and what can be dropped or pasted on it.
const beside = async (p, id, tab) => {
  await K.open(p, 'lesson/' + id);
  await p.click('main [data-focus="beside"]'); await p.waitForSelector('aside.beside [role=tab]');
  if (tab) { await p.evaluate(n => [...document.querySelectorAll('aside.beside [role=tab]')].find(x => x.textContent === n).click(), tab); await wait(300); }
};
const dropOn = (p, sel, { file, text }) => p.evaluate(async (sel, file, text) => {
  const dt = new DataTransfer();
  if (file) dt.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: file.type }));
  if (text) { dt.setData('text/uri-list', text); dt.setData('text/plain', text); }
  const el = document.querySelector(sel), r = el.getBoundingClientRect(), o = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 40, clientY: r.top + 80 };
  el.dispatchEvent(new DragEvent('dragover', o)); el.dispatchEvent(new DragEvent('drop', o));
}, sel, file, text);

test('E1-001 E1-064 E1-073 E1-074 E1-075 E1-076 E1-077: Beside has the activity bank, found, narrowed, opened and added after the slide she is on', async () => {
  const p = await K.fresh();
  await beside(p, 'L2');
  assert.deepEqual(await p.$$eval('aside.beside [role=tab]', b => b.map(x => x.textContent)), ['Books', 'Activities', 'Video', 'Unit', 'Notebook', 'Assistant']);
  await p.evaluate(() => [...document.querySelectorAll('aside.beside [role=tab]')].find(x => x.textContent === 'Activities').click());
  await p.waitForSelector('aside.beside .actlist');
  const all = await p.$$eval('aside.beside .actlist > li', x => x.length);
  // E1-077: a kind chip narrows the list
  await p.evaluate(() => [...document.querySelectorAll('aside.beside .chips button')].find(b => b.textContent === 'Reading').click()); await wait(200);
  const reading = await p.$$eval('aside.beside .actlist > li', x => x.length);
  assert.ok(reading > 0 && reading < all, 'Reading narrows the list');
  // E1-076: found by name
  await p.type('aside.beside [data-focus="find-activity"]', 'Poem relay'); await wait(200);
  assert.deepEqual(await p.$$eval('aside.beside .actlist .acth b', b => b.map(x => x.textContent)), ['Poem relay']);
  // E1-073: the row opens
  await p.click('aside.beside .acth'); await p.waitForSelector('aside.beside .actb');
  assert.match(await p.$eval('aside.beside .actb', x => x.textContent), /Hand each table one stanza/);
  // E1-075: Add to a lesson… lists the lessons coming up
  await p.click('aside.beside [data-act-use]'); await p.waitForSelector('.sheet .lrow');
  assert.ok((await p.$$eval('.sheet .lrow', r => r.length)) > 0);
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('.sheet[open]'));
  // E1-074 E1-001: Add after the slide I'm on
  await p.click('aside.beside [data-act-after]');
  const l = await until(async () => { const x = await K.lessonInDb(p, 'L2'); return x && x.slides.length === 6 && x; });
  assert.ok(l, 'a slide is added'); assert.equal(l.slides[1].title, 'Poem relay', 'right after the slide she is on');
  assert.deepEqual(p.errors, []);
  for (const [k, [a, b]] of Object.entries(await K.sameInPlanner(p, 'L2', l))) assert.deepEqual(a, b, k + ' reads the same in the current Planner');
  await p.ctx.close();
});

test('E1-063 E1-065 E1-066 E1-082: Beside is made wider at its edge, takes a dropped PDF or YouTube link, and a pasted YouTube link plays in the notebook', async () => {
  const p = await K.fresh();
  await beside(p, 'L2');
  // E1-063: drag the edge
  const w0 = await p.$eval('aside.beside', a => a.getBoundingClientRect().width), g = await p.$eval('aside.beside [data-grip]', e => { const r = e.getBoundingClientRect(); return { x: r.left + 3, y: r.top + 200 }; });
  await p.mouse.move(g.x, g.y); await p.mouse.down(); await p.mouse.move(g.x - 60, g.y, { steps: 4 }); await p.mouse.move(g.x - 120, g.y, { steps: 4 }); await p.mouse.up(); await wait(200);
  const w1 = await p.$eval('aside.beside', a => a.getBoundingClientRect().width);
  assert.ok(Math.abs(w1 - (w0 + 120)) < 4, 'the drawer is 120 px wider (' + w0 + ' to ' + w1 + ')');
  assert.equal(+(await p.evaluate(() => localStorage.getItem('gsn.besideW'))), Math.round(w1), 'and stays that wide');
  // E1-065: a PDF dropped on the drawer goes to Books
  await p.evaluate(() => [...document.querySelectorAll('aside.beside [role=tab]')].find(x => x.textContent === 'Notebook').click()); await wait(200);
  await dropOn(p, 'aside.beside .bhead', { file: { name: 'Poems for reading aloud.pdf', type: 'application/pdf', bytes: [...Buffer.from('%PDF-1.4\n%%EOF\n')] } });
  await p.waitForFunction(() => [...document.querySelectorAll('aside.beside [data-book] span')].some(s => s.textContent === 'Poems for reading aloud'), { timeout: 6000 });
  assert.equal(await p.$eval('aside.beside [role=tab][aria-selected="true"]', x => x.textContent), 'Books');
  // E1-066: a YouTube link dropped on it plays in Video
  await dropOn(p, 'aside.beside .bbody', { text: 'https://www.youtube.com/watch?v=abcdefghijk' });
  await p.waitForSelector('aside.beside .vidbox iframe[src*="abcdefghijk"]');
  // E1-082: a YouTube link pasted into the notebook becomes a player, kept with the lesson
  await p.evaluate(() => [...document.querySelectorAll('aside.beside [role=tab]')].find(x => x.textContent === 'Notebook').click());
  await p.waitForSelector('[data-nbpage][contenteditable="true"]'); await p.click('[data-nbpage]');
  await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', 'https://youtu.be/abcdefghijk?t=30'); document.querySelector('[data-nbpage]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  const l = await until(async () => { const x = await K.lessonInDb(p, 'L2'); return x && /nb-vid[^>]*data-yt="abcdefghijk"/.test(x.notebook || '') && x; });
  assert.ok(l, 'the notebook keeps the video'); assert.match(l.notebook, /data-t="30"/);
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

// Stage 8 E1 (6): the assistant box. Kept in kv "cbox" as the current Planner keeps it, so either app shows the same box.
const kvGet = (p, key) => p.evaluate(key => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => { r.result.close(); res(q.result); }; q.onerror = () => rej(q.error); }; }), key);
const tabTo = (p, name) => p.evaluate(n => [...document.querySelectorAll('aside.beside [role=tab]')].find(x => x.textContent === n).click(), name).then(() => wait(300));
const withFiles = () => { const L = JSON.parse(JSON.stringify(require('./planseed.js').LESSONS)); L.find(x => x.id === 'L2').files = [{ id: 'D1', name: 'Reading guide', kind: 'doc', type: 'text/html', size: 120, added: 1792000000000 }, { id: 'F1', name: 'Poem cards.pdf', kind: 'other', type: 'application/pdf', size: 900, added: 1792000000000 }]; return L; };
const putDoc = p => p.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(new Blob(['<h1>Reading guide</h1><p>Read each stanza twice.</p>'], { type: 'text/html' }), 'file:D1'); tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error); }; }));

test('E1-064 E1-068 E1-069 E1-070 E1-071 E1-072 E1-078 E1-081 E1-084 E1-085: the assistant box gathers a video, a unit week and the notebook, and copies them with what she asks', async () => {
  const p = await K.fresh();
  await p.ctx.overridePermissions(K.srv.url.replace(/\/$/, ''), ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  await beside(p, 'L2');
  assert.deepEqual(await p.$$eval('aside.beside [role=tab]', b => b.map(x => x.textContent)), ['Books', 'Activities', 'Video', 'Unit', 'Notebook', 'Assistant']);
  // E1-085: a video
  await tabTo(p, 'Video'); await p.type('aside.beside [data-focus="video-find"]', 'https://www.youtube.com/watch?v=abcdefghijk'); await p.click('aside.beside [data-focus="video-go"]');
  await p.waitForSelector('aside.beside [data-focus="video-to-box"]'); await p.click('aside.beside [data-focus="video-to-box"]');
  // E1-084: the unit week
  await tabTo(p, 'Unit'); await p.click('aside.beside [data-focus="week-to-box"]');
  // E1-081: the notebook
  await tabTo(p, 'Notebook'); await p.waitForSelector('[data-nbpage][contenteditable="true"]'); await p.click('[data-nbpage]'); await p.keyboard.type('Bring the poem cards');
  await p.click('aside.beside [data-focus="nb-to-box"]');
  await until(async () => { const b = await kvGet(p, 'cbox'); return b && b.chips.length === 3; });
  await tabTo(p, 'Assistant'); await p.waitForSelector('aside.beside .bchip');
  assert.deepEqual(await p.$$eval('aside.beside .bchip span[data-raw]', s => s.map(x => x.textContent)), ['Video: https://www.youtube.com/watch?v=abcdefghijk', 'Unit 2: Poetry, week 3 of 5', 'Notebook: Reading a poem aloud']);
  // E1-068: × takes one off
  await p.click('aside.beside [data-chip-x="1"]');
  await until(async () => { const b = await kvGet(p, 'cbox'); return b && b.chips.length === 2; });
  // E1-069 E1-070: what she wants (typed here; the box has its dictation button)
  assert.ok(await p.$('aside.beside .cbox button.mic') || !(await p.evaluate(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window)), 'dictation where the browser has it');
  await p.click('aside.beside [data-focus="box-text"]'); await p.keyboard.type('Make a warm-up from these');
  await until(async () => { const b = await kvGet(p, 'cbox'); return b && b.text === 'Make a warm-up from these'; });
  // E1-072: one copy of it all, self-contained
  await p.click('aside.beside [data-focus="box-copy"]');
  await p.waitForFunction(async () => (await navigator.clipboard.readText()).includes('[My notebook'), { timeout: 5000, polling: 200 });
  const text = await p.evaluate(() => navigator.clipboard.readText());
  assert.match(text, /^Make a warm-up from these\n\n\[Video\] https:\/\/www\.youtube\.com\/watch\?v=abcdefghijk\n\n\[My notebook: Reading a poem aloud\]\nBring the poem cards/);
  assert.doesNotMatch(text, /\/Users\/|~\/|[A-Z]:\\|Lessons\//, 'names no folder or file on her computer');
  // E1-071: Clear, and Undo brings it back
  await p.click('aside.beside [data-focus="box-clear"]');
  await until(async () => { const b = await kvGet(p, 'cbox'); return b && !b.chips.length && !b.text; });
  await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => /Undo/.test(b.textContent)).click());
  assert.ok(await until(async () => { const b = await kvGet(p, 'cbox'); return b && b.chips.length === 2; }), 'Undo puts the box back');
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

// A one-page PDF with a line of made-up text, built here.
function tinyPdf(text) {
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>'];
  const stream = 'BT /F1 18 Tf 30 100 Td (' + text + ') Tj ET';
  objs.push('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let out = '%PDF-1.4\n'; const at = [];
  objs.forEach((o, i) => { at.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const x = out.length; out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + at.map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}

test('E1-078 E1-079: a book page goes in the box by its button or by dragging it there, with its words', async () => {
  const p = await K.fresh();
  await p.ctx.overridePermissions(K.srv.url.replace(/\/$/, ''), ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  await beside(p, 'L2');
  const f = path.join(require('os').tmpdir(), 'e1-poems-' + process.pid + '.pdf'); require('fs').writeFileSync(f, tinyPdf('Stanza one is read slowly'));
  const input = await p.$('aside.beside input[data-addpdf]'); await input.uploadFile(f);
  await p.waitForSelector('aside.beside [data-book]'); await p.click('aside.beside [data-book]');
  await p.waitForSelector('aside.beside [data-focus="page-to-ai"]'); await wait(500);
  await p.click('aside.beside [data-focus="page-to-ai"]');
  await until(async () => { const b = await kvGet(p, 'cbox'); return b && b.chips.length === 1; });
  // E1-079: the page dragged onto the drawer
  await p.evaluate(() => { const dt = new DataTransfer(); document.querySelector('aside.beside canvas.pdfpage').dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    const el = document.querySelector('aside.beside .bbody'); for (const k of ['dragover', 'drop']) el.dispatchEvent(new DragEvent(k, { bubbles: true, cancelable: true, dataTransfer: dt })); });
  await until(async () => { const b = await kvGet(p, 'cbox'); return b && b.chips.length === 2; });
  await p.waitForSelector('aside.beside .bchip');
  assert.deepEqual(await p.$$eval('aside.beside .bchip span[data-raw]', s => s.map(x => x.textContent)), ['e1-poems-' + process.pid + ', page 1', 'e1-poems-' + process.pid + ', page 1']);
  await p.click('aside.beside [data-focus="box-copy"]');
  await p.waitForFunction(async () => (await navigator.clipboard.readText()).includes('Stanza'), { timeout: 8000, polling: 200 });
  const text = await p.evaluate(() => navigator.clipboard.readText());
  assert.match(text, /^\[e1-poems-\d+, page 1\]\nStanza one is read slowly\n\n\[e1-poems-\d+, page 1\]\nStanza one is read slowly/);
  require('fs').unlinkSync(f);
  assert.deepEqual(p.errors, []);
  await p.ctx.close();
});

test('E1-002 E1-046 E1-056 E1-067: a slide, a file and a document go in the box; what she wants on a slide is kept for the assistant', async () => {
  const p = await K.fresh(1366, withFiles());
  await p.ctx.overridePermissions(K.srv.url.replace(/\/$/, ''), ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  await putDoc(p);
  // E1-046: the slide's ask
  await K.edit(p, 'L2', 2);
  await p.click('main .ed-bar [aria-label="Slide actions"]'); await K.item(p, 'What I want on this slide');
  await p.waitForSelector('.sheet [data-focus="slide-ask"]'); await p.click('.sheet [data-focus="slide-ask"]'); await p.keyboard.type('A quick pair task here'); await p.click('.sheet [data-focus="ask-save"]');
  const l = await until(async () => { const x = await K.lessonInDb(p, 'L2'); return x && x.slides[2].ask === 'A quick pair task here' && x; });
  assert.ok(l, 'kept on the slide as ask');
  // E1-067: a thumbnail dragged onto Beside
  await p.click('main [data-focus="beside"]'); await p.waitForSelector('aside.beside [role=tab]');
  await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/x-slide', '2'); const el = document.querySelector('aside.beside .bbody'); for (const k of ['dragover', 'drop']) el.dispatchEvent(new DragEvent(k, { bubbles: true, cancelable: true, dataTransfer: dt })); });
  await p.waitForSelector('aside.beside .bchip');
  // E1-056: a file in Materials dragged onto Beside
  await K.open(p, 'lesson/L2'); await p.waitForSelector('main .mats .mopen');
  if (!(await p.$('aside.beside'))) { await p.click('main [data-focus="beside"]'); await p.waitForSelector('aside.beside [role=tab]'); }
  await p.evaluate(() => { const src = [...document.querySelectorAll('main .mats .mopen')].find(b => b.textContent.includes('Poem cards')); const dt = new DataTransfer(); src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    const el = document.querySelector('aside.beside .bbody'); for (const k of ['dragover', 'drop']) el.dispatchEvent(new DragEvent(k, { bubbles: true, cancelable: true, dataTransfer: dt })); });
  await until(async () => { const b = await kvGet(p, 'cbox'); return b && b.chips.length === 2; });
  // E1-002: a document's Add to the box
  await p.evaluate(() => [...document.querySelectorAll('main .mats .mopen')].find(b => b.textContent.includes('Reading guide')).click());
  await p.waitForSelector('.sheet [data-focus="doc-to-box"]'); await p.click('.sheet [data-focus="doc-to-box"]');
  await until(async () => { const b = await kvGet(p, 'cbox'); return b && b.chips.length === 3; });
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('.sheet[open]'));
  await tabTo(p, 'Assistant'); await p.waitForSelector('aside.beside .bchip');
  assert.deepEqual(await p.$$eval('aside.beside .bchip span[data-raw]', s => s.map(x => x.textContent)), ['Reading a poem aloud, slide 3: Warm-up', 'Poem cards.pdf', 'Reading guide']);
  await p.click('aside.beside [data-focus="box-copy"]');
  await p.waitForFunction(async () => (await navigator.clipboard.readText()).includes('[Document'), { timeout: 5000, polling: 200 });
  const text = await p.evaluate(() => navigator.clipboard.readText());
  assert.match(text, /\[Slide 3 of "Reading a poem aloud" \(.+\)\]\nTitle: Warm-up/);
  assert.match(text, /\[File: Poem cards\.pdf\]/); assert.match(text, /\[Document: Reading guide\]\nReading guide\s+Read each stanza twice\./);
  assert.deepEqual(p.errors, []);
  for (const [k, [a, b]] of Object.entries(await K.sameInPlanner(p, 'L2', l))) assert.deepEqual(a, b, k + ' reads the same in the current Planner');
  // The current Planner shows the same box
  const theirs = await p.evaluate(() => window.__planner && window.__planner.L ? true : false); assert.ok(theirs);
  await p.ctx.close();
});

const withTalk = () => { const L = JSON.parse(JSON.stringify(require('./planseed.js').LESSONS)), l = L.find(x => x.id === 'L2');
  l.talk = [{ by: 'you', text: 'Shorter overall?', at: 1792000000000 }];
  l.slides[2].talk = [{ by: 'claude', text: 'Cut the second bullet?', at: 1792000000000 }, { by: 'you', text: 'Old note', at: 1792000000000, done: true }];
  return L; };
test('E1-034 E1-047 E1-048 E1-049 E1-050: every comment in one list, ticked Done or opened again, done ones shown on asking, and a slide opened from it', async () => {
  const p = await K.fresh(1366, withTalk());
  await K.open(p, 'lesson/L2');
  await p.click('main [data-focus="lesson-menu"]'); await p.waitForSelector('[role^="menuitem"]'); await K.item(p, 'All comments');
  await p.waitForSelector('.sheet [data-cgo]');
  const heads = await p.$$eval('.sheet [data-cgo]', bs => bs.map(b => b.dataset.cgo + ' ' + b.textContent.trim()));
  assert.deepEqual(heads, ['-1 The whole lesson', '2 Slide 3: Warm-up'], 'the whole lesson first, then each slide with comments');
  assert.equal(await p.$$eval('.sheet .cmt', d => d.length), 2, 'the done one is hidden');
  await p.click('[data-focus="show-done"]');
  assert.equal(await p.$$eval('.sheet .cmt', d => d.length), 3, 'Show done shows it');
  await p.click('[data-cdone="2:0"]');
  assert.ok(await until(async () => { const l = await K.lessonInDb(p, 'L2'); return l.slides[2].talk[0].done === true; }), 'Done is saved on the comment');
  await p.click('[data-cdone="2:1"]');
  assert.ok(await until(async () => { const l = await K.lessonInDb(p, 'L2'); return !('done' in l.slides[2].talk[1]); }), 'Open again takes Done off');
  await p.click('[data-cgo="2"]');
  await p.waitForSelector('main .editor .ed-form', { timeout: 10000 });
  assert.ok(await until(() => p.$eval('main .ed-list [data-slide-i="2"]', b => b.getAttribute('aria-current') === 'true' || b.classList.contains('on') || b.getAttribute('aria-selected') === 'true').catch(() => false)), 'the slide opens in Edit');
  const mine = await K.lessonInDb(p, 'L2'), both = await K.sameInPlanner(p, 'L2', mine, ['slides']);
  assert.deepEqual(both.slides[0].map(s => s.talk), both.slides[1].map(s => s.talk), 'the current Planner reads the same comments');
  assert.deepEqual(p.errors, []);
  await p.close();
});

const withPending = () => { const L = JSON.parse(JSON.stringify(require('./planseed.js').LESSONS)), l = L.find(x => x.id === 'L3');
  const before = JSON.parse(JSON.stringify(l.slides));
  l.slides[2].title = 'Warm-up, shorter'; l.slides[2].talk = [{ by: 'claude', text: 'Made it one bullet.', at: 1792000000000 }];
  l.slides.splice(4, 1); l.slides.push({ ...JSON.parse(JSON.stringify(before[4])), id: 'L3new', title: 'Exit ticket, two words' });
  l.pending = { at: 1792000000000, before, title: l.title };
  return L; };
test('E1-043 E1-044 E1-045: the assistant\'s changes slide by slide, Keep mine or theirs on each, All mine, All theirs, Later and Done', async () => {
  const p = await K.fresh(1366, withPending());
  await K.open(p, 'lesson/L3');
  await p.waitForSelector('[data-arrived-look]', { timeout: 10000 });
  await p.click('[data-arrived-look]');
  await p.waitForSelector('.sheet [data-crow]');
  const heads = await p.$$eval('.sheet [data-crow] h3', h => h.map(x => x.textContent));
  assert.equal(heads.length, 3); assert.match(heads[0], /Slide 3 changed/); assert.match(heads[1], /added a slide/); assert.match(heads[2], /took out a slide/);
  assert.equal(await p.$$eval('.sheet .cside.on input[data-cpick$=":ai"]', i => i.length), 3, 'theirs picked on each to start');
  await p.click('[data-call="mine"]');
  assert.equal(await p.$$eval('.sheet .cside.on input[data-cpick$=":mine"]', i => i.length), 3, 'All mine');
  await p.click('[data-call="ai"]');
  assert.equal(await p.$$eval('.sheet .cside.on input[data-cpick$=":ai"]', i => i.length), 3, 'All theirs');
  await p.click('[data-clater]');
  assert.ok(await until(async () => !(await p.$('.sheet [data-crow]'))), 'Later closes it');
  assert.ok((await K.lessonInDb(p, 'L3')).pending, 'and the lesson still waits for review');
  await p.click('[data-arrived-look]');
  await p.waitForSelector('.sheet [data-crow]');
  await p.click('.sheet [data-crow="0"] .cside:first-child');   // Keep mine on the changed slide
  await p.click('.sheet [data-crow="2"] .cside:first-child');   // put the taken-out one back
  await p.click('[data-cmpdone]');
  assert.ok(await until(async () => !(await K.lessonInDb(p, 'L3')).pending), 'Done clears the review');
  const l = await K.lessonInDb(p, 'L3');
  assert.deepEqual(l.slides.map(s => s.id), ['L3s0', 'L3s1', 'L3s2', 'L3s3', 'L3s4', 'L3new'], 'the taken-out slide is back after the one before it; the added one stays');
  assert.equal(l.slides[2].title, 'Warm-up', 'hers is back on the changed slide');
  assert.equal(l.slides[2].talk[0].text, 'Made it one bullet.', 'its comments stay either way');
  assert.ok(await until(() => p.evaluate(() => [...document.querySelectorAll('.toast')].some(x => /Kept yours on 2/.test(x.textContent)))), 'what was kept is said');
  const both = await K.sameInPlanner(p, 'L3', l, ['slides', 'pending']);
  assert.deepEqual(both.slides[0].map(s => [s.id, s.title]), both.slides[1].map(s => [s.id, s.title]));
  assert.equal(both.pending[0], undefined);
  assert.deepEqual(p.errors, []);
  await p.close();
});

const withTaught = () => { const L = JSON.parse(JSON.stringify(require('./planseed.js').LESSONS));
  L.find(x => x.id === 'L1').taught = [{ classId: 'A1', date: '2026-10-26', slide: 3, of: 5, note: 'Start with the poem', at: 1792000000000, agenda: [1, 3] }];
  return L; };
test('E1-059 E1-060 E1-061: where each class got to, noted by hand, edited (its agenda ticks kept) and removed', async () => {
  const p = await K.fresh(1366, withTaught());
  await K.open(p, 'lesson/L1');
  await p.waitForSelector('main [data-taught] [data-tg="0"]');
  assert.match(await p.$eval('main [data-taught] [data-tg="0"]', e => e.textContent), /Got to slide 3 of 5 · agenda 1 of 3/);
  const menu = async name => { await p.click('main [data-focus="lesson-menu"]'); await p.waitForSelector('[role^="menuitem"]'); await K.item(p, name); };
  // Add a note: the other class on the lesson
  await menu('Add a note');
  await p.waitForSelector('[data-focus="taught-class"]');
  await p.select('[data-focus="taught-class"] select, select[data-focus="taught-class"]', '1').catch(async () => { await p.$eval('[data-focus="taught-class"]', s => { s.value = '1'; s.dispatchEvent(new Event('change', { bubbles: true })); }); });
  const slide = await p.$('select[data-focus="taught-slide"]') ? 'select[data-focus="taught-slide"]' : '[data-focus="taught-slide"] select';
  await p.select(slide, '4');
  await p.type('input[data-focus="taught-note"], [data-focus="taught-note"] input', 'Exit ticket next time');
  await p.click('[data-focus="taught-save"]');
  assert.ok(await until(async () => ((await K.lessonInDb(p, 'L1')).taught || []).length === 2), 'the note is added');
  let l = await K.lessonInDb(p, 'L1'), a2 = l.taught.find(x => x.classId === 'A2');
  assert.deepEqual([a2.date, a2.slide, a2.of, a2.note], ['2026-10-26', 4, 5, 'Exit ticket next time']);
  // Edit the first: its agenda ticks stay
  await p.click('main [data-taught] [data-tg="0"] [aria-haspopup]'); await p.waitForSelector('[role^="menuitem"]'); await K.item(p, 'Edit');
  await p.waitForSelector('[data-focus="taught-save"]');
  await p.select(slide, '5');
  await p.click('[data-focus="taught-save"]');
  assert.ok(await until(async () => { const x = (await K.lessonInDb(p, 'L1')).taught.find(y => y.classId === 'A1'); return x.slide === 5 && x.agenda && x.agenda[0] === 1 && x.note === 'Start with the poem'; }), 'edited, agenda and note kept');
  await p.waitForFunction(() => /Finished all 5 slides/.test(document.querySelector('main [data-taught]').textContent));
  // Remove the second
  await p.click('main [data-taught] [data-tg="1"] [aria-haspopup]'); await p.waitForSelector('[role^="menuitem"]'); await K.item(p, 'Remove');
  assert.ok(await until(async () => (await K.lessonInDb(p, 'L1')).taught.length === 1), 'removed');
  l = await K.lessonInDb(p, 'L1');
  const both = await K.sameInPlanner(p, 'L1', l, ['taught']);
  assert.deepEqual(both.taught[0], both.taught[1], 'the current Planner reads the same notes');
  assert.deepEqual(p.errors, []);
  await p.close();
});

test('H-053: a note from the phone waiting in gsp.taughtIn is put on its lesson on the computer, and marked put on', async () => {
  const p = await K.fresh();
  await p.evaluate(() => localStorage.setItem('gsp.taughtIn', JSON.stringify({ items: { 'L2|A1|2026-10-27': { slide: 2, of: 5, x: 'Ran out of time', t: 1793000000000 } } })));
  await K.open(p, 'home');
  assert.ok(await until(async () => { const l = await K.lessonInDb(p, 'L2'); return l.taught && l.taught[0] && l.taught[0].note === 'Ran out of time'; }, 10000), 'the note is on the lesson');
  const l = await K.lessonInDb(p, 'L2');
  assert.deepEqual([l.taught[0].classId, l.taught[0].date, l.taught[0].slide, l.taught[0].of, l.taught[0].at], ['A1', '2026-10-27', 2, 5, 1793000000000]);
  assert.equal(JSON.parse(await p.evaluate(() => localStorage.getItem('gsp.taughtIn'))).items['L2|A1|2026-10-27'].f, 1, 'marked put on');
  const both = await K.sameInPlanner(p, 'L2', l, ['taught']);
  assert.deepEqual(both.taught[0], both.taught[1]);
  assert.deepEqual(p.errors, []);
  await p.close();
});

test('E1-054 E1-055: a link edited, and links picked from School resources (searched when there are many)', async () => {
  const p = await K.fresh();
  await p.evaluate(() => localStorage.setItem('gs.school', JSON.stringify({ items: [1, 2, 3, 4, 5, 6, 7].map(i => ({ id: 'k' + i, kind: 'link', name: i === 3 ? 'Poetry archive' : 'School page ' + i, url: 'https://example.org/p' + i, cls: [], group: i === 3 ? 'English' : '' })).concat([{ id: 'f1', kind: 'note', name: 'Bell times' }]) })));
  await K.open(p, 'lesson/L2');
  await p.click('main [data-focus="add-link"]');
  await p.waitForSelector('main [data-lkpick]');
  assert.equal(await p.$$eval('main [data-lkpick]', b => b.length), 7, 'only School links are offered');
  await p.type('main input[data-focus="lk-q"], main [data-focus="lk-q"] input', 'poetry english');
  assert.ok(await until(async () => (await p.$$eval('main [data-lkpick]', b => b.map(x => x.dataset.lkpick))).join() === 'k3'), 'the search finds it by name and group');
  await p.click('main [data-lkpick="k3"]');
  assert.ok(await until(async () => ((await K.lessonInDb(p, 'L2')).links || []).some(x => x.url === 'https://example.org/p3' && x.name === 'Poetry archive')), 'the pick goes on');
  assert.ok(await until(() => p.$eval('main [data-lkpick="k3"]', b => b.disabled)), 'and is shown as added');
  await p.$eval('main [data-focus="link-url"]', el => { el.value = 'example.com/sonnets'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('main [data-focus="link-add"]');
  assert.ok(await until(async () => ((await K.lessonInDb(p, 'L2')).links || []).length === 2), 'a typed one goes on too');
  const id = (await K.lessonInDb(p, 'L2')).links.find(x => /sonnets/.test(x.url)).id;
  await p.click('main [data-lkedit="' + id + '"]');
  await p.waitForSelector('main [data-focus="link-url"]');
  assert.equal(await p.$eval('main [data-focus="link-url"]', e => e.value), 'https://example.com/sonnets', 'Edit opens with its address');
  assert.equal(await p.$('main [data-lkpick]'), null, 'and no School picks');
  await p.$$eval('main .mlink input', ins => { ins[1].value = 'Sonnet guide'; ins[1].dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('main [data-focus="link-add"]');
  assert.ok(await until(async () => (await K.lessonInDb(p, 'L2')).links.find(x => x.id === id).name === 'Sonnet guide'), 'the new name is saved on the same link');
  const l = await K.lessonInDb(p, 'L2'), both = await K.sameInPlanner(p, 'L2', l, ['links']);
  assert.deepEqual(both.links[0], both.links[1], 'the current Planner reads the same links');
  assert.deepEqual(p.errors, []);
  await p.close();
});

test('E1-018 E1-019 E1-036 E1-037: the lesson\'s own unit plan link, added with Save or left with Cancel, and its unit\'s link used until then', async () => {
  const p = await K.fresh();
  await p.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const s = r.result.transaction('kv', 'readwrite').objectStore('kv'), q = s.get('units'); q.onsuccess = () => { const u = q.result; u.find(x => x.id === 'U2').atlas = 'https://example.org/unit2'; s.put(u, 'units').onsuccess = () => { r.result.close(); res(); }; }; q.onerror = () => rej(q.error); }; }));
  await K.open(p, 'lesson/L2');
  const items = async () => { await p.click('main [data-focus="lesson-menu"]'); await p.waitForSelector('[role^="menuitem"]'); return p.$$eval('[role^="menuitem"]', b => b.map(x => x.textContent.trim())); };
  let it = await items();
  assert.ok(it.some(x => /^Open Unit plan/.test(x) && /The page of Unit 2: Poetry/.test(x)), 'its unit\'s link: ' + it.join(' | '));
  await K.item(p, 'Change the Unit plan link');
  await p.waitForSelector('[data-focus="atlas-url"]');
  await p.type('input[data-focus="atlas-url"], [data-focus="atlas-url"] input', 'https://example.org/lesson2');
  await p.click('.sheet [data-focus="atlas-save"]').catch(() => p.click('[data-focus="atlas-save"]'));
  assert.ok(await until(async () => (await K.lessonInDb(p, 'L2')).atlas === 'https://example.org/lesson2'), 'Save keeps its own link');
  it = await items();
  assert.ok(it.some(x => /^Open Unit plan/.test(x) && /This lesson’s own page/.test(x)), 'now its own page: ' + it.join(' | '));
  await K.item(p, 'Change the Unit plan link');
  await p.waitForSelector('[data-focus="atlas-url"]');
  await p.$eval('[data-focus="atlas-url"]', el => { el.value = 'nonsense'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Cancel' && b.closest('.sheet, dialog')).click());
  await wait(300);
  assert.equal((await K.lessonInDb(p, 'L2')).atlas, 'https://example.org/lesson2', 'Cancel changes nothing');
  const l = await K.lessonInDb(p, 'L2'), both = await K.sameInPlanner(p, 'L2', l, ['atlas']);
  assert.deepEqual(both.atlas[0], both.atlas[1]);
  assert.deepEqual(p.errors, []);
  await p.close();
});

// A small Word file made here: a title, a heading, a bold word, a bulleted list and a table.
const tinyDocx = () => { const f = require('fflate'), W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const p = (txt, st, extra = '') => '<w:p><w:pPr>' + (st ? '<w:pStyle w:val="' + st + '"/>' : '') + extra + '</w:pPr>' + txt + '</w:p>', r = (s, b) => '<w:r>' + (b ? '<w:rPr><w:b/></w:rPr>' : '') + '<w:t xml:space="preserve">' + s + '</w:t></w:r>';
  const body = p(r('Poem handout'), 'Title') + p(r('Before you read'), 'Heading1') + p(r('Mark the ') + r('stressed', true) + r(' words.')) + p(r('First reading'), 'ListParagraph', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>') + p(r('Second reading'), 'ListParagraph', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>') +
    '<w:tbl><w:tr><w:tc>' + p(r('Word')) + '</w:tc><w:tc>' + p(r('Why')) + '</w:tc></w:tr></w:tbl>';
  return Buffer.from(f.zipSync({ '[Content_Types].xml': f.strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    'word/document.xml': f.strToU8('<?xml version="1.0"?><w:document ' + W + '><w:body>' + body + '</w:body></w:document>') })).toString('base64'); };
test('E1-057 E1-058: a Word file\'s Edit a copy makes a document beside it; ↓ downloads a file as it is and a document as .docx', async () => {
  const L = JSON.parse(JSON.stringify(require('./planseed.js').LESSONS));
  L.find(x => x.id === 'L2').files = [{ id: 'W1', name: 'Poem handout.docx', kind: 'other', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 900, added: 1792000000000 }];
  const p = await K.fresh(1366, L);
  await p.evaluate(b64 => new Promise((res, rej) => { const u8 = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(new Blob([u8], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'file:W1'); tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error); }; }), tinyDocx());
  await p.evaluateOnNewDocument(() => { window.__dl = []; const mk = URL.createObjectURL; URL.createObjectURL = b => { window.__lastBlob = b; return mk(b); };
    HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dl.push({ name: this.download, blob: window.__lastBlob }); }; });
  await K.open(p, 'lesson/L2');
  await p.waitForSelector('main [data-dl="W1"]');
  await p.click('main [data-dl="W1"]');
  assert.ok(await until(() => p.evaluate(() => window.__dl.length === 1)), 'the Word file downloads');
  const kept = await p.evaluate(() => new Promise(r => { const q = indexedDB.open('gs-lessons'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('file:W1'); g.onsuccess = () => { q.result.close(); r(g.result.size); }; }; }));
  assert.deepEqual(await p.evaluate(() => [window.__dl[0].name, window.__dl[0].blob.size]), ['Poem handout.docx', kept], 'as it is');
  await p.click('main [data-editcopy="W1"]');
  await p.waitForSelector('.docpage, [data-doc], main .doc-edit, .sheet .docpage', { timeout: 10000 }).catch(() => {});
  assert.ok(await until(async () => ((await K.lessonInDb(p, 'L2')).files || []).length === 2), 'a document is added beside it');
  const l = await K.lessonInDb(p, 'L2'), d = l.files.find(x => x.kind === 'doc');
  assert.equal(d.name, 'Poem handout'); assert.equal(l.files.find(x => x.id === 'W1').name, 'Poem handout.docx', 'the Word file stays');
  const html = await p.evaluate(id => new Promise(r => { const q = indexedDB.open('gs-lessons'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('file:' + id); g.onsuccess = () => { q.result.close(); g.result.text().then(r); }; }; }), d.id);
  assert.equal(html, '<h1>Poem handout</h1><h2>Before you read</h2><p>Mark the <strong>stressed</strong> words.</p><ul><li>First reading</li><li>Second reading</li></ul><table><tr><td>Word</td><td>Why</td></tr></table>');
  // the document comes down as .docx
  await K.open(p, 'lesson/L2');
  await p.waitForSelector('main [data-dl="' + d.id + '"]');
  await p.click('main [data-dl="' + d.id + '"]');
  assert.ok(await until(() => p.evaluate(() => window.__dl.length === 1)), 'the document downloads');
  const got = await p.evaluate(async () => [window.__dl[0].name, [...new Uint8Array(await window.__dl[0].blob.arrayBuffer()).slice(0, 2)]]);
  assert.deepEqual(got, ['Poem handout.docx', [80, 75]], 'as a Word file');
  const both = await K.sameInPlanner(p, 'L2', l, ['files']);
  assert.deepEqual(both.files[0], both.files[1], 'the current Planner reads the same files');
  assert.deepEqual(p.errors, []);
  await p.close();
});

test('E1-051: Make an alternative version is in the lesson menu while editing (kept there on purpose)', async () => {
  const p = await K.fresh();
  await K.edit(p, 'L3');
  await p.click('main [data-focus="lesson-menu"]'); await p.waitForSelector('[role^="menuitem"]'); await K.item(p, 'Make an alternative version');
  await p.waitForSelector('[data-focus="var-name"]');
  await p.click('[data-focus="var-name"]'); await p.keyboard.type('Friday'); await p.click('[data-focus="name-ok"]');
  await p.waitForFunction(() => location.hash !== '#/lesson/L3/edit' && location.hash !== '#/lesson/L3', { timeout: 8000 });
  const id = await p.evaluate(() => location.hash.split('/')[2]), v = await until(() => K.lessonInDb(p, id));
  assert.equal(v.variantOf, 'L3'); assert.equal(v.variant, 'Friday');
  const both = await K.sameInPlanner(p, id, v, ['variantOf', 'variant']);
  assert.deepEqual(both.variant[0], 'Friday'); assert.deepEqual(both.variantOf[0], 'L3');
  assert.deepEqual(p.errors, []);
  await p.close();
});

test('H-017: a lesson another window saved meanwhile is kept as a version before her change replaces it, and she is told', async () => {
  const p = await K.fresh();
  await K.open(p, 'lesson/L2');
  await p.waitForSelector('main [data-focus="lesson-menu"]');
  // another window's save, straight into the store (no word sent, as when it lands inside her own save's quiet time)
  await p.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const s = r.result.transaction('lessons', 'readwrite').objectStore('lessons'), g = s.get('L2'); g.onsuccess = () => { const l = g.result; l.title = 'Changed in the other window'; l.updated = Date.now() + 1000; s.put(l).onsuccess = () => { r.result.close(); res(); }; }; g.onerror = () => rej(g.error); }; }));
  await p.click('main [data-focus="lesson-menu"]'); await p.waitForSelector('[role^="menuitem"]'); await K.item(p, 'Name matches the title slide');
  assert.ok(await until(async () => (await K.lessonInDb(p, 'L2')).titleApart === true), 'her change is saved');
  const vers = await p.evaluate(() => new Promise(r => { const q = indexedDB.open('gs-lessons'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get('ver:L2'); g.onsuccess = () => { q.result.close(); r(g.result || []); }; }; }));
  assert.ok(vers.some(v => v.lesson && v.lesson.title === 'Changed in the other window' && /another window/.test(v.label)), 'the other window\'s lesson is a version');
  assert.ok(await until(() => p.evaluate(() => [...document.querySelectorAll('.toast')].some(x => /another window/.test(x.textContent)))), 'and she is told');
  assert.deepEqual(p.errors, []);
  await p.close();
});

test('H-055: signed in to Google with no live key, the sign-in script is loaded ahead, so the Drive chooser opens straight from the press', async () => {
  const p = await K.fresh(), asked = [];
  await p.evaluate(() => { localStorage.setItem('gs.gEmail', JSON.stringify('teacher@example.org')); localStorage.setItem('gs.gcid', JSON.stringify('123-made-up.apps.googleusercontent.com')); });
  await p.setRequestInterception(true);
  p.on('request', r => { const u = r.url(); if (/accounts\.google\.com\/gsi\/client/.test(u)) { asked.push(u); r.respond({ status: 200, contentType: 'text/javascript', body: 'window.__gisLoaded = true;' }); } else if (/googleapis\.com|accounts\.google\.com/.test(u)) r.respond({ status: 401, body: '{}' }); else r.continue(); });
  await K.open(p, 'lesson/L2');
  assert.ok(await until(() => asked.length > 0, 9000), 'Google\'s sign-in script is asked for without a press');
  assert.ok(await until(() => p.evaluate(() => window.__gisLoaded === true)), 'and loaded');
  await p.close();
});

test('E1-052: the Finished PowerPoint comes from Google Drive too (present after all: From Google Drive in its sheet)', async () => {
  const { SETUP, LESSONS } = require('./planseed.js');
  const E = await import('../../src/engines/planner.js');
  E.L.setup = SETUP; E.L.lessons = LESSONS; E.L.units = [];
  const deck = JSON.parse(JSON.stringify(LESSONS[2])); deck.slides = deck.slides.slice(0, 2); deck.slides[1].title = 'From Drive';
  const bytes = Buffer.from(E.buildPptx(deck));
  const p = await K.fresh();
  await p.evaluate(() => { localStorage.setItem('gs.gEmail', JSON.stringify('teacher@example.org')); localStorage.setItem('gs.gcid', JSON.stringify('123-made-up.apps.googleusercontent.com')); });
  await p.evaluateOnNewDocument(() => {
    window.__pickerSeen = [];
    const P = { ViewId: { DOCS: 'docs' }, DocsViewMode: { LIST: 'list' }, Feature: { MULTISELECT_ENABLED: 'multi', SUPPORT_DRIVES: 'drives' }, Action: { PICKED: 'picked', CANCEL: 'cancel' }, Response: { ACTION: 'action', DOCUMENTS: 'docs' },
      DocsView: class { constructor() { this.o = {}; } setIncludeFolders() { return this; } setMode() { return this; } setSelectFolderEnabled() { return this; } setMimeTypes(v) { this.o.mimes = v; return this; } setParent() { return this; } setLabel() { return this; } setOwnedByMe() { return this; } setEnableDrives() { return this; } },
      PickerBuilder: class { constructor() { this.o = { views: [] }; } setOAuthToken() { return this; } setAppId() { return this; } setOrigin() { return this; } setTitle() { return this; } addView(v) { this.o.views.push(v.o); return this; } enableFeature() { return this; } setCallback(cb) { this.cb = cb; return this; }
        build() { return { setVisible: () => { window.__pickerSeen.push(this.o); setTimeout(() => this.cb({ action: 'picked', docs: [{ id: '1DeckDeckDeckDeckDeckDeckDeck0001', name: 'Sonnets final.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', sizeBytes: '5000' }] }), 20); } }; } } };
    window.google = { picker: P, accounts: { oauth2: { initTokenClient: o => ({ requestAccessToken: () => setTimeout(() => o.callback({ access_token: 'tok', expires_in: 3600, scope: o.scope }), 10) }), revoke: () => {} } } };
    window.gapi = { load: (n, o) => setTimeout(o.callback, 0) };
  });
  await p.setRequestInterception(true);
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Expose-Headers': 'Content-Length, Content-Type' };
  p.on('request', r => { const u = r.url();
    if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u) || /^(data|blob|about):/.test(u)) return r.continue();
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: cors, body: '' });
    if (/1DeckDeckDeckDeckDeckDeckDeck0001\?alt=media/.test(u)) return r.respond({ status: 200, headers: { ...cors, 'Content-Length': String(bytes.length) }, contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', body: bytes });
    if (/\/about\?/.test(u)) return r.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ user: { emailAddress: 'teacher@example.org' } }) });
    r.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ files: [] }) }); });
  await K.open(p, 'lesson/L3');
  await p.click('main [data-focus="lesson-menu"]'); await p.waitForSelector('[role^="menuitem"]'); await K.item(p, 'Finished PowerPoint');
  await p.waitForSelector('.sheet [data-drive], dialog [data-drive]', { timeout: 10000 });
  await p.click('.sheet [data-drive], dialog [data-drive]');
  const l = await until(async () => { const x = await K.lessonInDb(p, 'L3'); return x && x.final && x; }, 15000);
  assert.ok(l, 'the deck from Drive is the finished deck');
  assert.equal(l.final.name, 'Sonnets final.pptx'); assert.equal(l.slides.length, 2); assert.match(l.slides[1].title, /From Drive/);
  for (const [k, [a, b2]] of Object.entries(await K.sameInPlanner(p, 'L3', l, ['slides', 'final']))) assert.deepEqual(a, b2, k + ' reads the same in the current Planner');
  assert.deepEqual(p.errors.filter(e => !/googleapis|accounts\.google/.test(e)), []);
  await p.close();
});

// Beside away from a lesson: the week on the Calendar, a unit on its course line, and a document.
const unitsInPlanner = async p => { await p.goto(K.srv.url + 'planner.html'); await p.waitForFunction(() => window.__planner && Array.isArray(window.__planner.L.units) && window.__planner.L.units.length, { timeout: 20000 }); return p.evaluate(() => JSON.parse(JSON.stringify(window.__planner.L.units))); };
test('E1-062 E1-083: Beside on the Calendar\'s week, with each course\'s unit that week and the general notebook', async () => {
  const p = await K.fresh();
  await K.open(p, 'calendar/class');
  await p.evaluate(() => { const b = document.querySelector('[data-focus="cal-next"]'); b && b.click(); });   // the week the seeded units run in is any; go back to this one
  await p.evaluate(() => { const b = document.querySelector('[data-focus="cal-prev"]'); b && b.click(); });
  await p.click('main [data-focus="week-menu"]'); await p.waitForSelector('[role^="menuitem"]'); await K.item(p, 'Beside');
  await p.waitForSelector('aside.beside');
  assert.ok(await p.$eval('main .page.calendar, .page.calendar', e => e.classList.contains('with-beside')), 'the week moves aside for it');
  await tabTo(p, 'Unit');
  const shown = await p.$$eval('aside.beside [data-unitside]', s => s.map(x => x.dataset.unitside));
  assert.ok(shown.length > 0 || await p.$eval('aside.beside .bbody', b => /No unit this week/.test(b.textContent)), 'this week\'s units, or none: ' + shown.join());
  await tabTo(p, 'Notebook');
  await p.waitForSelector('aside.beside [data-nbpage][contenteditable="true"]');
  assert.equal(await p.$('aside.beside [data-focus="nb-swap"]'), null, 'only the general page here');
  await p.click('aside.beside [data-nbpage]'); await p.keyboard.type('Bring the poetry books');
  assert.ok(await until(async () => /Bring the poetry books/.test(String(await kvGet(p, 'nb:general') || ''))), 'saved on the general page');
  await p.click('aside.beside [data-focus="beside-close"]');
  assert.ok(await until(async () => !(await p.$('aside.beside'))), 'and it closes');
  assert.deepEqual(p.errors, []);
  await p.close();
});

test('E1-062 E1-080 E1-083: Beside on a unit\'s course line: the unit with its week, its own notebook page, and General notes and back', async () => {
  const p = await K.fresh();
  await K.open(p, 'class/c1');
  await p.waitForSelector('main [data-focus="unit-menu"]', { timeout: 10000 });
  await p.click('main [data-focus="unit-menu"]'); await p.waitForSelector('[role^="menuitem"]'); await K.item(p, 'Beside');
  await p.waitForSelector('aside.beside');
  const unitTab = await p.$$eval('aside.beside [role=tab]', b => b.map(x => x.textContent));
  await tabTo(p, unitTab[3]);
  const uid = await p.$eval('main .us.on', b => b.textContent).catch(() => '');
  const ids = await p.$$eval('aside.beside [data-unitside]', s => s.map(x => x.dataset.unitside));
  assert.equal(ids.length, 1, 'the unit open on the course line: ' + uid);
  await tabTo(p, 'Notebook');
  await p.waitForSelector('aside.beside [data-nbpage][contenteditable="true"]');
  assert.match(await p.$eval('aside.beside .nb .row b', b => b.textContent), /This unit/);
  await p.click('aside.beside [data-nbpage]'); await p.keyboard.type('Unit idea: a poem wall');
  assert.ok(await until(async () => ((await kvGet(p, 'units')) || []).some(u => u.id === ids[0] && /a poem wall/.test(u.notebook || ''))), 'saved on the unit');
  await p.click('aside.beside [data-focus="nb-swap"]');
  await p.waitForFunction(() => /General notes/.test(document.querySelector('aside.beside .nb .row b').textContent));
  assert.match(await p.$eval('aside.beside [data-focus="nb-swap"]', b => b.textContent), /This unit/, 'and back to this unit');
  await p.click('aside.beside [data-focus="nb-swap"]');
  await p.waitForFunction(() => /a poem wall/.test(document.querySelector('aside.beside [data-nbpage]').textContent), { timeout: 5000 });
  const theirs = (await unitsInPlanner(p)).find(u => u.id === ids[0]);
  assert.match(theirs.notebook || '', /a poem wall/, 'the current Planner reads the unit\'s page');
  assert.deepEqual(p.errors, []);
  await p.close();
});

test('E1-003: Beside opens from a document, beside it, and its notebook is the lesson\'s', async () => {
  const p = await K.fresh(1440, withFiles());
  await putDoc(p);
  await K.open(p, 'lesson/L2');
  await p.click('main .mopen');   // the Reading guide document
  await p.waitForSelector('[data-docpage]');
  await p.click('[data-focus="doc-beside"]');
  await p.waitForSelector('dialog[open] aside.beside');
  await p.evaluate(() => [...document.querySelectorAll('dialog[open] aside.beside [role=tab]')].find(x => x.textContent === 'Notebook').click()); await wait(300);
  await p.waitForSelector('dialog[open] aside.beside [data-nbpage][contenteditable="true"]');
  await p.click('dialog[open] aside.beside [data-nbpage]'); await p.keyboard.type('Read it twice');
  assert.ok(await until(async () => /Read it twice/.test((await K.lessonInDb(p, 'L2')).notebook || '')), 'saved with the lesson');
  const box = await p.$eval('dialog[open] [data-docpage]', e => e.getBoundingClientRect().right), side = await p.$eval('dialog[open] aside.beside', e => e.getBoundingClientRect().left);
  assert.ok(box <= side + 1, 'the document stays clear of it');
  const l = await K.lessonInDb(p, 'L2'), both = await K.sameInPlanner(p, 'L2', l, ['notebook']);
  assert.deepEqual(both.notebook[0], both.notebook[1]);
  assert.deepEqual(p.errors, []);
  await p.close();
});
