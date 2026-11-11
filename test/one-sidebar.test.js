// Redesign step 5: the Planner wears the same sidebar as the grading page, Settings is one page per subject, and Home shows
// today's classes from the Planner's timetable. The wall between the two stays: the Planner reads nothing of grading's, and
// grading only reads the Planner's timetable and lessons, never writes them. Made-up classes and students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('./helpers/chrome');
const { openApp, appReady, goTo, idbRead, builtHtml, closeBox } = require('./helpers/app');
const ROOT = path.join(__dirname, '..');

// Grading and the Planner on one address, as on GitHub Pages.
function serveBoth() {
  builtHtml();
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0], file = p === '/' || p === '/index.html' ? 'index.html' : p === '/planner.html' ? 'planner.html' : null;
    if (!file && p !== '/blank') { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(file ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '<!doctype html><title>blank</title>');
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
const plannerReady = page => page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
async function planner(ctx, srv, hash = '') {
  const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(String(e)));
  await page.goto(srv.url + 'planner.html' + hash);
  await plannerReady(page);
  return page;
}
// The timetable: three classes. meetsToday puts one meeting of each on today's weekday, in this order of time.
const setupFor = dow => ({
  kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-08-31', semEnd: '2027-01-18',
  classes: [
    { id: 'A1', name: 'Course A-1', course: 'Course A', color: '#1F6FB2', meets: [{ dow, start: '13:30', end: '15:00' }] },
    { id: 'A2', name: 'Course A 2', course: 'Course A', color: '#7B3FC4', meets: [{ dow, start: '09:00', end: '10:30' }] },
    { id: 'B1', name: 'Course B-1', course: 'Course B', color: '#0E7C86', meets: [{ dow, start: '10:45', end: '12:15' }] }
  ],
  daysOff: [], events: []
});
const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'];
// Grading has "Course A-1" (with work left to score, so its own sidebar shows a count) and "CourseA2", spelled without the space.
const LIB = { seed2627: true, classes: [
  { id: 'c1', name: 'Course A-1', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [{ id: 'i1', name: 'River essay', classId: 'c1', batchId: 'gs.b.past1' }] }] },
  { id: 'c2', name: 'CourseA2', names: ['Gus Pretend'], units: [] },
], loose: { id: '', units: [] }, book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-31', end: '2026-11-20' }] } };
const GRADING = { ls: { 'gs.lib': JSON.stringify(LIB) }, idb: { 'grading-studio-keep': { version: 2, stores: { papers: [], work: [], edits: [], meta: [['gs.b.past1', { id: 'gs.b.past1', name: 'River essay', n: 4, scored: 1, t: 5 }]] } } } };

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

