// Stage 8 slice E1: the lesson editor and its side panel, every control the audit found missing or different
// (rebuild/audit/gaps.md, E1 rows), pressed in the new app, with what it saves read back by the current Planner.
// Made-up lessons only (planseed.js). npm run next:browser.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { kit, wait, until } = require('./e1kit.js');
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
  assert.deepEqual(await p.$$eval('aside.beside [role=tab]', b => b.map(x => x.textContent)), ['Books', 'Activities', 'Video', 'Unit', 'Notebook']);
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
