// The Planner: its own page, kept apart from grading. Units, the semester view, Atlas screenshots and unit files,
// and the Planner folder. Made-up classes only.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { serve } = require('./helpers/serve');
const { launch } = require('./helpers/chrome');
const ROOT = path.join(__dirname, '..');
const PAGE = () => fs.readFileSync(path.join(ROOT, 'planner.html'), 'utf8');

const SETUP = {
  kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-08-31', semEnd: '2027-01-18',
  classes: [
    { id: 'A1', name: 'Course A-1', course: 'Course A', color: '#1F6FB2', meets: [{ dow: 2, start: '09:00', end: '10:30', label: 'Block 1' }, { dow: 4, start: '09:00', end: '10:30' }] },
    { id: 'A2', name: 'Course A-2', course: 'Course A', color: '#7B3FC4', meets: [{ dow: 3, start: '13:00', end: '14:30' }] },
    { id: 'B1', name: 'Course B-1', course: 'Course B', color: '#B71E42', meets: [{ dow: 2, start: '14:45', end: '16:15' }, { dow: 5, start: '11:00', end: '11:45' }] }
  ],
  daysOff: [{ date: '2026-11-06', label: 'Day off' }], events: [{ date: '2026-11-09', to: '2026-11-13', label: 'Midterms' }]
};

async function open() {
  const server = await serve(PAGE);
  const browser = await launch(), page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
  return { server, browser, page, errors, done: async () => { await browser.close(); await server.close(); } };
}

test('the Planner page carries none of the grading code', () => {
  const html = PAGE();
  for (const s of ['gs-folder.json', 'pdfjsLib', 'PDFLib', 'mammoth', 'gsData', 'indexedDB.open(\'gs\'']) {
    if (s === 'gs-folder.json') continue;   // named once, only to refuse the grading folder
    assert.ok(!html.includes(s), 'planner.html should not contain ' + s);
  }
  assert.ok(!fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('function renderSemester'), 'grading page should not carry the Planner');
  for (const f of fs.readdirSync(path.join(ROOT, 'src', 'planner')).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'planner', f), 'utf8');
    assert.ok(!/indexedDB\.open\(\s*'(?!gs-lessons)/.test(src), f + ' opens only the Planner database');
  }
});

