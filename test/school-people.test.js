// People at the school: spots for the roles on the School page (principal, coordinators, the teacher's own), and to-dos that name
// them. Every person, school and address here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { openApp, goTo } = require('./helpers/app');
const { gradingSeed } = require('./helpers/steady');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const until = async (page, fn, arg, ms = 8000) => { for (const t0 = Date.now(); ;) { if (await page.evaluate(fn, arg)) return; if (Date.now() - t0 > ms) throw new Error('waited too long for ' + fn); await new Promise(r => setTimeout(r, 50)); } };
const fill = (page, sel, v) => page.$eval(sel, (e, v) => { e.value = v; }, v);
const school = page => page.evaluate(() => window.__gs.schNow());
const roles = page => page.$$eval('#schList .schprow .schrole', els => els.map(e => e.textContent));
const PEOPLE = [{ id: 'sp1', at: 1, role: 'Principal', name: 'Dr. Ada Placeholder', email: 'principal@school.example' }, { id: 'sp2', at: 1, role: 'Vice principal', name: 'Mr. Ben Invented', email: 'vp@school.example' }, { id: 'sp3', at: 1, role: 'Vice principal', name: 'Ms. Cara Madeup' }, { id: 'sp4', at: 1, role: 'MYP coordinator', name: 'Mx. Dev Notreal' }];
function seeded() { const s = gradingSeed(); s.ls = { ...(s.ls || {}), 'gs.school': JSON.stringify({ items: [], order: [], ot: 0, people: PEOPLE }) }; return s; }

test('the School page has empty spots for the usual roles; a spot is filled, the spots are changed, and a person is deleted with Undo', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  await goTo(page, '#/school');
  await page.waitForSelector('#vSchool .schppl');
  assert.deepEqual(await roles(page), await page.evaluate(() => window.__gs.SCH_ROLES), 'a spot for each usual role');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.school')), null, 'nothing is stored for empty spots');
  assert.ok(await page.$('#vSchool .schnone'), 'the resources still say how to start');

  await page.click('[data-schpadd="Vice principal"]'); await page.waitForSelector('#schPName');
  assert.equal(await page.$eval('#schPRole', e => e.value), 'Vice principal');
  await fill(page, '#schPName', 'Mr. Ben Invented'); await fill(page, '#schPMail', 'vp at school');
  await page.click('#dlgBox [data-ok]');
  assert.equal(await page.$eval('#schErr', e => e.hidden), false, 'a bad email address is said');
  await fill(page, '#schPMail', 'vp@school.example'); await page.click('#dlgBox [data-ok]');
  await until(page, () => !!document.querySelector('#schList [data-schp] .schpmail'));
  assert.equal(await page.$eval('#schList .schpmail', e => e.getAttribute('href')), 'mailto:vp@school.example');
  assert.deepEqual((await school(page)).people.map(p => [p.role, p.name, p.email]), [['Vice principal', 'Mr. Ben Invented', 'vp@school.example']]);

  // the teacher's own spots, in their own order; someone whose role is no longer a spot keeps their row
  await page.click('[data-schroles]'); await page.waitForSelector('#schRolesIn');
  await fill(page, '#schRolesIn', 'MYP coordinator\nPrincipal\n\nMYP coordinator\nHead of year');
  await page.click('#dlgBox [data-ok]');
  await until(page, () => document.querySelector('#schList .schprow .schrole').textContent === 'MYP coordinator');
  assert.deepEqual(await roles(page), ['MYP coordinator', 'Principal', 'Head of year', 'Vice principal']);
  assert.deepEqual((await school(page)).roles.list, ['MYP coordinator', 'Principal', 'Head of year']);

  // deleting, then Undo
  const id = (await school(page)).people[0].id;
  await page.click('[data-schp="' + id + '"] [data-km]'); await page.click('[data-schp="' + id + '"] .mitem[data-schpdo="del"]');
  await until(page, () => !document.querySelector('#schList [data-schp]'));
  assert.equal((await school(page)).people[0].gone, 1);
  await page.click('.toast .tact');
  await until(page, () => !!document.querySelector('#schList [data-schp]'));
  assert.deepEqual(page.errors, []);
  await close();
});

