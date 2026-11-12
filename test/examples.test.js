// Strong examples: a quiz answer starred in Quick mark, a whole paper or part of a page from the paper's ⋯ menu, the Examples tab and its uses.
// Every example is a picture with the names blacked out; marking, scores and exports never change. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goTo, pick, settle, markPage, catchDownloads, waitPaper, goToStudent } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

const NAMES = ['Ann Testcase', 'Ben Specimen', 'Cara Sample', 'Dev Madeup'];
let browser, quizZip, essayZip;
before(async () => {
  browser = await launch();
  quizZip = zipOf({
    'Ann Testcase/Quiz scan.pdf': await makePaper({ title: 'Ann Testcase quiz', pages: 1 }),
    'Ben Specimen/Quiz scan.pdf': await makePaper({ title: 'Ben Specimen quiz', pages: 1 }),
  });
  essayZip = zipOf({
    'Cara Sample/River essay.pdf': await makePaper({ title: 'Cara Sample essay', pages: 2 }),
    'Dev Madeup/River essay.pdf': await makePaper({ title: 'Dev Madeup essay', pages: 1 }),
  });
});
after(async () => { await browser.close(); });

async function boxOn(page, n, a, b) {
  await page.waitForSelector('.qbpg[data-n="' + n + '"] canvas');
  const r = await page.$eval('.qbpg[data-n="' + n + '"] canvas', c => { c.scrollIntoView({ block: 'start' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(r.x + a[0] * r.w, r.y + a[1] * r.h); await page.mouse.down();
  await page.mouse.move(r.x + b[0] * r.w, r.y + b[1] * r.h, { steps: 5 }); await page.mouse.up();
}
const exList = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.exList())));
// The work the examples must never touch: every student's grade and marks, and the quiz.
const workNow = page => page.evaluate(() => { const b = window.__gs.state().batch; return JSON.stringify({ g: b.students.map(s => s.grade), m: b.students.map(s => s.files.map(f => f.marks)), q: b.quiz || null }); });
// The picture's pixels: whether a row holds a solid black run (a cover), and how many pixels are the marks' red.
const picFacts = (page, id, n) => page.evaluate(async (id, n) => {
  const b = await new Promise((res, rej) => { const r = indexedDB.open('grading-studio-examples'); r.onsuccess = () => { const q = r.result.transaction('pix').objectStore('pix').get(id + '|' + n); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }; r.onerror = () => rej(r.error); });
  const im = await createImageBitmap(b), c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let longest = 0, red = 0;
  for (let y = 0; y < c.height; y++) { let run = 0; for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (d[i] < 40 && d[i + 1] < 40 && d[i + 2] < 40) { if (++run > longest) longest = run; } else run = 0; if (d[i] > 160 && d[i + 1] < 90 && d[i + 2] < 100) red++; } }
  return { w: c.width, h: c.height, longest, red };
}, id, n);
const noNames = (s, what) => { for (const n of NAMES) for (const w of n.split(' ')) assert.ok(!s.includes(w), what + ' says “' + w + '”: ' + s.slice(0, 300)); };

