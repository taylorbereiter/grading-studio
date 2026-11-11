// Attendance: a class page's Attendance tab. A day is taken with one press for each student who isn't simply present, kept on the
// class beside its roster, looked back over in one table, and copied out for a school's own system. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, appReady, goTo, classPage, pick, catchDownloads } = require('./helpers/app');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup', 'Esme Placeholder', 'Finn Example'];
// Two earlier days are already saved: on 2026-09-01 Dov was absent and Esme late (with a note), and on 2026-09-02 everyone was here.
function seed(more) {
  const lib = {
    classes: [{ id: 'c1', name: 'Grade 9 English', names: NAMES, units: [], info: { 'Dov Madeup': { id: '900104' } },
      att: { '2026-09-01': { t: 1000, m: { 'Dov Madeup': 'a', 'Esme Placeholder': 'l' }, n: { 'Esme Placeholder': 'Bus' } }, '2026-09-02': { t: 2000, m: {} } } },
    { id: 'c2', name: 'Grade 10 Literature', names: ['Nia Elsewhere'], units: [] }],
    loose: { id: '', units: [] }, seed2627: true, book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2026-12-18' }, { id: 't2', name: 'Term 2', start: '2027-01-04', end: '2027-06-18' }] }, ...more,
  };
  return { ls: { 'gs.lib': JSON.stringify(lib) } };
}
const hash = page => page.evaluate(() => location.hash);
const att = (page, d) => page.evaluate(d => { const a = window.__gs.state().lib.classes[0].att; return d ? a[d] || null : a; }, d);
const stored = (page, d) => page.evaluate(d => (JSON.parse(localStorage.getItem('gs.lib')).classes[0].att || {})[d] || null, d);
const pressed = page => page.$$eval('#attList .attrow', rs => rs.map(r => r.querySelector('[aria-pressed="true"]').dataset.atts).join(''));
const text = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
const open = async (page, sub, sel) => { await goTo(page, '#/class/c1/attendance' + (sub ? '/' + sub : '')); await page.waitForSelector(sel || '#attList'); };
const copies = page => page.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });

test('a day is taken with one press for each student who isn’t present, and every press is saved', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await classPage(page, 'c1');
  assert.deepEqual(await page.$$eval('.ctabs .ctab', xs => xs.map(x => x.textContent)), ['Assignments', 'Gradebook', 'Students', 'Attendance', 'Seating', 'Missing work', 'Charts', 'Report comments']);
  await page.click('[data-ctab="attendance"]'); await page.waitForSelector('#attList');
  assert.equal(await hash(page), '#/class/c1/attendance');
  const today = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  // today, not taken: everyone shows as present, nothing is saved, and one button says they are all here
  assert.equal(await text(page, '#attSum'), 'Not taken yet');
  assert.equal(await pressed(page), 'pppppp');
  assert.ok(await page.$('[data-attall]'));
  assert.equal(await att(page, today), null, 'looking saves nothing');
  // one press each for the two who aren't
  await page.click('[data-attrow="3"] [data-atts="a"]');
  await page.click('[data-attrow="4"] [data-atts="l"]');
  assert.equal(await pressed(page), 'pppalp');
  assert.equal(await text(page, '#attSum'), '4 present · 1 late · 1 absent');
  assert.equal(await page.$('[data-attall]'), null);
  assert.deepEqual((await stored(page, today)).m, { 'Dov Madeup': 'a', 'Esme Placeholder': 'l' }, 'saved as it is pressed, and only who wasn’t simply present');
  // a note, for someone who isn't present
  assert.equal(await page.$('[data-attrow="0"] .attnote'), null);
  await page.type('[data-attrow="4"] .attnote', 'Arrived 8:50'); await page.keyboard.press('Tab');
  assert.deepEqual((await stored(page, today)).n, { 'Esme Placeholder': 'Arrived 8:50' });
  // changing a mind: back to present takes the student off the day's list, and the note stays with them until it is cleared
  await page.click('[data-attrow="3"] [data-atts="p"]');
  assert.deepEqual((await stored(page, today)).m, { 'Esme Placeholder': 'l' });
  // keys: with a row in focus, a letter sets it and moves on; the arrows move
  await page.focus('[data-attrow="0"] [data-atts="p"]');
  await page.keyboard.press('e'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('a');
  assert.equal(await pressed(page), 'epaplp');
  assert.deepEqual((await stored(page, today)).m, { 'Aria Testwell': 'e', 'Cleo Fixture': 'a', 'Esme Placeholder': 'l' });
  // a refresh comes back to the same day as it was left
  await page.reloadHere(); await appReady(page); await page.waitForSelector('#attList');
  assert.equal(await pressed(page), 'epaplp');
  assert.equal(await page.$eval('[data-attrow="4"] .attnote', e => e.value), 'Arrived 8:50');
  assert.deepEqual(page.errors, []);
  await close();
});

