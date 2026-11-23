// Only this student (11/16): when a student comes to the desk, the screen shows them and nobody else, until the teacher holds the
// button to show everyone. It stays through a reload, and their other work in the class opens still only them. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, score, settle, goToStudent, goTo, waitPaper } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (page, fn, arg) => { for (let i = 0; i < 200; i++) { if (await page.evaluate(fn, arg)) return; await wait(50); } throw new Error('Waited too long for ' + fn); };
const NAMES = ['Ann Alpha', 'Ben Beta', 'Cy Gamma'];
const lib = JSON.stringify({ classes: [{ id: 'c1', name: 'Period 1', names: NAMES, units: [] }] });
const papers = async title => { const o = {}; for (const n of NAMES) o[n + '/' + title + '.pdf'] = await makePaper({ title: n.split(' ')[0] + ' ' + title, pages: 1 }); return zipOf(o); };
const shown = sel => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; };
const look = page => page.evaluate(shown => {
  const vis = eval('(' + shown + ')');
  return { solo: document.documentElement.classList.contains('solo'), bar: vis('#soloBar'), side: vis('#side'), tabs: vis('#aTabs'), rail: vis('#rail'), text: document.body.innerText, cur: window.__gs.state().cur, hash: location.hash, flag: localStorage.getItem('gs.solo') };
}, shown.toString());

let browser, essay, quiz;
before(async () => { browser = await launch(); essay = await papers('Essay'); quiz = await papers('Quiz'); });
after(async () => { await browser.close(); });

test('Only this student in ⋯ shows only this student; no way round it reaches the others', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': lib } } });
  await openZip(page, essay);
  await goToStudent(page, 1);
  await page.click('#whoMore'); await page.waitForSelector('#soloBtn', { visible: true });
  await page.click('#soloBtn');
  await until(page, () => document.documentElement.classList.contains('solo'));
  let l = await look(page);
  assert.equal(l.bar, true); assert.equal(l.side, false, 'no student list'); assert.equal(l.tabs, false, 'no tabs'); assert.equal(l.rail, false, 'no sidebar');
  assert.match(l.text, /Ben Beta/);
  assert.doesNotMatch(l.text, /Ann Alpha|Cy Gamma/, 'nobody else on screen');
  const hash = l.hash;
  // the keys that move to another student, find one, or open Find anything
  for (const k of ['ArrowRight', 'ArrowLeft', 'n', 'Enter', '/', '[']) { await page.keyboard.press(k); await wait(150); }
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control'); await wait(200);
  l = await look(page);
  assert.equal(l.cur, 1, 'still the same student'); assert.equal(l.side, false);
  assert.equal(await page.$('#findDlg'), null, 'Find anything stays shut');
  // other addresses come back here
  for (const h of [hash + '/grades', hash + '/return', '#/', '#/class/c1/gradebook', '#/settings']) {
    await page.evaluate(h => { location.hash = h; }, h); await wait(250);
    l = await look(page);
    assert.equal(l.hash, hash, 'back from ' + h); assert.equal(l.cur, 1);
    assert.doesNotMatch(l.text, /Ann Alpha|Cy Gamma/, 'nobody else after ' + h);
  }
  await page.evaluate(() => window.__gs.openStudent(0)); await wait(200);
  assert.equal((await look(page)).cur, 1, 'code asking for another student is turned back');
  // a note that pops up could name someone: none while a student looks on
  await page.evaluate(() => window.__gs.toast && window.__gs.toast('Cy Gamma'));
  assert.equal(await page.evaluate(() => document.querySelector('.toast').hidden || getComputedStyle(document.querySelector('.toast')).display === 'none'), true);
  // scoring still works for them
  await score(page, [4, 3, 3]); await settle(page);
  assert.ok(await page.evaluate(() => window.__gs.state().batch.students[1].grade.rubric.filter(v => v != null).length === 3));
  assert.deepEqual(page.errors, []);
  await close();
});

