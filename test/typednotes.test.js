// Typed notes: a tab of the side pane, a page to type on like any document. Made-up students only; the one video is made in the
// page (a canvas recorded for a moment), never a real recording.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, waitPaper, goToStudent, settle, pick, answerDlg, catchDownloads, score, markPage } = require('./helpers/app');
const { PDFDocument } = require('pdf-lib');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

async function noWeb(page) {
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url(); if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u) || /^(data|blob|about):/.test(u)) return r.continue(); r.abort(); });
}
const threeZip = async () => zipOf({
  'Aria Testwell/Outline.pdf': await makePaper({ title: 'Aria outline' }),
  'Bram Sample/Outline.pdf': await makePaper({ title: 'Bram outline' }),
  'Cleo Fixture/Outline.pdf': await makePaper({ title: 'Cleo outline' }),
});
const calm = page => page.evaluate(() => new Promise(r => setTimeout(r, 350)));
// A block as a short word: its heading or mark, its list and level, its text, its time.
const word = x => (x.k ? x.k + ':' : '') + (x.y ? x.y + (x.d ? '2' : '') + ':' : '') + x.s + (x.t != null ? '@' + x.t : '');
const lines = page => page.evaluate(() => window.__gs.tnLines()).then(L => L.map(word));
const stored = (page, i = 0) => page.evaluate(i => { const tn = window.__gs.state().batch.students[i].grade.tn; return tn ? tn.l : null; }, i).then(L => L && L.map(word));
const caret = page => page.evaluate(() => window.__gs.tnCaret());
const keys = async (page, mods, key) => { for (const m of mods) await page.keyboard.down(m); await page.keyboard.press(key); for (const m of mods.slice().reverse()) await page.keyboard.up(m); };
async function openNotes(page) {
  await page.evaluate(() => window.__gs.spOpen('typed'));
  await page.waitForSelector('#spBody .tn .tned');
  await calm(page);
}
// The caret at the end of paragraph i.
const para = async (page, i) => { await page.click('#spBody .tned > .tnp:nth-child(' + (i + 1) + ')'); await page.keyboard.press('End'); };
const paste = (page, data) => page.evaluate(data => { const d = new DataTransfer(); for (const [k, v] of Object.entries(data)) d.setData(k, v); document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: d, bubbles: true, cancelable: true })); }, data);