test('a star in Quick mark keeps an answer as a picture with the name covered; a second press, Undo and E work; nothing else changes', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, quizZip, 'Quiz.zip');
  await page.evaluate(() => window.__gs.openQuizBoxes());
  await boxOn(page, 0, [0.07, 0.07], [0.7, 0.14]);   // the line with the student's name on it
  await page.click('[data-save]');
  await page.waitForFunction(() => document.querySelectorAll('#qmBody .qmc img').length === 2);
  await page.click('#qmBody .qmc[data-st="1"] button[data-v="0"]');   // Ben's answer marked wrong first
  await page.waitForFunction(() => document.querySelector('#qmBody .qmc[data-st="1"]').classList.contains('wrong'));
  assert.equal(await page.$$eval('#qmBody [data-ex]', b => b.length), 2, 'every answer card has ☆ Example');
  assert.match(await page.$eval('#qmHint', e => e.textContent), /E example/);
  const before = await workNow(page);
  await page.click('#qmBody .qmc[data-st="0"] [data-ex]');
  await page.waitForFunction(() => window.__gs.exList().length === 1, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#qmBody .qmc[data-st="0"] [data-ex]').getAttribute('aria-pressed') === 'true');
  assert.match(await page.$eval('.toast', e => e.textContent), /Saved as an example for Question 1/);
  let [r] = await exList(page);
  assert.equal(r.kind, 'answer'); assert.equal(r.q.lab, '1'); assert.equal(r.from.key, 'Ann Testcase');
  noNames(JSON.stringify({ ...r, from: null }), 'the record');
  const px = await picFacts(page, r.id, 0);
  assert.ok(px.longest > 60, 'a cover is painted where the name was: longest black run ' + px.longest + ' of ' + px.w);
  assert.equal(px.red, 0, 'the teacher’s marks aren’t on the cut');
  assert.equal(await workNow(page), before, 'scores, marks and the quiz are unchanged');
  // A second press takes it back.
  await page.click('#qmBody .qmc[data-st="0"] [data-ex]');
  await page.waitForFunction(() => window.__gs.exList().length === 0);
  // E on a card in focus keeps it, and Undo in the note takes it back.
  await page.focus('#qmBody .qmc[data-st="1"]');
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__gs.exList().length === 1, { timeout: 30000 });
  [r] = await exList(page);
  assert.equal(r.from.key, 'Ben Specimen'); assert.equal(r.q.v, 0, 'the points it got are kept');
  assert.equal(await page.$eval('#qmBody .qmc[data-st="1"] [data-ex]', b => b.getAttribute('aria-pressed')), 'true');
  await page.evaluate(() => [...document.querySelectorAll('.toast .tact')].find(b => b.textContent === 'Undo').click());
  await page.waitForFunction(() => window.__gs.exList().length === 0);
  await page.waitForFunction(() => document.querySelector('#qmBody .qmc[data-st="1"] [data-ex]').getAttribute('aria-pressed') === 'false');
  // Kept again, then See examples goes to the Examples tab.
  await page.click('#qmBody .qmc[data-st="1"] [data-ex]');
  await page.waitForFunction(() => window.__gs.exList().length === 1, { timeout: 30000 });
  await page.evaluate(() => [...document.querySelectorAll('.toast .tact')].find(b => b.textContent === 'See examples').click());
  await page.waitForFunction(() => /\/examples$/.test(location.hash) && document.querySelectorAll('#exBody .excard.answer').length === 1);
  assert.equal(await page.$eval('#examplesTab', a => a.hidden), false, 'the tab shows once there is an example');
  assert.equal(await page.$eval('#examplesTab .atn', a => a.textContent), '1');
  assert.match(await page.$eval('#exBody', e => e.textContent), /Only you see this: Ben Specimen/);
  assert.equal(await workNow(page), before, 'still unchanged');
  // The answer survives a refresh: it is in its own database.
  await page.reloadHere();
  await page.waitForFunction(() => document.querySelectorAll('#exBody .excard.answer img[src]').length === 1, { timeout: 60000 });
  await close();
});

