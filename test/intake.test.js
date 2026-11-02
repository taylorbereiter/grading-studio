// Bringing files in: phone photos, mixed files, plain words for what won't open, late work, and the one summary after a download opens. All made-up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { unzipSync, strToU8 } = require('fflate');
const { launch } = require('./helpers/chrome');
const { builtHtml, openApp, openZip, waitPaper, goToStudent, setTool, drag, settle, catchDownloads, probePdf, answerDlg } = require('./helpers/app');
const { makePaper, makeDocx, zipOf } = require('./helpers/fixtures');

const FX = n => new Uint8Array(fs.readFileSync(path.join(__dirname, 'fixtures', 'intake', n)));
// A JPEG with EXIF orientation written into it, the way a phone leaves it.
function exifJpeg(o, littleEndian) {
  const jpg = FX('photo.jpg'), u16 = v => littleEndian ? [v & 255, v >> 8] : [v >> 8, v & 255], u32 = v => littleEndian ? [v & 255, 0, 0, 0] : [0, 0, 0, v & 255];
  const tiff = [...(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8), ...u16(1), ...u16(0x112), ...u16(3), ...u32(1), ...u16(o), 0, 0, ...u32(0)];
  const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff], len = body.length + 2;
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...body, ...jpg.subarray(2)]);
}
let browser, paper;
before(async () => { browser = await launch(); paper = await makePaper({ title: 'Good paper' }); });
after(async () => { await browser.close(); });

// The color at a spot of page k on screen, with x and y as parts of its width and height.
const colorAt = (page, k, fx, fy) => page.evaluate((k, fx, fy) => {
  const pg = window.__gs.state().pages[k], s = pg.canvas.width / (pg.W + pg.side), d = pg.canvas.getContext('2d').getImageData(Math.round(pg.W * s * fx), Math.round(pg.H * s * fy), 1, 1).data;
  return d[0] > 150 && d[2] < 110 ? 'red' : d[2] > 150 && d[0] < 110 ? 'blue' : 'other ' + [...d];
}, k, fx, fy);
const pageSize = (page, k = 0) => page.evaluate(k => { const p = window.__gs.state().pages[k]; return { W: p.W, H: p.H }; }, k);
const checked = page => page.evaluate(() => window.__gs.checkStack(window.__gs.state().batch));
const facts = async page => { await checked(page); return page.evaluate(() => window.__gs.openingFacts()); };
const openBar = page => page.waitForFunction(() => { const b = document.querySelector('#openRep'); return b && !b.hidden; }, { timeout: 30000 }).then(() => page.$eval('#openRep', e => e.textContent));
const barHidden = async page => { await checked(page); await new Promise(r => setTimeout(r, 400)); return page.$eval('#openRep', e => e.hidden); };
const cardText = async (page, i) => { await goToStudent(page, i); await page.waitForFunction(() => !!document.querySelector('#paper .nofile, #paper .media, #paper .docx'), { timeout: 15000 }); return page.$eval('#paper', e => e.textContent); };
const stuIndex = (page, key) => page.evaluate(key => window.__gs.state().batch.students.findIndex(s => s.key === key), key);
const tmpPick = (name, bytes) => { const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gs-intake-')), f = path.join(dir, name); fs.writeFileSync(f, bytes); return f; };
// Files as she'd pick them, handed to Bring in files.
const bring = (page, files) => page.evaluate(async (files) => {
  const list = files.map(([p, b]) => { const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return { path: p, file: new File([u], p.split('/').pop()) }; });
  await window.__gs.bringIn(list);
}, files.map(([p, b]) => [p, Buffer.from(b).toString('base64')]));

/* ---------------- phone photos ---------------- */
test('A sideways phone photo opens the right way up, and the turn holds through marking, reopening and export', async () => {
  const { page, close } = await openApp(browser);
  const dl = await catchDownloads(page);
  const zip = zipOf({ 'Aria Testwell/IMG_0001.JPG': exifJpeg(6) });
  await openZip(page, zip);
  const sz = await pageSize(page);
  assert.ok(sz.H > sz.W, 'stands tall, as the camera said it should');
  assert.equal(await colorAt(page, 0, 0.75, 0.5), 'red', 'the top of the picture has turned to the right');
  assert.equal(await colorAt(page, 0, 0.25, 0.5), 'blue');
  await setTool(page, 'pen'); await drag(page, 0, [[60, 100], [120, 180]]);
  await settle(page);
  const marksBefore = await page.evaluate(() => JSON.stringify(window.__gs.state().batch.students[0].files[0].marks));
  await page.reload(); await page.waitForFunction(() => !!(window.__gs && window.__gs.state));
  await openZip(page, zip);
  const after = await page.evaluate(() => { const f = window.__gs.state().batch.students[0].files[0]; return { rot: f.rot, marks: JSON.stringify(f.marks) }; });
  assert.deepEqual(after.rot, { 0: 90 }); assert.equal(after.marks, marksBefore, 'her marks sit where she put them');
  assert.ok((await pageSize(page)).H > (await pageSize(page)).W);
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  const un = unzipSync(got.bytes), out = Object.entries(un).find(([k]) => k.startsWith('Aria Testwell/'))[1];
  const p = await probePdf(page, out, 1, [[60, 100, 60, 80]]);
  assert.ok(p.H > p.W, 'it comes out standing tall: ' + p.W + ' by ' + p.H); assert.ok(p.ink[0].red > 5, 'the mark is on it');
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});
test('Every turn a phone can ask for is read from the photo, in either byte order, and a plain JPEG is left alone', async () => {
  const { page, close } = await openApp(browser);
  const read = bytes => page.evaluate(b => { const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return window.__gs.jpegTurn(u); }, Buffer.from(bytes).toString('base64'));
  for (const [o, want] of [[1, 0], [3, 180], [6, 90], [8, 270]]) for (const le of [false, true]) assert.equal(await read(exifJpeg(o, le)), want, 'orientation ' + o);
  assert.equal(await read(FX('photo.jpg')), 0);
  assert.equal(await read(FX('photo.jpg').subarray(0, 12)), 0, 'a cut-off photo says nothing and doesn’t throw');
  await close();
});
test('Old work on a sideways photo stays as it was: its marks were drawn on it that way', async () => {
  const { page, close } = await openApp(browser);
  const zipFiles = { 'Aria Testwell/IMG_0001.JPG': exifJpeg(6), 'Bram Sample/Essay.pdf': paper };
  const id = await page.evaluate(files => window.__gs.batchIdOf(Object.entries(files).map(([path, n]) => ({ path, data: new Uint8Array(n) }))), Object.fromEntries(Object.entries(zipFiles).map(([k, v]) => [k, v.length])));
  const mark = { type: 'pen', pts: [[20, 20], [100, 60]], color: '#d01f1f', width: 2 };
  await page.evaluate((id, mark) => localStorage.setItem(id, JSON.stringify({ t: Date.now(), cur: 0, setup: {}, s: { 'Aria Testwell': { f: { 'Aria Testwell/IMG_0001.JPG': { 0: [mark] } }, g: { rubric: [], points: '', comment: '' }, h: {} } } })), id, mark);
  await page.reload(); await page.waitForFunction(() => !!(window.__gs && window.__gs.state));
  await openZip(page, zipOf(zipFiles));
  const sz = await pageSize(page);
  assert.ok(sz.W > sz.H, 'still sideways, as she marked it');
  const f = await page.evaluate(() => { const f = window.__gs.state().batch.students[0].files[0]; return { rot: f.rot || null, n: f.marks[0].length }; });
  assert.equal(f.rot, null); assert.equal(f.n, 1);
  await settle(page);
  await page.reload(); await page.waitForFunction(() => !!(window.__gs && window.__gs.state));
  await openZip(page, zipOf(zipFiles));
  const again = await pageSize(page);
  assert.ok(again.W > again.H, 'and it stays so after the next save and reopen');
  assert.deepEqual(page.errors, []);
  await close();
});
test('An untouched photo isn’t saved as work, and a photo she turned back stays turned back', async () => {
  const { page, close } = await openApp(browser);
  const files = { 'Aria Testwell/IMG_0001.JPG': exifJpeg(6), 'Bram Sample/Essay.pdf': paper };
  await openZip(page, zipOf(files));
  await page.evaluate(() => window.__gs.saveNow());
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  assert.deepEqual(await page.evaluate(id => JSON.parse(localStorage.getItem(id)).s, id), {}, 'opening a photo is not work');
  // She turns it the rest of the way back to how the camera left it.
  for (let i = 0; i < 3; i++) await page.evaluate(() => document.querySelector('[data-rotdoc]').click());
  await page.waitForFunction(() => { const p = window.__gs.state().pages[0]; return p.W > p.H; });
  await settle(page);
  await page.reload(); await page.waitForFunction(() => !!(window.__gs && window.__gs.state));
  await openZip(page, zipOf(files));
  const sz = await pageSize(page);
  assert.ok(sz.W > sz.H, 'it stays how she left it');
  await close();
});
test('A photo added to a student later opens the right way up too', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Bram Sample/Essay.pdf': paper }));
  await bring(page, [['Bram Sample photo.jpg', exifJpeg(8)]]);
  await page.waitForSelector('#dlgBox [data-go]');
  await page.click('#dlgBox [data-go]');
  await page.waitForFunction(() => window.__gs.state().batch.students[1].files.length === 2);
  const rot = await page.evaluate(() => window.__gs.state().batch.students[1].files[1].rot);
  assert.deepEqual(rot, { 0: 270 });
  await close();
});