test('a page to type on: paragraphs, lists by button and by "- ", styles and marks, bold that is kept, a clean paste, one undo a pause', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await page.setViewport({ width: 1440, height: 900 });
  await openZip(page, await threeZip(), 'Essays.zip');
  await waitPaper(page);
  assert.ok((await page.evaluate(() => window.__gs.spState().tabs.map(t => t.kind))).includes('typed'), 'offered for every student');
  await openNotes(page);
  assert.equal(await page.$eval('#spTabs [aria-selected="true"]', e => e.textContent), 'Type notes');
  assert.equal(await page.$eval('#spBody .tnph', e => e.hidden), false, 'grey words on an empty page');
  assert.equal(await page.$eval('#spBody .tnhint', e => e.hidden), false, 'the rubric link shows on empty notes');
  assert.equal(await stored(page), null, 'nothing stored by opening');
  // the toolbar, in order
  assert.deepEqual(await page.$$eval('#spBody .tnbar > *', a => a.filter(e => e.checkVisibility()).map(e => e.querySelector('[title]') ? e.querySelector('[title]').title : e.title || e.className)),
    ['Text style', 'Bold', 'Italic', 'Underline', 'Highlight', 'Bulleted list', 'Numbered list', 'tnsep tnr', 'Mark', 'Put the time on this paragraph, or take it off', 'More for these notes']);

  await page.click('#spBody .tned');
  await page.keyboard.type('Clear thesis');
  await page.keyboard.press('Enter');
  await page.keyboard.type('# not a heading: symbols stay as typed');
  assert.equal(await page.$eval('#spBody .tnph', e => e.hidden), true);
  assert.deepEqual(await lines(page), ['Clear thesis', '# not a heading: symbols stay as typed']);
  assert.deepEqual(await stored(page), ['Clear thesis', '# not a heading: symbols stay as typed']);
  // Enter splits at the caret, Backspace at the start joins it back
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  assert.deepEqual(await lines(page), ['Clear thesis', '# not a heading: symbols stay ', 'as typed']);
  assert.deepEqual(await caret(page), [2, 0]);
  await page.keyboard.press('Backspace');
  assert.deepEqual(await lines(page), ['Clear thesis', '# not a heading: symbols stay as typed']);
  assert.deepEqual(await caret(page), [1, 30]);
  // Ctrl B, typed on: the words are bold, and kept that way
  await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await keys(page, ['Control'], 'b'); await page.keyboard.type('Bold words'); await keys(page, ['Control'], 'b'); await page.keyboard.type(' then plain');
  assert.equal(await page.$eval('#spBody .tned > .tnp:nth-child(3) b', e => e.textContent), 'Bold words');
  assert.deepEqual((await page.evaluate(() => window.__gs.state().batch.students[0].grade.tn.l[2])).f, [[0, 10, 1]]);
  // a bulleted list from the button, and from "- " typed at the start; Tab makes a second level; Enter on an empty item leaves the list
  await page.keyboard.press('Enter'); await page.keyboard.type('First point');
  await page.click('#spBody [data-tnl="ul"]');
  assert.equal((await lines(page))[3], 'ul:First point');
  assert.equal(await page.$eval('#spBody [data-tnl="ul"]', b => b.getAttribute('aria-pressed')), 'true');
  await page.keyboard.press('Enter'); await page.keyboard.type('Under it');
  await page.keyboard.press('Tab');
  assert.equal((await lines(page))[4], 'ul2:Under it');
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  assert.equal((await lines(page))[5], 'ul:');
  await page.keyboard.press('Enter');
  assert.equal((await lines(page))[5], '', 'out of the list');
  await page.keyboard.type('- Typed bullet');
  assert.equal((await lines(page))[5], 'ul:Typed bullet');
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.keyboard.type('1. A number');
  assert.equal((await lines(page))[6], 'ol:A number');
  assert.equal(await page.$eval('#spBody .tned > .tnp:nth-child(7)', e => getComputedStyle(e, '::before').content), 'counter(tn1) "."', 'numbered by the page');
  await page.keyboard.press('Home'); await page.keyboard.press('Backspace');
  assert.equal((await lines(page))[6], 'A number', 'Backspace at the start takes it out of the list');
  // Ctrl Alt 1 and 2 make a heading and a small heading, Ctrl Alt 0 normal text again
  await para(page, 0); await keys(page, ['Control', 'Alt'], 'Digit1');
  assert.equal((await lines(page))[0], 'h:Clear thesis');
  assert.equal(await page.$eval('#spBody .tnsty span', e => e.textContent), 'Heading');
  await keys(page, ['Control', 'Alt'], 'Digit2');
  assert.equal((await lines(page))[0], 'h2:Clear thesis');
  await keys(page, ['Control', 'Alt'], 'Digit0');
  assert.equal((await lines(page))[0], 'Clear thesis');
  await pick(page, '#spBody .tnsty + .km [data-tns="h"]');
  assert.equal((await lines(page))[0], 'h:Clear thesis');
  // a mark from the Mark menu shows beside the paragraph, never in its text
  await para(page, 1); await pick(page, '#spBody .tnr .km [data-tnmk="n"]');
  assert.equal((await lines(page))[1], 'n:# not a heading: symbols stay as typed');
  assert.equal(await page.$eval('#spBody .tngut i[data-k="n"]', e => e.textContent), '→');
  assert.equal(await page.$eval('#spBody .tnmk', b => b.getAttribute('aria-pressed')), 'true');
  // highlight on a selection; Ctrl Z takes it off again, then brings it back
  await para(page, 6); await page.keyboard.down('Shift'); for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowLeft'); await page.keyboard.up('Shift');
  await page.click('#spBody [data-tnf="hl"]');
  assert.equal(await page.$eval('#spBody .tned > .tnp:nth-child(7) mark', e => e.textContent), 'number');
  await keys(page, ['Control'], 'z');
  assert.equal(await page.$('#spBody .tned mark'), null, 'undo takes the highlight off');
  await keys(page, ['Control'], 'y');
  assert.equal(await page.$eval('#spBody .tned mark', e => e.textContent), 'number');
  // a paste from another page: paragraphs, a heading, a list, bold and italic come in; a script, a styled span, a link's markup and a picture don't
  await para(page, 6); await page.keyboard.press('Enter');
  await paste(page, { 'text/html': '<meta charset="utf-8"><b style="font-weight:normal" id="docs-internal-guid-1"><h2>Pasted heading</h2><p><span style="color:#c00;font-size:30px;font-family:Comic Sans MS">Red big</span> and <span style="font-weight:700">strong</span> and <a href="https://example.com">a link</a><img src="x.png" onerror="window.__bad=1"></p><script>window.__bad=2</script><ul><li><p><em>Item one</em></p></li><li>Item two</li></ul></b>', 'text/plain': 'ignored' });
  await calm(page);
  assert.equal(await page.evaluate(() => window.__bad), undefined, 'nothing pasted ran');
  assert.deepEqual((await lines(page)).slice(7), ['h:Pasted heading', 'Red big and strong and a link', 'ul:Item one', 'ul:Item two']);
  const L = await page.evaluate(() => window.__gs.tnLines());
  assert.deepEqual(L[8].f, [[12, 18, 1]], 'only the bold came in with "strong"');
  assert.deepEqual(L[9].f, [[0, 8, 2]]);
  assert.equal(await page.$('#spBody .tned img, #spBody .tned a, #spBody .tned script, #spBody .tned [style]'), null);
  // plain text pastes as paragraphs, with a copied time, mark and bullet read back
  await para(page, 10); await page.keyboard.press('Enter');
  await paste(page, { 'text/plain': 'Evidence is thin\nStrength: good hook\n• [1:05] Question: why this source?' });
  assert.deepEqual((await lines(page)).slice(11), ['Evidence is thin', 'p:good hook', 'q:ul:why this source?@65']);
  // Copy notes: plain text, lists with • and 1., marks in words, times in brackets
  assert.equal(await page.evaluate(() => window.__gs.tnText()), 'Clear thesis\nNext step: # not a heading: symbols stay as typed\nBold words then plain\n• First point\n    • Under it\n• Typed bullet\nA number\n\nPasted heading\nRed big and strong and a link\n• Item one\n• Item two\nEvidence is thin\nStrength: good hook\n• [1:05] Question: why this source?');
  // one Ctrl Z for a pause in typing
  await para(page, 11);
  await page.keyboard.type(' still'); for (let i = 0; i < 5; i++) await calm(page);
  await page.keyboard.type(' here');
  await keys(page, ['Control'], 'z');
  assert.equal((await stored(page))[11], 'Evidence is thin still');
  assert.equal((await lines(page))[11], 'Evidence is thin still');
  await keys(page, ['Control'], 'y');
  assert.equal((await stored(page))[11], 'Evidence is thin still here');
  // started in the list, with no score
  assert.equal(await page.$eval('#stuList .stu[data-i="0"] .dot', () => true).catch(() => false), true, 'a dot for started');
  assert.equal(await page.$('#stuList .stu[data-i="1"] .dot'), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('headings from the rubric and for every student; clear with undo; a note from the first version; reopening keeps the notes and their bold', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, await threeZip(), 'Essays.zip');
  await waitPaper(page);
  await openNotes(page);
  const rows = await page.evaluate(() => window.__gs.state().setup.criteria.slice());
  await page.click('[data-tnrub]');
  assert.deepEqual(await lines(page), rows.flatMap(r => ['h:' + r, '']));
  assert.deepEqual(await caret(page), [1, 0]);
  await page.keyboard.type('Organised ');
  await keys(page, ['Control'], 'b'); await page.keyboard.type('well'); await keys(page, ['Control'], 'b');
  await pick(page, '#spBody [data-tnm="head"]');
  assert.deepEqual(await page.evaluate(() => window.__gs.state().setup.tnHead), rows);
  // the next student shows the headings, with nothing stored and nothing started
  await goToStudent(page, 1); await page.waitForSelector('#spBody .tned'); await calm(page);
  assert.deepEqual(await lines(page), rows.flatMap(r => ['h:' + r, '']));
  assert.equal(await stored(page, 1), null);
  assert.equal(await page.$eval('#spBody .tnhint', e => e.hidden), true);
  await page.click('#spBody .tned > .tnp:nth-child(4)'); await page.keyboard.type('Needs a source');
  assert.deepEqual(await stored(page, 1), rows.flatMap((r, i) => ['h:' + r, i === 1 ? 'Needs a source' : '']));
  // the third student: notes kept by the first version ({ s, k, t } only) load as they were
  await page.evaluate(() => { const st = window.__gs.state().batch.students[2]; st.grade.tn = { l: [{ s: 'Delivery', k: 'h' }, { s: 'Steady pace', t: 75 }, { s: 'Strong opening', k: 'p' }, { s: 'Why this book?', k: 'q' }] }; });
  await goToStudent(page, 2); await page.waitForSelector('#spBody .tned'); await calm(page);
  assert.deepEqual(await lines(page), ['h:Delivery', 'Steady pace@75', 'p:Strong opening', 'q:Why this book?']);
  assert.equal(await page.$eval('#spBody .tned > .tnp:nth-child(1)', e => e.getAttribute('role')), 'heading');
  assert.deepEqual(await page.$$eval('#spBody .tngut .tng', r => r.map(x => x.textContent)), ['1:15', '✓', '?']);
  // clearing the headings for every student
  await page.evaluate(() => { delete window.__gs.state().batch.students[2].grade.tn; });
  await goToStudent(page, 0); await goToStudent(page, 2); await page.waitForSelector('#spBody .tned'); await calm(page);
  await pick(page, '#spBody [data-tnm="unhead"]');
  assert.equal(await page.evaluate(() => 'tnHead' in window.__gs.state().setup), false);
  assert.deepEqual(await lines(page), ['']);
  // clear one student's notes, asked first, and Ctrl Z brings them back
  await goToStudent(page, 1); await page.waitForSelector('#spBody .tned'); await calm(page);
  await pick(page, '#spBody [data-tnm="clear"]');
  await answerDlg(page);
  await page.waitForFunction(() => !window.__gs.state().batch.students[1].grade.tn);
  assert.deepEqual(await lines(page), ['']);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await keys(page, ['Control'], 'z');
  assert.equal((await stored(page, 1))[3], 'Needs a source');
  assert.equal((await lines(page))[3], 'Needs a source');
  await settle(page);
  // opened again later: the notes are there, the bold too
  await page.reload();
  await page.waitForSelector('#vHome [data-kopen]'); await page.click('#vHome [data-kopen]');
  await waitPaper(page);
  await goToStudent(page, 0);
  assert.equal((await stored(page, 0))[1], 'Organised well');
  assert.equal((await stored(page, 1))[3], 'Needs a source');
  await openNotes(page);
  assert.equal((await lines(page))[1], 'Organised well');
  assert.equal(await page.$eval('#spBody .tned > .tnp:nth-child(2) b', e => e.textContent), 'well');
  assert.deepEqual(page.errors, []);
  await close();
});

