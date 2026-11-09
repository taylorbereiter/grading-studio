// Pasting text a student sent in an email or a message: it becomes a page on their paper. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, waitPaper, goToStudent, markPage, settle } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');

let browser, zip;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

// The words pdf.js reads from each page of a student's file
const pdfWords = (page, key, path) => page.evaluate(async (key, path) => {
  const st = window.__gs.state().batch.students.find(s => s.key === key), f = st.files.find(x => x.path === path);
  const d = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise, out = [];
  for (let i = 1; i <= d.numPages; i++) out.push((await (await d.getPage(i)).getTextContent()).items.map(t => t.str).join(' '));
  d.destroy(); return out;
}, key, path);

test('Paste text adds a markable page that stays after reopening', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'River essay.zip');
  await goToStudent(page, 1);
  await page.click('#pasteTextBtn');
  await page.waitForSelector('#ptText');
  assert.equal(await page.$eval('#ptAdd', b => b.disabled), true);
  await page.$eval('#ptName', e => { e.value = 'Part 2 from email'; });
  await page.type('#ptText', 'Part 2: Analysis\n\nThe river stands for “time” – it never stops, and Bram’s café scene shows it.');
  await page.waitForFunction(() => /\d+ words$/.test(document.querySelector('#ptCount').textContent));
  await page.click('#ptAdd');
  const P = 'Bram Sample/Part 2 from email.pdf';
  await page.waitForFunction(p => window.__gs.state().pages.some(q => q.file.path === p), { timeout: 30000 }, P);
  const words = await pdfWords(page, 'Bram Sample', P);
  assert.equal(words.length, 1);
  assert.match(words[0], /Part 2 from email/);
  assert.match(words[0], /Pasted from a message on/);
  assert.equal(await page.evaluate(() => /exported from Grading Studio/.test(document.querySelector('#paper').textContent)), false);
  assert.match(words[0], /river stands for “time” – it never stops/);
  // it's marked like any page
  const k = await page.evaluate(p => window.__gs.state().pages.findIndex(q => q.file.path === p), P);
  await markPage(page, k);
  await settle(page);
  assert.ok(await page.evaluate(p => window.__gs.state().batch.students[1].files.find(f => f.path === p).marks[0].length > 0, P));
  await page.reload();
  await page.waitForSelector('#kept [data-kopen]');
  await page.click('#kept [data-kopen]');
  await waitPaper(page);
  await goToStudent(page, 1);
  const kept = await page.evaluate(p => { const f = window.__gs.state().batch.students[1].files.find(f => f.path === p); return f && f.added && f.marks[0] && f.marks[0].length; }, P);
  assert.ok(kept > 0);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Long text runs onto more pages, and other alphabets come in as pictures', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'River essay.zip');
  const long = Array.from({ length: 80 }, (_, i) => 'Paragraph ' + (i + 1) + ' of a long reply that goes on for a while, with a verylongwordthatdoesnotfitanywhereonthelineatallbecauseitkeepsgoingandgoingandgoingandgoingandgoingandgoing.').join('\n\n');
  const r = await page.evaluate(async long => {
    const a = await window.__gs.pasteTextPdf('Emailed work', long), b = await window.__gs.pasteTextPdf('งานที่ส่ง', 'นักเรียนตัวอย่าง ส่งงานทางอีเมล\nПривет, это мой ответ.');
    const n = async bytes => { const d = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise; const p = d.numPages, t = (await (await d.getPage(1)).getTextContent()).items.length; d.destroy(); return [p, t]; };
    return { a: a.typed, an: await n(a.bytes), b: b.typed, bn: await n(b.bytes), clean: window.__gs.pasteClean('﻿a b​\r\nc\t \n\n\n') };
  }, long);
  assert.equal(r.a, true);
  assert.ok(r.an[0] >= 3, 'pages: ' + r.an[0]);
  assert.equal(r.b, false);
  assert.deepEqual(r.bn, [1, 0]);
  assert.equal(r.clean, 'a b\nc');
  // a student with nothing turned in can be given pasted work too
  const i = await page.evaluate(() => { const b = window.__gs.state().batch; b.students.push({ key: 'Eli Nofile', files: [], grade: { rubric: [], points: '', comment: '' } }); return b.students.length - 1; });
  await goToStudent(page, i);
  await page.click('#gapPaste');
  await page.type('#ptText', 'Sent from my phone: my whole answer.');
  await page.click('#ptAdd');
  await page.waitForFunction(i => window.__gs.state().cur === i && window.__gs.state().pages.length === 1, { timeout: 30000 }, i);
  assert.deepEqual(await page.evaluate(i => window.__gs.state().batch.students[i].files.map(f => f.path), i), ['Eli Nofile/Emailed work.pdf']);
  assert.deepEqual(page.errors, []);
  await close();
});
