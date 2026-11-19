// "From Google Drive…" beside the places that take files: the student's Add menu, Readings, and in the Planner a lesson's materials
// and the finished deck. Google is played by this test: the chooser and Drive are answered here. Every name is made up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { launch } = require('./helpers/chrome');
const { serve } = require('./helpers/serve');
const { ROOT, openApp, openZip, pick } = require('./helpers/app');
const { makePaper, zipOf } = require('./helpers/fixtures');
const BASE = require('./helpers/base');   // the current app's pages: classic/ since the switch

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser.close(); });

const GCID = '1234-test.apps.googleusercontent.com';
// D.picks: what the chooser hands back, one list per opening. D.files: id -> bytes. D.asked: what the app asked Google for.
async function fakeGoogle(page, D) {
  await page.evaluateOnNewDocument(picks => {
    window.__picks = picks; window.__pickerSeen = [];
    const P = {
      ViewId: { DOCS: 'docs' }, DocsViewMode: { LIST: 'list' }, Feature: { MULTISELECT_ENABLED: 'multi', SUPPORT_DRIVES: 'drives' },
      Action: { PICKED: 'picked', CANCEL: 'cancel' }, Response: { ACTION: 'action', DOCUMENTS: 'docs' },
      DocsView: class { constructor() { this.o = {}; } setIncludeFolders() { return this; } setMode() { return this; } setSelectFolderEnabled() { return this; } setMimeTypes(v) { this.o.mimes = v; return this; } setParent(v) { this.o.parent = v; return this; } setLabel() { return this; } setOwnedByMe() { return this; } setEnableDrives() { return this; } },
      PickerBuilder: class {
        constructor() { this.o = { features: [] }; }
        setOAuthToken(t) { this.o.token = t; return this; } setAppId() { return this; } setOrigin() { return this; } setTitle(t) { this.o.title = t; return this; } setDeveloperKey() { return this; }
        addView(v) { (this.o.views = this.o.views || []).push(v.o); return this; } enableFeature(f) { this.o.features.push(f); return this; } setCallback(cb) { this.cb = cb; return this; }
        build() { return { setVisible: () => { window.__pickerSeen.push(this.o); const docs = window.__picks.shift() || []; setTimeout(() => this.cb(docs.length ? { action: 'picked', docs } : { action: 'cancel' }), 20); } }; }
      },
    };
    window.google = { picker: P, accounts: { oauth2: { initTokenClient: o => ({ requestAccessToken: () => setTimeout(() => o.callback({ access_token: 'tok', expires_in: 3600, scope: o.scope }), 10) }), revoke: () => {} } } };
  }, D.picks);
  await page.setRequestInterception(true);
  page.on('request', r => {
    const u = r.url();
    if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u) || /^(data|blob|about):/.test(u)) return r.continue();
    D.asked.push(u);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Expose-Headers': 'Content-Length, Content-Type' };
    if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: cors, body: '' });
    if (/\/about\?/.test(u)) return r.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ user: { emailAddress: 'teacher@example.com' } }) });
    const m = /drive\/v3\/files\/([\w-]+)(\/export\?mimeType=([^&]+)|\?alt=media)/.exec(u);
    if (m && D.files[m[1]]) return r.respond({ status: 200, headers: cors, contentType: m[3] ? decodeURIComponent(m[3]) : 'application/pdf', body: D.files[m[1]] });
    r.respond({ status: 200, headers: cors, body: '' });   // anything else (sync, Google's scripts) is not part of this test
  });
}

