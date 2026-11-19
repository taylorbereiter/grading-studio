// Every Email link that isn't one of her Email buttons (the School page, to-do people, links in lesson notes; src/mail.js's click
// catcher; D-023): a mailto: link opens in Gmail or Outlook on the web when she chose one in Settings, inside her click. One that
// stays a mailto: link (the computer's mail app, or a phone) is left to the browser. The shell loads this just after start.
import { mailApp, googleEmail } from '../planning/index.js';
import { phone, webUrl } from './mailurl.js';

export function mailClick(e) {
  if (e.defaultPrevented || e.button || phone()) return;
  const a = e.target.closest && e.target.closest('a[href]'); if (!a || !/^mailto:/i.test(a.getAttribute('href').trim())) return;
  let app = 'gmail', who = '';
  try { const v = mailApp.json('gmail'); if (['gmail', 'outlook', 'app'].includes(v)) app = v; } catch {}
  try { who = String(googleEmail.text('') || ''); } catch {}
  const href = a.getAttribute('href'), url = webUrl(href, { app, who }); if (!url) return;
  e.preventDefault();
  if (window.__gsMailTest) window.__gsMailTest(href, url); else window.open(url, '_blank', 'noopener');
}
