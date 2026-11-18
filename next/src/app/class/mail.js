// Opening an email the teacher's way (src/mail.js mailGo, mailWeb): Gmail by default, Outlook on the web or the computer's own mail
// app when she chose it in Settings, and always the mail app on a phone. Called inside her click, so the new tab may open. Nothing
// is sent: the message opens ready for her to read and send.
import { mailWay } from '../../students/book.js';

const phone = () => { try { const k = localStorage.getItem('gs.phone'); if (k === '1' || k === '0') return k === '1'; return Math.min(screen.width, screen.height) < 600 && matchMedia('(pointer: coarse)').matches; } catch { return false; } };
// mailto:a@x.org?bcc=…&subject=…&body=… → its parts
function parts(href) {
  const m = /^mailto:([^?#]*)(?:\?([^#]*))?/i.exec(String(href || '').trim()); if (!m) return null;
  const dec = s => { try { return decodeURIComponent(s); } catch { return s; } }, p = { to: dec(m[1]), cc: '', bcc: '', subject: '', body: '' };
  for (const kv of (m[2] || '').split('&')) { const i = kv.indexOf('='), k = (i < 0 ? kv : kv.slice(0, i)).toLowerCase(), v = i < 0 ? '' : dec(kv.slice(i + 1)); if (k === 'to') p.to = p.to ? p.to + ',' + v : v; else if (k in p) p[k] = v; }
  return p;
}
export function webUrl(href, way) {
  if (way.app === 'app') return '';
  const p = parts(href); if (!p) return '';
  const e = encodeURIComponent, q = (k, v) => (v ? '&' + k + '=' + e(v) : '');
  if (way.app === 'outlook') return ('https://outlook.office.com/mail/deeplink/compose?' + q('to', p.to) + q('cc', p.cc) + q('bcc', p.bcc) + q('subject', p.subject) + q('body', p.body)).replace('?&', '?');
  return 'https://mail.google.com/mail/?view=cm&fs=1' + (/@/.test(way.who) ? q('authuser', way.who) : '') + q('to', p.to) + q('cc', p.cc) + q('bcc', p.bcc) + q('su', p.subject) + q('body', p.body);
}
export function openMail(href) {
  const url = phone() ? '' : webUrl(href, mailWay());
  if (window.__gsMailTest) return window.__gsMailTest(href, url);
  if (url) { window.open(url, '_blank', 'noopener'); return; }
  const a = document.createElement('a'); a.href = href; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
}
