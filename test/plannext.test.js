// Plan lessons: the Planner opens on planning, with the lesson worked on last and the classes coming up that have no lesson,
// and units, past lessons, activities and rubrics folded under Library. Made-up classes only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('./helpers/chrome');
const { builtHtml } = require('./helpers/app');
const ROOT = path.join(__dirname, '..');

function serve() {
  builtHtml();
  const srv = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(path.join(ROOT, 'planner.html'), 'utf8')); });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/planner.html', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
// One class that meets every day of the week, all day, so there is always a meeting ahead whatever day and hour the test runs.
const SETUP = { kind: 'grading-studio-lessons-setup', version: 1, semStart: '2026-08-31', semEnd: '2027-08-30',
  classes: [{ id: 'P1', name: 'Course P', course: 'Course P', color: '#0E7C86', meets: [0, 1, 2, 3, 4, 5, 6].map(dow => ({ dow, start: '00:00', end: '23:59' })) }], daysOff: [], events: [] };

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

test('the Planner opens on Plan lessons: what to plan next, one blue button, and Library folded', async () => {
  const srv = await serve(), ctx = await browser.createBrowserContext();
  try {
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url);
    await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
    await page.evaluate(async s => { await window.__planner.applySetup(s); localStorage.setItem('gsp.view', 'units'); }, SETUP);
    // even when she was last on Units, the Planner opens on planning
    await page.reload(); await page.waitForFunction(() => window.__planner && document.querySelector('.pl-next'));
    assert.equal(await page.evaluate(() => window.__planner.L.view), 'week');
    assert.equal(await page.$eval('.ls-top h1', e => e.textContent), 'Plan lessons');
    assert.equal(await page.$eval('#railLibBox', e => e.hidden), true);
    assert.equal(await page.$('.pn-rec'), null, 'nothing to pick up yet');
    assert.equal(await page.$$eval('.pl-next .pn-row', r => r.length), 4, 'four classes without a lesson, the rest in the calendar');
    assert.match(await page.$eval('.pn-sub', e => e.textContent), /^1[34] classes in the next two weeks$/);
    assert.deepEqual(await page.$$eval('#lessons .btn.primary', b => b.map(x => x.textContent)), ['Plan it'], 'one blue button');
    // Plan it makes the lesson on that class and day, and opens it
    const first = await page.$eval('.pn-row [data-new]', b => b.dataset.new);
    await page.click('.pn-row [data-new]');
    await page.waitForFunction(() => window.__planner.L.view === 'edit');
    assert.deepEqual(await page.evaluate(() => window.__planner.L.open.slots.map(s => s.classId + '|' + s.date)), [first]);
    // back on Plan lessons, that class is planned and the lesson is there to pick up, now with the blue button
    await page.click('[data-a="back"]'); await page.waitForSelector('.pn-rec');
    assert.equal(await page.$eval('.pn-rec b', e => e.textContent), 'New lesson');
    assert.deepEqual(await page.$$eval('#lessons .btn.primary', b => b.map(x => x.textContent)), ['Continue']);
    assert.ok(!(await page.$$eval('.pn-row [data-new]', b => b.map(x => x.dataset.new))).includes(first));
    await page.click('.pn-rec [data-open]'); await page.waitForFunction(() => window.__planner.L.view === 'edit');
    // Library opens and stays open as she left it
    await page.click('[data-a="back"]'); await page.waitForSelector('.pl-next');
    await page.click('#railLib'); await page.click('#rail [data-v="bank"]'); await page.waitForFunction(() => window.__planner.L.view === 'bank');
    await page.reload(); await page.waitForFunction(() => window.__planner && document.querySelector('.pl-next'));
    assert.equal(await page.$eval('#railLibBox', e => e.hidden), false);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); await srv.close(); }
});
