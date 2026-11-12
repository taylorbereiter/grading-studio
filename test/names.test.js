// Name protection: what goes in the Claude ZIP and what shows during anonymous grading, for names in any alphabet. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { unzipSync, strFromU8 } = require('fflate');
const { launch } = require('./helpers/chrome');
const { openApp, openZip, pickFile, goToStudent, catchDownloads, score, settle, press, pick } = require('./helpers/app');
const { zipOf, makeDocx } = require('./helpers/fixtures');

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

// One page; each line 26 points below the last, starting 62 points from the top. field: a filled-in form box 360 up from the bottom.
async function pdf(lines, { field } = {}) {
  const d = await PDFDocument.create(), font = await d.embedFont(StandardFonts.Helvetica), p = d.addPage([612, 792]);
  lines.forEach((t, i) => p.drawText(t, { x: 60, y: 730 - i * 26, size: 14, font, color: rgb(0, 0, 0) }));
  if (field) { const f = d.getForm().createTextField('box1'); f.setText(field); f.addToPage(p, { x: 60, y: 360, width: 300, height: 30 }); }
  return d.save();
}
const LINE = i => [60, 50 + i * 26, 30, 12];   // the start of line i, in page points from the top left
// How much of a box on a page of a PDF is dark, from 0 to 1. Printed words are about a quarter; a cover is nearly all.
const pdfDark = (page, bytes, box) => page.evaluate(async (b64, box) => {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const d = await pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise, p = await d.getPage(1), s = 2, vp = p.getViewport({ scale: s });
  const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  const px = c.getContext('2d').getImageData(box[0] * s, box[1] * s, box[2] * s, box[3] * s).data; let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] < 90) n++;
  d.destroy(); return n / (px.length / 4);
}, Buffer.from(bytes).toString('base64'), box);
const COVERED = .8, BARE = .6;
const typeComments = async (page, students, text) => {
  for (const [k, v] of Object.entries(text)) {
    await goToStudent(page, students.indexOf(k));
    await page.waitForSelector('#cmtIn');
    await page.$eval('#cmtIn', (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  }
  await page.evaluate(() => document.activeElement.blur());
};
// A download with no pages to wait for.
const openNoPages = async (page, bytes) => { await pickFile(page, '#fileIn', bytes, 'Essay.zip'); await page.waitForFunction(() => { const a = document.querySelector('#app'); return a && !a.hidden && window.__gs.state().batch; }); };
const keys = page => page.evaluate(() => window.__gs.state().batch.students.map(s => s.key));
async function makeZip(page) {
  const dl = await catchDownloads(page);
  await press(page, '#shareBtn');
  await page.waitForSelector('#dlgBox [data-make]');
  const got = await dl.next(() => page.click('#dlgBox [data-make]'));
  await dl.close();
  const z = unzipSync(got.bytes), codes = await page.evaluate(() => window.__gs.state().batch.share.codes);
  return { z, codes, csv: strFromU8(z['scores.csv']), comments: strFromU8(z['comments.json']), readme: strFromU8(z['README.txt']), paper: k => z['papers/' + codes[k] + '.pdf'] };
}
const startAnon = async page => {
  await page.click('#anonSw'); await page.waitForSelector('[data-go]'); await page.click('[data-go]');
  await page.waitForFunction(() => window.__gs.anonOn() && document.querySelector('#paper .who'));
};
const closeDlg = page => page.evaluate(() => { const c = document.querySelector('#dlgBox [data-cancel], #dlgBox [data-close], #dlgBox [data-done]'); if (c) c.click(); });
// All the words on screen, and what's in any box.
const shown = page => page.evaluate(() => {
  const hits = [], walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  for (let el = walk.currentNode; el; el = walk.nextNode()) {
    if (['SCRIPT', 'STYLE', 'TEMPLATE'].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim() && !el.closest('.anonhide')) hits.push(n.nodeValue.trim());
    if (/^(INPUT|TEXTAREA)$/.test(el.tagName) && el.value) hits.push(el.value);
  }
  return hits.join(' | ');
});

test('accented, Vietnamese and Korean names are swapped in what goes to Claude, and covered on the page', async () => {
  const { page, close } = await openApp(browser);
  const files = {
    'José García/Essay.pdf': await pdf(['José García essay', 'JOSÉ GARCÍA', 'Body text.']),
    'Søren Müller/Essay.pdf': await pdf(['Søren Müller essay', 'Soren too', 'Body text.']),
    'Jose Nunez/Essay.pdf': await pdf(['José Núñez essay', 'Body text.']),
    'Nguyễn An/Essay.pdf': await pdf(['Essay with no name typed', 'Body text.']),
    '김민수/Essay.pdf': await pdf(['Essay with no name typed', 'Body text.']),
  };
  await openZip(page, zipOf(files), 'Essay.zip');
  const st = await keys(page);
  await typeComments(page, st, {
    'José García': 'José did well. Good work José!',
    'Søren Müller': 'Søren, nice. Soren too. Mueller or MÜLLER.',
    'Jose Nunez': 'José Núñez is improving.',
    'Nguyễn An': 'Nguyễn An worked hard. Nguyen too, and Nguyễn alone. Reading this was a pleasure.',
    '김민수': '민수 did well. 김민수 is improving. 민수는 좋아요.',
  });
  const { csv, paper } = await makeZip(page);
  for (const name of ['José', 'García', 'Søren', 'Soren', 'Müller', 'MÜLLER', 'Mueller', 'Núñez', 'Nguyễn', 'Nguyen', '민수', '김민수'])
    assert.ok(!csv.includes(name), name + ' stayed in scores.csv: ' + csv);
  assert.match(csv, /Reading this was a pleasure/);
  assert.ok(await pdfDark(page, paper('José García'), LINE(0)) > COVERED, 'José on the page is covered');
  assert.ok(await pdfDark(page, paper('José García'), LINE(1)) > COVERED, 'JOSÉ on the page is covered');
  assert.ok(await pdfDark(page, paper('Søren Müller'), LINE(0)) > COVERED, 'Søren on the page is covered');
  assert.ok(await pdfDark(page, paper('Søren Müller'), LINE(1)) > COVERED, 'Soren on the page is covered');
  assert.ok(await pdfDark(page, paper('Jose Nunez'), LINE(0)) > COVERED, 'José for the folder Jose is covered');
  assert.ok(await pdfDark(page, paper('José García'), LINE(2)) < BARE, 'the rest of the page isn’t');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a name in pieces, in another alphabet or in decomposed letters is covered where it sits', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Nguyễn An/Essay.pdf': await pdf(['Body']), '김민수/Essay.pdf': await pdf(['Body']), 'Андрей Петров/Essay.pdf': await pdf(['Body']), '王小明/Essay.pdf': await pdf(['Body']) }), 'Essay.zip');
  // A page's text: Word's PDFs often break a name where a letter comes from another font.
  const covers = (items, who) => page.evaluate(async (items, who) => {
    const st = window.__gs.state().batch.students.find(s => s.key === who), T = [1, 0, 0, 1, 0, 0];
    const fake = { getTextContent: async () => ({ items: items.map(([str, x, w]) => ({ str, width: w, transform: [10, 0, 0, 10, x, 100] })) }), getAnnotations: async () => [] };
    return (await window.__gs.autoCovers(fake, { transform: T, scale: 1 }, window.__gs.coverRx(st))).map(r => [Math.round(r.x), Math.round(r.x + r.w)]);
  }, items, who);
  const split = await covers([['Nguy', 100, 20], ['ễ', 120, 5], ['n', 125, 5], [' wrote this', 130, 50]], 'Nguyễn An');
  assert.ok(split.length >= 3, 'each piece gets a cover: ' + JSON.stringify(split));
  assert.ok(Math.min(...split.map(r => r[0])) <= 100 && Math.max(...split.map(r => r[1])) >= 130, 'from the first letter to the last: ' + JSON.stringify(split));
  assert.equal((await covers([['A long sentence with nothing in it', 100, 170]], 'Nguyễn An')).length, 0);
  for (const [text, who] of [['Nguyễn', 'Nguyễn An'], ['김민수', '김민수'], ['김민수', '김민수'], ['민수는', '김민수'], ['Андрей', 'Андрей Петров'], ['АНДРЕЙ', 'Андрей Петров'], ['Петрова', 'Андрей Петров'], ['小明', '王小明'], ['王小明', '王小明']])
    assert.ok((await covers([[text, 100, 40]], who)).length >= 1, text + ' for ' + who);
  assert.deepEqual(page.errors, []);
  await close();
});

// The boxes a page's text gets, left and right edges. items: [text, x, width, direction], on one line, as pdf.js hands them over.
const fakeCovers = (page, items, who) => page.evaluate(async (items, who) => {
  const st = window.__gs.state().batch.students.find(s => s.key === who), T = [1, 0, 0, 1, 0, 0];
  const fake = { getTextContent: async () => ({ items: items.map(([str, x, w, dir]) => ({ str, dir, width: w, transform: [10, 0, 0, 10, x, 100] })) }), getAnnotations: async () => [] };
  return (await window.__gs.autoCovers(fake, { transform: T, scale: 1 }, window.__gs.coverRx(st))).map(r => [Math.round(r.x), Math.round(r.x + r.w)]);
}, items, who);
const swapFor = (page, who, text) => page.evaluate((who, text) => { const G = window.__gs; return text.replace(G.coverRx(G.state().batch.students.find(s => s.key === who)), '[name]'); }, who, text);
const fileFor = (page, who, text) => page.evaluate((who, text) => { const G = window.__gs; return text.replace(G.fileRx(G.state().batch.students.find(s => s.key === who)), '[name]'); }, who, text);
// The boxes reach from..to and don't stray much past it.
const onlyOver = (boxes, from, to) => boxes.length > 0 && boxes.every(b => b[0] >= from - 14 && b[1] <= to + 14) && Math.min(...boxes.map(b => b[0])) <= from && Math.max(...boxes.map(b => b[1])) >= to;
const openShareBox = async page => {
  await press(page, '#shareBtn');
  await page.waitForFunction(() => /random code/.test(document.querySelector('#dlgBox .bb').innerText));
  return page.$eval('#dlgBox .bb', e => e.innerText);
};
// The search for each student's name on their paper is done and on screen.
const namesDone = page => page.waitForFunction(() => { const f = document.querySelector('#nameFlags'); return f && !window.__gs.namesLooking() && !/Looking for/.test(f.innerText); });

