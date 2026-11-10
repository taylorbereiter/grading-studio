// An open assignment's four tabs (Mark, Grades, Insights, Return), each a page with its own address, the Setup menu,
// the grade on the paper beside her score, "Returned", and the Insights charts. Driven through the real built app. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, PDFName, PDFString, PDFHexString } = require('pdf-lib');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, classPage, pickFile, waitPaper, goToStudent, score, markPage, settle, catchDownloads, goTo, press } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'], N2 = ['Kai Pretend', 'Lena Example', 'Milo Testcase'];
const SETUP = { mode: 'rubric', criteria: ['Thesis', 'Evidence', 'Style'], outOf: 12 };
const g = rubric => ({ f: {}, h: {}, g: { rubric, points: '', comment: '' } });
// 12EL-1 has an earlier summative (scored) and this one; 12EL-2 was given this one too (the same group), and has scored it.
function seed() {
  const lib = { classes: [
    { id: 'c1', name: '12EL-1', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [{ id: 'i0', name: 'Poetry commentary', classId: 'c1', type: 'sum', due: '2026-09-20', batchId: 'gs.b.past1', setup: SETUP }, { id: 'i1', name: 'River essay', classId: 'c1', type: 'sum', due: '2026-10-28', group: 'g1', setup: SETUP }] }] },
    { id: 'c2', name: '12EL-2', names: N2, units: [{ id: 'u2', name: 'Unit 1', items: [{ id: 'i2', name: 'River essay', classId: 'c2', type: 'sum', due: '2026-10-28', group: 'g1', batchId: 'gs.b.past2', setup: SETUP }] }] }], loose: { id: '', name: '', names: [], units: [] }, seed2627: true };
  const past1 = { t: Date.UTC(2026, 8, 20), cls: 'c1', setup: SETUP, s: { 'Aria Testwell': g([3, 3, 3]), 'Bram Sample': g([4, 4, 3]), 'Cleo Fixture': g([2, 2, 2]), 'Dov Madeup': g([3, 2, 2]) } };
  const past2 = { t: Date.UTC(2026, 9, 28), cls: 'c2', setup: SETUP, s: { 'Kai Pretend': g([4, 4, 4]), 'Lena Example': g([3, 3, 2]), 'Milo Testcase': g([2, 2, 2]) } };
  const rec = (id, name, asg, n) => [id, { id, name, n, t: Date.UTC(2026, 8, 21), asg }];
  return { ls: { 'gs.lib': JSON.stringify(lib), 'gs.b.past1': JSON.stringify(past1), 'gs.b.past2': JSON.stringify(past2) },
    idb: { 'grading-studio-keep': { version: 2, stores: { papers: [], work: [], edits: [], meta: [rec('gs.b.past1', 'Poetry commentary', 'i0', 4), rec('gs.b.past2', 'River essay 2', 'i2', 3)] } } } };
}
// A paper with a grade she typed on it in another app.
const withNote = async (title, text) => {
  const doc = await PDFDocument.load(await makePaper({ title })), ctx = doc.context;
  const note = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'FreeText', Rect: [60, 300, 300, 360], DA: PDFString.of('/Helv 12 Tf 0 g'), F: 4, Contents: PDFHexString.fromText(text) }));
  doc.getPage(0).node.set(PDFName.of('Annots'), ctx.obj([note]));
  return doc.save();
};
// The River essay card's download: Aria and Bram have a typed grade on the paper. Scores: Aria 10 (the paper says 9), Bram 10 (the paper agrees), Cleo 6, Dov none.
async function riverOpen() {
  const app = await openApp(browser, { seed: seed() }), { page } = app;
  const zip = zipOf({ 'Aria Testwell/Essay.pdf': await withNote('Aria Testwell', '9/12 = 75%'), 'Bram Sample/Essay.pdf': await withNote('Bram Sample', '10/12 = 83%'), 'Cleo Fixture/Essay.pdf': await makePaper({ title: 'Cleo Fixture' }), 'Dov Madeup/Essay.pdf': await makePaper({ title: 'Dov Madeup' }) });
  await classPage(page, 'i1'); await page.waitForSelector('[data-open-asg="i1"]'); await page.click('[data-open-asg="i1"]');
  await page.waitForSelector('#dlgBox [data-cancel]'); await page.click('#dlgBox [data-cancel]');
  const clean = await pickFile(page, '#asgIn', zip, 'River essay.zip'); await waitPaper(page); clean();
  await score(page, [4, 3, 3]);
  await goToStudent(page, 1); await score(page, [4, 3, 3]);
  await goToStudent(page, 2); await score(page, [2, 2, 2]);
  await goToStudent(page, 0); await waitPaper(page);
  return app;
}
const where = page => page.evaluate(() => ({ hash: location.hash.replace(/^#\/a\/[^/]+/, ''), page: !document.querySelector('#dlg').hidden && document.querySelector('#dlg').classList.contains('aspage'), box: !document.querySelector('#dlg').hidden && !document.querySelector('#dlg').classList.contains('aspage'), on: (document.querySelector('#aTabs .atab.on') || {}).textContent.replace(/\d+$/, '').trim() }));
const noErrors = page => assert.deepEqual(page.errors, []);
const pause = ms => new Promise(r => setTimeout(r, ms));

test('four tabs, each a page with its own address: clicks, Escape, Back and Refresh all follow them', async () => {
  const { page, close } = await riverOpen();
  assert.deepEqual(await where(page), { hash: '', page: false, box: false, on: 'Mark' });
  await page.click('#gradesBtn'); await page.waitForSelector('#glTable');
  assert.deepEqual(await where(page), { hash: '/grades', page: true, box: false, on: 'Grades' });
  const st = await page.evaluate(() => ({ role: document.querySelector('#dlgBox').getAttribute('role'), modal: document.querySelector('#dlgBox').getAttribute('aria-modal'), inert: document.querySelector('#cols .side').inert, close: getComputedStyle(document.querySelector('#dlgBox [data-close]')).display }));
  assert.deepEqual(st, { role: 'region', modal: null, inert: true, close: 'none' }, 'it is a page: no dialog, no ✕, and the papers under it take no keys');
  await page.click('.vseg a:nth-child(2)'); await page.waitForSelector('#shBody table');
  assert.deepEqual(await where(page), { hash: '/grades/sheet', page: true, box: false, on: 'Grades' });
  await page.click('#insightsTab'); await page.waitForSelector('#ovTiles');
  assert.deepEqual(await where(page), { hash: '/insights', page: true, box: false, on: 'Insights' });
  await page.click('#dlgBox [data-ovtab="cons"]'); await page.waitForSelector('#consBox');
  assert.deepEqual(await where(page), { hash: '/insights/consistency', page: true, box: false, on: 'Insights' });
  await page.click('#dlgBox [data-ovtab="pct"]'); await page.waitForSelector('#pTiles');
  assert.deepEqual(await where(page), { hash: '/insights', page: true, box: false, on: 'Insights' });
  await page.click('#exportBtn'); await page.waitForSelector('#rtSide');
  assert.deepEqual(await where(page), { hash: '/return', page: true, box: false, on: 'Return' });
  // Escape goes back to the papers, and they take keys again
  await page.keyboard.press('Escape'); await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  assert.deepEqual(await where(page), { hash: '', page: false, box: false, on: 'Mark' });
  assert.equal(await page.evaluate(() => document.querySelector('#cols .side').inert), false);
  // Back returns to the tab she left; the Mark tab is a way out too
  await page.goBack(); await page.waitForSelector('#rtSide');
  assert.deepEqual(await where(page), { hash: '/return', page: true, box: false, on: 'Return' });
  await page.click('#markTab'); await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  assert.deepEqual(await where(page), { hash: '', page: false, box: false, on: 'Mark' });
  // a name on the Grades tab opens that paper on Mark
  await page.click('#gradesBtn'); await page.waitForSelector('#glTable');
  await page.click('#glTable tr.go[data-i="2"] td.nm');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden && window.__gs.state().cur === 2);
  assert.deepEqual(await where(page), { hash: '', page: false, box: false, on: 'Mark' });
  // a box opened from a tab's screen sits over it, and the screen is back when the box closes
  await page.click('#exportBtn'); await page.waitForSelector('#rtSide');
  await page.click('#rtClaude [data-rtask="back"]'); await page.waitForFunction(() => !document.querySelector('#rtSide') && !document.querySelector('#dlg').hidden);
  assert.deepEqual(await where(page), { hash: '/return', page: false, box: true, on: 'Return' });
  await page.$eval('#dlgBox [data-close]', b => b.click()); await page.waitForSelector('#rtSide');
  assert.deepEqual(await where(page), { hash: '/return', page: true, box: false, on: 'Return' });
  // a refresh on a tab's address opens the assignment again on that tab
  await settle(page);
  await page.reloadHere(); await page.waitForSelector('#rtSide', { timeout: 60000 });
  assert.deepEqual(await where(page), { hash: '/return', page: true, box: false, on: 'Return' });
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students.length), 4);
  // leaving the assignment from a tab closes it
  await goTo(page, '#/'); await page.waitForFunction(() => !window.__gs.state().batch);
  assert.equal(await page.evaluate(() => document.querySelector('#dlg').hidden && document.querySelector('#dlg').parentNode === document.body), true, 'and the box is a box again');
  noErrors(page); await close();
});

test('Setup holds what is set once for the assignment, and everything else is in Find anything', async () => {
  const { page, close } = await riverOpen();
  await page.click('#moreBtn');
  const items = await page.$$eval('#moreMenu .mitem', a => a.filter(b => !b.hidden).map(b => b.textContent.trim()));
  assert.deepEqual(items, ['Rubric setup', 'Bring in files', 'What opened', 'Quick mark (paper quiz)', 'Marks from other apps']);
  assert.ok(await page.$('#moreMenu #classSel'), 'the roster is there too');
  await page.keyboard.press('Escape');
  const rows = await page.evaluate(() => window.__gs.findRows().map(r => r.group + ': ' + r.label));
  for (const want of ['This assignment: Grades', 'This assignment: Grade sheet', 'This assignment: Insights', 'This assignment: Consistency check', 'This assignment: Return marked files', 'This assignment: Share with Claude', 'This assignment: Bring back from Claude', 'This assignment: Gradebook', 'Tools: Lighting', 'Tools: Rescans', 'Tools: Display', 'Tools: Mark key', 'Tools: Calculator'])
    assert.ok(rows.includes(want), 'Find anything has ' + want);
  // from a tab's screen, Find anything still opens, a student goes back to the papers, and a tool's box comes back to the screen
  await page.click('#insightsTab'); await page.waitForSelector('#ovTiles');
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForSelector('#findIn'); await page.keyboard.type('Bram'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden && window.__gs.state().cur === 1);
  assert.equal((await where(page)).hash, '');
  await page.click('#gradesBtn'); await page.waitForSelector('#glTable');
  await page.evaluate(() => window.__gs.openFind()); await page.waitForSelector('#findIn'); await page.keyboard.type('Mark key'); await page.keyboard.press('Enter');
  await page.waitForSelector('#dlgBox .mk');
  assert.equal((await where(page)).box, true);
  await page.$eval('#dlgBox .bf [data-close]', b => b.click()); await page.waitForSelector('#glTable');
  assert.deepEqual(await where(page), { hash: '/grades', page: true, box: false, on: 'Grades' });
  // Mark key is in Settings as well
  await goTo(page, '#/settings/marking'); await page.click('#setMkey'); await page.waitForSelector('#dlgBox .mk');
  await page.$eval('#dlgBox .bf [data-close]', b => b.click());
  noErrors(page); await close();
});

test('the Grades tab puts the grade on the paper beside her score, and says which to check', async () => {
  const { page, close } = await riverOpen();
  await page.click('#gradesBtn'); await page.waitForSelector('#glTable');
  await page.waitForFunction(() => !document.querySelector('#glChk').hidden, { timeout: 60000 });
  const read = () => page.$$eval('#glTable tbody tr', a => a.map(tr => ({ name: tr.querySelector('td.nm').childNodes[0].textContent.trim(), paper: tr.querySelector('td.op').textContent.trim(), chk: tr.classList.contains('chk'), shown: getComputedStyle(tr).display !== 'none' })));
  assert.deepEqual(await read(), [
    { name: 'Aria Testwell', paper: '9/12 = 75% differs', chk: true, shown: true },
    { name: 'Bram Sample', paper: '10/12 = 83%', chk: false, shown: true },
    { name: 'Cleo Fixture', paper: '–', chk: false, shown: true },
    { name: 'Dov Madeup', paper: '–', chk: false, shown: true }]);
  assert.match(await page.$eval('#glChk', e => e.textContent), /^1 to check/);
  assert.match(await page.$eval('#glTable tr.chk .opchip', e => e.title), /Your score is 10, the paper says 9/);
  await page.click('#glChk [data-glonly]');
  assert.deepEqual((await read()).map(r => r.shown), [true, false, false, false], 'Show only these leaves the one to check');
  assert.equal(await page.$eval('#glChk [data-glonly]', e => e.textContent), 'Show everyone');
  await page.click('#glChk [data-glonly]');
  assert.deepEqual((await read()).map(r => r.shown), [true, true, true, true]);
  // the scores still copy as they did, and the new column isn't one of them
  assert.deepEqual(await page.$$eval('#glTable tr.go[data-i="0"] td.c', a => a.map(td => td.dataset.copy)), ['4', '3', '3', '10', '91']);
  // the chip goes to the grade sheet, where she settles it
  await page.click('#glTable tr.chk .opchip'); await page.waitForSelector('#shBody table');
  assert.equal((await where(page)).hash, '/grades/sheet');
  // once her score matches the paper, nothing is left to check
  await page.evaluate(() => { const G = window.__gs, st = G.state().batch.students[0]; st.grade.rubric = [3, 3, 3]; G.touchGrade(st); G.openGrades(); });
  await page.waitForSelector('#glTable');
  assert.equal(await page.$eval('#glChk', e => e.hidden), true);
  assert.equal(await page.$eval('#glTable tr.go[data-i="0"] td.op', e => e.textContent.trim()), '9/12 = 75%');
  noErrors(page); await close();
});

test('Return: downloading the marked files marks the assignment Returned, on Home too, and one click takes it back', async () => {
  const { page, close } = await riverOpen();
  const dl = await catchDownloads(page);
  await markPage(page, 0);
  await settle(page);
  // before: all four are not scored, so the card says Scoring
  await page.click('#exportBtn'); await page.waitForSelector('#rtSide');
  assert.equal(await page.$eval('#dlgBox h2', e => e.textContent), 'Return marked files');
  assert.equal(await page.$eval('#rtState', e => e.textContent), '');
  assert.match(await page.$eval('#rtOne', e => e.textContent), /Export Aria Testwell’s paper/);
  assert.deepEqual(await page.$$eval('#rtClaude .rtrow b', a => a.map(b => b.textContent)), ['Papers with names covered', 'Marks only', 'Bring back Claude’s feedback']);
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  assert.match(got.name, /^Marked - River essay\.zip$/);
  await page.waitForSelector('#rtState .rtdone');
  assert.match(await page.$eval('#rtState', e => e.textContent), /^✓ Returned today at .+ · \d+ files?\. Mark as not returned$/);
  await settle(page);
  const saved = () => page.evaluate(async () => { const id = window.__gs.state().batch.id, w = JSON.parse(localStorage.getItem(id)); const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); }); const m = await new Promise(res => { const q = db.transaction('meta').objectStore('meta').get(id); q.onsuccess = () => res(q.result); }); db.close(); return { work: !!(w.returned && w.returned.t && w.returned.n), meta: !!m.ret }; });
  assert.deepEqual(await saved(), { work: true, meta: true });
  // Dov has no score yet, so the card still says Scoring; once everyone is scored or marked missing it says Returned
  await page.evaluate(() => { const G = window.__gs; G.setStatus(G.state().batch.students[3], 'missing'); });
  await settle(page);
  await page.keyboard.press('Escape');
  await classPage(page, 'i1'); await page.waitForSelector('[data-card="i1"] .schip');
  assert.equal(await page.$eval('[data-card="i1"] .schip', e => e.textContent), 'Returned');
  // it is kept: open again, and the Return tab still says so
  await page.click('[data-card="i1"] [data-kopen]'); await waitPaper(page);
  await page.click('#exportBtn'); await page.waitForSelector('#rtSide');
  assert.match(await page.$eval('#rtState', e => e.textContent), /^✓ Returned today/);
  // one student at a time: the paper goes out, and the card lists who has had theirs
  const one = await dl.next(() => page.click('#rtOne [data-rtone]'));
  assert.match(one.name, /Aria Testwell/);
  await page.waitForSelector('#rtOne .rtsent li');
  assert.match(await page.$eval('#rtOne .rtsent', e => e.textContent), /^Aria Testwell exported /);
  // the Claude steps open as boxes over the tab
  await page.click('#rtClaude [data-rtask="marks"]'); await page.waitForSelector('#shMarks:not([hidden])');
  await page.$eval('#dlgBox [data-close]', b => b.click()); await page.waitForSelector('#rtSide');
  // taking it back
  await page.click('#rtState [data-unreturn]');
  assert.equal(await page.$eval('#rtState', e => e.textContent), '');
  await settle(page);
  assert.deepEqual(await saved(), { work: false, meta: false });
  await page.keyboard.press('Escape');
  await classPage(page, 'i1'); await page.waitForSelector('[data-card="i1"] .schip');
  assert.equal(await page.$eval('[data-card="i1"] .schip', e => e.textContent), 'Ready to return');
  await dl.close(); noErrors(page); await close();
});

