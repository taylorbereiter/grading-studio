// Stage 3, any teacher: a brand-new browser carries nothing of anyone's and opens on three questions; a sample class to try
// everything on; papers from Canvas and Moodle downloads; grading presets; and a browser that was used before stays as it was.
// Made-up classes and students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { launch } = require('./helpers/chrome');
const { serve } = require('./helpers/serve');
const { ROOT, USED_BEFORE, builtHtml, openApp, goTo, openZip, waitPaper, appReady, answerDlg, settle } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { builtHtml(); browser = await launch(); });
after(async () => { await browser.close(); });

// Every word on the page a teacher could meet: text (shown or not yet shown), tooltips, placeholders and labels. The lists of
// school systems to choose from are left out, since naming ManageBac there is an offer, not an assumption.
const wordsOf = page => page.evaluate(() => {
  const out = [], skip = el => el.closest('script, style, option, .wlpr, [data-offer]');
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.parentElement && !skip(n.parentElement) && n.textContent.trim()) out.push(n.textContent);
  for (const el of document.body.querySelectorAll('[title], [placeholder], [aria-label], [value]')) if (!skip(el)) for (const a of ['title', 'placeholder', 'aria-label', 'value']) if (el.getAttribute(a)) out.push(el.getAttribute(a));
  out.push(document.title);
  return out.join('\n');
});
// Nothing of the first teacher's: her classes, her school's systems, her scale, her name.
const HERS = /12EL|11EL|ManageBac|Atlas|Taylor|Bereiter|12 = 100|12-point/i;
const noneOfHers = async (page, where) => { const t = await wordsOf(page), m = t.match(HERS); assert.equal(m && t.slice(Math.max(0, m.index - 60), m.index + 60), null, where + ' names something no one typed'); };
const lib = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().lib)));
const welcomeShown = page => page.$eval('#welcome', e => !e.hidden);
const setValue = (page, sel, v) => page.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);

test('a brand-new browser opens on the welcome, holds nothing of anyone’s, and stores nothing until it is answered', async () => {
  const { page, close } = await openApp(browser, { newTeacher: true });
  assert.equal(await welcomeShown(page), true);
  assert.match(await page.$eval('#welcome', e => e.innerText), /What do you teach\?[\s\S]*Where do students hand in work\?/);
  assert.deepEqual((await lib(page)).classes, [], 'no starter classes');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.lib')), null, 'nothing is stored while the questions wait');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.words')), null);
  assert.equal(await page.evaluate(() => window.__gs.state().setup.scale), null, 'no one’s scale is the default');
  assert.equal(await page.evaluate(() => window.__gs.sysName()), '');
  await noneOfHers(page, 'The welcome and Home');
  // the questions keep the keyboard: the page behind is out of reach
  assert.equal(await page.$eval('.shell', e => getComputedStyle(e).visibility), 'hidden');
  // every page of the app, the welcome put away, still nothing
  await page.evaluate(() => { document.querySelector('#welcome').hidden = true; document.documentElement.classList.remove('welcoming'); });
  await noneOfHers(page, 'Home');
  const secs = await page.evaluate(() => { window.__gs.go('#/settings'); return [...document.querySelectorAll('#setNav [data-sec], .setnav a')].map(a => (a.getAttribute('href') || '').split('/').pop() || a.dataset.sec).filter(Boolean); });
  for (const s of ['saving', 'history', 'classes', 'terms', 'grading', 'marking', 'timetable', 'display', 'claude', 'keys', 'about'].concat(secs)) {
    await goTo(page, '#/settings/' + s);
    await noneOfHers(page, 'Settings, ' + s);
  }
  await goTo(page, '#/');
  await page.click('#addClass');
  await noneOfHers(page, 'Add a class');
  assert.deepEqual(page.errors, []);
  await close();
});