/* ---------------- iPhone HEIC ---------------- */
test('An iPhone HEIC opens as a page, the right way up, with nothing fetched, and a mark on it exports', async () => {
  const { page, close, srv } = await openApp(browser);
  const asked = []; page.on('request', r => { if (!r.url().startsWith(srv.url) && !/^(blob|data):/.test(r.url())) asked.push(r.url()); });
  const dl = await catchDownloads(page);
  const zip = zipOf({ 'Aria Testwell/IMG_0002.HEIC': FX('photo.heic'), 'Bram Sample/plain.heic': FX('plain.heic'), 'Cleo Fixture/named wrong.jpg': FX('plain.heic') });
  await openZip(page, zip);
  const sz = await pageSize(page);
  assert.equal(Math.round(sz.W / sz.H), 2, 'wide, as the photo was held');
  assert.equal(await colorAt(page, 0, 0.5, 0.2), 'red'); assert.equal(await colorAt(page, 0, 0.5, 0.8), 'blue');
  for (const i of [1, 2]) { await goToStudent(page, i); await page.waitForFunction(() => window.__gs.state().pages.length > 0 && window.__gs.state().pages[0].s > 0); assert.equal(await colorAt(page, 0, 0.5, 0.2), 'red', 'student ' + i); }
  await goToStudent(page, 0);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 40], [300, 120]]);
  await settle(page);
  await page.click('#exportBtn');
  await page.waitForSelector('#dlgBox [data-go="zip"]', { timeout: 60000 });
  const got = await dl.next(() => page.click('#dlgBox [data-go="zip"]'));
  const un = unzipSync(got.bytes), name = Object.keys(un).find(k => k.startsWith('Aria Testwell/'));
  assert.ok(name, 'it’s in the export');
  assert.equal(new TextDecoder().decode(un[name].subarray(0, 5)), '%PDF-');
  assert.deepEqual(asked, [], 'nothing left the computer');
  assert.deepEqual(page.errors, []);
  await dl.close(); await close();
});
test('From a double-clicked copy (file://) the iPhone decoder still works', async () => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gs-file-')), p = path.join(dir, 'Grading Studio.html');
  fs.writeFileSync(p, builtHtml());
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage();
  await page.goto('file:///' + p.replace(/\\/g, '/'));
  await page.waitForFunction(() => !!(window.__gs && window.__gs.state), { timeout: 60000 });
  const f = tmpPick('Download.zip', zipOf({ 'Aria Testwell/IMG_0002.HEIC': FX('photo.heic') }));
  await (await page.$('#fileIn')).uploadFile(f);
  await waitPaper(page);
  assert.equal(await colorAt(page, 0, 0.5, 0.2), 'red');
  await ctx.close(); fs.rmSync(dir, { recursive: true, force: true });
});
test('A hand-made page order from before an iPhone photo could open still shows the photo', async () => {
  const { page, close } = await openApp(browser);
  const files = { 'Aria Testwell/Essay.pdf': paper, 'Aria Testwell/IMG_1.heic': FX('plain.heic'), 'Bram Sample/Essay.pdf': paper };
  const id = await page.evaluate(files => window.__gs.batchIdOf(Object.entries(files).map(([path, n]) => ({ path, data: new Uint8Array(n) }))), Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length])));
  await page.evaluate(id => localStorage.setItem(id, JSON.stringify({ t: Date.now(), cur: 0, setup: {}, s: { 'Aria Testwell': { f: {}, g: { rubric: [], points: '', comment: '' }, h: {}, L: [{ name: 'Essay.pdf', file: 'Aria Testwell/Essay.pdf', pages: [['Aria Testwell/Essay.pdf', 0]] }] } } })), id);
  await page.reload(); await page.waitForFunction(() => !!(window.__gs && window.__gs.state));
  await openZip(page, zipOf(files));
  await page.waitForFunction(() => window.__gs.state().pages.length === 2 && window.__gs.state().pages[1].s > 0, { timeout: 20000 });
  assert.deepEqual(await page.evaluate(() => window.__gs.state().pages.map(p => p.file.name)), ['Essay.pdf', 'IMG_1.heic']);
  await close();
});
test('A HEIC that can’t be read, and a copy with no decoder, get a plain explanation and a next step', async () => {
  const noLib = builtHtml().replace(/(<script type="text\/plain" id="heicSrc">)[\s\S]*?(<\/script>)/, '$1$2');
  for (const [html, bytes, why] of [[undefined, Uint8Array.from([...FX('photo.heic').subarray(0, 40), 1, 2, 3]), 'damaged file'], [noLib, FX('photo.heic'), 'no decoder']]) {
    const { page, close } = await openApp(browser, { html, platform: 'mac' });
    await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Bram Sample/IMG_1.heic': bytes }));
    const t = await cardText(page, 1);
    assert.match(t, /iPhone photo that couldn’t be read/, why);
    assert.match(t, /Preview.*Export.*JPEG/, 'says what to do, the Mac way: ' + why);
    assert.ok(await page.$('#paper [data-odl]'), 'and she can download it');
    await close();
  }
  const { page, close } = await openApp(browser, { html: noLib, platform: 'win' });
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Bram Sample/IMG_1.heic': FX('photo.heic') }));
  assert.match(await cardText(page, 1), /Photos app/, 'and the Windows way');
  await close();
});

