// Links on a lesson, and a class's lasting links. A lesson keeps its own links; School resources (the grading page) can mark
// a link, file or note "For" a class, and those links show on every lesson for that class and while it is presented.
// The classes, lessons and addresses here are made up.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { serve } = require('./helpers/serve');
const { launch } = require('./helpers/chrome');
const { openApp, goTo } = require('./helpers/app');
const { gradingSeed } = require('./helpers/steady');
const ROOT = path.join(__dirname, '..');
const PAGE = () => fs.readFileSync(path.join(ROOT, 'planner.html'), 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (page, fn, arg) => { for (let i = 0; i < 160; i++) { if (await page.evaluate(fn, arg)) return; await wait(50); } throw new Error('Waited too long for ' + fn + ' ' + (arg || '')); };

// What the grading page keeps in gs.school: two links for Course A, one for the whole school, one for Course B, a note for Course A.
const SCHOOL = { items: [
  { id: 's1', at: 5, kind: 'link', name: 'Course A class site', url: 'https://classes.example.org/course-a', group: 'Portals', cls: ['Course A'], pin: 1 },
  { id: 's2', at: 5, kind: 'link', name: 'Anthology online', url: 'https://books.example.org/anthology', cls: ['course a', 'Course B'] },
  { id: 's3', at: 5, kind: 'link', name: 'Staff handbook', url: 'https://staff.example.org/handbook', group: 'Handbook and policies' },
  { id: 's4', at: 5, kind: 'link', name: 'Course B folder', url: 'https://files.example.org/course-b', cls: ['Course B'] },
  { id: 's5', at: 5, kind: 'note', name: 'Course A room notes', note: 'Projector remote is in the top drawer.', cls: ['Course A'] },
  { id: 's6', at: 6, gone: 1 },
], order: [], ot: 0 };

async function open(school) {
  const server = await serve(PAGE);
  const browser = await launch(), page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.url + 'blank');
  if (school) await page.evaluate(s => localStorage.setItem('gs.school', JSON.stringify(s)), school);
  await page.goto(server.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
  return { server, browser, page, errors, done: async () => { await browser.close(); await server.close(); } };
}
// Two sections of Course A that meet today, and one lesson on the first. Returns the lesson's id.
const seed = (page, more) => page.evaluate(async more => {
  const P = window.__planner, d = new Date(), pad = n => String(n).padStart(2, '0'), today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const every = (start, end) => [0, 1, 2, 3, 4, 5, 6].map(dow => ({ dow, start, end }));
  await P.applySetup({ kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-08-31', semEnd: '2027-01-18', daysOff: [], events: [],
    classes: [{ id: 'A1', name: 'Course A-1', course: 'Course A', color: '#1F6FB2', meets: every('00:00', '23:59') }, { id: 'C1', name: 'Club', course: '', color: '#7B3FC4', meets: every('00:00', '00:01') }] });
  const l = P.normLesson({ title: 'Reading a poem', fmt: 2, look: 'white', slots: [{ classId: 'A1', date: today }], ...more, slides: [{ layout: 'title', title: 'Reading a poem' }, { layout: 'content', title: 'Read aloud', body: '• Listen for the turn', size: 36 }] });
  P.L.lessons.push(l); P.openLessonForTest(l, 0);
  await new Promise(r => setTimeout(r, 0));
  return l.id;
}, more || {});
const own = page => page.$$eval('#lsLinks .pl-link:has([data-lk="edit"])', r => r.map(x => x.querySelector('b').textContent + ' | ' + x.querySelector('a').getAttribute('href')));
const saved = (page, id) => page.evaluate(async id => { await new Promise(r => setTimeout(r, 600)); const P = window.__planner; return (P.L.lessons.find(l => l.id === id).links || []).map(x => x.name + ' | ' + x.url); }, id);

test('a lesson keeps its own links: typed, changed, removed and put back', async () => {
  const a = await open();
  try {
    const { page } = a, id = await seed(page);
    assert.match(await page.$eval('#lsLinks', e => e.textContent), /Links[\s\S]*Nothing yet\.[\s\S]*add it in School resources and choose the class/);
    // an address typed without https, and no name: it is named by its site
    await page.click('#lsLinks [data-lk="add"]'); await page.waitForSelector('#lkU');
    assert.equal(await page.$('#lkPicks'), null, 'with no school links there is nothing to pick from');
    await page.type('#lkU', 'news.example.org/poem-of-the-day'); await page.click('#dlgBox [data-ok]');
    await until(page, () => document.querySelectorAll('#lsLinks .pl-link').length === 1);
    assert.deepEqual(await own(page), ['news.example.org | https://news.example.org/poem-of-the-day']);
    // not an address: nothing is added, and the box stays open
    await page.click('#lsLinks [data-lk="add"]'); await page.waitForSelector('#lkU');
    await page.type('#lkU', 'not an address'); await page.click('#dlgBox [data-ok]');
    assert.ok(await page.$('#lkU'), 'the box is still open');
    // the same address again is refused
    await page.$eval('#lkU', e => { e.value = 'https://news.example.org/poem-of-the-day'; }); await page.click('#dlgBox [data-ok]');
    assert.ok(await page.$('#lkU'));
    await page.$eval('#lkU', e => { e.value = 'https://video.example.org/watch?v=1'; }); await page.$eval('#lkN', e => { e.value = 'The poet reads it'; });
    await page.click('#dlgBox [data-ok]');
    await until(page, () => document.querySelectorAll('#lsLinks .pl-link').length === 2);
    // every link opens in a new tab and tells the other site nothing
    assert.deepEqual(await page.$$eval('#lsLinks .pl-link a', l => l.map(x => x.target + ' ' + x.rel)), ['_blank noopener noreferrer', '_blank noopener noreferrer']);
    // edit the first one's name
    await page.click('#lsLinks .pl-link [data-lk="edit"]'); await page.waitForSelector('#lkN');
    await page.$eval('#lkN', e => { e.value = 'Poem of the day'; }); await page.click('#dlgBox [data-ok]');
    await until(page, () => /Poem of the day/.test(document.querySelector('#lsLinks').textContent));
    assert.deepEqual(await saved(page, id), ['Poem of the day | https://news.example.org/poem-of-the-day', 'The poet reads it | https://video.example.org/watch?v=1']);
    // remove it, and Undo puts it back where it was
    await page.click('#lsLinks .pl-link [data-lk="rm"]');
    await until(page, () => document.querySelectorAll('#lsLinks .pl-link').length === 1);
    await page.$eval('.toast button', b => b.click());
    await until(page, () => document.querySelectorAll('#lsLinks .pl-link').length === 2);
    assert.deepEqual(await saved(page, id), ['Poem of the day | https://news.example.org/poem-of-the-day', 'The poet reads it | https://video.example.org/watch?v=1']);
    // it survives being read back the way a file or a folder hands a lesson over, and anything that is not a web address is dropped
    const back = await page.evaluate(id => { const P = window.__planner, l = P.L.lessons.find(x => x.id === id); return P.normLesson({ ...JSON.parse(JSON.stringify(l)), links: [...l.links, { name: 'Script', url: 'javascript:alert(1)' }, { name: 'File', url: 'file:///etc/passwd' }, { url: 'https://news.example.org/poem-of-the-day' }, null] }).links.map(x => x.url); }, id);
    assert.deepEqual(back, ['https://news.example.org/poem-of-the-day', 'https://video.example.org/watch?v=1']);
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});

test('links kept in School resources can be picked for a lesson, and a class’s links show on its lessons by themselves', async () => {
  const a = await open(SCHOOL);
  try {
    const { page } = a, id = await seed(page);
    // the class's lasting links are there before anything is added: Course A's, kept-at-the-top first, not Course B's or the school's
    assert.deepEqual(await page.$$eval('#lsLinks .pl-lkh b', h => h.map(x => x.textContent)), ['For Course A, all year']);
    assert.deepEqual(await page.$$eval('#lsLinks .pl-link b', b => b.map(x => x.textContent)), ['Course A class site', 'Anthology online']);
    assert.equal(await page.$('#lsLinks [data-lk="edit"]'), null, 'they are changed in School resources, not here');
    assert.match(await page.$eval('#lsLinks', e => e.textContent), /Also for Course A in School resources: Course A room notes\./);
    assert.match(await page.$eval('#lsLinks .pl-lkh a', e => e.getAttribute('href')), /#\/school$/);
    // pick two from School resources
    await page.click('#lsLinks [data-lk="add"]'); await page.waitForSelector('#lkPicks');
    assert.deepEqual(await page.$$eval('#lkPicks .pl-lkpick b', b => b.map(x => x.textContent)), ['Course A class site', 'Anthology online', 'Course B folder', 'Staff handbook']);
    await page.click('#lkPicks [data-pick="s3"]');
    await until(page, () => document.querySelector('#lkPicks [data-pick="s3"]').disabled);
    assert.equal(await page.$eval('#lkPicks [data-pick="s3"] .pl-lkadd', e => e.textContent), 'Added ✓');
    await page.click('#lkPicks [data-pick="s4"]');
    await until(page, () => document.querySelector('#lkPicks [data-pick="s4"]').disabled);
    assert.equal(await page.$eval('#dlgBox [data-x]', e => e.textContent), 'Done');
    await page.click('#dlgBox [data-ok]');   // nothing typed: the box closes
    await until(page, () => document.querySelector('#dlg').hidden);
    assert.deepEqual(await saved(page, id), ['Staff handbook | https://staff.example.org/handbook', 'Course B folder | https://files.example.org/course-b']);
    // gs.school was read, never written
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.school'))), SCHOOL);
    // a class with no course is matched by its own name, and a lesson on no class shows no class links
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('gs.school')); s.items.push({ id: 's7', at: 7, kind: 'link', name: 'Club sign-up', url: 'https://clubs.example.org/sign-up', cls: ['CLUB'] }); localStorage.setItem('gs.school', JSON.stringify(s)); });
    const club = await page.evaluate(() => { const P = window.__planner, l = P.L.open, d = l.slots[0].date; l.slots = [{ classId: 'C1', date: d }]; P.openLessonForTest(l, 0); return [...document.querySelectorAll('#lsLinks .pl-lkh b')].map(x => x.textContent); });
    assert.deepEqual(club, ['For Club, all year']);
    const none = await page.evaluate(() => { const P = window.__planner, l = P.L.open; l.slots = []; P.openLessonForTest(l, 0); return document.querySelectorAll('#lsLinks .pl-lkh').length; });
    assert.equal(none, 0);
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});

test('while presenting, Links lists the lesson’s links and the class’s, and opening one does not finish the lesson', async () => {
  const a = await open(SCHOOL);
  try {
    const { page } = a;
    await seed(page, { links: [{ name: 'Poem of the day', url: 'https://news.example.org/poem-of-the-day' }] });
    await page.evaluate(() => { window.__opened = []; window.open = (u, t, f) => { window.__opened.push([u, t, f]); return null; }; });
    await page.$eval('[data-pr="present"]', b => b.click());
    await until(page, () => { const h = document.querySelector('#present #prHint'); return !!(h && h.textContent); });
    assert.ok(await page.$('#prBar [data-p="links"]'));
    await page.keyboard.press('l');
    await until(page, () => !document.querySelector('#prLinks').hidden);
    assert.deepEqual(await page.$$eval('#prLinks h3', h => h.map(x => x.textContent)), ['This lesson', 'Course A']);
    assert.deepEqual(await page.$$eval('#prLinks button b', b => b.map(x => x.textContent)), ['Poem of the day', 'Course A class site', 'Anthology online']);
    // a number opens that link in a new tab; the list closes and the lesson is still being presented, on the same slide
    await page.keyboard.press('2');
    assert.deepEqual(await page.evaluate(() => window.__opened), [['https://classes.example.org/course-a', '_blank', 'noopener,noreferrer']]);
    assert.equal(await page.$eval('#prLinks', e => e.hidden), true);
    await wait(300);
    assert.deepEqual(await page.evaluate(() => { const p = window.__present.PR; return [p.on, p.i]; }), [true, 0]);
    // by the mouse too; a click on the list is not "next slide"
    await page.$eval('#prBar [data-p="links"]', b => b.click());
    await until(page, () => !document.querySelector('#prLinks').hidden);
    await page.$eval('#prLinks h3', h => h.click());
    await page.$eval('#prLinks button:last-of-type', b => b.click());
    assert.equal((await page.evaluate(() => window.__opened)).length, 2);
    assert.deepEqual(await page.evaluate(() => { const p = window.__present.PR; return [p.on, p.i]; }), [true, 0]);
    // Esc closes the list first, then finishes
    await page.keyboard.press('l'); await until(page, () => !document.querySelector('#prLinks').hidden);
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => [window.__present.PR.on, document.querySelector('#prLinks').hidden]), [true, true]);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => window.__present.PR.i), 1);
    await page.evaluate(() => window.__present.end());
    // a lesson with no links, for a class with none, has no Links button, and L does nothing
    await page.evaluate(() => { localStorage.removeItem('gs.school'); const l = window.__planner.L.open; delete l.links; window.__planner.openLessonForTest(l, 0); });
    await page.$eval('[data-pr="present"]', b => b.click());
    await until(page, () => { const h = document.querySelector('#present #prHint'); return !!(h && h.textContent); });
    assert.equal(await page.$('#prBar [data-p="links"]'), null);
    await page.keyboard.press('l');
    assert.equal(await page.$eval('#prLinks', e => e.hidden), true);
    await page.evaluate(() => window.__present.end());
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});

