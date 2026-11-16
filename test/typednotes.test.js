// Typed notes: a tab of the side pane for notes typed line by line. Made-up students only; the one video is made in the page
// (a canvas recorded for a moment), never a real recording.
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
const lines = page => page.evaluate(() => window.__gs.tnLines().map(x => (x.k ? x.k + ':' : '') + x.s + (x.t != null ? '@' + x.t : '')));
const stored = (page, i = 0) => page.evaluate(i => { const tn = window.__gs.state().batch.students[i].grade.tn; return tn ? tn.l.map(x => (x.k ? x.k + ':' : '') + x.s + (x.t != null ? '@' + x.t : '')) : null; }, i);
const caret = page => page.evaluate(() => { const a = document.activeElement; return a && a.classList.contains('tnin') ? [+a.dataset.tni, a.selectionStart] : null; });
async function openNotes(page) {
  await page.evaluate(() => window.__gs.spOpen('typed'));
  await page.waitForSelector('#spBody .tn .tnin');
  await calm(page);
}
const line = (page, i) => page.click('#spBody .tnin[data-tni="' + i + '"]');

test('typing lines: Enter, Backspace, Delete, the arrows, pasting several lines, the kinds from the bar and the keys, one undo a pause', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await page.setViewport({ width: 1440, height: 900 });
  await openZip(page, await threeZip(), 'Essays.zip');
  await waitPaper(page);
  assert.ok((await page.evaluate(() => window.__gs.spState().tabs.map(t => t.kind))).includes('typed'), 'offered for every student');
  await openNotes(page);
  assert.equal(await page.$eval('#spTabs [aria-selected="true"]', e => e.textContent), 'Type notes');
  assert.equal(await page.$eval('#spBody .tnin', e => e.placeholder), 'Type your notes. Enter starts a new line.');
  assert.equal(await page.$eval('#spBody .tnhint', e => e.hidden), false, 'the rubric link shows on empty notes');
  assert.equal(await stored(page), null, 'nothing stored by opening');
  // no times without a video or the Timer: the toggle is off and says why
  assert.equal(await page.$eval('[data-tntime]', b => b.disabled), true);
  assert.match(await page.$eval('[data-tntime]', b => b.title), /video, or the Timer/);

  await line(page, 0);
  await page.keyboard.type('Clear thesis');
  await page.keyboard.press('Enter');
  await page.keyboard.type('# not a heading: symbols stay as typed');
  assert.deepEqual(await lines(page), ['Clear thesis', '# not a heading: symbols stay as typed']);
  assert.deepEqual(await stored(page), ['Clear thesis', '# not a heading: symbols stay as typed']);
  // Enter splits at the caret
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  assert.deepEqual(await lines(page), ['Clear thesis', '# not a heading: symbols stay ', 'as typed']);
  assert.deepEqual(await caret(page), [2, 0]);
  // Backspace at the start joins it to the line above; on an empty line it takes the line away
  await page.keyboard.press('Backspace');
  assert.deepEqual(await lines(page), ['Clear thesis', '# not a heading: symbols stay as typed']);
  assert.deepEqual(await caret(page), [1, 30]);
  await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.press('Backspace');
  assert.equal((await lines(page)).length, 2);
  // Up and Down move between lines
  await page.keyboard.press('ArrowUp');
  assert.equal((await caret(page))[0], 0);
  await page.keyboard.press('ArrowDown');
  assert.equal((await caret(page))[0], 1);
  // Delete at the end brings the next line up
  await line(page, 0); await page.keyboard.press('End'); await page.keyboard.press('Delete');
  assert.deepEqual(await lines(page), ['Clear thesis# not a heading: symbols stay as typed']);
  await page.keyboard.press('Enter');
  assert.deepEqual(await caret(page), [1, 0]);
  await page.keyboard.press('End'); await page.keyboard.press('Enter');
  // pasting several lines makes several lines; a copied time and kind come back
  await page.evaluate(() => { const ta = document.activeElement, d = new DataTransfer(); d.setData('text/plain', 'Evidence is thin\nStrength: good hook\n[1:05] Question: why this source?'); ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: d, bubbles: true, cancelable: true })); });
  assert.deepEqual(await lines(page), ['Clear thesis', '# not a heading: symbols stay as typed', 'Evidence is thin', 'p:good hook', 'q:why this source?@65']);
  assert.deepEqual(await caret(page), [4, 16]);
  // the bar sets the kind of the line in hand, and the same button takes it off
  await line(page, 2);
  await page.click('[data-tnk="n"]');
  assert.equal((await lines(page))[2], 'n:Evidence is thin');
  assert.equal(await page.$eval('[data-tnk="n"]', b => b.getAttribute('aria-pressed')), 'true');
  assert.equal((await caret(page))[0], 2, 'the caret stays in the line');
  assert.equal(await page.$eval('#spBody .tnrow:nth-child(3) .tngut i', e => e.textContent), '→');
  // Ctrl Alt 1 makes a heading, again takes it off
  await line(page, 0);
  await page.keyboard.down('Control'); await page.keyboard.down('Alt'); await page.keyboard.press('Digit1'); await page.keyboard.up('Alt'); await page.keyboard.up('Control');
  assert.equal((await lines(page))[0], 'h:Clear thesis');
  // Backspace at the start of a line with a kind takes the kind off first
  await line(page, 2); await page.keyboard.press('Home'); await page.keyboard.press('Backspace');
  assert.equal((await lines(page))[2], 'Evidence is thin');
  assert.equal((await lines(page)).length, 5);
  // Copy notes: plain text, kinds in words, times in brackets, no name
  assert.equal(await page.evaluate(() => window.__gs.tnText()), 'Clear thesis\n# not a heading: symbols stay as typed\nEvidence is thin\nStrength: good hook\n[1:05] Question: why this source?');
  // one Ctrl Z for a pause in typing
  await line(page, 2); await page.keyboard.press('End');
  await page.keyboard.type(' still'); await calm(page); await calm(page); await calm(page); await calm(page); await calm(page);
  await page.keyboard.type(' here');
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  assert.equal((await stored(page))[2], 'Evidence is thin still');
  assert.equal((await lines(page))[2], 'Evidence is thin still');
  await page.keyboard.down('Control'); await page.keyboard.press('y'); await page.keyboard.up('Control');
  assert.equal((await stored(page))[2], 'Evidence is thin still here');
  // started in the list, with no score
  assert.equal(await page.$eval('#stuList .stu[data-i="0"] .dot', () => true).catch(() => false), true, 'a dot for started');
  assert.equal(await page.$('#stuList .stu[data-i="1"] .dot'), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('headings from the rubric and for every student; clear with undo; reopening keeps the notes', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, await threeZip(), 'Essays.zip');
  await waitPaper(page);
  await openNotes(page);
  const rows = await page.evaluate(() => window.__gs.state().setup.criteria.slice());
  await page.click('[data-tnrub]');
  assert.deepEqual(await lines(page), rows.flatMap(r => ['h:' + r, '']));
  assert.deepEqual(await caret(page), [1, 0]);
  await page.keyboard.type('Organised well');
  await pick(page, '#spBody [data-tnm="head"]');
  assert.deepEqual(await page.evaluate(() => window.__gs.state().setup.tnHead), rows);
  // the next student shows the headings, with nothing stored and nothing started
  await goToStudent(page, 1); await page.waitForSelector('#spBody .tnin'); await calm(page);
  assert.deepEqual(await lines(page), rows.flatMap(r => ['h:' + r, '']));
  assert.equal(await stored(page, 1), null);
  assert.equal(await page.$eval('#spBody .tnhint', e => e.hidden), true);
  await line(page, 3); await page.keyboard.type('Needs a source');
  assert.deepEqual(await stored(page, 1), rows.flatMap((r, i) => ['h:' + r, i === 1 ? 'Needs a source' : '']));
  // the third student is still untouched
  await goToStudent(page, 2); await page.waitForSelector('#spBody .tnin'); await calm(page);
  assert.equal(await stored(page, 2), null);
  // clearing the headings for every student
  await pick(page, '#spBody [data-tnm="unhead"]');
  assert.equal(await page.evaluate(() => 'tnHead' in window.__gs.state().setup), false);
  assert.deepEqual(await lines(page), ['']);
  // clear one student's notes, asked first, and Ctrl Z brings them back
  await goToStudent(page, 1); await page.waitForSelector('#spBody .tnin'); await calm(page);
  await pick(page, '#spBody [data-tnm="clear"]');
  await answerDlg(page);
  await page.waitForFunction(() => !window.__gs.state().batch.students[1].grade.tn);
  assert.deepEqual(await lines(page), ['']);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  assert.equal((await stored(page, 1))[3], 'Needs a source');
  assert.equal((await lines(page))[3], 'Needs a source');
  await settle(page);
  // opened again later: the notes are there, on the pane she last used
  await page.reload();
  await page.waitForSelector('#vHome [data-kopen]'); await page.click('#vHome [data-kopen]');
  await waitPaper(page);
  await goToStudent(page, 0);
  assert.equal((await stored(page, 0))[1], 'Organised well');
  assert.equal((await stored(page, 1))[3], 'Needs a source');
  await openNotes(page);
  assert.equal((await lines(page))[1], 'Organised well');
  assert.deepEqual(page.errors, []);
  await close();
});

