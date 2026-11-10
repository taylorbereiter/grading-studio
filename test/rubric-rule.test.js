// The one rule about rubrics, in the real built app: when an assignment card's rubric and a download's disagree in a way that would change a total or a percent, she's asked, and nothing is decided for her. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { classPage, openApp, openZip, pickFile, waitPaper, score, settle, appReady } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');
const { takeHome, openFile, bringIt, linkFolder, folderWait, folderRead, folderWrite } = require('./helpers/carry');

let browser, zip, zip2;
before(async () => {
  browser = await launch();
  zip = zipOf({ 'Nia Turnwell/Essay.pdf': await makePaper({ title: 'Nia essay' }), 'Oren Turnwell/Essay.pdf': await makePaper({ title: 'Oren essay' }) });
  zip2 = zipOf({ 'Pia Sample/Poem.pdf': await makePaper({ title: 'Pia poem' }), 'Quin Sample/Poem.pdf': await makePaper({ title: 'Quin poem' }) });
});
after(async () => { await browser.close(); });

const R3 = { mode: 'rubric', criteria: ['Thesis', 'Evidence', 'Style'] };
const R4 = { mode: 'rubric', criteria: ['Thesis', 'Evidence', 'Style', 'Voice'] };
const libOf = (...items) => JSON.stringify({ classes: [{ id: 'c1', name: '9A', names: [], units: [{ id: 'u1', name: 'Rivers', items: items.map(x => ({ classId: 'c1', ...x })) }] }], loose: { id: '', units: [] }, units: [] });
const closeUp = async page => { await settle(page); await page.click('#closeBtn'); await page.waitForFunction(() => document.querySelector('#start').hidden === false); await new Promise(r => setTimeout(r, 300)); };
// The card's own button, and the file input behind it. wait: false stops at any question.
async function viaCard(page, name, bytes, wait = true) {
  await classPage(page, name);
  await page.evaluate(n => [...document.querySelectorAll('.card')].find(x => x.textContent.includes(n)).querySelector('[data-open-asg]').click(), name);
  await page.waitForSelector('#dlgBox [data-cancel]');
  await page.click('#dlgBox [data-cancel]');
  const clean = await pickFile(page, '#asgIn', bytes, name + '.zip');
  if (wait) await waitPaper(page);
  return clean;
}
const dropZip = async (page, bytes, name = 'River.zip') => pickFile(page, '#fileIn', bytes, name);
const cont = page => page.evaluate(() => document.querySelector('#kept .krow [data-kopen]').click());
const addRow = async page => {
  await page.click('#editRubric'); await page.waitForSelector('#setupBody');
  await page.click('#dlgBox [data-add]'); await page.click('#dlgBox [data-save]');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
};
const rename = async (page, text) => {
  await page.click('#editRubric'); await page.waitForSelector('#setupBody');
  await page.$eval('#setupBody input', (e, t) => { e.value = t; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, text);
  await page.click('#dlgBox [data-save]');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
};
const answer = async (page, side) => { await page.click('#cfBox input[value="' + side + '"]'); await page.click('[data-cfok]'); };
const noQuestion = async (page, what) => assert.equal(await page.$('#cfBox'), null, what || 'nothing to ask');
const grade = (page, key = 'Nia Turnwell') => page.evaluate(k => { const G = window.__gs, st = G.state().batch.students.find(s => s.key === k), o = G.ownGrade(st); return { rubric: st.grade.rubric, total: o.total, pct: o.pct, rows: G.state().setup.criteria.length }; }, key);
const cardRows = (page, id = 'asg1') => page.evaluate(i => { const l = window.__gs.state().lib, it = [...l.classes, l.loose].flatMap(c => c.units).flatMap(u => u.items).find(x => x.id === i); return it && it.setup ? it.setup.criteria.length : null; }, id);

// A ZIP dropped with no card, a row added and scored, and then the card it belongs to opens it.
for (const [side, rows, total, pct, cardN] of [['a', 3, 9, 86, 3], ['b', 4, 13, 81, 4]]) test('a card and a download with different rubrics: she’s asked, and what she picks holds everywhere: ' + side, async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': libOf({ id: 'asg1', name: 'River card', setup: R3 }) } } });
  await openZip(page, zip, 'River.zip');
  await addRow(page);
  await score(page, [3, 3, 3, 4]);
  assert.equal((await grade(page)).pct, 81);
  await closeUp(page);
  // Not now: nothing opens, and nothing has changed.
  let clean = await viaCard(page, 'River card', zip, false);
  await page.waitForSelector('#cfBox');
  const text = await page.$eval('#cfBox', e => e.innerText);
  assert.match(text, /On the assignment card/); assert.match(text, /Saved with this download/);
  assert.match(text, /3 rows, out of 12/); assert.match(text, /4 rows, out of 16/); assert.match(text, /Scores stay saved/);
  assert.equal(await page.$('#cfBox ~ .bf [data-cfnew]'), null, 'there’s no picking by date');
  await page.click('#dlgBox [data-cflater]');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  assert.equal(await page.evaluate(() => document.querySelector('#app').hidden), true, 'not now opens nothing');
  assert.equal(await cardRows(page), 3);
  clean();
  // And it asks again.
  clean = await viaCard(page, 'River card', zip, false);
  await page.waitForSelector('#cfBox');
  await answer(page, side);
  await waitPaper(page); clean();
  let g = await grade(page);
  assert.deepEqual(g.rubric, [3, 3, 3, 4], 'the scores stay saved either way');
  assert.equal(g.rows, rows); assert.equal(g.total, total); assert.equal(g.pct, pct);
  assert.equal(await cardRows(page), cardN);
  await closeUp(page);
  // It's settled, whichever way she comes back.
  await cont(page); await waitPaper(page); await noQuestion(page, 'Continue doesn’t ask again');
  g = await grade(page); assert.equal(g.total, total); assert.equal(g.pct, pct);
  await closeUp(page);
  clean = await dropZip(page, zip); await waitPaper(page); clean(); await noQuestion(page, 'nor does dropping the ZIP');
  g = await grade(page); assert.equal(g.total, total); assert.equal(g.pct, pct);
  await page.reload(); await appReady(page);
  assert.equal(await cardRows(page), cardN, 'the card kept it');
  assert.deepEqual(page.errors, []);
  await close();
});

