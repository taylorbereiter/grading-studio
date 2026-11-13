// The to-do list: a page of the teacher's own to-dos beside what the app noticed from their work, a short card on Today, and a
// count in the sidebar. It is saved in lib.todo with the grading work. Every student, class and to-do here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { launch } = require('./helpers/chrome');
const { builtHtml, openApp, goTo } = require('./helpers/app');
const { gradingSeed } = require('./helpers/steady');
const settle = () => new Promise(r => setTimeout(r, 500));

let browser;
before(async () => { builtHtml(); browser = await launch(); });
after(async () => { await browser.close(); });

const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const day = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return iso(d); };
// The made-up class from the gradebook tests. Dov owes the Timed paragraph and nobody has reminded him.
function seed(todo) {
  const s = gradingSeed(), lib = JSON.parse(s.ls['gs.lib']);
  if (todo) lib.todo = todo;
  s.ls['gs.lib'] = JSON.stringify(lib); s.ls['gsc.folderLater'] = String(Date.now());
  return s;
}
const item = (id, x, more) => ({ id, x, d: '', c: '', who: '', a: '', rep: '', note: '', done: 0, made: 1, t: 1, ...more });
const open = async (todo, hash) => { const r = await openApp(browser, { seed: seed(todo) }); if (hash !== null) await goTo(r.page, hash || '#/todo'); return r; };
const saved = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().lib.todo || null)));
const add = async (page, words, sel = '#tdIn') => { await page.type(sel, words); await page.keyboard.press('Enter'); };
const rows = (page, root = '#tdList') => page.$$eval(root + ' .tdrow', r => r.map(x => [x.querySelector('.tdx').textContent, x.querySelector('.tddue').textContent]));
const groups = page => page.$$eval('#tdList .tdgrp', g => g.map(x => x.textContent.replace(/\s+/g, ' ').trim()));

