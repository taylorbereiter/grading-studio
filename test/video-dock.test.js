// A video on the marking screen: the tool dock stays on top of it, and the same video is never added twice to one student.
// Made-up students and made-up links only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, goToStudent, pick } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');
const { strToU8 } = require('fflate');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const ID = '1MadeUpMadeUpMadeUpMadeUp0000';
const url = u => strToU8('[InternetShortcut]\r\nURL=' + u + '\r\n');
async function noWeb(page) {
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url(); if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u) || /^(data|blob|about):/.test(u)) return r.continue(); r.abort(); });
}
const files = (page, key) => page.evaluate(k => window.__gs.state().batch.students.find(s => s.key === k).files.map(f => f.name + ' [' + f.kind + ']' + (f.from ? ' from ' + f.from : '')), key);

test('the tool dock stays on top of a video’s controls when the paper is scrolled sideways under it', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await page.setViewport({ width: 1100, height: 800 });
  await openZip(page, zipOf({
    'Ada Example/Outline.pdf': await makePaper({ title: 'Ada outline' }),
    'Aria Testwell/Notes.pdf': await makePaper({ title: 'Aria notes' }),
    'Aria Testwell/Speech.url': url('https://drive.google.com/file/d/' + ID + '/view'),
    'Aria Testwell/Talk.url': url('https://www.youtube.com/watch?v=madeup12345'),
  }), 'Speech.zip');
  await goToStudent(page, await page.evaluate(() => window.__gs.state().batch.students.findIndex(s => s.key === 'Aria Testwell')));
  await page.waitForSelector('#paper .vlink .mstick');
  // a page zoomed in makes the paper wider than its column; scrolled right and down, the videos' sticky headers pass under the dock
  for (let i = 0; i < 4; i++) { await page.click('#zoomPill button:last-child'); await new Promise(r => setTimeout(r, 250)); }
  await page.waitForFunction(() => { const p = document.querySelector('#paper'); return p.scrollWidth > p.clientWidth + 100; });
  await page.$eval('#paper', p => { const c = p.querySelector('.vlink'); p.scrollTop = c.offsetTop + 60; p.scrollLeft = p.scrollWidth; });
  await new Promise(r => setTimeout(r, 300));
  const hits = await page.evaluate(() => {
    const t = document.querySelector('#tools').getBoundingClientRect(), x = t.left + t.width / 2, out = [];
    for (const s of document.querySelectorAll('#paper .media .mstick')) {
      const r = s.getBoundingClientRect(), top = Math.max(r.top, t.top), bot = Math.min(r.bottom, t.bottom);
      if (r.left > x || r.right < x || bot - top < 8) continue;   // this header isn't under the dock
      const e = document.elementFromPoint(x, (top + bot) / 2);
      out.push(!!(e && e.closest('#tools')));
    }
    return out;
  });
  assert.ok(hits.length >= 1, 'a video’s header passes under the dock in this test');
  assert.deepEqual(hits, hits.map(() => true), 'the dock is drawn over the video’s header, not under it');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the same video added again (another way of writing its Drive link) isn’t added twice, to the student or a partner', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, zipOf({
    'Aria Testwell/Outline.pdf': await makePaper({ title: 'Aria outline' }),
    'Aria Testwell/Presentation video.url': url('https://drive.google.com/file/d/' + ID + '/view?usp=sharing'),
    'Bram Sample/Outline.pdf': await makePaper({ title: 'Bram outline' }),
    'Bram Sample/Speech.url': url('https://drive.google.com/open?id=' + ID),
    'Cleo Fixture/Outline.pdf': await makePaper({ title: 'Cleo outline' }),
    'Cleo Fixture/Talk.url': url('https://www.youtube.com/watch?v=madeup12345'),
  }), 'Speeches.zip');
  await goToStudent(page, await page.evaluate(() => window.__gs.state().batch.students.findIndex(s => s.key === 'Aria Testwell')));
  const before = await files(page, 'Aria Testwell');
  await pick(page, '#addVideoBtn');
  await page.waitForSelector('#vdLink');
  await page.type('#vdLink', 'https://drive.google.com/open?id=' + ID);
  await page.click('#dlgBox .nptile[data-np=""]');
  await page.click('#vdAdd');
  await page.waitForFunction(() => /already has this video/.test(document.body.textContent), { timeout: 15000 });
  assert.deepEqual(await files(page, 'Aria Testwell'), before, 'still one copy of the video');
  assert.equal(await page.$$eval('#paper .media', l => l.length), 1, 'one video on the paper');
  // with a partner who has the same video already: they keep theirs, and the two are a group
  await pick(page, '#addVideoBtn');
  await page.waitForSelector('#vdLink');
  await page.type('#vdLink', 'https://drive.google.com/file/d/' + ID + '/view');
  await page.click('#dlgBox .nptile[data-np=""]');
  await page.click('#dlgBox [data-vdto="' + await page.evaluate(() => window.__gs.state().batch.students.findIndex(s => s.key === 'Bram Sample')) + '"]');
  await page.click('#vdAdd');
  await page.waitForSelector('#grpBand');
  await page.waitForFunction(() => /with Bram Sample/.test(document.querySelector('#grpBand').textContent));
  assert.deepEqual(await files(page, 'Aria Testwell'), before);
  assert.deepEqual(await files(page, 'Bram Sample'), ['Outline.pdf [pdf]', 'Speech.url [link]']);
  // any site: a YouTube video written the short way is the one she has the long way
  await page.evaluate(() => window.__gs.openStudent(window.__gs.state().batch.students.findIndex(s => s.key === 'Cleo Fixture')));
  await page.waitForFunction(() => window.__gs.state().batch.students[window.__gs.state().cur].key === 'Cleo Fixture');
  await pick(page, '#addVideoBtn');
  await page.waitForSelector('#vdLink');
  await page.type('#vdLink', 'https://youtu.be/madeup12345');
  await page.click('#dlgBox .nptile[data-np=""]');
  await page.click('#vdAdd');
  await page.waitForFunction(() => /Cleo Fixture already has this video/.test(document.body.textContent), { timeout: 15000 });
  assert.deepEqual(await files(page, 'Cleo Fixture'), ['Outline.pdf [pdf]', 'Talk.url [link]']);
  assert.deepEqual(page.errors, []);
  await close();
});
