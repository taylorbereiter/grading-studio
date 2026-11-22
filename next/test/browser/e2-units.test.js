// Stage 8, slice E2: units in the Library, the unit sheet and the unit's side of the Course line (rows E2-049, E2-050, E2-051,
// E2-061, E2-062, E2-063, E2-095, E2-105, E2-111, E2-112 of rebuild/audit/gaps.md, and hooks.md H-072). Made-up units and lessons
// at the stopped clock (planseed.js, Tuesday 27 October 2026).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./e2harness.js');
const { LESSONS } = require('./planseed.js');
const h = harness(before, after);
const until = (p, fn, ...a) => p.waitForFunction(fn, { timeout: 8000 }, ...a);
const unitsNow = async (p, f) => { for (let k = 0; k < 40; k++) { const u = (await h.kvInDb(p, 'units')) || []; if (f(u)) return u; await new Promise(r => setTimeout(r, 100)); } return (await h.kvInDb(p, 'units')) || []; };

test('E2-061 E2-062 E2-063 E2-105 E2-095: Library > Units makes a unit and opens each on its Course line; with none yet it says what a unit is and makes one; each unit is in the command bar', async () => {
  let p = await h.fresh(1366, { units: [] });
  await h.open(p, 'library/units');
  await p.waitForSelector('main .empty [data-lib-newunit]');
  assert.match(await p.$eval('main .empty p', e => e.textContent), /^A unit is some weeks of one course/);
  await p.click('[data-lib-newunit]');
  await p.waitForSelector('dialog.sheet [data-focus="save-unit"]');
  await p.click('[data-focus="save-unit"]');
  const made = await unitsNow(p, u => u.length === 1);
  assert.equal(made.length, 1); assert.equal(made[0].course, 'Grade 9'); assert.equal(made[0].start, '2026-10-26');
  await p.waitForSelector('[data-lib-unit="' + made[0].id + '"]');
  assert.deepEqual(p.errors, []); await p.ctx.close();
  p = await h.fresh();
  await h.open(p, 'library/units');
  await p.waitForSelector('main .libtop [data-lib-newunit]');
  await p.click('[data-lib-unit="U2"]');
  await until(p, () => /^#\/class\//.test(location.hash) && document.querySelector('#h-unit') && document.querySelector('#h-unit').textContent === 'Unit 2: Poetry');
  // from the command bar, by its title
  await h.open(p, 'home');
  await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control');
  await p.waitForSelector('dialog.cmd[open] input');
  // (a made-up assignment's name has "stories" in it too: the unit's own words pick it)
  await p.keyboard.type('Unit 1 Stories');
  await until(p, () => { const o = document.querySelector('dialog.cmd [role="option"][aria-selected="true"]'); return o && o.textContent === 'Unit 1: Stories'; });
  await p.keyboard.press('Enter');
  await until(p, () => /^#\/class\//.test(location.hash) && document.querySelector('#h-unit') && document.querySelector('#h-unit').textContent === 'Unit 1: Stories');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-049 E2-050 E2-051: the unit starts on a Monday picked by its school week; a week with writing taken off comes back with Undo; the unit plan link opens', async () => {
  const p = await h.fresh();
  await h.open(p, 'class/c1');
  await p.waitForSelector('[data-focus="edit-unit"]');
  await p.click('[data-focus="edit-unit"]');
  await p.waitForSelector('dialog.sheet [data-unit-start]');
  const opts = await p.$$eval('[data-unit-start] option', o => o.map(x => [x.value, x.textContent]));
  assert.deepEqual(opts[0], ['2026-08-31', 'Week 1, Aug 31']);
  assert.ok(opts.every(([v]) => new Date(v + 'T12:00').getDay() === 1), 'Mondays only');
  assert.equal(await p.$eval('[data-unit-start]', s => s.value), '2026-10-12');
  await p.select('[data-unit-start]', '2026-10-19');
  // the last week has writing: taken off, then back with Undo
  const n0 = await p.$$eval('dialog.sheet .uweeks > li', x => x.length);
  await p.click('[data-week-fewer]');
  await until(p, n => document.querySelectorAll('dialog.sheet .uweeks > li').length === n - 1, n0);
  await p.waitForSelector('.toast button');
  await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => b.textContent === 'Undo').click());
  await until(p, n => document.querySelectorAll('dialog.sheet .uweeks > li').length === n, n0);
  // the link, and its Open
  assert.equal(await p.$('[data-unit-open-link]'), null);
  await p.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(u); return null; }; });
  await p.$eval('dialog.sheet .ulink input', i => i.focus()); await p.keyboard.type('https://plans.example.com/unit2');
  await p.click('[data-unit-open-link]');
  assert.deepEqual(await p.evaluate(() => window.__opened), ['https://plans.example.com/unit2']);
  await p.click('[data-focus="save-unit"]');
  const us = await unitsNow(p, u => u.find(x => x.id === 'U2').start === '2026-10-19');
  const u2 = us.find(x => x.id === 'U2');
  assert.equal(u2.start, '2026-10-19'); assert.equal(u2.weeks.length, n0); assert.equal(u2.atlas, 'https://plans.example.com/unit2');
  // the current Planner reads it
  await p.goto(h.srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && P.L.units && P.L.units.length; }, { timeout: 20000 });
  assert.equal(await p.evaluate(() => window.__planner.L.units.find(u => u.id === 'U2').start), '2026-10-19');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-111 E2-112 H-072: the unit’s side opens the rubric bank, lists the lessons tied to the unit, and takes a screenshot pasted anywhere on the page', async () => {
  const p = await h.fresh(1366, { lessons: LESSONS.map(l => l.id === 'L0' ? { ...l, unit: 'U2' } : l) });
  await h.open(p, 'class/c1');
  await p.waitForSelector('.ubank [data-bkopen]');
  assert.equal(await p.$eval('.ubank [data-bkopen]', a => a.getAttribute('href')), '#/library/rubrics');
  await p.waitForSelector('.ulessons [data-ulesson="L0"]');
  assert.match(await p.$eval('.ulessons h2', e => e.textContent), /^Lessons for this unit/);
  // a screenshot pasted on the page, not in a box
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 4; const b = await new Promise(r => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([b], 'image.png', { type: 'image/png' }));
    document.querySelector('main h1, main').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  const us = await unitsNow(p, u => (u.find(x => x.id === 'U2').files || []).some(f => f.kind === 'atlas'));
  assert.ok(us.find(x => x.id === 'U2').files.some(f => f.kind === 'atlas'), 'the screenshot went to the unit plan’s pictures');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-053 E2-054 E2-059 E2-052 E2-057: a unit’s screenshot replaced and removed with Undo; files dropped on the files box are unit files, from the computer or Drive’s chooser', async () => {
  const p = await h.fresh();
  await h.open(p, 'class/c1');
  await p.waitForSelector('.ushots [data-shot-input]');
  // Google Drive's chooser is offered beside both: a line of the screenshot's menu, a button by the files
  await p.click('[data-focus="unit-add-shot"]'); await p.waitForSelector('.pop [role="menuitem"]');
  assert.deepEqual(await p.$$eval('.pop [role="menuitem"]', b => b.map(x => x.textContent.trim())), ['From this computer', 'From Google Drive']);
  await p.keyboard.press('Escape');
  assert.ok(await p.$('.ufiles [data-drive]'), 'Drive beside the files');
  const png = () => { const c = document.createElement('canvas'); c.width = 3; c.height = 3; return new Promise(r => c.toBlob(r, 'image/png')); };
  // a screenshot through the box Drive's chooser fills
  await p.evaluate(async png => { const b = await (new Function('return ' + png))()(); const dt = new DataTransfer(); dt.items.add(new File([b], 'plan.png', { type: 'image/png' })); const i = document.querySelector('[data-shot-input]'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); }, png.toString());
  let us = await unitsNow(p, u => (u.find(x => x.id === 'U2').files || []).some(f => f.kind === 'atlas'));
  const shot = us.find(x => x.id === 'U2').files.find(f => f.kind === 'atlas');
  assert.equal(shot.name, 'plan.png');
  // replaced
  await p.waitForSelector('[data-shot-replace="' + shot.id + '"]');
  const chooser = p.waitForFileChooser();
  await p.click('[data-shot-replace="' + shot.id + '"]');
  const fs = require('fs'), os = require('os'), path = require('path'), tmp = path.join(os.tmpdir(), 'gs-e2-shot-' + process.pid + '.png');
  fs.writeFileSync(tmp, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  await (await chooser).accept([tmp]);
  us = await unitsNow(p, u => (u.find(x => x.id === 'U2').files || []).some(f => f.id === shot.id && f.name !== 'plan.png'));
  assert.equal(us.find(x => x.id === 'U2').files.find(f => f.id === shot.id).name, path.basename(tmp));
  // removed, then back with Undo
  await p.click('.ushots figcaption [aria-label="Remove"]');
  us = await unitsNow(p, u => !(u.find(x => x.id === 'U2').files || []).some(f => f.id === shot.id));
  assert.ok(!us.find(x => x.id === 'U2').files.some(f => f.id === shot.id));
  await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => b.textContent === 'Undo').click());
  us = await unitsNow(p, u => (u.find(x => x.id === 'U2').files || []).some(f => f.id === shot.id));
  assert.ok(us.find(x => x.id === 'U2').files.some(f => f.id === shot.id), 'back with Undo');
  // a picture and a document dropped on the files box: unit files, not screenshots
  await p.evaluate(async png => { const b = await (new Function('return ' + png))()(); const dt = new DataTransfer(); dt.items.add(new File([b], 'poster.png', { type: 'image/png' })); dt.items.add(new File(['made-up task'], 'Summative task.txt', { type: 'text/plain' }));
    const z = document.querySelector('[data-ufiles-drop]'); z.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); z.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, png.toString());
  us = await unitsNow(p, u => (u.find(x => x.id === 'U2').files || []).some(f => f.name === 'poster.png'));
  const fl = us.find(x => x.id === 'U2').files;
  assert.equal(fl.find(f => f.name === 'poster.png').kind, 'other');
  assert.equal(fl.find(f => f.name === 'Summative task.txt').kind, 'summative');
  // a file through the files' Drive box
  await p.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['notes'], 'From Drive.txt', { type: 'text/plain' })); const i = document.querySelector('[data-ufile-input]'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); });
  us = await unitsNow(p, u => (u.find(x => x.id === 'U2').files || []).some(f => f.name === 'From Drive.txt'));
  assert.ok(us.find(x => x.id === 'U2').files.some(f => f.name === 'From Drive.txt'));
  assert.deepEqual(p.errors, []); await p.ctx.close(); fs.unlinkSync(tmp);   // the browser may read the picture from the file until it closes
});

