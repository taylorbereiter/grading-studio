// Quick mark: copy one answer as a picture (P or ⧉ Copy), to paste into Claude. Only the answer goes on it, with typed names
// covered, the question and the answer key on top, and no mark, score or name. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, catchDownloads } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => {
  browser = await launch();
  zip = zipOf({
    'Ann Example/Quiz scan.pdf': await makePaper({ title: 'Ann Example quiz', pages: 1 }),
    'Ben Specimen/Quiz scan.pdf': await makePaper({ title: 'Ben Specimen quiz', pages: 1 }),
  });
});
after(async () => { await browser.close(); });

async function dragOn(page, a, b) {
  await page.waitForSelector('.qbpg[data-n="0"] canvas');
  const r = await page.$eval('.qbpg[data-n="0"] canvas', c => { c.scrollIntoView({ block: 'start' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(r.x + a[0] * r.w, r.y + a[1] * r.h); await page.mouse.down();
  await page.mouse.move(r.x + b[0] * r.w, r.y + b[1] * r.h, { steps: 6 }); await page.mouse.up();
}
// The picture last put on the clipboard, read back: its size, the black of a name cover, and any green (a ✓ mark).
const caught = page => page.evaluate(() => { window.__pic = null; navigator.clipboard.write = async items => { window.__types = items[0].types; window.__pic = await items[0].getType('image/png'); }; });
const looked = page => page.evaluate(async () => {
  const b = window.__pic; if (!b) return null;
  const im = await createImageBitmap(b), c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data; let cover = 0, green = 0;
  for (let i = 0; i < d.length; i += 4) { const [r, g, bl] = [d[i], d[i + 1], d[i + 2]]; if (Math.abs(r - 17) < 3 && Math.abs(g - 17) < 3 && Math.abs(bl - 17) < 3) cover++; if (g > 100 && g > r + 40 && g > bl + 25) green++; }
  return { type: b.type, types: window.__types, w: c.width, h: c.height, cover, green };
});

test('P copies one answer as a picture: name covered, no mark, the question and key on top; a note says what it shows', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'Quiz.zip');
  await page.evaluate(() => window.__gs.openQuizBoxes());
  await dragOn(page, [0.05, 0.05], [0.7, 0.11]);    // over the typed title, which has the student's name in it
  await dragOn(page, [0.05, 0.14], [0.9, 0.26]);    // over plain lines
  await page.$eval('.qbt tbody tr:nth-child(1) .qkey', e => { e.value = 'Photosynthesis'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.click('[data-save]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 2);
  // Ann is marked right first: her ✓ must not be on the picture.
  await page.click('#qmBody .qmc[data-st="0"] button[data-v="1"]');
  await page.waitForFunction(() => document.querySelector('#qmBody .qmc[data-st="0"]').classList.contains('right'));
  await caught(page);
  assert.equal(await page.$$eval('#qmBody .qmc [data-qcopy]', b => b.length), 2, 'a Copy button on each answer');
  await page.focus('#qmBody .qmc[data-st="0"]');
  await page.keyboard.press('p');
  await page.waitForFunction(() => window.__pic);
  const a = await looked(page);
  assert.deepEqual(a.types, ['image/png']); assert.equal(a.type, 'image/png');
  assert.ok(a.w >= 560, 'wide enough for the words on top: ' + a.w);
  assert.ok(a.cover > 1500, 'the typed name is covered: ' + a.cover);
  assert.equal(a.green, 0, 'no ✓ on the picture');
  await page.waitForSelector('#qmCopyNote');
  assert.match(await page.$eval('#qmCopyNote', e => e.textContent), /handwriting and words/);
  assert.match(await page.$eval('.toast', e => e.textContent), /Picture of Question 1 copied/);
  await page.click('[data-copyok]');
  assert.equal(await page.$('#qmCopyNote'), null);
  assert.ok(await page.evaluate(() => /1/.test(localStorage.getItem('gs.qmCopySeen') || '')), 'Got it is remembered');
  // Ben's answer, by the button: his name is covered too, and the note doesn't come back.
  await caught(page);
  await page.click('#qmBody .qmc[data-st="1"] [data-qcopy]');
  await page.waitForFunction(() => window.__pic);
  const b = await looked(page);
  assert.ok(b.cover > 1500, 'his typed name is covered: ' + b.cover);
  assert.equal(await page.$('#qmCopyNote'), null, 'the note shows once');
  // Question 2 has no name in it: nothing is covered.
  await page.keyboard.press(']');
  await page.waitForFunction(() => /Question 2/.test(document.querySelector('#qmPick').selectedOptions[0].textContent));
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 2);
  await caught(page);
  await page.focus('#qmBody .qmc[data-st="0"]');
  await page.keyboard.press('P');
  await page.waitForFunction(() => window.__pic);
  const c = await looked(page);
  assert.equal(c.cover, 0, 'nothing to cover on plain lines');
  assert.deepEqual(page.errors, []);
  await close();
});

test('where the browser can’t copy pictures, the answer is saved as a picture file named by the question only', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'Quiz.zip');
  await page.evaluate(() => window.__gs.openQuizBoxes());
  await dragOn(page, [0.05, 0.14], [0.9, 0.26]);
  await page.click('[data-save]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 2);
  await page.evaluate(() => { window.ClipboardItem = undefined; });
  const dl = await catchDownloads(page);
  const got = await dl.next(() => page.click('#qmBody .qmc[data-st="1"] [data-qcopy]'));
  assert.equal(got.name, 'Question 1.png');
  assert.deepEqual([...got.bytes.slice(1, 4)], [80, 78, 71], 'a PNG');
  await page.waitForFunction(() => /saved as a picture file/.test(document.querySelector('.toast').textContent));
  await dl.close();
  assert.deepEqual(page.errors, []);
  await close();
});
