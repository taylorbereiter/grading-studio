// Transcripts beside a video: pasted for any video (a link or a file), or made in this browser for a video file kept here.
// Made-up students, links and words only. The speech engine is never downloaded here: the tests stand in for it.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, waitPaper, goToStudent, settle } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

async function noWeb(page) {
  page.asked = [];
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url(); if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u) || /^(data|blob|about):/.test(u)) return r.continue(); page.asked.push(u); r.abort(); });
}
const idx = (page, key) => page.evaluate(k => window.__gs.state().batch.students.findIndex(s => s.key === k), key);
const threeZip = async () => zipOf({
  'Aria Testwell/Outline.pdf': await makePaper({ title: 'Aria outline' }),
  'Bram Sample/Outline.pdf': await makePaper({ title: 'Bram outline' }),
  'Cleo Fixture/Outline.pdf': await makePaper({ title: 'Cleo outline' }),
});
const makeVideo = (page, name, secs = 1) => page.evaluateHandle(async (name, secs) => {
  const c = document.createElement('canvas'); c.width = 160; c.height = 90; const g = c.getContext('2d');
  const rec = new MediaRecorder(c.captureStream(15), { mimeType: 'video/webm' }), parts = [];
  rec.ondataavailable = e => parts.push(e.data);
  let i = 0; const t = setInterval(() => { g.fillStyle = '#1F6FB2'; g.fillRect(0, 0, 160, 90); g.fillStyle = '#fff'; g.fillRect((i++ * 4) % 140, 30, 20, 20); }, 60);
  rec.start(); await new Promise(r => setTimeout(r, secs * 1000)); rec.stop(); await new Promise(r => { rec.onstop = r; }); clearInterval(t);
  return new File(parts, name, { type: 'video/webm' });
}, name, secs);
const lines = page => page.$$eval('#paper .trbox .trl', els => els.map(e => [e.dataset.t == null ? null : +e.dataset.t, e.textContent]));

