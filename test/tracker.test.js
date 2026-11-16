// The time tracker (src/tracker.js, src/planner/plantime.js): grading time on the marking screen and planning time in the Planner,
// counted only while the teacher is at it and kept apart, time added by hand, and the page that shows it. Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { launch } = require('./helpers/chrome');
const { builtHtml, openApp, openZip, goTo, score, settle, ROOT } = require('./helpers/app');
const { serve } = require('./helpers/serve');
const { standardFiles, zipOf } = require('./helpers/fixtures');
const { gradingSeed } = require('./helpers/steady');

let browser, zip;
before(async () => { builtHtml(); browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

const pause = ms => new Promise(r => setTimeout(r, ms));
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dayAgo = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return iso(d); };
const today = () => dayAgo(0);
// Wednesday of last week, whatever day the tests run (nine days back missed last week on a Monday).
const lastWeek = () => dayAgo((new Date().getDay() + 6) % 7 + 5);
const log = page => page.evaluate(() => JSON.parse(localStorage.getItem('gs.focus') || 'null'));
const withLs = (s, ls) => ({ ...s, ls: { ...s.ls, ...ls } });
// One step of the clock, as if fifteen seconds had passed with the teacher at work (or not).
const step = (page, active = true) => page.evaluate(a => { const G = window.__gs; if (a) G.tkActive(); G.tkTick(); }, active);

test('time on the marking screen counts as grading, by assignment, only while she is at it, and is written down when the screen closes', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  await page.bringToFront(); await page.evaluate(() => window.__gs.tkHold());
  await openZip(page, zip); await score(page, [4, 3, 3]); await settle(page);
  const asg = await page.evaluate(() => { const b = window.__gs.state().batch; return b.assignment ? b.assignment.id : ''; });
  await page.evaluate(() => window.__gs.tkFlush());
  const g0 = ((await log(page)).days[today()] || {}).g || 0;
  for (let i = 0; i < 4; i++) await step(page);
  // nothing pressed for longer than the cut-off: the clock doesn't move
  await page.evaluate(() => { const G = window.__gs, now = Date.now; Date.now = () => now() + 6 * 60e3; try { G.tkTick(); } finally { Date.now = now; } });
  await page.click('#closeBtn'); await page.waitForSelector('#fcCard');
  const L = await log(page), d = L.days[today()];
  assert.equal(d.g - g0, 60, 'a minute of marking; six minutes with nothing done are not counted');
  assert.ok((d.a[asg] || 0) >= 60, 'counted to its assignment');
  // on Today, nothing more counts: it isn't the marking screen
  await step(page); await page.evaluate(() => window.__gs.tkFlush());
  assert.equal((await log(page)).days[today()].g, d.g);
  assert.match(await page.$eval('#fcCard .fctk', e => e.textContent), /Grading time\d+ min.*Planning time0 min.*Time tracker/);
  // switched off in Settings: the marking screen doesn't count either
  await goTo(page, '#/settings/focus'); await page.waitForSelector('#tkOn'); await page.click('#tkOn'); await pause(200);
  assert.deepEqual(await page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().lib.me.focus))), { track: false });
  // and the Planner, which reads only its own keys, is told through one of them
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('gsp.timeCount'))), { on: false, idle: 5 });
  assert.equal(await page.$eval('#tkIdle', e => e.disabled), true);
  await page.click('#tkOn'); await page.select('#tkIdle', '10'); await pause(200);
  assert.deepEqual(await page.evaluate(() => JSON.parse(JSON.stringify(window.__gs.state().lib.me.focus))), { idle: 10 });
  assert.deepEqual(page.errors, []);
  await close();
});

