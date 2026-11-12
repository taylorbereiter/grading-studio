// School resources: a page for the links, files and notes about a teacher's school. They are kept with the teacher's work, so they
// have to reach the folder and the take-home file and come back whole. The school, its addresses and its files here are made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openOwn, closeOwn, goTo, pickFile, answerDlg, pick } = require('./helpers/app');
const { gradingSeed } = require('./helpers/steady');
const { linkFolder, folderWait, folderRead, folderList, wipeBrowser, takeHome, openFile, bringIt } = require('./helpers/carry');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await closeOwn(); await browser.close(); });

const names = page => page.$$eval('#schList .schrow b', els => els.map(e => e.textContent));
const groups = page => page.$$eval('#schList .schhead h2', els => els.map(e => e.textContent));
const list = page => page.evaluate(() => window.__gs.schNow());
const until = async (page, fn, arg, ms = 8000) => { for (const t0 = Date.now(); ;) { if (await page.evaluate(fn, arg)) return; if (Date.now() - t0 > ms) throw new Error('waited too long for ' + fn); await new Promise(r => setTimeout(r, 50)); } };
const shown = (page, name) => until(page, n => [...document.querySelectorAll('#schList .schrow b')].some(b => b.textContent === n), name);
const fill = (page, sel, v) => page.$eval(sel, (e, v) => { e.value = v; }, v);
async function addLink(page, url, name, group, note) {
  await page.click('#vSchool [data-schadd="link"]'); await page.waitForSelector('#schUrl');
  await fill(page, '#schUrl', url); await fill(page, '#schName', name); await fill(page, '#schGroup', group || ''); await fill(page, '#schNote', note || '');
  await page.click('#dlgBox [data-ok]');
}
async function addFile(page, bytes, file, name, group) {
  const clean = await pickFile(page, '#schIn', bytes, file);
  await page.waitForSelector('#schName');
  if (name) await fill(page, '#schName', name);
  await fill(page, '#schGroup', group || '');
  await page.click('#dlgBox [data-ok]');
  await shown(page, name || file.replace(/\.[^.]+$/, ''));
  clean();
}
const PDF = new Uint8Array(Buffer.from('%PDF-1.4\n% a made-up bell schedule\n' + 'x'.repeat(3000) + '\n%%EOF\n'));
const menuDo = async (page, id, what) => { await page.click('[data-sch="' + id + '"] [data-km]'); await page.click('[data-sch="' + id + '"] [data-schdo="' + what + '"]'); };
const idOf = (page, name) => page.evaluate(n => window.__gs.schNow().items.find(i => i.name === n && !i.gone).id, name);