/* ---------------- files that can't open ---------------- */
const OLE = () => { const u = new Uint8Array(1024); u.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); return u; };
test('Everything that can’t open says why, in plain words, with a next step, and never quotes an error', async () => {
  const { page, close } = await openApp(browser);
  const CASES = [
    ['old.doc', OLE(), /older Word file/, /save it as \.docx or PDF/],
    ['locked.pdf', FX('locked.pdf'), /locked with a password/, /copy with no password/],
    ['damaged.pdf', strToU8('%PDF-1.7 this is not really a pdf at all'), /damaged, or it didn’t finish uploading/, /turn it in again/],
    ['signin.pdf', strToU8('<!DOCTYPE html><html><body>Sign in</body></html>'), /inside it’s a web page/, /turn it in again/],
    ['empty.pdf', new Uint8Array(0), /file is empty/, /turn it in again/],
    ['empty.docx', new Uint8Array(0), /file is empty/, /turn it in again/],
    ['locked.docx', OLE(), /Word file is locked with a password/, /copy with no password/],
    ['broken.docx', strToU8('PK\x03\x04 not a real word file at all, cut off'), /Word file is damaged/, /opening it in Word/],
    ['bad.jpg', strToU8('this is no picture'), /picture couldn’t be read/, /turn it in again/],
    ['essay.odt', strToU8('PK\x03\x04odt'), /OpenDocument/, /save it as \.docx or PDF/],
    ['essay.pages', strToU8('PK\x03\x04pages'), /Pages file/, /PDF or Word/],
    ['essay.gdoc', strToU8('{"url":"https://docs.google.com/document/d/made-up"}'), /only a shortcut to a Google file/, /download it from Google/],
    ['essay.html', strToU8('<!doctype html><html><body>My essay</body></html>'), /saved web page/, /Save as PDF/],
    ['scan.tiff', strToU8('II*\0not much here'), /TIFF/, /JPG or PDF/],
    ['talk.wma', strToU8('not a real recording'), /recording of a kind Chrome can’t play/, /mp4/],
    ['packed.rar', strToU8('Rar!'), /can’t unpack/, /unpack it/],
    ['odd.xyz', strToU8('who knows'), /kind of file can’t be shown here/, /PDF or Word/],
  ];
  const zf = { 'Aaa Good/Essay.pdf': paper };
  CASES.forEach(([n, b], k) => { zf['Stu' + String(k).padStart(2, '0') + ' Case/' + n] = b; });
  await openZip(page, zipOf(zf));
  for (let k = 0; k < CASES.length; k++) {
    const [n, , why, next] = CASES[k];
    const t = await cardText(page, k + 1);
    assert.ok(t.includes(n), n + ' is named');
    assert.match(t, why, n); assert.match(t, next, n);
    assert.doesNotMatch(t, /Exception|Error|undefined|null/, n + ' has no error text');
    if (n !== 'empty.pdf' && n !== 'empty.docx') assert.ok(await page.$('#paper [data-odl], #paper [data-wdl]'), n + ' can be downloaded');
  }
  const x = await facts(page);
  assert.equal(x.cant.length, CASES.length, 'the report has each one: ' + x.cant.map(c => c.shown)); assert.equal(x.ok, 1);
  assert.deepEqual(page.errors, []);
  await close();
});
test('A PDF locked only against changes still opens, and a page that can’t be read doesn’t stop the rest', async () => {
  const { page, close } = await openApp(browser);
  // Page 2 of this one points at an object that doesn't exist.
  const pdf = strToU8(['%PDF-1.4', '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj', '2 0 obj<</Type/Pages/Kids[3 0 R 9 0 R 4 0 R]/Count 3>>endobj', '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj', '4 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj', 'trailer<</Root 1 0 R>>', ''].join('\n'));
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Bram Sample/owner.pdf': FX('owner-locked.pdf'), 'Cleo Fixture/hole.pdf': pdf, 'Cleo Fixture/z other.pdf': paper }));
  await goToStudent(page, 1);
  assert.equal(await page.evaluate(() => window.__gs.state().pages.length), 1, 'it opens with no password');
  const x = await facts(page);
  assert.equal(x.cant.length, 0, 'neither counts as not opening: ' + JSON.stringify(x.cant));
  await page.evaluate(() => window.__gs.openStudent(2));
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.cur === 2 && s.pages.some(p => p.file.name === 'z other.pdf' && p.s > 0); }, { timeout: 20000 });
  assert.match(await page.$eval('#paper', e => e.textContent), /Page 2 of hole\.pdf couldn’t be read/);
  const y = await facts(page);
  assert.ok(y.odd.some(o => /page 2/.test(o.note)), 'and the report says so: ' + JSON.stringify(y.odd));
  assert.deepEqual(page.errors, []);
  await close();
});