test('a name like Mỹ, Ân or Tô doesn’t turn my, an or to into names for the whole class', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({
    'Nguyễn Thị Mỹ/Essay.pdf': await pdf(['Body.']),
    'Trần Bảo Ân/Essay.pdf': await pdf(['Body.']),
    'Tô Minh Hà/Essay.pdf': await pdf(['Body.']),
    'Tố Uyên/Essay.pdf': await pdf(['Body.']),
    'Ben Carter/Essay.pdf': await pdf(['To my mother, an essay about what to do.', 'The river bends and I want to go home.']),
  }), 'Essay.zip');
  const plain = 'you need to do an outline and stick to it. In my view it is close to done';
  assert.equal(await swapFor(page, 'Ben Carter', plain), plain);
  assert.equal(await page.evaluate(t => window.__gs.nameFreeText(t), plain), plain);
  const ask = await page.evaluate(() => window.__gs.SHARE_ASK);
  assert.equal(await page.evaluate(t => window.__gs.nameFreeText(t), ask), ask, 'the message she copies is left alone');
  assert.equal(await swapFor(page, 'Ben Carter', 'Mỹ and MỸ and Ân and Tô helped. ' + 'Mỹ'.normalize('NFD') + ' too, and Trần Bảo Ân.'), '[name] and [name] and [name] and [name] helped. [name] too, and [name].');
  assert.equal(await swapFor(page, 'Nguyễn Thị Mỹ', 'Mỹ wrote this, and My too, in my words.'), '[name] wrote this, and [name] too, in my words.');
  await typeComments(page, await keys(page), { 'Ben Carter': plain });
  const { csv, paper } = await makeZip(page);
  assert.ok(csv.includes(plain), csv);
  assert.ok(await pdfDark(page, paper('Ben Carter'), [60, 50, 300, 12]) < BARE, 'to and my on the page stay');
  assert.ok(await pdfDark(page, paper('Ben Carter'), [60, 76, 300, 12]) < BARE, 'a whole line with to in it stays');
  assert.deepEqual(page.errors, []);
  await close();
  // Every part of the name an everyday word: "to my" still isn't one.
  const b = await openApp(browser);
  await openZip(b.page, zipOf({ 'Tô Mỹ/Essay.pdf': await pdf(['Body.']), 'Đỗ Ân/Essay.pdf': await pdf(['Body.']), 'Ben Carter/Essay.pdf': await pdf(['Body.']) }), 'Essay.zip');
  const text = 'Write to my friend, and do an outline.';
  assert.equal(await swapFor(b.page, 'Ben Carter', text), text);
  assert.equal(await swapFor(b.page, 'Ben Carter', 'Read Tô Mỹ, then TO MY.'), 'Read [name], then [name].');
  await b.close();
});

test('names stored in special letters are covered: Chinese and Japanese radicals, and Arabic letter by letter', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ '王小明/Essay.pdf': await pdf(['Body']), '张文文/Essay.pdf': await pdf(['Body']), '田中 花子/Essay.pdf': await pdf(['Body']), 'محمد علي/Essay.pdf': await pdf(['Body']), 'Ben Carter/Essay.pdf': await pdf(['Body']) }), 'Essay.zip');
  const row = (chars, x = 100, w = 10) => chars.map((c, i) => [c, x + i * w, w]);
  // Just what pdf.js gives for pages Chrome printed.
  assert.ok(onlyOver(await fakeCovers(page, row(['姓', '名', '：', '王', '⼩', '明']), '王小明'), 130, 160), 'the name, not the label');
  assert.ok(onlyOver(await fakeCovers(page, row(['⼩', '明', '的', '作', '⽂']), '王小明'), 100, 120), 'the given name alone');
  assert.ok(onlyOver(await fakeCovers(page, row(['张', '⽂', '⽂']), 'Ben Carter'), 100, 130), 'a classmate’s');
  assert.ok(onlyOver(await fakeCovers(page, row(['⽥', '中', '花', '⼦']), '田中 花子'), 100, 140));
  assert.ok(onlyOver(await fakeCovers(page, row(['⼩', '明']), 'Ben Carter'), 100, 120), 'a classmate’s given name on someone else’s paper');
  assert.equal((await fakeCovers(page, row(['作', '⽂', '的', '题']), 'Ben Carter')).length, 0, 'other words stay');
  // One shaped letter to an item, last letter first, then a gap, as they sit on the line.
  const ali = row(['ﻲ', 'ﻠ', 'ﻋ']), muh = row(['د', 'ﻣ', 'ﺣ', 'ﻣ'], 135);
  const whole = await fakeCovers(page, [...ali, ...muh], 'محمد علي');
  assert.ok(onlyOver(whole, 100, 175), 'both words: ' + JSON.stringify(whole));
  assert.ok(onlyOver(await fakeCovers(page, [['Name:', 40, 30], ...ali, ...muh, ['wrote this.', 185, 50]], 'Ben Carter'), 100, 175), 'on a classmate’s paper');
  assert.ok(onlyOver(await fakeCovers(page, [['ﻣﺤﻤﺪ', 100, 40]], 'Ben Carter'), 100, 140), 'in one piece, in reading order');
  assert.deepEqual(page.errors, []);
  await close();
});

// A page Chrome really prints, with where each of the words in find sits, in points. These tests lean on the fonts this computer has for each alphabet.
async function printed(lines, find, size = 15) {
  const p = await browser.newPage();
  await p.setContent('<html><body style="margin:0;font:' + size + 'px Arial,sans-serif"><div style="width:720px;margin:20px 40px;line-height:' + (size < 10 ? '10px' : '1.5') + '">' + lines.map(l => '<div>' + l + '</div>').join('') + '</div></body></html>');
  // A tag round a word would make it a piece of its own in the PDF, so the words are found in the text.
  const spots = await p.evaluate(find => {
    const out = [], walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) for (const word of find) for (let at = walk.currentNode.nodeValue.indexOf(word); at >= 0; at = walk.currentNode.nodeValue.indexOf(word, at + 1)) {
      const g = document.createRange(); g.setStart(walk.currentNode, at); g.setEnd(walk.currentNode, at + word.length);
      const r = g.getBoundingClientRect(); out.push({ text: word, x: r.left * .75, w: r.width * .75, y: r.top * .75, h: r.height * .75 });
    }
    return out;
  }, find);
  const bytes = await p.pdf({ format: 'Letter' });
  await p.close();
  return { bytes, spots };
}
// The covers the first page of this student's first file gets, read the way the app reads it.
const realCovers = (page, who) => page.evaluate(async who => {
  const G = window.__gs, st = G.state().batch.students.find(s => s.key === who);
  const d = await pdfjsLib.getDocument({ data: st.files[0].data.slice(), isEvalSupported: false }).promise, p = await d.getPage(1);
  const cs = await G.autoCovers(p, p.getViewport({ scale: 1 }), G.coverRx(st));
  d.destroy();
  return cs.map(c => ({ x: c.x, y: c.y, w: c.w, h: c.h }));
}, who);
const onLine = (covers, s) => covers.filter(c => c.y < s.y + s.h * .7 && c.y + c.h > s.y + s.h * .3);
// All of the spot is under a cover, and what covers its line reaches no further than a letter or two past it.
function coveredOnly(covers, s) {
  const line = onLine(covers, s), say = JSON.stringify(line.map(c => [Math.round(c.x), Math.round(c.x + c.w)])) + ', and it runs ' + Math.round(s.x) + ' to ' + Math.round(s.x + s.w);
  for (let x = s.x + 1; x < s.x + s.w - 1; x++) assert.ok(line.some(c => c.x <= x && c.x + c.w >= x), s.text + ' is left bare: covers ' + say);
  assert.ok(line.every(c => c.x >= s.x - 16 && c.x + c.w <= s.x + s.w + 16), s.text + ': a cover strays over other words: ' + say);
}

test('a three-part name doesn’t turn to my, do my or do an into a name for the whole class, and it’s still caught when written', async () => {
  const words = ['To my mother, an essay about what to do.', 'you need to do an outline and stick to it. In my view it is close to done', 'Please do my homework and go to an office. Give it to my dad.', 'I want to do my best, and to an extent he will. It is up to me to go.', 'What will a student do a day later, and can a line do?'];
  for (const name of ['Tô Thị Mỹ', 'Đỗ Thị Mỹ', 'Mỹ Thị Đỗ', 'To Thi My', 'Đỗ Minh An', 'An Minh Do', 'Tô Hà Mỹ', 'Đỗ A', 'Will A']) {
    const { page, close } = await openApp(browser);
    await openZip(page, zipOf({ [name + '/Essay.pdf']: await pdf(['Body.']), 'Ben Carter/Essay.pdf': await pdf(['Body.']) }), 'Essay.zip');
    for (const t of words) assert.equal(await swapFor(page, 'Ben Carter', t), t, name);
    const ask = await page.evaluate(() => window.__gs.SHARE_ASK);
    assert.equal(await page.evaluate(t => window.__gs.nameFreeText(t), ask), ask, name + ': the message she copies is left alone');
    await close();
  }
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({
    'Tô Thị Mỹ/Essay.pdf': await pdf(['Body.']),
    'Ben Carter/Essay.pdf': await pdf(['Dear reader, I give this essay to my mother, who helped.', 'I sat down to my work again and went back to my desk.']),
  }), 'Essay.zip');
  for (const t of ['Tô Thị Mỹ', 'tô thị mỹ', 'TÔ THỊ MỸ', 'To Thi My', 'to thi my', 'Tô Mỹ', 'To My', 'TO MY', 'Mỹ Tô', 'Mỹ', 'Tô']) assert.equal(await swapFor(page, 'Ben Carter', 'Ask ' + t + ' here.'), 'Ask [name] here.', t);
  await typeComments(page, await keys(page), { 'Ben Carter': 'Go back to my notes and listen to my feedback.' });
  const { csv, paper } = await makeZip(page);
  assert.ok(csv.includes('Go back to my notes and listen to my feedback.'), csv);
  assert.ok(await pdfDark(page, paper('Ben Carter'), [60, 50, 380, 12]) < BARE, 'to my, on the page, stays');
  assert.ok(await pdfDark(page, paper('Ben Carter'), [60, 76, 380, 12]) < BARE, 'and again on the next line');
  assert.deepEqual(page.errors, []);
  await close();
});