test('the School page: a link, a note and a file, in groups, kept after a reload and found from Find anything', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  assert.equal(await page.$eval('#rail [data-nav="school"] .rl', e => e.textContent), 'School');
  await page.click('#rail [data-nav="school"]');
  await page.waitForSelector('#vSchool:not([hidden]) .schnone');
  assert.equal(await page.title(), 'School resources · Grading Studio');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.school')), null, 'nothing is stored until something is added');
  assert.deepEqual((await page.evaluate(() => indexedDB.databases())).map(d => d.name).filter(n => /school/.test(n)), [], 'and no store for files is made');

  // what is typed has to be a web address, and only http or https
  await page.click('#vSchool [data-schadd="link"]'); await page.waitForSelector('#schUrl');
  for (const bad of ['javascript:alert(1)', 'handbook', 'data:text/html,hi', 'two words.org']) {
    await fill(page, '#schUrl', bad); await page.click('#dlgBox [data-ok]');
    assert.equal(await page.$eval('#schErr', e => e.hidden), false, bad + ' is refused');
  }
  await page.click('#dlgBox [data-cancel]');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.school')), null);

  await addLink(page, 'staff.example.org/handbook', 'Staff handbook', 'Handbook and policies', 'Assessment policy starts on page 31.');
  await shown(page, 'Staff handbook');
  await addLink(page, 'https://calendar.example.org/school', 'School calendar', 'Calendar and schedules');
  await shown(page, 'School calendar');
  await addLink(page, 'https://attendance.example.org', '', '');   // no name: the site's own
  await shown(page, 'attendance.example.org');
  await page.click('#vSchool [data-schadd="note"]'); await page.waitForSelector('#schNote');
  await page.click('#dlgBox [data-ok]');
  assert.equal(await page.$eval('#schErr', e => e.hidden), false, 'an empty note is not added');
  await fill(page, '#schName', 'Who to call'); await fill(page, '#schGroup', 'People and rooms'); await fill(page, '#schNote', 'Front office: ext. 100\nNurse: ext. 114');
  await page.click('#dlgBox [data-ok]'); await shown(page, 'Who to call');
  await addFile(page, PDF, 'Bell schedule 2026-27.pdf', 'Bell schedule', 'Calendar and schedules');

  assert.deepEqual(await groups(page), ['Calendar and schedules', 'Handbook and policies', 'People and rooms', 'Other']);
  assert.deepEqual(await names(page), ['Bell schedule', 'School calendar', 'Staff handbook', 'Who to call', 'attendance.example.org']);
  const link = await page.$eval('[data-sch] a.schopen', a => ({ href: a.href, target: a.target, rel: a.rel }));
  assert.deepEqual(await page.$$eval('#schList a.schopen', a => a.map(x => x.getAttribute('href'))), ['https://calendar.example.org/school', 'https://staff.example.org/handbook', 'https://attendance.example.org/']);
  assert.equal(link.target, '_blank'); assert.match(link.rel, /noopener/);
  assert.match(await page.$eval('#schList .schrow .schsub', e => e.textContent), /^PDF · \d+ KB$/);
  assert.match(await page.$eval('#schList .schfoot', e => e.textContent), /^5 things kept here, 1 file \(\d+ KB\)\. Only in this browser/);
  const s = await list(page), f = s.items.find(i => i.kind === 'file');
  assert.equal(f.file.size, PDF.length); assert.equal(f.file.name, 'Bell schedule 2026-27.pdf'); assert.match(f.file.hash, /^[0-9a-f]{64}$/);
  assert.deepEqual(await page.evaluate(() => window.__gs.schHave()), [f.file.hash], 'its bytes are kept under their hash');

  // the star keeps one at the top of the page and of its group; the group menu moves a group
  const cal = await idOf(page, 'School calendar');
  await page.click('[data-sch="' + cal + '"] [data-schpin]');
  await until(page, () => document.querySelectorAll('#schList .schpins .schchip').length === 1);
  assert.deepEqual((await names(page)).slice(0, 2), ['School calendar', 'Bell schedule']);
  await page.click('[data-schgroup="People and rooms"] .schhead [data-km]'); await page.click('[data-schgroup="People and rooms"] [data-schg="up"]');
  await until(page, () => document.querySelectorAll('#schList .schhead h2')[1].textContent === 'People and rooms');
  await page.click('[data-schgroup="People and rooms"] .schhead [data-km]'); await page.click('[data-schgroup="People and rooms"] [data-schg="rename"]');
  await answerDlg(page, { typed: 'People' });
  await until(page, () => document.querySelectorAll('#schList .schhead h2')[1].textContent === 'People');

  // changing one, deleting one, and Undo
  const hb = await idOf(page, 'Staff handbook');
  await menuDo(page, hb, 'edit'); await page.waitForSelector('#schName');
  assert.equal(await page.$eval('#schUrl', e => e.value), 'https://staff.example.org/handbook');
  await fill(page, '#schName', 'Staff handbook 2026'); await page.click('#dlgBox [data-ok]'); await shown(page, 'Staff handbook 2026');
  await menuDo(page, f.id, 'del');
  await until(page, () => !window.__gs.schNow().items.some(i => i.kind === 'file' && !i.gone));
  assert.deepEqual((await list(page)).items.find(i => i.id === f.id), { id: f.id, at: (await list(page)).items.find(i => i.id === f.id).at, gone: 1, file: { hash: f.file.hash, size: f.file.size } }, 'what is left says only that it was deleted, and which bytes to keep for now');
  await page.click('.toast .tact'); await shown(page, 'Bell schedule');
  assert.equal((await list(page)).items.find(i => i.id === f.id).file.name, 'Bell schedule 2026-27.pdf');

  // a reload: all of it is there, in the same order
  await page.reload(); await page.waitForSelector('#rail [data-nav="school"]'); await goTo(page, '#/school'); await shown(page, 'Bell schedule');
  assert.deepEqual(await groups(page), ['Calendar and schedules', 'People', 'Handbook and policies', 'Other']);
  assert.deepEqual(await names(page), ['School calendar', 'Bell schedule', 'Who to call', 'Staff handbook 2026', 'attendance.example.org']);
  assert.deepEqual(await page.evaluate(() => window.__gs.schHave()), [f.file.hash]);

  // Find anything: the page itself, and each thing by its name or by a word in its address or note
  await goTo(page, '#/');
  const find = async q => { await page.evaluate(() => window.__gs.openFind()); await page.waitForSelector('#findIn'); await page.type('#findIn', q); const r = await page.$$eval('#findList .frow', b => b.map(x => x.querySelector('b').textContent + ' | ' + x.querySelector('span').textContent)); return r; };
  assert.deepEqual(await find('nurse'), ['Who to call | Note · People']);
  await page.keyboard.press('Escape');
  assert.equal((await find('bell'))[0], 'Bell schedule | File · Calendar and schedules');
  await page.keyboard.press('Escape');
  assert.ok((await find('school res')).includes('School resources | Links, files and notes about your school'));
  await page.keyboard.press('Enter');
  await page.waitForSelector('#vSchool:not([hidden])');
  await page.evaluate(() => window.__gs.openFind()); await page.waitForSelector('#findIn');
  assert.equal(await page.$$eval('#findList .fcap', c => c.some(x => x.textContent === 'School resources')), false, 'with nothing typed, the list is not filled with them');
  await page.keyboard.press('Escape');

  // the page's own search
  assert.equal(await page.$eval('#schFind', e => e.hidden), true, 'no search box for a handful');
  assert.deepEqual(page.errors, []);
  await close();
});

