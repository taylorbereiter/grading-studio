// The marking screen: the tools as a dock down the left edge of the paper, the small menus (+ Add, the ⋯ on a file, the ⋯ beside
// Missing, Excused, Late), the student list's filters, and the saved comments under the comment box.
// Driven through the real built app. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, classPage, pickFile, waitPaper, goToStudent, score, settle, setTool, at, press } = require('./helpers/app');
const { makePaper, standardFiles, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const box = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; });
const shown = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.checkVisibility(); }, sel);
const texts = (page, sel) => page.$$eval(sel, a => a.filter(e => e.checkVisibility()).map(e => e.firstChild.textContent.trim()));
const cur = page => page.evaluate(() => window.__gs.state().cur);
const nMarks = page => page.evaluate(() => window.__gs.state().pages.reduce((n, p) => n + p.marks().length, 0));
const stored = page => page.evaluate(() => { const s = window.__gs.state(); return localStorage.getItem(s.batch.id); });

async function standard() {
  const app = await openApp(browser), { page } = app;
  await page.setViewport({ width: 1440, height: 900 });
  await openZip(page, zip);
  return app;
}

/* ---------------- the tools ---------------- */
test('the tools are a dock down the left edge of the paper, and the paper keeps its full height', async () => {
  const { page, close } = await standard();
  const tools = await box(page, '#tools'), paper = await box(page, '#paper'), pg = await box(page, '#paper .pg canvas');
  assert.ok(tools.h > tools.w * 4, 'taller than wide: ' + JSON.stringify(tools));
  assert.ok(tools.w <= 64, 'a narrow strip');
  assert.ok(tools.l >= paper.l && tools.r <= pg.l, 'it sits left of the page, never over it: dock ends ' + tools.r + ', page starts ' + pg.l);
  assert.ok(tools.b <= paper.b, 'all of it is on screen');
  const who = await box(page, '#paper .who');
  assert.ok(who.t - paper.t < 30, 'nothing sits above the student’s name any more');
  assert.equal(await page.$eval('#paper', p => p.scrollWidth <= p.clientWidth), true, 'the page still fits across');
  // every tool is an icon with a name a screen reader says and a tip that names its key
  const tl = await page.$$eval('#tools .tool[data-tool]', a => a.map(b => ({ t: b.dataset.tool, title: b.title, name: b.querySelector('.lb').textContent.trim(), w: b.querySelector('.lb').getBoundingClientRect().width })));
  assert.deepEqual(tl.map(x => x.t), ['select', 'pen', 'hl', 'oval', 'text', 'note', 'check', 'erase']);
  for (const x of tl) { assert.ok(x.name && x.title, x.t + ' has a name'); assert.ok(x.w <= 1, x.t + ' shows as an icon'); }
  await close();
});

test('a tool’s choices open in the dock: ink and width for the pen, colors and Snap for the highlighter', async () => {
  const { page, close } = await standard();
  await press(page, '#tools [data-tool="pen"]');
  assert.equal(await page.$eval('#tools [data-tool="pen"]', b => b.getAttribute('aria-pressed')), 'true');
  assert.ok((await page.$$('#tools .topts [data-ink]')).length >= 4, 'ink colors');
  const widths = await page.$$eval('#tools .penw [data-w]', a => a.map(b => b.getAttribute('aria-label') || b.title));
  assert.equal(widths.length, 3); for (const w of widths) assert.ok(w, 'each width has a name');
  await press(page, '#tools .penw [data-w]:last-child');
  assert.equal(await page.$eval('#tools .penw [data-w]:last-child', b => b.getAttribute('aria-pressed') === 'true'), true);
  await press(page, '#tools [data-tool="hl"]');
  assert.ok(await shown(page, '#tools .topts [data-hlm]'), 'Snap and Free');
  const dock = await box(page, '#tools'), paper = await box(page, '#paper');
  assert.ok(dock.b <= paper.b, 'still all on screen with the choices open');
  for (const s of ['#undoBtn', '#redoBtn']) assert.ok(await shown(page, s), s + ' is in the dock');
  for (const s of ['#zoomPill [data-z="1"]', '#zoomPill [data-z="-1"]', '#zoomPill [data-z0]']) assert.ok(await shown(page, s), s + ' is in the corner of the paper');
  await close();
});