test('a whole paper and part of a page: covers painted in, marks off unless switched on, names never in the record or a download', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, essayZip, 'River essay.zip');
  await waitPaper(page);
  await markPage(page, 0);
  await settle(page);
  const before = await workNow(page);
  assert.equal(await page.$eval('#examplesTab', a => a.hidden), true, 'no Examples tab before there is one');
  await pick(page, '[data-whodo="example"]');
  await page.waitForFunction(() => document.querySelectorAll('#exPv canvas.exc').length === 2, { timeout: 60000 });
  const covered = () => page.$eval('#exNames', e => +(e.textContent.match(/^(\d+) names? covered/) || [0, -1])[1]);
  const n0 = await covered();
  assert.equal(n0, 2, 'the name on each page is covered, and counted once');
  assert.match(await page.$eval('#exLockSay', e => e.textContent), /Example A/);
  // A box drawn by hand covers something else, and is kept for Check the covers too.
  const r1 = await page.$eval('#exPv .expg[data-k="1"] canvas', c => { c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(r1.x + 0.1 * r1.w, r1.y + 0.5 * r1.h); await page.mouse.down();
  await page.mouse.move(r1.x + 0.5 * r1.w, r1.y + 0.56 * r1.h, { steps: 5 }); await page.mouse.up();
  await page.waitForFunction(n => new RegExp('^' + (n + 1) + ' names covered').test(document.querySelector('#exNames').textContent), {}, n0);
  assert.equal(await page.evaluate(() => Object.values(window.__gs.state().batch.share.boxes).flat().length), 1, 'the box is with the paper’s covers');
  await page.type('#exWhy', 'Every claim is tied to a moment in the story.');
  await page.click('[data-exsave]');
  await page.waitForFunction(() => window.__gs.exList().length === 1 && document.querySelector('#dlg').hidden, { timeout: 60000 });
  let [r] = await exList(page);
  assert.equal(r.kind, 'paper'); assert.equal(r.letter, 'A'); assert.equal(r.pages.length, 2); assert.equal(r.marks, false);
  assert.equal(r.why, 'Every claim is tied to a moment in the story.'); assert.equal(r.from.key, 'Cara Sample');
  noNames(JSON.stringify({ ...r, from: null }), 'the record');
  let px = await picFacts(page, r.id, 0);
  assert.ok(px.longest > 60, 'page 1 has its cover: ' + px.longest);
  assert.equal(px.red, 0, 'marks are off by default');
  // Part of a page, with marks on: only the part is kept, and the marks show on it.
  await pick(page, '[data-whodo="example"]');
  await page.waitForFunction(() => document.querySelectorAll('#exPv canvas.exc').length === 2, { timeout: 60000 });
  await page.click('[data-exk="part"]');
  await page.click('[data-exsw="marks"]');
  await page.waitForFunction(() => window.__gs.exUse() && window.__gs.exUse().marks && document.querySelectorAll('#exPv canvas.exc').length === 2);
  await new Promise(r => setTimeout(r, 1500));   // the redraw with marks
  assert.equal(await page.$eval('[data-exsave]', b => b.disabled), true, 'nothing to save before a box is drawn');
  const r0 = await page.$eval('#exPv .expg[data-k="0"] canvas', c => { c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(r0.x + 0.05 * r0.w, r0.y + 0.3 * r0.h); await page.mouse.down();
  await page.mouse.move(r0.x + 0.6 * r0.w, r0.y + 0.45 * r0.h, { steps: 5 }); await page.mouse.up();
  await page.waitForFunction(() => !document.querySelector('#exPv .excrop').hidden && !document.querySelector('[data-exsave]').disabled);
  await page.click('[data-exsave]');
  await page.waitForFunction(() => window.__gs.exList().length === 2, { timeout: 60000 });
  r = (await exList(page)).find(x => x.kind === 'part');
  assert.equal(r.pages.length, 1); assert.equal(r.marks, true);
  px = await picFacts(page, r.id, 0);
  assert.ok(px.w > px.h * 1.5, 'only the part is kept: ' + px.w + '×' + px.h);
  assert.ok(px.red > 50, 'with the switch on, her marks are on it: ' + px.red);
  assert.equal(await workNow(page), before, 'scores and marks are unchanged');
  // The tab: Download and the sheet are named after the assignment, never a student; the sheet has no text from the paper.
  await page.waitForFunction(() => !document.querySelector('#examplesTab').hidden);
  await goTo(page, await page.evaluate(() => '#/a/' + window.__gs.state().batch.id.replace(/^gs\.b\./, '') + '/examples'));
  await page.waitForFunction(() => document.querySelectorAll('#exBody .excard').length === 2);
  assert.match(await page.$eval('#exBody', e => e.textContent), /Example A/);
  const dl = await catchDownloads(page);
  const a = await dl.next(() => page.click('#exBody .excard.paper [data-exdl]'));
  assert.match(a.name, /Example A\.pdf$/); noNames(a.name, 'the download’s name');
  const b = await dl.next(() => page.click('#exBody .excard.part [data-exdl]'));
  assert.match(b.name, /Part A\.png$/); noNames(b.name, 'the download’s name');
  const s = await dl.next(() => page.click('[data-exsheet]'));
  assert.match(s.name, /Examples\.pdf$/); noNames(s.name, 'the sheet’s name');
  const text = await page.evaluate(async b64 => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), doc = await pdfjsLib.getDocument({ data: bytes }).promise; let t = '';
    for (let i = 1; i <= doc.numPages; i++) t += (await (await doc.getPage(i)).getTextContent()).items.map(x => x.str).join(' ') + '\n';
    return t;
  }, Buffer.from(s.bytes).toString('base64'));
  assert.match(text, /Example A/); assert.match(text, /Every claim is tied/);
  noNames(text, 'the sheet'); assert.ok(!/narrator returns/.test(text), 'no text from the paper is in the sheet');
  await dl.close();
  // Show to the class: full screen, no names anywhere, arrows move, Esc closes.
  await page.click('[data-exshow]');
  await page.waitForSelector('#exShow');
  noNames(await page.$eval('#exShow', e => e.textContent), 'Show to the class');
  assert.match(await page.$eval('#exShow', e => e.textContent), /1 of 2/);
  await page.keyboard.press('ArrowRight');
  assert.match(await page.$eval('#exShow', e => e.textContent), /2 of 2/);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#exShow'));
  // Forgetting the download keeps its examples; only whose they were goes.
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await goTo(page, '#/');
  await page.evaluate(i => window.__gs.forgetKept(i), id);
  const left = await exList(page);
  assert.equal(left.length, 2, 'the examples outlive the download');
  assert.ok(left.every(x => x.from === null), 'whose they were is dropped');
  await close();
});
