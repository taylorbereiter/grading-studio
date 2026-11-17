// Email buttons (11/16): a mailto: link opens a new Gmail message (the usual), an Outlook on the web message, or the computer's own
// mail app, as the teacher picks in Settings, Display. To, Bcc, subject and body carry over; nothing is sent. Made-up people only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('./helpers/chrome');
const { builtHtml, openApp, goTo } = require('./helpers/app');

let browser;
before(async () => { builtHtml(); browser = await launch(); });
after(async () => { await browser.close(); });

test('a mailto: link becomes a Gmail or Outlook compose address with everything in it', async () => {
  const { page, close } = await openApp(browser);
  const r = await page.evaluate(() => {
    const g = window.__gs, href = 'mailto:a@school.example,b@school.example?bcc=c@school.example&subject=' + encodeURIComponent('Lab & report') + '&body=' + encodeURIComponent('Line one\r\nLine two');
    const parts = g.mailParts(href), gm = new URL(g.mailWeb(href, 'gmail')), ol = new URL(g.mailWeb(href, 'outlook'));
    return { parts, gm: [gm.host, ...['view', 'to', 'bcc', 'su', 'body'].map(k => gm.searchParams.get(k))], ol: [ol.host, ol.pathname, ...['to', 'bcc', 'subject', 'body'].map(k => ol.searchParams.get(k))], app: g.mailWeb(href, 'app'), usual: g.mailApp(), raw: g.mailWeb('mailto:x@school.example', 'gmail') };
  });
  assert.deepEqual(r.parts, { to: 'a@school.example,b@school.example', cc: '', bcc: 'c@school.example', subject: 'Lab & report', body: 'Line one\r\nLine two' });
  assert.deepEqual(r.gm, ['mail.google.com', 'cm', 'a@school.example,b@school.example', 'c@school.example', 'Lab & report', 'Line one\r\nLine two']);
  assert.deepEqual(r.ol, ['outlook.office.com', '/mail/deeplink/compose', 'a@school.example,b@school.example', 'c@school.example', 'Lab & report', 'Line one\r\nLine two']);
  assert.equal(r.app, '', 'the mail app keeps the mailto: link');
  assert.equal(r.usual, 'gmail');
  assert.ok(!/\+/.test(r.raw) && !/authuser/.test(r.raw), r.raw);
  // signed in to Google for saving: Gmail opens that account
  assert.match(await page.evaluate(() => { localStorage.setItem('gs.gEmail', '"teacher@school.example"'); return window.__gs.mailWeb('mailto:x@school.example', 'gmail'); }), /authuser=teacher%40school\.example/);
  assert.deepEqual(page.errors, []);
  await close();
});

test('Settings, Display: the choice sticks, an Email button follows it, and My setup carries it', async () => {
  const { page, close } = await openApp(browser);
  await goTo(page, '#/settings/display');
  await page.waitForSelector('#setMailApp button[data-v="gmail"][aria-pressed="true"]', { visible: true });
  await page.evaluate(() => {
    window.__mail = []; window.__gsMailTest = (h, u) => window.__mail.push([h, u]);
    const a = document.createElement('a'); a.href = 'mailto:vp@school.example?subject=Hello'; a.id = 'tmail'; a.textContent = 'Email'; document.body.appendChild(a);
  });
  await page.click('#tmail');
  await page.click('#setMailApp button[data-v="outlook"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.mailApp')), '"outlook"');
  await page.click('#tmail');
  await page.click('#setMailApp button[data-v="app"]');
  await page.click('#tmail');   // left to the browser: the mail app
  const got = await page.evaluate(() => window.__mail);
  assert.equal(got.length, 2);
  assert.match(got[0][1], /^https:\/\/mail\.google\.com\/mail\/\?view=cm&fs=1&to=vp%40school\.example&su=Hello$/);
  assert.match(got[1][1], /^https:\/\/outlook\.office\.com\/mail\/deeplink\/compose\?to=vp%40school\.example&subject=Hello$/);
  // My setup: it is exported when it isn't the usual, and an import puts it back
  const ex = await page.evaluate(async () => { const e = await window.__gs.stpExport(); return (typeof e === 'string' ? JSON.parse(e) : e).marking; });
  assert.equal(ex.emailsOpenIn, 'app');
  const S = await page.evaluate(() => window.__gs.stpRead({ marking: { emailsOpenIn: 'Outlook' } }));
  assert.equal(S.mark.mail, 'outlook');
  await page.click('#setMailApp button[data-v="gmail"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('gs.mailApp')), null, 'the usual is not stored');
  assert.deepEqual(page.errors, []);
  await close();
});
