// The sample: two made-up classes with a term of work, opened from the welcome or Today. It is kept apart from a teacher's own
// work (src/samplemode.js), so these check that real work is never touched, that the sample is filled in, that saving it outside
// the browser is switched off, and that leaving clears all of it. Made-up classes and students only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('./helpers/chrome');
const { langFile } = require('./helpers/serve');
const { ROOT, builtHtml, openApp, appReady, goTo } = require('./helpers/app');

let browser;
before(async () => { builtHtml(); browser = await launch(); });
after(async () => { await browser.close(); });

// Grading and the Planner on one address, with sample.js beside them, as on the web.
function serveBoth() {
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0], file = p === '/' || p === '/index.html' ? 'index.html' : p === '/planner.html' ? 'planner.html' : null;
    if (langFile(res, p)) return;
    if (!file && p !== '/blank') { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(file ? fs.readFileSync(path.join(ROOT, file), 'utf8') : '<!doctype html><title>blank</title>');
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}
// What the browser really holds, read from a page with none of the app on it: every stored line and every database.
async function real(ctx, srv) {
  const p = await ctx.newPage(); await p.goto(srv.url + 'blank');
  const out = await p.evaluate(async () => ({ ls: Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])), dbs: (await indexedDB.databases()).map(d => d.name).sort() }));
  await p.close();
  return out;
}
const own = r => ({ ls: Object.fromEntries(Object.entries(r.ls).filter(([k]) => !k.startsWith('sample:') && !/^gs\.sample(On|Left)$/.test(k))), dbs: r.dbs.filter(n => !n.startsWith('sample-')) });
const built = page => page.waitForFunction(() => window.__gs && window.__gs.sampleBuilt && window.__gs.sampleBuilt() && !document.querySelector('#sampleCover'), { timeout: 90000, polling: 200 });
const enter = async page => { await page.evaluate(() => { window.__gs.sampleEnter(); }); await built(page); await appReady(page); };

test('every database the pages make is on the sample’s list, so none of them can be shared with real work', () => {
  const names = new Set(), walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.js$/.test(f.name) && f.name !== 'samplemode.js') for (const m of fs.readFileSync(p, 'utf8').matchAll(/'(grading-studio-[a-z]+|gs-lessons)'/g)) if (m[1] !== 'grading-studio-lesson') names.add(m[1]); } };   // grading-studio-lesson is the kind written in a shared lesson file, not a database
  walk(path.join(ROOT, 'src'));
  const listed = JSON.parse(/var DBS = (\[[^\]]+\])/.exec(fs.readFileSync(path.join(ROOT, 'src', 'samplemode.js'), 'utf8'))[1].replace(/'/g, '"')), dbs = [...names];
  assert.ok(dbs.length >= 8, 'the databases were found in the source: ' + dbs.join(', '));
  for (const n of dbs) assert.ok(listed.includes(n), n + ' is missing from DBS in src/samplemode.js');
});

