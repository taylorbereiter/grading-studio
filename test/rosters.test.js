// Students with no paper, roster changes and moving a file: none of them may lose or misplace a score, comment, status or mark.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { unzipSync, zipSync, strToU8 } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, answerDlg, openZip, pickFile, goToStudent, setTool, drag, score, settle, workOf, closeBox } = require('./helpers/app');
const { makePaper, makeDocx, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const libOf = (...names) => ({ classes: [{ id: 'c1', name: 'Period 1', names, units: [] }] });
const seeded = (...names) => openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(libOf(...names)) } } });
const papers = async (...paths) => { const o = {}; for (const p of paths) o[p] = await makePaper({ title: p }); return zipOf(o); };
const keys = page => page.evaluate(() => window.__gs.state().batch.students.map(s => s.key));
const at = (page, key) => page.evaluate(key => window.__gs.state().batch.students.findIndex(s => s.key === key), key);
const go = async (page, key) => goToStudent(page, await at(page, key));
const noErrors = page => assert.deepEqual(page.errors, []);
const clipOn = page => page.evaluate(() => { window.__clip = null; navigator.clipboard.writeText = t => { window.__clip = t; return Promise.resolve(); }; });
const clip = page => page.waitForFunction(() => window.__clip != null).then(() => page.evaluate(() => window.__clip));
const toastText = page => page.$eval('.toast', e => e.textContent);
// Closes the tab's copy of the app and opens the same download again, the way she'd come back to it tomorrow.
async function reopen(page, zip) {
  await settle(page);
  await page.reload();
  await page.waitForFunction(() => window.__gs && !!window.__gs.state, { timeout: 60000, polling: 100 });
  const clean = await pickFile(page, '#fileIn', zip, 'Download.zip');   // the student she left off on may have no paper to wait for
  await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && !a.hidden && !!window.__gs.state().batch; }, { timeout: 60000 });
  clean();
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem(window.__gs.state().batch.id)));
const pickClass = (page, id) => page.evaluate(id => { const sel = document.querySelector('#classSel'); sel.value = id; sel.dispatchEvent(new Event('change')); }, id);
const editRoster = (page, ...names) => page.evaluate(names => { const l = JSON.parse(localStorage.getItem('gs.lib')); l.classes[0].names = names; localStorage.setItem('gs.lib', JSON.stringify(l)); }, names);
const comment = (page, text) => page.evaluate(text => { const c = document.querySelector('#cmtIn'); c.value = text; c.dispatchEvent(new Event('input', { bubbles: true })); }, text);
const penOn = async page => { await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]); await setTool(page, 'select'); };
const move = (page, from, path, to) => page.evaluate((from, path, to) => {
  const G = window.__gs, b = G.state().batch.students; G.moveFile(b.find(s => s.key === from), path, b.find(s => s.key === to));
}, from, path, to);
const moved = (page, to, path) => page.waitForFunction((to, path) => window.__gs.state().batch.students.find(s => s.key === to).files.some(f => f.path === path), {}, to, path);

/* a paper moved to someone on the roster who has no folder */
test('a file moved to a roster student with no paper stays there on reopen, with its marks, through a second save', async () => {
  const { page, close } = await seeded('Ann Alpha', 'Ben Beta', 'Zed Nopaper');
  const zip = await papers('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf', 'Ben Beta/Extra.pdf');
  const path = 'Ben Beta/Extra.pdf';
  await openZip(page, zip);
  assert.deepEqual(await keys(page), ['Ann Alpha', 'Ben Beta', 'Zed Nopaper']);
  await move(page, 'Ben Beta', path, 'Zed Nopaper');
  await moved(page, 'Zed Nopaper', path);
  await go(page, 'Zed Nopaper');
  await page.waitForFunction(() => window.__gs.state().pages.length > 0 && window.__gs.state().pages[0].s > 0);
  await penOn(page);
  await score(page, [2, 2, 2]);
  const check = async () => {
    const w = await workOf(page);
    assert.deepEqual(Object.keys(w['Zed Nopaper'].files), [path], 'the paper is still his');
    assert.deepEqual(Object.keys(w['Ben Beta'].files), ['Ben Beta/Essay.pdf']);
    assert.equal(w['Zed Nopaper'].files[path].marks[0].length, 1, 'with its mark');
    assert.deepEqual(w['Zed Nopaper'].grade.rubric, [2, 2, 2]);
  };
  await check();
  await reopen(page, zip);
  await check();
  assert.deepEqual(await keys(page), ['Ann Alpha', 'Ben Beta', 'Zed Nopaper'], 'and he is only listed once');
  await page.evaluate(() => window.__gs.saveNow());
  await settle(page);
  assert.equal((await saved(page)).s['Zed Nopaper'].f[path][0].length, 1, 'an ordinary save keeps the marks');
  await reopen(page, zip);
  await check();
  noErrors(page); await close();
});

