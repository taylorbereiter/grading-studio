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

test('working with Claude: notes and comments go out, Claude’s changes come back slide by slide, and nothing is forced', async () => {
  const a = await open();
  try {
    const { page } = a;
    await page.evaluate(async s => { await window.__planner.applySetup(s); window.open = () => null; }, SETUP);
    const setupDir = await page.evaluate(async () => {
      const P = window.__planner, root = await navigator.storage.getDirectory(), dir = await root.getDirectoryHandle('loop-' + Date.now(), { create: true });
      P.L.dir = dir; P.L.dirOk = true;
      const l = P.normLesson({ title: 'Appeals', slots: [{ classId: 'A1', date: '2026-11-03' }], slides: [{ id: 's1', layout: 'title', title: 'Appeals' }, { id: 's2', layout: 'content', title: 'Warm-up', body: 'An ad you remember' }, { id: 's3', layout: 'content', title: 'Old slide', body: 'Cut me?' }] });
      P.L.lessons.push(l); await P.folderWriteAll(); P.openLessonForTest(l, 1); return true;
    });
    assert.ok(setupDir);
    await page.waitForSelector('[data-f="ask"]');
    await page.type('[data-f="ask"]', 'Make this a journal prompt');
    await page.type('[data-f="say"]', 'Shorter, please'); await page.keyboard.press('Enter');
    await page.waitForSelector('.pl-msg.me');
    await page.click('[data-a="send"]');
    await page.waitForSelector('.pl-st.st-claude');
    let r = await page.evaluate(async () => { const P = window.__planner, l = P.L.open; return { status: l.status, vers: ((await P.versions(l)) || []).map(v => v.label), ask: l.slides[1].ask, talk: l.slides[1].talk.length }; });
    assert.deepEqual(r, { status: 'claude', vers: ['Sent to Claude'], ask: 'Make this a journal prompt', talk: 1 });

    // Claude edits the file: changes slide 2, takes out slide 3, adds a slide, replies, sets review
    await new Promise(res => setTimeout(res, 3200));
    await page.evaluate(async () => {
      const P = window.__planner, l = P.L.open, fh = await P.L.dir.getFileHandle(l._file), j = JSON.parse(await (await fh.getFile()).text());
      j.slides[1].body = 'Think of an ad that made you want something.\nWhat did it do to convince you?'; j.slides[1].title = 'Warm-up: journal';
      j.slides[1].talk.push({ by: 'claude', text: 'Made it two short lines.' });
      j.slides.splice(2, 1); j.slides.push({ id: 's4', layout: 'content', title: 'Exit ticket', body: 'Which appeal was strongest?' });
      j.status = 'review'; j.claudeNote = 'Turned slide 2 into a journal prompt and added an exit ticket.';
      const w = await fh.createWritable(); await w.write(JSON.stringify(j)); await w.close();
      await P.folderRead(false); P.renderLessons();
    });
    await page.waitForSelector('.pl-claude.pending');
    assert.match(await page.$eval('.pl-claude.pending', e => e.textContent), /3 slides changed.*journal prompt/);
    assert.match(await page.$eval('.ls-top', e => e.textContent), /Ready for you/);
    // keep Claude's slide 2 and new slide, but keep my slide 3
    await page.click('[data-a="cmp"]');
    await page.waitForSelector('.pl-crow');
    assert.equal(await page.$$eval('.pl-crow', r => r.length), 3);
    const kinds = await page.$$eval('.pl-crow .pl-ch', h => h.map(x => x.textContent));
    assert.deepEqual(kinds, ['Slide 2 changed', 'Claude added a slide', 'Claude took out a slide']);
    await page.click('.pl-crow[data-i="2"] .pl-side input[value="mine"]');
    await page.click('[data-ok]');
    await page.waitForFunction(() => !document.querySelector('.pl-claude.pending'));
    r = await page.evaluate(() => { const l = window.__planner.L.open; return { ids: l.slides.map(s => s.id), t2: l.slides[1].title, talk: l.slides[1].talk.map(t => t.by), pending: !!l.pending }; });
    assert.deepEqual(r, { ids: ['s1', 's2', 's3', 's4'], t2: 'Warm-up: journal', talk: ['you', 'claude'], pending: false });
    // versions: going back to the one sent to Claude
    const back = await page.evaluate(async () => { const P = window.__planner; return (await P.versions(P.L.open)).map(v => v.label); });
    assert.deepEqual(back, ['Before Claude’s changes', 'Sent to Claude']);
    await page.click('[data-a="versions"]');
    await page.waitForSelector('[data-rv="1"]'); await page.click('[data-rv="1"]');
    await page.waitForFunction(() => window.__planner.L.open.slides[1].title === 'Warm-up');
    // there's no Approve: the lesson is always editable
    assert.equal(await page.$('[data-a="approve"]'), null);
    await page.click('.ls-stage .ls-body');
    await page.waitForSelector('.ls-ta');
    // the file never carries the pending copy
    const file = await page.evaluate(async () => { const P = window.__planner; await new Promise(r => setTimeout(r, 1200)); return JSON.parse(await (await (await P.L.dir.getFileHandle(P.L.open._file)).getFile()).text()); });
    assert.equal(file.pending, undefined);
    assert.equal(file.slides[1].ask, 'Make this a journal prompt');
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});

test('the activity bank: filter, add one to a lesson as a steps slide, and keep my own activities', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(async s => { await window.__planner.applySetup(s); }, SETUP);
    await page.click('[data-a="tab"][data-v="activities"]');
    await page.waitForSelector('.pl-act');
    const all = await page.$$eval('.pl-act', c => c.length);
    assert.ok(all >= 30, 'the bank starts with plenty of activities');
    await page.click('[data-a="actpart"][data-v="warmup"]');
    await page.waitForSelector('[data-a="actpart"][data-v="warmup"].on');
    const warm = await page.$$eval('.pl-act', c => c.length);
    assert.ok(warm > 0 && warm < all, 'the warm-up filter narrows the list');
    await page.click('[data-a="actpart"][data-v=""]');
    await page.waitForSelector('[data-a="actpart"][data-v=""].on');
    await page.type('[data-f="actq"]', 'fishbowl');
    await page.waitForFunction(() => document.querySelectorAll('.pl-act').length === 1);
    assert.match(await page.$eval('.pl-act h3', h => h.textContent), /Fishbowl/i);

    // into a new lesson: a slide with the student steps, the how-to in the notes
    await page.click('[data-a="useact"]');
    await page.waitForSelector('#dlgBox [data-newl]');
    await page.click('#dlgBox [data-newl]');
    await page.waitForFunction(() => window.__planner.L.view === 'edit');
    const s = await page.evaluate(() => { const L = window.__planner.L, s = L.open.slides[L.cur]; return { n: L.open.slides.length, layout: s.layout, body: s.body, notes: s.notes }; });
    assert.equal(s.n, 2); assert.equal(s.layout, 'steps'); assert.ok(s.body.split('\n').length >= 2); assert.match(s.notes, /^How to run it:/);
    assert.match(await page.$eval('[data-a="back"]', b => b.textContent), /Activities/);
    await page.click('[data-a="back"]');
    await page.waitForSelector('.pl-bank');

    // my own activity
    await page.click('[data-a="newact"]');
    await page.waitForSelector('#aeN');
    await page.type('#aeN', 'Four corners debate');
    await page.type('#aeH', 'Post four positions\nStudents move\nEach corner explains');
    await page.type('#aeS', 'Pick a corner\nTalk with your corner');
    await page.click('#dlgBox [data-ok]');
    await page.waitForFunction(() => [...document.querySelectorAll('.pl-act h3')].some(h => h.textContent === 'Four corners debate'));
    assert.ok(await page.$('.pl-act [data-a="editact"]'));
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('looks and teaching layouts: every layout in every look, edited in place, and the same boxes in the .pptx', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    const tpl = fs.readFileSync(path.join(__dirname, 'fixtures', 'lesson-template.b64'), 'utf8').trim();
    await page.evaluate(async (s, tpl) => { await window.__planner.applySetup({ ...s, template: tpl }); }, SETUP, tpl);
    // every layout draws in every look, and text stays between 28 and 36 pt (only a picture's source line is smaller)
    const r = await page.evaluate(() => {
      const P = window.__planner, out = { n: 0, bad: [] };
      for (const look of Object.keys(P.LOOKS)) for (const k of Object.keys(P.TEACH_SAMPLE)) {
        const s = P.normLesson({ slides: [{ layout: k, ...(P.TEACH[k] || {}), ...P.TEACH_SAMPLE[k] }] }).slides[0];
        const d = document.createElement('div'); d.className = 'ls-slide'; d.innerHTML = P.slideHtml(s, { slots: [], slides: [s], look }, false);
        document.querySelector('#lessons').appendChild(d);
        if (!d.querySelector('.lk-' + look)) out.bad.push(look + '/' + k + ' no look');
        for (const b of d.querySelectorAll('.ls-bx')) { const pt = parseFloat(getComputedStyle(b).fontSize) * 3 / 4; if (pt < 27.9 || pt > 36.1) out.bad.push(look + '/' + k + ' ' + pt); }
        d.remove(); out.n++;
      }
      return out;
    });
    assert.equal(r.n, 14 * 15); assert.deepEqual(r.bad, []);

    // a lesson in Sage: add a Two columns slide from the picker and type into a heading and the right side
    await page.evaluate(async () => { const P = window.__planner, l = P.normLesson({ title: 'Looks', slides: [{ layout: 'title', title: 'Looks' }] }); P.L.lessons.push(l); P.openLessonForTest(l, 0); });
    await page.waitForSelector('.ls-stage');
    await page.click('[data-a="look"]'); await page.waitForSelector('[data-look="sage"]'); await page.click('[data-look="sage"]'); await page.click('#dlgBox [data-x]');
    assert.match(await page.$eval('[data-a="look"]', b => b.textContent), /Sage/);
    await page.click('[data-a="addslide"]'); await page.waitForSelector('#dlgBox [data-addslide="twocol"]'); await page.click('#dlgBox [data-addslide="twocol"]');
    await page.waitForSelector('#lsStage .ls-bx[data-k="h1"]');
    await page.click('#lsStage .ls-bx[data-k="h1"]'); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.keyboard.type('Claim'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__planner.L.open.slides[1].h1 === 'Claim' && document.querySelector('#lsStage .ls-bx[data-k="h1"]'));
    await page.click('#lsStage .ls-bx[data-k="body2"]'); await page.keyboard.type('First reason\nSecond reason');
    await page.click('.ls-notes textarea');
    await page.waitForFunction(() => window.__planner.L.open.slides[1].body2 === 'First reason\nSecond reason');
    const s = await page.evaluate(() => window.__planner.L.open.slides[1]);
    assert.equal(s.layout, 'twocol'); assert.equal(s.h1, 'Claim');
    assert.ok(await page.$('#lsStage .lk-sage'));

    // the .pptx: the look's background with the template's pictures hidden; the teaching slide on Title Only, its boxes as text
    const x = await page.evaluate(() => { const P = window.__planner, z = fflate.unzipSync(P.buildPptx(P.L.open)), td = new TextDecoder(); return { xml: td.decode(z['ppt/slides/slide2.xml']), rels: td.decode(z['ppt/slides/_rels/slide2.xml.rels']), title: td.decode(z['ppt/slides/slide1.xml']) }; });
    assert.match(x.xml, /<p:sld [^>]*showMasterSp="0"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="EEF3EC"\/>/);
    assert.match(x.xml, />Claim<\/a:t>/); assert.match(x.xml, />First reason<\/a:t>[\s\S]*>Second reason<\/a:t>/);
    assert.match(x.xml, /<a:buChar char="•"\/>/);
    for (const m of x.xml.matchAll(/ sz="(\d+)"/g)) assert.ok(+m[1] >= 2800 && +m[1] <= 3600, 'text size ' + m[1]);
    assert.match(x.title, /showMasterSp="0"/);
    const only = await page.evaluate(() => { const z = fflate.unzipSync(window.__planner.buildPptx(window.__planner.L.open)), td = new TextDecoder(); const t = /Target="\.\.\/slideLayouts\/([^"]+)"/.exec(td.decode(z['ppt/slides/_rels/slide2.xml.rels']))[1]; return /<p:cSld name="([^"]+)"/.exec(td.decode(z['ppt/slideLayouts/' + t]))[1]; });
    assert.equal(only, 'Title Only');
    // the template's own look keeps the template's background
    const wood = await page.evaluate(() => { const P = window.__planner, z = fflate.unzipSync(P.buildPptx({ ...P.L.open, look: 'wood' })); return new TextDecoder().decode(z['ppt/slides/slide2.xml']); });
    assert.ok(!/showMasterSp/.test(wood) && !/<p:bg>/.test(wood));
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('the layout picker shows pictures, changes a slide and keeps its text; lessons link to Atlas', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(async s => { await window.__planner.applySetup(s); }, SETUP);
    await page.evaluate(async () => {
      const P = window.__planner, u = P.normUnit({ course: 'Course A', title: 'Unit 2: Argument', start: '2026-10-26', atlas: 'https://example.org/unit2', weeks: [{ focus: 'Claims' }, { focus: 'Evidence' }] });
      await P.unitPut(u, true);
      const l = P.normLesson({ title: 'Claims', slots: [{ classId: 'A1', date: '2026-11-03' }], slides: [{ layout: 'title', title: 'Claims' }, { layout: 'content', title: 'Big question', body: 'Is a claim the same as an opinion?' }] });
      P.L.lessons.push(l); P.openLessonForTest(l, 1);
    });
    await page.waitForSelector('.ls-stage');
    // the unit's Atlas link shows on the lesson; a lesson's own link wins
    assert.equal(await page.$eval('.ls-top a[href^="https://example.org"]', x => x.getAttribute('href')), 'https://example.org/unit2');
    await page.click('[data-a="atlas"]'); await page.waitForSelector('#atU'); await page.type('#atU', 'https://example.org/lesson'); await page.click('#dlgBox [data-ok]');
    await page.waitForFunction(() => document.querySelector('.ls-top a[href="https://example.org/lesson"]'));
    // Layout: pictures of every layout, the current one marked
    await page.click('[data-a="layout"]');
    await page.waitForSelector('#dlgBox .pl-look.on[data-addslide="content"] .pl-lmini');
    assert.equal(await page.$$eval('#dlgBox [data-addslide]', b => b.length), 15);
    await page.click('#dlgBox [data-addslide="discuss"]');
    await page.waitForSelector('#lsStage .ls-bx[data-k="foot"]');
    const s = await page.evaluate(() => window.__planner.L.open.slides[1]);
    assert.equal(s.layout, 'discuss'); assert.equal(s.title, 'Big question'); assert.equal(s.body, 'Is a claim the same as an opinion?');
    assert.match(s.foot, /Talk with a partner/);
    assert.match(await page.$eval('[data-a="layout"]', b => b.textContent), /Discussion question/);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});