test('the Planner has the same sidebar: its own classes, no grading counts, and links to the grading page', async () => {
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    const g = await openApp(browser, { server: srv, context: ctx, seed: GRADING });
    assert.equal(await g.page.$eval('#railClasses .rcnt', e => e.textContent), '3', 'grading’s own sidebar counts what is left');
    const page = await planner(ctx, srv);
    await page.evaluate(async s => { await window.__planner.applySetup(s); }, setupFor(2));
    await page.waitForSelector('#railClasses a');
    // the same rows in the same order as on the grading page, with the Planner's own sections where its one row is, and Timetable where Add a class is
    assert.deepEqual(await page.$$eval('#rail > *', els => els.filter(e => e.checkVisibility() && e.innerText.trim()).map(e => e.innerText.replace(/\s+/g, ' ').trim().replace(/(Ctrl K|⌘K)$/, '').trim())),
      ['Grading Studio', 'Find anything', 'Today', 'PLANNER', 'Calendar', 'Units', 'Past lessons', 'Activities', 'Rubrics', 'CLASSES', 'Course A-1 Course A 2 Course B-1', 'Timetable', 'Not backed up This browser', 'Help', 'Settings']);
    assert.equal(await page.$eval('#railPlanner', a => a.getAttribute('aria-current')), 'page');
    assert.equal(await page.$('#rail .rcnt'), null, 'no counts');
    assert.ok(!/\d+ left|to score/.test(await page.$eval('#rail', e => e.textContent + [...e.querySelectorAll('[title]')].map(x => x.title).join(' '))), 'nothing about grading in the Planner’s sidebar');
    assert.deepEqual(await page.$$eval('#railClasses .rdot', d => d.map(x => x.style.background)), ['rgb(31, 111, 178)', 'rgb(123, 63, 196)', 'rgb(14, 124, 134)']);
    // the top bar no longer carries what the sidebar has
    assert.equal(await page.$('.ls-top [data-a="close"]'), null);
    assert.equal(await page.$('.ls-top .themeBtn'), null);
    assert.equal(await page.$('.ls-top [data-a="setup"]'), null);
    // going between the Planner's sections is the sidebar's job: the page's head is its name and what the page itself does
    assert.equal(await page.$('.ls-top nav'), null);
    assert.equal(await page.$eval('.ls-top h1', e => e.textContent), 'Calendar');
    assert.deepEqual(await page.$$eval('#rail [data-v]', t => t.map(x => x.textContent.trim())), ['Calendar', 'Units', 'Past lessons', 'Activities', 'Rubrics']);
    assert.equal(await page.$('.ls-top [data-a="link"], .ls-top [data-a="sync"], .ls-top [data-a="reconnect"]'), null, 'the Planner folder is the sidebar’s Saved line');

    // a class goes to its page in grading, matched by name
    await Promise.all([page.waitForNavigation(), page.click('#railClasses a:nth-child(1)')]);
    await appReady(page);
    await page.waitForFunction(() => location.hash === '#/class/c1');
    assert.equal(await page.title(), 'Course A-1 · Grading Studio');
    await page.goBack(); await plannerReady(page);
    await Promise.all([page.waitForNavigation(), page.click('#railClasses a:nth-child(2)')]);   // "Course A 2" there is "CourseA2" here
    await appReady(page); await page.waitForFunction(() => location.hash === '#/class/c2');
    await page.goBack(); await plannerReady(page);
    await Promise.all([page.waitForNavigation(), page.click('#railClasses a:nth-child(3)')]);   // no such class in grading yet
    await appReady(page); await page.waitForFunction(() => location.hash === '#/' && !document.querySelector('#vHome').hidden);
    assert.match(await page.$eval('.toast', e => e.textContent), /no class called “Course B-1”/);
    await page.goBack(); await plannerReady(page);
    // Home, the name at the top, and Settings
    await Promise.all([page.waitForNavigation(), page.click('#rail .rnav[data-gs="#/"]')]);
    await appReady(page); assert.match(page.url(), /\/#\/$/); assert.ok(await page.$eval('#vHome', e => !e.hidden));
    await page.goBack(); await plannerReady(page);
    await Promise.all([page.waitForNavigation(), page.click('#rail .rnav[data-gs="#/settings"]')]);
    await appReady(page); assert.match(page.url(), /\/#\/settings$/); assert.ok(await page.$eval('#vSettings', e => !e.hidden));
    // and the grading page's Planner row comes back
    await Promise.all([page.waitForNavigation(), page.click('#lessonsBtn')]);
    await plannerReady(page);
    assert.deepEqual(page.errors, []); assert.deepEqual(g.page.errors, []);
  } finally { await ctx.close(); await srv.close(); }
});

test('the Planner’s sidebar reads nothing of grading’s', async () => {
  // In the sources: the sidebar code touches no storage of its own, and the Planner page names none of grading's keys.
  const rail = fs.readFileSync(path.join(ROOT, 'src', 'planner', 'rail.js'), 'utf8');
  assert.ok(!/localStorage|indexedDB|sessionStorage/.test(rail), 'rail.js opens no storage');
  const html = fs.readFileSync(path.join(ROOT, 'planner.html'), 'utf8');
  for (const s of ['gs.lib', 'grading-studio-keep', 'grading-studio-added', 'keptMeta', 'gs.b.']) assert.ok(!html.includes(s), 'planner.html should not contain ' + s);
  // And as it runs, with grading work in the browser: every key and database it opens is the Planner's own or one of the two shared ones.
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    const g = await openApp(browser, { server: srv, context: ctx, seed: GRADING });
    await g.page.close();
    const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(String(e)));
    await page.evaluateOnNewDocument(() => {
      window.__touched = { ls: new Set(), db: new Set() };
      for (const m of ['getItem', 'setItem', 'removeItem']) { const f = Storage.prototype[m]; Storage.prototype[m] = function (k, ...a) { window.__touched.ls.add(String(k)); return f.call(this, k, ...a); }; }
      const key = Storage.prototype.key; Storage.prototype.key = function (i) { window.__touched.ls.add('key()'); return key.call(this, i); };
      const open = IDBFactory.prototype.open; IDBFactory.prototype.open = function (n, ...a) { window.__touched.db.add(String(n)); return open.call(this, n, ...a); };
    });
    await page.goto(srv.url + 'planner.html'); await plannerReady(page);
    await page.evaluate(async s => { await window.__planner.applySetup(s); }, setupFor(2));
    await page.waitForSelector('#railClasses a');
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
    await page.waitForSelector('#findDlg .frow'); await page.keyboard.press('Escape');
    const t = await page.evaluate(() => ({ ls: [...window.__touched.ls], db: [...window.__touched.db] }));
    assert.deepEqual(t.db, ['gs-lessons']);
    for (const k of t.ls) assert.ok(k === 'gs.theme' || k === 'gs.lang' || k === 'gs.mblinks' || k === 'gs.words' || k === 'gs.rolls' || k.startsWith('gsp.'), 'the Planner touched ' + k);
    assert.deepEqual(page.errors, []);
  } finally { await ctx.close(); await srv.close(); }
});

