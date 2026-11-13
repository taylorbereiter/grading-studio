// A screenshot saved as a strong example: tick "Save as a strong example" in the Screenshot bar (or press the button on the
// "Picture copied" note), black out anything more, add why and tags, and it joins the bank of examples on the Examples page,
// where tags and a search find it again. Made-up students and classes only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goTo } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => {
  browser = await launch();
  zip = zipOf({
    'Ann Example/Essay.pdf': await makePaper({ title: 'Ann Example essay', pages: 1 }),
    'Ben Specimen/Essay.pdf': await makePaper({ title: 'Ben Specimen essay', pages: 1 }),
  });
});
after(async () => { await browser.close(); });

const exList = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.exList())));
async function drag(page, a, b) {
  await page.mouse.move(a[0], a[1]); await page.mouse.down();
  await page.mouse.move(b[0], b[1], { steps: 6 }); await page.mouse.up();
}
const box = (page, sel) => page.$eval(sel, c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
// How much of the saved picture is the cover black.
const blackOf = (page, id) => page.evaluate(async id => {
  const b = await new Promise((res, rej) => { const r = indexedDB.open('grading-studio-examples'); r.onsuccess = () => { const q = r.result.transaction('pix').objectStore('pix').get(id + '|0'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }; r.onerror = () => rej(r.error); });
  const im = await createImageBitmap(b), c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 40 && d[i + 1] < 40 && d[i + 2] < 40) n++;
  return n / (c.width * c.height);
}, id);

test('on a paper: Save as a strong example opens the Save box; a black box, why and tags go with it; the assignment’s tab shows it', async () => {
  const { page, close } = await openApp(browser);
  const logs = []; page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  await openZip(page, zip, 'Essay.zip');
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.pages.length && s.pages[0].bmp; }, { timeout: 60000 });
  const r = await box(page, '#paper .pg canvas');
  await page.evaluate(() => { navigator.clipboard.write = async () => { window.__copied = true; }; });
  await page.keyboard.press('s');
  await page.waitForSelector('#snipEx');
  assert.equal(await page.$eval('#snipEx', e => e.checked), false, 'off at first: a screenshot is copied unless she asks');
  await page.click('#snipEx');
  await drag(page, [r.x + 10, r.y + 10], [r.x + r.w * 0.7, r.y + r.h * 0.4]);
  await page.waitForSelector('#exShotPv canvas');
  assert.equal(await page.evaluate(() => window.__copied || false), false, 'not copied when it is saved');
  assert.match(await page.$eval('#exShotNames', e => e.textContent), /already painted in/);
  assert.match(await page.$eval('#dlgBox .exnames:last-child, #dlgBox .exside', e => e.textContent), /From/);
  // A black box over the top left of the picture
  const c = await box(page, '#exShotPv canvas');
  await drag(page, [c.x + 4, c.y + 4], [c.x + c.w * 0.5, c.y + c.h * 0.5]);
  assert.match(await page.$eval('#exShotNames', e => e.textContent), /1 area blacked out/);
  await page.type('#exWhy', 'A clear claim in the first line.');
  await page.type('#exTagsIn', ' thesis ,Evidence, thesis,  ');
  await page.click('[data-exsave]');
  await page.waitForFunction(() => window.__gs.exList().length === 1, { timeout: 30000 });
  const [rec] = await exList(page);
  assert.equal(rec.kind, 'shot');
  assert.equal(rec.letter, '1');
  assert.deepEqual(rec.tags, ['thesis', 'Evidence']);
  assert.equal(rec.why, 'A clear claim in the first line.');
  assert.equal(rec.work, await page.evaluate(() => window.__gs.state().batch.id));
  assert.ok(rec.from && rec.from.key, 'whose it was, for her eyes only');
  assert.ok(await blackOf(page, rec.id) > 0.2, 'the black box is on the saved picture');
  assert.match(await page.$eval('.toast', e => e.textContent), /Saved as Screenshot 1/);
  // The assignment's Examples tab
  await page.evaluate(() => window.__gs.openExamples());
  await page.waitForSelector('.excard.shot');
  assert.match(await page.$eval('.excard.shot', e => e.textContent), /Screenshot 1/);
  assert.deepEqual(await page.$$eval('.excard.shot .extag', b => b.map(x => x.textContent)), ['thesis', 'Evidence']);
  assert.match(await page.$eval('#exBody', e => e.textContent), /screenshots/);
  assert.deepEqual(logs, []); assert.deepEqual(page.errors, []);
  await close();
});

