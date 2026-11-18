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
  // pressed again until its menu shows: a redraw as the papers are read in the background can close a menu just opened
  await p.waitForFunction(f => { if (document.querySelector('.pop [role="menuitem"]')) return true; const b = window.__mark.ready && document.querySelector('[data-fmenu="' + f + '"]'); if (b) b.click(); return false; }, { timeout: 30000, polling: 400 }, file);
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
  // the papers are read in the background as they open; what that changes (a file left out by itself) is settled first
  await p.waitForFunction(i => window.__mark.state().cur === i && window.__mark.ready && window.__mark.read, { timeout: 60000 }, i);
  await p.waitForSelector('[data-addmenu]', { timeout: 60000 });
  // Add > A file…
  const addDo = async label => { await p.waitForFunction(() => { if (document.querySelector('.pop [role="menuitem"]')) return true; const b = document.querySelector('[data-addmenu]'); if (b) b.click(); return false; }, { timeout: 30000, polling: 400 }); const ok = await p.evaluate(l => { const it = [...document.querySelectorAll('.pop [role="menuitem"]')].find(e => e.textContent.includes(l)); if (it) it.click(); return !!it; }, label); if (!ok) throw new Error('no ' + label); };
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
  // Once the papers are read, the notes, with no marks while other papers have some, are left out by themselves (docIn), as in the
  // current app: Bring back puts them in, and Leave out, from the menu on their header, takes them out for good
  await p.waitForFunction(() => window.__mark.read, { timeout: 60000 });
  await p.waitForFunction(() => { const b = window.__mark.ready && document.querySelector('[data-inout]'); if (b) b.click(); return !!b; }, { timeout: 30000 });
  await p.waitForFunction(k => (window.__mark.state().batch.students.find(s => s.key === k).inc || {})[k + '/Extra notes.pdf'] === true, { timeout: 30000 }, KEY);
  await menuDo(p, KEY + '/Extra notes.pdf', 'Leave out');
  await p.waitForFunction(k => (window.__mark.state().batch.students.find(s => s.key === k).inc || {})[k + '/Extra notes.pdf'] === false, { timeout: 30000 }, KEY);
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
  await p.waitForFunction(() => { if (document.querySelector('.pop [role="menuitem"]')) return true; const b = document.querySelector('[data-addmenu]'); if (b) b.click(); return false; }, { timeout: 30000, polling: 400 });
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

