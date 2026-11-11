// The bank of rubrics and grading scales, sorted by unit: made in the Planner or saved from Rubric setup, the same bank
// either way, and copied to the Planner folder for Claude. Also the slider on each rubric row. Made-up classes and students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('./helpers/chrome');
const { openApp, answerDlg, openZip } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');
const ROOT = path.join(__dirname, '..');

// Grading and the Planner on one address, as on GitHub Pages.
function serveBoth() {
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0], file = p === '/' || p === '/index.html' ? 'index.html' : p === '/planner.html' ? 'planner.html' : null;
    if (!file && p !== '/blank') { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(file ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '<!doctype html><title>blank</title>');
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
const SETUP = {
  kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-08-31', semEnd: '2027-01-18',
  classes: [{ id: 'A1', name: 'Course A-1', course: 'Course A', color: '#1F6FB2', meets: [{ dow: 2, start: '09:00', end: '10:30' }] }]
};

let browser, zip;
before(async () => {
  browser = await launch();
  zip = zipOf({ 'Ada Sample/Essay.pdf': await makePaper({ title: 'Ada essay' }), 'Ben Sample/Essay.pdf': await makePaper({ title: 'Ben essay' }) });
});
after(async () => { await browser.close(); });

async function planner(ctx, srv) {
  const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(String(e)));
  await page.goto(srv.url + 'planner.html');
  await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
  return page;
}

test('a rubric made in the Planner sits under its unit, and grading uses it; one saved in grading shows in the Planner', async () => {
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    const pl = await planner(ctx, srv);
    await pl.evaluate(async s => {
      const P = window.__planner; await P.applySetup(s);
      await P.unitPut(P.normUnit({ course: 'Course A', title: 'Unit 2: Argument', start: '2026-10-26', weeks: [{}, {}, {}] }), true);
      await P.unitPut(P.normUnit({ course: 'Course A', title: 'Unit 3: Poetry', start: '2026-11-16', weeks: [{}, {}] }), true);
      P.L.view = 'bank'; P.renderLessons();
    }, SETUP);
    assert.match(await pl.$eval('.pl-bank', e => e.textContent), /Course A.*Unit 2: Argument.*Unit 3: Poetry/);
    // + Rubric on Unit 2
    const u2 = await pl.evaluate(() => window.__planner.L.units.find(u => u.title.startsWith('Unit 2')).id);
    await pl.click('[data-a="bnew"][data-bk="rubrics"][data-bu="' + u2 + '"]');
    await pl.waitForSelector('#dlgBox [data-bf="name"]');
    await pl.type('#dlgBox [data-bf="name"]', 'Claim paragraph');
    await pl.$eval('#dlgBox [data-bc="0"]', e => { e.value = ''; });
    await pl.type('#dlgBox [data-bc="0"]', 'Claim');
    await pl.$eval('#dlgBox .pl-brow details', d => { d.open = true; });
    await pl.type('#dlgBox [data-bl="0"][data-bv="4"]', 'A clear, arguable claim');
    await pl.click('#dlgBox [data-bpre="usual"]');
    await pl.click('#dlgBox [data-a="bsave"]');
    await pl.waitForFunction(() => document.querySelector('#dlg').hidden);
    assert.match(await pl.$eval('[data-bdrop="' + u2 + '"]', e => e.textContent), /Claim paragraph.*3 rows · out of 12 · what each score means · with a scale/);
    // a grading scale for Unit 3
    const u3 = await pl.evaluate(() => window.__planner.L.units.find(u => u.title.startsWith('Unit 3')).id);
    await pl.click('[data-a="bnew"][data-bk="scales"][data-bu="' + u3 + '"]');
    await pl.type('#dlgBox [data-bf="name"]', 'Steps of 5');
    await pl.click('#dlgBox [data-a="bsave"]');
    await pl.waitForFunction(() => document.querySelector('#dlg').hidden);
    assert.match(await pl.$eval('[data-bdrop="' + u3 + '"]', e => e.textContent), /Steps of 5.*top score 12/);
    // the unit page lists its own
    await pl.evaluate(id => { const P = window.__planner; P.L.unit = P.L.units.find(u => u.id === id); P.L.view = 'unit'; P.renderLessons(); }, u2);
    assert.match(await pl.$eval('.pl-unit', e => e.textContent), /Rubrics and grading scales.*Claim paragraph/);
    // the Planner wrote nothing of grading's
    assert.equal(await pl.evaluate(() => localStorage.getItem('gs.rubrics')), null);

    // grading: Rubric setup shows the bank by unit, and Use fills it in
    const g = await openApp(browser, { context: ctx, server: { url: srv.url, close: async () => {} } });
    const page = g.page;
    await openZip(page, zip);
    await page.evaluate(() => window.__gs.openSetup());
    await page.waitForSelector('#rbUnit');
    assert.match(await page.$eval('#setupBody', e => e.textContent), /Rubric bank.*Course A · Unit 2: Argument.*Claim paragraph/);
    const rid = await page.$eval('[data-rbuse]', b => b.dataset.rbuse);
    await page.click('[data-rbuse="' + rid + '"]');
    await page.waitForFunction(() => document.querySelector('#setupBody [data-ci="0"]').value === 'Claim');
    // the saved scale is offered for a 12-point rubric
    const opts = await page.$$eval('[data-scuse] option', o => o.map(x => x.textContent));
    assert.deepEqual(opts, ['My saved scales…', 'Steps of 5 (Course A · Unit 3: Poetry)']);
    await page.select('[data-scuse]', await page.$eval('[data-scuse] option:nth-child(2)', o => o.value));
    await page.waitForFunction(() => document.querySelector('#setupBody [data-sk="0"]').value === '40');
    // save it back to the bank under Unit 3
    await page.click('#dlgBox [data-rbsave]');
    await page.waitForSelector('#askUnit');
    await page.select('#askUnit', u3);
    await answerDlg(page, { typed: 'Poem response' });
    await page.waitForFunction(() => !document.querySelector('#askDlg'));
    await page.waitForFunction(() => localStorage.getItem('gs.rubrics'));   // written once the bank has it
    const legacy = await page.evaluate(() => JSON.parse(localStorage.getItem('gs.rubrics')));
    assert.deepEqual(legacy.map(r => r.name), ['Poem response'], 'still kept for the take-home file');
    assert.equal(legacy[0].unit.title, 'Unit 3: Poetry');
    // the open Planner tab hears about it
    await pl.evaluate(() => { const P = window.__planner; P.L.view = 'bank'; P.renderLessons(); });
    await pl.waitForFunction(id => /Poem response/.test(document.querySelector('[data-bdrop="' + id + '"]').textContent), { polling: 100 }, u3);   // the Planner's tab is behind grading's by now, and a tab in the background doesn't animate, so polling by the clock
    // moving one to another unit
    await pl.evaluate(async (u2) => {
      const c = [...document.querySelectorAll('.pl-bcard')].find(x => /Poem response/.test(x.textContent)), dt = new DataTransfer();
      c.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
      document.querySelector('[data-bdrop="' + u2 + '"]').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, u2);
    await pl.waitForFunction(id => /Poem response/.test(document.querySelector('[data-bdrop="' + id + '"]').textContent), { polling: 100 }, u2);
    // nothing about a student reaches the bank
    const bank = await pl.evaluate(() => JSON.stringify(window.__planner.L.bank));
    assert.ok(!/Ada|Ben|Sample/.test(bank), bank);
    assert.deepEqual(pl.errors, []); assert.deepEqual(page.errors, []);
  } finally { await ctx.close(); await srv.close(); }
});