test('times: a chip in the margin from a playing video (a click goes back there), from the Timer for a talk given live, set by hand, and Times off', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await page.setViewport({ width: 1440, height: 900 });
  await openZip(page, await threeZip(), 'Talks.zip');
  await waitPaper(page);
  const vid = await page.evaluateHandle(async () => {
    const c = document.createElement('canvas'); c.width = 160; c.height = 90; const g = c.getContext('2d');
    const rec = new MediaRecorder(c.captureStream(15), { mimeType: 'video/webm' }), parts = [];
    rec.ondataavailable = e => parts.push(e.data);
    let i = 0; const t = setInterval(() => { g.fillStyle = '#1F6FB2'; g.fillRect(0, 0, 160, 90); g.fillStyle = '#fff'; g.fillRect((i++ * 4) % 140, 30, 20, 20); }, 60);
    rec.start(); await new Promise(r => setTimeout(r, 3000)); rec.stop(); await new Promise(r => { rec.onstop = r; }); clearInterval(t);
    return new File(parts, 'Aria talk.webm', { type: 'video/webm' });
  });
  await page.evaluate(async v => { const B = window.__gs.state().batch; await window.__gs.videoAdd(B.students[0], { file: v, name: 'Talk video', kind: 'lined', partners: [B.students[1]] }); }, vid);
  await page.waitForSelector('#paper .media video');
  await openNotes(page);
  assert.equal(await page.$eval('#spBody .tnclock', e => e.hidden), true, 'no clock beside a video');
  // a video not started yet gives no time
  await page.click('#spBody .tned'); await page.keyboard.type('Before it starts');
  assert.deepEqual(await lines(page), ['Before it starts']);
  await page.evaluate(() => { const m = document.querySelector('#paper .media video'); m.muted = true; m.currentTime = 2; });
  await page.waitForFunction(() => document.querySelector('#paper .media video').currentTime >= 2);
  await page.keyboard.press('Enter'); await page.keyboard.type('Eye contact');
  assert.deepEqual(await lines(page), ['Before it starts', 'Eye contact@2']);
  assert.equal(await page.$eval('#spBody .tngut .tnchip', e => e.textContent), '0:02');
  assert.equal(await page.$eval('#spBody .tned', e => e.textContent.includes('0:02')), false, 'the time is not in the text');
  // a click on the time plays the video from there
  await page.evaluate(() => { const m = document.querySelector('#paper .media video'); m.pause(); m.currentTime = 0.1; });
  await page.click('#spBody .tnchip');
  await page.waitForFunction(() => document.querySelector('#paper .media video').currentTime >= 1.9);
  await page.evaluate(() => document.querySelector('#paper .media video').pause());
  // the Time button takes it off, and puts the video's time on by hand
  await para(page, 1); await page.click('#spBody [data-tntm]');
  assert.deepEqual(await lines(page), ['Before it starts', 'Eye contact']);
  await para(page, 0); await page.click('#spBody [data-tntm]');
  assert.match((await lines(page))[0], /^Before it starts@[12]$/);
  // a click on the × beside a time hides it, kept; the faint clock left in its place brings it back
  const hids = () => page.evaluate(() => window.__gs.state().batch.students[0].grade.tn.l.map(x => (x.t != null ? 't' : '') + (x.h ? 'h' : '')));
  await page.click('#spBody .tnhide[data-tnts="0"]');
  assert.deepEqual(await hids(page), ['th', '']);
  assert.equal(await page.$('#spBody .tnchip'), null);
  assert.equal(await page.evaluate(() => window.__gs.tnText()), 'Before it starts\nEye contact', 'a hidden time is left out of Copy notes');
  await page.click('#spBody .tnhid[data-tnts="0"]');
  assert.deepEqual(await hids(page), ['t', '']);
  assert.ok(await page.$('#spBody .tnchip'));
  // Hide all times: every time hidden, and a new one comes in hidden until they are shown again
  await pick(page, '#spBody [data-tnm="alltimes"]');
  assert.deepEqual(await hids(page), ['th', '']);
  assert.equal(await page.$eval('#spBody [data-tnm="alltimes"]', e => e.textContent), 'Show all times');
  await page.evaluate(() => document.querySelector('#paper .media video').play());
  await para(page, 1); await page.keyboard.press('Enter'); await page.keyboard.type('Gestures');
  await page.evaluate(() => document.querySelector('#paper .media video').pause());
  assert.deepEqual(await hids(page), ['th', '', 'th']);
  // the Time button on a hidden time shows it again
  await para(page, 2); await page.click('#spBody [data-tntm]');
  assert.deepEqual(await hids(page), ['th', '', 't']);
  await pick(page, '#spBody [data-tnm="alltimes"]');
  assert.deepEqual(await hids(page), ['th', '', 'th']);
  await pick(page, '#spBody [data-tnm="alltimes"]');
  assert.deepEqual(await hids(page), ['t', '', 't']);
  assert.equal(await page.$eval('#spBody [data-tnm="alltimes"]', e => e.textContent), 'Hide all times');
  // Times off: no chips, and no time on a new paragraph
  await pick(page, '#spBody [data-tnm="times"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.tnTime')), 'false');
  assert.equal(await page.$('#spBody .tnchip'), null);
  await para(page, 1); await page.keyboard.press('Enter'); await page.keyboard.type('Pace');
  assert.equal((await lines(page))[2], 'Pace');
  await pick(page, '#spBody [data-tnm="times"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.tnTime')), null);
  await settle(page);
  // the partner shares the notes, as they share the comment
  const want = await lines(page);
  await goToStudent(page, 1); await page.waitForSelector('#spBody .tned'); await calm(page);
  assert.deepEqual(await stored(page, 1), want);
  assert.deepEqual(await lines(page), want);

  // a talk given live: no video, and the Timer's clock at the foot of the page
  await goToStudent(page, 2); await calm(page);
  if (!(await page.$('#spBody .tned'))) await openNotes(page);
  assert.equal(await page.$eval('#spBody .tnclock', e => e.hidden), false);
  const key = await page.evaluate(() => window.__gs.state().batch.students[2].key);
  await page.evaluate(k => window.__gs.spClockSet(k, 75000), key);
  await page.click('#spBody .tnclock');
  assert.match(await page.$eval('#spBody .tnclock', e => e.textContent), /^❚❚ 1:1[5-6]$/);
  await page.click('#spBody .tned'); await page.keyboard.type('Strong opening');
  assert.match((await lines(page))[0], /^Strong opening@7[5-6]$/);
  assert.match(await page.$eval('#spBody .tnchip', e => e.textContent), /^1:1[5-6]$/);
  // the Timer tab runs the same clock
  assert.equal(await page.evaluate(k => window.__gs.spClock(k).on, key), true);
  await page.click('#spBody .tnclock');
  assert.equal(await page.evaluate(k => window.__gs.spClock(k).on, key), false);
  assert.deepEqual(page.errors, []);
  await close();
});