test('a paper moved to someone with no folder comes over to a newer copy of the download, with its marks', async () => {
  const { page, close } = await seeded('Ann Alpha', 'Ben Beta', 'Zed Nopaper');
  const files = { 'Ann Alpha/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ben Beta/Essay.pdf': await makePaper({ title: 'Ben' }), 'Ben Beta/Extra.pdf': await makePaper({ title: 'Zed really' }) };
  await openZip(page, zipOf(files), 'Older.zip');
  await score(page, [4, 4, 4]);   // work on someone in both copies is how the older copy is found
  await move(page, 'Ben Beta', 'Ben Beta/Extra.pdf', 'Zed Nopaper');
  await moved(page, 'Zed Nopaper', 'Ben Beta/Extra.pdf');
  await go(page, 'Zed Nopaper');
  await page.waitForFunction(() => window.__gs.state().pages.length > 0 && window.__gs.state().pages[0].s > 0);
  await penOn(page);
  await settle(page);
  await page.click('#closeBtn');
  await new Promise(r => setTimeout(r, 300));
  const clear = setInterval(() => page.evaluate(() => { const b = document.querySelector('#askDlg [data-ok]'); if (b) b.click(); }).catch(() => {}), 200);
  await openZip(page, zipOf({ ...files, 'Cal Gamma/Essay.pdf': await makePaper({ title: 'Cal' }) }), 'Newer.zip');
  clearInterval(clear);
  const w = await workOf(page);
  assert.deepEqual(Object.keys(w['Zed Nopaper'].files), ['Ben Beta/Extra.pdf']);
  assert.equal(w['Zed Nopaper'].files['Ben Beta/Extra.pdf'].marks[0].length, 1);
  noErrors(page); await close();
});

/* the roster changes */
test('a no-paper student’s score and comment survive changing the roster dropdown and back', async () => {
  const lib = { classes: [...libOf('Ann Alpha', 'Ben Beta', 'Zed Nopaper').classes, { id: 'c2', name: 'Period 2', names: ['Ann Alpha', 'Ben Beta'], units: [] }] };
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(lib) } } });
  const zip = await papers('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf');
  await openZip(page, zip);
  await go(page, 'Zed Nopaper');
  await score(page, [2, 2, 2]);
  await comment(page, 'Sat it at home');
  await settle(page);
  const stillThere = async () => {
    const w = await workOf(page);
    assert.deepEqual(w['Zed Nopaper'].grade.rubric, [2, 2, 2]);
    assert.equal(w['Zed Nopaper'].grade.comment, 'Sat it at home');
  };
  for (const id of ['', 'c2']) {
    await pickClass(page, id);
    await stillThere();
    await page.evaluate(() => window.__gs.saveNow());
    await settle(page);
    assert.deepEqual((await saved(page)).s['Zed Nopaper'].g.rubric, [2, 2, 2], 'the saved copy keeps it too');
    await pickClass(page, 'c1');
    await stillThere();
    assert.equal((await keys(page)).filter(k => k === 'Zed Nopaper').length, 1, 'with one row');
  }
  // still off the roster when she comes back: it stays, marked as not on the roster
  await pickClass(page, 'c2');
  await reopen(page, zip);
  await stillThere();
  await page.click('#gradesBtn'); await page.waitForSelector('table.gl');
  assert.match(await page.$eval('table.gl', e => e.textContent), /Zed Nopaper.*not on roster/s);
  noErrors(page); await close();
});

test('a place-holder with nothing on it still goes away when the roster changes', async () => {
  const { page, close } = await seeded('Ann Alpha', 'Ben Beta', 'Zed Nopaper');
  await openZip(page, await papers('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf'));
  await pickClass(page, '');
  assert.deepEqual(await keys(page), ['Ann Alpha', 'Ben Beta']);
  noErrors(page); await close();
});