/* ---------------- damaged pictures, and pages she took out ---------------- */
// A picture big enough to be cut, drawn by the browser: noise, so there's lots in it.
const noisy = async (page, type) => new Uint8Array(Buffer.from(await page.evaluate(async type => {
  const c = document.createElement('canvas'); c.width = 500; c.height = 700;
  const x = c.getContext('2d'), d = x.createImageData(500, 700);
  for (let i = 0; i < d.data.length; i++) d.data[i] = i % 4 === 3 ? 255 : (i * 2654435761 >>> 7) & 255;
  x.putImageData(d, 0, 0);
  return c.toDataURL(type, 0.9).split(',')[1];
}, type), 'base64'));
const scrambled = u => { const o = u.slice(); for (let i = 2000; i < o.length; i += 7) o[i] = (o[i] * 31 + 17) & 255; return o; };
test('A cut-off or scrambled picture gets a plain explanation and a next step, and never a gray page or a freeze', async () => {
  const { page, close } = await openApp(browser);
  const jpg = await noisy(page, 'image/jpeg'), png = await noisy(page, 'image/png'), webp = await noisy(page, 'image/webp');
  const CASES = { 'Bad01 Case/cut.jpg': jpg.subarray(0, jpg.length >> 2), 'Bad02 Case/tiny.jpg': jpg.subarray(0, 700), 'Bad03 Case/mixed.jpg': scrambled(jpg), 'Bad04 Case/nearly.jpg': jpg.subarray(0, jpg.length - 40), 'Bad05 Case/cut.png': png.subarray(0, png.length >> 2), 'Bad06 Case/tiny.png': png.subarray(0, 700), 'Bad07 Case/mixed.png': scrambled(png), 'Bad08 Case/cut.webp': webp.subarray(0, webp.length >> 2), 'Bad09 Case/cut with a wrong name.pdf': jpg.subarray(0, jpg.length >> 2) };
  await openZip(page, zipOf({ 'Aaa Good/whole.jpg': jpg, 'Aab Good/whole.png': png, ...CASES }));
  assert.match(await openBar(page), /2 of 11 files opened\. 9 couldn’t\./);
  const x = await facts(page);
  assert.equal(x.cant.length, 9, JSON.stringify(x.cant.map(c => c.shown)));
  for (const c of x.cant) { assert.match(c.why, /picture couldn’t be read/, c.shown); assert.match(c.next, /turn it in again/, c.shown); }
  for (let i = 2; i < 11; i++) {
    assert.match(await cardText(page, i), /picture couldn’t be read/);
    assert.equal(await page.evaluate(() => window.__gs.state().pages.length), 0, 'no gray page');
    assert.ok(await page.$('#paper [data-odl]'), 'and she can download it');
  }
  const back = await page.evaluate(() => { const f = window.__gs.state().batch.students[2].files[0]; return [f.kind, f.data.length, f.data[0], f.data[1]]; });
  assert.deepEqual(back, ['other', jpg.length >> 2, 0xff, 0xd8], 'the download is the bytes as they came');
  await goToStudent(page, 0);
  assert.equal(await page.evaluate(() => window.__gs.state().pages.length), 1, 'the whole one still opens');
  assert.deepEqual(page.errors, []);
  await close();
});
test('A cut-off PNG chosen as a rubric page says it couldn’t be opened, and doesn’t freeze the app', async () => {
  const { page, close } = await openApp(browser);
  const png = await noisy(page, 'image/png');
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper }));
  await page.click('#moreBtn'); await page.click('#setupBtn');
  await page.waitForSelector('#rpIn');
  await (await page.$('#rpIn')).uploadFile(tmpPick('rubric.png', png.subarray(0, 700)));
  await page.waitForFunction(() => /couldn’t be opened as a Word file, PDF or picture/.test(document.querySelector('.toast').textContent), { timeout: 15000 });
  await close();
});
test('Marks already on a damaged picture stay on its page, and the report says it looks damaged', async () => {
  const { page, close } = await openApp(browser);
  const jpg = await noisy(page, 'image/jpeg');
  const files = { 'Aria Testwell/cut.jpg': jpg.subarray(0, jpg.length >> 1), 'Bram Sample/Essay.pdf': paper };
  const id = await page.evaluate(files => window.__gs.batchIdOf(Object.entries(files).map(([path, n]) => ({ path, data: new Uint8Array(n) }))), Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length])));
  const mark = { type: 'pen', pts: [[20, 20], [100, 60]], color: '#d01f1f', width: 2 };
  await page.evaluate((id, mark) => localStorage.setItem(id, JSON.stringify({ t: Date.now(), cur: 0, setup: {}, s: { 'Aria Testwell': { f: { 'Aria Testwell/cut.jpg': { 0: [mark] } }, g: { rubric: [], points: '', comment: '' }, h: {} } } })), id, mark);
  await page.reload(); await page.waitForFunction(() => !!(window.__gs && window.__gs.state));
  await openZip(page, zipOf(files));
  const got = await page.evaluate(() => { const s = window.__gs.state(), f = s.batch.students[0].files[0]; return { kind: f.kind, n: f.marks[0].length, pages: s.pages.length }; });
  assert.deepEqual(got, { kind: 'img', n: 1, pages: 1 });
  const x = await facts(page);
  assert.equal(x.cant.length, 0);
  assert.ok(x.odd.some(o => /cut\.jpg looks damaged or cut off/.test(o.note)), JSON.stringify(x.odd));
  assert.deepEqual(page.errors, []);
  await close();
});
test('A page she took out of an iPhone photo or a misnamed picture stays out after reopening', async () => {
  const { page, close } = await openApp(browser);
  const png = await noisy(page, 'image/png');
  const files = { 'Aria Testwell/Essay.pdf': paper, 'Aria Testwell/IMG_1.heic': FX('plain.heic'), 'Bram Sample/Essay.pdf': paper, 'Bram Sample/really a png.jpg': png };
  await openZip(page, zipOf(files));
  for (const i of [0, 1]) {
    await goToStudent(page, i);
    await page.waitForFunction(() => window.__gs.state().pages.length === 2 && window.__gs.state().pages[1].s > 0, { timeout: 20000 });
    await page.click('#arrangeBtn');
    await page.waitForSelector('#dlgBox [data-save]');
    await page.waitForFunction(() => document.querySelectorAll('#dlgBox .ath [data-rm]').length === 2, { timeout: 20000 });
    await page.evaluate(() => { const r = [...document.querySelectorAll('#dlgBox .ath [data-rm]')]; r[r.length - 1].click(); });
    await page.waitForFunction(() => document.querySelectorAll('#dlgBox .ath [data-rm]').length === 1);
    await page.click('#dlgBox [data-save]');
  }
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.students.map(s => s.layout.flatMap(d => d.pages.map(p => p[0])))), [['Aria Testwell/Essay.pdf'], ['Bram Sample/Essay.pdf']]);
  await settle(page);
  await page.reload(); await page.waitForFunction(() => !!(window.__gs && window.__gs.state));
  await openZip(page, zipOf(files));
  for (const i of [0, 1]) {
    await goToStudent(page, i);
    await page.waitForFunction(() => window.__gs.state().pages.length > 0 && window.__gs.state().pages[0].s > 0, { timeout: 20000 });
    assert.deepEqual(await page.evaluate(() => window.__gs.state().pages.map(p => p.file.name)), ['Essay.pdf'], 'student ' + i);
    assert.deepEqual(await page.evaluate(i => window.__gs.layoutOf(window.__gs.state().batch.students[i]).flatMap(d => d.pages.map(p => p[0].split('/').pop())), i), ['Essay.pdf'], 'so it won’t go into the export either');
  }
  assert.deepEqual(page.errors, []);
  await close();
});
test('Name covers already drawn on a sideways photo stay on what they cover: the photo stays as it was', async () => {
  const { page, close } = await openApp(browser);
  const files = { 'Aria Testwell/IMG_0001.JPG': exifJpeg(6), 'Bram Sample/Essay.pdf': paper };
  const id = await page.evaluate(files => window.__gs.batchIdOf(Object.entries(files).map(([path, n]) => ({ path, data: new Uint8Array(n) }))), Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length])));
  await page.evaluate(id => localStorage.setItem(id, JSON.stringify({ t: Date.now(), cur: 0, setup: {}, s: {}, share: { codes: {}, boxes: { 'Aria Testwell/IMG_0001.JPG|0': [[0.02, 0.02, 0.45, 0.2]] } } })), id);
  await page.reload(); await page.waitForFunction(() => !!(window.__gs && window.__gs.state));
  await openZip(page, zipOf(files));
  const sz = await pageSize(page);
  assert.ok(sz.W > sz.H, 'still sideways, as the cover was drawn');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[0].files[0].rot || null), null);
  await page.evaluate(() => window.__gs.saveNow());
  await page.reload(); await page.waitForFunction(() => !!(window.__gs && window.__gs.state));
  await openZip(page, zipOf(files));
  const again = await pageSize(page);
  assert.ok(again.W > again.H, 'and it stays so after the next save');
  assert.deepEqual(page.errors, []);
  await close();
});
test('A name cover drawn on a photo after it turned keeps the turn, so the cover stays where she put it', async () => {
  const { page, close } = await openApp(browser);
  const files = { 'Aria Testwell/IMG_0001.JPG': exifJpeg(6), 'Bram Sample/Essay.pdf': paper };
  await openZip(page, zipOf(files));
  await page.evaluate(() => { const b = window.__gs.state().batch; b.share ||= { codes: {}, boxes: {} }; b.share.boxes['Aria Testwell/IMG_0001.JPG|0'] = [[0.02, 0.02, 0.45, 0.2]]; return window.__gs.saveNow(); });
  await page.reload(); await page.waitForFunction(() => !!(window.__gs && window.__gs.state));
  await openZip(page, zipOf(files));
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.students[0].files[0].rot), { 0: 90 });
  const sz = await pageSize(page);
  assert.ok(sz.H > sz.W);
  await close();
});
test('During anonymous grading, a name in a file’s name is hidden on every card, not only on papers', async () => {
  const { page, close } = await openApp(browser);
  const hole = strToU8(['%PDF-1.4', '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj', '2 0 obj<</Type/Pages/Kids[3 0 R 9 0 R]/Count 2>>endobj', '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj', 'trailer<</Root 1 0 R>>', ''].join('\n'));
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Bram Sample/Bram Sample essay.doc': OLE(), 'Cleo Fixture/Cleo Fixture hole.pdf': hole, 'Dov Madeup/Dov Madeup talk.mp3': FX('tone.mp3'), 'Eva Example/Eva Example damaged.jpg': exifJpeg(1).subarray(0, 300) }));
  await page.evaluate(() => window.__gs.setAnon(true));
  for (const [key, secret, says] of [['Bram Sample', /Bram|Sample/, /(\[name\] )+essay\.doc/], ['Cleo Fixture', /Cleo|Fixture/, /Page 2 of (\[name\] )+hole\.pdf couldn’t be read/], ['Dov Madeup', /Dov|Madeup/, /(\[name\] )+talk\.mp3/], ['Eva Example', /Eva|Example/, /(\[name\] )+damaged\.jpg/]]) {
    const i = await stuIndex(page, key);
    await page.evaluate(i => window.__gs.openStudent(i), i);
    await page.waitForFunction(i => window.__gs.state().cur === i, {}, i);
    await page.waitForFunction(s => new RegExp(s).test(document.querySelector('#paper').textContent), { timeout: 15000 }, says.source);
    assert.doesNotMatch(await page.$eval('#paper', e => e.textContent), secret, key);
  }
  assert.deepEqual(page.errors, []);
  await close();
});

