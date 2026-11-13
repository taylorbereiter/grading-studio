// Work with no paper: a video by its link, the partners in it, and a notes page to write on. Made-up students and made-up links only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, waitPaper, goToStudent, score, settle, setTool, drag, pick, classPage } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const LINK = 'https://drive.google.com/file/d/1MadeUpMadeUpMadeUpMadeUp0000/view?usp=sharing';
// Nothing outside the test's own address is ever fetched: a player's address is only checked, never loaded.
async function noWeb(page) {
  page.asked = [];
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url(); if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u) || /^(data|blob|about):/.test(u)) return r.continue(); page.asked.push(u); r.abort(); });
}
const files = page => page.evaluate(() => Object.fromEntries(window.__gs.state().batch.students.map(s => [s.key, s.files.map(f => f.name + ' [' + f.kind + ']' + (f.from ? ' from ' + f.from : ''))])));
const idx = (page, key) => page.evaluate(k => window.__gs.state().batch.students.findIndex(s => s.key === k), key);
const marksOn = (page, key, rx) => page.evaluate((k, rx) => { const f = window.__gs.state().batch.students.find(s => s.key === k).files.find(f => new RegExp(rx).test(f.name)); return f ? Object.values(f.marks).reduce((n, a) => n + a.length, 0) : -1; }, key, rx);

test('the parts: a link is read from a shortcut file, cleaned, and matched to the site’s own player', async () => {
  const { page, close } = await openApp(browser);
  const r = await page.evaluate(async () => {
    const G = window.__gs, enc = s => new TextEncoder().encode(s);
    const notes = await G.notesPdf('rubric', 'Persuasive speech', ['Voice', 'Evidence', 'Structure']), zh = await G.notesPdf('lined', '說服性演講', []);
    const pages = async b => { const d = await pdfjsLib.getDocument({ data: b.slice(), isEvalSupported: false }).promise, t = (await (await d.getPage(1)).getTextContent()).items.map(x => x.str).join(' '), n = d.numPages; d.destroy(); return [n, t]; };
    return {
      url: G.linkOf(enc('[InternetShortcut]\r\nURL=https://example.com/v/1?a=1&b=2\r\n')),
      webloc: G.linkOf(enc('<?xml version="1.0"?><plist><dict><key>URL</key><string>https://example.com/v?a=1&amp;b=2</string></dict></plist>')),
      script: G.linkOf(enc('[InternetShortcut]\nURL=javascript:alert(1)\n')),
      file: G.linkOf(enc('[InternetShortcut]\nURL=file:///C:/Users/x/secret.txt\n')),
      bare: G.linkClean('drive.google.com/file/d/abcdef123456/view'),
      words: G.linkClean('not a link'),
      drive: G.linkPlayer('https://drive.google.com/file/d/1MadeUpMadeUpMadeUp/view?usp=sharing'),
      driveOpen: G.linkPlayer('https://drive.google.com/open?id=1MadeUpMadeUpMadeUp'),
      yt: G.linkPlayer('https://www.youtube.com/watch?v=abcDEF12345&t=10s'), ytShort: G.linkPlayer('https://youtu.be/abcDEF12345'),
      vimeo: G.linkPlayer('https://vimeo.com/123456789'), slides: G.linkPlayer('https://docs.google.com/presentation/d/1MadeUpDeck00000/edit#slide=id.p'),
      mp4: G.linkPlayer('https://example.com/clips/talk.mp4'), other: G.linkPlayer('https://example.com/watch/123'),
      notes: G.isNotes(notes), notPaper: G.isNotes(enc('%PDF-1.7 just some other file, long enough to be looked at by the check, with nothing at its end')),
      rubric: await pages(notes), zh: (await pages(zh))[0],
    };
  });
  assert.equal(r.url, 'https://example.com/v/1?a=1&b=2');
  assert.equal(r.webloc, 'https://example.com/v?a=1&b=2');
  assert.equal(r.script, '', 'only web links');
  assert.equal(r.file, '');
  assert.equal(r.bare, 'https://drive.google.com/file/d/abcdef123456/view');
  assert.equal(r.words, '');
  assert.deepEqual(r.drive, { frame: 'https://drive.google.com/file/d/1MadeUpMadeUpMadeUp/preview' });
  assert.deepEqual(r.driveOpen, r.drive);
  assert.deepEqual(r.yt, { frame: 'https://www.youtube-nocookie.com/embed/abcDEF12345' });
  assert.deepEqual(r.ytShort, r.yt);
  assert.deepEqual(r.vimeo, { frame: 'https://player.vimeo.com/video/123456789' });
  assert.deepEqual(r.slides, { frame: 'https://docs.google.com/presentation/d/1MadeUpDeck00000/embed' });
  assert.deepEqual(r.mp4, { video: 'https://example.com/clips/talk.mp4' });
  assert.equal(r.other, null, 'any other site opens in its own window');
  assert.equal(r.notes, true); assert.equal(r.notPaper, false);
  assert.equal(r.rubric[0], 1);
  for (const w of ['Persuasive speech', 'Voice', 'Evidence', 'Structure', 'Other notes']) assert.match(r.rubric[1], new RegExp(w));
  assert.equal(r.zh, 1, 'a title in another alphabet still makes a page');
  assert.deepEqual(page.errors, []);
  await close();
});

