// The planning tools that come in their own parts (stage 3 follow-up), in a real browser with made-up work (planseed.js) at the
// stopped clock: the lesson's Beside drawer and notebook, alternative versions, the slide editor's text tools and box frame, an
// empty period's menu, the week planned with the assistant, and a unit's files and weeks filled from the assistant's reply. Every
// assistant message is self-contained and names no folder, path or file on the computer. npm run next:browser.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { plantPlan, LESSONS, lesson } = require('./planseed.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const onDisk = require('./site-path');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p) || onDisk.extra(p);
    const f = onDisk(p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}

let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

async function fresh(width = 1366, lessons = LESSONS) {
  const ctx = await browser.createBrowserContext(), p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width, height: width < 700 ? 844 : 900 });
  await p.goto(srv.url + 'blank');
  await plant(p, gradingSeed()); await plantPlan(p, { lessons });
  p.errors = errors; p.ctx = ctx; return p;
}
const open = async (p, hash, keys) => {
  await p.goto(srv.url + 'next/' + (keys ? '?keys=1' : '') + '#/' + hash);
  await p.waitForSelector('[data-shell-nav], nav.tabbar', { timeout: 20000 });
  await p.waitForFunction(() => !document.querySelector('main .loading'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 300));
};
const lessonInDb = (p, id) => p.evaluate(id => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('lessons').objectStore('lessons').get(id); q.onsuccess = () => { r.result.close(); res(q.result || null); }; q.onerror = () => rej(q.error); }; r.onerror = () => rej(r.error); }), id);
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 6000) => { for (let k = 0; k < ms / 150; k++) { const v = await fn(); if (v) return v; await wait(150); } return null; };
const kvGet = (p, key) => p.evaluate(key => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => { r.result.close(); res(q.result === undefined ? null : JSON.parse(JSON.stringify(q.result instanceof Blob ? { blob: q.result.size } : q.result))); }; }; }), key);
const allLessons = p => p.evaluate(() => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const q = r.result.transaction('lessons').objectStore('lessons').getAll(); q.onsuccess = () => { r.result.close(); res(q.result); }; }; }));
const item = (p, text) => p.evaluate(t => { const b = [...document.querySelectorAll('[role^="menuitem"]')].find(x => x.textContent.includes(t)); if (!b) throw new Error('no menu item ' + t); b.click(); }, text);
const clip = async p => { await p.ctx.overridePermissions(srv.url.replace(/\/$/, ''), ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']); };
const readClip = async p => { await p.waitForFunction(async () => (await navigator.clipboard.readText()).length > 200, { timeout: 5000, polling: 200 }); return p.evaluate(() => navigator.clipboard.readText()); };
const SELF = /Don't look for, open or ask for any folder or file on my computer/, PATHS = /\/Users\/|~\/|[A-Z]:\\|\.lesson\.json|Lessons\//;

test('the lesson’s Beside drawer: books, a video, the unit and the notebook, with the notebook kept with the lesson', async () => {
  const p = await fresh();
  await open(p, 'lesson/L2');
  await p.click('main [data-focus="beside"]');
  await p.waitForSelector('aside.beside [role=tab]');
  assert.deepEqual(await p.$$eval('aside.beside [role=tab]', b => b.map(x => x.textContent)), ['Books', 'Activities', 'Video', 'Unit', 'Notebook', 'Assistant']);
  await p.waitForSelector('aside.beside input[data-addpdf]');
  const tab = async name => { await p.evaluate(n => [...document.querySelectorAll('aside.beside [role=tab]')].find(x => x.textContent === n).click(), name); await wait(250); };
  await tab('Unit');
  assert.match(await p.$eval('aside.beside', a => a.textContent), /Unit 2: Poetry/);
  await tab('Notebook');
  await p.click('[data-nbpage]'); await p.keyboard.down('Control'); await p.keyboard.press('b'); await p.keyboard.up('Control'); await p.keyboard.type('Bring the poem cards');
  const l = await until(async () => { const x = await lessonInDb(p, 'L2'); return x && /<b>Bring the poem cards<\/b>/.test(x.notebook || '') && x; });
  assert.ok(l, 'the notebook is kept with the lesson, bold as typed with Ctrl+B');
  await p.click('[data-focus="beside-close"]');
  assert.equal(await p.$('aside.beside'), null);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('an alternative version of a lesson: made from the menu, switched to in the bar, kept as the current Planner keeps variants', async () => {
  const p = await fresh();
  await open(p, 'lesson/L3');
  await p.click('main [data-focus="lesson-menu"]'); await p.waitForSelector('[role^="menuitem"]'); await item(p, 'Make an alternative version');
  await p.waitForSelector('[data-focus="var-name"]');
  await p.click('[data-focus="var-name"]'); await p.keyboard.type('Shorter'); await p.click('[data-focus="name-ok"]');
  await p.waitForFunction(() => location.hash !== '#/lesson/L3', { timeout: 8000 });
  const id = await p.evaluate(() => location.hash.split('/')[2]);
  const v = await until(() => lessonInDb(p, id));
  assert.equal(v.variantOf, 'L3'); assert.equal(v.variant, 'Shorter'); assert.deepEqual(v.slots, [], 'not on a class unless asked, as the current Planner makes one');
  assert.match(await p.$eval('main .varbar', b => b.textContent), /Shorter/);
  await p.evaluate(() => [...document.querySelectorAll('main .varbar [role=radio], main .varbar button')].find(b => /Original/.test(b.textContent)).click());
  await p.waitForFunction(() => location.hash === '#/lesson/L3', { timeout: 5000 });
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('the slide editor: Bold, a bullet list and indent from the keys, kept in the current Planner’s own marks; a box moved by its frame and put back', async () => {
  const p = await fresh();
  await open(p, 'lesson/L3/edit');
  await p.click('.ed-list li:nth-child(3) button'); await p.waitForSelector('.rtbox');
  await p.click('.rtbox'); await p.keyboard.down('Control'); await p.keyboard.press('End'); await p.keyboard.up('Control');
  await p.keyboard.down('Shift'); await p.keyboard.press('Enter'); await p.keyboard.up('Shift');
  await p.keyboard.press('Tab');
  await p.keyboard.down('Control'); await p.keyboard.press('b'); await p.keyboard.up('Control'); await p.keyboard.type('Say it aloud');
  const body = await until(async () => { const x = await lessonInDb(p, 'L3'); return x && /\*\*Say it aloud\*\*/.test(x.slides[2].body) && x.slides[2].body; });
  assert.ok(body, 'bold is kept as **…**');
  assert.ok(body.split('\n').some(x => /^\t• \*\*Say it aloud\*\*$/.test(x)), 'the new line is a bullet one level in: ' + JSON.stringify(body));
  // the frame: drag the body box's bar
  await p.click('.ed-stagewrap .ls-slide [data-k="body"]'); await p.waitForSelector('.edframe [data-h="move"]');
  const g = await (await p.$('.edframe [data-h="move"]')).boundingBox();
  await p.mouse.move(g.x + 10, g.y + 8); await p.mouse.down(); await p.mouse.move(g.x + 60, g.y + 48, { steps: 6 }); await p.mouse.up();
  const box = await until(async () => { const x = await lessonInDb(p, 'L3'); return x && x.slides[2].box && x.slides[2].box.body; });
  assert.ok(box && box.x % 4 === 0 && box.y % 4 === 0 && box.w > 0, 'the box is kept on the slide in slide units, snapped');
  await p.click('[data-focus="box-back"]');
  assert.ok(await until(async () => { const x = await lessonInDb(p, 'L3'); return x && !(x.slides[2].box && x.slides[2].box.body); }), 'Put back takes it home');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('an empty period’s menu: last year’s lesson as a copy of its own, a lesson I have on this period too, and one from the Library', async () => {
  const old = lesson('LY', 'Sound and sense, last year', [{ classId: 'A2', date: '2025-10-29' }], { taught: [{ classId: 'A2', date: '2025-10-29', slide: 5, of: 5, note: 'Ran long', at: 1760000000000 }] });
  const p = await fresh(1366, [...LESSONS, old]);
  await open(p, 'calendar/class');
  const menu = async () => { await p.click('main [data-slotmenu="A2|2026-10-28"]'); await p.waitForSelector('[role^="menuitem"]'); };
  await menu(); await item(p, 'Use a lesson I have');
  await p.waitForSelector('[data-use="LY"]');
  assert.match(await p.$eval('.sheet', s => s.textContent), /Last year/);
  await p.click('[data-use="LY"]');
  await p.waitForFunction(() => /^#\/lesson\//.test(location.hash) && !/LY$/.test(location.hash), { timeout: 8000 });
  const id = await p.evaluate(() => location.hash.split('/')[2]), mine = await until(() => lessonInDb(p, id));
  assert.equal(mine.title, 'Sound and sense, last year'); assert.deepEqual(mine.slots, [{ classId: 'A2', date: '2026-10-28' }]); assert.ok(!mine.taught, 'the copy has no taught record');
  assert.deepEqual((await lessonInDb(p, 'LY')).slots, [{ classId: 'A2', date: '2025-10-29' }], 'last year’s stays as it was');
  await open(p, 'calendar/class');
  await p.waitForSelector('main [data-slotmenu="A2|2026-10-29"]'); await p.click('main [data-slotmenu="A2|2026-10-29"]'); await p.waitForSelector('[role^="menuitem"]'); await item(p, 'Use a lesson I have');
  await p.waitForSelector('[data-use="L5"]'); await p.click('[data-use="L5"]');
  assert.ok(await until(async () => (await lessonInDb(p, 'L5')).slots.some(s => s.classId === 'A2' && s.date === '2026-10-29')), 'the same lesson goes on this period too');
  // the lesson opens once it is saved (cal-tools.jsx pick): waited for, so it does not open over the calendar opened next
  await p.waitForFunction(() => /^#\/lesson\/L5/.test(location.hash), { timeout: 8000 });
  await open(p, 'calendar/class');
  await p.waitForSelector('main [data-slotmenu="B1|2026-10-30"]'); await p.click('main [data-slotmenu="B1|2026-10-30"]'); await p.waitForSelector('[role^="menuitem"]'); await item(p, 'Start from the Library');
  await p.waitForSelector('[data-act="my-poem"]'); await p.click('[data-act="my-poem"]');
  await p.waitForFunction(() => /\/edit$/.test(location.hash), { timeout: 8000 });
  const libId = await p.evaluate(() => location.hash.split('/')[2]), lib = await until(() => lessonInDb(p, libId));
  assert.equal(lib.title, 'Poem relay'); assert.deepEqual(lib.slots.map(s => s.classId + ' ' + s.date), ['B1 2026-10-30']);
  assert.ok(lib.slides.some(s => /Poem relay/.test(s.title)), 'the activity is a slide');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('the week planned with the assistant: one self-contained message for the empty periods, the .zip back looked at, then kept on its periods', async () => {
  const p = await fresh(); await clip(p);
  await open(p, 'calendar/class');
  await p.click('main [data-focus="week-menu"]'); await p.waitForSelector('[role^="menuitem"]'); await item(p, 'Plan this week with');
  await p.waitForSelector('[data-focus="week-copy"]');
  await p.click('[data-focus="week-copy"]');
  const brief = await readClip(p);
  assert.match(brief, SELF); assert.doesNotMatch(brief, PATHS, 'it names no folder, path or file on the computer');
  assert.match(brief, /week\.json/); assert.match(brief, /Unit 2: Poetry/);
  const files = [...brief.matchAll(/### (.+?), .+? \(file: (.+?)\)/g)].map(m => ({ cls: m[1], file: m[2] }));
  assert.deepEqual(files.map(f => f.file), ['2026-10-28 Grade 9 English B.json', '2026-10-29 Grade 9 English B.json', '2026-10-30 Grade 10 Literature.json'], 'only the empty periods');
  const fflate = require('fflate'), z = { 'week.json': fflate.strToU8(JSON.stringify({ kind: 'grading-studio-week-zip', lessons: files.map(f => ({ class: f.cls, date: f.file.slice(0, 10), file: f.file })) })) };
  for (const f of files) z[f.file] = fflate.strToU8(JSON.stringify({ kind: 'grading-studio-lesson-zip', lesson: { title: 'Planned for ' + f.cls, slides: [{ layout: 'title', title: 'Planned' }, { layout: 'agenda', title: 'Agenda', body: '1. One' }, { layout: 'content', title: 'Go', body: '• Read' }] } }));
  const zp = path.join(require('os').tmpdir(), 'gs-week-' + process.pid + '.zip'); fs.writeFileSync(zp, fflate.zipSync(z));
  await (await p.$('input[data-weekzip]')).uploadFile(zp); await p.waitForSelector('[data-focus="week-keep"]', { timeout: 8000 }); fs.unlinkSync(zp);
  assert.equal(await p.$$eval('.review li', x => x.length), 3);
  await p.click('[data-focus="week-keep"]');
  const got = await until(async () => { const all = (await allLessons(p)).filter(l => /^Planned for/.test(l.title)); return all.length === 3 && all; });
  assert.ok(got, 'three lessons are kept');
  assert.deepEqual(got.map(l => l.slots[0].classId + ' ' + l.slots[0].date).sort(), ['A2 2026-10-28', 'A2 2026-10-29', 'B1 2026-10-30']);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('a unit: a summative file added, the weeks filled from the assistant’s reply, and a unit made to fill from screenshots', async () => {
  const p = await fresh(); await clip(p);
  await open(p, 'class/c1');
  await p.waitForSelector('[data-focus="unit-add-file"]', { timeout: 8000 });
  const f = path.join(require('os').tmpdir(), 'Summative task ' + process.pid + '.txt'); fs.writeFileSync(f, 'Write a poem of your own.');
  const [fc] = await Promise.all([p.waitForFileChooser(), p.click('[data-focus="unit-add-file"]')]); await fc.accept([f]);
  const withFile = await until(async () => { const us = await kvGet(p, 'units'); const u = us && us.find(x => x.id === 'U2'); return u && u.files.length && u; }); fs.unlinkSync(f);
  assert.equal(withFile.files[0].kind, 'summative', 'a task sheet is a summative file'); assert.ok((await kvGet(p, 'file:' + withFile.files[0].id)).blob > 0);
  await p.waitForFunction(() => /Summative/.test(document.querySelector('.ugoals').textContent));
  await p.click('[data-focus="unit-ask"]'); await p.waitForSelector('[data-focus="unit-copy"]'); await p.click('[data-focus="unit-copy"]');
  const brief = await readClip(p);
  assert.match(brief, /Don't look for, open or ask for any folder or file on my computer/); assert.doesNotMatch(brief, PATHS); assert.match(brief, /unit\.json/); assert.match(brief, /Unit 2: Poetry/);
  const fflate = require('fflate'), zp = path.join(require('os').tmpdir(), 'gs-unit-' + process.pid + '.zip');
  fs.writeFileSync(zp, fflate.zipSync({ 'unit.json': fflate.strToU8(JSON.stringify({ kind: 'grading-studio-unit-zip', unit: { title: 'Unit 2: Poetry', weeks: [{ focus: 'Sound and sense', standards: 'RL.4' }, { focus: 'Sonnets', standards: 'RL.5' }, { focus: 'Free verse' }, { focus: 'Voice' }, { focus: 'Our own poems' }] } })) }));
  await (await p.$('input[data-unitzip]')).uploadFile(zp); await p.waitForSelector('[data-focus="unit-keep"]'); fs.unlinkSync(zp);
  await p.click('[data-focus="unit-keep"]');
  const u = await until(async () => { const us = await kvGet(p, 'units'); const x = us && us.find(y => y.id === 'U2'); return x && x.weeks[0].focus === 'Sound and sense' && x; });
  assert.ok(u, 'the weeks are kept'); assert.equal(u.weeks[1].standards, 'RL.5'); assert.equal(u.files.length, 1, 'the files stay');
  await p.waitForFunction(() => /RL\.4/.test(document.querySelector('.ugoals').textContent), { timeout: 5000 });
  await p.click('[data-focus="unit-menu"]'); await p.waitForSelector('[role^="menuitem"]'); await item(p, 'Unit from screenshots');
  assert.ok(await until(async () => ((await kvGet(p, 'units')) || []).filter(x => x.course === 'Grade 9').length === 3), 'a new unit is made');
  await p.waitForSelector('[data-focus="unit-add-shot"]');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});
