// Comments on Word papers: real Word comments in the file, shown in a margin beside the words. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { zipSync, strToU8 } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goToStudent, settle } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
// A Word file with formatting split over runs, and one with a classmate's comment already in it
function docxOf(body, extra = {}, rels = '') {
  const f = s => [strToU8(s), { mtime: new Date(2026, 8, 1, 20) }];
  return zipSync({
    '[Content_Types].xml': f(HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' + (extra['word/comments.xml'] ? '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>' : '') + '</Types>'),
    '_rels/.rels': f(HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/_rels/document.xml.rels': f(HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '</Relationships>'),
    'word/document.xml': f(HEAD + '<w:document ' + W + '><w:body>' + body + '</w:body></w:document>'),
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, f(v)])),
  });
}
const RUNS = '<w:p><w:r><w:t xml:space="preserve">The river is </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>always</w:t></w:r><w:r><w:t xml:space="preserve"> moving forward.</w:t></w:r></w:p>';
const PEER = docxOf('<w:p><w:commentRangeStart w:id="3"/><w:r><w:t>My thesis is here.</w:t></w:r><w:commentRangeEnd w:id="3"/><w:r><w:commentReference w:id="3"/></w:r><w:r><w:t xml:space="preserve"> It has two parts.</w:t></w:r></w:p>',
  { 'word/comments.xml': HEAD + '<w:comments ' + W + '><w:comment w:id="3" w:author="Peer Reviewer" w:date="2026-09-01T00:00:00Z"><w:p><w:r><w:t>Say more about why.</w:t></w:r></w:p></w:comment></w:comments>' },
  '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>');

let browser, zip;
before(async () => {
  browser = await launch();
  zip = zipOf({ ...await standardFiles(), 'Dov Madeup/Reflection.docx': docxOf(RUNS), 'Eve Pretend/Draft.docx': PEER });
});
after(async () => { await browser.close(); });

const parts = (page, key, path) => page.evaluate((key, path) => {
  const st = window.__gs.state().batch.students.find(s => s.key === key), f = st.files.find(x => x.path === path), z = fflate.unzipSync(f.data), d = b => b && new TextDecoder().decode(b);
  return { edited: !!f.edited, doc: d(z['word/document.xml']), cm: d(z['word/comments.xml']), rels: d(z['word/_rels/document.xml.rels']), ct: d(z['[Content_Types].xml']) };
}, key, path);
const cardOf = name => [...document.querySelectorAll('#paper .docx')].find(c => c.querySelector('.fhead').textContent.includes(name));
// The middle of some words on a Word card, on screen
const wordsAt = (page, name, words, off = 1) => page.evaluate((name, words, off) => {
  const c = [...document.querySelectorAll('#paper .docx')].find(c => c.querySelector('.fhead').textContent.includes(name));
  const s = [...c.querySelectorAll('[data-ri]')].find(s => s.textContent.includes(words)), t = s.firstChild, i = s.textContent.indexOf(words);
  const rg = document.createRange(); rg.setStart(t, i + off); rg.setEnd(t, i + off + 1); const b = rg.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2];
}, name, words, off);
const comment = async (page, text) => { await page.waitForSelector('.wpop textarea'); await page.type('.wpop textarea', text); await page.click('.wpop [data-a=ok]'); await settle(page); };