test('pages arranged in the new app, and a page taken out, are where the current app finds them', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, zip);
  const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  const i = await p.evaluate(k => window.__mark.state().batch.students.findIndex(s => s.key === k), KEY);
  await p.click('[data-st="' + i + '"]');
  await p.waitForFunction(i => window.__mark.state().cur === i && window.__mark.ready, { timeout: 60000 }, i);
  const ESSAY = KEY + '/Essay.pdf', NOTES = KEY + '/Extra notes.pdf';
  await p.waitForFunction(() => window.__mark.read, { timeout: 60000 });
  const st = () => p.evaluate(k => { const s = window.__mark.state().batch.students.find(x => x.key === k); return JSON.parse(JSON.stringify({ layout: s.layout || null, rot: Object.fromEntries(s.files.map(f => [f.path, f.rot || {}])) })); }, KEY);
  const mine = L => L && L.map(d => ({ name: d.name, pages: d.pages.filter(([q]) => q === ESSAY || q === NOTES) }));
  await p.waitForFunction(() => { const b = window.__mark.ready && document.querySelector('[data-arrange]'); if (b) b.click(); return !!b; }, { timeout: 30000 });
  await p.waitForSelector('.mk-arr [data-apg="' + NOTES + '|0"]');
  // both files into one, the notes first (picked, then the ← key), the essay turned (R), and the file named
  await p.click('.mk-arr [data-acombine]');
  await p.click('.mk-arr [data-apg="' + NOTES + '|0"]');
  assert.match(await p.$eval('.mk-arr .arrbar [role=status]', e => e.textContent), /1 page picked/);
  await p.keyboard.press('ArrowLeft');
  await p.click('.mk-arr [data-apg="' + ESSAY + '|0"]');
  await p.keyboard.press('r');
  const nm = await p.$('.mk-arr [data-aname="0"]'); await nm.click(); await p.keyboard.down('Control'); await p.keyboard.press('a'); await p.keyboard.up('Control'); await nm.type('Both');
  await p.click('.mk-arr [data-asave]');
  await p.waitForFunction((k, f) => { const s = window.__mark.state().batch.students.find(x => x.key === k); return s.layout && (s.files.find(x => x.path === f).rot || {})[0] === 90; }, { timeout: 30000 }, KEY, ESSAY);
  const saved = await st();
  assert.deepEqual(mine(saved.layout), [{ name: 'Both.pdf', pages: [[NOTES, 0], [ESSAY, 0]] }], 'one file, the notes first');
  // the turn is a step of its own after the arranging, as in the current app: two undos put it all back, two redos make it again
  await p.click('[data-undo]');
  await p.waitForFunction((k, f) => !(window.__mark.state().batch.students.find(x => x.key === k).files.find(x => x.path === f).rot || {})[0], { timeout: 30000 }, KEY, ESSAY);
  await p.click('[data-undo]');
  await p.waitForFunction(k => !window.__mark.state().batch.students.find(x => x.key === k).layout, { timeout: 30000 }, KEY);
  const redo = async () => { await p.evaluate(() => document.querySelector('.mk-paper').focus()); await p.keyboard.down('Control'); await p.keyboard.press('y'); await p.keyboard.up('Control'); };
  await redo(); await p.waitForFunction(k => !!window.__mark.state().batch.students.find(x => x.key === k).layout, { timeout: 30000 }, KEY);
  await redo();
  await p.waitForFunction((k, f) => { const s = window.__mark.state().batch.students.find(x => x.key === k); return s.layout && (s.files.find(x => x.path === f).rot || {})[0] === 90; }, { timeout: 30000 }, KEY, ESSAY);
  assert.deepEqual(await st(), saved, 'redo makes the same paper');
  // the × on the notes page takes it out; Arrange pages shows it in the tray, and it waits below the paper, with Bring back
  await p.waitForFunction(f => { const c = window.__mark.ready && document.querySelector('canvas[data-page="' + f + '|0"]'), b = c && c.parentNode.querySelector('[data-pgout]'); if (b) b.click(); return !!b; }, { timeout: 30000 }, NOTES);
  await p.waitForFunction((k, f) => !window.__mark.state().batch.students.find(x => x.key === k).layout.some(d => d.pages.some(([q]) => q === f)), { timeout: 30000 }, KEY, NOTES);
  assert.deepEqual(mine((await st()).layout), [{ name: 'Both.pdf', pages: [[ESSAY, 0]] }]);
  await p.waitForFunction(() => { const b = window.__mark.ready && document.querySelector('[data-arrange]'); if (b) b.click(); return !!b; }, { timeout: 30000 });
  await p.waitForSelector('.mk-arr .acol[data-where="tray"] [data-apg="' + NOTES + '|0"]');
  await p.click('.mk-arr .arrfoot .grp:last-child button');   // Cancel
  await p.waitForFunction(() => !document.querySelector('.mk-arr'));
  await p.waitForFunction(f => { const b = window.__mark.ready && document.querySelector('[data-backpg="' + f + '|0"]'); if (b) b.click(); return !!b; }, { timeout: 30000 }, NOTES);
  await p.waitForFunction((k, f) => window.__mark.state().batch.students.find(x => x.key === k).layout.some(d => d.pages.some(([q]) => q === f)), { timeout: 30000 }, KEY, NOTES);
  // no file left holds a page of the notes, so it comes back as a file of its own, as in the current app (bringPageBack)
  const now = await st();
  assert.deepEqual(mine(now.layout), [{ name: 'Both.pdf', pages: [[ESSAY, 0]] }, { name: 'Extra notes.pdf', pages: [[NOTES, 0]] }]);
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m2 = await page(ctx, errors);
  await m2.goto(srv.url); await appReady(m2);
  await m2.evaluate(id => window.__gs.reopenKept(id), id);
  await m2.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  const was = await m2.evaluate(k => { const s = window.__gs.state().batch.students.find(x => x.key === k); return JSON.parse(JSON.stringify({ layout: s.layout || null, rot: Object.fromEntries(s.files.map(f => [f.path, f.rot || {}])) })); }, KEY);
  assert.deepEqual(was, now, 'the current app finds the same paper, turned the same');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// A paper marked in another app (as test/imported-marks.test.js makes it): ink, highlights, typed text, a sticky note, a box, a line and a stamp.
