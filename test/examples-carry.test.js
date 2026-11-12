// Strong examples go where the rest of her work goes: the linked folder, the take-home file and Bring work in, and out with Remove from this computer.
// The Examples page in the sidebar lists every one. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { openOwn, closeOwn, openZip, waitPaper, pick, goTo, answerDlg, appReady } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');
const { linkFolder, folderWait, folderRead, folderList, wipeBrowser, takeHome, openFile, bringIt } = require('./helpers/carry');

let essayZip;
before(async () => {
  essayZip = zipOf({
    'Cara Sample/River essay.pdf': await makePaper({ title: 'Cara Sample essay', pages: 2 }),
    'Dev Madeup/River essay.pdf': await makePaper({ title: 'Dev Madeup essay', pages: 1 }),
  });
});
after(closeOwn);

const exList = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.exList())));
const exSynced = async page => { await folderWait(page); await page.evaluate(() => window.__gs.exFolderSync()); };
// Use as an example on the open paper: the whole paper, or part of a page with a box dragged on its first page.
async function keepOne(page, { part, why } = {}) {
  const had = (await exList(page)).length;
  await pick(page, '[data-whodo="example"]');
  await page.waitForFunction(() => document.querySelectorAll('#exPv canvas.exc').length >= 1 && document.querySelector('#exNames'), { timeout: 60000 });
  if (part) {
    await page.click('[data-exk="part"]');
    const r = await page.$eval('#exPv .expg canvas', c => { c.scrollIntoView({ block: 'start' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await page.mouse.move(r.x + 0.1 * r.w, r.y + 0.3 * r.h); await page.mouse.down();
    await page.mouse.move(r.x + 0.8 * r.w, r.y + 0.6 * r.h, { steps: 5 }); await page.mouse.up();
  }
  if (why) await page.type('#exWhy', why);
  await page.click('[data-exsave]');
  await page.waitForFunction(n => window.__gs.exList().length === n + 1 && document.querySelector('#dlg').hidden, { timeout: 60000 }, had);
  return (await exList(page)).pop();
}

test('the linked folder keeps each example and its pictures, brings them back to a cleared browser, keeps a deleted one deleted, and Forget leaves their bytes', async () => {
  const { page, close, srv } = await openOwn();
  await linkFolder(page, 'Examples');
  await openZip(page, essayZip, 'River essay.zip');
  await waitPaper(page);
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  const r = await keepOne(page, { why: 'Every claim is tied to the story.' });
  await exSynced(page);
  assert.ok((await folderList(page, 'examples')).includes(r.id + '.json'), 'the example is in the folder');
  const o = await folderRead(page, 'examples', r.id + '.json');
  assert.equal(o.rec.id, r.id); assert.equal(o.rec.why, 'Every claim is tied to the story.');
  assert.equal(o.pix.length, 2, 'a picture for each page');
  const files = await folderList(page, 'files');
  for (const p of o.pix) assert.ok(files.includes(p.hash + '.dat'), 'its picture is in files/');
  // Forgetting the download clears out the papers' bytes, and leaves the example's, whose name it was goes.
  await page.evaluate(i => window.__gs.forgetKept(i), id);
  await folderWait(page); await exSynced(page);
  const left = await folderList(page, 'files');
  for (const p of o.pix) assert.ok(left.includes(p.hash + '.dat'), 'the picture outlasts Forget');
  assert.equal((await folderRead(page, 'examples', r.id + '.json')).rec.from, null, 'whose it was is gone from the folder too');
  // A cleared browser gets it back from the folder, pictures and all, and the sidebar has an Examples page.
  await wipeBrowser(page, srv);
  assert.equal(await page.$eval('#railExamples', a => a.hidden), true, 'no Examples in the sidebar with none here');
  await linkFolder(page, 'Examples');
  await page.waitForFunction(() => window.__gs.exList().length === 1, { timeout: 30000 });
  assert.equal(await page.$eval('#railExamples', a => a.hidden), false, 'the sidebar shows Examples once there is one');
  await goTo(page, '#/examples');
  await page.waitForFunction(() => document.querySelectorAll('#exPage .excard img[src]').length === 1, { timeout: 30000 });
  assert.match(await page.$eval('#exPage', e => e.textContent), /Every claim is tied to the story\./);
  assert.match(await page.$eval('#exPage .exgh', e => e.textContent), /River essay|Assignment/);
  // Deleted here: the folder keeps it deleted, so the next cleared browser doesn't get it back.
  await page.$eval('#exPage .excard [data-exdel]', b => b.click()); await page.$eval('#exPage .excard [data-exdel]', b => b.click());
  await page.waitForFunction(() => window.__gs.exList().length === 0);
  await exSynced(page);
  assert.equal((await folderRead(page, 'examples', r.id + '.json')).rec.gone, true);
  await wipeBrowser(page, srv);
  await linkFolder(page, 'Examples');
  await exSynced(page);
  assert.equal((await exList(page)).length, 0, 'a deleted example stays deleted');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the take-home file carries examples there and back, deletes too, and the Examples page filters them', async () => {
  const a = await openOwn(), b = await openOwn();
  await openZip(a.page, essayZip, 'River essay.zip');
  await waitPaper(a.page);
  const one = await keepOne(a.page, { why: 'A clear thesis.' });
  const two = await keepOne(a.page, { part: true });
  assert.equal(two.kind, 'part');
  let bytes = await takeHome(a.page);
  let { preview } = await openFile(b.page, bytes);
  assert.match(preview, /2 new examples/);
  await bringIt(b.page);
  await b.page.waitForFunction(() => window.__gs.exList().length === 2, { timeout: 30000 });
  const got = await exList(b.page);
  assert.equal(got.find(r => r.id === one.id).why, 'A clear thesis.');
  // The page lists both, and a filter narrows them.
  await goTo(b.page, '#/examples');
  await b.page.waitForFunction(() => document.querySelectorAll('#exPage .excard img[src]').length === 2, { timeout: 30000 });
  await b.page.select('#exPage [data-exf="kind"]', 'part');
  await b.page.waitForFunction(() => document.querySelectorAll('#exPage .excard').length === 1 && document.querySelector('#exPage .excard.part'));
  assert.match(await b.page.$eval('#exPage .exn', e => e.textContent), /^1 example$/);
  await b.page.click('#exPage [data-exfclear]');
  await b.page.waitForFunction(() => document.querySelectorAll('#exPage .excard').length === 2);
  // Show to the class steps through what the page lists.
  await b.page.click('#exPage [data-exshow]');
  await b.page.waitForSelector('#exShow');
  await b.page.keyboard.press('Escape');
  await b.page.waitForFunction(() => !document.querySelector('#exShow'));
  // Deleted on the other computer, it goes here too on the way back.
  await b.page.evaluate(i => window.__gs.exDeleteTest(i), one.id);
  await b.page.waitForFunction(() => window.__gs.exList().length === 1);
  bytes = await takeHome(b.page);
  ({ preview } = await openFile(a.page, bytes));
  assert.match(preview, /1 example was deleted there/);
  await bringIt(a.page);
  await a.page.waitForFunction(i => window.__gs.exList().length === 1 && window.__gs.exList()[0].id !== i, { timeout: 30000 }, one.id);
  // Nothing new the second time.
  ({ preview } = await openFile(a.page, bytes));
  assert.doesNotMatch(preview, /example/i);
  assert.deepEqual(a.page.errors, []); assert.deepEqual(b.page.errors, []);
  await a.close(); await b.close();
});

test('Remove from this computer takes examples too', async () => {
  const { page, close } = await openOwn();
  await openZip(page, essayZip, 'River essay.zip');
  await waitPaper(page);
  await keepOne(page);
  await goTo(page, '#/settings');
  await page.click('#removeBtn');
  await answerDlg(page, { typed: 'REMOVE' });
  await page.waitForNavigation({ timeout: 60000 });
  await appReady(page);
  assert.equal(await page.evaluate(async () => (await indexedDB.databases()).some(d => d.name === 'grading-studio-examples')), false);
  assert.equal((await exList(page)).length, 0);
  await close();
});