test('units line up with the semester and the week, and screenshots and files stay with the unit', async () => {
  const a = await open();
  try {
    const { page } = a;
    await page.evaluate(async s => { await window.__planner.applySetup(s); }, SETUP);
    // semester view: every week from the first to the last
    await page.evaluate(() => { window.__planner.L.view = 'semester'; window.__planner.renderLessons(); });
    assert.equal(await page.$$eval('.pl-row[data-wk]', r => r.length), 21);
    assert.deepEqual(await page.$$eval('.pl-head .pl-cc', c => c.map(x => x.textContent)), ['Course A', 'Course B']);

    // a unit for Course A from Week 9 (Oct 26), three weeks
    await page.evaluate(async () => {
      const P = window.__planner, u = P.normUnit({ course: 'Course A', title: 'Unit 2: Argument', start: '2026-10-28', weeks: [{ focus: 'Claims and counterclaims' }, { focus: 'Evidence' }, { focus: 'Draft' }] });
      await P.unitPut(u, true); P.L.view = 'semester'; P.renderLessons();
    });
    const cell = await page.$eval('.pl-row[data-wk="2026-11-02"] .pl-cell', c => c.textContent);
    assert.match(cell, /Week 2 of 3/); assert.match(cell, /Evidence/);
    assert.match(await page.$eval('.pl-row[data-wk="2026-11-02"] .pl-wkc', c => c.textContent), /Week 10.*Day off/);
    assert.match(await page.$eval('.pl-row[data-wk="2026-11-09"] .pl-wkc', c => c.textContent), /Midterms/);
    assert.match(await page.$eval('.pl-row[data-wk="2026-11-16"] .pl-cell', c => c.textContent), /No unit/);

    // clicking a week opens the week view with the unit strip
    await page.click('.pl-row[data-wk="2026-11-02"] .pl-cell');
    await page.waitForSelector('.pl-wbar');
    assert.match(await page.$eval('.pl-wbar', b => b.textContent), /Unit 2: Argument.*Week 2 of 3: Evidence/);
    assert.match(await page.$eval('.pl-wbar', b => b.textContent), /Course B.*No unit this week/);

    // open the unit; paste a screenshot, add a file
    await page.click('[data-a="openunit"]');
    await page.waitForSelector('.pl-unit');
    assert.equal(await page.$$eval('.pl-week', w => w.length), 3);
    await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 400; c.height = 200; c.getContext('2d').fillRect(0, 0, 40, 40);
      const b = await new Promise(r => c.toBlob(r, 'image/png'));
      const dt = new DataTransfer(); dt.items.add(new File([b], 'image.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await page.waitForSelector('.pl-shot img[src^="blob:"]');
    assert.equal(await page.$eval('.pl-shot figcaption', f => f.firstChild.textContent), 'Atlas 1.png');
    await page.evaluate(async () => { const P = window.__planner; await P.addUnitFiles(P.L.unit, [new File(['task'], 'Summative task sheet.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })], null); });
    await page.waitForSelector('.pl-file');
    assert.match(await page.$eval('.pl-file', f => f.textContent), /Summative task sheet\.docx.*Summative/);
    assert.ok(!(await page.$eval('[data-a="askweeks"]', b => b.disabled)), 'Ask Claude is ready once there is a screenshot');

    // typing a week's notes saves it
    await page.type('[data-uw="notes"][data-i="0"]', 'Bring the debate cards');
    await page.waitForFunction(() => document.querySelector('#plSaved').textContent === '✓ Saved');
    const saved = await page.evaluate(async () => { const P = window.__planner; return P.L.units[0].weeks[0].notes; });
    assert.equal(saved, 'Bring the debate cards');

    // pasting weeks as text
    await page.click('[data-a="pasteweeks"]');
    await page.$eval('#pwT', t => { t.value = 'Week 1: Claims\nWeek 2: Evidence and reasoning\nWeek 3: Drafting\nWeek 4: Peer review'; });
    await page.click('[data-ok]');
    await page.waitForFunction(() => document.querySelectorAll('.pl-week').length === 4);
    const u = await page.evaluate(() => window.__planner.L.units[0]);
    assert.deepEqual(u.weeks.map(w => w.focus), ['Claims', 'Evidence and reasoning', 'Drafting', 'Peer review']);
    assert.equal(u.weeks[0].notes, 'Bring the debate cards', 'her notes stay');

    // the units list
    await page.click('[data-a="uback"]');
    await page.evaluate(() => { window.__planner.L.view = 'units'; window.__planner.renderLessons(); });
    assert.match(await page.$eval('.pl-ucard', c => c.textContent), /Unit 2: Argument.*4 weeks.*2 files/);
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});

test('the Planner folder gets units and their files, takes Claude’s week edits back, and refuses the grading folder', async () => {
  const a = await open();
  try {
    const { page } = a;
    const r = await page.evaluate(async s => {
      const P = window.__planner;
      await P.applySetup(s);
      const root = await navigator.storage.getDirectory(), dir = await root.getDirectoryHandle('plan-' + Date.now(), { create: true });
      // a grading folder is refused
      const g = await root.getDirectoryHandle('grading-' + Date.now(), { create: true }); await g.getFileHandle('gs-folder.json', { create: true });
      const g2 = await root.getDirectoryHandle('parent-' + Date.now(), { create: true }); await g2.getDirectoryHandle('Grading Studio', { create: true });
      const refused = [!!(await P.notGradingFolder(g)), !!(await P.notGradingFolder(g2)), !!(await P.notGradingFolder(dir))];
      P.L.dir = dir; P.L.dirOk = true;
      const u = P.normUnit({ course: 'Course A', title: 'Unit 1', start: '2026-08-31', weeks: [{}, {}] });
      P.L.units.push(u);
      await P.addUnitFiles(u, [new File(['png'], 'Atlas 1.png', { type: 'image/png' })], 'atlas');
      await P.folderWriteAll();
      const names = []; for await (const [n] of dir.entries()) names.push(n);
      const ud = await dir.getDirectoryHandle('Units'), unames = []; for await (const [n] of ud.entries()) unames.push(n);
      const fd = await ud.getDirectoryHandle('Course A - Unit 1 files'), fnames = []; for await (const [n] of fd.entries()) fnames.push(n);
      // Claude fills the weeks in the file
      await new Promise(r => setTimeout(r, 3200));   // past the app’s own delayed write and its 1.5 s margin
      const fh = await ud.getFileHandle('Course A - Unit 1.unit.json'), j = JSON.parse(await (await fh.getFile()).text());
      j.weeks = [{ focus: 'Intro to the novel', standards: 'RL.1' }, { focus: 'Chapters 1-3', notes: '' }];
      const w = await fh.createWritable(); await w.write(JSON.stringify(j)); await w.close();
      await P.folderRead(false);
      const back = P.L.units.find(x => x.id === u.id);
      return { refused, names: names.sort(), unames: unames.sort(), fnames, weeks: back.weeks.map(x => x.focus + '|' + x.standards), files: back.files.length };
    }, SETUP);
    assert.deepEqual(r.refused, [true, true, false]);
    assert.ok(r.names.includes('planner-folder.json') && r.names.includes('README - for Claude.md') && r.names.includes('timetable.json') && r.names.includes('Units'), r.names.join(', '));
    assert.deepEqual(r.unames, ['Course A - Unit 1 files', 'Course A - Unit 1.unit.json']);
    assert.deepEqual(r.fnames, ['Atlas 1.png']);
    assert.deepEqual(r.weeks, ['Intro to the novel|RL.1', 'Chapters 1-3|']);
    assert.equal(r.files, 1, 'the files stay as the app has them');
    const tt = await page.evaluate(async () => { const d = window.__planner.L.dir; return JSON.parse(await (await (await d.getFileHandle('timetable.json')).getFile()).text()); });
    assert.equal(tt.template, undefined, 'no template in the folder');
    assert.equal(tt.semStart, '2026-08-31');
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});

test('video slides: YouTube links of every kind, the pptx link, and pictures dragged or pasted in', async () => {
  const a = await open();
  try {
    const { page } = a;
    const tpl = fs.readFileSync(path.join(__dirname, 'fixtures', 'lesson-template.b64'), 'utf8').trim();
    await page.evaluate(async (s, tpl) => { await window.__planner.applySetup({ ...s, template: tpl }); }, SETUP, tpl);
    const ids = await page.evaluate(() => window.__planner.ytIds([
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s', 'https://youtu.be/dQw4w9WgXcQ?t=1m5s', 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://example.com/watch?v=dQw4w9WgXcQ']));
    assert.deepEqual(ids, [['dQw4w9WgXcQ', 90], ['dQw4w9WgXcQ', 65], ['dQw4w9WgXcQ', 0], ['dQw4w9WgXcQ', 0], ['dQw4w9WgXcQ', 0], ['', 0]]);
    // a lesson; paste a YouTube link: the empty bullets slide becomes a video slide (no network here, so no title or picture)
    await page.evaluate(async () => { const P = window.__planner, l = P.normLesson({ title: 'Video lesson', slides: [{ layout: 'title', title: 'Video lesson' }, { layout: 'content' }] }); P.L.lessons.push(l); P.openLessonForTest(l, 1); });
    await page.waitForSelector('.ls-stage');
    await page.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', 'https://youtu.be/dQw4w9WgXcQ?t=30'); document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })); });
    await page.waitForSelector('.ls-stage .ls-vid .ls-vlink, .ls-stage .ls-vid img');
    let l = await page.evaluate(() => window.__planner.L.open);
    assert.equal(l.slides.length, 2); assert.equal(l.slides[1].layout, 'video'); assert.equal(l.slides[1].video.start, 30);
    assert.match(await page.$eval('.ls-stage .ls-src', e => e.textContent), /YouTube · starts at 0:30/);
    // a picture dragged in from another tab (Chrome hands over the address in the HTML)
    await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 300; c.height = 200; c.getContext('2d').fillRect(10, 10, 50, 50);
      const dt = new DataTransfer(); dt.setData('text/html', '<img src="' + c.toDataURL('image/png') + '">');
      document.querySelector('.ls-stage').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    await page.waitForFunction(() => window.__planner.L.open.slides.length === 3 && window.__planner.L.open.slides[2].img);
    l = await page.evaluate(() => window.__planner.L.open);
    assert.equal(l.slides[2].layout, 'picture', 'a new picture slide after the video one');
    // the .pptx: the video slide links to the video
    const x = await page.evaluate(() => { const P = window.__planner, z = fflate.unzipSync(P.buildPptx(P.L.open)), td = new TextDecoder(); return { rels: td.decode(z['ppt/slides/_rels/slide2.xml.rels']), xml: td.decode(z['ppt/slides/slide2.xml']), pic: !!z['ppt/media/lesson3.png'] }; });
    assert.match(x.rels, /Type="[^"]+\/hyperlink" Target="https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ&amp;t=30s" TargetMode="External"/);
    assert.match(x.xml, /hlinkClick r:id="rIdLink"/);
    assert.ok(x.pic, 'the dragged picture is in the deck');
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});

test('light by default; slides keep their own light colors in dark mode', async () => {
  const a = await open();
  try {
    const { page } = a;
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    await page.click('.themeBtn');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    const bg = await page.evaluate(() => { const s = document.createElement('div'); s.className = 'ls-slide'; document.body.appendChild(s); const c = getComputedStyle(s).backgroundColor; s.remove(); return c; });
    assert.equal(bg, 'rgb(223, 219, 213)');
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});
