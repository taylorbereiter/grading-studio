// A lesson file to share (.gslesson): one small file that opens again as the same lesson in another Grading Studio,
// with its pictures, materials and finished deck, and without classes, dates, taught notes or anything for Claude.
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
  await page.evaluate(async s => { await window.__planner.applySetup(s); }, SETUP);
  return { server, browser, page, errors, done: async () => { await browser.close(); await server.close(); } };
}
const until = async (page, fn, ms = 8000) => { const t = Date.now(); for (;;) { if (await page.evaluate(fn)) return; if (Date.now() - t > ms) throw new Error('timed out: ' + fn); await new Promise(r => setTimeout(r, 50)); } };

test('Share lesson file saves a small file that opens again as the same lesson, without what belongs to this teacher', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    // A made-up lesson with a picture, two materials, a finished deck, and things that must stay behind.
    await page.evaluate(async () => {
      const P = window.__planner, c = document.createElement('canvas'); c.width = 40; c.height = 30; c.getContext('2d').fillRect(0, 0, 40, 30);
      const pic = c.toDataURL('image/png');
      const l = P.normLesson({ title: 'Tide pools', look: 'white', fmt: 2, note: 'Bring the tank', slots: [{ classId: 'A1', date: '2026-11-10' }],
        taught: [{ classId: 'A1', date: '2026-11-10', slide: 2, of: 3, note: 'stopped at the map' }], talk: [{ by: 'you', text: 'Claude, tighten this' }], claudeNote: 'Done',
        slides: [{ layout: 'title', title: 'Tide pools' }, { layout: 'agenda', title: 'Agenda', body: '• Look\n• Sketch' },
          { layout: 'textpic', title: 'What lives there', body: '• Crabs', notes: 'Ask who has been to the coast', ask: 'Find a better picture', img: { src: pic, w: 40, h: 30, source: 'Made-up' },
            ctx: [{ src: pic, w: 40, h: 30, note: 'a screenshot for Claude' }], talk: [{ by: 'claude', text: 'Swapped the order' }] }] });
      P.L.lessons.push(l); P.openLessonForTest(l, 0);
      await P.matAdd({ t: 'lesson', id: l.id }, [new File(['%PDF-1.4 made-up handout'], 'Pool handout.pdf', { type: 'application/pdf' }), new File(['made-up key'], 'Answer key.txt', { type: 'text/plain' })]);
      await P.finUpload(l, new File([P.buildPptx(l)], 'Tide pools final.pptx'));
      // the finished deck's slides replace these ones; what a teacher adds afterwards rides on them
      const s = P.L.open.slides[2]; s.notes = 'Ask who has been to the coast'; s.ask = 'Find a better picture'; s.ctx = [{ id: 'c1', src: pic, w: 40, h: 30, note: 'a screenshot for Claude' }]; s.talk = [{ by: 'claude', text: 'Swapped the order', at: 1 }];
    });
    await until(page, () => window.__planner.L.open.final && window.__planner.L.open.files.length === 2);

    // It sits in More, above the file for Claude
    await page.click('.ls-top [data-a="more"]');
    const items = await page.$$eval('.ls-menu .mi', x => x.map(e => e.firstChild.textContent.trim()));
    assert.ok(items.indexOf('Share lesson file…') >= 0 && items.indexOf('Share lesson file…') + 1 === items.indexOf('Save lesson file for Claude…'));
    await page.evaluate(() => { window.__saved = []; const o = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__saved.push(this.download); return; } return o.call(this); }; });
    await page.click('.ls-menu [data-a="mshare"]');
    await until(page, () => window.__saved.length);
    assert.deepEqual(await page.evaluate(() => window.__saved), ['Tide pools.gslesson']);
    assert.match(await page.$eval('.toast', t => t.textContent), /Saved “Tide pools\.gslesson” \(\d+ KB\)/);

    // What is inside
    const inside = await page.evaluate(async () => {
      const P = window.__planner, z = fflate.unzipSync(await P.shareBuild(P.L.open)), j = JSON.parse(fflate.strFromU8(z['gslesson.json']));
      window.__file = new File([fflate.zipSync(z)], 'Tide pools.gslesson');
      return { names: Object.keys(z).sort(), j };
    });
    assert.equal(inside.j.kind, 'grading-studio-lesson');
    assert.deepEqual(inside.names.filter(n => !n.startsWith('images/')), ['README.txt', 'files/Answer key.txt', 'files/Pool handout.pdf', 'final/Tide pools final.pptx', 'gslesson.json']);
    assert.equal(inside.names.filter(n => n.startsWith('images/')).length, 1, 'one picture, and no screenshot for Claude');
    const L0 = inside.j.lesson;
    for (const k of ['slots', 'taught', 'talk', 'claudeNote', 'files', 'final', 'finals']) assert.equal(L0[k], undefined, k + ' stays behind');
    const s3 = L0.slides[2];
    assert.ok(s3, 'the slide is there: ' + JSON.stringify(L0.slides.map(s => [s.layout, s.title, !!s.img])));
    assert.equal(s3.notes, 'Ask who has been to the coast');
    for (const k of ['ask', 'talk', 'ctx']) assert.equal(s3[k], undefined, 'slide ' + k + ' stays behind');
    assert.match(s3.img.src, /^images\/.+\.png$/);
    assert.equal(L0.note, 'Bring the tank');

    // On another computer: nothing there yet. Opening the file gives the whole lesson back.
    await page.evaluate(async () => { const P = window.__planner; P.L.lessons.length = 0; await P.shareOpen(window.__file); });
    await until(page, () => window.__planner.L.lessons.length === 1 && window.__planner.L.open && window.__planner.L.open.title === 'Tide pools');
    const got = await page.evaluate(async () => {
      const l = window.__planner.L.open, s = l.slides[2];
      return { slots: l.slots, taught: l.taught, talk: l.talk, pic: s.img && s.img.src.slice(0, 22), notes: s.notes, files: l.files.map(f => f.name).sort(), final: l.final && l.final.name, slides: l.slides.length };
    });
    assert.deepEqual(got.slots, []);
    assert.equal(got.taught, undefined); assert.equal(got.talk, undefined);
    assert.equal(got.pic, 'data:image/png;base64,');
    assert.equal(got.notes, 'Ask who has been to the coast');
    assert.deepEqual(got.files, ['Answer key.txt', 'Pool handout.pdf']);
    assert.equal(got.final, 'Tide pools final.pptx');
    assert.equal(got.slides, 3);
    assert.match(await page.$eval('.toast', t => t.textContent), /Opened “Tide pools”: 3 slides, 2 materials, the finished PowerPoint\. It is under Not on the timetable/);
    // The finished deck still matches the slides, so Download .pptx gives the finished file
    assert.ok(await page.evaluate(() => { const l = window.__planner.L.open; return l.final.sig && l.final.size > 0; }));

    // Opening it again never replaces the lesson: it comes in as a separate copy. Dropped on the Planner works too.
    await page.evaluate(() => { const dt = new DataTransfer(); dt.items.add(window.__file); document.querySelector('#lessons').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
    await until(page, () => window.__planner.L.lessons.length === 2);
    assert.match(await page.$eval('.toast', t => t.textContent), /separate copy/);
    const ids = await page.evaluate(() => window.__planner.L.lessons.map(l => l.id));
    assert.notEqual(ids[0], ids[1]);

    // Something that isn't a lesson file says so
    await page.evaluate(async () => { await window.__planner.shareOpen(new File([fflate.zipSync({ 'a.txt': new Uint8Array([1]) })], 'x.gslesson')); });
    assert.match(await page.$eval('.toast', t => t.textContent), /isn’t a lesson file/);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});