test('what is typed is read for a day, a class and a student, and only where that is what the words mean', async () => {
  const { page, close } = await open();
  // 2026-11-11 is a Wednesday
  const read = t => page.evaluate(t => { const r = window.__gs.todoRead(t, '2026-11-11'); return [r.x, r.d, r.rep, r.c, r.who]; }, t);
  assert.deepEqual(await read('Print handouts tomorrow'), ['Print handouts', '2026-11-12', '', '', '']);
  assert.deepEqual(await read('Email the office by friday'), ['Email the office', '2026-11-13', '', '', '']);
  assert.deepEqual(await read('Order the novels, wed.'), ['Order the novels', '2026-11-11', '', '', ''], 'the weekday it is now means today');
  assert.deepEqual(await read('Order the novels next wednesday'), ['Order the novels', '2026-11-18', '', '', '']);
  assert.deepEqual(await read('Plan the trip next week'), ['Plan the trip', '2026-11-16', '', '', ''], 'next week is its Monday');
  assert.deepEqual(await read('Reports due Nov 20'), ['Reports', '2026-11-20', '', '', '']);
  assert.deepEqual(await read('Book the hall 3 feb'), ['Book the hall', '2027-02-03', '', '', ''], 'a date well behind us is next year’s');
  assert.deepEqual(await read('today: call the office'), ['call the office', '2026-11-11', '', '', '']);
  assert.deepEqual(await read('Book the library for Friday'), ['Book the library for Friday', '', '', '', ''], '“for Friday” is what, not when');
  assert.deepEqual(await read('Tidy up after Monday'), ['Tidy up after Monday', '', '', '', '']);
  assert.deepEqual(await read('Submit attendance every friday'), ['Submit attendance', '2026-11-13', 'week', '', '']);
  assert.deepEqual(await read('friday'), ['friday', '', '', '', ''], 'a day alone is not a to-do with nothing to do');
  assert.deepEqual(await read('Letter for aria testwell'), ['Letter for aria testwell', '', '', 'c1', 'Aria Testwell']);
  assert.deepEqual(await read('Call Bram’s parents friday'), ['Call Bram’s parents', '2026-11-13', '', 'c1', 'Bram Sample'], 'a first name only one student has');
  assert.deepEqual(await read('Bram needs a new book'), ['Bram needs a new book', '', '', '', ''], 'not as the first word');
  assert.deepEqual(await read('Quiz for grade 10 literature'), ['Quiz for grade 10 literature', '', '', 'c2', '']);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the To do page: a link in the sidebar, adding by typing, what was understood, and the list by day', async () => {
  const { page, close } = await open(null, null);
  assert.equal(await page.$eval('#rail [data-nav="todo"] .rname', e => e.textContent), 'To do');
  await settle();
  const was = await page.evaluate(() => localStorage.getItem('gs.lib'));
  await page.click('#rail [data-nav="todo"]');
  await page.waitForFunction(() => location.hash === '#/todo' && !document.querySelector('#vTodo').hidden);
  assert.equal(await page.title(), 'To do · Grading Studio');
  assert.equal(await page.$eval('#rail [data-nav="todo"]', a => a.getAttribute('aria-current')), 'page');
  await settle();
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.lib')), was, 'looking stores nothing');

  await page.type('#tdIn', 'Call Bram’s parents about the essay tomorrow');
  await page.waitForSelector('#tdUnd [data-tddrop="who"]');
  assert.deepEqual(await page.$$eval('#tdUnd [data-tddrop]', b => b.map(x => x.dataset.tddrop + ':' + x.textContent)), ['d:' + await page.evaluate(d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), day(1)), 'c:Grade 9 English', 'who:Bram Sample']);
  await page.click('#tdUnd [data-tddrop="who"]');
  assert.deepEqual(await page.$$eval('#tdUnd [data-tddrop]', b => b.map(x => x.dataset.tddrop)), ['d', 'c'], 'a click takes one off');
  await page.keyboard.press('Enter');
  assert.equal(await page.$eval('#tdIn', i => i.value), '');
  assert.ok(await page.$eval('#tdUnd', e => e.hidden));
  await add(page, 'Hand in field trip forms today');
  await add(page, 'Order class set of the next novel');
  await add(page, 'Recommendation letter for Aria Testwell ' + new Date(day(30) + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' }));
  const t = await saved(page);
  assert.deepEqual(t.items.map(i => [i.x, i.d, i.c, i.who]), [['Call Bram’s parents about the essay', day(1), 'c1', ''], ['Hand in field trip forms', day(0), '', ''], ['Order class set of the next novel', '', '', ''], ['Recommendation letter for Aria Testwell', day(30), 'c1', 'Aria Testwell']]);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')).todo.items.length), 4, 'saved with the classes');
  await page.waitForFunction(() => /Remind 1 student/.test(document.querySelector('#tdList').textContent));
  assert.deepEqual(await groups(page), ['Today 2', 'Next 7 days 1', 'Later 2']);
  assert.deepEqual(await rows(page), [['Hand in field trip forms', 'Today'], ['Remind 1 student about missing work', 'Today'], ['Call Bram’s parents about the essay', 'Tomorrow'], ['Recommendation letter for Aria Testwell', await page.evaluate(d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), day(30))], ['Order class set of the next novel', '']]);
  assert.equal(await page.$eval('#tdSay', e => e.textContent), 'Two for today.');
  assert.equal(await page.$eval('#railTodo', e => e.textContent), '2', 'the sidebar counts what is overdue or for today');

  // the views
  await page.click('[data-tdf="mine"]');
  assert.ok(!(await rows(page)).some(r => /Remind/.test(r[0])));
  await page.click('[data-tdf="c1"]');
  assert.deepEqual((await rows(page)).map(r => r[0]), ['Remind 1 student about missing work', 'Call Bram’s parents about the essay', 'Recommendation letter for Aria Testwell']);
  await page.click('[data-tdf="all"]');
  assert.deepEqual(page.errors, []);
  await close();
});