test('rubrics that give the same totals and percents ask nothing, and the card’s words stand', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': libOf({ id: 'asg1', name: 'River card', setup: R3 }), 'gs.setup': JSON.stringify(R3) } } });
  await openZip(page, zip, 'River.zip');
  await rename(page, 'Claim');
  await score(page, [3, 3, 3]);
  await closeUp(page);
  const clean = await viaCard(page, 'River card', zip);
  clean(); await noQuestion(page);
  const g = await grade(page);
  assert.equal(g.total, 9); assert.equal(g.pct, 86);
  assert.equal(await page.evaluate(() => window.__gs.state().setup.criteria[0]), 'Thesis');
  assert.deepEqual(page.errors, []);
  await close();
});

test('with no scores nothing can change, so nothing is asked and the card’s rubric stands', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': libOf({ id: 'asg1', name: 'River card', setup: R3 }) } } });
  await openZip(page, zip, 'River.zip');
  await addRow(page);
  await closeUp(page);
  const clean = await viaCard(page, 'River card', zip);
  clean(); await noQuestion(page);
  assert.equal((await grade(page)).rows, 3);
  assert.deepEqual(page.errors, []);
  await close();
});

// Problem (a), the way it really comes up: a new card with nothing saved on it, then another assignment saves a different rubric.
test('a new card’s grade doesn’t move when another assignment saves a different rubric', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': libOf({ id: 'asg1', name: 'River card' }, { id: 'asg2', name: 'Poem card' }), 'gs.setup': JSON.stringify(R3) } } });
  let clean = await viaCard(page, 'River card', zip); clean();
  await noQuestion(page, 'a card opened for the first time has nothing to disagree about');
  await score(page, [3, 3, 3]);
  assert.equal((await grade(page)).pct, 86);
  assert.equal(await cardRows(page), 3, 'and the card now keeps it');
  await closeUp(page);
  clean = await viaCard(page, 'Poem card', zip2); clean();
  await addRow(page);
  await closeUp(page);
  clean = await dropZip(page, zip); await waitPaper(page); clean();
  await noQuestion(page);
  assert.equal((await grade(page)).pct, 86, 'dropped in again');
  await closeUp(page);
  await page.evaluate(() => [...document.querySelectorAll('#kept .krow')].find(r => r.textContent.includes('River')).querySelector('[data-kopen]').click());
  await waitPaper(page); await noQuestion(page);
  assert.equal((await grade(page)).pct, 86, 'and on Continue');
  assert.deepEqual(page.errors, []);
  await close();
});

