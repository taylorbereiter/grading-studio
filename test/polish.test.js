// The look: one row of top bar, dark mode that can be read, the right key names, the app's own pop-ups, and a font that needs no internet.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { launch } = require('./helpers/chrome');
const { classPage, ROOT, builtHtml, openApp, answerDlg, appReady, openZip, pickFile, score, settle } = require('./helpers/app');
const { makePaper, standardFiles, zipOf } = require('./helpers/fixtures');
const { contrastFails, contrastSeen } = require('./helpers/contrast');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const setTheme = async (page, t) => { await page.evaluate(t => { localStorage.setItem('gs.theme', JSON.stringify(t)); }, t); await page.reload(); await appReady(page); };
const moreOpen = page => page.$eval('#moreMenu', m => !m.hidden);
const active = page => page.evaluate(() => { const a = document.activeElement; return a.id || a.tagName; });

/* ---------------- the top bar ---------------- */
for (const width of [1280, 1440]) test('the top bar is one row at ' + width + 'px, and every control is reachable under More', async () => {
  const { page, close } = await openApp(browser);
  await page.setViewport({ width, height: 800 });
  await openZip(page, zip);
  const bar = await page.$eval('.top', top => {
    const shown = [...top.querySelectorAll('button,select,.batch,.title')].filter(e => e.checkVisibility() && !e.closest('#moreMenu'));
    const rects = shown.map(e => e.getBoundingClientRect()), mid = r => r.top + r.height / 2, y = mid(rects[0]);
    return { same: rects.every(r => Math.abs(mid(r) - y) < 4), h: top.getBoundingClientRect().height, spill: top.scrollWidth - top.clientWidth, controls: shown.filter(e => e.matches('button,select')).map(e => e.id) };
  });
  assert.ok(bar.same, 'all on one row'); assert.ok(bar.h < 60, 'one row tall, got ' + bar.h); assert.ok(bar.spill <= 0, 'nothing spills out');
  assert.deepEqual(bar.controls, ['saveWhere', 'sheetBtn', 'gradesBtn', 'exportBtn', 'moreBtn', 'closeBtn']);   // saveWhere: the line saying where her work is saved
  await page.click('#moreBtn');
  for (const id of ['classSel', 'setupBtn', 'bringBtn', 'shareBtn', 'backBtn', 'lightBtn', 'dispBtn', 'calcBtn', 'keysBtn']) {
    const r = await page.$eval('#' + id, e => { const b = e.getBoundingClientRect(); return e.checkVisibility() && b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; });
    assert.ok(r, id + ' shows in the menu, fully on screen');
  }
  assert.ok(await page.$eval('#moreMenu .themeBtn', e => e.checkVisibility()));
  assert.deepEqual(page.errors, []);
  await close();
});

test('the More menu opens things, and keys work as expected', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await page.focus('#moreBtn'); await page.keyboard.press('Enter');
  assert.ok(await moreOpen(page));
  assert.equal(await page.$eval('#moreBtn', e => e.getAttribute('aria-expanded')), 'true');
  assert.equal(await active(page), 'setupBtn', 'the first thing in the menu that isn’t the roster');
  await page.keyboard.press('Tab');
  assert.equal(await active(page), 'bringBtn');
  await page.keyboard.press('ArrowDown');
  assert.equal(await active(page), 'openRepBtn');
  await page.keyboard.press('ArrowDown');
  assert.equal(await active(page), 'shareBtn');
  const before = await page.evaluate(() => window.__gs.state().cur);
  for (const k of ['ArrowDown', 'ArrowLeft', 'ArrowRight']) await page.keyboard.press(k);
  assert.equal(await page.evaluate(() => window.__gs.state().cur), before, 'the arrows move in the menu, not between students');
  await page.keyboard.press('Escape');
  assert.ok(!await moreOpen(page)); assert.equal(await active(page), 'moreBtn', 'focus comes back to the button');
  // a menu item opens its dialog and closes the menu; closing it puts focus back on More
  await page.click('#moreBtn'); await page.click('#setupBtn');
  assert.ok(!await moreOpen(page));
  assert.ok(await page.$eval('#dlgBox', e => e.textContent.includes('Rubric setup')));
  await page.keyboard.press('Escape');
  assert.equal(await active(page), 'moreBtn');
  // a click elsewhere closes it; choosing a roster doesn't
  await page.click('#moreBtn'); await page.click('.mrow');
  assert.ok(await moreOpen(page));
  await page.click('#paper'); assert.ok(!await moreOpen(page));
  // the theme and the keys list still work from it
  await page.click('#moreBtn'); await page.click('#moreMenu .themeBtn');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await page.click('#moreBtn'); await page.click('#keysBtn');
  await page.waitForSelector('#dlgBox .keys');
  assert.deepEqual(page.errors, []);
  await close();
});

