// Stage 6, help inside the app: short answers on a Help page of their own, and every one reachable from Find anything on
// both pages. The answers are part of the page, so nothing is fetched and nothing is stored.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('./helpers/chrome');
const { ROOT, builtHtml, openApp, goTo } = require('./helpers/app');

let browser;
before(async () => { builtHtml(); browser = await launch(); });
after(async () => { await browser.close(); });

const until = async (page, fn, arg, ms = 5000) => { for (const t0 = Date.now(); ;) { if (await page.evaluate(fn, arg)) return; if (Date.now() - t0 > ms) throw new Error('waited too long for ' + fn); await new Promise(r => setTimeout(r, 50)); } };
const stored = page => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
const openOnes = page => page.$$eval('#hlpList .hlpq.on', els => els.map(e => e.id.replace('hlp-', '')));

test('every answer is short, in plain words, belongs to a section and sends her to a real screen', async () => {
  const { page, close } = await openApp(browser);
  const topics = await page.evaluate(() => window.__gs.helpTopics());
  assert.ok(topics.length >= 35, 'a useful number of answers');
  assert.equal(new Set(topics.map(t => t.id)).size, topics.length, 'each has its own address');
  const secs = await page.evaluate(() => { window.__gs.go('#/help'); return [...document.querySelectorAll('#hlpList .hlpsec h2')].map(h => h.textContent); });
  assert.deepEqual(secs, ['Getting started', 'Marking a paper', 'Scores and rubrics', 'Handing work back', 'Classes and the gradebook', 'Saving and safety', 'Planning and teaching', 'Privacy']);
  assert.equal(await page.$$eval('#hlpList .hlph', b => b.length), topics.length, 'every answer is on the page');
  for (const t of topics) {
    assert.match(t.id, /^[a-z0-9-]+$/);
    assert.match(t.q, /\?$/, t.id + ' is asked as a question');
    assert.ok(t.a.length >= 1 && t.a.length <= 4, t.id + ' is a few sentences, not a manual');
    for (const p of t.a) assert.ok(p.length <= 330, t.id + ' has a long paragraph: ' + p.length);
    const all = t.q + ' ' + t.a.join(' ');
    assert.ok(!/[—–]/.test(all), t.id + ' uses a dash');
    assert.equal((all.match(/ManageBac|Atlas|12EL|11EL|12-point/i) || [null])[0], null, t.id + ' names one teacher’s school system or classes');
    if (t.go) assert.notEqual(await page.evaluate(h => h === '#/' ? 'home!' : window.__gs.routeOf(h).v, t.go[1]), 'home', t.id + ' points at a screen that is not there');
  }
  assert.deepEqual(page.errors, []);
  await close();
});

test('the Help page: a link in the sidebar, answers that open and close, and one answer by its address', async () => {
  const { page, close } = await openApp(browser);
  const before = await stored(page);
  await page.click('#rail [data-nav="help"]');
  await until(page, () => !document.querySelector('#vHelp').hidden);
  assert.equal(await page.evaluate(() => location.hash), '#/help');
  assert.equal(await page.$eval('#rail [data-nav="help"]', a => a.getAttribute('aria-current')), 'page');
  assert.equal(await page.title(), 'Help · Grading Studio');
  assert.deepEqual(await openOnes(page), [], 'all closed to start with');
  // an answer opens with a click or with the keyboard, and says so to a screen reader
  await page.click('[data-hlp="open-work"]');
  assert.deepEqual(await openOnes(page), ['open-work']);
  assert.equal(await page.$eval('[data-hlp="open-work"]', b => b.getAttribute('aria-expanded')), 'true');
  assert.match(await page.$eval('#hlpa-open-work', e => e.innerText), /drop the ZIP anywhere on Today/);
  assert.equal(await page.$eval('#hlpa-open-work b', e => e.textContent), 'Today', 'the names of buttons are bold');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.hlp), 'open-work', 'the keyboard stays on the question');
  await page.keyboard.press('Enter');
  assert.deepEqual(await openOnes(page), []);
  assert.equal(await page.$eval('#hlpa-open-work', e => e.hidden), true);
  // steps are numbered
  await goTo(page, '#/help/other-computer');
  assert.deepEqual(await openOnes(page), ['other-computer']);
  assert.equal(await page.$$eval('#hlpa-other-computer ol li', l => l.length), 3);
  assert.equal(await page.evaluate(() => { const r = document.querySelector('#hlp-other-computer').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }), true, 'it is brought into view');
  // its button goes to the screen it talks about
  await page.click('#hlpa-other-computer .hlpgo a');
  await until(page, () => !document.querySelector('#vSettings').hidden);
  assert.equal(await page.evaluate(() => window.__gs.routeNow().sec), 'saving');
  await page.goBack();
  await until(page, () => !document.querySelector('#vHelp').hidden);
  // an address for an answer that is not there is just Help
  await goTo(page, '#/help/no-such-answer');
  assert.equal(await page.$eval('#vHelp', e => e.hidden), false);
  // a refresh comes back to the same answer
  await goTo(page, '#/help/rubric');
  await page.reloadHere(); await until(page, () => window.__gs && !document.querySelector('#vHelp').hidden && document.querySelector('#hlp-rubric.on'));
  assert.equal(await stored(page), before, 'reading help stores nothing');
  assert.deepEqual(page.errors, []);
  await close();
});

