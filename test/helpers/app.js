// Driving the real built app in Chrome. Tests go through the same buttons, file pickers and mouse moves she uses,
// and read the results from window.__gs.
const fs = require('fs'), os = require('os'), path = require('path');
const { serve } = require('./serve');
const ROOT = path.join(__dirname, '..', '..');
const BUILT = path.join(ROOT, 'index.html');

// Tests on a stale build would pass or fail about old code, so stop with a clear message instead.
function builtHtml() {
  if (!fs.existsSync(BUILT)) throw new Error('index.html is missing. Run: npm run check');
  const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]);   // every file under src, folders within folders too
  const t = fs.statSync(BUILT).mtimeMs, src = ['build.js', 'package.json', ...walk('src')];
  const old = src.filter(f => fs.statSync(path.join(ROOT, f)).mtimeMs > t + 1000);
  if (old.length) throw new Error('index.html is older than ' + old.join(', ') + '. Run: npm run check');
  return fs.readFileSync(BUILT, 'utf8');
}
const tmpDir = pre => fs.mkdtempSync(path.join(os.tmpdir(), 'gs-test-' + pre + '-'));
const PLATFORMS = {
  mac: { platform: 'MacIntel', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' },
  win: { platform: 'Win32', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' },
};
// A fresh section of the throwaway profile per call, with its own empty storage. seed plants saved data before the app first runs.
async function openApp(browser, { html, platform, seed, server, context, noWait, beforeLoad } = {}) {
  const srv = server || await serve(html || builtHtml());
  const ctx = context || await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e && e.stack || e)));
  page.on('dialog', d => { page.lastDialog = d.message(); d.accept(); });
  // A refresh now comes back to the very screen she was on, the open paper included. Most tests mean "close the tab and come back
  // to the app", which lands on Home, so reload does that. reloadHere is the plain refresh.
  // The app redraws lists as work loads; a press that lands in the middle of a redraw finds the old button gone. Nothing was
  // pressed when that happens, so find the button again and press it.
  const press = page.click.bind(page);
  page.click = async (...a) => {
    for (let n = 0; ; n++) {
      try { return await press(...a); }
      catch (e) { if (n >= 4 || !/detached|not clickable|not an Element/i.test(String(e && e.message))) throw e; await new Promise(r => setTimeout(r, 150)); }
    }
  };
  const plain = page.reload.bind(page);
  page.reloadHere = plain;
  page.reload = async (...a) => { await page.evaluate(() => { if (location.hash) history.replaceState(null, '', location.pathname + location.search); }).catch(() => {}); return plain(...a); };
  if (platform) {
    const P = PLATFORMS[platform];
    await page.setUserAgent(P.ua);
    await page.evaluateOnNewDocument(p => Object.defineProperty(navigator, 'platform', { get: () => p }), P.platform);
  }
  if (seed) { await page.goto(srv.url + 'blank'); await plant(page, seed); }
  if (beforeLoad) await beforeLoad(page);
  await page.goto(srv.url);
  if (!noWait) await appReady(page);
  return { page, ctx, srv, close: async () => { await ctx.close().catch(() => {}); if (!server) await srv.close(); } };
}
// The app in a Chrome of its own, in that Chrome's main profile (still a throwaway one). For tests that link a folder and then
// come back to the page: some Chrome builds stop dead when a separate section of a profile reads a folder link it saved earlier.
// Takes the same options as openApp; close() also closes that Chrome.
async function openOwn(o = {}) {
  const own = await require('./chrome').launch(), r = await openApp(own, { ...o, context: own.defaultBrowserContext() }), close = r.close;
  OWN.add(own);
  r.close = async () => { await close(); OWN.delete(own); await own.close(); };
  return r;
}
// For a file's after(): closes any Chrome a failed test left open, so the file can end.
const OWN = new Set(), closeOwn = async () => { for (const b of OWN) await b.close().catch(() => {}); OWN.clear(); };
// Answers the app's own askDlg, sayDlg or askTextDlg, and keeps its text in page.lastDialog. typed fills in askTextDlg first.
async function answerDlg(page, { yes = true, typed } = {}) {
  await page.waitForSelector('#askDlg [data-ok]');
  page.lastDialog = await page.$eval('#askText', e => e.textContent);
  if (typed != null) await page.$eval('#askIn', (e, t) => { e.value = t; }, typed);
  await page.click(yes ? '#askDlg [data-ok]' : '#askDlg [data-no]');
}
const appReady = page => page.waitForFunction(() => window.__gs && !!window.__gs.state, { timeout: 60000, polling: 100 });   // a tab in the background doesn't animate, so polling by the clock