// Two rosters, with an assignment in the first one, and its download open.
async function twoRosters(page) {
  for (const [name, who] of [['9EL-A', 'Aria Testwell\nBram Sample'], ['Zed-B', 'Zed Other']]) {
    await page.click('#addClass'); await page.waitForSelector('#cName');
    await page.type('#cName', name); await page.type('#cNames', who); await page.click('#dlgBox [data-ok]');
    await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  }
  const id = await page.evaluate(() => window.__gs.state().lib.classes.find(c => c.name === '9EL-A').id);
  await classPage(page, id);
  await page.click('[data-addunit="' + id + '"]');
  await answerDlg(page, { typed: 'Unit A' });
  await page.waitForSelector('[data-additem]'); await page.click('[data-additem]');
  await page.waitForSelector('#aName'); await page.type('#aName', 'Poems'); await page.click('#dlgBox [data-ok]');
  await page.waitForSelector('[data-open-asg]'); await page.click('[data-open-asg]');
  await page.waitForSelector('#dlgBox [data-pc]'); await page.click('#dlgBox [data-cancel]');
  const clean = await pickFile(page, '#asgIn', zip, 'Poems.zip');
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.batch && s.pages.length && s.pages[0].s > 0; });
  clean();
}
const rosterNow = page => page.evaluate(() => {
  const s = window.__gs.state();
  return { sel: document.querySelector('#classSel').value, cls: s.batch.classId, students: s.batch.students.map(x => x.key), where: s.lib.classes.filter(c => /^(9EL-A|Zed-B)$/.test(c.name)).map(c => c.name + ':' + c.units.flatMap(u => u.items.map(i => i.name)).join()) };
});