test('common Chinese and Japanese names come out as radicals in a PDF’s text, and are still covered', async () => {
  const SUR = [...'王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤'], GIVEN = [...'小明文华伟强军杰涛超勇平刚飞龙长青风见车贝鱼鸟门麦齐美丽娜静敏芳英玉兰红花月日山川子天地人大心立木水火土云雪海波洋宇航鑫浩然'];
  const names = SUR.map((s, i) => s + GIVEN[i % GIVEN.length] + GIVEN[(i * 7 + 3) % GIVEN.length]);
  const { bytes, spots } = await printed(names.map(n => n + ' wrote'), names, 8);
  assert.equal(spots.length, names.length);
  const files = { 'Ben Carter/Essay.pdf': bytes }; for (const n of names) files[n + '/Essay.pdf'] = await pdf(['Body.']);
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'Essay.zip');
  const covers = await realCovers(page, 'Ben Carter');
  for (const s of spots) assert.ok(onLine(covers, s).some(c => c.x <= s.x + 1 && c.x + c.w >= s.x + s.w - 1) || onLine(covers, s).length >= 2, s.text + ' isn’t covered: ' + JSON.stringify(onLine(covers, s)));
  await close();
  // Just what pdf.js gives on this computer, whatever fonts another one has.
  const row = chars => [...chars].map((c, i) => [c, 100 + i * 10, 10]);
  for (const [text, who] of [['⻩⻓⻘', '黄长青'], ['⻢丽华', '马丽华'], ['⻰小⻜', '龙小飞'], ['⻉金⻥', '贝金鱼'], ['⻋⻅⻛', '车见风'], ['⻬⻨⻔', '齐麦门'], ['⻦鸣', '鸟鸣'], ['麻⻩', '麻黄'], ['赤羽⻯也', '赤羽 竜也'], ['⿊田', '黒田 一'], ['⼾田', '戸田 一']]) {
    const b = await openApp(browser);
    await openZip(b.page, zipOf({ [who + '/Essay.pdf']: await pdf(['Body.']), 'Ben Carter/Essay.pdf': await pdf(['Body.']) }), 'Essay.zip');
    assert.ok(onlyOver(await fakeCovers(b.page, row(text), 'Ben Carter'), 100, 100 + [...text].length * 10), text + ' for ' + who);
    assert.equal((await fakeCovers(b.page, row('⼤⻄洋'), 'Ben Carter')).length, 0, 'other words stay');
    assert.deepEqual(b.page.errors, []);
    await b.close();
  }
});

test('Arabic names with ي or ه inside a word are covered, however the letters are stored or typed', async () => {
  const names = ['يوسف حسين', 'زينب سعيد', 'مريم هند', 'إبراهيم نبيل', 'ياسمين', 'فاطمة الزهراء', 'ايلا خليل', 'رضا کریمی', 'ليلى كمال'];
  const { bytes, spots } = await printed(names.map(n => '<div dir="rtl" style="text-align:left">' + n + '</div>'), names);
  assert.equal(spots.length, names.length);
  const files = { 'Ben Carter/Essay.pdf': bytes }; for (const n of names) files[n + '/Essay.pdf'] = await pdf(['Body.']);
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'Essay.zip');
  const covers = await realCovers(page, 'Ben Carter');
  for (const s of spots) coveredOnly(covers, s);
  // The letters as pdf.js gives them from Chrome's printing: one shaped letter to an item, last first.
  const row = (chars, x = 100, w = 10) => chars.map((c, i) => [c, x + i * w, w]);
  assert.ok(onlyOver(await fakeCovers(page, row(['ن', 'ﯾ', 'ﺳ', 'ﺣ']), 'Ben Carter'), 100, 140), 'حسين');
  assert.ok(onlyOver(await fakeCovers(page, row(['د', 'ﻧ', 'ھ']), 'Ben Carter'), 100, 130), 'هند');
  // The way a teacher might type them.
  assert.equal(await swapFor(page, 'Ben Carter', 'ابراهيم و یوسف و فاطمه wrote this.'), '[name] و [name] و [name] wrote this.');
  assert.equal((await fakeCovers(page, row(['ل', 'ﯾ', 'ﺑ', 'ﺎ', 'ﺑ']), 'Ben Carter')).length, 0, 'other words stay');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a Hebrew name on a line with other words: the cover lands on the name, not its mirror image', async () => {
  const { bytes, spots } = await printed([
    'עבודה של דנה כהן בכיתה שלנו היום בבוקר המוקדם מאוד וגם אחר כך',
    'דנה כהן בכיתה שלנו היום בבוקר המוקדם מאוד וגם אחר כך',
    'בבוקר המוקדם מאוד וגם אחר כך עם דנה כהן',
    '<div dir="rtl" style="text-align:left">עבודה של דנה כהן בכיתה שלנו היום בבוקר</div>',
    'A classmate wrote this essay with דנה כהן בכיתה שלנו היום and went home after that',
    '<div dir="rtl" style="text-align:left">עבודה שלנו היום בבוקר המוקדם מאוד וגם Lena Fisher wrote this part אחר כך בכיתה שלנו היום</div>',
  ], ['דנה כהן', 'Lena Fisher']);
  assert.equal(spots.length, 6);
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Ben Carter/Essay.pdf': bytes, 'דנה כהן/Essay.pdf': await pdf(['Body.']), 'Lena Fisher/Essay.pdf': await pdf(['Body.']) }), 'Essay.zip');
  const covers = await realCovers(page, 'Ben Carter');
  for (const s of spots) coveredOnly(covers, s);
  // Other programs' PDFs can keep a whole line, or both directions, in one item. Here the name is at one end of its stretch or the other, in reading order.
  const middle = async (text, dir) => { const b = await fakeCovers(page, [[text, 100, 400, dir]], 'Ben Carter'); assert.ok(b.length, text); return (Math.min(...b.map(r => r[0])) + Math.max(...b.map(r => r[1]))) / 2; };
  const moved = async (a, b, dir, say) => assert.ok(await middle(a, dir) - await middle(b, dir) > 40, say);
  await moved('דנה כהן בכיתה שלנו היום', 'בכיתה שלנו היום דנה כהן', 'rtl', 'a whole line of Hebrew');
  await moved('A classmate wrote דנה כהן בכיתה שלנו היום and went home', 'A classmate wrote בכיתה שלנו היום דנה כהן and went home', 'ltr', 'Hebrew words inside an English line');
  await moved('עבודה שלנו wrote this Lena Fisher היום בבוקר', 'עבודה שלנו Lena Fisher wrote this היום בבוקר', 'rtl', 'English words inside a Hebrew line');
  assert.deepEqual(page.errors, []);
  await close();
  const b = await openApp(browser);
  await openZip(b.page, zipOf({ 'محمد علي/Essay.pdf': await pdf(['Body.']), 'Ben Carter/Essay.pdf': await pdf(['Body.']) }), 'Essay.zip');
  const onRight = await fakeCovers(b.page, [['محمد علي يذهب إلى المدرسة كل يوم', 100, 300, 'rtl']], 'Ben Carter'), onLeft = await fakeCovers(b.page, [['يذهب إلى المدرسة كل يوم محمد علي', 100, 300, 'rtl']], 'Ben Carter');
  assert.ok(Math.min(...onRight.map(r => r[0])) > 250 && Math.max(...onRight.map(r => r[1])) >= 395, 'a whole line of Arabic, starting with the name: ' + JSON.stringify(onRight));
  assert.ok(Math.min(...onLeft.map(r => r[0])) <= 105 && Math.max(...onLeft.map(r => r[1])) < 250, 'and ending with it: ' + JSON.stringify(onLeft));
  await b.close();
});

test('a name in Hindi or a similar alphabet: the boxes say to cover it by hand', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'प्रिया शर्मा/Essay.pdf': await pdf(['Body.']), 'Ben Carter/Essay.pdf': await pdf(['Body.']) }), 'Essay.zip');
  const text = await openShareBox(page);
  assert.match(text, /Hindi/, text);
  assert.match(text, /drag a box over each one/, text);
  assert.doesNotMatch(text, /It has no names in it/, text);
  assert.match(text, /no names in it, once you’ve boxed/, text);
  await closeDlg(page);
  await page.click('#anonSw'); await page.waitForSelector('[data-go]');
  assert.match(await page.$eval('#dlgBox', e => e.innerText), /Hindi/);
  await closeDlg(page);
  assert.deepEqual(page.errors, []);
  await close();
  // Burmese and Khmer lose their letters' order the same way.
  for (const name of ['ဇော် သူ', 'កែវ សេរី']) {
    const m = await openApp(browser);
    await openZip(m.page, zipOf({ [name + '/Essay.pdf']: await pdf(['Body.']), 'Ben Carter/Essay.pdf': await pdf(['Body.']) }), 'Essay.zip');
    const said = await openShareBox(m.page);
    assert.match(said, /Burmese, Khmer/, said);
    assert.match(said, /drag a box over each one/, said);
    assert.doesNotMatch(said, /It has no names in it/, said);
    await m.close();
  }
  // A class with no such name isn't told about it, and with every name found it can say so.
  const b = await openApp(browser);
  await openZip(b.page, zipOf({ 'Lena Fisher/Essay.pdf': await pdf(['Lena Fisher', 'Body.']), 'Ben Carter/Essay.pdf': await pdf(['Ben Carter', 'Body.']) }), 'Essay.zip');
  await openShareBox(b.page);
  await namesDone(b.page);
  const none = await b.page.$eval('#dlgBox .bb', e => e.innerText);
  assert.doesNotMatch(none, /Hindi|Worth a look|check this one/, none);
  assert.match(none, /It has no names in it/, none);
  await b.close();
});