/* ---------------- mixed files that should open ---------------- */
test('A picture or Word file with the wrong name opens anyway, and a .doc that’s really RTF shows its words', async () => {
  const { page, close } = await openApp(browser);
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 20; c.height = 10; const x = c.getContext('2d'); x.fillStyle = '#d01e1e'; x.fillRect(0, 0, 20, 10); return c.toDataURL('image/png').split(',')[1]; });
  await openZip(page, zipOf({
    'Aria Testwell/Essay.pdf': paper,
    'Bram Sample/photo.jpg': new Uint8Array(Buffer.from(png, 'base64')),
    'Cleo Fixture/no ending': exifJpeg(1),
    'Dov Madeup/renamed.doc': makeDocx('Words from a Word file with an old name.'),
    'Eva Example/old.doc': strToU8('{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\f0 Words from an RTF called doc.\\par}'),
    'Fen Placeholder/picture.pdf': exifJpeg(1),
  }));
  const kinds = await page.evaluate(() => Object.fromEntries(window.__gs.state().batch.students.map(s => [s.key, s.files[0].kind])));
  assert.deepEqual(kinds, { 'Aria Testwell': 'pdf', 'Bram Sample': 'img', 'Cleo Fixture': 'img', 'Dov Madeup': 'docx', 'Eva Example': 'text', 'Fen Placeholder': 'img' });
  assert.match(await cardText(page, 3), /Words from a Word file with an old name/);
  const t = await cardText(page, 4);
  assert.match(t, /Words from an RTF called doc/); assert.doesNotMatch(t, /Arial/);
  const x = await facts(page);
  assert.equal(x.cant.length, 0, JSON.stringify(x.cant)); assert.equal(x.ok, 6);
  assert.deepEqual(page.errors, []);
  await close();
});
test('Google Docs exports: Word, RTF with its tables and odd characters, and text with or without a byte-order mark', async () => {
  const { page, close } = await openApp(browser);
  // The shape of an RTF from Google Docs: a long header, \uc0, and \u for anything past plain ASCII.
  const rtf = '{\\rtf1\\ansi\\ansicpg1252\\uc0\\stshfdbch0\\stshfloch0\\stshfhich0\\stshfbi0\\deff0\\adeff0{\\fonttbl{\\f0\\froman\\fcharset0\\fprq2 Times New Roman;}{\\f1\\fnil Arial;}}{\\colortbl;\\red0\\green0\\blue0;}{\\*\\generator Google Docs;}{\\stylesheet{\\s0 Normal;}}\\pard\\plain\\f1\\fs22 Jos\\u233 \\u8217 s essay\\par\\pard\\f1 Second line \\u8212  with a dash\\par}';
  const u16 = [0xff, 0xfe, ...Buffer.from('Wide notes é', 'utf16le')];
  await openZip(page, zipOf({
    'Aria Testwell/Essay.pdf': paper,
    'Bram Sample/From Google.docx': makeDocx('Words Google Docs wrote.'),
    'Cleo Fixture/From Google.rtf': strToU8(rtf),
    'Dov Madeup/From Google.txt': Uint8Array.from([0xef, 0xbb, 0xbf, ...strToU8('Notes from Google')]),
    'Eva Example/Notepad.txt': Uint8Array.from(u16),
    'Fen Placeholder/Old windows.txt': Uint8Array.from([...strToU8('caf'), 0xe9]),
  }));
  assert.match(await cardText(page, 1), /Words Google Docs wrote/);
  const r = await cardText(page, 2);
  assert.match(r, /José’s essay/); assert.match(r, /Second line — with a dash/);
  assert.doesNotMatch(r, /Times New Roman|Arial|Normal|Google Docs;|red0/);
  assert.match(await cardText(page, 3), /Notes from Google/);
  assert.match(await cardText(page, 4), /Wide notes é/);
  assert.match(await cardText(page, 5), /café/);
  assert.equal((await facts(page)).cant.length, 0);
  await close();
});
test('Recordings: phone audio and video are checked, one that won’t play says so with a next step, and a video with no picture is noticed', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({
    'Aria Testwell/Essay.pdf': paper,
    'Bram Sample/talk.mp3': FX('tone.mp3'),
    'Cleo Fixture/voice memo.m4a': FX('tone.m4a'),
    'Dov Madeup/clip.mp4': FX('clip.mp4'),
    'Eva Example/iphone.mov': FX('clip.mov'),
    'Fen Placeholder/sound.mov': FX('sound-only.mov'),
    'Gus Invented/broken.m4a': strToU8('this is not a recording, it only has the name'),
  }));
  const x = await facts(page);
  assert.deepEqual(x.cant.map(c => c.shown), ['broken.m4a']);
  assert.match(x.cant[0].why, /won’t play/); assert.match(x.cant[0].next, /mp4 or \.mp3/);
  assert.ok(x.odd.some(o => /sound\.mov plays only as sound/.test(o.note)), JSON.stringify(x.odd));
  assert.equal(x.odd.length, 1, JSON.stringify(x.odd));
  await goToStudent(page, 6);
  await page.waitForFunction(() => /won’t play/.test(document.querySelector('#paper .trstat')?.textContent || ''), { timeout: 15000 });
  assert.ok(await page.$('#paper [data-mdl]'), 'with a way to download it');
  await goToStudent(page, 5);
  await page.waitForFunction(() => /Only the sound/.test(document.querySelector('#paper .trstat')?.textContent || ''), { timeout: 15000 });
  await goToStudent(page, 3);
  await page.waitForFunction(() => { const v = document.querySelector('#paper video'); return v && v.videoWidth > 0; }, { timeout: 15000 });
  assert.equal(await page.$eval('#paper .trstat', e => e.textContent), '', 'a video that plays says nothing');
  assert.deepEqual(page.errors, []);
  await close();
});

