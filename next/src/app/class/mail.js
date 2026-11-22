// Opening an email the teacher's way (src/mail.js mailGo, mailWeb): Gmail by default, Outlook on the web or the computer's own mail
// app when she chose it in Settings, and always the mail app on a phone. Called inside her click, so the new tab may open. Nothing
// is sent: the message opens ready for her to read and send.
import { mailWay } from '../../students/book.js';
import { phone, webUrl } from '../mailurl.js';
export { webUrl };
export function openMail(href) {
  const url = phone() ? '' : webUrl(href, mailWay());
  if (window.__gsMailTest) return window.__gsMailTest(href, url);
  if (url) { window.open(url, '_blank', 'noopener'); return; }
  const a = document.createElement('a'); a.href = href; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
}