test('the Planner’s sidebar folds while a lesson is open, and what was typed is kept when she leaves by it', async () => {
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    const page = await planner(ctx, srv);
    await page.evaluate(async s => { const P = window.__planner; await P.applySetup(s); P.L.weekOf = '2026-11-09'; P.L.view = 'week'; P.renderLessons(); }, setupFor(2));
    await page.waitForSelector('#railClasses a');
    assert.equal(await page.evaluate(() => document.body.classList.contains('pfold')), false);
    assert.equal(await page.$eval('#rail', r => Math.round(r.getBoundingClientRect().width)), 232);
    assert.equal(await page.$eval('#lessons', r => Math.round(r.getBoundingClientRect().left)), 232);
    await page.click('[data-new="A1|2026-11-10"]');
    await page.waitForSelector('.ls-title-in');
    await page.waitForFunction(() => document.body.classList.contains('pfold'));
    assert.equal(await page.$eval('#rail', r => Math.round(r.getBoundingClientRect().width)), 60);
    assert.equal(await page.$eval('#lessons', r => Math.round(r.getBoundingClientRect().left)), 60);
    assert.ok(await page.$eval('#rail .rl', e => !e.checkVisibility()), 'icons only');
    assert.equal(await page.title(), 'New lesson · Planner · Grading Studio');
    // type a name and leave at once, before the Planner's own short wait to save
    await page.focus('.ls-title-in'); await page.$eval('.ls-title-in', e => e.select()); await page.keyboard.type('Reading a sonnet');
    await Promise.all([page.waitForNavigation(), page.click('#rail .rnav[data-gs="#/"]')]);
    await appReady(page);
    const kept = await idbRead(page, 'gs-lessons', 'lessons');
    assert.deepEqual(kept.v.map(l => l.title), ['Reading a sonnet']);
    // back in the Planner, its own row goes to this week
    await page.goBack(); await plannerReady(page);
    await page.evaluate(() => { const P = window.__planner; P.L.view = 'units'; P.renderLessons(); });
    await page.click('#railPlanner');
    await page.waitForFunction(() => window.__planner.L.view === 'week');
    assert.equal(await page.evaluate(() => location.hash), '');
    assert.deepEqual(page.errors, []);
  } finally { await ctx.close(); await srv.close(); }
});