/* ---------------- the opening report ---------------- */
test('When everything opens, nothing is said; What opened still answers if she asks', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Bram Sample/Essay.docx': makeDocx('Fine'), 'Cleo Fixture/photo.jpg': exifJpeg(1) }));
  assert.equal(await barHidden(page), true);
  assert.equal(await page.$('#dlgBox h2'), null, 'no box either');
  await page.click('#moreBtn'); await page.click('#openRepBtn');
  await page.waitForSelector('#openRepBox');
  assert.match(await page.$eval('#openRepBox', e => e.textContent), /Everything opened: 3 files for 3 students/);
  await close();
});
test('A messy stack gets one summary: what opened, what didn’t, who has nothing, and what’s odd. Seen once, it doesn’t come back', async () => {
  const { page, close } = await openApp(browser);
  await page.evaluate(() => { const G = window.__gs; G.state().lib.classes.push({ id: 'c1', name: 'Period 1', names: ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup', 'Zed Nopaper'], units: [] }); });
  const twin = await makePaper({ title: 'The same paper' });
  const zf = { 'Aria Testwell/Essay.pdf': twin, 'Bram Sample/Essay.pdf': twin, 'Cleo Fixture/old.doc': OLE(), 'Dov Madeup/Bram Sample essay.pdf': paper, 'Una Stranger/Essay.pdf': await makePaper({ title: 'Someone else' }) };
  await openZip(page, zipOf(zf));
  const head = await openBar(page);
  assert.match(head, /4 of 5 files opened\. 1 couldn’t\. 1 student has nothing turned in\. 3 things look odd\./);
  const moved = await page.evaluate(() => { const top = () => document.querySelector('#paper').getBoundingClientRect().top, b = document.querySelector('#openRep'), was = top(); b.hidden = true; b.style.display = ''; const now = top(); b.hidden = false; b.style.display = 'flex'; return now - was; });
  assert.equal(moved, 0, 'it floats, so the paper doesn’t jump while she’s drawing');
  await page.click('#openRep [data-rep]');
  await page.waitForSelector('#openRepBox');
  const t = await page.$eval('#openRepBox', e => e.textContent);
  assert.match(t, /Couldn’t open \(1\)/); assert.match(t, /older Word file/); assert.match(t, /Cleo Fixture/); assert.match(t, /old\.doc/);
  assert.match(t, /Nothing turned in \(1\)/); assert.match(t, /Zed Nopaper/);
  assert.match(t, /Una Stranger isn’t on the Period 1 roster/);
  assert.match(t, /Aria Testwell turned in the very same file as Bram Sample/);
  assert.match(t, /Dov Madeup Bram Sample essay\.pdf has a name that looks like another student’s/);
  // Its names go to the student.
  await page.evaluate(() => [...document.querySelectorAll('#openRepBox [data-repgo]')].find(b => b.textContent === 'Zed Nopaper').click());
  await page.waitForFunction(() => { const s = window.__gs.state(); return s.batch.students[s.cur].key === 'Zed Nopaper'; });
  assert.equal(await page.$eval('#openRep', e => e.hidden), true, 'the bar has gone');
  // Dropped again: nothing new to say.
  await goToStudent(page, 0);
  await settle(page);
  await page.reload(); await page.waitForFunction(() => !!(window.__gs && window.__gs.state));
  await page.evaluate(() => { const G = window.__gs; if (!G.state().lib.classes.some(c => c.id === 'c1')) G.state().lib.classes.push({ id: 'c1', name: 'Period 1', names: ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup', 'Zed Nopaper'], units: [] }); });
  await openZip(page, zipOf(zf));
  assert.equal(await barHidden(page), true);
  assert.deepEqual(page.errors, []);
  await close();
});
test('During anonymous grading the report has no names and no file names', async () => {
  const { page, close } = await openApp(browser);
  const twin = await makePaper({ title: 'Twin' });
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Bram Sample/Bram essay.doc': OLE(), 'Cleo Fixture/Essay.pdf': twin, 'Dov Madeup/Essay.pdf': twin, 'Eva Example/Bram Sample notes.pdf': paper, 'Fen Placeholder/talk.mov': FX('sound-only.mov') }));
  await page.evaluate(() => window.__gs.setAnon(true));
  await page.evaluate(() => window.__gs.openRep());
  await page.waitForSelector('#openRepBox');
  const t = await page.$eval('#openRepBox', e => e.textContent);
  for (const secret of ['Aria', 'Bram', 'Cleo', 'Dov', 'Eva', 'Fen', 'Testwell', 'Sample', 'Bram essay', '.doc ', 'talk.mov', 'notes.pdf']) assert.ok(!t.includes(secret), secret + ' isn’t in: ' + t);
  assert.match(t, /Paper \d/); assert.match(t, /older Word file/); assert.match(t, /very same file as Paper \d/); assert.match(t, /A video plays only as sound/);
  const bar = await page.evaluate(() => { const G = window.__gs; return G.openingReport().then(() => document.querySelector('#openRep').textContent); });
  for (const secret of ['Aria', 'Bram', 'Testwell', 'Essay']) assert.ok(!bar.includes(secret), secret);
  assert.deepEqual(page.errors, []);
  await close();
});
test('A ZIP with a bad entry is told in the report, not lost in a toast, and the words fit this computer', async () => {
  const { page, close } = await openApp(browser, { platform: 'win' });
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Bram Sample/packed.zip': strToU8('PK\x03\x04 broken zip, cut off here') }));
  const x = await facts(page);
  assert.deepEqual(x.cant.map(c => c.shown), ['packed.zip']);
  assert.match(x.cant[0].why, /ZIP couldn’t be opened/);
  await close();
  const b = await openApp(browser, { platform: 'win' });
  const says = await b.page.evaluate(() => window.__gs.intake([{ path: 'whole.zip', data: new TextEncoder().encode('PK\x03\x04 broken') }], 'x').then(() => document.querySelector('.toast').textContent));
  assert.match(says, /Extract All/); assert.doesNotMatch(says, /Finder/);
  await b.close();
  // Files in a ZIP packed in a way a browser can't open are counted in the report, with no name during anonymous grading.
  const c = await openApp(browser, { platform: 'mac' });
  const packed = zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Bram Sample/Essay.pdf': paper, 'Cleo Fixture/odd.pdf': paper });
  let at = -1, k = 0;
  for (let i = 0; i + 4 < packed.length; i++) if (packed[i] === 0x50 && packed[i + 1] === 0x4b && packed[i + 2] === 1 && packed[i + 3] === 2 && ++k === 3) at = i;
  packed[at + 10] = 99;   // the last file's packing, in the ZIP's list of files
  await openZip(c.page, packed);
  assert.match(await openBar(c.page), /2 of 2 files opened\. 1 couldn’t\./);
  await c.page.click('#openRep [data-rep]');
  await c.page.waitForSelector('#openRepBox');
  assert.match(await c.page.$eval('#openRepBox', e => e.textContent), /1 file in the ZIP is packed in a way a browser can’t open\. Double-click it in Finder/);
  await c.close();
});

/* ---------------- late work ---------------- */
test('Late work: the whole new download goes through Bring in files, only what’s new is left to place, and only who she ticks goes late', async () => {
  const { page, close } = await openApp(browser);
  const v1 = { 'Aria Testwell/Essay.pdf': await makePaper({ title: 'Aria' }), 'Bram Sample/Essay.pdf': await makePaper({ title: 'Bram' }), 'Cleo Fixture/photo.jpg': exifJpeg(6) };
  await page.evaluate(() => { window.__gs.state().lib.classes.push({ id: 'c1', name: 'P1', names: ['Aria Testwell', 'Bram Sample', 'Cleo Fixture', 'Dov Madeup', 'Eva Example'], units: [] }); });
  await openZip(page, zipOf(v1));
  await page.evaluate(() => window.__gs.setStatus(window.__gs.state().batch.students.find(s => s.key === 'Eva Example'), 'missing'));
  const dov = await makePaper({ title: 'Dov, late' }), eva = await makePaper({ title: 'Eva, late' });
  await bring(page, [...Object.entries(v1).map(([k, v]) => ['New download/' + k, v]), ['New download/Dov Madeup/Essay.pdf', dov], ['New download/Eva Example/Essay.pdf', eva]]);
  await page.waitForSelector('#dlgBox [data-go]');
  const box = await page.$eval('#dlgBox', e => e.textContent);
  assert.match(box, /3 files are already here, so they’re left out/);
  assert.equal(await page.$$eval('#dlgBox tbody tr', r => r.length), 2, 'only the two new files are left to place');
  assert.match(box, /Now marked missing/, 'it says so beside Eva');
  assert.match(await page.$eval('#dlgBox [data-go]', e => e.textContent), /Add 2 files/);
  assert.equal(await page.$$eval('#dlgBox [data-late]:checked', r => r.length), 0, 'nobody is late until she says');
  await page.click('#dlgBox [data-late="0"]');
  await page.click('#dlgBox [data-go]');
  await page.waitForFunction(() => window.__gs.state().batch.students.find(s => s.key === 'Eva Example').files.length === 1, { timeout: 30000 });
  const st = await page.evaluate(() => Object.fromEntries(window.__gs.state().batch.students.map(s => [s.key, { status: s.grade.status || '', at: !!s.grade.at, n: s.files.length, added: s.files.filter(f => f.added).length }])));
  assert.equal(st['Dov Madeup'].status, 'late'); assert.ok(st['Dov Madeup'].at, 'stamped like any change'); assert.equal(st['Dov Madeup'].added, 1);
  assert.equal(st['Eva Example'].status, 'missing', 'not ticked, so it isn’t changed for her');
  for (const k of ['Aria Testwell', 'Bram Sample', 'Cleo Fixture']) { assert.equal(st[k].status, '', k); assert.equal(st[k].n, 1, k + ' has no copy added'); }
  // It stays through a reopen.
  await settle(page);
  await page.reload(); await page.waitForFunction(() => !!(window.__gs && window.__gs.state));
  await openZip(page, zipOf(v1));
  const back = await page.evaluate(() => { const s = window.__gs.state().batch.students.find(s => s.key === 'Dov Madeup'); return { status: s.grade.status, n: s.files.length }; });
  assert.deepEqual(back, { status: 'late', n: 1 });
  // The same again: nothing new.
  await bring(page, [['New download/Dov Madeup/Essay.pdf', dov]]);
  await page.waitForFunction(() => /already here/.test(document.querySelector('.toast').textContent));
  assert.equal(await page.$('#dlgBox [data-go]'), null);
  assert.deepEqual(page.errors, []);
  await close();
});
test('Late work: the Late box up top ticks everyone, a file with a new version keeps both, and nobody new is made from a file', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Bram Sample/Essay.pdf': paper }));
  const fresh = await makePaper({ title: 'A second go' });
  await bring(page, [['x/Aria Testwell/Essay.pdf', fresh], ['x/Bram Sample/Late bit.pdf', fresh], ['x/Nia Newcomer/Essay.pdf', fresh]]);
  await page.waitForSelector('#dlgBox [data-go]');
  assert.match(await page.$eval('#dlgBox', e => e.textContent), /different file with this name\. Both stay/);
  assert.ok(!(await page.$$eval('#dlgBox select[data-row="2"] option', o => o.map(x => x.textContent))).some(t => /New student/.test(t)), 'no New student choice');
  assert.match(await page.$eval('#dlgBox [data-go]', e => e.textContent), /Add 2 files/, 'the unmatched file waits for a student');
  await page.click('#dlgBox [data-lateall]');
  assert.equal(await page.$$eval('#dlgBox [data-late]:checked', r => r.length), 3);
  await page.select('#dlgBox select[data-row="2"]', '1');   // it was Bram's after all
  await page.waitForFunction(() => /Add 3 files/.test(document.querySelector('#dlgBox [data-go]').textContent));
  await page.click('#dlgBox [data-go]');
  await page.waitForFunction(() => window.__gs.state().batch.students.find(s => s.key === 'Bram Sample').files.length === 3, { timeout: 30000 });
  await page.waitForFunction(() => window.__gs.state().batch.students.every(s => s.grade.status === 'late'));
  const a = await page.evaluate(() => window.__gs.state().batch.students.find(s => s.key === 'Aria Testwell').files.map(f => f.name));
  assert.equal(a.length, 2, 'both versions: ' + a);
  assert.match(await page.$eval('#batchName', e => e.textContent), /2 students/);
  assert.ok(!(await page.evaluate(() => window.__gs.state().batch.students.some(s => s.key === 'Nia Newcomer'))));
  assert.deepEqual(page.errors, []);
  await close();
});
test('A late file that can’t open says so as soon as it comes in', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Bram Sample/Essay.pdf': paper }));
  await bring(page, [['Bram Sample late.doc', OLE()]]);
  await page.waitForSelector('#dlgBox [data-go]');
  await page.click('#dlgBox [data-go]');
  await answerDlg(page);
  assert.match(page.lastDialog, /One file came in but can’t be opened here/); assert.match(page.lastDialog, /Bram Sample late\.doc: An older Word file/);
  await close();
});
test('Mark late on a file she added: offered, not assumed', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Bram Sample/Essay.pdf': paper }));
  await goToStudent(page, 1);
  const f = tmpPick('late page.pdf', await makePaper({ title: 'Late page' }));
  await page.evaluate(() => { window.__pick = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === 'file') { this.id = 'pickHere'; document.body.appendChild(this); return; } return window.__pick.call(this); }; });
  await page.click('#addFileBtn');
  await page.waitForSelector('#pickHere');
  await (await page.$('#pickHere')).uploadFile(f);
  await page.waitForSelector('#paper [data-marklate]', { timeout: 20000 });
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[1].grade.status || ''), '', 'not late yet');
  await page.waitForFunction(() => { const s = window.__gs.state(), b = document.querySelector('#paper [data-marklate]'), r = b.getBoundingClientRect(); return s.pages.length > 1 && s.pages[s.pages.length - 1].s > 0 && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === b; });   // the paper has stopped moving, now a page's look comes first
  await page.click('#paper [data-marklate]');
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students[1].grade.status), 'late');
  assert.equal(await page.$('#paper [data-marklate]'), null);
  assert.equal(await page.$eval('#gstat [data-status="late"]', b => b.getAttribute('aria-pressed')), 'true', 'the panel on the right agrees');
  await close();
});
test('A newer download with new files offers to mark those students late, and doesn’t until she says', async () => {
  const { page, close } = await openApp(browser);
  const aria = await makePaper({ title: 'Aria paper' }), bram = await makePaper({ title: 'Bram paper' }), cleo = await makePaper({ title: 'Cleo paper' });
  const v1 = { 'Aria Testwell/Essay.pdf': aria, 'Bram Sample/Essay.pdf': bram, 'Cleo Fixture/Essay.pdf': cleo };
  await openZip(page, zipOf(v1), 'One.zip');
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);
  await settle(page);
  await page.reload(); await page.waitForFunction(() => !!(window.__gs && window.__gs.state));
  await openZip(page, zipOf({ ...v1, 'Dov Madeup/Essay.pdf': await makePaper({ title: 'Dov paper' }) }), 'Two.zip');
  await page.waitForSelector('#carryBox', { timeout: 20000 });
  assert.match(await page.$eval('#dlgBox [data-carrylate]', e => e.textContent), /Mark 1 student with new files late/);
  assert.equal(await page.evaluate(() => window.__gs.state().batch.students.filter(s => s.grade.status === 'late').length), 0, 'no one yet');
  await page.click('#dlgBox [data-carrylate]');
  assert.deepEqual(await page.evaluate(() => window.__gs.state().batch.students.filter(s => s.grade.status === 'late').map(s => s.key)), ['Dov Madeup']);
  assert.equal(await page.$('#dlgBox [data-carrylate]'), null, 'done, so it’s gone');
  await page.click('#dlgBox .bf [data-close]');
  assert.deepEqual(page.errors, []);
  await close();
});

