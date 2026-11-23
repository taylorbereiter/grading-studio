// Readings, Transcripts for every recording, and Copy all scores on the new marking screen (slice C PR 3), in a real browser. Readings:
// files shown above the papers, for everyone or one student, with a card that folds, hides, zooms and grows; kept as the current app
// keeps them, so either app shows what the other added. Transcripts: every recording's transcript made in this browser (the speech
// engine stood in for). The Grade sheet's Copy all scores, and a Missing paper given a grade there says it is no longer Missing.
// npm run next:browser. Every student here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant, appReady, openZip, settle } = require('../../../test/helpers/app.js');
const { standardFiles, zipOf, makePaper, makeDocx } = require('../../../test/helpers/fixtures.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const onDisk = require('./site-path');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p) || onDisk.extra(p);
    const f = onDisk(p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}

let browser, srv, dir;
before(async () => { srv = await serveSite(); browser = await launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-readings-')); });
after(async () => { await browser.close(); await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
const KEY = 'Bram Sample';
const menuPick = async (p, opener, label) => { await p.waitForSelector(opener, { timeout: 60000 }); await p.click(opener); await p.waitForSelector('.pop [role^="menuitem"]');
  const ok = await p.evaluate(l => { const it = [...document.querySelectorAll('.pop [role^="menuitem"]')].find(e => (e.querySelector('b') || e).textContent.trim() === l); if (it) it.click(); return !!it; }, label);
  if (!ok) throw new Error('no menu item ' + label); };
const menuText = async (p, opener) => { await p.click(opener); await p.waitForSelector('.pop [role^="menuitem"]');
  const all = await p.evaluate(() => [...document.querySelectorAll('.pop [role^="menuitem"]')].map(e => e.textContent.trim()));
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('.pop')); return all; };
const openOn = async (p, key) => { const i = await p.evaluate(k => window.__mark.state().batch.students.findIndex(s => s.key === k), key);
  await p.click('[data-st="' + i + '"]'); await p.waitForFunction(i => window.__mark.state().cur === i && document.querySelector('[data-pmore]'), { timeout: 30000 }, i); };
const toastSays = (p, rx) => p.waitForFunction(s => [...document.querySelectorAll('.toast')].some(e => new RegExp(s).test(e.textContent)), { timeout: 15000 }, rx.source)
  .catch(async e => { throw new Error(e.message + ' (' + rx.source + '): ' + await p.evaluate(() => [...document.querySelectorAll('.toast, [data-trallmsg], dialog[open]')].map(x => x.textContent.slice(0, 300)).join(' | '))); });
const choose = async (p, sel, files) => { const [ch] = await Promise.all([p.waitForFileChooser(), p.click(sel)]); await ch.accept(files); };
const findHas = async (p, say) => {
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control');
  await p.waitForSelector('dialog.cmd[open]');
  await p.keyboard.type(say);
  const ok = await p.waitForFunction(s => [...document.querySelectorAll('dialog.cmd[open] [role="option"]')].some(o => o.textContent.includes(s)), { timeout: 10000 }, say).then(() => true, () => false);
  await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog.cmd[open]'));
  return ok;
};
// the download opened in the current app first (made-up papers), with what before() does there; then the new marking screen on it
async function both(ctx, errors, files, before) {
  const m = await page(ctx, errors);
  await m.goto(srv.url + 'blank'); await plant(m, gradingSeed());
  await m.goto(srv.url); await appReady(m);
  await openZip(m, zipOf(files));
  if (before) await before(m);
  await m.evaluate(() => window.__gs.saveNow()); await settle(m);
  const id = await m.evaluate(() => window.__gs.state().batch.id); await m.close();
  const p = await page(ctx, errors);
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id));
  await p.waitForFunction(() => window.__mark && window.__mark.ready && window.__mark.read, { timeout: 60000 });
  await p.waitForSelector('[data-pmore]', { timeout: 60000 });
  if (await p.$('[data-repx]')) await p.click('[data-repx]');
  return { p, id };
}
const oldApp = async (ctx, errors, id) => {
  const m = await page(ctx, errors);
  await m.goto(srv.url); await appReady(m);
  await m.evaluate(id => window.__gs.reopenKept(id), id);
  await m.waitForFunction(id => { const s = window.__gs.state(); return s.batch && s.batch.id === id; }, { timeout: 60000 }, id);
  return m;
};
const cards = p => p.$$eval('[data-rdcards] [data-rdcard]', l => l.map(e => e.dataset.rdcard));

test('C-053 C-078 C-079 C-080 C-081 C-083 C-084 C-085 C-039 C-040 C-041: Readings in More for this paper (its count, for everyone and for one student, your document, Show, Remove, Done), and the cards above the paper (Hide for this student, Remove, zoom − fit +, Ctrl + scroll); kept as the current app keeps them, both ways', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const reading = path.join(dir, 'The reading.pdf'), notes = path.join(dir, 'Notes for Bram.txt'), other = path.join(dir, 'Bram prompt.pdf');
  fs.writeFileSync(reading, await makePaper({ title: 'A short reading for the class', pages: 2 }));
  fs.writeFileSync(notes, 'Bram read the second story instead.\n');
  fs.writeFileSync(other, await makePaper({ title: 'The prompt Bram answered' }));
  const docx = Buffer.from(makeDocx('Things to look for in every essay.')).toString('base64');
  // the current app's side first: a reading for everyone it added, left off for Cleo, and the Word document it kept beside every paper
  const prompt = Buffer.from(await makePaper({ title: 'The prompt for everyone' })).toString('base64');
  const { p, id } = await both(ctx, errors, await standardFiles(), async m => {
    await m.evaluate(async (b64, docx) => {
      const G = window.__gs, bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      await G.addRefs([new File([u], 'Prompt.pdf')]);
      const b = G.state().batch; b.refSkip = { 'Cleo Fixture': ['Prompt.pdf'] };
      localStorage.setItem('gs.rd.' + b.id, JSON.stringify({ name: 'What to look for.docx', b64: docx, at: 1 }));
    }, prompt, docx);
  });
  // what the current app added shows here: the document first, then the prompt, but not for Cleo
  await openOn(p, KEY);
  await p.waitForFunction(() => document.querySelectorAll('[data-rdcards] [data-rdcard]').length === 2, { timeout: 30000 });
  assert.deepEqual(await cards(p), ['doc', 'Prompt.pdf']);
  assert.match(await p.$eval('[data-rdcard="doc"] summary', e => e.textContent), /Your document: What to look for\.docx/);
  await p.waitForFunction(() => /Things to look for/.test(document.querySelector('[data-rdcard="doc"]').textContent), { timeout: 30000 });
  await openOn(p, 'Cleo Fixture');
  await p.waitForFunction(() => document.querySelectorAll('[data-rdcards] [data-rdcard]').length === 1, { timeout: 30000 });
  assert.deepEqual(await cards(p), ['doc'], 'left off for Cleo, as the current app left it');
  await openOn(p, KEY);
  // C-053 the opener, in More for this paper, with how many show with this paper; and in Find
  assert.ok((await menuText(p, '[data-pmore]')).some(x => /^Readings…\s*2 shown with this paper$/.test(x)), 'Readings… with its count');
  assert.ok(!(await menuText(p, '[data-setupopen]')).some(x => /Transcripts/.test(x)), 'no Transcripts in Setup without recordings');
  assert.ok(await findHas(p, 'Readings'), 'Readings… is in Find');
  await menuPick(p, '[data-pmore]', 'Readings…');
  await p.waitForSelector('dialog[open] [data-readings]', { timeout: 30000 });
  // C-081 + Add a file for everyone…
  await choose(p, '[data-rdadd]', [reading]);
  await toastSays(p, /“The reading\.pdf” now shows above every paper/);
  await p.waitForSelector('[data-rdrm="The reading.pdf"]');
  // C-085 + Add a file just for Bram, twice
  await choose(p, '[data-rdmine]', [notes]);
  await toastSays(p, /“Notes for Bram\.txt” now shows for Bram Sample/);
  await choose(p, '[data-rdmine]', [other]);
  await p.waitForSelector('[data-rdrm="Bram Sample/Bram prompt.pdf"]');
  assert.match(await p.$eval('[data-readings]', e => e.textContent), /only for Bram Sample/);
  // C-083 Show <file> for this student: off, then on again
  const show = f => p.evaluate(f => { const r = document.querySelector('[data-rdon="' + f + '"] input'); r.click(); }, f);
  await show('Prompt.pdf');
  await p.waitForFunction(k => JSON.stringify((window.__mark.state().batch.refSkip || {})[k]) === '["Prompt.pdf"]', {}, KEY);
  await show('Prompt.pdf');
  await p.waitForFunction(k => !(window.__mark.state().batch.refSkip || {})[k], {}, KEY);
  // C-084 Remove a file only for this student
  await p.click('[data-rdrm="Bram Sample/Bram prompt.pdf"]');
  await p.waitForFunction(() => !document.querySelector('[data-rdrm="Bram Sample/Bram prompt.pdf"]'));
  // C-078 Done
  await p.click('[data-rddone]');
  await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  await p.waitForFunction(() => document.querySelectorAll('[data-rdcards] [data-rdcard]').length === 4, { timeout: 30000 });
  assert.deepEqual(await cards(p), ['doc', 'Prompt.pdf', 'The reading.pdf', 'Bram Sample/Notes for Bram.txt']);
  assert.match(await p.$eval('[data-rdcard="Bram Sample/Notes for Bram.txt"]', e => e.textContent), /only for this student[\s\S]*Bram read the second story instead\./);
  assert.match(await p.$eval('[data-rdcard="The reading.pdf"] summary', e => e.textContent), /shown with every paper, not sent back/);
  // C-040 zoom: + and − and back to the width; the pages drawn wider, and the zoom kept for this file
  const sel = '[data-rdcard="The reading.pdf"]';
  await p.waitForFunction(s => document.querySelectorAll(s + ' canvas').length === 2 && document.querySelector(s + ' canvas').width > 0, { timeout: 30000 }, sel);
  const w0 = await p.$eval(sel + ' canvas', c => c.getBoundingClientRect().width);
  await p.click(sel + ' [data-rz="+"]');
  await p.waitForFunction(s => document.querySelector(s + ' [data-rz="1"]').textContent === '125%', {}, sel);
  assert.equal(await p.evaluate(() => localStorage.getItem('gs.refZoom.The reading.pdf')), '1.25');
  assert.ok(await p.$eval(sel + ' canvas', c => c.getBoundingClientRect().width) > w0 * 1.2, 'drawn wider');
  await p.click(sel + ' [data-rz="-"]'); await p.click(sel + ' [data-rz="-"]');
  await p.waitForFunction(s => document.querySelector(s + ' [data-rz="1"]').textContent === '80%', {}, sel);
  await p.click(sel + ' [data-rz="1"]');
  await p.waitForFunction(s => document.querySelector(s + ' [data-rz="1"]').textContent === '100%', {}, sel);
  // C-041 Ctrl + scroll on the reading zooms the reading, not the papers
  const zoomBefore = await p.evaluate(() => window.__mark.state().zoom);
  const box = await (await p.$(sel + ' .rd-scroll')).boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + Math.min(100, box.height / 2));
  await p.keyboard.down('Control'); await p.mouse.wheel({ deltaY: -200 }); await p.keyboard.up('Control');
  await p.waitForFunction(s => parseInt(document.querySelector(s + ' [data-rz="1"]').textContent) > 100, {}, sel);
  assert.equal(await p.evaluate(() => window.__mark.state().zoom), zoomBefore, 'the papers did not zoom');
  // the card folds, and stays folded for this file
  await p.click(sel + ' summary');
  await p.waitForFunction(() => localStorage.getItem('gs.refOpen.The reading.pdf') === 'false');
  await p.click(sel + ' summary');
  await p.waitForFunction(() => localStorage.getItem('gs.refOpen.The reading.pdf') === 'true');
  // C-039 on a card: Hide for this student (everyone's file), Remove (one of hers)
  await p.click('[data-rdcard="Prompt.pdf"] [data-rdhide]');
  await toastSays(p, /Hidden for this student/);
  await p.waitForFunction(k => JSON.stringify((window.__mark.state().batch.refSkip || {})[k]) === '["Prompt.pdf"]', {}, KEY);
  await p.waitForFunction(() => !document.querySelector('[data-rdcard="Prompt.pdf"]'));
  assert.ok(await p.$('[data-rdcard="Prompt.pdf"] [data-rdhide]') === null);
  // C-079 Remove your document, C-080 Remove for everyone (the reading), from the box; Readings… now counts what is left
  await menuPick(p, '[data-pmore]', 'Readings…');
  await p.waitForSelector('dialog[open] [data-rddoc]', { timeout: 30000 });
  await p.click('[data-rddoc]');
  await p.waitForFunction(id => !document.querySelector('[data-rddoc]') && localStorage.getItem('gs.rd.' + id) === null, {}, id);
  await p.click('[data-rdrm="The reading.pdf"]');
  await p.waitForFunction(() => !document.querySelector('[data-rdrm="The reading.pdf"]'));
  await p.click('[data-rddone]');
  await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  await p.waitForFunction(() => document.querySelectorAll('[data-rdcards] [data-rdcard]').length === 1, { timeout: 30000 });
  assert.deepEqual(await cards(p), ['Bram Sample/Notes for Bram.txt']);
  assert.ok((await menuText(p, '[data-pmore]')).some(x => /^Readings…\s*1 shown with this paper$/.test(x)));
  // and a file of hers taken off from its card: Remove
  await p.click('[data-rdcard="Bram Sample/Notes for Bram.txt"] [data-rdhide]');
  await p.waitForFunction(() => !document.querySelector('[data-rdcards]'));
  // one more for Aria only, so the current app has one of each kind to read
  await openOn(p, 'Aria Testwell');
  await menuPick(p, '[data-pmore]', 'Readings…');
  await p.waitForSelector('dialog[open] [data-readings]');
  await choose(p, '[data-rdmine]', [notes]);
  await p.waitForSelector('[data-rdrm="Aria Testwell/Notes for Bram.txt"]');
  await p.click('[data-rddone]');
  await p.evaluate(() => window.__mark.saved());
  const done = await p.evaluate(() => JSON.parse(JSON.stringify(window.__mark.state().batch.refSkip)));
  await p.close();
  // the current app reads what was changed here: the prompt (still for everyone, hidden for Bram and Cleo), Aria's file; no document
  const m = await oldApp(ctx, errors, id);
  await m.waitForFunction(() => window.__gs.refs().length === 2, { timeout: 30000 });
  assert.deepEqual(await m.evaluate(() => window.__gs.refs().map(r => [r.path, r.for, r.data.length > 0]).sort()), [['Aria Testwell/Notes for Bram.txt', 'Aria Testwell', true], ['Prompt.pdf', '', true]]);
  assert.deepEqual(await m.evaluate(() => window.__gs.state().batch.refSkip), done);
  assert.deepEqual(done, { 'Cleo Fixture': ['Prompt.pdf'], [KEY]: ['Prompt.pdf'] });
  assert.equal(await m.evaluate(id => localStorage.getItem('gs.rd.' + id), id), null);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// A made-up recording: three seconds of a low tone.
function wav(secs = 3, rate = 8000) {
  const n = secs * rate, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / rate * 2 * Math.PI * 220) * 6000), 44 + i * 2);
  return b;
}