test('A video…: the link, a notes page and a partner; marks and the grade are the group’s; nothing is fetched until Play; kept after reopening', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, zipOf({
    'Aria Testwell/Outline.pdf': await makePaper({ title: 'Aria outline' }),
    'Bram Sample/Outline.pdf': await makePaper({ title: 'Bram outline' }),
    'Cleo Fixture/Outline.pdf': await makePaper({ title: 'Cleo outline' }),
  }), 'Speeches.zip');
  await waitPaper(page);
  await pick(page, '#addVideoBtn');
  await page.waitForSelector('#vdLink');
  assert.equal(await page.$eval('#vdAdd', b => b.disabled), true);
  await page.type('#vdLink', 'not a link');
  assert.equal(await page.$eval('#vdAdd', b => b.disabled), true, 'words are not a link');
  await page.$eval('#vdLink', e => { e.value = ''; });
  await page.type('#vdLink', LINK);
  assert.equal(await page.$eval('#dlgBox .nptile[aria-pressed=true]', b => b.dataset.np), 'lined', 'a lined notes page to begin with');
  await page.click('#dlgBox .nptile[data-np="cols"]');
  await page.click('#dlgBox [data-vdto="' + await idx(page, 'Bram Sample') + '"]');
  assert.match(await page.$eval('#vdAdd', b => b.textContent), /Aria Testwell and 1 partner/);
  await page.click('#vdAdd');
  await page.waitForSelector('#paper .vlink');
  await page.waitForFunction(() => window.__gs.state().pages.some(q => /notes/.test(q.file.name)), { timeout: 30000 });
  assert.deepEqual(await files(page), {
    'Aria Testwell': ['Outline.pdf [pdf]', 'Presentation video.url [link]', 'Presentation notes.pdf [pdf]'],
    'Bram Sample': ['Outline.pdf [pdf]', 'Presentation video.url [link] from Aria Testwell', 'Presentation notes.pdf [pdf] from Aria Testwell'],
    'Cleo Fixture': ['Outline.pdf [pdf]'],
  });
  assert.match(await page.$eval('#grpBand', e => e.textContent), /with Bram Sample · marks and grade shared/);
  assert.match(await page.$eval('#paper .vlink .mhead', e => e.textContent), /Presentation video\s*drive\.google\.com/);
  assert.deepEqual(page.asked, [], 'only the link is kept: nothing is asked of the site');
  assert.equal(await page.$('#paper .vlink iframe'), null);
  await page.click('#paper .vlink [data-vplay]');
  assert.equal(await page.$eval('#paper .vlink iframe', f => f.getAttribute('src')), 'https://drive.google.com/file/d/1MadeUpMadeUpMadeUpMadeUp0000/preview');
  await page.click('#paper .vlink [data-vplay]');
  assert.equal(await page.$('#paper .vlink iframe'), null, 'Close the player takes it away');
  assert.deepEqual(page.asked, ['https://drive.google.com/file/d/1MadeUpMadeUpMadeUpMadeUp0000/preview'], 'Play asked for the player, and nothing else');
  page.asked.length = 0;

  // a mark on Aria's notes page is on Bram's; a score on Bram is Aria's too
  const k = await page.evaluate(() => window.__gs.state().pages.findIndex(q => /notes/.test(q.file.name)));
  await setTool(page, 'pen'); await drag(page, k, [[120, 300], [180, 330], [240, 300]]); await setTool(page, 'select');
  await goToStudent(page, await idx(page, 'Bram Sample'));
  await page.waitForSelector('#grpBand');
  await score(page, [4, 3, 3]);
  await settle(page);
  assert.equal(await marksOn(page, 'Bram Sample', 'notes'), 1);
  assert.equal(await page.evaluate(() => window.__gs.gradeOf(window.__gs.state().batch.students.find(s => s.key === 'Aria Testwell')).total), 10);
  // the link is not a paper: it doesn't go back with the export, the notes page does
  const out = await page.evaluate(() => window.__gs.exportPlan(true).map(o => o.path));
  assert.ok(out.some(p => /Aria Testwell\/Presentation notes\.pdf$/.test(p)), out.join(', '));
  assert.ok(!out.some(p => /\.url$/.test(p)), out.join(', '));

  await page.reload();
  await page.waitForSelector('#vHome [data-kopen]');
  await page.click('#vHome [data-kopen]');
  await waitPaper(page);
  await goToStudent(page, await idx(page, 'Bram Sample'));
  await page.waitForSelector('#paper .vlink');
  assert.match(await page.$eval('#grpBand', e => e.textContent), /with Aria Testwell/);
  assert.equal(await marksOn(page, 'Bram Sample', 'notes'), 1);
  assert.equal((await files(page))['Bram Sample'][1], 'Presentation video.url [link] from Aria Testwell');
  // a partner brought in later through Group work… gets the group's video as well
  await goToStudent(page, await idx(page, 'Aria Testwell'));
  await page.waitForFunction(() => window.__gs.state().pages.some(q => /notes/.test(q.file.name)));
  await page.evaluate(() => { const st = window.__gs.state().batch.students[window.__gs.state().cur]; document.querySelector('#paper [data-shfile="' + CSS.escape(st.files.find(f => /notes/.test(f.name)).path) + '"]').click(); });
  await page.waitForSelector('#grpOnce');
  const ci = await idx(page, 'Cleo Fixture');
  await page.click('#dlgBox [data-shto="' + ci + '"]');
  await page.waitForFunction(i => /In the group/.test(document.querySelector('#dlgBox [data-shto="' + i + '"]').textContent), {}, ci);
  await page.waitForFunction(() => window.__gs.state().batch.students.find(s => s.key === 'Cleo Fixture').files.some(f => f.kind === 'link'));
  assert.deepEqual(page.asked, []);
  assert.deepEqual(page.errors, []);
  await close();
});

