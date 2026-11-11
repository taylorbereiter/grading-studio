// Today, the first screen: what she teaches, what is waiting to be marked, what is ready to hand back, and what the class
// needs next. It is worked out from what is already saved, and stores nothing. A class page's rows are quiet: a click opens
// the assignment, and the page has one blue button. Every student, class and paper here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, appReady, waitPaper, goToStudent, goTo, classPage, score, settle, pick, idbRead, catchDownloads } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');
const { gradingSeed } = require('./helpers/steady');
const fs = require('fs'), os = require('os'), path = require('path');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const until = (page, h) => page.waitForFunction(h => location.hash === h, {}, h);
const blues = page => page.$$eval('#vHome .btn.primary', b => b.filter(x => x.checkVisibility()).map(x => x.textContent.trim()));
const text = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
const LIB = JSON.stringify({ seed2627: true, classes: [
  { id: 'c1', name: 'Test English', names: ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'], units: [{ id: 'u1', name: 'Unit 1: Narrative', items: [{ id: 'i1', name: 'Narrative essay', classId: 'c1', due: '2026-11-06' }, { id: 'i2', name: 'Reading check', classId: 'c1', typed: { max: 10, s: { 'Aria Testwell': { v: 8 } } } }] }] },
], loose: { id: '', units: [] } });
// a folder is linked in none of these, and the card that asks for one has been put off, so it is not the blue button
const seed = more => ({ ls: { 'gs.lib': LIB, 'gsc.folderLater': String(Date.now()), ...more } });
// Opens the made-up papers through the Narrative essay's own row, so they belong to it.
async function openOnCard(page) {
  await classPage(page, 'i1'); await page.waitForSelector('[data-open-asg="i1"]'); await page.click('[data-open-asg="i1"]');
  await page.waitForSelector('#dlgBox [data-pc]');
  const [fc] = await Promise.all([page.waitForFileChooser(), page.click('#dlgBox [data-pc]')]);
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gs-test-today-')), 'Narrative essay.zip');
  fs.writeFileSync(tmp, zip); await fc.accept([tmp]); await waitPaper(page);
}
const home = async page => { await page.click('#closeBtn'); await until(page, '#/'); };

test('kept work moves from To mark to Ready to hand back to Earlier work, with one blue button each time', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  assert.equal(await text(page, '#rail [data-nav="home"]'), 'Today');
  assert.match(await text(page, '#homeDate'), /^\w+day, \w+ \d+$/, 'the title is the day');
  assert.deepEqual(await blues(page), ['Choose files…'], 'nothing kept: opening new work is the next thing');
  for (const id of ['toMark', 'handBack', 'needNext', 'earlier']) assert.ok(await page.$eval('#' + id, e => e.hidden), id + ' is not shown when it has nothing');

  await openOnCard(page);
  const n = await page.evaluate(() => window.__gs.state().batch.students.length);
  await score(page, [3]); await settle(page);
  await home(page);
  await page.waitForSelector('#toMark .krow');
  assert.match(await text(page, '#toMark .krow'), /^Narrative essay\s*Test English · due Nov 6\s*\d of \d scored/);
  assert.equal(await text(page, '#toMark .krow .btn'), 'Continue');
  assert.deepEqual(await blues(page), ['Continue']);
  assert.match(await text(page, '#homeSay'), /^One set of papers to mark\.$/);
  assert.ok(await page.$eval('#handBack', e => e.hidden));

  // the assignment's own name opens it, and so does Continue
  await page.click('#toMark .kname'); await waitPaper(page);
  for (let i = 0; i < n; i++) { await goToStudent(page, i); await score(page, [i === 1 ? 2 : 4, 3, i < 2 ? 2 : 1]); }
  await settle(page);
  await home(page);
  await page.waitForSelector('#handBack .krow');
  assert.ok(await page.$eval('#toMark', e => e.hidden));
  await page.waitForFunction(() => /average \d+%/.test(document.querySelector('#handBack').textContent));
  assert.match(await text(page, '#handBack .krow .ks'), new RegExp('^Test English · all ' + n + ' scored · average \\d+%$'));
  assert.deepEqual(await blues(page), ['Return papers']);
  assert.match(await text(page, '#homeSay'), /^One set of papers ready to hand back\.$/);

  // what the class needs next: the weakest row, how many students, never who
  await page.waitForSelector('#needNext .tneed');
  const need = await text(page, '#needNext');
  assert.match(need, /Test English: Criterion 3 was the weakest row on Narrative essay\./);
  assert.match(need, new RegExp('(Four|' + n + ') students scored 2 or below on Criterion 3\\.'));
  for (const name of ['Aria', 'Bram', 'Cleo', 'Dov']) assert.ok(!need.includes(name), 'no student is named on the card');
  assert.equal(await page.$eval('#needNext .tlink', a => a.textContent.trim()), 'See who');

  // Return papers opens the papers at their Return tab; handing them back moves the row to Earlier work
  const id = await page.$eval('#handBack [data-kret]', a => a.dataset.kret);
  await page.click('#handBack [data-kret]');
  await page.waitForSelector('#rtSide', { timeout: 30000 });
  assert.equal(await page.evaluate(() => location.hash), '#/a/' + encodeURIComponent(id.replace(/^gs\.b\./, '')) + '/return');
  const dl = await catchDownloads(page);
  await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  await page.waitForSelector('#rtState .rtdone'); await settle(page);
  await goTo(page, '#/'); await until(page, '#/');
  await page.waitForSelector('#earlier .krow');
  assert.match(await text(page, '#earlier .krow'), /^Narrative essay\s*Test English · returned \w+ \d+ · \d of \d scored/);
  assert.ok(await page.$eval('#handBack', e => e.hidden) && await page.$eval('#toMark', e => e.hidden));
  assert.deepEqual(await blues(page), ['Choose files…']);
  await page.waitForSelector('#needNext .tneed');   // still what the class needs next

  // Forget is in the row's menu and takes two clicks
  await pick(page, '#earlier [data-kforget]');
  assert.equal(await text(page, '#earlier [data-kforget]'), 'Click again to forget it');
  await page.click('#earlier [data-kforget]');
  await page.waitForFunction(() => document.querySelector('#earlier').hidden);
  assert.deepEqual((await idbRead(page, 'grading-studio-keep', 'meta')).k, []);
  await dl.close();
  assert.deepEqual(page.errors, []);
  await close();
});