test('pasted transcripts are read line by line, with their times, from the ways they usually come', async () => {
  const { page, close } = await openApp(browser);
  const p = s => page.evaluate(s => { const r = window.__gs.trParse(s); return r && r.l; }, s);
  // an AI assistant's answer, with markdown
  assert.deepEqual(await p('**[00:00]** Speaker 1: Good morning, everyone.\n**[00:12]** Today I will talk about tides.\n\n- [01:05] The moon pulls the water.'),
    [['Speaker 1: Good morning, everyone.', 0], ['Today I will talk about tides.', 12], ['The moon pulls the water.', 65]]);
  // YouTube's own transcript: a time alone on a line, then its words
  assert.deepEqual(await p('0:00\nhello and welcome\n0:04\nto my project\non volcanoes\n1:02:03\nthe end'), [['hello and welcome', 0], ['to my project on volcanoes', 4], ['the end', 3723]]);
  // a caption file
  assert.deepEqual(await p('1\n00:00:01,000 --> 00:00:04,200\nFirst caption\nsecond line\n\n2\n00:00:05,500 --> 00:00:07,000\nNext one'), [['First caption second line', 1], ['Next one', 5]]);
  assert.deepEqual(await p('WEBVTT\n\n00:00.000 --> 00:02.500 align:start\n<v Speaker>Hello there\n\n00:03.000 --> 00:05.000\nGoodbye'), [['Hello there', 0], ['Goodbye', 3]]);
  // a range, and plain lines with no time
  assert.deepEqual(await p('2:15 - 2:30 The strong part\nNo time on this one'), [['The strong part', 135], ['No time on this one', null]]);
  assert.equal(await p('   \n\n'), null);
  // a made transcript reads back as lines with times, and pastes back the same
  const back = await page.evaluate(() => { const tr = { w: [[' Hello', 0], [' class.', 0.8], [' Tides', 3.2], [' rise.', 4]] }; const t = window.__gs.trText(tr); return [t, window.__gs.trParse(t).l]; });
  assert.equal(back[0], '[0:00] Hello class. Tides rise.');
  assert.deepEqual(back[1], [['Hello class. Tides rise.', 0]]);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a transcript pasted beside a linked video: lines with times play the video from there, partners share it, it is saved, and it can be taken off', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, await threeZip(), 'Speeches.zip');
  await page.evaluate(async () => { const B = window.__gs.state().batch; await window.__gs.videoAdd(B.students[0], { url: 'https://drive.google.com/file/d/AbCdEfGh123/view', name: 'Presentation video', kind: '', partners: [B.students[1]] }); });
  await page.waitForSelector('#paper .vlink [data-trpaste]');
  assert.equal(await page.$('#paper .vlink [data-trmake]'), null, 'a link is never downloaded, so it can only be pasted');
  assert.match(await page.$eval('#paper .vlink .trbox', e => e.textContent), /don’t share their captions/);
  await page.click('#paper .vlink [data-trpaste]');
  await page.waitForSelector('#paper .trbox textarea');
  await page.$eval('#paper .trbox textarea', (t, v) => { t.value = v; }, '[0:00] Good morning, my talk is on tides.\n[0:42] The moon pulls the sea.\nThank you.');
  await page.click('#paper .trbox [data-trsave]');
  await page.waitForSelector('#paper .trbox .trl');
  assert.deepEqual(await lines(page), [[0, '0:00Good morning, my talk is on tides.'], [42, '0:42The moon pulls the sea.'], [null, 'Thank you.']]);
  assert.match(await page.$eval('#paper .trhead', e => e.textContent), /pasted/);
  // a line plays the video from its time: Drive's player starts there
  await page.click('#paper .trbox .trl[data-t="42"]');
  await page.waitForSelector('#paper .vlslot iframe');
  assert.match(await page.$eval('#paper .vlslot iframe', f => f.getAttribute('src')), /drive\.google\.com\/file\/d\/AbCdEfGh123\/preview\?t=42/);
  // the partner has the same transcript
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.students.slice(0, 2).map(s => s.files.find(f => f.kind === 'link').tr.l.length)), [3, 3]);
  await settle(page);
  // saved with the work: it comes back after reopening, on the partner too
  await page.reload();
  await page.waitForSelector('#vHome [data-kopen]');
  await page.click('#vHome [data-kopen]');
  await waitPaper(page);
  await goToStudent(page, await idx(page, 'Bram Sample'));
  await page.waitForSelector('#paper .trbox .trl');
  assert.equal((await lines(page)).length, 3);
  // changing it
  await page.click('#paper .trbox [data-trpaste]');
  assert.equal(await page.$eval('#paper .trbox textarea', t => t.value), '[0:00] Good morning, my talk is on tides.\n[0:42] The moon pulls the sea.\nThank you.');
  await page.$eval('#paper .trbox textarea', t => { t.value = '[0:05] Only this line now.'; });
  await page.click('#paper .trbox [data-trsave]');
  await page.waitForFunction(() => document.querySelectorAll('#paper .trbox .trl').length === 1);
  // taking it off, and Undo
  await page.click('#paper .trbox [data-trdel]');
  await page.waitForSelector('#paper .trbox [data-trpaste]:not(.link)');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students.some(s => s.files.some(f => f.tr))), false);
  await page.waitForSelector('.toast .tact');
  await page.click('.toast .tact');
  await page.waitForSelector('#paper .trbox .trl');
  assert.deepEqual(await lines(page), [[5, '0:05Only this line now.']]);
  assert.ok(page.asked.every(u => /^https:\/\/drive\.google\.com\//.test(u)), 'only the Drive player, when asked to play: ' + page.asked.join(', '));
  assert.deepEqual(page.errors, []);
  await close();
});

test('a kept video file asks before the one-time download, makes a transcript in this browser, can be cancelled, and a line plays from its word', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, await threeZip(), 'Speeches.zip');
  const vid = await makeVideo(page, 'Cleo talk.webm');
  await page.evaluate(async v => { const B = window.__gs.state().batch; await window.__gs.videoAdd(B.students[2], { file: v, name: 'Presentation video', kind: '', partners: [B.students[0]] }); }, vid);
  await page.waitForSelector('#paper .media [data-trmake]');
  // stand-ins for the speech engine and the sound, so nothing is downloaded: three seconds of sound, two pieces of words
  await page.evaluate(() => {
    window.__runs = 0; window.__hold = false;
    window.__gs.asrStandIn.decode = async () => new Float32Array(16000 * 3).fill(0.1);
    window.__gs.asrStandIn.call = async m => { if (m.type === 'load') return { type: 'ready' }; window.__runs++; if (window.__hold) return new Promise(() => {}); return { type: 'result', words: [[' Hello', 0.2], [' class.', 0.9], [' Tides', 1.6], [' rise.', 2.2]] }; };
  });
  await page.click('#paper .media [data-trmake]');
  await page.waitForSelector('#paper .trask [data-trgo]');
  assert.match(await page.$eval('#paper .trask', e => e.textContent), /downloads a speech engine once, about 150 MB.*nothing is uploaded/);
  // Not now leaves it as it was
  await page.click('#paper .trask [data-trcancel]');
  await page.waitForSelector('#paper .media [data-trmake]');
  assert.equal(await page.evaluate(() => window.__runs), 0);
  await page.click('#paper .media [data-trmake]');
  await page.click('#paper .trask [data-trgo]');
  await page.waitForFunction(() => document.querySelector('#paper .trbox .trans span[data-i]') || document.querySelector('#paper .trerr'));
  assert.equal(await page.$('#paper .trerr'), null, await page.$eval('#paper .trbox', e => e.textContent));
  assert.equal(await page.$eval('#paper .trbox .trans', e => e.textContent.replace(/\s+/g, ' ').trim()), '0:00 Hello class. Tides rise.');
  assert.match(await page.$eval('#paper .trhead', e => e.textContent), /made in this browser/);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.asrHave'))), 1);
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.students.map(s => !!(s.files.find(f => f.kind === 'link') || {}).tr)), [true, false, true], 'the partner has it too');
  // a word plays the video from there
  await page.click('#paper .trbox .trans span[data-i="1"]');
  await page.waitForFunction(() => Math.abs(document.querySelector('#paper .media video').currentTime - 0.9) < 0.25);
  // making it again asks first, then Cancel stops it and keeps the one there was
  await page.evaluate(() => { window.__hold = true; });
  await page.click('#paper .trbox [data-trmake]');
  await page.waitForSelector('#askDlg [data-ok]');
  await page.click('#askDlg [data-ok]');
  await page.waitForSelector('#paper .trmaking [data-trstop]');
  assert.equal(await page.$('#paper .trask'), null, 'no second ask once the engine is here');
  await page.click('#paper .trmaking [data-trstop]');
  await page.waitForSelector('#paper .trbox .trans span[data-i]');
  assert.equal(await page.$('#paper .trmaking'), null);
  assert.deepEqual(page.asked, []);
  assert.deepEqual(page.errors, []);
  await close();
});