test('fixing a name on the roster keeps the status and comment on the no-paper student', async () => {
  const { page, close } = await seeded('Ann Alpha', 'Ben Beta', 'Zed Gapstudant', 'Yan Nopaper');
  const zip = await papers('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf');
  await openZip(page, zip);
  for (const k of ['Zed Gapstudant', 'Yan Nopaper']) {
    await page.evaluate(k => { const G = window.__gs, st = G.state().batch.students.find(s => s.key === k); st.grade.status = 'excused'; st.grade.comment = 'Away for ' + k; G.touchGrade(st); G.saveNow(); }, k);
  }
  await settle(page);
  // A spelling fix can't be matched to the old name, so the work stays on the old row. A longer name matches, so it stays one row.
  await editRoster(page, 'Ann Alpha', 'Ben Beta', 'Zed Gapstudent', 'Yan N Nopaper');
  await reopen(page, zip);
  const w = await workOf(page);
  assert.equal(w['Zed Gapstudant'].grade.status, 'excused');
  assert.equal(w['Zed Gapstudant'].grade.comment, 'Away for Zed Gapstudant');
  assert.ok(w['Zed Gapstudent'], 'the corrected name has its row');
  assert.equal(w['Yan Nopaper'].grade.comment, 'Away for Yan Nopaper');
  assert.equal(w['Yan N Nopaper'], undefined, 'a longer name is the same student');
  await page.evaluate(() => window.__gs.saveNow());
  await settle(page);
  const s = (await saved(page)).s;
  assert.equal(s['Zed Gapstudant'].g.status, 'excused', 'the saved record isn’t blanked');
  assert.equal(s['Zed Gapstudant'].g.comment, 'Away for Zed Gapstudant');
  noErrors(page); await close();
});

/* one roster name inside another */
test('overlapping names: each student has one row, and a new score holds on reopen', async () => {
  const { page, close } = await seeded('Wei Chen', 'Wei Chen Lin');
  const zip = await papers('Wei Chen/Essay.pdf', 'Wei Chen Lin/Essay.pdf');
  await openZip(page, zip);
  await pickClass(page, 'c1');   // both names are a tie, so before this fix it can't be picked by itself
  assert.deepEqual(await keys(page), ['Wei Chen', 'Wei Chen Lin']);
  await go(page, 'Wei Chen');
  await score(page, [4, 4, 4]);
  await reopen(page, zip);
  let w = await workOf(page);
  assert.deepEqual(w['Wei Chen'].grade.rubric, [4, 4, 4]);
  assert.deepEqual(w['Wei Chen Lin'].grade.rubric, [], 'the other Wei has no score');
  await go(page, 'Wei Chen');
  await score(page, [2, 2, 2]);
  await reopen(page, zip);
  w = await workOf(page);
  assert.deepEqual(w['Wei Chen'].grade.rubric, [2, 2, 2], 'the new score holds');
  assert.deepEqual(await keys(page), ['Wei Chen', 'Wei Chen Lin']);
  noErrors(page); await close();
});

test('overlapping names when only one turned in: the paper stays on its own line, whichever order the roster is in', async () => {
  for (const [names, turnedIn] of [[['Ann Alpha', 'Wei Chen', 'Wei Chen Lin', 'Ben Beta'], 'Wei Chen Lin'], [['Ann Alpha', 'Wei Chen Lin', 'Wei Chen', 'Ben Beta'], 'Wei Chen']]) {
    const { page, close } = await seeded(...names);
    await openZip(page, await papers('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf', turnedIn + '/Essay.pdf'));
    await pickClass(page, 'c1');
    assert.deepEqual(await keys(page), names, 'one row each, in roster order');
    await clipOn(page);
    await go(page, turnedIn);
    await score(page, [4, 4, 4]);
    await page.click('#gradesBtn'); await page.waitForSelector('table.gl');
    const rows = await page.$eval('table.gl', e => e.textContent);
    assert.doesNotMatch(rows, /not on roster/, 'the real paper is on the roster');
    await page.click('[data-cp="total"]');
    assert.deepEqual((await clip(page)).split('\n'), names.map(n => n === turnedIn ? '12' : ''), 'the score sits on her line');
    assert.match(await toastText(page), /roster order/);
    noErrors(page); await close();
  }
});

test('a roster name that fits two folders isn’t given to either, and a folder two names fit isn’t either', async () => {
  const { page, close } = await seeded('Sam Lee', 'Sam Lee Kim', 'Ann Alpha', 'Bo Tan');
  await openZip(page, await papers('Ann Alpha/Essay.pdf', 'Sam Lee Kim Park/Essay.pdf', 'Bo Tan Wu/Essay.pdf', 'Bo Tan Yi/Essay.pdf'));
  await pickClass(page, 'c1');
  const s = await keys(page);
  assert.deepEqual(s, ['Sam Lee', 'Sam Lee Kim', 'Ann Alpha', 'Bo Tan', 'Bo Tan Wu', 'Bo Tan Yi', 'Sam Lee Kim Park']);
  noErrors(page); await close();
});

