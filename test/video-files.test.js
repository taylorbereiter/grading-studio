// Video files kept in the browser, partners and videos for the whole class, a resizable player, and bringing in a rubric.
// Made-up students, links and rubrics only. The videos are made in the page (a canvas recorded for a few seconds), never real recordings.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { zipSync, strToU8 } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, waitPaper, goToStudent, settle, classPage } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

async function noWeb(page) {
  page.asked = [];
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url(); if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u) || /^(data|blob|about):/.test(u)) return r.continue(); page.asked.push(u); r.abort(); });
}
const files = page => page.evaluate(() => Object.fromEntries(window.__gs.state().batch.students.map(s => [s.key, s.files.map(f => f.name + ' [' + f.kind + ']' + (f.from ? ' from ' + f.from : ''))])));
const idx = (page, key) => page.evaluate(k => window.__gs.state().batch.students.findIndex(s => s.key === k), key);
// A few seconds of a moving square, recorded from a canvas: a real, playable video with no one in it.
const makeVideo = (page, name, secs = 3) => page.evaluateHandle(async (name, secs) => {
  const c = document.createElement('canvas'); c.width = 160; c.height = 90; const g = c.getContext('2d');
  const rec = new MediaRecorder(c.captureStream(15), { mimeType: 'video/webm' }), parts = [];
  rec.ondataavailable = e => parts.push(e.data);
  let i = 0; const t = setInterval(() => { g.fillStyle = '#1F6FB2'; g.fillRect(0, 0, 160, 90); g.fillStyle = '#fff'; g.fillRect((i++ * 4) % 140, 30, 20, 20); }, 60);
  rec.start(); await new Promise(r => setTimeout(r, secs * 1000)); rec.stop(); await new Promise(r => { rec.onstop = r; }); clearInterval(t);
  return new File(parts, name, { type: 'video/webm' });
}, name, secs);
const threeZip = async () => zipOf({
  'Aria Testwell/Outline.pdf': await makePaper({ title: 'Aria outline' }),
  'Bram Sample/Outline.pdf': await makePaper({ title: 'Bram outline' }),
  'Cleo Fixture/Outline.pdf': await makePaper({ title: 'Cleo outline' }),
});
const keptCount = page => page.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-videos', 1); r.onupgradeneeded = () => r.result.createObjectStore('v'); r.onsuccess = () => { const q = r.result.transaction('v').objectStore('v').count(); q.onsuccess = () => { r.result.close(); res(q.result); }; }; }));

