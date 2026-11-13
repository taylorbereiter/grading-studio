/* ---------------- The assistant beside the app (11/13): Gemini, Claude, ChatGPT or another, opened next to Grading Studio ----------------
   Built into both pages. A teacher who has named an AI assistant gets its name in the sidebar on every screen. A click opens the
   assistant's own page in a window on the right of the screen (or in a tab, if they'd rather); because it is a real link, Chrome's
   right-click "Open link in split view" puts it in the same window as the app, which is the closest a web page can come to one
   screen with two panes. Gemini, Claude and ChatGPT all refuse to be shown inside another page, so it cannot be drawn in here.
   Nothing is connected and nothing is sent: the app opens an address and that is all. The assistant sees only what the teacher
   pastes or attaches there. Its page says nothing back to this one, so the app can't tell whether it is still open.
   Where it opens: the assistant's usual page, or a link of the teacher's own (their school account, a Gem, a project, a custom GPT),
   kept as lib.me.aiUrl. lib.me.aiOpen is 'tab' for a teacher who wants a tab. The Planner reads both from gs.words. */
const AI_LIST = [['Gemini', 'https://gemini.google.com/app'], ['Claude', 'https://claude.ai/new'], ['ChatGPT', 'https://chatgpt.com/'], ['Copilot', 'https://copilot.microsoft.com/']];
const aiUsual = name => { const a = AI_LIST.find(x => x[0].toLowerCase() === String(name || '').trim().toLowerCase()); return a ? a[1] : ''; };
// A link of the teacher's own. Only https, so nothing but a web page can be opened from it.
function aiUrlClean(v) {
  const s = String(v == null ? '' : v).trim().slice(0, 400); if (!s) return '';
  try { const u = new URL(s); return u.protocol === 'https:' && u.hostname.includes('.') ? u.href : ''; } catch { return ''; }
}
// Who the assistant is and where it opens, on whichever page this is.
function besideWho() {
  if (typeof aiName === 'function') return { name: aiName(), link: aiLink(), tab: me().aiOpen === 'tab' };
  let w = null; try { w = JSON.parse(localStorage.getItem('gs.words') || 'null'); } catch { }
  const name = plWords().ai;
  return { name, link: aiUrlClean(w && w.link) || aiUsual(name), tab: !!(w && w.tab) };
}
// The window's place: the right of the screen, top to bottom, a little over a third of it wide.
function besidePlace() {
  const s = window.screen || {}, W = s.availWidth || 1280, H = s.availHeight || 800, w = Math.round(Math.min(760, Math.max(420, W * 0.36)));
  return { left: (s.availLeft || 0) + W - w, top: s.availTop || 0, width: w, height: H };
}
// How to make room, in the words of the computer she is on.
function besideRoom() {
  const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  if (/mac/i.test(p)) return 'hold the pointer over the green button at the top left of this window and choose the left half.';
  if (/win/i.test(p)) return 'press the Windows key with the left arrow.';
  if (/cros|chrome os/i.test(p)) return 'press Alt with the [ key.';
  return 'drag this window’s right edge to the left.';
}
// Opens it. how: 'tab' or 'side' to say which; otherwise the teacher's usual way. The window is opened empty and then sent to the
// address, so this page is not left as its opener and a browser that stops pop-ups can be noticed.
function besideOpen(how) {
  const a = besideWho(); if (!a.link) return false;
  const tab = how === 'tab' || (how !== 'side' && a.tab), at = besidePlace();
  let w = null;
  try { w = window.open('about:blank', '_blank', tab ? '' : 'popup,left=' + at.left + ',top=' + at.top + ',width=' + at.width + ',height=' + at.height); } catch { }
  if (!w) { toast('The browser stopped ' + a.name + ' from opening. Allow pop-ups for this page, then try again.', 8000); return false; }
  try { w.opener = null; } catch { }
  try { w.location.replace(a.link); } catch { try { w.close(); } catch { } return false; }
  if (!tab) {
    const covers = (window.screenX || 0) + (window.outerWidth || 0) > at.left + 24;
    toast(covers ? a.name + ' is open on the right of the screen. To see both at once, make this window narrower: ' + besideRoom() : a.name + ' is open beside Grading Studio.', covers ? 10000 : 4000);
  }
  return true;
}
// The sidebar's link, and any other marked data-beside: shown for a teacher whose assistant has an address, with its name on it.
function besidePaint() {
  const a = besideWho();
  for (const el of document.querySelectorAll('a[data-beside]')) {
    el.hidden = !a.link;
    if (a.link) { if (el.getAttribute('href') !== a.link) el.setAttribute('href', a.link); } else el.removeAttribute('href');
    const l = el.querySelector('.rl'); if (l && l.textContent !== a.name) l.textContent = a.name;
  }
}
// A plain click opens it the teacher's way. A click with Ctrl, ⌘ or Shift, the middle button and the right-click menu are left to the
// browser, so its own "new tab", "new window" and "split view" work as they do on any link.
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[data-beside]'); if (!a) return;
  if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault(); besideOpen();
});
window.addEventListener('storage', e => { if (!e.key || e.key === 'gs.words') { try { besidePaint(); } catch { } } });
window.__gsBeside = { who: besideWho, place: besidePlace, open: besideOpen, paint: besidePaint, clean: aiUrlClean };