test('the dock fits a short window', async () => {
  const { page, close } = await standard();
  await page.setViewport({ width: 1280, height: 640 });
  await press(page, '#tools [data-tool="hl"]');
  const t = await page.$eval('#tools', e => ({ sh: e.scrollHeight, ch: e.clientHeight })), dock = await box(page, '#tools'), paper = await box(page, '#paper');
  assert.ok(t.sh <= t.ch + 1, 'nothing in the dock is cut off: ' + JSON.stringify(t));
  assert.ok(dock.b <= paper.b);
  await close();
});

/* ---------------- the small menus ---------------- */
test('+ Add is one menu: a file, pasted text, a video, a notes page, or pages from a scan', async () => {
  const { page, close } = await standard();
  for (const s of ['#addFileBtn', '#pasteTextBtn', '#addScanBtn']) assert.equal(await shown(page, s), false, s + ' waits in the menu');
  assert.deepEqual(await page.evaluate(() => window.__gs.findRows().filter(r => r.group === 'This paper').map(r => r.label)), ['Add a file…', 'Add pasted text…', 'Add a video…', 'Add a notes page…', 'Add pages from a scan…', 'Arrange pages'], 'Find anything reaches them too');
  await page.click('#addMenuBtn');
  assert.equal(await page.$eval('#addMenuBtn', b => b.getAttribute('aria-expanded')), 'true');
  assert.deepEqual(await texts(page, '#addMenuBtn + .km .mitem'), ['A file…', 'Pasted text…', 'A video…', 'A notes page…', 'From a scan…']);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'addFileBtn', 'the first choice has the keyboard');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'pasteTextBtn');
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'addScanBtn', 'the arrows wrap');
  // a key meant for the menu never reaches the paper: → would have opened the next student
  await page.keyboard.press('ArrowRight');
  assert.equal(await cur(page), 0);
  await page.keyboard.press('Escape');
  assert.equal(await shown(page, '#addFileBtn'), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'addMenuBtn', 'Escape hands the keyboard back to the button');
  await page.click('#addMenuBtn'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForSelector('#dlg:not([hidden]) #dlgBox');
  assert.match(await page.$eval('#dlgBox h2', h => h.textContent), /Paste/);
  assert.equal(await shown(page, '#addFileBtn'), false, 'picking something closes the menu');
  await close();
});

test('what belongs to one file is under that file’s ⋯, and Remove still asks for a second click', async () => {
  const { page, close } = await standard();
  await goToStudent(page, 1);   // Bram: Essay.pdf and Extra notes.pdf
  const heads = await page.$$eval('#paper .fhead', a => a.map(h => ({ name: h.firstElementChild.textContent, open: [...h.querySelectorAll('button')].filter(b => b.checkVisibility()).map(b => b.textContent.trim()) })));
  assert.equal(heads.length, 2);
  for (const h of heads) assert.deepEqual(h.open, ['⋯'], h.name + ' shows only its menu');
  await page.click('#paper .fhead [data-km]');
  assert.deepEqual(await texts(page, '#paper .fhead .km button'), ['⟳ Turn all pages', 'Group work…', 'Move to…', 'Replace…', 'Leave out', 'Remove']);
  // a press on the page while a menu is open closes the menu and marks nothing
  await setTool(page, 'check');
  await page.click('#paper .fhead [data-km]'); await page.click('#paper .fhead [data-km]');
  const p = await at(page, 0, 300, 400); await page.mouse.click(p.x, p.y);
  assert.equal(await shown(page, '#paper .fhead .km'), false);
  assert.equal(await nMarks(page), 0, 'no check mark landed');
  await setTool(page, 'select');
  // Remove: the first click arms it and the menu stays; the second removes the file
  await page.evaluate(() => document.querySelector('#paper').scrollTo(0, 0));
  await page.click('#paper .fhead [data-km]');
  await page.click('#paper .fhead .km [data-rmfile]');
  assert.equal(await shown(page, '#paper .fhead .km [data-rmfile]'), true, 'the menu waits for the second click');
  assert.equal(await page.$eval('#paper .fhead .km [data-rmfile]', b => b.textContent), 'Click again to remove');
  await page.click('#paper .fhead .km [data-rmfile]');
  await page.waitForFunction(() => window.__gs.state().batch.students[1].files.length === 1);
  await close();
});

