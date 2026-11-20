// School in the new app (stage 6): links, files and notes in groups, for a class or the whole school, kept at the top, renamed,
// searched (Esc clears), deleted with Undo; the people a teacher works with as spots for roles. Kept in gs.school and the school
// files database, so the current app reads the same list and the same file. npm run next:browser. Every person here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady } = require('../../../test/helpers/app.js');
const { gradingSeed, PLAN_SETUP, STEADY } = require('../../../test/helpers/steady.js');
const { plantPlan } = require('./planseed.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p);
    const f = path.join(ROOT, p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}

let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

async function page(ctx, errors, width = 1440) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width, height: 900 });
  return p;
}
const ls = (p, k) => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
const TODAY = '2026-10-27';


const menu = async (p, trigger, n) => { await p.click(trigger); await p.waitForSelector('.pop [role="menuitem"]'); const it = await p.$$('.pop [role="menuitem"]'); await it[n].click(); };
const school = p => p.evaluate(() => JSON.parse(localStorage.getItem('gs.school') || 'null'));
const open = async (p, sel) => { await p.waitForFunction(sel => { const d = document.querySelector('dialog[open]'); return d && d.querySelector(sel) && d.contains(document.activeElement); }, { timeout: 10000 }, sel); };
const retype = async (p, sel, v) => { await p.$eval(sel, e => { e.focus(); e.select(); }); await p.keyboard.type(v); };