test('C-075 C-091 C-092 C-093: Transcripts in Setup (and Find) when the download has recordings: every recording made in turn, Stop, Make the existing ones again too, Close; the current app reads the transcripts', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const { p, id } = await both(ctx, errors, { 'Aria Testwell/Essay.pdf': await makePaper({ title: 'Aria Testwell essay' }), 'Aria Testwell/Speech.wav': wav(), 'Bram Sample/Talk.wav': wav(2), 'Cleo Fixture/Essay.pdf': await makePaper({ title: 'Cleo Fixture essay' }) });
  assert.ok(await findHas(p, 'Transcripts'), 'Transcripts… is in Find');
  await menuPick(p, '[data-setupopen]', 'Transcripts…');
  await p.waitForSelector('dialog[open] [data-trbox]', { timeout: 30000 });
  assert.match(await p.$eval('[data-trbox]', e => e.textContent), /2 recordings in this assignment\./);
  assert.equal(await p.$('[data-trbox] .cb'), null, 'nothing to make again yet');
  // the speech engine stood in for: each recording says its own words
  await p.evaluate(() => {
    window.__said = 0;
    window.__media.asrStandIn.decode = async () => new Float32Array(16000 * 3).fill(0.1);
    window.__media.asrStandIn.call = async m => m.type === 'load' ? { type: 'ready' } : { type: 'result', words: [[' Take', 0.2], [' ' + (++window.__said), 0.9]] };
  });
  const trs = () => p.evaluate(() => window.__mark.state().batch.students.flatMap(s => s.files.filter(f => f.kind === 'media').map(f => [s.key, f.tr ? f.tr.w.map(w => w[0]).join('').trim() : null])));
  // C-092 Make transcripts: both, one after another
  await p.click('[data-trall]');
  await toastSays(p, /Done\. 2 transcripts made\./);
  assert.deepEqual(await trs(), [['Aria Testwell', 'Take 1'], ['Bram Sample', 'Take 2']]);
  assert.match(await p.$eval('[data-trbox]', e => e.textContent), /2 have a transcript already\./);
  // pressed again with nothing new: says so
  await p.click('[data-trall]');
  await toastSays(p, /Every recording already has a transcript/);
  // C-091 Make the existing ones again too, and C-092 Stop: the first waits, Stop ends the run, nothing more is made
  await p.evaluate(() => { const l = document.querySelector('[data-trbox] .cb input'); l.click(); });
  await p.evaluate(() => { const call = window.__media.asrStandIn.call; window.__media.asrStandIn.call = m => m.type === 'load' ? call(m) : new Promise(r => { window.__go = () => r(call(m)); }); });
  await p.click('[data-trall]');
  await p.waitForFunction(() => document.querySelector('[data-trall]').textContent === 'Stop' && typeof window.__go === 'function', { timeout: 15000 });
  assert.ok(await p.$('[data-trbox] .prog'), 'the progress bar while it works');
  await p.click('[data-trall]');
  await p.waitForFunction(() => document.querySelector('[data-trall]').textContent === 'Stopping…');
  await p.evaluate(() => window.__go());   // (the real engine is stopped at once; the stand-in answers when it is told)
  await toastSays(p, /Stopped\. 0 transcripts made\./);
  await p.waitForFunction(() => document.querySelector('[data-trall]').textContent === 'Make transcripts');
  assert.deepEqual(await trs(), [['Aria Testwell', 'Take 1'], ['Bram Sample', 'Take 2']], 'nothing changed by a stopped run');
  // again, all the way: both made again
  await p.evaluate(() => { window.__media.asrStandIn.call = async m => m.type === 'load' ? { type: 'ready' } : { type: 'result', words: [[' Again', 0.2], [' ' + (++window.__said), 0.9]] }; });
  await p.evaluate(() => { const l = document.querySelector('[data-trbox] .cb input'); if (!l.checked) l.click(); });
  await p.click('[data-trall]');
  await p.waitForFunction(() => window.__mark.state().batch.students.flatMap(s => s.files.filter(f => f.kind === 'media')).every(f => f.tr && /Again/.test(f.tr.w.map(w => w[0]).join(''))) && document.querySelector('[data-trall]').textContent === 'Make transcripts', { timeout: 30000 });
  assert.match(await p.$eval('[data-trallmsg]', e => e.textContent), /^Done\. 2 transcripts made\.$/);
  const made = await trs();
  assert.ok(made.every(([, w]) => /^Again \d+$/.test(w)), 'made again: ' + JSON.stringify(made));
  // C-093 Close
  await p.click('[data-trclose]');
  await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  await p.evaluate(() => window.__mark.saved());
  await p.close();
  const m = await oldApp(ctx, errors, id);
  assert.deepEqual(await m.evaluate(() => window.__gs.state().batch.students.flatMap(s => s.files.filter(f => f.kind === 'media').map(f => [s.key, f.tr ? f.tr.w.map(w => w[0]).join('').trim() : null]))), made, 'the current app has the same transcripts');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('C-902 H-038: the Grade sheet copies all scores, one a line in the list’s order, asking first when some are partly scored; a Missing paper whose read grade is used is no longer Missing, and says so', async () => {
  const errors = [], ctx = await browser.createBrowserContext();
  const files = await standardFiles();
  const { p, id } = await both(ctx, errors, files, async m => {
    await m.evaluate(() => { const G = window.__gs, s = G.state(), b = s.batch, n = s.setup.criteria.length;
      b.students[0].grade.rubric = s.setup.criteria.map(() => 3);
      b.students[1].grade.rubric = [2].concat(Array(n - 1).fill(null)); });
  });
  await p.evaluate(() => { window.__copied = []; navigator.clipboard.writeText = async s => { window.__copied.push(s); }; });
  await p.goto(srv.url + 'next/#/mark/' + encodeURIComponent(id) + '/grades');
  await p.waitForSelector('#glTable', { timeout: 60000 });
  await p.evaluate(() => { window.__copied = []; navigator.clipboard.writeText = async s => { window.__copied.push(s); }; });
  await p.evaluate(() => [...document.querySelectorAll('.mk-grades [role="radio"], .mk-grades .seg button, .mk-grades [aria-pressed]')].find(b => /Grade sheet/.test(b.textContent)).click());
  await p.waitForSelector('[data-sheet] .gs-tbl', { timeout: 60000 });
  // C-902: Bram is partly scored, so it asks first; Cancel copies nothing, Copy anyway copies every student
  await p.$eval('[data-cpall]', b => b.click());
  await p.waitForSelector('dialog[open] [data-cpask]');
  assert.match(await p.$eval('[data-cpask]', e => e.textContent), /^1 student has only part of the rubric scored: Bram Sample\./);
  await p.evaluate(() => [...document.querySelectorAll('dialog[open] footer button')].find(b => b.textContent === 'Cancel').click());
  await p.waitForFunction(() => !document.querySelector('[data-cpask]'));
  assert.equal(await p.evaluate(() => window.__copied.length), 0);
  await p.$eval('[data-cpall]', b => b.click());
  await p.waitForSelector('dialog[open] [data-cpanyway]');
  await p.click('[data-cpanyway]');
  await p.waitForFunction(() => window.__copied.length === 1);
  const n = await p.evaluate(() => window.__mark.state().batch.students.length);
  await toastSays(p, new RegExp('Copied ' + n + ' scores in the list’s order \\(blank where unsure\\)'));
  const lines = (await p.evaluate(() => window.__copied[0])).split('\n');
  assert.equal(lines.length, n, 'one line a student');
  assert.match(lines[0], /\d/, 'Aria’s total');
  assert.match(lines[1], /partial/, 'Bram’s total says it is partial');
  // H-038: Cleo's paper reads 9.5/12, which the sheet asks about, and she is marked Missing (a Missing paper's files are left out, so
  // once the sheet has read hers); Use it gives her that grade and says she is no longer Missing
  const cleo = await p.evaluate(() => window.__mark.state().batch.students.findIndex(s => s.key === 'Cleo Fixture'));
  await p.evaluate(i => { window.__mark.state().batch.students[i].grade.status = 'missing'; }, cleo);
  await p.waitForFunction(i => { const tr = [...document.querySelectorAll('.gs-tbl tbody tr')].find(r => r.querySelector('td.n') && r.querySelector('td.n').textContent === String(i + 1)); return tr && tr.querySelector('[data-rd="1"]'); }, { timeout: 30000 }, cleo);
  const useIt = i => p.evaluate(i => { const tr = [...document.querySelectorAll('.gs-tbl tbody tr')].find(r => r.querySelector('td.n') && r.querySelector('td.n').textContent === String(i + 1)); const b = tr && tr.querySelector('[data-rd="1"]'); if (b) b.click(); return tr ? (b ? 'ok' : tr.textContent.slice(0, 300)) : 'no row'; }, i);
  const said = await useIt(cleo);
  assert.equal(said, 'ok', 'Cleo’s row: ' + said);
  await toastSays(p, /No longer marked Missing/);
  assert.equal(await p.evaluate(i => window.__mark.state().batch.students[i].grade.status, cleo), '');
  assert.deepEqual(errors, []);
  await ctx.close();
});