test('rubrics saved before the bank come in, and a delete stays deleted', async () => {
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    const old = [{ id: 'r1', name: 'Old essay', criteria: ['Thesis', 'Evidence', 'Style'], scale: null, at: 1 }, { id: 'r2', name: 'Old lab', criteria: ['Method'], scale: null, at: 1 }];
    const g = await openApp(browser, { context: ctx, server: { url: srv.url, close: async () => {} }, seed: { ls: { 'gs.rubrics': JSON.stringify(old) } } });
    await g.page.evaluate(() => window.__gs.openSetup());
    await g.page.waitForSelector('[data-rbdel="r2"]');
    await g.page.click('[data-rbdel="r2"]'); await answerDlg(g.page);
    await g.page.waitForFunction(() => !document.querySelector('[data-rbdel="r2"]'));
    const pl = await planner(ctx, srv);
    await pl.evaluate(() => { const P = window.__planner; P.L.view = 'bank'; P.renderLessons(); });
    const t = await pl.$eval('.pl-bank', e => e.textContent);
    assert.match(t, /Not in a unit yet.*Old essay/);
    assert.ok(!/Old lab/.test(t));
    assert.deepEqual(g.page.errors, []); assert.deepEqual(pl.errors, []);
  } finally { await ctx.close(); await srv.close(); }
});