test('times: from a playing video file (a click goes back there), from the Timer for a talk given live, and Times off', async () => {
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
  assert.equal(await page.$eval('[data-tntime]', b => b.disabled), false);
  assert.equal(await page.$eval('[data-tntime]', b => b.getAttribute('aria-pressed')), 'true', 'Times is on unless she turns it off');
  // a video not started yet gives no time
  await line(page, 0); await page.keyboard.type('Before it starts');
  assert.deepEqual(await lines(page), ['Before it starts']);
  await page.evaluate(() => { const m = document.querySelector('#paper .media video'); m.muted = true; m.currentTime = 2; });
  await page.waitForFunction(() => document.querySelector('#paper .media video').currentTime >= 2);
  await page.keyboard.press('Enter'); await page.keyboard.type('Eye contact');
  assert.deepEqual(await lines(page), ['Before it starts', 'Eye contact@2']);
  assert.equal(await page.$eval('#spBody .tnchip', e => e.textContent), '0:02');
  // a click on the time plays the video from there
  await page.evaluate(() => { const m = document.querySelector('#paper .media video'); m.pause(); m.currentTime = 0.1; });
  await page.click('#spBody .tnchip');
  await page.waitForFunction(() => document.querySelector('#paper .media video').currentTime >= 1.9);
  await page.evaluate(() => document.querySelector('#paper .media video').pause());
  // the × takes the time off
  await page.hover('#spBody .tnrow:nth-child(2)'); await page.click('#spBody .tnx');
  assert.deepEqual(await lines(page), ['Before it starts', 'Eye contact']);
  // Times off: no time on a new line
  await page.click('[data-tntime]');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.tnTime')), 'false');
  await line(page, 1); await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('Pace');
  assert.deepEqual(await lines(page), ['Before it starts', 'Eye contact', 'Pace']);
  await page.click('[data-tntime]');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.tnTime')), null);
  await settle(page);
  // the partner shares the notes, as they share the comment
  await goToStudent(page, 1); await page.waitForSelector('#spBody .tnin'); await calm(page);
  assert.deepEqual(await stored(page, 1), ['Before it starts', 'Eye contact', 'Pace']);
  assert.deepEqual(await lines(page), ['Before it starts', 'Eye contact', 'Pace']);
  await page.keyboard.press('Escape');

  // a talk given live: a notes page, no video, and the Timer in the bar
  await goToStudent(page, 2); await calm(page);
  await pick(page, '#addNotesBtn'); await page.waitForSelector('#npAdd'); await page.click('#npAdd');
  await page.waitForFunction(() => window.__gs.state().pages.some(q => /notes/i.test(q.file.name)), { timeout: 30000 });
  await page.waitForSelector('#spBody .tn'); await calm(page);
  if (!(await page.$('#spBody .tnin'))) await openNotes(page);
  assert.equal(await page.$eval('#spBody .tnclock', e => e.hidden), false);
  assert.equal(await page.$eval('[data-tntime]', b => b.disabled), false);
  const key = await page.evaluate(() => window.__gs.state().batch.students[2].key);
  await page.evaluate(k => window.__gs.spClockSet(k, 75000), key);
  await page.click('#spBody .tnclock');
  assert.match(await page.$eval('#spBody .tnclock', e => e.textContent), /^❚❚ 1:1[5-6]$/);
  await line(page, 0); await page.keyboard.type('Strong opening');
  assert.match((await lines(page))[0], /^Strong opening@7[5-6]$/);
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
  await setNotes(page, 0, [{ s: 'Delivery', k: 'h' }, { s: 'Steady pace, clear voice', t: 75 }, { s: 'Strong opening question', k: 'p' }, { s: 'Cite the second source', k: 'n' }, { s: 'Why this book?', k: 'q' }]);
  await markPage(page, 0);
  await score(page, [3, 3, 3]);   // a save after the notes keeps the group in step
  await settle(page);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[1].grade.tn.l.length), 5, 'the partner shares the notes');
  await noteDrawing(page);
  const dl = await catchDownloads(page);
  let got = await dl.next(() => page.click('#oneOutBtn'));
  // the feedback page, the notes page, then the paper
  let pdfN = await pdfPages(got.bytes), said = await drawn(page);
  assert.equal(await page.evaluate(() => window.__gs.tnPagesMade()), 1);
  assert.equal(pdfN, 3, 'feedback, notes, paper: ' + pdfN);
  for (const t of ['Notes from your teacher', 'Delivery', 'Steady pace, clear voice', '1:15', 'Strength', 'Strong opening question', 'Next step', 'Cite the second source', 'Question', 'Why this book?', 'Your feedback continues on the next page.', 'Your marked paper starts on the next page.']) assert.ok(said.includes(t), t + ' is on the pages: ' + said.join(' | '));
  assert.ok(!said.some(t => /Strength:/.test(t)), 'the kind is a word in its own column');
  assert.ok(said.indexOf('Notes from your teacher') > said.indexOf('Your feedback continues on the next page.'), 'the notes page comes after the feedback page');
  // the partner gets the page too
  await goToStudent(page, 1);
  got = await dl.next(() => page.click('#oneOutBtn')); said = await drawn(page);
  assert.ok(said.includes('Cite the second source'));

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
  assert.ok(!said.includes('Cite the second source') && !said.includes('Notes from your teacher'));
  assert.ok(said.includes('Your marked paper starts on the next page.'));
  assert.equal(await page.evaluate(() => window.__gs.exportPlan(false).filter(o => o.st.key === 'Cleo Fixture').length), 0, 'notes kept back are nothing to return');
  // and on again from the menu
  await pick(page, '#spBody [data-tnm="back"]');
  assert.equal(await page.evaluate(() => 'tnBack' in window.__gs.state().setup), false);
  assert.deepEqual(page.errors, []);
  await close();
});
