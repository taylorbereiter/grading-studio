// Small checks of the date sums the focus timer, the tracker and the grading plan rest on (src/focus.js): the Monday a week starts
// on, the day a moment belongs to around midnight, and both across a change of clocks and the turn of the year.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { builtHtml, openApp } = require('./helpers/app');

let browser;
before(async () => { builtHtml(); browser = await launch(); });
after(async () => { await browser.close(); });

const mons = (page, days) => page.evaluate(d => d.map(x => window.__gs.fcMon(x)), days);
// The day a moment of local time belongs to, with the clock set to it.
const dayAt = (page, list) => page.evaluate(l => l.map(([y, mo, d, h, mi, s]) => { const now = Date.now, t = new Date(y, mo - 1, d, h, mi, s).getTime(); Date.now = () => t; try { return window.__gs.fcToday(); } finally { Date.now = now; } }), list);

for (const tz of ['UTC', 'America/New_York', 'Pacific/Auckland']) {
  test('weeks start on Monday and days turn at midnight, in ' + tz, async () => {
    const { page, close } = await openApp(browser);
    await page.emulateTimezone(tz);
    // Monday is its own week's start; Sunday belongs to the week before
    assert.deepEqual(await mons(page, ['2026-11-16', '2026-11-15', '2026-11-21', '2026-11-22', '2026-11-23']), ['2026-11-16', '2026-11-09', '2026-11-16', '2026-11-16', '2026-11-23']);
    // the turn of the year, and a month edge
    assert.deepEqual(await mons(page, ['2026-12-31', '2027-01-01', '2027-01-03', '2027-01-04', '2026-03-01']), ['2026-12-28', '2026-12-28', '2026-12-28', '2027-01-04', '2026-02-23']);
    // the weeks the clocks change in: in New York on Sunday 8 March and 1 November 2026, in Auckland on 5 April and 27 September
    assert.deepEqual(await mons(page, ['2026-03-08', '2026-03-09', '2026-11-01', '2026-11-02', '2026-04-05', '2026-09-27', '2026-09-28']), ['2026-03-02', '2026-03-09', '2026-10-26', '2026-11-02', '2026-03-30', '2026-09-21', '2026-09-28']);
    // a second before midnight is still that day; midnight is the next
    assert.deepEqual(await dayAt(page, [[2026, 11, 15, 23, 59, 59], [2026, 11, 16, 0, 0, 0], [2026, 12, 31, 23, 59, 59], [2027, 1, 1, 0, 0, 0], [2026, 3, 8, 23, 59, 59], [2026, 9, 27, 0, 0, 0]]),
      ['2026-11-15', '2026-11-16', '2026-12-31', '2027-01-01', '2026-03-08', '2026-09-27']);
    assert.deepEqual(page.errors, []);
    await close();
  });
}