/* copying says the order it really uses */
test('Copy all scores says the order it copies in', async () => {
  const { page, close } = await seeded('Cal Gamma', 'Ann Alpha', 'Ben Beta');
  await openZip(page, await papers('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf', 'Cal Gamma/Essay.pdf'));
  await clipOn(page);
  for (const [k, v] of [['Ann Alpha', 1], ['Ben Beta', 2], ['Cal Gamma', 3]]) { await go(page, k); await score(page, [v, v, v]); }
  const copyAll = async () => {
    await page.evaluate(() => { window.__clip = null; window.__gs.openSheet(); });
    await page.waitForSelector('#dlgBox .bf [data-cp]');
    await page.waitForFunction(() => !document.querySelector('#shBody .prog'), { timeout: 60000 });
    await page.click('#dlgBox .bf [data-cp]');
    const c = await clip(page);
    await page.waitForFunction(() => document.querySelector('.toast').textContent);
    const t = await toastText(page);
    await closeBox(page);
    return [c, t];
  };
  let [c, t] = await copyAll();
  assert.equal(c, '9\n3\n6');
  assert.match(t, /roster order/); assert.doesNotMatch(t, /folder order/);
  await pickClass(page, '');
  [c, t] = await copyAll();
  assert.equal(c, '3\n6\n9');
  assert.match(t, /folder order/); assert.doesNotMatch(t, /roster order/);
  noErrors(page); await close();
});

test('with someone off the roster, the copies say they come last', async () => {
  const { page, close } = await seeded('Cal Gamma', 'Ann Alpha');
  await openZip(page, await papers('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf', 'Cal Gamma/Essay.pdf'));
  await clipOn(page);
  await page.evaluate(() => window.__gs.openSheet());
  await page.waitForSelector('#dlgBox .bf [data-cp]');
  await page.waitForFunction(() => !document.querySelector('#shBody .prog'), { timeout: 60000 });
  await page.click('#dlgBox .bf [data-cp]');
  await clip(page);
  assert.match(await toastText(page), /roster order, then anyone not on it/);
  noErrors(page); await close();
});

test('the export’s grade sheet says the order it’s really in', async () => {
  const { page, close } = await seeded('Cal Gamma', 'Ann Alpha', 'Ben Beta');
  await openZip(page, await papers('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf', 'Cal Gamma/Essay.pdf'));
  await penOn(page);
  await page.evaluate(() => window.__gs.openExport());
  await page.waitForSelector('#xSheet');
  const label = await page.$eval('#xSheet', e => e.parentElement.textContent);
  assert.match(label, /roster order/); assert.doesNotMatch(label, /folder order/);
  noErrors(page); await close();
});

/* moving a file from a student who has a score */
const scoredAnn = async (...paths) => {
  const app = await openApp(browser);
  const zip = await papers(...paths);
  await openZip(app.page, zip);
  await go(app.page, 'Ann Alpha');
  await score(app.page, [3, 3, 4]);
  await comment(app.page, 'Strong close');
  await settle(app.page);
  return { ...app, zip };
};
test('moving a scored file asks, and yes takes the score, comment and status with it, for good', async () => {
  const { page, close, zip } = await scoredAnn('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf');
  await page.evaluate(() => { const st = window.__gs.state().batch.students[0]; st.grade.status = 'late'; });
  await move(page, 'Ann Alpha', 'Ann Alpha/Essay.pdf', 'Ben Beta');
  await answerDlg(page);
  assert.match(page.lastDialog, /Ann Alpha has a score of 10, a comment and the status Late/);
  await moved(page, 'Ben Beta', 'Ann Alpha/Essay.pdf');
  const check = async () => {
    const w = await workOf(page);
    assert.deepEqual(w['Ben Beta'].grade.rubric, [3, 3, 4]);
    assert.equal(w['Ben Beta'].grade.comment, 'Strong close');
    assert.equal(w['Ben Beta'].grade.status, 'late');
    assert.equal(w['Ben Beta'].computed.total, 10);
    assert.deepEqual(w['Ann Alpha'].grade.rubric, []);
    assert.equal(w['Ann Alpha'].grade.comment, '');
    assert.equal(w['Ann Alpha'].grade.status || '', '');
  };
  await check();
  await reopen(page, zip);
  await check();
  noErrors(page); await close();
});

test('through the Move to… box: typing a name and pressing Enter stops at the question', async () => {
  const { page, close } = await scoredAnn('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf');
  await page.click('[data-mvfile]');
  await page.waitForSelector('#mvFind');
  await page.keyboard.type('Ben'); await page.keyboard.press('Enter');
  await page.waitForSelector('#askDlg [data-ok]');
  await new Promise(r => setTimeout(r, 300));
  assert.ok(await page.$('#askDlg'), 'the same Enter doesn’t answer it');
  assert.deepEqual((await workOf(page))['Ben Beta'].grade.rubric, []);
  await page.click('#askDlg [data-no]');
  await moved(page, 'Ben Beta', 'Ann Alpha/Essay.pdf');
  assert.deepEqual((await workOf(page))['Ann Alpha'].grade.rubric, [3, 3, 4]);
  noErrors(page); await close();
});