test('another day has its own address; “Everyone is here” takes it, and Clear this day undoes it', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await open(page, '2026-09-03');
  assert.match(await text(page, '#attDate'), /September 3/);
  assert.equal(await text(page, '#attSum'), 'Not taken yet');
  await page.click('[data-attall]'); await page.waitForSelector('[data-attcopy]');
  assert.equal(await text(page, '#attSum'), '6 present');
  assert.deepEqual((await stored(page, '2026-09-03')).m, {});
  // the arrows go to the day before and after; with no timetable for the class that is the calendar's
  await page.click('.attnav [aria-label="Earlier day"]'); await page.waitForFunction(() => location.hash === '#/class/c1/attendance/2026-09-02');
  assert.equal(await text(page, '#attSum'), '6 present');
  await page.click('.attnav [aria-label="Earlier day"]'); await page.waitForFunction(() => location.hash === '#/class/c1/attendance/2026-09-01');
  assert.equal(await pressed(page), 'pppalp');
  assert.equal(await page.$eval('[data-attrow="4"] .attnote', e => e.value), 'Bus');
  // copying a day: a line for each student, their ID first when the roster has IDs
  await copies(page);
  await page.click('[data-attcopy]'); await page.waitForFunction(() => window.__copied);
  const lines = (await page.evaluate(() => window.__copied)).split('\n').map(l => l.split('\t'));
  assert.deepEqual(lines[0].slice(0, 2), ['ID', 'Student']); assert.equal(lines[0][3], 'Note');
  assert.deepEqual(lines[4], ['900104', 'Dov Madeup', 'Absent', '']);
  assert.deepEqual(lines[5], ['', 'Esme Placeholder', 'Late', 'Bus']);
  assert.deepEqual(lines[1], ['', 'Aria Testwell', 'Present', '']);
  // clearing: the day reads as never taken, here and after the next save
  await pick(page, '[data-attclear]'); await page.waitForSelector('[data-attall]');
  assert.equal(await text(page, '#attSum'), 'Not taken yet');
  assert.equal(await pressed(page), 'pppppp');
  assert.equal((await stored(page, '2026-09-01')).off, 1, 'kept as cleared, so an older copy elsewhere doesn’t bring it back');
  // an address that isn't a day is today's
  await open(page, '2026-13-45');
  assert.ok(await page.$('.attnav .schip'), 'today');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Look back is one table of students and days with each student’s totals, by term, and it copies and downloads', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await page.evaluate(() => { const G = window.__gs, c = G.state().lib.classes[0]; G.attSet(c, '2027-02-01', 'Bram Sample', 'e'); });
  await open(page, 'all', '#attTab, #attNone');
  // it opens on the term today falls in; the made-up days are in Term 1, and one is in Term 2
  await page.click('[data-attterm="t1"]'); await page.waitForSelector('#attTab');
  assert.deepEqual(await page.$$eval('#attTab thead .attd a', a => a.map(x => x.getAttribute('href'))), ['#/class/c1/attendance/2026-09-01', '#/class/c1/attendance/2026-09-02']);
  const rows = await page.$$eval('#attTab tbody tr', rs => rs.map(r => [...r.children].map(c => c.textContent.trim())));
  assert.deepEqual(rows[3], ['Dov Madeup', '1', '0', '0', 'A', '']);
  assert.deepEqual(rows[4], ['Esme Placeholder', '0', '1', '0', 'L', '']);
  assert.deepEqual(rows[0], ['Aria Testwell', '0', '0', '0', '', '']);
  assert.deepEqual(rows[6], ['Here', '', '', '', '5', '6'], 'late is here; absent is not');
  assert.match(await page.$eval('#attTab tbody tr:nth-child(5) .attc.sl', e => e.title), /Esme Placeholder · Late · Bus/);
  await page.click('[data-attterm="t2"]'); await page.waitForFunction(() => document.querySelectorAll('#attTab thead .attd').length === 1);
  await page.click('[data-attterm="*"]'); await page.waitForFunction(() => document.querySelectorAll('#attTab thead .attd').length === 3);
  // copy and download: full words, one column a day
  await copies(page);
  await page.click('[data-attcopyall]'); await page.waitForFunction(() => window.__copied);
  const t = (await page.evaluate(() => window.__copied)).split('\n').map(l => l.split('\t'));
  assert.deepEqual(t[0], ['ID', 'Student', 'Absent', 'Late', 'Excused', '2026-09-01', '2026-09-02', '2027-02-01']);
  assert.deepEqual(t[2], ['', 'Bram Sample', '0', '0', '1', 'Present', 'Present', 'Excused']);
  assert.deepEqual(t[4], ['900104', 'Dov Madeup', '1', '0', '0', 'Absent', 'Present', 'Present']);
  const dl = await catchDownloads(page);
  const f = await dl.next(() => page.click('[data-attcsv]'));
  assert.equal(f.name, 'Grade 9 English attendance 2026-09-01 to 2027-02-01.csv');
  const csv = Buffer.from(f.bytes).toString('utf8').replace(/^﻿/, '').split('\r\n');
  assert.equal(csv.length, 7); assert.equal(csv[5], ',Esme Placeholder,0,1,0,Late,Present,Present');
  await dl.close();
  // a date opens that day
  await page.click('#attTab thead .attd a'); await page.waitForSelector('#attList');
  assert.equal(await hash(page), '#/class/c1/attendance/2026-09-01');
  // a student's own page lists what they missed
  await goTo(page, '#/class/c1/students/4'); await page.waitForSelector('#bkStuName');
  await page.click('[data-bkterm="t1"]'); await page.waitForSelector('#attStu');
  assert.match(await text(page, '#attStu'), /Here 1 of 2 days: 1 absent\.\s*Absent Sep 1$/);
  await goTo(page, '#/class/c1/students/1'); await page.waitForSelector('#bkStuName');
  assert.match(await text(page, '#attStu'), /Here 2 of 2 days, never late\./);
  assert.deepEqual(page.errors, []);
  await close();
});