test('School: a link, a note and a file in groups, for a class, kept at the top, renamed, deleted with Undo; people in their spots; the current app reads the same', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed()); await plantPlan(p);
  await p.goto(srv.url + 'next/#/school');
  await p.waitForSelector('[data-school-page] [data-schpeople]', { timeout: 30000 });
  // the usual spots, empty, and nothing kept yet
  assert.equal((await p.$$('[data-schpeople] [data-schpadd]')).length, 6, 'five spots and Add someone');
  assert.ok(await p.$('[data-school-page] .empty'), 'the empty page says what School is for');

  // a link for a class, from Add > Link
  await menu(p, '[data-schadd]', 0);
  await open(p, '[data-schform="link"] input[data-schurl]');
  await p.type('input[data-schurl]', 'handbook.example.org/staff');
  await retype(p, 'input[data-schname]', 'Staff handbook');
  await p.type('input[data-schgroupin]', 'Handbook and policies');
  await p.click('.schcls .cb');
  await p.click('[data-schok]');
  await p.waitForFunction(() => document.querySelectorAll('[data-sch]').length === 1);
  let s = await school(p);
  assert.equal(s.items[0].url, 'https://handbook.example.org/staff'); assert.equal(s.items[0].kind, 'link'); assert.equal(s.items[0].group, 'Handbook and policies');
  assert.equal(s.items[0].cls.length, 1, 'for one class');
  // a note
  await menu(p, '[data-schadd]', 2);
  await open(p, '[data-schform="note"] input[data-schname]');
  await p.type('input[data-schname]', 'Who to call');
  await p.type('textarea[data-schnote]', 'Front office, extension 100');
  await p.click('[data-schok]');
  await p.waitForFunction(() => document.querySelectorAll('[data-sch]').length === 2);
  // a file through the file box
  const tmp = path.join(require('os').tmpdir(), 'gs-school-term-dates.txt'); fs.writeFileSync(tmp, 'Term 1: made-up dates');
  await (await p.$('[data-schin]')).uploadFile(tmp);
  await open(p, '[data-schform="file"] input[data-schname]');
  await p.click('[data-schok]');
  await p.waitForFunction(() => document.querySelectorAll('[data-sch]').length === 3, { timeout: 10000 });
  s = await school(p);
  const file = s.items.find(i => i.kind === 'file');
  assert.equal(file.name, 'gs-school-term-dates'); assert.equal(file.file.size, 21); assert.match(file.file.hash, /^[0-9a-f]{64}$/);
  // kept at the top
  const note = s.items.find(i => i.kind === 'note');
  await p.click('[data-sch="' + note.id + '"] [data-schpin]');
  await p.waitForSelector('[data-schchip="' + note.id + '"]');
  // the group renamed from its menu
  await menu(p, '[data-schgroup="Handbook and policies"] .schhead button', 0);
  await open(p, 'input');
    await retype(p, 'dialog.dlg input', 'Policies'); await p.keyboard.press('Enter');
  await p.waitForSelector('[data-schgroup="Policies"]');
  // the class chips show what is for one class
  assert.ok((await p.$$('.chips .chip')).length >= 2, 'Everything and the class');
  await (await p.$$('.chips .chip'))[1].click();
  await p.waitForFunction(() => document.querySelectorAll('[data-sch]').length === 1);
  await (await p.$$('.chips .chip'))[0].click();
  await p.waitForFunction(() => document.querySelectorAll('[data-sch]').length === 3);
  // deleted, and Undo in the toast brings it back
  await menu(p, '[data-sch="' + note.id + '"] [data-schmore]', 1);
  await p.waitForFunction(() => document.querySelectorAll('[data-sch]').length === 2);
  assert.ok((await school(p)).items.find(i => i.id === note.id).gone, 'kept as deleted, so the other computer deletes it too');
  await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(x => /Deleted/.test(x.textContent) && x.querySelector('button')));
  await p.evaluate(() => [...document.querySelectorAll('.toast')].find(x => /Deleted/.test(x.textContent)).querySelector('button').click());
  await p.waitForFunction(() => document.querySelectorAll('[data-sch]').length === 3);

  // a person in an empty spot, a wrong address caught, and the spots changed
  await p.click('[data-schpadd="Principal"]');
  await open(p, 'input[data-schpname]');
  await p.type('input[data-schpname]', 'Rowan Placeholder');
  await p.type('input[data-schpmail]', 'not an address');
  await p.click('[data-schpok]');
  await p.waitForSelector('[data-schpform] .err');
  await retype(p, 'input[data-schpmail]', 'rowan@example.org');
  await p.click('[data-schpok]');
  await p.waitForSelector('[data-schp] [data-schmail]');
  s = await school(p);
  assert.deepEqual(s.people.map(x => [x.role, x.name, x.email]), [['Principal', 'Rowan Placeholder', 'rowan@example.org']]);
  await p.click('[data-schroles]'); await open(p, 'textarea[data-schrolesin]');
  const ta = (await p.$('textarea[data-schrolesin]')) || (await p.$('[data-schrolesin] textarea'));
  await ta.click({ clickCount: 3 }); await p.keyboard.down('Control'); await p.keyboard.press('a'); await p.keyboard.up('Control'); await p.keyboard.press('Backspace');
  await p.keyboard.type('Principal'); await p.keyboard.press('Enter'); await p.keyboard.type('MYP coordinator');
  await p.click('[data-schrolesok]');
  await p.waitForFunction(() => document.querySelectorAll('[data-schpeople] .schprow').length === 2);
  assert.deepEqual((await school(p)).roles.list, ['Principal', 'MYP coordinator']);

  // the current app reads the same list and has the file's bytes
  const c = await page(ctx, errors);
  await c.goto(srv.url); await appReady(c);
  const cur = await c.evaluate(async () => ({ n: window.__gs.schNow().items.filter(i => !i.gone).length, people: window.__gs.schPeople().map(p => p.name), have: await window.__gs.schHave() }));
  assert.equal(cur.n, 3); assert.deepEqual(cur.people, ['Rowan Placeholder']); assert.deepEqual(cur.have, [file.file.hash]);
  await c.close();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('School: the search box shows once there are six things, and Esc clears it', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.evaluate(() => localStorage.setItem('gs.school', JSON.stringify({ items: ['Bell schedule', 'Portal', 'Forms', 'Room booking', 'Library', 'Lunch menu'].map((n, i) => ({ id: 'i' + i, at: 1, kind: 'link', name: n, url: 'https://example.org/' + i })), order: [], ot: 0 })));
  await p.goto(srv.url + 'next/#/school');
  await p.waitForSelector('input[data-schq]', { timeout: 30000 });
  await p.click('input[data-schq]'); await p.keyboard.type('bell');
  await p.waitForFunction(() => document.querySelectorAll('[data-sch]').length === 1);
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => document.querySelectorAll('[data-sch]').length === 6);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Help: an answer at its own address, search with Esc, where things live, what is new, and answers in the command bar', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.goto(srv.url + 'next/#/help/open-work');
  await p.waitForSelector('#hlpa-open_work', { timeout: 30000 });
  const n = (await p.$$('[data-hlp]')).length;
  assert.ok(n > 60, 'every answer is here: ' + n);
  assert.match(await p.$eval('#hlpa-open_work', e => e.textContent), /\S/);
  await p.click('input[data-hlpq]'); await p.keyboard.type('attendance');
  await p.waitForFunction(n => document.querySelectorAll('[data-hlp]').length < n, {}, n);
  await p.keyboard.press('Escape');
  await p.waitForFunction(n => document.querySelectorAll('[data-hlp]').length === n, {}, n);
  assert.ok((await p.$$('[data-hlpmap] tr')).length > 20, 'where everything lives now');
  await p.click('[data-hlpnewopen]');
  await p.waitForSelector('.hlpnew li', { timeout: 10000 });
  await p.click('input[data-hlpq]');
  await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control');
  await p.waitForSelector('dialog.cmd[open] [role="combobox"]:focus');
  const question = await p.$eval('[data-hlp="anchor_papers"]', el => el.textContent.trim());
  await p.keyboard.type('anchor papers');
  // The lesson-search command also echoes these words while Help commands are loading.
  await p.waitForFunction(question => {
    const selected = document.querySelector('dialog.cmd[open] [role="option"][aria-selected="true"]');
    return selected && selected.textContent.trim() === question;
  }, { timeout: 10000 }, question);
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => location.hash === '#/help/anchor_papers' &&
    document.querySelector('#hlpa-anchor_papers p'), { timeout: 10000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});
