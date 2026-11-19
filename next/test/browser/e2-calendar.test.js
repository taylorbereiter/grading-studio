// Stage 8, slice E2: the Calendar's lesson cards (tags, menu by dots or right-click), the class page link on the week, the date
// jump and the week's units (rows E2-014, E2-018, E2-019, E2-029, E2-064, E2-065, E2-074, E2-075, E2-082, E2-114, E2-115,
// E2-116 of rebuild/audit/gaps.md). Made-up lessons at the stopped clock (planseed.js, Tuesday 27 October 2026).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./e2harness.js');
const { LESSONS } = require('./planseed.js');
const h = harness(before, after);
const until = (p, fn, ...a) => p.waitForFunction(fn, { timeout: 8000 }, ...a);
const menuItem = (p, label) => p.evaluate(l => { const b = [...document.querySelectorAll('.pop [role="menuitem"]')].find(x => x.textContent.includes(l)); if (!b) return false; b.click(); return true; }, label);
async function cardMenu(p, id, how = 'right') {
  if (how === 'right') await p.click('.lcw a[data-lesson="' + id + '"]', { button: 'right' });
  else { await p.focus('.lcw a[data-lesson="' + id + '"]'); await p.keyboard.press('Tab'); await until(p, id => document.activeElement && document.activeElement.matches('[data-cardmenu="' + id + '"]'), id); await p.keyboard.press('Enter'); }
  await p.waitForSelector('.pop [role="menuitem"]');
}

