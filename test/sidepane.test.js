// The side pane on the marking screen: a video, the rubric or another file beside the paper. Made-up students and made-up links only.
// The one video is made in the page (a canvas recorded for a second), never a real recording.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, waitPaper, goToStudent, settle, setTool, drag, pick } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const LINK = 'https://drive.google.com/file/d/1MadeUpMadeUpMadeUpMadeUp0000/view';
async function noWeb(page) {
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url(); if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u) || /^(data|blob|about):/.test(u)) return r.continue(); r.abort(); });
}
const threeZip = async () => zipOf({
  'Aria Testwell/Outline.pdf': await makePaper({ title: 'Aria outline' }),
  'Bram Sample/Outline.pdf': await makePaper({ title: 'Bram outline' }),
  'Cleo Fixture/Outline.pdf': await makePaper({ title: 'Cleo outline' }),
});
const sp = page => page.evaluate(() => window.__gs.spState());
const conf = page => page.evaluate(() => JSON.parse(localStorage.getItem('gs.sp') || 'null'));
// What is where: the kinds of thing in the pane and in the main column, in order.
const where = page => page.evaluate(() => { const say = e => (e.classList.contains('fhead') ? 'bar:' + e.firstElementChild.textContent : e.classList.contains('pg') ? 'page' : e.classList.contains('media') ? 'video' : e.classList.contains('sptool') ? 'tool:' + e.dataset.tool : '');
  return { pane: [...document.querySelectorAll('#spBody > *')].map(say).filter(Boolean), main: [...document.querySelectorAll('#paper > *')].map(say).filter(Boolean) }; });
const box = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; });
const marksOn = (page, key, rx) => page.evaluate((k, rx) => { const f = window.__gs.state().batch.students.find(s => s.key === k).files.find(f => new RegExp(rx).test(f.name)); return f ? Object.values(f.marks).reduce((n, a) => n + a.length, 0) : -1; }, key, rx);
const pageOf = (page, rx) => page.evaluate(rx => window.__gs.state().pages.findIndex(q => new RegExp(rx).test(q.file.name)), rx);
const calm = page => page.evaluate(() => new Promise(r => setTimeout(r, 350)));   // pages are drawn again a moment after the pane changes
async function addVideo(page) {
  await pick(page, '#addVideoBtn');
  await page.waitForSelector('#vdLink');
  await page.type('#vdLink', LINK);
  await page.click('#vdAdd');
  await page.waitForSelector('#paper .vlink');
  await page.waitForFunction(() => window.__gs.state().pages.some(q => /notes/.test(q.file.name)), { timeout: 30000 });
  await calm(page);
}