test('the Add menu and Readings take files from Drive: a PDF as it is, a Google Doc saved out as a PDF', async () => {
  const paper = Buffer.from(await makePaper({ title: 'Late outline' }));
  const D = { asked: [], files: { '1PdfPdfPdfPdfPdfPdfPdfPdfPdf0001': paper, '1DocDocDocDocDocDocDocDocDoc0002': paper, '1ReaReaReaReaReaReaReaReaRea0003': paper },
    picks: [[{ id: '1PdfPdfPdfPdfPdfPdfPdfPdfPdf0001', name: 'Late outline.pdf', mimeType: 'application/pdf' }, { id: '1DocDocDocDocDocDocDocDocDoc0002', name: 'Second draft', mimeType: 'application/vnd.google-apps.document' }],
      [{ id: '1ReaReaReaReaReaReaReaReaRea0003', name: 'The reading.pdf', mimeType: 'application/pdf' }]] };
  const { page, close } = await openApp(browser, { seed: { ls: { 'gs.gcid': JSON.stringify(GCID) } }, beforeLoad: p => fakeGoogle(p, D) });
  try {
    await openZip(page, await zipOf({ 'Aria Testwell/Outline.pdf': await makePaper({ title: 'Aria outline' }), 'Bram Sample/Outline.pdf': await makePaper({ title: 'Bram outline' }) }), 'Outlines.zip');
    await pick(page, '#addDriveBtn');
    await page.waitForFunction(() => window.__gs.state().batch.students[window.__gs.state().cur].files.length === 3, { timeout: 15000 });
    const names = await page.evaluate(() => window.__gs.state().batch.students[window.__gs.state().cur].files.map(f => f.name));
    assert.ok(names.includes('Late outline.pdf') && names.includes('Second draft.pdf'), names.join(', '));
    const seen = await page.evaluate(() => window.__pickerSeen[0]);
    assert.equal(seen.views[0].mimes, undefined, 'any kind of file can be picked for a student');
    assert.ok(seen.features.includes('multi'));
    assert.ok(D.asked.some(u => /files\/1DocDocDocDocDocDocDocDocDoc0002\/export\?mimeType=application%2Fpdf/.test(u)), 'the Google Doc is saved out as a PDF');
    assert.ok(!D.asked.some(u => /drive\/v3\/files\?q=/.test(u)), 'the app never lists the Drive');

    await page.click('#readBtn');
    await page.waitForSelector('#dlgBox [data-refadd="d"]');
    await page.click('#dlgBox [data-refadd="d"]');
    await page.waitForFunction(() => document.querySelector('#dlgBox') && /The reading\.pdf/.test(document.querySelector('#dlgBox').textContent), { timeout: 15000 });
  } finally { await close(); }
});

test('without Google set up there is no Drive button (a double-click copy, or no key)', async () => {
  const { page, close } = await openApp(browser, { html: fs.readFileSync(path.join(BASE, 'Grading Studio.html'), 'utf8').replace(/652182763861-[\w]+\.apps\.googleusercontent\.com/g, '') });
  try {
    await openZip(page, await zipOf({ 'Aria Testwell/Outline.pdf': await makePaper({ title: 'Aria outline' }) }), 'Outlines.zip');
    await page.waitForSelector('#addFileBtn');
    assert.equal(await page.$('#addDriveBtn'), null);
  } finally { await close(); }
});

test('the Planner takes lesson materials and the finished deck from Drive: a Google Doc comes down as a Word file', async () => {
  const server = await serve(() => fs.readFileSync(path.join(BASE, 'planner.html'), 'utf8'));
  const page = await browser.newPage();
  const D = { asked: [], files: { '1DocDocDocDocDocDocDocDocDoc0004': Buffer.from('PK fake docx') },
    picks: [[{ id: '1DocDocDocDocDocDocDocDocDoc0004', name: 'Task sheet', mimeType: 'application/vnd.google-apps.document' }]] };
  try {
    await page.evaluateOnNewDocument(g => { localStorage.setItem('gs.gcid', JSON.stringify(g)); localStorage.setItem('gs.gEmail', JSON.stringify('teacher@example.com')); }, GCID);
    await fakeGoogle(page, D);
    await page.goto(server.url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__planner && document.querySelector('#lessons .ls-top'));
    await page.evaluate(() => { const P = window.__planner, l = P.normLesson({ title: 'Drive lesson', slides: [{ layout: 'title', title: 'Drive lesson' }] }); P.L.lessons.push(l); P.openLessonForTest(l, 0); });
    await page.waitForSelector('.pl-mats [data-drv][data-ma="add"]');
    assert.ok(await page.$('[data-drv][data-a="finup"]'), 'the finished deck has its Drive button too');
    await page.click('.pl-mats [data-drv][data-ma="add"]');
    await page.waitForFunction(() => (window.__planner.L.open.files || []).length === 1, { timeout: 15000 });
    const f = await page.evaluate(() => window.__planner.L.open.files[0]);
    assert.equal(f.name, 'Task sheet.docx');
    assert.match(f.type, /wordprocessingml/);
    assert.ok(D.asked.some(u => /export\?mimeType=application%2Fvnd\.openxmlformats-officedocument\.wordprocessingml\.document/.test(u)));
  } finally { await page.close(); await server.close(); }
});
