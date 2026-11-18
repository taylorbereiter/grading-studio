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
const SCREENS = ['calendar/class', 'calendar/time', 'calendar/month', 'class/c1', 'lesson/L2', 'lesson/L2/slides', 'lesson/L2/edit', 'library', 'library/past', 'library/units', 'library/rubrics'];

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
  await p.select('main .ed-form select', 'picture');
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
  await p.click('main .ttset .card .swatches button:nth-child(3)');
  await p.$eval('main .ttset .card', c => [...c.querySelectorAll(':scope > div > div > button, :scope button')].find(b => b.textContent === 'Add a time').click());
  const dayOff = (await p.$$('main .ttset .dlist'))[0];
  await (await dayOff.$(':scope > div:last-child button')).click();
  const rows = await dayOff.$$('.drow');
  const inputs = await rows[1].$$('input');
  await inputs[0].type('12252026'); await inputs[1].type('Winter break');
  await p.click('main [data-focus="save-timetable"]');
  const readSetup = () => p.evaluate(() => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('setup'); q.onsuccess = () => { r.result.close(); res(q.result); }; }; }));
  let setup = null;
  for (let k = 0; k < 40 && !setup; k++) { const s = await readSetup(); if (s.classes[0].name === 'Grade 9 English A') setup = s; else await new Promise(r => setTimeout(r, 150)); }
  assert.ok(setup, 'the setup is saved');
  assert.equal(setup.classes[0].color, '#B71E42');
  assert.equal(setup.classes[0].meets.length, 4);
  assert.deepEqual(setup.daysOff.map(x => x.label), ['Staff training day', 'Winter break']);
  assert.equal(setup.classes[0].id, 'A1', 'the class keeps its id, so its lessons stay its own');
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
  await p.waitForFunction(() => document.querySelectorAll('main .acts > li').length === 1);
  await p.$eval('main [data-focus="find-activity"]', el => { el.focus(); el.select(); });
  await p.keyboard.press('Backspace');
  await p.waitForFunction(a => document.querySelector('main .libpanel [role=status]').textContent === a, {}, all);
  const chip = async (group, i) => { const g = (await p.$$('main .chips'))[group]; await (await g.$$('button'))[i].click(); };
  await chip(0, 1); await chip(1, 1);   // Warm-up, Discussion
  const names = await p.$$eval('main .acts .acth b', b => b.map(x => x.textContent));
  assert.ok(names.length > 0 && names.length < 40 && names.includes('Think, pair, share'), 'filters by part and kind');
  await chip(0, 0); await chip(1, 0);
  // One of my own
  await p.click('main [data-focus="new-activity"]');
  await p.waitForSelector('[data-act="name"]');
  await p.focus('[data-act="name"]'); await p.keyboard.type('Silent debate');
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