test('E2-018: a card carries the other version’s name, Finished, where the class got to, and the other classes it is on', async () => {
  const ls = LESSONS.map(l => l.id === 'L4' ? { ...l, final: { id: 'f1', name: 'Narrators.pptx', sig: 'x' } } : l.id === 'L5' ? { ...l, variant: 'Shorter one', variantOf: 'L4' } : l.id === 'L1' ? { ...l, taught: [{ classId: 'A1', date: '2026-10-26', slide: 3, of: 5, note: '', at: 1792000000000 }] } : l);
  const p = await h.fresh(1366, { lessons: ls });
  await h.open(p, 'calendar/class');
  const tags = id => p.$$eval('a[data-lesson="' + id + '"] [data-tag]', x => x.map(e => e.dataset.tag + ':' + e.textContent));
  assert.deepEqual(await tags('L4'), ['final:Finished']);
  assert.deepEqual(await tags('L5'), ['variant:Shorter one']);
  const l1 = await p.$$eval('.cc a[data-lesson="L1"]', a => a.map(x => [...x.querySelectorAll('[data-tag]')].map(e => e.textContent)));
  assert.ok(l1.some(t => t.includes('Taught to slide 3') && t.includes('Also Grade 9 English B')), 'Grade 9 English’s card: where it got to, and the section it is also on');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-075 E2-082 E2-019 E2-074 E2-029: the card menu by right-click or from the keyboard: delete with undo, download, copy to another day, present', async () => {
  const p = await h.fresh();
  await h.open(p, 'calendar/class');
  // delete, then undo
  await cardMenu(p, 'L5');
  assert.deepEqual(await p.$$eval('.pop [role="menuitem"]', b => b.map(x => x.querySelector('b').textContent)), ['Present', 'Download slides', 'Copy to another class or day…', 'Add the class page link…', 'Delete lesson']);
  await menuItem(p, 'Delete lesson');
  await until(p, () => !document.querySelector('a[data-lesson="L5"]'));
  assert.equal(await h.lessonInDb(p, 'L5'), null, 'deleted');
  await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => b.textContent === 'Undo').click());
  await p.waitForSelector('a[data-lesson="L5"]');
  assert.ok(await h.lessonInDb(p, 'L5'), 'back with Undo');
  // download, from the keyboard this time
  await p.evaluate(() => { window.__dl = []; const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dl.push(this.download); else c.call(this); }; });
  await cardMenu(p, 'L4', 'keys');
  await menuItem(p, 'Download slides');
  await until(p, () => window.__dl.length === 1);
  assert.match(await p.evaluate(() => window.__dl[0]), /\.pptx$/);
  // copy to another day
  await cardMenu(p, 'L4');
  await menuItem(p, 'Copy to another class or day');
  await p.waitForSelector('dialog.sheet [data-focus="copy-make"]');
  await p.$eval('dialog.sheet input[type="date"]', i => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(i, '2026-11-04'); i.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('[data-focus="copy-make"]');
  await p.waitForFunction(() => /^#\/lesson\/[^/]+$/.test(location.hash) && location.hash !== '#/lesson/L4', { timeout: 10000 });
  const id = await p.evaluate(() => location.hash.split('/')[2]), cp = await h.lessonInDb(p, id);
  assert.deepEqual(cp.slots, [{ classId: 'B1', date: '2026-11-04' }]); assert.equal(cp.title, 'Unreliable narrators');
  // present today's lesson from its card
  await h.open(p, 'calendar/class');
  await cardMenu(p, 'L2');
  await menuItem(p, 'Present');
  await p.waitForSelector('.present', { timeout: 10000 });
  assert.equal(await p.evaluate(() => location.hash), '#/lesson/L2/present/A1');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-114 E2-115 E2-116: a class’s page link set on the week, shown there and on its cards, kept where the current Planner and grading read it', async () => {
  const p = await h.fresh();
  await h.open(p, 'calendar/class');
  // from an empty period's menu
  await p.click('main [data-focus="cal-next"]'); await p.waitForSelector('main [data-slotmenu="A1|2026-11-03"]');
  await p.click('main [data-slotmenu="A1|2026-11-03"]');
  await p.waitForSelector('.pop [role="menuitem"]');
  await menuItem(p, 'Add the class page link');
  await p.waitForSelector('[data-link-url]');
  await until(p, () => document.activeElement && document.activeElement.matches('[data-link-url]'));
  await p.keyboard.type('school.example.com/class/9a'); await p.keyboard.press('Enter');
  await until(p, () => !document.querySelector('[data-link-url]') && document.querySelector('.byclass .rh svg'));
  await p.click('main [data-focus="cal-prev"]');
  assert.equal((await h.kvInDb(p, 'setup')).classes.find(c => c.id === 'A1').mb, 'https://school.example.com/class/9a');
  assert.equal(JSON.parse(await h.local(p, 'gs.mblinks')).grade9english, 'https://school.example.com/class/9a');
  await cardMenu(p, 'L2');
  assert.ok(await p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].some(b => b.textContent.startsWith('Class page'))), 'the card offers the class page');
  await p.keyboard.press('Escape');
  // changed to nothing: removed
  await p.click('main [data-focus="week-menu"]'); await p.waitForSelector('.pop [role="menuitem"]');
  await menuItem(p, 'Change the class page link');
  await p.waitForSelector('[data-link-url]'); await until(p, () => document.activeElement && document.activeElement.matches('[data-link-url]'));
  await p.$eval('[data-link-url]', i => i.select()); await p.keyboard.press('Backspace'); await p.keyboard.press('Enter');
  await until(p, () => !document.querySelector('.byclass .rh svg'));
  assert.equal((await h.kvInDb(p, 'setup')).classes.find(c => c.id === 'A1').mb, undefined);
  // set again, and the current Planner shows it on the class
  await cardMenu(p, 'L2'); await menuItem(p, 'Add the class page link');
  await p.waitForSelector('[data-link-url]'); await until(p, () => document.activeElement && document.activeElement.matches('[data-link-url]'));
  await p.keyboard.type('https://school.example.com/9a'); await p.keyboard.press('Enter');
  await until(p, () => document.querySelector('.byclass .rh svg'));
  await p.goto(h.srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && P.L.setup && P.L.setup.classes; }, { timeout: 20000 });
  assert.equal(await p.evaluate(() => window.__planner.L.setup.classes.find(c => c.id === 'A1').mb), 'https://school.example.com/9a');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-014 E2-064 E2-065: a date jump, and the week’s units with this week’s focus; the week’s menu opens a unit, or makes one for a course with none starting that week', async () => {
  const p = await h.fresh();
  await h.open(p, 'calendar/class');
  assert.deepEqual(await p.$$eval('.wunits .wu', x => x.map(e => e.textContent)), ['Grade 9Unit 2: PoetryWeek 3 of 5: Voice', 'Grade 10Unit 2: NarratorsWeek 2 of 4']);
  await p.click('main [data-focus="week-menu"]'); await p.waitForSelector('.pop [role="menuitem"]');
  await menuItem(p, 'Open Unit 2: Poetry');
  await p.waitForSelector('dialog.sheet [data-focus="unit-name"]');
  assert.equal(await p.$eval('dialog.sheet [data-focus="unit-name"] input, dialog.sheet input[data-focus="unit-name"]', i => i.value), 'Unit 2: Poetry');
  await p.keyboard.press('Escape'); await until(p, () => !document.querySelector('dialog.sheet[open]'));
  await p.$eval('[data-focus="cal-date"]', i => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(i, '2026-11-18'); i.dispatchEvent(new Event('input', { bubbles: true })); });
  await until(p, () => /November/.test(document.querySelector('#cal-title').textContent) && /\b16\b/.test(document.querySelector('#cal-title').textContent));
  await until(p, () => [...document.querySelectorAll('.wu.none')].some(x => x.textContent.includes('Grade 10')));
  await p.click('main [data-focus="week-menu"]'); await p.waitForSelector('.pop [role="menuitem"]');
  await menuItem(p, 'New unit for Grade 10');
  await p.waitForSelector('dialog.sheet [data-focus="save-unit"]');
  await p.click('[data-focus="save-unit"]');
  await until(p, () => !document.querySelector('dialog.sheet[open]'));
  let u; for (let k = 0; k < 40 && !u; k++) { u = ((await h.kvInDb(p, 'units')) || []).find(x => x.course === 'Grade 10' && x.start === '2026-11-16'); if (!u) await new Promise(r => setTimeout(r, 100)); }
  assert.ok(u, 'a new unit for Grade 10 starting that Monday'); assert.equal(u.weeks.length, 6);
  await p.waitForSelector('[data-wunit="' + u.id + '"]');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});