test('with More open, no stray key changes the roster or moves the assignment', async () => {
  const { page, close } = await openApp(browser);
  await twoRosters(page);
  const was = await rosterNow(page);
  assert.deepEqual(was.where, ['9EL-A:Poems', 'Zed-B:']);
  // opened with the mouse, then the arrow keys she uses all the time
  await page.click('#moreBtn');
  for (const k of ['ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) await page.keyboard.press(k);
  assert.deepEqual(await rosterNow(page), was, 'arrows from the first item');
  // even with the keyboard resting on the roster itself
  for (const k of ['ArrowRight', 'ArrowLeft', 'Home', 'End', 'PageDown', 'PageUp', 'KeyZ', 'KeyN']) {
    await page.focus('#classSel');
    await page.keyboard.press(k);
    assert.deepEqual(await rosterNow(page), was, k + ' on the roster');
  }
  await page.focus('#classSel');
  await page.keyboard.down('Control'); await page.keyboard.press('ArrowDown'); await page.keyboard.up('Control');
  assert.deepEqual(await rosterNow(page), was, 'Ctrl+Down on the roster');
  await page.focus('#classSel');
  await page.keyboard.press('ArrowDown');
  assert.equal(await active(page), 'setupBtn', 'the arrows pass through the roster to the next item');
  assert.deepEqual(await rosterNow(page), was, 'Down on the roster');
  await page.focus('#classSel');
  await page.keyboard.press('ArrowUp');
  assert.equal(await active(page), 'keysBtn', 'and around the other way');
  // Space opens the list, as it does everywhere, so the app must leave it alone. Choosing from the list still moves the assignment.
  await page.focus('#classSel');
  await page.evaluate(() => { window.addEventListener('keydown', e => { window.__spaceBlocked = e.defaultPrevented; }, { once: true }); });
  await page.keyboard.down('Space');
  assert.equal(await page.evaluate(() => window.__spaceBlocked), false, 'Space reaches the list');
  await page.keyboard.up('Space'); await page.keyboard.press('Escape');
  await page.evaluate(() => { const s = document.querySelector('#classSel'); s.value = window.__gs.state().lib.classes.find(c => c.name === 'Zed-B').id; s.dispatchEvent(new Event('change')); });
  assert.deepEqual((await rosterNow(page)).where, ['9EL-A:', 'Zed-B:Poems']);
  assert.deepEqual(page.errors, []);
  await close();
});

for (const width of [1280, 1440]) test('at ' + width + 'px the More menu sits above Lighting and the Calculator, and all of it can be clicked', async () => {
  const { page, close } = await openApp(browser);
  await page.setViewport({ width, height: 800 });
  await openZip(page, zip);
  await page.click('#moreBtn'); await page.click('#lightBtn');
  await page.waitForSelector('#lightPanel');
  assert.ok(!await moreOpen(page));
  await page.evaluate(() => { window.__gs.openCalc(); const c = document.querySelector('#calcPanel'), m = document.querySelector('#moreBtn').getBoundingClientRect(); c.style.right = (innerWidth - m.right) + 'px'; });   // she can drag it there
  await page.click('#moreBtn');
  const covered = await page.$$eval('#moreMenu .mitem, #moreMenu .mrow', list => list.filter(e => e.checkVisibility()).filter(e => { const r = e.getBoundingClientRect(), at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !e.contains(at); }).map(e => e.id || e.textContent));
  assert.deepEqual(covered, []);
  await page.click('#dispBtn');
  await page.waitForSelector('#dispBody');
  assert.ok(await page.$('#lightPanel'), 'Lighting stays open behind it');
  const onTop = await page.evaluate(() => { const b = document.querySelector('#dispBody').getBoundingClientRect(); return !!document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2).closest('#dlg'); });
  assert.ok(onTop, 'a dialog still opens over the panels');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Box each grade, Box it by hand and Check the covers show the paper', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  const named = () => page.evaluate(() => { const b = document.querySelector('#dlgBox'), h = document.getElementById(b.getAttribute('aria-labelledby')); return h && h === b.querySelector('h2') ? h.textContent : null; });
  await page.click('#sheetBtn');
  await page.waitForSelector('#dlgBox [data-each]'); await page.click('#dlgBox [data-each]');
  await page.waitForSelector('#peBody canvas');
  assert.ok(['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup'].includes(await named()), 'its title is the student');
  assert.match(await page.$eval('#peCount', e => e.textContent), /^Student \d of 4 · paper 1 of \d$/);
  await page.keyboard.press('Escape');
  await page.waitForSelector('#dlgBox [data-rebox]'); await page.click('#dlgBox [data-rebox]');
  await page.waitForSelector('#peBody canvas');
  assert.ok(await named(), 'a row’s Box it by hand');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#dlgBox [data-each]');
  await page.click('#dlgBox [data-close]');
  await page.click('#moreBtn'); await page.click('#shareBtn');
  await page.waitForSelector('#dlgBox [data-check]'); await page.click('#dlgBox [data-check]');
  await page.waitForSelector('#ccBody canvas');
  assert.match(await named(), / → S-/, 'its title is the student and their code');
  assert.match(await page.$eval('#ccCount', e => e.textContent), /^paper 1 of \d$/);
  await page.keyboard.press('Escape');
  await page.waitForSelector('#dlgBox [data-make]');
  await page.click('#dlgBox [data-close]');
  // the same check, from Anonymous grading
  await page.evaluate(() => window.__gs.openAnon());
  await page.waitForSelector('#dlgBox [data-check]'); await page.click('#dlgBox [data-check]');
  await page.waitForSelector('#ccBody canvas');
  assert.match(await named(), / → S-/, 'its title is the student and their code');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#dlgBox [data-go]');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the tools fit on one row at 1280px, even with the pen’s choices showing', async () => {
  const { page, close } = await openApp(browser);
  await page.setViewport({ width: 1280, height: 800 });
  await openZip(page, zip);
  await page.evaluate(() => window.__gs.setTool('pen'));
  const below = await page.$eval('#tools', t => { const kids = [...t.children].filter(e => e.getBoundingClientRect().height), end = kids[0].getBoundingClientRect().bottom; return kids.filter(e => e.getBoundingClientRect().top >= end).map(e => e.className); });
  assert.deepEqual(below, []);
  await close();
});

test('the floating panels close with Escape from inside them', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await page.evaluate(() => window.__gs.openLight());
  await page.waitForSelector('#lightPanel[role=dialog]');
  await page.focus('#lightPanel button');
  await page.keyboard.press('Escape');
  assert.equal(await page.$('#lightPanel'), null);
  await close();
});

test('the Atlas link moved under More, and still works', async () => {
  const { page, close } = await openApp(browser);
  await classPage(page, 0);
  await page.click('#classes [data-addunit]');
  await answerDlg(page, { typed: 'Poems' });
  await page.waitForSelector('[data-additem]'); await page.click('[data-additem]');
  await page.waitForSelector('#aName'); await page.type('#aName', 'River essay'); await page.click('#dlgBox [data-ok]');
  await page.waitForSelector('[data-open-asg]'); await page.click('[data-open-asg]');
  await page.waitForSelector('#dlgBox [data-pc]'); await page.click('#dlgBox [data-cancel]');
  const clean = await pickFile(page, '#asgIn', zip, 'River.zip');
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.batch && s.pages.length && s.pages[0].s > 0; });
  clean();
  await page.click('#moreBtn');
  await page.click('#topAtlas [data-uatlas]');
  assert.ok(!await moreOpen(page), 'the menu gets out of the way');
  await answerDlg(page, { typed: 'atlas.example.org/poems' });
  await page.waitForSelector('#topAtlas a[href="https://atlas.example.org/poems"]');
  await page.click('#moreBtn');
  assert.ok(await page.$eval('#topAtlas a', e => e.checkVisibility()));
  assert.deepEqual(page.errors, []);
  await close();
});