test('a student with a video and a notes page opens side by side; tabs move things in and out; the pen and the rubric work in the pane', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, await threeZip(), 'Speeches.zip');
  await waitPaper(page);
  assert.equal((await sp(page)).shown, false, 'one paper and nothing else: no pane');
  assert.deepEqual((await sp(page)).tabs.map(t => t.kind), ['rubric']);
  assert.equal(await page.$eval('#spBtn', b => b.getAttribute('aria-pressed')), 'false');

  await addVideo(page);
  let s = await sp(page);
  assert.equal(s.shown, true); assert.equal(s.at, 'right');
  assert.deepEqual(s.tabs.map(t => t.kind), ['video', 'f:Outline.pdf', 'notes', 'rubric']);
  assert.deepEqual(await where(page), { pane: ['bar:Presentation video', 'video'], main: ['bar:Outline.pdf', 'page', 'bar:Presentation notes.pdf', 'page'] });
  assert.deepEqual(await page.$$eval('#spTabs .sptab', l => l.map(b => b.textContent + (b.getAttribute('aria-selected') === 'true' ? '*' : ''))), ['Presentation video*', 'Outline', 'Presentation notes', 'Rubric']);
  assert.equal(await conf(page), null, 'opened by the video, not by her: nothing is kept');
  // the two columns sit side by side inside the paper area, and a page fits its own column
  const P = await box(page, '#paper'), pane = await box(page, '#pane2'), pg = await box(page, '#paper > .pg');
  assert.ok(pane.l > P.l + 300 && pane.r <= P.r + 1 && pane.t === P.t && pane.h === P.h, JSON.stringify({ P, pane }));
  assert.ok(pg.r <= pane.l, 'the page ends before the pane: ' + pg.r + ' ' + pane.l);
  // scrolling the papers leaves the pane where it is
  await page.$eval('#paper', p => { p.scrollTop = 400; });
  assert.deepEqual(await box(page, '#pane2'), pane);
  await page.$eval('#paper', p => { p.scrollTop = 0; });
  // the pen on the notes page beside a video
  await setTool(page, 'pen'); await drag(page, await pageOf(page, 'notes'), [[120, 300], [180, 330], [240, 300]]); await setTool(page, 'select');
  assert.equal(await marksOn(page, 'Aria Testwell', 'notes'), 1);

  // the rubric tab: the video goes back above the papers, in its old place
  await page.click('[data-sptab="rubric"]');
  assert.deepEqual(await where(page), { pane: ['tool:rubric'], main: ['bar:Presentation video', 'video', 'bar:Outline.pdf', 'page', 'bar:Presentation notes.pdf', 'page'] });
  assert.equal(await page.$$eval('#spBody .sprow', l => l.length), 3);
  assert.match(await page.$eval('#spBody .sprubnone', e => e.textContent), /Nothing is written yet/);
  await page.click('[data-sprow="1"][data-spv="3"]');
  assert.deepEqual(await page.evaluate(() => Array.from({ length: 3 }, (_, i) => window.__gs.state().batch.students[0].grade.rubric[i] ?? null)), [null, 3, null]);
  await page.waitForFunction(() => document.querySelector('[data-sprow="1"][data-spv="3"]').getAttribute('aria-pressed') === 'true');
  assert.match(await page.$eval('#grade .crit[data-row="1"] .cn em', e => e.textContent), /3/);
  // a score given in the score panel shows in the pane
  await page.click('#grade .scores[data-c="0"] button[data-v="4"]');
  await page.waitForFunction(() => document.querySelector('[data-sprow="0"][data-spv="4"]').getAttribute('aria-pressed') === 'true');
  // a half sits between two boxes
  await page.click('#grade .scores[data-c="2"] button[data-v="2.5"]');
  await page.waitForFunction(() => document.querySelectorAll('.splvb.on.half[data-sprow="2"]').length === 2);
  // the same box again takes the score off
  await page.click('[data-sprow="1"][data-spv="3"]');
  assert.deepEqual(await page.evaluate(() => Array.from({ length: 3 }, (_, i) => window.__gs.state().batch.students[0].grade.rubric[i] ?? null)), [4, null, 2.5]);
  assert.equal((await conf(page)).tab, 'rubric', 'her choice of tab is kept');

  // the notes page in the pane: it fits the pane, and the pen works on it there
  await page.click('[data-sptab^="doc:"][data-sptab*="notes"]');
  await calm(page);
  assert.deepEqual((await where(page)).pane, ['bar:Presentation notes.pdf', 'page']);
  const inPane = await box(page, '#spBody > .pg'), body = await box(page, '#spBody');
  assert.ok(inPane.l >= body.l && inPane.r <= body.r, JSON.stringify({ inPane, body }));
  await setTool(page, 'pen'); await drag(page, await pageOf(page, 'notes'), [[120, 400], [180, 430], [240, 400]]); await setTool(page, 'select');
  assert.equal(await marksOn(page, 'Aria Testwell', 'notes'), 2);
  // a file's own menu puts it in the pane
  await pick(page, '#paper > .fhead [data-spshow]');
  assert.deepEqual((await where(page)).pane, ['bar:Presentation video', 'video']);
  await settle(page);

  // she asked for it by then, so it stays for the next student, who has one paper: the rubric is what there is to show
  assert.deepEqual(await conf(page), { on: true, tab: 'video' });
  await goToStudent(page, 1);
  assert.equal((await sp(page)).key, 'rubric');
  assert.deepEqual(await conf(page), { on: true, tab: 'video' }, 'a tab shown for want of another is not her choice');
  // back on the student with the video it opens on the tab she chose last
  await goToStudent(page, 0);
  await page.waitForSelector('#spBody .vlink');
  assert.equal((await sp(page)).shown, true);
  assert.equal(await marksOn(page, 'Aria Testwell', 'notes'), 2);
  assert.deepEqual(page.errors, []);
  await close();
});

