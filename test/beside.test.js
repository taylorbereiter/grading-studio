// The assistant beside the app (src/beside.js): a teacher's AI assistant is a link in the sidebar of both pages. A click opens its own
// page in a window on the right of the screen, or a tab; the browser's own menu on the link is left alone. Where it opens can be a
// link of the teacher's own. Nothing is sent to it. No window is really opened here: window.open is stood in for, and its calls read.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('./helpers/chrome');
const { openApp, goTo, builtHtml } = require('./helpers/app');
const ROOT = path.join(__dirname, '..');

function serveBoth() {
  builtHtml();
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0], file = p === '/' || p === '/index.html' ? 'index.html' : p === '/planner.html' ? 'planner.html' : null;
    if (!file) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
// Every window the page asks for is written down instead of opened: the address asked for, how, and where it was sent after.
const standIn = page => page.evaluate(() => {
  window.__opens = [];
  window.open = (u, t, f) => { const w = { opener: window, went: null, location: { replace(x) { w.went = x; } }, close() { w.shut = true; } }; window.__opens.push({ u, t, f: f || '', w }); return w; };
});
const opens = page => page.evaluate(() => window.__opens.map(o => ({ u: o.u, t: o.t, f: o.f, went: o.w.went, opener: o.w.opener === null })));
const rail = page => page.$eval('#railAi', a => ({ shown: a.checkVisibility(), text: a.textContent.trim(), href: a.getAttribute('href'), target: a.target, rel: a.rel }));
// A click on the name lists the assistants; the one in use is the first row.
const railOpen = async page => { await page.evaluate(() => document.querySelector('#railAi').click()); await page.waitForSelector('#bsMenu .bsrow[aria-current]'); await page.click('#bsMenu .bsrow[aria-current]'); };
const lib = page => page.evaluate(() => JSON.parse(localStorage.getItem('gs.lib') || 'null'));
const words = page => page.evaluate(() => JSON.parse(localStorage.getItem('gs.words') || 'null'));
const setTo = (page, id, v) => page.$eval(id, (e, v) => { e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, v);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

test('the assistant is a link in the sidebar: a click opens it in a window on the right of the screen, and the browser’s own ways are left alone', async () => {
  const { page, close } = await openApp(browser);
  assert.deepEqual(await rail(page), { shown: true, text: 'Claude', href: 'https://claude.ai/new', target: '_blank', rel: 'noopener' });
  assert.equal(await lib(page).then(l => l.me), undefined, 'nothing is written for a browser from before');
  await standIn(page);
  await railOpen(page);
  let o = await opens(page);
  assert.equal(o.length, 1);
  assert.equal(o[0].u, 'about:blank', 'opened empty first, so this page is not its opener');
  assert.equal(o[0].went, 'https://claude.ai/new'); assert.equal(o[0].opener, true);
  const at = await page.evaluate(() => ({ p: window.__gsBeside.place(), W: screen.availWidth, H: screen.availHeight, L: screen.availLeft || 0 }));
  assert.equal(o[0].f, 'popup,left=' + at.p.left + ',top=' + at.p.top + ',width=' + at.p.width + ',height=' + at.p.height);
  assert.equal(at.p.left + at.p.width, at.L + at.W, 'it ends at the right edge of the screen'); assert.equal(at.p.height, at.H);
  assert.ok(at.p.width >= 420 && at.p.width <= 760);
  assert.match(await page.$eval('.toast', e => e.textContent), /Claude is open/);
  // Ctrl, ⌘ and Shift clicks are the browser's: the page opens nothing itself and doesn't stop them
  const left = await page.evaluate(() => ['ctrlKey', 'metaKey', 'shiftKey'].map(k => { const e = new MouseEvent('click', { bubbles: true, cancelable: true, [k]: true }); const a = document.querySelector('#railAi'); a.addEventListener('click', x => x.preventDefault(), { once: true }); a.dispatchEvent(e); return window.__opens.length; }));
  assert.deepEqual(left, [1, 1, 1]);
  // Find anything has it too
  await page.evaluate(() => window.__gs.findRows().find(r => r.label === 'Open Claude beside Grading Studio').run());
  assert.equal((await opens(page)).length, 2);
  // a browser that stops the window says so
  await page.evaluate(() => { window.open = () => null; });
  await railOpen(page);
  assert.match(await page.$eval('.toast', e => e.textContent), /stopped Claude from opening/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Settings: another assistant, a link of the teacher’s own, and a tab instead of a window', async () => {
  const { page, close } = await openApp(browser, { newTeacher: true });
  await page.evaluate(() => { for (let i = 0; i < 3; i++) document.querySelector('#welcome [data-wlnext]').click(); });
  assert.equal((await rail(page)).shown, false, 'no assistant named, nothing in the sidebar');
  await goTo(page, '#/settings/claude');
  await page.waitForSelector('#meAi');
  assert.equal(await page.$('#meAiUrl'), null);
  assert.equal(await page.$eval('#meAi', e => e.options[1].text), 'Gemini', 'Gemini is listed first, and none is chosen');
  await page.select('#meAi', 'Gemini');
  await page.waitForSelector('#meAiUrl');
  assert.deepEqual(await rail(page), { shown: true, text: 'Gemini', href: 'https://gemini.google.com/app', target: '_blank', rel: 'noopener' });
  assert.equal(await page.$eval('#meAiUrl', e => e.placeholder + '|' + e.value), 'https://gemini.google.com/app|');
  assert.match(await page.$eval('#meBeside', e => e.innerText), /Gemini is in the sidebar on every screen[\s\S]*Open link in split view[\s\S]*sends nothing to it/);
  assert.deepEqual(await words(page), { sys: '', unit: '', ai: 'Gemini' });
  // a link of her own
  await setTo(page, '#meAiUrl', 'https://gemini.google.com/u/1/app');
  await page.waitForFunction(() => window.__gs.aiLink() === 'https://gemini.google.com/u/1/app');
  assert.equal((await rail(page)).href, 'https://gemini.google.com/u/1/app');
  assert.equal((await lib(page)).me.aiUrl, 'https://gemini.google.com/u/1/app');
  assert.equal((await words(page)).link, 'https://gemini.google.com/u/1/app', 'the Planner is told');
  // only https is taken
  for (const bad of ['http://gemini.google.com/app', 'javascript:alert(1)', 'gemini', 'file:///etc/passwd', 'https://nodot']) {
    await setTo(page, '#meAiUrl', bad);
    assert.equal(await page.evaluate(() => window.__gs.aiLink()), 'https://gemini.google.com/u/1/app', bad + ' is refused');
  }
  assert.match(await page.$eval('.toast', e => e.textContent), /https:\/\//);
  // a tab instead
  await standIn(page);
  await page.click('[data-besideopen]');
  assert.match((await opens(page))[0].f, /^popup,/);
  await page.select('#meAiOpen', 'tab');
  await page.waitForFunction(() => window.__gsBeside.who().tab);
  assert.equal((await lib(page)).me.aiOpen, 'tab'); assert.equal((await words(page)).tab, true);
  await railOpen(page);
  let o = await opens(page);
  assert.equal(o[1].f, '', 'a tab has no place or size'); assert.equal(o[1].went, 'https://gemini.google.com/u/1/app'); assert.equal(o[1].opener, true);
  await page.select('#meAiOpen', '');
  await page.waitForFunction(() => !window.__gsBeside.who().tab);
  assert.equal('aiOpen' in (await lib(page)).me, false, 'kept only while it says something');
  // emptied, it is the usual page again
  await setTo(page, '#meAiUrl', '');
  await page.waitForFunction(() => window.__gs.aiLink() === 'https://gemini.google.com/app');
  assert.equal('aiUrl' in (await lib(page)).me, false);
  // another assistant doesn't keep the last one's link
  await setTo(page, '#meAiUrl', 'https://gemini.google.com/gem/made-up');
  await page.waitForFunction(() => /made-up/.test(window.__gs.aiLink()));
  await page.select('#meAi', 'ChatGPT');
  await page.waitForFunction(() => window.__gs.aiName() === 'ChatGPT');
  assert.equal(await page.evaluate(() => window.__gs.aiLink()), 'https://chatgpt.com/');
  // one the app doesn't know is in the sidebar once it has an address
  await page.select('#meAi', 'other');
  await page.waitForSelector('#meAiOther');
  await setTo(page, '#meAiOther', 'School Helper');
  await page.waitForFunction(() => window.__gs.aiName() === 'School Helper');
  assert.equal((await rail(page)).shown, false);
  assert.match(await page.$eval('#meBeside', e => e.innerText), /Give it an address above/);
  await setTo(page, '#meAiUrl', 'https://helper.example.org/chat');
  await page.waitForFunction(() => window.__gs.aiLink() === 'https://helper.example.org/chat');
  assert.deepEqual(await rail(page), { shown: true, text: 'School Helper', href: 'https://helper.example.org/chat', target: '_blank', rel: 'noopener' });
  // no assistant, no link
  await page.select('#meAi', '');
  await page.waitForFunction(() => window.__gs.aiName() === '');
  assert.equal((await rail(page)).shown, false);
  assert.equal(await page.evaluate(() => window.__gs.aiLink()), '');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the Planner has the same link, from what the grading page told it', async () => {
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    const { page: g } = await openApp(browser, { server: srv, context: ctx, newTeacher: true });
    await g.evaluate(() => { for (let i = 0; i < 3; i++) document.querySelector('#welcome [data-wlnext]').click(); });
    const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(String(e)));
    await page.goto(srv.url + 'planner.html');
    await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
    assert.equal((await rail(page)).shown, false, 'no assistant named');
    // chosen on the grading page: the open Planner follows without being opened again
    await goTo(g, '#/settings/claude');
    await g.waitForSelector('#meAi');
    await g.select('#meAi', 'Gemini');
    await g.waitForSelector('#meAiUrl');
    await page.waitForFunction(() => document.querySelector('#railAi').checkVisibility());
    assert.deepEqual(await rail(page), { shown: true, text: 'Gemini', href: 'https://gemini.google.com/app', target: '_blank', rel: 'noopener' });
    await setTo(g, '#meAiUrl', 'https://gemini.google.com/gem/made-up');
    await g.select('#meAiOpen', 'tab');
    await page.waitForFunction(() => /made-up/.test(document.querySelector('#railAi').getAttribute('href')) && window.__gsBeside.who().tab);
    await standIn(page);
    await railOpen(page);
    const o = await opens(page);
    assert.equal(o[0].f, ''); assert.equal(o[0].went, 'https://gemini.google.com/gem/made-up'); assert.equal(o[0].opener, true);
    // a link that isn't https in what the Planner reads is not used
    await page.evaluate(() => { localStorage.setItem('gs.words', JSON.stringify({ sys: '', unit: '', ai: 'Gemini', link: 'javascript:alert(1)' })); window.__gsBeside.paint(); });
    assert.equal((await rail(page)).href, 'https://gemini.google.com/app');
    assert.deepEqual(page.errors, []);
  } finally { await ctx.close(); await srv.close(); }
});

test('My setup carries the link and the way it opens, and takes only an https link', async () => {
  const { page, close } = await openApp(browser, { newTeacher: true });
  await page.evaluate(() => { for (let i = 0; i < 3; i++) document.querySelector('#welcome [data-wlnext]').click(); });
  const S = await page.evaluate(() => window.__gs.stpRead({ gradingStudioSetup: 1, school: { assistant: 'Gemini', assistantLink: 'https://gemini.google.com/gem/made-up', assistantOpens: 'Tab' } }).school);
  assert.deepEqual(S, { ai: 'Gemini', aiUrl: 'https://gemini.google.com/gem/made-up', aiOpen: 'tab' });
  assert.equal(await page.evaluate(() => window.__gs.stpRead({ gradingStudioSetup: 1, school: { assistant: 'Gemini', assistantLink: 'http://plain.example.org/', assistantOpens: 'window' } }).school.aiUrl), '');
  await page.evaluate(async () => { const G = window.__gs; await G.stpApply(G.stpRead({ gradingStudioSetup: 1, school: { assistant: 'Gemini', assistantLink: 'https://gemini.google.com/gem/made-up', assistantOpens: 'tab' } }), { school: true }); });
  let me = (await lib(page)).me;
  assert.equal(me.ai, 'Gemini'); assert.equal(me.aiUrl, 'https://gemini.google.com/gem/made-up'); assert.equal(me.aiOpen, 'tab');
  assert.equal((await rail(page)).href, 'https://gemini.google.com/gem/made-up');
  const out = JSON.parse(await page.evaluate(async () => { const x = await window.__gs.stpExport(); return typeof x === 'string' ? x : JSON.stringify(x); }));
  assert.deepEqual(out.school, { assistant: 'Gemini', assistantLink: 'https://gemini.google.com/gem/made-up', assistantOpens: 'tab' });
  // another assistant with no link of its own, opening in a window: the old link and the tab go
  await page.evaluate(async () => { const G = window.__gs; await G.stpApply(G.stpRead({ gradingStudioSetup: 1, school: { assistant: 'Claude', assistantOpens: 'window' } }), { school: true }); });
  me = (await lib(page)).me;
  assert.equal(me.ai, 'Claude'); assert.equal('aiUrl' in me, false); assert.equal('aiOpen' in me, false);
  assert.equal((await rail(page)).href, 'https://claude.ai/new');
  assert.match(await page.evaluate(() => window.__gs.stpPrompt()), /"assistantLink"[\s\S]*"assistantOpens"/);
  assert.deepEqual(page.errors, []);
  await close();
});

const menu = page => page.$$eval('#bsMenu .bsrow', l => l.map(a => (a.getAttribute('aria-current') ? '*' : '') + (a.dataset.bsname || a.textContent.trim()) + (a.querySelector('small') ? ' (' + a.querySelector('small').textContent + ')' : '') + (a.dataset.bsname ? ' -> ' + a.getAttribute('href') : '')));
test('more than one assistant: the click lists them, a pick opens it and makes it the one in use, and each keeps its own link', async () => {
  const { page, close } = await openApp(browser);
  await standIn(page);
  await page.click('#railAi');
  await page.waitForSelector('#bsMenu');
  assert.equal((await opens(page)).length, 0, 'the list first, nothing opened yet');
  assert.deepEqual(await menu(page), ['*Claude -> https://claude.ai/new', 'Gemini -> https://gemini.google.com/app', 'ChatGPT -> https://chatgpt.com/', 'Copilot -> https://copilot.microsoft.com/', 'Assistants and their links…']);
  assert.deepEqual(await page.$$eval('#bsMenu .bsrow[data-bsname]', l => l.map(a => a.target + ' ' + a.rel)), Array(4).fill('_blank noopener'), 'each row is a real link, for the browser’s own menu');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.bsname), 'Claude', 'the one in use is ready under Enter');
  await page.keyboard.press('Escape');
  assert.equal(await page.$('#bsMenu'), null);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'railAi');
  // a click anywhere else closes it too
  await page.click('#railAi'); await page.waitForSelector('#bsMenu');
  await page.mouse.click(700, 300);
  assert.equal(await page.$('#bsMenu'), null);
  // picking another one
  await page.click('#railAi'); await page.waitForSelector('#bsMenu');
  await page.click('#bsMenu [data-bsname="Gemini"]');
  let o = await opens(page);
  assert.equal(o.length, 1); assert.equal(o[0].went, 'https://gemini.google.com/app'); assert.match(o[0].f, /^popup,/);
  assert.equal((await lib(page)).me.ai, 'Gemini'); assert.equal((await words(page)).ai, 'Gemini');
  assert.equal((await rail(page)).text, 'Gemini');
  assert.match(await page.$eval('#shareBtn', b => b.textContent), /Gemini/, 'the words on screen follow');
  // a link of her own for Gemini stays Gemini's when she goes to Claude and comes back
  await goTo(page, '#/settings/claude');
  await page.waitForSelector('#meAiUrl');
  await setTo(page, '#meAiUrl', 'https://gemini.google.com/u/1/gem/made-up');
  await page.click('#railAi'); await page.waitForSelector('#bsMenu');
  assert.equal((await menu(page))[0], '*Gemini (gemini.google.com) -> https://gemini.google.com/u/1/gem/made-up');
  await page.click('#bsMenu [data-bsname="Claude"]');
  let me = (await lib(page)).me;
  assert.equal(me.ai, 'Claude'); assert.equal('aiUrl' in me, false); assert.deepEqual(me.aiUrls, { Gemini: 'https://gemini.google.com/u/1/gem/made-up' });
  assert.deepEqual((await words(page)).urls, { Gemini: 'https://gemini.google.com/u/1/gem/made-up' }, 'the Planner is told');
  assert.equal(await page.$eval('#meAiUrl', e => e.value), '', 'Settings shows Claude’s own link, which is none');
  await page.click('#railAi'); await page.waitForSelector('#bsMenu');
  assert.deepEqual((await menu(page)).slice(0, 2), ['*Claude -> https://claude.ai/new', 'Gemini (gemini.google.com) -> https://gemini.google.com/u/1/gem/made-up']);
  await page.click('#bsMenu [data-bsname="Gemini"]');
  o = await opens(page);
  assert.equal(o[o.length - 1].went, 'https://gemini.google.com/u/1/gem/made-up');
  me = (await lib(page)).me;
  assert.equal(me.ai, 'Gemini'); assert.equal(me.aiUrl, 'https://gemini.google.com/u/1/gem/made-up'); assert.equal('aiUrls' in me, false, 'kept only while it says something');
  // the same through the Settings list
  await page.select('#meAi', 'ChatGPT');
  await page.waitForFunction(() => window.__gsBeside.who().name === 'ChatGPT');
  assert.deepEqual((await lib(page)).me.aiUrls, { Gemini: 'https://gemini.google.com/u/1/gem/made-up' });
  await page.select('#meAi', 'Gemini');
  await page.waitForFunction(() => /made-up/.test(window.__gsBeside.who().link));
  // Others you switch to: unticked ones leave the list; with none left the click opens the assistant straight away
  assert.deepEqual(await page.$$eval('#meAiList [data-ailist]', l => l.map(c => c.dataset.ailist + (c.checked ? '' : ' off'))), ['Claude', 'ChatGPT', 'Copilot']);
  await page.click('#meAiList [data-ailist="Copilot"]');
  assert.deepEqual((await lib(page)).me.aiOff, ['Copilot']); assert.deepEqual((await words(page)).off, ['Copilot']);
  await page.click('#railAi'); await page.waitForSelector('#bsMenu');
  assert.deepEqual((await menu(page)).map(x => x.split(' ')[0]), ['*Gemini', 'Claude', 'ChatGPT', 'Assistants']);
  await page.keyboard.press('Escape');
  await page.click('#meAiList [data-ailist="Claude"]'); await page.click('#meAiList [data-ailist="ChatGPT"]');
  const n = (await opens(page)).length;
  await page.click('#railAi');
  assert.equal(await page.$('#bsMenu'), null);
  assert.equal((await opens(page)).length, n + 1, 'one assistant: it opens as before');
  await page.click('#meAiList [data-ailist="Copilot"]'); await page.click('#meAiList [data-ailist="Claude"]'); await page.click('#meAiList [data-ailist="ChatGPT"]');
  assert.equal('aiOff' in (await lib(page)).me, false);
  assert.deepEqual(page.errors, []);
  await close();
});