// Problem (a) where it was still open: work that doesn't say what rubric it was scored with. The last rubric saved has nothing to do with it.
for (const [what, withCard] of [['a card with no rubric', true], ['no card', false]]) for (const [side, rows, total, pct] of [['b', 3, 9, 86], ['a', 4, 9, 56]]) test('old scores that don’t say their rubric and don’t fit the last one saved: she’s asked, with ' + what + ': ' + side, async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.setup': JSON.stringify(R3) } } });
  await openZip(page, zip, 'River.zip');
  await score(page, [3, 3, 3]);
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await closeUp(page);
  await page.evaluate(async (id, withCard, lib, R4) => {
    const w = JSON.parse(localStorage.getItem(id)); delete w.setup; delete w.pv; delete w.sv; localStorage.setItem(id, JSON.stringify(w));
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
    await new Promise(res => { const tx = db.transaction('work', 'readwrite'), o = tx.objectStore('work'), q = o.get(id); q.onsuccess = () => { const x = q.result; delete x.setup; delete x.pv; delete x.sv; o.put(x, id); }; tx.oncomplete = res; });
    db.close();
    localStorage.setItem('gs.setup', JSON.stringify(R4));
    if (withCard) localStorage.setItem('gs.lib', lib.replace('"BID"', JSON.stringify(id)));
  }, id, withCard, libOf({ id: 'asg1', name: 'River card', batchId: 'BID' }), R4);
  await page.reload(); await appReady(page);
  let clean = await dropZip(page, zip);
  await page.waitForSelector('#cfBox');
  const text = await page.$eval('#cfBox', e => e.innerText);
  assert.match(text, /The last rubric you saved/); assert.match(text, /4 rows, out of 16/);
  assert.match(text, /One that fits these scores/); assert.match(text, /3 rows, out of 12/);
  await answer(page, side);
  await waitPaper(page); clean();
  let g = await grade(page);
  assert.deepEqual(g.rubric, [3, 3, 3]);
  assert.equal(g.rows, rows); assert.equal(g.total, total); assert.equal(g.pct, pct);
  if (withCard) assert.equal(await cardRows(page), rows);
  await closeUp(page);
  clean = await dropZip(page, zip); await waitPaper(page); clean();
  await noQuestion(page, 'it’s recorded now');
  g = await grade(page); assert.equal(g.pct, pct);
  assert.deepEqual(page.errors, []);
  await close();
});

test('old scores that fit the last rubric saved open on it, with nothing asked', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.setup': JSON.stringify(R3) } } });
  await openZip(page, zip, 'River.zip');
  await score(page, [3, 3, 3]);
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await closeUp(page);
  await page.evaluate(async id => {
    const w = JSON.parse(localStorage.getItem(id)); delete w.setup; localStorage.setItem(id, JSON.stringify(w));
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); });
    await new Promise(res => { const tx = db.transaction('work', 'readwrite'), o = tx.objectStore('work'), q = o.get(id); q.onsuccess = () => { const x = q.result; delete x.setup; o.put(x, id); }; tx.oncomplete = res; });
    db.close();
  }, id);
  await page.reload(); await appReady(page);
  const clean = await dropZip(page, zip); await waitPaper(page); clean();
  await noQuestion(page);
  assert.equal((await grade(page)).pct, 86);
  assert.deepEqual(page.errors, []);
  await close();
});