test('B and the button open and close it; it stays for every student once she opens it; its place and size are kept in this browser', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, await threeZip(), 'Speeches.zip');
  await waitPaper(page);
  const w0 = (await box(page, '#paper > .pg')).w;
  await page.keyboard.press('b');
  await calm(page);
  let s = await sp(page);
  assert.equal(s.shown, true); assert.equal(s.key, 'rubric', 'with one paper the pane shows the rubric');
  assert.deepEqual(await conf(page), { on: true });
  assert.equal(await page.$eval('#spBtn', b => b.getAttribute('aria-pressed')), 'true');
  assert.ok((await box(page, '#paper > .pg')).w < w0, 'the paper is drawn narrower to make room');
  await goToStudent(page, 1);
  assert.equal((await sp(page)).shown, true, 'it stays from student to student');
  // the bar between the two drags it wider; a double click puts it back
  const g = await box(page, '#spGrip'), wide = (await box(page, '#pane2')).w;
  await page.mouse.move(g.l + 5, g.t + 300); await page.mouse.down(); await page.mouse.move(g.l - 115, g.t + 300, { steps: 4 }); await page.mouse.up();
  await calm(page);
  assert.ok(Math.abs((await box(page, '#pane2')).w - (wide + 120)) <= 3, 'dragged 120 wider');
  assert.ok((await conf(page)).w > 0.46);
  const g2 = await box(page, '#spGrip');
  await page.mouse.click(g2.l + 5, g2.t + 300); await page.mouse.click(g2.l + 5, g2.t + 300);
  await calm(page);
  assert.equal((await box(page, '#pane2')).w, wide);
  assert.equal('w' in (await conf(page)), false);
  // on the left, and across the top
  await pick(page, '[data-spat="left"]');
  await calm(page);
  let P = await box(page, '#paper'), pane = await box(page, '#pane2'), tools = await box(page, '#tools'), pg = await box(page, '#paper > .pg');
  assert.equal(pane.l, P.l); assert.ok(tools.l >= pane.r && pg.l > tools.r, 'the tools and the page are to the right of the pane');
  assert.equal((await conf(page)).at, 'left');
  await pick(page, '[data-spat="top"]');
  await calm(page);
  P = await box(page, '#paper'); pane = await box(page, '#pane2'); pg = await box(page, '#paper > .pg');
  assert.equal(pane.t, P.t); assert.equal(pane.w, P.w); assert.ok(pg.t >= pane.b, 'the page starts under the pane');
  await pick(page, '[data-spat="right"]');
  await calm(page);
  assert.equal('at' in (await conf(page)), false, 'the usual place is not written down');
  // a narrow window puts it across the top by itself
  await page.setViewport({ width: 1000, height: 800 });
  await page.waitForFunction(() => window.__gs.spState().at === 'top');
  await page.setViewport({ width: 1500, height: 950 });
  await page.waitForFunction(() => window.__gs.spState().at === 'right');
  // closed with ✕, it is gone for every student, and the paper has its room back
  await page.click('[data-spclose]');
  await calm(page);
  assert.equal(await page.$('#pane2'), null);
  assert.equal(await conf(page), null);
  assert.equal((await box(page, '#paper > .pg')).w, w0);
  await goToStudent(page, 0);
  assert.equal((await sp(page)).shown, false);

  // closed on a video, a video no longer opens it; opening it again brings that back
  await addVideo(page);
  assert.equal((await sp(page)).shown, true);
  await page.keyboard.press('b');
  assert.deepEqual(await conf(page), { noVid: true });
  assert.deepEqual((await where(page)).main.slice(0, 2), ['bar:Presentation video', 'video'], 'the video is back above the papers');
  await goToStudent(page, 1); await goToStudent(page, 0);
  await page.waitForSelector('#paper .vlink');
  assert.equal((await sp(page)).shown, false);
  await page.click('#spBtn');
  assert.deepEqual(await conf(page), { on: true });
  assert.equal((await sp(page)).key.startsWith('file:'), true, 'the video, since this student has one');
  // typing a B in a comment is only a letter
  await page.click('#cmtIn'); await page.keyboard.type('Bb');
  assert.equal((await sp(page)).shown, true);
  // the Keys list and Help name it
  assert.ok((await page.evaluate(() => window.__gs.helpTopics().map(t => t.id))).includes('side-pane'));
  assert.deepEqual(page.errors, []);
  await close();
});

