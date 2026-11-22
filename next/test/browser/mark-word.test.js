// Word papers on the new marking screen (stage 4, part d): the same clicks on a Word rubric's score boxes give the same score and
// the same file in both apps; and typing in a Word paper and commenting on its words in the new app is what the current app opens
// next time: the edit kept, a real Word comment in the file. npm run next:browser. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { zipSync, strToU8 } = require('fflate');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip, goToStudent } = require('../../../test/helpers/app.js');
const { standardFiles, zipOf } = require('../../../test/helpers/fixtures.js');
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

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
function docxOf(body) {
  const f = s => [strToU8(s), { mtime: new Date(2026, 8, 1, 20) }];
  return zipSync({
    '[Content_Types].xml': f(HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': f(HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/_rels/document.xml.rels': f(HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'),
    'word/document.xml': f(HEAD + '<w:document ' + W + '><w:body>' + body + '</w:body></w:document>'),
  });
}
const cellXml = t => '<w:tc><w:p><w:r><w:t>' + t + '</w:t></w:r></w:p></w:tc>';
const row = cells => '<w:tr>' + cells.map(cellXml).join('') + '</w:tr>';
// A rubric with its levels across the top (4 3 2 1), two criteria down the side, and a Total line to fill in
const RUBRIC = docxOf('<w:p><w:r><w:t>Essay rubric</w:t></w:r></w:p><w:tbl>' + row(['Criterion', 'Score 4', 'Score 3', 'Score 2', 'Score 1']) +
  row(['Ideas', 'Clear', 'Mostly clear', 'Some', 'Few']) + row(['Language', 'Precise', 'Mostly precise', 'Some', 'Few']) + '</w:tbl>' +
  '<w:p><w:r><w:t xml:space="preserve">Total: ____ / 8</w:t></w:r></w:p>');
const RUBRIC_KEY = 'Eve Pretend', RUBRIC_PATH = 'Eve Pretend/Rubric.docx', ESSAY_KEY = 'Dov Madeup', ESSAY_PATH = 'Dov Madeup/Essay.docx';
// the boxes clicked, in order: Ideas 3, Language 4, Language 3 (the half point between), as [criterion row, level column]
const CLICKS = [[1, 2], [2, 1], [2, 2]];

let browser, srv, zip;
before(async () => { srv = await serveSite(); browser = await launch(); zip = zipOf({ ...await standardFiles(), [RUBRIC_PATH]: RUBRIC }); });
after(async () => { await browser.close(); await srv.close(); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
// What a student's Word file and grade are, in either app (G: window.__gs or window.__mark)
const read = `(S, key, path) => { const st = S.batch.students.find(s => s.key === key), f = st.files.find(x => x.path === path);
  const z = (window.fflate || S.fflate).unzipSync(f.data), d = b => b && new TextDecoder().decode(b), g = st.grade;
  return { edited: !!f.edited, doc: d(z['word/document.xml']), cm: d(z['word/comments.xml']) || null, grade: { rubric: g.rubric, points: g.points, status: g.status || '' } }; }`;
const clickBoxes = (p, sel) => p.evaluate((sel, clicks) => { const t = document.querySelector(sel); for (const [r, c] of clicks) t.rows[r].cells[c].click(); }, sel, CLICKS);

async function mainOpens(ctx, errors) {
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  await p.goto(srv.url); await appReady(p);
  await openZip(p, zip);
  return p;
}

test('a Word rubric scored by its boxes gives the same score and the same file in both apps', async () => {
  const errors = [];
  // the current app, on its own
  const c1 = await browser.createBrowserContext(), m = await mainOpens(c1, errors);
  await goToStudent(m, await m.evaluate(k => window.__gs.state().batch.students.findIndex(s => s.key === k), RUBRIC_KEY));
  await m.waitForSelector('#paper .docx td.rcell', { timeout: 60000 });
  await clickBoxes(m, '#paper .docx table.wt');
  await m.waitForFunction(p => { const S = window.__gs.state(), f = S.batch.students.flatMap(s => s.files).find(x => x.path === p); return f && f.edited; }, { timeout: 15000 }, RUBRIC_PATH);
  const was = await m.evaluate(`(${read})(window.__gs.state(), ${JSON.stringify(RUBRIC_KEY)}, ${JSON.stringify(RUBRIC_PATH)})`);
  await c1.close();
  // the new app, on the same papers kept by the current app
  const c2 = await browser.createBrowserContext(), m2 = await mainOpens(c2, errors);
  const id = await m2.evaluate(() => window.__gs.state().batch.id); await m2.close();
  const p = await page(c2, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  const i = await p.evaluate(k => window.__mark.state().batch.students.findIndex(s => s.key === k), RUBRIC_KEY);
  await p.click('[data-st="' + i + '"]');
  await p.waitForSelector('.docx td.rcell', { timeout: 60000 });
  await p.waitForSelector('.docx [data-wedit]', { timeout: 60000 });   // the marking tools are there
  await clickBoxes(p, '.docx table.wt');
  await p.waitForFunction(p => { const f = window.__mark.state().batch.students.flatMap(s => s.files).find(x => x.path === p); return f && f.edited; }, { timeout: 15000 }, RUBRIC_PATH);
  await p.evaluate(() => window.__mark.saved());
  const now = await p.evaluate(`(${read})(window.__mark.state(), ${JSON.stringify(RUBRIC_KEY)}, ${JSON.stringify(RUBRIC_PATH)})`);
  assert.equal(now.doc, was.doc, 'the same boxes shaded and the same Total line, in the file itself');
  assert.deepEqual(now.grade, was.grade, 'the same score');
  assert.match(await p.$eval('.docx .rinfo', e => e.textContent), /^6\.5 \/ 8/, 'the rubric line says the score');
  // and the current app opens the new app's work as it is
  await p.close();
  const m3 = await page(c2, errors);
  await m3.goto(srv.url); await appReady(m3);
  await m3.evaluate(id => window.__gs.reopenKept(id), id);
  await m3.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  const back = await m3.evaluate(`(${read})(window.__gs.state(), ${JSON.stringify(RUBRIC_KEY)}, ${JSON.stringify(RUBRIC_PATH)})`);
  assert.equal(back.doc, was.doc, 'the edited file came back');
  assert.deepEqual(back.grade, was.grade, 'the score came back');
  assert.deepEqual(errors, []);
  await c2.close();
});

test('typing in a Word paper and commenting on its words in the new app is what the current app opens', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), m = await mainOpens(ctx, errors);
  const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  const i = await p.evaluate(k => window.__mark.state().batch.students.findIndex(s => s.key === k), ESSAY_KEY);
  await p.click('[data-st="' + i + '"]');
  await p.waitForSelector('.docx [data-wedit]', { timeout: 60000 });
  // Edit, type at the end of the paragraph, Done editing
  await p.click('.docx [data-wedit]');
  await p.evaluate(() => { const el = document.querySelector('.docx p.wp'), r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); el.focus(); });
  await p.keyboard.type(' Edited here.');
  await p.click('.docx [data-wedit]');
  // Copy text: the paper's words, the typing included
  await p.evaluate(() => { window.__copied = []; navigator.clipboard.writeText = async s => { window.__copied.push(s); }; });
  await p.click('.docx [data-wcopy]');
  await p.waitForFunction(() => window.__copied.length === 1);
  assert.match(await p.evaluate(() => window.__copied[0]), /Edited here\./, 'the Word paper\'s words copied');
  // select "short" and press Comment
  await p.evaluate(() => { const sp = [...document.querySelectorAll('.docx [data-ri]')].find(s => s.textContent.includes('short')), n = sp.firstChild, k = n.textContent.indexOf('short'), r = document.createRange(); r.setStart(n, k); r.setEnd(n, k + 5); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await p.click('.docx [data-wnote]');
  await p.waitForSelector('.wdoc .pop textarea');
  await p.keyboard.type('Say more here.'); await p.keyboard.press('Enter');
  await p.waitForSelector('.wnote');
  assert.match(await p.$eval('.wnote', e => e.textContent), /Say more here\./, 'the comment in the margin');
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m2 = await page(ctx, errors);
  await m2.goto(srv.url); await appReady(m2);
  await m2.evaluate(id => window.__gs.reopenKept(id), id);
  await m2.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  const back = await m2.evaluate(`(${read})(window.__gs.state(), ${JSON.stringify(ESSAY_KEY)}, ${JSON.stringify(ESSAY_PATH)})`);
  assert.ok(back.edited, 'kept as edited');
  assert.match(back.doc, /Edited here\./, 'the typing is in the file');
  assert.match(back.doc, /commentRangeStart w:id="0"\/><w:r><w:t[^>]*>short<\/w:t>/, 'the comment covers exactly the word');
  assert.match(back.cm, /w:author="Teacher"[^>]*>.*Say more here\./, 'a real Word comment in the file');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Convert to PDF in the new app makes the pages the current app makes, in the Word file’s place, and Undo puts the Word file back', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), m = await mainOpens(ctx, errors);
  const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  const i = await p.evaluate(k => window.__mark.state().batch.students.findIndex(s => s.key === k), ESSAY_KEY);
  await p.click('[data-st="' + i + '"]');
  await p.waitForSelector('.docx [data-wpdf]', { timeout: 60000 });
  await p.click('.docx [data-wpdf]');
  await p.waitForSelector('.dlg [data-ok]'); await p.click('.dlg [data-ok]');
  const PDF = ESSAY_PATH.replace(/\.docx$/, '.pdf');
  const files = k => window.__mark.state().batch.students.find(s => s.key === k);
  await p.waitForFunction((k, f) => window.__mark.state().batch.students.find(s => s.key === k).files.some(x => x.path === f), { timeout: 60000 }, ESSAY_KEY, PDF);
  // the Word file waits under Removed files (it is moved there just after the pages go in)
  await p.waitForFunction((k, f) => (window.__mark.state().batch.students.find(s => s.key === k).gone || []).some(x => x.path === f), { timeout: 30000 }, ESSAY_KEY, ESSAY_PATH);
  // Undo puts the Word file back; Redo makes the pages again
  await p.click('[data-undo]');
  await p.waitForFunction((k, f) => window.__mark.state().batch.students.find(s => s.key === k).files.some(x => x.path === f), { timeout: 30000 }, ESSAY_KEY, ESSAY_PATH);
  await p.keyboard.down('Control'); await p.keyboard.press('y'); await p.keyboard.up('Control');
  await p.waitForFunction((k, f) => window.__mark.state().batch.students.find(s => s.key === k).files.some(x => x.path === f), { timeout: 30000 }, ESSAY_KEY, PDF);
  const made = await p.evaluate((k, f) => { const x = window.__mark.state().batch.students.find(s => s.key === k).files.find(x => x.path === f); return { n: x.numPages, b64: btoa(String.fromCharCode(...x.data)) }; }, ESSAY_KEY, PDF);
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m2 = await page(ctx, errors);
  await m2.goto(srv.url); await appReady(m2);
  await m2.evaluate(id => window.__gs.reopenKept(id), id);
  await m2.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  const was = await m2.evaluate(async (k, w, f) => {
    const b = window.__gs.state().batch, st = b.students.find(s => s.key === k), word = st.gone.find(x => x.path === w), pdf = st.files.find(x => x.path === f);
    const again = await window.__gs.wordPagesPdf(word);
    return { has: !!pdf, by: b.removed[w].by, same: !!pdf && btoa(String.fromCharCode(...pdf.data)), again: btoa(String.fromCharCode(...again)) };
  }, ESSAY_KEY, ESSAY_PATH, PDF);
  assert.ok(was.has, 'the current app finds the PDF');
  assert.equal(was.by, PDF, 'and knows it took the Word file’s place');
  assert.equal(was.same, made.b64, 'the same file kept');
  assert.equal(made.b64, was.again, 'the same pages the current app draws from that Word file');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('C-025 C-026 C-027: typing in a Word paper, Enter is a line break, Ctrl B does nothing, a paste comes in as plain text; after a reload Back to the original takes the kept original back', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), m = await mainOpens(ctx, errors);
  const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  const i = await p.evaluate(k => window.__mark.state().batch.students.findIndex(s => s.key === k), ESSAY_KEY);
  await p.click('[data-st="' + i + '"]');
  await p.waitForSelector('.docx [data-wedit]', { timeout: 60000 });
  await p.click('.docx [data-wedit]');
  await p.evaluate(() => { const el = document.querySelector('.docx p.wp'), r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); el.focus(); });
  const paras = await p.$$eval('.docx p.wp', ps => ps.length);
  // C-026: Enter is a line break in the same paragraph; Ctrl B leaves the words as they are
  await p.keyboard.type(' One.'); await p.keyboard.press('Enter'); await p.keyboard.type('Two.');
  await p.keyboard.down('Control'); await p.keyboard.press('b'); await p.keyboard.up('Control');
  await p.keyboard.type(' Three.');
  assert.equal(await p.$$eval('.docx p.wp', ps => ps.length), paras, 'no new paragraph');
  assert.match(await p.$eval('.docx p.wp', e => e.innerText), /One\.\nTwo\. Three\./);
  assert.equal(await p.$$eval('.docx p.wp b, .docx p.wp strong', x => x.length), 0, 'nothing made bold');
  // C-027: a paste with formatting comes in as its words only
  await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/html', '<b>Loud</b> <i>words</i>'); dt.setData('text/plain', ' Loud words'); document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  assert.match(await p.$eval('.docx p.wp', e => e.innerText), /Three\. Loud words$/);
  assert.equal(await p.$$eval('.docx p.wp b, .docx p.wp i', x => x.length), 0, 'no formatting pasted');
  await p.click('.docx [data-wedit]');
  await p.evaluate(() => window.__mark.saved());
  // C-025: after a reload, Back to the original, from the original kept in this browser (here this copy's own is gone)
  await p.reload();
  await p.waitForFunction(() => window.__mark && window.__mark.ready, { timeout: 60000 });
  await p.click('[data-st="' + i + '"]');
  await p.waitForSelector('.docx [data-wedit]', { timeout: 60000 });
  assert.match(await p.$eval('.docx p.wp', e => e.innerText), /Loud words/);
  await p.evaluate((i, path) => { window.__mark.state().batch.students[i].files.find(f => f.path === path).orig = null; }, i, ESSAY_PATH);
  await p.click('.docx [data-wedit]');
  await p.waitForSelector('.docx [data-wreset]');
  await p.click('.docx [data-wreset]');
  await p.waitForFunction((i, path) => !window.__mark.state().batch.students[i].files.find(f => f.path === path).edited, { timeout: 10000 }, i, ESSAY_PATH);
  await p.waitForFunction(() => { const e = document.querySelector('.docx p.wp'); return e && !/Loud words/.test(e.innerText); }, { timeout: 20000 });
  assert.ok(await p.evaluate(id => new Promise(res => { const q = indexedDB.open('grading-studio-keep'); q.onsuccess = () => { const g = q.result.transaction('edits').objectStore('edits').getAllKeys(); g.onsuccess = () => { res(!g.result.some(k => String(k).startsWith(id + '|'))); q.result.close(); }; }; }), id), 'the kept edit taken off');
  assert.deepEqual(errors, []);
  await ctx.close();
});
