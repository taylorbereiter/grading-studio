/* ---------------- Email buttons (11/16): Gmail, Outlook on the web, or the computer's mail app ----------------
   Every Email button in the app is a mailto: link (the School page, a to-do's people, a student's card, Missing work reminders, links in
   Planner notes). gs.mailApp, a per-teacher choice in Settings, Display (and in My setup), decides where it opens: 'gmail' (the usual)
   opens a new Gmail message in a new tab, 'outlook' a new Outlook on the web message, 'app' leaves the link to the computer's own mail
   app. To, Cc, Bcc, subject and body carry over. Gmail opens the Google account the teacher signed in with for saving (gs.gEmail),
   so a school message doesn't start in a personal inbox. On a phone a web compose page is unreliable, so the phone's own mail app
   opens (a teacher who wants Gmail there makes it the phone's default mail app). Nothing is sent by the app. */
const MAIL_APPS = ['gmail', 'outlook', 'app'];
const mailGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const mailApp = () => { const v = mailGet('gs.mailApp'); return MAIL_APPS.includes(v) ? v : 'gmail'; };
const mailPhone = () => { try { const k = localStorage.getItem('gs.phone'); if (k === '1' || k === '0') return k === '1'; return Math.min(screen.width, screen.height) < 600 && matchMedia('(pointer: coarse)').matches; } catch { return false; } };
// mailto:a@x.org,b@x.org?cc=…&bcc=…&subject=…&body=… → its parts, decoded
function mailParts(href) {
  const m = /^mailto:([^?#]*)(?:\?([^#]*))?/i.exec(String(href || '').trim()); if (!m) return null;
  const dec = s => { try { return decodeURIComponent(s); } catch { return s; } }, p = { to: dec(m[1]), cc: '', bcc: '', subject: '', body: '' };
  for (const kv of (m[2] || '').split('&')) {
    const i = kv.indexOf('='), k = (i < 0 ? kv : kv.slice(0, i)).toLowerCase(), v = i < 0 ? '' : dec(kv.slice(i + 1));
    if (k === 'to') p.to = p.to ? p.to + ',' + v : v; else if (k in p) p[k] = v;
  }
  return p;
}
// The web address that opens the same message in Gmail or Outlook on the web; '' when it stays a mailto: link
function mailWeb(href, app) {
  app = app || mailApp(); if (app === 'app') return '';
  const p = mailParts(href); if (!p) return '';
  const e = encodeURIComponent, q = (k, v) => v ? '&' + k + '=' + e(v) : '', who = String(mailGet('gs.gEmail') || '');
  if (app === 'outlook') return ('https://outlook.office.com/mail/deeplink/compose?' + q('to', p.to) + q('cc', p.cc) + q('bcc', p.bcc) + q('subject', p.subject) + q('body', p.body)).replace('?&', '?');
  return 'https://mail.google.com/mail/?view=cm&fs=1' + (/@/.test(who) ? q('authuser', who) : '') + q('to', p.to) + q('cc', p.cc) + q('bcc', p.bcc) + q('su', p.subject) + q('body', p.body);
}
// Open a mailto: link the teacher's way. Call it inside her click, so the browser lets the new tab open.
function mailGo(href) {
  const url = mailPhone() ? '' : mailWeb(href);
  if (window.__gsMailTest) return window.__gsMailTest(href, url);
  if (url) { window.open(url, '_blank', 'noopener'); return; }
  const a = document.createElement('a'); a.href = href; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
}
document.addEventListener('click', e => {
  if (e.defaultPrevented || e.button || mailPhone() || mailApp() === 'app') return;
  const a = e.target.closest && e.target.closest('a[href]'); if (!a || !/^mailto:/i.test(a.getAttribute('href').trim())) return;
  const url = mailWeb(a.getAttribute('href')); if (!url) return;
  e.preventDefault();
  if (window.__gsMailTest) window.__gsMailTest(a.getAttribute('href'), url); else window.open(url, '_blank', 'noopener');
}, true);
// Settings, Display: the three choices. 'gmail' is the usual, so it isn't stored.
function mailAppSet(v) {
  if (!MAIL_APPS.includes(v)) return;
  try { if (v === 'gmail') localStorage.removeItem('gs.mailApp'); else localStorage.setItem('gs.mailApp', JSON.stringify(v)); } catch { }
  mailAppShow();
}
function mailAppShow() { const v = mailApp(); for (const b of document.querySelectorAll('#setMailApp button')) b.setAttribute('aria-pressed', String(b.dataset.v === v)); }
if (document.getElementById('setMailApp')) { document.getElementById('setMailApp').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) mailAppSet(b.dataset.v); }); mailAppShow(); }
if (window.__gs) Object.assign(window.__gs, { mailParts, mailWeb, mailApp, mailAppSet });
