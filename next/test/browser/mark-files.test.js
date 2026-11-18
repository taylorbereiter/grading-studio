// A student's files changed on the new marking screen (stage 4, part d): a file added, one replaced, one removed and brought back,
// one moved to another student with her comment, pages turned, one left out, each one step on the undo list, and the current app opens the
// download with the same files where the new app left them.
// npm run next:browser. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip } = require('../../../test/helpers/app.js');
const { standardFiles, zipOf, makePaper } = require('../../../test/helpers/fixtures.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');

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

let browser, srv, zip, dir;
before(async () => { srv = await serveSite(); browser = await launch(); zip = zipOf(await standardFiles()); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-files-')); });
after(async () => { await browser.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
const KEY = 'Bram Sample';
// the paper is drawn again after each change, so the ⋯ is found and pressed in one step once it is ready, then the item by its words
const menuDo = async (p, file, label) => {
  await p.waitForFunction(f => { const b = window.__mark.ready && document.querySelector('[data-fmenu="' + f + '"]'); if (b) b.click(); return !!b; }, { timeout: 30000 }, file);
  await p.waitForSelector('.pop [role="menuitem"]');
  const ok = await p.evaluate(l => { const it = [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => e.textContent.includes(l)); if (it) it.click(); return !!it; }, label);
  if (!ok) throw new Error('no ' + label);
};
const has = (p, where, file) => p.waitForFunction((k, where, file) => (window.__mark.state().batch.students.find(s => s.key === k)[where] || []).some(f => f.path === file), { timeout: 30000 }, KEY, where, file);

test('a file added, replaced, removed and brought back in the new app is where the current app finds it', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, zip);
  const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();
  const late = path.join(dir, 'Late page.pdf'); fs.writeFileSync(late, await makePaper({ title: 'A late page' }));
  const fixed = path.join(dir, 'Essay fixed.pdf'); fs.writeFileSync(fixed, await makePaper({ title: 'Bram Sample essay, corrected', pages: 2 }));
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  const i = await p.evaluate(k => window.__mark.state().batch.students.findIndex(s => s.key === k), KEY);
  await p.click('[data-st="' + i + '"]');
  await p.waitForFunction(i => window.__mark.state().cur === i && window.__mark.ready, { timeout: 60000 }, i);
  await p.waitForSelector('[data-addmenu]', { timeout: 60000 });
  // Add > A file…
  const addDo = async label => { await p.click('[data-addmenu]'); await p.waitForSelector('.pop [role="menuitem"]'); for (const it of await p.$$('.pop [role="menuitem"]')) if ((await it.evaluate(e => e.textContent)).includes(label)) return it.click(); throw new Error('no ' + label); };
  const [c1] = await Promise.all([p.waitForFileChooser(), addDo('Add a file')]);
  await c1.accept([late]);
  await has(p, 'files', KEY + '/Late page.pdf');
  // Replace… the essay with a corrected copy, after the check
  await p.waitForSelector('[data-fmenu="' + KEY + '/Essay.pdf"]', { timeout: 30000 });
  const [c2] = await Promise.all([p.waitForFileChooser(), menuDo(p, KEY + '/Essay.pdf', 'Replace')]);
  await c2.accept([fixed]);
  await p.waitForSelector('.dlg [data-ok]'); await p.click('.dlg [data-ok]');
  await has(p, 'gone', KEY + '/Essay.pdf');
  // Remove the notes, and Undo puts them back; remove them again, and Bring back
  await p.waitForSelector('[data-fmenu="' + KEY + '/Extra notes.pdf"]', { timeout: 30000 });
  await menuDo(p, KEY + '/Extra notes.pdf', 'Remove');
  await has(p, 'gone', KEY + '/Extra notes.pdf');
  await p.click('[data-undo]');
  await has(p, 'files', KEY + '/Extra notes.pdf');
  await p.waitForSelector('[data-fmenu="' + KEY + '/Extra notes.pdf"]', { timeout: 30000 });
  await menuDo(p, KEY + '/Extra notes.pdf', 'Remove');
  // the paper opens again after each change, so press once it has
  await p.waitForFunction(f => { const b = window.__mark.ready && document.querySelector('[data-back="' + f + '"]'); if (b) b.click(); return !!b; }, { timeout: 30000 }, KEY + '/Extra notes.pdf');
  await has(p, 'files', KEY + '/Extra notes.pdf');
  const now = await p.evaluate(k => { const st = window.__mark.state().batch.students.find(s => s.key === k); return { files: st.files.map(f => f.path).sort(), gone: (st.gone || []).map(f => f.path).sort() }; }, KEY);
  assert.deepEqual(now.files, [KEY + '/Essay fixed.pdf', KEY + '/Extra notes.pdf', KEY + '/Late page.pdf']);
  assert.deepEqual(now.gone, [KEY + '/Essay.pdf']);
  // Move to… another student, with her comment: asked, moved, Undo takes it back, moved again
  const OTHER = await p.evaluate(k => window.__mark.state().batch.students.find(s => s.key !== k && !s.grade.comment && !s.grade.points && !s.grade.status && !(s.grade.rubric || []).some(x => x != null)).key, KEY);
  await p.click('.mk-cmt'); await p.keyboard.type('About the late page'); await p.click('.mk-paper');
  const moveLate = async () => {
    await p.waitForFunction(f => window.__mark.ready && !!document.querySelector('[data-fmenu="' + f + '"]'), { timeout: 30000 }, KEY + '/Late page.pdf');
    await menuDo(p, KEY + '/Late page.pdf', 'Move to');
    await p.waitForSelector('[data-mvto="' + OTHER + '"]');
    // the find box narrows the list
    const nm = await p.$eval('[data-mvto="' + OTHER + '"]', e => e.textContent.trim()), all = (await p.$$('[data-mvto]')).length;
    await p.type('.dlg input', nm.slice(0, 4));
    await p.waitForFunction(n => document.querySelectorAll('[data-mvto]').length < n, {}, all);
    await p.click('[data-mvto="' + OTHER + '"]');
    await p.waitForSelector('[data-take]'); await p.click('[data-take]');
    await p.waitForFunction((o, f) => window.__mark.state().batch.students.find(s => s.key === o).files.some(x => x.path === f), { timeout: 30000 }, OTHER, KEY + '/Late page.pdf');
  };
  await moveLate();
  assert.equal(await p.evaluate(o => window.__mark.state().batch.students.find(s => s.key === o).grade.comment, OTHER), 'About the late page', 'the comment went with it');
  await p.click('[data-undo]');
  await has(p, 'files', KEY + '/Late page.pdf');
  assert.equal(await p.evaluate(k => window.__mark.state().batch.students.find(s => s.key === k).grade.comment, KEY), 'About the late page', 'and Undo brings it back');
  await moveLate();
  // Turn all pages of the corrected essay, then the first page back to the left from its corner
  const FIXED = KEY + '/Essay fixed.pdf', rot = () => p.evaluate((k, f) => JSON.parse(JSON.stringify(window.__mark.state().batch.students.find(s => s.key === k).files.find(x => x.path === f).rot || {})), KEY, FIXED);
  await p.waitForFunction(f => window.__mark.ready && !!document.querySelector('[data-fmenu="' + f + '"]'), { timeout: 30000 }, FIXED);
  await menuDo(p, FIXED, 'Turn all pages');
  await p.waitForFunction(async (k, f) => { const x = window.__mark.state().batch.students.find(s => s.key === k).files.find(x => x.path === f); return x.rot && x.rot[0] === 90 && x.rot[1] === 90; }, { timeout: 30000 }, KEY, FIXED);
  await p.waitForFunction(f => { const c = window.__mark.ready && document.querySelector('canvas[data-page="' + f + '|0"]'), b = c && c.parentNode.querySelector('[data-rot="-1"]'); if (b) b.click(); return !!b; }, { timeout: 30000 }, FIXED);
  await p.waitForFunction((k, f) => { const x = window.__mark.state().batch.students.find(s => s.key === k).files.find(x => x.path === f); return x.rot && !x.rot[0] && x.rot[1] === 90; }, { timeout: 30000 }, KEY, FIXED);
  const turned = await rot();
  // Leave out the notes, from the menu on their header
  await p.waitForFunction(f => window.__mark.ready && !!document.querySelector('[data-fmenu="' + f + '"]'), { timeout: 30000 }, KEY + '/Extra notes.pdf');
  await menuDo(p, KEY + '/Extra notes.pdf', 'Leave out');
  await p.waitForSelector('[data-inout]', { timeout: 30000 });
  const out = await p.evaluate(k => { const st = window.__mark.state().batch.students.find(s => s.key === k); return { inc: st.inc || null, layout: st.layout || null }; }, KEY);
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m2 = await page(ctx, errors);
  await m2.goto(srv.url); await appReady(m2);
  await m2.evaluate(id => window.__gs.reopenKept(id), id);
  await m2.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  const was = await m2.evaluate((k, o) => { const b = window.__gs.state().batch, st = b.students.find(s => s.key === k), ot = b.students.find(s => s.key === o); return { files: st.files.map(f => f.path).sort(), gone: (st.gone || []).map(f => f.path).sort(), removed: b.removed, moved: b.moved, other: ot.files.map(f => f.path), comment: [st.grade.comment, ot.grade.comment], inc: st.inc || null, layout: st.layout || null }; }, KEY, OTHER);
  assert.deepEqual({ files: was.files, gone: was.gone }, { files: now.files.filter(f => !f.endsWith('Late page.pdf')), gone: now.gone }, 'the current app finds the same files');
  assert.ok(was.other.includes(KEY + '/Late page.pdf'), 'the moved file is with the other student');
  assert.equal(was.moved[KEY + '/Late page.pdf'], OTHER);
  assert.deepEqual(was.comment, ['', 'About the late page'], 'and so is the comment');
  assert.deepEqual({ inc: was.inc, layout: was.layout }, out, 'the notes are left out there too');
  assert.deepEqual(turned, { 1: 90 });
  assert.deepEqual(await m2.evaluate((k, f) => window.__gs.state().batch.students.find(s => s.key === k).files.find(x => x.path === f).rot, KEY, FIXED), turned, 'and the pages are turned the same');
  assert.equal(was.removed[KEY + '/Essay.pdf'].by, KEY + '/Essay fixed.pdf', 'and knows which file replaced which');
  assert.ok(was.removed[KEY + '/Extra notes.pdf'].back, 'and that the notes were brought back');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('text pasted for a student with nothing turned in is the same page the current app makes, and the current app finds it', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, zip);
  const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  const who = await p.evaluate(() => { const b = window.__mark.state().batch, i = b.students.findIndex(s => !s.files.length); return { i, key: b.students[i].key }; });
  await p.click('[data-st="' + who.i + '"]');
  await p.waitForSelector('[data-addmenu]', { timeout: 60000 });
  await p.click('[data-addmenu]'); await p.waitForSelector('.pop [role="menuitem"]');
  for (const it of await p.$$('.pop [role="menuitem"]')) if ((await it.evaluate(e => e.textContent)).includes('Pasted text')) { await it.click(); break; }
  await p.waitForSelector('[data-pttext]');
  const TEXT = 'My answer to question one.\n\nThe second part, sent late by email.';
  await p.click('[data-pttext]'); await p.keyboard.type(TEXT);
  await p.click('.dlg [data-ok]');
  const PATH = who.key + '/Emailed work.pdf';
  await p.waitForFunction((k, f) => window.__mark.state().batch.students.find(s => s.key === k).files.some(x => x.path === f && x.numPages), { timeout: 30000 }, who.key, PATH);
  const made = await p.evaluate((k, f) => btoa(String.fromCharCode(...window.__mark.state().batch.students.find(s => s.key === k).files.find(x => x.path === f).data)), who.key, PATH);
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m2 = await page(ctx, errors);
  await m2.goto(srv.url); await appReady(m2);
  await m2.evaluate(id => window.__gs.reopenKept(id), id);
  await m2.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  const was = await m2.evaluate(async (k, f, text) => {
    const st = window.__gs.state().batch.students.find(s => s.key === k), x = st.files.find(y => y.path === f), again = await window.__gs.pasteTextPdf('Emailed work', text);
    return { kept: !!x && btoa(String.fromCharCode(...x.data)), again: btoa(String.fromCharCode(...again.bytes)) };
  }, who.key, PATH, TEXT);
  assert.equal(was.kept, made, 'the current app finds the page');
  assert.equal(made, was.again, 'and it is the page the current app makes from the same text');
  assert.deepEqual(errors, []);
  await ctx.close();
});