test('with names hidden, a transcript line that says the student’s name is blacked out', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, await threeZip(), 'Speeches.zip');
  await page.evaluate(async () => { const B = window.__gs.state().batch, st = B.students[0]; await window.__gs.videoAdd(st, { url: 'https://youtu.be/abcdefgh12', name: 'Presentation video', kind: '', partners: [] }); window.__gs.trSet(st.files.find(f => f.kind === 'link'), window.__gs.trParse('[0:01] Hi, I am Aria Testwell.\n[0:05] My topic is tides.')); });
  await page.evaluate(() => window.__gs.setAnon(true));
  await goToStudent(page, await page.evaluate(() => window.__gs.state().batch.students.findIndex(s => s.files.some(f => f.tr))));
  await page.waitForSelector('#paper .trbox .trl');
  await page.waitForFunction(() => document.querySelectorAll('#paper .trbox .trl.anonhide').length === 1);
  assert.deepEqual(await page.$$eval('#paper .trbox .trl', els => els.map(e => e.classList.contains('anonhide'))), [true, false]);
  assert.deepEqual(page.errors, []);
  await close();
});

test('captions under the video: the line being said, the right way up, stepped by hand where the player can’t say where it is', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, await threeZip(), 'Speeches.zip');
  await page.evaluate(async () => { const st = window.__gs.state().batch.students[0]; await window.__gs.videoAdd(st, { url: 'https://drive.google.com/file/d/AbCdEfGh123/view', name: 'Presentation video', kind: '', partners: [] }); window.__gs.trSet(st.files.find(f => f.kind === 'link'), window.__gs.trParse('[0:01] First line.\n[0:05] Second line.\n[0:09] Third line.')); window.__gs.openStudent(0); });
  await page.waitForSelector('#paper .trbox [data-trcap]');
  assert.equal(await page.$eval('#paper .trcap', e => e.hidden), true, 'off until asked for');
  await page.click('#paper .trbox [data-trcap]');
  assert.equal(await page.$eval('#paper .trcap', e => e.hidden), false);
  assert.ok(await page.$('#paper .mstick .trcap'), 'it sits with the player, so it stays in view');
  assert.equal(await page.$eval('#paper .trcapt', e => e.textContent), 'First line.');
  await page.click('#paper .trcap [data-capgo="1"]');
  assert.equal(await page.$eval('#paper .trcapt', e => e.textContent), 'Second line.');
  await page.click('#paper .trcap [data-capgo="1"]');
  assert.equal(await page.$eval('#paper .trcap [data-capgo="1"]', b => b.disabled), true);
  await page.click('#paper .trcap [data-capgo="-1"]'); await page.click('#paper .trcap [data-capgo="-1"]');
  assert.equal(await page.$eval('#paper .trcapt', e => e.textContent), 'First line.');
  // clicking a line in the transcript makes it the caption
  await page.click('#paper .trbox .trl:nth-child(3)');
  assert.equal(await page.$eval('#paper .trcapt', e => e.textContent), 'Third line.');
  // the choice is kept in this browser
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gs.trCap'))), 1);
  assert.deepEqual(page.errors, []);
  await close();
});