test('E2-048: a unit sheet with changes asks before it closes by Esc, the backdrop, × or Cancel; leaving the page saves them; the current Planner reads them', async () => {
  const p = await h.fresh();
  await h.open(p, 'class/c1');
  const openSheet = async () => { await p.waitForSelector('[data-focus="edit-unit"]'); await p.click('[data-focus="edit-unit"]'); await p.waitForSelector('dialog.sheet [data-focus="unit-name"]'); };
  const typeName = async w => { await p.focus('dialog.sheet [data-focus="unit-name"] input, dialog.sheet input[data-focus="unit-name"]'); await p.keyboard.press('End'); await p.keyboard.type(w); };
  const name = () => p.$eval('dialog.sheet [data-focus="unit-name"] input, dialog.sheet input[data-focus="unit-name"]', i => i.value);
  const before0 = (await unitsNow(p, u => u.length)).find(u => u.id === 'U2');
  await openSheet();
  // nothing changed: Esc just closes
  await p.keyboard.press('Escape');
  await until(p, () => !document.querySelector('dialog.sheet[open]'));
  await openSheet(); await typeName(' one');
  // Esc asks; Keep editing keeps what was typed
  await p.keyboard.press('Escape');
  await p.waitForSelector('[data-unit-ask]');
  assert.ok(await p.$('dialog.sheet[open]'), 'still open');
  await p.click('[data-focus="unit-keep"]');
  assert.equal(await name(), before0.title + ' one');
  // the backdrop asks
  await p.mouse.click(4, 4);
  await p.waitForSelector('[data-unit-ask]');
  await p.click('[data-focus="unit-keep"]');
  // × asks; Discard is her choice and nothing is saved
  await p.click('dialog.sheet header button');
  await p.waitForSelector('[data-unit-ask]');
  await p.click('[data-focus="unit-discard"]');
  await until(p, () => !document.querySelector('dialog.sheet[open]'));
  await new Promise(r => setTimeout(r, 300));
  assert.equal((await h.kvInDb(p, 'units')).find(u => u.id === 'U2').title, before0.title, 'discarded only when she chose it');
  // Cancel asks; Save from the question saves
  await openSheet(); await typeName(' two');
  await p.click('[data-unit-cancel]');
  await p.waitForSelector('[data-unit-ask]');
  await p.click('dialog.sheet [data-focus="save-unit"]');
  await unitsNow(p, u => u.find(x => x.id === 'U2').title === before0.title + ' two');
  // leaving the page under the sheet saves what was typed
  await openSheet(); await typeName(' three');
  await p.evaluate(() => { location.hash = '#/home'; });
  const us = await unitsNow(p, u => u.find(x => x.id === 'U2').title === before0.title + ' two three');
  assert.equal(us.find(x => x.id === 'U2').title, before0.title + ' two three');
  await until(p, () => [...document.querySelectorAll('.toast')].some(x => /were saved/.test(x.textContent)));
  await p.goto(h.srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && P.L.units && P.L.units.length; }, { timeout: 20000 });
  assert.equal(await p.evaluate(() => window.__planner.L.units.find(u => u.id === 'U2').title), before0.title + ' two three');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});