test('away from a paper: the Picture copied note saves it after all; the bank finds it by tag and by search', async () => {
  const { page, close } = await openApp(browser);
  const logs = []; page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  await page.waitForSelector('#findBtn');
  await page.evaluate(() => { navigator.clipboard.write = async () => { window.__copied = true; }; });
  await page.keyboard.down('Alt'); await page.keyboard.press('KeyS'); await page.keyboard.up('Alt');
  await page.waitForSelector('#snipLayer');
  await drag(page, [40, 40], [440, 340]);
  await page.waitForFunction(() => window.__copied && document.querySelector('.toast .tact'));
  assert.equal(await page.$eval('.toast .tact', b => b.textContent), 'Save as a strong example');
  await page.click('.toast .tact');
  await page.waitForSelector('#exShotPv canvas');
  assert.ok(await page.$('#exShotCls'), 'away from an assignment she picks the class');
  assert.match(await page.$eval('#exShotNames', e => e.textContent), /^Drag over anything that shows a name/);
  await page.select('#exShotCls', 'starter2');
  await page.type('#exTagsIn', 'Unit 2');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__gs.exList().length === 1, { timeout: 30000 });
  const [rec] = await exList(page);
  assert.equal(rec.kind, 'shot'); assert.equal(rec.work, null); assert.equal(rec.cls, 'starter2'); assert.equal(rec.from, null);
  assert.equal(rec.title, 'Screenshots');
  // A second, with the tag offered from the first
  await page.evaluate(() => window.__gs.snipStart());
  await page.waitForSelector('#snipEx');
  await page.click('#snipEx');
  await drag(page, [60, 60], [360, 260]);
  await page.waitForSelector('[data-exaddtag]');
  await page.click('[data-exaddtag="Unit 2"]');
  assert.equal(await page.$eval('#exTagsIn', e => e.value), 'Unit 2');
  await page.type('#exWhy', 'Strong topic sentences');
  await page.click('[data-exsave]');
  await page.waitForFunction(() => window.__gs.exList().length === 2, { timeout: 30000 });
  assert.equal((await exList(page))[1].letter, '1', 'no class, so its own Screenshot 1');
  // The bank
  await page.waitForSelector('#railExamples:not([hidden])');
  await goTo(page, '#/examples');
  await page.waitForFunction(() => document.querySelectorAll('#exPage .excard').length === 2);
  assert.ok(await page.$('#exPage [data-exf="kind"] option[value="shot"]'), 'Screenshots in the kinds');
  await page.select('#exPage [data-exf="tag"]', 'Unit 2');
  await page.waitForFunction(() => document.querySelectorAll('#exPage .excard').length === 2);
  await page.click('#exPage [data-exfclear]');
  await page.type('#exFind', 'topic');
  await page.waitForFunction(() => document.querySelectorAll('#exPage .excard').length === 1);
  assert.equal(await page.$eval('#exFind', e => e === document.activeElement), true, 'typing carries on in the box');
  await page.click('#exPage [data-exfclear]');
  await page.waitForFunction(() => document.querySelectorAll('#exPage .excard').length === 2);
  // Tags from a card's ⋯ menu, and a tag click filters
  const card = '#exPage .excard[data-exid="' + rec.id + '"]';
  await page.click(card + ' [data-km]');
  await page.click(card + ' [data-extags]');
  await page.waitForSelector(card + ' .extags input');
  await page.$eval(card + ' .extags input', i => { i.value = 'Unit 2, hooks'; });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__gs.exList()[0].tags.join() === 'Unit 2,hooks');
  await page.waitForSelector('#exPage [data-extag="hooks"]');
  await page.click('#exPage [data-extag="hooks"]');
  await page.waitForFunction(() => document.querySelectorAll('#exPage .excard').length === 1);
  assert.equal(await page.$eval('#exPage [data-exf="tag"]', s => s.value), 'hooks');
  assert.ok(await page.$('#exPage [data-exsheet]'), 'a sheet of whatever is shown');
  assert.deepEqual(logs, []); assert.deepEqual(page.errors, []);
  await close();
});