test('the Planner folder gets the bank under Rubrics/, and takes a rubric Claude wrote', async () => {
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    const pl = await planner(ctx, srv);
    const r = await pl.evaluate(async s => {
      const P = window.__planner; await P.applySetup(s);
      const u = P.normUnit({ course: 'Course A', title: 'Unit 1', start: '2026-08-31', weeks: [{}] }); await P.unitPut(u, true);
      await P.bankPut('rubrics', P.normRubric({ name: 'Exit ticket', criteria: ['Idea'], unit: { id: u.id, course: u.course, title: u.title } }));
      const root = await navigator.storage.getDirectory(), dir = await root.getDirectoryHandle('plan-' + Date.now(), { create: true });
      P.L.dir = dir; P.L.dirOk = true;
      await P.folderWriteAll();
      const rd = await dir.getDirectoryHandle('Rubrics'), names = []; for await (const [n] of rd.entries()) names.push(n);
      const mine = JSON.parse(await (await (await rd.getFileHandle('Exit ticket.rubric.json')).getFile()).text());
      const readme = await (await (await dir.getFileHandle('README - for Claude.md')).getFile()).text();
      // Claude adds one
      const fh = await rd.getFileHandle('Seminar.rubric.json', { create: true }), w = await fh.createWritable();
      await w.write(JSON.stringify({ name: 'Seminar', unit: { course: 'Course A', title: 'Unit 1' }, criteria: ['Listening', 'Evidence', 'Questions'], levels: [{ 4: 'Builds on others' }, {}, {}], scale: { 12: 100, 11: 95, 0: 40 } })); await w.close();
      await P.folderRead(false);
      const got = P.L.bank.rubrics.find(x => x.name === 'Seminar');
      return { names, mine, readme: /Rubrics\/\*\.rubric\.json/.test(readme), got, uid: u.id };
    }, SETUP);
    assert.deepEqual(r.names, ['Exit ticket.rubric.json']);
    assert.deepEqual(r.mine.unit, { course: 'Course A', title: 'Unit 1' });
    assert.ok(r.readme);
    assert.equal(r.got.unit.id, r.uid, 'Claude names the unit; the app links it');
    assert.deepEqual(r.got.criteria, ['Listening', 'Evidence', 'Questions']);
    assert.equal(r.got.levels[0][4], 'Builds on others');
    assert.ok(r.got.id, 'given an id');
    assert.deepEqual(pl.errors, []);
  } finally { await ctx.close(); await srv.close(); }
});

test('rubric rows score on a slider: drag, click a number, keys, and clearing', async () => {
  const { page, close } = await openApp(browser);
  try {
    await page.setViewport({ width: 1280, height: 800 });
    await openZip(page, zip);
    const rows = () => page.evaluate(() => window.__gs.state().batch.students[window.__gs.state().cur].grade.rubric.slice(0, 3));
    assert.equal(await page.$$eval('#grade .srange', e => e.length), 3);
    assert.ok(await page.$eval('#grade .srange', e => e.classList.contains('unset')), 'faded until scored');
    // drag row 1 to the far right: 4
    const box = await page.$eval('.scores[data-c="0"] .srange', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
    await page.mouse.move(box.x + 10, box.y); await page.mouse.down(); await page.mouse.move(box.x + box.w - 2, box.y, { steps: 6 }); await page.mouse.up();
    await page.waitForFunction(() => window.__gs.state().batch.students[window.__gs.state().cur].grade.rubric[0] === 4);
    assert.match(await page.$eval('#grade .total', e => e.textContent), /^4/);
    assert.notEqual(await page.evaluate(() => document.activeElement.className), 'srange', 'after the mouse, ← → still move between students');
    // a first click right on the faded thumb (at 0) counts as 0
    const b2 = await page.$eval('.scores[data-c="1"] .srange', e => { const r = e.getBoundingClientRect(); return { x: r.left + 10, y: r.top + r.height / 2 }; });
    await page.mouse.click(b2.x, b2.y);
    await page.waitForFunction(() => window.__gs.state().batch.students[window.__gs.state().cur].grade.rubric[1] === 0);
    // the numbers under it still work, and clicking the same one again clears
    await page.click('.scores[data-c="2"] button[data-v="2.5"]');
    assert.deepEqual(await rows(), [4, 0, 2.5]);
    // keys: arrows step through 0, 1, 1.5 … and Delete clears
    await page.focus('.scores[data-c="2"] .srange');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => window.__gs.state().batch.students[window.__gs.state().cur].grade.rubric[2] === 3);
    assert.equal(await page.evaluate(() => window.__gs.state().cur), 0, 'arrows on a slider change the score, not the student');
    await page.keyboard.press('Delete');
    await page.waitForFunction(() => window.__gs.state().batch.students[window.__gs.state().cur].grade.rubric[2] == null);
    await page.click('.scores[data-c="1"] button[data-v="0"]');
    assert.equal((await rows())[1], null);
    assert.deepEqual(page.errors, []);
  } finally { await close(); }
});