// Problem (b). The card and the ZIP are on the laptop. At home the ZIP is dropped in first, with a row of her own, and then the card comes.
async function ownRowAtHome() {
  const lap = await openApp(browser, { seed: { ls: { 'gs.lib': libOf({ id: 'asg1', name: 'River card', setup: R3 }) } } });
  const clean = await viaCard(lap.page, 'River card', zip); clean();
  await closeUp(lap.page);
  const home = await openApp(browser, { seed: { ls: { 'gs.setup': JSON.stringify(R3) } } });
  await openZip(home.page, zip, 'River.zip');
  await addRow(home.page);
  await score(home.page, [3, 3, 3, 4]);
  assert.equal((await grade(home.page)).pct, 81);
  await closeUp(home.page);
  const r = await openFile(home.page, await takeHome(lap.page));
  return { lap, home, preview: r.preview || r.error };
}
for (const [side, rows, total, pct] of [['a', 4, 13, 81], ['b', 3, 9, 86]]) test('a ZIP dropped before its card came, with a row of her own: the preview asks, and her answer holds on both computers: ' + side, async () => {
  const { lap, home, preview } = await ownRowAtHome();
  assert.match(preview, /Rubric setup/); assert.match(preview, /4 rows, out of 16/); assert.match(preview, /3 rows, out of 12/);
  assert.doesNotMatch(preview, /later one is kept/, 'it doesn’t say something was chosen');
  assert.doesNotMatch(preview, /Comes in from this file: [^\n]*Rubric setup/);
  assert.match(preview, /New assignment: River card/);
  assert.equal((await home.page.$$('.cfrow')).length, 1, 'one question');
  await home.page.click('#bringGo');
  await home.page.waitForFunction(() => document.querySelector('#bringBox'));
  assert.equal(await home.page.evaluate(() => !document.querySelector('#takeMsg')), true, 'it waits for her answer');
  await home.page.click('#bringBox input[value="' + side + '"]');
  await bringIt(home.page);
  assert.equal(await cardRows(home.page), rows, 'the card goes with her answer');
  await cont(home.page); await waitPaper(home.page); await noQuestion(home.page, 'and opening it has nothing left to ask');
  let g = await grade(home.page);
  assert.deepEqual(g.rubric, [3, 3, 3, 4]);
  assert.equal(g.rows, rows); assert.equal(g.total, total); assert.equal(g.pct, pct);
  await closeUp(home.page);
  const clean = await dropZip(home.page, zip); await waitPaper(home.page); clean(); await noQuestion(home.page);
  g = await grade(home.page); assert.equal(g.total, total); assert.equal(g.pct, pct);
  await closeUp(home.page);
  // The laptop gets the same answer, and isn't asked.
  const back = await openFile(lap.page, await takeHome(home.page));
  assert.doesNotMatch(back.preview || back.error, /later one is kept/);
  assert.equal((await lap.page.$$('.cfrow')).length, 0);
  if (await lap.page.$('#bringGo')) await bringIt(lap.page); else await lap.page.click('#dlgBox [data-close]');
  await cont(lap.page); await waitPaper(lap.page); await noQuestion(lap.page);
  g = await grade(lap.page); assert.equal(g.total, total); assert.equal(g.pct, pct);
  assert.equal(await cardRows(lap.page), rows);
  assert.deepEqual(home.page.errors.concat(lap.page.errors), []);
  await lap.close(); await home.close();
});

