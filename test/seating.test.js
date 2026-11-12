// A class's Seating tab: the room, who sits where, shuffling, and the screen that picks a name or deals groups.
// The chart is kept on the class beside its roster (c.seats). Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { builtHtml, openApp, goTo } = require('./helpers/app');
const { gradingSeed } = require('./helpers/steady');
const wait = ms => new Promise(r => setTimeout(r, ms));

let browser;
before(async () => { builtHtml(); browser = await launch(); });
after(async () => { await browser.close(); });

const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup', 'Esme Placeholder', 'Finn Example'];
const open = async (o = {}) => {
  const r = await openApp(browser, { seed: gradingSeed(), ...o });
  await goTo(r.page, '#/class/c1/seating');
  await r.page.waitForSelector('#seatStart, #seatRoom');
  return r;
};
const cls = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().lib.classes.find(c => c.id === 'c1'))));
const stored = page => page.evaluate(() => (JSON.parse(localStorage.getItem('gs.lib')).classes.find(c => c.id === 'c1') || {}).seats || null);
const seats = page => page.evaluate(() => { const s = window.__gs.seatOf(window.__gs.state().lib.classes.find(c => c.id === 'c1')); return s && JSON.parse(JSON.stringify(s)); });
const deskOf = (s, name) => Object.keys(s.desks).find(k => s.desks[k] === name) || null;
const click = (page, sel) => page.$eval(sel, b => b.click());
const centre = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
async function dragTo(page, from, to) {
  const a = await centre(page, from), b = await centre(page, to);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(a.x + 10, a.y + 6, { steps: 2 }); await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

test('a class has a Seating tab: the room is chosen once, and students are clicked or dragged to desks', async () => {
  const { page, close } = await open();
  try {
    assert.deepEqual(await page.$$eval('#vClass .ctabs .ctrow a', a => a.map(x => x.textContent.trim())), ['Attendance', 'Seating', 'Missing work', 'Charts', 'Report comments']);
    // nothing is kept until a room is chosen
    assert.equal(await stored(page), null);
    assert.equal(await page.$$eval('#seatStart [data-seatroom]', b => b.length), 4);
    await click(page, '[data-seatroom="pairs"]');
    await page.waitForSelector('#seatRoom');
    let s = await seats(page);
    assert.equal(Object.keys(s.desks).length, 6, 'a desk for each student');
    assert.deepEqual(Object.values(s.desks), ['', '', '', '', '', ''], 'and nobody on one yet');
    assert.equal(await page.$eval('#seatSum', e => e.textContent), '0 of 6 seated');
    assert.deepEqual(await page.$$eval('#seatTray .seatchip', c => c.map(x => x.textContent)), ['Aria', 'Bram', 'Cleo', 'Dov', 'Esme', 'Finn']);
    // click a student, then a desk
    await click(page, '.seatchip[data-n="0"]');
    assert.match(await page.$eval('#seatSel', e => e.textContent), /Aria Testwell/);
    await click(page, '[data-desk="0,0"]');
    s = await seats(page); assert.equal(s.desks['0,0'], 'Aria Testwell');
    // drag a student from the list to a desk
    await dragTo(page, '.seatchip[data-n="1"]', '[data-desk="1,0"]');
    s = await seats(page); assert.equal(s.desks['1,0'], 'Bram Sample');
    // dropping one student on another swaps them
    await dragTo(page, '[data-desk="0,0"]', '[data-desk="1,0"]');
    s = await seats(page); assert.deepEqual([s.desks['0,0'], s.desks['1,0']], ['Bram Sample', 'Aria Testwell']);
    // a student from the list dropped on someone takes the desk, and that student is back in the list
    await dragTo(page, '.seatchip[data-n="2"]', '[data-desk="0,0"]');
    s = await seats(page); assert.equal(s.desks['0,0'], 'Cleo Fixture'); assert.equal(deskOf(s, 'Bram Sample'), null);
    // dragged back to the list: off the chart
    await dragTo(page, '[data-desk="0,0"]', '#seatTray h3');
    s = await seats(page); assert.equal(deskOf(s, 'Cleo Fixture'), null);
    assert.equal(await page.$eval('#seatSum', e => e.textContent), '1 of 6 seated');
    // it is kept with the roster, and is there after a refresh
    assert.deepEqual((await stored(page)).desks, s.desks);
    await page.reloadHere(); await page.waitForSelector('#seatRoom');
    assert.equal(await page.$eval('[data-desk="1,0"]', e => e.textContent), 'Aria');
    // Escape lets go of a picked student
    await click(page, '[data-desk="1,0"]'); assert.equal(await page.$eval('#seatSel', e => e.hidden), false);
    await page.keyboard.press('Escape'); assert.equal(await page.$eval('#seatSel', e => e.hidden), true);
  } finally { await close(); }
});

test('Shuffle seats everyone, leaves a kept student where they are, and can be undone', async () => {
  const { page, close } = await open();
  try {
    await click(page, '[data-seatroom="rows"]'); await page.waitForSelector('#seatRoom');
    await click(page, '[data-seat="order"]');
    let s = await seats(page);
    assert.deepEqual(Object.values(s.desks), NAMES, 'roster order, from the front');
    // keep the fourth student in their seat
    await click(page, '[data-desk="3,0"]'); await click(page, '[data-seat="pin"]');
    assert.deepEqual((await seats(page)).pins, ['Dov Madeup']);
    assert.equal(await page.$$eval('.seatpin', p => p.length), 1);
    const before = JSON.stringify((await cls(page)).seats);
    for (let i = 0; i < 4; i++) {
      await click(page, '[data-seat="shuffle"]');
      s = await seats(page);
      assert.equal(s.desks['3,0'], 'Dov Madeup');
      assert.deepEqual(Object.values(s.desks).sort(), NAMES.slice().sort(), 'everyone has one desk');
    }
    await click(page, '.toast .tact');
    s = await seats(page);
    assert.equal(Object.values(s.desks).filter(Boolean).length, 6);
    // Empty every seat, and Undo puts everyone back
    const was = JSON.stringify((await cls(page)).seats);
    await click(page, '[data-seat="empty"]');
    assert.equal(Object.values((await seats(page)).desks).filter(Boolean).length, 0);
    await click(page, '.toast .tact');
    assert.equal(JSON.stringify((await cls(page)).seats), was);
    assert.ok(before);
    // moving a kept student by hand lets them go
    await click(page, '[data-desk="3,0"]'); await click(page, '[data-desk="0,0"]');
    assert.deepEqual((await seats(page)).pins, []);
  } finally { await close(); }
});

test('Arrange the room adds and takes away desks, and a student whose desk goes is back in the list', async () => {
  const { page, close } = await open();
  try {
    await click(page, '[data-seatroom="tables"]'); await page.waitForSelector('#seatRoom');
    await click(page, '[data-seat="order"]');
    let s = await seats(page);
    assert.deepEqual([s.w, s.h, Object.keys(s.desks).length], [5, 2, 6]);
    await click(page, '[data-seat="arrange"]'); await page.waitForSelector('[data-cell]');
    assert.equal(await page.$$eval('[data-cell]', c => c.length), 10, 'every square of the room can be clicked');
    await click(page, '[data-cell="0,0"]');   // Aria's desk
    await click(page, '[data-cell="2,0"]');   // a new desk in the gap
    s = await seats(page);
    assert.equal('0,0' in s.desks, false); assert.equal(s.desks['2,0'], ''); assert.equal(deskOf(s, 'Aria Testwell'), null);
    // a row more, a column fewer: desks past the edge go, with whoever was on them
    await click(page, '[data-seatsize="h:1"]'); await click(page, '[data-seatsize="w:-1"]');
    s = await seats(page);
    assert.deepEqual([s.w, s.h], [4, 3]); assert.ok(Object.keys(s.desks).every(k => +k.split(',')[0] < 4));
    // another layout: the students who were seated are seated in it, in the order they sat
    const sat = Object.keys(s.desks).sort((a, b) => a.split(',')[1] - b.split(',')[1] || a.split(',')[0] - b.split(',')[0]).map(k => s.desks[k]).filter(Boolean);
    await click(page, '[data-seatroom="horseshoe"]');
    s = await seats(page);
    assert.ok(Object.keys(s.desks).length >= 6);
    assert.deepEqual(Object.values(s.desks).filter(Boolean).sort(), sat.slice().sort());
    await click(page, '[data-seat="done"]'); await page.waitForSelector('[data-desk]');
    // turned round, for the teacher's own view: the front is at the bottom and nothing else changes
    const desks = JSON.stringify(s.desks);
    await click(page, '[data-seat="flip"]');
    assert.equal(await page.$eval('#seatRoom', r => r.lastElementChild.className), 'seatfront');
    assert.equal(JSON.stringify((await seats(page)).desks), desks);
    // shown to the class: the chart alone, the front at the top, closed with Escape
    await click(page, '[data-seat="show"]'); await page.waitForSelector('#seatShow');
    assert.equal(await page.$eval('#seatShow .seatroom', r => r.firstElementChild.className), 'seatfront');
    assert.equal(await page.$$eval('#seatShow .seat:not(.empty)', d => d.length), sat.length);
    await page.keyboard.press('Escape');
    for (let i = 0; i < 40 && await page.$('#seatShow'); i++) await wait(50);
    assert.equal(await page.$('#seatShow'), null);
  } finally { await close(); }
});

test('a student taken off the roster leaves their desk, and the rosters are kept where the Planner can call on a student', async () => {
  const { page, close } = await open();
  try {
    await click(page, '[data-seatroom="rows"]'); await page.waitForSelector('#seatRoom');
    await click(page, '[data-seat="order"]');
    const rolls = JSON.parse(await page.evaluate(() => localStorage.getItem('gs.rolls')));
    assert.deepEqual(rolls, [['Grade 9 English', NAMES], ['Grade 10 Literature', ['Nia Elsewhere', 'Omar Stand-in']]]);
    // the roster loses a student
    await page.evaluate(() => { const g = window.__gs, c = g.state().lib.classes.find(c => c.id === 'c1'); c.names = c.names.filter(n => n !== 'Bram Sample'); g.saveLib(); });
    const s = await seats(page);
    assert.equal(s.desks['1,0'], '', 'their desk is empty');
    assert.equal(Object.values(s.desks).filter(Boolean).length, 5);
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('gs.rolls')))[0][1].includes('Bram Sample'), false);
    // the list other parts of the app read
    const list = await page.evaluate(() => window.__gs.seatList(window.__gs.state().lib.classes.find(c => c.id === 'c1')));
    assert.deepEqual(list[0], { name: 'Aria Testwell', x: 0, y: 0 });
    assert.equal(list.length, 5);
    // the copy of the rosters is this browser's own: it does not travel with the work
    assert.equal(await page.evaluate(() => Object.keys(window.__gs.carryLs()).includes('gs.rolls')), false);
  } finally { await close(); }
});

