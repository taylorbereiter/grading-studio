// The parts in a real browser, on the gallery page: no words that did not come through t(), keyboard use of the menu, the sheet,
// the dialog and the command bar, the mic only where the browser can listen, undo from the toast, and no errors in any theme.
// npm run next:browser. Chrome as the other tests find it (test/helpers/chrome.js); CHROME_PATH overrides.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('../../../test/helpers/chrome.js');
const { serveNext } = require('../../tools/serve-next.js');

let browser, srv;
const args = process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : [];
before(async () => { srv = await serveNext(); browser = await launch({ args }); });
after(async () => { await browser.close(); await srv.close(); });

async function open(q = '', o = {}) {
  const p = await browser.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.setViewport({ width: o.width || 1366, height: 900 });
  await p.goto(srv.url + 'gallery.html?still=1' + q);
  await p.waitForFunction(() => window.__gallery && window.__gallery.ready);
  p.errors = errors; return p;
}
const active = p => p.evaluate(() => { const a = document.activeElement; return a ? (a.dataset.test || a.getAttribute('role') || a.tagName.toLowerCase()) : ''; });
const inside = (p, sel) => p.evaluate(s => !!document.activeElement.closest(s), sel);

test('every word on the gallery comes through t() or is a teacher’s own text', async () => {
  for (const w of [1366, 390]) {
    const p = await open('&keys=1&frame=1', { width: w });
    const loose = await p.evaluate(() => {
      const bad = [], ok = s => !/[A-Za-z]/.test(s.replace(/⟦[^⟧]*⟧/g, ''));
      const skip = el => el.closest('[data-raw],code,script,style,svg,kbd,.gic');
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) { if (!n.nodeValue.trim() || skip(n.parentElement)) continue; if (!ok(n.nodeValue)) bad.push(n.nodeValue.trim()); }
      for (const el of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]')) for (const a of ['aria-label', 'title', 'placeholder', 'alt']) { const v = el.getAttribute(a); if (v && !skip(el) && !ok(v) && !(a === 'aria-label' && el.closest('.av'))) bad.push(a + '=' + v); }
      return bad;
    });
    assert.deepEqual(loose, [], 'words not from t() at ' + w + ' px');
    assert.deepEqual(p.errors, []); await p.close();
  }
});
test('menu: opens from the keyboard, arrows wrap, Escape gives focus back', async () => {
  const p = await open();
  await p.focus('[data-test="menu"]'); await p.keyboard.press('ArrowDown');
  await p.waitForSelector('[role="menu"]');
  assert.equal(await active(p), 'menuitem');
  const first = await p.evaluate(() => document.activeElement.textContent);
  await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp');
  const lastEnabled = await p.evaluate(() => document.activeElement.textContent);
  assert.notEqual(first, lastEnabled, 'Up from the first item wraps to the end');
  assert.ok(!(await p.evaluate(() => document.activeElement.getAttribute('aria-disabled'))), 'a disabled item is skipped');
  await p.keyboard.press('Home'); assert.equal(await p.evaluate(() => document.activeElement.textContent), first);
  await p.keyboard.press('Escape');
  assert.equal(await p.$('[role="menu"]'), null); assert.equal(await active(p), 'menu');
  await p.keyboard.press('Enter'); await p.waitForSelector('[role="menu"]'); await p.keyboard.press('Tab');
  assert.equal(await p.$('[role="menu"]'), null, 'Tab closes the menu');
  assert.deepEqual(p.errors, []); await p.close();
});
test('sheet and dialog: focus moves in, Tab stays inside, Escape closes and focus comes back', async () => {
  const p = await open();
  for (const [btn, sel] of [['sheet', 'dialog.sheet'], ['dialog', 'dialog.dlg']]) {
    await p.focus('[data-test="' + btn + '"]'); await p.keyboard.press('Enter');
    await p.waitForSelector(sel + '[open]');
    assert.ok(await inside(p, sel), btn + ': focus moved in');
    for (let i = 0; i < 25; i++) { await p.keyboard.press('Tab'); assert.ok(await inside(p, sel), btn + ': Tab left the ' + btn); }
    for (let i = 0; i < 25; i++) { await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift'); assert.ok(await inside(p, sel), btn + ': Shift+Tab left'); }
    await p.keyboard.press('Escape');
    await p.waitForFunction(s => !document.querySelector(s + '[open]'), {}, sel);
    assert.equal(await active(p), btn, btn + ': focus back on the button that opened it');
  }
  assert.deepEqual(p.errors, []); await p.close();
});
test('command bar: Ctrl+K and Cmd+K open it, typing filters, arrows move, Enter runs', async () => {
  const p = await open();
  for (const mod of ['Control', 'Meta']) {
    await p.keyboard.down(mod); await p.keyboard.press('k'); await p.keyboard.up(mod);
    await p.waitForSelector('dialog.cmd[open] input');
    assert.equal(await p.evaluate(() => document.activeElement.getAttribute('role')), 'combobox');
    await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.querySelector('dialog.cmd[open]'));
  }
  await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control');
  await p.waitForSelector('dialog.cmd[open] input');
  await p.keyboard.type('cal');
  const opts = await p.$$eval('dialog.cmd [role="option"]', l => l.map(o => o.textContent));
  assert.equal(opts.length, 1, 'filtered to the calendar: ' + opts.join(' | '));
  await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace');
  const sel0 = await p.$eval('dialog.cmd input', i => i.getAttribute('aria-activedescendant'));
  await p.keyboard.press('ArrowDown');
  const sel1 = await p.$eval('dialog.cmd input', i => i.getAttribute('aria-activedescendant'));
  assert.notEqual(sel0, sel1);
  await p.keyboard.type('library'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__gallery.ran.includes('go-library'));
  assert.equal(await p.$('dialog.cmd[open]'), null);
  assert.deepEqual(p.errors, []); await p.close();
});
test('shortcuts run outside text boxes only, and the list shows them', async () => {
  const p = await open();
  await p.keyboard.press('j'); await p.waitForFunction(() => window.__gallery.ran.includes('j'));
  await p.focus('textarea'); await p.keyboard.press('k');
  assert.ok(!(await p.evaluate(() => window.__gallery.ran.includes('k'))), 'k while typing stays in the box');
  assert.ok((await p.$$eval('#keys .keys > span', l => l.length)) >= 10);
  await p.close();
});
test('dictation: a mic on every long text box where the browser can listen, none where it cannot', async () => {
  const p = await open();
  const has = await p.evaluate(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const boxes = await p.$$eval('textarea', l => l.length), mics = await p.$$eval('.dfield .mic', l => l.length);
  if (has) assert.equal(mics, boxes); else assert.equal(mics, 0);
  await p.close();
  const q = await open('&nospeech=1');
  assert.ok((await q.$$eval('textarea', l => l.length)) > 0);
  assert.equal(await q.$$eval('.mic', l => l.length), 0, 'no dead mic button');
  await q.close();
});
test('undo: the toast and Ctrl+Z take a change back', async () => {
  const p = await open();
  const count = () => p.$eval('[data-test="count"]', e => +e.textContent);
  const c0 = await count();
  await p.click('[aria-label="One more"]'); await p.click('[aria-label="One more"]');
  assert.equal(await count(), c0 + 2);
  await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control');
  assert.equal(await count(), c0 + 1);
  await p.click('[data-test="undo"]'); assert.equal(await count(), c0);
  await p.click('[data-test="toast-undo"]'); await p.waitForSelector('.toast button');
  await p.click('.toast button'); await p.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => /back/.test(t.textContent)));
  await p.click('[data-test="add-image"]'); await p.waitForFunction(() => document.querySelector('#files .ftile img'));
  assert.deepEqual(p.errors, []); await p.close();
});
test('every theme draws without errors, and the page never follows the computer’s dark setting', async () => {
  for (const look of ['graphite', 'porcelain', 'ocean', 'ink', 'plum', 'midnight']) {
    const p = await open('&look=' + look);
    assert.equal(await p.evaluate(() => document.documentElement.dataset.look), look);
    assert.deepEqual(p.errors, [], look); await p.close();
  }
  const p = await browser.newPage();
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await p.goto(srv.url + 'gallery.html'); await p.waitForFunction(() => window.__gallery && window.__gallery.ready);
  assert.equal(await p.evaluate(() => document.documentElement.dataset.look), 'graphite');
  assert.equal(await p.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(245, 246, 248)');
  await p.close();
});
