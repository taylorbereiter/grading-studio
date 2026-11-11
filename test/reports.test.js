// Stage 6, the report comment helper: a class page's Report comments tab drafts a comment for each student from the
// gradebook's own numbers and the teacher's own comments. Nothing writes it but the page, and nothing is sent anywhere.
// Made-up students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { builtHtml, openApp, goTo, catchDownloads } = require('./helpers/app');
const settle = () => new Promise(r => setTimeout(r, 500));   // no paper is open, so there is only the class list to keep, and that is kept at once
const { gradingSeed } = require('./helpers/steady');

let browser;
before(async () => { builtHtml(); browser = await launch(); });
after(async () => { await browser.close(); });

// The made-up class, with the words a teacher wrote on two students' papers and what each score means on one rubric row.
function seed() {
  const s = gradingSeed(), n2 = JSON.parse(s.ls['gs.b.n2']);
  n2.s['Aria Testwell'].g.comment = 'A confident reading of the poem, with well-chosen quotations.';
  n2.s['Dov Madeup'].g.comment = 'Read the question again before you start.';
  n2.setup = { ...n2.setup, levels: [null, null, { 3: 'Sentences are varied and accurate.', 4: 'Precise, varied language used for effect.' }] };
  s.ls['gs.b.n2'] = JSON.stringify(n2);
  return s;
}
const open = async (o = {}) => {
  const r = await openApp(browser, { seed: seed(), ...o });
  await r.page.evaluate(() => { navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  await goTo(r.page, '#/class/c1/reports');
  await r.page.waitForSelector('#rptText');
  return r;
};
const text = page => page.$eval('#rptText', e => e.value);
const pickStu = async (page, i) => { await page.click('[data-rptstu="' + i + '"]'); await page.waitForFunction(i => document.querySelector('.rptrow.on').dataset.rptstu === String(i), {}, i); };
const type = (page, sel, v) => page.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
const info = (page, n) => page.evaluate(n => JSON.parse(JSON.stringify((window.__gs.state().lib.classes.find(c => c.id === 'c1').info || {})[n] || null)), n);
const libStored = page => page.evaluate(() => localStorage.getItem('gs.lib'));

test('a class has a Report comments tab, and each draft says what the gradebook knows about that student', async () => {
  const { page, close } = await open();
  assert.deepEqual(await page.$$eval('#vClass .ctabs a', a => a.map(x => x.textContent.trim())), ['Assignments', 'Gradebook', 'Students', 'Attendance', 'Missing work', 'Charts', 'Report comments']);
  assert.match(await page.$eval('.rptnote', e => e.textContent), /on this computer from your own scores and comments\. No AI writes it, and nothing is sent anywhere/);
  assert.equal(await page.$eval('#rptName', e => e.textContent), 'Aria Testwell');
  assert.equal(await page.$eval('#rptCall', e => e.value), 'Aria', 'called by the first name');
  // the facts the draft is built from, beside it
  const facts = await page.$eval('#rptFacts', e => e.innerText.replace(/\s+/g, ' '));
  assert.match(facts, /Grade 9\d/); assert.match(facts, /Strongest: Ideas 4/); assert.match(facts, /To work on: Language 3/);
  const aria = await text(page);
  assert.match(aria, /^Aria\b|for Aria\./); assert.match(aria, /Ideas/); assert.match(aria, /Language/);
  assert.ok(!/\{|\}|undefined|null|NaN/.test(aria), 'every word is filled in: ' + aria);
  // a student with missing work, and scores that moved
  await pickStu(page, 3);
  const dov = await text(page);
  assert.match(dov, /one piece of work to hand in: Timed paragraph\./);
  assert.match(await page.$eval('#rptFacts', e => e.innerText), /Missing 1/);
  // every student gets one, in whole sentences, and they are not all the same sentence
  const all = [];
  for (let i = 0; i < 6; i++) { await pickStu(page, i); all.push(await text(page)); }
  for (const t of all) { assert.match(t, /^[A-Z].*\.$/s); assert.ok(!/\{|\}|undefined|NaN| {2}| \./.test(t), t); }
  assert.ok(new Set(all.map(t => t.replace(/^\S+/, '').split('.')[0])).size >= 3, 'the openings vary');
  // the same class and scores always give the same draft
  await pickStu(page, 0); assert.equal(await text(page), aria);
  assert.deepEqual(page.errors, []);
  await close();
});

test('looking at drafts stores nothing; a comment is kept once she types in it or marks it done', async () => {
  const { page, close } = await open();
  await settle(page);
  const was = await libStored(page);
  for (let i = 0; i < 6; i++) await pickStu(page, i);
  await settle(page);
  assert.equal(await libStored(page), was, 'reading the drafts changed nothing');
  await pickStu(page, 0);
  await page.click('#rptText'); await page.keyboard.down('Control'); await page.keyboard.press('End'); await page.keyboard.up('Control');
  await page.keyboard.type(' She reads widely.');
  await page.waitForFunction(() => document.querySelector('[data-rptstu="0"] .schip').textContent === 'Edited');
  const mine = await text(page);
  assert.match(mine, /Well done, Aria\.|proud of this term\./); assert.match(mine, /She reads widely\.$/);
  assert.equal((await info(page, 'Aria Testwell')).rep.t1.text, mine);
  // Done moves on to the next student who isn't done, and counts
  await page.click('[data-rptdoit]');
  await page.waitForFunction(() => document.querySelector('#rptName').textContent === 'Bram Sample');
  assert.equal(await page.$eval('#rptDone', e => e.textContent), '1 of 6 done');
  assert.equal(await page.$eval('[data-rptstu="0"] .schip', e => e.textContent), 'Done');
  assert.equal((await info(page, 'Aria Testwell')).rep.t1.done, true);
  // Bram was marked done as drafted: his draft is now his comment
  const bram = await text(page);
  await page.click('[data-rptdoit]');
  await page.waitForFunction(() => document.querySelector('#rptName').textContent === 'Cleo Fixture');
  assert.equal((await info(page, 'Bram Sample')).rep.t1.text, bram);
  // closing the tab and coming back: both are as she left them
  await settle(page);
  await page.reload(); await goTo(page, '#/class/c1/reports'); await page.waitForSelector('#rptText');
  assert.equal(await text(page), mine);
  assert.equal(await page.$eval('#rptDone', e => e.textContent), '2 of 6 done');
  // a done comment can be reopened; the last words typed are kept even when she leaves the page straight away
  await page.click('[data-rptundone]');
  await page.waitForSelector('[data-rptdoit]');
  assert.equal((await info(page, 'Aria Testwell')).rep.t1.done, undefined);
  await page.click('#rptText'); await page.keyboard.type('X');
  await goTo(page, '#/');
  assert.match((await info(page, 'Aria Testwell')).rep.t1.text, /X/);
  // a comment belongs to its term: the whole year has its own
  await goTo(page, '#/class/c1/reports'); await page.waitForSelector('#rptText');
  await page.click('[data-bkterm="*"]');
  await page.waitForFunction(() => document.querySelector('[data-bkterm="*"]').getAttribute('aria-selected') === 'true' && !/X/.test(document.querySelector('#rptText').value));
  assert.equal(await page.$eval('#rptDone', e => e.textContent), '0 of 6 done');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Draft again says the same facts in other words, and Undo brings back what was there', async () => {
  const { page, close } = await open();
  const first = await text(page);
  await page.click('[data-rptagain]');
  await page.waitForFunction(t => document.querySelector('#rptText').value !== t, {}, first);
  const second = await text(page);
  assert.match(second, /Ideas/); assert.match(second, /Language/);
  await page.click('.toast .tact');
  await page.waitForFunction(t => document.querySelector('#rptText').value === t, {}, first);
  // typed words come back too
  await type(page, '#rptText', 'My own words about Aria.');
  await page.waitForFunction(() => document.querySelector('[data-rptstu="0"] .schip').textContent === 'Edited');
  await page.click('[data-rptagain]');
  await page.waitForFunction(() => document.querySelector('#rptText').value !== 'My own words about Aria.');
  assert.match(await page.$eval('.toast', e => e.textContent), /What you had typed is gone/);
  await page.click('.toast .tact');
  await page.waitForFunction(() => document.querySelector('#rptText').value === 'My own words about Aria.');
  await close();
});

test('length, the grade, the subject, the name and the pronoun change the draft, and a limit is counted', async () => {
  const { page, close } = await open();
  const medium = await text(page);
  await page.click('[data-rptlen="short"]');
  await page.waitForFunction(t => document.querySelector('#rptText').value.length < t.length, {}, medium);
  assert.ok(!/Well done|proud/.test(await text(page)), 'a short one has no closing line');
  await page.click('[data-rptlen="long"]');
  await page.waitForFunction(t => document.querySelector('#rptText').value.length > t.length, {}, medium);
  const long = await text(page);
  assert.match(long, /To move up in Language, the aim is: Precise, varied language used for effect\./, 'her own words for the next level');
  assert.match(long, /Narrative essay|Poetry analysis/, 'the best piece of work is named');
  await page.click('#rptGrade');
  await page.waitForFunction(() => /term grade is 9\d%\./.test(document.querySelector('#rptText').value));
  await type(page, '#rptSubj', 'English');
  await page.waitForFunction(() => / in English/.test(document.querySelector('#rptText').value));
  await type(page, '#rptCall', 'Ari');
  await page.waitForFunction(() => /\bAri\b/.test(document.querySelector('#rptText').value) && !/Aria/.test(document.querySelector('#rptText').value));
  await page.select('#rptPro', 'she');
  await page.waitForFunction(() => /\b[Hh]er\b/.test(document.querySelector('#rptText').value));
  assert.ok(!/\b[Tt]hey\b|\b[Tt]heir\b/.test(await text(page)));
  assert.deepEqual(await info(page, 'Aria Testwell'), { call: 'Ari', pro: 'she' });
  await page.select('#rptPro', 'name');
  await page.waitForFunction(() => /Ari’s/.test(document.querySelector('#rptText').value));
  assert.ok(!/\b[Hh]er\b|\b[Ss]he\b/.test(await text(page)));
  // a limit counts, and says when a comment is over it
  await type(page, '#rptLimit', '100');
  await page.waitForSelector('#rptCount .rptover');
  assert.match(await page.$eval('#rptCount', e => e.textContent), /^\d+ of 100 characters, \d+ over$/);
  // these are the teacher's choices, kept with her work; the subject is this class's own
  const rep = await page.evaluate(() => window.__gs.state().lib.book.rep);
  assert.deepEqual(rep, { len: 'long', grade: true, subj: { c1: 'English' }, limit: 100 });
  await close();
});

test('Wording: her own sentences replace the built-in ones, and the grade boundaries are hers', async () => {
  const { page, close } = await open();
  await page.click('[data-rptwords]');
  await page.waitForSelector('#rptWords');
  assert.match(await page.$eval('[data-rptslot="openHigh"]', e => e.value), /excellent term/, 'the built-in sentences are there to change');
  await page.$eval('[data-rptslot="openHigh"]', e => { e.value = '{name} shone this term{in}.\n'; });
  await page.$eval('[data-rptslot="next"]', e => { e.value = '{They} need{s} to practise {row}.'; });
  await page.click('[data-rptsavew]');
  await page.waitForFunction(() => /^Aria shone this term\./.test(document.querySelector('#rptText').value));
  assert.match(await text(page), /They need to practise Language\./);
  await page.select('#rptPro', 'he');
  await page.waitForFunction(() => /He needs to practise Language\./.test(document.querySelector('#rptText').value));
  assert.deepEqual(await page.evaluate(() => window.__gs.state().lib.book.rep.words), { openHigh: ['{name} shone this term{in}.'], next: ['{They} need{s} to practise {row}.'] }, 'only what she changed is kept');
  // a higher bar for the top band: Aria (about 92%) is no longer in it
  await page.click('[data-rptwords]'); await page.waitForSelector('#rptWords');
  await page.$eval('[data-rptcut="0"]', e => { e.value = '95'; });
  await page.click('[data-rptsavew]');
  await page.waitForFunction(() => !/shone/.test(document.querySelector('#rptText').value));
  // back to the built-in wording
  await page.click('[data-rptwords]'); await page.waitForSelector('#rptWords');
  await page.click('[data-rptreset]'); await page.click('[data-rptsavew]');
  await page.waitForFunction(() => !document.querySelector('#rptWords'));
  assert.deepEqual(await page.evaluate(() => window.__gs.state().lib.book.rep.words), {});
  await close();
});

test('what she wrote on their papers is listed to add, and every comment can be copied or downloaded', async () => {
  const { page, close } = await open();
  assert.match(await page.$eval('.rptsaid', e => e.innerText), /Poetry analysis\s+A confident reading of the poem/);
  const before = await text(page);
  await page.click('[data-rptadd="0"]');
  assert.equal(await text(page), before + ' A confident reading of the poem, with well-chosen quotations.');
  assert.equal((await info(page, 'Aria Testwell')).rep.t1.text, await text(page));
  await pickStu(page, 1);
  assert.equal(await page.$('.rptsaid'), null, 'nothing to list for a student with no comments');
  // one comment
  await page.click('[data-rptcopy]');
  assert.equal(await page.evaluate(() => window.__copied), await text(page));
  // all of them: a name and a comment on each line, drafts included
  await page.click('[data-rptcopyall]');
  const rows = (await page.evaluate(() => window.__copied)).split('\n').map(l => l.split('\t'));
  assert.deepEqual(rows.map(r => r[0]), ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup', 'Esme Placeholder', 'Finn Example']);
  assert.match(rows[0][1], /well-chosen quotations\.$/); assert.match(rows[3][1], /Timed paragraph/);
  assert.ok(rows.every(r => r.length === 2 && r[1].length > 40));
  const dl = await catchDownloads(page);
  await page.click('[data-rptcsv]');
  const f = await dl.next();
  assert.equal(f.name, 'Grade 9 English report comments.csv');
  const csv = Buffer.from(f.bytes).toString('utf8');
  assert.match(csv, /^﻿Student,Comment\r\nAria Testwell,"Aria /);
  assert.equal(csv.trim().split('\r\n').length, 7);
  // Find anything knows the page
  assert.ok((await page.evaluate(() => window.__gs.findRows().map(r => r.label))).includes('Grade 9 English report comments'));
  assert.deepEqual(page.errors, []);
  await close();
});