test('a Word file keeps Comment, Edit and Convert to PDF in sight, with Download under its ⋯', async () => {
  const { page, close } = await standard();
  await goToStudent(page, 3);   // Dov: Essay.docx and notes.txt
  await page.waitForSelector('#paper .fhead [data-wpdf]');
  const open = await page.$eval('#paper .fhead:has([data-wpdf])', h => [...h.querySelectorAll('button')].filter(b => b.checkVisibility()).map(b => b.textContent.trim()));
  assert.deepEqual(open, ['Comment', 'Edit', 'Convert to PDF', '⋯']);
  await page.click('#paper .fhead:has([data-wpdf]) [data-km]');
  const items = await texts(page, '#paper .fhead:has([data-wpdf]) .km button');
  assert.equal(items[0], 'Download');
  for (const t of ['Move to…', 'Replace…', 'Remove']) assert.ok(items.includes(t), t + ' is in the menu');
  await close();
});

test('the ⋯ beside the student’s name has Arrange pages, Lighting and the Calculator', async () => {
  const { page, close } = await standard();
  await page.click('#whoMore');
  assert.deepEqual(await texts(page, '#whoMore + .km .mitem'), ['Arrange pages', 'Use as an example', 'Lighting', 'Calculator']);
  await page.click('#whoMore + .km [data-whodo="calc"]');
  await page.waitForSelector('#calcPanel', { timeout: 5000 });
  await close();
});

/* ---------------- the score panel ---------------- */
test('Leave out of the average is under the ⋯ beside Missing, Excused, Late, and says so once it is on', async () => {
  const { page, close } = await standard();
  await score(page, [4, 3, 3]);
  assert.equal(await shown(page, '#outAvg'), false);
  assert.equal(await page.$eval('#pOut', b => b.hidden), true, 'no Left out filter while nothing is left out');
  await page.click('#gMore'); await page.click('#outAvg');
  await page.waitForSelector('#grade .outnote');
  assert.match(await page.$eval('#grade .outnote', e => e.textContent), /Left out of the average/);
  assert.equal(await page.evaluate(() => !!window.__gs.state().batch.students[0].grade.outAvg), true);
  assert.equal(await page.$eval('#pOut .v', e => e.textContent), '1');
  assert.equal(await page.$eval('#pOut', b => b.hidden), false);
  await page.click('#grade .outnote [data-outoff]');
  await page.waitForFunction(() => !document.querySelector('#grade .outnote'));
  assert.equal(await page.evaluate(() => !!window.__gs.state().batch.students[0].grade.outAvg), false);
  await close();
});

test('a saved comment is one click from the comment box, on every paper', async () => {
  const { page, close } = await standard();
  assert.equal((await page.$$('#grade .cbank [data-cbank]')).length, 0);
  await page.click('#cmtIn'); await page.keyboard.type('Clear thesis. Add one more quotation.');
  await page.click('#cmtMore'); await page.click('#grade .km [data-cbsave]');
  await page.waitForSelector('#grade .cbank > [data-cbank]');
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.bank'))), ['Clear thesis. Add one more quotation.']);
  // saving the same words twice keeps one
  await page.click('#cmtMore'); await page.click('#grade .km [data-cbsave]');
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('gs.bank')))).length, 1);
  await goToStudent(page, 2);
  await page.click('#grade .cbank > [data-cbank]');
  assert.equal(await page.$eval('#cmtIn', t => t.value), 'Clear thesis. Add one more quotation.');
  await page.keyboard.type(' Well done.');
  await page.click('#grade .cbank > [data-cbank]');
  assert.equal(await page.$eval('#cmtIn', t => t.value), 'Clear thesis. Add one more quotation. Well done. Clear thesis. Add one more quotation.', 'a second one is added after what is there');
  await settle(page);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[2].grade.comment), 'Clear thesis. Add one more quotation. Well done. Clear thesis. Add one more quotation.');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].grade.comment), 'Clear thesis. Add one more quotation.');
  await close();
});