test('two copies of the list are joined an item at a time, and the later change wins, a delete included', async () => {
  const { page, close } = await openApp(browser);
  const r = await page.evaluate(() => {
    const it = (id, at, x) => ({ id, at, kind: 'note', name: id, note: 'n', ...x });
    const here = { items: [it('a', 5), it('b', 9, { name: 'b here' }), it('c', 3), it('d', 8, { gone: 1 })], order: ['One', 'Two'], ot: 4 };
    const there = { items: [it('a', 5), it('b', 7, { name: 'b there' }), { id: 'c', at: 6, gone: 1 }, it('d', 2), it('e', 1)], order: ['Two', 'One'], ot: 6 };
    const m = window.__gs.schoolMerge(here, there), same = window.__gs.schoolMerge(m.out, there), none = window.__gs.schoolMerge(null, null);
    return { out: m.out.items.map(i => i.id + ':' + (i.gone ? 'gone' : i.name)), order: m.out.order, toA: m.toA, again: same.toA, none };
  });
  assert.deepEqual(r.out, ['a:a', 'b:b here', 'c:gone', 'd:gone', 'e:e']);
  assert.deepEqual(r.order, ['Two', 'One']);
  assert.equal(r.toA, true); assert.equal(r.again, false, 'joined once, there is nothing more to take');
  assert.deepEqual(r.none, { out: { items: [], order: [], ot: 0 }, toA: false });
  assert.deepEqual(await page.evaluate(() => ['example.org', ' https://Example.org/a b ', 'http://intranet/staff', 'ftp://example.org', 'mailto:a@example.org'].map(window.__gs.schUrl)), ['https://example.org/', '', 'http://intranet/staff', '', '']);
  await close();
});