test('an ordinary change on one computer, with the card and the download moving together, asks nothing', async () => {
  const lap = await openApp(browser, { seed: { ls: { 'gs.lib': libOf({ id: 'asg1', name: 'River card', setup: R3 }) } } });
  const clean = await viaCard(lap.page, 'River card', zip); clean();
  await score(lap.page, [3, 3, 3]);
  await closeUp(lap.page);
  const home = await openApp(browser);
  await openFile(home.page, await takeHome(lap.page));
  await bringIt(home.page);
  await cont(lap.page); await waitPaper(lap.page);
  await addRow(lap.page);
  await score(lap.page, [null, null, null, 4]);
  await closeUp(lap.page);
  const r = await openFile(home.page, await takeHome(lap.page));
  assert.equal((await home.page.$$('.cfrow')).length, 0, 'nothing to ask');
  assert.match(r.preview, /Comes in from this file: [^\n]*Rubric setup/);
  await bringIt(home.page);
  await cont(home.page); await waitPaper(home.page); await noQuestion(home.page);
  const g = await grade(home.page);
  assert.equal(g.rows, 4); assert.equal(g.total, 13);
  assert.deepEqual(home.page.errors.concat(lap.page.errors), []);
  await lap.close(); await home.close();
});

test('a difference that comes in already there is named in the preview, and asked about at opening', async () => {
  const lap = await openApp(browser, { seed: { ls: { 'gs.lib': libOf({ id: 'asg1', name: 'River card', setup: R3 }) } } });
  const clean = await viaCard(lap.page, 'River card', zip); clean();
  await addRow(lap.page);
  await score(lap.page, [3, 3, 3, 4]);
  await closeUp(lap.page);
  // The row is saved with the download, not on the card, as work from before this rule can be.
  await lap.page.evaluate(() => { const l = window.__gs.state().lib; l.classes[0].units[0].items[0].setup.criteria.pop(); localStorage.setItem('gs.lib', JSON.stringify(l)); });
  const home = await openApp(browser);
  const r = await openFile(home.page, await takeHome(lap.page));
  assert.match(r.preview, /doesn’t match its assignment card/);
  assert.match(r.preview, /asked which one to use when you open it/);
  assert.equal((await home.page.$$('.cfrow')).length, 0);
  await bringIt(home.page);
  await cont(home.page);
  await home.page.waitForSelector('#cfBox');
  await answer(home.page, 'b');
  await waitPaper(home.page);
  const g = await grade(home.page);
  assert.equal(g.rows, 4); assert.equal(g.total, 13);
  assert.equal(await cardRows(home.page), 4);
  assert.deepEqual(home.page.errors.concat(lap.page.errors), []);
  await lap.close(); await home.close();
});

