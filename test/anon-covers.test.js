// Anonymous grading and Check the covers (11/11): every paper can be checked, marked or not; the automatic name finder is off
// unless she turns it on; and the check says little. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goTo } = require('./helpers/app');
const { makePaper, zipOf, standardFiles } = require('./helpers/fixtures');

let browser, files;
before(async () => { browser = await launch(); files = await standardFiles(); });
after(async () => { await browser.close(); });

// Every PDF read, then a pen mark on the first student's paper, so the batch has marks and one paper is still bare.
async function markOne(page) {
  await page.waitForFunction(() => { const b = window.__gs.state().batch; return b && b.students.every(s => s.files.every(f => f.kind !== 'pdf' || (f.numPages && f.kami !== undefined))); }, { timeout: 60000 });
  await page.evaluate(() => { const f = window.__gs.state().batch.students[0].files.find(f => f.kind === 'pdf'); f.marks[0] = [{ t: 'pen', pts: [[.1, .1], [.2, .2]], c: '#D7263D', w: 2 }]; });
}
const openCheck = async page => {
  await page.click('#anonSw'); await page.waitForSelector('#dlgBox [data-check]');
  await page.click('#dlgBox [data-check]'); await page.waitForSelector('#ccRows [data-ccgo]');
};

test('anonymous grading: Check the covers has every paper, marked or not', async () => {
  const { page, close } = await openApp(browser, { nameFind: false });
  await openZip(page, zipOf(files), 'Tide essay.zip');
  await markOne(page);
  await openCheck(page);
  // Aria 1, Bram 2, Cleo 1: every PDF paper, though only Aria's has a mark.
  assert.equal(await page.$$eval('#ccRows [data-ccgo]', l => l.length), 4);
  assert.match(await page.$eval('#ccProg', e => e.textContent), /^0 of 4 checked/);
  assert.deepEqual(page.errors, []);
  await close();
});

// The covers drawn on the paper open in the check, not counting her own.
const autoOnPage = page => page.waitForFunction(() => { const c = document.querySelector('#ccBody canvas'); return c && c._cover && c._cover.covers.filter(q => !q.own).length; }, { timeout: 30000 }).then(h => h.jsonValue()).catch(() => 0);

test('finding names on its own is off by default: no automatic covers, no flags, short words', async () => {
  const { page, close } = await openApp(browser, { nameFind: false });
  await openZip(page, zipOf(files), 'Tide essay.zip');
  assert.equal(await page.evaluate(() => window.__gs.nameFindOn()), false);
  await page.click('#anonSw'); await page.waitForSelector('#dlgBox [data-check]');
  const said = await page.$eval('#dlgBox .bb', e => e.innerText);
  assert.doesNotMatch(said, /Worth a look|Name not found|can’t be trusted|check this one/, said);
  assert.match(said, /Cover the names first/);
  assert.ok(said.length < 400, 'the box says little: ' + said.length + ' letters\n' + said);
  await page.click('#dlgBox [data-check]'); await page.waitForSelector('#ccBody canvas');
  await new Promise(r => setTimeout(r, 800));
  assert.equal(await page.$eval('#ccBody canvas', c => c._cover.covers.length), 0, 'Aria Testwell is typed on the page but nothing covers it');
  assert.equal(await page.$eval('#ccTitle', e => e.textContent), 'Aria Testwell', 'no Claude code in anonymous grading');
  assert.equal(await page.$eval('[data-ccf="flag"]', e => e.hidden), true);
  assert.match(await page.$eval('#dlgBox .bf .muted', e => e.textContent), /^Drag over a name to cover it\. Click a box to take it off\./);
  // Her own box still covers.
  const c = await page.$('#ccBody canvas'), b = await c.boundingBox();
  await page.mouse.move(b.x + 30, b.y + 30); await page.mouse.down(); await page.mouse.move(b.x + 140, b.y + 60, { steps: 3 }); await page.mouse.up();
  await page.waitForFunction(() => Object.values(window.__gs.state().batch.share.boxes).flat().length === 1);
  await page.keyboard.press('Escape');
  // The Claude ZIP says what it covers now.
  await page.evaluate(() => { window.__gs.closeDlg && window.__gs.closeDlg(); window.__gs.openShare(); });
  await page.waitForSelector('#shSteps');
  const zip = await page.$eval('#dlgBox .bb', e => e.textContent);
  assert.match(zip, /Names are covered where you box them in Check the covers/);
  assert.doesNotMatch(zip, /wherever they’re typed/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Settings, Marking: finding typed names can be turned back on, and then it covers them', async () => {
  const { page, close } = await openApp(browser, { nameFind: false });
  await goTo(page, '#/settings/marking');
  await page.waitForSelector('#setNameFind button[data-v="1"]', { visible: true });
  assert.equal(await page.$eval('#setNameFind button[data-v="0"]', e => e.getAttribute('aria-pressed')), 'true');
  await page.click('#setNameFind button[data-v="1"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.nameFind')), 'true');
  await openZip(page, zipOf(files), 'Tide essay.zip');
  await page.click('#anonSw'); await page.waitForSelector('#dlgBox [data-check]');
  await page.click('#dlgBox [data-check]'); await page.waitForSelector('#ccBody canvas');
  assert.ok(await autoOnPage(page) > 0, 'the typed name is covered');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#dlgBox [data-cancel]'); await page.click('#dlgBox [data-cancel]');   // back to the anonymous grading box, then shut it
  await goTo(page, '#/settings/marking');
  await page.waitForSelector('#setNameFind button[data-v="0"]', { visible: true });
  await page.click('#setNameFind button[data-v="0"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.nameFind')), null);
  assert.deepEqual(page.errors, []);
  await close();
});
