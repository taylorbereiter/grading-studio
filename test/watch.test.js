// Strengths and concerns per student: a screenshot added to the watch list (or saved as a strong example) is tied to the student it came from,
// shows on their student card as a timeline, on the Examples page under Watch list and Whose work, and goes to the teacher's own assistant as
// one PDF with a random code for each student. Made-up students and classes only.
// SHOTS=<folder> also saves pictures of each screen there.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { launch } = require('./helpers/chrome');
const { openApp, classPage, pickFile, waitPaper, goToStudent, goTo, catchDownloads } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture'];
const seed = () => ({ ls: { 'gs.lib': JSON.stringify({ classes: [{ id: 'c1', name: '9 Maths', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [{ id: 'i1', name: 'Fractions quiz', classId: 'c1', type: 'sum', due: '2026-10-28' }] }] }], loose: { id: '', name: '', names: [], units: [] }, seed2627: true }) } });
const shot = async (page, name, sel) => {
  if (!process.env.SHOTS) return;
  fs.mkdirSync(process.env.SHOTS, { recursive: true });
  const el = sel && await page.$(sel);
  await (el || page).screenshot({ path: path.join(process.env.SHOTS, name + '.png') });
};
async function drag(page, a, b) { await page.mouse.move(a[0], a[1]); await page.mouse.down(); await page.mouse.move(b[0], b[1], { steps: 6 }); await page.mouse.up(); }
const box = (page, sel) => page.$eval(sel, c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
// S on the paper, one of the two boxes ticked, a drag over the top of the page: the Save box opens.
async function snap(page, which) {
  const r = await box(page, '#paper .pg canvas');
  await page.keyboard.press('s'); await page.waitForSelector('#snipWl');
  if (which) await page.click(which);
  await drag(page, [r.x + 10, r.y + 10], [r.x + r.w * 0.8, r.y + r.h * 0.35]);
  await page.waitForSelector('#exShotPv canvas');
}

test('a watch-list screenshot and a strong example are tied to their students and show on the card, the Examples page and in the PDF for the assistant', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await page.setViewport({ width: 1360, height: 860 });
  const zip = zipOf(Object.fromEntries(await Promise.all(NAMES.map(async n => [n + '/Quiz.pdf', await makePaper({ title: n + ' quiz', pages: 1 })]))));
  await classPage(page, 'i1'); await page.waitForSelector('[data-open-asg="i1"]'); await page.click('[data-open-asg="i1"]');
  await page.waitForSelector('#dlgBox [data-cancel]'); await page.click('#dlgBox [data-cancel]');
  const clean = await pickFile(page, '#asgIn', zip, 'Fractions quiz.zip'); await waitPaper(page); clean();

  // Aria's paper: added to the watch list, with a note that says her name and a tag
  await snap(page, '#snipWl');
  assert.equal(await page.$eval('#dlgBox h2', e => e.textContent), 'Add to the watch list');
  assert.equal(await page.$eval('#exWho', e => e.value), 'Aria Testwell', 'whose work: the student whose paper it is');
  const c = await box(page, '#exShotPv canvas');   // a black box over her name at the top
  await drag(page, [c.x + c.w * 0.06, c.y + c.h * 0.12], [c.x + c.w * 0.5, c.y + c.h * 0.26]);
  assert.match(await page.$eval('#exShotNames', e => e.textContent), /1 area blacked out/);
  await page.type('#exWhy', 'Aria adds the denominators.');
  await page.type('#exTagsIn', 'adding fractions, misconception');
  await shot(page, '2-save-to-watch-list');
  await page.click('[data-exsave]');
  await page.waitForFunction(() => window.__gs.exWatch().length === 1, { timeout: 30000 });
  const w = await page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.exWatch()[0])));
  assert.deepEqual([w.watch, w.who, w.kind, w.letter], [1, { c: 'c1', n: 'Aria Testwell' }, 'shot', '1']);
  assert.equal(await page.evaluate(() => window.__gs.exList().length), 0, 'a concern is never a strong example');

  // A second concern and a strong example from Bram
  await goToStudent(page, 1); await waitPaper(page);
  await snap(page, '#snipEx');
  assert.equal(await page.$eval('#exWho', e => e.value), 'Bram Sample');
  await page.type('#exWhy', 'Shows every step.');
  await page.click('[data-exsave]');
  await page.waitForFunction(() => window.__gs.exList().length === 1, { timeout: 30000 });
  assert.deepEqual(await page.evaluate(() => window.__gs.exList()[0].who), { c: 'c1', n: 'Bram Sample' });
  await snap(page, '#snipWl');
  await page.type('#exTagsIn', 'adding fractions');
  await page.click('[data-exsave]');
  await page.waitForFunction(() => window.__gs.exWatch().length === 2, { timeout: 30000 });

  // The snip bar, for the picture: both boxes, never both ticked
  await page.keyboard.press('s'); await page.waitForSelector('#snipWl');
  await page.click('#snipEx'); await page.click('#snipWl');
  assert.deepEqual(await page.evaluate(() => [document.querySelector('#snipEx').checked, document.querySelector('#snipWl').checked]), [false, true]);
  await shot(page, '1-screenshot-bar', '.snipbar');
  await page.keyboard.press('Escape');

  // Aria's student card: her concern, with the trend line
  await page.evaluate(() => window.__gs.personCard('c1', 'Aria Testwell'));
  await page.waitForSelector('#pcWl .wltime li.w');
  assert.match(await page.$eval('#pcWl', e => e.textContent), /adds the denominators/);
  assert.match(await page.$eval('#pcWl .wltrend', e => e.textContent), /adding fractions/);
  await new Promise(r => setTimeout(r, 300));
  await shot(page, '3-student-card', '#pcard .pc');
  await page.keyboard.press('Escape');

  // The Examples page: Watch list and Whose work
  await page.evaluate(() => { window.__gs.exPageF.view = 'watch'; }); await goTo(page, '#/examples');
  await page.waitForSelector('#exPage .excard.exw');
  assert.equal(await page.$$eval('#exPage .excard', l => l.length), 2);
  assert.match(await page.$eval('#exPage .wltabs', e => e.textContent), /Watch list · 2/);
  await new Promise(r => setTimeout(r, 300));
  await shot(page, '4-watch-list');
  await page.click('[data-wlview="who"]'); await page.waitForSelector('.wlwho');
  const rows = await page.$$eval('.wlwho tbody tr', l => l.map(r => r.textContent));
  assert.match(rows[0], /Bram Sample.*1.*⚑ 1/, 'Bram first: he has the strong example');
  assert.match(await page.$eval('.wlnone', e => e.textContent), /Aria Testwell, Cleo Fixture/);
  await shot(page, '5-whose-work');

  // Send to the assistant: Aria's card, as one PDF, with a code and no names
  await page.evaluate(() => window.__gs.personCard('c1', 'Aria Testwell'));
  await page.waitForSelector('#pcWl [data-wlsend]'); await page.click('#pcWl [data-wlsend]');
  await page.waitForSelector('#wlStrip figure img');
  const ask = await page.$eval('#wlAsk', e => e.value), code = (ask.match(/S-[A-Z0-9]{4}/) || [])[0];
  assert.ok(code, 'the ask names the student by a code');
  assert.doesNotMatch(ask, /Aria/);
  assert.equal(await page.evaluate(() => window.__gs.wlScrub(window.__gs.exWatch())('Aria adds the denominators.')), '[name] adds the denominators.');
  await new Promise(r => setTimeout(r, 300));
  await shot(page, '6-send-to-assistant');
  const dl = await catchDownloads(page);
  const got = await dl.next(() => page.click('[data-wlpdf]'));
  assert.match(got.name, new RegExp('^For .* - ' + code + '\\.pdf$'));
  assert.equal(String.fromCharCode(...got.bytes.slice(0, 5)), '%PDF-');
  await dl.close();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.wlCodes'))['c1\nAria Testwell']), code, 'the key stays in this browser');

  // A new year without the roster: the watch list goes, the strong example stays, no longer anyone's
  await page.evaluate(() => window.__gs.wlNewYear(false));
  assert.equal(await page.evaluate(() => window.__gs.exWatch().length), 0);
  assert.equal(await page.evaluate(() => window.__gs.exList()[0].who), null);
  assert.deepEqual(page.errors, []);
  await close();
});
