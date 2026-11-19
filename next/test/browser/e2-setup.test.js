// Stage 8, slice E2: the Planner's setup file, the timetable's other parts, and the move to a new school year (rows E2-008,
// E2-009, E2-015, E2-016, E2-085, E2-086, E2-087, E2-089, E2-090, E2-091, E2-113 of rebuild/audit/gaps.md, and hooks.md H-054).
// Made-up classes and lessons at the stopped clock (planseed.js, Tuesday 27 October 2026).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { harness } = require('./e2harness.js');
const { SETUP } = require('./planseed.js');
const h = harness(before, after);
const until = (p, fn, ...a) => p.waitForFunction(fn, { timeout: 10000 }, ...a);
const kvNow = async (p, k, f) => { for (let i = 0; i < 50; i++) { const v = await h.kvInDb(p, k); if (f(v)) return v; await new Promise(r => setTimeout(r, 100)); } return h.kvInDb(p, k); };
// A download made by the page: its name and text, kept instead of saved.
const catchDownloads = p => p.evaluate(() => { window.__dl = []; const make = URL.createObjectURL; URL.createObjectURL = b => { const u = make.call(URL, b); window.__blob = window.__blob || {}; window.__blob[u] = b; return u; };
  HTMLAnchorElement.prototype.click = function () { if (this.download) window.__blob[this.href].text().then(t => window.__dl.push({ name: this.download, text: t })); }; });