test('School resources: a resource can be for a class, and the page can show one class at a time', async () => {
  const browser = await launch();
  try {
    const { page, close } = await openApp(browser, { seed: { ...gradingSeed(), ls: { ...gradingSeed().ls, 'gs.school': JSON.stringify({ items: [{ id: 'k1', at: 1, kind: 'link', name: 'Staff handbook', url: 'https://staff.example.org/handbook' }], order: [], ot: 0 }) } } });
    await goTo(page, '#/school');
    await until(page, () => document.querySelectorAll('#schList .schrow').length === 1);
    assert.equal(await page.$('#schList .schfor'), null, 'no class row until something is for a class');
    // with no timetable in the Planner, the classes offered are the ones here
    await page.click('#vSchool [data-schadd="link"]'); await page.waitForSelector('#schUrl');
    await until(page, () => document.querySelectorAll('#dlgBox [data-schcls]').length === 2);
    assert.deepEqual(await page.$$eval('#dlgBox [data-schcls]', c => c.map(x => x.value)), ['Grade 9 English', 'Grade 10 Literature']);
    await page.$eval('#schUrl', e => { e.value = 'https://classes.example.org/grade-9'; }); await page.$eval('#schName', e => { e.value = 'Grade 9 class site'; });
    await page.click('#dlgBox [data-schcls][value="Grade 9 English"]'); await page.click('#dlgBox [data-ok]');
    await until(page, () => document.querySelectorAll('#schList .schrow').length === 2);
    assert.deepEqual(await page.evaluate(() => window.__gs.schNow().items.map(i => [i.name, i.cls || null])), [['Staff handbook', null], ['Grade 9 class site', ['Grade 9 English']]]);
    assert.match(await page.$eval('#schList', e => e.textContent), /classes\.example\.org · For Grade 9 English/);
    // the row of classes: Everything, and each class that has something
    assert.deepEqual(await page.$$eval('#schList .schforb', b => b.map(x => x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '*' : ''))), ['Everything*', 'Grade 9 English']);
    await page.click('#schList .schforb:nth-child(2)');
    await until(page, () => document.querySelectorAll('#schList .schrow').length === 1);
    assert.deepEqual(await page.$$eval('#schList .schrow b', b => b.map(x => x.textContent)), ['Grade 9 class site']);
    // something added while one class is showing starts for that class
    await page.click('#vSchool [data-schadd="note"]'); await page.waitForSelector('#schNote');
    assert.deepEqual(await page.$$eval('#dlgBox [data-schcls]:checked', c => c.map(x => x.value)), ['Grade 9 English']);
    await page.$eval('#schNote', e => { e.value = 'Room 12, projector on the left'; }); await page.click('#dlgBox [data-ok]');
    await until(page, () => document.querySelectorAll('#schList .schrow').length === 2);
    // editing it to no class takes it off the class; when nothing is for a class the row of classes goes
    const ids = await page.evaluate(() => window.__gs.schNow().items.filter(i => i.cls).map(i => i.id));
    for (const id of ids) {
      await page.evaluate(() => document.querySelector('#schList [data-schfor=""]').click());
      await page.click('[data-sch="' + id + '"] [data-km]'); await page.click('[data-sch="' + id + '"] [data-schdo="edit"]');
      await page.waitForSelector('#dlgBox [data-schcls]:checked');
      await page.click('#dlgBox [data-schcls]:checked'); await page.click('#dlgBox [data-ok]');
      await until(page, id => !window.__gs.schNow().items.find(i => i.id === id).cls, id);
    }
    await until(page, () => !document.querySelector('#schList .schfor'));
    assert.equal(await page.$$eval('#schList .schrow', r => r.length), 3);
    // with a timetable in the Planner, its courses are offered instead: two sections of one course are one choice
    await page.evaluate(() => new Promise((res, rej) => {
      const r = indexedDB.open('gs-lessons', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('lessons', { keyPath: 'id' }); r.result.createObjectStore('kv'); };
      r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put({ classes: [{ id: 'A1', name: 'Course A-1', course: 'Course A' }, { id: 'A2', name: 'Course A-2', course: 'Course A' }, { id: 'C1', name: 'Club', course: '' }] }, 'setup'); t.oncomplete = () => { r.result.close(); res(); }; t.onerror = () => rej(t.error); };
      r.onerror = () => rej(r.error);
    }));
    await wait(4200);   // the timetable is read again after a few seconds
    await page.click('#vSchool [data-schadd="link"]'); await page.waitForSelector('#schUrl');
    assert.deepEqual(await page.$$eval('#dlgBox [data-schcls]', c => c.map(x => x.value)), ['Course A', 'Club']);
    await page.click('#dlgBox [data-cancel]');
    assert.deepEqual(page.errors, []);
    await close();
  } finally { await browser.close(); }
});