test('moving a scored file and answering no leaves the score, and says the other paper is still there', async () => {
  const { page, close, zip } = await scoredAnn('Ann Alpha/Essay.pdf', 'Ann Alpha/Stray.pdf', 'Ben Beta/Essay.pdf');
  await move(page, 'Ann Alpha', 'Ann Alpha/Stray.pdf', 'Ben Beta');
  await answerDlg(page, { yes: false });
  assert.match(page.lastDialog, /Ann Alpha still has 1 other file/);
  await moved(page, 'Ben Beta', 'Ann Alpha/Stray.pdf');
  const check = async () => {
    const w = await workOf(page);
    assert.deepEqual(w['Ann Alpha'].grade.rubric, [3, 3, 4]);
    assert.equal(w['Ann Alpha'].grade.comment, 'Strong close');
    assert.deepEqual(w['Ben Beta'].grade.rubric, []);
    assert.deepEqual(Object.keys(w['Ben Beta'].files).sort(), ['Ann Alpha/Stray.pdf', 'Ben Beta/Essay.pdf']);
  };
  await check();
  await reopen(page, zip);
  await check();
  noErrors(page); await close();
});

test('a number typed on the Grade sheet can go with the file too', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, await papers('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf'));
  await page.evaluate(() => { const G = window.__gs, st = G.state().batch.students[0]; st.grade.sheet = '9'; G.touchGrade(st); });
  await move(page, 'Ann Alpha', 'Ann Alpha/Essay.pdf', 'Ben Beta');
  await answerDlg(page);
  assert.match(page.lastDialog, /a score of 9/);
  await moved(page, 'Ben Beta', 'Ann Alpha/Essay.pdf');
  const w = await workOf(page);
  assert.equal(w['Ben Beta'].computed.total, 9);
  assert.equal(w['Ann Alpha'].computed.total, null);
  noErrors(page); await close();
});

test('moving a scored file to someone who has their own score overwrites neither, and says so', async () => {
  const { page, close } = await scoredAnn('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf');
  await go(page, 'Ben Beta');
  await score(page, [1, 1, 1]);
  await move(page, 'Ann Alpha', 'Ann Alpha/Essay.pdf', 'Ben Beta');
  await moved(page, 'Ben Beta', 'Ann Alpha/Essay.pdf');
  await answerDlg(page);
  assert.match(page.lastDialog, /Ann Alpha keeps a score of 10 and a comment/);
  const w = await workOf(page);
  assert.deepEqual(w['Ann Alpha'].grade.rubric, [3, 3, 4]);
  assert.equal(w['Ann Alpha'].grade.comment, 'Strong close');
  assert.deepEqual(w['Ben Beta'].grade.rubric, [1, 1, 1]);
  noErrors(page); await close();
});

test('moving a file off a student with nothing on them doesn’t ask', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, await papers('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf'));
  await move(page, 'Ann Alpha', 'Ann Alpha/Essay.pdf', 'Ben Beta');
  await moved(page, 'Ben Beta', 'Ann Alpha/Essay.pdf');
  assert.equal(await page.$('#askDlg'), null);
  noErrors(page); await close();
});

/* moving a file when her Word rubric holds the score */
// A Word file with a rubric table. high: the level highlighted per row, null for none.
function wordRubric(high) {
  const cell = (t, on) => '<w:tc><w:tcPr>' + (on ? '<w:shd w:val="clear" w:color="auto" w:fill="FFF59D"/>' : '') + '</w:tcPr><w:p><w:r><w:t>' + t + '</w:t></w:r></w:p></w:tc>';
  const levels = [4, 3, 2, 1, 0], rows = high.map((h, i) => '<w:tr>' + cell(['Thesis', 'Evidence', 'Style'][i]) + levels.map(l => cell(String(l), h === l)).join('') + '</w:tr>').join('');
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr>' + cell('Criterion') + levels.map(l => cell(String(l))).join('') + '</w:tr>' + rows + '</w:tbl></w:body></w:document>';
  return zipSync({ ...unzipSync(makeDocx('x')), 'word/document.xml': strToU8(xml) });
}
const BLANK = [null, null, null];
// Rubric setup has a Word rubric as the rubric page, so each student has a copy of it.
const withWordRubric = (...names) => openApp(browser, { seed: { ls: {
  'gs.setup': JSON.stringify({ mode: 'rubric', criteria: ['Thesis', 'Evidence', 'Style'], rubricPage: { id: 'r1', name: 'Rubric.docx' }, rubricPos: 'end' }),
  'gs.rp.r1': JSON.stringify(Buffer.from(wordRubric(BLANK)).toString('base64')),
  ...(names.length ? { 'gs.lib': JSON.stringify(libOf(...names)) } : {}),
} } });
// Clicks score boxes on the Word rubric on screen.
const highlight = async (page, values) => {
  await page.waitForSelector('td.rcell');
  await page.evaluate(values => {
    const rows = [...document.querySelectorAll('tr')].filter(r => r.querySelector('td.rcell'));
    values.forEach((v, i) => [...rows[i].querySelectorAll('td.rcell')].find(td => td.textContent.trim() === String(v)).click());
  }, values);
};
// What the rubric copy on this student says: its total, null with no highlights.
const copyTotal = (page, key) => page.evaluate(key => {
  const G = window.__gs, f = G.state().batch.students.find(s => s.key === key).files.find(f => f.virtual);
  return f ? (G.wordScore(f).total ?? null) : 'no copy';
}, key);
// The score, and what the rubric copy says, once the app has had every chance to read the copies again.
const standing = async (page, ...ks) => {
  await page.waitForFunction(() => !!window.__gs.state().batch);
  await new Promise(r => setTimeout(r, 900));
  await page.evaluate(() => window.__gs.wordScoresAll());
  const w = await workOf(page), out = {};
  for (const k of ks) out[k] = [w[k].computed.total ?? null, await copyTotal(page, k)];
  return out;
};

