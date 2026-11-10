// The app as a whole: version number, the double-click copy, the preview copy, finding Chrome, and Lessons still opening.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), net = require('net'), os = require('os'), path = require('path'), { spawn } = require('child_process');
const { launch, chromeCandidates, findChrome } = require('./helpers/chrome');
const { serve } = require('./helpers/serve');
const { goTo, ROOT, BUILT, builtHtml, tmpDir, openApp, appReady, openZip, waitPaper, setTool, drag, score, settle, workOf } = require('./helpers/app');
const { standardFiles, zipOf } = require('./helpers/fixtures');

let browser, zip;
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
before(async () => { browser = await launch(); zip = zipOf(await standardFiles()); });
after(async () => { await browser.close(); });

test('the version number shows, and is set in one place', async () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  for (const f of [...require('../src/app/order.json').map(n => 'app/' + n + '.js'), 'app.html', 'migrate.js', 'planner/lessons.js', 'planner/units.js', 'planner/planner.html']) assert.ok(!fs.readFileSync(path.join(ROOT, 'src', f), 'utf8').includes(VERSION), f + ' shouldn’t have the number written in it');
  const { page, close } = await openApp(browser);
  assert.equal(await page.evaluate(() => window.__gs.gsData.APP_VERSION), VERSION);
  assert.ok((await page.$eval('#start .gsVer', e => e.textContent)).includes('version ' + VERSION), 'on the start screen');
  await openZip(page, zip);
  assert.ok((await page.$eval('#app .title', e => e.title)).includes(VERSION), 'on the app title while grading');
  await page.keyboard.press('?');
  await page.waitForSelector('#dlgBox .gsVer');
  assert.ok((await page.$eval('#dlgBox .gsVer', e => e.textContent)).includes(VERSION), 'in the Keys list');
  assert.deepEqual(page.errors, []);
  await close();
});

test('the app starts cleanly, and the Planner button, Dark mode and the sample papers still work', async () => {
  const { page, close } = await openApp(browser);
  await goTo(page, '#/settings/display');
  await page.click('#vSettings .themeBtn');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await page.click('#vSettings .themeBtn');
  // The Planner is its own page next to this one (planner.test.js tries it); grading only links to it.
  await Promise.all([page.waitForNavigation(), page.click('#lessonsBtn')]);
  assert.match(page.url(), /\/planner\.html$/);
  await page.goBack(); await appReady(page);
  assert.ok(await page.evaluate(() => !window.__lessons && !document.querySelector('#lessons')), 'no Planner code in the grading page');
  await goTo(page, '#/');
  await page.click('#sample');
  await waitPaper(page);
  assert.ok(await page.evaluate(() => window.__gs.state().batch.students.length > 0));
  assert.deepEqual(page.errors, []);
  await close();
});