test('a to-do names people: read from the words, picked in the side, shown on the line, filtered, and emailed', async () => {
  const { page, close } = await openApp(browser, { seed: seeded() });
  const read = t => page.evaluate(t => window.__gs.todoRead(t).ppl, t);
  assert.deepEqual(await read('Email Dr. Ada Placeholder about the exam rooms'), ['sp1'], 'a whole name');
  assert.deepEqual(await read('Ask Notreal about the unit planner'), ['sp4'], 'a last name only one person has');
  assert.deepEqual(await read('ask notreal about it'), [], 'a last name is written with its capital');
  assert.deepEqual(await read('Tell the principal about the trip'), ['sp1'], 'a role one person holds');
  assert.deepEqual(await read('Tell the vice principal about the trip'), [], 'two people are vice principal, and "vice principal" is not "principal"');
  assert.deepEqual(await read('Send the MYP coordinator my unit plan friday'), ['sp4']);
  assert.deepEqual(await read('Print handouts'), []);

  await goTo(page, '#/todo');
  await page.waitForSelector('#tdIn');
  await page.type('#tdIn', 'Ask the principal about cover lessons tomorrow');
  await until(page, () => /Dr\. Ada Placeholder/.test(document.querySelector('#tdUnd').textContent));
  await page.keyboard.press('Enter');
  await until(page, () => window.__gs.todoRows().some(r => r.own && /cover lessons/.test(r.x)));
  const it = await page.evaluate(() => window.__gs.todoRows().find(r => r.own && /cover lessons/.test(r.x)).it);
  assert.deepEqual(it.ppl, ['sp1']);
  assert.match(await page.$eval('#tdList [data-td="' + it.id + '"]', e => e.textContent), /Dr\. Ada Placeholder/);

  // taking a name off what was understood
  await page.type('#tdIn', 'Talk to Invented');
  await until(page, () => !!document.querySelector('#tdUnd [data-tddrop="p"]'));
  await page.click('#tdUnd [data-tddrop="p"]'); await page.keyboard.press('Enter');
  await until(page, () => window.__gs.todoRows().some(r => r.own && r.x === 'Talk to Invented'));
  assert.equal(await page.evaluate(() => window.__gs.todoRows().find(r => r.x === 'Talk to Invented').it.ppl), undefined);

  // picked in the side pane, the email link, taken off
  await page.click('#tdList [data-tdsel="' + it.id + '"]'); await page.waitForSelector('#tdPpl');
  assert.equal(await page.$eval('#tdSide [data-tdmail]', e => e.getAttribute('href')), 'mailto:principal@school.example?subject=' + encodeURIComponent('Ask the principal about cover lessons'));
  await page.select('#tdPpl', 'sp4');
  await until(page, id => (window.__gs.todoRows().find(r => r.id === id).it.ppl || []).length === 2, it.id);
  await page.click('#tdSide [data-tdpx="sp1"]');
  await until(page, id => JSON.stringify(window.__gs.todoRows().find(r => r.id === id).it.ppl) === '["sp4"]', it.id);

  // a chip for each person with something to do; one person's list, and a line typed there names them
  await page.click('#tdChips [data-tdf="p:sp4"]');
  await until(page, () => !document.querySelector('#tdPplBar').hidden);
  assert.match(await page.$eval('#tdPplBar', e => e.textContent), /Mx\. Dev Notreal · MYP coordinator/);
  assert.equal(await page.$$eval('#tdList .tdrow', els => els.length), 1);
  await page.type('#tdIn', 'Share the planner link'); await page.keyboard.press('Enter');
  await until(page, () => window.__gs.todoRows().some(r => r.x === 'Share the planner link'));
  assert.deepEqual(await page.evaluate(() => window.__gs.todoRows().find(r => r.x === 'Share the planner link').it.ppl), ['sp4']);

  // the School page counts them and goes to the list
  await goTo(page, '#/school');
  await page.waitForSelector('[data-schp="sp4"] [data-schptd]');
  assert.equal(await page.$eval('[data-schp="sp4"] [data-schptd]', e => e.textContent), '2 to-dos');
  await page.click('[data-schp="sp4"] [data-schptd]');
  await until(page, () => location.hash === '#/todo' && document.querySelector('#tdChips [data-tdf="p:sp4"]').classList.contains('on'));

  // someone deleted from the School page: the line keeps its words, and no name shows on it
  await page.evaluate(() => { const s = window.__gs.schNow(); s.people = s.people.map(p => p.id === 'sp4' ? { id: 'sp4', at: Date.now(), gone: 1 } : p); localStorage.setItem('gs.school', JSON.stringify(s)); });
  await goTo(page, '#/today'); await goTo(page, '#/todo');
  await until(page, () => !/Notreal/.test(document.querySelector('#tdList').textContent) && /Share the planner link/.test(document.querySelector('#tdList').textContent));
  assert.deepEqual(page.errors, []);
  await close();
});

test('two copies of the people are joined one person at a time, and the spots by the later change', async () => {
  const { page, close } = await openApp(browser, { seed: gradingSeed() });
  const m = await page.evaluate(() => {
    const here = { items: [], order: [], ot: 0, people: [{ id: 'a', at: 5, name: 'Here A' }, { id: 'b', at: 9, name: 'Here B newer' }], roles: { list: ['Principal'], at: 3 } };
    const there = { items: [], order: [], ot: 0, people: [{ id: 'b', at: 7, name: 'There B older' }, { id: 'c', at: 4, name: 'There C' }], roles: { list: ['Head of year'], at: 8 } };
    return [window.__gs.schoolMerge(here, there), window.__gs.schoolMerge(here, { items: [], order: [], ot: 0 })];
  });
  assert.deepEqual(m[0].out.people.map(p => p.name), ['Here A', 'Here B newer', 'There C']);
  assert.deepEqual(m[0].out.roles.list, ['Head of year']);
  assert.equal(m[0].toA, true);
  assert.equal(m[1].toA, false, 'nothing new there: nothing to write');
  assert.deepEqual(m[1].out.people.map(p => p.id), ['a', 'b']);
  await close();
});