test('Next to score is the main button while papers are left, and plain Next once everyone has a score', async () => {
  const { page, close } = await standard();
  assert.match(await page.$eval('#nextUn', b => b.textContent), /Next to score/);
  assert.equal(await page.$eval('#prevBtn', b => b.disabled), true);
  await score(page, [4, 4, 4]);
  await goToStudent(page, 1); await score(page, [3, 3, 3]);
  await goToStudent(page, 0);
  await page.click('#nextUn');
  await page.waitForFunction(() => window.__gs.state().cur === 2);   // Bram has a score, so it goes past him
  await score(page, [3, 3, 3]);
  await goToStudent(page, 3); await score(page, [2, 2, 2]);
  await page.waitForFunction(() => !document.querySelector('#nextUn'));
  assert.match(await page.$eval('#nextBtn', b => b.textContent), /Next/);
  assert.equal(await page.$eval('#nextBtn', b => b.classList.contains('primary')), true);
  await close();
});

/* ---------------- the student list ---------------- */
const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup', 'Edda Placeholder'];
const SETUP = { mode: 'rubric', criteria: ['Thesis', 'Evidence', 'Style'], outOf: 12 };
function seed() {
  const lib = { classes: [{ id: 'c1', name: '12EL-1', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [{ id: 'i1', name: 'River essay', classId: 'c1', type: 'sum', due: '2026-10-28', setup: SETUP }] }] }], loose: { id: '', name: '', names: [], units: [] }, seed2627: true };
  return { ls: { 'gs.lib': JSON.stringify(lib) } };
}
// Five on the roster; Edda turned nothing in. Aria and Bram are scored.
async function river() {
  const app = await openApp(browser, { seed: seed() }), { page } = app;
  await page.setViewport({ width: 1440, height: 900 });
  const files = {}; for (const n of NAMES.slice(0, 4)) files[n + '/Essay.pdf'] = await makePaper({ title: n });
  await classPage(page, 'i1'); await page.waitForSelector('[data-open-asg="i1"]'); await page.click('[data-open-asg="i1"]');
  await page.waitForSelector('#dlgBox [data-cancel]'); await page.click('#dlgBox [data-cancel]');
  const clean = await pickFile(page, '#asgIn', zipOf(files), 'River essay.zip'); await waitPaper(page); clean();
  await goToStudent(page, 0); await score(page, [4, 4, 3]);
  await goToStudent(page, 1); await score(page, [3, 3, 3]);
  await goToStudent(page, 0);
  return app;
}
const chips = page => page.$$eval('#lfSlot .lf', a => a.filter(b => !b.hidden).map(b => b.textContent.replace(/\s+/g, ' ').trim()));
const rows = page => page.$$eval('#stuList [data-i]', a => a.map(b => +b.dataset.i));

