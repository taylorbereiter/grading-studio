// The Planner's text boxes: each box on a slide has its own text size, a box can be moved and resized with the mouse,
// + Add slide adds the teacher's usual slide (▾ beside it picks another), and words are never cut off: the editor marks
// a box whose text runs past it, and Present gives that box the room under it, then makes the text smaller until it fits.
// Made-up lessons only.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { serve } = require('./helpers/serve');
const { launch } = require('./helpers/chrome');
const ROOT = path.join(__dirname, '..');
const PAGE = () => fs.readFileSync(path.join(ROOT, 'planner.html'), 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (page, fn, arg) => { for (let i = 0; i < 160; i++) { if (await page.evaluate(fn, arg)) return; await wait(50); } throw new Error('Waited too long for ' + fn); };
const SETUP = { kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-08-31', semEnd: '2027-01-18', daysOff: [], events: [],
  classes: [{ id: 'A1', name: 'Course A-1', course: 'Course A', color: '#1F6FB2', meets: [{ dow: 2, start: '09:00', end: '10:30' }] }] };
const LONG = 'The first stanza is all about sound: the rain on the roof, the kettle, the dog barking two houses away\nThe second stanza turns to sight, and the colors get darker as the evening comes in\nThe third stanza is quiet: no sounds at all, only the speaker thinking about the person who left\nWhy does the poet take the sounds away at the end?\nFind one line that shows the change';

async function open(setup) {
  const server = await serve(PAGE);
  const browser = await launch(), page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1400, height: 1000 });
  await page.goto(server.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
  await page.evaluate(async s => { await window.__planner.applySetup(s); }, { ...SETUP, ...(setup || {}) });
  return { server, browser, page, errors, done: async () => { await browser.close(); await server.close(); } };
}
const lesson = (page, slides, at) => page.evaluate((slides, at) => { const P = window.__planner, l = P.normLesson({ title: 'Poems', look: 'white', fmt: 2, slides }); P.L.lessons.push(l); P.openLessonForTest(l, at); }, slides, at || 0);
const slide = (page, i) => page.evaluate(i => JSON.parse(JSON.stringify(window.__planner.L.open.slides[i == null ? window.__planner.L.cur : i])), i);
const pptx = (page, n) => page.evaluate(n => { const P = window.__planner, z = fflate.unzipSync(P.buildPptx(P.L.open)); return new TextDecoder().decode(z['ppt/slides/slide' + n + '.xml']); }, n);