/* ---------------- dark mode, and real contrast measurements ---------------- */
for (const theme of ['light', 'dark']) test('every screen reads at WCAG AA in ' + theme + ' mode', async () => {
  const { page, close } = await openApp(browser);
  await page.setViewport({ width: 1280, height: 800 });
  await setTheme(page, theme);
  const check = async where => {
    assert.ok(await page.evaluate(contrastSeen) > 5, where + ': the scan saw the screen');
    assert.deepEqual(await page.evaluate(contrastFails), [], where);
  };
  await check('start, empty');
  await openZip(page, zip);
  await check('main, nothing scored');
  await score(page, [3.5, 3, null]);
  await check('main, part scored');
  await page.click('#moreBtn'); await check('More menu'); await page.keyboard.press('Escape');
  for (const [id, sel] of [['gradesBtn', '.gl'], ['exportBtn', '#dlgBox h2'], ['setupBtn', '#setupBody'], ['dispBtn', '#dispBody'], ['shareBtn', '#dlgBox h2'], ['backBtn', '#dlgBox h2']]) {
    await page.evaluate(id => document.getElementById(id).click(), id);
    await page.waitForSelector(sel);
    await check(id);
    await page.keyboard.press('Escape');
  }
  await page.keyboard.press('?'); await page.waitForSelector('.keys'); await check('Keys'); await page.keyboard.press('Escape');
  page.evaluate(() => { window.__gs.askDlg('Delete “Unit 1”?', { ok: 'Delete', danger: true }); });
  await page.waitForSelector('#askDlg'); await check('a pop-up'); await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#askDlg'));
  await settle(page);
  await page.click('#closeBtn');
  await page.waitForSelector('#kept [data-kopen]');
  await check('start, with work');
  assert.deepEqual(page.errors, []);
  await close();
});

test('dark mode: the progress bar isn’t full at 0, and the rubric buttons can be read', async () => {
  const { page, close } = await openApp(browser);
  await setTheme(page, 'dark');
  await openZip(page, zip);
  const m = await page.evaluate(() => {
    const lit = c => { const [r, g, b] = c.match(/[\d.]+/g).map(Number); return (r + g + b) / 3; };
    return { track: lit(getComputedStyle(document.querySelector('.prog-s .pb')).backgroundColor), fill: document.querySelector('.prog-s .pb i').getBoundingClientRect().width, surface: lit(getComputedStyle(document.body).backgroundColor) };
  });
  assert.equal(m.fill, 0, 'no fill at 0 scored');
  assert.ok(m.track < 90, 'the empty bar stays dark, not bright like a full one: ' + m.track);
  assert.ok(m.track > m.surface, 'and can still be seen');
  await close();
});

test('papers keep their own light colors in dark mode (slides: planner.test.js)', async () => {
  const { page, close } = await openApp(browser);
  await setTheme(page, 'dark');
  const paper = await page.evaluate(() => {
    const d = document.createElement('div'); d.className = 'dpage'; document.body.appendChild(d);
    const out = [getComputedStyle(d).backgroundColor, getComputedStyle(d).color]; d.remove(); return out;
  });
  assert.deepEqual(paper, ['rgb(255, 255, 255)', 'rgb(21, 25, 34)']);
  await close();
});

test('no fixed colors left where the plan named them', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src', 'app.html'), 'utf8');
  for (const sel of ['.stu:hover', '.tool', '.scores button', '.prog-s .pb']) {
    const line = css.split('\n').find(l => l.startsWith(sel + '{'));
    assert.ok(line, sel); assert.ok(!/#[0-9a-f]{3,6}\b/i.test(line), sel + ': ' + line);
  }
});

