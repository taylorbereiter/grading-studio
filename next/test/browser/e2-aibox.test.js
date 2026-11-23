// Stage 8, slice E2: the assistant's box from every Planner screen (rows E2-058, E2-072, E2-073 of rebuild/audit/gaps.md): a unit's
// document put in the box from the unit page, and a right-click anywhere in the Planner (the week, a lesson card, a slide, the
// unit page, the Library, a document, a lesson's file) giving a comment for the assistant on it or putting it in the box. The box
// is kv "cbox", kept as the current Planner keeps it, so the current Planner opens it unchanged. Made-up work at the stopped clock
// (planseed.js, Tuesday 27 October 2026).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./e2harness.js');
const { LESSONS, UNITS } = require('./planseed.js');
const h = harness(before, after);
const until = (p, fn, ...a) => p.waitForFunction(fn, { timeout: 8000 }, ...a);
const boxNow = async (p, f) => { for (let k = 0; k < 60; k++) { const b = await h.kvInDb(p, 'cbox'); if (b && f(b)) return b; await new Promise(r => setTimeout(r, 100)); } return h.kvInDb(p, 'cbox'); };
const lessonNow = async (p, id, f) => { for (let k = 0; k < 60; k++) { const l = await h.lessonInDb(p, id); if (l && f(l)) return l; await new Promise(r => setTimeout(r, 100)); } return h.lessonInDb(p, id); };
const copy = x => JSON.parse(JSON.stringify(x));
// A unit document and a lesson file, with the document's words kept as the current Planner keeps them (kv file:<id>).
const withFiles = () => {
  const units = copy(UNITS), lessons = copy(LESSONS);
  units.find(u => u.id === 'U2').files = [{ id: 'UD1', name: 'Poetry task sheet', kind: 'doc', type: 'text/html', size: 90, added: 1792000000000 }, { id: 'UF1', name: 'Rubric.pdf', kind: 'summative', type: 'application/pdf', size: 900, added: 1792000000000 }];
  lessons.find(l => l.id === 'L2').files = [{ id: 'LF1', name: 'Poem cards.pdf', kind: 'other', type: 'application/pdf', size: 900, added: 1792000000000 }];
  return { units, lessons };
};
const putDoc = p => p.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put(new Blob(['<h1>Poetry task sheet</h1><p>Write a poem of eight lines about a place you know.</p>'], { type: 'text/html' }), 'file:UD1'); tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error); }; }));
// A right-click on what the selector finds (puppeteer moves the mouse there and presses the right button).
const rightClick = (p, sel, o) => p.click(sel, { button: 'right', ...o });
const ctxMenu = async p => { await p.waitForSelector('[data-ctx="menu"] [role="menuitem"]'); await until(p, () => document.activeElement && document.activeElement.matches('[data-ctx="menu"] [role="menuitem"]')); return p.$$eval('[data-ctx="menu"] [role="menuitem"]', b => b.map(x => x.textContent)); };
const pick = (p, what) => p.click('[data-ctx="menu"] [data-ctx-do="' + what + '"]');
const note = async (p, words) => {
  await p.waitForSelector('[data-ctx="note"] textarea'); await until(p, () => document.activeElement && document.activeElement.matches('[data-ctx="note"] textarea'));
  await p.keyboard.type(words); await p.keyboard.down('Control'); await p.keyboard.press('Enter'); await p.keyboard.up('Control');
  await until(p, () => !document.querySelector('[data-ctx]'));
};
const selectIn = (p, sel) => p.evaluate(sel => { const el = document.querySelector(sel), r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }, sel);
const boxTab = async p => { await p.evaluate(() => [...document.querySelectorAll('aside.beside [role=tab]')].pop().click()); await p.waitForSelector('aside.beside .bchip'); };