test('Pick a name goes round the whole class before anyone is picked twice, and Make groups deals everyone who is here', async () => {
  const { page, close } = await open();
  try {
    await click(page, '[data-seatroom="rows"]'); await page.waitForSelector('#seatRoom');
    await page.evaluate(() => { window.__pick.PK.fast = true; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
    await click(page, '[data-seat="pick"]'); await page.waitForSelector('#pkName.done');
    const got = [await page.$eval('#pkName', e => e.textContent)];
    assert.equal(await page.$eval('#pkSub', e => e.textContent), '1 of 6 picked');
    for (let i = 0; i < 5; i++) { await page.keyboard.press('Space'); got.push(await page.$eval('#pkName', e => e.textContent)); }
    assert.deepEqual(got.slice().sort(), NAMES.slice().sort(), 'six picks, six students');
    await page.keyboard.press('Space');
    assert.match(await page.$eval('#pkSub', e => e.textContent), /Everyone has had a turn\. Starting again\. 1 of 6 picked/);
    assert.notEqual(await page.$eval('#pkName', e => e.textContent), got[5], 'the round does not start with the student just picked');
    // someone is away: they are never picked
    await page.keyboard.press('w'); await page.waitForSelector('#pkWho:not([hidden])');
    await click(page, '[data-pkw="0"]'); await click(page, '[data-pkw="1"]');
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('#pkWho', e => e.hidden), true);
    assert.ok(await page.$('#pkStage'), 'Escape closed the list first');
    await click(page, '[data-pk="reset"]');
    const here = [await page.$eval('#pkName', e => e.textContent)];
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Space'); here.push(await page.$eval('#pkName', e => e.textContent)); }
    assert.deepEqual(here.slice().sort(), NAMES.slice(2).sort());
    assert.match(await page.$eval('#pkBar [data-pk="who"]', e => e.textContent), /2 away/);
    // groups: the four who are here, in pairs
    await page.keyboard.press('g'); await page.waitForSelector('#pkGroups');
    await page.keyboard.press('2');
    let groups = await page.$$eval('.pk-g', g => g.map(x => [...x.querySelectorAll('div')].map(d => d.textContent)));
    assert.deepEqual(groups.map(g => g.length), [2, 2]);
    assert.deepEqual(groups.flat().sort(), NAMES.slice(2).sort());
    // everyone back, three groups
    await click(page, '[data-pk="who"]'); await click(page, '[data-pkw="0"]'); await click(page, '[data-pkw="1"]'); await click(page, '[data-pk="who"]');
    await click(page, '[data-pkby="count"]'); await click(page, '[data-pkn="3"]');
    groups = await page.$$eval('.pk-g', g => g.map(x => [...x.querySelectorAll('div')].map(d => d.textContent)));
    assert.deepEqual(groups.map(g => g.length), [2, 2, 2]);
    assert.deepEqual(groups.flat().sort(), NAMES.slice().sort());
    await click(page, '[data-pk="copy"]');
    assert.equal(await page.evaluate(() => window.__copied), groups.map((g, i) => 'Group ' + (i + 1) + ': ' + g.join(', ')).join('\n'));
    await page.keyboard.press('Escape');
    assert.equal(await page.$('#pkStage'), null);
    // nothing about picks or groups is kept
    assert.deepEqual(Object.keys(await stored(page)).sort(), ['desks', 'h', 'w']);
    // how groups come out: nobody alone, nobody far short
    const sizes = await page.evaluate(() => [[25, 'size', 2], [26, 'size', 4], [5, 'size', 4], [9, 'size', 4], [7, 'count', 3], [3, 'count', 8], [1, 'size', 2]].map(([n, by, k]) => window.__pick.groups(Array.from({ length: n }, (_, i) => 'S' + i), by, k).map(g => g.length).sort((a, b) => b - a).join(' ')));
    assert.deepEqual(sizes, ['3 2 2 2 2 2 2 2 2 2 2 2', '4 4 4 4 4 3 3', '5', '3 3 3', '3 2 2', '1 1 1', '1']);
    // names on a desk: first names, with a letter of the last name where two share one; "Last, First" is said the other way round
    assert.deepEqual(await page.evaluate(() => window.__pick.short(['Okafor, Ada', 'Ada Lovelace', 'Bo Tan'])), ['Ada O.', 'Ada L.', 'Bo']);
  } finally { await close(); }
});