test('a video file is kept in this browser, shared by partners, plays on the card, starts a clip where it is, and comes back after reopening', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, await threeZip(), 'Speeches.zip');
  const vid = await makeVideo(page, 'Aria talk.webm');
  await page.evaluate(async v => { const B = window.__gs.state().batch; await window.__gs.videoAdd(B.students[0], { file: v, name: 'Presentation video', kind: '', partners: [B.students[1]] }); }, vid);
  await page.waitForSelector('#paper .media video');
  assert.deepEqual(await files(page), {
    'Aria Testwell': ['Outline.pdf [pdf]', 'Presentation video.url [link]'],
    'Bram Sample': ['Outline.pdf [pdf]', 'Presentation video.url [link] from Aria Testwell'],
    'Cleo Fixture': ['Outline.pdf [pdf]'],
  });
  const refs = await page.evaluate(() => window.__gs.state().batch.students.slice(0, 2).map(s => window.__gs.vidRef(s.files.find(f => f.kind === 'link').data)));
  assert.ok(refs[0] && refs[0] === refs[1], 'partners share one stored copy');
  assert.equal(await keptCount(page), 1);
  assert.match(await page.$eval('#paper .media video', v => v.src), /^blob:/);
  assert.match(await page.$eval('#paper .media .mhead', e => e.textContent), /Presentation video/);
  assert.ok(await page.$('#paper .media .vgrip'), 'a bar to make it bigger');
  // + Clip starts where the video is
  await page.$eval('#paper .media video', v => new Promise(r => { v.onseeked = r; v.currentTime = 2.2; }));
  await page.click('#paper .media [data-clipnew]');
  assert.equal(await page.$eval('#paper .clipform [data-ca]', e => e.value), '0:02');
  await page.type('#paper .clipform [data-ct]', 'Strong opening');
  await page.click('#paper [data-clipsave]');
  await page.waitForSelector('#paper .clip [data-clipplay]');
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.clips.map(c => [/^gs-video:/.test(c.u), c.a, c.t])), [[true, 2, 'Strong opening']]);
  // shown to the class from the kept file
  await page.click('#paper .clip [data-clipshow]');
  await page.waitForSelector('#clipStage video');
  assert.match(await page.$eval('#clipStage video', v => v.src), /^blob:/);
  await page.keyboard.press('Escape');
  // the link file never goes back with the export
  const out = await page.evaluate(() => window.__gs.exportPlan(true).map(o => o.path));
  assert.ok(!out.some(p => /\.url$|\.webm$/.test(p)), out.join(', '));
  await settle(page);

  await page.reload();
  await page.waitForSelector('#vHome [data-kopen]');
  await page.click('#vHome [data-kopen]');
  await waitPaper(page);
  await goToStudent(page, await idx(page, 'Bram Sample'));
  await page.waitForSelector('#paper .media video');
  assert.match(await page.$eval('#paper .media video', v => v.src), /^blob:/);
  // a browser without the video says so, and takes the file again under the same name
  await page.evaluate(() => new Promise(res => { const r = indexedDB.open('grading-studio-videos', 1); r.onsuccess = () => { const tx = r.result.transaction('v', 'readwrite'); tx.objectStore('v').clear(); tx.oncomplete = () => { r.result.close(); res(); }; }; }));
  await page.evaluate(() => { location.hash = location.hash; });
  await page.reload();
  await page.waitForSelector('#vHome [data-kopen]');
  await page.click('#vHome [data-kopen]');
  await waitPaper(page);
  await page.waitForSelector('#paper [data-vkback]');
  assert.match(await page.$eval('#paper .vfile', e => e.textContent), /isn’t in this browser/);
  assert.deepEqual(page.asked, []);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the video area drags bigger without going full screen, and keeps its size', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, await threeZip(), 'Speeches.zip');
  const vid = await makeVideo(page, 'Cleo talk.webm', 1);
  await page.evaluate(async v => { const B = window.__gs.state().batch; await window.__gs.videoAdd(B.students[2], { file: v, name: 'Presentation video', kind: '', partners: [] }); }, vid);
  await page.waitForSelector('#paper .media video');
  await page.evaluate(() => window.__gs.spClose());   // with the side pane open the bar between the panes sets the size (test/sidepane.test.js)
  await page.waitForFunction(() => document.querySelector('#paper .media video').getBoundingClientRect().height > 20);
  const g = await (await page.$('#paper .media .vgrip')).boundingBox(), h0 = await page.$eval('#paper .media video', v => v.getBoundingClientRect().height);
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2, g.y + 160, { steps: 5 }); await page.mouse.up();
  const h1 = await page.$eval('#paper .media video', v => v.getBoundingClientRect().height);
  assert.ok(h1 > h0 + 100, h0 + ' → ' + h1);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.vidH'))), Math.round(h1));
  assert.equal(await page.evaluate(() => !!document.fullscreenElement), false);
  // the keys work too, and a double-click goes back to the usual size
  await page.focus('#paper .media .vgrip'); await page.keyboard.press('ArrowUp');
  assert.ok(Math.abs(await page.$eval('#paper .media video', v => v.getBoundingClientRect().height) - (h1 - 40)) <= 2);
  await page.click('#paper .media .vgrip', { count: 2, delay: 30 });
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.vidH')), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Partners and videos…: everyone’s partners and links in one list, on any assignment', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, await threeZip(), 'Posters.zip');
  await page.click('#moreBtn'); await page.click('#partnersBtn');
  await page.waitForSelector('#pvList .pvrow');
  assert.equal(await page.$$eval('#pvList .pvrow', r => r.length), 3);
  assert.equal(await page.$eval('#pvGo', b => b.disabled), true, 'nothing to save yet');
  // Aria and Bram work together, with a link; Cleo is on her own with a link of her own
  await page.click('#pvList [data-pvp="0"]');
  await page.click('#pvList [data-pvto="1"]');
  await page.click('#pvList [data-pvdone]');
  assert.match(await page.$eval('#pvList [data-pvp="0"]', b => b.textContent), /With:\s*Bram Sample/);
  assert.match(await page.$eval('#pvList [data-pvp="1"]', b => b.textContent), /With:\s*Aria Testwell/);
  await page.type('#pvList [data-pvlink="0"]', 'https://youtu.be/abcDEF12345');
  await page.keyboard.press('Tab');
  assert.match(await page.$eval('#pvList .pvrow:nth-child(2) .pvvid', e => e.textContent), /Same video as:\s*Aria Testwell/);
  await page.type('#pvList [data-pvlink="2"]', 'not a link');
  assert.equal(await page.$eval('#pvGo', b => b.disabled), true, 'words are not a link');
  await page.$eval('#pvList [data-pvlink="2"]', e => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('#pvList [data-pvlink="2"]', 'https://vimeo.com/123456789');
  await page.click('#pvGo');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  assert.deepEqual(await files(page), {
    'Aria Testwell': ['Outline.pdf [pdf]', 'Presentation video.url [link]'],
    'Bram Sample': ['Outline.pdf [pdf]', 'Presentation video.url [link] from Aria Testwell'],
    'Cleo Fixture': ['Outline.pdf [pdf]', 'Presentation video.url [link]'],
  });
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.groups.map(g => g.k)), [['Aria Testwell', 'Bram Sample']]);
  // the list again shows what each one has, and the group
  await page.click('#moreBtn'); await page.click('#partnersBtn');
  await page.waitForSelector('#pvList .pvrow');
  assert.match(await page.$eval('#pvList .pvrow:nth-child(1) .pvvid', e => e.textContent), /Presentation video · youtu\.be/);
  assert.match(await page.$eval('#pvList [data-pvp="0"]', b => b.textContent), /With:\s*Bram Sample/);
  assert.deepEqual(page.asked, []);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the opening screen: no papers, with the videos and partners picked right there', async () => {
  const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture'];
  const lib = { classes: [{ id: 'c1', name: '10 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [{ id: 'i1', name: 'Persuasive speech', classId: 'c1', type: 'sum' }] }] }], loose: { id: '', name: '', names: [], units: [] }, seed2627: true };
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(lib) } } });
  await noWeb(page);
  await classPage(page, 'i1'); await page.waitForSelector('[data-open-asg="i1"]'); await page.click('[data-open-asg="i1"]');
  await page.waitForSelector('#dlgBox [data-nopaper]'); await page.click('#dlgBox [data-nopaper]');
  await page.waitForSelector('#pvList .pvrow');
  await page.click('#pvList [data-pvp="1"]'); await page.click('#pvList [data-pvto="2"]'); await page.click('#pvList [data-pvdone]');
  await page.type('#pvList [data-pvlink="1"]', 'https://drive.google.com/file/d/1MadeUpMadeUpMadeUpMadeUp0000/view');
  // a file dropped on the list goes to the student named in it
  const vid = await makeVideo(page, 'Aria Testwell speech.webm', 1);
  await page.evaluate(v => { const dt = new DataTransfer(); dt.items.add(v); document.querySelector('#dlgBox').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }, vid);
  await page.waitForSelector('#pvList .pvfile');
  assert.match(await page.$eval('#pvList .pvrow:nth-child(1) .pvvid', e => e.textContent), /Aria Testwell speech\.webm/);
  await page.click('#snGo');
  await waitPaper(page);
  await page.waitForFunction(() => window.__gs.state().batch.students.every(s => s.files.some(f => f.kind === 'link')), { timeout: 30000 });
  const got = await files(page);
  assert.deepEqual(got['Aria Testwell'], ['Persuasive speech notes.pdf [pdf]', 'Presentation video.url [link]']);
  assert.deepEqual(got['Bram Sample'], ['Persuasive speech notes.pdf [pdf]', 'Presentation video.url [link]']);
  assert.deepEqual(got['Cleo Fixture'], ['Persuasive speech notes.pdf [pdf]', 'Presentation video.url [link] from Bram Sample']);
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.groups.map(g => g.k)), [['Bram Sample', 'Cleo Fixture']]);
  assert.equal(await keptCount(page), 1);
  assert.deepEqual(page.asked, []);
  assert.deepEqual(page.errors, []);
  await close();
});

