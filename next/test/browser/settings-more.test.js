// The rest of Settings in the new app (stage 6): the assistant and where it opens, the programme, places in an average, learning goals,
// handing back, text size; and My setup: a pasted setup checked, part by part, brought in without the student list it had, put back,
// and her own setup copied out. Kept where the current app keeps them, so it reads the same. npm run next:browser. Every person here is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { launch } = require('../../../test/helpers/chrome.js');
const { plant } = require('../../../test/helpers/app.js');
const { gradingSeed, STEADY } = require('../../../test/helpers/steady.js');
const { plantPlan } = require('./planseed.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', woff2: 'font/woff2', webp: 'image/webp', png: 'image/png', webmanifest: 'application/manifest+json' };
function serveSite() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/blank') { res.writeHead(200, { 'Content-Type': TYPES.html }); return res.end('<!doctype html><title>blank</title>'); }
    if (p === '/') p = '/index.html'; if (p === '/next/') p = '/next/index.html';
    const ok = /^\/(index|planner)\.html$|^\/(sw\.js|version\.json|manifest\.webmanifest)$|^\/icons\/[\w-]+\.png$|^\/lang\/[\w-]+\.js$|^\/next\/(index\.html|sw\.js|version\.json|dist\/[\w-]+\.(js|css|woff2|webp))$/.test(p);
    const f = path.join(ROOT, p);
    if (!ok || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => { srv.unref(); r({ url: 'http://localhost:' + srv.address().port + '/', close: () => new Promise(d => { srv.closeAllConnections(); srv.close(d); }) }); }));
}

let browser, srv;
before(async () => { srv = await serveSite(); browser = await launch(); });
after(async () => { await browser.close(); await srv.close(); });

async function page(ctx, errors) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.location().url || '')) errors.push(m.text()); });
  await p.evaluateOnNewDocument(STEADY);
  await p.setViewport({ width: 1440, height: 900 });
  return p;
}
const lib = p => p.evaluate(() => JSON.parse(localStorage.getItem('gs.lib')));
const ls = (p, k) => p.evaluate(k => JSON.parse(localStorage.getItem(k)), k);
const until = async (f, ms = 8000) => { const t0 = Date.now(); for (;;) { const v = await f(); if (v) return v; if (Date.now() - t0 > ms) return v; await new Promise(r => setTimeout(r, 100)); } };
const typeIn = async (p, sel, v) => { await p.$eval(sel, e => { e.focus(); e.select && e.select(); }); await p.waitForFunction(sel => document.activeElement === document.querySelector(sel), {}, sel); await p.keyboard.type(v); };
const planKv = (p, k) => p.evaluate(k => new Promise(res => { const r = indexedDB.open('gs-lessons'); r.onsuccess = () => { const db = r.result; try { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => { res(q.result || null); db.close(); }; q.onerror = () => res(null); } catch { res(null); } }; r.onerror = () => res(null); }), k);