test('attendance is the teacher’s to turn off: the tab, its address and Today’s line go, and the saved days stay', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  const was = JSON.stringify(await att(page));
  assert.match(await page.evaluate(() => window.__gs.attTodayLine({ name: 'grade 9 english' })), /Take attendance/);
  assert.equal(await page.evaluate(() => window.__gs.attTodayLine({ name: 'Some other class' })), '');
  await page.evaluate(() => { const G = window.__gs, d = new Date(), c = G.state().lib.classes[0]; G.attSet(c, d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), 'Finn Example', 'a'); });
  assert.match(await page.evaluate(() => window.__gs.attTodayLine({ name: 'Grade 9 English' })), /Attendance taken · 1 absent/);
  await page.evaluate(() => { const G = window.__gs, d = new Date(), c = G.state().lib.classes[0]; G.attClear(c, d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); delete c.att[Object.keys(c.att).sort().pop()]; });
  await goTo(page, '#/settings/classes'); await page.waitForSelector('#attOnBox');
  assert.equal(await page.$eval('#attOnBox', b => b.checked), true, 'on until she says otherwise');
  await page.click('#attOnBox');
  await page.waitForFunction(() => /2 days you saved are kept/.test(document.querySelector('#setAtt').textContent));
  assert.equal(await page.evaluate(() => window.__gs.attTodayLine({ name: 'Grade 9 English' })), '');
  await goTo(page, '#/class/c1/attendance'); await page.waitForSelector('.ctabs');
  assert.deepEqual(await page.$$eval('.ctabs .ctab', xs => xs.map(x => x.textContent)), ['Assignments', 'Gradebook', 'Students', 'Seating', 'Missing work', 'Charts', 'Report comments']);
  assert.equal(await page.$('#attBody'), null, 'its address shows the class’s first tab');
  await goTo(page, '#/class/c1/students/4'); await page.waitForSelector('#bkStuName');
  assert.equal(await page.$('#attStu'), null);
  assert.equal(JSON.stringify(await att(page)), was, 'nothing saved is lost');
  await page.click('#findBtn'); await page.waitForSelector('#findDlg .frow'); await page.type('#findIn', 'attendance');
  assert.equal((await page.$$eval('#findDlg .frow', r => r.map(x => x.textContent))).some(t => /Grade 9 English attendance/.test(t)), false);
  await page.keyboard.press('Escape');
  await goTo(page, '#/settings/classes'); await page.waitForSelector('#attOnBox');
  await page.click('#attOnBox');
  await goTo(page, '#/class/c1/attendance/all'); await page.waitForSelector('#attBody');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a student renamed on the roster keeps their days when their ID says who they are', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await classPage(page, 'c1');
  await page.click('[data-edit-class="0"]'); await page.waitForSelector('#cNames');
  await page.$eval('#cNames', (t, v) => { t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); }, NAMES.map(n => n === 'Dov Madeup' ? 'Dov Renamed\t900104' : n).join('\n'));
  await page.click('#dlg .btn.primary'); await page.waitForFunction(() => window.__gs.state().lib.classes[0].names.includes('Dov Renamed'));
  assert.deepEqual((await att(page, '2026-09-01')).m, { 'Dov Renamed': 'a', 'Esme Placeholder': 'l' });
  assert.deepEqual(page.errors, []);
  await close();
});