test('an assignment with no papers: a notes page for everyone on the roster, and a second one of the same name starts empty', async () => {
  const NAMES = ['Aria Testwell', 'Bram Sample', 'Cleo Fixture'], SETUP = { mode: 'rubric', criteria: ['Voice', 'Evidence', 'Structure'], outOf: 12 };
  const lib = { classes: [{ id: 'c1', name: '10 English', names: NAMES, units: [{ id: 'u1', name: 'Unit 1', items: [{ id: 'i1', name: 'Persuasive speech', classId: 'c1', type: 'sum', setup: SETUP }, { id: 'i2', name: 'Persuasive speech', classId: 'c1', type: 'sum', setup: SETUP }] }] }], loose: { id: '', name: '', names: [], units: [] }, seed2627: true };
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.lib': JSON.stringify(lib) } } });
  const start = async id => {
    await classPage(page, id); await page.waitForSelector('[data-open-asg="' + id + '"]'); await page.click('[data-open-asg="' + id + '"]');
    await page.waitForSelector('#dlgBox [data-nopaper]'); await page.click('#dlgBox [data-nopaper]');
    await page.waitForSelector('#snGo');
    await page.click('#dlgBox .nptile[data-np="rubric"]');
    await page.click('#snGo');
    await waitPaper(page);
  };
  await start('i1');
  assert.deepEqual(await files(page), Object.fromEntries(NAMES.map(n => [n, ['Persuasive speech notes.pdf [pdf]']])));
  assert.ok(await page.evaluate(() => window.__gs.state().batch.students.every(s => window.__gs.isNotes(s.files[0].data))));
  assert.equal(await page.evaluate(() => window.__gs.state().batch.assignment.id), 'i1');
  await score(page, [4, 4, 3]);
  await settle(page);
  const first = await page.evaluate(() => window.__gs.state().batch.id);
  // the video joins a student who already has their page: no second page, and the partner keeps their own
  await pick(page, '#addVideoBtn');
  await page.waitForSelector('#vdLink');
  assert.equal(await page.$eval('#dlgBox .nptile[aria-pressed=true]', b => b.dataset.np), '', 'they have a notes page already');
  await page.type('#vdLink', 'https://example.com/watch/made-up');
  await page.click('#dlgBox [data-vdto="1"]');
  await page.click('#vdAdd');
  await page.waitForSelector('#paper .vlink');
  assert.equal(await page.$('#paper .vlink [data-vplay]'), null, 'a site with no player of its own opens in its own window');
  assert.deepEqual((await files(page))['Bram Sample'], ['Persuasive speech notes.pdf [pdf]', 'Presentation video.url [link] from Aria Testwell']);
  assert.match(await page.$eval('#grpBand', e => e.textContent), /with Bram Sample · marks and grade shared/);
  await settle(page);
  // the same name again in the same class is its own assignment
  await page.reload();
  await start('i2');
  assert.notEqual(await page.evaluate(() => window.__gs.state().batch.id), first);
  assert.match((await files(page))['Aria Testwell'].join(), /^Persuasive speech notes( \(2\))?\.pdf \[pdf\]$/);   // a new name only when the two would otherwise be taken for the same download
  assert.equal(await page.evaluate(() => window.__gs.gradeOf(window.__gs.state().batch.students[0]).total), null, 'no score carried in');
  assert.deepEqual(page.errors, []);
  await close();
});