test('with a folder linked, the list and each file go there, and a cleared browser gets them back', async () => {
  const { page, srv, close } = await openOwn();
  await goTo(page, '#/school');
  await addLink(page, 'https://staff.example.org/handbook', 'Staff handbook', 'Handbook and policies'); await shown(page, 'Staff handbook');
  await addFile(page, PDF, 'Bell schedule.pdf', '', 'Calendar and schedules');
  const hash = (await list(page)).items.find(i => i.file).file.hash;
  await linkFolder(page, 'Kept');
  assert.ok((await folderList(page, 'files')).includes(hash + '.dat'), 'the file is in the folder beside the papers');
  assert.equal(JSON.parse((await folderRead(page, 'library.json')).ls['gs.school']).items.length, 2);
  assert.match(await page.$eval('#schList .schfoot', e => e.textContent), /In this browser and your “Kept” folder\.$/);
  // one added after linking goes by itself
  const DOC = new Uint8Array(Buffer.from('A made-up duty roster. ' + 'y'.repeat(500)));
  await addFile(page, DOC, 'Duty roster.txt', '', '');
  await folderWait(page);
  const h2 = (await list(page)).items.find(i => i.name === 'Duty roster').file.hash;
  assert.ok((await folderList(page, 'files')).includes(h2 + '.dat'));
  assert.equal(JSON.parse((await folderRead(page, 'library.json')).ls['gs.school']).items.length, 3);

  await wipeBrowser(page, srv);
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.school')), null);
  await linkFolder(page, 'Kept');
  await goTo(page, '#/school'); await shown(page, 'Duty roster');
  assert.deepEqual(await names(page), ['Bell schedule', 'Staff handbook', 'Duty roster']);
  assert.deepEqual(await page.evaluate(() => window.__gs.schHave()), [hash, h2].sort(), 'the bytes came back too');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a take-home file carries the list and the files to another computer, and joins them with what is there', async () => {
  const a = await openApp(browser, { seed: gradingSeed() });
  await goTo(a.page, '#/school');
  await addLink(a.page, 'https://staff.example.org/handbook', 'Staff handbook', 'Handbook and policies'); await shown(a.page, 'Staff handbook');
  await addFile(a.page, PDF, 'Bell schedule.pdf', '', 'Calendar and schedules');
  const hash = (await list(a.page)).items.find(i => i.file).file.hash;
  const bytes = await takeHome(a.page);
  await a.close();

  const b = await openApp(browser);
  await goTo(b.page, '#/school');
  await addLink(b.page, 'https://help.example.org', 'IT help desk', 'Portals'); await shown(b.page, 'IT help desk');
  await goTo(b.page, '#/settings');
  const got = await openFile(b.page, bytes);
  assert.match(got.preview, /School resources added or changed on the other computer/);
  await bringIt(b.page);
  await goTo(b.page, '#/school'); await shown(b.page, 'Bell schedule');
  assert.deepEqual(await names(b.page), ['Bell schedule', 'Staff handbook', 'IT help desk'], 'both computers’ resources, each once');
  assert.deepEqual(await b.page.evaluate(() => window.__gs.schHave()), [hash]);
  // the same file again brings nothing new
  await goTo(b.page, '#/settings');
  assert.doesNotMatch((await openFile(b.page, bytes)).preview, /School resources/);
  assert.deepEqual(b.page.errors, []);
  await b.close();
});

test('Remove from this computer takes the school resources and their files too', async () => {
  const { page, close } = await openApp(browser);
  await goTo(page, '#/school');
  await addFile(page, PDF, 'Bell schedule.pdf', '', '');
  await goTo(page, '#/settings');
  const nav = page.waitForNavigation({ timeout: 60000 });
  await page.click('#removeBtn');
  await answerDlg(page, { typed: 'REMOVE' });
  await nav;
  await page.waitForFunction(() => window.__gs && window.__gs.schNow);
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.school')), null);
  assert.deepEqual((await page.evaluate(() => indexedDB.databases())).map(d => d.name).filter(n => /school/.test(n)), []);
  await close();
});
