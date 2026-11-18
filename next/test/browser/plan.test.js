// The planning screens in a real browser (stage 3): the Calendar's three views, a class's Course line and a lesson's page, with
// made-up work (planseed.js) at the stopped clock. A lesson planned here is one the current Planner opens as its own; marking a
// lesson ready and presenting it work from the keyboard; every word comes through t(); and the presses at rest are counted.
// npm run next:browser.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { plantPlan } = require('./planseed.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2))$/.test(p);
    const f = path.join(ROOT, p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}

let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

async function fresh(width = 1366) {
  const ctx = await browser.createBrowserContext(), p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width, height: width < 700 ? 844 : 900 });
  await p.goto(srv.url + 'blank');
  await plant(p, gradingSeed()); await plantPlan(p);
  p.errors = errors; p.ctx = ctx; return p;
}
const open = async (p, hash, keys) => {
  await p.goto(srv.url + 'next/' + (keys ? '?keys=1' : '') + '#/' + hash);
  await p.waitForSelector('[data-shell-nav], nav.tabbar', { timeout: 20000 });
  await p.waitForFunction(() => !document.querySelector('main .loading'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 300));
};
const lessonInDb = (p, id) => p.evaluate(id => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('lessons').objectStore('lessons').get(id); q.onsuccess = () => { r.result.close(); res(q.result || null); }; q.onerror = () => rej(q.error); }; r.onerror = () => rej(r.error); }), id);
const SCREENS = ['calendar/class', 'calendar/time', 'calendar/month', 'class/c1', 'lesson/L2', 'lesson/L2/slides', 'lesson/L2/edit'];

