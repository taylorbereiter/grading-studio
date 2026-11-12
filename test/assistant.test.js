// The AI assistant's name is the teacher's: "Claude" only for a browser that had it before, none for a new one. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, goTo } = require('./helpers/app');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });
const said = page => page.evaluate(() => ({ name: window.__gs.aiName(), say: window.__gs.aiSay(), tag: window.__gs.aiTag(), link: window.__gs.aiLink(), share: document.querySelector('#shareBtn').textContent, back: document.querySelector('#backBtn').textContent }));
const lib = page => page.evaluate(() => JSON.parse(localStorage.getItem('gs.lib') || 'null'));

test('a browser from before reads as Claude, and nothing is written for it', async () => {
  const { page, close } = await openApp(browser);
  const s = await said(page);
  assert.deepEqual(s, { name: 'Claude', say: 'Claude', tag: 'Claude', link: 'https://claude.ai/new', share: 'Share with Claude', back: 'Bring back from Claude' });
  await goTo(page, '#/settings/claude');
  await page.waitForSelector('#meAi');
  assert.equal(await page.$eval('#meAi', e => e.value), 'Claude');
  assert.equal((await lib(page)).me, undefined, 'looking at Settings stores nothing');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.words')), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a new teacher has no assistant named until they choose one, and the words follow', async () => {
  const { page, close } = await openApp(browser, { newTeacher: true });
  await page.evaluate(() => { for (let i = 0; i < 3; i++) document.querySelector('#welcome [data-wlnext]').click(); });
  let s = await said(page);
  assert.equal(s.name, ''); assert.equal(s.say, 'your AI assistant'); assert.equal(s.tag, 'AI'); assert.equal(s.link, '');
  assert.equal(s.share, 'Share with your AI assistant');
  assert.equal(await page.evaluate(() => /Claude/.test(document.body.innerText)), false, 'Claude is not named anywhere on Home');
  await goTo(page, '#/settings/claude');
  await page.waitForSelector('#meAi');
  assert.equal(await page.evaluate(() => /Claude/.test(document.querySelector('#setPane').innerText.replace(/\n(Claude|ChatGPT|Gemini|Copilot)/g, ''))), false);
  await page.select('#meAi', 'ChatGPT');
  await page.waitForFunction(() => window.__gs.aiName() === 'ChatGPT');
  s = await said(page);
  assert.equal(s.share, 'Share with ChatGPT'); assert.equal(s.back, 'Bring back from ChatGPT'); assert.equal(s.link, 'https://chatgpt.com/');
  assert.equal((await lib(page)).me.ai, 'ChatGPT');
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('gs.words'))).ai, 'ChatGPT', 'the Planner is told');
  await page.select('#meAi', 'other');
  await page.waitForSelector('#meAiOther');
  await page.$eval('#meAiOther', e => { e.value = 'School Helper'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => window.__gs.aiName() === 'School Helper');
  s = await said(page);
  assert.equal(s.share, 'Share with School Helper'); assert.equal(s.link, '', 'no Open button for an assistant the app does not know');
  await page.select('#meAi', '');
  await page.waitForFunction(() => window.__gs.aiName() === '');
  assert.equal((await said(page)).share, 'Share with your AI assistant');
  assert.deepEqual(page.errors, []);
  await close();
});