test('searching help: every word typed has to be in the answer, and words a teacher might use instead count', async () => {
  const { page, close } = await openApp(browser);
  await goTo(page, '#/help');
  const ask = async q => { await page.$eval('#hlpIn', (e, q) => { e.value = q; e.dispatchEvent(new Event('input', { bubbles: true })); }, q); return page.$$eval('#hlpList .hlph', b => b.map(x => x.dataset.hlp)); };
  assert.ok((await ask('usb')).includes('other-computer'), '“usb” is not in the answer, but it is what she might type');
  assert.deepEqual(await ask('passphrase take'), ['other-computer']);
  assert.match(await page.$eval('#hlpList h2', e => e.textContent), /^1 answer$/);
  assert.deepEqual(await ask('zzzz'), []);
  assert.match(await page.$eval('#hlpList', e => e.innerText), /No answer matches “zzzz”/);
  await page.focus('#hlpIn'); await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#hlpIn', e => e.value), '');
  assert.ok(await page.$$eval('#hlpList .hlpsec', s => s.length) > 5, 'Escape brings every section back');
  await close();
});

test('Find anything answers a question: typed words find the answer and Enter opens it', async () => {
  const { page, close } = await openApp(browser);
  // with nothing typed, the list is not buried under forty questions
  assert.deepEqual(await page.evaluate(() => { window.__gs.openFind(); return [...document.querySelectorAll('#findList .fcap')].map(e => e.textContent).filter(t => t === 'Help'); }), []);
  assert.ok(await page.$$eval('#findList .frow b', b => b.some(x => x.textContent === 'Help')), 'Help itself is a place to go');
  await page.type('#findIn', 'move another computer');
  assert.deepEqual(await page.$$eval('#findList .frow b', b => b.map(x => x.textContent)), ['How do I move my work to another computer?', 'How do I move a lesson to another computer or give it to another teacher?']);   // the whole of one's work first, then one lesson
  assert.equal(await page.$eval('#findList .fcap', e => e.textContent), 'Help');
  await page.keyboard.press('Enter');
  await until(page, () => !document.querySelector('#vHelp').hidden && document.querySelector('#hlp-other-computer.on'));
  assert.equal(await page.evaluate(() => location.hash), '#/help/other-computer');
  // a word only in an answer's other words
  await page.evaluate(() => window.__gs.openFind()); await page.type('#findIn', 'gdpr');
  assert.deepEqual(await page.$$eval('#findList .frow b', b => b.map(x => x.textContent)), ['Does student work leave my computer?']);
  await page.keyboard.press('Escape');
  // a real thing with the same word comes before the answer about it
  await page.evaluate(() => window.__gs.openFind()); await page.type('#findIn', 'settings');
  assert.equal(await page.$eval('#findList .fcap', e => e.textContent), 'Go to');
  await close();
});

test('the Planner has the same Help link, and its Find anything opens an answer on the grading page', async () => {
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0], file = p === '/' || p === '/index.html' ? 'index.html' : p === '/planner.html' ? 'planner.html' : null;
    if (!file && p !== '/blank') { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(file ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '<!doctype html><title>blank</title>');
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const url = 'http://localhost:' + srv.address().port + '/', ctx = await browser.createBrowserContext();
  try {
    const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(String(e)));
    await page.goto(url + 'planner.html');
    await page.waitForFunction(() => window.__planner && document.querySelector('#rail [data-gs="#/help"]'));
    assert.match(await page.$eval('#rail [data-gs="#/help"]', a => a.getAttribute('href')), /#\/help$/);
    assert.equal(await page.$eval('#rail [data-gs="#/help"]', a => a.innerText.trim()), 'Help');
    await page.click('#findBtn'); await page.waitForSelector('#findIn');
    assert.equal(await page.$$eval('#findList .fcap', c => c.some(e => e.textContent === 'Help')), false);
    await page.type('#findIn', 'projector');
    assert.equal(await page.$eval('#findList .frow b', b => b.textContent), 'How do I present a lesson to the class?');
    await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
    await page.waitForFunction(() => window.__gs && document.querySelector('#hlp-present.on'));
    assert.equal(await page.evaluate(() => location.hash), '#/help/present');
    assert.match(await page.$eval('#hlpa-present .hlpgo a', a => a.getAttribute('href')), /planner\.html$/i, 'a Planner answer offers the Planner');
    assert.deepEqual(page.errors, []);
  } finally { await ctx.close(); srv.closeAllConnections(); await new Promise(r => srv.close(r)); }
});
