// Stage 8, slice E2: the Calendar's Semester view and planning ahead (rows E2-010, E2-023, E2-026, E2-027, E2-028, E2-045, E2-046,
// E2-047, E2-094 of rebuild/audit/gaps.md). Made-up lessons and units at the stopped clock (planseed.js, Tuesday 27 October 2026).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./e2harness.js');
const h = harness(before, after);
const until = (p, fn, ...a) => p.waitForFunction(fn, { timeout: 8000 }, ...a);
const menuItem = (p, label) => p.evaluate(l => { const b = [...document.querySelectorAll('.pop [role="menuitem"]')].find(x => x.textContent.includes(l)); if (!b) return false; b.click(); return true; }, label);

test('E2-010 E2-046 E2-047 E2-045 E2-094: a Semester view beside the week and month: every week by course with its unit, week and focus; a week opens; a new unit; and from the command bar', async () => {
  const p = await h.fresh();
  await h.open(p, 'calendar/class');
  await p.click('main [role="radiogroup"] [role="radio"]:focus, main [role="radiogroup"] [aria-checked="true"]');
  for (let i = 0; i < 3; i++) await p.keyboard.press('ArrowRight');
  await until(p, () => location.hash === '#/calendar/semester' && document.querySelector('.sem [data-wk]'));
  assert.equal(await p.$eval('#cal-title', e => e.textContent), 'Semester');
  assert.deepEqual(await p.$$eval('.sem .hd [role="columnheader"]', x => x.map(e => e.textContent)), ['Week', 'Grade 9', 'Grade 10']);
  const cell = await p.$eval('[data-cell="Grade 9|2026-10-26"]', e => e.textContent);
  assert.ok(cell.includes('Unit 2: Poetry') && cell.includes('Week 3 of 5') && cell.includes('Voice'), cell);
  assert.ok(await p.$eval('[data-wk="2026-10-26"]', e => e.classList.contains('now')), 'this week is marked');
  assert.match(await p.$eval('[data-cell="Grade 9|2026-10-26"] em', e => e.textContent), /^\d\/\d planned$/);
  // a week opens in the week view
  await p.click('[data-open-week="2026-11-02"]');
  await until(p, () => location.hash === '#/calendar/class' && /November/.test(document.querySelector('#cal-title').textContent));
  // a new unit from the Semester view
  await h.open(p, 'calendar/semester');
  await p.click('[data-sem-new]');
  await p.waitForSelector('dialog.sheet [data-focus="save-unit"]');
  await p.click('[data-focus="save-unit"]');
  await until(p, () => !document.querySelector('dialog.sheet[open]'));
  let u; for (let k = 0; k < 40 && !u; k++) { u = ((await h.kvInDb(p, 'units')) || []).find(x => !['U1', 'U2', 'U3'].includes(x.id)); if (!u) await new Promise(r => setTimeout(r, 100)); }
  assert.ok(u, 'a new unit'); assert.equal(u.start, '2026-10-26');
  // Go to: Semester, from the command bar
  await h.open(p, 'home');
  await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control');
  await p.waitForSelector('dialog.cmd[open] input');
  await p.keyboard.type('semester');
  await until(p, () => [...document.querySelectorAll('dialog.cmd [role="option"]')].some(o => o.textContent.includes('Semester')));
  await p.keyboard.press('Enter');
  await until(p, () => location.hash === '#/calendar/semester');
  assert.deepEqual(p.errors, []); await p.ctx.close();
});

test('E2-023 E2-026 E2-027 E2-028: coming up without a lesson in the next two weeks (Plan it, a focus session), next week’s lessons planned, and the planning pace', async () => {
  // three ready lessons with planning time: 10, 15 and 20 minutes, so the pace is about 15 minutes
  const planTime = { days: { '2026-10-20': { l: 2700, a: { L1: 600, L2: 900, L4: 1200 }, f: 0, n: 0 } }, names: {} };
  const p = await h.fresh(1366, {}, { 'gsp.planTime': planTime });
  await h.open(p, 'calendar/semester');
  await p.waitForSelector('.ahead [data-gap]');
  assert.equal(await p.$eval('.ahead [data-pace]', e => e.textContent), 'About 15 minutes a lesson, from your last 3');
  const nw = await p.$eval('.ahead [data-nextweek]', e => [e.dataset.nextweek, e.textContent]);
  assert.match(nw[1], /^Next week: \d+ of \d+ lessons planned/);
  const n = await p.$$eval('.ahead [data-gap]', x => x.length);
  assert.ok(n >= 1 && n <= 4);
  assert.match(await p.$eval('.ahh .mute', e => e.textContent), /classes? in the next two weeks/);
  // Plan it makes the lesson for that meeting
  const [cls, day] = (await p.$eval('.ahead [data-gap]', e => e.dataset.gap)).split('|');
  await p.click('.ahead [data-gap] [data-gap-plan]');
  await p.waitForFunction(() => /^#\/lesson\/[^/]+$/.test(location.hash), { timeout: 10000 });
  const id = await p.evaluate(() => location.hash.split('/')[2]);
  assert.ok((await h.lessonInDb(p, id)).slots.some(s => s.classId === cls && s.date === day), 'a lesson on that meeting');
  // the next one, with a focus session
  await h.open(p, 'calendar/semester');
  await p.waitForSelector('.ahead [data-gap]');
  const [c2, d2] = (await p.$eval('.ahead [data-gap]', e => e.dataset.gap)).split('|');
  assert.notEqual(c2 + d2, cls + day, 'the planned one has left the list');
  await p.click('.ahead [data-gap] [data-gap-menu]'); await p.waitForSelector('.pop [role="menuitem"]');
  await menuItem(p, 'Focus on it');
  await p.waitForFunction(() => /^#\/lesson\/[^/]+$/.test(location.hash), { timeout: 20000 });
  const id2 = await p.evaluate(() => location.hash.split('/')[2]);
  assert.ok((await h.lessonInDb(p, id2)).slots.some(s => s.classId === c2 && s.date === d2));
  await p.waitForFunction(id => (JSON.parse(localStorage.getItem('gsp.focusRun')) || {}).w === 'les:' + id, { timeout: 20000 }, id2);
  // next week’s line on the week view too
  await h.open(p, 'calendar/class');
  await p.waitForSelector('.legend [data-nextweek]');
  // the current Planner has both lessons on their meetings
  await p.goto(h.srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && P.L.lessons && P.L.lessons.length; }, { timeout: 20000 });
  const got = await p.evaluate(ids => ids.map(id => { const l = window.__planner.L.lessons.find(x => x.id === id); return l ? l.slots.map(s => s.classId + '|' + s.date) : null; }), [id, id2]);
  assert.ok(got[0].includes(cls + '|' + day) && got[1].includes(c2 + '|' + d2), JSON.stringify(got));
  assert.deepEqual(p.errors, []); await p.ctx.close();
});
