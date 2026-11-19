// Strong examples from the saved bank, put in a lesson (11/16). The bank is grading's own database, grading-studio-examples; the
// Planner only reads it. The examples, assignment and student here are made up.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { serve } = require('./helpers/serve');
const { launch } = require('./helpers/chrome');
const BASE = require('./helpers/base');   // the current app's pages: classic/ since the switch
const ROOT = path.join(__dirname, '..');
const PAGE = () => fs.readFileSync(path.join(BASE, 'planner.html'), 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));
const until = async (page, fn, arg) => { for (let i = 0; i < 160; i++) { if (await page.evaluate(fn, arg)) return; await wait(50); } throw new Error('Waited too long for ' + fn + ' ' + (arg || '')); };
const WHO = 'Pat Madeup';   // whose the paper was: kept only in grading, never in the Planner

// Plants the bank the way grading keeps it: a two-page paper, a quiz answer, and one deleted.
const plant = page => page.evaluate(async who => {
  const jpg = (w, h, color) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, w, h); return new Promise(r => c.toBlob(r, 'image/jpeg', 0.8)); };
  const db = await new Promise((res, rej) => { const r = indexedDB.open('grading-studio-examples', 1); r.onupgradeneeded = () => { r.result.createObjectStore('ex'); r.result.createObjectStore('pix'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const recs = [
    { id: 'exP', t: 1, kind: 'paper', work: 'w1', asg: 'a1', cls: 'c1', title: 'Persuasive essay', q: null, row: null, why: 'Clear claim and strong evidence', tags: ['claims'], letter: 'A', pages: [{ w: 600, h: 800 }, { w: 600, h: 800 }], marks: false, score: false, from: { key: who } },
    { id: 'exQ', t: 2, kind: 'answer', work: 'w2', asg: 'a2', cls: 'c1', title: 'Cells quiz', q: { id: 'q3', lab: '3', pts: 2, v: 2 }, row: null, why: '', letter: null, pages: [{ w: 900, h: 300 }], marks: false, score: false, from: { key: who } },
    { id: 'exGone', t: 3, gone: true },
  ];
  const pics = [['exP|0', await jpg(600, 800, '#cfe0f0')], ['exP|1', await jpg(600, 800, '#f0e0cf')], ['exQ|0', await jpg(900, 300, '#dfe9d0')]];
  await new Promise((res, rej) => { const tx = db.transaction(['ex', 'pix'], 'readwrite'); for (const r of recs) tx.objectStore('ex').put(r, r.id); for (const [k, b] of pics) tx.objectStore('pix').put(b, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  db.close();
}, WHO);

async function open(withBank) {
  const server = await serve(PAGE);
  const browser = await launch(), page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.url + 'blank');
  if (withBank) await plant(page);
  await page.goto(server.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
  const id = await page.evaluate(async () => {
    const P = window.__planner;
    const l = P.normLesson({ title: 'Writing a claim', fmt: 2, look: 'white', slides: [{ layout: 'title', title: 'Writing a claim' }, { layout: 'content', title: 'Today', body: '• Read a strong essay', size: 36 }] });
    P.L.lessons.push(l); P.openLessonForTest(l, 1);
    await P.plxLoad();
    await new Promise(r => setTimeout(r, 0));
    return l.id;
  });
  return { server, browser, page, errors, id, done: async () => { await browser.close(); await server.close(); } };
}
const lesson = (page, id) => page.evaluate(id => window.__planner.L.lessons.find(l => l.id === id), id);

test('with no bank, nothing is offered and no examples database is made', async () => {
  const a = await open(false);
  try {
    const { page } = a;
    await page.evaluate(() => window.__planner.renderLessons());
    assert.equal(await page.$('[data-ma="ex"]'), null, 'no Strong example button in Materials');
    await page.click('[data-a="addpick"]'); await page.waitForSelector('#dlgBox [data-addslide]');
    assert.equal(await page.$('#dlgBox [data-plxadd]'), null, 'nothing about examples in Add a slide');
    await page.keyboard.press('Escape');
    const names = await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name));
    assert.ok(!names.includes('grading-studio-examples'), 'reading the bank never makes it: ' + names);
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});

test('a saved paper goes on slides, one page each, after this slide, with one Undo; whose it was never shows', async () => {
  const a = await open(true);
  try {
    const { page, id } = a;
    assert.equal(await page.evaluate(() => window.__planner.PLX.list.length), 2, 'the deleted one is left out');
    await page.evaluate(() => window.__planner.renderLessons());
    await page.click('[data-a="addpick"]'); await page.waitForSelector('#dlgBox [data-plxadd]');
    await page.click('#dlgBox [data-plxadd]');
    await page.waitForSelector('#dlgBox [data-plx="exP"]');
    await until(page, () => document.querySelectorAll('#dlgBox img[data-plxpic][src]').length === 2);
    const text = await page.$eval('#dlgBox', e => e.textContent);
    assert.match(text, /Cells quiz[\s\S]*Question 3[\s\S]*Persuasive essay[\s\S]*Example A[\s\S]*2 pages · Clear claim/);
    assert.ok(!text.includes('Madeup'), 'the student is never named');
    assert.equal(await page.$eval('#dlgBox [data-plxgo="slide"]', b => b.disabled), true, 'nothing picked yet');
    // find narrows by tag
    await page.type('#plxF', 'claims');
    await until(page, () => !document.querySelector('#dlgBox [data-plx="exQ"]'));
    await page.click('#dlgBox [data-plx="exP"]');
    await page.waitForSelector('#dlgBox [data-plxpg="1"]');
    assert.equal(await page.$eval('#dlgBox [data-plxgo="slide"]', b => b.className), 'btn primary', 'from Add a slide, Put on slides is the blue one');
    await page.click('#dlgBox [data-plxgo="slide"]');
    await until(page, id => window.__planner.L.lessons.find(l => l.id === id).slides.length === 4, id);
    const l = await lesson(page, id);
    assert.deepEqual(l.slides.map(s => s.layout), ['title', 'content', 'fullpic', 'fullpic'], 'after the slide that was open, the paper fills each slide');
    assert.deepEqual(l.slides.slice(2).map(s => s.img.source), ['Persuasive essay · Example A, page 1', 'Persuasive essay · Example A, page 2']);
    assert.ok(l.slides.slice(2).every(s => /^data:image\/jpeg;base64,/.test(s.img.src)));
    assert.equal(await page.evaluate(() => window.__planner.L.cur), 3, 'the last one added is open');
    // what goes to the assistant names the pictures and nobody
    const t = await page.evaluate(id => window.__planner.lessonText(window.__planner.L.lessons.find(l => l.id === id)), id);
    assert.match(t, /\[Picture: Persuasive essay · Example A, page 2\]/);
    assert.ok(!t.includes('Madeup') && !JSON.stringify(l).includes('Madeup') && !(await page.content()).includes('Madeup'));
    // one Undo takes both slides back
    await page.click('#lsWrap'); await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
    await until(page, id => window.__planner.L.lessons.find(l => l.id === id).slides.length === 2, id);
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});

test('one page of a paper, or an answer, never replaces the picture already on a slide; Materials takes a JPEG a page with Undo', async () => {
  const a = await open(true);
  try {
    const { page, id } = a;
    // a picture slide that already has its picture
    await page.evaluate(async id => { const P = window.__planner, l = P.L.lessons.find(l => l.id === id); l.slides.push(P.normLesson({ slides: [{ layout: 'picture', title: 'Mine', img: { src: 'data:image/png;base64,iVBORw0KGgo=', w: 10, h: 10, source: 'my own' } }] }).slides[0]); P.openLessonForTest(l, 2); }, id);
    await page.click('[data-a="addpick"]'); await page.waitForSelector('#dlgBox [data-plxadd]');
    await page.click('#dlgBox [data-plxadd]'); await page.waitForSelector('#dlgBox [data-plx="exQ"]');
    await page.click('#dlgBox [data-plx="exQ"]');
    assert.equal(await page.$('#dlgBox [data-plxpg]'), null, 'one page: nothing to tick');
    await page.click('#dlgBox [data-plxgo="slide"]');
    await until(page, id => window.__planner.L.lessons.find(l => l.id === id).slides.length === 4, id);
    let l = await lesson(page, id);
    assert.equal(l.slides[2].img.source, 'my own', 'the picture that was there stays');
    assert.deepEqual([l.slides[3].layout, l.slides[3].title, l.slides[3].img.source], ['picture', 'Strong example', 'Cells quiz · Question 3']);

    // Materials: page 2 only
    await page.waitForSelector('[data-ma="ex"]');
    await page.click('[data-ma="ex"]'); await page.waitForSelector('#dlgBox [data-plx="exP"]');
    await page.click('#dlgBox [data-plx="exP"]'); await page.waitForSelector('#dlgBox [data-plxpg="0"]');
    assert.equal(await page.$eval('#dlgBox [data-plxgo="mats"]', b => b.className), 'btn primary', 'from Materials, Add to materials is the blue one');
    await page.click('#dlgBox [data-plxpg="0"]');
    await page.click('#dlgBox [data-plxgo="mats"]');
    await until(page, id => (window.__planner.L.lessons.find(l => l.id === id).files || []).length === 1, id);
    l = await lesson(page, id);
    assert.deepEqual(l.files.map(f => [f.name, f.type]), [['Persuasive essay - Example A p2.jpg', 'image/jpeg']]);
    assert.match(await page.$eval('.pl-mats', e => e.textContent), /Persuasive essay - Example A p2\.jpg/);
    await page.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => b.textContent === 'Undo').click());
    await until(page, id => (window.__planner.L.lessons.find(l => l.id === id).files || []).length === 0, id);
    assert.deepEqual(a.errors, []);
  } finally { await a.done(); }
});