test('Settings: the assistant and where it opens, the programme, places in an average, goals typed quickly, handing back and text size', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed());
  // the assistant: another one, its link, a new tab, one of the others taken off the list
  await p.goto(srv.url + 'next/#/settings/ai');
  await p.waitForSelector('[data-stai] select', { timeout: 30000 });
  await p.select('[data-stai] select', 'other');
  await p.waitForSelector('[data-staiother] input, input[data-staiother]');
  const other = (await p.$('input[data-staiother]')) ? 'input[data-staiother]' : '[data-staiother] input';
  // the box fills in with the name 'other' starts from once that choice is kept; type over it only then
  await p.waitForFunction(sel => document.querySelector(sel).value !== '', { timeout: 10000 }, other);
  await typeIn(p, other, 'School Helper'); await p.keyboard.press('Tab');
  await until(async () => ((await lib(p)).me || {}).ai === 'School Helper');
  await p.waitForSelector('input[data-staiurl], [data-staiurl] input');
  const url = (await p.$('input[data-staiurl]')) ? 'input[data-staiurl]' : '[data-staiurl] input';
  await typeIn(p, url, 'https://helper.example.org/school'); await p.keyboard.press('Tab');
  await until(async () => ((await lib(p)).me || {}).aiUrl === 'https://helper.example.org/school');
  await p.click('[role="radio"][data-v="tab"]');
  await until(async () => ((await lib(p)).me || {}).aiOpen === 'tab');
  assert.deepEqual(await ls(p, 'gs.words').then(w => [w.ai, w.link, w.tab]), ['School Helper', 'https://helper.example.org/school', true], 'the Planner reads the same words');
  await p.waitForSelector('[data-stailist] input');
  await p.$eval('[data-stailist] input', e => e.click());
  await until(async () => ((await lib(p)).me.aiOff || []).length === 1);
  assert.ok(await p.$('[data-stsee]'), 'what it can and can’t see');
  // the programme, places in an average, and goals typed one after another without waiting
  await p.goto(srv.url + 'next/#/settings/grading');
  await p.waitForSelector('input[data-stprog], [data-stprog] input', { timeout: 30000 });
  const prog = (await p.$('input[data-stprog]')) ? 'input[data-stprog]' : '[data-stprog] input';
  await typeIn(p, prog, 'IB MYP'); await p.keyboard.press('Tab');
  await until(async () => (await lib(p)).me.prog === 'IB MYP');
  await p.click('[data-stdp] [data-v="0"]');
  assert.equal(await until(async () => (await ls(p, 'gs.avgDp')) === 0), true);
  for (const g of ['Uses evidence', 'Organizes ideas', 'Cites sources']) { await typeIn(p, 'input[data-stgoalnew]', g); await p.keyboard.press('Enter'); await p.waitForFunction(g => (JSON.parse(localStorage.getItem('gs.lib')).goals || []).some(x => x.name === g), {}, g); }
  // rename two goals one after the other, moving on with Tab at once: neither is lost
  await typeIn(p, '[data-stgoal]:nth-child(1) input', 'Uses strong evidence');
  await p.$eval('[data-stgoal]:nth-child(2) input', e => { e.focus(); e.select(); });
  await p.keyboard.type('Organizes ideas well'); await p.keyboard.press('Tab');
  await until(async () => { const n = ((await lib(p)).goals || []).map(x => x.name); return n.includes('Uses strong evidence') && n.includes('Organizes ideas well'); });
  assert.deepEqual(((await lib(p)).goals || []).map(x => x.name), ['Uses strong evidence', 'Organizes ideas well', 'Cites sources']);
  const gone = (await lib(p)).goals[2].id;
  await p.click('[data-stgoalrm="' + gone + '"]');
  await until(async () => (await lib(p)).goals.length === 2);
  assert.ok((await lib(p)).goalsGone[gone], 'kept as gone, so another computer removes it too');
  await p.waitForFunction(() => [...document.querySelectorAll('.toast button')].length);
  await p.evaluate(() => [...document.querySelectorAll('.toast button')].find(b => /Undo/.test(b.textContent)).click());
  await until(async () => (await lib(p)).goals.length === 3);
  // handing back, and the app's text size
  await p.goto(srv.url + 'next/#/settings/marking');
  await p.waitForSelector('[data-stxnames] [role="switch"][aria-checked="true"]', { timeout: 30000 });
  // the Undo toast from the goals may still be over it, so the switch is pressed itself
  await p.$eval('[data-stxnames] [role="switch"]', e => e.click());
  assert.equal(await until(async () => (await ls(p, 'gs.xnames')) === false), true);
  // D-013: Word papers, kept as Word or made into PDF pages as each assignment opens
  await p.waitForSelector('[data-stwordpdf] [data-v="0"][aria-checked="true"]');
  await p.$eval('[data-stwordpdf] [data-v="1"]', e => e.click());
  assert.equal(await until(async () => (await ls(p, 'gs.wordPdf')) === true), true);
  await p.goto(srv.url + 'next/#/settings/display');
  await p.waitForSelector('[data-stsize] [data-v="1.15"]', { timeout: 30000 });
  await p.click('[data-stsize] [data-v="1.15"]');
  assert.equal(await until(async () => ((await ls(p, 'gs.disp')) || {}).ui === 1.15), true);
  assert.equal(await p.evaluate(() => document.documentElement.style.getPropertyValue('--uz')), '1.15');
  await p.reload(); await p.waitForSelector('[data-stsize]', { timeout: 30000 });
  assert.equal(await p.evaluate(() => document.documentElement.style.getPropertyValue('--uz')), '1.15', 'kept for the next visit');
  assert.deepEqual(errors, []);
  await ctx.close();
});

const SETUP = '```json\n' + JSON.stringify({
  gradingStudioSetup: 1, panelWidth: 672,
  school: { system: 'Canvas', staff: [{ role: 'Principal', name: 'Avery Example', email: 'avery@example.org' }] },
  classes: [{ name: 'Grade 9 Science B', course: 'Grade 9 Science', meets: [{ day: 'Tue', start: '10:00', end: '10:50' }], units: ['Forces'], students: ['Made Up One', 'Made Up Two'] }],
  comments: ['Show your working.'],
  goals: ['Uses evidence'],
}, null, 1) + '\n```\nAnything else?';