const dropFile = (p, name, text) => p.evaluate((name, text) => { const dt = new DataTransfer(); dt.items.add(new File([text], name, { type: 'application/json' }));
  const el = document.querySelector('main'); el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, name, text);

test('E2-085 E2-087 E2-089 E2-091 E2-090: Settings > Timetable saves a setup file; a class takes any colour, an event runs over days, and + Add slide offers every layout', async () => {
  const p = await h.fresh(1366, { setup: { ...SETUP, events: [{ date: '2026-11-09', to: '2026-11-13', label: 'Midterms' }] } });
  await h.open(p, 'settings/timetable');
  await p.waitForSelector('main .ttset [data-any-colour]');
  // the event's "to" is shown, and kept when something else is saved
  assert.equal(await p.$eval('main [data-ev-to] input, main input[data-ev-to]', i => i.value), '2026-11-13');
  // any colour, beside the eight
  await p.$eval('main [data-any-colour]', i => { i.value = '#123456'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  // + Add slide adds: the picture layouts too
  const adds = await p.$$eval('main .ttset select', ss => ss.map(s => [...s.options].map(o => o.value)).find(v => v.includes('content')));
  assert.ok(adds.includes('fullpic') && adds.includes('picprompt'), 'Full picture and Picture + questions');
  await p.$$eval('main .ttset select', ss => { const s = ss.find(x => [...x.options].some(o => o.value === 'fullpic')); s.value = 'fullpic'; s.dispatchEvent(new Event('change', { bubbles: true })); s.dispatchEvent(new Event('input', { bubbles: true })); });
  // the template can come from Drive's chooser too
  assert.ok(await p.$('main .ttset .drv [data-drive], main .ttset .drv button'), 'From Google Drive beside the template');
  await p.click('main [data-focus="save-timetable"]');
  const s = await kvNow(p, 'setup', v => v.classes[0].color === '#123456');
  assert.equal(s.classes[0].color, '#123456');
  assert.deepEqual(s.events, [{ date: '2026-11-09', to: '2026-11-13', label: 'Midterms' }]);
  assert.equal(s.deck.add, 'fullpic');
  // Save my setup file: the current Planner's own file
  await catchDownloads(p);
  await p.click('main [data-setup-save]');
  await until(p, () => window.__dl.length === 1);
  const dl = await p.evaluate(() => window.__dl[0]);
  assert.equal(dl.name, 'Planner setup.json');
  const j = JSON.parse(dl.text);
  assert.equal(j.kind, 'grading-studio-lessons-setup'); assert.equal(j.version, 1);
  assert.deepEqual(j.classes.map(c => c.id), s.classes.map(c => c.id));
  assert.equal(j.semStart, '2026-08-31'); assert.deepEqual(j.events, s.events); assert.deepEqual(j.deck, { add: 'fullpic' });
  fs.writeFileSync(path.join(os.tmpdir(), 'gs-e2-setup-' + process.pid + '.json'), dl.text);
  // the current Planner reads the event's end
  await p.goto(h.srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && P.L.setup && P.L.setup.events.length; }, { timeout: 20000 });
  assert.equal(await p.evaluate(() => window.__planner.L.setup.events[0].to), '2026-11-13');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-008 E2-015 E2-009 E2-016 E2-086 E2-113: with no timetable the calendar types classes in or loads a setup file; one dropped on the page loads too', async () => {
  const f = path.join(os.tmpdir(), 'gs-e2-setup-' + process.pid + '.json');
  if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify({ kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-08-31', semEnd: '2027-01-18', classes: SETUP.classes, daysOff: [], events: [], template: '' }));
  let p = await h.fresh(1366, { setup: null, lessons: [], units: [] });
  await h.open(p, 'calendar/class');
  await p.waitForSelector('main .empty [data-load-setup]');
  assert.equal(await p.$eval('main .empty [data-type-classes]', a => a.getAttribute('href')), '#/settings/timetable');
  assert.ok(await p.$('main .empty [data-loose]'), 'a lesson without a class');
  const [fc] = await Promise.all([p.waitForFileChooser(), p.click('main [data-load-setup]')]); await fc.accept([f]);
  const s = await kvNow(p, 'setup', v => v && v.classes && v.classes.length);
  assert.deepEqual(s.classes.map(c => c.id), SETUP.classes.map(c => c.id));
  assert.equal(s.semStart, '2026-08-31');
  await until(p, () => !document.querySelector('main .empty [data-load-setup]'));
  await until(p, () => [...document.querySelectorAll('.toast')].some(x => /Timetable loaded: 3 classes/.test(x.textContent)));
  // the Semester view shows the same empty state, with the same way in
  await p.ctx.close();
  p = await h.fresh(1366, { setup: null, lessons: [], units: [] });
  await h.open(p, 'calendar/semester');
  await p.waitForSelector('main .empty [data-load-setup]');
  // dropped anywhere
  await dropFile(p, 'Planner setup.json', fs.readFileSync(f, 'utf8'));
  const s2 = await kvNow(p, 'setup', v => v && v.classes && v.classes.length);
  assert.equal(s2.classes.length, SETUP.classes.length);
  await p.goto(h.srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && P.L.setup && P.L.setup.classes.length === 3; }, { timeout: 20000 });
  assert.deepEqual(p.errors, []); await p.ctx.close();
  fs.unlinkSync(f);
});

test('H-054: after Start a new year with the Planner ticked, the units and semester move on a year and the lessons go to Past lessons, once', async () => {
  const p = await h.fresh(1366, {}, { 'gsp.newYear': { id: 'yr-made-up', from: '2026–27', dates: false } });
  await h.open(p, 'home');
  const done = await kvNow(p, 'yearsDone', v => Array.isArray(v) && v.includes('yr-made-up'));
  assert.deepEqual(done, ['yr-made-up']);
  const l1 = await h.lessonInDb(p, 'L1');
  assert.equal(l1.library, '2026–27'); assert.deepEqual(l1.slots, []); assert.equal(l1.taught, undefined);
  const units = await h.kvInDb(p, 'units');
  assert.equal(units.find(u => u.id === 'U1').start, '2027-08-30');
  const s = await h.kvInDb(p, 'setup');
  assert.equal(s.semStart, '2027-08-30'); assert.deepEqual(s.daysOff, []); assert.deepEqual(s.events, []);
  await until(p, () => [...document.querySelectorAll('.toast')].some(x => /6 lessons are in Past lessons under “2026–27”/.test(x.textContent)));
  // opened again, nothing moves twice; the current Planner sees the move as done
  await h.open(p, 'library/past');
  await new Promise(r => setTimeout(r, 800));
  assert.equal((await h.kvInDb(p, 'units')).find(u => u.id === 'U1').start, '2027-08-30');
  await p.goto(h.srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && P.L.lessons && P.L.lessons.length; }, { timeout: 20000 });
  await new Promise(r => setTimeout(r, 1000));
  assert.equal(await p.evaluate(() => window.__planner.L.units.find(u => u.id === 'U1').start), '2027-08-30');
  assert.equal(await p.evaluate(() => window.__planner.L.lessons.filter(l => l.library === '2026–27').length), 6);
  assert.deepEqual(p.errors, []); await p.ctx.close();
});