test('My setup carries the other assistants’ links and the ones left off the list; the Planner lists them and opens one without changing anything', async () => {
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    const { page: g } = await openApp(browser, { server: srv, context: ctx, newTeacher: true });
    await g.evaluate(() => { for (let i = 0; i < 3; i++) document.querySelector('#welcome [data-wlnext]').click(); });
    const S = await g.evaluate(() => window.__gs.stpRead({ gradingStudioSetup: 1, school: { assistant: 'Gemini', otherAssistants: [{ name: 'Claude', link: 'https://claude.ai/project/made-up' }, { name: 'Bad', link: 'http://plain.example.org' }, 'junk'], assistantsNotListed: ['Copilot', 'Copilot', 7] } }).school);
    assert.deepEqual(S, { ai: 'Gemini', aiUrls: { Claude: 'https://claude.ai/project/made-up' }, aiOff: ['Copilot'] });
    const lines = await g.evaluate(() => { const G = window.__gs, S = G.stpRead({ gradingStudioSetup: 1, school: { assistant: 'Gemini', otherAssistants: [{ name: 'Claude', link: 'https://claude.ai/project/made-up' }], assistantsNotListed: ['Copilot'] } }); return JSON.stringify(G.stpDiff(S)); });
    assert.match(lines, /Other assistants with a link of your own/); assert.match(lines, /Not in the sidebar/);
    await g.evaluate(async () => { const G = window.__gs; await G.stpApply(G.stpRead({ gradingStudioSetup: 1, school: { assistant: 'Gemini', otherAssistants: [{ name: 'Claude', link: 'https://claude.ai/project/made-up' }], assistantsNotListed: ['Copilot'] } }), { school: true }); });
    const me = (await lib(g)).me;
    assert.equal(me.ai, 'Gemini'); assert.deepEqual(me.aiUrls, { Claude: 'https://claude.ai/project/made-up' }); assert.deepEqual(me.aiOff, ['Copilot']);
    const out = JSON.parse(await g.evaluate(async () => { const x = await window.__gs.stpExport(); return typeof x === 'string' ? x : JSON.stringify(x); }));
    assert.deepEqual(out.school.otherAssistants, [{ name: 'Claude', link: 'https://claude.ai/project/made-up' }]); assert.deepEqual(out.school.assistantsNotListed, ['Copilot']);
    assert.match(await g.evaluate(() => window.__gs.stpPrompt()), /"otherAssistants"[\s\S]*"assistantsNotListed"/);
    // the Planner
    const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(String(e)));
    await page.goto(srv.url + 'planner.html');
    await page.waitForFunction(() => window.__planner && document.querySelector('#railAi').checkVisibility());
    await standIn(page);
    await page.evaluate(() => document.querySelector('#railAi').click());
    await page.waitForSelector('#bsMenu');
    assert.deepEqual((await menu(page)).slice(0, 3), ['*Gemini -> https://gemini.google.com/app', 'Claude (claude.ai) -> https://claude.ai/project/made-up', 'ChatGPT -> https://chatgpt.com/']);
    assert.equal(await page.$eval('#bsMenu .bsset', a => a.getAttribute('href')), './#/settings/claude');
    const before = await lib(page);
    await page.click('#bsMenu [data-bsname="Claude"]');
    assert.equal((await opens(page))[0].went, 'https://claude.ai/project/made-up');
    assert.deepEqual(await lib(page), before, 'the Planner keeps nothing of its own: Gemini is still the one in use');
    assert.equal((await rail(page)).text, 'Gemini');
    assert.deepEqual(page.errors, []);
  } finally { await ctx.close(); await srv.close(); }
});