test('a newer copy of a download, with a rubric of its own, asks before going by the card', async () => {
  const older = zipOf({ 'Nia Turnwell/Essay.pdf': await makePaper({ title: 'Nia essay' }), 'Oren Turnwell/Essay.pdf': await makePaper({ title: 'Oren essay' }) });
  const newer = zipOf({ 'Nia Turnwell/Essay.pdf': await makePaper({ title: 'Nia essay' }), 'Oren Turnwell/Essay.pdf': await makePaper({ title: 'Oren essay' }), 'Pia Sample/Essay.pdf': await makePaper({ title: 'Pia essay' }) });
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': libOf({ id: 'asg1', name: 'River card', setup: R3 }) } } });
  await openZip(page, older, 'River.zip');
  await addRow(page);
  await score(page, [3, 3, 3, 4]);
  await closeUp(page);
  const clean = await viaCard(page, 'River card', newer, false);
  await page.waitForSelector('#cfBox');
  await answer(page, 'b');
  await waitPaper(page); clean();
  const g = await grade(page);
  assert.equal(g.rows, 4); assert.equal(g.total, 13); assert.equal(g.pct, 81);
  assert.equal(await cardRows(page), 4);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a linked folder: its copy disagreeing with the card waits for her, stays as it is until then, and her answer reaches the card', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': libOf({ id: 'asg1', name: 'River card', setup: R3 }) } } });
  const clean = await viaCard(page, 'River card', zip); clean();
  await linkFolder(page, 'RuleCard');
  await score(page, [3, 3, 3]); await settle(page); await folderWait(page);
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  const there = await folderRead(page, 'downloads', id, 'work.json'), when = Date.now();
  there.setup = { ...there.setup, criteria: R4.criteria };
  there.pv = { ...there.pv, setup: { ...(there.pv || {}).setup, other: when } };
  await folderWrite(page, ['downloads', id, 'work.json'], there);
  await page.evaluate(() => window.__gs.folderReconcile());
  await page.waitForSelector('#cfBox', { timeout: 30000 });
  const text = await page.$eval('#cfBox', e => e.innerText);
  assert.match(text, /Rubric setup/); assert.match(text, /3 rows/); assert.match(text, /4 rows/);
  await page.click('[data-cflater]');
  await folderWait(page);
  assert.equal((await folderRead(page, 'downloads', id, 'work.json')).setup.criteria.length, 4, 'the folder keeps its own until she decides');
  assert.equal((await grade(page)).rows, 3, 'and so does this browser');
  assert.equal(await cardRows(page), 3);
  await page.click('#saveWhere');
  await page.waitForSelector('#cfBox');
  await answer(page, 'b');
  await page.waitForFunction(() => window.__gs.folderState().asks.length === 0 && window.__gs.state().setup.criteria.length === 4, { timeout: 30000 });
  await folderWait(page);
  assert.equal(await cardRows(page), 4, 'the card follows her answer');
  const lib = JSON.parse((await folderRead(page, 'library.json')).ls['gs.lib']);
  assert.equal(lib.classes[0].units[0].items[0].setup.criteria.length, 4, 'in the folder too');
  assert.deepEqual(page.errors, []);
  await close();
});

const noScale = async page => { await page.click('#editRubric'); await page.waitForSelector('#setupBody'); await page.click('#dlgBox [data-preset="none"]'); await page.click('#dlgBox [data-save]'); await page.waitForFunction(() => document.querySelector('#dlg').hidden); };
const cardScale = (page, id = 'asg1') => page.evaluate(i => { const l = window.__gs.state().lib, it = [...l.classes, l.loose].flatMap(c => c.units).flatMap(u => u.items).find(x => x.id === i); return it.setup.scale; }, id);

// No scale and the usual scale on 12 points: 9 out of 12 is 75% on one and 86% on the other.
for (const [side, pct] of [['a', 86], ['b', 75]]) test('No scale on a download against the usual scale on its card asks, and what she picks holds: ' + side, async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': libOf({ id: 'asg1', name: 'River card', setup: R3 }), 'gs.setup': JSON.stringify(R3) } } });
  await openZip(page, zip, 'River.zip');
  await noScale(page);
  await score(page, [3, 3, 3]);
  assert.equal((await grade(page)).pct, 75);
  await closeUp(page);
  const clean = await viaCard(page, 'River card', zip, false);
  await page.waitForSelector('#cfBox');
  const text = await page.$eval('#cfBox', e => e.innerText);
  assert.match(text, /The usual grading scale/); assert.match(text, /No scale: percent is the plain share of points/);
  await answer(page, side);
  await waitPaper(page); clean();
  assert.equal((await grade(page)).pct, pct);
  assert.equal((await cardScale(page)) === null, side === 'b', 'the card goes with her answer');
  await closeUp(page);
  await cont(page);
  await waitPaper(page);
  await noQuestion(page, 'she’s answered');
  assert.equal((await grade(page)).pct, pct);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the usual scale on a download against No scale on its card asks too', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': libOf({ id: 'asg1', name: 'River card', setup: { ...R3, scale: null } }), 'gs.setup': JSON.stringify(R3) } } });
  await openZip(page, zip, 'River.zip');
  await score(page, [3, 3, 3]);
  assert.equal((await grade(page)).pct, 86);
  await closeUp(page);
  const clean = await viaCard(page, 'River card', zip, false);
  await page.waitForSelector('#cfBox');
  await answer(page, 'a');
  await waitPaper(page); clean();
  assert.equal((await grade(page)).pct, 75);
  assert.deepEqual(page.errors, []);
  await close();
});