test('the planning screens show the made-up week: lessons in their classes, the units, and today', async () => {
  const p = await fresh();
  await open(p, 'calendar/class');
  const cards = await p.$$eval('main a.lc', a => a.map(x => x.textContent));
  for (const title of ['Stressed words in a poem', 'Reading a poem aloud', 'Sonnets: the turn', 'Unreliable narrators', 'Point of view, again']) assert.ok(cards.some(c => c.includes(title)), title + ' is on the week');
  assert.ok(await p.$('main [data-plan="A2|2026-10-28"]'), 'an empty period offers to plan a lesson');
  await open(p, 'calendar/month');
  assert.ok((await p.$eval('main', m => m.textContent)).includes('Unit 2: Poetry'), 'the month shows the unit under way');
  await open(p, 'class/c1');
  const line = await p.$eval('main', m => m.textContent);
  assert.ok(line.includes('Unit 2: Poetry') && line.includes('Reading a poem aloud'), 'the Course line shows this unit and its lessons');
  await open(p, 'lesson/L2');
  assert.equal(await p.$eval('main h1', h => h.textContent), 'Reading a poem aloud');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('a lesson planned in the new app is one the current Planner opens as its own, with the same slides and classes', async () => {
  const p = await fresh();
  await open(p, 'class/c1');
  await p.click('main [data-plan="A1|2026-11-02"]');
  await p.waitForFunction(() => /^#\/lesson\/[^/]+$/.test(location.hash) && !/L\d$/.test(location.hash), { timeout: 10000 });
  const id = await p.evaluate(() => location.hash.split('/')[2]);
  const mine = await lessonInDb(p, id);
  assert.ok(mine, 'the lesson is saved');
  assert.deepEqual(mine.slots.map(s => s.classId + ' ' + s.date).sort(), ['A1 2026-11-02', 'A2 2026-11-02'], 'it goes to the class and the section that shares its lessons that day');
  assert.ok(mine.slides.length >= 2 && mine.slides[1].layout === 'agenda', 'it starts with a title slide and the agenda on slide 2');
  // The current Planner, opened on the same saved work, reads it without changing it.
  await p.goto(srv.url + 'planner.html');
  await p.waitForFunction(id => { const P = window.__planner; return P && Array.isArray(P.L.lessons) && P.L.lessons.some(l => l.id === id); }, { timeout: 20000 }, id);
  const theirs = await p.evaluate(id => JSON.parse(JSON.stringify(window.__planner.L.lessons.find(l => l.id === id))), id);
  for (const k of ['title', 'slots', 'slides', 'fmt']) assert.deepEqual(theirs[k], mine[k], k + ' reads the same in the current Planner');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('keyboard: mark a lesson ready, move through its slides, and present it', async () => {
  const p = await fresh();
  await open(p, 'lesson/L3');
  await p.click('main [role=radiogroup] [data-v="ready"]');
  await p.waitForFunction(() => document.querySelector('main [role=radiogroup] [data-v="ready"]').getAttribute('aria-checked') === 'true');
  const l3 = await lessonInDb(p, 'L3');
  assert.ok(l3.ready && l3.ready.at > 0, 'ready is saved the way the current Planner keeps it');
  await open(p, 'lesson/L3/slides');
  const num = () => p.$eval('main .svbar .num', x => x.textContent);
  assert.equal(await num(), 'Slide 1 of 5');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  assert.equal(await num(), 'Slide 3 of 5', 'arrow keys move between slides');
  await p.keyboard.press('F5');
  await p.waitForSelector('.present');
  await p.waitForFunction(() => document.activeElement && document.activeElement.matches('.present'), { timeout: 5000 });
  assert.equal(await p.$eval('.present .num', x => x.textContent), 'Slide 3 of 5', 'Present starts on the slide in view');
  await p.keyboard.press('End');
  assert.equal(await p.$eval('.present .num', x => x.textContent), 'Slide 5 of 5');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('.present'));
  assert.equal(await num(), 'Slide 5 of 5', 'ending Present keeps the slide reached');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('every word on the planning screens comes through t() or is the teacher’s own text, and presses at rest are counted', async () => {
  const counts = {};
  for (const w of [1366, 390]) {
    const p = await fresh(w);
    for (const hash of SCREENS) {
      await open(p, hash, true);
      const loose = await p.evaluate(() => {
        const bad = [], ok = s => !/[A-Za-z]/.test(s.replace(/⟦[^⟧]*⟧/g, ''));
        const skip = el => el.closest('[data-raw],code,script,style,svg,kbd,.gic');
        const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n; (n = tw.nextNode());) { if (!n.nodeValue.trim() || skip(n.parentElement)) continue; if (!ok(n.nodeValue)) bad.push(n.nodeValue.trim()); }
        for (const el of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]')) for (const a of ['aria-label', 'title', 'placeholder', 'alt']) { const v = el.getAttribute(a); if (v && !skip(el) && !ok(v)) bad.push(a + '=' + v); }
        return bad;
      });
      assert.deepEqual(loose, [], 'words not from t() on ' + hash + ' at ' + w + ' px');
      if (w > 700) counts[hash] = await p.evaluate(() => [...document.querySelectorAll('main a[href], main button:not([disabled]), main input, main select, main textarea, main [tabindex="0"]')]
        .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && el.getAttribute('tabindex') !== '-1'; }).length);
    }
    assert.deepEqual(p.errors, [], 'errors at ' + w + ' px'); await p.ctx.close();
  }
  console.log('# presses at rest (first screen, 1366 px): ' + JSON.stringify(counts));
  for (const [hash, n] of Object.entries(counts)) assert.ok(n < 25, hash + ' has ' + n + ' presses at rest; the brief asks for under 25');
});

test('the editor: words saved as typed, a slide added, too much text split onto a new slide, comments and an after-class note kept', async () => {
  const p = await fresh();
  await open(p, 'lesson/L3/edit');
  await p.$eval('main .ed-top input', el => { el.focus(); el.select(); });
  await p.keyboard.type('Sonnets: where it turns');
  const saved = async (f, what) => { for (let k = 0; k < 40; k++) { const l = await lessonInDb(p, 'L3'); if (f(l)) return l; await new Promise(r => setTimeout(r, 150)); } assert.fail(what + ' was not saved'); };
  await saved(l => l.title === 'Sonnets: where it turns', 'the title');
  await p.click('main [data-focus="add-slide"]');
  let l = await saved(l => l.slides.length === 6, 'the new slide');
  assert.equal(l.slides[1].layout, 'content', 'the slide added after the one in view is the deck’s usual layout');
  assert.equal(await p.$eval('main .ed-bar .num', x => x.textContent), 'Slide 2 of 6');
  // Twenty lines are more than fit at 28 pt: the warning offers to move the extra lines, and the text is never made smaller.
  await p.$eval('main .ed-form textarea', el => el.focus());
  await p.keyboard.type(Array.from({ length: 20 }, (_, k) => 'Line ' + (k + 1)).join('\n'));
  await p.waitForSelector('main .ed-warn button', { timeout: 5000 });
  await saved(l => l.slides[1].body.split('\n').length === 20, 'the long text');
  await p.click('main .ed-warn button');
  l = await saved(l => l.slides.length === 7, 'the split');
  assert.ok(l.slides[1].body.split('\n').length < 20 && l.slides[2].body.startsWith('Line '), 'the extra lines are on the next slide');
  assert.equal(l.slides[1].size, 28, 'the text size is unchanged');
  assert.match(l.slides[2].title, /\(continued\)$/);
  // A comment on the slide.
  await p.click('main .ed-form .talk button');
  await p.waitForFunction(() => document.activeElement && document.activeElement.matches('.talk textarea'), { timeout: 5000 });
  await p.keyboard.type('Add a picture of a sonnet here');
  await p.click('main .ed-form .talk .row button:last-child');
  l = await saved(l => (l.slides[1].talk || []).length === 1, 'the slide comment');
  assert.deepEqual({ by: l.slides[1].talk[0].by, text: l.slides[1].talk[0].text }, { by: 'you', text: 'Add a picture of a sonnet here' });
  // After class, on a lesson whose day has come: the note goes on the class's place in "taught".
  await open(p, 'lesson/L2');
  await p.$eval('main .lside .after textarea', el => el.focus());
  await p.keyboard.type('Got to slide 4. Start with the exit ticket.');
  await p.$eval('main .lside .after textarea', el => el.blur());
  const two = await (async () => { for (let k = 0; k < 40; k++) { const x = await lessonInDb(p, 'L2'); if (x.taught) return x; await new Promise(r => setTimeout(r, 150)); } return null; })();
  assert.ok(two, 'the note is saved');
  assert.deepEqual(two.taught.map(x => [x.classId, x.date, x.note]), [['A1', '2026-10-27', 'Got to slide 4. Start with the exit ticket.']]);
  // The current Planner reads the edited lesson as written.
  await p.goto(srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && P.L.lessons.some(l => l.id === 'L3' && l.slides.length === 7); }, { timeout: 20000 });
  assert.deepEqual(p.errors, []); await p.ctx.close();
});