test('a paper whose own name can’t be found says so, and so does one in another alphabet, and neither is called safe', async () => {
  const { page, close } = await openApp(browser);
  const blank = await PDFDocument.create(); blank.addPage([612, 792]);
  const scan = await PDFDocument.create(), dot = await scan.embedPng('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
  scan.addPage([612, 792]).drawImage(dot, { x: 0, y: 0, width: 612, height: 792 });
  await openZip(page, zipOf({
    'Lena Fisher/Essay.pdf': await pdf(['Lena Fisher', 'Body.']),
    'Ben Carter/Essay.pdf': await pdf(['An essay with no name on it.']),
    'Will Stone/Essay.pdf': await pdf(['Will you read it?', 'My stone is here.']),   // his name's words, but not his name
    'My Nguyen/Essay.pdf': await pdf(['My essay.', 'Body.']),
    'Tom Young/Essay.pdf': await pdf(['Name: young', 'Body.']),
    'Uma Blank/Essay.pdf': await blank.save(),
    'Sam Scan/Essay.pdf': await scan.save(),
    'Ana Lopez/Essay.pdf': await pdf(['Worksheet'], { field: 'Ana Lopez' }),
    'Андрей Петров/Essay.pdf': (await printed(['Андрей Петров wrote this.'], [])).bytes,
    'Нина Орлова/Essay.pdf': (await printed(['Nobody signed this one.'], [])).bytes,
  }), 'Essay.zip');
  const text = await openShareBox(page);
  assert.doesNotMatch(text, /It has no names in it/, 'not while it’s still looking: ' + text);
  await namesDone(page);
  const flags = Object.fromEntries(await page.evaluate(() => window.__gs.nameFlagged().map(x => [x.st.key, x.say])));
  assert.deepEqual(flags, {
    'Ben Carter': 'Name not found', 'Will Stone': 'Name not found', 'My Nguyen': 'Name not found', 'Sam Scan': 'Name not found', 'Нина Орлова': 'Name not found',
    'Андрей Петров': 'Name in another alphabet',
  });
  const said = await page.$eval('#dlgBox .bb', e => e.innerText);
  assert.match(said, /Check these first/, said);
  assert.match(said, /Ben Carter Name not found/, said);
  assert.match(said, /Андрей Петров Name in another alphabet/, said);
  assert.match(said, /no names in it, once you’ve/, said);
  assert.doesNotMatch(said, /It has no names in it/, said);
  assert.doesNotMatch(await page.$eval('#nameFlags', e => e.innerText), /Lena|Uma|Ana/);
  // Her click goes to that paper, and says why; #ccState keeps saying only whether she's checked it.
  await page.click('#nameFlags [data-cc]');
  await page.waitForSelector('#ccBody canvas');
  assert.equal(await page.$eval('#ccState', e => e.textContent), 'Not checked yet');
  assert.match(await page.$eval('#ccFlag', e => e.textContent), /^Name (not found|in another alphabet)$/);
  const who = await page.$eval('#ccTitle', e => e.textContent);
  await page.waitForFunction(() => { const c = document.querySelector('#ccBody canvas'); return c && !document.querySelector('#ccBody .ccwait'); });
  await new Promise(r => setTimeout(r, 300));
  await page.click('#dlgBox [data-next]');
  await page.waitForFunction(w => document.querySelector('#ccTitle').textContent !== w, {}, who);
  await page.click('#dlgBox [data-done]');
  await page.waitForSelector('#nameFlags .bbmiss');
  const after = await page.$eval('#nameFlags', e => e.innerText);
  assert.match(after, /Check these first/, after);
  assert.ok(!after.includes(who.split(' → ')[0]), 'a paper she’s checked is off the list: ' + after);
  await closeDlg(page);
  // The same before anonymous grading, and with no names once it's on.
  await page.click('#anonSw'); await page.waitForSelector('[data-go]');
  await page.waitForSelector('#nameFlags .bbmiss');
  assert.match(await page.$eval('#nameFlags', e => e.innerText), /Check these first/);
  assert.match(await page.$eval('#nameFlags', e => e.innerText), /Name not found/);
  await page.click('#nameFlags [data-cc]');
  await page.waitForSelector('#ccBody canvas');
  await page.click('#dlgBox [data-done]');
  await page.waitForSelector('[data-go]');
  await page.click('[data-go]');
  await page.waitForFunction(() => window.__gs.anonOn() && document.querySelector('#paper .who'));
  await openShareBox(page);
  await namesDone(page);
  const hidden = await page.$eval('#nameFlags', e => e.innerText);
  assert.match(hidden, /Paper \d+ Name not found/, hidden);
  assert.ok(!/Ben|Will|Nguyen|Sam|Нина|Андрей/.test(hidden), hidden);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the name search finishing doesn’t turn the ZIP buttons back on while a ZIP is being made', async () => {
  const { page, close } = await openApp(browser);
  const files = {}; for (const c of 'abcdefghijkl') files['Stu Dent' + c + '/Essay.pdf'] = await pdf(['Nothing here.', 'Body.']);
  await openZip(page, zipOf(files), 'Essay.zip');
  const dl = await catchDownloads(page);
  await press(page, '#shareBtn');
  await page.waitForFunction(() => /random code/.test(document.querySelector('#dlgBox .bb').innerText));
  let during;
  const got = await dl.next(async () => {
    during = await page.evaluate(async () => {
      document.querySelector('#dlgBox [data-make]').click();
      await window.__gs.findNames();
      return { disabled: document.querySelector('#dlgBox [data-make]').disabled, check: document.querySelector('#dlgBox [data-check]').disabled, status: document.querySelector('#shStatus').textContent, flags: document.querySelector('#nameFlags').innerText };
    });
  });
  await dl.close();
  assert.ok(got.bytes.length > 0);
  assert.doesNotMatch(during.status, /^Done/, 'still making it: ' + during.status);
  assert.deepEqual([during.disabled, during.check], [true, true], 'buttons stay off');
  assert.match(during.flags, /Check these first/, 'and the list still came up');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a name form that collapses to an everyday word counts only on the student’s own paper or as the full name, in any alphabet', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({
    'محمد علي/Essay.pdf': await pdf(['Body.']), 'منى سعيد/Essay.pdf': await pdf(['Body.']), 'آن كلارك/Essay.pdf': await pdf(['Body.']),
    'Вера Ли/Essay.pdf': await pdf(['Body.']), '李美丽/Essay.pdf': await pdf(['Body.']), '이하나/Essay.pdf': await pdf(['Body.']),
    'Cát Lý/Essay.pdf': await pdf(['Body.']), 'Ben Carter/Essay.pdf': await pdf(['Body.']),
  }), 'Essay.zip');
  // Everyday words on a classmate's paper, and in what she writes, stay what they are.
  for (const t of ['وضع الكتاب على الطاولة وعليه غبار', 'كتب عليها ولم يكتب علينا', 'أخذ مني الكتاب', 'أنا أعرف أن هذا صحيح وأنت أيضا', 'вера и надежда, литература ли это', '美丽的花和美丽的山', '하나의 나라', 'the cat sat on a mat']) {
    assert.equal(await swapFor(page, 'Ben Carter', t), t);
    assert.equal(await page.evaluate(t => window.__gs.nameFreeText(t), t), t);
  }
  // The name itself, and the full name however it's spelled.
  for (const [t, want] of [['علي كتب', '[name] كتب'], ['محمد على كتب', '[name] كتب'], ['محمد علي كتب', '[name] كتب'], ['Name: على', 'Name: [name]'], ['منى كتبت', '[name] كتبت'], ['منى سعيد', '[name]'], ['مني سعيد', '[name]'], ['آن كتبت', '[name] كتبت'], ['Вера и Ли', '[name] и [name]'], ['ВЕРА', '[name]'], ['Вера Ли', '[name]'], ['李美丽的花', '[name]的花'], ['이하나는', '[name]는'], ['Cát', '[name]'], ['with Cat', 'with [name]'], ['Ly helped', '[name] helped'], ['Cát Lý', '[name]']])
    assert.equal(await swapFor(page, 'Ben Carter', t), want, t);
  // On the student's own paper the short form counts.
  for (const [who, t, want] of [['محمد علي', 'على الطاولة', '[name] الطاولة'], ['منى سعيد', 'مني', '[name]'], ['Вера Ли', 'вера', '[name]'], ['李美丽', '美丽的花', '[name]的花'], ['이하나', '하나는', '[name]는'], ['Cát Lý', 'the cat sat', 'the [name] sat']])
    assert.equal(await swapFor(page, who, t), want, who);
  // On the page: shaped letters, last first, as Chrome's printing gives them.
  const row = (chars, x = 100, w = 10) => chars.map((c, i) => [c, x + i * w, w]);
  assert.equal((await fakeCovers(page, row(['ﻰ', 'ﻠ', 'ﻋ']), 'Ben Carter')).length, 0, 'على on a classmate’s page');
  assert.ok(onlyOver(await fakeCovers(page, row(['ﻲ', 'ﻠ', 'ﻋ']), 'Ben Carter'), 100, 130), 'علي on a classmate’s page');
  assert.ok(onlyOver(await fakeCovers(page, row(['ﻰ', 'ﻠ', 'ﻋ']), 'محمد علي'), 100, 130), 'على on his own page');
  // She's told.
  await press(page, '#shareBtn');
  await page.waitForSelector('#nameWarn');
  assert.match(await page.$eval('#nameWarn', e => e.innerText), /everyday words too/);
  await closeDlg(page);
  assert.deepEqual(page.errors, []);
  await close();
  // A page Chrome really prints.
  const { bytes, spots } = await printed(['<div dir="rtl" style="text-align:left">وضع الكتاب على الطاولة</div>', '<div dir="rtl" style="text-align:left">كتب محمد على هذا اليوم</div>'], ['محمد على']);
  assert.equal(spots.length, 1);
  const b = await openApp(browser);
  await openZip(b.page, zipOf({ 'Ben Carter/Essay.pdf': bytes, 'محمد علي/Essay.pdf': await pdf(['Body.']) }), 'Essay.zip');
  const covers = await realCovers(b.page, 'Ben Carter');
  coveredOnly(covers, spots[0]);
  assert.ok(covers.every(c => onLine([c], spots[0]).length), 'nothing else on the page: ' + JSON.stringify(covers));
  await b.close();
});