for (const pause of [false, true]) {
  test('yes on a move takes the score and the highlighted rubric copy along, and the old student doesn’t get it back, ' + (pause ? 'after a pause' : 'straight after highlighting'), async () => {
    const { page, close } = await withWordRubric();
    const zip = await papers('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf');
    await openZip(page, zip);
    await highlight(page, [3, 3, 4]);
    await page.waitForFunction(() => window.__gs.state().batch.students[0].grade.rubric[2] === 4);
    if (pause) { await comment(page, 'Strong close'); await new Promise(r => setTimeout(r, 1000)); await settle(page); }
    await move(page, 'Ann Alpha', 'Ann Alpha/Essay.pdf', 'Ben Beta');
    await answerDlg(page);
    assert.match(page.lastDialog, /Ann Alpha has a score of 10/);
    assert.doesNotMatch(page.lastDialog, /other file/, 'her own copy of the rubric isn’t another paper');
    await moved(page, 'Ben Beta', 'Ann Alpha/Essay.pdf');
    assert.deepEqual(await standing(page, 'Ann Alpha', 'Ben Beta'), { 'Ann Alpha': [null, null], 'Ben Beta': [10, 10] });
    await reopen(page, zip);
    assert.deepEqual(await standing(page, 'Ann Alpha', 'Ben Beta'), { 'Ann Alpha': [null, null], 'Ben Beta': [10, 10] }, 'and when she comes back');
    assert.deepEqual((await workOf(page))['Ann Alpha'].grade.rubric, []);
    // moving it back works the same way
    await move(page, 'Ben Beta', 'Ann Alpha/Essay.pdf', 'Ann Alpha');
    await answerDlg(page);
    assert.match(page.lastDialog, /Ben Beta has a score of 10/);
    await moved(page, 'Ann Alpha', 'Ann Alpha/Essay.pdf');
    assert.deepEqual(await standing(page, 'Ann Alpha', 'Ben Beta'), { 'Ann Alpha': [10, 10], 'Ben Beta': [null, null] });
    await reopen(page, zip);
    assert.deepEqual(await standing(page, 'Ann Alpha', 'Ben Beta'), { 'Ann Alpha': [10, 10], 'Ben Beta': [null, null] });
    noErrors(page); await close();
  });
}

test('no on a move leaves the score and the highlighted copy, and only papers count as other files', async () => {
  const { page, close } = await withWordRubric();
  const zip = await papers('Ann Alpha/Essay.pdf', 'Ann Alpha/Stray.pdf', 'Ben Beta/Essay.pdf');
  await openZip(page, zip);
  await highlight(page, [3, 3, 4]);
  await move(page, 'Ann Alpha', 'Ann Alpha/Stray.pdf', 'Ben Beta');
  await answerDlg(page, { yes: false });
  assert.match(page.lastDialog, /Ann Alpha still has 1 other file\./);
  await moved(page, 'Ben Beta', 'Ann Alpha/Stray.pdf');
  assert.deepEqual(await standing(page, 'Ann Alpha', 'Ben Beta'), { 'Ann Alpha': [10, 10], 'Ben Beta': [null, null] });
  await reopen(page, zip);
  assert.deepEqual(await standing(page, 'Ann Alpha', 'Ben Beta'), { 'Ann Alpha': [10, 10], 'Ben Beta': [null, null] });
  noErrors(page); await close();
});

