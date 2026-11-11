// A class page's tabs: Assignments, Gradebook, Students and Charts, and one student's own page. Each has an address, the charts are
// worked out from the gradebook's own numbers, and none of it stores anything. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, appReady, goTo, classPage, idbRead } = require('./helpers/app');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup', 'Esme Placeholder', 'Finn Example'];
const RUB = { mode: 'rubric', criteria: ['Ideas', 'Organization', 'Language'] };
const day = s => Date.parse(s + 'T12:00:00Z');
// One term. In date order: Reading check 1 (in-class, typed percents), Story map (formative, feedback for the first three),
// Narrative essay (summative, a rubric download), Vocabulary quiz (in-class, typed out of 20), Poetry analysis (summative, a rubric
// download) and Timed paragraph (in-class, typed percents, Dov missing). Esme's scores climb and Bram's fall.
function seed() {
  const item = (id, name, more) => ({ id, name, classId: 'c1', ...more });
  const typed = (max, vals) => ({ max, s: Object.fromEntries(NAMES.map((n, i) => [n, vals[i] === 'm' ? { v: null, st: 'missing' } : { v: vals[i] }])) });
  const rub = (t, rows) => ({ t: day(t), cls: 'c1', setup: RUB, s: Object.fromEntries(NAMES.map((n, i) => [n, { f: {}, h: {}, g: { rubric: rows[i], points: '', comment: '' } }])) });
  const lib = {
    classes: [{ id: 'c1', name: 'Grade 9 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [
      item('i1', 'Reading check 1', { type: 'ic', due: '2026-09-01', typed: typed(null, [90, 95, 70, 60, 40, 85]) }),
      item('i2', 'Story map', { type: 'fm', due: '2026-09-05', typed: { max: null, s: Object.fromEntries(NAMES.slice(0, 3).map(n => [n, { v: null, st: '', fb: true }])) } }),
      item('i3', 'Narrative essay', { type: 'sum', due: '2026-09-19', batchId: 'gs.b.n1' }),
      item('i4', 'Vocabulary quiz', { type: 'ic', due: '2026-09-30', typed: typed(20, [18, 15, 14, 12, 14, 17]) }),
      item('i5', 'Poetry analysis', { type: 'sum', due: '2026-10-20', batchId: 'gs.b.n2' }),
      item('i6', 'Timed paragraph', { type: 'ic', due: '2026-10-29', typed: typed(null, [92, 60, 72, 'm', 80, 88]) }),
    ] }] }, { id: 'c2', name: 'Grade 10 Literature', names: ['Nia Elsewhere'], units: [] }, { id: 'c3', name: 'Grade 11 Language', names: [], units: [] }],
    loose: { id: '', units: [] }, seed2627: true,
    book: { terms: [{ id: 't1', name: 'Term 1', start: '2026-08-10', end: '2027-07-31' }] },
  };
  const work = {
    'gs.b.n1': rub('2026-09-20', [[4, 4, 3], [4, 3, 3], [3, 3, 2], [2, 3, 2], [2, 2, 1], [4, 3, 3]]),
    'gs.b.n2': rub('2026-10-21', [[4, 3, 3], [3, 2, 2], [3, 2, 2], [3, 3, 2], [3, 3, 2], [4, 4, 3]]),
  };
  const ls = { 'gs.lib': JSON.stringify(lib) };
  for (const [k, v] of Object.entries(work)) ls[k] = JSON.stringify(v);
  const meta = Object.keys(work).map(id => [id, { id, name: 'A download', n: 6, t: work[id].t, asg: { 'gs.b.n1': 'i3', 'gs.b.n2': 'i5' }[id] }]);
  return { ls, idb: { 'grading-studio-keep': { version: 2, stores: { papers: [], work: [], edits: [], meta } } } };
}
const hash = page => page.evaluate(() => location.hash);
const until = (page, h) => page.waitForFunction(h => location.hash === h, {}, h);
const lib = page => page.evaluate(() => window.__gs.state().lib);
const tab = async (page, k, sel) => { await page.click('[data-ctab="' + k + '"]'); await page.waitForSelector(sel); };
const heatNames = page => page.$$eval('#bkHeat tbody tr:not(.chfoot) .chn', xs => xs.map(x => x.textContent));