test('the Planner’s sections are in the sidebar, and the calendar is one of them with Week and Semester beside its name', async () => {
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    const page = await planner(ctx, srv);
    await page.evaluate(async s => { const P = window.__planner; await P.applySetup(s); P.L.view = 'week'; P.renderLessons(); }, setupFor(2));
    const on = () => page.$$eval('#rail [data-v].on, .ls-top h1, .ls-top .pl-tab.on', t => t.map(x => x.textContent.trim()));
    assert.deepEqual(await on(), ['Calendar', 'Calendar', 'Week']);
    await page.click('.pl-tabs.cal [data-v="semester"]'); await page.waitForSelector('.pl-row[data-wk]');
    assert.deepEqual(await on(), ['Calendar', 'Calendar', 'Semester']);
    await page.click('#rail [data-v="units"]'); await page.waitForFunction(() => window.__planner.L.view === 'units');
    assert.deepEqual(await on(), ['Units', 'Units']);
    assert.equal(await page.$eval('#rail [data-v="units"]', b => b.getAttribute('aria-current')), 'page');
    assert.equal(await page.$eval('#railPlanner', b => b.getAttribute('aria-current')), null);
    assert.equal(await page.$('.pl-tabs.cal'), null, 'Semester | Week only shows on the calendar');
    await page.click('#railPlanner');   // Calendar: the view she used last
    await page.waitForFunction(() => window.__planner.L.view === 'semester');
    for (const [v, name] of [['library', 'Past lessons'], ['activities', 'Activities'], ['bank', 'Rubrics']]) {
      await page.click('#rail [data-v="' + v + '"]'); await page.waitForFunction((v, name) => window.__planner.L.view === v && document.querySelector('.ls-top h1').textContent === name && document.querySelector('#rail [data-v].on').dataset.v === v, {}, v, name);   // some pages read their list before they draw
      assert.deepEqual(await on(), [name, name]);
    }
    assert.deepEqual(page.errors, []);
  } finally { await ctx.close(); await srv.close(); }
});

test('Find anything in the Planner reaches lessons, units, views, classes and the timetable', async () => {
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    const page = await planner(ctx, srv);
    await page.evaluate(async s => {
      const P = window.__planner; await P.applySetup(s);
      await P.unitPut(P.normUnit({ course: 'Course A', title: 'Unit 2: Argument', start: '2026-10-26', weeks: [{}, {}] }), true);
      await P.createLesson([{ classId: 'A1', date: '2026-11-10' }]); P.L.open.title = 'Counterclaims'; P.renderLessons();
      document.querySelector('[data-a="back"]').click(); await new Promise(r => setTimeout(r, 100));
    }, setupFor(2));
    const find = async q => { await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control'); await page.waitForSelector('#findIn'); if (q) await page.type('#findIn', q); };
    const rows = () => page.$$eval('#findList .frow', r => r.map(x => x.closest('#findList').querySelectorAll('.fcap').length && x.querySelector('b').textContent));
    await find('');
    const first = await rows();
    for (const want of ['Today', 'This week', 'Semester', 'Units', 'Past lessons', 'Activities', 'Rubrics', 'Settings', 'Course A-1', 'Make a new lesson', 'Import a lesson', 'Timetable', 'Side panel', 'Dark mode']) assert.ok(first.includes(want), want + ' is offered');
    assert.ok(!first.includes('Counterclaims'), 'lessons wait until she types');
    assert.equal(await page.$eval('#findKey', e => e.textContent), 'Ctrl K');
    await page.keyboard.press('Escape'); assert.equal(await page.$('#findDlg'), null);
    // a lesson by name
    await find('counter'); assert.equal((await rows())[0], 'Counterclaims');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__planner.L.view === 'edit' && window.__planner.L.open.title === 'Counterclaims');
    // a unit, from inside the lesson
    await find('argument'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__planner.L.view === 'unit' && window.__planner.L.unit.title === 'Unit 2: Argument' && !window.__planner.L.open);
    // a view
    await find('rubrics'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__planner.L.view === 'bank');
    // the timetable, and Dark mode (which the top bar used to hold)
    await find('timetable'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => /Timetable/.test((document.querySelector('#dlgBox h2') || {}).textContent || ''));
    await page.keyboard.press('Escape');
    await find('dark mode'); await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    await find('light mode'); await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    // words inside a lesson: handed to the Planner's own search
    await find('zzz nothing'); assert.deepEqual(await rows(), ['Search inside lessons for “zzz nothing”']);
    await page.keyboard.press('Enter');
    await page.waitForSelector('#fdQ'); assert.equal(await page.$eval('#fdQ', e => e.value), 'zzz nothing');
    await page.keyboard.press('Escape');
    // the button in the sidebar opens it too, and a class goes to grading
    await page.click('#findBtn'); await page.waitForSelector('#findIn'); await page.type('#findIn', 'course a-1');
    await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
    await appReady(page);
    assert.match(page.url(), /#\/$/);   // no such class in this browser's grading yet: Home, with a note
    assert.deepEqual(page.errors, []);
  } finally { await ctx.close(); await srv.close(); }
});

