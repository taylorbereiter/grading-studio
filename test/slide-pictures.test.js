// The Planner's slides and pictures: a picture dragged onto a slide with text sits beside the text, several pictures
// get a slide each, a picture let go on a slide in the list goes on that slide, and the Full picture layout.
// Made-up lessons only.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { serve } = require('./helpers/serve');
const { launch } = require('./helpers/chrome');
const ROOT = path.join(__dirname, '..');
const PAGE = () => fs.readFileSync(path.join(ROOT, 'planner.html'), 'utf8');
const SETUP = { kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-08-31', semEnd: '2027-01-18', daysOff: [], events: [],
  classes: [{ id: 'A1', name: 'Course A-1', course: 'Course A', color: '#1F6FB2', meets: [{ dow: 2, start: '09:00', end: '10:30' }] }] };

async function open() {
  const server = await serve(PAGE);
  const browser = await launch(), page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1400, height: 1000 });
  await page.goto(server.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
  const tpl = fs.readFileSync(path.join(__dirname, 'fixtures', 'lesson-template.b64'), 'utf8').trim();
  await page.evaluate(async (s, tpl) => { await window.__planner.applySetup({ ...s, template: tpl }); }, SETUP, tpl);
  return { server, browser, page, errors, done: async () => { await browser.close(); await server.close(); } };
}
const lesson = (page, slides, at) => page.evaluate((slides, at) => { const P = window.__planner, l = P.normLesson({ title: 'Ads', look: 'white', fmt: 2, slides }); P.L.lessons.push(l); P.openLessonForTest(l, at); }, slides, at || 0);
// Pictures let go on something in the page: n made-up pictures as files, w x h each.
const dropPics = (page, sel, n, w, h) => page.evaluate(async (sel, n, w, h) => {
  const dt = new DataTransfer();
  for (let i = 0; i < n; i++) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = ['#246', '#642', '#264'][i % 3]; g.fillRect(0, 0, w, h); dt.items.add(new File([await new Promise(r => c.toBlob(r, 'image/png'))], 'pic' + i + '.png', { type: 'image/png' })); }
  document.querySelector(sel).dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
}, sel, n, w || 300, h || 200);
const slides = page => page.evaluate(() => window.__planner.L.open.slides.map(s => ({ layout: s.layout, title: s.title, body: s.body, img: s.img ? [s.img.w, s.img.h] : null })));
const cur = page => page.evaluate(() => window.__planner.L.cur);
const box = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(), s = document.querySelector('#lsStage').getBoundingClientRect(), k = s.width / 1280; return { x: Math.round((r.left - s.left) / k), y: Math.round((r.top - s.top) / k), w: Math.round(r.width / k), h: Math.round(r.height / k) }; });
const pptx = (page, n) => page.evaluate(n => { const P = window.__planner, z = fflate.unzipSync(P.buildPptx(P.L.open)), td = new TextDecoder(); const rels = td.decode(z['ppt/slides/_rels/slide' + n + '.xml.rels']); const sz = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(td.decode(z['ppt/presentation.xml'])); return { kx: +sz[1] / 1280, ky: +sz[2] / 720, xml: td.decode(z['ppt/slides/slide' + n + '.xml']), rels, layout: /<p:cSld name="([^"]+)"/.exec(td.decode(z['ppt/slideLayouts/' + /slideLayouts\/([^"]+)"/.exec(rels)[1]]))[1], media: Object.keys(z).filter(k => k.startsWith('ppt/media/lesson')) }; }, n);
const picAt = x => { const m = /<p:pic>[\s\S]*?<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/.exec(x.xml); return { x: +m[1], y: +m[2], w: +m[3], h: +m[4] }; };