/* ---------------- small things about files coming in ---------------- */
test('Notes that begin BMW or GIF89a still open as text, and a picture called .txt still opens as a picture', async () => {
  const { page, close } = await openApp(browser);
  const png = await noisy(page, 'image/png');
  await openZip(page, zipOf({ 'Aaa Good/Essay.pdf': paper, 'Bram Sample/notes.txt': strToU8('BMW factory visit notes, with a long second part'), 'Dov Madeup/m.md': strToU8('BM here'), 'Eva Example/g.txt': strToU8('GIF89a is the old picture format'), 'Fay Fixture/pic.txt': png }));
  const kinds = await page.evaluate(() => window.__gs.state().batch.students.map(st => st.files[0].kind));
  assert.deepEqual(kinds, ['pdf', 'text', 'text', 'text', 'img']);
  assert.equal((await facts(page)).cant.length, 0);
  assert.deepEqual(page.errors, []);
  await close();
});

test('A damaged page reached before the background check is counted once', async () => {
  const { page, close } = await openApp(browser);
  const hole = strToU8(['%PDF-1.4', '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj', '2 0 obj<</Type/Pages/Kids[3 0 R 9 0 R]/Count 2>>endobj', '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj', 'trailer<</Root 1 0 R>>'].join('\n'));
  await openZip(page, zipOf({ 'Zed Hole/hole.pdf': hole, 'Aria Testwell/Essay.pdf': paper }));
  await goToStudent(page, 1);
  await page.waitForFunction(() => /Page 2 of/.test(document.querySelector('#paper').textContent), { timeout: 15000 });
  const pages = await page.evaluate(async () => { const f = window.__gs.state().batch.students[1].files[0]; f.checked = null; await window.__gs.checkFile(f); return f.badPages; });
  assert.deepEqual(pages, [2]);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Windows and Word housekeeping files aren’t anyone’s work, and the download is still known by them', async () => {
  const { page, close } = await openApp(browser);
  const files = { 'Eva Example/Essay.pdf': paper, 'Eva Example/Thumbs.db': strToU8('thumbs'), 'Eva Example/desktop.ini': strToU8('[x]'), 'Eva Example/~$Essay.docx': strToU8('owner'), 'Thumbs.db': strToU8('thumbs') };
  await openZip(page, zipOf(files));
  const got = await page.evaluate(() => { const s = window.__gs.state().batch; return { id: s.id, who: s.students.map(st => [st.key, st.files.map(f => f.name)]) }; });
  assert.deepEqual(got.who, [['Eva Example', ['Essay.pdf']]]);
  assert.equal((await facts(page)).cant.length, 0);
  const sized = Object.entries(files).map(([path, d]) => ({ path, data: { length: d.length } }));
  assert.equal(await page.evaluate(l => window.__gs.batchIdOf(l), sized), got.id, 'work saved before this keeps opening');
  await page.waitForFunction(id => !!document.querySelector('#kept [data-kopen="' + id + '"]') || !document.querySelector('#app').hidden, {}, got.id);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Reading the report by way of More takes the bar down for good, and Forget lets it speak again', async () => {
  const { page, close } = await openApp(browser);
  const zip = zipOf({ 'Aria Testwell/Essay.pdf': paper, 'Bram Sample/old.doc': OLE() });
  await openZip(page, zip);
  await openBar(page);
  const id = await page.evaluate(() => window.__gs.state().batch.id);
  await page.click('#moreBtn'); await page.click('#openRepBtn');
  await page.waitForSelector('#openRepBox');
  await page.click('#dlgBox .bf [data-close]');
  assert.equal(await page.$eval('#openRep', e => e.hidden), true);
  const seen = () => page.evaluate(id => Object.keys(JSON.parse(localStorage.getItem('gs.openSeen') || '{}')).includes(id), id);
  assert.equal(await seen(), true);
  await page.click('#closeBtn');
  await page.waitForSelector('#kept [data-kforget]');
  await page.click('#kept [data-kforget]'); await page.click('#kept [data-kforget]');
  await page.waitForFunction(() => !document.querySelector('#kept [data-kforget]'), { timeout: 15000 });
  assert.equal(await seen(), false);
  await openZip(page, zip);
  assert.match(await openBar(page), /couldn’t/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('An exported iPhone photo is called IMG.pdf, not IMG.HEIC.pdf', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf({ 'Aria Testwell/IMG.HEIC': FX('photo.heic'), 'Bram Sample/photo.jpg': FX('photo.jpg') }));
  await goToStudent(page, 1); await waitPaper(page);
  const paths = await page.evaluate(() => { localStorage.setItem('gs.xall', 'true'); return window.__gs.exportPlan(true).map(o => o.path); });
  assert.deepEqual(paths.sort(), ['Aria Testwell/IMG.pdf', 'Bram Sample/photo.pdf']);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Marks on a damaged PNG, scrambled or cut off, stay saved, with no page and no freeze', async () => {
  const { page, close } = await openApp(browser);
  const png = await noisy(page, 'image/png');
  const files = { 'Aria Testwell/a.png': scrambled(png), 'Bram Sample/b.png': png.subarray(0, png.length >> 1), 'Cleo Fixture/Essay.pdf': paper };
  const id = await page.evaluate(l => window.__gs.batchIdOf(l), Object.entries(files).map(([path, d]) => ({ path, data: { length: d.length } })));
  const mark = { type: 'pen', pts: [[20, 20], [100, 60]], color: '#d01f1f', width: 2 };
  const work = k => ({ f: { [k]: { 0: [mark] } }, g: { rubric: [], points: '', comment: '' }, h: {} });
  await page.evaluate((id, data) => localStorage.setItem(id, JSON.stringify(data)), id, { t: Date.now(), cur: 2, setup: {}, s: { 'Aria Testwell': work('Aria Testwell/a.png'), 'Bram Sample': work('Bram Sample/b.png') } });
  await page.reload(); await page.waitForFunction(() => !!(window.__gs && window.__gs.state));
  await openZip(page, zipOf(files));
  const got = await page.evaluate(() => window.__gs.state().batch.students.slice(0, 2).map(st => { const f = st.files[0]; return [f.kind, f.marks[0].length]; }));
  assert.deepEqual(got, [['other', 1], ['other', 1]]);
  assert.match(await cardText(page, 0), /picture couldn’t be read.*Your marks on it are still saved/s);
  await settle(page);
  assert.equal((await page.evaluate(id => JSON.parse(localStorage.getItem(id)), id)).s['Bram Sample'].f['Bram Sample/b.png'][0].length, 1, 'and they are kept when it saves again');
  assert.deepEqual(page.errors, []);
  await close();
});
