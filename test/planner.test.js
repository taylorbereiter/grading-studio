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
// What is used now and then on a lesson is in its More menu: open it, then click the item.
async function more(page, a) { await page.click('.ls-top [data-a="more"]'); await page.waitForSelector('.ls-menu:not([hidden])'); await page.click('.ls-menu [data-a="' + a + '"]'); }

test('the Planner page carries none of the grading code', () => {
  const html = PAGE();
  for (const s of ['gs-folder.json', 'PDFLib', 'gsData', 'indexedDB.open(\'gs\'']) {
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
    // Dark mode is under Find anything now (and in Settings on the grading page); the choice is shared with grading
    await page.click('#findBtn'); await page.type('#findIn', 'dark mode'); await page.keyboard.press('Enter');
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
    await more(page, 'send');
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
    await more(page, 'versions');
    await page.waitForSelector('[data-rv="1"]'); await page.click('[data-rv="1"]');
    await page.waitForFunction(() => window.__planner.L.open.slides[1].title === 'Warm-up');
    // there's no Approve: the lesson is always editable
    assert.equal(await page.$('[data-a="approve"]'), null);
    await page.click('.ls-stage .ls-body');
    await page.waitForSelector('.ls-rted');
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
    await page.click('#rail [data-v="activities"]');
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
    assert.equal(s.n, 3); assert.equal(s.layout, 'steps'); assert.ok(s.body.split('\n').length >= 2); assert.match(s.notes, /^How to run it:/);
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
    assert.equal(r.n, 14 * 17); assert.deepEqual(r.bad, []);

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
    await more(page, 'atlas'); await page.waitForSelector('#atU'); await page.type('#atU', 'https://example.org/lesson'); await page.click('#dlgBox [data-ok]');
    await page.waitForFunction(() => document.querySelector('.ls-top a[href="https://example.org/lesson"]'));
    // Layout: pictures of every layout, the current one marked
    await page.click('[data-a="layout"]');
    await page.waitForSelector('#dlgBox .pl-look.on[data-addslide="content"] .pl-lmini');
    assert.equal(await page.$$eval('#dlgBox [data-addslide]', b => b.length), 17);
    await page.click('#dlgBox [data-addslide="discuss"]');
    await page.waitForSelector('#lsStage .ls-bx[data-k="foot"]');
    const s = await page.evaluate(() => window.__planner.L.open.slides[1]);
    assert.equal(s.layout, 'discuss'); assert.equal(s.title, 'Big question'); assert.equal(s.body, '• Is a claim the same as an opinion?');   // a bullet stays a bullet; the new layout adds nothing
    assert.equal(s.foot, undefined);   // the new box starts empty, with a gray hint
    assert.ok(await page.$('#lsStage .ls-bx[data-k="foot"] .ls-ph'));
    assert.match(await page.$eval('[data-a="layout"]', b => b.textContent), /Discussion question/);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('a profile brings the timetable, units and a default look, and never replaces units already here', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    const prof = { ...SETUP, profile: 'Test profile', look: 'sage', units: [
      { id: 'p-a-u1', course: 'Course A', title: 'Unit 1: Stories', start: '2026-08-31', weeks: [{ focus: 'Openings' }, { focus: 'Endings' }] },
      { id: 'p-b-u1', course: 'Course B', title: 'Unit 1: Poems', start: '2026-09-07', weeks: [{ focus: 'Sound' }] }] };
    assert.match(await page.$eval('#lessons', d => d.textContent), /Tell the Planner when your classes meet[\s\S]*Load a setup file/);
    // dropped on the page
    await page.evaluate(p => { const dt = new DataTransfer(); dt.items.add(new File([JSON.stringify(p)], 'My profile.json', { type: 'application/json' })); document.querySelector('#lessons').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, prof);
    await page.waitForFunction(() => window.__planner.L.setup && window.__planner.L.units.length === 2);
    assert.match(await page.$eval('.toast', t => t.textContent), /Test profile loaded: 3 classes, 2 units/);
    assert.equal(await page.evaluate(() => window.__planner.L.defLook), 'sage');
    // loading it again keeps a unit she changed
    await page.evaluate(async p => { const P = window.__planner; P.L.units[0].weeks[0].notes = 'mine'; await P.applySetup(p); }, prof);
    assert.equal(await page.evaluate(() => window.__planner.L.units.length), 2);
    assert.equal(await page.evaluate(() => window.__planner.L.units[0].weeks[0].notes), 'mine');
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('the side panel: a book with its chapters and search, pages and slides into the Claude box, copied in one go', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(async s => { await window.__planner.applySetup(s); }, SETUP);
    await page.evaluate(async () => { const P = window.__planner, l = P.normLesson({ title: 'Talk', slides: [{ layout: 'title', title: 'Talk' }, { layout: 'content', title: 'Partners', body: 'Talk with a partner' }] }); P.L.lessons.push(l); P.openLessonForTest(l, 1); });
    await page.waitForSelector('.ls-stage');
    await page.click('.ls-top [data-a="panel"]');
    await page.waitForSelector('#side:not([hidden]) [data-sa="addbook"]');
    const [chooser] = await Promise.all([page.waitForFileChooser(), page.click('[data-sa="addbook"]')]);
    await chooser.accept([path.join(__dirname, 'fixtures', 'routines-sample.pdf')]);
    // the PDF's own chapter list, with page numbers
    await page.waitForFunction(() => document.querySelectorAll('#spToc .sp-toci').length === 4);
    assert.deepEqual(await page.$$eval('#spToc .sp-toci', b => b.map(x => x.textContent)), ['Chapter 1: Talking p. 1', 'Think, pair, share p. 2', 'Chapter 2: Writing p. 3', 'Quick write p. 4']);
    await page.waitForSelector('#spCanvas canvas');
    await page.click('#spToc .sp-toci:nth-child(4)');
    await page.waitForFunction(() => /Page 4 of 4/.test(document.querySelector('#spPg').textContent));
    // search
    await page.type('[data-sf="find"]', 'partner'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => /1 page with/.test(document.querySelector('#spToc').textContent));
    await page.click('#spToc .sp-toci'); await page.waitForFunction(() => /Page 2 of 4/.test(document.querySelector('#spPg').textContent));
    // the page goes to the Claude box with its chapter, and a slide dragged in from the left
    await page.click('[data-sa="pagebox"]');
    await page.waitForFunction(() => (document.querySelector('.sp-tabs .sp-n') || {}).textContent === '1');
    await page.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/x-slide', '1'); document.querySelector('#side').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
    await page.waitForFunction(() => document.querySelectorAll('#spChips .sp-chip').length === 2);
    assert.match(await page.$eval('#spChips', c => c.textContent), /routines-sample, Think, pair, share \(p\. 2\)[\s\S]*Talk, slide 2: Partners/);
    await page.type('#spText', 'Make a warm-up from these');
    await page.evaluate(() => { navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
    await page.click('[data-sa="boxcopy"]');
    await page.waitForFunction(() => window.__copied);
    const t = await page.evaluate(() => window.__copied);
    assert.match(t, /^Make a warm-up from these\n\n\[routines-sample, Think, pair, share, page 2\]\nThink pair share\. Students think alone,\s+then talk with a partner\./);
    assert.match(t, /\[Slide 2 of "Talk" \(Title and text\)\]\nTitle: Partners\n• Talk with a partner/);
    // the panel stays open while the lesson redraws, and Video says what it can do
    await page.click('[data-st="video"]');
    assert.match(await page.$eval('#spBody', b => b.textContent), /YouTube doesn’t allow its search inside other sites/);
    await page.type('[data-sf="vid"]', 'https://youtu.be/dQw4w9WgXcQ?t=30'); await page.keyboard.press('Enter');
    await page.waitForSelector('.sp-vid iframe[src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30"]');
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('materials: a new document typed on a page, downloaded as Word, read back in, and put in the Claude box; units get documents too', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(async s => { await window.__planner.applySetup(s); }, SETUP);
    await page.evaluate(() => {
      window.__dl = [];
      HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dl.push({ name: this.download, href: this.href }); };
      navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); };
      const P = window.__planner, l = P.normLesson({ title: 'Talk', slides: [{ layout: 'title', title: 'Talk' }] }); P.L.lessons.push(l); P.openLessonForTest(l, 0);
    });
    await page.waitForSelector('.pl-mats [data-ma="newdoc"]');
    await page.$eval('.pl-mats [data-ma="newdoc"]', b => b.click());   // the lesson has only just opened and may be drawn once more, so the button is clicked where it stands
    await page.waitForSelector('#docPage');
    assert.equal(await page.$eval('[data-df="name"]', i => i.value), 'Talk handout');
    await page.evaluate(() => { const h = document.querySelector('#docPage h1'); const r = document.createRange(); r.selectNodeContents(h); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    await page.keyboard.type(' exit ticket'); await page.keyboard.press('Enter');
    await page.click('[data-dt="ul"]');
    await page.keyboard.type('Name one claim'); await page.keyboard.press('Enter'); await page.keyboard.type('Give one reason');
    await page.click('[data-dt="table"]');
    // download as Word: the text and the list are in the .docx
    await page.click('[data-da="docx"]');
    await page.waitForFunction(() => window.__dl.length === 1);
    const xml = await page.evaluate(async () => { const b = new Uint8Array(await (await fetch(window.__dl[0].href)).arrayBuffer()); const z = fflate.unzipSync(b); window.__docx = b; return { names: Object.keys(z), doc: fflate.strFromU8(z['word/document.xml']) }; });
    assert.equal(await page.evaluate(() => window.__dl[0].name), 'Talk handout.docx');
    for (const n of ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml']) assert.ok(xml.names.includes(n), n);
    assert.match(xml.doc, /Talk handout exit ticket/);
    assert.match(xml.doc, /<w:numPr>[\s\S]*Name one claim[\s\S]*Give one reason/);
    assert.match(xml.doc, /<w:tbl>/);
    // into the Claude box as text
    await page.click('[data-da="claude"]');
    await page.waitForFunction(() => /Added to the Claude box/.test(document.querySelector('.toast').textContent));   // it saves first; opening the panel before that is done has the panel drawn again under the next click
    await page.click('.ls-top [data-a="panel"]');
    await page.waitForSelector('#side:not([hidden]) [data-st="claude"]', { visible: true }); await page.click('[data-st="claude"]');   // visible: the panel has only just opened, and its tabs can be there a moment before they have a size
    await page.waitForSelector('[data-sa="boxcopy"]');
    assert.match(await page.$eval('#spChips', c => c.textContent), /Talk handout/);
    await page.click('[data-sa="boxcopy"]'); await page.waitForFunction(() => window.__copied);
    assert.match(await page.evaluate(() => window.__copied), /^\[Document: Talk handout\]\nTalk handout exit ticket\nName one claim\nGive one reason/);
    // back to the lesson: the document is listed and kept after a reload of the lesson
    await page.click('[data-da="back"]');
    await page.waitForSelector('.pl-mats .pl-file');
    assert.match(await page.$eval('.pl-mats', m => m.textContent), /DOCTalk handout\s*Document/);
    // a Word file dropped in comes in as a file, and "Edit a copy" turns it into a document
    await page.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File([window.__docx], 'Reading guide.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })); document.querySelector('.pl-mats').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
    await page.waitForFunction(() => /Reading guide\.docx/.test(document.querySelector('.pl-mats').textContent));
    await page.click('.pl-mats [data-ma="editdocx"]');
    await page.waitForSelector('#docPage');
    assert.equal(await page.$eval('[data-df="name"]', i => i.value), 'Reading guide');
    assert.match(await page.$eval('#docPage', p => p.innerHTML), /<h1>Talk handout exit ticket<\/h1>[\s\S]*<li>Name one claim<\/li>/);
    await page.click('[data-da="back"]');
    await page.waitForFunction(() => document.querySelectorAll('.pl-mats .pl-file').length === 3);
    // a unit makes its own documents next to its files, and goes back to the unit
    await page.evaluate(async () => { const P = window.__planner, u = P.normUnit({ course: 'Course A', title: 'Unit 2: Argument', start: '2026-10-26', weeks: [{}] }); await P.unitPut(u, true); P.openUnit(P.L.units.find(x => x.id === u.id)); });
    await page.waitForSelector('[data-owner^="unit|"] [data-ma="newdoc"]');
    await page.click('[data-owner^="unit|"] [data-ma="newdoc"]');
    await page.waitForSelector('#docPage');
    await page.click('[data-da="back"]');
    await page.waitForFunction(() => { const s = document.querySelector('[data-owner^="unit|"]'); return s && /Unit 2- Argument handout\s*Document/.test(s.textContent); });
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('right-click a slide or a lesson to comment for Claude; search finds slides and documents; copy a lesson; print the week', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(async s => { await window.__planner.applySetup(s); }, SETUP);
    await page.evaluate(async () => {
      navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); };
      window.__printed = [];
      window.open = () => ({ document: { write: h => window.__printed.push(h), close() { } }, focus() { }, print() { } });
      const P = window.__planner;
      P.L.weekOf = '2026-11-02';
      const l = P.normLesson({ title: 'Claims', slots: [{ classId: 'A1', date: '2026-11-03' }], slides: [{ layout: 'title', title: 'Claims' }, { layout: 'content', title: 'Counterclaims', body: 'Find the counterclaim in paragraph 3' }] });
      P.L.lessons.push(l); P.L.view = 'week'; P.renderLessons();
    });
    // right-click the lesson card on the week: comment for Claude
    await page.waitForSelector('.ls-card[data-open]');
    await page.click('.ls-card[data-open]', { button: 'right' });
    await page.waitForSelector('.pl-ctx [data-cx="note"]');
    assert.match(await page.$eval('.pl-ctx', m => m.textContent), /Comment for Claude on this lesson[\s\S]*Copy this lesson to another day/);
    await page.click('.pl-ctx [data-cx="note"]');
    await page.waitForSelector('#plNoteT');
    await page.type('#plNoteT', 'Add a warm-up about rebuttals');
    await page.click('.pl-note [data-nok]');
    await page.waitForFunction(() => !document.querySelector('.pl-ctx'));
    // open the lesson, right-click slide 2 in the list and add it with a comment
    await page.click('.ls-card[data-open]');
    await page.waitForSelector('.ls-th[data-go="1"]');
    await page.click('.ls-th[data-go="1"]', { button: 'right' });
    await page.click('.pl-ctx [data-cx="note"]');
    await page.type('#plNoteT', 'Make this a two-column slide');
    await page.keyboard.down('Control'); await page.keyboard.press('Enter'); await page.keyboard.up('Control');
    await page.waitForFunction(() => !document.querySelector('.pl-ctx'));
    await page.click('.ls-top [data-a="panel"]');
    await page.waitForSelector('#side:not([hidden]) [data-st="claude"]', { visible: true }); await page.click('[data-st="claude"]');   // visible: the panel has only just opened, and its tabs can be there a moment before they have a size
    await page.waitForFunction(() => document.querySelectorAll('#spChips .sp-chip').length === 2);
    assert.match(await page.$eval('#spChips', c => c.textContent), /Comment on Claims[\s\S]*Comment on Claims, slide 2: Counterclaims/);
    await page.click('[data-sa="boxcopy"]'); await page.waitForFunction(() => window.__copied);
    const t = await page.evaluate(() => window.__copied);
    assert.match(t, /My comment: Add a warm-up about rebuttals\nOn: \[Lesson\]\n# Claims\nCourse A-1, /);
    assert.match(t, /My comment: Make this a two-column slide\nOn: \[Slide 2 of "Claims" \(Title and text\)\]\nTitle: Counterclaims\n• Find the counterclaim in paragraph 3/);
    // copy to another day: its own slides, on the new class
    await page.click('.ls-th[data-go="1"]', { button: 'right' });
    await page.click('.pl-ctx [data-cx="copy"]');
    await page.waitForSelector('#cpC');
    await page.select('#cpC', 'B1');
    await page.$eval('#cpD', i => { i.value = '2026-11-03'; });
    await page.click('#dlgBox [data-ok]');
    await page.waitForFunction(() => window.__planner.L.lessons.length === 2 && window.__planner.L.open && window.__planner.L.open.slots[0].classId === 'B1');
    const both = await page.evaluate(() => { const [x, y] = window.__planner.L.lessons; return { ids: x.id !== y.id && x.slides[1].id !== y.slides[1].id, title: y.title, body: y.slides[1].body }; });
    assert.deepEqual(both, { ids: true, title: 'Claims', body: '• Find the counterclaim in paragraph 3' });
    // search finds the slide text
    const hits = await page.evaluate(async () => (await window.__planner.findAll('counterclaim')).map(r => r.kind + ' ' + r.title));
    assert.deepEqual(hits, ['slide Claims, slide 2', 'slide Claims, slide 2']);
    await page.click('[data-a="back"]');
    await page.waitForSelector('#plFind');
    await page.type('#plFind', 'paragraph 3'); await page.keyboard.press('Enter');
    await page.waitForSelector('#fdL .pl-hit');
    assert.match(await page.$eval('#fdL', b => b.textContent), /Claims, slide 2Course A-1 Tue 11\/3…[^▭]*Find the counterclaim in paragraph 3/);
    await page.click('#fdL .pl-hit');
    await page.waitForFunction(() => window.__planner.L.view === 'edit' && window.__planner.L.cur === 1);
    // print the week: both classes with their lessons and slide titles
    await page.click('[data-a="back"]');
    await page.waitForSelector('[data-a="printweek"]');
    await more(page, 'printweek');
    const pr = await page.evaluate(() => window.__printed[0]);
    assert.match(pr, /<h1>Week of November 2<\/h1>/);
    assert.match(pr, /Tue 11\/3[\s\S]*Course A-1[\s\S]*Claims[\s\S]*<li>Counterclaims<\/li>[\s\S]*Course B-1[\s\S]*Claims/);
    assert.match(pr, /Fri 11\/6 · Day off/);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('past lessons: a lesson pack brings lessons with their files into the library and the unit, fills Atlas links, and loads twice safely', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(async s => {
      const P = window.__planner; await P.applySetup(s);
      await P.unitPut(P.normUnit({ id: 'u-arg', course: 'Course A', title: 'Unit 2: Argument', start: '2026-10-26', weeks: [{}, {}] }), true);
      await P.unitPut(P.normUnit({ id: 'u-poe', course: 'Course B', title: 'Unit 1: Poetry', start: '2026-08-31', atlas: 'https://example.org/mine', weeks: [{}] }), true);
    }, SETUP);
    const pack = await page.evaluate(() => {
      const enc = s => fflate.strToU8(s);
      const p = { kind: 'grading-studio-lesson-pack', version: 1, name: 'Old decks', lessons: [
        { id: 'past-1', title: 'Claims intro', library: 'Course A · Unit 2 (last year)', unit: 'u-arg', slides: [{ layout: 'title', title: 'Claims intro' }, { layout: 'content', title: 'What is a claim?', body: 'A sentence you can argue', notes: 'Ask for examples' }],
          files: [{ name: 'Claims intro.pptx', path: 'files/1.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }, { name: 'Claims intro.pdf', path: 'files/1.pdf', type: 'application/pdf' }] },
        { id: 'past-2', title: 'Counterclaims', library: 'Course A · Unit 2 (last year)', unit: 'u-arg', slots: [{ classId: 'A1', date: '2026-10-27' }], slides: [{ layout: 'content', title: 'Counterclaims', body: 'The other side' }], files: [] }],
        units: [{ id: 'u-arg', atlas: 'https://example.org/atlas/arg', files: [{ name: 'Unit plan.pdf', path: 'files/plan.pdf', type: 'application/pdf' }] }, { id: 'u-poe', atlas: 'https://example.org/other' }, { id: 'nope', atlas: 'https://example.org/x' }] };
      const z = fflate.zipSync({ 'pack.json': enc(JSON.stringify(p)), 'files/1.pptx': enc('PPTX'), 'files/1.pdf': enc('%PDF-1.4 fake'), 'files/plan.pdf': enc('%PDF plan') });
      window.__pack = new File([z], 'Old decks.zip', { type: 'application/zip' });
      window.__opened = []; window.open = u => { window.__opened.push(u); return null; };
      return true;
    });
    assert.ok(pack);
    await page.evaluate(() => window.__planner.packImport(window.__pack));
    await page.waitForFunction(() => window.__planner.L.view === 'library' && document.querySelector('.pl-lib-card'));
    assert.match(await page.$eval('.pl-lib', e => e.textContent), /Course A · Unit 2 \(last year\)2 lessons[\s\S]*Claims intro2 slides[\s\S]*Claims intro[\s\S]*Counterclaims1 slide · Course A-1 Tue 10\/27/);
    // files open from the card: a PDF in a new tab
    await page.click('[data-libf$="|' + await page.evaluate(() => window.__planner.L.lessons.find(l => l.id === 'past-1').files[1].id) + '"]');
    await page.waitForFunction(() => window.__opened.length === 1);
    // past lessons stay out of the week's loose list; the dated one shows on its day
    const st = await page.evaluate(async () => {
      const P = window.__planner, u = P.L.units.find(x => x.id === 'u-arg'), v = P.L.units.find(x => x.id === 'u-poe');
      return { atlas: u.atlas, files: u.files.map(f => f.name), keep: v.atlas, lessons: P.L.lessons.length, files1: P.L.lessons.find(l => l.id === 'past-1').files.map(f => f.name + ' ' + f.size) };
    });
    assert.deepEqual(st, { atlas: 'https://example.org/atlas/arg', files: ['Unit plan.pdf'], keep: 'https://example.org/mine', lessons: 2, files1: ['Claims intro.pptx 4', 'Claims intro.pdf 13'] });
    // the unit page lists its lessons
    await page.evaluate(() => { const P = window.__planner; P.openUnit(P.L.units.find(u => u.id === 'u-arg')); });
    await page.waitForFunction(() => /Lessons for this unit2Counterclaims[\s\S]*Claims intro/.test(document.querySelector('#lessons').textContent));
    // the filter
    await page.evaluate(() => { const P = window.__planner; P.L.view = 'library'; P.renderLessons(); });
    await page.type('[data-libq]', 'counter');
    await page.waitForFunction(() => document.querySelectorAll('.pl-lib-card').length === 1);
    // loading the same pack again adds nothing
    await page.evaluate(() => window.__planner.packImport(window.__pack));
    assert.equal(await page.evaluate(() => window.__planner.L.lessons.length + ' ' + window.__planner.L.units.find(u => u.id === 'u-arg').files.length), '2 1');
    // a profile fills a missing Atlas link on a unit already here, and leaves the rest alone
    await page.evaluate(async s => { const P = window.__planner; P.L.units.find(u => u.id === 'u-arg').atlas = ''; await P.applySetup({ ...s, units: [{ id: 'u-arg', course: 'Course A', title: 'Renamed', start: '2026-10-26', atlas: 'https://example.org/atlas/new' }] }); }, SETUP);
    assert.equal(await page.evaluate(() => { const u = window.__planner.L.units.find(u => u.id === 'u-arg'); return u.atlas + ' ' + u.title; }), 'https://example.org/atlas/new Unit 2: Argument');
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('slide text tools: bullets, numbers, indents, bold, italic and underline are mine to add; nothing is added for me', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    const tpl = fs.readFileSync(path.join(__dirname, 'fixtures', 'lesson-template.b64'), 'utf8').trim();
    await page.evaluate(async (s, tpl) => { await window.__planner.applySetup({ ...s, template: tpl }); }, SETUP, tpl);
    // a new lesson: the title slide, then an empty agenda slide (slide 2, always), then one empty slide; no agenda written for me
    await page.evaluate(() => window.__planner.createLesson([]));
    await page.waitForFunction(() => window.__planner.L.view === 'edit');
    const fresh = await page.evaluate(() => window.__planner.L.open.slides.map(s => s.layout + '|' + s.title + '|' + s.body));
    assert.deepEqual(fresh, ['title|New lesson|', 'agenda|Agenda|', 'content||']);
    // an agenda slide starts empty, with gray hints
    await page.evaluate(() => window.__planner.openLessonForTest(window.__planner.L.open, 2));
    await page.click('[data-a="addslide"]'); await page.waitForSelector('#dlgBox [data-addslide="agenda"]'); await page.click('#dlgBox [data-addslide="agenda"]');
    await page.waitForFunction(() => window.__planner.L.open.slides.length === 4 && window.__planner.L.cur === 3);
    const ag = await page.evaluate(() => { const s = window.__planner.L.open.slides[3]; return s.title + '|' + s.body + '|' + document.querySelector('#lsStage .ls-body').textContent + '|' + document.querySelector('#lsStage .ls-t').textContent; });
    assert.equal(ag, '||What you’ll do today, one line each|Agenda');
    // typed lines stay plain until I ask for a list
    await page.click('#lsStage .ls-body'); await page.waitForSelector('.ls-rted');
    await page.keyboard.type('Warm-up'); await page.keyboard.press('Enter'); await page.keyboard.type('Read together');
    await page.waitForFunction(() => document.querySelector('.rt-tools.live'));
    assert.equal(await page.$$eval('.ls-rted .rt-n, .ls-rted .rt-b', x => x.length), 0);
    // select both lines, numbers on from the toolbar
    await page.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('.ls-rted')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    await page.click('[data-rt="numbers"]');
    assert.deepEqual(await page.$$eval('.ls-rted .rt', x => x.map(d => d.className + ' ' + (d.dataset.n || ''))), ['rt l0 rt-n 1', 'rt l0 rt-n 2']);
    assert.ok(await page.$('[data-rt="numbers"].on'));
    // Enter at the end keeps numbering; Tab indents; Shift+Ctrl+8 makes it a bullet
    await page.evaluate(() => { const d = document.querySelectorAll('.ls-rted .rt')[1], r = document.createRange(); r.selectNodeContents(d); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    await page.keyboard.press('Enter'); await page.keyboard.type('Partner talk');
    await page.keyboard.press('Tab');
    await page.keyboard.down('Control'); await page.keyboard.down('Shift'); await page.keyboard.press('8'); await page.keyboard.up('Shift'); await page.keyboard.up('Control');
    // bold a word with the toolbar, underline with the keyboard
    await page.keyboard.press('Enter'); await page.keyboard.press('Backspace');   // the new line: bullet off first
    await page.keyboard.type('Key ');
    await page.click('[data-rt="bold"]'); await page.keyboard.type('word'); await page.click('[data-rt="bold"]');
    await page.keyboard.type(' and ');
    await page.keyboard.down('Control'); await page.keyboard.press('u'); await page.keyboard.up('Control');
    await page.keyboard.type('this');
    await page.keyboard.down('Control'); await page.keyboard.press('u'); await page.keyboard.up('Control');
    // click off: it saves as plain text with the marks written out
    await page.click('.ls-notes textarea');
    await page.waitForFunction(() => !document.querySelector('.ls-rted'));
    const body = await page.evaluate(() => window.__planner.L.open.slides[3].body);
    assert.equal(body, '1. Warm-up\n2. Read together\n\t• Partner talk\n\tKey **word** and __this__');
    assert.deepEqual(await page.$$eval('#lsStage .ls-body .rt', x => x.map(d => d.className + '|' + d.innerHTML)),
      ['rt rt-n l0|Warm-up', 'rt rt-n l0|Read together', 'rt rt-b l1|Partner talk', 'rt rt-p l1|Key <b>word</b> and <u>this</u>']);
    // with nothing being edited, a list button works on the whole slide text
    await page.click('[data-rt="bullets"]');
    await page.click('.ls-notes textarea');
    await page.waitForFunction(() => /^• Warm-up\n• Read together\n\t• Partner talk\n\t• Key/.test(window.__planner.L.open.slides[3].body));
    // italic and escapes survive a round trip
    await page.evaluate(() => { const P = window.__planner; P.L.open.slides[2].body = '*Read* 2\\*3 carefully'; P.openLessonForTest(P.L.open, 2); });
    assert.equal(await page.$eval('#lsStage .ls-body .rt', d => d.innerHTML), '<i>Read</i> 2*3 carefully');
    // the .pptx: real bullets, numbers, levels and runs
    const x = await page.evaluate(() => { const P = window.__planner, z = fflate.unzipSync(P.buildPptx(P.L.open)), td = new TextDecoder(); return td.decode(z['ppt/slides/slide4.xml']); });
    assert.match(x, /<a:buChar char="•"\/>[\s\S]*Warm-up/);
    assert.match(x, /marL="305816"[^]*Read together<\/a:t>[^]*marL="763016"[^]*Partner talk/);   // the indent moves the line in
    assert.match(x, /b="1"[^>]*>(<[^>]+>)*<a:t>word<\/a:t>/);
    assert.match(x, /u="sng"[^>]*>(<[^>]+>)*<a:t>this<\/a:t>/);
    assert.doesNotMatch(x, /\*\*|__/);
    await page.evaluate(() => { const P = window.__planner; P.L.open.slides[3].body = '1. One\n2. Two'; });
    const n = await page.evaluate(() => { const P = window.__planner, z = fflate.unzipSync(P.buildPptx(P.L.open)); return new TextDecoder().decode(z['ppt/slides/slide4.xml']); });
    assert.match(n, /<a:buAutoNum type="arabicPeriod"\/>[\s\S]*One/);
    // slides saved before this keep their look: the layout's bullets and numbers are written in
    const old = await page.evaluate(() => window.__planner.normLesson({ title: 'Old', slides: [{ layout: 'content', title: 'A', body: 'One\n\tTwo' }, { layout: 'agenda', title: 'B', body: 'Warm-up\n\nReview' }, { layout: 'steps', title: 'C', body: 'Go\nStop', foot: 'Done' }, { layout: 'text', title: 'D', body: 'Plain *star*' }] }).slides.map(s => s.body + '|' + (s.foot || '')));
    assert.deepEqual(old, ['• One\n\t• Two|', '1. Warm-up\n2. Review|', '1. Go\n2. Stop|Done', 'Plain \\*star\\*|']);
    // a lesson file from Claude marked fmt 2 is taken as written
    const cl = await page.evaluate(() => window.__planner.normLesson({ title: 'From Claude', fmt: 2, slides: [{ layout: 'content', title: 'A', body: 'Just a line' }] }).slides[0].body);
    assert.equal(cl, 'Just a line');
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('the notebook: a page per lesson in the side panel, with lists, links, videos and pictures, saved with the lesson', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(async s => { const P = window.__planner; await P.applySetup(s);
      const l = P.normLesson({ id: 'nb-l', title: 'Appeals', slides: [{ layout: 'title', title: 'Appeals', fmt: 2 }, { layout: 'content', title: 'Ethos', body: '• Trust', fmt: 2 }] }); P.L.lessons.push(l); P.openLessonForTest(l, 1); }, SETUP);
    await page.click('[data-a="panel"]'); await page.waitForSelector('[data-st="notes"]'); await page.click('[data-st="notes"]');
    await page.waitForSelector('#nbPage');
    assert.match(await page.$eval('.nb-head b', b => b.textContent), /^Appeals$/);
    await page.click('#nbPage');
    await page.keyboard.type('Start with the ad sort');
    await page.keyboard.press('ArrowLeft');   // typing in the notebook never moves the slides
    assert.equal(await page.evaluate(() => window.__planner.L.cur), 1);
    await page.keyboard.press('End'); await page.keyboard.press('Enter');
    await page.click('[data-nb="ul"]'); await page.keyboard.type('Groups of 3'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await page.click('[data-nb="link"]'); await page.type('#nbAskIn', 'https://example.org/ads'); await page.keyboard.press('Enter');
    await page.click('[data-nb="video"]'); await page.type('#nbAskIn', 'https://youtu.be/dQw4w9WgXcQ?t=30'); await page.keyboard.press('Enter');
    await page.waitForSelector('#nbPage .nb-vid iframe[src*="dQw4w9WgXcQ?start=30"]');
    // a pasted picture goes into the notebook, not onto a new slide
    await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 40; c.height = 20; const b = await new Promise(r => c.toBlob(r, 'image/png')); const dt = new DataTransfer(); dt.items.add(new File([b], 'p.png', { type: 'image/png' })); document.querySelector('#nbPage').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
    await page.waitForSelector('#nbPage img[src^="data:image/png"]');
    assert.equal(await page.evaluate(() => window.__planner.L.open.slides.length), 2);
    await page.waitForFunction(() => /nb-vid/.test(window.__planner.L.open.notebook || '') && /<img/.test(window.__planner.L.open.notebook) && /✓ Saved/.test(document.querySelector('#nbSaved').textContent));
    const nb = await page.evaluate(() => window.__planner.L.open.notebook);
    assert.match(nb, /Start with the ad sort[^]*<ul><li>Groups of 3<\/li><\/ul>[^]*<a href="https:\/\/example\.org\/ads" target="_blank" rel="noopener">[^]*<div class="nb-vid" data-yt="dQw4w9WgXcQ" data-t="30"><\/div>/);
    assert.doesNotMatch(nb, /iframe|contenteditable/);
    // it is saved with the lesson, travels in the lesson file, and Claude sees the words
    const back = await page.evaluate(() => { const P = window.__planner, l = P.normLesson(JSON.parse(JSON.stringify(P.L.open))); return l.notebook === P.L.open.notebook; });
    assert.ok(back);
    // pasted HTML can't run anything
    const clean = await page.evaluate(() => window.__planner.normLesson({ title: 'x', notebook: '<p onclick="x()">Hi <a href="javascript:alert(1)">bad</a> <img src="x" onerror="alert(1)"><script>alert(1)</script><iframe src="https://evil.example"></iframe><div class="nb-vid" data-yt="bad"></div></p>' }).notebook);
    assert.equal(clean, '<p>Hi bad </p><p></p>');   // nothing that runs, loads from elsewhere or fakes a video is left
    // the general page, for when no lesson is open
    await page.click('[data-sa="nbswap"]'); await page.waitForFunction(() => document.querySelector('.nb-head b').textContent === 'General notes');
    await page.click('#nbPage'); await page.keyboard.type('Ideas for next unit');
    await page.click('[data-sa="nbswap"]'); await page.waitForFunction(() => document.querySelector('.nb-head b').textContent === 'Appeals');
    assert.match(await page.$eval('#nbPage', e => e.textContent), /Start with the ad sort/);
    // into the Claude box and the lesson text
    await page.click('[data-sa="nbbox"]');
    const t = await page.evaluate(async () => { window.__copied = ''; navigator.clipboard.writeText = async x => { window.__copied = x; }; return true; });
    assert.ok(t);
    await page.waitForSelector('[data-st="claude"] .sp-n');
    await page.click('[data-st="claude"]'); await page.waitForSelector('#spChips');
    assert.match(await page.$eval('#spChips', c => c.textContent), /Notebook: Appeals/);
    await page.click('[data-sa="boxcopy"]'); await page.waitForFunction(() => window.__copied);
    const cp = await page.evaluate(() => window.__copied);
    assert.match(cp, /\[My notebook: Appeals\]\nStart with the ad sort\n• Groups of 3\n[^]*https:\/\/example\.org\/ads[^]*\[Video: https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ&t=30s\][^]*\[Picture\]/);
    assert.equal(await page.evaluate(async () => (await window.__planner.findAll('ad sort')).map(r => r.title).join()), 'Appeals, notebook');
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('text color: red from the toolbar, saved as {red}…{/}, shown on the slide and in the .pptx; Automatic takes it off', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    const tpl = fs.readFileSync(path.join(__dirname, 'fixtures', 'lesson-template.b64'), 'utf8').trim();
    await page.evaluate(async (s, tpl) => { const P = window.__planner; await P.applySetup({ ...s, template: tpl });
      const l = P.normLesson({ title: 'Colors', fmt: 2, slides: [{ layout: 'title', title: 'Colors' }, { layout: 'agenda', title: '11/3 Agenda', body: '1. Warm-up\nNext class: the test' }, { layout: 'steps', title: 'Do', body: 'Read {curly} braces' }] }); P.L.lessons.push(l); P.openLessonForTest(l, 1); }, SETUP, tpl);
    await page.click('#lsStage .ls-body'); await page.waitForSelector('.ls-rted');
    // select the second line and make it red
    await page.evaluate(() => { const d = document.querySelectorAll('.ls-rted .rt')[1], r = document.createRange(); r.selectNodeContents(d); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    await page.click('[data-rt="colormenu"]'); await page.waitForSelector('.rt-pal:not([hidden])');
    assert.equal(await page.$$eval('.rt-pal .rt-sw', b => b.length), 6);
    await page.click('[data-rt="color:red"]');
    assert.equal(await page.$eval('.rt-pal', p => p.hidden), true);
    await page.click('.ls-notes textarea'); await page.waitForFunction(() => !document.querySelector('.ls-rted'));
    assert.equal(await page.evaluate(() => window.__planner.L.open.slides[1].body), '1. Warm-up\n{red}Next class: the test{/}');
    assert.equal(await page.$eval('#lsStage .ls-body .rt:nth-child(2) span', s => s.dataset.c + ' ' + getComputedStyle(s).color), 'red rgb(192, 0, 0)');
    // red and bold together, in the .pptx
    await page.evaluate(() => { const P = window.__planner; P.L.open.slides[1].body = '1. Warm-up\n{red}**Next** class{/} plain'; });
    const x = await page.evaluate(() => { const P = window.__planner, z = fflate.unzipSync(P.buildPptx(P.L.open)); return new TextDecoder().decode(z['ppt/slides/slide2.xml']); });
    assert.match(x, /b="1" dirty="0"><a:solidFill><a:srgbClr val="C00000"\/><\/a:solidFill><\/a:rPr><a:t>Next<\/a:t>/);
    assert.match(x, /dirty="0"><a:solidFill><a:srgbClr val="C00000"\/><\/a:solidFill><\/a:rPr><a:t> class<\/a:t>/);
    assert.match(x, /dirty="0"\/><a:t> plain<\/a:t>/);
    // Automatic takes the color off again
    await page.evaluate(() => window.__planner.openLessonForTest(window.__planner.L.open, 1));
    await page.click('#lsStage .ls-body'); await page.waitForSelector('.ls-rted');
    await page.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('.ls-rted')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    await page.click('[data-rt="colormenu"]'); await page.click('[data-rt="color:"]');
    await page.click('.ls-notes textarea'); await page.waitForFunction(() => !document.querySelector('.ls-rted'));
    assert.equal(await page.evaluate(() => window.__planner.L.open.slides[1].body), '1. Warm-up\n**Next** class plain');
    // a teaching layout in another look: the color is in its run; a typed { stays a {
    await page.evaluate(() => { const P = window.__planner; P.L.open.look = 'navy'; P.L.open.slides[2].body = 'Read {blue}this{/} and \\{this\\}'; });
    const y = await page.evaluate(() => { const P = window.__planner, z = fflate.unzipSync(P.buildPptx(P.L.open)); return new TextDecoder().decode(z['ppt/slides/slide3.xml']); });
    assert.match(y, /<a:srgbClr val="1C5DB8"\/><\/a:solidFill><\/a:rPr><a:t>this<\/a:t>/);
    assert.match(y, /<a:t> and \{this\}<\/a:t>/);
    // a slide made before this, with a { in it, keeps it as text
    assert.equal(await page.evaluate(() => window.__planner.normLesson({ slides: [{ layout: 'text', body: 'Use {red} here' }] }).slides[0].body), 'Use \\{red} here');
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('ManageBac links: added on a class in the week, shown on its lessons, kept in the timetable, shared with grading by class name', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(async s => { localStorage.setItem('gs.mblinks', JSON.stringify({ courseb1: 'https://school.example.org/b1' })); const P = window.__planner; await P.applySetup(s); P.L.weekOf = '2026-11-02'; P.L.view = 'week'; P.renderLessons(); }, SETUP);
    // Course B-1's link was set in grading as "CourseB1": it shows here; Course A-1 has none yet
    await page.waitForSelector('.ls-slot a.pl-mb[href="https://school.example.org/b1"]');
    await page.click('.ls-slot [data-mbset="A1"]'); await page.waitForSelector('#mbU');
    await page.type('#mbU', 'school.example.org/a1'); await page.keyboard.press('Enter');
    await page.waitForSelector('.ls-slot a.pl-mb[href="https://school.example.org/a1"]');
    const st = await page.evaluate(() => ({ mb: window.__planner.L.setup.classes.find(c => c.id === 'A1').mb, map: JSON.parse(localStorage.getItem('gs.mblinks')) }));
    assert.deepEqual(st, { mb: 'https://school.example.org/a1', map: { courseb1: 'https://school.example.org/b1', coursea1: 'https://school.example.org/a1' } });
    // on a lesson for that class, next to the class
    await page.evaluate(() => { const P = window.__planner, l = P.normLesson({ title: 'L', slots: [{ classId: 'A1', date: '2026-11-03' }, { classId: 'A2', date: '2026-11-04' }], slides: [{ layout: 'title', fmt: 2 }] }); P.L.lessons.push(l); P.openLessonForTest(l, 0); });
    await page.waitForSelector('.ls-chip a.pl-mb[href="https://school.example.org/a1"]');
    assert.ok(await page.$('.ls-chip [data-mbset="A2"]'));
    // loading the profile again keeps links the profile doesn't have
    await page.evaluate(async s => { await window.__planner.applySetup(s); }, SETUP);
    assert.equal(await page.evaluate(() => window.__planner.L.setup.classes.find(c => c.id === 'A1').mb), 'https://school.example.org/a1');
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('screenshots for context: pasted or dropped on a slide’s Claude box, noted, kept off the slide, put on a slide in one click, and saved for Claude', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(() => { const P = window.__planner, l = P.normLesson({ title: 'Shots', slides: [{ layout: 'title', fmt: 2 }, { layout: 'content', title: 'Task', body: '• Read it', fmt: 2 }] }); P.L.lessons.push(l); P.openLessonForTest(l, 1); });
    await page.waitForSelector('.pl-cs');
    const shot = (sel, kind) => page.evaluate(async ([sel, kind]) => { const c = document.createElement('canvas'); c.width = 60; c.height = 30; const b = await new Promise(r => c.toBlob(r, 'image/png')); const dt = new DataTransfer(); dt.items.add(new File([b], 's.png', { type: 'image/png' })); const el = document.querySelector(sel);
      el.dispatchEvent(kind === 'paste' ? new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }) : new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, [sel, kind]);
    // pasted while typing what I want: it goes with the slide's context, not onto a new slide
    await page.focus('[data-f="ask"]'); await shot('[data-f="ask"]', 'paste');
    await page.waitForSelector('.pl-csi img[src^="data:image/png"]');
    await page.type('[data-f="ctxnote"]', 'Task sheet instructions');
    await shot('.pl-cs', 'drop');
    await page.waitForFunction(() => document.querySelectorAll('.pl-csi').length === 2);
    let st = await page.evaluate(() => { const s = window.__planner.L.open.slides[1]; return { n: window.__planner.L.open.slides.length, ctx: s.ctx.map(x => x.note), img: !!s.img, stage: !!document.querySelector('#lsStage img') }; });
    assert.deepEqual(st, { n: 2, ctx: ['Task sheet instructions', ''], img: false, stage: false });
    // Claude sees it in the lesson text and gets the picture as a file in the folder
    const txt = await page.evaluate(() => window.__planner.lessonText(window.__planner.L.open));
    assert.match(txt, /\[Screenshot for context, not on the slide: Task sheet instructions\]/);
    const file = await page.evaluate(() => { const imgs = new Map(), c = window.__planner.lessonForFile(window.__planner.L.open, imgs); return { src: c.slides[1].ctx[0].src, has: imgs.has(c.slides[1].ctx[0].src), keep: /^data:/.test(window.__planner.L.open.slides[1].ctx[0].src) }; });
    assert.match(file.src, /^images\/ctx-.+\.png$/); assert.ok(file.has && file.keep);
    // it survives a save and reload of the lesson
    assert.equal(await page.evaluate(() => window.__planner.normLesson(JSON.parse(JSON.stringify(window.__planner.L.open))).slides[1].ctx.length), 2);
    // one click makes a picture slide of it for students
    await page.click('[data-ctxput="0"]');
    st = await page.evaluate(() => { const P = window.__planner, l = P.L.open; return { n: l.slides.length, cur: P.L.cur, layout: l.slides[2].layout, title: l.slides[2].title, img: /^data:image/.test(l.slides[2].img.src), still: l.slides[1].ctx.length }; });
    assert.deepEqual(st, { n: 3, cur: 2, layout: 'picture', title: 'Task sheet instructions', img: true, still: 2 });
    // removing one, with undo
    await page.evaluate(() => window.__planner.openLessonForTest(window.__planner.L.open, 1));
    await page.waitForSelector('[data-ctxdel="1"]'); await page.click('[data-ctxdel="1"]');
    assert.equal(await page.evaluate(() => window.__planner.L.open.slides[1].ctx.length), 1);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('comments I made on slides: right-click comments stay on the slide, thumbnails show a count, and Comments lists them all', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(() => { const P = window.__planner, l = P.normLesson({ title: 'Claims', slides: [{ layout: 'title', title: 'Claims', fmt: 2 }, { layout: 'content', title: 'Counterclaims', fmt: 2, talk: [{ by: 'you', text: 'Use the ad from Tuesday' }] }, { layout: 'content', title: 'Exit', fmt: 2 }] }); P.L.lessons.push(l); P.openLessonForTest(l, 0); });
    await page.waitForSelector('.ls-th[data-go="1"] .ls-thc');
    assert.equal(await page.$eval('.ls-th[data-go="1"] .ls-thc', b => b.textContent), '💬 1');
    assert.equal(await page.$eval('[data-a="comments"]', b => b.textContent), 'Comments (1)');
    // a right-click comment on slide 3 is kept on that slide too
    await page.click('.ls-th[data-go="2"]', { button: 'right' });
    await page.click('.pl-ctx [data-cx="note"]');
    await page.type('#plNoteT', 'Make this a sticky-note exit ticket');
    await page.click('.pl-note [data-nok]');
    await page.waitForSelector('.ls-th[data-go="2"] .ls-thc');
    assert.deepEqual(await page.evaluate(() => window.__planner.L.open.slides[2].talk.map(t => t.text)), ['Make this a sticky-note exit ticket']);
    // the list: both, by slide; Done hides one; clicking a slide goes there
    await page.click('[data-a="comments"]');
    await page.waitForSelector('.pl-cmts');
    assert.match(await page.$eval('.pl-cmts', d => d.textContent), /Slide 2: Counterclaims[\s\S]*Use the ad from Tuesday[\s\S]*Slide 3: Exit[\s\S]*sticky-note exit ticket/);
    await page.click('[data-cdone="1:0"]');
    await page.waitForFunction(() => !/Use the ad/.test(document.querySelector('.pl-cmts').textContent));
    await page.click('[data-cshow]');
    await page.waitForFunction(() => /Use the ad/.test(document.querySelector('.pl-cmts').textContent));
    await page.click('[data-cgo="2"]');
    await page.waitForFunction(() => window.__planner.L.cur === 2 && document.querySelector('#dlg').hidden);
    assert.equal(await page.$eval('[data-a="comments"]', b => b.textContent), 'Comments (1)');
    assert.equal(await page.$('.ls-th[data-go="1"] .ls-thc'), null);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('finished PowerPoint: upload one to a lesson, its slides take over, the lesson before is a version, Download gives the file, older decks are kept', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    const tpl = fs.readFileSync(path.join(__dirname, 'fixtures', 'lesson-template.b64'), 'utf8').trim();
    const r = await page.evaluate(async (s, tpl) => {
      const P = window.__planner; await P.applySetup({ ...s, template: tpl });
      // a deck as if finished in PowerPoint: made from another lesson
      const src = P.normLesson({ title: 'Prep', fmt: 2, slides: [{ layout: 'title', title: 'Book Cover Prep' }, { layout: 'agenda', title: '11/03 Agenda', body: '1. Using AI\n\t• Think **before** generating\n2. Work time', size: 28 },
        { layout: 'content', title: 'Reminders', body: '{red}Turn it in as Google Slides{/}\n{blue}Film your talk{/}', notes: 'Show the folder' }] });
      const deck = P.buildPptx(src);
      window.__deck = deck;
      const l = P.normLesson({ title: 'Prep', fmt: 2, slides: [{ layout: 'title', title: 'Draft' }, { layout: 'content', title: 'Old', body: 'old text', ask: 'Put the triangle here', talk: [{ by: 'you', text: 'keep this' }] }] });
      P.L.lessons.push(l); P.openLessonForTest(l, 0);
      // speaker notes come along (this test template has no notes page, so add one by hand)
      const z = fflate.unzipSync(deck), te = new TextEncoder(), A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
      z['ppt/slides/_rels/slide3.xml.rels'] = te.encode(new TextDecoder().decode(z['ppt/slides/_rels/slide3.xml.rels']).replace('</Relationships>', '<Relationship Id="rIdN" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide3.xml"/></Relationships>'));
      z['ppt/notesSlides/notesSlide3.xml'] = te.encode('<p:notes ' + A + '><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>3</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Show the folder</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>');
      const notes = (await P.pptxToSlides(fflate.zipSync(z)))[2].notes;
      return { n: (await P.pptxToSlides(deck)).length, notes };
    }, SETUP, tpl);
    assert.deepEqual(r, { n: 3, notes: 'Show the folder' });
    await page.waitForSelector('#plFin [data-a="finup"]');
    // upload through the file picker
    await page.evaluate(() => { const i = document.querySelector('#finIn'), dt = new DataTransfer(); dt.items.add(new File([window.__deck], 'Book Cover Prep FINAL.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })); i.files = dt.files; });
    await page.click('#plFin [data-a="finup"]');
    await page.evaluate(() => document.querySelector('#finIn').dispatchEvent(new Event('change')));
    await page.waitForFunction(() => window.__planner.L.open.final);
    const st = await page.evaluate(async () => { const P = window.__planner, l = P.L.open; return { name: l.final.name, slides: l.slides.map(s => [s.layout, s.title, s.body, s.notes]), ask: l.slides[1].ask, talk: l.slides[1].talk.length, vers: (await P.versionsOf(l)).map(v => [v.label, v.lesson.slides[1].title]) }; });
    assert.equal(st.name, 'Book Cover Prep FINAL.pptx');
    assert.deepEqual(st.slides[0].slice(0, 2), ['title', 'Book Cover Prep']);
    assert.deepEqual(st.slides[1].slice(1, 3), ['11/03 Agenda', '1. Using AI\n\t• Think **before** generating\n2. Work time']);
    assert.deepEqual(st.slides[2].slice(1, 3), ['Reminders', '{red}Turn it in as Google Slides{/}\n{blue}Film your talk{/}']);
    assert.equal(st.ask, 'Put the triangle here'); assert.equal(st.talk, 1);
    assert.deepEqual(st.vers, [['Before the finished PowerPoint', 'Old']]);
    assert.match(await page.$eval('#plFin', d => d.textContent), /Book Cover Prep FINAL\.pptx/);
    // Download .pptx gives the finished file itself
    await page.evaluate(() => { window.__saved = []; const o = URL.createObjectURL; URL.createObjectURL = b => { window.__saved.push(b.size); return o(b); }; });
    await page.click('[data-a="pptx"]');
    await page.waitForFunction(() => window.__saved.length);
    assert.equal(await page.evaluate(() => window.__saved[0] === window.__deck.length), true);
    // a newer deck replaces it; the first one is kept under older decks
    await page.evaluate(async () => { await window.__planner.finUpload(window.__planner.L.open, new File([window.__deck], 'v2.pptx')); });
    await page.waitForFunction(() => window.__planner.L.open.final.name === 'v2.pptx');
    assert.deepEqual(await page.evaluate(() => window.__planner.L.open.finals.map(f => f.name)), ['Book Cover Prep FINAL.pptx']);
    assert.match(await page.$eval('.pl-fin-old', d => d.textContent), /Older finished decks \(1\)[\s\S]*Book Cover Prep FINAL/);
    // after editing a slide here, Download asks which one
    await page.evaluate(() => { const P = window.__planner; P.L.open.slides[1].title = 'Changed'; P.renderLessons(); });
    await page.click('[data-a="pptx"]'); await page.waitForSelector('[data-fin]');
    await page.click('[data-x]');
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('Copy for Claude brings every comment: ones typed under a slide, right-click ones from before they were kept on the slide, and whole-lesson ones', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(() => {
      navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); };
      const P = window.__planner, l = P.normLesson({ id: 'bc1', title: 'Book Cover Prep', slides: [{ layout: 'title', title: 'Book Cover Prep', fmt: 2 }, { layout: 'content', title: 'Advice', body: '• Theme', fmt: 2 }, { layout: 'content', title: 'More advice', fmt: 2 }] });
      P.L.lessons.push(l);
      // right-click comments made before they were saved on slides: only in the Claude box
      P.SP.box.chips.push({ kind: 'note', about: { kind: 'slide', lesson: 'bc1', i: 1 }, text: 'Add the triangle here' }, { kind: 'note', about: { kind: 'lesson', lesson: 'bc1' }, text: 'Keep it short, they need work time' });
      P.openLessonForTest(l, 2);
    });
    await page.waitForSelector('[data-f="say"]');
    // they count and show in Comments too
    assert.equal(await page.$eval('[data-a="comments"]', b => b.textContent), 'Comments (2)');   // the slide's and the whole lesson's
    assert.ok(await page.$('.ls-th[data-go="1"] .ls-thc'));
    assert.match(await page.$eval('.pl-ltalk', e => e.textContent), /Keep it short, they need work time/);
    assert.deepEqual(await page.evaluate(() => window.__planner.L.open.slides[1].talk.map(t => t.text)), ['Add the triangle here']);
    // typed, never pressed Add
    await page.type('[data-f="say"]', 'Make the red line bigger');
    await more(page, 'send');
    await page.waitForFunction(() => window.__copied);
    const t = await page.evaluate(() => window.__copied);
    assert.match(t, /My comment on the whole lesson: Keep it short, they need work time/);
    assert.match(t, /## Slide 2[^#]*My comment: Add the triangle here/);
    assert.match(t, /## Slide 3[^#]*My comment: Make the red line bigger/);
    assert.equal((t.match(/Add the triangle here/g) || []).length, 1);
    assert.equal((t.match(/Keep it short/g) || []).length, 1);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('a lesson .zip: the finished PowerPoint goes to Finished, every other file to Materials, a newer zip replaces same-named files', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    const tpl = fs.readFileSync(path.join(__dirname, 'fixtures', 'lesson-template.b64'), 'utf8').trim();
    const r = await page.evaluate(async (s, tpl) => {
      const P = window.__planner; await P.applySetup({ ...s, template: tpl });
      const deck = P.buildPptx(P.normLesson({ title: 'Prep', fmt: 2, slides: [{ layout: 'title', title: 'Book Cover Prep' }, { layout: 'content', title: 'Advice', body: '• One' }] }));
      const te = new TextEncoder();
      const zip1 = fflate.zipSync({ 'Book Cover Prep/Book Cover Prep.pptx': deck, 'Book Cover Prep/handouts/Triangle handout.pdf': te.encode('%PDF-1.4 a'), 'Book Cover Prep/Exit ticket.docx': te.encode('docx'), '__MACOSX/._x': te.encode('junk'), 'Book Cover Prep/.DS_Store': te.encode('junk') });
      const l = P.normLesson({ title: 'Prep', fmt: 2, slides: [{ layout: 'title', title: 'Draft' }] }); P.L.lessons.push(l); P.openLessonForTest(l, 0);
      await P.lessonZip(l, new File([zip1], 'Book Cover Prep.zip'));
      const first = { final: l.final.name, slides: l.slides.length, files: l.files.map(f => [f.name, f.type]) };
      // a second zip with lesson.json picks the deck and only the listed files; same name replaces
      const zip2 = fflate.zipSync({ 'v2.pptx': deck, 'old.pptx': deck, 'Triangle handout.pdf': te.encode('%PDF-1.4 newer'), 'Notes.txt': te.encode('skip me'), 'lesson.json': te.encode(JSON.stringify({ kind: 'grading-studio-lesson-zip', finished: 'v2.pptx', materials: ['Triangle handout.pdf'] })) });
      await P.lessonZip(l, new File([zip2], 'v2.zip'));
      return { first, final: l.final.name, older: l.finals.map(f => f.name), files: l.files.map(f => [f.name, f.size]) };
    }, SETUP, tpl);
    assert.deepEqual(r.first, { final: 'Book Cover Prep.pptx', slides: 2, files: [['Triangle handout.pdf', 'application/pdf'], ['Exit ticket.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']] });
    assert.equal(r.final, 'v2.pptx'); assert.deepEqual(r.older, ['Book Cover Prep.pptx']);
    assert.deepEqual(r.files, [['Exit ticket.docx', 4], ['Triangle handout.pdf', 14]]);
    await page.waitForSelector('#plFin [data-a="finzip"]');
    assert.ok(await page.$('.ls-top .ls-menu [data-a="finzip"]'));   // in More, beside Download
    assert.match(await page.$eval('.pl-mats', d => d.textContent), /Exit ticket\.docx[\s\S]*Triangle handout\.pdf/);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('alternative versions: made from the lesson I am on, named, switched from tabs above the slides, each with its own classes and files', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(async s => {
      const P = window.__planner; await P.applySetup(s);
      const l = P.normLesson({ title: 'Book Cover Prep', fmt: 2, slots: [{ classId: 'A1', date: '2026-11-03' }], slides: [{ layout: 'title', title: 'Book Cover Prep' }, { layout: 'content', title: 'Advice', body: '• One', ask: 'Add the triangle', talk: [{ by: 'you', text: 'keep' }] }] });
      P.L.lessons.push(l); await P.createLesson; P.openLessonForTest(l, 1);
    }, SETUP);
    await page.waitForSelector('.pl-var [data-a="varnew"]');
    await page.click('.pl-var [data-a="varnew"]'); await page.waitForSelector('#varN');
    await page.type('#varN', 'Shorter Friday');
    await page.click('#varSame'); await page.click('[data-ok]');
    await page.waitForFunction(() => window.__planner.L.open.variant === 'Shorter Friday');
    const st = await page.evaluate(() => { const P = window.__planner, v = P.L.open, fam = P.variantsOf(v); return { cur: P.L.cur, n: fam.length, names: [...document.querySelectorAll('.pl-var .pl-vt')].map(b => b.textContent.replace('✎', '')), slots: v.slots, slides: v.slides.map(s => s.title), ask: v.slides[1].ask, newIds: v.slides[0].id !== fam[0].slides[0].id, base: fam[0].variant }; });
    assert.deepEqual(st, { cur: 1, n: 2, names: ['Original', 'Shorter Friday'], slots: [{ classId: 'A1', date: '2026-11-03' }], slides: ['Book Cover Prep', 'Advice'], ask: 'Add the triangle', newIds: true, base: 'Original' });
    // changing the version leaves the original alone; tabs switch
    await page.evaluate(() => { const P = window.__planner; P.L.open.slides[1].title = 'Advice (short)'; });
    await page.click('.pl-var [data-var]');
    await page.waitForFunction(() => window.__planner.L.open.variant === 'Original');
    assert.equal(await page.evaluate(() => window.__planner.L.open.slides[1].title), 'Advice');
    // rename
    await page.click('[data-a="varname"]'); await page.waitForSelector('#varN');
    await page.$eval('#varN', i => { i.value = ''; }); await page.type('#varN', 'Full Tuesday'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__planner.L.open.variant === 'Full Tuesday');
    // Claude sees which version it is
    assert.match(await page.evaluate(() => window.__planner.lessonText(window.__planner.L.open)), /^# Book Cover Prep \(version: Full Tuesday\)/);
    // the week shows both, named
    await page.evaluate(() => { const P = window.__planner; P.L.open = null; P.L.weekOf = '2026-11-02'; P.L.view = 'week'; P.renderLessons(); });
    await page.waitForSelector('.ls-card .pl-vtag');
    assert.deepEqual(await page.$$eval('.ls-card .pl-vtag', t => t.map(x => x.textContent).sort()), ['Full Tuesday', 'Shorter Friday']);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('downloads from the calendar: ↓ on each card, Finished ✓, a lesson with its files, and the whole week in one .zip', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    const tpl = fs.readFileSync(path.join(__dirname, 'fixtures', 'lesson-template.b64'), 'utf8').trim();
    await page.evaluate(async (s, tpl) => {
      const P = window.__planner; await P.applySetup({ ...s, template: tpl });
      window.__saved = []; const o = URL.createObjectURL; URL.createObjectURL = b => { window.__saved.push(b); return o(b); };
      const deck = P.buildPptx(P.normLesson({ title: 'Deck', fmt: 2, slides: [{ layout: 'title', title: 'Deck' }] }));
      const done = P.normLesson({ title: 'Book Cover Prep', fmt: 2, slots: [{ classId: 'A1', date: '2026-11-03' }], slides: [{ layout: 'title', title: 'X' }] });
      const plain = P.normLesson({ title: 'Poster day', fmt: 2, slots: [{ classId: 'A1', date: '2026-11-05' }], slides: [{ layout: 'title', title: 'Poster day' }] });
      P.L.lessons.push(done, plain);
      await P.lessonZip(done, new File([fflate.zipSync({ 'Book Cover Prep FINAL.pptx': deck, 'Handout.pdf': new TextEncoder().encode('%PDF') })], 'b.zip'));
      P.L.open = null; P.L.weekOf = '2026-11-02'; P.L.view = 'week'; P.renderLessons();
    }, SETUP, tpl);
    await page.waitForSelector('.ls-cardw .ls-dl');
    assert.equal(await page.$$eval('.ls-card .pl-done', d => d.length), 1);
    // ↓ on the finished one gives the uploaded file; on the other, a deck made from its slides
    await page.click('.ls-dl[data-dl]');
    await page.waitForFunction(() => window.__saved.length === 1);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.ls-dl')].length), 2);
    // the week: a folder per class and day, each with the deck and the files
    await more(page, 'dlweek');
    await page.waitForFunction(() => window.__saved.some(b => b.type === 'application/zip'));
    const names = await page.evaluate(async () => { const b = window.__saved.find(b => b.type === 'application/zip'); return Object.keys(fflate.unzipSync(new Uint8Array(await b.arrayBuffer()))).sort(); });
    assert.deepEqual(names, ['Thu 11-5 · Course A-1 · Poster day/11-05 Thu - Poster day.pptx', 'Tue 11-3 · Course A-1 · Book Cover Prep/Book Cover Prep FINAL.pptx', 'Tue 11-3 · Course A-1 · Book Cover Prep/Handout.pdf']);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('the activity bank in the side panel: search and filter next to the lesson, read the steps, add one after the slide I am on', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(() => { const P = window.__planner, l = P.normLesson({ title: 'Claims', fmt: 2, slides: [{ layout: 'title', title: 'Claims' }, { layout: 'content', title: 'Warm-up' }, { layout: 'content', title: 'Exit' }] }); P.L.lessons.push(l); P.openLessonForTest(l, 1); });
    await page.click('.ls-top [data-a="panel"]');
    await page.waitForSelector('#side:not([hidden]) [data-st="acts"]'); await page.click('[data-st="acts"]');
    await page.waitForSelector('#spActList .sp-act');
    const all = await page.$$eval('#spActList .sp-act', x => x.length);
    await page.type('[data-sf="actq"]', 'fishbowl');
    await page.waitForFunction(() => document.querySelectorAll('#spActList .sp-act').length === 1);
    await page.click('#spActList [data-sact="fishbowl"]');
    await page.waitForSelector('[data-sactadd="fishbowl"]');
    assert.match(await page.$eval('#spActList .sp-act.open', d => d.textContent), /How to run it[\s\S]*On the slide for students[\s\S]*Inner circle/);
    await page.click('[data-sactadd="fishbowl"]');
    await page.waitForFunction(() => window.__planner.L.open.slides.length === 4);
    const s = await page.evaluate(() => { const P = window.__planner, x = P.L.open.slides[2]; return { cur: P.L.cur, layout: x.layout, title: x.title, first: x.body.split('\n')[0], notes: /^How to run it/.test(x.notes) }; });
    assert.deepEqual(s, { cur: 2, layout: 'steps', title: 'Fishbowl discussion', first: '1. Inner circle: talk about the question, using the text', notes: true });
    // filters
    await page.$eval('[data-sf="actq"]', i => { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForFunction(n => document.querySelectorAll('#spActList .sp-act').length === n, {}, all);
    await page.click('[data-sactp="warmup"]');
    await page.waitForFunction(n => { const k = document.querySelectorAll('#spActList .sp-act').length; return k > 0 && k < n; }, {}, all);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('every new deck starts with the title slide, then the agenda as slide 2', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(async s => { await window.__planner.applySetup(s); }, SETUP);
    const r = await page.evaluate(async () => {
      const P = window.__planner, order = l => l.slides.map(s => s.layout + '|' + s.title);
      // an agenda further down moves up to slide 2; the title slide stays as it is
      const moved = order(P.deckStart(P.normLesson({ title: 'Claims', slides: [{ layout: 'title', title: 'Claims', body: 'Course A' }, { layout: 'warmup', title: 'Warm-up' }, { layout: 'agenda', title: '11/3 Agenda', body: '1. Warm-up' }] })));
      // no title slide and no agenda: both are added, the agenda dated from the lesson's first class
      const added = P.deckStart(P.normLesson({ title: 'Evidence', slots: [{ classId: 'A1', date: '2026-11-05' }, { classId: 'A2', date: '2026-11-04' }], slides: [{ layout: 'content', title: 'Find the evidence' }] }));
      // a title slide out of place goes first
      const title = order(P.deckStart(P.normLesson({ title: 'T', slides: [{ layout: 'agenda', title: 'Agenda' }, { layout: 'title', title: 'T' }] })));
      // a new lesson file from Claude gets the same start; one already in the Planner is left as it is
      const root = await navigator.storage.getDirectory(), dir = await root.getDirectoryHandle('deck-' + Date.now(), { create: true });
      P.L.dir = dir; P.L.dirOk = true;
      const mine = P.normLesson({ title: 'Mine', slides: [{ layout: 'title', title: 'Mine' }, { layout: 'content', title: 'Just this' }] });
      P.L.lessons.push(mine); await P.folderWriteAll();
      await new Promise(r => setTimeout(r, 1700));
      const w = await (await dir.getFileHandle('New from Claude.lesson.json', { create: true })).createWritable();
      await w.write(JSON.stringify({ title: 'From Claude', fmt: 2, slides: [{ layout: 'title', title: 'From Claude' }, { layout: 'content', title: 'Read' }, { layout: 'agenda', title: 'Agenda', body: '1. Read\n2. Talk' }] })); await w.close();
      await P.folderRead(false);
      const cl = P.L.lessons.find(l => l.title === 'From Claude');
      const file = JSON.parse(await (await (await dir.getFileHandle(cl._file)).getFile()).text());
      return { moved, added: order(added) + ' ' + added.slides[1].body, title, claude: order(cl), file: file.slides.map(s => s.layout), mine: order(P.L.lessons.find(l => l.title === 'Mine')) };
    });
    assert.deepEqual(r.moved, ['title|Claims', 'agenda|11/3 Agenda', 'warmup|Warm-up']);
    assert.equal(r.added, 'title|Evidence,agenda|11/4 Agenda,content|Find the evidence ');
    assert.deepEqual(r.title, ['title|T', 'agenda|Agenda']);
    assert.deepEqual(r.claude, ['title|From Claude', 'agenda|Agenda', 'content|Read']);
    assert.deepEqual(r.file, ['title', 'agenda', 'content'], 'the file gets the same order back');
    assert.deepEqual(r.mine, ['title|Mine', 'content|Just this'], 'lessons already in the Planner are not changed');
    // the README tells Claude the rule
    const readme = await page.evaluate(async () => await (await (await window.__planner.L.dir.getFileHandle('README - for Claude.md')).getFile()).text());
    assert.match(readme, /Slide 1 is always the title slide and slide 2 always the agenda/);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('comments on the whole lesson: a box in the editor, kept on the lesson, shared with right-click, and sent to Claude', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(async s => { await window.__planner.applySetup(s); }, SETUP);
    await page.evaluate(() => { const P = window.__planner, l = P.normLesson({ id: 'wl', title: 'Theme', slides: [{ layout: 'title', title: 'Theme' }, { layout: 'content', title: 'Symbols' }] }); P.L.lessons.push(l); P.openLessonForTest(l, 1); });
    await page.waitForSelector('.pl-ltalk [data-f="lsay"]');
    await page.type('[data-f="lsay"]', 'Keep it lighter, they just had a test'); await page.keyboard.press('Enter');
    await page.waitForSelector('.pl-ltalk .pl-msg.me');
    // it stays the same on every slide, and the slide's own comments are separate
    await page.evaluate(() => window.__planner.openLessonForTest(window.__planner.L.open, 0));
    assert.match(await page.$eval('.pl-ltalk', e => e.textContent), /Keep it lighter/);
    assert.equal(await page.evaluate(() => window.__planner.L.open.slides.every(s => !s.talk.length)), true);
    // one typed but not added is kept when I copy for Claude
    await page.type('[data-f="lsay"]', 'Use the poem from Monday');
    const r = await page.evaluate(async () => {
      const P = window.__planner; let copied = ''; navigator.clipboard.writeText = async t => { copied = t; };
      document.querySelector('[data-a="send"]').click(); for (let k = 0; k < 40 && !copied; k++) await new Promise(r => setTimeout(r, 50));
      return { copied, talk: P.L.open.talk.map(t => t.by + ':' + t.text), file: P.lessonForFile(P.L.open, null).talk.length };
    });
    assert.deepEqual(r.talk, ['you:Keep it lighter, they just had a test', 'you:Use the poem from Monday']);
    assert.match(r.copied, /My comment on the whole lesson: Keep it lighter[\s\S]*My comment on the whole lesson: Use the poem from Monday/);
    assert.equal(r.file, 2, 'saved in the lesson file for Claude');
    // Claude's reply and Done; the Comments list has the whole lesson first
    await page.evaluate(() => { const P = window.__planner; P.L.open.talk.push({ by: 'claude', text: 'Made the warm-up a game.' }); P.renderLessons(); });
    await page.click('.pl-ltalk [data-ltalkdone="0"]');
    assert.equal(await page.evaluate(() => window.__planner.L.open.talk[0].done), true);
    assert.match(await page.$eval('[data-a="comments"]', b => b.textContent), /Comments \(2\)/);
    await page.click('[data-a="comments"]'); await page.waitForSelector('.pl-cmts');
    assert.match(await page.$eval('.pl-cmts', e => e.textContent), /^The whole lesson/);
    await page.click('#dlgBox [data-x]');
    // a right-click comment on the lesson's card in the week lands in the same place
    await page.evaluate(() => { const P = window.__planner; P.L.open = null; P.L.view = 'week'; P.renderLessons(); });
    await page.waitForSelector('[data-open="wl"]');
    const card = await page.$('[data-open="wl"]'), bx = await card.boundingBox();
    await page.mouse.click(bx.x + 10, bx.y + 10, { button: 'right' });
    await page.waitForSelector('.pl-ctx [data-cx="note"]'); await page.click('.pl-ctx [data-cx="note"]');
    await page.waitForSelector('#plNoteT'); await page.type('#plNoteT', 'Add a short video'); await page.click('[data-nok]');
    await page.waitForFunction(() => (window.__planner.L.lessons.find(l => l.id === 'wl').talk || []).length === 4);
    assert.equal(await page.evaluate(() => window.__planner.L.lessons.find(l => l.id === 'wl').talk[3].text), 'Add a short video');
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('the lesson name and the title slide match both ways, unless I set them apart', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(async s => { await window.__planner.applySetup(s); }, SETUP);
    await page.evaluate(() => { const P = window.__planner, l = P.normLesson({ id: 'tt', title: 'Old name', slides: [{ layout: 'title', title: 'Old name' }, { layout: 'content', title: 'Notes' }] }); P.L.lessons.push(l); P.openLessonForTest(l, 0); });
    await page.waitForSelector('[data-a="tlink"].on');
    // typing the lesson name changes the title slide
    await page.$eval('[data-f="ltitle"]', i => { i.value = ''; i.focus(); }); await page.type('[data-f="ltitle"]', 'Symbols in poems');
    assert.equal(await page.evaluate(() => window.__planner.L.open.slides[0].title), 'Symbols in poems');
    assert.equal(await page.$eval('#lsStage .ls-ttl', e => e.textContent), 'Symbols in poems');
    // editing the title slide changes the lesson name (without the bold marks)
    await page.click('#lsStage .ls-ttl'); await page.waitForSelector('.ls-rted, .ls-ta');
    await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
    await page.keyboard.type('Symbols and images');
    await page.click('.ls-notes textarea');
    await page.waitForFunction(() => window.__planner.L.open.title === 'Symbols and images');
    assert.equal(await page.$eval('[data-f="ltitle"]', i => i.value), 'Symbols and images');
    // set apart: they can differ, and it's remembered
    await more(page, 'tlink'); await page.waitForSelector('[data-a="tlink"]:not(.on)');
    await page.$eval('[data-f="ltitle"]', i => { i.value = ''; i.focus(); }); await page.type('[data-f="ltitle"]', 'Week 3 Tue');
    const r = await page.evaluate(() => { const P = window.__planner, l = P.L.open; return { name: l.title, slide: l.slides[0].title, apart: P.normLesson(JSON.parse(JSON.stringify(l))).titleApart }; });
    assert.deepEqual(r, { name: 'Week 3 Tue', slide: 'Symbols and images', apart: true });
    // matched again: the title slide takes the lesson name
    await more(page, 'tlink'); await page.waitForSelector('[data-a="tlink"].on');
    assert.equal(await page.evaluate(() => window.__planner.L.open.slides[0].title), 'Week 3 Tue');
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});

test('a lesson’s top bar is light: its name, its classes, status, Download and Present, with the rest in More', async () => {
  const a = await open();
  try {
    const { page, errors } = a;
    await page.evaluate(async s => { const P = window.__planner; await P.applySetup(s); P.L.view = 'week'; P.renderLessons(); const l = P.normLesson({ title: 'Claims', slides: [{ layout: 'title', title: 'Claims' }, { layout: 'content', title: 'Counterclaims' }] }); P.L.lessons.push(l); P.openLessonForTest(l, 0); }, SETUP);
    await page.waitForSelector('.ls-top [data-a="pptx"]');
    const shown = () => page.$$eval('.ls-top > button, .ls-top > .ls-morew > button, .ls-top > .ls-slots > button', b => b.filter(x => x.checkVisibility()).map(x => x.textContent.trim()));
    const top = await shown();
    assert.deepEqual([top[0], ...top.slice(-3)], ['‹ Week', 'More ▾', 'Download .pptx', 'Present']);
    for (const gone of ['Copy for Claude', 'Versions', '↑ Upload lesson .zip', 'Comments']) assert.ok(!top.includes(gone), gone + ' is not above the slide');
    assert.deepEqual(await page.$$eval('.ls-top .btn.primary', b => b.map(x => x.textContent)), ['Present'], 'one blue button');
    // More holds the rest
    assert.ok(await page.$eval('.ls-menu', m => m.hidden));
    await page.click('.ls-top [data-a="more"]');
    assert.equal(await page.$eval('.ls-top [data-a="more"]', b => b.getAttribute('aria-expanded')), 'true');
    const items = await page.$$eval('.ls-menu .mi', x => x.map(e => e.firstChild.textContent.trim()));
    assert.deepEqual(items.slice(0, 4), ['Copy for Claude', 'Comments', 'Versions', 'Upload lesson .zip']);
    assert.deepEqual(items.slice(-4), ['Save lesson file…', 'Copy to another class or day…', 'Copy lesson as text', 'Delete this lesson']);
    assert.ok(items.includes('Name matches the title slide ✓'));
    // Escape closes it, and so does a click somewhere else
    await page.keyboard.press('Escape');
    assert.ok(await page.$eval('.ls-menu', m => m.hidden));
    assert.equal(await page.evaluate(() => document.activeElement.dataset.a), 'more');
    await page.click('.ls-top [data-a="more"]'); await page.click('.ls-title-in');
    assert.ok(await page.$eval('.ls-menu', m => m.hidden));
    // an item does what its button did
    await more(page, 'versions'); await page.waitForSelector('#dlgBox h2');
    assert.ok(await page.$eval('.ls-menu', m => m.hidden));
    await page.click('#dlgBox [data-x]');
    // once the lesson has a comment, Comments is above the slide with its count
    await page.evaluate(() => { const P = window.__planner; P.L.open.talk = [{ by: 'you', text: 'Shorter warm-up', at: 1 }]; P.renderLessons(); });
    await page.waitForSelector('.ls-top > [data-a="comments"]');
    assert.equal(await page.$eval('.ls-top > [data-a="comments"]', b => b.textContent), 'Comments (1)');
    assert.equal(await page.$('.ls-menu [data-a="comments"]'), null);
    // delete takes two clicks, and the first keeps the menu open
    await more(page, 'mdelete');
    assert.equal(await page.$eval('.ls-menu [data-a="mdelete"]', b => b.textContent), 'Click again to delete it for good');
    assert.ok(!await page.$eval('.ls-menu', m => m.hidden));
    await page.click('.ls-menu [data-a="mdelete"]');
    await page.waitForFunction(() => window.__planner.L.view === 'week' && !window.__planner.L.lessons.length);
    assert.deepEqual(errors, []);
  } finally { await a.done(); }
});