async function markedPaper() {
  const { PDFDocument, PDFName, PDFString, PDFHexString } = require('pdf-lib');
  const doc = await PDFDocument.load(await makePaper({ title: 'Rivers', lines: ['A made-up paragraph about a river and a town.', 'Another made-up line of the essay.'] })), ctx = doc.context;
  const red = [0.8, 0.1, 0.1], add = o => ctx.register(ctx.obj({ Type: 'Annot', F: 4, ...o }));
  const annots = [
    add({ Subtype: 'Ink', Rect: [100, 500, 220, 560], C: red, InkList: [[100, 520, 140, 560, 180, 500, 220, 540]], BS: { W: 2 } }),
    add({ Subtype: 'Highlight', Rect: [72, 600, 300, 614], C: [1, 0.9, 0.3], QuadPoints: [72, 614, 300, 614, 72, 600, 300, 600] }),
    add({ Subtype: 'Highlight', Rect: [72, 580, 250, 594], C: [1, 0.9, 0.3], QuadPoints: [72, 594, 250, 594, 72, 580, 250, 580], Contents: PDFHexString.fromText('Which chapter is this from?') }),
    add({ Subtype: 'FreeText', Rect: [320, 400, 520, 430], DA: PDFString.of('/Helv 14 Tf 0.8 0.1 0.1 rg'), Contents: PDFHexString.fromText('Good topic sentence!') }),
    add({ Subtype: 'Text', Rect: [500, 700, 520, 720], C: [0.4, 0.6, 0.9], Contents: PDFHexString.fromText('9.5/12 = 79%') }),
    add({ Subtype: 'Square', Rect: [300, 300, 400, 340], C: red, BS: { W: 1.5 } }),
    add({ Subtype: 'Line', Rect: [80, 200, 300, 260], C: red, L: [80, 260, 300, 200] }),
    add({ Subtype: 'Stamp', Rect: [400, 100, 520, 140], Name: PDFName.of('Approved') }),
  ];
  doc.getPage(0).node.set(PDFName.of('Annots'), ctx.obj(annots));
  return doc.save();
}