test('a day from before time was counted keeps its focus sessions as grading time, and counting that day starts from them', async () => {
  const L = { day: today(), base: {}, days: { [dayAgo(3)]: { p: 4, s: 1500 }, [today()]: { p: 0, s: 900, sm: 600 } }, pace: [], last: '' };
  const { page, close } = await openApp(browser, { seed: withLs(gradingSeed(), { 'gs.focus': JSON.stringify(L) }) });
  await page.bringToFront(); await page.evaluate(() => window.__gs.tkHold());
  const d3 = await page.evaluate(k => window.__gs.tkDay(k), dayAgo(3));
  assert.equal(d3.g, 1500); assert.deepEqual(d3.ga, { '': 1500 });
  const d0 = await page.evaluate(k => window.__gs.tkDay(k), today());
  assert.equal(d0.g, 900, 'before anything is counted today, today’s focus time stands for its grading');
  await openZip(page, zip); await step(page); await step(page);
  await page.click('#closeBtn'); await page.waitForSelector('#fcCard');
  const t = (await log(page)).days[today()];
  assert.equal(t.g, 600 + 30, 'started from the focus time spent on papers, then the half minute marked');
  assert.equal(t.a[''], 630, 'papers not filed under an assignment');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the tracker shows grading and planning apart, by week, month and three months, takes time added by hand, and gives the days as a spreadsheet', async () => {
  const s = gradingSeed(), lib = JSON.parse(s.ls['gs.lib']), id = lib.classes[0].units[0].items[0].id, name = lib.classes[0].units[0].items[0].name;
  const days = { [today()]: { p: 3, s: 600, g: 3600, a: { [id]: 3000, '': 600 }, pa: { [id]: 3 } }, [lastWeek()]: { p: 1, s: 0, g: 1200, a: { [id]: 1200 } } };
  const plan = { days: { [today()]: { l: 1800, a: { L1: 1500, '': 300 } }, [dayAgo(40)]: { l: 600, a: { L1: 600 } } }, names: { L1: 'Reading a poem' } };
  const { page, close } = await openApp(browser, { seed: withLs(s, { 'gs.focus': JSON.stringify({ day: today(), base: {}, days, pace: [], last: '' }), 'gsp.planTime': JSON.stringify(plan) }) });
  await goTo(page, '#/time'); await page.waitForSelector('#tkBody .tktile');
  assert.equal(await page.title(), 'Time tracker · Grading Studio');
  const tiles = () => page.$$eval('#tkBody .tktile', t => t.map(x => x.querySelector('.tkl').textContent + ' ' + x.querySelector('.tkv').textContent));
  const week = await tiles();
  assert.match(week[0], /^Grading time 1 hr$/); assert.match(week[1], /^Planning time 30 min$/);
  assert.equal(await page.$$eval('#tkBody .tkday', d => d.length), 7, 'a bar a day, Monday to Sunday');
  const rows = await page.$$eval('#tkBody .tklist.g .tkrow b', r => r.map(x => x.textContent));
  assert.equal(rows[0], name); assert.equal(rows[1], 'Other grading');
  assert.deepEqual(await page.$$eval('#tkBody .tklist.l .tkrow b', r => r.map(x => x.textContent)), ['Reading a poem', 'The week, units and the bank']);
  // the assignment's own card on the class page says how long it has taken
  await goTo(page, await page.$eval('#railClasses a', a => a.getAttribute('href'))); await page.waitForSelector('#classes .tkc');
  assert.equal(await page.$eval('#classes [data-card="' + id + '"] .tkc', e => e.textContent), '1 hr 10 min so far');
  await goTo(page, '#/time'); await page.waitForSelector('#tkBody .tktile');
  // the week before: only what was done then
  await page.click('[data-tkoff="-1"]'); await pause(200);
  assert.deepEqual((await tiles()).slice(0, 2), ['Grading time 20 min', 'Planning time 0 min']);
  await page.click('[data-tknow]'); await page.click('[data-tkrange="quarter"]'); await pause(200);
  assert.equal(await page.$$eval('#tkBody .tkday', d => d.length), 13, 'a bar a week for thirteen weeks');
  assert.match((await tiles())[1], /^Planning time 40 min$/);
  await page.click('[data-tkrange="month"]'); await pause(200);
  assert.ok(await page.$$eval('#tkBody .tkday', d => d.length) >= 28);
  // time added by hand: planning, yesterday or today, with a note
  await page.click('[data-tkrange="week"]'); await page.click('[data-tkadd]'); await page.waitForSelector('#tkAdd');
  await page.click('[data-tkkind="l"]');
  await page.$eval('#tkMin', e => { e.value = '45'; }); await page.type('#tkNote', 'Unit plan at home');
  await page.click('#tkAdd button[type=submit]'); await page.waitForSelector('#tkBody .tkent');
  assert.match(await page.$eval('#tkBody .tkent', e => e.textContent), /Planning time45 minUnit plan at home/);
  assert.match((await tiles())[1], /^Planning time 1 hr 15 min$/);
  const csv = await page.evaluate(() => window.__gs.tkCsvText());
  assert.equal(csv.split('\r\n')[0], 'Date,Grading minutes,Planning minutes,Focus minutes,Papers,Grading added by hand,Planning added by hand');
  assert.ok(csv.includes(today() + ',60,75,10,0,0,45'), csv);   // today's papers are counted again from the downloads, and none are open here
  assert.ok(csv.includes(lastWeek() + ',20,0,0,1,0,0'), csv);
  // taken away again
  await page.click('#tkBody [data-tkdel]'); await pause(200);
  assert.equal(await page.$('#tkBody .tkent'), null);
  assert.deepEqual((await log(page)).add, []);
  assert.ok(!JSON.stringify(await log(page)).match(/Aria|Bram|Cleo|Dov|Testwell/), 'no names in the log');
  assert.deepEqual(page.errors, []);
  await close();
});