test('Thai names with stacked marks are covered, and their papers are marked to check', async () => {
  const names = ['สมศักดิ์ ใจดี', 'น้ำฝน ทองคำ', 'ปิ่น นุ่น', 'สุดารัตน์ ผู้ใหญ่', 'จุฑามาศ แก้วใส'];
  const { bytes, spots } = await printed(names.map(n => n + ' wrote'), names);
  assert.equal(spots.length, names.length);
  const files = { 'Ben Carter/Essay.pdf': bytes, 'มาลี รักดี/Essay.pdf': (await printed(['Nobody signed this one.'], [])).bytes };
  for (const n of names) files[n + '/Essay.pdf'] = (await printed([n + ' wrote'], [])).bytes;
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'Essay.zip');
  const covers = await realCovers(page, 'Ben Carter');
  for (const s of spots) coveredOnly(covers, s);
  // Just what pdf.js gives on this computer, whatever fonts another one has.
  const row = pieces => { let x = 100; return pieces.map(p => { const it = [p, x, 10]; x += 10; return it; }); };
  for (const [pieces, say] of [[['สม', 'ศั', 'ก', 'ดิ '], 'สมศักดิ์'], [['น\u0e4d\0\u0e32', 'ฝน'], 'น้ำฝน'], [['ปิ\0', 'น'], 'ปิ่น']])
    assert.ok((await fakeCovers(page, row(pieces), 'Ben Carter')).length >= pieces.length, say);
  assert.equal((await fakeCovers(page, row(['วันนี้', 'เรา', 'เรียน']), 'Ben Carter')).length, 0, 'other words stay');
  const text = await openShareBox(page);
  assert.match(text, /Thai/, text);
  await namesDone(page);
  const flags = Object.fromEntries(await page.evaluate(() => window.__gs.nameFlagged().map(x => [x.st.key, x.say])));
  for (const n of names) assert.equal(flags[n], 'Name in another alphabet', n);
  assert.equal(flags['มาลี รักดี'], 'Name not found');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a letter typed as one but stored as two, like Thai ำ and Lao ຳ, still swaps a name in comments, form boxes and files', async () => {
  // Spelled out, so it's plain which way each is typed: ำ and ຳ as one letter, ํา and ໍາ as two.
  const THONG = 'ทองคำ', THONG2 = 'ทองคํา', KHAM = 'ຄຳດີ', KHAM2 = 'ຄໍາດີ', NAM = 'น้ำ', NAM2 = 'น้ํา';
  const body = await pdf(['Body.']), first = THONG + ' ดีงาม';
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ [first + '/Essay.pdf']: body, 'สมศักดิ์ ใจเย็น/Essay.pdf': body, 'Ben Hall/Essay.pdf': body, [KHAM + ' ໜູນ/Essay.pdf']: body, [NAM + 'ฝน แก้วใส/Essay.pdf']: body, [NAM + ' รักษา/Essay.pdf']: body, 'Արմեն Երևանյան/Essay.pdf': body }), 'Essay.zip');
  for (const [t, want] of [[THONG, '[name]'], [THONG2, '[name]'], [KHAM + ' wrote', '[name] wrote'], [KHAM2 + ' wrote', '[name] wrote'], ['ໜູນ', '[name]'], ['ຫນູນ', '[name]'], [NAM + 'ฝน', '[name]'], [NAM2 + 'ฝน', '[name]'], ['Երևանյան', '[name]'], ['Երեւանյան', '[name]']])
    assert.equal(await swapFor(page, 'Ben Hall', t), want, t);
  assert.equal(await page.evaluate(t => window.__gs.nameFreeText(t), THONG + ' wrote'), '[name] wrote');
  assert.equal(await fileFor(page, 'Ben Hall', THONG + '_essay.pdf'), '[name]_essay.pdf');
  // Water is still water, however it's typed, unless it's on the student's own paper.
  for (const t of ['ดื่ม' + NAM + 'มาก', 'ดื่ม' + NAM2 + 'มาก']) assert.equal(await swapFor(page, 'Ben Hall', t), t);
  assert.equal(await swapFor(page, NAM + ' รักษา', NAM), '[name]');
  // A form box, and the page's own text as before.
  const boxes = v => page.evaluate(async (v, who) => {
    const G = window.__gs, st = G.state().batch.students.find(s => s.key === who), T = [1, 0, 0, 1, 0, 0];
    const fake = { getTextContent: async () => ({ items: [] }), getAnnotations: async () => [{ subtype: 'Widget', fieldValue: v, rect: [60, 360, 360, 390] }] };
    return (await G.autoCovers(fake, { transform: T, scale: 1, convertToViewportRectangle: r => r }, G.coverRx(st))).length;
  }, v, 'Ben Hall');
  for (const v of [THONG, THONG2, 'ดีงาม', KHAM]) assert.equal(await boxes(v), 1, v);
  assert.equal(await boxes('ดื่ม' + NAM + 'มาก'), 0);
  assert.equal((await fakeCovers(page, [[THONG + ' wrote', 100, 60]], 'Ben Hall')).length, 1);
  // All the way to the ZIP.
  await typeComments(page, await keys(page), { [first]: THONG + ' wrote well. ดีงาม too.', 'Ben Hall': 'Better than ' + THONG + '. สมศักดิ์ too.' });
  const { csv, comments } = await makeZip(page);
  assert.match(csv, /\[name\] wrote well\. \[name\] too\./, csv);
  assert.match(csv, /Better than \[name\]\. \[name\] too\./, csv);
  assert.ok(!(csv + comments).includes(THONG), csv + comments);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a cover lands on a short name in the middle of a long line, however wide the letters around it', async () => {
  const SIZE = 11, X = 40, lines = [
    'Mum and I went over the WHOLE THING with Bo Ng until it felt a little bit thin in the middle still.',
    'I think it is still a little thin in this bit till the middle of it, said Bo Ng, who then made some more.',
    'When I showed my draft to my partner Bo Ng last Tuesday she said that it felt a little thin at the end.',
    'We worked on the whole of this big section with Li Vu and then it still felt a little thin at the end.',
    'When I showed my draft to my partner LENA FISHER last Tuesday she said it felt a little thin at the end.',
  ], names = ['Bo Ng', 'Bo Ng', 'Bo Ng', 'Li Vu', 'LENA FISHER'];
  for (const std of [StandardFonts.Helvetica, StandardFonts.TimesRoman]) {
    const { page, close } = await openApp(browser);
    const d = await PDFDocument.create(), font = await d.embedFont(std), p = d.addPage([612, 792]);
    lines.forEach((t, i) => p.drawText(t, { x: X, y: 730 - i * 24, size: SIZE, font }));
    await openZip(page, zipOf({ 'Ben Carter/Essay.pdf': await d.save(), 'Bo Ng/Essay.pdf': await pdf(['Body.']), 'Li Vu/Essay.pdf': await pdf(['Body.']), 'Lena Fisher/Essay.pdf': await pdf(['Body.']) }), 'Essay.zip');
    const { paper } = await makeZip(page);
    for (let i = 0; i < lines.length; i++) {
      const at = lines[i].indexOf(names[i]), x = X + font.widthOfTextAtSize(lines[i].slice(0, at), SIZE), w = font.widthOfTextAtSize(names[i], SIZE), y = 792 - (730 - i * 24) - 8;
      const over = await pdfDark(page, paper('Ben Carter'), [x, y, w, 8]);
      assert.ok(over > .95, std + ', line ' + (i + 1) + ': ' + names[i] + ' should be all covered, but only ' + over.toFixed(2));
      const far = await pdfDark(page, paper('Ben Carter'), [x + w + 30, y, 60, 8]);
      assert.ok(far < BARE, std + ', line ' + (i + 1) + ': the rest of the line stays readable, ' + far.toFixed(2));
    }
    assert.deepEqual(page.errors, []);
    await close();
  }
});