test('+ Add slide adds a Title and text slide, ▾ picks another layout, and a teacher can choose what it adds', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await lesson(page, [{ layout: 'title', title: 'Poems' }, { layout: 'agenda', title: 'Agenda' }], 1);
    await page.waitForSelector('[data-a="addslide"]');
    await page.click('[data-a="addslide"]');
    await until(page, () => window.__planner.L.open.slides.length === 3);
    assert.equal((await slide(page)).layout, 'content', 'a title and text slide, straight away');
    assert.equal(await page.$('#dlg:not([hidden]) #dlgBox [data-addslide]'), null, 'no picker in the way');
    assert.equal((await page.evaluate(() => window.__planner.L.cur)), 2, 'after the one you were on');
    await page.click('[data-a="addpick"]'); await page.waitForSelector('#dlgBox [data-addslide="discuss"]');
    await page.click('#dlgBox [data-addslide="discuss"]');
    await until(page, () => window.__planner.L.open.slides.length === 4);
    assert.equal((await slide(page)).layout, 'discuss');
    // the teacher's own usual slide, from the timetable settings
    await page.evaluate(async s => { await window.__planner.applySetup(s); }, { ...SETUP, deck: { add: 'twocol' } });
    await page.evaluate(() => window.__planner.renderLessons());
    await page.waitForSelector('[data-a="addslide"]');
    await page.click('[data-a="addslide"]');
    await until(page, () => window.__planner.L.open.slides.length === 5);
    assert.equal((await slide(page)).layout, 'twocol');
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('each text box has its own size, and moving or resizing a box with the mouse is kept, in Present and in the .pptx', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await lesson(page, [{ layout: 'title', title: 'Poems' }, { layout: 'content', title: 'Read aloud', body: '• Listen for the turn\n• Mark one line', size: 28 }, { layout: 'discuss', title: 'Talk', body: 'Which line stays?', foot: 'Think · Pair · Share' }], 1);
    await page.waitForSelector('#lsStage .ls-body');
    assert.equal(await page.$eval('#lsSize select', s => s.dataset.k), 'body', 'the main text first');
    // click the title: the size control is about the title now
    await page.click('#lsStage .ls-t'); await page.waitForSelector('#lsSize select[data-k="title"]');
    assert.ok(await page.$('#lsStage .ls-frame[data-for="title"]'), 'the title gets a frame with handles');
    await page.select('#lsSize select', '36');
    await until(page, () => (window.__planner.L.open.slides[1].fs || {}).title === 36);
    assert.equal(await page.$eval('#lsStage .ls-t', e => parseFloat(e.style.fontSize)), 48);
    assert.equal((await slide(page, 1)).size, 28, 'the main text kept its size');
    // back to the usual size takes the choice off
    await page.click('#lsStage .ls-t'); await page.waitForSelector('#lsSize select[data-k="title"]');
    await page.select('#lsSize select', '');
    await until(page, () => !window.__planner.L.open.slides[1].fs);
    await page.select('#lsSize select', '34');   // and on again, for the .pptx below
    await until(page, () => (window.__planner.L.open.slides[1].fs || {}).title === 34);
    // drag the main text's bottom handle down 80 slide units, and its move bar left
    await page.click('#lsStage .ls-body'); await page.waitForSelector('#lsStage .ls-frame[data-for="body"]');
    await page.click('.ls-notes textarea');   // out of the text, so the slide is drawn again
    const k = await page.$eval('#lsStage', e => e.getBoundingClientRect().width / 1280);
    let h = await (await page.$('#lsStage .ls-frame i[data-h="s"]')).boundingBox();
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down(); await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 80 * k, { steps: 5 }); await page.mouse.up();
    await until(page, () => !!(window.__planner.L.open.slides[1].box || {}).body);
    let b = (await slide(page, 1)).box.body;
    assert.deepEqual([b.x, b.y, b.w], [152, 212, 1008]); assert.ok(Math.abs(b.h - 440) <= 8, 'taller by about 80: ' + b.h);
    h = await (await page.$('#lsStage .ls-frame [data-h="move"]')).boundingBox();
    await page.mouse.move(h.x + 20, h.y + 8); await page.mouse.down(); await page.mouse.move(h.x + 20 - 100 * k, h.y + 8, { steps: 5 }); await page.mouse.up();
    await until(page, () => window.__planner.L.open.slides[1].box.body.x < 100);
    b = (await slide(page, 1)).box.body;
    assert.ok(Math.abs(b.x - 52) <= 8 && b.w === 1008, 'moved left: ' + JSON.stringify(b));
    assert.deepEqual(await page.$eval('#lsStage .ls-body', e => [e.offsetLeft, e.offsetHeight]), [b.x, b.h]);
    // the .pptx places the boxes the same way, the title at its own size
    const x = await pptx(page, 2);
    assert.match(x, new RegExp('<a:off x="' + Math.round(b.x * 9525) + '" y="' + Math.round(b.y * 9525) + '"/><a:ext cx="' + Math.round(b.w * 9525) + '" cy="' + Math.round(b.h * 9525) + '"/>'));
    assert.match(x, /<a:r><a:rPr lang="en-US" sz="3400"[^>]*>(?:<[^>]+>)*<a:t>Read aloud<\/a:t>/);
    // a teaching layout's box: the bottom line gets its own size, and goes to the .pptx too
    await page.click('#lsThumbs [data-go="2"]'); await page.waitForSelector('#lsStage .ls-bx[data-k="foot"]');
    await page.click('#lsStage .ls-bx[data-k="foot"]'); await page.waitForSelector('#lsSize select[data-k="foot"]');
    await page.select('#lsSize select', '32');
    await until(page, () => (window.__planner.L.open.slides[2].fs || {}).foot === 32);
    assert.match(await pptx(page, 3), /sz="3200"[^>]*>(?:<[^>]+>)*<a:t>Think · Pair · Share<\/a:t>/);
    // Present draws the slide the same way
    await page.click('#lsThumbs [data-go="1"]'); await page.waitForSelector('#lsStage .ls-body');
    await page.$eval('[data-pr="present"]', e => e.click()); await page.waitForSelector('#present .ls-body');
    assert.equal(await page.$eval('#present .ls-body', e => e.offsetLeft), b.x);
    await page.evaluate(() => window.__present.end());
    // Put back, on the box's frame, puts it where the layout has it
    await page.click('#lsStage .ls-body'); await page.waitForSelector('#lsStage .ls-frame [data-a="boxreset"]'); await page.click('#lsStage .ls-frame [data-a="boxreset"]');
    await until(page, () => !window.__planner.L.open.slides[1].box);
    assert.equal(await page.$eval('#lsStage .ls-body', e => e.offsetLeft), 152);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('words are never cut off: the editor marks the box and offers a fix, and Present makes the text fit', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await lesson(page, [{ layout: 'title', title: 'Poems' }, { layout: 'content', title: 'What the speaker notices', body: LONG, size: 36 }], 1);
    await page.waitForSelector('#lsStage .ls-body');
    assert.ok(await page.$('#lsStage .ls-body.ls-over'), 'the box is marked');
    assert.equal(await page.$eval('#lsStage .ls-body', e => getComputedStyle(e).overflow), 'visible', 'what runs past still shows');
    assert.match(await page.$eval('#lsWarn', e => e.hidden ? '' : e.textContent), /more than fits at 36 pt/);
    assert.ok(await page.$('#lsWarn [data-a="split"]')); assert.ok(await page.$('#lsWarn [data-a="fit"]'));
    // Present: every box shows all its words
    await page.$eval('[data-pr="present"]', e => e.click()); await page.waitForSelector('#present .ls-body');
    await until(page, () => [...document.querySelectorAll('#prFit .ls-t,#prFit .ls-body')].every(e => e.scrollHeight <= e.clientHeight + 2));
    assert.ok(await page.$('#prFit .ls-body.ls-shrunk'));
    // the class screen window shows the same fitted slide, nothing cut off there either
    await page.keyboard.press('w');
    await until(page, () => { const w = window.__present.PR.out; return !!(w && w.document.querySelector('#prFit .ls-body')); });
    const both = await page.evaluate(() => { const g = d => { const e = d.querySelector('#prFit .ls-body'); return [e.style.fontSize, e.style.height, e.scrollHeight <= e.clientHeight + 2]; }; return [g(document), g(window.__present.PR.out.document)]; });
    assert.deepEqual(both[1], both[0]); assert.equal(both[1][2], true);
    await page.evaluate(() => window.__present.PR.out.close());
    await page.evaluate(() => window.__present.end());
    // Biggest size that fits: the smallest allowed size still doesn't fit this much, so it says so and uses 28
    await page.waitForSelector('#lsWarn [data-a="fit"]'); await page.click('#lsWarn [data-a="fit"]');
    await until(page, () => window.__planner.L.open.slides[1].size === 28);
    // a long word with no spaces wraps instead of running off the side
    await page.evaluate(() => { const P = window.__planner; P.L.open.slides[1].body = 'Pneumonoultramicroscopicsilicovolcanoconiosispneumonoultramicroscopicsilicovolcanoconiosis'; P.renderLessons(); });
    await page.waitForSelector('#lsStage .ls-body');
    assert.ok(await page.$eval('#lsStage .ls-body', e => e.scrollWidth <= e.clientWidth + 2));
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});