test('three answers and she is set up: her classes in the sidebar, her school’s name in the words, letters beside the percent', async () => {
  const { page, close } = await openApp(browser, { newTeacher: true });
  await page.type('#wlC0', 'Period 2 Biology');
  await page.type('#wlC1', '  Period 5   Chemistry ');
  await page.type('#wlC2', 'period 2 biology');   // the same class typed twice is one class
  await page.select('#wlSys', 'Canvas');
  await page.click('#welcome [data-wlnext]');
  assert.match(await page.$eval('#welcome', e => e.innerText), /How do you usually grade\?/);
  assert.equal(await page.$eval('#welcome [data-wlway].on', e => e.dataset.wlway), 'rubric', 'rubric rows unless she says otherwise');
  await page.click('#welcome [data-wlway="letters"]');
  await page.click('#welcome [data-wlback]');
  assert.equal(await page.$eval('#wlC0', e => e.value), 'Period 2 Biology', 'Back keeps what she typed');
  assert.equal(await page.$eval('#wlSys', e => e.value), 'Canvas');
  await page.click('#welcome [data-wlnext]');
  assert.equal(await page.$eval('#welcome [data-wlway].on', e => e.dataset.wlway), 'letters');
  await page.click('#welcome [data-wlnext]');
  assert.match(await page.$eval('#welcome', e => e.innerText), /Where should your work be kept\?/);
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.lib')), null, 'still nothing stored before Start');
  await page.click('#welcome [data-wlnext]');
  assert.equal(await welcomeShown(page), false);
  const l = await lib(page);
  assert.deepEqual(l.classes.map(c => c.name), ['Period 2 Biology', 'Period 5 Chemistry']);
  assert.equal(l.me.sys, 'Canvas'); assert.equal(l.me.unit, ''); assert.equal(l.me.grade.way, 'letters'); assert.ok(l.me.hi > 0);
  assert.equal(l.me.scale12, undefined);
  assert.deepEqual(await page.$$eval('#railClasses [data-railcls] .rname', a => a.map(e => e.textContent)), ['Period 2 Biology', 'Period 5 Chemistry']);
  assert.equal(await page.$eval('#dropSay', e => e.textContent), 'A ZIP from Canvas, a folder, a scan of the whole class, or photos.');
  assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('gs.words'))), { sys: 'Canvas', unit: '' });
  await noneOfHers(page, 'Home after the welcome');
  // a new assignment starts as she said: a percent, with the letter it earns
  await openZip(page, zipOf({ 'Ada Example/Essay.pdf': await makePaper({ title: 'Ada' }), 'Ben Sample/Essay.pdf': await makePaper({ title: 'Ben' }) }), 'Cells essay.zip');
  assert.deepEqual(await page.evaluate(() => { const s = window.__gs.state().setup; return [s.mode, s.outOf, s.scale]; }), ['points', 100, null]);
  await setValue(page, '#ptsIn', '85');
  await page.waitForFunction(() => /85%/.test(document.querySelector('#gradeTotal, .gtotal, #total')?.textContent || document.body.innerText));
  assert.match(await page.$eval('.pc', e => e.textContent), /^85% · B$/);
  await settle(page);
  await page.evaluate(() => window.__gs.openGrades());
  await page.waitForSelector('#glTable');
  assert.ok((await page.$$eval('#glTable th', a => a.map(e => e.textContent))).includes('Grade'));
  assert.ok((await page.$$eval('#glTable tbody tr:first-child td', a => a.map(e => e.textContent.trim()))).includes('B'));
  await noneOfHers(page, 'An open assignment');
  // and it is still so after the tab is closed and opened again, with no questions
  await page.reload(); await appReady(page);
  assert.equal(await welcomeShown(page), false);
  assert.equal(await page.$eval('#dropSay', e => e.textContent), 'A ZIP from Canvas, a folder, a scan of the whole class, or photos.');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a paper dropped past the welcome is marked as a new teacher’s, and the next visit asks nothing', async () => {
  const { page, close } = await openApp(browser, { newTeacher: true });
  await openZip(page, zipOf({ 'Ada Example/Essay.pdf': await makePaper({ title: 'Ada' }) }), 'Essay.zip');
  assert.equal(await welcomeShown(page), false, 'the papers are in front, not the questions');
  await settle(page);
  const l = await lib(page);
  assert.equal(l.me.sys, ''); assert.equal(l.me.grade.way, 'rubric');
  assert.equal(await page.evaluate(() => window.__gs.state().setup.scale), null);
  await page.reload(); await appReady(page);
  assert.equal(await page.evaluate(() => window.__gs.sysName()), '', 'never taken for a teacher from before');
  await noneOfHers(page, 'Home, the welcome skipped');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the sample class: made-up papers to try, a way back to her own classes, and Remove takes all of it away', async () => {
  const { page, close } = await openApp(browser, { newTeacher: true });
  await page.click('#welcome [data-wlsample]');
  await waitPaper(page);
  assert.equal(await welcomeShown(page), false);
  const s = await page.evaluate(() => { const s = window.__gs.state(); return { n: s.batch.students.length, papers: s.batch.students.filter(x => x.files.length).length, name: s.batch.name, crit: s.setup.criteria, cls: s.lib.classes.map(c => [c.name, !!c.sample, c.names.length]) }; });
  assert.deepEqual(s, { n: 6, papers: 5, name: 'Persuasive paragraph', crit: ['Claim', 'Evidence', 'Writing'], cls: [['Sample class', true, 6]] });
  await noneOfHers(page, 'The sample papers');
  await settle(page);
  for (const tab of ['grades', 'insights', 'return']) { await page.evaluate(t => window.__gs.go(location.hash.replace(/\/(grades|insights|return).*$/, '') + '/' + t), tab); await noneOfHers(page, 'The sample class, ' + tab); }
  await goTo(page, '#/');
  await page.waitForSelector('#sampleNote:not([hidden]) [data-wlstart]');
  assert.match(await page.$eval('#sampleNote', e => e.innerText), /You’re looking at a sample class[\s\S]*made up/);
  await noneOfHers(page, 'Home with the sample class');
  // her own classes, from the card
  await page.click('#sampleNote [data-wlstart]');
  assert.equal(await welcomeShown(page), true);
  assert.equal(await page.$('#welcome [data-wlsample]'), null, 'the sample is already here');
  await page.type('#wlC0', 'Period 1 History');
  for (let i = 0; i < 3; i++) await page.click('#welcome [data-wlnext]');
  assert.deepEqual((await lib(page)).classes.map(c => c.name), ['Sample class', 'Period 1 History']);
  assert.equal(await page.$('#sampleNote [data-wlstart]'), null, 'asked once');
  // a reload does not ask again while only the sample was there
  await page.reload(); await appReady(page);
  assert.equal(await welcomeShown(page), false);
  await page.waitForSelector('#sampleNote:not([hidden]) [data-samplerm]');
  await page.click('#sampleNote [data-samplerm]');
  await page.waitForFunction(() => document.querySelector('#sampleNote').hidden);
  assert.deepEqual((await lib(page)).classes.map(c => c.name), ['Period 1 History']);
  assert.equal(await page.evaluate(() => window.__gs.kept().size), 0, 'its papers went with it');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a new browser that only looked at the sample is asked again from the card, not at every visit', async () => {
  const { page, close } = await openApp(browser, { newTeacher: true });
  await page.click('#welcome [data-wlsample]');
  await waitPaper(page); await settle(page);
  await page.reload(); await appReady(page);
  assert.equal(await welcomeShown(page), false);
  await page.waitForSelector('#sampleNote:not([hidden]) [data-wlstart]');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a browser that was used before is not asked anything, and every word, default and saved byte is as it was', async () => {
  const { page, close } = await openApp(browser);
  assert.equal(await welcomeShown(page), false);
  assert.equal(await page.$eval('#dropTitle', e => e.textContent), 'Drop new student work anywhere');
  assert.match(await wordsOf(page), HERS, 'her words are where they were (and the check above can see them)');
  assert.equal(await page.$eval('#dropSay', e => e.textContent), 'A ZIP from ManageBac, a folder, a scan of the whole class, or photos.');
  assert.deepEqual(await page.evaluate(() => { const G = window.__gs, s = G.state(); return [s.lib.me, JSON.stringify(s.setup.scale) === JSON.stringify(G.SCALE12), G.meGrade(), G.bandOf(85)]; }), [undefined, true, null, ''].map(v => v === undefined ? null : v));
  for (const s of ['classes', 'grading']) await goTo(page, '#/settings/' + s);
  assert.match(await page.$eval('#setWay', e => e.innerText), /Not chosen: a new assignment starts as it always has here/);
  assert.equal(await page.$eval('#meSys', e => e.value), 'ManageBac');
  await goTo(page, '#/');
  await openZip(page, zipOf({ 'Ada Example/Essay.pdf': await makePaper({ title: 'Ada' }) }), 'Essay.zip');
  await settle(page);
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('gs.lib')));
  assert.equal(saved.me, undefined, 'nothing about the welcome is written into her work');
  assert.equal(saved.seed2627, true);
  assert.deepEqual(saved.classes, JSON.parse(USED_BEFORE['gs.lib']).classes);
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.words')), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Settings changes the same answers, and a teacher from before keeps the rest of what she had', async () => {
  const { page, close } = await openApp(browser);
  await goTo(page, '#/settings/classes');
  await page.select('#meSys', 'Google Classroom');
  let l = await lib(page);
  assert.deepEqual(l.me, { sys: 'Google Classroom', unit: 'Atlas', scale12: true });
  await goTo(page, '#/');
  assert.equal(await page.$eval('#dropSay', e => e.textContent), 'A ZIP from Google Classroom, a folder, a scan of the whole class, or photos.');
  await goTo(page, '#/settings/classes');
  await page.select('#meSys', 'other');
  await page.waitForSelector('#meSysOther');
  await setValue(page, '#meSysOther', 'Firefly');
  assert.equal(await page.evaluate(() => window.__gs.sysName()), 'Firefly');
  // how she grades: asked first, since her new assignments have started the same way until now
  await goTo(page, '#/settings/grading');
  await page.click('#setWay [data-meway="ib7"]');
  await answerDlg(page);
  assert.match(page.lastDialog, /Assignments you already have keep their own rubric and scale/);
  await page.waitForSelector('#setWay [data-mebp="0"]');
  assert.equal(await page.evaluate(() => window.__gs.bandOf(72)), '6');
  await setValue(page, '#setWay [data-mebp="1"]', '75');
  assert.equal(await page.evaluate(() => window.__gs.bandOf(72)), '5', 'her own boundary');
  l = await lib(page);
  assert.equal(l.me.grade.way, 'ib7'); assert.equal(l.me.unit, 'Atlas');
  assert.deepEqual(l.classes.map(c => c.name), ['12EL-1', '12EL-2', '11EL-2'], 'her classes are untouched');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a Canvas download and a Moodle download come in as one student each, under their names', async () => {
  const pdf = await makePaper({ title: 'Essay' });
  const { page, close } = await openApp(browser, { newTeacher: true });
  await page.evaluate(() => { document.querySelector('#welcome [data-wlnext]').click(); document.querySelector('#welcome [data-wlnext]').click(); document.querySelector('#welcome [data-wlnext]').click(); });
  await openZip(page, zipOf({ 'doejane_41234_889001_Essay.pdf': pdf, 'doejane_41234_889002_Works cited.pdf': pdf, 'roemax_LATE_41777_889003_Essay-1.pdf': pdf }), 'submissions.zip');
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.students.map(s => [s.key, s.files.length])), [['doejane', 2], ['roemax', 1]]);
  await goTo(page, '#/');
  await openZip(page, zipOf({ 'Jane Doe_5501_assignsubmission_file_/Essay.pdf': pdf, 'Jane Doe_5501_assignsubmission_file_/Notes.pdf': pdf, 'Max Roe_5502_assignsubmission_file_/Essay.pdf': pdf }), 'Unit 2-Essay-5512.zip');
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.students.map(s => [s.key, s.files.length])), [['Jane Doe', 2], ['Max Roe', 1]]);
  // files that only look a little like it stay as they are: one file each, by their own names
  await goTo(page, '#/');
  await openZip(page, zipOf({ 'IMG_2026_1110_a.pdf': pdf, 'IMG_2026_1111_b.pdf': pdf, 'scan_2026_1110_c.pdf': pdf }), 'Photos.zip');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students.length), 3);
  assert.deepEqual(page.errors, []);
  await close();
});