test('coming to the Planner from grading: this week, the timetable, the rubric bank or one lesson', async () => {
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    let page = await planner(ctx, srv);
    const id = await page.evaluate(async s => {
      const P = window.__planner; await P.applySetup(s);
      await P.createLesson([{ classId: 'A1', date: '2026-11-10' }]); const id = P.L.open.id; document.querySelector('[data-a="back"]').click(); await new Promise(r => setTimeout(r, 100));
      P.L.view = 'units'; P.renderLessons(); return id;
    }, setupFor(2));
    await page.close();
    page = await planner(ctx, srv, '#week');
    assert.equal(await page.evaluate(() => window.__planner.L.view), 'week'); assert.equal(await page.evaluate(() => location.hash), '', 'the address is tidied');
    await page.close();
    page = await planner(ctx, srv, '#timetable');
    await page.waitForFunction(() => /Timetable/.test((document.querySelector('#dlgBox h2') || {}).textContent || ''));
    await page.close();
    page = await planner(ctx, srv, '#rubrics');
    assert.equal(await page.evaluate(() => window.__planner.L.view), 'bank');
    await page.close();
    page = await planner(ctx, srv, '#lesson/' + encodeURIComponent(id));
    assert.equal(await page.evaluate(() => window.__planner.L.view + ' ' + window.__planner.L.open.id), 'edit ' + id);
    await page.close();
    page = await planner(ctx, srv, '#lesson/gone');   // a lesson that was deleted meanwhile: this week
    assert.equal(await page.evaluate(() => window.__planner.L.view), 'week');
    assert.deepEqual(page.errors, []);
  } finally { await ctx.close(); await srv.close(); }
});

