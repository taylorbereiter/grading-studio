// Stage 8, slice E2: lesson packs and lesson files dropped on the app (rows E2-001, E2-002, E2-003, E2-004, E2-013, E2-067,
// E2-068, E2-069, E2-070, E2-071, E2-097, E2-106 of rebuild/audit/gaps.md). Made-up lessons and files only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), fflate = require('fflate');
const { harness } = require('./e2harness.js');
const h = harness(before, after);
const until = (p, fn, ...a) => p.waitForFunction(fn, { timeout: 10000 }, ...a);
const u8 = s => fflate.strToU8(typeof s === 'string' ? s : JSON.stringify(s));
const slide = (id, title) => ({ id, layout: 'title', title, body: '', notes: '', fmt: 2 });
// A made-up pack: two old decks with a handout each, and a unit plan link for a unit already here (U3).
function pack(name) {
  const z = { 'pack.json': u8({ kind: 'grading-studio-lesson-pack', name, lessons: [
    { id: 'P1', title: 'Old deck: setting', slots: [], slides: [slide('P1s', 'Setting')], files: [{ name: 'Setting handout.pdf', path: 'files/p1.pdf', type: 'application/pdf' }] },
    { id: 'P2', title: 'Old deck: mood', slots: [], slides: [slide('P2s', 'Mood')], files: [{ name: 'Mood cards.pdf', path: 'files/p2.pdf', type: 'application/pdf' }] }],
    units: [{ id: 'U3', atlas: 'https://plans.example.com/u3', files: [] }] }),
    'files/p1.pdf': u8('%PDF-1.4 made up'), 'files/p2.pdf': u8('%PDF-1.4 made up too') };
  const f = path.join(os.tmpdir(), 'gs-e2-pack-' + process.pid + '-' + name.replace(/\W/g, '') + '.zip'); fs.writeFileSync(f, fflate.zipSync(z)); return f;
}
const dropFiles = (p, files) => p.evaluate(fs => { const dt = new DataTransfer(); for (const [n, b64, type] of fs) { const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < a.length; i++) a[i] = bin.charCodeAt(i); dt.items.add(new File([a], n, { type })); }
  const el = document.querySelector('main'); el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); },
  files.map(([n, buf, type]) => [n, Buffer.from(buf).toString('base64'), type]));

test('E2-003 E2-071 E2-004 E2-106 E2-001 E2-002: a lesson pack imported from Past lessons: its lessons under the pack’s name with their files, found by a file’s name, a unit link filled in, kept as the current Planner keeps them', async () => {
  const p = await h.fresh();
  await h.open(p, 'library/past');
  await p.waitForSelector('[data-pack-import]');
  const f = pack('Old decks 2025');
  const [fc] = await Promise.all([p.waitForFileChooser(), p.click('[data-pack-import]')]); await fc.accept([f]);
  await until(p, () => document.querySelectorAll('[data-pack="Old decks 2025"] a.main').length === 2);
  assert.deepEqual(await p.$$eval('[data-pack="Old decks 2025"] a.main b', b => b.map(x => x.textContent)), ['Old deck: mood', 'Old deck: setting']);
  assert.match(await p.$eval('[data-pack="Old decks 2025"] h2', e => e.textContent), /2 lessons/);
  assert.equal(await p.$$eval('[data-pack] [data-libf]', b => b.length), 2);
  // found by a file's name
  await p.type('[data-focus="find-lesson"] input, input[data-focus="find-lesson"]', 'cards');
  await until(p, () => document.querySelectorAll('[data-pack] a.main').length === 1);
  assert.equal(await p.$eval('[data-pack] a.main b', b => b.textContent), 'Old deck: mood');
  // a file opens
  await p.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(u); return null; }; });
  await p.click('[data-pack] [data-libf]');
  await until(p, () => window.__opened.length === 1);
  assert.equal((await h.kvInDb(p, 'units')).find(u => u.id === 'U3').atlas, 'https://plans.example.com/u3');
  // the same pack again brings nothing twice
  const [fc2] = await Promise.all([p.waitForFileChooser(), p.click('[data-pack-import]')]); await fc2.accept([f]);
  await until(p, () => [...document.querySelectorAll('.toast')].some(x => /all here already/.test(x.textContent)));
  await p.goto(h.srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && P.L.lessons && P.L.lessons.length; }, { timeout: 20000 });
  assert.deepEqual(await p.evaluate(() => window.__planner.L.lessons.filter(l => l.library === 'Old decks 2025').map(l => l.id + ':' + l.files.length).sort()), ['P1:1', 'P2:1']);
  assert.deepEqual(p.errors, []); await p.ctx.close(); fs.unlinkSync(f);
});