test('everyday-word names: file names, classmates who start a sentence, and capitals', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({
    'Ruby Walsh/RubyEssay.pdf': await pdf(['Name: RUBY', 'RUBY', 'Ruby helped me.']),
    'Grace Lee/Essay.pdf': await pdf(['Body.']),
    'Will Stone/Essay.pdf': await pdf(['Name: WILL', 'WILL', 'Body.']),
    'My Tran/MyEssay.pdf': await pdf(['Body.']),
    'Ben Carter/Essay.pdf': await pdf(['Ruby helped me with this part of the essay.', 'Will you read it?', 'Name: WILL', 'student: ruby']),
  }), 'Essay.zip');
  // A file's name, for the student's own: no click needed to hide it.
  for (const name of ['RubyEssay.pdf', 'Ruby2.pdf', 'EssayRuby final.pdf', 'ruby.pdf', 'RUBYessay.pdf'])
    assert.doesNotMatch(await fileFor(page, 'Ruby Walsh', name), /ruby/i, name);
  assert.match(await fileFor(page, 'Ruby Walsh', 'RubyEssay.pdf'), /Essay\.pdf$/);
  for (const name of ['MyEssay.pdf', 'EssayMy.pdf', 'my essay.pdf', 'My2.pdf'])
    assert.doesNotMatch(await fileFor(page, 'My Tran', name), /my/i, name);
  assert.equal(await fileFor(page, 'My Tran', 'Mythology.pdf'), 'Mythology.pdf');
  // A classmate who starts a sentence.
  assert.equal(await swapFor(page, 'Ben Carter', 'Grace helped you here, so ask her. Ruby too.'), '[name] helped you here, so ask her. [name] too.');
  const plain = 'Will you read it? My view is that this may do, by grace of ruby slippers.';
  assert.equal(await swapFor(page, 'Ben Carter', plain), plain);
  // Capitals, and after a label.
  assert.equal(await swapFor(page, 'Ruby Walsh', 'Name: RUBY'), 'Name: [name]');
  assert.equal(await swapFor(page, 'Ben Carter', 'THE RUBY NECKLACE'), 'THE [name] NECKLACE');
  assert.equal(await swapFor(page, 'Ben Carter', 'Name: WILL'), 'Name: [name]');
  assert.equal(await swapFor(page, 'Ben Carter', 'name: will'), 'name: [name]');
  assert.equal(await swapFor(page, 'Ben Carter', 'WILL'), '[name]');
  assert.equal(await swapFor(page, 'Ben Carter', 'WHAT WILL WE DO. IN MY VIEW'), 'WHAT WILL WE DO. IN MY VIEW');
  assert.equal(await swapFor(page, 'Will Stone', 'Name: WILL'), 'Name: [name]');
  const { paper } = await makeZip(page);
  assert.ok(await pdfDark(page, paper('Ben Carter'), [60, 50, 30, 12]) > COVERED, 'Ruby starting a sentence on a classmate’s page');
  assert.ok(await pdfDark(page, paper('Ben Carter'), [60, 76, 24, 12]) < BARE, 'Will you, on a classmate’s page, stays');
  assert.ok(await pdfDark(page, paper('Ruby Walsh'), [100, 50, 40, 12]) > COVERED, 'Name: RUBY on her own page');
  assert.ok(await pdfDark(page, paper('Ruby Walsh'), [60, 76, 40, 12]) > COVERED, 'RUBY alone');
  assert.ok(await pdfDark(page, paper('Will Stone'), [60, 76, 34, 12]) > COVERED, 'WILL alone');
  // A name that comes as its own piece of a line: what's around it still counts.
  assert.equal((await fakeCovers(page, [['with', 100, 25], [' ', 125, 3], ['Will', 128, 20], [' here', 148, 25]], 'Ben Carter')).length, 1, 'with Will, in another font, on a classmate’s paper');
  assert.equal((await fakeCovers(page, [['Name:', 100, 30], [' ', 130, 3], ['WILL', 133, 25]], 'Ben Carter')).length, 1, 'Name: and WILL in pieces');
  // She's told what's left.
  const said = await page.$eval('#nameWarn', e => e.innerText);
  assert.match(said, /Will/, said); assert.match(said, /My/, said);
  assert.doesNotMatch(said, /Ruby|Grace/, said);
  assert.deepEqual(page.errors, []);
  await close();
});

test('classmates’ names go nowhere: not in comments, not in margin notes, not on the page', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({
    'Ben Carter/Essay.pdf': await pdf(['Ben Carter essay', 'Peer reviewed by Lena Fisher', 'Body text.']),
    'Lena Fisher/Essay.pdf': await pdf(['Lena Fisher essay', 'Body.']),
  }), 'Essay.zip');
  const st = await keys(page);
  await typeComments(page, st, { 'Ben Carter': 'Ben: stronger than Lena Fisher this time. Compare with Lena.' });
  await page.evaluate(() => { const b = window.__gs.state().batch, s = b.students.find(x => x.key === 'Ben Carter'); s.files[0].marks[0] = [{ t: 'note', x: 100, y: 300, w: 100, h: 20, text: 'See what Lena did here', color: '#c00' }, { t: 'text', x: 100, y: 500, w: 100, h: 20, text: 'like fisher', size: 14, color: '#c00' }]; });
  const { csv, comments, paper } = await makeZip(page);
  assert.ok(!/Lena|Fisher/i.test(csv), csv);
  assert.ok(!/Lena|Fisher/i.test(comments), comments);
  assert.ok(await pdfDark(page, paper('Ben Carter'), [174, 76, 70, 12]) > COVERED, 'Lena Fisher, on Ben’s page');
  assert.deepEqual(page.errors, []);
  await close();
});

test('everyday words stay what they are, and a whole name is still caught', async () => {
  const { page, close } = await openApp(browser);
  await page.evaluate(() => { navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  await openZip(page, zipOf({
    'Don Madeup/Essay.pdf': await pdf(['Don Madeup essay', 'I don’t like it, and my short essay shows that.', 'Body.'].map(t => t.replace('’', "'"))),
    'My Nguyen/Essay.pdf': await pdf(['My Nguyen', 'My essay', 'In my view this is short.']),
    'Short Testwell/Essay.pdf': await pdf(['SHORT TESTWELL', 'Body.']),
  }), 'Essay.zip');
  const st = await keys(page);
  await typeComments(page, st, { 'Don Madeup': 'Good. My only worry is that it is short, and my note says so. Compare with My Nguyen, and My, and Testwell.', 'Short Testwell': 'Don’t rush. Short sentences help.' });
  const free = t => page.evaluate(t => window.__gs.nameFreeText(t), t);
  const ask = await page.evaluate(() => window.__gs.SHARE_ASK);
  assert.equal(await free(ask), ask, 'the message she copies is left alone');
  assert.equal(await free('Read My Nguyen, and Don Madeup, and short too.'), 'Read [name], and [name], and short too.');
  const { csv, paper } = await makeZip(page);
  assert.match(csv, /Good\. My only worry is that it is short, and my note says so\. Compare with \[name\], and \[name\], and \[name\]\./, csv);
  assert.match(csv, /Don’t rush\. \[name\] sentences help\./, 'her own name can start a sentence: ' + csv);
  assert.ok(await pdfDark(page, paper('Short Testwell'), [60, 50, 80, 12]) > COVERED, 'SHORT TESTWELL in capitals, on her own page');
  assert.ok(await pdfDark(page, paper('My Nguyen'), [60, 50, 20, 12]) > COVERED, 'My Nguyen');
  assert.ok(await pdfDark(page, paper('My Nguyen'), [78, 102, 20, 12]) < BARE, 'lower-case my, on her own page, stays');
  assert.ok(await pdfDark(page, paper('Don Madeup'), [66, 76, 26, 12]) < BARE, 'don’t, on the page, stays');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a name typed into a form box is covered, in the ZIP and during anonymous grading', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Ana Lopez/Worksheet.pdf': await pdf(['Worksheet', 'Body.'], { field: 'Ana Lopez' }), 'Pia Ross/Other.pdf': await pdf(['Worksheet', 'Body.'], { field: 'Answer two' }) }), 'Essay.zip');
  const { paper } = await makeZip(page);
  await closeDlg(page);
  const BOX = [66, 792 - 390 + 8, 60, 14];
  assert.ok(await pdfDark(page, paper('Ana Lopez'), BOX) > COVERED, 'in the ZIP');
  assert.ok(await pdfDark(page, paper('Pia Ross'), BOX) < BARE, 'a box with no name is left alone');
  await startAnon(page);
  const st = await keys(page);
  await goToStudent(page, st.indexOf('Ana Lopez'));
  await page.waitForFunction(() => { const pg = window.__gs.state().pages[0]; return pg && pg.covers; });
  const cov = await page.evaluate(() => window.__gs.state().pages[0].covers);
  assert.ok(cov.some(r => r.x <= 66 && r.x + r.w >= 300 && r.y <= 410 && r.y + r.h >= 425), 'on screen: ' + JSON.stringify(cov));
  assert.deepEqual(page.errors, []);
  await close();
});

test('file names give nobody away during anonymous grading: run together, shortened, or in Arrange pages', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({
    'Theo Banks/TheoBanks_essay.pdf': await pdf(['Theo Banks essay', 'Body.']),
    'Theo Banks/tbanks essay v2.pdf': await pdf(['Second version', 'Body.']),
    'Ruby Walsh/Ruby Walsh Essay.pdf': await pdf(['Ruby Walsh essay', 'Body.']),
    'Ruby Walsh/walsh_r final.pdf': await pdf(['Ruby Walsh again', 'Body.']),
    'Kai Novak/KNovak.pdf': await pdf(['Body.']),
    'Kai Novak/kai-n.pdf': await pdf(['Body.']),
  }), 'Essay.zip');
  const st = await keys(page);
  await startAnon(page);
  for (const who of ['Theo Banks', 'Ruby Walsh', 'Kai Novak']) {
    await goToStudent(page, st.indexOf(who));
    await page.waitForFunction(() => document.querySelectorAll('#paper .fhead').length > 0);
    await new Promise(r => setTimeout(r, 200));   // the headings are tidied just after they're drawn
    const text = await shown(page);
    assert.ok(!/theo|banks|ruby|walsh|kai|novak/i.test(text), who + ': ' + text);
    assert.match(text, /\.pdf/i, 'what kind of file it is stays');
  }
  // Arrange pages: file box, captions and the pictures.
  await goToStudent(page, st.indexOf('Ruby Walsh'));
  await page.waitForFunction(() => { const pg = window.__gs.state().pages[0]; return pg && pg.covers; });
  await page.evaluate(() => window.__gs.openArrange());
  await page.waitForFunction(() => { const im = [...document.querySelectorAll('#arrBody img[data-th]')]; return im.length >= 2 && im.every(i => i.naturalWidth > 0); });
  const text = await shown(page);
  assert.ok(!/ruby|walsh/i.test(text), 'Arrange: ' + text);
  const imgDark = sel => page.evaluate(async sel => { const im = document.querySelector(sel), k = im.naturalWidth / 612, c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const px = x.getImageData(60 * k, 50 * k, 30 * k, 12 * k).data; let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] < 90) n++; return n / (px.length / 4); }, sel);
  assert.ok(await imgDark('#arrBody img[data-th]') > COVERED, 'the name on the small picture is covered');
  await page.evaluate(() => document.querySelector('#arrBody .ath').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
  await page.waitForFunction(() => { const i = document.querySelector('#spBig img'); return i && i.naturalWidth > 1000; });
  assert.ok(await imgDark('#spBig img') > COVERED, 'the name on the big picture is covered');
  await page.keyboard.press('Escape');
  // Keeping the arrangement doesn't write a hidden name over the real one.
  await page.click('#dlgBox [data-save]');
  await page.waitForFunction(() => !document.querySelector('#arrBody'));
  const names = await page.evaluate(() => { const s = window.__gs.state().batch.students.find(x => x.key === 'Ruby Walsh'); return window.__gs.layoutOf(s).map(d => d.name); });
  assert.deepEqual(names, ['Ruby Walsh Essay.pdf', 'walsh_r final.pdf']);
  assert.deepEqual(page.errors, []);
  await close();
});

