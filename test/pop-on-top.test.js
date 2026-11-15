// A comment box opened near the foot of a page hangs over the gap and the next page. It must sit on top of them:
// every part of it can be seen and pressed (saved comments, Done), and a press inside it never cancels the comment.
// Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, at } = require('./helpers/app');
const { zipOf, makePaper } = require('./helpers/fixtures');

let browser, zip;
const SAVED = ['A bit too vague here, try to be more specific.', 'What is your call to action?', 'To what effect?', 'Good use of evidence.'];
before(async () => { browser = await launch(); zip = zipOf({ 'Aria Testwell/Essay.pdf': await makePaper({ title: 'Aria Testwell essay', pages: 2 }) }); });
after(async () => { await browser.close(); });

async function open(page) {
  await openZip(page, zip, 'Foot.zip');
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.pages.length === 2 && s.pages[1].s > 0; });
}
// What is drawn on top at the middle of each part of the box: it must be the box itself.
const covered = page => page.evaluate(() => {
  const pop = document.querySelector('.pop'), out = [];
  for (const el of pop.querySelectorAll('textarea, [data-nc], .chip, [data-a]')) {
    const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit || !pop.contains(hit)) out.push((el.dataset.a || el.className || el.tagName) + ' under ' + (hit ? hit.tagName + '.' + hit.className : 'nothing'));
  }
  return out;
});

test('a comment box near the foot of a page sits over the next page, and every part of it can be pressed', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.bank': JSON.stringify(SAVED) } } });
  await open(page);
  await page.evaluate(() => window.__gs.setTool('note'));
  // Near the foot of page 1, brought to the middle of the window so the box opens below the spot, over the gap and page 2.
  const p = await at(page, 0, 300, 772);
  await page.mouse.click(p.x, p.y);
  await page.waitForSelector('.pop .chip');
  const hangs = await page.evaluate(() => { const s = window.__gs.state(), r = document.querySelector('.pop').getBoundingClientRect(); return r.bottom > s.pages[0].wrap.getBoundingClientRect().bottom; });
  assert.ok(hangs, 'the box reaches past the foot of the page (the case being checked)');
  assert.deepEqual(await covered(page), [], 'nothing on the next page covers the box');
  // Inside the window.
  const inView = await page.evaluate(() => { const r = document.querySelector('.pop').getBoundingClientRect(), P = document.querySelector('#paper').getBoundingClientRect(); return r.top >= P.top && r.bottom <= P.bottom; });
  assert.ok(inView, 'the whole box is in sight');
  await page.keyboard.type('Say more.');
  // A saved comment low in the box adds its words; the box stays open.
  await page.click('.pop .chip[data-i="3"] > span');
  assert.ok(await page.$('.pop'), 'pressing a saved comment keeps the box open');
  assert.equal(await page.$eval('.pop textarea', t => t.value), 'Say more. Good use of evidence.');
  await page.click('.pop [data-nc="blue"]');
  assert.ok(await page.$('.pop'), 'pressing a color keeps the box open');
  await page.click('.pop [data-a="ok"]');
  assert.equal(await page.$('.pop'), null);
  const marks = await page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().pages.map(p => p.marks()))));
  assert.equal(marks[0].length, 1, 'the comment is kept on page 1');
  assert.equal(marks[0][0].text, 'Say more. Good use of evidence.');
  assert.equal(marks[0][0].color, '#1F5FD1');
  assert.equal(marks[1].length, 0, 'nothing landed on page 2');
  assert.equal(await page.evaluate(() => document.querySelector('.pg').matches(':has(>.pop)')), false, 'the page goes back to its place once the box closes');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a comment box on a page that is not counted (faded) is still on top of the next page', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.bank': JSON.stringify(SAVED) } } });
  await open(page);
  // Faded pages have their own layer; the box must still win over the page after.
  await page.evaluate(() => { for (const p of window.__gs.state().pages) p.wrap.style.opacity = '.75'; });
  await page.evaluate(() => window.__gs.setTool('note'));
  const p = await at(page, 0, 300, 772);
  await page.mouse.click(p.x, p.y);
  await page.waitForSelector('.pop .chip');
  assert.deepEqual(await covered(page), [], 'nothing on the next page covers the box');
  await page.keyboard.press('Escape');
  assert.deepEqual(page.errors, []);
  await close();
});