test('What the class needs next reads saved work only, and Today stores nothing', async () => {
  const s = gradingSeed();
  s.ls['gsc.folderLater'] = String(Date.now());
  // the made-up term's work was last saved weeks ago: bring the newer one to today so the card has something recent
  const meta = s.idb['grading-studio-keep'].stores.meta; meta[1][1].t = Date.now() - 864e5; meta[0][1].t = Date.now() - 40 * 864e5;
  const { page, close } = await openApp(browser, { seed: s });
  await page.waitForSelector('#needNext .tneed');
  assert.match(await text(page, '#needNext .tbig'), /^Grade 9 English: Language was the weakest row on Poetry analysis\.$/);
  assert.deepEqual(await page.$$eval('#needNext .tbn', x => x.map(e => e.textContent)), ['Ideas', 'Organization', 'Language']);
  assert.deepEqual(await page.$$eval('#needNext .tbv', x => x.map(e => e.textContent)), ['3.3', '2.8', '2.3']);
  assert.equal(await page.$$eval('#needNext .tbt i.low', x => x.length), 1);
  assert.match(await text(page, '#needNext .tsay'), /^Four students scored 2 or below on Language\.$/);
  assert.equal(await page.$('#needNext .tlink'), null, 'its papers are not kept here, so there is nothing to open');
  // both are scored and neither is handed back
  assert.deepEqual(await page.$$eval('#handBack .kname', x => x.map(e => e.textContent)), ['Poetry analysis', 'Narrative essay']);
  await page.waitForFunction(() => document.querySelectorAll('#handBack .ks').length === 2 && [...document.querySelectorAll('#handBack .ks')].every(e => /average/.test(e.textContent)));
  assert.match(await text(page, '#handBack .krow .ks'), /^Grade 9 English · all 6 scored · average \d+% · papers not kept, drop the download again$/);
  assert.match(await text(page, '#homeSay'), /^Two sets of papers ready to hand back\.$/);
  // looking stored nothing
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  await goTo(page, '#/class/c1'); await goTo(page, '#/'); await page.reload(); await appReady(page); await page.waitForSelector('#needNext .tneed');
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).sort()), keys);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a class page has quiet rows: a click opens the assignment, and one button is blue', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await openOnCard(page);
  await score(page, [3, 3, 2]); await settle(page);
  await home(page);
  await classPage(page, 'i1'); await page.waitForSelector('[data-card="i1"] [data-kopen]');
  assert.deepEqual(await page.$$eval('#vClass .btn.primary', b => b.filter(x => x.checkVisibility()).map(x => x.textContent.trim())), ['+ Assignment']);
  assert.match(await text(page, '[data-card="i1"] .cstate'), /^\d of \d scored.*Scoring$/);
  assert.equal(await text(page, '[data-card="i2"] .cstate'), 'Scores typed in');
  // a click on the row, away from its buttons, opens the papers
  await page.click('[data-card="i1"] .cdue'); await waitPaper(page);
  await home(page);
  // a row of typed-in scores opens the gradebook
  await classPage(page, 'i2'); await page.waitForSelector('[data-card="i2"]');
  await page.click('[data-card="i2"] .cstate'); await until(page, '#/class/c1/gradebook');
  // the other ways in are still there: Edit beside the row, other papers in its menu
  await classPage(page, 'i1'); await page.waitForSelector('[data-card="i1"] [data-edit-asg]');
  await pick(page, '[data-card="i1"] [data-open-asg]');
  await page.waitForSelector('#dlgBox [data-pc]');
  assert.deepEqual(page.errors, []);
  await close();
});