test('a video keeps playing when another tab is picked, and a kept video card that is still loading is not lost', async () => {
  const { page, close } = await openApp(browser);
  await noWeb(page);
  await openZip(page, zipOf({ 'Aria Testwell/Aria Testwell speech.pdf': await makePaper({ title: 'Speech outline' }), 'Bram Sample/Bram Sample speech.pdf': await makePaper({ title: 'Speech outline' }) }), 'Speeches.zip');
  await waitPaper(page);
  const vid = await page.evaluateHandle(async () => {
    const c = document.createElement('canvas'); c.width = 160; c.height = 90; const g = c.getContext('2d');
    const rec = new MediaRecorder(c.captureStream(15), { mimeType: 'video/webm' }), parts = [];
    rec.ondataavailable = e => parts.push(e.data);
    let i = 0; const t = setInterval(() => { g.fillStyle = '#1F6FB2'; g.fillRect(0, 0, 160, 90); g.fillStyle = '#fff'; g.fillRect((i++ * 4) % 140, 30, 20, 20); }, 60);
    rec.start(); await new Promise(r => setTimeout(r, 2500)); rec.stop(); await new Promise(r => { rec.onstop = r; }); clearInterval(t);
    return new File(parts, 'Aria talk.webm', { type: 'video/webm' });
  });
  await page.evaluate(async v => { const B = window.__gs.state().batch; await window.__gs.videoAdd(B.students[0], { file: v, name: 'Presentation video', kind: 'lined', partners: [] }); }, vid);
  await page.waitForSelector('#spBody .media video');
  await page.waitForFunction(() => document.querySelector('#spBody .media video').readyState >= 1);
  assert.deepEqual((await where(page)).pane, ['bar:Presentation video', 'video']);
  // the video fills the pane's width, and its own drag bar is not needed there
  const v = await box(page, '#spBody .media video'), body = await box(page, '#spBody');
  assert.ok(v.w > body.w - 80 && v.h > 100, JSON.stringify({ v, body }));
  assert.equal(await page.$eval('#spBody .vgrip', e => e.checkVisibility()), false);
  await page.evaluate(() => { const m = document.querySelector('#spBody .media video'); m.muted = true; m.dataset.same = '1'; return m.play(); });
  await page.waitForFunction(() => document.querySelector('#spBody .media video').currentTime > 0.2);
  await page.click('[data-sptab="rubric"]');
  const after = await page.evaluate(() => { const m = document.querySelector('#paper > .media video'); return { same: m.dataset.same, t: m.currentTime, paused: m.paused, can: 'moveBefore' in Element.prototype }; });
  assert.equal(after.same, '1', 'the same player, moved'); assert.ok(after.t > 0.2);
  if (after.can) assert.equal(after.paused, false, 'still playing');
  // with names covered, a tab never shows a file name that has the student's name in it
  assert.ok((await page.$$eval('#spTabs .sptab', l => l.map(b => b.textContent))).includes('Aria Testwell speech'));
  await page.evaluate(() => window.__gs.setAnon(true));
  await page.waitForFunction(() => window.__gs.anonOn());
  await goToStudent(page, 0);
  await page.waitForSelector('#spTabs .sptab');
  const anonTabs = await page.$$eval('#spTabs .sptab', l => l.map(b => b.textContent));
  assert.ok(anonTabs.includes('[name] [name] speech'), 'the tab says [name]: ' + anonTabs.join(' | '));
  assert.ok(!(await page.$eval('#paper', e => e.textContent)).includes('Aria'), 'no name anywhere in the paper area');
  assert.deepEqual(page.errors, []);
  await close();
});