test('The Comment tool on a Word paper comments on the word clicked, as a real Word comment', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'River essay.zip');
  const i = await page.evaluate(() => window.__gs.state().batch.students.findIndex(s => s.key === 'Dov Madeup'));
  await goToStudent(page, i);
  await page.waitForFunction(() => document.querySelectorAll('#paper .docx [data-ri]').length >= 2);
  await page.keyboard.press('c');
  const [x, y] = await wordsAt(page, 'Essay.docx', 'short');
  await page.mouse.click(x, y);
  await comment(page, 'Good word choice.');
  let p = await parts(page, 'Dov Madeup', 'Dov Madeup/Essay.docx');
  assert.ok(p.edited);
  assert.match(p.doc, /<w:commentRangeStart w:id="0"\/><w:r><w:t xml:space="preserve">short<\/w:t><\/w:r><w:commentRangeEnd w:id="0"\/><w:r><w:commentReference w:id="0"\/><\/w:r>/);
  assert.match(p.doc, /Dov Madeup wrote this <\/w:t>.*> essay in Word\./);
  assert.match(p.cm, /<w:comment w:id="0" w:author="Teacher"[^>]*><w:p><w:r><w:t xml:space="preserve">Good word choice\.<\/w:t>/);
  assert.match(p.rels, /relationships\/comments" Target="comments\.xml"/);
  assert.match(p.ct, /PartName="\/word\/comments\.xml" ContentType="application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.comments\+xml"/);
  // on screen: the word lit, a number after it, and a card in the margin
  assert.deepEqual(await page.evaluate(() => { const c = [...document.querySelectorAll('#paper .docx')].find(c => c.querySelector('.fhead').textContent.includes('Essay.docx'));
    return [[...c.querySelectorAll('.wcm')].map(s => s.textContent).join('|'), c.querySelector('.wcref').textContent, c.querySelector('.wnotes').hidden, c.querySelector('.wnote').textContent]; }),
  ['short', '1', false, '1Good word choice.Teacher']);

  // selected words across runs, with the Comment button: the comment covers exactly them, and the bold stays bold
  await page.keyboard.press('v');
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('#paper .docx')].find(c => c.querySelector('.fhead').textContent.includes('Reflection.docx'));
    const sp = [...c.querySelectorAll('[data-ri]')], a = sp.find(s => s.textContent.includes('river')), b = sp.find(s => s.textContent.includes('moving'));
    const rg = document.createRange(); rg.setStart(a.firstChild, a.textContent.indexOf('river')); rg.setEnd(b.firstChild, b.textContent.indexOf('moving') + 6);
    getSelection().removeAllRanges(); getSelection().addRange(rg);
  });
  await page.evaluate(() => [...document.querySelectorAll('#paper .docx')].find(c => c.querySelector('.fhead').textContent.includes('Reflection.docx')).querySelector('[data-wnote]').click());
  await comment(page, 'Which way is forward?');
  p = await parts(page, 'Dov Madeup', 'Dov Madeup/Reflection.docx');
  assert.match(p.doc, /The <\/w:t><\/w:r><w:commentRangeStart w:id="0"\/><w:r><w:t xml:space="preserve">river is <\/w:t><\/w:r><w:r><w:rPr><w:b\/><\/w:rPr><w:t>always<\/w:t><\/w:r><w:r><w:t xml:space="preserve"> moving<\/w:t><\/w:r><w:commentRangeEnd w:id="0"\/><w:r><w:commentReference w:id="0"\/><\/w:r><w:r><w:t xml:space="preserve"> forward\.<\/w:t>/);

  // it stays after the browser is reloaded
  await page.reload();
  await page.waitForSelector('#kept [data-kopen]');
  await page.click('#kept [data-kopen]');
  await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && !a.hidden && window.__gs.state().batch; });
  await goToStudent(page, i);
  await page.waitForFunction(() => document.querySelectorAll('#paper .docx .wnote').length === 2);

  // clicking the card changes it; Delete takes it out of the file
  await page.evaluate(() => [...document.querySelectorAll('#paper .docx')].find(c => c.querySelector('.fhead').textContent.includes('Essay.docx')).querySelector('.wnote').click());
  await page.waitForSelector('.wpop textarea');
  assert.equal(await page.$eval('.wpop textarea', t => t.value), 'Good word choice.');
  await page.$eval('.wpop textarea', t => { t.value = 'Good word choice, and precise.'; });
  await page.click('.wpop [data-a=ok]');
  await settle(page);
  assert.match((await parts(page, 'Dov Madeup', 'Dov Madeup/Essay.docx')).cm, /Good word choice, and precise\./);
  await page.evaluate(() => [...document.querySelectorAll('#paper .docx')].find(c => c.querySelector('.fhead').textContent.includes('Reflection.docx')).querySelector('.wcm').dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
  await page.waitForSelector('.wpop [data-a=del]');
  await page.click('.wpop [data-a=del]');
  await settle(page);
  p = await parts(page, 'Dov Madeup', 'Dov Madeup/Reflection.docx');
  assert.doesNotMatch(p.doc, /comment/);
  assert.doesNotMatch(p.cm, /<w:comment /);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('#paper .docx')].find(c => c.querySelector('.fhead').textContent.includes('Reflection.docx')).querySelector('.wnotes').hidden), true);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Comments already in a Word file show in the margin, and a new one gets its own number', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zip, 'River essay.zip');
  const i = await page.evaluate(() => window.__gs.state().batch.students.findIndex(s => s.key === 'Eve Pretend'));
  await goToStudent(page, i);
  await page.waitForSelector('#paper .docx .wnote');
  assert.equal(await page.$eval('#paper .docx .wnote', n => n.textContent), '1Say more about why.Peer Reviewer');
  // a right-click on a word comments on it, with any tool
  await page.keyboard.press('p');
  const [x, y] = await wordsAt(page, 'Draft.docx', 'parts');
  await page.mouse.click(x, y, { button: 'right' });
  await comment(page, 'Name both parts.');
  const p = await parts(page, 'Eve Pretend', 'Eve Pretend/Draft.docx');
  assert.match(p.cm, /w:id="3" w:author="Peer Reviewer".*w:id="4" w:author="Teacher"/);
  assert.equal((p.rels.match(/relationships\/comments/g) || []).length, 1);
  assert.equal((p.ct.match(/comments\.xml/g) || []).length, 1);
  assert.deepEqual(await page.$$eval('#paper .docx .wnote', ns => ns.map(n => n.textContent)), ['1Say more about why.Peer Reviewer', '2Name both parts.Teacher']);
  assert.deepEqual(page.errors, []);
  await close();
});