test('Today shows the day’s classes from the Planner’s timetable, and writes nothing to it', async () => {
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    // no Planner work in this browser: no card, and the Planner's database isn't made by looking
    const g = await openApp(browser, { server: srv, context: ctx, seed: GRADING });
    await g.page.waitForSelector('#needs:not([hidden])');   // the side column is there for Needs a look alone
    assert.match(await g.page.$eval('#today', e => e.textContent), /Your timetable isn’t here yet/);   // one quiet line, with the way to the Planner
    assert.equal(await g.page.evaluate(async () => (await indexedDB.databases()).some(d => d.name === 'gs-lessons')), false);
    // a timetable with three classes today, two of them planned
    const pl = await planner(ctx, srv);
    await pl.evaluate(async () => {
      const P = window.__planner, now = new Date(), d = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      const s = { kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-08-31', semEnd: '2027-01-18', daysOff: [], events: [], classes: [
        { id: 'A1', name: 'Course A-1', course: 'Course A', color: '#1F6FB2', meets: [{ dow: now.getDay(), start: '13:30', end: '15:00' }] },
        { id: 'A2', name: 'Course A 2', course: 'Course A', color: '#7B3FC4', meets: [{ dow: now.getDay(), start: '09:00', end: '10:30' }] },
        { id: 'B1', name: 'Course B-1', course: 'Course B', color: '#0E7C86', meets: [{ dow: now.getDay(), start: '10:45', end: '12:15' }, { dow: (now.getDay() + 1) % 7, start: '08:00', end: '08:45' }] }] };
      await P.applySetup(s);
      const back = async () => { document.querySelector('[data-a="back"]').click(); await new Promise(r => setTimeout(r, 100)); };
      await P.createLesson([{ classId: 'A2', date: d }]); P.L.open.title = 'Annotating a sonnet'; P.L.open.status = 'review'; await back();
      await P.createLesson([{ classId: 'A1', date: d }]); P.L.open.title = 'Rhetorical appeals'; await back();
      await P.createLesson([{ classId: 'B1', date: '2020-01-01' }]); P.L.open.title = 'Another day'; await back();
    });
    const before = { kv: await idbRead(pl, 'gs-lessons', 'kv'), lessons: await idbRead(pl, 'gs-lessons', 'lessons') };
    const ids = Object.fromEntries(before.lessons.v.map(l => [l.title, l.id]));
    await pl.close();
    const { page } = g;
    await page.reload(); await appReady(page);
    await page.waitForSelector('#today .trow');
    assert.equal(await page.$eval('#today h2', e => e.textContent), 'Teaching today');
    // the class that is on now, or next, opens presenting; the others open the lesson
    const hm = await page.evaluate(() => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); });
    const cur = ['10:30', '12:15', '15:00'].findIndex(e => e > hm), go = (i, t, c) => i === cur ? ['Present', 'planner.html#present/' + ids[t] + '/' + c] : ['Open', 'planner.html#lesson/' + ids[t]];
    assert.deepEqual(await page.$$eval('#today .trow', r => r.map(x => [x.querySelector('.tt').textContent, x.querySelector('b').textContent, x.querySelector('.ns').textContent, (x.querySelector('.btn') || {}).textContent, x.getAttribute('href')])), [
      ['9:00', 'Course A 2', 'Annotating a sonnet · 3 slides · ready for you', ...go(0, 'Annotating a sonnet', 'A2')],
      ['10:45', 'Course B-1', 'No lesson planned yet', 'Plan it', 'planner.html#week'],
      ['1:30', 'Course A-1', 'Rhetorical appeals · 3 slides · draft', ...go(2, 'Rhetorical appeals', 'A1')],
    ]);
    assert.deepEqual(await page.$$eval('#today .rdot', d => d.map(x => x.style.background)), ['rgb(123, 63, 196)', 'rgb(14, 124, 134)', 'rgb(31, 111, 178)']);
    assert.equal(await page.$eval('#today .tweek', a => a.getAttribute('href')), 'planner.html#week');
    assert.equal(await page.$$eval('#today .trow.now', r => r.length) <= 1, true, 'at most one class is on now or next');
    // Settings says the same timetable, and Find anything goes to the week
    await goTo(page, '#/settings/timetable');
    await page.waitForSelector('#setTimetable .setrow');
    assert.deepEqual(await page.$$eval('#setTimetable .setrow b', b => b.map(x => x.textContent)), ['Course A-1', 'Course A 2', 'Course B-1']);
    assert.match(await page.$eval('#setTimetable', e => e.textContent), /2 meetings a week/);
    assert.equal(await page.$eval('#setTimetable a.btn', a => a.textContent + ' ' + a.getAttribute('href')), 'Open the timetable planner.html#timetable');
    assert.ok((await page.evaluate(() => window.__gs.findRows().map(r => r.label))).includes('This week in the Planner'));
    // nothing was written: the Planner's database is as it was
    assert.deepEqual({ kv: await idbRead(page, 'gs-lessons', 'kv'), lessons: await idbRead(page, 'gs-lessons', 'lessons') }, before);
    // a row opens that lesson in the Planner
    await goTo(page, '#/'); await page.waitForSelector('#today .trow');
    await Promise.all([page.waitForNavigation(), page.click('#today .trow')]);
    await plannerReady(page);
    assert.equal(await page.evaluate(() => window.__planner.L.open && window.__planner.L.open.title), 'Annotating a sonnet');
    assert.equal(await page.evaluate(() => !!document.querySelector('#present')), cur === 0, 'the class on now or next opens presenting');
    // where a class got to is said on its row, and a lesson taught to the end stops offering Present
    const taught = async (slide) => {
      await page.evaluate(async slide => {
        const P = window.__planner, now = new Date(), d = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        if (document.querySelector('#present')) await window.__present.end();
        if (!P.L.open) P.openLessonForTest(P.L.lessons.find(l => l.title === 'Annotating a sonnet'));
        P.L.open.taught = [{ classId: 'A2', date: d, slide, of: 3, note: '', at: Date.now() }];
        document.querySelector('[data-a="back"]').click(); await new Promise(r => setTimeout(r, 300));
      }, slide);
      await page.goto(srv.url); await appReady(page); await page.waitForSelector('#today .trow');
      return page.$eval('#today .trow', x => [x.querySelector('.ns').textContent, x.querySelector('.btn').textContent]);
    };
    assert.deepEqual(await taught(2), ['Annotating a sonnet · 3 slides · taught to slide 2 of 3', cur === 0 ? 'Present' : 'Open']);
    await page.goto(srv.url + 'planner.html'); await plannerReady(page);
    assert.deepEqual(await taught(3), ['Annotating a sonnet · 3 slides · taught', 'Open']);
    await page.goto(srv.url + 'planner.html'); await plannerReady(page);
    // a day off: said so, with no rows
    await page.evaluate(async () => { const P = window.__planner, now = new Date(), d = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'); await P.applySetup({ ...P.L.setup, kind: 'grading-studio-lessons-setup', daysOff: [{ date: d, label: 'Founders’ day' }] }); });
    await page.goto(srv.url); await appReady(page);
    await page.waitForSelector('#today .trow.none');
    assert.equal(await page.$('#today a.trow'), null);
    assert.match(await page.$eval('#today', e => e.textContent), /No classes today.*Founders’ day/);
    assert.deepEqual(page.errors, []);
  } finally { await ctx.close(); await srv.close(); }
});