test('email addresses and long ID numbers are covered, and swapped in comments', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Mia Chen/Essay.pdf': await pdf(['mchen@school.example wrote this.', 'Student ID 884213', 'A count of 12,500 and page 42.']), 'Bo Ng/Essay.pdf': await pdf(['Body.']) }), 'Essay.zip');
  await typeComments(page, await keys(page), { 'Mia Chen': 'Write to mchen@school.example about 884213. On page 42 there are 12,500.' });
  const { csv, paper } = await makeZip(page);
  assert.match(csv, /Write to \[name\] about \[name\]\. On page 42 there are 12,500\./, csv);
  assert.ok(await pdfDark(page, paper('Mia Chen'), LINE(0)) > COVERED, 'the email address');
  assert.ok(await pdfDark(page, paper('Mia Chen'), [60, 76, 100, 12]) > COVERED, 'the ID');
  assert.ok(await pdfDark(page, paper('Mia Chen'), LINE(2)) < BARE, 'everyday numbers stay');
  assert.deepEqual(page.errors, []);
  await close();
});

test('Share with Claude says plainly who is left out of the ZIP, and doesn’t call nothing checked', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Ida Word/Essay.docx': makeDocx('Word only'), 'Bea Both/Essay.pdf': await pdf(['Body.']), 'Bea Both/Notes.docx': makeDocx('Notes') }), 'Essay.zip');
  await press(page, '#shareBtn');
  await page.waitForFunction(() => /random code/.test(document.querySelector('#dlgBox .bb').innerText));
  const text = await page.$eval('#dlgBox .bb', e => e.innerText);
  assert.match(text, /1 student gets a random code/, text);
  assert.match(text, /Not in the ZIP/); assert.match(text, /1 student: Ida Word\. Only Word/);
  assert.match(text, /1 Word or other file from students who are going in/);
  const dl = await catchDownloads(page), got = await dl.next(() => page.click('#dlgBox [data-make]')); await dl.close();
  assert.match(strFromU8(unzipSync(got.bytes)['README.txt']), /Papers: 1 student,/);
  await closeDlg(page); await close();
  // Only Word files: nothing to check and nothing to send, and no tick.
  const b = await openApp(browser);
  await openNoPages(b.page, zipOf({ 'Ida Word/Essay.docx': makeDocx('Word only'), 'Uma Word/Essay.docx': makeDocx('Word too') }));
  await press(b.page, '#shareBtn');
  await b.page.waitForFunction(() => /No one can go in/.test(document.querySelector('#dlgBox .bb').innerText));
  assert.equal(await b.page.$eval('#shCount', e => e.textContent), 'No PDFs or pictures to check.');
  assert.equal(await b.page.$eval('#dlgBox [data-check]', e => e.disabled), true);
  assert.equal(await b.page.$eval('#dlgBox [data-make]', e => e.disabled), true);
  assert.deepEqual(b.page.errors, []);
  await b.close();
});

test('the cover count waits until the pages are counted', async () => {
  const { page, close } = await openApp(browser);
  const files = {}; for (const c of 'abcdef') files['Stu Dent' + c + '/Essay.pdf'] = await pdf(['Body.']);
  await openZip(page, zipOf(files), 'Essay.zip');
  await page.evaluate(() => window.__gs.ensureCounts());
  // As it is just after a saved download reopens: one file not counted yet.
  const line = await page.evaluate(() => { const f = window.__gs.state().batch.students[3].files[0], was = f.numPages; f.numPages = 0; const a = window.__gs.coverLine(); f.numPages = was; return [a, window.__gs.coverLine()]; });
  assert.deepEqual(line, ['Counting the papers…', '0 of 6 papers checked.']);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Bring back only skips an exact repeat, not a reply that happens to be inside her comment', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': await pdf(['Body.']), 'Bo Ng/Essay.pdf': await pdf(['Body.']) }), 'Essay.zip');
  await typeComments(page, await keys(page), { 'Aria Testwell': 'Good work on the thesis' });
  const code = await page.evaluate(() => { window.__gs.openShare(); return window.__gs.state().batch.share.codes['Aria Testwell']; });
  await closeDlg(page);
  const bring = async reply => {
    await page.evaluate(() => window.__gs.openBringBack());
    await page.waitForSelector('#bbText'); await page.$eval('#bbText', (e, t) => { e.value = t; }, code + '\n' + reply);
    await page.click('[data-read]'); await page.waitForFunction(() => !document.querySelector('[data-apply]').disabled); await page.click('[data-apply]');
    return page.evaluate(() => window.__gs.state().batch.students.find(s => s.key === 'Aria Testwell').grade.comment);
  };
  assert.equal(await bring('Good work'), 'Good work on the thesis\n\nGood work');
  assert.equal(await bring('Good work'), 'Good work on the thesis\n\nGood work', 'the same reply twice goes in once');
  assert.deepEqual(page.errors, []);
  await close();
});

test('during anonymous grading Previous and Next follow the papers’ order, and the Move box and export check show no names', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Ruby Walsh/Ruby Walsh Essay.pdf': await pdf(['Ruby Walsh essay']), 'Nia Turn/Essay.pdf': await pdf(['Body.']), 'Omar Haddad/Essay.pdf': await pdf(['Body.']), 'Theo Banks/Essay.pdf': await pdf(['Body.']) }), 'Essay.zip');
  await startAnon(page);
  const order = await page.evaluate(() => window.__gs.anonOrder());
  for (const [k, i] of order.entries()) {
    await goToStudent(page, i);
    const nav = await page.evaluate(() => [document.querySelector('#prevBtn').disabled, document.querySelector('#nextBtn').disabled]);
    assert.deepEqual(nav, [k === 0, k === order.length - 1], 'paper ' + (k + 1));
  }
  const st = await keys(page);
  await goToStudent(page, st.indexOf('Ruby Walsh'));
  await page.waitForSelector('#paper [data-mvfile]');
  await pick(page, '#paper [data-mvfile]');
  await page.waitForSelector('#mvList');
  const text = await page.$eval('#dlgBox', e => e.innerText);
  assert.ok(!/ruby|walsh|nia|omar|haddad|theo|banks/i.test(text), text);
  assert.match(text, /Paper \d/);
  await closeDlg(page);
  // A grade to confirm goes to the paper, not to the Grade sheet with every name on it.
  await page.evaluate(() => { const b = window.__gs.state().batch, s = b.students.find(x => x.key === 'Ruby Walsh'); s.doubts = [{ total: 5, outOf: 12 }]; window.__gs.openExport(); });
  await page.waitForSelector('#xCheck');   // the files may still be being read when it opens
  const check = await page.evaluate(() => { return { sheet: !!document.querySelector('#xCheck [data-chksheet]'), rows: document.querySelector('#xCheck').innerText }; });
  assert.equal(check.sheet, false, check.rows);
  await closeDlg(page);
  assert.deepEqual(page.errors, []);
  await close();
});

test('her cover box and page lighting follow a file renamed in a newer download', async () => {
  const { page, close } = await openApp(browser);
  const nia = await pdf(['Nia Turn essay', 'Body.']), oren = await pdf(['Oren Sample essay', 'Body.']);
  await openZip(page, zipOf({ 'Nia Turn/Essay.pdf': nia, 'Oren Sample/Essay.pdf': oren, 'Pia Lane/Essay.pdf': await pdf(['Pia Lane essay']) }), 'River.zip');
  await page.evaluate(() => { const G = window.__gs, s = G.state(); G.openShare(); s.batch.share.boxes['Nia Turn/Essay.pdf|0'] = [[0.1, 0.05, 0.4, 0.05]]; s.batch.lightPg = { 'Nia Turn|Nia Turn/Essay.pdf|0': false }; });
  await closeDlg(page);
  await score(page, [3, 3, 3]);
  await settle(page);
  await page.click('#closeBtn');
  await page.waitForFunction(() => document.querySelector('#start').hidden === false);
  await new Promise(r => setTimeout(r, 300));
  await pickFile(page, '#fileIn', zipOf({ 'Nia Turn/Essay final.pdf': nia, 'Oren Sample/Essay.pdf': oren, 'Pia Lane/Essay.pdf': await pdf(['Pia Lane essay, sent again']) }), 'River.zip');
  await page.waitForSelector('#carryBox', { timeout: 30000 });
  const got = await page.evaluate(() => { const b = window.__gs.state().batch; return { boxes: b.share.boxes, lit: b.lightPg }; });
  assert.deepEqual(got.boxes, { 'Nia Turn/Essay final.pdf|0': [[0.1, 0.05, 0.4, 0.05]] });
  assert.deepEqual(got.lit, { 'Nia Turn|Nia Turn/Essay final.pdf|0': false });
  assert.deepEqual(page.errors, []);
  await close();
});