test('the rubric copy that went with its score stays right when Rubric setup puts the copies out again', async () => {
  const { page, close } = await withWordRubric();
  const zip = await papers('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf');
  await openZip(page, zip);
  await highlight(page, [3, 3, 4]);
  await move(page, 'Ann Alpha', 'Ann Alpha/Essay.pdf', 'Ben Beta');
  await answerDlg(page);
  await moved(page, 'Ben Beta', 'Ann Alpha/Essay.pdf');
  await settle(page);
  await page.evaluate(() => window.__gs.openSetup());
  await page.waitForSelector('[data-pos="start"]');
  await page.click('[data-pos="start"]');
  await page.click('[data-save]');
  await page.waitForFunction(() => window.__gs.state().setup.rubricPos === 'start');
  assert.deepEqual(await standing(page, 'Ann Alpha', 'Ben Beta'), { 'Ann Alpha': [null, null], 'Ben Beta': [10, 10] });
  await reopen(page, zip);
  assert.deepEqual(await standing(page, 'Ann Alpha', 'Ben Beta'), { 'Ann Alpha': [null, null], 'Ben Beta': [10, 10] });
  noErrors(page); await close();
});

test('yes on a move to someone with no folder and no rubric copy: the highlighted copy goes to them, for good', async () => {
  const { page, close } = await withWordRubric('Ann Alpha', 'Ben Beta', 'Zed Nopaper');
  const zip = await papers('Ann Alpha/Essay.pdf', 'Ben Beta/Essay.pdf');
  await openZip(page, zip);
  await highlight(page, [3, 3, 4]);
  await move(page, 'Ann Alpha', 'Ann Alpha/Essay.pdf', 'Zed Nopaper');
  await answerDlg(page);
  await moved(page, 'Zed Nopaper', 'Ann Alpha/Essay.pdf');
  const want = { 'Ann Alpha': [null, 'no copy'], 'Zed Nopaper': [10, 10] };
  assert.deepEqual(await standing(page, 'Ann Alpha', 'Zed Nopaper'), want);
  await reopen(page, zip);
  assert.deepEqual(await standing(page, 'Ann Alpha', 'Zed Nopaper'), want);
  noErrors(page); await close();
});

test('a highlighted copy that went with its score stays with it in a newer copy of the download', async () => {
  const { page, close } = await withWordRubric();
  const files = { 'Ann Alpha/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ann Alpha/Notes.pdf': await makePaper({ title: 'Ann notes' }), 'Ben Beta/Essay.pdf': await makePaper({ title: 'Ben' }) };
  await openZip(page, zipOf(files), 'Older.zip');
  await highlight(page, [3, 3, 4]);
  await move(page, 'Ann Alpha', 'Ann Alpha/Essay.pdf', 'Ben Beta');
  await answerDlg(page);
  await moved(page, 'Ben Beta', 'Ann Alpha/Essay.pdf');
  await new Promise(r => setTimeout(r, 300));
  await settle(page);
  await page.click('#closeBtn');
  await new Promise(r => setTimeout(r, 300));
  const clear = setInterval(() => page.evaluate(() => { const b = document.querySelector('#askDlg [data-ok]'); if (b) b.click(); }).catch(() => {}), 200);
  clear.unref();
  await openZip(page, zipOf({ ...files, 'Cal Gamma/Essay.pdf': await makePaper({ title: 'Cal' }) }), 'Newer.zip');
  clearInterval(clear);
  assert.deepEqual(Object.keys((await workOf(page))['Ben Beta'].files).includes('Ann Alpha/Essay.pdf'), true, 'the work came over');
  assert.deepEqual(await standing(page, 'Ann Alpha', 'Ben Beta'), { 'Ann Alpha': [null, null], 'Ben Beta': [10, 10] });
  noErrors(page); await close();
});

/* a scored Word file moved onto someone */
const scoredWord = async () => {
  const app = await openApp(browser);
  const zip = zipOf({ 'Ann Alpha/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ann Alpha/Rubric.docx': wordRubric([3, 3, 4]), 'Ben Beta/Essay.pdf': await makePaper({ title: 'Ben' }) });
  await openZip(app.page, zip);
  await app.page.evaluate(() => window.__gs.wordScoresAll());
  await app.page.evaluate(() => { const G = window.__gs, st = G.state().batch.students[0]; G.setReading(st, G.readKey(st.doubts[0]), '1'); });   // a table in a student's file counts once she says so
  await app.page.waitForFunction(() => window.__gs.state().batch.students[0].grade.rubric[2] === 4);
  return { ...app, zip };
};
const totals = async page => { const w = await workOf(page); return [w['Ann Alpha'].computed.total ?? null, w['Ben Beta'].computed.total ?? null]; };