// Writes saved data the way an earlier copy of the app left it. A value of { __b: name } in idb becomes the bytes of bins[name].
async function plant(page, { ls = {}, idb = {}, bins = {} }) {
  const b64 = {}; for (const [k, v] of Object.entries(bins)) b64[k] = Buffer.from(v).toString('base64');
  await page.evaluate(async (ls, idb, b64) => {
    for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v);
    const bytes = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
    const un = v => v && typeof v === 'object' && !Array.isArray(v) && typeof v.__b === 'string' && Object.keys(v).length === 1 ? bytes(b64[v.__b]) : Array.isArray(v) ? v.map(un) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, un(x)])) : v;
    for (const [dbName, spec] of Object.entries(idb)) {
      const db = await new Promise((res, rej) => { const r = indexedDB.open(dbName, spec.version); r.onupgradeneeded = () => { for (const n of Object.keys(spec.stores)) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      for (const [n, recs] of Object.entries(spec.stores)) await new Promise((res, rej) => { const tx = db.transaction(n, 'readwrite'), o = tx.objectStore(n); for (const [k, v] of recs) o.put(un(v), k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
      db.close();
    }
  }, ls, idb, b64);
}
// Whole-store read, with bytes shown as their length. Creates nothing if the database isn't there.
const idbRead = (page, dbName, store) => page.evaluate(async (dbName, store) => {
  const db = await new Promise(res => { const r = indexedDB.open(dbName); r.onupgradeneeded = () => r.transaction.abort(); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
  if (!db || !db.objectStoreNames.contains(store)) { if (db) db.close(); return null; }
  const out = await new Promise((res, rej) => { const tx = db.transaction(store), o = tx.objectStore(store), a = o.getAll(), b = o.getAllKeys(); tx.oncomplete = () => res({ k: b.result, v: a.result }); tx.onerror = () => rej(tx.error); });
  db.close();
  const sq = v => v instanceof Uint8Array ? { bytes: v.length } : v instanceof ArrayBuffer ? { bytes: v.byteLength } : Array.isArray(v) ? v.map(sq) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sq(x)])) : v;
  return { k: out.k, v: sq(out.v) };
}, dbName, store);

// Picks a file through a real file input.
async function pickFile(page, selector, bytes, name) {
  const dir = tmpDir('pick'), f = path.join(dir, name);
  fs.writeFileSync(f, bytes);
  const inp = await page.$(selector);
  await inp.uploadFile(f);
  return () => fs.rmSync(dir, { recursive: true, force: true });
}
// Goes to a screen by its address, as a click in the sidebar does: '#/' Home, '#/settings', '#/class/<id>'.
const goTo = (page, hash) => page.evaluate(h => window.__gs.go(h), hash);
// Opens a class's page from the sidebar, by the class's name. 'No class' is the one for work with no class.
async function openClass(page, name) {
  const id = await page.evaluate(name => { const a = [...document.querySelectorAll('#railClasses [data-railcls]')].find(a => a.querySelector('.rname').textContent === name); return a ? a.dataset.railcls : null; }, name);
  if (id == null) throw new Error('No class in the sidebar called ' + name);
  await page.click('#railClasses [data-railcls="' + id + '"]');
  await page.waitForSelector('#vClass:not([hidden]) .cls');
}
// Goes to the page of the class that key belongs to. key is a class id, a unit id, an assignment id, part of an assignment's
// name, or a number for the class's place in the sidebar (0 is the first). A class's units and cards are only drawn on its own page.
async function classPage(page, key) {
  const h = await page.evaluate(key => {
    const l = window.__gs.state().lib, hs = l.classes.concat([l.loose]);
    const c = typeof key === 'number' ? l.classes[key] : hs.find(c => c.id === key) || hs.find(c => c.units.some(u => u.id === key || u.items.some(i => i.id === key))) || hs.find(c => c.units.some(u => u.items.some(i => (i.name || '').includes(key))));
    return c ? '#/class/' + (c === l.loose || !c.id ? '-' : encodeURIComponent(c.id)) : null;
  }, key);
  if (!h) throw new Error('No class page for ' + key);
  await goTo(page, h);
}
// Opens a ZIP from Home and waits for the first paper to be drawn.
async function openZip(page, bytes, name = 'Download.zip') {
  const clean = await pickFile(page, '#fileIn', bytes, name);
  await waitPaper(page);
  clean();
}
async function waitPaper(page) {
  await page.waitForFunction(() => { const a = document.querySelector('#app'); if (!a || a.hidden) return false; const s = window.__gs.state(); return s.batch && s.pages && s.pages.length > 0 && s.pages[0].s > 0 && !!s.pages[0].bmp; }, { timeout: 60000 });
}
async function goToStudent(page, i) {
  await page.evaluate(i => window.__gs.openStudent(i), i);
  await page.waitForFunction(i => { const s = window.__gs.state(); return s.cur === i && (s.pages.length === 0 || s.pages[0].s > 0); }, {}, i);
}
// PDF points on page k of the open student, to screen pixels. Scrolls the page into view first.
const toScreen = (page, k, x, y) => page.evaluate((k, x, y) => { const pg = window.__gs.state().pages[k], r = pg.canvas.getBoundingClientRect(); return { x: r.left + x * pg.s, y: r.top + y * pg.s }; }, k, x, y);
async function at(page, k, x, y) {
  // A scroll's event comes a frame later. Clicking before it lands would let it close a menu the click just opened, as a real scroll does.
  await page.evaluate(k => { window.__gs.state().pages[k].canvas.scrollIntoView({ block: 'center' }); return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }, k);
  return toScreen(page, k, x, y);
}
async function drag(page, k, pts) {
  const first = await at(page, k, ...pts[0]);
  await page.mouse.move(first.x, first.y); await page.mouse.down();
  for (const p of pts.slice(1)) { const q = await toScreen(page, k, ...p); await page.mouse.move(q.x, q.y, { steps: 4 }); }
  await page.mouse.up();
}
const clickAt = (page, k, x, y) => at(page, k, x, y).then(p => page.mouse.click(p.x, p.y));
const setTool = (page, t) => page.evaluate(t => window.__gs.setTool(t), t);
// Clicks the rubric buttons for the open student: scores like [3.5, 3.5, 3.5], null to skip a row.
async function score(page, values) {
  for (let i = 0; i < values.length; i++) if (values[i] != null) await page.click('.scores[data-c="' + i + '"] button[data-v="' + values[i] + '"]');
}
// One of every mark, by the same gestures as with a mouse. The spots are the ones MARK_SPOTS checks in an export.
async function markPage(page, k = 0) {
  await setTool(page, 'pen'); await drag(page, k, [[100, 300], [160, 330], [220, 300], [280, 330]]);
  await setTool(page, 'hl'); await drag(page, k, [[60, 400], [400, 412]]);
  await setTool(page, 'oval'); await drag(page, k, [[320, 450], [420, 510]]);
  await setTool(page, 'check'); await clickAt(page, k, 200, 500);
  await setTool(page, 'text'); await clickAt(page, k, 100, 560);
  await page.waitForSelector('textarea.ed'); await page.keyboard.type('Nice start'); await page.keyboard.press('Escape');
  await setTool(page, 'note'); await clickAt(page, k, 300, 620);
  await page.waitForSelector('.pop textarea'); await page.keyboard.type('See rubric row 2'); await page.click('.pop [data-a="ok"]');
  await setTool(page, 'select');
}
// The boxes around the marks markPage draws, in page points.
const MARK_BOXES = { PEN: [90, 290, 200, 50], HL: [70, 402, 300, 8], OVAL: [316, 446, 108, 68], CHECK: [188, 488, 26, 24], TEXT: [100, 558, 70, 20], BLANK: [450, 300, 100, 60] };
// Waits until the marks are really kept, in both places the app saves them.
async function settle(page) {
  await page.waitForFunction(() => /Saved/.test(document.querySelector('#saveState').textContent), { timeout: 15000 });
  await page.waitForFunction(async () => {
    const s = window.__gs.state(); if (!s.batch) return true;
    const ls = JSON.parse(localStorage.getItem(s.batch.id) || 'null'); if (!ls) return false;
    const db = await new Promise(res => { const r = indexedDB.open('grading-studio-keep'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); if (!db) return false;
    const w = await new Promise(res => { const q = db.transaction('work').objectStore('work').get(s.batch.id); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
    db.close(); return !!w && w.t === ls.t;
  }, { timeout: 15000, polling: 100 });
}
// Real downloads, caught in a temp folder. next(act): does act, then resolves to { name, bytes } once the file has finished.
async function catchDownloads(page) {
  const dir = tmpDir('dl'), browser = page.browser(), ctx = page.browserContext();
  const cdp = await browser.target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', browserContextId: ctx.id, downloadPath: dir, eventsEnabled: true });
  const names = new Map(), waits = [], done = [];
  cdp.on('Browser.downloadWillBegin', e => names.set(e.guid, e.suggestedFilename));
  cdp.on('Browser.downloadProgress', e => {
    if (e.state !== 'completed') return;
    const file = path.join(dir, e.guid); if (!fs.existsSync(file)) return;   // this event reaches every listener: another test's download
    const got = { name: names.get(e.guid), bytes: new Uint8Array(fs.readFileSync(file)) };
    const w = waits.shift(); if (w) w(got); else done.push(got);
  });
  return {
    next: async act => {
      const p = done.length ? Promise.resolve(done.shift()) : new Promise(r => waits.push(r));
      if (act) await act();
      let t; const out = await Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('No download arrived')), 90000); })]);
      clearTimeout(t); return out;
    },
    close: async () => { await cdp.detach().catch(() => {}); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}
// Sorts pixels in a box (x, y, w, h in the page's points, from the top left) into the marks' colors.
const inkIn = `(d, rects, scale) => rects.map(([x, y, w, h]) => {
  const q = d.getImageData(Math.round(x * scale), Math.round(y * scale), Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))).data;
  const o = { red: 0, yellow: 0, dark: 0, green: 0, tint: 0, n: q.length / 4 };   // tint: any yellow at all, pale or strong, text over it or not
  for (let i = 0; i < q.length; i += 4) { const [r, g, b] = [q[i], q[i + 1], q[i + 2]]; if (r > 150 && g > 130 && b < r - 40) o.tint++; if (r > 170 && g < 110 && b < 110) o.red++; else if (r > 225 && g > 195 && b < 170) o.yellow++; else if (r < 90 && g < 90 && b < 90) o.dark++; else if (g > 100 && g > r + 40 && g > b + 25) o.green++; }
  return o;
})`;
// Draws one page of a PDF with the app's own pdf.js, and reports the ink in each box.
// scale: how large to draw it (1 is one pixel to a point). Compared with the screen, it is drawn at the screen's size, so text is as thick in both.
const probePdf = (page, bytes, pageNo, rects, scale = 1) => page.evaluate(async (b64, pageNo, rects, inkIn, scale) => {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const d = await pdfjsLib.getDocument({ data: u, isEvalSupported: false }).promise, p = await d.getPage(pageNo), vp = p.getViewport({ scale });
  const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); await p.render({ canvasContext: x, viewport: vp }).promise;
  const out = { W: vp.width / scale, H: vp.height / scale, n: d.numPages, ink: eval(inkIn)(x, rects, scale) };
  d.destroy(); return out;
}, Buffer.from(bytes).toString('base64'), pageNo, rects, inkIn, scale);
// The same, for page k as the app has it drawn on screen right now.
const probeScreen = (page, k, rects) => page.evaluate((k, rects, inkIn) => { const pg = window.__gs.state().pages[k]; return eval(inkIn)(pg.canvas.getContext('2d'), rects, pg.canvas.width / (pg.W + pg.side)); }, k, rects, inkIn);
// Marks and scores of a whole download, to compare before and after.
const workOf = page => page.evaluate(() => {
  const s = window.__gs.state();
  return Object.fromEntries(s.batch.students.map(st => [st.key, { grade: st.grade, computed: window.__gs.gradeOf(st), inc: st.inc, files: Object.fromEntries(st.files.map(f => [f.path, { kind: f.kind, marks: Object.fromEntries(Object.entries(f.marks).filter(([, a]) => a.length)), rot: f.rot || null, added: !!f.added, edited: !!f.edited }])) }]));
});
// What used to be under More (Lighting, Share with Claude, Mark key, the Gradebook box…) is pressed from Find anything now, which clicks
// the button it always was. This is that click.
const press = (page, sel) => page.$eval(sel, b => b.click());
// Clicks something that lives in one of the small menus on the marking screen (+ Add, the ⋯ on a file or beside the student's name,
// the ⋯ beside Missing, Excused, Late): opens its menu first, as she would, then clicks it.
async function pick(page, sel) {
  await page.waitForSelector(sel);
  await page.evaluate(sel => { const m = document.querySelector(sel).closest('.km'); if (m && m.hidden) m.previousElementSibling.click(); }, sel);
  await page.click(sel);
}
// Closes what is open: a box by its ✕ or its Close button, a tab's screen (Grades, Insights, Return; it has neither) by going back to the papers.
const closeBox = (page, sel = '#dlgBox [data-close]') => page.evaluate(sel => {
  const d = document.querySelector('#dlg'), G = window.__gs, b = G.state().batch; if (d.hidden) return;
  if (d.classList.contains('aspage') && b) G.go('#/a/' + encodeURIComponent(b.id.replace(/^gs\.b\./, ''))); else document.querySelector(sel).click();
}, sel);
// Picks something in the right-click menu: right there if it's in the menu, or by pointing at the panel it's in first.
async function menuPick(page, sel) {
  const where = await page.evaluate(sel => {
    const all = [...document.querySelectorAll('.stampmenu ' + sel)];
    if (all.some(b => !b.closest('.st-fly'))) return '';
    const f = all.length && all[0].closest('.st-fly'); if (!f) throw new Error('not in the menu: ' + sel);
    return f.dataset.fly;
  }, sel);
  if (!where) return page.click('.stampmenu ' + sel + ':not(.st-fly *)');
  await page.hover('.stampmenu [data-sub="' + where + '"]');
  await page.waitForSelector('.stampmenu [data-fly="' + where + '"]:not([hidden])');
  await page.click('.stampmenu [data-fly="' + where + '"] ' + sel);
}
module.exports = { openOwn, closeOwn, goTo, openClass, classPage, menuPick, press, pick, closeBox, MARK_BOXES, ROOT, BUILT, builtHtml, tmpDir, openApp, answerDlg, appReady, plant, idbRead, pickFile, openZip, waitPaper, goToStudent, toScreen, at, drag, clickAt, setTool, score, markPage, settle, catchDownloads, probePdf, probeScreen, workOf };