test('a made-up file posing as an editable export can’t stop its page drawing', async () => {
  const { page, close } = await openApp(browser);
  const d = await PDFDocument.create(); d.addPage([612, 792]);
  const info = { v: 1, pages: [[0, 0, [{ t: 'note', x: 60, y: 200, ax: 60, ay: 200, text: 'no colour here' }, null, 'nonsense', { t: 'pen' }, { t: 'check', x: 100, y: 100, color: '#cc0000' }], 0, 0]] };
  await d.attach(await pdf(['Original pages']), 'gs-original-1.pdf', { mimeType: 'application/pdf' });
  await d.attach(Buffer.from(JSON.stringify(info)), 'grading-studio.json', { mimeType: 'application/json' });
  const bytes = Buffer.concat([Buffer.from(await d.save()), Buffer.from('\n%GradingStudio-editable\n')]);
  await openZip(page, zipOf({ 'Ana Forged/Essay.pdf': bytes, 'Bo Ng/Essay.pdf': await pdf(['Body.']) }), 'Essay.zip');
  await goToStudent(page, 0);
  await new Promise(r => setTimeout(r, 400));
  const marks = await page.evaluate(() => window.__gs.state().batch.students[0].files[0].marks[0]);
  assert.deepEqual(marks.map(m => m.t), ['check']);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a poster-size page goes in the ZIP instead of hanging it', async () => {
  const { page, close } = await openApp(browser);
  const big = await PDFDocument.create(), font = await big.embedFont(StandardFonts.Helvetica);
  big.addPage([9000, 14000]).drawText('Pol Poster', { x: 200, y: 13000, size: 400, font });
  await openZip(page, zipOf({ 'Pol Poster/Big.pdf': await big.save(), 'Bo Ng/Essay.pdf': await pdf(['Body.']) }), 'Essay.zip');
  const { z, codes } = await makeZip(page);
  assert.ok(z['papers/' + codes['Pol Poster'] + '.pdf'], 'its paper is there');
  assert.deepEqual(page.errors, []);
  await close();
});

test('a page with only handwriting drawn on it, or only a small picture, is marked, and a truly blank page isn’t', async () => {
  const { page, close } = await openApp(browser);
  const ink = await PDFDocument.create(), p1 = ink.addPage([612, 792]);
  for (let x = 60; x < 200; x += 14) p1.drawLine({ start: { x, y: 740 }, end: { x: x + 10, y: 760 }, thickness: 1, color: rgb(0, 0, 0) });
  const pic = await PDFDocument.create(), dot = await pic.embedPng('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
  pic.addPage([612, 792]).drawImage(dot, { x: 60, y: 600, width: 300, height: 100 });
  const blank = await PDFDocument.create(); blank.addPage([612, 792]);
  const white = await PDFDocument.create(); white.addPage([612, 792]).drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(1, 1, 1) });
  await openZip(page, zipOf({
    'Vic Lane/Essay.pdf': await ink.save(),
    'Ivy Smallpic/Essay.pdf': await pic.save(),
    'Lena Fisher/Essay.pdf': await pdf(['Lena Fisher', 'Body.']),
    'Uma Blank/Essay.pdf': await blank.save(),
    'Wes White/Essay.pdf': await white.save(),
  }), 'Essay.zip');
  const text = await openShareBox(page);
  assert.doesNotMatch(text, /It has no names in it/);
  await namesDone(page);
  const flags = Object.fromEntries(await page.evaluate(() => window.__gs.nameFlagged().map(x => [x.st.key, x.say])));
  assert.deepEqual(flags, { 'Vic Lane': 'Name not found', 'Ivy Smallpic': 'Name not found' });
  const said = await page.$eval('#dlgBox .bb', e => e.innerText);
  assert.match(said, /Check these first/, said);
  assert.doesNotMatch(said, /It has no names in it/, said);
  assert.deepEqual(page.errors, []);
  await close();
});

test('a Word paper with no sign of its student’s name is listed before anonymous grading starts, and says so on the paper', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({
    'Ana Lopez/Essay.pdf': await pdf(['Ana Lopez', 'Body.']),
    'Katherine Bell/Essay.docx': makeDocx('Katie B., period 3'),
    'Dora Quinn/Essay.docx': makeDocx('Dora Quinn, period 3'),
    'Milo Ellis/Essay.docx': makeDocx('M. Ellis, period 3'),
    'Pia Blanko/Essay.docx': makeDocx(' '),
  }), 'Essay.zip');
  await page.click('#anonSw'); await page.waitForSelector('[data-go]');
  await page.waitForSelector('#wordFlags');
  await namesDone(page);
  const box = await page.$eval('#wordFlags', e => e.innerText);
  assert.match(box, /This paper may show a name/, box);
  assert.match(box, /Katherine Bell Essay\.docx/, box);
  assert.doesNotMatch(box, /Dora|Milo|Pia|Ana/, box);
  assert.deepEqual(await page.evaluate(() => window.__gs.nameFlagged().map(x => x.st.key)), [], 'PDFs go through Check the covers, and Word papers can’t');
  // She can go and look at it from here.
  await page.click('#wordFlags [data-wp]');
  await page.waitForFunction(() => document.querySelector('#dlg').hidden);
  await page.waitForFunction(() => /Katie B\./.test(document.querySelector('#paper').textContent));
  await page.click('#anonSw'); await page.waitForSelector('[data-go]'); await page.click('[data-go]');
  const i = await page.evaluate(() => window.__gs.state().batch.students.findIndex(s => s.key === 'Katherine Bell'));
  await goToStudent(page, i);
  await page.waitForSelector('#paper .anonnote');
  assert.match(await page.$eval('#paper .anonnote', e => e.textContent), /name wasn’t found in this file, so a nickname or initials could still show/);
  const j = await page.evaluate(() => window.__gs.state().batch.students.findIndex(s => s.key === 'Dora Quinn'));
  await goToStudent(page, j);
  await page.waitForFunction(() => /period 3/.test(document.querySelector('#paper').textContent));
  await new Promise(r => setTimeout(r, 300));
  assert.equal(await page.$('#paper .anonnote'), null);
  assert.deepEqual(page.errors, []);
  await close();
});

test('the check and the ZIP cover what comes after a Name label, and skip a classmate’s name typed small or found on many papers', async () => {
  const { page, close } = await openApp(browser);
  const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  await openZip(page, zipOf({
    'Aria Testwell/Essay.pdf': await pdf(['Name: Ari T.     Date: 1 Nov', 'The Earth is warming.', 'I ate a mint today.', 'Mint helped me write this.', 'Name three causes of the war and explain them.']),
    'Earth Somchai/Essay.pdf': await pdf(['Name: Earth S.', 'Earth is our home.']),
    'Mint Wongsa/Essay.pdf': await pdf(['Life on Earth.']),
    'Bank Chai/Essay.pdf': await pdf(['Name: ____________', 'Earth and sky.']),
  }), 'Essay.zip');
  // Which lines get a cover, and how far right the covers on each line reach.
  const lines = who => page.evaluate(async (who, plain) => {
    const G = window.__gs, st = G.state().batch.students.find(s => s.key === who), f = st.files[0];
    await G.classCommon();
    const d = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise, p = await d.getPage(1), vp = p.getViewport({ scale: 1 });
    const cs = await G.autoCovers(p, vp, G.coverRx(st), null, plain ? undefined : G.shareOpts(st));
    d.destroy();
    const out = {};
    for (const r of cs) { const i = Math.round((r.y + r.h - 62 - 6) / 26); out[i] = Math.max(out[i] || 0, Math.round(r.x + r.w)); }
    return out;
  }, who, false);
  const aria = await lines('Aria Testwell');
  assert.ok(aria[0], 'what she typed after Name: is covered, though it isn’t on the roster: ' + JSON.stringify(aria));
  assert.ok(aria[0] < 60 + font.widthOfTextAtSize('Name: Ari T.     ', 14), 'and the Date after it isn’t: ' + aria[0]);
  assert.equal(aria[1], undefined, 'Earth is on most papers, so it isn’t a name on hers');
  assert.equal(aria[2], undefined, 'mint typed small isn’t Mint');
  assert.ok(aria[3], 'Mint, written as a name, is still covered');
  assert.equal(aria[4], undefined, 'Name three causes is a question, not a label');
  const earth = await lines('Earth Somchai');
  assert.ok(earth[0] && earth[1], 'on Earth’s own paper, Earth is covered: ' + JSON.stringify(earth));
  const bank = await page.evaluate(async () => {
    const G = window.__gs, st = G.state().batch.students.find(s => s.key === 'Bank Chai'), f = st.files[0];
    const d = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise, p = await d.getPage(1);
    const cs = await G.autoCovers(p, p.getViewport({ scale: 1 }), G.coverRx(st), null, G.shareOpts(st)); d.destroy();
    return cs.filter(r => r.y < 80).map(r => Math.round(r.h));
  });
  assert.ok(bank.length && bank[0] > 30, 'the blank after Name: gets a cover tall enough for a handwritten name: ' + JSON.stringify(bank));
  // Anonymous grading keeps covering every match, as before.
  const anon = await page.evaluate(async () => {
    const G = window.__gs, st = G.state().batch.students.find(s => s.key === 'Aria Testwell'), f = st.files[0];
    const d = await pdfjsLib.getDocument({ data: f.data.slice(), isEvalSupported: false }).promise, p = await d.getPage(1);
    const cs = await G.autoCovers(p, p.getViewport({ scale: 1 }), G.coverRx(st)); d.destroy();
    return cs.some(r => Math.round((r.y + r.h - 62 - 6) / 26) === 1);
  });
  assert.ok(anon, 'without the check’s weighing, Earth is covered');
  assert.deepEqual(page.errors, []);
  await close();
});