test('a scored Word file moved to someone with their own score: the score stays where it was and she’s told', async () => {
  const { page, close, zip } = await scoredWord();
  await go(page, 'Ben Beta');
  await score(page, [1, 1, 1]);
  await settle(page);
  await move(page, 'Ann Alpha', 'Ann Alpha/Rubric.docx', 'Ben Beta');
  await moved(page, 'Ben Beta', 'Ann Alpha/Rubric.docx');
  await answerDlg(page);
  assert.match(page.lastDialog, /Ann Alpha keeps a score of 10, because Ben Beta already has their own/);
  await page.evaluate(() => window.__gs.wordScoresAll());
  assert.deepEqual(await totals(page), [10, 3]);
  await reopen(page, zip);
  await page.evaluate(() => window.__gs.wordScoresAll());
  assert.deepEqual(await totals(page), [10, 3]);
  const w = await workOf(page);
  assert.deepEqual(w['Ann Alpha'].grade.rubric, [3, 3, 4]);
  assert.deepEqual(w['Ben Beta'].grade.rubric, [1, 1, 1]);
  noErrors(page); await close();
});

test('the same with a comment on the old student: the message names the score too', async () => {
  const { page, close } = await scoredWord();
  await comment(page, 'Strong close');
  await go(page, 'Ben Beta');
  await score(page, [1, 1, 1]);
  await move(page, 'Ann Alpha', 'Ann Alpha/Rubric.docx', 'Ben Beta');
  await moved(page, 'Ben Beta', 'Ann Alpha/Rubric.docx');
  await answerDlg(page);
  assert.match(page.lastDialog, /Ann Alpha keeps a score of 10 and a comment/);
  assert.deepEqual(await totals(page), [10, 3]);
  noErrors(page); await close();
});

test('the same when the other student’s score was typed on the Grade sheet: theirs isn’t written over, even once opened', async () => {
  const { page, close, zip } = await scoredWord();
  await page.evaluate(() => { const G = window.__gs, st = G.state().batch.students[1]; st.grade.sheet = '9'; G.touchGrade(st); });
  await move(page, 'Ann Alpha', 'Ann Alpha/Rubric.docx', 'Ben Beta');
  await moved(page, 'Ben Beta', 'Ann Alpha/Rubric.docx');
  await answerDlg(page);
  assert.match(page.lastDialog, /Ann Alpha keeps a score of 10/);
  await go(page, 'Ben Beta');
  await new Promise(r => setTimeout(r, 300));
  assert.deepEqual(await totals(page), [10, 9]);
  await reopen(page, zip);
  await page.evaluate(() => window.__gs.wordScoresAll());
  assert.deepEqual(await totals(page), [10, 9]);
  noErrors(page); await close();
});

test('the same when the other student is marked excused: the score stays where she can see it', async () => {
  const { page, close } = await scoredWord();
  await page.evaluate(() => { const G = window.__gs, st = G.state().batch.students[1]; st.grade.status = 'excused'; G.touchGrade(st); });
  await move(page, 'Ann Alpha', 'Ann Alpha/Rubric.docx', 'Ben Beta');
  await moved(page, 'Ben Beta', 'Ann Alpha/Rubric.docx');
  await answerDlg(page);
  assert.match(page.lastDialog, /Ann Alpha keeps a score of 10/);
  assert.deepEqual(await totals(page), [10, null]);
  noErrors(page); await close();
});

test('a scored Word file moved to someone with no score just takes its score along, without asking', async () => {
  const { page, close, zip } = await scoredWord();
  await move(page, 'Ann Alpha', 'Ann Alpha/Rubric.docx', 'Ben Beta');
  await moved(page, 'Ben Beta', 'Ann Alpha/Rubric.docx');
  await new Promise(r => setTimeout(r, 200));
  assert.equal(await page.$('#askDlg'), null);
  assert.deepEqual(await totals(page), [null, 10]);
  await reopen(page, zip);
  await page.evaluate(() => window.__gs.wordScoresAll());
  assert.deepEqual(await totals(page), [null, 10]);
  noErrors(page); await close();
});

test('boxes clicked a moment before the move count: the score goes with the Word file, with no question', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Ann Alpha/Essay.pdf': await makePaper({ title: 'Ann' }), 'Ann Alpha/Rubric.docx': wordRubric(BLANK), 'Ben Beta/Essay.pdf': await makePaper({ title: 'Ben' }) }));
  await highlight(page, [3, 3, 4]);
  await page.waitForFunction(() => window.__gs.state().batch.students[0].grade.rubric[2] === 4);
  await move(page, 'Ann Alpha', 'Ann Alpha/Rubric.docx', 'Ben Beta');
  await moved(page, 'Ben Beta', 'Ann Alpha/Rubric.docx');
  await new Promise(r => setTimeout(r, 200));
  assert.equal(await page.$('#askDlg'), null);
  assert.deepEqual(await totals(page), [null, 10]);
  noErrors(page); await close();
});