test('A notes page… on its own, and a shortcut file a student turned in opens as a link', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, zipOf({
    'Aria Testwell/Outline.pdf': await makePaper({ title: 'Aria outline' }),
    'Bram Sample/My talk.url': new TextEncoder().encode('[InternetShortcut]\r\nURL=https://youtu.be/abcDEF12345\r\n'),
  }), 'Talks.zip');
  await goToStudent(page, 1);
  await page.waitForSelector('#paper .vlink');
  assert.deepEqual((await files(page))['Bram Sample'], ['My talk.url [link]']);
  assert.match(await page.$eval('#paper .vlink .mhead', e => e.textContent), /My talk\s*youtu\.be/);
  await pick(page, '#addNotesBtn');
  await page.waitForSelector('#npAdd');
  assert.equal(await page.$eval('#dlgBox .nptile[data-np="rubric"]', b => b.disabled), false);
  await page.click('#dlgBox .nptile[data-np="blank"]');
  await page.click('#npAdd');
  await page.waitForFunction(() => window.__gs.state().pages.some(q => q.file.name === 'Notes.pdf'), { timeout: 30000 });
  assert.deepEqual((await files(page))['Bram Sample'], ['My talk.url [link]', 'Notes.pdf [pdf]']);
  assert.deepEqual(page.asked, []);
  assert.deepEqual(page.errors, []);
  await close();
});