test('work from before the welcome, brought into a browser that was only just set up, keeps its own words', async () => {
  const { page, close } = await openApp(browser);
  const r = await page.evaluate(() => {
    const m = window.__gs.carryParts.mergeLib, me = { sys: 'Canvas', unit: '', grade: { way: 'rubric' }, hi: 5 };
    const empty = { classes: [], loose: { id: '', units: [] }, units: [], me }, cls = { id: 'c1', name: 'Period 3', names: ['Ada Example'], units: [] };
    const old = { classes: [cls], loose: { id: '', units: [] }, units: [] };
    const out = x => (x.lib || x).me || null;
    return [out(m(empty, old)), out(m({ ...empty, classes: [{ id: 'c2', name: 'Mine', names: ['Ben Sample'], units: [] }] }, old)), out(m(empty, { ...old, me: { sys: 'Moodle', unit: '' } })), out(m(old, empty))];
  });
  assert.equal(r[0], null, 'nothing here yet: the incoming work reads as it did where it came from');
  assert.equal(r[1].sys, 'Canvas', 'she has work of her own here: her answers stay');
  assert.equal(r[2].sys, 'Canvas', 'both said: this browser’s');
  assert.equal(r[3].sys, 'Canvas', 'an old browser taking in a new teacher’s empty set takes her answers');
  await close();
});

