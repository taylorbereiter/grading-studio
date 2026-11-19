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
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p);
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
const SCREENS = ['calendar/class', 'calendar/time', 'calendar/month', 'calendar/semester', 'class/c1', 'lesson/L2', 'lesson/L2/slides', 'lesson/L2/edit', 'library', 'library/past', 'library/units', 'library/rubrics'];

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

test('Present: the class tools on their keys, a slide by number, and Esc closing one thing at a time', async () => {
  const p = await fresh();
  await open(p, 'lesson/L3/slides');
  await p.keyboard.press('F5');
  await p.waitForSelector('.present');
  await p.waitForFunction(() => document.activeElement && document.activeElement.matches('.present'), { timeout: 5000 });
  const num = () => p.$eval('.present .num', x => x.textContent);
  await p.keyboard.press('4'); await p.keyboard.press('Enter');
  assert.equal(await num(), 'Slide 4 of 5', 'a number then Enter goes to that slide');
  await p.keyboard.press('Backspace');
  assert.equal(await num(), 'Slide 3 of 5', 'Backspace goes back');
  await p.keyboard.press('n');
  await p.waitForSelector('.prpanel.pr-notes');
  await p.keyboard.press('t');
  await p.waitForSelector('.prpanel.pr-timer');
  await p.keyboard.press('3');
  await p.waitForFunction(() => /^[23]:\d\d$/.test(document.querySelector('.prtimer b').textContent));
  await p.keyboard.press('+');
  await p.waitForFunction(() => /^[34]:\d\d$/.test(document.querySelector('.prtimer b').textContent));
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('.prpanel') && document.querySelector('.prclock'));
  await p.keyboard.press('g');
  await p.waitForSelector('.prpanel.pr-groups');
  await p.keyboard.press('b');
  await p.waitForSelector('.present.blank');
  assert.equal(await p.$('.present .slidebox, .present .prpanel'), null, 'a blank screen shows nothing');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('.present.blank') && document.querySelector('.prpanel.pr-groups'));
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('.prpanel'));
  assert.ok(await p.$('.present'), 'Esc closes what is open before it ends');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('.present'));
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('Present: W puts the class screen in its own window, kept in step, with the keys working in either window', async () => {
  const p = await fresh();
  await open(p, 'lesson/L3/slides');
  await p.keyboard.press('F5');
  await p.waitForSelector('.present');
  await p.waitForFunction(() => document.activeElement && document.activeElement.matches('.present'), { timeout: 5000 });
  const num = () => p.$eval('.present .num', x => x.textContent);
  const got = p.ctx.waitForTarget(x => x.type() === 'page' && x !== p.target(), { timeout: 10000 });
  await p.keyboard.press('w');
  const w = await (await got).page();
  await w.waitForSelector('#fit .ls-slide');
  await p.waitForSelector('.prpanel.pr-notes');
  const shown = () => w.$eval('#fit', x => x.textContent.trim());
  const first = await shown();
  await p.keyboard.press('ArrowRight');
  assert.equal(await num(), 'Slide 2 of 5');
  await w.waitForFunction(was => document.getElementById('fit').textContent.trim() !== was, {}, first);
  await w.keyboard.press('ArrowRight');
  await p.waitForFunction(() => document.querySelector('.present .num').textContent === 'Slide 3 of 5');
  await p.keyboard.press('b');
  await w.waitForFunction(() => !document.querySelector('#fit .ls-slide'));
  await p.keyboard.press('Escape');
  await w.waitForSelector('#fit .ls-slide');
  await p.keyboard.press('w');
  await p.waitForFunction(() => !document.querySelector('[aria-label="Close the class screen window"]'));
  assert.ok(w.isClosed(), 'W again closes it');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('every word on the planning screens comes through t() or is the teacher’s own text, and presses at rest are counted', async () => {
  const counts = {};
  for (const w of [1366, 390]) {
    const p = await fresh(w);
    for (const hash of [...SCREENS, 'settings/timetable']) {
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
      if (w > 700 && SCREENS.includes(hash)) counts[hash] = await p.evaluate(() => [...document.querySelectorAll('main a[href], main button:not([disabled]), main input, main select, main textarea, main [tabindex="0"]')]
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
  await p.click('main .ed-form .rtbox');
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

test('the assistant: the lesson copied as one self-contained message, the .zip back looked at slide by slide, then kept', async () => {
  const p = await fresh();
  await p.ctx.overridePermissions(srv.url.replace(/\/$/, ''), ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  await open(p, 'lesson/L2');
  await p.click('main [data-focus="assistant"]');
  await p.waitForSelector('[data-focus="copy-brief"]');
  await p.click('[data-focus="copy-brief"]');
  await p.waitForFunction(async () => (await navigator.clipboard.readText()).length > 500, { timeout: 5000, polling: 200 });
  const brief = await p.evaluate(() => navigator.clipboard.readText());
  assert.match(brief, /Don't look for, open or ask for any folder or file on my computer/);
  assert.match(brief, /# Reading a poem aloud/); assert.match(brief, /lesson\.json/); assert.match(brief, /Unit 2: Poetry/);
  assert.doesNotMatch(brief, /\/Users\/|~\/|[A-Z]:\\|\.lesson\.json|Lessons\//, 'it names no folder, path or file on the computer');
  // What the assistant sends back: slide 3 reworded, one new slide, a handout.
  const fflate = require('fflate');
  const slides = [{ layout: 'title', title: 'Reading a poem aloud' }, { layout: 'agenda', title: '10/27 Agenda', body: '1. Warm-up\n2. Read in pairs\n3. Exit ticket' },
    { layout: 'content', title: 'Warm-up', body: '• Read the poem twice in your head\n• Mark two words you would stress', notes: 'Two minutes, silent.' },
    { layout: 'discuss', title: 'Let’s talk', body: 'Which word carries the poem?', foot: 'Think · Pair · Share' }, { layout: 'exit', title: 'Exit ticket', tag: 'On a sticky note', body: 'One word, and why.' },
    { layout: 'content', title: 'If there is time', body: '• Read it to a partner' }];
  const zip = fflate.zipSync({ 'lesson.json': fflate.strToU8(JSON.stringify({ kind: 'grading-studio-lesson-zip', lesson: { title: 'Reading a poem aloud', slides }, preview: 'preview.pptx', materials: ['handout.pdf'] })), 'handout.pdf': fflate.strToU8('%PDF-1.4 made up') });
  const f = path.join(require('os').tmpdir(), 'gs-plan-test-' + process.pid + '.zip'); fs.writeFileSync(f, zip);
  const input = await p.$('input[data-zip]'); await input.uploadFile(f);
  await p.waitForSelector('[data-focus="keep-changes"]', { timeout: 10000 }); fs.unlinkSync(f);
  assert.equal(await p.$$eval('.review li.ch', x => x.length), 2, 'the changed slide and the new one are marked');
  await p.click('[data-focus="keep-changes"]');
  const l = await (async () => { for (let k = 0; k < 40; k++) { const x = await lessonInDb(p, 'L2'); if (x.slides.length === 6) return x; await new Promise(r => setTimeout(r, 150)); } return null; })();
  assert.ok(l, 'the changes are kept');
  assert.equal(l.slides[2].body.split('\n')[0], '• Read the poem twice in your head');
  assert.equal(l.slides[2].id, 'L2s2', 'a slide keeps its place’s id');
  assert.equal(l.files.length, 1); assert.equal(l.files[0].name, 'handout.pdf');
  const kept = await p.evaluate(id => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const s = r.result.transaction('kv').objectStore('kv'), out = {}; const a = s.get('file:' + id), b = s.get('ver:L2'); b.onsuccess = () => { out.file = !!a.result; out.vers = (b.result || []).length; out.before = b.result && b.result[0].lesson.slides.length; r.result.close(); res(out); }; }; }), l.files[0].id);
  assert.deepEqual(kept, { file: true, vers: 1, before: 5 }, 'the handout is kept and the lesson as it was is under Versions');
  await p.goto(srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && P.L.lessons.some(l => l.id === 'L2' && l.slides.length === 6); }, { timeout: 20000 });
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('a strong example goes on a slide by reference: drawn from the marking side here, never copied, and the current Planner opens the lesson', async () => {
  const p = await fresh();
  // A made-up example kept while marking: a drawn picture, no student in it.
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#ddeeff'; g.fillRect(0, 0, 400, 300); g.fillStyle = '#123'; g.fillRect(40, 40, 320, 20);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg'));
    const db = await new Promise((res, rej) => { const r = indexedDB.open('grading-studio-examples', 1); r.onupgradeneeded = () => { r.result.createObjectStore('ex'); r.result.createObjectStore('pix'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise(res => { const tx = db.transaction(['ex', 'pix'], 'readwrite');
      tx.objectStore('ex').put({ id: 'EX1', t: 1792000000000, kind: 'paper', title: 'Poetry analysis', letter: 'A', from: 'made-up', why: 'Clear claim', tags: [], pages: [{}] }, 'EX1');
      tx.objectStore('pix').put(blob, 'EX1|0'); tx.oncomplete = res; });
    db.close();
  });
  await open(p, 'lesson/L5/edit');
  await p.click('main .ed-list li:nth-child(5) button'); // the exit ticket, made a picture slide
  await p.select('main .ed-form select[data-focus="layout"]', 'picture');
  await p.waitForSelector('main [data-focus="add-example"]');
  await p.click('main [data-focus="add-example"]');
  await p.waitForSelector('.excard');
  const card = await p.$eval('.excard', x => x.textContent);
  assert.ok(card.includes('Example A') && !card.includes('made-up'), 'named as grading names it, never whose it was');
  await p.click('.excard'); await p.click('[data-focus="use-example"]');
  const l = await (async () => { for (let k = 0; k < 40; k++) { const x = await lessonInDb(p, 'L5'); if (x.slides[4].img) return x; await new Promise(r => setTimeout(r, 150)); } return null; })();
  assert.deepEqual(l.slides[4].img, { src: 'gsex:EX1|0', w: 400, h: 300, source: '' }, 'the lesson keeps only the reference');
  await p.waitForFunction(() => [...document.querySelectorAll('main .ed-stage .ls-pic img')].some(i => i.src.startsWith('blob:') && i.naturalWidth === 400), { timeout: 5000 });
  // The current Planner opens it, draws the slide with an empty picture, and keeps the reference.
  await p.goto(srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && P.L.lessons.some(l => l.id === 'L5'); }, { timeout: 20000 });
  const there = await p.evaluate(() => { const P = window.__planner, l = P.L.lessons.find(x => x.id === 'L5'); P.openLessonForTest(l, 4); return { src: l.slides[4].img.src, pic: !!document.querySelector('.ls-pic') }; });
  assert.deepEqual(there, { src: 'gsex:EX1|0', pic: true });
  await new Promise(r => setTimeout(r, 500));
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('Settings > Timetable: a class renamed and recoloured, a meeting and a day off added, kept as the current Planner keeps its setup', async () => {
  const p = await fresh();
  await open(p, 'settings/timetable');
  await p.waitForSelector('main .ttset input');
  await p.$eval('main .ttset .card input', el => { el.focus(); el.select(); });
  await p.keyboard.type('Grade 9 English A');
  await p.click('main .ttset .card .ccsw button:nth-child(3)');
  await p.$eval('main .ttset .card', c => [...c.querySelectorAll(':scope > div > div > button, :scope button')].find(b => b.textContent === 'Add a time').click());
  const dayOff = (await p.$$('main .ttset .dlist'))[0];
  await (await dayOff.$(':scope > div:last-child button')).click();
  const rows = await dayOff.$$('.drow');
  const inputs = await rows[1].$$('input');
  await inputs[0].type('12252026'); await inputs[1].type('Winter break');
  // A made-up school template: only the two layouts the slides go in
  const fflate = require('fflate'), L = n => fflate.strToU8('<p:sldLayout><p:cSld name="' + n + '"></p:cSld></p:sldLayout>');
  const tpl = path.join(require('os').tmpdir(), 'gs-plan-tpl-' + process.pid + '.pptx');
  fs.writeFileSync(tpl, fflate.zipSync({ 'ppt/presentation.xml': fflate.strToU8('<p:presentation/>'), 'ppt/slideLayouts/slideLayout1.xml': L('Title Slide'), 'ppt/slideLayouts/slideLayout2.xml': L('Title and Content') }));
  await (await p.$('main input[data-tpl]')).uploadFile(tpl);
  await p.waitForFunction(() => /Your own/.test(document.querySelector('main .ttset [role=status]').textContent));
  fs.unlinkSync(tpl);
  await p.click('main [data-focus="save-timetable"]');
  const readSetup = () => p.evaluate(() => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('setup'); q.onsuccess = () => { r.result.close(); res(q.result); }; }; }));
  let setup = null;
  for (let k = 0; k < 40 && !setup; k++) { const s = await readSetup(); if (s.classes[0].name === 'Grade 9 English A') setup = s; else await new Promise(r => setTimeout(r, 150)); }
  assert.ok(setup, 'the setup is saved');
  assert.equal(setup.classes[0].color, '#B71E42');
  assert.equal(setup.classes[0].meets.length, 4);
  assert.deepEqual(setup.daysOff.map(x => x.label), ['Staff training day', 'Winter break']);
  assert.equal(setup.classes[0].id, 'A1', 'the class keeps its id, so its lessons stay its own');
  assert.ok(setup.template.length > 100 && /^gs-plan-tpl-/.test(setup.tplName), 'the template is kept as base64 with its name');
  await p.goto(srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && P.L.setup && P.L.setup.classes[0].name === 'Grade 9 English A'; }, { timeout: 20000 });
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('Library: an activity found and filtered, one of my own saved, an activity put in a lesson as a slide; past lessons, units and the bank', async () => {
  const p = await fresh();
  await open(p, 'library');
  const n = () => p.$eval('main .libpanel [role=status]', x => x.textContent);
  const all = await n();
  await p.$eval('main [data-focus="find-activity"]', el => el.focus());
  await p.keyboard.type('jigsaw');
  await p.waitForFunction(() => document.querySelectorAll('main .actlist > li').length === 1);
  await p.$eval('main [data-focus="find-activity"]', el => { el.focus(); el.select(); });
  await p.keyboard.press('Backspace');
  await p.waitForFunction(a => document.querySelector('main .libpanel [role=status]').textContent === a, {}, all);
  const chip = async (group, i) => { const g = (await p.$$('main .chips'))[group]; await (await g.$$('button'))[i].click(); };
  await chip(0, 1); await chip(1, 1);   // Warm-up, Discussion
  const names = await p.$$eval('main .actlist .acth b', b => b.map(x => x.textContent));
  assert.ok(names.length > 0 && names.length < 40 && names.includes('Think, pair, share'), 'filters by part and kind');
  await chip(0, 0); await chip(1, 0);
  // One of my own
  await p.click('main [data-focus="new-activity"]');
  await p.waitForSelector('[data-act="name"]');
  // The sheet puts focus in itself first; type only once it has, so no key lands on another control.
  await p.waitForFunction(() => document.activeElement && document.activeElement.closest('.sheet'));
  await new Promise(r => setTimeout(r, 200));
  await p.click('[data-act="name"]'); await p.keyboard.type('Silent debate');
  await p.waitForFunction(() => document.querySelectorAll('.actedit textarea').length === 3);
  const areas = await p.$$('.actedit textarea');
  await areas[1].type('Write a claim\nPass it on'); await areas[2].type('Write one claim\nAnswer the one you get');
  await p.click('[data-focus="save-activity"]');
  await p.waitForFunction(() => !document.querySelector('.actedit'));
  const kvAct = () => p.evaluate(() => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('activities'); q.onsuccess = () => { r.result.close(); res(q.result); }; }; }));
  let acts = null; for (let k = 0; k < 30 && !(acts && acts.length === 2); k++) { acts = await kvAct(); if (!acts || acts.length < 2) await new Promise(r => setTimeout(r, 150)); }
  assert.equal(acts[0].name, 'Silent debate'); assert.deepEqual(acts[0].how, ['Write a claim', 'Pass it on']); assert.equal(acts[1].id, 'my-poem');
  assert.ok(/^my-/.test(acts[0].id), 'saved as the current Planner saves its own activities');
  // Put an activity in a lesson
  await p.waitForFunction(() => [...document.querySelectorAll('main .acth b')].some(b => b.textContent === 'Silent debate'));
  const rows = await p.$$('main .acth');
  await rows[0].click();
  await p.waitForSelector('main .act.open .actb');
  await (await p.$('main .act.open .actb .row button')).click();
  await p.waitForSelector('.sheet .lrow');
  const before = (await lessonInDb(p, 'L3')).slides.length;
  const pick = await p.$$('.sheet .lrow');
  const titles = await Promise.all(pick.map(x => x.evaluate(e => e.querySelector('b').textContent)));
  await pick[titles.indexOf('Sonnets: the turn')].click();
  await p.waitForFunction(() => /#\/lesson\/L3\/edit$/.test(location.hash));
  const l3 = await lessonInDb(p, 'L3');
  assert.equal(l3.slides.length, before + 1);
  const s = l3.slides[l3.slides.length - 1];
  assert.equal(s.layout, 'steps'); assert.equal(s.title, 'Silent debate'); assert.match(s.body, /1\. Write one claim\n2\. Answer the one you get/); assert.match(s.notes, /How to run it:\n1\. Write a claim/);
  // Past lessons, units, the bank
  await open(p, 'library/past');
  assert.deepEqual(await p.$$eval('main .libpanel .lrow b', b => b.map(x => x.textContent)), ['Stressed words in a poem', 'What makes a story a story?']);
  await open(p, 'library/units');
  assert.deepEqual(await p.$$eval('main .libsec h2', b => b.map(x => x.textContent)), ['Grade 9', 'Grade 10']);
  const g9 = (await p.$$('main .libsec'))[0];
  await (await g9.$$('a.lrow'))[1].click();
  await p.waitForFunction(() => /#\/class\//.test(location.hash) && document.querySelector('main #h-unit'), { timeout: 10000 });
  assert.equal(await p.$eval('main #h-unit', x => x.textContent), 'Unit 2: Poetry', 'a unit opens on its class’s Course line');
  await open(p, 'library/rubrics');
  assert.deepEqual(await p.$$eval('main .libpanel .lrow b', b => b.map(x => x.textContent)), ['Story analysis', 'School percent scale']);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('a lesson’s materials and links, its versions, and deleting it with undo, kept as the current Planner keeps them', async () => {
  const p = await fresh();
  await open(p, 'lesson/L3');
  // A file from this computer
  const f = path.join(require('os').tmpdir(), 'gs-plan-handout-' + process.pid + '.txt'); fs.writeFileSync(f, 'Sonnet handout');
  await (await p.$('input[data-mats]')).uploadFile(f);
  await p.waitForFunction(() => [...document.querySelectorAll('main .mlist .mopen span')].some(x => /gs-plan-handout/.test(x.textContent)), { timeout: 10000 });
  fs.unlinkSync(f);
  let l3 = await lessonInDb(p, 'L3');
  for (let k = 0; k < 30 && !(l3.files && l3.files.length); k++) { await new Promise(r => setTimeout(r, 150)); l3 = await lessonInDb(p, 'L3'); }
  assert.equal(l3.files.length, 1); assert.equal(l3.files[0].kind, 'other'); assert.ok(l3.files[0].size > 0);
  const blob = id => p.evaluate(id => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('file:' + id); q.onsuccess = () => { r.result.close(); res(q.result ? q.result.size : 0); }; }; }), id);
  assert.ok(await blob(l3.files[0].id) > 0, 'the bytes are in kv file:<id>');
  // A link
  await p.click('main [data-focus="add-link"]');
  await p.waitForSelector('main [data-focus="link-url"]');
  // The address goes in as the browser's own input event (keys typed here were lost on CI after the Library test), then Add.
  await p.$eval('main [data-focus="link-url"]', el => { el.value = 'example.com/sonnets'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('main [data-focus="link-add"]');
  await p.waitForFunction(() => [...document.querySelectorAll('main .mlist a')].some(a => a.href === 'https://example.com/sonnets'));
  l3 = await lessonInDb(p, 'L3');
  for (let k = 0; k < 30 && !(l3.links && l3.links.length); k++) { await new Promise(r => setTimeout(r, 150)); l3 = await lessonInDb(p, 'L3'); }
  assert.equal(l3.links[0].url, 'https://example.com/sonnets'); assert.equal(l3.links[0].name, 'example.com');
  // Taking the file off, then undo
  const fid = l3.files[0].id;
  await (await p.$$('main .mlist li'))[0].$('button[aria-label="Remove"]').then(b => b.click());
  await p.waitForFunction(() => !document.querySelector('main .mlist .mopen span') || ![...document.querySelectorAll('main .mlist .mopen span')].some(x => /gs-plan-handout/.test(x.textContent)));
  await p.waitForFunction(() => [...document.querySelectorAll('.toast button')].some(b => b.textContent === 'Undo'));
  await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => b.textContent === 'Undo').click());
  await p.waitForFunction(() => [...document.querySelectorAll('main .mlist .mopen span')].some(x => /gs-plan-handout/.test(x.textContent)));
  for (let k = 0; k < 30 && !(await blob(fid)); k++) await new Promise(r => setTimeout(r, 150));
  assert.ok(await blob(fid) > 0, 'undo puts the bytes back under the same id');
  // Versions: save one, change the title, go back
  const menu = async label => { await p.click('main [data-focus="lesson-menu"]'); await p.waitForSelector('.pop [role=menuitem]'); await p.evaluate(t => [...document.querySelectorAll('.pop [role=menuitem]')].find(b => b.textContent.includes(t)).click(), label); };
  await menu('Versions');
  await p.waitForSelector('[data-focus="ver-now"]');
  await p.click('[data-focus="ver-now"]');
  await p.waitForSelector('.sheet .vers .lrow');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('.sheet .vers'));
  await open(p, 'lesson/L3/edit');
  await p.$eval('main .ed-top input', el => { el.value = 'Sonnets, changed'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  for (let k = 0; k < 40 && (await lessonInDb(p, 'L3')).title !== 'Sonnets, changed'; k++) await new Promise(r => setTimeout(r, 150));
  await open(p, 'lesson/L3');
  assert.equal(await p.$eval('main h1.lt', x => x.textContent), 'Sonnets, changed');
  await menu('Versions');
  await p.waitForSelector('.sheet .vers .lrow button');
  await p.click('.sheet .vers .lrow button');
  await p.waitForFunction(() => document.querySelector('main h1.lt').textContent === 'Sonnets: the turn');
  const vs = await p.evaluate(() => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('ver:L3'); q.onsuccess = () => { r.result.close(); res(q.result); }; }; }));
  assert.equal(vs.length, 2); assert.equal(vs[0].label, 'Before going back to Saved by you'); assert.equal(vs[0].lesson.title, 'Sonnets, changed');
  // A copy for another day: its own id, slides and materials, not taught
  await menu('Copy to another class');
  await p.waitForSelector('[data-focus="copy-make"]');
  await p.click('[data-focus="copy-make"]');
  await p.waitForFunction(() => /#\/lesson\//.test(location.hash) && !/L3$/.test(location.hash));
  const cid = await p.evaluate(() => location.hash.split('/').pop());
  const cp = await lessonInDb(p, cid);
  assert.equal(cp.title, 'Sonnets: the turn'); assert.ok(!cp.taught && !cp.ready); assert.equal(cp.files.length, 1); assert.notEqual(cp.files[0].id, fid); assert.ok(await blob(cp.files[0].id) > 0);
  await open(p, 'lesson/L3');
  // Delete, then undo
  await menu('Delete lesson');
  await p.waitForFunction(() => /#\/calendar/.test(location.hash));
  for (let k = 0; k < 30 && await lessonInDb(p, 'L3'); k++) await new Promise(r => setTimeout(r, 150));
  assert.ok(!(await lessonInDb(p, 'L3')), 'deleted');
  await p.waitForFunction(() => [...document.querySelectorAll('.toast button')].some(b => b.textContent === 'Undo'));
  await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => b.textContent === 'Undo').click());
  await p.waitForFunction(() => /#\/lesson\/L3$/.test(location.hash));
  const back = await lessonInDb(p, 'L3');
  assert.equal(back.title, 'Sonnets: the turn'); assert.equal(back.files.length, 1); assert.equal(back.links.length, 1);
  await p.goto(srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && P.L && P.L.lessons && P.L.lessons.some(l => l.id === 'L3' && l.links && l.links.length === 1 && l.files && l.files.length === 1); }, { timeout: 20000 });
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('Course line: a unit renamed with its weeks pasted, a new unit made and then deleted, kept as the current Planner keeps units', async () => {
  const p = await fresh();
  await open(p, 'class/c1');
  const units = () => p.evaluate(() => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('units'); q.onsuccess = () => { r.result.close(); res(q.result); }; }; }));
  const sheetReady = async sel => { await p.waitForSelector(sel); await p.waitForFunction(() => document.activeElement && document.activeElement.closest('.sheet')); await new Promise(r => setTimeout(r, 200)); };
  await p.click('main [data-focus="edit-unit"]');
  await sheetReady('[data-focus="unit-name"]');
  await p.$eval('[data-focus="unit-name"]', el => { el.focus(); el.select(); });
  await p.keyboard.type('Unit 2: Poems aloud');
  await p.click('[data-focus="paste-weeks"]');
  await p.waitForSelector('[data-paste]');
  await p.$eval('[data-paste]', el => { el.focus(); el.select(); });
  await p.keyboard.type('Week 1: Sound\nWeek 2: Images\nWeek 3: Voice\nWeek 4: Form');
  await p.click('[data-focus="use-weeks"]');
  await p.waitForFunction(() => document.querySelectorAll('.uweeks > li').length === 4);
  await p.click('[data-focus="save-unit"]');
  let us = null; for (let k = 0; k < 40; k++) { us = await units(); if (us.find(u => u.id === 'U2').title === 'Unit 2: Poems aloud') break; await new Promise(r => setTimeout(r, 150)); }
  const u2 = us.find(u => u.id === 'U2');
  assert.equal(u2.title, 'Unit 2: Poems aloud'); assert.deepEqual(u2.weeks.map(w => w.focus), ['Sound', 'Images', 'Voice', 'Form']); assert.equal(u2.start, '2026-10-12'); assert.equal(us.length, 3);
  await p.waitForFunction(() => document.querySelector('main #h-unit').textContent === 'Unit 2: Poems aloud');
  // A new unit, then deleted
  await p.click('main [data-focus="new-unit"]');
  await sheetReady('[data-focus="unit-name"]');
  await p.$eval('[data-focus="unit-name"]', el => { el.focus(); el.select(); });
  await p.keyboard.type('Unit 3: Drama');
  await p.click('[data-focus="save-unit"]');
  for (let k = 0; k < 40 && (await units()).length < 4; k++) await new Promise(r => setTimeout(r, 150));
  us = await units(); const u3 = us.find(u => u.title === 'Unit 3: Drama');
  assert.ok(u3, 'the new unit is saved'); assert.equal(u3.course, 'Grade 9'); assert.equal(u3.weeks.length, 6); assert.equal(new Date(u3.start + 'T12:00').getDay(), 1, 'starts on a Monday');
  await p.waitForFunction(() => document.querySelector('main #h-unit').textContent === 'Unit 3: Drama');
  await p.click('main [data-focus="edit-unit"]');
  await sheetReady('[data-focus="delete-unit"]');
  await p.click('[data-focus="delete-unit"]'); await p.click('[data-focus="delete-unit"]');
  for (let k = 0; k < 40 && (await units()).length > 3; k++) await new Promise(r => setTimeout(r, 150));
  assert.equal((await units()).length, 3);
  await p.goto(srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && P.L && P.L.units && P.L.units.some(u => u.id === 'U2' && u.title === 'Unit 2: Poems aloud' && u.weeks.length === 4); }, { timeout: 20000 });
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('a taught lesson says where the class got to last time and what was noted', async () => {
  const p = await fresh();
  await open(p, 'lesson/L1');
  assert.equal(await p.$eval('main .last h2', x => x.textContent), 'Last time you taught it');
  assert.match(await p.$eval('main .last p', x => x.textContent), /Grade 9 English · .* · got to the end/);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('printing the week and a lesson’s plan: each day’s classes with their lessons, slides and materials', async () => {
  const p = await fresh();
  const catchPrint = () => p.evaluate(() => { window.__printed = ''; window.open = () => ({ document: { write: s => { window.__printed += s; }, close() {} }, focus() {}, print() {} }); });
  await open(p, 'calendar/class');
  await catchPrint();
  await p.click('main [data-focus="week-menu"]'); await p.waitForSelector('.pop [role=menuitem]');   // Print the week sits in the week's menu since stage 8 (E2)
  await p.evaluate(() => [...document.querySelectorAll('.pop [role=menuitem]')].find(b => b.textContent.includes('Print')).click());
  const week = await p.evaluate(() => window.__printed);
  assert.match(week, /Reading a poem aloud/); assert.match(week, /Grade 9 English/); assert.match(week, /Parent evening/); assert.match(week, /Warm-up/);
  await open(p, 'lesson/L2');
  await catchPrint();
  await p.click('main [data-focus="lesson-menu"]'); await p.waitForSelector('.pop [role=menuitem]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role=menuitem]')].find(b => b.textContent.includes('Print the plan')).click());
  const plan = await p.evaluate(() => window.__printed);
  assert.match(plan, /<h1>Reading a poem aloud<\/h1>/); assert.match(plan, /Two minutes, silent\./);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('a lesson on no class or day shows beside the Course line and goes on the calendar from its page', async () => {
  const p = await fresh();
  await open(p, 'library');
  await (await p.$$('main .acth'))[1].click();
  await p.waitForSelector('main .act.open .actb .row button');
  await (await p.$('main .act.open .actb .row button')).click();
  await p.waitForSelector('[data-focus="act-new-lesson"]');
  await p.waitForFunction(() => document.activeElement && document.activeElement.closest('.sheet'));
  await p.click('[data-focus="act-new-lesson"]');
  await p.waitForFunction(() => /#\/lesson\/[^/]+\/edit$/.test(location.hash));
  const id = await p.evaluate(() => location.hash.split('/')[2]);
  for (let k = 0; k < 30 && !(await lessonInDb(p, id)); k++) await new Promise(r => setTimeout(r, 150));
  assert.deepEqual((await lessonInDb(p, id)).slots, []);
  await open(p, 'class/c1');
  assert.ok((await p.$$eval('main .loose a', a => a.map(x => x.getAttribute('href')))).includes('#/lesson/' + id), 'listed as not on the calendar');
  await open(p, 'lesson/' + id);
  await p.click('main [data-focus="place-it"]');
  let l = null; for (let k = 0; k < 30; k++) { l = await lessonInDb(p, id); if (l.slots.length) break; await new Promise(r => setTimeout(r, 150)); }
  assert.deepEqual(l.slots, [{ classId: 'A1', date: '2026-10-27' }]);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('slide editing undo: a deleted slide comes back with Ctrl+Z, and Ctrl+Y does it again', async () => {
  const p = await fresh();
  await open(p, 'lesson/L5/edit');
  const count = async () => { for (let k = 0; k < 30; k++) { const l = await lessonInDb(p, 'L5'); if (l) return l.slides.length; } return 0; };
  const before = await count();
  await p.click('main button[aria-label="Slide actions"]'); await p.waitForSelector('.pop [role=menuitem]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role=menuitem]')].find(b => b.textContent.includes('Delete')).click());
  for (let k = 0; k < 30 && await count() === before; k++) await new Promise(r => setTimeout(r, 150));
  assert.equal(await count(), before - 1);
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  for (let k = 0; k < 30 && await count() !== before; k++) await new Promise(r => setTimeout(r, 150));
  assert.equal(await count(), before, 'the slide is back');
  await p.keyboard.down('Control'); await p.keyboard.press('y'); await p.keyboard.up('Control');
  for (let k = 0; k < 30 && await count() !== before - 1; k++) await new Promise(r => setTimeout(r, 150));
  assert.equal(await count(), before - 1, 'redo deletes it again');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('on a phone: the lesson reads, and an after-class note waits for the computer without the lesson being written', async () => {
  const p = await fresh(390);
  await open(p, 'lesson/L2');
  assert.equal(await p.$eval('main h1', h => h.textContent), 'Reading a poem aloud');
  const wide = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(wide, 'no sideways scrolling on a phone');
  const before = await lessonInDb(p, 'L2');
  await p.$eval('main .after textarea', el => el.focus());
  await p.keyboard.type('Stopped at slide 3');
  await p.$eval('main .after textarea', el => el.blur());
  await p.waitForFunction(() => { try { const T = JSON.parse(localStorage.getItem('gsp.taughtIn')); return !!(T && T.items && T.items['L2|A1|2026-10-27']); } catch { return false; } }, { timeout: 5000 });
  const item = await p.evaluate(() => JSON.parse(localStorage.getItem('gsp.taughtIn')).items['L2|A1|2026-10-27']);
  assert.equal(item.x, 'Stopped at slide 3'); assert.equal(item.of, 5); assert.ok(item.t > 0);
  const after = await lessonInDb(p, 'L2');
  assert.equal(after.updated, before.updated, 'the phone never writes the lesson');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});