/* ---------------- ⌘ on a Mac, Ctrl on Windows ---------------- */
const allLabels = page => page.evaluate(() => {
  const out = [document.querySelector('#app').innerText, document.querySelector('#dlg').innerText];
  for (const e of document.querySelectorAll('#app [title]')) out.push(e.title);
  return out.join('\n');
});
for (const [platform, wanted, unwanted] of [['mac', '⌘', /Ctrl/], ['win', 'Ctrl', /[⌘⇧]/]]) test('key labels say ' + wanted + ' on ' + platform, async () => {
  const { page, close } = await openApp(browser, { platform });
  assert.equal(await page.evaluate(() => window.__gs.isMac()), platform === 'mac');
  assert.equal(await page.evaluate(() => window.__gs.modKey()), wanted);
  await openZip(page, zip);
  let t = await allLabels(page);
  assert.ok(t.includes(wanted), 'the hint and tooltips'); assert.doesNotMatch(t, unwanted);
  assert.ok((await page.$eval('#undoBtn', e => e.title)).includes(platform === 'mac' ? '⌘Z' : 'Ctrl+Z'));
  assert.ok((await page.$eval('#redoBtn', e => e.title)).includes(platform === 'mac' ? '⇧⌘Z' : 'Ctrl+Shift+Z'));
  await page.keyboard.press('?'); await page.waitForSelector('.keys');
  t = await page.$eval('.keys', e => e.innerText);
  assert.ok(t.includes(wanted), 'the Keys list'); assert.doesNotMatch(t, unwanted);
  await page.keyboard.press('Escape');
  // Arrange pages
  await page.evaluate(() => window.__gs.openArrange());
  await page.waitForSelector('#arrBody');
  t = await page.$eval('#dlgBox', e => e.innerText);
  assert.ok(t.includes(wanted + '-click'), 'Arrange pages'); assert.doesNotMatch(t, unwanted);
  await page.keyboard.press('Escape');
  // the toast after copying a mark
  assert.equal(await page.evaluate(() => window.__gs.keyLabel('Copied. ⌘V pastes')), platform === 'mac' ? 'Copied. ⌘V pastes' : 'Copied. Ctrl+V pastes');
  await close();
});

test('the source has no bare ⌘ in a label outside keyLabel', () => {
  const src = ['app', 'marking', 'grades', 'saving', 'carryover', 'exportreport', 'planner/lessons'].flatMap(f => fs.readFileSync(path.join(ROOT, 'src', f + '.js'), 'utf8').split('\n'));
  const bare = src.filter(l => /⌘/.test(l) && !/^\s*\/\//.test(l) && !/keyLabel\(|row\('/.test(l) && !/\/\/.*⌘/.test(l));
  assert.deepEqual(bare, []);
});

/* ---------------- the app's own pop-ups ---------------- */
test('nothing in the app uses a browser pop-up any more', async () => {
  for (const f of ['app.js', 'marking.js', 'grades.js', 'saving.js', 'carryover.js', 'exportreport.js', 'planner/lessons.js', 'planner/units.js', 'planner/base.js', 'polish.js']) {
    const s = fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');
    assert.doesNotMatch(s, /(^|[^.\w])(window\.)?(confirm|prompt|alert)\(/m, f);
  }
});

test('askDlg: true on OK, false on Cancel, Escape or a click outside; Enter on a risky one is safe', async () => {
  const { page, close } = await openApp(browser);
  const ask = o => page.evaluate(o => { window.__r = 'waiting'; window.__gs.askDlg('Delete it?\n\nThis can’t be undone.', o).then(v => { window.__r = v; }); }, o);
  const got = async () => { await page.waitForFunction(() => window.__r !== 'waiting'); return page.evaluate(() => window.__r); };
  await page.focus('#addClass');
  await ask({ ok: 'Delete' });
  await answerDlg(page);
  assert.equal(page.lastDialog, 'Delete it?\n\nThis can’t be undone.');
  assert.equal(await got(), true);
  assert.equal(await active(page), 'addClass', 'focus comes back to where it was');
  await ask({}); await answerDlg(page, { yes: false }); assert.equal(await got(), false);
  await ask({}); await page.waitForSelector('#askDlg'); await page.keyboard.press('Escape'); assert.equal(await got(), false);
  await ask({}); await page.waitForSelector('#askDlg'); await page.mouse.click(5, 5); assert.equal(await got(), false);
  assert.equal(await page.$('#askDlg'), null);
  // words on the buttons, role and name
  await ask({ ok: 'Delete', cancel: 'Keep it', danger: true }); await page.waitForSelector('#askDlg');
  const d = await page.evaluate(() => { const b = document.querySelector('#askDlg .box'), a = document.activeElement; return { role: b.getAttribute('role'), modal: b.getAttribute('aria-modal'), named: document.getElementById(b.getAttribute('aria-labelledby')).textContent, ok: document.querySelector('#askDlg [data-ok]').textContent, no: document.querySelector('#askDlg [data-no]').textContent, cls: document.querySelector('#askDlg [data-ok]').className, focus: a.textContent }; });
  assert.equal(d.role, 'alertdialog'); assert.equal(d.modal, 'true'); assert.match(d.named, /Delete it/); assert.equal(d.ok, 'Delete'); assert.equal(d.no, 'Keep it'); assert.match(d.cls, /danger/);
  assert.equal(d.focus, 'Keep it', 'a risky question starts on the safe answer');
  await page.keyboard.press('Enter'); assert.equal(await got(), false);
  assert.deepEqual(page.errors, []);
  await close();
});

test('sayDlg and askTextDlg', async () => {
  const { page, close } = await openApp(browser);
  await page.evaluate(() => { window.__s = 'waiting'; window.__gs.sayDlg('All done.').then(v => { window.__s = v === undefined ? 'closed' : v; }); });
  await page.waitForSelector('#askDlg');
  assert.equal(await page.$('#askDlg [data-no]'), null, 'only one button');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__s === 'closed');
  const typed = async fn => {
    await page.evaluate(() => { window.__t = 'waiting'; window.__gs.askTextDlg('Unit name', 'Unit 2').then(v => { window.__t = v; }); });
    await page.waitForSelector('#askIn');
    await fn();
    await page.waitForFunction(() => window.__t !== 'waiting');
    return page.evaluate(() => window.__t);
  };
  assert.equal(await typed(async () => { assert.equal(await page.$eval('#askIn', e => e.value), 'Unit 2'); assert.equal(await active(page), 'askIn'); await page.keyboard.type('Poems'); await page.keyboard.press('Enter'); }), 'Poems', 'typing replaces what was there');
  assert.equal(await typed(() => page.keyboard.press('Escape')), null);
  await close();
});

test('a pop-up over a dialog: only it hears keys, Tab stays in it, and the dialog behind stays open', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await page.click('#gradesBtn'); await page.waitForSelector('.gl');
  await page.evaluate(() => { window.__r = 'waiting'; window.__gs.askDlg('Sure?').then(v => { window.__r = v; }); });
  await page.waitForSelector('#askDlg');
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => !!document.activeElement.closest('#askDlg')), 'Tab stays in'); }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__r === false);
  assert.ok(await page.$eval('#dlg', d => !d.hidden), 'Escape closed only the pop-up');
  // on the main screen, shortcuts wait while one is up
  await page.keyboard.press('Escape');
  const tool = () => page.$eval('.tool[aria-pressed=true]', e => e.dataset.tool);
  const t0 = await tool();
  await page.evaluate(() => { window.__r = 'waiting'; window.__gs.askDlg('Sure?').then(v => { window.__r = v; }); });
  await page.waitForSelector('#askDlg');
  await page.keyboard.press('e');
  assert.equal(await tool(), t0);
  await page.keyboard.press('Escape');
  await close();
});