test('the Planner for a new teacher: classes typed in, no setup file, plain words, and a lesson that downloads as PowerPoint', async () => {
  const server = await serve(() => fs.readFileSync(path.join(ROOT, 'planner.html'), 'utf8'));
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(server.url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
    await page.evaluate(() => { window.__planner.L.view = 'week'; window.__planner.renderLessons(); });
    assert.match(await page.$eval('#lessons', e => e.innerText), /Tell the Planner when your classes meet/);
    await noneOfHers(page, 'The Planner, new');
    await page.click('[data-a="setup"]'); await page.waitForSelector('[data-addc]'); await page.click('[data-addc]');
    await page.type('[data-c="name"]', 'Period 2 Biology'); await page.type('[data-c="course"]', 'Biology'); await page.click('[data-addm]');
    await noneOfHers(page, 'The Planner’s timetable');
    await page.click('#dlgBox [data-ok]');
    await page.waitForFunction(() => window.__planner.L.setup && window.__planner.L.setup.classes.length === 1);
    assert.deepEqual(await page.evaluate(() => window.__planner.L.words), { sys: '', unit: '' });
    await noneOfHers(page, 'The Planner with a class');
    const bytes = Buffer.from(await page.evaluate(async () => {
      const P = window.__planner, l = P.normLesson({ title: 'Cells', slides: [{ layout: 'title', title: 'Cells' }, { layout: 'content', title: 'What a cell is', body: 'The smallest unit of life\nEvery living thing is made of them', size: 32 }] });
      P.openLessonForTest(l, 1);
      return Array.from(P.buildPptx(l));
    }));
    const { unzipSync, strFromU8 } = require('fflate'), z = unzipSync(new Uint8Array(bytes));
    assert.ok(z['[Content_Types].xml'] && z['ppt/presentation.xml'] && z['ppt/slides/slide1.xml'] && z['ppt/slides/slide2.xml'], 'a whole .pptx, with no template of anyone’s loaded');
    assert.match(strFromU8(z['ppt/slides/slide2.xml']), /What a cell is/);
    assert.ok(Object.keys(z).filter(k => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(k)).length >= 3);
    for (const k of Object.keys(z)) if (/\.(xml|rels)$/.test(k)) assert.ok(!HERS.test(strFromU8(z[k])), k + ' names something of hers');
    await noneOfHers(page, 'An open lesson');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); await server.close(); }
});

test('the Planner uses the names grading was given, and a setup file from before still loads with its own', async () => {
  const server = await serve(() => fs.readFileSync(path.join(ROOT, 'planner.html'), 'utf8'));
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage();
  try {
    await page.goto(server.url + 'blank').catch(() => {});
    await page.goto(server.url, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.setItem('gs.words', JSON.stringify({ sys: 'Canvas', unit: 'Curriculum map' })));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
    const t = await wordsOf(page);
    assert.ok(!/ManageBac|Atlas/.test(t));
  } finally { await ctx.close(); await server.close(); }
});