test('clips: two times and a label saved on a video, played from there, shown to the class without a name, shared by partners, kept after reopening', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, zipOf({
    'Aria Testwell/Outline.pdf': await makePaper({ title: 'Aria outline' }),
    'Bram Sample/Outline.pdf': await makePaper({ title: 'Bram outline' }),
  }), 'Talks.zip');
  await waitPaper(page);
  assert.equal(await page.$eval('#clipsBtn', b => b.hidden), true, 'no clips yet');
  assert.deepEqual(await page.evaluate(() => [window.__gs.clipSecs('2:15'), window.__gs.clipSecs('75'), window.__gs.clipSecs('1:02:03'), window.__gs.clipSecs(''), isNaN(window.__gs.clipSecs('soon'))]), [135, 75, 3723, null, true]);
  await page.evaluate(() => { const G = window.__gs, S = G.state().batch.students; return G.videoAdd(S[0], { url: 'https://youtu.be/abcDEF12345', name: 'Presentation video', kind: '', partners: [S[1]] }); });
  await page.waitForSelector('#paper .vlink [data-clipnew]');
  await page.click('#paper .vlink [data-clipnew]');
  await page.type('#paper .clipform [data-ca]', '2:50');
  await page.type('#paper .clipform [data-cb]', '2:15');
  await page.click('#paper [data-clipsave]');
  assert.equal(await page.evaluate(() => (window.__gs.state().batch.clips || []).length), 0, 'an end before the start is not a clip');
  await page.$eval('#paper .clipform [data-ca]', e => { e.value = '2:15'; }); await page.$eval('#paper .clipform [data-cb]', e => { e.value = '2:50'; });
  await page.type('#paper .clipform [data-ct]', 'Strong opening');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#paper .clip [data-clipplay]');
  assert.match(await page.$eval('#paper .clip [data-clipplay]', b => b.textContent), /Strong opening\s*2:15–2:50/);
  assert.deepEqual(page.asked, [], 'saving a clip asks nothing of the site');
  await page.click('#paper .clip [data-clipplay]');
  // the card's player is asked where it is (YouTube's own embed messages), so a new clip starts there
  assert.match(await page.$eval('#paper .vlink iframe', f => f.getAttribute('src')), /^https:\/\/www\.youtube-nocookie\.com\/embed\/abcDEF12345\?start=135&end=170&autoplay=1&enablejsapi=1&origin=http%3A%2F%2F(127\.0\.0\.1|localhost)%3A\d+$/);
  // on the class's screen: the label and the times, never the student
  await page.click('#paper .clip [data-clipshow]');
  await page.waitForSelector('#clipStage iframe');
  const stage = await page.$eval('#clipStage', e => e.textContent);
  assert.match(stage, /Strong opening/); assert.match(stage, /2:15 to 2:50/);
  assert.ok(!/Aria|Testwell|Bram|Sample/.test(stage), stage);
  assert.equal(await page.$eval('#clipStage iframe', f => f.getAttribute('src')), 'https://www.youtube-nocookie.com/embed/abcDEF12345?start=135&end=170&autoplay=1');
  await page.keyboard.press('Escape');
  assert.equal(await page.$('#clipStage'), null);
  assert.equal(await page.evaluate(() => window.__gs.state().cur), 0, 'the keys stayed with the clip');
  assert.equal(await page.$eval('#clipsBtn', b => b.hidden), false, 'Setup has Clips to show the class');
  await settle(page);
  // the partner has the same link, so the same clip
  await goToStudent(page, 1);
  await page.waitForSelector('#paper .vlink .clip');
  await page.reload();
  await page.waitForSelector('#vHome [data-kopen]'); await page.click('#vHome [data-kopen]');
  await waitPaper(page);
  await page.waitForSelector('#paper .vlink .clip');
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.clips.map(c => [c.u, c.a, c.b, c.t])), [['https://youtu.be/abcDEF12345', 135, 170, 'Strong opening']]);
  // the title and the times can be changed afterwards
  await page.click('#paper .clip [data-clipedit]');
  assert.deepEqual(await page.evaluate(() => ['[data-ca]', '[data-cb]', '[data-ct]'].map(s => document.querySelector('#paper .clipform ' + s).value)), ['2:15', '2:50', 'Strong opening']);
  await page.keyboard.type('Great hook');   // the title is selected, so typing replaces it
  await page.$eval('#paper .clipform [data-cb]', e => { e.value = '3:00'; });
  await page.click('#paper [data-clipsave]');
  assert.match(await page.$eval('#paper .clip [data-clipplay]', b => b.textContent), /Great hook\s*2:15–3:00/);
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.clips.map(c => [c.a, c.b, c.t])), [[135, 180, 'Great hook']]);
  await page.click('#paper .clip [data-clipdel]');
  assert.equal(await page.$('#paper .clip'), null);
  await page.click('.toast .tact');
  await page.waitForSelector('#paper .clip', { timeout: 5000 });
  assert.deepEqual(page.errors, []);
  await close();
});