test('dialogs: named, focus goes in, Tab stays in, Escape closes, focus comes back', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip);
  await page.focus('#gradesBtn'); await page.keyboard.press('Enter');
  await page.waitForSelector('.gl');
  const d = await page.evaluate(() => { const b = document.querySelector('#dlgBox'); return { role: b.getAttribute('role'), modal: b.getAttribute('aria-modal'), name: document.getElementById(b.getAttribute('aria-labelledby')).textContent, inside: b.contains(document.activeElement) }; });
  assert.equal(d.role, 'dialog'); assert.equal(d.modal, 'true'); assert.equal(d.name, 'Grades list'); assert.ok(d.inside);
  for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => document.querySelector('#dlgBox').contains(document.activeElement)), 'Tab forward stays in'); }
  for (let i = 0; i < 40; i++) { await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift'); assert.ok(await page.evaluate(() => document.querySelector('#dlgBox').contains(document.activeElement)), 'Tab back stays in'); }
  await page.keyboard.press('Escape');
  assert.ok(await page.$eval('#dlg', e => e.hidden));
  assert.equal(await active(page), 'gradesBtn');
  assert.deepEqual(page.errors, []);
  await close();
});

test('real uses: adding, renaming and deleting a unit go through the app’s own pop-ups', async () => {
  const { page, close } = await openApp(browser);
  page.removeAllListeners('dialog');
  let native = 0; page.on('dialog', d => { native++; d.dismiss(); });
  await classPage(page, 0);
  await page.click('#classes [data-addunit]');
  await answerDlg(page, { typed: 'Poetry' });
  await page.waitForFunction(() => window.__gs.state().lib.classes[0].units.some(u => u.name === 'Poetry'));
  await page.waitForSelector('[data-urename]');
  await page.click('[data-urename]');
  await answerDlg(page, { typed: 'Poems' });
  await page.waitForFunction(() => window.__gs.state().lib.classes[0].units[0].name === 'Poems');
  await page.click('[data-urename]');
  await answerDlg(page, { yes: false });
  assert.equal(await page.evaluate(() => window.__gs.state().lib.classes[0].units[0].name), 'Poems', 'Cancel changes nothing');
  await page.click('[data-uatlas]');
  await answerDlg(page, { typed: 'atlas.example.org/poems' });
  await page.waitForFunction(() => window.__gs.state().lib.classes[0].units[0].atlas === 'https://atlas.example.org/poems');
  assert.equal(native, 0);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Escape in a scan split asks first, because it would lose the sorting', async () => {
  const { page, close } = await openApp(browser);
  const clean = await pickFile(page, '#scanIn', await makePaper({ title: 'Everyone', pages: 3 }), 'Scan.pdf');
  await page.waitForSelector('#spPages');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#askDlg');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#askDlg'));
  assert.ok(await page.$eval('#dlg', e => !e.hidden), 'Keep sorting');
  await page.keyboard.press('Escape');
  await answerDlg(page);
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  assert.equal(await page.evaluate(() => window.__gs.sp()), null);
  clean();
  await close();
});