test('ticking one off, taking the tick back, a repeat that moves on, and Delete with Undo', async () => {
  const todo = { items: [item('a', 'Email the counselor', { d: day(-2) }), item('b', 'Submit attendance', { d: day(0), rep: 'week' }), item('c', 'Old news', { d: day(-9), done: Date.now() - 3 * 864e5 })] };
  const { page, close } = await open(todo);
  await page.waitForSelector('#tdList [data-td="auto:miss:c1"]');
  assert.deepEqual(await groups(page), ['Overdue 1', 'Today 2']);
  assert.ok(await page.$eval('#tdList [data-td="a"] .tddue', e => e.classList.contains('late')), 'overdue is said in amber, never red');
  assert.equal(await page.$eval('#tdSay', e => e.textContent), 'One overdue, two for today.');
  await page.click('#tdList [data-td="a"] .tdck');
  await page.waitForSelector('#tdList [data-td="a"].done');
  assert.deepEqual(await groups(page), ['Today 2'], 'done today, it stays in Today, struck through, below what is left');
  assert.deepEqual((await rows(page))[2], ['Email the counselor', 'Done']);
  assert.ok((await saved(page)).items[0].done > 0);
  await page.click('#tdList [data-td="a"] .tdck');
  await page.waitForSelector('#tdList [data-td="a"]:not(.done)');
  assert.equal((await saved(page)).items[0].done, 0);

  // a repeating one moves to its next day and leaves a finished copy for today
  await page.click('#tdList [data-td="b"] .tdck');
  await page.waitForFunction(() => document.querySelectorAll('#tdList .tdrow.done').length === 1);
  const t = await saved(page), b = t.items.find(i => i.id === 'b'), copy = t.items.find(i => i.x === 'Submit attendance' && i.id !== 'b');
  assert.deepEqual([b.d, b.done, b.rep], [day(7), 0, 'week']);
  assert.ok(copy.done > 0 && copy.rep === '' && copy.d === day(0));

  // done earlier in the week is out of the way until asked for
  assert.equal(await page.$eval('#tdDoneBtn', e => e.textContent), 'Show done in the last 7 days · 1');
  await page.click('#tdDoneBtn');
  assert.deepEqual((await groups(page)).pop(), 'Done in the last 7 days 1');
  assert.deepEqual((await rows(page)).pop(), ['Old news', 'Done']);

  await page.click('#tdList [data-td="a"] .tdmain');
  await page.waitForSelector('#tdSide [data-tddel]');
  await page.click('#tdSide [data-tddel]');
  await page.waitForFunction(() => !document.querySelector('#tdList [data-td="a"]'));
  assert.deepEqual((await saved(page)).items.find(i => i.id === 'a').gone, 1, 'a deleted line is remembered as deleted');
  await page.click('.toast button, #toast button');
  await page.waitForSelector('#tdList [data-td="a"]');
  assert.equal((await saved(page)).items.find(i => i.id === 'a').x, 'Email the counselor');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a line opens beside the list: its day, class, what it goes with, repeat and note', async () => {
  const { page, close } = await open({ items: [item('a', 'Print handouts', { d: day(0) })] });
  await page.click('#tdList [data-td="a"] .tdmain');
  await page.waitForSelector('#tdSide #tdX');
  assert.ok(await page.$eval('#tdList [data-td="a"]', e => e.classList.contains('sel')));
  const it = async () => (await saved(page)).items[0];
  await page.click('#tdSide .tdv [data-tdwhen="tomorrow"]');
  await page.waitForFunction(() => document.querySelector('#tdSide .tdv [data-tdwhen="tomorrow"]').classList.contains('on'));
  assert.equal((await it()).d, day(1));
  await page.$eval('#tdDate', (e, d) => { e.value = d; e.dispatchEvent(new Event('change', { bubbles: true })); }, day(3));
  assert.equal((await it()).d, day(3));
  assert.equal(await page.$('#tdWith'), null, 'nothing to go with until it has a class');
  await page.select('#tdCls', 'c1');
  await page.waitForSelector('#tdWith');
  assert.equal((await it()).c, 'c1');
  await page.select('#tdWith', 's:1');
  assert.equal((await it()).who, 'Bram Sample');
  assert.equal(await page.$eval('#tdSide .tdv a.link', a => a.getAttribute('href')), '#/class/c1/students/2', 'by place on the roster, never by name');
  await page.select('#tdWith', 'a:i3');
  assert.deepEqual([(await it()).who, (await it()).a], ['', 'i3']);
  assert.match(await page.$eval('#tdList [data-td="a"] .tdm', e => e.textContent), /Grade 9 English.*Narrative essay/);
  await page.click('#tdSide [data-tdrep="day"]');
  assert.equal((await it()).rep, 'day');
  await page.$eval('#tdNote', e => { e.value = 'Double sided'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.equal((await it()).note, 'Double sided');
  await page.$eval('#tdX', e => { e.value = 'Print the sonnet handouts'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.equal((await it()).x, 'Print the sonnet handouts');
  await page.click('#tdSide .tdv [data-tdwhen="none"]');
  assert.deepEqual([(await it()).d, (await it()).rep], ['', ''], 'no day, so nothing to repeat on');
  await page.click('#tdSide [data-tdclose]');
  await page.waitForSelector('#tdSide .tdkinds');
  assert.deepEqual(page.errors, []);
  await close();
});

test('what the app adds comes from saved work, is never stored, can be hidden or moved, and each kind switches off', async () => {
  const { page, close } = await open();
  await page.waitForSelector('#tdList [data-td="auto:miss:c1"]');
  assert.deepEqual(await page.$$eval('#tdSide .tdsw', b => b.map(x => x.textContent + ':' + x.getAttribute('aria-checked'))), ['Papers to mark:true', 'Papers to hand back:true', 'Lessons not planned yet:true', 'Missing work to chase:true']);
  assert.match(await page.$eval('#tdList [data-td="auto:miss:c1"]', e => e.textContent.replace(/\s+/g, ' ')), /Remind 1 student about missing work\s*From your work\s*Grade 9 English\s*See who\s*Today/);
  assert.equal(await page.$eval('#tdList [data-td="auto:miss:c1"] a.btn', a => a.getAttribute('href')), '#/class/c1/missing');
  assert.equal(await saved(page), null, 'nothing is stored for a line the app worked out');
  // moved to tomorrow
  await page.click('#tdList [data-td="auto:miss:c1"] .tdmain');
  await page.waitForSelector('#tdSide [data-tdhide]');
  await page.click('#tdSide .tdv [data-tdwhen="tomorrow"]');
  await page.waitForFunction(() => document.querySelector('#tdList [data-td="auto:miss:c1"] .tddue').textContent === 'Tomorrow');
  assert.equal((await saved(page)).auto['miss:c1'].d, day(1));
  assert.equal(await page.$eval('#railTodo', e => e.textContent), '');
  // hidden, and back with Undo
  await page.click('#tdList [data-td="auto:miss:c1"] .tdck');
  await page.waitForFunction(() => !document.querySelector('#tdList [data-td="auto:miss:c1"]'));
  await page.click('.toast button, #toast button');
  await page.waitForSelector('#tdList [data-td="auto:miss:c1"]');
  // the kind switched off
  await page.click('#tdList [data-td="auto:miss:c1"] .tdmain'); await page.click('#tdSide [data-tdclose]');
  await page.click('[data-tdkind="miss"]');
  await page.waitForFunction(() => !document.querySelector('#tdList [data-td="auto:miss:c1"]'));
  assert.deepEqual((await saved(page)).off, { miss: 1 });
  assert.equal(await page.$eval('[data-tdkind="miss"]', b => b.getAttribute('aria-checked')), 'false');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a class on the timetable with nothing planned is a line, with a button to the Planner', async () => {
  const { page, close } = await open(null, null);
  // the Planner's own database, with one class that meets late every day
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onupgradeneeded = () => { r.result.createObjectStore('lessons', { keyPath: 'id' }); r.result.createObjectStore('kv'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put({ classes: [{ id: 'A1', name: 'grade-9 english', color: '#0E7C86', meets: [0, 1, 2, 3, 4, 5, 6].map(dow => ({ dow, start: '23:58', end: '23:59' })) }], daysOff: [] }, 'setup'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  });
  await page.reload();
  await page.waitForSelector('#today .trow');
  await goTo(page, '#/todo');
  await page.waitForSelector('#tdList [data-td^="auto:plan:A1:"]');
  const plan = await page.$$eval('#tdList [data-td^="auto:plan:"]', r => r.map(x => [x.querySelector('.tdx').textContent, x.querySelector('.tddue').textContent, x.querySelector('a.btn').textContent, x.querySelector('a.btn').getAttribute('href')]));
  assert.equal(plan.length, 4, 'today and the next three days');
  assert.deepEqual(plan[0], ['Plan today’s grade-9 english lesson', 'Today', 'Plan it', 'planner.html#week']);
  assert.deepEqual(plan[1].slice(0, 2), ['Plan tomorrow’s grade-9 english lesson', 'Tomorrow']);
  // the line is under its grading class of the same name, whatever the spaces and capitals
  await page.click('[data-tdf="c1"]');
  assert.equal((await page.$$('#tdList [data-td^="auto:plan:"]')).length, 4);
  // a to-do for that class shows on its row on Today
  await page.click('[data-tdf="all"]');
  await add(page, 'Print handouts for Grade 9 English today');
  await goTo(page, '#/');
  await page.waitForSelector('#today .trow .tdpre');
  assert.equal(await page.$eval('#today .trow .tdpre', e => e.textContent), '1 to do');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Today has a short card: your own lines that are overdue or for today, and a box that adds one for today', async () => {
  const todo = { items: [item('a', 'Email the counselor', { d: day(-2) }), item('b', 'Write the quiz', { d: day(2) }), item('c', 'Order the novels')] };
  const { page, close } = await open(todo, null);
  await page.waitForSelector('#todoCard .tdrow');
  assert.ok(!(await page.$eval('#hside', e => e.hidden)));
  assert.deepEqual(await rows(page, '#tdCardList'), [['Email the counselor', await page.evaluate(d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' }), day(-2))]]);
  assert.equal(await page.$eval('#todoCard .tdfoot', e => e.textContent), '2 more on your listSee everything');
  assert.equal(await page.$('#todoCard .tdrow.auto'), null, 'marking and handing back have their own sections here');
  await add(page, 'Hand in the forms', '#tdCardIn');
  await page.waitForFunction(() => document.querySelectorAll('#todoCard .tdrow').length === 2);
  assert.deepEqual((await saved(page)).items.pop().d, day(0), 'typed on Today, it is for today');
  await add(page, 'Book the hall tomorrow', '#tdCardIn');
  assert.equal(await page.$eval('#todoCard .tdfoot', e => e.textContent), '3 more on your listSee everything');
  await page.click('#todoCard [data-td="a"] .tdck');
  await page.waitForSelector('#todoCard [data-td="a"].done');
  assert.deepEqual((await rows(page, '#tdCardList')).map(r => r[1]), ['Today', 'Done'], 'what is done today stays, struck through, below what is left');
  // a line opens in To do
  await page.click('#todoCard .tdrow:not(.done) .tdmain');
  await page.waitForFunction(() => location.hash === '#/todo' && !!document.querySelector('#tdSide #tdX'));
  assert.equal(await page.$eval('#tdX', e => e.value), 'Hand in the forms');
  assert.deepEqual(page.errors, []);
  await close();
});

test('N starts a to-do from anywhere outside a paper, Find anything reaches the list, and Help explains it', async () => {
  const { page, close } = await open(null, '#/class/c1');
  await page.keyboard.press('n');
  await page.waitForFunction(() => location.hash === '#/todo' && document.activeElement && document.activeElement.id === 'tdIn');
  await page.keyboard.type('nothing new'); await page.keyboard.press('Enter');
  assert.equal((await saved(page)).items[0].x, 'nothing new', 'an n typed in the box is a letter');
  const find = await page.evaluate(() => window.__gs.findRows().filter(r => /to[- ]?do/i.test(r.label)).map(r => r.group + ': ' + r.label));
  assert.deepEqual(find, ['Go to: To do', 'Go to: To do, by week', 'Do: Add a to-do', 'Help: How does the to-do list work?', 'Help: Can I see my to-dos by week?']);
  await goTo(page, '#/help/todo');
  await page.waitForSelector('#hlp-todo.on');
  assert.equal(await page.$eval('#hlp-todo .hlpgo a', a => a.getAttribute('href')), '#/todo');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the week: each line on its day under the class that meets, what is late under today, adding in a day, and dragging to another', async () => {
  const todo = { items: [item('a', 'Email the office', { d: day(-1) }), item('b', 'Print handouts', { d: day(0), c: 'c1' }), item('c', 'Order the novels'), item('d', 'Reports', { d: day(21) }), item('e', 'Water the plants', { d: day(0), done: Date.now() })], off: { mark: 1, back: 1, miss: 1 }, offT: 1, auto: {} };
  const { page, close } = await open(todo, null);
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onupgradeneeded = () => { r.result.createObjectStore('lessons', { keyPath: 'id' }); r.result.createObjectStore('kv'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put({ classes: [{ id: 'A1', name: 'grade-9 english', color: '#0E7C86', meets: [0, 1, 2, 3, 4, 5, 6].map(dow => ({ dow, start: '23:58', end: '23:59' })) }], daysOff: [] }, 'setup'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  });
  await page.reload();
  await page.waitForSelector('#today .trow');
  await goTo(page, '#/todo');
  await page.click('#tdView [data-tdview="week"]');
  await page.waitForSelector('#tdWeek .tdday.now .tdw.auto');
  assert.equal(await page.evaluate(() => location.hash), '#/todo/week');
  assert.equal(await page.$eval('#tdList', e => e.offsetParent === null), true, 'the list gives way to the week');
  const col = d => page.$$eval('#tdWeek [data-tdday="' + d + '"] > *', k => { const out = []; for (const x of k) { if (x.matches('.tdcl')) out.push('[' + x.querySelector('b').textContent + ']'); else if (x.matches('.tdw')) out.push(x.querySelector('.tdx').textContent + (x.querySelector('.late') ? ' (late)' : '') + (x.matches('.done') ? ' (done)' : '')); } return out; });
  // seven days with a class on each, and Later
  assert.equal((await page.$$('#tdWeek .tdday')).length, 8);
  assert.deepEqual(await col(day(0)), ['Email the office (late)', 'Water the plants (done)', '[grade-9 english]', 'Print handouts', 'Plan today’s grade-9 english lesson']);
  assert.match(await page.$eval('#tdWeek .tdday.now .late', e => e.textContent), /^from \S+day$/);
  // On a Friday the app adds its own "Plan Monday’s lesson" line to Later; the two she wrote are what is checked here.
  assert.deepEqual((await col('')).filter(x => !/^Plan \S+’s /.test(x)), ['Reports', 'Order the novels'], 'a line with a day comes before one with none');
  // a line typed into a day is for that day; typed into Later it has no day
  await add(page, 'Call the printer', '#tdWeek [data-tdwadd="' + day(0) + '"] input');
  await add(page, 'Sort the bookshelf', '#tdWeek [data-tdwadd=""] input');
  const it = (await saved(page)).items;
  assert.deepEqual([it.find(i => i.x === 'Call the printer').d, it.find(i => i.x === 'Sort the bookshelf').d], [day(0), '']);
  assert.ok((await col(day(0))).includes('Call the printer'));
  // dragging to another day changes the day and nothing else
  const drag = (id, to) => page.evaluate((id, to) => {
    const dt = new DataTransfer(), ev = (n, el) => el.dispatchEvent(new DragEvent(n, { bubbles: true, cancelable: true, dataTransfer: dt }));
    ev('dragstart', document.querySelector('#tdWeek [data-td="' + id + '"]')); const c = document.querySelector('#tdWeek [data-tdday="' + to + '"]'); ev('dragover', c); ev('drop', c);
  }, id, to);
  await drag('b', '');
  assert.equal((await saved(page)).items.find(i => i.id === 'b').d, '');
  assert.ok((await col('')).includes('Print handouts'));
  await drag('c', day(0));
  assert.equal((await saved(page)).items.find(i => i.id === 'c').d, day(0));
  // a line the app added keeps a day: it moves to a later one, and not to Later
  const auto = await page.$eval('#tdWeek .tdday.now .tdw.auto', e => e.dataset.td);
  await drag(auto, '');
  assert.ok((await col(day(0))).includes('Plan today’s grade-9 english lesson'));
  await page.evaluate((id, d) => window.__gs.todoMove(id, d), auto, day(7));
  assert.equal((await col(day(0))).includes('Plan today’s grade-9 english lesson'), false);
  // the week after, and back
  await page.click('#tdWeek [data-tdwk="1"]');
  assert.ok((await col(day(7))).some(x => /^Plan .* grade-9 english lesson$/.test(x)));
  assert.equal(await page.$('#tdWeek .tdday.now'), null);
  await page.click('#tdWeek [data-tdwk="0"]');
  // ticking in the week, and the line opening beside it
  await page.click('#tdWeek [data-td="c"] .tdck');
  assert.ok((await saved(page)).items.find(i => i.id === 'c').done > 0);
  await page.click('#tdWeek [data-td="a"] .tdmain');
  await page.waitForSelector('#tdSide [data-tdpane="a"]');
  await page.click('#tdSide [data-tdwhen="today"]');
  assert.equal((await saved(page)).items.find(i => i.id === 'a').d, day(0));
  assert.equal(await page.$('#tdWeek .late'), null);
  await page.click('#tdSide [data-tdclose]');
  await page.click('#tdView [data-tdview=""]');
  assert.equal(await page.evaluate(() => location.hash), '#/todo');
  assert.equal(await page.$eval('#tdWeek', e => e.hidden), true);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a new school year carries what is still to do, and leaves behind what is done or about a student', async () => {
  const { page, close } = await open(null, null);
  const r = await page.evaluate(() => {
    const it = (id, x, more) => ({ id, x, d: '', c: '', who: '', a: '', rep: '', note: '', done: 0, made: 1, t: 1, ...more });
    const old = { classes: [{ id: 'c', name: 'Made-up class', names: ['Kai Pretend', 'Lu Invented'], units: [] }], loose: { id: '', units: [] },
      todo: { items: [it('1', 'Order the novels', { c: 'c', rep: 'week', d: '2028-03-03' }), it('2', 'Call home', { c: 'c', who: 'Kai Pretend' }), it('3', 'Letter for lu invented'), it('4', 'Tidy the shelf', { note: 'Ask Kai Pretend to help' }),
        it('5', 'Print handouts', { done: 5 }), { id: '6', t: 2, gone: 1 }], off: { miss: 1 }, offT: 4, auto: { 'mark:b1': { h: 'x', t: 1 } } } };
    const G = window.__gs, o = { from: '2027–28', to: '2028–29', dates: true, file: 'f.gswork' };
    return { a: G.nyLib(old, {}, { ...o, roster: false }).todo, b: G.nyLib(old, {}, { ...o, roster: true }).todo, none: 'todo' in G.nyLib({ classes: [], loose: { id: '', units: [] } }, {}, { ...o, roster: false }) };
  });
  assert.deepEqual(r.a.items.map(i => i.id), ['1'], 'only the line that names nobody and is not done');
  assert.deepEqual([r.a.items[0].c, r.a.items[0].rep, r.a.off, r.a.offT, r.a.auto], ['c', 'week', { miss: 1 }, 4, {}], 'its class, its repeat and the switches carry; what was hidden for last year’s work does not');
  assert.deepEqual(r.b.items.map(i => i.id), ['1', '2', '3', '4'], 'when the class lists stay, so do the lines about students');
  assert.equal(r.none, false);
  await close();
});

test('two copies of the list merge line by line: the later change wins, and a deleted line stays deleted', () => {
  const M = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'merge.js'), 'utf8') + ';({ todoMerge, mergeLib })');
  const plain = o => JSON.parse(JSON.stringify(o));
  const a = { items: [item('1', 'Print handouts', { t: 5, done: 5 }), item('2', 'Email office', { t: 2 }), item('3', 'Only here', { t: 1 })], off: { miss: 1 }, offT: 9, auto: { 'mark:x': { d: '2026-11-12', t: 4 } } };
  const b = { items: [item('1', 'Print handouts', { t: 3 }), { id: '2', t: 7, gone: 1 }, item('4', 'Only there', { t: 1 })], off: {}, offT: 3, auto: { 'mark:x': { h: 'x', t: 6 }, 'miss:c1': { h: 2, t: 1 } } };
  const m = plain(M.todoMerge(a, b)), back = plain(M.todoMerge(b, a));
  assert.deepEqual(m.items.map(i => [i.id, i.gone ? 'gone' : i.done ? 'done' : 'open']), [['1', 'done'], ['2', 'gone'], ['3', 'open'], ['4', 'open']]);
  assert.deepEqual(m.off, { miss: 1 }); assert.equal(m.offT, 9);
  assert.deepEqual(m.auto, { 'mark:x': { h: 'x', t: 6 }, 'miss:c1': { h: 2, t: 1 } });
  assert.deepEqual(back.items.map(i => i.id).sort(), ['1', '2', '3', '4']);
  assert.deepEqual([back.off, back.auto, back.items.find(i => i.id === '1').done], [m.off, m.auto, 5], 'the same either way round');
  assert.equal(M.todoMerge(null, null), null);
  assert.deepEqual(plain(M.todoMerge(a, null)), plain(a));
  // inside a whole merge: a copy with no list takes the other's, and work with no list anywhere gets none
  const L = todo => ({ classes: [{ id: 'c1', name: 'Test English', names: ['Aria Testwell'], units: [] }], loose: { id: '', units: [] }, ...(todo ? { todo } : {}) });
  assert.deepEqual(plain(M.mergeLib(L(), L(b)).lib.todo), plain(b));
  assert.equal('todo' in M.mergeLib(L(), L()).lib, false);
  assert.deepEqual(plain(M.mergeLib(L(a), L(b)).lib.todo.items.map(i => i.id)), ['1', '2', '3', '4']);
});