// What a returned file's pages say: the text drawn on each canvas the export makes is noted, since its pages are pictures.
const drawn = page => page.evaluate(() => { const t = window.__drawn || []; window.__drawn = []; return t; });
const noteDrawing = page => page.evaluate(() => { window.__drawn = []; const f = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { window.__drawn.push(String(t)); return f.call(this, t, ...a); }; });
const setNotes = (page, i, l) => page.evaluate((i, l) => { const st = window.__gs.state().batch.students[i]; if (l) st.grade.tn = { l }; else delete st.grade.tn; st.grade.at = Date.now(); window.__gs.saveNow(); }, i, l);
const pdfPages = async u => (await PDFDocument.load(u)).getPageCount();

test('returned papers: typed notes are a page after the feedback page, or last; a long note runs on; off, headings only and partners', async () => {
  const { page, close } = await openApp(browser, { one: true, names: true, feedback: true });
  await noWeb(page);
  await openZip(page, await threeZip(), 'Talks.zip');
  await waitPaper(page);
  // Aria and Bram work together: what Aria's notes say, Bram's say too
  await page.evaluate(() => { const G = window.__gs, S = G.state().batch.students; return G.videoAdd(S[0], { url: 'https://youtu.be/abcDEF12345', name: 'Talk video', kind: '', partners: [S[1]] }, true); });
  await setNotes(page, 0, [{ s: 'Delivery', k: 'h' }, { s: 'Steady pace, clear voice', t: 75, f: [[0, 11, 1], [13, 24, 8]] }, { s: 'Strong opening question', k: 'p' }, { s: 'Cite the second source', k: 'n' }, { s: 'Why this book?', k: 'q' }, { s: 'Sources', y: 'h2' }, { s: 'First source', y: 'ol' }, { s: 'Second source', y: 'ol' }, { s: 'A detail', y: 'ul', d: 2 }]);
  await markPage(page, 0);
  await score(page, [3, 3, 3]);   // a save after the notes keeps the group in step
  await settle(page);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[1].grade.tn.l.length), 9, 'the partner shares the notes');
  await noteDrawing(page);
  const dl = await catchDownloads(page);
  let got = await dl.next(() => page.click('#oneOutBtn'));
  // the feedback page, the notes page, then the paper
  let pdfN = await pdfPages(got.bytes), said = await drawn(page);
  assert.equal(await page.evaluate(() => window.__gs.tnPagesMade()), 1);
  assert.equal(pdfN, 3, 'feedback, notes, paper: ' + pdfN);
  for (const t of ['Notes from your teacher', 'Delivery', 'Steady ', 'pace', 'clear ', 'voice', '✓ Strength', 'Strong ', 'opening ', 'question', '→ Next step', '? Question', 'Why ', 'this ', 'book?', 'Sources', '1.', '2.', 'First ', 'source', '◦', 'A ', 'detail', 'Your feedback continues on the next page.', 'Your marked paper starts on the next page.']) assert.ok(said.includes(t), t + ' is on the pages: ' + said.join(' | '));
  assert.ok(!said.some(t => /Strength:/.test(t)), 'the kind is a word in its own column');
  assert.ok(!said.includes('1:15'), 'no times on the returned page');
  assert.ok(said.indexOf('Notes from your teacher') > said.indexOf('Your feedback continues on the next page.'), 'the notes page comes after the feedback page');
  // the partner gets the page too
  await goToStudent(page, 1);
  got = await dl.next(() => page.click('#oneOutBtn')); said = await drawn(page);
  assert.ok(said.includes('second '));

  // Cleo: headings only is nothing to give back, and nothing to export
  await goToStudent(page, 2);
  await setNotes(page, 2, [{ s: 'Delivery', k: 'h' }, { s: 'Content', k: 'h' }]);
  assert.equal(await page.evaluate(() => window.__gs.tnOut(2)), false);
  assert.equal(await page.evaluate(() => window.__gs.exportPlan(false).filter(o => o.st.key === 'Cleo Fixture').length), 0);
  // a long note and nothing else: a returned file all the same, the notes last, running on to a second page
  await setNotes(page, 2, Array.from({ length: 70 }, (_, i) => ({ s: 'Line ' + (i + 1) + ' of a long set of notes that wraps when it is long enough to need it' })));
  got = await dl.next(() => page.click('#oneOutBtn')); said = await drawn(page);
  assert.ok(await page.evaluate(() => window.__gs.tnPagesMade()) >= 2);
  assert.ok(said.includes('The notes continue on the next page.'));
  assert.ok(!said.includes('Your marked paper starts on the next page.'), 'no feedback page and the notes last: no word of a paper to come');
  assert.equal(await pdfPages(got.bytes), 1 + await page.evaluate(() => window.__gs.tnPagesMade()), 'the paper, then the notes');

  // off for the assignment: the foot line says so, and nothing of the notes leaves
  await goToStudent(page, 0);
  await openNotes(page);
  assert.equal(await page.$eval('#spBody .tnfoot', e => e.textContent), 'Goes back to the student with the paper');
  await page.click('#spBody .tnfoot');
  assert.equal(await page.$eval('#spBody .tnfoot', e => e.textContent), 'Only for you. Not given back.');
  assert.equal(await page.evaluate(() => window.__gs.state().setup.tnBack), false);
  assert.equal(await page.$eval('#spBody [data-tnm="back"]', e => e.getAttribute('aria-checked')), 'false');
  got = await dl.next(() => page.click('#oneOutBtn')); said = await drawn(page);
  assert.equal(await pdfPages(got.bytes), 2, 'feedback and paper only');
  assert.ok(!said.includes('second ') && !said.includes('Notes from your teacher'));
  assert.ok(said.includes('Your marked paper starts on the next page.'));
  assert.equal(await page.evaluate(() => window.__gs.exportPlan(false).filter(o => o.st.key === 'Cleo Fixture').length), 0, 'notes kept back are nothing to return');
  // and on again from the menu
  await pick(page, '#spBody [data-tnm="back"]');
  assert.equal(await page.evaluate(() => 'tnBack' in window.__gs.state().setup), false);
  assert.deepEqual(page.errors, []);
  await close();
});