test('marks from another app made editable in the new app are the marks the current app makes, and Put back puts them back', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const z = zipOf({ 'Aria Testwell/Essay.pdf': await markedPaper(), 'Bram Sample/Essay.pdf': await markedPaper(), 'Cleo Madeup/Essay.pdf': await makePaper({ title: 'Plain' }) });
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, z, 'Imported.zip');
  const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  const A = 'Aria Testwell', B = 'Bram Sample';
  const ix = k => p.evaluate(k => window.__mark.state().batch.students.findIndex(s => s.key === k), k);
  const marksOf = (pg, k) => pg.evaluate(k => { const b = (window.__mark || window.__gs).state().batch, f = b.students.find(s => s.key === k).files[0]; return JSON.parse(JSON.stringify({ marks: f.marks[0] || [], imp: f.imp || null, impNo: !!f.impNo })); }, k);
  await p.click('[data-st="' + await ix(A) + '"]');
  await p.waitForFunction(() => { const n = document.querySelector('.mk-impnote'); return n && /papers in this download/.test(n.textContent); }, { timeout: 60000 });
  assert.match(await p.$eval('.mk-impnote', n => n.textContent), /This paper has 7 marks from another app.*2 papers in this download/);
  // Make all of them editable: the dialog reads every paper and makes them hers at once
  await p.click('.mk-impnote [data-imp="all"]');
  await p.waitForFunction(() => /Make 14 marks editable/.test((document.querySelector('[data-impgo]') || {}).textContent || ''), { timeout: 60000 });
  assert.match(await p.$eval('.mk-imptbl', e => e.textContent), /Pen and lines4 → your pen/);
  await p.click('[data-impgo]');
  await p.waitForFunction(() => !document.querySelector('[data-impgo]'), { timeout: 60000 });
  await p.waitForFunction(() => { const n = window.__mark.ready && document.querySelector('.mk-impnote'); return n && /now yours to change/.test(n.textContent); }, { timeout: 30000 });
  assert.match(await p.$eval('.mk-impnote', n => n.textContent), /7 marks are now yours to change.*1 mark .*couldn’t be changed/);
  const a = await marksOf(p, A), b = await marksOf(p, B);
  assert.deepEqual(a.marks.map(x => x.t).sort(), ['hl', 'note', 'note', 'oval', 'pen', 'pen', 'text']);
  assert.equal(b.marks.length, 7, 'the other paper too');
  // Put back on the first: none of them are hers, and the note doesn't offer again
  await p.waitForFunction(() => { const b = window.__mark.ready && document.querySelector('.mk-impnote [data-imp="back"]'); if (b) b.click(); return !!b; }, { timeout: 30000 });
  await p.waitForFunction(k => { const f = window.__mark.state().batch.students.find(s => s.key === k).files[0]; return f.impNo && !(f.marks[0] || []).length; }, { timeout: 30000 }, A);
  await p.waitForFunction(() => window.__mark.ready && !document.querySelector('.mk-impnote'), { timeout: 30000 });
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m2 = await page(ctx, errors);
  await m2.goto(srv.url); await appReady(m2);
  await m2.evaluate(id => window.__gs.reopenKept(id), id);
  await m2.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  assert.deepEqual(await marksOf(m2, B), b, 'the current app finds the marks the new app made');
  assert.equal((await marksOf(m2, A)).impNo, true, 'and the put back paper as put back');
  // the current app makes the same marks from the same paper
  const fresh = await m2.evaluate(async k => { const f = window.__gs.state().batch.students.find(s => s.key === k).files[0]; delete f.impNo; await window.__gs.impConvert(f); return JSON.parse(JSON.stringify({ marks: f.marks[0] || [], imp: f.imp })); }, A);
  assert.deepEqual(fresh.marks, b.marks, 'the same marks');
  assert.deepEqual(fresh.imp, b.imp);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('lighting set in the new app, for the download, one student and one page, is what the current app opens', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, zip);
  const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  const i = await p.evaluate(k => window.__mark.state().batch.students.findIndex(s => s.key === k), KEY);
  await p.click('[data-st="' + i + '"]');
  await p.waitForFunction(i => window.__mark.state().cur === i && window.__mark.ready && window.__mark.read, { timeout: 60000 }, i);
  const ESSAY = KEY + '/Essay.pdf', PG = KEY + '|' + ESSAY + '|0';
  const L = pg => pg.evaluate(() => { const b = (window.__mark || window.__gs).state().batch; return JSON.parse(JSON.stringify({ light: b.light || null, lightOpt: b.lightOpt || null, lightPg: b.lightPg || null, lightPgL: b.lightPgL || null })); });
  const slide = (sel, v) => p.evaluate((sel, v) => { const r = document.querySelector(sel); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
  await p.waitForFunction(() => { const b = document.querySelector('[data-light]'); if (b) b.click(); return !!b; }, { timeout: 30000 });
  await p.waitForSelector('.mk-light');
  // contrast for everyone, then darker writing for this student only
  await slide('.mk-light [data-l="c"]', 40);
  await p.waitForFunction(() => (window.__mark.state().batch.light || {})['*'] && window.__mark.state().batch.light['*'].c === 40);
  await p.evaluate(() => { const b = [...document.querySelectorAll('.mk-light button')].find(x => /^Only /.test(x.textContent.trim())); b.click(); });
  await p.waitForFunction(k => !!(window.__mark.state().batch.light || {})[k], {}, KEY);
  await slide('.mk-light [data-l="d"]', 25);
  await p.waitForFunction(k => window.__mark.state().batch.light[k].d === 25, {}, KEY);
  assert.equal((await L(p)).light['*'].d || 0, 0, 'the others keep theirs');
  // the ☀ on the essay's page turns lighting off there; Undo turns it back on
  await p.waitForFunction(f => { const c = window.__mark.ready && document.querySelector('canvas[data-page="' + f + '|0"]'), b = c && c.parentNode.querySelector('[data-lpg]'); if (b) b.click(); return !!b; }, { timeout: 30000 }, ESSAY);
  await p.waitForFunction(k => (window.__mark.state().batch.lightPg || {})[k] === false, {}, PG);
  await p.click('[data-undo]');
  await p.waitForFunction(k => (window.__mark.state().batch.lightPg || {})[k] === undefined, {}, PG);
  // ▾: this page's own lighting
  await p.waitForFunction(f => { const c = document.querySelector('canvas[data-page="' + f + '|0"]'), b = c && c.parentNode.querySelector('[data-lmenu]'); if (b) b.click(); return !!b; }, { timeout: 30000 }, ESSAY);
  await p.waitForSelector('.mk-lmenu');
  await slide('.mk-lmenu [data-l="b"]', 12);
  await p.waitForFunction(k => ((window.__mark.state().batch.lightPgL || {})[k] || {}).b === 12, {}, PG);
  assert.match(await p.$eval('[data-lpg]', e => e.closest('.mk-lchip').className), /own/);
  await p.keyboard.press('Escape');
  const now = await L(p);
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m2 = await page(ctx, errors);
  await m2.goto(srv.url); await appReady(m2);
  await m2.evaluate(id => window.__gs.reopenKept(id), id);
  await m2.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  assert.deepEqual(await L(m2), now, 'the current app opens the same lighting');
  assert.deepEqual(errors, []);
  await ctx.close();
});
