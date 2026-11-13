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
  return { name, link: aiUrlClean(w && w.link) || aiUsual(name), tab: !!(w && w.tab), urls: w && w.urls, off: w && w.off };
}
// Every assistant she can open from the sidebar, the one in use first: the ones the app knows an address for and any of her own with a
// link, but for those she has taken off the list in Settings. A link of her own for one that isn't in use is remembered in lib.me.aiUrls,
// and the names taken off in lib.me.aiOff (the Planner reads both from gs.words).
function besideList() {
  const a = besideWho(); if (!a.link) return [];
  const m = typeof aiName === 'function' ? me() : { aiUrls: a.urls, aiOff: a.off };
  const urls = m.aiUrls && typeof m.aiUrls === 'object' ? m.aiUrls : {}, off = Array.isArray(m.aiOff) ? m.aiOff : [];
  const names = [...new Set(AI_LIST.map(x => x[0]).concat(Object.keys(urls)))].filter(n => n.toLowerCase() !== a.name.toLowerCase() && !off.includes(n));
  return [{ name: a.name, link: a.link, own: a.link !== aiUsual(a.name), cur: true }].concat(names.map(n => ({ name: n, link: aiUrlClean(urls[n]) || aiUsual(n), own: !!aiUrlClean(urls[n]) })).filter(x => x.link));
}
// Makes another assistant the one in use (grading page only: the Planner keeps none of this itself). The link she gave the last one is
// remembered under its name, and the new one's comes back.
function besideUse(name) {
  if (typeof aiName !== 'function' || name == null || name === aiName()) return;
  const m = { ...me() }, was = aiName(), urls = { ...(m.aiUrls && typeof m.aiUrls === 'object' ? m.aiUrls : {}) };
  if (was) { if (aiUrlClean(m.aiUrl)) urls[was] = aiUrlClean(m.aiUrl); else delete urls[was]; }
  const u = aiUrlClean(urls[name]); delete urls[name];
  m.ai = name; if (u) m.aiUrl = u; else delete m.aiUrl;
  if (Object.keys(urls).length) m.aiUrls = urls; else delete m.aiUrls;
  lib.me = m; saveLib(); gradeDefaultApply(); sysWords();
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
function besideOpen(how, pick) {
  const a = pick || besideWho(); if (!a.link) return false;
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
// With more than one assistant to choose from, the click opens a short list instead: each row is a link too, so the browser's own ways
// work on any of them. Picking one opens it, and on the grading page makes it the assistant in use.
function besideMenuShut(focus) { const m = document.getElementById('bsMenu'); if (!m) return; const a = m.anchor; m.remove(); if (a) { a.setAttribute('aria-expanded', 'false'); if (focus) a.focus({ preventScroll: true }); } }
function besideMenu(a) {
  besideMenuShut();
  const list = besideList(), m = document.createElement('div'), esc2 = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  m.id = 'bsMenu'; m.className = 'bsmenu'; m.setAttribute('role', 'menu'); m.setAttribute('aria-label', 'Open beside Grading Studio'); m.anchor = a;
  m.innerHTML = '<div class="bshd">Open beside Grading Studio</div>' + list.map(x => '<a class="bsrow" role="menuitem" href="' + esc2(x.link) + '" target="_blank" rel="noopener" data-bsname="' + esc2(x.name) + '"' + (x.cur ? ' aria-current="true"' : '') + '><i aria-hidden="true">' + (x.cur ? '✓' : '') + '</i><b data-raw>' + esc2(x.name) + '</b>' + (x.own ? '<small data-raw>' + esc2(host(x.link)) + '</small>' : '') + '</a>').join('') +
    '<a class="bsrow bsset" role="menuitem" href="' + (typeof aiName === 'function' ? '#/settings/claude' : './#/settings/claude') + '"><i aria-hidden="true"></i><span>Assistants and their links…</span></a>';
  document.body.appendChild(m);
  const r = a.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right + 8)) + 'px'; m.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, r.bottom - h + 6)) + 'px';
  a.setAttribute('aria-expanded', 'true');
  const first = m.querySelector('.bsrow'); if (first) first.focus({ preventScroll: true });
}
document.addEventListener('click', e => {
  const row = e.target.closest && e.target.closest('#bsMenu .bsrow');
  if (row) {
    if (row.classList.contains('bsset')) return besideMenuShut();
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return besideMenuShut();
    e.preventDefault();
    const x = besideList().find(y => y.name === row.dataset.bsname); besideMenuShut();
    if (!x) return;
    besideUse(x.name);
    besideOpen('', { ...besideWho(), name: x.name, link: x.link });
    return;
  }
  const a = e.target.closest && e.target.closest('a[data-beside]');
  if (!a) return besideMenuShut();
  if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  if (document.getElementById('bsMenu')) return besideMenuShut();
  if (besideList().length > 1) besideMenu(a); else besideOpen();
});
document.addEventListener('keydown', e => {
  const m = document.getElementById('bsMenu'); if (!m) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return besideMenuShut(true); }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault(); e.stopPropagation();
  const rows = [...m.querySelectorAll('.bsrow')], i = rows.indexOf(document.activeElement), n = rows.length;
  rows[(i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n].focus();
}, true);
window.addEventListener('storage', e => { if (!e.key || e.key === 'gs.words') { try { besidePaint(); } catch { } } });
window.__gsBeside = { who: besideWho, place: besidePlace, open: besideOpen, paint: besidePaint, clean: aiUrlClean, list: besideList, use: besideUse };