test('a double-clicked copy (file://) opens, saves and reopens', async () => {
  builtHtml();
  const dir = tmpDir('offline'), copy = path.join(dir, 'Grading Studio.html');
  fs.copyFileSync(path.join(ROOT, 'Grading Studio.html'), copy);
  const ctx = await browser.createBrowserContext(), page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file:///' + copy.replace(/\\/g, '/').replace(/^\/+/, ''));
  await appReady(page);
  assert.equal(await page.evaluate(() => location.protocol), 'file:');
  assert.ok(!(await page.$eval('#start .gsVer', e => e.textContent)).includes('preview'), 'not called a preview');
  await openZip(page, zip);
  await setTool(page, 'pen'); await drag(page, 0, [[100, 300], [200, 330]]);
  await score(page, [3.5, 3.5, 3.5]);
  await settle(page);
  await page.reload(); await appReady(page);
  await waitPaper(page);                                   // a refresh comes back to the open paper, in the double-clicked copy too
  let w = await workOf(page);
  assert.equal(w['Aria Testwell'].computed.pct, 93);
  await page.click('#closeBtn');
  await page.waitForSelector('#kept [data-kopen]');
  await page.click('#kept [data-kopen]');
  await waitPaper(page);
  w = await workOf(page);
  assert.equal(w['Aria Testwell'].computed.pct, 93);
  assert.equal(w['Aria Testwell'].files['Aria Testwell/Essay.pdf'].marks[0].length, 1);
  assert.deepEqual(errors, []);
  await ctx.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('both built copies hold the same app, and the Pages copy stays out of search engines', () => {
  const a = fs.readFileSync(BUILT, 'utf8'), b = fs.readFileSync(path.join(ROOT, 'Grading Studio.html'), 'utf8');
  assert.equal(a.replace('<meta name="robots" content="noindex">', ''), b);
  assert.ok(a.includes('<meta name="robots" content="noindex">'));
  assert.ok(!a.includes('@@APP@@') && !a.includes('@@VERSION@@'), 'every slot in the page got filled');
});

/* ---------------- the preview copy ---------------- */
const freePort = () => new Promise(res => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
function startPreview(port) {
  const kid = spawn(process.execPath, ['test/preview.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port) } });
  let out = '';
  const ended = new Promise(res => kid.on('exit', res));
  kid.stdout.on('data', d => { out += d; }); kid.stderr.on('data', d => { out += d; });
  const ready = new Promise((res, rej) => { const t = setInterval(() => { if (/Preview copy/.test(out)) { clearInterval(t); res(); } }, 50); kid.on('exit', () => { clearInterval(t); rej(new Error('Preview stopped: ' + out)); }); });
  return { kid, ready, ended, out: () => out };
}

test('npm run preview serves the built app on localhost, and only that', async () => {
  builtHtml();
  const port = await freePort(), p = startPreview(port);
  try {
    await p.ready;
    assert.ok(p.out().includes('http://localhost:' + port));
    const base = 'http://localhost:' + port;
    assert.equal(await (await fetch(base + '/')).text(), fs.readFileSync(BUILT, 'utf8'));
    for (const q of ['/package.json', '/src/app/start.js', '/test/preview.js', '/../package.json']) assert.equal((await fetch(base + q)).status, 404, q);
    // Reachable from this computer only.
    const other = Object.values(os.networkInterfaces()).flat().find(a => a.family === 'IPv4' && !a.internal);
    if (other) await new Promise((res, rej) => { const s = net.connect({ host: other.address, port, timeout: 1500 }); s.on('connect', () => { s.destroy(); rej(new Error('The preview answers on the network at ' + other.address)); }); s.on('error', res); s.on('timeout', () => { s.destroy(); res(); }); });
    const server = { url: base + '/', close: async () => {} };
    const { page, close } = await openApp(browser, { server });
    assert.ok((await page.$eval('#start .gsVer', e => e.textContent)).includes('preview copy'), 'it says it’s the preview');
    assert.notEqual(new URL(page.url()).origin, 'https://taylorbereiter.github.io', 'so it can’t share saved work with the real link');
    await page.click('#sample');
    await waitPaper(page);
    assert.deepEqual(page.errors, []);
    await close();
  } finally { p.kid.kill(); await p.ended; }
});

test('a busy preview port stops with a plain message', async () => {
  const s = await serve('busy'), p = startPreview(s.port);
  await p.ready.catch(() => {});
  assert.equal(await p.ended, 1);
  assert.match(p.out(), /already in use/);
  await s.close();
});

test('the README explains why a preview can’t live on the github.io address', () => {
  const r = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.match(r, /npm run check/); assert.match(r, /npm run preview/); assert.match(r, /same address/i);
});

/* ---------------- finding Chrome ---------------- */
test('Chrome is looked for in the usual places on Windows and Mac, and nothing is downloaded', () => {
  const win = chromeCandidates('win32', { PROGRAMFILES: 'C:\\Program Files', 'PROGRAMFILES(X86)': 'C:\\Program Files (x86)', LOCALAPPDATA: 'C:\\Users\\sam\\AppData\\Local' });
  assert.ok(win.includes('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'));
  assert.ok(win.includes('C:\\Users\\sam\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'));
  const mac = chromeCandidates('darwin', { HOME: '/Users/sam' });
  assert.ok(mac.includes('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));
  assert.ok(mac.includes('/Users/sam/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));
  assert.equal(chromeCandidates('darwin', { CHROME_PATH: '/x/chrome' })[0], '/x/chrome');
  assert.ok(fs.existsSync(findChrome()), 'found on this computer');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.devDependencies['puppeteer-core'] && !pkg.devDependencies.puppeteer && !(pkg.dependencies || {}).puppeteer, 'puppeteer-core brings no browser with it');
});
test('a test profile can only live in the temp folder', async () => {
  await assert.rejects(launch({ userDataDir: path.join(path.dirname(os.tmpdir()), 'gs-not-temp') }), /temp folder/);
});

test('.gitignore keeps test screenshots and .DS_Store out', () => {
  const lines = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split(/\r?\n/);
  assert.ok(lines.includes('.DS_Store') && lines.includes('*.png') && !lines.includes('.DS_Store/*.png'));
  assert.ok(lines.includes('node_modules/') && lines.includes('out/'));
});