test('toasts are announced', async () => {
  const { page, close } = await openApp(browser);
  const t = await page.$eval('.toast', e => ({ live: e.getAttribute('aria-live'), role: e.getAttribute('role'), shown: getComputedStyle(e).display !== 'none' }));
  assert.equal(t.live, 'polite'); assert.equal(t.role, 'status');
  assert.ok(t.shown, 'on the page from the start, or screen readers can miss the first one');
  await close();
});

/* ---------------- the font ---------------- */
test('Inter is built in, and opening the app contacts nobody', async () => {
  const html = builtHtml();
  assert.ok(!html.includes('fonts.googleapis') && !html.includes('fonts.gstatic'));
  assert.ok(html.includes('SIL OPEN FONT LICENSE'), 'its license travels with it');
  const seen = [];
  const { page, close } = await openApp(browser, { beforeLoad: p => { p.on('request', r => seen.push(r.url().slice(0, 80))); } });
  await page.evaluate(() => document.fonts.ready);
  const f = await page.evaluate(async () => {
    await document.fonts.load('600 15px Inter', 'Ag');
    return { ok: document.fonts.check('600 15px Inter', 'Ag'), faces: [...document.fonts].filter(x => x.family.includes('Inter') && x.status === 'loaded').length, body: getComputedStyle(document.body).fontFamily };
  });
  assert.ok(f.ok && f.faces >= 1, 'it loads'); assert.match(f.body, /^"?Inter/);
  const away = seen.filter(u => !/^(http:\/\/(localhost|127\.0\.0\.1)|data:|blob:)/.test(u));
  assert.deepEqual(away, []);
  await close();
});

test('the built file stays a sensible size with the font in it', () => {
  const size = fs.statSync(path.join(ROOT, 'Grading Studio.html')).size;
  assert.ok(size < 5.2e6, 'it’s ' + (size / 1e6).toFixed(2) + ' MB');   // about 5.1 MB, with the Gradebook and the sidebar: the iPhone photo decoder (about 0.7 MB), the Inter font (about 0.2 MB) and the stickers (about 0.15 MB) are bundled so the one file works offline
});

test('the build only leaves out lines that really are comments', () => {   // a // line inside a multi-line string would be lost from the app
  const vm = require('vm');
  for (const f of fs.readdirSync(path.join(ROOT, 'src')).filter(f => f.endsWith('.js'))) {
    const lines = ('(function () {\n' + fs.readFileSync(path.join(ROOT, 'src', f), 'utf8') + '\n})').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!/^[ \t]*\/\//.test(line)) return;
      const broken = lines.slice(); broken[i] = '@@@ @@@';
      assert.throws(() => new vm.Script(broken.join('\n')), SyntaxError, f + ' line ' + i + ' looks like a comment but sits inside a string: ' + line);
    });
  }
});