test('a picture let go on a slide with text sits beside the text, in the editor and in the .pptx', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await lesson(page, [{ layout: 'title', title: 'Ads' }, { layout: 'content', title: 'What an ad wants', body: '• Your attention\n• Your trust' }], 1);
    await page.waitForSelector('#lsStage .ls-body');
    // while it is held over the lesson, the slide says it can be let go there
    await page.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['x'], 'p.png', { type: 'image/png' })); document.querySelector('#lsStage').dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); });
    assert.ok(await page.$('#lsWrap.ls-dropping'));
    await dropPics(page, '#lsStage', 1);
    await page.waitForSelector('#lsStage .ls-pic img');
    assert.equal(await page.$('#lsWrap.ls-dropping'), null);
    assert.deepEqual(await slides(page), [{ layout: 'title', title: 'Ads', body: '', img: null }, { layout: 'textpic', title: 'What an ad wants', body: '• Your attention\n• Your trust', img: [300, 200] }]);
    const text = await box(page, '#lsStage .ls-bx[data-k="body"]'), pic = await box(page, '#lsStage .ls-pic');
    assert.deepEqual([text.x, text.w, pic.x, pic.w], [152, 448, 640, 520]);
    assert.ok(text.x + text.w < pic.x, 'the text and the picture do not overlap');
    assert.ok(parseFloat(await page.$eval('#lsStage .ls-bx[data-k="body"]', e => getComputedStyle(e).fontSize)) * 3 / 4 >= 27.9, 'text is still 28 pt');
    assert.match(await page.$eval('.ls-tools', e => e.textContent), /Layout: Text \+ picture/);
    assert.match(await page.$eval('.ls-tools [data-a="pic"]', e => e.textContent), /Change picture/);
    // another picture on the same slide takes the first one's place
    await dropPics(page, '#lsStage', 1, 200, 400);
    await page.waitForFunction(() => window.__planner.L.open.slides[1].img.h === 400);
    assert.equal((await slides(page)).length, 2);
    // the .pptx: the picture on the right, the text as text, on Title Only
    const x = await pptx(page, 2);
    assert.equal(x.layout, 'Title Only'); assert.deepEqual(x.media, ['ppt/media/lesson2.png']);
    assert.match(x.xml, />Your attention<\/a:t>/);
    const p = picAt(x);
    assert.ok(Math.abs(p.w / p.h - 200 / 400) < 0.01, 'the picture keeps its shape');
    assert.ok(p.x >= 640 * x.kx - 1 && p.x + p.w <= 1160 * x.kx + 1 && Math.abs(p.y - 214 * x.ky) < 2 && p.h <= 384 * x.ky + 1, 'inside its box on the right');
    assert.ok(Math.abs((p.x + p.w / 2) - 900 * x.kx) < 2, 'centered in the box');
    // an empty slide becomes a plain Picture slide, as before
    await page.evaluate(() => { const P = window.__planner; P.L.open.slides.push(P.normLesson({ slides: [{ layout: 'content' }] }).slides[0]); P.openLessonForTest(P.L.open, 2); });
    await dropPics(page, '#lsStage', 1);
    await page.waitForFunction(() => window.__planner.L.open.slides[2].img);
    assert.equal((await slides(page))[2].layout, 'picture');
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('several pictures get a slide each, and a picture let go on a slide in the list goes on that slide', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await lesson(page, [{ layout: 'title', title: 'Ads' }, { layout: 'agenda', title: 'Agenda', body: 'Warm-up' }, { layout: 'content', title: 'Look closely', body: '' }], 0);
    await page.waitForSelector('#lsThumbs .ls-th[data-go="2"]');
    // three pictures on the third slide in the list, while the first is open
    await dropPics(page, '#lsThumbs .ls-th[data-go="2"] .ls-mini', 3);
    await page.waitForFunction(() => window.__planner.L.open.slides.length === 5 && window.__planner.L.open.slides.slice(2).every(s => s.img));
    assert.deepEqual((await slides(page)).map(s => s.layout), ['title', 'agenda', 'picture', 'picture', 'picture']);
    assert.equal((await slides(page))[2].title, 'Look closely');
    assert.equal(await cur(page), 4);
    await page.waitForFunction(() => /3 pictures, one on each slide/.test(document.body.textContent));
    // on a slide that can't hold a picture (the agenda), it gets a new slide right after it
    await dropPics(page, '#lsThumbs .ls-th[data-go="1"]', 1);
    await page.waitForFunction(() => window.__planner.L.open.slides.length === 6);
    assert.deepEqual((await slides(page)).map(s => s.layout), ['title', 'agenda', 'picture', 'picture', 'picture', 'picture']);
    assert.equal(await cur(page), 2);
    assert.equal((await slides(page))[1].img, null);
    // dragging a slide in the list still reorders, and marks nothing as a place to drop
    await page.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/x-slide', '5'); const t = document.querySelector('#lsThumbs .ls-th[data-go="3"]'); t.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); t.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
    await page.waitForFunction(() => window.__planner.L.cur === 3);
    assert.equal(await page.$('#lsWrap.ls-dropping'), null);
    assert.equal((await slides(page)).length, 6);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('Full picture: the picture is the whole slide, in the editor, presenting and the .pptx', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await lesson(page, [{ layout: 'title', title: 'Ads' }, { layout: 'picture', title: 'The poster' }], 1);
    await page.waitForSelector('#lsStage .ls-pic');
    await dropPics(page, '#lsStage', 1, 800, 450);
    await page.waitForSelector('#lsStage .ls-pic img');
    const small = await box(page, '#lsStage .ls-pic img');
    // the picker has both new layouts, drawn like the rest
    await page.click('[data-a="layout"]'); await page.waitForSelector('#dlgBox [data-addslide="fullpic"]');
    assert.ok(await page.$('#dlgBox [data-addslide="textpic"] .ls-pic img'));
    await page.click('#dlgBox [data-addslide="fullpic"]');
    await page.waitForSelector('#lsStage .ls-full img');
    const big = await box(page, '#lsStage .ls-full img');
    assert.deepEqual([big.x, big.y, big.w, big.h], [0, 0, 1280, 692], 'the whole slide above the source line');
    assert.ok(big.w * big.h > 2.5 * small.w * small.h, 'much bigger than on a Picture slide');
    assert.equal(await page.$('#lsStage .ls-t'), null, 'no title on the slide');
    assert.equal(await page.$('.ls-tools [data-f="size"]'), null);
    assert.equal(await page.evaluate(() => window.__planner.L.open.slides[1].title), 'The poster', 'its name is kept');
    // the source line is typed under it
    await page.click('#lsStage .ls-fullsrc'); await page.keyboard.type('Museum of Made-up Posters'); await page.click('.ls-notes textarea');
    await page.waitForFunction(() => window.__planner.L.open.slides[1].img.source === 'Museum of Made-up Posters');
    assert.match(await page.evaluate(() => window.__planner.lessonText(window.__planner.L.open)), /## Slide 2 \(Full picture\)\nTitle: The poster\n\[Picture: Museum of Made-up Posters\]/);
    // presenting shows the same slide
    await page.click('[data-pr="present"]'); await page.waitForSelector('#present .ls-full img');
    await page.evaluate(() => window.__present.end());
    // the .pptx: the look's background over the slide, then the picture, then the source line at 10 pt
    const x = await pptx(page, 2);
    assert.equal(x.layout, 'Title Only');
    assert.ok(x.xml.includes('<a:off x="0" y="0"/><a:ext cx="' + Math.round(1280 * x.kx) + '" cy="' + Math.round(720 * x.ky) + '"/>'), 'the background over the whole slide');
    assert.ok(x.xml.indexOf('name="Title 1"') < x.xml.indexOf('name="Shape 8"') && x.xml.indexOf('name="Shape 8"') < x.xml.indexOf('<p:pic>'), 'title, then the cover, then the picture');
    const p = picAt(x);
    assert.ok(Math.abs(p.w / p.h - 800 / 450) < 0.01, 'the picture keeps its shape');
    assert.ok(Math.abs(p.w - 1280 * x.kx) < 2 || Math.abs(p.h - 692 * x.ky) < 2, 'as big as the slide allows');
    assert.ok(p.x >= -1 && p.y >= -1 && p.x + p.w <= 1280 * x.kx + 1 && p.y + p.h <= 692 * x.ky + 1);
    assert.match(x.xml, /sz="1000"[^>]*>[\s\S]*?Museum of Made-up Posters/);
    // it goes to the Planner folder and comes back the same
    const back = await page.evaluate(() => { const P = window.__planner, imgs = new Map(), f = P.lessonForFile(P.L.open, imgs); return { layout: f.slides[1].layout, src: f.slides[1].img.src, files: [...imgs.keys()], again: P.normLesson(f).slides[1].layout }; });
    assert.equal(back.layout, 'fullpic'); assert.equal(back.again, 'fullpic'); assert.deepEqual(back.files, [back.src]); assert.match(back.src, /^images\/.+\.png$/);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});
