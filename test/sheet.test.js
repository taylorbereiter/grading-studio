// Progress sheets: one printed page per student for a parent meeting, made from the gradebook. Nothing is sent anywhere.
// Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { builtHtml, openApp, goTo } = require('./helpers/app');
const { gradingSeed } = require('./helpers/steady');

let browser;
before(async () => { builtHtml(); browser = await launch(); });
after(async () => { await browser.close(); });

const open = async () => {
  const r = await openApp(browser, { seed: gradingSeed() });
  await r.page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  return r;
};
const sheetText = (page, i = 0) => page.$$eval('#pssPages .pss', (a, i) => a[i].innerText.replace(/\s+/g, ' '), i);

test('one student’s page prints a one-page sheet with their grade, scores, missing work and comment', async () => {
  const { page, close } = await open();
  await goTo(page, '#/class/c1/students/4');
  await page.waitForSelector('[data-pssone]');
  await page.click('[data-pssone]');
  await page.waitForSelector('#pssPages .pss');
  assert.equal(await page.$eval('#pssTitle', e => e.textContent), 'Progress sheet');
  assert.equal(await page.$$eval('#pssPages .pss', a => a.length), 1);
  const t = await sheetText(page);
  assert.match(t, /Progress report Dov Madeup/i);
  assert.match(t, /Grade 9 English Term 1/);
  assert.match(t, /Term grade \d+(\.\d+)?%/);
  assert.match(t, /Missing 1 piece of work/);
  assert.match(t, /Timed paragraph In-class Oct 29 Missing/, 'the assignment list says it is missing');
  assert.match(t, /Missing work Timed paragraph/i);
  assert.match(t, /By term .*Term 1 .*Year/i);
  assert.match(t, /class \d+/, 'the class average is shown by default');
  assert.match(t, /Comment .*one piece of work to hand in: Timed paragraph\./i, 'the report comment for the term');
  assert.ok(await page.$('#pssPages [data-pssline]'), 'the chart of scores over time');
  assert.match(await page.$eval('#pssNote', e => e.textContent), /still a draft/);
  assert.ok(!/undefined|NaN|null/.test(t), t);
  // the choices change the sheet and are kept with the teacher's work
  await page.click('[data-pssopt="cls"]');
  await page.waitForFunction(() => !/class \d/.test(document.querySelector('#pssPages .pss').innerText));
  await page.click('[data-pssopt="rep"]');
  await page.waitForFunction(() => !document.querySelector('#pssPages .pssrep'));
  await page.click('[data-pssopt="notes"]');
  await page.waitForFunction(() => !document.querySelector('#pssPages .pssnotes'));
  assert.deepEqual(await page.evaluate(() => window.__gs.state().lib.book.sheet), { cls: false, rep: false, notes: false });
  // Print hands only the sheet to the printer
  await page.click('[data-pssprint]');
  assert.equal(await page.evaluate(() => window.__printed), 1);
  assert.equal(await page.$$eval('#pssOut .pss', a => a.length), 1);
  await page.emulateMediaType('print');
  assert.deepEqual(await page.evaluate(() => [...document.body.children].filter(e => getComputedStyle(e).display !== 'none').map(e => e.id)), ['pssOut']);
  await page.emulateMediaType('screen');
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.equal(await page.$('#pssOut'), null, 'gone once the print window closes');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Progress sheets on the Students list prints one page per student, and a typed comment is the one printed', async () => {
  const { page, close } = await open();
  await page.evaluate(() => { const c = window.__gs.state().lib.classes[0]; c.info = { ...(c.info || {}), 'Bram Sample': { rep: { t1: { text: 'Bram has worked hard this term.', done: true } } } }; });
  await goTo(page, '#/class/c1/students');
  await page.waitForSelector('[data-pssall]');
  await page.click('[data-pssall]');
  await page.waitForSelector('#pssPages .pss');
  assert.equal(await page.$$eval('#pssPages .pss', a => a.length), 6);
  assert.deepEqual(await page.$$eval('#pssPages .pss h3', a => a.map(x => x.textContent)), ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup', 'Esme Placeholder', 'Finn Example']);
  assert.match(await sheetText(page, 1), /Comment Bram has worked hard this term\./i);
  assert.match(await page.$eval('[data-pssprint]', e => e.textContent), /Print 6 pages/);
  // printed, it is one page for each student
  await page.click('[data-pssprint]');
  await page.emulateMediaType('print');
  const pdf = Buffer.from(await page.pdf({ format: 'Letter' })).toString('latin1');
  assert.equal((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length, 6);
  await page.emulateMediaType('screen');
  // the whole year
  await page.click('[data-pssterm="*"]');
  await page.waitForFunction(() => /Whole year/.test(document.querySelector('#pssPages .pss').innerText));
  assert.deepEqual(page.errors, []);
  await close();
});

test('a term with many assignments still prints on one page per student', async () => {
  const { page, close } = await open();
  await page.evaluate(() => { const c = window.__gs.state().lib.classes[0]; for (let k = 0; k < 26; k++) c.units[0].items.push({ id: 'x' + k, name: 'Practice task ' + (k + 1), classId: 'c1', type: 'ic', due: '2026-10-' + String(1 + k).padStart(2, '0'), typed: { max: 10, s: Object.fromEntries(c.names.map((n, i) => [n, { v: 5 + (i + k) % 6 }])) } }); });
  await goTo(page, '#/class/c1/students');
  await page.waitForSelector('[data-pssall]');
  await page.click('[data-pssall]');
  await page.waitForSelector('#pssPages .pss');
  assert.ok(await page.$('#pssPages .pssgrid.wide .psshalves'), 'the long list is split in two across the page');
  for (const format of ['Letter', 'A4']) {
    await page.click('[data-pssprint]');   // printing to a PDF closes like a print window does, and takes the sheets away again
    await page.emulateMediaType('print');
    const pdf = Buffer.from(await page.pdf({ format })).toString('latin1');
    assert.equal((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length, 6, format);
  }
  assert.deepEqual(page.errors, []);
  await close();
});