// A Word rubric with levels across the top, as many teachers write them.
function rubricDocx() {
  const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', f = s => strToU8(s);
  const cell = t => '<w:tc><w:p><w:r><w:t xml:space="preserve">' + t + '</w:t></w:r></w:p></w:tc>', row = cs => '<w:tr>' + cs.map(cell).join('') + '</w:tr>';
  const tbl = '<w:tbl>' + row(['Criteria', '4', '3', '2', '1']) + row(['Voice', 'Clear and confident', 'Mostly clear', 'Hard to hear', 'Not heard']) + row(['Evidence', 'Strong, relevant evidence', 'Some evidence', 'Little evidence', 'None']) + row(['Structure', 'Logical and smooth', 'Mostly logical', 'Hard to follow', 'No order']) + '</w:tbl>';
  return zipSync({
    '[Content_Types].xml': f(HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': f(HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': f(HEAD + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Speech rubric</w:t></w:r></w:p>' + tbl + '</w:body></w:document>'),
  });
}
// The same rubric as a PDF made from a document: words where a table's boxes would be.
async function rubricPdf() {
  const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica), pg = doc.addPage([792, 612]);
  const put = (t, x, y) => pg.drawText(t, { x, y, size: 10, font });
  put('Speech rubric', 40, 570);
  [['Criteria', 40], ['4', 220], ['3', 360], ['2', 500], ['1', 640]].forEach(([t, x]) => put(t, x, 530));
  const rows = [['Voice', ['Clear and', 'confident'], ['Mostly clear'], ['Hard to hear'], ['Not heard']], ['Evidence', ['Strong, relevant', 'evidence'], ['Some evidence'], ['Little evidence'], ['None']], ['Structure', ['Logical and', 'smooth'], ['Mostly logical'], ['Hard to follow'], ['No order']]];
  rows.forEach((r, k) => { const y = 490 - k * 70; put(r[0], 40, y); [220, 360, 500, 640].forEach((x, c) => r[c + 1].forEach((ln, j) => put(ln, x, y - j * 13))); });
  return doc.save();
}

test('a rubric brought in from Word or a PDF fills in its rows and what each level means, on any assignment', async () => {
  const lib = { classes: [{ id: 'c1', name: '10 English', names: ['Aria Testwell'], units: [{ id: 'u1', name: 'Unit 1', items: [{ id: 'i1', name: 'Persuasive speech', classId: 'c1', type: 'sum' }] }] }], loose: { id: '', name: '', names: [], units: [] }, seed2627: true };
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(lib) } } });
  const word = Buffer.from(rubricDocx()).toString('base64'), pdf = Buffer.from(await rubricPdf()).toString('base64');
  const read = (b64, name) => page.evaluate(async (b64, name) => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const r = await window.__gs.rubricRead(new File([u], name)); return { rows: r.rows, top: r.top, word: r.word }; }, b64, name);
  const want = [['Voice', 'Clear and confident', 'Not heard'], ['Evidence', 'Strong, relevant evidence', 'None'], ['Structure', 'Logical and smooth', 'No order']];
  for (const r of [await read(word, 'Speech rubric.docx'), await read(pdf, 'Speech rubric.pdf')]) {
    assert.equal(r.top, 4);
    assert.deepEqual(r.rows.map(x => [x.name, x.levels[4], x.levels[1]]), want);
  }
  // on the assignment's own box: Bring in a rubric…, tick, Save
  await classPage(page, 'i1');
  await page.waitForSelector('[data-edit-asg="i1"]');
  await page.$eval('[data-edit-asg="i1"]', b => b.click());
  await page.waitForSelector('#ruPick');
  assert.match(await page.$eval('#ruSays', e => e.textContent), /Not set yet/);
  const [chooser] = await Promise.all([page.waitForFileChooser(), page.click('#ruPick')]);
  const fs = require('fs'), os = require('os'), path = require('path'), tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gs-rub-')), 'Speech rubric.docx');
  fs.writeFileSync(tmp, rubricDocx());
  await chooser.accept([tmp]);
  await page.waitForSelector('#ruGot:not([hidden]) #ruRows');
  assert.match(await page.$eval('#ruGot', e => e.textContent), /Rows found in it:\s*Voice/);
  assert.equal(await page.$eval('#ruRows', e => e.checked), true);
  assert.equal(await page.$eval('#ruCopy', e => e.checked), false);
  await page.click('#dlgBox [data-ok]');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  const su = await page.evaluate(() => window.__gs.state().lib.classes[0].units[0].items[0].setup);
  assert.equal(su.mode, 'rubric');
  assert.deepEqual(su.criteria, ['Voice', 'Evidence', 'Structure']);
  assert.equal(su.levels[0][4], 'Clear and confident');
  assert.equal(su.rubricPage, undefined, 'no copy unless ticked');
  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  assert.deepEqual(page.errors, []);
  await close();
});