test('time in the Planner counts as planning, by lesson, but not while a lesson is presented, and not when switched off', async () => {
  const server = await serve(() => fs.readFileSync(path.join(ROOT, 'planner.html'), 'utf8'));
  const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(server.url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
    await page.bringToFront();
    const tick = () => page.evaluate(() => { window.__plantime.active(); window.__plantime.tick(); });
    await tick(); await tick();
    const id = await page.evaluate(async () => {
      const P = window.__planner, l = P.normLesson({ title: 'Reading a poem', slides: [{ layout: 'title', title: 'Reading a poem' }] });
      P.L.lessons.push(l); P.openLessonForTest(l, 0); return l.id;
    });
    await tick();
    await page.evaluate(() => { window.__present.PR.on = true; }); await tick(); await page.evaluate(() => { window.__present.PR.on = false; });
    await page.evaluate(() => window.__plantime.flush());
    const P = await page.evaluate(() => JSON.parse(localStorage.getItem('gsp.planTime')));
    assert.equal(P.days[today()].l, 45);
    assert.deepEqual(P.days[today()].a, { '': 30, [id]: 15 });
    assert.deepEqual(P.names, { [id]: 'Reading a poem' });
    // the lesson's own time, beside its name, once it reaches a minute
    assert.equal(await page.$eval('#lsTime', e => e.hidden), true);
    for (let i = 0; i < 3; i++) await tick();
    assert.equal(await page.evaluate(id => window.__plantime.lessonSecs(id), id), 60);
    assert.equal(await page.$eval('#lsTime', e => e.hidden ? '' : e.textContent), '1 min planning');
    await page.evaluate(() => window.__plantime.flush());
    // the grading app's setting switches it off here too
    await page.evaluate(() => localStorage.setItem('gsp.timeCount', JSON.stringify({ on: false, idle: 5 })));
    await tick(); await page.evaluate(() => window.__plantime.flush());
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('gsp.planTime')))).days[today()].l, 90);
    assert.deepEqual(errors, []);
  } finally { await page.close(); await server.close(); }
});

test('what the tracker keeps goes with the teacher’s work, and stays out of the new year’s clearing only because it names nobody', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'folder.js'), 'utf8');
  const re = new RegExp(src.match(/const LS_LOCAL = \/(.+?)\/;/)[1]);
  assert.ok(!re.test('gsp.planTime') && !re.test('gs.focus'));
});