test('the sample opens filled in, a teacher’s own work is never touched, and leaving clears it', async () => {
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    const { page } = await openApp(browser, { server: srv, context: ctx });
    const mine = await page.evaluate(() => JSON.stringify(window.__gs.state().lib.classes.map(c => [c.name, c.names.length])));
    const before = own(await real(ctx, srv));
    await enter(page);
    // filled in: two classes, a term of work, papers kept, and the notice with the way out
    const s = await page.evaluate(() => { const L = window.__gs.state().lib, e = L.classes[0]; return { cls: L.classes.map(c => [c.name, c.names.length, c.way || '']), items: e.units.reduce((n, u) => n + u.items.length, 0), papers: e.units.flatMap(u => u.items).filter(x => x.batchId).length, todo: (L.todo.items || []).length, att: Object.keys(e.att || {}).length, seats: !!e.seats, rep: Object.values(e.info).filter(i => i.rep).length, kept: window.__gs.kept().size }; });
    assert.deepEqual(s.cls, [['English 9', 14, ''], ['Science 8', 10, 'myp']]);
    assert.ok(s.items >= 12 && s.papers === 5 && s.kept === 5 && s.todo >= 5 && s.att >= 10 && s.seats && s.rep === 5, JSON.stringify(s));
    assert.match(await page.$eval('#railSample', e => e.innerText), /Sample[\s\S]*made up[\s\S]*Leave the sample/i);
    assert.match(await page.$eval('#sampleNote', e => e.innerText), /You’re looking at the sample[\s\S]*Things to try/);
    assert.equal(await page.evaluate(() => document.querySelector('#railSaved').checkVisibility()), false, 'no “Not backed up” warning about made-up work');
    // a marked paper opens with its marks, score and comment
    await page.click('#sampleNote [data-sampletry="paper"]');
    await page.waitForFunction(() => { const s = window.__gs.state(); return s.batch && s.batch.name === 'Persuasive essay' && document.querySelector('#paper canvas'); }, { timeout: 30000 });
    const p = await page.evaluate(() => { const b = window.__gs.state().batch, st = b.students[0]; return { n: b.students.length, marks: st.files[0].marks[0].length, rubric: Object.keys(st.grade.rubric || {}).length, comment: !!st.grade.comment }; });
    assert.ok(p.n === 14 && p.marks >= 5 && p.rubric === 4 && p.comment, JSON.stringify(p));
    assert.match(await page.$eval('#saveWhere', e => e.textContent), /^Sample/);
    // nothing real changed while all of that was made, and what the sample keeps is under its own names
    const during = await real(ctx, srv);
    assert.deepEqual(own(during), before);
    assert.equal(during.ls['gs.sampleOn'], '1');
    assert.ok(Object.keys(during.ls).some(k => k === 'sample:gs.lib') && during.dbs.includes('sample-grading-studio-keep'));
    // saving outside the browser is switched off
    await goTo(page, '#/settings');
    await page.evaluate(() => { [...document.querySelectorAll('#vSettings button')].find(b => /Take my work with me/.test(b.textContent)).click(); });
    await page.waitForFunction(() => /This is the sample, so/.test(document.body.innerText), { timeout: 10000 });
    await page.keyboard.press('Enter');
    // the Planner is the sample's too, with the same notice
    await page.goto(srv.url + 'planner.html#week');
    await page.waitForSelector('#railSample [data-sampleleave]');
    await page.waitForFunction(() => /English 9/.test(document.querySelector('#lessons').innerText) && /Feedback day/.test(document.querySelector('#lessons').innerText), { timeout: 20000 });
    assert.deepEqual(own(await real(ctx, srv)), before);
    // a sample made by an earlier version's builder is made again from nothing, not added to
    await page.goto(srv.url + 'blank'); await page.evaluate(() => localStorage.setItem('sample:gs.sampleBuilt', '"older"'));
    await page.goto(srv.url); await built(page); await appReady(page);
    assert.deepEqual(await page.evaluate(() => window.__gs.state().lib.classes.map(c => c.name)), ['English 9', 'Science 8']);
    // leaving: her own classes are back exactly, and nothing of the sample is left
    await Promise.all([page.waitForNavigation(), page.click('#railSample [data-sampleleave]')]);
    await appReady(page);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__gs.state().lib.classes.map(c => [c.name, c.names.length]))), mine);
    assert.equal(await page.$('#railSample'), null);
    let after;
    for (let i = 0; i < 40; i++) { after = await real(ctx, srv); if (!after.dbs.some(n => n.startsWith('sample-')) && !('gs.sampleLeft' in after.ls)) break; await new Promise(r => setTimeout(r, 250)); }
    assert.deepEqual(Object.keys(after.ls).filter(k => k.startsWith('sample:') || k === 'gs.sampleOn' || k === 'gs.sampleLeft'), []);
    assert.deepEqual(after.dbs.filter(n => n.startsWith('sample-')), []);
    assert.deepEqual(own(after), before);
    assert.deepEqual(page.errors, []);
  } finally { await ctx.close().catch(() => {}); await srv.close(); }
});

test('a brand-new teacher can look around the sample from the welcome, and is still asked about their own classes after', async () => {
  const srv = await serveBoth(), ctx = await browser.createBrowserContext();
  try {
    const { page } = await openApp(browser, { server: srv, context: ctx, newTeacher: true });
    await page.click('#welcome [data-wlsample]');
    await built(page); await appReady(page);
    assert.equal(await page.evaluate(() => window.__gs.wlShown()), false, 'the welcome stays out of the sample');
    assert.equal(await page.evaluate(() => window.__gs.state().lib.classes.length), 2);
    await Promise.all([page.waitForNavigation(), page.click('#sampleNote [data-sampleleave]')]);
    await appReady(page);
    assert.equal(await page.evaluate(() => window.__gs.state().lib.classes.length), 0, 'none of the sample came across');
    assert.equal(await page.evaluate(() => window.__gs.wlShown()), true, 'and the welcome asks, as for any new teacher');
    assert.deepEqual(page.errors, []);
  } finally { await ctx.close().catch(() => {}); await srv.close(); }
});