/* ---------------- Home ---------------- */
test('Home puts today’s work first', async () => {
  const { page, close } = await openApp(browser);
  const order = () => page.evaluate(() => { const y = s => document.querySelector(s).getBoundingClientRect().top; return { kept: document.querySelector('#kept').checkVisibility() ? y('#kept') : null, drop: y('#drop'), classes: document.querySelector('#classes').checkVisibility() }; });
  assert.ok(await page.$eval('#pickDrive', e => e.hidden) && await page.$eval('.gAcct', e => e.hidden), 'no Google key built in, so no Google buttons');
  let o = await order();
  assert.equal(o.kept, null, 'nothing kept yet, so the download box comes first'); assert.equal(o.classes, false, 'classes are on their own pages now');
  await openZip(page, zip); await score(page, [3, 3, 3]); await settle(page);
  await page.click('#closeBtn');
  await page.waitForSelector('#kept [data-kopen]');
  o = await order();
  assert.ok(o.kept < o.drop && !o.classes, JSON.stringify(o));
  assert.equal(await page.$eval('#kept .krow [data-kopen]', e => e.textContent), 'Continue');
  // many downloads: the five newest, and the rest a click away
  await page.evaluate(() => { const k = window.__gs.kept(), m = [...k.values()][0]; for (let i = 0; i < 7; i++) k.set('x' + i, { ...m, id: 'x' + i, name: 'Old ' + i, t: 1000 + i }); window.__gs.renderKept(); });
  const shown = () => page.$$eval('#kept .krow', r => r.filter(e => e.checkVisibility()).length);
  assert.equal(await shown(), 5);
  await page.click('#keptAll');
  assert.equal(await shown(), 8);
  assert.equal(await page.$eval('#keptAll', e => e.textContent), 'Show only the newest');
  assert.deepEqual(page.errors, []);
  await close();
});

test('each class can keep its ManageBac link: set on the roster, opened from the class and its Grades list', async () => {
  const { page, close } = await openApp(browser);
  try {
    await page.click('#addClass'); await page.waitForSelector('#cMb');
    await page.type('#cName', 'MB-Class'); await page.type('#cNames', 'Aria Testwell');
    await page.type('#cMb', 'not a link'); await page.click('#dlgBox [data-ok]');
    assert.equal(await page.$eval('#dlg', d => d.hidden), false, 'a bad address keeps the dialog open');
    await page.$eval('#cMb', i => { i.value = ''; }); await page.type('#cMb', 'school.example.org/classes/123');
    await page.click('#dlgBox [data-ok]'); await page.waitForFunction(() => document.querySelector('#dlg').hidden);
    const c = await page.evaluate(() => window.__gs.state().lib.classes.find(c => c.name === 'MB-Class'));
    assert.equal(c.mb, 'https://school.example.org/classes/123');
    const a = await page.$eval('[data-cls="' + c.id + '"] .clshead a', a => [a.textContent, a.href, a.target]);
    assert.deepEqual(a, ['ManageBac ↗', 'https://school.example.org/classes/123', '_blank']);
    // clearing it takes the button away
    const ci = await page.evaluate(() => window.__gs.state().lib.classes.findIndex(c => c.name === 'MB-Class'));
    await page.click('[data-edit-class="' + ci + '"]'); await page.waitForSelector('#cMb');
    assert.equal(await page.$eval('#cMb', i => i.value), 'https://school.example.org/classes/123');
    await page.$eval('#cMb', i => { i.value = ''; }); await page.click('#dlgBox [data-ok]');
    await page.waitForFunction(() => document.querySelector('#dlg').hidden);
    assert.equal(await page.$('[data-cls="' + c.id + '"] .clshead a'), null);
    assert.equal(await page.evaluate(() => 'mb' in window.__gs.state().lib.classes.find(c => c.name === 'MB-Class')), false);
    // without opening the roster: + ManageBac link right on the class
    await page.click('[data-cls="' + c.id + '"] [data-mbset]');
    await answerDlg(page, { typed: 'https://school.example.org/classes/456' });
    await page.waitForSelector('[data-cls="' + c.id + '"] a.mb-go');
    assert.equal(await page.$eval('[data-cls="' + c.id + '"] a.mb-go', a => a.href), 'https://school.example.org/classes/456');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.mblinks')).mbclass), 'https://school.example.org/classes/456');   // the Planner finds it by name
    // the Grades list of an assignment in a class with a link
    await twoRosters(page);
    // while grading, the top bar offers it next to Atlas
    assert.match(await page.$eval('#topAtlas', e => e.textContent), /\+ ManageBac link/);
    assert.equal(await page.$eval('#topMb', e => e.textContent), '');
    await page.click('#moreBtn'); await page.click('#topAtlas [data-mbset]'); await answerDlg(page, { typed: 'school.example.org/classes/9a' });
    await page.waitForSelector('#topMb a.mb-go');   // then it sits in the top bar, beside the Grades list
    assert.equal(await page.$eval('#topMb a', a => a.href), 'https://school.example.org/classes/9a');
    await page.evaluate(() => window.__gs.state().lib.classes.find(c => c.name === '9EL-A').mb = 'https://school.example.org/classes/9');
    await page.click('#gradesBtn'); await page.waitForSelector('.gl');
    assert.equal(await page.$eval('#dlgBox .bf a', a => a.href), 'https://school.example.org/classes/9');
  } finally { await close(); }
});
