// Missing work: a class page's tab that lists every paper marked Missing, by student or by assignment, and drafts a reminder
// email for each student that opens in the teacher's own mail app. The app itself sends nothing. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { builtHtml, openApp, goTo } = require('./helpers/app');
const { gradingSeed } = require('./helpers/steady');
const settle = () => new Promise(r => setTimeout(r, 500));

let browser;
before(async () => { builtHtml(); browser = await launch(); });
after(async () => { await browser.close(); });

// The made-up class: Dov owes the Timed paragraph (in the seed) and the Vocabulary quiz; Bram owes Reading check 1.
// Dov and Bram have emails on the roster, Esme owes the Timed paragraph too and has none.
function seed() {
  const s = gradingSeed(), lib = JSON.parse(s.ls['gs.lib']), c = lib.classes[0], items = c.units.flatMap(u => u.items);
  items.find(i => i.id === 'i4').typed.s['Dov Madeup'] = { v: null, st: 'missing' };
  items.find(i => i.id === 'i1').typed.s['Bram Sample'] = { v: null, st: 'missing' };
  items.find(i => i.id === 'i6').typed.s['Esme Placeholder'] = { v: null, st: 'missing' };
  c.info = { 'Dov Madeup': { email: 'dov@example.edu' }, 'Bram Sample': { email: 'bram@example.edu' } };
  s.ls['gs.lib'] = JSON.stringify(lib);
  return s;
}
const open = async () => {
  const r = await openApp(browser, { seed: seed() });
  await r.page.evaluate(() => { window.__mail = []; window.__gsMailTest = h => window.__mail.push(h); navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  await goTo(r.page, '#/class/c1/missing');
  await r.page.waitForSelector('#mis');
  return r;
};
const mail = async page => { const h = await page.evaluate(() => window.__mail[window.__mail.length - 1]); const u = new URL(h); return { to: decodeURIComponent(u.pathname), bcc: u.searchParams.get('bcc') || '', subject: u.searchParams.get('subject'), body: u.searchParams.get('body') || '' }; };
const info = (page, n) => page.evaluate(n => JSON.parse(JSON.stringify((window.__gs.state().lib.classes.find(c => c.id === 'c1').info || {})[n] || null)), n);

test('the Missing work tab lists who owes what, by student and by assignment', async () => {
  const { page, close } = await open();
  assert.deepEqual(await page.$$eval('#vClass .ctabs a', a => a.map(x => x.textContent.trim())), ['Assignments', 'Gradebook', 'Students', 'Attendance', 'Seating', 'Missing work', 'Charts', 'Report comments']);
  assert.match(await page.$eval('.misnote', e => e.textContent), /opens in your own mail app.*Grading Studio sends nothing itself/);
  assert.equal(await page.$eval('#misSum', e => e.textContent), '3 students owe 4 pieces of work');
  const cards = await page.$$eval('[data-misstu]', xs => xs.map(x => [x.querySelector('h3').textContent, [...x.querySelectorAll('.misw')].map(w => w.textContent)]));
  assert.deepEqual(cards, [['Bram Sample', ['Reading check 1']], ['Dov Madeup', ['Vocabulary quiz', 'Timed paragraph']], ['Esme Placeholder', ['Timed paragraph']]], 'roster order, oldest work first');
  assert.match(await page.$eval('[data-misstu="3"]', e => e.textContent), /dov@example\.edu/);
  assert.match(await page.$eval('[data-misstu="4"]', e => e.textContent), /No email yet/);
  assert.match(await page.$eval('[data-misstu="3"] li', e => e.textContent), /Due Sep 30 · \d+ days ago/);
  await page.click('[data-misview="col"]');
  await page.waitForSelector('[data-miscol]');
  const cols = await page.$$eval('[data-miscol]', xs => xs.map(x => [x.querySelector('h3').textContent, [...x.querySelectorAll('.misw')].map(w => w.textContent)]));
  assert.deepEqual(cols, [['Reading check 1', ['Bram Sample']], ['Vocabulary quiz', ['Dov Madeup']], ['Timed paragraph', ['Dov Madeup', 'Esme Placeholder']]]);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Email reminder opens a drafted email in the mail app and notes the reminder; Undo takes the note back', async () => {
  const { page, close } = await open();
  await settle();
  const was = await page.evaluate(() => localStorage.getItem('gs.lib'));
  await page.click('[data-misview="col"]'); await page.click('[data-misview="stu"]');
  await settle();
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.lib')), was, 'looking stores nothing');
  await page.click('[data-misstu="3"] [data-mismail]');
  const m = await mail(page);
  assert.equal(m.to, 'dov@example.edu');
  assert.equal(m.subject, 'Missing work for Grade 9 English');
  assert.match(m.body, /^Hi Dov,\r\n/);
  assert.match(m.body, /- Vocabulary quiz \(due Sep 30\)\r\n- Timed paragraph \(due Oct 29\)/);
  assert.ok(!/\{|\}|undefined/.test(m.body));
  assert.match(await page.$eval('.toast', e => e.textContent), /mail app should open.*Marked as reminded today/);
  await page.waitForFunction(() => document.querySelectorAll('[data-misstu="3"] .schip.ok').length === 2);
  const nudge = (await info(page, 'Dov Madeup')).nudge;
  assert.deepEqual(Object.keys(nudge).sort(), ['i4', 'i6']);
  assert.equal((await info(page, 'Dov Madeup')).email, 'dov@example.edu', 'the email stays');
  await page.click('.toast .tact');
  await page.waitForFunction(() => !document.querySelector('[data-misstu="3"] .schip.ok'));
  assert.equal((await info(page, 'Dov Madeup')).nudge, undefined);
  // a student with no email: the email still opens, for her to address
  await page.click('[data-misstu="4"] [data-mismail]');
  assert.equal((await mail(page)).to, '');
  assert.match(await page.$eval('.toast', e => e.textContent), /no email for Esme yet/);
  // Copy puts the whole email on the clipboard as text
  await page.click('[data-misstu="1"] [data-miscopy]');
  assert.match(await page.evaluate(() => window.__copied), /^To: bram@example\.edu\nSubject: Missing work for Grade 9 English\n\nHi Bram,/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Email all writes one email with every address in Bcc; wording and the class name are hers to change', async () => {
  const { page, close } = await open();
  await page.click('[data-misview="col"]');
  await page.click('[data-misall="i6"]');
  const m = await mail(page);
  assert.equal(m.to, ''); assert.equal(m.bcc, 'dov@example.edu');
  assert.match(m.body, /^Hi everyone,/); assert.match(m.body, /- Timed paragraph/);
  assert.match(await page.$eval('.toast', e => e.textContent), /1 student with no email is left out/);
  // the class as it's called in an email
  await page.$eval('#misCls', e => { e.value = 'English 9'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  // her own wording
  await page.click('[data-miswords]');
  await page.waitForSelector('#misBody');
  await page.$eval('#misSubj', e => { e.value = '{class}: {n} to hand in'; });
  await page.$eval('#misBody', e => { e.value = 'Dear {name},\n{list}\nMs T'; });
  await page.click('[data-missavew]');
  await page.waitForSelector('#mis');
  await page.click('[data-misview="stu"]');
  await page.click('[data-misstu="3"] [data-mismail]');
  const m2 = await mail(page);
  assert.equal(m2.subject, 'English 9: 2 to hand in');
  assert.equal(m2.body, 'Dear Dov,\r\n- Vocabulary quiz (due Sep 30)\r\n- Timed paragraph (due Oct 29)\r\nMs T');
  const book = await page.evaluate(() => window.__gs.state().lib.book.miss);
  assert.deepEqual(book, { cls: { c1: 'English 9' }, subj: '{class}: {n} to hand in', body: 'Dear {name},\n{list}\nMs T' });
  // Copy list: one row per piece of work
  await page.click('[data-miscopyall]');
  const rows = (await page.evaluate(() => window.__copied)).split('\n');
  assert.equal(rows[0], 'Student\tEmail\tMissing work\tDue\tReminded');
  assert.equal(rows.length, 5);
  assert.match(rows[2], /^Dov Madeup\tdov@example\.edu\tVocabulary quiz\t2026-09-30\t\d{4}-\d\d-\d\d$/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a class where nobody owes anything says how work gets here', async () => {
  const r = await openApp(browser, { seed: gradingSeed() });
  await goTo(r.page, '#/class/c2/missing');
  await r.page.waitForSelector('#mis');
  assert.match(await r.page.$eval('.misnone', e => e.textContent), /Nobody owes any work.*mark a paper Missing/);
  assert.deepEqual(r.page.errors, []);
  await r.close();
});