test('Insights: how each row was scored, change since the last summative, and the same assignment in her other class', async () => {
  const { page, close } = await riverOpen();
  await page.click('#insightsTab'); await page.waitForSelector('#ovTiles');
  await page.waitForSelector('#insMove svg', { timeout: 60000 });
  // each rubric row, with a count at each score: Aria 4 3 3, Bram 4 3 3, Cleo 2 2 2
  const rows = await page.$$eval('#insRows .insr', a => a.map(r => [r.querySelector('.insn').textContent, [...r.querySelectorAll('.inst i')].map(i => i.className.match(/b(\d)/)[1] - 1 + ':' + i.textContent).join(' ')]));
  assert.deepEqual(rows, [['Thesis', '2:1 4:2'], ['Evidence', '2:1 3:2'], ['Style', '2:1 3:2']]);
  assert.match(await page.$eval('#insRows .inst i', e => e.dataset.tn), /Cleo Fixture/);
  // the last summative was Poetry commentary: Aria 9 then 10, Bram 11 then 10, Cleo 6 then 6. Dov has no finished score here.
  const move = await page.$$eval('#insMove .insdb', a => a.map(g => [g.querySelector('text').textContent, g.classList.contains('up') ? 'up' : g.classList.contains('down') ? 'down' : 'same', g.dataset.tn]));
  assert.deepEqual(move.map(m => m.slice(0, 2)), [['Aria Testwell', 'up'], ['Cleo Fixture', 'same'], ['Bram Sample', 'down']]);
  assert.match(move[0][2], /^Poetry commentary \d+%, this one \d+%$/);
  assert.match(await page.$eval('#insMove .bkleg', e => e.textContent), /Poetry commentary.*This one.*Up \(1\).*Down \(1\)/);
  // the other class that was given it
  const across = await page.$$eval('#insAcross .insxr:not(.insxax)', a => a.map(r => [r.querySelector('.insxn').textContent, r.classList.contains('me'), r.querySelector('.insxv small').textContent]));
  assert.deepEqual(across, [['12EL-1', true, '3'], ['12EL-2', false, '3']]);
  // a row of the change chart opens that paper
  await page.click('#insMove .insdb[data-ovgo="1"] .inshit');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden && window.__gs.state().cur === 1);
  // during anonymous grading the charts say Student N, never a name
  await page.click('#anonSw'); await page.waitForSelector('#dlgBox [data-go]'); await page.click('#dlgBox [data-go]');
  await page.waitForFunction(() => window.__gs.anonOn() && document.querySelector('#dlg').hidden);
  await page.click('#insightsTab'); await page.waitForSelector('#insMove svg', { timeout: 60000 });
  const txt = await page.$eval('#ovBody', e => e.textContent + [...e.querySelectorAll('[data-tn],[data-tl],[aria-label]')].map(x => (x.dataset.tn || '') + (x.dataset.tl || '') + (x.getAttribute('aria-label') || '')).join(' '));
  for (const n of NAMES) assert.ok(!txt.includes(n), n + ' stays hidden');
  noErrors(page); await close();
});