test('E2-068 E2-067 E2-069: a lesson pack, a lesson file and a .lesson.json dropped anywhere come in', async () => {
  const p = await h.fresh();
  await h.open(p, 'home');
  const f = pack('Dropped decks');
  await dropFiles(p, [['Dropped decks.zip', fs.readFileSync(f), 'application/zip']]);
  let l; for (let k = 0; k < 50 && !l; k++) { l = await h.lessonInDb(p, 'P1'); if (!l) await new Promise(r => setTimeout(r, 100)); }
  assert.equal(l.library, 'Dropped decks');
  // a lesson file (.gslesson) opens as a lesson of its own
  const share = fflate.zipSync({ 'gslesson.json': u8({ kind: 'grading-studio-lesson', version: 1, lesson: { id: 'S1', title: 'A colleague’s lesson', slots: [], slides: [slide('S1s', 'Hello')] }, files: [] }) });
  await dropFiles(p, [['A colleague.gslesson', share, 'application/zip']]);
  await p.waitForFunction(() => /^#\/lesson\//.test(location.hash), { timeout: 10000 });
  assert.equal((await h.lessonInDb(p, await p.evaluate(() => location.hash.split('/')[2]))).title, 'A colleague’s lesson');
  // a .lesson.json
  await h.open(p, 'home');
  await dropFiles(p, [['Exit tickets.lesson.json', u8({ id: 'J1', title: 'Exit tickets', slots: [], slides: [slide('J1s', 'Exit')] }), 'application/json']]);
  await p.waitForFunction(() => location.hash === '#/lesson/J1', { timeout: 10000 });
  assert.deepEqual(p.errors, []); await p.ctx.close(); fs.unlinkSync(f);
});

test('E2-013 E2-070 E2-097: Import… on the week’s menu and in the command bar takes a lesson pack too', async () => {
  const p = await h.fresh();
  await h.open(p, 'calendar/class');
  await p.click('main [data-focus="week-menu"]'); await p.waitForSelector('.pop [role="menuitem"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(b => b.textContent.includes('Import')).click());
  await p.waitForSelector('dialog.sheet [data-import]');
  const f = pack('Week decks');
  await (await p.$('dialog.sheet [data-import]')).uploadFile(f);
  let l; for (let k = 0; k < 50 && !l; k++) { l = await h.lessonInDb(p, 'P2'); if (!l) await new Promise(r => setTimeout(r, 100)); }
  assert.equal(l.library, 'Week decks');
  await until(p, () => !document.querySelector('dialog.sheet[open]'));
  await h.open(p, 'home');
  await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control');
  await p.waitForSelector('dialog.cmd[open] input');
  await p.keyboard.type('import');
  await until(p, () => [...document.querySelectorAll('dialog.cmd [role="option"]')].some(o => o.textContent.includes('Import')));
  await p.keyboard.press('Enter');
  await p.waitForSelector('dialog.sheet [data-import]', { timeout: 10000 });
  assert.equal(await p.evaluate(() => location.hash), '#/calendar/import');
  assert.deepEqual(p.errors, []); await p.ctx.close(); fs.unlinkSync(f);
});