test('it stays through a reload, and a short press does not end it; holding does', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': lib } } });
  await openZip(page, essay);
  await goToStudent(page, 2);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('i');
  await until(page, () => document.documentElement.classList.contains('solo'));
  await settle(page);
  await page.reloadHere();
  await until(page, () => window.__gs && window.__gs.state().batch && window.__gs.state().pages.length > 0 && !document.querySelector('#app').hidden);
  let l = await look(page);
  assert.equal(l.solo, true); assert.equal(l.cur, 2); assert.equal(l.side, false);
  assert.doesNotMatch(l.text, /Ann Alpha|Ben Beta/);
  // the plain reload the tests use lands on Home: here it comes back to the paper
  await page.reload();
  await until(page, () => window.__gs && window.__gs.state().batch && !document.querySelector('#app').hidden);
  assert.equal((await look(page)).cur, 2);
  const b = await page.$('#soloExit'), r = await b.boundingBox();
  await page.mouse.move(r.x + 20, r.y + 10); await page.mouse.down(); await wait(400); await page.mouse.up(); await wait(1500);
  assert.equal((await look(page)).solo, true, 'a click is not enough');
  await page.mouse.down(); await wait(1800); await page.mouse.up();
  await until(page, () => !document.documentElement.classList.contains('solo'));
  l = await look(page);
  assert.equal(l.flag, null); assert.equal(l.tabs, true); assert.equal(l.rail, true);
  assert.equal(l.side, true); assert.match(await page.$eval('#stuList', e => e.textContent), /Ann Alpha/, 'everyone is back');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the student details card starts it, and Other work opens their paper in another assignment, still only them', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': lib } } });
  await openZip(page, essay);
  await score(page, [4, 4, 4]); await settle(page);
  await goTo(page, '#/');
  await openZip(page, quiz, 'Quiz.zip');
  await page.evaluate(() => document.querySelector('#stuList .stu[data-i="0"] .whob').click());
  await page.waitForSelector('#pcard [data-psolo]');
  await page.click('#pcard [data-psolo]');
  await until(page, () => document.documentElement.classList.contains('solo'));
  const quizId = await page.evaluate(() => window.__gs.state().batch.id);
  await page.click('#soloOther');
  await page.waitForFunction(() => document.querySelectorAll('#soloRows [data-solog]').length === 2, { timeout: 20000 }).catch(async e => { console.log(await page.evaluate(() => document.querySelector('#soloBar').innerHTML)); throw e; });
  const rows = await page.$$eval('#soloRows [data-solog]', bs => bs.map(b => b.textContent));
  assert.ok(rows.some(t => /12 \/ 12/.test(t)), 'their own essay score: ' + rows.join(' | '));
  assert.doesNotMatch(await page.evaluate(() => document.body.innerText), /Ben Beta|Cy Gamma/);
  await page.click('#soloRows [data-solog]:not(.on)');
  await until(page, id => { const s = window.__gs.state(); return s.batch && s.batch.id !== id && !document.querySelector('#app').hidden; }, quizId);
  await waitPaper(page);
  const l = await look(page);
  assert.equal(l.solo, true); assert.equal(l.side, false);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[window.__gs.state().cur].key), 'Ann Alpha');
  assert.doesNotMatch(l.text, /Ben Beta|Cy Gamma/);
  assert.deepEqual(page.errors, []);
  await close();
});

// 11/23: a teacher got stuck. The person button beside + Add read as "partners", and papers brought in while it was on were sent away.
test('it starts from the ⋯ menu, not a person button; a short press says how to leave', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': lib } } });
  await openZip(page, essay);
  assert.equal(await page.evaluate(() => !!document.querySelector('#paper .who > #soloBtn, #paper .who > .solo-go')), false, 'no person button on the bar');
  await page.click('#whoMore');
  await page.waitForSelector('#soloBtn', { visible: true });
  await page.click('#soloBtn');
  await until(page, () => document.documentElement.classList.contains('solo'));
  assert.equal(await page.evaluate(() => document.querySelector('#soloHint').hidden), true);
  const r = await (await page.$('#soloExit')).boundingBox();
  await page.mouse.move(r.x + 20, r.y + 10); await page.mouse.down(); await wait(300); await page.mouse.up();
  await until(page, () => !document.querySelector('#soloHint').hidden);
  assert.match(await page.$eval('#soloHint', e => e.textContent), /Keep holding/);
  // trying another screen: back here, with the same word
  await page.evaluate(() => document.querySelector('#soloHint').hidden = true);
  await page.evaluate(() => { location.hash = '#/settings'; }); await wait(300);
  assert.equal(await page.evaluate(() => document.querySelector('#soloHint').hidden), false);
  assert.equal((await look(page)).solo, true);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the I key does nothing with a menu open or a button in hand', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': lib } } });
  await openZip(page, essay);
  await page.click('#whoMore'); await wait(150);
  await page.keyboard.press('i'); await wait(200);
  assert.equal((await look(page)).solo, false, 'menu open');
  await page.keyboard.press('Escape'); await wait(100);
  await page.focus('#readBtn');
  await page.keyboard.press('i'); await wait(200);
  assert.equal((await look(page)).solo, false, 'a button in hand');
  assert.deepEqual(page.errors, []);
  await close();
});

test('papers brought in while it is on stay open, and it ends; a gone student ends it too', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': lib } } });
  await openZip(page, essay);
  await goToStudent(page, 1);
  await page.evaluate(() => window.__gs.soloStart(1));
  await until(page, () => document.documentElement.classList.contains('solo'));
  const essayId = await page.evaluate(() => window.__gs.state().batch.id);
  await openZip(page, quiz, 'Quiz.zip');
  await wait(800);
  const l = await look(page);
  assert.notEqual(await page.evaluate(() => window.__gs.state().batch.id), essayId, 'the new papers stay open');
  assert.equal(l.solo, false); assert.equal(l.flag, null); assert.equal(l.bar, false); assert.equal(l.side, true);
  // a flag naming a student who isn't in the download: no dead end
  await page.evaluate(id => { localStorage.setItem('gs.solo', JSON.stringify({ id, key: 'Nobody Here' })); }, await page.evaluate(() => window.__gs.state().batch.id));
  await page.evaluate(() => { location.hash = '#/settings'; }); await wait(400);
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.solo')), null);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('solo')), false);
  assert.deepEqual(page.errors, []);
  await close();
});