test('Settings is one page per subject, each with its own address', async () => {
  const { page, close } = await openApp(browser, { seed: GRADING });
  const shown = () => page.$$eval('#setPane [data-sec]', els => els.filter(e => e.checkVisibility()).map(e => e.id));
  await goTo(page, '#/settings');
  assert.deepEqual(await page.$$eval('#setNav .setlink b', b => b.map(x => x.textContent)), ['Saving and carrying', 'Go back in time', 'Classes and rosters', 'Terms and weights', 'Grading scale and rubrics', 'Marking', 'Timetable and calendar', 'Display', 'Working with AI', 'Keys', 'About and updates']);
  assert.deepEqual(await shown(), ['setSaving', 'setTake', 'setRemove']);
  assert.equal(await page.$eval('#setNav .setlink.on', a => a.textContent), 'Saving and carryingFolder, take-home file, safety copies');
  assert.equal(await page.title(), 'Settings · Grading Studio');
  // classes: counts, never names
  await page.click('#setNav [data-set="classes"]');
  assert.equal(await page.evaluate(() => location.hash), '#/settings/classes');
  assert.deepEqual(await shown(), ['setClasses', 'setSys', 'setAtt']);
  assert.equal(await page.title(), 'Classes and rosters · Settings · Grading Studio');
  assert.deepEqual(await page.$$eval('#setClasses .setrow .nt', r => r.map(x => x.textContent)), ['Course A-14 students · No ManageBac link', 'CourseA21 student · No ManageBac link']);
  assert.ok(!(await page.$eval('#vSettings', e => e.textContent)).includes('Testwell'), 'no student names in Settings');
  await page.click('#setClasses [data-setcls="1"]'); await page.waitForSelector('#cName');
  assert.equal(await page.$eval('#cName', e => e.value), 'CourseA2');
  await page.$eval('#cName', e => { e.value = 'Course A-2'; });
  await page.click('#dlgBox [data-ok]');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden && /Course A-2/.test(document.querySelector('#setClasses').textContent));
  assert.equal(await page.$eval('#setClasses .setrow a.btn', a => a.getAttribute('href')), '#/class/c1');
  await page.click('#setClasses [data-setadd]'); await page.waitForSelector('#cName'); await closeBox(page, '#dlgBox [data-cancel]');
  // terms and weights: what is set, and the same Term setup as the gradebook's
  await goTo(page, '#/settings/terms');
  assert.deepEqual(await shown(), ['setTerms']);
  assert.match(await page.$eval('#setTerms', e => e.textContent), /Term 1Aug 31 to Nov 20.*Summative assessments 50% · In-class assessments 50% · Formative activities 0%/);
  await page.click('#setTerms [data-setterms]'); await page.waitForSelector('#bkSetup');
  assert.match(await page.$eval('#bkSetup', e => e.textContent), /Term setup.*for all your classes/);
  await closeBox(page);
  // the rest
  await goTo(page, '#/settings/grading'); assert.deepEqual(await shown(), ['setWay', 'setGrading']);
  await page.waitForFunction(() => /0 saved rubrics and 0 saved grading scales/.test(document.querySelector('#setGrading').textContent));
  assert.equal(await page.$eval('#setGrading a.btn', a => a.getAttribute('href')), 'planner.html#rubrics');
  await goTo(page, '#/settings/marking'); assert.deepEqual(await shown(), ['setMarking', 'setPapers', 'setTouch']);
  await goTo(page, '#/settings/timetable'); assert.deepEqual(await shown(), ['setTimetable']);
  await page.waitForFunction(() => /No timetable in this browser yet/.test(document.querySelector('#setTimetable').textContent));
  assert.equal(await page.$eval('#setTimetable a.btn', a => a.textContent), 'Set up the timetable');
  await goTo(page, '#/settings/display'); assert.deepEqual(await shown(), ['setDisplay', 'setLang']);
  await goTo(page, '#/settings/claude'); assert.deepEqual(await shown(), ['setClaude']);
  await goTo(page, '#/settings/keys'); assert.deepEqual(await shown(), ['setKeys']);
  // a refresh stays on the section; Back walks the sections; an address that names no section is the first one
  await page.reloadHere(); await appReady(page);
  assert.equal(await page.evaluate(() => location.hash), '#/settings/keys'); assert.deepEqual(await shown(), ['setKeys']);
  await page.goBack(); await page.waitForFunction(() => location.hash === '#/settings/claude'); assert.deepEqual(await shown(), ['setClaude']);
  await goTo(page, '#/settings/nothing-here'); assert.deepEqual(await shown(), ['setSaving', 'setTake', 'setRemove']);
  // Find anything goes to a section
  const labels = await page.evaluate(() => window.__gs.findRows().filter(r => r.group === 'Settings').map(r => r.label));
  for (const want of ['Classes and rosters', 'Terms and weights', 'Grading scale and rubrics', 'Marking', 'Timetable and calendar', 'Working with AI']) assert.ok(labels.includes(want), want);
  await page.evaluate(() => window.__gs.findRows().find(r => r.label === 'Terms and weights').run());
  assert.equal(await page.evaluate(() => location.hash), '#/settings/terms');
  await page.evaluate(() => window.__gs.findRows().find(r => r.label === 'Word papers').run());
  assert.equal(await page.evaluate(() => location.hash), '#/settings/marking');
  // narrow: the list goes above the cards
  await page.setViewport({ width: 860, height: 800 });
  assert.ok(await page.evaluate(() => document.querySelector('#setNav').getBoundingClientRect().bottom <= document.querySelector('#setPapers').getBoundingClientRect().top));
  assert.deepEqual(page.errors, []);
  await close();
});

test('a class address by name finds the class however its name is spaced', async () => {
  const { page, close } = await openApp(browser, { seed: GRADING });
  await goTo(page, '#/class-named/' + encodeURIComponent('course a 2'));
  assert.equal(await page.evaluate(() => location.hash), '#/class/c2');
  await page.goBack();   // the name's address isn't left in history
  await page.waitForFunction(() => location.hash === '' || location.hash === '#/');
  await goTo(page, '#/class-named/' + encodeURIComponent('Nobody’s class'));
  await page.waitForFunction(() => location.hash === '#/');
  assert.match(await page.$eval('.toast', e => e.textContent), /no class called “Nobody’s class”/);
  assert.deepEqual(page.errors, []);
  await close();
});
