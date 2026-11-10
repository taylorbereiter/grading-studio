// A reading above the papers can be zoomed and its box dragged taller, and both are remembered for that file.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { launch } = require('./helpers/chrome');
const { openApp, openZip, settle, goToStudent } = require('./helpers/app');
const { standardFiles, makePaper, zipOf } = require('./helpers/fixtures');

let browser, files, reading;
before(async () => { browser = await launch(); files = await standardFiles(); reading = Buffer.from(await makePaper({ title: 'Class reading', pages: 2 })).toString('base64'); });
after(async () => { await browser.close(); });

const addPdf = (page, b64) => page.evaluate(async b64 => {
  const bin = atob(b64), u = Uint8Array.from(bin, c => c.charCodeAt(0));
  await window.__gs.addRefs([new File([u], 'Reading.pdf', { type: 'application/pdf' })]);
}, b64);
const pagesDrawn = page => page.waitForFunction(() => { const c = [...document.querySelectorAll('#paper .refd .refpages canvas')]; return c.length === 2 && c.every(x => x.width > 0); }, { timeout: 20000 });
const shown = page => page.$eval('#paper .refd', d => ({ zoom: d.querySelector('.rzv').textContent, w: d.querySelector('.refpages canvas').getBoundingClientRect().width, px: d.querySelector('.refpages canvas').width, h: d.querySelector('.refscroll').getBoundingClientRect().height }));

test('a PDF reading zooms in and out sharply, its box drags taller, and both stay for the next student', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'River essay.zip');
  await addPdf(page, reading);
  await pagesDrawn(page);
  const a = await shown(page);
  assert.equal(a.zoom, '100%');
  await page.click('#paper .refd [data-rz="+"]');
  await page.waitForFunction(px => document.querySelector('#paper .refd .refpages canvas').width > px * 1.2, { timeout: 20000 }, a.px);
  const b = await shown(page);
  assert.equal(b.zoom, '125%');
  assert.ok(Math.abs(b.w - a.w * 1.25) < 3, 'shown 25% wider');
  assert.ok(b.px > a.px * 1.2, 'drawn again at the bigger size, so it stays sharp');
  // Ctrl + scroll (and a trackpad pinch) zooms too.
  const box = await page.$eval('#paper .refd .refscroll', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 40 }; });
  await page.mouse.move(box.x, box.y);
  await page.keyboard.down('Control'); await page.mouse.wheel({ deltaY: -200 }); await page.keyboard.up('Control');
  await page.waitForFunction(() => parseInt(document.querySelector('#paper .refd .rzv').textContent) > 125);
  assert.equal(await page.evaluate(() => window.__gs.state().zoom), 1, 'the papers under it stay as they were');
  await page.click('#paper .refd [data-rz="1"]');
  await page.waitForFunction(() => document.querySelector('#paper .refd .rzv').textContent === '100%');
  await page.click('#paper .refd [data-rz="-"]');
  await page.waitForFunction(() => document.querySelector('#paper .refd .rzv').textContent === '80%');
  // Drag the bottom edge down 200px.
  const g = await page.$eval('#paper .refd .refgrip', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const h0 = (await shown(page)).h;
  await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move(g.x, g.y + 100, { steps: 4 }); await page.mouse.move(g.x, g.y + 200, { steps: 4 }); await page.mouse.up();
  const h1 = (await shown(page)).h;
  assert.ok(Math.abs(h1 - (h0 + 200)) < 4, 'box is 200px taller: ' + h0 + ' → ' + h1);
  await settle(page);
  await goToStudent(page, 1);
  await pagesDrawn(page);
  const c = await shown(page);
  assert.equal(c.zoom, '80%', 'zoom remembered');
  assert.ok(Math.abs(c.h - h1) < 4, 'height remembered');
  await close();
});

test('a text reading zooms too', async () => {
  const { page, close } = await openApp(browser);
  await openZip(page, zipOf(files), 'River essay.zip');
  await page.evaluate(() => window.__gs.addRefs([new File(['Read this carefully.'], 'Notes.txt')]));
  await page.waitForSelector('#paper .refd .refscroll .dpage');
  const w0 = await page.$eval('#paper .refd .refscroll .docx', e => e.getBoundingClientRect().height);
  await page.click('#paper .refd [data-rz="+"]'); await page.click('#paper .refd [data-rz="+"]');
  const w1 = await page.$eval('#paper .refd .refscroll .docx', e => e.getBoundingClientRect().height);
  assert.ok(w1 > w0 * 1.4, 'text drawn bigger');
  assert.equal(await page.$eval('#paper .refd .rzv', e => e.textContent), '156%');
  await close();
});