// The size the drawn note text is in: the font of each fillText that drew a piece of a line.
const sizesOf = page => page.evaluate(() => { const t = window.__fonts || []; window.__fonts = []; return t; });
test('returned papers: the Notes page in Compact, Standard or Large, set from the ⋯, and a long note runs on at each size', async () => {
  const { page, close } = await openApp(browser, { one: true, names: true });
  await noWeb(page);
  await openZip(page, await threeZip(), 'Talks.zip');
  await waitPaper(page);
  await setNotes(page, 0, Array.from({ length: 100 }, (_, i) => ({ s: 'Line ' + (i + 1) + ' of a long set of notes that wraps when it is long enough' })));
  await settle(page);
  await page.evaluate(() => { window.__fonts = []; const f = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { if (/^Line $/.test(String(t))) window.__fonts.push(this.font); return f.call(this, t, ...a); }; });
  const dl = await catchDownloads(page);
  const size = async () => { const f = await sizesOf(page); assert.ok(f.length, 'the note was drawn'); return parseFloat(/([\d.]+)px/.exec(f[0])[1]); };
  await dl.next(() => page.click('#oneOutBtn'));
  const std = await size(), stdPages = await page.evaluate(() => window.__gs.tnPagesMade());
  assert.equal(std, 12, 'Standard is 12 pt');
  assert.ok(stdPages >= 2, 'a long note runs on at Standard');
  // Large from the ⋯: one item opens the three sizes, the one in use checked
  await openNotes(page);
  await page.click('#spBody .tnbar .kdots');
  assert.equal(await page.$eval('#spBody .tnszs', e => e.hidden), true);
  await page.click('#spBody [data-tnm="size"]');
  assert.deepEqual(await page.$$eval('#spBody [data-tnsz]', l => l.map(e => e.textContent + ':' + e.getAttribute('aria-checked'))), ['Compact:false', 'Standard:true', 'Large:false']);
  await page.click('#spBody [data-tnsz="l"]');
  assert.equal(await page.evaluate(() => window.__gs.state().setup.tnSize), 'l');
  // the foot names it, after a dot drawn by the page
  assert.deepEqual(await page.$eval('#spBody .tnback', e => [e.textContent, getComputedStyle(e.querySelector('.tnszw'), '::before').content, e.querySelector('.tnszw').hidden]), ['Goes back to the student with the paperLarge', '"· "', false]);
  await dl.next(() => page.click('#oneOutBtn'));
  const big = await size(), bigPages = await page.evaluate(() => window.__gs.tnPagesMade());
  assert.equal(big, 15, 'Large is 15 pt');
  assert.ok(bigPages > stdPages, 'larger text never shrinks to fit: it takes more pages (' + stdPages + ' then ' + bigPages + ')');
  // undo puts Standard back, and the foot stops naming a size
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control');
  await settle(page);
  assert.equal(await page.evaluate(() => 'tnSize' in window.__gs.state().setup), false);
  assert.deepEqual(await page.$eval('#spBody .tnback', e => [e.textContent, e.querySelector('.tnszw').hidden]), ['Goes back to the student with the paper', true]);
  // Compact, then notes kept back: the size can't be changed
  await page.click('#spBody .tnbar .kdots'); await page.click('#spBody [data-tnm="size"]'); await page.click('#spBody [data-tnsz="s"]');
  await dl.next(() => page.click('#oneOutBtn'));
  assert.equal(await size(), 10, 'Compact is 10 pt');
  await page.click('#spBody .tnback');
  assert.equal(await page.$eval('#spBody [data-tnm="size"]', e => e.disabled), true);
  assert.deepEqual(await page.$eval('#spBody .tnback', e => [e.textContent, e.querySelector('.tnszw').hidden]), ['Only for you. Not given back.', true]);
  assert.deepEqual(page.errors, []);
  await close();
});