test('E2-058: a unit\'s document goes in the assistant\'s box from the unit page and from the document, by the unit, and copies with its words', async t => {
  const { units, lessons } = withFiles(), p = await h.fresh(1366, { units, lessons });
  t.after(() => p.ctx.close());
  await p.ctx.overridePermissions(h.srv.url.replace(/\/$/, ''), ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  await putDoc(p);
  await h.open(p, 'class/c1');
  await until(p, () => document.querySelector('#h-unit') && document.querySelector('#h-unit').textContent === 'Unit 2: Poetry');
  await p.waitForSelector('[data-ufile-box="UD1"]');
  assert.equal(await p.$('[data-ufile-box="UF1"]'), null, 'a file that is not a document has no box button, as in the current Planner');
  assert.match(await p.$eval('[data-ufile-box="UD1"]', b => b.getAttribute('aria-label')), /^Add to .+'s box$/);
  await p.click('[data-ufile-box="UD1"]');
  const chip = { kind: 'file', t: 'unit', owner: 'U2', id: 'UD1', label: 'Poetry task sheet' };
  assert.deepEqual((await boxNow(p, b => b.chips.length === 1)).chips, [chip]);
  // the document itself: its Add to the box names the unit, not a lesson
  await p.click('[data-ufile="UD1"] .mopen');
  await p.waitForSelector('dialog.sheet [data-docpage]'); await until(p, () => /eight lines/.test(document.querySelector('[data-docpage]').textContent));
  await p.click('dialog.sheet [data-focus="doc-to-box"]');
  assert.deepEqual((await boxNow(p, b => b.chips.length === 2)).chips, [chip, chip]);
  await p.keyboard.press('Escape'); await until(p, () => !document.querySelector('dialog.sheet[open]'));
  // the box beside the unit shows it by its name, and copies its words; nothing names a folder or file on her computer
  await p.click('[data-focus="unit-menu"]'); await p.waitForSelector('.pop [role="menuitem"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role^="menuitem"]')].find(b => b.textContent.startsWith('Beside')).click());
  await p.waitForSelector('aside.beside [role=tab]'); await boxTab(p);
  assert.deepEqual(await p.$$eval('aside.beside .bchip span[data-raw]', s => s.map(x => x.textContent)), ['Poetry task sheet', 'Poetry task sheet']);
  await p.click('aside.beside [data-focus="box-copy"]');
  await p.waitForFunction(async () => (await navigator.clipboard.readText()).includes('[Document: Poetry task sheet]'), { timeout: 5000, polling: 200 });
  const text = await p.evaluate(() => navigator.clipboard.readText());
  assert.match(text, /^\[Document: Poetry task sheet\]\nPoetry task sheet\nWrite a poem of eight lines about a place you know\./);
  assert.doesNotMatch(text, /\/Users\/|~\/|[A-Z]:\\|Lessons\/|Units\//, 'names no folder or file on her computer');
  // saved work: the current Planner opens the same box
  const box = await h.kvInDb(p, 'cbox');
  await p.goto(h.srv.url + 'planner.html');
  await p.waitForFunction(() => { const P = window.__planner; return P && P.SP && P.L.units && P.L.units.length && P.SP.box.chips.length === 2; }, { timeout: 20000 });
  assert.deepEqual(await p.evaluate(() => JSON.parse(JSON.stringify(window.__planner.SP.box))), box);
  assert.deepEqual(p.errors, []);
});

test('E2-072 E2-073: a right-click on the week, a lesson card, a slide, the unit page, the Library, a document and a lesson\'s file comments for the assistant or puts it in the box; the current Planner opens the box and the comments', async t => {
  const { units, lessons } = withFiles(), p = await h.fresh(1366, { units, lessons });
  t.after(() => p.ctx.close());
  await putDoc(p);
  // the week: a lesson card's menu (by right-click) puts the lesson in the box, or a comment on it kept with the lesson
  await h.open(p, 'calendar/class');
  await rightClick(p, '.lcw a[data-lesson="L2"]'); await p.waitForSelector('.pop [role="menuitem"]');
  const items = await p.$$eval('.pop [role="menuitem"]', b => b.map(x => x.textContent));
  assert.ok(items.some(x => /^Comment for .+ on this lesson…$/.test(x)) && items.some(x => /^Add this lesson to .+'s box$/.test(x)), items.join(' | '));
  await p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(b => /^Add this lesson/.test(b.textContent)).click());
  const chips = [{ kind: 'lesson', lesson: 'L2', label: 'Reading a poem aloud' }];
  assert.deepEqual((await boxNow(p, b => b.chips.length === 1)).chips, chips);
  await rightClick(p, '.lcw a[data-lesson="L2"]'); await p.waitForSelector('.pop [role="menuitem"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role="menuitem"]')].find(b => /^Comment for/.test(b.textContent)).click());
  await note(p, 'Start with the audio recording');
  const l2 = await lessonNow(p, 'L2', l => (l.talk || []).length === 1);
  assert.equal(l2.talk[0].text, 'Start with the audio recording'); assert.equal(l2.talk[0].by, 'you');
  chips.push({ kind: 'note', about: chips[0], text: 'Start with the audio recording', label: 'Comment on Reading a poem aloud' });
  assert.deepEqual((await boxNow(p, b => b.chips.length === 2)).chips, chips);
  // anywhere else on the week: the words clicked, from the week; Shift keeps the browser's menu, and so does a text box
  await rightClick(p, '#cal-title');
  const onWeek = await ctxMenu(p);
  assert.ok(/^Comment for .+ on this…$/.test(onWeek[0]) && /^Add this to .+'s box$/.test(onWeek[1]), onWeek.join(' | '));
  await pick(p, 'add');
  const week = await p.$eval('#cal-title', e => e.textContent);
  chips.push({ kind: 'quote', label: 'Week of Mon, Oct 26: “' + week + '”', text: week, where: { k: 'week', v: '2026-10-26' } });
  assert.deepEqual((await boxNow(p, b => b.chips.length === 3)).chips, chips);
  await p.keyboard.down('Shift'); await rightClick(p, '#cal-title'); await p.keyboard.up('Shift');
  await new Promise(r => setTimeout(r, 400)); assert.equal(await p.$('[data-ctx]'), null, 'Shift + right-click keeps the browser\'s menu');
  await rightClick(p, '[data-focus="cal-date"]'); await new Promise(r => setTimeout(r, 400)); assert.equal(await p.$('[data-ctx]'), null, 'a text box keeps its own menu');
  // Escape closes the menu without doing anything
  await rightClick(p, '#cal-title'); await ctxMenu(p); await p.keyboard.press('Escape'); await until(p, () => !document.querySelector('[data-ctx]'));

  // a slide on the lesson page: a comment kept with that slide, and the slide in the box; selected words by their own lines
  await h.open(p, 'lesson/L2');
  await p.waitForSelector('[data-slide-i="2"]');
  await rightClick(p, '[data-slide-i="2"]');
  const onSlide = await ctxMenu(p);
  assert.ok(/^Comment for .+ on this slide…$/.test(onSlide[0]) && /^Add this slide to .+'s box$/.test(onSlide[1]), onSlide.join(' | '));
  await pick(p, 'note'); await note(p, 'Fewer bullets here');
  const withNote = await lessonNow(p, 'L2', l => (l.slides[2].talk || []).length === 1);
  assert.equal(withNote.slides[2].talk[0].text, 'Fewer bullets here');
  assert.equal(withNote.talk.length, 1, 'the lesson\'s own comment is still there');
  const slide = { kind: 'slide', lesson: 'L2', i: 2, label: 'Reading a poem aloud, slide 3: Warm-up' };
  chips.push({ kind: 'note', about: slide, text: 'Fewer bullets here', label: 'Comment on ' + slide.label });
  assert.deepEqual((await boxNow(p, b => b.chips.length === 4)).chips, chips);
  await rightClick(p, '[data-slide-i="2"]'); await ctxMenu(p); await pick(p, 'add');
  chips.push(slide);
  assert.deepEqual((await boxNow(p, b => b.chips.length === 5)).chips, chips);
  // a lesson's file, by its chip
  await p.waitForSelector('[data-chip*="LF1"]');
  await rightClick(p, '[data-chip*="LF1"]');
  const onFile = await ctxMenu(p);
  assert.ok(/^Add this file to .+'s box$/.test(onFile[1]), onFile.join(' | '));
  await pick(p, 'add');
  chips.push({ kind: 'file', t: 'lesson', owner: 'L2', id: 'LF1', label: 'Poem cards.pdf' });
  assert.deepEqual((await boxNow(p, b => b.chips.length === 6)).chips, chips);

  // the unit page: selected words, from the unit
  await h.open(p, 'class/c1');
  await until(p, () => document.querySelector('#h-unit') && document.querySelector('#h-unit').textContent === 'Unit 2: Poetry');
  await selectIn(p, '#h-unit');
  await rightClick(p, '#h-unit');
  const onSel = await ctxMenu(p);
  assert.ok(/^Comment for .+ on the selected text…$/.test(onSel[0]) && /^Add the selected text to .+'s box$/.test(onSel[1]), onSel.join(' | '));
  await pick(p, 'note'); await note(p, 'Keep this unit to five weeks');
  const unitQuote = { kind: 'quote', label: 'Unit “Unit 2: Poetry”: “Unit 2: Poetry”', text: 'Unit 2: Poetry', where: { k: 'unit', v: 'Unit 2: Poetry' } };
  chips.push({ kind: 'note', about: unitQuote, text: 'Keep this unit to five weeks', label: 'Comment on ' + unitQuote.label });
  assert.deepEqual((await boxNow(p, b => b.chips.length === 7)).chips, chips);
  // a unit's document: the words right-clicked in it
  await p.click('[data-ufile="UD1"] .mopen');
  await p.waitForSelector('dialog.sheet [data-docpage] p'); await until(p, () => /eight lines/.test(document.querySelector('[data-docpage]').textContent));
  await rightClick(p, 'dialog.sheet [data-docpage] p');
  await ctxMenu(p); await pick(p, 'add');
  const line = 'Write a poem of eight lines about a place you know.';
  chips.push({ kind: 'quote', label: 'Document “Poetry task sheet”: “' + line.slice(0, 70) + '”', text: line, where: { k: 'doc', v: 'Poetry task sheet' } });
  assert.deepEqual((await boxNow(p, b => b.chips.length === 8)).chips, chips);
  assert.ok(await p.$('dialog.sheet[open]'), 'the document stays open');
  await p.keyboard.press('Escape'); await until(p, () => !document.querySelector('dialog.sheet[open]'));

  // the Library's activities
  await h.open(p, 'library');
  await p.waitForSelector('.libpanel li');
  await rightClick(p, '.libpanel li');
  await ctxMenu(p); await pick(p, 'add');
  const acts = await boxNow(p, b => b.chips.length === 9), last = acts.chips[8];
  assert.equal(last.kind, 'quote'); assert.deepEqual(last.where, { k: 'acts' }); assert.match(last.label, /^Activity bank: “/); assert.ok(last.text.length > 0);
  chips.push(last);

  // the box beside the week names each in her language and copies them as one message, naming no folder or file on her computer
  await h.open(p, 'calendar/class');
  await p.click('main [data-focus="week-menu"]'); await p.waitForSelector('.pop [role="menuitem"]');
  await p.evaluate(() => [...document.querySelectorAll('.pop [role^="menuitem"]')].find(b => b.textContent.startsWith('Beside')).click());
  await p.waitForSelector('aside.beside [role=tab]'); await boxTab(p);
  const names = await p.$$eval('aside.beside .bchip span[data-raw]', s => s.map(x => x.textContent));
  assert.deepEqual([names[0], names[1], names[3]], ['Reading a poem aloud', 'Comment on Reading a poem aloud', 'Comment on Reading a poem aloud, slide 3: Warm-up']);
  assert.ok(names[2] === 'Week of 26 Oct: \u201c' + week + '\u201d' || names[2] === 'Week of Oct 26: \u201c' + week + '\u201d', names[2]);
  assert.equal(names[7], 'Document “Poetry task sheet”: “' + line.slice(0, 70) + '”');

  // saved work: the current Planner opens the same box, and the comments on the lesson and its slide
  const box = await h.kvInDb(p, 'cbox');
  await p.goto(h.srv.url + 'planner.html');
  await p.waitForFunction(n => { const P = window.__planner; return P && P.SP && P.L.lessons && P.L.lessons.length && P.SP.box.chips.length === n; }, { timeout: 20000 }, chips.length);
  assert.deepEqual(await p.evaluate(() => JSON.parse(JSON.stringify(window.__planner.SP.box))), box);
  assert.deepEqual(await p.evaluate(() => { const l = window.__planner.L.lessons.find(x => x.id === 'L2'); return [l.talk.map(m => m.text), l.slides[2].talk.map(m => m.text)]; }), [['Start with the audio recording'], ['Fewer bullets here']]);
  assert.deepEqual(p.errors, []);
});

test('E2-072 E2-073: the right-click menu and the comment are in the teacher\'s language', async t => {
  const p = await h.fresh(1366, {}, { 'gs.lang': JSON.stringify('de') });
  t.after(() => p.ctx.close());
  await h.open(p, 'lesson/L2');
  await p.waitForSelector('[data-slide-i="2"]');
  await rightClick(p, '[data-slide-i="2"]');
  const items = await ctxMenu(p);
  assert.ok(/^Kommentar für .+ zu dieser Folie…$/.test(items[0]) && /^Diese Folie zur Box für .+ hinzufügen$/.test(items[1]), items.join(' | '));
  assert.equal(await p.$eval('[data-ctx="menu"] small', s => s.textContent), 'Umschalt + Rechtsklick für das übliche Menü');
  await pick(p, 'note');
  await p.waitForSelector('[data-ctx="note"] textarea');
  assert.match(await p.$eval('[data-ctx="note"] b', b => b.textContent), /^Kommentar für /);
  assert.equal(await p.$eval('[data-ctx="note"] small[data-raw]', s => s.textContent), 'Reading a poem aloud, Folie 3: Warm-up');
  await p.keyboard.press('Escape'); await until(p, () => !document.querySelector('[data-ctx]'));
  assert.deepEqual(p.errors, []);
});