test('the list’s filters: To score, Flagged, No paper, and Late once someone is', async () => {
  const { page, close } = await river();
  assert.match(await page.$eval('#progS .ph', e => e.textContent.replace(/\s+/g, ' ')), /2 of 5 scored/);
  assert.deepEqual(await chips(page), ['All 5', 'To score 3', 'Flagged 0', 'No paper 1']);
  assert.deepEqual(await rows(page), [0, 1, 2, 3, 4]);
  await settle(page);   // the scores just given are saved before the filters are tried
  const before = await stored(page);
  await press(page, '[data-lf="todo"]');
  assert.deepEqual(await rows(page), [0, 2, 3, 4], 'the paper she is on stays, then the three with no score');
  assert.equal(await page.$eval('[data-lf="todo"]', b => b.getAttribute('aria-pressed')), 'true');
  // Next and the arrow keys walk the list as it shows
  await page.click('#nextBtn'); await page.waitForFunction(() => window.__gs.state().cur === 2);
  assert.deepEqual(await rows(page), [2, 3, 4], 'Aria is scored and no longer open, so she leaves the list');
  assert.equal(await page.$eval('#prevBtn', b => b.disabled), true, 'nothing before the first one shown');
  await page.keyboard.press('ArrowRight'); await page.waitForFunction(() => window.__gs.state().cur === 3);
  // scoring the open paper doesn't pull it out from under her
  await score(page, [3, 3, 2]);
  assert.deepEqual(await rows(page), [2, 3, 4]);
  assert.equal(await page.$eval('#pLeft .v', e => e.textContent), '2');
  await press(page, '[data-lf="nopaper"]');
  assert.deepEqual(await rows(page), [3, 4]);
  // marking someone late brings the Late filter
  await page.click('#grade [data-status="late"]');
  await page.waitForFunction(() => { const b = document.querySelector('[data-lf="late"]'); return b && !b.hidden; });
  await press(page, '[data-lf="late"]');
  assert.deepEqual(await rows(page), [3]);
  // a second click on the filter shows everyone again
  await press(page, '[data-lf="late"]');
  assert.deepEqual(await rows(page), [0, 1, 2, 3, 4]);
  // the filter is only for this visit: nothing about it is kept
  await settle(page);
  const after = JSON.parse(await stored(page)), was = JSON.parse(before);
  assert.deepEqual(Object.keys(after).sort(), Object.keys(was).sort(), 'no new field in the saved work');
  await close();
});

test('a filter with nobody in it says so, with a way back to everyone', async () => {
  const { page, close } = await river();
  await goToStudent(page, 1);
  await press(page, '[data-lf="flag"]');
  assert.deepEqual(await rows(page), [1], 'only the open paper');
  assert.match(await page.$eval('#stuList .lfnone', e => e.textContent), /No one else here/);
  await page.click('#stuList .lfnone [data-lf="all"]');
  assert.deepEqual(await rows(page), [0, 1, 2, 3, 4]);
  assert.equal(await page.$eval('[data-lf="all"]', b => b.getAttribute('aria-pressed')), 'true');
  await close();
});

test('Add late work and Hide names are at the foot of the list', async () => {
  const { page, close } = await river();
  await page.evaluate(() => window.__gs.listPeek(true));   // the strip opens to the full list
  const foot = await box(page, '#sideFoot'), list = await box(page, '#stuList');
  assert.ok(foot.t >= list.b - 1, 'below the names');
  assert.equal(await page.$eval('#anonSw', b => b.getAttribute('aria-checked')), 'false');
  await page.click('#lateBtn');
  await page.waitForSelector('#dlg:not([hidden]) #dlgBox');
  assert.match(await page.$eval('#dlgBox', e => e.textContent), /Bring in files/);
  await page.keyboard.press('Escape');
  await page.click('#anonSw');
  await page.waitForSelector('#dlg:not([hidden]) #dlgBox [data-go]');
  await page.click('#dlgBox [data-go]');
  await page.waitForFunction(() => document.querySelector('#anonSw').getAttribute('aria-checked') === 'true');
  await goToStudent(page, 0);   // someone with a paper, wherever the shuffle put them
  assert.match(await page.$eval('#paper .who h2', h => h.textContent), /^Paper \d+$/);
  assert.match(await page.$eval('#oneOutBtn', b => b.textContent), /Export this paper now/);
  // the filters work on the shuffled list too, and never show a name
  await press(page, '[data-lf="todo"]');
  assert.ok((await page.$$eval('#stuList [data-i]', a => a.map(b => b.textContent))).every(t => !NAMES.some(n => t.includes(n))));
  await close();
});