test('My setup: the prompt, a pasted setup checked part by part, brought in without its student list, put back, and copied out', async () => {
  const errors = [], ctx = await browser.createBrowserContext(), p = await page(ctx, errors);
  await ctx.overridePermissions(srv.url.replace(/\/$/, ''), ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  await p.goto(srv.url + 'blank'); await plant(p, gradingSeed()); await plantPlan(p);
  await p.evaluate(() => localStorage.setItem('gsp.panel', JSON.stringify({ open: true, tab: 'video', w: 490 })));
  await p.goto(srv.url + 'next/#/settings/classes');
  await p.waitForSelector('[data-mysetup] [data-supaste]', { timeout: 30000 });
  // the prompt names no folder and asks for nothing about students
  await p.click('[data-supromptcopy]');
  const prompt = await until(() => p.evaluate(() => navigator.clipboard.readText().catch(() => '')));
  assert.match(prompt, /gradingStudioSetup/); assert.match(prompt, /Nothing about students/); assert.doesNotMatch(prompt, /~\/|\/Users\/|C:\\/);
  // nonsense first, then the setup inside an assistant's reply
  await typeIn(p, 'textarea[data-supaste], [data-supaste] textarea', 'hello');
  await p.click('[data-sucheck]'); await p.waitForSelector('[data-suerr]');
  const box = (await p.$('textarea[data-supaste]')) ? 'textarea[data-supaste]' : '[data-supaste] textarea';
  await p.$eval(box, e => { e.focus(); e.select(); });
  await p.evaluate((sel, v) => { const e = document.querySelector(sel); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })); }, box, SETUP);
  await p.click('[data-sucheck]');
  await p.waitForSelector('[data-supreview]');
  const parts = await p.$$eval('[data-supart]', l => l.map(e => e.dataset.supart));
  for (const k of ['school', 'classes', 'comments', 'goals', 'panelWidth']) assert.ok(parts.includes(k), k + ' in the preview: ' + parts);
  assert.match(await p.$eval('[data-supart="panelWidth"]', el => el.textContent), /672 px/);
  assert.ok(await p.$('[data-suleft]'), 'says the student list was left out');
  // comments not wanted this time
  await p.click('[data-supart="comments"] .cb');
  await p.click('[data-subring]');
  await until(async () => (await lib(p)).classes.some(c => c.name === 'Grade 9 Science B'));
  const L = await lib(p), c = L.classes.find(x => x.name === 'Grade 9 Science B');
  assert.deepEqual(c.names, [], 'no student came in'); assert.deepEqual(c.units.map(u => u.name), ['Forces']); assert.equal(c.course, 'Grade 9 Science');
  assert.equal(L.me.sys, 'Canvas'); assert.ok((L.goals || []).some(g => g.name === 'Uses evidence'));
  assert.ok(!((await ls(p, 'gs.bank')) || []).includes('Show your working.'), 'the part left unticked stays as it was');
  assert.ok(((await ls(p, 'gs.school')) || {}).people.some(x => x.name === 'Avery Example'), 'the School page has the person');
  const plan = await until(() => planKv(p, 'setup').then(s => s && s.classes.find(x => x.name === 'Grade 9 Science B') && s));
  assert.deepEqual(plan.classes.find(x => x.name === 'Grade 9 Science B').meets.map(m => [m.dow, m.start, m.end]), [[2, '10:00', '10:50']]);
  assert.deepEqual(await ls(p, 'gsp.panel'), { open: true, tab: 'video', w: 672 });
  await p.evaluate(() => localStorage.setItem('gsp.panel', JSON.stringify({ open: false, tab: 'books', w: 672 })));
  // put back
  await p.waitForSelector('[data-suundo]');
  await p.click('[data-suundo]');
  await until(async () => !(await lib(p)).classes.some(x => x.name === 'Grade 9 Science B'));
  assert.ok(!((await lib(p)).goals || []).some(g => g.name === 'Uses evidence'));
  assert.ok(!((await ls(p, 'gs.school')) || {}).people.some(x => x.name === 'Avery Example' && !x.gone));
  // her own setup, copied out: never a roster
  await p.click('[data-sucopy]');
  const out = await until(() => p.evaluate(() => navigator.clipboard.readText().catch(() => '')).then(s => (/gradingStudioSetup/.test(s) && s !== prompt ? s : '')));
  const j = JSON.parse(out);
  assert.equal(j.gradingStudioSetup, 1);
  assert.equal(j.panelWidth, 490, 'the restored width is in My setup');
  assert.deepEqual(await ls(p, 'gsp.panel'), { open: false, tab: 'books', w: 490 }, 'undo only changes the width');
  const names = JSON.stringify(j);
  for (const c of (await lib(p)).classes) for (const n of c.names) assert.ok(!names.includes(n), 'no student name in the setup');
  assert.deepEqual(errors, []);
  await ctx.close();
});