test('a rubric copy brought in after the notes pages are taken out or removed goes on the paper, not into Removed', async () => {
  const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture'];
  const lib = { classes: [{ id: 'c1', name: '10 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [{ id: 'i1', name: 'Speech video', classId: 'c1', type: 'sum', setup: { mode: 'rubric', criteria: ['Voice', 'Evidence'], outOf: 8 } }] }] }], loose: { id: '', name: '', names: [], units: [] }, seed2627: true };
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(lib) } } });
  await classPage(page, 'i1'); await page.waitForSelector('[data-open-asg="i1"]'); await page.click('[data-open-asg="i1"]');
  await page.waitForSelector('#dlgBox [data-nopaper]'); await page.click('#dlgBox [data-nopaper]');
  await page.waitForSelector('#snGo'); await page.click('#dlgBox .nptile[data-np="rubric"]'); await page.click('#snGo');
  await waitPaper(page);
  // Aria: every notes page taken out with ×. Bram: the notes file removed. Cleo: left as it is.
  await goToStudent(page, await idx(page, 'Aria Testwell'));
  for (let k = 0; k < 10 && await page.$('#paper [data-pgout]'); k++) {
    const n = await page.$$eval('#paper [data-pgout]', b => b.length);
    await page.$eval('#paper [data-pgout]', b => b.click());
    await page.waitForFunction(n => document.querySelectorAll('#paper [data-pgout]').length < n, {}, n);
  }
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.students[window.__gs.state().cur].layout), []);
  await page.evaluate(() => { const st = window.__gs.state().batch.students.find(s => s.key === 'Bram Sample'); return window.__gs.removeFile(st, st.files[0].path, true); });
  const pdf = Buffer.from(await rubricPdf()).toString('base64');
  await page.evaluate(b64 => window.__gs.openSetup({ page: { bytes: Uint8Array.from(atob(b64), c => c.charCodeAt(0)), name: 'Speech rubric.pdf' } }), pdf);
  await page.waitForSelector('#dlgBox [data-save]'); await page.click('#dlgBox [data-save]');
  await page.waitForFunction(() => window.__gs.state().batch.students.every(s => s.files.some(f => f.virtual)));
  const got = await page.evaluate(() => window.__gs.state().batch.students.map(st => {
    const L = window.__gs.layoutOf(st), on = new Set(L.flatMap(d => d.pages.map(([q, p]) => q + '|' + p))), rp = st.files.find(f => f.virtual);
    return [st.key, rp.name, [...Array(rp.numPages).keys()].every(p => on.has(rp.path + '|' + p))];
  }));
  assert.deepEqual(got, NAMES.map(n => [n, 'Rubric page', true]), 'everyone’s copy is on their paper');
  await goToStudent(page, await idx(page, 'Aria Testwell'));
  await page.waitForSelector('#paper canvas');
  assert.doesNotMatch(await page.$eval('#paper', e => e.textContent), /your rubric page/, 'not waiting under Removed pages');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a video filmed sideways turns the right way up, a quarter turn at a time, kept for that video (partners share the link), and stays turned', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  const url = u => strToU8('[InternetShortcut]\r\nURL=' + u + '\r\n');
  await openZip(page, zipOf({
    'Ada Example/Outline.pdf': await makePaper({ title: 'Ada outline' }),
    'Aria Testwell/Speech.url': url('https://www.youtube.com/watch?v=madeup12345'),
    'Bram Sample/Speech.url': url('https://drive.google.com/file/d/madeupDriveId123/view'),
  }), 'Speech.zip');
  await goToStudent(page, await idx(page, 'Aria Testwell'));
  await page.waitForSelector('#paper .vlink [data-vrot]');
  await page.click('#paper .vlink [data-vrot]');   // turns, and opens the player
  await page.waitForSelector('#paper .vrotbox.on iframe');
  const look = () => page.$eval('#paper .vrotbox', b => { const f = b.firstElementChild, r = b.getBoundingClientRect(), q = f.getBoundingClientRect(); return { turn: b.dataset.turn, t: f.style.transform, bw: Math.round(r.width), bh: Math.round(r.height), fw: Math.round(q.width), fh: Math.round(q.height) }; });
  let L = await look();
  assert.equal(L.turn, '90'); assert.equal(L.t, 'rotate(90deg)');
  assert.ok(Math.abs(L.fw - L.bw) <= 2 && Math.abs(L.fh - L.bh) <= 2, 'the turned player fills the box exactly: ' + JSON.stringify(L));
  assert.equal(await page.$('#paper .vrnote'), null, 'YouTube says nothing about captions');
  for (const want of ['180', '270', '0', '90']) { await page.click('#paper .vlink [data-vrot]'); assert.equal((await look()).turn, want); }
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.vrot), { 'https://www.youtube.com/watch?v=madeup12345': 90 });
  // the size bar still drags the turned video bigger
  const g = await (await page.$('#paper .vgrip')).boundingBox(), h0 = L.bh;
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await page.mouse.down(); await page.mouse.move(g.x + g.width / 2, g.y + 120, { steps: 4 }); await page.mouse.up();
  await page.waitForFunction(h0 => document.querySelector('#paper .vrotbox').getBoundingClientRect().height > h0 + 60, {}, h0);
  L = await look(); assert.ok(Math.abs(L.fw - L.bw) <= 2 && Math.abs(L.fh - L.bh) <= 2, 'still fits after resizing: ' + JSON.stringify(L));
  // Drive draws its own captions: turned, the card says they turn with it
  await goToStudent(page, await idx(page, 'Bram Sample'));
  await page.waitForSelector('#paper .vlink [data-vrot]');
  assert.equal(await page.$eval('#paper .vrnote', e => e.hidden), true);
  await page.click('#paper .vlink [data-vrot]');
  assert.equal(await page.$eval('#paper .vrnote', e => e.hidden), false);
  await settle(page);
  await page.reload(); await page.waitForSelector('#vHome [data-kopen]'); await page.click('#vHome [data-kopen]');
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.batch && s.batch.students.length === 3 && !document.querySelector('#app').hidden; }, { timeout: 60000 });
  assert.deepEqual(await page.evaluate(() => window.__gs.vrotOf(window.__gs.state().batch.students.find(s => s.key === 'Aria Testwell').files[0])), 90, 'kept after reopening');
  assert.deepEqual(page.errors, []);
  await close();
});