test('No scale at home and the usual scale on a card brought from the laptop: bringing it in asks, and doesn’t move the percent by itself', async () => {
  const lap = await openApp(browser, { seed: { ls: { 'gs.setup': JSON.stringify(R3), 'gs.lib': libOf({ id: 'asg1', name: 'River card' }) } } });
  (await viaCard(lap.page, 'River card', zip))();
  await closeUp(lap.page);
  const home = await openApp(browser, { seed: { ls: { 'gs.setup': JSON.stringify(R3) } } });
  await openZip(home.page, zip, 'River.zip');
  await noScale(home.page);
  await score(home.page, [3, 3, 3]);
  await closeUp(home.page);
  const { preview } = await openFile(home.page, await takeHome(lap.page));
  assert.doesNotMatch(preview, /Comes in from this file: Rubric setup/);
  assert.equal((await home.page.$$('#bringBox .cfrow')).length, 1, 'she’s asked');
  assert.match(preview, /No scale: percent is the plain share of points/);
  await home.page.click('#bringBox input[value="a"]');
  await bringIt(home.page);
  await cont(home.page);
  await waitPaper(home.page);
  await noQuestion(home.page, 'she’s answered');
  assert.equal((await grade(home.page)).pct, 75, 'she kept the one here');
  assert.deepEqual(home.page.errors, []);
  await lap.close(); await home.close();
});

const kept = page => page.$eval('#kept .krow [data-kopen]', b => ({ text: b.textContent, disabled: b.disabled }));
const toastIs = (page, re) => page.waitForFunction(s => new RegExp(s).test(document.querySelector('.toast').textContent), {}, re.source);
test('leaving the question with Esc or a click outside is a not now: it says so, and the button still works', async () => {
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': libOf({ id: 'asg1', name: 'River card', setup: R3 }) } } });
  (await viaCard(page, 'River card', zip))();
  await addRow(page);
  await score(page, [3, 3, 3, 4]);
  await closeUp(page);
  await page.evaluate(() => { const l = window.__gs.state().lib; l.classes[0].units[0].items[0].setup.criteria.pop(); localStorage.setItem('gs.lib', JSON.stringify(l)); });
  await page.reload(); await appReady(page);
  await page.waitForSelector('#kept .krow [data-kopen]');
  const label = (await kept(page)).text;
  for (const leave of [() => page.keyboard.press('Escape'), () => page.mouse.click(5, 5), () => page.click('[data-cflater]')]) {
    await cont(page);
    await page.waitForSelector('#cfBox');
    assert.equal((await kept(page)).disabled, true, 'while it’s asking');
    await page.$eval('.toast', t => { t.textContent = ''; });
    await leave();
    await page.waitForFunction(() => document.querySelector('#dlg').hidden);
    await toastIs(page, /Nothing was opened/);
    await page.waitForFunction(() => !document.querySelector('#kept .krow [data-kopen]').disabled);
    assert.deepEqual(await kept(page), { text: label, disabled: false }, 'the button is as it was');
    assert.equal(await page.evaluate(() => document.querySelector('#app').hidden), true, 'nothing opened');
    assert.equal(await cardRows(page), 3, 'nothing changed');
  }
  // And it can still be answered.
  await cont(page);
  await page.waitForSelector('#cfBox');
  await answer(page, 'b');
  await waitPaper(page);
  assert.equal((await grade(page)).pct, 81);
  assert.equal(await cardRows(page), 4);
  assert.deepEqual(page.errors, []);
  await close();
});