test('each tab of a class has its own address, and Refresh, Back and Forward follow', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await classPage(page, 'c1');
  assert.deepEqual(await page.$$eval('.ctabs .ctab', xs => xs.map(x => x.textContent)), ['Assignments', 'Gradebook', 'Students', 'Attendance', 'Charts', 'Report comments']);
  assert.equal(await page.$eval('.ctab.on', a => a.textContent), 'Assignments');
  assert.ok(await page.$('.board .card'), 'the units and assignments are the first tab');
  await tab(page, 'gradebook', '#bkTab');
  assert.equal(await hash(page), '#/class/c1/gradebook');
  assert.equal(await page.$('.board'), null, 'one tab at a time');
  assert.equal(await page.$('#bkCls'), null, 'the class is the page’s, so there’s no class picker');
  assert.ok(await page.$eval('#dlg', d => d.hidden), 'on the page, not in a box');
  await tab(page, 'students', '#peopleTbl table');
  assert.equal(await hash(page), '#/class/c1/students');
  await tab(page, 'charts', '#bkHeat');
  assert.equal(await hash(page), '#/class/c1/charts');
  assert.equal(await page.$eval('.ctab.on', a => a.textContent), 'Charts');
  assert.equal(await page.$eval('#railClasses [data-railcls="c1"]', a => a.getAttribute('aria-current')), 'page', 'the class stays lit in the sidebar');
  assert.equal(await page.title(), 'Grade 9 English · Grading Studio');
  await page.goBack(); await until(page, '#/class/c1/students'); await page.waitForSelector('#peopleTbl table');
  await page.goBack(); await until(page, '#/class/c1/gradebook'); await page.waitForSelector('#bkTab');
  await page.goForward(); await page.goForward(); await until(page, '#/class/c1/charts'); await page.waitForSelector('#bkHeat');
  await page.reloadHere(); await appReady(page);
  await page.waitForSelector('#bkHeat');
  assert.equal(await hash(page), '#/class/c1/charts', 'a refresh comes back to the same tab');
  // a class with no roster has nothing to put in the other tabs
  await goTo(page, '#/class/c3');
  assert.equal(await page.$('.ctabs'), null);
  await goTo(page, '#/class/c3/gradebook');
  assert.equal(await page.$('#classPanel'), null); assert.ok(await page.$('.board'));
  // a class with a roster and nothing graded yet: every tab still opens, and says there's nothing to show
  await goTo(page, '#/class/c2/charts'); await page.waitForSelector('#bkTiles');
  assert.equal(await page.$('#bkHeat'), null);
  assert.match(await page.$eval('#bkMove', e => e.textContent), /four scored assignments/);
  await goTo(page, '#/class/c2/gradebook'); await page.waitForFunction(() => /Nothing graded for Grade 10 Literature/.test(document.querySelector('#bkBody').textContent));
  await goTo(page, '#/class/c2/students/1'); await page.waitForSelector('#bkStuTiles');
  assert.equal(await page.$eval('#bkStuName', e => e.textContent), 'Nia Elsewhere');
  // a place on the roster that isn't there shows the list
  await goTo(page, '#/class/c1/students/99');
  await page.waitForSelector('#peopleTbl table');
  assert.equal(await page.$('#bkStuName'), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the Students tab lists the roster with each grade, and a name opens that student’s page by place, never by name', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await goTo(page, '#/class/c1/gradebook'); await page.waitForSelector('#bkTab');
  const term = await page.$$eval('#bkTab tbody tr:not(.bkfoot)', rs => rs.map(r => r.lastElementChild.textContent.trim()));
  await tab(page, 'students', '#peopleTbl table');
  await page.waitForFunction(() => /%/.test(document.querySelector('#peopleTbl td[data-pg]').textContent));
  assert.deepEqual(await page.$$eval('#peopleTbl td[data-pg]', xs => xs.map(x => x.textContent)), term, 'the same term grades as the gradebook');
  assert.equal(await page.$eval('#peopleGh', e => e.textContent), 'Term 1');
  // typing an ID saves it, and Tab goes on to the next box
  await page.click('#peopleTbl input[data-pp="id"][data-pi="0"]');
  await page.keyboard.type('20477'); await page.keyboard.press('Tab');
  assert.deepEqual(await page.evaluate(() => { const a = document.activeElement; return [a.dataset.pp, a.dataset.pi]; }), ['email', '0']);
  assert.deepEqual((await lib(page)).classes[0].info['Aria Testwell'], { id: '20477' });
  assert.equal(await page.$eval('#peopleSum', e => e.textContent), '6 students · 1 with an ID');
  // the ⓘ still opens their details
  await page.click('#peopleTbl tr:nth-child(2) .whob');
  await page.waitForSelector('#pcard');
  assert.equal(await page.$eval('#pcard h2', e => e.textContent), 'Bram Sample');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#pcard'));
  // a name goes to that student's own page
  const len = await page.evaluate(() => history.length);
  await page.click('#peopleTbl tr:nth-child(2) td.nm a');
  await page.waitForSelector('#bkStuName');
  assert.equal(await hash(page), '#/class/c1/students/2');
  assert.equal(await page.$eval('#bkStuName', e => e.textContent), 'Bram Sample');
  assert.equal(await page.title(), 'Grade 9 English · Grading Studio', 'no student’s name in the tab’s title');
  assert.equal(await page.$eval('.ctab.on', a => a.textContent), 'Students');
  assert.equal(await page.$$eval('#bkStrip .chsi', xs => xs.length), 6, 'every assignment of the term, in date order');
  assert.deepEqual(await page.$$eval('#bkStrip .chsi b', xs => xs.map(x => x.textContent)), ['Reading check 1', 'Story map', 'Narrative essay', 'Vocabulary quiz', 'Poetry analysis', 'Timed paragraph']);
  assert.equal(await page.$eval('#bkStrip .chsi:nth-child(2) .chc', e => e.textContent), '✓ Feedback given');
  assert.equal(await page.$eval('#bkStrip .chsi:nth-child(4) .chc', e => e.textContent), '75%');
  assert.equal(await page.$$eval('#bkStuLine .bkdot', xs => xs.length), 5);
  // Bram's rubric rows across the two summatives: Ideas (4 + 3) / 2, Organization (3 + 2) / 2, Language (3 + 2) / 2; the class's are 3.3, 2.9 and 2.3
  assert.deepEqual(await page.$$eval('#bkStuRows .chrow', xs => xs.map(x => x.querySelector('span').textContent + ' ' + x.querySelector('b').textContent + ' ' + x.querySelector('small').textContent)), ['Ideas 3.5 class 3.3', 'Organization 2.5 class 2.9', 'Language 2.5 class 2.3']);
  // the arrow keys go from one student to the next, in place of this address, so Back returns to the list
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('#bkStuName').textContent === 'Cleo Fixture');
  assert.equal(await hash(page), '#/class/c1/students/3');
  await page.click('[data-bkstu="1"]');
  await page.waitForFunction(() => document.querySelector('#bkStuName').textContent === 'Dov Madeup');
  assert.equal(await page.$eval('#bkStuLine .chmiss', e => e.dataset.tl), 'Timed paragraph', 'a missing assignment is marked on the line');
  assert.equal(await page.evaluate(() => history.length), len + 1);
  for (const n of NAMES) assert.ok(!decodeURIComponent(await hash(page)).includes(n.split(' ')[0]), 'no name in the address');
  await page.goBack(); await until(page, '#/class/c1/students'); await page.waitForSelector('#peopleTbl table');
  await page.goForward(); await page.waitForSelector('#bkStuName');
  await page.click('#bkBackStu'); await page.waitForSelector('#peopleTbl table');
  assert.equal(await hash(page), '#/class/c1/students');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the Charts tab draws every chart from the gradebook’s own numbers', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await goTo(page, '#/class/c1/gradebook'); await page.waitForSelector('#bkTab');
  const term = await page.$$eval('#bkTab tbody tr:not(.bkfoot)', rs => rs.map(r => [r.firstElementChild.textContent.trim(), r.lastElementChild.textContent.trim()]));
  await tab(page, 'charts', '#bkHeat');
  // every student, every assignment: highest grade first, each grade the gradebook's
  const rows = await page.$$eval('#bkHeat tbody tr:not(.chfoot)', rs => rs.map(r => [r.querySelector('.chn').textContent, r.querySelector('.chg').textContent]));
  assert.deepEqual([...rows].sort((a, b) => a[0].localeCompare(b[0])), [...term].sort((a, b) => a[0].localeCompare(b[0])));
  assert.deepEqual(rows.map(r => parseFloat(r[1])), rows.map(r => parseFloat(r[1])).sort((a, b) => b - a), 'sorted by grade to begin with');
  assert.deepEqual(await page.$$eval('#bkHeat thead .chh span', xs => xs.map(x => x.textContent)), ['Reading check 1', 'Story map', 'Narrative essay', 'Vocabulary quiz', 'Poetry analysis', 'Timed paragraph']);
  await page.click('#bkHeat [data-chsort="name"]');
  assert.deepEqual(await heatNames(page), NAMES, 'by Student: the roster’s own order');
  const cells = await page.$$eval('#bkHeat tbody tr:not(.chfoot)', rs => rs.map(r => [...r.querySelectorAll('td .chc')].map(c => c.textContent + ':' + c.className.replace('chc ', ''))));
  assert.deepEqual(cells[0].filter((_, i) => [0, 1, 3, 5].includes(i)), ['90:b5', '✓:fm', '90:b5', '92:b5'], 'Aria: typed scores in their ranges, a tick for formative feedback');
  assert.deepEqual([cells[3][1], cells[3][5]], [':fm', 'M:miss'], 'Dov: no feedback yet, and a missing paper');
  assert.equal(cells[4][0], '40:b1');
  await page.click('#bkHeat [data-chsort="i1"]');
  assert.deepEqual(await heatNames(page), ['Bram Sample', 'Aria Testwell', 'Finn Example', 'Cleo Fixture', 'Dov Madeup', 'Esme Placeholder'], 'by an assignment: its highest score first');
  await page.click('#bkHeat [data-chsort="i1"]');
  assert.equal((await heatNames(page))[0], 'Esme Placeholder', 'and again for lowest first');
  assert.equal(await page.$eval('#bkHeat .chfoot td', e => e.textContent), '73%', 'Reading check 1: (90 + 95 + 70 + 60 + 40 + 85) / 6');
  // a name in it goes to that student's page
  assert.equal(await page.$eval('#bkHeat tbody tr .chn a', a => a.getAttribute('href')), '#/class/c1/students/5');
  // who is moving: Esme's last three against her earlier ones is the biggest rise, Bram's the biggest drop
  const mv = await page.$$eval('#bkMove .chmv', xs => xs.map(x => [x.dataset.tl, x.classList.contains('up') ? 'up' : 'down']));
  assert.deepEqual(mv[0], ['Esme Placeholder', 'up']); assert.deepEqual(mv[mv.length - 1], ['Bram Sample', 'down']);
  // where the class stands: every counted score is in one range's block
  const seg = await page.$$eval('#bkStacks .chseg', xs => xs.map(x => parseInt(x.dataset.tv, 10)));
  assert.equal(seg.reduce((a, b) => a + b, 0), 6 * 5 - 1, 'five scored assignments for six students, less one missing paper');
  // rubric rows: the same three rows across both summatives, Language the lowest
  assert.deepEqual(await page.$$eval('#bkRows text.tlb', xs => xs.map(x => x.textContent).filter(t => /\d$/.test(t)).sort()), ['Ideas 3.3', 'Language 2.3', 'Organization 2.8']);
  assert.equal(await page.$eval('#bkRows text.tlb.me', e => e.textContent), 'Language 2.3');
  assert.equal(await page.$$eval('#bkRows .chrd', xs => xs.length), 6);
  assert.equal(await page.$$eval('#bkScatter .chpt', xs => xs.length), 6, 'one dot per student with both kinds of score');
  // the charts that were already there
  for (const id of ['bkTiles', 'bkBands', 'bkTrend', 'bkSpread', 'bkCmp']) assert.ok(await page.$('#' + id), id);
  assert.match(await page.$eval('#bkTiles', t => t.textContent), /Missing work1across 1 student/);
  // pointing at a mark says what it is
  await page.$eval('#bkStacks', e => e.scrollIntoView({ block: 'center' }));
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));   // scrolling puts a tip away, so it's over before the pointer arrives
  await page.hover('#bkStacks .chseg');
  await page.waitForFunction(() => { const t = document.querySelector('#ovTip'); return t && !t.hidden && t.checkVisibility(); });
  assert.match(await page.$eval('#ovTip', t => t.textContent), /student.*Reading check 1/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the gradebook on the page keeps its tools, and picks up a change made on the Assignments tab', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  await goTo(page, '#/class/c1/gradebook'); await page.waitForSelector('#bkTab');
  // a column's menu opens on the page, under its heading
  await page.click('[data-bkcol="i4"]');
  await page.waitForSelector('#vClass > #bkPop');
  const at = await page.evaluate(() => { const p = document.querySelector('#bkPop').getBoundingClientRect(), b = document.querySelector('[data-bkcol="i4"]').getBoundingClientRect(); return { below: p.top >= b.bottom - 1 && p.top - b.bottom < 20, inside: p.left >= 0 && p.right <= innerWidth }; });
  assert.deepEqual(at, { below: true, inside: true });
  await page.click('[data-bksettype="fm"]'); await page.click('[data-bkpopclose]');
  await page.waitForFunction(() => !document.querySelector('#bkPop'));
  assert.equal((await lib(page)).classes[0].units[0].items[3].type, 'fm');
  // a typed-in score changes in the table
  const cell = '[data-bked="i1"][data-bkn="Bram Sample"]';
  await page.click(cell); await page.waitForSelector(cell + ' input');
  await page.$eval(cell + ' input', i => { i.value = ''; }); await page.type(cell + ' input', '85'); await page.keyboard.press('Enter');
  await page.waitForFunction(c => /85%/.test(document.querySelector(c).textContent), {}, cell);
  assert.equal((await lib(page)).classes[0].units[0].items[0].typed.s['Bram Sample'].v, 85);
  // an assignment renamed on the Assignments tab has its new name in the gradebook
  await tab(page, '', '[data-edit-asg="i1"]');
  await page.$eval('[data-edit-asg="i1"]', b => b.click());   // the cards are drawn again as the tab settles, so a pointer click can find the button gone
  await page.waitForSelector('#aName');
  await page.$eval('#aName', e => { e.value = 'Reading quiz A'; });
  await page.click('#dlgBox [data-ok]');
  await page.waitForFunction(() => /Reading quiz A/.test(document.querySelector('[data-card="i1"]').textContent));
  await tab(page, 'gradebook', '#bkTab');
  await page.waitForFunction(() => /Reading quiz A/.test(document.querySelector('#bkTab thead').textContent));
  assert.match(await page.$eval(cell, c => c.textContent), /85%/);
  // another tab renames an assignment: the table here is drawn again from the new copy, and a score typed after that keeps both changes
  // (the other tab is a frame at the same address: it saves, and this page hears of it as it would from a tab)
  await page.evaluate(() => new Promise(done => {
    const f = document.createElement('iframe'); f.src = location.pathname.replace(/[^/]*$/, '') + 'blank'; f.hidden = true;
    f.onload = () => { const s = f.contentWindow.localStorage, l = JSON.parse(s.getItem('gs.lib')); l.classes[0].units[0].items[5].name = 'Timed paragraph B'; s.setItem('gs.lib', JSON.stringify(l)); done(); };
    document.body.appendChild(f);
  }));
  await page.waitForFunction(() => { const h = document.querySelector('#bkTab thead'); return !!h && /Timed paragraph B/.test(h.textContent); });
  await page.$eval('iframe', f => f.remove());
  const c2 = '[data-bked="i6"][data-bkn="Aria Testwell"]';
  await page.click(c2); await page.waitForSelector(c2 + ' input');
  await page.$eval(c2 + ' input', i => { i.value = ''; }); await page.type(c2 + ' input', '95'); await page.keyboard.press('Enter');
  await page.waitForFunction(c => /95%/.test(document.querySelector(c).textContent), {}, c2);
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('gs.lib'))).classes[0].units[0].items[5];
  assert.equal(saved.name, 'Timed paragraph B'); assert.equal(saved.typed.s['Aria Testwell'].v, 95);
  // Find anything reaches a class's tabs
  await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
  await page.waitForSelector('#findIn'); await page.keyboard.type('english charts');
  await page.waitForFunction(() => { const r = document.querySelector('#findList .frow.on b'); return r && r.textContent === 'Grade 9 English charts'; });
  await page.keyboard.press('Enter');
  await until(page, '#/class/c1/charts'); await page.waitForSelector('#bkHeat');
  assert.deepEqual(page.errors, []);
  await close();
});

test('going around a class’s tabs changes nothing that’s saved', async () => {
  const { page, close } = await openApp(browser, { seed: seed() });
  const snap = async () => ({
    ls: await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('gs.')).sort().map(k => [k, localStorage.getItem(k)]))),
    work: await idbRead(page, 'grading-studio-keep', 'work'), papers: await idbRead(page, 'grading-studio-keep', 'papers'), meta: await idbRead(page, 'grading-studio-keep', 'meta'),
  });
  await classPage(page, 'c1');
  const a = await snap();
  await tab(page, 'gradebook', '#bkTab');
  await page.click('[data-bkshow="pts"]'); await page.click('[data-bkterm="*"]'); await page.click('[data-bkterm="t1"]');
  await tab(page, 'charts', '#bkHeat');
  await page.click('#bkHeat [data-chsort="i3"]'); await page.click('#bkHeat [data-chsort="grade"]');
  await tab(page, 'students', '#peopleTbl table');
  await page.click('#peopleTbl td.nm a'); await page.waitForSelector('#bkStuName');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await page.goBack(); await page.waitForSelector('#peopleTbl table');
  await tab(page, '', '.board');
  await page.reloadHere(); await appReady(page); await page.waitForSelector('.board');
  assert.deepEqual(await snap(), a);
  assert.equal(await page.evaluate(() => sessionStorage.length), 0, 'and nothing is left in the tab’s own storage');
  assert.deepEqual(page.errors, []);
  await close();
});
